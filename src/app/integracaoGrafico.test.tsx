// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { criarArmazem } from '../estado/store';
import { exemploNaEtapa, limparAposCadaTeste } from './testeUtil';
import { criarProjetoExemplo } from './projetoExemplo';
import { registrarGrafico } from '../objetos/grafico';
import { abrirProjeto, salvarProjeto } from '../modelo';
import { validarEstado } from '../objetos/grafico/estado';

limparAposCadaTeste();

describe('integração do gráfico na mesa', () => {
  it('o projeto de exemplo traz um gráfico válido que sobrevive a salvar e abrir', () => {
    const projeto = criarProjetoExemplo();
    const g = projeto.objetos.find((o) => o.tipo === 'grafico');
    expect(g).toBeDefined();
    expect(validarEstado(g!.estado)).not.toBeNull();
    const volta = abrirProjeto(salvarProjeto(projeto));
    expect(volta.objetos.filter((o) => o.tipo === 'grafico')).toHaveLength(1);
  });

  it('com o gráfico registrado, o App mostra o gráfico do exemplo com 25 casos', () => {
    registrarGrafico();
    render(<App armazem={criarArmazem(exemploNaEtapa('analise'))} />);
    expect(screen.getByLabelText('Gráfico de pontos com 25 casos')).toBeInTheDocument();
  });

  it('o botão Novo → Gráfico cria um segundo gráfico ligado à coleção', async () => {
    registrarGrafico();
    render(<App armazem={criarArmazem(exemploNaEtapa('analise'))} />);
    await userEvent.click(screen.getByRole('button', { name: 'Novo objeto: Gráfico' }));
    expect(screen.getAllByLabelText('Gráfico de pontos com 25 casos')).toHaveLength(2);
  });
});
