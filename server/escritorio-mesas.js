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

const MOTORES = { domino: motorDomino, poker: motorPoker, sinuca: motorSinuca, dama: motorDama, velha: motorVelha, truco: motorTruco };
// Convite sem resposta caduca; quem some na vez dele pode perder por tempo;
// partida largada um dia inteiro termina sozinha (perde quem tinha a vez).
const CONVITE_MIN = 10, REIVINDICAR_MIN = 5, ABANDONO_H = 24;
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
 await pagarAposta(tx, j, resultado === 'empate' ? null : idDoLado(j, resultado), `${j.jogo}:${j.id}`);
 await tx`UPDATE vybe_escritorio_partidas SET estado='fim',resultado=${resultado},motivo=${motivo},empate_de=NULL,terminado_em=now() WHERE id=${j.id} AND estado='jogando'`;
}
// Partidas largadas há um dia: perde quem tinha a vez (a aposta não fica presa).
// Em grupo, ganha quem tem mais fichas.
async function encerrarAbandonadas(sql, agora = Date.now()) {
 const velhas = await sql`SELECT id FROM vybe_escritorio_partidas WHERE estado='jogando' AND ultimo_lance_em < ${new Date(agora - ABANDONO_H * 3600000)}::timestamptz`;
 for (const { id } of velhas) await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${id} FOR UPDATE`;
  if (j?.estado === 'jogando') await encerrar(tx, j, emGrupo(j) ? MOTORES[j.jogo].lider(j.mesa) : outro(j.mesa.vez), 'abandono');
 });
}

function vista(j, eu, nome, agora = Date.now()) {
 const motor = MOTORES[j.jogo], lado = ladoDe(j, eu), jogando = j.estado === 'jogando', vez = jogando ? j.mesa?.vez : null;
 const pessoa = (id) => ({ id: String(id), nome: nome[String(id)] || '' });
 const lugares = jogadores(j).map(([l, id]) => ({ lado: l, ...pessoa(id), aceitou: l === 'desafiante' || aceitos(j).includes(id) }));
 return {
  id: String(j.id), jogo: j.jogo, estado: j.estado, camada: j.camada, movel: j.movel,
  // Cada lugar também pelo nome do lado (j.desafiado, j.jogador3…), como nos jogos de dois.
  ...Object.fromEntries(lugares.map((p) => [p.lado, { id: p.id, nome: p.nome }])),
  jogadores: lugares, grupo: emGrupo(j), eu: lado, vez, n: Number(j.mesa?.n) || 0,
  mesa: jogando || j.estado === 'fim' ? motor.vista(j.mesa, lado, !jogando) : null,
  moedas: Number(j.moedas) || 0, itens: { desafiante: j.itens_desafiante || [], desafiado: j.itens_desafiado || [] },
  resultado: j.resultado || null, motivo: j.motivo || null, motivo_nome: motor.motivos[j.motivo] || MOTIVOS[j.motivo] || null,
  empate_de: j.empate_de ? String(j.empate_de) : null,
  pode_reivindicar: jogando && Boolean(lado) && lado !== vez && !j.mesa?.saiu?.[lado] && minutosDesde(j.ultimo_lance_em, agora) >= REIVINDICAR_MIN,
  reivindicar_em: jogando && j.ultimo_lance_em ? new Date(new Date(j.ultimo_lance_em).getTime() + REIVINDICAR_MIN * 60000).toISOString() : null,
  convite_ate: j.estado === 'convite' ? new Date(new Date(j.criado_em).getTime() + CONVITE_MIN * 60000).toISOString() : null,
 };
}

export async function verMesa(sql, pessoa, id) {
 await exigirTabela(sql);
 await encerrarAbandonadas(sql);
 const [j] = await sql`SELECT * FROM vybe_escritorio_partidas WHERE id=${idValido(id)}`;
 if (!j) throw erro('Partida não encontrada.', 404);
 // Convite é só de quem está nele; partida começada, qualquer um da equipe assiste.
 if (j.estado === 'convite' && !ladoDe(j, pessoa.id)) throw erro('Partida não encontrada.', 404);
 if (conviteVencido(j)) j.estado = 'cancelado';
 const v = vista(j, pessoa.id, await nomes(sql, pessoasDaMesa(j)));
 // Placar dos dois neste jogo (todas as partidas terminadas entre eles; em grupo não há).
 if (emGrupo(j)) return v;
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

// acao: "aceitar"/"recusar" (quem foi chamado) ou "cancelar" (quem chamou).
// A partida começa quando o último chamado aceita. Em grupo, quem recusa sai
// da lista (se era o primeiro chamado, o seguinte toma o lugar dele).
export async function responderMesa(sql, pessoa, salas, { id, acao }) {
 await exigirTabela(sql);
 if (!['aceitar', 'recusar', 'cancelar'].includes(acao)) throw erro('Pedido inválido.');
 const r = await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j) throw erro('Partida não encontrada.', 404);
  const eu = String(pessoa.id);
  if (acao === 'cancelar' ? eu !== String(j.desafiante) : !chamados(j).includes(eu)) throw erro('Só quem foi chamado responde; só quem chamou cancela.', 403);
  if (j.estado !== 'convite') return { repetido: true };
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
  const rolando = await sql`SELECT jogo, movel, desafiante, desafiado, mais FROM vybe_escritorio_partidas WHERE estado='jogando' AND camada=${cena}`;
  const nome = await nomes(sql, [...new Set(rolando.flatMap(pessoasDaMesa))]);
  for (const l of rolando) ativas.push({ jogo: l.jogo, movel: l.movel, nomes: pessoasDaMesa(l).map((id) => nome[id] || '') });
  for (const l of await sql`SELECT x.id, x.jogo, p.nome FROM vybe_escritorio_partidas x JOIN vybe_pessoas p ON p.id=x.desafiante
    WHERE x.estado='convite' AND (x.desafiado=${pessoa.id} OR ${pessoa.id} = ANY(x.mais)) AND NOT (${pessoa.id} = ANY(x.aceitos)) AND x.criado_em > ${desde}::timestamptz`) convites.push({ jogo: l.jogo, id: String(l.id), de: l.nome });
 }
 return { ativas, convites };
}
