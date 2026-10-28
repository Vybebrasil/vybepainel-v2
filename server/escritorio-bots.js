// Bots dos jogos de mesa, para os Desafios do Escritório (pedido do Paulo,
// 27/10/2026: "cada jogo vai ter os bots para os jogadores desafiarem… no
// sinuca um bot quase impossível de ganhar chamado Baianinho"). Três níveis
// por jogo (fácil, médio e lendário). O bot joga pelo mesmo motor das partidas
// entre pessoas (escritorio-mesas.js): olha só o que a vista do lado dele
// mostra (não espia a mão de ninguém) e devolve o pedido da jogada.
// Ganhar de um bot dá VybeCoins e XP, com teto por dia (premioDoBot).
import pokersolver from 'pokersolver';
import { simular, cacapas } from './escritorio-sinuca.js';
import { lancesDama } from './escritorio-dama.js';

const { Hand } = pokersolver;
export const NIVEIS = ['facil', 'medio', 'lendario'];
// Nome, avatar (emoji) e frase de cada bot.
export const BOTS = {
 sinuca: { facil: ['Zé do Taco', '🧢', 'Acerta uma, erra três.'], medio: ['Tio do Boteco', '🍺', 'Joga toda sexta no bar da esquina.'], lendario: ['Baianinho', '🎱', 'Quase ninguém ganha dele.'] },
 poker: { facil: ['Mão Furada', '🃏', 'Paga tudo para ver.'], medio: ['Dona Ficha', '💰', 'Só aposta com mão boa.'], lendario: ['O Blefador', '🕶️', 'Lê a mesa e blefa na hora certa.'] },
 domino: { facil: ['Seu Zé da Praça', '🧓', 'Bate a pedra na mesa com força.'], medio: ['Dona Cotinha', '👵', 'Conta as pedras de cabeça.'], lendario: ['O Carroceiro', '🁫', 'Tranca o jogo quando quer.'] },
 dama: { facil: ['Peão Novato', '🐣', 'Ainda aprendendo a comer.'], medio: ['Dona Dama', '👑', 'Pensa dois lances à frente.'], lendario: ['Grão-Mestre', '🧠', 'Enxerga o tabuleiro inteiro.'] },
 velha: { facil: ['Bebê', '👶', 'Marca onde der.'], medio: ['A Velha', '🧶', 'Às vezes se distrai.'], lendario: ['Invencível', '🤖', 'Nunca perde. No máximo empata.'] },
 xadrez: { facil: ['Peão de Praça', '♟️', 'Joga rápido e sem pensar muito.'], medio: ['Professor Xeque', '🎓', 'Enxerga dois lances à frente.'], lendario: ['Mequinho', '♚', 'Pensa fundo. Quase ninguém ganha dele.'] },
 truco: { facil: ['Pato', '🦆', 'Aceita qualquer truco.'], medio: ['Truqueiro', '🤠', 'Pede truco com mão boa.'], lendario: ['Rei do Truco', '🎩', 'Blefa no truco sem piscar.'] },
};
// Prêmio por vitória e teto por dia, somando todos os bots (XP sempre o dobro
// das moedas, para os dois tetos acabarem juntos).
export const PREMIOS = { facil: { moedas: 5, xp: 10 }, medio: { moedas: 15, xp: 30 }, lendario: { moedas: 50, xp: 100 } };
export const TETO_DIA = 80;

// Vitória sobre um bot: VybeCoins e XP do nível, até o teto do dia somando
// todos os bots e jogos (dia da Bahia). Pelo razão, sem regra (fora da Copa e
// do teto da semana do trabalho). `origem` começa com 'bot:'.
export async function pagarBot(tx, pessoaId, bot, origem) {
 const info = botInfo(bot);
 const [{ hoje }] = await tx`SELECT COALESCE(sum(quantidade),0)::int AS hoje FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND origem LIKE 'bot:%'
   AND criado_em >= (date_trunc('day', now() AT TIME ZONE 'America/Bahia') AT TIME ZONE 'America/Bahia')`;
 const moedas = Math.max(0, Math.min(info.premio.moedas, TETO_DIA - Number(hoje))), xp = moedas * 2;
 if (moedas > 0) await tx`SELECT vybe_lancar_pontos(${pessoaId},${origem},NULL,NULL,${moedas},${xp})`;
 return { moedas, xp, teto: moedas < info.premio.moedas };
}
export function botValido(jogo, nivel) { return Boolean(BOTS[jogo]?.[nivel]); }
export function botInfo(bot) {
 const [jogo, nivel] = String(bot || '').split(':');
 const b = BOTS[jogo]?.[nivel];
 return b ? { jogo, nivel, nome: b[0], avatar: b[1], frase: b[2], premio: PREMIOS[nivel] } : null;
}
export function listaDeBots(jogo) {
 return NIVEIS.map((nivel) => ({ bot: `${jogo}:${nivel}`, ...botInfo(`${jogo}:${nivel}`) })).filter((b) => b.nome);
}

const sorteio = (l) => l[Math.floor(Math.random() * l.length)];
const outro = (lado) => (lado === 'desafiante' ? 'desafiado' : 'desafiante');

// --- Velha: minimax completo na rodada (o lendário nunca perde) -------------
const LINHAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const ganhouVelha = (t, s) => LINHAS.some((l) => l.every((i) => t[i] === s));
function minimaxVelha(t, eu, ele, vezEu) {
 if (ganhouVelha(t, eu)) return 1; if (ganhouVelha(t, ele)) return -1; if (t.every(Boolean)) return 0;
 let melhor = vezEu ? -2 : 2;
 for (let i = 0; i < 9; i++) if (!t[i]) {
  t[i] = vezEu ? eu : ele;
  const v = minimaxVelha(t, eu, ele, !vezEu);
  t[i] = null;
  melhor = vezEu ? Math.max(melhor, v) : Math.min(melhor, v);
 }
 return melhor;
}
function velha(mesa, lado, nivel) {
 const t = [...mesa.tab], eu = mesa.simbolos[lado], ele = mesa.simbolos[outro(lado)], livres = t.map((c, i) => (c ? null : i)).filter((i) => i !== null);
 const certeira = nivel === 'lendario' || (nivel === 'medio' && Math.random() < 0.6) || (nivel === 'facil' && Math.random() < 0.2);
 if (!certeira) return { tipo: 'marcar', casa: sorteio(livres) };
 let melhor = -3, casas = [];
 for (const i of livres) { t[i] = eu; const v = minimaxVelha(t, eu, ele, false); t[i] = null; if (v > melhor) { melhor = v; casas = [i]; } else if (v === melhor) casas.push(i); }
 return { tipo: 'marcar', casa: sorteio(casas) };
}

// --- Dama: busca pelo material (dama vale 3) --------------------------------
const corDe = (p) => (p && p.toLowerCase() === 'b' ? 'brancas' : p ? 'pretas' : null);
function materialDama(tab, cor) {
 let s = 0;
 for (const p of tab) if (p) s += (corDe(p) === cor ? 1 : -1) * (p === p.toUpperCase() ? 3 : 1);
 return s;
}
function jogarNoTab(tab, l) {
 const t = [...tab], p = t[l.de];
 t[l.de] = null; for (const c of l.capturadas || []) t[c] = null;
 const linha = Math.floor(l.para / 8);
 t[l.para] = (p === 'b' && linha === 0) ? 'B' : (p === 'p' && linha === 7) ? 'P' : p;
 return t;
}
function buscaDama(tab, cor, prof, a, b, maximiza, raiz) {
 const lances = lancesDama(tab, maximiza ? cor : (cor === 'brancas' ? 'pretas' : 'brancas'));
 if (!lances.length) return maximiza ? -1000 : 1000;
 if (prof === 0) return materialDama(tab, cor);
 let melhor = maximiza ? -Infinity : Infinity;
 for (const l of lances) {
  const v = buscaDama(jogarNoTab(tab, l), cor, prof - 1, a, b, !maximiza, raiz);
  if (maximiza) { melhor = Math.max(melhor, v); a = Math.max(a, v); } else { melhor = Math.min(melhor, v); b = Math.min(b, v); }
  if (b <= a) break;
 }
 return melhor;
}
function dama(mesa, lado, nivel) {
 const cor = mesa.cores[lado], lances = lancesDama(mesa.tab, cor);
 const pedido = (l) => ({ tipo: 'mover', de: l.de, para: l.para, caminho: l.caminho });
 if (nivel === 'facil' && Math.random() < 0.6) return pedido(sorteio(lances));
 const prof = nivel === 'lendario' ? 5 : 2;
 let melhor = -Infinity, escolhas = [];
 for (const l of lances) {
  const v = buscaDama(jogarNoTab(mesa.tab, l), cor, prof - 1, -Infinity, Infinity, false) + Math.random() * 0.01;
  if (v > melhor) { melhor = v; escolhas = [l]; }
 }
 return pedido(escolhas[0] || lances[0]);
}

// --- Dominó: a pedra que mais vale, guardando variedade ---------------------
function domino(vista, nivel) {
 if (!vista.jogaveis.length) return vista.pode_comprar ? { tipo: 'comprar' } : { tipo: 'passar' };
 const opcoes = vista.jogaveis.flatMap((o) => o.pontas.map((ponta) => ({ peca: o.peca, ponta })));
 if (nivel === 'facil') return { tipo: 'jogar', ...sorteio(opcoes) };
 const mao = vista.mao || [];
 const nota = ({ peca: [a, b] }) => {
  let n = a + b + (a === b ? 6 : 0);
  if (nivel === 'lendario') {
   // Fica com números variados na mão (para ter jogada depois) e solta carroça cedo.
   const resto = mao.filter((p) => !(p[0] === a && p[1] === b) && !(p[0] === b && p[1] === a));
   n += new Set(resto.flat()).size * 2;
  }
  return n + Math.random();
 };
 return { tipo: 'jogar', ...opcoes.sort((x, y) => nota(y) - nota(x))[0] };
}

// --- Truco: força das cartas, pede e aceita conforme a mão -----------------
const VALORES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'], NAIPES = ['o', 'e', 'c', 'p'];
const forca = (c, manilha) => (c[0] === manilha ? 100 + NAIPES.indexOf(c[1]) : VALORES.indexOf(c[0]));
function truco(mesa, lado, nivel) {
 const minhas = mesa.cartas[lado], manilha = mesa.manilha, a = acoesTruco(mesa, lado);
 const forte = minhas.reduce((s, c) => s + Math.min(10, forca(c, manilha) >= 100 ? 12 : forca(c, manilha)), 0) / Math.max(1, minhas.length);
 const blefe = nivel === 'lendario' ? 0.15 : nivel === 'medio' ? 0.05 : 0;
 if (a.responder) {
  if (nivel === 'facil') return { tipo: 'aceitar' };
  const coragem = forte + (Math.random() < blefe ? 4 : 0);
  if (a.aumentar && coragem >= 8.5) return { tipo: 'aumentar' };
  return coragem >= (nivel === 'lendario' ? 5.5 : 6.5) ? { tipo: 'aceitar' } : { tipo: 'correr' };
 }
 if (a.truco && nivel !== 'facil' && (forte >= 8 || Math.random() < blefe)) return { tipo: 'truco' };
 // Joga: na rodada em que o outro já jogou, a menor que ganha (ou a menor de todas);
 // abrindo, o médio e o lendário guardam a maior.
 const dele = mesa.naMesa[outro(lado)], ordem = [...minhas].sort((x, y) => forca(x, manilha) - forca(y, manilha));
 if (nivel === 'facil') return { tipo: 'jogar', carta: sorteio(minhas) };
 if (dele) { const ganha = ordem.find((c) => forca(c, manilha) > forca(dele, manilha)); return { tipo: 'jogar', carta: ganha || ordem[0] }; }
 return { tipo: 'jogar', carta: nivel === 'lendario' && ordem.length === 3 ? ordem[1] : ordem[ordem.length - 1] };
}
function acoesTruco(m, lado) {
 const p = m.pendente;
 if (p) return p.de === lado ? {} : { responder: p.valor, aumentar: p.valor < 12 };
 return { jogar: true, truco: m.vale < 12 && m.ultimoPedido !== lado && ![m.pontos.desafiante, m.pontos.desafiado].includes(11) };
}

// --- Pôquer: força da mão, conta do pote e um blefe de vez em quando -------
const ORDEM = '23456789TJQKA';
function forcaPoker(minhas, mesa) {
 if (!minhas) return 0;
 if (!mesa.length) {
  const [a, b] = minhas, ra = ORDEM.indexOf(a[0]), rb = ORDEM.indexOf(b[0]);
  let s = (Math.max(ra, rb) + Math.min(ra, rb) / 2) / 18;
  if (a[0] === b[0]) s = 0.55 + ra / 28;
  if (a[1] === b[1]) s += 0.05;
  return Math.min(1, s);
 }
 return Math.min(1, Hand.solve([...minhas, ...mesa]).rank / 9 + 0.05);
}
function poker(vista, nivel) {
 const a = vista.acoes;
 if (!a) return { tipo: 'mesa' };
 const f = forcaPoker(vista.minhas, vista.comunitarias), sorte = Math.random();
 const pagar = a.pagar, pote = vista.pote || 1, conta = pagar / (pote + pagar);
 const aumenta = (fator) => a.aumentar ? { tipo: 'aumentar', valor: Math.max(a.aumentar.min, Math.min(a.aumentar.max, Math.round(a.aumentar.min + fator * (pote)))) } : null;
 if (nivel === 'facil') {
  if (sorte < 0.1 && a.aumentar) return aumenta(0.3);
  return a.mesa ? { tipo: 'mesa' } : { tipo: 'pagar' };
 }
 const blefa = nivel === 'lendario' && sorte < 0.12;
 if ((f > 0.7 || blefa) && a.aumentar) return aumenta(nivel === 'lendario' ? 0.75 : 0.5);
 if (a.mesa) return f > 0.45 && a.aumentar && sorte < 0.4 ? aumenta(0.4) : { tipo: 'mesa' };
 return f >= conta + (nivel === 'lendario' ? 0.05 : 0.15) ? { tipo: 'pagar' } : { tipo: 'largar' };
}

// --- Sinuca: testa tacadas na física de verdade e escolhe a melhor ----------
// Para onde mirar em cada caçapa: o meio da boca e um pouco para cada lado dela
// (com bocas de 1,5 bola, desde 28/10/2026, a bola que chega torta precisa de
// outro ponto da boca para não bater no dente).
const CACAPAS = [[-0.5, -0.5], [50, -1], [100.5, -0.5], [-0.5, 50.5], [50, 51], [100.5, 50.5]];
const LADOS_DA_BOCA = { '-0.5,-0.5': [[1, -1], [-1, 1]], '100.5,-0.5': [[1, 1], [-1, -1]], '-0.5,50.5': [[1, 1], [-1, -1]], '100.5,50.5': [[1, -1], [-1, 1]], '50,-1': [[1, 0], [-1, 0]], '50,51': [[1, 0], [-1, 0]] };
const GRUPOS = { lisas: [1, 2, 3, 4, 5, 6, 7], listradas: [9, 10, 11, 12, 13, 14, 15], pares: [2, 4, 6, 8, 10, 12, 14], impares: [3, 5, 7, 9, 11, 13, 15] };
// A bola final: a 8 na bola 8, a 1 no par ou ímpar com as 15 bolas.
const finalSinuca = (mesa) => (mesa.modo === 'parimpar' ? (mesa.bola1 ? 1 : null) : 8);
function alvosSinuca(mesa, lado) {
 const g = mesa.grupos?.[lado], fim = finalSinuca(mesa);
 const lista = g ? GRUPOS[g].filter((n) => mesa.bolas[n]) : mesa.bolas.map((p, n) => (p && n && n !== fim ? n : null)).filter((n) => n !== null);
 return lista.length ? lista : (fim && mesa.bolas[fim] ? [fim] : []);
}
function notaTacada(r, mesa, lado) {
 const g = mesa.grupos?.[lado], fim = finalSinuca(mesa), limpo = !alvosSinuca(mesa, lado).some((n) => n !== fim);
 const meu = (n) => (g ? GRUPOS[g].includes(n) : n !== fim && n !== 0);
 let s = 0;
 if (r.caiu.includes(0)) s -= 60;
 if (r.primeiro === null) s -= 40; else if (limpo ? r.primeiro !== fim : !meu(r.primeiro)) s -= 40;
 for (const n of r.caiu) if (n && n !== 0) s += meu(n) ? 30 : n === fim ? (limpo ? 500 : -200) : -15;
 return s;
}
// O vale: quantas bolas do outro a branca enxerga em linha reta (menos é
// melhor) e quantas minhas ficaram paradas na boca de uma caçapa.
function valeSinuca(bolas, deles, minhas, R, buracos) {
 const b = bolas[0];
 if (!b) return -100;
 const livre = (alvo) => bolas.every((p, n) => {
  if (!p || n === 0 || p === alvo) return true;
  const dx = alvo[0] - b[0], dy = alvo[1] - b[1], l2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((p[0] - b[0]) * dx + (p[1] - b[1]) * dy) / l2));
  return Math.hypot(b[0] + dx * t - p[0], b[1] + dy * t - p[1]) >= 2 * R;
 });
 const vistas = deles.filter((n) => bolas[n] && livre(bolas[n])).length;
 const naBoca = minhas.filter((n) => bolas[n] && buracos.some(([cx, cy, cr]) => Math.hypot(bolas[n][0] - cx, bolas[n][1] - cy) - cr < 1.6)).length;
 return -12 * vistas + 8 * naBoca;
}
function sinuca(mesa, lado, nivel) {
 const R = mesa.r || 1.15, bolas = mesa.bolas.map((p) => (p ? [...p] : null));
 const pedidoBase = {};
 // Bola na mão: põe a branca num lugar livre perto do meio da cabeceira.
 if (mesa.bolaNaMao || !bolas[0]) {
  const livre = (x, y) => bolas.every((p, n) => !p || n === 0 || Math.hypot(p[0] - x, p[1] - y) >= 2 * R + 0.2);
  const lugares = [[25, 25], [30, 20], [30, 30], [20, 25], [40, 25], [25, 15], [25, 35]];
  const [x, y] = lugares.find(([a, b]) => livre(a, b)) || [25, 25];
  bolas[0] = [x, y]; pedidoBase.branca = { x, y };
 }
 const b = bolas[0], candidatas = [];
 // Mira de bola fantasma: para cada bola alvo e cada caçapa.
 for (const n of alvosSinuca({ ...mesa, bolas }, lado)) {
  const o = bolas[n];
  for (const [px, py] of CACAPAS) for (const [ox, oy] of [[0, 0], ...(nivel === 'facil' ? [] : LADOS_DA_BOCA[`${px},${py}`])]) {
   const cx = px + ox * 0.45, cy = py + oy * 0.45, dx = cx - o[0], dy = cy - o[1], d = Math.hypot(dx, dy) || 1;
   const gx = o[0] - (dx / d) * 2 * R, gy = o[1] - (dy / d) * 2 * R;
   candidatas.push(Math.atan2(gy - b[1], gx - b[0]));
  }
 }
 const extras = nivel === 'lendario' ? 8 : nivel === 'medio' ? 6 : 2;
 for (let i = 0; i < extras; i++) candidatas.push(Math.random() * Math.PI * 2);
 const forcas = nivel === 'lendario' ? [0.35, 0.5, 0.68] : nivel === 'medio' ? [0.45, 0.65] : [0.55];
 const limite = nivel === 'lendario' ? 160 : nivel === 'medio' ? 60 : 20;
 const m2 = { ...mesa, bolas }, buracos = cacapas(), g = mesa.grupos?.[lado];
 // Quanto a bola que eu queria passou perto de cair (para refinar as tacadas
 // que quase entraram): a menor folga até a borda de um buraco.
 const quase = (r) => {
  let menor = Infinity;
  const minhas = alvosSinuca(m2, lado);
  for (const q of r.quadros) for (const n of minhas) {
   if (q[2 * n] < 0) continue;
   const x = q[2 * n] / 10, y = q[2 * n + 1] / 10;
   for (const [cx, cy, cr] of buracos) menor = Math.min(menor, Math.hypot(x - cx, y - cy) - cr);
  }
  return menor;
 };
 const tentar = (angulo, forca) => { const r = simular(bolas, angulo, forca, 0, R, 0), nota = notaTacada(r, m2, lado); return { nota, perto: nota >= 30 ? 0 : quase(r), angulo, forca, fim: r.bolas }; };
 const todas = [];
 for (const angulo of candidatas.slice(0, limite)) for (const forca of forcas) todas.push(tentar(angulo, forca));
 // O médio e o Baianinho corrigem a mira em volta das que quase entraram (o
 // arrasto do corte e o dente da caçapa desviam a bola um pouco do que a bola
 // fantasma diz), e o Baianinho escolhe a tacada que entra mesmo errando um pouco.
 if (nivel !== 'facil') {
  const grau = Math.PI / 180, passos = nivel === 'lendario' ? [-0.4, -0.25, -0.12, 0.12, 0.25, 0.4] : [-0.25, 0.25];
  const quaseLa = todas.filter((c) => c.nota > -40 && c.perto < 2.5).sort((a, b) => b.nota - a.nota || a.perto - b.perto).slice(0, nivel === 'lendario' ? 24 : 5);
  for (const c of quaseLa) for (const d of passos) todas.push(tentar(c.angulo + d * grau, c.forca));
 }
 const ordem = todas.map((c) => ({ ...c, valor: c.nota - c.perto * 2 + Math.random() })).sort((a, b) => b.valor - a.valor);
 let melhor = ordem[0] || { angulo: candidatas[0] || 0, forca: 0.6 };
 // Sem bola boa, o Baianinho joga como malandro de bar (Paulo, 28/10/2026:
 // "tirando onda da pessoa, deixando bola na boca, dando vale"): uma tacada sem
 // falta que esconde a branca das bolas do outro (o vale) e, se der, deixa bola
 // dele parada na boca da caçapa (tampa a caçapa e fica para a próxima).
 if (nivel === 'lendario' && !(melhor.nota >= 30)) {
  const outroLado = lado === 'desafiante' ? 'desafiado' : 'desafiante';
  const vale = (c) => valeSinuca(c.fim, alvosSinuca({ ...m2, bolas: c.fim, grupos: mesa.grupos }, outroLado), alvosSinuca({ ...m2, bolas: c.fim }, lado), R, buracos);
  const legais = todas.filter((c) => c.nota > -15).map((c) => ({ ...c, valor: vale(c) + Math.random() })).sort((a, b) => b.valor - a.valor);
  if (legais.length) melhor = legais[0];
 } else if (nivel === 'lendario') {
  // Firmeza: entre as melhores que entram, a que ainda entra 0,08° para cada lado.
  const boas = ordem.filter((c) => c.nota >= 30).slice(0, 6);
  let firme = -1;
  for (const c of boas) {
   const f = [-0.08, 0.08].filter((d) => tentar(c.angulo + (d * Math.PI) / 180, c.forca).nota >= 30).length;
   if (f > firme) { firme = f; melhor = c; }
   if (f === 2) break;
  }
 }
 // O erro da mão (calibrado com a mesa de bocas de 1,5 bola, 28/10/2026, para o
 // fácil encaçapar ~20% das tacadas, o médio ~40% e o Baianinho ~85%). No vale
 // a mão não importa tanto, e ele erra igual.
 const erroMao = { facil: 0.015, medio: 0.0055, lendario: 0.0006 }[nivel];
 const angulo = melhor.angulo + (Math.random() * 2 - 1) * erroMao;
 return { tipo: 'tacar', angulo: Math.round(angulo * 100000) / 100000, forca: melhor.forca, efeito: 0, ...pedidoBase };
}

// O pedido da jogada do bot, pelo jogo. `mesa` é o estado completo (o bot só
// usa o que é do lado dele e o que está à vista); `vista` é a vista desse lado.
export function jogadaDoBot(jogo, nivel, mesa, lado, vista) {
 if (jogo === 'velha') return velha(mesa, lado, nivel);
 if (jogo === 'dama') return dama(mesa, lado, nivel);
 if (jogo === 'domino') return domino(vista, nivel);
 if (jogo === 'truco') return truco(mesa, lado, nivel);
 if (jogo === 'poker') return poker(vista, nivel);
 if (jogo === 'sinuca') return sinuca(mesa, lado, nivel);
 throw new Error('Jogo sem bot.');
}
