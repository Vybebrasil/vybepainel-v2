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
  // D3-Topo: a Busca ganha 420 para as cinco fichas caberem numa linha; Avisos e Conta seguem com 340.
  assert.match(regra('#v2j-busca'), /width:420px/);
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
  assert.ok(spot.includes('<kbd>↑↓</kbd>navegar<kbd>Enter</kbd>abrir<kbd>Tab</kbd>filtrar'), 'pé com as teclas em pílula');
  assert.match(spot, /querySelectorAll\('\[data-ferr="busca"\]'\)\]\.find\(visivel\)/);
  assert.match(spot, /const r = botao\.getBoundingClientRect\(\), largura = 420;/);
  assert.match(spot, /bloco\('atalhos', 'Atalhos', spotlightAtalhos\(linha\)\) : ''/, 'Atalhos também no fim de "Tudo"');
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

// Prancha V2-M-Conta-Equipe (16/11/2026): título no vidro, a folha de quem você é, a Operação, a Equipe e a consulta
// (o laranja do VYBES, por que conferir o WhatsApp e os atalhos). Os quatro números e a fileira "Abrir" saíram.
test('Conta e equipe: a ordem da prancha (título no vidro, você, Operação, Equipe e a consulta com o laranja)', () => {
  const { html } = telaDaConta({ ai: { erro: 'Sem resposta.' }, eu: admin,
    equipe: [{ id: 1, nome: 'Ana Lima', pode_entrar: true, ativo: true }, { id: 2, nome: 'Fora', pode_entrar: false, ativo: true }],
    clientes: [{ id: 1, nome: 'Cliente A', ativo: true }, { id: 2, nome: 'Cliente B', ativo: true }, { id: 3, nome: 'Cliente C', ativo: true }, { id: 4, nome: 'Saiu', ativo: false }],
    acessos: [{ id: 1, tem_documento: true }, { id: 2, tem_documento: false }] });
  // Com o WhatsApp pendente, o "Conferir o WhatsApp" do topo some (a ação mora na linha e no laranja).
  assert.doesNotMatch(html, />Conferir o WhatsApp<\/button>/);
  const ordem = ['class="d3m-e-tela d3m-e-conta" data-papel="admin" data-parte="inicio"', '>Conta e equipe</span>', 'a sua conta, os acessos e a equipe · 1 pessoa com acesso · 3 clientes', '>Ver como o time vê</button>',
    'id="conta-conteudo"', '<b>Operação</b>', '<b>Equipe ', 'class="d3m-lado d3m-e-ct-lado"', 'id="v2c-fala"', 'class="d3m-laranja d3m-e-ct-lar"', 'VYBES · a sua conta', 'Por que conferir o WhatsApp', '<b>Atalhos</b>', 'Sair da conta'];
  let i = -1; for (const p of ordem) { const j = html.indexOf(p, i + 1); assert.ok(j > i, 'fora de ordem ou faltando: ' + p); i = j; }
  assert.doesNotMatch(html, /class="v2c-btn p"/, 'o laranja cheio é só o cartão de ação');
  assert.equal(html.split('class="d3m-laranja').length - 1, 1);
  assert.match(html, /<b class="d3m-lar-num">2<\/b><span class="d3-acao-frase">coisas faltam na sua conta<\/span><small class="d3m-lar-sub">Não conferi seu WhatsApp, e falta sua foto\.<\/small>/);
  assert.match(html, /class="d3m-btn l" onclick="carregarContaAI\(\)">Tentar de novo<\/button><button type="button" class="d3m-btn l s" onclick="document\.getElementById\('conta-foto-arquivo'\)\?\.click\(\)">Escolher a foto<\/button>/);
  assert.match(html, /<b>Equipe <span>· 1 com acesso<\/span><\/b>/);
  assert.match(html, /Só você por aqui[\s\S]*abrirNovoNoCiclo\('pessoa',\{depois:carregarConta\}\)">Convidar alguém</);
  assert.match(html, /<b>Clientes<\/b> · 3 ativos<\/span>/);
  assert.match(html, /<b>Credenciais<\/b> · 1 guardada · [\s\S]*?só a gestão vê/);
  assert.match(html, /<b class="d3m-e-ct-sit r"[^>]*>não conferido<\/b>[\s\S]*>Tentar de novo<\/button>/);
  assert.match(html, /<b class="d3m-e-ct-sit a">sem foto<\/b>[\s\S]*>Escolher<\/button>/);
  for (const s of ['opcoes', 'manutencao', 'clientes', 'acessos', 'equipe']) assert.match(html, new RegExp(`escolherSecaoDaConta\\('${s}'\\)`), 'a porta continua: ' + s);
  assert.doesNotMatch(html, /conta-barra|conta-aba|—|d3c-nums|v2c-abrir/);
});

test('Conta: o cartão de quem você é tem foto, senha que abre no lugar (dois campos), WhatsApp e tema', () => {
  const { html } = telaDaConta({ ai: { disponivel: true, vinculado: true }, eu: { ...admin, foto_url: 'f.png' } });
  assert.match(html, /<b class="d3m-e-ct-nome">Operador de teste<\/b><span class="d3m-e-ct-email"[^>]*>operador@example\.test<\/span><\/div>\s*<span class="d3m-e-ct-pill">gestão<\/span>/);
  assert.match(html, /<div class="v2-abre d3m-e-ct-senha" id="v2c-senha" aria-expanded="false">[\s\S]*>Trocar<\/button>[\s\S]*class="v2-mais" id="v2c-senha-campos" inert>[\s\S]*id="conta-atual"[\s\S]*id="conta-nova"[\s\S]*class="d3v-btn s" onclick="trocarMinhaSenha\(\)">Salvar/);
  assert.doesNotMatch(html, /conta-nova2/);
  assert.match(html, /d3m-e-ct-sit g"[^>]*>conectado<\/b>/);
  assert.doesNotMatch(html, /sem foto/);
  // 16/11/2026 (três temas): Fumê, Claro, Escuro e Auto; sem escolha guardada, o marcado é o Fumê (vybe-tema.js).
  assert.match(html, /role="radiogroup" aria-label="Tema" data-tema="fume">[\s\S]*data-tema-conta="fume" aria-checked="true"[\s\S]*data-tema-conta="claro" aria-checked="false"[\s\S]*data-tema-conta="escuro" aria-checked="false"[\s\S]*data-tema-conta="auto" aria-checked="false"/);
  assert.match(html, /Conta em ordem\. WhatsApp conferido\./);
  assert.doesNotMatch(html, /d3m-laranja/, 'sem pendência não há laranja');
  // Sem pendência de WhatsApp, o topo oferece conferir de novo.
  assert.match(html, /onclick="carregarContaAI\(\)">Conferir o WhatsApp<\/button>/);
});

test('Conta: quem não administra vê só a própria conta; a parte da operação abre na mesma janela, com a volta', () => {
  const time = telaDaConta({ ai: { disponivel: true, vinculado: false, pode_gerar: true }, eu: { nome: 'Bia', email: 'bia@x', foto_url: 'f.png' } }).html;
  assert.match(time, /role="heading" aria-level="2">Sua conta<\/span>/);
  assert.match(time, /data-papel="time"/);
  assert.doesNotMatch(time, /v2c-tres|Operação|Ver como o time vê|<b>Equipe |abrir a equipe/);
  assert.match(time, />Conectar<\/button>/);
  const t = telaDaConta({ ai: { disponivel: true, vinculado: true }, eu: { ...admin, foto_url: 'f.png' }, equipe: [{ id: 1, nome: 'Ana', email: 'ana@x', pode_entrar: true, ativo: true, tem_senha: true }] });
  vm.runInContext("escolherSecaoDaConta('equipe')", t.c);
  assert.match(t.raiz.innerHTML, /data-parte="equipe"/);
  assert.match(t.raiz.innerHTML, /<div class="d3m-e-cab"><b>Equipe<\/b><button type="button" class="d3m-e-elo d3m-e-ct-volta" onclick="escolherSecaoDaConta\('perfil'\)">/);
  assert.match(t.raiz.innerHTML, /class="v2c-card v2c-secao" id="conta-conteudo">[\s\S]*Novo colaborador[\s\S]*class="eq-linha/);
  assert.doesNotMatch(t.raiz.innerHTML, /v2c-duas|d3m-e-ct-lado/);
  vm.runInContext("escolherSecaoDaConta('perfil')", t.c);
  assert.match(t.raiz.innerHTML, /data-parte="inicio"/);
  // "Ver como o time vê": some o que é de quem administra e o laranja oferece a volta.
  vm.runInContext('alternarVisaoDoTime()', t.c);
  assert.match(t.raiz.innerHTML, /data-papel="time"[\s\S]*Você vê o painel como o time\.[\s\S]*onclick="alternarVisaoDoTime\(\)">Voltar<\/button>/);
  assert.doesNotMatch(t.raiz.innerHTML, /<b>Operação<\/b>|<b>Equipe /);
});
