const serviceService = require('../services/service.service');

/**
 * @swagger
 * /services:
 *   post:
 *     summary: Criar serviço
 *     tags: [Serviços]
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
 *               - slaMinutes
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Troca de óleo"
 *               slaMinutes:
 *                 type: integer
 *                 example: 60
 *     responses:
 *       201:
 *         description: Serviço criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 */
async function createService(req, res) {
  const service = await serviceService.createService(req.body);
  return res.status(201).json(service);
}

/**
 * @swagger
 * /services:
 *   get:
 *     summary: Listar serviços
 *     tags: [Serviços]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de serviços
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 */
async function listServices(req, res) {
  const services = await serviceService.listServices();
  return res.json(services);
}

/**
 * @swagger
 * /services/{id}:
 *   get:
 *     summary: Obter serviço por ID
 *     tags: [Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do serviço
 *     responses:
 *       200:
 *         description: Serviço encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       404:
 *         description: Serviço não encontrado
 */
async function getService(req, res) {
  const id = Number(req.params.id);
  const service = await serviceService.getService(id);
  if (!service) return res.status(404).json({ message: 'Serviço não encontrado.' });
  return res.json(service);
}

/**
 * @swagger
 * /services/{id}:
 *   put:
 *     summary: Atualizar serviço
 *     tags: [Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do serviço
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Troca de óleo"
 *               slaMinutes:
 *                 type: integer
 *                 example: 60
 *     responses:
 *       200:
 *         description: Serviço atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       404:
 *         description: Serviço não encontrado
 */
async function updateService(req, res) {
  const id = Number(req.params.id);
  const service = await serviceService.updateService(id, req.body);
  return res.json(service);
}

/**
 * @swagger
 * /services/{id}:
 *   delete:
 *     summary: Deletar serviço
 *     tags: [Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do serviço
 *     responses:
 *       204:
 *         description: Serviço deletado com sucesso
 *       404:
 *         description: Serviço não encontrado
 */
async function deleteService(req, res) {
  const id = Number(req.params.id);
  await serviceService.deleteService(id);
  return res.status(204).send();
}

module.exports = {
  createService,
  listServices,
  getService,
  updateService,
  deleteService
};
