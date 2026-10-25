const { getAverageSecondsByStatus } = require('../../../src/infrastructure/monitoring/newrelicQuery');

describe('getAverageSecondsByStatus', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('mapeia os resultados da NRQL para {fromStatus, averageSeconds}', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          actor: {
            account: {
              nrql: {
                results: [
                  { facet: 'RECEBIDA', avg: 12.5 },
                  { facet: 'EM_DIAGNOSTICO', avg: 84.7 }
                ]
              }
            }
          }
        }
      })
    });

    const result = await getAverageSecondsByStatus({ accountId: 8426796, apiKey: 'NRAK-fake' });

    expect(result).toEqual([
      { fromStatus: 'RECEBIDA', averageSeconds: 12.5 },
      { fromStatus: 'EM_DIAGNOSTICO', averageSeconds: 84.7 }
    ]);
  });

  it('manda a API-Key e o account id certos pro NerdGraph', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { actor: { account: { nrql: { results: [] } } } } })
    });

    await getAverageSecondsByStatus({ accountId: 8426796, apiKey: 'NRAK-fake' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.newrelic.com/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'API-Key': 'NRAK-fake' })
      })
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.query).toContain('account(id: 8426796)');
  });

  it('lança erro quando o HTTP não é ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

    await expect(getAverageSecondsByStatus({ accountId: 1, apiKey: 'x' })).rejects.toThrow(/500/);
  });

  it('lança erro quando o NerdGraph devolve "errors"', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'Invalid API key' }] })
    });

    await expect(getAverageSecondsByStatus({ accountId: 1, apiKey: 'x' })).rejects.toThrow(/Invalid API key/);
  });
});
