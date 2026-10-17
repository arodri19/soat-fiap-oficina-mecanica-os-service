const serviceRepository = require('../repositories/service.repository');
const { buildServiceData, buildServiceUpdateData } = require('../models/service.model');

async function createService(body) {
  return serviceRepository.createService(buildServiceData(body));
}

async function listServices() {
  return serviceRepository.listServices();
}

async function getService(id) {
  return serviceRepository.getService(id);
}

async function updateService(id, body) {
  return serviceRepository.updateService(id, buildServiceUpdateData(body));
}

async function deleteService(id) {
  return serviceRepository.deleteService(id);
}

module.exports = {
  createService,
  listServices,
  getService,
  updateService,
  deleteService
};
