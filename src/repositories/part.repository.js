const prisma = require('../prisma');

async function createPart(data) {
  return prisma.part.create({ data });
}

async function listParts() {
  return prisma.part.findMany();
}

async function getPart(id) {
  return prisma.part.findUnique({ where: { id } });
}

async function updatePart(id, data) {
  return prisma.part.update({ where: { id }, data });
}

async function deletePart(id) {
  return prisma.part.delete({ where: { id } });
}

module.exports = {
  createPart,
  listParts,
  getPart,
  updatePart,
  deletePart
};
