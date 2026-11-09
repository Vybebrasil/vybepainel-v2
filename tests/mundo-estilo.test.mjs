import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { ESTILO, luzDoEstilo, baseDeMaquete } from '../mundo/estilo.mjs';
import { Obra } from '../mundo/voxel.mjs';

test('padrão voxel: mundo, andar, quarto e retratos montam a luz e o renderizador por estilo.mjs', () => {
  for (const f of ['motor', 'sala', 'quarto', 'avatar']) {
    const s = fs.readFileSync(`mundo/${f}.mjs`, 'utf8');
    assert.match(s, /from '\.\/estilo\.mjs'/, `${f} usa o estilo`);
    assert.match(s, /prepararRenderer\(/, `${f} usa o acabamento do estilo`);
    assert.doesNotMatch(s, /new THREE\.HemisphereLight\(/, `${f} não cria luz própria`);
  }
});

test('padrão voxel: quatro luzes; dentro, a noite só esquenta (nunca escurece de verdade); fora, vira luar', () => {
  const dentro = luzDoEstilo(new THREE.Scene(), { interior: true, raio: 10, sombra: { mapa: 512 } });
  assert.ok(dentro.sol.castShadow); assert.ok(dentro.contorno.intensity > 0);
  dentro.hora(1); assert.ok(dentro.hemi.intensity >= ESTILO.interior.hemi * .85 && dentro.sol.intensity >= ESTILO.interior.forca * .75);
  const fora = luzDoEstilo(new THREE.Scene(), { raio: 100 });
  fora.hora(1); assert.ok(fora.sol.intensity < ESTILO.dia.forca * .5);
  fora.hora(0); assert.equal(fora.sol.intensity, ESTILO.dia.forca);
});

test('base de maquete: só embaixo do chão, com as camadas na borda', () => {
  const o = new Obra(), so = new Set(['0,0', '1,0']);
  baseDeMaquete(o, { W: 3, D: 3, ladrilhos: (x, z) => so.has(`${x},${z}`) });
  assert.ok(o.solidos.length >= 6);
  for (const b of o.solidos) assert.ok(b.x > -.2 && b.x < 2.2 && b.z > -.2 && b.z < 1.2, 'nenhum bloco fora do chão');
  for (const cor of ESTILO.base) assert.ok(o.solidos.some((b) => b.cor === cor));
});
