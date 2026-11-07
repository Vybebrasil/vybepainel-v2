// SAFE: só lê os arquivos do painel e roda a função do mapa sem desenho em memória, sem rede, banco ou WhatsApp.
// Paulo, 07/11/2026: "não já mandei tirar o que tava escondido do modo legado que tivesse rodando por trás?".
// No Irecity o Escritório antigo não monta mais o quarto do Habbo escondido: só salas, presença, voz e música.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../vybe-mundo.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../vybe-mundo.css', import.meta.url), 'utf8');

// Tira a função de dentro do vybe-mundo.js (do "function nome(" até o "}" no mesmo recuo).
function funcao(nome) {
  const ini = js.indexOf(`  function ${nome}(`);
  assert.ok(ini >= 0, `${nome} existe`);
  const fim = js.indexOf('\n  }\n', ini);
  return new Function(`${js.slice(ini, fim + 4)}; return ${nome};`)();
}

const SOM = /jukebox|^hc25_6$|^hc_radio$|gramophone|recordplayer|turntable/;

test('mapa sem desenho: acha os móveis da sala pelos dados do servidor (a vitrola da música)', async () => {
  const mapaSemDesenho = funcao('mapaSemDesenho');
  const planta = { moveis: [['computer_flatscreen', 3.25, 1, 4, 1, 0.95, { camada: 'sala-0', i: 0 }], ['disco_c26_jukebox', 7, 0.5, 2, 0, 0, { camada: 'sala-0', i: 53 }]], fixos: [] };
  const mapa = mapaSemDesenho(planta);
  assert.equal(mapa.semDesenho, true);
  assert.equal(mapa.moveisDaClasse(SOM).length, 1);
  assert.equal(mapa.moveisDaClasse(SOM)[0].origem.i, 53);
  assert.equal(mapaSemDesenho({ moveis: [['computer_flatscreen', 1, 1, 2]] }).moveisDaClasse(SOM).length, 0);
  // A mesma chave do mapa desenhado (classe@x,y), para os estados dos móveis baterem.
  assert.equal(mapa.chaveMovel(mapa.moveisDaClasse(SOM)[0]), 'disco_c26_jukebox@7,0');
  assert.equal(mapa.moveisPerto(3, 1, 0).length, 1);
  mapa.acrescentarMovel(['hc_radio', 2, 2, 0]);
  assert.equal(mapa.moveisDaClasse(SOM).length, 2);
  await mapa.prontos;
});

test('mapa sem desenho: qualquer outro pedido do motor não faz nada e não trava um await', async () => {
  const mapa = funcao('mapaSemDesenho')({});
  assert.equal(mapa.atualizarPessoas([{ id: 1 }]), undefined);
  assert.equal(mapa.balao(1, 'oi'), undefined);
  assert.equal(mapa.then, undefined);
  assert.equal(await Promise.race([Promise.resolve(mapa).then(() => 'ok'), new Promise((r) => setTimeout(() => r('travou'), 200))]), 'ok');
  assert.deepEqual(mapa.moveisEm(1, 1), []);
  assert.equal(mapa.caminho({ x: 0, y: 0 }, { x: 1, y: 1 }), null);
  assert.equal(mapa.bloqueadoEm(1, 1), false);
  assert.deepEqual(mapa.tela(1, 1), { x: -9999, y: -9999 });
});

test('Irecity: o quarto do Habbo só é montado para jogo; o resto do Escritório roda sem desenho', () => {
  assert.match(js, /window\.criarMapaEscritorio = function \(el, opcoes, \.\.\.r\)/);
  assert.match(js, /if \(ligado && !querQuarto && el\?\.closest\?\.\('#painel-escritorio'\)\) return mapaSemDesenho\(opcoes\?\.planta\);/);
  assert.match(js, /const querQuarto = jogandoAgora \|\| \(quartoRealNosJogos && e\?\.quarto === 'jogos'\);/);
  // O jogo pede o quarto real antes de ir à sala Jogos (a mesa vem dele).
  const jogo = js.slice(js.indexOf('async function abrirJogo('), js.indexOf("irParaSalaEscritorio('jogos');"));
  assert.match(jogo, /quartoRealNosJogos = true;/);
});

test('Irecity: o player da música é janela própria; a tela escondida do Escritório não sobe sobre o mapa', () => {
  assert.match(js, /window\.escritorioElementoMusica = function/);
  assert.match(js, /el\.classList\.add\('vv-musica-janela'\); document\.body\.append\(el\);/);
  assert.match(js, /if \(redesenhandoEscritorio\) \{ const marca = document\.createElement\('span'\); marca\.hidden = true; return marca; \}/);
  assert.match(css, /#painel-escritorio\{visibility:hidden!important;pointer-events:none!important\}/);
  assert.doesNotMatch(css, /#painel-escritorio\{z-index:632/);
  assert.doesNotMatch(css, /#painel-escritorio #office-musica/);
  assert.match(css, /body\.mundo #office-musica\.vv-musica-janela\{position:fixed!important/);
  // Sobe junto com a barra de voz (que pode ir para duas linhas): nada cobre a barra.
  assert.match(css, /var\(--vv-voz-alto,64px\) \+ 12px\)!important;z-index:640/);
});

test('Ir até: entrar na sala de alguém entra na conversa dela com o microfone pedido', () => {
  const ir = js.slice(js.indexOf('  function irParaSala(zona) {'), js.indexOf('  window.vybesIrParaSala = irParaSala;'));
  assert.match(ir, /e\.microfoneQuer = true;/);
  assert.match(ir, /escritorioConversaAutomatica/);
  assert.match(ir, /escritorioSincronizarVoz/);
  // O desvio da ida ao quarto usa o movimento original (sem chamar a si mesmo).
  assert.match(js, /moverParaSala\.original = irOriginal;/);
});
