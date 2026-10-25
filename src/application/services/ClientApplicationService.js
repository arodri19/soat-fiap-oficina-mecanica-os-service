const {
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
} = require('../use-cases/ClientUseCases');
const {
  CreateClientPFRequestDTO,
  UpdateClientPFRequestDTO,
  CreateClientPJRequestDTO,
  UpdateClientPJRequestDTO
} = require('../dtos/ClientDTOs');

class ClientApplicationService {
  constructor(clientRepository) {
    this.clientRepository = clientRepository;

    // Initialize use cases
    this.createClientPFUseCase = new CreateClientPFUseCase(clientRepository);
    this.getClientPFUseCase = new GetClientPFUseCase(clientRepository);
    this.listClientsPFUseCase = new ListClientsPFUseCase(clientRepository);
    this.updateClientPFUseCase = new UpdateClientPFUseCase(clientRepository);
    this.deleteClientPFUseCase = new DeleteClientPFUseCase(clientRepository);

    this.createClientPJUseCase = new CreateClientPJUseCase(clientRepository);
    this.getClientPJUseCase = new GetClientPJUseCase(clientRepository);
    this.listClientsPJUseCase = new ListClientsPJUseCase(clientRepository);
    this.updateClientPJUseCase = new UpdateClientPJUseCase(clientRepository);
    this.deleteClientPJUseCase = new DeleteClientPJUseCase(clientRepository);
  }

  async createClientPF(name, cpf, email, address, number, state, cep) {
    const request = new CreateClientPFRequestDTO(name, cpf, email, address, number, state, cep);
    return await this.createClientPFUseCase.execute(request);
  }

  async getClientPF(id) {
    return await this.getClientPFUseCase.execute(id);
  }

  async listClientsPF() {
    return await this.listClientsPFUseCase.execute();
  }

  async updateClientPF(id, name, email, address, number, state, cep) {
    const request = new UpdateClientPFRequestDTO(name, email, address, number, state, cep);
    return await this.updateClientPFUseCase.execute(id, request);
  }

  async deleteClientPF(id) {
    await this.deleteClientPFUseCase.execute(id);
  }

  async createClientPJ(clientData) {
    const request = CreateClientPJRequestDTO.create(clientData);
    return await this.createClientPJUseCase.execute(request);
  }

  async getClientPJ(id) {
    return await this.getClientPJUseCase.execute(id);
  }

  async listClientsPJ() {
    return await this.listClientsPJUseCase.execute();
  }

  async updateClientPJ(id, clientData) {
    const request = UpdateClientPJRequestDTO.create(clientData);
    return await this.updateClientPJUseCase.execute(id, request);
  }

  async deleteClientPJ(id) {
    await this.deleteClientPJUseCase.execute(id);
  }
}

module.exports = ClientApplicationService;