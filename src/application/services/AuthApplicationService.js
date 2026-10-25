const { LoginUseCase, RegisterUseCase } = require('../use-cases/AuthUseCases');
const { LoginRequestDTO, RegisterRequestDTO } = require('../dtos/AuthDTOs');

class AuthApplicationService {
  constructor(userRepository) {
    const AuthDomainService = require('../../domain/services/AuthDomainService');
    this.authDomainService = new AuthDomainService(userRepository);
    this.loginUseCase = new LoginUseCase(this.authDomainService);
    this.registerUseCase = new RegisterUseCase(this.authDomainService);
  }

  async login(email, password) {
    const loginRequest = new LoginRequestDTO(email, password);
    return await this.loginUseCase.execute(loginRequest);
  }

  async register(name, email, password, role) {
    const registerRequest = new RegisterRequestDTO(name, email, password, role);
    return await this.registerUseCase.execute(registerRequest);
  }
}

module.exports = AuthApplicationService;