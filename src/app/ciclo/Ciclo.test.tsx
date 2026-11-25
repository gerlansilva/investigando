// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { exemploNaEtapa, limparAposCadaTeste } from '../testeUtil';
import { criarArmazem } from '../../estado/store';
import { cicloCorrente, editarCelula, marcarEtapaConcluida, definirCampoConclusao } from '../../estado/comandos';
import { criarProjeto } from '../../modelo/fabrica';
import type { EtapaCiclo, Projeto } from '../../modelo/tipos';
import { avisosDaPergunta } from './pergunta';
import { registrarCriadorDeObjeto, registrarSugerido, removerCriadorDeObjeto, removerSugerido } from './objetosSugeridos';
import { criarObjeto } from '../../estado/comandos';
import { criarObjeto as fabricar } from '../../modelo/fabrica';

limparAposCadaTeste();

function montar(etapa: EtapaCiclo = 'problema', perfil: 'iniciais' | 'finais' = 'iniciais', alterar?: (p: Projeto) => void) {
  const p = exemploNaEtapa(etapa);
  alterar?.(p);
  const armazem = criarArmazem(p);
  render(<App armazem={armazem} />);
  if (perfil === 'finais') fireEvent.change(screen.getByLabelText('Perfil'), { target: { value: 'finais' } });
  return armazem;
}

const botaoEtapa = (nome: string) => screen.getByRole('button', { name: new RegExp(`^${nome},`) });
const tiposVisiveis = () => [...document.querySelectorAll('.mesa [data-objeto]')].map((e) => e.getAttribute('data-objeto'));

describe('barra de etapas', () => {
  it('mostra as cinco etapas com aria em português, etapa atual e concluídas', () => {
    montar('dados', 'iniciais', (p) => { p.ciclos[0]!.etapasConcluidas = ['problema', 'plano']; });
    const nav = screen.getByRole('navigation', { name: 'Etapas da investigação' });
    expect(within(nav).getAllByRole('button')).toHaveLength(5);
    expect(botaoEtapa('Dados')).toHaveAccessibleName('Dados, etapa 3 de 5, etapa atual');
    expect(botaoEtapa('Dados')).toHaveAttribute('aria-current', 'step');
    expect(botaoEtapa('Problema')).toHaveAccessibleName('Problema, etapa 1 de 5, concluída');
    expect(botaoEtapa('Análise')).toHaveAccessibleName('Análise, etapa 4 de 5');
    expect(botaoEtapa('Análise')).not.toHaveAttribute('aria-current');
  });

  it('navegação livre por clique, sem bloqueio', async () => {
    const a = montar('problema');
    await userEvent.click(botaoEtapa('Conclusão'));
    expect(a.getState().projeto.cicloAtual).toBe('conclusao');
    await userEvent.click(botaoEtapa('Plano'));
    expect(a.getState().projeto.cicloAtual).toBe('plano');
  });

  it('teclado: Enter ativa, setas, Home e End navegam e movem o foco', async () => {
    const a = montar('problema');
    botaoEtapa('Problema').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(a.getState().projeto.cicloAtual).toBe('plano');
    expect(botaoEtapa('Plano')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(a.getState().projeto.cicloAtual).toBe('conclusao');
    await userEvent.keyboard('{ArrowLeft}');
    expect(a.getState().projeto.cicloAtual).toBe('analise');
    await userEvent.keyboard('{Home}');
    expect(a.getState().projeto.cicloAtual).toBe('problema');
    await userEvent.tab();
    expect(botaoEtapa('Plano')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(a.getState().projeto.cicloAtual).toBe('plano');
  });

  it('desfazer volta a etapa anterior', async () => {
    const a = montar('problema');
    await userEvent.click(botaoEtapa('Análise'));
    expect(a.getState().historico.desfazer.at(-1)!.rotulo).toBe('Mudar para a etapa Análise');
    await userEvent.click(screen.getByRole('button', { name: /^Desfazer/ }));
    expect(a.getState().projeto.cicloAtual).toBe('problema');
    expect(botaoEtapa('Problema')).toHaveAttribute('aria-current', 'step');
  });
});

describe('pergunta-guia por perfil', () => {
  it('iniciais e finais usam textos diferentes', () => {
    montar('analise');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('O que os dados mostram? Monte um gráfico e observe.');
    fireEvent.change(screen.getByLabelText('Perfil'), { target: { value: 'finais' } });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Que padrões, comparações e medidas resumem os dados?');
  });
});

describe('mesa por etapa', () => {
  it('trocar de etapa filtra os objetos', async () => {
    montar('problema');
    expect(tiposVisiveis()).toEqual(['exemplo-obj-pergunta']);
    await userEvent.click(botaoEtapa('Plano'));
    expect(tiposVisiveis()).toEqual(['exemplo-obj-tabela-plano']);
    await userEvent.click(botaoEtapa('Dados'));
    expect(tiposVisiveis()).toEqual(['exemplo-obj-tabela', 'exemplo-obj-fichas']);
    await userEvent.click(botaoEtapa('Análise'));
    expect(tiposVisiveis()).toEqual(['exemplo-obj-grafico']);
  });

  it('Mesa livre mostra todos; fica escondida no perfil iniciais e visível no finais', async () => {
    montar('problema');
    expect(screen.queryByRole('button', { name: 'Mesa livre' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Perfil'), { target: { value: 'finais' } });
    const botao = screen.getByRole('button', { name: 'Mesa livre' });
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    expect(tiposVisiveis()).toHaveLength(1);
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-pressed', 'true');
    expect(tiposVisiveis()).toHaveLength(5);
    await userEvent.click(botao);
    expect(tiposVisiveis()).toHaveLength(1);
  });

  it('voltar ao perfil iniciais com a mesa livre ligada volta a filtrar', async () => {
    montar('problema', 'finais');
    await userEvent.click(screen.getByRole('button', { name: 'Mesa livre' }));
    expect(tiposVisiveis()).toHaveLength(5);
    fireEvent.change(screen.getByLabelText('Perfil'), { target: { value: 'iniciais' } });
    expect(tiposVisiveis()).toHaveLength(1);
  });

  it('objeto novo nasce com a etapa atual', async () => {
    const a = montar('analise');
    await userEvent.click(screen.getByRole('button', { name: 'Novo objeto: Texto' }));
    const novo = a.getState().projeto.objetos.at(-1)!;
    expect(novo.tipo).toBe('texto');
    expect(novo.etapa).toBe('analise');
    await userEvent.click(botaoEtapa('Dados'));
    await userEvent.click(screen.getByRole('button', { name: 'Novo objeto: Imagem' }));
    expect(a.getState().projeto.objetos.at(-1)!.etapa).toBe('dados');
    expect(tiposVisiveis()).not.toContain(novo.id);
  });

  it('etapa vazia mostra convite com os objetos sugeridos, ligados aos mesmos dados', async () => {
    const a = montar('conclusao');
    const convite = screen.getByTestId('convite-etapa');
    expect(convite).toHaveTextContent('A etapa Conclusão ainda está vazia');
    await userEvent.click(within(convite).getByRole('button', { name: 'Criar texto nesta etapa' }));
    expect(a.getState().projeto.objetos.at(-1)).toMatchObject({ tipo: 'texto', etapa: 'conclusao' });
    expect(screen.queryByTestId('convite-etapa')).not.toBeInTheDocument();
  });

  it('convite do Plano cria Tabela sem duplicar a coleção; Dados oferece Tabela e Fichas', async () => {
    const a = montar('plano', 'iniciais', (p) => { p.objetos = p.objetos.filter((o) => o.etapa !== 'plano'); });
    const colecoes = a.getState().projeto.colecoes.length;
    await userEvent.click(screen.getByRole('button', { name: 'Criar tabela nesta etapa' }));
    const p = a.getState().projeto;
    expect(p.colecoes).toHaveLength(colecoes);
    expect(p.objetos.at(-1)).toMatchObject({ tipo: 'tabela', etapa: 'plano', estado: { colecaoId: p.colecoes[0]!.id } });
  });

  it('convite de Dados oferece Tabela e Fichas; Análise oferece Gráfico', () => {
    montar('dados', 'iniciais', (p) => { p.objetos = []; });
    expect(screen.getByRole('button', { name: 'Criar tabela nesta etapa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar fichas nesta etapa' })).toBeInTheDocument();
  });

  it('convite de Análise oferece Gráfico, que usa os dados existentes', async () => {
    const a = montar('analise', 'iniciais', (p) => { p.objetos = p.objetos.filter((o) => o.tipo !== 'grafico'); });
    await userEvent.click(screen.getByRole('button', { name: 'Criar gráfico nesta etapa' }));
    expect(a.getState().projeto.objetos.at(-1)).toMatchObject({ tipo: 'grafico', etapa: 'analise' });
  });

  it('pontos de extensão: um tipo sugerido e um criador (Simulador) aparecem na mesa', async () => {
    registrarSugerido('plano', 'simulador');
    registrarCriadorDeObjeto('simulador', ({ etapa, posicao }) => {
      const objeto = fabricar('simulador', { ...posicao, etapa, estado: {} });
      return { comando: criarObjeto(objeto), objeto };
    });
    try {
      const a = montar('plano', 'iniciais', (p) => { p.objetos = p.objetos.filter((o) => o.etapa !== 'plano'); });
      expect(screen.getByRole('button', { name: 'Novo objeto: Simulador' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Criar simulador nesta etapa' }));
      expect(a.getState().projeto.objetos.at(-1)).toMatchObject({ tipo: 'simulador', etapa: 'plano' });
    } finally {
      removerSugerido('plano', 'simulador');
      removerCriadorDeObjeto('simulador');
    }
  });
});

describe('pergunta do problema', () => {
  it('digitar a pergunta grava no ciclo, vira um passo do histórico e desfazer volta', async () => {
    const a = montar('problema', 'iniciais', (p) => { p.ciclos[0]!.pergunta = ''; });
    const campo = screen.getByRole('textbox', { name: 'Nossa pergunta' });
    await userEvent.type(campo, 'Quem vem a pé?');
    expect(cicloCorrente(a.getState().projeto)!.pergunta).toBe('Quem vem a pé?');
    expect(a.getState().historico.desfazer).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /^Desfazer/ }));
    expect(cicloCorrente(a.getState().projeto)!.pergunta).toBe('');
    expect(campo).toHaveValue('');
  });

  it('moldes preenchem o começo da pergunta', async () => {
    const a = montar('problema', 'iniciais', (p) => { p.ciclos[0]!.pergunta = ''; });
    await userEvent.click(screen.getByRole('button', { name: 'Moldes de pergunta' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Usar o molde de pergunta: Existe diferença entre…?' }));
    expect(cicloCorrente(a.getState().projeto)!.pergunta).toBe('Existe diferença entre ');
    expect(screen.getByRole('textbox', { name: 'Nossa pergunta' })).toHaveFocus();
  });

  it('avisa com gentileza, sem bloquear, quando a pergunta não parece respondível', async () => {
    const a = montar('problema', 'iniciais', (p) => { p.ciclos[0]!.pergunta = ''; });
    expect(screen.queryByText(/Dica:/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Nossa pergunta' }), 'Escolas');
    expect(screen.getByText(/terminar com '\?'/)).toBeInTheDocument();
    expect(screen.getByText(/pergunta mais completa/)).toBeInTheDocument();
    expect(cicloCorrente(a.getState().projeto)!.pergunta).toBe('Escolas'); // salvou mesmo assim
    await userEvent.clear(screen.getByRole('textbox', { name: 'Nossa pergunta' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nossa pergunta' }), 'Quantos alunos vêm de ônibus?');
    expect(screen.queryByText(/terminar com/)).not.toBeInTheDocument();
  });

  it('avisosDaPergunta', () => {
    expect(avisosDaPergunta('')).toEqual([]);
    expect(avisosDaPergunta('Qual meio de transporte a turma mais usa?')).toEqual([]);
    expect(avisosDaPergunta('Oi?')).toHaveLength(1);
    expect(avisosDaPergunta('Gosto muito de estudar com meus amigos')).toHaveLength(2);
  });
});

describe('aviso de revisão', () => {
  it('aparece ao mudar a Tabela depois de concluir a Análise, fecha e não bloqueia', async () => {
    const a = montar('dados', 'iniciais', (p) => { p.ciclos[0]!.etapasConcluidas = ['analise']; });
    expect(screen.queryByText('O gráfico e a conclusão usam estes dados. Revisar?')).not.toBeInTheDocument();
    act(() => a.getState().executar(editarCelula('exemplo-colecao', 'exemplo-caso-1', 'exemplo-atr-tempo', 99)));
    expect(screen.getByText('O gráfico e a conclusão usam estes dados. Revisar?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso de revisão' }));
    expect(screen.queryByText('O gráfico e a conclusão usam estes dados. Revisar?')).not.toBeInTheDocument();
    act(() => a.getState().executar(editarCelula('exemplo-colecao', 'exemplo-caso-2', 'exemplo-atr-tempo', 98)));
    expect(screen.getByText(/Revisar\?/)).toBeInTheDocument();
    expect(a.getState().projeto.cicloAtual).toBe('dados'); // não mudou a etapa por conta própria
  });

  it('Revisar leva à etapa e some', async () => {
    const a = montar('dados', 'iniciais', (p) => { p.ciclos[0]!.etapasConcluidas = ['conclusao']; });
    act(() => a.getState().executar(editarCelula('exemplo-colecao', 'exemplo-caso-1', 'exemplo-atr-tempo', 5)));
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(a.getState().projeto.cicloAtual).toBe('conclusao');
    expect(screen.queryByText(/Revisar\?/)).not.toBeInTheDocument();
  });

  it('não aparece se Análise e Conclusão não foram concluídas, nem ao mexer só em objetos', async () => {
    const a = montar('dados', 'iniciais', (p) => { p.ciclos[0]!.etapasConcluidas = ['dados']; });
    act(() => a.getState().executar(editarCelula('exemplo-colecao', 'exemplo-caso-1', 'exemplo-atr-tempo', 5)));
    expect(screen.queryByText(/Revisar\?/)).not.toBeInTheDocument();
    act(() => a.getState().executar(marcarEtapaConcluida('analise')));
    fireEvent.pointerDown(screen.getByTestId('barra-exemplo-obj-tabela'), { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(screen.getByTestId('barra-exemplo-obj-tabela'), { pointerId: 1, clientX: 20, clientY: 0 });
    fireEvent.pointerUp(screen.getByTestId('barra-exemplo-obj-tabela'), { pointerId: 1 });
    expect(screen.queryByText(/Revisar\?/)).not.toBeInTheDocument();
  });

  it('some sozinho se a etapa deixa de estar concluída', async () => {
    const a = montar('dados', 'iniciais', (p) => { p.ciclos[0]!.etapasConcluidas = ['analise']; });
    act(() => a.getState().executar(editarCelula('exemplo-colecao', 'exemplo-caso-1', 'exemplo-atr-tempo', 5)));
    expect(screen.getByText(/Revisar\?/)).toBeInTheDocument();
    await userEvent.click(botaoEtapa('Análise'));
    await userEvent.click(screen.getByRole('button', { name: 'Etapa concluída (clique para desmarcar)' }));
    expect(screen.queryByText(/Revisar\?/)).not.toBeInTheDocument();
  });
});

describe('conclusão', () => {
  it('só conclui com os limites preenchidos, explicando por quê', async () => {
    const a = montar('conclusao');
    const concluir = screen.getByRole('button', { name: 'Marcar etapa como concluída' });
    expect(concluir).toBeDisabled();
    expect(concluir).toHaveAccessibleDescription(/escreva o que você não pode afirmar/);
    await userEvent.type(screen.getByRole('textbox', { name: 'Vi que…' }), 'a maioria vem a pé');
    expect(concluir).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'O que eu não posso afirmar' }), 'Vale só para a turma.');
    expect(concluir).toBeEnabled();
    await userEvent.click(concluir);
    expect(cicloCorrente(a.getState().projeto)!.etapasConcluidas).toContain('conclusao');
    expect(botaoEtapa('Conclusão')).toHaveAccessibleName('Conclusão, etapa 5 de 5, etapa atual, concluída');
    expect(cicloCorrente(a.getState().projeto)!.conclusao!.texto).toBe('Vi que a maioria vem a pé.');
  });

  it('o roteiro tem os campos do perfil', () => {
    montar('conclusao');
    for (const nome of ['Vi que…', 'Isso mostra que…', 'Mas não sei se…', 'O que eu não posso afirmar']) {
      expect(screen.getByRole('textbox', { name: nome })).toBeInTheDocument();
    }
    fireEvent.change(screen.getByLabelText('Perfil'), { target: { value: 'finais' } });
    expect(screen.getByRole('textbox', { name: 'Observei que…' })).toBeInTheDocument();
  });

  it('Começar novo ciclo arquiva, mantém dados e leva ao Problema; o Resumo mostra o ciclo anterior', async () => {
    const a = montar('conclusao');
    await userEvent.type(screen.getByRole('textbox', { name: 'O que eu não posso afirmar' }), 'Só esta turma.');
    const colecoes = a.getState().projeto.colecoes;
    const objetos = a.getState().projeto.objetos.length;
    await userEvent.click(screen.getByRole('button', { name: 'Começar novo ciclo' }));
    const p = a.getState().projeto;
    expect(p.ciclos).toHaveLength(2);
    expect(p.ciclos[0]!.arquivado).toBe(true);
    expect(p.cicloAtual).toBe('problema');
    expect(p.colecoes).toBe(colecoes);
    expect(p.objetos).toHaveLength(objetos);
    await userEvent.click(screen.getByRole('button', { name: 'Resumo' }));
    const resumo = screen.getByRole('region', { name: 'Resumo' });
    expect(resumo).toHaveTextContent('Ciclo 2');
    expect(resumo).toHaveTextContent('Ciclos anteriores');
    expect(resumo).toHaveTextContent('Ciclo 1: Como os alunos da turma vêm para a escola?');
    await userEvent.click(screen.getByRole('button', { name: /^Desfazer/ }));
    expect(a.getState().projeto.ciclos).toHaveLength(1);
  });
});

describe('resumo', () => {
  it('mostra pergunta, objetos por etapa e conclusão e pode ser fechado', async () => {
    const a = montar('dados');
    a.getState().executar(definirCampoConclusao('vi', 'o ônibus lidera'));
    a.getState().executar(definirCampoConclusao('limites', 'Só vale para a turma.'));
    const botao = screen.getByRole('button', { name: 'Resumo' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    const resumo = screen.getByRole('region', { name: 'Resumo' });
    expect(within(resumo).getByTestId('resumo-pergunta')).toHaveTextContent('Como os alunos da turma vêm para a escola?');
    const itens = [...resumo.querySelectorAll('.resumo-objetos li')].map((li) => li.textContent);
    expect(itens).toEqual(['Problema: 1 objeto', 'Plano: 1 objeto', 'Dados: 2 objetos', 'Análise: 1 objeto', 'Conclusão: 0 objetos']);
    expect(within(resumo).getByTestId('resumo-conclusao')).toHaveTextContent('Vi que o ônibus lidera.');
    expect(within(resumo).getByTestId('resumo-limites')).toHaveTextContent('Só vale para a turma.');
    await userEvent.click(within(resumo).getByRole('button', { name: 'Fechar resumo' }));
    expect(screen.queryByRole('region', { name: 'Resumo' })).not.toBeInTheDocument();
  });
});

describe('projeto vazio e arquivo antigo', () => {
  it('projeto sem ciclos (arquivo antigo/estranho) abre e a pergunta cria o ciclo 1', async () => {
    const p = criarProjeto({ titulo: 'Vazio' });
    p.ciclos = [];
    const a = criarArmazem(p);
    render(<App armazem={a} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Nossa pergunta' }), 'Qual?');
    expect(a.getState().projeto.ciclos).toEqual([{ n: 1, pergunta: 'Qual?', etapasConcluidas: [] }]);
  });
});
