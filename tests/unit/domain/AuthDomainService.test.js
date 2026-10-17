const AuthDomainService = require('../../../src/domain/services/AuthDomainService');
const Email = require('../../../src/domain/value-objects/Email');
const Password = require('../../../src/domain/value-objects/Password');

describe('AuthDomainService', () => {
  let mockUserRepository;
  let authDomainService;
  let mockUser;

  beforeEach(async () => {
    mockUser = {
      id: 1,
      name: 'João Silva',
      email: new Email('joao@email.com'),
      password: await Password.create('Senha123'),
      role: 'ATTENDANT'
    };

    mockUserRepository = {
      findByEmail: jest.fn(),
      create: jest.fn()
    };

    authDomainService = new AuthDomainService(mockUserRepository);
  });

  describe('authenticate', () => {
    it('deve autenticar usuário com credenciais válidas', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const email = new Email('joao@email.com');
      const result = await authDomainService.authenticate(email, 'Senha123');

      expect(result).toBe(mockUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
    });

    it('deve lançar erro para usuário não encontrado', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const email = new Email('naoexiste@email.com');

      await expect(authDomainService.authenticate(email, 'Senha123')).rejects.toThrow('Credenciais inválidas');
    });

    it('deve lançar erro para senha incorreta', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const email = new Email('joao@email.com');

      await expect(authDomainService.authenticate(email, 'SenhaErrada')).rejects.toThrow('Credenciais inválidas');
    });
  });

  describe('generateToken', () => {
    it('deve gerar token JWT válido', () => {
      const token = authDomainService.generateToken(mockUser);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT tem 3 partes separadas por .
    });
  });

  describe('register', () => {
    it('deve registrar novo usuário', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockUser);

      const name = 'João Silva';
      const email = new Email('joao@email.com');
      const password = await Password.create('Senha123');
      const role = 'ATTENDANT';

      const result = await authDomainService.register(name, email, password, role);

      expect(result).toBe(mockUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(mockUserRepository.create).toHaveBeenCalledWith(name, email, password, role);
    });

    it('deve lançar erro para email já cadastrado', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const name = 'João Silva';
      const email = new Email('joao@email.com');
      const password = await Password.create('Senha123');
      const role = 'ATTENDANT';

      await expect(authDomainService.register(name, email, password, role)).rejects.toThrow('Email já cadastrado');
    });
  });
});