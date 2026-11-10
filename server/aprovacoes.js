// Aprovações: o que está parado esperando alguém aprovar (Paulo, 09/11/2026).
//
// "Não pode virar um gargalo." Planejamentos feitos nos chats do Claude e peças esperam a aprovação interna (o head
// do cliente; a arte, o Deivid) e depois a do cliente. Cada head vê primeiro os clientes dele, com a opção de ver
// todos; os sócios (Paulo, Deivid) veem a agência inteira; o Deivid vê também toda peça "Para aprovação" (card, foto,
// vídeo) para aprovar a arte. A mesma lista alimenta o bloco do Seu dia e a cobrança do Augusto no WhatsApp.
//
// Só leitura. Nada aqui aprova, cadastra ou avisa: isso continua nos fluxos de sempre (vybe-planejamentos.js, peça).

import { ehDonoPessoa, mondayDaPessoa } from './donos.js';
import { BOARD_DEMANDAS } from './grupos.js';

export const DEIVID_MONDAY = '68997024'; // diretor de arte (server/donos.js DONOS_MONDAY)
const INTERNA = ['para_aprovacao', 'em_aprovacao'];
const DO_CLIENTE = ['ag_aprovacao_cliente'];
// Planejamento: revisar/ajustes = depende do head; enviado = com o cliente; aprovado = falta cadastrar as peças.
const PLANO_ETAPA = { revisar: 'interna', ajustes: 'interna', enviado: 'cliente', aprovado: 'cadastrar' };

const iso = (v) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
export const horasDesde = (quando, agora = new Date()) => {
  const t = Date.parse(iso(quando) || '');
  return Number.isFinite(t) ? Math.max(0, Math.round((agora.getTime() - t) / 36e5)) : null;
};

async function tabelaExiste(sql, nome) {
  try { const [r] = await sql`SELECT to_regclass(${'public.' + nome}) IS NOT NULL AS ok`; return Boolean(r?.ok); } catch { return false; }
}

// Uma lista só, já com "meu" (cliente da carteira de quem pediu) e as horas paradas.
export async function aprovacoesDaPessoa(sql, pessoa, { env = process.env, agora = new Date() } = {}) {
  const dono = ehDonoPessoa(pessoa, env);
  const monday = String(pessoa?.monday_user_id ?? pessoa?.monday_id ?? '') || (pessoa?.id ? await mondayDaPessoa(sql, pessoa.id) : '');
  const diretorArte = monday === DEIVID_MONDAY;
  const meus = new Set((await sql`SELECT cliente_id::text AS id FROM vybe_cliente_pessoas WHERE pessoa_id = ${Number(pessoa?.id) || 0}`).map((r) => r.id));
  const heads = new Map();
  for (const r of await sql`SELECT cp.cliente_id::text AS cliente, p.id::text AS id, p.nome FROM vybe_cliente_pessoas cp JOIN vybe_pessoas p ON p.id = cp.pessoa_id ORDER BY cp.ordem, p.nome`) {
    if (!heads.has(r.cliente)) heads.set(r.cliente, []);
    heads.get(r.cliente).push({ id: r.id, nome: String(r.nome || '').split(' ')[0] });
  }
  // Quem não é sócio vê só a própria carteira (e o diretor de arte, as peças para aprovar a arte).
  const pode = (clienteId, etapa) => dono || meus.has(String(clienteId)) || (diretorArte && etapa === 'interna');

  const planejamentos = [];
  if (await tabelaExiste(sql, 'vybe_planejamentos')) {
    const linhas = await sql`SELECT p.id::text AS id, p.cliente_id::text AS cliente_id, c.nome AS cliente, TO_CHAR(p.mes, 'YYYY-MM') AS mes,
        p.titulo, p.estado, p.versao, p.origem, p.atualizado_em, p.enviado_em, p.respondido_em,
        jsonb_array_length(COALESCE(p.conteudo->'pecas', '[]'::jsonb)) AS pecas
      FROM vybe_planejamentos p JOIN vybe_clientes c ON c.id = p.cliente_id
      WHERE p.estado IN ('revisar', 'ajustes', 'enviado', 'aprovado') AND c.apagado_em IS NULL AND COALESCE(c.ativo, true)
      ORDER BY p.atualizado_em`;
    for (const p of linhas) {
      const etapa = PLANO_ETAPA[p.estado];
      if (!pode(p.cliente_id, etapa === 'interna' ? 'plano' : etapa)) continue;
      const desde = p.estado === 'enviado' ? p.enviado_em : p.estado === 'aprovado' ? p.respondido_em : p.atualizado_em;
      planejamentos.push({ tipo: 'planejamento', id: p.id, cliente_id: p.cliente_id, cliente: p.cliente, mes: p.mes, titulo: p.titulo || 'Planejamento',
        estado: p.estado, etapa, versao: p.versao, origem: p.origem, pecas: Number(p.pecas) || 0, desde: iso(desde), horas: horasDesde(desde || p.atualizado_em, agora),
        heads: heads.get(p.cliente_id) || [], meu: meus.has(p.cliente_id) });
    }
  }

  const pecas = [];
  const linhas = await sql`SELECT c.id::text AS id, c.monday_item_id, c.board_id, c.titulo, c.formato, c.status_chave, s.rotulo AS status,
      c.status_em, TO_CHAR(c.veiculacao, 'YYYY-MM-DD') AS veiculacao, TO_CHAR(c.prazo, 'YYYY-MM-DD') AS prazo,
      COALESCE((SELECT ARRAY_AGG(v.cliente_id::text) FROM vybe_conteudo_clientes v WHERE v.conteudo_id = c.id), '{}') AS clientes_ids,
      COALESCE((SELECT STRING_AGG(cl.nome, ', ') FROM vybe_conteudo_clientes v JOIN vybe_clientes cl ON cl.id = v.cliente_id WHERE v.conteudo_id = c.id), '') AS clientes
    FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE c.removido_em IS NULL AND c.status_chave = ANY(${[...INTERNA, ...DO_CLIENTE]}::text[])
    ORDER BY c.status_em NULLS FIRST, c.id`;
  for (const c of linhas) {
    const etapa = DO_CLIENTE.includes(c.status_chave) ? 'cliente' : 'interna';
    const ids = (c.clientes_ids || []).map(String);
    if (!ids.some((id) => pode(id, etapa)) && !(dono && !ids.length)) continue;
    const quadro = String(c.board_id) === String(BOARD_DEMANDAS) ? 'demandas' : 'producao';
    pecas.push({ tipo: 'peca', id: c.id, ref: c.monday_item_id ? String(c.monday_item_id) : 'vybe:' + c.id, quadro, titulo: c.titulo || 'Sem título',
      formato: c.formato || '', status: c.status || c.status_chave, etapa, cliente: c.clientes, clientes_ids: ids,
      veiculacao: c.veiculacao, prazo: c.prazo, desde: iso(c.status_em), horas: horasDesde(c.status_em, agora),
      heads: ids.flatMap((id) => heads.get(id) || []).filter((h, i, a) => a.findIndex((x) => x.id === h.id) === i),
      meu: ids.some((id) => meus.has(id)) });
  }
  return { ok: true, eu: { id: String(pessoa?.id || ''), dono, diretor_arte: diretorArte, clientes: [...meus] }, planejamentos, pecas };
}

// Passou do prazo: 24 h na aprovação interna, 48 h com o cliente, 24 h aprovado sem cadastrar (a cobrança do Augusto).
export const LIMITE_HORAS = Object.freeze({ interna: 24, cliente: 48, cadastrar: 24 });
export const atrasado = (item) => item.horas != null && item.horas >= (LIMITE_HORAS[item.etapa] ?? 24);
