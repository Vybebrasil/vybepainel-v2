// Os três temas (vybe-tema.js, tokens em padrao-v2/0-d3-base.css, padrao-v2/zt-temas.css) e o tutorial de cada tela do
// VYBES (vybe-mundo-tutorial.js + vybe-mundo-tutorial-roteiros.js). SAFE: roda os arquivos de verdade numa sandbox com um
// DOM falso mínimo, localStorage em memória e relógio manual. Sem rede, sem banco, sem WhatsApp.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const TEMA_JS = ler('vybe-tema.js'), TUTORIAL_JS = ler('vybe-mundo-tutorial.js'), ROTEIROS_JS = ler('vybe-mundo-tutorial-roteiros.js');
const BASE_CSS = ler('padrao-v2/0-d3-base.css'), TEMAS_CSS = ler('padrao-v2/zt-temas.css');

// ============================================================ TEMA GUARDADO
function montarTema({ guardado = {}, sistemaEscuro = false, transicao = false } = {}) {
  const armazenamento = new Map(Object.entries(guardado));
  const atributos = new Map(), classes = new Set(['tema-escuro']), eventos = [], ouvintesSistema = [];
  const raiz = {
    getAttribute: (k) => (atributos.has(k) ? atributos.get(k) : null), setAttribute: (k, v) => atributos.set(k, String(v)),
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) }, style: {},
  };
  const media = { matches: sistemaEscuro, addEventListener: (_, f) => ouvintesSistema.push(f) };
  const doc = { documentElement: raiz, body: { dataset: {} }, dispatchEvent: (e) => eventos.push(e) };
  if (transicao) doc.startViewTransition = (f) => { f(); return { finished: Promise.resolve() }; };
  const c = vm.createContext({
    document: doc, CustomEvent: class { constructor(tipo, o) { this.type = tipo; this.detail = o?.detail; } },
    localStorage: { getItem: (k) => (armazenamento.has(k) ? armazenamento.get(k) : null), setItem: (k, v) => armazenamento.set(k, String(v)) },
    matchMedia: (q) => (/prefers-color-scheme/.test(q) ? media : { matches: false }),
  });
  c.window = c;
  vm.runInContext(TEMA_JS, c);
  return { T: c.VybeTema, armazenamento, atributos, classes, raiz, eventos, media, ouvintesSistema };
}

test('tema: quem nunca escolheu fica no Fumê; a escolha de antes (claro, escuro, auto) continua valendo', () => {
  const novo = montarTema();
  assert.equal(novo.T.escolhido(), 'fume');
  assert.equal(novo.atributos.get('data-d3-tema'), 'fume');
  assert.equal(novo.raiz.style.colorScheme, 'light');
  assert.equal(montarTema({ guardado: { 'irecity.tema': 'claro' } }).atributos.get('data-d3-tema'), 'claro');
  const escuro = montarTema({ guardado: { 'irecity.tema': 'escuro' } });
  assert.equal(escuro.atributos.get('data-d3-tema'), 'escuro');
  assert.equal(escuro.raiz.style.colorScheme, 'dark');
  // o escuro agora é pelos tokens: a classe que invertia a tela inteira sai
  assert.equal(escuro.classes.has('tema-escuro'), false);
  assert.equal(montarTema({ guardado: { 'irecity.tema': 'qualquer-coisa' } }).T.escolhido(), 'fume', 'valor estranho cai no Fumê');
});

test('tema: Auto segue o sistema, entre o claro e o escuro, e acompanha quando o sistema troca', () => {
  const dia = montarTema({ guardado: { 'irecity.tema': 'auto' } });
  assert.equal(dia.T.escolhido(), 'auto');
  assert.equal(dia.T.efetivo(), 'claro');
  assert.equal(dia.atributos.get('data-d3-tema'), 'claro');
  const noite = montarTema({ guardado: { 'irecity.tema': 'auto' }, sistemaEscuro: true });
  assert.equal(noite.atributos.get('data-d3-tema'), 'escuro');
  dia.media.matches = true; dia.ouvintesSistema.forEach((f) => f());
  assert.equal(dia.atributos.get('data-d3-tema'), 'escuro', 'o sistema escureceu: a tela acompanha');
  // quem escolheu um tema fixo não muda com o sistema
  const fixo = montarTema({ guardado: { 'irecity.tema': 'claro' } });
  fixo.media.matches = true; fixo.ouvintesSistema.forEach((f) => f());
  assert.equal(fixo.atributos.get('data-d3-tema'), 'claro');
});

test('tema: trocar guarda na mesma chave da aparência de antes, aplica na hora e avisa as telas', () => {
  for (const transicao of [false, true]) {
    const m = montarTema({ transicao });
    assert.equal(m.T.trocar('escuro'), 'escuro');
    assert.equal(m.armazenamento.get('irecity.tema'), 'escuro', 'a chave não começa com "vybe": o Sair não apaga');
    assert.equal(m.atributos.get('data-d3-tema'), 'escuro');
    assert.equal(m.eventos.at(-1).type, 'vybe:tema');
    assert.deepEqual({ ...m.eventos.at(-1).detail }, { escolhido: 'escuro', efetivo: 'escuro' });
    m.T.trocar('auto');
    assert.equal(m.armazenamento.get('irecity.tema'), 'auto');
    assert.equal(m.atributos.get('data-d3-tema'), 'claro');
    assert.equal(m.T.trocar('roxo'), 'fume', 'tema que não existe vira o padrão');
  }
  const m = montarTema();
  assert.equal(m.T.jaEscolheu(), false);
  m.T.marcarEscolheu();
  assert.equal(m.T.jaEscolheu(), true);
  assert.equal(m.armazenamento.get('irecity.tema.escolheu'), '1');
  assert.deepEqual([...m.T.TEMAS.map((t) => t.id)], ['fume', 'claro', 'escuro']);
  assert.deepEqual([...m.T.OPCOES], ['fume', 'claro', 'escuro', 'auto']);
});

// ============================================================ TOKENS E CONTRASTE
const cor = (s) => {
  s = String(s).trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) { const v = m[1].split(',').map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; }
  throw new Error('cor que o teste não lê: ' + s);
};
const sobre = (frente, fundo) => { const a = frente[3]; return [0, 1, 2].map((i) => frente[i] * a + fundo[i] * (1 - a)).concat(1); };
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function tokensDe(seletor) {
  const i = BASE_CSS.indexOf(seletor + '{');
  assert.ok(i >= 0, 'falta o bloco ' + seletor);
  const corpo = BASE_CSS.slice(i + seletor.length + 1, BASE_CSS.indexOf('}', i));
  const t = {};
  for (const m of corpo.matchAll(/(--d3-[\w-]+)\s*:\s*((?:[^;(]|\([^)]*\))+)/g)) t[m[1]] = m[2].trim();
  return t;
}
const FOLHA_ESCURA = '[data-d3-tema="escuro"] :is(#vv-hoje,body[data-modo="gestor"][data-pv2-vista="semana"] :is(#pv2-painel,#pv2-regua,#pv2-semana,#pv2-pe,#panel-week4),.d3-tema,.pv2-casa,#painel-demandas,#painel-clientes,#painel-diario,#painel-ai-usage,#painel-automacoes,#painel-conta,.vv-gestao,#vv-pessoas,#vv-conteudo,#vv-planejamentos,#vv-comercial,#vv-impressoes,#vv-carteira,#vv-reunioes,#vv-agentes,#vv-ferramentas,#vv-placa,#office-catalogo,#ofc-ranking,#workspace-drawer,#status-editor,#dono-editor):not(.d3-previa *),.d3-previa[data-d3-tema="escuro"]';
const TEMAS = {
  fume: tokensDe('[data-d3-tema="fume"]'),
  claro: tokensDe('[data-d3-tema="claro"]'),
  // no escuro a folha vem do bloco das telas V2, por cima do que o Fumê define para a folha
  escuro: { ...tokensDe('[data-d3-tema="fume"]'), ...tokensDe('[data-d3-tema="escuro"]'), ...tokensDe(FOLHA_ESCURA) },
};

test('tokens: os três temas definem as mesmas peças (ambiente, vidro, folha, tinta, rótulo, linhas, véus e cores de função)', () => {
  const precisa = ['ambiente', 'tema-fundo', 'ambiente-veu', 'fume', 'fume-forte', 'fume-borda', 'fume-veu', 'fume-veu-forte', 'fume-texto', 'fume-apagado', 'fume-texto2', 'fume-meta',
    'fume-escuro', 'fume-painel', 'fume-contra', 'acao-claro', 'perigo-claro', 'pronto-claro', 'ajuste-claro', 'info-claro', 'agente-claro', 'perigo-vidro',
    'folha', 'folha-sombra', 'cartao', 'tinta', 'texto2', 'apagado', 'rotulo', 'divisa', 'veu', 'veu-forte', 'contra', 'acao-texto', 'perigo', 'ajuste', 'pronto', 'info', 'ambar', 'agente-texto'];
  for (const [nome, t] of Object.entries(TEMAS)) for (const k of precisa) assert.ok(t['--d3-' + k], `${nome}: falta --d3-${k}`);
  // o Fumê do atributo é igual ao padrão do :root (quem nunca escolheu vê a mesma tela de antes)
  const raiz = tokensDe(':root');
  for (const k of ['fume', 'fume-texto', 'folha', 'tinta', 'rotulo', 'ambiente', 'acao-texto', 'perigo']) assert.equal(TEMAS.fume['--d3-' + k], raiz['--d3-' + k], `--d3-${k} do Fumê mudou em relação ao :root`);
  // o laranja de ação é o mesmo nos três
  assert.match(raiz['--d3-laranja'], /#C2490C 0%,#A83D08 100%/);
  for (const bloco of ['[data-d3-tema="claro"]', '[data-d3-tema="escuro"]', FOLHA_ESCURA]) assert.equal(tokensDe(bloco)['--d3-laranja'], undefined, 'o laranja não muda por tema');
});

test('contraste: letra e cores de função dão 4,5:1 ou mais sobre a camada delas, nos três temas', () => {
  const ruins = [];
  for (const [nome, t] of Object.entries(TEMAS)) {
    const v = (k) => cor(t['--d3-' + k]);
    const fundo = v('tema-fundo');
    const vidro = sobre(v('fume'), fundo);                 // o HUD e a janela V2 sobre o ambiente
    const painel = v('fume-painel');                       // menus que abrem do HUD
    const tira = sobre(v('fume-veu-forte'), vidro);        // a tira de véu mais forte sobre o vidro
    const folha = sobre(v('folha'), vidro);                // o cartão sobre a janela de vidro
    const folhaVeu = sobre(v('veu-forte'), folha);         // o véu mais forte sobre a folha (escolhido, botão)
    const confere = (oque, letra, base, minimo = 4.5) => { const r = contraste(sobre(letra, base), base); if (r < minimo) ruins.push(`${nome}: ${oque} ${r.toFixed(2)}`); };
    for (const base of [['vidro', vidro], ['painel', painel], ['tira', tira]]) {
      confere(`fume-texto no ${base[0]}`, v('fume-texto'), base[1]);
      confere(`fume-apagado no ${base[0]}`, v('fume-apagado'), base[1]);
      // as cores de função valem sobre a camada lisa (vidro e painel); sobre a tira de véu forte quem carrega a leitura é a letra
      if (base[0] !== 'tira') for (const k of ['acao-claro', 'perigo-claro', 'pronto-claro', 'ajuste-claro', 'info-claro', 'agente-claro', 'perigo-vidro']) confere(`${k} no ${base[0]}`, v(k), base[1]);
    }
    for (const base of [['folha', folha], ['véu da folha', folhaVeu]]) {
      confere(`tinta na ${base[0]}`, v('tinta'), base[1]);
      confere(`texto2 na ${base[0]}`, v('texto2'), base[1]);
      confere(`rotulo na ${base[0]}`, v('rotulo'), base[1]);
      if (base[0] === 'folha') for (const k of ['acao-texto', 'perigo', 'ajuste', 'pronto', 'info', 'ambar', 'agente-texto']) confere(`${k} na ${base[0]}`, v(k), base[1]);
    }
    confere('apagado na folha', v('apagado'), folha);
    // os pares que invertem juntos
    confere('fume-contra sobre fume-texto (o escolhido no vidro)', v('fume-contra'), v('fume-texto'));
    confere('contra sobre tinta (o botão cheio da folha)', v('contra'), v('tinta'));
    // o laranja, igual em todo tema: letra branca e o botão branco com a letra laranja
    confere('branco no laranja', cor('#FFFFFF'), cor('#C2490C'));
    confere('acao-texto-fixa no botão branco', cor(tokensDe(':root')['--d3-acao-texto-fixa']), cor('#FFFFFF'));
  }
  assert.deepEqual(ruins, []);
});

test('CSS dos temas: sem !important, sem html body.mundo, sem :has com [style], nenhum keyframe começa invisível', () => {
  const semComentario = TEMAS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(semComentario, /!important/);
  assert.doesNotMatch(semComentario, /html\s+body\.mundo/);
  assert.doesNotMatch(semComentario, /:has\([^)]*\[style/);
  const quadros = [...semComentario.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)];
  assert.ok(quadros.length >= 5, 'os keyframes da troca de tema e das prévias');
  for (const [, nome, corpo] of quadros) {
    const comeco = corpo.match(/(?:from|0%[^{]*)\{([^}]*)\}/)?.[1] || '';
    const op = comeco.match(/opacity\s*:\s*([\d.]+)/);
    assert.ok(!op || Number(op[1]) > 0, `@keyframes ${nome} começa em opacity ${op?.[1]}`);
  }
  // o fragmento entra na folha gerada, por último
  const junto = ler('vybe-mundo-padrao-v2.css');
  assert.ok(junto.includes('/* ===== padrao-v2/zt-temas.css ===== */'), 'rode node scripts/padrao-v2-juntar.mjs');
  assert.ok(junto.indexOf('padrao-v2/zt-temas.css') > junto.indexOf('padrao-v2/z-direcao.css'));
  assert.ok(junto.includes(TEMAS_CSS.trim().split('\n').at(-1)), 'a folha gerada está atrás do fragmento: rode node scripts/padrao-v2-juntar.mjs');
});

test('painel: vybe-tema.js carrega antes de quem usa o tema; os roteiros, depois do tutorial; a Aparência tem as quatro opções', () => {
  const html = ler('index.html'), mundo = ler('vybe-mundo.js'), conta = ler('vybe-conta.js');
  const pos = (f) => { const i = html.indexOf(`<script src="/${f}"></script>`); assert.ok(i > 0, 'falta ' + f); return i; };
  assert.ok(pos('vybe-tema.js') < pos('vybe-appearance.js'));
  assert.ok(pos('vybe-tema.js') < pos('vybe-mundo-tutorial.js'));
  assert.ok(pos('vybe-mundo-tutorial.js') < pos('vybe-mundo-tutorial-roteiros.js'));
  assert.ok(pos('vybe-mundo-tutorial-roteiros.js') < pos('vybe-mundo.js'));
  assert.match(mundo, /temaBt\('fume', 'Fumê'\)\}\$\{temaBt\('claro', 'Claro'\)\}\$\{temaBt\('escuro', 'Escuro'\)\}\$\{temaBt\('auto', 'Auto'\)\}/);
  assert.match(conta, /temaBotao\('fume', 'Fumê'\)\}\$\{temaBotao\('claro', 'Claro'\)\}\$\{temaBotao\('escuro', 'Escuro'\)\}\$\{temaBotao\('auto', 'Auto'\)\}/);
  // uma fonte só: o menu e a Minha conta não guardam nem aplicam o tema por conta própria
  assert.doesNotMatch(mundo, /classList\?*\.toggle\('tema-escuro'/);
  assert.doesNotMatch(conta, /classList\.toggle\('tema-escuro'/);
});

// ============================================================ TUTORIAL DE CADA TELA
class Elemento {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.doc = doc; this.filhos = []; this.pai = null; this.atributos = new Map(); this.ouvintes = {}; this.classes = new Set(); this.hidden = false; this.style = { setProperty(k, v) { this[k] = v; } }; }
  get classList() { const s = this.classes; return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), contains: (x) => s.has(x), toggle: (x, f) => { const sim = f === undefined ? !s.has(x) : Boolean(f); if (sim) s.add(x); else s.delete(x); return sim; } }; }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(' '); }
  setAttribute(k, v) { if (k === 'class') this.className = v; if (k === 'hidden') this.hidden = true; this.atributos.set(k, String(v)); }
  getAttribute(k) { return this.atributos.has(k) ? this.atributos.get(k) : null; }
  hasAttribute(k) { return this.atributos.has(k); }
  removeAttribute(k) { this.atributos.delete(k); }
  append(...nos) { for (const x of nos) { if (x == null) continue; if (typeof x === 'string') { this.filhos.push({ texto: x }); continue; } x.remove(); x.pai = this; this.filhos.push(x); } }
  remove() { if (!this.pai) return; this.pai.filhos = this.pai.filhos.filter((f) => f !== this); this.pai = null; }
  get isConnected() { for (let p = this; p; p = p.pai) if (p === this.doc.body) return true; return false; }
  contains(x) { for (let p = x; p; p = p.pai) if (p === this) return true; return false; }
  closest(sel) { for (let p = this; p; p = p.pai) { if (sel === '[hidden]' && p.hidden) return p; if (/^\.[\w-]+$/.test(sel) && p.classes?.has(sel.slice(1))) return p; } return null; }
  set textContent(v) { this.filhos = [{ texto: String(v) }]; }
  get textContent() { return this.filhos.map((f) => (f instanceof Elemento ? f.textContent : f.texto)).join(''); }
  addEventListener(t, f) { (this.ouvintes[t] ||= []).push(f); }
  removeEventListener(t, f) { this.ouvintes[t] = (this.ouvintes[t] || []).filter((x) => x !== f); }
  click() { const ev = { type: 'click', target: this, preventDefault() {}, stopPropagation() {} }; for (const f of this.ouvintes.click || []) f(ev); }
  focus() { this.doc.activeElement = this; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  get offsetWidth() { return 320; }
  get offsetHeight() { return 190; }
}
const alvo = (left, top, width, height) => ({ isConnected: true, hidden: false, getBoundingClientRect() { return { left, top, width, height, right: left + width, bottom: top + height }; }, closest() { return null; } });

// alvos: { seletor: [alvo] } é a tela "desenhada"; trocar o objeto troca de tela.
function montar({ pessoa = { id: 42, name: 'Tainara Souza' }, alvos = {}, armazenamento = new Map(), visto = { passeios: { 'boas-vindas': 'x' } }, comTema = null, roteiros = false } = {}) {
  const criados = [], tela = { alvos };
  const ouvintesDoc = {};
  const doc = {
    activeElement: null,
    createElement(tag) { const e = new Elemento(tag, doc); criados.push(e); return e; },
    querySelectorAll(sel) { return tela.alvos[sel] || []; },
    addEventListener: (t, f) => (ouvintesDoc[t] ||= []).push(f), removeEventListener() {},
    documentElement: { classList: { contains: () => false } },
  };
  doc.body = new Elemento('body', doc);
  if (visto) armazenamento.set('vybe.tour.' + pessoa.id, JSON.stringify({ v: 1, dicas: {}, semDicas: false, ...visto }));
  const relogio = new Map(); let seq = 0; const ouvintes = {};
  const c = vm.createContext({
    console, document: doc, innerWidth: 1440, innerHeight: 900,
    localStorage: { getItem: (k) => (armazenamento.has(k) ? armazenamento.get(k) : null), setItem: (k, v) => armazenamento.set(k, String(v)), removeItem: (k) => armazenamento.delete(k) },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false }),
    setTimeout: (f) => { relogio.set(++seq, f); return seq; }, clearTimeout: (id) => relogio.delete(id), setInterval: () => ++seq, clearInterval: () => {},
    addEventListener: (t, f) => (ouvintes[t] ||= []).push(f), removeEventListener: (t, f) => { ouvintes[t] = (ouvintes[t] || []).filter((x) => x !== f); },
    operadorDoTopo: () => pessoa, pessoaLogada: () => null,
  });
  c.window = c;
  if (comTema) c.VybeTema = comTema;
  vm.runInContext(TUTORIAL_JS, c);
  if (roteiros) vm.runInContext(ROTEIROS_JS, c);
  const vivos = () => criados.filter((e) => e.isConnected);
  const achar = (fn) => vivos().find(fn);
  return {
    T: c.VybeTutorial, doc, tela, armazenamento,
    rodar() { for (let n = 0; n < 200 && relogio.size; n++) { const [id, f] = relogio.entries().next().value; relogio.delete(id); f(); } },
    clicarNaPagina() { for (const f of ouvintesDoc.click || []) f({ target: { closest: () => null } }); },
    tecla(key) { const ev = { key, target: doc.activeElement || doc.body, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} }; for (const f of [...(ouvintes.keydown || [])]) f(ev); },
    botao: (nome) => achar((e) => e.getAttribute('data-tour') === nome),
    titulo: () => achar((e) => e.classes.has('vv-tour-titulo'))?.textContent,
    conta: () => achar((e) => e.classes.has('vv-tour-conta'))?.textContent,
    classe: (cls) => achar((e) => e.classes.has(cls)),
    guardado: () => JSON.parse(armazenamento.get('vybe.tour.' + pessoa.id) || '{}'),
  };
}
const ROTEIRO = [{ id: 'painel', nome: 'Painel de teste', se: '#painel', cobre: ['trilho:gestor'], passos: [
  { alvo: '#painel .topo', titulo: 'O topo', texto: 'Esse é o topo, {nome}.' },
  { alvo: '#painel .nao-existe', titulo: 'Parte que sumiu', texto: 'Não deve aparecer.' },
  { alvo: '#painel .lista', titulo: 'A lista', texto: 'Essa é a lista.' },
  { alvo: '#painel .pe', titulo: 'O pé', texto: 'E esse é o pé.' },
] }];
const TELA_PAINEL = () => ({ '#painel': [alvo(100, 20, 1200, 700)], '#painel .topo': [alvo(100, 20, 1200, 60)], '#painel .lista': [alvo(100, 100, 800, 400)], '#painel .pe': [alvo(100, 640, 1200, 60)] });

test('roteiro: abre sozinho na primeira vez que a tela aparece, e só nela; passo sem a parte na tela é pulado sem erro', () => {
  const m = montar({ alvos: {} });
  assert.equal(m.T.registrarTelas(ROTEIRO), 1);
  assert.equal(m.T.telaAtual(), '');
  m.clicarNaPagina(); m.rodar();
  assert.equal(m.T.estado().aberto, '', 'a tela não está aberta: nada aparece');
  m.tela.alvos = TELA_PAINEL();                      // a pessoa abriu a tela
  assert.equal(m.T.telaAtual(), 'painel');
  m.clicarNaPagina(); m.rodar();
  assert.equal(m.T.estado().aberto, 'passeio');
  assert.equal(m.T.estado().passeio, 'tela:painel');
  assert.equal(m.titulo(), 'O topo');
  assert.equal(m.conta(), '1 de 3', 'o passo cuja parte não existe não entra na conta');
  assert.equal(m.classe('vv-tour-texto').textContent, 'Esse é o topo, Tainara.');
  m.botao('proximo').click();
  assert.equal(m.titulo(), 'A lista', 'pulou "Parte que sumiu" sem erro');
  m.tecla('ArrowRight');
  assert.equal(m.titulo(), 'O pé');
  m.tecla('ArrowLeft');
  assert.equal(m.titulo(), 'A lista', 'a seta para a esquerda volta');
  m.botao('voltar').click();
  assert.equal(m.titulo(), 'O topo', 'Voltar também pula o passo sem alvo');
  m.botao('proximo').click(); m.botao('proximo').click();
  assert.equal(m.botao('proximo').textContent, 'Concluir');
  m.botao('proximo').click();
  assert.equal(m.T.estado().aberto, '');
  assert.ok(m.guardado().passeios['tela:painel'], 'ficou guardado como visto, por pessoa');
  assert.ok(m.guardado().dicas['trilho:gestor'], 'a dica que o roteiro cobre conta como vista');
  // segunda abertura: não repete
  m.clicarNaPagina(); m.rodar();
  assert.equal(m.T.estado().aberto, '');
});

test('roteiro: Pular e Esc fecham e contam como visto; outra pessoa no mesmo navegador vê o dela', () => {
  const armazenamento = new Map();
  const m = montar({ alvos: TELA_PAINEL(), armazenamento });
  m.T.registrarTelas(ROTEIRO);
  m.clicarNaPagina(); m.rodar();
  assert.equal(m.T.estado().aberto, 'passeio');
  m.botao('pular').click();
  assert.equal(m.T.estado().aberto, '');
  assert.ok(m.guardado().passeios['tela:painel']);
  m.clicarNaPagina(); m.rodar();
  assert.equal(m.T.estado().aberto, '', 'pulou: não insiste');

  const outra = montar({ pessoa: { id: 7, name: 'Paulo Martins' }, alvos: TELA_PAINEL(), armazenamento });
  outra.T.registrarTelas(ROTEIRO);
  outra.clicarNaPagina(); outra.rodar();
  assert.equal(outra.T.estado().aberto, 'passeio', 'a memória é por pessoa');
  assert.equal(outra.classe('vv-tour-texto').textContent, 'Esse é o topo, senhor.', 'os donos são "senhor"; o resto da equipe, pelo nome');
  outra.tecla('Escape');
  assert.equal(outra.T.estado().aberto, '');
  assert.ok(outra.guardado().passeios['tela:painel'], 'Esc também conta como visto');
});

test('roteiro: a tela ainda sem nenhuma parte desenhada não abre nem conta como vista; "não mostrar mais dicas" desliga', () => {
  const m = montar({ alvos: { '#painel': [alvo(100, 20, 1200, 700)] } });
  m.T.registrarTelas(ROTEIRO);
  m.clicarNaPagina(); m.rodar();
  assert.equal(m.T.estado().aberto, '');
  assert.equal(m.guardado().passeios['tela:painel'], undefined, 'não marcou como visto sem mostrar nada');
  m.tela.alvos = TELA_PAINEL();
  m.clicarNaPagina(); m.rodar();
  assert.equal(m.T.estado().aberto, 'passeio', 'desenhou: agora abre');

  const quieto = montar({ alvos: TELA_PAINEL(), visto: { passeios: { 'boas-vindas': 'x' }, semDicas: true } });
  quieto.T.registrarTelas(ROTEIRO);
  quieto.clicarNaPagina(); quieto.rodar();
  assert.equal(quieto.T.estado().aberto, '');
  // antes do passeio de boas-vindas, nenhum roteiro de tela passa na frente
  const novato = montar({ alvos: TELA_PAINEL(), visto: { passeios: {} } });
  novato.T.registrarTelas(ROTEIRO);
  assert.equal(novato.T.conferirTela(), false);
});

// Reriston (equipe, 16/11/2026): "não conseguiu nem mudar o responsável nem o status". O roteiro da tela abria 700 ms
// depois do clique que abriu o menu de status (ou de responsável) e o fundo transparente do passeio, por cima de tudo,
// engolia a escolha seguinte. Com o menu, a caixa da troca ou a gaveta à vista, o roteiro espera; fechou, ele entra.
test('roteiro: não abre por cima do menu de status ou de responsável, da caixa da troca nem da gaveta; entra depois', () => {
  for (const aberto of ['#status-editor', '#dono-editor', '#workflow-modal', '#workspace-drawer']) {
    const m = montar({ alvos: { ...TELA_PAINEL(), [aberto]: [alvo(600, 300, 260, 220)] } });
    m.T.registrarTelas(ROTEIRO);
    m.clicarNaPagina(); m.rodar();                    // o clique que abriu o menu
    assert.equal(m.T.estado().aberto, '', `${aberto} aberto: nenhum fundo do passeio por cima dele`);
    assert.equal(m.classe('vv-tour-fundo'), undefined, aberto);
    assert.equal(m.guardado().passeios['tela:painel'], undefined, 'esperar não conta como visto');
    delete m.tela.alvos[aberto];                      // escolheu e o menu fechou
    m.rodar();
    assert.equal(m.T.estado().aberto, 'passeio', `${aberto} fechou: o roteiro entra`);
  }
});

test('Ajuda do VYBES: reabre o tutorial da tela atual, mesmo já visto; sem roteiro na tela, abre a janela da Ajuda', () => {
  const m = montar({ alvos: TELA_PAINEL(), visto: { passeios: { 'boas-vindas': 'x', 'tela:painel': 'x' } } });
  m.T.registrarTelas(ROTEIRO);
  assert.equal(m.T.ajuda(), true);
  assert.equal(m.T.estado().aberto, 'passeio');
  assert.equal(m.T.estado().passeio, 'tela:painel');
  assert.ok(m.botao('toda-ajuda'), 'do tutorial dá para chegar à janela com todo o resto');
  m.botao('toda-ajuda').click();
  assert.equal(m.T.estado().aberto, 'ajuda');
  assert.ok(m.classe('vv-tour-janela'));
  m.T.fechar();
  m.tela.alvos = {};
  m.T.ajuda();
  assert.equal(m.T.estado().aberto, 'ajuda', 'tela sem roteiro: a janela de sempre');
});

test('um tutorial de cada vez: a dica de primeira vez dá a vez ao roteiro da tela e não aparece por cima', () => {
  const alvos = { ...TELA_PAINEL(), '.vv-trilho-btn[data-trilho="gestor"]': [alvo(20, 300, 64, 52)] };
  const m = montar({ alvos });
  m.T.registrarTelas(ROTEIRO);
  m.T.dica('trilho:gestor');            // o que o dock pede ao abrir a tela
  m.clicarNaPagina(); m.rodar();
  assert.equal(m.T.estado().aberto, 'passeio', 'abriu o roteiro, não a dica');
  assert.equal(m.classe('vv-tour-dica'), undefined);
  m.botao('pular').click(); m.rodar();
  assert.equal(m.T.estado().aberto, '', 'e a dica coberta não volta depois');
});

test('boas-vindas: aparece antes do passeio para quem ainda não escolheu o tema; escolher troca na hora; fechar não repete', () => {
  const trocas = []; let escolheu = false, atual = 'fume';
  const VybeTema = { TEMAS: [{ id: 'fume', nome: 'Fumê', resumo: 'a' }, { id: 'claro', nome: 'Claro', resumo: 'b' }, { id: 'escuro', nome: 'Escuro', resumo: 'c' }], ROTULOS: { fume: 'Fumê', claro: 'Claro', escuro: 'Escuro', auto: 'Auto' },
    escolhido: () => atual, jaEscolheu: () => escolheu, marcarEscolheu: () => { escolheu = true; }, trocar: (t) => { atual = t; trocas.push(t); } };
  const HUD = { '#vv-hoje': [alvo(104, 14, 440, 700)], '.vv-trilho': [alvo(14, 120, 76, 560)] };
  const m = montar({ alvos: HUD, visto: null, comTema: VybeTema });
  assert.equal(m.T.iniciar(), true);
  assert.equal(m.T.estado().aberto, 'boas-vindas');
  assert.equal(m.classe('vv-tour-balao'), undefined, 'o passeio espera a escolha');
  const cartoes = ['fume', 'claro', 'escuro'].map((t) => m.botao('tema-' + t));
  assert.ok(cartoes.every(Boolean), 'três cartões, um por tema');
  assert.ok(cartoes.every((b) => b.filhos.some((f) => f.classes?.has('d3-previa') && f.getAttribute('data-d3-tema') === b.getAttribute('data-tema'))), 'cada cartão leva a prévia no próprio tema');
  assert.equal(m.botao('tema-fume').getAttribute('aria-checked'), 'true');
  assert.match(m.classe('vt-titulo').textContent, /^Boas-vindas ao Vybe OS, Tainara\.$/);
  m.botao('tema-escuro').click();
  assert.deepEqual(trocas, ['escuro'], 'o tema troca na hora, sem esperar o Começar');
  assert.equal(m.botao('tema-escuro').getAttribute('aria-checked'), 'true');
  assert.equal(m.botao('tema-fume').getAttribute('aria-checked'), 'false');
  assert.equal(m.botao('comecar').textContent, 'Começar com o Escuro');
  m.tecla('ArrowLeft');
  assert.equal(trocas.at(-1), 'claro', 'as setas passam de um tema ao outro');
  m.botao('tema-auto').click();
  assert.equal(trocas.at(-1), 'auto');
  m.botao('comecar').click();
  assert.equal(escolheu, true);
  assert.equal(m.T.estado().aberto, 'passeio', 'depois da escolha vem o passeio de boas-vindas');
  assert.equal(m.T.estado().passeio, 'boas-vindas');
  m.T.fechar();
  assert.equal(m.T.iniciar(), true, 'o passeio (não visto) abre de novo');
  assert.equal(m.T.estado().aberto, 'passeio', 'mas a escolha do tema não volta');
  // Esc na escolha também fecha, guarda e segue (dá para pular)
  escolheu = false;
  const n = montar({ alvos: HUD, visto: null, comTema: VybeTema });
  n.T.iniciar();
  assert.equal(n.T.estado().aberto, 'boas-vindas');
  n.tecla('Escape');
  assert.equal(escolheu, true);
  assert.equal(n.T.estado().aberto, 'passeio');
  // pela Ajuda dá para rever a escolha
  n.T.fechar();
  assert.equal(n.T.boasVindas({ forcar: true }), true);
  assert.equal(n.T.estado().aberto, 'boas-vindas');
});

test('roteiros: as telas do padrão novo e os módulos principais têm roteiro; cada passo tem alvo, título e fala curta', () => {
  const m = montar({ roteiros: true });
  const passeios = m.T.CONTEUDO.passeios;
  const telas = Object.entries(passeios).filter(([, p]) => p.tela);
  const ids = telas.map(([, p]) => p.tela);
  for (const id of ['hoje-agencia', 'hoje-criacao', 'hoje-tarefas', 'hoje-coordenacao', 'producao', 'menu-conta', 'menu-setor', 'menu-avisos', 'menu-agenda', 'menu-chat',
    'clientes', 'aprovacao', 'feed', 'agenda', 'planejamentos', 'gestao', 'financeiro']) assert.ok(ids.includes(id), 'falta o roteiro de ' + id);
  assert.equal(new Set(ids).size, ids.length, 'id repetido');
  for (const [chave, p] of telas) {
    assert.equal(chave, 'tela:' + p.tela);
    assert.ok(p.titulo && p.resumo, `${p.tela}: nome e resumo (aparecem na Ajuda)`);
    assert.ok(p.passos.length >= 2 && p.passos.length <= 8, `${p.tela}: de 2 a 8 passos`);
    for (const passo of p.passos) {
      assert.ok(passo.alvo && passo.alvo.length, `${p.tela}: passo sem alvo`);
      for (const sel of [].concat(passo.alvo)) assert.doesNotMatch(sel, /\[style/, 'seletor por estilo escrito');
      assert.ok(passo.titulo && passo.titulo.length <= 28, `${p.tela}: título curto (${passo.titulo})`);
      assert.ok(passo.texto && passo.texto.length <= 220, `${p.tela} · ${passo.titulo}: fala curta (${passo.texto.length} letras)`);
      // conversa, não relatório: sem rótulo na frente, sem ponto e vírgula, sem travessão
      assert.doesNotMatch(passo.texto, /^(Atenção|Dica|Importante|Observação|Nota)\s*:/i, `${p.tela} · ${passo.titulo}`);
      assert.doesNotMatch(passo.texto, /[;—]/, `${p.tela} · ${passo.titulo}`);
    }
  }
  // a ordem decide quem vence: os menus antes das telas, e o Hoje por último (ele fica por baixo de tudo)
  const ordem = ids.map((id) => (id.startsWith('menu-') ? 0 : id.startsWith('hoje-') ? 2 : 1));
  assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b));
  // o Hoje só casa sem módulo aberto por cima
  assert.match(ROTEIROS_JS, /const HOJE = 'body:not\(\.mundo-modulo\) #vv-hoje';/);
  // a personalidade do VYBES não é copiada para cá
  assert.doesNotMatch(ROTEIROS_JS, /mordomo|PERSONALIDADE|PROMPT_BASE/);
});

// Os roteiros como saem do arquivo (com o `se`, que o CONTEUDO não guarda): cada um tem o seletor da tela e passos com
// alvo, título e texto. As telas V2 que ganharam roteiro (16/11/2026) estão todas aqui, curtas (3 a 6 passos), e as de
// Finanças, Comercial, Carteira e Agentes ficam presas à janela e ao data-tela, porque a janela de antes continua no
// DOM por baixo (com hidden) e não pode casar no lugar da nova.
function roteirosDoArquivo() {
  const lista = [];
  const c = vm.createContext({ console, VybeTutorial: { registrarTelas: (l) => { lista.push(...l); return lista.length; } } });
  c.window = c;
  vm.runInContext(ROTEIROS_JS, c);
  return lista;
}
test('roteiros: cada um tem `se` e passos com alvo, título e texto; as telas V2 têm roteiro curto', () => {
  const lista = roteirosDoArquivo();
  const seletor = (s) => typeof s === 'string' && s.trim().length > 0 && !/\[style/.test(s);
  for (const r of lista) {
    assert.ok(r.id && r.nome && r.resumo, `${r.id}: id, nome e resumo`);
    const se = [].concat(r.se || []);
    assert.ok(se.length && se.every(seletor), `${r.id}: \`se\` com seletor`);
    assert.ok(Array.isArray(r.passos) && r.passos.length >= 2 && r.passos.length <= 8, `${r.id}: de 2 a 8 passos`);
    for (const p of r.passos) {
      assert.ok(p && typeof p === 'object', `${r.id}: passo vazio`);
      assert.ok([].concat(p.alvo || []).length && [].concat(p.alvo).every(seletor), `${r.id} · ${p.titulo}: alvo`);
      assert.ok(typeof p.titulo === 'string' && p.titulo.trim(), `${r.id}: título`);
      assert.ok(typeof p.texto === 'string' && p.texto.trim(), `${r.id} · ${p.titulo}: texto`);
      if (p.lado) assert.match(p.lado, /^(direita|esquerda|baixo|cima)$/, `${r.id} · ${p.titulo}: lado`);
    }
    for (const c of r.cobre || []) assert.match(c, /^(trilho|ferr):[a-z-]+$|^modulo$/, `${r.id}: cobre ${c}`);
  }
  const ids = lista.map((r) => r.id);
  const NOVAS = ['producao-mes', 'feed', 'producao-grupos', 'producao-equipe', 'demandas', 'tarefas', 'direcao', 'impressoes', 'projetos', 'comercial', 'pacotes',
    'orcamentos', 'contratos', 'churn', 'agentes', 'financas-cliente', 'recebimentos', 'contas', 'inadimplencia', 'extrato', 'clientes-mes', 'cartao', 'fixos',
    'vales', 'projecao', 'automacoes', 'conta', 'rh-produtividade', 'rh-pedidos', 'rh-recrutamento', 'rh-documentos', 'academy', 'toolkit', 'onboarding',
    'reunioes', 'fornecedores', 'creators', 'conversas', 'diario', 'performance', 'ia-custos', 'centro', 'predio', 'minha-sala', 'jogos', 'loja', 'ranking',
    'conquistas', 'equipe'];
  for (const id of NOVAS) {
    const r = lista.find((x) => x.id === id);
    assert.ok(r, 'falta o roteiro de ' + id);
    assert.ok(r.passos.length >= 3 && r.passos.length <= 6, `${id}: de 3 a 6 passos (tem ${r.passos.length})`);
    assert.ok(r.passos.some((p) => p.texto.includes('{nome}')), `${id}: trata a pessoa pelo {nome}`);
  }
  // Finanças: cada tela do molde casa pelo data-tela dela, e todos os passos ficam dentro dela
  for (const [id, tela] of [['financas-cliente', 'fx-financas'], ['recebimentos', 'rec'], ['contas', 'con'], ['inadimplencia', 'ina'], ['extrato', 'fx-extrato'],
    ['clientes-mes', 'fx-clientes_mes'], ['cartao', 'fx-cartao'], ['fixos', 'fx-fixos'], ['vales', 'fx-vales'], ['projecao', 'fx-projecao']]) {
    const r = lista.find((x) => x.id === id), raiz = `#vv-comercial .d3m-d-fm[data-tela="${tela}"]`;
    assert.ok(r.se.startsWith(raiz), `${id}: se pelo data-tela`);
    for (const p of r.passos) assert.ok([].concat(p.alvo).every((a) => a.startsWith(raiz)), `${id} · ${p.titulo}: alvo dentro da tela`);
  }
  // janelas que ficam por baixo: o seletor diz a janela
  for (const [id, janela] of [['agentes', '#vv-agentes'], ['contratos', '#vv-carteira'], ['churn', '#vv-carteira'], ['onboarding', '#vv-carteira'], ['comercial', '#vv-comercial'],
    ['pacotes', '#vv-comercial'], ['orcamentos', '#vv-comercial'], ['fornecedores', '#vv-comercial'], ['creators', '#vv-comercial']]) {
    const r = lista.find((x) => x.id === id);
    assert.ok(r.se.startsWith(janela), `${id}: se começa pela janela`);
    for (const p of r.passos) assert.ok([].concat(p.alvo).every((a) => a.startsWith(janela)), `${id} · ${p.titulo}: alvo dentro da janela`);
  }
  // quem abre por cima do Hoje vem antes dele; o Ranking abre por cima da Loja e vem antes dela; os módulos que o Hoje
  // desenha por dentro (Minhas tarefas, Direção de arte) também vêm antes dos roteiros do Hoje
  const pos = (id) => ids.indexOf(id);
  for (const id of ['loja', 'conquistas', 'ranking', 'tarefas', 'direcao', 'equipe', 'jogos']) assert.ok(pos(id) < pos('hoje-agencia'), `${id} antes do Hoje`);
  assert.ok(pos('ranking') < pos('loja'), 'Ranking antes da Loja');
  assert.ok(pos('performance') < pos('gestao') && pos('performance') < pos('diario'), 'Performance antes da Gestão e do Diário');
  // os seletores antigos das telas remontadas saíram
  assert.doesNotMatch(ROTEIROS_JS, /#vfd-camada|\.d3c-fin|\.fv2-topo|\.v2c-cols|#pv2-agenda|\.p2-lista|\.d3g-setores|#kpi-grid-clientes/);
});
