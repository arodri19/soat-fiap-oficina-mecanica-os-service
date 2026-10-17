const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const {
  createService,
  listServices,
  getService,
  updateService,
  deleteService
} = require('../controllers/service.controller');

const router = express.Router();

router.post('/', asyncHandler(createService));
router.get('/', asyncHandler(listServices));
router.get('/:id', asyncHandler(getService));
router.put('/:id', asyncHandler(updateService));
router.delete('/:id', asyncHandler(deleteService));

module.exports = router;
