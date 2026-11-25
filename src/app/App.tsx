import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { criarArmazem } from '../estado/store';
import { ProvedorArmazem, useProjeto, type Armazem } from '../estado/usarArmazem';
import { t } from '../i18n/pt-BR';
import { EXTENSAO, ehTauri, mensagemDeErro, obterArquivos, type ProjetoAberto } from './arquivos';
import { Ciclo } from './ciclo/Ciclo';
import { ContextoBarra } from './contextoBarra';
import { Ferramenta, Separador } from './ui';
import { criarProjeto } from '../modelo/fabrica';
import type { PerfilEnsino } from './tiposObjeto';
import './estilos.css';
import { registrarGrafico } from '../objetos/grafico';
import { registrarSimulador } from '../objetos/simulador';
import { Professor } from './professor/Professor';
import { useRegistroPesquisa } from './professor/usarRegistro';
import { limitesDoProfessor } from '../estado/comandos';
import { registrarSugerido } from './ciclo/objetosSugeridos';

registrarGrafico();
registrarSimulador();
registrarSugerido('plano', 'simulador');

export interface PropsApp {
  /** Armazém pronto (usado em testes); por padrão cria um com o projeto de exemplo. */
  armazem?: Armazem;
}

type Mensagem = { tipo: 'ok' | 'erro'; texto: string };

function Conteudo({ armazem }: { armazem: Armazem }) {
  const projeto = useProjeto();
  const [perfilEscolhido, setPerfil] = useState<PerfilEnsino>('iniciais');
  const perfilFixo = limitesDoProfessor(projeto).perfilFixo;
  const perfil: PerfilEnsino = perfilFixo ?? perfilEscolhido;
  const registro = useRegistroPesquisa(armazem);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const entradaRef = useRef<HTMLInputElement>(null);

  const arquivos = obterArquivos();
  const caminhoRef = useRef<string | undefined>(undefined);
  const salvoRef = useRef<string>(armazem.getState().serializar());

  const aplicarAberto = useCallback((aberto: ProjetoAberto) => {
    armazem.getState().abrir(aberto.projeto);
    caminhoRef.current = aberto.caminho;
    salvoRef.current = armazem.getState().serializar();
    setMensagem({ tipo: 'ok', texto: t.app.arquivoAberto(aberto.projeto.titulo) });
  }, [armazem]);

  async function aoEscolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      aplicarAberto(await arquivos.abrirArquivo(arquivo));
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: mensagemDeErro(erro) });
    }
  }

  const abrir = useCallback(async () => {
    if (!arquivos.nativo) return entradaRef.current?.click();
    try {
      const aberto = await arquivos.abrir();
      if (aberto) aplicarAberto(aberto);
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: mensagemDeErro(erro) });
    }
  }, [arquivos, aplicarAberto]);

  const salvar = useCallback(async (como = false) => {
    try {
      const texto = armazem.getState().serializar();
      const titulo = armazem.getState().projeto.titulo;
      const r = como ? await arquivos.salvarComo(texto, titulo) : await arquivos.salvar(texto, titulo, caminhoRef.current);
      if (!r) return;
      caminhoRef.current = r.caminho;
      salvoRef.current = texto;
      setMensagem({ tipo: 'ok', texto: t.app.arquivoSalvo(r.nome) });
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: mensagemDeErro(erro) });
    }
  }, [arquivos, armazem]);

  // Título da janela como nos programas de desktop: "Investigando - [nome do projeto]".
  useEffect(() => {
    const titulo = `${t.app.nome} - [${projeto.titulo}]`;
    document.title = titulo;
    if (ehTauri()) {
      void import('@tauri-apps/api/window').then((j) => j.getCurrentWindow().setTitle(titulo)).catch(() => undefined);
    }
  }, [projeto.titulo]);

  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const tecla = e.key.toLowerCase();
      if (tecla === 'o') { e.preventDefault(); void abrir(); }
      else if (tecla === 'p') { e.preventDefault(); arquivos.imprimirMesa(); }
      else if (tecla === 's') { e.preventDefault(); void salvar(e.shiftKey); }
    };
    window.addEventListener('keydown', aoTecla);
    return () => window.removeEventListener('keydown', aoTecla);
  }, [abrir, salvar, arquivos]);

  useEffect(() => {
    let desfazer: (() => void) | undefined;
    let ativo = true;
    void arquivos.protegerFechamento(() => armazem.getState().serializar() !== salvoRef.current).then((d) => {
      if (ativo) desfazer = d; else d();
    }).catch(() => undefined);
    return () => { ativo = false; desfazer?.(); };
  }, [arquivos, armazem]);

  useEffect(() => {
    let desfazer: (() => void) | undefined;
    let ativo = true;
    void arquivos.escutarAberturaExterna({
      temAlteracoes: () => armazem.getState().serializar() !== salvoRef.current,
      aoAbrir: aplicarAberto,
      aoErro: (erro) => setMensagem({ tipo: 'erro', texto: mensagemDeErro(erro) }),
    }).then((d) => { if (ativo) desfazer = d; else d(); }).catch(() => undefined);
    return () => { ativo = false; desfazer?.(); };
  }, [arquivos, armazem, aplicarAberto]);

  const [encaixeMesa, setEncaixeMesa] = useState<HTMLElement | null>(null);
  const [encaixeContextual, setEncaixeContextual] = useState<HTMLElement | null>(null);
  const [encaixeVisao, setEncaixeVisao] = useState<HTMLElement | null>(null);
  const [encaixeNovo, setEncaixeNovo] = useState<HTMLElement | null>(null);
  const encaixes = useMemo(
    () => ({ mesa: encaixeMesa, contextual: encaixeContextual, visao: encaixeVisao, novo: encaixeNovo }),
    [encaixeMesa, encaixeContextual, encaixeVisao, encaixeNovo],
  );

  return (
    <div className="app" data-perfil={perfil}>
      <a
        className="pular-para-mesa"
        href="#mesa"
        onClick={(e) => { e.preventDefault(); document.getElementById('mesa')?.focus(); }}
      >
        {t.app.pularParaMesa}
      </a>
      <ContextoBarra.Provider value={encaixes}>
        <header className="barra">
          <div className="barra-linha">
          <div className="barra-marca">
            <h1>{t.app.nome}</h1>
            <span className="barra-titulo" aria-label={t.app.tituloDoProjeto} title={projeto.titulo}>{projeto.titulo}</span>
          </div>
          <div className="barra-grupo" role="group" aria-label={t.app.arquivoGrupo}>
            <Ferramenta icone="abrir" rotulo={t.app.abrir} onClick={() => void abrir()} />
            <Ferramenta icone="salvar" rotulo={t.app.salvar} onClick={() => void salvar()} />
            <Ferramenta icone="imprimir" rotulo={t.app.imprimir} title={t.app.imprimirDica} onClick={() => arquivos.imprimirMesa()} />
          </div>
          <Separador />
          <div className="barra-grupo" ref={setEncaixeMesa} />
          <div className="barra-grupo barra-visao" ref={setEncaixeVisao} />
          <label className="campo-perfil">
            <span>{t.app.perfil}</span>
            <select value={perfil} disabled={perfilFixo !== null} title={perfilFixo ? t.professor.perfilTravado : t.app.perfilDica} onChange={(e) => setPerfil(e.target.value as PerfilEnsino)}>
              <option value="iniciais">{t.app.perfilIniciais}</option>
              <option value="finais">{t.app.perfilFinais}</option>
            </select>
          </label>
          <Professor registro={registro} perfil={perfil} />
          <input
            ref={entradaRef}
            type="file"
            className="app-entrada-arquivo"
            accept={`${EXTENSAO},.json,application/json`}
            aria-label={t.app.arquivo}
            data-testid="entrada-arquivo"
            onChange={aoEscolherArquivo}
          />
          </div>
          <div className="barra-contextual" ref={setEncaixeContextual} />
        </header>
        {mensagem && (
          <p className="aviso" role={mensagem.tipo === 'erro' ? 'alert' : 'status'} data-tipo={mensagem.tipo}>
            <span className="aviso-texto">
              {mensagem.texto.split('\n').map((linha, i) => <span key={i} style={{ display: 'block' }}>{linha}</span>)}
            </span>
            <button type="button" className="botao-texto" onClick={() => setMensagem(null)}>{t.app.fechar}</button>
          </p>
        )}
        <main className="corpo">
          <aside className="trilho" ref={setEncaixeNovo} aria-label={t.mesa.novo} />
          <Ciclo perfil={perfil} />
        </main>
      </ContextoBarra.Provider>
    </div>
  );
}

export function App({ armazem }: PropsApp = {}) {
  const [padrao] = useState(() => armazem ?? criarArmazem(criarProjeto()));
  return (
    <ProvedorArmazem armazem={padrao}>
      <Conteudo armazem={padrao} />
    </ProvedorArmazem>
  );
}
