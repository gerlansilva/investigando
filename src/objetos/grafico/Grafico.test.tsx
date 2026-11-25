// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from 'zustand';
import { criarProjeto } from '../../modelo/fabrica';
import { criarArmazem } from '../../estado';
import { Grafico, LARGURA_PAINEL } from './Grafico';
import { lerEstado } from './estado';
import { areaInterna, calcularMargem, prepararLayout } from './layout';
import {
  A_IDADE, A_MEIO, A_TEMPO, colecaoPequena, criarProps, estadoCom, ID_COL, objetoGrafico, simularCanvas, simularMovimentoReduzido,
} from './testeUtil';
import type { PropsObjeto } from './../../app/tiposObjeto';

let canvas: ReturnType<typeof simularCanvas>;
beforeEach(() => {
  canvas = simularCanvas();
  simularMovimentoReduzido(true);
});
afterEach(() => {
  cleanup();
  canvas.restaurar();
  vi.restoreAllMocks();
});

const textosDoSvg = () => Array.from(screen.getByTestId('grafico-svg').querySelectorAll('text')).map((t) => t.textContent);

/** Posição (em px, relativa à área de interação) de cada caso, calculada como o componente calcula. */
function posicoes(estado: ReturnType<typeof estadoCom>, props: PropsObjeto<unknown>) {
  const margem = calcularMargem(estado, props.colecao);
  const area = areaInterna(props.objeto.l - LARGURA_PAINEL, props.objeto.a, margem);
  const layout = prepararLayout({ estado, colecao: props.colecao, largura: area.largura, altura: area.altura });
  return { layout, area, ponto: (i: number) => ({ x: layout.alvo[2 * i]!, y: layout.alvo[2 * i + 1]! }) };
}

describe('Grafico: eixos e rótulos', () => {
  it('categórico: um rótulo por categoria e o nome do atributo', () => {
    render(<Grafico {...criarProps(estadoCom({ x: { atributoId: A_MEIO, modo: 'separar' } }))} />);
    const t = textosDoSvg();
    expect(t).toEqual(expect.arrayContaining(['A', 'B', 'C', 'Meio']));
    expect(screen.getByRole('img', { name: 'Gráfico de pontos com 6 casos' })).toBeInTheDocument();
  });

  it('numérico: marcas com vírgula decimal e nome com unidade', () => {
    const col = colecaoPequena();
    col.casos.forEach((c, i) => { c.valores[A_TEMPO] = i / 5; }); // 0; 0,2; ... 1
    render(<Grafico {...criarProps(estadoCom({ x: { atributoId: A_TEMPO, modo: 'separar' } }), { colecao: col })} />);
    const t = textosDoSvg();
    expect(t).toEqual(expect.arrayContaining(['0', '0,2', '0,4', '0,6', '0,8', '1', 'Tempo (min)']));
    expect(t.some((x) => x?.includes('.'))).toBe(false);
  });

  it('intervalos: limites nas marcas e rótulos [a; b[ com o último fechado', () => {
    const estado = estadoCom({ x: { atributoId: A_TEMPO, modo: 'intervalos', intervalos: { largura: 5 } } });
    render(<Grafico {...criarProps(estado)} />);
    const t = textosDoSvg();
    expect(t).toEqual(expect.arrayContaining(['0', '5', '10', '[0; 5[', '[5; 10]']));
  });

  it('eixo vertical categórico: rótulos das categorias à esquerda', () => {
    render(<Grafico {...criarProps(estadoCom({ y: { atributoId: A_MEIO, modo: 'separar' } }))} />);
    expect(textosDoSvg()).toEqual(expect.arrayContaining(['A', 'B', 'C', 'Meio']));
  });

  it('média e contagem: rótulos por grupo', () => {
    const estado = estadoCom({ x: { atributoId: A_TEMPO, modo: 'separar' }, y: { atributoId: A_MEIO, modo: 'separar' }, mostrar: ['media', 'contagem'] });
    render(<Grafico {...criarProps(estado)} />);
    const t = textosDoSvg();
    expect(t).toEqual(expect.arrayContaining(['média 1,25', 'média 6,25', 'média 10', '2']));
  });

  it('sem eixos: nuvem, sem rótulos de eixo', () => {
    render(<Grafico {...criarProps(estadoCom({}))} />);
    expect(textosDoSvg()).toEqual([]);
  });

  it('sem coleção mostra aviso em português', () => {
    render(<Grafico {...criarProps(estadoCom({}), { colecao: undefined })} />);
    expect(screen.getByRole('status', { name: 'Gráfico sem dados' })).toHaveTextContent('ainda não tem dados');
  });

  it('estado corrompido não quebra', () => {
    render(<Grafico {...criarProps({ lixo: true })} />);
    expect(screen.getByTestId('grafico-svg')).toBeInTheDocument();
  });
});

describe('Grafico: canvas', () => {
  it('bitmap usa devicePixelRatio (nitidez em retina)', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    const props = criarProps(estadoCom({ x: { atributoId: A_MEIO, modo: 'separar' } }));
    const { container } = render(<Grafico {...props} />);
    const c = container.querySelector('canvas')!;
    const { area } = posicoes(lerEstado(props.objeto.estado), props);
    expect(c.width).toBe(area.largura * 2);
    expect(c.height).toBe(area.altura * 2);
    expect(c.style.width).toBe(`${area.largura}px`);
    expect(canvas.chamadas.some((x) => x.nome === 'setTransform' && x.args[0] === 2)).toBe(true);
    expect(canvas.chamadas.some((x) => x.nome === 'fill')).toBe(true);
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });
});

describe('Grafico: seleção', () => {
  const estado = estadoCom({ x: { atributoId: A_MEIO, modo: 'separar' }, y: { atributoId: A_TEMPO, modo: 'separar' } });

  it('clique seleciona o caso; Shift e Cmd alternam; clique no vazio limpa', () => {
    const props = criarProps(estado);
    render(<Grafico {...props} />);
    const area = screen.getByTestId('grafico-interacao');
    const { ponto } = posicoes(lerEstado(props.objeto.estado), props);
    const p3 = ponto(3);
    fireEvent.pointerDown(area, { clientX: p3.x, clientY: p3.y, button: 0 });
    fireEvent.pointerUp(area, { clientX: p3.x, clientY: p3.y, button: 0 });
    expect(props.aoSelecionar).toHaveBeenLastCalledWith(['c3'], 'substituir');

    const p0 = ponto(0);
    fireEvent.pointerDown(area, { clientX: p0.x, clientY: p0.y, button: 0, shiftKey: true });
    fireEvent.pointerUp(area, { clientX: p0.x, clientY: p0.y, button: 0, shiftKey: true });
    expect(props.aoSelecionar).toHaveBeenLastCalledWith(['c0'], 'alternar');

    fireEvent.pointerDown(area, { clientX: p0.x, clientY: p0.y, button: 0, metaKey: true });
    fireEvent.pointerUp(area, { clientX: p0.x, clientY: p0.y, button: 0, metaKey: true });
    expect(props.aoSelecionar).toHaveBeenLastCalledWith(['c0'], 'alternar');

    fireEvent.pointerDown(area, { clientX: 3, clientY: 3, button: 0 });
    fireEvent.pointerUp(area, { clientX: 3, clientY: 3, button: 0 });
    expect(props.aoSelecionar).toHaveBeenLastCalledWith([], 'limpar');
  });

  it('laço seleciona os casos dentro do retângulo, em qualquer direção', () => {
    const props = criarProps(estado);
    render(<Grafico {...props} />);
    const area = screen.getByTestId('grafico-interacao');
    const { layout, ponto } = posicoes(lerEstado(props.objeto.estado), props);
    // todos
    fireEvent.pointerDown(area, { clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(area, { clientX: 300, clientY: 200 });
    expect(screen.getByTestId('grafico-laco')).toBeInTheDocument();
    fireEvent.pointerUp(area, { clientX: layout.largura, clientY: layout.altura, button: 0 });
    expect(props.aoSelecionar).toHaveBeenLastCalledWith(layout.ids, 'substituir');
    expect(screen.queryByTestId('grafico-laco')).toBeNull();

    // só a primeira coluna (categoria A = c0, c1), arrastando de baixo-direita para cima-esquerda
    const a = ponto(0);
    const b = ponto(1);
    const x1 = Math.max(a.x, b.x) + 8;
    const y1 = Math.max(a.y, b.y) + 8;
    const x0 = Math.min(a.x, b.x) - 8;
    const y0 = Math.min(a.y, b.y) - 8;
    fireEvent.pointerDown(area, { clientX: x1, clientY: y1, button: 0 });
    fireEvent.pointerMove(area, { clientX: x0, clientY: y0 });
    fireEvent.pointerUp(area, { clientX: x0, clientY: y0, button: 0 });
    expect(props.aoSelecionar).toHaveBeenLastCalledWith(['c0', 'c1'], 'substituir');
  });

  it('laço vazio limpa; laço com Shift alterna', () => {
    const props = criarProps(estado);
    render(<Grafico {...props} />);
    const area = screen.getByTestId('grafico-interacao');
    fireEvent.pointerDown(area, { clientX: 1, clientY: 1, button: 0 });
    fireEvent.pointerMove(area, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(area, { clientX: 20, clientY: 20, button: 0 });
    expect(props.aoSelecionar).toHaveBeenLastCalledWith([], 'limpar');
    const { layout } = posicoes(lerEstado(props.objeto.estado), props);
    fireEvent.pointerDown(area, { clientX: 0, clientY: 0, button: 0, shiftKey: true });
    fireEvent.pointerUp(area, { clientX: layout.largura, clientY: layout.altura, button: 0, shiftKey: true });
    expect(props.aoSelecionar).toHaveBeenLastCalledWith(layout.ids, 'alternar');
  });

  it('Escape limpa e Ctrl+A seleciona tudo; contador acessível', () => {
    const props = criarProps(estado, { selecao: new Set(['c1', 'c2']) });
    render(<Grafico {...props} />);
    const area = screen.getByTestId('grafico-interacao');
    expect(screen.getByText('2 casos escolhidos')).toBeInTheDocument();
    fireEvent.keyDown(area, { key: 'Escape' });
    expect(props.aoSelecionar).toHaveBeenLastCalledWith([], 'limpar');
    fireEvent.keyDown(area, { key: 'a', ctrlKey: true });
    expect(props.aoSelecionar).toHaveBeenLastCalledWith(['c0', 'c1', 'c2', 'c3', 'c4', 'c5'], 'substituir');
  });

  it('selecionados são desenhados com anel (traçado extra) e o resto esmaecido', () => {
    const props = criarProps(estado, { selecao: new Set(['c1']) });
    render(<Grafico {...props} />);
    const aneis = canvas.chamadas.filter((c) => c.nome === 'stroke').length;
    expect(aneis).toBeGreaterThan(0);
    // dois traçados por selecionado (contorno branco + anel escuro) além dos contornos dos grupos
    expect(canvas.chamadas.some((c) => c.nome === 'arc' && Number(c.args[2]) > 6)).toBe(true);
  });
});

describe('Grafico: filtro', () => {
  it('fórmula inválida mostra erro em português e não esconde casos', () => {
    render(<Grafico {...criarProps(estadoCom({ filtro: 'idade >' }))} />);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toMatch(/^Fórmula com problema: /);
    expect(alerta.textContent!.length).toBeGreaterThan(25);
    expect(screen.getByRole('img', { name: 'Gráfico de pontos com 6 casos' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mostrar só os casos em que')).toHaveAttribute('aria-invalid', 'true');
  });

  it('atributo inexistente na fórmula também vira erro em português', () => {
    render(<Grafico {...criarProps(estadoCom({ filtro: 'altura > 3' }))} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Não achei o atributo 'altura'");
  });

  it('fórmula válida filtra os casos', () => {
    render(<Grafico {...criarProps(estadoCom({ filtro: 'Idade >= 10' }))} />);
    expect(screen.getByRole('img', { name: 'Gráfico de pontos com 4 casos' })).toBeInTheDocument();
    expect(screen.getByText('Mostrando 4 de 6')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('digitar no campo envia um comando para o histórico', () => {
    const props = criarProps(estadoCom({}));
    render(<Grafico {...props} />);
    fireEvent.change(screen.getByLabelText('Mostrar só os casos em que'), { target: { value: 'Idade > 9' } });
    expect(props.executar).toHaveBeenCalledTimes(1);
    expect((props.executar as ReturnType<typeof vi.fn>).mock.calls[0]![0].rotulo).toBe('Mudar filtro');
  });
});

describe('Grafico: painel por perfil', () => {
  const avancados = [
    'Ordenar', 'Intervalos', 'Média', 'Mediana', 'Moda', 'Porcentagem', 'Trocar eixos', 'Salvar imagem',
  ];

  it('iniciais mostra só Separar, Empilhar e Contar (e esconde as ferramentas avançadas)', () => {
    render(<Grafico {...criarProps(estadoCom({ x: { atributoId: A_MEIO, modo: 'separar' } }), { perfil: 'iniciais' })} />);
    const painel = screen.getByRole('complementary', { name: 'Controles do gráfico' });
    const p = within(painel);
    expect(p.getAllByRole('button', { name: 'Separar' })).toHaveLength(2);
    expect(p.getAllByRole('button', { name: 'Empilhar' })).toHaveLength(2);
    expect(p.getByRole('button', { name: 'Contar' })).toBeInTheDocument();
    for (const nome of avancados) expect(p.queryByRole('button', { name: nome })).toBeNull();
    expect(p.queryByLabelText('Mostrar só os casos em que')).toBeNull();
    expect(p.queryByLabelText('Colorir por')).toBeNull();
    expect(p.getByLabelText('Tamanho do ícone', { exact: false })).toBeInTheDocument();
    // os ícones (peixe, pinguim…) aparecem em todos os perfis
    expect(p.getByRole('button', { name: 'Peixe' })).toBeInTheDocument();
    // mas ainda dá para escolher os atributos e remexer
    expect(p.getByLabelText('Atributo do eixo horizontal')).toBeInTheDocument();
    expect(p.getByRole('button', { name: 'Remexer' })).toBeInTheDocument();
  });

  it('finais mostra tudo', () => {
    render(<Grafico {...criarProps(estadoCom({ x: { atributoId: A_TEMPO, modo: 'intervalos' } }))} />);
    const p = within(screen.getByRole('complementary', { name: 'Controles do gráfico' }));
    for (const nome of avancados) expect(p.getAllByRole('button', { name: nome }).length).toBeGreaterThan(0);
    expect(p.getByLabelText('Mostrar só os casos em que')).toBeInTheDocument();
    expect(p.getByLabelText('Colorir por')).toBeInTheDocument();
    expect(p.getByLabelText('Largura do intervalo')).toBeInTheDocument();
  });

  it('largura de intervalo não aparece fora do modo Intervalos', () => {
    render(<Grafico {...criarProps(estadoCom({ x: { atributoId: A_TEMPO, modo: 'separar' } }))} />);
    expect(screen.queryByLabelText('Largura do intervalo')).toBeNull();
  });
});

describe('Grafico: comandos pelo armazém (integração)', () => {
  function Mesa() {
    return null;
  }
  function Ligado({ armazem }: { armazem: ReturnType<typeof criarArmazem> }) {
    const projeto = useStore(armazem, (s) => s.projeto);
    const executar = useStore(armazem, (s) => s.executar);
    const selarHistorico = useStore(armazem, (s) => s.selarHistorico);
    const objeto = projeto.objetos[0]!;
    return (
      <Grafico objeto={objeto} colecao={projeto.colecoes[0]} selecao={new Set()} aoSelecionar={() => {}}
        executar={executar} selarHistorico={selarHistorico} perfil="finais" />
    );
  }
  void Mesa;

  function montar() {
    const projeto = criarProjeto();
    projeto.colecoes.push(colecaoPequena());
    projeto.objetos.push(objetoGrafico(estadoCom({})));
    const armazem = criarArmazem(projeto);
    render(<Ligado armazem={armazem} />);
    return armazem;
  }
  const estadoDoObjeto = (a: ReturnType<typeof criarArmazem>) => lerEstado(a.getState().projeto.objetos[0]!.estado);

  it('escolher atributo, modo, medida, cor, forma e trocar eixos mudam o estado e podem ser desfeitos', () => {
    const armazem = montar();
    fireEvent.change(screen.getByLabelText('Atributo do eixo horizontal'), { target: { value: A_MEIO } });
    expect(estadoDoObjeto(armazem).x).toEqual({ atributoId: A_MEIO, modo: 'separar' });
    fireEvent.change(screen.getByLabelText('Atributo do eixo vertical'), { target: { value: A_TEMPO } });
    expect(estadoDoObjeto(armazem).y?.atributoId).toBe(A_TEMPO);

    const painel = within(screen.getByRole('complementary'));
    fireEvent.click(painel.getAllByRole('button', { name: 'Empilhar' })[0]!);
    expect(estadoDoObjeto(armazem).x?.modo).toBe('empilhar');

    fireEvent.click(painel.getByRole('button', { name: 'Trocar eixos' }));
    expect(estadoDoObjeto(armazem).x?.atributoId).toBe(A_TEMPO);
    expect(estadoDoObjeto(armazem).y?.atributoId).toBe(A_MEIO);

    fireEvent.click(painel.getByRole('button', { name: 'Média' }));
    expect(estadoDoObjeto(armazem).mostrar).toEqual(['media']);
    fireEvent.click(painel.getByRole('button', { name: 'Quadrado' }));
    expect(estadoDoObjeto(armazem).icone.forma).toBe('quadrado');
    fireEvent.change(painel.getByLabelText('Colorir por'), { target: { value: A_MEIO } });
    expect(estadoDoObjeto(armazem).corPor).toBe(A_MEIO);
    expect(screen.getByRole('group', { name: 'Legenda: Meio' })).toBeInTheDocument();

    fireEvent.change(painel.getByLabelText('Atributo do eixo vertical'), { target: { value: '' } });
    expect(estadoDoObjeto(armazem).y).toBeNull();

    const semente = estadoDoObjeto(armazem).semente;
    fireEvent.click(painel.getByRole('button', { name: 'Remexer' }));
    expect(estadoDoObjeto(armazem).semente).not.toBe(semente);
    expect(estadoDoObjeto(armazem).x).toBeNull();

    act(() => armazem.getState().desfazer());
    expect(estadoDoObjeto(armazem).x).not.toBeNull();
  });

  it('largura do intervalo ajustável', () => {
    const armazem = montar();
    fireEvent.change(screen.getByLabelText('Atributo do eixo horizontal'), { target: { value: A_IDADE } });
    fireEvent.click(within(screen.getByRole('complementary')).getAllByRole('button', { name: 'Intervalos' })[0]!);
    expect(estadoDoObjeto(armazem).x?.modo).toBe('intervalos');
    fireEvent.change(screen.getByLabelText('Largura do intervalo'), { target: { value: '2,5' } });
    expect(estadoDoObjeto(armazem).x?.intervalos?.largura).toBe(2.5);
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar a largura do intervalo' }));
    expect(estadoDoObjeto(armazem).x?.intervalos?.largura).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: 'Automática' }));
    expect(estadoDoObjeto(armazem).x?.intervalos).toBeUndefined();
  });

  it('cor por atributo numérico mostra gradiente na legenda', () => {
    const armazem = montar();
    fireEvent.change(screen.getByLabelText('Colorir por'), { target: { value: A_TEMPO } });
    const leg = screen.getByRole('group', { name: 'Legenda: Tempo' });
    expect(leg).toHaveTextContent('0');
    expect(leg).toHaveTextContent('10');
    expect(estadoDoObjeto(armazem).corPor).toBe(A_TEMPO);
  });

  it('controle de tamanho sela o histórico ao soltar', () => {
    const props = criarProps(estadoCom({}));
    render(<Grafico {...props} />);
    const r = screen.getByLabelText(/Tamanho do ícone/);
    fireEvent.change(r, { target: { value: '20' } });
    expect(props.executar).toHaveBeenCalled();
    fireEvent.pointerUp(r);
    expect(props.selarHistorico).toHaveBeenCalled();
  });
});

describe('Grafico: animação com requestAnimationFrame', () => {
  it('anima da nuvem até o alvo, para o laço e respeita movimento reduzido', () => {
    simularMovimentoReduzido(false);
    const fila: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      fila.push(cb);
      return fila.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const props = criarProps(estadoCom({ x: { atributoId: A_MEIO, modo: 'separar' } }));
    render(<Grafico {...props} />);
    expect(fila.length).toBe(1);
    let t = 1000;
    let quadros = 0;
    while (fila.length > 0) {
      const cb = fila.shift()!;
      cb(t);
      t += 100;
      if (++quadros > 50) throw new Error('o laço não parou');
    }
    // 500 ms de animação a 100 ms por quadro: primeiro quadro (0 ms) + 5
    expect(quadros).toBeGreaterThanOrEqual(5);
    expect(quadros).toBeLessThanOrEqual(8);
    expect(fila.length).toBe(0);
    cleanup();
  });

  it('com movimento reduzido não pede quadros', () => {
    simularMovimentoReduzido(true);
    const spy = vi.spyOn(window, 'requestAnimationFrame');
    render(<Grafico {...criarProps(estadoCom({ x: { atributoId: A_MEIO, modo: 'separar' } }))} />);
    expect(spy).not.toHaveBeenCalled();
  });

  it('acima de 10.000 pontos não interpola', () => {
    simularMovimentoReduzido(false);
    const spy = vi.spyOn(window, 'requestAnimationFrame');
    const col = colecaoPequena();
    col.casos = Array.from({ length: 10001 }, (_, i) => ({ id: `n${i}`, valores: { [A_MEIO]: i % 3 === 0 ? 'A' : 'B', [A_TEMPO]: i % 17, [A_IDADE]: i % 5 } }));
    render(<Grafico {...criarProps(estadoCom({ x: { atributoId: A_MEIO, modo: 'separar' } }), { colecao: col })} />);
    expect(spy).not.toHaveBeenCalled();
  });
});

void ID_COL;

describe('Grafico: ferramentas ajustadas pelo professor', () => {
  it('no Básico, o professor liga a Média; no Completo, desliga a Moda', () => {
    const basico = render(<Grafico {...criarProps(estadoCom({ x: { atributoId: A_MEIO, modo: 'separar' } }), { perfil: 'iniciais', ferramentas: { media: true } })} />);
    expect(basico.getByRole('button', { name: 'Média' })).toBeInTheDocument();
    expect(basico.queryByRole('button', { name: 'Mediana' })).toBeNull();
    basico.unmount();
    render(<Grafico {...criarProps(estadoCom({ x: { atributoId: A_MEIO, modo: 'separar' } }), { perfil: 'finais', ferramentas: { moda: false } })} />);
    expect(screen.queryByRole('button', { name: 'Moda' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mediana' })).toBeInTheDocument();
  });
});
