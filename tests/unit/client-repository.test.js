const jestMock = require('jest-mock');
const mockPrisma = {
  clientPF: {
    create: jestMock.fn(),
    findUnique: jestMock.fn(),
    findMany: jestMock.fn(),
    update: jestMock.fn(),
    delete: jestMock.fn()
  },
  clientPJ: {
    create: jestMock.fn(),
    findUnique: jestMock.fn(),
    findMany: jestMock.fn(),
    update: jestMock.fn(),
    delete: jestMock.fn()
  }
};

jest.unmock('../../src/prisma');
jest.mock('../../src/prisma', () => mockPrisma);

const PrismaClientRepository = require('../../src/infrastructure/repositories/PrismaClientRepository');
const { ClientPF, ClientPJ } = require('../../src/domain/entities/Client');
const { CPF, CNPJ } = require('../../src/domain/value-objects/Document');

describe('PrismaClientRepository', () => {
  let repository;

  beforeEach(() => {
    mockPrisma.clientPF.create.mockReset();
    mockPrisma.clientPF.findUnique.mockReset();
    mockPrisma.clientPF.findMany.mockReset();
    mockPrisma.clientPF.update.mockReset();
    mockPrisma.clientPF.delete.mockReset();
    mockPrisma.clientPJ.create.mockReset();
    mockPrisma.clientPJ.findUnique.mockReset();
    mockPrisma.clientPJ.findMany.mockReset();
    mockPrisma.clientPJ.update.mockReset();
    mockPrisma.clientPJ.delete.mockReset();

    repository = new PrismaClientRepository();
  });

  describe('createClientPF', () => {
    it('should create client PF successfully', async () => {
      const client = ClientPF.create({ name: 'João Silva', cpf: new CPF('12345678909'), email: 'joao@email.com', address: 'Rua A, 123', number: '123', state: 'SP', cep: '01234567' });
      const createdData = {
        id: 1,
        name: 'João Silva',
        cpf: '12345678909',
        email: 'joao@email.com',
        address: 'Rua A, 123',
        number: '123',
        state: 'SP',
        cep: '01234567',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clientPF.create.mockResolvedValue(createdData);

      const result = await repository.createClientPF(client);

      expect(mockPrisma.clientPF.create).toHaveBeenCalledWith({
        data: {
          name: 'João Silva',
          cpf: '12345678909',
          email: 'joao@email.com',
          address: 'Rua A, 123',
          number: '123',
          state: 'SP',
          cep: '01234567'
        }
      });
      expect(result.id).toBe(1);
      expect(result.number).toBe('123');
      expect(result.state).toBe('SP');
      expect(result.cep).toBe('01234567');
    });
  });

  describe('findClientPFById', () => {
    it('should find client PF by id', async () => {
      const clientData = {
        id: 1,
        name: 'João Silva',
        cpf: '12345678909',
        email: 'joao@email.com',
        address: 'Rua A, 123',
        number: '123',
        state: 'SP',
        cep: '01234567',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clientPF.findUnique.mockResolvedValue(clientData);

      const result = await repository.findClientPFById(1);

      expect(mockPrisma.clientPF.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { vehicles: true }
      });
      expect(result.id).toBe(1);
      expect(result.number).toBe('123');
      expect(result.state).toBe('SP');
      expect(result.cep).toBe('01234567');
    });

    it('should return null if client not found', async () => {
      mockPrisma.clientPF.findUnique.mockResolvedValue(null);

      const result = await repository.findClientPFById(1);

      expect(result).toBeNull();
    });
  });

  describe('findClientPFByCPF', () => {
    it('should find client PF by CPF', async () => {
      const cpf = new CPF('12345678909');
      const clientData = {
        id: 1,
        name: 'João Silva',
        cpf: '12345678909',
        email: 'joao@email.com',
        address: 'Rua A, 123',
        number: '123',
        state: 'SP',
        cep: '01234567',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clientPF.findUnique.mockResolvedValue(clientData);

      const result = await repository.findClientPFByCPF(cpf);

      expect(mockPrisma.clientPF.findUnique).toHaveBeenCalledWith({
        where: { cpf: '12345678909' }
      });
      expect(result.id).toBe(1);
    });
  });

  describe('listClientsPF', () => {
    it('should list all clients PF', async () => {
      const clientsData = [
        {
          id: 1,
          name: 'João Silva',
          cpf: '12345678909',
          email: 'joao@email.com',
          address: 'Rua A, 123',
          number: '123',
          state: 'SP',
          cep: '01234567',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 2,
          name: 'Maria Santos',
          cpf: '98765432100',
          email: 'maria@email.com',
          address: 'Rua B, 456',
          number: '456',
          state: 'RJ',
          cep: '12345678',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.clientPF.findMany.mockResolvedValue(clientsData);

      const result = await repository.listClientsPF();

      expect(mockPrisma.clientPF.findMany).toHaveBeenCalledWith({
        include: { vehicles: true },
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toHaveLength(2);
      expect(result[0].number).toBe('123');
      expect(result[1].state).toBe('RJ');
    });
  });

  describe('updateClientPF', () => {
    it('should update client PF successfully', async () => {
      const client = ClientPF.create({ name: 'João Silva Atualizado', cpf: new CPF('12345678909'), email: 'joao@email.com', address: 'Rua A, 123', number: '123', state: 'SP', cep: '01234567' });
      const updatedData = {
        id: 1,
        name: 'João Silva Atualizado',
        cpf: '12345678909',
        email: 'joao@email.com',
        address: 'Rua A, 123',
        number: '123',
        state: 'SP',
        cep: '01234567',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clientPF.update.mockResolvedValue(updatedData);

      const result = await repository.updateClientPF(1, client);

      expect(mockPrisma.clientPF.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: 'João Silva Atualizado',
          email: 'joao@email.com',
          address: 'Rua A, 123',
          number: '123',
          state: 'SP',
          cep: '01234567'
        }
      });
      expect(result.name).toBe('João Silva Atualizado');
    });
  });

  describe('deleteClientPF', () => {
    it('should delete client PF successfully', async () => {
      mockPrisma.clientPF.delete.mockResolvedValue({ id: 1 });

      await repository.deleteClientPF(1);

      expect(mockPrisma.clientPF.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('createClientPJ', () => {
    it('should create client PJ successfully', async () => {
      const client = ClientPJ.create({ name: 'Empresa XYZ', fantasyName: 'Empresa XYZ Ltda', companyName: 'Empresa XYZ Ltda', cnpj: new CNPJ('12345678000195'), email: 'contato@empresa.com', address: 'Av. Paulista, 1000', number: '1000', state: 'SP', cep: '01310100', legalResponsible: 'João Silva' });
      const createdData = {
        id: 1,
        name: 'Empresa XYZ',
        fantasyName: 'Empresa XYZ Ltda',
        companyName: 'Empresa XYZ Ltda',
        cnpj: '12345678000195',
        email: 'contato@empresa.com',
        address: 'Av. Paulista, 1000',
        number: '1000',
        state: 'SP',
        cep: '01310100',
        legalResponsible: 'João Silva',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clientPJ.create.mockResolvedValue(createdData);

      const result = await repository.createClientPJ(client);

      expect(mockPrisma.clientPJ.create).toHaveBeenCalledWith({
        data: {
          name: 'Empresa XYZ',
          fantasyName: 'Empresa XYZ Ltda',
          companyName: 'Empresa XYZ Ltda',
          cnpj: '12345678000195',
          email: 'contato@empresa.com',
          address: 'Av. Paulista, 1000',
          number: '1000',
          state: 'SP',
          cep: '01310100',
          legalResponsible: 'João Silva'
        }
      });
      expect(result.id).toBe(1);
      expect(result.fantasyName).toBe('Empresa XYZ Ltda');
    });
  });

  describe('findClientPJById', () => {
    it('should find client PJ by id', async () => {
      const clientData = {
        id: 1,
        name: 'Empresa XYZ',
        fantasyName: 'Empresa XYZ Ltda',
        companyName: 'Empresa XYZ Ltda',
        cnpj: '12345678000195',
        email: 'contato@empresa.com',
        address: 'Av. Paulista, 1000',
        number: '1000',
        state: 'SP',
        cep: '01310100',
        legalResponsible: 'João Silva',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clientPJ.findUnique.mockResolvedValue(clientData);

      const result = await repository.findClientPJById(1);

      expect(mockPrisma.clientPJ.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result.id).toBe(1);
      expect(result.fantasyName).toBe('Empresa XYZ Ltda');
    });
  });

  describe('findClientPJByCNPJ', () => {
    it('should find client PJ by CNPJ', async () => {
      const cnpj = new CNPJ('12345678000195');
      const clientData = {
        id: 1,
        name: 'Empresa XYZ',
        fantasyName: 'Empresa XYZ Ltda',
        companyName: 'Empresa XYZ Ltda',
        cnpj: '12345678000195',
        email: 'contato@empresa.com',
        address: 'Av. Paulista, 1000',
        number: '1000',
        state: 'SP',
        cep: '01310100',
        legalResponsible: 'João Silva',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clientPJ.findUnique.mockResolvedValue(clientData);

      const result = await repository.findClientPJByCNPJ(cnpj);

      expect(mockPrisma.clientPJ.findUnique).toHaveBeenCalledWith({ where: { cnpj: '12345678000195' } });
      expect(result.id).toBe(1);
      expect(result.companyName).toBe('Empresa XYZ Ltda');
    });
  });

  describe('listClientsPJ', () => {
    it('should list all clients PJ', async () => {
      const data = [
        {
          id: 1,
          name: 'Empresa XYZ',
          fantasyName: 'Empresa XYZ Ltda',
          companyName: 'Empresa XYZ Ltda',
          cnpj: '12345678000195',
          email: 'contato@empresa.com',
          address: 'Av. Paulista, 1000',
          number: '1000',
          state: 'SP',
          cep: '01310100',
          legalResponsible: 'João Silva',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.clientPJ.findMany.mockResolvedValue(data);

      const result = await repository.listClientsPJ();

      expect(mockPrisma.clientPJ.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
      expect(result).toHaveLength(1);
      expect(result[0].fantasyName).toBe('Empresa XYZ Ltda');
    });
  });

  describe('updateClientPJ', () => {
    it('should update client PJ successfully', async () => {
      const client = ClientPJ.create({ name: 'Empresa XYZ', fantasyName: 'Empresa XYZ Ltda', companyName: 'Empresa XYZ Ltda', cnpj: new CNPJ('12345678000195'), email: 'contato@empresa.com', address: 'Av. Paulista, 1000', number: '1000', state: 'SP', cep: '01310100', legalResponsible: 'João Silva' });
      const updatedData = {
        id: 1,
        name: 'Empresa XYZ',
        fantasyName: 'Empresa XYZ Ltda',
        companyName: 'Empresa XYZ Atualizada',
        cnpj: '12345678000195',
        email: 'contato@empresa.com',
        address: 'Av. Paulista, 1000',
        number: '1000',
        state: 'SP',
        cep: '01310100',
        legalResponsible: 'João Silva',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clientPJ.update.mockResolvedValue(updatedData);

      const result = await repository.updateClientPJ(1, client);

      expect(mockPrisma.clientPJ.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: 'Empresa XYZ',
          fantasyName: 'Empresa XYZ Ltda',
          companyName: 'Empresa XYZ Ltda',
          email: 'contato@empresa.com',
          address: 'Av. Paulista, 1000',
          number: '1000',
          state: 'SP',
          cep: '01310100',
          legalResponsible: 'João Silva'
        }
      });
      expect(result.companyName).toBe('Empresa XYZ Atualizada');
    });
  });

  describe('deleteClientPJ', () => {
    it('should delete client PJ successfully', async () => {
      mockPrisma.clientPJ.delete.mockResolvedValue({ id: 1 });

      await repository.deleteClientPJ(1);

      expect(mockPrisma.clientPJ.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});