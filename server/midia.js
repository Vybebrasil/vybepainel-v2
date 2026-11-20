// Mídia (Vinícius, 20/11/2026): o módulo interno onde a gestão acompanha toda a mídia de cada cliente — Meta Ads, Google
// Ads e o tráfego do site — e onde o Ícaro (agente de Mídia Paga, 5º andar) mostra o que pede atenção. Só os quatro donos.
//
// Nada de integração nova: o Meta vem do VybeHub pela mesma ponte do bot (assistente-hub.js, módulo `resumo`). Google Ads
// e site ainda não têm fonte em nenhum sistema da Vybe: o canal aparece como "não conectado", nunca com número zerado.
// O módulo só lê. Mexer em campanha continua fora do sistema, com aprovação de um dono (regra do Ícaro, sombra).
//
//   GET area=midia&acao=carteira                        → clientes ativos e o estado de cada canal
//   GET area=midia&acao=cliente&cliente_id=N&dias=7|30  → o Meta do cliente no período e os últimos registros do cérebro
import { ehDonoPessoa } from './donos.js';
import { metricasDoHub } from './assistente-hub.js';

const erro = (status, message) => Object.assign(new Error(message), { status });

// Os canais de mídia de cada cliente. `fonte: null` = ainda sem conexão: a tela guarda o lugar e diz o que falta.
export const CANAIS = Object.freeze([
  Object.freeze({ id: 'meta', nome: 'Meta Ads', fonte: 'vybehub', falta: '' }),
  Object.freeze({ id: 'google', nome: 'Google Ads', fonte: null, falta: 'Conectar a conta do Google Ads da Vybe (MCC) e vincular a conta do cliente.' }),
  Object.freeze({ id: 'site', nome: 'Site', fonte: null, falta: 'Conectar o Google Analytics do site do cliente.' }),
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

export async function lerCarteira(sql, quem, { config = process.env } = {}) {
  pegarDono(quem);
  const clientes = await sql`SELECT id::text, nome, NULLIF(TRIM(COALESCE(to_jsonb(c)->'cadastro'->>'site', '')), '') AS site
    FROM vybe_clientes c WHERE COALESCE(ativo, true) AND NOT COALESCE(nao_e_cliente, false) ORDER BY nome`;
  return {
    canais: CANAIS, dias: DIAS_DO_PERIODO, hub_ativo: config.VYBE_AI_HUB_ATIVO === '1',
    clientes: clientes.map((c) => ({ id: c.id, nome: c.nome, tem_site: Boolean(c.site) })),
  };
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
    const msg = String(e?.message || '');
    meta = semConta(msg) ? { estado: 'sem_conta', motivo: 'Sem conta de anúncios vinculada no VybeHub.' }
      : { estado: 'erro', motivo: e?.publica || e?.status === 503 ? msg.slice(0, 200) : 'Não foi possível buscar o Meta agora.' };
  }
  // O que o Ícaro e os chats já decidiram ou aprenderam sobre o cliente (o cérebro do Vybe OS), os 5 mais novos.
  let registros = [];
  const [t] = await sql`SELECT to_regclass('vybe_cliente_registros') IS NOT NULL AS existe`;
  if (t?.existe) registros = await sql`SELECT tipo, titulo, resumo, criado_em FROM vybe_cliente_registros
    WHERE cliente_id = ${id} AND tipo IN ('decisao', 'aprendizado') ORDER BY criado_em DESC LIMIT 5`;
  return { cliente: { id: c.id, nome: c.nome }, periodo: p, meta,
    registros: registros.map((x) => ({ tipo: x.tipo, titulo: x.titulo, resumo: String(x.resumo || '').slice(0, 400), criado_em: x.criado_em })) };
}

export async function areaMidia(req, res, quem, criarBanco, opcoes = {}) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const sql = criarBanco();
    const acao = String(req.query?.acao || 'carteira');
    if (acao === 'carteira') return res.status(200).json({ ok: true, ...await lerCarteira(sql, quem, opcoes) });
    if (acao === 'cliente') return res.status(200).json({ ok: true, ...await lerClienteMidia(sql, quem, req.query || {}, opcoes) });
    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (e) {
    if (!e.status) console.error('[midia]', e);
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível abrir a Mídia. Tente novamente.' });
  }
}
