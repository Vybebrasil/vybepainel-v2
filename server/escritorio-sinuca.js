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

// ESCALA REAL (Paulo, 28/10/2026: "simular uma partida real pra medidas de
// bola, física, batidas de bola"). O pano tem 100 × 50 unidades e mede 1,90 m
// × 0,95 m (mesa de bar), então 1 unidade = 1,9 cm. Tudo abaixo sai de medida
// de mesa de verdade convertida para essa unidade; nada é "ajuste de tela".
// Bola de 54 mm (RAIO): na tela ela fica legível porque a mesa ocupa mais
// espaço, não porque a bola cresceu. A partida guarda o raio dela em m.r (as
// gravadas antes têm 1,6, 1,45 ou nenhum: R, 1,15).
export const METROS_POR_UNIDADE = 0.019, BOLA_MM = 54;
export const LARGURA = 100, ALTURA = 50, R = 1.15, RAIO = Math.round((BOLA_MM / 2000 / METROS_POR_UNIDADE) * 1000) / 1000;
const G = 9.81 / METROS_POR_UNIDADE;
// Caçapas, bocas e borrachas medidas na arte da mesa (assets/jogos/mesa-bar.webp,
// 13,68 px por unidade), contadas do canto do pano (o nariz da borracha). A
// borracha acaba na boca e a ponta é cortada em diagonal para o buraco (o
// "dente" da caçapa, da boca até o fundo, atrás da linha da tabela): a bola
// que chega torta bate no dente e volta, ou entra quicando nele. A bola cai
// quando o centro passa por cima do buraco.
// - canto: boca a 4,17 do canto (2 bolas de largura, como mesa oficial); dente
//   até 2,12 ao longo e 2,41 para trás; buraco de raio 3,58 com o centro 1,37
//   para fora nas duas direções;
// - meio: boca a 4,1 do centro; dente até 3,44 do centro e 2,19 para trás;
//   buraco de raio 3,36 com o centro 2,92 atrás da tabela.
export const CANTO = { boca: 4.17, fundo: [2.12, 2.41], buraco: [1.37, 3.58] };
export const MEIO = { boca: 4.1, fundo: [3.44, 2.19], buraco: [2.92, 3.36] };
// As paredes (segmentos [x1, y1, x2, y2]: o nariz das seis borrachas e os doze
// dentes) e os seis buracos [x, y, raio].
export function geometria() {
 const L = LARGURA, A = ALTURA, c = CANTO.boca, [fa, fb] = CANTO.fundo, h = MEIO.boca, [ha, hb] = MEIO.fundo;
 const paredes = [
  [c, 0, 50 - h, 0], [50 + h, 0, L - c, 0], [c, A, 50 - h, A], [50 + h, A, L - c, A], [0, c, 0, A - c], [L, c, L, A - c],
  [50 - h, 0, 50 - ha, -hb], [50 + h, 0, 50 + ha, -hb], [50 - h, A, 50 - ha, A + hb], [50 + h, A, 50 + ha, A + hb],
 ];
 const buracos = [[50, -MEIO.buraco[0], MEIO.buraco[1]], [50, A + MEIO.buraco[0], MEIO.buraco[1]]];
 for (const [X, Y, sx, sy] of [[0, 0, 1, 1], [L, 0, -1, 1], [0, A, 1, -1], [L, A, -1, -1]]) {
  paredes.push([X + sx * c, Y, X + sx * fa, Y - sy * fb], [X, Y + sy * c, X - sx * fb, Y + sy * fa]);
  buracos.push([X - sx * CANTO.buraco[0], Y - sy * CANTO.buraco[0], CANTO.buraco[1]]);
 }
 return { paredes, buracos };
}
const GEO = geometria();
export const cacapas = () => GEO.buracos;
// FÍSICA, com os valores medidos em mesa de verdade (Alciatore, "The
// Illustrated Principles of Pool and Billiards"). Cada bola tem a velocidade
// (v), o giro de rolar (w: a velocidade com que rolaria sem escorregar) e o
// efeito lateral (s: o giro em volta do eixo de pé, em velocidade da superfície).
// - Escorregando (v ≠ w): o atrito do pano (μ 0,2) freia v e puxa w até as
//   duas se igualarem (bola maciça: 5v + 2w constante). A tacada no centro sai
//   deslizando e passa a rolar com 5/7 da velocidade.
// - Rolando: a resistência do pano (μ 0,01) freia as duas juntas.
// - O pano gasta o efeito lateral devagar (GIRO_PANO).
// - Choque entre bolas: restituição 0,95 e atrito bola-bola 0,06. A bola
//   acertada num corte sai arrastada um pouco para o lado do corte (o "throw"),
//   e o efeito lateral da branca também arrasta.
// - Tabela: devolve 80% na direção da batida; o atrito da borracha (0,2) age
//   no escorregão do ponto de contato, então o efeito lateral abre ou fecha a
//   volta e a bola que chega torta perde um pouco ao longo da tabela.
const DESLIZE = 0.2 * G, ROLAGEM = 0.01 * G, GIRO_PANO = 0.02 * G;
const E_BOLA = 0.95, MU_BOLA = 0.06, E_TABELA = 0.8, MU_TABELA = 0.2;
// Força: de 0,25 m/s (encostar) a 9 m/s (saída forte), em curva, para a força
// baixa ser fina de controlar.
export const V_MIN = 0.25 / METROS_POR_UNIDADE, V_MAX = 9 / METROS_POR_UNIDADE;
export const velocidadeDaForca = (f) => V_MIN + (V_MAX - V_MIN) * f * f;
const PASSO = 1 / 600, QUADRO = 20, PASSOS_MAX = 600 * 30, V_SOM = 320;
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
// ordem), a primeira bola que a branca tocou, os quadros para a animação (30
// por segundo) e os eventos para o som (choque, tabela, caçapa, com o quadro).
// `efeito` (-1 a 1): altura do taco na branca (em cima segue, embaixo puxa).
// `lado` (-1 a 1): efeito lateral (positivo = taco à direita do centro, visto
// por quem taca). No limite o taco bate a meio raio do centro, o que dá giro
// de 1,25 da velocidade (bola maciça: 5/2 × velocidade × distância / raio).
// `R` é o raio da bola da partida.
export function simular(bolasIni, angulo, forca, efeito = 0, R = RAIO, lado = 0) {
 const b = bolasIni.map((p) => (p ? { x: p[0], y: p[1], vx: 0, vy: 0, wx: 0, wy: 0, s: 0 } : null));
 const v = velocidadeDaForca(forca), dx = Math.cos(angulo), dy = Math.sin(angulo);
 b[0].vx = dx * v; b[0].vy = dy * v;
 b[0].wx = dx * v * efeito * 1.25; b[0].wy = dy * v * efeito * 1.25;
 // s > 0 é o giro em que o ponto da bola na direção m anda para (-m.y, m.x)
 // (na tela, y para baixo). Taco à direita empurra o lado direito da bola
 // para a frente: s negativo.
 b[0].s = -lado * 1.25 * v;
 const caiu = [], quadros = [], eventos = [];
 const evento = (t, f) => {
  const q = quadros.length, ultimo = eventos[eventos.length - 1];
  if (eventos.length < 80 && !(ultimo && ultimo.q === q && ultimo.t === t)) eventos.push({ q, t, f: Math.round(Math.min(1, f / V_SOM) * 100) / 100 });
 };
 let primeiro = null;
 const foto = () => quadros.push(b.flatMap((p) => (p ? [Math.round(p.x * 10), Math.round(p.y * 10)] : [-1, -1])));
 const andando = new Array(16).fill(false);
 andando[0] = true;
 foto();
 for (let passo = 1; passo <= PASSOS_MAX; passo++) {
  let algum = false;
  for (let n = 0; n < 16; n++) {
   const p = b[n];
   if (!p || !andando[n]) continue;
   // Pano: escorregando ou rolando.
   const sx = p.vx - p.wx, sy = p.vy - p.wy, escorrega = Math.hypot(sx, sy);
   if (escorrega > 1e-9) {
    if (escorrega <= 3.5 * DESLIZE * PASSO) {
     const rx = (5 * p.vx + 2 * p.wx) / 7, ry = (5 * p.vy + 2 * p.wy) / 7;
     p.vx = rx; p.vy = ry; p.wx = rx; p.wy = ry;
    } else {
     const ux = sx / escorrega, uy = sy / escorrega, a = DESLIZE * PASSO;
     p.vx -= ux * a; p.vy -= uy * a; p.wx += ux * 2.5 * a; p.wy += uy * 2.5 * a;
    }
   } else {
    const vel = Math.hypot(p.vx, p.vy);
    if (vel > 0) { const f = Math.max(0, vel - ROLAGEM * PASSO) / vel; p.vx *= f; p.vy *= f; }
    p.wx = p.vx; p.wy = p.vy;
   }
   if (p.s) p.s = Math.sign(p.s) * Math.max(0, Math.abs(p.s) - GIRO_PANO * PASSO);
   const vel = Math.hypot(p.vx, p.vy);
   if (vel < 0.2 && Math.hypot(p.wx, p.wy) < 0.2) { p.vx = 0; p.vy = 0; p.wx = 0; p.wy = 0; p.s = 0; andando[n] = false; continue; }
   algum = true;
   p.x += p.vx * PASSO; p.y += p.vy * PASSO;
   // Caiu: o centro passou por cima do buraco (ou, por segurança, saiu da mesa).
   if (GEO.buracos.some(([cx, cy, cr]) => (p.x - cx) ** 2 + (p.y - cy) ** 2 < cr * cr) || p.x < -6 || p.x > LARGURA + 6 || p.y < -6 || p.y > ALTURA + 6) {
    b[n] = null; andando[n] = false; caiu.push(n); evento('caiu', vel); continue;
   }
   // Paredes (o nariz das borrachas e os dentes das caçapas): só perto da tabela.
   if (p.x > R + 0.5 && p.x < LARGURA - R - 0.5 && p.y > R + 0.5 && p.y < ALTURA - R - 0.5) continue;
   for (const [x1, y1, x2, y2] of GEO.paredes) {
    const ex = x2 - x1, ey = y2 - y1, t = Math.max(0, Math.min(1, ((p.x - x1) * ex + (p.y - y1) * ey) / (ex * ex + ey * ey)));
    const qx = x1 + ex * t, qy = y1 + ey * t, ddx = p.x - qx, ddy = p.y - qy, d = Math.hypot(ddx, ddy);
    if (d >= R || d === 0) continue;
    // n: da parede para a bola. O ponto de contato fica em -R·n, e o efeito
    // lateral faz esse ponto andar ao longo de t = (n.y, -n.x).
    const nx = ddx / d, ny = ddy / d, tx = ny, ty = -nx, vn = p.vx * nx + p.vy * ny;
    p.x = qx + nx * R; p.y = qy + ny * R;
    if (vn >= 0) continue;
    // A normal volta com 80%; o atrito da borracha freia o escorregão do
    // ponto de contato (velocidade ao longo da tabela + efeito lateral).
    const jn = -(1 + E_TABELA) * vn, desliza = p.vx * tx + p.vy * ty + p.s;
    const jt = -Math.sign(desliza) * Math.min(MU_TABELA * jn, Math.abs(desliza) / 3.5);
    p.vx += jn * nx + jt * tx; p.vy += jn * ny + jt * ty; p.s += 2.5 * jt;
    // A borracha pega a bola acima do centro: ela sai rolando na direção nova.
    const wn = p.wx * nx + p.wy * ny, vn2 = p.vx * nx + p.vy * ny;
    p.wx += (vn2 - wn) * nx; p.wy += (vn2 - wn) * ny;
    if (-vn > 12) evento('tabela', -vn);
   }
  }
  // Choques entre bolas (massas iguais).
  for (let i = 0; i < 16; i++) {
   const p = b[i];
   if (!p) continue;
   for (let k = i + 1; k < 16; k++) {
    const q = b[k];
    if (!q || (!andando[i] && !andando[k])) continue;
    const ddx = q.x - p.x, ddy = q.y - p.y, d2 = ddx * ddx + ddy * ddy;
    if (d2 >= 4 * R * R || d2 === 0) continue;
    const d = Math.sqrt(d2), nx = ddx / d, ny = ddy / d, rel = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
    if (rel > 0) {
     const jn = ((1 + E_BOLA) / 2) * rel;
     // Atrito no ponto de contato: o escorregão é a velocidade relativa ao
     // longo do contato (t = (-n.y, n.x)) mais o efeito lateral das duas.
     const tx = -ny, ty = nx, desliza = (p.vx - q.vx) * tx + (p.vy - q.vy) * ty + p.s + q.s;
     const jt = -Math.sign(desliza) * Math.min(MU_BOLA * jn, Math.abs(desliza) / 7);
     p.vx += -jn * nx + jt * tx; p.vy += -jn * ny + jt * ty;
     q.vx += jn * nx - jt * tx; q.vy += jn * ny - jt * ty;
     p.s += 2.5 * jt; q.s += 2.5 * jt;
     andando[i] = andando[k] = true;
     if (primeiro === null && i === 0) primeiro = k;
     if (jn > 4) evento('bola', jn);
    }
    const sobra = (2 * R - d) / 2;
    p.x -= nx * sobra; p.y -= ny * sobra; q.x += nx * sobra; q.y += ny * sobra;
   }
  }
  if (passo % QUADRO === 0 || !algum) foto();
  if (!algum) break;
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
