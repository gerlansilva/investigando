import { cleanup, render } from '@testing-library/react';
import { afterEach } from 'vitest';
import { criarArmazem } from '../estado/store';
import { ProvedorArmazem } from '../estado/usarArmazem';
import { criarObjeto } from '../modelo/fabrica';
import type { EtapaCiclo, ObjetoMesa, Projeto, TipoObjeto } from '../modelo/tipos';
import { criarProjetoExemplo } from './projetoExemplo';
import { Mesa } from './Mesa';
import type { PerfilEnsino } from './tiposObjeto';

/** O vitest desta base não liga `globals`, então a limpeza do Testing Library é manual. */
export function limparAposCadaTeste(): void {
  afterEach(() => cleanup());
}

export function projetoDeTeste(alterar?: (p: Projeto) => void): Projeto {
  const p = criarProjetoExemplo('2025-01-01T00:00:00.000Z');
  // Sem gráfico e sem a tabela do Plano (mesma coleção): cada tipo aparece uma vez na mesa livre.
  p.objetos = p.objetos.filter((o) => o.tipo !== 'grafico' && o.id !== 'exemplo-obj-tabela-plano');
  alterar?.(p);
  return p;
}

/** Projeto de exemplo já posicionado numa etapa (a mesa só mostra os objetos da etapa atual). */
export function exemploNaEtapa(etapa: EtapaCiclo): Projeto {
  const p = criarProjetoExemplo();
  p.cicloAtual = etapa;
  return p;
}

export function objetoDe(p: Projeto, id: string): ObjetoMesa {
  const o = p.objetos.find((x) => x.id === id);
  if (!o) throw new Error(`objeto ${id} não existe`);
  return o;
}

/** `focarId`: objeto já focado ao abrir (as ferramentas dele aparecem na barra). */
export function montarMesa(projeto: Projeto, perfil: PerfilEnsino = 'iniciais', focarId?: string) {
  const armazem = criarArmazem(projeto);
  if (focarId) armazem.getState().focarObjeto(focarId);
  const tela = render(
    <ProvedorArmazem armazem={armazem}>
      <Mesa perfil={perfil} />
    </ProvedorArmazem>,
  );
  return { armazem, ...tela };
}

export function novoObjetoDeTeste(tipo: TipoObjeto, id: string): ObjetoMesa {
  return { ...criarObjeto(tipo), id };
}
