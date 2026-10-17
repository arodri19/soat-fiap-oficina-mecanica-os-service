class LoginRequestDTO {
  constructor(email, password) {
    this.email = email;
    this.password = password;
  }

  static create(data) {
    return new LoginRequestDTO(data.email, data.password);
  }
}

class RegisterRequestDTO {
  constructor(name, email, password, role) {
    this.name = name;
    this.email = email;
    this.password = password;
    this.role = role;
  }

  static create(data) {
    return new RegisterRequestDTO(data.name, data.email, data.password, data.role);
  }
}

class AuthResponseDTO {
  constructor(token, user) {
    this.token = token;
    this.user = {
      email: user.email.toString(),
      name: user.name,
      role: user.role
    };
  }

  static create(token, user) {
    return new AuthResponseDTO(token, user);
  }
}

class UserResponseDTO {
  constructor(user) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email.toString();
    this.role = user.role;
  }

  static create(user) {
    return new UserResponseDTO(user);
  }
}

module.exports = {
  LoginRequestDTO,
  RegisterRequestDTO,
  AuthResponseDTO,
  UserResponseDTO
};