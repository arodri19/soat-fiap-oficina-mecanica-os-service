const path = require('node:path');
const { loadFeature, defineFeature } = require('jest-cucumber');
const { createSagaHarness } = require('../support/sagaHarness');

const feature = loadFeature(path.join(__dirname, 'features/saga-ordem-servico.feature'));

defineFeature(feature, (test) => {
  let h;
  let order;
  let originalStock;

  const currentOrder = () => h.state.orders.get(order.id);
  const currentSaga = () => [...h.state.sagas.values()].find((s) => s.orderId === order.id);
  const partByName = (name) => [...h.state.parts.values()].find((p) => p.name === name);
  const serviceByName = (name) => [...h.state.services.values()].find((s) => s.name === name);

  // ── Passos compartilhados ────────────────────────────────────────────────────
  const background = (given, and) => {
    given(/^que o cliente "(.*)" possui o veículo de placa "(.*)"$/, (clientName, plate) => {
      h = createSagaHarness();
      const client = [...h.state.clients.values()].find((c) => c.name === clientName);
      const vehicle = [...h.state.vehicles.values()].find((v) => v.plate === plate);
      expect(vehicle.clientPFId).toBe(client.id);
    });

    and(/^que o catálogo possui o serviço "(.*)" com a peça "(.*)" em estoque$/, (serviceName, partName) => {
      expect(serviceByName(serviceName)).toBeDefined();
      originalStock = partByName(partName).quantity;
      expect(originalStock).toBeGreaterThan(0);
    });
  };

  const steps = {
    abrirOS: (fn) => fn(/^o atendente abre uma OS de "(.*)" com (\d+) unidades de "(.*)"$/, async (serviceName, qty, partName) => {
      order = await h.orderService.createOrder({
        description: 'Revisão antes de viagem',
        clientPFId: 1,
        vehicleId: 1,
        services: [{ serviceId: serviceByName(serviceName).id, parts: [{ partId: partByName(partName).id, quantity: Number(qty) }] }]
      });
    }),
    budgetConfirmado: (fn) => fn('o billing-service confirma o orçamento', async () => {
      const command = h.lastCommand('CreateBudget');
      const total = command.envelope.payload.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      await h.respond('CreateBudget', 'BudgetCreated', { budgetId: 'budget-123', total });
    }),
    clienteAprova: (fn) => fn('o cliente aprova o orçamento', async () => {
      await h.orderService.approveOrder(currentOrder().externalId, 1);
    }),
    clienteRecusa: (fn) => fn('o cliente recusa o orçamento', async () => {
      await h.orderService.rejectOrder(currentOrder().externalId, 1, 'Muito caro');
    }),
    linkPagamento: (fn) => fn('o billing-service gera o link de pagamento do Mercado Pago', async () => {
      await h.respond('RequestPayment', 'PaymentRequested', {
        paymentId: 'pay-1', checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123'
      });
      expect(currentSaga().paymentUrl).toContain('mercadopago');
    }),
    pagamentoConfirmado: (fn) => fn('o Mercado Pago confirma o pagamento', async () => {
      await h.respond('RequestPayment', 'PaymentConfirmed', { paymentId: 'pay-1', amount: 170 });
    }),
    pagamentoRecusado: (fn) => fn('o Mercado Pago recusa o pagamento', async () => {
      await h.respond('RequestPayment', 'PaymentFailed', { paymentId: 'pay-1', reason: 'cc_rejected_insufficient_amount' });
    }),
    naFila: (fn) => fn('o exec-prod-service coloca a OS na fila de execução', async () => {
      await h.respond('StartExecution', 'ExecutionQueued', { executionId: 'exec-1', queuePosition: 1 });
    }),
    execRecusada: (fn) => fn('o exec-prod-service recusa a OS por falta de capacidade', async () => {
      await h.respond('StartExecution', 'ExecutionRejected', { reason: 'Capacidade máxima da oficina atingida' });
    }),
    diagnostico: (fn) => fn('o mecânico inicia o diagnóstico', async () => {
      await h.respond('StartExecution', 'ExecutionStatusChanged', { status: 'DIAGNOSING', mechanicName: 'Roberto' });
    }),
    reparo: (fn) => fn('o mecânico inicia o reparo', async () => {
      await h.respond('StartExecution', 'ExecutionStatusChanged', { status: 'REPAIRING', notes: 'Troca confirmada' });
    }),
    finaliza: (fn) => fn('o mecânico finaliza o serviço', async () => {
      await h.respond('StartExecution', 'ExecutionCompleted', { notes: 'Serviço concluído' });
    }),
    falhaReparo: (fn) => fn(/^o mecânico reporta falha "(.*)"$/, async (reason) => {
      await h.respond('StartExecution', 'ExecutionFailed', { reason });
    }),
    entrega: (fn) => fn('o atendente entrega o veículo', async () => {
      await h.orderService.deliverOrder(order.id);
    }),
    statusOS: (fn) => fn(/^a OS deve estar com status "(.*)"$/, (status) => {
      expect(currentOrder().status).toBe(status);
    }),
    sagaStatus: (fn) => fn(/^a saga deve estar "(.*)"$/, (status) => {
      expect(currentSaga().status).toBe(status);
    }),
    comandoTotal: (fn) => fn(/^o comando "(.*)" deve ser enviado ao billing-service com total de ([\d.]+)$/, (type, total) => {
      const command = h.lastCommand(type);
      expect(command.destination).toBe('test-billing-commands');
      const sum = command.envelope.payload.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      expect(sum).toBeCloseTo(Number(total), 2);
    }),
    comandoBilling: (fn) => fn(/^o comando "(.*)" deve ser enviado ao billing-service$/, (type) => {
      expect(h.lastCommand(type).destination).toBe('test-billing-commands');
    }),
    comandoExec: (fn) => fn(/^o comando "(.*)" deve ser enviado ao exec-prod-service$/, (type) => {
      expect(h.lastCommand(type).destination).toBe('test-execution-commands');
    }),
    compensacao: (fn) => fn(/^o comando de compensação "(.*)" deve ser enviado ao billing-service$/, (type) => {
      expect(h.lastCommand(type).destination).toBe('test-billing-commands');
      expect(currentSaga().pendingCompensations.length).toBeGreaterThan(0);
    }),
    estoque: (fn) => fn(/^o estoque de "(.*)" deve voltar ao valor original$/, (partName) => {
      expect(partByName(partName).quantity).toBe(originalStock);
    }),
    budgetCancelado: (fn) => fn('o billing-service confirma o cancelamento do orçamento', async () => {
      await h.respond('CancelBudget', 'BudgetCancelled', { budgetId: 'budget-123' });
    }),
    estornoConfirmado: (fn) => fn('o billing-service confirma o estorno do pagamento', async () => {
      await h.respond('RefundPayment', 'PaymentRefunded', { paymentId: 'pay-1' });
    }),
    estornoRecusado: (fn) => fn('o Mercado Pago recusa o estorno', async () => {
      await h.respond('RefundPayment', 'PaymentRefundFailed', { reason: 'refund_period_expired' });
    }),
    historico: (fn) => fn(/^o histórico da OS deve conter as transições "(.*)"$/, async (expected) => {
      const history = await h.orderService.getOrderHistory(order.id);
      const transitions = history.history
        .filter((entry) => entry.fromStatus !== entry.toStatus)
        .map((entry) => entry.toStatus);
      expect(transitions.join(' > ')).toBe(expected);
      expect(history.saga.events.length).toBeGreaterThan(0);
    })
  };

  test('Fluxo completo de uma OS passando por todos os microsserviços', ({ given, when, then, and }) => {
    background(given, and);
    steps.abrirOS(when);
    steps.statusOS(then);
    steps.comandoTotal(and);
    steps.budgetConfirmado(when);
    steps.statusOS(then);
    steps.clienteAprova(when);
    steps.statusOS(then);
    steps.comandoBilling(and);
    steps.linkPagamento(when);
    steps.pagamentoConfirmado(and);
    steps.statusOS(then);
    steps.comandoExec(and);
    steps.naFila(when);
    steps.diagnostico(and);
    steps.reparo(and);
    steps.finaliza(and);
    steps.statusOS(then);
    steps.sagaStatus(and);
    steps.entrega(when);
    steps.statusOS(then);
    steps.historico(and);
  });

  test('Cliente recusa o orçamento e a saga compensa', ({ given, when, then, and }) => {
    background(given, and);
    steps.abrirOS(when);
    steps.budgetConfirmado(and);
    steps.clienteRecusa(and);
    steps.statusOS(then);
    steps.compensacao(and);
    steps.estoque(and);
    steps.budgetCancelado(when);
    steps.sagaStatus(then);
  });

  test('Pagamento recusado pelo Mercado Pago dispara compensação', ({ given, when, then, and }) => {
    background(given, and);
    steps.abrirOS(when);
    steps.budgetConfirmado(and);
    steps.clienteAprova(and);
    steps.pagamentoRecusado(and);
    steps.statusOS(then);
    steps.compensacao(and);
    steps.budgetCancelado(when);
    steps.sagaStatus(then);
  });

  test('Execução recusada após o pagamento estorna o cliente', ({ given, when, then, and }) => {
    background(given, and);
    steps.abrirOS(when);
    steps.budgetConfirmado(and);
    steps.clienteAprova(and);
    steps.pagamentoConfirmado(and);
    steps.execRecusada(and);
    steps.statusOS(then);
    steps.compensacao(and);
    steps.estornoConfirmado(when);
    steps.sagaStatus(then);
  });

  test('Falha durante o reparo estorna o pagamento', ({ given, when, then, and }) => {
    background(given, and);
    steps.abrirOS(when);
    steps.budgetConfirmado(and);
    steps.clienteAprova(and);
    steps.pagamentoConfirmado(and);
    steps.naFila(and);
    steps.diagnostico(and);
    steps.falhaReparo(and);
    steps.statusOS(then);
    steps.compensacao(and);
    steps.estornoConfirmado(when);
    steps.sagaStatus(then);
  });

  test('Estorno recusado deixa a saga em FAILED para tratamento manual', ({ given, when, then, and }) => {
    background(given, and);
    steps.abrirOS(when);
    steps.budgetConfirmado(and);
    steps.clienteAprova(and);
    steps.pagamentoConfirmado(and);
    steps.execRecusada(and);
    steps.estornoRecusado(and);
    steps.sagaStatus(then);
  });
});
