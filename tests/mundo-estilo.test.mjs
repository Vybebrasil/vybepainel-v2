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

test('motor de móveis: reconhece o tipo pelo nome e pela ficha e monta dentro da pegada, na grade fina', async () => {
  const m = await import('../mundo/moveis-voxel.mjs');
  assert.equal(m.tipoModelado('exe_chair2'), 'cadeira');
  assert.equal(m.tipoModelado('xmas11_luxsofa2'), 'sofa');
  assert.equal(m.tipoModelado('bling15_pooltable'), 'sinuca');
  assert.equal(m.tipoModelado('hygge_c18_shelf'), 'estante');
  assert.equal(m.tipoModelado('qualquer_coisa', { deita: true }), 'cama');
  assert.equal(m.tipoModelado('thai_c21_woodenstatue'), null, 'estátua fica esculpida');
  const cores = m.coresDaPaleta(['#1f1d1a', '#3a8fd0', '#f2c230', '#e5484d']);
  assert.equal(cores.principal, '#3a8fd0', 'contorno escuro não vira a cor principal');
  for (const t of m.TIPOS_MODELADOS) for (const [w, d] of [[1, 1], [2, 1], [2, 3]]) {
    const o = m.montarMovel(t, { w, d, cores, classe: t });
    assert.ok(o.solidos.length > 3, t);
    for (const b of [...o.solidos, ...o.luzes]) {
      assert.ok(Math.abs(b.x) <= w / 2 + 1e-6 && Math.abs(b.z) <= d / 2 + 1e-6, `${t} ${w}×${d}: bloco fora da pegada`);
      assert.ok(Math.abs(b.w * 64 - Math.round(b.w * 64)) < .3, `${t}: fora da grade fina (1/64)`);
    }
  }
});

test('quadro 34: objetos pequenos, peça sem receita e peças de parede saem do motor, nunca da arte esculpida', async () => {
  const m = await import('../mundo/moveis-voxel.mjs');
  for (const [classe, tipo] of [['exe_globe', 'globo'], ['exe_c15_telephone', 'telefone'], ['exe_c15_printer', 'impressora'], ['ktchn_trash', 'lixeira'], ['ktchn10_tea', 'louca'], ['books_0', 'livros'], ['darkmodern_c20_folder', 'livros']]) assert.equal(m.tipoModelado(classe), tipo, classe);
  // Sem receita própria: o volume liso pelas medidas da arte (faixas do chão ao topo), dentro da pegada.
  const cores = m.coresDaPaleta(['#3a8fd0', '#f2c230', '#e5484d']);
  const perfil = [{ f: .9, cor: '#8a5a3c' }, { f: .5, cor: '#c9774a' }, { f: .5, cor: '#c9774a' }, { f: .3, cor: null }];
  const g = m.montarMovel('generico', { w: 1, d: 2, cores, classe: 'thai_c21_woodenstatue', perfil, altoArte: 1.2 });
  assert.ok(g.solidos.length >= 5);
  assert.ok(Math.max(...g.solidos.map((b) => b.y + b.h)) > 1.1, 'a altura vem da arte');
  for (const b of g.solidos) assert.ok(Math.abs(b.x) + b.w / 2 <= .5 + 1e-3 && Math.abs(b.z) + b.d / 2 <= 1 + 1e-3, 'dentro da pegada');
  assert.ok(m.montarMovel('generico', { w: 1, d: 1, cores, perfil: [{ f: 1, cor: '#c9774a' }], altoArte: .06 }).solidos.every((b) => b.y + b.h < .2), 'peça rasteira vira chapa');
  // Parede: cada tipo tem receita, o resto é painel; tudo cabe no retângulo da arte e não entra na parede.
  for (const [classe, tipo] of [['window_double_default', 'janela'], ['hc_wall_lamp', 'arandela'], ['pixel_clock_black', 'relogio'], ['attic15_painting', 'quadro'], ['wallmirror', 'espelho'], ['flag_portugal', 'bandeira'], ['exe_map', 'mapa'], ['sw_swords', 'painel']]) assert.equal(m.tipoDeParede(classe), tipo, classe);
  for (const t of m.TIPOS_DE_PAREDE) for (const [w, h] of [[.5, .5], [1.5, 1], [1, 2]]) {
    const o = m.montarDeParede(t, { w, h, cores, classe: t });
    assert.ok(o.solidos.length + o.luzes.length >= 4, t);
    for (const b of [...o.solidos, ...o.luzes]) {
      assert.ok(Math.abs(b.x) + b.w / 2 <= w / 2 + .14, `${t}: sai pelo lado`);
      assert.ok(b.y > -.08 && b.y + b.h < h + .2, `${t}: sai por cima ou por baixo`);
      assert.ok(b.z - b.d / 2 > -1e-3 && b.z + b.d / 2 < .45, `${t}: entra na parede ou salta demais`);
    }
  }
  const q = fs.readFileSync('mundo/quarto.mjs', 'utf8');
  assert.match(q, /export async function paredeEmVoxel\(/);
  assert.match(q, /tipoModelado\(classe, ficha, \(await carregarCatalogo\(\)\)\.get\(classe\)\) \|\| 'generico'/);
});

test('biblioteca: os móveis dos quartos modelados um a um entram antes da receita do tipo', async () => {
  const m = await import('../mundo/moveis-voxel.mjs');
  for (const c of ['exe_chair2', 'hygge_c25_tv', 'exe_table', 'xmas11_luxsofa2', 'hc3_stereo', 'skorea_c22_drinksmachine', 'mm_lamp', 'xmas_c22_festivetree2']) {
    assert.ok(m.temModelo(c), c);
    const o = m.montarMovel(null, { w: 2, d: 1, classe: c });
    assert.ok(o && o.solidos.length > 6, c + ' tem detalhe');
  }
  assert.ok(m.temModelo('winter15_iceskater'), 'estátuas também têm modelo próprio');
  assert.equal(m.temModelo('classe_que_nao_existe'), false, 'o que não tem modelo nem tipo continua esculpido');
});

test('lote 2: peças de construção viram bloco na paleta; móveis dos outros quartos têm modelo próprio', async () => {
  const m = await import('../mundo/moveis-voxel.mjs');
  assert.equal(m.tipoModelado('xmas11_woodfloor', null, { nome: 'Piso Madeira', categoria: 'Pisos do acervo' }), 'bloco');
  assert.equal(m.tipoModelado('bc_cylinder_recolorable', null, { nome: 'Cilindro', categoria: 'Blocos e materiais' }), 'bloco');
  const piso = m.montarMovel('bloco', { w: 2, d: 2, classe: 'xmas11_woodfloor' });
  assert.ok(piso.solidos.length > 8, 'piso de madeira com tábuas');
  for (const c of ['vikings_bed', 'bed_armas_two', 'js_exe_sofa', 'xmas11_luxsofa1', 'vikings_indoorstove', 'carpet_polar', 'st_wildwest_barrel', 'cpunk_c15_table', 'hblooza_bbq', 'modern_c17_tv', 'uni_desk']) assert.ok(m.temModelo(c), c);
});

test('motor de móveis: nenhuma peça empata face com outra (o que serrilhava ao mover a câmera)', async () => {
  const m = await import('../mundo/moveis-voxel.mjs');
  for (const t of m.TIPOS_MODELADOS) {
    const b = [...(o => [...o.solidos, ...o.luzes])(m.montarMovel(t, { w: 2, d: 2, classe: t === 'bloco' ? 'xmas11_woodfloor' : t }))];
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      const A = b[i], B = b[j];
      const junto = Math.min(A.x + A.w / 2, B.x + B.w / 2) - Math.max(A.x - A.w / 2, B.x - B.w / 2) > 1e-6 && Math.min(A.z + A.d / 2, B.z + B.d / 2) - Math.max(A.z - A.d / 2, B.z - B.d / 2) > 1e-6;
      assert.ok(!(junto && Math.abs(A.y + A.h - (B.y + B.h)) < 1e-7 && A.cor !== B.cor), `${t}: topos empatados`);
    }
  }
});

test('lote 3: peças especiais dos quartos (estúdio, festa, banho, jogo) têm modelo próprio', async () => {
  const m = await import('../mundo/moveis-voxel.mjs');
  for (const c of ['classic7_djbooth', 'studio_camera', 'scifi_r17_bed', 'val15_hottub', 'CF_250_goldenchessboard', 'xmas_c18_presents', 'virus_r16_turttank', 'mafia_c26_drinkcabinet', 'gaming_c18_setuppro', 'attic15_carpet']) {
    assert.ok(m.temModelo(c), c);
    const o = m.montarMovel(null, { w: 2, d: 2, classe: c });
    assert.ok(o.solidos.length + o.luzes.length > 4, c);
  }
});

test('retratos: o painel troca a foto do Habbo pelo rápido e depois pelo fiel; o quarto usa a mesma figura fiel', () => {
  const av = fs.readFileSync('mundo/avatar.mjs', 'utf8'), q = fs.readFileSync('mundo/quarto.mjs', 'utf8'), vm = fs.readFileSync('vybe-mundo.js', 'utf8');
  assert.match(av, /export async function figuraFiel/); assert.match(av, /export function avatarVoxelFiel/);
  assert.match(q, /figuraFiel\(p\.figura\)/);
  assert.match(vm, /avatarVoxelFiel\?\.\(fig, opcoes\)/);
});

test('vitrine do jogador: com o mundo ligado, a .vb-vitrine é o quarto voxel em modo vitrine, sem boneco solto', () => {
  const vm = fs.readFileSync('vybe-mundo.js', 'utf8'), ve = fs.readFileSync('vybe-escritorio.js', 'utf8'), q = fs.readFileSync('mundo/quarto.mjs', 'utf8'), css = fs.readFileSync('vybe-mundo.css', 'utf8');
  assert.match(vm, /window\.vybeVitrineVoxel = vitrineVoxel/); assert.match(vm, /abrirQuarto\(canvas, \{ quarto, vitrine: true \}\)/);
  assert.match(ve, /window\.vybeVitrineVoxel\(el\)/);
  assert.match(q, /if \(!vitrine\) \{ window\.addEventListener\('keydown'/);
  assert.doesNotMatch(vm + css, /vv-perfil-avatar/, 'a ficha não mostra mais o boneco solto num palco');
});

test('cidade: o motor usa o acabamento de maquete do estilo, sem oclusão nem brilho, com o desfoque por cima', () => {
  const m = fs.readFileSync('mundo/motor.mjs', 'utf8');
  assert.match(m, /acabamentoDeMaquete\(renderer, cena, camera, \{ ao: false, brilho: false, passes: \[tiltH, tiltV\] \}\)/, 'cidade sem oclusão nem brilho (pesavam e estouravam)');
  assert.doesNotMatch(m, /new EffectComposer/, 'sem composer próprio na cidade');
});

test('árvores da cidade: copa em camadas e coqueiro com folhas em arco, dentro de um raio razoável', () => {
  for (const tipo of ['copa', 'coqueiro']) {
    const o = new Obra(); o.arvore(0, 0, 0, { s: 2, tipo });
    assert.ok(o.solidos.length >= 12, tipo + ' tem detalhe');
    for (const b of o.solidos) assert.ok(Math.abs(b.x) < 2.4 && Math.abs(b.z) < 2.4, tipo + ': bloco longe demais do tronco');
  }
});

test('cidade sem travadinhas nem luz pulando: luz igual mexendo e parada, sombra refeita só ao parar e junto com o sol', () => {
  const m = fs.readFileSync('mundo/motor.mjs', 'utf8');
  assert.doesNotMatch(m, /acabamento\.oclusao\(/, 'a luz da cidade não muda entre mexer e parar (fazia a luz pular)');
  assert.match(m, /if \(!sombraPendente \|\| movendo\) return;/, 'mexendo, o mapa de sombra não é refeito (travadinhas)');
  assert.doesNotMatch(m, /passo\.sombra/, 'sem refazer a sombra a cada 12 s');
  assert.match(m, /ultimaSombra = t; aplicarSol\(\); renderer\.shadowMap\.needsUpdate = true/);
  assert.doesNotMatch(m.slice(m.indexOf('function posicionarCamera'), m.indexOf('let solQuer')), /sol\.position\.set/, 'o sol não anda fora do redesenho da sombra');
});

test('nuvens do Centro: cubos opacos com a cor por face, fora da névoa', () => {
  const c = fs.readFileSync('mundo/centro.mjs', 'utf8');
  assert.match(c, /new T\.MeshBasicMaterial\(\{ vertexColors: true, fog: false \}\)/);
});
