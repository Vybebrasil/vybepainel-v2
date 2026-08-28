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

import { criarSchema, popularDoEspelho, resumo } from '../vybe_dominio_store.js';

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
  if (!autorizado(req)) {
    // Diagnóstico temporário v2: posições e códigos de caractere, nunca o valor.
    const bruto = String(process.env.MIRROR_ADMIN_KEY || '');
    const segredo = bruto.trim();
    const enviado = (
      String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '') ||
      String(req.query?.key || req.body?.key || '')
    ).trim();
    let divergeEm = -1;
    for (let i = 0; i < Math.max(segredo.length, enviado.length); i++) {
      if (segredo[i] !== enviado[i]) { divergeEm = i; break; }
    }
    return res.status(401).json({
      error: 'Não autorizado.',
      diagnostico: {
        versao: 'v2',
        bruto_len: bruto.length,
        segredo_len: segredo.length,
        enviado_len: enviado.length,
        diverge_no_indice: divergeEm,
        // códigos dos caracteres em volta da divergência, para identificar invisíveis
        segredo_codigos: [...segredo.slice(Math.max(0, divergeEm - 1), divergeEm + 2)].map((c) => c.charCodeAt(0)),
        enviado_codigos: [...enviado.slice(Math.max(0, divergeEm - 1), divergeEm + 2)].map((c) => c.charCodeAt(0)),
        bruto_ultimos_codigos: [...bruto.slice(-3)].map((c) => c.charCodeAt(0)),
      },
    });
  }

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
    if (action === 'popular') {
      const resultado = await popularDoEspelho();
      return res.status(200).json({ ok: true, action, ...resultado, tabelas: await resumo() });
    }
    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}
