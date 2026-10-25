const AuthApplicationService = require('../../../src/application/services/AuthApplicationService');

describe('AuthApplicationService', () => {
  let mockUserRepository;
  let authService;
  let mockUser;

  beforeEach(() => {
    mockUser = {
      id: 1,
      name: 'João Silva',
      email: { toString: () => 'joao@email.com' },
      password: { compare: jest.fn() },
      role: 'ATTENDANT'
    };

    mockUserRepository = {
      findByEmail: jest.fn(),
      create: jest.fn()
    };

    authService = new AuthApplicationService(mockUserRepository);
  });

  describe('login', () => {
    it('deve fazer login com sucesso', async () => {
      // Mock repository methods that domain service uses
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUser.password.compare.mockResolvedValue(true);

      // Mock the token generation
      const mockAuthDomainService = authService.authDomainService;
      mockAuthDomainService.generateToken = jest.fn().mockReturnValue('jwt.token.here');

      const result = await authService.login('joao@email.com', 'Senha123');

      expect(mockUserRepository.findByEmail).toHaveBeenCalled();
      expect(mockUser.password.compare).toHaveBeenCalledWith('Senha123');
      expect(mockAuthDomainService.generateToken).toHaveBeenCalledWith(mockUser);
      expect(result.token).toBe('jwt.token.here');
      expect(result.user.email).toBe('joao@email.com');
    });

    it('deve propagar erro de login', async () => {
      const mockAuthDomainService = {
        authenticate: jest.fn().mockRejectedValue(new Error('Credenciais inválidas'))
      };
      authService.authDomainService = mockAuthDomainService;

      await expect(authService.login('joao@email.com', 'SenhaErrada')).rejects.toThrow('Credenciais inválidas');
    });
  });

  describe('register', () => {
    it('deve registrar usuário com sucesso', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockUser);

      const mockAuthDomainService = {
        register: jest.fn().mockResolvedValue(mockUser)
      };
      authService.authDomainService = mockAuthDomainService;

      const result = await authService.register('João Silva', 'joao@email.com', 'Senha123', 'ATTENDANT');

      expect(result.id).toBe(1);
      expect(result.name).toBe('João Silva');
      expect(result.email).toBe('joao@email.com');
      expect(result.role).toBe('ATTENDANT');
    });

    it('deve propagar erro de registro', async () => {
      // Mock repository to return existing user
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.register('João Silva', 'joao@email.com', 'Senha123', 'ATTENDANT')).rejects.toThrow('Email já cadastrado');
    });
  });
});