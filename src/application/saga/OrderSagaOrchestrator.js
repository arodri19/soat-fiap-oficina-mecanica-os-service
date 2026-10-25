const crypto = require('node:crypto');
const Order = require('../../domain/entities/Order');
const { OrderSaga, SagaStep, SagaStatus, Compensation } = require('../../domain/saga/OrderSaga');
const { ValidationError } = require('../../utils/validation');
const {
  BillingCommands,
  ExecutionCommands,
  Replies,
  createEnvelope
} = require('../messaging/contracts');

// Etapa de execução reportada pelo exec-prod-service → status da OS
const EXECUTION_STATUS_TO_ORDER_STATUS = Object.freeze({
  DIAGNOSING: 'EM_DIAGNOSTICO',
  REPAIRING: 'EM_EXECUCAO'
});

// Resposta de compensação → compensação que ela confirma
const COMPENSATION_ACKS = Object.freeze({
  [Replies.BUDGET_CANCELLED]: Compensation.CANCEL_BUDGET,
  [Replies.PAYMENT_REFUNDED]: Compensation.REFUND_PAYMENT,
  [Replies.EXECUTION_CANCELLED]: Compensation.CANCEL_EXECUTION
});

const DEFAULT_TIMEOUTS_IN_MINUTES = Object.freeze({
  [SagaStep.BUDGET_PENDING]: 10,
  [SagaStep.AWAITING_APPROVAL]: 72 * 60,
  [SagaStep.PAYMENT_PENDING]: 48 * 60,
  [SagaStep.EXECUTION_PENDING]: 10
});

/**
 * Orquestrador central da saga "ORDER_FULFILLMENT":
 *
 *   abrir OS ─► CreateBudget (billing) ─► BudgetCreated ─► [cliente aprova]
 *     ─► RequestPayment (billing / Mercado Pago) ─► PaymentConfirmed
 *     ─► StartExecution (exec-prod) ─► ExecutionQueued ─► ... ─► ExecutionCompleted ─► OS FINALIZADA
 *
 * Toda mudança de estado (OS + saga) e todo comando enviado são gravados na MESMA
 * transação (Transactional Outbox) — o OutboxRelay publica no SQS depois. Respostas
 * são processadas uma única vez (Inbox). Falha em qualquer etapa dispara as
 * compensações das etapas já efetivadas (ver OrderSaga.startCompensation).
 */
class OrderSagaOrchestrator {
  constructor({ unitOfWork, queues, monitoring, notifier, tracing, logger, clock, idGenerator, timeoutsInMinutes }) {
    this.unitOfWork = unitOfWork;
    this.queues = queues;
    this.monitoring = monitoring;
    this.notifier = notifier;
    this.tracing = tracing;
    this.logger = logger;
    this.clock = clock || (() => new Date());
    this.idGenerator = idGenerator || (() => crypto.randomUUID());
    this.timeoutsInMinutes = { ...DEFAULT_TIMEOUTS_IN_MINUTES, ...(timeoutsInMinutes || {}) };

    this.replyHandlers = {
      [Replies.BUDGET_CREATED]: this.#onBudgetCreated.bind(this),
      [Replies.BUDGET_CREATION_FAILED]: this.#failAt(SagaStep.BUDGET_PENDING, 'Falha ao gerar orçamento'),
      [Replies.PAYMENT_REQUESTED]: this.#onPaymentRequested.bind(this),
      [Replies.PAYMENT_REQUEST_FAILED]: this.#failAt(SagaStep.PAYMENT_PENDING, 'Falha ao gerar cobrança'),
      [Replies.PAYMENT_CONFIRMED]: this.#onPaymentConfirmed.bind(this),
      [Replies.PAYMENT_FAILED]: this.#failAt(SagaStep.PAYMENT_PENDING, 'Pagamento não aprovado'),
      [Replies.EXECUTION_QUEUED]: this.#onExecutionQueued.bind(this),
      [Replies.EXECUTION_REJECTED]: this.#failAt(SagaStep.EXECUTION_PENDING, 'Execução recusada'),
      [Replies.EXECUTION_STATUS_CHANGED]: this.#onExecutionStatusChanged.bind(this),
      [Replies.EXECUTION_COMPLETED]: this.#onExecutionCompleted.bind(this),
      [Replies.EXECUTION_FAILED]: this.#onExecutionFailed.bind(this),
      [Replies.BUDGET_CANCELLED]: this.#onCompensationAck.bind(this),
      [Replies.PAYMENT_REFUNDED]: this.#onCompensationAck.bind(this),
      [Replies.EXECUTION_CANCELLED]: this.#onCompensationAck.bind(this),
      [Replies.PAYMENT_REFUND_FAILED]: this.#onRefundFailed.bind(this)
    };
  }

  // ── Início (chamado pelo CreateOrderUseCase, dentro da transação de abertura) ──
  async startForOrder(ctx, order, customer) {
    const saga = OrderSaga.start({ id: this.idGenerator(), orderId: order.id, now: this.clock() });
    await ctx.sagas.create(saga);

    await this.#send(ctx, saga, this.queues.billingCommands, BillingCommands.CREATE_BUDGET, {
      externalId: order.externalId,
      customer,
      items: buildBudgetItems(order)
    });

    this.monitoring.recordSagaEvent('SagaStarted', { sagaId: saga.id, orderId: order.id });
    return saga;
  }

  // ── Ações do cliente (rotas /track, JWT role CLIENT) ─────────────────────────
  async approve(externalId, requesterId) {
    return this.unitOfWork.run(async (ctx) => {
      const { raw, saga } = await this.#loadOwnedOrder(ctx, externalId, requesterId);
      if (!raw) return null;
      if (!saga?.isAt(SagaStep.AWAITING_APPROVAL)) {
        throw new ValidationError(`Ordem não está aguardando aprovação. Status atual: ${raw.status}.`);
      }

      const updated = await this.#changeOrderStatus(ctx, raw, (order) => order.approve(), 'CLIENT', 'Orçamento aprovado pelo cliente');
      saga.approved(this.clock());
      await this.#send(ctx, saga, this.queues.billingCommands, BillingCommands.REQUEST_PAYMENT, {
        externalId: raw.externalId,
        payer: customerOf(raw)
      });
      await ctx.sagas.save(saga);
      this.monitoring.recordSagaEvent('SagaStepCompleted', { sagaId: saga.id, orderId: raw.id, step: SagaStep.AWAITING_APPROVAL });
      return updated;
    });
  }

  async reject(externalId, requesterId, reason) {
    return this.unitOfWork.run(async (ctx) => {
      const { raw, saga } = await this.#loadOwnedOrder(ctx, externalId, requesterId);
      if (!raw) return null;
      if (!saga?.isAt(SagaStep.AWAITING_APPROVAL)) {
        throw new ValidationError(`Ordem não está aguardando aprovação. Status atual: ${raw.status}.`);
      }
      return this.#compensate(ctx, saga, `Orçamento recusado pelo cliente${reason ? `: ${reason}` : ''}`, 'CLIENT');
    });
  }

  // ── Cancelamento pelo atendente (qualquer etapa ainda não finalizada) ────────
  async cancel(orderId, reason) {
    return this.unitOfWork.run(async (ctx) => {
      const saga = await ctx.sagas.findByOrderId(orderId);
      if (!saga) return null;
      if (!saga.isRunning()) {
        throw new ValidationError(`A saga desta OS não está em andamento (status: ${saga.status}).`);
      }
      return this.#compensate(ctx, saga, `Cancelada pelo atendente${reason ? `: ${reason}` : ''}`, 'STAFF');
    });
  }

  // ── Respostas dos participantes (consumidas da fila SQS de respostas) ────────
  async handleReply(envelope) {
    return this.unitOfWork.run(async (ctx) => {
      const isNew = await ctx.inbox.markProcessed(envelope.messageId, envelope.type);
      if (!isNew) return { outcome: 'DUPLICATE' };

      const saga = envelope.sagaId
        ? await ctx.sagas.findById(envelope.sagaId)
        : await ctx.sagas.findByOrderId(envelope.orderId);
      if (!saga) {
        this.logger.warn({ envelope }, 'Resposta de saga desconhecida — ignorada');
        return { outcome: 'UNKNOWN_SAGA' };
      }

      const handler = this.replyHandlers[envelope.type];
      if (!handler) {
        this.logger.warn({ type: envelope.type }, 'Tipo de mensagem sem handler — ignorado');
        return { outcome: 'UNHANDLED_TYPE' };
      }

      await ctx.sagas.addEvent({ sagaId: saga.id, kind: 'REPLY_RECEIVED', type: envelope.type, payload: envelope.payload });
      const outcome = await handler(ctx, saga, envelope);
      return { outcome: outcome || 'HANDLED', sagaStatus: saga.status, step: saga.currentStep };
    });
  }

  // ── Timeouts: etapa parada além do limite → compensação ──────────────────────
  async expireTimedOutSagas() {
    const now = this.clock();
    const shortest = Math.min(...Object.values(this.timeoutsInMinutes));
    const candidates = await this.unitOfWork.run((ctx) =>
      ctx.sagas.findRunningWithStepStartedBefore(new Date(now.getTime() - shortest * 60_000))
    );

    let expired = 0;
    for (const candidate of candidates) {
      const didExpire = await this.unitOfWork.run(async (ctx) => {
        const saga = await ctx.sagas.findById(candidate.id);
        if (!saga?.isTimedOut(now, this.timeoutsInMinutes)) return false;
        await this.#compensate(ctx, saga, `Tempo limite excedido na etapa ${saga.currentStep}`, 'SAGA_TIMEOUT');
        return true;
      });
      if (didExpire) expired += 1;
    }
    return expired;
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  async #onBudgetCreated(ctx, saga, { payload }) {
    if (!saga.isAt(SagaStep.BUDGET_PENDING)) return 'IGNORED_OUT_OF_ORDER';
    const raw = await ctx.orders.findById(saga.orderId);

    saga.budgetCreated({ budgetId: payload.budgetId }, this.clock());
    await this.#changeOrderStatus(
      ctx, raw,
      (order) => order.budgetCreated({ budgetId: payload.budgetId, total: payload.total }),
      'BILLING',
      `Orçamento ${payload.budgetId} gerado: R$ ${Number(payload.total).toFixed(2)}`
    );
    await ctx.sagas.save(saga);
    this.monitoring.recordSagaEvent('SagaStepCompleted', { sagaId: saga.id, orderId: saga.orderId, step: SagaStep.BUDGET_PENDING });
    return 'HANDLED';
  }

  async #onPaymentRequested(ctx, saga, { payload }) {
    if (!saga.isAt(SagaStep.PAYMENT_PENDING)) return 'IGNORED_OUT_OF_ORDER';
    saga.paymentRequested({ paymentId: payload.paymentId, checkoutUrl: payload.checkoutUrl });
    await ctx.sagas.save(saga);
    return 'HANDLED';
  }

  async #onPaymentConfirmed(ctx, saga, { payload }) {
    if (!saga.isAt(SagaStep.PAYMENT_PENDING)) return 'IGNORED_OUT_OF_ORDER';
    const raw = await ctx.orders.findById(saga.orderId);

    saga.confirmPayment({ paymentId: payload.paymentId }, this.clock());
    await this.#changeOrderStatus(ctx, raw, (order) => order.transitionTo('AGUARDANDO_EXECUCAO'), 'BILLING', 'Pagamento confirmado');
    await this.#send(ctx, saga, this.queues.executionCommands, ExecutionCommands.START_EXECUTION, {
      externalId: raw.externalId,
      description: raw.description,
      vehicle: raw.vehicle ? { plate: raw.vehicle.plate, model: raw.vehicle.model } : null,
      services: (raw.services || []).map((s) => ({
        serviceId: s.serviceId,
        name: s.service?.name,
        slaMinutes: s.service?.slaMinutes,
        parts: (s.parts || []).map((p) => ({ partId: p.partId, name: p.part?.name, quantity: p.quantity }))
      }))
    });
    await ctx.sagas.save(saga);
    this.monitoring.recordSagaEvent('SagaStepCompleted', { sagaId: saga.id, orderId: saga.orderId, step: SagaStep.PAYMENT_PENDING });
    return 'HANDLED';
  }

  async #onExecutionQueued(ctx, saga, { payload }) {
    if (!saga.isAt(SagaStep.EXECUTION_PENDING)) return 'IGNORED_OUT_OF_ORDER';
    saga.markExecutionQueued(this.clock());
    const position = payload.queuePosition ? ` (posição ${payload.queuePosition})` : '';
    await ctx.orders.addHistory({
      orderId: saga.orderId, fromStatus: 'AGUARDANDO_EXECUCAO', toStatus: 'AGUARDANDO_EXECUCAO',
      source: 'EXECUTION', note: `OS entrou na fila de execução${position}`
    });
    await ctx.sagas.save(saga);
    this.monitoring.recordSagaEvent('SagaStepCompleted', { sagaId: saga.id, orderId: saga.orderId, step: SagaStep.EXECUTION_PENDING });
    return 'HANDLED';
  }

  async #onExecutionStatusChanged(ctx, saga, { payload }) {
    // SQS padrão não garante ordem: um status de execução pode chegar antes do
    // ExecutionQueued — a mudança de status em si já prova que a OS está na fila.
    if (saga.isAt(SagaStep.EXECUTION_PENDING)) saga.markExecutionQueued(this.clock());
    if (!saga.isAt(SagaStep.IN_EXECUTION)) return 'IGNORED_OUT_OF_ORDER';

    const targetStatus = EXECUTION_STATUS_TO_ORDER_STATUS[payload.status];
    const raw = await ctx.orders.findById(saga.orderId);
    if (!targetStatus || !Order.fromPrisma(raw).status.canTransitionTo(targetStatus)) {
      await ctx.sagas.save(saga);
      return 'IGNORED_INVALID_TRANSITION';
    }

    await this.#changeOrderStatus(ctx, raw, (order) => {
      if (payload.mechanicName) order.mechanicName = payload.mechanicName;
      order.transitionTo(targetStatus);
    }, 'EXECUTION', payload.notes || null);
    await ctx.sagas.save(saga);
    return 'HANDLED';
  }

  async #onExecutionCompleted(ctx, saga, { payload }) {
    if (saga.isAt(SagaStep.EXECUTION_PENDING)) saga.markExecutionQueued(this.clock());
    if (!saga.isAt(SagaStep.IN_EXECUTION)) return 'IGNORED_OUT_OF_ORDER';

    const raw = await ctx.orders.findById(saga.orderId);
    if (!Order.fromPrisma(raw).status.canTransitionTo('FINALIZADA')) {
      await ctx.sagas.save(saga);
      return 'IGNORED_INVALID_TRANSITION';
    }

    saga.executionCompleted(this.clock());
    await this.#changeOrderStatus(ctx, raw, (order) => order.transitionTo('FINALIZADA'), 'EXECUTION', payload.notes || 'Serviço finalizado');
    await ctx.sagas.save(saga);
    this.monitoring.recordSagaEvent('SagaCompleted', { sagaId: saga.id, orderId: saga.orderId });
    return 'HANDLED';
  }

  async #onExecutionFailed(ctx, saga, { payload }) {
    if (!saga.isAt(SagaStep.IN_EXECUTION) && !saga.isAt(SagaStep.EXECUTION_PENDING)) return 'IGNORED_OUT_OF_ORDER';
    if (saga.isAt(SagaStep.EXECUTION_PENDING)) saga.markExecutionQueued(this.clock());
    saga.executionFailed();
    await this.#compensate(ctx, saga, `Falha na execução: ${payload.reason || 'motivo não informado'}`, 'EXECUTION');
    return 'COMPENSATING';
  }

  async #onCompensationAck(ctx, saga, { type }) {
    const acknowledged = saga.compensationAcknowledged(COMPENSATION_ACKS[type]);
    if (!acknowledged) return 'IGNORED_NOT_PENDING';
    await ctx.sagas.save(saga);
    if (saga.status === SagaStatus.COMPENSATED) {
      this.monitoring.recordSagaEvent('SagaCompensated', { sagaId: saga.id, orderId: saga.orderId, reason: saga.failureReason });
    }
    return 'HANDLED';
  }

  async #onRefundFailed(ctx, saga, { payload }) {
    const changed = saga.compensationFailed(Compensation.REFUND_PAYMENT, payload.reason || 'estorno recusado');
    if (!changed) return 'IGNORED_NOT_PENDING';
    await ctx.sagas.save(saga);
    this.logger.error({ sagaId: saga.id, orderId: saga.orderId, reason: payload.reason }, 'Compensação falhou — intervenção manual necessária');
    this.monitoring.recordSagaEvent('SagaFailed', { sagaId: saga.id, orderId: saga.orderId, reason: saga.failureReason });
    return 'FAILED';
  }

  #failAt(step, reasonPrefix) {
    return async (ctx, saga, { payload }) => {
      if (!saga.isAt(step)) return 'IGNORED_OUT_OF_ORDER';
      await this.#compensate(ctx, saga, `${reasonPrefix}: ${payload.reason || 'motivo não informado'}`, step);
      return 'COMPENSATING';
    };
  }

  // ── Compensação ─────────────────────────────────────────────────────────────
  async #compensate(ctx, saga, reason, source) {
    const compensations = saga.startCompensation(reason, this.clock());
    const raw = await ctx.orders.findById(saga.orderId);

    for (const compensation of compensations) {
      if (compensation === Compensation.CANCEL_EXECUTION) {
        await this.#send(ctx, saga, this.queues.executionCommands, ExecutionCommands.CANCEL_EXECUTION, { reason });
      } else if (compensation === Compensation.REFUND_PAYMENT) {
        await this.#send(ctx, saga, this.queues.billingCommands, BillingCommands.REFUND_PAYMENT, { reason, paymentId: saga.paymentId });
      } else if (compensation === Compensation.CANCEL_BUDGET) {
        await this.#send(ctx, saga, this.queues.billingCommands, BillingCommands.CANCEL_BUDGET, { reason, budgetId: saga.budgetId });
      }
    }

    // Compensações locais: devolve ao estoque as peças reservadas na abertura e cancela a OS.
    let updated = raw;
    if (!Order.fromPrisma(raw).isTerminal()) {
      await releaseReservedParts(ctx, raw);
      updated = await this.#changeOrderStatus(ctx, raw, (order) => order.cancel(reason), source, reason);
    }

    await ctx.sagas.addEvent({ sagaId: saga.id, kind: 'COMPENSATION_STARTED', type: 'Compensate', payload: { reason, compensations } });
    await ctx.sagas.save(saga);

    this.monitoring.recordSagaEvent('SagaCompensationStarted', {
      sagaId: saga.id, orderId: saga.orderId, reason, compensations: compensations.join(',') || 'none'
    });
    if (saga.status === SagaStatus.COMPENSATED) {
      this.monitoring.recordSagaEvent('SagaCompensated', { sagaId: saga.id, orderId: saga.orderId, reason });
    }
    return updated;
  }

  // ── Infra helpers ───────────────────────────────────────────────────────────
  async #send(ctx, saga, destination, type, payload) {
    const envelope = createEnvelope({
      type,
      sagaId: saga.id,
      orderId: saga.orderId,
      payload,
      replyTo: this.queues.osReplies,
      traceHeaders: this.tracing.currentTraceHeaders()
    });
    await ctx.outbox.add({ id: envelope.messageId, destination, type, envelope });
    await ctx.sagas.addEvent({ sagaId: saga.id, kind: 'COMMAND_SENT', type, payload });
    return envelope;
  }

  async #changeOrderStatus(ctx, raw, mutate, source, note) {
    const order = Order.fromPrisma(raw);
    const fromStatus = order.status.toString();
    mutate(order);
    const toStatus = order.status.toString();

    const updated = await ctx.orders.update(raw.id, {
      status: toStatus,
      budgetId: order.budgetId,
      budgetValue: order.budgetValue,
      cancelReason: order.cancelReason,
      mechanicName: order.mechanicName,
      startAt: order.startAt,
      endAt: order.endAt
    });
    await ctx.orders.addHistory({ orderId: raw.id, fromStatus, toStatus, source, note });

    this.notifier.sendOrderStatusEmail({
      to: raw.clientPF?.email || raw.clientPJ?.email,
      orderId: raw.id,
      externalId: raw.externalId,
      status: toStatus
    });
    this.monitoring.recordOrderStatusChanged({
      orderId: raw.id,
      externalId: raw.externalId,
      fromStatus,
      toStatus,
      secondsInPreviousStatus: raw.updatedAt ? (Date.now() - new Date(raw.updatedAt).getTime()) / 1000 : null
    });
    return updated;
  }

  async #loadOwnedOrder(ctx, externalId, requesterId) {
    const raw = await ctx.orders.findByExternalId(externalId);
    // requesterId (sub do JWT do cliente) — uma OS de outro cliente responde como
    // inexistente, sem revelar que o externalId existe.
    if (!raw || raw.clientPFId !== requesterId) return { raw: null, saga: null };
    const saga = await ctx.sagas.findByOrderId(raw.id);
    return { raw, saga };
  }
}

function customerOf(raw) {
  const client = raw.clientPF || raw.clientPJ;
  return client ? { name: client.name, email: client.email } : null;
}

function buildBudgetItems(order) {
  return (order.services || []).flatMap((item) => [
    {
      type: 'SERVICE',
      referenceId: item.serviceId,
      description: item.service?.name || `Serviço ${item.serviceId}`,
      quantity: 1,
      unitPrice: item.unitPrice
    },
    ...(item.parts || []).map((p) => ({
      type: 'PART',
      referenceId: p.partId,
      description: p.part?.name || `Peça ${p.partId}`,
      quantity: p.quantity,
      unitPrice: p.unitPrice
    }))
  ]);
}

async function releaseReservedParts(ctx, raw) {
  for (const item of raw.services || []) {
    for (const part of item.parts || []) {
      await ctx.catalog.incrementStock(part.partId, part.quantity);
    }
  }
}

module.exports = {
  OrderSagaOrchestrator,
  DEFAULT_TIMEOUTS_IN_MINUTES,
  buildBudgetItems,
  customerOf
};
