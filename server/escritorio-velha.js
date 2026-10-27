// Jogo da velha na Mesa de Jogos do Escritório (pedido do Paulo, 27/10/2026):
// melhor de 5, ganha quem fizer 3 rodadas primeiro. Quem começa alterna a
// cada rodada; "deu velha" não conta ponto. Depois de 15 rodadas, quem tiver
// mais vitórias leva (e empate se igual), para a partida não ficar sem fim.
import { randomInt } from 'node:crypto';
import { erro } from './escritorio-apostas.js';

const outro = (lado) => (lado === 'desafiante' ? 'desafiado' : 'desafiante');
const LINHAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const ALVO = 3, RODADAS_MAX = 15;

export function iniciarVelha(comeca = randomInt(2) ? 'desafiante' : 'desafiado') {
 return { tab: Array(9).fill(null), simbolos: { [comeca]: 'X', [outro(comeca)]: 'O' }, comeca, vez: comeca,
  placar: { desafiante: 0, desafiado: 0 }, alvo: ALVO, rodada: 1, anterior: null, n: 0, ultimo: null };
}
const linhaFeita = (tab) => LINHAS.find(([a, b, c]) => tab[a] && tab[a] === tab[b] && tab[a] === tab[c]) || null;

export function vistaVelha(m, lado, fim) {
 return { tab: m.tab, simbolos: m.simbolos, placar: m.placar, alvo: m.alvo, rodada: m.rodada, anterior: m.anterior, ultimo: m.ultimo,
  pode_marcar: !fim && Boolean(lado) && m.vez === lado };
}

// pedido: { tipo: 'marcar', casa: 0 a 8 }.
export function jogarVelha(mesa, lado, pedido) {
 if (mesa.vez !== lado) throw erro('Agora é a vez da outra pessoa.', 409);
 const casa = Number(pedido?.casa);
 if (pedido?.tipo !== 'marcar' || !Number.isInteger(casa) || casa < 0 || casa > 8) throw erro('Jogada inválida.');
 if (mesa.tab[casa]) throw erro('Essa casa já está marcada.', 409);
 const m = structuredClone(mesa);
 m.n += 1;
 m.tab[casa] = m.simbolos[lado];
 m.ultimo = { lado, casa };
 const linha = linhaFeita(m.tab), velha = !linha && m.tab.every(Boolean);
 if (!linha && !velha) { m.vez = outro(lado); return { mesa: m, fim: null }; }
 // Rodada acabou: ponto para quem fez a linha; quem começa a próxima alterna.
 if (linha) m.placar[lado] += 1;
 m.anterior = { rodada: m.rodada, vencedor: linha ? lado : 'empate', linha, tab: m.tab };
 if (linha && m.placar[lado] >= m.alvo) return { mesa: m, fim: { resultado: lado, motivo: 'velha-placar' } };
 if (m.rodada >= RODADAS_MAX) {
  const a = m.placar.desafiante, b = m.placar.desafiado;
  return { mesa: m, fim: { resultado: a === b ? 'empate' : a > b ? 'desafiante' : 'desafiado', motivo: 'velha-rodadas' } };
 }
 m.rodada += 1;
 m.comeca = outro(m.comeca);
 m.simbolos = { [m.comeca]: 'X', [outro(m.comeca)]: 'O' };
 m.tab = Array(9).fill(null);
 m.vez = m.comeca;
 return { mesa: m, fim: null };
}

export const motorVelha = {
 nome: 'Jogo da velha',
 motivos: { 'velha-placar': `Fez ${ALVO} rodadas primeiro`, 'velha-rodadas': `Mais vitórias em ${RODADAS_MAX} rodadas` },
 iniciar: () => iniciarVelha(),
 vista: vistaVelha,
 jogar: jogarVelha,
};
