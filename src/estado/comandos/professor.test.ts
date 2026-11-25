import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { criarProjeto, salvarProjeto, abrirProjeto } from '../../modelo';
import { ETAPAS, type EtapaCiclo, type Projeto } from '../../modelo/tipos';
import {
  ativarModoProfessor, definirEtapaTravada, definirPin, definirTipoOculto, desativarModoProfessor, ErroComando, fixarPerfil, hashPin,
  limitesDoProfessor, pinValido, temPin, verificarPin, type Comando,
} from './index';

function aplicar(p: Projeto, ...cs: Comando[]): Projeto {
  const copia = structuredClone(p);
  for (const c of cs) c.aplicar(copia);
  return copia;
}

function ida(p: Projeto, c: Comando): void {
  const antes = structuredClone(p);
  const t = structuredClone(p);
  c.aplicar(t);
  c.reverter(t);
  expect(t).toEqual(antes);
}

const ativo = (opcoes = {}) => aplicar(criarProjeto(), ativarModoProfessor(opcoes));

describe('modo professor', () => {
  it('projeto sem o campo não tem limites', () => {
    expect(limitesDoProfessor(criarProjeto()).ativo).toBe(false);
    expect(limitesDoProfessor(criarProjeto()).etapasTravadas).toEqual([]);
  });

  it('ativa, trava etapas, oculta objetos e fixa o perfil', () => {
    const p = aplicar(ativo(), definirEtapaTravada('analise', true), definirTipoOculto('simulador', true), fixarPerfil('finais'));
    expect(limitesDoProfessor(p)).toEqual({ ativo: true, etapasTravadas: ['analise'], tiposOcultos: ['simulador'], perfilFixo: 'finais' });
    expect(limitesDoProfessor(aplicar(p, fixarPerfil(null))).perfilFixo).toBeNull();
  });

  it('desativado, os limites deixam de valer mas a configuração fica', () => {
    const p = aplicar(ativo(), definirEtapaTravada('dados', true), desativarModoProfessor());
    expect(limitesDoProfessor(p).etapasTravadas).toEqual([]);
    expect(p.professor?.etapasTravadas).toEqual(['dados']);
  });

  it('configurar sem ativar falha; não dá para travar a etapa atual (sempre sobra uma livre)', () => {
    expect(() => aplicar(criarProjeto(), definirEtapaTravada('dados', true))).toThrow(ErroComando);
    expect(() => aplicar(ativo(), definirEtapaTravada('problema', true))).toThrow(/etapa em que o aluno/);
  });

  it('guarda só sal e hash do PIN, e confere', () => {
    const p = ativo({ pin: '1234', sal: 'abc' });
    expect(JSON.stringify(p.professor)).not.toContain('1234');
    expect(temPin(p)).toBe(true);
    expect(verificarPin(p, '1234')).toBe(true);
    expect(verificarPin(p, '4321')).toBe(false);
    expect(verificarPin(p, undefined)).toBe(false);
    expect(() => aplicar(p, desativarModoProfessor('0000'))).toThrow(/PIN incorreto/);
    expect(aplicar(p, desativarModoProfessor('1234')).professor?.ativo).toBe(false);
  });

  it('troca e remove o PIN só com o PIN atual', () => {
    const p = ativo({ pin: '1234' });
    expect(() => aplicar(p, definirPin('5678', 'x'))).toThrow(ErroComando);
    const novo = aplicar(p, definirPin('5678', '1234'));
    expect(verificarPin(novo, '5678')).toBe(true);
    expect(temPin(aplicar(novo, definirPin(null, '5678')))).toBe(false);
    expect(() => ativarModoProfessor({ pin: '12' })).toThrow(ErroComando);
  });

  it('é desfazível por patches', () => {
    const p = ativo({ pin: '1234' });
    ida(criarProjeto(), ativarModoProfessor({ pin: '1234' }));
    ida(p, definirEtapaTravada('dados', true));
    ida(p, definirTipoOculto('grafico', true));
    ida(p, fixarPerfil('iniciais'));
  });

  it('arquivo com professor faz ida e volta; arquivo antigo continua abrindo', () => {
    const p = aplicar(ativo({ pin: '1234' }), definirEtapaTravada('dados', true), definirTipoOculto('imagem', true), fixarPerfil('finais'));
    expect(abrirProjeto(salvarProjeto(p)).professor).toEqual(p.professor);
    expect(abrirProjeto(salvarProjeto(criarProjeto())).professor).toBeUndefined();
  });

  it('propriedade: travar e destravar o mesmo conjunto não deixa resíduo, sem duplicatas e na ordem das etapas', () => {
    fc.assert(
      fc.property(fc.subarray<EtapaCiclo>(ETAPAS.filter((e) => e !== 'problema')), (alvo) => {
        let p = ativo();
        for (const e of alvo) p = aplicar(p, definirEtapaTravada(e, true));
        expect(new Set(p.professor!.etapasTravadas).size).toBe(alvo.length);
        expect(p.professor!.etapasTravadas).toEqual(ETAPAS.filter((e) => alvo.includes(e)));
        for (const e of alvo) p = aplicar(p, definirEtapaTravada(e, false));
        expect(p.professor!.etapasTravadas).toEqual([]);
      }),
    );
  });

  it('propriedade: o hash depende do PIN e do sal, é estável e não contém o PIN', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^\d{4,8}$/), fc.stringMatching(/^\d{4,8}$/), fc.string({ minLength: 1, maxLength: 8 }), (a, b, sal) => {
        expect(pinValido(a)).toBe(true);
        expect(hashPin(a, sal)).toBe(hashPin(a, sal));
        if (a !== b) expect(hashPin(a, sal)).not.toBe(hashPin(b, sal));
      }),
    );
  });
});
