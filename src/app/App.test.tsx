// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { exemploNaEtapa, limparAposCadaTeste } from './testeUtil';
import { criarProjetoExemplo, ID_COLECAO_EXEMPLO } from './projetoExemplo';
import { criarArmazem } from '../estado/store';
import { abrirProjeto, salvarProjeto } from '../modelo';
import { nomeDeArquivo } from './arquivosNavegador';

limparAposCadaTeste();
afterEach(() => vi.restoreAllMocks());

const entrada = () => screen.getByTestId('entrada-arquivo');

describe('App', () => {
  it('abre com o projeto de exemplo original: 25 casos, 3 atributos', () => {
    const projeto = criarProjetoExemplo();
    expect(projeto.titulo).toBe('Como viemos para a escola?');
    const c = projeto.colecoes[0]!;
    expect(c.casos).toHaveLength(25);
    expect(c.atributos.map((a) => a.nome)).toEqual(['Nome', 'Meio de transporte', 'Tempo de viagem']);
    expect(c.casos.map((x) => x.valores['exemplo-atr-nome'])).toContain('A01');
    expect(c.casos[24]!.valores['exemplo-atr-nome']).toBe('A25');
    expect(() => salvarProjeto(projeto)).not.toThrow(); // válido no esquema
    expect(criarProjetoExemplo(projeto.criadoEm)).toEqual(projeto); // determinístico
    render(<App armazem={criarArmazem(exemploNaEtapa('dados'))} />);
    expect(screen.getByRole('heading', { name: 'Investigando' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /^Fichas/ })).getAllByRole('row')).toHaveLength(25);
  });

  it('seleção ligada funciona entre Tabela e Fichas dentro do App', async () => {
    render(<App armazem={criarArmazem(exemploNaEtapa('dados'))} />);
    const fichas = screen.getByRole('region', { name: /^Fichas/ });
    const tabela = screen.getByRole('region', { name: /^Tabela/ });
    await userEvent.click(within(fichas).getByRole('row', { name: 'Ficha 4' }));
    expect(tabela.querySelector('tr[data-caso="exemplo-caso-4"]')).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(tabela.querySelector('tr[data-caso="exemplo-caso-9"] th')!);
    expect(within(fichas).getByRole('row', { name: 'Ficha 9' })).toHaveAttribute('aria-selected', 'true');
    expect(within(fichas).getByRole('row', { name: 'Ficha 4' })).toHaveAttribute('aria-selected', 'false');
  });

  it('o seletor de perfil muda as ferramentas dos objetos', async () => {
    render(<App armazem={criarArmazem(exemploNaEtapa('dados'))} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tempo de viagem (min) Número' }));
    expect(screen.queryByLabelText('Fórmula')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Perfil'), 'finais');
    expect(screen.getByLabelText('Fórmula')).toBeInTheDocument();
  });

  it('abrir arquivo inválido mostra mensagem clara e não mexe no projeto', async () => {
    const armazem = criarArmazem(criarProjetoExemplo());
    render(<App armazem={armazem} />);
    const antes = armazem.getState().projeto;
    await userEvent.upload(entrada(), new File(['isto não é json{'], 'quebrado.investigando', { type: '' }));
    const alerta = await screen.findByText(/O arquivo está danificado ou não está no formato do Investigando/);
    expect(alerta.closest('[role="alert"]')).not.toBeNull();
    expect(armazem.getState().projeto).toBe(antes);

    await userEvent.upload(entrada(), new File([JSON.stringify({ versao: 1, titulo: 3 })], 'errado.investigando', { type: '' }));
    expect(await screen.findByText('O arquivo não é um projeto válido do Investigando.')).toBeInTheDocument();
    expect(screen.getByText(/titulo|título/i, { selector: 'span' })).toBeInTheDocument(); // diz qual campo está errado
    expect(armazem.getState().projeto).toBe(antes);
  });

  it('abrir arquivo de versão mais nova explica o problema', async () => {
    render(<App />);
    await userEvent.upload(entrada(), new File([JSON.stringify({ versao: 99 })], 'futuro.investigando', { type: '' }));
    expect(await screen.findByText(/versão mais nova/)).toBeInTheDocument();
  });

  it('abrir arquivo válido troca o projeto e zera o histórico', async () => {
    const armazem = criarArmazem(criarProjetoExemplo());
    render(<App armazem={armazem} />);
    const outro = criarProjetoExemplo();
    outro.titulo = 'Outro projeto';
    outro.objetos = outro.objetos.filter((o) => o.tipo === 'texto');
    await userEvent.upload(entrada(), new File([salvarProjeto(outro)], 'outro.investigando', { type: '' }));
    expect(await screen.findByText('Projeto aberto: Outro projeto')).toBeInTheDocument();
    expect(armazem.getState().projeto.titulo).toBe('Outro projeto');
    expect(armazem.getState().historico.desfazer).toHaveLength(0);
    expect(screen.queryByRole('region', { name: /^Fichas/ })).not.toBeInTheDocument();
  });

  it('salvar baixa um arquivo .investigando que o app consegue reabrir', async () => {
    let conteudo = '';
    const criar = vi.fn((blob: Blob) => {
      void blob.text().then((x) => { conteudo = x; });
      return 'blob:falso';
    });
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() });
    const cliques: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { cliques.push(this.download); });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(cliques).toEqual(['como-viemos-para-a-escola.investigando']);
    expect(screen.getByText('Projeto salvo no arquivo como-viemos-para-a-escola.investigando')).toBeInTheDocument();
    await waitFor(() => expect(conteudo).not.toBe(''));
    expect(abrirProjeto(conteudo).colecoes[0]!.id).toBe(ID_COLECAO_EXEMPLO);
  });

  it('nomeDeArquivo tira acentos e símbolos', () => {
    expect(nomeDeArquivo('Como viemos para a escola?')).toBe('como-viemos-para-a-escola.investigando');
    expect(nomeDeArquivo('???')).toBe('projeto.investigando');
  });

  it('desfazer por teclado funciona no App inteiro', async () => {
    const armazem = criarArmazem(exemploNaEtapa('dados'));
    render(<App armazem={armazem} />);
    fireEvent.pointerDown(screen.getByTestId('barra-exemplo-obj-tabela'), { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(screen.getByTestId('barra-exemplo-obj-tabela'), { pointerId: 1, clientX: 30, clientY: 0 });
    fireEvent.pointerUp(screen.getByTestId('barra-exemplo-obj-tabela'), { pointerId: 1 });
    expect(armazem.getState().historico.desfazer).toHaveLength(1);
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(armazem.getState().historico.desfazer).toHaveLength(0);
  });
});

describe('Imprimir', () => {
  it('botão e Ctrl+P imprimem a mesa sem usar o atalho do navegador', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<App armazem={criarArmazem(exemploNaEtapa('dados'))} />);
    await userEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(print).toHaveBeenCalledTimes(1);
    const ev = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, cancelable: true, bubbles: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(print).toHaveBeenCalledTimes(2);
  });
});
