// api/dominio.js — cria e popula as tabelas de domínio a partir do espelho.
//
// Passo 2 da saída do Monday. Este endpoint SÓ LÊ o espelho e SÓ ESCREVE nas tabelas
// novas (vybe_clientes, vybe_pessoas, vybe_status, vybe_conteudos e os vínculos).
// Não toca em vybe_mirror_*, não fala com o Monday e o painel ainda não lê daqui —
// rodar isto não pode alterar o que o time vê.
//
// Protegido pelo mesmo MIRROR_ADMIN_KEY do api/operational-mirror.js:
//
//   curl -X POST ".../api/dominio?action=popular" -H "Authorization: Bearer $CHAVE"
//   curl      ".../api/dominio?action=resumo"     -H "Authorization: Bearer $CHAVE"

import { criarSchema, popularDoEspelho, resumo, sincronizarHistorico } from '../vybe_dominio_store.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

// Apara espaço e quebra de linha dos dois lados: colar valor no painel da Vercel
// costuma trazer um \n junto, e a chave passa a nunca bater.
function autorizado(req) {
  const segredo = String(process.env.MIRROR_ADMIN_KEY || '').trim();
  if (!segredo) return false;
  const enviado = (
    String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '') ||
    String(req.query?.key || req.body?.key || '')
  ).trim();
  return enviado.length > 0 && enviado === segredo;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!autorizado(req)) return res.status(401).json({ error: 'Não autorizado.' });

  const action = String(req.query?.action || req.body?.action || 'resumo');

  try {
    if (action === 'resumo') {
      return res.status(200).json({ ok: true, action, ...(await resumo()) });
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Use POST para schema e popular.' });
    }
    if (action === 'schema') {
      await criarSchema();
      return res.status(200).json({ ok: true, action, ...(await resumo()) });
    }
    if (action === 'historico') {
      // Paginado: passe o proximo_cursor da resposta anterior para continuar.
      const cursor = req.query?.cursor || req.body?.cursor || null;
      const paginas = Number(req.query?.paginas || req.body?.paginas || 3);
      return res.status(200).json({ ok: true, action, ...(await sincronizarHistorico(cursor, paginas)) });
    }
    if (action === 'popular') {
      const resultado = await popularDoEspelho();
      return res.status(200).json({ ok: true, action, ...resultado, tabelas: await resumo() });
    }
    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}
