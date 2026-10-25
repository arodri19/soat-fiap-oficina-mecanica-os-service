const { ValidationError, validateString, validateNumber, validateOneOf } = require('../../utils/validation');

class CreateOrderRequestDTO {
  constructor({ description, vehicleId, clientPFId, clientPJId, mechanicName, services }) {
    this.description = validateString(description, 'description', { required: true });
    this.vehicleId = validateNumber(vehicleId, 'vehicleId', { required: true, integer: true });
    validateOneOf({ clientPFId, clientPJId }, ['clientPFId', 'clientPJId']);
    if (clientPFId !== undefined && clientPFId !== null) {
      this.clientPFId = validateNumber(clientPFId, 'clientPFId', { required: false, integer: true });
    }
    if (clientPJId !== undefined && clientPJId !== null) {
      this.clientPJId = validateNumber(clientPJId, 'clientPJId', { required: false, integer: true });
    }
    if (mechanicName !== undefined) {
      this.mechanicName = validateString(mechanicName, 'mechanicName', { required: false });
    }

    if (services === undefined) {
      this.services = [];
      return;
    }
    if (!Array.isArray(services)) throw new ValidationError('services deve ser um array');
    this.services = services.map((s, i) => {
      const serviceId = validateNumber(s.serviceId, `services[${i}].serviceId`, { required: true, integer: true });
      const parts = Array.isArray(s.parts)
        ? s.parts.map((p, j) => ({
            partId: validateNumber(p.partId, `services[${i}].parts[${j}].partId`, { required: true, integer: true }),
            quantity: validateNumber(p.quantity, `services[${i}].parts[${j}].quantity`, { required: false, integer: true, min: 1 }) ?? 1
          }))
        : [];
      return { serviceId, parts };
    });
  }
}

class OrderProgressResponseDTO {
  static fromOrder(order) {
    return {
      id: order.id,
      externalId: order.externalId,
      status: order.status?.toString ? order.status.toString() : order.status,
      mechanicDescription: order.description,
      mechanicName: order.mechanicName ?? null,
      budgetValue: order.budgetValue ?? null,
      cancelReason: order.cancelReason ?? null
    };
  }
}

module.exports = {
  CreateOrderRequestDTO,
  OrderProgressResponseDTO
};
