const vehicleService = require('../services/vehicle.service');

/**
 * @swagger
 * /vehicles:
 *   post:
 *     summary: Criar veículo
 *     tags: [Veículos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plate
 *               - model
 *               - year
 *               - color
 *               - clientPFId
 *             properties:
 *               plate:
 *                 type: string
 *                 example: "ABC1234"
 *               model:
 *                 type: string
 *                 example: "Civic"
 *               year:
 *                 type: integer
 *                 example: 2020
 *               color:
 *                 type: string
 *                 example: "Preto"
 *               clientPFId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Veículo criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 */
async function createVehicle(req, res) {
  const vehicle = await vehicleService.createVehicle(req.body);
  return res.status(201).json(vehicle);
}

/**
 * @swagger
 * /vehicles:
 *   get:
 *     summary: Listar veículos
 *     tags: [Veículos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de veículos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Vehicle'
 */
async function listVehicles(req, res) {
  const vehicles = await vehicleService.listVehicles();
  return res.json(vehicles);
}

/**
 * @swagger
 * /vehicles/{id}:
 *   get:
 *     summary: Obter veículo por ID
 *     tags: [Veículos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do veículo
 *     responses:
 *       200:
 *         description: Veículo encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 *       404:
 *         description: Veículo não encontrado
 */
async function getVehicle(req, res) {
  const id = Number(req.params.id);
  const vehicle = await vehicleService.getVehicle(id);
  if (!vehicle) return res.status(404).json({ message: 'Veículo não encontrado.' });
  return res.json(vehicle);
}

/**
 * @swagger
 * /vehicles/{id}:
 *   put:
 *     summary: Atualizar veículo
 *     tags: [Veículos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do veículo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plate:
 *                 type: string
 *                 example: "ABC1234"
 *               model:
 *                 type: string
 *                 example: "Civic"
 *               year:
 *                 type: integer
 *                 example: 2020
 *               color:
 *                 type: string
 *                 example: "Preto"
 *               clientPFId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Veículo atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 *       404:
 *         description: Veículo não encontrado
 */
async function updateVehicle(req, res) {
  const id = Number(req.params.id);
  const vehicle = await vehicleService.updateVehicle(id, req.body);
  return res.json(vehicle);
}

/**
 * @swagger
 * /vehicles/{id}:
 *   delete:
 *     summary: Deletar veículo
 *     tags: [Veículos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do veículo
 *     responses:
 *       204:
 *         description: Veículo deletado com sucesso
 *       404:
 *         description: Veículo não encontrado
 */
async function deleteVehicle(req, res) {
  const id = Number(req.params.id);
  await vehicleService.deleteVehicle(id);
  return res.status(204).send();
}

module.exports = {
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle
};
