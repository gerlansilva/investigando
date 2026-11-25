import { t } from '../../i18n/pt-BR';

/** Avisos gentis (nunca bloqueiam) sobre uma pergunta que talvez não dê para responder com dados. */
export function avisosDaPergunta(pergunta: string): string[] {
  const texto = pergunta.trim();
  if (texto === '') return [];
  const avisos: string[] = [];
  const palavras = texto.split(/\s+/).filter(Boolean);
  if (!texto.includes('?')) avisos.push(t.ciclo.pergunta.semInterrogacao);
  if (palavras.length < 4) avisos.push(t.ciclo.pergunta.curta);
  else if (!/\b(quem|quais?|quantos?|quantas?|existe|como|onde|quando|há|qual|o que|que)\b/i.test(texto)) {
    avisos.push(t.ciclo.pergunta.semDados);
  }
  return avisos;
}
