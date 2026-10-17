const OrderStatus = require('../value-objects/OrderStatus');
const { ValidationError, validateString, validateNumber, validateOneOf } = require('../../utils/validation');

class Order {
  constructor({ id, externalId, status, description, mechanicName, budgetValue, budgetId, cancelReason, startAt, endAt, clientPFId, clientPJId, vehicleId, services }) {
    this.id = id || null;
    this.externalId = externalId || null;
    this.status = status instanceof OrderStatus ? status : new OrderStatus(status || 'RECEBIDA');
    this.description = description;
    this.mechanicName = mechanicName || null;
    this.budgetValue = budgetValue ?? null;
    this.budgetId = budgetId || null;
    this.cancelReason = cancelReason || null;
    this.startAt = startAt || null;
    this.endAt = endAt || null;
    this.clientPFId = clientPFId || null;
    this.clientPJId = clientPJId || null;
    this.vehicleId = vehicleId;
    this.services = services || [];
  }

  static create({ description, vehicleId, clientPFId, clientPJId, mechanicName }) {
    validateString(description, 'description', { required: true });
    validateNumber(vehicleId, 'vehicleId', { required: true, integer: true });
    validateOneOf({ clientPFId, clientPJId }, ['clientPFId', 'clientPJId']);

    return new Order({
      status: 'RECEBIDA',
      description,
      vehicleId,
      clientPFId: clientPFId ?? null,
      clientPJId: clientPJId ?? null,
      mechanicName: mechanicName ?? null
    });
  }

  transitionTo(newStatusValue) {
    const next = this.status.transitionTo(newStatusValue);

    if (newStatusValue === 'EM_EXECUCAO' && !this.startAt) {
      this.startAt = new Date();
    }
    if (newStatusValue === 'FINALIZADA') {
      this.endAt = new Date();
    }
    if (newStatusValue === 'ENTREGUE' && !this.endAt) {
      this.endAt = new Date();
    }

    this.status = next;
  }

  budgetCreated({ budgetId, total }) {
    this.budgetId = budgetId;
    this.budgetValue = total;
    this.transitionTo('AGUARDANDO_APROVACAO');
  }

  approve() {
    if (!this.status.isAwaitingApproval()) {
      throw new ValidationError(`Ordem não está aguardando aprovação. Status atual: ${this.status}.`);
    }
    this.transitionTo('AGUARDANDO_PAGAMENTO');
  }

  cancel(reason) {
    this.transitionTo('CANCELADA');
    this.cancelReason = reason || null;
  }

  isTerminal() {
    return this.status.isTerminal();
  }

  toPlainObject() {
    const obj = {
      description: this.description,
      vehicleId: this.vehicleId,
      status: this.status.toString()
    };
    if (this.mechanicName !== null) obj.mechanicName = this.mechanicName;
    if (this.clientPFId !== null) obj.clientPFId = this.clientPFId;
    if (this.clientPJId !== null) obj.clientPJId = this.clientPJId;
    if (this.startAt !== null) obj.startAt = this.startAt;
    if (this.endAt !== null) obj.endAt = this.endAt;
    if (this.budgetValue !== null) obj.budgetValue = this.budgetValue;
    return obj;
  }

  static fromPrisma(raw) {
    return new Order({
      id: raw.id,
      externalId: raw.externalId,
      status: raw.status,
      description: raw.description,
      mechanicName: raw.mechanicName,
      budgetValue: raw.budgetValue,
      budgetId: raw.budgetId,
      cancelReason: raw.cancelReason,
      startAt: raw.startAt,
      endAt: raw.endAt,
      clientPFId: raw.clientPFId,
      clientPJId: raw.clientPJId,
      vehicleId: raw.vehicleId,
      services: raw.services
    });
  }
}

module.exports = Order;
