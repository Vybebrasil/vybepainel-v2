import {exigirAdministradorPrivado} from './assistente-exclusivo.js';
import { validarConversa, autorizarConversa } from './assistente-politica.js';
import { FERRAMENTAS_ASSISTENTE, executarFerramenta } from './assistente-ferramentas.js';
import { assistenteAtivo, escopoEquipe } from './assistente-ativacao.js';
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
import { rotinaDoDia, diasPessoais, riscos } from './assistente-rotinas.js';
import { prepararAcao, confirmarAcao } from './assistente-acoes.js';
import { identificarParticipantes, avisosDeStatus, rondaDosClientes } from './assistente-avisos.js';
import { resumosDaSemana } from './assistente-hub.js';

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
    const equipe = escopoEquipe(config);
    if (!equipe) exigirAdministradorPrivado(jid,contexto,config);
    validarConversa(jid,contexto,config);
    if (consulta === 'vinculacao_confirmar') {
      if (contexto.tipo !== 'privado') return res.status(403).json({error:'Vinculação somente em conversa privada.'});
      if (typeof codigo !== 'string') return res.status(400).json({ error: 'Código obrigatório.' });
      const ok = await consumirCodigo(criarBanco(), jid, codigo, segredo, equipe ? null : Number(config.VYBE_AI_ADMIN_PESSOA_ID));
      return res.status(ok ? 200 : 403).json({ ok });
    }
    if (consulta === 'operacional' || consulta === 'autorizar_contexto') {
      const pessoaId=await autorizarConversa(criarBanco(),jid,contexto,segredo,config);
      if(consulta==='autorizar_contexto')return res.status(200).json({ok:true,ferramentas:FERRAMENTAS_ASSISTENTE,pessoa_id:pessoaId,politica:'administrador-privado-1',max_ferramentas:3});
      return res.status(200).json({ok:true,...await executarFerramenta(criarBanco(),ferramenta,argumentos,{pessoaId})});
    }
    // Ações em dois passos (assistente-acoes.js). Recusa esperada (permissão, peça, status) volta como resposta
    // normal com o motivo, porque o bot não lê corpo de erro.
    if (consulta === 'acao_preparar' || consulta === 'acao_confirmar') {
      const banco = criarBanco();
      const pessoaId = await autorizarConversa(banco, jid, contexto, segredo, config);
      try {
        if (consulta === 'acao_preparar') return res.status(200).json({ ok: true, ...(await prepararAcao(banco, pessoaId, req.body?.pedido, segredo)) });
        return res.status(200).json({ ok: true, ...(await confirmarAcao(banco, pessoaId, req.body?.codigo, segredo)) });
      } catch (erro) {
        if (erro.publica) return res.status(200).json({ ok: true, recusa: String(erro.message).slice(0, 400) });
        throw erro;
      }
    }
    if (consulta === 'minhas_demandas') {
      const id=await autorizarConversa(criarBanco(),jid,contexto,segredo,config);
      return res.status(200).json({ ok: true, ...(await minhasDemandas(criarBanco(), id)) });
    }
    // Rotinas e avisos ativos (agência inteira): só pessoa administradora, no privado.
    if (['rotina', 'identificar', 'avisos', 'ronda', 'dias_pessoais', 'riscos', 'resumos_semana'].includes(consulta)) {
      if (contexto?.tipo !== 'privado') return res.status(403).json({ error: 'Consulta somente no privado da administração.' });
      const banco = criarBanco();
      const pessoaId = await autorizarConversa(banco, jid, contexto, segredo, config);
      const [adm] = await banco`SELECT 1 AS ok FROM vybe_pessoas WHERE id=${pessoaId} AND admin IS TRUE AND ativo IS TRUE`;
      if (!adm) return res.status(403).json({ error: 'Consulta restrita à administração.' });
      if (consulta === 'identificar') return res.status(200).json({ ok: true, pessoas: await identificarParticipantes(banco, req.body?.participantes, segredo) });
      if (consulta === 'avisos') return res.status(200).json({ ok: true, avisos: await avisosDeStatus(banco, { desde: req.body?.desde }) });
      if (consulta === 'resumos_semana') return res.status(200).json({ ok: true, ...(await resumosDaSemana(banco, req.body?.dia)) });
      if (consulta === 'riscos') return res.status(200).json({ ok: true, ...(await riscos(banco, req.body?.dia)) });
      if (consulta === 'dias_pessoais') return res.status(200).json({ ok: true, dias: await diasPessoais(banco, req.body?.pessoas, req.body?.dia) });
      if (consulta === 'ronda') return res.status(200).json({ ok: true, mensagens: await rondaDosClientes(banco, req.body?.ronda) });
      const { momento, dia, base_anterior: baseAnterior = null } = req.body?.rotina || {};
      return res.status(200).json({ ok: true, itens: [], ...(await rotinaDoDia(banco, { momento, dia, baseAnterior })) });
    }
    return res.status(400).json({ error: 'Consulta desconhecida.' });
  } catch (erro) {
    if (erro.codigo === 'WHATSAPP_NAO_VINCULADO') return res.status(403).json({error:'Conta WhatsApp não vinculada.'});
    if (erro.status === 403) return res.status(403).json({error:'Conversa ou participantes não autorizados.'});
    if (erro.status === 413) return res.status(413).json({error:'Recorte excede o limite; reduza a quantidade ou consulte outra seção.'});
    if (erro instanceof TypeError) return res.status(400).json({ error: 'Parâmetros inválidos.' });
    return res.status(503).json({ error: 'Não foi possível concluir a consulta.' });
  }
}
