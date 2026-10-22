import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const fonte = readFileSync('vybe-escritorio-mapa.js', 'utf8');
// Executa os callbacks reais de saída/carga com relógios controlados, sem
// iniciar mídia, carregar arte remota ou depender do banco.
const saida = fonte.slice(fonte.indexOf('    destruir() {'), fonte.indexOf('\n    },', fonte.indexOf('    destruir() {')) + 7);
const iniciar = fonte.match(/  prontos\.then\((\(\) => \{[^\n]+\})\);/)[1];
function ambiente() {
  const intervalos = [], quadros = [], tempos = [];
  let removido = 0, desconectado = 0;
  const c = vm.createContext({
    destruido: false, relogio: 3, setaRelogio: 1, relogioConversa: 2,
    relogioCeu: 4, relogioAgentes: 5, relogioFalas: 6, relogioPasseio: 7,
    quadroCam: 8, etiquetasQuadro: 9, quadroPassar: 10,
    timerPassar: 14,
    pessoas: new Map([['eu', { passo: 11, parar: 12 }]]),
    noMapa: [{ p: { passo: 13 } }],
    tamanhoQuarto: { disconnect() { desconectado++; } },
    el: { replaceChildren() { removido++; } },
    clearInterval: id => intervalos.push(id),
    cancelAnimationFrame: id => quadros.push(id),
    clearTimeout: id => tempos.push(id),
    setInterval: () => { intervalos.push('novo'); return 20; },
    animar() {}, reduzido: false,
  });
  vm.runInContext(`globalThis.mapa = ({${saida}}); globalThis.cargaTerminou = ${iniciar}`, c);
  return { c, intervalos, quadros, tempos, removido: () => removido, desconectado: () => desconectado };
}
test('sair cancela relógios da cena, visitantes, hover e movimentos pendentes', () => {
  const a = ambiente();
  a.c.mapa.destruir();
  assert.deepEqual(a.intervalos, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(a.quadros, [8, 9, 10, 11, 13]);
  assert.deepEqual(a.tempos, [14, 12]);
  assert.equal(a.removido(), 1);
  assert.equal(a.desconectado(), 1);
});
test('arte que termina após sair não reinicia a animação da cena antiga', async () => {
  const a = ambiente();
  const carga = Promise.resolve().then(a.c.cargaTerminou);
  a.c.mapa.destruir();
  await carga;
  assert.ok(!a.intervalos.includes('novo'));
});
test('cena ativa continua iniciando a animação quando a arte fica pronta', () => {
  const a = ambiente();
  a.c.cargaTerminou();
  assert.deepEqual(a.intervalos, ['novo']);
});
