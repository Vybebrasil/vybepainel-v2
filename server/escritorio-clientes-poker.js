// Os clientes da Vybe como bots na mesa de pôquer (pedido do Paulo,
// 28/10/2026: "podia ser os clientes, cada um com sua carteira, ficaria
// legal; e no meio da partida eles soltam piadas sobre as demandas").
// migrations/2026-10-28-escritorio-poker-clientes.sql.
//
// Cada cliente ativo pode sentar na mesa (lugares depois das pessoas). Tem a
// carteira de VybeCoins dele: paga a aposta da mesa como qualquer um e recebe
// o pote quando ganha a partida. Toda segunda, quem tem menos de 500 volta a
// 500 ("pingou a mensalidade"). O jeito de jogar (fácil, médio ou lendário)
// é fixo por cliente, e ele joga pelo bot do pôquer (escritorio-bots.js).
// As piadas usam os alertas do cliente quando a partida começa
// (alertas-clientes.js: peças atrasadas, esperando a aprovação dele, sem
// briefing): é uma foto do começo da partida, guardada na mesa.
import { alertasDosClientes } from './alertas-clientes.js';
import { diaBahia, somarDias } from './escritorio-pontos.js';
import { erro } from './escritorio-apostas.js';

export const SALDO_INICIAL = 500;
const NIVEIS = ['facil', 'medio', 'lendario'];
const CORES = ['#e2462e', '#1f7ae0', '#22a35a', '#a24bd6', '#f08a1a', '#139c9c', '#d6336c', '#7a5c2e'];

let pronto = null;
// A migração foi aplicada? (Sem ela, a mesa de pôquer é só de pessoas, como antes.)
export async function clientesProntos(sql) {
 if (pronto === true) return true;
 const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_clientes_carteira') IS NOT NULL AS existe`;
 if (r?.existe) pronto = true;
 return Boolean(r?.existe);
}
export const nivelDoCliente = (id) => NIVEIS[Number(id) % 3];
// Iniciais e cor do cliente (o avatar dele na mesa).
export function marcaDoCliente(id, nome) {
 const palavras = String(nome || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
 const iniciais = (palavras.length > 1 ? palavras[0][0] + palavras[1][0] : (palavras[0] || '?').slice(0, 2)).toUpperCase();
 return { iniciais, cor: CORES[Number(id) % CORES.length] };
}
// Segunda-feira da semana de `dia` (AAAA-MM-DD).
function segunda(dia) {
 const d = new Date(dia + 'T12:00:00Z').getUTCDay();
 return somarDias(dia, -((d + 6) % 7));
}

// Carteiras dos clientes (cria e recarrega na segunda), já trancadas quando `tx` trava.
async function carteiras(tx, ids, trancar = false) {
 if (!ids.length) return new Map();
 const semana = segunda(diaBahia(new Date()));
 for (const id of ids) await tx`INSERT INTO vybe_escritorio_clientes_carteira(cliente_id,saldo,recarga) VALUES(${id},${SALDO_INICIAL},${semana}) ON CONFLICT DO NOTHING`;
 const linhas = trancar ? await tx`SELECT cliente_id,saldo,recarga FROM vybe_escritorio_clientes_carteira WHERE cliente_id = ANY(${ids}::bigint[]) ORDER BY cliente_id FOR UPDATE`
  : await tx`SELECT cliente_id,saldo,recarga FROM vybe_escritorio_clientes_carteira WHERE cliente_id = ANY(${ids}::bigint[])`;
 const mapa = new Map();
 for (const l of linhas) {
  let saldo = Number(l.saldo);
  const recarga = l.recarga ? String(l.recarga instanceof Date ? l.recarga.toISOString().slice(0, 10) : l.recarga).slice(0, 10) : null;
  if (!recarga || recarga < semana) {
   const falta = Math.max(0, SALDO_INICIAL - saldo);
   if (falta) await tx`INSERT INTO vybe_escritorio_clientes_moedas(cliente_id,origem,quantidade) VALUES(${l.cliente_id},${'mensalidade:' + semana},${falta}) ON CONFLICT DO NOTHING`;
   await tx`UPDATE vybe_escritorio_clientes_carteira SET saldo=GREATEST(saldo,${SALDO_INICIAL}),recarga=${semana} WHERE cliente_id=${l.cliente_id}`;
   saldo = Math.max(saldo, SALDO_INICIAL);
  }
  mapa.set(String(l.cliente_id), saldo);
 }
 return mapa;
}

// Os clientes que podem sentar na mesa: ativos, com o saldo e o jeito de jogar.
export async function clientesDaMesa(sql) {
 if (!await clientesProntos(sql)) return [];
 const lista = await sql`SELECT id,nome FROM vybe_clientes WHERE COALESCE(ativo,true) ORDER BY nome`;
 const saldo = await carteiras(sql, lista.map((c) => String(c.id)));
 return lista.map((c) => ({ id: String(c.id), nome: c.nome, saldo: saldo.get(String(c.id)) ?? SALDO_INICIAL, nivel: nivelDoCliente(c.id), ...marcaDoCliente(c.id, c.nome) }));
}

// Confere os clientes escolhidos (ativos, sem repetir) e devolve os ids.
export async function conferirClientes(tx, lista) {
 const ids = [...new Set((Array.isArray(lista) ? lista : []).map(String))];
 if (!ids.length) return [];
 if (ids.some((id) => !/^\d{1,18}$/.test(id))) throw erro('Escolha clientes da lista.');
 if (!await clientesProntos(tx)) throw erro('Os clientes na mesa aguardam a migração do banco.', 503);
 const achados = await tx`SELECT id FROM vybe_clientes WHERE id = ANY(${ids}::bigint[]) AND COALESCE(ativo,true)`;
 if (achados.length !== ids.length) throw erro('Algum cliente escolhido não está ativo.', 404);
 return ids;
}

// Começo da partida: cada cliente paga a aposta (sem saldo, não senta), e a
// mesa guarda quem é cada um e a foto das demandas dele (para as piadas).
export async function sentarClientes(tx, ids, moedas, razao) {
 const n = Number(moedas) || 0, saldo = await carteiras(tx, ids, true);
 const nomes = Object.fromEntries((await tx`SELECT id,nome FROM vybe_clientes WHERE id = ANY(${ids}::bigint[])`).map((c) => [String(c.id), c.nome]));
 if (n) for (const id of ids) {
  if ((saldo.get(id) ?? 0) < n) throw erro(`${nomes[id] || 'Um cliente'} está sem VybeCoins para essa aposta (tem ${saldo.get(id) ?? 0}).`, 409);
 }
 if (n) for (const id of ids) {
  await tx`UPDATE vybe_escritorio_clientes_carteira SET saldo=saldo-${n} WHERE cliente_id=${id}`;
  await tx`INSERT INTO vybe_escritorio_clientes_moedas(cliente_id,origem,quantidade) VALUES(${id},${razao + ':aposta'},${-n})`;
 }
 return Object.fromEntries(ids.map((id) => [id, { nome: nomes[id] || 'Cliente', nivel: nivelDoCliente(id), ...marcaDoCliente(id, nomes[id]), atrasadas: 0, aprovar: 0, sem_info: 0 }]));
}

// A foto das demandas de cada cliente (para as piadas): peças atrasadas,
// esperando a aprovação dele e sem briefing, com o título da primeira de cada.
// Lida depois que a partida começa, fora da transação dela: se a consulta
// falhar, a partida segue com as piadas genéricas.
export async function demandasDosClientes(sql, ids) {
 let alertas = new Map();
 try { alertas = await alertasDosClientes(sql, { clienteIds: ids }); } catch { return {}; }
 const titulo = (l) => (l?.[0]?.titulo ? String(l[0].titulo).slice(0, 48) : null);
 return Object.fromEntries(ids.map((id) => {
  const a = alertas.get(String(id)) || {};
  return [String(id), { atrasadas: a.atrasadas_total || 0, aprovar: a.aprovar_cliente_total || 0, sem_info: a.sem_info_total || 0,
   t_atrasada: titulo(a.atrasadas), t_aprovar: titulo((a.aprovar || []).filter((x) => /cliente/i.test(x.status))) || titulo(a.aprovar), t_sem_info: titulo(a.sem_info) }];
 }));
}

// Fim da partida: o cliente que ganhou leva o pote para a carteira dele.
export async function pagarCliente(tx, clienteId, valor, razao) {
 if (!valor) return;
 const [r] = await tx`INSERT INTO vybe_escritorio_clientes_moedas(cliente_id,origem,quantidade) VALUES(${clienteId},${razao + ':premio'},${valor}) ON CONFLICT DO NOTHING RETURNING id`;
 if (r) await tx`UPDATE vybe_escritorio_clientes_carteira SET saldo=saldo+${valor} WHERE cliente_id=${clienteId}`;
}
// Partida desfeita antes do fim (não acontece hoje; fica para devolver a aposta).
export async function devolverClientes(tx, ids, valor, razao) {
 for (const id of ids) await pagarCliente(tx, id, valor, razao + ':devolucao');
}

// --- As piadas ---------------------------------------------------------------
// Uma fala do cliente para o que ele acabou de fazer na mesa (ou null: ele
// nem sempre fala). `info` é a foto das demandas dele; `acaso` (0 a 1) decide.
const sorteio = (l, acaso) => l[Math.floor(acaso * l.length) % l.length];
export function falaDoCliente(info, evento, acaso = Math.random(), valor = 0) {
 if (!info) return null;
 const at = info.atrasadas, ap = info.aprovar, si = info.sem_info;
 const ta = info.t_atrasada ? `"${info.t_atrasada}"` : 'aquele post', tp = info.t_aprovar ? `"${info.t_aprovar}"` : 'aquela arte', ts = info.t_sem_info ? `"${info.t_sem_info}"` : 'aquela peça';
 const falas = {
  aumentou: [
   at ? `Aumento igual vocês aumentam o prazo de ${ta}.` : 'Aumento! Igual o meu escopo no meio do mês.',
   'Subo a aposta. E já aviso: vou querer mais uma alteração na arte.',
   ap ? `Aumento. E não, ainda não aprovei ${tp}.` : 'Aumento. Coloca na conta da próxima campanha.',
   'Dobra aí, que nem eu dobro o briefing num áudio de 8 minutos.',
  ],
  'all-in': [
   si ? `All-in! O briefing de ${ts}? Tá tudo na minha cabeça, confia.` : 'All-in! Mandei tudo de uma vez, igual meus pedidos na sexta às 18h.',
   at ? `All-in. Se eu perder, vocês me entregam as ${at} peças atrasadas de brinde.` : 'All-in! É tudo ou nada, igual o meu cronograma.',
   'Vou com tudo. Pode postar hoje ainda?',
  ],
  largou: [
   ap ? `Larguei. Igual largo as ${ap} peças esperando minha aprovação.` : 'Corro. Mas meu post de sexta não pode correr, hein.',
   'Fold. Vou pensar e respondo semana que vem, igual a aprovação.',
   'Largo. Essa mão tá mais fraca que a minha legenda.',
  ],
  pagou: [
   at ? `Pago pra ver. E aproveito: cadê minhas ${at} peças atrasadas?` : 'Pago pra ver. Igual pago a mensalidade: sem ver a pauta.',
   'Pago. Mas quero o relatório disso depois.',
   'Pago. Coloca em reels também?',
  ],
  mesa: [
   at ? `Passo. Que nem vocês passaram do prazo de ${ta}.` : 'Passo. Fico só olhando, igual eu faço no grupo do WhatsApp.',
   'Mesa. Tô esperando a referência que eu mandei no Pinterest.',
   si ? `Passo. Ainda tô devendo as informações de ${ts}.` : 'Passo. Deixa eu ver com o meu sócio.',
  ],
  ganhou: [
   'Esse pote vai direto pro tráfego pago!',
   ap ? `Ganhei! Agora quem sabe eu aprovo ${tp}.` : 'Ganhei! Agora quero aquela campanha de graça.',
   at ? `Levei! Com esse dinheiro dá pra pagar as ${at} peças que tão atrasadas.` : 'Levei! Pode mandar a nota fiscal.',
   'Ganhei. Pode colocar no stories que eu tô on fire.',
  ],
  perdeu: [
   'Perdi esse, mas a culpa é do algoritmo.',
   'Vou pedir alteração nessa mão.',
   'Isso aí foi o engajamento caindo.',
  ],
 };
 const lista = falas[evento];
 if (!lista) return null;
 // Ganhar e o all-in sempre rendem fala; o resto, de vez em quando.
 const chance = { ganhou: 1, 'all-in': 1, perdeu: valor >= 200 ? 0.8 : 0.3, aumentou: 0.55, largou: 0.3, pagou: 0.3, mesa: 0.22 }[evento] ?? 0.3;
 if (acaso > chance) return null;
 return sorteio(lista, acaso / chance);
}
