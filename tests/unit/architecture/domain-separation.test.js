const fs = require('node:fs');
const path = require('node:path');

function listJsFilesRecursively(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listJsFilesRecursively(fullPath);
    }
    return fullPath.endsWith('.js') ? [fullPath] : [];
  });
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Arquitetura - separação de domínios/camadas', () => {
  const srcRoot = path.join(__dirname, '../../../src');

  it('domain não depende de controllers nem routes', () => {
    const domainFiles = listJsFilesRecursively(path.join(srcRoot, 'domain'));
    const forbidden = [/controllers\//, /routes\//];

    domainFiles.forEach((filePath) => {
      const content = read(filePath);
      forbidden.forEach((pattern) => {
        expect(content).not.toMatch(pattern);
      });
    });
  });

  it('services não dependem de controllers', () => {
    const serviceFiles = listJsFilesRecursively(path.join(srcRoot, 'services'));

    serviceFiles.forEach((filePath) => {
      const content = read(filePath);
      expect(content).not.toMatch(/controllers\//);
    });
  });

  it('controllers não acessam Prisma diretamente', () => {
    const controllerFiles = listJsFilesRecursively(path.join(srcRoot, 'controllers'));

    controllerFiles.forEach((filePath) => {
      const content = read(filePath);
      expect(content).not.toMatch(/require\(['"][.]{2}\/prisma['"]\)/);
      expect(content).not.toMatch(/@prisma\/client/);
      expect(content).not.toMatch(/PrismaClient/);
    });
  });

  it('acesso direto ao Prisma fica em repositories e prisma entrypoint', () => {
    const allFiles = listJsFilesRecursively(srcRoot);
    const prismaConsumers = allFiles.filter((filePath) => {
      const content = read(filePath);
      return /require\(['"][.]{2}\/prisma['"]\)/.test(content);
    });

    prismaConsumers.forEach((filePath) => {
      const normalized = filePath.replaceAll('\\', '/');
      const isAllowed =
        normalized.includes('/src/repositories/') ||
        normalized.endsWith('/src/prisma.js');
      expect(isAllowed).toBe(true);
    });
  });
});
