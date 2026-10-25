class Email {
  constructor(value) {
    if (!this.isValid(value)) {
      throw new Error('Email inválido');
    }
    this.value = value.toLowerCase().trim();
  }

  static create(value) {
    return new Email(value);
  }

  isValid(email) {
    if (!email || typeof email !== 'string' || email.trim() === '') {
      return false;
    }
    const emailRegex = /^[^\s@]{1,255}@[^\s@]{1,255}\.[^\s@]{1,255}$/;
    return emailRegex.test(email.trim());
  }

  equals(other) {
    return other instanceof Email && this.value === other.value;
  }

  toString() {
    return this.value;
  }
}

module.exports = Email;