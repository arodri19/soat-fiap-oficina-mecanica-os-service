// Precisa ser o primeiro require do processo — o agente instrumenta os módulos
// (express, pg, http, aws-sdk) conforme eles são carregados depois dele.
require('newrelic');

const app = require('./app');
const config = require('./config');
const container = require('./infrastructure/container/Container');
const prisma = require('./prisma');
const { logger } = require('./middlewares/requestLogger');

const server = app.listen(config.PORT, () => {
  logger.info(`os-service iniciado na porta ${config.PORT}`);
});

let timeoutTimer = null;

// API, relay do outbox, consumidor de respostas e verificação de timeouts rodam no
// mesmo processo (um Deployment só) — o volume da oficina não justifica um worker
// separado, e o HPA escala tudo junto. Várias réplicas são seguras: o relay usa
// SKIP LOCKED, o consumidor é idempotente (inbox) e a saga tem lock otimista.
if (config.MESSAGING_ENABLED) {
  container.getOutboxRelay().start();
  container.getSagaReplyConsumer().start();

  timeoutTimer = setInterval(() => {
    container.getOrchestrator().expireTimedOutSagas()
      .then((expired) => expired && logger.warn({ expired }, 'Sagas expiradas por timeout foram compensadas'))
      .catch((error) => logger.error({ err: error }, 'Erro ao verificar timeouts de saga'));
  }, config.SAGA_TIMEOUT_CHECK_INTERVAL_MS);

  logger.info({ queues: config.QUEUES }, 'Mensageria da saga iniciada');
}

async function shutdown(signal) {
  logger.info({ signal }, 'Encerrando os-service');
  if (timeoutTimer) clearInterval(timeoutTimer);
  if (config.MESSAGING_ENABLED) {
    container.getOutboxRelay().stop();
    await container.getMessageBus().stop();
  }
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
