const jwt = require('jsonwebtoken');
const { CircuitBreaker, CircuitOpenError } = require('../../../src/infrastructure/http/CircuitBreaker');
const { BillingClient, ExecutionClient, InternalServiceClient } = require('../../../src/infrastructure/http/ServiceClients');

const logger = { warn: jest.fn() };

describe('CircuitBreaker', () => {
  it('abre após N falhas, falha rápido e fecha após sucesso em HALF_OPEN', async () => {
    let now = 0;
    const breaker = new CircuitBreaker({ name: 'x', failureThreshold: 2, resetTimeoutMs: 1000, clock: () => now });
    const failing = () => Promise.reject(new Error('boom'));

    await expect(breaker.exec(failing)).rejects.toThrow('boom');
    expect(breaker.state).toBe('CLOSED');
    await expect(breaker.exec(failing)).rejects.toThrow('boom');
    expect(breaker.state).toBe('OPEN');

    const fn = jest.fn().mockResolvedValue('ok');
    await expect(breaker.exec(fn)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();

    now = 1500;
    await expect(breaker.exec(fn)).resolves.toBe('ok');
    expect(breaker.state).toBe('CLOSED');
  });

  it('falha em HALF_OPEN reabre imediatamente', async () => {
    let now = 0;
    const breaker = new CircuitBreaker({ name: 'x', failureThreshold: 1, resetTimeoutMs: 10, clock: () => now });
    await expect(breaker.exec(() => Promise.reject(new Error('a')))).rejects.toThrow();
    now = 20;
    await expect(breaker.exec(() => Promise.reject(new Error('b')))).rejects.toThrow('b');
    expect(breaker.state).toBe('OPEN');
  });

  it('usa Date.now e limites padrão', () => {
    const breaker = new CircuitBreaker({ name: 'y' });
    expect(breaker.failureThreshold).toBe(5);
    expect(typeof breaker.clock()).toBe('number');
  });
});

describe('Clientes REST internos', () => {
  const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

  it('BillingClient chama /internal com JWT de serviço', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, { budget: { total: 10 } }));
    const client = new BillingClient({ baseUrl: 'http://billing/', jwtSecret: 's', fetchImpl, logger });

    await expect(client.getOrderBilling(5)).resolves.toEqual({ available: true, data: { budget: { total: 10 } } });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://billing/api/internal/orders/5/billing');
    const token = options.headers.Authorization.replace('Bearer ', '');
    expect(jwt.verify(token, 's')).toMatchObject({ sub: 'os-service', role: 'SERVICE' });
  });

  it('ExecutionClient: 404 vira data null', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(404));
    const client = new ExecutionClient({ baseUrl: 'http://exec', jwtSecret: 's', fetchImpl, logger });
    await expect(client.getExecution(1)).resolves.toEqual({ available: true, data: null });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://exec/api/internal/executions/1');
  });

  it('erro HTTP/timeout degrada a resposta', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(503));
    const client = new BillingClient({ baseUrl: 'http://billing', jwtSecret: 's', fetchImpl, logger });
    await expect(client.getOrderBilling(1)).resolves.toEqual({ available: false, reason: 'HTTP 503 em http://billing/api/internal/orders/1/billing' });
  });

  it('circuito aberto responde sem chamar o serviço remoto', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new BillingClient({
      baseUrl: 'http://billing', jwtSecret: 's', fetchImpl,
      breaker: new CircuitBreaker({ name: 'b', failureThreshold: 1 })
    });
    await client.getOrderBilling(1);
    await expect(client.getOrderBilling(1)).resolves.toEqual({ available: false, reason: 'circuit-open' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sem URL configurada não tenta chamar', async () => {
    const client = new InternalServiceClient({ name: 'z', jwtSecret: 's' });
    await expect(client.getJson('/x')).resolves.toEqual({ available: false, reason: 'z não configurado' });
  });
});
