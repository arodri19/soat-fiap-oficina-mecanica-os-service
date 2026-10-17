const { hashPassword, comparePassword } = require('../../src/utils/hash');

describe('Hash utility', () => {
  it('deve gerar um hash e comparar corretamente', async () => {
    const password = 'Senha123!';
    const hashed = await hashPassword(password);

    expect(hashed).not.toBe(password);
    expect(await comparePassword(password, hashed)).toBe(true);
    expect(await comparePassword('errada', hashed)).toBe(false);
  });
});
