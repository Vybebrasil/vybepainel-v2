// O Escritório em voxel (Paulo, 06/11/2026: "o Habbo vai virar o voxel"): o andar por
// dentro, no estilo de maquete (paredes, piso em ladrilhos, móveis detalhados) com as
// pessoas que estão nele. Cada zona do Escritório é uma sala do andar.
import * as THREE from 'three';
import { Obra } from './voxel.mjs';
import { ruido } from './irece.mjs';
import { pecaDaClasse, obraDaPeca } from './catalogo.mjs';
import { tipoDoMovel } from './avatar.mjs';

// Cada sala do andar é um quadrado de LADO_SALA unidades; o quarto do Escritório (L.w × L.d ladrilhos)
// cabe nele inteiro, então um ladrilho mede LADO_SALA / L.w.
const LADO_SALA = 7, CORREDOR = 2;
const ROUPA = { laranja: '#FF9548', azul: '#78AAFF', verde: '#72CCAC', roxo: '#AC9BFF', rosa: '#EF9FBC', grafite: '#64738A' };
const MESA = { grafite: '#4A5056', azul: '#3E6FB0', verde: '#3E8F6B', roxo: '#6B55B8', laranja: '#D9773E' };
const PELE = { clara: '#F1C9A5', media: '#C68E6A', morena: '#9A6646', escura: '#6B4430' };

function paredes(o, W, D, H, { parede, rodape, tijolo }) {
  for (let x = 0; x < W; x += .5) for (let y = 0; y < H; y += .5) {
    const k = ruido(x * 7, y * 11);
    o.caixa(x + .25, y, -.15, .5, .5, .3, k < .12 ? tijolo : parede);
  }
  for (let z = 0; z < D; z += .5) for (let y = 0; y < H; y += .5) {
    const k = ruido(z * 5 + 3, y * 13);
    o.caixa(-.15, y, z + .25, .3, .5, .5, k < .12 ? tijolo : parede);
  }
  o.caixa(W / 2, 0, .02, W, .18, .06, rodape).caixa(.02, 0, D / 2, .06, .18, D, rodape);
  o.caixa(W / 2, H, -.15, W + .3, .12, .34, rodape).caixa(-.15, H, D / 2, .34, .12, D + .3, rodape);
}
function piso(o, W, D, a, b) {
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) o.caixa(x + .5, -.12, z + .5, .98, .12, .98, (x + z) % 2 ? a : b);
  o.caixa(W / 2, -.5, D / 2, W + .3, .38, D + .3, '#1E2124');
}
function janela(o, x, W) {
  o.caixa(x, .9, .02, 1.8, 1.3, .08, '#2B3A40').luz(x, .98, .06, 1.6, 1.14, .02, '#9FD6E3');
  o.caixa(x, 1.5, .1, 1.6, .06, .04, '#E8EEF0').caixa(x, .98, .1, .06, 1.14, .04, '#E8EEF0');
  o.caixa(x - 1.05, .7, .18, .3, 1.75, .14, '#2E7D4F').caixa(x + 1.05, .7, .18, .3, 1.75, .14, '#2E7D4F').caixa(x, 2.42, .16, 2.5, .12, .16, '#E8EEF0');
}
function porta(o, z) {
  o.caixa(.03, 0, z, .08, 2.1, 1.1, '#A0603A');
  for (const [a, b] of [[.5, .35], [1.3, .35], [.5, -.25], [1.3, -.25]]) o.caixa(.08, a, z + b * .9, .03, .6, .38, '#8E5232');
  o.caixa(.1, 1, z - .38, .06, .06, .14, '#D9D4C8').caixa(.03, 2.1, z, .1, .1, 1.24, '#7A4528');
}
function quadro(o, x, y, cor, fundo = '#1F1D1A') { o.caixa(x, y, .04, .9, .7, .05, fundo).luz(x, y + .12, .07, .72, .5, .02, cor); }
function estante(o, x, z, girar = false) {
  const [w, d] = girar ? [.4, 1.2] : [1.2, .4];
  o.caixa(x, 0, z, w, 2, d, '#F4F1EA');
  for (let k = 0; k < 4; k++) {
    o.caixa(x, .45 + k * .45, z, w * .95, .04, d * .95, '#E3D8C4');
    for (let l = 0; l < 5; l++) { const off = -.45 + l * .2; o.caixa(x + (girar ? 0 : off), .5 + k * .45, z + (girar ? off : 0), girar ? .28 : .14, .32, girar ? .14 : .28, ['#3E6FB0', '#E5484D', '#F7C948', '#2E7D4F', '#8E4EC6'][(l + k) % 5]); }
  }
}
function sofa(o, x, z, cor = '#E8A848', girar = false) {
  const [w, d] = girar ? [.9, 2] : [2, .9];
  o.caixa(x, .1, z, w, .4, d, cor).caixa(x + (girar ? -.35 : 0), .5, z + (girar ? 0 : -.35), girar ? .2 : w, .5, girar ? d : .2, cor);
  for (const s of [-1, 1]) o.caixa(x + (girar ? 0 : s * (w / 2 - .1)), .5, z + (girar ? s * (d / 2 - .1) : 0), girar ? w : .2, .25, girar ? .2 : d, cor);
  o.caixa(x, 0, z, w * .9, .1, d * .9, '#6B4A2E');
}
function planta(o, x, z, s = 1) { o.caixa(x, 0, z, .45 * s, .45 * s, .45 * s, '#B5462F'); for (let k = 0; k < 5; k++) o.caixa(x + (ruido(k, 3) - .5) * .3, .45 * s, z + (ruido(k, 9) - .5) * .3, .1, (.6 + ruido(k, 1) * .7) * s, .1, '#3E8F4E'); }
function luminaria(o, x, z) { o.caixa(x, 0, z, .45, .45, .45, '#FFFFFF').caixa(x, .45, z, .06, .4, .06, '#9AA3A8').luz(x, .85, z, .4, .35, .4, '#FFE7A3'); }
function tapete(o, x, z, w, d, cor) { o.caixa(x, 0, z, w, .025, d, '#3A3F44'); o.caixa(x, .006, z, w - .24, .025, d - .24, cor); for (let k = 1; k < 4; k++) o.caixa(x, .012, z - d / 2 + k * d / 4, w - .5, .025, .06, '#FFFFFF'); }
function mesaTrabalho(o, x, z, cor, { objeto = 'planta' } = {}) {
  o.caixa(x, .72, z, 1.8, .08, .8, cor); for (const [a, b] of [[-.8, -.32], [.8, -.32], [-.8, .32], [.8, .32]]) o.caixa(x + a, 0, z + b, .08, .72, .08, '#2B2F33');
  o.caixa(x, .8, z - .2, .9, .55, .06, '#1F1D1A').luz(x, .85, z - .16, .82, .45, .02, '#9FF0C8').caixa(x, .8, z - .25, .1, .2, .1, '#2B2F33');
  o.caixa(x + .1, .8, z + .15, .55, .03, .2, '#E8EEF0').caixa(x + .6, .8, z + .1, .12, .14, .12, '#FFFFFF');
  if (objeto === 'planta') planta(o, x - .7, z - .2, .5); else if (objeto === 'livros') o.caixa(x - .7, .8, z - .1, .3, .3, .2, '#E5484D'); else o.luz(x - .7, .8, z - .1, .2, .3, .2, '#FFE7A3');
  o.caixa(x, 0, z + .75, .55, .45, .55, '#3A3F44').caixa(x, .45, z + 1.0, .55, .55, .1, '#3A3F44');
}
function fliperama(o, x, z) {
  o.caixa(x, 0, z, .8, 1.9, .7, '#1F1D1A').luz(x, 1.05, z + .3, .6, .5, .04, '#5BD1FF').luz(x, 1.7, z + .33, .7, .18, .02, '#FF7A2F');
  o.caixa(x, .8, z + .4, .7, .1, .3, '#2B2F33').caixa(x - .15, .9, z + .45, .08, .1, .08, '#E5484D').caixa(x + .15, .9, z + .45, .08, .08, .08, '#F7C948');
  for (const s of [-1, 1]) o.luz(x + s * .42, .1, z, .03, 1.8, .7, '#38D9C5');
}
function sinuca(o, x, z) { o.caixa(x, 0, z, 2.6, .7, 1.5, '#5A3A22').caixa(x, .7, z, 2.4, .06, 1.3, '#1F8A4C'); for (const [a, b, c] of [[-.5, 0, '#FFFFFF'], [.3, .2, '#E5484D'], [.5, -.1, '#F7C948'], [.6, .25, '#1F1D1A']]) o.caixa(x + a, .76, z + b, .08, .08, .08, c); }

// O que cada sala tem, pela zona do Escritório.
function mobiliar(o, tipo, W, D, dono) {
  const cx = W / 2, cz = D / 2;
  if (tipo === 'pessoal') {
    mesaTrabalho(o, W - 2.2, 1.4, MESA[dono?.mesa] || '#C99A6B', { objeto: dono?.objeto });
    estante(o, .5, D - 1.6, true); sofa(o, cx - .4, D - 1.2, ROUPA[dono?.roupa] || '#E8A848'); tapete(o, cx, cz + .4, 3, 2, ROUPA[dono?.roupa] || '#FF7A2F');
    luminaria(o, cx - 2, D - 1.2); planta(o, W - .6, D - .6);
    o.caixa(cx + .9, 0, D - 2.3, .8, .42, .6, '#F4F1EA');
  } else if (tipo === 'jogos') {
    sinuca(o, cx, cz); fliperama(o, W - .8, .7); fliperama(o, W - 1.8, .7); sofa(o, 1.2, D - 1, '#8E4EC6');
    // Xadrez: mesa com tabuleiro; pôquer: mesa redonda verde com fichas.
    o.caixa(1.3, 0, 1.4, .1, .7, .1, '#2B2F33').caixa(1.3, .7, 1.4, 1, .06, 1, '#6B4A2E');
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) o.caixa(1.3 - .33 + a * .22, .76, 1.4 - .33 + b * .22, .22, .02, .22, (a + b) % 2 ? '#1F1D1A' : '#F4F1EA');
    o.caixa(W - 1.6, 0, D - 2.4, .3, .7, .3, '#2B2F33').caixa(W - 1.6, .7, D - 2.4, 1.5, .08, 1.5, '#1F6B44').caixa(W - 1.6, .7, D - 2.4, 1.6, .06, 1.6, '#6B4A2E');
    for (const [a, b, c] of [[-.3, .2, '#E5484D'], [.2, -.3, '#F7C948'], [.3, .3, '#0D74CE']]) o.caixa(W - 1.6 + a, .78, D - 2.4 + b, .14, .08, .14, c);
  }
  else if (tipo === 'cafe') {
    o.caixa(2, 0, .8, 3.2, .95, .7, '#6B4A2E').caixa(2, .95, .8, 3.3, .08, .8, '#E8E1D3').caixa(1, 1.03, .7, .5, .55, .4, '#9AA3A8').luz(1, 1.4, .92, .2, .1, .02, '#E5484D');
    for (const [a, b] of [[cx + 1, cz], [cx - 1, cz + 1.5], [cx + 1.6, cz + 2]]) { o.caixa(a, 0, b, .08, .72, .08, '#2B2F33').caixa(a, .72, b, .9, .06, .9, '#FFFFFF'); o.caixa(a + .6, 0, b, .4, .45, .4, '#E5484D').caixa(a - .6, 0, b, .4, .45, .4, '#E5484D'); }
    planta(o, W - .6, .6);
  } else if (tipo === 'lounge') { sofa(o, cx, D - 1.1, '#8E4EC6'); sofa(o, 1, cz, '#8E4EC6', true); tapete(o, cx, cz, 3, 2.4, '#8E4EC6'); o.caixa(W - .8, 0, .7, .9, 1.6, .6, '#3A3F44').luz(W - .8, 1.1, 1.01, .7, .3, .02, '#FF7A2F'); luminaria(o, W - .7, D - .7); }
  else if (tipo === 'academia') { for (const k of [0, 1]) { o.caixa(2 + k * 2.5, 0, cz, .5, .45, 1.6, '#2B2F33'); o.caixa(2 + k * 2.5, .75, cz - .7, 1.6, .05, .05, '#9AA3A8'); } o.luz(cx, .3, .06, W - 1, 1.8, .02, '#CFE6EC'); tapete(o, cx, cz + 1.5, W - 1.5, 1.6, '#2B2F33'); }
  else if (tipo === 'reuniao' || tipo === 'auditorio') {
    if (tipo === 'reuniao') { o.caixa(cx, .72, cz, 3.4, .08, 1.4, '#FFFFFF').caixa(cx, 0, cz, .3, .72, .3, '#2B2F33'); for (const a of [-1.2, 0, 1.2]) for (const s of [-1, 1]) o.caixa(cx + a, 0, cz + s * 1.05, .5, .45, .5, '#2B2F33'); }
    else for (let r = 0; r < 3; r++) for (let c = -2; c <= 2; c++) o.caixa(cx + c * .9, r * .2, cz + r * 1.1, .7, .45, .6, '#B5462F');
    o.caixa(cx, 1, .06, 3, 1.6, .06, '#1F1D1A').luz(cx, 1.08, .1, 2.8, 1.44, .02, '#BFE3EA');
  } else if (tipo === 'producao') {
    o.luz(cx, 0, .12, W - 2, 2.6, .04, '#3DDC84');
    for (const a of [-1.5, 1.5]) { o.caixa(cx + a, 0, cz, .06, 1.6, .06, '#2B2F33').luz(cx + a, 1.6, cz, .6, .45, .2, '#FFF1D2'); }
    o.caixa(cx, 0, cz + 1.5, .06, 1.2, .06, '#2B2F33').caixa(cx, 1.2, cz + 1.5, .45, .3, .35, '#1F1D1A').luz(cx, 1.3, cz + 1.3, .14, .1, .02, '#E5484D');
  } else if (tipo === 'operacao') {
    for (let k = 0; k < 4; k++) o.caixa(1.2 + k * 1.6, 1, .06, 1.4, .9, .06, '#1F1D1A').luz(1.2 + k * 1.6, 1.05, .1, 1.3, .8, .02, ['#9FF0C8', '#BFE3EA', '#FFD6A8', '#C9B6F2'][k]);
    for (let k = 0; k < 3; k++) mesaTrabalho(o, 1.6 + k * 2.2, cz + .6, '#4A5056', { objeto: 'luminaria' });
  } else if (tipo === 'foco') { mesaTrabalho(o, cx, cz, '#E8E1D3'); planta(o, .7, .7); planta(o, W - .7, .7); estante(o, W - .5, D - 1.5, true); }
  else { // Convivência
    sofa(o, cx - 1.2, D - 1.2, '#FF7A2F'); sofa(o, 1, cz, '#E8A848', true); tapete(o, cx, cz, 3.4, 2.6, '#FF7A2F'); o.caixa(cx, 0, cz, 1.2, .42, .7, '#C99A6B');
    planta(o, W - .7, .7); planta(o, .7, D - .7); luminaria(o, W - .7, D - .8);
  }
}

// ---------- Decoração salva: o mesmo item do Escritório ----------
// O editor do Escritório grava cada sala como a camada "sala-N" (server/escritorio-mapa.js, itensValidos):
// [classe, x, y, direção, estado, altura, config?]. x e y são o ladrilho do canto da peça (o menor x e y
// que ela ocupa), em ladrilhos da sala; a direção é a do Habbo, 0/2/4/6: 4 olha para +y e 2 para +x (o
// sofá encostado no fundo é 4 e a estante na parede da esquerda é 2, como em escritorioMoveisDaSala). A
// peça voxel é desenhada de frente para +z, então a direção 4 é giro zero. Antes o giro era -dir·90°/2 e
// toda peça salva aparecia de costas (o sofá virado para a parede).
export const DIRECOES = [0, 2, 4, 6];
export const giroDaDirecao = (dir) => ((4 - (Number(dir) || 0)) / 2) * (Math.PI / 2);
// Tamanho no chão (em ladrilhos, na direção 0/4), como o mapaDimensoes do editor do Escritório: o painel de
// decorar mede pelo móvel do Habbo (definirMedida); sem medida, vale a caixa da peça voxel.
const MEDIDAS = new Map(), MEDIDAS_VOXEL = new Map();
function medidaVoxel(classe) {
  if (!MEDIDAS_VOXEL.has(classe)) {
    const peca = pecaDaClasse(classe, tipoDoMovel(classe)), o = obraDaPeca(peca.desenho, peca.cor);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of [...o.solidos, ...o.luzes]) { x0 = Math.min(x0, b.x - b.w / 2); x1 = Math.max(x1, b.x + b.w / 2); z0 = Math.min(z0, b.z - b.d / 2); z1 = Math.max(z1, b.z + b.d / 2); }
    const lado = (v) => (Number.isFinite(v) ? Math.max(1, Math.ceil(v - .05)) : 1);
    MEDIDAS_VOXEL.set(classe, { x: lado(x1 - x0), y: lado(z1 - z0), direcoes: null });
  }
  return MEDIDAS_VOXEL.get(classe);
}
export function definirMedida(classe, m) {
  if (!classe || !m) return;
  const atual = medidaDaPeca(String(classe)), lado = (v, padrao) => (Number(v) > 0 ? Math.max(1, Math.min(24, Math.round(Number(v)))) : padrao);
  const direcoes = Array.isArray(m.direcoes) ? DIRECOES.filter((d) => m.direcoes.map(Number).includes(d)) : atual.direcoes;
  MEDIDAS.set(String(classe), { x: lado(m.x, atual.x), y: lado(m.y, atual.y), direcoes: direcoes?.length ? direcoes : null });
}
export function medidaDaPeca(classe) { return MEDIDAS.get(String(classe)) || medidaVoxel(String(classe)); }
// Ladrilhos ocupados na direção dada (2 e 6 trocam largura e fundo, como no servidor e no mapa).
export function pegada(classe, dir) {
  const m = medidaDaPeca(classe), deLado = Number(dir) === 2 || Number(dir) === 6;
  return { w: deLado ? m.y : m.x, h: deLado ? m.x : m.y };
}
// Próxima direção ao girar (R): só as que o móvel tem no Habbo, como girarSelecionadoEscritorio. Sem a
// lista do Habbo, 2 e 4 (todo móvel que gira tem as duas). null: não gira.
export function proximaDirecao(dir, direcoes = null) {
  const lista = Array.isArray(direcoes) && direcoes.length ? DIRECOES.filter((d) => direcoes.includes(d)) : [2, 4];
  if (lista.length < 2) return null;
  return lista[(lista.indexOf(Number(dir)) + 1) % lista.length];
}
// Canto (x, y) inteiro mais perto de (fx, fy) com a peça inteira dentro da sala.
export function encaixar(fx, fy, p, L) {
  const lim = (v, max) => Math.max(0, Math.min(Math.max(0, max), Math.round(Number(v) || 0)));
  return { x: lim(fx, L.w - p.w), y: lim(fy, L.d - p.h) };
}
export const cabeNaSala = (x, y, p, L) => x >= 0 && y >= 0 && x + p.w <= L.w + 1e-6 && y + p.h <= L.d + 1e-6;
// A peça i em (x, y) cobre outra? Só informa (o editor do próprio quarto deixa sobrepor, Paulo, 28/10/2026).
export function sobrepoe(itens, i, x, y, p, ignorar = () => false) {
  return itens.some((o, k) => {
    if (k === i || !Array.isArray(o) || ignorar(o)) return false;
    const q = pegada(o[0], o[3]);
    return x < o[1] + q.w && o[1] < x + p.w && y < o[2] + q.h && o[2] < y + p.h;
  });
}
// Centro da peça na sala voxel (unidades a partir do canto da sala).
export function centroDoItem(it, L, lado = LADO_SALA) {
  const p = pegada(it[0], it[3]);
  return { x: (Number(it[1]) + p.w / 2) / L.w * lado, z: (Number(it[2]) + p.h / 2) / L.d * lado };
}
// As mudanças devolvem uma lista nova, item a item no formato do Escritório: só x, y e direção mudam;
// estado, altura e a configuração (7º campo: troféu, gatilho, fundo) vão como estavam.
const copia = (itens) => (itens || []).filter(Array.isArray).map((it) => [...it]);
export function moverItem(itens, i, x, y, { dir = null, ehParede = () => false } = {}) {
  const novos = copia(itens), it = novos[i];
  if (!it) return novos;
  const ox = Number(it[1]), oy = Number(it[2]), dx = x - ox, dy = y - oy;
  it[1] = x; it[2] = y;
  if (dir != null) it[3] = dir;
  // Como escritorioLevarOQueEstaEmCima: a peça do chão leva junto o que está em cima dela (centro dentro
  // da área que ela ocupava), mantendo a altura de cada uma.
  if (!(Number(it[5]) > 0) && (dx || dy) && !ehParede(it[0])) {
    const p = pegada(it[0], it[3]), r = (v) => Math.round(v * 100) / 100;
    novos.forEach((o, j) => {
      if (j === i || !(Number(o[5]) > 0) || ehParede(o[0])) return;
      const cx = Number(o[1]) + .5, cy = Number(o[2]) + .5;
      if (cx >= ox && cx < ox + p.w && cy >= oy && cy < oy + p.h) { o[1] = r(Number(o[1]) + dx); o[2] = r(Number(o[2]) + dy); }
    });
  }
  return novos;
}
export function girarItem(itens, i, dir) {
  const novos = copia(itens);
  if (novos[i]) novos[i][3] = dir;
  return novos;
}
// Guardar (Delete): a peça sai da sala; ao salvar, o servidor conta de novo e ela volta a estar livre no inventário.
export function guardarItem(itens, i) {
  const novos = copia(itens), item = novos[i] || null;
  if (item) novos.splice(i, 1);
  return { itens: novos, item };
}
// Peça nova do inventário: [classe, x, y, direção, 0, 0]; na parede, altura 1 (como cliqueEditorEscritorio).
export function porItem(itens, classe, x, y, dir, { parede = false } = {}) {
  return [...copia(itens), [String(classe), x, y, dir, 0, parede ? 1 : 0]];
}
const PISO_PESSOAL = ['#B98A5C', '#C99A6B'], PISO_COMUM = ['#2E6F7A', '#357D88'], MURETA = '#1C1C1F';
const COR_OK = '#FF7A2F', COR_SOBRE = '#E2A11B', COR_FORA = '#D93D42';
const ehCor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// O andar por dentro (Paulo, 06/11/2026: "todos se veem ali no andar; a voz só funciona
// quando entra na sala da pessoa"). Escritório aberto: cada zona do Escritório é uma
// sala de vidro baixo no andar; todo mundo do andar aparece; entrar numa sala liga a
// voz daquela zona (o motor do Escritório cuida da voz, das trancas e da presença).
export function abrirAndar(canvas, { zonas = [], titulo = '' } = {}) {
  const porLinha = Math.min(3, Math.max(1, zonas.length <= 4 ? 2 : 3));
  const linhas = Math.ceil(zonas.length / porLinha);
  const W = porLinha * LADO_SALA, D = linhas * LADO_SALA + (linhas - 1) * CORREDOR, H = 3;
  const salas = zonas.map((z, i) => ({ ...z, ox: (i % porLinha) * LADO_SALA, oz: Math.floor(i / porLinha) * (LADO_SALA + CORREDOR) }));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight('#F3F7FF', '#4A3B2C', 1.1));
  const sol = new THREE.DirectionalLight('#FFF1D8', 1.8); sol.position.set(W + 8, 18, D + 10); sol.target.position.set(W / 2, 0, D / 2);
  sol.castShadow = true; sol.shadow.mapSize.set(4096, 4096); const s = Math.max(W, D); Object.assign(sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: 80 }); sol.shadow.bias = -.0005;
  cena.add(sol, sol.target);

  // Casca do andar: piso do corredor, as duas paredes de fora (maquete) e a fachada ripada.
  const casca = new Obra();
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) casca.caixa(x + .5, -.14, z + .5, .98, .1, .98, (x + z) % 2 ? '#D9D2C2' : '#E3DCCD');
  casca.caixa(W / 2, -.55, D / 2, W + .4, .4, D + .4, '#1C1C1F');
  paredes(casca, W, D, H, { parede: '#2A2A2E', rodape: '#1C1C1F', tijolo: '#202024' });
  for (let x = 1.5; x < W; x += 3.5) casca.luz(x, .2, .03, .06, H - .4, .02, '#FF9A4A');
  for (let z = 1.5; z < D; z += 3.5) casca.luz(.03, .2, z, .02, H - .4, .06, '#FF9A4A');
  casca.caixa(W - .02, 0, D / 2, .04, .1, D, '#FF7A2F').caixa(W / 2, 0, D - .02, W, .1, .04, '#FF7A2F');
  // Corredor e cantos sem sala (Paulo, 07/11/2026: "as salas… muito mal feito"): passadeira, plantas, bancos, bebedouro
  // e luminárias nos corredores; o canto que sobra vira um lounge com sofás, tapete, mesa de centro e estante.
  for (let r = 0; r < linhas - 1; r++) {
    const zc = (r + 1) * LADO_SALA + r * CORREDOR + CORREDOR / 2;
    casca.caixa(W / 2, -.09, zc, W - 1.2, .02, .9, '#C8553D').caixa(W / 2, -.085, zc, W - 1.5, .02, .7, '#D9774E');
    for (let x = 1.6; x < W - 1; x += 3.4) { planta(casca, x, zc - .7, .8); casca.caixa(x + 1.1, 0, zc + .62, 1.1, .38, .34, '#B98552').caixa(x + 1.1, .38, zc + .76, 1.1, .32, .06, '#B98552'); luminaria(casca, x + 2.3, zc - .7); }
    casca.caixa(W - .6, 0, zc, .4, .9, .4, '#E9EEF0').caixa(W - .6, .9, zc, .3, .35, .3, '#BDE3F2');
  }
  for (let i = salas.length; i < porLinha * linhas; i++) {
    const ox = (i % porLinha) * LADO_SALA, oz = Math.floor(i / porLinha) * (LADO_SALA + CORREDOR), cx2 = ox + LADO_SALA / 2, cz2 = oz + LADO_SALA / 2;
    tapete(casca, cx2, cz2, 3.6, 2.8, '#FF7A2F');
    sofa(casca, cx2, cz2 + 1.9, '#E8A848'); sofa(casca, cx2 - 2.1, cz2, '#38A3A5', true);
    casca.caixa(cx2, 0, cz2, 1.3, .38, .75, '#C99A6B').caixa(cx2 + .2, .38, cz2, .14, .14, .14, '#FF7A2F').caixa(cx2 - .3, .38, cz2 + .1, .3, .03, .22, '#F4F1EA');
    estante(casca, ox + LADO_SALA - .5, cz2 - 1.2, true); planta(casca, ox + .7, oz + .7, 1.2); planta(casca, ox + LADO_SALA - .7, oz + LADO_SALA - .7, 1.1); luminaria(casca, ox + .8, oz + LADO_SALA - .8);
  }
  cena.add(casca.montar());

  // Cada sala: piso próprio, divisória de vidro baixo com vão de porta, placa e móveis.
  const vidro = new THREE.MeshStandardMaterial({ color: '#BFE3EA', transparent: true, opacity: .35, roughness: .1, depthWrite: false });
  const etiquetas = [], alvosJogo = [];
  // Modo decorar (null fora dele): a sala em edição, a lista em edição e o que está na mão.
  let ed = null;
  const liberar = (g) => g?.traverse?.((o) => { o.geometry?.dispose?.(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.()); });
  // Piso, móveis padrão (sala sem decoração salva) e divisórias da sala. Refeito quando o acabamento muda.
  function montarBase(sl) {
    if (sl.base) { cena.remove(sl.base); liberar(sl.base); }
    const o = new Obra(), pessoal = Boolean(sl.dono);
    // Piso escolhido pelo dono (sala_piso do Escritório, as duas cores do ladrilho); sem escolha, o de sempre.
    const [a, b] = Array.isArray(sl.piso) && sl.piso.length === 2 && sl.piso.every(ehCor) ? sl.piso : pessoal ? PISO_PESSOAL : PISO_COMUM;
    for (let x = 0; x < LADO_SALA; x++) for (let z = 0; z < LADO_SALA; z++) o.caixa(x + .5, -.09, z + .5, .98, .08, .98, (x + z) % 2 ? a : b);
    if (!sl.decorada && ed?.sl !== sl) mobiliar(o, sl.tipo, LADO_SALA, LADO_SALA, sl.perfil);
    // Divisórias: frente e lado direito de vidro baixo (todo mundo se vê), com vão de porta. A mureta leva a
    // cor das paredes que o dono escolheu (sala_parede).
    for (const [x, z, w, d] of [[LADO_SALA - .05, LADO_SALA / 2 - 1.5, .1, LADO_SALA - 3], [LADO_SALA / 2 - 1.5, LADO_SALA - .05, LADO_SALA - 3, .1]]) o.caixa(x, 0, z, w, .25, d, ehCor(sl.parede) ? sl.parede : MURETA);
    sl.base = o.montar(); sl.base.position.set(sl.ox, 0, sl.oz); cena.add(sl.base);
  }
  // Sala decorada pela pessoa: os móveis salvos (classe, x, y, direção), cada um como a peça voxel dele.
  function malhaDoItem(it, L) {
    const [classe, ix, iy, dir] = it || [];
    if (!classe || !Number.isFinite(Number(ix)) || !Number.isFinite(Number(iy)) || !L) return null;
    const peca = pecaDaClasse(classe, tipoDoMovel(classe)), m = obraDaPeca(peca.desenho, peca.cor).montar();
    const c = centroDoItem(it, L); m.position.set(c.x, 0, c.z); m.rotation.y = giroDaDirecao(dir);
    return m;
  }
  function montarItens(sl) {
    if (sl.grupo) { cena.remove(sl.grupo); liberar(sl.grupo); }
    sl.grupo = new THREE.Group(); sl.grupo.position.set(sl.ox, 0, sl.oz); sl.vis = [];
    if (sl.decorada || ed?.sl === sl) (sl.itens || []).forEach((it, i) => { const m = malhaDoItem(it, sl.L); if (!m) return; m.userData.item = i; sl.grupo.add(m); sl.vis[i] = m; });
    cena.add(sl.grupo);
  }
  for (const sl of salas) {
    sl.decorada = Boolean(Array.isArray(sl.itens) && sl.itens.length && sl.L);
    montarBase(sl);
    if (sl.tipo === 'jogos' && !sl.decorada) for (const [jogo, x, z, w, d] of [['sinuca', LADO_SALA / 2, LADO_SALA / 2, 2.8, 1.7], ['xadrez', 1.3, 1.4, 1.2, 1.2], ['poker', LADO_SALA - 1.6, LADO_SALA - 2.4, 1.8, 1.8], ['mesa', LADO_SALA - 1.3, .7, 2, .8]]) {
      const caixa = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, d), new THREE.MeshBasicMaterial({ visible: false }));
      caixa.position.set(sl.ox + x, .7, sl.oz + z); caixa.userData = { jogo, zona: sl.id }; cena.add(caixa); alvosJogo.push(caixa);
    }
    montarItens(sl);
    const pessoal = Boolean(sl.dono);
    for (const [x, z, w, d] of [[LADO_SALA - .05, LADO_SALA / 2 - 1.5, .06, LADO_SALA - 3], [LADO_SALA / 2 - 1.5, LADO_SALA - .05, LADO_SALA - 3, .06]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), vidro); m.position.set(sl.ox + x, .8, sl.oz + z); m.renderOrder = 2; cena.add(m);
    }
    const el = document.createElement('div'); el.className = 'sala-placa' + (pessoal ? ' pessoal' : '');
    el.innerHTML = `<b>${String(sl.nome).replace(/[<>&]/g, '')}</b><span></span>`;
    canvas.parentElement.appendChild(el);
    etiquetas.push({ el, sl });
  }

  const camera = new THREE.PerspectiveCamera(30, 1, .1, 400);
  const alvo = new THREE.Vector3(W / 2, .5, D / 2);
  let giro = .78, incl = .82, dist = Math.max(W, D) * 2.1; const quer = { giro, incl, dist, alvo: alvo.clone() };
  function posicionar() { camera.position.set(alvo.x + dist * Math.cos(incl) * Math.sin(giro), alvo.y + dist * Math.sin(incl), alvo.z + dist * Math.cos(incl) * Math.cos(giro)); camera.lookAt(alvo); }
  function medir() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(medir); ro.observe(canvas); medir();

  // Pessoas do andar inteiro, cada uma na sua sala (posição local da presença, na escala da sala).
  const pessoas = new Map();
  function boneco(p) {
    const g = new THREE.Group(), ob = new Obra(), roupa = ROUPA[p.roupa] || p.roupa || '#FF7A2F';
    ob.caixa(-.11, 0, 0, .16, .5, .2, '#2B2F33').caixa(.11, 0, 0, .16, .5, .2, '#2B2F33');
    ob.caixa(0, .5, 0, .46, .55, .28, roupa).caixa(-.3, .55, 0, .12, .45, .14, roupa).caixa(.3, .55, 0, .12, .45, .14, roupa);
    ob.caixa(0, 1.05, 0, .34, .34, .34, PELE[p.pele] || '#C68E6A').caixa(0, 1.33, -.02, .38, .12, .4, p.cabelo === 'longo' ? '#4A2E1A' : '#2B1D14');
    if (p.cabelo === 'longo') ob.caixa(0, .95, -.16, .38, .4, .08, '#4A2E1A');
    ob.caixa(-.08, 1.18, .17, .05, .05, .02, '#1F1D1A').caixa(.08, 1.18, .17, .05, .05, .02, '#1F1D1A');
    if (p.eu) ob.luz(0, .01, 0, .9, .02, .9, '#FF7A2F');
    g.add(ob.montar()); cena.add(g);
    const el = document.createElement('div'); el.className = 'sala-nome' + (p.eu ? ' eu' : '');
    canvas.parentElement.appendChild(el);
    return { g, el, x: 0, z: 0, alvo: { x: 0, z: 0 }, novo: true };
  }
  function definirPessoas(lista, minhaZona) {
    const vistos = new Set();
    const porSala = new Map();
    for (const p of lista) { const sl = salas.find((x) => x.id === p.zona); if (!sl) continue; if (!porSala.has(sl.id)) porSala.set(sl.id, []); porSala.get(sl.id).push(p); }
    for (const [id, gente] of porSala) {
      const sl = salas.find((x) => x.id === id);
      gente.forEach((p, i) => {
        vistos.add(p.id);
        let b = pessoas.get(p.id); if (!b) { b = boneco(p); pessoas.set(p.id, b); }
        const temPos = Number.isFinite(p.x) && Number.isFinite(p.y) && p.L;
        const lx = temPos ? p.x / p.L.w * LADO_SALA : 2 + (i % 3) * 1.4, lz = temPos ? p.y / p.L.d * LADO_SALA : 3.6 + Math.floor(i / 3) * 1.2;
        b.alvo = { x: sl.ox + Math.max(.5, Math.min(LADO_SALA - .5, lx)), z: sl.oz + Math.max(.5, Math.min(LADO_SALA - .5, lz)) };
        if (b.novo) { b.x = b.alvo.x; b.z = b.alvo.z; b.novo = false; }
        const comVoz = minhaZona && p.zona === minhaZona && !p.eu;
        b.el.innerHTML = `${comVoz ? '<i>🎙</i>' : ''}${String(p.nome || '').split(' ')[0].replace(/[<>&]/g, '')}`;
      });
    }
    for (const [id, b] of pessoas) if (!vistos.has(id)) { cena.remove(b.g); b.el.remove(); pessoas.delete(id); }
    for (const e of etiquetas) { const n = porSala.get(e.sl.id)?.length || 0; e.el.querySelector('span').textContent = n ? `${n} aqui` : ''; e.el.classList.toggle('minha', e.sl.id === minhaZona); }
  }

  // Controles: arrastar gira a maquete, roda aproxima, clique numa sala entra nela (e na voz dela).
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let arrasto = null, aoSala = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (ed && comecarArrasto(e)) return; // decorando: a peça clicada é pega; o resto gira a maquete
    arrasto = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (ed?.arrasto) { arrastar(e); return; }
    if (ed && !arrasto) pairar(e);
    if (!arrasto) return;
    quer.giro = Math.max(.1, Math.min(1.45, quer.giro - (e.clientX - arrasto.x) * .005));
    quer.incl = Math.max(.35, Math.min(1.3, quer.incl + (e.clientY - arrasto.y) * .004));
    arrasto.x = e.clientX; arrasto.y = e.clientY;
  });
  canvas.addEventListener('pointercancel', () => { arrasto = null; if (ed?.arrasto) soltarArrasto(true); });
  canvas.addEventListener('pointerup', (e) => {
    const parado = arrasto && Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) < 5; arrasto = null;
    // Decorando: o clique é da edição (pôr, largar a seleção, mostrar a grade); não entra em sala.
    if (ed) { if (ed.arrasto) soltarArrasto(); else if (parado) cliqueNaEdicao(e); return; }
    if (!parado || !aoSala) return;
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); const p = new THREE.Vector3();
    const jogo = ray.intersectObjects(alvosJogo, false)[0]?.object?.userData;
    if (jogo) { aoSala(jogo.zona, .5, .5, jogo.jogo); return; }
    if (!ray.ray.intersectPlane(chao, p)) return;
    const sl = salas.find((x) => p.x >= x.ox && p.x < x.ox + LADO_SALA && p.z >= x.oz && p.z < x.oz + LADO_SALA);
    if (sl) aoSala(sl.id, (p.x - sl.ox) / LADO_SALA, (p.z - sl.oz) / LADO_SALA);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (arrasto || ed) return;
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); canvas.style.cursor = ray.intersectObjects(alvosJogo, false).length ? 'pointer' : '';
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); quer.dist = Math.max(Math.max(W, D) * .9, Math.min(Math.max(W, D) * 3, quer.dist * Math.exp(e.deltaY * .0012))); }, { passive: false });

  // ---------- Modo decorar (vybe-mundo-decorar.js) ----------
  // Só a sala em edição responde. Clicar no chão mostra a grade e larga a seleção; arrastar uma peça a
  // muda de lugar encaixando na grade; R gira; Delete guarda (volta ao inventário ao salvar); Esc larga o
  // que está na mão. Limites como no editor do Escritório para o próprio quarto: a peça fica dentro da
  // sala e sobrepor é livre (Paulo, 28/10/2026), só o marcador fica âmbar. As mudanças saem por
  // aoMudar(itens) no formato do Escritório; quem grava é o painel.
  function raioDe(e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  // Ponto do chão sob o ponteiro, em ladrilhos da sala em edição (null fora dela, a não ser com livre).
  function noChaoDaSala(e, livre = false) {
    raioDe(e); const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(chao, p)) return null;
    const sl = ed.sl, lx = p.x - sl.ox, lz = p.z - sl.oz;
    if (!livre && (lx < 0 || lz < 0 || lx >= LADO_SALA || lz >= LADO_SALA)) return null;
    return { tx: lx / LADO_SALA * sl.L.w, ty: lz / LADO_SALA * sl.L.d };
  }
  function pecaSob(e) {
    raioDe(e); let o = ray.intersectObjects(ed.sl.grupo.children, true)[0]?.object;
    while (o && o.userData?.item == null) o = o.parent;
    return o ? o.userData.item : null;
  }
  const ehDeParede = (classe) => ed?.tipoDeParede?.(classe) === 'parede';
  const ignorarSobre = (o) => Number(o[5]) > 0 || tipoDoMovel(o[0]) === 'tapete' || Boolean(ed?.tipoDeParede?.(o[0]));
  function corDe(i, x, y, p, classe) {
    if (!cabeNaSala(x, y, p, ed.sl.L)) return COR_FORA;
    return !ignorarSobre([classe]) && sobrepoe(ed.itens, i, x, y, p, ignorarSobre) ? COR_SOBRE : COR_OK;
  }
  function marcar(x, y, p, cor) {
    const L = ed.sl.L, cx = LADO_SALA / L.w, cz = LADO_SALA / L.d, m = ed.marcador;
    m.visible = true; m.scale.set(p.w * cx, p.h * cz, 1); m.position.set((x + p.w / 2) * cx, .02, (y + p.h / 2) * cz); m.material.color.set(cor);
  }
  function marcarSelecao() {
    if (!ed) return;
    const it = ed.itens[ed.sel];
    if (!it) { ed.marcador.visible = false; return; }
    const p = pegada(it[0], it[3]); marcar(Number(it[1]), Number(it[2]), p, corDe(ed.sel, Number(it[1]), Number(it[2]), p, it[0]));
  }
  function mostrarGrade(sim) { if (ed) { ed.grade = Boolean(sim); ed.grade3d.visible = ed.grade; } }
  function selecionarItem(i) {
    if (!ed) return;
    ed.sel = Number.isInteger(i) && ed.itens[i] ? i : null;
    marcarSelecao(); ed.aoSelecionar?.(ed.sel, ed.sel == null ? null : [...ed.itens[ed.sel]]);
  }
  function mudar(novos, info) {
    ed.itens = novos; ed.sl.itens = novos; montarItens(ed.sl);
    if (ed.sel != null && !ed.itens[ed.sel]) ed.sel = null;
    marcarSelecao(); ed.aoMudar?.(novos.map((it) => [...it]), info);
  }
  // Fantasma: a peça da mão, meio transparente, seguindo o ponteiro já encaixada na grade.
  function fantasmaDe(classe, dir) {
    const peca = pecaDaClasse(classe, tipoDoMovel(classe)), g = obraDaPeca(peca.desenho, peca.cor).montar({ sombra: false });
    g.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = .55; o.material.depthWrite = false; } });
    g.rotation.y = giroDaDirecao(dir); g.visible = false;
    return g;
  }
  function dirInicial(classe) { const d = medidaDaPeca(classe).direcoes; return !d || d.includes(2) ? 2 : d[0]; }
  function segurarPeca(classe) {
    if (!ed) return;
    if (ed.fantasma) { ed.camada.remove(ed.fantasma); liberar(ed.fantasma); ed.fantasma = null; }
    ed.novo = classe ? { classe: String(classe), dir: dirInicial(String(classe)) } : null;
    if (ed.novo) { selecionarItem(null); ed.fantasma = fantasmaDe(ed.novo.classe, ed.novo.dir); ed.camada.add(ed.fantasma); mostrarGrade(true); }
    else marcarSelecao();
    canvas.style.cursor = ed.novo ? 'crosshair' : '';
    ed.aoSegurar?.(ed.novo?.classe || null);
  }
  // Onde a peça da mão cai: na grade, inteira na sala; peça de parede, encostada numa parede (lugarParede).
  function lugarDoNovo(p) {
    const { classe, dir } = ed.novo;
    if (ehDeParede(classe)) {
      const l = ed.lugarParede?.(Math.floor(p.tx), Math.floor(p.ty), p.tx, p.ty);
      return l ? { x: l.lx, y: l.ly, dir: l.dir, ok: true, parede: true } : { x: Math.floor(p.tx), y: Math.floor(p.ty), dir, ok: false, parede: true };
    }
    const pg = pegada(classe, dir);
    return { ...encaixar(p.tx - pg.w / 2, p.ty - pg.h / 2, pg, ed.sl.L), dir, ok: true, parede: false };
  }
  function moverFantasma(e) {
    const p = noChaoDaSala(e);
    if (!p) { ed.fantasma.visible = false; ed.marcador.visible = false; return; }
    const l = lugarDoNovo(p), it = [ed.novo.classe, l.x, l.y, l.dir], c = centroDoItem(it, ed.sl.L), pg = pegada(it[0], l.dir);
    ed.fantasma.visible = true; ed.fantasma.position.set(c.x, 0, c.z); ed.fantasma.rotation.y = giroDaDirecao(l.dir);
    marcar(l.x, l.y, pg, l.ok ? corDe(-1, l.x, l.y, pg, it[0]) : COR_FORA);
  }
  function porNovo(p) {
    const l = lugarDoNovo(p), classe = ed.novo.classe;
    if (!l.ok) { ed.aoAviso?.('Itens de parede vão encostados numa parede: clique no piso junto dela.'); return; }
    segurarPeca(null);
    const novos = porItem(ed.itens, classe, l.x, l.y, l.dir, { parede: l.parede });
    mudar(novos, { tipo: 'por', i: novos.length - 1, classe });
    selecionarItem(novos.length - 1);
  }
  function pairar(e) {
    if (ed.novo) { moverFantasma(e); return; }
    canvas.style.cursor = pecaSob(e) != null ? 'grab' : '';
  }
  function comecarArrasto(e) {
    if (ed.novo || (e.pointerType === 'mouse' && e.button !== 0)) return false;
    const i = pecaSob(e);
    if (i == null) return false;
    selecionarItem(i);
    const it = ed.itens[i], tipo = ed.tipoDeParede?.(it[0]);
    if (tipo === 'imagem') { ed.aoAviso?.('A imagem da equipe fica onde está; dá para guardar (Delete).'); return true; }
    const p = noChaoDaSala(e, true);
    ed.arrasto = { i, x0: e.clientX, y0: e.clientY, moveu: false, dx: p ? p.tx - Number(it[1]) : 0, dy: p ? p.ty - Number(it[2]) : 0, alvo: null, parede: tipo === 'parede' };
    canvas.setPointerCapture?.(e.pointerId); canvas.style.cursor = 'grabbing';
    return true;
  }
  function arrastar(e) {
    const a = ed.arrasto;
    if (!a.moveu && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 4) return;
    a.moveu = true;
    const p = noChaoDaSala(e, true), it = ed.itens[a.i];
    if (!p || !it) return;
    if (a.parede) {
      const l = ed.lugarParede?.(Math.floor(p.tx), Math.floor(p.ty), p.tx, p.ty);
      a.alvo = l ? { x: l.lx, y: l.ly, dir: l.dir } : null;
      if (!l) { marcar(Math.max(0, Math.floor(p.tx)), Math.max(0, Math.floor(p.ty)), { w: 1, h: 1 }, COR_FORA); return; }
    } else a.alvo = { ...encaixar(p.tx - a.dx, p.ty - a.dy, pegada(it[0], it[3]), ed.sl.L), dir: it[3] };
    const m = ed.sl.vis[a.i], c = centroDoItem([it[0], a.alvo.x, a.alvo.y, a.alvo.dir], ed.sl.L), pg = pegada(it[0], a.alvo.dir);
    if (m) { m.position.set(c.x, 0, c.z); m.rotation.y = giroDaDirecao(a.alvo.dir); }
    marcar(a.alvo.x, a.alvo.y, pg, corDe(a.i, a.alvo.x, a.alvo.y, pg, it[0]));
  }
  function soltarArrasto(cancelar = false) {
    const a = ed.arrasto, it = ed.itens[a.i]; ed.arrasto = null; canvas.style.cursor = '';
    if (!cancelar && it && a.moveu && a.alvo && (a.alvo.x !== Number(it[1]) || a.alvo.y !== Number(it[2]) || a.alvo.dir !== it[3])) {
      mudar(moverItem(ed.itens, a.i, a.alvo.x, a.alvo.y, { dir: a.parede ? a.alvo.dir : null, ehParede: ehDeParede }), { tipo: 'mover', i: a.i });
      return;
    }
    // Não mudou (ou soltou longe da parede): a peça volta para onde estava.
    const m = ed.sl.vis[a.i];
    if (m && it) { const c = centroDoItem(it, ed.sl.L); m.position.set(c.x, 0, c.z); m.rotation.y = giroDaDirecao(it[3]); }
    marcarSelecao();
    if (!cancelar && a.moveu && a.parede && !a.alvo) ed.aoAviso?.('Solte junto de uma parede.');
  }
  function cliqueNaEdicao(e) {
    const p = noChaoDaSala(e);
    if (ed.novo) { if (p) porNovo(p); else ed.aoAviso?.('Ponha dentro da sua sala.'); return; }
    // Clique no chão (fora de uma peça): larga a seleção e mostra a grade.
    selecionarItem(null);
    if (p) mostrarGrade(true);
  }
  function girarPeca() {
    if (!ed) return;
    if (ed.novo) {
      const prox = proximaDirecao(ed.novo.dir, medidaDaPeca(ed.novo.classe).direcoes);
      if (prox == null || ehDeParede(ed.novo.classe)) { ed.aoAviso?.(ehDeParede(ed.novo.classe) ? 'Peça de parede segue a parede.' : 'Esse móvel não gira no Habbo.'); return; }
      ed.novo.dir = prox; if (ed.fantasma) ed.fantasma.rotation.y = giroDaDirecao(prox);
      return;
    }
    const it = ed.itens[ed.sel];
    if (!it) return;
    if (ed.tipoDeParede?.(it[0])) { ed.aoAviso?.('Peça de parede segue a parede: arraste para a outra parede.'); return; }
    const prox = proximaDirecao(it[3], medidaDaPeca(it[0]).direcoes);
    if (prox == null) { ed.aoAviso?.('Esse móvel não gira no Habbo.'); return; }
    if (!cabeNaSala(Number(it[1]), Number(it[2]), pegada(it[0], prox), ed.sl.L)) { ed.aoAviso?.('Girado, ele sairia da sala. Arraste para um lugar livre e gire de novo.'); return; }
    mudar(girarItem(ed.itens, ed.sel, prox), { tipo: 'girar', i: ed.sel });
  }
  function guardarPeca() {
    if (!ed || ed.sel == null) return;
    const r = guardarItem(ed.itens, ed.sel);
    ed.sel = null; mudar(r.itens, { tipo: 'guardar', item: r.item }); ed.aoSelecionar?.(null, null);
  }
  function empurrar(dx, dy) {
    const it = ed.itens[ed.sel];
    if (!it) return;
    if (ed.tipoDeParede?.(it[0])) { ed.aoAviso?.('Peça de parede: arraste para outro trecho da parede.'); return; }
    const a = encaixar(Number(it[1]) + dx, Number(it[2]) + dy, pegada(it[0], it[3]), ed.sl.L);
    if (a.x !== Number(it[1]) || a.y !== Number(it[2])) mudar(moverItem(ed.itens, ed.sel, a.x, a.y, { ehParede: ehDeParede }), { tipo: 'mover', i: ed.sel });
  }
  // Teclas da edição: na captura, antes do Esc do Irecity (que fecharia o andar) e das teclas de andar do
  // Escritório. Campos de texto e a pergunta do painel (confirmarNoPainel) ficam com as teclas deles.
  const SETAS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  function tecla(e) {
    if (!ed || e.ctrlKey || e.metaKey || e.target?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
    if (document.querySelector?.('dialog[open], #cli-pergunta')) return;
    const k = e.key?.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'r') girarPeca();
    else if (k === 'Delete' || k === 'Backspace') { if (ed.sel == null) return; guardarPeca(); }
    else if (k === 'Escape') { if (ed.novo) segurarPeca(null); else if (ed.sel != null) selecionarItem(null); else ed.aoSair?.(); }
    else if (k === 'g') mostrarGrade(!ed.grade);
    else if (SETAS[k] && ed.sel != null && !e.altKey) empurrar(...SETAS[k]);
    else return;
    e.preventDefault(); e.stopPropagation();
  }
  function iniciarEdicao({ sala, itens, aoMudar, aoSelecionar, aoSegurar, aoAviso, aoSair, tipoDeParede, lugarParede } = {}) {
    const sl = salas.find((x) => x.id === sala);
    if (!sl?.L) return false;
    if (ed) pararEdicao();
    const L = sl.L, cx = LADO_SALA / L.w, cz = LADO_SALA / L.d, linhas = [];
    for (let k = 0; k <= L.w; k++) linhas.push(k * cx, .015, 0, k * cx, .015, LADO_SALA);
    for (let k = 0; k <= L.d; k++) linhas.push(0, .015, k * cz, LADO_SALA, .015, k * cz);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(linhas, 3));
    const grade3d = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: COR_OK, transparent: true, opacity: .5, depthWrite: false }));
    const marcador = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: COR_OK, transparent: true, opacity: .35, depthWrite: false }));
    marcador.rotation.x = -Math.PI / 2; marcador.visible = false; marcador.renderOrder = 3;
    const camada = new THREE.Group(); camada.position.set(sl.ox, 0, sl.oz); camada.add(grade3d, marcador); cena.add(camada);
    ed = { sl, itens: copia(Array.isArray(itens) ? itens : sl.itens), sel: null, novo: null, arrasto: null, grade: true, grade3d, marcador, camada, fantasma: null,
      aoMudar, aoSelecionar, aoSegurar, aoAviso, aoSair, tipoDeParede, lugarParede };
    sl.itens = ed.itens;
    montarBase(sl); montarItens(sl);
    window.addEventListener('keydown', tecla, true);
    quer.alvo.set(sl.ox + LADO_SALA / 2, .5, sl.oz + LADO_SALA / 2); quer.dist = LADO_SALA * 2.6;
    return true;
  }
  function pararEdicao() {
    if (!ed) return;
    const sl = ed.sl;
    window.removeEventListener('keydown', tecla, true);
    cena.remove(ed.camada); liberar(ed.camada);
    ed = null; canvas.style.cursor = '';
    sl.decorada = Boolean(sl.itens?.length && sl.L);
    montarBase(sl); montarItens(sl);
  }

  let vivo = true, ultimo = performance.now();
  const v = new THREE.Vector3();
  function rotular(el, x, y, z, r) { v.set(x, y, z).project(camera); el.style.transform = `translate(-50%,-100%) translate(${((v.x * .5 + .5) * r.width).toFixed(1)}px,${((-v.y * .5 + .5) * r.height).toFixed(1)}px)`; }
  function passo(t) {
    if (!vivo) return; requestAnimationFrame(passo);
    if (document.hidden) return;
    const dt = Math.min(.05, (t - ultimo) / 1000); ultimo = t;
    const f = 1 - Math.pow(.001, dt);
    giro += (quer.giro - giro) * f; incl += (quer.incl - incl) * f; dist += (quer.dist - dist) * f; alvo.lerp(quer.alvo, f);
    posicionar();
    const r = canvas.getBoundingClientRect();
    for (const b of pessoas.values()) {
      const dx = b.alvo.x - b.x, dz = b.alvo.z - b.z, anda = Math.hypot(dx, dz) > .02;
      b.x += dx * Math.min(1, dt * 3); b.z += dz * Math.min(1, dt * 3);
      if (anda) b.g.rotation.y = Math.atan2(dx, dz);
      b.g.position.set(b.x, anda ? Math.abs(Math.sin(t / 90)) * .06 : 0, b.z);
      rotular(b.el, b.x, 1.8, b.z, r);
    }
    for (const e of etiquetas) rotular(e.el, e.sl.ox + LADO_SALA / 2, H + .3, e.sl.oz + .4, r);
    renderer.render(cena, camera);
  }
  requestAnimationFrame(passo);
  return {
    W, D, titulo,
    pessoas: definirPessoas,
    aoClicarSala: (f) => { aoSala = f; },
    focarSala(id) { const sl = salas.find((x) => x.id === id); if (sl) { quer.alvo.set(sl.ox + LADO_SALA / 2, .5, sl.oz + LADO_SALA / 2); quer.dist = LADO_SALA * 2.6; } },
    verAndar() { quer.alvo.set(W / 2, .5, D / 2); quer.dist = Math.max(W, D) * 2.1; },
    destruir() { vivo = false; window.removeEventListener('keydown', tecla, true); ro.disconnect(); for (const b of pessoas.values()) b.el.remove(); for (const e of etiquetas) e.el.remove(); renderer.dispose(); },
    // Modo decorar (vybe-mundo-decorar.js). iniciarEdicao({ sala, itens, aoMudar(itens, info), aoSelecionar(i, item),
    // aoSegurar(classe), aoAviso(texto), aoSair(), tipoDeParede(classe) → 'parede' | 'imagem' | '',
    // lugarParede(x, y, fx, fy) → { lx, ly, dir } | null }) → true se a sala existe neste andar e tem tamanho.
    iniciarEdicao,
    pararEdicao,
    editando: () => ed?.sl.id || '',
    selecionar: (i) => selecionarItem(i),
    segurar: (classe) => segurarPeca(classe),
    girar: () => girarPeca(),
    guardar: () => guardarPeca(),
    grade: (sim) => mostrarGrade(sim),
    // Troca a lista inteira (desfazer, sair sem salvar, o que o servidor devolveu ao salvar). Não chama aoMudar.
    definirItens(itens, sala = ed?.sl.id) {
      const sl = salas.find((x) => x.id === sala);
      if (!sl) return;
      const lista = copia(itens);
      if (ed?.sl === sl) { ed.itens = lista; sl.itens = lista; ed.sel = null; montarItens(sl); marcarSelecao(); ed.aoSelecionar?.(null, null); return; }
      sl.itens = lista;
      const antes = sl.decorada; sl.decorada = Boolean(lista.length && sl.L);
      if (antes !== sl.decorada) montarBase(sl);
      montarItens(sl);
    },
    // Piso (as duas cores do ladrilho) e cor das paredes da sala; null volta ao de sempre.
    definirAcabamento(sala, { piso = null, parede = null } = {}) {
      const sl = salas.find((x) => x.id === sala);
      if (!sl) return;
      sl.piso = Array.isArray(piso) && piso.length === 2 && piso.every(ehCor) ? [...piso] : null;
      sl.parede = ehCor(parede) ? parede : null;
      montarBase(sl);
    },
    // Medidas do Habbo ([classe, { x, y, direcoes }]): as peças já desenhadas se ajustam ao tamanho certo.
    medidas(lista) {
      for (const [classe, m] of lista || []) definirMedida(classe, m);
      for (const sl of salas) if (sl.decorada || ed?.sl === sl) montarItens(sl);
      marcarSelecao();
    },
  };
}
