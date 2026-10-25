// Verifica que rotas internas (uso exclusivo de funcionário) rejeitam um JWT
// válido com role: "CLIENT" — o mesmo tipo de token emitido pela Lambda de
// autenticação por CPF (repositório serverless), assinado com o mesmo
// JWT_SECRET. Diferente dos outros testes de controller, aqui NÃO mockamos
// authenticate/authorize: é a autorização real (src/middlewares/auth.js +
// src/routes/index.js) que precisa ser exercitada, senão o teste não prova
// nada sobre a correção do Broken Function Level Authorization.

jest.mock('../../../src/infrastructure/container/Container', () => {
  const mockService = {
    listClientsPF: jest.fn().mockResolvedValue([]),
    createVehicle: jest.fn().mockResolvedValue({ id: 1 }),
    listOrders: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, pages: 0 })
  };
  return {
    getClientApplicationService: () => mockService,
    getVehicleApplicationService: () => mockService,
    getOrderApplicationService: () => mockService,
    getAuthApplicationService: () => ({ login: jest.fn(), register: jest.fn() })
  };
});

jest.mock('../../../src/services/vehicle.service', () => ({
  createVehicle: jest.fn().mockResolvedValue({ id: 1 })
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../../src/app');
const config = require('../../../src/config');

function tokenFor(role, sub = 1) {
  return jwt.sign({ sub, role }, config.JWT_SECRET, { expiresIn: '1h' });
}

describe('Rotas internas rejeitam token de CLIENT (Broken Function Level Authorization)', () => {
  const rotasInternas = [
    { method: 'get', path: '/api/clients/pf' },
    { method: 'post', path: '/api/vehicles' },
    { method: 'get', path: '/api/orders' }
  ];

  it.each(rotasInternas)('$method $path → 403 com role CLIENT', async ({ method, path }) => {
    const res = await request(app)[method](path)
      .set('Authorization', `Bearer ${tokenFor('CLIENT')}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it.each(rotasInternas)('$method $path → passa da autorização com role ATTENDANT', async ({ method, path }) => {
    const res = await request(app)[method](path)
      .set('Authorization', `Bearer ${tokenFor('ATTENDANT')}`)
      .send({});

    // Não valida 200 exato (alguns handlers têm particularidades de payload) —
    // só confirma que NÃO foi barrado em 403 pela autorização.
    expect(res.status).not.toBe(403);
  });

  it('rejeita sem token (401), antes mesmo de checar o role', async () => {
    const res = await request(app).get('/api/clients/pf');
    expect(res.status).toBe(401);
  });
});
