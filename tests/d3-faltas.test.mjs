// SAFE: o que faltou dos quadros D3 (14/11/2026) — confirmação perigosa, "Semana de dd/mm" da Nova demanda, topo da
// Agenda, "Confirmar N" em lote na Fila do Danilo e na Coordenação e o rótulo "Gestão" em Clientes. Sem rede (fetch dublê)
// e sem DOM: as contas rodam num vm com os trechos dos arquivos; o resto confere o desenho no código.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const trecho = (txt, de, ate) => { const a = txt.indexOf(de); assert.ok(a >= 0, `falta: ${de}`); const b = txt.indexOf(ate, a + de.length); assert.ok(b > a, `falta: ${ate}`); return txt.slice(a, b); };
const json = (x) => JSON.parse(JSON.stringify(x));
const core = ler('vybe-core.js'), css = ler('padrao-v2/d3-faltas.css');

test('confirmação perigosa: lixeira, "Digite APAGAR", Apagar desligado até a palavra bater; vale para toda vbConfirmarApagar', () => {
  const f = trecho(core, 'function vbConfirmarApagar', '// Menu de linha (família 2)');
  assert.match(core, /function vbConfirmarApagar\(\{ titulo = 'Apagar\?', texto = '', rotulo = 'Apagar', palavra = 'APAGAR' \} = \{\}\)/);
  assert.match(f, /<span class="vb-apagar-ic">\$\{VB_APAGAR_LIXEIRA\}<\/span>/);
  assert.match(f, /<label class="vb-apagar-rot" for="vb-apagar-c">Digite \$\{safeText\(exigida\)\}<\/label><input id="vb-apagar-c"/);
  assert.match(f, /class="vb-apagar-sim"\$\{exigida \? ' disabled' : ''\}/, 'Apagar começa desligado');
  assert.match(f, /campo\?\.addEventListener\('input', \(\) => \{ sim\.disabled = !liberado\(\); \}\)/);
  assert.match(f, /e\.target\.closest\?\.\('\.vb-apagar-sim'\) && liberado\(\)\) fechar\(true\)/, 'clique só confirma com a palavra');
  assert.match(f, /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); if \(liberado\(\)\) fechar\(true\); \}/);
  assert.match(f, /e\.key === 'Escape'/); assert.match(f, /e\.target === fundo/);
  // A palavra é conferida sem diferença de maiúscula e sem espaço nas pontas.
  const lib = (exigida, valor) => !exigida || String(valor || '').trim().toUpperCase() === exigida;
  assert.match(f, /const liberado = \(\) => !exigida \|\| String\(campo\?\.value \|\| ''\)\.trim\(\)\.toUpperCase\(\) === exigida;/);
  assert.equal(lib('APAGAR', ' apagar '), true); assert.equal(lib('APAGAR', 'APAGA'), false);
  // Quem já chamava continua chamando do mesmo jeito (e ninguém desliga a palavra).
  for (const arq of ['vybe-arquivos.js', 'vybe-clientes.js', 'vybe-grupos.js', 'vybe-mundo-agentes.js', 'vybe-subitens.js']) {
    assert.match(ler(arq), /vbConfirmarApagar\(/, arq); assert.doesNotMatch(ler(arq), /palavra:\s*''/, arq);
  }
  assert.match(css, /#vb-apagar \.vb-apagar-caixa \.vb-apagar-ic\{[^}]*background:var\(--d3-perigo-veu\);color:var\(--d3-perigo\)\}/);
  assert.match(css, /#vb-apagar \.vb-apagar-caixa \.vb-apagar-acoes \.vb-apagar-sim:disabled\{opacity:\.35/);
});

// d3LinhaSvg num vm (trecho de vybe-core.js): o ponto pode ficar em outro dia e a escala pode partir do zero.
const linha = (() => { const ctx = vm.createContext({}); vm.runInContext(trecho(core, 'const d3Esc =', '// Cartão de número') + ';globalThis.d3LinhaSvg = d3LinhaSvg;', ctx); return ctx.d3LinhaSvg; })();

test('d3LinhaSvg: ponto no índice pedido e escala desde o zero contra a régua', () => {
  const svg = linha([1, 2, 3, 0, 0, 0], { meta: 6, largura: 300, altura: 70, ponto: 2, desdeZero: true, rotulo: 'x' });
  const pts = svg.match(/<polyline points="([^"]+)"/)[1].split(' ');
  const [cx, cy] = [svg.match(/cx="([\d.]+)"/)[1], svg.match(/cy="([\d.]+)"/)[1]];
  assert.equal(`${cx},${cy}`, pts[2], 'o ponto é o do dia escolhido');
  assert.equal(pts[3].split(',')[1], '67.0', 'zero fica no pé do gráfico');
  assert.match(svg, /<polyline class="meta" points="3,3\.0 297,3\.0"\/>/, 'régua 6 no topo');
  const padrao = linha([1, 2, 3]);
  assert.match(padrao, /<circle cx="117\.0"/, 'sem ponto, continua no último valor');
});

// fcSemanaDados num vm (trecho de cadastros_governed_v2.js), com as peças passadas por fora.
const semana = (() => {
  const somar = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const ctx = vm.createContext({ getOffsetDate: somar, state: { format: 'Card', itens: [] }, fcEquipeFinal: () => [], fcRegraDoFormato: () => ({ dest: {} }), Date, String, Array, Number });
  vm.runInContext(trecho(ler('cadastros_governed_v2.js'), 'const FC_REGUA', '  function fcSemanaHtml(') + ';globalThis.fcSemanaDados = fcSemanaDados;', ctx);
  return ctx.fcSemanaDados;
})();

test('Nova demanda: "Semana de dd/mm" conta as peças abertas de quem vai fazer por dia, contra a régua do cadastro', () => {
  const p = (id, dia, quem, o = {}) => ({ id, veiculacao_iso: dia, responsavel_ids: [quem], status: 'A Fazer', formato: 'Card', ...o });
  const itens = [p(1, '2026-11-23', 'rer'), p(2, '2026-11-25', 'rer'), p(3, '2026-11-25', 'rer'), p(4, '2026-11-25', 'jady'), p(5, '2026-11-26', 'rer', { status: 'Finalizado' }),
    p(6, '2026-11-24', 'rer', { formato: 'Reels' }), p(7, '2026-11-30', 'rer')];
  const s = semana({ veic: '2026-11-25' }, { itens, equipe: ['rer'], formato: 'Card', novos: [{ veic: '2026-11-25' }] });
  assert.equal(s.seg, '2026-11-23'); assert.deepEqual(json(s.dias), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28']);
  assert.deepEqual(json(s.valores), [1, 1, 3, 0, 0, 0], 'só de quem faz, sem finalizada, mais a peça nova no dia escolhido');
  assert.equal(s.regua, 6); assert.equal(s.ponto, 2);
  const v = semana({ veic: '2026-11-25' }, { itens, equipe: ['rer'], formato: 'Reels', novos: [] });
  assert.deepEqual(json(v.valores), [0, 1, 0, 0, 0, 0], 'vídeo conta só vídeo'); assert.equal(v.regua, 4);
  const todos = semana({ veic: '2026-11-25' }, { itens, equipe: [], formato: 'Card', novos: [] });
  assert.equal(todos.regua, null, 'sem responsável: a agência inteira, sem régua'); assert.equal(todos.valores[2], 3);
  assert.equal(semana({ veic: '' }, { itens, equipe: [], novos: [] }), null, 'sem data, sem gráfico');
  assert.equal(semana({ veic: '2026-11-29' }, { itens, equipe: [], novos: [] }).dias.length, 7, 'domingo escolhido: a semana vai até ele');
  const cad = ler('cadastros_governed_v2.js');
  assert.match(cad, /<div class="nd-semana" id="fc-semana">\$\{fcSemanaHtml\(it\)\}<\/div>/);
  assert.match(cad, /d3LinhaSvg\(s\.valores, \{ meta: s\.regua, largura: 300, altura: 70, rotulo: rot, ponto: s\.ponto, desdeZero: true \}\)/);
  assert.match(cad, /if \(semana && it\) semana\.innerHTML = fcSemanaHtml\(it\);/, 'trocar a data redesenha a linha');
  assert.match(cad, /`<p class="nd-rot">Semana de \$\{dm\}<\/p>`/);
});

test('Agenda: topo com Semana, Mês e Roteiros; Feed e Calendário no menu Mais; o Dia fica na barra', () => {
  const prod = ler('production_governed_v2.js'), agenda = ler('vybe-captacoes.js');
  const topo = trecho(prod, 'const cabecaV2 =', 'root.innerHTML');
  assert.match(topo, /<span class="d3ag-vistas" role="radiogroup" aria-label="O que ver">\$\{vistaAg\('semana', 'Semana'\)\}\$\{vistaAg\('mes', 'Mês'\)\}\$\{vistaAg\('roteiros', 'Roteiros'\)\}<\/span>\$\{maisAg\}/);
  assert.match(prod, /\[\['feed', 'Feed'\], \['calendar', 'Calendário'\]\]\.map/, 'Feed e Calendário não somem');
  assert.match(prod, /<details class="pv2-menu d3ag-mais"><summary class="pv2-btn s\$\{noMais \? ' on' : ''\}"/);
  assert.match(prod, /window\.prodAgendaVista = function\(v\) \{/);
  assert.match(prod, /if \(!igual && typeof captVista === 'function'\) captVista\(v\);/, 'Semana e Mês usam a troca de visão de sempre');
  assert.match(agenda, /CAPT_VISTAS\.filter\(\(\[v\]\) => v === "dia"\)/, 'no corpo fica só o Dia');
  // A troca: Semana e Mês abrem as Captações nessa visão; Roteiros é a parte de sempre.
  const chamadas = [], ctx = { window: {}, CAPT: { vista: 'semana' }, captVista: (v) => chamadas.push(['vista', v]), renderProductionCommand: () => chamadas.push(['render']) };
  ctx.window.setProdV2View = (v) => { ctx.window.productionV2View = v; chamadas.push(['parte', v]); };
  vm.createContext(ctx);
  vm.runInContext(trecho(prod, '  window.prodAgendaVista = function(v) {', '\n  };') + '\n  };', ctx);
  ctx.window.productionV2View = 'feed'; ctx.window.prodAgendaVista('semana');
  assert.equal(ctx.window.productionV2View, 'captacoes'); assert.deepEqual(chamadas.splice(0), [['render']]);
  ctx.window.prodAgendaVista('mes'); assert.deepEqual(chamadas.splice(0), [['vista', 'mes']]);
  ctx.window.prodAgendaVista('roteiros'); assert.deepEqual(chamadas.splice(0), [['parte', 'roteiros']]);
  assert.match(css, /#pv2-agenda-topo\.pv2 \.d3ag-vistas > button\[aria-checked="true"\]\{background:var\(--d3-tinta\);color:#FFFFFF/);
});

// ---------- Fila do Danilo: Confirmar N faz as N confirmações da linha, uma por vez, com o fetch dublê ----------
const HOJE = '2026-11-10', DEIVID = '1', BIA = '2', JADY = '3';
const peso = () => 1, limite = () => 14, finalizada = (d) => d.status === 'Finalizado';
const peca = (id, o) => ({ id, nome: 'Peça ' + id, cliente: 'VOA', formato: 'Card', status: 'A fazer', responsavel_ids: [BIA], ...o });

function criacao({ gravarFalha = false } = {}) {
  const ouvintes = {}, log = [], historico = [];
  const resposta = (corpo, ok = true) => ({ ok, json: async () => corpo });
  let soltar = null;
  const ctx = { console, Date, JSON, Promise, Math, Number, String, Array, Object, Set, Map, Error, Intl, CustomEvent: class {},
    setTimeout: () => 0, clearTimeout() {}, localStorage: { getItem: () => null, setItem() {} },
    document: { addEventListener: (tipo, f) => { (ouvintes[tipo] ||= []).push(f); }, dispatchEvent() {} },
    PESSOAS: { DEIVID }, souDonoDaSessao: () => true, hojeDeVerdade: () => HOJE, showToast() {}, renderIntegratedOperationalViews() {},
    findOperationalItem: (id) => ({ id, nome: 'Peça ' + id, responsavel_ids: id === '10' ? [DEIVID] : [BIA] }),
    // A gravação de responsáveis fica presa até o teste soltar: assim dá para ver que a cobrança só sai depois dela.
    gravarResponsaveisDaPeca: (item, novos) => { log.push(['gravar', String(item.id), [...novos]]); return new Promise((ok, falha) => { soltar = () => (gravarFalha ? falha(new Error('sem rede')) : ok()); }); },
    postItemUpdate: async (id, texto) => { historico.push([id, texto]); return true; },
    fetch: async (url, o = {}) => {
      if (!String(url).includes('area=cobrancas')) return resposta({ perfil: { achados: { abertos: [] } } });
      if (o.method === 'POST') { const b = JSON.parse(o.body); log.push(['post', b.item, b.para]); return resposta({ ok: true, cobrancas: [{ id: 9, ref: b.item, conteudo_id: Number(b.item), pessoa: 'Bia', agente: 'Danilo', estado: 'pedido' }] }); }
      return resposta({ ok: true, cobrancas: [] });
    } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(ler('vybe-mundo-criacao.js'), ctx);
  const d10 = peca(10, { responsavel_ids: [DEIVID], veiculacao_iso: '2026-11-13' });
  const d20 = peca(20, { status: 'Em andamento', status_updated_at: '2026-11-06', veiculacao_iso: '2026-11-11' });
  const itens = [{ d: d10, ids: [DEIVID], quem: ['Deivid'], sit: 'fazer' }, { d: d20, ids: [BIA, DEIVID], quem: ['Bia', 'Deivid'], sit: 'fazer' }];
  const membros = [{ id: DEIVID, name: 'Deivid' }, { id: BIA, name: 'Bia' }, { id: JADY, name: 'Jady' }];
  const pintar = () => ctx.VybeCriacao.assistente({ itens, todas: [d10, d20], ordem: itens, motivo: () => '', aprovar: [], deHoje: 0, atrasadas: 0, membros, peso, limite, finalizada, eu: DEIVID }).sugestoes;
  const clicar = (attrs) => { for (const f of ouvintes.click) f({ target: { closest: () => ({ dataset: attrs, hasAttribute: (n) => n in attrs }) } }); };
  return { pintar, clicar, log, historico, soltar: () => soltar?.() };
}
const esperar = () => new Promise((ok) => setImmediate(ok));

test('Fila do Danilo: Editar mostra Ver antes e tirar da fila; Confirmar N só pergunta no 1º clique', async () => {
  const t = criacao();
  let html = t.pintar(); await esperar(); html = t.pintar();
  assert.match(html, /data-vcr-aprovar="delegar:10:3"/); assert.match(html, /data-vcr-aprovar="cobrar:20:2026-11-10">Cobrar<\/button>/);
  assert.match(html, /class="vc-sec vcr-editar" data-vcr-editar aria-pressed="false">Editar<\/button>/);
  assert.match(html, /data-vcr-lote aria-live="polite">Confirmar 2<\/button>/);
  assert.doesNotMatch(html, /data-vcr-adiar=|data-vcr-ver=/, 'fora do Editar, a linha fica limpa como no quadro');
  t.clicar({ 'data-vcr-editar': '' }); html = t.pintar();
  assert.match(html, /data-vcr-adiar="delegar:10:3"/); assert.match(html, /data-vcr-ver="delegar:10:3"/); assert.match(html, /aria-pressed="true">Pronto<\/button>/);
  t.clicar({ 'data-vcr-lote': '' }); html = t.pintar();
  assert.match(html, /Passar 1 peça e mandar 1 cobrança no WhatsApp, uma por vez\?/);
  assert.match(html, /data-vcr-lote-ok>Confirmar 2<\/button>/);
  assert.deepEqual(t.log, [], 'o 1º clique não grava nem manda nada');
  t.clicar({ 'data-vcr-lote-voltar': '' }); assert.match(t.pintar(), /data-vcr-lote aria-live="polite">Confirmar 2<\/button>/);
  assert.deepEqual(t.log, []);
});

test('Fila do Danilo: o OK do lote roda as mesmas confirmações, uma por vez, e o botão conta o estado', async () => {
  const t = criacao();
  t.pintar(); await esperar(); t.pintar();
  t.clicar({ 'data-vcr-lote': '' }); t.pintar();
  t.clicar({ 'data-vcr-lote-ok': '' }); await esperar();
  let html = t.pintar();
  assert.match(html, /Confirmando 1\/2…/); assert.match(html, /vcr-confirmar-lote rodando" data-vcr-lote disabled/);
  assert.deepEqual(json(t.log), [['gravar', '10', [JADY]]], 'a 2ª espera a 1ª terminar');
  t.soltar(); await esperar(); await esperar(); await esperar(); await esperar();
  assert.deepEqual(json(t.log), [['gravar', '10', [JADY]], ['post', '20', [BIA]]], 'a cobrança é o mesmo pedido do Cobrar da linha (Deivid não cobra a si mesmo)');
  assert.equal(t.historico.length, 1); assert.match(t.historico[0][1], /^\[Vybe OS · Cobrança da Direção de Arte\]/);
  await esperar(); html = t.pintar();
  assert.match(html, /data-estado="feito" disabled aria-live="polite"><svg[^>]*>.*<\/svg>Confirmado 2<\/button>/);
});

test('Fila do Danilo: falha numa confirmação do lote aparece na linha e no pé, e as outras seguem', async () => {
  const t = criacao({ gravarFalha: true });
  t.pintar(); await esperar(); t.pintar();
  t.clicar({ 'data-vcr-lote': '' }); t.pintar(); t.clicar({ 'data-vcr-lote-ok': '' }); await esperar();
  t.soltar(); for (let i = 0; i < 6; i++) await esperar();
  const html = t.pintar();
  assert.match(html, /Não gravou: sem rede\. A peça continua como estava\./);
  assert.match(html, /class="vcr-lote-res erro" role="status">1 de 2 feitas · 1 falhou<\/span>/);
  assert.equal(t.log.filter((x) => x[0] === 'post').length, 1, 'a cobrança seguiu');
});

// ---------- Coordenação: Confirmar N grava pelas mesmas confirmações da linha ----------
function coordenacao() {
  const log = []; let soltar = [];
  const ctx = vm.createContext({ localStorage: { getItem: () => null, setItem() {} }, CustomEvent: class {}, document: { addEventListener() {}, dispatchEvent() {} }, console, Promise,
    findOperationalItem: (id) => ({ id, nome: 'P' + id, responsavel_ids: id === '2' || id === '3' ? ['jady'] : [] }),
    gravarResponsaveisDaPeca: (item, novos) => { log.push([String(item.id), [...novos]]); return new Promise((ok) => soltar.push(ok)); }, showToast() {}, TEAM_USERS: [] });
  vm.runInContext(ler('vybe-mundo-coordenacao.js'), ctx);
  return { C: ctx.VybeCoordenacao, log, soltarTodas: () => { const l = soltar; soltar = []; l.forEach((f) => f()); } };
}
const TIME = [{ id: 'bia', nome: 'Beatriz', disciplina: 'design', limiteSemana: 14 }, { id: 'jady', nome: 'Jady', disciplina: 'design', limiteSemana: 2 }];
const pecaC = (id, quem, status = 'A Fazer') => ({ id, nome: 'P' + id, responsavel_ids: quem ? [quem] : [], veiculacao_iso: '2026-11-13', status, formato: 'Card' });

test('Coordenação: Confirmar N no pé de Para equilibrar pergunta, depois grava atribuições e trocas uma por vez', async () => {
  const { C, log, soltarTodas } = coordenacao();
  const itens = [pecaC(1, ''), pecaC(2, 'jady'), pecaC(3, 'jady'), pecaC(4, 'jady', 'Em andamento')];
  const args = { itens, time: TIME, hoje: '2026-11-13', peso: () => 1, abas: '' };
  let html = C.html(args);
  const r = C.ultima().r;
  assert.equal(r.semDono.length, 1); assert.ok(r.trocas.length >= 1);
  const n = 1 + r.trocas.length;
  assert.match(html, new RegExp(`data-coord-lote aria-live="polite">Confirmar ${n}</button>`));
  assert.match(html, /class="v2o-lote-conta">1 entrega \+ \d+ trocas? · só com o seu OK/);
  // O clique (capturado no documento) com o alvo dentro de #vv-hoje .v2o.
  const ev = (attrs) => ({ stopPropagation() {}, target: { closest: () => ({ dataset: attrs, hasAttribute: (k) => k in attrs }) } });
  const ouvir = trecho(ler('vybe-mundo-coordenacao.js'), 'function aoClicar(ev) {', '\n  if (typeof document');
  assert.match(ouvir, /if \(b\.hasAttribute\('data-coord-lote'\)\) \{ if \(st\.gravando \|\| !ultima\) return; Object\.assign\(st\.lote, \{ pergunta: true, chaves: chavesDoLote\(ultima\.r\)/);
  assert.match(ler('vybe-mundo-coordenacao.js'), /for \(const chave of chaves\) \{ L\.i \+= 1; if \(await gravar\(chave\)\) ok \+= 1; \}/, 'a mesma gravação da linha, em sequência');
  // Roda de verdade pelo ouvinte exposto ao documento.
  const ouvintes = [];
  const ctx2 = vm.createContext({ localStorage: { getItem: () => null, setItem() {} }, CustomEvent: class {}, console, Promise,
    document: { addEventListener: (_t, f) => ouvintes.push(f), dispatchEvent() {} },
    findOperationalItem: (id) => ({ id, nome: 'P' + id, responsavel_ids: id === '1' ? [] : ['jady'] }),
    gravarResponsaveisDaPeca: (item, novos) => { log.push([String(item.id), [...novos]]); return new Promise((ok) => { ctx2.solta = ok; }); }, showToast() {}, TEAM_USERS: [] });
  vm.runInContext(ler('vybe-mundo-coordenacao.js'), ctx2);
  const C2 = ctx2.VybeCoordenacao; C2.html(args);
  ouvintes[0](ev({ 'data-coord-lote': '' }));
  html = C2.html(args);
  assert.match(html, /Atribuir 1 peça e fazer \d+ trocas?, uma por vez\?/); assert.equal(log.length, 0, 'o 1º clique não grava');
  ouvintes[0](ev({ 'data-coord-lote-ok': '' })); await esperar();
  html = C2.html(args);
  assert.match(html, new RegExp(`Confirmando 1/${n}…`)); assert.deepEqual(json(log), [['1', ['bia']]], 'atribui ao sugerido (o contorno)');
  for (let i = 1; i <= n; i++) { ctx2.solta(); await esperar(); await esperar(); }
  assert.equal(log.length, n);
  assert.ok(log.slice(1).every(([id, novos]) => id !== '1' && novos.includes('bia') && !novos.includes('jady')), 'as trocas tiram quem passou do limite e põem quem tem folga');
  soltarTodas();
});

test('Coordenação: peça do Vybe OS (id "vybe:N") grava pela linha e pelo lote', async () => {
  const ouvintes = [], log = [], itens = [pecaC('vybe:7', ''), pecaC('vybe:8', '')];
  const ctx = vm.createContext({ localStorage: { getItem: () => null, setItem() {} }, CustomEvent: class {}, console, Promise,
    document: { addEventListener: (_t, f) => ouvintes.push(f), dispatchEvent() {} },
    findOperationalItem: (id) => itens.find((d) => d.id === String(id)) || null,
    gravarResponsaveisDaPeca: async (item, novos) => { log.push([String(item.id), [...novos]]); item.responsavel_ids = [...novos]; }, showToast() {}, TEAM_USERS: [] });
  vm.runInContext(ler('vybe-mundo-coordenacao.js'), ctx);
  const ev = (attrs) => ({ stopPropagation() {}, target: { closest: () => ({ dataset: attrs, hasAttribute: (k) => k in attrs }) } });
  const args = { itens, time: TIME, hoje: '2026-11-13', peso: () => 1, abas: '' };
  ctx.VybeCoordenacao.html(args);
  ouvintes[0](ev({ coordOk: 'atribuir:vybe:7:bia' })); await esperar(); ctx.VybeCoordenacao.html(args);
  assert.deepEqual(json(log), [['vybe:7', ['bia']]], 'a chave com ":" no id não perde a peça');
  ouvintes[0](ev({ 'data-coord-lote': '' })); ouvintes[0](ev({ 'data-coord-lote-ok': '' })); await esperar(); await esperar();
  ctx.VybeCoordenacao.html(args);
  assert.deepEqual(json(log[1]), ['vybe:8', ['bia']], 'o lote pega o que ficou na tela');
  assert.match(ctx.VybeCoordenacao.html(args), /data-estado="feito" disabled aria-live="polite"><svg[^>]*>.*<\/svg>Confirmado 1<\/button>/);
});

test('Gestão de clientes: rótulo "Gestão" ao lado do título, uma vez só', () => {
  const cli = ler('vybe-clientes.js');
  assert.match(cli, /const tituloClientes = document\.querySelector\('#clientes-hero h2'\);/);
  assert.match(cli, /!tituloClientes\.nextElementSibling\?\.classList\.contains\('d3c-modo'\)\) tituloClientes\.insertAdjacentHTML\('afterend', '<span class="d3c-modo">Gestão<\/span>'\)/);
  assert.match(css, /#painel-clientes #clientes-hero \.d3c-modo\{[^}]*color:var\(--d3-apagado\)/);
});

test('CSS do fragmento: sem importância forçada e sem html body.mundo', () => {
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  assert.match(ler('vybe-mundo-padrao-v2.css'), /\/\* ===== padrao-v2\/d3-faltas\.css ===== \*\//, 'o juntador já levou o fragmento');
});
