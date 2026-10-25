const dotenv = require('dotenv');

dotenv.config();

const intEnv = (name, fallback) => {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isNaN(value) ? fallback : value;
};

const QUEUE_PREFIX = process.env.QUEUE_PREFIX || 'oficina-mecanica-dev';

module.exports = {
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'change-me',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/oficina?schema=public',
  // User API Key (não a License Key do agente APM) — só usada para CONSULTAR a
  // New Relic via NerdGraph (ver src/infrastructure/monitoring/newrelicQuery.js),
  // não para ingerir dados.
  NEW_RELIC_ACCOUNT_ID: process.env.NEW_RELIC_ACCOUNT_ID || '',
  NEW_RELIC_API_KEY: process.env.NEW_RELIC_API_KEY || '',

  // ── Mensageria (Fase 4) ──────────────────────────────────────────────────────
  // MESSAGING_ENABLED=false sobe só a API (útil para depurar sem AWS/LocalStack).
  MESSAGING_ENABLED: process.env.MESSAGING_ENABLED !== 'false',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  // Endpoint alternativo do SQS (LocalStack no docker-compose); vazio = AWS real.
  SQS_ENDPOINT: process.env.SQS_ENDPOINT || '',
  QUEUES: {
    osReplies: process.env.OS_REPLIES_QUEUE || `${QUEUE_PREFIX}-os-saga-replies`,
    billingCommands: process.env.BILLING_COMMANDS_QUEUE || `${QUEUE_PREFIX}-billing-commands`,
    executionCommands: process.env.EXECUTION_COMMANDS_QUEUE || `${QUEUE_PREFIX}-execution-commands`
  },
  OUTBOX_POLL_INTERVAL_MS: intEnv('OUTBOX_POLL_INTERVAL_MS', 1000),
  SAGA_TIMEOUT_CHECK_INTERVAL_MS: intEnv('SAGA_TIMEOUT_CHECK_INTERVAL_MS', 60_000),
  SAGA_TIMEOUTS_IN_MINUTES: {
    BUDGET_PENDING: intEnv('SAGA_TIMEOUT_BUDGET_MINUTES', 10),
    AWAITING_APPROVAL: intEnv('SAGA_TIMEOUT_APPROVAL_MINUTES', 72 * 60),
    PAYMENT_PENDING: intEnv('SAGA_TIMEOUT_PAYMENT_MINUTES', 48 * 60),
    EXECUTION_PENDING: intEnv('SAGA_TIMEOUT_EXECUTION_MINUTES', 10)
  },

  // ── REST síncrono entre serviços (DNS interno do Kubernetes) ─────────────────
  BILLING_SERVICE_URL: process.env.BILLING_SERVICE_URL || '',
  EXECUTION_SERVICE_URL: process.env.EXECUTION_SERVICE_URL || '',
  INTERNAL_HTTP_TIMEOUT_MS: intEnv('INTERNAL_HTTP_TIMEOUT_MS', 2000)
};
