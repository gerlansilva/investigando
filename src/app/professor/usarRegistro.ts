import { useCallback, useEffect, useRef, useState } from 'react';
import type { Armazem } from '../../estado/usarArmazem';
import {
  criarRegistro, desligarRegistro, eventosDaTransicao, lerRegistroJSON, ligarRegistro, limparRegistro, registrarEvento,
  type FotoDeEstado, type Registro,
} from '../../estado/registro';

export const CHAVE_REGISTRO = 'investigando.registro.v1';

type Armazenamento = Pick<Storage, 'getItem' | 'setItem'>;

function armazenamentoPadrao(): Armazenamento | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function carregarRegistro(a: Armazenamento | null = armazenamentoPadrao()): Registro {
  try {
    const texto = a?.getItem(CHAVE_REGISTRO);
    if (!texto) return criarRegistro();
    const eventos = lerRegistroJSON(texto);
    const ativo = (JSON.parse(texto) as { ativo?: unknown }).ativo === true;
    return eventos ? { ativo, eventos } : criarRegistro();
  } catch {
    return criarRegistro();
  }
}

function guardar(r: Registro, a: Armazenamento | null): void {
  try {
    a?.setItem(CHAVE_REGISTRO, JSON.stringify({ ativo: r.ativo, eventos: r.eventos }));
  } catch {
    // sem espaço ou bloqueado: o registro continua só na memória
  }
}

export interface ControleRegistro {
  registro: Registro;
  ligar(): void;
  desligar(): void;
  limpar(): void;
}

/** Observa o armazém e anota os eventos pedagógicos enquanto o registro está ligado. Tudo fica no localStorage deste computador. */
export function useRegistroPesquisa(armazem: Armazem): ControleRegistro {
  const [registro, setRegistro] = useState<Registro>(() => carregarRegistro());
  const ref = useRef(registro);
  const foto = useRef<FotoDeEstado>(null as unknown as FotoDeEstado);
  if (foto.current === null) {
    const s = armazem.getState();
    foto.current = { projeto: s.projeto, selecaoCasos: s.selecaoCasos };
  }

  const atualizar = useCallback((novo: Registro) => {
    if (novo === ref.current) return;
    ref.current = novo;
    setRegistro(novo);
    guardar(novo, armazenamentoPadrao());
  }, []);

  useEffect(() => {
    const s = armazem.getState();
    foto.current = { projeto: s.projeto, selecaoCasos: s.selecaoCasos };
    return armazem.subscribe((estado) => {
      const depois: FotoDeEstado = { projeto: estado.projeto, selecaoCasos: estado.selecaoCasos };
      const antes = foto.current;
      foto.current = depois;
      if (!ref.current.ativo) return;
      let r = ref.current;
      for (const e of eventosDaTransicao(antes, depois)) r = registrarEvento(r, e.tipo, e.detalhe);
      atualizar(r);
    });
  }, [armazem, atualizar]);

  return {
    registro,
    ligar: () => atualizar(ligarRegistro(ref.current)),
    desligar: () => atualizar(desligarRegistro(ref.current)),
    limpar: () => atualizar(limparRegistro(ref.current)),
  };
}
