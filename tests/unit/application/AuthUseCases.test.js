const { LoginUseCase, RegisterUseCase } = require('../../../src/application/use-cases/AuthUseCases');
const Email = require('../../../src/domain/value-objects/Email');
const Password = require('../../../src/domain/value-objects/Password');

describe('Auth Use Cases', () => {
  let mockAuthDomainService;
  let mockUser;

  beforeEach(async () => {
    mockUser = {
      id: 1,
      name: 'João Silva',
      email: new Email('joao@email.com'),
      password: await Password.create('Senha123'),
      role: 'ATTENDANT'
    };

    mockAuthDomainService = {
      authenticate: jest.fn(),
      generateToken: jest.fn(),
      register: jest.fn()
    };
  });

  describe('LoginUseCase', () => {
    it('deve executar login com sucesso', async () => {
      const loginRequest = { email: 'joao@email.com', password: 'Senha123' };
      const expectedToken = 'jwt.token.here';

      mockAuthDomainService.authenticate.mockResolvedValue(mockUser);
      mockAuthDomainService.generateToken.mockReturnValue(expectedToken);

      const loginUseCase = new LoginUseCase(mockAuthDomainService);
      const result = await loginUseCase.execute(loginRequest);

      expect(mockAuthDomainService.authenticate).toHaveBeenCalledWith(
        expect.any(Email),
        'Senha123'
      );
      expect(mockAuthDomainService.generateToken).toHaveBeenCalledWith(mockUser);
      expect(result.token).toBe(expectedToken);
      expect(result.user.email).toBe('joao@email.com');
      expect(result.user.name).toBe('João Silva');
      expect(result.user.role).toBe('ATTENDANT');
    });

    it('deve propagar erro de autenticação', async () => {
      const loginRequest = { email: 'joao@email.com', password: 'SenhaErrada' };

      mockAuthDomainService.authenticate.mockRejectedValue(new Error('Credenciais inválidas'));

      const loginUseCase = new LoginUseCase(mockAuthDomainService);

      await expect(loginUseCase.execute(loginRequest)).rejects.toThrow('Credenciais inválidas');
    });
  });

  describe('RegisterUseCase', () => {
    it('deve executar registro com sucesso', async () => {
      const registerRequest = {
        name: 'João Silva',
        email: 'joao@email.com',
        password: 'Senha123',
        role: 'ATTENDANT'
      };

      mockAuthDomainService.register.mockResolvedValue(mockUser);

      const registerUseCase = new RegisterUseCase(mockAuthDomainService);
      const result = await registerUseCase.execute(registerRequest);

      expect(mockAuthDomainService.register).toHaveBeenCalledWith(
        'João Silva',
        expect.any(Email),
        expect.any(Password),
        'ATTENDANT'
      );
      expect(result.id).toBe(1);
      expect(result.name).toBe('João Silva');
      expect(result.email).toBe('joao@email.com');
      expect(result.role).toBe('ATTENDANT');
    });

    it('deve propagar erro de registro', async () => {
      const registerRequest = {
        name: 'João Silva',
        email: 'joao@email.com',
        password: 'Senha123',
        role: 'ATTENDANT'
      };

      mockAuthDomainService.register.mockRejectedValue(new Error('Email já cadastrado'));

      const registerUseCase = new RegisterUseCase(mockAuthDomainService);

      await expect(registerUseCase.execute(registerRequest)).rejects.toThrow('Email já cadastrado');
    });
  });
});