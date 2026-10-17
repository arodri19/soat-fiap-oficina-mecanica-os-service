const crud = () => ({
  create: jest.fn().mockResolvedValue({ id: 1 }),
  list: jest.fn().mockResolvedValue([{ id: 1 }]),
  get: jest.fn(),
  update: jest.fn().mockResolvedValue({ id: 1, updated: true }),
  remove: jest.fn().mockResolvedValue({})
});

jest.mock('../../../src/services/vehicle.service', () => {
  const m = crud();
  return { createVehicle: m.create, listVehicles: m.list, getVehicle: m.get, updateVehicle: m.update, deleteVehicle: m.remove };
});
jest.mock('../../../src/services/part.service', () => {
  const m = crud();
  return { createPart: m.create, listParts: m.list, getPart: m.get, updatePart: m.update, deletePart: m.remove };
});
jest.mock('../../../src/services/service.service', () => {
  const m = crud();
  return { createService: m.create, listServices: m.list, getService: m.get, updateService: m.update, deleteService: m.remove };
});
jest.mock('../../../src/services/metrics.service', () => ({
  getAverageExecutionTime: jest.fn().mockResolvedValue({ averageMinutes: 10 }),
  recomputeStatusDurationAverages: jest.fn().mockResolvedValue([{ fromStatus: 'RECEBIDA' }])
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../../src/app');
const config = require('../../../src/config');

const auth = `Bearer ${jwt.sign({ sub: 1, role: 'ATTENDANT' }, config.JWT_SECRET)}`;

const resources = [
  ['vehicles', require('../../../src/services/vehicle.service').getVehicle],
  ['parts', require('../../../src/services/part.service').getPart],
  ['services', require('../../../src/services/service.service').getService]
];

describe.each(resources)('CRUD /api/%s', (resource, getFn) => {
  it('cria, lista, atualiza e remove', async () => {
    await request(app).post(`/api/${resource}`).set('Authorization', auth).send({ name: 'x' }).expect(201);
    const list = await request(app).get(`/api/${resource}`).set('Authorization', auth).expect(200);
    expect(list.body).toEqual([{ id: 1 }]);
    await request(app).put(`/api/${resource}/1`).set('Authorization', auth).send({ name: 'y' }).expect(200);
    await request(app).delete(`/api/${resource}/1`).set('Authorization', auth).expect(204);
  });

  it('get retorna 200 ou 404', async () => {
    getFn.mockResolvedValueOnce({ id: 1 });
    await request(app).get(`/api/${resource}/1`).set('Authorization', auth).expect(200);
    getFn.mockResolvedValueOnce(null);
    await request(app).get(`/api/${resource}/2`).set('Authorization', auth).expect(404);
  });
});

describe('Métricas', () => {
  it('GET average-execution-time e POST recompute', async () => {
    await request(app).get('/api/metrics/average-execution-time').set('Authorization', auth).expect(200);
    const res = await request(app).post('/api/metrics/status-duration-averages/recompute').set('Authorization', auth);
    expect(res.status).toBe(200);
  });
});
