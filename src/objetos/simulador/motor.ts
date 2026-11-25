// Motor de execução em blocos: roda repetições sem travar a interface.
// Sem React. Com `msPorRepeticao` > 0 espera esse tempo entre repetições (para a animação);
// com 0 roda o mais rápido possível, devolvendo o controle ao navegador a cada ~12 ms.

export type MotivoFim = 'completo' | 'parado' | 'erro';

export interface OpcoesMotor {
  /** Quantas repetições, no máximo. */
  total: number;
  /** 0 = sem espera (instantâneo). */
  msPorRepeticao: number;
  /** Executa a repetição `indice` (começa em 0). Devolve `{ fim: true }` para terminar antes do total. */
  passo(indice: number): { fim?: boolean } | void;
  /** Chamado depois de cada bloco de repetições já feitas (aqui se grava no projeto). */
  aoBloco(feitas: number): void;
  aoTerminar(motivo: MotivoFim, feitas: number, erro?: unknown): void;
  orcamentoMs?: number;
  agora?: () => number;
}

export interface Motor {
  parar(): void;
  readonly ativo: boolean;
}

export function iniciarMotor(op: OpcoesMotor): Motor {
  const agora = op.agora ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const orcamento = op.orcamentoMs ?? 12;
  let feitas = 0;
  let pendente = false;
  let terminou = false;
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  const gravar = () => {
    if (pendente) {
      pendente = false;
      op.aoBloco(feitas);
    }
  };
  const encerrar = (motivo: MotivoFim, erro?: unknown) => {
    if (terminou) return;
    terminou = true;
    if (temporizador !== undefined) clearTimeout(temporizador);
    op.aoTerminar(motivo, feitas, erro);
  };
  const fechar = (motivo: MotivoFim, erro?: unknown) => {
    try {
      gravar();
    } catch (e) {
      encerrar('erro', e);
      return;
    }
    encerrar(motivo, erro);
  };

  const fatia = () => {
    temporizador = undefined;
    const inicio = agora();
    for (;;) {
      let resultado: { fim?: boolean } | void;
      try {
        resultado = op.passo(feitas);
      } catch (e) {
        fechar('erro', e);
        return;
      }
      feitas += 1;
      pendente = true;
      const ultimo = resultado?.fim === true || feitas >= op.total;
      if (op.msPorRepeticao > 0) {
        temporizador = setTimeout(() => {
          temporizador = undefined;
          if (terminou) return;
          try {
            gravar();
          } catch (e) {
            encerrar('erro', e);
            return;
          }
          if (ultimo) encerrar('completo');
          else fatia();
        }, op.msPorRepeticao);
        return;
      }
      if (ultimo) {
        fechar('completo');
        return;
      }
      if (agora() - inicio >= orcamento) {
        try {
          gravar();
        } catch (e) {
          encerrar('erro', e);
          return;
        }
        temporizador = setTimeout(fatia, 0);
        return;
      }
    }
  };

  fatia();
  return {
    parar() {
      if (!terminou) fechar('parado');
    },
    get ativo() {
      return !terminou;
    },
  };
}
