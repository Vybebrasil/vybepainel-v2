// Conversa da equipe e recados no Irecity (vybe-mundo-conversa.js).
// SAFE: DOM, Escritório, API e socket falsos em memória; nada de rede, banco ou envio real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const FONTE = fs.readFileSync('vybe-mundo-conversa.js', 'utf8');
const esperar = async (n = 4) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const simples = (v) => JSON.parse(JSON.stringify(v ?? null));

// DOM mínimo: só o que o painel usa (criar, anexar, atributos, ouvintes, foco, formulário).
class Elemento {
  constructor(tag, doc) {
    Object.assign(this, { tagName: tag.toUpperCase(), doc, children: [], parentNode: null, atributos: {}, ouvintes: {}, dataset: {},
      hidden: false, value: '', disabled: false, className: '', textContent: '', scrollTop: 0, scrollHeight: 400, clientHeight: 200, _html: '' });
    const classes = new Set();
    this.classList = { add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)), contains: (c) => classes.has(c), toggle: (c, s) => ((s ?? !classes.has(c)) ? classes.add(c) : classes.delete(c)) };
  }
  setAttribute(k, v) { this.atributos[k] = String(v); if (['name', 'type', 'placeholder', 'id'].includes(k)) this[k] = String(v); }
  getAttribute(k) { return this.atributos[k] ?? null; }
  removeAttribute(k) { delete this.atributos[k]; }
  append(...nos) { for (const n of nos) { n.parentNode?.removeChild(n); n.parentNode = this; this.children.push(n); } }
  removeChild(n) { this.children = this.children.filter((c) => c !== n); n.parentNode = null; }
  remove() { this.parentNode?.removeChild(this); }
  set innerHTML(v) { this._html = String(v); for (const c of this.children) c.parentNode = null; this.children = []; }
  get innerHTML() { return this._html; }
  addEventListener(tipo, f) { (this.ouvintes[tipo] ||= []).push(f); }
  removeEventListener(tipo, f) { this.ouvintes[tipo] = (this.ouvintes[tipo] || []).filter((x) => x !== f); }
  disparar(tipo, ev = {}) { const e = { preventDefault() {}, stopPropagation() {}, target: this, ...ev }; for (const f of this.ouvintes[tipo] || []) f(e); return e; }
  focus() { this.doc.activeElement = this; }
  todos() { return this.children.flatMap((c) => [c, ...c.todos()]); }
  get elements() { return Object.fromEntries(this.todos().filter((c) => c.name).map((c) => [c.name, c])); }
  querySelector(sel) { return sel === 'button' ? this.todos().find((c) => c.tagName === 'BUTTON') || null : null; }
  texto() { return [this._html, this.textContent, ...this.children.map((c) => c.texto())].join(' '); }
}

const BASE = { eu: '1', equipe: [{ id: '1', nome: 'Paulo Silva' }, { id: '2', nome: 'Bia Souza' }, { id: '3', nome: 'Deivid Alves' }] };
const MENSAGENS = [
  { id: '10', pessoa_id: '2', nome: 'Bia Souza', texto: 'Bom dia, equipe', criado_em: '2026-11-07T11:00:00.000Z' },
  { id: '11', pessoa_id: '1', nome: 'Paulo Silva', texto: 'Bom dia!', criado_em: '2026-11-07T11:01:00.000Z' },
  { id: '12', pessoa_id: '3', nome: 'Deivid Alves', texto: '<img src=x onerror=alert(1)>', criado_em: '2026-11-07T11:02:00.000Z' },
];

function preparar({ base = BASE, classes = [] } = {}) {
  const doc = { activeElement: null, readyState: 'complete', ids: {}, addEventListener() {} };
  doc.createElement = (tag) => new Elemento(tag, doc);
  doc.getElementById = (id) => doc.ids[id] || null;
  doc.body = new Elemento('body', doc);
  for (const c of classes) doc.body.classList.add(c);
  const ch = { api: [], enviar: [], emitir: [], resumo: 0, abrirEscritorio: 0, recadosAntigo: [], abaAntiga: [] };
  const timers = [];
  const ctx = {
    document: doc, console,
    setInterval: (f) => { timers.push(f); return timers.length; }, clearInterval() {},
    crypto: { randomUUID: () => '0b0e0c0a-0000-4000-8000-000000000001' },
    ESCRITORIO_SALAS: { convivencia: 'Convivência', criacao: 'Criação' },
    escritorio: { base, sala: 'criacao', socket: null, recadosResumo: { 2: 1 } },
    escritorioApi: async (acao, corpo, consulta) => {
      ch.api.push([acao, simples(corpo), simples(consulta)]);
      if (acao === 'mensagens') return { ok: true, mensagens: MENSAGENS };
      if (acao === 'recados') return { ok: true, recados: [
        { id: '1', de: '2', para: '1', texto: 'Paulo, a arte saiu?', criado_em: '2026-11-07T10:00:00.000Z', lido_em: null },
        { id: '2', de: '1', para: '2', texto: 'Saiu sim', criado_em: '2026-11-07T10:05:00.000Z', lido_em: '2026-11-07T10:06:00.000Z' },
      ] };
      return { ok: true };
    },
    // A função de envio do Escritório: limpa o campo quando dá certo, como a de verdade.
    enviarChatEscritorio: async (form) => { ch.enviar.push(form.elements.texto.value); form.elements.texto.value = ''; },
    escritorioEmitir: (tipo, payload) => ch.emitir.push([tipo, simples(payload)]),
    carregarResumoRecados: async () => { ch.resumo++; },
    abrirEscritorio: () => { ch.abrirEscritorio++; },
    abrirRecadosEscritorio: (id) => { ch.recadosAntigo.push(id); },
    alternarAbaEscritorio: (aba) => { ch.abaAntiga.push(aba); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(FONTE, ctx);
  const raiz = () => doc.body.children.find((c) => c.className === 'vv-conversa');
  const achar = (tag) => raiz().todos().find((c) => c.tagName === tag);
  return { ctx, doc, ch, timers, raiz, achar, vigiar: () => timers.at(-1)() };
}

test('abre no body (fora do painel do Escritório), fecha no X e no Esc', async () => {
  const t = preparar();
  const C = t.ctx.VybeConversa;
  assert.equal(C.aberto(), false);
  C.abrir();
  assert.equal(C.aberto(), true);
  assert.ok(t.raiz(), 'o painel vai direto no body');
  assert.equal(t.raiz().hidden, false);
  assert.equal(t.raiz().getAttribute('role'), 'dialog');
  C.fechar();
  assert.equal(C.aberto(), false);
  assert.equal(t.raiz().hidden, true);
  C.abrir('recados');
  t.raiz().disparar('keydown', { key: 'Escape' });
  assert.equal(C.aberto(), false, 'Esc fecha');
  C.abrir();
  t.raiz().todos().find((c) => c.className === 'vv-conversa-x').disparar('click');
  assert.equal(C.aberto(), false, 'o X fecha');
  await esperar();
});

test('desenha as mensagens da sala do Escritório: as minhas à direita e o texto escapado', async () => {
  const t = preparar();
  t.ctx.VybeConversa.abrir('conversa');
  await esperar();
  assert.deepEqual(t.ch.api[0], ['mensagens', null, { sala: 'criacao' }], 'mesma leitura de carregarChatEscritorio');
  const html = t.raiz().texto();
  assert.match(html, /Conversa · Criação/);
  assert.match(html, /<b>Bia Souza<\/b><p>Bom dia, equipe<\/p>/);
  assert.match(html, /class="vv-conversa-msg meu"><b>Você<\/b><p>Bom dia!<\/p>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.equal(t.achar('INPUT').name, 'texto');
  assert.equal(t.achar('INPUT').placeholder, 'Mensagem para Criação');
});

test('enviar usa a função de envio do Escritório com o texto e relê a conversa', async () => {
  const t = preparar();
  t.ctx.VybeConversa.abrir('conversa');
  await esperar();
  const form = t.achar('FORM'), campo = t.achar('INPUT');
  assert.equal(form.querySelector('button').textContent, 'Enviar', 'o primeiro botão do formulário é o de enviar');
  campo.value = 'Oi, time';
  form.disparar('submit');
  await esperar();
  assert.deepEqual(t.ch.enviar, ['Oi, time']);
  assert.equal(t.ch.api.filter(([a]) => a === 'mensagens').length, 2, 'releu as mensagens depois de enviar');
  // Falhou (a função do Escritório não limpou o campo): mostra o aviso dela.
  t.ctx.enviarChatEscritorio = async () => {};
  t.doc.ids['office-feedback'] = { textContent: 'Sala inválida.' };
  campo.value = 'De novo';
  form.disparar('submit');
  await esperar();
  const erro = t.raiz().todos().find((c) => c.className === 'vv-conversa-erro');
  assert.equal(erro.hidden, false);
  assert.equal(erro.textContent, 'Sala inválida.');
});

test('sem escritorio.base: estado vazio com Entrar no Escritório, que chama abrirEscritorio', async () => {
  const t = preparar({ base: null });
  t.ctx.VybeConversa.abrir();
  await esperar();
  assert.match(t.raiz().texto(), /Você ainda não está no Escritório/);
  assert.match(t.raiz().texto(), /data-vc="entrar">Entrar no Escritório</);
  assert.equal(t.ch.api.length, 0, 'sem base, nada é pedido à API');
  t.raiz().disparar('click', { target: { closest: () => ({ dataset: { vc: 'entrar' } }) } });
  assert.equal(t.ch.abrirEscritorio, 1);
  assert.match(t.raiz().texto(), /Entrando no Escritório…/);
  // A entrada terminou: a vigia vê a base e desenha a conversa.
  t.ctx.escritorio.base = BASE;
  t.vigiar();
  await esperar();
  assert.match(t.raiz().texto(), /Bom dia, equipe/);
});

test('atualiza sozinho pelo mesmo socket (chat:changed) e solta o socket ao fechar', async () => {
  const ouvintes = new Set();
  const socket = { readyState: 1, addEventListener: (t, f) => ouvintes.add(f), removeEventListener: (t, f) => ouvintes.delete(f) };
  const t = preparar();
  t.ctx.escritorio.socket = socket;
  t.ctx.VybeConversa.abrir();
  await esperar();
  assert.equal(ouvintes.size, 1, 'ouve o socket sem trocar o onmessage do Escritório');
  const lidas = () => t.ch.api.filter(([a]) => a === 'mensagens').length;
  const antes = lidas();
  for (const f of ouvintes) f({ data: JSON.stringify({ type: 'chat:changed', payload: { sala: 'criacao' } }) });
  for (const f of ouvintes) f({ data: JSON.stringify({ type: 'chat:changed', payload: { sala: 'producao' } }) });
  await esperar();
  assert.equal(lidas(), antes + 1, 'relê só a conversa da sala em que a pessoa está');
  // Mudou de ala no prédio: a vigia troca de chat.
  t.ctx.escritorio.sala = 'convivencia';
  t.vigiar();
  await esperar();
  assert.deepEqual(t.ch.api.at(-1), ['mensagens', null, { sala: 'convivencia' }]);
  t.ctx.VybeConversa.fechar();
  assert.equal(ouvintes.size, 0);
});

test('recados: abre direto na pessoa, marca como lido e envia pelas rotas do Escritório', async () => {
  const t = preparar();
  t.ctx.VybeConversa.abrir('recados', '2');
  await esperar();
  assert.deepEqual(t.ch.api[0], ['recados', null, { com: '2' }]);
  assert.deepEqual(t.ch.api[1], ['recados-lidos', { com: '2' }, null]);
  assert.ok(t.ch.resumo >= 1, 'relê o resumo de não lidos com carregarResumoRecados');
  const html = t.raiz().texto();
  assert.match(html, /<h3>Bia Souza<\/h3>/);
  assert.match(html, /Paulo, a arte saiu\?/);
  assert.match(html, /· lido<\/time>/);
  const form = t.achar('FORM'), campo = t.achar('INPUT');
  assert.equal(campo.placeholder, 'Recado para Bia');
  campo.value = 'Combinado';
  form.disparar('submit');
  await esperar();
  const envio = t.ch.api.find(([a]) => a === 'recado');
  assert.deepEqual(envio, ['recado', { para: '2', texto: 'Combinado', chave: '0b0e0c0a-0000-4000-8000-000000000001' }, null]);
  assert.deepEqual(t.ch.emitir, [['recado:novo', { para: '2' }]]);
  assert.equal(campo.value, '');
});

test('recados: lista da equipe sem a própria pessoa, com não lidos primeiro', async () => {
  const t = preparar();
  t.ctx.VybeConversa.abrir('recados');
  await esperar();
  const html = t.raiz().texto();
  assert.ok(html.indexOf('Bia Souza') < html.indexOf('Deivid Alves'), 'quem tem recado não lido vem antes');
  assert.doesNotMatch(html, /data-valor="1"/);
  assert.match(html, /data-vc="pessoa" data-valor="2"/);
  t.raiz().disparar('click', { target: { closest: () => ({ dataset: { vc: 'pessoa', valor: '3' } }) } });
  await esperar();
  assert.deepEqual(t.ch.api.find(([a]) => a === 'recados'), ['recados', null, { com: '3' }]);
});

test('no Irecity, a aba Conversa e os Recados do Escritório abrem este painel; fora dele, o antigo', async () => {
  const fora = preparar();
  fora.ctx.abrirRecadosEscritorio('2');
  fora.ctx.alternarAbaEscritorio('conversa', true);
  assert.deepEqual(fora.ch.recadosAntigo, ['2']);
  assert.deepEqual(fora.ch.abaAntiga, ['conversa']);
  assert.equal(fora.ctx.VybeConversa.aberto(), false);

  const dentro = preparar({ classes: ['mundo'] });
  dentro.ctx.abrirRecadosEscritorio('2'); // "Deixar recado" da ficha
  await esperar();
  assert.equal(dentro.ctx.VybeConversa.aberto(), true);
  assert.deepEqual(dentro.ch.recadosAntigo, []);
  assert.match(dentro.raiz().texto(), /<h3>Bia Souza<\/h3>/);
  dentro.ctx.alternarAbaEscritorio('pessoas');
  assert.deepEqual(dentro.ch.abaAntiga, ['pessoas'], 'as outras abas seguem com o Escritório');
  dentro.ctx.alternarAbaEscritorio('conversa', true);
  await esperar();
  assert.match(dentro.raiz().texto(), /Conversa · Criação/);
});
