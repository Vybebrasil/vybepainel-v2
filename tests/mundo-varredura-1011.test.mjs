// Varredura de 10/11/2026 (Paulo: "abriu todas as abas, menus e submenus e botões?"): o que quebrava no uso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');

test('Esc com o cartão de um evento aberto fecha só o cartão, não a Agenda', () => {
  const js = ler('vybe-mundo.js');
  const corpo = js.slice(js.indexOf('function fecharBaloesAntigos() {'), js.indexOf('function limparTela() {'));
  assert.match(corpo, /getElementById\('ag-cartao'\)/);
  assert.match(corpo, /if \(cartao && !cartao\.hidden\) \{[^}]*agCartaoFechar\?\.\(\)[^]*?return true; \}/);
});

test('cartão, prévia e balões param acima do dock das salas', () => {
  const capt = ler('vybe-captacoes.js');
  assert.match(capt, /function agFundoLivre\(\) \{[^]*?--vv-dock-alto[^]*?return window\.innerHeight - \(dock \? dock \+ 14 : 0\);/);
  assert.equal((capt.match(/agFundoLivre\(\) - h - m/g) || []).length, 2, 'cartão e prévia');
  assert.doesNotMatch(capt, /window\.innerHeight - h - m\)/);
  const st = ler('vybe-status.js');
  const ancora = st.slice(st.indexOf('function ancorarPopover('), st.indexOf("menu.style.visibility = '';", st.indexOf('function ancorarPopover(')));
  assert.match(ancora, /const fundo = window\.innerHeight - \(dock \? dock \+ 14 : 0\);/);
  assert.doesNotMatch(ancora, /window\.innerHeight - (height|margem)/, 'todas as contas usam o fundo livre');
  // E o teto: abaixo da barra do topo do mundo; mais alto que o espaço, rola por dentro.
  assert.match(ancora, /const teto = fimBarra > 0 && fimBarra < window\.innerHeight \/ 3 \? fimBarra \+ 8 : margem;/);
  assert.match(ancora, /Math\.min\(Math\.max\(teto, desejado\), Math\.max\(teto, limite\)\)/);
  assert.match(ancora, /menu\.style\.overflowY = 'auto'/);
});

test('plural e vírgula: 1 atrasada, 1 conteúdo, 3,5 h', () => {
  assert.ok(ler('vybe-mundo-planejamentos.js').includes("['atrasadas', ['atrasada', 'atrasadas']]"));
  assert.ok(ler('vybe-dominio.js').includes("${todos.length === 1 ? 'conteúdo' : 'conteúdos'}"));
  assert.ok(ler('vybe-gestor.js').includes("${total === 1 ? 'conteúdo' : 'conteúdos'}"));
  assert.ok(ler('vybe-mundo-agentes.js').includes("String(n.horasAteResolver).replace('.', ',') + ' h'"));
});

test('mapa do Cérebro: Esc solta o cliente e depois sai; trocar de tela fecha o mapa', () => {
  const g = ler('vybe-cerebro-grafo.js');
  assert.match(g, /if \(fixo\) \{ fixo = null; mostrarCartao\(null\); sujo = true; pedir\(\); return; \}\s*sair\(\);/);
  assert.match(g, /window\.addEventListener\('vybe:trocar-tela', aoTrocarDeTela\);/);
  assert.match(g, /window\.removeEventListener\('vybe:trocar-tela', aoTrocarDeTela\);/);
});
