const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config');

class AuthDomainService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async authenticate(email, password) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Credenciais inválidas');
    }

    const isValidPassword = await user.password.compare(password);
    if (!isValidPassword) {
      throw new Error('Credenciais inválidas');
    }

    return user;
  }

  generateToken(user) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
  }

  async register(name, email, password, role) {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('Email já cadastrado');
    }

    const user = await this.userRepository.create(name, email, password, role);
    return user;
  }
}

module.exports = AuthDomainService;