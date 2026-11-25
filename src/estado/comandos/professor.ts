import { ETAPAS, TIPOS_OBJETO, type EtapaCiclo, type ModoProfessor, type PerfilFixo, type Projeto, type TipoObjeto } from '../../modelo/tipos';
import { criarComando, ErroComando, type Comando } from './base';

/** Limites que a interface do aluno deve respeitar (vazios quando o modo professor está desligado). */
export interface LimitesProfessor {
  ativo: boolean;
  etapasTravadas: readonly EtapaCiclo[];
  tiposOcultos: readonly TipoObjeto[];
  perfilFixo: PerfilFixo | null;
}

const SEM_LIMITES: LimitesProfessor = { ativo: false, etapasTravadas: [], tiposOcultos: [], perfilFixo: null };

export function limitesDoProfessor(p: Pick<Projeto, 'professor'>): LimitesProfessor {
  const pr = p.professor;
  if (!pr?.ativo) return SEM_LIMITES;
  return { ativo: true, etapasTravadas: pr.etapasTravadas, tiposOcultos: pr.tiposOcultos, perfilFixo: pr.perfilFixo ?? null };
}

/** Hash simples (cyrb53 duas vezes, com sal), só para não guardar o PIN em claro. É uma trava de sala de aula, não segurança forte. */
export function hashPin(pin: string, sal: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let volta = 0; volta < 2; volta++) {
    for (const c of `${sal}:${pin}`) {
      const k = c.codePointAt(0)!;
      h1 = Math.imul(h1 ^ k, 2654435761);
      h2 = Math.imul(h2 ^ k, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  }
  return ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0'));
}

export function pinValido(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export function temPin(p: Pick<Projeto, 'professor'>): boolean {
  return !!p.professor?.pin;
}

/** Sem PIN cadastrado, qualquer tentativa vale; com PIN, só o correto. */
export function verificarPin(p: Pick<Projeto, 'professor'>, pin: string | undefined): boolean {
  const guardado = p.professor?.pin;
  if (!guardado) return true;
  return pin !== undefined && hashPin(pin, guardado.sal) === guardado.hash;
}

function novoSal(): string {
  return Math.random().toString(36).slice(2, 10) || 'sal';
}

function criarPadrao(): ModoProfessor {
  return { ativo: false, etapasTravadas: [], tiposOcultos: [] };
}

function exigirAtivo(p: Projeto): ModoProfessor {
  if (!p.professor?.ativo) throw new ErroComando('Ative o modo professor primeiro.');
  return p.professor;
}

export function ativarModoProfessor(opcoes: { pin?: string; sal?: string } = {}): Comando {
  if (opcoes.pin !== undefined && !pinValido(opcoes.pin)) throw new ErroComando('O PIN deve ter de 4 a 8 números.');
  const sal = opcoes.sal ?? novoSal();
  return criarComando({
    rotulo: 'Ativar o modo professor',
    receita: (p) => {
      const atual = p.professor ?? criarPadrao();
      atual.ativo = true;
      if (opcoes.pin !== undefined) atual.pin = { sal, hash: hashPin(opcoes.pin, sal) };
      p.professor = atual;
    },
  });
}

/** Com PIN cadastrado, exige o PIN. A configuração (travas, PIN) fica guardada para a próxima vez. */
export function desativarModoProfessor(pin?: string): Comando {
  return criarComando({
    rotulo: 'Desativar o modo professor',
    receita: (p) => {
      if (!p.professor?.ativo) return;
      if (!verificarPin(p, pin)) throw new ErroComando('PIN incorreto.');
      p.professor.ativo = false;
    },
  });
}

export function definirEtapaTravada(etapa: EtapaCiclo, travada: boolean): Comando {
  if (!ETAPAS.includes(etapa)) throw new ErroComando('Etapa desconhecida.');
  return criarComando({
    rotulo: travada ? 'Travar uma etapa' : 'Destravar uma etapa',
    receita: (p) => {
      const pr = exigirAtivo(p);
      const sem = pr.etapasTravadas.filter((e) => e !== etapa);
      if (!travada) {
        pr.etapasTravadas = sem;
        return;
      }
      if (p.cicloAtual === etapa) throw new ErroComando('Não dá para travar a etapa em que o aluno está agora.');
      pr.etapasTravadas = ETAPAS.filter((e) => e === etapa || sem.includes(e));
    },
  });
}

export function definirTipoOculto(tipo: TipoObjeto, oculto: boolean): Comando {
  if (!TIPOS_OBJETO.includes(tipo)) throw new ErroComando('Tipo de objeto desconhecido.');
  return criarComando({
    rotulo: oculto ? 'Ocultar um objeto novo' : 'Permitir um objeto novo',
    receita: (p) => {
      const pr = exigirAtivo(p);
      const sem = pr.tiposOcultos.filter((x) => x !== tipo);
      pr.tiposOcultos = oculto ? TIPOS_OBJETO.filter((x) => x === tipo || sem.includes(x)) : sem;
    },
  });
}

/** `null` solta o perfil (o aluno volta a escolher). */
export function fixarPerfil(perfil: PerfilFixo | null): Comando {
  return criarComando({
    rotulo: perfil ? 'Fixar o perfil de ensino' : 'Soltar o perfil de ensino',
    receita: (p) => {
      const pr = exigirAtivo(p);
      if (perfil) pr.perfilFixo = perfil;
      else delete pr.perfilFixo;
    },
  });
}

/** Troca ou remove o PIN. Se já há PIN, `pinAtual` precisa conferir. */
export function definirPin(novo: string | null, pinAtual?: string, sal: string = novoSal()): Comando {
  if (novo !== null && !pinValido(novo)) throw new ErroComando('O PIN deve ter de 4 a 8 números.');
  return criarComando({
    rotulo: novo === null ? 'Remover o PIN' : 'Definir o PIN',
    receita: (p) => {
      const pr = exigirAtivo(p);
      if (!verificarPin(p, pinAtual)) throw new ErroComando('PIN incorreto.');
      if (novo === null) delete pr.pin;
      else pr.pin = { sal, hash: hashPin(novo, sal) };
    },
  });
}
