class CircuitOpenError extends Error {
  constructor(name) {
    super(`Circuit breaker "${name}" aberto — chamada não realizada`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Circuit breaker mínimo (CLOSED → OPEN → HALF_OPEN):
 * - após `failureThreshold` falhas seguidas, abre e falha rápido por `resetTimeoutMs`;
 * - passado esse tempo, deixa UMA chamada de teste passar (HALF_OPEN);
 *   sucesso fecha o circuito, falha reabre.
 * Evita que uma dependência lenta/fora do ar segure threads e conexões do serviço.
 */
class CircuitBreaker {
  constructor({ name, failureThreshold = 5, resetTimeoutMs = 30_000, clock = () => Date.now() }) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.clock = clock;
    this.state = 'CLOSED';
    this.failures = 0;
    this.openedAt = null;
  }

  async exec(fn) {
    if (this.state === 'OPEN') {
      if (this.clock() - this.openedAt < this.resetTimeoutMs) {
        throw new CircuitOpenError(this.name);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.#onSuccess();
      return result;
    } catch (error) {
      this.#onFailure();
      throw error;
    }
  }

  #onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.openedAt = null;
  }

  #onFailure() {
    this.failures += 1;
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = this.clock();
    }
  }
}

module.exports = { CircuitBreaker, CircuitOpenError };
