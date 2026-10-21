// Captações da Produção (decisão do Paulo, 21/10/2026; docs/captacao-plano.md).
// Uma captação junta peças de um cliente que estão em "Agendar Captação" num dia
// e horário. Montar marca cada peça "Captação Agendada" pelo mesmo caminho do
// painel (trocarEscolha, que dispara as automações) e cria o evento no Google
// Agenda da Vybe; na gravação cada peça vira "Captação Feita". Falha do Google
// aparece como aviso e não desfaz a captação (dá para tentar de novo).
import { tokenGoogle } from '../vybe_drive.js';
import { listarAgendaProducao } from './agenda-producao.js';
import { BOARD_PRODUCAO } from './grupos.js';

export const CAPTACAO = { pronta: 'agendar_captacao', agendada: 'captacao_agendada', feita: 'captacao_feita' };
const FUSO = 'America/Bahia';
const ESCOPO_AGENDA = 'https://www.googleapis.com/auth/calendar.events';
const LIMITE_PECAS = 40;

const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });
const diaValido = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d;
const horaValida = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(h));

export async function captacoesProntas(sql) {
  const [r] = await sql`SELECT to_regclass('public.vybe_captacoes') IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}
async function exigirTabelas(sql) {
  if (!(await captacoesProntas(sql))) throw erro('As captações aguardam a migração do banco.', 503);
}

// Peças prontas para captar: na Produção, em "Agendar Captação" e fora de uma
// captação marcada. O roteiro é o briefing da peça.
export async function pecasParaCaptar(sql) {
  await exigirTabelas(sql);
  return (await sql`SELECT c.id, c.titulo, c.formato, c.prazo::text AS prazo, c.veiculacao::text AS veiculacao, c.briefing,
      c.status_chave, s.rotulo AS status, s.cor AS status_cor,
      COALESCE(json_agg(json_build_object('id', cl.id::text, 'nome', cl.nome) ORDER BY cl.nome) FILTER (WHERE cl.id IS NOT NULL), '[]') AS clientes
    FROM vybe_conteudos c
    LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    LEFT JOIN vybe_conteudo_clientes cc ON cc.conteudo_id = c.id
    LEFT JOIN vybe_clientes cl ON cl.id = cc.cliente_id
    WHERE c.removido_em IS NULL AND c.board_id = ${BOARD_PRODUCAO} AND c.captacao_chave = ${CAPTACAO.pronta}
      AND NOT EXISTS (SELECT 1 FROM vybe_captacao_pecas p JOIN vybe_captacoes k ON k.id = p.captacao_id
        WHERE p.conteudo_id = c.id AND k.estado = 'agendada')
    GROUP BY c.id, s.rotulo, s.cor
    ORDER BY COALESCE(c.prazo, c.veiculacao) NULLS LAST, c.id`).map((l) => ({ ...l, id: String(l.id) }));
}

// Captações de um período (padrão: de hoje a 30 dias), com as peças e o roteiro.
export async function listarCaptacoes(sql, { de = '', ate = '' } = {}) {
  await exigirTabelas(sql);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
  const inicio = diaValido(de) ? de : hoje;
  const fimPadrao = new Date(`${inicio}T12:00:00Z`); fimPadrao.setUTCDate(fimPadrao.getUTCDate() + 30);
  const fim = diaValido(ate) ? ate : fimPadrao.toISOString().slice(0, 10);
  const linhas = await sql`SELECT k.id, k.cliente_id::text AS cliente_id, cl.nome AS cliente, k.dia::text AS dia,
      to_char(k.inicio, 'HH24:MI') AS inicio, to_char(k.fim, 'HH24:MI') AS fim, k.local, k.observacao, k.estado,
      k.evento_google IS NOT NULL AS na_agenda, k.evento_google, k.evento_do_painel, k.aviso, p.nome AS criado_por,
      COALESCE(json_agg(json_build_object('id', c.id::text, 'titulo', c.titulo, 'formato', c.formato, 'briefing', c.briefing, 'prazo', c.prazo::text, 'veiculacao', c.veiculacao::text,
        'captacao', c.captacao_chave, 'gravado', kp.gravado_em IS NOT NULL) ORDER BY kp.ordem, c.id) FILTER (WHERE c.id IS NOT NULL), '[]') AS pecas
    FROM vybe_captacoes k
    LEFT JOIN vybe_clientes cl ON cl.id = k.cliente_id
    LEFT JOIN vybe_pessoas p ON p.id = k.criado_por
    LEFT JOIN vybe_captacao_pecas kp ON kp.captacao_id = k.id
    LEFT JOIN vybe_conteudos c ON c.id = kp.conteudo_id
    WHERE k.estado <> 'cancelada' AND k.dia BETWEEN ${inicio}::date AND ${fim}::date
    GROUP BY k.id, cl.nome, p.nome
    ORDER BY k.dia, k.inicio NULLS LAST, k.id`;
  return { de: inicio, ate: fim, captacoes: linhas.map((l) => ({ ...l, id: String(l.id) })) };
}

function validarMontagem(d = {}) {
  const pecas = [...new Set((Array.isArray(d.pecas) ? d.pecas : []).map(String))];
  if (!/^\d{1,18}$/.test(String(d.cliente_id || ''))) throw erro('Escolha o cliente da captação.');
  if (!diaValido(d.dia)) throw erro('Escolha o dia da captação.');
  if (d.inicio && !horaValida(d.inicio)) throw erro('Horário de início inválido.');
  if (d.fim && !horaValida(d.fim)) throw erro('Horário de fim inválido.');
  if (d.inicio && d.fim && d.fim <= d.inicio) throw erro('O fim precisa ser depois do início.');
  if (!pecas.length) throw erro('Escolha ao menos uma peça para captar.');
  if (pecas.length > LIMITE_PECAS) throw erro(`No máximo ${LIMITE_PECAS} peças por captação.`);
  if (pecas.some((p) => !/^\d{1,18}$/.test(p))) throw erro('Peça inválida.');
  const local = String(d.local || '').trim(), observacao = String(d.observacao || '').trim();
  if (local.length > 300) throw erro('O local passou de 300 caracteres.');
  if (observacao.length > 2000) throw erro('A observação passou de 2.000 caracteres.');
  const evento = d.evento_google ? String(d.evento_google) : null;
  if (evento && !/^[A-Za-z0-9_-]{5,1024}$/.test(evento)) throw erro('Evento da agenda inválido.');
  return { cliente_id: String(d.cliente_id), dia: d.dia, inicio: d.inicio || null, fim: d.fim || null, local, observacao, pecas, evento };
}

// Monta a captação numa transação (a peça só entra se ainda está pronta para
// captar e é do cliente) e depois marca cada peça e cria o evento na agenda.
// `trocar` é o trocarEscolha do painel; `agenda` cria/apaga o evento. Com
// `evento_google`, as peças entram numa captação que alguém já marcou no
// Google Agenda: o evento é dessa pessoa e o painel não o reescreve nem apaga.
export async function montarCaptacao(sql, quem, dados, { trocar, agenda = eventoNaAgenda } = {}) {
  await exigirTabelas(sql);
  const d = validarMontagem(dados);
  const pessoaId = quem?.pessoa?.id ? String(quem.pessoa.id) : null;
  const criada = await sql.comTransacao(async (tx) => {
    const [cliente] = await tx`SELECT id, nome FROM vybe_clientes WHERE id = ${d.cliente_id}`;
    if (!cliente) throw erro('Cliente não encontrado.', 404);
    const linhas = await tx`SELECT c.id, c.titulo, c.captacao_chave, c.removido_em, c.board_id,
        EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id = c.id AND cc.cliente_id = ${d.cliente_id}) AS do_cliente,
        EXISTS (SELECT 1 FROM vybe_captacao_pecas p JOIN vybe_captacoes k ON k.id = p.captacao_id
          WHERE p.conteudo_id = c.id AND k.estado = 'agendada') AS ja_marcada
      FROM vybe_conteudos c WHERE c.id = ANY(${d.pecas}::bigint[]) ORDER BY c.id FOR UPDATE OF c`;
    if (linhas.length !== d.pecas.length) throw erro('Alguma peça não existe mais.', 409);
    const fora = linhas.filter((l) => l.removido_em || String(l.board_id) !== String(BOARD_PRODUCAO) || l.captacao_chave !== CAPTACAO.pronta || l.ja_marcada || !l.do_cliente);
    if (fora.length) throw erro(`Já não estão prontas para esta captação: ${fora.map((l) => l.titulo).join('; ')}. Atualize a lista.`, 409);
    if (d.evento) {
      const [ja] = await tx`SELECT id FROM vybe_captacoes WHERE evento_google = ${d.evento} AND estado <> 'cancelada' FOR UPDATE`;
      if (ja) throw erro('Essa captação da agenda já tem peças ligadas. Atualize a tela.', 409);
    }
    const [k] = await tx`INSERT INTO vybe_captacoes (cliente_id, dia, inicio, fim, local, observacao, criado_por, evento_google, evento_do_painel)
      VALUES (${d.cliente_id}, ${d.dia}::date, ${d.inicio}::time, ${d.fim}::time, ${d.local}, ${d.observacao}, ${pessoaId}, ${d.evento}, ${!d.evento})
      RETURNING id`;
    for (const [ordem, id] of d.pecas.entries())
      await tx`INSERT INTO vybe_captacao_pecas (captacao_id, conteudo_id, ordem) VALUES (${k.id}, ${id}, ${ordem})`;
    return { id: String(k.id), cliente: cliente.nome, titulos: d.pecas.map((id) => linhas.find((l) => String(l.id) === id).titulo) };
  });
  const avisos = [];
  for (const id of d.pecas) {
    try { await trocar(sql, quem, { item: id, campo: 'captacao', para: CAPTACAO.agendada }); }
    catch (e) { avisos.push(`Não deu para marcar uma peça como "Captação Agendada": ${e.message}`); }
  }
  if (!d.evento) await sincronizarAgenda(sql, criada.id, { agenda, avisos });
  return { id: criada.id, avisos };
}

// Cria (ou recria) o evento da captação; falha vira aviso guardado na captação.
export async function sincronizarAgenda(sql, id, { agenda = eventoNaAgenda, avisos = [] } = {}) {
  if (!/^\d{1,18}$/.test(String(id || ''))) throw erro('Captação inválida.');
  const [k] = (await listarCaptacoesPorId(sql, id));
  if (!k) throw erro('Captação não encontrada.', 404);
  if (!k.evento_do_painel) return avisos;
  try {
    const evento = await agenda('criar', k);
    await sql`UPDATE vybe_captacoes SET evento_google = ${evento}, aviso = NULL, atualizado_em = now() WHERE id = ${id}`;
  } catch (e) {
    const aviso = `Não entrou no Google Agenda: ${e.message}`;
    avisos.push(aviso);
    await sql`UPDATE vybe_captacoes SET aviso = ${aviso}, atualizado_em = now() WHERE id = ${id}`;
  }
  return avisos;
}
async function listarCaptacoesPorId(sql, id) {
  return sql`SELECT k.id::text AS id, k.dia::text AS dia, to_char(k.inicio, 'HH24:MI') AS inicio, to_char(k.fim, 'HH24:MI') AS fim,
      k.local, k.observacao, k.estado, k.evento_google, k.evento_do_painel, cl.nome AS cliente,
      COALESCE(json_agg(json_build_object('titulo', c.titulo, 'formato', c.formato) ORDER BY kp.ordem) FILTER (WHERE c.id IS NOT NULL), '[]') AS pecas
    FROM vybe_captacoes k LEFT JOIN vybe_clientes cl ON cl.id = k.cliente_id
    LEFT JOIN vybe_captacao_pecas kp ON kp.captacao_id = k.id LEFT JOIN vybe_conteudos c ON c.id = kp.conteudo_id
    WHERE k.id = ${id} GROUP BY k.id, cl.nome`;
}

// "Gravado" de uma peça (ou desfazer). Tudo gravado: a captação fica gravada.
export async function marcarGravado(sql, quem, { captacao_id, conteudo_id, desfazer = false } = {}, { trocar } = {}) {
  await exigirTabelas(sql);
  if (!/^\d{1,18}$/.test(String(captacao_id || '')) || !/^\d{1,18}$/.test(String(conteudo_id || ''))) throw erro('Peça inválida.');
  const pessoaId = quem?.pessoa?.id ? String(quem.pessoa.id) : null;
  const r = await sql.comTransacao(async (tx) => {
    const [k] = await tx`SELECT id, estado FROM vybe_captacoes WHERE id = ${captacao_id} FOR UPDATE`;
    if (!k || k.estado === 'cancelada') throw erro('Captação não encontrada.', 404);
    const [p] = await tx`UPDATE vybe_captacao_pecas SET gravado_em = ${desfazer ? null : new Date()}, gravado_por = ${desfazer ? null : pessoaId}
      WHERE captacao_id = ${captacao_id} AND conteudo_id = ${conteudo_id} RETURNING conteudo_id`;
    if (!p) throw erro('Esta peça não é desta captação.', 404);
    const [{ faltam }] = await tx`SELECT count(*) FILTER (WHERE gravado_em IS NULL)::int AS faltam FROM vybe_captacao_pecas WHERE captacao_id = ${captacao_id}`;
    const estado = faltam === 0 ? 'gravada' : 'agendada';
    await tx`UPDATE vybe_captacoes SET estado = ${estado}, atualizado_em = now() WHERE id = ${captacao_id}`;
    return { estado, faltam };
  });
  await trocar(sql, quem, { item: String(conteudo_id), campo: 'captacao', para: desfazer ? CAPTACAO.agendada : CAPTACAO.feita });
  return r;
}

// Cancelar: a captação sai da agenda e as peças não gravadas voltam a "Agendar Captação".
export async function cancelarCaptacao(sql, quem, { id } = {}, { trocar, agenda = eventoNaAgenda } = {}) {
  await exigirTabelas(sql);
  if (!/^\d{1,18}$/.test(String(id || ''))) throw erro('Captação inválida.');
  const { pendentes, evento } = await sql.comTransacao(async (tx) => {
    const [k] = await tx`SELECT id, estado, evento_google, evento_do_painel FROM vybe_captacoes WHERE id = ${id} FOR UPDATE`;
    if (!k || k.estado === 'cancelada') throw erro('Captação não encontrada.', 404);
    await tx`UPDATE vybe_captacoes SET estado = 'cancelada', atualizado_em = now() WHERE id = ${id}`;
    const l = await tx`SELECT conteudo_id::text AS id FROM vybe_captacao_pecas WHERE captacao_id = ${id} AND gravado_em IS NULL`;
    // Evento marcado por alguém no Google fica lá; só as peças se soltam.
    return { pendentes: l.map((x) => x.id), evento: k.evento_do_painel ? k.evento_google : null };
  });
  const avisos = [];
  for (const item of pendentes) {
    try { await trocar(sql, quem, { item, campo: 'captacao', para: CAPTACAO.pronta }); }
    catch (e) { avisos.push(`Uma peça não voltou para "Agendar Captação": ${e.message}`); }
  }
  if (evento) {
    try { await agenda('apagar', { evento_google: evento }); }
    catch (e) { avisos.push(`O evento continua no Google Agenda: ${e.message}`); }
  }
  return { avisos };
}

// Evento da captação no Google Agenda da Vybe (conta de serviço com permissão
// de "Fazer alterações", liberada pelo Paulo em 21/10/2026).
export function eventoDaCaptacao(k, painel = process.env.PAINEL_URL || 'https://vybepainel-v2.vercel.app') {
  const n = k.pecas.length;
  const fimDia = new Date(`${k.dia}T12:00:00Z`); fimDia.setUTCDate(fimDia.getUTCDate() + 1);
  const quando = k.inicio
    ? { start: { dateTime: `${k.dia}T${k.inicio}:00-03:00`, timeZone: FUSO }, end: { dateTime: `${k.dia}T${k.fim || k.inicio}:00-03:00`, timeZone: FUSO } }
    : { start: { date: k.dia }, end: { date: fimDia.toISOString().slice(0, 10) } };
  // Sem horário de fim: duas horas de gravação.
  if (k.inicio && !k.fim) { const t = new Date(`${k.dia}T${k.inicio}:00-03:00`); quando.end.dateTime = new Date(t.getTime() + 2 * 3600e3).toISOString(); }
  return {
    summary: `Captação · ${k.cliente} · ${n} ${n === 1 ? 'peça' : 'peças'}`,
    location: k.local || undefined,
    description: [...k.pecas.map((p, i) => `${i + 1}. ${p.titulo}${p.formato ? ` (${p.formato})` : ''}`), '', k.observacao || '', `Roteiros no painel: ${painel}`].filter((x, i, a) => x || a[i - 1]).join('\n').trim(),
    ...quando,
  };
}
export async function eventoNaAgenda(acao, k, { buscar = fetch, obterToken = tokenGoogle } = {}) {
  const agenda = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || 'gestaovybe@gmail.com');
  const token = await obterToken(ESCOPO_AGENDA);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${agenda}/events`;
  if (acao === 'apagar') {
    const r = await buscar(`${url}/${encodeURIComponent(k.evento_google)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`Google respondeu ${r.status}.`);
    return null;
  }
  const corpo = JSON.stringify(eventoDaCaptacao(k));
  const r = await buscar(k.evento_google ? `${url}/${encodeURIComponent(k.evento_google)}` : url, {
    method: k.evento_google ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: corpo, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(r.status === 403 ? 'a conta do painel não pode mudar a agenda (confira o compartilhamento com "Fazer alterações")' : `Google respondeu ${r.status}`);
  const e = await r.json();
  return e.id;
}

// Cliente do evento pelo nome no título.
const normal = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const PALAVRAS_COMUNS = new Set(['clinica', 'grupo', 'escola', 'academia', 'loja', 'casa', 'restaurante', 'ristorante', 'bebidas', 'cliente', 'demonstracao', 'ficticio', 'papelaria', 'laboratorio', 'centro', 'servicos', 'solucoes']);
export function clienteDoEvento(titulo, clientes) {
  const t = ` ${normal(titulo).replace(/[^a-z0-9]+/g, ' ')} `;
  let melhor = null, nota = 0;
  for (const c of clientes) {
    const nome = normal(c.nome).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!nome) continue;
    if (t.includes(` ${nome} `)) { if (nome.length + 100 > nota) { melhor = c; nota = nome.length + 100; } continue; }
    for (const p of nome.split(' ')) if (p.length >= 4 && !PALAVRAS_COMUNS.has(p) && t.includes(` ${p} `) && p.length > nota) { melhor = c; nota = p.length; }
  }
  return melhor;
}
// A semana do Google Agenda da Vybe, com o tipo de cada evento (azul é
// captação) e o cliente pelo nome no título ("Captação - Antonov - Iago"). As
// captações azuis são a agenda real do Mizinho: contam mesmo sem terem sido
// montadas no painel; as outras ficam como contexto da semana.
export async function agendaDeCaptacoes(sql, { inicio = '', dias = 7, listar = listarAgendaProducao, hoje = '' } = {}) {
  const dia = diaValido(inicio) ? inicio : diaValido(hoje) ? hoje : new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
  const [r, clientes, nossas] = await Promise.all([
    listar(dia, { dias }),
    sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE COALESCE(ativo, true)`,
    (async () => (await captacoesProntas(sql)) ? sql`SELECT id::text AS id, evento_google FROM vybe_captacoes WHERE evento_google IS NOT NULL AND estado <> 'cancelada'` : [])(),
  ]);
  const porEvento = new Map(nossas.map((n) => [n.evento_google, n.id]));
  return (r.eventos || []).map((e) => {
    const c = clienteDoEvento(e.titulo, clientes);
    const tipo = e.tipo || (e.captacao ? 'captacao' : 'outro');
    return { id: e.id, titulo: e.titulo, dia: e.dia, horario: e.horario, inicio: e.inicio || '', fim: e.fim || '', local: e.local, link: e.link || '',
      tipo, cliente_id: c?.id || '', cliente: c?.nome || '', captacao_id: porEvento.get(e.id) || '' };
  });
}
