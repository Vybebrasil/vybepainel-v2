// Temporadas dos jogos do Escritório (pedido do Paulo, 27/10/2026: "cada jogo
// vai ter um ranking de temporada com premiação de XP, gold e item"). Decisões
// do Paulo: temporada quinzenal (dias 1 a 15 e 16 ao fim do mês, horário da
// Bahia), só partidas contra pessoas contam, e o top 3 de cada jogo ganha:
// 1º 300 XP, 150 VybeCoins e o troféu da temporada do jogo; 2º 200 XP e 80;
// 3º 100 XP e 40. Pontos: vitórias, no máximo 3 contra o mesmo colega por dia
// (dois colegas não sobem jogando um contra o outro sem parar). Desempate: menos
// derrotas, depois quem chegou primeiro à pontuação. O fechamento é preguiçoso
// e idempotente: a primeira leitura depois da virada paga a temporada que
// acabou (migrations/2026-10-27-escritorio-bots-temporadas.sql).
import { nomes } from './escritorio-apostas.js';

export const JOGOS = ['xadrez', 'sinuca', 'poker', 'domino', 'dama', 'velha', 'truco'];
export const PREMIOS_TEMPORADA = [{ posicao: 1, xp: 300, moedas: 150, trofeu: true }, { posicao: 2, xp: 200, moedas: 80 }, { posicao: 3, xp: 100, moedas: 40 }];
// Troféu do campeão de cada jogo (móvel que não se compra; ver a migração).
export const TROFEUS_TEMPORADA = {};
// A primeira temporada paga é a que estava aberta quando os jogos entraram.
const PRIMEIRA = '2026-10-16';
const MAX_POR_DIA = 3;
const LADOS = ['desafiante', 'desafiado', 'jogador3', 'jogador4'];

const diaBahia = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' });
// Início e fim (exclusivo) da quinzena de uma data, em AAAA-MM-DD.
export function temporadaDe(agora = new Date()) {
 const [a, m, d] = diaBahia(agora).split('-').map(Number);
 const pad = (n) => String(n).padStart(2, '0');
 if (d <= 15) return { inicio: `${a}-${pad(m)}-01`, fim: `${a}-${pad(m)}-16` };
 const prox = m === 12 ? `${a + 1}-01-01` : `${a}-${pad(m + 1)}-01`;
 return { inicio: `${a}-${pad(m)}-16`, fim: prox };
}
export function temporadaAnterior(agora = new Date()) {
 const { inicio } = temporadaDe(agora);
 const [a, m, d] = inicio.split('-').map(Number);
 const dia = new Date(Date.UTC(a, m - 1, d, 15) - 86400000);
 return temporadaDe(dia);
}
const limites = ({ inicio, fim }) => [`${inicio}T00:00:00-03:00`, `${fim}T00:00:00-03:00`];

// Ranking de um jogo numa temporada: [{ pessoa_id, vitorias, derrotas, ultima }].
export async function rankingDaTemporada(sql, jogo, temporada) {
 const [de, ate] = limites(temporada), placar = new Map(), dias = new Map();
 const ponto = (vencedor, perdedores, quando) => {
  for (const perdedor of perdedores) {
   const chave = `${vencedor}:${perdedor}:${diaBahia(quando)}`, n = dias.get(chave) || 0;
   if (n >= MAX_POR_DIA) continue;
   dias.set(chave, n + 1);
   const v = placar.get(vencedor) || { pessoa_id: vencedor, vitorias: 0, derrotas: 0, ultima: 0 };
   v.vitorias += 1; v.ultima = Math.max(v.ultima, new Date(quando).getTime());
   placar.set(vencedor, v);
   const d = placar.get(perdedor) || { pessoa_id: perdedor, vitorias: 0, derrotas: 0, ultima: 0 };
   d.derrotas += 1; placar.set(perdedor, d);
  }
 };
 if (jogo === 'xadrez') {
  const [{ existe }] = await sql`SELECT to_regclass('public.vybe_escritorio_xadrez') IS NOT NULL AS existe`;
  if (existe) for (const l of await sql`SELECT brancas, pretas, resultado, terminado_em FROM vybe_escritorio_xadrez WHERE estado='fim' AND resultado IN ('brancas','pretas')
    AND terminado_em >= ${de}::timestamptz AND terminado_em < ${ate}::timestamptz ORDER BY terminado_em`) {
   const v = String(l[l.resultado]), p = String(l.resultado === 'brancas' ? l.pretas : l.brancas);
   ponto(v, [p], l.terminado_em);
  }
 } else {
  for (const l of await sql`SELECT desafiante, desafiado, mais, resultado, terminado_em FROM vybe_escritorio_partidas WHERE jogo=${jogo} AND estado='fim' AND bot IS NULL
    AND resultado <> 'empate' AND terminado_em >= ${de}::timestamptz AND terminado_em < ${ate}::timestamptz ORDER BY terminado_em`) {
   const mesa = [l.desafiante, l.desafiado, ...(l.mais || [])].map(String), v = mesa[LADOS.indexOf(l.resultado)];
   if (v) ponto(v, mesa.filter((p) => p !== v), l.terminado_em);
  }
 }
 return [...placar.values()].filter((p) => p.vitorias > 0).sort((a, b) => b.vitorias - a.vitorias || a.derrotas - b.derrotas || a.ultima - b.ultima);
}

// Paga a temporada que acabou (uma vez por jogo): prêmios do top 3 pelo razão
// e o troféu do 1º no inventário. Repetir não paga de novo (chave da tabela e
// origem do razão).
let fechada = null;
export async function fecharTemporadas(sql, agora = new Date()) {
 const ant = temporadaAnterior(agora);
 if (ant.inicio < PRIMEIRA || fechada === ant.inicio) return;
 const [{ existe }] = await sql`SELECT to_regclass('public.vybe_escritorio_temporadas') IS NOT NULL AS existe`;
 if (!existe) return;
 for (const jogo of JOGOS) {
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM vybe_escritorio_temporadas WHERE jogo=${jogo} AND inicio=${ant.inicio}::date`;
  if (n) continue;
  const top = (await rankingDaTemporada(sql, jogo, ant)).slice(0, 3);
  for (const [i, p] of top.entries()) await sql.comTransacao(async (tx) => {
   const premio = PREMIOS_TEMPORADA[i];
   const [novo] = await tx`INSERT INTO vybe_escritorio_temporadas(jogo,inicio,posicao,pessoa_id,vitorias) VALUES(${jogo},${ant.inicio}::date,${premio.posicao},${p.pessoa_id},${p.vitorias})
    ON CONFLICT DO NOTHING RETURNING posicao`;
   if (!novo) return;
   await tx`SELECT vybe_lancar_pontos(${p.pessoa_id},${`temporada:${jogo}:${ant.inicio}:${premio.posicao}`},NULL,NULL,${premio.moedas},${premio.xp})`;
   const trofeu = premio.trofeu && TROFEUS_TEMPORADA[jogo];
   if (trofeu) await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${p.pessoa_id},${trofeu},1)
    ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=vybe_escritorio_inventario.quantidade+1`;
  });
 }
 fechada = ant.inicio;
}

// O que a tela da temporada mostra: a quinzena, quanto falta, o ranking com
// nomes, os prêmios e os campeões da temporada anterior.
export async function verTemporada(sql, pessoa, jogo, agora = new Date()) {
 if (!JOGOS.includes(jogo)) return null;
 await fecharTemporadas(sql, agora);
 const atual = temporadaDe(agora), ranking = (await rankingDaTemporada(sql, jogo, atual)).slice(0, 10);
 const ant = temporadaAnterior(agora);
 const [{ existe }] = await sql`SELECT to_regclass('public.vybe_escritorio_temporadas') IS NOT NULL AS existe`;
 const campeoes = existe ? await sql`SELECT posicao, pessoa_id, vitorias FROM vybe_escritorio_temporadas WHERE jogo=${jogo} AND inicio=${ant.inicio}::date ORDER BY posicao` : [];
 const nome = await nomes(sql, [...ranking.map((p) => p.pessoa_id), ...campeoes.map((c) => String(c.pessoa_id))]);
 const eu = String(pessoa.id), minha = ranking.findIndex((p) => p.pessoa_id === eu);
 return {
  jogo, inicio: atual.inicio, fim: atual.fim, termina_em: `${atual.fim}T00:00:00-03:00`,
  ranking: ranking.map((p, i) => ({ posicao: i + 1, id: p.pessoa_id, nome: nome[p.pessoa_id] || '', vitorias: p.vitorias, derrotas: p.derrotas, eu: p.pessoa_id === eu })),
  minha_posicao: minha >= 0 ? minha + 1 : null,
  premios: PREMIOS_TEMPORADA.map((p) => ({ ...p, trofeu: p.trofeu ? TROFEUS_TEMPORADA[jogo] || null : null })),
  anterior: { inicio: ant.inicio, campeoes: campeoes.map((c) => ({ posicao: c.posicao, id: String(c.pessoa_id), nome: nome[String(c.pessoa_id)] || '', vitorias: c.vitorias })) },
 };
}
