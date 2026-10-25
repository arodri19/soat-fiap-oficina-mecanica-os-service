const { formatDuration } = require('../../../src/infrastructure/monitoring/newrelicEvents');

describe('formatDuration', () => {
  it('formata segundos menores que um minuto só com "s"', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formata minutos e segundos quando menor que uma hora', () => {
    expect(formatDuration(90)).toBe('1m 30s');
  });

  it('formata horas, minutos e segundos quando maior ou igual a uma hora', () => {
    expect(formatDuration(4530)).toBe('1h 15m 30s'); // 1h 15m 30s = 4530s
  });

  it('arredonda para o segundo mais próximo', () => {
    expect(formatDuration(45.6)).toBe('46s');
  });

  it('trata zero como "0s"', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('retorna null para entrada nula ou inválida', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(NaN)).toBeNull();
  });

  it('nunca fica negativo (protege contra relógio do host retroceder)', () => {
    expect(formatDuration(-10)).toBe('0s');
  });
});
