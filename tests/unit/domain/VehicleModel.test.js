const { buildVehicleData, buildVehicleUpdateData } = require('../../../src/models/vehicle.model');

describe('buildVehicleData — validação de placa', () => {
  const base = { model: 'Honda Civic', year: 2020, color: 'Prata', clientPFId: 1 };

  describe('formato antigo (3 letras + 4 dígitos)', () => {
    it('aceita placa sem hífen', () => {
      const data = buildVehicleData({ ...base, plate: 'ABC1234' });
      expect(data.plate).toBe('ABC1234');
    });

    it('aceita placa com hífen e normaliza removendo-o', () => {
      const data = buildVehicleData({ ...base, plate: 'ABC-1234' });
      expect(data.plate).toBe('ABC1234');
    });

    it('aceita letras minúsculas e normaliza para maiúsculas', () => {
      const data = buildVehicleData({ ...base, plate: 'abc-1234' });
      expect(data.plate).toBe('ABC1234');
    });
  });

  describe('formato Mercosul (3 letras + 1 dígito + 1 letra + 2 dígitos)', () => {
    it('aceita placa Mercosul válida', () => {
      const data = buildVehicleData({ ...base, plate: 'ABC1D23' });
      expect(data.plate).toBe('ABC1D23');
    });

    it('aceita Mercosul em minúsculas e normaliza', () => {
      const data = buildVehicleData({ ...base, plate: 'abc1d23' });
      expect(data.plate).toBe('ABC1D23');
    });
  });

  describe('placas inválidas', () => {
    const invalid = [
      'ABCD1234',
      '1234ABC',
      'AB1234',
      'ABC12345',
      'ABC12D3',
      'A1C1D23',
      '12345678',
      '',
      'ABC-D234'
    ];

    invalid.forEach((plate) => {
      it(`rejeita placa inválida: "${plate}"`, () => {
        expect(() => buildVehicleData({ ...base, plate })).toThrow('Placa inválida');
      });
    });

    it('rejeita placa ausente', () => {
      expect(() => buildVehicleData({ ...base, plate: undefined })).toThrow();
    });
  });

  describe('demais campos obrigatórios', () => {
    it('inclui todos os campos na saída', () => {
      const data = buildVehicleData({ plate: 'DEF5678', model: 'Corolla', year: 2021, color: 'Preto', clientPFId: 2 });
      expect(data).toMatchObject({ plate: 'DEF5678', model: 'Corolla', year: 2021, color: 'Preto', clientPFId: 2 });
    });

    it('lança erro se clientPFId ausente', () => {
      expect(() => buildVehicleData({ plate: 'ABC1234', model: 'X', year: 2020, color: 'Y' })).toThrow();
    });
  });
});

describe('buildVehicleUpdateData', () => {
  it('atualiza apenas os campos informados', () => {
    const data = buildVehicleUpdateData({ plate: 'GHI9012' });
    expect(data).toEqual({ plate: 'GHI9012' });
    expect(data.model).toBeUndefined();
  });

  it('normaliza placa na atualização', () => {
    const data = buildVehicleUpdateData({ plate: 'abc-5678' });
    expect(data.plate).toBe('ABC5678');
  });

  it('rejeita placa inválida na atualização', () => {
    expect(() => buildVehicleUpdateData({ plate: 'INVALIDA' })).toThrow('Placa inválida');
  });

  it('retorna objeto vazio quando nenhum campo informado', () => {
    expect(buildVehicleUpdateData({})).toEqual({});
  });
});
