// Avisos ativos da Vybe AI no WhatsApp (somente leitura, só para a conta administradora do bot).
// 1) identificarParticipantes: dos participantes de um grupo aprovado, quais são pessoas vinculadas
//    (o bot só conhece o JID; o vínculo é um hash, por isso a correspondência é feita aqui).
// 2) avisosDeStatus: mudanças de status recentes que pedem ação de alguém, com quem marcar e onde.
//    Regras (Paulo, 26/10/2026): aprovação de design/direção de arte → Deivid; de vídeo/Reels/motion →
//    dono do cliente (Vinícius ou Ewerton); Para agendar → Tainara (função agendamento); Alteração →
//    responsáveis da peça, no grupo Correção.
import { identificadorProtegido, validarJid } from './assistente-identidade.js';
import { codigoDoPainel } from './assistente-rotinas.js';
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
      c.prazo::text AS prazo, c.veiculacao::text AS veiculacao,
      COALESCE(ARRAY(SELECT cl.nome FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id WHERE cc.conteudo_id = c.id ORDER BY cl.nome), '{}') AS clientes,
      COALESCE((SELECT json_agg(json_build_object('monday_id', p.monday_user_id, 'nome', p.nome) ORDER BY r.ordem) FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id = c.id), '[]') AS responsaveis,
      COALESCE((SELECT json_agg(DISTINCT jsonb_build_object('monday_id', p.monday_user_id, 'nome', p.nome)) FROM vybe_conteudo_clientes cc JOIN vybe_cliente_pessoas h ON h.cliente_id = cc.cliente_id JOIN vybe_pessoas p ON p.id = h.pessoa_id WHERE cc.conteudo_id = c.id), '[]') AS heads
    FROM vybe_conteudo_eventos e JOIN vybe_conteudos c ON c.id = e.conteudo_id
    WHERE e.tipo = 'status' AND e.em > ${new Date(inicio).toISOString()}::timestamptz AND e.em <= ${agora.toISOString()}::timestamptz AND c.removido_em IS NULL
    ORDER BY e.em, e.id LIMIT 100`;
  if (!eventos.length) return [];
  const ids = [pessoasPainel.DEIVID, pessoasPainel.TAINARA, pessoasPainel.VINICIUS, pessoasPainel.EWERTON_L].filter(Boolean);
  const conhecidas = new Map((await sql`SELECT monday_user_id, nome FROM vybe_pessoas WHERE monday_user_id = ANY(${ids}::text[])`).map((p) => [String(p.monday_user_id), { monday_id: String(p.monday_user_id), nome: p.nome }]));
  const pessoa = (id) => conhecidas.get(String(id)) || null;
  const avisos = [];
  for (const e of eventos) {
    const para = normal(e.para);
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
