// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { limparAposCadaTeste, montarMesa, projetoDeTeste } from '../../app/testeUtil';
import type { Armazem } from '../../estado/usarArmazem';
import type { Projeto } from '../../modelo/tipos';
import { ID_COLECAO_EXEMPLO } from '../../app/projetoExemplo';
import { ALTURA_LINHA_INICIAIS } from './Tabela';

limparAposCadaTeste();

function colecao(armazem: Armazem) {
  return armazem.getState().projeto.colecoes.find((c) => c.id === ID_COLECAO_EXEMPLO)!;
}

const ID_TABELA = 'exemplo-obj-tabela';

/** Ferramentas da tabela: ficam na barra de ferramentas (a tabela precisa estar focada). */
function barra() {
  return within(screen.getByRole('toolbar', { name: 'Tabela de casos' }));
}

function tabela() {
  return within(screen.getByRole('region', { name: /^Tabela/ }));
}

function celula(l: number, c: number): HTMLElement {
  const el = document.querySelector<HTMLElement>(`.tabela-grade [data-l="${l}"][data-c="${c}"]`);
  if (!el) throw new Error(`célula ${l},${c} não renderizada`);
  return el;
}

const TEMPO = 'exemplo-atr-tempo';
const MEIO = 'exemplo-atr-meio';

describe('Tabela', () => {
  it('mostra atributos com cor e unidade e os 25 casos do exemplo', () => {
    const { armazem } = montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
    expect(colecao(armazem).casos).toHaveLength(25);
    expect(tabela().getByRole('button', { name: 'Tempo de viagem (min) Número' })).toBeInTheDocument();
    expect(screen.getAllByText('Tempo de viagem (min)').length).toBeGreaterThan(0);
    const cab = document.querySelector<HTMLElement>(`[data-atributo="${TEMPO}"]`)!;
    expect(cab.querySelector<HTMLElement>('.tabela-cor')!.style.background).not.toBe('');
    expect(celula(0, 0)).toHaveTextContent('A01');
  });

  it('edição de célula numérica aceita vírgula (e ponto)', async () => {
    const { armazem } = montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
    await userEvent.dblClick(celula(0, 2));
    const campo = screen.getByRole('textbox', { name: 'Editar Tempo de viagem, caso 1' });
    await userEvent.clear(campo);
    await userEvent.type(campo, '12,5{Enter}');
    expect(colecao(armazem).casos[0]!.valores[TEMPO]).toBe(12.5);
    expect(celula(0, 2)).toHaveTextContent('12,5');
    // Enter desce para a linha de baixo; digitar começa a editar com ponto
    await userEvent.dblClick(celula(1, 2));
    const campo2 = screen.getByRole('textbox', { name: 'Editar Tempo de viagem, caso 2' });
    await userEvent.clear(campo2);
    await userEvent.type(campo2, '7.25{Enter}');
    expect(colecao(armazem).casos[1]!.valores[TEMPO]).toBe(7.25);
    expect(armazem.getState().historico.selado).toBe(true);
  });

  it('texto não numérico numa célula numérica mostra mensagem e não grava', async () => {
    const { armazem } = montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
    const antes = colecao(armazem).casos[0]!.valores[TEMPO];
    await userEvent.dblClick(celula(0, 2));
    const campo = screen.getByRole('textbox', { name: /Editar Tempo/ });
    await userEvent.clear(campo);
    await userEvent.type(campo, 'muito{Enter}');
    expect(screen.getByText('Digite um número, como 12,5.')).toBeInTheDocument();
    expect(colecao(armazem).casos[0]!.valores[TEMPO]).toBe(antes);
  });

  it('teclado: setas navegam, digitar edita, Enter desce, Tab vai para a direita, Esc cancela', async () => {
    const { armazem } = montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
    celula(0, 0).focus();
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    expect(document.activeElement).toBe(celula(1, 1));
    // digitar substitui o valor
    await userEvent.keyboard('Skate{Tab}');
    expect(colecao(armazem).casos[1]!.valores[MEIO]).toBe('Skate');
    expect(document.activeElement).toBe(celula(1, 2));
    await userEvent.keyboard('{Enter}');
    const campo = screen.getByRole('textbox', { name: /Editar Tempo/ });
    await userEvent.clear(campo);
    await userEvent.type(campo, '99{Escape}');
    expect(colecao(armazem).casos[1]!.valores[TEMPO]).not.toBe(99);
    expect(document.activeElement).toBe(celula(1, 2));
    await userEvent.keyboard('{Enter}');
    const campo2 = screen.getByRole('textbox', { name: /Editar Tempo/ });
    await userEvent.clear(campo2);
    await userEvent.type(campo2, '33{Enter}');
    expect(colecao(armazem).casos[1]!.valores[TEMPO]).toBe(33);
    expect(document.activeElement).toBe(celula(2, 2));
  });

  it('novo caso e apagar casos selecionados (com desfazer)', async () => {
    const { armazem } = montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
    await userEvent.click(barra().getByRole('button', { name: 'Novo caso' }));
    expect(colecao(armazem).casos).toHaveLength(26);
    expect(colecao(armazem).casos[25]!.valores[TEMPO]).toBeNull();
    // a tabela rolou até o caso novo; voltamos ao topo
    const area = screen.getByTestId('area-tabela');
    area.scrollTop = 0;
    fireEvent.scroll(area);

    expect(barra().getByRole('button', { name: 'Apagar casos' })).toBeDisabled();
    await userEvent.click(celula(0, 0));
    fireEvent.click(celula(2, 0), { shiftKey: true });
    expect(tabela().getByText(/3 selecionados/)).toBeInTheDocument();
    await userEvent.click(barra().getByRole('button', { name: 'Apagar casos' }));
    expect(colecao(armazem).casos).toHaveLength(23);
    act(() => armazem.getState().desfazer());
    expect(colecao(armazem).casos).toHaveLength(26);
  });

  it('seleção por clique, Shift e Ctrl/Cmd', async () => {
    const { armazem } = montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
    const sel = () => [...(armazem.getState().selecaoCasos[ID_COLECAO_EXEMPLO] ?? [])];
    await userEvent.click(celula(1, 0));
    expect(sel()).toEqual(['exemplo-caso-2']);
    fireEvent.click(celula(3, 0), { ctrlKey: true });
    expect(sel().sort()).toEqual(['exemplo-caso-2', 'exemplo-caso-4']);
    fireEvent.click(celula(1, 0), { metaKey: true });
    expect(sel()).toEqual(['exemplo-caso-4']);
    await userEvent.click(celula(5, 1));
    fireEvent.click(celula(8, 1), { shiftKey: true });
    expect(sel()).toEqual(['exemplo-caso-6', 'exemplo-caso-7', 'exemplo-caso-8', 'exemplo-caso-9']);
    expect(document.querySelectorAll('tr[aria-selected="true"]')).toHaveLength(4);
  });

  it('criar, renomear e apagar atributo', async () => {
    const { armazem } = montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
    await userEvent.click(barra().getByRole('button', { name: 'Novo atributo' }));
    await userEvent.type(screen.getByLabelText('Nome do atributo'), 'Idade');
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'numerico');
    await userEvent.type(screen.getByLabelText('Unidade (opcional)'), 'anos');
    await userEvent.click(screen.getByRole('radio', { name: 'Cor 4' }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar atributo' }));
    const idade = colecao(armazem).atributos.find((a) => a.nome === 'Idade')!;
    expect(idade).toMatchObject({ tipo: 'numerico', unidade: 'anos', cor: '#c2379b' });
    expect(colecao(armazem).casos[0]!.valores[idade.id]).toBeNull();

    // nome repetido: mensagem em português e nada muda
    await userEvent.click(barra().getByRole('button', { name: 'Novo atributo' }));
    await userEvent.type(screen.getByLabelText('Nome do atributo'), 'idade');
    await userEvent.click(screen.getByRole('button', { name: 'Criar atributo' }));
    expect(screen.getByText("Já existe um atributo chamado 'idade'.")).toBeInTheDocument();
    expect(colecao(armazem).atributos).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // renomear
    await userEvent.click(tabela().getByRole('button', { name: 'Idade (anos) Número' }));
    const campo = screen.getByLabelText('Nome do atributo');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Idade em anos{Enter}');
    expect(colecao(armazem).atributos.find((a) => a.id === idade.id)!.nome).toBe('Idade em anos');

    // apagar, com confirmação
    await userEvent.click(screen.getByRole('button', { name: 'Apagar atributo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Não' }));
    expect(colecao(armazem).atributos).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', { name: 'Apagar atributo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sim, apagar' }));
    expect(colecao(armazem).atributos).toHaveLength(3);
    expect(colecao(armazem).casos[0]!.valores).not.toHaveProperty(idade.id);
  });

  it('atributo sem nome pede um nome', async () => {
    montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
    await userEvent.click(barra().getByRole('button', { name: 'Novo atributo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar atributo' }));
    expect(screen.getByText('Dê um nome ao atributo.')).toBeInTheDocument();
  });

  it('esconder selecionados e mostrar ocultos', async () => {
    const { armazem } = montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
    await userEvent.click(celula(0, 0));
    await userEvent.click(barra().getByRole('button', { name: 'Esconder selecionados' }));
    expect(colecao(armazem).casos[0]!.oculto).toBe(true);
    expect(document.querySelectorAll('tbody tr[data-caso]')).toHaveLength(24);
    await userEvent.click(barra().getByRole('button', { name: 'Mostrar ocultos (1)' }));
    expect(colecao(armazem).casos[0]!.oculto).toBeUndefined();
    expect(document.querySelectorAll('tbody tr[data-caso]')).toHaveLength(25);
  });

  describe('fórmulas', () => {
    async function abrirPainel() {
      await userEvent.click(tabela().getByRole('button', { name: 'Tempo de viagem (min) Número' }));
    }

    it('perfil finais: fórmula válida calcula e o atributo fica protegido contra digitação', async () => {
      const { armazem } = montarMesa(projetoDeTeste(), 'finais', ID_TABELA);
      await userEvent.click(barra().getByRole('button', { name: 'Novo atributo' }));
      await userEvent.type(screen.getByLabelText('Nome do atributo'), 'Dobro');
      await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'numerico');
      await userEvent.click(screen.getByRole('button', { name: 'Criar atributo' }));
      await userEvent.click(tabela().getByRole('button', { name: 'Dobro Número' }));
      fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '[Tempo de viagem] * 2' } });
      await userEvent.click(screen.getByRole('button', { name: 'Aplicar fórmula' }));
      const c = colecao(armazem);
      const dobro = c.atributos.find((a) => a.nome === 'Dobro')!;
      expect(c.casos[0]!.valores[dobro.id]).toBe((c.casos[0]!.valores[TEMPO] as number) * 2);
      await userEvent.dblClick(celula(0, 3));
      expect(screen.getByText(/calculado por uma fórmula/)).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /Editar Dobro/ })).not.toBeInTheDocument();
    });

    it('fórmula com erro de sintaxe mostra a explicação em português e não é aplicada', async () => {
      const { armazem } = montarMesa(projetoDeTeste(), 'finais', ID_TABELA);
      await abrirPainel();
      fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '[Tempo de viagem] +' } });
      await userEvent.click(screen.getByRole('button', { name: 'Aplicar fórmula' }));
      expect(screen.getByText(/Problema na fórmula de "Tempo de viagem": A fórmula terminou antes da hora/)).toBeInTheDocument();
      expect(colecao(armazem).atributos.find((a) => a.id === TEMPO)!.formula).toBeUndefined();
    });

    it('fórmula que referencia atributo inexistente mostra o erro na tabela, em português', async () => {
      const { armazem } = montarMesa(projetoDeTeste(), 'finais', ID_TABELA);
      await abrirPainel();
      fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '[Altura] + 1' } });
      await userEvent.click(screen.getByRole('button', { name: 'Aplicar fórmula' }));
      expect(colecao(armazem).atributos.find((a) => a.id === TEMPO)!.formula).toBe('[Altura] + 1');
      const alerta = screen.getAllByRole('alert').map((a) => a.textContent).join(' ');
      expect(alerta).toMatch(/Problema na fórmula de "Tempo de viagem":/);
      expect(alerta).toMatch(/Altura/);
      expect(celula(0, 2)).toHaveTextContent('erro');
      expect(celula(0, 2).title).toMatch(/Altura/);
    });

    it('perfil iniciais esconde fórmulas e tipos avançados', async () => {
      montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
      await abrirPainel();
      expect(screen.getByLabelText('Nome do atributo')).toBeInTheDocument();
      expect(screen.queryByLabelText('Fórmula')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Aplicar fórmula' })).not.toBeInTheDocument();
      await userEvent.click(barra().getByRole('button', { name: 'Novo atributo' }));
      const opcoes = within(screen.getByLabelText('Tipo')).getAllByRole('option').map((o) => o.textContent);
      expect(opcoes).toEqual(['Categoria', 'Número', 'Texto']);
    });

    it('perfil finais mostra fórmulas e todos os tipos', async () => {
      montarMesa(projetoDeTeste(), 'finais', ID_TABELA);
      await abrirPainel();
      expect(screen.getByLabelText('Fórmula')).toBeInTheDocument();
      await userEvent.click(barra().getByRole('button', { name: 'Novo atributo' }));
      const opcoes = within(screen.getByLabelText('Tipo')).getAllByRole('option').map((o) => o.textContent);
      expect(opcoes).toContain('Data');
    });
  });

  it('rolagem: com muitos casos só renderiza uma janela de linhas e acompanha a rolagem', () => {
    const p: Projeto = projetoDeTeste((x) => {
      const c = x.colecoes[0]!;
      for (let i = 26; i <= 1000; i++) c.casos.push({ id: `m-${i}`, valores: { 'exemplo-atr-nome': `B${i}`, [MEIO]: 'A pé', [TEMPO]: i } });
    });
    montarMesa(p, 'iniciais', ID_TABELA);
    const renderizadas = document.querySelectorAll('tbody tr[data-caso]').length;
    expect(renderizadas).toBeGreaterThan(5);
    expect(renderizadas).toBeLessThan(80);
    const area = screen.getByTestId('area-tabela');
    area.scrollTop = ALTURA_LINHA_INICIAIS * 600;
    fireEvent.scroll(area);
    expect(document.querySelector('tbody [data-caso="m-610"]')).toBeInTheDocument();
    expect(document.querySelector('tbody [data-caso="exemplo-caso-1"]')).not.toBeInTheDocument();
  });

  it('o nome acessível do cabeçalho contém o texto visível (tipo incluído)', () => {
    montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
    const b = tabela().getByRole('button', { name: 'Tempo de viagem (min) Número' });
    expect(b.textContent).toContain('Número');
    expect(b.hasAttribute('aria-label')).toBe(false);
  });

  it('indica com sombra à direita quando há colunas ocultas e some ao chegar ao fim', () => {
    montarMesa(projetoDeTeste(), 'iniciais', ID_TABELA);
    const area = screen.getAllByTestId('area-tabela')[0]!;
    const env = area.parentElement!;
    Object.defineProperty(area, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(area, 'clientWidth', { configurable: true, value: 400 });
    area.scrollLeft = 0;
    fireEvent.scroll(area);
    expect(env.dataset.maisADireita).toBe('true');
    area.scrollLeft = 500;
    fireEvent.scroll(area);
    expect(env.dataset.maisADireita).toBe('false');
  });
});
