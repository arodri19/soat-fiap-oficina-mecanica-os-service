jest.mock('../../../src/infrastructure/monitoring/newrelicQuery', () => ({
  getAverageSecondsByStatus: jest.fn()
}));
jest.mock('../../../src/infrastructure/monitoring/newrelicEvents', () => ({
  recordOrderStatusAverageDuration: jest.fn(),
  formatDuration: jest.requireActual('../../../src/infrastructure/monitoring/newrelicEvents').formatDuration
}));

const config = require('../../../src/config');
const { getAverageSecondsByStatus } = require('../../../src/infrastructure/monitoring/newrelicQuery');
const { recordOrderStatusAverageDuration } = require('../../../src/infrastructure/monitoring/newrelicEvents');
const metricsService = require('../../../src/services/metrics.service');
const { ValidationError } = require('../../../src/utils/validation');

describe('metricsService.recomputeStatusDurationAverages', () => {
  const originalAccountId = config.NEW_RELIC_ACCOUNT_ID;
  const originalApiKey = config.NEW_RELIC_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    config.NEW_RELIC_ACCOUNT_ID = '8426796';
    config.NEW_RELIC_API_KEY = 'NRAK-fake';
  });

  afterAll(() => {
    config.NEW_RELIC_ACCOUNT_ID = originalAccountId;
    config.NEW_RELIC_API_KEY = originalApiKey;
  });

  it('lança ValidationError quando as credenciais não estão configuradas', async () => {
    config.NEW_RELIC_ACCOUNT_ID = '';
    await expect(metricsService.recomputeStatusDurationAverages()).rejects.toThrow(ValidationError);
    expect(getAverageSecondsByStatus).not.toHaveBeenCalled();
  });

  it('formata cada média e republica um evento por status', async () => {
    getAverageSecondsByStatus.mockResolvedValue([
      { fromStatus: 'RECEBIDA', averageSeconds: 12 },
      { fromStatus: 'EM_DIAGNOSTICO', averageSeconds: 4530 } // 1h 15m 30s
    ]);

    const result = await metricsService.recomputeStatusDurationAverages();

    expect(result).toEqual([
      { fromStatus: 'RECEBIDA', averageSeconds: 12, averageLabel: '12s' },
      { fromStatus: 'EM_DIAGNOSTICO', averageSeconds: 4530, averageLabel: '1h 15m 30s' }
    ]);
    expect(recordOrderStatusAverageDuration).toHaveBeenCalledTimes(2);
    expect(recordOrderStatusAverageDuration).toHaveBeenCalledWith({
      fromStatus: 'EM_DIAGNOSTICO',
      averageSeconds: 4530,
      averageLabel: '1h 15m 30s'
    });
  });
});
