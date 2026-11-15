// Confere de otimização (14/11/2026): o que o perfil mostrou e foi corrigido não volta.
// 1) classList.remove/add reescreve o atributo class mesmo quando nada muda, e o MutationObserver da classe do body
//    roda sincronizar() inteiro (Hoje, agenda, área livre com recálculo de estilo da página). O pintarDock, chamado a
//    cada 1,5 s pela barra da chamada, tirava 'cel-dock-aberto' sem ela estar lá: medido 6 a 7 sincronizar() por 10 s
//    em todas as telas, com a pessoa parada.
// 2) A agenda do Hoje pedia /api/painel?area=captacoes duas vezes na entrada (duas chamadas antes da primeira voltar).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const fonte = (arq) => readFileSync(arq, 'utf8').replace(/\r\n/g, '\n');
function funcao(src, nome) {
  const i = src.indexOf(`function ${nome}(`);
  assert.ok(i >= 0, `achei ${nome}`);
  let j = src.indexOf('{', src.indexOf(')', i)), n = 0;
  for (let k = j; k < src.length; k++) { if (src[k] === '{') n++; else if (src[k] === '}' && --n === 0) return src.slice(i, k + 1); }
  throw new Error('chaves de ' + nome);
}

test('pintarDock só mexe na classe do body quando ela muda (não acorda o sincronizar a cada 1,5 s)', () => {
  const dock = funcao(fonte('vybe-mundo.js'), 'pintarDock');
  // toggle(classe, valor) não reescreve o atributo quando nada muda; add/remove soltos reescrevem.
  for (const m of dock.matchAll(/body\.classList\.(add|remove)\('([\w-]+)'\)/g)) {
    const antes = dock.slice(Math.max(0, m.index - 160), m.index);
    assert.match(antes, new RegExp(`body\\.classList\\.contains\\('${m[2]}'\\)`), `body.classList.${m[1]}('${m[2]}') no pintarDock sem conferir antes se a classe já está (ou não) lá`);
  }
  assert.doesNotMatch(dock, /if \(!body\.classList\.contains\('cel-na-sala'\)\) body\.classList\.remove\('cel-dock-aberto'\)/);
});

test('O pulso do avatar no bloco de ação anima só transform e opacity (não box-shadow, que recalcula e repinta a cada quadro)', () => {
  // 3) Medido parado por 10 s (Chromium): Clientes 35,7% → 6,3% de CPU, Gestão 31,9% → 7,6%, Finanças 24,7% → 4,4%.
  const css = fonte('padrao-v2/0-d3-base.css');
  const regras = [...css.matchAll(/([^{}]*\.d3-acao > \.d3-acao-av[^{}]*)\{([^}]*)\}/g)].filter((m) => !/prefers-reduced-motion/.test(m[1]));
  for (const [, sel, corpo] of regras) assert.doesNotMatch(corpo, /animation:d3PulsaBranco\b/, `${sel.trim()}: o pulso em box-shadow voltou`);
  const anel = regras.find(([, sel]) => /::after\s*$/.test(sel));
  assert.ok(anel, 'o anel mora no ::after do avatar');
  assert.match(anel[2], /animation:d3PulsaBrancoAnel /);
  assert.match(anel[2], /z-index:-1/, 'o anel fica por baixo do avatar');
  const quadros = css.match(/@keyframes d3PulsaBrancoAnel\{(.*)\}\n/)?.[1] || '';
  assert.ok(quadros, 'keyframes d3PulsaBrancoAnel');
  for (const prop of quadros.matchAll(/([a-z-]+):/g)) assert.ok(['opacity', 'transform'].includes(prop[1]), `d3PulsaBrancoAnel anima ${prop[1]}`);
  // O avatar precisa ser posicionado para o ::after ficar nele (na janela de Pessoas a regra própria dizia position:static).
  assert.match(css, /\.d3-acao > \.d3-acao-av\{position:relative;isolation:isolate\}/);
  assert.doesNotMatch(fonte('padrao-v2/d3-time.css'), /\.v2p-fala > \.v2p-ag\{position:static/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{[^@]*\.d3-acao > \.d3-acao-av::after\{display:none\}/);
});

test('A agenda do Hoje não pede a mesma leitura duas vezes enquanto a primeira não voltou', () => {
  const ag = funcao(fonte('vybe-mundo.js'), 'carregarAgenda');
  assert.match(ag, /if \(!forcar && agendaIndo\) return agendaIndo;/, 'quem chega com uma leitura no caminho espera a mesma');
  assert.match(ag, /finally \{ if \(agendaIndo === ida\) agendaIndo = null; \}/, 'a leitura terminada libera a próxima (inclusive com erro)');
  assert.ok(ag.indexOf('agendaIndo) return') < ag.indexOf('area=captacoes'), 'a guarda vem antes do fetch');
});

test('Nenhum avatar pulsa mais em box-shadow: os pulsos dos agentes (roxo e branco) vão no ::after com transform e opacity', () => {
  // Paulo, 15/11/2026 ("sim, troca"). Medido parado por 10 s (Chromium): Hoje 42,4% → 7,6% de CPU, Equipe online 72,8% → 12,5%,
  // Criação 56,9% → 8,7%.
  for (const arq of readdirSync('padrao-v2').filter((a) => a.endsWith('.css'))) {
    assert.doesNotMatch(fonte(`padrao-v2/${arq}`), /animation:d3Pulsa(Branco)? /, `${arq}: um pulso em box-shadow voltou`);
  }
  const base = fonte('padrao-v2/0-d3-base.css');
  const quadros = base.match(/@keyframes d3PulsaAnel\{(.*)\}\n/)?.[1] || '';
  assert.ok(quadros, 'keyframes d3PulsaAnel');
  for (const prop of quadros.matchAll(/(?:^|[{;])([a-z-]+):/g)) assert.ok(['opacity', 'transform'].includes(prop[1]), `d3PulsaAnel anima ${prop[1]}`);
  assert.match(base, /\.d3-agente-av::after\{[^}]*z-index:-1[^}]*animation:d3PulsaAnel /);
  assert.match(base, /prefers-reduced-motion:reduce\)\{[^@]*\.d3-agente-av::after\{display:none\}/);
});
