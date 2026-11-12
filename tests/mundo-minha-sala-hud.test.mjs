// Minha sala com os painéis e o dock fixo das salas (Paulo, 09/11/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo.js'), css = ler('vybe-mundo.css');

function dock({ online, zona = 'sala-1', minha = 'sala-1', aberta = '', mic = false, outros = [], cabem = Infinity, quartos = ['sala-1', 'sala-2'] }) {
  const ini = js.indexOf('  function dockSalasHtml('), fim = js.indexOf('  const faixaDock = ');
  const ctx = { escritorio: { conectado: true, zona, base: { eu: '1' }, online, vozPausada: false, chamada: { self: { audioEnabled: mic } }, canalChamada: 'c-' + zona },
    andarAbertoId: aberta ? 'quarto:' + aberta : '', body: { classList: { contains: () => false } },
    zonas3d: () => ({ recepcao: { nome: 'Convivência' }, producao: { nome: 'Produção' } }), minhaSalaDaConta: () => minha,
    quartoDaSala: (z) => (quartos.includes(z) ? { id: z } : null),
    fn: (n) => ({ escritorioPessoasFalando: () => new Set(), escritorioCanal: (z) => 'c-' + z, escritorioNaPista: () => true,
      escritorioOutrosNaChamada: () => outros, escritorioAmbienteDoQuarto: (z) => ({ nome: z === 'sala-1' ? 'Sala do Paulo' : 'Sala da Bia' }) })[n] || null,
    esc: (s) => String(s), svg: (d) => `<svg>${d}</svg>`, IC: { mic: 'MIC', micOff: 'MICOFF', musica: 'MUS', sair: 'SAIR' }, n0: (v) => String(v), window: {}, Set, Map, String, Math };
  vm.createContext(ctx); vm.runInContext(js.slice(ini, fim), ctx);
  return ctx.dockSalasHtml(cabem);
}

// Sem "Sair" (Paulo, 10/11/2026: "não tem como não estar em nenhuma sala").
test('dock fixo: microfone com o estado escrito, Minha sala e Sala atual (ver a sala), salas com gente, Salas, Chat, Música e TV, sem Sair', () => {
  const h = dock({ zona: 'sala-2', online: [{ id: '1', nome: 'Paulo M', zona: 'sala-2' }, { id: '3', nome: 'Bia Souza', zona: 'sala-2' }, { id: '2', nome: 'Vinícius L', zona: 'recepcao' }],
    outros: [{ customParticipantId: '3:x', audioEnabled: false }] });
  const ordem = [...h.matchAll(/data-dock="([a-z-]+)"/g)].map((m) => m[1]);
  assert.equal(ordem.join(','), 'mic,ouvir,camera,tela,audio,ver-minha,ver-atual,salas,chat,musica,tv');
  assert.ok(h.includes('<span class="vq-rotulo">Mudo</span>'), 'mudo escrito');
  assert.ok(h.includes('<span class="vq-rotulo">Sala atual</span>'));
  // Quadro da barra de baixo (moodboard, 12/11/2026): as salas com gente saem do dock (ficam no painel Salas) e a peça da
  // voz diz a sala atual, quantos estão na voz e quem.
  assert.equal([...h.matchAll(/data-vq-sala="([^"]+)"/g)].length, 0, 'trocar de sala é no painel Salas');
  assert.ok(h.includes('<span class="vq-voz">') && h.includes('Sala da Bia · 2 na voz'), 'a peça da voz');
  assert.ok(h.includes('<button type="button" class="dentro" disabled>Dentro</button>'), 'dentro da chamada');
});

test('fora da chamada: o laranja Entrar; dentro de uma sala, o Voltar vem primeiro; sala comum sem visual fica desligada', () => {
  const ini = js.indexOf('  function dockSalasHtml('), fim = js.indexOf('  const faixaDock = ');
  const ctx = { escritorio: { conectado: true, zona: 'recepcao', base: { eu: '1' }, online: [], vozPausada: true, chamada: null }, andarAbertoId: 'quarto:sala-1', body: { classList: { contains: () => false } },
    zonas3d: () => ({ recepcao: { nome: 'Convivência' } }), minhaSalaDaConta: () => 'sala-1', quartoDaSala: () => null,
    fn: (n) => ({ escritorioCanal: (z) => 'c-' + z })[n] || null, esc: String, svg: (d) => d, IC: { mic: 'MIC', micOff: 'MICOFF', musica: 'MUS', sair: 'SAIR' }, n0: (v) => String(v), window: {}, Set, Map, String, Math };
  vm.createContext(ctx); vm.runInContext(js.slice(ini, fim), ctx);
  const h = ctx.dockSalasHtml(5);
  const ordem = [...h.matchAll(/data-dock="([a-z-]+)"/g)].map((m) => m[1]);
  assert.equal(ordem[0], 'voltar'); assert.equal(ordem[1], 'entrar');
  assert.ok(!ordem.includes('sair'), 'sem Sair fora da chamada');
  assert.ok(/data-dock="ver-atual"[^>]*disabled/.test(h), 'Convivência ainda não tem a sala em voxel');
});

test('cliques do dock: sala com gente troca só a voz; Minha sala e Sala atual abrem a sala; o topo ficou sem a voz', () => {
  assert.ok(js.includes("if (b.dataset.vqSala) { irParaSala(b.dataset.vqSala); return; }"));
  assert.ok(js.includes("if (a === 'ver-atual') { if (e?.zona) abrirMinhaSala(e.zona); return; }"));
  assert.ok(js.includes("if (a === 'chat') { window.VybeConversa?.abrir?.('conversa'); return; }"));
  assert.ok(!/data-ferr="(voz|mic|musica)"\s/.test(js.slice(js.indexOf('vv-busca-larga'), js.indexOf('data-ferr="conta"'))), 'voz, microfone e música saíram do topo');
  const topo = js.slice(js.indexOf('data-ferr="agenda" aria-expanded'), js.indexOf('data-ferr="conta"'));
  assert.deepEqual([...topo.matchAll(/data-ferr="([a-z]+)"/g)].map((m) => m[1]).slice(0, 2), ['agenda', 'whatsapp'], 'Agenda e depois WhatsApp');
  // Quadro da casca (moodboard, 12/11/2026): Agenda, WhatsApp, Avisos e Conversa ficam à vista; Boletim, Notas, Camadas e Ajuda abrem no "Mais".
  assert.ok(js.includes('<details class="vv-mais-menu">'), 'o que saiu do topo está no Mais');
  assert.deepEqual([...topo.slice(topo.indexOf('<div class="vv-mais-lista">')).matchAll(/data-ferr="([a-z]+)"/g)].map((m) => m[1]), ['notas', 'camadas', 'ajuda']);
  assert.ok(js.includes('faixaDock.append?.(barra);'), 'a barra das salas abre em cima do dock');
});

test('CSS: Hoje e Agenda dos lados na sala, dock fixo pequeno, nada por cima do conteúdo', () => {
  assert.ok(!css.includes('body.mundo-quarto #vv-hoje{display:none}'));
  assert.ok(!css.includes('html body.mundo.mundo-quarto #vv-agenda.vv-agenda{display:block!important'), 'quadro 34: a Agenda entra no Hoje, sem a gaveta da direita');
  assert.ok(css.includes('.vv-dock-salas-faixa{position:fixed;z-index:645;'));
  assert.ok(css.includes('html body.mundo.com-dock-salas:not(.mundo-quarto):not(.mundo-modulo) #vv-hoje.vv-hoje{bottom:calc(var(--vv-m,14px) + var(--vv-dock-alto,74px) + 6px + var(--vv-pe-barra,0px))!important}'), 'o Hoje termina acima do dock');
  assert.ok(css.includes('.vq-dock .vq-icone{position:relative;display:grid;place-items:center;width:38px;height:38px;'), 'dock menor');
  assert.ok(js.includes('hDock = faixaDock.hidden ? 0 : alto(faixaDock.firstElementChild)'), 'a Agenda termina acima do dock');
  assert.ok(css.includes('@media (prefers-reduced-motion:reduce){.vq-dock .vq-item{transition:none}'));
});

test('Música do dock: abre o player da sala (também dentro da sala e dos módulos), ou a janela de pôr um link com a fila vazia', () => {
  // Desde a fase 3b (10/11/2026) a mesma ordem em linhas, com o caminho para o Lounge fora de uma sala com som.
  assert.match(js, /if \(body\.classList\.contains\('musica-aberta'\)\) abrirMusica\(false\);\s*else if \(pl && !pl\.hidden\) abrirMusica\(true\);[\s\S]{0,400}?else fn\('abrirMusicaEscritorio'\)\?\.\(\);/);
  assert.ok(css.includes('html body.mundo.musica-aberta #office-musica.vv-musica-janela{visibility:visible!important;pointer-events:auto!important}'), 'antes ficava escondido na sala e nos módulos');
  assert.ok(css.includes('#office-musica.vv-musica-janela:not(.movida){top:auto!important;bottom:calc(var(--vv-m,14px) + var(--vv-dock-alto,74px) + 10px)!important'), 'em cima do dock');
});

test('vendo um quarto, trocar de sala leva a vista junto (Paulo, 09/11/2026: "não era pra visualmente eu ir pra lá também?")', () => {
  const src = readFileSync('vybe-mundo.js', 'utf8').replace(/\r\n/g, '\n');
  const ir = src.slice(src.indexOf('  function irParaSala(zona) {'), src.indexOf('  window.vybesIrParaSala = irParaSala;'));
  assert.match(ir, /const vendo = String\(andarAbertoId \|\| ''\)\.startsWith\('quarto:'\) \? andarAbertoId\.slice\(7\) : '';/);
  assert.match(ir, /if \(vendo && vendo !== zona && quartoDaSala\(zona\) && !window\.VybeDecorar\?\.aberto\?\.\(\)\) \{ abrirMinhaSala\(zona\); return; \}/);
  assert.ok(ir.indexOf('abrirMinhaSala(zona)') < ir.indexOf('moverParaSala(zona)'), 'decide a vista antes de mover só a voz');
});
