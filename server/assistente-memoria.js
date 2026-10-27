// Memória do cliente para a Vybe AI (Paulo, 27/10/2026: "o que a Gonzalez pediu de alteração da última vez?").
// Lê o que já existe no Vybe OS: comentários das peças do cliente e as voltas para "Alteração", com busca por
// assunto (texto em português, sem acento). Somente leitura; os textos são dados, não instruções.
import { textoDoHistorico } from './texto-historico.js';
import { BOARD_DEMANDAS, BOARD_PRODUCAO } from './grupos.js';
import { linkDaAtividade } from './assistente-rotinas.js';
import { regrasDoCliente } from './assistente-regras.js';

const curto = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');
const normal = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// "alteração", "ajuste", "mudar"... viram um mesmo assunto: o que o cliente pediu para mudar.
const PEDIDOS = /alter|ajust|mud|troc|corrig|refaz|refaze|tirar|coloc|pediu|cliente (?:quer|pede|prefere)/;

export function mensagemMemoria({ cliente, dias, busca, comentarios, alteracoes, regras = [] }) {
  const partes = [`🧠 *Memória · ${cliente}* (últimos ${dias} dias${busca ? ` · “${busca}”` : ''})`];
  // Regras decididas pela equipe valem sempre (não dependem do período nem do assunto).
  if (regras.length) partes.push(`📌 *Regras do cliente*\n` + regras.slice(0, 10).map((r) => `- ${r}`).join('\n'));
  if (alteracoes.length) {
    partes.push(`🔁 *Voltaram para alteração: ${alteracoes.length} vez(es)*\n` + alteracoes.slice(0, 6)
      .map((a) => `- ${curto(a.em)} · ${a.titulo || 'Sem título'}\n  🔗 ${linkDaAtividade(a.ref)}`).join('\n'));
  }
  if (comentarios.length) {
    partes.push(`💬 *O que foi dito nas peças*\n` + comentarios.slice(0, 10)
      .map((c) => `- ${curto(c.criado_em)} · ${c.titulo || 'Sem título'}${c.autor ? ` (${c.autor})` : ''}: “${c.corpo.replace(/\s+/g, ' ').slice(0, 220)}${c.corpo.length > 220 ? '…' : ''}”\n  🔗 ${linkDaAtividade(c.ref)}`).join('\n'));
  }
  if (!alteracoes.length && !comentarios.length && !regras.length) partes.push(busca ? `Nada sobre “${busca}” nas peças desse período.` : 'Nenhum comentário ou alteração nas peças desse período.');
  return partes.join('\n\n');
}

export async function memoriaDoCliente(sql, { cliente_id: clienteId, busca = '', dias = 120 }) {
  if (!Number.isSafeInteger(clienteId) || clienteId <= 0) throw new TypeError('Cliente inválido.');
  const [cliente] = await sql`SELECT nome FROM vybe_clientes WHERE id = ${clienteId} AND COALESCE(ativo, true)`;
  if (!cliente) throw new TypeError('Cliente inválido.');
  const desde = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
  const linhas = await sql`SELECT u.corpo, u.autor, u.criado_em::text, c.titulo, c.id::text, c.monday_item_id
    FROM vybe_conteudo_updates u JOIN vybe_conteudos c ON c.id = u.conteudo_id
    WHERE c.removido_em IS NULL AND c.board_id IN (${BOARD_PRODUCAO}, ${BOARD_DEMANDAS}) AND u.criado_em >= ${desde}::date
      AND EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id = c.id AND cc.cliente_id = ${clienteId})
    ORDER BY u.criado_em DESC NULLS LAST LIMIT 300`;
  const voltas = await sql`SELECT e.em::text, c.titulo, c.id::text, c.monday_item_id
    FROM vybe_conteudo_eventos e JOIN vybe_conteudos c ON c.id = e.conteudo_id
    WHERE c.removido_em IS NULL AND c.board_id IN (${BOARD_PRODUCAO}, ${BOARD_DEMANDAS}) AND e.tipo = 'status'
      AND EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id = c.id AND cc.cliente_id = ${clienteId}) AND e.para ILIKE '%altera%' AND e.em >= ${desde}::date
    ORDER BY e.em DESC LIMIT 50`;
  const ref = (l) => (l.monday_item_id ? String(l.monday_item_id) : 'vybe:' + l.id);
  const termos = normal(busca).split(/\s+/).filter((t) => t.length >= 3 && !['que', 'para', 'pra', 'com', 'sobre', 'das', 'dos', 'pediu', 'falou'].includes(t));
  // Sem assunto: os pedidos de mudança primeiro, depois o restante, sempre do mais recente.
  let comentarios = linhas.map((l) => ({ ...l, ref: ref(l), corpo: textoDoHistorico(l.corpo || '').trim() })).filter((c) => c.corpo);
  if (termos.length) comentarios = comentarios.filter((c) => termos.some((t) => normal(c.corpo + ' ' + c.titulo).includes(t.slice(0, Math.max(4, t.length - 2)))));
  else comentarios = [...comentarios.filter((c) => PEDIDOS.test(normal(c.corpo))), ...comentarios.filter((c) => !PEDIDOS.test(normal(c.corpo)))];
  const alteracoes = voltas.map((v) => ({ ...v, ref: ref(v) }));
  const regras = await regrasDoCliente(sql, clienteId);
  return { texto: mensagemMemoria({ cliente: cliente.nome, dias, busca: busca.trim(), comentarios, alteracoes, regras }), fontes: [{ modulo: 'memoria_cliente', id: String(clienteId) }] };
}

// Legendas que o cliente já aprovou (planejamentos aprovados ou já cadastrados no quadro), as mais recentes primeiro.
// Servem de exemplo de tom para a Vybe AI escrever legendas novas do mesmo cliente.
export async function legendasAprovadas(sql, { cliente_id: clienteId, formato = '', limite = 8 }, { normalizar } = {}) {
  if (!Number.isSafeInteger(clienteId) || clienteId <= 0) throw new TypeError('Cliente inválido.');
  const [cliente] = await sql`SELECT nome FROM vybe_clientes WHERE id = ${clienteId} AND COALESCE(ativo, true)`;
  if (!cliente) throw new TypeError('Cliente inválido.');
  const ler = normalizar || (await import('./planejamentos.js')).normalizarConteudo;
  const planos = await sql`SELECT mes::text, conteudo FROM vybe_planejamentos
    WHERE cliente_id = ${clienteId} AND estado IN ('aprovado', 'cadastrado') ORDER BY mes DESC, id DESC LIMIT 6`;
  const f = normal(formato).trim();
  const itens = [];
  for (const p of planos) {
    for (const peca of ler(p.conteudo || {}).pecas || []) {
      if (!peca?.legenda || peca.legenda.length < 40) continue;
      if (f && !normal(peca.formato).startsWith(f.slice(0, 4))) continue;
      itens.push({ mes: p.mes.slice(0, 7), formato: peca.formato, tema: peca.tema || '', legenda: peca.legenda.slice(0, 1200) });
    }
  }
  return { cliente: cliente.nome, itens: itens.slice(0, Math.min(Math.max(1, limite), 12)), regras: await regrasDoCliente(sql, clienteId) };
}
