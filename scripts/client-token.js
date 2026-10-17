// Gera um JWT de CLIENTE para testes locais das rotas /api/track — em produção
// esse token é emitido pela Lambda de login por CPF (repositório serverless),
// que não existe no docker-compose. Uso: node scripts/client-token.js <clientPFId>
require('dotenv').config();
const jwt = require('jsonwebtoken');

const clientId = Number(process.argv[2] || 1);
const secret = process.env.JWT_SECRET || 'super-secret-change-me';

console.log(jwt.sign({ sub: clientId, role: 'CLIENT', name: 'Cliente local' }, secret, { expiresIn: '1h', issuer: 'oficina-mecanica-app' }));
