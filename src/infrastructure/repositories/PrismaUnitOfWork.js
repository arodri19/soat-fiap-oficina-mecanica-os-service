const prisma = require('../../prisma');
const PrismaOrderRepository = require('./PrismaOrderRepository');
const { PrismaSagaRepository } = require('./PrismaSagaRepository');
const {
  PrismaOutboxRepository,
  PrismaInboxRepository,
  PrismaCatalogRepository
} = require('./PrismaMessagingRepositories');

// Unit of Work sobre transações interativas do Prisma: todos os repositórios
// entregues ao callback compartilham a MESMA transação PostgreSQL.
class PrismaUnitOfWork {
  constructor(client = prisma, { timeoutMs = 15_000 } = {}) {
    this.client = client;
    this.timeoutMs = timeoutMs;
  }

  async run(work) {
    return this.client.$transaction(
      (tx) => work({
        orders: new PrismaOrderRepository(tx),
        sagas: new PrismaSagaRepository(tx),
        outbox: new PrismaOutboxRepository(tx),
        inbox: new PrismaInboxRepository(tx),
        catalog: new PrismaCatalogRepository(tx)
      }),
      { timeout: this.timeoutMs }
    );
  }
}

module.exports = PrismaUnitOfWork;
