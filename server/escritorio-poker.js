// Pôquer nas mesas do Escritório (pedido do Paulo, 27/10/2026): Texas Hold'em
// para dois, até um ficar com todas as fichas. Cada um começa com 1.000 fichas
// (as fichas são do jogo; a aposta de VybeCoins/itens é a da mesa, em
// escritorio-apostas.js). Blinds 10/20 que dobram a cada 10 mãos, para a
// partida acabar. Quem tem o botão paga o small blind e fala primeiro antes do
// flop; depois do flop fala primeiro o big blind. A força da mão é do
// pokersolver (MIT). Baralho e cartas ficam só no servidor: a vista de cada um
// mostra as próprias cartas, e as do outro só quando a mão vai ao showdown.
import { randomInt } from 'node:crypto';
import pokersolver from 'pokersolver';
import { erro } from './escritorio-apostas.js';

const { Hand } = pokersolver;
const LADOS = ['desafiante', 'desafiado'];
const FICHAS = 1000, BLIND = 20, MAOS_POR_NIVEL = 10;
const outro = (lado) => (lado === 'desafiante' ? 'desafiado' : 'desafiante');
const NOMES = { 'High Card': 'Carta alta', Pair: 'Par', 'Two Pair': 'Dois pares', 'Three of a Kind': 'Trinca', Straight: 'Sequência',
 Flush: 'Flush', 'Full House': 'Full house', 'Four of a Kind': 'Quadra', 'Straight Flush': 'Straight flush', 'Royal Flush': 'Royal flush' };

export function baralho() {
 const b = [];
 for (const r of '23456789TJQKA') for (const n of 'shdc') b.push(r + n);
 for (let i = b.length - 1; i > 0; i--) { const k = randomInt(i + 1); [b[i], b[k]] = [b[k], b[i]]; }
 return b;
}
const dosDois = (v) => ({ desafiante: v, desafiado: v });

function apostar(m, lado, v) {
 const x = Math.min(v, m.fichas[lado]);
 m.fichas[lado] -= x; m.rodada[lado] += x; m.posto[lado] += x;
}
// Mão nova: botão troca, blinds sobem a cada 10 mãos, duas cartas para cada um.
function novaMao(m, embaralhado = baralho()) {
 m.mao = (m.mao || 0) + 1;
 m.blind = BLIND * 2 ** Math.floor((m.mao - 1) / MAOS_POR_NIVEL);
 if (m.mao > 1) m.botao = outro(m.botao);
 m.baralho = embaralhado;
 m.cartas = { [m.botao]: [m.baralho.pop(), m.baralho.pop()], [outro(m.botao)]: [m.baralho.pop(), m.baralho.pop()] };
 m.comunitarias = [];
 m.fase = 'preflop';
 m.posto = dosDois(0); m.rodada = dosDois(0); m.agiu = dosDois(false);
 apostar(m, m.botao, m.blind / 2);
 apostar(m, outro(m.botao), m.blind);
 m.aumento = m.blind;
 m.vez = m.botao;
}

export function iniciarPoker(botao = randomInt(2) ? 'desafiante' : 'desafiado', embaralhado) {
 const m = { fichas: dosDois(FICHAS), botao, n: 0, ultimo: null, anterior: null };
 novaMao(m, embaralhado);
 return m;
}

const pagarDe = (m, lado) => Math.max(0, m.rodada[outro(lado)] - m.rodada[lado]);
// A rodada fecha quando os dois falaram (ou estão sem fichas) e as apostas
// batem, ou quem pôs menos está sem fichas (all-in).
function fechada(m) {
 const pronto = (l) => m.agiu[l] || m.fichas[l] === 0;
 if (!LADOS.every(pronto)) return false;
 const [a, b] = LADOS;
 if (m.rodada[a] === m.rodada[b]) return true;
 return m.fichas[m.rodada[a] < m.rodada[b] ? a : b] === 0;
}

// Fim da mão: quem largou perde o que pôs; no showdown, o pote casado vai para
// a melhor mão (empate divide) e o que ninguém pagou volta para o dono.
function fimDaMao(m, vencedor, showdown) {
 const casado = Math.min(m.posto.desafiante, m.posto.desafiado);
 const pote = m.posto.desafiante + m.posto.desafiado;
 if (!showdown) m.fichas[vencedor] += pote;
 else {
  for (const l of LADOS) m.fichas[l] += m.posto[l] - casado;
  if (vencedor === 'empate') { m.fichas[m.botao] += casado; m.fichas[outro(m.botao)] += casado; }
  else m.fichas[vencedor] += 2 * casado;
 }
 m.anterior = { mao: m.mao, vencedor, pote, comunitarias: m.comunitarias,
  maos: showdown ? Object.fromEntries(LADOS.map((l) => [l, { cartas: m.cartas[l], nome: showdown[l] }])) : null };
 const quebrado = LADOS.find((l) => m.fichas[l] === 0);
 if (quebrado) return { resultado: outro(quebrado), motivo: 'fichas' };
 novaMao(m);
 // Blind maior que as fichas já deixa alguém all-in: a mão anda sozinha.
 return andar(m);
}
function showdown(m) {
 while (m.comunitarias.length < 5) m.comunitarias.push(m.baralho.pop());
 const maos = Object.fromEntries(LADOS.map((l) => [l, Hand.solve([...m.cartas[l], ...m.comunitarias])]));
 const ganhou = Hand.winners([maos.desafiante, maos.desafiado]);
 const vencedor = ganhou.length > 1 ? 'empate' : ganhou[0] === maos.desafiante ? 'desafiante' : 'desafiado';
 return fimDaMao(m, vencedor, Object.fromEntries(LADOS.map((l) => [l, NOMES[maos[l].name] || maos[l].name])));
}
// Depois de cada jogada: fecha a rodada, abre o flop/turn/river, vai ao
// showdown, ou passa a vez (pulando quem está sem fichas).
function andar(m) {
 for (;;) {
  if (fechada(m)) {
   if (m.fase === 'river' || LADOS.some((l) => m.fichas[l] === 0)) return showdown(m);
   m.fase = m.fase === 'preflop' ? 'flop' : m.fase === 'flop' ? 'turn' : 'river';
   m.comunitarias.push(...Array.from({ length: m.fase === 'flop' ? 3 : 1 }, () => m.baralho.pop()));
   m.rodada = dosDois(0); m.agiu = dosDois(false); m.aumento = m.blind;
   m.vez = outro(m.botao);
   continue;
  }
  if (m.fichas[m.vez] === 0) { m.agiu[m.vez] = true; m.vez = outro(m.vez); continue; }
  return null;
 }
}

// O que quem tem a vez pode fazer: passar (mesa), pagar, aumentar até um
// total da rodada entre min e max, ou largar.
function acoes(m, lado) {
 const pagar = pagarDe(m, lado), tudo = m.rodada[lado] + m.fichas[lado], maior = Math.max(m.rodada.desafiante, m.rodada.desafiado);
 const pode = m.fichas[outro(lado)] > 0 && tudo > maior;
 return { pagar: Math.min(pagar, m.fichas[lado]), mesa: pagar === 0, aumentar: pode ? { min: Math.min(maior + m.aumento, tudo), max: tudo } : null };
}

export function vistaPoker(m, lado, fim) {
 const vez = !fim && lado && m.vez === lado;
 return {
  mao: m.mao, blind: m.blind, botao: m.botao, fase: m.fase, comunitarias: m.comunitarias,
  fichas: m.fichas, rodada: m.rodada, pote: m.posto.desafiante + m.posto.desafiado,
  minhas: lado ? m.cartas[lado] : null,
  minha_mao: lado && !fim ? minhaMao(m, lado) : null,
  acoes: vez ? acoes(m, lado) : null,
  ultimo: m.ultimo || null, anterior: m.anterior || null,
 };
}

// O que a pessoa tem agora com as próprias cartas e as da mesa ("Par", "Dois pares").
function minhaMao(m, lado) {
 const h = Hand.solve([...(m.cartas[lado] || []), ...m.comunitarias]);
 return NOMES[h.name] || h.name;
}

// pedido: { tipo: 'largar' | 'mesa' | 'pagar' | 'aumentar', valor } (valor = total da rodada).
export function jogarPoker(mesa, lado, pedido) {
 if (mesa.vez !== lado) throw erro('Agora é a vez da outra pessoa.', 409);
 const m = structuredClone(mesa), a = acoes(m, lado), tipo = pedido?.tipo;
 m.n = (m.n || 0) + 1;
 if (tipo === 'largar') {
  m.ultimo = { lado, acao: 'largou', mao: m.mao };
  return { mesa: m, fim: fimDaMao(m, outro(lado), null) };
 }
 if (tipo === 'mesa') {
  if (!a.mesa) throw erro(`Para continuar, pague ${a.pagar} fichas.`, 409);
  m.ultimo = { lado, acao: 'mesa', mao: m.mao };
 } else if (tipo === 'pagar') {
  if (a.mesa) throw erro('Não há aposta para pagar: passe ou aposte.', 409);
  apostar(m, lado, a.pagar);
  m.ultimo = { lado, acao: 'pagou', valor: a.pagar, mao: m.mao };
 } else if (tipo === 'aumentar') {
  const alvo = Number(pedido.valor);
  if (!a.aumentar) throw erro('Não dá para aumentar agora.', 409);
  if (!Number.isInteger(alvo) || alvo < a.aumentar.min || alvo > a.aumentar.max) throw erro(`Aposte de ${a.aumentar.min} a ${a.aumentar.max} fichas.`);
  const maior = Math.max(m.rodada.desafiante, m.rodada.desafiado);
  m.aumento = Math.max(m.aumento, alvo - maior);
  apostar(m, lado, alvo - m.rodada[lado]);
  m.agiu[outro(lado)] = false;
  m.ultimo = { lado, acao: m.fichas[lado] === 0 ? 'all-in' : maior ? 'aumentou' : 'apostou', valor: alvo, mao: m.mao };
 } else throw erro('Jogada inválida.');
 m.agiu[lado] = true;
 m.vez = outro(lado);
 if (m.fichas[lado] === 0 && tipo !== 'aumentar') m.ultimo.acao = 'all-in';
 return { mesa: m, fim: andar(m) };
}

export const motorPoker = {
 nome: 'Pôquer',
 motivos: { fichas: 'Ficou com todas as fichas' },
 iniciar: () => iniciarPoker(),
 vista: vistaPoker,
 jogar: jogarPoker,
};
