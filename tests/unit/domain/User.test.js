const User = require('../../../src/domain/entities/User');

describe('User Entity', () => {
  it('deve criar um usuário válido', () => {
    const user = User.create('João Silva', 'joao@email.com', 'hashedpassword', 'ATTENDANT');

    expect(user.name).toBe('João Silva');
    expect(user.email).toBe('joao@email.com');
    expect(user.password).toBe('hashedpassword');
    expect(user.role).toBe('ATTENDANT');
    expect(user.id).toBeNull();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('deve lançar erro ao criar usuário sem campos obrigatórios', () => {
    expect(() => User.create('', 'joao@email.com', 'password', 'ATTENDANT')).toThrow('Todos os campos são obrigatórios');
    expect(() => User.create('João', '', 'password', 'ATTENDANT')).toThrow('Todos os campos são obrigatórios');
    expect(() => User.create('João', 'joao@email.com', '', 'ATTENDANT')).toThrow('Todos os campos são obrigatórios');
    expect(() => User.create('João', 'joao@email.com', 'password', '')).toThrow('Todos os campos são obrigatórios');
  });

  it('deve lançar erro ao criar usuário com role inválido', () => {
    expect(() => User.create('João', 'joao@email.com', 'password', 'INVALID')).toThrow('Role deve ser ATTENDANT ou MECHANIC');
  });

  it('deve atualizar usuário corretamente', () => {
    const user = User.create('João Silva', 'joao@email.com', 'password', 'ATTENDANT');
    const originalUpdatedAt = user.updatedAt;

    user.update('João Santos', 'joao.santos@email.com', 'MECHANIC');

    expect(user.name).toBe('João Santos');
    expect(user.email).toBe('joao.santos@email.com');
    expect(user.role).toBe('MECHANIC');
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
  });

  it('deve lançar erro ao atualizar com role inválido', () => {
    const user = User.create('João Silva', 'joao@email.com', 'password', 'ATTENDANT');
    expect(() => user.update('João Santos', 'joao.santos@email.com', 'INVALID')).toThrow('Role deve ser ATTENDANT ou MECHANIC');
  });

  it('deve alterar senha corretamente', () => {
    const user = User.create('João Silva', 'joao@email.com', 'password', 'ATTENDANT');
    const originalUpdatedAt = user.updatedAt;

    user.changePassword('newpassword');

    expect(user.password).toBe('newpassword');
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
  });

  it('deve verificar se é atendente', () => {
    const attendant = User.create('João', 'joao@email.com', 'password', 'ATTENDANT');
    const mechanic = User.create('Maria', 'maria@email.com', 'password', 'MECHANIC');

    expect(attendant.isAttendant()).toBe(true);
    expect(attendant.isMechanic()).toBe(false);
    expect(mechanic.isAttendant()).toBe(false);
    expect(mechanic.isMechanic()).toBe(true);
  });
});