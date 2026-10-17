const prisma = require('../../prisma');
const { ClientPF, ClientPJ } = require('../../domain/entities/Client');
const { CPF, CNPJ } = require('../../domain/value-objects/Document');
const IClientRepository = require('../interfaces/IClientRepository');

class PrismaClientRepository extends IClientRepository {
  async createClientPF(client) {
    const data = await prisma.clientPF.create({
      data: {
        name: client.name,
        cpf: client.cpf.toString(),
        email: client.email,
        address: client.address,
        number: client.number,
        state: client.state,
        cep: client.cep
      }
    });

    return new ClientPF({
      id: data.id,
      name: data.name,
      cpf: new CPF(data.cpf),
      email: data.email,
      address: data.address,
      number: data.number,
      state: data.state,
      cep: data.cep,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  async findClientPFById(id) {
    const data = await prisma.clientPF.findUnique({
      where: { id },
      include: { vehicles: true }
    });

    if (!data) return null;

    return new ClientPF({
      id: data.id,
      name: data.name,
      cpf: new CPF(data.cpf),
      email: data.email,
      address: data.address,
      number: data.number,
      state: data.state,
      cep: data.cep,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  async findClientPFByCPF(cpf) {
    const data = await prisma.clientPF.findUnique({
      where: { cpf: cpf.toString() }
    });

    if (!data) return null;

    return new ClientPF({
      id: data.id,
      name: data.name,
      cpf: new CPF(data.cpf),
      email: data.email,
      address: data.address,
      number: data.number,
      state: data.state,
      cep: data.cep,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  async listClientsPF() {
    const data = await prisma.clientPF.findMany({
      include: { vehicles: true },
      orderBy: { createdAt: 'desc' }
    });

    return data.map(item => new ClientPF({
      id: item.id,
      name: item.name,
      cpf: new CPF(item.cpf),
      email: item.email,
      address: item.address,
      number: item.number,
      state: item.state,
      cep: item.cep,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  }

  async updateClientPF(id, client) {
    const updateData = {};
    if (client.name) updateData.name = client.name;
    if (client.email) updateData.email = client.email;
    if (client.address) updateData.address = client.address;
    if (client.number) updateData.number = client.number;
    if (client.state) updateData.state = client.state;
    if (client.cep) updateData.cep = client.cep;

    const data = await prisma.clientPF.update({
      where: { id },
      data: updateData
    });

    return new ClientPF({
      id: data.id,
      name: data.name,
      cpf: new CPF(data.cpf),
      email: data.email,
      address: data.address,
      number: data.number,
      state: data.state,
      cep: data.cep,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  async deleteClientPF(id) {
    await prisma.clientPF.delete({ where: { id } });
  }

  async createClientPJ(client) {
    const data = await prisma.clientPJ.create({
      data: {
        name: client.name,
        fantasyName: client.fantasyName,
        companyName: client.companyName,
        cnpj: client.cnpj.toString(),
        email: client.email,
        address: client.address,
        number: client.number,
        state: client.state,
        cep: client.cep,
        legalResponsible: client.legalResponsible
      }
    });

    return new ClientPJ({
      id: data.id,
      name: data.name,
      fantasyName: data.fantasyName,
      companyName: data.companyName,
      cnpj: new CNPJ(data.cnpj),
      email: data.email,
      address: data.address,
      number: data.number,
      state: data.state,
      cep: data.cep,
      legalResponsible: data.legalResponsible,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  async findClientPJById(id) {
    const data = await prisma.clientPJ.findUnique({ where: { id } });

    if (!data) return null;

    return new ClientPJ({
      id: data.id,
      name: data.name,
      fantasyName: data.fantasyName,
      companyName: data.companyName,
      cnpj: new CNPJ(data.cnpj),
      email: data.email,
      address: data.address,
      number: data.number,
      state: data.state,
      cep: data.cep,
      legalResponsible: data.legalResponsible,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  async findClientPJByCNPJ(cnpj) {
    const data = await prisma.clientPJ.findUnique({
      where: { cnpj: cnpj.toString() }
    });

    if (!data) return null;

    return new ClientPJ({
      id: data.id,
      name: data.name,
      fantasyName: data.fantasyName,
      companyName: data.companyName,
      cnpj: new CNPJ(data.cnpj),
      email: data.email,
      address: data.address,
      number: data.number,
      state: data.state,
      cep: data.cep,
      legalResponsible: data.legalResponsible,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  async listClientsPJ() {
    const data = await prisma.clientPJ.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return data.map(item => new ClientPJ({
      id: item.id,
      name: item.name,
      fantasyName: item.fantasyName,
      companyName: item.companyName,
      cnpj: new CNPJ(item.cnpj),
      email: item.email,
      address: item.address,
      number: item.number,
      state: item.state,
      cep: item.cep,
      legalResponsible: item.legalResponsible,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  }

  async updateClientPJ(id, client) {
    const updateData = {};
    if (client.name) updateData.name = client.name;
    if (client.fantasyName) updateData.fantasyName = client.fantasyName;
    if (client.companyName) updateData.companyName = client.companyName;
    if (client.email) updateData.email = client.email;
    if (client.address) updateData.address = client.address;
    if (client.number) updateData.number = client.number;
    if (client.state) updateData.state = client.state;
    if (client.cep) updateData.cep = client.cep;
    if (client.legalResponsible) updateData.legalResponsible = client.legalResponsible;

    const data = await prisma.clientPJ.update({
      where: { id },
      data: updateData
    });

    return new ClientPJ({
      id: data.id,
      name: data.name,
      fantasyName: data.fantasyName,
      companyName: data.companyName,
      cnpj: new CNPJ(data.cnpj),
      email: data.email,
      address: data.address,
      number: data.number,
      state: data.state,
      cep: data.cep,
      legalResponsible: data.legalResponsible,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  async deleteClientPJ(id) {
    await prisma.clientPJ.delete({ where: { id } });
  }
}

module.exports = PrismaClientRepository;