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

// RAIO: bola das partidas novas (1,6 desde 28/10/2026: a 1,45 ficava pequena
// demais na tela para ler o número; a partida guarda o dela em m.r).
export const LARGURA = 100, ALTURA = 50, R = 1.15, RAIO = 1.6;
// Caçapas medidas no 8 Ball Pool (28/10/2026, Paulo: "por que não copia do
// que já existe?"; em raios de bola, contados do nariz da borracha):
// - canto: a borracha acaba a BOCA_CANTO (2,5) do canto; o buraco, de raio
//   2,2, tem o centro 1,15 para fora nas duas direções (fica na madeira e mal
//   entra no pano);
// - meio: a borracha acaba a BOCA_MEIO (2,2) do centro; o buraco, de raio
//   1,73, tem o centro 2 para fora (fica todo atrás da borracha).
// A ponta da borracha é uma quina: a bola que chega torta bate e volta. A
// bola cai quando passa da linha da borracha pela boca ou quando o centro
// entra no buraco desenhado.
export const BOCA_CANTO = 2.5, BOCA_MEIO = 2.2;
export function cacapas(r) {
 const L = LARGURA, A = ALTURA, c = 1.15 * r, cr = 2.2 * r, f = 2 * r, mr = 1.73 * r;
 return [[-c, -c, cr], [50, -f, mr], [L + c, -c, cr], [-c, A + c, cr], [50, A + f, mr], [L + c, A + c, cr]];
}
function bocas(r) {
 const m = BOCA_CANTO * r, h = BOCA_MEIO * r, L = LARGURA, A = ALTURA;
 const quinas = [[0, m], [m, 0], [L - m, 0], [L, m], [0, A - m], [m, A], [L - m, A], [L, A - m], [50 - h, 0], [50 + h, 0], [50 - h, A], [50 + h, A]];
 // Onde a tabela está aberta (sem borracha para a bola bater).
 const abertaX = (y) => y < m || y > A - m; // tabelas da esquerda e da direita
 const abertaY = (x) => x < m || x > L - m || Math.abs(x - 50) < h; // tabelas de cima e de baixo
 return { quinas, abertaX, abertaY, buracos: cacapas(r) };
}
const RESTITUICAO_QUINA = 0.6;
const PASSO = 1 / 240, QUADRO = 8, PASSOS_MAX = 240 * 15;
const ATRITO = 40, RESTITUICAO_TABELA = 0.78, VEL_MIN = 20, VEL_MAX = 260;
const LISAS = [1, 2, 3, 4, 5, 6, 7], LISTRADAS = [9, 10, 11, 12, 13, 14, 15];
// Par ou ímpar, a sinuca de bar do Brasil (Paulo, 27/10/2026: "tem que ser
// estilo Brasil, ímpar e par"): 7 pares e 7 ímpares. Desde 28/10 (Paulo: "não
// tá todas as bolas") as 15 vão para a mesa, como nos jogos online: a 1 é a
// bola final, encaçapada depois de limpar o grupo (`bola1` na partida).
const PARES = [2, 4, 6, 8, 10, 12, 14], IMPARES = [3, 5, 7, 9, 11, 13, 15];
const GRUPOS = { lisas: LISAS, listradas: LISTRADAS, pares: PARES, impares: IMPARES };
const outro = (lado) => (lado === 'desafiante' ? 'desafiado' : 'desafiante');
const doGrupo = (g, n) => Boolean(GRUPOS[g]?.includes(n));
const restam = (bolas, g) => (GRUPOS[g] || []).filter((n) => bolas[n]).length;

// Triângulo com o ápice na marca (75, 25): a 8 no meio da terceira fileira e
// uma lisa e uma listrada nos cantos de trás.
// modo 'parimpar' (o padrão das partidas novas), a sinuca de bar: 7 pares, 7
// ímpares e a 1, a bola final. A mesa começa aberta (28/10/2026, Paulo: "quem
// matar primeiro fica com o que matou, se foi par (bolas preenchidas) ou ímpar
// (bola com listra branca)"): a primeira bola encaçapada sem falta define o
// grupo. As partidas de 27 e 28/10 sortearam os grupos na saída e terminam assim.
// modo 'bola8': a regra de antes (a partida gravada sem modo é bola 8).
export function iniciarSinuca(quemSai = randomInt(2) ? 'desafiante' : 'desafiado', sortear = randomInt, r = RAIO, modo = 'parimpar') {
 const misturar = (l) => { for (let i = l.length - 1; i > 0; i--) { const k = sortear(i + 1); [l[i], l[k]] = [l[k], l[i]]; } return l; };
 if (modo === 'parimpar') {
  const ordem = misturar([...PARES, ...IMPARES]), bolas = Array(16).fill(null);
  bolas[0] = [25, 25];
  let i = 0, pos = 0;
  for (let fila = 0; fila < 5; fila++) for (let k = 0; k <= fila; k++, pos++) {
   // A 1 no meio da terceira fileira (como a 8 da bola 8).
   const n = pos === 4 ? 1 : ordem[i++];
   bolas[n] = [Math.round((75 + fila * (2 * r * 0.866 + 0.02)) * 1000) / 1000, Math.round((25 + (k - fila / 2) * (2 * r + 0.02)) * 1000) / 1000];
  }
  return { modo, bola1: true, r, bolas, vez: quemSai, grupos: { desafiante: null, desafiado: null }, bolaNaMao: false, tacadas: 0, n: 0, ultimo: null, recentes: [] };
 }
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
 return { modo: 'bola8', r, bolas, vez: quemSai, grupos: { desafiante: null, desafiado: null }, bolaNaMao: false, tacadas: 0, n: 0, ultimo: null, recentes: [] };
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
 const BOCAS = bocas(R);
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
   // O centro entrou no buraco (ou passou da linha da tabela, o que só
   // acontece pela boca): caiu.
   if (p.x < 0 || p.x > LARGURA || p.y < 0 || p.y > ALTURA || BOCAS.buracos.some(([cx, cy, cr]) => Math.hypot(p.x - cx, p.y - cy) < cr)) { b[n] = null; caiu.push(n); evento('caiu', nova); continue; }
   // Quinas da boca: a bola bate na ponta da tabela e volta (com menos força).
   for (const [qx, qy] of BOCAS.quinas) {
    const dx = p.x - qx, dy = p.y - qy, d = Math.hypot(dx, dy);
    if (d >= R || d === 0) continue;
    const nx = dx / d, ny = dy / d, vn = p.vx * nx + p.vy * ny;
    if (vn < 0) { p.vx -= (1 + RESTITUICAO_QUINA) * vn * nx; p.vy -= (1 + RESTITUICAO_QUINA) * vn * ny; if (-vn > 8) evento('tabela', -vn); }
    p.x = qx + nx * R; p.y = qy + ny * R;
   }
   const bateuX = (p.x < R || p.x > LARGURA - R) && !BOCAS.abertaX(p.y), bateuY = (p.y < R || p.y > ALTURA - R) && !BOCAS.abertaY(p.x);
   // Giro lateral da branca: na tabela, empurra ao longo dela (para a direita
   // de quem tacou com giro positivo) na proporção da batida.
   const torce = (normal) => { const t = giro * 0.35 * Math.abs(normal); giro *= 0.6; return t; };
   if (bateuX && p.x < R) { p.x = R; if (n === 0 && giro) p.vy -= torce(p.vx); p.vx = -p.vx * RESTITUICAO_TABELA; }
   if (bateuX && p.x > LARGURA - R) { p.x = LARGURA - R; if (n === 0 && giro) p.vy += torce(p.vx); p.vx = -p.vx * RESTITUICAO_TABELA; }
   if (bateuY && p.y < R) { p.y = R; if (n === 0 && giro) p.vx += torce(p.vy); p.vy = -p.vy * RESTITUICAO_TABELA; }
   if (bateuY && p.y > ALTURA - R) { p.y = ALTURA - R; if (n === 0 && giro) p.vx -= torce(p.vy); p.vy = -p.vy * RESTITUICAO_TABELA; }
   if ((bateuX || bateuY) && nova > 8) evento('tabela', nova);
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

// As tacadas mais recentes, para a tela de quem não viu passar todas (Paulo,
// 28/10/2026: "quando o Vinícius dá uma tacada eu não vejo o que ele fez"):
// quem encaçapa continua, e entre uma consulta e outra cabem várias tacadas.
// Guarda a série da vez atual e a da anterior (até 4), cada uma com o número.
function guardarTacada(m, t) {
 t.n = m.n;
 const lista = (m.recentes || []).concat(t);
 let series = 0;
 for (let i = lista.length - 1; i > 0; i--) if (lista[i].lado !== lista[i - 1].lado && ++series >= 2) { lista.splice(0, i); break; }
 m.recentes = lista.slice(-4);
 m.ultimo = t;
}

export function vistaSinuca(m, lado, fim) {
 const vez = !fim && lado && m.vez === lado;
 return {
  modo: m.modo || 'bola8', bola1: Boolean(m.bola1), r: m.r || R, bolas: m.bolas, vez: m.vez, grupos: m.grupos, bolaNaMao: m.bolaNaMao, tacadas: m.tacadas, n: m.n || 0,
  restam: Object.fromEntries(Object.keys(GRUPOS).map((g) => [g, restam(m.bolas, g)])),
  // Os quadros vão só em `recentes` (a partida gravada antes não tem: a última tacada vale como a lista).
  pode_tacar: Boolean(vez), ultimo: m.ultimo ? { ...m.ultimo, quadros: undefined, eventos: undefined } : null,
  recentes: m.recentes || (m.ultimo ? [{ ...m.ultimo, n: m.n || 0 }] : []),
 };
}

// pedido: { tipo: 'tacar', angulo (radianos), forca (0,05 a 1), efeito (-1 puxar a 1 seguir),
// lado (-1 a 1, efeito lateral), branca: {x, y} (com bola na mão) }.
export function jogarSinuca(mesa, lado, pedido) {
 if (mesa.vez !== lado) throw erro('Agora é a vez da outra pessoa.', 409);
 // Tempo esgotado: falta sem tacada, a vez passa com bola na mão.
 if (pedido?.tipo === 'tempo') {
  const m = structuredClone(mesa);
  m.n = (m.n || 0) + 1; m.vez = outro(lado); m.bolaNaMao = true;
  guardarTacada(m, { lado, quadros: [], eventos: [], caiu: [], primeiro: null, falta: 'tempo' });
  return { mesa: m, fim: null };
 }
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
 if (m.modo === 'parimpar') return parImpar(m, lado, simular(m.bolas, angulo, forca, efeito, r0, lado2), { angulo, forca, efeito, lado2, r0 });
 const saida = m.tacadas === 0, grupo = m.grupos[lado], limpo = grupo ? restam(m.bolas, grupo) === 0 : false;
 const r = simular(m.bolas, angulo, forca, efeito, r0, lado2);
 m.bolas = r.bolas; m.n = (m.n || 0) + 1; m.tacadas += 1;
 // Falta: branca na caçapa, não tocou em nada, tocou primeiro a bola errada.
 const errada = r.primeiro !== null && (grupo ? !(doGrupo(grupo, r.primeiro) || (limpo && r.primeiro === 8)) : r.primeiro === 8 && !saida);
 const falta = r.caiu.includes(0) ? 'branca' : r.primeiro === null ? 'nenhuma' : errada ? 'errada' : null;
 guardarTacada(m, { lado, angulo, forca, efeito, giro: lado2, quadros: r.quadros, eventos: r.eventos, caiu: r.caiu, primeiro: r.primeiro, falta });
 if (r.caiu.includes(8)) {
  if (saida) recolocar(m.bolas, 8, r0);
  else return { mesa: m, fim: !falta && limpo ? { resultado: lado, motivo: 'oito' } : { resultado: outro(lado), motivo: falta ? 'oito-falta' : 'oito-cedo' } };
 }
 // Mesa aberta: a primeira bola encaçapada sem falta define os grupos.
 const caidas = r.caiu.filter((n) => n !== 0 && n !== 8);
 if (!grupo && !falta && caidas.length) {
  const g = caidas[0] < 8 ? 'lisas' : 'listradas';
  m.grupos = { [lado]: g, [outro(lado)]: g === 'lisas' ? 'listradas' : 'lisas' };
  m.ultimo.grupo = g;
 }
 const meu = m.grupos[lado];
 const continua = !falta && caidas.some((n) => !meu || doGrupo(meu, n));
 if (falta) { m.vez = outro(lado); m.bolaNaMao = true; if (m.bolas[0] && falta === 'branca') m.bolas[0] = null; }
 else { m.bolaNaMao = false; if (!continua) m.vez = outro(lado); }
 return { mesa: m, fim: null };
}

// Par ou ímpar: a primeira bola tocada tem que ser do grupo de quem taca;
// branca na caçapa, não tocar em nada ou tocar a do outro é falta (a vez passa
// com bola na mão). Continua quem encaçapa bola sua sem falta. Ganha quem
// encaçapa todas as suas; encaçapar a última do outro dá a vitória a ele; a
// última sua que cai com falta volta para a mesa.
// Com a 1 (bola1): a mesa começa aberta (vale tocar primeiro qualquer bola
// menos a 1) e a primeira bola encaçapada sem falta define os grupos.
function parImpar(m, lado, r, { angulo, forca, efeito, lado2, r0 }) {
 let meu = m.grupos[lado];
 const dele = m.grupos[outro(lado)], aberta = m.bola1 && !meu;
 // Com a 1 na mesa: grupo limpo, a primeira bola a tocar é a 1.
 const limpo = m.bola1 && !aberta && restam(m.bolas, meu) === 0, saida = m.tacadas === 0;
 m.bolas = r.bolas; m.n = (m.n || 0) + 1; m.tacadas += 1;
 const certa = (n) => (aberta ? n !== 1 : limpo ? n === 1 : doGrupo(meu, n));
 const falta = r.caiu.includes(0) ? 'branca' : r.primeiro === null ? 'nenhuma' : !certa(r.primeiro) ? 'errada' : null;
 guardarTacada(m, { lado, angulo, forca, efeito, giro: lado2, quadros: r.quadros, eventos: r.eventos, caiu: r.caiu, primeiro: r.primeiro, falta });
 if (m.bola1) {
  // A 1 na saída volta para a mesa; depois, ganha quem a encaçapa com o grupo
  // limpo e sem falta, e perde quem a derruba antes da hora ou com falta.
  if (r.caiu.includes(1)) {
   if (saida) recolocar(m.bolas, 1, r0);
   else return { mesa: m, fim: !falta && limpo ? { resultado: lado, motivo: 'um' } : { resultado: outro(lado), motivo: falta ? 'um-falta' : 'um-cedo' } };
  }
  // Mesa aberta: a primeira bola encaçapada sem falta define os grupos.
  const caidas = r.caiu.filter((n) => n !== 0 && n !== 1);
  if (aberta && !falta && caidas.length) {
   meu = doGrupo('pares', caidas[0]) ? 'pares' : 'impares';
   m.grupos = { [lado]: meu, [outro(lado)]: meu === 'pares' ? 'impares' : 'pares' };
   m.ultimo.grupo = meu;
  }
  const continua1 = !falta && r.caiu.some((n) => meu && doGrupo(meu, n));
  if (falta) { m.vez = outro(lado); m.bolaNaMao = true; if (m.bolas[0] && falta === 'branca') m.bolas[0] = null; }
  else { m.bolaNaMao = false; if (!continua1) m.vez = outro(lado); }
  return { mesa: m, fim: null };
 }
 if (!falta && restam(m.bolas, meu) === 0) return { mesa: m, fim: { resultado: lado, motivo: 'todas' } };
 if (falta && restam(m.bolas, meu) === 0) { const ultima = [...r.caiu].reverse().find((n) => doGrupo(meu, n)); if (ultima) recolocar(m.bolas, ultima, r0); }
 if (restam(m.bolas, dele) === 0) return { mesa: m, fim: { resultado: outro(lado), motivo: 'ultima-do-outro' } };
 const continua = !falta && r.caiu.some((n) => doGrupo(meu, n));
 if (falta) { m.vez = outro(lado); m.bolaNaMao = true; if (m.bolas[0] && falta === 'branca') m.bolas[0] = null; }
 else { m.bolaNaMao = false; if (!continua) m.vez = outro(lado); }
 return { mesa: m, fim: null };
}

export const motorSinuca = {
 nome: 'Sinuca',
 motivos: { um: 'Encaçapou a 1', 'um-cedo': 'A 1 caiu antes da hora', 'um-falta': 'A 1 caiu com falta', oito: 'Encaçapou a 8', 'oito-cedo': 'A 8 caiu antes da hora', 'oito-falta': 'A 8 caiu com falta', todas: 'Encaçapou todas as suas', 'ultima-do-outro': 'O outro encaçapou a última bola dele por ele' },
 iniciar: () => iniciarSinuca(),
 vista: vistaSinuca,
 jogar: jogarSinuca,
 // Tempo da vez: acabou, é falta (como nos jogos online): a vez passa com bola na mão.
 tempo: 60,
 automatico: () => ({ tipo: 'tempo' }),
};
