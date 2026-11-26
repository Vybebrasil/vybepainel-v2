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
  for (const f of ['vybe-dono-metricas.js', 'vybe-carteira-saude.js', 'vybe-mundo-performance.js', 'vybe-relatorio-graficos.js', 'vybe-relatorio.js', ...extras]) vm.runInContext(ler(f), ctx, { filename: f });
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

test('relatório mensal do cliente (vybe-mundo-relatorio.js) continua igual: o motor só acrescenta ao mesmo objeto', () => {
  const c3 = vm.createContext({ console, Intl, Date, URLSearchParams, setTimeout, clearTimeout }); c3.window = c3;
  vm.runInContext(ler('vybe-mundo-relatorio.js'), c3, { filename: 'vybe-mundo-relatorio.js' });
  const mensal = c3.VybeRelatorio;
  assert.deepEqual(Object.keys(mensal).sort(), ['aberto', 'abrir', 'fechar']);
  vm.runInContext(ler('vybe-relatorio.js'), c3, { filename: 'vybe-relatorio.js' });
  const R3 = c3.VybeRelatorio;
  for (const k of ['abrir', 'fechar', 'aberto']) assert.equal(R3[k], mensal[k], `${k} é a mesma função do relatório do cliente`);
  assert.equal(R3.aberto(), false);
  for (const k of ['registrar', 'gerar', 'documento', 'modulos']) assert.equal(typeof R3[k], 'function', k);
  // No index.html o relatório do cliente carrega antes do motor (senão o objeto dele trocaria o do motor).
  const html = ler('index.html');
  assert.ok(html.indexOf('src="/vybe-mundo-relatorio.js"') > 0 && html.indexOf('src="/vybe-mundo-relatorio.js"') < html.indexOf('src="/vybe-relatorio.js"'));
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
test('fontes: a mesma rota lida várias vezes vira uma linha com a contagem; a que falhou aparece à parte', async () => {
  const C2 = carregar([]);
  let n = 0;
  C2.fetch = async () => { n += 1; return n === 4 ? { ok: false } : { ok: true, json: async () => ({ ok: true }) }; };
  C2.VybeRelatorio.registrar('teste-fontes', async (ctx) => { for (const mes of ['2026-09', '2026-10', '2026-11']) await ctx.api('setor_pessoas', { aba: 'produtividade', mes }); await ctx.api('carteira', {});
    return { titulo: 'Teste', resumo: ['ok'], numeros: [], secoes: [], recomendacoes: [{ o_que: 'x', por_que: 'y', impacto: 'z' }] }; }, { nome: 'Teste' });
  const html = await C2.VybeRelatorio.documento('teste-fontes', { hoje: HOJE, acesso: DONO, dados: DADOS });
  assert.equal(html.split('area=setor_pessoas (produtividade)').length - 1, 1);
  assert.match(html, /3 leituras/);
  assert.ok(html.includes('area=carteira</td><td>não respondeu'));
});
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

const FUNIL = { pode: { ver_dinheiro: true }, oportunidades: [
  { id: '1', nome: 'Padaria', etapa: 'ganho', criado_dia: '2026-11-03', ganho_dia: '2026-11-20', valor_mensal: 2500, origem_tipo: 'sdr' },
  { id: '2', nome: 'Clínica', etapa: 'proposta_comercial', criado_dia: '2026-11-05', proxima_acao: 'Ligar', proxima_acao_data: '2026-11-10', responsavel_nome: 'Vinícius', origem_tipo: 'formulario' },
  { id: '3', nome: 'Loja', etapa: 'perdido', criado_dia: '2026-10-02', motivo_perda: 'preco', origem_tipo: 'manual' },
  { id: '4', nome: 'Hotel', etapa: 'ganho', criado_dia: '2026-10-01', ganho_dia: '2026-10-15', valor_mensal: 1800, origem_tipo: 'sdr' } ],
  resumo: { taxa_ganho: 66.7, fases: [{ id: 'novo', nome: 'Novo', atual: 0, alcancaram: 4, conversao: 75 }, { id: 'proposta', nome: 'Proposta', atual: 1, alcancaram: 3, conversao: 33 }, { id: 'ganho', nome: 'Ganho', atual: 2, alcancaram: 2, conversao: null }],
    motivos_perda: [{ id: 'preco', nome: 'Preço', quantidade: 1, percentual: 100 }] },
  mes: { propostas: [{ oportunidade_id: '2', dia: '2026-11-08' }], progresso: [{ id: 'negocios', nome: 'Negócios', tipo: 'quantidade', meta: 4, realizado: 1, percentual: 25 }, { id: 'mrr', nome: 'MRR', tipo: 'dinheiro', meta: 10000, realizado: 2500, percentual: 25 }], ranking: { linhas: [{ nome: 'Vinícius', quantidade: 1, mrr: 2500 }] } } };
test('Comercial: só donos e coordenação; funil, perda, paradas, churn e o dinheiro só para dono', async () => {
  const cart = { clientes: [{ id: '9', nome: 'Velha', entrada: '2025-01-10', saida: '2026-11-12', valor: 3000 }, { id: '8', nome: 'Fica', entrada: '2025-03-01' }], churn: { registros: [{ cliente_id: '9', motivo: 'preco', receita_mensal: 3000 }] },
    contratos: { lista: [{ cliente_id: '8', renovacao: '2026-12-10', status: 'ativo', valor_mensal: 4000 }] } };
  const api = async (area, p) => (area === 'comercial' && p.aba === 'funil' ? FUNIL : area === 'carteira' ? cart : null);
  await assert.rejects(() => C.VybeRelatorio.relatorioDe('comercial', { hoje: HOJE, acesso: EQUIPE, dados: DADOS, api }), /Sem acesso/);
  const r = await gerar('comercial', { api });
  assert.equal(r.numeros.find((n) => n.rotulo === 'Leads').valor, '2');
  assert.equal(r.numeros.find((n) => n.rotulo === 'Negócios fechados').valor, '1');
  assert.match(r.numeros.find((n) => n.rotulo === 'MRR fechado').valor, /2\.500/);
  assert.equal(r.numeros.find((n) => n.rotulo === 'Negociações paradas').valor, '1');
  assert.match(r.resumo.join(' '), /de proposta para a fase seguinte: só 33%/);
  assert.ok(r.secoes.some((s) => s.titulo === 'Churn: quem saiu e por quê'));
  assert.match(r.recomendacoes[0].o_que, /Dar próxima ação às 1 negociações paradas, começando por Clínica/);
  // Coordenação (dono do painel sem dinheiro): sem MRR, sem coluna de receita, sem meta de MRR.
  const c = json((await C.VybeRelatorio.relatorioDe('comercial', { hoje: HOJE, acesso: { dono: true, dinheiro: false, nome: 'Beatriz' }, dados: DADOS, api })).rel);
  assert.ok(!c.numeros.some((n) => /MRR|Receita|Avulso/.test(n.rotulo)));
  assert.ok(!JSON.stringify(c).includes('2.500') && !JSON.stringify(c).includes('4.000') && !JSON.stringify(c).includes('3.000'), 'nenhum valor em reais');
});

test('Gestão: setores lado a lado, quem segura o atraso, carga acima do limite e agentes', async () => {
  const setor = { atrasadas: { pontos: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({ dia: `2026-11-1${k}`.slice(0, 10), valor: 2 + k })) }, limite: 10,
    carga: { '3': { nome: 'Deivid', pontos: [{ dia: '2026-11-25', valor: 14 }] }, '0': { nome: 'Beatriz', pontos: [{ dia: '2026-11-25', valor: 6 }] } } };
  const ag = { meta: 80, acerto: { heitor: { nome: 'Heitor', pontos: [{ dia: '2026-11-25', valor: 70 }] } } };
  const api = async (area, p) => (area === 'series' && p.para === 'setor' ? setor : area === 'series' ? ag : area === 'comercial' ? FUNIL : null);
  const r = await gerar('gestao', { api });
  assert.equal(r.agente.nome, 'Alex');
  assert.equal(r.secoes[0].tabela.linhas.length, 4);
  assert.match(r.recomendacoes[0].o_que, /Redistribuir parte das \d+ atrasadas de Deivid/);
  assert.ok(r.recomendacoes.some((x) => /Aliviar a carga de Deivid/.test(x.o_que)));
  assert.ok(r.recomendacoes.some((x) => /Revisar as regras de Heitor/.test(x.o_que)));
  assert.ok(!JSON.stringify(r).includes('2.500'), 'Gestão não leva reais');
});

test('Performance: a mesma conta da tela, gargalo por etapa e processos', async () => {
  const r = await gerar('performance');
  assert.equal(r.titulo, 'Gestão · Performance');
  assert.ok(Number(r.numeros[0].valor) > 0, 'entregues no período');
  const etapa = r.secoes.find((s) => s.titulo === 'Onde a fila trava (por etapa)');
  assert.ok(etapa.tabela.linhas.length >= 3);
  assert.ok(r.secoes.find((s) => s.titulo === 'Processos').tabela.linhas.length === 7);
  assert.ok(r.historico.grafico, 'série semanal');
});

test('Ranking: líder, meta da agência, superação e score semanal', async () => {
  const pess = [{ id: '1', nome: 'Jady', posicao: 1, antes: 3, xp: 900, entregas: 30, meta: 20, pct: 150, xpPor: { design_card: 600, motion: 300 } },
    { id: '2', nome: 'Beatriz', posicao: 2, antes: 1, xp: 700, entregas: 25, meta: 25, pct: 100 }, { id: '3', nome: 'Reriston', posicao: null, xp: 0, entregas: 0, meta: 10, pct: 0 }];
  const rk = { pessoas: pess, agencia: { pecas: 60, meta: 100, pct: 60 }, inicio: '2026-11-01', fim: '2026-11-30', hoje: HOJE, anterior: { inicio: '2026-11-16', fim: '2026-11-22', podio: [{ nome: 'Jady', posicao: 1 }] } };
  const score = { score: { '1': { nome: 'Jady', pontos: [{ dia: '2026-11-02', valor: 70 }, { dia: '2026-11-09', valor: 80 }, { dia: '2026-11-16', valor: 90 }] } } };
  const r = await gerar('ranking', { api: async (area, p) => (area === 'escritorio' ? rk : area === 'series' ? score : null) });
  assert.equal(r.numeros[0].valor, 'Jady');
  assert.match(r.resumo[0], /Jady lidera com 900 XP, seguido de Beatriz/);
  assert.match(r.resumo.join(' '), /Maior superação da própria meta: Jady \(150%\)/);
  assert.equal(r.numeros.find((n) => n.rotulo === 'Sem entrega no mês').valor, '1');
  assert.ok(r.recomendacoes.some((x) => /Puxar a meta da agência/.test(x.o_que)), '60 de 100 no dia 26 não chega');
  assert.equal(r.historico.tabela.linhas.length, 3);
});

test('RH: gestão vê o time, pedidos e documentos; a equipe só o próprio, sem recrutamento nem documentos', async () => {
  const chamadas = [];
  const rank = [{ id: '1', nome: 'Jady', cargoNome: 'Design', score: 88, entregues: 30, meta: 25, comData: 30, noPrazo: 28, ajustes: 1, atrasadas: 0 },
    { id: '3', nome: 'Deivid', cargoNome: 'Direção de arte', score: 52, entregues: 10, meta: 25, comData: 12, noPrazo: 6, ajustes: 4, atrasadas: 9, frases: ['9 peças abertas atrasadas'] }];
  const api = async (area, p) => {
    chamadas.push(p.aba);
    if (p.aba === 'produtividade') return ctxDono ? { ranking: rank, detalhe: rank[0] } : { detalhe: { ...rank[1], posicao: null } };
    if (p.aba === 'rh') return { indicadores: { abertos: 2, foraDoPrazo: 1, respondidos: 4, tempoMedioDias: 2.5, noPrazoPct: 75 }, pedidos: [{ pessoa_nome: 'Jady', tipo: 'ferias', status: 'aberto', sla: 'atrasado', atrasoUteis: 2, idadeDias: 6, prazo: '2026-11-20' }],
      visao: { headcount: 9, admissoes: 1, desligamentos: 0, tempoMedioMeses: 14 }, climaResultado: { trimestre: '2026-T4', liberado: false, minimo: 3, respostas: 1 } };
    if (p.aba === 'documentos') return { avisoDias: 30, documentos: [{ pessoa_nome: 'Jady', titulo: 'Contrato PJ', renovacao: '2026-12-05', situacao: 'renovar' }] };
    if (p.aba === 'recrutamento') return { vagas: [{ id: 'v1', titulo: 'Designer', status: 'aberta', aberta_em: '2026-11-01' }], candidatos: [{ vaga_id: 'v1' }], indicadores: {} };
    return null;
  };
  let ctxDono = true;
  const r = await gerar('rh', { api });
  assert.match(r.resumo[0], /score médio do time é 70/);
  assert.match(r.recomendacoes[0].o_que, /Conversar com Deivid/);
  assert.ok(r.secoes.some((s) => s.titulo === 'Documentos a renovar') && r.secoes.some((s) => s.titulo === 'Recrutamento'));
  ctxDono = false; chamadas.length = 0;
  const e = json((await C.VybeRelatorio.relatorioDe('rh', { hoje: HOJE, acesso: EQUIPE, dados: DADOS, api })).rel);
  assert.ok(!chamadas.includes('documentos') && !chamadas.includes('recrutamento'), 'nem pede o que é da gestão');
  assert.equal(e.numeros[0].rotulo, 'Seu score');
  assert.ok(!e.secoes.some((s) => /Produtividade do time|Documentos|Recrutamento/.test(s.titulo)));
});

test('Impressões: pedidas, atrasadas com a gráfica, sem fornecedor, o Nestor e o valor só para dono', async () => {
  const imp = { etapas: [{ id: 'orcamento', nome: 'Orçamento' }, { id: 'em_impressao', nome: 'Em impressão' }, { id: 'entregue', nome: 'Entregue' }],
    impressoes: [{ id: '1', titulo: 'Banner', cliente_nome: 'VOA', etapa: 'em_impressao', fornecedor_id: '7', fornecedor_nome: 'Gráfica Irecê', pedido_em: '2026-11-04', previsao: '2026-11-20', atrasada: true, valor: 800 },
      { id: '2', titulo: 'Panfleto', cliente_nome: 'Gonzalez', etapa: 'orcamento', criado_em: '2026-11-10T10:00:00Z', previsao: '2026-12-10', atrasada: false, valor: null },
      { id: '3', titulo: 'Adesivo', cliente_nome: 'VOA', etapa: 'entregue', fornecedor_id: '7', pedido_em: '2026-11-02', previsao: '2026-11-09', entregue_em: '2026-11-08', atrasada: false, valor: 300 }],
    ranking: [{ nome: 'Gráfica Irecê', categoria: 'grafica', entregues: 5, pontualidade: 0.8, prazo_medio_dias: 4, motivo: 'Irecê · 5 entregas' }], aguardando: [{ titulo: 'Cartão de visita', cliente: 'Alpha1', proposta: { responsavel: 'Deivid' } }] };
  const r = await gerar('impressoes', { api: async (area) => (area === 'impressoes' ? imp : null) });
  assert.equal(r.agente.nome, 'Nestor');
  assert.equal(r.numeros[0].valor, '3');
  assert.equal(r.numeros.find((n) => n.rotulo === 'Atrasadas agora').valor, '1');
  assert.equal(r.numeros.find((n) => n.rotulo === 'Sem fornecedor').valor, '1');
  assert.match(r.recomendacoes[0].o_que, /Cobrar a gráfica das 1 atrasadas, começando pela Gráfica Irecê/);
  const e = json((await C.VybeRelatorio.relatorioDe('impressoes', { hoje: HOJE, acesso: EQUIPE, dados: DADOS, api: async (area) => (area === 'impressoes' ? imp : null) })).rel);
  assert.ok(!e.numeros.some((n) => n.rotulo === 'Valor pedido') && !JSON.stringify(e).includes('1.100'));
});

test('Equipe: quem tem mais na mão e sugestão de redistribuir', async () => {
  const r = await gerar('equipe', { dados: { ...DADOS, equipe: () => [...PESSOAS, { id: '9', name: 'Tainara' }] } });
  const tab = r.secoes[0].tabela.linhas;
  assert.equal(tab[0][0], 'Deivid', 'a mais carregada primeiro');
  assert.ok(r.recomendacoes.some((x) => /Passar parte da fila de Deivid para/.test(x.o_que)));
});
