import { z } from 'zod';
import { ErroArquivo } from './erros';
import { migrar } from './migracoes';
import { ETAPAS, TIPOS_ATRIBUTO, TIPOS_OBJETO, type Projeto } from './tipos';

const id = z.string().min(1);
const etapa = z.enum(ETAPAS as [string, ...string[]]);

const atributo = z.object({
  id,
  nome: z.string().min(1),
  tipo: z.enum(TIPOS_ATRIBUTO as [string, ...string[]]),
  cor: z.string(),
  unidade: z.string().optional(),
  formula: z.string().optional(),
  formato: z.object({ casas: z.number().int().min(0).optional() }).optional(),
});

const caso = z.object({
  id,
  valores: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
  oculto: z.boolean().optional(),
});

const colecao = z.object({
  id,
  nome: z.string(),
  atributos: z.array(atributo),
  casos: z.array(caso),
});

const objeto = z.object({
  id,
  tipo: z.enum(TIPOS_OBJETO as [string, ...string[]]),
  x: z.number(),
  y: z.number(),
  l: z.number(),
  a: z.number(),
  etapa,
  titulo: z.string().optional(),
  estado: z.unknown(),
});

const conclusao = z.object({
  texto: z.string(),
  limites: z.string(),
  vi: z.string().optional(),
  mostra: z.string().optional(),
  naoSei: z.string().optional(),
});

const ciclo = z.object({
  n: z.number().int(),
  pergunta: z.string(),
  etapasConcluidas: z.array(etapa),
  conclusao: conclusao.optional(),
  arquivado: z.boolean().optional(),
});

const professor = z.object({
  ativo: z.boolean(),
  etapasTravadas: z.array(etapa),
  tiposOcultos: z.array(z.enum(TIPOS_OBJETO as [string, ...string[]])),
  perfilFixo: z.enum(['iniciais', 'finais']).optional(),
  ferramentas: z.record(z.string(), z.boolean()).optional(),
  pin: z.object({ sal: z.string().min(1), hash: z.string().min(1) }).optional(),
});

export const esquemaProjeto = z
  .object({
    versao: z.literal(1),
    id,
    titulo: z.string(),
    autor: z.string().optional(),
    cicloAtual: etapa,
    ciclos: z.array(ciclo),
    colecoes: z.array(colecao),
    objetos: z.array(objeto),
    globais: z.record(z.string(), z.number()),
    historicoEstatisticas: z.array(z.unknown()),
    professor: professor.optional(),
    criadoEm: z.string(),
    modificadoEm: z.string(),
  })
  .superRefine((p, ctx) => {
    const problema = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const repetido = (ids: string[]) => ids.find((x, i) => ids.indexOf(x) !== i);

    const objRepetido = repetido(p.objetos.map((o) => o.id));
    if (objRepetido) problema(['objetos'], `Há dois objetos com o mesmo identificador ('${objRepetido}')`);
    const colRepetida = repetido(p.colecoes.map((c) => c.id));
    if (colRepetida) problema(['colecoes'], `Há duas coleções com o mesmo identificador ('${colRepetida}')`);

    p.colecoes.forEach((c, ci) => {
      const atrRepetido = repetido(c.atributos.map((a) => a.id));
      if (atrRepetido) problema(['colecoes', ci, 'atributos'], `Há dois atributos com o mesmo identificador ('${atrRepetido}')`);
      const casoRepetido = repetido(c.casos.map((k) => k.id));
      if (casoRepetido) problema(['colecoes', ci, 'casos'], `Há dois casos com o mesmo identificador ('${casoRepetido}')`);
      const conhecidos = new Set(c.atributos.map((a) => a.id));
      c.casos.forEach((k, ki) => {
        const orfao = Object.keys(k.valores).find((chave) => !conhecidos.has(chave));
        if (orfao) problema(['colecoes', ci, 'casos', ki, 'valores'], `O caso tem valor para um atributo que não existe ('${orfao}')`);
      });
    });
  });

function nomeDoCaminho(caminho: readonly PropertyKey[]): string {
  if (caminho.length === 0) return 'o arquivo inteiro';
  return caminho.reduce<string>((acc, parte) => (typeof parte === 'number' ? `${acc}[${parte}]` : acc ? `${acc}.${String(parte)}` : String(parte)), '');
}

function valorEm(dado: unknown, caminho: readonly PropertyKey[]): unknown {
  let atual = dado;
  for (const parte of caminho) {
    if (typeof atual !== 'object' || atual === null) return undefined;
    atual = (atual as Record<PropertyKey, unknown>)[parte];
  }
  return atual;
}

const TIPOS_EM_PORTUGUES: Record<string, string> = {
  string: 'texto', number: 'número', boolean: 'verdadeiro/falso', array: 'lista', object: 'objeto', int: 'número inteiro',
};

function descreverProblema(dado: unknown, issue: z.core.$ZodIssue): string {
  const onde = nomeDoCaminho(issue.path);
  const valor = valorEm(dado, issue.path);
  switch (issue.code) {
    case 'invalid_type':
      if (valor === undefined) return `Falta o campo '${onde}'`;
      return `O campo '${onde}' deveria ser ${TIPOS_EM_PORTUGUES[issue.expected] ?? issue.expected}`;
    case 'invalid_value':
      return `O campo '${onde}' tem um valor inválido; os aceitos são: ${issue.values.map(String).join(', ')}`;
    case 'too_small':
      return `O campo '${onde}' está vazio ou pequeno demais`;
    case 'custom':
      return issue.message;
    default:
      return `O campo '${onde}' tem um valor inválido`;
  }
}

export function validarProjeto(dado: unknown): Projeto {
  const resultado = esquemaProjeto.safeParse(dado);
  if (resultado.success) return resultado.data as unknown as Projeto;
  throw new ErroArquivo(
    'O arquivo não é um projeto válido do Investigando.',
    resultado.error.issues.map((issue) => descreverProblema(dado, issue)),
  );
}

export function abrirProjeto(texto: string): Projeto {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroArquivo('O arquivo está danificado ou não está no formato do Investigando (não consegui ler o conteúdo).');
  }
  return validarProjeto(migrar(bruto));
}

export function salvarProjeto(projeto: Projeto): string {
  return JSON.stringify(validarProjeto(projeto), null, 2);
}
