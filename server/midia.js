// Mídia (Vinícius, 20/11/2026): o módulo interno onde a gestão acompanha toda a mídia de cada cliente — Meta Ads, Google
// Ads e o tráfego do site — e onde o Ícaro (agente de Mídia Paga, 5º andar) mostra o que pede atenção. Só os quatro donos.
//
// Nada de integração nova: o Meta vem do VybeHub pela mesma ponte do bot (assistente-hub.js, módulo `resumo`). Google Ads
// e site ainda não têm fonte em nenhum sistema da Vybe: o canal aparece como "não conectado", nunca com número zerado.
// O módulo só lê. Mexer em campanha continua fora do sistema, com aprovação de um dono (regra do Ícaro, sombra).
//
//   GET area=midia&acao=carteira                        → clientes ativos e o estado de cada canal
//   GET area=midia&acao=cliente&cliente_id=N&dias=7|30  → o Meta do cliente no período e os últimos registros do cérebro
//   GET area=midia&acao=historico&cliente_id=N          → as últimas 8 semanas do Meta (investido, resultado, custo)
//   GET area=midia&acao=campanhas&cliente_id=N&dias=…   → as campanhas do período com o status de cada uma
//   GET area=midia&acao=semana&cliente_id=N             → o texto do "Resumo da semana" do Hub (o mesmo que o Ícaro manda
//                                                          ao Ewerton na segunda, rotinas.js enviarResumosClientes)
//   GET area=midia&acao=relatorio&cliente_id=N&mes=AAAA-MM → o convite de 10 minutos para o relatório do mês no Hub
//   POST area=midia { acao:'conectar', cliente_id, site?, google_ads? } → grava o site e o ID do Google Ads no cadastro
//
// Mídia: confere e completa (Paulo, 23/11/2026: "não consigo add o site? o google ads? olhar históricos? relatórios? resumo
// da semana do cliente?"). O site e o ID do Google Ads moram no cadastro único do cliente (vybe_clientes.cadastro, JSONB,
// sem migração), com a mesma validação da ficha. O ID fica guardado; ler os números do Google Ads precisa da conta da
// Vybe (MCC), do token de desenvolvedor e do OAuth, que só o Paulo configura: até lá, a tela diz isso e não mostra número.
import { ehDonoPessoa } from './donos.js';
import { metricasDoHub, linkDoRelatorio } from './assistente-hub.js';
import { CAMPOS_CADASTRO, limparCampo, garantirSchemaDoCadastro } from './clientes-cadastro.js';

const erro = (status, message) => Object.assign(new Error(message), { status });

// Os canais de mídia de cada cliente. `fonte: null` = ainda sem conexão: a tela guarda o lugar e diz o que falta.
export const CANAIS = Object.freeze([
  Object.freeze({ id: 'meta', nome: 'Meta Ads', fonte: 'vybehub', falta: '' }),
  Object.freeze({ id: 'google', nome: 'Google Ads', fonte: null, falta: 'O ID da conta fica salvo aqui. Ler os números pede a conta da Vybe no Google Ads (MCC) com token de desenvolvedor e o acesso OAuth, que o Paulo configura.' }),
  Object.freeze({ id: 'site', nome: 'Site', fonte: null, falta: 'O endereço fica salvo aqui. A análise do site pede o Google Analytics (GA4) do cliente ligado à Vybe.' }),
]);
export const DIAS_DO_PERIODO = Object.freeze([7, 30]);

export const hojeNaBahia = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);

// O período fecha ontem: o dia de hoje ainda está rodando e deixaria o custo do dia pela metade.
export function periodoDe(dias, hoje = hojeNaBahia()) {
  const n = DIAS_DO_PERIODO.includes(Number(dias)) ? Number(dias) : 7;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(hoje))) throw new TypeError('Dia inválido.');
  const fim = Date.parse(hoje + 'T12:00:00Z') - 864e5;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  return { dias: n, de: iso(fim - (n - 1) * 864e5), ate: iso(fim) };
}

function pegarDono(quem) {
  if (!quem) throw erro(401, 'Entre no painel para ver a Mídia.');
  if (quem.tipo !== 'sessao' || !quem.pessoa?.id) throw erro(403, 'A Mídia exige uma sessão pessoal.');
  if (!ehDonoPessoa(quem.pessoa)) throw erro(403, 'A Mídia é só dos donos.');
  return quem.pessoa;
}

// As linhas do `resumo` do Hub (total, anterior, até 5 campanhas e o melhor anúncio) viram o retrato do Meta no período.
// Custo por resultado só se compara com o mesmo tipo de resultado (conversa com conversa, alcance com alcance).
export function retratoDoMeta(linhas = []) {
  const de = (t) => linhas.filter((l) => l?.tipo === t);
  const total = de('total')[0] || null, anterior = de('anterior')[0] || null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  if (!total) return null;
  const mesmoTipo = anterior && anterior.tipoResultado && anterior.tipoResultado === total.tipoResultado;
  return {
    investido: num(total.investido) ?? 0,
    investido_anterior: anterior ? num(anterior.investido) : null,
    resultados: num(total.resultados) ?? 0,
    resultados_anterior: mesmoTipo ? num(anterior.resultados) : null,
    tipo_resultado: total.tipoResultado || null,
    custo_resultado: num(total.custoResultado),
    custo_anterior: mesmoTipo ? num(anterior.custoResultado) : null,
    alcance: num(total.alcance), frequencia: num(total.frequencia), ctr: num(total.ctr), cpm: num(total.cpm),
    conversas: num(total.conversas) ?? 0,
    campanhas: de('campanha').map((c) => ({ nome: c.nome || '', objetivo: c.objetivo || '', investido: num(c.investido) ?? 0, resultados: num(c.resultados) ?? 0,
      tipo_resultado: c.tipoResultado || null, custo_resultado: num(c.custoResultado), frequencia: num(c.frequencia), ctr: num(c.ctr) })),
    melhor_anuncio: de('anuncio').map((a) => ({ nome: a.nome || '', campanha: a.objetivo || '', resultados: num(a.resultados) ?? 0, tipo_resultado: a.tipoResultado || null, custo_resultado: num(a.custoResultado) }))[0] || null,
  };
}

// O sinal do Ícaro para o Meta de um cliente: vermelho pede ação, âmbar pede olho, verde está andando.
// Frequência acima de 3 é o mesmo corte do alerta do Hub (TopAdsCard). Custo por resultado comparado ao período anterior
// de mesmo tamanho e mesmo tipo de resultado.
export function sinalDoMeta(r) {
  if (!r) return { tom: 'n', motivo: 'Sem dados do Meta no período.' };
  const variacao = r.custo_resultado != null && r.custo_anterior > 0 ? (r.custo_resultado - r.custo_anterior) / r.custo_anterior : null;
  if (r.investido <= 0 && r.investido_anterior > 0) return { tom: 'r', motivo: 'Parou de investir: o período anterior teve verba e este não.' };
  if (r.investido <= 0) return { tom: 'n', motivo: 'Nada investido no período.' };
  if (variacao != null && variacao >= 0.4) return { tom: 'r', motivo: `Custo por resultado subiu ${Math.round(variacao * 100)}% sobre o período anterior.` };
  if (r.investido > 0 && !r.resultados) return { tom: 'r', motivo: 'Investiu e não teve resultado no período.' };
  if (r.frequencia != null && r.frequencia > 3) return { tom: 'a', motivo: `Frequência ${String(r.frequencia).replace('.', ',')}: o público está vendo o mesmo anúncio demais.` };
  if (variacao != null && variacao >= 0.2) return { tom: 'a', motivo: `Custo por resultado subiu ${Math.round(variacao * 100)}% sobre o período anterior.` };
  return { tom: 'g', motivo: variacao != null && variacao <= -0.1 ? `Custo por resultado caiu ${Math.round(-variacao * 100)}%.` : 'Andando dentro do esperado.' };
}

// Cliente sem conta de anúncios vinculada no Hub não é erro: é um canal a conectar.
const semConta = (msg) => /conta de an[uú]ncios indispon|sem conta|n[aã]o tem conta|sem correspond[eê]ncia/i.test(String(msg || ''));

// O endereço do VybeHub para os links (vincular a conta do Meta, abrir o painel): o mesmo host que a ponte aceita.
export function hubDe(config = process.env) {
  try { const u = new URL(config.VYBE_AI_HUB_URL || ''); if (u.protocol === 'https:' && /(^|\.)vybehub[a-z0-9-]*\.vercel\.app$/.test(u.hostname)) return u.origin; } catch { /* padrão */ }
  return 'https://vybehub.vercel.app';
}

export async function lerCarteira(sql, quem, { config = process.env } = {}) {
  pegarDono(quem);
  const clientes = await sql`SELECT id::text, nome, NULLIF(TRIM(COALESCE(to_jsonb(c)->'cadastro'->>'site', '')), '') AS site,
      NULLIF(TRIM(COALESCE(to_jsonb(c)->'cadastro'->>'google_ads', '')), '') AS google_ads
    FROM vybe_clientes c WHERE COALESCE(ativo, true) AND NOT COALESCE(nao_e_cliente, false) ORDER BY nome`;
  return {
    canais: CANAIS, dias: DIAS_DO_PERIODO, hub_ativo: config.VYBE_AI_HUB_ATIVO === '1', hub_url: hubDe(config),
    clientes: clientes.map((c) => ({ id: c.id, nome: c.nome, tem_site: Boolean(c.site), site: c.site || '', google_ads: c.google_ads || '' })),
  };
}

// ── Conectar pelo próprio módulo: o site e o ID do Google Ads, gravados no cadastro do cliente ─────────────────────────
// O ID do Google Ads tem 10 números (123-456-7890); com ou sem traço, sai sempre com traço. Vazio apaga.
export function limparGoogleAds(bruto) {
  if (bruto === null || bruto === undefined) return '';
  if (typeof bruto !== 'string' && typeof bruto !== 'number') throw erro(400, 'Google Ads: ID inválido.');
  const v = String(bruto).trim();
  if (!v) return '';
  if (!/^\d{3}[-\s.]?\d{3}[-\s.]?\d{4}$/.test(v)) throw erro(400, 'Google Ads: o ID tem 10 números, como 123-456-7890.');
  const d = v.replace(/\D+/g, '');
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
const CAMPO_SITE = CAMPOS_CADASTRO.find((c) => c.chave === 'site');
export function limparSite(bruto) { return limparCampo(CAMPO_SITE, bruto); }

// Só as duas chaves: o resto do cadastro fica como está (a ficha do cliente lê e grava o mesmo JSONB).
export async function salvarCanais(sql, quem, corpo = {}) {
  pegarDono(quem);
  const id = Number(corpo.cliente_id);
  if (!Number.isSafeInteger(id) || id <= 0) throw erro(400, 'Cliente inválido.');
  const muda = {};
  if (Object.hasOwn(corpo, 'site')) muda.site = limparSite(corpo.site);
  if (Object.hasOwn(corpo, 'google_ads')) muda.google_ads = limparGoogleAds(corpo.google_ads);
  if (!Object.keys(muda).length) throw erro(400, 'Informe o site ou o ID do Google Ads.');
  await garantirSchemaDoCadastro(sql);
  const [antes] = await sql`SELECT id, cadastro FROM vybe_clientes WHERE id = ${id} AND apagado_em IS NULL AND COALESCE(ativo, true) AND NOT COALESCE(nao_e_cliente, false)`;
  if (!antes) throw erro(404, 'Cliente não encontrado entre os ativos.');
  const cadastro = { ...(antes.cadastro || {}) };
  for (const [k, v] of Object.entries(muda)) { if (v) cadastro[k] = v; else delete cadastro[k]; }
  await sql`UPDATE vybe_clientes SET cadastro = ${JSON.stringify(cadastro)}::jsonb WHERE id = ${id}`;
  return { cliente_id: String(id), site: cadastro.site || '', google_ads: cadastro.google_ads || '' };
}

export async function lerClienteMidia(sql, quem, q = {}, { config = process.env, buscar = fetch, hoje = hojeNaBahia() } = {}) {
  pegarDono(quem);
  const id = Number(q.cliente_id);
  if (!Number.isSafeInteger(id) || id <= 0) throw erro(400, 'Cliente inválido.');
  const [c] = await sql`SELECT id::text, nome FROM vybe_clientes WHERE id = ${id} AND COALESCE(ativo, true) AND NOT COALESCE(nao_e_cliente, false)`;
  if (!c) throw erro(404, 'Cliente não encontrado entre os ativos.');
  const p = periodoDe(q.dias, hoje);
  let meta;
  try {
    const r = await metricasDoHub(sql, { cliente_id: id, de: p.de, ate: p.ate, modulo: 'resumo', limite: 10 }, { config, buscar });
    const retrato = retratoDoMeta(r.itens);
    meta = retrato ? { estado: 'ok', ...retrato, sinal: sinalDoMeta(retrato) } : { estado: 'sem_dados', sinal: sinalDoMeta(null) };
  } catch (e) {
    meta = estadoDoErro(e);
  }
  // O que o Ícaro e os chats já decidiram ou aprenderam sobre o cliente (o cérebro do Vybe OS), os 5 mais novos.
  let registros = [];
  const [t] = await sql`SELECT to_regclass('vybe_cliente_registros') IS NOT NULL AS existe`;
  if (t?.existe) registros = await sql`SELECT tipo, titulo, resumo, criado_em FROM vybe_cliente_registros
    WHERE cliente_id = ${id} AND tipo IN ('decisao', 'aprendizado') ORDER BY criado_em DESC LIMIT 5`;
  return { cliente: { id: c.id, nome: c.nome }, periodo: p, meta,
    registros: registros.map((x) => ({ tipo: x.tipo, titulo: x.titulo, resumo: String(x.resumo || '').slice(0, 400), criado_em: x.criado_em })) };
}

// ── Ficha do cliente na Mídia: histórico, campanhas, resumo da semana e relatório (tudo leitura do Hub) ──────────────
async function clienteAtivo(sql, q) {
  const id = Number(q.cliente_id);
  if (!Number.isSafeInteger(id) || id <= 0) throw erro(400, 'Cliente inválido.');
  const [c] = await sql`SELECT id::text, nome FROM vybe_clientes WHERE id = ${id} AND COALESCE(ativo, true) AND NOT COALESCE(nao_e_cliente, false)`;
  if (!c) throw erro(404, 'Cliente não encontrado entre os ativos.');
  return { id, nome: c.nome };
}
// O erro do Hub vira estado, nunca tela vazia: sem conta, ponte desligada ou o Hub fora.
export function estadoDoErro(e) {
  const msg = String(e?.message || '');
  if (semConta(msg)) return { estado: 'sem_conta', motivo: 'Sem conta de anúncios vinculada no VybeHub.' };
  if (/ainda não configuradas neste ambiente/i.test(msg)) return { estado: 'desligado', motivo: 'A ponte com o VybeHub está desligada neste ambiente.' };
  return { estado: 'erro', motivo: e?.publica || e?.status === 503 ? msg.slice(0, 200) : 'O VybeHub não respondeu agora.' };
}

// As semanas fecham ontem; cada consulta ao resumo do Hub devolve a semana e a anterior, então 4 consultas trazem 8 semanas.
export function semanasDoHistorico(hoje = hojeNaBahia(), n = 8) {
  const ontem = Date.parse(hoje + 'T12:00:00Z') - 864e5, iso = (t) => new Date(t).toISOString().slice(0, 10);
  return Array.from({ length: Math.ceil(n / 2) }, (_, j) => { const ate = ontem - j * 14 * 864e5; return { de: iso(ate - 6 * 864e5), ate: iso(ate), de_anterior: iso(ate - 13 * 864e5), ate_anterior: iso(ate - 7 * 864e5) }; });
}
const numOuNulo = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
function semanaDe(l, de, ate) {
  if (!l) return { de, ate, investido: null, resultados: null, tipo_resultado: null, custo_resultado: null };
  return { de, ate, investido: numOuNulo(l.investido) ?? 0, resultados: numOuNulo(l.resultados) ?? 0, tipo_resultado: l.tipoResultado || null, custo_resultado: numOuNulo(l.custoResultado) };
}
export async function lerHistorico(sql, quem, q = {}, { config = process.env, buscar = fetch, hoje = hojeNaBahia() } = {}) {
  pegarDono(quem);
  const c = await clienteAtivo(sql, q);
  const pares = semanasDoHistorico(hoje);
  try {
    const semanas = [];
    // Duas de cada vez: o Hub pergunta ao Meta em cada uma.
    for (let i = 0; i < pares.length; i += 2) {
      const lote = await Promise.all(pares.slice(i, i + 2).map(async (p) => {
        const r = await metricasDoHub(sql, { cliente_id: c.id, de: p.de, ate: p.ate, modulo: 'resumo', limite: 2 }, { config, buscar });
        const linhas = r.itens || [];
        return [semanaDe(linhas.find((l) => l?.tipo === 'total'), p.de, p.ate), semanaDe(linhas.find((l) => l?.tipo === 'anterior'), p.de_anterior, p.ate_anterior)];
      }));
      semanas.push(...lote.flat());
    }
    return { cliente: { id: String(c.id), nome: c.nome }, estado: 'ok', semanas: semanas.sort((a, b) => a.de.localeCompare(b.de)) };
  } catch (e) {
    return { cliente: { id: String(c.id), nome: c.nome }, ...estadoDoErro(e), semanas: [] };
  }
}
export async function lerCampanhas(sql, quem, q = {}, { config = process.env, buscar = fetch, hoje = hojeNaBahia() } = {}) {
  pegarDono(quem);
  const c = await clienteAtivo(sql, q);
  const p = periodoDe(q.dias, hoje);
  try {
    const r = await metricasDoHub(sql, { cliente_id: c.id, de: p.de, ate: p.ate, modulo: 'campanhas', limite: 25 }, { config, buscar });
    const campanhas = (r.itens || []).map((k) => ({ nome: k.name || '', objetivo: k.objective || '', status: k.status || '', investido: numOuNulo(k.spent) ?? 0, resultados: numOuNulo(k.results) ?? 0,
      tipo_resultado: k.resultType || null, alcance: numOuNulo(k.reach), frequencia: numOuNulo(k.frequency), cliques: numOuNulo(k.clicks) }))
      .sort((a, b) => b.investido - a.investido);
    return { cliente: { id: String(c.id), nome: c.nome }, periodo: p, estado: 'ok', campanhas, limitado: Boolean(r.limitado) };
  } catch (e) { return { cliente: { id: String(c.id), nome: c.nome }, periodo: p, ...estadoDoErro(e), campanhas: [] }; }
}
// A mesma janela do bot (resumosDaSemana em assistente-hub.js): de 8 dias atrás até hoje; o Hub pega os últimos 7 com dados.
export async function lerSemana(sql, quem, q = {}, { config = process.env, buscar = fetch, hoje = hojeNaBahia() } = {}) {
  pegarDono(quem);
  const c = await clienteAtivo(sql, q);
  const de = new Date(Date.parse(hoje + 'T12:00:00Z') - 8 * 864e5).toISOString().slice(0, 10);
  const base = { cliente: { id: String(c.id), nome: c.nome }, de, ate: hoje };
  try {
    const r = await metricasDoHub(sql, { cliente_id: c.id, de, ate: hoje, modulo: 'semana', limite: 1 }, { config, buscar });
    const texto = r.itens?.[0]?.texto;
    return typeof texto === 'string' && texto.trim() ? { ...base, estado: 'ok', texto } : { ...base, estado: 'sem_dados', motivo: 'O Hub não tem semana com dados para este cliente.' };
  } catch (e) { return { ...base, ...estadoDoErro(e) }; }
}
export async function pedirRelatorio(sql, quem, q = {}, { config = process.env, buscar = fetch } = {}) {
  pegarDono(quem);
  const c = await clienteAtivo(sql, q);
  const mes = String(q.mes || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw erro(400, 'Mês inválido.');
  try { const r = await linkDoRelatorio(sql, { cliente_id: c.id, mes: mes + '-01' }, { config, buscar }); return { estado: 'ok', url: r.url, mes }; }
  catch (e) { return { mes, ...estadoDoErro(e) }; }
}

export async function areaMidia(req, res, quem, criarBanco, opcoes = {}) {
  if (req.method === 'POST') {
    try {
      const corpo = req.body || {};
      if (corpo.acao !== 'conectar') return res.status(400).json({ error: 'Ação inválida.' });
      return res.status(200).json({ ok: true, ...await salvarCanais(criarBanco(), quem, corpo) });
    } catch (e) {
      if (!e.status) console.error('[midia]', e);
      return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível salvar. Tente novamente.' });
    }
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const sql = criarBanco();
    const acao = String(req.query?.acao || 'carteira');
    if (acao === 'carteira') return res.status(200).json({ ok: true, ...await lerCarteira(sql, quem, opcoes) });
    if (acao === 'cliente') return res.status(200).json({ ok: true, ...await lerClienteMidia(sql, quem, req.query || {}, opcoes) });
    if (acao === 'historico') return res.status(200).json({ ok: true, ...await lerHistorico(sql, quem, req.query || {}, opcoes) });
    if (acao === 'campanhas') return res.status(200).json({ ok: true, ...await lerCampanhas(sql, quem, req.query || {}, opcoes) });
    if (acao === 'semana') return res.status(200).json({ ok: true, ...await lerSemana(sql, quem, req.query || {}, opcoes) });
    if (acao === 'relatorio') return res.status(200).json({ ok: true, ...await pedirRelatorio(sql, quem, req.query || {}, opcoes) });
    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (e) {
    if (!e.status) console.error('[midia]', e);
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível abrir a Mídia. Tente novamente.' });
  }
}
