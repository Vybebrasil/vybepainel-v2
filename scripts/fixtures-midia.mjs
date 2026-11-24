// Mídia fictícia (vybe-mundo-midia.js), só no servidor local. Roda o servidor de verdade (server/midia.js) com um banco
// em memória e um VybeHub de mentira que responde no mesmo formato da ponte (portal.metricasOperacionais e
// portal.conviteRelatorio): resumo do período, campanhas (com status, orçamento e início), anúncios (com a miniatura),
// resumo da semana e convite do relatório. Nada sai da máquina.
//
// Para ver a tela com o Hub fora: cookie vybe_demo_hub=fora (o Hub responde 503) ou vybe_demo_hub=desligado (a ponte
// desligada no ambiente). O site e o ID do Google Ads gravam só aqui, no cadastro em memória (somem ao reiniciar).
// Os checks da rotina do gestor gravam num PGlite em memória (a tabela de verdade, vybe_midia_checks), com cinco dias
// de histórico de exemplo do Ewerton e do Paulo.
//
// A carteira do demo (S-Q, 24/11/2026) tem os casos que o gestor encontra de verdade: clientes andando bem, cinco sem
// conta do Meta, um com pagamento pendente (Antonov), um com a verba parada desde ontem (Copirecê), um com frequência
// acima de 3 e campanha velha (Academia Lions), um com custo por resultado subindo (Brussolo), um gastando abaixo do
// orçamento (ConectaSim), um com campanha com problema (VOA), um com campanha pausada no meio da semana (Alpha1), um que
// investiu sem resultado (Hellen) e um sem dados no período (Clínica Sorriso Pleno).
import { PGlite } from '@electric-sql/pglite';
import { areaMidia } from '../server/midia.js';
import { slugDoHub } from '../server/assistente-hub.js';

// Os clientes da Mídia na demonstração: os mesmos da Carteira (CLIENTES_DEMO, passados por quem chama) e mais três, com
// nomes longos como os da operação ("Ace - Associação Comercial e Empresarial de Irecê").
const EXTRAS = [
  { id: 16, nome: 'Ace - Associação Comercial e Empresarial de Irecê', ativo: true, cadastro: {} },
  { id: 17, nome: 'Clínica Odontológica Sorriso Pleno', ativo: true, cadastro: { site: 'https://sorrisopleno.com.br/' } },
  { id: 18, nome: 'Mercadinho Bom Preço', ativo: true, cadastro: {} },
];
// O perfil de cada cliente no Meta: base semanal de investimento e de resultados, o tipo de resultado e a frequência.
// Sem perfil = sem conta de anúncios vinculada no Hub (como boa parte em produção).
//   salto: a última semana ficou mais cara · parou: verba zerada desde ontem · pagamento: conta com pagamento pendente
//   orcamento: orçamento diário sobre o ritmo real (2 = orçamento o dobro do que gasta) · status: status por campanha
//   inicio: dias desde o início por campanha
const PERFIS = {
  1: { verba: 420, res: 48, tipo: 'messages', freq: 3.4, tendencia: 0.04, inicio: [72, 30, 12] },
  2: { verba: 260, res: 31, tipo: 'messages', freq: 1.8, tendencia: -0.02, status: { 2: 'PAUSED' } },
  3: { pagamento: true },
  4: { verba: 180, res: 9, tipo: 'leads', freq: 1.4, tendencia: 0.0, salto: 0.55 },
  5: { verba: 640, res: 96, tipo: 'messages', freq: 2.1, tendencia: 0.03, orcamento: 2.1 },
  6: { verba: 230, res: 27, tipo: 'messages', freq: 1.6, tendencia: 0.01, parou: true },
  8: { verba: 95, res: 5200, tipo: 'reach', freq: 1.2, tendencia: -0.05 },
  10: { verba: 150, res: 18, tipo: 'messages', freq: 1.5, tendencia: 0.02 },
  11: { verba: 150, res: 0, tipo: 'messages', freq: 1.1, tendencia: 0, semResultado: true },
  13: { verba: 310, res: 41, tipo: 'messages', freq: 2.0, tendencia: -0.01 },
  14: { verba: 330, res: 22, tipo: 'purchases', freq: 2.6, tendencia: 0.06, status: { 1: 'WITH_ISSUES' } },
  16: { verba: 210, res: 380, tipo: 'profile_visits', freq: 1.9, tendencia: 0.02 },
  17: { verba: 0, res: 0, tipo: 'messages', freq: 0, tendencia: 0, semDados: true },
};
const CAMPANHAS = [['[MENSAGENS][IRECE] Delivery do fim de semana', 'OUTCOME_ENGAGEMENT', 0.42], ['[CONVERSAO] Matrículas de dezembro', 'OUTCOME_SALES', 0.24],
  ['[ALCANCE][MARCA] Institucional da loja nova', 'OUTCOME_AWARENESS', 0.16], ['[TRAFEGO] Cardápio no site', 'OUTCOME_TRAFFIC', 0.11], ['[REMARKETING] Quem visitou o perfil', 'OUTCOME_ENGAGEMENT', 0.07]];
const ANUNCIOS = [['AD01 · Combo da semana em vídeo curto', 'VIDEO', 'Combo da semana com 20% para quem chamar no WhatsApp até domingo.'],
  ['AD02 · Depoimento da cliente', 'IMAGE', '"Fui atendida no mesmo dia." Agende a sua avaliação pelo WhatsApp.'],
  ['AD03 · Carrossel de bastidores', 'CAROUSEL', 'Os bastidores da semana: como a sua encomenda é preparada.'],
  ['AD04 · Oferta do mês em imagem', 'IMAGE', 'Só em novembro: condições especiais para quem chamar primeiro.']];

const dia = (iso) => Date.parse(iso + 'T12:00:00Z');
const isoDe = (t) => new Date(t).toISOString().slice(0, 10);
const hojeBahia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date());
const semanaN = (iso) => Math.floor(dia(iso) / (7 * 864e5));
// Um "ruído" fixo por cliente e semana, para o gráfico ter forma e a mesma pergunta dar a mesma resposta.
const ruido = (id, n) => { const x = Math.sin(id * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
function periodoDoPerfil(id, p, since, until) {
  const dias = Math.round((dia(until) - dia(since)) / 864e5) + 1;
  const ontem = dia(hojeBahia()) - 864e5;
  let investido = 0, resultados = 0;
  for (let t = dia(since); t <= dia(until); t += 864e5) {
    const n = Math.floor(t / (7 * 864e5)), r = ruido(id, n), idade = semanaN(until) - n;
    // A verba parada: de ontem em diante, nada.
    const verba = p.parou && t >= ontem ? 0 : p.verba / 7 * (1 + p.tendencia * (8 - idade)) * (0.8 + 0.4 * r);
    // O salto: a última semana ficou mais cara (é o que acende o sinal do Ícaro).
    const custoExtra = p.salto && t >= ontem - 6 * 864e5 ? 1 + p.salto : 1;
    investido += verba; resultados += p.semResultado || !verba ? 0 : (p.res / 7) * (verba / (p.verba / 7)) / custoExtra * (0.9 + 0.2 * ruido(id + 3, n));
  }
  investido = Math.round(investido * 100) / 100; resultados = Math.round(resultados);
  return { dias, investido, resultados, custo: resultados ? Math.round((investido / resultados) * 100) / 100 : null };
}
function linhasDoResumo(id, p, since, until) {
  if (p.semDados) return [];
  const atual = periodoDoPerfil(id, p, since, until);
  const ant = periodoDoPerfil(id, p, isoDe(dia(since) - atual.dias * 864e5), isoDe(dia(since) - 864e5));
  const alcance = Math.round(atual.investido * 48), linha = (tipo, x, extra = {}) => ({ tipo, investido: x.investido, resultados: x.resultados, tipoResultado: p.tipo, custoResultado: x.custo, ...extra });
  const campanhas = CAMPANHAS.slice(0, id % 2 ? 5 : 3).map(([nome, objetivo, peso], i) => {
    const inv = Math.round(atual.investido * peso * 100) / 100, res = Math.round(atual.resultados * peso * (1.1 - i * 0.08));
    return { tipo: 'campanha', nome, objetivo, investido: inv, resultados: res, tipoResultado: p.tipo, custoResultado: res ? Math.round((inv / res) * 100) / 100 : null, frequencia: Math.max(1, Math.round((p.freq - i * 0.3) * 10) / 10), ctr: 1.6 - i * 0.2 };
  });
  const melhor = atual.resultados ? [{ tipo: 'anuncio', nome: ANUNCIOS[id % ANUNCIOS.length][0], objetivo: CAMPANHAS[0][0], resultados: Math.round(atual.resultados * 0.38), tipoResultado: p.tipo, custoResultado: atual.custo ? Math.round(atual.custo * 0.86 * 100) / 100 : null }] : [];
  const ctr = Math.round((1.1 + ruido(id, 1) * 0.9) * 100) / 100, cpm = Math.round((5.2 + ruido(id, 2) * 6) * 100) / 100;
  return [linha('total', atual, { alcance, frequencia: p.freq, ctr, cpm, cliques: Math.round(alcance * ctr / 100), conversas: p.tipo === 'messages' ? atual.resultados : 0 }), linha('anterior', ant), ...campanhas, ...melhor];
}
function linhasDasCampanhas(id, p, since, until) {
  const atual = periodoDoPerfil(id, p, since, until), hoje = dia(hojeBahia());
  const ativas = CAMPANHAS.slice(0, id % 2 ? 5 : 3).map(([name, objective, peso], i) => {
    const spent = Math.round(atual.investido * peso * 100) / 100, inicio = (p.inicio || [])[i] ?? 20 + i * 4;
    return { id: String(id * 100 + i), name, objective, status: p.status?.[i] || 'ACTIVE', spent,
      dailyBudget: Math.round((atual.investido / 7) * peso * (p.orcamento || 1.05) * 100) / 100, lifetimeBudget: null, startTime: isoDe(hoje - inicio * 864e5) + 'T09:00:00-0300', stopTime: null,
      impressions: Math.round(spent * 140), reach: Math.round(spent * 48), frequency: Math.max(1, Math.round((p.freq - i * 0.3) * 10) / 10), clicks: Math.round(spent * 3.1),
      results: Math.round(atual.resultados * peso * (1.1 - i * 0.08)), resultType: p.tipo };
  });
  // O Hub só manda campanha com gasto no período (como o Gerenciador).
  return ativas.filter((c) => c.spent > 0);
}
function linhasDosAnuncios(id, p, since, until) {
  const atual = periodoDoPerfil(id, p, since, until);
  return ANUNCIOS.map(([name, format, text], i) => ({ id: String(id * 1000 + i), name, campaign: CAMPANHAS[i % 3][0], status: 'ACTIVE', format, text,
    thumbnail: `https://scontent.demo.fbcdn.net/v/demo-${id}-${i}.jpg`, spent: Math.round(atual.investido * [0.38, 0.27, 0.2, 0.15][i] * 100) / 100,
    impressions: Math.round(atual.investido * 140 * [0.38, 0.27, 0.2, 0.15][i]), reach: Math.round(atual.investido * 48 * [0.38, 0.27, 0.2, 0.15][i]),
    clicks: Math.round(atual.investido * [1.2, 0.8, 0.5, 0.3][i]), results: p.semResultado ? 0 : Math.round(atual.resultados * [0.38, 0.3, 0.18, 0.14][i]), resultType: p.tipo }));
}
const TIPO_TXT = { messages: 'conversas iniciadas', leads: 'cadastros', reach: 'pessoas alcançadas', purchases: 'compras', profile_visits: 'visitas ao perfil' };
const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// No formato do botão "Resumo da semana" do painel do Hub (textoDaSemana, client/src/pages/portal/biWeeklySummary).
function textoDaSemana(nome, id, p, ate) {
  const fim = isoDe(dia(ate) - 864e5), ini = isoDe(dia(fim) - 6 * 864e5);
  const x = periodoDoPerfil(id, p, ini, fim), br = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  const camp = linhasDasCampanhas(id, p, ini, fim).filter((c) => c.status === 'ACTIVE');
  return `📊 *Resumo da semana · ${nome}*\n_${br(ini)} a ${br(fim)}_\n\n💰 Investido: *${brl(x.investido)}*\n🎯 ${TIPO_TXT[p.tipo] ? TIPO_TXT[p.tipo][0].toUpperCase() + TIPO_TXT[p.tipo].slice(1) : 'Resultados'}: *${x.resultados.toLocaleString('pt-BR')}*${x.custo ? `\n💵 Custo por resultado: *${brl(x.custo)}*` : ''}\n\n*Campanhas ativas (${camp.length})*\n` +
    camp.map((c) => `• ${c.name}: ${c.results ? `${c.results.toLocaleString('pt-BR')} ${TIPO_TXT[p.tipo] || 'resultados'}` : 'sem resultado registrado'}`).join('\n') +
    '\n\nPausadas/encerradas desde a semana passada: [MENSAGENS] Black Friday (encerrada)';
}

const json = (status, d) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
function hubFalso(todos, modoHub) {
  return async (endereco) => {
    if (modoHub === 'fora') return json(503, { error: { json: { message: 'Métricas não disponíveis para o cliente/período. Motivo: o servidor do Hub não respondeu.' } } });
    const u = new URL(endereco), entrada = JSON.parse(u.searchParams.get('input')).json;
    const c = todos.find((x) => slugDoHub(x.nome) === entrada.slug);
    if (!c) return json(404, { error: { json: { message: 'Cliente não corresponde.' } } });
    const p = PERFIS[c.id];
    if (u.pathname.endsWith('portal.conviteRelatorio')) {
      if (!p || p.pagamento) return json(400, { error: { json: { message: 'Cliente sem planilha de BI nem conta de anúncio vinculada.' } } });
      return json(200, { result: { data: { json: { caminho: `/relatorio-ai/${entrada.slug}?mes=${entrada.mes}&c=demo_convite_ficticio_${'x'.repeat(24)}` } } } });
    }
    if (!p) return json(503, { error: { json: { message: 'Métricas não disponíveis para o cliente/período. Motivo: Conta de anúncios indisponível.' } } });
    if (p.pagamento) return json(503, { error: { json: { message: 'Métricas não disponíveis para o cliente/período. Motivo: Conta de anúncios com pagamento pendente.' } } });
    const m = entrada.modulo;
    const linhas = m === 'resumo' ? linhasDoResumo(c.id, p, entrada.since, entrada.until)
      : m === 'campanhas' ? (p.semDados ? [] : linhasDasCampanhas(c.id, p, entrada.since, entrada.until))
      : m === 'anuncios' ? (p.semDados ? [] : linhasDosAnuncios(c.id, p, entrada.since, entrada.until))
      : m === 'semana' ? (p.semDados ? [] : [{ texto: textoDaSemana(c.nome, c.id, p, entrada.until) }]) : [];
    return json(200, { result: { data: { json: { slug: entrada.slug, cliente_nome: c.nome, de: entrada.since, ate: entrada.until, modulo: m, deslocamento: 0, linhas: linhas.slice(0, entrada.limite || 25),
      origem_dados: 'homologacao_fixture', limitado: linhas.length > (entrada.limite || 25), atualizado_em: Date.now() } } } });
  };
}

// Os checks da rotina: o PGlite com a tabela de verdade, uma vez por processo, com histórico de exemplo.
let pg = null;
function pglite() {
  if (pg) return pg;
  const db = new PGlite();
  const sql = (parts, ...params) => db.query(parts.reduce((s, x, i) => s + (i ? '$' + i : '') + x, ''), params).then((r) => r.rows);
  pg = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS vybe_midia_checks (id BIGSERIAL PRIMARY KEY, cliente_id BIGINT NOT NULL DEFAULT 0, chave TEXT NOT NULL, dia DATE NOT NULL,
      feito_por BIGINT NOT NULL, feito_por_nome TEXT, feito_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), nota TEXT, UNIQUE (cliente_id, chave, dia))`;
    const h = dia(hojeBahia());
    for (let d = 1; d <= 5; d++) {
      const iso = isoDe(h - d * 864e5), quem = d % 2 ? ['Ewerton', 3] : ['Paulo', 1];
      const feitos = [['diario_gastos', 0], ['diario_pagamentos', 0], ['diario_reprovados', 0], ['cpr_subiu', 4], ['frequencia', 1]].slice(0, 5 - (d % 3));
      for (const [k, cid] of feitos) await sql`INSERT INTO vybe_midia_checks (cliente_id, chave, dia, feito_por, feito_por_nome, feito_em) VALUES (${cid}, ${k}, ${iso}, ${quem[1]}, ${quem[0]}, ${iso + 'T12:' + String(10 + feitos.length * 3).padStart(2, '0') + ':00Z'}) ON CONFLICT DO NOTHING`;
    }
    return sql;
  })();
  return pg;
}

// O banco em memória: só as consultas que server/midia.js faz. Os checks vão para o PGlite.
function bancoFalso(todos, checks) {
  return async (partes, ...v) => {
    const q = partes.join('?');
    if (/vybe_midia_checks/.test(q)) return checks(partes, ...v);
    if (/ALTER TABLE/.test(q)) return [];
    if (/to_regclass/.test(q)) return [{ existe: true }];
    if (/FROM vybe_cliente_registros/.test(q)) return Number(v[0]) === 1 ? [{ tipo: 'aprendizado', titulo: 'Auditoria Meta Ads (demonstração)', resumo: 'Frequência acima de 3 na campanha de mensagens.', criado_em: new Date(Date.now() - 2 * 864e5).toISOString() },
      { tipo: 'decisao', titulo: 'Verba do delivery sobe 20% em dezembro', resumo: '', criado_em: new Date(Date.now() - 6 * 864e5).toISOString() }] : [];
    if (/^UPDATE vybe_clientes SET cadastro/.test(q.trim())) { const c = todos.find((x) => x.id === Number(v[1])); if (c) c.cadastro = JSON.parse(v[0]); return []; }
    if (/SELECT id, cadastro FROM vybe_clientes/.test(q)) { const c = todos.find((x) => x.id === Number(v[0]) && x.ativo !== false); return c ? [{ id: c.id, cadastro: c.cadastro || {} }] : []; }
    if (/WHERE id ?= ?\?/.test(q)) { const c = todos.find((x) => x.id === Number(v[0]) && x.ativo !== false); return c ? [{ id: String(c.id), nome: c.nome }] : []; }
    if (/FROM vybe_clientes c WHERE/.test(q)) return todos.filter((c) => c.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((c) => ({ id: String(c.id), nome: c.nome, site: String(c.cadastro?.site || '').trim() || null, google_ads: String(c.cadastro?.google_ads || '').trim() || null }));
    return [];
  };
}

export async function midiaDemo(req, url, body, reply, clientesDemo = []) {
  const todos = [...clientesDemo, ...EXTRAS];
  const modoHub = (String(req.headers.cookie || '').match(/vybe_demo_hub=(fora|desligado)/) || [])[1] || '';
  const config = { VYBE_AI_HUB_ATIVO: modoHub === 'desligado' ? '0' : '1', VYBE_AI_HUB_URL: 'https://vybehub.vercel.app/', VYBE_OS_METRICAS_TOKEN: 'D'.repeat(64), VYBE_AI_HUB_CLIENTES: 'auto' };
  let corpo = {};
  if (req.method === 'POST') { try { corpo = JSON.parse(String(body || '{}')); } catch { return reply(400, { error: 'JSON inválido.' }); } }
  const quem = String(req.headers.cookie || '').includes('vybe_demo=1') ? { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Martins', dono: true } } : null;
  const checks = await pglite();
  const banco = bancoFalso(todos, checks);
  let status = 200, saida = null;
  const res = { status(s) { status = s; return this; }, json(d) { saida = d; return this; } };
  const erroLog = console.error; console.error = () => {};
  try { await areaMidia({ method: req.method, query: Object.fromEntries(url.searchParams), body: corpo }, res, quem, () => banco, { config, buscar: hubFalso(todos, modoHub) }); }
  finally { console.error = erroLog; }
  return reply(status, saida);
}
