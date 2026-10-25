const prisma = require('../../prisma');
const User = require('../../domain/entities/User');
const Email = require('../../domain/value-objects/Email');
const Password = require('../../domain/value-objects/Password');
const IUserRepository = require('../interfaces/IUserRepository');

class PrismaUserRepository extends IUserRepository {
  async findById(id) {
    const userData = await prisma.user.findUnique({ where: { id } });
    if (!userData) return null;

    return new User(
      userData.id,
      userData.name,
      new Email(userData.email),
      Password.fromHash(userData.password),
      userData.role,
      userData.createdAt,
      userData.updatedAt
    );
  }

  async findByEmail(email) {
    const userData = await prisma.user.findUnique({ where: { email: email.toString() } });
    if (!userData) return null;

    return new User(
      userData.id,
      userData.name,
      new Email(userData.email),
      Password.fromHash(userData.password),
      userData.role,
      userData.createdAt,
      userData.updatedAt
    );
  }

  async create(name, email, password, role) {
    const userData = await prisma.user.create({
      data: {
        name,
        email: email.toString(),
        password: password.toString(),
        role
      }
    });

    return new User(
      userData.id,
      userData.name,
      new Email(userData.email),
      Password.fromHash(userData.password),
      userData.role,
      userData.createdAt,
      userData.updatedAt
    );
  }

  async update(id, user) {
    const updateData = {};
    if (user.name) updateData.name = user.name;
    if (user.email) updateData.email = user.email.toString();
    if (user.password) updateData.password = user.password.toString();
    if (user.role) updateData.role = user.role;

    const userData = await prisma.user.update({
      where: { id },
      data: updateData
    });

    return new User(
      userData.id,
      userData.name,
      new Email(userData.email),
      Password.fromHash(userData.password),
      userData.role,
      userData.createdAt,
      userData.updatedAt
    );
  }

  async delete(id) {
    await prisma.user.delete({ where: { id } });
  }
}

module.exports = PrismaUserRepository;