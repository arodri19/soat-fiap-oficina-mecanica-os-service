const container = require('../infrastructure/container/Container');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @swagger
 * /clients/pf:
 *   post:
 *     summary: Criar cliente pessoa física
 *     tags: [Clientes PF]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - cpf
 *               - email
 *               - address
 *               - number
 *               - state
 *               - cep
 *             properties:
 *               name:
 *                 type: string
 *                 example: "João Silva"
 *               cpf:
 *                 type: string
 *                 example: "12345678901"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@email.com"
 *               address:
 *                 type: string
 *                 example: "Rua das Flores"
 *               number:
 *                 type: string
 *                 example: "123"
 *               state:
 *                 type: string
 *                 example: "SP"
 *               cep:
 *                 type: string
 *                 example: "01234567"
 *     responses:
 *       201:
 *         description: Cliente PF criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientPF'
 */
async function createClientPF(req, res) {
  const clientApplicationService = container.getClientApplicationService();
  const { name, cpf, email, address, number, state, cep } = req.body;
  const client = await clientApplicationService.createClientPF(name, cpf, email, address, number, state, cep);
  return res.status(201).json(client);
}

/**
 * @swagger
 * /clients/pf:
 *   get:
 *     summary: Listar clientes pessoa física
 *     tags: [Clientes PF]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de clientes PF
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ClientPF'
 */
async function listClientsPF(req, res) {
  const clientApplicationService = container.getClientApplicationService();
  const clients = await clientApplicationService.listClientsPF();
  return res.json(clients);
}

/**
 * @swagger
 * /clients/pf/{id}:
 *   get:
 *     summary: Obter cliente pessoa física por ID
 *     tags: [Clientes PF]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do cliente PF
 *     responses:
 *       200:
 *         description: Cliente PF encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientPF'
 *       404:
 *         description: Cliente PF não encontrado
 */
async function getClientPF(req, res) {
  const clientApplicationService = container.getClientApplicationService();
  const id = Number(req.params.id);
  const client = await clientApplicationService.getClientPF(id);
  return res.json(client);
}

/**
 * @swagger
 * /clients/pf/{id}:
 *   put:
 *     summary: Atualizar cliente pessoa física
 *     tags: [Clientes PF]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do cliente PF
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "João Silva"
 *               cpf:
 *                 type: string
 *                 example: "12345678901"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@email.com"
 *               address:
 *                 type: string
 *                 example: "Rua das Flores"
 *               number:
 *                 type: string
 *                 example: "123"
 *               state:
 *                 type: string
 *                 example: "SP"
 *               cep:
 *                 type: string
 *                 example: "01234567"
 *     responses:
 *       200:
 *         description: Cliente PF atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientPF'
 *       404:
 *         description: Cliente PF não encontrado
 */
async function updateClientPF(req, res) {
  const clientApplicationService = container.getClientApplicationService();
  const id = Number(req.params.id);
  const { name, email, address, number, state, cep } = req.body;
  const client = await clientApplicationService.updateClientPF(id, name, email, address, number, state, cep);
  return res.json(client);
}

/**
 * @swagger
 * /clients/pf/{id}:
 *   delete:
 *     summary: Deletar cliente pessoa física
 *     tags: [Clientes PF]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do cliente PF
 *     responses:
 *       204:
 *         description: Cliente PF deletado com sucesso
 *       404:
 *         description: Cliente PF não encontrado
 */
async function deleteClientPF(req, res) {
  const clientApplicationService = container.getClientApplicationService();
  const id = Number(req.params.id);
  await clientApplicationService.deleteClientPF(id);
  return res.status(204).send();
}


/**
 * @swagger
 * /clients/pj:
 *   post:
 *     summary: Criar cliente pessoa jurídica
 *     tags: [Clientes PJ]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - fantasyName
 *               - companyName
 *               - cnpj
 *               - email
 *               - address
 *               - number
 *               - state
 *               - cep
 *               - legalResponsible
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Empresa XYZ Ltda"
 *               fantasyName:
 *                 type: string
 *                 example: "Empresa XYZ"
 *               companyName:
 *                 type: string
 *                 example: "Empresa XYZ Ltda"
 *               cnpj:
 *                 type: string
 *                 example: "12345678000123"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contato@empresa.com"
 *               address:
 *                 type: string
 *                 example: "Av. Paulista"
 *               number:
 *                 type: string
 *                 example: "1000"
 *               state:
 *                 type: string
 *                 example: "SP"
 *               cep:
 *                 type: string
 *                 example: "01310100"
 *               legalResponsible:
 *                 type: string
 *                 example: "João Silva"
 *     responses:
 *       201:
 *         description: Cliente PJ criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientPJ'
 */
async function createClientPJ(req, res) {
  const clientApplicationService = container.getClientApplicationService();
  const { name, fantasyName, companyName, cnpj, email, address, number, state, cep, legalResponsible } = req.body;
  const client = await clientApplicationService.createClientPJ({ name, fantasyName, companyName, cnpj, email, address, number, state, cep, legalResponsible });
  return res.status(201).json(client);
}

/**
 * @swagger
 * /clients/pj:
 *   get:
 *     summary: Listar clientes pessoa jurídica
 *     tags: [Clientes PJ]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de clientes PJ
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ClientPJ'
 */
async function listClientsPJ(req, res) {
  const clientApplicationService = container.getClientApplicationService();
  const clients = await clientApplicationService.listClientsPJ();
  return res.json(clients);
}

/**
 * @swagger
 * /clients/pj/{id}:
 *   get:
 *     summary: Obter cliente pessoa jurídica por ID
 *     tags: [Clientes PJ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do cliente PJ
 *     responses:
 *       200:
 *         description: Cliente PJ encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientPJ'
 *       404:
 *         description: Cliente PJ não encontrado
 */
async function getClientPJ(req, res) {
  const clientApplicationService = container.getClientApplicationService();
  const id = Number(req.params.id);
  const client = await clientApplicationService.getClientPJ(id);
  return res.json(client);
}

/**
 * @swagger
 * /clients/pj/{id}:
 *   put:
 *     summary: Atualizar cliente pessoa jurídica
 *     tags: [Clientes PJ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do cliente PJ
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Empresa XYZ Ltda"
 *               fantasyName:
 *                 type: string
 *                 example: "Empresa XYZ"
 *               companyName:
 *                 type: string
 *                 example: "Empresa XYZ Ltda"
 *               cnpj:
 *                 type: string
 *                 example: "12345678000123"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contato@empresa.com"
 *               address:
 *                 type: string
 *                 example: "Av. Paulista"
 *               number:
 *                 type: string
 *                 example: "1000"
 *               state:
 *                 type: string
 *                 example: "SP"
 *               cep:
 *                 type: string
 *                 example: "01310100"
 *               legalResponsible:
 *                 type: string
 *                 example: "João Silva"
 *     responses:
 *       200:
 *         description: Cliente PJ atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientPJ'
 *       404:
 *         description: Cliente PJ não encontrado
 */
async function updateClientPJ(req, res) {
  const clientApplicationService = container.getClientApplicationService();
  const id = Number(req.params.id);
  const { name, fantasyName, companyName, email, address, number, state, cep, legalResponsible } = req.body;
  const client = await clientApplicationService.updateClientPJ(id, { name, fantasyName, companyName, email, address, number, state, cep, legalResponsible });
  return res.json(client);
}

/**
 * @swagger
 * /clients/pj/{id}:
 *   delete:
 *     summary: Deletar cliente pessoa jurídica
 *     tags: [Clientes PJ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do cliente PJ
 *     responses:
 *       204:
 *         description: Cliente PJ deletado com sucesso
 *       404:
 *         description: Cliente PJ não encontrado
 */
async function deleteClientPJ(req, res) {
  const clientApplicationService = container.getClientApplicationService();
  const id = Number(req.params.id);
  await clientApplicationService.deleteClientPJ(id);
  return res.status(204).send();
}

module.exports = {
  createClientPF,
  listClientsPF,
  getClientPF,
  updateClientPF,
  deleteClientPF,
  createClientPJ,
  listClientsPJ,
  getClientPJ,
  updateClientPJ,
  deleteClientPJ
};
