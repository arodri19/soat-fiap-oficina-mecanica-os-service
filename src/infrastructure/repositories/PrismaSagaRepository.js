const prisma = require('../../prisma');
const { OrderSaga } = require('../../domain/saga/OrderSaga');

class ConcurrencyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

function toDomain(row) {
  return row ? new OrderSaga(row) : null;
}

class PrismaSagaRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  async create(saga) {
    const row = await this.client.sagaInstance.create({
      data: {
        id: saga.id,
        orderId: saga.orderId,
        type: saga.type,
        status: saga.status,
        currentStep: saga.currentStep,
        stepStartedAt: saga.stepStartedAt
      }
    });
    saga.version = row.version;
    return saga;
  }

  async findById(id) {
    return toDomain(await this.client.sagaInstance.findUnique({ where: { id } }));
  }

  async findByOrderId(orderId) {
    return toDomain(await this.client.sagaInstance.findUnique({ where: { orderId } }));
  }

  // Controle de concorrência otimista: só grava se ninguém alterou a saga desde a
  // leitura. Em conflito, a transação inteira é desfeita e a mensagem SQS volta
  // para a fila (reprocessada com o estado atualizado).
  async save(saga) {
    const { count } = await this.client.sagaInstance.updateMany({
      where: { id: saga.id, version: saga.version },
      data: {
        status: saga.status,
        currentStep: saga.currentStep,
        budgetId: saga.budgetId,
        paymentId: saga.paymentId,
        paymentUrl: saga.paymentUrl,
        paymentConfirmed: saga.paymentConfirmed,
        executionQueued: saga.executionQueued,
        executionTerminal: saga.executionTerminal,
        pendingCompensations: saga.pendingCompensations,
        failureReason: saga.failureReason,
        stepStartedAt: saga.stepStartedAt,
        version: { increment: 1 }
      }
    });
    if (count === 0) {
      throw new ConcurrencyError(`Saga ${saga.id} foi alterada concorrentemente (versão ${saga.version}).`);
    }
    saga.version += 1;
    return saga;
  }

  async addEvent({ sagaId, kind, type, payload }) {
    return this.client.sagaEvent.create({ data: { sagaId, kind, type, payload: payload ?? undefined } });
  }

  async listEvents(sagaId) {
    return this.client.sagaEvent.findMany({ where: { sagaId }, orderBy: { id: 'asc' } });
  }

  async findRunningWithStepStartedBefore(date) {
    const rows = await this.client.sagaInstance.findMany({
      where: { status: 'RUNNING', stepStartedAt: { lt: date } },
      orderBy: { stepStartedAt: 'asc' },
      take: 100
    });
    return rows.map(toDomain);
  }
}

module.exports = { PrismaSagaRepository, ConcurrencyError };
