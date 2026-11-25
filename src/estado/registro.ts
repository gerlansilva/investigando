// Registro de pesquisa (diário pedagógico): módulo puro. Guarda só eventos pedagógicos com carimbo de tempo,
// sem nomes, textos digitados nem identificadores de pessoas. Nada sai do computador.
import { z } from 'zod';
import type { Id, Projeto } from '../modelo/tipos';

export const TIPOS_EVENTO = ['etapa_mudou', 'objeto_criado', 'caso_selecionado', 'simulacao_feita'] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export type DetalheEvento = Record<string, string | number>;

export interface EventoRegistro {
  /** Carimbo ISO 8601 (UTC). */
  t: string;
  tipo: TipoEvento;
  detalhe: DetalheEvento;
}

export interface Registro {
  ativo: boolean;
  eventos: readonly EventoRegistro[];
}

/** Teto de eventos guardados; os mais antigos saem primeiro. */
export const LIMITE_EVENTOS = 5000;

export function criarRegistro(): Registro {
  return { ativo: false, eventos: [] };
}

export function ligarRegistro(r: Registro): Registro {
  return r.ativo ? r : { ...r, ativo: true };
}

export function desligarRegistro(r: Registro): Registro {
  return r.ativo ? { ...r, ativo: false } : r;
}

export function limparRegistro(r: Registro): Registro {
  return r.eventos.length === 0 ? r : { ...r, eventos: [] };
}

/** Só aceita detalhes simples (texto curto ou número); descarta o resto. Evita levar texto livre para o diário. */
export function limparDetalhe(detalhe: DetalheEvento): DetalheEvento {
  const saida: DetalheEvento = {};
  for (const [k, v] of Object.entries(detalhe)) {
    if (typeof v === 'number' && Number.isFinite(v)) saida[k] = v;
    else if (typeof v === 'string') saida[k] = v.slice(0, 40);
  }
  return saida;
}

/** Acrescenta um evento; com o registro desligado devolve o mesmo objeto (nada é guardado). */
export function registrarEvento(r: Registro, tipo: TipoEvento, detalhe: DetalheEvento = {}, agora: Date = new Date()): Registro {
  if (!r.ativo) return r;
  const evento: EventoRegistro = { t: agora.toISOString(), tipo, detalhe: limparDetalhe(detalhe) };
  const eventos = [...r.eventos, evento];
  return { ...r, eventos: eventos.length > LIMITE_EVENTOS ? eventos.slice(eventos.length - LIMITE_EVENTOS) : eventos };
}

export interface EventoNovo {
  tipo: TipoEvento;
  detalhe: DetalheEvento;
}

export interface FotoDeEstado {
  projeto: Projeto;
  selecaoCasos: Record<Id, ReadonlySet<Id>>;
}

function totalSelecionado(s: Record<Id, ReadonlySet<Id>>): number {
  return Object.values(s).reduce((n, c) => n + c.size, 0);
}

/** Compara dois estados e diz que eventos pedagógicos aconteceram entre eles. Outro projeto (id diferente) não gera eventos. */
export function eventosDaTransicao(antes: FotoDeEstado, depois: FotoDeEstado): EventoNovo[] {
  const a = antes.projeto;
  const d = depois.projeto;
  if (a.id !== d.id) return [];
  const eventos: EventoNovo[] = [];
  if (a.cicloAtual !== d.cicloAtual) eventos.push({ tipo: 'etapa_mudou', detalhe: { de: a.cicloAtual, para: d.cicloAtual } });
  const idsAntes = new Set(a.objetos.map((o) => o.id));
  for (const o of d.objetos) if (!idsAntes.has(o.id)) eventos.push({ tipo: 'objeto_criado', detalhe: { objeto: o.tipo, etapa: o.etapa } });
  const selAntes = totalSelecionado(antes.selecaoCasos);
  const selDepois = totalSelecionado(depois.selecaoCasos);
  if (selDepois > 0 && antes.selecaoCasos !== depois.selecaoCasos && (selDepois !== selAntes || selecaoMudou(antes.selecaoCasos, depois.selecaoCasos))) {
    eventos.push({ tipo: 'caso_selecionado', detalhe: { quantidade: selDepois } });
  }
  const rodadaAntes = new Map(a.objetos.filter((o) => o.tipo === 'simulador').map((o) => [o.id, rodadaDe(o.estado)]));
  for (const o of d.objetos) {
    if (o.tipo !== 'simulador') continue;
    const rodada = rodadaDe(o.estado);
    if (rodada > (rodadaAntes.get(o.id) ?? 0)) eventos.push({ tipo: 'simulacao_feita', detalhe: { rodada } });
  }
  if (!eventos.some((e) => e.tipo === 'simulacao_feita') && d.historicoEstatisticas.length > a.historicoEstatisticas.length) {
    eventos.push({ tipo: 'simulacao_feita', detalhe: { registros: d.historicoEstatisticas.length - a.historicoEstatisticas.length } });
  }
  return eventos;
}

function rodadaDe(estado: unknown): number {
  const r = (estado as { rodada?: unknown } | null | undefined)?.rodada;
  return typeof r === 'number' && Number.isFinite(r) ? r : 0;
}

function selecaoMudou(a: Record<Id, ReadonlySet<Id>>, b: Record<Id, ReadonlySet<Id>>): boolean {
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of chaves) {
    const x = a[k];
    const y = b[k];
    if ((x?.size ?? 0) !== (y?.size ?? 0)) return true;
    if (x && y) for (const id of y) if (!x.has(id)) return true;
  }
  return false;
}

export function paraJSON(r: Registro): string {
  return JSON.stringify({ formato: 'investigando-registro', versao: 1, eventos: r.eventos }, null, 2);
}

function celulaCSV(v: string | number): string {
  let texto = String(v);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`; // evita fórmula ao abrir na planilha
  return /[",\n\r;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function paraCSV(r: Registro): string {
  const linhas = ['momento,evento,detalhe'];
  for (const e of r.eventos) {
    const detalhe = Object.entries(e.detalhe).map(([k, v]) => `${k}=${v}`).join(' ');
    linhas.push([e.t, e.tipo, detalhe].map(celulaCSV).join(','));
  }
  return linhas.join('\r\n') + '\r\n';
}

const esquemaEvento = z.object({
  t: z.string(),
  tipo: z.enum(TIPOS_EVENTO),
  detalhe: z.record(z.string(), z.union([z.string(), z.number()])),
});
const esquemaArquivo = z.object({ eventos: z.array(esquemaEvento) });

/** Lê o que `paraJSON` escreveu (ou o que ficou guardado); devolve null se estiver inválido. */
export function lerRegistroJSON(texto: string): readonly EventoRegistro[] | null {
  try {
    const r = esquemaArquivo.safeParse(JSON.parse(texto));
    return r.success ? r.data.eventos.map((e) => ({ ...e, detalhe: limparDetalhe(e.detalhe) })) : null;
  } catch {
    return null;
  }
}
