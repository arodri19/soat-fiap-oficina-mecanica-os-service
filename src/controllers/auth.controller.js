const container = require('../infrastructure/container/Container');
const { validateEmail, validateString, validateEnum } = require('../utils/validation');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login de usuário
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@oficina.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "MinhaSenha123"
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: "user@oficina.com"
 *                     name:
 *                       type: string
 *                       example: "João Silva"
 *                     role:
 *                       type: string
 *                       enum: [ATTENDANT, MECHANIC]
 *                       example: "ATTENDANT"
 *       401:
 *         description: Credenciais inválidas
 */
async function login(req, res) {
  const email = validateEmail(req.body.email, 'email');
  const password = validateString(req.body.password, 'password', { required: true, minLength: 6 });

  try {
    const authService = container.getAuthApplicationService();
    const result = await authService.login(email, password);
    return res.json(result);
  } catch (error) {
    if (error.message === 'Credenciais inválidas') {
      return res.status(401).json({ message: error.message });
    }
    throw error;
  }
}

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registro de novo usuário
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: "João Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@oficina.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "MinhaSenha123"
 *               role:
 *                 type: string
 *                 enum: [ATTENDANT, MECHANIC]
 *                 example: "ATTENDANT"
 *     responses:
 *       201:
 *         description: Usuário registrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 name:
 *                   type: string
 *                   example: "João Silva"
 *                 email:
 *                   type: string
 *                   example: "joao@oficina.com"
 *                 role:
 *                   type: string
 *                   enum: [ATTENDANT, MECHANIC]
 *                   example: "ATTENDANT"
 *       409:
 *         description: Email já cadastrado
 */
async function register(req, res) {
  const name = validateString(req.body.name, 'name', { required: true });
  const email = validateEmail(req.body.email, 'email');
  const password = validateString(req.body.password, 'password', { required: true, minLength: 6 });
  const role = validateEnum(req.body.role, 'role', ['ATTENDANT', 'MECHANIC']);

  try {
    const authService = container.getAuthApplicationService();
    const result = await authService.register(name, email, password, role);
    return res.status(201).json(result);
  } catch (error) {
    if (error.message === 'Email já cadastrado') {
      return res.status(409).json({ message: error.message });
    }
    throw error;
  }
}

module.exports = {
  login,
  register
};
