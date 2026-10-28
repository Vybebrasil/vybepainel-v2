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
import { botValido, botInfo, jogadaDoBot, TETO_DIA, listaDeBots, pagarBot } from './escritorio-bots.js';
import { CAMADA, MOVEL, MESA_MOEDAS_MAX } from './escritorio-apostas.js';
import { clientesProntos, clientesDaMesa, conferirClientes, sentarClientes, demandasDosClientes, pagarCliente, nivelDoCliente, marcaDoCliente, falaDoCliente } from './escritorio-clientes-poker.js';

const MOTORES = { domino: motorDomino, poker: motorPoker, sinuca: motorSinuca, dama: motorDama, velha: motorVelha, truco: motorTruco };
// Convite sem resposta caduca; quem some na vez dele pode perder por tempo;
// partida largada um dia inteiro termina sozinha (perde quem tinha a vez).
const CONVITE_MIN = 10, REIVINDICAR_MIN = 5, ABANDONO_H = 24;
// Tempo da vez (cada motor diz o seu): estourou, o jogo faz a jogada mínima por
// quem sumiu; três estouros seguidos e a pessoa perde (em grupo, sai da mesa).
const ESTOUROS_MAX = 3;
const NOME_DO_JOGO = { domino: 'o dominó', poker: 'o pôquer', sinuca: 'a sinuca', dama: 'a dama', velha: 'o jogo da velha', truco: 'o truco' };
const MOTIVOS = { desistencia: 'Desistência', acordo: 'Empate combinado', tempo: 'Tempo esgotado', abandono: 'Partida abandonada' };
// Lugares na mesa, na ordem: quem chamou, o primeiro chamado, os do grupo e,
// no pôquer, os clientes (até 8 lugares; Paulo, 28/10/2026).
const LADOS = ['desafiante', 'desafiado', 'jogador3', 'jogador4', 'jogador5', 'jogador6', 'jogador7', 'jogador8'];
const outro = (lado) => (lado === 'desafiante' ? 'desafiado' : 'desafiante');

export async function mesasProntas(sql) {
 const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_partidas') IS NOT NULL AS existe`;
 return Boolean(r?.existe);
}
const exigirTabela = async (sql) => { if (!await mesasProntas(sql)) throw erro('As mesas de jogo aguardam a migração do banco.', 503); };
const motorDe = (jogo) => { const m = MOTORES[jogo]; if (!m) throw erro('Jogo inválido.'); return m; };
// Os clientes sentados (pôquer): lugares depois das pessoas, com id 'c<id do cliente>'.
const clientesDe = (j) => (j.clientes || []).map(String);
const jogadores = (j) => {
 const c = clientesDe(j);
 if (!c.length) return pessoasDaMesa(j).map((id, i) => [LADOS[i], id]);
 return [...pessoasDaMesa(j).filter((id) => id !== 'null'), ...c.map((id) => 'c' + id)].map((id, i) => [LADOS[i], id]);
};
const idDoLado = (j, lado) => jogadores(j).find(([l]) => l === lado)?.[1] ?? null;
const ladoDe = (j, pessoaId) => jogadores(j).find(([, id]) => id === String(pessoaId))?.[0] ?? null;
const ehCliente = (id) => /^c\d+$/.test(String(id));
const clienteDoLado = (j, lado) => { const id = idDoLado(j, lado); return id && ehCliente(id) ? id.slice(1) : null; };
const emGrupo = (j) => (j.mais || []).length > 0 || clientesDe(j).length > 0;
const chamados = (j) => pessoasDaMesa(j).slice(1).filter((id) => id !== 'null');
const aceitos = (j) => (j.aceitos || []).map(String);
const todosAceitaram = (j) => chamados(j).every((id) => aceitos(j).includes(id));
const conviteVencido = (j, agora = Date.now()) => j.estado === 'convite' && minutosDesde(j.criado_em, agora) > CONVITE_MIN;

// A FORA (Paulo, 27/10/2026: "to jogando com o Vinícius e o Ewerton de fora
// esperando... ele PEDE FORA, e quem perder ele entra no lugar, e assim pode ir
// pegando fila na fora"): quem assiste uma partida de dois pede fora e entra no
// fim da fila (mesa.filaFora, os ids na ordem; mesa.fora já é do pôquer). Quando a partida acaba, quem perdeu
// sai e a próxima começa na hora entre quem ganhou e o primeiro da fila, sem
// aposta, na mesma mesa; a fila que sobra vai junto. No empate, sai quem foi
// chamado. Quem da fila já está noutra partida perde a vez. A partida que acabou
// guarda o id da próxima (mesa.proxima) para as telas irem atrás.
const comFora = (j, mesa) => (j.mesa?.filaFora?.length && mesa && !mesa.fora ? { ...mesa, fora: j.mesa.fora } : mesa);
async function chamarDaFora(tx, j, resultado) {
 const fila = (j.mesa?.filaFora || []).map(String);
 if (!fila.length || j.bot || emGrupo(j)) return;
 const fica = resultado === 'desafiado' ? String(j.desafiado) : String(j.desafiante);
 for (let i = 0; i < fila.length; i++) {
  const entra = fila[i];
  if (entra === fica) continue;
  const [ocupado] = await tx`SELECT id FROM vybe_escritorio_partidas WHERE jogo=${j.jogo} AND estado IN ('jogando','convite') AND (desafiante=${entra} OR desafiado=${entra} OR ${entra} = ANY(mais))`;
  if (ocupado) continue;
  const resto = fila.slice(i + 1).filter((id) => id !== fica);
  const [nova] = await tx`INSERT INTO vybe_escritorio_partidas(jogo,chave,desafiante,desafiado,mais,camada,movel,moedas,itens_desafiante,itens_desafiado)
   VALUES(${j.jogo},${'fora-' + j.id + '-' + entra},${fica},${entra},'{}'::bigint[],${j.camada},${j.movel},0,'[]'::jsonb,'[]'::jsonb) RETURNING *`;
  await comecar(tx, nova, null, fica);
  if (resto.length) await tx`UPDATE vybe_escritorio_partidas SET mesa=jsonb_set(mesa,'{filaFora}',${JSON.stringify(resto)}::jsonb) WHERE id=${nova.id}`;
  await tx`UPDATE vybe_escritorio_partidas SET mesa=jsonb_set(mesa,'{proxima}',${JSON.stringify(String(nova.id))}::jsonb) WHERE id=${j.id}`;
  return { id: String(nova.id), entra, fica };
 }
}
async function encerrar(tx, j, resultado, motivo) {
 // Pôquer com clientes: o pote é de todas as cadeiras; se um cliente ganhou, vai para a carteira dele.
 if (clientesDe(j).length) {
  const razao = `${j.jogo}:${j.id}`, cliente = clienteDoLado(j, resultado);
  if (cliente) await pagarCliente(tx, cliente, (Number(j.moedas) || 0) * jogadores(j).length, razao);
  else await pagarAposta(tx, j, idDoLado(j, resultado), razao, jogadores(j).length);
  await tx`UPDATE vybe_escritorio_partidas SET estado='fim',resultado=${resultado},motivo=${motivo},empate_de=NULL,terminado_em=now() WHERE id=${j.id} AND estado='jogando'`;
  return;
 }
 if (j.bot) {
  const premio = resultado === 'desafiante' ? await pagarBot(tx, j.desafiante, j.bot, 'bot:' + j.id) : null;
  await tx`UPDATE vybe_escritorio_partidas SET estado='fim',resultado=${resultado},motivo=${motivo},empate_de=NULL,terminado_em=now(),
   mesa=jsonb_set(mesa,'{premioBot}',${JSON.stringify(premio)}::jsonb) WHERE id=${j.id} AND estado='jogando'`;
  return;
 }
 await pagarAposta(tx, j, resultado === 'empate' ? null : idDoLado(j, resultado), `${j.jogo}:${j.id}`);
 await tx`UPDATE vybe_escritorio_partidas SET estado='fim',resultado=${resultado},motivo=${motivo},empate_de=NULL,terminado_em=now() WHERE id=${j.id} AND estado='jogando'`;
 const proxima = await chamarDaFora(tx, j, resultado);
 // Num savepoint: erro de SQL no aviso aborta a transação inteira (e desfaria o
 // fim da partida), então só o aviso volta atrás.
 if (proxima) {
  await tx`SAVEPOINT aviso_fora`;
  try { const quem = (await nomes(tx, [proxima.fica]))[proxima.fica] || 'quem ganhou'; await avisarConvite(tx, proxima.entra, `Sua vez na fora: ${NOME_DO_JOGO[j.jogo] || j.jogo} contra ${quem.split(' ')[0]}, na mesma mesa.`); await tx`RELEASE SAVEPOINT aviso_fora`; }
  catch { await tx`ROLLBACK TO SAVEPOINT aviso_fora`; }
 }
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
// Os clientes falam (as piadas sobre as demandas) depois de uma jogada: o que
// o cliente fez, e quem levou a mão que acabou de fechar. Guarda as últimas 8.
function comFalas(j, antes, depois) {
 const info = depois.clientesInfo;
 if (!info) return depois;
 const falas = [...(depois.falas || [])], n = depois.n || 0;
 const falar = (lado, evento, valor) => { const texto = falaDoCliente(info[lado], evento, Math.random(), valor); if (texto) falas.push({ lado, texto, n }); };
 const u = depois.ultimo;
 if (u && u !== antes.ultimo && info[u.lado]) falar(u.lado, { apostou: 'aumentou', aumentou: 'aumentou' }[u.acao] || u.acao, u.valor || 0);
 const a = depois.anterior;
 if (a && a.mao !== antes.anterior?.mao) {
  for (const l of Object.keys(a.ganhos || {})) if (info[l] && a.pote >= 60) falar(l, 'ganhou', a.pote);
  for (const l of Object.keys(info)) if (!a.ganhos?.[l] && (antes.posto?.[l] || 0) >= 150) falar(l, 'perdeu', antes.posto[l]);
 }
 depois.falas = falas.slice(-8);
 return depois;
}
// Mesa com clientes: se só sobraram clientes (as pessoas saíram), a partida
// acaba com quem tem mais fichas.
function soClientes(j, mesa, fim) {
 if (fim || !clientesDe(j).length) return fim;
 const restam = (mesa.lados || []).filter((l) => !mesa.saiu?.[l] && (mesa.fichas?.[l] > 0));
 return restam.every((l) => clienteDoLado(j, l)) ? { resultado: MOTORES[j.jogo].lider(mesa), motivo: 'abandono' } : null;
}
// A vez de um cliente: joga pelo bot do pôquer, no nível dele.
async function jogarCliente(tx, j) {
 const lado = j.mesa?.vez, cliente = j.estado === 'jogando' ? clienteDoLado(j, lado) : null, motor = MOTORES[j.jogo];
 if (!cliente) return false;
 const pedido = jogadaDoBot(j.jogo, nivelDoCliente(cliente), j.mesa, lado, motor.vista(j.mesa, lado, false));
 const r = motor.jogar(j.mesa, lado, pedido), mesa = comFalas(j, j.mesa, r.mesa);
 await tx`UPDATE vybe_escritorio_partidas SET mesa=${JSON.stringify(mesa)}::jsonb,ultimo_lance_em=now() WHERE id=${j.id}`;
 if (r.fim) await encerrar(tx, { ...j, mesa }, r.fim.resultado, r.fim.motivo);
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
 // Mesas com clientes: o cliente joga sozinho 2,5 s depois do último lance (a tela pede antes, se estiver aberta).
 const comClientes = await clientesProntos(sql) ? await sql`SELECT id FROM vybe_escritorio_partidas WHERE estado='jogando' AND cardinality(clientes) > 0
   AND ultimo_lance_em < ${new Date(agora - 2500)}::timestamptz` : [];
 for (const id of [...new Set([...velhas, ...comClientes].map((l) => String(l.id)))]) await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${id} FOR UPDATE`;
  const motor = MOTORES[j?.jogo], lado = j?.mesa?.vez;
  if (j?.bot && lado === 'desafiado' && j.estado === 'jogando') { await jogarBot(tx, j); return; }
  if (j?.estado === 'jogando' && clienteDoLado(j, lado)) { await jogarCliente(tx, j); return; }
  if (j?.estado !== 'jogando' || !motor?.tempo || !lado || (agora - new Date(j.ultimo_lance_em).getTime()) / 1000 < motor.tempo) return;
  const estouros = (j.mesa.tempos?.[lado] || 0) + 1;
  if (estouros >= ESTOUROS_MAX) {
   if (!emGrupo(j)) return encerrar(tx, j, outro(lado), 'tempo');
   const { mesa, fim: f } = motor.sair(j.mesa, lado, 'tempo'), fim = soClientes(j, mesa, f);
   await tx`UPDATE vybe_escritorio_partidas SET mesa=${JSON.stringify(mesa)}::jsonb,ultimo_lance_em=now() WHERE id=${j.id}`;
   if (fim) await encerrar(tx, j, fim.resultado, fim.motivo);
   return;
  }
  let r;
  try { r = motor.jogar(j.mesa, lado, motor.automatico(j.mesa, lado)); r.mesa = comFora(j, r.mesa); } catch { return; }
  r.mesa.tempos = { ...(j.mesa.tempos || {}), [lado]: estouros };
  if (r.mesa.ultimo) r.mesa.ultimo.porTempo = true;
  comFalas(j, j.mesa, r.mesa);
  await tx`UPDATE vybe_escritorio_partidas SET mesa=${JSON.stringify(r.mesa)}::jsonb,ultimo_lance_em=now(),empate_de=NULL WHERE id=${j.id}`;
  if (r.fim) await encerrar(tx, j, r.fim.resultado, r.fim.motivo);
 });
}

function vista(j, eu, nome, agora = Date.now()) {
 const motor = MOTORES[j.jogo], lado = ladoDe(j, eu), jogando = j.estado === 'jogando', vez = jogando ? j.mesa?.vez : null;
 const info = j.bot ? botInfo(j.bot) : null;
 // O cliente na mesa: nome, iniciais e cor (o avatar dele) e o jeito de jogar.
 const cliente = (id) => { const c = id.slice(1); return { id, nome: nome[id] || 'Cliente', cliente: true, nivel: nivelDoCliente(c), ...marcaDoCliente(c, nome[id]) }; };
 const pessoa = (id) => (ehCliente(id) ? cliente(String(id)) : info && (id == null || id === 'null') ? { id: 'bot', nome: info.nome, bot: j.bot, avatar: info.avatar, frase: info.frase } : { id: String(id), nome: nome[String(id)] || '' });
 const lugares = jogadores(j).map(([l, id]) => ({ lado: l, ...pessoa(id), aceitou: l === 'desafiante' || aceitos(j).includes(id) }));
 return {
  id: String(j.id), jogo: j.jogo, estado: j.estado, camada: j.camada, movel: j.movel,
  // Cada lugar também pelo nome do lado (j.desafiado, j.jogador3…), como nos jogos de dois.
  ...Object.fromEntries(lugares.map((p) => [p.lado, { id: p.id, nome: p.nome, ...(p.cliente ? { cliente: true, iniciais: p.iniciais, cor: p.cor } : {}) }])),
  jogadores: lugares, grupo: emGrupo(j), eu: lado, vez, n: Number(j.mesa?.n) || 0,
  bot: info ? { id: j.bot, nivel: info.nivel, nome: info.nome, avatar: info.avatar, premio: info.premio } : null, premio_bot: j.mesa?.premioBot || null,
  mesa: jogando || j.estado === 'fim' ? motor.vista(j.mesa, lado, !jogando) : null,
  // As falas dos clientes (pôquer), com o número do lance em que saíram.
  falas: j.mesa?.falas || [], clientes: clientesDe(j).length,
  moedas: Number(j.moedas) || 0, itens: { desafiante: j.itens_desafiante || [], desafiado: j.itens_desafiado || [] },
  resultado: j.resultado || null, motivo: j.motivo || null, motivo_nome: motor.motivos[j.motivo] || MOTIVOS[j.motivo] || null,
  empate_de: j.empate_de ? String(j.empate_de) : null,
  // Até quando vai a vez de quem joga agora (o relógio da tela).
  prazo_vez: jogando && motor.tempo && j.ultimo_lance_em ? new Date(new Date(j.ultimo_lance_em).getTime() + motor.tempo * 1000).toISOString() : null,
  tempo_vez: motor.tempo || null,
  // A fora: quem está na fila (com o nome), se eu posso pedir e a próxima partida.
  fora: (j.mesa?.filaFora || []).map((id) => ({ id: String(id), nome: nome[String(id)] || 'Alguém' })),
  pode_pedir_fora: jogando && !lado && !j.bot && !emGrupo(j) && Boolean(eu) && !(j.mesa?.filaFora || []).map(String).includes(String(eu)),
  proxima: j.mesa?.proxima || null,
  pode_reivindicar: jogando && Boolean(lado) && lado !== vez && !j.mesa?.saiu?.[lado] && minutosDesde(j.ultimo_lance_em, agora) >= REIVINDICAR_MIN,
  reivindicar_em: jogando && j.ultimo_lance_em ? new Date(new Date(j.ultimo_lance_em).getTime() + REIVINDICAR_MIN * 60000).toISOString() : null,
  convite_ate: j.estado === 'convite' ? new Date(new Date(j.criado_em).getTime() + CONVITE_MIN * 60000).toISOString() : null,
 };
}

// Nomes de quem está na mesa: as pessoas pelo id e os clientes por 'c<id>'.
async function nomesDaMesa(sql, linhas) {
 const nome = await nomes(sql, [...new Set(linhas.flatMap((l) => [...pessoasDaMesa(l), ...(l.mesa?.filaFora || []).map(String)]))]);
 const ids = [...new Set(linhas.flatMap(clientesDe))];
 if (ids.length) for (const c of await sql`SELECT id,nome FROM vybe_clientes WHERE id = ANY(${ids}::bigint[])`) nome['c' + c.id] = c.nome;
 return nome;
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
 const v = vista(j, pessoa.id, await nomesDaMesa(sql, [j]));
 // Placar dos dois neste jogo (todas as partidas terminadas entre eles; em grupo e contra bot não há).
 if (emGrupo(j) || j.bot) return v;
 const feitas = await sql`SELECT id, resultado, motivo, moedas, desafiante, desafiado, terminado_em FROM vybe_escritorio_partidas WHERE jogo=${j.jogo} AND estado='fim' AND cardinality(mais)=0
   AND ((desafiante=${j.desafiante} AND desafiado=${j.desafiado}) OR (desafiante=${j.desafiado} AND desafiado=${j.desafiante})) ORDER BY terminado_em DESC NULLS LAST, id DESC`;
 v.placar = placarDe(feitas.map((l) => ({ vencedor: l.resultado === 'empate' ? null : l[l.resultado] })), j.desafiante, j.desafiado);
 // Histórico entre os dois (Paulo, 28/10/2026: "o placar... e o histórico e
 // ranking da sinuca tá ruim, refaça, tanto o histórico entre os jogadores que
 // estão se enfrentando quanto o ranking geral"): as últimas 8, da mais nova,
 // com quem ganhou, o motivo e o valor; e a sequência de quem vem ganhando.
 const motor = MOTORES[j.jogo];
 v.historico = feitas.slice(0, 8).map((l) => ({ id: String(l.id), vencedor: l.resultado === 'empate' ? null : String(l[l.resultado]), motivo: motor?.motivos?.[l.motivo] || MOTIVOS[l.motivo] || null, moedas: l.moedas || 0, em: l.terminado_em }));
 const seq = feitas.findIndex((l) => l.resultado === 'empate' || String(l[l.resultado]) !== String(feitas[0] && feitas[0][feitas[0].resultado]));
 v.sequencia = feitas.length && feitas[0].resultado !== 'empate' ? { quem: String(feitas[0][feitas[0].resultado]), vitorias: seq < 0 ? feitas.length : seq } : null;
 v.ranking = await rankingGeral(sql, j.jogo, [j.desafiante, j.desafiado]);
 return v;
}
// Ranking geral de um jogo (todas as partidas terminadas entre pessoas, sem
// bot): vitórias, derrotas e a posição. Vem o top 8 e, se estiverem fora dele,
// as pessoas pedidas (`com`), cada uma com a posição dela.
export async function rankingGeral(sql, jogo, com = []) {
 const linhas = await sql`SELECT desafiante, desafiado, mais, resultado FROM vybe_escritorio_partidas WHERE jogo=${jogo} AND estado='fim' AND bot IS NULL AND resultado IS NOT NULL`;
 const placar = new Map(), de = (id) => placar.get(id) || placar.set(id, { id, vitorias: 0, derrotas: 0, empates: 0 }).get(id);
 for (const l of linhas) {
  const mesa = [l.desafiante, l.desafiado, ...(l.mais || [])].filter((p) => p != null).map(String);
  if (l.resultado === 'empate') { for (const p of mesa) de(p).empates++; continue; }
  const v = mesa[LADOS.indexOf(l.resultado)];
  if (!v) continue;
  for (const p of mesa) if (p === v) de(p).vitorias++; else de(p).derrotas++;
 }
 const todos = [...placar.values()].sort((a, b) => b.vitorias - a.vitorias || a.derrotas - b.derrotas || a.id.localeCompare(b.id));
 todos.forEach((p, i) => { p.posicao = i + 1; });
 const pedir = new Set(com.map(String)), lista = todos.filter((p, i) => i < 8 || pedir.has(p.id));
 const nome = await nomes(sql, lista.map((p) => p.id));
 return { total: todos.length, lista: lista.map((p) => ({ ...p, nome: nome[p.id] || 'Alguém' })) };
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
 const nome = await nomesDaMesa(sql, linhas);
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
 const clientes = Array.isArray(pedido?.clientes) ? [...new Set(pedido.clientes.map(String))] : [];
 if (clientes.length && jogo !== 'poker') throw erro('Só o pôquer tem clientes na mesa.');
 // Só eu e os clientes: começa na hora (cliente não precisa aceitar).
 if (clientes.length && !pedido?.para) return desafiarClientes(sql, pessoa, pedido, clientes);
 const d = lerDesafio(pessoa, pedido), { para, camada, movel, chave, n, da, quer } = d;
 const mais = [...new Set((Array.isArray(pedido?.mais) ? pedido.mais : []).map(String))];
 if (clientes.length && 2 + mais.length + clientes.length > motor.grupo) throw erro(`${motor.nome} é de até ${motor.grupo} lugares na mesa.`);
 if (clientes.length && (da.length || quer.length)) throw erro('Com clientes na mesa, a aposta é só em VybeCoins.');
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
  const ids = await conferirClientes(tx, clientes);
  // Um convite aberto por vez de quem chama, por jogo: o novo substitui o antigo.
  await tx`UPDATE vybe_escritorio_partidas SET estado='cancelado',terminado_em=now() WHERE jogo=${jogo} AND estado='convite' AND desafiante=${pessoa.id}`;
  const [j] = ids.length ? await tx`INSERT INTO vybe_escritorio_partidas(jogo,chave,desafiante,desafiado,mais,clientes,camada,movel,moedas,itens_desafiante,itens_desafiado)
   VALUES(${jogo},${chave},${pessoa.id},${para},${mais}::bigint[],${ids}::bigint[],${camada},${movel},${n},'[]'::jsonb,'[]'::jsonb) RETURNING id`
   : await tx`INSERT INTO vybe_escritorio_partidas(jogo,chave,desafiante,desafiado,mais,camada,movel,moedas,itens_desafiante,itens_desafiado)
   VALUES(${jogo},${chave},${pessoa.id},${para},${mais}::bigint[],${camada},${movel},${n},${JSON.stringify(da)}::jsonb,${JSON.stringify(quer)}::jsonb) RETURNING id`;
  return { repetido: false, id: String(j.id) };
 });
 if (!r.repetido) {
  const texto = textoDoConvite((await nomes(sql, [pessoa.id]))[String(pessoa.id)], NOME_DO_JOGO[jogo], camada, n);
  for (const id of [para, ...mais]) await avisarConvite(sql, id, texto);
 }
 return r;
}

// Partida com clientes que acabou de começar: junta a foto das demandas de
// cada um (as piadas) à mesa. Fora da transação que começou a partida.
async function anotarDemandas(sql, id) {
 try {
  const [j] = await sql`SELECT * FROM vybe_escritorio_partidas WHERE id=${id}`;
  if (!j || j.estado !== 'jogando' || !clientesDe(j).length || !j.mesa?.clientesInfo) return;
  const demandas = await demandasDosClientes(sql, clientesDe(j));
  const info = Object.fromEntries(Object.entries(j.mesa.clientesInfo).map(([l, c]) => [l, { ...c, ...(demandas[clienteDoLado(j, l)] || {}) }]));
  await sql`UPDATE vybe_escritorio_partidas SET mesa=jsonb_set(mesa,'{clientesInfo}',${JSON.stringify(info)}::jsonb) WHERE id=${id} AND estado='jogando'`;
 } catch { /* sem a foto, as piadas ficam genéricas */ }
}

// Eu e os clientes no pôquer: sem convite, a partida começa na hora.
async function desafiarClientes(sql, pessoa, { camada, movel, moedas = 0, chave }, clientes) {
 if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(chave))) throw erro('Pedido inválido.');
 if (!CAMADA.test(String(camada)) || !MOVEL.test(String(movel))) throw erro('Mesa inválida.');
 const n = Number(moedas);
 if (!Number.isInteger(n) || n < 0 || n > MESA_MOEDAS_MAX) throw erro(`Aposte de 0 a ${MESA_MOEDAS_MAX.toLocaleString('pt-BR')} VybeCoins.`);
 if (1 + clientes.length > MOTORES.poker.grupo) throw erro(`O pôquer é de até ${MOTORES.poker.grupo} lugares na mesa.`);
 const r = await sql.comTransacao(async (tx) => {
  const [ja] = await tx`SELECT id,desafiante FROM vybe_escritorio_partidas WHERE chave=${chave}`;
  if (ja) { if (String(ja.desafiante) !== String(pessoa.id)) throw erro('Pedido inválido.'); return { id: String(ja.id) }; }
  const [jogando] = await tx`SELECT id FROM vybe_escritorio_partidas WHERE jogo='poker' AND estado='jogando' AND (desafiante=${pessoa.id} OR desafiado=${pessoa.id} OR ${pessoa.id} = ANY(mais))`;
  if (jogando) throw erro('Termine a sua partida antes de começar outra.', 409);
  const ids = await conferirClientes(tx, clientes);
  if (n) {
   const [c] = await tx`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoa.id}`;
   if (Number(c?.saldo || 0) < n) throw erro('Você não tem essas VybeCoins para apostar.', 409);
  }
  const [j] = await tx`INSERT INTO vybe_escritorio_partidas(jogo,chave,desafiante,desafiado,clientes,camada,movel,moedas,itens_desafiante,itens_desafiado)
   VALUES('poker',${chave},${pessoa.id},NULL,${ids}::bigint[],${String(camada)},${String(movel)},${n},'[]'::jsonb,'[]'::jsonb) RETURNING *`;
  await comecar(tx, j, null, String(pessoa.id));
  return { id: String(j.id) };
 });
 await anotarDemandas(sql, r.id);
 return { ...r, jogo: await verMesa(sql, pessoa, r.id) };
}

// Começa a partida: confere que ninguém está jogando outra nem a mesa está
// ocupada, tira a aposta de todos e dá as cartas/peças. Com clientes, eles
// pagam a aposta pela carteira e a mesa guarda a foto das demandas de cada um.
async function comecar(tx, j, salas, quemAceita) {
 const ids = pessoasDaMesa(j).filter((id) => id !== 'null');
 const [ocupado] = await tx`SELECT id FROM vybe_escritorio_partidas WHERE jogo=${j.jogo} AND estado='jogando' AND (desafiante = ANY(${ids}::bigint[]) OR desafiado = ANY(${ids}::bigint[]) OR mais && ${ids}::bigint[])`;
 if (ocupado) throw erro(ids.length > 2 ? 'Alguém da mesa já está numa partida. Terminem aquela primeiro.' : 'Um de vocês já está numa partida. Terminem aquela primeiro.', 409);
 const [mesa] = await tx`SELECT id FROM vybe_escritorio_partidas WHERE estado='jogando' AND camada=${j.camada} AND movel=${j.movel}`;
 if (mesa) throw erro('Essa mesa já está com uma partida. Esperem acabar.', 409);
 await cobrarAposta(tx, j, salas, `${j.jogo}:${j.id}`, quemAceita);
 const inicio = motorDe(j.jogo).iniciar(jogadores(j).map(([l]) => l));
 if (clientesDe(j).length) {
  const info = await sentarClientes(tx, clientesDe(j), j.moedas, `${j.jogo}:${j.id}`);
  inicio.clientesInfo = Object.fromEntries(jogadores(j).filter(([, id]) => ehCliente(id)).map(([l, id]) => [l, info[id.slice(1)]]));
 }
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
 await anotarDemandas(sql, id);
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
  const { mesa: jogada, fim } = motorDe(j.jogo).jogar(j.mesa, lado, pedido), mesa = comFora(j, jogada);
  comFalas(j, j.mesa, mesa);
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
 if (acao === 'pedir-fora' || acao === 'sair-fora') return foraMesa(sql, pessoa, { id, acao });
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
   const { mesa, fim: f } = MOTORES[j.jogo].sair(j.mesa, quem, motivo), fim = soClientes(j, mesa, f);
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

async function foraMesa(sql, pessoa, { id, acao }) {
 await sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${idValido(id)} FOR UPDATE`;
  if (!j) throw erro('Partida não encontrada.', 404);
  const eu = String(pessoa.id), fila = (j.mesa?.filaFora || []).map(String);
  if (acao === 'sair-fora') {
   if (fila.includes(eu)) await tx`UPDATE vybe_escritorio_partidas SET mesa=jsonb_set(mesa,'{filaFora}',${JSON.stringify(fila.filter((x) => x !== eu))}::jsonb) WHERE id=${j.id}`;
   return;
  }
  if (j.estado !== 'jogando') throw erro('A partida já acabou.', 409);
  if (j.bot || emGrupo(j)) throw erro('Esta mesa não tem fora.', 409);
  if (ladoDe(j, eu)) throw erro('Você está jogando esta partida.', 409);
  if (fila.includes(eu)) return;
  if (fila.length >= 8) throw erro('A fora já tem 8 pessoas.', 409);
  await tx`UPDATE vybe_escritorio_partidas SET mesa=jsonb_set(mesa,'{filaFora}',${JSON.stringify([...fila, eu])}::jsonb) WHERE id=${j.id}`;
 });
 return { jogo: await verMesa(sql, pessoa, id) };
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
  const rolando = await sql`SELECT * FROM vybe_escritorio_partidas WHERE estado='jogando' AND camada=${cena}`;
  const nome = await nomesDaMesa(sql, rolando);
  for (const l of rolando) ativas.push({ jogo: l.jogo, movel: l.movel, nomes: jogadores(l).map(([, id]) => (id === 'null' ? botInfo(l.bot)?.nome || 'Bot' : nome[id] || '')) });
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
 return { bots: listaDeBots(jogo).map((b) => ({ ...b, vitorias: venceu[b.bot] || 0 })), resta_hoje: Math.max(0, TETO_DIA - Number(hoje)), teto_dia: TETO_DIA,
  ...(jogo === 'poker' ? { clientes: await clientesDaMesa(sql) } : {}) };
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
  if (j && clientesDe(j).length && ladoDe(j, pessoa.id)) {
   if (Number(n) === (Number(j.mesa?.n) || 0)) await jogarCliente(tx, j);
   return;
  }
  if (!j?.bot || String(j.desafiante) !== String(pessoa.id)) throw erro('Partida não encontrada.', 404);
  if (Number(n) !== (Number(j.mesa?.n) || 0)) return;
  await jogarBot(tx, j);
 });
 return { jogo: await verMesa(sql, pessoa, id) };
}
