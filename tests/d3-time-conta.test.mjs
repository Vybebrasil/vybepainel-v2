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
  assert.match(html, /<span class="d3m-e-ct-pill k d3c-dono">dono<\/span>\s*<\/div>[\s\S]*<b>Equipe /, 'o perfil do dono leva a etiqueta cheia');
  const equipe = html.slice(html.indexOf('<b>Equipe '));
  // donos primeiro, depois a coordenação, depois o time
  const ordem = ['Paulo', 'Vinícius', 'Beatriz', 'Jady'].map((n) => equipe.indexOf(n));
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem);
  assert.equal((equipe.match(/d3c-dono">dono</g) || []).length, 2);
  assert.match(equipe, /<b>Beatriz<\/b><\/span><span class="d3m-e-ct-pill">coordenação<\/span>/);
  assert.match(equipe, /<span>Jady<\/span><\/span><\/div>/, 'o time sem etiqueta');
  // Prancha V2-M-Conta-Equipe: os números saem do alto; a contagem de donos e coordenação fica na cabeça da Equipe.
  assert.match(html, /<b>Equipe <span>· 4 com acesso · 2 donos · 1 coordenação<\/span><\/b>/);
  assert.doesNotMatch(conta, /Tornar admin|Tirar admin|'(tornar|tirar)_admin'\)/, 'nenhum botão de admin');
  const naoDono = tela({ ai: { erro: 'x' }, eu: { nome: 'Jady', email: 'j@x', foto_url: 'f.png' } });
  assert.match(naoDono, /<b class="d3m-lar-num">1<\/b><span class="d3-acao-frase">coisa falta na sua conta<\/span><small class="d3m-lar-sub">Não conferi seu WhatsApp\.<\/small>/);
  assert.doesNotMatch(naoDono, /senhor|<b>Equipe |<b>Operação<\/b>|Ver como o time vê/);
  assert.match(naoDono, /class="d3m-e-main d3m-e-ct-cols so-eu"/);
  assert.match(naoDono, /data-papel="time"/);
});

test('Conta V2: a Operação mantém as quatro portas e o elo da Equipe abre a parte; sem pendência, não há laranja', () => {
  const html = tela({ ai: { disponivel: true, vinculado: true }, eu: { nome: 'Paulo', email: 'p@x', admin: true, dono: true, foto_url: 'f.png' }, equipe: time,
    clientes: [{ id: 1, nome: 'A', ativo: true }], acessos: [{ id: 1, tem_documento: true }] });
  for (const s of ['opcoes', 'manutencao', 'clientes', 'acessos']) assert.match(html, new RegExp(`d3m-e-ct-op">[\\s\\S]*?escolherSecaoDaConta\\('${s}'\\)"[^>]*>Abrir`));
  assert.match(html, /<b>Clientes<\/b> · 1 ativo<\/span>/); assert.match(html, /<b>Credenciais<\/b> · 1 guardada · /);
  assert.match(html, /a sua conta, os acessos e a equipe · 4 pessoas com acesso · 1 cliente<\/span>/);
  assert.match(html, /class="d3m-e-elo d3c-eq-pe" onclick="escolherSecaoDaConta\('equipe'\)">abrir a equipe<\/button>/);
  assert.match(html, /Conta em ordem, senhor\. WhatsApp conferido\.<\/p>/, 'sem pendência, a frase vai numa nota');
  assert.doesNotMatch(html, /d3m-laranja/, 'o laranja é só para ação');
});

test('CSS D3 da Conta e da Equipe online: sem !important, sem html body.mundo, tokens --d3-* e prefixos próprios', () => {
  assert.ok(secao.length > 1000);
  assert.doesNotMatch(secao, /!important|html body\.mundo/);
  for (const linha of secao.split('\n').filter((l) => l.includes('{') && !l.trim().startsWith('@') && !l.trim().startsWith('/*'))) {
    assert.match(linha.trim(), /^(#conta-root #v2c\.d3c|#vv-placa \.v2e)/, 'só mexe na Conta e na Equipe online: ' + linha.slice(0, 60));
  }
  assert.match(secao, /#conta-root #v2c\.d3c\{[^}]*background:var\(--d3-areia\)/);
});
