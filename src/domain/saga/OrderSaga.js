// Entidade de domínio da saga orquestrada de uma ordem de serviço.
// Puro (sem I/O): decide para qual etapa a saga vai a cada resposta e QUAIS
// compensações são necessárias numa falha — o orquestrador (camada de aplicação)
// só traduz essas decisões em comandos/mudanças de estado persistidas.

const SAGA_TYPE = 'ORDER_FULFILLMENT';

const SagaStatus = Object.freeze({
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  COMPENSATING: 'COMPENSATING',
  COMPENSATED: 'COMPENSATED',
  FAILED: 'FAILED'
});

const SagaStep = Object.freeze({
  BUDGET_PENDING: 'BUDGET_PENDING',         // aguardando billing criar o orçamento
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',   // aguardando o cliente aprovar/recusar
  PAYMENT_PENDING: 'PAYMENT_PENDING',       // aguardando confirmação do pagamento (Mercado Pago)
  EXECUTION_PENDING: 'EXECUTION_PENDING',   // aguardando exec-prod aceitar a OS na fila
  IN_EXECUTION: 'IN_EXECUTION',             // diagnóstico/reparo em andamento
  DONE: 'DONE',
  COMPENSATION: 'COMPENSATION'
});

// Compensações (ações semânticas de "desfazer" em outros serviços)
const Compensation = Object.freeze({
  CANCEL_EXECUTION: 'CANCEL_EXECUTION',
  REFUND_PAYMENT: 'REFUND_PAYMENT',
  CANCEL_BUDGET: 'CANCEL_BUDGET'
});

class SagaTransitionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SagaTransitionError';
  }
}

class OrderSaga {
  constructor({
    id, orderId, type = SAGA_TYPE, status, currentStep, budgetId = null, paymentId = null, paymentUrl = null,
    paymentConfirmed = false, executionQueued = false, executionTerminal = false,
    pendingCompensations = [], failureReason = null, version = 0, stepStartedAt = new Date(), createdAt, updatedAt
  }) {
    this.id = id;
    this.orderId = orderId;
    this.type = type;
    this.status = status;
    this.currentStep = currentStep;
    this.budgetId = budgetId;
    this.paymentId = paymentId;
    this.paymentUrl = paymentUrl;
    this.paymentConfirmed = paymentConfirmed;
    this.executionQueued = executionQueued;
    this.executionTerminal = executionTerminal;
    this.pendingCompensations = [...pendingCompensations];
    this.failureReason = failureReason;
    this.version = version;
    this.stepStartedAt = stepStartedAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static start({ id, orderId, now = new Date() }) {
    return new OrderSaga({
      id,
      orderId,
      status: SagaStatus.RUNNING,
      currentStep: SagaStep.BUDGET_PENDING,
      stepStartedAt: now
    });
  }

  isRunning() {
    return this.status === SagaStatus.RUNNING;
  }

  isCompensating() {
    return this.status === SagaStatus.COMPENSATING;
  }

  isAt(step) {
    return this.isRunning() && this.currentStep === step;
  }

  #moveTo(step, now) {
    this.currentStep = step;
    this.stepStartedAt = now || new Date();
  }

  #require(step, action) {
    if (!this.isAt(step)) {
      throw new SagaTransitionError(
        `Saga ${this.id}: "${action}" exige etapa ${step} (atual: ${this.status}/${this.currentStep}).`
      );
    }
  }

  budgetCreated({ budgetId }, now) {
    this.#require(SagaStep.BUDGET_PENDING, 'budgetCreated');
    this.budgetId = budgetId;
    this.#moveTo(SagaStep.AWAITING_APPROVAL, now);
  }

  approved(now) {
    this.#require(SagaStep.AWAITING_APPROVAL, 'approved');
    this.#moveTo(SagaStep.PAYMENT_PENDING, now);
  }

  paymentRequested({ paymentId, checkoutUrl }) {
    this.#require(SagaStep.PAYMENT_PENDING, 'paymentRequested');
    this.paymentId = paymentId;
    this.paymentUrl = checkoutUrl || null;
  }

  confirmPayment({ paymentId }, now) {
    this.#require(SagaStep.PAYMENT_PENDING, 'confirmPayment');
    this.paymentConfirmed = true;
    if (paymentId) this.paymentId = paymentId;
    this.#moveTo(SagaStep.EXECUTION_PENDING, now);
  }

  markExecutionQueued(now) {
    this.#require(SagaStep.EXECUTION_PENDING, 'markExecutionQueued');
    this.executionQueued = true;
    this.#moveTo(SagaStep.IN_EXECUTION, now);
  }

  executionCompleted(now) {
    this.#require(SagaStep.IN_EXECUTION, 'executionCompleted');
    this.executionTerminal = true;
    this.status = SagaStatus.COMPLETED;
    this.#moveTo(SagaStep.DONE, now);
  }

  // Marca que a execução terminou com falha no exec-prod (não precisa cancelar lá).
  executionFailed() {
    this.executionTerminal = true;
  }

  // Decide as compensações a partir do que JÁ foi efetivado nos outros serviços.
  // Ordem semântica inversa: execução → pagamento → orçamento. Estorno do pagamento
  // já cancela o orçamento no billing (mesmo agregado), então os dois são exclusivos.
  startCompensation(reason, now) {
    if (!this.isRunning()) {
      throw new SagaTransitionError(`Saga ${this.id} não está em andamento (status: ${this.status}).`);
    }

    const compensations = [];
    if (this.executionQueued && !this.executionTerminal) {
      compensations.push(Compensation.CANCEL_EXECUTION);
    }
    if (this.paymentConfirmed) {
      compensations.push(Compensation.REFUND_PAYMENT);
    } else if (this.budgetId) {
      compensations.push(Compensation.CANCEL_BUDGET);
    }

    this.failureReason = reason;
    this.pendingCompensations = compensations;
    this.status = compensations.length ? SagaStatus.COMPENSATING : SagaStatus.COMPENSATED;
    this.#moveTo(SagaStep.COMPENSATION, now);
    return compensations;
  }

  compensationAcknowledged(compensation) {
    if (!this.isCompensating()) return false;
    const before = this.pendingCompensations.length;
    this.pendingCompensations = this.pendingCompensations.filter((c) => c !== compensation);
    if (this.pendingCompensations.length === before) return false;
    if (this.pendingCompensations.length === 0) {
      this.status = SagaStatus.COMPENSATED;
    }
    return true;
  }

  // Uma compensação que falhou (ex: estorno recusado pelo Mercado Pago) não tem
  // rollback automático possível — a saga vai para FAILED e dispara alerta para
  // tratamento manual.
  compensationFailed(compensation, reason) {
    if (!this.isCompensating()) return false;
    this.pendingCompensations = this.pendingCompensations.filter((c) => c !== compensation);
    this.status = SagaStatus.FAILED;
    this.failureReason = `${this.failureReason || ''} | compensação ${compensation} falhou: ${reason}`.replace(/^ \| /, '');
    return true;
  }

  isTimedOut(now, timeoutsInMinutes) {
    if (!this.isRunning()) return false;
    const limit = timeoutsInMinutes[this.currentStep];
    if (!limit) return false;
    return now.getTime() - new Date(this.stepStartedAt).getTime() > limit * 60_000;
  }
}

module.exports = {
  OrderSaga,
  SagaStatus,
  SagaStep,
  Compensation,
  SagaTransitionError,
  SAGA_TYPE
};
