const vehicleRepository = require('../repositories/vehicle.repository');
const { buildVehicleData, buildVehicleUpdateData } = require('../models/vehicle.model');

async function createVehicle(body) {
  return vehicleRepository.createVehicle(buildVehicleData(body));
}

async function listVehicles() {
  return vehicleRepository.listVehicles();
}

async function getVehicle(id) {
  return vehicleRepository.getVehicle(id);
}

async function updateVehicle(id, body) {
  return vehicleRepository.updateVehicle(id, buildVehicleUpdateData(body));
}

async function deleteVehicle(id) {
  return vehicleRepository.deleteVehicle(id);
}

module.exports = {
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle
};
