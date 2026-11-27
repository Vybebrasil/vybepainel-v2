// SAFE: o relatório de cada subaba (Paulo, 27/11/2026: "só o de Pessoas? Só o de Assinaturas?"). O motor
// (vybe-relatorio.js) e os registros num vm, com dados fixos e dia fixo; o Finanças lê o GET real de
// server/financeiro.js num PGlite em memória. Sem rede, sem banco de verdade e sem envio de nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { areaFinanceiro } from '../server/financeiro.js';
import { esquecerTabelasFinanceiro } from '../server/financeiro-tabelas.js';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const REGISTROS = readdirSync(new URL('../', import.meta.url)).filter((f) => /^vybe-relatorio-[a-z-]+\.js$/.test(f) && !['vybe-relatorio-graficos.js', 'vybe-relatorio-resumo.js'].includes(f)).sort();
function carregar(extra = {}) {
  const ctx = vm.createContext({ console, Intl, Date, URLSearchParams, setTimeout, clearTimeout, ...extra });
  ctx.window = ctx;
  for (const f of ['vybe-dono-metricas.js', 'vybe-carteira-saude.js', 'vybe-mundo-performance.js', 'vybe-relatorio-graficos.js', 'vybe-relatorio.js', ...REGISTROS]) vm.runInContext(ler(f), ctx, { filename: f });
  return ctx;
}
const HOJE = '2026-11-26';
const DONO = { dono: true, dinheiro: true, nome: 'Paulo' }, COORD = { dono: true, dinheiro: false, nome: 'Beatriz' }, EQUIPE = { dono: false, dinheiro: false, nome: 'Jady' };
const PESSOAS = ['Beatriz', 'Jady', 'Reriston', 'Deivid'].map((name, i) => ({ id: String(i), name }));
const CLIENTES = ['Academia Lions', 'VOA', 'Gonzalez', 'Alpha1'];
function pecasFixas() {
  const out = []; let n = 0;
  ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].forEach((ym, m) => {
    for (let k = 0; k < 20 + m * 2; k++) {
      const dia = `${ym}-${String(1 + (k * 5) % 28).padStart(2, '0')}`;
      const st = ym < '2026-11' ? 'Finalizado' : ['Finalizado', 'Alteração', 'Falta Info', 'Em andamento'][k % 4];
      out.push({ id: `p${n++}`, nome: `Peça ${k}`, cliente: CLIENTES[k % 4], clientes: [CLIENTES[k % 4]], status: st, formato: k % 2 ? 'Reels' : 'Card',
        responsavel_ids: [st === 'Finalizado' ? String(k % 3) : '3'], veiculacao_iso: dia, prazo_iso: dia, status_updated_at: st === 'Finalizado' ? `${dia}T12:00:00-03:00` : '' });
    }
  });
  return out;
}
const DADOS = { pecas: () => pecasFixas(), equipe: () => PESSOAS, demandas: () => [], clientes: () => CLIENTES.map((nome, i) => ({ id: String(i + 1), nome, ativo: true })) };

// As leituras de cada área, no formato das rotas da tela (só o que os relatórios leem).
const META = (inv) => ({ estado: 'ok', investido: inv, investido_anterior: inv * 0.9, resultados: Math.round(inv / 8), resultados_anterior: Math.round(inv / 9), tipo_resultado: 'messages', custo_resultado: 8, custo_anterior: 7, frequencia: 3.4, ctr: 1.5, cpm: 6, conversas: Math.round(inv / 8),
  sinal: { tom: 'a', motivo: 'Frequência 3,4.' }, campanhas: [{ nome: '[MENSAGENS] Delivery', objetivo: 'OUTCOME_ENGAGEMENT', investido: inv * 0.7, resultados: Math.round(inv / 10), custo_resultado: 7, ctr: 1.6 }, { nome: '[ALCANCE] Marca', objetivo: 'OUTCOME_AWARENESS', investido: inv * 0.3, resultados: 5, custo_resultado: inv * 0.06, ctr: 0.8 }] });
const API = {
  carteira: { clientes: [{ id: '1', nome: 'Academia Lions', entrada: '2025-01-01', valor: 1800 }, { id: '2', nome: 'VOA', entrada: '2025-06-01', saida: '2026-11-12', valor: 1200 }, { id: '3', nome: 'Gonzalez', entrada: '2024-03-01' }, { id: '4', nome: 'Alpha1', entrada: '2026-11-03' }],
    churn: { registros: [{ cliente_id: '2', motivo: 'preco', receita_mensal: 1200 }] }, contratos: { lista: [{ cliente_id: '1', inicio: '2025-01-01', renovacao: '2026-12-10', status: 'ativo', valor_mensal: 1800 }, { cliente_id: '3', inicio: '2024-03-01', renovacao: '2026-11-01', status: 'ativo', valor_mensal: 900 }] },
    historico: { meses: [{ mes: '2026-09', media: 70, clientes: 4, alto: 0 }, { mes: '2026-10', media: 66, clientes: 4, alto: 1 }] } },
  'carteira|onboarding': { etapas: [{ cliente: 'Alpha1', clienteId: 4, etapa: 'Briefing', diasParada: 9, responsavel: 'Beatriz', pct: 40 }] },
  reunioes: { tipos: { rotina: 'Rotina com o cliente' }, reunioes: [{ id: 1, cliente_id: 1, data: '2026-11-03', tipo: 'rotina', titulo: 'Reunião de novembro', ata: 'Combinamos 3 posts por semana.' }, { id: 2, cliente_id: 3, data: '2026-08-10', tipo: 'rotina', titulo: 'Agosto', ata: '' }] },
  'midia|carteira': { canais: [{ id: 'meta', nome: 'Meta Ads', fonte: 'vybehub' }], clientes: [{ id: '1', nome: 'Academia Lions', tem_site: true, site: 'lions.com.br', google_ads: '' }, { id: '2', nome: 'VOA', tem_site: false, google_ads: '' }] },
  'midia|cliente': (p) => ({ cliente: { id: p.cliente_id, nome: p.cliente_id === '1' ? 'Academia Lions' : 'VOA' }, meta: META(p.cliente_id === '1' ? 2300 : 900) }),
  'midia|historico': () => ({ semanas: [0, 1, 2, 3].map((k) => ({ de: `2026-10-${String(2 + k * 7).padStart(2, '0')}`, investido: 500 + k * 20, resultados: 60, custo_resultado: 8.3 })) }),
  'midia|rotina': { fixos: [{ chave: 'diario_gastos', cadencia: 'dia', titulo: 'Conferir o gasto de ontem', porque: 'Cinco minutos.' }, { chave: 'semana_revisao', cadencia: 'semana', titulo: 'Revisão da semana', porque: 'Com 7 dias.' }], checks: [{ chave: 'diario_gastos' }], historico: [{ dia: '2026-11-25', feitos: 2, quem: ['Ewerton'] }, { dia: '2026-11-24', feitos: 0, quem: [] }] },
  'comercial|funil': { oportunidades: [{ nome: 'Loja X', etapa: 'proposta', criado_dia: '2026-11-03', responsavel_nome: 'Paulo', valor_mensal: 2000, proxima_acao_data: '2026-11-20' }, { nome: 'Loja Y', etapa: 'ganho', criado_dia: '2026-10-03', ganho_dia: '2026-11-10', valor_mensal: 1500 }, { nome: 'Z', etapa: 'perdido', criado_dia: '2026-11-05' }],
    resumo: { fases: [{ id: 'lead', nome: 'Lead', atual: 1, alcancaram: 3, conversao: 66 }, { id: 'proposta', nome: 'Proposta', atual: 1, alcancaram: 2, conversao: 30 }], motivos_perda: [{ id: 'preco', nome: 'Preço', quantidade: 1, percentual: 100 }], taxa_ganho: 50 }, mes: { propostas: [{ dia: '2026-11-04' }] } },
  'comercial|orcamentos': { orcamentos: [{ id: 1, cliente_nome: 'Loja X', status: 'enviado', criado_em: '2026-11-04T10:00:00Z', validade: '2026-11-30', itens: [{ nome: 'Social media' }], totais: { total_recorrente: 2000 } }, { id: 2, cliente_nome: 'Loja Y', status: 'aceito', criado_em: '2026-11-02T10:00:00Z', itens: [{ nome: 'Social media' }, { nome: 'Tráfego' }], totais: { total_recorrente: 1500, total_avulso: 500 } }, { id: 3, cliente_nome: 'W', status: 'recusado', criado_em: '2026-11-06T10:00:00Z', itens: [{ nome: 'Site' }], totais: { total_avulso: 3000 } }] },
  'setor_pessoas|produtividade': { ranking: [{ nome: 'Jady', cargoNome: 'Designer', score: 82, entregues: 30, meta: 25, atrasadas: 1, frases: ['prazo bom'] }, { nome: 'Reriston', cargoNome: 'Designer', score: 55, entregues: 12, meta: 25, atrasadas: 5, frases: ['atraso pesou'] }], detalhe: { score: 82, entregues: 30, meta: 25, frases: ['prazo bom'] } },
  'setor_pessoas|rh': { indicadores: { abertos: 1, foraDoPrazo: 1, noPrazoPct: 80, respondidos: 5, tempoMedioDias: 1.5 }, pedidos: [{ tipo: 'ferias', status: 'aberto', sla: 'atrasado', atrasoUteis: 2, pessoa_nome: 'Jady', idadeDias: 6, criado_em: '2026-11-20' }], visao: { headcount: 9, admissoes: 1, desligamentos: 0 }, climaResultado: { liberado: false, respostas: 1, minimo: 3 } },
  'setor_pessoas|recrutamento': { vagas: [{ id: 1, titulo: 'Designer pleno', status: 'aberta', aberta_em: '2026-09-01' }], candidatos: [] },
  'setor_pessoas|documentos': { documentos: [{ pessoa_nome: 'Jady', titulo: 'Contrato', situacao: 'renovar', renovacao: '2026-12-10', tipo: 'contrato' }] },
};
let FIN = null;
const api = async (area, p = {}) => {
  if (area === 'financeiro') return FIN;
  const k = API[`${area}|${p.acao || p.aba || ''}`] ?? API[area] ?? null;
  return typeof k === 'function' ? k(p) : k == null ? null : JSON.parse(JSON.stringify(k));
};
const opcoes = (extra = {}) => ({ hoje: HOJE, acesso: DONO, dados: DADOS, api, ...extra });
const ALVO = { clientes: { id: '1', nome: 'Academia Lions' }, midia: { id: '1', nome: 'Academia Lions' } };

// O extrato do Finanças pelo GET de verdade (server/financeiro.js) num PGlite: entradas de cliente, salário, assinatura e fixo.
async function financeiro(t) {
  esquecerTabelasFinanceiro();
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, email text, dono boolean);
    INSERT INTO vybe_pessoas (id, nome) VALUES (1,'Paulo');
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
    INSERT INTO vybe_clientes (id,nome) VALUES (1,'Cliente A');
    CREATE TABLE vybe_cliente_contratos (id serial PRIMARY KEY, cliente_id bigint, valor_mensal numeric, inicio date, renovacao date, status text, observacao text, atualizado_em timestamptz DEFAULT now(), atualizado_por bigint);
    INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, inicio) VALUES (1, 2000, '2026-01-01');
    CREATE TABLE vybe_comercial_financas_cliente (cliente_id bigint PRIMARY KEY, valor_mensal numeric);
    CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL,
      atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id));`);
  const linhas = ['Data;Histórico;Documento;Valor (R$);Saldo (R$)'];
  let saldo = 0;
  for (const m of ['08', '09', '10', '11']) {
    for (const [dia, hist, v] of [['05', 'Pix Recebido Cliente A', 2000], ['08', 'Pix Enviado Fulano Salario', -900], ['10', 'Pagamento Adobe Creative Cloud', -290], ['12', 'Pagto Energia Coelba', -180]]) {
      if (m === '11' && dia > '10') continue;
      saldo += v; linhas.push(`"${dia}/${m}/2026";"${hist}";"";"${v.toFixed(2).replace('.', ',')}";"${saldo.toFixed(2).replace('.', ',')}"`);
    }
  }
  const r = { codigo: 0, body: null, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } };
  const dono = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo', dono: true } };
  await areaFinanceiro({ method: 'POST', body: { acao: 'importar', csv: linhas.join('\r\n') }, query: {} }, r, dono, () => sql);
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  const g = { codigo: 0, body: null, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } };
  await areaFinanceiro({ method: 'GET', body: null, query: {} }, g, dono, () => sql);
  return g.body;
}

test('contrato: os módulos declaram as subabas (id, nome, acesso) e o Finanças são as 8 da tela, só dos donos', () => {
  const R = carregar().VybeRelatorio;
  const ids = (m) => [...R.abas(m, DONO).map((a) => a.id)];
  assert.deepEqual(ids('financas'), ['fin_hoje', 'fin_movimento', 'fin_clientes', 'fin_pessoas', 'fin_assinaturas', 'fin_analise', 'fin_projecao', 'fin_fechamento']);
  assert.deepEqual(ids('producao'), ['semana', 'mes', 'feed', 'grupos', 'equipe']);
  assert.deepEqual(ids('clientes'), ['carteira', 'onboarding', 'reunioes', 'cliente']);
  assert.deepEqual(ids('midia'), ['hoje', 'carteira', 'investimento', 'cliente']);
  assert.deepEqual(ids('comercial'), ['funil', 'orcamentos', 'contratos', 'churn']);
  assert.deepEqual(ids('rh'), ['produtividade', 'rh', 'recrutamento', 'documentos']);
  assert.ok(R.abas('financas', DONO).every((a) => a.acesso === 'dinheiro'), 'dinheiro e salário: só os quatro donos');
  assert.ok(R.abas('clientes', DONO).find((a) => a.id === 'cliente').porAlvo, 'cliente a cliente pede o alvo');
  assert.equal(R.rotuloDaAba('financas', 'fin_pessoas'), 'Finanças · Pessoas');
  assert.equal(R.rotuloDaAba('clientes', 'cliente', { nome: 'VOA' }), 'Clientes · VOA');
});

test('cada aba registrada gera o relatório dela: seções, números e recomendações próprias, título "Módulo · Aba"', async (t) => {
  FIN = await financeiro(t);
  const C = carregar(), R = C.VybeRelatorio;
  for (const m of R.modulos().filter((x) => x.abas.length)) {
    const geral = await R.relatorioDe(m.id, opcoes());
    const titulosGerais = geral.rel.secoes.map((s) => s.titulo).join('|');
    for (const a of m.abas) {
      const alvo = a.porAlvo ? ALVO[m.id] : undefined;
      const r = await R.relatorioDe(m.id, opcoes({ aba: a.id, alvo }));
      const rotulo = R.rotuloDaAba(m.id, a.id, alvo);
      assert.equal(r.aba.id, a.id, `${m.id}/${a.id}: o motor guarda a aba`);
      assert.equal(r.rel.aba?.id ?? r.rel.aba, a.id, `${m.id}/${a.id}: o documento sai marcado com esta aba`);
      assert.ok(r.rel.titulo.startsWith(rotulo), `${m.id}/${a.id}: título "${r.rel.titulo}" começa por "${rotulo}"`);
      assert.ok(r.rel.secoes.length >= 1, `${m.id}/${a.id}: tem seções`);
      assert.ok(r.rel.numeros.length >= 2, `${m.id}/${a.id}: tem números`);
      assert.ok(r.rel.recomendacoes.length >= 1 && r.rel.recomendacoes.every((x) => x.o_que && x.prioridade), `${m.id}/${a.id}: tem recomendações`);
      assert.ok(r.rel.resumo.length >= 1, `${m.id}/${a.id}: o resumo fala desta parte`);
      assert.notEqual(r.rel.secoes.map((s) => s.titulo).join('|'), titulosGerais, `${m.id}/${a.id}: não é o relatório geral recortado igual`);
      const html = await R.documento(m.id, opcoes({ aba: a.id, alvo }));
      assert.match(html, new RegExp(rotulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${m.id}/${a.id}: a capa diz "${rotulo}"`);
    }
  }
});

test('as abas do Finanças falam cada uma da sua parte (Pessoas fala de pagamento a pessoa; Assinaturas de assinatura)', async (t) => {
  FIN = await financeiro(t);
  const R = carregar().VybeRelatorio;
  const pes = (await R.relatorioDe('financas', opcoes({ aba: 'fin_pessoas' }))).rel, ass = (await R.relatorioDe('financas', opcoes({ aba: 'fin_assinaturas' }))).rel;
  assert.notDeepEqual(pes.secoes.map((s) => s.titulo), ass.secoes.map((s) => s.titulo));
  assert.match(pes.titulo, /^Finanças · Pessoas/); assert.match(ass.titulo, /^Finanças · Assinaturas/);
  assert.ok(pes.numeros.every((n) => n.dinheiro), 'tudo da aba Pessoas é dinheiro');
});

test('sem aba sai o relatório geral de sempre; aba desconhecida ou que a função ignora dá erro', async () => {
  const C = carregar(), R = C.VybeRelatorio;
  const g = await R.relatorioDe('producao', opcoes());
  assert.equal(g.aba, null); assert.ok(!g.rel.aba, 'sem aba no documento'); assert.ok(!/· (Semana|Mês|Feed|Grupos|Equipe)/.test(g.rel.titulo), g.rel.titulo);
  await assert.rejects(R.relatorioDe('producao', opcoes({ aba: 'nao-existe' })), /Aba não registrada/);
  R.registrar('teste_ignora', async () => ({ titulo: 'Teste', resumo: ['x'], numeros: [], secoes: [], recomendacoes: [] }), { nome: 'Teste', telas: ['teste'], abas: [{ id: 'a', nome: 'A' }] });
  await assert.rejects(R.relatorioDe('teste_ignora', opcoes({ aba: 'a' })), /não montou a aba/);
});

test('acesso: quem não vê a aba não gera; Finanças (dinheiro) e Mídia só os donos, Recrutamento fora da equipe', async () => {
  const R = carregar().VybeRelatorio;
  for (const quem of [EQUIPE, COORD]) {
    await assert.rejects(R.relatorioDe('financas', opcoes({ acesso: quem, aba: 'fin_pessoas' })), /Sem acesso/, `${quem.nome}: Finanças · Pessoas`);
    assert.equal(R.abas('financas', quem).length, 0, `${quem.nome}: nenhuma aba do Finanças no menu`);
  }
  await assert.rejects(R.relatorioDe('midia', opcoes({ acesso: COORD, aba: 'investimento' })), /Sem acesso/);
  // Uma aba de dinheiro num módulo que todos veem: a equipe vê o módulo, mas não a aba.
  R.registrar('teste_misto', async (ctx) => ({ aba: ctx.aba?.id, titulo: 'Misto', resumo: ['x'], numeros: [], secoes: [{ titulo: 'S' }], recomendacoes: [{ o_que: 'y', prioridade: 'baixa' }] }), { nome: 'Misto', telas: ['misto'], abas: [{ id: 'livre', nome: 'Livre' }, { id: 'salario', nome: 'Salário', dinheiro: true }] });
  assert.deepEqual([...R.abas('teste_misto', EQUIPE).map((a) => a.id)], ['livre']);
  await assert.rejects(R.relatorioDe('teste_misto', opcoes({ acesso: EQUIPE, aba: 'salario' })), /Sem acesso a esta aba/);
  assert.equal((await R.relatorioDe('teste_misto', opcoes({ acesso: EQUIPE, aba: 'livre' }))).aba.id, 'livre');
  await assert.rejects(R.relatorioDe('rh', opcoes({ acesso: EQUIPE, aba: 'recrutamento' })), /Sem acesso a esta aba/);
  assert.deepEqual([...R.abas('rh', EQUIPE).map((a) => a.id)], ['produtividade', 'rh']);
  assert.ok(!R._botao.opcoesDoQue('teste_misto', EQUIPE, 'livre').includes('aba:salario'), 'o menu da equipe não oferece a aba de dinheiro');
});

test('menu: a aba aberta vem marcada ("Só esta aba"), depois "Módulo inteiro" e as outras', () => {
  // O DOM da tela do Finanças com a subaba Pessoas aberta (feCasca: .fe[data-tela="fe-fin_pessoas"]).
  const domFin = { readyState: 'loading', addEventListener() {}, querySelector: (s) => (s === '.fe[data-tela="fe-fin_pessoas"]' ? {} : null) };
  const R = carregar({ document: domFin }).VybeRelatorio;
  assert.equal(R.abaDaTela('financas', 'fin_pessoas')?.id, 'fin_pessoas');
  assert.equal(R.abaDaTela('financas', 'vales')?.id, 'fin_pessoas', 'tela antiga que abre em Pessoas');
  const html = R._botao.opcoesDoQue('financas', DONO, R.abaDaTela('financas', 'fin_pessoas').id);
  assert.match(html, /^<option value="aba:fin_pessoas" selected>Só esta aba \(Pessoas\)<\/option><option value="">Módulo inteiro<\/option><optgroup label="Outras abas">/);
  assert.ok(html.includes('<option value="aba:fin_assinaturas">Assinaturas</option>'));
  assert.ok(!/aba:fin_pessoas"[^>]*>Pessoas</.test(html), 'a aberta não se repete em "Outras abas"');
  // Sem aba registrada aberta: "Módulo inteiro" marcado.
  const sem = R._botao.opcoesDoQue('financas', DONO, null);
  assert.match(sem, /^<option value="" selected>Módulo inteiro<\/option><optgroup label="Só uma aba">/);
  // Produção: a vista marcada no seletor de vistas (#pv2-vistas).
  const domProd = { readyState: 'loading', addEventListener() {}, querySelector: (s) => (s === '#pv2-vistas [data-vista="feed"][aria-checked="true"]' || s === '#pv2-vistas [aria-checked="true"]' ? {} : null), body: { dataset: {} } };
  const P = carregar({ document: domProd }).VybeRelatorio;
  assert.equal(P.abaDaTela('producao', 'gestor')?.id, 'feed');
  assert.equal(P.abaDaTela('producao', 'agenda'), null, 'fora da tela da Produção, nada marcado');
  // Sem DOM (fora do navegador): a tela do dock decide sozinha quando a aba não tem seletor.
  const Z = carregar().VybeRelatorio;
  assert.equal(Z.abaDaTela('comercial', 'orcamentos')?.id, 'orcamentos');
  assert.equal(Z.abaDaTela('financas', 'fin_pessoas'), null, 'sem DOM o Finanças não confirma a aba: Módulo inteiro');
});
