// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { limparAposCadaTeste, montarMesa, novoObjetoDeTeste, objetoDe, projetoDeTeste } from './testeUtil';
import { registrarTipoObjeto, removerTipoObjeto } from './registro';
import type { PropsObjeto } from './tiposObjeto';

limparAposCadaTeste();

const ID = 'exemplo-obj-pergunta';

function arrastar(el: HTMLElement, de: [number, number], passos: [number, number][]) {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: de[0], clientY: de[1] });
  for (const [x, y] of passos) fireEvent.pointerMove(el, { pointerId: 1, clientX: x, clientY: y });
  const [ux, uy] = passos[passos.length - 1] ?? de;
  fireEvent.pointerUp(el, { pointerId: 1, clientX: ux, clientY: uy });
}

describe('Mesa', () => {
  it('menu Opções: abre com aria-haspopup, Esc fecha e devolve o foco ao botão', async () => {
    montarMesa(projetoDeTeste());
    const botao = screen.getByRole('button', { name: 'Opções de Texto' });
    expect(botao).toHaveAttribute('aria-haspopup', 'menu');
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Apagar' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Apagar' })).toBeInTheDocument();
  });

  it('objetos novos entram sem sobreposição e Organizar arruma tudo num único passo', async () => {
    const { armazem } = montarMesa(projetoDeTeste());
    for (const nome of ['Texto', 'Texto', 'Imagem']) await userEvent.click(screen.getByRole('button', { name: `Novo objeto: ${nome}` }));
    const caixas = armazem.getState().projeto.objetos.map((o) => o);
    const sobrepoe = (a: (typeof caixas)[number], b: (typeof caixas)[number]) => a.x < b.x + b.l && a.x + a.l > b.x && a.y < b.y + b.a && a.y + a.a > b.y;
    const novos = caixas.slice(-3);
    for (const n of novos) for (const o of caixas) if (o !== n) expect(sobrepoe(n, o)).toBe(false);
    const antes = armazem.getState().historico.desfazer.length;
    await userEvent.click(screen.getByRole('button', { name: 'Organizar' }));
    expect(armazem.getState().historico.desfazer).toHaveLength(antes + 1);
    const depois = armazem.getState().projeto.objetos;
    for (const a of depois) for (const b of depois) if (a !== b) expect(sobrepoe(a, b)).toBe(false);
  });

  it('mostra os objetos do projeto e a barra de ferramentas', () => {
    montarMesa(projetoDeTeste());
    expect(screen.getByRole('region', { name: 'Mesa de trabalho' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Texto' })).toBeInTheDocument();
    for (const nome of ['Tabela', 'Fichas', 'Texto', 'Imagem']) {
      expect(screen.getByRole('button', { name: `Novo objeto: ${nome}` })).toBeInTheDocument();
    }
  });

  it('gráfico e simulador aparecem como quadro provisório "Em breve"', () => {
    const p = projetoDeTeste((x) => {
      x.objetos.push(novoObjetoDeTeste('grafico', 'g1'), novoObjetoDeTeste('simulador', 's1'));
    });
    montarMesa(p);
    expect(screen.getAllByText('Em breve')).toHaveLength(2);
    expect(screen.getByText('O objeto "Gráfico" ainda está sendo preparado.')).toBeInTheDocument();
  });

  it('registrarTipoObjeto pluga um componente sem editar a Mesa', () => {
    function GraficoFalso({ objeto }: PropsObjeto) {
      return <p>Gráfico de verdade {objeto.id}</p>;
    }
    registrarTipoObjeto('grafico', GraficoFalso);
    try {
      montarMesa(projetoDeTeste((x) => x.objetos.push(novoObjetoDeTeste('grafico', 'g1'))));
      expect(screen.getByText('Gráfico de verdade g1')).toBeInTheDocument();
      expect(screen.queryByText('Em breve')).not.toBeInTheDocument();
    } finally {
      removerTipoObjeto('grafico');
    }
  });

  it('arrastar gera um único comando fundido e desfazer volta tudo de uma vez', () => {
    const { armazem } = montarMesa(projetoDeTeste());
    const antes = objetoDe(armazem.getState().projeto, ID);
    const barra = screen.getByTestId(`barra-${ID}`);
    arrastar(barra, [100, 100], [[110, 105], [130, 120], [160, 150]]);
    const depois = objetoDe(armazem.getState().projeto, ID);
    expect(depois.x).toBe(antes.x + 60);
    expect(depois.y).toBe(antes.y + 50);
    expect(armazem.getState().historico.desfazer).toHaveLength(1);
    expect(armazem.getState().historico.selado).toBe(true);
    act(() => armazem.getState().desfazer());
    const volta = objetoDe(armazem.getState().projeto, ID);
    expect([volta.x, volta.y]).toEqual([antes.x, antes.y]);
  });

  it('dois arrastos seguidos geram dois comandos', () => {
    const { armazem } = montarMesa(projetoDeTeste());
    const barra = screen.getByTestId(`barra-${ID}`);
    arrastar(barra, [0, 0], [[10, 10]]);
    arrastar(barra, [10, 10], [[30, 30]]);
    expect(armazem.getState().historico.desfazer).toHaveLength(2);
  });

  it('redimensionar gera um único comando fundido e respeita o tamanho mínimo', () => {
    const { armazem } = montarMesa(projetoDeTeste());
    const antes = objetoDe(armazem.getState().projeto, ID);
    const alca = screen.getByTestId(`alca-${ID}`);
    arrastar(alca, [500, 500], [[520, 510], [540, 540], [560, 560]]);
    const depois = objetoDe(armazem.getState().projeto, ID);
    expect(depois.l).toBe(antes.l + 60);
    expect(depois.a).toBe(antes.a + 60);
    expect(armazem.getState().historico.desfazer).toHaveLength(1);
    arrastar(alca, [0, 0], [[-5000, -5000]]);
    const minimo = objetoDe(armazem.getState().projeto, ID);
    expect(minimo.l).toBe(200);
    expect(minimo.a).toBe(120);
  });

  it('desfazer e refazer por botão (com rótulos do histórico) e por teclado', async () => {
    const { armazem } = montarMesa(projetoDeTeste());
    const barra = screen.getByTestId(`barra-${ID}`);
    const x0 = objetoDe(armazem.getState().projeto, ID).x;
    const botaoDesfazer = screen.getByRole('button', { name: /^Desfazer/ });
    const botaoRefazer = screen.getByRole('button', { name: /^Refazer/ });
    expect(botaoDesfazer).toBeDisabled();
    expect(botaoDesfazer).toHaveTextContent('Nada para desfazer');

    arrastar(barra, [0, 0], [[40, 0]]);
    expect(objetoDe(armazem.getState().projeto, ID).x).toBe(x0 + 40);
    expect(botaoDesfazer).toBeEnabled();
    expect(botaoDesfazer).toHaveTextContent('Mover objeto');

    await userEvent.click(botaoDesfazer);
    expect(objetoDe(armazem.getState().projeto, ID).x).toBe(x0);
    expect(botaoRefazer).toHaveTextContent('Mover objeto');
    await userEvent.click(botaoRefazer);
    expect(objetoDe(armazem.getState().projeto, ID).x).toBe(x0 + 40);

    await userEvent.keyboard('{Control>}z{/Control}');
    expect(objetoDe(armazem.getState().projeto, ID).x).toBe(x0);
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(objetoDe(armazem.getState().projeto, ID).x).toBe(x0 + 40);
    await userEvent.keyboard('{Meta>}z{/Meta}');
    expect(objetoDe(armazem.getState().projeto, ID).x).toBe(x0);
    await userEvent.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');
    expect(objetoDe(armazem.getState().projeto, ID).x).toBe(x0 + 40);
  });

  it('apagar objeto pede confirmação simples e dá para desfazer', async () => {
    const { armazem } = montarMesa(projetoDeTeste());
    const total = armazem.getState().projeto.objetos.length;
    await userEvent.click(screen.getByRole('button', { name: 'Opções de Texto' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Apagar' }));
    const confirma = screen.getByRole('alertdialog', { name: 'Apagar este objeto?' });
    await userEvent.click(within(confirma).getByRole('button', { name: 'Não' }));
    expect(armazem.getState().projeto.objetos).toHaveLength(total);

    await userEvent.click(screen.getByRole('button', { name: 'Opções de Texto' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Apagar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sim, apagar' }));
    expect(armazem.getState().projeto.objetos).toHaveLength(total - 1);
    await userEvent.click(screen.getByRole('button', { name: /^Desfazer/ }));
    expect(armazem.getState().projeto.objetos).toHaveLength(total);
  });

  it('botões Novo criam tabela (com dados novos), fichas, texto e imagem', async () => {
    const { armazem } = montarMesa(projetoDeTeste());
    const colecoes = armazem.getState().projeto.colecoes.length;
    await userEvent.click(screen.getByRole('button', { name: 'Novo objeto: Tabela' }));
    expect(armazem.getState().projeto.colecoes).toHaveLength(colecoes + 1);
    await userEvent.click(screen.getByRole('button', { name: 'Novo objeto: Fichas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Novo objeto: Texto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Novo objeto: Imagem' }));
    const tipos = armazem.getState().projeto.objetos.map((o) => o.tipo);
    expect(tipos.slice(-4)).toEqual(['tabela', 'fichas', 'texto', 'imagem']);
    // criar tabela + coleção é um único passo do histórico
    await userEvent.click(screen.getByRole('button', { name: /^Desfazer/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Desfazer/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Desfazer/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Desfazer/ }));
    expect(armazem.getState().projeto.colecoes).toHaveLength(colecoes);
  });

  it('o objeto tocado vem para frente (z-order por foco)', () => {
    montarMesa(projetoDeTeste());
    const tabela = screen.getByRole('region', { name: /^Tabela/ });
    const texto = screen.getByRole('region', { name: 'Texto' });
    fireEvent.pointerDown(tabela, { pointerId: 1, button: 0 });
    const zTabela = Number(tabela.style.zIndex);
    fireEvent.pointerDown(texto, { pointerId: 1, button: 0 });
    expect(Number(texto.style.zIndex)).toBeGreaterThan(zTabela);
    fireEvent.pointerDown(tabela, { pointerId: 1, button: 0 });
    expect(Number(tabela.style.zIndex)).toBeGreaterThan(Number(texto.style.zIndex));
  });

  it('mover pelo teclado (setas na barra do objeto)', async () => {
    const { armazem } = montarMesa(projetoDeTeste());
    const x0 = objetoDe(armazem.getState().projeto, ID).x;
    screen.getByTestId(`barra-${ID}`).focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(objetoDe(armazem.getState().projeto, ID).x).toBe(x0 + 20);
    // cada tecla solta sela o histórico: duas teclas = dois passos (segurar a tecla funde)
    expect(armazem.getState().historico.desfazer).toHaveLength(2);
  });
});
