// Estado do objeto "simulador" (guardado em `objeto.estado`) e conversão para a configuração de execução.
import { z } from 'zod';
import { PALETA_ATRIBUTOS } from '../modelo/fabrica';
import { colunasPadrao, NOMES_DE_COLUNA } from './executor';
import { nomesPossiveis } from './dispositivos';
import { formulaDeContagem } from './estatistica';
import {
  LIMITE_SEGURANCA, TIPOS_COLUNA, TIPOS_DISPOSITIVO,
  type ColunaResultado, type ConfigEstatistica, type ConfigSimulacao, type Dispositivo, type TipoColuna, type TipoDispositivo,
} from './tipos';

export type Velocidade = 'lenta' | 'media' | 'rapida' | 'instantanea';
export const VELOCIDADES: readonly Velocidade[] = ['lenta', 'media', 'rapida', 'instantanea'];
/** Duração da animação de cada item sorteado, em milissegundos. */
export const MS_POR_ITEM: Record<Velocidade, number> = { lenta: 1400, media: 700, rapida: 220, instantanea: 0 };

const cor = (i: number) => PALETA_ATRIBUTOS[i % PALETA_ATRIBUTOS.length]!;

const esquemaSetor = z.object({ nome: z.string(), proporcao: z.number(), cor: z.string() });
const esquemaBola = z.object({ nome: z.string(), quantidade: z.number(), cor: z.string() });
const esquemaColuna = z.object({
  id: z.string().min(1),
  nome: z.string(),
  tipo: z.enum(TIPOS_COLUNA as [TipoColuna, ...TipoColuna[]]),
  elemento: z.string().optional(),
});

export const estadoPadraoRoleta = () => ({
  setores: [
    { nome: 'Cara', proporcao: 1, cor: cor(0) },
    { nome: 'Coroa', proporcao: 1, cor: cor(1) },
  ],
});
export const estadoPadraoMisturador = () => ({
  bolas: [
    { nome: 'Vermelha', quantidade: 3, cor: cor(5) },
    { nome: 'Azul', quantidade: 2, cor: cor(0) },
  ],
  reposicao: true,
  reporEntreRepeticoes: true,
});
export const estadoPadraoContador = () => ({ modo: 'ate' as const, ate: 6, valores: '1, 2, 3' });
export const estatisticaPadrao = () => ({
  formula: '',
  rotulo: 'Estatística',
  valorContado: '',
  rodarAteQue: '',
  usarRodarAteQue: false,
  repeticoes: 100,
  limite: LIMITE_SEGURANCA,
});

export const esquemaEstadoSimulador = z.object({
  colecaoId: z.string().min(1).optional(),
  colecaoEstatisticasId: z.string().min(1).optional(),
  dispositivo: z.enum(TIPOS_DISPOSITIVO as [TipoDispositivo, ...TipoDispositivo[]]).default('roleta'),
  roleta: z.object({ setores: z.array(esquemaSetor) }).default(estadoPadraoRoleta),
  misturador: z
    .object({ bolas: z.array(esquemaBola), reposicao: z.boolean(), reporEntreRepeticoes: z.boolean() })
    .default(estadoPadraoMisturador),
  contador: z
    .object({ modo: z.enum(['ate', 'lista']), ate: z.number(), valores: z.string() })
    .default(estadoPadraoContador),
  itensPorRepeticao: z.number().default(1),
  repeticoes: z.number().default(10),
  velocidade: z.enum(VELOCIDADES as [Velocidade, ...Velocidade[]]).default('media'),
  colunas: z.array(esquemaColuna).default(colunasPadrao),
  estatistica: z
    .object({
      formula: z.string().default(''),
      rotulo: z.string().default('Estatística'),
      valorContado: z.string().default(''),
      rodarAteQue: z.string().default(''),
      usarRodarAteQue: z.boolean().default(false),
      repeticoes: z.number().default(100),
      limite: z.number().default(LIMITE_SEGURANCA),
    })
    .default(estatisticaPadrao),
  /** Semente do sorteio; sem ela, a interface sorteia uma na primeira execução. */
  semente: z.number().int().optional(),
  /** Quantas execuções já foram feitas (cada uma usa uma sequência diferente derivada da semente). */
  rodada: z.number().int().min(0).default(0),
});

export interface EstadoSimulador {
  colecaoId?: string;
  colecaoEstatisticasId?: string;
  dispositivo: TipoDispositivo;
  roleta: { setores: { nome: string; proporcao: number; cor: string }[] };
  misturador: { bolas: { nome: string; quantidade: number; cor: string }[]; reposicao: boolean; reporEntreRepeticoes: boolean };
  contador: { modo: 'ate' | 'lista'; ate: number; valores: string };
  itensPorRepeticao: number;
  repeticoes: number;
  velocidade: Velocidade;
  colunas: ColunaResultado[];
  estatistica: {
    formula: string; rotulo: string; valorContado: string; rodarAteQue: string; usarRodarAteQue: boolean; repeticoes: number; limite: number;
  };
  semente?: number;
  rodada: number;
}

export function estadoPadrao(): EstadoSimulador {
  return esquemaEstadoSimulador.parse({}) as EstadoSimulador;
}

/** Lê o `objeto.estado` (que pode estar vazio ou incompleto); campos inválidos voltam ao padrão. */
export function lerEstado(bruto: unknown): EstadoSimulador {
  const r = esquemaEstadoSimulador.safeParse(bruto ?? {});
  if (r.success) return r.data as EstadoSimulador;
  // Aproveita o que for válido, campo a campo.
  const base = estadoPadrao() as unknown as Record<string, unknown>;
  const origem = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>;
  for (const [chave, valor] of Object.entries(origem)) {
    const tentativa = esquemaEstadoSimulador.safeParse({ ...base, [chave]: valor });
    if (tentativa.success) base[chave] = valor;
  }
  return esquemaEstadoSimulador.parse(base) as EstadoSimulador;
}

export function dispositivoDoEstado(e: EstadoSimulador): Dispositivo {
  if (e.dispositivo === 'roleta') return { tipo: 'roleta', setores: e.roleta.setores };
  if (e.dispositivo === 'misturador') return { tipo: 'misturador', ...e.misturador };
  return {
    tipo: 'contador',
    modo: e.contador.modo,
    ate: e.contador.ate,
    valores: e.contador.valores.split(/[,;\n]/).map((v) => v.trim()).filter((v) => v !== ''),
  };
}

export function configDoEstado(e: EstadoSimulador): ConfigSimulacao {
  return { dispositivo: dispositivoDoEstado(e), itensPorRepeticao: e.itensPorRepeticao, colunas: e.colunas };
}

export function nomeDaColunaDeValor(colunas: readonly ColunaResultado[]): string {
  return (colunas.find((c) => c.tipo === 'valor')?.nome ?? NOMES_DE_COLUNA.valor).trim();
}

/**
 * Estatística a coletar. Nos anos iniciais (`simples`) é "quantos itens da repetição são iguais ao valor escolhido";
 * nos finais é a fórmula escrita pelo aluno.
 */
export function estatisticaDoEstado(e: EstadoSimulador, simples: boolean): ConfigEstatistica {
  const config = configDoEstado(e);
  const rotulo = e.estatistica.rotulo.trim();
  if (simples) {
    const nomes = nomesPossiveis(config.dispositivo);
    const valor = nomes.includes(e.estatistica.valorContado) ? e.estatistica.valorContado : (nomes[0] ?? '');
    return {
      formula: formulaDeContagem(nomeDaColunaDeValor(e.colunas), valor),
      rotulo: rotulo === '' || rotulo === 'Estatística' ? `Quantidade de ${valor}` : rotulo,
    };
  }
  const est: ConfigEstatistica = { formula: e.estatistica.formula, rotulo };
  if (e.estatistica.usarRodarAteQue) {
    est.rodarAteQue = e.estatistica.rodarAteQue;
    est.limite = e.estatistica.limite;
  }
  return est;
}
