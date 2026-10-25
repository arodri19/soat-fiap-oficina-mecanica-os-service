const { Prisma } = require('@prisma/client');
const prisma = require('../../prisma');

const EXCLUDED_STATUSES = ['FINALIZADA', 'ENTREGUE', 'CANCELADA'];
const STATUS_PRIORITY = `CASE status
  WHEN 'EM_EXECUCAO'          THEN 1
  WHEN 'EM_DIAGNOSTICO'       THEN 2
  WHEN 'AGUARDANDO_EXECUCAO'  THEN 3
  WHEN 'AGUARDANDO_PAGAMENTO' THEN 4
  WHEN 'AGUARDANDO_APROVACAO' THEN 5
  WHEN 'RECEBIDA'             THEN 6
  ELSE 7 END`;

const ORDER_WITH_RELATIONS = {
  vehicle: true,
  clientPF: true,
  clientPJ: true,
  services: { include: { service: true, parts: { include: { part: true } } } }
};

// `client` pode ser o PrismaClient raiz (consultas) ou o client de uma transação
// interativa (PrismaUnitOfWork) — o mesmo repositório serve aos dois casos.
class PrismaOrderRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  async create(data) {
    return this.client.orderService.create({ data });
  }

  async addItem(orderId, { serviceId, unitPrice, parts }) {
    return this.client.orderServiceService.create({
      data: {
        orderServiceId: orderId,
        serviceId,
        unitPrice,
        parts: { create: parts.map((p) => ({ partId: p.partId, quantity: p.quantity, unitPrice: p.unitPrice })) }
      }
    });
  }

  async findById(id) {
    return this.client.orderService.findUnique({ where: { id }, include: ORDER_WITH_RELATIONS });
  }

  async findByExternalId(externalId) {
    return this.client.orderService.findUnique({ where: { externalId }, include: ORDER_WITH_RELATIONS });
  }

  async update(id, data) {
    return this.client.orderService.update({ where: { id }, data });
  }

  async addHistory({ orderId, fromStatus, toStatus, source, note }) {
    return this.client.orderStatusHistory.create({
      data: { orderId, fromStatus: fromStatus || null, toStatus, source, note: note || null }
    });
  }

  async listHistory(orderId) {
    return this.client.orderStatusHistory.findMany({ where: { orderId }, orderBy: { id: 'asc' } });
  }

  async list({ status, page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const statusFilter = status ? Prisma.sql`AND status::text = ${status}` : Prisma.empty;

    // CASE WHEN não é suportado no orderBy do Prisma — ids ordenados via SQL e
    // objetos completos carregados depois.
    const rows = await this.client.$queryRaw`
      SELECT id FROM "OrderService"
      WHERE status::text NOT IN ('FINALIZADA', 'ENTREGUE', 'CANCELADA')
      ${statusFilter}
      ORDER BY ${Prisma.raw(STATUS_PRIORITY)} ASC, id ASC
      LIMIT ${limit} OFFSET ${skip}
    `;
    const ids = rows.map((r) => Number(r.id));

    const unsorted = await this.client.orderService.findMany({ where: { id: { in: ids } }, include: ORDER_WITH_RELATIONS });
    const byId = new Map(unsorted.map((o) => [o.id, o]));
    const data = ids.map((id) => byId.get(id));

    const total = await this.client.orderService.count({
      where: { status: { notIn: EXCLUDED_STATUSES }, ...(status ? { status } : {}) }
    });

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }
}

module.exports = PrismaOrderRepository;
