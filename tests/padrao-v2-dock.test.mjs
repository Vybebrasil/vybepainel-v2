import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Padrão v2 (12/11/2026), quadro "Barra de baixo": um painel só para áudio, música e TV, ancorado em cima do botão do
// dock, e o dock em pílula com o nome dentro do botão.
const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const esc = ler('vybe-escritorio.js');
const musica = ler('vybe-escritorio-musica.js');
const css = ler('padrao-v2/dock.css');

function painel({ prefs = {}, naPista = false, fila = 0, zona = 'sala-1', tv = '' } = {}) {
  const document = {
    body: { classList: { contains: (c) => c === 'mundo' }, dataset: {} },
    getElementById: (id) => (id === 'office-tv' && tv ? { querySelector: (s) => (s === 'iframe' ? { getAttribute: () => `https://www.youtube-nocookie.com/embed/${tv}?autoplay=1` } : { textContent: 'TV · Deivid passou' }) } : null),
    querySelector: () => null,
  };
  const c = vm.createContext({
    document, console,
    escritorio: { zona, conectado: true, musica: { fila: Array.from({ length: fila }, (_, i) => ({ id: 'f' + i })) } },
    safeText: (s) => String(s).replace(/</g, '&lt;'),
    escritorioLerPrefsAudio: () => prefs,
    escritorioPrefsAudio: () => ({ noiseSupression: true, echoCancellation: true, autoGainControl: false }),
    escritorioNaPista: () => naPista,
    escritorioNomeDaSalaMusica: () => 'Lounge',
  });
  const ini = esc.indexOf('const ESCRITORIO_SOM_ABAS'), fim = esc.indexOf('async function abrirAjustesAudioEscritorio()');
  assert.ok(ini > 0 && fim > ini, 'o bloco do painel Som fica antes dos ajustes de áudio');
  vm.runInContext(esc.slice(ini, fim) + '\nglobalThis.api = { ESCRITORIO_SOM_ABAS, escritorioSomAudioHtml, escritorioSomMusicaHtml, escritorioSomTvHtml, escritorioSomPeHtml, escritorioForcaFiltro, escritorioPainelSomNoMundo };', c);
  return c.api;
}

test('Som tem três abas, na ordem do quadro, e só existe no mundo', () => {
  const p = painel();
  assert.deepEqual(Object.entries(p.ESCRITORIO_SOM_ABAS), [['audio', 'Áudio'], ['musica', 'Música'], ['tv', 'TV']]);
  assert.equal(p.escritorioPainelSomNoMundo(), true);
  assert.match(esc, /<div class="v2k-cab"><h2>Som<\/h2><div class="v2k-seg" role="tablist"/);
  assert.match(esc, /class="v2k-x" onclick="fecharSomEscritorio\(\)" aria-label="Fechar"/);
  assert.doesNotMatch(esc.slice(esc.indexOf('async function abrirSomEscritorio'), esc.indexOf('function alternarPainelSomEscritorio')), /<header|<footer/, 'header e footer herdam regras antigas do tema');
});

test('Áudio: microfone, saída com Testar, filtro em três passos e as outras abas, nessa ordem', () => {
  const html = painel().escritorioSomAudioHtml([], [], {}, null);
  const ordem = ['>Microfone<', 'id="office-nivel-teste"', '>Saída<', '>Testar<', '>Filtro de ruído<', '>Leve<', '>Equilibrado<', '>Forte<', 'Cortou o começo da frase? Diminua. Passa barulho? Aumente.', '>Nas outras abas<', '<b>Música</b>', '<b>TV da sala</b>'];
  let i = -1;
  for (const t of ordem) { const j = html.indexOf(t, i + 1); assert.ok(j > i, 'falta ou está fora de ordem: ' + t); i = j; }
  assert.equal((html.match(/<i style="--h:/g) || []).length, 6, 'medidor com seis barras');
  assert.match(html, /class="v2k-nivel parado"/, 'fora da chamada o medidor fica parado');
  assert.match(html, /Entre numa sala para escolher o microfone e a saída\./);
  assert.match(html, /toca dentro de uma sala com som<\/span><\/p><button type="button" class="v2k-btn s" onclick="irAoLoungePeloSom\(\)">Ir ao Lounge<\/button>/);
  assert.match(html, /<span class="v2k-pill n">desligada<\/span>/);
  assert.doesNotMatch(html, /—/);
});

test('Filtro de ruído: Leve, Equilibrado e Forte são a sensibilidade de sempre; desligado não marca nenhum', () => {
  assert.equal(painel({ prefs: {} }).escritorioForcaFiltro(), 'equilibrado');
  assert.equal(painel({ prefs: { sensibilidade: 2 } }).escritorioForcaFiltro(), 'leve');
  assert.equal(painel({ prefs: { sensibilidade: 9 } }).escritorioForcaFiltro(), 'forte');
  assert.equal(painel({ prefs: { filtro: false, sensibilidade: 9 } }).escritorioForcaFiltro(), '');
  const forte = painel({ prefs: { sensibilidade: 8 } }).escritorioSomAudioHtml([], [], {}, null);
  assert.match(forte, /aria-pressed="false" onclick="mudarForcaFiltroEscritorio\('equilibrado'\)"/);
  assert.match(forte, /aria-pressed="true" onclick="mudarForcaFiltroEscritorio\('forte'\)"/);
  assert.match(painel({ prefs: { filtro: false } }).escritorioSomAudioHtml([], [], {}, null), /O filtro está desligado\. Escolha um nível para ligar\./);
  assert.match(esc, /mudarSensibilidadeAudio\(forca === "leve" \? 3 : forca === "forte" \? 8 : 5\)/);
});

test('nenhum ajuste antigo some: os cinco continuam em Mais ajustes, que abre no lugar', () => {
  const p = painel();
  const html = p.escritorioSomAudioHtml([], [], {}, null);
  const mais = html.slice(html.indexOf('id="office-som-mais"'));
  for (const t of ['Filtro de voz (recomendado)', 'Sensibilidade · ', 'Redução de ruído', 'Cancelamento de eco', 'Ganho automático']) assert.ok(mais.includes(t), t);
  assert.match(mais, /mudarProcessamentoAudio\('ruido',this\.checked\)/);
  assert.match(mais, /oninput="mudarSensibilidadeAudio\(this\.value\)"/);
  assert.match(html, /<div class="v2-abre v2k-mais" aria-expanded="false">/);
  assert.match(p.escritorioSomPeHtml('audio'), /Os ajustes já valem na conversa\.[\s\S]*aria-controls="office-som-mais" onclick="alternarMaisAjustesSom\(this\)">Mais ajustes</);
});

test('Música: fora de sala com som mostra o caminho; na sala, o link e a fila', () => {
  assert.match(painel().escritorioSomMusicaHtml(), /A música toca dentro de uma sala com som\. O Lounge tem\.<\/p><button type="button" class="v2k-btn k" onclick="irAoLoungePeloSom\(\)">Ir ao Lounge</);
  const dentro = painel({ naPista: true, fila: 2 });
  const html = dentro.escritorioSomMusicaHtml();
  assert.match(html, /<b>Lounge<\/b> · quem está na sala ouve junto/);
  assert.match(html, /onsubmit="event\.preventDefault\(\);adicionarMusicaEscritorio\(this\)"/);
  assert.match(html, /id="office-musica-erro"[\s\S]*id="office-musica-fila"/);
  assert.match(dentro.escritorioSomPeHtml('musica'), /controleMusicaEscritorio\('limpar'\)[^<]*">Limpar fila</);
  assert.match(dentro.escritorioSomAudioHtml([], [], {}, null), /2 na fila de Lounge<\/span><\/p><button type="button" class="v2k-btn s" onclick="abrirSomEscritorio\('musica'\)">Abrir a fila</);
  assert.match(musica, /const som = el\.closest\("\.v2k-som"\);/);
  assert.match(musica, /class="v2k-btn s v2k-tira" onclick="controleMusicaEscritorio\('remover','\$\{f\.id\}'\)" aria-label="Tirar da fila">Tirar</);
});

test('TV: desligada ou passando, vídeo do YouTube ou a própria tela, Desligar e Passar no pé', () => {
  const off = painel();
  assert.match(off.escritorioSomTvHtml(), /<span class="v2k-pill n">desligada<\/span>[\s\S]*A TV está desligada[\s\S]*>Vídeo do YouTube<\/button>[\s\S]*compartilharTelaNaTvEscritorio\(\)">Minha tela<\/button>[\s\S]*passarVideoEscritorio\(this\.elements\.url\.value\)/);
  assert.match(off.escritorioSomPeHtml('tv'), /onclick="passarVideoEscritorio\(''\)" disabled>Desligar a TV<[\s\S]*type="submit" form="office-som-tv" class="v2k-btn k s">Passar o vídeo</);
  const on = painel({ tv: 'abcdefghijk' });
  assert.match(on.escritorioSomTvHtml(), /<span class="v2k-pill b">passando<\/span>[\s\S]*vi\/abcdefghijk\/hqdefault\.jpg[\s\S]*Passando agora · posto por Deivid/);
  assert.match(on.escritorioSomPeHtml('tv'), /onclick="passarVideoEscritorio\(''\)" >Desligar a TV</);
  assert.match(painel({ zona: '' }).escritorioSomTvHtml(), /A TV fica dentro de uma sala\./);
});

test('no mundo, Áudio, Música e TV do dock abrem o mesmo painel; fora dele continuam as janelas antigas', () => {
  assert.match(esc, /async function abrirAjustesAudioEscritorio\(\) \{[^}]*?if \(escritorioPainelSomNoMundo\(\)\) return alternarPainelSomEscritorio\("audio"\);/);
  assert.match(esc, /function abrirTvEscritorio\(m\) \{[\s\S]{0,400}?escritorio\.tvAtual = m;[\s\S]{0,200}?if \(escritorioPainelSomNoMundo\(\)\) return alternarPainelSomEscritorio\("tv"\);/);
  assert.match(musica, /function abrirMusicaEscritorio\(\) \{\n[^\n]*\n  if \(typeof escritorioPainelSomNoMundo === "function" && escritorioPainelSomNoMundo\(\)\) return abrirSomEscritorio\("musica"\);/);
  assert.ok(esc.includes('openWorkflowModal(`<div class="workflow-kicker"><span>TV da sala</span>'), 'a janela da TV do Escritório antigo continua');
  assert.ok(musica.includes('d.id = "office-musica-painel";'), 'o diálogo da música do Escritório antigo continua');
  // Abre ancorado no botão e inteiro: o centro do botão e a altura do dock vão por variável; fecha por Esc e clique fora.
  assert.match(esc, /el\.style\.setProperty\("--v2k-x", Math\.round\(rb\.left \+ rb\.width \/ 2\) \+ "px"\)/);
  assert.match(esc, /el\.style\.setProperty\("--v2k-pe", Math\.round\(innerHeight - rd\.top \+ 10\) \+ "px"\)/);
  assert.match(esc, /document\.addEventListener\("pointerdown", el\.somFora, true\);\s*document\.addEventListener\("keydown", el\.somTecla, true\);/);
  assert.match(esc, /document\.body\.dataset\.somAba = aba;/);
  assert.match(esc, /if \(escritorioPainelSom\(\)\?\.dataset\.aba === aba\) \{ fecharSomEscritorio\(\); return Promise\.resolve\(\); \}/);
});

test('fragmento do dock: medidas do quadro, sem !important e sem html body.mundo', () => {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(limpo, /!important/);
  assert.doesNotMatch(limpo, /html body\.mundo/);
  const semTexto = limpo.replace(/"[^"]*"/g, '');
  assert.equal((semTexto.match(/\{/g) || []).length, (semTexto.match(/\}/g) || []).length, 'toda regra fecha');
  // painel: inteiro na tela, em cima do botão
  assert.match(css, /#office-ajustes-audio\.v2k-som\{--v2k-l:360px;position:fixed;[^}]*left:clamp\(12px,calc\(var\(--v2k-x,50vw\) - var\(--v2k-l\) \/ 2\),calc\(100vw - var\(--v2k-l\) - 12px\)\);[^}]*bottom:var\(--v2k-pe,[^}]*border-radius:24px/);
  assert.match(css, /#office-ajustes-audio \.v2k-seg button:is\(\[aria-selected="true"\],\[aria-pressed="true"\]\)\{background:#FFFFFF;color:#1F1D1A/);
  assert.match(css, /#office-ajustes-audio \.v2k-btn\.s\{height:30px;padding:0 12px;font-size:12\.5px\}/);
  assert.match(css, /#office-ajustes-audio \.v2k-btn\.k\{background:#1F1D1A;color:#FFFFFF/);
  // dock: pílula branca, botão 54×48 raio 16, ligado preto, desligado cinza, contador verde
  assert.match(css, /#vv-dock-salas-faixa > \.vq-dock\.vv-dock-salas\{align-items:center;gap:4px;padding:8px;border:0;border-radius:999px;background:#FFFFFF/);
  assert.match(css, /#vv-dock-salas-faixa \.vq-dock \.vq-item\{[^}]*width:auto;min-width:54px;height:48px;padding:0 6px;border:0;border-radius:16px/, 'cresce para caber o nome (Minha sala)');
  assert.match(css, /body\[data-som-aba="tv"\] #vv-dock-salas-faixa \.vq-dock \.vq-item\[data-dock="tv"\]\{background:#1F1D1A;color:#FFFFFF\}/);
  assert.match(css, /body\.ver-voz #vv-dock-salas-faixa \.vq-dock \.vq-item\[data-dock="salas"\]/);
  assert.match(css, /#vv-dock-salas-faixa \.vq-dock \.vq-item:disabled\{opacity:1;color:#6B665E/);
  assert.match(css, /#vv-dock-salas-faixa \.vq-dock \.vq-conta\.on\{background:#11613A\}/);
  assert.match(css, /#vv-dock-salas-faixa \.vq-dock \.vq-voz\{[^}]*height:48px;[^}]*border-radius:999px;background:#F3F1EC/);
  // salas e chat: as mesmas peças
  assert.match(css, /#vv-dock-salas-faixa > \.vv-chamada\{gap:0;padding:0;border:0;border-radius:24px/);
  assert.match(css, /\.vv-conversa \.vv-conversa-msg\.vv-conversa-msg\.meu\{border-radius:16px 16px 4px 16px;background:#1F1D1A;color:#FFFFFF\}/);
  assert.match(css, /\.vv-conversa \.vv-conversa-enviar\.vv-conversa-enviar,[^{]*\{height:30px;padding:0 12px;border-radius:999px;background:#1F1D1A/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\s*#office-ajustes-audio\.v2k-som\{animation:none\}/);
});
