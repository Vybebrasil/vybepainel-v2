// Marcos de Irecê em voxel, nas posições reais (OpenStreetMap: assets/mundo/irece.json e
// assets/mundo/empresas-irece.json). Cada um com o seu desenho e uma placa no mapa.
import { Obra } from './voxel.mjs';

// x/z = célula do mundo (1 = 10 m, centro de Irecê em 0,0); r = raio do terreno reservado.
export const MARCOS = [
  { id: 'prefeitura', nome: 'Prefeitura · Praça Teotônio Marques Dourado', x: -35, z: -21, r: 5 },
  { id: 'catedral', nome: 'Catedral Bom Pastor', x: -24, z: -16, r: 4 },
  { id: 'estadio', nome: 'Estádio Municipal', x: 28, z: -87, r: 8 },
  { id: 'mercadao', nome: 'Mercadão', x: -72, z: -44, r: 5 },
  { id: 'rodoviaria', nome: 'Rodoviária de Irecê', x: 71, z: -25, r: 5 },
  { id: 'hospital', nome: 'Hospital Regional Mário Dourado Sobrinho', x: 3, z: 7, r: 4 },
  { id: 'camara', nome: 'Câmara Municipal', x: -46, z: 71, r: 3 },
  { id: 'forum', nome: 'Fórum Dantas Júnior de Ayres', x: 17, z: -49, r: 3 },
  { id: 'saojoao', nome: 'Praça do São João (Clériston Andrade)', x: 15, z: -45, r: 4 },
  { id: 'atacadao', nome: 'Atacadão · BA-052', x: 83.6, z: -235.3, r: 8 },
  { id: 'uneb', nome: 'UNEB · Campus Irecê', x: 270.2, z: -71.6, r: 7 },
  { id: 'faculdade', nome: 'FAI · Faculdade Irecê', x: 48.4, z: 80.7, r: 4 },
  { id: 'feijao', nome: 'Praça do Feijão', x: 13.6, z: -6.1, r: 4 },
  { id: 'ages', nome: 'AGES · Faculdade de Medicina', x: 119.3, z: -284.1, r: 6 },
];

const BRANCO = '#F4F1EA', PRETO = '#2B2F33';
function desenho(id) {
  const o = new Obra();
  const arvores = (pts) => pts.forEach(([x, z], k) => o.arvore(x, 0, z, { s: .9 + (k % 3) * .15, fruta: k % 2 ? '#F76808' : null }));
  if (id === 'prefeitura') {
    o.caixa(0, 0, 0, 10, .12, 10, '#E3DACA'); arvores([[-4, -4], [4, -4], [-4, 4], [4, 4], [0, 4.2]]);
    o.caixa(0, .12, -2.4, 6, 2.6, 3, '#F6EED8').caixa(0, 2.72, -2.4, 6.3, .3, 3.3, '#E2D4B4').caixa(0, 3.02, -2.4, 2.4, .9, 1.2, '#F6EED8');
    for (let k = 0; k < 6; k++) o.caixa(-2.5 + k, .12, -.8, .3, 2.6, .3, '#FFFFFF');
    o.janelas({ x0: -2.8, x1: 2.8, y0: .5, y1: 2.4, z: -.88, cor: '#5D7884', acesa: .3, semente: 4 });
    o.caixa(0, 3.3, -1.78, .7, .7, .05, '#FFFFFF').caixa(0, 3.62, -1.75, .05, .26, .02, PRETO).caixa(.1, 3.55, -1.75, .2, .04, .02, PRETO);
    o.caixa(3.6, .12, 1.4, .08, 3.6, .08, '#C9C1AE').caixa(3.95, 3.2, 1.4, .7, .45, .04, '#18A957').caixa(3.95, 3.3, 1.43, .3, .22, .04, '#F7C948');
    o.letreiro('PREFEITURA', { x: 0, y: 2.55, z: -.85, px: .06, cor: '#6B4A2E' });
    for (let k = 0; k < 4; k++) o.caixa(-3 + k * 2, .12, 2, 1.2, .35, .35, '#6B4A2E');
  } else if (id === 'catedral') {
    o.caixa(0, 0, 0, 7, .1, 7, '#E3DACA');
    o.caixa(0, .1, -.5, 3.6, 3, 5, '#F7F2E6');
    for (let k = 0; k < 4; k++) o.caixa(0, 3.1 + k * .22, -.5, 3.8 - k * .9, .22, 5.2, '#C8553D');
    o.caixa(0, .1, 2.3, 1.6, 6.4, 1.6, '#F7F2E6').caixa(0, 6.5, 2.3, 1.1, 1.2, 1.1, '#F7F2E6').caixa(0, 7.7, 2.3, .5, .5, .5, '#E2A11B');
    o.caixa(0, 8.2, 2.3, .12, 1, .12, '#E2A11B').caixa(0, 8.7, 2.3, .6, .12, .12, '#E2A11B');
    o.caixa(0, .1, 3.12, .9, 1.5, .06, '#6B4A2E').luz(0, 4.6, 3.12, .5, .5, .03, '#9FD6E3');
    o.janelas({ x0: -1.6, x1: 1.6, y0: 1, y1: 2.6, z: -3.02, cor: '#7FB6D6', acesa: .2, semente: 9 });
  } else if (id === 'estadio') {
    o.caixa(0, 0, 0, 15, .1, 11, '#C9C1AE').caixa(0, .1, 0, 11, .06, 7, '#3E9B4F');
    for (let k = 0; k < 6; k++) o.caixa(-5.5 + k * 2.2 + 1.1, .16, 0, 1.1, .02, 7, '#47A859');
    o.caixa(0, .18, 0, .06, .02, 7, '#FFFFFF').caixa(0, .18, -3.45, 11, .02, .06, '#FFFFFF').caixa(0, .18, 3.45, 11, .02, .06, '#FFFFFF');
    for (const s of [-1, 1]) { o.caixa(s * 5.4, .18, 0, .06, .8, 1.6, '#FFFFFF'); for (let k = 0; k < 4; k++) o.caixa(0, .1 + k * .35, s * (4.1 + k * .45), 12, .35, .45, k % 2 ? '#18A957' : '#F7C948'); }
    for (const [a, b] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) o.caixa(a, .1, b, .2, 4, .2, '#9AA3A8').luz(a, 4, b, .9, .4, .3, '#FFF6D8');
    o.letreiro('ESTADIO MUNICIPAL', { x: 0, y: 2.3, z: -6, px: .09, cor: '#FFFFFF', fundo: '#18A957' });
  } else if (id === 'mercadao') {
    o.caixa(0, 0, 0, 10, .1, 8, '#E3DACA').caixa(0, .1, 0, 8.4, 1.8, 5.4, '#F2E3C4');
    for (let k = 0; k < 5; k++) o.caixa(0, 1.9 + Math.sin(k / 4 * Math.PI) * .7, -2.7 + k * 1.35, 8.8, .14, 1.4, k % 2 ? '#9AA3A8' : '#C4C9CC');
    for (let k = 0; k < 6; k++) { o.caixa(-3.6 + k * 1.45, .1, 3.2, 1.1, .7, .7, '#B07A45'); o.caixa(-3.6 + k * 1.45, .8, 3.2, 1.2, .08, .9, ['#E5484D', '#F7C948', '#18A957', '#0D74CE', '#F76808', '#D6409F'][k]); for (let f = 0; f < 3; f++) o.caixa(-3.9 + k * 1.45 + f * .3, .8, 3.1, .18, .14, .18, ['#F76808', '#18A957', '#E5484D'][f]); }
    o.letreiro('MERCADAO', { x: 0, y: 1.6, z: 2.72, px: .1, cor: '#FFFFFF', fundo: '#C8553D' });
    o.pessoa(-1, .1, 4, { roupa: '#0D74CE' }).pessoa(1.6, .1, 4.2, { roupa: '#E5484D' });
  } else if (id === 'rodoviaria') {
    o.caixa(0, 0, 0, 10, .1, 9, '#8E8B85').caixa(0, .1, -2.8, 7, 1.4, 2, '#F4F1EA').caixa(0, 2.2, -.4, 8.5, .15, 4.2, '#0D74CE');
    for (const a of [-3.8, -1.3, 1.3, 3.8]) o.caixa(a, .1, 1.5, .12, 2.1, .12, '#9AA3A8');
    for (const [a, c] of [[-2.3, '#F4F1EA'], [2.3, '#F7C948']]) { o.caixa(a, .2, 3, 1.3, 1.1, 3.6, c).caixa(a, .75, 3, 1.32, .4, 3.4, '#4E6A78').caixa(a, .2, 4.8, 1.1, .5, .04, '#E5484D'); }
    o.letreiro('RODOVIARIA', { x: 0, y: 1.3, z: -1.78, px: .08, cor: '#0D74CE', fundo: '#FFFFFF' });
  } else if (id === 'hospital') {
    o.caixa(0, 0, 0, 8, .1, 8, '#E3DACA').caixa(0, .1, -.8, 6.4, 3.4, 4, '#FFFFFF').caixa(0, 3.5, -.8, 6.6, .2, 4.2, '#C4C9CC');
    o.janelas({ x0: -3, x1: 3, y0: .5, y1: 3.2, z: 1.22, cor: '#7FB6D6', acesa: .35, semente: 2 });
    o.luz(2.4, 3.7, -.8, .3, 1, .3, '#E5484D').luz(2.4, 4.05, -.8, 1, .3, .3, '#E5484D');
    o.caixa(0, 1.2, 2, 3.4, .14, 1.6, '#1D6FB8').caixa(-1.5, .1, 2.7, .1, 1.1, .1, '#C4C9CC').caixa(1.5, .1, 2.7, .1, 1.1, .1, '#C4C9CC');
    o.carro(-2.6, .1, 3.3, { cor: '#FFFFFF', girar: true });
  } else if (id === 'camara' || id === 'forum') {
    o.caixa(0, 0, 0, 6, .1, 6, '#E3DACA').caixa(0, .1, -.6, 4.6, 2.2, 3, id === 'camara' ? '#F2EEE6' : '#E8E1D3');
    for (let k = 0; k < 5; k++) o.caixa(-1.8 + k * .9, .1, 1.05, .26, 2.2, .26, '#FFFFFF');
    for (let k = 0; k < 3; k++) o.caixa(0, 2.3 + k * .2, .9 - k * .25, 4.8 - k * 1.4, .2, .6, '#E9E1CF');
    o.letreiro(id === 'camara' ? 'CAMARA' : 'FORUM', { x: 0, y: 1.9, z: .78, px: .08, cor: '#1D3557' });
    o.caixa(2.6, .1, 2.4, .07, 2.8, .07, '#C9C1AE').caixa(2.95, 2.4, 2.4, .6, .4, .04, '#18A957');
  } else if (id === 'atacadao') {
    o.caixa(0, 0, 0, 16, .08, 15, '#8E8B85');
    o.caixa(0, .08, -3, 13, 2.6, 7, '#E9E4DA').caixa(0, 2.68, -3, 13.4, .2, 7.4, '#C4C9CC');
    for (let k = 0; k < 6; k++) o.caixa(-5.5 + k * 2.2, 2.88, -3, 1.6, .12, 6.6, '#B9C0C4');
    o.caixa(0, .08, .55, 13, .9, .1, '#F7C948').caixa(0, 1.2, .56, 9, 1, .08, '#E5484D');
    o.letreiro('ATACADAO', { x: 0, y: 1.3, z: .62, px: .11, cor: '#FFFFFF' });
    for (let k = 0; k < 3; k++) o.caixa(-3 + k * 3, .08, .7, 1.2, 1.6, .06, '#4E6A78');
    for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) if ((r + k) % 3) o.carro(-6 + k * 2, .08, 3.2 + r * 1.6, { cor: ['#E5484D', '#F4F1EA', '#2B2F33', '#0D74CE', '#C4C9CC'][(r * 7 + k) % 5] });
    for (const a of [-7, 7]) o.caixa(a, .08, 6.6, .12, 4, .12, '#9AA3A8').caixa(a, 4, 6.6, 1.4, .8, .12, '#E5484D');
  } else if (id === 'uneb' || id === 'faculdade' || id === 'ages') {
    const cor = id === 'uneb' ? '#1D6FB8' : id === 'ages' ? '#0E7C66' : '#8E4EC6';
    o.caixa(0, 0, 0, id === 'uneb' ? 13 : 8, .08, id === 'uneb' ? 12 : 8, '#E3DACA');
    const blocos = id === 'uneb' || id === 'ages' ? [[-3.5, -2.5, 5, 3], [3.5, -2.5, 5, 3], [0, 2.8, 9, 2.6]] : [[0, -1, 6, 3.2]];
    for (const [bx, bz, bw, bd] of blocos) {
      o.caixa(bx, .08, bz, bw, 2.4, bd, '#F4F1EA').caixa(bx, 2.48, bz, bw + .2, .16, bd + .2, cor);
      o.janelas({ x0: bx - bw / 2 + .4, x1: bx + bw / 2 - .4, y0: .5, y1: 2.2, z: bz + bd / 2 + .02, cor: '#7FB6D6', acesa: .25, semente: bx * 3 + 7 });
    }
    o.letreiro(id === 'uneb' ? 'UNEB' : id === 'ages' ? 'AGES' : 'FAI', { x: 0, y: 1.9, z: (id === 'faculdade' ? .62 : 4.12), px: .1, cor: '#FFFFFF', fundo: cor });
    arvores(id !== 'faculdade' ? [[-6, 5], [6, 5], [-6, -5], [6, -5], [0, -5.4]] : [[-3.5, 3], [3.5, 3]]);
    o.pessoa(-1, .08, id !== 'faculdade' ? 5.2 : 2.6, { roupa: '#0D74CE' }).pessoa(.8, .08, id !== 'faculdade' ? 5.4 : 2.8, { roupa: '#F7C948' });
  } else if (id === 'feijao') {
    // Praça do Feijão: o grão gigante no meio (Irecê, capital do feijão), canteiros e bancos.
    o.caixa(0, 0, 0, 8, .1, 8, '#E3DACA').caixa(0, .1, 0, 3.4, .25, 3.4, '#C9B48E');
    for (let a = -1; a <= 1; a++) for (let b = -2; b <= 2; b++) for (let c = 0; c < 2; c++) {
      if (Math.abs(b) === 2 && a !== 0) continue;
      o.caixa(a * .55, .35 + c * .55 + (Math.abs(b) === 2 ? .15 : 0), b * .55, .55, .55 - (Math.abs(b) === 2 ? .3 : 0), .55, c ? '#8B4A2B' : '#7A3F24');
    }
    o.caixa(.35, 1.05, -.4, .2, .12, .5, '#B8714C');
    for (const [x, z] of [[-3, 0], [3, 0], [0, 3], [0, -3]]) o.caixa(x, .1, z, x ? .5 : 1.4, .3, x ? 1.4 : .5, '#6B4A2E');
    for (const [x, z] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]) o.caixa(x, .1, z, 1.2, .25, 1.2, '#7DB35C');
    arvores([[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]);
    o.pessoa(-1.8, .1, 1.2, { roupa: '#E5484D' }).pessoa(1.6, .1, -1.4, { roupa: '#18A957' });
  } else if (id === 'saojoao') {
    o.caixa(0, 0, 0, 8, .1, 8, '#E3DACA').caixa(0, .1, -2.4, 5, .9, 2.4, '#6B4A2E').caixa(0, 1, -3.3, 5, 2.2, .2, '#1F1D1A');
    for (const a of [-2.4, 2.4]) o.caixa(a, 1, -2.4, .14, 2.4, .14, PRETO);
    o.caixa(0, 3.3, -2.4, 5.2, .2, 2.6, '#E2A11B');
    for (let k = 0; k < 4; k++) for (let b = 0; b < 12; b++) o.caixa(-3.3 + b * .6, 2.7 - Math.sin(b / 11 * Math.PI) * .4, -1 + k * 1.3, .22, .22, .03, ['#E5484D', '#F7C948', '#18A957', '#0D74CE', '#D6409F'][(b + k) % 5]);
    o.luz(0, .1, 1.5, .9, .3, .9, '#FF7A2F').caixa(0, .4, 1.5, .5, .25, .5, '#6B4A2E');
    arvores([[-3.4, 3.2], [3.4, 3.2]]);
  }
  return o;
}

export function construirMarcos(motor, irece, THREE) {
  for (const m of MARCOS) {
    const g = desenho(m.id).montar();
    g.position.set(m.x, irece.alturaEm(m.x, m.z), m.z);
    g.scale.setScalar(.95);
    motor.adicionar(g);
    motor.rotulo({ pos: new THREE.Vector3(m.x, irece.alturaEm(m.x, m.z) + (m.id === 'catedral' ? 10 : 5), m.z), classe: 'rotulo-marco', html: m.nome.replace(/[<>&]/g, ''), distMax: 420, prioridade: 1 });
  }
}
