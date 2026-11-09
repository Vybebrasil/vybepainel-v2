import {exigirAdministradorPrivado} from './assistente-exclusivo.js';
import { validarConversa, autorizarConversa } from './assistente-politica.js';
import { FERRAMENTAS_ASSISTENTE, executarFerramenta } from './assistente-ferramentas.js';
import { assistenteAtivo, escopoEquipe } from './assistente-ativacao.js';
import { redistribuicoes } from './redistribuicoes.js';
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
import { ehDonoPessoa, mondayDaPessoa } from './donos.js';
import { minhasDemandas } from './assistente-consultas.js';
import { rotinaDoDia, diasPessoais, riscos } from './assistente-rotinas.js';
import { prepararAcao, confirmarAcao, opcoesDeCriacao } from './assistente-acoes.js';
import { identificarParticipantes, avisosDeStatus, rondaDosClientes } from './assistente-avisos.js';
import { resumosDaSemana, resultadoDosPosts, diagnosticoJarvis } from './assistente-hub.js';
import { arteDaPeca, comentarRevisao, previaDaPeca } from './assistente-revisao-arte.js';
import { guardarEstadoVybes, acaoVybes } from './vybes.js';
import { saudeDosClientes, pecasSemBriefing, pecasEmFaltaInfo } from './assistente-saude.js';
import { compromissosProximos } from './assistente-compromissos.js';
import { guardarIdeia } from './assistente-regras.js';
import { encaixeCaptacao } from './assistente-encaixe.js';
import { acompanhamento, focoDaPessoa } from './assistente-acompanhamento.js';
import { impressoesParaAgente, registrarPeloAgente } from './impressoes.js';
import { planejamentoPecasParaAgente } from './planejamentos.js';

// Mesmo handler do endpoint existente, com banco injetável para integração.
export async function atenderBotAssistente(req, res, criarBanco, config = process.env) {
  if (!autenticarAssistente(req, config.VYBE_AI_BOT_TOKEN))
    return res.status(401).json({ error: 'Não autorizado.' });
  if (!assistenteAtivo(config)) return res.status(503).json({ error: 'Vybe AI desativada neste ambiente.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const { jid, codigo, consulta, contexto, ferramenta, argumentos } = req.body || {};
  const segredo = config.VYBE_AI_LINK_SECRET;
  if (!segredo || segredo.length < 32) return res.status(503).json({ error: 'Integração não configurada.' });
  // Retrato da central com o WhatsApp do bot desconectado (sem jid nem contexto: sem WhatsApp o bot não monta o contexto
  // da conta administradora). Só a credencial exclusiva do bot, já conferida acima; grava só {tunel, whatsapp}.
  if (consulta === 'vybes_publicar' && jid == null && contexto == null) {
    try { return res.status(200).json({ ok: true, ...(await guardarEstadoVybes(criarBanco(), req.body?.estado)) }); }
    catch (erro) { return res.status(erro.status === 400 ? 400 : 500).json({ error: erro.status === 400 ? erro.message : 'Falha ao guardar o estado do VYBES.' }); }
  }
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
      // `dono`: a mesma regra única (server/donos.js) — o bot não decide mais dono pelo primeiro nome no WhatsApp.
      if(consulta==='autorizar_contexto'){const dono=ehDonoPessoa({id:pessoaId,monday_user_id:await mondayDaPessoa(criarBanco(),pessoaId)},config);return res.status(200).json({ok:true,ferramentas:FERRAMENTAS_ASSISTENTE,pessoa_id:pessoaId,dono,politica:'administrador-privado-1',max_ferramentas:3});}
      // Falha com motivo para a pessoa (VybeHub fora, cliente sem conta de anúncio): volta como aviso, não como erro mudo.
      try{return res.status(200).json({ok:true,...await executarFerramenta(criarBanco(),ferramenta,argumentos,{pessoaId})});}
      catch(erro){if(erro.publica)return res.status(200).json({ok:true,itens:[],aviso:String(erro.message).slice(0,300)});throw erro;}
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
        if (erro.publica) return res.status(200).json({ ok: true, recusa: String(erro.message).slice(0, 1500) });
        throw erro;
      }
    }
    // Banco de ideias: qualquer pessoa vinculada guarda uma ideia para um cliente.
    if (consulta === 'ideia') {
      const id=await autorizarConversa(criarBanco(),jid,contexto,segredo,config);
      try { return res.status(200).json({ ok: true, ...(await guardarIdeia(criarBanco(), id, req.body?.ideia || {})) }); }
      catch (erro) { if (erro.publica) return res.status(200).json({ ok: true, texto: '⛔ ' + erro.message }); throw erro; }
    }
    // "O que eu faço agora?": a fila da própria pessoa, no privado ou no grupo aprovado.
    if (consulta === 'foco') {
      const id=await autorizarConversa(criarBanco(),jid,contexto,segredo,config);
      return res.status(200).json({ ok: true, ...(await focoDaPessoa(criarBanco(), id, new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia'}).format(new Date()))) });
    }
    // Opções do cadastro guiado (grupos, status, captação e pessoas da Produção): qualquer pessoa vinculada.
    if (consulta === 'opcoes_criacao') {
      const banco = criarBanco();
      await autorizarConversa(banco, jid, contexto, segredo, config);
      return res.status(200).json({ ok: true, ...(await opcoesDeCriacao(banco)) });
    }
    if (consulta === 'minhas_demandas') {
      const id=await autorizarConversa(criarBanco(),jid,contexto,segredo,config);
      return res.status(200).json({ ok: true, ...(await minhasDemandas(criarBanco(), id)) });
    }
    // Rotinas e avisos ativos (agência inteira): só pessoa administradora, no privado.
    if (['vybes_publicar', 'vybes_acao', 'rotina', 'identificar', 'avisos', 'ronda', 'dias_pessoais', 'riscos', 'resumos_semana', 'arte_da_peca', 'comentar_revisao', 'previa_da_peca', 'saude_clientes', 'impressoes', 'impressao_registrar', 'planejamento_pecas', 'redistribuicoes', 'falta_info', 'sem_briefing', 'compromissos', 'resultado_posts', 'acompanhamento', 'diagnostico', 'encaixe'].includes(consulta)) {
      if (contexto?.tipo !== 'privado') return res.status(403).json({ error: 'Consulta somente no privado da administração.', motivo: 'somente_privado' });
      const banco = criarBanco();
      const pessoaId = await autorizarConversa(banco, jid, contexto, segredo, config);
      const [adm] = await banco`SELECT 1 AS ok FROM vybe_pessoas WHERE id=${pessoaId} AND admin IS TRUE AND ativo IS TRUE`;
      if (!adm) return res.status(403).json({ error: 'Consulta restrita à administração.', motivo: 'nao_admin' });
      // VYBES: o estado que a central do PC do Paulo mostra, publicado para o módulo VYBES do painel (server/vybes.js).
      if (consulta === 'vybes_publicar') return res.status(200).json({ ok: true, ...(await guardarEstadoVybes(banco, req.body?.estado)) });
      // Ação pedida na central do VYBES por quem entrou pelo Vybe OS: com a permissão DELA (não a do Paulo).
      if (consulta === 'vybes_acao') {
        try { return res.status(200).json({ ok: true, ...(await acaoVybes(banco, { tipo: 'sessao', pessoa: { id: Number(req.body?.pessoa) } }, req.body || {}, { segredo })) }); }
        catch (erro) { if (erro.publica || erro.status === 403) return res.status(200).json({ ok: true, recusa: erro.message }); throw erro; }
      }
      if (consulta === 'identificar') return res.status(200).json({ ok: true, pessoas: await identificarParticipantes(banco, req.body?.participantes, segredo) });
      if (consulta === 'avisos') return res.status(200).json({ ok: true, avisos: await avisosDeStatus(banco, { desde: req.body?.desde }) });
      if (consulta === 'encaixe') return res.status(200).json({ ok: true, ...(await encaixeCaptacao(banco, req.body?.dia)) });
      if (consulta === 'diagnostico') return res.status(200).json({ ok: true, ...(await diagnosticoJarvis(banco)) });
      if (consulta === 'acompanhamento') return res.status(200).json({ ok: true, ...(await acompanhamento(banco, { tipo: req.body?.tipo, dia: req.body?.dia })) });
      if (consulta === 'resultado_posts') return res.status(200).json({ ok: true, ...(await resultadoDosPosts(banco, req.body?.dia)) });
      if (consulta === 'compromissos') return res.status(200).json({ ok: true, compromissos: await compromissosProximos(banco) });
      // Augusto (Copy): demanda parada em "Falta Info", quem marcou e o que já foi comentado depois. Só leitura.
      // Heitor (Coordenação de Produção): trocas de responsável na Produção, com quem trocou (server/redistribuicoes.js). Só leitura.
      if (consulta === 'redistribuicoes') return res.status(200).json({ ok: true, ...(await redistribuicoes(banco, { dias: req.body?.dias })) });
      if (consulta === 'falta_info') return res.status(200).json({ ok: true, ...(await pecasEmFaltaInfo(banco)) });
      if (consulta === 'sem_briefing') return res.status(200).json({ ok: true, pecas: await pecasSemBriefing(banco, req.body?.dia) });
      if (consulta === 'saude_clientes') return res.status(200).json({ ok: true, ...(await saudeDosClientes(banco, req.body?.dia)) });
      // Compras e Fornecedores (agente do VYBES, 09/11): impressões abertas, ranking e o pedido de cotação pronto. Só leitura.
      if (consulta === 'impressoes') return res.status(200).json({ ok: true, ...(await impressoesParaAgente(banco)) });
      // Nestor registra em Impressões o que leu na conversa com o fornecedor (server/impressoes.js registrarPeloAgente).
      if (consulta === 'impressao_registrar') {
        try { return res.status(200).json({ ok: true, ...(await registrarPeloAgente(banco, pessoaId, req.body?.impressao || {})) }); }
        catch (erro) { if (erro.status && erro.status < 500) return res.status(200).json({ ok: true, recusa: erro.message }); throw erro; }
      }
      // Augusto (Copy): demanda aberta que veio de planejamento e está sem parte da peça, ou em "Falta Info". Só leitura.
      if (consulta === 'planejamento_pecas') return res.status(200).json({ ok: true, ...(await planejamentoPecasParaAgente(banco)) });
      if (consulta === 'previa_da_peca') return res.status(200).json({ ok: true, ...(await previaDaPeca(banco, req.body?.item)) });
      if (consulta === 'arte_da_peca') return res.status(200).json({ ok: true, ...(await arteDaPeca(banco, req.body?.item)) });
      if (consulta === 'comentar_revisao') return res.status(200).json({ ok: true, ...(await comentarRevisao(banco, req.body?.item, req.body?.texto)) });
      if (consulta === 'resumos_semana') return res.status(200).json({ ok: true, ...(await resumosDaSemana(banco, req.body?.dia)) });
      if (consulta === 'riscos') return res.status(200).json({ ok: true, ...(await riscos(banco, req.body?.dia)) });
      if (consulta === 'dias_pessoais') return res.status(200).json({ ok: true, dias: await diasPessoais(banco, req.body?.pessoas, req.body?.dia) });
      if (consulta === 'ronda') return res.status(200).json({ ok: true, mensagens: await rondaDosClientes(banco, req.body?.ronda) });
      const { momento, dia, base_anterior: baseAnterior = null } = req.body?.rotina || {};
      return res.status(200).json({ ok: true, itens: [], ...(await rotinaDoDia(banco, { momento, dia, baseAnterior })) });
    }
    return res.status(400).json({ error: 'Consulta desconhecida.' });
  } catch (erro) {
    // motivo (e o atraso, quando o contexto chegou velho): para o bot dizer no log qual regra recusou.
    const porque = { motivo: /^[a-z_]{3,30}$/.test(erro.motivo || '') ? erro.motivo : 'negado', ...(Number.isFinite(erro.atraso_s) ? { atraso_s: erro.atraso_s } : {}) };
    if (erro.codigo === 'WHATSAPP_NAO_VINCULADO') return res.status(403).json({error:'Conta WhatsApp não vinculada.', ...porque});
    if (erro.status === 403) return res.status(403).json({error:'Conversa ou participantes não autorizados.', ...porque});
    if (erro.status === 413) return res.status(413).json({error:'Recorte excede o limite; reduza a quantidade ou consulte outra seção.'});
    if (erro instanceof TypeError) return res.status(400).json({ error: 'Parâmetros inválidos.' });
    return res.status(503).json({ error: 'Não foi possível concluir a consulta.' });
  }
}
