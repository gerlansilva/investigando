// Registro das estatísticas coletadas (guardado em `projeto.historicoEstatisticas`).
import { z } from 'zod';
import { ErroSimulador } from './erro';
import { TIPOS_DISPOSITIVO, type TipoDispositivo } from './tipos';

export interface ResumoEstatistica {
  n: number;
  media: number | null;
  minimo: number | null;
  maximo: number | null;
}

export interface RegistroEstatistica {
  id: string;
  objetoId: string;
  criadoEm: string;
  rotulo: string;
  formula: string;
  rodarAteQue?: string;
  dispositivo: TipoDispositivo;
  itensPorRepeticao: number;
  /** Quantas repetições foram de fato executadas. */
  repeticoes: number;
  semente: number;
  /** Coleção que recebeu as linhas. */
  colecaoId: string;
  resumo: ResumoEstatistica;
}

const numeroOuNulo = z.number().finite().nullable();

export const esquemaRegistroEstatistica = z.object({
  id: z.string().min(1),
  objetoId: z.string().min(1),
  criadoEm: z.string(),
  rotulo: z.string(),
  formula: z.string(),
  rodarAteQue: z.string().optional(),
  dispositivo: z.enum(TIPOS_DISPOSITIVO as [TipoDispositivo, ...TipoDispositivo[]]),
  itensPorRepeticao: z.number().int().min(1),
  repeticoes: z.number().int().min(0),
  semente: z.number(),
  colecaoId: z.string().min(1),
  resumo: z.object({ n: z.number().int().min(0), media: numeroOuNulo, minimo: numeroOuNulo, maximo: numeroOuNulo }),
});

/** Valida um registro e devolve uma cópia limpa; erro em português se estiver malformado. */
export function validarRegistroEstatistica(dado: unknown): RegistroEstatistica {
  const r = esquemaRegistroEstatistica.safeParse(dado);
  if (r.success) return r.data as RegistroEstatistica;
  const campos = [...new Set(r.error.issues.map((i) => i.path.join('.') || 'registro'))].join(', ');
  throw new ErroSimulador(`O registro da estatística está incompleto ou inválido (campos: ${campos}).`);
}

/** Verifica sem lançar erro (para ler projetos antigos, onde a lista era de tipo livre). */
export function ehRegistroEstatistica(dado: unknown): dado is RegistroEstatistica {
  return esquemaRegistroEstatistica.safeParse(dado).success;
}

export function resumirValores(valores: readonly (number | string | null)[]): ResumoEstatistica {
  const numeros = valores.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (numeros.length === 0) return { n: valores.length, media: null, minimo: null, maximo: null };
  let soma = 0;
  let minimo = numeros[0]!;
  let maximo = numeros[0]!;
  for (const x of numeros) {
    soma += x;
    if (x < minimo) minimo = x;
    if (x > maximo) maximo = x;
  }
  return { n: valores.length, media: soma / numeros.length, minimo, maximo };
}
