const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const {
  createOrder,
  listOrders,
  getOrder,
  getOrderHistory,
  getOrderProgress,
  deliverOrder,
  cancelOrder
} = require('../controllers/order.controller');

const router = express.Router();

router.post('/', asyncHandler(createOrder));
router.get('/', asyncHandler(listOrders));
router.get('/:id', asyncHandler(getOrder));
router.get('/:id/history', asyncHandler(getOrderHistory));
router.get('/:id/progress', asyncHandler(getOrderProgress));
router.post('/:id/deliver', asyncHandler(deliverOrder));
router.post('/:id/cancel', asyncHandler(cancelOrder));

module.exports = router;
