// Pôquer nas mesas do Escritório (pedido do Paulo, 27/10/2026): Texas Hold'em
// de dois a quatro na mesma mesa, até um ficar com todas as fichas. Cada um
// começa com 1.000 fichas (as fichas são do jogo; a aposta de VybeCoins/itens
// é a da mesa, em escritorio-apostas.js). Blinds 10/20 que dobram a cada 10
// mãos, para a partida acabar. A dois, quem tem o botão paga o small blind e
// fala primeiro antes do flop; com três ou mais, os blinds são os dois à
// esquerda do botão e fala primeiro o seguinte. Depois do flop fala o primeiro
// à esquerda do botão. All-in de valores diferentes abre pote paralelo: cada
// um disputa só o que pôde cobrir. A força da mão é do pokersolver (MIT).
// Baralho e cartas ficam só no servidor: a vista de cada um mostra as próprias
// cartas, e as dos outros só quando a mão vai ao showdown.
//
// Lados: 'desafiante', 'desafiado', 'jogador3', 'jogador4' (m.lados, na ordem
// da mesa). Partida gravada antes do pôquer em grupo não tem m.lados: é a dois.
import { randomInt } from 'node:crypto';
import pokersolver from 'pokersolver';
import { erro } from './escritorio-apostas.js';

const { Hand } = pokersolver;
const DOIS = ['desafiante', 'desafiado'];
const FICHAS = 1000, BLIND = 20, MAOS_POR_NIVEL = 10;
const NOMES = { 'High Card': 'Carta alta', Pair: 'Par', 'Two Pair': 'Dois pares', 'Three of a Kind': 'Trinca', Straight: 'Sequência',
 Flush: 'Flush', 'Full House': 'Full house', 'Four of a Kind': 'Quadra', 'Straight Flush': 'Straight flush', 'Royal Flush': 'Royal flush' };

export function baralho() {
 const b = [];
 for (const r of '23456789TJQKA') for (const n of 'shdc') b.push(r + n);
 for (let i = b.length - 1; i > 0; i--) { const k = randomInt(i + 1); [b[i], b[k]] = [b[k], b[i]]; }
 return b;
}
const deTodos = (m, v) => Object.fromEntries(m.lados.map((l) => [l, v]));
// Partida antiga (a dois, sem os campos do grupo) ganha os campos que faltam.
function completar(m) {
 m.lados ||= DOIS;
 m.naMao ||= m.lados.filter((l) => m.fichas[l] > 0 || m.posto?.[l] > 0);
 m.fora ||= {}; m.saiu ||= {};
 return m;
}
// Na mão e sem largar; dos que estão na partida, quem ainda tem fichas.
const ativos = (m) => m.naMao.filter((l) => !m.fora[l]);
const naPartida = (m) => m.lados.filter((l) => !m.saiu[l] && (m.fichas[l] > 0 || (m.naMao.includes(l) && !m.fora[l])));
// O próximo da mesa depois de `lado` (na ordem dos lugares) entre `lista`.
function proximo(m, lado, lista) {
 const i = m.lados.indexOf(lado);
 for (let k = 1; k <= m.lados.length; k++) { const l = m.lados[(i + k) % m.lados.length]; if (lista.includes(l)) return l; }
 return null;
}
const maior = (m) => Math.max(...m.naMao.map((l) => m.rodada[l]));

function apostar(m, lado, v) {
 const x = Math.min(v, m.fichas[lado]);
 m.fichas[lado] -= x; m.rodada[lado] += x; m.posto[lado] += x;
}
// Mão nova: botão anda, blinds sobem a cada 10 mãos, duas cartas para cada um
// (a começar pelo botão).
function novaMao(m, embaralhado = baralho()) {
 m.mao = (m.mao || 0) + 1;
 m.blind = BLIND * 2 ** Math.floor((m.mao - 1) / MAOS_POR_NIVEL);
 m.naMao = m.lados.filter((l) => m.fichas[l] > 0 && !m.saiu[l]);
 if (m.mao > 1 || !m.naMao.includes(m.botao)) m.botao = proximo(m, m.botao, m.naMao);
 m.baralho = embaralhado;
 m.cartas = {};
 for (let k = 0, l = m.botao; k < m.naMao.length; k++, l = proximo(m, l, m.naMao)) m.cartas[l] = [m.baralho.pop(), m.baralho.pop()];
 m.comunitarias = [];
 m.fase = 'preflop';
 m.posto = deTodos(m, 0); m.rodada = deTodos(m, 0); m.agiu = deTodos(m, false); m.fora = {};
 const dois = m.naMao.length === 2;
 const pequeno = dois ? m.botao : proximo(m, m.botao, m.naMao), grande = proximo(m, pequeno, m.naMao);
 apostar(m, pequeno, m.blind / 2);
 apostar(m, grande, m.blind);
 m.aumento = m.blind;
 m.vez = dois ? m.botao : proximo(m, grande, m.naMao);
}

// lados: quem está na mesa, na ordem dos lugares (2 a 4).
export function iniciarPoker(botao, embaralhado, lados = DOIS) {
 const m = { lados: [...lados], n: 0, ultimo: null, anterior: null, fora: {}, saiu: {} };
 m.fichas = deTodos(m, FICHAS);
 m.botao = botao && lados.includes(botao) ? botao : lados[randomInt(lados.length)];
 novaMao(m, embaralhado);
 return m;
}

// A rodada fecha quando todo mundo que ainda está na mão falou e cobriu a
// maior aposta (ou está sem fichas: all-in).
function fechada(m) {
 const alto = maior(m);
 return ativos(m).every((l) => m.fichas[l] === 0 || (m.agiu[l] && m.rodada[l] === alto));
}

// Fim da mão. Sem showdown (todo mundo largou), o pote vai para quem ficou.
// No showdown, o pote é dividido em camadas pelo que cada um pôs: cada camada
// vai para a melhor mão entre quem cobriu aquele valor (empate divide; a ficha
// que sobra da divisão vai para o primeiro à esquerda do botão), e o que
// ninguém pagou volta para o dono.
function fimDaMao(m, sozinho, solucoes) {
 const pote = m.lados.reduce((s, l) => s + m.posto[l], 0), ganhos = deTodos(m, 0);
 // Quem levou o pote principal, o que todos disputam (dividido: "empate").
 let principal = [sozinho];
 if (sozinho) ganhos[sozinho] = pote;
 else {
  const disputam = ativos(m);
  const niveis = [...new Set(m.lados.map((l) => m.posto[l]).filter((v) => v > 0))].sort((a, b) => a - b);
  let antes = 0;
  principal = null;
  for (const nivel of niveis) {
   const camada = m.lados.reduce((s, l) => s + Math.min(m.posto[l], nivel) - Math.min(m.posto[l], antes), 0);
   const podem = disputam.filter((l) => m.posto[l] >= nivel);
   // Ninguém que ainda disputa cobriu: é sobra de quem largou, volta para ele.
   const melhores = podem.length ? Hand.winners(podem.map((l) => solucoes[l])).map((h) => podem.find((l) => solucoes[l] === h)) : m.lados.filter((l) => m.posto[l] >= nivel);
   if (podem.length && !principal) principal = melhores;
   const parte = Math.floor(camada / melhores.length);
   for (const l of melhores) ganhos[l] += parte;
   if (camada - parte * melhores.length) ganhos[proximo(m, m.botao, melhores)] += camada - parte * melhores.length;
   antes = nivel;
  }
 }
 for (const l of m.lados) m.fichas[l] += ganhos[l];
 m.anterior = { mao: m.mao, vencedor: principal.length > 1 ? 'empate' : principal[0], pote, comunitarias: m.comunitarias,
  ganhos: Object.fromEntries(m.lados.filter((l) => ganhos[l] > 0).map((l) => [l, ganhos[l]])),
  maos: solucoes ? Object.fromEntries(ativos(m).map((l) => [l, { cartas: m.cartas[l], nome: NOMES[solucoes[l].name] || solucoes[l].name }])) : null };
 const restam = m.lados.filter((l) => m.fichas[l] > 0 && !m.saiu[l]);
 if (restam.length === 1) return { resultado: restam[0], motivo: 'fichas' };
 novaMao(m);
 // Blind maior que as fichas já deixa alguém all-in: a mão anda sozinha.
 return andar(m);
}
function showdown(m) {
 while (m.comunitarias.length < 5) m.comunitarias.push(m.baralho.pop());
 return fimDaMao(m, null, Object.fromEntries(ativos(m).map((l) => [l, Hand.solve([...m.cartas[l], ...m.comunitarias])])));
}
// Depois de cada jogada: acaba a mão se só sobrou um, fecha a rodada, abre o
// flop/turn/river, vai ao showdown, ou passa a vez (pulando quem está sem fichas).
function andar(m) {
 for (;;) {
  if (ativos(m).length === 1) return fimDaMao(m, ativos(m)[0], null);
  if (fechada(m)) {
   if (m.fase === 'river' || ativos(m).filter((l) => m.fichas[l] > 0).length <= 1) return showdown(m);
   m.fase = m.fase === 'preflop' ? 'flop' : m.fase === 'flop' ? 'turn' : 'river';
   m.comunitarias.push(...Array.from({ length: m.fase === 'flop' ? 3 : 1 }, () => m.baralho.pop()));
   m.rodada = deTodos(m, 0); m.agiu = deTodos(m, false); m.aumento = m.blind;
   m.vez = proximo(m, m.botao, ativos(m).filter((l) => m.fichas[l] > 0));
   continue;
  }
  if (m.fichas[m.vez] === 0 || m.fora[m.vez]) { m.agiu[m.vez] = true; m.vez = proximo(m, m.vez, ativos(m)); continue; }
  return null;
 }
}

// O que quem tem a vez pode fazer: passar (mesa), pagar, aumentar até um
// total da rodada entre min e max, ou largar.
function acoes(m, lado) {
 const alto = maior(m), pagar = Math.max(0, alto - m.rodada[lado]), tudo = m.rodada[lado] + m.fichas[lado];
 const pode = ativos(m).some((l) => l !== lado && m.fichas[l] > 0) && tudo > alto;
 return { pagar: Math.min(pagar, m.fichas[lado]), mesa: pagar === 0, aumentar: pode ? { min: Math.min(alto + m.aumento, tudo), max: tudo } : null };
}

export function vistaPoker(mesa, lado, fim) {
 const m = completar(structuredClone(mesa));
 const vez = !fim && lado && m.vez === lado;
 return {
  mao: m.mao, blind: m.blind, botao: m.botao, fase: m.fase, comunitarias: m.comunitarias,
  lados: m.lados, na_mao: m.naMao, fora: m.lados.filter((l) => m.fora[l]), saiu: m.lados.filter((l) => m.saiu[l]),
  fichas: m.fichas, rodada: m.rodada, pote: m.lados.reduce((s, l) => s + m.posto[l], 0),
  minhas: lado ? m.cartas[lado] || null : null,
  minha_mao: lado && !fim && m.cartas[lado] ? minhaMao(m, lado) : null,
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
 if (mesa.vez !== lado) throw erro('Agora é a vez de outra pessoa.', 409);
 const m = completar(structuredClone(mesa)), a = acoes(m, lado), tipo = pedido?.tipo;
 m.n = (m.n || 0) + 1;
 if (tipo === 'largar') {
  m.fora[lado] = true;
  m.ultimo = { lado, acao: 'largou', mao: m.mao };
 } else if (tipo === 'mesa') {
  if (!a.mesa) throw erro(`Para continuar, pague ${a.pagar} fichas.`, 409);
  m.ultimo = { lado, acao: 'mesa', mao: m.mao };
 } else if (tipo === 'pagar') {
  if (a.mesa) throw erro('Não há aposta para pagar: passe ou aposte.', 409);
  apostar(m, lado, a.pagar);
  m.ultimo = { lado, acao: m.fichas[lado] === 0 ? 'all-in' : 'pagou', valor: a.pagar, mao: m.mao };
 } else if (tipo === 'aumentar') {
  const alvo = Number(pedido.valor);
  if (!a.aumentar) throw erro('Não dá para aumentar agora.', 409);
  if (!Number.isInteger(alvo) || alvo < a.aumentar.min || alvo > a.aumentar.max) throw erro(`Aposte de ${a.aumentar.min} a ${a.aumentar.max} fichas.`);
  const alto = maior(m);
  m.aumento = Math.max(m.aumento, alvo - alto);
  apostar(m, lado, alvo - m.rodada[lado]);
  for (const l of ativos(m)) if (l !== lado) m.agiu[l] = false;
  m.ultimo = { lado, acao: m.fichas[lado] === 0 ? 'all-in' : alto ? 'aumentou' : 'apostou', valor: alvo, mao: m.mao };
 } else throw erro('Jogada inválida.');
 m.agiu[lado] = true;
 m.vez = proximo(m, lado, ativos(m)) || lado;
 return { mesa: m, fim: andar(m) };
}

// Alguém sai da partida em grupo (desistiu ou sumiu na vez dele): larga a mão
// e as fichas dele saem do jogo. Se sobrou um só, a partida acaba com ele.
export function sairPoker(mesa, lado, motivo) {
 const m = completar(structuredClone(mesa));
 m.n = (m.n || 0) + 1;
 m.saiu[lado] = true; m.fichas[lado] = 0;
 if (m.naMao.includes(lado)) { m.fora[lado] = true; m.agiu[lado] = true; }
 m.ultimo = { lado, acao: 'saiu', mao: m.mao };
 const restam = naPartida(m);
 if (restam.length === 1) return { mesa: m, fim: { resultado: restam[0], motivo } };
 if (m.vez === lado) m.vez = proximo(m, lado, ativos(m));
 return { mesa: m, fim: andar(m) };
}
// Partida largada: ganha quem tem mais fichas.
export function liderPoker(mesa) {
 const m = completar(structuredClone(mesa));
 return naPartida(m).sort((a, b) => (m.fichas[b] + m.posto[b]) - (m.fichas[a] + m.posto[a]))[0];
}

export const motorPoker = {
 nome: 'Pôquer',
 motivos: { fichas: 'Ficou com todas as fichas' },
 // Até quantos na mesma mesa (os outros jogos são de dois).
 grupo: 4,
 iniciar: (lados) => iniciarPoker(undefined, undefined, lados),
 vista: vistaPoker,
 jogar: jogarPoker,
 sair: sairPoker,
 lider: liderPoker,
 // Tempo da vez, como nas salas online: acabou, passa se puder, senão larga.
 tempo: 30,
 automatico: (mesa, lado) => (vistaPoker(mesa, lado, false).acoes?.mesa ? { tipo: 'mesa' } : { tipo: 'largar' }),
};
