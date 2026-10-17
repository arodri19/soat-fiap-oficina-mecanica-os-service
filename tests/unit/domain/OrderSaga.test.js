const {
  OrderSaga,
  SagaStatus,
  SagaStep,
  Compensation,
  SagaTransitionError
} = require('../../../src/domain/saga/OrderSaga');

const now = new Date('2026-10-17T10:00:00Z');

function sagaAt(step, extra = {}) {
  return new OrderSaga({ id: 's-1', orderId: 1, status: SagaStatus.RUNNING, currentStep: step, stepStartedAt: now, ...extra });
}

describe('OrderSaga — avanço das etapas', () => {
  it('start cria saga RUNNING aguardando orçamento', () => {
    const saga = OrderSaga.start({ id: 's-1', orderId: 1, now });
    expect(saga.status).toBe(SagaStatus.RUNNING);
    expect(saga.currentStep).toBe(SagaStep.BUDGET_PENDING);
    expect(saga.stepStartedAt).toBe(now);
    expect(saga.type).toBe('ORDER_FULFILLMENT');
  });

  it('percorre o caminho feliz até COMPLETED', () => {
    const saga = OrderSaga.start({ id: 's-1', orderId: 1, now });
    saga.budgetCreated({ budgetId: 'b-1' }, now);
    expect(saga.currentStep).toBe(SagaStep.AWAITING_APPROVAL);
    saga.approved(now);
    expect(saga.currentStep).toBe(SagaStep.PAYMENT_PENDING);
    saga.paymentRequested({ paymentId: 'p-1', checkoutUrl: 'https://mp/checkout' });
    expect(saga.paymentUrl).toBe('https://mp/checkout');
    saga.confirmPayment({ paymentId: 'p-1' }, now);
    expect(saga.paymentConfirmed).toBe(true);
    expect(saga.currentStep).toBe(SagaStep.EXECUTION_PENDING);
    saga.markExecutionQueued(now);
    expect(saga.executionQueued).toBe(true);
    saga.executionCompleted(now);
    expect(saga.status).toBe(SagaStatus.COMPLETED);
    expect(saga.currentStep).toBe(SagaStep.DONE);
  });

  it('paymentRequested sem checkoutUrl mantém null; confirmPayment sem id mantém o anterior', () => {
    const saga = sagaAt(SagaStep.PAYMENT_PENDING);
    saga.paymentRequested({ paymentId: 'p-1' });
    expect(saga.paymentUrl).toBeNull();
    saga.confirmPayment({}, undefined);
    expect(saga.paymentId).toBe('p-1');
    expect(saga.stepStartedAt).toBeInstanceOf(Date);
  });

  it('lança SagaTransitionError fora da etapa esperada', () => {
    expect(() => sagaAt(SagaStep.BUDGET_PENDING).approved(now)).toThrow(SagaTransitionError);
    expect(() => sagaAt(SagaStep.AWAITING_APPROVAL).confirmPayment({}, now)).toThrow(/exige etapa PAYMENT_PENDING/);
    expect(() => sagaAt(SagaStep.PAYMENT_PENDING).markExecutionQueued(now)).toThrow(SagaTransitionError);
    expect(() => sagaAt(SagaStep.EXECUTION_PENDING).executionCompleted(now)).toThrow(SagaTransitionError);
  });

  it('isAt é falso quando a saga não está RUNNING', () => {
    const saga = sagaAt(SagaStep.BUDGET_PENDING, { status: SagaStatus.COMPENSATED });
    expect(saga.isAt(SagaStep.BUDGET_PENDING)).toBe(false);
  });
});

describe('OrderSaga — planejamento de compensações', () => {
  it('sem nada efetivado remotamente → COMPENSATED imediatamente', () => {
    const saga = sagaAt(SagaStep.BUDGET_PENDING);
    expect(saga.startCompensation('falha', now)).toEqual([]);
    expect(saga.status).toBe(SagaStatus.COMPENSATED);
    expect(saga.currentStep).toBe(SagaStep.COMPENSATION);
  });

  it('orçamento criado → cancela orçamento', () => {
    const saga = sagaAt(SagaStep.AWAITING_APPROVAL, { budgetId: 'b-1' });
    expect(saga.startCompensation('recusado', now)).toEqual([Compensation.CANCEL_BUDGET]);
    expect(saga.status).toBe(SagaStatus.COMPENSATING);
    expect(saga.failureReason).toBe('recusado');
  });

  it('pagamento confirmado → estorna (estorno já cancela o orçamento)', () => {
    const saga = sagaAt(SagaStep.EXECUTION_PENDING, { budgetId: 'b-1', paymentConfirmed: true });
    expect(saga.startCompensation('exec recusada', now)).toEqual([Compensation.REFUND_PAYMENT]);
  });

  it('execução em andamento → cancela execução e estorna', () => {
    const saga = sagaAt(SagaStep.IN_EXECUTION, { budgetId: 'b-1', paymentConfirmed: true, executionQueued: true });
    expect(saga.startCompensation('cancelada', now)).toEqual([Compensation.CANCEL_EXECUTION, Compensation.REFUND_PAYMENT]);
  });

  it('execução que já falhou não é cancelada de novo', () => {
    const saga = sagaAt(SagaStep.IN_EXECUTION, { budgetId: 'b-1', paymentConfirmed: true, executionQueued: true });
    saga.executionFailed();
    expect(saga.startCompensation('falha', now)).toEqual([Compensation.REFUND_PAYMENT]);
  });

  it('não compensa saga que não está em andamento', () => {
    const saga = sagaAt(SagaStep.DONE, { status: SagaStatus.COMPLETED });
    expect(() => saga.startCompensation('x', now)).toThrow(/não está em andamento/);
  });

  it('acks removem pendências até COMPENSATED; ack repetido/irrelevante é ignorado', () => {
    const saga = sagaAt(SagaStep.IN_EXECUTION, { budgetId: 'b-1', paymentConfirmed: true, executionQueued: true });
    saga.startCompensation('x', now);
    expect(saga.compensationAcknowledged(Compensation.CANCEL_BUDGET)).toBe(false);
    expect(saga.compensationAcknowledged(Compensation.CANCEL_EXECUTION)).toBe(true);
    expect(saga.status).toBe(SagaStatus.COMPENSATING);
    expect(saga.compensationAcknowledged(Compensation.REFUND_PAYMENT)).toBe(true);
    expect(saga.status).toBe(SagaStatus.COMPENSATED);
    expect(saga.compensationAcknowledged(Compensation.REFUND_PAYMENT)).toBe(false);
  });

  it('falha numa compensação leva a FAILED com motivo acumulado', () => {
    const saga = sagaAt(SagaStep.EXECUTION_PENDING, { paymentConfirmed: true });
    saga.startCompensation('exec recusada', now);
    expect(saga.compensationFailed(Compensation.REFUND_PAYMENT, 'prazo expirado')).toBe(true);
    expect(saga.status).toBe(SagaStatus.FAILED);
    expect(saga.failureReason).toBe('exec recusada | compensação REFUND_PAYMENT falhou: prazo expirado');
    expect(saga.compensationFailed(Compensation.REFUND_PAYMENT, 'de novo')).toBe(false);
  });

  it('compensationFailed sem motivo anterior não deixa separador sobrando', () => {
    const saga = new OrderSaga({ id: 's', orderId: 1, status: SagaStatus.COMPENSATING, currentStep: SagaStep.COMPENSATION, pendingCompensations: [Compensation.REFUND_PAYMENT] });
    saga.compensationFailed(Compensation.REFUND_PAYMENT, 'x');
    expect(saga.failureReason).toBe('compensação REFUND_PAYMENT falhou: x');
  });
});

describe('OrderSaga — timeouts', () => {
  const timeouts = { [SagaStep.BUDGET_PENDING]: 10, [SagaStep.AWAITING_APPROVAL]: 60 };

  it('expira quando a etapa passa do limite', () => {
    const saga = sagaAt(SagaStep.BUDGET_PENDING);
    expect(saga.isTimedOut(new Date(now.getTime() + 5 * 60_000), timeouts)).toBe(false);
    expect(saga.isTimedOut(new Date(now.getTime() + 11 * 60_000), timeouts)).toBe(true);
  });

  it('etapa sem limite configurado ou saga parada nunca expira', () => {
    expect(sagaAt(SagaStep.IN_EXECUTION).isTimedOut(new Date(now.getTime() + 1e9), timeouts)).toBe(false);
    expect(sagaAt(SagaStep.BUDGET_PENDING, { status: SagaStatus.COMPENSATED }).isTimedOut(new Date(now.getTime() + 1e9), timeouts)).toBe(false);
  });
});
