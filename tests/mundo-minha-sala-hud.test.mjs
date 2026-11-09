// Minha sala com os painéis e o dock de salas (Paulo, 09/11/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo.js'), css = ler('vybe-mundo.css');

function dock({ online, zona = 'sala-1', minha = 'sala-1', falando = [] }) {
  const ini = js.indexOf('  function dockSalasHtml('), fim = js.indexOf('  async function abrirMinhaSala(');
  const ctx = { escritorio: { conectado: true, zona, base: { eu: '1' }, online },
    zonas3d: () => ({ recepcao: { nome: 'Convivência' }, producao: { nome: 'Produção' } }), minhaSalaDaConta: () => minha,
    fn: (n) => (n === 'escritorioPessoasFalando' ? () => new Set(falando) : n === 'escritorioAmbienteDoQuarto' ? (z) => ({ nome: z === 'sala-1' ? 'Sala do Paulo' : 'Sala da Bia' }) : null),
    esc: (s) => String(s), svg: (d) => `<svg>${d}</svg>`, Set, Map, String, Math };
  vm.createContext(ctx); vm.runInContext(js.slice(ini, fim), ctx);
  return ctx.dockSalasHtml(zona);
}

test('dock: minha sala primeiro, depois as salas com mais gente; quantos em cada, quem fala e Salas', () => {
  const h = dock({ online: [{ id: '1', nome: 'Paulo M', zona: 'sala-1' }, { id: '3', nome: 'Bia Souza', zona: 'producao' }, { id: '4', nome: 'Deivid Reis', zona: 'producao' }, { id: '2', nome: 'Vinícius L', zona: 'recepcao' }], falando: ['3'] });
  const ordem = [...h.matchAll(/data-vq-sala="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ordem.join(','), 'sala-1,producao,recepcao');
  assert.ok(h.includes('class="vq-item aberta voz minha" data-vq-sala="sala-1" aria-current="true"'), 'minha sala aberta e com a voz');
  assert.ok(h.includes('<span class="vq-rotulo">Minha sala</span>'));
  assert.ok(h.includes('<i class="fala">BS</i>'), 'quem fala acende');
  assert.ok(h.includes('<b class="vq-conta">2</b>'), 'quantos estão na Produção');
  assert.ok(h.includes('<b class="vq-conta on">4</b>'), 'quantos estão online');
  assert.ok(h.includes('data-vq-todas title="Todas as salas de voz') && h.includes('<span class="vq-rotulo">Salas</span>'));
});

test('sem o cartão no topo: Voltar é o primeiro ícone do dock; clique numa sala abre o quarto ou troca a voz', () => {
  assert.ok(!js.includes('<b class="quarto-nome">'), 'sem o cartão do quarto');
  assert.ok(js.includes('<button type="button" class="vq-item vq-voltar" data-sair-andar title="Voltar ao painel">'));
  assert.ok(js.includes('if (quartoDaSala(z)) abrirMinhaSala(z); else irParaSala(z);'));
  assert.ok(js.includes("if (b.hasAttribute('data-vq-todas')) { abrirDaDireita('voz'); return; }"));
});

test('CSS: Hoje à esquerda, Agenda à direita, o quarto no meio e o dock com o Voltar escuro', () => {
  assert.ok(!css.includes('body.mundo-quarto #vv-hoje{display:none}'));
  assert.ok(css.includes('html body.mundo.mundo-quarto #vv-hoje.vv-hoje{display:block;left:var(--vv-palco-esq)!important'));
  assert.ok(css.includes('html body.mundo.mundo-quarto #vv-agenda.vv-agenda{display:block!important'));
  assert.ok(css.includes('#mundo-andar .vq-dock{position:absolute;left:50%;bottom:'));
  assert.ok(css.includes('.vq-dock .vq-voltar .vq-icone{background:linear-gradient(180deg,#3A3631,#1F1D1A)'));
  assert.ok(css.includes('@media (prefers-reduced-motion:reduce){.vq-dock .vq-item{transition:none}'));
});

test('responsivo: o dock mede o palco e mostra só as salas que cabem; o resto vai para "+N salas"', () => {
  const h = dock({ online: [{ id: '2', nome: 'A B', zona: 'recepcao' }, { id: '3', nome: 'C D', zona: 'producao' }, { id: '4', nome: 'E F', zona: 'cafe' }] });
  assert.ok(h.includes('<span class="vq-rotulo">Salas</span>'), 'tudo cabe');
  const ini = js.indexOf('  function dockSalasHtml('), fim = js.indexOf('  async function abrirMinhaSala(');
  const ctx = { escritorio: { conectado: true, zona: 'sala-1', base: { eu: '1' }, online: [{ id: '2', nome: 'A B', zona: 'recepcao' }, { id: '3', nome: 'C D', zona: 'producao' }, { id: '4', nome: 'E F', zona: 'cafe' }] },
    zonas3d: () => ({}), minhaSalaDaConta: () => 'sala-1', fn: () => null, esc: String, svg: (d) => d, Set, Map, String, Math };
  vm.createContext(ctx); vm.runInContext(js.slice(ini, fim), ctx);
  const apertado = ctx.dockSalasHtml('sala-1', 2);
  assert.equal([...apertado.matchAll(/data-vq-sala=/g)].length, 2);
  assert.ok(apertado.includes('<span class="vq-rotulo">+2 salas</span>'));
  assert.ok(js.includes('cabem = palco ? Math.floor((palco.clientWidth'), 'mede o palco');
  assert.ok(css.includes('@media (min-width:1360px){\n  html body.mundo.mundo-quarto #vv-agenda.vv-agenda'), 'Agenda ao lado só com espaço');
});
