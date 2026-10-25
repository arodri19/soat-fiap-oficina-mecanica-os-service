const Order = require('../../domain/entities/Order');
const { ValidationError } = require('../../utils/validation');
const { CreateOrderRequestDTO, OrderProgressResponseDTO } = require('../dtos/OrderDTOs');
const { customerOf } = require('../saga/OrderSagaOrchestrator');

class CreateOrderUseCase {
  constructor({ unitOfWork, orchestrator, monitoring, logger }) {
    this.unitOfWork = unitOfWork;
    this.orchestrator = orchestrator;
    this.monitoring = monitoring;
    this.logger = logger;
  }

  // Abertura da OS + reserva de peças + início da saga numa ÚNICA transação local:
  // ou tudo é gravado (inclusive o comando CreateBudget no outbox), ou nada é.
  async execute(data) {
    const dto = new CreateOrderRequestDTO(data);
    const order = Order.create(dto);
    if (!dto.services.length) {
      throw new ValidationError('Informe ao menos um serviço para gerar o orçamento da OS.');
    }

    const result = await this.unitOfWork.run(async (ctx) => {
      const pricedItems = await priceItems(ctx, dto.services);
      await reserveParts(ctx, pricedItems, this.logger);

      const created = await ctx.orders.create(order.toPlainObject());
      for (const item of pricedItems) {
        await ctx.orders.addItem(created.id, item);
      }
      await ctx.orders.addHistory({ orderId: created.id, fromStatus: null, toStatus: 'RECEBIDA', source: 'STAFF', note: 'OS aberta' });

      const full = await ctx.orders.findById(created.id);
      const saga = await this.orchestrator.startForOrder(ctx, full, customerOf(full));
      return { full, saga, estimatedValue: sumItems(pricedItems) };
    });

    this.monitoring.recordOrderCreated({
      orderId: result.full.id,
      externalId: result.full.externalId,
      servicesCount: dto.services.length,
      budgetValue: result.estimatedValue
    });

    return {
      id: result.full.id,
      externalId: result.full.externalId,
      status: result.full.status,
      estimatedValue: result.estimatedValue,
      saga: { id: result.saga.id, status: result.saga.status, step: result.saga.currentStep },
      services: result.full.services,
      vehicle: result.full.vehicle,
      clientPF: result.full.clientPF,
      clientPJ: result.full.clientPJ
    };
  }
}

async function priceItems(ctx, services) {
  const serviceIds = [...new Set(services.map((s) => s.serviceId))];
  const partIds = [...new Set(services.flatMap((s) => s.parts.map((p) => p.partId)))];

  const catalogServices = new Map((await ctx.catalog.findServicesByIds(serviceIds)).map((s) => [s.id, s]));
  const catalogParts = new Map((await ctx.catalog.findPartsByIds(partIds)).map((p) => [p.id, p]));

  return services.map((s) => {
    const service = catalogServices.get(s.serviceId);
    if (!service) throw new ValidationError(`Serviço ${s.serviceId} não encontrado`);
    return {
      serviceId: service.id,
      unitPrice: service.price || 0,
      parts: s.parts.map((p) => {
        const part = catalogParts.get(p.partId);
        if (!part) throw new ValidationError(`Peça ${p.partId} não encontrada`);
        return { partId: part.id, name: part.name, quantity: p.quantity, unitPrice: part.price || 0, stock: part.quantity };
      })
    };
  });
}

// Reserva (baixa) de estoque na abertura. Sem estoque suficiente, mantém o
// comportamento das fases anteriores: reposição mock junto ao fornecedor.
// Se a saga for compensada, as peças voltam ao estoque (OrderSagaOrchestrator).
async function reserveParts(ctx, pricedItems, logger) {
  const requested = new Map();
  for (const item of pricedItems) {
    for (const part of item.parts) {
      const entry = requested.get(part.partId) || { ...part, quantity: 0 };
      entry.quantity += part.quantity;
      requested.set(part.partId, entry);
    }
  }

  for (const part of requested.values()) {
    if (part.stock < part.quantity) {
      const restock = part.quantity - part.stock + 1;
      logger.info({ partId: part.partId, restock }, `[MOCK] Reposição da peça ${part.name} solicitada ao fornecedor.`);
      await ctx.catalog.incrementStock(part.partId, restock);
    }
    await ctx.catalog.decrementStock(part.partId, part.quantity);
  }
}

function sumItems(pricedItems) {
  const total = pricedItems.reduce(
    (sum, item) => sum + item.unitPrice + item.parts.reduce((acc, p) => acc + p.unitPrice * p.quantity, 0),
    0
  );
  return Math.round(total * 100) / 100;
}

class ListOrdersUseCase {
  constructor({ orderQueries }) {
    this.orderQueries = orderQueries;
  }

  async execute({ status, page, limit } = {}) {
    return this.orderQueries.list({ status, page, limit });
  }
}

class GetOrderUseCase {
  constructor({ orderQueries, sagaQueries }) {
    this.orderQueries = orderQueries;
    this.sagaQueries = sagaQueries;
  }

  async execute(id) {
    const order = await this.orderQueries.findById(id);
    if (!order) return null;
    const saga = await this.sagaQueries.findByOrderId(id);
    return { ...order, saga: saga ? sagaSummary(saga) : null };
  }
}

class GetOrderHistoryUseCase {
  constructor({ orderQueries, sagaQueries }) {
    this.orderQueries = orderQueries;
    this.sagaQueries = sagaQueries;
  }

  async execute(id) {
    const order = await this.orderQueries.findById(id);
    if (!order) return null;
    const saga = await this.sagaQueries.findByOrderId(id);
    return {
      orderId: order.id,
      externalId: order.externalId,
      status: order.status,
      history: await this.orderQueries.listHistory(id),
      saga: saga ? { ...sagaSummary(saga), events: await this.sagaQueries.listEvents(saga.id) } : null
    };
  }
}

class DeliverOrderUseCase {
  constructor({ unitOfWork, monitoring }) {
    this.unitOfWork = unitOfWork;
    this.monitoring = monitoring;
  }

  async execute(id) {
    return this.unitOfWork.run(async (ctx) => {
      const raw = await ctx.orders.findById(id);
      if (!raw) return null;
      const order = Order.fromPrisma(raw);
      order.transitionTo('ENTREGUE');
      const updated = await ctx.orders.update(id, { status: 'ENTREGUE', endAt: order.endAt });
      await ctx.orders.addHistory({ orderId: id, fromStatus: raw.status, toStatus: 'ENTREGUE', source: 'STAFF', note: 'Veículo entregue ao cliente' });
      this.monitoring.recordOrderStatusChanged({
        orderId: id,
        externalId: raw.externalId,
        fromStatus: raw.status,
        toStatus: 'ENTREGUE',
        secondsInPreviousStatus: raw.updatedAt ? (Date.now() - new Date(raw.updatedAt).getTime()) / 1000 : null
      });
      return updated;
    });
  }
}

// Visão consolidada da OS: dados locais + orçamento/pagamento (billing-service) +
// fila de execução (exec-prod-service), via REST síncrono com timeout e circuit
// breaker. Se um serviço remoto estiver fora, a resposta degrada (available: false)
// em vez de falhar — a consulta de status nunca depende da saúde dos outros serviços.
class GetOrderProgressUseCase {
  constructor({ orderQueries, sagaQueries, billingClient, executionClient }) {
    this.orderQueries = orderQueries;
    this.sagaQueries = sagaQueries;
    this.billingClient = billingClient;
    this.executionClient = executionClient;
  }

  async byId(id) {
    const order = await this.orderQueries.findById(id);
    return order ? this.#build(order) : null;
  }

  async byExternalId(externalId, requesterId) {
    const order = await this.orderQueries.findByExternalId(externalId);
    // requesterId (ClientPF.id do JWT do cliente): OS de outro cliente → 404
    if (!order || order.clientPFId !== requesterId) return null;
    return this.#build(order);
  }

  async #build(order) {
    const [saga, billing, execution] = await Promise.all([
      this.sagaQueries.findByOrderId(order.id),
      this.billingClient.getOrderBilling(order.id),
      this.executionClient.getExecution(order.id)
    ]);
    return {
      ...OrderProgressResponseDTO.fromOrder(order),
      saga: saga ? sagaSummary(saga) : null,
      billing,
      execution
    };
  }
}

class OrderClientActionsUseCase {
  constructor({ orchestrator }) {
    this.orchestrator = orchestrator;
  }

  async approve(externalId, requesterId) {
    return this.orchestrator.approve(externalId, requesterId);
  }

  async reject(externalId, requesterId, reason) {
    return this.orchestrator.reject(externalId, requesterId, reason);
  }

  async cancel(orderId, reason) {
    return this.orchestrator.cancel(orderId, reason);
  }
}

function sagaSummary(saga) {
  return {
    id: saga.id,
    status: saga.status,
    step: saga.currentStep,
    budgetId: saga.budgetId,
    paymentId: saga.paymentId,
    paymentUrl: saga.paymentUrl,
    pendingCompensations: saga.pendingCompensations,
    failureReason: saga.failureReason
  };
}

module.exports = {
  CreateOrderUseCase,
  ListOrdersUseCase,
  GetOrderUseCase,
  GetOrderHistoryUseCase,
  DeliverOrderUseCase,
  GetOrderProgressUseCase,
  OrderClientActionsUseCase,
  sagaSummary
};
