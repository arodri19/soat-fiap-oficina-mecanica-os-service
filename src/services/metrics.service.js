const metricsRepository = require('../repositories/metrics.repository');
const config = require('../config');
const { getAverageSecondsByStatus } = require('../infrastructure/monitoring/newrelicQuery');
const { recordOrderStatusAverageDuration, formatDuration } = require('../infrastructure/monitoring/newrelicEvents');
const { ValidationError } = require('../utils/validation');

async function getAverageExecutionTime() {
  const orders = await metricsRepository.listFinishedOrdersExecutionWindow();

  if (!orders.length) {
    return { averageMinutes: 0, averageHours: 0, totalOrders: 0, byService: [] };
  }

  let totalMinutes = 0;
  const serviceStats = {};

  orders.forEach((order) => {
    const duration = (order.endAt.getTime() - order.startAt.getTime()) / 60000;
    totalMinutes += duration;

    if (order.services) {
      order.services.forEach((os) => {
        const serviceName = os.service.name;
        if (!serviceStats[serviceName]) {
          serviceStats[serviceName] = { total: 0, count: 0 };
        }
        serviceStats[serviceName].total += duration;
        serviceStats[serviceName].count += 1;
      });
    }
  });

  const byService = Object.entries(serviceStats).map(([name, stats]) => {
    const avgMins = stats.total / stats.count;
    return {
      service: name,
      averageMinutes: Number(avgMins.toFixed(2)),
      averageHours: Number((avgMins / 60).toFixed(2)),
      ordersCount: stats.count
    };
  });

  const overallAvgMins = totalMinutes / orders.length;

  return {
    averageMinutes: Number(overallAvgMins.toFixed(2)),
    averageHours: Number((overallAvgMins / 60).toFixed(2)),
    totalOrders: orders.length,
    byService
  };
}

// Recalcula a média REAL de tempo por status (RECEBIDA, EM_DIAGNOSTICO, ...) e
// republica na New Relic já formatada ("1h 15m") — o painel do dashboard só
// mostra o snapshot mais recente disso (latest()), nunca calcula/formata nada
// do lado da New Relic (NRQL não tem operador de módulo para montar essa string).
async function recomputeStatusDurationAverages() {
  if (!config.NEW_RELIC_ACCOUNT_ID || !config.NEW_RELIC_API_KEY) {
    throw new ValidationError('NEW_RELIC_ACCOUNT_ID e NEW_RELIC_API_KEY precisam estar configurados.');
  }

  const averages = await getAverageSecondsByStatus({
    accountId: config.NEW_RELIC_ACCOUNT_ID,
    apiKey: config.NEW_RELIC_API_KEY
  });

  return averages.map(({ fromStatus, averageSeconds }) => {
    const averageLabel = formatDuration(averageSeconds);
    recordOrderStatusAverageDuration({ fromStatus, averageSeconds, averageLabel });
    return { fromStatus, averageSeconds, averageLabel };
  });
}

module.exports = {
  getAverageExecutionTime,
  recomputeStatusDurationAverages
};
