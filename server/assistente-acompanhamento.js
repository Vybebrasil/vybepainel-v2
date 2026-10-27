// Acompanhamento automático da Vybe AI (Paulo, 27/10/2026: "deixar o JARVIS mais foda"). Mesmo recorte e regras de
// status das rotinas (itensDoDia + fluxo operacional do painel); só leitura, o texto vai para os grupos pelo bot.
// - aguardandoCliente: peças paradas em "Ag. Aprovação Cliente" há 2+ dias, por cliente, com a mensagem pronta para o
//   atendimento mandar ao cliente.
// - plantao: sábado e domingo, só o que publica no dia e ainda não está agendado.
// - fimDeSemana: segunda de manhã, o que tinha para publicar no sábado e no domingo e como ficou.
// - ranking: sexta, entregas da semana por pessoa (para aprovação ou status final), no prazo e idas para alteração.
import { itensDoDia, codigoDoPainel, linkDaAtividade } from './assistente-rotinas.js';

const normal = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const somarDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const curto = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');
const primeiro = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const ENTREGUE = ['finalizado', 'agendado', 'publicado', 'postado'];
const diasParado = (i, dia) => { const d = String(i.status_updated_at || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? Math.round((Date.parse(dia) - Date.parse(d)) / 864e5) : 0; };

export function mensagemAguardandoCliente(itens, dia, statusDe, { minimo = 2 } = {}) {
  const parados = itens.filter((i) => i.origem !== 'solicitacao' && normal(statusDe(i)) === 'ag. aprovacao cliente' && diasParado(i, dia) >= minimo);
  if (!parados.length) return null;
  const porCliente = new Map();
  for (const i of parados) { const c = i.cliente || 'Sem cliente'; porCliente.set(c, [...(porCliente.get(c) || []), i]); }
  const blocos = [...porCliente.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([cliente, pecas]) => {
    const lista = pecas.map((i) => `- ${i.nome || 'Sem título'} · há ${diasParado(i, dia)} dias${i.veiculacao_iso ? ' · veicula ' + curto(i.veiculacao_iso) : ''}\n  🔗 ${linkDaAtividade(i.id)}`).join('\n');
    const pedido = pecas.map((i) => `${i.nome || 'a peça'}${i.veiculacao_iso ? ` (vai ao ar ${curto(i.veiculacao_iso)})` : ''}`).join(', ');
    return `*${cliente}* · ${pecas.length} peça(s)\n${lista}\n✉️ _Mensagem pronta para o cliente:_\nOi, pessoal da ${cliente}! 😊 Ficou aguardando a aprovação de vocês: ${pedido}. Conseguem dar uma olhada hoje? Assim garantimos a publicação no dia certo.`;
  });
  return `🕐 *Esperando o cliente aprovar* (há ${minimo}+ dias)\n_Copie a mensagem pronta e mande no grupo de cada cliente._\n\n${blocos.join('\n\n')}`;
}

export function mensagemPlantao(itens, dia, statusDe) {
  const sem = ['domingo', 'sábado'][new Date(dia + 'T12:00:00Z').getUTCDay() === 0 ? 0 : 1];
  const faltam = itens.filter((i) => i.origem !== 'solicitacao' && i.veiculacao_iso === dia && !ENTREGUE.includes(normal(statusDe(i))));
  if (!faltam.length) return null;
  return `🛟 *Plantão de ${sem} (${curto(dia)})*\nPublica hoje e ainda não está agendado:\n\n` +
    faltam.map((i) => `- ${i.nome || 'Sem título'} (${i.cliente || 'sem cliente'}) · *${statusDe(i) || 'sem status'}*${i.responsavel ? ' · 👤 ' + i.responsavel.split(',').map(primeiro).join(', ') : ''}\n  🔗 ${linkDaAtividade(i.id)}`).join('\n');
}

export function mensagemFimDeSemana(itens, segunda, statusDe) {
  const sab = somarDias(segunda, -2), dom = somarDias(segunda, -1);
  const doFim = itens.filter((i) => i.origem !== 'solicitacao' && [sab, dom].includes(i.veiculacao_iso));
  if (!doFim.length) return null;
  const ok = doFim.filter((i) => ENTREGUE.includes(normal(statusDe(i)))), nao = doFim.filter((i) => !ENTREGUE.includes(normal(statusDe(i))));
  return `🗓️ *Fim de semana (${curto(sab)} e ${curto(dom)})*\n✅ ${ok.length} de ${doFim.length} publicaram ou estão agendadas.` +
    (nao.length ? `\n\n⚠️ *Não saíram:*\n` + nao.map((i) => `- ${curto(i.veiculacao_iso)} · ${i.nome || 'Sem título'} (${i.cliente || 'sem cliente'}) · *${statusDe(i) || 'sem status'}*\n  🔗 ${linkDaAtividade(i.id)}`).join('\n') : '\n\nTudo certo no fim de semana. 👏');
}

// Ranking: cada peça entra uma vez por pessoa, pela primeira vez que chegou a "Para aprovação" ou a um status final na
// semana; no prazo = nesse dia ou antes do prazo da equipe. Alterações = idas para "Alteração" na semana.
export function mensagemRanking(eventos, dia) {
  const segunda = somarDias(dia, -((new Date(dia + 'T12:00:00Z').getUTCDay() + 6) % 7));
  const porPessoa = new Map(), vistos = new Set();
  const de = (nome) => { if (!porPessoa.has(nome)) porPessoa.set(nome, { entregas: 0, noPrazo: 0, alteracoes: 0 }); return porPessoa.get(nome); };
  for (const e of eventos) {
    const para = normal(e.para);
    for (const nome of e.responsaveis || []) {
      const p = de(primeiro(nome));
      if (para.includes('altera')) { p.alteracoes++; continue; }
      if (!(para === 'para aprovacao' || e.final) || vistos.has(nome + '|' + e.conteudo_id)) continue;
      vistos.add(nome + '|' + e.conteudo_id); p.entregas++;
      if (!e.prazo || String(e.em).slice(0, 10) <= String(e.prazo).slice(0, 10)) p.noPrazo++;
    }
  }
  const linhas = [...porPessoa.entries()].filter(([, p]) => p.entregas).sort((a, b) => b[1].entregas - a[1].entregas);
  if (!linhas.length) return null;
  const pct = (p) => Math.round((p.noPrazo / p.entregas) * 100);
  const mais = linhas[0][0], prazo = linhas.filter(([, p]) => p.entregas >= 3 && pct(p) === 100).map(([n]) => n), zero = linhas.filter(([, p]) => p.entregas >= 3 && !p.alteracoes).map(([n]) => n);
  return `🏆 *Semana do time (${curto(segunda)} a ${curto(dia)})*\n\n` + linhas.map(([n, p], k) => `${['🥇', '🥈', '🥉'][k] || '▫️'} ${n}: ${p.entregas} entregas · ${pct(p)}% no prazo${p.alteracoes ? ` · ${p.alteracoes} alteração(ões)` : ''}`).join('\n') +
    `\n\n👏 Mais entregas: *${mais}*` + (prazo.length ? `\n⏱️ 100% no prazo: *${prazo.join(', ')}*` : '') + (zero.length ? `\n🎯 Sem nenhuma alteração: *${zero.join(', ')}*` : '') + '\n\nBom fim de semana, time! 🧡';
}

export async function acompanhamento(sql, { tipo, dia }) {
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new TypeError('Dia inválido.');
  const { ctx } = codigoDoPainel(), statusDe = (i) => ctx.operationalFlowStatus(i);
  if (tipo === 'ranking') {
    const segunda = somarDias(dia, -((new Date(dia + 'T12:00:00Z').getUTCDay() + 6) % 7));
    const eventos = await sql`SELECT e.conteudo_id::text, e.para, e.em::text, c.prazo::text AS prazo,
        EXISTS (SELECT 1 FROM vybe_status s WHERE s.board_id = c.board_id AND s.rotulo = e.para AND s.final) AS final,
        COALESCE(ARRAY(SELECT p.nome FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id = c.id), '{}') AS responsaveis
      FROM vybe_conteudo_eventos e JOIN vybe_conteudos c ON c.id = e.conteudo_id
      WHERE e.tipo = 'status' AND c.removido_em IS NULL AND e.em >= ${segunda}::date AND e.em < ${somarDias(dia, 1)}::date
      ORDER BY e.em`;
    return { texto: mensagemRanking(eventos, dia) };
  }
  const itens = await itensDoDia(sql, dia);
  if (tipo === 'aguardando_cliente') return { texto: mensagemAguardandoCliente(itens, dia, statusDe) };
  if (tipo === 'plantao') return { texto: mensagemPlantao(itens, dia, statusDe) };
  if (tipo === 'fim_de_semana') return { texto: mensagemFimDeSemana(itens, dia, statusDe) };
  throw new TypeError('Tipo inválido.');
}
