// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { criarProjeto, criarObjeto as fabricarObjeto } from '../modelo/fabrica';
import { criarObjeto } from './comandos';
import { criarArmazem } from './store';
import { ProvedorArmazem, useAcoes, useProjeto, useRotulosHistorico } from './usarArmazem';

afterEach(() => cleanup());

function Painel() {
  const projeto = useProjeto();
  const rotulos = useRotulosHistorico();
  const { executar, desfazer, refazer, selarHistorico } = useAcoes();
  return (
    <div>
      <p data-testid="n">{projeto.objetos.length}</p>
      <p data-testid="d">{rotulos.desfazer ?? '-'}</p>
      <p data-testid="r">{rotulos.refazer ?? '-'}</p>
      <button onClick={() => { executar(criarObjeto(fabricarObjeto('texto'))); selarHistorico(); }}>criar</button>
      <button onClick={desfazer}>desfazer</button>
      <button onClick={refazer}>refazer</button>
    </div>
  );
}

describe('usarArmazem', () => {
  it('reage a mudanças do armazém e expõe atalhos', () => {
    const armazem = criarArmazem(criarProjeto());
    render(<ProvedorArmazem armazem={armazem}><Painel /></ProvedorArmazem>);
    expect(screen.getByTestId('n')).toHaveTextContent('0');
    act(() => screen.getByText('criar').click());
    expect(screen.getByTestId('n')).toHaveTextContent('1');
    expect(screen.getByTestId('d')).toHaveTextContent('Desfazer: Criar texto');
    act(() => screen.getByText('desfazer').click());
    expect(screen.getByTestId('n')).toHaveTextContent('0');
    expect(screen.getByTestId('r')).toHaveTextContent('Refazer: Criar texto');
    act(() => screen.getByText('refazer').click());
    expect(screen.getByTestId('n')).toHaveTextContent('1');
    // mudanças feitas direto no armazém também chegam ao componente
    act(() => armazem.getState().desfazer());
    expect(screen.getByTestId('n')).toHaveTextContent('0');
  });

  it('erro claro sem provedor', () => {
    const silencio = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Painel />)).toThrow(/ProvedorArmazem/);
    } finally {
      console.error = silencio;
    }
  });
});
