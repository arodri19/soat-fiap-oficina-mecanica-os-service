const metricsService = require('../services/metrics.service');

/**
 * @swagger
 * /metrics/average-execution-time:
 *   get:
 *     summary: Obter tempo médio de execução das ordens de serviço
 *     tags: [Métricas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tempo médio calculado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 averageMinutes:
 *                   type: number
 *                   format: float
 *                   example: 45.5
 *                   description: Tempo médio em minutos
 *                 totalOrders:
 *                   type: integer
 *                   example: 10
 *                   description: Número total de ordens finalizadas
 *                 byService:
 *                   type: array
 *                   description: Média de tempo por tipo de serviço
 *                   items:
 *                     type: object
 *                     properties:
 *                       service:
 *                         type: string
 *                         example: "Troca de Óleo"
 *                       averageMinutes:
 *                         type: number
 *                         format: float
 *                         example: 60.0
 *                       ordersCount:
 *                         type: integer
 *                         example: 5
 */
async function getAverageExecutionTime(req, res) {
  const result = await metricsService.getAverageExecutionTime();
  return res.json(result);
}

/**
 * @swagger
 * /metrics/status-duration-averages/recompute:
 *   post:
 *     summary: Recalcular a média real de tempo por status e republicar na New Relic
 *     description: Consulta a New Relic (average() sobre o histórico de OrderStatusChanged), formata cada média como "1h 15m" e publica um evento OrderStatusAverageDuration por status — é isso que o painel "Tempo médio de execução por status" do dashboard exibe (latest() desse evento).
 *     tags: [Métricas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Médias recalculadas e republicadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   fromStatus:
 *                     type: string
 *                     example: EM_DIAGNOSTICO
 *                   averageSeconds:
 *                     type: number
 *                     example: 84.7
 *                   averageLabel:
 *                     type: string
 *                     example: "1m 25s"
 *       400:
 *         description: NEW_RELIC_ACCOUNT_ID/NEW_RELIC_API_KEY não configurados
 */
async function recomputeStatusDurationAverages(req, res) {
  const result = await metricsService.recomputeStatusDurationAverages();
  return res.json(result);
}

module.exports = {
  getAverageExecutionTime,
  recomputeStatusDurationAverages
};
