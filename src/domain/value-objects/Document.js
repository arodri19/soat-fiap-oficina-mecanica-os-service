const { ValidationError } = require('../../utils/validation');

function calcCPFDigit(digits, length) {
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += digits[i] * (length + 1 - i);
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function calcCNPJDigit(digits, weights) {
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

class CPF {
  constructor(value) {
    if (!this.isValid(value)) {
      throw new ValidationError('CPF inválido');
    }
    this.value = value.replaceAll(/\D/g, '');
  }

  static create(value) {
    return new CPF(value);
  }

  isValid(cpf) {
    if (!cpf) return false;
    const cleaned = cpf.replaceAll(/\D/g, '');
    if (cleaned.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleaned)) return false;

    const nums = cleaned.split('').map(Number);
    if (calcCPFDigit(nums, 9) !== nums[9]) return false;
    if (calcCPFDigit(nums, 10) !== nums[10]) return false;

    return true;
  }

  toString() {
    return this.value;
  }

  format() {
    return this.value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
}

class CNPJ {
  constructor(value) {
    if (!this.isValid(value)) {
      throw new ValidationError('CNPJ inválido');
    }
    this.value = value.replaceAll(/\D/g, '');
  }

  static create(value) {
    return new CNPJ(value);
  }

  isValid(cnpj) {
    if (!cnpj) return false;
    const cleaned = cnpj.replaceAll(/\D/g, '');
    if (cleaned.length !== 14) return false;
    if (/^(\d)\1+$/.test(cleaned)) return false;

    const nums = cleaned.split('').map(Number);
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    if (calcCNPJDigit(nums.slice(0, 12), w1) !== nums[12]) return false;
    if (calcCNPJDigit(nums.slice(0, 13), w2) !== nums[13]) return false;

    return true;
  }

  toString() {
    return this.value;
  }

  format() {
    return this.value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
}

module.exports = {
  CPF,
  CNPJ
};
