const jwt = require('jsonwebtoken');
const { CircuitBreaker } = require('./CircuitBreaker');

class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} em ${url}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Cliente REST síncrono entre microsserviços (dentro do cluster, via DNS do Service
 * Kubernetes). Autentica com um JWT de curta duração role=SERVICE, assinado com o
 * segredo compartilhado — as rotas /internal dos outros serviços só aceitam esse role.
 * Timeout + circuit breaker + fallback: a indisponibilidade de um serviço remoto
 * degrada a resposta em vez de derrubar a requisição.
 */
class InternalServiceClient {
  constructor({ name, baseUrl, jwtSecret, timeoutMs = 2000, breaker, fetchImpl, logger }) {
    this.name = name;
    this.baseUrl = baseUrl?.replace(/\/$/, '');
    this.jwtSecret = jwtSecret;
    this.timeoutMs = timeoutMs;
    this.breaker = breaker || new CircuitBreaker({ name });
    this.fetch = fetchImpl || globalThis.fetch;
    this.logger = logger;
  }

  serviceToken() {
    return jwt.sign({ sub: 'os-service', role: 'SERVICE' }, this.jwtSecret, { expiresIn: '60s' });
  }

  async getJson(path) {
    if (!this.baseUrl) return { available: false, reason: `${this.name} não configurado` };

    const url = `${this.baseUrl}${path}`;
    try {
      return await this.breaker.exec(async () => {
        const response = await this.fetch(url, {
          headers: { Authorization: `Bearer ${this.serviceToken()}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs)
        });
        if (response.status === 404) return { available: true, data: null };
        if (!response.ok) throw new HttpError(response.status, url);
        return { available: true, data: await response.json() };
      });
    } catch (error) {
      this.logger?.warn({ err: error, url }, `Chamada síncrona ao ${this.name} falhou — resposta degradada`);
      return { available: false, reason: error.name === 'CircuitOpenError' ? 'circuit-open' : error.message };
    }
  }
}

class BillingClient extends InternalServiceClient {
  constructor(options) {
    super({ name: 'billing-service', ...options });
  }

  async getOrderBilling(orderId) {
    return this.getJson(`/api/internal/orders/${orderId}/billing`);
  }
}

class ExecutionClient extends InternalServiceClient {
  constructor(options) {
    super({ name: 'exec-prod-service', ...options });
  }

  async getExecution(orderId) {
    return this.getJson(`/api/internal/executions/${orderId}`);
  }
}

module.exports = {
  InternalServiceClient,
  BillingClient,
  ExecutionClient,
  HttpError
};
