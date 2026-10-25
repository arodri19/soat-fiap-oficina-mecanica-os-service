const prisma = require('../../prisma');

// Transactional Outbox — gravado dentro da transação de negócio.
class PrismaOutboxRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  async add({ id, destination, type, envelope }) {
    return this.client.outboxMessage.create({ data: { id, destination, type, envelope } });
  }

  // Usado pelo OutboxRelay. FOR UPDATE SKIP LOCKED: várias réplicas do serviço
  // podem rodar o relay ao mesmo tempo sem publicar a mesma mensagem duas vezes.
  async lockPendingBatch(limit) {
    return this.client.$queryRaw`
      SELECT id, destination, type, envelope, attempts
      FROM "OutboxMessage"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
  }

  async markSent(id) {
    return this.client.outboxMessage.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), lastError: null } });
  }

  async markFailedAttempt(id, error) {
    return this.client.outboxMessage.update({
      where: { id },
      data: { attempts: { increment: 1 }, lastError: String(error?.message || error).slice(0, 500) }
    });
  }

  async countPending() {
    return this.client.outboxMessage.count({ where: { status: 'PENDING' } });
  }
}

// Inbox — consumidor idempotente. INSERT ... ON CONFLICT DO NOTHING em vez de
// capturar violação de unique: dentro de uma transação interativa do PostgreSQL,
// um erro de constraint abortaria a transação inteira.
class PrismaInboxRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  async markProcessed(messageId, type) {
    const inserted = await this.client.$executeRaw`
      INSERT INTO "ProcessedMessage" ("messageId", "type", "processedAt")
      VALUES (${messageId}, ${type}, NOW())
      ON CONFLICT ("messageId") DO NOTHING
    `;
    return inserted === 1;
  }
}

class PrismaCatalogRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  async findServicesByIds(ids) {
    return this.client.service.findMany({ where: { id: { in: ids } } });
  }

  async findPartsByIds(ids) {
    return this.client.part.findMany({ where: { id: { in: ids } } });
  }

  async decrementStock(partId, quantity) {
    return this.client.part.update({ where: { id: partId }, data: { quantity: { decrement: quantity } } });
  }

  async incrementStock(partId, quantity) {
    return this.client.part.update({ where: { id: partId }, data: { quantity: { increment: quantity } } });
  }
}

module.exports = {
  PrismaOutboxRepository,
  PrismaInboxRepository,
  PrismaCatalogRepository
};
