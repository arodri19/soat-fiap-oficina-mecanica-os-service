const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const container = require('../infrastructure/container/Container');
const { authorize } = require('../middlewares/auth');

const router = express.Router();

// requesterId (req.user.sub) restringe a busca à própria OS do cliente autenticado —
// uma OS de outro cliente responde 404 (não 403), pra não revelar que o externalId existe.
router.get('/:externalId', authorize(['CLIENT']), asyncHandler(async (req, res) => {
  const progress = await container.getOrderApplicationService().getOrderProgressByExternalId(req.params.externalId, req.user.sub);
  if (!progress) return res.status(404).json({ message: 'Ordem não encontrada.' });
  return res.json(progress);
}));

router.post('/:externalId/approve', authorize(['CLIENT']), asyncHandler(async (req, res) => {
  const order = await container.getOrderApplicationService().approveOrder(req.params.externalId, req.user.sub);
  if (!order) return res.status(404).json({ message: 'Ordem não encontrada.' });
  return res.json({
    order,
    message: 'Orçamento aprovado. Link de pagamento (Mercado Pago) disponível em instantes em GET /api/track/:externalId.'
  });
}));

router.post('/:externalId/reject', authorize(['CLIENT']), asyncHandler(async (req, res) => {
  const order = await container.getOrderApplicationService().rejectOrder(req.params.externalId, req.user.sub, req.body?.reason);
  if (!order) return res.status(404).json({ message: 'Ordem não encontrada.' });
  return res.json({ order, message: 'Orçamento recusado. OS cancelada e orçamento cancelado no billing-service.' });
}));

module.exports = router;
