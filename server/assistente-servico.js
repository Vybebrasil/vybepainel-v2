import { assistenteAtivo, pessoaLiberadaAssistente } from './assistente-ativacao.js';
import { createHash, timingSafeEqual } from 'node:crypto';

// Credencial EXCLUSIVA do bot. Nunca reutilizar MIRROR_ADMIN_KEY ou SESSAO_SECRET.
export function autenticarAssistente(req, tokenConfigurado) {
  if (typeof tokenConfigurado !== 'string' || tokenConfigurado.length < 48) return false;
  const header = String(req?.headers?.authorization || '');
  const match = /^Bearer ([A-Za-z0-9_-]{48,256})$/.exec(header);
  if (!match) return false;
  const esperado = createHash('sha256').update(tokenConfigurado).digest();
  const recebido = createHash('sha256').update(match[1]).digest();
  return timingSafeEqual(esperado, recebido);
}

import { consumirCodigo } from './assistente-vinculacao-fluxo.js';
import { identificadorProtegido } from './assistente-identidade.js';
import { pessoaVinculada } from './assistente-vinculos.js';
import { minhasDemandas } from './assistente-consultas.js';

// Mesmo handler do endpoint existente, com banco injetável para integração.
export async function atenderBotAssistente(req, res, criarBanco, config = process.env) {
  if (!autenticarAssistente(req, config.VYBE_AI_BOT_TOKEN))
    return res.status(401).json({ error: 'Não autorizado.' });
  if (!assistenteAtivo(config)) return res.status(503).json({ error: 'Vybe AI desativada neste ambiente.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const { jid, codigo, consulta } = req.body || {};
  const segredo = config.VYBE_AI_LINK_SECRET;
  if (!segredo || segredo.length < 32) return res.status(503).json({ error: 'Integração não configurada.' });
  try {
    if (consulta === 'vinculacao_confirmar') {
      if (typeof codigo !== 'string') return res.status(400).json({ error: 'Código obrigatório.' });
      const ok = await consumirCodigo(criarBanco(), jid, codigo, segredo, id => pessoaLiberadaAssistente(id, config));
      return res.status(ok ? 200 : 403).json({ ok });
    }
    if (consulta === 'minhas_demandas') {
      const id = await pessoaVinculada(criarBanco(), identificadorProtegido(jid, segredo));
      if (id && !pessoaLiberadaAssistente(id, config)) return res.status(403).json({ error: 'Vybe AI não liberada para esta conta.' });
      if (!id) return res.status(403).json({ error: 'Conta WhatsApp não vinculada.' });
      return res.status(200).json({ ok: true, ...(await minhasDemandas(criarBanco(), id)) });
    }
    return res.status(400).json({ error: 'Consulta desconhecida.' });
  } catch (erro) {
    if (erro instanceof TypeError) return res.status(400).json({ error: 'Parâmetros inválidos.' });
    return res.status(503).json({ error: 'Não foi possível concluir a consulta.' });
  }
}
