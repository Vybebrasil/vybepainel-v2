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

function autorizado(req) {
  const segredo = process.env.MIRROR_ADMIN_KEY;
  if (!segredo) return false;
  const enviado =
    String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '') ||
    String(req.query?.key || req.body?.key || '');
  return enviado === segredo;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!autorizado(req)) {
    // Diagnóstico temporário: só tamanhos, nunca o valor. Remover quando a chave
    // estiver acertada — serve para distinguir "variável ausente no ambiente" de
    // "variável presente mas diferente da enviada".
    const segredo = process.env.MIRROR_ADMIN_KEY || '';
    const enviado =
      String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '') ||
      String(req.query?.key || req.body?.key || '');
    return res.status(401).json({
      error: 'Não autorizado.',
      diagnostico: {
        variavel_existe_no_ambiente: Boolean(process.env.MIRROR_ADMIN_KEY),
        tamanho_da_variavel: segredo.length,
        tamanho_do_enviado: enviado.length,
        primeiros_iguais: segredo.slice(0, 4) === enviado.slice(0, 4),
        ultimos_iguais: segredo.slice(-4) === enviado.slice(-4),
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
