import { describe, expect, it } from 'vitest';
import {
  alternarMedida, definirCorPor, definirEixo, definirFiltro, definirIcone, definirLarguraIntervalos, definirModo,
  estadoPadrao, lerEstado, remexer, removerEixo, trocarEixos, validarEstado, type EstadoGrafico,
} from './estado';

const base = (): EstadoGrafico => estadoPadrao('col1', 7);

describe('estado do gráfico', () => {
  it('padrão é válido e sem eixos', () => {
    const e = base();
    expect(e.x).toBeNull();
    expect(e.y).toBeNull();
    expect(e.mostrar).toEqual([]);
    expect(validarEstado(e)).toEqual(e);
  });

  it('definirEixo usa separar por padrão e mantém o modo ao trocar de atributo', () => {
    let e = definirEixo(base(), 'x', 'idade');
    expect(e.x).toEqual({ atributoId: 'idade', modo: 'separar' });
    e = definirModo(e, 'x', 'empilhar');
    e = definirEixo(e, 'x', 'altura');
    expect(e.x).toEqual({ atributoId: 'altura', modo: 'empilhar' });
  });

  it('largura dos intervalos só sobrevive se o atributo for o mesmo', () => {
    let e = definirEixo(base(), 'x', 'idade', 'intervalos');
    e = definirLarguraIntervalos(e, 'x', 5);
    expect(definirEixo(e, 'x', 'idade').x?.intervalos).toEqual({ largura: 5 });
    expect(definirEixo(e, 'x', 'altura').x?.intervalos).toBeUndefined();
    expect(definirLarguraIntervalos(e, 'x', undefined).x?.intervalos).toBeUndefined();
    expect(definirLarguraIntervalos(e, 'x', -3).x?.intervalos).toBeUndefined();
  });

  it('não altera o estado recebido', () => {
    const e = definirEixo(base(), 'x', 'a');
    const copia = structuredClone(e);
    definirModo(e, 'x', 'ordenar');
    trocarEixos(e);
    alternarMedida(e, 'media');
    remexer(e, 99);
    expect(e).toEqual(copia);
  });

  it('trocarEixos inverte x e y', () => {
    let e = definirEixo(base(), 'x', 'a', 'empilhar');
    e = definirEixo(e, 'y', 'b', 'separar');
    const t = trocarEixos(e);
    expect(t.x).toEqual(e.y);
    expect(t.y).toEqual(e.x);
    expect(trocarEixos(t)).toEqual(e);
  });

  it('removerEixo e definirModo sem eixo', () => {
    const e = definirEixo(base(), 'y', 'b');
    expect(removerEixo(e, 'y').y).toBeNull();
    expect(definirModo(base(), 'x', 'ordenar')).toEqual(base());
  });

  it('alternarMedida liga, desliga e mantém ordem canônica', () => {
    let e = alternarMedida(base(), 'moda');
    e = alternarMedida(e, 'media');
    expect(e.mostrar).toEqual(['media', 'moda']);
    e = alternarMedida(e, 'media');
    expect(e.mostrar).toEqual(['moda']);
  });

  it('definirCorPor define e limpa', () => {
    const e = definirCorPor(base(), 'sexo');
    expect(e.corPor).toBe('sexo');
    expect('corPor' in definirCorPor(e, undefined)).toBe(false);
  });

  it('definirIcone limita o tamanho e troca a forma', () => {
    expect(definirIcone(base(), { tamanho: 1000 }).icone.tamanho).toBe(32);
    expect(definirIcone(base(), { tamanho: 1 }).icone.tamanho).toBe(4);
    expect(definirIcone(base(), { tamanho: NaN }).icone.tamanho).toBe(12);
    expect(definirIcone(base(), { forma: 'quadrado' }).icone).toEqual({ forma: 'quadrado', tamanho: 12 });
  });

  it('definirFiltro ignora texto vazio', () => {
    expect(definirFiltro(base(), 'idade > 3').filtro).toBe('idade > 3');
    expect('filtro' in definirFiltro(definirFiltro(base(), 'x'), '  ')).toBe(false);
  });

  it('remexer troca a semente e volta à nuvem', () => {
    const e = definirEixo(base(), 'x', 'a');
    const r = remexer(e, 123);
    expect(r.semente).toBe(123);
    expect(r.x).toBeNull();
    expect(remexer(e, e.semente).semente).not.toBe(e.semente);
  });

  describe('validação (Zod)', () => {
    it('rejeita lixo', () => {
      expect(validarEstado(null)).toBeNull();
      expect(validarEstado(42)).toBeNull();
      expect(validarEstado({})).toBeNull();
      expect(validarEstado({ colecaoId: 'a', x: { atributoId: 'q', modo: 'inventado' } })).toBeNull();
      expect(validarEstado({ colecaoId: 'a', icone: { forma: 'circulo', tamanho: 9999 } })).toBeNull();
      expect(validarEstado({ colecaoId: 'a', semente: 1.5 })).toBeNull();
    });
    it('preenche padrões em estado parcial e remove duplicatas de medidas', () => {
      const e = validarEstado({ colecaoId: 'a', mostrar: ['moda', 'media', 'moda'] });
      expect(e).toEqual({
        colecaoId: 'a', x: null, y: null, icone: { forma: 'circulo', tamanho: 12 }, mostrar: ['media', 'moda'], semente: 1,
      });
    });
    it('lerEstado cai no padrão', () => {
      expect(lerEstado(undefined, 'c').colecaoId).toBe('c');
      expect(lerEstado({ colecaoId: 'z', semente: 3 }).semente).toBe(3);
    });
  });
});
