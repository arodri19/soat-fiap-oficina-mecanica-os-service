class IClientRepository {
  async createClientPF(client) {
    throw new Error('Method not implemented');
  }

  async findClientPFById(id) {
    throw new Error('Method not implemented');
  }

  async findClientPFByCPF(cpf) {
    throw new Error('Method not implemented');
  }

  async listClientsPF() {
    throw new Error('Method not implemented');
  }

  async updateClientPF(id, client) {
    throw new Error('Method not implemented');
  }

  async deleteClientPF(id) {
    throw new Error('Method not implemented');
  }

  async createClientPJ(client) {
    throw new Error('Method not implemented');
  }

  async findClientPJById(id) {
    throw new Error('Method not implemented');
  }

  async findClientPJByCNPJ(cnpj) {
    throw new Error('Method not implemented');
  }

  async listClientsPJ() {
    throw new Error('Method not implemented');
  }

  async updateClientPJ(id, client) {
    throw new Error('Method not implemented');
  }

  async deleteClientPJ(id) {
    throw new Error('Method not implemented');
  }
}

module.exports = IClientRepository;