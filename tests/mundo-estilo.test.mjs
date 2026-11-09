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

test('boneco do Habbo: braço de fora vira pele; manga comprida vira a cor da manga', async () => {
  const { bracosDoBoneco } = await import('../mundo/moveis-habbo.mjs');
  const w = 64, h = 110, pe = 100, pele = '#c68e6a';
  const imagem = (cima, baixo) => {
    const px = new Uint8ClampedArray(w * h * 4);
    const pinta = (y0, y1, cor) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16)); for (let y = y0; y <= y1; y++) for (let x = 12; x < 21; x++) { const i = (y * w + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; } };
    pinta(pe - 44, pe - 37, cima); pinta(pe - 34, pe - 27, baixo);
    return { w, h, px };
  };
  assert.deepEqual(bracosDoBoneco(imagem(pele, pele), pe, pele), { manga: pele, antebraco: pele });
  assert.deepEqual(bracosDoBoneco(imagem('#2255aa', pele), pe, pele), { manga: '#2255aa', antebraco: pele });
  assert.deepEqual(bracosDoBoneco(imagem('#2255aa', '#2255aa'), pe, pele), { manga: '#2255aa', antebraco: '#2255aa' });
});

test('boneco do Habbo: cabelo esculpido entra no lugar do cabelo de blocos; óculos e chapéu vêm da arte', () => {
  const av = fs.readFileSync('mundo/avatar.mjs', 'utf8'), mh = fs.readFileSync('mundo/moveis-habbo.mjs', 'utf8');
  assert.match(av, /f\.cabeloHabbo/); assert.match(av, /ct && !cabeloEsculpido/);
  assert.match(mh, /ACESSORIOS = \/\^\(ha\|he\|fa\|ea\)-\//);
  assert.match(mh, /cabeloHabbo/); assert.match(mh, /casaco: temCasaco/);
});
