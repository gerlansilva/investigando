// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { obterTipoObjeto, removerTipoObjeto } from '../../app/registro';
import { Grafico, registrarGrafico } from './index';

afterEach(() => removerTipoObjeto('grafico'));

describe('registro do gráfico', () => {
  it('registrarGrafico liga o componente ao tipo "grafico" da mesa', () => {
    removerTipoObjeto('grafico');
    expect(obterTipoObjeto('grafico')).toBeUndefined();
    registrarGrafico();
    expect(obterTipoObjeto('grafico')).toBe(Grafico);
  });
});
