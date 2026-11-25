// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { limparAposCadaTeste, montarMesa, objetoDe, projetoDeTeste } from '../../app/testeUtil';

limparAposCadaTeste();

describe('Texto', () => {
  it('guarda o texto no estado do objeto e a digitação vira um passo só do histórico', async () => {
    const { armazem } = montarMesa(projetoDeTeste());
    const caixa = screen.getByRole('textbox', { name: 'Anotações' });
    await userEvent.clear(caixa);
    await userEvent.type(caixa, 'Olá, turma');
    expect(objetoDe(armazem.getState().projeto, 'exemplo-obj-pergunta').estado).toEqual({ texto: 'Olá, turma' });
    // clear + digitação sem perder o foco = um comando fundido
    expect(armazem.getState().historico.desfazer).toHaveLength(1);
    await userEvent.tab();
    expect(armazem.getState().historico.selado).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /^Desfazer/ }));
    expect((objetoDe(armazem.getState().projeto, 'exemplo-obj-pergunta').estado as { texto: string }).texto).toMatch(/Nossa pergunta/);
  });
});
