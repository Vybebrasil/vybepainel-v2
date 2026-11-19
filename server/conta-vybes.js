// A conta própria do VYBES no Vybe OS (Paulo, 18/11/2026: "hoje tudo o que o VYBES faz sai com o meu nome").
// Migração: migrations/2026-11-18-usuario-vybes.sql (pessoa "VYBES", vybes@vybe.local, servico = TRUE).
//
// - Quem é: a pessoa de VYBE_VYBES_PESSOA_ID. O que o bot grava sozinho (consultas da administração em
//   server/assistente-servico.js, e as ações com `como: 'vybes'`) sai com esse autor. Sem a variável (antes de o Paulo
//   colar o id na Vercel), continua saindo com a conta administradora (VYBE_AI_ADMIN_PESSOA_ID): nada quebra no caminho.
// - Dono: só pelo id da variável (server/donos.js). A marca `servico` do banco nunca dá permissão: ela só tira a conta
//   das listas da equipe e impede senha e login (CHECK da migração). Assim, quem conseguir marcar alguém como serviço
//   no banco não cria um dono; e o VYBES não vira dono por engano se outra conta de serviço aparecer.
// - Entrar no painel: nunca. pode_entrar FALSE, sem senha e sem id do Monday; a regra única da equipe
//   (ativo AND pode_entrar) já deixa a conta de fora de Equipe, RH, Carteira, heads, Escritório e rostos do login.
const ID = /^[1-9]\d{0,15}$/;
const idDe = (v) => { const s = String(v ?? '').trim(); return ID.test(s) && Number.isSafeInteger(Number(s)) ? Number(s) : null; };

export const EMAIL_VYBES = 'vybes@vybe.local';

// O id da pessoa VYBES, ou null quando a variável não existe (ou é inválida).
export function idDoVybes(env = process.env) { return idDe(env?.VYBE_VYBES_PESSOA_ID); }

// Ações da conversa (acao_preparar / acao_confirmar). A conta do WhatsApp do bot é o número do Paulo: o servidor não
// distingue sozinho o Paulo pedindo de um agente agindo. O bot avisa com `como: 'vybes'` (a credencial dele é exclusiva)
// e o servidor só aceita quando quem falou é a conta administradora, no privado, e a variável existe. Fora disso, a
// ação continua sendo de quem falou.
export function pessoaDaAcao(pessoaId, corpo, contexto, env = process.env) {
  if (corpo?.como !== 'vybes') return pessoaId;
  const vybes = idDoVybes(env), adm = idDe(env?.VYBE_AI_ADMIN_PESSOA_ID);
  if (!vybes || !adm || pessoaId !== adm || contexto?.tipo !== 'privado') return pessoaId;
  return vybes;
}

// Nome do agente (Paulo, 19/11/2026: "os comentários e mensagens dos agentes vão como eles"). A conta continua a do
// VYBES (mesmo id, mesma permissão); só o nome que aparece no comentário e no histórico muda para "Heitor · VYBES".
// O bot manda `agente` junto do `como: 'vybes'`; aqui ele é conferido de novo: até 40 caracteres, só letras (com
// acento), espaço e hífen. Qualquer outra coisa (ou "VYBES") volta null, e o nome fica só "VYBES", como antes.
const NOME_AGENTE = /^[\p{L}]+(?:[ -][\p{L}]+)*$/u;
export function nomeDoAgente(v) {
  if (typeof v !== 'string') return null;
  const s = v.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!s || s.length > 40 || !NOME_AGENTE.test(s) || s.toUpperCase() === 'VYBES') return null;
  return s;
}
// O que aparece como autor: "Heitor · VYBES"; sem agente válido, o nome da conta ("VYBES").
export const rotuloDoAgente = (agente, nomeDaConta = 'VYBES') => (nomeDoAgente(agente) ? `${nomeDoAgente(agente)} · ${nomeDaConta || 'VYBES'}` : nomeDaConta || 'VYBES');
