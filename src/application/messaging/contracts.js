// Contratos de mensagens trocadas entre os microsserviços via SQS.
// Cada repositório mantém sua própria cópia deste arquivo (sem biblioteca
// compartilhada, para manter os deploys independentes) — ver docs/mensageria.md.
const crypto = require('node:crypto');

const SERVICE_NAME = 'os-service';

// Comandos enviados pelo orquestrador (os-service) → billing-service
const BillingCommands = Object.freeze({
  CREATE_BUDGET: 'CreateBudget',
  REQUEST_PAYMENT: 'RequestPayment',
  CANCEL_BUDGET: 'CancelBudget',
  REFUND_PAYMENT: 'RefundPayment'
});

// Comandos enviados pelo orquestrador (os-service) → exec-prod-service
const ExecutionCommands = Object.freeze({
  START_EXECUTION: 'StartExecution',
  CANCEL_EXECUTION: 'CancelExecution'
});

// Respostas/eventos recebidos na fila de respostas da saga (os-service)
const Replies = Object.freeze({
  BUDGET_CREATED: 'BudgetCreated',
  BUDGET_CREATION_FAILED: 'BudgetCreationFailed',
  BUDGET_CANCELLED: 'BudgetCancelled',
  PAYMENT_REQUESTED: 'PaymentRequested',
  PAYMENT_REQUEST_FAILED: 'PaymentRequestFailed',
  PAYMENT_CONFIRMED: 'PaymentConfirmed',
  PAYMENT_FAILED: 'PaymentFailed',
  PAYMENT_REFUNDED: 'PaymentRefunded',
  PAYMENT_REFUND_FAILED: 'PaymentRefundFailed',
  EXECUTION_QUEUED: 'ExecutionQueued',
  EXECUTION_REJECTED: 'ExecutionRejected',
  EXECUTION_STATUS_CHANGED: 'ExecutionStatusChanged',
  EXECUTION_COMPLETED: 'ExecutionCompleted',
  EXECUTION_FAILED: 'ExecutionFailed',
  EXECUTION_CANCELLED: 'ExecutionCancelled'
});

function createEnvelope({ type, sagaId, orderId, payload = {}, replyTo, correlationId, traceHeaders }) {
  return {
    messageId: crypto.randomUUID(),
    type,
    sagaId,
    orderId,
    correlationId: correlationId || sagaId,
    source: SERVICE_NAME,
    replyTo: replyTo || null,
    occurredAt: new Date().toISOString(),
    traceHeaders: traceHeaders || {},
    payload
  };
}

function isValidEnvelope(message) {
  return Boolean(
    message
    && typeof message.messageId === 'string'
    && typeof message.type === 'string'
    && message.payload !== null
    && typeof message.payload === 'object'
  );
}

module.exports = {
  SERVICE_NAME,
  BillingCommands,
  ExecutionCommands,
  Replies,
  createEnvelope,
  isValidEnvelope
};
