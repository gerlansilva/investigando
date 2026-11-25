import { t } from '../../i18n/pt-BR';
import { TIPOS_COLUNA, nomesPossiveis, dispositivoDoEstado, type ColunaResultado, type TipoColuna } from '../../simulador';
import type { PropsPainel } from './tiposPainel';

const s = t.simulador;

/** Editor das colunas do resultado (só nos anos finais). */
export function PainelResultado({ estado, mudar, selar }: PropsPainel) {
  const colunas = estado.colunas;
  const nomes = nomesPossiveis(dispositivoDoEstado(estado));
  const trocar = (i: number, parcial: Partial<ColunaResultado>) => mudar({ colunas: colunas.map((c, k) => (k === i ? { ...c, ...parcial } : c)) });

  return (
    <div className="simulador-painel">
      <ul className="simulador-lista" aria-label={s.colunas}>
        {colunas.map((c, i) => (
          <li key={c.id} className="simulador-linha">
            <input className="simulador-texto" type="text" aria-label={s.colunaNome(i + 1)} value={c.nome} onChange={(e) => trocar(i, { nome: e.target.value })} onBlur={selar} />
            <select
              aria-label={s.colunaTipo(i + 1)}
              value={c.tipo}
              onChange={(e) => {
                const tipo = e.target.value as TipoColuna;
                const novo: ColunaResultado = { ...c, tipo };
                if (tipo === 'contagem') novo.elemento = c.elemento ?? nomes[0] ?? '';
                else delete novo.elemento;
                mudar({ colunas: colunas.map((x, k) => (k === i ? novo : x)) });
                selar();
              }}
            >
              {TIPOS_COLUNA.map((tipo) => (
                <option key={tipo} value={tipo}>{s.tiposColuna[tipo]}</option>
              ))}
            </select>
            {c.tipo === 'contagem' && (
              <select aria-label={s.colunaElemento(i + 1)} value={c.elemento ?? ''} onChange={(e) => { trocar(i, { elemento: e.target.value }); selar(); }}>
                {!nomes.includes(c.elemento ?? '') && <option value={c.elemento ?? ''}>{c.elemento ?? ''}</option>}
                {nomes.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            )}
            <button type="button" className="simulador-botao-pequeno" aria-label={s.removerColuna(i + 1)} onClick={() => { mudar({ colunas: colunas.filter((_, k) => k !== i) }); selar(); }}>×</button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="simulador-botao"
            onClick={() => {
              const n = colunas.length + 1;
              let id = `col-${n}`;
              while (colunas.some((c) => c.id === id)) id += 'x';
              const usados = new Set(colunas.map((c) => c.nome.toLowerCase()));
              let nome: string = s.novaColuna(n);
              for (let k = n; usados.has(nome.toLowerCase()); k++) nome = s.novaColuna(k + 1);
              mudar({ colunas: [...colunas, { id, nome, tipo: 'item' }] });
              selar();
            }}
          >
            {s.adicionarColuna}
          </button>
        </li>
      </ul>
    </div>
  );
}

