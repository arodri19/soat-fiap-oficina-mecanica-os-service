const partService = require('../services/part.service');

/**
 * @swagger
 * /parts:
 *   post:
 *     summary: Criar peça
 *     tags: [Peças]
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
 *               - type
 *               - model
 *               - color
 *               - quantity
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Filtro de óleo"
 *               type:
 *                 type: string
 *                 example: "Filtro"
 *               model:
 *                 type: string
 *                 example: "Honda Civic"
 *               color:
 *                 type: string
 *                 example: "Preto"
 *               quantity:
 *                 type: integer
 *                 example: 10
 *     responses:
 *       201:
 *         description: Peça criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Part'
 */
async function createPart(req, res) {
  const part = await partService.createPart(req.body);
  return res.status(201).json(part);
}

/**
 * @swagger
 * /parts:
 *   get:
 *     summary: Listar peças
 *     tags: [Peças]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de peças
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Part'
 */
async function listParts(req, res) {
  const parts = await partService.listParts();
  return res.json(parts);
}

/**
 * @swagger
 * /parts/{id}:
 *   get:
 *     summary: Obter peça por ID
 *     tags: [Peças]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da peça
 *     responses:
 *       200:
 *         description: Peça encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Part'
 *       404:
 *         description: Peça não encontrada
 */
async function getPart(req, res) {
  const id = Number(req.params.id);
  const part = await partService.getPart(id);
  if (!part) return res.status(404).json({ message: 'Peça não encontrada.' });
  return res.json(part);
}

/**
 * @swagger
 * /parts/{id}:
 *   put:
 *     summary: Atualizar peça
 *     tags: [Peças]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da peça
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Filtro de óleo"
 *               type:
 *                 type: string
 *                 example: "Filtro"
 *               model:
 *                 type: string
 *                 example: "Honda Civic"
 *               color:
 *                 type: string
 *                 example: "Preto"
 *               quantity:
 *                 type: integer
 *                 example: 10
 *     responses:
 *       200:
 *         description: Peça atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Part'
 *       404:
 *         description: Peça não encontrada
 */
async function updatePart(req, res) {
  const id = Number(req.params.id);
  const part = await partService.updatePart(id, req.body);
  return res.json(part);
}

/**
 * @swagger
 * /parts/{id}:
 *   delete:
 *     summary: Deletar peça
 *     tags: [Peças]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da peça
 *     responses:
 *       204:
 *         description: Peça deletada com sucesso
 *       404:
 *         description: Peça não encontrada
 */
async function deletePart(req, res) {
  const id = Number(req.params.id);
  await partService.deletePart(id);
  return res.status(204).send();
}

module.exports = {
  createPart,
  listParts,
  getPart,
  updatePart,
  deletePart
};
