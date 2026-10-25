const { CPF, CNPJ } = require('../../../src/domain/value-objects/Document');

describe('CPF', () => {
  const VALID_CPFS = [
    '529.982.247-25',
    '52998224725',
    '111.444.777-35',
    '123.456.789-09'
  ];

  const INVALID_CPFS = [
    '111.222.333-44',
    '999.888.777-66',
    '555.666.777-88',
    '000.000.000-00',
    '111.111.111-11',
    '123456789',
    '',
    null,
    undefined
  ];

  describe('CPF válido', () => {
    VALID_CPFS.forEach((cpf) => {
      it(`aceita CPF ${cpf}`, () => {
        expect(() => new CPF(cpf)).not.toThrow();
      });
    });

    it('armazena apenas dígitos internamente', () => {
      const cpf = new CPF('529.982.247-25');
      expect(cpf.toString()).toBe('52998224725');
    });

    it('formata corretamente com pontos e traço', () => {
      const cpf = new CPF('52998224725');
      expect(cpf.format()).toBe('529.982.247-25');
    });

    it('CPF.create() é equivalente ao construtor', () => {
      expect(() => CPF.create('123.456.789-09')).not.toThrow();
    });
  });

  describe('CPF inválido', () => {
    INVALID_CPFS.forEach((cpf) => {
      it(`rejeita CPF ${JSON.stringify(cpf)}`, () => {
        expect(() => new CPF(cpf)).toThrow('CPF inválido');
      });
    });

    it('rejeita CPF com dígito verificador errado (d1)', () => {
      // 529.982.247-25 com d1 trocado → 529.982.247-35
      expect(() => new CPF('529.982.247-35')).toThrow('CPF inválido');
    });

    it('rejeita CPF com dígito verificador errado (d2)', () => {
      // 529.982.247-25 com d2 trocado → 529.982.247-26
      expect(() => new CPF('529.982.247-26')).toThrow('CPF inválido');
    });

    it('rejeita CPF com comprimento incorreto', () => {
      expect(() => new CPF('123456')).toThrow('CPF inválido');
      expect(() => new CPF('123456789012')).toThrow('CPF inválido');
    });

    it('rejeita CPF com todos os dígitos iguais', () => {
      ['00000000000', '11111111111', '99999999999'].forEach((cpf) => {
        expect(() => new CPF(cpf)).toThrow('CPF inválido');
      });
    });
  });
});

describe('CNPJ', () => {
  const VALID_CNPJS = [
    '11.222.333/0001-81',
    '11222333000181',
    '45.997.418/0001-53'
  ];

  const INVALID_CNPJS = [
    '11.222.333/0001-99',
    '00.000.000/0000-00',
    '11.111.111/1111-11',
    '12345678',
    '',
    null,
    undefined
  ];

  describe('CNPJ válido', () => {
    VALID_CNPJS.forEach((cnpj) => {
      it(`aceita CNPJ ${cnpj}`, () => {
        expect(() => new CNPJ(cnpj)).not.toThrow();
      });
    });

    it('armazena apenas dígitos internamente', () => {
      const cnpj = new CNPJ('11.222.333/0001-81');
      expect(cnpj.toString()).toBe('11222333000181');
    });

    it('formata corretamente', () => {
      const cnpj = new CNPJ('11222333000181');
      expect(cnpj.format()).toBe('11.222.333/0001-81');
    });

    it('CNPJ.create() é equivalente ao construtor', () => {
      expect(() => CNPJ.create('11.222.333/0001-81')).not.toThrow();
    });
  });

  describe('CNPJ inválido', () => {
    INVALID_CNPJS.forEach((cnpj) => {
      it(`rejeita CNPJ ${JSON.stringify(cnpj)}`, () => {
        expect(() => new CNPJ(cnpj)).toThrow('CNPJ inválido');
      });
    });

    it('rejeita CNPJ com dígito verificador errado (d1)', () => {
      expect(() => new CNPJ('11.222.333/0001-91')).toThrow('CNPJ inválido');
    });

    it('rejeita CNPJ com dígito verificador errado (d2)', () => {
      expect(() => new CNPJ('11.222.333/0001-82')).toThrow('CNPJ inválido');
    });

    it('rejeita CNPJ com comprimento incorreto', () => {
      expect(() => new CNPJ('1122233300018')).toThrow('CNPJ inválido');
      expect(() => new CNPJ('112223330001810')).toThrow('CNPJ inválido');
    });

    it('rejeita CNPJ com todos os dígitos iguais', () => {
      ['00000000000000', '11111111111111'].forEach((cnpj) => {
        expect(() => new CNPJ(cnpj)).toThrow('CNPJ inválido');
      });
    });
  });
});
