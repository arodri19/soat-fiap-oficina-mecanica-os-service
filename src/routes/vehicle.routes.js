const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const {
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle
} = require('../controllers/vehicle.controller');

const router = express.Router();

router.post('/', asyncHandler(createVehicle));
router.get('/', asyncHandler(listVehicles));
router.get('/:id', asyncHandler(getVehicle));
router.put('/:id', asyncHandler(updateVehicle));
router.delete('/:id', asyncHandler(deleteVehicle));

module.exports = router;
