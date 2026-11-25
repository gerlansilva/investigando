// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { exemploNaEtapa, limparAposCadaTeste } from '../testeUtil';
import { criarArmazem } from '../../estado/store';
import { ativarModoProfessor, definirEtapaTravada, definirTipoOculto, fixarPerfil } from '../../estado/comandos';
import { CHAVE_REGISTRO } from './usarRegistro';

limparAposCadaTeste();
beforeEach(() => localStorage.clear());

function montar(preparar?: (a: ReturnType<typeof criarArmazem>) => void) {
  const armazem = criarArmazem(exemploNaEtapa('problema'));
  preparar?.(armazem);
  render(<App armazem={armazem} />);
  return armazem;
}
describe('modo professor na interface', () => {
  it('sem o modo ativo, nada muda', () => {
    montar();
    expect(screen.getByRole('button', { name: /^Plano,/ })).not.toBeDisabled();
    expect((screen.getByLabelText('Perfil') as HTMLSelectElement).disabled).toBe(false);
  });

  it('etapa travada fica desabilitada, perfil fixo bloqueia o seletor e objeto oculto some da barra Novo', () => {
    montar((a) => {
      const s = a.getState();
      for (const c of [ativarModoProfessor(), definirEtapaTravada('analise', true), definirTipoOculto('grafico', true), fixarPerfil('finais')]) s.executarSemHistorico(c);
    });
    expect(screen.getByRole('button', { name: /^Análise,/ })).toBeDisabled();
    const perfil = screen.getByLabelText('Perfil') as HTMLSelectElement;
    expect(perfil.value).toBe('finais');
    expect(perfil.disabled).toBe(true);
    expect(document.querySelector('[data-tipo="grafico"]')).toBeNull();
    expect(document.querySelector('[data-tipo="tabela"]')).not.toBeNull();
  });

  it('o painel ativa o modo, protege com PIN e só reabre com o PIN certo', async () => {
    const u = userEvent.setup();
    const armazem = montar();
    await u.click(screen.getByRole('button', { name: 'Professor' }));
    await u.type(screen.getByLabelText(/PIN opcional/), '1234');
    await u.click(screen.getByRole('button', { name: 'Ativar o modo professor' }));
    expect(armazem.getState().projeto.professor?.ativo).toBe(true);
    expect(JSON.stringify(armazem.getState().projeto.professor)).not.toContain('1234');
    await u.click(screen.getByRole('checkbox', { name: 'Análise' }));
    expect(armazem.getState().projeto.professor?.etapasTravadas).toEqual(['analise']);
    expect(armazem.getState().historico.desfazer).toHaveLength(0); // o aluno não desfaz o professor

    await u.click(screen.getByRole('button', { name: 'Fechar painel do professor' }));
    await u.click(screen.getByRole('button', { name: 'Professor' }));
    expect(screen.queryByRole('checkbox', { name: 'Análise' })).toBeNull();
    await u.type(screen.getByLabelText('Digite o PIN para continuar'), '0000');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert').textContent).toMatch(/PIN incorreto/);
    await u.clear(screen.getByLabelText('Digite o PIN para continuar'));
    await u.type(screen.getByLabelText('Digite o PIN para continuar'), '1234');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    await u.click(screen.getByRole('button', { name: 'Desativar' }));
    expect(armazem.getState().projeto.professor?.ativo).toBe(false);
  });
});

describe('registro de pesquisa na interface', () => {
  it('desligado por padrão não grava; ligado grava a mudança de etapa, aparece na tela e limpa', async () => {
    const u = userEvent.setup();
    const armazem = montar();
    await u.click(screen.getByRole('button', { name: /^Plano,/ }));
    expect(localStorage.getItem(CHAVE_REGISTRO)).toBeNull();

    await u.click(screen.getByRole('button', { name: 'Professor' }));
    const caixa = screen.getByRole('checkbox', { name: 'Registrar eventos pedagógicos' }) as HTMLInputElement;
    expect(caixa.checked).toBe(false);
    await u.click(caixa);
    await u.click(screen.getByRole('button', { name: /^Dados,/ }));
    expect(armazem.getState().projeto.cicloAtual).toBe('dados');
    expect(screen.getByText('Etapa mudou')).toBeTruthy();
    const guardado = JSON.parse(localStorage.getItem(CHAVE_REGISTRO)!);
    expect(guardado.ativo).toBe(true);
    expect(guardado.eventos[0]).toMatchObject({ tipo: 'etapa_mudou', detalhe: { de: 'plano', para: 'dados' } });

    await u.click(screen.getByRole('button', { name: 'Limpar registro' }));
    await u.click(screen.getByRole('button', { name: 'Apagar' }));
    expect(screen.getByText('Nenhum evento registrado.')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(CHAVE_REGISTRO)!).eventos).toEqual([]);
  });
});
