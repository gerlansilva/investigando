import { useContext, useEffect, useRef, useState } from 'react';
import { cicloCorrente, limitesDoProfessor, mudarEtapa } from '../../estado/comandos';
import { useAcoes, useProjeto } from '../../estado/usarArmazem';
import { t } from '../../i18n/pt-BR';
import type { EtapaCiclo } from '../../modelo/tipos';
import { ContextoBarra, Encaixar } from '../contextoBarra';
import { Icone } from '../icones';
import { Mesa } from '../Mesa';
import type { PerfilEnsino } from '../tiposObjeto';
import { Ferramenta } from '../ui';
import { BarraEtapas } from './BarraEtapas';
import { PainelEtapa } from './PainelEtapa';
import { Resumo } from './Resumo';
import './ciclo.css';

/** Ciclo guiado: barra de etapas, pergunta-guia e a mesa filtrada pela etapa atual. */
export function Ciclo({ perfil }: { perfil: PerfilEnsino }) {
  const projeto = useProjeto();
  const encaixes = useContext(ContextoBarra);
  const { executar, selarHistorico } = useAcoes();
  const [mesaLivre, setMesaLivre] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(false);
  const [revisao, setRevisao] = useState(false);
  const anterior = useRef({ id: projeto.id, colecoes: projeto.colecoes });

  const ciclo = cicloCorrente(projeto);
  const concluidas = ciclo?.etapasConcluidas ?? [];
  const dependentes = concluidas.includes('analise') || concluidas.includes('conclusao');
  const etapa = projeto.cicloAtual;
  const travadas = limitesDoProfessor(projeto).etapasTravadas;
  const livre = mesaLivre && perfil === 'finais';

  // Mudou a Tabela (os dados) depois de concluir Análise ou Conclusão: aviso discreto, sem bloquear.
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = { id: projeto.id, colecoes: projeto.colecoes };
    if (antes.id !== projeto.id) setRevisao(false);
    else if (antes.colecoes !== projeto.colecoes && dependentes) setRevisao(true);
  }, [projeto.id, projeto.colecoes, dependentes]);

  function irPara(destino: EtapaCiclo) {
    if (destino === projeto.cicloAtual || travadas.includes(destino)) return;
    executar(mudarEtapa(destino));
    selarHistorico();
  }

  function revisar() {
    irPara(concluidas.includes('analise') ? 'analise' : 'conclusao');
    setRevisao(false);
  }

  const acoes = (
    <>
      {perfil === 'finais' && (
        <Encaixar
          encaixe={encaixes?.visao}
          senao={<Ferramenta icone="mesaLivre" rotulo={t.ciclo.mesaLivre} title={t.ciclo.mesaLivreAjuda} ativo={livre} onClick={() => setMesaLivre(!mesaLivre)} />}
        >
          <Ferramenta icone="mesaLivre" rotulo={t.ciclo.mesaLivre} title={t.ciclo.mesaLivreAjuda} ativo={livre} onClick={() => setMesaLivre(!mesaLivre)} />
        </Encaixar>
      )}
      <button type="button" className="botao-texto" aria-expanded={resumoAberto} title={t.ciclo.resumo} onClick={() => setResumoAberto(!resumoAberto)}>
        <Icone nome="resumo" tamanho={16} />
        <span className="botao-rotulo">{t.ciclo.resumo}</span>
      </button>
    </>
  );

  return (
    <div className="ciclo">
      <PainelEtapa
        etapa={etapa}
        perfil={perfil}
        abas={<BarraEtapas etapaAtual={etapa} concluidas={concluidas} aoMudar={irPara} travadas={travadas} />}
        acoes={acoes}
      >
        {resumoAberto && <Resumo aoFechar={() => setResumoAberto(false)} />}
      </PainelEtapa>
      {revisao && dependentes && (
        <p className="aviso-revisao" role="status">
          <span>{t.ciclo.revisao.texto}</span>
          <button type="button" className="botao-texto" onClick={revisar}>{t.ciclo.revisao.revisar}</button>
          <button type="button" className="botao-icone" aria-label={t.ciclo.revisao.fechar} onClick={() => setRevisao(false)}>
            <Icone nome="fechar" tamanho={16} />
          </button>
        </p>
      )}
      <Mesa perfil={perfil} filtroEtapa={livre ? null : etapa} />
    </div>
  );
}
