const prisma = require('../prisma');

async function createService(data) {
  return prisma.service.create({ data });
}

async function listServices() {
  return prisma.service.findMany();
}

async function getService(id) {
  return prisma.service.findUnique({ where: { id } });
}

async function updateService(id, data) {
  return prisma.service.update({ where: { id }, data });
}

async function deleteService(id) {
  return prisma.service.delete({ where: { id } });
}

module.exports = {
  createService,
  listServices,
  getService,
  updateService,
  deleteService
};
