jest.mock('newrelic', () => {
  const transaction = {
    insertDistributedTraceHeaders: jest.fn((headers) => { headers.traceparent = '00-abc'; }),
    acceptDistributedTraceHeaders: jest.fn(),
    end: jest.fn()
  };
  return {
    transaction,
    getTransaction: jest.fn(() => transaction),
    startBackgroundTransaction: jest.fn((name, group, fn) => fn()),
    noticeError: jest.fn(),
    recordCustomEvent: jest.fn(),
    getLinkingMetadata: jest.fn(() => ({}))
  };
});

const newrelic = require('newrelic');
const SqsMessageBus = require('../../../src/infrastructure/messaging/SqsMessageBus');
const OutboxRelay = require('../../../src/infrastructure/messaging/OutboxRelay');
const SagaReplyConsumer = require('../../../src/infrastructure/messaging/SagaReplyConsumer');
const tracing = require('../../../src/infrastructure/monitoring/tracing');
const { createEnvelope, isValidEnvelope } = require('../../../src/application/messaging/contracts');

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe('contracts', () => {
  it('createEnvelope gera envelope com metadados de correlação', () => {
    const env = createEnvelope({ type: 'CreateBudget', sagaId: 's', orderId: 1, payload: { a: 1 } });
    expect(env).toMatchObject({ type: 'CreateBudget', sagaId: 's', orderId: 1, correlationId: 's', source: 'os-service', replyTo: null, traceHeaders: {} });
    expect(isValidEnvelope(env)).toBe(true);
    expect(isValidEnvelope({ type: 'x' })).toBe(false);
    expect(isValidEnvelope(null)).toBe(false);
    expect(createEnvelope({ type: 't' }).payload).toEqual({});
  });
});

describe('SqsMessageBus', () => {
  function sqsClient(responses) {
    return {
      send: jest.fn(async (command) => {
        const name = command.constructor.name;
        const next = responses[name];
        return typeof next === 'function' ? next(command) : next;
      })
    };
  }

  it('publish resolve (e cacheia) a URL da fila e envia o envelope', async () => {
    const client = sqsClient({ GetQueueUrlCommand: { QueueUrl: 'https://sqs/q' }, SendMessageCommand: {} });
    const bus = new SqsMessageBus({ client, logger });
    await bus.publish('q', { type: 'CreateBudget', source: 'os-service', messageId: '1' });
    await bus.publish('q', { type: 'CancelBudget', messageId: '2' });

    const sends = client.send.mock.calls.map(([c]) => c);
    expect(sends.filter((c) => c.constructor.name === 'GetQueueUrlCommand')).toHaveLength(1);
    const msg = sends.find((c) => c.constructor.name === 'SendMessageCommand').input;
    expect(msg.QueueUrl).toBe('https://sqs/q');
    expect(JSON.parse(msg.MessageBody).type).toBe('CreateBudget');
    expect(msg.MessageAttributes.type.StringValue).toBe('CreateBudget');
    expect(sends[sends.length - 1].input.MessageAttributes.source.StringValue).toBe('unknown');
  });

  it('subscribe: apaga mensagem processada; mantém a que falhou ou é inválida', async () => {
    let round = 0;
    const bus = new SqsMessageBus({ logger, client: null, region: 'us-east-1' });
    bus.client = sqsClient({
      GetQueueUrlCommand: { QueueUrl: 'https://sqs/replies' },
      ReceiveMessageCommand: () => {
        round += 1;
        if (round > 1) { bus.running = false; return { Messages: [] }; }
        return {
          Messages: [
            { Body: JSON.stringify({ type: 'ok', messageId: 'a' }), ReceiptHandle: 'r1', Attributes: { ApproximateReceiveCount: '2' } },
            { Body: JSON.stringify({ type: 'fail', messageId: 'b' }), ReceiptHandle: 'r2' },
            { Body: 'not-json', ReceiptHandle: 'r3', MessageId: 'm3' }
          ]
        };
      },
      DeleteMessageCommand: {}
    });

    const handler = jest.fn(async (envelope) => {
      if (envelope.type === 'fail') throw new Error('handler failed');
    });
    await bus.subscribe('replies', handler);
    await bus.stop();

    expect(handler).toHaveBeenCalledWith({ type: 'ok', messageId: 'a' }, { receiveCount: 2 });
    const deletes = bus.client.send.mock.calls.map(([c]) => c).filter((c) => c.constructor.name === 'DeleteMessageCommand');
    expect(deletes.map((c) => c.input.ReceiptHandle)).toEqual(['r1']);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ queueName: 'replies' }), 'Mensagem SQS com JSON inválido');
  });

  it('erro ao receber da fila espera e tenta de novo', async () => {
    jest.useFakeTimers();
    const bus = new SqsMessageBus({ logger, client: { send: jest.fn().mockRejectedValue(new Error('network')) } });
    const loop = bus.subscribe('q', jest.fn());
    await Promise.resolve();
    bus.running = false;
    await jest.advanceTimersByTimeAsync(5000);
    await loop;
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ queueName: 'q' }), expect.stringContaining('nova tentativa'));
    jest.useRealTimers();
  });
});

describe('OutboxRelay', () => {
  function prismaWith(batch) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue(batch),
      outboxMessage: { update: jest.fn().mockResolvedValue({}) }
    };
    return { tx, client: { $transaction: jest.fn((fn) => fn(tx)) } };
  }

  it('publica pendentes e marca SENT; falha incrementa tentativas', async () => {
    const { tx, client } = prismaWith([
      { id: 'm1', destination: 'q1', type: 'CreateBudget', envelope: { type: 'CreateBudget' } },
      { id: 'm2', destination: 'q2', type: 'StartExecution', envelope: { type: 'StartExecution' } }
    ]);
    const messageBus = { publish: jest.fn().mockResolvedValueOnce().mockRejectedValueOnce(new Error('sqs down')) };
    const relay = new OutboxRelay({ messageBus, logger, client });

    await expect(relay.publishPending()).resolves.toBe(1);
    expect(messageBus.publish).toHaveBeenCalledWith('q1', { type: 'CreateBudget' });
    expect(tx.outboxMessage.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'm1' }, data: expect.objectContaining({ status: 'SENT' }) }));
    expect(tx.outboxMessage.update).toHaveBeenCalledWith({
      where: { id: 'm2' }, data: { attempts: { increment: 1 }, lastError: 'sqs down' }
    });
  });

  it('start/stop agenda ciclos e sobrevive a erros', async () => {
    jest.useFakeTimers();
    const client = { $transaction: jest.fn().mockRejectedValue(new Error('db down')) };
    const relay = new OutboxRelay({ messageBus: {}, logger, client, intervalMs: 100 });
    relay.start();
    await jest.advanceTimersByTimeAsync(250);
    relay.stop();
    expect(client.$transaction.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(logger.error).toHaveBeenCalledWith(expect.anything(), 'Erro no OutboxRelay');
    jest.useRealTimers();
  });
});

describe('SagaReplyConsumer + tracing', () => {
  it('aceita headers de trace e delega ao orquestrador', async () => {
    const orchestrator = { handleReply: jest.fn().mockResolvedValue({ outcome: 'HANDLED' }) };
    const consumer = new SagaReplyConsumer({ messageBus: {}, orchestrator, queueName: 'q', logger });
    const envelope = { messageId: 'm', type: 'BudgetCreated', payload: {}, traceHeaders: { traceparent: '00-x' } };

    await expect(consumer.handle(envelope)).resolves.toEqual({ outcome: 'HANDLED' });
    expect(newrelic.startBackgroundTransaction).toHaveBeenCalledWith('saga-reply/BudgetCreated', 'SQS', expect.any(Function));
    expect(newrelic.transaction.acceptDistributedTraceHeaders).toHaveBeenCalledWith('Queue', { traceparent: '00-x' });
    expect(newrelic.transaction.end).toHaveBeenCalled();
  });

  it('envelope inválido é descartado', async () => {
    const consumer = new SagaReplyConsumer({ messageBus: {}, orchestrator: {}, queueName: 'q', logger });
    await expect(consumer.handle({ nope: true })).resolves.toEqual({ outcome: 'INVALID' });
  });

  it('erro do handler é reportado ao New Relic e propagado (mensagem volta pra fila)', async () => {
    const orchestrator = { handleReply: jest.fn().mockRejectedValue(new Error('conflict')) };
    const consumer = new SagaReplyConsumer({ messageBus: {}, orchestrator, queueName: 'q', logger });
    await expect(consumer.handle({ messageId: 'm', type: 'X', payload: {} })).rejects.toThrow('conflict');
    expect(newrelic.noticeError).toHaveBeenCalled();
  });

  it('start inscreve o consumidor na fila de respostas', () => {
    const messageBus = { subscribe: jest.fn() };
    const consumer = new SagaReplyConsumer({ messageBus, orchestrator: {}, queueName: 'replies', logger });
    consumer.start();
    expect(messageBus.subscribe).toHaveBeenCalledWith('replies', expect.any(Function));
  });

  it('currentTraceHeaders injeta headers da transação atual e tolera agente ausente', () => {
    expect(tracing.currentTraceHeaders()).toEqual({ traceparent: '00-abc' });
    newrelic.getTransaction.mockImplementationOnce(() => { throw new Error('no agent'); });
    expect(tracing.currentTraceHeaders()).toEqual({});
  });

  it('runConsumerTransaction tolera headers inválidos', async () => {
    newrelic.transaction.acceptDistributedTraceHeaders.mockImplementationOnce(() => { throw new Error('bad'); });
    await expect(tracing.runConsumerTransaction('x', { a: 1 }, async () => 42)).resolves.toBe(42);
    await expect(tracing.runConsumerTransaction('x', {}, async () => 1)).resolves.toBe(1);
  });
});
