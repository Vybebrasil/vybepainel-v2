// vybe_acesso.js — quem pode chamar os endpoints de dados.
//
// Dois caminhos legítimos, e é por isso que não basta exigir sessão:
//
//   navegador  → cookie de sessão assinado (uma pessoa logada no painel)
//   servidor   → MIRROR_ADMIN_KEY no header (o espelho operacional chamando o
//                /api/monday por dentro, onde não existe cookie nenhum)
//
// Exigir só sessão quebraria a sincronização do espelho; aceitar só a chave
// deixaria o painel de fora. Os dois passam, mais ninguém.

import { sessaoDoPedido } from './vybe_sessao.js';

export async function quemChama(req) {
  const chave = process.env.MIRROR_ADMIN_KEY;
  if (chave) {
    const enviado = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (enviado && enviado === String(chave).trim()) return { tipo: 'servico' };
  }
  const sessao = await sessaoDoPedido(req);
  if (sessao) return { tipo: 'sessao', pessoa: sessao };
  return null;
}

// Devolve true quando já respondeu 401 — quem chama deve parar.
export async function bloqueou(req, res) {
  try { if (await quemChama(req)) return false; }
  catch {
    res.status(503).json({ error: 'Não foi possível verificar o acesso. Tente novamente.' });
    return true;
  }
  res.status(401).json({ error: 'Entre no painel para acessar estes dados.' });
  return true;
}
