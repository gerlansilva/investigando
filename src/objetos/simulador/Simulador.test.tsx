// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { limparAposCadaTeste, montarMesa, novoObjetoDeTeste, projetoDeTeste } from '../../app/testeUtil';
import type { PerfilEnsino } from '../../app/tiposObjeto';
import type { Armazem } from '../../estado/usarArmazem';
import type { Colecao, Projeto } from '../../modelo/tipos';
import { validarProjeto } from '../../modelo/esquema';
import { fatiasDaRoleta } from './visuais';
import { registrarSimulador } from './index';

limparAposCadaTeste();
beforeAll(() => registrarSimulador());
afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error remove o stub de matchMedia
  delete window.matchMedia;
});

const SIM = 'sim';

function montar(perfil: PerfilEnsino = 'finais', estado: Record<string, unknown> = {}) {
  const projeto = projetoDeTeste((p) => {
    p.objetos.push({ ...novoObjetoDeTeste('simulador', SIM), estado: { velocidade: 'instantanea', semente: 1, ...estado } });
  });
  return { projeto, ...montarMesa(projeto, perfil, SIM) };
}

const projetoDe = (a: Armazem): Projeto => a.getState().projeto;
const resultados = (a: Armazem): Colecao | undefined => projetoDe(a).colecoes.find((c) => c.nome === 'Resultados do simulador');
const estatisticas = (a: Armazem): Colecao | undefined => projetoDe(a).colecoes.find((c) => c.nome === 'Estatísticas do simulador');
const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome });
const abrir = (titulo: string) => {
  const resumo = screen.getByText(titulo, { selector: 'summary' });
  (resumo.parentElement as HTMLDetailsElement).open = true;
};
const nomesDe = (c: Colecao | undefined) => (c?.casos ?? []).map((k) => k.valores['col-resultado']);
const clicar = (nome: string | RegExp) => act(() => { fireEvent.click(botao(nome)); });

describe('Simulador na mesa', () => {
  it('Sortear 1 vez cria a coleção de resultados ligada ao objeto e gera os casos nela', () => {
    const { armazem } = montar('finais', { itensPorRepeticao: 3 });
    expect(screen.getByText('Ainda não sorteei nada.')).toBeInTheDocument();
    clicar('Sortear 1 vez');
    const col = resultados(armazem)!;
    expect(col).toBeDefined();
    expect(col.casos).toHaveLength(3);
    expect(col.atributos.map((a) => a.nome)).toEqual(['Repetição', 'Resultado']);
    expect(col.casos.every((k) => ['Cara', 'Coroa'].includes(k.valores['col-resultado'] as string))).toBe(true);
    expect(col.casos.map((k) => k.valores['col-repeticao'])).toEqual([1, 1, 1]);
    const estado = projetoDe(armazem).objetos.find((o) => o.id === SIM)!.estado as { colecaoId: string; semente: number; rodada: number };
    expect(estado.colecaoId).toBe(col.id);
    expect(estado.rodada).toBe(1);
    expect(screen.getByText(/^Saiu: /)).toBeInTheDocument();
    expect(screen.getByText('Pronto! 1 repetição, 3 casos novos.')).toBeInTheDocument();
    expect(screen.getByText('3 casos na coleção de resultados.')).toBeInTheDocument();
    expect(() => validarProjeto(projetoDe(armazem))).not.toThrow();
  });

  it('Sortear N vezes gera N×itens casos e a segunda vez acrescenta na mesma coleção', () => {
    const { armazem } = montar('finais', { repeticoes: 7, itensPorRepeticao: 3 });
    clicar('Sortear 7 vezes');
    const col = resultados(armazem)!;
    expect(col.casos).toHaveLength(21);
    expect(new Set(col.casos.map((k) => k.valores['col-repeticao']))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    clicar('Sortear 7 vezes');
    expect(projetoDe(armazem).colecoes.filter((c) => c.nome === 'Resultados do simulador')).toHaveLength(1);
    expect(resultados(armazem)!.casos).toHaveLength(42);
    expect(new Set(resultados(armazem)!.casos.map((k) => k.id)).size).toBe(42);
  });

  it('desfazer remove tudo de uma execução (inclusive a coleção criada) e refazer traz de volta', () => {
    const { armazem, projeto } = montar('finais', { repeticoes: 50, itensPorRepeticao: 4 });
    clicar('Sortear 50 vezes');
    expect(resultados(armazem)!.casos).toHaveLength(200);
    expect(armazem.getState().historico.desfazer).toHaveLength(1);
    act(() => armazem.getState().desfazer());
    expect(projetoDe(armazem)).toEqual(projeto);
    act(() => armazem.getState().refazer());
    expect(resultados(armazem)!.casos).toHaveLength(200);
  });

  it('lote grande roda em blocos e ainda é um único passo do desfazer', async () => {
    const { armazem, projeto } = montar('finais', { repeticoes: 10000, itensPorRepeticao: 1 });
    clicar('Sortear 10000 vezes');
    await waitFor(() => expect(resultados(armazem)?.casos.length).toBe(10000), { timeout: 20000 });
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    expect(screen.getByText('Pronto! 10000 repetições, 10000 casos novos.')).toBeInTheDocument();
    expect(armazem.getState().historico.desfazer).toHaveLength(1);
    act(() => armazem.getState().desfazer());
    expect(projetoDe(armazem)).toEqual(projeto);
  }, 30000);

  it('com a mesma semente os resultados se repetem; com outra, mudam', () => {
    const rodar = (semente: number) => {
      const { armazem, unmount } = montar('finais', { repeticoes: 30, semente });
      clicar('Sortear 30 vezes');
      const r = nomesDe(resultados(armazem)).join(',');
      unmount();
      return r;
    };
    expect(rodar(5)).toBe(rodar(5));
    expect(rodar(5)).not.toBe(rodar(6));
  });

  it('Recomeçar apaga os resultados (desfazível) e volta a rodada a zero', () => {
    const { armazem } = montar('finais', { repeticoes: 5 });
    clicar('Sortear 5 vezes');
    const antes = nomesDe(resultados(armazem)).join(',');
    clicar('Recomeçar');
    expect(resultados(armazem)!.casos).toHaveLength(0);
    expect((projetoDe(armazem).objetos.find((o) => o.id === SIM)!.estado as { rodada: number }).rodada).toBe(0);
    expect(screen.getByText('Ainda não sorteei nada.')).toBeInTheDocument();
    // com a mesma semente e rodada zerada, repete a sequência
    clicar('Sortear 5 vezes');
    expect(nomesDe(resultados(armazem)).join(',')).toBe(antes);
    act(() => armazem.getState().desfazer());
    act(() => armazem.getState().desfazer());
    expect(resultados(armazem)!.casos).toHaveLength(5);
  });

  it('Misturador sem reposição: cada repetição sai exatamente com as bolas do misturador', () => {
    const { armazem } = montar('finais', {
      dispositivo: 'misturador', repeticoes: 10, itensPorRepeticao: 5,
      misturador: { bolas: [{ nome: 'Vermelha', quantidade: 3, cor: 'x' }, { nome: 'Azul', quantidade: 2, cor: 'y' }], reposicao: false, reporEntreRepeticoes: true },
    });
    clicar('Sortear 10 vezes');
    const casos = resultados(armazem)!.casos;
    expect(casos).toHaveLength(50);
    for (let r = 1; r <= 10; r++) {
      const nomes = casos.filter((k) => k.valores['col-repeticao'] === r).map((k) => k.valores['col-resultado']);
      expect(nomes.filter((n) => n === 'Vermelha')).toHaveLength(3);
      expect(nomes.filter((n) => n === 'Azul')).toHaveLength(2);
    }
  });

  it('Contador: sequência 1..N, sem aleatoriedade', () => {
    const { armazem } = montar('finais', { dispositivo: 'contador', contador: { modo: 'ate', ate: 4, valores: '' }, repeticoes: 2, itensPorRepeticao: 4 });
    clicar('Sortear 2 vezes');
    expect(nomesDe(resultados(armazem))).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    expect(resultados(armazem)!.atributos.find((a) => a.id === 'col-resultado')!.tipo).toBe('numerico');
  });

  it('Parar interrompe uma execução animada e guarda o que já saiu', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { armazem } = montar('finais', { velocidade: 'rapida', repeticoes: 20 });
    expect(botao('Parar')).toBeDisabled();
    clicar('Sortear 20 vezes');
    expect(botao('Parar')).toBeEnabled();
    expect(botao('Sortear 1 vez')).toBeDisabled();
    act(() => { vi.advanceTimersByTime(220 * 3 + 10); });
    clicar('Parar');
    const n = resultados(armazem)!.casos.length;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThan(20);
    expect(screen.getByText(`Parei depois de ${n} repetições.`)).toBeInTheDocument();
    expect(botao('Sortear 1 vez')).toBeEnabled();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(resultados(armazem)!.casos).toHaveLength(n);
    expect(armazem.getState().historico.desfazer).toHaveLength(1);
  });

  it('a roleta gira e o ponteiro para no setor sorteado', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const roleta = { setores: [{ nome: 'Pouco', proporcao: 1, cor: 'a' }, { nome: 'Muito', proporcao: 3, cor: 'b' }] };
    const { armazem } = montar('finais', { velocidade: 'media', roleta });
    clicar('Sortear 1 vez');
    const ponteiro = document.querySelector('.simulador-roleta__ponteiro')!;
    act(() => { vi.advanceTimersByTime(300); });
    expect(ponteiro.getAttribute('data-angulo')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(resultados(armazem)!.casos).toHaveLength(1);
    const nome = resultados(armazem)!.casos[0]!.valores['col-resultado'] as string;
    const indice = nome === 'Pouco' ? 0 : 1;
    expect(ponteiro.getAttribute('data-setor')).toBe(String(indice));
    const angulo = Number(ponteiro.getAttribute('data-angulo'));
    const fatia = fatiasDaRoleta(roleta.setores)[indice]!;
    expect(angulo).toBeGreaterThanOrEqual(fatia.inicio);
    expect(angulo).toBeLessThanOrEqual(fatia.fim);
    expect(screen.getByText(`Saiu: ${nome}`)).toBeInTheDocument();
  });

  it('com prefers-reduced-motion não anima: o resultado sai na hora, mesmo na velocidade lenta', () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const { armazem } = montar('finais', { velocidade: 'lenta', repeticoes: 4 });
    clicar('Sortear 4 vezes');
    expect(resultados(armazem)!.casos).toHaveLength(4);
    expect(botao('Parar')).toBeDisabled();
  });

  it('a animação do misturador move as bolinhas e uma sai pela boca', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { armazem } = montar('finais', { dispositivo: 'misturador', velocidade: 'rapida' });
    const bolas = () => [...document.querySelectorAll('.simulador-misturador__bola')];
    expect(bolas().length).toBeGreaterThan(1);
    clicar('Sortear 1 vez');
    const antes = bolas().map((c) => c.getAttribute('cx'));
    act(() => { vi.advanceTimersByTime(100); });
    expect(bolas().map((c) => c.getAttribute('cx'))).not.toEqual(antes);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(resultados(armazem)!.casos).toHaveLength(1);
    const saiu = bolas().filter((c) => c.getAttribute('data-saiu') === 'sim');
    expect(saiu).toHaveLength(1);
    expect(saiu[0]!.getAttribute('cy')).toBe('30');
  });
});

describe('perfis', () => {
  it('iniciais: só Roleta e Misturador, sem fórmulas, sem colunas, sem semente; estatística é contar um valor da lista', () => {
    montar('iniciais');
    expect(screen.queryByRole('button', { name: 'Contador' })).not.toBeInTheDocument();
    expect(botao('Roleta')).toBeInTheDocument();
    expect(botao('Misturador')).toBeInTheDocument();
    abrir('Coletar estatística');
    abrir('Resultado');
    expect(screen.queryByLabelText('Fórmula da estatística')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Rótulo da estatística')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Rodar até que')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Semente/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Colunas do resultado' })).not.toBeInTheDocument();
    const lista = screen.getByLabelText('Contar quantas vezes sai');
    expect(within(lista).getAllByRole('option').map((o) => o.textContent)).toEqual(['Cara', 'Coroa']);
  });

  it('finais: mostra o contador, as colunas e as fórmulas', () => {
    montar('finais');
    expect(botao('Contador')).toBeInTheDocument();
    expect(screen.getByLabelText('Fórmula da estatística')).toBeInTheDocument();
    expect(screen.getByLabelText('Rodar até que')).toBeInTheDocument();
    expect(screen.getByLabelText(/Semente/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Colunas do resultado' })).toBeInTheDocument();
  });

  it('iniciais com um objeto que estava no Contador mostra a roleta (sem escrever no projeto)', () => {
    const { armazem } = montar('iniciais', { dispositivo: 'contador' });
    expect(screen.getByRole('img', { name: /^Roleta\./ })).toBeInTheDocument();
    expect((projetoDe(armazem).objetos.find((o) => o.id === SIM)!.estado as { dispositivo: string }).dispositivo).toBe('contador');
  });

  it('iniciais: coletar estatística conta o valor escolhido em cada repetição', async () => {
    const { armazem } = montar('iniciais', { itensPorRepeticao: 10 });
    abrir('Coletar estatística');
    await userEvent.selectOptions(screen.getByLabelText('Contar quantas vezes sai'), 'Coroa');
    const reps = screen.getByLabelText('Repetições para a estatística');
    await userEvent.clear(reps);
    await userEvent.type(reps, '25');
    await userEvent.click(botao('Coletar estatística'));
    const est = estatisticas(armazem)!;
    expect(est.casos).toHaveLength(25);
    expect(est.atributos.map((a) => a.nome)).toEqual(['Repetição', 'Quantidade de Coroa']);
    const valores = est.casos.map((k) => k.valores[est.atributos[1]!.id] as number);
    expect(valores.every((v) => Number.isInteger(v) && v >= 0 && v <= 10)).toBe(true);
    expect(new Set(valores).size).toBeGreaterThan(1);
    expect(resultados(armazem)).toBeUndefined();
    expect(screen.getByText('Pronto! 25 estatísticas na coleção "Estatísticas do simulador".')).toBeInTheDocument();
    const hist = projetoDe(armazem).historicoEstatisticas as { rotulo: string; repeticoes: number; resumo: { n: number } }[];
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({ rotulo: 'Quantidade de Coroa', repeticoes: 25, resumo: { n: 25 } });
    expect(() => validarProjeto(projetoDe(armazem))).not.toThrow();
    act(() => armazem.getState().desfazer());
    expect(estatisticas(armazem)).toBeUndefined();
    expect(projetoDe(armazem).historicoEstatisticas).toHaveLength(0);
  });
});

describe('estatística com fórmula (anos finais)', () => {
  async function escrever(rotulo: string, texto: string) {
    const campo = screen.getByLabelText(rotulo);
    await userEvent.clear(campo);
    if (texto) await userEvent.click(campo), await userEvent.paste(texto);
  }

  it('avalia a fórmula em cada repetição e grava numa segunda coleção', async () => {
    const { armazem } = montar('finais', { itensPorRepeticao: 4, estatistica: { formula: 'contagem(se([Resultado] = "Cara", 1))', rotulo: 'Caras', valorContado: '', rodarAteQue: '', usarRodarAteQue: false, repeticoes: 30, limite: 10000 } });
    await userEvent.click(botao('Coletar estatística'));
    const est = estatisticas(armazem)!;
    expect(est.casos).toHaveLength(30);
    expect(est.atributos.map((a) => a.nome)).toEqual(['Repetição', 'Caras']);
    expect(est.casos.every((k) => (k.valores[est.atributos[1]!.id] as number) <= 4)).toBe(true);
    const estado = projetoDe(armazem).objetos.find((o) => o.id === SIM)!.estado as { colecaoEstatisticasId: string };
    expect(estado.colecaoEstatisticasId).toBe(est.id);
  });

  const configEst = (extra: Record<string, unknown>) => ({
    itensPorRepeticao: 1,
    estatistica: { formula: 'contagem(se([Resultado] = "Cara", 1))', rotulo: 'Caras', valorContado: '', rodarAteQue: '[Caras] = 1', usarRodarAteQue: true, repeticoes: 5, limite: 10000, ...extra },
  });

  it('rodar até que: para quando a condição fica verdadeira', async () => {
    const { armazem } = montar('finais', configEst({}));
    await userEvent.click(botao('Coletar estatística'));
    const est = estatisticas(armazem)!;
    const valores = est.casos.map((k) => k.valores[est.atributos[1]!.id]);
    expect(valores.at(-1)).toBe(1);
    expect(valores.slice(0, -1).every((v) => v === 0)).toBe(true);
    expect(screen.getByText(`A condição ficou verdadeira depois de ${valores.length} ${valores.length === 1 ? 'repetição' : 'repetições'}.`)).toBeInTheDocument();
    const hist = projetoDe(armazem).historicoEstatisticas as { rodarAteQue?: string }[];
    expect(hist[0]!.rodarAteQue).toBe('[Caras] = 1');
  });

  it('rodar até que: o limite de segurança evita laço infinito e avisa', async () => {
    const { armazem } = montar('finais', configEst({ rodarAteQue: 'falso', limite: 50 }));
    await userEvent.click(botao('Coletar estatística'));
    expect(estatisticas(armazem)!.casos).toHaveLength(50);
    expect(screen.getByText('Cheguei ao limite de 50 repetições e a condição não ficou verdadeira.')).toBeInTheDocument();
  });

  it('rodar até que: condição inválida e limite acima de 10.000 dão erro em português', async () => {
    const { armazem } = montar('finais', configEst({ rodarAteQue: '[Nada] > 1' }));
    await userEvent.click(botao('Coletar estatística'));
    expect(screen.getByRole('alert')).toHaveTextContent('Problema na condição "[Nada] > 1"');
    expect(estatisticas(armazem)).toBeUndefined();
    const limite = screen.getByLabelText('Limite de segurança (repetições)');
    await userEvent.clear(limite);
    await userEvent.type(limite, '20000');
    await userEvent.click(botao('Coletar estatística'));
    expect(screen.getByRole('alert')).toHaveTextContent('O limite de repetições precisa ser um número inteiro de 1 a 10.000.');
  });

  it('erro de fórmula aparece em português e não cria nada', async () => {
    const { armazem } = montar('finais');
    await escrever('Fórmula da estatística', 'contagem(');
    await userEvent.click(botao('Coletar estatística'));
    expect(screen.getByRole('alert')).toHaveTextContent(/^Não consegui sortear: Problema na fórmula "contagem\(":/);
    expect(estatisticas(armazem)).toBeUndefined();
    await escrever('Fórmula da estatística', 'soma([Inexistente])');
    await userEvent.click(botao('Coletar estatística'));
    expect(screen.getByRole('alert')).toHaveTextContent("Não achei o atributo 'Inexistente'");
    expect(estatisticas(armazem)).toBeUndefined();
    await escrever('Fórmula da estatística', '');
    await userEvent.click(botao('Coletar estatística'));
    expect(screen.getByRole('alert')).toHaveTextContent('Escreva a fórmula da estatística');
    expect(projetoDe(armazem).colecoes.map((c) => c.id)).toEqual(['exemplo-colecao']); // nada foi sorteado
    expect(projetoDe(armazem).historicoEstatisticas).toEqual([]);
  });
});

describe('erros de configuração em português', () => {
  it('proporção zero, roleta sem setores e itens maiores que as bolas sem reposição', async () => {
    const { armazem } = montar('finais');
    const prop = screen.getByLabelText('Proporção do setor 2');
    await userEvent.clear(prop);
    await userEvent.type(prop, '0');
    await userEvent.click(botao('Sortear 1 vez'));
    expect(screen.getByRole('alert')).toHaveTextContent("Não consegui sortear: A proporção do setor 'Coroa' precisa ser um número maior que zero.");
    expect(resultados(armazem)).toBeUndefined();

    await userEvent.click(screen.getByRole('button', { name: 'Remover setor 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remover setor 1' }));
    await userEvent.click(botao('Sortear 1 vez'));
    expect(screen.getByRole('alert')).toHaveTextContent('A roleta precisa ter pelo menos um setor.');

    await userEvent.click(botao('Misturador'));
    await userEvent.click(screen.getByLabelText('Devolver a bola ao misturador depois de sortear'));
    const itens = screen.getByLabelText('Itens por repetição');
    await userEvent.clear(itens);
    await userEvent.type(itens, '9');
    await userEvent.click(botao('Sortear 1 vez'));
    expect(screen.getByRole('alert')).toHaveTextContent('Você pediu 9 itens por repetição, mas o misturador só tem 5 bolas e a reposição está desligada.');
    expect(resultados(armazem)).toBeUndefined();
  });

  it('muitos casos de uma vez e repetições inválidas', async () => {
    montar('finais', { repeticoes: 10000, itensPorRepeticao: 50 });
    await userEvent.click(botao('Sortear 10000 vezes'));
    expect(screen.getByRole('alert')).toHaveTextContent('Isso daria 500.000 casos, e o máximo é 100.000.');
    const reps = screen.getByLabelText('Número de repetições');
    await userEvent.clear(reps);
    await userEvent.type(reps, '0');
    await userEvent.click(botao('Sortear 0 vezes'));
    expect(screen.getByRole('alert')).toHaveTextContent('O número de repetições precisa ser um número inteiro de 1 a 10.000.');
  });
});

describe('edição e acessibilidade', () => {
  it('edita nome, proporção (com vírgula), cor e adiciona/remove setores; tudo desfazível', async () => {
    const { armazem } = montar('finais');
    const obj = () => projetoDe(armazem).objetos.find((o) => o.id === SIM)!.estado as { roleta: { setores: { nome: string; proporcao: number; cor: string }[] } };
    const nome = screen.getByLabelText('Nome do setor 1');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Verde');
    expect(obj().roleta.setores[0]!.nome).toBe('Verde');
    const prop = screen.getByLabelText('Proporção do setor 2');
    await userEvent.clear(prop);
    await userEvent.type(prop, '0,5');
    expect(obj().roleta.setores[1]!.proporcao).toBe(0.5);
    fireEvent.change(screen.getByLabelText('Cor do setor 1'), { target: { value: '#112233' } });
    expect(obj().roleta.setores[0]!.cor).toBe('#112233');
    await userEvent.click(botao('Adicionar setor'));
    expect(obj().roleta.setores).toHaveLength(3);
    expect(screen.getByLabelText('Nome do setor 3')).toHaveValue('Setor 3');
    await userEvent.click(screen.getByRole('button', { name: 'Remover setor 3' }));
    expect(obj().roleta.setores).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Roleta. Verde: 66,7%; Coroa: 33,3%' })).toBeInTheDocument();
    act(() => armazem.getState().desfazer());
    expect(obj().roleta.setores).toHaveLength(3);
  });

  it('edita colunas do resultado: contagem de um elemento e soma', async () => {
    const { armazem } = montar('finais', { itensPorRepeticao: 5, repeticoes: 3 });
    abrir('Resultado');
    await userEvent.click(botao('Adicionar coluna'));
    await userEvent.selectOptions(screen.getByLabelText('O que a coluna 3 mostra'), 'contagem');
    await userEvent.selectOptions(screen.getByLabelText('Elemento contado na coluna 3'), 'Cara');
    const nomeCol = screen.getByLabelText('Nome da coluna 3');
    await userEvent.clear(nomeCol);
    await userEvent.type(nomeCol, 'Caras');
    await userEvent.click(botao('Sortear 3 vezes'));
    const col = resultados(armazem)!;
    expect(col.atributos.map((a) => a.nome)).toEqual(['Repetição', 'Resultado', 'Caras']);
    for (const r of [1, 2, 3]) {
      const linhas = col.casos.filter((k) => k.valores['col-repeticao'] === r);
      const caras = linhas.filter((k) => k.valores['col-resultado'] === 'Cara').length;
      expect(linhas.every((k) => k.valores[col.atributos[2]!.id] === caras)).toBe(true);
    }
  });

  it('rótulos aria em português, regiões e figuras com descrição', () => {
    montar('finais');
    const painel = screen.getByRole('region', { name: 'Controles do simulador' });
    expect(painel).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dispositivo' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Ações do simulador' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Roleta. Cara: 50%; Coroa: 50%' })).toBeInTheDocument();
    for (const rotulo of ['Nome do setor 1', 'Cor do setor 1', 'Proporção do setor 1', 'Remover setor 1', 'Itens por repetição', 'Número de repetições', 'Velocidade']) {
      expect(screen.getByLabelText(rotulo)).toBeInTheDocument();
    }
    expect(botao('Misturador')).toHaveAttribute('aria-pressed', 'false');
    expect(botao('Roleta')).toHaveAttribute('aria-pressed', 'true');
  });

  it('dá para usar só com o teclado: Tab/Shift+Tab percorrem os botões e Enter sorteia', async () => {
    const { armazem } = montar('finais', { repeticoes: 3 });
    act(() => botao('Roleta').focus());
    await userEvent.tab();
    expect(document.activeElement).toBe(botao('Misturador'));
    await userEvent.tab();
    expect(document.activeElement).toBe(botao('Contador'));
    await userEvent.tab();
    expect(document.activeElement).toBe(botao('Sortear 1 vez'));
    await userEvent.keyboard('{Enter}');
    expect(resultados(armazem)!.casos).toHaveLength(1);
    await userEvent.tab();
    expect(document.activeElement).toBe(botao('Sortear 3 vezes'));
    await userEvent.keyboard(' ');
    expect(resultados(armazem)!.casos).toHaveLength(4);
    await userEvent.tab(); // Parar está desativado: pula
    expect(document.activeElement).toBe(botao('Recomeçar'));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(botao('Sortear 3 vezes'));
    // os resumos das seções abrem com o teclado
    const resumo = screen.getByText('Coletar estatística', { selector: 'summary' });
    act(() => resumo.focus());
    expect(document.activeElement).toBe(resumo);
  });

  it('o aviso de erro é anunciado (role alert) e o resultado fica numa região de leitura (aria-live)', async () => {
    montar('finais', { repeticoes: 3 });
    expect(screen.getByTestId('saida')).toHaveAttribute('aria-live', 'polite');
    await userEvent.click(botao('Sortear 3 vezes'));
    expect(screen.getByTestId('saida').textContent).toMatch(/^Saiu: (Cara|Coroa)$/);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
