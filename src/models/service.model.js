const { validateString, validateNumber } = require('../utils/validation');

function buildServiceData(body) {
  return {
    name: validateString(body.name, 'name'),
    slaMinutes: validateNumber(body.slaMinutes, 'slaMinutes', { required: true, integer: true, min: 0 })
  };
}

function buildServiceUpdateData(body) {
  const data = {};
  if (body.name !== undefined) data.name = validateString(body.name, 'name', { required: false });
  if (body.slaMinutes !== undefined) data.slaMinutes = validateNumber(body.slaMinutes, 'slaMinutes', { required: false, integer: true, min: 0 });
  return data;
}

module.exports = {
  buildServiceData,
  buildServiceUpdateData
};
