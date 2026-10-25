const Email = require('../../domain/value-objects/Email');
const Password = require('../../domain/value-objects/Password');
const { LoginRequestDTO, RegisterRequestDTO, AuthResponseDTO, UserResponseDTO } = require('../dtos/AuthDTOs');

class LoginUseCase {
  constructor(authDomainService) {
    this.authDomainService = authDomainService;
  }

  async execute(loginRequest) {
    const email = new Email(loginRequest.email);
    const password = loginRequest.password;

    const user = await this.authDomainService.authenticate(email, password);
    const token = this.authDomainService.generateToken(user);

    return new AuthResponseDTO(token, user);
  }
}

class RegisterUseCase {
  constructor(authDomainService) {
    this.authDomainService = authDomainService;
  }

  async execute(registerRequest) {
    const name = registerRequest.name;
    const email = new Email(registerRequest.email);
    const password = await Password.create(registerRequest.password);
    const role = registerRequest.role;

    const user = await this.authDomainService.register(name, email, password, role);

    return new UserResponseDTO(user);
  }
}

module.exports = {
  LoginUseCase,
  RegisterUseCase
};