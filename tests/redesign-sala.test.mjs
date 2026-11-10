// Quadro 34 do redesign (Minha sala, 10/11/2026): o Hoje mais estreito com a Agenda dentro, a faixa da sala acima do
// quarto (nome, quem está nela, a voz em texto) e Convidar e Decorar à vista, pelos fluxos que já existem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo.js'), css = ler('vybe-mundo.css');

function faixa({ zona = 'sala-1', minha = 'sala-1', online = [], conectado = true, ezona = 'sala-1', mic = false, podeDecorar = true, convite = true }) {
  const ini = js.indexOf('  function pintarCabDaSala('), fim = js.indexOf('  async function abrirMinhaSala(');
  const cab = { innerHTML: '', vvHtml: '' };
  const window = { VybeDecorar: { podeDecorar: () => podeDecorar, aberto: () => false }, convidarParaMinhaSalaEscritorio: convite ? () => {} : undefined };
  const ctx = { window, escritorio: { conectado, zona: ezona, base: { eu: '1' }, online, vozPausada: false, chamada: { self: { audioEnabled: mic } }, canalChamada: 'c-' + ezona },
    minhaSalaDaConta: () => minha, zonas3d: () => ({ recepcao: { nome: 'Convivência' } }),
    fn: (n) => ({ escritorioCanal: (z) => 'c-' + z, escritorioEstadoVozTexto: () => 'Na conversa da sala', escritorioPessoasFalando: () => new Set(['2']) })[n] || null,
    esc: (s) => String(s), svg: (d) => `<svg>${d}</svg>`, Set, String, Boolean };
  vm.createContext(ctx); vm.runInContext(js.slice(ini, fim), ctx);
  ctx.pintarCabDaSala({ querySelector: () => cab }, zona, { nome: 'Sala do Paulo' });
  return cab.innerHTML;
}

test('faixa da sala: nome, quem está (você primeiro) e a voz dita em texto', () => {
  const h = faixa({ online: [{ id: '2', nome: 'Vinícius L', zona: 'sala-1' }, { id: '1', nome: 'Paulo M', zona: 'sala-1' }, { id: '3', nome: 'Bia', zona: 'recepcao' }] });
  assert.match(h, /<small>Minha sala<\/small><b>Sala do Paulo<\/b>/);
  assert.match(h, /<b>Você e Vinícius<\/b>/, 'só quem está nesta sala, você primeiro');
  assert.match(h, /Voz ligada, você está mudo/);
  assert.match(h, /class=" fala" title="Vinícius L \(falando\)"/, 'quem fala fica marcado');
  assert.ok(faixa({ mic: true }).includes('Voz ligada, microfone aberto'));
  assert.ok(faixa({ ezona: 'recepcao' }).includes('Sua voz está em Convivência'));
  assert.ok(faixa({ conectado: false }).includes('Voz desligada: entre pelo microfone do dock'));
  assert.ok(faixa({ conectado: false }).includes('Ninguém na sala agora'));
});

test('Convidar só na própria sala e Decorar só para quem pode, pelos fluxos que já existem', () => {
  assert.ok(faixa({}).includes('data-quarto-acao="convidar"'));
  assert.ok(faixa({}).includes('data-quarto-acao="decorar"'));
  const visitando = faixa({ zona: 'sala-2', minha: 'sala-1', podeDecorar: false });
  assert.ok(visitando.includes('<small>Visitando</small>'));
  assert.ok(!visitando.includes('data-quarto-acao'), 'na sala dos outros, sem Convidar nem Decorar');
  assert.ok(js.includes("else if (b.dataset.quartoAcao === 'convidar') fn('convidarParaMinhaSalaEscritorio')?.();"), 'o convite do Escritório, não outro');
  assert.ok(js.includes("if (a === 'decorar') { alternarDecorar(); return; }"), 'o dock continua com o Decorar, pela mesma função');
  assert.ok(!/function convidar(?!ParaMinhaSala)/.test(js), 'nenhum convite novo no mundo');
});

test('a faixa fica acima do quarto (o palco desce), e o Hoje leva a Agenda na sala', () => {
  assert.ok(js.includes('<div class="vv-ilha quarto-cab"'), 'div, não header (o header global do legado empilharia)');
  assert.ok(css.includes('#mundo-andar.quarto .andar-palco{top:calc(var(--vv-palco-topo,0px) + var(--vq-cab,52px) + 8px)}'), 'nada por cima do quarto');
  assert.ok(css.includes('body.mundo.mundo-quarto{--vq-esq:clamp(272px,22vw,320px)'), 'Hoje mais estreito');
  assert.ok(!css.includes('--vq-dir'), 'sem a coluna da Agenda à direita');
  assert.ok(js.includes('function pintarHoje() { desenharHoje(); agendaNoHoje(); }'));
  assert.match(js, /function agendaNoHoje\(\) \{[\s\S]*?if \(!body\.classList\.contains\('mundo-quarto'\)[\s\S]*?sec\?\.remove\(\); return; \}/, 'fora da sala o Hoje não muda');
  assert.ok(js.includes('el.innerHTML = agendaListaHtml(centroAberto ? 3 : 6);'), 'a gaveta e o Hoje usam a mesma lista');
  const novoCss = css.slice(css.indexOf('/* Quadro 34 do redesign'));
  const bloco = novoCss.slice(novoCss.indexOf('@media (max-width:900px){html body.mundo.mundo-quarto #vv-hoje{display:none}}'), novoCss.indexOf('/* Dock de baixo da sala'));
  assert.ok(!bloco.includes('!important'), 'CSS novo sem !important');
});
