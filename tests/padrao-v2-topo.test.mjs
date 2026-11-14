// Padrão v2, grupo "topo" (12/11/2026): os quadros DEPOIS "Janelas do topo" (Busca, Avisos e Conta numa janela só,
// 340 de largura, mesmo cabeçalho, embaixo do ícone) e "Conta e equipe".
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const css = ler('padrao-v2/topo.css'), spot = ler('vybe-spotlight.js'), conta = ler('vybe-conta.js');
const safeText = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const regra = (seletor) => { const i = css.indexOf(seletor + '{'); assert.ok(i >= 0, 'falta a regra ' + seletor); return css.slice(i, css.indexOf('}', i)); };

test('CSS do grupo: sem !important e sem html body.mundo; as três janelas com 340, branco e raio 24', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  assert.match(regra('#v2j-busca'), /width:340px/);
  for (const s of ['#mundo-hud .vv-avisos-painel', '#mundo-hud .vv-menu-conta']) {
    const r = regra(s);
    assert.match(r, /width:340px/); assert.match(r, /border-radius:24px/); assert.match(r, /background:#FFFFFF/);
  }
  assert.match(regra('#v2j-busca .spotlight-linha'), /min-height:40px/);
  assert.match(regra('#v2j-busca .spotlight-abas button[aria-selected="true"]'), /background:#1F1D1A;color:#FFFFFF/);
  assert.match(regra('#conta-root .v2c-card'), /border:0;border-radius:20px;background:#FFFFFF/);
  assert.match(regra('#conta-root .v2c-btn.p'), /background:#C2490C/);
  assert.match(regra('#conta-root .v2c-btn.s'), /height:30px/);
});

test('Busca: cabeçalho com nome, Esc e X; campo, fichas e pé com os atalhos; abre embaixo do ícone', () => {
  assert.match(spot, /d\.id = 'v2j-busca';/);
  assert.match(spot, /<div class="v2j-cab"><h2 id="spotlight-titulo">Busca<\/h2><span class="v2j-pill">Esc<\/span>/);
  assert.match(spot, /<label class="v2j-oculto" for="spotlight-input">Buscar peça, cliente ou pessoa<\/label>/);
  assert.match(spot, /partes\.push\('setas navegam · Enter abre · Tab filtra'\);/);
  assert.match(spot, /querySelectorAll\('\[data-ferr="busca"\]'\)\]\.find\(visivel\)/);
  assert.match(spot, /const r = botao\.getBoundingClientRect\(\), largura = 340;/);
  assert.match(spot, /bloco\('conteudos', 'Conteúdos',[\s\S]*bloco\('demandas', 'Demandas',[\s\S]*bloco\('pessoas', 'Pessoas',[\s\S]*bloco\('encerradas', 'Finalizadas e antigas'/);
  assert.match(spot, /\+ \$\{lista\.length - SPOTLIGHT_POR_BLOCO\} · mostrar/);
});

test('Busca: a data sai do jeito que se fala', () => {
  const c = vm.createContext({ console, document: { addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} }, safeText });
  vm.runInContext(spot, c);
  const q = (iso) => vm.runInContext(`spotlightQuando('${iso}', '2026-11-12')`, c);
  assert.equal(q('2026-11-12'), 'hoje');
  assert.equal(q('2026-11-13'), 'amanhã');
  assert.equal(q('2026-11-11'), 'ontem');
  assert.equal(q('2026-11-14'), 'sábado');
  assert.equal(q('2026-12-24'), '24/12');
  assert.equal(q('2027-01-05'), '05/01/2027');
});

function telaDaConta({ ai, eu, equipe = [], clientes = [], acessos = [] }) {
  const raiz = { innerHTML: '' };
  const c = vm.createContext({ console, Date, safeText, setTimeout, clearTimeout,
    localStorage: { getItem: () => null, setItem() {} },
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: (id) => (id === 'conta-root' ? raiz : null) } });
  vm.runInContext(conta, c);
  Object.assign(c, { __ai: ai, __eu: eu, __eq: equipe, __cl: clientes, __ac: acessos });
  vm.runInContext('CONTA_AI = __ai; MINHA_CONTA = __eu; EQUIPE = __eq; CLIENTES = __cl; ACESSOS = __ac; pintarConta()', c);
  return { html: raiz.innerHTML, c, raiz };
}
const admin = { nome: 'Operador de teste', email: 'operador@example.test', admin: true };

// Direção 3 (13/11/2026): a ordem passou a ser a do quadro D3-ContaEquipe (bloco de ação, quatro números, três colunas).
test('Conta e equipe: a ordem do quadro D3 (cabeçalho, bloco de ação, quatro números, três colunas, fileira Abrir)', () => {
  const { html } = telaDaConta({ ai: { erro: 'Sem resposta.' }, eu: admin,
    equipe: [{ id: 1, nome: 'Ana Lima', pode_entrar: true, ativo: true }, { id: 2, nome: 'Fora', pode_entrar: false, ativo: true }],
    clientes: [{ id: 1, nome: 'Cliente A', ativo: true }, { id: 2, nome: 'Cliente B', ativo: true }, { id: 3, nome: 'Cliente C', ativo: true }, { id: 4, nome: 'Saiu', ativo: false }],
    acessos: [{ id: 1, tem_documento: true }, { id: 2, tem_documento: false }] });
  const ordem = ['<h1>Conta e equipe</h1>', '>Gestão<', '>Ver como o time vê</button>', 'class="v2c-btn k" onclick="carregarContaAI()">Conferir o WhatsApp</button>',
    'class="d3-acao"', 'VYBES · Conta', 'class="d3c-nums"', '<h2>Pede ação</h2>', '<h2>Operação</h2>', 'id="conta-conteudo"', '<h2>Equipe</h2>', 'class="v2c-abrir"'];
  let i = -1; for (const p of ordem) { const j = html.indexOf(p, i + 1); assert.ok(j > i, 'fora de ordem ou faltando: ' + p); i = j; }
  assert.doesNotMatch(html, /class="v2c-btn p"/, 'o laranja cheio é só o bloco de ação');
  assert.equal(html.split('class="d3-acao"').length - 1, 1);
  assert.match(html, /Não conferi seu WhatsApp, e falta sua foto\.<\/span><button type="button" class="d3-acao-btn" onclick="carregarContaAI\(\)">Tentar de novo<\/button>/);
  assert.match(html, /d3-num-rot">Equipe<\/span><b class="d3-num-v">1<\/b>[\s\S]*com acesso/);
  assert.match(html, /d3-num-rot">Clientes<\/span><b class="d3-num-v">3<\/b>[\s\S]*Cliente A[\s\S]*Cliente B[\s\S]*\+1[\s\S]*ativos no painel/);
  assert.match(html, /d3-num-rot">Credenciais<\/span><b class="d3-num-v">1<\/b>/);
  assert.match(html, /d3-num-rot">Donos<\/span>/);
  assert.match(html, /v2c-pill r">Não conferido<\/span><b>WhatsApp<\/b>[\s\S]*vínculo com o seu número[\s\S]*>Tentar de novo<\/button>/);
  assert.match(html, /v2c-pill a">Sem foto<\/span><b>Sua foto<\/b>[\s\S]*>Escolher<\/button>/);
  assert.match(html, /<h2>Pede ação<\/h2><span class="v2c-sub">2<\/span>/);
  for (const r of ['Perfil', 'Senha', 'Equipe', 'Clientes', 'Opções das fichas', 'Credenciais', 'Manutenção']) assert.match(html, new RegExp(`class="v2c-chip"[^>]*>${r}</button>`));
  assert.doesNotMatch(html, /conta-barra|conta-aba|—/);
});

test('Conta: o cartão de quem você é tem foto, senha que abre no lugar (dois campos), WhatsApp e tema', () => {
  const { html } = telaDaConta({ ai: { disponivel: true, vinculado: true }, eu: { ...admin, foto_url: 'f.png' } });
  assert.match(html, /<h2>Operador de teste<\/h2><p class="v2c-sub">operador@example\.test<\/p><\/div>\s*<span class="v2c-pill n">gestão<\/span>/);
  assert.match(html, /<div class="v2-abre" id="v2c-senha" aria-expanded="false">[\s\S]*>Trocar<\/button>[\s\S]*class="v2-mais" id="v2c-senha-campos" inert>[\s\S]*id="conta-atual"[\s\S]*id="conta-nova"[\s\S]*class="v2c-btn s k" onclick="trocarMinhaSenha\(\)">Salvar/);
  assert.doesNotMatch(html, /conta-nova2/);
  assert.match(html, /v2c-pill g"[^>]*>Conectado<\/b>/);
  assert.match(html, /role="radiogroup" aria-label="Tema" data-tema="claro">[\s\S]*data-tema-conta="claro" aria-checked="true"[\s\S]*data-tema-conta="escuro" aria-checked="false"/);
  assert.match(html, /Conta em ordem\. WhatsApp conferido\./);
  assert.match(html, /Nada pendente na sua conta\. WhatsApp conferido\./);
  assert.match(html, /<span class="v2c-sub">nada agora<\/span>/);
});

test('Conta: quem não administra vê só a própria conta; a parte da operação abre pela fileira', () => {
  const time = telaDaConta({ ai: { disponivel: true, vinculado: false, pode_gerar: true }, eu: { nome: 'Bia', email: 'bia@x', foto_url: 'f.png' } }).html;
  assert.match(time, /<h1>Sua conta<\/h1>/);
  assert.doesNotMatch(time, /v2c-tres|Operação|Ver como o time vê|>Equipe<\/button>/);
  assert.match(time, />Conectar<\/button>/);
  const t = telaDaConta({ ai: { disponivel: true, vinculado: true }, eu: { ...admin, foto_url: 'f.png' }, equipe: [{ id: 1, nome: 'Ana', email: 'ana@x', pode_entrar: true, ativo: true, tem_senha: true }] });
  vm.runInContext("escolherSecaoDaConta('equipe')", t.c);
  assert.match(t.raiz.innerHTML, /class="v2c-card v2c-secao" id="conta-conteudo">[\s\S]*Novo colaborador[\s\S]*class="eq-linha/);
  assert.match(t.raiz.innerHTML, /data-secao="equipe" aria-pressed="true"/);
  assert.doesNotMatch(t.raiz.innerHTML, /v2c-duas/);
});
