// Séries históricas dos quadros D3 (Paulo, 14/11/2026): o servidor guarda, uma vez por dia, os números que os cartões
// desenham em linha, e devolve a série de cada área. Tabela: vybe_serie_diaria (server/migracoes-historico.js).
//
//   GET  /api/painel?area=series&para=setor|performance|carteira|cliente&id=|pessoas|agentes|comercial
//   POST /api/painel?area=series { acao: 'limite_carga' | 'meta_acerto' | 'acerto' | 'gravar' }
//
// Quem grava e quando
//  - gravarSeriesDoDia(sql): uma vez por dia. Chamado pelo cron das 03:00 UTC (00:00 de Irecê, /api/mirror-reconcile) e,
//    se o cron ainda não gravou o dia, pelo primeiro GET de area=series. Uma linha-marca (serie 'gravacao', sujeito 'dia')
//    garante que só uma chamada calcula; se ela falhar, a próxima tenta de novo.
//  - As contas são as MESMAS das telas, rodadas aqui num vm (como server/assistente-rotinas.js faz com o gerador do resumo):
//    vybe-dono-metricas.js (VybeDono.calcular: atrasadas e peças abertas por pessoa, com Produção como DADOS_ALL) e
//    vybe-carteira-saude.js (VybeCarteiraSaude.calcular: a nota de saúde de cada cliente, com os sinais e o clima do
//    servidor). O score por semana é scoresDoPeriodo (server/pessoas.js, a conta do RH). Nada aqui inventa regra.
//  - acerto_agente: o acerto mora na central do VYBES (core/perfil-agente.js), não no banco do Vybe OS. A tela dos Agentes
//    manda o acerto que leu (POST acao=acerto); o servidor guarda um valor por agente por dia (o último do dia vale).
//
// Séries (sujeito → valor)
//   atrasadas      agencia     → peças atrasadas agora (Produção, clientes ativos)       extra { furos, emRisco, prazoInternoVencido }
//   carga          <pessoa id> → peças abertas da pessoa (sem pausadas nem esquecidas)    extra { nome, atrasadas }
//   saude          <cliente id>→ nota 0–100 da Carteira                                    extra { nome, risco }
//   saude_media    carteira    → média das notas                                           extra { total, alto, medio, baixo }
//   clima          <cliente id>→ pontos do clima do grupo (−20 a +10)                      extra { motivo, atualizado_em }
//   score_semana   <pessoa id> → score da semana (dia = segunda); 'equipe' = média         extra { nome, entregues, meta }
//   acerto_agente  <setor>     → acerto em 7 dias, 0–100 (a central)                       extra { origem: 'tela_central' }
//   carga_cargo    <cargo>     → peças abertas do cargo (Produção)                         extra { capacidade }
//   funil_abertas  funil       → oportunidades abertas no fim do dia
//   leads_semana   funil       → oportunidades que entraram na semana (dia = segunda)
//
// O passado (uma vez, linha-marca 'reconstrucao'/'v1'; nunca sobrescreve o que já existe), sempre com extra.origem:
//   - atrasadas, carga e carga_cargo: os snapshots do Diário (vybe_operational_snapshots, area=diario), que guardam as
//     peças de cada dia com status, datas e responsáveis ('snapshot_diario'). O cadastro de clientes e os cargos usados são
//     os de hoje; o snapshot não guarda a hora da troca de status, então o risco de furo do passado não é reconstruído.
//   - saude e saude_media: vybe_carteira_saude_mensal, a nota que a Carteira guardou em cada mês ('saude_mensal').
//   - score_semana: as 12 semanas anteriores pelo histórico de status (vybe_conteudo_eventos), a mesma conta do RH
//     ('historico_status'; as atrasadas da conta usam o status de hoje).
//   - funil_abertas (90 dias) e leads_semana (26 semanas): criado_em e encerrado_em das oportunidades ('crm').
//   - clima e acerto_agente: sem passado guardado; começam agora.
//
// Configurações (vybe_carteira_config; só os quatro donos gravam):
//   limite_carga        { padrao: n, pessoas: { "<vybe_pessoas.id>": n } }  — o limite de peças abertas por pessoa
//   meta_acerto_agentes { meta: n }                                         — a meta de acerto dos agentes (0–100)
// Nada aqui mexe em dinheiro, envia mensagem ou altera dado de outra tabela.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { garantirMigracoesHistorico } from './migracoes-historico.js';
import { codigoDoPainel } from './assistente-rotinas.js';
import { sinaisDaCarteira } from './carteira.js';
import { scoresDoPeriodo, ehGestao } from './pessoas.js';
import { ehDonoPessoa } from './donos.js';
import { BOARD_PRODUCAO, BOARD_DEMANDAS } from './grupos.js';

const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };
export const hojeBahia = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(agora);
const somarDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const segundaDe = (iso) => somarDias(iso, -((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7));
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const diaTexto = (v) => { if (v == null || v === '') return ''; if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString().slice(0, 10) : ''; const s = String(v).slice(0, 10); return ISO.test(s) ? s : ''; };
const json = (v) => (typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v);
const semTabela = (e) => e?.code === '42P01' || e?.code === '42703';
export const SERIES = Object.freeze(['atrasadas', 'carga', 'saude', 'saude_media', 'clima', 'score_semana', 'acerto_agente', 'carga_cargo', 'funil_abertas', 'leads_semana']);
export const LIMITE_CARGA_PADRAO = 8;
export const META_ACERTO_PADRAO = 75;

// ── As contas das telas, num vm (uma vez por instância) ─────────────────────────────────────────────────────────────
let motor = null;
export function motorDasContas() {
  if (motor) return motor;
  const ctx = vm.createContext({ window: {} });
  for (const arq of ['vybe-dono-metricas.js', 'vybe-carteira-saude.js']) vm.runInContext(readFileSync(join(process.cwd(), arq), 'utf8'), ctx, { filename: arq });
  const dono = ctx.VybeDono || ctx.window.VybeDono, saude = ctx.VybeCarteiraSaude || ctx.window.VybeCarteiraSaude;
  if (!dono?.calcular || !saude?.calcular) throw new Error('Contas do painel não carregaram (vybe-dono-metricas.js / vybe-carteira-saude.js).');
  // O status de Solicitações passa pela mesma tradução do painel (operationalFlowStatus); sem ela, o rótulo do banco.
  let statusDe = (i) => i.status;
  try { const { ctx: painel } = codigoDoPainel(); if (typeof painel.operationalFlowStatus === 'function') statusDe = (i) => painel.operationalFlowStatus(i) || i.status; } catch { /* rótulo do banco */ }
  motor = { dono, saude, statusDe };
  return motor;
}
const limpo = (x) => JSON.parse(JSON.stringify(x)); // sai do vm como objeto comum

// ── Leituras do banco para as contas ───────────────────────────────────────────────────────────────────────────────
// As peças no formato que a tela entrega às contas (o mesmo de itensDoDia, server/assistente-rotinas.js), num recorte
// que cobre o que as contas olham: abertas, entregues nos últimos 70 dias e datas dos últimos 90.
export async function pecasDoBanco(sql, dia) {
  const desdeStatus = somarDias(dia, -70), desdeData = somarDias(dia, -90);
  const linhas = await sql`SELECT c.id::text, c.monday_item_id, c.board_id::text, c.titulo, c.formato,
      to_char(c.prazo,'YYYY-MM-DD') AS prazo, to_char(c.veiculacao,'YYYY-MM-DD') AS veiculacao,
      to_char(c.status_em AT TIME ZONE 'America/Bahia','YYYY-MM-DD"T"HH24:MI') AS status_em,
      to_char(c.criado_em AT TIME ZONE 'America/Bahia','YYYY-MM-DD"T"HH24:MI') AS criado_em,
      s.rotulo AS status, COALESCE(s.final, false) AS final,
      COALESCE(ARRAY(SELECT cl.nome FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id WHERE cc.conteudo_id = c.id ORDER BY cl.nome), '{}') AS clientes,
      COALESCE(ARRAY(SELECT p.monday_user_id::text FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id = c.id AND p.monday_user_id IS NOT NULL ORDER BY r.ordem), '{}') AS responsavel_ids,
      COALESCE(ARRAY(SELECT p.nome FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id = c.id ORDER BY r.ordem), '{}') AS responsaveis
    FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE c.removido_em IS NULL AND c.board_id IN (${BOARD_PRODUCAO}, ${BOARD_DEMANDAS})
      AND (NOT COALESCE(s.final, false) OR c.status_em >= ${desdeStatus}::date OR COALESCE(c.veiculacao, c.prazo) >= ${desdeData}::date)`;
  const { statusDe } = motorDasContas();
  return linhas.map((l) => {
    const pedido = String(l.board_id) === String(BOARD_DEMANDAS);
    const base = { id: l.monday_item_id ? String(l.monday_item_id) : 'vybe:' + l.id, nome: l.titulo || '', cliente: l.clientes[0] || '', clientes: l.clientes,
      status: l.status || '', prazo_iso: l.prazo || '', responsavel: l.responsaveis.join(', '), responsavel_ids: l.responsavel_ids.map(String),
      formato: l.formato || '', status_updated_at: l.status_em || '', criado_em: l.criado_em || '', board_id: Number(l.board_id) };
    const item = pedido ? { ...base, origem: 'solicitacao', conclusao_iso: l.veiculacao || '', veiculacao_iso: l.veiculacao || base.prazo_iso }
      : { ...base, origem: 'producao_conteudo', veiculacao_iso: l.veiculacao || '' };
    try { item.status = statusDe(item) || item.status; } catch { /* fica o rótulo */ }
    return item;
  });
}
// O cadastro de clientes como a tela passa (CADASTRO_CLIENTES): ativo, status, "não é cliente", heads e os campos que a nota lê.
const CAMPOS_CADASTRO = ['id', 'nome', 'ativo', 'status', 'nao_e_cliente', 'responsavel', 'planejamento_url', 'nps', 'nps_em', 'ultima_reuniao',
  'fim_contrato', 'contrato_fim', 'contrato_ate', 'pagamento_atrasado', 'pagamento', 'situacao_pagamento'];
export async function cadastroDeClientes(sql) {
  const linhas = await sql`SELECT to_jsonb(c) AS c,
      (SELECT string_agg(p.nome, ', ' ORDER BY cp.ordem, p.nome) FROM vybe_cliente_pessoas cp JOIN vybe_pessoas p ON p.id = cp.pessoa_id WHERE cp.cliente_id = c.id) AS heads
    FROM vybe_clientes c WHERE c.apagado_em IS NULL`;
  return linhas.map((l) => { const c = json(l.c) || {}; const o = {}; for (const k of CAMPOS_CADASTRO) if (k in c) o[k] = c[k]; o.id = String(o.id); o.heads = l.heads || ''; return o; });
}
async function equipe(sql) {
  let linhas;
  try { linhas = await sql`SELECT p.id::text, p.monday_user_id::text AS monday, p.nome, f.funcao FROM vybe_pessoas p LEFT JOIN vybe_escritorio_funcoes f ON f.pessoa_id = p.id`; }
  catch (e) { if (!semTabela(e)) throw e; linhas = await sql`SELECT id::text, monday_user_id::text AS monday, nome, NULL AS funcao FROM vybe_pessoas`; }
  const porMonday = new Map(), nomes = {};
  for (const p of linhas) if (p.monday) { porMonday.set(String(p.monday), p); nomes[String(p.monday)] = p.nome || ''; }
  return { porMonday, nomes };
}
async function climaAtual(sql) {
  try { return (await sql`SELECT cliente_id::text, pontos, motivo, atualizado_em FROM vybe_carteira_clima`); } catch (e) { if (semTabela(e)) return []; throw e; }
}
async function capacidades(sql) {
  try { return Object.fromEntries((await sql`SELECT cargo, capacidade_mensal FROM vybe_comercial_capacidade`).map((l) => [l.cargo, Number(l.capacidade_mensal) || 0])); }
  catch (e) { if (semTabela(e)) return {}; throw e; }
}

// ── As contas de um dia ────────────────────────────────────────────────────────────────────────────────────────────
// Atrasadas, carga por pessoa e carga por cargo a partir de uma lista de peças de Produção (do banco hoje; do snapshot no passado).
function contasDeProducao({ pecas, cadastro, eq, dia, comRisco = true }) {
  const { dono } = motorDasContas();
  const r = limpo(dono.calcular({ demandas: pecas, clientes: cadastro, pessoas: eq.nomes, hoje: dia }));
  const linhas = [{ serie: 'atrasadas', sujeito: 'agencia', valor: r.hoje.atrasadas,
    extra: { furos: r.hoje.furos, prazoInternoVencido: r.hoje.prazoInternoVencido, ...(comRisco ? { emRisco: r.hoje.emRisco } : {}) } }];
  for (const t of r.time || []) {
    const p = eq.porMonday.get(String(t.pessoaId));
    linhas.push({ serie: 'carga', sujeito: p ? p.id : 'monday:' + t.pessoaId, valor: t.abertas, extra: { nome: p?.nome || t.pessoa, atrasadas: t.atrasadas, monday: String(t.pessoaId) } });
  }
  // Carga por cargo (Comercial, capacidade × vendas): as abertas de Produção de cada responsável, pelo cargo dele
  // (vybe_escritorio_funcoes), cada peça uma vez por pessoa — a mesma conta de capacidadeTime (shared/comercial-calculos.js).
  const porCargo = {};
  for (const d of pecas) {
    if (dono.util.entregue(d.status)) continue;
    for (const id of new Set(d.responsavel_ids || [])) { const c = eq.porMonday.get(String(id))?.funcao; if (c) porCargo[c] = (porCargo[c] || 0) + 1; }
  }
  for (const [cargo, n] of Object.entries(porCargo)) linhas.push({ serie: 'carga_cargo', sujeito: cargo, valor: n, extra: {} });
  return linhas;
}

export async function calcularDia(sql, dia = hojeBahia()) {
  const linhas = [], erros = [];
  const parte = async (nome, f) => { try { linhas.push(...(await f())); } catch (e) { erros.push(`${nome}: ${e.message}`); } };
  let pecas = null, cadastro = null, eq = null;
  await parte('base', async () => { [pecas, cadastro, eq] = await Promise.all([pecasDoBanco(sql, dia), cadastroDeClientes(sql), equipe(sql)]); return []; });
  if (pecas) {
    await parte('producao', async () => {
      const prod = pecas.filter((p) => p.origem !== 'solicitacao');
      const l = contasDeProducao({ pecas: prod, cadastro, eq, dia });
      const cap = await capacidades(sql);
      for (const x of l) if (x.serie === 'carga_cargo') x.extra.capacidade = cap[x.sujeito] ?? null;
      return l;
    });
    await parte('saude', async () => {
      const { saude } = motorDasContas();
      const [sinais, clima] = await Promise.all([sinaisDaCarteira(sql, dia).catch(() => null), climaAtual(sql)]);
      const porCliente = Object.fromEntries(clima.map((c) => [c.cliente_id, { pontos: Number(c.pontos), motivo: c.motivo || '', atualizado_em: c.atualizado_em }]));
      const r = limpo(saude.calcular({ demandas: pecas, clientes: cadastro, sinais, clima: { porCliente }, hoje: dia }));
      const l = r.clientes.filter((c) => c.id).map((c) => ({ serie: 'saude', sujeito: c.id, valor: c.score, extra: { nome: c.nome, risco: c.risco } }));
      if (r.resumo?.media != null) l.push({ serie: 'saude_media', sujeito: 'carteira', valor: r.resumo.media, extra: { total: r.resumo.total, alto: r.resumo.alto, medio: r.resumo.medio, baixo: r.resumo.baixo } });
      for (const c of clima) if (Number.isFinite(Number(c.pontos))) l.push({ serie: 'clima', sujeito: c.cliente_id, valor: Number(c.pontos), extra: { motivo: c.motivo || '', atualizado_em: c.atualizado_em } });
      return l;
    });
  }
  await parte('score', async () => linhasDeScore(await scoresDoPeriodo(sql, { de: segundaDe(dia), ate: somarDias(segundaDe(dia), 6), hoje: dia }), segundaDe(dia)));
  await parte('funil', async () => {
    const [a] = await sql`SELECT count(*)::int AS n FROM vybe_crm_oportunidades WHERE etapa NOT IN ('ganho','perdido') AND encerrado_em IS NULL`;
    const ini = segundaDe(dia);
    const [s] = await sql`SELECT count(*)::int AS n FROM vybe_crm_oportunidades WHERE (criado_em AT TIME ZONE 'America/Bahia')::date BETWEEN ${ini}::date AND ${dia}::date`;
    return [{ serie: 'funil_abertas', sujeito: 'funil', valor: a.n, extra: {} }, { serie: 'leads_semana', sujeito: 'funil', valor: s.n, extra: {}, dia: ini }];
  });
  return { linhas, erros };
}
function linhasDeScore(lista, segunda) {
  const comScore = lista.filter((p) => p.score != null);
  const l = lista.map((p) => ({ serie: 'score_semana', sujeito: String(p.id), valor: p.score, extra: { nome: p.nome, entregues: p.entregues, meta: p.meta }, dia: segunda }));
  if (comScore.length) l.push({ serie: 'score_semana', sujeito: 'equipe', valor: Math.round(comScore.reduce((t, p) => t + p.score, 0) / comScore.length), extra: { pessoas: comScore.length }, dia: segunda });
  return l;
}

// ── Escrita ────────────────────────────────────────────────────────────────────────────────────────────────────────
// sobrescrever=true: a gravação do dia (a linha de hoje e a da semana corrente mudam até o dia acabar).
// sobrescrever=false: a reconstrução do passado (nunca troca o que já está guardado).
export async function gravarLinhas(sql, dia, linhas, { origem, sobrescrever = true } = {}) {
  const corpo = linhas.filter((x) => SERIES.includes(x.serie) && x.sujeito != null && String(x.sujeito).length <= 80)
    .map((x) => ({ dia: x.dia || dia, serie: x.serie, sujeito: String(x.sujeito), valor: x.valor == null || !Number.isFinite(Number(x.valor)) ? null : Number(x.valor), extra: { ...(x.extra || {}), origem: x.extra?.origem || origem } }));
  for (let i = 0; i < corpo.length; i += 400) {
    const lote = JSON.stringify(corpo.slice(i, i + 400));
    if (sobrescrever) await sql`INSERT INTO vybe_serie_diaria (dia, serie, sujeito, valor, extra)
        SELECT x.dia::date, x.serie, x.sujeito, x.valor, COALESCE(x.extra, '{}'::jsonb) FROM jsonb_to_recordset(${lote}::jsonb) AS x(dia text, serie text, sujeito text, valor numeric, extra jsonb)
        ON CONFLICT (dia, serie, sujeito) DO UPDATE SET valor = EXCLUDED.valor, extra = EXCLUDED.extra, gravado_em = now()`;
    else await sql`INSERT INTO vybe_serie_diaria (dia, serie, sujeito, valor, extra)
        SELECT x.dia::date, x.serie, x.sujeito, x.valor, COALESCE(x.extra, '{}'::jsonb) FROM jsonb_to_recordset(${lote}::jsonb) AS x(dia text, serie text, sujeito text, valor numeric, extra jsonb)
        ON CONFLICT (dia, serie, sujeito) DO NOTHING`;
  }
  return corpo.length;
}
// A linha-marca: devolve true só para quem conseguiu "pegar" o trabalho (nenhuma marca; ou a anterior falhou; ou ficou
// presa em 'gravando' há mais de 10 minutos). serie 'gravacao' / 'reconstrucao' ficam fora de SERIES: a leitura não as mostra.
async function pegarMarca(sql, dia, serie, sujeito, forcar = false) {
  const extra = JSON.stringify({ estado: 'gravando' });
  const r = forcar
    ? await sql`INSERT INTO vybe_serie_diaria (dia, serie, sujeito, valor, extra) VALUES (${dia}::date, ${serie}, ${sujeito}, NULL, ${extra}::jsonb)
        ON CONFLICT (dia, serie, sujeito) DO UPDATE SET extra = EXCLUDED.extra, gravado_em = now() RETURNING dia`
    : await sql`INSERT INTO vybe_serie_diaria (dia, serie, sujeito, valor, extra) VALUES (${dia}::date, ${serie}, ${sujeito}, NULL, ${extra}::jsonb)
        ON CONFLICT (dia, serie, sujeito) DO UPDATE SET extra = EXCLUDED.extra, gravado_em = now()
        WHERE vybe_serie_diaria.extra->>'estado' = 'erro' OR (vybe_serie_diaria.extra->>'estado' = 'gravando' AND vybe_serie_diaria.gravado_em < now() - interval '10 minutes')
        RETURNING dia`;
  return r.length > 0;
}
const fecharMarca = (sql, dia, serie, sujeito, extra) => sql`UPDATE vybe_serie_diaria SET extra = ${JSON.stringify(extra)}::jsonb, gravado_em = now()
  WHERE dia = ${dia}::date AND serie = ${serie} AND sujeito = ${sujeito}`;

// A gravação do dia. origem: 'cron' | 'leitura' | 'manual'. Devolve { gravado, ja, linhas, erros, reconstrucao }.
// reconstruir: true no cron e no POST acao=gravar do dono (um lote do passado, com orçamento de tempo, DEPOIS do dia);
// false no GET das telas, que só grava o dia (leve).
export async function gravarSeriesDoDia(sql, { dia = hojeBahia(), origem = 'cron', forcar = false, reconstruir = true, orcamentoMs = 8000 } = {}) {
  await garantirMigracoesHistorico(sql);
  let r;
  if (!(await pegarMarca(sql, dia, 'gravacao', 'dia', forcar))) r = { gravado: false, ja: true, dia };
  else {
    try {
      const { linhas, erros } = await calcularDia(sql, dia);
      const n = await gravarLinhas(sql, dia, linhas, { origem: 'calculo_diario' });
      await fecharMarca(sql, dia, 'gravacao', 'dia', { estado: erros.length && !n ? 'erro' : 'ok', origem, linhas: n, erros });
      r = { gravado: true, dia, linhas: n, erros };
    } catch (e) {
      await fecharMarca(sql, dia, 'gravacao', 'dia', { estado: 'erro', origem, erros: [e.message] }).catch(() => {});
      if (!reconstruir) throw e;
      r = { gravado: false, dia, erros: [e.message] };
    }
  }
  if (reconstruir) r.reconstrucao = await reconstruirPassado(sql, dia, { orcamentoMs }).catch((e) => ({ erro: e.message }));
  return r;
}
// O primeiro GET do dia em cada instância confere (e grava só o dia, se o cron não gravou); os seguintes não perguntam.
let conferido = '';
export async function garantirGravacaoDoDia(sql) {
  const dia = hojeBahia();
  if (conferido === dia) return null;
  const r = await gravarSeriesDoDia(sql, { dia, origem: 'leitura', reconstruir: false });
  conferido = dia;
  return r;
}
export function esquecerConferencia() { conferido = ''; motor = null; }

// ── O passado que já está no banco, em lotes ───────────────────────────────────────────────────────────────────────
// Uma linha-marca por banco (dia 2000-01-01, serie 'reconstrucao', sujeito 'v1') guarda o progresso. Cada chamada pega a
// marca (ninguém mais trabalha ao mesmo tempo; marca presa em 'trabalhando' há mais de 2 minutos é retomada), faz
// unidades (um dia de snapshot, uma semana de score, a nota mensal, o CRM) até o orçamento de tempo acabar (pelo menos
// uma por chamada) e grava onde parou. A data de referência é a do início, para a janela não andar entre os lotes.
const MARCA_DIA = '2000-01-01';
export async function reconstrucaoAtual(sql) {
  const [l] = await sql`SELECT extra FROM vybe_serie_diaria WHERE dia = ${MARCA_DIA}::date AND serie = 'reconstrucao' AND sujeito = 'v1'`;
  return l ? json(l.extra) : null;
}
export async function reconstruirPassado(sql, hoje = hojeBahia(), { orcamentoMs = 8000, relogio = Date.now } = {}) {
  await sql`INSERT INTO vybe_serie_diaria (dia, serie, sujeito, valor, extra) VALUES (${MARCA_DIA}::date, 'reconstrucao', 'v1', NULL,
      ${JSON.stringify({ estado: 'parcial', referencia: hoje, progresso: {} })}::jsonb) ON CONFLICT (dia, serie, sujeito) DO NOTHING`;
  const pegou = await sql`UPDATE vybe_serie_diaria SET extra = jsonb_set(extra, '{estado}', '"trabalhando"'::jsonb), gravado_em = now()
    WHERE dia = ${MARCA_DIA}::date AND serie = 'reconstrucao' AND sujeito = 'v1' AND extra->>'estado' <> 'ok'
      AND NOT (extra->>'estado' = 'trabalhando' AND gravado_em > now() - interval '2 minutes') RETURNING extra`;
  if (!pegou.length) { const a = await reconstrucaoAtual(sql); return { ja: a?.estado === 'ok', emAndamento: a?.estado === 'trabalhando' }; }
  const m = json(pegou[0].extra) || {}, ref = m.referencia || hoje, P = { ...(m.progresso || {}) }, erros = [...(m.erros || [])].slice(-20);
  const limite = relogio() + Math.max(0, orcamentoMs);
  let unidades = 0;
  const pode = () => unidades === 0 || relogio() < limite;
  const unidade = async (nome, f) => { try { await f(); } catch (e) { erros.push(`${nome}: ${e.message}`); } unidades++; };
  const pronto = () => Boolean(P.snapFeito && P.saudeFeito && P.scoreFeito && P.crmFeito);
  try {
    // 1. Snapshots do Diário, um dia por unidade, do mais antigo ao mais novo.
    if (!P.snapFeito && pode()) {
      let dias = [];
      try { dias = (await sql`SELECT to_char(data_referencia,'YYYY-MM-DD') AS dia FROM vybe_operational_snapshots WHERE data_referencia >= ${somarDias(ref, -120)}::date AND data_referencia < ${ref}::date ORDER BY data_referencia`).map((x) => x.dia); }
      catch (e) { if (!semTabela(e)) throw e; }
      const falta = dias.filter((d) => !P.snap || d > P.snap);
      let base = null;
      for (const d of falta) {
        if (!pode()) break;
        await unidade('snapshot ' + d, async () => { base ||= await Promise.all([cadastroDeClientes(sql), equipe(sql)]); await doDiaDoDiario(sql, d, base[0], base[1]); });
        P.snap = d; P.snapDias = (P.snapDias || 0) + 1;
      }
      if (falta.every((d) => d <= (P.snap || ''))) P.snapFeito = true;
    }
    // 2. A nota mensal da Carteira (uma unidade).
    if (!P.saudeFeito && pode()) { await unidade('saude_mensal', () => daSaudeMensal(sql)); P.saudeFeito = true; }
    // 3. Score: 12 semanas, uma por unidade, da mais antiga para a mais nova.
    if (!P.scoreFeito) {
      let k = P.scoreK ?? 12;
      while (k >= 1 && pode()) { const kk = k; await unidade('score', () => umaSemanaDeScore(sql, ref, kk)); k--; }
      P.scoreK = k; if (k < 1) P.scoreFeito = true;
    }
    // 4. CRM (uma unidade).
    if (!P.crmFeito && pode()) { await unidade('crm', () => doCrm(sql, ref)); P.crmFeito = true; }
  } finally {
    await sql`UPDATE vybe_serie_diaria SET extra = ${JSON.stringify({ estado: pronto() ? 'ok' : 'parcial', referencia: ref, progresso: P, erros })}::jsonb, gravado_em = now()
      WHERE dia = ${MARCA_DIA}::date AND serie = 'reconstrucao' AND sujeito = 'v1'`;
  }
  return { estado: pronto() ? 'ok' : 'parcial', unidades, progresso: P, erros };
}

async function doDiaDoDiario(sql, dia, cadastro, eq) {
  // O status do snapshot já é o rótulo; a regra de entregue é a das contas (VybeDono), como na tela.
  const [s] = await sql`SELECT payload->'itens' AS itens FROM vybe_operational_snapshots WHERE data_referencia = ${dia}::date`;
  const itens = (json(s?.itens) || []).filter((i) => String(i.board_id) === String(BOARD_PRODUCAO)).map((i) => ({
    id: i.atividade_id || i.id, nome: i.nome, cliente: i.cliente, clientes: i.clientes || [], status: i.status || '', prazo_iso: i.prazo_iso || '', veiculacao_iso: i.veiculacao_iso || '',
    responsavel: i.responsavel || '', responsavel_ids: (i.responsavel_ids || []).map(String), origem: 'producao_conteudo' }));
  if (!itens.length) return 0;
  return gravarLinhas(sql, dia, contasDeProducao({ pecas: itens, cadastro, eq, dia, comRisco: false }), { origem: 'snapshot_diario', sobrescrever: false });
}
async function umaSemanaDeScore(sql, ref, k) {
  const de = somarDias(segundaDe(ref), -7 * k), ate = somarDias(de, 6);
  return gravarLinhas(sql, de, linhasDeScore(await scoresDoPeriodo(sql, { de, ate, hoje: somarDias(ate, 1) }), de), { origem: 'historico_status', sobrescrever: false });
}
async function daSaudeMensal(sql) {
  let linhas;
  try { linhas = await sql`SELECT s.cliente_id::text, s.score, s.risco, to_char(s.mes,'YYYY-MM') AS mes, to_char(s.registrado_em AT TIME ZONE 'America/Bahia','YYYY-MM-DD') AS dia, c.nome
      FROM vybe_carteira_saude_mensal s JOIN vybe_clientes c ON c.id = s.cliente_id WHERE s.score IS NOT NULL`; }
  catch (e) { if (semTabela(e)) return { linhas: 0 }; throw e; }
  const porMes = new Map();
  const l = linhas.filter((x) => ISO.test(x.dia || '')).map((x) => {
    const m = porMes.get(x.mes) || { dia: x.dia, notas: [] }; if (x.dia > m.dia) m.dia = x.dia; m.notas.push(Number(x.score)); porMes.set(x.mes, m);
    return { serie: 'saude', sujeito: x.cliente_id, valor: Number(x.score), extra: { nome: x.nome, risco: x.risco, mes: x.mes }, dia: x.dia };
  });
  for (const [mes, m] of porMes) l.push({ serie: 'saude_media', sujeito: 'carteira', valor: Math.round(m.notas.reduce((a, b) => a + b, 0) / m.notas.length), extra: { total: m.notas.length, mes }, dia: m.dia });
  return { linhas: await gravarLinhas(sql, null, l, { origem: 'saude_mensal', sobrescrever: false }) };
}
async function doCrm(sql, hoje) {
  let abertas, leads;
  try {
    abertas = await sql`SELECT to_char(d,'YYYY-MM-DD') AS dia,
        (SELECT count(*)::int FROM vybe_crm_oportunidades o WHERE (o.criado_em AT TIME ZONE 'America/Bahia')::date <= d::date
          AND (o.encerrado_em IS NULL OR (o.encerrado_em AT TIME ZONE 'America/Bahia')::date > d::date)
          AND NOT (o.etapa IN ('ganho','perdido') AND o.encerrado_em IS NULL)) AS n
      FROM generate_series(${somarDias(hoje, -90)}::date, ${somarDias(hoje, -1)}::date, interval '1 day') AS d`;
    leads = await sql`SELECT to_char(date_trunc('week', (criado_em AT TIME ZONE 'America/Bahia')::date),'YYYY-MM-DD') AS dia, count(*)::int AS n
      FROM vybe_crm_oportunidades WHERE (criado_em AT TIME ZONE 'America/Bahia')::date >= ${somarDias(segundaDe(hoje), -7 * 26)}::date
        AND (criado_em AT TIME ZONE 'America/Bahia')::date < ${segundaDe(hoje)}::date GROUP BY 1`;
  } catch (e) { if (semTabela(e)) return { linhas: 0 }; throw e; }
  // Semana sem lead também é dado (zero), a partir da primeira semana com lead.
  const porSemana = new Map(leads.map((l) => [l.dia, l.n])), l = [];
  const primeira = [...porSemana.keys()].sort()[0];
  if (primeira) for (let s = primeira; s < segundaDe(hoje); s = somarDias(s, 7)) l.push({ serie: 'leads_semana', sujeito: 'funil', valor: porSemana.get(s) || 0, extra: {}, dia: s });
  const temAlguma = abertas.some((a) => a.n > 0);
  if (temAlguma) for (const a of abertas) l.push({ serie: 'funil_abertas', sujeito: 'funil', valor: a.n, extra: {}, dia: a.dia });
  return { linhas: await gravarLinhas(sql, null, l, { origem: 'crm', sobrescrever: false }) };
}

// ── Configurações (vybe_carteira_config; só os donos gravam) ───────────────────────────────────────────────────────
async function lerConfig(sql, chave) {
  try { const [l] = await sql`SELECT valor FROM vybe_carteira_config WHERE chave = ${chave}`; return l ? json(l.valor) : null; }
  catch (e) { if (semTabela(e)) return null; throw e; }
}
export async function limiteCarga(sql) {
  const v = await lerConfig(sql, 'limite_carga') || {};
  const padrao = Number.isInteger(Number(v.padrao)) && Number(v.padrao) > 0 ? Number(v.padrao) : LIMITE_CARGA_PADRAO;
  const pessoas = {}; for (const [id, n] of Object.entries(v.pessoas || {})) if (/^[1-9]\d{0,15}$/.test(id) && Number(n) > 0) pessoas[id] = Number(n);
  return { padrao, pessoas, configurado: Boolean(v.padrao || Object.keys(pessoas).length) };
}
export async function metaAcerto(sql) {
  const v = await lerConfig(sql, 'meta_acerto_agentes') || {};
  const meta = Number(v.meta);
  return { meta: Number.isFinite(meta) && meta > 0 && meta <= 100 ? meta : META_ACERTO_PADRAO, configurado: Number.isFinite(meta) && meta > 0 };
}
async function gravarConfig(sql, quem, chave, valor) {
  await sql`INSERT INTO vybe_carteira_config (chave, valor, atualizado_em, atualizado_por) VALUES (${chave}, ${JSON.stringify(valor)}::jsonb, now(), ${quem?.pessoa?.id ?? null})
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now(), atualizado_por = EXCLUDED.atualizado_por`;
}
const inteiro = (v, campo, min, max) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) falhar(`${campo}: use um número inteiro de ${min} a ${max}.`); return n; };

// ── Leitura por área ───────────────────────────────────────────────────────────────────────────────────────────────
// Uma série = [{ dia, valor }] da mais antiga para a mais nova (valor null = sem dado). `origem` diz de onde veio o
// primeiro ponto (para a tela dizer "desde quando" e "de onde").
async function lerSerie(sql, serie, { sujeitos = null, desde }) {
  const linhas = sujeitos
    ? await sql`SELECT to_char(dia,'YYYY-MM-DD') AS dia, sujeito, valor::float8 AS valor, extra FROM vybe_serie_diaria
        WHERE serie = ${serie} AND sujeito = ANY(${sujeitos}::text[]) AND dia >= ${desde}::date ORDER BY dia`
    : await sql`SELECT to_char(dia,'YYYY-MM-DD') AS dia, sujeito, valor::float8 AS valor, extra FROM vybe_serie_diaria
        WHERE serie = ${serie} AND dia >= ${desde}::date ORDER BY dia`;
  const por = {};
  for (const l of linhas) {
    const x = por[l.sujeito] ||= { sujeito: l.sujeito, nome: '', pontos: [], origens: [] };
    const e = json(l.extra) || {};
    if (e.nome) x.nome = e.nome;
    if (e.monday) x.monday = String(e.monday);
    x.pontos.push({ dia: l.dia, valor: l.valor, ...(e.risco ? { risco: e.risco } : {}), ...(e.capacidade != null ? { capacidade: e.capacidade } : {}),
      ...(e.emRisco != null ? { emRisco: e.emRisco } : {}), ...(e.furos != null ? { furos: e.furos } : {}) });
    if (e.origem && !x.origens.includes(e.origem)) x.origens.push(e.origem);
  }
  return por;
}
// Mensal: o último valor de cada mês (a série diária de carga_cargo vira "carga por mês").
const porMes = (pontos) => { const m = new Map(); for (const p of pontos) m.set(p.dia.slice(0, 7), { ...p, mes: p.dia.slice(0, 7) }); return [...m.values()]; };

export async function lerSeries(sql, quem, query = {}) {
  const para = String(query.para || ''), hoje = hojeBahia();
  const base = { ok: true, para, hoje };
  const pessoa = quem?.pessoa || null, servico = quem?.tipo === 'servico';
  const dono = servico || ehDonoPessoa(pessoa);
  switch (para) {
    case 'setor': case 'performance': case 'gestao': {
      const [atr, carga, limite] = await Promise.all([lerSerie(sql, 'atrasadas', { sujeitos: ['agencia'], desde: somarDias(hoje, -60) }),
        lerSerie(sql, 'carga', { desde: somarDias(hoje, -30) }), limiteCarga(sql)]);
      return { ...base, atrasadas: atr.agencia || { sujeito: 'agencia', pontos: [], origens: [] }, carga, limite, pode: { limite: dono } };
    }
    case 'carteira': {
      const [media, saude] = await Promise.all([lerSerie(sql, 'saude_media', { sujeitos: ['carteira'], desde: somarDias(hoje, -365) }),
        lerSerie(sql, 'saude', { desde: somarDias(hoje, -90) })]);
      return { ...base, media: media.carteira || { sujeito: 'carteira', pontos: [], origens: [] }, saude };
    }
    case 'cliente': {
      const id = String(query.id || '');
      if (!/^[1-9]\d{0,15}$/.test(id)) falhar('Informe o cliente.');
      const [s, c] = await Promise.all([lerSerie(sql, 'saude', { sujeitos: [id], desde: somarDias(hoje, -180) }), lerSerie(sql, 'clima', { sujeitos: [id], desde: somarDias(hoje, -180) })]);
      return { ...base, id, saude: s[id] || { sujeito: id, pontos: [], origens: [] }, clima: c[id] || { sujeito: id, pontos: [], origens: [] } };
    }
    case 'pessoas': {
      // O score é da gestão (como o ranking): cada pessoa recebe só a própria linha.
      const gestao = servico || ehGestao(pessoa);
      const eu = pessoa?.id != null ? String(pessoa.id) : '';
      const sujeitos = gestao ? null : eu ? [eu] : [];
      const s = sujeitos && !sujeitos.length ? {} : await lerSerie(sql, 'score_semana', { sujeitos, desde: somarDias(segundaDe(hoje), -7 * 12) });
      return { ...base, gestao, eu, score: s };
    }
    case 'agentes': {
      const [s, meta] = await Promise.all([lerSerie(sql, 'acerto_agente', { desde: somarDias(hoje, -60) }), metaAcerto(sql)]);
      return { ...base, acerto: s, meta, pode: { meta: dono } };
    }
    case 'comercial': {
      const [cg, ab, ld] = await Promise.all([lerSerie(sql, 'carga_cargo', { desde: somarDias(hoje, -400) }),
        lerSerie(sql, 'funil_abertas', { sujeitos: ['funil'], desde: somarDias(hoje, -90) }), lerSerie(sql, 'leads_semana', { sujeitos: ['funil'], desde: somarDias(hoje, -7 * 26) })]);
      for (const x of Object.values(cg)) x.meses = porMes(x.pontos);
      return { ...base, carga: cg, abertas: ab.funil || { sujeito: 'funil', pontos: [], origens: [] }, leads: ld.funil || { sujeito: 'funil', pontos: [], origens: [] } };
    }
    default: falhar('Informe para=setor|performance|carteira|cliente|pessoas|agentes|comercial.');
  }
  return base;
}

export async function escreverSeries(sql, quem, b = {}) {
  const pessoa = quem?.pessoa || null, servico = quem?.tipo === 'servico', dono = servico || ehDonoPessoa(pessoa);
  switch (b.acao) {
    case 'limite_carga': {
      if (!dono) falhar('Só um dono muda o limite de carga.', 403);
      const pessoas = {};
      const entrada = b.pessoas && typeof b.pessoas === 'object' && !Array.isArray(b.pessoas) ? b.pessoas : {};
      if (Object.keys(entrada).length > 200) falhar('Pessoas demais.');
      for (const [id, n] of Object.entries(entrada)) {
        if (!/^[1-9]\d{0,15}$/.test(id)) falhar('Pessoa inválida.');
        if (n == null || n === '') continue; // vazio = volta ao padrão
        pessoas[id] = inteiro(n, 'Limite da pessoa', 1, 100);
      }
      const valor = { padrao: inteiro(b.padrao ?? LIMITE_CARGA_PADRAO, 'Limite padrão', 1, 100), pessoas };
      await gravarConfig(sql, quem, 'limite_carga', valor);
      return { ok: true, limite: await limiteCarga(sql) };
    }
    case 'meta_acerto': {
      if (!dono) falhar('Só um dono muda a meta dos agentes.', 403);
      await gravarConfig(sql, quem, 'meta_acerto_agentes', { meta: inteiro(b.meta, 'Meta', 1, 100) });
      return { ok: true, meta: await metaAcerto(sql) };
    }
    case 'acerto': {
      // A tela dos Agentes manda o acerto que a central calculou (7 dias). Um valor por agente por dia; o último vale.
      if (!servico && !pessoa?.id) falhar('Entre no painel.', 401);
      const ag = b.agentes && typeof b.agentes === 'object' && !Array.isArray(b.agentes) ? b.agentes : null;
      if (!ag) falhar('Envie agentes: { "<setor>": acerto }.');
      const nomes = Object.keys(ag); if (nomes.length > 40) falhar('Agentes demais.');
      const linhas = [];
      for (const setor of nomes) {
        if (!/^[a-z]{2,20}$/.test(setor)) falhar('Setor inválido.');
        const v = Number(ag[setor]); if (!Number.isFinite(v) || v < 0 || v > 100) continue;
        linhas.push({ serie: 'acerto_agente', sujeito: setor, valor: Math.round(v * 10) / 10, extra: { origem: 'tela_central' } });
      }
      return { ok: true, gravados: linhas.length ? await gravarLinhas(sql, hojeBahia(), linhas, { origem: 'tela_central' }) : 0 };
    }
    case 'gravar': {
      if (!dono) falhar('Só um dono pede a gravação de novo.', 403);
      return { ok: true, ...(await gravarSeriesDoDia(sql, { origem: 'manual', forcar: true })) };
    }
    default: falhar('Ação inválida.');
  }
  return { ok: true };
}

export async function areaSeries(req, res, quem, sql) {
  try {
    await garantirMigracoesHistorico(sql);
    if (req.method === 'GET') {
      // Se o cron ainda não gravou o dia, a primeira leitura grava (falha aqui não derruba a leitura).
      await garantirGravacaoDoDia(sql).catch((e) => console.error('[series] gravação do dia na leitura:', e?.message || e));
      return res.status(200).json(await lerSeries(sql, quem, req.query || {}));
    }
    if (req.method === 'POST') return res.status(200).json(await escreverSeries(sql, quem, req.body || {}));
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
}
