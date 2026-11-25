// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarProjeto } from '../modelo/fabrica';
import { salvarProjeto } from '../modelo';
import { criarArquivos, criarPonteTauri, ehTauri, obterArquivos, type PonteNativa } from './arquivos';

function ponteFalsa(sobre: Partial<PonteNativa> = {}): PonteNativa {
  return {
    escolherAbrir: vi.fn(async () => null),
    escolherSalvar: vi.fn(async () => null),
    escreverTexto: vi.fn(async () => undefined),
    escreverBinario: vi.fn(async () => undefined),
    confirmar: vi.fn(async () => true),
    lerTexto: vi.fn(async () => ''),
    aoAbrirExterno: vi.fn(async () => () => undefined),
    aoFechar: vi.fn(async () => () => undefined),
    ...sobre,
  };
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe('escolha entre Tauri e navegador', () => {
  it('detecta Tauri por window.__TAURI_INTERNALS__', () => {
    expect(ehTauri()).toBe(false);
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(ehTauri()).toBe(true);
  });

  it('fora do Tauri não é nativo e abrir() devolve null', async () => {
    const a = criarArquivos();
    expect(a.nativo).toBe(false);
    expect(await a.abrir()).toBeNull();
    expect(obterArquivos().nativo).toBe(false);
  });

  it('no navegador salvar baixa o arquivo', async () => {
    const criar = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const r = await criarArquivos().salvar('{}', 'Meu projeto');
    expect(r).toEqual({ nome: 'meu-projeto.investigando' });
    expect(criar).toHaveBeenCalled();
  });

  it('nativo: abrir lê pelo diálogo e valida o projeto', async () => {
    const projeto = criarProjeto();
    const ponte = ponteFalsa({ escolherAbrir: vi.fn(async () => ({ texto: salvarProjeto(projeto), caminho: '/tmp/a.investigando' })) });
    const a = criarArquivos({ nativo: ponte });
    expect(a.nativo).toBe(true);
    const r = await a.abrir();
    expect(r?.caminho).toBe('/tmp/a.investigando');
    expect(r?.projeto.titulo).toBe(projeto.titulo);
  });

  it('nativo: salvar com caminho regrava sem perguntar; sem caminho pergunta; cancelar devolve null', async () => {
    const ponte = ponteFalsa({ escolherSalvar: vi.fn(async () => '/tmp/novo.investigando') });
    const a = criarArquivos({ nativo: ponte });
    expect(await a.salvar('x', 'T', '/tmp/velho.investigando')).toEqual({ nome: 'velho.investigando', caminho: '/tmp/velho.investigando' });
    expect(ponte.escolherSalvar).not.toHaveBeenCalled();
    expect((await a.salvar('x', 'T'))?.caminho).toBe('/tmp/novo.investigando');
    expect((await a.salvarComo('x', 'T'))?.nome).toBe('novo.investigando');
    const cancelada = criarArquivos({ nativo: ponteFalsa() });
    expect(await cancelada.salvarComo('x', 'T')).toBeNull();
    expect(await cancelada.salvar('x', 'T')).toBeNull();
  });

  it('nativo: fechamento só é liberado sem alterações ou com confirmação', async () => {
    let decidir: () => Promise<boolean> = async () => false;
    const ponte = ponteFalsa({ aoFechar: vi.fn(async (f) => { decidir = f; return () => undefined; }) });
    let sujo = false;
    await criarArquivos({ nativo: ponte }).protegerFechamento(() => sujo);
    expect(await decidir()).toBe(true);
    sujo = true;
    expect(await decidir()).toBe(true);
    expect(ponte.confirmar).toHaveBeenCalledTimes(1);
    (ponte.confirmar as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    expect(await decidir()).toBe(false);
  });

  it('navegador: beforeunload só bloqueia com alterações', async () => {
    let sujo = false;
    const remover = await criarArquivos().protegerFechamento(() => sujo);
    const limpo = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(limpo);
    expect(limpo.defaultPrevented).toBe(false);
    sujo = true;
    const alterado = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(alterado);
    expect(alterado.defaultPrevented).toBe(true);
    remover();
  });

  it('a ponte preguiçosa só carrega os plugins no primeiro uso', async () => {
    const real = ponteFalsa();
    const carregar = vi.fn(async () => real);
    const ponte = criarPonteTauri(carregar);
    expect(carregar).not.toHaveBeenCalled();
    await ponte.escreverTexto('/a', 'x');
    await ponte.confirmar('?');
    expect(carregar).toHaveBeenCalledTimes(1);
    expect(real.escreverTexto).toHaveBeenCalledWith('/a', 'x');
  });
});

describe('exportar a partir de um Blob (gráfico)', () => {
  it('no Tauri grava o PNG pelo diálogo nativo, sem baixar pelo navegador', async () => {
    const ponte = ponteFalsa({ escolherSalvar: vi.fn(async () => '/tmp/grafico.png') });
    const nome = await criarArquivos({ nativo: ponte }).exportarPng(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'grafico');
    expect(nome).toBe('grafico.png');
    expect(ponte.escolherSalvar).toHaveBeenCalledWith('grafico.png', expect.objectContaining({ extensao: 'png' }));
    expect(ponte.escreverBinario).toHaveBeenCalledWith('/tmp/grafico.png', new Uint8Array([1, 2, 3]));
  });

  it('cancelar o diálogo não grava nada', async () => {
    const ponte = ponteFalsa();
    expect(await criarArquivos({ nativo: ponte }).exportarPng(new Blob([new Uint8Array([1])]), 'g')).toBeNull();
    expect(ponte.escreverBinario).not.toHaveBeenCalled();
  });

  it('imprimirMesa chama window.print', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    criarArquivos().imprimirMesa();
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });
});

describe('abertura de arquivo pelo sistema (duplo clique)', () => {
  const texto = salvarProjeto(criarProjeto({ titulo: 'Do Finder' }));
  function preparar(sobre: Partial<PonteNativa> = {}, temAlteracoes = false) {
    let entregar: (c: string) => void = () => undefined;
    const ponte = ponteFalsa({
      aoAbrirExterno: vi.fn(async (t) => { entregar = t; return () => undefined; }),
      lerTexto: vi.fn(async () => texto),
      ...sobre,
    });
    const aoAbrir = vi.fn();
    const aoErro = vi.fn();
    const pronto = criarArquivos({ nativo: ponte }).escutarAberturaExterna({ temAlteracoes: () => temAlteracoes, aoAbrir, aoErro });
    return { ponte, aoAbrir, aoErro, pronto, entregar: async (c: string) => { await pronto; entregar(c); await new Promise((r) => setTimeout(r, 0)); } };
  }

  it('lê, valida e abre o projeto recebido', async () => {
    const { ponte, aoAbrir, entregar } = preparar();
    await entregar('/x/a.investigando');
    expect(ponte.lerTexto).toHaveBeenCalledWith('/x/a.investigando');
    expect(aoAbrir).toHaveBeenCalledWith(expect.objectContaining({ caminho: '/x/a.investigando', projeto: expect.objectContaining({ titulo: 'Do Finder' }) }));
    expect(ponte.confirmar).not.toHaveBeenCalled();
  });

  it('com alterações não salvas confirma antes; recusar não abre nem lê', async () => {
    const { ponte, aoAbrir, entregar } = preparar({ confirmar: vi.fn(async () => false) }, true);
    await entregar('/x/a.investigando');
    expect(ponte.confirmar).toHaveBeenCalled();
    expect(ponte.lerTexto).not.toHaveBeenCalled();
    expect(aoAbrir).not.toHaveBeenCalled();
  });

  it('arquivo inválido vai para aoErro', async () => {
    const { aoAbrir, aoErro, entregar } = preparar({ lerTexto: vi.fn(async () => '{nao e json') });
    await entregar('/x/b.investigando');
    expect(aoAbrir).not.toHaveBeenCalled();
    expect(aoErro).toHaveBeenCalledTimes(1);
  });

  it('no navegador não escuta nada', async () => {
    const aoAbrir = vi.fn();
    const desfazer = await criarArquivos().escutarAberturaExterna({ temAlteracoes: () => false, aoAbrir, aoErro: vi.fn() });
    expect(typeof desfazer).toBe('function');
  });

  it('ponte real: evento "abrir-arquivo" do Rust chega ao tratador, e o que veio antes é drenado', async () => {
    const { mockIPC, clearMocks } = await import('@tauri-apps/api/mocks');
    const { emit } = await import('@tauri-apps/api/event');
    mockIPC((cmd) => (cmd === 'interface_pronta' ? ['/antes.investigando'] : undefined), { shouldMockEvents: true });
    try {
      const recebidos: string[] = [];
      const desfazer = await criarPonteTauri().aoAbrirExterno((c) => recebidos.push(c));
      await emit('abrir-arquivo', '/depois.investigando');
      expect(recebidos).toEqual(['/antes.investigando', '/depois.investigando']);
      desfazer();
    } finally {
      clearMocks();
    }
  });
});
