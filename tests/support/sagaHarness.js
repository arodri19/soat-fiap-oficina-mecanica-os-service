// Monta o os-service "de verdade" (use cases + orquestrador) sobre os adaptadores
// em memória e simula os participantes da saga (billing-service e exec-prod-service)
// respondendo aos comandos que o orquestrador publica no outbox.
const crypto = require('node:crypto');
const OrderApplicationService = require('../../src/application/services/OrderApplicationService');
const { OrderSagaOrchestrator } = require('../../src/application/saga/OrderSagaOrchestrator');
const {
  InMemoryUnitOfWork,
  silentLogger,
  fakeMonitoring,
  fakeTracing,
  fakeNotifier,
  CATALOG_SEED,
  QUEUES
} = require('./inMemory');

function reply(command, type, payload = {}) {
  return {
    messageId: crypto.randomUUID(),
    type,
    sagaId: command.envelope.sagaId,
    orderId: command.envelope.orderId,
    correlationId: command.envelope.correlationId,
    source: 'participant-stub',
    payload
  };
}

function createSagaHarness({ clock } = {}) {
  const unitOfWork = new InMemoryUnitOfWork(structuredClone(CATALOG_SEED));
  const monitoring = fakeMonitoring();
  const now = { value: new Date('2026-10-17T10:00:00Z') };

  const orchestrator = new OrderSagaOrchestrator({
    unitOfWork,
    queues: QUEUES,
    monitoring,
    notifier: fakeNotifier,
    tracing: fakeTracing,
    logger: silentLogger,
    clock: clock || (() => now.value)
  });

  const billingClient = { getOrderBilling: jest.fn().mockResolvedValue({ available: true, data: { budget: { status: 'PENDING_APPROVAL' } } }) };
  const executionClient = { getExecution: jest.fn().mockResolvedValue({ available: false, reason: 'circuit-open' }) };

  const orderService = new OrderApplicationService({
    unitOfWork,
    orchestrator,
    orderQueries: unitOfWork.repositories().orders,
    sagaQueries: unitOfWork.repositories().sagas,
    billingClient,
    executionClient,
    monitoring,
    logger: silentLogger
  });

  // Comandos já publicados (o "SQS" de cada participante)
  const sent = [];

  function publishOutbox() {
    const delivered = unitOfWork.drainOutbox();
    sent.push(...delivered);
    return delivered;
  }

  function lastCommand(type) {
    publishOutbox();
    const command = [...sent].reverse().find((m) => m.type === type);
    if (!command) throw new Error(`Nenhum comando ${type} publicado. Publicados: ${sent.map((m) => m.type).join(', ')}`);
    return command;
  }

  async function respond(commandType, replyType, payload) {
    const command = lastCommand(commandType);
    const envelope = reply(command, replyType, payload);
    const result = await orchestrator.handleReply(envelope);
    publishOutbox();
    return { envelope, result };
  }

  return {
    unitOfWork,
    state: unitOfWork.state,
    orchestrator,
    orderService,
    monitoring,
    billingClient,
    executionClient,
    now,
    sent,
    publishOutbox,
    lastCommand,
    respond,
    reply
  };
}

module.exports = { createSagaHarness };
