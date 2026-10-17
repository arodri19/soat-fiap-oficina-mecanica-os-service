const partRepository = require('../repositories/part.repository');
const { buildPartData, buildPartUpdateData } = require('../models/part.model');

async function createPart(body) {
  return partRepository.createPart(buildPartData(body));
}

async function listParts() {
  return partRepository.listParts();
}

async function getPart(id) {
  return partRepository.getPart(id);
}

async function updatePart(id, body) {
  return partRepository.updatePart(id, buildPartUpdateData(body));
}

async function deletePart(id) {
  return partRepository.deletePart(id);
}

module.exports = {
  createPart,
  listParts,
  getPart,
  updatePart,
  deletePart
};
