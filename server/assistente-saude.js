// Saúde dos clientes e sugestão de responsável para a Vybe AI (Paulo, 27/10/2026). Somente leitura, pelo banco.
// - Saúde: por cliente ativo, o que costuma vir antes de um cliente esfriar: peças atrasadas, voltas para
//   alteração nos últimos 30 dias, calendário vazio nos próximos 14 dias e pouco entregue no mês.
// - Quem pega: para um formato, quem tem experiência nele (peças finalizadas em 90 dias) e menos carga
//   (peças abertas com prazo nos próximos 3 dias). O gestor decide; a Vybe AI só sugere.
import { BOARD_PRODUCAO } from './grupos.js';

const somar = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const normal = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function mensagemSaude(linhas) {
  const risco = linhas.filter((l) => l.pontos >= 3).sort((a, b) => b.pontos - a.pontos);
  const ok = linhas.length - risco.length;
  const motivo = (l) => [l.atrasadas && `${l.atrasadas} atrasada(s)`, l.alteracoes >= 3 && `${l.alteracoes} voltas para alteração em 30 dias`,
    !l.proximas && 'nada para veicular nos próximos 14 dias', l.entregues30 === 0 && 'nada entregue em 30 dias'].filter(Boolean).join(' · ');
  const partes = [`🩺 *Saúde dos clientes* · ${linhas.length} ativos`];
  partes.push(risco.length ? `⚠️ *Pedem atenção (${risco.length})*, do mais urgente\n` + risco.slice(0, 10).map((l) => `- *${l.cliente}*: ${motivo(l)}`).join('\n') : '✅ Nenhum cliente com sinal de alerta.');
  partes.push(`🟢 Em dia: ${ok} cliente(s).`);
  partes.push('_Sinais: atraso, voltas para alteração, calendário vazio e entregas no mês. É um alerta para conversar, não uma nota._');
  return partes.join('\n\n');
}

export async function saudeDosClientes(sql, dia) {
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new TypeError('Dia inválido.');
  const linhas = await sql`SELECT cl.id::text, cl.nome AS cliente,
      COUNT(DISTINCT c.id) FILTER (WHERE c.prazo < ${dia}::date AND NOT COALESCE(s.final, false)) AS atrasadas,
      COUNT(DISTINCT c.id) FILTER (WHERE c.veiculacao BETWEEN ${dia}::date AND ${somar(dia, 14)}::date) AS proximas,
      COUNT(DISTINCT c.id) FILTER (WHERE COALESCE(s.final, false) AND c.veiculacao BETWEEN ${somar(dia, -30)}::date AND ${dia}::date) AS entregues30,
      (SELECT COUNT(*) FROM vybe_conteudo_eventos e JOIN vybe_conteudo_clientes x ON x.conteudo_id = e.conteudo_id
        WHERE x.cliente_id = cl.id AND e.tipo = 'status' AND e.para ILIKE '%altera%' AND e.em >= ${somar(dia, -30)}::date) AS alteracoes
    FROM vybe_clientes cl
    LEFT JOIN vybe_conteudo_clientes cc ON cc.cliente_id = cl.id
    LEFT JOIN vybe_conteudos c ON c.id = cc.conteudo_id AND c.removido_em IS NULL AND c.board_id = ${BOARD_PRODUCAO}
    LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE COALESCE(cl.ativo, true) GROUP BY cl.id, cl.nome ORDER BY cl.nome`;
  const r = linhas.map((l) => {
    const x = { cliente: l.cliente, atrasadas: Number(l.atrasadas), proximas: Number(l.proximas), entregues30: Number(l.entregues30), alteracoes: Number(l.alteracoes) };
    return { ...x, pontos: x.atrasadas * 2 + (x.alteracoes >= 3 ? x.alteracoes - 2 : 0) + (x.proximas ? 0 : 3) + (x.entregues30 ? 0 : 1) };
  });
  return { texto: mensagemSaude(r), clientes: r };
}

export async function sugerirResponsavel(sql, { formato = '', dia }) {
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new TypeError('Dia inválido.');
  const f = normal(formato).slice(0, 5);
  const pessoas = await sql`SELECT p.id::text, p.nome, p.disciplina,
      COUNT(DISTINCT c.id) FILTER (WHERE NOT COALESCE(s.final, false) AND c.prazo BETWEEN ${dia}::date AND ${somar(dia, 3)}::date) AS carga,
      COUNT(DISTINCT c.id) FILTER (WHERE COALESCE(s.final, false) AND c.prazo >= ${somar(dia, -90)}::date
        AND (${f} = '' OR lower(COALESCE(c.formato, c.titulo, '')) LIKE ${f + '%'})) AS experiencia
    FROM vybe_pessoas p
    LEFT JOIN vybe_conteudo_responsaveis r ON r.pessoa_id = p.id
    LEFT JOIN vybe_conteudos c ON c.id = r.conteudo_id AND c.removido_em IS NULL AND c.board_id = ${BOARD_PRODUCAO}
    LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE p.ativo AND p.pode_entrar GROUP BY p.id, p.nome, p.disciplina`;
  const lista = pessoas.map((p) => ({ nome: p.nome, disciplina: p.disciplina || '', carga: Number(p.carga), experiencia: Number(p.experiencia) }))
    .filter((p) => p.experiencia > 0).map((p) => ({ ...p, pontos: p.experiencia - 2 * p.carga }))
    .sort((a, b) => b.pontos - a.pontos || a.carga - b.carga).slice(0, 3);
  const texto = lista.length
    ? `🧭 *Quem pode pegar${formato ? ' o ' + formato : ''}*\n` + lista.map((p, i) => `${i + 1}. *${p.nome.split(/\s+/)[0]}* · fez ${p.experiencia} ${formato || 'peça(s)'} em 90 dias · ${p.carga} com prazo até ${somar(dia, 3).slice(8, 10)}/${somar(dia, 3).slice(5, 7)}`).join('\n') + '\n\n_Sugestão pela experiência no formato e pela carga dos próximos 3 dias; quem decide é a gestão._'
    : `Não achei quem tenha feito ${formato || 'esse formato'} nos últimos 90 dias.`;
  return { texto, itens: lista };
}

// Copiloto de briefing (Paulo, 27/10/2026): cards da Produção criados nos últimos 2 dias, ainda abertos e sem
// briefing (nem no campo, nem em comentário marcado como briefing). Quem pediu é quem criou o card no painel;
// sem esse registro, o primeiro responsável.
export async function pecasSemBriefing(sql, dia) {
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new TypeError('Dia inválido.');
  const { MARCAS_BRIEFING } = await import('./briefing.js');
  const linhas = await sql`SELECT c.id::text, c.monday_item_id, c.titulo, c.formato, c.veiculacao::text AS veiculacao,
      (SELECT string_agg(cl.nome, ' / ') FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id WHERE cc.conteudo_id = c.id) AS cliente,
      (SELECT json_build_object('monday_id', p.monday_user_id, 'nome', p.nome) FROM vybe_conteudo_eventos e JOIN vybe_pessoas p ON p.id = e.autor_id
        WHERE e.conteudo_id = c.id AND e.tipo = 'criacao' ORDER BY e.em LIMIT 1) AS criador,
      (SELECT json_build_object('monday_id', p.monday_user_id, 'nome', p.nome) FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id
        WHERE r.conteudo_id = c.id ORDER BY r.ordem LIMIT 1) AS responsavel
    FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE c.removido_em IS NULL AND c.board_id = ${BOARD_PRODUCAO} AND NOT COALESCE(s.final, false)
      AND COALESCE(btrim(c.briefing), '') = ''
      AND EXISTS (SELECT 1 FROM vybe_conteudo_eventos e WHERE e.conteudo_id = c.id AND e.tipo = 'criacao' AND e.em >= ${somar(dia, -2)}::date)
      AND NOT EXISTS (SELECT 1 FROM vybe_conteudo_eventos e WHERE e.conteudo_id = c.id AND e.tipo = 'briefing')
      AND NOT EXISTS (SELECT 1 FROM vybe_conteudo_updates u WHERE u.conteudo_id = c.id AND u.corpo ~* ${MARCAS_BRIEFING})
    ORDER BY c.veiculacao NULLS LAST LIMIT 30`;
  const json = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
  return linhas.map((l) => {
    const quem = json(l.criador)?.monday_id ? json(l.criador) : json(l.responsavel);
    return { ref: l.monday_item_id ? String(l.monday_item_id) : 'vybe:' + l.id, titulo: l.titulo || 'Sem título', formato: l.formato || '', cliente: l.cliente || '',
      veiculacao: l.veiculacao ? String(l.veiculacao).slice(0, 10) : null, pessoa: quem?.monday_id ? { monday_id: String(quem.monday_id), nome: quem.nome || '' } : null };
  }).filter((x) => x.pessoa);
}
