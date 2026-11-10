import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import * as estilo from '../mundo/estilo.mjs';

// Executa o passo real com WebGL/RAF simulados: prova quando há desenho sem depender de GPU.
function motorIsolado() {
  let tempo = 0, renders = 0, i = 0;
  const frames = new Map(), timers = new Map(), observadores = [];
  class Renderer {
    shadowMap = {}; info = { render: { calls: 0, triangles: 0 }, reset() {} }; renderLists = { dispose() {} };
    setPixelRatio() {} setSize() {} getPixelRatio() { return 1; } dispose() {}
  }
  class Composer { passes = []; constructor() {} addPass(p) { this.passes.push(p); } setSize() {} render() { renders++; } dispose() {} }
  class Pass { uniforms = { h: { value: 0 }, v: { value: 0 }, r: { value: 0 } }; dispose() {} }
  class Observer { constructor(fn) { this.fn = fn; observadores.push(this); } observe() {} disconnect() {} }
  const janela = new EventTarget(); janela.devicePixelRatio = 1;
  const doc = new EventTarget(); doc.hidden = false;
  doc.createElement = () => ({ className: '', appendChild() {}, remove() {} });
  const canvas = new EventTarget(); canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 });
  canvas.parentElement = { appendChild() {} }; canvas.style = {};
  // O acabamento de maquete (estilo.mjs) também é simulado: cada desenho dele conta como um quadro.
  const acabamentoDeMaquete = () => ({ render() { renders++; }, tamanho() {}, oclusao() {}, raioOclusao() {}, destruir() {} });
  const ctx = { ...estilo, acabamentoDeMaquete, THREE: { ...THREE, WebGLRenderer: Renderer }, EffectComposer: Composer, RenderPass: Pass, ShaderPass: Pass, OutputPass: Pass,
    HorizontalTiltShiftShader: {}, VerticalTiltShiftShader: {}, AbortController, document: doc, window: janela,
    IntersectionObserver: Observer, ResizeObserver: Observer, performance: { now: () => tempo },
    requestAnimationFrame: fn => { frames.set(++i, fn); return i; }, cancelAnimationFrame: id => frames.delete(id),
    setTimeout: fn => { timers.set(++i, fn); return i; }, clearTimeout: id => timers.delete(id),
  };
  const fonte = fs.readFileSync('mundo/motor.mjs', 'utf8').replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '');
  const { criarMotor } = vm.runInNewContext(fonte + '\n;({ criarMotor });', ctx);
  const motor = criarMotor(canvas);
  const rodar = (fila, ms) => { tempo += ms; const [id, fn] = fila.entries().next().value; fila.delete(id); fn(tempo); };
  const esvaziar = () => { let n = 0; while (frames.size && n++ < 1500) rodar(frames, 34); assert.ok(n < 1500, 'a câmera precisa chegar ao repouso'); };
  return { motor, doc, canvas, frames, timers, observadores, esvaziar, janela, tick: () => rodar(timers, 500), renderizados: () => renders,
    rodar: (ms) => rodar(frames, ms), avancar: (ms) => { tempo += ms; } };
}

test('passo real: repouso não redesenha; animação, câmera, resize e invalidação voltam a desenhar', () => {
  const h = motorIsolado(); h.esvaziar(); const inicial = h.renderizados(); assert.ok(inicial > 0);
  h.tick(); h.tick(); assert.equal(h.renderizados(), inicial);
  h.motor.pausar(false); assert.equal(h.renderizados(), inicial, 'retomar sem pausa não desenha'); h.motor.areaLivre(0, 0, 0); assert.equal(h.frames.size, 0, 'chamadas repetidas não acordam o motor');
  h.motor.zoom(.8); h.esvaziar(); assert.ok(h.renderizados() > inicial);
  let visivel = true; h.motor.animar(() => visivel);
  const [id, fn] = h.frames.entries().next().value; h.frames.delete(id); fn(10000);
  assert.ok(h.frames.size > 0, 'animação visível mantém RAF');
  visivel = false; h.esvaziar(); const parou = h.renderizados(); h.tick(); assert.equal(h.renderizados(), parou);
  h.motor.invalidar(); h.esvaziar(); assert.ok(h.renderizados() > parou);
  const antesResize = h.renderizados(); h.observadores[1].fn(); h.esvaziar(); assert.ok(h.renderizados() > antesResize);
  h.motor.zoom(.9); h.motor.destruir(); h.motor.destruir(); assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
});

test('cidade parada vira foto: enfeite em ritmo constante e, depois de 1 min sem mexer, o mapa para até alguém mexer', () => {
  const h = motorIsolado(); h.esvaziar();
  let quadros = 0; h.motor.animar(() => { quadros++; return true; }); h.motor.zoom(.95);
  // nos primeiros segundos a animação de enfeite segue rodando
  for (let k = 0; k < 40 && h.frames.size; k++) h.rodar(34);
  assert.ok(h.frames.size > 0); const antes = h.renderizados();
  // aos 30 s parado o enfeite ainda anda no mesmo ritmo (sem ir caindo: parecia travar)
  h.avancar(30000); const meio = quadros; for (let k = 0; k < 10 && h.frames.size; k++) h.rodar(34);
  assert.ok(quadros - meio >= 9, 'até 1 min, a animação não desacelera');
  // 61 s sem mexer: o laço para (nenhum quadro pedido) e nada mais é desenhado
  h.avancar(61000); for (let k = 0; k < 5 && h.frames.size; k++) h.rodar(34);
  assert.equal(h.frames.size, 0, 'parado há 1 min, o motor não pede mais quadros');
  const parado = h.renderizados(); h.tick(); assert.equal(h.renderizados(), parado);
  // mexer o mouse na página acorda
  h.janela.dispatchEvent(new Event('pointermove')); assert.ok(h.frames.size > 0, 'mexer acorda o mapa');
  for (let k = 0; k < 3 && h.frames.size; k++) h.rodar(34); assert.ok(h.renderizados() > parado && antes > 0 && quadros > 0);
});
