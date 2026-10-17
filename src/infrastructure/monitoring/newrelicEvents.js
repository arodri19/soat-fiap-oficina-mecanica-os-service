const newrelic = require('newrelic');

// Eventos customizados que alimentam os dashboards da Fase 3:
// volume diário de OS (OrderCreated) e tempo médio de execução por status
// (OrderStatusChanged, via secondsInPreviousStatus).
function recordOrderCreated({ orderId, externalId, servicesCount, budgetValue }) {
  newrelic.recordCustomEvent('OrderCreated', {
    orderId,
    externalId,
    servicesCount,
    budgetValue: budgetValue || 0
  });
}

// "1h 15m 30s" em vez do número bruto de segundos — um serviço de oficina demora
// horas, não segundos, e o widget de duração do New Relic (data_format type=duration)
// exige adivinhar o nome exato da coluna gerada pela query, o que não dá pra
// verificar sem abrir o dashboard. Formatando aqui, o dashboard só exibe a string
// (nenhuma mágica de formatação do lado da New Relic).
function formatDuration(totalSeconds) {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return null;

  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (hours > 0 || minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${remainingSeconds}s`);

  return parts.join(' ');
}

function recordOrderStatusChanged({ orderId, externalId, fromStatus, toStatus, secondsInPreviousStatus }) {
  newrelic.recordCustomEvent('OrderStatusChanged', {
    orderId,
    externalId,
    fromStatus,
    toStatus,
    secondsInPreviousStatus,
    secondsInPreviousStatusLabel: formatDuration(secondsInPreviousStatus)
  });
}

// Snapshot da média REAL (não o último valor) de tempo por status, já formatada —
// publicado por src/services/metrics.service.js depois de consultar a própria New
// Relic (average() sobre o histórico) via NerdGraph. O dashboard mostra só o
// latest() disso, então nunca precisa calcular/formatar nada do lado da New Relic.
function recordOrderStatusAverageDuration({ fromStatus, averageSeconds, averageLabel }) {
  newrelic.recordCustomEvent('OrderStatusAverageDuration', {
    fromStatus,
    averageSeconds,
    averageLabel
  });
}

// Eventos da saga orquestrada (Fase 4): SagaStarted, SagaStepCompleted,
// SagaCompensationStarted, SagaCompensated, SagaCompleted, SagaFailed — alimentam a
// página "Saga / Microsserviços" do dashboard (repositório infra-kube).
function recordSagaEvent(eventType, attributes) {
  newrelic.recordCustomEvent(eventType, { service: 'os-service', ...attributes });
}

module.exports = {
  recordOrderCreated,
  recordSagaEvent,
  recordOrderStatusChanged,
  recordOrderStatusAverageDuration,
  formatDuration
};
