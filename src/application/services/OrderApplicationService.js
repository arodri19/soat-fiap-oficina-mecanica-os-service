const {
  CreateOrderUseCase,
  ListOrdersUseCase,
  GetOrderUseCase,
  GetOrderHistoryUseCase,
  DeliverOrderUseCase,
  GetOrderProgressUseCase,
  OrderClientActionsUseCase
} = require('../use-cases/OrderUseCases');

// Fachada usada pelos controllers — recebe todas as dependências por injeção
// (ver infrastructure/container/Container.js).
class OrderApplicationService {
  constructor(deps) {
    this.createOrderUseCase = new CreateOrderUseCase(deps);
    this.listOrdersUseCase = new ListOrdersUseCase(deps);
    this.getOrderUseCase = new GetOrderUseCase(deps);
    this.getOrderHistoryUseCase = new GetOrderHistoryUseCase(deps);
    this.deliverOrderUseCase = new DeliverOrderUseCase(deps);
    this.progressUseCase = new GetOrderProgressUseCase(deps);
    this.actionsUseCase = new OrderClientActionsUseCase(deps);
  }

  async createOrder(data) {
    return this.createOrderUseCase.execute(data);
  }

  async listOrders({ status, page, limit } = {}) {
    return this.listOrdersUseCase.execute({ status, page, limit });
  }

  async getOrder(id) {
    return this.getOrderUseCase.execute(id);
  }

  async getOrderHistory(id) {
    return this.getOrderHistoryUseCase.execute(id);
  }

  async deliverOrder(id) {
    return this.deliverOrderUseCase.execute(id);
  }

  async cancelOrder(id, reason) {
    return this.actionsUseCase.cancel(id, reason);
  }

  async getOrderProgress(id) {
    return this.progressUseCase.byId(id);
  }

  async getOrderProgressByExternalId(externalId, requesterId) {
    return this.progressUseCase.byExternalId(externalId, requesterId);
  }

  async approveOrder(externalId, requesterId) {
    return this.actionsUseCase.approve(externalId, requesterId);
  }

  async rejectOrder(externalId, requesterId, reason) {
    return this.actionsUseCase.reject(externalId, requesterId, reason);
  }
}

module.exports = OrderApplicationService;
