// Mesas de jogo do Escritório (pedido do Paulo, 27/10/2026): convite para quem
// está online, aposta, vez, desistência, empate combinado, vitória por tempo e
// abandono, iguais para todo jogo de dois (migrations/2026-10-27-escritorio-
// mesas.sql). Cada jogo é um motor ({ iniciar, vista, jogar, motivos }) que só
// sabe das próprias regras; o xadrez veio antes e tem tabela própria
// (server/escritorio-xadrez.js), mas usa a mesma aposta (escritorio-apostas.js).
//
// Pôquer em grupo (até 4 na mesma mesa; migrations/2026-10-27-escritorio-
// poker-mesa-cheia.sql): o motor diz até quantos (`grupo`) e sabe tirar alguém
// da partida (`sair`) e quem lidera (`lider`). Os chamados a mais ficam em
// `mais`; a partida começa quando todos aceitam, e quem recusa sai da lista.
// Em grupo não há empate combinado, a aposta é só de VybeCoins, e desistir ou
// sumir na vez tira só aquela pessoa: os outros seguem jogando.
import { carregarEconomia } from './escritorio-economia.js';
import { erro, idValido, minutosDesde, nomes, lerDesafio, conferirDesafio, cobrarAposta, pagarAposta, placarDe, avisarConvite, textoDoConvite, pessoasDaMesa } from './escritorio-apostas.js';
import { xadrezPronto } from './escritorio-xadrez.js';
import { motorDomino } from './escritorio-domino.js';
import { motorPoker } from './escritorio-poker.js';
import { motorSinuca } from './escritorio-sinuca.js';
import { motorDama } from './escritorio-dama.js';
import { motorVelha } from './escritorio-velha.js';
import { motorTruco } from './escritorio-truco.js';
import { botValido, botInfo, jogadaDoBot, PREMIOS, TETO_DIA, listaDeBots } from './escritorio-bots.js';

const MOTORES = { domino: motorDomino, poker: motorPoker, sinuca: motorSinuca, dama: motorDama, velha: motorVelha, truco: motorTruco };
// Convite sem resposta caduca; quem some na vez dele pode perder por tempo;
// partida largada um dia inteiro termina sozinha (perde quem tinha a vez).
const CONVITE_MIN = 10, REIVINDICAR_MIN = 5, ABANDONO_H = 24;
// Tempo da vez (cada motor diz o seu): estourou, o jogo faz a jogada mínima por
// quem sumiu; três estouros seguidos e a pessoa perde (em grupo, sai da mesa).
const ESTOUROS_MAX = 3;
const NOME_DO_JOGO = { domino: 'o dominó', poker: 'o pôquer', sinuca: 'a sinuca', dama: 'a dama', velha: 'o jogo da velha', truco: 'o truco' };
const MOTIVOS = { desistencia: 'Desistência', acordo: 'Empate combinado', tempo: 'Tempo esgotado', abandono: 'Partida abandonada' };
// Lugares na mesa, na ordem: quem chamou, o primeiro chamado e os do grupo.
const LADOS = ['desafiante', 'desafiado', 'jogador3', 'jogador4'];
const outro = (lado) => (lado === 'desafiante' ? 'desafiado' : 'desafiante');

export async function mesasProntas(sql) {
 const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_partidas') IS NOT NULL AS existe`;
 return Boolean(r?.existe);
}
const exigirTabela = async (sql) => { if (!await mesasProntas(sql)) throw erro('As mesas de jogo aguardam a migração do banco.', 503); };
const motorDe = (jogo) => { const m = MOTORES[jogo]; if (!m) throw erro('Jogo inválido.'); return m; };
const jogadores = (j) => pessoasDaMesa(j).map((id, i) => [LADOS[i], id]);
const idDoLado = (j, lado) => jogadores(j).find(([l]) => l === lado)?.[1] ?? null;
const ladoDe = (j, pessoaId) => jogadores(j).find(([, id]) => id === String(pessoaId))?.[0] ?? null;
const emGrupo = (j) => (j.mais || []).length > 0;
const chamados = (j) => pessoasDaMesa(j).slice(1);
const aceitos = (j) => (j.aceitos || []).map(String);
const todosAceitaram = (j) => chamados(j).every((id) => aceitos(j).includes(id));
const conviteVencido = (j, agora = Date.now()) => j.estado === 'convite' && minutosDesde(j.criado_em, agora) > CONVITE_MIN;

async function encerrar(tx, j, resultado, motivo) {
 if (j.bot) {
  const premio = resultado === 'desafiante' ? await pagarBot(tx, j) : null;
  await tx`UPDATE vybe_escritorio_partidas SET estado='fim',resultado=${resultado},motivo=${motivo},empate_de=NULL,terminado_em=now(),
   mesa=jsonb_set(mesa,'{premioBot}',${JSON.stringify(premio)}::jsonb) WHERE id=${j.id} AND estado='jogando'`;
  return;
 }
 await pagarAposta(tx, j, resultado === 'empate' ? null : idDoLado(j, resultado), `${j.jogo}:${j.id}`);
 await tx`UPDATE vybe_escritorio_partidas SET estado='fim',resultado=${resultado},motivo=${motivo},empate_de=NULL,terminado_em=now() WHERE id=${j.id} AND estado='jogando'`;
}
// Vitória sobre um bot: VybeCoins e XP do nível, até o teto do dia somando
// todos os bots (dia da Bahia). Pelo razão, sem regra (fora da Copa e do teto
// da semana do trabalho).
async function pagarBot(tx, j) {
 const info = botInfo(j.bot), p = j.desafiante;
 const [{ hoje }] = await tx`SELECT COALESCE(sum(quantidade),0)::int AS hoje FROM vybe_escritorio_moedas WHERE pessoa_id=${p} AND origem LIKE 'bot:%'
   AND criado_em >= (date_trunc('day', now() AT TIME ZONE 'America/Bahia') AT TIME ZONE 'America/Bahia')`;
 const moedas = Math.max(0, Math.min(info.premio.moedas, TETO_DIA - Number(hoje))), xp = moedas * 2;
 if (moedas > 0) await tx`SELECT vybe_lancar_pontos(${p},${'bot:' + j.id},NULL,NULL,${moedas},${xp})`;
 return { moedas, xp, teto: moedas < info.premio.moedas };
}
// Uma jogada do bot, se for a vez dele: pelo mesmo motor, com a vista do lado dele.
async function jogarBot(tx, j) {
 const lado = 'desafiado', info = botInfo(j.bot), motor = MOTORES[j.jogo];
 if (j.estado !== 'jogando' || j.mesa?.vez !== lado || !info) return false;
 const pedido = jogadaDoBot(j.jogo, info.nivel, j.mesa, lado, motor.vista(j.mesa, lado, false));
 const { mesa, fim } = motor.jogar(j.mesa, lado, pedido);
 await tx`UPDATE vybe_escritorio_partidas SET mesa=${JSON.stringify(mesa)}::jsonb,ultimo_lance_em=now() WHERE id=${j.id}`;
 if (fim) await encerrar(tx, { ...j, mesa }, fim.resultado, fim.motivo);
 return true;
}
// Partidas largadas há um dia: perde quem tinha a vez (a aposta não fica presa).
// Em grupo, ganha quem tem mais fichas.
async function encerrarAbandonadas(sql, agora = Date.now()) {
 const velhas = await sql`SELECT id FROM vybe_escritorio_partidas WHERE estado='jogando' AND ultimo_lance_em < ${new Date(agora - ABANDONO_H * 3600000)}::timestamptz`;
 for (const { id } of velhas) await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${id} FOR UPDATE`;
  if (j?.estado === 'jogando') await encerrar(tx, j, j.bot ? 'desafiado' : emGrupo(j) ? MOTORES[j.jogo].lider(j.mesa) : outro(j.mesa.vez), 'abandono');
 });
}

async function vencerTempos(sql, agora = Date.now()) {
 const velhas = await sql`SELECT id FROM vybe_escritorio_partidas WHERE estado='jogando' AND (ultimo_lance_em < ${new Date(agora - 20000)}::timestamptz
   OR (bot IS NOT NULL AND ultimo_lance_em < ${new Date(agora - 3000)}::timestamptz))`;
 for (const { id } of velhas) await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${id} FOR UPDATE`;
  const motor = MOTORES[j?.jogo], lado = j?.mesa?.vez;
  if (j?.bot && lado === 'desafiado' && j.estado === 'jogando') { await jogarBot(tx, j); return; }
  if (j?.estado !== 'jogando' || !motor?.tempo || !lado || (agora - new Date(j.ultimo_lance_em).getTime()) / 1000 < motor.tempo) return;
  const estouros = (j.mesa.tempos?.[lado] || 0) + 1;
  if (estouros >= ESTOUROS_MAX) {
   if (!emGrupo(j)) return encerrar(tx, j, outro(lado), 'tempo');
   const { mesa, fim } = motor.sair(j.mesa, lado, 'tempo');
   await tx`UPDATE vybe_escritorio_partidas SET mesa=${JSON.stringify(mesa)}::jsonb,ultimo_lance_em=now() WHERE id=${j.id}`;
   if (fim) await encerrar(tx, j, fim.resultado, fim.motivo);
   return;
  }
  let r;
  try { r = motor.jogar(j.mesa, lado, motor.automatico(j.mesa, lado)); } catch { return; }
  r.mesa.tempos = { ...(j.mesa.tempos || {}), [lado]: estouros };
  if (r.mesa.ultimo) r.mesa.ultimo.porTempo = true;
  await tx`UPDATE vybe_escritorio_partidas SET mesa=${JSON.stringify(r.mesa)}::jsonb,ultimo_lance_em=now(),empate_de=NULL WHERE id=${j.id}`;
  if (r.fim) await encerrar(tx, j, r.fim.resultado, r.fim.motivo);
 });
}

function vista(j, eu, nome, agora = Date.now()) {
 const motor = MOTORES[j.jogo], lado = ladoDe(j, eu), jogando = j.estado === 'jogando', vez = jogando ? j.mesa?.vez : null;
 const info = j.bot ? botInfo(j.bot) : null;
 const pessoa = (id) => (info && (id == null || id === 'null') ? { id: 'bot', nome: info.nome, bot: j.bot, avatar: info.avatar, frase: info.frase } : { id: String(id), nome: nome[String(id)] || '' });
 const lugares = jogadores(j).map(([l, id]) => ({ lado: l, ...pessoa(id), aceitou: l === 'desafiante' || aceitos(j).includes(id) }));
 return {
  id: String(j.id), jogo: j.jogo, estado: j.estado, camada: j.camada, movel: j.movel,
  // Cada lugar também pelo nome do lado (j.desafiado, j.jogador3…), como nos jogos de dois.
  ...Object.fromEntries(lugares.map((p) => [p.lado, { id: p.id, nome: p.nome }])),
  jogadores: lugares, grupo: emGrupo(j), eu: lado, vez, n: Number(j.mesa?.n) || 0,
  bot: info ? { id: j.bot, nivel: info.nivel, nome: info.nome, avatar: info.avatar, premio: info.premio } : null, premio_bot: j.mesa?.premioBot || null,
  mesa: jogando || j.estado === 'fim' ? motor.vista(j.mesa, lado, !jogando) : null,
  moedas: Number(j.moedas) || 0, itens: { desafiante: j.itens_desafiante || [], desafiado: j.itens_desafiado || [] },
  resultado: j.resultado || null, motivo: j.motivo || null, motivo_nome: motor.motivos[j.motivo] || MOTIVOS[j.motivo] || null,
  empate_de: j.empate_de ? String(j.empate_de) : null,
  // Até quando vai a vez de quem joga agora (o relógio da tela).
  prazo_vez: jogando && motor.tempo && j.ultimo_lance_em ? new Date(new Date(j.ultimo_lance_em).getTime() + motor.tempo * 1000).toISOString() : null,
  tempo_vez: motor.tempo || null,
  pode_reivindicar: jogando && Boolean(lado) && lado !== vez && !j.mesa?.saiu?.[lado] && minutosDesde(j.ultimo_lance_em, agora) >= REIVINDICAR_MIN,
  reivindicar_em: jogando && j.ultimo_lance_em ? new Date(new Date(j.ultimo_lance_em).getTime() + REIVINDICAR_MIN * 60000).toISOString() : null,
  convite_ate: j.estado === 'convite' ? new Date(new Date(j.criado_em).getTime() + CONVITE_MIN * 60000).toISOString() : null,
 };
}

export async function verMesa(sql, pessoa, id) {
 await exigirTabela(sql);
 await encerrarAbandonadas(sql);
 await vencerTempos(sql);
 const [j] = await sql`SELECT * FROM vybe_escritorio_partidas WHERE id=${idValido(id)}`;
 if (!j) throw erro('Partida não encontrada.', 404);
 // Convite é só de quem está nele; partida começada, qualquer um da equipe assiste.
 if (j.estado === 'convite' && !ladoDe(j, pessoa.id)) throw erro('Partida não encontrada.', 404);
 if (conviteVencido(j)) j.estado = 'cancelado';
 const v = vista(j, pessoa.id, await nomes(sql, pessoasDaMesa(j)));
 // Placar dos dois neste jogo (todas as partidas terminadas entre eles; em grupo e contra bot não há).
 if (emGrupo(j) || j.bot) return v;
 const feitas = await sql`SELECT resultado, desafiante, desafiado FROM vybe_escritorio_partidas WHERE jogo=${j.jogo} AND estado='fim' AND cardinality(mais)=0
   AND ((desafiante=${j.desafiante} AND desafiado=${j.desafiado}) OR (desafiante=${j.desafiado} AND desafiado=${j.desafiante}))`;
 v.placar = placarDe(feitas.map((l) => ({ vencedor: l.resultado === 'empate' ? null : l[l.resultado] })), j.desafiante, j.desafiado);
 return v;
}
// Convites, partidas e o que está rolando nesta mesa (para assistir), de um jogo.
// `aguardando`: convites em grupo que eu já aceitei, esperando os outros.
export async function listarMesa(sql, pessoa, { jogo, camada, movel } = {}) {
 // 'todos': a Mesa de Jogos (dominó, dama, velha, truco) mostra o que estiver rolando nela.
 const todos = jogo === 'todos';
 if (!todos) motorDe(jogo);
 if (!await mesasProntas(sql)) return { disponivel: false, convites: [], enviados: [], aguardando: [], jogos: [], mesa: null };
 await encerrarAbandonadas(sql);
 await vencerTempos(sql);
 const desde = new Date(Date.now() - CONVITE_MIN * 60000);
 const linhas = await sql`SELECT * FROM vybe_escritorio_partidas WHERE (${todos} OR jogo=${String(jogo)}) AND ((estado='jogando' AND (desafiante=${pessoa.id} OR desafiado=${pessoa.id} OR ${pessoa.id} = ANY(mais)
   OR (camada=${String(camada || '')} AND movel=${String(movel || '')})))
  OR (estado='convite' AND (desafiante=${pessoa.id} OR desafiado=${pessoa.id} OR ${pessoa.id} = ANY(mais)) AND criado_em > ${desde}::timestamptz)) ORDER BY id DESC LIMIT 20`;
 const nome = await nomes(sql, [...new Set(linhas.flatMap(pessoasDaMesa))]);
 const eu = String(pessoa.id), v = linhas.map((l) => ({ ...vista(l, pessoa.id, nome), _aceitei: aceitos(l).includes(eu) }));
 const limpar = (j) => { const { _aceitei, ...resto } = j; return resto; };
 const convites = v.filter((j) => j.estado === 'convite' && j.eu && j.eu !== 'desafiante');
 const aqui = v.find((j) => j.estado === 'jogando' && j.camada === camada && j.movel === movel);
 return {
  disponivel: true,
  convites: convites.filter((j) => !j._aceitei).map(limpar),
  aguardando: convites.filter((j) => j._aceitei).map(limpar),
  enviados: v.filter((j) => j.estado === 'convite' && j.eu === 'desafiante').map(limpar),
  jogos: v.filter((j) => j.estado === 'jogando' && j.eu).map(limpar),
  mesa: aqui ? limpar(aqui) : null,
 };
}

// Desafio: quem chama escolhe o jogo, a pessoa (e, no pôquer, até mais duas:
// `mais`), a mesa e a aposta.
export async function desafiarMesa(sql, pessoa, salas, pedido) {
 await exigirTabela(sql);
 const jogo = String(pedido?.jogo || '');
 const motor = motorDe(jogo);
 const d = lerDesafio(pessoa, pedido), { para, camada, movel, chave, n, da, quer } = d;
 const mais = [...new Set((Array.isArray(pedido?.mais) ? pedido.mais : []).map(String))];
 if (mais.length) {
  if (!motor.grupo) throw erro(`${motor.nome} é de dois.`);
  if (mais.length > motor.grupo - 2) throw erro(`${motor.nome} é de até ${motor.grupo} pessoas na mesa.`);
  if (mais.some((id) => !/^\d{1,18}$/.test(id) || id === String(pessoa.id) || id === para)) throw erro('Escolha pessoas diferentes da equipe.');
  if (da.length || quer.length) throw erro('Com mais de duas pessoas na mesa, a aposta é só em VybeCoins.');
 }
 const r = await sql.comTransacao(async (tx) => {
  const [ja] = await tx`SELECT id,desafiante FROM vybe_escritorio_partidas WHERE chave=${chave}`;
  if (ja) { if (String(ja.desafiante) !== String(pessoa.id)) throw erro('Pedido inválido.'); return { repetido: true, id: String(ja.id) }; }
  const [jogando] = await tx`SELECT id FROM vybe_escritorio_partidas WHERE jogo=${jogo} AND estado='jogando' AND (desafiante=${pessoa.id} OR desafiado=${pessoa.id} OR ${pessoa.id} = ANY(mais))`;
  if (jogando) throw erro('Termine a sua partida antes de chamar outra.', 409);
  await conferirDesafio(tx, pessoa, salas, d);
  if (mais.length) {
   const achados = await tx`SELECT id FROM vybe_pessoas WHERE id = ANY(${mais}::bigint[]) AND ativo=TRUE AND pode_entrar=TRUE`;
   if (achados.length !== mais.length) throw erro('Alguém escolhido não está na equipe do escritório.', 404);
  }
  // Um convite aberto por vez de quem chama, por jogo: o novo substitui o antigo.
  await tx`UPDATE vybe_escritorio_partidas SET estado='cancelado',terminado_em=now() WHERE jogo=${jogo} AND estado='convite' AND desafiante=${pessoa.id}`;
  const [j] = await tx`INSERT INTO vybe_escritorio_partidas(jogo,chave,desafiante,desafiado,mais,camada,movel,moedas,itens_desafiante,itens_desafiado)
   VALUES(${jogo},${chave},${pessoa.id},${para},${mais}::bigint[],${camada},${movel},${n},${JSON.stringify(da)}::jsonb,${JSON.stringify(quer)}::jsonb) RETURNING id`;
  return { repetido: false, id: String(j.id) };
 });
 if (!r.repetido) {
  const texto = textoDoConvite((await nomes(sql, [pessoa.id]))[String(pessoa.id)], NOME_DO_JOGO[jogo], camada, n);
  for (const id of [para, ...mais]) await avisarConvite(sql, id, texto);
 }
 return r;
}

// Começa a partida: confere que ninguém está jogando outra nem a mesa está
// ocupada, tira a aposta de todos e dá as cartas/peças.
async function comecar(tx, j, salas, quemAceita) {
 const ids = pessoasDaMesa(j);
 const [ocupado] = await tx`SELECT id FROM vybe_escritorio_partidas WHERE jogo=${j.jogo} AND estado='jogando' AND (desafiante = ANY(${ids}::bigint[]) OR desafiado = ANY(${ids}::bigint[]) OR mais && ${ids}::bigint[])`;
 if (ocupado) throw erro(ids.length > 2 ? 'Alguém da mesa já está numa partida. Terminem aquela primeiro.' : 'Um de vocês já está numa partida. Terminem aquela primeiro.', 409);
 const [mesa] = await tx`SELECT id FROM vybe_escritorio_partidas WHERE estado='jogando' AND camada=${j.camada} AND movel=${j.movel}`;
 if (mesa) throw erro('Essa mesa já está com uma partida. Esperem acabar.', 409);
 await cobrarAposta(tx, j, salas, `${j.jogo}:${j.id}`, quemAceita);
 const inicio = motorDe(j.jogo).iniciar(jogadores(j).map(([l]) => l));
 await tx`UPDATE vybe_escritorio_partidas SET estado='jogando',mesa=${JSON.stringify(inicio)}::jsonb,iniciado_em=now(),ultimo_lance_em=now() WHERE id=${j.id}`;
}

// acao: "aceitar"/"recusar" (quem foi chamado), "cancelar" ou "comecar" (quem
// chamou). A partida começa quando o último chamado aceita. Em grupo, quem
// recusa sai da lista (se era o primeiro chamado, o seguinte toma o lugar
// dele), e quem chamou pode começar só com quem já aceitou (Paulo, 27/10/2026:
// a mesa ficava parada esperando quem não respondia).
export async function responderMesa(sql, pessoa, salas, { id, acao }) {
 await exigirTabela(sql);
 if (!['aceitar', 'recusar', 'cancelar', 'comecar'].includes(acao)) throw erro('Pedido inválido.');
 const r = await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j) throw erro('Partida não encontrada.', 404);
  const eu = String(pessoa.id);
  const quemChamou = acao === 'cancelar' || acao === 'comecar';
  if (quemChamou ? eu !== String(j.desafiante) : !chamados(j).includes(eu)) throw erro('Só quem foi chamado responde; só quem chamou cancela ou começa.', 403);
  if (j.estado !== 'convite') return { repetido: true };
  if (acao === 'comecar') {
   if (conviteVencido(j)) throw erro('O convite venceu. Chame de novo.', 409);
   const prontos = chamados(j).filter((x) => aceitos(j).includes(x));
   if (!prontos.length) throw erro('Ninguém aceitou ainda.', 409);
   // Quem não respondeu sai do convite; quem aceitou senta, na ordem.
   j.desafiado = prontos[0]; j.mais = prontos.slice(1);
   await tx`UPDATE vybe_escritorio_partidas SET desafiado=${j.desafiado},mais=${j.mais}::bigint[] WHERE id=${j.id}`;
   await comecar(tx, j, salas, eu);
   return {};
  }
  if (acao === 'cancelar' || conviteVencido(j) || (acao === 'recusar' && !emGrupo(j))) {
   await tx`UPDATE vybe_escritorio_partidas SET estado=${acao === 'recusar' ? 'recusado' : 'cancelado'},terminado_em=now() WHERE id=${j.id}`;
   if (acao === 'aceitar') throw erro('O convite venceu. Chame de novo.', 409);
   return {};
  }
  if (acao === 'recusar') {
   const resto = chamados(j).filter((x) => x !== eu);
   j.desafiado = resto[0]; j.mais = resto.slice(1); j.aceitos = aceitos(j).filter((x) => x !== eu);
   await tx`UPDATE vybe_escritorio_partidas SET desafiado=${j.desafiado},mais=${j.mais}::bigint[],aceitos=${j.aceitos}::bigint[] WHERE id=${j.id}`;
   // Quem sobrou já tinha aceitado: tenta começar (se não der, o convite fica).
   if (todosAceitaram(j)) try { await comecar(tx, j, salas, null); } catch { /* fica o convite */ }
   return {};
  }
  j.aceitos = [...new Set([...aceitos(j), eu])];
  await tx`UPDATE vybe_escritorio_partidas SET aceitos=${j.aceitos}::bigint[] WHERE id=${j.id}`;
  if (!todosAceitaram(j)) return { aguardando: true };
  await comecar(tx, j, salas, eu);
  return {};
 });
 // Quem recusou um convite em grupo não está mais nele.
 if (acao === 'recusar' && !r.repetido) return { ...r, economia: await carregarEconomia(sql, pessoa.id) };
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
  if (mesa.tempos?.[lado]) mesa.tempos = { ...mesa.tempos, [lado]: 0 };
  // Quem recebeu a proposta de empate e jogou, recusou.
  const empate = j.empate_de && String(j.empate_de) !== String(pessoa.id) ? null : j.empate_de;
  await tx`UPDATE vybe_escritorio_partidas SET mesa=${JSON.stringify(mesa)}::jsonb,ultimo_lance_em=now(),empate_de=${empate} WHERE id=${j.id}`;
  if (fim) await encerrar(tx, j, fim.resultado, fim.motivo);
  return { fim: Boolean(fim) };
 });
 return { ...r, jogo: await verMesa(sql, pessoa, id), ...(r.fim ? { economia: await carregarEconomia(sql, pessoa.id) } : {}) };
}

// Desistir, propor/aceitar/recusar empate e reivindicar a vitória quando a
// outra pessoa sumiu na vez dela. Em grupo, desistir e reivindicar tiram da
// mesa só quem desistiu ou sumiu; a partida acaba quando sobra um.
export async function acaoMesa(sql, pessoa, { id, acao }) {
 await exigirTabela(sql);
 if (!['desistir', 'empate', 'aceitar-empate', 'recusar-empate', 'reivindicar'].includes(acao)) throw erro('Pedido inválido.');
 const r = await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j) throw erro('Partida não encontrada.', 404);
  const lado = ladoDe(j, pessoa.id);
  if (!lado) throw erro('Você está assistindo esta partida.', 403);
  if (j.estado !== 'jogando') return { repetido: true };
  const grupo = emGrupo(j);
  if (j.bot) {
   if (acao === 'desistir') { await encerrar(tx, j, 'desafiado', 'desistencia'); return { fim: true }; }
   throw erro('Contra o bot não tem empate nem vitória por tempo: jogue até o fim.', 409);
  }
  // Tira alguém da partida em grupo e grava a mesa; acaba se sobrou um.
  const tirar = async (quem, motivo) => {
   const { mesa, fim } = MOTORES[j.jogo].sair(j.mesa, quem, motivo);
   await tx`UPDATE vybe_escritorio_partidas SET mesa=${JSON.stringify(mesa)}::jsonb,ultimo_lance_em=now() WHERE id=${j.id}`;
   if (fim) await encerrar(tx, j, fim.resultado, fim.motivo);
   return { fim: Boolean(fim) };
  };
  if (grupo && j.mesa?.saiu?.[lado]) throw erro('Você já saiu desta partida.', 409);
  const eu = String(pessoa.id), empateDe = j.empate_de ? String(j.empate_de) : null;
  if (acao === 'desistir') {
   if (grupo) return tirar(lado, 'desistencia');
   await encerrar(tx, j, outro(lado), 'desistencia'); return { fim: true };
  }
  if (grupo && acao !== 'reivindicar') throw erro('Com mais de duas pessoas na mesa não tem empate combinado.', 409);
  if (acao === 'empate') { if (!empateDe) await tx`UPDATE vybe_escritorio_partidas SET empate_de=${eu} WHERE id=${j.id}`; return {}; }
  if (acao === 'aceitar-empate') {
   if (!empateDe || empateDe === eu) throw erro('Não há proposta de empate para aceitar.', 409);
   await encerrar(tx, j, 'empate', 'acordo'); return { fim: true };
  }
  if (acao === 'recusar-empate') { if (empateDe && empateDe !== eu) await tx`UPDATE vybe_escritorio_partidas SET empate_de=NULL WHERE id=${j.id}`; return {}; }
  if (j.mesa?.vez === lado) throw erro('A vez é sua: jogue.', 409);
  if (minutosDesde(j.ultimo_lance_em, Date.now()) < REIVINDICAR_MIN) throw erro(`Espere ${REIVINDICAR_MIN} minutos sem jogada da outra pessoa.`, 409);
  if (grupo) return tirar(j.mesa.vez, 'tempo');
  await encerrar(tx, j, lado, 'tempo');
  return { fim: true };
 });
 return { ...r, jogo: await verMesa(sql, pessoa, id), ...(r.fim ? { economia: await carregarEconomia(sql, pessoa.id) } : {}) };
}

// O que a sala mostra sem abrir nada: as mesas com partida rolando nesta cena
// (placa em cima do móvel, para quem passa saber que pode assistir) e os
// convites que chegaram para mim em qualquer jogo, inclusive o xadrez.
export async function resumoDosJogos(sql, pessoa, camada) {
 const desde = new Date(Date.now() - CONVITE_MIN * 60000), cena = String(camada || '');
 const ativas = [], convites = [];
 if (await xadrezPronto(sql)) {
  for (const l of await sql`SELECT x.movel, a.nome AS a, b.nome AS b FROM vybe_escritorio_xadrez x JOIN vybe_pessoas a ON a.id=x.brancas JOIN vybe_pessoas b ON b.id=x.pretas
    WHERE x.estado='jogando' AND x.camada=${cena}`) ativas.push({ jogo: 'xadrez', movel: l.movel, nomes: [l.a, l.b] });
  for (const l of await sql`SELECT x.id, p.nome FROM vybe_escritorio_xadrez x JOIN vybe_pessoas p ON p.id=x.desafiante
    WHERE x.estado='convite' AND x.desafiado=${pessoa.id} AND x.criado_em > ${desde}::timestamptz`) convites.push({ jogo: 'xadrez', id: String(l.id), de: l.nome });
 }
 if (await mesasProntas(sql)) {
  const rolando = await sql`SELECT jogo, movel, desafiante, desafiado, mais, bot FROM vybe_escritorio_partidas WHERE estado='jogando' AND camada=${cena}`;
  const nome = await nomes(sql, [...new Set(rolando.flatMap(pessoasDaMesa))]);
  for (const l of rolando) ativas.push({ jogo: l.jogo, movel: l.movel, nomes: pessoasDaMesa(l).map((id) => (id === 'null' ? botInfo(l.bot)?.nome || 'Bot' : nome[id] || '')) });
  for (const l of await sql`SELECT x.id, x.jogo, p.nome FROM vybe_escritorio_partidas x JOIN vybe_pessoas p ON p.id=x.desafiante
    WHERE x.estado='convite' AND (x.desafiado=${pessoa.id} OR ${pessoa.id} = ANY(x.mais)) AND NOT (${pessoa.id} = ANY(x.aceitos)) AND x.criado_em > ${desde}::timestamptz`) convites.push({ jogo: l.jogo, id: String(l.id), de: l.nome });
 }
 return { ativas, convites };
}

// --- Desafios contra bots ---------------------------------------------------
// Os bots de um jogo, com o prêmio de cada um e quanto ainda dá para ganhar hoje.
export async function botsDoJogo(sql, pessoa, jogo) {
 motorDe(jogo);
 const [{ hoje }] = await sql`SELECT COALESCE(sum(quantidade),0)::int AS hoje FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoa.id} AND origem LIKE 'bot:%'
   AND criado_em >= (date_trunc('day', now() AT TIME ZONE 'America/Bahia') AT TIME ZONE 'America/Bahia')`;
 const vitorias = await sql`SELECT bot, count(*)::int AS n FROM vybe_escritorio_partidas WHERE jogo=${jogo} AND bot IS NOT NULL AND desafiante=${pessoa.id} AND estado='fim' AND resultado='desafiante' GROUP BY bot`;
 const venceu = Object.fromEntries(vitorias.map((l) => [l.bot, l.n]));
 return { bots: listaDeBots(jogo).map((b) => ({ ...b, vitorias: venceu[b.bot] || 0 })), resta_hoje: Math.max(0, TETO_DIA - Number(hoje)), teto_dia: TETO_DIA };
}
// Começa na hora: o bot não precisa aceitar. Uma partida contra bot por vez, por jogo.
export async function desafiarBot(sql, pessoa, { jogo, nivel, camada, movel, chave } = {}) {
 await exigirTabela(sql);
 const motor = motorDe(String(jogo || ''));
 if (!botValido(jogo, nivel)) throw erro('Esse bot não existe.');
 if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(chave))) throw erro('Pedido inválido.');
 const r = await sql.comTransacao(async (tx) => {
  const [ja] = await tx`SELECT id,desafiante FROM vybe_escritorio_partidas WHERE chave=${chave}`;
  if (ja) { if (String(ja.desafiante) !== String(pessoa.id)) throw erro('Pedido inválido.'); return { id: String(ja.id) }; }
  const [jogando] = await tx`SELECT id FROM vybe_escritorio_partidas WHERE jogo=${jogo} AND estado='jogando' AND (desafiante=${pessoa.id} OR desafiado=${pessoa.id} OR ${pessoa.id} = ANY(mais))`;
  if (jogando) throw erro('Termine a sua partida antes de começar outra.', 409);
  const inicio = motor.iniciar(['desafiante', 'desafiado']);
  const [j] = await tx`INSERT INTO vybe_escritorio_partidas(jogo,chave,desafiante,desafiado,bot,camada,movel,estado,mesa,iniciado_em,ultimo_lance_em)
   VALUES(${jogo},${chave},${pessoa.id},NULL,${jogo + ':' + nivel},${String(camada || 'jogos')},${String(movel || 'bot@0,0')},'jogando',${JSON.stringify(inicio)}::jsonb,now(),now()) RETURNING id`;
  return { id: String(j.id) };
 });
 return { ...r, jogo: await verMesa(sql, pessoa, r.id) };
}
// A tela pede a jogada do bot quando é a vez dele (com o ritmo de quem pensa);
// `n` é o número de lances que a tela viu, para não jogar duas vezes.
export async function vezDoBot(sql, pessoa, { id, n } = {}) {
 await exigirTabela(sql);
 await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j?.bot || String(j.desafiante) !== String(pessoa.id)) throw erro('Partida não encontrada.', 404);
  if (Number(n) !== (Number(j.mesa?.n) || 0)) return;
  await jogarBot(tx, j);
 });
 return { jogo: await verMesa(sql, pessoa, id) };
}
