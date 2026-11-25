// @vitest-environment jsdom
// Regressão da fase 9 (qualidade, acessibilidade e robustez). Ver docs/VALIDACAO.md.
import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { exemploNaEtapa, limparAposCadaTeste } from './testeUtil';
import { criarArmazem } from '../estado/store';
import { LIMITE_HISTORICO } from '../estado/historico';
import { abrirProjeto, ErroArquivo } from '../modelo';
import { criarProjetoExemplo } from './projetoExemplo';
import { criarComando } from '../estado/comandos';

limparAposCadaTeste();

const ler = (caminho: string) => readFileSync(new URL(caminho, import.meta.url), 'utf8');

function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function variavel(css: string, nome: string): string {
  const m = css.match(new RegExp(`${nome}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`variável ${nome} não encontrada`);
  return m[1]!;
}

describe('contraste WCAG AA do tema', () => {
  const tema = ler('./tema.css');
  const paleta = ler('./paleta.css');
  const branco = variavel(tema, '--cor-fundo');
  const texto = variavel(paleta, '--cor-texto'); // a paleta troca a cor do texto
  it('texto, texto suave, destaque, perigo e sucesso passam de 4,5:1 sobre o fundo e sobre a camada', () => {
    const camada = '#f3f3f9';
    for (const fundo of [branco, camada, variavel(tema, '--cor-superficie-2')]) {
      expect(contraste(texto, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(variavel(tema, '--cor-texto-suave'), fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(variavel(tema, '--cor-destaque'), fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(variavel(tema, '--cor-tinta'), fundo)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contraste(variavel(tema, '--cor-perigo'), branco)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(variavel(tema, '--cor-sucesso'), branco)).toBeGreaterThanOrEqual(4.5);
  });
  it('a borda dos campos (cor-borda-forte) passa de 3:1 e é a usada nos campos', () => {
    expect(contraste(variavel(tema, '--cor-borda-forte'), branco)).toBeGreaterThanOrEqual(3);
    const css = ler('./acessibilidade.css');
    expect(css).toMatch(/\.simulador-numero[^{]*\{[^}]*border-color:\s*var\(--cor-borda-forte\)/);
    expect(css).toMatch(/\.grafico-campo[^{]*\{[^}]*border-color:\s*var\(--cor-borda-forte\)/);
  });
});

describe('alvos de toque e ordem dos estilos', () => {
  it('acessibilidade.css fixa alvo mínimo de 40px e é o último import de main.tsx', () => {
    const css = ler('./acessibilidade.css');
    expect(css).toMatch(/--alvo-minimo:\s*40px/);
    expect(css).toMatch(/\.app\[data-perfil='finais'\]\s*\{\s*--alvo:\s*40px/);
    for (const seletor of ['.etapa-botao', '.menu-botao', '.ficha-valor', '.grafico-campo', '.simulador-numero', '.botao-concluir']) {
      expect(css).toContain(seletor);
    }
    const imports = [...ler('../main.tsx').matchAll(/^import '(.+\.css)'/gm)].map((m) => m[1]);
    expect(imports.at(-1)).toBe('./app/acessibilidade.css');
  });
  it('o topo compacto reserva altura constante, mantém alvos >= 40px e fica depois de todos os estilos', () => {
    const css = ler('./acessibilidade.css');
    const topo = css.slice(css.indexOf('topo compacto'));
    expect(topo).toMatch(/--topo-faixa:\s*48px/);
    expect(topo).toMatch(/\.barra-contextual,\s*\.barra-contextual:empty\s*\{[^}]*min-height:\s*var\(--topo-faixa\)/);
    expect(topo).toMatch(/\.barra-contextual \.ferramenta\s*\{[^}]*flex-direction:\s*row[^}]*min-height:\s*var\(--alvo-minimo\)/);
    expect(topo).toMatch(/@media \(max-width: 799px\)[\s\S]*\.faixa-pergunta[^{]*\{[^}]*flex:\s*1 1 100%/);
    // nenhuma regra do topo reduz alvo abaixo de 40px (min-width/min-height)
    for (const m of topo.replace(/\.faixa-guia,[^}]*\}/, '').matchAll(/min-(?:height|width):\s*(\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(40);
    const imports = [...ler('../main.tsx').matchAll(/^import '(.+\.css)'/gm)].map((x) => x[1]);
    expect(imports.indexOf('./app/acessibilidade.css')).toBe(imports.length - 1);
  });
  it('as barras contextuais quebram linha em vez de rolar na horizontal', () => {
    const css = ler('./acessibilidade.css');
    expect(css).toMatch(/\.barra-contextual\s*\{[^}]*overflow-x:\s*visible[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.etapas ol\s*\{\s*flex-wrap:\s*wrap/);
  });
  it('prefers-reduced-motion zera transições e o movimento ao pairar', () => {
    const css = ler('./acessibilidade.css');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration:\s*0\.01ms !important/);
    expect(css).toMatch(/\.convite-card:hover[^{]*\{\s*transform:\s*none !important/);
  });
});

describe('estrutura, foco e teclado no App', () => {
  it('tem landmark main, link para pular para a mesa e a mesa recebe o foco', async () => {
    render(<App armazem={criarArmazem(exemploNaEtapa('dados'))} />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    const pular = screen.getByRole('link', { name: 'Pular para a mesa de trabalho' });
    await userEvent.click(pular);
    expect(screen.getByRole('region', { name: 'Mesa de trabalho' })).toHaveFocus();
  });

  it('o link de pular é o primeiro item da ordem de tabulação', async () => {
    render(<App armazem={criarArmazem(exemploNaEtapa('dados'))} />);
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Pular para a mesa de trabalho' })).toHaveFocus();
  });

  it('Esc no aviso de apagar fecha o diálogo e devolve o foco ao menu da janela', async () => {
    render(<App armazem={criarArmazem(exemploNaEtapa('dados'))} />);
    const janela = screen.getByRole('region', { name: /^Tabela/ });
    const menu = janela.querySelector<HTMLButtonElement>('.objeto-menu .menu-botao')!;
    await userEvent.click(menu);
    await userEvent.click(screen.getAllByRole('menuitem', { name: /apagar/i })[0]!);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(janela.querySelector('.objeto-menu .menu-botao')).toHaveFocus();
  });

  it('Esc ao renomear descarta o nome digitado e devolve o foco à barra da janela', async () => {
    const armazem = criarArmazem(exemploNaEtapa('dados'));
    render(<App armazem={armazem} />);
    const barra = screen.getByTestId('barra-exemplo-obj-tabela');
    barra.focus();
    await userEvent.keyboard('{F2}');
    await userEvent.keyboard('Nome novo{Escape}');
    expect(armazem.getState().projeto.objetos.find((o) => o.id === 'exemplo-obj-tabela')?.titulo).toBeUndefined();
    expect(barra).toHaveFocus();
  });

  it('a alça de redimensionar informa o tamanho (aria-valuenow) para leitores de tela', () => {
    render(<App armazem={criarArmazem(exemploNaEtapa('dados'))} />);
    const alca = screen.getByTestId('alca-exemplo-obj-tabela');
    expect(alca).toHaveAttribute('aria-valuenow', '520');
    expect(alca).toHaveAttribute('aria-valuetext', '520 por 380');
  });

  it('o ponteiro da roleta é decorativo (sem aria-label em <g>, que o ARIA proíbe)', async () => {
    const { registrarSimulador } = await import('../objetos/simulador');
    registrarSimulador();
    const p = exemploNaEtapa('plano');
    render(<App armazem={criarArmazem(p)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Novo objeto: Simulador' }));
    const g = document.querySelector('.simulador-roleta__ponteiro');
    expect(g).not.toBeNull();
    expect(g).not.toHaveAttribute('aria-label');
    expect(g).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('robustez', () => {
  const quebrados: [string, string][] = [
    ['vazio', ''],
    ['binário', '\u0000\u0001{{{'],
    ['truncado', JSON.stringify(criarProjetoExemplo()).slice(0, 80)],
    ['array', '[1,2]'],
    ['null', 'null'],
    ['sem versão', JSON.stringify({ ...criarProjetoExemplo(), versao: undefined })],
    ['versão futura', JSON.stringify({ ...criarProjetoExemplo(), versao: 99 })],
    ['tipos errados', JSON.stringify({ ...criarProjetoExemplo(), objetos: 'x', titulo: 5 })],
  ];
  it.each(quebrados)('arquivo %s vira ErroArquivo em português, nunca exceção solta', (_nome, texto) => {
    expect(() => abrirProjeto(texto)).toThrow(ErroArquivo);
    try { abrirProjeto(texto); } catch (e) { expect((e as Error).message).toMatch(/arquivo|projeto|versão/i); }
  });

  it('arquivo antigo sem campos opcionais (conclusão, arquivado, autor) abre normalmente', () => {
    const p = criarProjetoExemplo();
    const antigo = { ...p, ciclos: [{ n: 1, pergunta: '', etapasConcluidas: [] }] } as Record<string, unknown>;
    delete antigo.autor;
    expect(abrirProjeto(JSON.stringify(antigo)).ciclos[0]!.conclusao).toBeUndefined();
  });

  it('abrir arquivo corrompido no App mantém a tela e anuncia o erro com role=alert', async () => {
    render(<App armazem={criarArmazem(exemploNaEtapa('dados'))} />);
    await userEvent.upload(screen.getByTestId('entrada-arquivo'), new File(['\u0000lixo'], 'x.investigando', { type: '' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/danificado/);
    expect(screen.getByRole('region', { name: /^Tabela/ })).toBeInTheDocument();
  });

  it('desfazer 200 vezes (e além do limite) deixa o histórico consistente, e refazer volta ao fim', () => {
    const armazem = criarArmazem(criarProjetoExemplo());
    const total = LIMITE_HISTORICO + 25;
    for (let i = 0; i < total; i++) {
      armazem.getState().executar(criarComando({ rotulo: `passo ${i}`, receita: (p) => { p.globais[`v${i}`] = i; } }));
      armazem.getState().selarHistorico();
    }
    expect(armazem.getState().historico.desfazer).toHaveLength(LIMITE_HISTORICO);
    for (let i = 0; i < total; i++) armazem.getState().desfazer();
    expect(armazem.getState().historico.desfazer).toHaveLength(0);
    expect(armazem.getState().historico.refazer).toHaveLength(LIMITE_HISTORICO);
    expect(Object.keys(armazem.getState().projeto.globais)).toHaveLength(25); // os 25 mais antigos saíram da pilha
    for (let i = 0; i < total; i++) armazem.getState().refazer();
    expect(Object.keys(armazem.getState().projeto.globais)).toHaveLength(total);
  });
});
