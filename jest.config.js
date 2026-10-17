module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  setupFiles: ['dotenv/config'],
  moduleFileExtensions: ['js', 'json'],
  // *.steps.js = cenários BDD (jest-cucumber, features em tests/bdd/features)
  testMatch: ['**/?(*.)+(spec|test).[jt]s', '**/*.steps.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/prisma.js',
    '!src/swagger.js',
    '!src/config.js',
    // Implementações Prisma exigem banco real — cobertas por tests/integration
    // (rodam no CI contra um PostgreSQL de serviço, ver .github/workflows/ci.yml)
    '!src/infrastructure/repositories/Prisma*.js',
    '!src/infrastructure/interfaces/I*.js',
    '!src/repositories/*.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
  // Requisito da Fase 4: cobertura mínima de 80% por serviço (o CI falha abaixo disso)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testPathIgnorePatterns: ['/node_modules/'],
  clearMocks: true,
  restoreMocks: true
};
