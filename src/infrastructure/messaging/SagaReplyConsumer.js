const { isValidEnvelope } = require('../../application/messaging/contracts');
const { runConsumerTransaction } = require('../monitoring/tracing');

// Liga a fila de respostas da saga (SQS) ao orquestrador.
class SagaReplyConsumer {
  constructor({ messageBus, orchestrator, queueName, logger }) {
    this.messageBus = messageBus;
    this.orchestrator = orchestrator;
    this.queueName = queueName;
    this.logger = logger;
  }

  async handle(envelope) {
    if (!isValidEnvelope(envelope)) {
      this.logger.error({ envelope }, 'Envelope inválido na fila de respostas — descartado');
      return { outcome: 'INVALID' };
    }

    return runConsumerTransaction(`saga-reply/${envelope.type}`, envelope.traceHeaders, async () => {
      const result = await this.orchestrator.handleReply(envelope);
      this.logger.info(
        { type: envelope.type, sagaId: envelope.sagaId, orderId: envelope.orderId, correlationId: envelope.correlationId, ...result },
        'Resposta da saga processada'
      );
      return result;
    });
  }

  start() {
    return this.messageBus.subscribe(this.queueName, (envelope) => this.handle(envelope));
  }
}

module.exports = SagaReplyConsumer;
