import { listarConteudos } from '../vybe_dominio_store.js';
const BOARD_ID = 7829537690;
// Os sinais saem do banco da Vybe. Antes cada chamada varria o board inteiro no
// Monday, página por página — caro, lento, e mantinha vivo o último consumidor
// que dependia dele.
const FINISHED_STATUSES = new Set(['Finalizado', 'Feito', 'Concluído', 'Concluido']);
const EXTERNAL_STATUSES = new Set(['Para aprovação', 'Ag. Aprovação Cliente', 'Falta Info', 'Ag. Info Cliente', 'Aguardo', 'Alteração']);
const INTERNAL_STATUSES = new Set(['Falta D.A', 'Ag. Interno', 'Cap. Agendada', 'Agendando Cap', 'Falta OFF', 'Aguardo Redação', 'Segurar Post']);
const READY_STATUSES = new Set(['Para agendar', 'Agendado']);

function isoToday() { const now = new Date(); const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }); return formatter.format(now); }
function plainText(value = '') { return String(value).replace(/<\/(p|div|li|br)>/gi, '\n').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim(); }
function line(text, label) { const match = String(text || '').match(new RegExp(`(?:^|\\n)${label}:\\s*([^\\n]+)`, 'i')); return match ? match[1].trim() : ''; }
function latestContext(updates = []) { const update = updates.find((entry) => String(entry.body || '').includes('Vybe OS · Contexto de status')); if (!update) return null; const text = plainText(update.body); return { reason: line(text, 'Motivo'), next_step: line(text, 'Próximo passo'), stage: line(text, 'Etapa'), created_at: update.created_at || '' }; }
function colMap(item) { return (item.column_values || []).reduce((map, col) => { map[col.id] = { text: col.text || '', value: col.value || '' }; return map; }, {}); }
function firstClient(raw) { return String(raw || '').split(',').map((client) => client.trim()).filter(Boolean)[0] || 'Sem cliente'; }
function addClient(map, client) { if (!map.has(client)) { map.set(client, { client, open: 0, overdue: 0, due_today: 0, external_dependencies: 0, internal_dependencies: 0, changes: 0, ready: 0, without_owner: 0, contextualized: 0, representative_items: [] }); } return map.get(client); }
function addTeam(map, responsible, item) { const names = String(responsible || '').split(',').map((name) => name.trim()).filter(Boolean); if (!names.length) return; names.forEach((name) => { if (!map.has(name)) map.set(name, { responsible: name, open: 0, overdue: 0, external_dependencies: 0, critical: 0 }); const member = map.get(name); member.open += 1; if (item.overdue) member.overdue += 1; if (item.external) member.external_dependencies += 1; if (item.overdue || item.due_today) member.critical += 1; }); }
// Devolve os itens na forma que o agregador abaixo já sabe ler. Traduzir aqui é
// mais barato que reescrever a agregação — e evita duas contas divergindo.
async function fetchItems() {
  const { status, pessoas, itens } = await listarConteudos();
  const rotulo = new Map(status.map((s) => [s.chave, s.rotulo]));
  const nome = new Map(pessoas.map((p) => [String(p.id), p.nome]));

  return itens.map((item) => {
    const clientes = item.clientes && item.clientes.length ? item.clientes : [item.cliente].filter(Boolean);
    const responsaveis = (item.responsavel_ids || []).map((id) => nome.get(String(id))).filter(Boolean);
    return {
      id: item.id,
      name: item.nome || '',
      updates: item.contexto_status ? [item.contexto_status] : [],
      column_values: [
        { id: 'lista_suspensa_mkmqnjbv', text: clientes.join(', '), value: null },
        { id: 'status', text: rotulo.get(item.status_chave) || '', value: null },
        { id: 'person', text: responsaveis.join(', '), value: null },
        { id: 'data', text: item.prazo_iso || '', value: null },
      ],
    };
  });
}

export default async function handler(req, res) { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300'); if (req.method === 'OPTIONS') return res.status(200).end(); if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' }); try { const today = isoToday(); const clients = new Map(); const team = new Map(); const totals = { open: 0, overdue: 0, due_today: 0, external_dependencies: 0, internal_dependencies: 0, changes: 0, ready: 0, without_owner: 0, contextualized: 0 }; const items = await fetchItems(); items.forEach((item) => { const columns = colMap(item); const client = firstClient(columns.lista_suspensa_mkmqnjbv?.text); const status = columns.status?.text || 'Sem status'; if (!columns.lista_suspensa_mkmqnjbv?.text || FINISHED_STATUSES.has(status)) return; const due = String(columns.data?.text || '').slice(0, 10); const overdue = Boolean(due && due < today); const dueToday = Boolean(due && due === today); const external = EXTERNAL_STATUSES.has(status); const internal = INTERNAL_STATUSES.has(status); const change = status === 'Alteração'; const ready = READY_STATUSES.has(status); const responsible = columns.person?.text || ''; const context = latestContext(item.updates || []); const entry = { id: String(item.id), title: item.name || '', status, due, overdue, due_today: dueToday, external, internal, context: context ? { reason: context.reason, next_step: context.next_step } : null }; const aggregate = addClient(clients, client); aggregate.open += 1; totals.open += 1; if (overdue) { aggregate.overdue += 1; totals.overdue += 1; } if (dueToday) { aggregate.due_today += 1; totals.due_today += 1; } if (external) { aggregate.external_dependencies += 1; totals.external_dependencies += 1; } if (internal) { aggregate.internal_dependencies += 1; totals.internal_dependencies += 1; } if (change) { aggregate.changes += 1; totals.changes += 1; } if (ready) { aggregate.ready += 1; totals.ready += 1; } if (!responsible) { aggregate.without_owner += 1; totals.without_owner += 1; } if (context) { aggregate.contextualized += 1; totals.contextualized += 1; } if (overdue || external || internal || change) aggregate.representative_items.push(entry); addTeam(team, responsible, entry); }); const clientList = [...clients.values()].map((client) => ({ ...client, representative_items: client.representative_items.slice(0, 5) })).sort((a, b) => (b.overdue + b.external_dependencies + b.internal_dependencies) - (a.overdue + a.external_dependencies + a.internal_dependencies) || b.open - a.open); const teamList = [...team.values()].sort((a, b) => b.critical - a.critical || b.open - a.open); return res.status(200).json({ schema_version: '1.0', source: 'vybe-painel-v2', origem_dados: 'banco-vybe', generated_at: new Date().toISOString(), reference_date: today, totals, clients: clientList, team: teamList, usage: 'Sinais agregados para o Vybe Nexus. Não altera status nem substitui a fila operacional do Vybe Painel.' }); } catch (error) { return res.status(500).json({ error: error.message || 'Falha ao gerar sinais operacionais' }); } }
