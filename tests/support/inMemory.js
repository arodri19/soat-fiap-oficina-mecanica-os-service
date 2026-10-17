// Adaptadores em memória com a MESMA interface dos repositórios Prisma — usados
// pelos testes unitários e BDD para exercitar o orquestrador real sem banco.
// A Unit of Work tira um snapshot do estado e o restaura se o trabalho lançar
// erro, simulando o rollback da transação PostgreSQL.
const crypto = require('node:crypto');
const { OrderSaga } = require('../../src/domain/saga/OrderSaga');
const { ConcurrencyError } = require('../../src/infrastructure/repositories/PrismaSagaRepository');

function createState({ services = [], parts = [], clients = [], vehicles = [] } = {}) {
  return {
    seq: { order: 0, item: 0, part: 0, history: 0, event: 0 },
    services: new Map(services.map((s) => [s.id, { ...s }])),
    parts: new Map(parts.map((p) => [p.id, { ...p }])),
    clients: new Map(clients.map((c) => [c.id, { ...c }])),
    vehicles: new Map(vehicles.map((v) => [v.id, { ...v }])),
    orders: new Map(),
    history: [],
    sagas: new Map(),
    sagaEvents: [],
    outbox: [],
    processed: new Set()
  };
}

function cloneState(state) {
  return structuredClone(state);
}

class InMemoryOrderRepository {
  constructor(state) {
    this.state = state;
  }

  #hydrate(order) {
    if (!order) return null;
    const services = order.items.map((item) => ({
      ...item,
      service: this.state.services.get(item.serviceId) || null,
      parts: item.parts.map((p) => ({ ...p, part: this.state.parts.get(p.partId) || null }))
    }));
    return {
      ...order,
      clientPF: order.clientPFId ? this.state.clients.get(order.clientPFId) || null : null,
      clientPJ: null,
      vehicle: this.state.vehicles.get(order.vehicleId) || null,
      services
    };
  }

  async create(data) {
    this.state.seq.order += 1;
    const now = new Date();
    const order = {
      id: this.state.seq.order,
      externalId: crypto.randomUUID(),
      status: 'RECEBIDA',
      mechanicName: null,
      budgetValue: null,
      budgetId: null,
      cancelReason: null,
      startAt: null,
      endAt: null,
      clientPFId: null,
      clientPJId: null,
      createdAt: now,
      updatedAt: now,
      ...data,
      items: []
    };
    this.state.orders.set(order.id, order);
    return this.#hydrate(order);
  }

  async addItem(orderId, { serviceId, unitPrice, parts }) {
    const order = this.state.orders.get(orderId);
    this.state.seq.item += 1;
    const item = {
      id: this.state.seq.item,
      orderServiceId: orderId,
      serviceId,
      unitPrice,
      parts: parts.map((p) => {
        this.state.seq.part += 1;
        return { id: this.state.seq.part, partId: p.partId, quantity: p.quantity, unitPrice: p.unitPrice };
      })
    };
    order.items.push(item);
    return item;
  }

  async findById(id) {
    return this.#hydrate(this.state.orders.get(id));
  }

  async findByExternalId(externalId) {
    return this.#hydrate([...this.state.orders.values()].find((o) => o.externalId === externalId));
  }

  async update(id, data) {
    const order = this.state.orders.get(id);
    Object.assign(order, data, { updatedAt: new Date() });
    return this.#hydrate(order);
  }

  async addHistory(entry) {
    this.state.seq.history += 1;
    const row = { id: this.state.seq.history, createdAt: new Date(), note: null, ...entry };
    this.state.history.push(row);
    return row;
  }

  async listHistory(orderId) {
    return this.state.history.filter((h) => h.orderId === orderId);
  }

  async list({ status, page = 1, limit = 20 } = {}) {
    const active = [...this.state.orders.values()]
      .filter((o) => !['FINALIZADA', 'ENTREGUE', 'CANCELADA'].includes(o.status))
      .filter((o) => !status || o.status === status);
    const data = active.slice((page - 1) * limit, page * limit).map((o) => this.#hydrate(o));
    return { data, total: active.length, page, limit, pages: Math.ceil(active.length / limit) };
  }
}

class InMemorySagaRepository {
  constructor(state) {
    this.state = state;
  }

  async create(saga) {
    this.state.sagas.set(saga.id, { ...saga, pendingCompensations: [...saga.pendingCompensations], version: 0 });
    saga.version = 0;
    return saga;
  }

  async findById(id) {
    const row = this.state.sagas.get(id);
    return row ? new OrderSaga(structuredClone(row)) : null;
  }

  async findByOrderId(orderId) {
    const row = [...this.state.sagas.values()].find((s) => s.orderId === orderId);
    return row ? new OrderSaga(structuredClone(row)) : null;
  }

  async save(saga) {
    const current = this.state.sagas.get(saga.id);
    if (!current || current.version !== saga.version) {
      throw new ConcurrencyError(`Saga ${saga.id} alterada concorrentemente`);
    }
    saga.version += 1;
    this.state.sagas.set(saga.id, { ...saga, pendingCompensations: [...saga.pendingCompensations] });
    return saga;
  }

  async addEvent(event) {
    this.state.seq.event += 1;
    const row = { id: this.state.seq.event, createdAt: new Date(), ...event };
    this.state.sagaEvents.push(row);
    return row;
  }

  async listEvents(sagaId) {
    return this.state.sagaEvents.filter((e) => e.sagaId === sagaId);
  }

  async findRunningWithStepStartedBefore(date) {
    return [...this.state.sagas.values()]
      .filter((s) => s.status === 'RUNNING' && new Date(s.stepStartedAt) < date)
      .map((s) => new OrderSaga(structuredClone(s)));
  }
}

class InMemoryOutboxRepository {
  constructor(state) {
    this.state = state;
  }

  async add(message) {
    this.state.outbox.push({ ...message, status: 'PENDING' });
  }
}

class InMemoryInboxRepository {
  constructor(state) {
    this.state = state;
  }

  async markProcessed(messageId) {
    if (this.state.processed.has(messageId)) return false;
    this.state.processed.add(messageId);
    return true;
  }
}

class InMemoryCatalogRepository {
  constructor(state) {
    this.state = state;
  }

  async findServicesByIds(ids) {
    return ids.map((id) => this.state.services.get(id)).filter(Boolean);
  }

  async findPartsByIds(ids) {
    return ids.map((id) => this.state.parts.get(id)).filter(Boolean);
  }

  async decrementStock(partId, quantity) {
    this.state.parts.get(partId).quantity -= quantity;
  }

  async incrementStock(partId, quantity) {
    this.state.parts.get(partId).quantity += quantity;
  }
}

class InMemoryUnitOfWork {
  constructor(seed) {
    this.state = createState(seed);
  }

  repositories() {
    return {
      orders: new InMemoryOrderRepository(this.state),
      sagas: new InMemorySagaRepository(this.state),
      outbox: new InMemoryOutboxRepository(this.state),
      inbox: new InMemoryInboxRepository(this.state),
      catalog: new InMemoryCatalogRepository(this.state)
    };
  }

  async run(work) {
    const snapshot = cloneState(this.state);
    try {
      return await work(this.repositories());
    } catch (error) {
      Object.assign(this.state, snapshot);
      throw error;
    }
  }

  // Entrega as mensagens pendentes do outbox (o que o OutboxRelay faria via SQS).
  drainOutbox() {
    const pending = this.state.outbox.filter((m) => m.status === 'PENDING');
    pending.forEach((m) => { m.status = 'SENT'; });
    return pending;
  }
}

const silentLogger = { info() {}, warn() {}, error() {}, debug() {} };

function fakeMonitoring() {
  return {
    events: [],
    recordSagaEvent(type, attrs) { this.events.push({ type, ...attrs }); },
    recordOrderStatusChanged() {},
    recordOrderCreated() {}
  };
}

const fakeTracing = { currentTraceHeaders: () => ({ traceparent: '00-test' }) };
const fakeNotifier = { sendOrderStatusEmail: () => {} };

const CATALOG_SEED = {
  services: [
    { id: 1, name: 'Troca de Óleo', slaMinutes: 60, price: 80 },
    { id: 2, name: 'Troca de Pastilha de Freio', slaMinutes: 90, price: 180 }
  ],
  parts: [
    { id: 1, name: 'Óleo de Motor 5W40', quantity: 10, price: 45 },
    { id: 2, name: 'Filtro de Óleo', quantity: 1, price: 25 }
  ],
  clients: [
    { id: 1, name: 'João Silva', email: 'joao@example.com', cpf: '52998224725' },
    { id: 2, name: 'Maria Oliveira', email: 'maria@example.com', cpf: '11144477735' }
  ],
  vehicles: [{ id: 1, plate: 'ABC1D23', model: 'Fiat Pulse', clientPFId: 1 }]
};

const QUEUES = {
  osReplies: 'test-os-saga-replies',
  billingCommands: 'test-billing-commands',
  executionCommands: 'test-execution-commands'
};

module.exports = {
  InMemoryUnitOfWork,
  silentLogger,
  fakeMonitoring,
  fakeTracing,
  fakeNotifier,
  CATALOG_SEED,
  QUEUES
};
