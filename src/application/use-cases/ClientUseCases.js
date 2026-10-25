const { ClientPF, ClientPJ } = require('../../domain/entities/Client');
const {
  ClientPFResponseDTO,
  ClientPJResponseDTO
} = require('../dtos/ClientDTOs');

class CreateClientPFUseCase {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;
  }

  async execute(request) {
    const cpf = request.cpf;

    // Check if CPF already exists
    const existingClient = await this.clientRepository.findClientPFByCPF(cpf);
    if (existingClient) {
      throw new Error('CPF já cadastrado');
    }

    const client = ClientPF.create({
      name: request.name,
      cpf,
      email: request.email,
      address: request.address,
      number: request.number,
      state: request.state,
      cep: request.cep
    });

    const savedClient = await this.clientRepository.createClientPF(client);
    return ClientPFResponseDTO.create(savedClient);
  }
}

class GetClientPFUseCase {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;
  }

  async execute(id) {
    const client = await this.clientRepository.findClientPFById(id);
    if (!client) {
      throw new Error('Cliente não encontrado');
    }

    return ClientPFResponseDTO.create(client);
  }
}

class ListClientsPFUseCase {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;
  }

  async execute() {
    const clients = await this.clientRepository.listClientsPF();
    return clients.map(client => ClientPFResponseDTO.create(client));
  }
}

class UpdateClientPFUseCase {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;
  }

  async execute(id, request) {
    const existingClient = await this.clientRepository.findClientPFById(id);
    if (!existingClient) {
      throw new Error('Cliente não encontrado');
    }

    const updatedClient = ClientPF.create({
      name: request.name || existingClient.name,
      cpf: existingClient.cpf,
      email: request.email || existingClient.email,
      address: request.address || existingClient.address,
      number: request.number || existingClient.number,
      state: request.state || existingClient.state,
      cep: request.cep || existingClient.cep
    });

    const savedClient = await this.clientRepository.updateClientPF(id, updatedClient);
    return ClientPFResponseDTO.create(savedClient);
  }
}

class DeleteClientPFUseCase {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;
  }

  async execute(id) {
    const existingClient = await this.clientRepository.findClientPFById(id);
    if (!existingClient) {
      throw new Error('Cliente não encontrado');
    }

    await this.clientRepository.deleteClientPF(id);
  }
}

class CreateClientPJUseCase {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;
  }

  async execute(request) {
    const cnpj = request.cnpj;

    // Check if CNPJ already exists
    const existingClient = await this.clientRepository.findClientPJByCNPJ(cnpj);
    if (existingClient) {
      throw new Error('CNPJ já cadastrado');
    }

    const client = ClientPJ.create({
      name: request.name,
      fantasyName: request.fantasyName,
      companyName: request.companyName,
      cnpj,
      email: request.email,
      address: request.address,
      number: request.number,
      state: request.state,
      cep: request.cep,
      legalResponsible: request.legalResponsible
    });

    const savedClient = await this.clientRepository.createClientPJ(client);
    return ClientPJResponseDTO.create(savedClient);
  }
}

class GetClientPJUseCase {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;
  }

  async execute(id) {
    const client = await this.clientRepository.findClientPJById(id);
    if (!client) {
      throw new Error('Cliente não encontrado');
    }

    return ClientPJResponseDTO.create(client);
  }
}

class ListClientsPJUseCase {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;
  }

  async execute() {
    const clients = await this.clientRepository.listClientsPJ();
    return clients.map(client => ClientPJResponseDTO.create(client));
  }
}

class UpdateClientPJUseCase {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;
  }

  async execute(id, request) {
    const existingClient = await this.clientRepository.findClientPJById(id);
    if (!existingClient) {
      throw new Error('Cliente não encontrado');
    }

    const updatedClient = ClientPJ.create({
      name: request.name || existingClient.name,
      fantasyName: request.fantasyName || existingClient.fantasyName,
      companyName: request.companyName || existingClient.companyName,
      cnpj: existingClient.cnpj,
      email: request.email || existingClient.email,
      address: request.address || existingClient.address,
      number: request.number || existingClient.number,
      state: request.state || existingClient.state,
      cep: request.cep || existingClient.cep,
      legalResponsible: request.legalResponsible || existingClient.legalResponsible
    });

    const savedClient = await this.clientRepository.updateClientPJ(id, updatedClient);
    return ClientPJResponseDTO.create(savedClient);
  }
}

class DeleteClientPJUseCase {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;
  }

  async execute(id) {
    const existingClient = await this.clientRepository.findClientPJById(id);
    if (!existingClient) {
      throw new Error('Cliente não encontrado');
    }

    await this.clientRepository.deleteClientPJ(id);
  }
}

module.exports = {
  CreateClientPFUseCase,
  GetClientPFUseCase,
  ListClientsPFUseCase,
  UpdateClientPFUseCase,
  DeleteClientPFUseCase,
  CreateClientPJUseCase,
  GetClientPJUseCase,
  ListClientsPJUseCase,
  UpdateClientPJUseCase,
  DeleteClientPJUseCase
};