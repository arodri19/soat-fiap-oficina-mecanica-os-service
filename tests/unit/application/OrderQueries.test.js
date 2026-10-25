const { createSagaHarness } = require('../../support/sagaHarness');

async function openOrder(h) {
  return h.orderService.createOrder({
    description: 'Revisão', clientPFId: 1, vehicleId: 1,
    services: [{ serviceId: 1, parts: [{ partId: 1, quantity: 1 }] }]
  });
}

describe('Consultas de OS', () => {
  it('lista OS ativas com paginação e filtro', async () => {
    const h = createSagaHarness();
    await openOrder(h);
    await openOrder(h);
    const all = await h.orderService.listOrders({ page: 1, limit: 1 });
    expect(all).toMatchObject({ total: 2, pages: 2 });
    expect(all.data).toHaveLength(1);
    expect((await h.orderService.listOrders({ status: 'CANCELADA' })).total).toBe(0);
    expect((await h.orderService.listOrders()).total).toBe(2);
  });

  it('getOrder inclui o resumo da saga; null se não existir', async () => {
    const h = createSagaHarness();
    const order = await openOrder(h);
    const found = await h.orderService.getOrder(order.id);
    expect(found.saga).toMatchObject({ status: 'RUNNING', step: 'BUDGET_PENDING', pendingCompensations: [] });
    await expect(h.orderService.getOrder(999)).resolves.toBeNull();
  });

  it('getOrder de OS legada (sem saga) traz saga null', async () => {
    const h = createSagaHarness();
    const order = await openOrder(h);
    h.state.sagas.clear();
    expect((await h.orderService.getOrder(order.id)).saga).toBeNull();
    expect((await h.orderService.getOrderHistory(order.id)).saga).toBeNull();
  });

  it('histórico traz transições e trilha da saga', async () => {
    const h = createSagaHarness();
    const order = await openOrder(h);
    const history = await h.orderService.getOrderHistory(order.id);
    expect(history.history.map((e) => e.toStatus)).toEqual(['RECEBIDA']);
    expect(history.saga.events.map((e) => e.type)).toEqual(['CreateBudget']);
    await expect(h.orderService.getOrderHistory(999)).resolves.toBeNull();
  });

  it('progresso consolida billing (REST) e degrada execução indisponível', async () => {
    const h = createSagaHarness();
    const order = await openOrder(h);
    const progress = await h.orderService.getOrderProgress(order.id);
    expect(progress).toMatchObject({
      status: 'RECEBIDA',
      saga: { step: 'BUDGET_PENDING' },
      billing: { available: true },
      execution: { available: false, reason: 'circuit-open' }
    });
    expect(h.billingClient.getOrderBilling).toHaveBeenCalledWith(order.id);
    await expect(h.orderService.getOrderProgress(999)).resolves.toBeNull();
  });

  it('progresso por externalId só para o dono', async () => {
    const h = createSagaHarness();
    const order = await openOrder(h);
    await expect(h.orderService.getOrderProgressByExternalId(order.externalId, 2)).resolves.toBeNull();
    await expect(h.orderService.getOrderProgressByExternalId('nope', 1)).resolves.toBeNull();
    const own = await h.orderService.getOrderProgressByExternalId(order.externalId, 1);
    expect(own.externalId).toBe(order.externalId);
  });

  it('progresso de OS sem saga', async () => {
    const h = createSagaHarness();
    const order = await openOrder(h);
    h.state.sagas.clear();
    expect((await h.orderService.getOrderProgress(order.id)).saga).toBeNull();
  });
});
