// Bot do xadrez dos Desafios (pedido do Paulo, 27/10/2026: "e no xadrez...
// não tem os bots desafiantes?"). Busca alfa-beta sobre o chess.js, com
// material e posição das peças (tabelas por casa), e capturas até a posição
// acalmar. O nível muda a profundidade, o tempo e o quanto o bot erra:
// o fácil joga quase ao acaso, o médio enxerga 2 lances, o lendário pensa
// até 4 lances dentro de um tempo curto (a resposta não pode demorar).
import { Chess } from 'chess.js';

const VALOR = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// Tabelas por casa, do ponto de vista das brancas (a8 primeiro, h1 por último).
const TABELA = {
 p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
 n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
 b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
 r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
 q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
 k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
 // Rei no fim de jogo: vai para o centro.
 kf: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
};
const MATE = 100000;
const NIVEL = {
 facil: { prof: 1, ms: 300, acaso: 0.45, ruido: 120 },
 medio: { prof: 2, ms: 900, acaso: 0.08, ruido: 25 },
 lendario: { prof: 4, ms: 1800, acaso: 0, ruido: 0 },
};

// Nota da posição para quem tem a vez (positivo = bom para quem joga agora).
function avaliar(c) {
 const tab = c.board();
 let s = 0, pesadas = 0;
 for (const linha of tab) for (const p of linha) if (p && p.type !== 'p' && p.type !== 'k') pesadas += VALOR[p.type];
 const fimDeJogo = pesadas <= 1600;
 for (let i = 0; i < 8; i++) for (let k = 0; k < 8; k++) {
  const p = tab[i][k];
  if (!p) continue;
  const casa = p.color === 'w' ? i * 8 + k : (7 - i) * 8 + k;
  const v = VALOR[p.type] + TABELA[p.type === 'k' && fimDeJogo ? 'kf' : p.type][casa];
  s += p.color === 'w' ? v : -v;
 }
 return c.turn() === 'w' ? s : -s;
}
// Ordem dos lances: capturas que ganham material e promoções primeiro.
const prioridade = (m) => (m.captured ? 10 * VALOR[m.captured] - VALOR[m.piece] + 1000 : 0) + (m.promotion ? 800 : 0) + (m.san.endsWith('+') ? 50 : 0);
const ordenar = (lances) => lances.sort((a, b) => prioridade(b) - prioridade(a));

function criarBusca(fimEm) {
 let nos = 0, estourou = false;
 const tempo = () => { if ((++nos & 255) === 0 && Date.now() > fimEm) estourou = true; return estourou; };
 // Só capturas, até a posição acalmar (o bot não para a conta no meio de uma troca).
 function calma(c, a, b, prof) {
  const parado = avaliar(c);
  if (parado >= b) return b;
  if (parado > a) a = parado;
  if (prof <= 0 || tempo()) return a;
  for (const m of ordenar(c.moves({ verbose: true }).filter((l) => l.captured || l.promotion))) {
   c.move(m);
   const v = -calma(c, -b, -a, prof - 1);
   c.undo();
   if (v >= b) return b;
   if (v > a) a = v;
  }
  return a;
 }
 function busca(c, prof, a, b, distancia) {
  if (c.isCheckmate()) return -MATE + distancia;
  if (c.isDraw()) return 0;
  if (prof <= 0) return calma(c, a, b, 4);
  if (tempo()) return avaliar(c);
  for (const m of ordenar(c.moves({ verbose: true }))) {
   c.move(m);
   const v = -busca(c, prof - 1, -b, -a, distancia + 1);
   c.undo();
   if (v >= b) return b;
   if (v > a) a = v;
  }
  return a;
 }
 return { busca, estourou: () => estourou };
}

// O lance do bot na posição dos lances jogados: { de, para, promocao }.
export function lanceDoBotXadrez(nivel, lances) {
 const cfg = NIVEL[nivel] || NIVEL.medio, c = new Chess();
 for (const san of lances || []) c.move(san);
 const todos = c.moves({ verbose: true });
 if (!todos.length) return null;
 const pedido = (m) => ({ de: m.from, para: m.to, ...(m.promotion ? { promocao: m.promotion } : {}) });
 if (Math.random() < cfg.acaso) return pedido(todos[Math.floor(Math.random() * todos.length)]);
 // Aprofundamento iterativo: fica com a melhor resposta da última profundidade completa.
 const fimEm = Date.now() + cfg.ms;
 let melhores = ordenar([...todos]).map((m) => ({ m, v: 0 }));
 for (let prof = 1; prof <= cfg.prof; prof++) {
  const { busca, estourou } = criarBusca(fimEm), notas = [];
  let a = -Infinity;
  for (const { m } of melhores) {
   c.move(m);
   const v = -busca(c, prof - 1, -Infinity, -a + 1, 1) + (cfg.ruido ? (Math.random() - 0.5) * cfg.ruido : 0);
   c.undo();
   if (estourou()) break;
   notas.push({ m, v });
   if (v > a) a = v;
  }
  if (estourou() && notas.length < melhores.length) {
   // Profundidade pela metade: só vale se achou algo melhor que o melhor de antes.
   if (notas.length && Math.max(...notas.map((n) => n.v)) > melhores[0].v) melhores = [...notas.sort((x, y) => y.v - x.v), ...melhores.filter((n) => !notas.some((o) => o.m === n.m))];
   break;
  }
  melhores = notas.sort((x, y) => y.v - x.v);
 }
 return pedido(melhores[0].m);
}
