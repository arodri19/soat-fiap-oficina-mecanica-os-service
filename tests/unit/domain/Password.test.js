const Password = require('../../../src/domain/value-objects/Password');

describe('Password Value Object', () => {
  it('deve criar uma senha válida', async () => {
    const password = await Password.create('MinhaSenha123');

    expect(password.hashedValue).toBeDefined();
    expect(password.hashedValue).not.toBe('MinhaSenha123');
    expect(typeof password.hashedValue).toBe('string');
  });

  it('deve lançar erro para senha muito curta', async () => {
    await expect(Password.create('123')).rejects.toThrow('Senha deve ter pelo menos 6 caracteres');
    await expect(Password.create('')).rejects.toThrow('Senha deve ter pelo menos 6 caracteres');
  });

  it('deve comparar senha corretamente', async () => {
    const plainPassword = 'MinhaSenha123';
    const password = await Password.create(plainPassword);

    expect(await password.compare(plainPassword)).toBe(true);
    expect(await password.compare('SenhaErrada')).toBe(false);
  });

  it('deve criar senha a partir de hash existente', () => {
    const hashedValue = '$2b$10$example.hash.value';
    const password = Password.fromHash(hashedValue);

    expect(password.hashedValue).toBe(hashedValue);
    expect(password.toString()).toBe(hashedValue);
  });
});