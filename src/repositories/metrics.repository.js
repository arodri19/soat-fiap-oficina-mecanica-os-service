const prisma = require('../prisma');

async function listFinishedOrdersExecutionWindow() {
  return prisma.orderService.findMany({
    where: { startAt: { not: null }, endAt: { not: null } },
    select: { 
      startAt: true, 
      endAt: true,
      services: {
        select: {
          service: {
            select: { name: true }
          }
        }
      }
    }
  });
}

module.exports = {
  listFinishedOrdersExecutionWindow
};
