// Gravação e leitura dos campos que os quadros D3 pediam e o sistema não guardava (Paulo, 14/11/2026). As tabelas vêm de
// server/migracoes-campos.js. Cada leitura aguenta o banco ANTES da migração (42P01/42703 → vazio honesto, nunca erro na
// tela). Nada aqui envia WhatsApp, e-mail nem mensagem a cliente: o aviso aos sócios é registro interno + o sino.
//
//  - Aviso aos sócios (inadimplência): registrarAviso / avisosRecentes          → area=comercial (aba inadimplencia)
//  - Forma de pagamento do recebimento: salvarForma / formasDe                  → area=comercial (aba recebimentos)
//  - Campanhas dos creators: salvarCampanha / campanhasDosCreators              → area=comercial (aba creators)
//  - Metas (nota da carteira, acerto dos agentes): areaMetas                    → area=metas
//  - Minha sala (cor e foco): areaMinhaSala                                     → area=minha_sala
//  - Hora de publicação da peça: areaPecaComplemento                            → area=peca_complemento
import { ehDonoPessoa, DONOS_MONDAY } from './donos.js';
import { garantirMigracoesCampos } from './migracoes-campos.js';

const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };
const semTabela = (e) => e?.code === '42P01' || e?.code === '42703';
const idValido = (v, campo = 'ID') => { const s = String(v ?? ''); if (!/^[1-9]\d{0,15}$/.test(s)) falhar(`${campo} inválido.`); return s; };
const texto = (v, max, campo) => { if (v != null && typeof v !== 'string') falhar(`${campo} inválido.`); const s = (v || '').trim(); if (s.length > max) falhar(`${campo}: máximo de ${max} caracteres.`); return s; };
const ehDia = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && new Date(String(v) + 'T12:00:00Z').toISOString().slice(0, 10) === String(v);
const iso = (v) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

// A coluna nova já está no banco? (antes da migração, quem grava usa o INSERT de antes; uma transação não pode errar).
export async function temColuna(sql, tabela, coluna) {
  try {
    const [r] = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = ${tabela} AND column_name = ${coluna}) AS ok`;
    return Boolean(r?.ok);
  } catch { return false; }
}
// ---------- 7. Origem da oportunidade do CRM ----------
// sdr = importada das propostas do SDR; manual = cadastrada à mão no funil; formulario = o formulário de leads.
export async function origemCrmPronta(sql) { await garantirMigracoesCampos(sql); return temColuna(sql, 'vybe_crm_oportunidades', 'origem'); }

// ---------- 2. Aviso aos sócios ----------
export const NIVEIS_AVISO = Object.freeze([3, 10, 30]);
export const nivelDoAtraso = (dias) => (Number(dias) >= 30 ? 30 : Number(dias) >= 10 ? 10 : 3);
// Os quatro donos ativos (pelo id do Monday, a regra de server/donos.js) e os de VYBE_DONOS_IDS.
async function donosAtivos(sql, env = process.env) {
  const extras = String(env?.VYBE_DONOS_IDS || '').split(',').map((x) => x.trim()).filter((x) => /^[1-9]\d{0,15}$/.test(x));
  const linhas = await sql`SELECT p.id::text, p.nome, to_jsonb(p) ->> 'monday_user_id' AS monday FROM vybe_pessoas p WHERE COALESCE(p.ativo, true)`;
  return linhas.filter((p) => Object.prototype.hasOwnProperty.call(DONOS_MONDAY, String(p.monday || '')) || extras.includes(p.id)
    || String(env?.VYBE_AI_ADMIN_PESSOA_ID || '').trim() === p.id).map((p) => ({ id: p.id, nome: p.nome }));
}
// b: { cliente_id?, cliente_nome, atraso_dias?, nivel? }. Grava o aviso e põe no sino dos outros donos.
export async function registrarAviso(sql, quem, b = {}) {
  if (!ehDonoPessoa(quem)) falhar('O financeiro é só dos donos.', 403);
  const nome = texto(b.cliente_nome, 200, 'Cliente'); if (!nome) falhar('Informe o cliente.');
  const cliente = b.cliente_id == null || b.cliente_id === '' ? null : idValido(b.cliente_id, 'Cliente');
  const dias = b.atraso_dias == null || b.atraso_dias === '' ? null : Number(b.atraso_dias);
  if (dias != null && (!Number.isInteger(dias) || dias < 0 || dias > 10000)) falhar('Atraso inválido.');
  const nivel = b.nivel == null || b.nivel === '' ? nivelDoAtraso(dias ?? 0) : Number(b.nivel);
  if (!NIVEIS_AVISO.includes(nivel)) falhar('Nível do aviso: 3, 10 ou 30 dias.');
  await garantirMigracoesCampos(sql);
  const donos = await donosAtivos(sql), para = donos.filter((d) => d.id !== String(quem.id));
  const [a] = await sql`INSERT INTO vybe_financeiro_avisos (cliente_id, cliente_nome, nivel, atraso_dias, quem, quem_nome, para)
    VALUES (${cliente}, ${nome}, ${nivel}, ${dias}, ${quem.id}, ${String(quem.nome || '')}, ${JSON.stringify(para.map((d) => d.id))}::jsonb)
    RETURNING id::text, em`;
  const primeiro = String(quem.nome || 'Um dono').split(' ')[0];
  const recado = `${primeiro} avisou os sócios: ${nome}${dias != null ? ` com ${dias} ${dias === 1 ? 'dia' : 'dias'} de atraso` : ' em atraso'} (régua de ${nivel} dias). Abra Finanças › Inadimplência.`;
  let noSino = 0;
  for (const d of para) { try { await sql`INSERT INTO vybe_notificacoes (pessoa_id, texto) VALUES (${d.id}, ${recado})`; noSino += 1; } catch { /* o sino é opcional */ } }
  return { aviso: { id: a.id, em: iso(a.em), cliente_id: cliente, cliente_nome: nome, nivel, atraso_dias: dias, quem_nome: String(quem.nome || ''), para: para.map((d) => d.nome) }, no_sino: noSino };
}
// Os avisos dos últimos 90 dias, do mais novo para o mais velho, e o último de cada cliente.
export async function avisosRecentes(sql) {
  try {
    const linhas = await sql`SELECT a.id::text, a.cliente_id::text, a.cliente_nome, a.nivel, a.atraso_dias, a.quem::text, a.quem_nome, a.para, a.em
      FROM vybe_financeiro_avisos a WHERE a.em > now() - interval '90 days' ORDER BY a.em DESC, a.id DESC LIMIT 500`;
    const nomes = new Map((await sql`SELECT id::text, nome FROM vybe_pessoas`).map((p) => [p.id, p.nome]));
    const lista = linhas.map((a) => ({ ...a, em: iso(a.em), para: (Array.isArray(a.para) ? a.para : []).map((id) => nomes.get(String(id)) || '').filter(Boolean) }));
    const chave = (a) => (a.cliente_id ? 'id:' + a.cliente_id : 'nome:' + a.cliente_nome);
    const ultimo = {}, contagem = {};
    for (const a of lista) { const k = chave(a); if (!ultimo[k]) ultimo[k] = a; contagem[k] = (contagem[k] || 0) + 1; }
    return { disponivel: true, lista: lista.slice(0, 100), ultimo_por_cliente: ultimo, contagem_por_cliente: contagem };
  } catch (e) { if (semTabela(e)) return { disponivel: false, lista: [], ultimo_por_cliente: {}, contagem_por_cliente: {} }; throw e; }
}

// ---------- 3. Forma de pagamento ----------
export const FORMAS_RECEBIMENTO = Object.freeze(['pix', 'boleto', 'cartao', 'transferencia']);
export async function salvarForma(sql, quem, b = {}) {
  if (!ehDonoPessoa(quem)) falhar('O financeiro é só dos donos.', 403);
  const id = String(b.id ?? '');
  if (!/^[A-Za-z0-9:_-]{1,80}$/.test(id)) falhar('Recebimento inválido.');
  await garantirMigracoesCampos(sql);
  if (b.forma == null || b.forma === '') { await sql`DELETE FROM vybe_comercial_recebivel_forma WHERE recebivel=${id}`; return { id, forma: null }; }
  if (!FORMAS_RECEBIMENTO.includes(b.forma)) falhar('Forma: pix, boleto, cartão ou transferência.');
  await sql`INSERT INTO vybe_comercial_recebivel_forma (recebivel, forma, atualizado_por) VALUES (${id}, ${b.forma}, ${quem.id})
    ON CONFLICT (recebivel) DO UPDATE SET forma=EXCLUDED.forma, atualizado_por=EXCLUDED.atualizado_por, atualizado_em=now()`;
  return { id, forma: b.forma };
}
export async function formasDe(sql, ids = []) {
  if (!ids.length) return {};
  try {
    const linhas = await sql`SELECT recebivel, forma FROM vybe_comercial_recebivel_forma WHERE recebivel = ANY(${ids.map(String)}::text[])`;
    return Object.fromEntries(linhas.map((l) => [l.recebivel, l.forma]));
  } catch (e) { if (semTabela(e)) return {}; throw e; }
}

// ---------- 6. Campanhas dos creators ----------
export const STATUS_CAMPANHA = Object.freeze(['planejada', 'ativa', 'encerrada', 'cancelada']);
// Em campanha = ativa, ou planejada/ativa com hoje entre o início e o fim (sem fim, vale do início em diante).
export const emCampanha = (c, hoje) => c.status === 'ativa' || (c.status === 'planejada' && c.inicio <= hoje && (!c.fim || c.fim >= hoje));
export async function salvarCampanha(sql, quem, b = {}) {
  const creator = idValido(b.creator_id, 'Creator');
  const inicio = String(b.inicio || ''); if (!ehDia(inicio)) falhar('Informe o início da campanha.');
  const fim = b.fim == null || b.fim === '' ? null : String(b.fim);
  if (fim && (!ehDia(fim) || fim < inicio)) falhar('O fim vem depois do início.');
  const status = b.status || 'planejada'; if (!STATUS_CAMPANHA.includes(status)) falhar('Status inválido.');
  const obs = texto(b.observacao, 1000, 'Observação');
  let clienteId = b.cliente_id == null || b.cliente_id === '' ? null : idValido(b.cliente_id, 'Cliente');
  let nome = texto(b.cliente_nome, 200, 'Cliente');
  if (clienteId) { const [c] = await sql`SELECT nome FROM vybe_clientes WHERE id=${clienteId}`; if (!c) falhar('Cliente não encontrado.', 404); nome = nome || c.nome; }
  if (!nome) falhar('Informe o cliente da campanha.');
  if (!(await sql`SELECT id FROM vybe_comercial_creators WHERE id=${creator} AND ativo`).length) falhar('Creator não encontrado.', 404);
  await garantirMigracoesCampos(sql);
  if (!b.id) {
    const [c] = await sql`INSERT INTO vybe_creator_campanhas (creator_id, cliente_id, cliente_nome, inicio, fim, status, observacao, criado_por)
      VALUES (${creator}, ${clienteId}, ${nome}, ${inicio}::date, ${fim}::date, ${status}, ${obs}, ${quem.id}) RETURNING id::text`;
    return { id: c.id };
  }
  const [c] = await sql`UPDATE vybe_creator_campanhas SET creator_id=${creator}, cliente_id=${clienteId}, cliente_nome=${nome}, inicio=${inicio}::date,
    fim=${fim}::date, status=${status}, observacao=${obs}, atualizado_em=now() WHERE id=${idValido(b.id)} RETURNING id::text`;
  if (!c) falhar('Campanha não encontrada.', 404);
  return { id: c.id };
}
export async function statusCampanha(sql, b = {}) {
  if (!STATUS_CAMPANHA.includes(b.status)) falhar('Status inválido.');
  const [c] = await sql`UPDATE vybe_creator_campanhas SET status=${b.status}, atualizado_em=now() WHERE id=${idValido(b.id)} RETURNING id::text`;
  if (!c) falhar('Campanha não encontrada.', 404);
  return { id: c.id };
}
export async function campanhasDosCreators(sql, hoje) {
  try {
    const linhas = await sql`SELECT k.id::text, k.creator_id::text, k.cliente_id::text, k.cliente_nome, to_char(k.inicio,'YYYY-MM-DD') AS inicio,
      to_char(k.fim,'YYYY-MM-DD') AS fim, k.status, k.observacao FROM vybe_creator_campanhas k
      WHERE k.status <> 'cancelada' ORDER BY k.inicio DESC, k.id DESC LIMIT 2000`;
    return { disponivel: true, campanhas: linhas.map((c) => ({ ...c, em_campanha: emCampanha(c, hoje) })) };
  } catch (e) { if (semTabela(e)) return { disponivel: false, campanhas: [] }; throw e; }
}

// ---------- 10. Metas (vybe_carteira_config) ----------
// meta_carteira        { nota: n }  — a meta da nota média de saúde da carteira (0–100)
// meta_acerto_agentes  { meta: n }  — a meta de acerto dos agentes: a MESMA chave de server/series-historicas.js
//                                     (area=series acao meta_acerto); aqui só se lê e grava o mesmo valor.
// Sem meta gravada, null: a tela não desenha linha tracejada inventada.
export const CHAVES_METAS = Object.freeze({ carteira_nota: ['meta_carteira', 'nota'], agentes_acerto: ['meta_acerto_agentes', 'meta'] });
export async function lerMetasD3(sql) {
  try {
    const linhas = await sql`SELECT chave, valor FROM vybe_carteira_config WHERE chave = ANY(${Object.values(CHAVES_METAS).map(([c]) => c)}::text[])`;
    const por = new Map(linhas.map((l) => [l.chave, (typeof l.valor === 'string' ? JSON.parse(l.valor) : l.valor) || {}]));
    const n = (x) => { const v = Number(x); return x != null && x !== '' && Number.isFinite(v) && v > 0 && v <= 100 ? v : null; };
    const out = { disponivel: true };
    for (const [k, [chave, campo]] of Object.entries(CHAVES_METAS)) out[k] = n(por.get(chave)?.[campo]);
    return out;
  } catch (e) { if (semTabela(e)) return { disponivel: false, carteira_nota: null, agentes_acerto: null }; throw e; }
}
export async function salvarMetasD3(sql, quem, b = {}) {
  if (!ehDonoPessoa(quem)) falhar('As metas são definidas pelos donos.', 403);
  const mudou = Object.keys(CHAVES_METAS).filter((k) => k in b);
  if (!mudou.length) falhar('Informe a meta da carteira ou a de acerto dos agentes.');
  for (const k of mudou) {
    const [chave, campo] = CHAVES_METAS[k];
    let v = null;
    if (b[k] != null && b[k] !== '') { v = Number(b[k]); if (!Number.isInteger(v) || v < 1 || v > 100) falhar('Meta: um número inteiro de 1 a 100.'); }
    await sql`INSERT INTO vybe_carteira_config (chave, valor, atualizado_por, atualizado_em) VALUES (${chave}, ${JSON.stringify({ [campo]: v })}::jsonb, ${quem.id}, now())
      ON CONFLICT (chave) DO UPDATE SET valor = vybe_carteira_config.valor || EXCLUDED.valor, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`;
  }
  return lerMetasD3(sql);
}
// GET /api/painel?area=metas → { carteira_nota, agentes_acerto, pode_editar }. POST { carteira_nota?, agentes_acerto? } (só donos).
export async function areaMetas(req, res, quem, sql) {
  if (quem?.tipo !== 'sessao' || !quem.pessoa?.id) return res.status(403).json({ error: 'As metas exigem uma sessão pessoal.' });
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...await lerMetasD3(sql), pode_editar: ehDonoPessoa(quem.pessoa) });
    if (req.method === 'POST') return res.status(200).json({ ok: true, ...await salvarMetasD3(sql, quem.pessoa, req.body || {}), pode_editar: true });
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (e) { return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível acessar as metas.' }); }
}

// ---------- 8. Minha sala: cor e foco ----------
// GET  /api/painel?area=minha_sala[&pessoa=ID]  → { pessoa_id, cor, foco: { id, inicio, item, rotulo } | null, hoje: { focos, segundos } }
// POST /api/painel?area=minha_sala { acao: 'cor', cor: '#rrggbb' | null }
//                                  { acao: 'foco_iniciar', item?, rotulo? }  (fecha o que estiver aberto antes)
//                                  { acao: 'foco_parar' }
// Cada um mexe só na própria sala; ler a de outra pessoa (visita) devolve a cor e se está em foco.
export async function lerSala(sql, pessoaId) {
  const [p] = await sql`SELECT cor FROM vybe_sala_preferencias WHERE pessoa_id=${pessoaId}`;
  const [f] = await sql`SELECT id::text, inicio, item, rotulo FROM vybe_sala_focos WHERE pessoa_id=${pessoaId} AND fim IS NULL`;
  const [h] = await sql`SELECT COUNT(*)::int AS focos, COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(fim, now()) - inicio))), 0)::float8 AS segundos
    FROM vybe_sala_focos WHERE pessoa_id=${pessoaId} AND (inicio AT TIME ZONE 'America/Bahia')::date = (now() AT TIME ZONE 'America/Bahia')::date`;
  return { pessoa_id: String(pessoaId), cor: p?.cor || null, foco: f ? { id: f.id, inicio: iso(f.inicio), item: f.item, rotulo: f.rotulo } : null,
    hoje: { focos: h?.focos || 0, segundos: Math.round(Number(h?.segundos) || 0) } };
}
export async function escreverSala(sql, pessoaId, b = {}) {
  const acao = String(b.acao || '');
  if (acao === 'cor') {
    const cor = b.cor == null || b.cor === '' ? null : String(b.cor).toLowerCase();
    if (cor && !/^#[0-9a-f]{6}$/.test(cor)) falhar('Cor no formato #rrggbb.');
    await sql`INSERT INTO vybe_sala_preferencias (pessoa_id, cor) VALUES (${pessoaId}, ${cor})
      ON CONFLICT (pessoa_id) DO UPDATE SET cor=EXCLUDED.cor, atualizado_em=now()`;
    return lerSala(sql, pessoaId);
  }
  if (acao === 'foco_iniciar') {
    const item = texto(b.item, 80, 'Item'), rotulo = texto(b.rotulo, 200, 'Rótulo');
    await sql.comTransacao(async (tx) => {
      await tx`UPDATE vybe_sala_focos SET fim=now() WHERE pessoa_id=${pessoaId} AND fim IS NULL`;
      await tx`INSERT INTO vybe_sala_focos (pessoa_id, item, rotulo) VALUES (${pessoaId}, ${item}, ${rotulo})`;
    });
    return lerSala(sql, pessoaId);
  }
  if (acao === 'foco_parar') {
    await sql`UPDATE vybe_sala_focos SET fim=now() WHERE pessoa_id=${pessoaId} AND fim IS NULL`;
    return lerSala(sql, pessoaId);
  }
  return falhar('Ação desconhecida.');
}
export async function areaMinhaSala(req, res, quem, sql) {
  if (quem?.tipo !== 'sessao' || !quem.pessoa?.id) return res.status(403).json({ error: 'A sala é de uma pessoa: entre com a sua conta.' });
  try {
    await garantirMigracoesCampos(sql);
    const eu = String(quem.pessoa.id);
    if (req.method === 'GET') {
      const outra = req.query?.pessoa ? idValido(req.query.pessoa, 'Pessoa') : eu;
      const s = await lerSala(sql, outra);
      // Visita: só a cor e se está em foco (sem o item nem o total do dia).
      return res.status(200).json({ ok: true, ...(outra === eu ? s : { pessoa_id: s.pessoa_id, cor: s.cor, foco: s.foco ? { inicio: s.foco.inicio } : null }), minha: outra === eu });
    }
    if (req.method === 'POST') return res.status(200).json({ ok: true, ...await escreverSala(sql, eu, req.body || {}), minha: true });
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (e) {
    if (semTabela(e)) return res.status(503).json({ error: 'A sala ainda não foi provisionada (migração 2026-11-14-campos-d3.sql).', migracao_pendente: true });
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível acessar a sala.' });
  }
}

// ---------- 9. Hora de publicação da peça ----------
// GET  /api/painel?area=peca_complemento[&itens=a,b,c] → { horas: { item: 'HH:MM' } }
// POST /api/painel?area=peca_complemento { item, publicar_hora: 'HH:MM' | null }
const ITEM = /^(vybe:)?[0-9]{1,20}$/;
export async function horasDasPecas(sql, itens = null) {
  try {
    const linhas = itens ? await sql`SELECT item, to_char(publicar_hora,'HH24:MI') AS hora FROM vybe_peca_complemento WHERE publicar_hora IS NOT NULL AND item = ANY(${itens}::text[])`
      : await sql`SELECT item, to_char(publicar_hora,'HH24:MI') AS hora FROM vybe_peca_complemento WHERE publicar_hora IS NOT NULL LIMIT 20000`;
    return Object.fromEntries(linhas.map((l) => [l.item, l.hora]));
  } catch (e) { if (semTabela(e)) return {}; throw e; }
}
export async function salvarHoraDaPeca(sql, quem, b = {}) {
  const item = String(b.item ?? ''); if (!ITEM.test(item)) falhar('Peça inválida.');
  const hora = b.publicar_hora == null || b.publicar_hora === '' ? null : String(b.publicar_hora);
  if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) falhar('Hora no formato HH:MM.');
  await sql`INSERT INTO vybe_peca_complemento (item, publicar_hora, atualizado_por) VALUES (${item}, ${hora}::time, ${quem.id})
    ON CONFLICT (item) DO UPDATE SET publicar_hora=EXCLUDED.publicar_hora, atualizado_por=EXCLUDED.atualizado_por, atualizado_em=now()`;
  return { item, publicar_hora: hora };
}
export async function areaPecaComplemento(req, res, quem, sql) {
  if (quem?.tipo !== 'sessao' || !quem.pessoa?.id) return res.status(403).json({ error: 'Exige uma sessão pessoal.' });
  try {
    await garantirMigracoesCampos(sql);
    if (req.method === 'GET') {
      const itens = req.query?.itens ? String(req.query.itens).split(',').map((s) => s.trim()).filter((s) => ITEM.test(s)).slice(0, 2000) : null;
      return res.status(200).json({ ok: true, horas: await horasDasPecas(sql, itens) });
    }
    if (req.method === 'POST') return res.status(200).json({ ok: true, ...await salvarHoraDaPeca(sql, quem.pessoa, req.body || {}) });
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (e) {
    if (semTabela(e)) return res.status(503).json({ error: 'A hora de publicação ainda não foi provisionada (migração 2026-11-14-campos-d3.sql).', migracao_pendente: true });
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível gravar a hora.' });
  }
}
