// SAFE: o relatório técnico dos módulos (vybe-relatorio.js, vybe-relatorio-graficos.js e os registros
// vybe-relatorio-<modulo>.js) num vm, com dados fixos e dia fixo; sem rede, sem banco e sem DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const REGISTROS = readdirSync(new URL('../', import.meta.url)).filter((f) => /^vybe-relatorio-[a-z-]+\.js$/.test(f) && !['vybe-relatorio-graficos.js', 'vybe-relatorio-resumo.js'].includes(f)).sort();
function carregar(extras = REGISTROS) {
  const ctx = vm.createContext({ console, Intl, Date, URLSearchParams, setTimeout, clearTimeout });
  ctx.window = ctx;
  for (const f of ['vybe-dono-metricas.js', 'vybe-carteira-saude.js', 'vybe-relatorio-graficos.js', 'vybe-relatorio.js', ...extras]) vm.runInContext(ler(f), ctx, { filename: f });
  return ctx;
}
const C = carregar();
const R = C.VybeRelatorio, G = C.VybeRelGraficos;
const HOJE = '2026-11-26';
const DONO = { dono: true, dinheiro: true, nome: 'Paulo' }, EQUIPE = { dono: false, dinheiro: false, nome: 'Jady' };

// Peças fixas: 6 meses fechados quase todos prontos e novembro com atraso concentrado em Deivid.
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
const json = (x) => JSON.parse(JSON.stringify(x));

// ---------- Gráficos ----------
test('gráficos: cada tipo devolve um <svg> com viewBox; sem dado, texto vazio', () => {
  const base = { rotulos: ['jun', 'jul', 'ago'], series: [{ nome: 'A', valores: [1, 2, 3] }, { nome: 'B', valores: [3, null, 1] }], fatias: [{ rotulo: 'x', valor: 2 }, { rotulo: 'y', valor: 1 }],
    passos: [{ rotulo: 'início', valor: 10 }, { rotulo: 'entrou', valor: 4 }, { rotulo: 'saiu', valor: -3 }], linhas: ['a', 'b'], colunas: ['s', 't'], valores: [[1, 2], [0, null]], itens: [{ rotulo: 'p', valor: 3 }] };
  for (const tipo of G.TIPOS) {
    const svg = G.desenhar({ tipo, ...base });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ [\d.]+"/, tipo);
    assert.ok(svg.endsWith('</svg>'), tipo);
    assert.equal(G.desenhar({ tipo, rotulos: [], series: [], fatias: [], passos: [], linhas: [], itens: [] }), '', `${tipo} vazio`);
  }
  assert.equal(G.desenhar({ tipo: 'pizza3d' }), '');
  assert.equal(G.desenhar(null), '');
});

test('gráficos: legíveis em preto e branco (traço, marcador e hachura por série)', () => {
  const l = G.linha({ rotulos: ['a', 'b', 'c'], series: [{ nome: 'A', valores: [1, 2, 3] }, { nome: 'B', valores: [2, 1, 2] }, { nome: 'C', valores: [3, 3, 1] }] });
  const tracos = [...l.matchAll(/<path d="M[^"]+" fill="none" stroke="#[0-9A-F]+" stroke-width="2" stroke-dasharray="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(new Set(tracos).size, 3, 'cada série com um traço diferente');
  assert.match(l, /<rect x="[\d.]+" y="[\d.]+" width/, 'marcador quadrado na segunda série');
  const b = G.barras({ rotulos: ['a'], series: [{ nome: 'A', valores: [1] }, { nome: 'B', valores: [2] }] });
  assert.match(b, /<pattern id="g\d+-h1"[^>]*>.*<path d="M-1 7/, 'hachura diagonal na segunda série');
  assert.match(b, /fill="url\(#g\d+-h0\)"/);
  // Ids próprios por gráfico: dois gráficos no mesmo documento não dividem a hachura.
  const ids = (s) => [...s.matchAll(/<pattern id="(g\d+)-h0"/g)].map((m) => m[1]);
  assert.notEqual(ids(b)[0], ids(G.barras({ rotulos: ['a'], series: [{ nome: 'A', valores: [1] }] }))[0]);
  assert.doesNotMatch(G.ranking({ itens: [{ rotulo: '<script>', valor: 1 }] }), /<script>/, 'rótulo escapado');
});

test('gráficos: escala redonda e cascata soma passo a passo', () => {
  assert.deepEqual(json(G.escala(0, 37)), { lo: 0, hi: 40, marcas: [0, 10, 20, 30, 40] });
  const c = G.cascata({ passos: [{ rotulo: 'início', valor: 10 }, { rotulo: 'menos', valor: -4 }, { rotulo: 'fim', valor: 6, total: true }] });
  assert.match(c, />−4</);
  assert.match(c, />6</);
});

// ---------- Períodos e contas ----------
test('períodos: este mês, mês passado, 3 meses e personalizado, com o anterior do mesmo tamanho', () => {
  const m = R.periodo('mes', { hoje: HOJE });
  assert.equal(m.inicio, '2026-11-01'); assert.equal(m.fim, '2026-11-30'); assert.equal(m.rotulo, 'Novembro de 2026');
  assert.equal(m.anterior.inicio, '2026-10-01'); assert.equal(m.anterior.fim, '2026-10-31'); assert.equal(m.emCurso, true);
  const p = R.periodo('mes_passado', { hoje: HOJE });
  assert.equal(p.inicio, '2026-10-01'); assert.equal(p.fim, '2026-10-31'); assert.equal(p.fechado, true);
  const t = R.periodo('3m', { hoje: '2027-01-10' });
  assert.equal(t.inicio, '2026-11-01'); assert.equal(t.fim, '2027-01-31'); assert.deepEqual(json(t.meses), ['2026-11', '2026-12', '2027-01']);
  assert.equal(t.anterior.inicio, '2026-08-01'); assert.equal(t.anterior.fim, '2026-10-31');
  const x = R.periodo({ inicio: '2026-11-20', fim: '2026-11-10' }, { hoje: HOJE });
  assert.equal(x.inicio, '2026-11-10'); assert.equal(x.fim, '2026-11-20'); assert.equal(x.anterior.fim, '2026-11-09'); assert.equal(x.anterior.inicio, '2026-10-30');
  assert.equal(R.periodo('qualquer', { hoje: HOJE }).chave, 'mes');
});

test('contas: variação com o lado bom, tendência, projeção e ritmo', () => {
  const u = R.util;
  const v = u.variacao(12, 10, 'menor');
  assert.equal(v.direcao, 'sobe'); assert.equal(v.bom, false); assert.match(v.texto, /^▲ \+20% vs período anterior$/);
  assert.equal(u.variacao(5, 5, 'maior').bom, null);
  assert.equal(u.variacao(null, 5), null);
  assert.match(u.variacao(80, 70, 'maior', { pontos: true }).texto, /\+10 p\.p\./);
  assert.deepEqual(json(u.projetar([10, 20, 30], 2)), [40, 50]);
  assert.equal(u.projetar([5, 3, 1, 0], 3).every((n) => n >= 0), true, 'projeção nunca negativa');
  assert.equal(u.tendenciaTexto([10, 20, 30, 40]).sentido, 'alta');
  assert.equal(u.tendenciaTexto([10, 10.2, 9.9, 10]).sentido, 'estavel');
  const r = u.ritmo({ feito: 10, inicio: '2026-11-01', fim: '2026-11-30', hoje: '2026-11-10' });
  assert.equal(r.projetado, 30); assert.equal(r.restam, 20);
});

// ---------- Documento ----------
test('documento: A4, cabeçalho e rodapé com página n de N, capa e capítulos na ordem pedida', () => {
  const rel = { titulo: 'Teste <b>', resumo: ['Frase 1.', 'Frase 2.', 'Frase 3.'], agente: { nome: 'Heitor', papel: 'Coordenação' },
    numeros: [{ rotulo: 'Peças', valor: '10', variacao: { texto: '▲ +2', bom: true }, porque: 'porque sim' }],
    secoes: [{ titulo: 'Seção A', texto: 'texto A', grafico: { tipo: 'barras', rotulos: ['a'], series: [{ nome: 'x', valores: [1] }] }, tabela: { colunas: ['Col', 'N'], linhas: [['a', '1']] } }],
    historico: { texto: 'hist' }, projecao: { texto: 'proj' },
    recomendacoes: [{ o_que: 'Baixa', prioridade: 'baixa' }, { o_que: 'Alta', por_que: 'p', impacto: 'i', prioridade: 'alta' }, { o_que: 'Média', prioridade: 'média' }],
    fontes: [{ nome: 'DADOS_ALL', detalhe: 'peças', lido_em: '26/11/2026 10:00' }] };
  const html = R.montar(rel, { modulo: 'Produção', periodo: 'Novembro de 2026', geradoEm: '26/11/2026 10:00', geradoPor: 'Paulo' });
  assert.match(html, /@page\{size:A4;margin:/);
  assert.match(html, /@bottom-right\{content:"Página " counter\(page\) " de " counter\(pages\)/);
  assert.match(html, /@top-left\{content:url\("data:image\/svg\+xml;utf8,[^"]+"\) "  " "Vybe · Produção · Relatório técnico"/);
  assert.match(html, /@bottom-left\{content:"Gerado em 26\/11\/2026 10:00 por Paulo · Vybe OS"/);
  assert.match(html, /figure\{[^}]*break-inside:avoid/);
  assert.ok(!html.includes('Teste <b>'), 'título escapado');
  const ordem = ['class="capa"', '>Resumo executivo<', '>Números-chave<', '>Seção A<', '>Histórico e tendência<', '>Projeção<', '>O que fazer<', '>Metodologia e fontes<'].map((s) => html.indexOf(s, html.indexOf('<main')));
  assert.ok(ordem.every((i) => i > 0), JSON.stringify(ordem));
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem, 'capítulos na ordem');
  const recs = [...html.matchAll(/<div class="rec"><div class="prio (\w+)">/g)].map((m) => m[1]);
  assert.deepEqual(recs, ['alta', 'media', 'baixa'], 'o que fazer priorizado');
  assert.match(html, /Heitor · Coordenação/);
  assert.match(html, /<svg xmlns/);
});

test('acesso: quem não é dono não recebe dinheiro nem área de dono, nem em coluna de tabela', () => {
  const rel = { numeros: [{ rotulo: 'Peças', valor: 1 }, { rotulo: 'Receita', valor: 'R$ 10', dinheiro: true }, { rotulo: 'Só donos', valor: 2, soDonos: true }],
    secoes: [{ titulo: 'Tabela', tabela: { colunas: ['Cliente', { rotulo: 'Mensalidade', dinheiro: true }], linhas: [['A', 'R$ 500']] } }, { titulo: 'Salários', dinheiro: true }],
    recomendacoes: [{ o_que: 'Cobrar', dinheiro: true }, { o_que: 'Entregar' }], fontes: [{ nome: 'financeiro', dinheiro: true }, { nome: 'peças' }] };
  const e = json(R.filtrar(rel, EQUIPE));
  assert.deepEqual(e.numeros.map((x) => x.rotulo), ['Peças']);
  assert.deepEqual(e.secoes.map((x) => x.titulo), ['Tabela']);
  assert.deepEqual(e.secoes[0].tabela.colunas, ['Cliente']); assert.deepEqual(e.secoes[0].tabela.linhas, [['A']]);
  assert.deepEqual(e.recomendacoes.map((x) => x.o_que), ['Entregar']);
  assert.deepEqual(e.fontes.map((x) => x.nome), ['peças']);
  const coord = json(R.filtrar(rel, { dono: true, dinheiro: false }));
  assert.deepEqual(coord.numeros.map((x) => x.rotulo), ['Peças', 'Só donos'], 'coordenação vê área de dono, sem dinheiro');
  const d = json(R.filtrar(rel, DONO));
  assert.equal(d.numeros.length, 3); assert.equal(d.secoes[0].tabela.colunas.length, 2);
  assert.ok(!R.montar(R.filtrar(rel, EQUIPE), { modulo: 'X' }).includes('R$ 500'), 'o valor some do documento');
});

test('registro: módulo de dinheiro não gera para quem não é dono', async () => {
  const c = carregar([]);
  c.VybeRelatorio.registrar('teste-dinheiro', () => ({ titulo: 'x' }), { acesso: 'dinheiro', telas: ['midia'] });
  await assert.rejects(() => c.VybeRelatorio.documento('teste-dinheiro', { hoje: HOJE, acesso: EQUIPE, api: async () => null }), /Sem acesso/);
  const html = await c.VybeRelatorio.documento('teste-dinheiro', { hoje: HOJE, acesso: DONO, api: async () => null });
  assert.match(html, /<h1>x<\/h1>/);
  await assert.rejects(() => c.VybeRelatorio.documento('nao-existe', { hoje: HOJE, acesso: DONO }), /não registrado/);
  assert.equal(c.VybeRelatorio.registrar('', () => ({})), false);
  // O relatório mensal do cliente continua no mesmo objeto (vybe-mundo-relatorio.js carrega antes).
  const c2 = vm.createContext({ console, Intl, Date, URLSearchParams }); c2.window = c2;
  vm.runInContext('window.VybeRelatorio = Object.freeze({ abrir: () => "mensal", fechar() {}, aberto: () => false });', c2);
  vm.runInContext(ler('vybe-relatorio.js'), c2);
  assert.equal(c2.VybeRelatorio.abrir(), 'mensal'); assert.equal(typeof c2.VybeRelatorio.registrar, 'function');
});

// ---------- Registros ----------
const gerar = (modulo, extra = {}) => C.VybeRelatorio.relatorioDe(modulo, { hoje: HOJE, acesso: DONO, dados: DADOS, api: async () => null, ...extra }).then((r) => json(r.rel));

test('Produção: tendência, atrasados com quem, gargalo, projeção e recomendações pelos números', async () => {
  const r = await gerar('producao');
  assert.equal(r.agente.nome, 'Heitor');
  assert.ok(r.resumo.length >= 3 && r.resumo.length <= 5, 'resumo de 3 a 5 frases');
  const titulos = r.secoes.map((s) => s.titulo);
  for (const t of ['Entregas mês a mês', 'Gargalos: onde as peças param', 'Quem está atrasado e com o quê', 'Carga por pessoa']) assert.ok(titulos.includes(t), t);
  const atrasados = r.secoes.find((s) => s.titulo === 'Quem está atrasado e com o quê');
  assert.ok(atrasados.tabela.linhas.length > 0); assert.ok(atrasados.tabela.linhas.every((l) => l[3] === 'Deivid'), 'o atraso é do Deivid');
  assert.match(r.recomendacoes[0].o_que, /Destravar as \d+ atrasadas, começando por Deivid/);
  assert.ok(r.recomendacoes.every((x) => x.por_que && x.impacto && x.prioridade));
  assert.match(r.projecao.texto[0], /Ritmo do período em curso/);
  const entregas = r.secoes.find((s) => s.titulo === 'Entregas mês a mês');
  assert.equal(entregas.tabela.linhas.length, 6);
  assert.equal(r.numeros.find((n) => n.rotulo === 'Peças no período').valor, '30');
  // Mês em curso compara com o anterior até o mesmo dia.
  assert.match(r.numeros[0].variacao.texto, /vs outubro de 2026 até 26\/10/);
});

// Todos os registros geram com o painel vazio e o servidor fora (sem quebrar, com recomendação e metodologia).
test('registros: todos geram sem dado nenhum e sem servidor', async () => {
  const vazio = { pecas: () => [], equipe: () => [], demandas: () => [], clientes: () => [] };
  for (const m of C.VybeRelatorio.modulos().map((x) => x.id)) {
    const r = await gerar(m, { dados: vazio });
    assert.ok(r.titulo && r.resumo.length >= 1 && r.resumo.length <= 5, `${m}: resumo`);
    assert.ok(r.recomendacoes.length >= 1, `${m}: recomendação`);
    const html = await C.VybeRelatorio.documento(m, { hoje: HOJE, acesso: DONO, dados: vazio, api: async () => null });
    assert.match(html, /Metodologia e fontes/, `${m}: documento`);
  }
});

test('Demandas: tipos, atrasadas com quem e tarefas, travadas perto do prazo', async () => {
  const dem = [
    { id: 'd1', nome: 'Panfleto Black Friday', tipo: 'Impresso', cliente: 'VOA', status: 'Em andamento', responsavel_ids: ['3'], conclusao_iso: '2026-11-20', tarefas: 4, tarefas_feitas: 1 },
    { id: 'd2', nome: 'Site novo', tipo: 'Site', cliente: 'Gonzalez', status: 'Em andamento', responsavel_ids: ['1'], conclusao_iso: '2026-11-28', tarefas: 5, tarefas_feitas: 0 },
    { id: 'd3', nome: 'Banner loja', tipo: 'Impresso', cliente: 'Alpha1', status: 'Finalizado', responsavel_ids: ['0'], conclusao_iso: '2026-11-10', status_updated_at: '2026-11-09T10:00:00-03:00' },
    { id: 'd4', nome: 'Evento', tipo: 'Evento', cliente: 'VOA', status: 'Finalizado', responsavel_ids: ['0'], conclusao_iso: '2026-10-12', status_updated_at: '2026-10-12T10:00:00-03:00' },
  ];
  const r = await gerar('demandas', { dados: { ...DADOS, demandas: () => dem } });
  assert.equal(r.numeros[0].valor, '3');
  assert.equal(r.numeros.find((n) => n.rotulo === 'Atrasadas').valor, '1');
  const atr = r.secoes.find((s) => s.titulo === 'Quem está atrasado e com o quê');
  assert.deepEqual([atr.tabela.linhas[0][1], atr.tabela.linhas[0][4], atr.tabela.linhas[0][5]], ['Panfleto Black Friday', 'Deivid', '1/4']);
  assert.match(r.resumo.join(' '), /impresso \(2\)/);
  assert.ok(r.recomendacoes.some((x) => /vencem em até 3 dias sem tarefa feita/.test(x.o_que)), 'Site novo vence em 2 dias sem tarefa');
});

const CAPT = { ok: true, clientes: [{ id: '1', nome: 'VOA' }, { id: '2', nome: 'Gonzalez' }], captacoes: [
  { id: '1', cliente: 'VOA', dia: '2026-11-05', estado: 'gravada', fechada_em: '2026-11-05', pecas: [{ id: '10', gravado: true, tipo: 'video' }, { id: '11', gravado: true, tipo: 'foto' }] },
  { id: '2', cliente: 'VOA', dia: '2026-11-20', estado: 'agendada', pecas: [{ id: '12', gravado: false, tipo: 'video' }] },
  { id: '3', cliente: 'Gonzalez', dia: '2026-11-30', estado: 'agendada', pecas: [{ id: '13', gravado: false, tipo: 'video' }] },
  { id: '4', cliente: 'VOA', dia: '2026-10-08', estado: 'gravada', fechada_em: '2026-10-08', pecas: [{ id: '9', gravado: true, tipo: 'video' }] },
] };
test('Agenda: captações do período, falta fechar, peças sem captação e sem repetir entre janelas', async () => {
  const chamadas = [];
  const pecas = [...pecasFixas(), { id: '13', nome: 'Reels marcado', status: 'Agendar Captação', veiculacao_iso: '2026-12-01', cliente: 'Gonzalez', clientes: ['Gonzalez'] },
    { id: 'x1', nome: 'Reels sem dia', status: 'Agendar Captação', veiculacao_iso: '2026-11-29', cliente: 'Alpha1', clientes: ['Alpha1'] }];
  const r = await gerar('agenda', { dados: { ...DADOS, pecas: () => pecas }, api: async (area, p) => { chamadas.push([area, p]); return area === 'captacoes' ? CAPT : null; } });
  assert.ok(chamadas.length > 1 && chamadas.every(([a, p]) => a === 'captacoes' && p.dias === 42), 'janelas de 42 dias');
  assert.equal(r.numeros[0].valor, '3');
  assert.equal(r.numeros.find((n) => n.rotulo === 'Falta fechar').valor, '1');
  assert.equal(r.numeros.find((n) => n.rotulo === 'Sem captação marcada').valor, '1');
  assert.match(r.recomendacoes[0].o_que, /Marcar captação para as 1 peças/);
  assert.ok(r.secoes.find((s) => s.titulo === 'Gravações que faltam fechar').tabela.linhas[0][1] === 'VOA');
});

test('Aprovação: fila interna e do cliente, parados há mais de 3 dias, aprovação pelo link e equilíbrio', async () => {
  const apr = { pecas: [
    { titulo: 'Card 1', cliente: 'VOA', etapa: 'interna', status: 'Para aprovação', horas: 100 },
    { titulo: 'Card 2', cliente: 'VOA', etapa: 'interna', status: 'Para aprovação', horas: 5 },
    { titulo: 'Reels', cliente: 'Gonzalez', etapa: 'cliente', status: 'Ag. Aprovação Cliente', horas: 50 },
  ], planejamentos: [{ cliente: 'Alpha1', mes: '2026-12', estado: 'enviado', pecas: 20, horas: 30 }] };
  const ids = pecasFixas().filter((d) => d.veiculacao_iso >= '2026-11-01').map((d) => d.id);
  const obj = { objetivos: Object.fromEntries(ids.map((id, i) => [id, i % 10 === 0 ? 'conversao' : 'atracao'])), respostas: { [ids[0]]: { acao: 'aprovar' }, [ids[1]]: { acao: 'ajuste' } } };
  const r = await gerar('aprovacao', { api: async (area) => (area === 'aprovacoes' ? apr : area === 'conteudo_modulo' ? obj : null) });
  assert.equal(r.numeros[0].valor, '2'); assert.equal(r.numeros[1].valor, '1'); assert.equal(r.numeros[3].valor, '1');
  assert.equal(r.numeros.find((n) => /pelo link/.test(n.rotulo)).valor, '50%');
  assert.match(r.recomendacoes[0].o_que, /Destravar os 1 itens parados há mais de 3 dias, a começar por Card 1/);
  assert.ok(r.recomendacoes.some((x) => /Planejar mais peças de educação/.test(x.o_que)));
});

test('Direção de arte: carga do time, fila do parecer e taxa de alteração', async () => {
  const apr = { pecas: [{ titulo: 'Card 1', cliente: 'VOA', etapa: 'interna', status: 'Para aprovação', horas: 30 }] };
  C.EQUIPES = { design: ['1', '3'] }; // Jady e Deivid (vybe-config.js usa o id do Monday)
  const r = await gerar('direcao', { api: async (area) => (area === 'aprovacoes' ? apr : null) });
  assert.equal(r.agente.nome, 'Danilo');
  assert.equal(r.numeros.find((n) => n.rotulo === 'Esperando parecer').valor, '1');
  assert.ok(Number(r.numeros.find((n) => n.rotulo === 'Taxa de alteração').valor.replace('%', '')) > 0);
  assert.ok(r.recomendacoes.some((x) => /parecer/.test(x.o_que)));
  const carga = r.secoes.find((s) => s.titulo === 'Carga do time').tabela.linhas.map((l) => l[0]).sort();
  assert.deepEqual(carga, ['Deivid', 'Jady'], 'só o time de design');
  delete C.EQUIPES;
});

test('Clientes: nota da carteira, piores com motivo, saídas e receita só para dono', async () => {
  const cart = { sinais: null, clima: null, historico: { meses: [{ mes: '2026-09-01', media: 80, clientes: 4, alto: 0 }, { mes: '2026-10-01', media: 78, clientes: 4, alto: 0 }, { mes: '2026-11-01', media: 70, clientes: 4, alto: 1 }] },
    clientes: [{ id: '9', nome: 'Velha', entrada: '2025-01-10', saida: '2026-11-12', valor: 3000 }, { id: '10', nome: 'Nova', entrada: '2026-11-03' }], churn: { registros: [{ cliente_id: '9', motivo: 'preco', receita_mensal: 3000 }] } };
  const api = async (area, p) => (area === 'carteira' && !p ? cart : area === 'carteira' ? { etapas: [{ cliente: 'Nova', etapa: 'Kickoff', pct: 20, diasParada: 9 }] } : null);
  const r = await gerar('clientes', { api });
  assert.equal(r.agente.nome, 'Mateus');
  assert.equal(r.numeros.find((n) => n.rotulo === 'Saídas no período').valor, '1');
  assert.equal(r.numeros.find((n) => n.rotulo === 'Onboardings parados').valor, '1');
  assert.ok(r.numeros.find((n) => n.rotulo === 'Receita mensal perdida').valor.includes('3.000'));
  const lista = r.secoes.find((s) => s.titulo === 'Clientes da nota mais baixa para a mais alta');
  assert.equal(lista.tabela.linhas.length, 4);
  assert.ok(Number(lista.tabela.linhas[0][1]) <= Number(lista.tabela.linhas[3][1]), 'da nota mais baixa para a mais alta');
  assert.equal(r.historico.tabela.linhas.length, 3);
  // Quem não é dono: sem a receita (número e coluna).
  const e = json((await C.VybeRelatorio.relatorioDe('clientes', { hoje: HOJE, acesso: EQUIPE, dados: DADOS, api })).rel);
  assert.ok(!e.numeros.some((n) => n.rotulo === 'Receita mensal perdida'));
  const mov = e.secoes.find((s) => s.titulo === 'Entradas e saídas');
  assert.ok(!mov.tabela.colunas.some((c) => (c.rotulo || c) === 'Receita mensal'));
  assert.ok(!JSON.stringify(e).includes('3.000'), 'nem o valor solto');
});

test('Mídia: só dono; investimento, sinais do Ícaro, contas sem ligação e rotina', async () => {
  const fichas = { '1': { estado: 'ok', investido: 2000, investido_anterior: 1000, resultados: 40, conversas: 40, custo_resultado: 50, frequencia: 3.4, sinal: { tom: 'a', motivo: 'Frequência 3,4.' }, campanhas: [{ nome: 'Black', investido: 1500, resultados: 30, custo_resultado: 50 }] },
    '2': { estado: 'ok', investido: 500, investido_anterior: 900, resultados: 0, conversas: 0, sinal: { tom: 'r', motivo: 'Investiu e não teve resultado no período.' } }, '3': { estado: 'sem_conta' } };
  const api = async (area, p) => {
    if (area !== 'midia') return null;
    if (p.acao === 'carteira') return { clientes: [{ id: '1', nome: 'VOA' }, { id: '2', nome: 'Gonzalez' }, { id: '3', nome: 'Alpha1' }] };
    if (p.acao === 'cliente') return { meta: fichas[p.cliente_id] };
    if (p.acao === 'historico') return { semanas: [1, 2, 3, 4].map((k) => ({ de: `2026-10-0${k}`, investido: 100 * k, resultados: k })) };
    if (p.acao === 'rotina') return { fixos: [{ chave: 'diario_gastos', titulo: 'Conferir o gasto' }, { chave: 'diario_pagamentos', titulo: 'Conferir saldo' }], checks: [{ chave: 'diario_gastos' }], historico: [{ dia: '2026-11-25', feitos: 2, quem: ['Ewerton'] }] };
    return null;
  };
  await assert.rejects(() => C.VybeRelatorio.relatorioDe('midia', { hoje: HOJE, acesso: { dono: true, dinheiro: false }, dados: DADOS, api }), /Sem acesso/);
  const r = await gerar('midia', { api });
  assert.equal(r.agente.nome, 'Ícaro');
  assert.match(r.numeros[0].valor, /2\.500/);
  assert.equal(r.numeros.find((n) => n.rotulo === 'Contas que pedem ação').valor, '1');
  assert.equal(r.numeros.find((n) => n.rotulo === 'Sem conta ligada').valor, '1');
  assert.equal(r.numeros.find((n) => n.rotulo === 'Rotina de hoje').valor, '1 de 2');
  assert.match(r.recomendacoes.map((x) => x.o_que).join(' '), /Revisar a conta de Gonzalez/);
  assert.match(r.recomendacoes.map((x) => x.o_que).join(' '), /Trocar o criativo .*VOA/);
});
