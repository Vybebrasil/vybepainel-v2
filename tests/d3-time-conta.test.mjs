// Direção 3, grupo "time": Conta e equipe (quadro D3-ContaEquipe) e Equipe online (quadro D3-EquipeOnline, só CSS).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const conta = ler('vybe-conta.js'), css = ler('padrao-v2/d3-time.css');
const secao = css.slice(css.indexOf('/* ===== CONTA E EQUIPE · EQUIPE ONLINE ===== */'), css.indexOf('/* ===== FIM CONTA E EQUIPE · EQUIPE ONLINE ===== */'));
const safeText = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function tela({ ai, eu, equipe = [], clientes = [], acessos = [] }) {
  const raiz = { innerHTML: '' };
  const c = vm.createContext({ console, Date, safeText, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {} },
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: (id) => (id === 'conta-root' ? raiz : null) } });
  vm.runInContext(conta, c);
  Object.assign(c, { __ai: ai, __eu: eu, __eq: equipe, __cl: clientes, __ac: acessos });
  vm.runInContext('CONTA_AI = __ai; MINHA_CONTA = __eu; EQUIPE = __eq; CLIENTES = __cl; ACESSOS = __ac; pintarConta()', c);
  return raiz.innerHTML;
}
const time = [
  { id: 1, nome: 'Paulo', pode_entrar: true, ativo: true, dono: true }, { id: 2, nome: 'Beatriz', pode_entrar: true, ativo: true, coordenacao: true },
  { id: 3, nome: 'Jady', pode_entrar: true, ativo: true }, { id: 4, nome: 'Vinícius', pode_entrar: true, ativo: true, dono: true },
];

test('Conta D3: "senhor" só para dono; etiqueta "dono" cheia e "coordenação" clara; sem "tornar admin"', () => {
  const html = tela({ ai: { erro: 'x' }, eu: { nome: 'Paulo', email: 'p@x', admin: true, dono: true }, equipe: time });
  assert.match(html, /Não conferi seu WhatsApp, senhor, e falta sua foto\./);
  assert.match(html, /<span class="v2c-pill d3c-dono">dono<\/span>\s*<\/div>[\s\S]*<h2>Equipe<\/h2>/, 'o perfil do dono leva a etiqueta cheia');
  const equipe = html.slice(html.indexOf('<h2>Equipe</h2>'));
  // donos primeiro, depois a coordenação, depois o time
  const ordem = ['Paulo', 'Vinícius', 'Beatriz', 'Jady'].map((n) => equipe.indexOf(n));
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem);
  assert.equal((equipe.match(/d3c-dono">dono</g) || []).length, 2);
  assert.match(equipe, /<b>Beatriz<\/b><span class="v2c-pill n">coordenação<\/span>/);
  assert.match(equipe, /<span>Jady<\/span><\/div>/, 'o time sem etiqueta');
  assert.match(html, /d3-num-rot">Donos<\/span><b class="d3-num-v">2<small> · 1 coordenação<\/small><\/b>/);
  assert.doesNotMatch(conta, /Tornar admin|Tirar admin|'(tornar|tirar)_admin'\)/, 'nenhum botão de admin');
  const naoDono = tela({ ai: { erro: 'x' }, eu: { nome: 'Jady', email: 'j@x', foto_url: 'f.png' } });
  assert.match(naoDono, /Não conferi seu WhatsApp\.<\/span>/);
  assert.doesNotMatch(naoDono, /senhor|d3c-nums|<h2>Equipe<\/h2>|<h2>Operação<\/h2>/);
  assert.match(naoDono, /class="d3c-cols so-eu"/);
});

test('Conta D3: cada número e o pé da Equipe abrem a seção; Operação mantém as quatro portas', () => {
  const html = tela({ ai: { disponivel: true, vinculado: true }, eu: { nome: 'Paulo', email: 'p@x', admin: true, dono: true, foto_url: 'f.png' }, equipe: time,
    clientes: [{ id: 1, nome: 'A', ativo: true }], acessos: [{ id: 1, tem_documento: true }] });
  for (const s of ['equipe', 'clientes', 'acessos']) assert.match(html, new RegExp(`class="d3-num d3c-num" onclick="escolherSecaoDaConta\\('${s}'\\)"`));
  for (const s of ['opcoes', 'manutencao', 'clientes', 'acessos']) assert.match(html, new RegExp(`d3c-op">[\\s\\S]*?escolherSecaoDaConta\\('${s}'\\)">Abrir`));
  assert.match(html, /class="d3c-eq-pe" onclick="escolherSecaoDaConta\('equipe'\)">abrir a equipe<\/button>/);
  assert.match(html, /Conta em ordem, senhor\. WhatsApp conferido\.<\/span><\/section>/, 'sem pendência, o bloco fica sem botão');
});

test('CSS D3 da Conta e da Equipe online: sem !important, sem html body.mundo, tokens --d3-* e prefixos próprios', () => {
  assert.ok(secao.length > 1000);
  assert.doesNotMatch(secao, /!important|html body\.mundo/);
  for (const linha of secao.split('\n').filter((l) => l.includes('{') && !l.trim().startsWith('@') && !l.trim().startsWith('/*'))) {
    assert.match(linha.trim(), /^(#conta-root #v2c\.d3c|#vv-placa \.v2e)/, 'só mexe na Conta e na Equipe online: ' + linha.slice(0, 60));
  }
  assert.match(secao, /#conta-root #v2c\.d3c\{[^}]*background:var\(--d3-areia\)/);
  assert.match(secao, /#vv-placa \.v2e\{[^}]*background:var\(--d3-areia\)/);
  assert.match(secao, /#vv-placa \.v2e \.v2n-fala\{[^}]*background:var\(--d3-acao\)/, 'a fala vira o bloco de ação');
  assert.match(secao, /#vv-placa \.v2e \.v2e-topo > \.v2n-btn\.p\{[^}]*background:var\(--d3-cartao\)/, 'Conversa da equipe deixa de ser laranja');
});
