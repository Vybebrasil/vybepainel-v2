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
//   GET area=midia&acao=anuncios&cliente_id=N&dias=…    → os anúncios com mais resultado e a miniatura (só da Meta)
//   GET area=midia&acao=rotina                          → a rotina do gestor de hoje: itens da cadência, checks e 7 dias
//   POST area=midia { acao:'conectar', cliente_id, site?, google_ads? } → grava o site e o ID do Google Ads no cadastro
//   POST area=midia { acao:'check'|'desfazer', chave, cliente_id?, nota? } → marca ou desfaz um item da rotina
//
// Rotina do gestor (S-Q, Paulo, 24/11/2026): com dias=7, acao=cliente traz também o dia de ontem contra anteontem e as
// campanhas com status e orçamento, e devolve `alertas` (o que os números acenderam para a rotina). Os checks moram em
// vybe_midia_checks, criada aqui na primeira vez (CREATE TABLE IF NOT EXISTS, uma vez por banco).
//
// Mídia: confere e completa (Paulo, 23/11/2026: "não consigo add o site? o google ads? olhar históricos? relatórios? resumo
// da semana do cliente?"). O site e o ID do Google Ads moram no cadastro único do cliente (vybe_clientes.cadastro, JSONB,
// sem migração), com a mesma validação da ficha. O ID fica guardado; ler os números do Google Ads precisa da conta da
// Vybe (MCC), do token de desenvolvedor e do OAuth, que só o Paulo configura: até lá, a tela diz isso e não mostra número.
import { ehDonoPessoa } from './donos.js';
import { metricasDoHub, linkDoRelatorio } from './assistente-hub.js';
import { CAMPOS_CADASTRO, limparCampo, garantirSchemaDoCadastro } from './clientes-cadastro.js';
import { umaVez } from './uma-vez.js';

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
// Conta com pagamento pendente (no Meta, account_status UNSETTLED): o Hub ainda não manda o estado da conta, então só
// vira estado quando a mensagem dele disser; no resto, a rotina pega pelo efeito (a verba que parou de um dia para o outro).
const semPagamento = (msg) => /pagamento pendente|sem pagamento|unsettled|payment (?:required|failed|issue)|saldo insuficiente/i.test(String(msg || ''));

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
    // Nos 7 dias (a base da rotina do gestor), junto vêm o dia de ontem contra anteontem e as campanhas com status e
    // orçamento: é o que diz se a verba parou, se o gasto está fora do ritmo e se alguma campanha tem problema.
    const extra = p.dias === 7;
    const [r, rOntem, rCamp] = await Promise.all([
      metricasDoHub(sql, { cliente_id: id, de: p.de, ate: p.ate, modulo: 'resumo', limite: 10 }, { config, buscar }),
      extra ? metricasDoHub(sql, { cliente_id: id, de: p.ate, ate: p.ate, modulo: 'resumo', limite: 2 }, { config, buscar }).catch(() => null) : null,
      extra ? metricasDoHub(sql, { cliente_id: id, de: p.de, ate: p.ate, modulo: 'campanhas', limite: 25 }, { config, buscar }).catch(() => null) : null,
    ]);
    const retrato = retratoDoMeta(r.itens);
    meta = retrato ? { estado: 'ok', ...retrato, sinal: sinalDoMeta(retrato) } : { estado: 'sem_dados', sinal: sinalDoMeta(null) };
    if (extra) {
      const ontem = rOntem ? retratoDoMeta(rOntem.itens) : null;
      const campanhas = rCamp ? (rCamp.itens || []).map(campanhaDoHub) : null;
      meta.ontem = ontem ? { dia: p.ate, investido: ontem.investido, investido_anterior: ontem.investido_anterior } : null;
      meta.orcamento_dia = campanhas ? somaOrcamento(campanhas) : null;
      meta.alertas = alertasDoCliente({ meta, ontem: meta.ontem, campanhas, hoje });
    }
  } catch (e) {
    meta = estadoDoErro(e);
    if (p.dias === 7) meta.alertas = alertasDoCliente({ meta, hoje });
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
  if (semPagamento(msg)) return { estado: 'pagamento', motivo: 'A conta de anúncios está com pagamento pendente no Meta.' };
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
    const campanhas = (r.itens || []).map(campanhaDoHub).sort((a, b) => b.investido - a.investido);
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

// ── Campanhas e anúncios do Hub, no formato da tela ───────────────────────────────────────────────────────────────────
// Orçamento vem do Hub já em reais (o Meta manda em centavos; o Hub divide). Orçamento no conjunto (ABO) chega nulo.
export function campanhaDoHub(k = {}) {
  return { nome: k.name || '', objetivo: k.objective || '', status: k.status || '', investido: numOuNulo(k.spent) ?? 0, resultados: numOuNulo(k.results) ?? 0,
    tipo_resultado: k.resultType || null, alcance: numOuNulo(k.reach), frequencia: numOuNulo(k.frequency), cliques: numOuNulo(k.clicks),
    impressoes: numOuNulo(k.impressions), orcamento_dia: numOuNulo(k.dailyBudget), orcamento_total: numOuNulo(k.lifetimeBudget),
    inicio: typeof k.startTime === 'string' ? k.startTime.slice(0, 10) : null, fim: typeof k.stopTime === 'string' ? k.stopTime.slice(0, 10) : null };
}
const ATIVA = (s) => s === 'ACTIVE';
const PAUSADA = (s) => ['PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED'].includes(s);
const COM_PROBLEMA = (s) => ['WITH_ISSUES', 'DISAPPROVED'].includes(s);
export function somaOrcamento(campanhas = []) {
  const v = campanhas.filter((k) => ATIVA(k.status) && k.orcamento_dia > 0).reduce((s, k) => s + k.orcamento_dia, 0);
  return v > 0 ? Math.round(v * 100) / 100 : null;
}
// A imagem do criativo só sai se for HTTPS dos servidores de imagem da própria Meta (a mesma regra do Hub).
export const imagemDaMeta = (v) => { if (typeof v !== 'string' || v.length > 2000) return null; try { const u = new URL(v); return u.protocol === 'https:' && /(?:^|\.)(?:fbcdn\.net|cdninstagram\.com)$/.test(u.hostname) ? u.href : null; } catch { return null; } };
export function anuncioDoHub(a = {}) {
  return { nome: String(a.name || '').slice(0, 200), campanha: String(a.campaign || '').slice(0, 200), status: a.status || '', imagem: imagemDaMeta(a.thumbnail),
    texto: typeof a.text === 'string' ? a.text.slice(0, 280) : '', formato: a.format || '', investido: numOuNulo(a.spent) ?? 0, resultados: numOuNulo(a.results) ?? 0,
    tipo_resultado: a.resultType || null, alcance: numOuNulo(a.reach), cliques: numOuNulo(a.clicks), impressoes: numOuNulo(a.impressions) };
}
export async function lerAnuncios(sql, quem, q = {}, { config = process.env, buscar = fetch, hoje = hojeNaBahia() } = {}) {
  pegarDono(quem);
  const c = await clienteAtivo(sql, q);
  const p = periodoDe(q.dias, hoje);
  try {
    const r = await metricasDoHub(sql, { cliente_id: c.id, de: p.de, ate: p.ate, modulo: 'anuncios', limite: 6 }, { config, buscar });
    const anuncios = (r.itens || []).map(anuncioDoHub).sort((a, b) => b.resultados - a.resultados || b.investido - a.investido);
    return { cliente: { id: String(c.id), nome: c.nome }, periodo: p, estado: 'ok', anuncios };
  } catch (e) { return { cliente: { id: String(c.id), nome: c.nome }, periodo: p, ...estadoDoErro(e), anuncios: [] }; }
}

// ── Rotina do gestor de tráfego (Paulo, 24/11/2026: "a rotina do gestor... o que fazer no dia a dia com os checks") ──────
// Duas fontes de itens: os da cadência (todo dia, toda semana, início do mês), iguais para a carteira inteira, e os que os
// números de cada cliente acendem (alertasDoCliente). Cada item tem uma chave fixa da lista REGRAS e uma cadência; o
// "feito" de um item vale para o dia (cadência diária), para a semana (segunda a domingo) ou para o mês. O servidor
// calcula a âncora (o dia que o check guarda) pela cadência da chave: a tela nunca escolhe o dia.
// A ordem do dia segue o que os gestores de Meta Ads fazem: olhar curto todo dia (gasto, pagamento, reprovações, sem
// decidir por um dia ruim), revisão com 7 dias de dados na semana (custo por resultado, resultados, criativos, verba) e,
// no mês, o relatório contra o mês anterior e a verba combinada com o cliente.
export const REGRAS = Object.freeze({
  // da cadência (cliente_id 0 = a carteira inteira)
  diario_gastos: { cadencia: 'dia', fixo: true }, diario_pagamentos: { cadencia: 'dia', fixo: true }, diario_reprovados: { cadencia: 'dia', fixo: true },
  semana_resumo: { cadencia: 'semana', fixo: true }, semana_revisao: { cadencia: 'semana', fixo: true },
  mes_relatorio: { cadencia: 'mes', fixo: true }, mes_verba: { cadencia: 'mes', fixo: true },
  // de cada cliente
  pagamento: { cadencia: 'dia' }, verba_parou: { cadencia: 'dia' }, sem_resultado: { cadencia: 'dia' }, cpr_subiu: { cadencia: 'dia' },
  frequencia: { cadencia: 'dia' }, ritmo_baixo: { cadencia: 'dia' }, ritmo_alto: { cadencia: 'dia' }, campanha_problema: { cadencia: 'dia' },
  campanha_pausada: { cadencia: 'dia' }, criativo_antigo: { cadencia: 'semana' }, sem_conta: { cadencia: 'semana' },
});
// O mês começa até o dia 10: depois disso, item do mês que não foi feito some da lista (o histórico guarda o que foi).
export const DIAS_DO_INICIO_DO_MES = 10;

export function ancoraDe(cadencia, hoje = hojeNaBahia()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(hoje))) throw new TypeError('Dia inválido.');
  if (cadencia === 'mes') return hoje.slice(0, 8) + '01';
  if (cadencia === 'semana') { const t = Date.parse(hoje + 'T12:00:00Z'), dow = (new Date(t).getUTCDay() + 6) % 7; return new Date(t - dow * 864e5).toISOString().slice(0, 10); }
  return hoje;
}

export function itensFixos(hoje = hojeNaBahia()) {
  const dia = Number(hoje.slice(8, 10));
  const it = (chave, titulo, porque, acao) => ({ chave, cliente_id: '0', tom: 'rotina', cadencia: REGRAS[chave].cadencia, ancora: ancoraDe(REGRAS[chave].cadencia, hoje), titulo, porque, acao });
  const lista = [
    it('diario_gastos', 'Conferir o gasto de ontem em todas as contas', 'Cinco minutos: gasto fora do normal ou campanha desligada aparece primeiro aqui. Um dia ruim sozinho não pede mudança.', 'gerenciador'),
    it('diario_pagamentos', 'Conferir saldo e pagamento das contas', 'Saldo pré-pago (Pix ou boleto) que acaba ou cartão recusado param a entrega no mesmo dia.', 'faturamento'),
    it('diario_reprovados', 'Olhar anúncios reprovados e problemas de entrega', 'Anúncio reprovado ou em aprendizado limitado só aparece no número da semana quando já é tarde.', 'gerenciador'),
    it('semana_resumo', 'Revisar e mandar o resumo da semana de cada cliente', 'O Ícaro manda o texto ao Ewerton na segunda às 7h: revisar e encaminhar no grupo do cliente.', 'semana'),
    it('semana_revisao', 'Revisão da semana: custo por resultado, resultados e criativos', 'Com 7 dias de dados: trocar criativo cansado, mover verba para o que traz resultado, testar um público novo.', 'carteira'),
  ];
  if (dia <= DIAS_DO_INICIO_DO_MES) lista.push(
    it('mes_relatorio', 'Relatório do mês de cada cliente', 'O relatório do VybeHub traz o mês fechado contra o anterior; abre pela ficha de cada cliente.', 'relatorios'),
    it('mes_verba', 'Combinar a verba e o objetivo do mês com cada cliente', 'Verba e objetivo acertados antes de subir as campanhas do mês.', 'carteira'));
  return lista;
}

const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const virgula = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const TIPO_UM = { messages: 'conversa', leads: 'cadastro', purchases: 'compra', profile_visits: 'visita ao perfil', link_clicks: 'clique', reach: 'mil pessoas alcançadas', video_views: 'visualização', follows: 'seguidor', engagement: 'interação' };
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const nomes = (l, n = 2) => l.slice(0, n).map((k) => k.nome).join(', ') + (l.length > n ? ` e mais ${l.length - n}` : '');

// O que os números de um cliente acendem na rotina. `meta` é o retrato dos 7 dias (ou o estado do erro), `ontem` o dia
// de ontem contra anteontem e `campanhas` as campanhas dos 7 dias com status e orçamento (null quando o Hub não mandou).
// Cada item: chave (de REGRAS), tom (r pede ação, a de olho, n para conectar), título, o porquê com o número e a ação.
export function alertasDoCliente({ meta, ontem = null, campanhas = null, hoje = hojeNaBahia() } = {}) {
  const out = [];
  const add = (chave, tom, titulo, porque, acao) => out.push({ chave, tom, cadencia: REGRAS[chave].cadencia, ancora: ancoraDe(REGRAS[chave].cadencia, hoje), titulo, porque, acao });
  if (!meta) return out;
  if (meta.estado === 'pagamento') { add('pagamento', 'r', 'Conta com pagamento pendente', 'O Meta para de entregar enquanto o pagamento não for acertado.', 'faturamento'); return out; }
  if (meta.estado === 'sem_conta') { add('sem_conta', 'n', 'Ligar a conta do Meta no VybeHub', 'Sem a conta vinculada, o Ícaro não acompanha este cliente.', 'vincular'); return out; }
  if (meta.estado !== 'ok') return out;
  // A verba parou: ontem zero e anteontem com gasto (o sinal mais comum de pagamento pendente ou saldo que acabou).
  if (ontem && !(ontem.investido > 0) && ontem.investido_anterior > 0) add('verba_parou', 'r', 'A verba parou ontem', `Anteontem ${brl(ontem.investido_anterior)}, ontem R$ 0,00. Conferir saldo, pagamento e se alguém pausou.`, 'faturamento');
  else if (!(meta.investido > 0) && meta.investido_anterior > 0) add('verba_parou', 'r', 'Parou de investir nesta semana', `Semana anterior ${brl(meta.investido_anterior)}, esta R$ 0,00. Conferir saldo, pagamento e campanhas.`, 'faturamento');
  if (meta.investido > 0 && !meta.resultados) add('sem_resultado', 'r', 'Investiu e não teve resultado', `${brl(meta.investido)} em 7 dias sem nenhum resultado. Conferir o objetivo e o evento de conversão.`, 'campanhas');
  const v = meta.custo_resultado != null && meta.custo_anterior > 0 ? (meta.custo_resultado - meta.custo_anterior) / meta.custo_anterior : null;
  if (v != null && v >= 0.2) add('cpr_subiu', v >= 0.4 ? 'r' : 'a', `Custo por ${TIPO_UM[meta.tipo_resultado] || 'resultado'} subiu ${Math.round(v * 100)}%`, `${brl(meta.custo_resultado)} contra ${brl(meta.custo_anterior)} na semana anterior.`, 'historico');
  if (meta.frequencia != null && meta.frequencia > 3) add('frequencia', 'a', `Frequência ${virgula(meta.frequencia)} na semana`, 'O mesmo público está vendo o anúncio mais de 3 vezes: trocar o criativo ou abrir o público.', 'campanhas');
  if (Array.isArray(campanhas)) {
    const prob = campanhas.filter((k) => COM_PROBLEMA(k.status));
    if (prob.length) add('campanha_problema', 'r', prob.length === 1 ? 'Campanha com problema no Meta' : `${prob.length} campanhas com problema no Meta`, `${nomes(prob)}: reprovada ou com problema de entrega.`, 'gerenciador');
    const paus = campanhas.filter((k) => PAUSADA(k.status) && k.investido > 0);
    if (paus.length) add('campanha_pausada', 'a', paus.length === 1 ? 'Campanha pausada nesta semana' : `${paus.length} campanhas pausadas nesta semana`, `${nomes(paus)}: gastou na semana e agora está pausada. Confirmar se foi de propósito.`, 'campanhas');
    // O ritmo: o que as campanhas ativas com orçamento diário gastaram contra o orçamento dos dias em que estiveram no ar.
    const fim = periodoDe(7, hoje).ate, comOrc = campanhas.filter((k) => ATIVA(k.status) && k.orcamento_dia > 0);
    const esperado = comOrc.reduce((s, k) => s + k.orcamento_dia * Math.max(1, Math.min(7, k.inicio ? diasEntre(k.inicio, fim) + 1 : 7)), 0);
    const gasto = comOrc.reduce((s, k) => s + k.investido, 0);
    if (esperado >= 50) {
      const r = gasto / esperado;
      if (r < 0.6) add('ritmo_baixo', 'a', 'Gastando abaixo do orçamento', `${brl(gasto)} de ${brl(esperado)} previstos em 7 dias (${Math.round(r * 100)}%). Entrega travada, público pequeno ou lance baixo.`, 'campanhas');
      else if (r > 1.25) add('ritmo_alto', 'a', 'Gastando acima do orçamento', `${brl(gasto)} contra ${brl(esperado)} previstos em 7 dias (${Math.round(r * 100)}%). Conferir se a verba do mês aguenta.`, 'campanhas');
    }
    const velhas = campanhas.filter((k) => ATIVA(k.status) && k.inicio && diasEntre(k.inicio, hoje) >= 45 && k.frequencia >= 2.5).sort((a, b) => a.inicio.localeCompare(b.inicio));
    if (velhas.length) add('criativo_antigo', 'a', `Campanha no ar há ${diasEntre(velhas[0].inicio, hoje)} dias`, `${velhas[0].nome}: frequência ${virgula(velhas[0].frequencia)}. Hora de renovar o criativo.`, 'campanhas');
  }
  const peso = { r: 0, a: 1, n: 2 };
  return out.sort((a, b) => peso[a.tom] - peso[b.tom]);
}

// ── Os checks: quem fez, quando, com nota. Tabela própria, criada uma vez por banco (Paulo autorizou criar tabelas). ────
export function garantirTabelaChecks(db) { return umaVez('midia_checks', db, criarTabelaChecks); }
async function criarTabelaChecks(db) {
  await db`CREATE TABLE IF NOT EXISTS vybe_midia_checks (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL DEFAULT 0,
    chave TEXT NOT NULL,
    dia DATE NOT NULL,
    feito_por BIGINT NOT NULL,
    feito_por_nome TEXT,
    feito_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    nota TEXT,
    UNIQUE (cliente_id, chave, dia)
  )`;
  await db`CREATE INDEX IF NOT EXISTS vybe_midia_checks_feito_em ON vybe_midia_checks (feito_em)`;
}
const diaIso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10));
const linhaCheck = (x) => ({ cliente_id: String(x.cliente_id), chave: x.chave, dia: diaIso(x.dia), feito_por: String(x.feito_por), feito_por_nome: x.feito_por_nome || '', feito_em: new Date(x.feito_em).toISOString(), nota: x.nota || '' });

function chaveValida(corpo, hoje) {
  const chave = String(corpo.chave || '');
  const regra = Object.hasOwn(REGRAS, chave) ? REGRAS[chave] : null;
  if (!regra) throw erro(400, 'Item da rotina inválido.');
  const id = regra.fixo ? 0 : Number(corpo.cliente_id);
  if (!regra.fixo && (!Number.isSafeInteger(id) || id <= 0)) throw erro(400, 'Cliente inválido.');
  return { chave, cliente_id: id, dia: ancoraDe(regra.cadencia, hoje), fixo: Boolean(regra.fixo) };
}
export async function marcarCheck(sql, quem, corpo = {}, { hoje = hojeNaBahia() } = {}) {
  const pessoa = pegarDono(quem);
  const k = chaveValida(corpo, hoje);
  const nota = String(corpo.nota ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!k.fixo) await clienteAtivo(sql, { cliente_id: k.cliente_id });
  await garantirTabelaChecks(sql);
  const nome = String(pessoa.nome || '').trim().split(/\s+/)[0] || '';
  // Idempotente: marcar de novo o que já está feito não troca quem fez nem a hora.
  const novos = await sql`INSERT INTO vybe_midia_checks (cliente_id, chave, dia, feito_por, feito_por_nome, nota)
    VALUES (${k.cliente_id}, ${k.chave}, ${k.dia}, ${Number(pessoa.id)}, ${nome || null}, ${nota || null})
    ON CONFLICT (cliente_id, chave, dia) DO NOTHING RETURNING *`;
  const [linha] = novos.length ? novos : await sql`SELECT * FROM vybe_midia_checks WHERE cliente_id = ${k.cliente_id} AND chave = ${k.chave} AND dia = ${k.dia}`;
  return { check: linhaCheck(linha), ja_estava: !novos.length };
}
export async function desfazerCheck(sql, quem, corpo = {}, { hoje = hojeNaBahia() } = {}) {
  pegarDono(quem);
  const k = chaveValida(corpo, hoje);
  await garantirTabelaChecks(sql);
  const r = await sql`DELETE FROM vybe_midia_checks WHERE cliente_id = ${k.cliente_id} AND chave = ${k.chave} AND dia = ${k.dia} RETURNING id`;
  return { removido: r.length, cliente_id: String(k.cliente_id), chave: k.chave, dia: k.dia };
}
// A rotina de hoje: os itens da cadência, os checks que valem agora (do dia, da semana e do mês) e os últimos 7 dias.
// Os itens de cada cliente chegam com o Meta dele (acao=cliente, `alertas`) e a tela junta com os checks daqui.
export async function lerRotina(sql, quem, { hoje = hojeNaBahia() } = {}) {
  pegarDono(quem);
  await garantirTabelaChecks(sql);
  const ancoras = { dia: ancoraDe('dia', hoje), semana: ancoraDe('semana', hoje), mes: ancoraDe('mes', hoje) };
  const atuais = await sql`SELECT * FROM vybe_midia_checks WHERE dia IN (${ancoras.dia}, ${ancoras.semana}, ${ancoras.mes}) ORDER BY feito_em`;
  const desde = new Date(Date.parse(hoje + 'T12:00:00Z') - 7 * 864e5).toISOString();
  const recentes = await sql`SELECT * FROM vybe_midia_checks WHERE feito_em >= ${desde} ORDER BY feito_em DESC LIMIT 500`;
  // O histórico por dia em que foi feito (hora da Bahia), não pela âncora: "o que a equipe fez em cada dia".
  const porDia = new Map();
  for (const x of recentes) {
    const d = hojeNaBahia(new Date(x.feito_em));
    if (d > hoje) continue;
    const g = porDia.get(d) || { dia: d, feitos: 0, quem: [] };
    g.feitos++; const n = x.feito_por_nome || 'Alguém'; if (!g.quem.includes(n)) g.quem.push(n);
    porDia.set(d, g);
  }
  const historico = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(hoje + 'T12:00:00Z') - i * 864e5).toISOString().slice(0, 10))
    .map((d) => porDia.get(d) || { dia: d, feitos: 0, quem: [] });
  // Só os checks que batem com a âncora da cadência da chave (um check diário de ontem não vale hoje).
  const checks = atuais.map(linhaCheck).filter((c) => REGRAS[c.chave] && ancoraDe(REGRAS[c.chave].cadencia, hoje) === c.dia);
  return { hoje, ancoras, fixos: itensFixos(hoje), checks, historico };
}

export async function areaMidia(req, res, quem, criarBanco, opcoes = {}) {
  if (req.method === 'POST') {
    try {
      const corpo = req.body || {};
      if (corpo.acao === 'check') return res.status(200).json({ ok: true, ...await marcarCheck(criarBanco(), quem, corpo, opcoes) });
      if (corpo.acao === 'desfazer') return res.status(200).json({ ok: true, ...await desfazerCheck(criarBanco(), quem, corpo, opcoes) });
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
    if (acao === 'rotina') return res.status(200).json({ ok: true, ...await lerRotina(sql, quem, opcoes) });
    if (acao === 'anuncios') return res.status(200).json({ ok: true, ...await lerAnuncios(sql, quem, req.query || {}, opcoes) });
    if (acao === 'semana') return res.status(200).json({ ok: true, ...await lerSemana(sql, quem, req.query || {}, opcoes) });
    if (acao === 'relatorio') return res.status(200).json({ ok: true, ...await pedirRelatorio(sql, quem, req.query || {}, opcoes) });
    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (e) {
    if (!e.status) console.error('[midia]', e);
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível abrir a Mídia. Tente novamente.' });
  }
}
