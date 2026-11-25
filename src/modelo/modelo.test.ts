import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ErroArquivo } from './erros';
import { abrirProjeto, salvarProjeto, validarProjeto } from './esquema';
import {
  configurarFabrica, criarAtributo, criarCaso, criarColecao, criarContador, criarObjeto, criarProjeto, restaurarFabrica,
} from './fabrica';
import { migrar } from './migracoes';
import type { Projeto } from './tipos';

beforeEach(() => configurarFabrica({ gerarId: criarContador('t'), agora: () => '2026-01-01T00:00:00.000Z' }));
afterEach(() => restaurarFabrica());

function projetoCompleto(): Projeto {
  const p = criarProjeto({ titulo: 'Alturas da turma', autor: 'Ana' });
  const altura = criarAtributo({ nome: 'Altura', unidade: 'cm', formato: { casas: 1 } });
  const turma = criarAtributo({ nome: 'Turma', tipo: 'categorico', indiceCor: 1 });
  const dobro = criarAtributo({ nome: 'Dobro', formula: 'Altura * 2' });
  const col = criarColecao('Alunos', [altura, turma, dobro], [
    criarCaso({ [altura.id]: 150.5, [turma.id]: 'A', [dobro.id]: 301 }),
    criarCaso({ [altura.id]: null, [turma.id]: 'B', [dobro.id]: null }, true),
  ]);
  p.colecoes.push(col);
  p.objetos.push(criarObjeto('tabela', { estado: { colecaoId: col.id, nested: [1, { a: 'b' }] } }));
  p.globais.fator = 2.5;
  p.historicoEstatisticas.push({ media: 1 });
  return p;
}

describe('fábrica', () => {
  it('gera ids pelo contador injetado', () => {
    const p = criarProjeto();
    expect(p.id).toBe('t-1');
    expect(criarCaso().id).toBe('t-2');
  });

  it('usa randomUUID por padrão', () => {
    restaurarFabrica();
    expect(criarProjeto().id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('cria projeto vazio válido', () => {
    expect(() => validarProjeto(criarProjeto())).not.toThrow();
  });

  it('cria objetos com tamanho e etapa padrão por tipo', () => {
    const g = criarObjeto('grafico');
    expect(g.etapa).toBe('analise');
    expect(g.l).toBeGreaterThan(0);
    expect(criarObjeto('tabela', { x: 5 }).x).toBe(5);
  });
});

describe('esquema', () => {
  it('ida e volta JSON -> Zod -> JSON preserva o projeto', () => {
    const original = projetoCompleto();
    const texto = salvarProjeto(original);
    const reaberto = abrirProjeto(texto);
    expect(reaberto).toStrictEqual(original);
    expect(JSON.parse(salvarProjeto(reaberto))).toStrictEqual(JSON.parse(texto));
  });

  it('não grava seleção nem histórico', () => {
    const texto = salvarProjeto(projetoCompleto());
    expect(texto).not.toMatch(/selecao|desfazer|refazer/);
  });

  it('JSON malformado dá erro claro', () => {
    expect(() => abrirProjeto('{ isso não é json')).toThrow(/danificado/);
  });

  it('campo ausente é apontado em português', () => {
    const { titulo: _t, ...semTitulo } = projetoCompleto();
    const erro = capturar(() => abrirProjeto(JSON.stringify(semTitulo)));
    expect(erro.message).toContain("Falta o campo 'titulo'");
  });

  it('tipo errado e valor inválido são apontados com o caminho', () => {
    const p = JSON.parse(salvarProjeto(projetoCompleto()));
    p.colecoes[0].atributos[0].tipo = 'banana';
    p.objetos[0].x = 'esquerda';
    const erro = capturar(() => abrirProjeto(JSON.stringify(p)));
    expect(erro.detalhes).toContain(
      "O campo 'colecoes[0].atributos[0].tipo' tem um valor inválido; os aceitos são: numerico, categorico, texto, data",
    );
    expect(erro.detalhes).toContain("O campo 'objetos[0].x' deveria ser número");
  });

  it('detecta atributo órfão e ids repetidos', () => {
    const p = JSON.parse(salvarProjeto(projetoCompleto()));
    p.colecoes[0].casos[0].valores.fantasma = 1;
    p.colecoes[0].casos[1].id = p.colecoes[0].casos[0].id;
    const erro = capturar(() => abrirProjeto(JSON.stringify(p)));
    expect(erro.message).toMatch(/atributo que não existe \('fantasma'\)/);
    expect(erro.message).toMatch(/dois casos com o mesmo identificador/);
  });

  it('rejeita conteúdo que não é objeto', () => {
    expect(() => abrirProjeto('[1,2]')).toThrow(/não parece ser um projeto/);
    expect(() => abrirProjeto('42')).toThrow(ErroArquivo);
  });
});

describe('migrações', () => {
  it('versão atual passa sem mudanças', () => {
    const dado = JSON.parse(salvarProjeto(criarProjeto()));
    expect(migrar(dado)).toStrictEqual(dado);
  });

  it('versão ausente ou futura gera erro claro', () => {
    expect(() => migrar({})).toThrow(/não informa a versão/);
    expect(() => migrar({ versao: 9 })).toThrow(/versão mais nova \(versão 9\)/);
  });
});

function capturar(fn: () => unknown): ErroArquivo {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErroArquivo) return e;
    throw e;
  }
  throw new Error('Era esperado um erro');
}
