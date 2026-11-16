import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Agentes na prancha V2-M-Agentes (16/11/2026): a janela em vidro fumê, o laranja com o pedido da frente ao lado da
// folha "Para você decidir", a folha "Quem é quem" e a coluna de consulta. SAFE: só lê os arquivos.
const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo-agentes.js'), css = ler('padrao-v2/zm-d-agentes.css');
const naOrdem = (texto, partes) => { let p = -1; for (const parte of partes) { const i = texto.indexOf(parte, p + 1); assert.ok(i > p, parte); p = i; } };
const tela = js.slice(js.indexOf('  function filaMHtml('), js.indexOf('  function filaHtml() {'));

test('a tela segue a prancha: o laranja, "Para você decidir", "Quem é quem" e a coluna de consulta', () => {
  naOrdem(tela, ['class="d3m-laranja d3m-d-ag-pesa"', 'class="d3m-d-ag-elo" data-vga-setor=', 'class="d3m-d-ag-ped" data-vga-frente="${i}"', '<h3>Para você decidir</h3>', '<small>Vigiando</small>', '<h3>Quem é quem <small>',
    'data-vga-quem="${k}"', 'celulaAgenteHtml(s, F)', 'ver o mapa das rotinas', '<b>Acerto em 7 dias</b>', '${metaHtml()}', '<b>Os agentes viram</b>', '<b>Central</b>', '<b>Como o VYBES pensa</b>', '<b>A fila em lista</b>',
    '<div class="d3m-d-ag" data-tela="ag-fila"><div class="d3m-d-ag-main">${avisos}<div class="d3m-d-ag-alto">${laranja}${decidir}</div>${quem}</div>', '${acertoM}${viramM}${centralM}${abrirM}</aside>']);
  // O topo no vidro: o dia, quantos ativos e em sombra e quantos pedidos dependem do dono.
  const topo = js.slice(js.indexOf('  function topoMHtml() {'), js.indexOf('  // A célula do agente'));
  naOrdem(topo, ['<h2>Agentes</h2>', 'data-vga-busca', 'data-vga-cerebro', 'data-vga-lista="1">Ver a fila em lista', 'data-vga-fechar>Fechar', 'data-vga-aprovar-todos']);
  assert.match(js, /function topoHtml\(\) \{\n    if \(emM\(\)\) return topoMHtml\(\);/);
});

test('a janela vira vidro só na tela principal; a lista, o perfil e "Como o VYBES pensa" seguem na janela de antes', () => {
  assert.match(js, /const emM = \(\) => st\.vista === 'fila' && !st\.lista;/);
  assert.match(js, /raiz\.className = m \? 'vv-ag d3m-d-m' : 'vv-ag v2a';/);
  assert.match(js, /if \(st\.vista === 'fila'\) return filaHtml\(\);/);
  assert.match(js, /const esq = listaDaFilaHtml\(F, dono, lendo\);/);
  // A cada leitura da central (5 s) a tela repinta: o "Mais" aberto, a rolagem das listas e a busca ficam.
  assert.match(js, /const maisAberto = Boolean\(raiz\.querySelector\('\.d3m-d-mais\[open\]'\)\)/);
  assert.match(js, /if \(naBusca != null\) \{ const campo = raiz\.querySelector\('\[data-vga-busca\]'\); campo\?\.focus\?\.\(\);/);
});

test('decidir não mudou: o laranja usa as mesmas rotas do baralho e só o dono vê os botões', () => {
  assert.ok(tela.includes('class="d3m-btn l v2-estado" ${c.sim[1]}${trava}>${esc(c.sim[0])}</button><button type="button" class="d3m-btn l s" ${c.nao[1]}${trava}>${esc(c.nao[0])}</button>'), 'sim e não com as rotas de cartaDe');
  assert.ok(tela.includes('\'<span class="d3m-d-ag-so">Só um dono decide.</span>\''), 'quem não é dono só lê');
  assert.doesNotMatch(tela, /fetch\(|chamar\(|emLote\(/, 'a tela não cria envio novo');
  for (const a of ['if (b.dataset.vgaQuem) { st.quem = b.dataset.vgaQuem; pintar(); return; }', 'if (b.dataset.vgaFrente != null) { st.frente = Number(b.dataset.vgaFrente) || 0; pintar(); return; }']) assert.ok(js.includes(a), a);
  for (const rota of ['data-vga-aprovacao="aprovar"', 'data-vga-licao="${acao}"', 'data-vga-autonomia=', "attrsDoAchado(it, 'resolvido')"]) assert.ok(js.includes(rota), rota);
});

test('CSS da prancha (zm-d-agentes.css): só tokens --d3-*, sem !important, sem html body.mundo, sem :has e sem animação nova', () => {
  const regras = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(regras, /!important|html body\.mundo|:has\(|@keyframes|animation/);
  assert.doesNotMatch(regras, /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?=[;} ])/, 'nenhuma cor fixa: só tokens');
  for (const r of regras.match(/[^{}]+\{/g).map((x) => x.trim()).filter((x) => !x.startsWith('@'))) {
    for (const s of r.slice(0, -1).split(/,(?![^(]*\))/)) assert.match(s.trim(), /^(body\.mundo #vv-agentes\.vv-ag\.d3m-d-m|#vv-agentes\.d3m-d-m|(div)?\.d3m-d-ag)/, s);
  }
  assert.match(regras, /body\.mundo #vv-agentes\.vv-ag\.d3m-d-m\{[^}]*background:var\(--d3-fume\)/);
  assert.match(regras, /\.d3m-d-ag\{display:grid;grid-template-columns:minmax\(0,1fr\) 316px;gap:16px/);
  assert.match(regras, /\.d3m-d-ag-grade\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\);grid-auto-rows:minmax\(88px,110px\)/);
  assert.match(regras, /\.d3m-d-ag-ped\{[^}]*height:64px/);
  assert.match(regras, /\.d3m-d-ag-av\{[^}]*width:40px;height:40px;border-radius:50%;background:var\(--d3-agente\)/);
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('/* ===== padrao-v2/zm-d-agentes.css ===== */'), 'o fragmento entrou na folha juntada');
  assert.ok(!/[^\r]\n/.test(fs.readFileSync('padrao-v2/zm-d-agentes.css', 'utf8')), 'fim de linha em CRLF');
});
