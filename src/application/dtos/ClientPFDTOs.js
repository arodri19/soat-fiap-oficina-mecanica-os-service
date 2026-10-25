const { CPF } = require('../../domain/value-objects/Document');

class CreateClientPFRequestDTO {
  constructor(name, cpf, email, address, number, state, cep) {
    this.name = name;
    this.cpf = new CPF(cpf);
    this.email = email;
    this.address = address;
    this.number = number;
    this.state = state;
    this.cep = cep;
  }

  static create(data) {
    return new CreateClientPFRequestDTO(
      data.name,
      data.cpf,
      data.email,
      data.address,
      data.number,
      data.state,
      data.cep
    );
  }
}

class UpdateClientPFRequestDTO {
  constructor(name, email, address, number, state, cep) {
    this.name = name;
    this.email = email;
    this.address = address;
    this.number = number;
    this.state = state;
    this.cep = cep;
  }

  static create(data) {
    return new UpdateClientPFRequestDTO(
      data.name,
      data.email,
      data.address,
      data.number,
      data.state,
      data.cep
    );
  }
}

class ClientPFResponseDTO {
  constructor(client) {
    this.id = client.id;
    this.name = client.name;
    this.cpf = typeof client.cpf === 'string' ? new CPF(client.cpf).format() : client.cpf.format();
    this.email = client.email;
    this.address = client.address;
    this.number = client.number;
    this.state = client.state;
    this.cep = client.cep;
    this.createdAt = client.createdAt;
    this.updatedAt = client.updatedAt;
  }

  static create(client) {
    return new ClientPFResponseDTO(client);
  }
}

module.exports = {
  CreateClientPFRequestDTO,
  UpdateClientPFRequestDTO,
  ClientPFResponseDTO
};