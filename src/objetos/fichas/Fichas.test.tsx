// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { limparAposCadaTeste, montarMesa, projetoDeTeste } from '../../app/testeUtil';
import { ID_COLECAO_EXEMPLO } from '../../app/projetoExemplo';

limparAposCadaTeste();

const fichas = () => within(screen.getByRole('region', { name: /^Fichas/ }));
const tabelaEl = () => screen.getByRole('region', { name: /^Tabela/ });
const sel = (armazem: ReturnType<typeof montarMesa>['armazem']) => [...(armazem.getState().selecaoCasos[ID_COLECAO_EXEMPLO] ?? [])];
const ficha = (n: number) => fichas().getByRole('row', { name: `Ficha ${n}` });
const linha = (n: number) => tabelaEl().querySelector(`tr[data-caso="exemplo-caso-${n}"]`)!;

describe('Fichas e seleção ligada', () => {
  it('mostra uma ficha por caso com os valores', () => {
    montarMesa(projetoDeTeste());
    expect(fichas().getAllByRole('row')).toHaveLength(25);
    expect(within(ficha(1)).getByLabelText('Nome, ficha 1')).toHaveValue('A01');
  });

  it('clicar numa ficha destaca a linha da tabela, e vice-versa', async () => {
    const { armazem } = montarMesa(projetoDeTeste());
    await userEvent.click(ficha(3));
    expect(sel(armazem)).toEqual(['exemplo-caso-3']);
    expect(ficha(3)).toHaveAttribute('aria-selected', 'true');
    expect(linha(3)).toHaveAttribute('aria-selected', 'true');
    expect(linha(4)).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(tabelaEl().querySelector('tr[data-caso="exemplo-caso-7"] td')!);
    expect(ficha(7)).toHaveAttribute('aria-selected', 'true');
    expect(ficha(3)).toHaveAttribute('aria-selected', 'false');
    expect(linha(3)).toHaveAttribute('aria-selected', 'false');
  });

  it('Ctrl/Cmd e Shift na ficha alteram a mesma seleção da tabela', () => {
    const { armazem } = montarMesa(projetoDeTeste());
    fireEvent.click(ficha(2));
    fireEvent.click(ficha(5), { ctrlKey: true });
    expect(sel(armazem).sort()).toEqual(['exemplo-caso-2', 'exemplo-caso-5']);
    fireEvent.click(ficha(8), { shiftKey: true });
    expect(sel(armazem)).toHaveLength(4); // 5 a 8 (a âncora passou a ser a ficha 5)
    expect(linha(6)).toHaveAttribute('aria-selected', 'true');
    expect(linha(2)).toHaveAttribute('aria-selected', 'false');
  });

  it('editar valor na ficha atualiza a tabela (número com vírgula)', async () => {
    const { armazem } = montarMesa(projetoDeTeste());
    const campo = within(ficha(1)).getByLabelText('Tempo de viagem, ficha 1');
    await userEvent.clear(campo);
    await userEvent.type(campo, '8,5{Enter}');
    expect(armazem.getState().projeto.colecoes[0]!.casos[0]!.valores['exemplo-atr-tempo']).toBe(8.5);
    expect(tabelaEl().querySelector('[data-l="0"][data-c="2"]')).toHaveTextContent('8,5');
    expect(document.activeElement).toBe(ficha(1));
  });

  it('valor inválido na ficha mostra mensagem e não grava', async () => {
    const { armazem } = montarMesa(projetoDeTeste());
    const antes = armazem.getState().projeto.colecoes[0]!.casos[0]!.valores['exemplo-atr-tempo'];
    const campo = within(ficha(1)).getByLabelText('Tempo de viagem, ficha 1');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'abc{Enter}');
    expect(within(ficha(1)).getByRole('alert')).toHaveTextContent('Digite um número, como 12,5.');
    expect(armazem.getState().projeto.colecoes[0]!.casos[0]!.valores['exemplo-atr-tempo']).toBe(antes);
  });

  it('teclado: setas movem e selecionam, Espaço alterna, Enter vai para o campo, Esc limpa', async () => {
    const { armazem } = montarMesa(projetoDeTeste());
    ficha(1).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(ficha(2));
    expect(sel(armazem)).toEqual(['exemplo-caso-2']);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(sel(armazem)).toEqual(['exemplo-caso-4']);
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(ficha(3));
    expect(sel(armazem)).toEqual(['exemplo-caso-3']);
    await userEvent.keyboard(' ');
    expect(sel(armazem)).toEqual([]);
    await userEvent.keyboard(' ');
    expect(sel(armazem)).toEqual(['exemplo-caso-3']);
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(within(ficha(3)).getByLabelText('Nome, ficha 3'));
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(ficha(3));
    await userEvent.keyboard('{Escape}');
    expect(sel(armazem)).toEqual([]);
  });

  it('casos escondidos não aparecem nas fichas', () => {
    montarMesa(projetoDeTeste((p) => { p.colecoes[0]!.casos[0]!.oculto = true; }));
    expect(fichas().getAllByRole('row')).toHaveLength(24);
  });

  it('uma parada de Tab por ficha: campos fora da tabulação', () => {
    montarMesa(projetoDeTeste());
    const grade = fichas().getByRole('grid');
    const tabulaveis = grade.querySelectorAll('[tabindex="0"]');
    expect(tabulaveis).toHaveLength(1);
    expect(grade.querySelector('input:not([tabindex="-1"])')).toBeNull();
    expect(grade.querySelector('[role="option"]')).toBeNull();
  });

  it('F2 entra nos campos, Tab percorre os campos, Esc volta à ficha', async () => {
    montarMesa(projetoDeTeste());
    ficha(2).focus();
    await userEvent.keyboard('{F2}');
    expect(document.activeElement).toBe(within(ficha(2)).getByLabelText('Nome, ficha 2'));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(within(ficha(2)).getAllByRole('textbox')[1]);
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(ficha(2));
  });

  it('o foco em roving acompanha a ficha ativa; Home/End e setas verticais', async () => {
    montarMesa(projetoDeTeste());
    ficha(1).focus();
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(ficha(25));
    expect(ficha(25)).toHaveAttribute('tabindex', '0');
    expect(ficha(1)).toHaveAttribute('tabindex', '-1');
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(ficha(1));
  });
});
