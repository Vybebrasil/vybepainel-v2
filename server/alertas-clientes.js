// Alertas dos agentes do Centro de Operação (pedido do Paulo, 19/10/2026):
// cada cliente avisa o que pede atenção nas peças em aberto vinculadas a ele.
//   sem_info:   status de falta de informação, sem briefing, sem prazo ou sem responsável
//   atrasadas:  prazo vencido há mais de 2 dias
//   aprovar:    paradas num status de aprovação (interna ou do cliente)
// Uma peça com vários clientes aparece em cada um (vínculo em vybe_conteudo_clientes).
import { diaBahia, somarDias } from './escritorio-pontos.js';

const SEM_INFO = ['falta_info', 'ag_info_cliente', 'aguardando_info', 'falta_off', 'falta_d_a'];
const APROVAR = ['para_aprovacao', 'em_aprovacao', 'ag_aprovacao_cliente'];
const LIMITE = 8;

export async function alertasDosClientes(sql, { clienteIds = null, agora = new Date() } = {}) {
  const hoje = diaBahia(agora), atraso = somarDias(hoje, -2);
  const linhas = await sql`SELECT v.cliente_id, c.id, c.monday_item_id, c.board_id, c.titulo, c.status_chave, s.rotulo AS status,
      TO_CHAR(c.prazo,'YYYY-MM-DD') AS prazo, COALESCE(NULLIF(trim(c.briefing),''),'') <> '' AS tem_briefing,
      EXISTS(SELECT 1 FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id=c.id) AS tem_responsavel
    FROM vybe_conteudo_clientes v
    JOIN vybe_conteudos c ON c.id=v.conteudo_id
    LEFT JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
    WHERE c.removido_em IS NULL AND NOT COALESCE(s.final,false)
      AND (${clienteIds}::bigint[] IS NULL OR v.cliente_id = ANY(${clienteIds}::bigint[]))
    ORDER BY c.prazo NULLS LAST, c.id`;
  const por = new Map();
  const de = (id) => {
    if (!por.has(id)) por.set(id, { sem_info: [], atrasadas: [], aprovar: [], total: 0 });
    return por.get(id);
  };
  for (const l of linhas) {
    const item = { ref: l.monday_item_id ? String(l.monday_item_id) : 'vybe:' + l.id, quadro: String(l.board_id) === '8385559107' ? 'demandas' : 'producao',
      titulo: l.titulo || 'Sem título', status: l.status || '', prazo: l.prazo };
    const a = de(String(l.cliente_id));
    const faltas = [SEM_INFO.includes(l.status_chave) && (l.status || 'falta informação'), !l.tem_briefing && 'sem briefing',
      !l.prazo && 'sem prazo', !l.tem_responsavel && 'sem responsável'].filter(Boolean);
    if (faltas.length) a.sem_info.push({ ...item, motivo: faltas.join(', ') });
    if (l.prazo && l.prazo < atraso) a.atrasadas.push(item);
    if (APROVAR.includes(l.status_chave)) a.aprovar.push(item);
  }
  for (const a of por.values()) {
    a.total = a.sem_info.length + a.atrasadas.length + a.aprovar.length;
    for (const k of ['sem_info', 'atrasadas', 'aprovar']) { a[k + '_total'] = a[k].length; a[k] = a[k].slice(0, LIMITE); }
  }
  return por;
}
