const { validateString, validateNumber } = require('../utils/validation');

function buildPartData(body) {
  return {
    name: validateString(body.name, 'name'),
    type: validateString(body.type, 'type'),
    model: validateString(body.model, 'model'),
    color: validateString(body.color, 'color'),
    quantity: validateNumber(body.quantity, 'quantity', { required: true, integer: true, min: 0 })
  };
}

function buildPartUpdateData(body) {
  const data = {};
  if (body.name !== undefined) data.name = validateString(body.name, 'name', { required: false });
  if (body.type !== undefined) data.type = validateString(body.type, 'type', { required: false });
  if (body.model !== undefined) data.model = validateString(body.model, 'model', { required: false });
  if (body.color !== undefined) data.color = validateString(body.color, 'color', { required: false });
  if (body.quantity !== undefined) data.quantity = validateNumber(body.quantity, 'quantity', { required: false, integer: true, min: 0 });
  return data;
}

module.exports = {
  buildPartData,
  buildPartUpdateData
};
