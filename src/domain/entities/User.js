class User {
  constructor(id, name, email, password, role, createdAt, updatedAt) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.password = password;
    this.role = role;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static create(name, email, password, role) {
    if (!name || !email || !password || !role) {
      throw new Error('Todos os campos são obrigatórios');
    }

    if (!['ATTENDANT', 'MECHANIC'].includes(role)) {
      throw new Error('Role deve ser ATTENDANT ou MECHANIC');
    }

    return new User(
      null,
      name,
      email,
      password,
      role,
      new Date(),
      new Date()
    );
  }

  update(name, email, role) {
    if (name) this.name = name;
    if (email) this.email = email;
    if (role) {
      if (!['ATTENDANT', 'MECHANIC'].includes(role)) {
        throw new Error('Role deve ser ATTENDANT ou MECHANIC');
      }
      this.role = role;
    }
    this.updatedAt = new Date();
  }

  changePassword(newPassword) {
    this.password = newPassword;
    this.updatedAt = new Date();
  }

  isAttendant() {
    return this.role === 'ATTENDANT';
  }

  isMechanic() {
    return this.role === 'MECHANIC';
  }
}

module.exports = User;