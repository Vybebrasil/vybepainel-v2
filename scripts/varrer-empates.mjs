// Varredura de faces empatadas no mundo voxel (Paulo, 13/11/2026: "confere tudo... um bug de luz e sombra"): monta o
// Centro, o Prédio e as peças do motor de móveis fora do navegador e procura duas caixas de cores diferentes com uma face
// no mesmo plano e se sobrepondo. Na tela isso vira z-fighting: a placa de vídeo alterna a cor a cada triângulo e o
// desenho muda com o zoom (parece luz e sombra quebradas). Uso: node scripts/varrer-empates.mjs [--detalhes]
import * as THREE from 'three';
import { Obra, folgaDaCaixa } from '../mundo/voxel.mjs';

const caixas = [];
let obraAtual = 0;
const original = Obra.prototype.caixa;
Obra.prototype.caixa = function (x, y, z, w, h, d, cor, ...resto) {
  if (!this.__id) this.__id = ++obraAtual;
  caixas.push({ obra: this.__id, x, y, z, w, h, d, cor: String(cor), onde: new Error().stack.split('\n')[2]?.trim() || '' });
  return original.call(this, x, y, z, w, h, d, cor, ...resto);
};

// Faces empatadas: mesmo plano (topo/fundo, frente/trás ou lados) e sobreposição de área nas duas outras direções.
// Mede como a placa de vídeo recebe: com a folga de cada caixa (folgaDaCaixa, a mesma do Obra.montar).
export function empates(lista0, { tol = 1.5e-4, minArea = 1e-4, folga = true } = {}) {
  const lista = folga ? lista0.map((b, k) => { const f = folgaDaCaixa(b, k); return { ...b, w: b.w + f, h: b.h + f, d: b.d + f, y: b.y - f / 2 }; }) : lista0;
  const achados = [];
  const faces = (b) => [
    // Só as faces que a câmera vê (topo, +x e +z, como na vista do mundo e do quarto), cada uma com o seu sentido:
    // faces opostas no mesmo plano são blocos encostados (escondidas), não brigam na tela.
    ['y+', b.y + b.h, [b.x - b.w / 2, b.x + b.w / 2], [b.z - b.d / 2, b.z + b.d / 2]],
    ['x+', b.x + b.w / 2, [b.y, b.y + b.h], [b.z - b.d / 2, b.z + b.d / 2]], ['x-', b.x - b.w / 2, [b.y, b.y + b.h], [b.z - b.d / 2, b.z + b.d / 2]],
    ['z+', b.z + b.d / 2, [b.x - b.w / 2, b.x + b.w / 2], [b.y, b.y + b.h]], ['z-', b.z - b.d / 2, [b.x - b.w / 2, b.x + b.w / 2], [b.y, b.y + b.h]],
  ];
  const balde = new Map();
  lista.forEach((b, i) => faces(b).forEach(([eixo, v, a, c]) => {
    const k = eixo + ':' + Math.round(v * 2e3); // balde de 0,5 mm; a conta fina vem depois
    if (!balde.has(k)) balde.set(k, []); balde.get(k).push({ i, a, c, v });
  }));
  for (const grupo of balde.values()) {
    if (grupo.length < 2) continue;
    for (let p = 0; p < grupo.length; p++) for (let q = p + 1; q < grupo.length; q++) {
      const A = grupo[p], B = grupo[q], bA = lista[A.i], bB = lista[B.i];
      if (bA.cor === bB.cor || Math.abs(A.v - B.v) > tol) continue;
      const oa = Math.min(A.a[1], B.a[1]) - Math.max(A.a[0], B.a[0]), oc = Math.min(A.c[1], B.c[1]) - Math.max(A.c[0], B.c[0]);
      if (oa > .02 && oc > .02 && oa * oc > minArea) achados.push({ A: bA, B: bB, area: oa * oc });
    }
  }
  return achados;
}

if (String(process.argv[1] || '').endsWith('varrer-empates.mjs')) {
  const { construirCentro } = await import('../mundo/centro.mjs');
  const motor = { THREE, cena: new THREE.Scene(), adicionar() {}, rotulo: () => ({}), removerRotulo() {}, clicavel() {}, naoClicavel() {}, animar() {}, invalidar() {} };
  globalThis.document = globalThis.document || { createElement: () => ({ getContext: () => null, style: {} }) };
  const centro = construirCentro(motor, { quantos: 18 });
  try { centro.definir?.(Array.from({ length: 18 }, (_, k) => ({ nome: 'Cliente ' + k, segmento: ['restaurante', 'clinica', 'academia', 'loja', 'pet', 'escritorio'][k % 6], status: [] }))); } catch (e) { console.log('lojas:', e.message); }
  const porObra = new Map(); for (const b of caixas) { if (!porObra.has(b.obra)) porObra.set(b.obra, []); porObra.get(b.obra).push(b); }
  let total = 0; const porLugar = new Map();
  for (const lista of porObra.values()) for (const e of empates(lista)) { total++; const k = e.A.onde + ' x ' + e.B.onde; porLugar.set(k, (porLugar.get(k) || 0) + 1); }
  let grandes = 0; const lugaresGrandes = new Map();
  for (const lista of porObra.values()) for (const e of empates(lista)) if (e.area > .01) { grandes++; const k = e.A.onde.slice(-34) + ' x ' + e.B.onde.slice(-34) + ' ' + e.A.cor + '/' + e.B.cor; lugaresGrandes.set(k, (lugaresGrandes.get(k) || 0) + 1); }
  if (process.argv.includes('--grandes')) for (const [k, n] of lugaresGrandes) console.log('  grande', n, k);
  console.log('caixas', caixas.length, 'empates', total, 'visíveis (área > 1 cm² × 100)', grandes);
  for (const [k, n] of [...porLugar].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(String(n).padStart(5), k.replace(/file:\/\/\/[^ ]*\/mundo\//g, ''));
  if (process.argv.includes('--detalhes')) for (const lista of porObra.values()) for (const e of empates(lista).slice(0, 3)) console.log(JSON.stringify({ A: { ...e.A, onde: e.A.onde.slice(-30) }, B: { ...e.B, onde: e.B.onde.slice(-30) } }));
}
