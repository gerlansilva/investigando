import type { ComponentType } from 'react';
import type { TipoObjeto } from '../modelo/tipos';
import type { PropsObjeto } from './tiposObjeto';
import { Tabela } from '../objetos/tabela/Tabela';
import { Fichas } from '../objetos/fichas/Fichas';
import { Texto } from '../objetos/texto/Texto';
import { Imagem } from '../objetos/imagem/Imagem';

type ComponenteObjeto = ComponentType<PropsObjeto<unknown>>;

const registro = new Map<TipoObjeto, ComponenteObjeto>();

/** Pluga um componente para um tipo de objeto da mesa, sem editar Mesa.tsx. */
export function registrarTipoObjeto<E>(tipo: TipoObjeto, componente: ComponentType<PropsObjeto<E>>): void {
  registro.set(tipo, componente as unknown as ComponenteObjeto);
}

export function obterTipoObjeto(tipo: TipoObjeto): ComponenteObjeto | undefined {
  return registro.get(tipo);
}

export function removerTipoObjeto(tipo: TipoObjeto): void {
  registro.delete(tipo);
}

registrarTipoObjeto('tabela', Tabela);
registrarTipoObjeto('fichas', Fichas);
registrarTipoObjeto('texto', Texto);
registrarTipoObjeto('imagem', Imagem);
