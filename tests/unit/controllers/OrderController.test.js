jest.mock('../../../src/infrastructure/container/Container', () => {
  const mockOrderSvc = {
    createOrder: jest.fn(),
    listOrders: jest.fn(),
    getOrder: jest.fn(),
    getOrderHistory: jest.fn(),
    getOrderProgress: jest.fn(),
    deliverOrder: jest.fn(),
    cancelOrder: jest.fn(),
    approveOrder: jest.fn(),
    rejectOrder: jest.fn(),
    getOrderProgressByExternalId: jest.fn()
  };
  return {
    getOrderApplicationService: () => mockOrderSvc,
    getAuthApplicationService: () => ({ login: jest.fn(), register: jest.fn() })
  };
});

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../../src/app');
const config = require('../../../src/config');
const container = require('../../../src/infrastructure/container/Container');
const { ValidationError } = require('../../../src/utils/validation');

const staff = `Bearer ${jwt.sign({ sub: 1, role: 'ATTENDANT' }, config.JWT_SECRET)}`;
const client = (sub = 1) => `Bearer ${jwt.sign({ sub, role: 'CLIENT' }, config.JWT_SECRET)}`;

let svc;
beforeEach(() => {
  svc = container.getOrderApplicationService();
});

const SAMPLE = { id: 1, externalId: 'ext-1', status: 'RECEBIDA' };

describe('Rotas de OS (staff)', () => {
  it('POST /api/orders abre OS e inicia a saga', async () => {
    svc.createOrder.mockResolvedValue({ ...SAMPLE, saga: { status: 'RUNNING' } });
    const res = await request(app).post('/api/orders').set('Authorization', staff)
      .send({ description: 'x', vehicleId: 1, clientPFId: 1, services: [{ serviceId: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/saga iniciada/);
  });

  it.each([
    [{ vehicleId: 1, clientPFId: 1 }, 'Descrição e veículo são obrigatórios.'],
    [{ description: 'x', vehicleId: 1 }, 'Cliente PF ou PJ deve ser informado.']
  ])('POST /api/orders valida payload (%#)', async (body, message) => {
    const res = await request(app).post('/api/orders').set('Authorization', staff).send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
  });

  it('POST /api/orders converte ValidationError em 400', async () => {
    svc.createOrder.mockRejectedValue(new ValidationError('Serviço 9 não encontrado'));
    const res = await request(app).post('/api/orders').set('Authorization', staff)
      .send({ description: 'x', vehicleId: 1, clientPFId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Serviço 9 não encontrado');
  });

  it('GET /api/orders pagina e filtra', async () => {
    svc.listOrders.mockResolvedValue({ data: [], total: 0 });
    await request(app).get('/api/orders?status=RECEBIDA&page=2&limit=5').set('Authorization', staff).expect(200);
    expect(svc.listOrders).toHaveBeenCalledWith({ status: 'RECEBIDA', page: 2, limit: 5 });
    await request(app).get('/api/orders').set('Authorization', staff).expect(200);
    expect(svc.listOrders).toHaveBeenLastCalledWith({ status: undefined, page: 1, limit: 20 });
  });

  it.each([
    ['get', '/api/orders/1', 'getOrder'],
    ['get', '/api/orders/1/history', 'getOrderHistory'],
    ['get', '/api/orders/1/progress', 'getOrderProgress'],
    ['post', '/api/orders/1/deliver', 'deliverOrder'],
    ['post', '/api/orders/1/cancel', 'cancelOrder']
  ])('%s %s → 200 e 404', async (method, path, fn) => {
    svc[fn].mockResolvedValueOnce(SAMPLE);
    const ok = await request(app)[method](path).set('Authorization', staff).send({ reason: 'teste' });
    expect(ok.status).toBe(200);

    svc[fn].mockResolvedValueOnce(null);
    const notFound = await request(app)[method](path).set('Authorization', staff).send({});
    expect(notFound.status).toBe(404);
  });

  it('cancelamento repassa o motivo', async () => {
    svc.cancelOrder.mockResolvedValue(SAMPLE);
    await request(app).post('/api/orders/7/cancel').set('Authorization', staff).send({ reason: 'desistiu' });
    expect(svc.cancelOrder).toHaveBeenCalledWith(7, 'desistiu');
  });

  it('erro inesperado vira 500 sem vazar detalhes', async () => {
    svc.getOrder.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/api/orders/1').set('Authorization', staff);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Erro interno do servidor.');
  });
});

describe('Rotas /api/track (cliente autenticado por CPF)', () => {
  it('GET exige role CLIENT e restringe ao dono', async () => {
    svc.getOrderProgressByExternalId.mockResolvedValue({ status: 'AGUARDANDO_PAGAMENTO' });
    await request(app).get('/api/track/ext-1').set('Authorization', staff).expect(403);
    await request(app).get('/api/track/ext-1').set('Authorization', client(7)).expect(200);
    expect(svc.getOrderProgressByExternalId).toHaveBeenCalledWith('ext-1', 7);

    svc.getOrderProgressByExternalId.mockResolvedValue(null);
    await request(app).get('/api/track/ext-1').set('Authorization', client()).expect(404);
  });

  it('POST approve', async () => {
    svc.approveOrder.mockResolvedValueOnce(SAMPLE);
    const res = await request(app).post('/api/track/ext-1/approve').set('Authorization', client());
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Mercado Pago/);

    svc.approveOrder.mockResolvedValueOnce(null);
    await request(app).post('/api/track/ext-1/approve').set('Authorization', client()).expect(404);
  });

  it('POST approve fora da etapa → 400', async () => {
    svc.approveOrder.mockRejectedValue(new ValidationError('Ordem não está aguardando aprovação.'));
    await request(app).post('/api/track/ext-1/approve').set('Authorization', client()).expect(400);
  });

  it('POST reject repassa motivo', async () => {
    svc.rejectOrder.mockResolvedValueOnce(SAMPLE);
    await request(app).post('/api/track/ext-1/reject').set('Authorization', client(3)).send({ reason: 'caro' }).expect(200);
    expect(svc.rejectOrder).toHaveBeenCalledWith('ext-1', 3, 'caro');

    svc.rejectOrder.mockResolvedValueOnce(null);
    await request(app).post('/api/track/ext-1/reject').set('Authorization', client()).expect(404);
  });
});

describe('App', () => {
  it('GET /health não exige autenticação', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('os-service');
  });

  it('JSON inválido → 400', async () => {
    const res = await request(app).post('/api/orders').set('Authorization', staff)
      .set('Content-Type', 'application/json').send('{"x":');
    expect(res.status).toBe(400);
  });

  it('serve o Swagger em /api-docs', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
  });
});
