const { CNPJ } = require('../../domain/value-objects/Document');

class CreateClientPJRequestDTO {
  constructor({ name, fantasyName, companyName, cnpj, email, address, number, state, cep, legalResponsible }) {
    this.name = name;
    this.fantasyName = fantasyName;
    this.companyName = companyName;
    this.cnpj = new CNPJ(cnpj);
    this.email = email;
    this.address = address;
    this.number = number;
    this.state = state;
    this.cep = cep;
    this.legalResponsible = legalResponsible;
  }

  static create(data) {
    return new CreateClientPJRequestDTO(data);
  }
}

class UpdateClientPJRequestDTO {
  constructor({ name, fantasyName, companyName, email, address, number, state, cep, legalResponsible }) {
    this.name = name;
    this.fantasyName = fantasyName;
    this.companyName = companyName;
    this.email = email;
    this.address = address;
    this.number = number;
    this.state = state;
    this.cep = cep;
    this.legalResponsible = legalResponsible;
  }

  static create(data) {
    return new UpdateClientPJRequestDTO(data);
  }
}

class ClientPJResponseDTO {
  constructor(client) {
    this.id = client.id;
    this.name = client.name;
    this.fantasyName = client.fantasyName;
    this.companyName = client.companyName;
    this.cnpj = typeof client.cnpj === 'string' ? new CNPJ(client.cnpj).format() : client.cnpj.format();
    this.email = client.email;
    this.address = client.address;
    this.number = client.number;
    this.state = client.state;
    this.cep = client.cep;
    this.legalResponsible = client.legalResponsible;
    this.createdAt = client.createdAt;
    this.updatedAt = client.updatedAt;
  }

  static create(client) {
    return new ClientPJResponseDTO(client);
  }
}

module.exports = {
  CreateClientPJRequestDTO,
  UpdateClientPJRequestDTO,
  ClientPJResponseDTO
};