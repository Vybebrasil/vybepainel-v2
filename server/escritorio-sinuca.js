// Sinuca na mesa de bilhar do Escritório (pedido do Paulo, 27/10/2026): bola 8
// para dois. O navegador só manda a tacada (ângulo e força, e onde põe a
// branca quando tem bola na mão); a física roda aqui, a mesa anda até parar e
// a vista leva os quadros para a tela animar. Ninguém trapaceia na física.
// Mesa de 100 × 50 (proporção oficial), seis caçapas. Bola de raio 1,45 nas
// partidas novas (Paulo, 27/10/2026: "impossível de jogar"; no tamanho oficial,
// 1,15, a bola ficava pequena demais na tela, e os jogos de sinuca online usam
// bola maior). A partida guarda o raio (m.r); a gravada antes não tem e é 1,15.
// Regras: lisas 1–7, listradas 9–15. A mesa fica aberta até a primeira bola
// encaçapada sem falta definir os grupos. Continua quem encaçapa bola sua sem
// falta. Falta (branca na caçapa, não tocar em nada, tocar primeiro bola do
// outro, ou a 8 com a mesa aberta) dá bola na mão para o outro. Ganha quem
// encaçapa a 8 depois de limpar o grupo; a 8 antes disso, ou com falta, perde.
// Na saída a 8 encaçapada volta para a marca.
import { randomInt } from 'node:crypto';
import { erro } from './escritorio-apostas.js';

export const LARGURA = 100, ALTURA = 50, R = 1.15, RAIO = 1.45;
// Caçapas: canto e meio, com a boca proporcional à bola.
const cacapas = (r) => [[0, 0, 2.43 * r], [50, -0.3, 2 * r], [100, 0, 2.43 * r], [0, 50, 2.43 * r], [50, 50.3, 2 * r], [100, 50, 2.43 * r]];
const PASSO = 1 / 240, QUADRO = 8, PASSOS_MAX = 240 * 15;
const ATRITO = 40, RESTITUICAO_TABELA = 0.78, VEL_MIN = 20, VEL_MAX = 260;
const LISAS = [1, 2, 3, 4, 5, 6, 7], LISTRADAS = [9, 10, 11, 12, 13, 14, 15];
const outro = (lado) => (lado === 'desafiante' ? 'desafiado' : 'desafiante');
const doGrupo = (g, n) => (g === 'lisas' ? n >= 1 && n <= 7 : g === 'listradas' ? n >= 9 && n <= 15 : false);
const restam = (bolas, g) => (g === 'lisas' ? LISAS : LISTRADAS).filter((n) => bolas[n]).length;

// Triângulo com o ápice na marca (75, 25): a 8 no meio da terceira fileira e
// uma lisa e uma listrada nos cantos de trás.
export function iniciarSinuca(quemSai = randomInt(2) ? 'desafiante' : 'desafiado', sortear = randomInt, r = RAIO) {
 const misturar = (l) => { for (let i = l.length - 1; i > 0; i--) { const k = sortear(i + 1); [l[i], l[k]] = [l[k], l[i]]; } return l; };
 const lisas = misturar([...LISAS]), listradas = misturar([...LISTRADAS]);
 // Posições do triângulo: 4 = meio da terceira fileira, 10 e 14 = cantos de trás.
 const fixas = { 4: 8, 10: lisas.pop(), 14: listradas.pop() }, resto = misturar([...lisas, ...listradas]);
 const ordem = Array.from({ length: 15 }, (_, i) => fixas[i] ?? resto.pop());
 const bolas = Array(16).fill(null);
 bolas[0] = [25, 25];
 let i = 0;
 for (let fila = 0; fila < 5; fila++) for (let k = 0; k <= fila; k++) {
  bolas[ordem[i++]] = [Math.round((75 + fila * (2 * r * 0.866 + 0.02)) * 1000) / 1000, Math.round((25 + (k - fila / 2) * (2 * r + 0.02)) * 1000) / 1000];
 }
 return { r, bolas, vez: quemSai, grupos: { desafiante: null, desafiado: null }, bolaNaMao: false, tacadas: 0, n: 0, ultimo: null };
}

// Roda a tacada até tudo parar. Devolve as bolas no fim, o que caiu (na
// ordem), a primeira bola que a branca tocou, os quadros para a animação e os
// eventos para o som (choque, tabela, caçapa, com o quadro em que acontecem).
// `efeito` (-1 a 1): no primeiro choque a branca ganha velocidade para a
// frente (seguir) ou para trás (puxar), proporcional à força do choque.
// `lado` (-1 a 1, efeito lateral, como nos jogos de sinuca online): a cada
// tabela a branca sai abrindo para um lado, e o giro vai gastando (0,6 por
// tabela, e o choque com outra bola tira quase todo).
export function simular(bolasIni, angulo, forca, efeito = 0, R = 1.15, lado = 0) {
 const CACAPAS = cacapas(R);
 const b = bolasIni.map((p) => (p ? { x: p[0], y: p[1], vx: 0, vy: 0 } : null));
 const v = VEL_MIN + (VEL_MAX - VEL_MIN) * forca, dirX = Math.cos(angulo), dirY = Math.sin(angulo);
 b[0].vx = dirX * v; b[0].vy = dirY * v;
 const caiu = [], quadros = [], eventos = [];
 const evento = (t, f) => {
  const q = quadros.length, ultimo = eventos[eventos.length - 1];
  if (eventos.length < 80 && !(ultimo && ultimo.q === q && ultimo.t === t)) eventos.push({ q, t, f: Math.round(Math.min(1, f / VEL_MAX) * 100) / 100 });
 };
 let primeiro = null, giro = lado;
 const foto = () => quadros.push(b.flatMap((p) => (p ? [Math.round(p.x * 10), Math.round(p.y * 10)] : [-1, -1])));
 foto();
 for (let passo = 1; passo <= PASSOS_MAX; passo++) {
  let andando = false;
  for (let n = 0; n < 16; n++) {
   const p = b[n];
   if (!p) continue;
   const vel = Math.hypot(p.vx, p.vy);
   if (vel === 0) continue;
   const nova = Math.max(0, vel - ATRITO * PASSO);
   if (nova < 0.3) { p.vx = 0; p.vy = 0; continue; }
   p.vx *= nova / vel; p.vy *= nova / vel;
   p.x += p.vx * PASSO; p.y += p.vy * PASSO;
   andando = true;
   if (CACAPAS.some(([cx, cy, cr]) => Math.hypot(p.x - cx, p.y - cy) < cr)) { b[n] = null; caiu.push(n); evento('caiu', nova); continue; }
   const bateu = p.x < R || p.x > LARGURA - R || p.y < R || p.y > ALTURA - R;
   // Giro lateral da branca: na tabela, empurra ao longo dela (para a direita
   // de quem tacou com giro positivo) na proporção da batida.
   const torce = (normal) => { const t = giro * 0.35 * Math.abs(normal); giro *= 0.6; return t; };
   if (p.x < R) { p.x = R; if (n === 0 && giro) p.vy -= torce(p.vx); p.vx = -p.vx * RESTITUICAO_TABELA; }
   if (p.x > LARGURA - R) { p.x = LARGURA - R; if (n === 0 && giro) p.vy += torce(p.vx); p.vx = -p.vx * RESTITUICAO_TABELA; }
   if (p.y < R) { p.y = R; if (n === 0 && giro) p.vx += torce(p.vy); p.vy = -p.vy * RESTITUICAO_TABELA; }
   if (p.y > ALTURA - R) { p.y = ALTURA - R; if (n === 0 && giro) p.vx -= torce(p.vy); p.vy = -p.vy * RESTITUICAO_TABELA; }
   if (bateu && nova > 8) evento('tabela', nova);
  }
  // Choques entre bolas (massas iguais, quase elástico).
  for (let i = 0; i < 16; i++) for (let k = i + 1; k < 16; k++) {
   const p = b[i], q = b[k];
   if (!p || !q) continue;
   const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
   if (d >= 2 * R || d === 0) continue;
   const nx = dx / d, ny = dy / d, rel = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
   if (rel > 0) {
    const j = rel * 0.97;
    p.vx -= j * nx; p.vy -= j * ny; q.vx += j * nx; q.vy += j * ny;
    // A branca é sempre a 0, então é o `p` do par.
    if (primeiro === null && i === 0) { primeiro = k; giro *= 0.25; if (efeito) { p.vx += efeito * 0.75 * j * dirX; p.vy += efeito * 0.75 * j * dirY; } }
    if (j > 3) evento('bola', j);
    andando = true;
   }
   const sobra = (2 * R - d) / 2;
   p.x -= nx * sobra; p.y -= ny * sobra; q.x += nx * sobra; q.y += ny * sobra;
  }
  if (passo % QUADRO === 0 || !andando) foto();
  if (!andando) break;
 }
 return { bolas: b.map((p) => (p ? [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100] : null)), caiu, primeiro, quadros, eventos };
}

const livre = (bolas, x, y, ignorar = -1, r = R) => bolas.every((p, n) => !p || n === ignorar || Math.hypot(p[0] - x, p[1] - y) >= 2 * r + 0.05);
// A 8 que cai na saída volta para a marca (ou o mais perto livre atrás dela).
function recolocar(bolas, n, r) {
 for (let x = 75; x < LARGURA - r; x += 0.5) if (livre(bolas, x, 25, -1, r)) { bolas[n] = [x, 25]; return; }
}

export function vistaSinuca(m, lado, fim) {
 const vez = !fim && lado && m.vez === lado;
 return {
  r: m.r || R, bolas: m.bolas, vez: m.vez, grupos: m.grupos, bolaNaMao: m.bolaNaMao, tacadas: m.tacadas,
  restam: { lisas: restam(m.bolas, 'lisas'), listradas: restam(m.bolas, 'listradas') },
  pode_tacar: Boolean(vez), ultimo: m.ultimo || null,
 };
}

// pedido: { tipo: 'tacar', angulo (radianos), forca (0,05 a 1), efeito (-1 puxar a 1 seguir),
// lado (-1 a 1, efeito lateral), branca: {x, y} (com bola na mão) }.
export function jogarSinuca(mesa, lado, pedido) {
 if (mesa.vez !== lado) throw erro('Agora é a vez da outra pessoa.', 409);
 if (pedido?.tipo !== 'tacar') throw erro('Jogada inválida.');
 const angulo = Number(pedido.angulo), forca = Number(pedido.forca), efeito = Number(pedido.efeito || 0), lado2 = Number(pedido.lado || 0);
 if (!Number.isFinite(angulo) || Math.abs(angulo) > 7) throw erro('Mire de novo.');
 if (!Number.isFinite(forca) || forca < 0.05 || forca > 1) throw erro('Escolha a força da tacada.');
 if (!Number.isFinite(efeito) || Math.abs(efeito) > 1 || !Number.isFinite(lado2) || Math.abs(lado2) > 1) throw erro('Efeito inválido.');
 const m = structuredClone(mesa), r0 = m.r || R;
 if (m.bolaNaMao || !m.bolas[0]) {
  const x = Number(pedido.branca?.x), y = Number(pedido.branca?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < r0 || x > LARGURA - r0 || y < r0 || y > ALTURA - r0) throw erro('Ponha a branca na mesa.');
  if (!livre(m.bolas, x, y, 0, r0)) throw erro('A branca está em cima de outra bola.');
  m.bolas[0] = [x, y];
 }
 const saida = m.tacadas === 0, grupo = m.grupos[lado], limpo = grupo ? restam(m.bolas, grupo) === 0 : false;
 const r = simular(m.bolas, angulo, forca, efeito, r0, lado2);
 m.bolas = r.bolas; m.n = (m.n || 0) + 1; m.tacadas += 1;
 // Falta: branca na caçapa, não tocou em nada, tocou primeiro a bola errada.
 const errada = r.primeiro !== null && (grupo ? !(doGrupo(grupo, r.primeiro) || (limpo && r.primeiro === 8)) : r.primeiro === 8 && !saida);
 const falta = r.caiu.includes(0) ? 'branca' : r.primeiro === null ? 'nenhuma' : errada ? 'errada' : null;
 m.ultimo = { lado, angulo, forca, efeito, giro: lado2, quadros: r.quadros, eventos: r.eventos, caiu: r.caiu, primeiro: r.primeiro, falta };
 if (r.caiu.includes(8)) {
  if (saida) recolocar(m.bolas, 8, r0);
  else return { mesa: m, fim: !falta && limpo ? { resultado: lado, motivo: 'oito' } : { resultado: outro(lado), motivo: falta ? 'oito-falta' : 'oito-cedo' } };
 }
 // Mesa aberta: a primeira bola encaçapada sem falta define os grupos.
 const caidas = r.caiu.filter((n) => n !== 0 && n !== 8);
 if (!grupo && !falta && caidas.length) {
  const g = caidas[0] < 8 ? 'lisas' : 'listradas';
  m.grupos = { [lado]: g, [outro(lado)]: g === 'lisas' ? 'listradas' : 'lisas' };
 }
 const meu = m.grupos[lado];
 const continua = !falta && caidas.some((n) => !meu || doGrupo(meu, n));
 if (falta) { m.vez = outro(lado); m.bolaNaMao = true; if (m.bolas[0] && falta === 'branca') m.bolas[0] = null; }
 else { m.bolaNaMao = false; if (!continua) m.vez = outro(lado); }
 return { mesa: m, fim: null };
}

export const motorSinuca = {
 nome: 'Sinuca',
 motivos: { oito: 'Encaçapou a 8', 'oito-cedo': 'A 8 caiu antes da hora', 'oito-falta': 'A 8 caiu com falta' },
 iniciar: () => iniciarSinuca(),
 vista: vistaSinuca,
 jogar: jogarSinuca,
};
