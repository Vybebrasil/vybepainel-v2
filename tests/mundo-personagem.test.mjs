// Criador de personagem do Irecity (vybe-mundo-personagem.js).
// SAFE: DOM, API do Escritório e pacote do mundo falsos em memória; nada de rede, banco, WebGL ou envio
// real. As funções do criador do Escritório são as de verdade (vybe-escritorio-abertura.js), com o
// catálogo de peças real (figuras.json) e as peças grátis reais da migração das skins.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { lerFigura } from '../mundo/avatar.mjs';

const FONTE = fs.readFileSync('vybe-mundo-personagem.js', 'utf8');
const ABERTURA = fs.readFileSync('vybe-escritorio-abertura.js', 'utf8');
const CATALOGO = JSON.parse(fs.readFileSync('assets/escritorio/habbo/figuras.json', 'utf8'));
const SKINS = fs.readFileSync('migrations/2026-10-21-escritorio-skins.sql', 'utf8');
const GRATIS = [...SKINS.slice(0, SKINS.indexOf('-- raras')).matchAll(/'(roupa:[a-z]{2}-\d+)'/g)].map((m) => m[1]);
const ROUPAS = { ativo: true, faixas: { comum: { nome: 'Comum', preco: 25 } }, pecas: Object.fromEntries(GRATIS.map((c) => [c, ['comum', 0]])), meus: [], donos: {} };
// O formato que o servidor aceita (perfilEscritorio, server/escritorio.js).
const FIGURA_SERVIDOR = /^[a-z]{2}-\d{1,5}(-\d{1,5}){0,2}(\.[a-z]{2}-\d{1,5}(-\d{1,5}){0,2}){0,15}$/;
const FIG = 'hd-180-1.hr-828-61.ch-255-1408.lg-280-110.sh-305-62';
const esperar = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const paleta = (t, campo) => [...new Set(Array.from({ length: 240 }, (_, i) => lerFigura(`${t}-0-${i}`)[campo]))];
const partes = (fig) => Object.fromEntries(fig.split('.').map((p) => { const [t, id, ...cores] = p.split('-'); return [t, { id: Number(id), cores: cores.map(Number) }]; }));
const livre = (t, id) => GRATIS.includes(`roupa:${t}-${id}`) || FIG.split('.').some((p) => p.startsWith(`${t}-${id}-`));
const serveM = (t, id) => { const s = CATALOGO.tipos[t].s.find((x) => x[0] === id); return Boolean(s) && (s[1] === 'U' || s[1] === 'M'); };

// DOM mínimo: criar, anexar, atributos, ouvintes, foco e busca por id (o Escritório escreve o erro em #abr-erro).
class Elemento {
  constructor(tag, doc) {
    Object.assign(this, { tagName: tag.toUpperCase(), doc, children: [], parentNode: null, atributos: {}, ouvintes: {}, dataset: {}, hidden: false, textContent: '', className: '', src: '', _html: '' });
    const classes = new Set();
    this.classList = { add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)), contains: (c) => classes.has(c), toggle: (c, s) => ((s ?? !classes.has(c)) ? classes.add(c) : classes.delete(c)) };
  }
  get id() { return this.atributos.id || ''; }
  set id(v) { this.atributos.id = String(v); }
  setAttribute(k, v) { this.atributos[k] = String(v); if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v); }
  getAttribute(k) { return this.atributos[k] ?? null; }
  removeAttribute(k) { delete this.atributos[k]; }
  append(...nos) { for (const n of nos) { n.parentNode?.removeChild(n); n.parentNode = this; this.children.push(n); } }
  removeChild(n) { this.children = this.children.filter((c) => c !== n); n.parentNode = null; }
  remove() { this.parentNode?.removeChild(this); }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  get isConnected() { return this.doc.body.contains(this); }
  set innerHTML(v) { this._html = String(v); for (const c of this.children) c.parentNode = null; this.children = []; }
  get innerHTML() { return this._html; }
  addEventListener(tipo, f) { (this.ouvintes[tipo] ||= []).push(f); }
  removeEventListener(tipo, f) { this.ouvintes[tipo] = (this.ouvintes[tipo] || []).filter((x) => x !== f); }
  disparar(tipo, ev = {}) { const e = { target: this, ...ev }; e.preventDefault = () => { e.prevenido = true; }; e.stopPropagation = () => {}; for (const f of this.ouvintes[tipo] || []) f(e); return e; }
  focus() { this.doc.activeElement = this; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getClientRects() { return []; }
  todos() { return this.children.flatMap((c) => [c, ...c.todos()]); }
}

function preparar({ comBase = true, roupas = ROUPAS, gravar = null, modulo = null, corpo = [] } = {}) {
  const doc = { activeElement: null, readyState: 'complete', ouvintes: {} };
  doc.createElement = (tag) => new Elemento(tag, doc);
  doc.body = new Elemento('body', doc);
  for (const c of corpo) doc.body.classList.add(c);
  doc.getElementById = (id) => doc.body.todos().find((n) => n.id === id) || null;
  doc.querySelector = () => null;
  doc.querySelectorAll = () => [];
  doc.addEventListener = (tipo, f) => { (doc.ouvintes[tipo] ||= []).push(f); };
  doc.removeEventListener = (tipo, f) => { doc.ouvintes[tipo] = (doc.ouvintes[tipo] || []).filter((x) => x !== f); };
  const ch = { api: [], toast: [], boneco: [], entrar: 0, antigo: 0, vigias: [], previa: [] };
  const perfil = { figura: FIG, mao: 'crr=6', roupa: 'laranja' };
  const novaBase = () => ({ eu: '1', equipe: [{ id: '1', nome: 'Paulo Silva', perfil: { ...perfil } }], economia: { disponivel: true, saldo: 120 } });
  const escritorio = { base: comBase ? novaBase() : null, perfil: { ...perfil }, conectado: false };
  const ctx = {
    document: doc, console, setTimeout, clearTimeout,
    setInterval: (f) => { ch.vigias.push(f); return ch.vigias.length; }, clearInterval() {},
    fetch: async (url) => { assert.match(String(url), /figuras\.json/); return { ok: true, json: async () => CATALOGO }; },
    mapaArquivo: (nome) => '/api/painel?area=escritorio&acao=arte&nome=' + nome,
    safeText: (v) => String(v ?? ''),
    escritorio,
    // A rota de verdade grava em area=escritorio&acao=perfil; aqui só registra.
    escritorioApi: async (acao, corpo) => {
      ch.api.push([acao, JSON.parse(JSON.stringify(corpo ?? null))]);
      if (acao === 'roupas') return { ok: true, ...roupas };
      if (acao === 'perfil') return gravar ? gravar(corpo) : { ok: true, perfil: corpo.perfil };
      throw new Error('rota inesperada: ' + acao);
    },
    escritorioMinhaMesa: () => null, escritorioAplicarSalas() {}, renderEscritorio() {},
    mapaGuardarBoneco: (f) => ch.boneco.push(f),
    showToast: (m, tipo) => ch.toast.push([m, tipo]),
    abrirEscritorio: () => { ch.entrar++; },
    personalizarEscritorio: () => { ch.antigo++; },
    carregarMundoFalso: async () => ({ lerFigura, avatarVoxel: (fig, o) => `data:image/png;voxel,${fig}|${o.direcao}`, ...(modulo ? modulo(ch) : {}) }),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(ABERTURA, ctx, { filename: 'vybe-escritorio-abertura.js' });
  assert.ok(FONTE.includes('import(MUNDO_JS)'), 'o pacote do mundo é carregado por import(MUNDO_JS)');
  vm.runInContext(FONTE.replace('import(MUNDO_JS)', 'carregarMundoFalso()'), ctx, { filename: 'vybe-mundo-personagem.js' });
  const raiz = () => doc.body.children.find((c) => c.className === 'vv-personagem');
  const achar = (classe) => raiz()?.todos().find((n) => String(n.className).split(' ').includes(classe)) || null;
  // Clique delegado: o alvo é o botão desenhado por texto (data-vp, data-campo, data-valor).
  const clicar = (dados) => raiz().disparar('click', { target: { closest: () => ({ dataset: dados, disabled: false }) } });
  const tecla = (key) => { const e = { key, prevenido: false }; e.preventDefault = () => { e.prevenido = true; }; e.stopPropagation = () => {}; for (const f of [...(doc.ouvintes.keydown || [])]) f(e); return e; };
  const figuraDaPrevia = () => { const src = achar('vv-personagem-tela')?.src || ''; return src.split(',')[1]?.split('|')[0] || ''; };
  return { ctx, doc, ch, P: ctx.VybePersonagem, escritorio, novaBase, raiz, achar, clicar, tecla, figuraDaPrevia, lado: () => achar('vv-personagem-lado'), corpo: () => achar('vv-personagem-corpo') };
}

test('abre com a escolha de hoje e o boneco voxel; Salvar grava pela função do Escritório com a figura montada', async () => {
  const t = preparar();
  t.P.abrir();
  assert.equal(t.P.aberto(), true);
  assert.equal(t.raiz().hidden, false);
  await esperar();
  assert.deepEqual(t.ch.api.map(([a]) => a), ['roupas'], 'relê o que a pessoa pode vestir, como o Provador');
  const hoje = lerFigura(FIG);
  assert.match(t.lado().innerHTML, new RegExp(`data-campo="pele" data-valor="${hoje.pele}" aria-pressed="true"`));
  assert.match(t.lado().innerHTML, /role="tab"[^>]*data-valor="acessorios"/);
  assert.equal(t.achar('vv-personagem-tela').tagName, 'IMG', 'sem a prévia viva, a imagem do avatarVoxel');
  assert.equal(t.figuraDaPrevia(), FIG);

  const nova = paleta('ch', 'roupa').find((c) => c !== hoje.roupa);
  t.clicar({ vp: 'aba', valor: 'roupa' });
  t.clicar({ vp: 'cor', campo: 'roupa', valor: nova });
  assert.match(t.lado().innerHTML, new RegExp(`data-campo="roupa" data-valor="${nova}" aria-pressed="true"`));
  assert.equal(lerFigura(t.figuraDaPrevia()).roupa, nova, 'a prévia mostra a camisa nova');
  assert.equal(t.ch.api.filter(([a]) => a === 'perfil').length, 0, 'nada grava antes do Salvar');

  t.clicar({ vp: 'salvar' });
  await esperar();
  const [acao, corpo] = t.ch.api.at(-1);
  assert.equal(acao, 'perfil');
  const fig = corpo.perfil.figura;
  assert.match(fig, FIGURA_SERVIDOR);
  const v = lerFigura(fig);
  assert.deepEqual({ ...v, roupa: hoje.roupa }, hoje, 'só a camisa mudou no boneco');
  assert.equal(v.roupa, nova);
  const p = partes(fig);
  assert.equal(p.ch.id, 255, 'a mesma camisa do Habbo, só outra cor');
  assert.ok(CATALOGO.pal[CATALOGO.tipos.ch.p].some(([id]) => id === p.ch.cores[0]), 'cor do catálogo do Escritório');
  assert.match(fig, /(^|\.)sh-305-62(\.|$)/, 'o sapato fica como estava');
  assert.equal(corpo.perfil.mao, 'crr=6', 'o objeto na mão continua');
  assert.equal(corpo.perfil.abertura, undefined, 'só o personagem: não marca a abertura');
  assert.equal(t.escritorio.perfil.figura, fig);
  assert.equal(t.escritorio.base.equipe[0].perfil.figura, fig);
  assert.deepEqual(t.ch.boneco, [fig], 'a cópia do boneco é a do Escritório');
  assert.deepEqual(t.ch.toast, [['Personagem salvo.', 'ok']]);
  assert.equal(t.P.aberto(), false);
  assert.equal(t.raiz().hidden, true);
});

test('cabelo: sem cabelo, cor de volta com o mesmo estilo e troca para curto só com peça grátis', async () => {
  const t = preparar();
  assert.equal(lerFigura(FIG).longo, true, 'hr-828 é cabelo longo no voxel');
  t.P.abrir();
  await esperar();
  t.clicar({ vp: 'aba', valor: 'cabelo' });
  t.clicar({ vp: 'estilo', valor: 'sem' });
  assert.equal(partes(t.figuraDaPrevia()).hr, undefined);
  assert.equal(lerFigura(t.figuraDaPrevia()).cabelo, null);
  assert.match(t.lado().innerHTML, /data-vp="estilo" data-valor="sem" aria-pressed="true"/);
  // Escolher uma cor devolve o cabelo no estilo de antes (o mesmo hr-828, só outra cor).
  const cor = paleta('hr', 'cabelo')[7];
  t.clicar({ vp: 'cor', campo: 'corCabelo', valor: cor });
  let v = lerFigura(t.figuraDaPrevia());
  assert.equal(v.cabelo, cor);
  assert.equal(v.longo, true);
  assert.equal(partes(t.figuraDaPrevia()).hr.id, 828);
  // Curto: o hr-828 é longo, então entra um cabelo grátis do corpo, na mesma cor.
  t.clicar({ vp: 'estilo', valor: 'curto' });
  v = lerFigura(t.figuraDaPrevia());
  assert.equal(v.cabelo, cor);
  assert.equal(v.longo, false);
  t.clicar({ vp: 'salvar' });
  await esperar();
  let fig = t.ch.api.at(-1)[1].perfil.figura;
  const hr = partes(fig).hr;
  assert.ok(GRATIS.includes(`roupa:hr-${hr.id}`) && serveM('hr', hr.id), `cabelo novo grátis e do corpo: hr-${hr.id}`);
  assert.equal(lerFigura(fig).longo, false);

  // Sem cabelo também grava (a parte hr sai da figura).
  t.P.abrir();
  await esperar();
  t.clicar({ vp: 'aba', valor: 'cabelo' });
  t.clicar({ vp: 'estilo', valor: 'sem' });
  t.clicar({ vp: 'salvar' });
  await esperar();
  fig = t.ch.api.at(-1)[1].perfil.figura;
  assert.equal(partes(fig).hr, undefined);
  assert.equal(lerFigura(fig).cabelo, null);
});

test('acessórios: sem peça livre ficam desligados com o aviso da loja; com as skins desligadas, veste chapéu e óculos', async () => {
  const t = preparar();
  t.P.abrir();
  await esperar();
  t.clicar({ vp: 'aba', valor: 'acessorios' });
  assert.match(t.lado().innerHTML, /loja de roupas do Escritório/);
  assert.match(t.lado().innerHTML, /data-campo="chapeu" data-valor="[^"]+"[^>]* disabled/);
  assert.match(t.lado().innerHTML, /data-vp="oculos" data-valor="1" aria-pressed="false" disabled/);
  const antes = t.figuraDaPrevia();
  t.clicar({ vp: 'cor', campo: 'chapeu', valor: paleta('ha', 'chapeu')[0] });
  assert.equal(t.figuraDaPrevia(), antes, 'não inventa peça que a pessoa não tem');
  assert.match(t.achar('vv-personagem-aviso').textContent, /ainda não tem chapéu/);
  t.P.fechar();

  const s = preparar({ roupas: { ativo: false } });
  s.P.abrir();
  await esperar();
  s.clicar({ vp: 'aba', valor: 'acessorios' });
  assert.doesNotMatch(s.lado().innerHTML, /loja de roupas/);
  const chapeu = paleta('ha', 'chapeu')[4];
  s.clicar({ vp: 'cor', campo: 'chapeu', valor: chapeu });
  s.clicar({ vp: 'oculos', valor: '1' });
  s.clicar({ vp: 'salvar' });
  await esperar();
  const fig = s.ch.api.at(-1)[1].perfil.figura;
  assert.match(fig, FIGURA_SERVIDOR);
  const v = lerFigura(fig);
  assert.equal(v.chapeu, chapeu);
  assert.equal(v.oculos, true);
  for (const t2 of ['ha', 'ea']) assert.ok(serveM(t2, partes(fig)[t2].id), `${t2} do catálogo e do corpo`);
});

test('Aleatório troca o boneco só com peças livres; Cancelar fecha sem gravar', async () => {
  const t = preparar();
  t.P.abrir();
  await esperar();
  vm.runInContext('Math.random = (() => { let i = 0; const s = [.05, .7, .3, .9, .45, .2, .8, .6, .1, .35, .55, .15, .95, .25]; return () => s[i++ % s.length]; })()', t.ctx);
  t.clicar({ vp: 'aleatorio' });
  const fig = t.figuraDaPrevia();
  assert.notEqual(fig, FIG);
  assert.match(fig, FIGURA_SERVIDOR);
  for (const [tipo, p] of Object.entries(partes(fig))) {
    assert.ok(livre(tipo, p.id), `${tipo}-${p.id} é grátis ou já era da pessoa`);
    assert.ok(serveM(tipo, p.id), `${tipo}-${p.id} serve no corpo`);
  }
  t.clicar({ vp: 'cancelar' });
  assert.equal(t.P.aberto(), false);
  assert.equal(t.ch.api.filter(([a]) => a === 'perfil').length, 0);
  assert.equal(t.escritorio.perfil.figura, FIG);
});

test('X e Esc fecham; o Esc não passa para o mundo; sem mudança, Salvar só fecha', async () => {
  const t = preparar();
  t.P.abrir();
  await esperar();
  const x = t.raiz().todos().find((n) => n.getAttribute('aria-label') === 'Fechar');
  x.disparar('click');
  assert.equal(t.P.aberto(), false);
  assert.equal((t.doc.ouvintes.keydown || []).length, 0, 'solta o teclado ao fechar');

  t.P.abrir();
  await esperar();
  const e = t.tecla('Escape');
  assert.equal(e.prevenido, true, 'o Esc é desta janela');
  assert.equal(t.P.aberto(), false);
  assert.equal(t.raiz().hidden, true);

  t.P.abrir();
  await esperar();
  t.clicar({ vp: 'salvar' });
  await esperar();
  assert.equal(t.P.aberto(), false);
  assert.equal(t.ch.api.filter(([a]) => a === 'perfil').length, 0);
});

test('sem Escritório: estado vazio com "Entrar no Escritório"; quando a entrada termina, o criador abre', async () => {
  const t = preparar({ comBase: false });
  t.P.abrir();
  await esperar();
  assert.match(t.corpo().innerHTML, /Você ainda não está no Escritório/);
  assert.match(t.corpo().innerHTML, /data-vp="entrar">Entrar no Escritório</);
  assert.equal(t.ch.api.length, 0);
  t.clicar({ vp: 'entrar' });
  assert.equal(t.ch.entrar, 1, 'chama abrirEscritorio()');
  assert.match(t.corpo().innerHTML, /Entrando no Escritório/);
  t.escritorio.base = t.novaBase();
  t.ch.vigias.at(-1)();
  await esperar();
  assert.match(t.lado().innerHTML, /role="tablist"/);
  assert.equal(t.figuraDaPrevia(), FIG);
});

test('erro ao gravar: a janela fica aberta com a mensagem do Escritório e o Salvar volta', async () => {
  const t = preparar({ gravar: async () => { throw new Error('Faltam 1 peça no seu guarda-roupa. Compre no criador para salvar.'); } });
  t.P.abrir();
  await esperar();
  t.clicar({ vp: 'aba', valor: 'calca' });
  t.clicar({ vp: 'cor', campo: 'calca', valor: paleta('lg', 'calca').find((c) => c !== lerFigura(FIG).calca) });
  t.clicar({ vp: 'salvar' });
  await esperar();
  assert.equal(t.P.aberto(), true);
  const erro = t.achar('vv-personagem-erro');
  assert.match(erro.textContent, /Faltam 1 peça no seu guarda-roupa/);
  assert.equal(erro.hidden, false);
  assert.equal(erro.id, '', 'devolve o #abr-erro emprestado');
  assert.match(t.achar('vv-personagem-acoes').innerHTML, /data-vp="salvar">Salvar</);
  assert.equal(t.escritorio.perfil.figura, FIG);
  assert.deepEqual(t.ch.toast, []);
});

test('prévia 3D viva quando o pacote exporta desenharPreviaAvatar: troca, gira e solta o WebGL ao fechar', async () => {
  const t = preparar({ modulo: (ch) => ({ desenharPreviaAvatar: (canvas, figura) => {
    ch.previa.push(['criar', canvas.tagName, figura]);
    return { trocar: (f) => ch.previa.push(['trocar', f]), girar: (d) => ch.previa.push(['girar', Math.round(d * 1000) / 1000]), destruir: () => ch.previa.push(['destruir']) };
  } }) });
  t.P.abrir();
  await esperar();
  assert.deepEqual(t.ch.previa[0], ['criar', 'CANVAS', FIG]);
  assert.equal(t.achar('vv-personagem-tela').tagName, 'CANVAS');
  t.clicar({ vp: 'cor', campo: 'pele', valor: paleta('hd', 'pele')[5] });
  const trocou = t.ch.previa.filter(([a]) => a === 'trocar').at(-1);
  assert.equal(lerFigura(trocou[1]).pele, paleta('hd', 'pele')[5]);
  t.clicar({ vp: 'girar', valor: '1' });
  assert.deepEqual(t.ch.previa.at(-1), ['girar', Math.round(Math.PI / 4 * 1000) / 1000]);
  t.P.fechar();
  assert.deepEqual(t.ch.previa.at(-1), ['destruir']);
  assert.equal(t.achar('vv-personagem-tela'), null, 'o canvas sai junto');
});

test('Irecity ligado: personalizarEscritorio abre o criador do mundo; fora dele, o do Escritório', async () => {
  const t = preparar();
  t.ctx.personalizarEscritorio();
  assert.equal(t.ch.antigo, 1);
  assert.equal(t.P.aberto(), false);
  t.doc.body.classList.add('mundo');
  t.ctx.personalizarEscritorio();
  assert.equal(t.P.aberto(), true);
  assert.equal(t.ch.antigo, 1);
  await esperar();
  t.P.fechar();
});
