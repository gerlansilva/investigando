import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { criarProjeto } from '../modelo';
import { criarObjeto } from '../modelo/fabrica';
import {
  criarRegistro, desligarRegistro, eventosDaTransicao, LIMITE_EVENTOS, lerRegistroJSON, ligarRegistro, limparRegistro, paraCSV, paraJSON,
  registrarEvento, TIPOS_EVENTO, type Registro,
} from './registro';

const T = new Date('2026-01-02T03:04:05.000Z');
const ligado = () => ligarRegistro(criarRegistro());
const foto = (p = criarProjeto(), selecaoCasos: Record<string, Set<string>> = {}) => ({ projeto: p, selecaoCasos });

describe('registro de pesquisa', () => {
  it('nasce desligado e não guarda nada enquanto desligado', () => {
    const r = criarRegistro();
    expect(r.ativo).toBe(false);
    expect(registrarEvento(r, 'etapa_mudou', {}, T)).toBe(r);
    expect(registrarEvento(desligarRegistro(ligado()), 'etapa_mudou', {}, T).eventos).toHaveLength(0);
  });

  it('registra com carimbo de tempo ISO e limpa', () => {
    const r = registrarEvento(ligado(), 'objeto_criado', { objeto: 'tabela' }, T);
    expect(r.eventos).toEqual([{ t: '2026-01-02T03:04:05.000Z', tipo: 'objeto_criado', detalhe: { objeto: 'tabela' } }]);
    expect(limparRegistro(r).eventos).toEqual([]);
    expect(limparRegistro(r).ativo).toBe(true);
  });

  it('detalhes ficam curtos e simples', () => {
    const r = registrarEvento(ligado(), 'etapa_mudou', { x: 'a'.repeat(500), n: 3, ruim: Number.NaN, obj: {} as never }, T);
    expect(r.eventos[0]!.detalhe).toEqual({ x: 'a'.repeat(40), n: 3 });
  });

  it('respeita o teto de eventos, descartando os mais antigos', () => {
    let r: Registro = ligado();
    for (let i = 0; i < LIMITE_EVENTOS + 3; i++) r = registrarEvento(r, 'caso_selecionado', { i }, T);
    expect(r.eventos).toHaveLength(LIMITE_EVENTOS);
    expect(r.eventos[0]!.detalhe.i).toBe(3);
  });

  it('JSON faz ida e volta; lixo é recusado', () => {
    fc.assert(
      fc.property(fc.array(fc.record({ tipo: fc.constantFrom(...TIPOS_EVENTO), n: fc.integer({ min: 0, max: 99 }), s: fc.string({ maxLength: 20 }) }), { maxLength: 20 }), (itens) => {
        let r: Registro = ligado();
        for (const it of itens) r = registrarEvento(r, it.tipo, { n: it.n, s: it.s }, T);
        expect(lerRegistroJSON(paraJSON(r))).toEqual(r.eventos);
      }),
    );
    expect(lerRegistroJSON('não é json')).toBeNull();
    expect(lerRegistroJSON('{"eventos":[{"t":"x","tipo":"outro","detalhe":{}}]}')).toBeNull();
  });

  it('CSV tem cabeçalho, uma linha por evento e protege contra fórmulas e aspas', () => {
    let r: Registro = ligado();
    r = registrarEvento(r, 'etapa_mudou', { de: 'plano', para: 'dados' }, T);
    r = registrarEvento(r, 'objeto_criado', { objeto: '=SOMA(A1)', nota: 'a"b,c' }, T);
    const linhas = paraCSV(r).trim().split('\r\n');
    expect(linhas[0]).toBe('momento,evento,detalhe');
    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toBe('2026-01-02T03:04:05.000Z,etapa_mudou,de=plano para=dados');
    expect(linhas[2]).toContain('objeto=');
    expect(linhas[2]).toContain('""');
  });

  describe('eventos da transição', () => {
    it('etapa mudou, objeto criado, caso selecionado e simulação feita', () => {
      const a = criarProjeto();
      const b = structuredClone(a);
      b.cicloAtual = 'dados';
      b.objetos.push({ ...criarObjeto('simulador'), id: 's', estado: { rodada: 1 } });
      const tipos = eventosDaTransicao(foto(a), foto(b, { c: new Set(['1', '2']) })).map((e) => e.tipo);
      expect(tipos).toEqual(['etapa_mudou', 'objeto_criado', 'caso_selecionado', 'simulacao_feita']);
    });

    it('sem mudança, nenhum evento; outro projeto, nenhum evento; limpar seleção não gera evento', () => {
      const a = criarProjeto();
      expect(eventosDaTransicao(foto(a), foto(a))).toEqual([]);
      const outro = { ...structuredClone(a), id: 'outro', cicloAtual: 'dados' as const };
      expect(eventosDaTransicao(foto(a), foto(outro))).toEqual([]);
      expect(eventosDaTransicao(foto(a, { c: new Set(['1']) }), foto(a, {}))).toEqual([]);
    });

    it('os detalhes não carregam identificadores', () => {
      const a = criarProjeto();
      const b = structuredClone(a);
      b.objetos.push({ ...criarObjeto('tabela'), id: 'segredo-123' });
      expect(JSON.stringify(eventosDaTransicao(foto(a), foto(b)))).not.toContain('segredo');
    });
  });
});
