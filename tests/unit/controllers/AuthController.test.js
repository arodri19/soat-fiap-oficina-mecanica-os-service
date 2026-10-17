const request = require('supertest');
const app = require('../../../src/app');

// Mock the container to use test-specific implementations
jest.mock('../../../src/infrastructure/container/Container', () => {
  const mockUserRepository = {
    findByEmail: jest.fn(),
    create: jest.fn()
  };

  const mockAuthApplicationService = {
    login: jest.fn(),
    register: jest.fn()
  };

  return {
    getUserRepository: () => mockUserRepository,
    getAuthApplicationService: () => mockAuthApplicationService
  };
});

const container = require('../../../src/infrastructure/container/Container');

describe('Auth Controller Integration', () => {
  let mockAuthService;

  beforeEach(() => {
    mockAuthService = container.getAuthApplicationService();
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('deve fazer login com sucesso', async () => {
      const loginResponse = {
        token: 'jwt.token.here',
        user: {
          email: 'joao@email.com',
          name: 'João Silva',
          role: 'ATTENDANT'
        }
      };

      mockAuthService.login.mockResolvedValue(loginResponse);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'joao@email.com', password: 'Senha123' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(loginResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith('joao@email.com', 'Senha123');
    });

    it('deve retornar erro 401 para credenciais inválidas', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Credenciais inválidas'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'joao@email.com', password: 'SenhaErrada' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Credenciais inválidas');
    });

    it('deve validar campos obrigatórios no login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('email');
    });

    it('deve validar formato do email no login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid-email', password: 'Senha123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('email');
    });
  });

  describe('POST /api/auth/register', () => {
    it('deve registrar usuário com sucesso', async () => {
      const registerResponse = {
        id: 1,
        name: 'João Silva',
        email: 'joao@email.com',
        role: 'ATTENDANT'
      };

      mockAuthService.register.mockResolvedValue(registerResponse);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'João Silva',
          email: 'joao@email.com',
          password: 'Senha123',
          role: 'ATTENDANT'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(registerResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith('João Silva', 'joao@email.com', 'Senha123', 'ATTENDANT');
    });

    it('deve retornar erro 409 para email já cadastrado', async () => {
      mockAuthService.register.mockRejectedValue(new Error('Email já cadastrado'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'João Silva',
          email: 'joao@email.com',
          password: 'Senha123',
          role: 'ATTENDANT'
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Email já cadastrado');
    });

    it('deve validar campos obrigatórios no registro', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('name');
    });

    it('deve validar role no registro', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'João Silva',
          email: 'joao@email.com',
          password: 'Senha123',
          role: 'INVALID_ROLE'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('role');
    });
  });
});