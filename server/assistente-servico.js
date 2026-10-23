import { validarConversa, autorizarConversa } from './assistente-politica.js';
import { FERRAMENTAS_ASSISTENTE, executarFerramenta } from './assistente-ferramentas.js';
import { assistenteAtivo } from './assistente-ativacao.js';
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
import { minhasDemandas } from './assistente-consultas.js';

// Mesmo handler do endpoint existente, com banco injetável para integração.
export async function atenderBotAssistente(req, res, criarBanco, config = process.env) {
  if (!autenticarAssistente(req, config.VYBE_AI_BOT_TOKEN))
    return res.status(401).json({ error: 'Não autorizado.' });
  if (!assistenteAtivo(config)) return res.status(503).json({ error: 'Vybe AI desativada neste ambiente.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const { jid, codigo, consulta, contexto, ferramenta, argumentos } = req.body || {};
  const segredo = config.VYBE_AI_LINK_SECRET;
  if (!segredo || segredo.length < 32) return res.status(503).json({ error: 'Integração não configurada.' });
  try {
    if (consulta === 'vinculacao_confirmar') {
      validarConversa(jid,contexto,config);
      if (contexto.tipo !== 'privado') return res.status(403).json({error:'Vinculação somente em conversa privada.'});
      if (typeof codigo !== 'string') return res.status(400).json({ error: 'Código obrigatório.' });
      const ok = await consumirCodigo(criarBanco(), jid, codigo, segredo);
      return res.status(ok ? 200 : 403).json({ ok });
    }
    if (consulta === 'operacional' || consulta === 'autorizar_contexto') {
      const pessoaId=await autorizarConversa(criarBanco(),jid,contexto,segredo,config);
      if(consulta==='autorizar_contexto')return res.status(200).json({ok:true,ferramentas:FERRAMENTAS_ASSISTENTE,pessoa_id:pessoaId,politica:'operacional-interna-1',max_ferramentas:3});
      return res.status(200).json({ok:true,...await executarFerramenta(criarBanco(),ferramenta,argumentos,{pessoaId})});
    }
    if (consulta === 'minhas_demandas') {
      const id=await autorizarConversa(criarBanco(),jid,contexto,segredo,config);
      return res.status(200).json({ ok: true, ...(await minhasDemandas(criarBanco(), id)) });
    }
    return res.status(400).json({ error: 'Consulta desconhecida.' });
  } catch (erro) {
    if (erro.codigo === 'WHATSAPP_NAO_VINCULADO') return res.status(403).json({error:'Conta WhatsApp não vinculada.'});
    if (erro.status === 403) return res.status(403).json({error:'Conversa ou participantes não autorizados.'});
    if (erro instanceof TypeError) return res.status(400).json({ error: 'Parâmetros inválidos.' });
    return res.status(503).json({ error: 'Não foi possível concluir a consulta.' });
  }
}
