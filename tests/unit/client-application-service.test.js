const ClientApplicationService = require('../../src/application/services/ClientApplicationService');
const { ClientPF, ClientPJ } = require('../../src/domain/entities/Client');
const { CPF, CNPJ } = require('../../src/domain/value-objects/Document');

describe('ClientApplicationService', () => {
  let mockRepository;
  let service;

  beforeEach(() => {
    mockRepository = {
      createClientPF: jest.fn(),
      findClientPFById: jest.fn(),
      findClientPFByCPF: jest.fn(),
      listClientsPF: jest.fn(),
      updateClientPF: jest.fn(),
      deleteClientPF: jest.fn(),
      createClientPJ: jest.fn(),
      findClientPJById: jest.fn(),
      findClientPJByCNPJ: jest.fn(),
      listClientsPJ: jest.fn(),
      updateClientPJ: jest.fn(),
      deleteClientPJ: jest.fn()
    };

    service = new ClientApplicationService(mockRepository);
  });

  describe('createClientPF', () => {
    it('should create client PF successfully', async () => {
      const client = ClientPF.create({ name: 'João Silva', cpf: new CPF('12345678909'), email: 'joao@email.com', address: 'Rua A', number: '123', state: 'SP', cep: '12345678' });
      const savedClient = { ...client, id: 1 };

      mockRepository.findClientPFByCPF.mockResolvedValue(null);
      mockRepository.createClientPF.mockResolvedValue(savedClient);

      const result = await service.createClientPF('João Silva', '12345678909', 'joao@email.com', 'Rua A', '123', 'SP', '12345678');

      expect(mockRepository.createClientPF).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });
  });

  describe('getClientPF', () => {
    it('should get client PF successfully', async () => {
      const cpf = new CPF('12345678909');
      const client = ClientPF.create({ name: 'João Silva', cpf, email: 'joao@email.com', address: 'Rua A', number: '123', state: 'SP', cep: '12345678' });
      client.id = 1;

      mockRepository.findClientPFById.mockResolvedValue(client);

      const result = await service.getClientPF(1);

      expect(mockRepository.findClientPFById).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
      expect(result.name).toBe('João Silva');
      expect(result.cpf).toBe('123.456.789-09');
    });
  });

  describe('listClientsPF', () => {
    it('should list all clients PF', async () => {
      const cpf1 = new CPF('12345678909');
      const client1 = ClientPF.create({ name: 'João Silva', cpf: cpf1, email: 'joao@email.com', address: 'Rua A', number: '123', state: 'SP', cep: '12345678' });
      client1.id = 1;
      const cpf2 = new CPF('98765432100');
      const client2 = ClientPF.create({ name: 'Maria Santos', cpf: cpf2, email: 'maria@email.com', address: 'Rua B', number: '456', state: 'SP', cep: '87654321' });
      client2.id = 2;
      const clients = [client1, client2];

      mockRepository.listClientsPF.mockResolvedValue(clients);

      const result = await service.listClientsPF();

      expect(mockRepository.listClientsPF).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('João Silva');
      expect(result[0].cpf).toBe('123.456.789-09');
    });
  });

  describe('updateClientPF', () => {
    it('should update client PF successfully', async () => {
      const existingClient = ClientPF.create({ name: 'João Silva', cpf: new CPF('12345678909'), email: 'joao@email.com', address: 'Rua A, 123' });
      existingClient.id = 1;
      const updatedClient = { ...existingClient, name: 'João Silva Atualizado' };

      mockRepository.findClientPFById.mockResolvedValue(existingClient);
      mockRepository.updateClientPF.mockResolvedValue(updatedClient);

      const result = await service.updateClientPF(1, 'João Silva Atualizado', 'joao@email.com', '11999999999', 'Rua A, 123');

      expect(mockRepository.updateClientPF).toHaveBeenCalled();
      expect(result.name).toBe('João Silva Atualizado');
    });
  });

  describe('deleteClientPF', () => {
    it('should delete client PF successfully', async () => {
      const client = { id: 1, name: 'João Silva' };

      mockRepository.findClientPFById.mockResolvedValue(client);
      mockRepository.deleteClientPF.mockResolvedValue();

      await service.deleteClientPF(1);

      expect(mockRepository.deleteClientPF).toHaveBeenCalledWith(1);
    });
  });

  describe('createClientPJ', () => {
    it('should create client PJ successfully', async () => {
      const cnpj = new CNPJ('12345678000195');
      const client = ClientPJ.create({ name: 'Empresa XYZ', fantasyName: 'Empresa XYZ Ltda', companyName: 'Empresa XYZ Ltda', cnpj, email: 'contato@empresa.com', address: 'Av. Paulista', number: '1000', state: 'SP', cep: '01310100', legalResponsible: 'João Silva' });
      const savedClient = { ...client, id: 1 };

      mockRepository.findClientPJByCNPJ.mockResolvedValue(null);
      mockRepository.createClientPJ.mockResolvedValue(savedClient);

      const result = await service.createClientPJ({ name: 'Empresa XYZ', fantasyName: 'Empresa XYZ Ltda', companyName: 'Empresa XYZ Ltda', cnpj: '12345678000195', email: 'contato@empresa.com', address: 'Av. Paulista', number: '1000', state: 'SP', cep: '01310100', legalResponsible: 'João Silva' });

      expect(mockRepository.createClientPJ).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });
  });

  describe('getClientPJ', () => {
    it('should get client PJ successfully', async () => {
      const cnpj = new CNPJ('12345678000195');
      const client = ClientPJ.create({ name: 'Empresa XYZ', fantasyName: 'Empresa XYZ Ltda', companyName: 'Empresa XYZ Ltda', cnpj, email: 'contato@empresa.com', address: 'Av. Paulista', number: '1000', state: 'SP', cep: '01310100', legalResponsible: 'João Silva' });
      client.id = 1;

      mockRepository.findClientPJById.mockResolvedValue(client);

      const result = await service.getClientPJ(1);

      expect(mockRepository.findClientPJById).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
      expect(result.companyName).toBe('Empresa XYZ Ltda');
      expect(result.cnpj).toBe('12.345.678/0001-95');
    });
  });

  describe('listClientsPJ', () => {
    it('should list all clients PJ', async () => {
      const cnpj1 = new CNPJ('12345678000195');
      const client1 = ClientPJ.create({ name: 'Empresa XYZ', fantasyName: 'Empresa XYZ Ltda', companyName: 'Empresa XYZ Ltda', cnpj: cnpj1, email: 'contato@empresa.com', address: 'Av. Paulista', number: '1000', state: 'SP', cep: '01310100', legalResponsible: 'João Silva' });
      client1.id = 1;
      const cnpj2 = new CNPJ('98765432000198');
      const client2 = ClientPJ.create({ name: 'Empresa ABC', fantasyName: 'Empresa ABC Ltda', companyName: 'Empresa ABC Ltda', cnpj: cnpj2, email: 'contato@abc.com', address: 'Av. Brasil', number: '2000', state: 'SP', cep: '01410200', legalResponsible: 'Maria Silva' });
      client2.id = 2;
      const clients = [client1, client2];

      mockRepository.listClientsPJ.mockResolvedValue(clients);

      const result = await service.listClientsPJ();

      expect(mockRepository.listClientsPJ).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].companyName).toBe('Empresa XYZ Ltda');
      expect(result[0].cnpj).toBe('12.345.678/0001-95');
    });
  });

  describe('updateClientPJ', () => {
    it('should update client PJ successfully', async () => {
      const cnpj = new CNPJ('12345678000195');
      const existingClient = ClientPJ.create({ name: 'Empresa XYZ', fantasyName: 'Empresa XYZ Ltda', companyName: 'Empresa XYZ Ltda', cnpj, email: 'contato@empresa.com', address: 'Av. Paulista', number: '1000', state: 'SP', cep: '01310100', legalResponsible: 'João Silva' });
      existingClient.id = 1;
      const updatedClient = { ...existingClient, companyName: 'Empresa XYZ Atualizada' };

      mockRepository.findClientPJById.mockResolvedValue(existingClient);
      mockRepository.updateClientPJ.mockResolvedValue(updatedClient);

      const result = await service.updateClientPJ(1, { name: 'Empresa XYZ Atualizada', email: 'contato@empresa.com', address: 'Av. Paulista, 1000', legalResponsible: 'João Silva' });

      expect(mockRepository.updateClientPJ).toHaveBeenCalled();
      expect(result.companyName).toBe('Empresa XYZ Atualizada');
    });
  });

  describe('deleteClientPJ', () => {
    it('should delete client PJ successfully', async () => {
      const client = { id: 1, companyName: 'Empresa XYZ' };

      mockRepository.findClientPJById.mockResolvedValue(client);
      mockRepository.deleteClientPJ.mockResolvedValue();

      await service.deleteClientPJ(1);

      expect(mockRepository.deleteClientPJ).toHaveBeenCalledWith(1);
    });
  });
});