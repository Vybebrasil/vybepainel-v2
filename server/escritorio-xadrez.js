// Xadrez no tabuleiro do Escritório (pedido do Paulo, 27/10/2026): partida
// entre duas pessoas da equipe, de graça ou valendo VybeCoins e móveis/roupas
// (migrations/2026-10-27-escritorio-xadrez.sql). As regras são do chess.js,
// no servidor: o navegador só pede o lance. A aposta sai das carteiras e dos
// inventários quando a partida começa e vai para quem ganha numa transação só.
// O razão é o mesmo da loja ('xadrez:<id>:aposta|premio|devolucao', sem regra
// e sem XP: não entra no ranking nem no ritmo de trabalho).
import { Chess } from 'chess.js';
import { carregarEconomia } from './escritorio-economia.js';
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
  await encerrar(tx, j, vezDe(partida(j.lances)) === 'brancas' ? 'pretas' : 'brancas', 'abandono');
 });
 if (!await comRelogio(sql)) return;
 const comTempo = await sql`SELECT id, lances, relogio, ultimo_lance_em, estado FROM vybe_escritorio_xadrez WHERE estado='jogando' AND relogio IS NOT NULL`;
 for (const l of comTempo) {
  const vez = vezDe(partida(l.lances));
  if (relogioAgora(l, vez, agora)[vez] > 0) continue;
  await sql.comTransacao(async (tx) => {
   const [j] = await tx`SELECT * FROM vybe_escritorio_xadrez WHERE id=${l.id} FOR UPDATE`;
   if (j?.estado === 'jogando' && relogioAgora(j, vezDe(partida(j.lances)), agora)[vezDe(partida(j.lances))] <= 0)
    await encerrar(tx, j, vezDe(partida(j.lances)) === 'brancas' ? 'pretas' : 'brancas', 'tempo');
  });
 }
}

// O que a tela precisa: posição, de quem é a vez, os lances que valem agora
// (só para quem tem a vez), a aposta e o resultado.
function vista(j, eu, nome, agora = Date.now()) {
 const c = partida(j.lances), minha = corDe(j, eu), vez = vezDe(c);
 const hist = c.history({ verbose: true }), ultimo = hist[hist.length - 1];
 const legais = {};
 if (j.estado === 'jogando' && minha === vez)
  for (const m of c.moves({ verbose: true })) (legais[m.from] ||= []).includes(m.to) || legais[m.from].push(m.to);
 const pessoa = (id) => ({ id: String(id), nome: nome[String(id)] || '' });
 return {
  id: String(j.id), estado: j.estado, camada: j.camada, movel: j.movel,
  desafiante: pessoa(j.desafiante), desafiado: pessoa(j.desafiado), brancas: pessoa(j.brancas), pretas: pessoa(j.pretas),
  eu: minha, vez, fen: c.fen(), lances: j.lances || [], ultimo: ultimo ? { de: ultimo.from, para: ultimo.to } : null,
  xeque: j.estado === 'jogando' && c.inCheck(), legais,
  moedas: Number(j.moedas) || 0, itens: { desafiante: j.itens_desafiante || [], desafiado: j.itens_desafiado || [] },
  resultado: j.resultado || null, motivo: j.motivo || null, motivo_nome: MOTIVOS[j.motivo] || null,
  empate_de: j.empate_de ? String(j.empate_de) : null,
  relogio: relogioAgora(j, vez, agora),
  // Com relógio o tempo acaba sozinho; sem ele (partidas antigas), 5 minutos sem lance.
  pode_reivindicar: !j.relogio && j.estado === 'jogando' && Boolean(minha) && minha !== vez && minutosDesde(j.ultimo_lance_em, agora) >= REIVINDICAR_MIN,
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
