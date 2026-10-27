// Truco paulista para dois na Mesa de Jogos do Escritório (pedido do Paulo,
// 27/10/2026). Baralho de 40 cartas (sem 8, 9 e 10), 3 cartas para cada um e
// a vira: a manilha é a carta seguinte à vira (depois do 3 vem o 4), e entre
// as manilhas vale o naipe (ouros < espadas < copas < paus, o zap). A mão é
// melhor de 3 rodadas: empatou a primeira, quem ganhar a seguinte leva;
// empatou depois de alguém ganhar uma, leva quem ganhou primeiro. A mão vale
// 1; truco pede 3, e dá para subir para 6, 9 e 12. Quem corre dá ao outro o
// que valia antes do pedido. Partida até 12. Mão de onze (só um tem 11): a mão
// vale 3 e não tem truco; os dois com 11, vale 1 e também sem truco.
// Cartas: valor + naipe ('4o', 'Qp', 'Ac'); o baralho e a mão do outro ficam
// só no servidor.
import { randomInt } from 'node:crypto';
import { erro } from './escritorio-apostas.js';

const outro = (lado) => (lado === 'desafiante' ? 'desafiado' : 'desafiante');
const VALORES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
const NAIPES = ['o', 'e', 'c', 'p'];
const ALVO = 12;
const PEDIDOS = { 3: 'Truco', 6: 'Seis', 9: 'Nove', 12: 'Doze' };

export function baralhoTruco() {
 const b = [];
 for (const v of VALORES) for (const n of NAIPES) b.push(v + n);
 for (let i = b.length - 1; i > 0; i--) { const k = randomInt(i + 1); [b[i], b[k]] = [b[k], b[i]]; }
 return b;
}
export const manilhaDa = (vira) => VALORES[(VALORES.indexOf(vira[0]) + 1) % VALORES.length];
const forca = (carta, manilha) => (carta[0] === manilha ? 100 + NAIPES.indexOf(carta[1]) : VALORES.indexOf(carta[0]));

// Quem leva a mão pelas rodadas (null = ainda não decidiu).
export function vencedorDaMao(r) {
 const [a, b, c] = r;
 if (r.length < 2) return null;
 if (r.length === 2) {
  if (a !== 'empate' && (b === a || b === 'empate')) return a;
  if (a === 'empate' && b !== 'empate') return b;
  return null;
 }
 if (c !== 'empate') return c;
 return a !== 'empate' ? a : 'empate';
}
const onze = (m) => [m.pontos.desafiante, m.pontos.desafiado].filter((p) => p === ALVO - 1).length;

function novaMao(m, baralho = baralhoTruco()) {
 m.cartas = { desafiante: baralho.slice(0, 3), desafiado: baralho.slice(3, 6) };
 m.vira = baralho[6];
 m.manilha = manilhaDa(m.vira);
 m.rodadas = []; m.naMesa = {}; m.abre = m.pe; m.vez = m.pe;
 m.vale = onze(m) === 1 ? 3 : 1;
 m.ultimoPedido = null; m.pendente = null;
}
export function iniciarTruco(pe = randomInt(2) ? 'desafiante' : 'desafiado', baralho) {
 const m = { pontos: { desafiante: 0, desafiado: 0 }, alvo: ALVO, mao: 1, pe, anterior: null, n: 0, ultimo: null };
 novaMao(m, baralho);
 return m;
}

// Fim da mão: pontos para quem levou; chegou a 12, acabou; senão, mão nova
// e o pé troca.
function fecharMao(m, vencedor, motivo, valor) {
 if (vencedor !== 'empate') m.pontos[vencedor] = Math.min(ALVO, m.pontos[vencedor] + valor);
 m.anterior = { mao: m.mao, vencedor, motivo, valor, rodadas: m.rodadas, vira: m.vira };
 if (vencedor !== 'empate' && m.pontos[vencedor] >= ALVO) return { resultado: vencedor, motivo: 'truco-pontos' };
 m.mao += 1;
 m.pe = outro(m.pe);
 novaMao(m);
 return null;
}

function acoes(m, lado) {
 if (!lado) return null;
 const p = m.pendente, semTruco = onze(m) > 0;
 if (p) return p.de === lado ? { esperando: true } : { responder: p.valor, aumentar: p.valor < 12 ? PEDIDOS[p.valor + 3] : null };
 if (m.vez !== lado) return null;
 return { jogar: true, truco: !semTruco && m.vale < 12 && m.ultimoPedido !== lado ? PEDIDOS[m.vale === 1 ? 3 : m.vale + 3] : null };
}

export function vistaTruco(m, lado, fim) {
 const dele = lado ? outro(lado) : null;
 return {
  minhas: lado ? m.cartas[lado] : null,
  pecas: { desafiante: m.cartas.desafiante.length, desafiado: m.cartas.desafiado.length },
  vira: m.vira, manilha: m.manilha, naMesa: m.naMesa, rodadas: m.rodadas, abre: m.abre, pe: m.pe,
  vale: m.vale, pendente: m.pendente ? { de: m.pendente.de, valor: m.pendente.valor, nome: PEDIDOS[m.pendente.valor] } : null,
  pontos: m.pontos, alvo: m.alvo, mao: m.mao, mao_de_onze: onze(m) === 1, anterior: m.anterior, ultimo: m.ultimo,
  acoes: fim ? null : acoes(m, lado), dele: dele ? m.cartas[dele].length : null,
 };
}

// pedido: { tipo: 'jogar', carta } | { tipo: 'truco' } | { tipo: 'aceitar' } | { tipo: 'correr' } | { tipo: 'aumentar' }.
export function jogarTruco(mesa, lado, pedido) {
 if (mesa.vez !== lado) throw erro('Agora é a vez da outra pessoa.', 409);
 const m = structuredClone(mesa), a = acoes(m, lado), tipo = pedido?.tipo;
 m.n += 1;
 if (tipo === 'truco') {
  if (!a?.truco) throw erro(onze(m) ? 'Na mão de onze não tem truco.' : 'Agora não dá para pedir.', 409);
  const valor = m.vale === 1 ? 3 : m.vale + 3;
  m.pendente = { de: lado, valor, vezAntes: lado };
  m.vez = outro(lado);
  m.ultimo = { lado, acao: 'pediu', valor };
  return { mesa: m, fim: null };
 }
 if (tipo === 'aceitar' || tipo === 'correr' || tipo === 'aumentar') {
  if (!a?.responder) throw erro('Não há pedido para responder.', 409);
  const p = m.pendente;
  if (tipo === 'correr') {
   m.ultimo = { lado, acao: 'correu', valor: p.valor };
   return { mesa: m, fim: fecharMao(m, p.de, 'correu', m.vale) };
  }
  m.vale = p.valor;
  if (tipo === 'aceitar') {
   m.ultimoPedido = p.de; m.pendente = null; m.vez = p.vezAntes;
   m.ultimo = { lado, acao: 'aceitou', valor: m.vale };
   return { mesa: m, fim: null };
  }
  if (!a.aumentar) throw erro('Não dá para subir mais que 12.', 409);
  m.ultimoPedido = p.de;
  m.pendente = { de: lado, valor: m.vale + 3, vezAntes: p.vezAntes };
  m.vez = p.de;
  m.ultimo = { lado, acao: 'pediu', valor: m.vale + 3 };
  return { mesa: m, fim: null };
 }
 if (tipo !== 'jogar') throw erro('Jogada inválida.');
 if (!a?.jogar) throw erro('Responda o pedido antes de jogar.', 409);
 const i = m.cartas[lado].indexOf(String(pedido.carta));
 if (i < 0) throw erro('Essa carta não é sua.');
 const [carta] = m.cartas[lado].splice(i, 1);
 m.naMesa[lado] = carta;
 m.ultimo = { lado, acao: 'jogou', carta };
 const dele = outro(lado);
 if (!m.naMesa[dele]) { m.vez = dele; return { mesa: m, fim: null }; }
 // Os dois jogaram: quem tem a carta mais forte leva a rodada.
 const fa = forca(m.naMesa[lado], m.manilha), fb = forca(m.naMesa[dele], m.manilha);
 const ganhou = fa === fb ? 'empate' : fa > fb ? lado : dele;
 m.rodadas.push({ cartas: { ...m.naMesa }, vencedor: ganhou });
 m.naMesa = {};
 const v = vencedorDaMao(m.rodadas.map((r) => r.vencedor));
 if (v) return { mesa: m, fim: fecharMao(m, v, 'rodadas', m.vale) };
 // Abre a próxima rodada quem ganhou; empatou, abre o pé.
 m.abre = ganhou === 'empate' ? m.pe : ganhou;
 m.vez = m.abre;
 return { mesa: m, fim: null };
}

export const motorTruco = {
 nome: 'Truco',
 motivos: { 'truco-pontos': `Fez ${ALVO} pontos` },
 iniciar: () => iniciarTruco(),
 vista: vistaTruco,
 jogar: jogarTruco,
};
