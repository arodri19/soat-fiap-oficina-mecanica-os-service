const crypto = require('node:crypto');
const { createSagaHarness } = require('../../support/sagaHarness');
const { ValidationError } = require('../../../src/utils/validation');
const { OrderSagaOrchestrator, buildBudgetItems, customerOf } = require('../../../src/application/saga/OrderSagaOrchestrator');

async function openOrder(h, overrides = {}) {
  return h.orderService.createOrder({
    description: 'Revisão',
    clientPFId: 1,
    vehicleId: 1,
    services: [{ serviceId: 1, parts: [{ partId: 1, quantity: 2 }] }],
    ...overrides
  });
}

const sagaOf = (h, orderId) => [...h.state.sagas.values()].find((s) => s.orderId === orderId);

async function toAwaitingApproval(h) {
  const order = await openOrder(h);
  await h.respond('CreateBudget', 'BudgetCreated', { budgetId: 'b-1', total: 170 });
  return order;
}

async function toPaid(h) {
  const order = await toAwaitingApproval(h);
  await h.orderService.approveOrder(order.externalId, 1);
  await h.respond('RequestPayment', 'PaymentConfirmed', { paymentId: 'p-1' });
  return order;
}

describe('OrderSagaOrchestrator — abertura', () => {
  it('abre OS, reserva peças, cria saga e grava CreateBudget no outbox na mesma transação', async () => {
    const h = createSagaHarness();
    const order = await openOrder(h);

    expect(order.status).toBe('RECEBIDA');
    expect(order.estimatedValue).toBe(170);
    expect(order.saga).toMatchObject({ status: 'RUNNING', step: 'BUDGET_PENDING' });
    expect(h.state.parts.get(1).quantity).toBe(8);

    const [command] = h.publishOutbox();
    expect(command.type).toBe('CreateBudget');
    expect(command.envelope).toMatchObject({
      type: 'CreateBudget', orderId: order.id, replyTo: 'test-os-saga-replies', source: 'os-service',
      traceHeaders: { traceparent: '00-test' }
    });
    expect(command.envelope.payload.customer).toEqual({ name: 'João Silva', email: 'joao@example.com' });
    expect(command.envelope.payload.items).toEqual([
      { type: 'SERVICE', referenceId: 1, description: 'Troca de Óleo', quantity: 1, unitPrice: 80 },
      { type: 'PART', referenceId: 1, description: 'Óleo de Motor 5W40', quantity: 2, unitPrice: 45 }
    ]);
    expect(h.monitoring.events.map((e) => e.type)).toContain('SagaStarted');
  });

  it('reposição mock quando o estoque não basta', async () => {
    const h = createSagaHarness();
    await openOrder(h, { services: [{ serviceId: 1, parts: [{ partId: 2, quantity: 3 }] }] });
    expect(h.state.parts.get(2).quantity).toBe(1);
  });

  it('soma quantidades da mesma peça em serviços diferentes antes de reservar', async () => {
    const h = createSagaHarness();
    await openOrder(h, {
      services: [
        { serviceId: 1, parts: [{ partId: 1, quantity: 2 }] },
        { serviceId: 2, parts: [{ partId: 1, quantity: 3 }] }
      ]
    });
    expect(h.state.parts.get(1).quantity).toBe(5);
  });

  it('exige ao menos um serviço', async () => {
    const h = createSagaHarness();
    await expect(openOrder(h, { services: [] })).rejects.toThrow('Informe ao menos um serviço');
  });

  it.each([
    [{ services: [{ serviceId: 99 }] }, 'Serviço 99 não encontrado'],
    [{ services: [{ serviceId: 1, parts: [{ partId: 99 }] }] }, 'Peça 99 não encontrada']
  ])('item inexistente faz rollback completo (%#)', async (overrides, message) => {
    const h = createSagaHarness();
    await expect(openOrder(h, overrides)).rejects.toThrow(message);
    expect(h.state.orders.size).toBe(0);
    expect(h.state.sagas.size).toBe(0);
    expect(h.state.outbox).toHaveLength(0);
  });
});

describe('OrderSagaOrchestrator — respostas', () => {
  it('mensagem duplicada (mesmo messageId) é processada uma única vez', async () => {
    const h = createSagaHarness();
    await openOrder(h);
    const command = h.lastCommand('CreateBudget');
    const envelope = h.reply(command, 'BudgetCreated', { budgetId: 'b-1', total: 170 });

    expect(await h.orchestrator.handleReply(envelope)).toMatchObject({ outcome: 'HANDLED' });
    expect(await h.orchestrator.handleReply(envelope)).toEqual({ outcome: 'DUPLICATE' });
  });

  it('resposta fora de ordem é ignorada sem alterar a saga', async () => {
    const h = createSagaHarness();
    await openOrder(h);
    const { result } = await h.respond('CreateBudget', 'PaymentConfirmed', { paymentId: 'p' });
    expect(result.outcome).toBe('IGNORED_OUT_OF_ORDER');
  });

  it.each([
    ['BudgetCreated', 'CreateBudget'],
    ['ExecutionQueued', 'CreateBudget'],
    ['PaymentRequested', 'CreateBudget'],
    ['ExecutionFailed', 'CreateBudget'],
    ['PaymentFailed', 'CreateBudget']
  ])('%s fora da etapa esperada é ignorada', async (replyType) => {
    const h = createSagaHarness();
    await toAwaitingApproval(h);
    const { result } = await h.respond('CreateBudget', replyType, {});
    expect(result.outcome).toBe('IGNORED_OUT_OF_ORDER');
  });

  it('saga desconhecida e tipo sem handler são ignorados', async () => {
    const h = createSagaHarness();
    await openOrder(h);
    const command = h.lastCommand('CreateBudget');
    expect(await h.orchestrator.handleReply({ ...h.reply(command, 'BudgetCreated'), sagaId: 'nope' })).toEqual({ outcome: 'UNKNOWN_SAGA' });
    expect(await h.orchestrator.handleReply(h.reply(command, 'Whatever'))).toEqual({ outcome: 'UNHANDLED_TYPE' });
  });

  it('localiza a saga pelo orderId quando o envelope não traz sagaId', async () => {
    const h = createSagaHarness();
    const order = await openOrder(h);
    const result = await h.orchestrator.handleReply({
      messageId: crypto.randomUUID(), type: 'BudgetCreated', orderId: order.id, payload: { budgetId: 'b', total: 1 }
    });
    expect(result.outcome).toBe('HANDLED');
  });

  it('BudgetCreationFailed cancela a OS sem compensações remotas', async () => {
    const h = createSagaHarness();
    const order = await openOrder(h);
    await h.respond('CreateBudget', 'BudgetCreationFailed', {});
    expect(h.state.orders.get(order.id).status).toBe('CANCELADA');
    expect(h.state.orders.get(order.id).cancelReason).toBe('Falha ao gerar orçamento: motivo não informado');
    expect(sagaOf(h, order.id).status).toBe('COMPENSATED');
    expect(h.state.parts.get(1).quantity).toBe(10);
    expect(h.monitoring.events.map((e) => e.type)).toEqual(expect.arrayContaining(['SagaCompensationStarted', 'SagaCompensated']));
  });

  it('PaymentRequestFailed cancela o orçamento', async () => {
    const h = createSagaHarness();
    const order = await toAwaitingApproval(h);
    await h.orderService.approveOrder(order.externalId, 1);
    await h.respond('RequestPayment', 'PaymentRequestFailed', { reason: 'MP 500' });
    expect(h.lastCommand('CancelBudget').envelope.payload).toMatchObject({ budgetId: 'b-1' });
  });

  it('status de execução chegando antes do ExecutionQueued avança a saga mesmo assim', async () => {
    const h = createSagaHarness();
    const order = await toPaid(h);
    await h.respond('StartExecution', 'ExecutionStatusChanged', { status: 'DIAGNOSING', mechanicName: 'Roberto' });
    expect(h.state.orders.get(order.id)).toMatchObject({ status: 'EM_DIAGNOSTICO', mechanicName: 'Roberto' });
    expect(sagaOf(h, order.id).currentStep).toBe('IN_EXECUTION');
  });

  it('ExecutionCompleted antes do ExecutionQueued com OS ainda aguardando execução é ignorado', async () => {
    const h = createSagaHarness();
    await toPaid(h);
    const { result } = await h.respond('StartExecution', 'ExecutionCompleted', {});
    expect(result.outcome).toBe('IGNORED_INVALID_TRANSITION');
  });

  it('status de execução desconhecido ou fora de ordem não muda a OS', async () => {
    const h = createSagaHarness();
    const order = await toPaid(h);
    await h.respond('StartExecution', 'ExecutionQueued', {});
    expect((await h.respond('StartExecution', 'ExecutionStatusChanged', { status: 'XPTO' })).result.outcome).toBe('IGNORED_INVALID_TRANSITION');
    expect((await h.respond('StartExecution', 'ExecutionStatusChanged', { status: 'REPAIRING' })).result.outcome).toBe('IGNORED_INVALID_TRANSITION');
    expect(h.state.orders.get(order.id).status).toBe('AGUARDANDO_EXECUCAO');
  });

  it('ExecutionStatusChanged/Completed depois da saga terminada são ignorados', async () => {
    const h = createSagaHarness();
    await toAwaitingApproval(h);
    expect((await h.respond('CreateBudget', 'ExecutionStatusChanged', { status: 'DIAGNOSING' })).result.outcome).toBe('IGNORED_OUT_OF_ORDER');
    expect((await h.respond('CreateBudget', 'ExecutionCompleted', {})).result.outcome).toBe('IGNORED_OUT_OF_ORDER');
  });

  it('ExecutionFailed com saga aguardando a fila também compensa', async () => {
    const h = createSagaHarness();
    const order = await toPaid(h);
    await h.respond('StartExecution', 'ExecutionFailed', {});
    expect(h.state.orders.get(order.id).cancelReason).toBe('Falha na execução: motivo não informado');
    expect(h.lastCommand('RefundPayment')).toBeDefined();
  });

  it('acks de compensação inesperados e refund failure sem compensação pendente são ignorados', async () => {
    const h = createSagaHarness();
    await openOrder(h);
    expect((await h.respond('CreateBudget', 'BudgetCancelled', {})).result.outcome).toBe('IGNORED_NOT_PENDING');
    expect((await h.respond('CreateBudget', 'PaymentRefundFailed', {})).result.outcome).toBe('IGNORED_NOT_PENDING');
  });

  it('estorno recusado sem motivo usa texto padrão', async () => {
    const h = createSagaHarness();
    const order = await toPaid(h);
    await h.respond('StartExecution', 'ExecutionRejected', { reason: 'lotado' });
    await h.respond('RefundPayment', 'PaymentRefundFailed', {});
    expect(sagaOf(h, order.id).failureReason).toContain('estorno recusado');
    expect(h.monitoring.events.map((e) => e.type)).toContain('SagaFailed');
  });
});

describe('OrderSagaOrchestrator — ações do cliente e do atendente', () => {
  it('aprovação/recusa de OS de outro cliente responde null (sem vazar existência)', async () => {
    const h = createSagaHarness();
    const order = await toAwaitingApproval(h);
    await expect(h.orderService.approveOrder(order.externalId, 2)).resolves.toBeNull();
    await expect(h.orderService.rejectOrder(order.externalId, 2)).resolves.toBeNull();
    await expect(h.orderService.approveOrder('inexistente', 1)).resolves.toBeNull();
    expect(h.state.orders.get(order.id).status).toBe('AGUARDANDO_APROVACAO');
  });

  it('aprovação/recusa fora de AGUARDANDO_APROVACAO é rejeitada', async () => {
    const h = createSagaHarness();
    const order = await openOrder(h);
    await expect(h.orderService.approveOrder(order.externalId, 1)).rejects.toBeInstanceOf(ValidationError);
    await expect(h.orderService.rejectOrder(order.externalId, 1)).rejects.toThrow(/não está aguardando aprovação/);
  });

  it('aprovação envia RequestPayment com dados do pagador', async () => {
    const h = createSagaHarness();
    const order = await toAwaitingApproval(h);
    await h.orderService.approveOrder(order.externalId, 1);
    expect(h.lastCommand('RequestPayment').envelope.payload).toEqual({
      externalId: order.externalId, payer: { name: 'João Silva', email: 'joao@example.com' }
    });
  });

  it('recusa sem motivo usa texto padrão', async () => {
    const h = createSagaHarness();
    const order = await toAwaitingApproval(h);
    await h.orderService.rejectOrder(order.externalId, 1);
    expect(h.state.orders.get(order.id).cancelReason).toBe('Orçamento recusado pelo cliente');
  });

  it('atendente cancela OS em execução → CancelExecution + RefundPayment', async () => {
    const h = createSagaHarness();
    const order = await toPaid(h);
    await h.respond('StartExecution', 'ExecutionQueued', {});
    await h.orderService.cancelOrder(order.id, 'cliente desistiu');

    expect(h.state.orders.get(order.id)).toMatchObject({ status: 'CANCELADA', cancelReason: 'Cancelada pelo atendente: cliente desistiu' });
    expect(h.lastCommand('CancelExecution').destination).toBe('test-execution-commands');
    expect(h.lastCommand('RefundPayment').envelope.payload.paymentId).toBe('p-1');

    await h.respond('CancelExecution', 'ExecutionCancelled', {});
    expect(sagaOf(h, order.id).status).toBe('COMPENSATING');
    await h.respond('RefundPayment', 'PaymentRefunded', {});
    expect(sagaOf(h, order.id).status).toBe('COMPENSATED');
  });

  it('cancelamento: OS sem saga → null; saga já terminada → erro; motivo opcional', async () => {
    const h = createSagaHarness();
    await expect(h.orderService.cancelOrder(999)).resolves.toBeNull();
    const order = await openOrder(h);
    await h.orderService.cancelOrder(order.id);
    expect(h.state.orders.get(order.id).cancelReason).toBe('Cancelada pelo atendente');
    await expect(h.orderService.cancelOrder(order.id)).rejects.toThrow(/não está em andamento/);
  });

  it('entrega só é possível após FINALIZADA', async () => {
    const h = createSagaHarness();
    const order = await openOrder(h);
    await expect(h.orderService.deliverOrder(order.id)).rejects.toBeInstanceOf(ValidationError);
    await expect(h.orderService.deliverOrder(999)).resolves.toBeNull();
  });
});

describe('OrderSagaOrchestrator — timeouts', () => {
  it('compensa sagas paradas além do limite da etapa', async () => {
    const h = createSagaHarness();
    const order = await toAwaitingApproval(h);
    const fresh = await openOrder(h);

    h.now.value = new Date(h.now.value.getTime() + 73 * 60 * 60_000);
    // A OS recém-aberta (BUDGET_PENDING, limite 10 min) também estourou
    const expired = await h.orchestrator.expireTimedOutSagas();

    expect(expired).toBe(2);
    expect(h.state.orders.get(order.id).cancelReason).toBe('Tempo limite excedido na etapa AWAITING_APPROVAL');
    expect(h.state.orders.get(fresh.id).status).toBe('CANCELADA');
    expect(h.lastCommand('CancelBudget')).toBeDefined();
  });

  it('não expira sagas dentro do prazo', async () => {
    const h = createSagaHarness();
    await toAwaitingApproval(h);
    h.now.value = new Date(h.now.value.getTime() + 60 * 60_000);
    await expect(h.orchestrator.expireTimedOutSagas()).resolves.toBe(0);
  });
});

describe('OrderSagaOrchestrator — helpers', () => {
  it('buildBudgetItems usa nomes padrão quando o catálogo não traz descrição', () => {
    expect(buildBudgetItems({ services: [{ serviceId: 5, unitPrice: 1, parts: [{ partId: 6, quantity: 1, unitPrice: 2 }] }] }))
      .toEqual([
        { type: 'SERVICE', referenceId: 5, description: 'Serviço 5', quantity: 1, unitPrice: 1 },
        { type: 'PART', referenceId: 6, description: 'Peça 6', quantity: 1, unitPrice: 2 }
      ]);
    expect(buildBudgetItems({})).toEqual([]);
  });

  it('customerOf usa PF, depois PJ, ou null', () => {
    expect(customerOf({ clientPF: { name: 'A', email: 'a@a' } })).toEqual({ name: 'A', email: 'a@a' });
    expect(customerOf({ clientPJ: { name: 'B', email: 'b@b' } })).toEqual({ name: 'B', email: 'b@b' });
    expect(customerOf({})).toBeNull();
  });

  it('usa relógio e gerador de id padrão quando não injetados', () => {
    const orchestrator = new OrderSagaOrchestrator({ unitOfWork: {}, queues: {} });
    expect(orchestrator.clock()).toBeInstanceOf(Date);
    expect(orchestrator.idGenerator()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
