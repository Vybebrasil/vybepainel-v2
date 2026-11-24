// Frente s-u, Hoje · Minhas tarefas (Paulo, 24/11/2026): "leva o gráfico ali pra direita... no lugar de aprovações e
// agentes viram" e "não era pra ser responsivo? Ficar do tamanho do card ou vídeo?". A Semana na coluna da direita, com
// Aprovações e Agentes viram em linhas embaixo dela (mesmas contagens, mesmos cliques); a arte do laranja inteira, na
// proporção lida da mídia. SAFE: só lê o código e roda trechos num contexto isolado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const mundo = readFileSync('vybe-mundo.js', 'utf8'), conteudo = readFileSync('vybe-mundo-conteudo.js', 'utf8');
const css = readFileSync('padrao-v2/s-u.css', 'utf8');
const trecho = (texto, de, ate) => { const i = texto.indexOf(de); assert.ok(i >= 0, de); const j = texto.indexOf(ate, i); assert.ok(j > i, ate); return texto.slice(i, j); };
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (m) => `&#${m.charCodeAt(0)};`);

function consulta({ aprov, agentes } = {}) {
  const c = vm.createContext({ esc, n0: (n) => String(n), cliCor: (c) => `<i>${esc(c)}</i>`, abertosD3: new Set(),
    window: { VybeAprovacoes: { estado: () => aprov, atualizar() { c.releu = true; } }, VybeAgentes: { resumoParaHoje: () => agentes } } });
  vm.runInContext('const abreD3 = (chave) => `data-abre="${esc(chave)}" aria-expanded="${abertosD3.has(chave)}"`;'
    + trecho(mundo, '  function cartaoD3(', '  // Quando: vermelho') + trecho(mundo, '  // Os agentes viram: o começo', '  // WhatsApp: na Agência')
    + trecho(mundo, '  // Aprovações (vybe-mundo-aprovacoes.js) em linhas', '  // Prontas da semana (Paulo, 19/11'), c);
  return c;
}
const APROV = { dados: { eu: { clientes: ['Alfa'] }, planejamentos: [], pecas: [
  { tipo: 'peca', ref: 'vybe:1', quadro: 'producao', etapa: 'interna', titulo: 'Reels - Um', cliente: 'Alfa', horas: 30, meu: true },
  { tipo: 'peca', ref: 'vybe:2', quadro: 'producao', etapa: 'cadastrar', titulo: 'Card - Dois', cliente: 'Alfa', horas: 5, meu: true }] } };
const AGENTES = { pode: true, total: 4, itens: [{ setor: 'producao', chave: 'k1', agente: 'Heitor', titulo: 'Peça parada', rotulo: 'há 2 d' }] };
const PE = '<button type="button" class="d3h-link" data-hoje-acao="agentes">Como o VYBES montou esta ordem</button>';

test('Minhas tarefas: a Semana na coluna da direita, no lugar de Aprovações e Agentes viram; o laranja com a altura toda', () => {
  const t = trecho(mundo, '    const olhoCli = clientesDeOlhoD3(naFila', '  function acaoDoHoje(');
  assert.match(t, /<div class="d3q-meio d3h-tf-meio"><div class="d3h-tf-esq">\$\{tarefas\}\$\{olhoCli\}<\/div><div class="d3q-acao">\$\{laranja\}<\/div><\/div><\/div>/);
  assert.doesNotMatch(t, /class="d3q-pe"/, 'sem o pé: o laranja ganha a altura toda');
  assert.match(t, /aria-label="Consulta">\$\{ladoD3\(\{ mini \}\)\}\$\{semanaPessoa\}\$\{consultaD3Html\(/);
  assert.doesNotMatch(t, /aprovacoesD3Html\(\)|agentesD3Html\(/, 'os cartões grandes saíram da coluna');
});

test('Aprovações e Agentes viram em linhas: as mesmas contagens, os mesmos destinos e o mesmo "abrir"/"todos"', () => {
  const c = consulta({ aprov: APROV, agentes: AGENTES });
  const h = vm.runInContext(`consultaD3Html({ aprovacoes: true, pe: ${JSON.stringify(PE)} })`, c);
  assert.match(h, /^<section class="d3h-cartao d3h-consulta" aria-label="Aprovações e agentes"><div class="d3h-cab"><h3>Aprovações<\/h3>/);
  assert.match(h, /suas peças · <button type="button" class="d3h-link" data-aprov-todos aria-pressed="false">todos<\/button>/);
  assert.match(h, /data-hoje-acao="abre" data-valor="apr:interna"><span>No head<\/span><b>1<\/b><small class="r">30 h<\/small>/);
  assert.match(h, /data-valor="apr:cadastrar"><span>Falta cadastrar<\/span><b>1<\/b>/);
  assert.match(h, /data-aprov-peca="vybe:1" data-aprov-quadro="producao"/, 'cada item abre a peça, como antes');
  // Agentes viram: a linha abre os achados no lugar; "abrir" leva à fila dos agentes; o pé continua.
  assert.match(h, /<div class="v2-abre d3h-apr d3h-ag-linha" data-abre="agentes" aria-expanded="false"><div class="d3h-ag-lin"><button type="button" class="d3h-apr-lin" data-hoje-acao="abre" data-valor="agentes"><span>Agentes viram<\/span><b>4<\/b><\/button><button type="button" class="d3h-link" data-hoje-acao="agentes">abrir<\/button><\/div>/);
  assert.match(h, /data-hoje-acao="agente" data-valor="producao\|k1"/);
  assert.match(h, /data-hoje-acao="agentes">\+ 3<\/button>/, 'o "+ N" dos que não couberam');
  assert.ok(h.includes(PE), 'o pé "Como o VYBES montou esta ordem"');
  // O cartão grande de antes continua igual para quem ainda usa (Criação, Agência).
  assert.match(vm.runInContext('agentesD3Html({})', c), /^<section class="d3h-cartao d3h-agentes" aria-label="Os agentes viram"><div class="d3h-cab"><h3>Agentes viram<\/h3><span class="d3h-aux">4 · <button type="button" class="d3h-link" data-hoje-acao="agentes">abrir/);
  assert.match(vm.runInContext('aprovacoesD3Html()', c), /^<section class="d3h-cartao d3h-aprs" aria-label="Aprovações">/);
});

test('sem aprovação para mostrar (ou vendo o dia de outra pessoa): fica só a linha dos agentes; lendo, pede a leitura', () => {
  const vazio = consulta({ aprov: { dados: { eu: {}, planejamentos: [], pecas: [] } }, agentes: AGENTES });
  const h = vm.runInContext('consultaD3Html({ aprovacoes: true })', vazio);
  assert.doesNotMatch(h, /<h3>Aprovações/); assert.match(h, /Agentes viram/);
  assert.equal(vm.runInContext('aprovacoesD3Html({ linhas: true })', vazio), null);
  const lendo = consulta({ aprov: null, agentes: null });
  assert.equal(vm.runInContext('aprovacoesD3Html({ linhas: true })', lendo), null); assert.equal(lendo.releu, true);
  assert.match(vm.runInContext('agentesD3Html({ linha: true })', lendo), /<span>Agentes viram<\/span><b><\/b>[\s\S]*Lendo os agentes/);
  const outro = consulta({ aprov: APROV, agentes: AGENTES });
  assert.doesNotMatch(vm.runInContext('consultaD3Html({ aprovacoes: false })', outro), /Aprovações<\/h3>|data-aprov/);
});

// ---------- a arte na proporção da mídia ----------
function frente() {
  const ouvintes = {};
  const c = vm.createContext({ esc, previas: {}, avisos: [], avisarPrevia(r) { c.avisos.push(r); }, setTimeout: () => 0,
    document: { addEventListener: (tipo, f) => { (ouvintes[tipo] ||= []).push(f); },
      createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => { const d = new Uint8ClampedArray(24 * 24 * 4), v = c.cinza ?? 120; for (let i = 0; i < d.length; i += 4) d.set([v, v, v, 255], i); return { data: d }; } }) }) } });
  vm.runInContext(trecho(conteudo, '  const PRETAS = new Map()', '  // ---------- Links de aprovação'), c);
  c.disparar = (tipo, alvo) => (ouvintes[tipo] || []).forEach((f) => f({ target: alvo }));
  return c;
}
function arte() { const a = { vars: {}, classes: new Set(), style: { setProperty: (k, v) => { a.vars[k] = v; } }, classList: { add: (x) => a.classes.add(x) } }; return a; }
const midia = (tag, ref, w, h, src, a) => ({ tagName: tag, dataset: tag === 'IMG' ? { vcPrevia: ref } : { vcPreviaVideo: ref }, getAttribute: () => src,
  naturalWidth: w, naturalHeight: h, videoWidth: w, videoHeight: h, closest: (sel) => (sel === '.d3h-arte' ? a : null) });

test('a proporção da mídia vai para a arte (--arte-prop) e fica na prévia: 4:5, 16:9 e o quadro 9:16', () => {
  const c = frente();
  c.previas.car = { tipo: 'imagem', thumb: '/c.png', n: 3 };
  const a1 = arte(); c.disparar('load', midia('IMG', 'car', 1080, 1350, '/c.png', a1));
  assert.equal(a1.vars['--arte-prop'], '0.8'); assert.ok(a1.classes.has('d3h-arte-prop')); assert.equal(c.previas.car.prop, 0.8);
  c.previas.man = { tipo: 'video', thumb: '/m.jpg', quadro: '/q', nome: 'm.mp4' };
  const a2 = arte(); c.disparar('load', midia('IMG', 'man', 480, 270, '/m.jpg', a2));
  assert.equal(c.previas.man.prop, 1.778, 'miniatura boa: 16:9, sem trocar pelo quadro');
  assert.equal(c.previas.man.thumb, '/m.jpg');
  // Miniatura preta: não guarda a proporção da miniatura; o quadro de 1 s (9:16) é que manda.
  c.cinza = 0; c.previas.cop = { tipo: 'video', thumb: '/p.jpg', quadro: '/v', nome: 'c.mov' };
  const a3 = arte(); c.disparar('load', midia('IMG', 'cop', 480, 270, '/p.jpg', a3));
  assert.equal(c.previas.cop.prop, undefined); assert.equal(c.previas.cop.video, '/v');
  c.disparar('loadeddata', midia('VIDEO', 'cop', 1080, 1920, '', a3));
  assert.equal(c.previas.cop.prop, 0.563); assert.equal(a3.vars['--arte-prop'], '0.563');
  // Uma <img> antiga (outra src) não mexe na prévia nova.
  c.disparar('load', midia('IMG', 'car', 100, 100, '/velha.png', arte()));
  assert.equal(c.previas.car.prop, 0.8);
});

test('o laranja desenha a arte na proporção guardada, inteira e sem cortar; fundo neutro no que sobra', () => {
  assert.match(mundo, /<div class="d3h-arte\$\{t\?\.prop > 0 \? ` d3h-arte-prop" style="--arte-prop:\$\{Number\(t\.prop\)\}` : ''\}">\$\{arteDecidir\(i, t\)\}<\/div>/);
  assert.match(css, /\.d3h-decidir\.d3v-laranja \.d3h-arte\.d3h-arte-prop\{align-self:center;width:auto;max-width:100%;aspect-ratio:var\(--arte-prop\)\}/);
  assert.match(css, /\.d3h-decidir\.d3v-laranja \.d3h-arte > :is\(img,video\)\{object-fit:contain;background:transparent\}/);
  assert.match(css, /\.d3h-decidir\.d3v-laranja \.d3h-arte\{background:var\(--d3-escuro-linha\);box-shadow:none\}/);
  // Regras do padrão: só tokens --d3-*, nada de !important nem :has com [style].
  assert.doesNotMatch(css, /!important|:has\(/);
  for (const v of css.match(/var\(--[\w-]+/g) || []) assert.match(v, /var\(--(d3-|arte-prop)/, v);
});
