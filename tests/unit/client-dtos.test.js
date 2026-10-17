const {
  CreateClientPFRequestDTO,
  UpdateClientPFRequestDTO,
  ClientPFResponseDTO,
  CreateClientPJRequestDTO,
  UpdateClientPJRequestDTO,
  ClientPJResponseDTO
} = require('../../src/application/dtos/ClientDTOs');
const { ClientPF, ClientPJ } = require('../../src/domain/entities/Client');
const { CPF, CNPJ } = require('../../src/domain/value-objects/Document');

describe('Client DTOs', () => {
  describe('CreateClientPFRequestDTO', () => {
    it('should create DTO with valid data', () => {
      const data = {
        name: 'João Silva',
        cpf: '12345678909',
        email: 'joao@email.com',
        address: 'Rua das Flores',
        number: '123',
        state: 'SP',
        cep: '01234567'
      };

      const dto = CreateClientPFRequestDTO.create(data);

      expect(dto.name).toBe(data.name);
      expect(dto.cpf.value).toBe(data.cpf);
      expect(dto.email).toBe(data.email);
      expect(dto.address).toBe(data.address);
      expect(dto.number).toBe(data.number);
      expect(dto.state).toBe(data.state);
      expect(dto.cep).toBe(data.cep);
    });
  });

  describe('UpdateClientPFRequestDTO', () => {
    it('should create DTO with valid data', () => {
      const data = {
        name: 'João Silva',
        email: 'joao@email.com',
        address: 'Rua das Flores',
        number: '123',
        state: 'SP',
        cep: '01234567'
      };

      const dto = UpdateClientPFRequestDTO.create(data);

      expect(dto.name).toBe(data.name);
      expect(dto.email).toBe(data.email);
      expect(dto.address).toBe(data.address);
      expect(dto.number).toBe(data.number);
      expect(dto.state).toBe(data.state);
      expect(dto.cep).toBe(data.cep);
    });
  });

  describe('ClientPFResponseDTO', () => {
    it('should create response DTO from client entity', () => {
      const cpf = new CPF('12345678909');
      const client = ClientPF.create({ name: 'João Silva', cpf, email: 'joao@email.com', address: 'Rua A, 123', number: '456', state: 'SP', cep: '01234567' });
      client.id = 1;
      client.createdAt = new Date('2024-01-01');
      client.updatedAt = new Date('2024-01-01');

      const dto = new ClientPFResponseDTO(client);

      expect(dto.id).toBe(1);
      expect(dto.name).toBe('João Silva');
      expect(dto.cpf).toBe('123.456.789-09');
      expect(dto.email).toBe('joao@email.com');
      expect(dto.address).toBe('Rua A, 123');
      expect(dto.number).toBe('456');
      expect(dto.state).toBe('SP');
      expect(dto.cep).toBe('01234567');
      expect(dto.createdAt).toEqual(new Date('2024-01-01'));
      expect(dto.updatedAt).toEqual(new Date('2024-01-01'));
    });
  });

  describe('CreateClientPJRequestDTO', () => {
    it('should create DTO with valid data', () => {
      const data = {
        name: 'Empresa XYZ',
        fantasyName: 'Empresa XYZ Ltda',
        companyName: 'Empresa XYZ Ltda',
        cnpj: '12345678000195',
        email: 'contato@empresa.com',
        address: 'Av. Paulista',
        number: '1000',
        state: 'SP',
        cep: '01310100',
        legalResponsible: 'João Silva'
      };

      const dto = CreateClientPJRequestDTO.create(data);

      expect(dto.name).toBe(data.name);
      expect(dto.fantasyName).toBe(data.fantasyName);
      expect(dto.companyName).toBe(data.companyName);
      expect(dto.cnpj.value).toBe(data.cnpj);
      expect(dto.email).toBe(data.email);
      expect(dto.address).toBe(data.address);
      expect(dto.number).toBe(data.number);
      expect(dto.state).toBe(data.state);
      expect(dto.cep).toBe(data.cep);
      expect(dto.legalResponsible).toBe(data.legalResponsible);
    });
  });

  describe('UpdateClientPJRequestDTO', () => {
    it('should create DTO with valid data', () => {
      const data = {
        name: 'Empresa XYZ',
        fantasyName: 'Empresa XYZ Ltda',
        companyName: 'Empresa XYZ Ltda',
        email: 'contato@empresa.com',
        address: 'Av. Paulista',
        number: '1000',
        state: 'SP',
        cep: '01310100',
        legalResponsible: 'João Silva'
      };

      const dto = UpdateClientPJRequestDTO.create(data);

      expect(dto.name).toBe(data.name);
      expect(dto.fantasyName).toBe(data.fantasyName);
      expect(dto.companyName).toBe(data.companyName);
      expect(dto.email).toBe(data.email);
      expect(dto.address).toBe(data.address);
      expect(dto.number).toBe(data.number);
      expect(dto.state).toBe(data.state);
      expect(dto.cep).toBe(data.cep);
      expect(dto.legalResponsible).toBe(data.legalResponsible);
    });
  });

  describe('ClientPJResponseDTO', () => {
    it('should create response DTO from client entity', () => {
      const cnpj = new CNPJ('12345678000195');
      const client = ClientPJ.create({ name: 'Empresa XYZ', fantasyName: 'Empresa XYZ Ltda', companyName: 'Empresa XYZ Ltda', cnpj: cnpj.value, email: 'contato@empresa.com', address: 'Av. Paulista, 1000', number: '2000', state: 'SP', cep: '01310100', legalResponsible: 'João Silva' });
      client.id = 1;
      client.createdAt = new Date('2024-01-01');
      client.updatedAt = new Date('2024-01-01');

      const dto = new ClientPJResponseDTO(client);

      expect(dto.id).toBe(1);
      expect(dto.name).toBe('Empresa XYZ');
      expect(dto.fantasyName).toBe('Empresa XYZ Ltda');
      expect(dto.companyName).toBe('Empresa XYZ Ltda');
      expect(dto.cnpj).toBe('12.345.678/0001-95');
      expect(dto.email).toBe('contato@empresa.com');
      expect(dto.address).toBe('Av. Paulista, 1000');
      expect(dto.number).toBe('2000');
      expect(dto.state).toBe('SP');
      expect(dto.cep).toBe('01310100');
      expect(dto.legalResponsible).toBe('João Silva');
      expect(dto.createdAt).toEqual(new Date('2024-01-01'));
      expect(dto.updatedAt).toEqual(new Date('2024-01-01'));
    });
  });
});