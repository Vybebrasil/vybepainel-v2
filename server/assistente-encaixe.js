// Encaixe de captação (Paulo, 27/10/2026): cruza a agenda do Google (a mesma do módulo de Captações) com as peças paradas
// em "Agendar Captação" e sugere horários livres nos próximos dias úteis, dois clientes por janela de 2 horas (1 hora
// cada), começando por quem veicula antes. Marcar na agenda é uma ação com SIM (acao 'agendar_captacao').
import { agendaDeCaptacoes, criarEvento, CAPTACAO } from './captacoes.js';

const JANELAS = [['08:00', '10:00'], ['10:00', '12:00'], ['14:00', '16:00'], ['16:00', '18:00']];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const somarDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const curto = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const meio = (a, b) => { const m = (Number(a.slice(0, 2)) + Number(b.slice(0, 2))) / 2; return String(m).padStart(2, '0') + ':00'; };

export function sugerirEncaixes({ dia, eventos, pecas, maximo = 3 }) {
  const porCliente = new Map();
  for (const p of pecas) { const k = p.cliente_id; if (!porCliente.has(k)) porCliente.set(k, { cliente_id: k, cliente: p.cliente, pecas: [], primeira: p.veiculacao || '9999' }); const x = porCliente.get(k); x.pecas.push(p); if ((p.veiculacao || '9999') < x.primeira) x.primeira = p.veiculacao; }
  const fila = [...porCliente.values()].sort((a, b) => a.primeira.localeCompare(b.primeira));
  if (!fila.length) return [];
  const ocupado = (d, ini, fim) => eventos.some((e) => e.dia === d && (!e.inicio || (e.inicio < fim && (e.fim || '23:59') > ini)));
  const sugestoes = [];
  for (let k = 1; k <= 10 && sugestoes.length < maximo && fila.length; k++) {
    const d = somarDias(dia, k), wd = new Date(d + 'T12:00:00Z').getUTCDay();
    if (wd === 0 || wd === 6) continue;
    for (const [ini, fim] of JANELAS) {
      if (sugestoes.length >= maximo || !fila.length) break;
      if (ocupado(d, ini, fim)) continue;
      const clientes = fila.splice(0, 2);
      const m = meio(ini, fim);
      sugestoes.push({ dia: d, inicio: ini, fim, clientes: clientes.map((c, i) => ({ cliente_id: c.cliente_id, cliente: c.cliente, pecas: c.pecas.length, inicio: i ? m : ini, fim: clientes.length > 1 && !i ? m : fim })) });
    }
  }
  return sugestoes;
}
export function mensagemEncaixe(sugestoes, totalPecas) {
  if (!sugestoes.length) return null;
  return `🎬 *Encaixe de captação*\n${totalPecas} peça(s) esperando gravação.\n\n` + sugestoes.map((s, i) =>
    `${i + 1}. *${SEMANA[new Date(s.dia + 'T12:00:00Z').getUTCDay()]} ${curto(s.dia)} · ${s.inicio.slice(0, 2)}h às ${s.fim.slice(0, 2)}h* → ` +
    s.clientes.map((c) => `${c.cliente} (${c.pecas} peça${c.pecas > 1 ? 's' : ''}, ${c.inicio.slice(0, 2)}h)`).join(' + ') + ` · cód ${s.dia}|${s.clientes.map((c) => c.cliente_id + '@' + c.inicio + '-' + c.fim).join(',')}`).join('\n') +
    '\n\nResponda citando esta mensagem com o número (ex.: *1*) que eu marco na agenda (com SIM).';
}
export async function encaixeCaptacao(sql, dia, { listar } = {}) {
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new TypeError('Dia inválido.');
  const pecas = await sql`SELECT c.id::text AS id, c.titulo, c.veiculacao::text AS veiculacao, cl.id::text AS cliente_id, cl.nome AS cliente
    FROM vybe_conteudos c JOIN vybe_conteudo_clientes cc ON cc.conteudo_id = c.id JOIN vybe_clientes cl ON cl.id = cc.cliente_id
    LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE c.removido_em IS NULL AND c.captacao_chave = ${CAPTACAO.pronta} AND NOT COALESCE(s.final, false)
    ORDER BY c.veiculacao NULLS LAST LIMIT 60`;
  if (!pecas.length) return { texto: null };
  const eventos = await agendaDeCaptacoes(sql, { inicio: somarDias(dia, 1), dias: 10, hoje: dia, ...(listar ? { listar } : {}) });
  return { texto: mensagemEncaixe(sugerirEncaixes({ dia, eventos, pecas }), pecas.length) };
}
// Marca na agenda os eventos de uma sugestão (um por cliente). Chamado pela ação confirmada.
export async function marcarEncaixe(sql, quem, codigo, opcoes = {}) {
  const [dia, lista] = String(codigo || '').split('|');
  const feitos = [];
  for (const x of String(lista || '').split(',').filter(Boolean)) {
    const [id, horas] = x.split('@'); const [inicio, fim] = String(horas || '').split('-');
    await criarEvento(sql, quem, { tipo: 'captacao', titulo: 'Gravação', dia, inicio, fim, cliente_id: id }, opcoes);
    feitos.push(id);
  }
  return feitos.length;
}
