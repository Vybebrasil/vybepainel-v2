// Mesas de jogo do Escritório (pedido do Paulo, 27/10/2026): convite para quem
// está online, aposta, vez, desistência, empate combinado, vitória por tempo e
// abandono, iguais para todo jogo de dois (migrations/2026-10-27-escritorio-
// mesas.sql). Cada jogo é um motor ({ iniciar, vista, jogar, motivos }) que só
// sabe das próprias regras; o xadrez veio antes e tem tabela própria
// (server/escritorio-xadrez.js), mas usa a mesma aposta (escritorio-apostas.js).
import { carregarEconomia } from './escritorio-economia.js';
import { erro, idValido, minutosDesde, nomes, lerDesafio, conferirDesafio, cobrarAposta, pagarAposta } from './escritorio-apostas.js';
import { motorDomino } from './escritorio-domino.js';
import { motorPoker } from './escritorio-poker.js';

const MOTORES = { domino: motorDomino, poker: motorPoker };
// Convite sem resposta caduca; quem some na vez dele pode perder por tempo;
// partida largada um dia inteiro termina sozinha (perde quem tinha a vez).
const CONVITE_MIN = 10, REIVINDICAR_MIN = 5, ABANDONO_H = 24;
const MOTIVOS = { desistencia: 'Desistência', acordo: 'Empate combinado', tempo: 'Tempo esgotado', abandono: 'Partida abandonada' };
const outro = (lado) => (lado === 'desafiante' ? 'desafiado' : 'desafiante');

export async function mesasProntas(sql) {
 const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_partidas') IS NOT NULL AS existe`;
 return Boolean(r?.existe);
}
const exigirTabela = async (sql) => { if (!await mesasProntas(sql)) throw erro('As mesas de jogo aguardam a migração do banco.', 503); };
const motorDe = (jogo) => { const m = MOTORES[jogo]; if (!m) throw erro('Jogo inválido.'); return m; };
const ladoDe = (j, pessoaId) => String(j.desafiante) === String(pessoaId) ? 'desafiante' : String(j.desafiado) === String(pessoaId) ? 'desafiado' : null;
const conviteVencido = (j, agora = Date.now()) => j.estado === 'convite' && minutosDesde(j.criado_em, agora) > CONVITE_MIN;

async function encerrar(tx, j, resultado, motivo) {
 await pagarAposta(tx, j, resultado === 'empate' ? null : j[resultado], `${j.jogo}:${j.id}`);
 await tx`UPDATE vybe_escritorio_partidas SET estado='fim',resultado=${resultado},motivo=${motivo},empate_de=NULL,terminado_em=now() WHERE id=${j.id} AND estado='jogando'`;
}
// Partidas largadas há um dia: perde quem tinha a vez (a aposta não fica presa).
async function encerrarAbandonadas(sql, agora = Date.now()) {
 const velhas = await sql`SELECT id FROM vybe_escritorio_partidas WHERE estado='jogando' AND ultimo_lance_em < ${new Date(agora - ABANDONO_H * 3600000)}::timestamptz`;
 for (const { id } of velhas) await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${id} FOR UPDATE`;
  if (j?.estado === 'jogando') await encerrar(tx, j, outro(j.mesa.vez), 'abandono');
 });
}

function vista(j, eu, nome, agora = Date.now()) {
 const motor = MOTORES[j.jogo], lado = ladoDe(j, eu), jogando = j.estado === 'jogando', vez = jogando ? j.mesa?.vez : null;
 const pessoa = (id) => ({ id: String(id), nome: nome[String(id)] || '' });
 return {
  id: String(j.id), jogo: j.jogo, estado: j.estado, camada: j.camada, movel: j.movel,
  desafiante: pessoa(j.desafiante), desafiado: pessoa(j.desafiado), eu: lado, vez, n: Number(j.mesa?.n) || 0,
  mesa: jogando || j.estado === 'fim' ? motor.vista(j.mesa, lado, !jogando) : null,
  moedas: Number(j.moedas) || 0, itens: { desafiante: j.itens_desafiante || [], desafiado: j.itens_desafiado || [] },
  resultado: j.resultado || null, motivo: j.motivo || null, motivo_nome: motor.motivos[j.motivo] || MOTIVOS[j.motivo] || null,
  empate_de: j.empate_de ? String(j.empate_de) : null,
  pode_reivindicar: jogando && Boolean(lado) && lado !== vez && minutosDesde(j.ultimo_lance_em, agora) >= REIVINDICAR_MIN,
  reivindicar_em: jogando && j.ultimo_lance_em ? new Date(new Date(j.ultimo_lance_em).getTime() + REIVINDICAR_MIN * 60000).toISOString() : null,
  convite_ate: j.estado === 'convite' ? new Date(new Date(j.criado_em).getTime() + CONVITE_MIN * 60000).toISOString() : null,
 };
}

export async function verMesa(sql, pessoa, id) {
 await exigirTabela(sql);
 await encerrarAbandonadas(sql);
 const [j] = await sql`SELECT * FROM vybe_escritorio_partidas WHERE id=${idValido(id)}`;
 if (!j) throw erro('Partida não encontrada.', 404);
 // Convite é só dos dois; partida começada, qualquer um da equipe assiste.
 if (j.estado === 'convite' && !ladoDe(j, pessoa.id)) throw erro('Partida não encontrada.', 404);
 if (conviteVencido(j)) j.estado = 'cancelado';
 return vista(j, pessoa.id, await nomes(sql, [j.desafiante, j.desafiado]));
}
// Convites, partidas e o que está rolando nesta mesa (para assistir), de um jogo.
export async function listarMesa(sql, pessoa, { jogo, camada, movel } = {}) {
 motorDe(jogo);
 if (!await mesasProntas(sql)) return { disponivel: false, convites: [], enviados: [], jogos: [], mesa: null };
 await encerrarAbandonadas(sql);
 const desde = new Date(Date.now() - CONVITE_MIN * 60000);
 const linhas = await sql`SELECT * FROM vybe_escritorio_partidas WHERE jogo=${jogo} AND ((estado='jogando' AND (desafiante=${pessoa.id} OR desafiado=${pessoa.id}
   OR (camada=${String(camada || '')} AND movel=${String(movel || '')})))
  OR (estado='convite' AND (desafiante=${pessoa.id} OR desafiado=${pessoa.id}) AND criado_em > ${desde}::timestamptz)) ORDER BY id DESC LIMIT 20`;
 const nome = await nomes(sql, [...new Set(linhas.flatMap((l) => [String(l.desafiante), String(l.desafiado)]))]);
 const v = linhas.map((l) => vista(l, pessoa.id, nome));
 return {
  disponivel: true,
  convites: v.filter((j) => j.estado === 'convite' && j.desafiado.id === String(pessoa.id)),
  enviados: v.filter((j) => j.estado === 'convite' && j.desafiante.id === String(pessoa.id)),
  jogos: v.filter((j) => j.estado === 'jogando' && j.eu),
  mesa: v.find((j) => j.estado === 'jogando' && j.camada === camada && j.movel === movel) || null,
 };
}

// Desafio: quem chama escolhe o jogo, a pessoa, a mesa e a aposta.
export async function desafiarMesa(sql, pessoa, salas, pedido) {
 await exigirTabela(sql);
 const jogo = String(pedido?.jogo || '');
 motorDe(jogo);
 const d = lerDesafio(pessoa, pedido), { para, camada, movel, chave, n, da, quer } = d;
 return sql.comTransacao(async (tx) => {
  const [ja] = await tx`SELECT id,desafiante FROM vybe_escritorio_partidas WHERE chave=${chave}`;
  if (ja) { if (String(ja.desafiante) !== String(pessoa.id)) throw erro('Pedido inválido.'); return { repetido: true, id: String(ja.id) }; }
  const [jogando] = await tx`SELECT id FROM vybe_escritorio_partidas WHERE jogo=${jogo} AND estado='jogando' AND (desafiante=${pessoa.id} OR desafiado=${pessoa.id})`;
  if (jogando) throw erro('Termine a sua partida antes de chamar outra.', 409);
  await conferirDesafio(tx, pessoa, salas, d);
  // Um convite aberto por vez de quem chama, por jogo: o novo substitui o antigo.
  await tx`UPDATE vybe_escritorio_partidas SET estado='cancelado',terminado_em=now() WHERE jogo=${jogo} AND estado='convite' AND desafiante=${pessoa.id}`;
  const [j] = await tx`INSERT INTO vybe_escritorio_partidas(jogo,chave,desafiante,desafiado,camada,movel,moedas,itens_desafiante,itens_desafiado)
   VALUES(${jogo},${chave},${pessoa.id},${para},${camada},${movel},${n},${JSON.stringify(da)}::jsonb,${JSON.stringify(quer)}::jsonb) RETURNING id`;
  return { repetido: false, id: String(j.id) };
 });
}

// acao: "aceitar"/"recusar" (quem foi chamado) ou "cancelar" (quem chamou).
// Aceitar confere tudo de novo, tira a aposta dos dois e dá as cartas/peças.
export async function responderMesa(sql, pessoa, salas, { id, acao }) {
 await exigirTabela(sql);
 if (!['aceitar', 'recusar', 'cancelar'].includes(acao)) throw erro('Pedido inválido.');
 const r = await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j) throw erro('Partida não encontrada.', 404);
  const eu = String(pessoa.id);
  if (acao === 'cancelar' ? eu !== String(j.desafiante) : eu !== String(j.desafiado)) throw erro('Só quem foi chamado responde; só quem chamou cancela.', 403);
  if (j.estado !== 'convite') return { repetido: true };
  if (acao !== 'aceitar' || conviteVencido(j)) {
   await tx`UPDATE vybe_escritorio_partidas SET estado=${acao === 'recusar' ? 'recusado' : 'cancelado'},terminado_em=now() WHERE id=${j.id}`;
   if (acao === 'aceitar') throw erro('O convite venceu. Chame de novo.', 409);
   return {};
  }
  const [ocupado] = await tx`SELECT id FROM vybe_escritorio_partidas WHERE jogo=${j.jogo} AND estado='jogando' AND (desafiante IN (${j.desafiante},${j.desafiado}) OR desafiado IN (${j.desafiante},${j.desafiado}))`;
  if (ocupado) throw erro('Um de vocês já está numa partida. Terminem aquela primeiro.', 409);
  const [mesa] = await tx`SELECT id FROM vybe_escritorio_partidas WHERE estado='jogando' AND camada=${j.camada} AND movel=${j.movel}`;
  if (mesa) throw erro('Essa mesa já está com uma partida. Esperem acabar.', 409);
  await cobrarAposta(tx, j, salas, `${j.jogo}:${j.id}`);
  await tx`UPDATE vybe_escritorio_partidas SET estado='jogando',mesa=${JSON.stringify(motorDe(j.jogo).iniciar())}::jsonb,iniciado_em=now(),ultimo_lance_em=now() WHERE id=${j.id}`;
  return {};
 });
 return { ...r, jogo: await verMesa(sql, pessoa, id), economia: await carregarEconomia(sql, pessoa.id) };
}

// Jogada: só de quem tem a vez, sobre a mesa que a pessoa viu (`n` = quantos
// lances ela tinha na tela; outro número é pedido repetido ou tela atrasada).
export async function lanceMesa(sql, pessoa, { id, n, ...pedido }) {
 await exigirTabela(sql);
 const r = await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j) throw erro('Partida não encontrada.', 404);
  const lado = ladoDe(j, pessoa.id);
  if (!lado) throw erro('Você está assistindo esta partida.', 403);
  if (j.estado !== 'jogando') throw erro('A partida já acabou.', 409);
  if (Number(n) !== (Number(j.mesa?.n) || 0)) throw erro('A mesa mudou. Olhe de novo.', 409);
  const { mesa, fim } = motorDe(j.jogo).jogar(j.mesa, lado, pedido);
  // Quem recebeu a proposta de empate e jogou, recusou.
  const empate = j.empate_de && String(j.empate_de) !== String(pessoa.id) ? null : j.empate_de;
  await tx`UPDATE vybe_escritorio_partidas SET mesa=${JSON.stringify(mesa)}::jsonb,ultimo_lance_em=now(),empate_de=${empate} WHERE id=${j.id}`;
  if (fim) await encerrar(tx, j, fim.resultado, fim.motivo);
  return { fim: Boolean(fim) };
 });
 return { ...r, jogo: await verMesa(sql, pessoa, id), ...(r.fim ? { economia: await carregarEconomia(sql, pessoa.id) } : {}) };
}

// Desistir, propor/aceitar/recusar empate e reivindicar a vitória quando a
// outra pessoa sumiu na vez dela.
export async function acaoMesa(sql, pessoa, { id, acao }) {
 await exigirTabela(sql);
 if (!['desistir', 'empate', 'aceitar-empate', 'recusar-empate', 'reivindicar'].includes(acao)) throw erro('Pedido inválido.');
 const r = await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j) throw erro('Partida não encontrada.', 404);
  const lado = ladoDe(j, pessoa.id);
  if (!lado) throw erro('Você está assistindo esta partida.', 403);
  if (j.estado !== 'jogando') return { repetido: true };
  const eu = String(pessoa.id), empateDe = j.empate_de ? String(j.empate_de) : null;
  if (acao === 'desistir') { await encerrar(tx, j, outro(lado), 'desistencia'); return { fim: true }; }
  if (acao === 'empate') { if (!empateDe) await tx`UPDATE vybe_escritorio_partidas SET empate_de=${eu} WHERE id=${j.id}`; return {}; }
  if (acao === 'aceitar-empate') {
   if (!empateDe || empateDe === eu) throw erro('Não há proposta de empate para aceitar.', 409);
   await encerrar(tx, j, 'empate', 'acordo'); return { fim: true };
  }
  if (acao === 'recusar-empate') { if (empateDe && empateDe !== eu) await tx`UPDATE vybe_escritorio_partidas SET empate_de=NULL WHERE id=${j.id}`; return {}; }
  if (j.mesa?.vez === lado) throw erro('A vez é sua: jogue.', 409);
  if (minutosDesde(j.ultimo_lance_em, Date.now()) < REIVINDICAR_MIN) throw erro(`Espere ${REIVINDICAR_MIN} minutos sem jogada da outra pessoa.`, 409);
  await encerrar(tx, j, lado, 'tempo');
  return { fim: true };
 });
 return { ...r, jogo: await verMesa(sql, pessoa, id), ...(r.fim ? { economia: await carregarEconomia(sql, pessoa.id) } : {}) };
}
