const { validateString, validateNumber, ValidationError } = require('../utils/validation');

// Formato antigo: ABC1234 (3 letras + 4 dígitos)
const PLATE_OLD = /^[A-Z]{3}\d{4}$/;
// Formato Mercosul: ABC1D23 (3 letras + 1 dígito + 1 letra + 2 dígitos)
const PLATE_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

function validatePlate(value) {
  const raw = validateString(value, 'plate');
  if (!raw) {
    throw new ValidationError('Placa inválida. Use o formato antigo (ABC1234) ou Mercosul (ABC1D23).');
  }
  const normalized = raw.replace(/-/g, '').toUpperCase();
  if (!PLATE_OLD.test(normalized) && !PLATE_MERCOSUL.test(normalized)) {
    throw new ValidationError('Placa inválida. Use o formato antigo (ABC1234) ou Mercosul (ABC1D23).');
  }
  return normalized;
}

function buildVehicleData(body) {
  return {
    plate: validatePlate(body.plate),
    model: validateString(body.model, 'model'),
    year: validateNumber(body.year, 'year', { required: true, integer: true }),
    color: validateString(body.color, 'color'),
    clientPFId: validateNumber(body.clientPFId, 'clientPFId', { required: true, integer: true })
  };
}

function buildVehicleUpdateData(body) {
  const data = {};
  if (body.plate !== undefined) data.plate = validatePlate(body.plate);
  if (body.model !== undefined) data.model = validateString(body.model, 'model', { required: false });
  if (body.year !== undefined) data.year = validateNumber(body.year, 'year', { required: false, integer: true });
  if (body.color !== undefined) data.color = validateString(body.color, 'color', { required: false });
  if (body.clientPFId !== undefined) data.clientPFId = validateNumber(body.clientPFId, 'clientPFId', { required: false, integer: true });
  return data;
}

module.exports = {
  buildVehicleData,
  buildVehicleUpdateData
};
