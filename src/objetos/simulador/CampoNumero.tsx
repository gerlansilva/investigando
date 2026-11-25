import { useEffect, useRef, useState } from 'react';

interface Props {
  rotulo: string;
  valor: number;
  aoMudar(valor: number): void;
  aoSair?(): void;
  /** Número de caracteres que cabem (largura visual). */
  largura?: number;
}

function formatar(n: number): string {
  return String(n).replace('.', ',');
}

function ler(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (limpo === '' || !/^[+-]?\d*\.?\d+$|^[+-]?\d+\.$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Campo de número que aceita vírgula e guarda o texto enquanto a pessoa digita. */
export function CampoNumero({ rotulo, valor, aoMudar, aoSair, largura = 6 }: Props) {
  const [texto, setTexto] = useState(formatar(valor));
  const focado = useRef(false);
  useEffect(() => {
    if (!focado.current) setTexto(formatar(valor));
  }, [valor]);
  return (
    <input
      className="simulador-numero"
      type="text"
      inputMode="decimal"
      aria-label={rotulo}
      size={largura}
      value={texto}
      onFocus={() => {
        focado.current = true;
      }}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = ler(e.target.value);
        if (n !== null) aoMudar(n);
      }}
      onBlur={() => {
        focado.current = false;
        setTexto(formatar(valor));
        aoSair?.();
      }}
    />
  );
}
