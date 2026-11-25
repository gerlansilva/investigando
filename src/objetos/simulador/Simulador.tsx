import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsObjeto } from '../../app/tiposObjeto';
import { mudarEstadoObjeto, recomecarSimulador, registrarLoteSimulador } from '../../estado/comandos';
import { criarPrng, hashTexto } from '../../formulas';
import { t } from '../../i18n/pt-BR';
import { gerarId } from '../../modelo/fabrica';
import type { Caso } from '../../modelo/tipos';
import {
  ErroSimulador, ID_ATRIBUTO_ESTATISTICA, ID_ATRIBUTO_REPETICAO, LIMITE_CASOS, LIMITE_SEGURANCA, MS_POR_ITEM, NOME_REPETICAO,
  atributosDasColunas, configDoEstado, criarColetor, criarExecutor, dispositivoDoEstado, estatisticaDoEstado, lerEstado,
  resumirValores, tipoDasLinhas, validarConfig, valoresDoContador,
  type EstadoSimulador, type MotivoParada, type TipoDispositivo,
} from '../../simulador';
import { Ferramentas } from '../../app/contextoBarra';
import { Ferramenta, Separador } from '../../app/ui';
import { Misturador } from './Misturador';
import { iniciarMotor, type Motor, type MotivoFim } from './motor';
import { prefereMenosMovimento } from './movimento';
import { PainelDispositivo } from './PainelDispositivo';
import { PainelEstatistica } from './PainelEstatistica';
import { PainelResultado } from './PainelResultado';
import { Roleta } from './Roleta';
import type { SorteioVisual } from './visuais';
import './Simulador.css';

const s = t.simulador;

type Execucao = 'resultados' | 'estatistica';

function mensagemDe(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return String(e);
}

function resumoDoDispositivo(e: EstadoSimulador): string {
  const d = dispositivoDoEstado(e);
  if (d.tipo === 'roleta') {
    const total = d.setores.reduce((a, x) => a + (x.proporcao > 0 ? x.proporcao : 0), 0);
    return d.setores.map((x) => s.resumoItem(x.nome, total > 0 && x.proporcao > 0 ? s.resumoPorcento((x.proporcao / total) * 100) : '0%')).join('; ');
  }
  if (d.tipo === 'misturador') return d.bolas.map((b) => s.resumoItem(b.nome, s.resumoBolas(b.quantidade))).join('; ');
  const v = valoresDoContador(d);
  return s.contadorDescricao(v.length > 8 ? `${v.slice(0, 8).join(', ')}...` : v.join(', '));
}

export function Simulador(props: PropsObjeto<unknown>) {
  const { objeto, colecao, perfil } = props;
  const propsRef = useRef(props);
  propsRef.current = props;

  const simples = perfil === 'iniciais';
  const estado = useMemo(() => lerEstado(objeto.estado), [objeto.estado]);
  const dispositivo: TipoDispositivo = simples && estado.dispositivo === 'contador' ? 'roleta' : estado.dispositivo;
  const estadoEfetivo = useMemo(() => (dispositivo === estado.dispositivo ? estado : { ...estado, dispositivo }), [estado, dispositivo]);

  const [rodando, setRodando] = useState<Execucao | null>(null);
  const [progresso, setProgresso] = useState<{ feitas: number; total: number | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sorteio, setSorteio] = useState<SorteioVisual | null>(null);
  const [duracao, setDuracao] = useState(0);
  const motor = useRef<Motor | null>(null);
  const serial = useRef(0);

  useEffect(() => () => motor.current?.parar(), []);

  const mudar = useCallback((parcial: Partial<EstadoSimulador>) => {
    const p = propsRef.current;
    p.executar(mudarEstadoObjeto(p.objeto.id, { ...lerEstado(p.objeto.estado), ...parcial }, s.alterar));
  }, []);
  const selar = useCallback(() => propsRef.current.selarHistorico(), []);

  /** Dados comuns de uma execução: configuração, semente e gerador de números. */
  function prepararExecucao() {
    const bruto = lerEstado(propsRef.current.objeto.estado);
    const efetivo = simples && bruto.dispositivo === 'contador' ? { ...bruto, dispositivo: 'roleta' as const } : bruto;
    const config = configDoEstado(efetivo);
    validarConfig(config);
    const semente = bruto.semente ?? Math.floor(Math.random() * 2 ** 31);
    const rodada = bruto.rodada + 1;
    const rng = criarPrng(hashTexto(`${semente}:${rodada}`));
    return { bruto, efetivo, config, semente, rodada, rng };
  }

  function mostrarErro(e: unknown) {
    setErro(`${s.erroPrefixo}${mensagemDe(e)}`);
  }

  function terminar(motivo: MotivoFim, feitas: number, erroFinal: unknown, sucesso: () => string) {
    motor.current = null;
    setRodando(null);
    setProgresso(null);
    propsRef.current.selarHistorico();
    if (motivo === 'erro') mostrarErro(erroFinal);
    else if (motivo === 'parado') setAviso(s.interrompido(feitas));
    else setAviso(sucesso());
  }

  function sortear(n: number) {
    if (motor.current?.ativo) return;
    setErro(null);
    setAviso(null);
    try {
      if (!Number.isInteger(n) || n < 1 || n > LIMITE_SEGURANCA) throw new ErroSimulador(s.repeticoesInvalidas(LIMITE_SEGURANCA));
      const { bruto, config, semente, rodada, rng } = prepararExecucao();
      if (n * config.itensPorRepeticao > LIMITE_CASOS) throw new ErroSimulador(s.casosDemais(n * config.itensPorRepeticao, LIMITE_CASOS));
      const executor = criarExecutor(config, rng);
      const colecaoId = bruto.colecaoId ?? gerarId();
      const execucaoId = gerarId();
      const atributos = atributosDasColunas(config);
      const casos: Caso[] = [];
      const ms = prefereMenosMovimento() ? 0 : MS_POR_ITEM[bruto.velocidade];
      const objetoId = propsRef.current.objeto.id;

      propsRef.current.selarHistorico();
      setRodando('resultados');
      setProgresso({ feitas: 0, total: n });
      motor.current = iniciarMotor({
        total: n,
        msPorRepeticao: ms,
        passo: () => {
          const rep = executor.proxima();
          for (const linha of rep.linhas) casos.push({ id: `${execucaoId}-${casos.length + 1}`, valores: linha });
          const ultimo = rep.itens[rep.itens.length - 1]!;
          serial.current += 1;
          setSorteio({ serial: serial.current, indice: ultimo.indice, nome: ultimo.nome, itens: rep.itens.map((i) => i.nome) });
          setDuracao(ms);
        },
        aoBloco: (feitas) => {
          propsRef.current.executar(
            registrarLoteSimulador({
              objetoId, execucaoId, semente, rodada,
              resultados: { id: colecaoId, nome: s.nomeColecaoResultados, atributos: atributos.map((a) => ({ ...a })), casos: [...casos] },
            }),
          );
          setProgresso({ feitas, total: n });
        },
        aoTerminar: (motivo, feitas, e) => terminar(motivo, feitas, e, () => s.pronto(feitas, casos.length)),
      });
    } catch (e) {
      mostrarErro(e);
    }
  }

  function coletar() {
    if (motor.current?.ativo) return;
    setErro(null);
    setAviso(null);
    try {
      const { bruto, efetivo, config, semente, rodada, rng } = prepararExecucao();
      const est = estatisticaDoEstado(efetivo, simples);
      const comCondicao = est.rodarAteQue !== undefined && est.rodarAteQue.trim() !== '';
      const n = bruto.estatistica.repeticoes;
      if (!comCondicao && (!Number.isInteger(n) || n < 1 || n > LIMITE_SEGURANCA)) throw new ErroSimulador(s.repeticoesInvalidas(LIMITE_SEGURANCA));
      const coletor = criarColetor(config, est, rng, comCondicao ? undefined : n);
      const total = comCondicao ? (est.limite ?? LIMITE_SEGURANCA) : n;

      const colecaoId = bruto.colecaoEstatisticasId ?? gerarId();
      const execucaoId = gerarId();
      const idEstatistica = `${ID_ATRIBUTO_ESTATISTICA}-${hashTexto(est.rotulo.trim().toLowerCase()).toString(36)}`;
      const casos: Caso[] = [];
      const criadoEm = new Date().toISOString();
      const objetoId = propsRef.current.objeto.id;
      let motivoParada: MotivoParada = 'completo';

      propsRef.current.selarHistorico();
      setRodando('estatistica');
      setProgresso({ feitas: 0, total: comCondicao ? null : total });
      motor.current = iniciarMotor({
        total,
        msPorRepeticao: 0,
        passo: () => {
          const { linha, parar } = coletor.proxima();
          casos.push({ id: `${execucaoId}-${linha.repeticao}`, valores: { [ID_ATRIBUTO_REPETICAO]: linha.repeticao, [idEstatistica]: linha.valor } });
          if (parar !== null) {
            motivoParada = parar;
            return { fim: true };
          }
        },
        aoBloco: (feitas) => {
          const valores = coletor.linhas.map((l) => l.valor);
          const registro = {
            id: execucaoId, objetoId, criadoEm, rotulo: est.rotulo.trim() === '' ? 'Estatística' : est.rotulo.trim(), formula: est.formula,
            ...(comCondicao ? { rodarAteQue: est.rodarAteQue } : {}),
            dispositivo: efetivo.dispositivo, itensPorRepeticao: config.itensPorRepeticao, repeticoes: casos.length,
            semente, colecaoId, resumo: resumirValores(valores),
          };
          propsRef.current.executar(
            registrarLoteSimulador({
              objetoId, execucaoId, semente, rodada, registro,
              rotulo: `Coletar estatística (${casos.length})`,
              estatisticas: {
                id: colecaoId, nome: s.nomeColecaoEstatisticas,
                atributos: [
                  { id: ID_ATRIBUTO_REPETICAO, nome: NOME_REPETICAO, tipo: 'numerico', cor: atributosDasColunas(config)[0]?.cor ?? '' },
                  { id: idEstatistica, nome: registro.rotulo, tipo: tipoDasLinhas(coletor.linhas), cor: atributosDasColunas(config)[1]?.cor ?? '' },
                ],
                casos: [...casos],
              },
            }),
          );
          setProgresso({ feitas, total: comCondicao ? null : total });
        },
        aoTerminar: (motivo, feitas, e) =>
          terminar(motivo, feitas, e, () =>
            motivoParada === 'condicao' ? s.paradoPorCondicao(feitas)
              : motivoParada === 'limite' ? s.paradoPorLimite(total)
                : s.prontoEstatistica(feitas, s.nomeColecaoEstatisticas)),
      });
    } catch (e) {
      mostrarErro(e);
    }
  }

  function recomecar() {
    motor.current?.parar();
    const bruto = lerEstado(propsRef.current.objeto.estado);
    if (bruto.colecaoId || bruto.colecaoEstatisticasId || bruto.rodada > 0) propsRef.current.executar(recomecarSimulador(propsRef.current.objeto.id));
    propsRef.current.selarHistorico();
    setSorteio(null);
    setErro(null);
    setAviso(s.recomecado);
  }

  const aria = resumoDoDispositivo(estadoEfetivo);
  const dispositivos: TipoDispositivo[] = simples ? ['roleta', 'misturador'] : ['roleta', 'misturador', 'contador'];
  const ocupado = rodando !== null;
  const ultimoValor = sorteio ? sorteio.itens[sorteio.itens.length - 1] : undefined;

  return (
    <section className="simulador" aria-label={s.area}>
      <Ferramentas rotulo={s.area}>
        <div className="barra-grupo" role="group" aria-label={s.dispositivo}>
          {dispositivos.map((d) => (
            <Ferramenta
              key={d}
              icone={d}
              rotulo={s.dispositivos[d]}
              ativo={dispositivo === d}
              disabled={ocupado}
              onClick={() => {
                mudar({ dispositivo: d });
                selar();
                setSorteio(null);
              }}
            />
          ))}
        </div>
        <Separador />
        <div className="barra-grupo" role="group" aria-label={s.acoes}>
          <Ferramenta icone="sortear" rotulo={s.sortear1} disabled={ocupado} onClick={() => sortear(1)} />
          <Ferramenta icone="sortear" rotulo={s.sortearN(estado.repeticoes)} disabled={ocupado} onClick={() => sortear(estado.repeticoes)} />
          <Ferramenta icone="parar" rotulo={s.parar} disabled={!ocupado} onClick={() => motor.current?.parar()} />
          <Ferramenta icone="recomecar" rotulo={s.recomecar} onClick={recomecar} />
        </div>
      </Ferramentas>

      <div className="simulador__palco">
        {dispositivo === 'roleta' && <Roleta setores={estadoEfetivo.roleta.setores} sorteio={sorteio} duracao={duracao} descricao={aria} aoClicar={() => sortear(1)} />}
        {dispositivo === 'misturador' && <Misturador bolas={estadoEfetivo.misturador.bolas} sorteio={sorteio} duracao={duracao} descricao={aria} aoClicar={() => sortear(1)} />}
        {dispositivo === 'contador' && (
          <div className="simulador-contador" role="img" aria-label={s.contadorAria(aria)}>
            <span className="simulador-contador__valor">{ultimoValor ?? '0'}</span>
          </div>
        )}
      </div>

      <p className="simulador__saida" aria-live="polite" data-testid="saida">
        {sorteio ? s.saiu(sorteio.itens.length > 12 ? `${sorteio.itens.slice(0, 12).join(', ')}...` : sorteio.itens.join(', ')) : s.nenhumSorteio}
      </p>

      {progresso && (
        <div className="simulador__progresso" role="status">
          {progresso.total !== null ? (
            <>
              <progress max={progresso.total} value={progresso.feitas} aria-label={s.progresso(progresso.feitas, progresso.total)} />
              <span>{s.progresso(progresso.feitas, progresso.total)}</span>
            </>
          ) : (
            <span>{s.progressoCondicao(progresso.feitas)}</span>
          )}
        </div>
      )}
      {erro && <p className="simulador__erro" role="alert">{erro}</p>}
      {aviso && !erro && <p className="simulador__aviso" role="status">{aviso}</p>}
      {colecao && <p className="simulador__nota">{s.casosNaColecao(colecao.casos.length)}</p>}

      <details className="simulador__secao" open>
        <summary>{s.configurar}</summary>
        <fieldset className="simulador-grupo" disabled={ocupado}>
          <PainelDispositivo estado={estadoEfetivo} mudar={mudar} selar={selar} perfil={perfil} />
        </fieldset>
      </details>

      <details className="simulador__secao">
        <summary>{s.resultado}</summary>
        <p className="simulador__nota">{s.explicacaoResultado(s.nomeColecaoResultados)}</p>
        {!simples && (
          <fieldset className="simulador-grupo" disabled={ocupado}>
            <PainelResultado estado={estadoEfetivo} mudar={mudar} selar={selar} perfil={perfil} />
          </fieldset>
        )}
      </details>

      <details className="simulador__secao">
        <summary>{s.coletarEstatistica}</summary>
        <PainelEstatistica estado={estadoEfetivo} mudar={mudar} selar={selar} perfil={perfil} rodando={ocupado} aoColetar={coletar} />
      </details>
    </section>
  );
}

