const prisma = require('../../prisma');
const { PrismaOutboxRepository } = require('../repositories/PrismaMessagingRepositories');

/**
 * Publica no SQS as mensagens gravadas no outbox pela transação de negócio.
 * Roda em loop dentro do próprio processo do os-service (poll a cada intervalMs).
 * Se a publicação falhar, a mensagem permanece PENDING e é tentada de novo no
 * próximo ciclo — o comando nunca se perde, mesmo com o SQS indisponível.
 */
class OutboxRelay {
  constructor({ messageBus, logger, client = prisma, intervalMs = 1000, batchSize = 20 }) {
    this.messageBus = messageBus;
    this.logger = logger;
    this.client = client;
    this.intervalMs = intervalMs;
    this.batchSize = batchSize;
    this.timer = null;
    this.running = false;
  }

  async publishPending() {
    return this.client.$transaction(async (tx) => {
      const outbox = new PrismaOutboxRepository(tx);
      const batch = await outbox.lockPendingBatch(this.batchSize);
      let published = 0;

      for (const message of batch) {
        try {
          await this.messageBus.publish(message.destination, message.envelope);
          await outbox.markSent(message.id);
          published += 1;
        } catch (error) {
          await outbox.markFailedAttempt(message.id, error);
          this.logger.warn({ err: error, messageId: message.id, type: message.type }, 'Falha ao publicar mensagem do outbox');
        }
      }
      return published;
    }, { timeout: 30_000 });
  }

  start() {
    this.running = true;
    const tick = async () => {
      if (!this.running) return;
      try {
        await this.publishPending();
      } catch (error) {
        this.logger.error({ err: error }, 'Erro no OutboxRelay');
      }
      if (this.running) this.timer = setTimeout(tick, this.intervalMs);
    };
    tick();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }
}

module.exports = OutboxRelay;
