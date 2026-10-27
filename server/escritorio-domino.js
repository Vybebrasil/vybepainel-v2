// Dominó nas mesas do Escritório (pedido do Paulo, 27/10/2026): dominó de
// compra para dois, numa mão só. 28 peças, 7 para cada um e 14 no monte.
// Começa quem tem a maior carroça (sem carroça, a peça mais alta) e ela abre
// o jogo. Na vez, joga uma peça que encaixa numa ponta; sem peça, compra do
// monte; monte vazio, passa. Ganha quem bate (acaba as peças); jogo trancado
// (os dois passam) ganha quem tem menos pontos na mão. Só o servidor sabe as
// mãos: a vista de cada um mostra as próprias peças e quantas o outro tem.
import { randomInt } from 'node:crypto';
import { erro } from './escritorio-apostas.js';

const LADOS = ['desafiante', 'desafiado'];
const outro = (lado) => (lado === 'desafiante' ? 'desafiado' : 'desafiante');
const pontos = (mao) => mao.reduce((s, [a, b]) => s + a + b, 0);
const igual = (p, q) => (p[0] === q[0] && p[1] === q[1]) || (p[0] === q[1] && p[1] === q[0]);
const ordenar = (mao) => [...mao].sort((p, q) => q[0] + q[1] - (p[0] + p[1]) || Math.max(...q) - Math.max(...p));

export function todasAsPecas() {
 const p = [];
 for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) p.push([a, b]);
 return p;
}
const embaralhar = (lista) => {
 for (let i = lista.length - 1; i > 0; i--) { const k = randomInt(i + 1); [lista[i], lista[k]] = [lista[k], lista[i]]; }
 return lista;
};

// Quem abre: a maior carroça das duas mãos; sem carroça, a peça mais alta.
function abertura(maos) {
 for (let d = 6; d >= 0; d--) for (const lado of LADOS) if (maos[lado].some((p) => p[0] === d && p[1] === d)) return { lado, peca: [d, d] };
 let melhor = null;
 for (const lado of LADOS) for (const p of maos[lado]) {
  if (!melhor || p[0] + p[1] > melhor.peca[0] + melhor.peca[1] || (p[0] + p[1] === melhor.peca[0] + melhor.peca[1] && Math.max(...p) > Math.max(...melhor.peca))) melhor = { lado, peca: p };
 }
 return melhor;
}

export function iniciarDomino(pecas = embaralhar(todasAsPecas())) {
 const maos = { desafiante: pecas.slice(0, 7), desafiado: pecas.slice(7, 14) };
 const a = abertura(maos);
 return { maos, monte: pecas.slice(14), linha: [], vez: a.lado, abertura: a.peca, passes: 0, n: 0, ultimo: null };
}

// Partida em várias mãos (Paulo, 27/10/2026: "até 100 pontos, como no dominó
// de bar"). Quem bate, ou tem menos pontos no trancado, ganha os pontos da mão
// do outro; trancado empatado não dá ponto. Chegou a `alvo`, acabou. Partidas
// antigas não têm `alvo` e terminam na primeira mão, como antes.
export const DOMINO_ALVO = 100;
function darMao(m, pecas = embaralhar(todasAsPecas())) {
 const nova = iniciarDomino(pecas);
 Object.assign(m, { maos: nova.maos, monte: nova.monte, linha: [], vez: nova.vez, abertura: nova.abertura, passes: 0 });
}
function fimDaMao(m, vencedor, motivo) {
 if (!m.alvo) return { resultado: vencedor, motivo };
 const ganho = vencedor === 'empate' ? 0 : pontos(m.maos[outro(vencedor)]);
 if (ganho) m.placar[vencedor] += ganho;
 m.anterior = { mao: m.mao, vencedor, motivo, ganho, maos: m.maos, pontos: { desafiante: pontos(m.maos.desafiante), desafiado: pontos(m.maos.desafiado) } };
 if (vencedor !== 'empate' && m.placar[vencedor] >= m.alvo) return { resultado: vencedor, motivo: 'pontos' };
 m.mao += 1;
 darMao(m);
 return null;
}

// Peças da mão que encaixam agora, com as pontas onde cabem.
function jogaveis(mesa, lado) {
 const mao = mesa.maos[lado] || [];
 if (!mesa.linha.length) return mao.filter((p) => !mesa.abertura || igual(p, mesa.abertura)).map((p) => ({ peca: p, pontas: ['dir'] }));
 const esq = mesa.linha[0][0], dir = mesa.linha[mesa.linha.length - 1][1];
 return mao.map((p) => ({ peca: p, pontas: [p.includes(esq) && 'esq', p.includes(dir) && 'dir'].filter(Boolean) })).filter((j) => j.pontas.length);
}

// O que cada um vê: a linha, as próprias peças e o que pode fazer agora. No
// fim, as duas mãos aparecem (para conferir o trancado).
export function vistaDomino(mesa, lado, fim) {
 const linha = mesa.linha || [], vez = !fim && lado === mesa.vez;
 const pode = vez ? jogaveis(mesa, lado) : [];
 return {
  linha, pontas: linha.length ? [linha[0][0], linha[linha.length - 1][1]] : null,
  monte: (mesa.monte || []).length,
  mao: lado ? ordenar(mesa.maos[lado]) : null,
  pecas: { desafiante: mesa.maos.desafiante.length, desafiado: mesa.maos.desafiado.length },
  jogaveis: pode,
  pode_comprar: vez && !pode.length && mesa.monte.length > 0,
  pode_passar: vez && !pode.length && !mesa.monte.length,
  abertura: !linha.length ? mesa.abertura : null,
  ultimo: mesa.ultimo || null,
  placar: mesa.placar || null, alvo: mesa.alvo || 0, numero_mao: mesa.mao || 1, anterior: mesa.anterior || null,
  revelado: fim ? { maos: mesa.maos, pontos: { desafiante: pontos(mesa.maos.desafiante), desafiado: pontos(mesa.maos.desafiado) } } : null,
 };
}

const pecaValida = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isInteger(v) && v >= 0 && v <= 6);

// pedido: { tipo: 'jogar', peca: [a, b], ponta: 'esq'|'dir' } | { tipo: 'comprar' } | { tipo: 'passar' }.
// Devolve a mesa nova e, se acabou, { resultado, motivo }.
export function jogarDomino(mesa, lado, pedido) {
 if (mesa.vez !== lado) throw erro('Agora é a vez da outra pessoa.', 409);
 const m = structuredClone(mesa), mao = m.maos[lado], pode = jogaveis(m, lado);
 m.n = (m.n || 0) + 1;
 if (pedido?.tipo === 'comprar') {
  if (pode.length) throw erro('Você tem peça que encaixa: jogue.', 409);
  if (!m.monte.length) throw erro('O monte acabou: passe a vez.', 409);
  mao.push(m.monte.pop());
  m.ultimo = { lado, acao: 'comprou' };
  return { mesa: m, fim: null };
 }
 if (pedido?.tipo === 'passar') {
  if (pode.length) throw erro('Você tem peça que encaixa: jogue.', 409);
  if (m.monte.length) throw erro('Ainda tem peça no monte: compre.', 409);
  m.passes = (m.passes || 0) + 1;
  m.ultimo = { lado, acao: 'passou' };
  m.vez = outro(lado);
  if (m.passes < 2) return { mesa: m, fim: null };
  const a = pontos(m.maos.desafiante), b = pontos(m.maos.desafiado);
  return { mesa: m, fim: fimDaMao(m, a === b ? 'empate' : a < b ? 'desafiante' : 'desafiado', 'trancado') };
 }
 if (pedido?.tipo !== 'jogar' || !pecaValida(pedido.peca)) throw erro('Jogada inválida.');
 const i = mao.findIndex((p) => igual(p, pedido.peca));
 if (i < 0) throw erro('Essa peça não é sua.');
 const op = pode.find((j) => igual(j.peca, pedido.peca));
 if (!op) throw erro(m.linha.length ? 'Essa peça não encaixa.' : 'Abra com a maior carroça.');
 // Pontas com o mesmo número dão no mesmo: não precisa escolher.
 const mesmas = m.linha.length && m.linha[0][0] === m.linha[m.linha.length - 1][1];
 const ponta = pedido.ponta || (op.pontas.length === 1 || mesmas ? op.pontas[op.pontas.length - 1] : null);
 if (!op.pontas.includes(ponta)) throw erro('Escolha em qual ponta.');
 const [x, y] = mao[i];
 if (!m.linha.length) m.linha.push([x, y]);
 else if (ponta === 'esq') { const e = m.linha[0][0]; m.linha.unshift(y === e ? [x, y] : [y, x]); }
 else { const d = m.linha[m.linha.length - 1][1]; m.linha.push(x === d ? [x, y] : [y, x]); }
 mao.splice(i, 1);
 m.abertura = null;
 m.passes = 0;
 m.ultimo = { lado, acao: 'jogou', peca: [x, y], ponta };
 m.vez = outro(lado);
 return { mesa: m, fim: mao.length ? null : fimDaMao(m, lado, 'batida') };
}

export const motorDomino = {
 nome: 'Dominó',
 motivos: { batida: 'Bateu', trancado: 'Jogo trancado: menos pontos na mão', pontos: `Chegou a ${DOMINO_ALVO} pontos` },
 iniciar: () => ({ ...iniciarDomino(), placar: { desafiante: 0, desafiado: 0 }, alvo: DOMINO_ALVO, mao: 1, anterior: null }),
 vista: vistaDomino,
 jogar: jogarDomino,
};
