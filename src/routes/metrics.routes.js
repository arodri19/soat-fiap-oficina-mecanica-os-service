const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { getAverageExecutionTime, recomputeStatusDurationAverages } = require('../controllers/metrics.controller');

const router = express.Router();
// asyncHandler nas duas: Express 4 não captura promise rejeitada em handler async
// sozinho — sem isso, um erro (ex: New Relic fora do ar) deixa a requisição travada
// em vez de cair no middleware de erro global.
router.get('/average-execution-time', asyncHandler(getAverageExecutionTime));
router.post('/status-duration-averages/recompute', asyncHandler(recomputeStatusDurationAverages));
module.exports = router;
