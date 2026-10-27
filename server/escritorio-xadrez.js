// Xadrez no tabuleiro do Escritório (pedido do Paulo, 27/10/2026): partida
// entre duas pessoas da equipe, de graça ou valendo VybeCoins e móveis/roupas
// (migrations/2026-10-27-escritorio-xadrez.sql). As regras são do chess.js,
// no servidor: o navegador só pede o lance. A aposta sai das carteiras e dos
// inventários quando a partida começa e vai para quem ganha numa transação só.
// O razão é o mesmo da loja ('xadrez:<id>:aposta|premio|devolucao', sem regra
// e sem XP: não entra no ranking nem no ritmo de trabalho).
import { Chess } from 'chess.js';
import { carregarEconomia } from './escritorio-economia.js';
import { botValido, botInfo, listaDeBots, pagarBot, TETO_DIA } from './escritorio-bots.js';
import { lanceDoBotXadrez } from './escritorio-xadrez-bot.js';
import { erro, idValido, minutosDesde, nomes, lerDesafio, conferirDesafio, cobrarAposta, pagarAposta, placarDe, avisarConvite, textoDoConvite, MESA_MOEDAS_MAX } from './escritorio-apostas.js';

export const XADREZ_MOEDAS_MAX = MESA_MOEDAS_MAX;
// Convite sem resposta caduca; quem some na vez dele pode perder por tempo;
// partida largada um dia inteiro termina sozinha (perde quem tinha a vez).
const CONVITE_MIN = 10, REIVINDICAR_MIN = 5, ABANDONO_H = 24;
// Relógio (migrations/2026-10-27-escritorio-xadrez-relogio.sql): 10 minutos
// para cada lado e 2 segundos a mais por lance. Sem a coluna, sem relógio.
const RELOGIO_MS = 10 * 60000, INCREMENTO_MS = 2000;
let relogioPronto = false;
async function comRelogio(sql) {
 if (!relogioPronto) relogioPronto = (await sql`SELECT 1 FROM information_schema.columns WHERE table_name='vybe_escritorio_xadrez' AND column_name='relogio'`).length > 0;
 return relogioPronto;
}
// Quanto cada lado tem agora: quem está com a vez vai gastando desde o último lance.
function relogioAgora(j, vez, agora = Date.now()) {
 if (!j.relogio) return null;
 const r = { brancas: Number(j.relogio.brancas), pretas: Number(j.relogio.pretas) };
 if (j.estado === 'jogando' && j.ultimo_lance_em) r[vez] -= agora - new Date(j.ultimo_lance_em).getTime();
 return { brancas: Math.max(0, r.brancas), pretas: Math.max(0, r.pretas), corre: j.estado === 'jogando' ? vez : null };
}
// Desafios contra bot (migrations/2026-10-28-escritorio-xadrez-bot.sql): a cor
// do bot fica sem pessoa e a partida é sempre de graça. Sem a coluna, sem bot.
let botPronto = false;
async function comBot(sql) {
 if (!botPronto) botPronto = (await sql`SELECT 1 FROM information_schema.columns WHERE table_name='vybe_escritorio_xadrez' AND column_name='bot'`).length > 0;
 return botPronto;
}
const corDoBot = (j) => (!j.bot ? null : j.brancas == null ? 'brancas' : 'pretas');
// O bot espera um pouco antes de jogar sozinho (a tela pede antes, com ritmo).
const BOT_ESPERA_MS = 3000;
const MOTIVOS = { mate: 'Xeque-mate', afogamento: 'Afogamento', material: 'Material insuficiente', repeticao: 'Repetição de posição',
 cinquenta: 'Regra dos 50 lances', desistencia: 'Desistência', acordo: 'Empate combinado', tempo: 'Tempo esgotado', abandono: 'Partida abandonada' };

export async function xadrezPronto(sql) {
 const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_xadrez') IS NOT NULL AS existe`;
 return Boolean(r?.existe);
}
const exigirTabela = async (sql) => { if (!await xadrezPronto(sql)) throw erro('O xadrez aguarda a migração do banco.', 503); };

// A posição sai dos lances, do começo: assim repetição e 50 lances valem.
function partida(lances) {
 const c = new Chess();
 for (const san of lances || []) c.move(san);
 return c;
}
const corDe = (j, pessoaId) => String(j.brancas) === String(pessoaId) ? 'brancas' : String(j.pretas) === String(pessoaId) ? 'pretas' : null;
const vezDe = (c) => (c.turn() === 'w' ? 'brancas' : 'pretas');
function fimDaPosicao(c) {
 if (c.isCheckmate()) return { resultado: c.turn() === 'w' ? 'pretas' : 'brancas', motivo: 'mate' };
 if (c.isStalemate()) return { resultado: 'empate', motivo: 'afogamento' };
 if (c.isInsufficientMaterial()) return { resultado: 'empate', motivo: 'material' };
 if (c.isThreefoldRepetition()) return { resultado: 'empate', motivo: 'repeticao' };
 if (c.isDrawByFiftyMoves()) return { resultado: 'empate', motivo: 'cinquenta' };
 return null;
}

// Fim da partida: prêmio para quem ganhou, ou cada um recebe o seu de volta.
async function encerrar(tx, j, resultado, motivo) {
 if (j.bot) {
  const premio = resultado !== 'empate' && resultado !== corDoBot(j) ? await pagarBot(tx, j.desafiante, j.bot, `bot:xadrez:${j.id}`) : null;
  await tx`UPDATE vybe_escritorio_xadrez SET estado='fim',resultado=${resultado},motivo=${motivo},empate_de=NULL,terminado_em=now(),premio_bot=${premio ? JSON.stringify(premio) : null}::jsonb
   WHERE id=${j.id} AND estado='jogando'`;
  return;
 }
 await pagarAposta(tx, j, resultado === 'empate' ? null : resultado === 'brancas' ? j.brancas : j.pretas, `xadrez:${j.id}`);
 await tx`UPDATE vybe_escritorio_xadrez SET estado='fim',resultado=${resultado},motivo=${motivo},empate_de=NULL,terminado_em=now() WHERE id=${j.id} AND estado='jogando'`;
}

// Partidas largadas há um dia: perde quem tinha a vez (a aposta não fica presa).
// Com relógio, perde também quem ficou sem tempo na vez dele.
async function encerrarAbandonadas(sql, agora = Date.now()) {
 const velhas = await sql`SELECT id FROM vybe_escritorio_xadrez WHERE estado='jogando' AND ultimo_lance_em < ${new Date(agora - ABANDONO_H * 3600000)}::timestamptz`;
 for (const { id } of velhas) await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_xadrez WHERE id=${id} FOR UPDATE`;
  if (j?.estado !== 'jogando') return;
  // Contra o bot, quem larga a partida é sempre a pessoa: o bot ganha.
  await encerrar(tx, j, j.bot ? corDoBot(j) : vezDe(partida(j.lances)) === 'brancas' ? 'pretas' : 'brancas', 'abandono');
 });
 // O bot joga sozinho se a tela não pediu (fechou, ou a pessoa saiu da sala).
 if (await comBot(sql)) {
  const paradas = await sql`SELECT id, brancas, lances FROM vybe_escritorio_xadrez WHERE estado='jogando' AND bot IS NOT NULL AND ultimo_lance_em < ${new Date(agora - BOT_ESPERA_MS)}::timestamptz`;
  for (const l of paradas) if (vezDe(partida(l.lances)) === (l.brancas == null ? 'brancas' : 'pretas')) await sql.comTransacao(async (tx) => {
   const [j] = await tx`SELECT * FROM vybe_escritorio_xadrez WHERE id=${l.id} FOR UPDATE`;
   if (j?.estado === 'jogando') await jogarBot(tx, j);
  });
 }
 if (!await comRelogio(sql)) return;
 const comTempo = await sql`SELECT * FROM vybe_escritorio_xadrez WHERE estado='jogando' AND relogio IS NOT NULL`;
 for (const l of comTempo) {
  const vez = vezDe(partida(l.lances));
  // O tempo do bot não corre (ele joga em segundos; a tela só pede com ritmo).
  if (corDoBot(l) === vez || relogioAgora(l, vez, agora)[vez] > 0) continue;
  await sql.comTransacao(async (tx) => {
   const [j] = await tx`SELECT * FROM vybe_escritorio_xadrez WHERE id=${l.id} FOR UPDATE`;
   if (j?.estado === 'jogando' && corDoBot(j) !== vezDe(partida(j.lances)) && relogioAgora(j, vezDe(partida(j.lances)), agora)[vezDe(partida(j.lances))] <= 0)
    await encerrar(tx, j, vezDe(partida(j.lances)) === 'brancas' ? 'pretas' : 'brancas', 'tempo');
  });
 }
}

// O lance do bot, se for a vez dele: o motor escolhe, o chess.js confere. O
// relógio do bot não desconta o tempo que a tela esperou, só ganha o acréscimo.
async function jogarBot(tx, j) {
 const c = partida(j.lances), cor = corDoBot(j);
 if (j.estado !== 'jogando' || vezDe(c) !== cor) return;
 const l = lanceDoBotXadrez(botInfo(j.bot).nivel, j.lances);
 const feito = l && c.move({ from: l.de, to: l.para, ...(l.promocao ? { promotion: l.promocao } : {}) });
 if (!feito) return;
 const lances = [...(j.lances || []), feito.san];
 await tx`UPDATE vybe_escritorio_xadrez SET lances=${JSON.stringify(lances)}::jsonb,ultimo_lance_em=now() WHERE id=${j.id}`;
 if (j.relogio) {
  await tx`UPDATE vybe_escritorio_xadrez SET relogio=${JSON.stringify({ ...j.relogio, [cor]: Number(j.relogio[cor]) + INCREMENTO_MS })}::jsonb WHERE id=${j.id}`;
 }
 const fim = fimDaPosicao(c);
 if (fim) await encerrar(tx, { ...j, lances }, fim.resultado, fim.motivo);
}

// O que a tela precisa: posição, de quem é a vez, os lances que valem agora
// (só para quem tem a vez), a aposta e o resultado.
function vista(j, eu, nome, agora = Date.now()) {
 const c = partida(j.lances), minha = corDe(j, eu), vez = vezDe(c);
 const hist = c.history({ verbose: true }), ultimo = hist[hist.length - 1];
 const legais = {};
 if (j.estado === 'jogando' && minha === vez)
  for (const m of c.moves({ verbose: true })) (legais[m.from] ||= []).includes(m.to) || legais[m.from].push(m.to);
 const info = j.bot ? botInfo(j.bot) : null;
 const pessoa = (id) => (info && id == null ? { id: 'bot', nome: info.nome, bot: j.bot, avatar: info.avatar, frase: info.frase } : { id: String(id), nome: nome[String(id)] || '' });
 return {
  id: String(j.id), jogo: 'xadrez', estado: j.estado, camada: j.camada, movel: j.movel,
  bot: info ? { id: j.bot, nivel: info.nivel, nome: info.nome, avatar: info.avatar, premio: info.premio } : null, premio_bot: j.premio_bot || null,
  desafiante: pessoa(j.desafiante), desafiado: pessoa(j.desafiado), brancas: pessoa(j.brancas), pretas: pessoa(j.pretas),
  eu: minha, vez, fen: c.fen(), lances: j.lances || [], san: hist.map((m) => m.san), ultimo: ultimo ? { de: ultimo.from, para: ultimo.to } : null,
  xeque: j.estado === 'jogando' && c.inCheck(), legais,
  moedas: Number(j.moedas) || 0, itens: { desafiante: j.itens_desafiante || [], desafiado: j.itens_desafiado || [] },
  resultado: j.resultado || null, motivo: j.motivo || null, motivo_nome: MOTIVOS[j.motivo] || null,
  empate_de: j.empate_de ? String(j.empate_de) : null,
  // O relógio do bot fica parado na vez dele (ele joga em segundos).
  relogio: (() => { const r = relogioAgora(j, vez, agora); if (r && info && r.corre === corDoBot(j)) r[r.corre] = Number(j.relogio[r.corre]); return r; })(),
  // Com relógio o tempo acaba sozinho; sem ele (partidas antigas), 5 minutos sem lance.
  pode_reivindicar: !j.bot && !j.relogio && j.estado === 'jogando' && Boolean(minha) && minha !== vez && minutosDesde(j.ultimo_lance_em, agora) >= REIVINDICAR_MIN,
  reivindicar_em: j.estado === 'jogando' && j.ultimo_lance_em ? new Date(new Date(j.ultimo_lance_em).getTime() + REIVINDICAR_MIN * 60000).toISOString() : null,
  convite_ate: j.estado === 'convite' ? new Date(new Date(j.criado_em).getTime() + CONVITE_MIN * 60000).toISOString() : null,
 };
}
const conviteVencido = (j, agora = Date.now()) => j.estado === 'convite' && minutosDesde(j.criado_em, agora) > CONVITE_MIN;

export async function verXadrez(sql, pessoa, id) {
 await exigirTabela(sql);
 await encerrarAbandonadas(sql);
 const [j] = await sql`SELECT * FROM vybe_escritorio_xadrez WHERE id=${idValido(id)}`;
 if (!j) throw erro('Partida não encontrada.', 404);
 // Convite é só dos dois; partida começada, qualquer um da equipe assiste.
 if (j.estado === 'convite' && !corDe(j, pessoa.id)) throw erro('Partida não encontrada.', 404);
 if (conviteVencido(j)) j.estado = 'cancelado';
 const v = vista(j, pessoa.id, await nomes(sql, [j.brancas, j.pretas]));
 if (j.bot) return v;
 // Placar dos dois no xadrez (todas as partidas terminadas entre eles).
 const feitas = await sql`SELECT resultado, brancas, pretas FROM vybe_escritorio_xadrez WHERE estado='fim'
   AND ((desafiante=${j.desafiante} AND desafiado=${j.desafiado}) OR (desafiante=${j.desafiado} AND desafiado=${j.desafiante}))`;
 v.placar = placarDe(feitas.map((l) => ({ vencedor: l.resultado === 'empate' ? null : l[l.resultado] })), j.desafiante, j.desafiado);
 return v;
}
// Convites, partidas e o que está rolando em cada tabuleiro (para assistir).
export async function listarXadrez(sql, pessoa, { camada, movel } = {}) {
 if (!await xadrezPronto(sql)) return { disponivel: false, convites: [], enviados: [], jogos: [], mesa: null };
 await encerrarAbandonadas(sql);
 const desde = new Date(Date.now() - CONVITE_MIN * 60000);
 const linhas = await sql`SELECT * FROM vybe_escritorio_xadrez WHERE (estado='jogando' AND (brancas=${pessoa.id} OR pretas=${pessoa.id}
   OR (camada=${String(camada || '')} AND movel=${String(movel || '')})))
  OR (estado='convite' AND (desafiante=${pessoa.id} OR desafiado=${pessoa.id}) AND criado_em > ${desde}::timestamptz) ORDER BY id DESC LIMIT 20`;
 const nome = await nomes(sql, [...new Set(linhas.flatMap((l) => [String(l.brancas), String(l.pretas)]))]);
 const v = linhas.map((l) => vista(l, pessoa.id, nome));
 return {
  disponivel: true,
  convites: v.filter((j) => j.estado === 'convite' && j.desafiado.id === String(pessoa.id)),
  enviados: v.filter((j) => j.estado === 'convite' && j.desafiante.id === String(pessoa.id)),
  jogos: v.filter((j) => j.estado === 'jogando' && j.eu),
  mesa: v.find((j) => j.estado === 'jogando' && j.camada === camada && j.movel === movel) || null,
 };
}

// Desafio: quem chama escolhe a pessoa, o tabuleiro e a aposta (as moedas são
// iguais para os dois; os itens, o que cada um põe). As cores são sorteadas.
export async function desafiarXadrez(sql, pessoa, salas, pedido) {
 await exigirTabela(sql);
 const d = lerDesafio(pessoa, pedido), { para, camada, movel, chave, n, da, quer } = d;
 const r = await sql.comTransacao(async (tx) => {
  const [ja] = await tx`SELECT id,desafiante FROM vybe_escritorio_xadrez WHERE chave=${chave}`;
  if (ja) { if (String(ja.desafiante) !== String(pessoa.id)) throw erro('Pedido inválido.'); return { repetido: true, id: String(ja.id) }; }
  const [jogando] = await tx`SELECT id FROM vybe_escritorio_xadrez WHERE estado='jogando' AND (brancas=${pessoa.id} OR pretas=${pessoa.id})`;
  if (jogando) throw erro('Termine a sua partida antes de chamar outra.', 409);
  await conferirDesafio(tx, pessoa, salas, d);
  // Um convite aberto por vez de quem chama: o novo substitui o antigo.
  await tx`UPDATE vybe_escritorio_xadrez SET estado='cancelado',terminado_em=now() WHERE estado='convite' AND desafiante=${pessoa.id}`;
  const brancoEuSou = Math.random() < 0.5;
  const [j] = await tx`INSERT INTO vybe_escritorio_xadrez(chave,desafiante,desafiado,brancas,pretas,camada,movel,moedas,itens_desafiante,itens_desafiado)
   VALUES(${chave},${pessoa.id},${para},${brancoEuSou ? pessoa.id : para},${brancoEuSou ? para : pessoa.id},${camada},${movel},${n},${JSON.stringify(da)}::jsonb,${JSON.stringify(quer)}::jsonb) RETURNING id`;
  return { repetido: false, id: String(j.id) };
 });
 if (!r.repetido) await avisarConvite(sql, para, textoDoConvite((await nomes(sql, [pessoa.id]))[String(pessoa.id)], 'o xadrez', camada, n));
 return r;
}

// acao: "aceitar"/"recusar" (quem foi chamado) ou "cancelar" (quem chamou).
// Aceitar confere tudo de novo e tira a aposta dos dois numa transação.
export async function responderXadrez(sql, pessoa, salas, { id, acao }) {
 await exigirTabela(sql);
 if (!['aceitar', 'recusar', 'cancelar'].includes(acao)) throw erro('Pedido inválido.');
 const r = await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_xadrez WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j) throw erro('Partida não encontrada.', 404);
  const eu = String(pessoa.id);
  if (acao === 'cancelar' ? eu !== String(j.desafiante) : eu !== String(j.desafiado)) throw erro('Só quem foi chamado responde; só quem chamou cancela.', 403);
  if (j.estado !== 'convite') return { repetido: true };
  if (acao !== 'aceitar' || conviteVencido(j)) {
   await tx`UPDATE vybe_escritorio_xadrez SET estado=${acao === 'recusar' ? 'recusado' : 'cancelado'},terminado_em=now() WHERE id=${j.id}`;
   if (acao === 'aceitar') throw erro('O convite venceu. Chame de novo.', 409);
   return {};
  }
  const [ocupado] = await tx`SELECT id FROM vybe_escritorio_xadrez WHERE estado='jogando' AND (brancas IN (${j.desafiante},${j.desafiado}) OR pretas IN (${j.desafiante},${j.desafiado}))`;
  if (ocupado) throw erro('Um de vocês já está numa partida. Terminem aquela primeiro.', 409);
  const [mesa] = await tx`SELECT id FROM vybe_escritorio_xadrez WHERE estado='jogando' AND camada=${j.camada} AND movel=${j.movel}`;
  if (mesa) throw erro('Esse tabuleiro já está com uma partida. Esperem acabar.', 409);
  await cobrarAposta(tx, j, salas, `xadrez:${j.id}`);
  await tx`UPDATE vybe_escritorio_xadrez SET estado='jogando',iniciado_em=now(),ultimo_lance_em=now() WHERE id=${j.id}`;
  if (await comRelogio(tx)) await tx`UPDATE vybe_escritorio_xadrez SET relogio=${JSON.stringify({ brancas: RELOGIO_MS, pretas: RELOGIO_MS })}::jsonb WHERE id=${j.id}`;
  return {};
 });
 return { ...r, jogo: await verXadrez(sql, pessoa, id), economia: await carregarEconomia(sql, pessoa.id) };
}

// Lance: só de quem tem a vez, sobre a posição que a pessoa viu (`n` = quantos
// lances ela tinha na tela; outro número é pedido repetido ou tela atrasada).
export async function lanceXadrez(sql, pessoa, { id, de, para, promocao, n }) {
 await exigirTabela(sql);
 if (!/^[a-h][1-8]$/.test(String(de)) || !/^[a-h][1-8]$/.test(String(para))) throw erro('Lance inválido.');
 if (promocao != null && !['q', 'r', 'b', 'n'].includes(promocao)) throw erro('Promoção inválida.');
 const r = await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_xadrez WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j) throw erro('Partida não encontrada.', 404);
  const minha = corDe(j, pessoa.id);
  if (!minha) throw erro('Você está assistindo esta partida.', 403);
  if (j.estado !== 'jogando') throw erro('A partida já acabou.', 409);
  const c = partida(j.lances);
  if (vezDe(c) !== minha) throw erro('Agora é a vez da outra pessoa.', 409);
  if (Number(n) !== (j.lances || []).length) throw erro('A posição mudou. Olhe o tabuleiro de novo.', 409);
  // Relógio: o lance que chega depois do tempo acabar não vale; quem jogou perde.
  const relogio = relogioAgora(j, minha);
  if (relogio && relogio[minha] <= 0) { await encerrar(tx, j, minha === 'brancas' ? 'pretas' : 'brancas', 'tempo'); return { fim: true }; }
  let feito;
  try { feito = c.move({ from: de, to: para, ...(promocao ? { promotion: promocao } : {}) }); } catch { feito = null; }
  if (!feito) throw erro('Esse lance não vale.');
  const lances = [...(j.lances || []), feito.san];
  // Quem recebeu a proposta de empate e jogou, recusou.
  const empate = j.empate_de && String(j.empate_de) !== String(pessoa.id) ? null : j.empate_de;
  await tx`UPDATE vybe_escritorio_xadrez SET lances=${JSON.stringify(lances)}::jsonb,ultimo_lance_em=now(),empate_de=${empate} WHERE id=${j.id}`;
  if (relogio) await tx`UPDATE vybe_escritorio_xadrez SET relogio=${JSON.stringify({ brancas: relogio.brancas, pretas: relogio.pretas, [minha]: relogio[minha] + INCREMENTO_MS })}::jsonb WHERE id=${j.id}`;
  const fim = fimDaPosicao(c);
  if (fim) await encerrar(tx, { ...j, lances }, fim.resultado, fim.motivo);
  return { fim: Boolean(fim) };
 });
 return { ...r, jogo: await verXadrez(sql, pessoa, id), ...(r.fim ? { economia: await carregarEconomia(sql, pessoa.id) } : {}) };
}

// Desistir, propor/aceitar/recusar empate e reivindicar a vitória quando a
// outra pessoa sumiu na vez dela.
export async function acaoXadrez(sql, pessoa, { id, acao }) {
 await exigirTabela(sql);
 if (!['desistir', 'empate', 'aceitar-empate', 'recusar-empate', 'reivindicar'].includes(acao)) throw erro('Pedido inválido.');
 const r = await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_xadrez WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j) throw erro('Partida não encontrada.', 404);
  const minha = corDe(j, pessoa.id), outra = minha === 'brancas' ? 'pretas' : 'brancas';
  if (!minha) throw erro('Você está assistindo esta partida.', 403);
  if (j.estado !== 'jogando') return { repetido: true };
  const eu = String(pessoa.id), empateDe = j.empate_de ? String(j.empate_de) : null;
  if (acao === 'desistir') { await encerrar(tx, j, outra, 'desistencia'); return { fim: true }; }
  if (j.bot) throw erro('Contra o bot não tem empate nem vitória por tempo: jogue até o fim.', 409);
  if (acao === 'empate') { if (!empateDe) await tx`UPDATE vybe_escritorio_xadrez SET empate_de=${eu} WHERE id=${j.id}`; return {}; }
  if (acao === 'aceitar-empate') {
   if (!empateDe || empateDe === eu) throw erro('Não há proposta de empate para aceitar.', 409);
   await encerrar(tx, j, 'empate', 'acordo'); return { fim: true };
  }
  if (acao === 'recusar-empate') { if (empateDe && empateDe !== eu) await tx`UPDATE vybe_escritorio_xadrez SET empate_de=NULL WHERE id=${j.id}`; return {}; }
  if (vezDe(partida(j.lances)) === minha) throw erro('A vez é sua: jogue.', 409);
  if (j.relogio) { if (relogioAgora(j, outra)[outra] > 0) throw erro('A outra pessoa ainda tem tempo no relógio.', 409); }
  else if (minutosDesde(j.ultimo_lance_em, Date.now()) < REIVINDICAR_MIN) throw erro(`Espere ${REIVINDICAR_MIN} minutos sem lance da outra pessoa.`, 409);
  await encerrar(tx, j, minha, 'tempo');
  return { fim: true };
 });
 return { ...r, jogo: await verXadrez(sql, pessoa, id), ...(r.fim ? { economia: await carregarEconomia(sql, pessoa.id) } : {}) };
}

// --- Desafios contra o bot ---------------------------------------------------
// Os bots do xadrez, com o prêmio e quanto ainda dá para ganhar hoje (o teto é
// o mesmo dos outros jogos: soma tudo o que veio de bot no dia).
export async function botsDoXadrez(sql, pessoa) {
 const [{ hoje }] = await sql`SELECT COALESCE(sum(quantidade),0)::int AS hoje FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoa.id} AND origem LIKE 'bot:%'
   AND criado_em >= (date_trunc('day', now() AT TIME ZONE 'America/Bahia') AT TIME ZONE 'America/Bahia')`;
 const venceu = {}, pronto = await xadrezPronto(sql) && await comBot(sql);
 if (pronto) for (const l of await sql`SELECT bot, count(*)::int AS n FROM vybe_escritorio_xadrez WHERE bot IS NOT NULL AND desafiante=${pessoa.id} AND estado='fim'
   AND ((resultado='brancas' AND brancas IS NOT NULL) OR (resultado='pretas' AND pretas IS NOT NULL)) GROUP BY bot`) venceu[l.bot] = l.n;
 return { bots: pronto ? listaDeBots('xadrez').map((b) => ({ ...b, vitorias: venceu[b.bot] || 0 })) : [], resta_hoje: Math.max(0, TETO_DIA - Number(hoje)), teto_dia: TETO_DIA };
}
// Começa na hora, com as cores sorteadas; se o bot ficar com as brancas, a tela
// pede o primeiro lance dele.
export async function desafiarBotXadrez(sql, pessoa, { nivel, camada, movel, chave } = {}) {
 await exigirTabela(sql);
 if (!await comBot(sql)) throw erro('O bot do xadrez aguarda a migração do banco.', 503);
 if (!botValido('xadrez', nivel)) throw erro('Esse bot não existe.');
 if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(chave))) throw erro('Pedido inválido.');
 const lugar = /^[A-Za-z0-9_]{1,64}@\d{1,2},\d{1,2}$/.test(String(movel || '')) ? String(movel) : 'bot@0,0';
 const r = await sql.comTransacao(async (tx) => {
  const [ja] = await tx`SELECT id,desafiante FROM vybe_escritorio_xadrez WHERE chave=${chave}`;
  if (ja) { if (String(ja.desafiante) !== String(pessoa.id)) throw erro('Pedido inválido.'); return { id: String(ja.id) }; }
  const [jogando] = await tx`SELECT id FROM vybe_escritorio_xadrez WHERE estado='jogando' AND (brancas=${pessoa.id} OR pretas=${pessoa.id})`;
  if (jogando) throw erro('Termine a sua partida antes de começar outra.', 409);
  const brancoEuSou = Math.random() < 0.5;
  const [j] = await tx`INSERT INTO vybe_escritorio_xadrez(chave,desafiante,desafiado,brancas,pretas,bot,camada,movel,estado,iniciado_em,ultimo_lance_em)
   VALUES(${chave},${pessoa.id},NULL,${brancoEuSou ? pessoa.id : null},${brancoEuSou ? null : pessoa.id},${'xadrez:' + nivel},${String(camada || 'jogos').slice(0, 40)},${lugar},'jogando',now(),now()) RETURNING id`;
  if (await comRelogio(tx)) await tx`UPDATE vybe_escritorio_xadrez SET relogio=${JSON.stringify({ brancas: RELOGIO_MS, pretas: RELOGIO_MS })}::jsonb WHERE id=${j.id}`;
  return { id: String(j.id) };
 });
 return { ...r, jogo: await verXadrez(sql, pessoa, r.id) };
}
// A tela pede o lance do bot quando é a vez dele; `n` = quantos lances ela viu.
export async function vezDoBotXadrez(sql, pessoa, { id, n } = {}) {
 await exigirTabela(sql);
 await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_xadrez WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j?.bot || String(j.desafiante) !== String(pessoa.id)) throw erro('Partida não encontrada.', 404);
  if (Number(n) !== (j.lances || []).length) return;
  await jogarBot(tx, j);
 });
 const jogo = await verXadrez(sql, pessoa, id);
 return { jogo, ...(jogo.estado === 'fim' ? { economia: await carregarEconomia(sql, pessoa.id) } : {}) };
}
