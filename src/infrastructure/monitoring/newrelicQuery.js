// Consulta a API GraphQL (NerdGraph) da New Relic — usa a User API Key (NRAK-...),
// diferente da License Key do agente APM (que só INGERE dados, não consulta).
// É o único jeito de calcular a média real de tempo por status: essa duração não
// fica persistida no Postgres, só nos eventos customizados já publicados na New
// Relic (OrderStatusChanged, ver newrelicEvents.js).
const NERDGRAPH_URL = 'https://api.newrelic.com/graphql';

async function runNrql({ accountId, apiKey, query }) {
  const escapedQuery = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const response = await fetch(NERDGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'API-Key': apiKey },
    body: JSON.stringify({
      query: `{ actor { account(id: ${Number(accountId)}) { nrql(query: "${escapedQuery}") { results } } } }`
    })
  });

  if (!response.ok) {
    throw new Error(`NerdGraph respondeu ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  if (body.errors?.length) {
    throw new Error(`NerdGraph: ${body.errors.map((e) => e.message).join('; ')}`);
  }

  return body.data.actor.account.nrql.results;
}

// Média real (não o último valor) de secondsInPreviousStatus por status, calculada
// pela própria New Relic (average() sobre todos os eventos da janela) — só a
// FORMATAÇÃO em "1h 15m" acontece aqui no código (NRQL não tem operador de módulo,
// então não dá pra montar essa string dentro da query).
async function getAverageSecondsByStatus({ accountId, apiKey, sinceClause = '1 week ago' }) {
  const query = `SELECT average(secondsInPreviousStatus) AS 'avg' FROM OrderStatusChanged FACET fromStatus SINCE ${sinceClause}`;
  const results = await runNrql({ accountId, apiKey, query });
  return results.map((row) => ({ fromStatus: row.facet, averageSeconds: row.avg }));
}

module.exports = { getAverageSecondsByStatus };
