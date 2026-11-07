// SAFE: relógio injetado, agendadores falsos e recursos em memória, sem rede ou banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import { relogioBahia, priorizarCaptacoes, faseDaVan, horarioDaCaptacao } from '../mundo/captacoes.mjs';
import { criarAgendadorQuadros, liberarCena } from '../mundo/motor.mjs';
import { precisaoDoPino } from '../mundo/clientes.mjs';
import * as THREE from 'three';

test('vans usam America/Bahia inclusive na virada de dia, independente do TZ do processo', () => {
  assert.deepEqual(relogioBahia(new Date('2026-11-07T02:59:00Z')), { dia: '2026-11-06', minutos: 1439 });
  assert.deepEqual(relogioBahia(new Date('2026-11-07T03:00:00Z')), { dia: '2026-11-07', minutos: 0 });
  const v = { ...horarioDaCaptacao({ inicio: '09:00', fim: '10:00' }), total: 100, dia: '2026-11-07' };
  const fase = (iso) => faseDaVan(v, 0, relogioBahia(new Date(iso)));
  assert.equal(fase('2026-11-07T11:00:00Z').fase, 'espera');
  assert.equal(fase('2026-11-07T11:45:00Z').d, 50);
  assert.equal(fase('2026-11-07T12:30:00Z').fase, 'gravando');
  assert.equal(fase('2026-11-07T12:30:00Z').d, 100);
  assert.equal(fase('2026-11-07T13:15:00Z').fase, 'voltando');
  assert.equal(fase('2026-11-07T13:30:00Z').fase, 'feita');
  assert.equal(fase('2026-11-08T12:00:00Z').fase, 'feita');
});

test('mais de seis captações: em andamento vêm antes das próximas, sem mutar a agenda', () => {
  const lista = Array.from({ length: 8 }, (_, i) => ({ cliente: String(i), dia: '2026-11-07', inicio: `${String(i + 7).padStart(2, '0')}:00`, fim: `${String(i + 8).padStart(2, '0')}:00` }));
  lista.push({ cliente: 'outro dia', dia: '2026-11-08', inicio: '13:00', fim: '15:00' });
  const copia = structuredClone(lista);
  assert.deepEqual(priorizarCaptacoes(lista, { dia: '2026-11-07', minutos: 13 * 60 + 30 }).slice(0, 2).map(c => c.cliente), ['6', '7']);
  assert.deepEqual(lista, copia);
  assert.ok(!priorizarCaptacoes(lista, { dia: '2026-11-07', minutos: 810 }).some(c => c.cliente === 'outro dia'));
});

test('fim ausente, horários inválidos e captação atravessando meia-noite', () => {
  assert.deepEqual(horarioDaCaptacao({ inicio: '09:00' }), { ini: 540, fim: 600 });
  assert.deepEqual(horarioDaCaptacao({ inicio: '25:00' }), { ini: null, fim: null });
  assert.deepEqual(horarioDaCaptacao({ inicio: '23:30', fim: '00:30' }), { ini: 1410, fim: 1470 });
  const v = { ...horarioDaCaptacao({ inicio: '23:30', fim: '00:30' }), dia: '2026-11-07', total: 60 };
  assert.equal(faseDaVan(v, 0, { dia: '2026-11-08', minutos: 15 }).fase, 'gravando');
});

function agendaFalsa(passo) {
  let id = 0; const frames = new Map(), timers = new Map(), cancelados = [];
  const ciclo = criarAgendadorQuadros(passo, {
    frame: f => { frames.set(++id, f); return id; }, cancelarFrame: i => { cancelados.push(i); frames.delete(i); },
    timer: f => { timers.set(++id, f); return id; }, cancelarTimer: i => timers.delete(i), agora: () => 1000,
  });
  const executar = (fila) => { const [k, fn] = fila.entries().next().value; fila.delete(k); fn(1000); };
  return { ciclo, frames, timers, cancelados, quadro: () => executar(frames), relogio: () => executar(timers) };
}

test('em repouso não agenda RAF; gesto volta a agendar; destruir cancela RAF e relógio', () => {
  let ativo = false, chamadas = 0;
  const a = agendaFalsa(() => { chamadas++; return ativo; });
  a.ciclo.acordar(); a.quadro();
  assert.equal(a.frames.size, 0); assert.equal(a.timers.size, 1);
  a.relogio(); assert.equal(a.frames.size, 0); assert.equal(chamadas, 2);
  ativo = true; a.ciclo.acordar(); assert.equal(a.timers.size, 0); a.quadro(); assert.equal(a.frames.size, 1);
  const pendente = [...a.frames.values()][0];
  a.ciclo.destruir(); pendente(); a.ciclo.acordar();
  assert.equal(a.frames.size, 0); assert.equal(a.timers.size, 0); assert.equal(chamadas, 3);
  const b = agendaFalsa(() => false); b.ciclo.acordar(); b.quadro(); b.ciclo.destruir(); assert.equal(b.timers.size, 0);
});

test('descarte libera geometria/material/texturas compartilhadas e sombras uma única vez', () => {
  const cena = new THREE.Scene(), geometria = new THREE.BoxGeometry(), textura = new THREE.Texture();
  const material = new THREE.ShaderMaterial({ uniforms: { mapa: { value: textura } } });
  cena.background = cena.environment = textura;
  cena.add(new THREE.Mesh(geometria, material), new THREE.Mesh(geometria, material));
  const luz = new THREE.DirectionalLight(); cena.add(luz);
  const contagem = { geometria: 0, material: 0, textura: 0, sombra: 0 };
  geometria.addEventListener('dispose', () => contagem.geometria++);
  material.addEventListener('dispose', () => contagem.material++);
  textura.addEventListener('dispose', () => contagem.textura++);
  luz.shadow.dispose = () => contagem.sombra++;
  liberarCena(cena);
  assert.deepEqual(contagem, { geometria: 1, material: 1, textura: 1, sombra: 1 });
  assert.equal(cena.children.length, 0);
});

test('pinos distinguem confirmação, estimativa por número e aproximação por bairro', () => {
  assert.equal(precisaoDoPino('confirmada')[1], 'Confirmada');
  assert.match(precisaoDoPino('confirmada')[2], /Google Maps/);
  assert.match(precisaoDoPino('numero')[2], /número na rua/);
  assert.match(precisaoDoPino('bairro')[2], /aproximada pelo bairro/);
  assert.equal(precisaoDoPino('sem')[1], 'Sem local');
});


test('invalidação durante o quadro não deixa relógio paralelo nem reagenda depois de destruir', () => {
  let a, primeira = true;
  a = agendaFalsa(() => { if (primeira) { primeira = false; a.ciclo.acordar(); } return false; });
  a.ciclo.acordar(); a.quadro();
  assert.equal(a.frames.size, 1); assert.equal(a.timers.size, 0);
  a.quadro(); assert.equal(a.frames.size, 0); assert.equal(a.timers.size, 1);
  a.ciclo.destruir();
  let b; b = agendaFalsa(() => { b.ciclo.destruir(); return false; });
  b.ciclo.acordar(); b.quadro(); assert.equal(b.timers.size, 0);
});
