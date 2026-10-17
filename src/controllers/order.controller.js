const container = require('../infrastructure/container/Container');

// Documentação OpenAPI das rotas: src/openapi.json (servida em /api-docs).

async function createOrder(req, res) {
  const { description, vehicleId, clientPFId, clientPJId } = req.body;
  if (!description || !vehicleId) {
    return res.status(400).json({ message: 'Descrição e veículo são obrigatórios.' });
  }
  if (!clientPFId && !clientPJId) {
    return res.status(400).json({ message: 'Cliente PF ou PJ deve ser informado.' });
  }

  const order = await container.getOrderApplicationService().createOrder(req.body);
  return res.status(201).json({
    ...order,
    message: 'OS aberta. Orçamento solicitado ao billing-service (saga iniciada).'
  });
}

async function listOrders(req, res) {
  const { status, page, limit } = req.query;
  const result = await container.getOrderApplicationService().listOrders({
    status,
    page: page ? Number.parseInt(page, 10) : 1,
    limit: limit ? Number.parseInt(limit, 10) : 20
  });
  return res.json(result);
}

async function getOrder(req, res) {
  const order = await container.getOrderApplicationService().getOrder(Number(req.params.id));
  if (!order) return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
  return res.json(order);
}

async function getOrderHistory(req, res) {
  const history = await container.getOrderApplicationService().getOrderHistory(Number(req.params.id));
  if (!history) return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
  return res.json(history);
}

async function getOrderProgress(req, res) {
  const progress = await container.getOrderApplicationService().getOrderProgress(Number(req.params.id));
  if (!progress) return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
  return res.json(progress);
}

async function deliverOrder(req, res) {
  const order = await container.getOrderApplicationService().deliverOrder(Number(req.params.id));
  if (!order) return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
  return res.json({ order, message: 'Veículo entregue ao cliente.' });
}

async function cancelOrder(req, res) {
  const order = await container.getOrderApplicationService().cancelOrder(Number(req.params.id), req.body?.reason);
  if (!order) return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
  return res.json({ order, message: 'OS cancelada. Compensações enviadas aos serviços envolvidos.' });
}

module.exports = {
  createOrder,
  listOrders,
  getOrder,
  getOrderHistory,
  getOrderProgress,
  deliverOrder,
  cancelOrder
};
