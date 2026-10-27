// Dama na Mesa de Jogos do Escritório (pedido do Paulo, 27/10/2026), regras
// brasileiras no tabuleiro 8×8: peças nas casas escuras, brancas começam. A
// peça comum anda uma casa para a frente na diagonal e captura para a frente
// e para trás; a dama anda e captura a qualquer distância (dama voadora).
// Captura é obrigatória e vale a lei da maioria: só valem as sequências que
// tomam o maior número de peças. As peças tomadas saem no fim do lance (não se
// pula a mesma duas vezes). Coroa quem termina o lance na última fileira. Quem
// fica sem lance perde; 20 lances de cada lado só com damas, sem captura,
// empatam. Tabuleiro: 64 casas, i = fileira × 8 + coluna, fileira 0 em cima;
// 'b'/'B' brancas (comum/dama), 'p'/'P' pretas.
import { randomInt } from 'node:crypto';
import { erro } from './escritorio-apostas.js';

const outro = (lado) => (lado === 'desafiante' ? 'desafiado' : 'desafiante');
const DIRECOES = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const SEM_PROGRESSO_MAX = 40;
const corDaPeca = (p) => (p.toLowerCase() === 'b' ? 'brancas' : 'pretas');
const ehDama = (p) => p === 'B' || p === 'P';
const dentro = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function tabuleiroInicial() {
 const t = Array(64).fill(null);
 for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) {
  if (r <= 2) t[r * 8 + c] = 'p';
  else if (r >= 5) t[r * 8 + c] = 'b';
 }
 return t;
}

// Sequências de captura a partir da casa `i` (todas, de qualquer tamanho).
function capturasDe(tab, i) {
 const peca = tab[i], minha = corDaPeca(peca), dama = ehDama(peca), saida = [];
 const vazia = (x) => tab[x] === null || x === i;
 const inimiga = (x) => tab[x] !== null && x !== i && corDaPeca(tab[x]) !== minha;
 const busca = (pos, tomadas, caminho) => {
  let seguiu = false;
  const r0 = Math.floor(pos / 8), c0 = pos % 8;
  for (const [dr, dc] of DIRECOES) {
   if (!dama) {
    const r1 = r0 + dr, c1 = c0 + dc, r2 = r0 + 2 * dr, c2 = c0 + 2 * dc;
    if (!dentro(r2, c2)) continue;
    const meio = r1 * 8 + c1, pouso = r2 * 8 + c2;
    if (inimiga(meio) && !tomadas.includes(meio) && vazia(pouso)) { seguiu = true; busca(pouso, [...tomadas, meio], [...caminho, pouso]); }
    continue;
   }
   // Dama voadora: corre pelas vazias até a primeira peça; se for inimiga
   // (ainda não tomada), pousa em qualquer vazia depois dela.
   let r = r0 + dr, c = c0 + dc;
   while (dentro(r, c) && vazia(r * 8 + c)) { r += dr; c += dc; }
   if (!dentro(r, c)) continue;
   const alvo = r * 8 + c;
   if (!inimiga(alvo) || tomadas.includes(alvo)) continue;
   r += dr; c += dc;
   while (dentro(r, c) && vazia(r * 8 + c)) { seguiu = true; busca(r * 8 + c, [...tomadas, alvo], [...caminho, r * 8 + c]); r += dr; c += dc; }
  }
  if (!seguiu && tomadas.length) saida.push({ de: i, para: pos, caminho, capturadas: tomadas });
 };
 busca(i, [], []);
 return saida;
}
function simplesDe(tab, i) {
 const peca = tab[i], r0 = Math.floor(i / 8), c0 = i % 8, saida = [];
 const frente = corDaPeca(peca) === 'brancas' ? -1 : 1;
 for (const [dr, dc] of DIRECOES) {
  if (!ehDama(peca) && dr !== frente) continue;
  let r = r0 + dr, c = c0 + dc;
  while (dentro(r, c) && tab[r * 8 + c] === null) {
   saida.push({ de: i, para: r * 8 + c, caminho: [r * 8 + c], capturadas: [] });
   if (!ehDama(peca)) break;
   r += dr; c += dc;
  }
 }
 return saida;
}
// Lances que valem para a cor: captura obrigatória e só as maiores.
export function lancesDama(tab, cor) {
 const minhas = tab.map((p, i) => (p && corDaPeca(p) === cor ? i : -1)).filter((i) => i >= 0);
 const capturas = minhas.flatMap((i) => capturasDe(tab, i));
 if (capturas.length) {
  const maior = Math.max(...capturas.map((m) => m.capturadas.length));
  return capturas.filter((m) => m.capturadas.length === maior);
 }
 return minhas.flatMap((i) => simplesDe(tab, i));
}
function aplicar(tab, lance) {
 const t = [...tab], peca = t[lance.de];
 t[lance.de] = null;
 for (const x of lance.capturadas) t[x] = null;
 const fileira = Math.floor(lance.para / 8);
 t[lance.para] = !ehDama(peca) && ((peca === 'b' && fileira === 0) || (peca === 'p' && fileira === 7)) ? peca.toUpperCase() : peca;
 return t;
}

export function iniciarDama(brancas = randomInt(2) ? 'desafiante' : 'desafiado') {
 return { tab: tabuleiroInicial(), cores: { [brancas]: 'brancas', [outro(brancas)]: 'pretas' }, vez: brancas, semProgresso: 0, n: 0, ultimo: null };
}

export function vistaDama(m, lado, fim) {
 const vez = !fim && lado && m.vez === lado;
 const legais = {};
 if (vez) for (const l of lancesDama(m.tab, m.cores[lado])) (legais[l.de] ||= []).push({ para: l.para, caminho: l.caminho, capturas: l.capturadas.length });
 const contar = (cor) => m.tab.filter((p) => p && corDaPeca(p) === cor).length;
 return { tab: m.tab, cores: m.cores, legais, ultimo: m.ultimo, pecas: { brancas: contar('brancas'), pretas: contar('pretas') } };
}

// pedido: { tipo: 'mover', de, para, caminho? } (casas 0 a 63; o caminho
// desempata quando duas sequências terminam na mesma casa).
export function jogarDama(mesa, lado, pedido) {
 if (mesa.vez !== lado) throw erro('Agora é a vez da outra pessoa.', 409);
 if (pedido?.tipo !== 'mover') throw erro('Jogada inválida.');
 const de = Number(pedido.de), para = Number(pedido.para);
 const legais = lancesDama(mesa.tab, mesa.cores[lado]).filter((l) => l.de === de && l.para === para);
 if (!legais.length) {
  const deve = lancesDama(mesa.tab, mesa.cores[lado])[0]?.capturadas.length;
  throw erro(deve ? `Captura é obrigatória: tome ${deve} ${deve === 1 ? 'peça' : 'peças'}.` : 'Esse lance não vale.');
 }
 const pedido_caminho = Array.isArray(pedido.caminho) ? pedido.caminho.map(Number).join(',') : null;
 const lance = legais.find((l) => l.caminho.join(',') === pedido_caminho) || legais[0];
 const m = structuredClone(mesa), peca = m.tab[de];
 m.n += 1;
 m.tab = aplicar(m.tab, lance);
 m.semProgresso = lance.capturadas.length || !ehDama(peca) ? 0 : (m.semProgresso || 0) + 1;
 m.ultimo = { lado, de, para, caminho: lance.caminho, capturadas: lance.capturadas };
 m.vez = outro(lado);
 // Quem fica sem lance (sem peças ou travado) perde.
 if (!lancesDama(m.tab, m.cores[m.vez]).length) return { mesa: m, fim: { resultado: lado, motivo: 'dama-sem-lances' } };
 if (m.semProgresso >= SEM_PROGRESSO_MAX) return { mesa: m, fim: { resultado: 'empate', motivo: 'dama-empate' } };
 return { mesa: m, fim: null };
}

export const motorDama = {
 nome: 'Dama',
 motivos: { 'dama-sem-lances': 'O outro ficou sem lance', 'dama-empate': '20 lances de cada lado só com damas' },
 iniciar: () => iniciarDama(),
 vista: vistaDama,
 jogar: jogarDama,
};
