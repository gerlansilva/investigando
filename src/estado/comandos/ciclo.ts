import type { CicloInvestigativo, ConclusaoCiclo, EtapaCiclo, Projeto } from '../../modelo/tipos';
import { criarComando, ErroComando, type Comando } from './base';

const NOMES_DE_ETAPA: Record<EtapaCiclo, string> = {
  problema: 'Problema', plano: 'Plano', dados: 'Dados', analise: 'Análise', conclusao: 'Conclusão',
};

export type CampoConclusao = 'vi' | 'mostra' | 'naoSei' | 'limites';

/** Ciclo em andamento: o último da lista (os anteriores ficam arquivados). */
export function cicloCorrente(p: Pick<Projeto, 'ciclos'>): CicloInvestigativo | undefined {
  return p.ciclos[p.ciclos.length - 1];
}

/** Junta os campos do roteiro num texto corrido ("Vi que… Isso mostra que… Mas não sei se…"). */
export function comporTextoConclusao(c: Pick<ConclusaoCiclo, 'vi' | 'mostra' | 'naoSei'>): string {
  const frase = (inicio: string, resto: string | undefined) => {
    const limpo = (resto ?? '').trim().replace(/[.\s]+$/, '');
    return limpo ? `${inicio} ${limpo}.` : '';
  };
  return [frase('Vi que', c.vi), frase('Isso mostra que', c.mostra), frase('Mas não sei se', c.naoSei)]
    .filter(Boolean)
    .join(' ');
}

function garantirCiclo(p: Projeto): CicloInvestigativo {
  let c = cicloCorrente(p);
  if (!c) {
    c = { n: 1, pergunta: '', etapasConcluidas: [] };
    p.ciclos.push(c);
    c = cicloCorrente(p)!;
  }
  return c;
}

export function definirPergunta(pergunta: string): Comando {
  return criarComando({
    rotulo: 'Escrever a pergunta',
    receita: (p) => {
      garantirCiclo(p).pergunta = pergunta;
    },
    fusao: { chave: 'pergunta', params: pergunta, recriar: definirPergunta },
  });
}

export function marcarEtapaConcluida(etapa: EtapaCiclo): Comando {
  return criarComando({
    rotulo: `Marcar a etapa ${NOMES_DE_ETAPA[etapa]} como concluída`,
    receita: (p) => {
      const c = garantirCiclo(p);
      if (etapa === 'conclusao' && !(c.conclusao?.limites ?? '').trim()) {
        throw new ErroComando('Escreva o que você não pode afirmar antes de concluir a Conclusão.');
      }
      if (!c.etapasConcluidas.includes(etapa)) c.etapasConcluidas.push(etapa);
    },
  });
}

export function desmarcarEtapaConcluida(etapa: EtapaCiclo): Comando {
  return criarComando({
    rotulo: `Desmarcar a etapa ${NOMES_DE_ETAPA[etapa]}`,
    receita: (p) => {
      const c = garantirCiclo(p);
      c.etapasConcluidas = c.etapasConcluidas.filter((e) => e !== etapa);
    },
  });
}

/** Escreve um campo da conclusão; o texto corrido é recalculado a partir do roteiro. */
export function definirCampoConclusao(campo: CampoConclusao, valor: string): Comando {
  return criarComando({
    rotulo: campo === 'limites' ? 'Escrever o que não posso afirmar' : 'Escrever a conclusão',
    receita: (p) => {
      const c = garantirCiclo(p);
      const atual: ConclusaoCiclo = c.conclusao ?? { texto: '', limites: '' };
      const novo: ConclusaoCiclo = { ...atual, [campo]: valor };
      if (campo !== 'limites') novo.texto = comporTextoConclusao(novo);
      c.conclusao = novo;
      // Sem limites, a Conclusão deixa de valer como concluída.
      if (campo === 'limites' && !valor.trim()) c.etapasConcluidas = c.etapasConcluidas.filter((e) => e !== 'conclusao');
    },
    fusao: { chave: `conclusao:${campo}`, params: valor, recriar: (v) => definirCampoConclusao(campo, v) },
  });
}

/** Arquiva o ciclo em andamento e abre o próximo; coleções e objetos continuam na mesa. */
export function novoCiclo(pergunta = ''): Comando {
  return criarComando({
    rotulo: 'Começar um novo ciclo',
    receita: (p) => {
      const atual = cicloCorrente(p);
      if (atual) atual.arquivado = true;
      const n = p.ciclos.reduce((m, c) => Math.max(m, c.n), 0) + 1;
      p.ciclos.push({ n, pergunta, etapasConcluidas: [] });
      p.cicloAtual = 'problema';
    },
  });
}
