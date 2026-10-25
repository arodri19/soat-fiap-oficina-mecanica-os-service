// Exercita o orquestrador sobre o PostgreSQL REAL (Prisma): transação única
// OS + saga + outbox, inbox idempotente, lock otimista e relay do outbox.
// Roda quando RUN_DB_TESTS=true (CI: serviço postgres do GitHub Actions, após
// `prisma migrate deploy`). Localmente: docker compose up db + mesma variável.
const crypto = require('node:crypto');

const describeDb = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDb('Saga sobre PostgreSQL (Prisma)', () => {
  const prisma = require('../../src/prisma');
  const PrismaUnitOfWork = require('../../src/infrastructure/repositories/PrismaUnitOfWork');
  const PrismaOrderRepository = require('../../src/infrastructure/repositories/PrismaOrderRepository');
  const { PrismaSagaRepository, ConcurrencyError } = require('../../src/infrastructure/repositories/PrismaSagaRepository');
  const { PrismaOutboxRepository } = require('../../src/infrastructure/repositories/PrismaMessagingRepositories');
  const OutboxRelay = require('../../src/infrastructure/messaging/OutboxRelay');
  const OrderApplicationService = require('../../src/application/services/OrderApplicationService');
  const { OrderSagaOrchestrator } = require('../../src/application/saga/OrderSagaOrchestrator');

  const logger = { info() {}, warn() {}, error() {} };
  const queues = { osReplies: 'it-replies', billingCommands: 'it-billing', executionCommands: 'it-exec' };
  const unitOfWork = new PrismaUnitOfWork(prisma);
  const orchestrator = new OrderSagaOrchestrator({
    unitOfWork,
    queues,
    monitoring: { recordSagaEvent() {}, recordOrderStatusChanged() {}, recordOrderCreated() {} },
    notifier: { sendOrderStatusEmail() {} },
    tracing: { currentTraceHeaders: () => ({}) },
    logger
  });
  const orderService = new OrderApplicationService({
    unitOfWork,
    orchestrator,
    orderQueries: new PrismaOrderRepository(prisma),
    sagaQueries: new PrismaSagaRepository(prisma),
    billingClient: { getOrderBilling: async () => ({ available: false }) },
    executionClient: { getExecution: async () => ({ available: false }) },
    monitoring: { recordOrderCreated() {}, recordOrderStatusChanged() {} },
    logger
  });

  let fixture;

  beforeAll(async () => {
    const suffix = crypto.randomInt(1e6).toString().padStart(6, '0');
    const client = await prisma.clientPF.create({
      data: { name: 'Cliente IT', cpf: `999${suffix}00`, email: 'it@example.com', address: 'Rua', number: '1', state: 'SP', cep: '00000-000' }
    });
    const vehicle = await prisma.vehicle.create({ data: { plate: `IT${suffix}`, model: 'Teste', year: 2024, color: 'Azul', clientPFId: client.id } });
    const service = await prisma.service.create({ data: { name: 'Serviço IT', slaMinutes: 30, price: 100 } });
    const part = await prisma.part.create({ data: { name: 'Peça IT', type: 't', model: 'm', color: 'c', quantity: 5, price: 20 } });
    fixture = { client, vehicle, service, part };
  });

  afterAll(async () => {
    await prisma.orderService.deleteMany({ where: { vehicleId: fixture.vehicle.id } });
    await prisma.outboxMessage.deleteMany({ where: { destination: { in: Object.values(queues) } } });
    await prisma.vehicle.delete({ where: { id: fixture.vehicle.id } });
    await prisma.clientPF.delete({ where: { id: fixture.client.id } });
    await prisma.part.delete({ where: { id: fixture.part.id } });
    await prisma.service.delete({ where: { id: fixture.service.id } });
    await prisma.$disconnect();
  });

  const open = () => orderService.createOrder({
    description: 'OS de integração',
    clientPFId: fixture.client.id,
    vehicleId: fixture.vehicle.id,
    services: [{ serviceId: fixture.service.id, parts: [{ partId: fixture.part.id, quantity: 2 }] }]
  });

  it('abre OS + saga + outbox numa transação e conduz a saga até compensar', async () => {
    const order = await open();
    expect(order.estimatedValue).toBe(140);
    expect((await prisma.part.findUnique({ where: { id: fixture.part.id } })).quantity).toBe(3);

    const pending = await prisma.outboxMessage.findMany({ where: { status: 'PENDING', type: 'CreateBudget', destination: 'it-billing' } });
    const command = pending.find((m) => m.envelope.orderId === order.id);
    expect(command).toBeDefined();

    const reply = (type, payload) => ({
      messageId: crypto.randomUUID(), type, sagaId: command.envelope.sagaId, orderId: order.id, payload
    });

    const budgetReply = reply('BudgetCreated', { budgetId: 'b-it', total: 140 });
    await expect(orchestrator.handleReply(budgetReply)).resolves.toMatchObject({ outcome: 'HANDLED', step: 'AWAITING_APPROVAL' });
    await expect(orchestrator.handleReply(budgetReply)).resolves.toEqual({ outcome: 'DUPLICATE' });

    await orderService.rejectOrder(order.externalId, fixture.client.id, 'caro');
    const cancelled = await prisma.orderService.findUnique({ where: { id: order.id } });
    expect(cancelled.status).toBe('CANCELADA');
    expect((await prisma.part.findUnique({ where: { id: fixture.part.id } })).quantity).toBe(5);

    await orchestrator.handleReply(reply('BudgetCancelled', { budgetId: 'b-it' }));
    const saga = await prisma.sagaInstance.findUnique({ where: { orderId: order.id } });
    expect(saga.status).toBe('COMPENSATED');

    const history = await orderService.getOrderHistory(order.id);
    expect(history.history.map((h) => h.toStatus)).toEqual(['RECEBIDA', 'AGUARDANDO_APROVACAO', 'CANCELADA']);
    expect(history.saga.events.map((e) => e.kind)).toEqual(expect.arrayContaining(['COMMAND_SENT', 'REPLY_RECEIVED', 'COMPENSATION_STARTED']));
  });

  it('serviço inexistente desfaz a transação inteira (sem OS, saga nem outbox)', async () => {
    const before = await prisma.orderService.count();
    await expect(orderService.createOrder({
      description: 'x', clientPFId: fixture.client.id, vehicleId: fixture.vehicle.id, services: [{ serviceId: 999999 }]
    })).rejects.toThrow('Serviço 999999 não encontrado');
    expect(await prisma.orderService.count()).toBe(before);
  });

  it('lock otimista impede sobrescrever a saga com versão antiga', async () => {
    const order = await open();
    const repo = new PrismaSagaRepository(prisma);
    const a = await repo.findByOrderId(order.id);
    const b = await repo.findByOrderId(order.id);
    a.failureReason = 'primeiro';
    await repo.save(a);
    b.failureReason = 'segundo';
    await expect(repo.save(b)).rejects.toBeInstanceOf(ConcurrencyError);
  });

  it('OutboxRelay publica pendentes e marca SENT', async () => {
    await open();
    const published = [];
    const relay = new OutboxRelay({ messageBus: { publish: async (q, e) => published.push([q, e.type]) }, logger, client: prisma });
    await relay.publishPending();
    expect(published).toEqual(expect.arrayContaining([['it-billing', 'CreateBudget']]));
    expect(await new PrismaOutboxRepository(prisma).countPending()).toBe(0);
  });

  it('lista OS ativas ordenadas por prioridade', async () => {
    const result = await new PrismaOrderRepository(prisma).list({ status: 'RECEBIDA', limit: 5 });
    expect(result.data.every((o) => o.status === 'RECEBIDA')).toBe(true);
  });
});
