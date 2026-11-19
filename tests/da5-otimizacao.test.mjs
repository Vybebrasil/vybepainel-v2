// Frente da-5 do confere de diretor de arte (19/11/2026): o que roda à toa com a tela parada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { criarAgendadorQuadros, QUADRO_MIN_MS } from '../mundo/motor.mjs';

const ler = (f) => fs.readFileSync(f, 'utf8');

test('quadro de enfeite espera num relógio, sem pedir RAF a cada volta da tela', () => {
  const frames = new Map(), timers = new Map(); let id = 0; const esperas = [];
  let resposta = 20, chamadas = 0;
  const ciclo = criarAgendadorQuadros(() => { chamadas++; return resposta; }, {
    frame: (f) => { frames.set(++id, f); return id; }, cancelarFrame: (i) => frames.delete(i),
    timer: (f, ms) => { esperas.push(ms); timers.set(++id, f); return id; }, cancelarTimer: (i) => timers.delete(i), agora: () => 0,
  });
  const roda = (fila) => { const [k, fn] = fila.entries().next().value; fila.delete(k); fn(0); };
  ciclo.acordar(); roda(frames);
  // passo pediu "daqui a 20 ms": nenhum RAF na fila, um relógio de 20 ms
  assert.equal(frames.size, 0); assert.deepEqual(esperas, [20]);
  roda(timers); assert.equal(frames.size, 1); assert.equal(chamadas, 1); // o relógio só pede o RAF
  resposta = true; roda(frames); assert.equal(frames.size, 1); // mexendo: quadro a quadro, como antes
  resposta = false; roda(frames); assert.deepEqual(esperas.slice(-1), [500]); // repouso: o relógio de 500 ms de sempre
  // gesto no meio da espera cancela o relógio e volta ao RAF
  resposta = 33; roda(timers); assert.equal(frames.size, 0); assert.equal(timers.size, 1); assert.deepEqual(esperas.slice(-1), [33]);
  ciclo.acordar(); assert.equal(timers.size, 0); assert.equal(frames.size, 1);
  ciclo.destruir(); assert.equal(frames.size, 0);
});

test('mexendo, a cena desenha no máximo 60 quadros por segundo', () => {
  assert.ok(QUADRO_MIN_MS > 1000 / 72 && QUADRO_MIN_MS < 1000 / 60);
  const motor = ler('mundo/motor.mjs');
  assert.match(motor, /if \(interagindo && t - ultimo < QUADRO_MIN_MS\) return true;/);
  // rótulo parado não regrava o transform nem refaz as colisões a cada quadro de enfeite
  assert.match(motor, /if \(tf !== r\.tf\) \{ r\.tf = tf; r\.el\.style\.transform = tf; \}/);
});

test('enfeite infinito anima só transform/opacity e pausa onde ninguém vê', () => {
  const css = ler('padrao-v2/da-5.css');
  assert.match(css, /\.rotulo-vybes i,\.vv-ser i\{[^}]*animation:none/);
  assert.match(css, /@keyframes da5PulsoAnel\{[^}]*opacity[^}]*transform/);
  assert.doesNotMatch(css.match(/@keyframes da5PulsoAnel[^\n]*/)[0], /box-shadow/);
  assert.match(css, /body\.mundo-sobre-escritorio #painel-escritorio \*::after\{animation-play-state:paused\}/);
  // sem var() dentro do @keyframes do anel dos agentes
  for (const k of css.match(/@keyframes da5AnelAgente[^\n]*/g)) assert.doesNotMatch(k, /var\(/);
  assert.ok(!css.includes('!important'));
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('/* ===== padrao-v2/da-5.css ===== */'));
});

test('o dock do Escritório liga uma classe no body em vez de :has([hidden])', () => {
  assert.ok(!ler('vybe-styles.css').includes('body:has(#office-dock:not([hidden]))'));
  assert.equal((ler('vybe-styles.css').match(/body\.com-office-dock:not\(#sem-office-dock\)/g) || []).length, 3);
  assert.match(ler('vybe-escritorio.js'), /dock\.hidden = [^\n]*\n[\s\S]{0,600}classList\.toggle\("com-office-dock", !dock\.hidden\)/);
});

test('logo do cliente nasce com tamanho (não pula o layout)', () => {
  assert.match(ler('vybe-logo-cliente.js'), /const tam = classe \? ' width="28" height="28"' : ' width="64" height="64"';/);
});
