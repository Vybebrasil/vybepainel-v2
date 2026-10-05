import { textoDoHistorico } from './texto-historico.js';
// Vocabulário do modelo já usado no painel. Também delimita a consulta SQL.
export const MARCAS_BRIEFING = 'BRIEFING|CORA(Ç|C)(Ã|A)O DO PEDIDO|MENSAGEM ?/ ?COPY|DIRE(Ç|C)(Ã|A)O DE ARTE|ROTEIRO|LEGENDA DO POST|STORIES DE APOIO|CHECKLIST|NOME DA TAREFA|HOOK';
const marcas = new RegExp(MARCAS_BRIEFING, 'i');
export function resolverBriefing({briefing = '', briefing_definido = false, historico_briefing = [], criado_em = ''} = {}) {
  const campo = String(briefing || '').trim();
  if (campo) return {texto:campo, origem:'cadastro', autor:'', quando:criado_em};
  if (briefing_definido) return null;
  const notas = historico_briefing.map(u => ({u, texto:textoDoHistorico(u.corpo)}))
    .filter(n => n.texto.length > 160 && !/Vybe OS ·/.test(n.texto) && marcas.test(n.texto));
  notas.sort((a,b) => String(b.u.criado_em || '').localeCompare(String(a.u.criado_em || '')) || b.texto.length-a.texto.length);
  const n = notas[0];
  return n ? {texto:n.texto, origem:'histórico', autor:n.u.autor || '', quando:n.u.criado_em || ''} : null;
}
