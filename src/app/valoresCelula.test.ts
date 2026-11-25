import { describe, expect, it } from 'vitest';
import { analisarNumero, formatarNumero } from './valoresCelula';

describe('analisarNumero', () => {
  it.each([
    ['12,5', 12.5], ['12.5', 12.5], ['  7 ', 7], ['-3,25', -3.25], ['1.200,5', 1200.5], ['1,200.5', 1200.5], ['.5', 0.5], ['10.', 10],
  ])('%s -> %s', (entrada, esperado) => {
    expect(analisarNumero(entrada)).toBe(esperado);
  });
  it.each(['', '   ', 'abc', '1,2,3', '12a', '--1', '1e3'])('rejeita %j', (entrada) => {
    expect(analisarNumero(entrada)).toBeNull();
  });
  it('formata com vírgula e sem separador de milhar', () => {
    expect(formatarNumero(12.5)).toBe('12,5');
    expect(formatarNumero(1200)).toBe('1200');
    expect(formatarNumero(2, 2)).toBe('2,00');
  });
});
