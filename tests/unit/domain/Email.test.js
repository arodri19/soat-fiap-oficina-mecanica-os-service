const Email = require('../../../src/domain/value-objects/Email');

describe('Email Value Object', () => {
  it('deve criar um email válido', () => {
    const email = Email.create('teste@email.com');

    expect(email.value).toBe('teste@email.com');
    expect(email.toString()).toBe('teste@email.com');
  });

  it('deve converter email para minúsculo e remover espaços', () => {
    const email = Email.create('  TESTE@EMAIL.COM  ');

    expect(email.value).toBe('teste@email.com');
  });

  it('deve lançar erro para email inválido', () => {
    expect(() => Email.create('')).toThrow('Email inválido');
    expect(() => Email.create('invalid')).toThrow('Email inválido');
    expect(() => Email.create('invalid@')).toThrow('Email inválido');
    expect(() => Email.create('@invalid.com')).toThrow('Email inválido');
    expect(() => Email.create('invalid@invalid')).toThrow('Email inválido');
  });

  it('deve comparar emails corretamente', () => {
    const email1 = Email.create('teste@email.com');
    const email2 = Email.create('teste@email.com');
    const email3 = Email.create('outro@email.com');

    expect(email1.equals(email2)).toBe(true);
    expect(email1.equals(email3)).toBe(false);
    expect(email1.equals('teste@email.com')).toBe(false);
  });
});