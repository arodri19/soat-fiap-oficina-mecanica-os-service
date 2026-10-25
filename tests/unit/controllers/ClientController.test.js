jest.mock('../../../src/middlewares/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, role: 'ATTENDANT' };
    next();
  },
  authorize: () => (req, res, next) => next()
}));

jest.mock('../../../src/infrastructure/container/Container', () => {
  const mockService = {
    createClientPF: jest.fn(),
    listClientsPF: jest.fn(),
    getClientPF: jest.fn(),
    updateClientPF: jest.fn(),
    deleteClientPF: jest.fn(),
    createClientPJ: jest.fn(),
    listClientsPJ: jest.fn(),
    getClientPJ: jest.fn(),
    updateClientPJ: jest.fn(),
    deleteClientPJ: jest.fn()
  };
  return {
    getClientApplicationService: () => mockService,
    getAuthApplicationService: () => ({ login: jest.fn(), register: jest.fn() })
  };
});

const request = require('supertest');
const app = require('../../../src/app');
const container = require('../../../src/infrastructure/container/Container');

let svc;
beforeEach(() => {
  svc = container.getClientApplicationService();
  jest.clearAllMocks();
});

const PF_PAYLOAD = {
  name: 'João Silva',
  cpf: '529.982.247-25',
  email: 'joao@example.com',
  address: 'Rua A',
  number: '10',
  state: 'SP',
  cep: '01310100'
};

const PF_RESPONSE = { id: 1, ...PF_PAYLOAD };

const PJ_PAYLOAD = {
  name: 'Empresa X',
  fantasyName: 'EmpX',
  companyName: 'Empresa X LTDA',
  cnpj: '11.222.333/0001-81',
  email: 'empresa@x.com',
  address: 'Av. Principal',
  number: '100',
  state: 'SP',
  cep: '01310100',
  legalResponsible: 'Maria'
};

const PJ_RESPONSE = { id: 1, ...PJ_PAYLOAD };

// ─── Cliente PF ──────────────────────────────────────────────────────────────

describe('POST /api/clients/pf', () => {
  it('cria cliente PF e retorna 201', async () => {
    svc.createClientPF.mockResolvedValue(PF_RESPONSE);
    const res = await request(app).post('/api/clients/pf').send(PF_PAYLOAD);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(svc.createClientPF).toHaveBeenCalledWith(
      PF_PAYLOAD.name, PF_PAYLOAD.cpf, PF_PAYLOAD.email,
      PF_PAYLOAD.address, PF_PAYLOAD.number, PF_PAYLOAD.state, PF_PAYLOAD.cep
    );
  });

  it('propaga erro de CPF duplicado como 500 (tratado pela camada de domínio)', async () => {
    svc.createClientPF.mockRejectedValue(new Error('CPF já cadastrado'));
    const res = await request(app).post('/api/clients/pf').send(PF_PAYLOAD);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/clients/pf', () => {
  it('lista clientes PF com 200', async () => {
    svc.listClientsPF.mockResolvedValue([PF_RESPONSE]);
    const res = await request(app).get('/api/clients/pf');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /api/clients/pf/:id', () => {
  it('retorna cliente PF existente com 200', async () => {
    svc.getClientPF.mockResolvedValue(PF_RESPONSE);
    const res = await request(app).get('/api/clients/pf/1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });

  it('retorna 404 quando cliente não encontrado', async () => {
    svc.getClientPF.mockRejectedValue(new Error('Cliente não encontrado'));
    const res = await request(app).get('/api/clients/pf/999');
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/clients/pf/:id', () => {
  it('atualiza cliente PF e retorna 200', async () => {
    svc.updateClientPF.mockResolvedValue({ ...PF_RESPONSE, name: 'João Atualizado' });
    const res = await request(app).put('/api/clients/pf/1').send({ name: 'João Atualizado' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('João Atualizado');
  });
});

describe('DELETE /api/clients/pf/:id', () => {
  it('remove cliente PF e retorna 204', async () => {
    svc.deleteClientPF.mockResolvedValue({ deleted: true });
    const res = await request(app).delete('/api/clients/pf/1');
    expect(res.status).toBe(204);
  });
});

// ─── Cliente PJ ──────────────────────────────────────────────────────────────

describe('POST /api/clients/pj', () => {
  it('cria cliente PJ e retorna 201', async () => {
    svc.createClientPJ.mockResolvedValue(PJ_RESPONSE);
    const res = await request(app).post('/api/clients/pj').send(PJ_PAYLOAD);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
  });

  it('propaga erro de CNPJ duplicado', async () => {
    svc.createClientPJ.mockRejectedValue(new Error('CNPJ já cadastrado'));
    const res = await request(app).post('/api/clients/pj').send(PJ_PAYLOAD);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/clients/pj', () => {
  it('lista clientes PJ com 200', async () => {
    svc.listClientsPJ.mockResolvedValue([PJ_RESPONSE]);
    const res = await request(app).get('/api/clients/pj');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /api/clients/pj/:id', () => {
  it('retorna cliente PJ existente com 200', async () => {
    svc.getClientPJ.mockResolvedValue(PJ_RESPONSE);
    const res = await request(app).get('/api/clients/pj/1');
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/clients/pj/:id', () => {
  it('atualiza cliente PJ e retorna 200', async () => {
    svc.updateClientPJ.mockResolvedValue({ ...PJ_RESPONSE, name: 'Empresa Y' });
    const res = await request(app).put('/api/clients/pj/1').send({ name: 'Empresa Y' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Empresa Y');
  });
});

describe('DELETE /api/clients/pj/:id', () => {
  it('remove cliente PJ e retorna 204', async () => {
    svc.deleteClientPJ.mockResolvedValue({ deleted: true });
    const res = await request(app).delete('/api/clients/pj/1');
    expect(res.status).toBe(204);
  });
});
