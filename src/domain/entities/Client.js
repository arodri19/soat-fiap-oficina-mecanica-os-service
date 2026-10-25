class ClientPF {
  constructor({ id, name, cpf, email, address, number, state, cep, createdAt, updatedAt }) {
    this.id = id;
    this.name = name;
    this.cpf = cpf;
    this.email = email;
    this.address = address;
    this.number = number;
    this.state = state;
    this.cep = cep;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static create({ name, cpf, email, address, number, state, cep }) {
    if (!name || !cpf || !email) {
      throw new Error('Nome, CPF e email são obrigatórios');
    }

    return new ClientPF({
      id: null,
      name,
      cpf,
      email,
      address,
      number,
      state,
      cep,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  update({ name, email, address, number, state, cep }) {
    if (name) this.name = name;
    if (email) this.email = email;
    if (address) this.address = address;
    if (number) this.number = number;
    if (state) this.state = state;
    if (cep) this.cep = cep;
    this.updatedAt = new Date();
  }

  isValidCPF() {
    // Basic CPF validation (simplified)
    const cpf = this.cpf.replaceAll(/\D/g, '');
    return cpf.length === 11;
  }
}

class ClientPJ {
  constructor({ id, name, fantasyName, companyName, cnpj, email, address, number, state, cep, legalResponsible, createdAt, updatedAt }) {
    this.id = id;
    this.name = name;
    this.fantasyName = fantasyName;
    this.companyName = companyName;
    this.cnpj = cnpj;
    this.email = email;
    this.address = address;
    this.number = number;
    this.state = state;
    this.cep = cep;
    this.legalResponsible = legalResponsible;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static create({ name, fantasyName, companyName, cnpj, email, address, number, state, cep, legalResponsible }) {
    if (!companyName || !cnpj || !email) {
      throw new Error('Razão social, CNPJ e email são obrigatórios');
    }

    return new ClientPJ({
      id: null,
      name,
      fantasyName,
      companyName,
      cnpj,
      email,
      address,
      number,
      state,
      cep,
      legalResponsible,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  update({ name, fantasyName, companyName, email, address, number, state, cep, legalResponsible }) {
    if (name) this.name = name;
    if (fantasyName) this.fantasyName = fantasyName;
    if (companyName) this.companyName = companyName;
    if (email) this.email = email;
    if (address) this.address = address;
    if (number) this.number = number;
    if (state) this.state = state;
    if (cep) this.cep = cep;
    if (legalResponsible) this.legalResponsible = legalResponsible;
    this.updatedAt = new Date();
  }

  isValidCNPJ() {
    // Basic CNPJ validation (simplified)
    const cnpj = this.cnpj.replaceAll(/\D/g, '');
    return cnpj.length === 14;
  }
}

module.exports = {
  ClientPF,
  ClientPJ
};