// Frente da-8 do confere de diretor de arte (19/11/2026): as últimas sobras.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ler = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// Um nó de texto e um elemento de mentira, que contam quantas vezes a árvore muda.
function elemento(texto) {
  const el = { trocas: 0, firstChild: null, className: '', title: '' };
  const no = (data) => ({ nodeType: 3, nextSibling: null, _d: data, get data() { return this._d; }, set data(v) { this._d = v; el.dados = (el.dados || 0) + 1; } });
  Object.defineProperty(el, 'textContent', { get: () => (el.firstChild ? el.firstChild.data : ''), set: (v) => { el.trocas++; el.firstChild = v === '' ? null : no(String(v)); } });
  if (texto !== undefined) el.firstChild = no(texto);
  return el;
}
function funcaoDoSync(nome) {
  const src = ler('vybe-sync.js');
  const i = src.indexOf(`function ${nome}(`); assert.ok(i >= 0, nome);
  let n = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) { if (src[j] === '{') n++; else if (src[j] === '}' && --n === 0) break; }
  const c = vm.createContext({}); vm.runInContext(src.slice(i, j + 1), c); return c[nome];
}

test('sincronia troca o texto sem trocar o nó (o :has dos pais não recalcula a cada 15 s)', () => {
  const escrever = funcaoDoSync('escreverTextoSemTrocarNo');
  const b = elemento('20:01:15');
  escrever(b, '20:01:30');
  assert.equal(b.textContent, '20:01:30'); assert.equal(b.trocas, 0); assert.equal(b.dados, 1);
  escrever(b, '20:01:30'); // igual: não escreve
  assert.equal(b.dados, 1);
  const vazio = elemento(); // sem nó de texto ainda: textContent cria um
  escrever(vazio, 'Conferindo dados'); assert.equal(vazio.trocas, 1); assert.equal(vazio.textContent, 'Conferindo dados');
  escrever(null, 'x'); // sem elemento: nada
});

test('setSyncHealth só escreve classe e título quando mudam, e o texto pelo nó', () => {
  const src = ler('vybe-sync.js');
  const corpo = src.slice(src.indexOf('function setSyncHealth('), src.indexOf('function refreshSyncHealthAge('));
  assert.match(corpo, /if \(el\.className !== classe\) el\.className = classe;/);
  assert.match(corpo, /if \(el\.title !== m\) el\.title = m;/);
  assert.doesNotMatch(corpo, /\.textContent\s*=/);
  assert.match(src, /if \(footer && text\) escreverTextoSemTrocarNo\(footer, text\);/);
});

test('logo sem classe (o "como fica no Instagram" do Conteúdo) nasce com tamanho', () => {
  const c = vm.createContext({ CADASTRO_CLIENTES: [{ id: 7, nome: 'Lions', tem_logo: true }], FEED: { perfis: new Map() }, VYBES_CEREBRO_BASE: [] });
  vm.runInContext(ler('vybe-logo-cliente.js'), c);
  const html = vm.runInContext("logoDoClienteHtml('Lions', { classe: '', iniciais: 'LI' })", c);
  assert.match(html, /^<img src=/); assert.match(html, / width="64" height="64"/);
  assert.match(vm.runInContext("logoDoClienteHtml('Lions')", c), / width="28" height="28"/);
});
