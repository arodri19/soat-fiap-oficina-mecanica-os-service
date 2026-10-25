const prisma = require('../../prisma');
const config = require('../../config');
const PrismaUserRepository = require('../repositories/PrismaUserRepository');
const PrismaClientRepository = require('../repositories/PrismaClientRepository');
const PrismaOrderRepository = require('../repositories/PrismaOrderRepository');
const { PrismaSagaRepository } = require('../repositories/PrismaSagaRepository');
const PrismaUnitOfWork = require('../repositories/PrismaUnitOfWork');
const SqsMessageBus = require('../messaging/SqsMessageBus');
const OutboxRelay = require('../messaging/OutboxRelay');
const SagaReplyConsumer = require('../messaging/SagaReplyConsumer');
const { BillingClient, ExecutionClient } = require('../http/ServiceClients');
const monitoring = require('../monitoring/newrelicEvents');
const tracing = require('../monitoring/tracing');
const notifier = require('../notifications/emailNotificationService');
const { logger } = require('../../middlewares/requestLogger');
const AuthApplicationService = require('../../application/services/AuthApplicationService');
const ClientApplicationService = require('../../application/services/ClientApplicationService');
const OrderApplicationService = require('../../application/services/OrderApplicationService');
const { OrderSagaOrchestrator } = require('../../application/saga/OrderSagaOrchestrator');

// Service Locator (DI) — instâncias singleton criadas sob demanda.
class Container {
  constructor() {
    this.instances = new Map();
  }

  #single(key, factory) {
    if (!this.instances.has(key)) this.instances.set(key, factory());
    return this.instances.get(key);
  }

  getUserRepository() {
    return this.#single('userRepository', () => new PrismaUserRepository());
  }

  getAuthApplicationService() {
    return this.#single('authApplicationService', () => new AuthApplicationService(this.getUserRepository()));
  }

  getClientRepository() {
    return this.#single('clientRepository', () => new PrismaClientRepository());
  }

  getClientApplicationService() {
    return this.#single('clientApplicationService', () => new ClientApplicationService(this.getClientRepository()));
  }

  getUnitOfWork() {
    return this.#single('unitOfWork', () => new PrismaUnitOfWork(prisma));
  }

  getMessageBus() {
    return this.#single('messageBus', () => new SqsMessageBus({
      region: config.AWS_REGION,
      endpoint: config.SQS_ENDPOINT || undefined,
      logger
    }));
  }

  getOrchestrator() {
    return this.#single('orchestrator', () => new OrderSagaOrchestrator({
      unitOfWork: this.getUnitOfWork(),
      queues: config.QUEUES,
      monitoring,
      notifier,
      tracing,
      logger,
      timeoutsInMinutes: config.SAGA_TIMEOUTS_IN_MINUTES
    }));
  }

  getOrderApplicationService() {
    return this.#single('orderApplicationService', () => new OrderApplicationService({
      unitOfWork: this.getUnitOfWork(),
      orchestrator: this.getOrchestrator(),
      orderQueries: new PrismaOrderRepository(prisma),
      sagaQueries: new PrismaSagaRepository(prisma),
      billingClient: new BillingClient({
        baseUrl: config.BILLING_SERVICE_URL,
        jwtSecret: config.JWT_SECRET,
        timeoutMs: config.INTERNAL_HTTP_TIMEOUT_MS,
        logger
      }),
      executionClient: new ExecutionClient({
        baseUrl: config.EXECUTION_SERVICE_URL,
        jwtSecret: config.JWT_SECRET,
        timeoutMs: config.INTERNAL_HTTP_TIMEOUT_MS,
        logger
      }),
      monitoring,
      logger
    }));
  }

  getOutboxRelay() {
    return this.#single('outboxRelay', () => new OutboxRelay({
      messageBus: this.getMessageBus(),
      logger,
      intervalMs: config.OUTBOX_POLL_INTERVAL_MS
    }));
  }

  getSagaReplyConsumer() {
    return this.#single('sagaReplyConsumer', () => new SagaReplyConsumer({
      messageBus: this.getMessageBus(),
      orchestrator: this.getOrchestrator(),
      queueName: config.QUEUES.osReplies,
      logger
    }));
  }
}

const container = new Container();

module.exports = container;
