// Avisos ativos da Vybe AI no WhatsApp (somente leitura, só para a conta administradora do bot).
// 1) identificarParticipantes: dos participantes de um grupo aprovado, quais são pessoas vinculadas
//    (o bot só conhece o JID; o vínculo é um hash, por isso a correspondência é feita aqui).
// 2) avisosDeStatus: mudanças de status recentes que pedem ação de alguém, com quem marcar e onde.
//    Regras (Paulo, 26/10/2026): aprovação de design/direção de arte → Deivid; de vídeo/Reels/motion →
//    dono do cliente (Vinícius ou Ewerton); Para agendar → Tainara (função agendamento); Alteração →
//    responsáveis da peça, no grupo Correção.
import { identificadorProtegido, validarJid } from './assistente-identidade.js';
import { codigoDoPainel } from './assistente-rotinas.js';
import { cobrancasDaEquipe } from './escritorio-cobrancas.js';
import vm from 'node:vm';

export async function identificarParticipantes(sql, jids, segredo) {
  if (!Array.isArray(jids) || !jids.length || jids.length > 256 || jids.some((j) => !validarJid(j)) || new Set(jids).size !== jids.length)
    throw new TypeError('Participantes inválidos.');
  const porHash = new Map(jids.map((j) => [identificadorProtegido(j, segredo), j]));
  const [schema] = await sql`SELECT to_regclass('public.vybe_ai_vinculos') IS NOT NULL AS pronta`;
  if (!schema?.pronta) return [];
  const linhas = await sql`SELECT v.jid_hash AS hash, p.id::text AS pessoa_id, p.nome, p.monday_user_id
    FROM vybe_ai_vinculos v JOIN vybe_pessoas p ON p.id = v.pessoa_id
    WHERE v.jid_hash = ANY(${[...porHash.keys()]}::text[]) AND v.revogado_em IS NULL AND p.ativo IS TRUE AND p.pode_entrar IS TRUE`;
  return linhas.map((l) => ({ jid: porHash.get(l.hash), pessoa_id: l.pessoa_id, monday_id: l.monday_user_id ? String(l.monday_user_id) : null, nome: l.nome || '' }))
    .filter((x) => x.jid);
}

const normal = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const curto = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');
const primeiro = (n) => String(n || '').trim().split(/\s+/)[0] || '';
// Mesmo critério do gerador do painel (aprovacaoDesign): vídeo pelo começo do formato ou do título.
const ehVideo = (item) => /^(reels|video|motion)/.test(normal(item.formato || item.titulo));
// Marcador que o bot troca por @menção (pessoa vinculada no grupo) ou pelo primeiro nome.
const marcar = (p) => `{{pessoa:${p.monday_id || 'sem'}:${primeiro(p.nome)}}}`;

export async function avisosDeStatus(sql, { desde }, agora = new Date()) {
  const inicio = Date.parse(desde);
  if (typeof desde !== 'string' || !Number.isFinite(inicio) || inicio > agora.getTime() || agora.getTime() - inicio > 6 * 3600e3)
    throw new TypeError('Período inválido.');
  const pessoasPainel = vm.runInContext('PESSOAS', codigoDoPainel().ctx);
  const eventos = await sql`SELECT e.id::text AS evento_id, e.em::text AS em, e.para, c.id::text AS conteudo_id, c.titulo, c.formato,
      c.board_id::text AS board_id, s.rotulo AS atual,
      c.prazo::text AS prazo, c.veiculacao::text AS veiculacao,
      COALESCE(ARRAY(SELECT cl.nome FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id WHERE cc.conteudo_id = c.id ORDER BY cl.nome), '{}') AS clientes,
      COALESCE((SELECT json_agg(json_build_object('monday_id', p.monday_user_id, 'nome', p.nome) ORDER BY r.ordem) FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id = c.id), '[]') AS responsaveis,
      COALESCE((SELECT json_agg(DISTINCT jsonb_build_object('monday_id', p.monday_user_id, 'nome', p.nome)) FROM vybe_conteudo_clientes cc JOIN vybe_cliente_pessoas h ON h.cliente_id = cc.cliente_id JOIN vybe_pessoas p ON p.id = h.pessoa_id WHERE cc.conteudo_id = c.id), '[]') AS heads
    FROM vybe_conteudo_eventos e JOIN vybe_conteudos c ON c.id = e.conteudo_id
    LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE e.tipo = 'status' AND e.em > ${new Date(inicio).toISOString()}::timestamptz AND e.em <= ${agora.toISOString()}::timestamptz AND c.removido_em IS NULL
    ORDER BY e.em, e.id LIMIT 100`;
  if (!eventos.length) return [];
  const ids = [pessoasPainel.DEIVID, pessoasPainel.TAINARA, pessoasPainel.VINICIUS, pessoasPainel.EWERTON_L].filter(Boolean);
  const conhecidas = new Map((await sql`SELECT monday_user_id, nome FROM vybe_pessoas WHERE monday_user_id = ANY(${ids}::text[])`).map((p) => [String(p.monday_user_id), { monday_id: String(p.monday_user_id), nome: p.nome }]));
  const pessoa = (id) => conhecidas.get(String(id)) || null;
  const avisos = [];
  const { ctx } = codigoDoPainel();
  // Solicitações têm nomes próprios de status ("Aguardando Aprovação"); a tradução é a do painel.
  const fluxo = (rotulo, board) => normal(ctx.operationalFlowStatus({ status: rotulo || '', board_id: Number(board) }));
  for (const e of eventos) {
    const para = fluxo(e.para, e.board_id);
    // Já andou (ex.: aprovado no mesmo minuto): não avisa o que não pede mais ação.
    if (e.atual && fluxo(e.atual, e.board_id) !== para) continue;
    const clientes = e.clientes.join(' / ') || 'Sem cliente';
    const resp = (Array.isArray(e.responsaveis) ? e.responsaveis : []).map((p) => ({ monday_id: p.monday_id ? String(p.monday_id) : null, nome: p.nome }));
    const heads = (Array.isArray(e.heads) ? e.heads : []).map((p) => ({ monday_id: p.monday_id ? String(p.monday_id) : null, nome: p.nome }));
    const quemFaz = resp.length ? resp.map((p) => primeiro(p.nome)).join(', ') : 'sem responsável';
    const datas = [e.prazo && `⏰ prazo ${curto(e.prazo)}`, e.veiculacao && `📅 cliente ${curto(e.veiculacao)}`].filter(Boolean).join(' · ');
    let grupo, alvo, texto;
    if (para === 'para aprovacao' || para === 'em aprovacao') {
      if (ehVideo(e)) {
        grupo = 'atendimento';
        alvo = heads.length ? heads : [pessoa(pessoasPainel.VINICIUS), pessoa(pessoasPainel.EWERTON_L)].filter(Boolean);
      } else { grupo = 'criacao'; alvo = [pessoa(pessoasPainel.DEIVID)].filter(Boolean); }
      texto = `🔎 *Para aprovação* · ${e.titulo} (${clientes})\n👤 ${quemFaz}${datas ? ' · ' + datas : ''}\n👉 ${alvo.map(marcar).join(', ') || 'Aprovação'}, pode aprovar? 🙏`;
    } else if (para === 'para agendar') {
      grupo = 'publicacoes';
      // Mesma fonte das cobranças do Escritório (função agendamento); sem ela, a Tainara do painel.
      const [funcoes] = await sql`SELECT to_regclass('public.vybe_escritorio_funcoes') IS NOT NULL AS existe`;
      const agendamento = funcoes?.existe ? await sql`SELECT p.monday_user_id, p.nome FROM vybe_pessoas p
        WHERE p.ativo IS NOT FALSE AND p.id IN (SELECT pessoa_id FROM vybe_escritorio_funcoes WHERE funcao = 'agendamento')` : [];
      alvo = agendamento.length ? agendamento.map((p) => ({ monday_id: p.monday_user_id ? String(p.monday_user_id) : null, nome: p.nome })) : [pessoa(pessoasPainel.TAINARA)].filter(Boolean);
      texto = `📅 *Para agendar* · ${e.titulo} (${clientes})${e.veiculacao ? ` · veicula ${curto(e.veiculacao)}` : ''}\n👉 ${alvo.map(marcar).join(', ') || 'Agendamento'}, pode agendar? 🙏`;
    } else if (para === 'alteracao') {
      grupo = 'correcao'; alvo = resp;
      texto = `✏️ *Alteração* · ${e.titulo} (${clientes})${datas ? '\n' + datas : ''}\n👉 ${alvo.map(marcar).join(', ') || 'Sem responsável'}, tem ajuste pra fazer. 💪`;
    } else continue;
    avisos.push({ evento_id: e.evento_id, conteudo_id: e.conteudo_id, em: e.em, status: e.para, grupo, pessoas: alvo, texto });
  }
  return avisos;
}

// Ronda dos clientes (robozinhos no WhatsApp): as MESMAS cobranças do Escritório (cobrancasDaEquipe),
// agrupadas por grupo do WhatsApp e por cliente, cada cliente "cobrando" quem deve agir.
// Atraso de 3 dias ou mais também marca o dono do cliente (escala, Paulo 26/10/2026).
const GRUPO_DA_COBRANCA = { atrasada: 'criacao', hoje: 'criacao', vence: 'criacao', agendar: 'publicacoes',
  lembrar_cliente: 'atendimento', marcar_gravacao: 'atendimento', postar_parada: 'atendimento' };
const GRAVIDADE = { postar_parada: 0, atrasada: 1, agendar: 2, hoje: 3, vence: 4, lembrar_cliente: 5, marcar_gravacao: 6 };
const ESCALA_DIAS = 3, MAX_LINHAS = 25;
function fraseDaCobranca(c) {
  const dias = (n) => `${n} dia${n === 1 ? '' : 's'}`;
  switch (c.tipo) {
    case 'atrasada': return `🔴 atrasada há ${dias(c.dias)}`;
    case 'hoje': return '⏰ prazo hoje';
    case 'vence': return '⚠️ vence amanhã e ainda não começou';
    case 'agendar': return `📅 veicula ${curto(c.data)} e está para agendar`;
    case 'lembrar_cliente': return `🟡 esperando o cliente${c.dias > 0 ? ` há ${dias(c.dias)}` : ''}, lembrar o cliente`;
    case 'marcar_gravacao': return '🎬 falta marcar a gravação';
    case 'postar_parada': return `🚨 veicula ${curto(c.data)} e nem começou`;
    default: return c.tipo;
  }
}
export async function rondaDosClientes(sql, rotulo, agora = new Date()) {
  if (!['10h', '16h'].includes(rotulo)) throw new TypeError('Ronda inválida.');
  const por = await cobrancasDaEquipe(sql, agora);
  const pessoas = new Map((await sql`SELECT id::text, nome, monday_user_id FROM vybe_pessoas`).map((p) => [p.id, { monday_id: p.monday_user_id ? String(p.monday_user_id) : null, nome: p.nome }]));
  const heads = new Map();
  for (const h of await sql`SELECT cliente_id::text, pessoa_id::text FROM vybe_cliente_pessoas`) { if (!heads.has(h.cliente_id)) heads.set(h.cliente_id, []); heads.get(h.cliente_id).push(h.pessoa_id); }
  // Mesma peça cobrada de várias pessoas vira uma linha só, com todas marcadas.
  const linhas = new Map();
  for (const [pessoaId, lista] of por) for (const c of lista) {
    const grupo = GRUPO_DA_COBRANCA[c.tipo]; if (!grupo) continue;
    const chave = JSON.stringify([grupo, c.cliente_id, c.ref, c.tipo]);
    if (!linhas.has(chave)) linhas.set(chave, { ...c, grupo, alvo: new Set(), escala: new Set() });
    linhas.get(chave).alvo.add(pessoaId);
  }
  for (const l of linhas.values()) if (l.tipo === 'atrasada' && l.dias >= ESCALA_DIAS) for (const h of heads.get(l.cliente_id) || []) if (!l.alvo.has(h)) l.escala.add(h);
  const marcarIds = (ids) => [...ids].map((id) => pessoas.get(id)).filter(Boolean).map(marcar).join(', ');
  const porGrupo = new Map();
  for (const l of linhas.values()) { if (!porGrupo.has(l.grupo)) porGrupo.set(l.grupo, []); porGrupo.get(l.grupo).push(l); }
  const mensagens = [];
  for (const [grupo, itens] of porGrupo) {
    const porCliente = new Map();
    for (const l of itens) { if (!porCliente.has(l.cliente_id)) porCliente.set(l.cliente_id, { nome: l.cliente, itens: [] }); porCliente.get(l.cliente_id).itens.push(l); }
    // Cliente com a cobrança mais grave/antiga primeiro.
    const clientes = [...porCliente.values()].map((c) => ({ ...c, itens: c.itens.sort((a, b) => GRAVIDADE[a.tipo] - GRAVIDADE[b.tipo] || b.dias - a.dias || a.titulo.localeCompare(b.titulo, 'pt-BR')) }))
      .sort((a, b) => GRAVIDADE[a.itens[0].tipo] - GRAVIDADE[b.itens[0].tipo] || b.itens[0].dias - a.itens[0].dias || a.nome.localeCompare(b.nome, 'pt-BR'));
    const texto = [`🤖 *Ronda dos clientes · ${rotulo}*`, '_Os clientes passaram cobrando o que precisa de ação:_'];
    let n = 0;
    for (const c of clientes) {
      if (n >= MAX_LINHAS) break;
      texto.push('', `🤖 *${c.nome}* está cobrando:`);
      for (const l of c.itens) {
        if (n >= MAX_LINHAS) break;
        texto.push(`- ${fraseDaCobranca(l)}: ${l.titulo} → ${marcarIds(l.alvo) || 'sem responsável'}${l.escala.size ? ` · ⬆️ ${marcarIds(l.escala)}` : ''}`);
        n++;
      }
    }
    if (itens.length > n) texto.push('', `- e mais ${itens.length - n} cobranças no painel (Escritório).`);
    mensagens.push({ id: grupo, texto: texto.join('\n'), total: itens.length });
  }
  const ordem = ['criacao', 'publicacoes', 'atendimento'];
  return mensagens.sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));
}
