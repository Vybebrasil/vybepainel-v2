// O tutorial do VYBES no Irecity (vybe-mundo-tutorial.js): passeio de boas-vindas, dicas de
// primeira vez e a Ajuda. SAFE: roda o arquivo de verdade numa sandbox com um DOM falso mínimo,
// localStorage em memória e relógio manual. Sem rede, sem banco, sem WhatsApp.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const CODIGO = fs.readFileSync('vybe-mundo-tutorial.js', 'utf8');

class Elemento {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.doc = doc; this.filhos = []; this.pai = null;
    this.atributos = new Map(); this.ouvintes = {}; this.classes = new Set();
    this.hidden = false; this.disabled = false; this.checked = false;
    this.style = { setProperty(k, v) { this[k] = v; } };
  }
  get classList() {
    const s = this.classes;
    return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), contains: (x) => s.has(x),
      toggle: (x, f) => { const sim = f === undefined ? !s.has(x) : Boolean(f); if (sim) s.add(x); else s.delete(x); return sim; } };
  }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(' '); }
  setAttribute(k, v) {
    if (k === 'class') this.className = v;
    if (k === 'hidden') this.hidden = true;
    if (k === 'checked') this.checked = true;
    this.atributos.set(k, String(v));
  }
  getAttribute(k) { return this.atributos.has(k) ? this.atributos.get(k) : null; }
  removeAttribute(k) { this.atributos.delete(k); }
  append(...nos) {
    for (const x of nos) {
      if (x == null) continue;
      if (typeof x === 'string') { this.filhos.push({ texto: x }); continue; }
      x.remove(); x.pai = this; this.filhos.push(x);
    }
  }
  remove() { if (!this.pai) return; this.pai.filhos = this.pai.filhos.filter((f) => f !== this); this.pai = null; }
  get isConnected() { for (let p = this; p; p = p.pai) if (p === this.doc.body) return true; return false; }
  contains(x) { for (let p = x; p; p = p.pai) if (p === this) return true; return false; }
  closest(sel) {
    for (let p = this; p; p = p.pai) {
      if (sel === '[hidden]' && p.hidden) return p;
      if (/^\.[\w-]+$/.test(sel) && p.classes?.has(sel.slice(1))) return p;
    }
    return null;
  }
  set textContent(v) { this.filhos = [{ texto: String(v) }]; }
  get textContent() { return this.filhos.map((f) => (f instanceof Elemento ? f.textContent : f.texto)).join(''); }
  addEventListener(t, f) { (this.ouvintes[t] ||= []).push(f); }
  removeEventListener(t, f) { this.ouvintes[t] = (this.ouvintes[t] || []).filter((x) => x !== f); }
  disparar(t) { const ev = { type: t, target: this, currentTarget: this, preventDefault() {}, stopPropagation() {} }; for (const f of this.ouvintes[t] || []) f(ev); }
  click() { this.disparar('click'); }
  focus() { this.doc.activeElement = this; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  get offsetWidth() { return 320; }
  get offsetHeight() { return 190; }
}

// Um alvo do HUD (o que o seletor acharia na tela de verdade).
const alvo = (left, top, width, height, extra = {}) => ({
  isConnected: true, hidden: false, ...extra,
  getBoundingClientRect() { return { left, top, width, height, right: left + width, bottom: top + height }; },
  closest(sel) { return sel === '[hidden]' && this.hidden ? this : null; },
});

// O HUD inteiro, menos a barra de voz (ela fica escondida quando a pessoa não está no Escritório).
const HUD = () => ({
  '#vv-hoje': [alvo(104, 14, 440, 700)],
  '.vv-trilho': [alvo(14, 120, 76, 560)],
  '.vv-trilho-btn[data-trilho="criar"]': [alvo(20, 300, 64, 52)],
  '.vv-barra-topo .vv-ferramentas': [alvo(900, 14, 230, 44)],
  '.vv-barra-topo .vv-vistas': [alvo(1140, 14, 286, 44)],
  '#mundo': [alvo(0, 0, 1440, 900)],
  '[data-trilho="centro"]': [alvo(14, 330, 76, 52)],
  '.vv-chamada': [alvo(560, 840, 400, 48, { hidden: true })],
  '.vv-trilho-btn[data-trilho="vybes"]': [alvo(20, 620, 64, 52)],
  '.vv-trilho-btn[data-trilho="tarefas"]': [alvo(20, 240, 64, 52)],
});

function montar({ pessoa = { id: 42, name: 'Tainara Souza' }, logado = null, alvos = HUD(), armazenamento = new Map(), corpo = [] } = {}) {
  const criados = [];
  const doc = {
    activeElement: null,
    createElement(tag) { const e = new Elemento(tag, doc); criados.push(e); return e; },
    querySelectorAll(sel) { return alvos[sel] || []; },
    addEventListener() {}, removeEventListener() {},
    documentElement: { classList: { contains: () => false } },
  };
  doc.body = new Elemento('body', doc);
  corpo.forEach((c) => doc.body.classes.add(c));
  const relogio = new Map(); let seq = 0;
  const ouvintes = {};
  const quem = { pessoa, logado };
  const c = vm.createContext({
    console,
    document: doc,
    innerWidth: 1440, innerHeight: 900,
    localStorage: {
      getItem: (k) => (armazenamento.has(k) ? armazenamento.get(k) : null),
      setItem: (k, v) => armazenamento.set(k, String(v)),
      removeItem: (k) => armazenamento.delete(k),
    },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false }),
    setTimeout: (f) => { relogio.set(++seq, f); return seq; },
    clearTimeout: (id) => relogio.delete(id),
    setInterval: () => ++seq,
    clearInterval: () => {},
    addEventListener: (t, f) => (ouvintes[t] ||= []).push(f),
    removeEventListener: (t, f) => { ouvintes[t] = (ouvintes[t] || []).filter((x) => x !== f); },
    operadorDoTopo: () => quem.pessoa,
    pessoaLogada: () => quem.logado,
  });
  c.window = c;
  vm.runInContext(CODIGO, c);
  const vivos = () => criados.filter((e) => e.isConnected);
  const achar = (fn) => vivos().find(fn);
  return {
    T: c.VybeTutorial, doc, quem, armazenamento,
    rodar() { for (let n = 0; n < 100 && relogio.size; n++) { const [id, f] = relogio.entries().next().value; relogio.delete(id); f(); } },
    tecla(key) {
      const ev = { key, target: doc.activeElement || doc.body, defaultPrevented: false, parou: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.parou = true; }, stopImmediatePropagation() { this.parou = true; } };
      for (const f of [...(ouvintes.keydown || [])]) f(ev);
      return ev;
    },
    ouvindoTeclado: () => (ouvintes.keydown || []).length,
    botao: (nome) => achar((e) => e.getAttribute('data-tour') === nome),
    classe: (cls) => achar((e) => e.classes.has(cls)),
    balao: () => achar((e) => e.classes.has('vv-tour-balao')),
    titulo: () => achar((e) => e.classes.has('vv-tour-titulo'))?.textContent,
    conta: () => achar((e) => e.classes.has('vv-tour-conta'))?.textContent,
    achar, vivos,
  };
}
// As dicas só começam depois do passeio de boas-vindas: os testes de dica partem dele já visto.
const passeioVisto = (id = '42') => new Map([['vybe.tour.' + id, JSON.stringify({ v: 1, passeios: { 'boas-vindas': '2026-11-07T12:00:00Z' }, dicas: {}, semDicas: false })]]);
const salvo = (t, id = '42') => JSON.parse(t.armazenamento.get('vybe.tour.' + id) || 'null');

test('o passeio abre na primeira vez, chama pelo primeiro nome e é um dialog acessível', () => {
  const t = montar();
  assert.equal(t.T.iniciar(), true);
  const b = t.balao();
  assert.equal(b.getAttribute('role'), 'dialog');
  assert.equal(b.getAttribute('aria-modal'), 'true');
  assert.ok(t.achar((e) => e.getAttribute('aria-live') === 'polite').textContent.startsWith('Passo 1 de 9.'));
  assert.match(t.classe('vv-tour-texto').textContent, /^Oi, Tainara\. Eu sou o VYBES/);
  assert.equal(t.conta(), '1 de 9');
  assert.equal(t.botao('voltar').hidden, true, 'no primeiro passo não há para onde voltar');
  assert.equal(t.doc.activeElement, t.botao('proximo'), 'o foco vai para o balão');
  assert.equal(t.T.iniciar(), false, 'com o passeio aberto, não abre outro');
});

test('iniciar pula o alvo que não existe ou está escondido e marca como visto no fim', () => {
  const t = montar();
  t.T.iniciar();
  const vistos = [t.titulo()];
  for (let n = 0; n < 20 && t.balao(); n++) { t.botao('proximo').click(); if (t.balao()) vistos.push(t.titulo()); }
  assert.ok(!vistos.includes('Barra de voz'), 'a barra de voz escondida não vira passo');
  assert.deepEqual(vistos, ['Boas-vindas ao Vybe OS', 'Seu dia', 'O dock', 'Criar', 'Ferramentas', 'Cidade, Prédio e Cérebro', 'O Centro', 'Fale comigo', 'Pronto']);
  assert.equal(t.balao(), undefined, 'Concluir fecha');
  assert.ok(salvo(t).passeios['boas-vindas'], 'guardado em vybe.tour.<id>');
  assert.equal(t.ouvindoTeclado(), 0, 'fechado, não escuta mais o teclado');
  assert.equal(t.T.iniciar(), false, 'na segunda vez não aparece');
  assert.equal(t.T.iniciar({ forcar: true }), true, 'forcar refaz');
});

test('o último passo vira Concluir, sem Pular; o contador acompanha', () => {
  const t = montar();
  t.T.iniciar();
  for (let n = 0; n < 8; n++) t.botao('proximo').click();
  assert.equal(t.conta(), '9 de 9');
  assert.equal(t.botao('proximo').textContent, 'Concluir');
  assert.equal(t.botao('pular').hidden, true);
  assert.match(t.classe('vv-tour-texto').textContent, /^Pronto, Tainara\./);
});

test('Próximo, Voltar, setas e Esc navegam; o Esc não vaza para o mapa', () => {
  const t = montar();
  t.T.iniciar();
  t.tecla('ArrowRight');
  assert.equal(t.titulo(), 'Seu dia');
  t.botao('proximo').click();
  assert.equal(t.titulo(), 'O dock');
  t.botao('voltar').click();
  assert.equal(t.titulo(), 'Seu dia');
  const ev = t.tecla('ArrowLeft');
  assert.equal(t.titulo(), 'Boas-vindas ao Vybe OS');
  assert.ok(ev.defaultPrevented && ev.parou);
  t.tecla('ArrowLeft');
  assert.equal(t.titulo(), 'Boas-vindas ao Vybe OS', 'no primeiro passo a seta para trás não faz nada');
  const esc = t.tecla('Escape');
  assert.ok(esc.defaultPrevented && esc.parou, 'o Esc é do passeio, não fecha o módulo nem a vista');
  assert.equal(t.balao(), undefined);
  assert.ok(salvo(t).passeios['boas-vindas'], 'Esc (pular) também marca como visto');
});

test('Pular fecha e marca; sem pessoa no topo, a chave é anon', () => {
  const t = montar({ pessoa: null });
  t.T.iniciar();
  assert.match(t.classe('vv-tour-texto').textContent, /^Oi\. Eu sou o VYBES/, 'sem nome, sem vírgula sobrando');
  t.botao('pular').click();
  assert.equal(t.balao(), undefined);
  assert.ok(salvo(t, 'anon').passeios['boas-vindas']);
});

test('logado mas sem a equipe carregada: espera a pessoa antes de decidir', () => {
  const t = montar({ pessoa: null, logado: { nome: 'Paulo' } });
  assert.equal(t.T.iniciar(), false);
  assert.equal(t.balao(), undefined);
  t.quem.pessoa = { id: 7, name: 'Paulo' };
  t.rodar();
  assert.ok(t.balao(), 'abriu quando a pessoa apareceu');
  t.botao('pular').click();
  assert.ok(salvo(t, '7').passeios['boas-vindas']);
  assert.equal(t.armazenamento.has('vybe.tour.anon'), false);
});

test('não abre antes do login', () => {
  const t = montar({ corpo: ['auth-pending'] });
  assert.equal(t.T.iniciar(), false);
  assert.equal(t.balao(), undefined);
});

test('o recorte envolve o alvo e o balão fica ao lado, dentro da tela', () => {
  const t = montar();
  t.T.iniciar();
  t.botao('proximo').click(); t.botao('proximo').click(); // o dock
  const luz = t.classe('vv-tour-luz');
  assert.deepEqual([luz.style.left, luz.style.top, luz.style.width, luz.style.height], ['6px', '112px', '92px', '576px']);
  const b = t.balao();
  assert.equal(b.getAttribute('data-lado'), 'direita');
  assert.equal(b.style.left, '112px');
  assert.equal(b.style.top, '305px');
  t.botao('proximo').click(); t.botao('proximo').click(); // ferramentas, no topo: balão embaixo
  assert.equal(b.getAttribute('data-lado'), 'baixo');
  assert.ok(parseInt(b.style.left, 10) + 320 <= 1440 - 12);
  t.botao('proximo').click(); t.botao('proximo').click(); t.botao('proximo').click(); t.botao('proximo').click(); // fim: sem alvo
  assert.equal(b.getAttribute('data-lado'), 'centro');
  assert.ok(luz.classes.has('vazia'));
});

test('dica só na primeira vez; Entendi marca, forcar mostra sempre', () => {
  const t = montar({ armazenamento: passeioVisto() });
  assert.equal(t.T.dica('trilho:tarefas'), true);
  assert.equal(t.balao(), undefined, 'espera o módulo terminar de abrir');
  t.rodar();
  assert.equal(t.titulo(), 'Minhas tarefas');
  assert.equal(t.balao().getAttribute('aria-modal'), 'false', 'a dica não trava a tela');
  assert.ok(t.classe('vv-tour-anel'), 'anel em volta do botão do dock');
  t.botao('entendi').click();
  assert.equal(t.balao(), undefined);
  assert.ok(salvo(t).dicas['trilho:tarefas']);
  assert.equal(t.T.dica('trilho:tarefas'), false);
  t.rodar();
  assert.equal(t.balao(), undefined);
  assert.equal(t.T.dica('trilho:tarefas', { forcar: true }), true);
  t.rodar();
  assert.equal(t.titulo(), 'Minhas tarefas');
  assert.equal(t.T.dica('nao-existe'), false);
});

test('Ver de novo depois não marca: volta na próxima abertura do painel', () => {
  const armazenamento = passeioVisto();
  const t = montar({ armazenamento });
  t.T.dica('modulo'); t.rodar();
  assert.equal(t.titulo(), 'Tela de trabalho', 'sem o canto do módulo na tela, a dica vem no centro');
  t.botao('depois').click();
  assert.equal(t.balao(), undefined);
  assert.equal(t.T.dica('modulo'), false, 'nesta abertura, não insiste');
  assert.equal(salvo(t)?.dicas?.modulo, undefined);
  const outra = montar({ armazenamento });
  assert.equal(outra.T.dica('modulo'), true, 'recarregou a página: mostra de novo');
});

test('Esc fecha a dica como vista e não chega ao módulo', () => {
  const t = montar({ armazenamento: passeioVisto() });
  t.T.dica('trilho:tarefas'); t.rodar();
  const ev = t.tecla('Escape');
  assert.ok(ev.parou);
  assert.equal(t.balao(), undefined);
  assert.ok(salvo(t).dicas['trilho:tarefas']);
});

test('duas dicas pedidas juntas: a segunda espera a vez, nenhuma some', () => {
  const t = montar({ armazenamento: passeioVisto() });
  assert.equal(t.T.dica('trilho:tarefas'), true);
  assert.equal(t.T.dica('modulo'), true, 'o módulo abriu junto com o clique no dock');
  assert.equal(t.T.dica('modulo'), true, 'pedir de novo não duplica');
  t.rodar();
  assert.equal(t.titulo(), 'Minhas tarefas');
  assert.equal(t.vivos().filter((e) => e.classes.has('vv-tour-balao')).length, 1, 'uma de cada vez');
  t.botao('entendi').click();
  t.rodar();
  assert.equal(t.titulo(), 'Tela de trabalho');
  t.botao('entendi').click();
  t.rodar();
  assert.equal(t.balao(), undefined);
  assert.ok(salvo(t).dicas.modulo && salvo(t).dicas['trilho:tarefas']);
});

test('o passo da barra de voz conta como a dica dela', () => {
  const alvos = HUD(); alvos['.vv-chamada'][0].hidden = false;
  const t = montar({ alvos });
  t.T.iniciar();
  for (let n = 0; n < 7; n++) t.botao('proximo').click();
  assert.equal(t.titulo(), 'Barra de voz');
  assert.equal(t.conta(), '8 de 10');
  t.tecla('Escape');
  assert.ok(salvo(t).dicas.chamada, 'o passo marcou a dica');
  assert.equal(t.T.dica('chamada'), false, 'o passeio já explicou');
});

test('antes do passeio de boas-vindas, nenhuma dica (nem ao abrir algo junto com o login)', () => {
  const t = montar();
  assert.equal(t.T.dica('chamada'), false);
  t.rodar();
  assert.equal(t.balao(), undefined);
  assert.equal(t.T.dica('modulo', { forcar: true }), true, 'pela Ajuda dá para ver qualquer uma');
  t.rodar();
  assert.equal(t.titulo(), 'Tela de trabalho');
  t.botao('entendi').click();
  t.T.iniciar(); t.tecla('Escape');
  assert.equal(t.T.dica('trilho:jogos'), true, 'passeio fechado: as dicas começam');
});

test('dica não aparece durante o passeio', () => {
  const t = montar();
  t.T.iniciar();
  assert.equal(t.T.dica('trilho:tarefas'), false);
  t.rodar();
  assert.equal(t.balao().getAttribute('aria-modal'), 'true', 'continua só o balão do passeio');
});

test('desligarDicas e o botão Não mostrar mais dicas', () => {
  const t = montar({ armazenamento: passeioVisto() });
  assert.equal(t.T.desligarDicas(true), true);
  assert.equal(t.T.dica('trilho:tarefas'), false);
  assert.equal(t.T.dica('trilho:tarefas', { forcar: true }), true, 'pela Ajuda ainda dá para rever');
  t.rodar(); t.botao('entendi').click();
  assert.equal(t.T.desligarDicas(false), false);
  assert.equal(t.T.dica('trilho:gestor'), true);
  t.rodar();
  t.botao('sem-dicas').click();
  assert.equal(t.balao(), undefined);
  assert.equal(salvo(t).semDicas, true);
  assert.equal(t.T.dica('trilho:clientes'), false);
});

test('reset esquece passeio, dicas e o "não mostrar"', () => {
  const t = montar();
  t.T.iniciar(); t.botao('pular').click();
  t.T.dica('trilho:tarefas'); t.rodar(); t.botao('entendi').click();
  t.T.desligarDicas(true);
  assert.ok(t.armazenamento.has('vybe.tour.42'));
  assert.equal(t.T.reset(), true);
  assert.equal(t.armazenamento.has('vybe.tour.42'), false);
  assert.equal(t.T.dica('trilho:tarefas'), false, 'zerado, o passeio vem antes das dicas');
  assert.equal(t.T.iniciar(), true);
  t.botao('pular').click();
  assert.equal(t.T.dica('trilho:tarefas'), true);
});

test('Ajuda lista passeios e dicas, refaz o passeio e revê uma dica', () => {
  const t = montar();
  t.T.iniciar(); t.botao('pular').click();
  t.T.dica('trilho:tarefas'); t.rodar(); t.botao('entendi').click();
  assert.equal(t.T.ajuda(), true);
  const janela = t.classe('vv-tour-janela');
  assert.equal(janela.getAttribute('role'), 'dialog');
  assert.equal(t.doc.activeElement, janela);
  const linhaDica = (id) => t.achar((e) => e.getAttribute('data-tour-dica') === id);
  assert.ok(linhaDica('trilho:tarefas').textContent.endsWith('Vista'));
  assert.ok(linhaDica('trilho:jogos').textContent.endsWith('Nova'));
  assert.equal(linhaDica('trilho:gestao'), undefined, 'Gestão só aparece para os sócios');
  linhaDica('trilho:tarefas').click();
  assert.equal(t.classe('vv-tour-janela'), undefined, 'a ajuda fecha');
  t.rodar();
  assert.equal(t.titulo(), 'Minhas tarefas', 'e a dica volta mesmo já vista');
  t.botao('entendi').click();
  t.T.ajuda();
  t.botao('refazer').click();
  assert.equal(t.titulo(), 'Boas-vindas ao Vybe OS', 'Refazer o passeio abre do começo');
  t.tecla('Escape');
  t.T.ajuda();
  const chave = t.botao('chave-dicas');
  assert.equal(chave.checked, true);
  chave.checked = false; chave.disparar('change');
  assert.equal(salvo(t).semDicas, true);
  t.tecla('Escape');
  assert.equal(t.classe('vv-tour-janela'), undefined, 'Esc fecha a ajuda');
});

test('para os sócios a Ajuda mostra a Gestão e o passo 2 fala da Agência', () => {
  const alvos = { ...HUD(), '#vv-hoje .vv-seg': [alvo(120, 30, 200, 32)] };
  const t = montar({ alvos, corpo: ['eh-dono'] });
  t.T.ajuda();
  assert.ok(t.achar((e) => e.getAttribute('data-tour-dica') === 'trilho:gestao'));
  t.botao('fechar-ajuda').click();
  t.T.iniciar(); t.botao('proximo').click();
  assert.equal(t.titulo(), 'Seu painel');
  assert.match(t.classe('vv-tour-texto').textContent, /Agência/);
});

test('conteúdo: todos os passos e dicas pedidos, curtos (1 ou 2 frases) e sem emoji', () => {
  const { T } = montar();
  const C = T.CONTEUDO;
  const passos = C.passeios['boas-vindas'].passos;
  assert.equal(passos.length, 10);
  assert.deepEqual(JSON.parse(JSON.stringify(passos.map((p) => p.alvo))), [null, '#vv-hoje', '.vv-trilho', '.vv-trilho-btn[data-trilho="criar"]', '.vv-barra-topo .vv-ferramentas',
    '.vv-barra-topo .vv-vistas', '[data-trilho="centro"]', '.vv-chamada', '.vv-trilho-btn[data-trilho="vybes"]', null]);
  const pedidas = ['trilho:gestao', 'trilho:tarefas', 'trilho:gestor', 'trilho:direcao', 'trilho:agenda', 'trilho:clientes', 'trilho:equipe', 'trilho:jogos',
    'trilho:predio', 'trilho:perfil', 'trilho:vybes', 'vista:predio', 'ferr:camadas', 'ferr:aparencia', 'ferr:conta', 'chamada', 'andar',
    'cliente', 'cerebro-cliente', 'modulo'];
  for (const id of pedidas) assert.ok(C.dicas[id], `faltou a dica ${id}`);
  // O "?" solto ("aperte o ? no topo") é o botão, não fim de frase.
  const frases = (t) => t.split(/(?<=\S)[.!?]+(?=\s|$)/).map((x) => x.trim()).filter(Boolean).length;
  const textos = [...passos.flatMap((p) => [p, ...(p.variantes || [])]), ...Object.values(C.dicas)];
  for (const x of textos) {
    assert.ok(x.titulo && x.texto, `faltou título ou texto: ${JSON.stringify(x)}`);
    assert.ok(frases(x.texto) <= 2, `mais de duas frases: ${x.texto}`);
    assert.doesNotMatch(x.texto + x.titulo, /\p{Extended_Pictographic}/u, `emoji: ${x.texto}`);
    assert.ok(C.grupos.includes(x.grupo) || !('grupo' in x));
  }
});

test('os donos da Vybe são tratados por "senhor" (mesma personalidade do VYBES)', () => {
  const t = montar({ pessoa: { id: 1, name: 'Paulo Henrique' } });
  assert.equal(t.T.iniciar(), true);
  assert.match(t.classe('vv-tour-texto').textContent, /^Oi, senhor\. Eu sou o VYBES/);
});
