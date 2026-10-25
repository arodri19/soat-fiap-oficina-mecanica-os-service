class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function validateString(value, fieldName, options = {}) {
  const normalized = normalizeString(value);
  if (normalized === undefined || normalized === null || normalized === '') {
    if (options.required) {
      throw new ValidationError(`${fieldName} é obrigatório.`);
    }
    return undefined;
  }
  if (typeof normalized !== 'string') {
    throw new ValidationError(`${fieldName} deve ser uma string.`);
  }
  if (options.minLength && normalized.length < options.minLength) {
    throw new ValidationError(`${fieldName} deve ter ao menos ${options.minLength} caracteres.`);
  }
  return normalized;
}

function validateNumber(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === '') {
    if (options.required) {
      throw new ValidationError(`${fieldName} é obrigatório.`);
    }
    return undefined;
  }
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    throw new ValidationError(`${fieldName} deve ser um número válido.`);
  }
  if (options.integer && !Number.isInteger(numberValue)) {
    throw new ValidationError(`${fieldName} deve ser um número inteiro.`);
  }
  if (options.min !== undefined && numberValue < options.min) {
    throw new ValidationError(`${fieldName} deve ser maior ou igual a ${options.min}.`);
  }
  return numberValue;
}

function validateEmail(value, fieldName) {
  const email = validateString(value, fieldName, { required: true });
  const emailPattern = /^[^\s@]{1,255}@[^\s@]{1,255}\.[^\s@]{1,255}$/;
  if (!emailPattern.test(email)) {
    throw new ValidationError(`${fieldName} deve ser um email válido.`);
  }
  return email;
}

function validateDate(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} deve ser uma data válida.`);
  }
  return date;
}

function validateEnum(value, fieldName, allowedValues) {
  validateString(value, fieldName, { required: true });
  if (!allowedValues.includes(value)) {
    throw new ValidationError(`${fieldName} inválido.`);
  }
  return value;
}

function validateOneOf(values, fieldNames) {
  const hasOne = fieldNames.some((fieldName) => {
    const value = values[fieldName];
    return value !== undefined && value !== null && value !== '';
  });
  if (!hasOne) {
    throw new ValidationError(`Pelo menos um dos campos ${fieldNames.join(', ')} deve ser informado.`);
  }
}

module.exports = {
  ValidationError,
  validateString,
  validateNumber,
  validateEmail,
  validateDate,
  validateEnum,
  validateOneOf
};
