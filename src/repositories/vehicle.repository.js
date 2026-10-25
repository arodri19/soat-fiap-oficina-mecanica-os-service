const prisma = require('../prisma');

async function createVehicle(data) {
  return prisma.vehicle.create({ data });
}

async function listVehicles() {
  return prisma.vehicle.findMany({ include: { clientPF: true } });
}

async function getVehicle(id) {
  return prisma.vehicle.findUnique({ where: { id }, include: { clientPF: true } });
}

async function updateVehicle(id, data) {
  return prisma.vehicle.update({ where: { id }, data });
}

async function deleteVehicle(id) {
  return prisma.vehicle.delete({ where: { id } });
}

module.exports = {
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle
};
