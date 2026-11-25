import { describe, expect, it, vi } from 'vitest';
import { exportarPng, prepararExportacao, type CanvasExportacao } from './exportar';
import { A_MEIO, A_TEMPO, colecaoPequena, criarContextoSimulado, estadoCom } from './testeUtil';

function canvasFalso(blob: Blob | null = new Blob(['png'], { type: 'image/png' })) {
  const sim = criarContextoSimulado();
  const canvas: CanvasExportacao = {
    width: 0, height: 0,
    getContext: () => sim.ctx,
    toBlob: (cb) => cb(blob),
  };
  const criar = vi.fn((l: number, a: number) => {
    canvas.width = l;
    canvas.height = a;
    return canvas;
  });
  return { canvas, criar, chamadas: sim.chamadas };
}

describe('exportar PNG', () => {
  const estado = estadoCom({ x: { atributoId: A_MEIO, modo: 'separar' }, y: { atributoId: A_TEMPO, modo: 'separar' }, mostrar: ['media', 'contagem'] });

  it('devolve um Blob PNG e redesenha pontos e vetores no canvas fora da tela', async () => {
    const f = canvasFalso();
    const blob = await exportarPng(estado, colecaoPequena(), { largura: 600, altura: 400, criarCanvas: f.criar });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(f.criar).toHaveBeenCalledWith(1200, 800); // escala 2 por padrão
    const nomes = f.chamadas.map((c) => c.nome);
    expect(nomes).toContain('fillRect'); // fundo branco
    expect(nomes).toContain('fill'); // pontos
    expect(nomes).toContain('lineTo'); // eixos e linhas de média
    const textos = f.chamadas.filter((c) => c.nome === 'fillText').map((c) => c.args[0]);
    expect(textos).toEqual(expect.arrayContaining(['A', 'B', 'C', 'Meio', 'Tempo (min)', 'média 1,25', '2']));
    expect(f.chamadas.find((c) => c.nome === 'setTransform')!.args.slice(0, 4)).toEqual([2, 0, 0, 2]);
  });

  it('escala configurável e legenda alarga a imagem', async () => {
    const f = canvasFalso();
    await exportarPng({ ...estado, corPor: A_MEIO }, colecaoPequena(), { largura: 600, altura: 400, escala: 1, criarCanvas: f.criar });
    expect(f.criar.mock.calls[0]![0]).toBeGreaterThan(600);
    expect(f.criar.mock.calls[0]![1]).toBe(400);
    const textos = f.chamadas.filter((c) => c.nome === 'fillText').map((c) => c.args[0]);
    expect(textos).toEqual(expect.arrayContaining(['Meio']));
  });

  it('selecionados recebem anel', async () => {
    const f = canvasFalso();
    await exportarPng(estado, colecaoPequena(), { largura: 600, altura: 400, selecao: new Set(['c1']), criarCanvas: f.criar });
    expect(f.chamadas.filter((c) => c.nome === 'arc').some((c) => Number(c.args[2]) > 6)).toBe(true);
  });

  it('erro em português quando o canvas não gera imagem', async () => {
    const f = canvasFalso(null);
    await expect(exportarPng(estado, colecaoPequena(), { largura: 600, altura: 400, criarCanvas: f.criar })).rejects.toThrow('Não consegui criar a imagem.');
    const semCtx: CanvasExportacao = { width: 0, height: 0, getContext: () => null, toBlob: (cb) => cb(null) };
    await expect(exportarPng(estado, colecaoPequena(), { largura: 600, altura: 400, criarCanvas: () => semCtx })).rejects.toThrow('Não consegui criar a imagem.');
  });

  it('também aceita canvas com convertToBlob (OffscreenCanvas)', async () => {
    const sim = criarContextoSimulado();
    const off: CanvasExportacao = { width: 0, height: 0, getContext: () => sim.ctx, convertToBlob: async () => new Blob(['x'], { type: 'image/png' }) };
    const blob = await exportarPng(estado, colecaoPequena(), { largura: 400, altura: 300, criarCanvas: () => off });
    expect(blob.size).toBe(1);
  });

  it('parte lógica: posições finais, cores e índices selecionados', () => {
    const c = prepararExportacao({ ...estado, corPor: A_MEIO }, colecaoPequena(), { largura: 600, altura: 400, selecao: new Set(['c2', 'zzz']) });
    expect(c.cores).toHaveLength(6);
    expect(c.posicoes).toHaveLength(12);
    expect([...c.indicesSelecionados]).toEqual([2]);
    expect(c.margem.esq).toBeGreaterThan(0);
  });

  it('coleção ausente exporta sem quebrar', async () => {
    const f = canvasFalso();
    const blob = await exportarPng(estadoCom({}), undefined, { largura: 300, altura: 200, criarCanvas: f.criar });
    expect(blob.size).toBeGreaterThan(0);
  });
});
