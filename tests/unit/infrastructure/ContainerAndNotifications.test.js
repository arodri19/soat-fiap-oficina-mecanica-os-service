const container = require('../../../src/infrastructure/container/Container');
const { sendOrderStatusEmail } = require('../../../src/infrastructure/notifications/emailNotificationService');
const OrderApplicationService = require('../../../src/application/services/OrderApplicationService');
const { OrderSagaOrchestrator } = require('../../../src/application/saga/OrderSagaOrchestrator');

describe('Container (DI)', () => {
  it('monta o grafo de dependências como singletons', () => {
    const orderService = container.getOrderApplicationService();
    expect(orderService).toBeInstanceOf(OrderApplicationService);
    expect(container.getOrderApplicationService()).toBe(orderService);
    expect(container.getOrchestrator()).toBeInstanceOf(OrderSagaOrchestrator);
    expect(container.getOutboxRelay()).toBeDefined();
    expect(container.getSagaReplyConsumer().queueName).toMatch(/os-saga-replies$/);
    expect(container.getMessageBus()).toBe(container.getMessageBus());
    expect(container.getAuthApplicationService()).toBeDefined();
    expect(container.getClientApplicationService()).toBeDefined();
  });
});

describe('Notificação mock por e-mail', () => {
  it('loga o e-mail com rótulo do status e ignora destinatário vazio', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    sendOrderStatusEmail({ to: 'a@a.com', orderId: 1, externalId: 'e', status: 'CANCELADA' });
    sendOrderStatusEmail({ to: 'a@a.com', orderId: 1, externalId: 'e', status: 'OUTRO' });
    sendOrderStatusEmail({ to: null, orderId: 1, externalId: 'e', status: 'CANCELADA' });
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0][0]).toContain('Cancelada');
    expect(log.mock.calls[1][0]).toContain('OUTRO');
  });
});
