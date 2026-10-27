// Captações da Produção (decisão do Paulo, 21/10/2026; docs/captacao-plano.md).
// Uma captação junta peças de um cliente que estão em "Agendar Captação" num dia
// e horário. Montar marca cada peça "Captação Agendada" pelo mesmo caminho do
// painel (trocarEscolha, que dispara as automações) e cria o evento no Google
// Agenda da Vybe; na gravação cada peça vira "Captação Feita". Falha do Google
// aparece como aviso e não desfaz a captação (dá para tentar de novo).
import { tokenGoogle } from '../vybe_drive.js';
import { listarAgendaProducao } from './agenda-producao.js';
import { BOARD_PRODUCAO } from './grupos.js';
// roteiros.js também importa daqui (clienteDoEvento); só funções declaradas,
// usadas na hora da chamada, então o ciclo não atrapalha.
import { incluirRoteiro, ligar as ligarRoteiro, docDoLink } from './roteiros.js';

export const CAPTACAO = { pronta: 'agendar_captacao', agendada: 'captacao_agendada', feita: 'captacao_feita' };
const FUSO = 'America/Bahia';
const ESCOPO_AGENDA = 'https://www.googleapis.com/auth/calendar.events';
const LIMITE_PECAS = 40;

// A peça vai ao painel (trocarEscolha e companhia) como "vybe:<id>": o id
// puro só bate com monday_item_id, e era assim que "Captação Feita" falhava
// calado (Paulo, 27/10/2026: a Lions gravada ficou em Aguardo, sem captação).
const ref = (id) => `vybe:${id}`;
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
      CASE WHEN c.formato ILIKE '%foto%' OR c.titulo ILIKE 'foto%' THEN 'foto' ELSE 'video' END AS tipo,
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

// Peças que vão ser gravadas e ainda não estão na Captação (Paulo, 21/10/2026:
// "o tanto de fotografia enganchada porque está sem banco de fotos" e os Reels
// em "Aguardo Redação" já cadastrados sem roteiro): na Produção, foto ou vídeo
// sem material bruto, sem status de captação, fora de uma captação marcada e
// ainda por fazer (status que não é final nem "Para agendar"). O status da
// peça não muda; ela pode ir para uma captação. `tipo` diz foto ou vídeo.
const EH_FOTO = (c) => `(${c}.formato ILIKE '%foto%' OR ${c}.titulo ILIKE 'foto%')`;
const EH_VIDEO = (c) => `(${c}.formato ~* '(reel|v[ií]deo|story|stories)' OR ${c}.titulo ~* '^(reels?|v[ií]deo|story|stories)\\M')`;
const SEM_MATERIAL_SQL = (c, s) => `${c}.captacao_chave IS NULL AND (${EH_FOTO(c)} OR ${EH_VIDEO(c)})
  AND btrim(COALESCE(${c}.material_bruto, '')) = '' AND NOT COALESCE(${s}.final, false) AND ${c}.status_chave IS DISTINCT FROM 'para_agendar'`;
export async function pecasSemMaterial(sql) {
  await exigirTabelas(sql);
  return (await sql.query(`SELECT c.id, c.titulo, c.formato, c.prazo::text AS prazo, c.veiculacao::text AS veiculacao, c.briefing,
      c.status_chave, s.rotulo AS status, s.cor AS status_cor, true AS sem_material,
      CASE WHEN ${EH_FOTO('c')} THEN 'foto' ELSE 'video' END AS tipo,
      COALESCE(json_agg(json_build_object('id', cl.id::text, 'nome', cl.nome) ORDER BY cl.nome) FILTER (WHERE cl.id IS NOT NULL), '[]') AS clientes
    FROM vybe_conteudos c
    LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    LEFT JOIN vybe_conteudo_clientes cc ON cc.conteudo_id = c.id
    LEFT JOIN vybe_clientes cl ON cl.id = cc.cliente_id
    WHERE c.removido_em IS NULL AND c.board_id = $1 AND ${SEM_MATERIAL_SQL('c', 's')}
      AND NOT EXISTS (SELECT 1 FROM vybe_captacao_pecas p JOIN vybe_captacoes k ON k.id = p.captacao_id
        WHERE p.conteudo_id = c.id AND k.estado = 'agendada')
    GROUP BY c.id, s.rotulo, s.cor
    ORDER BY COALESCE(c.prazo, c.veiculacao) NULLS LAST, c.id`, [BOARD_PRODUCAO])).map((l) => ({ ...l, id: String(l.id) }));
}

// Captações de um período (padrão: de hoje a 30 dias), com as peças e o roteiro.
export async function listarCaptacoes(sql, { de = '', ate = '' } = {}) {
  await exigirTabelas(sql);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
  const inicio = diaValido(de) ? de : hoje;
  const fimPadrao = new Date(`${inicio}T12:00:00Z`); fimPadrao.setUTCDate(fimPadrao.getUTCDate() + 30);
  const fim = diaValido(ate) ? ate : fimPadrao.toISOString().slice(0, 10);
  // O status de cada peça vai junto: depois de gravada, a captação mostra o
  // que ela gerou e em que pé cada peça está (edição, aprovação…).
  const linhas = await sql`SELECT k.id, k.cliente_id::text AS cliente_id, cl.nome AS cliente, k.dia::text AS dia,
      to_char(k.inicio, 'HH24:MI') AS inicio, to_char(k.fim, 'HH24:MI') AS fim, k.local, k.observacao, k.estado,
      k.evento_google IS NOT NULL AS na_agenda, k.evento_google, k.evento_do_painel, k.aviso, p.nome AS criado_por,
      COALESCE(json_agg(json_build_object('id', c.id::text, 'titulo', c.titulo, 'formato', c.formato, 'briefing', c.briefing, 'prazo', c.prazo::text, 'veiculacao', c.veiculacao::text,
        'tipo', CASE WHEN c.formato ILIKE '%foto%' OR c.titulo ILIKE 'foto%' THEN 'foto' ELSE 'video' END,
        'status', s.rotulo, 'status_cor', s.cor,
        'captacao', c.captacao_chave, 'gravado', kp.gravado_em IS NOT NULL) ORDER BY kp.ordem, c.id) FILTER (WHERE c.id IS NOT NULL), '[]') AS pecas
    FROM vybe_captacoes k
    LEFT JOIN vybe_clientes cl ON cl.id = k.cliente_id
    LEFT JOIN vybe_pessoas p ON p.id = k.criado_por
    LEFT JOIN vybe_captacao_pecas kp ON kp.captacao_id = k.id
    LEFT JOIN vybe_conteudos c ON c.id = kp.conteudo_id
    LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE k.estado <> 'cancelada' AND k.dia BETWEEN ${inicio}::date AND ${fim}::date
    GROUP BY k.id, cl.nome, p.nome
    ORDER BY k.dia, k.inicio NULLS LAST, k.id`;
  const captacoes = linhas.map((l) => ({ ...l, id: String(l.id) }));
  // Antes da migração do fechamento a lista continua igual, sem os campos novos.
  if (captacoes.length && await fechamentoPronto(sql)) {
    const fechadas = new Map((await sql`SELECT k.id::text AS id, k.drive_link, k.fechada_em::text AS fechada_em, k.observacao_final, p.nome AS fechada_por
      FROM vybe_captacoes k LEFT JOIN vybe_pessoas p ON p.id = k.fechada_por
      WHERE k.id = ANY(${captacoes.map((k) => k.id)}::bigint[])`).map((l) => [l.id, l]));
    for (const k of captacoes) Object.assign(k, fechadas.get(k.id) || {});
  }
  return { de: inicio, ate: fim, captacoes };
}

const fechamentoProntoEm = new WeakSet();
async function fechamentoPronto(sql) {
  if (fechamentoProntoEm.has(sql)) return true;
  const [r] = await sql`SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vybe_captacoes' AND column_name IN ('drive_link', 'fechada_em', 'fechada_por', 'observacao_final')`;
  if (r?.n !== 4) return false;
  fechamentoProntoEm.add(sql);
  return true;
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
    const semMaterial = new Set((await tx.query(`SELECT c.id::text AS id FROM vybe_conteudos c
      LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
      WHERE c.id = ANY($1::bigint[]) AND ${SEM_MATERIAL_SQL('c', 's')}`, [d.pecas])).map((l) => l.id));
    for (const l of linhas) l.sem_material = semMaterial.has(String(l.id));
    // Entra a peça em "Agendar Captação" e a fotografia sem banco de fotos.
    const fora = linhas.filter((l) => l.removido_em || String(l.board_id) !== String(BOARD_PRODUCAO) || (l.captacao_chave !== CAPTACAO.pronta && !l.sem_material) || l.ja_marcada || !l.do_cliente);
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
    try { await trocar(sql, quem, { item: ref(id), campo: 'captacao', para: CAPTACAO.agendada }); }
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
  await trocar(sql, quem, { item: ref(conteudo_id), campo: 'captacao', para: desfazer ? CAPTACAO.agendada : CAPTACAO.feita });
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
    try { await trocar(sql, quem, { item: ref(item), campo: 'captacao', para: CAPTACAO.pronta }); }
    catch (e) { avisos.push(`Uma peça não voltou para "Agendar Captação": ${e.message}`); }
  }
  if (evento) {
    try { await agenda('apagar', { evento_google: evento }); }
    catch (e) { avisos.push(`O evento continua no Google Agenda: ${e.message}`); }
  }
  return { avisos };
}

// FECHAR GRAVAÇÃO (Paulo, 26/10/2026: o Mizinho fecha a captação que fez, no
// sistema, com o link do Drive, e vê o que ela gerou).
//
// Serve para a captação montada no painel e para a que só está no Google
// Agenda: nesse caso a captação nasce aqui, ligada ao evento, sem mexer nele
// (`evento_do_painel = false`, como em "Levar peças"). Numa transação:
//  - `gravadas` são as peças que de fato foram gravadas: as já ligadas e as do
//    cliente que estavam esperando (em "Agendar Captação" ou sem material);
//  - as ligadas que não foram gravadas se soltam e voltam para "Agendar
//    Captação", como no cancelar;
//  - a pasta do Drive vira o material bruto de cada peça gravada que ainda não
//    tem um (com o registro no histórico da peça, como o campo da gaveta);
//  - a captação fica "gravada", com quem fechou, quando e a observação.
// Depois, cada peça muda de status de captação pelo trocarEscolha do painel.
function validarFechamento(d = {}) {
  const gravadas = [...new Set((Array.isArray(d.gravadas) ? d.gravadas : []).map(String))];
  const id = d.captacao_id ? String(d.captacao_id) : '';
  const evento = d.evento_google ? String(d.evento_google) : '';
  if (id && !/^\d{1,18}$/.test(id)) throw erro('Captação inválida.');
  if (evento && !/^[A-Za-z0-9_-]{5,1024}$/.test(evento)) throw erro('Evento da agenda inválido.');
  if (!id && !evento) throw erro('Escolha a captação que vai fechar.');
  // Peças gravadas que não estavam no sistema (Paulo, 26/10/2026: "o Mizinho fez
  // 4 materiais na Lions e só 2 estavam lá"): título, formato, o dia de ir ao ar
  // (opcional) e o destino da regra do cadastro (cadastrosDestiny, na tela).
  const novas = (Array.isArray(d.novas) ? d.novas : []).map((n) => ({
    titulo: String(n?.titulo || '').replace(/\s+/g, ' ').trim(), formato: String(n?.formato || '').trim(),
    veiculacao: String(n?.veiculacao || ''), grupo_id: String(n?.destino?.grupo_id || ''), status: String(n?.destino?.status || ''),
    responsaveis: (Array.isArray(n?.destino?.responsaveis) ? n.destino.responsaveis : []).map(String).filter((x) => /^\d{1,18}$/.test(x)).slice(0, 12) }));
  if (novas.length > 20) throw erro('No máximo 20 peças novas por gravação.');
  for (const n of novas) {
    if (!n.titulo) throw erro('Dê um título a cada peça nova.');
    if (n.titulo.length > 200) throw erro('O título de uma peça nova passou de 200 caracteres.');
    if (!FORMATOS_NOVOS.includes(n.formato)) throw erro(`Formato inválido: ${n.formato || 'vazio'}.`);
    if (n.veiculacao && !diaValido(n.veiculacao)) throw erro(`Data de veiculação inválida em "${n.titulo}".`);
    if (!/^[a-z0-9_]{1,80}$/i.test(n.grupo_id) || !/^[a-z0-9_]{1,80}$/.test(n.status)) throw erro('Destino da peça nova inválido. Atualize a tela.');
  }
  if (!gravadas.length && !novas.length) throw erro('Marque ao menos uma peça gravada. Se nada foi gravado, cancele a captação.');
  // O roteiro é o Google Docs da agência (Paulo: "fica sempre nos Docs, no mesmo
  // Gmail que todos usam"); o PDF/DOCX do grupo é só a cópia.
  const roteiro = String(d.roteiro || '').trim();
  if (roteiro && !docDoLink(roteiro)) throw erro('Cole o link do Google Docs do roteiro.');
  if (gravadas.length > LIMITE_PECAS) throw erro(`No máximo ${LIMITE_PECAS} peças por captação.`);
  if (gravadas.some((p) => !/^\d{1,18}$/.test(p))) throw erro('Peça inválida.');
  const drive = String(d.drive || '').trim();
  if (drive && !/^https?:\/\/\S+$/i.test(drive)) throw erro('O link do Drive precisa começar com http:// ou https://');
  if (drive.length > 2000) throw erro('O link do Drive é longo demais.');
  const observacao = String(d.observacao || '').trim();
  if (observacao.length > 2000) throw erro('A observação passou de 2.000 caracteres.');
  if (!id) {
    if (!/^\d{1,18}$/.test(String(d.cliente_id || ''))) throw erro('Esta captação não tem cliente reconhecido. Ponha o nome do cliente no título do evento.');
    if (!diaValido(d.dia)) throw erro('Dia da captação inválido.');
    if (d.inicio && !horaValida(d.inicio)) throw erro('Horário de início inválido.');
    if (d.fim && !horaValida(d.fim)) throw erro('Horário de fim inválido.');
  }
  return { id, evento, gravadas, novas, roteiro, drive, observacao, cliente_id: String(d.cliente_id || ''), dia: d.dia,
    inicio: d.inicio || null, fim: d.inicio && d.fim && d.fim > d.inicio ? d.fim : null, local: String(d.local || '').trim().slice(0, 300) };
}

const FORMATOS_NOVOS = ['Reels', 'Vídeo', 'Fotografia', 'Story', 'Card', 'Carrossel'];

// Liga o roteiro (um Google Docs) às peças: entra na biblioteca se ainda não
// está lá (a mesma de "Incluir roteiro", aba Roteiros) e liga cada peça.
// Falhar aqui é aviso: a gravação já está registrada.
async function ligarRoteiroNasPecas(sql, quem, { link, cliente_id, titulo, pecas }) {
  const doc = docDoLink(link);
  if (!doc) throw erro('Cole o link do Google Docs do roteiro.');
  const avisos = [];
  let [r] = await sql`SELECT id::text AS id, removido_em FROM vybe_roteiros WHERE doc_id = ${doc}`;
  if (!r || r.removido_em) { const n = await incluirRoteiro(sql, quem, { link, titulo, cliente_id }); r = { id: n.id }; avisos.push(...(n.avisos || [])); }
  for (const conteudo_id of pecas) await ligarRoteiro(sql, quem, { roteiro_id: r.id, conteudo_id });
  return { roteiro_id: r.id, avisos };
}

// "Ligar roteiro" no cartão de uma captação montada: o Docs vai para as peças dela.
export async function roteiroDaCaptacao(sql, quem, { captacao_id, link } = {}) {
  await exigirTabelas(sql);
  if (!/^\d{1,18}$/.test(String(captacao_id || ''))) throw erro('Captação inválida.');
  const [k] = await sql`SELECT k.id, k.cliente_id::text AS cliente_id, k.dia::text AS dia, cl.nome AS cliente FROM vybe_captacoes k
    LEFT JOIN vybe_clientes cl ON cl.id = k.cliente_id WHERE k.id = ${captacao_id} AND k.estado <> 'cancelada'`;
  if (!k) throw erro('Captação não encontrada.', 404);
  const pecas = (await sql`SELECT conteudo_id::text AS id FROM vybe_captacao_pecas WHERE captacao_id = ${k.id}`).map((l) => l.id);
  if (!pecas.length) throw erro('Esta captação ainda não tem peças para ligar o roteiro.');
  return ligarRoteiroNasPecas(sql, quem, { link, cliente_id: k.cliente_id, titulo: `Roteiro ${k.cliente || ''} ${k.dia.split('-').reverse().join('/')}`.trim(), pecas });
}

export async function fecharGravacao(sql, quem, dados, { trocar, criar = null, prazo = null, painel = null } = {}) {
  await exigirTabelas(sql);
  if (!(await fechamentoPronto(sql))) throw erro('Fechar gravação aguarda a migração do banco.', 503);
  const d = validarFechamento(dados);
  const pessoaId = quem?.pessoa?.id ? String(quem.pessoa.id) : null;
  const r = await sql.comTransacao(async (tx) => {
    let [k] = d.id
      ? await tx`SELECT id, cliente_id::text AS cliente_id, estado, fechada_em FROM vybe_captacoes WHERE id = ${d.id} FOR UPDATE`
      : await tx`SELECT id, cliente_id::text AS cliente_id, estado, fechada_em FROM vybe_captacoes WHERE evento_google = ${d.evento} AND estado <> 'cancelada' FOR UPDATE`;
    if (d.id && (!k || k.estado === 'cancelada')) throw erro('Captação não encontrada.', 404);
    if (k?.fechada_em) throw erro('Esta gravação já foi fechada. Atualize a tela.', 409);
    if (!k) {
      const [cliente] = await tx`SELECT id FROM vybe_clientes WHERE id = ${d.cliente_id}`;
      if (!cliente) throw erro('Cliente não encontrado.', 404);
      [k] = await tx`INSERT INTO vybe_captacoes (cliente_id, dia, inicio, fim, local, criado_por, evento_google, evento_do_painel)
        VALUES (${d.cliente_id}, ${d.dia}::date, ${d.inicio}::time, ${d.fim}::time, ${d.local}, ${pessoaId}, ${d.evento}, false)
        RETURNING id, cliente_id::text AS cliente_id, estado`;
    }
    const doLaco = await tx`SELECT conteudo_id::text AS id, gravado_em IS NOT NULL AS gravado FROM vybe_captacao_pecas WHERE captacao_id = ${k.id}`;
    const ligadas = new Set(doLaco.map((l) => l.id));
    const linhas = d.gravadas.length ? await tx`SELECT c.id::text AS id, c.titulo, c.captacao_chave, c.removido_em, c.board_id, c.material_bruto,
        EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id = c.id AND cc.cliente_id = ${k.cliente_id}) AS do_cliente,
        EXISTS (SELECT 1 FROM vybe_captacao_pecas p JOIN vybe_captacoes o ON o.id = p.captacao_id
          WHERE p.conteudo_id = c.id AND o.estado = 'agendada' AND o.id <> ${k.id}) AS em_outra
      FROM vybe_conteudos c WHERE c.id = ANY(${d.gravadas}::bigint[]) ORDER BY c.id FOR UPDATE OF c` : [];
    if (linhas.length !== d.gravadas.length) throw erro('Alguma peça não existe mais.', 409);
    const semMaterial = d.gravadas.length ? new Set((await tx.query(`SELECT c.id::text AS id FROM vybe_conteudos c
      LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
      WHERE c.id = ANY($1::bigint[]) AND ${SEM_MATERIAL_SQL('c', 's')}`, [d.gravadas])).map((l) => l.id)) : new Set();
    // Peça ligada a esta captação entra sempre; as outras, se são do cliente e
    // estavam esperando captação (como em "Levar peças").
    const fora = linhas.filter((l) => !ligadas.has(l.id) && (l.removido_em || String(l.board_id) !== String(BOARD_PRODUCAO) || !l.do_cliente || l.em_outra
      || (l.captacao_chave !== CAPTACAO.pronta && !semMaterial.has(l.id))));
    if (fora.length) throw erro(`Não dá para pôr nesta gravação: ${fora.map((l) => l.titulo).join('; ')}. Atualize a tela.`, 409);
    // A que já tinha "Gravado" (marcado peça a peça) fica, mesmo desmarcada aqui.
    const soltas = doLaco.filter((l) => !l.gravado && !d.gravadas.includes(l.id)).map((l) => l.id);
    if (soltas.length) await tx`DELETE FROM vybe_captacao_pecas WHERE captacao_id = ${k.id} AND conteudo_id = ANY(${soltas}::bigint[])`;
    const agora = new Date();
    let ordem = ligadas.size;
    for (const id of d.gravadas) {
      if (ligadas.has(id)) await tx`UPDATE vybe_captacao_pecas SET gravado_em = COALESCE(gravado_em, ${agora}), gravado_por = COALESCE(gravado_por, ${pessoaId})
        WHERE captacao_id = ${k.id} AND conteudo_id = ${id}`;
      else await tx`INSERT INTO vybe_captacao_pecas (captacao_id, conteudo_id, ordem, gravado_em, gravado_por) VALUES (${k.id}, ${id}, ${ordem++}, ${agora}, ${pessoaId})`;
    }
    // A pasta não apaga o material de quem já tinha um.
    const brutos = d.drive ? linhas.filter((l) => !String(l.material_bruto || '').trim()).map((l) => l.id) : [];
    for (const id of brutos) {
      await tx`UPDATE vybe_conteudos SET material_bruto = ${d.drive}, material_bruto_em = now(), atualizado_em = now() WHERE id = ${id}`;
      await tx`INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para, autor_id) VALUES (${id}, 'material_bruto', NULL, ${d.drive}, ${pessoaId})`;
    }
    // As peças novas nascem pelo mesmo cadastro do painel (criarConteudoNaTransacao,
    // o do botão "Cadastrar as peças" do planejamento), com o destino da regra do
    // cadastro, a pasta como material bruto, ligadas e gravadas nesta captação.
    const criadas = [];
    if (d.novas.length) {
      const [cl] = await tx`SELECT nome FROM vybe_clientes WHERE id = ${k.cliente_id}`;
      const criarPeca = criar || (await import('../api/conteudo.js')).criarConteudoNaTransacao;
      const prazoDe = prazo || (await import('./planejamentos.js')).prazoDaPeca;
      const [{ hoje }] = await tx`SELECT (now() AT TIME ZONE 'America/Bahia')::date::text AS hoje`;
      for (const n of d.novas) {
        const comFormato = n.titulo.toLowerCase().startsWith(n.formato.toLowerCase()) ? n.titulo : `${n.formato} - ${n.titulo}`;
        const r = await criarPeca(tx, quem, { board: BOARD_PRODUCAO, titulo: comFormato.slice(0, 240), cliente: cl?.nome, formato: n.formato,
          prazo: n.veiculacao ? prazoDe(n.veiculacao, hoje) : null, veiculacao: n.veiculacao || null, status: n.status, grupo_id: n.grupo_id,
          material_bruto: d.drive || '', responsaveis: n.responsaveis });
        await tx`INSERT INTO vybe_captacao_pecas (captacao_id, conteudo_id, ordem, gravado_em, gravado_por) VALUES (${k.id}, ${r.conteudo_id}, ${ordem++}, ${agora}, ${pessoaId})`;
        criadas.push(String(r.conteudo_id));
      }
    }
    await tx`UPDATE vybe_captacoes SET estado = 'gravada', drive_link = ${d.drive || null}, fechada_em = now(), fechada_por = ${pessoaId},
      observacao_final = ${d.observacao}, atualizado_em = now() WHERE id = ${k.id}`;
    return { id: String(k.id), cliente_id: k.cliente_id, dia: d.dia, soltas, brutos: brutos.length + (d.drive ? criadas.length : 0), criadas,
      feitas: [...linhas.filter((l) => l.captacao_chave !== CAPTACAO.feita).map((l) => l.id), ...criadas] };
  });
  const avisos = [];
  for (const item of r.feitas) {
    try { await trocar(sql, quem, { item: ref(item), campo: 'captacao', para: CAPTACAO.feita }); }
    catch (e) { avisos.push(`Uma peça não foi para "Captação Feita": ${e.message}`); }
  }
  for (const item of r.soltas) {
    try { await trocar(sql, quem, { item: ref(item), campo: 'captacao', para: CAPTACAO.pronta }); }
    catch (e) { avisos.push(`Uma peça não voltou para "Agendar Captação": ${e.message}`); }
  }
  avisos.push(...await semVeiculacaoParaRedacao(sql, quem, [...d.gravadas, ...r.criadas], r.cliente_id, painel));
  if (d.roteiro) {
    try {
      const [k] = await sql`SELECT k.dia::text AS dia, cl.nome AS cliente FROM vybe_captacoes k LEFT JOIN vybe_clientes cl ON cl.id = k.cliente_id WHERE k.id = ${r.id}`;
      const ligado = await ligarRoteiroNasPecas(sql, quem, { link: d.roteiro, cliente_id: r.cliente_id, titulo: `Roteiro ${k?.cliente || ''} ${String(k?.dia || '').split('-').reverse().join('/')}`.trim(), pecas: [...d.gravadas, ...r.criadas] });
      avisos.push(...ligado.avisos);
    } catch (e) { avisos.push(`O roteiro não foi ligado: ${e.message}`); }
  }
  return { id: r.id, gravadas: d.gravadas.length + r.criadas.length, novas: r.criadas.length, soltas: r.soltas.length, com_drive: r.brutos, avisos };
}

// Gravada sem dia de ir ao ar (Paulo, 27/10/2026: "o Mizinho não escolhe o dia
// de veiculação"): depois da Captação Feita (e das automações dela), a peça vai
// para o grupo Redação, o head do cliente entra nos responsáveis e recebe um
// aviso na peça para escolher o dia. Pelo mesmo caminho da gaveta; falha vira aviso.
const GRUPO_REDACAO = 'group_title';
async function semVeiculacaoParaRedacao(sql, quem, ids, clienteId, painel) {
  if (!ids.length) return [];
  const pecas = await sql`SELECT c.id::text AS id, c.titulo,
      COALESCE(ARRAY(SELECT r.pessoa_id::text FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id = c.id), '{}') AS responsaveis
    FROM vybe_conteudos c WHERE c.id = ANY(${ids}::bigint[]) AND c.veiculacao IS NULL AND c.removido_em IS NULL`;
  if (!pecas.length) return [];
  const heads = await sql`SELECT p.id::text AS id, p.nome FROM vybe_cliente_pessoas h JOIN vybe_pessoas p ON p.id = h.pessoa_id
    WHERE h.cliente_id = ${clienteId} AND COALESCE(p.ativo, true) ORDER BY p.nome`;
  const f = painel || await import('../api/conteudo.js');
  const avisos = [];
  const quemAvisar = heads.map((h) => '@' + String(h.nome).split(' ')[0]).join(' ');
  for (const p of pecas) {
    try {
      await f.moverGrupo(sql, quem, { item: ref(p.id), grupo_id: GRUPO_REDACAO });
      // Os responsáveis de agora (já com as automações da Captação Feita) mais os heads.
      const [atual] = await sql`SELECT COALESCE(ARRAY(SELECT r.pessoa_id::text FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id = ${p.id}), '{}') AS responsaveis`;
      const pessoas = [...new Set([...(atual?.responsaveis || p.responsaveis), ...heads.map((h) => h.id)])];
      if (heads.length) await f.trocarResponsaveis(sql, quem, { item: ref(p.id), pessoas });
      await f.comentar(sql, quem, { item: ref(p.id), texto: `${quemAvisar ? quemAvisar + ' ' : ''}Conteúdo gravado e sem dia de veiculação: escolha o dia de ir ao ar. A peça está em Redação até lá.` });
    } catch (e) { avisos.push(`"${p.titulo}" ficou sem ir para Redação: ${e.message}`); }
  }
  if (!heads.length) avisos.push(`${pecas.length === 1 ? 'Uma peça gravada está' : `${pecas.length} peças gravadas estão`} sem dia de veiculação e o cliente não tem head cadastrado para avisar.`);
  return avisos;
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
  const [r, clientes, nossas, vinculos] = await Promise.all([
    listar(dia, { dias }),
    sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE COALESCE(ativo, true)`,
    (async () => (await captacoesProntas(sql)) ? sql`SELECT id::text AS id, evento_google FROM vybe_captacoes WHERE evento_google IS NOT NULL AND estado <> 'cancelada'` : [])(),
    (async () => (await vinculosProntos(sql)) ? sql`SELECT a.evento_google, a.cliente_id::text AS id, c.nome FROM vybe_agenda_clientes a JOIN vybe_clientes c ON c.id = a.cliente_id` : [])(),
  ]);
  const porEvento = new Map(nossas.map((n) => [n.evento_google, n.id]));
  // O cliente escolhido à mão vale mais que o adivinhado pelo título.
  const escolhido = new Map(vinculos.map((v) => [v.evento_google, { id: v.id, nome: v.nome }]));
  return (r.eventos || []).map((e) => {
    const manual = escolhido.get(e.id), c = manual || clienteDoEvento(e.titulo, clientes);
    const tipo = e.tipo || (e.captacao ? 'captacao' : 'outro');
    return { id: e.id, titulo: e.titulo, dia: e.dia, horario: e.horario, inicio: e.inicio || '', fim: e.fim || '', local: e.local, link: e.link || '',
      tipo, cliente_id: c?.id || '', cliente: c?.nome || '', cliente_manual: Boolean(manual), captacao_id: porEvento.get(e.id) || '' };
  });
}

// ── VINCULAR CLIENTE E CRIAR EVENTO (Paulo, 26/10/2026) ──────────────────────
// "Quando não tem um cliente vinculado na agenda, não posso vincular?" e "não
// tem como criar um compromisso novo?". O vínculo fica no painel
// (vybe_agenda_clientes): o evento de quem marcou no Google não é reescrito.
// Evento novo vai para o Google Agenda da Vybe com a cor da convenção da
// agência: azul (9) captação, amarelo (5) reunião, grafite (8) compromisso.
async function vinculosProntos(sql) {
  const [r] = await sql`SELECT to_regclass('public.vybe_agenda_clientes') IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}
const eventoValido = (id) => /^[A-Za-z0-9_-]{5,1024}$/.test(String(id || ''));
export async function vincularCliente(sql, quem, { evento, cliente_id } = {}) {
  if (!(await vinculosProntos(sql))) throw erro('Vincular cliente aguarda a migração do banco.', 503);
  if (!eventoValido(evento)) throw erro('Evento da agenda inválido.');
  if (!cliente_id) { await sql`DELETE FROM vybe_agenda_clientes WHERE evento_google = ${evento}`; return { cliente: null }; }
  if (!/^\d{1,18}$/.test(String(cliente_id))) throw erro('Cliente inválido.');
  const [c] = await sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE id = ${cliente_id} AND COALESCE(ativo, true)`;
  if (!c) throw erro('Cliente não encontrado.', 404);
  const pessoaId = quem?.pessoa?.id ? String(quem.pessoa.id) : null;
  await sql`INSERT INTO vybe_agenda_clientes (evento_google, cliente_id, definido_por) VALUES (${evento}, ${c.id}, ${pessoaId})
    ON CONFLICT (evento_google) DO UPDATE SET cliente_id = EXCLUDED.cliente_id, definido_por = EXCLUDED.definido_por, definido_em = now()`;
  return { cliente: c };
}

const COR_DO_TIPO = { captacao: '9', reuniao: '5', outro: '8' };
export function eventoNovo({ tipo, titulo, dia, inicio, fim, local, cliente }) {
  const nome = String(titulo || '').trim();
  const summary = tipo === 'captacao' ? ['Captação', cliente, nome].filter(Boolean).join(' · ')
    : tipo === 'reuniao' ? ['Reunião', nome, cliente].filter(Boolean).join(' · ') : [nome, cliente].filter(Boolean).join(' · ');
  const fimDia = new Date(`${dia}T12:00:00Z`); fimDia.setUTCDate(fimDia.getUTCDate() + 1);
  const quando = inicio
    ? { start: { dateTime: `${dia}T${inicio}:00-03:00`, timeZone: FUSO }, end: { dateTime: `${dia}T${fim || inicio}:00-03:00`, timeZone: FUSO } }
    : { start: { date: dia }, end: { date: fimDia.toISOString().slice(0, 10) } };
  if (inicio && !fim) { const t = new Date(`${dia}T${inicio}:00-03:00`); quando.end.dateTime = new Date(t.getTime() + 3600e3).toISOString(); }
  return { summary, location: local || undefined, colorId: COR_DO_TIPO[tipo], ...quando };
}
export async function criarEvento(sql, quem, d = {}, { buscar = fetch, obterToken = tokenGoogle } = {}) {
  const tipo = String(d.tipo || '');
  if (!COR_DO_TIPO[tipo]) throw erro('Escolha captação, reunião ou compromisso.');
  const titulo = String(d.titulo || '').replace(/\s+/g, ' ').trim();
  if (titulo.length > 200) throw erro('O título passou de 200 caracteres.');
  if (!diaValido(d.dia)) throw erro('Escolha o dia.');
  if (d.inicio && !horaValida(d.inicio)) throw erro('Horário de início inválido.');
  if (d.fim && !horaValida(d.fim)) throw erro('Horário de fim inválido.');
  if (d.inicio && d.fim && d.fim <= d.inicio) throw erro('O fim precisa ser depois do início.');
  const local = String(d.local || '').trim();
  if (local.length > 300) throw erro('O local passou de 300 caracteres.');
  let cliente = null;
  if (d.cliente_id) {
    if (!/^\d{1,18}$/.test(String(d.cliente_id))) throw erro('Cliente inválido.');
    [cliente] = await sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE id = ${d.cliente_id} AND COALESCE(ativo, true)`;
    if (!cliente) throw erro('Cliente não encontrado.', 404);
  }
  if (tipo === 'captacao' && !cliente) throw erro('Captação precisa do cliente.');
  if (!titulo && !cliente) throw erro('Dê um título ao evento.');
  const corpo = eventoNovo({ tipo, titulo, dia: d.dia, inicio: d.inicio || '', fim: d.fim || '', local, cliente: cliente?.nome || '' });
  const agenda = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || 'gestaovybe@gmail.com');
  const token = await obterToken(ESCOPO_AGENDA);
  const r = await buscar(`https://www.googleapis.com/calendar/v3/calendars/${agenda}/events`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw erro(r.status === 403 ? 'A conta do painel não pode mudar a agenda (confira o compartilhamento com "Fazer alterações").' : `O Google Agenda respondeu ${r.status}. Tente de novo.`, 502);
  const e = await r.json();
  // O cliente escolhido fica vinculado mesmo que o título mude depois no Google.
  if (cliente && e.id && (await vinculosProntos(sql))) await vincularCliente(sql, quem, { evento: e.id, cliente_id: cliente.id });
  return { id: e.id, titulo: corpo.summary };
}
