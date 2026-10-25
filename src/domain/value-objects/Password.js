const bcrypt = require('bcrypt');

class Password {
  constructor(hashedValue) {
    this.hashedValue = hashedValue;
  }

  static async create(plainPassword) {
    if (!plainPassword || plainPassword.length < 6) {
      throw new Error('Senha deve ter pelo menos 6 caracteres');
    }

    const hashedValue = await bcrypt.hash(plainPassword, 10);
    return new Password(hashedValue);
  }

  static fromHash(hashedValue) {
    return new Password(hashedValue);
  }

  async compare(plainPassword) {
    return await bcrypt.compare(plainPassword, this.hashedValue);
  }

  toString() {
    return this.hashedValue;
  }
}

module.exports = Password;