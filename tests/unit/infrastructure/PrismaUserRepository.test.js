const PrismaUserRepository = require('../../../src/infrastructure/repositories/PrismaUserRepository');
const Email = require('../../../src/domain/value-objects/Email');
const Password = require('../../../src/domain/value-objects/Password');

jest.mock('../../../src/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
}));

const prisma = require('../../../src/prisma');

describe('PrismaUserRepository', () => {
  let repository;
  let mockUserData;

  beforeEach(() => {
    repository = new PrismaUserRepository();
    mockUserData = {
      id: 1,
      name: 'João Silva',
      email: 'joao@email.com',
      password: '$2b$10$hashedpassword',
      role: 'ATTENDANT',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    };

    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('deve retornar usuário quando encontrado', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserData);

      const result = await repository.findById(1);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toBeInstanceOf(require('../../../src/domain/entities/User'));
      expect(result.id).toBe(1);
      expect(result.name).toBe('João Silva');
      expect(result.email).toBeInstanceOf(Email);
      expect(result.email.toString()).toBe('joao@email.com');
      expect(result.password).toBeInstanceOf(Password);
      expect(result.role).toBe('ATTENDANT');
    });

    it('deve retornar null quando usuário não encontrado', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('deve retornar usuário quando encontrado por email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserData);

      const email = new Email('joao@email.com');
      const result = await repository.findByEmail(email);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'joao@email.com' } });
      expect(result).toBeInstanceOf(require('../../../src/domain/entities/User'));
      expect(result.email.toString()).toBe('joao@email.com');
    });

    it('deve retornar null quando email não encontrado', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const email = new Email('naoexiste@email.com');
      const result = await repository.findByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('deve criar usuário com sucesso', async () => {
      prisma.user.create.mockResolvedValue(mockUserData);

      const name = 'João Silva';
      const email = new Email('joao@email.com');
      const password = Password.fromHash('$2b$10$hashedpassword');
      const role = 'ATTENDANT';

      const result = await repository.create(name, email, password, role);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'João Silva',
          email: 'joao@email.com',
          password: '$2b$10$hashedpassword',
          role: 'ATTENDANT'
        }
      });
      expect(result).toBeInstanceOf(require('../../../src/domain/entities/User'));
      expect(result.name).toBe('João Silva');
    });
  });

  describe('update', () => {
    it('deve atualizar usuário com sucesso', async () => {
      const updatedUserData = { ...mockUserData, name: 'João Santos' };
      prisma.user.update.mockResolvedValue(updatedUserData);

      const user = require('../../../src/domain/entities/User').create(
        'João Santos',
        'joao@email.com',
        '$2b$10$hashedpassword',
        'ATTENDANT'
      );

      const result = await repository.update(1, user);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: 'João Santos',
          email: 'joao@email.com',
          password: '$2b$10$hashedpassword',
          role: 'ATTENDANT'
        }
      });
      expect(result.name).toBe('João Santos');
    });
  });

  describe('delete', () => {
    it('deve deletar usuário com sucesso', async () => {
      prisma.user.delete.mockResolvedValue(mockUserData);

      await repository.delete(1);

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});