// Clientes cobrando nos quartos (brincadeira pedida pelo Paulo, 19/10/2026).
// Cada demanda em aberto que pede ação manda o cliente dela para o quarto de
// quem deve agir, com a mesma leitura de "próxima ação" do painel
// (riskActionOwner, vybe-risco.js). Todos que estão no quarto veem; sem limite
// (muita coisa atrasada vira protesto); sem exceção de foco.
//   atrasada: prazo vencido (1 dia já cobra)
//   hoje:     prazo hoje e já passou do meio-dia (Bahia)
//   vence:    prazo amanhã e a peça nem começou
//   agendar:  em "Para agendar" com a veiculação hoje ou já passada
//   lembrar_cliente: a demanda espera o cliente; ele vai ao quarto do head
//                    pedir para ser lembrado (não é cobrança ao time)
//   postar_parada: a veiculação chegou (hoje ou já passou) e a peça nem
//                  começou; o cliente vai ao quarto do head e de quem tem as
//                  funções agendamento e gestão dizer quem está com ela, para
//                  irem cobrar (Paulo, 20/10/2026)
//   marcar_gravacao: em "Aguardo", que é esperar marcar a gravação com o
//                    cliente (Paulo, 20/10/2026: "não é que ele tem que
//                    mandar algo"); o cliente lembra o head de marcar
// Uma peça com vários clientes manda um cliente de cada.
import { diaBahia, somarDias } from './escritorio-pontos.js';

const CLIENTE_DEVE = ['ag_info_cliente', 'ag_aprovacao_cliente', 'aguardando_info', 'falta_info'];
const MARCAR_GRAVACAO = ['aguardo'];
const APROVACAO_INTERNA = ['para_aprovacao', 'em_aprovacao', 'falta_d_a'];
const NAO_COMECOU = ['pode_fazer', 'a_fazer', 'nova_demanda'];
const horaBahia = (agora) => Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', hour12: false }).format(agora));
const diasEntre = (de, ate) => Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 864e5);

export async function cobrancasDaEquipe(sql, agora = new Date()) {
  const hoje = diaBahia(agora), amanha = somarDias(hoje, 1), tarde = horaBahia(agora) >= 12;
  const linhas = await sql`SELECT c.id, c.monday_item_id, c.board_id, c.titulo, c.status_chave, s.rotulo AS status, COALESCE(s.final,false) AS final,
      TO_CHAR(c.prazo,'YYYY-MM-DD') AS prazo, TO_CHAR(c.veiculacao,'YYYY-MM-DD') AS veiculacao,
      cl.id AS cliente_id, cl.nome AS cliente, cl.segmento, cl.identidade->'personagem' AS personagem,
      COALESCE(ARRAY(SELECT r.pessoa_id::text FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id=c.id), '{}') AS responsaveis,
      COALESCE(ARRAY(SELECT h.pessoa_id::text FROM vybe_cliente_pessoas h WHERE h.cliente_id=cl.id), '{}') AS heads,
      COALESCE(ARRAY(SELECT p.nome FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id=r.pessoa_id WHERE r.conteudo_id=c.id ORDER BY r.ordem), '{}') AS com
    FROM vybe_conteudos c
    JOIN vybe_conteudo_clientes v ON v.conteudo_id=c.id
    JOIN vybe_clientes cl ON cl.id=v.cliente_id
    LEFT JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
    WHERE c.removido_em IS NULL
      AND (NOT COALESCE(s.final,false) OR (c.status_chave='para_agendar' AND c.veiculacao <= ${hoje}::date))
      AND (COALESCE(c.prazo, c.veiculacao) <= ${amanha}::date OR c.veiculacao <= ${hoje}::date)`;
  const [da] = await sql`SELECT id::text FROM vybe_pessoas WHERE ativo IS NOT FALSE AND nome ILIKE 'Deivid%' ORDER BY id LIMIT 1`;
  const agendamento = (await sql`SELECT pessoa_id::text AS id FROM vybe_escritorio_funcoes WHERE funcao='agendamento'`).map((p) => p.id);
  const gestao = (await sql`SELECT pessoa_id::text AS id FROM vybe_escritorio_funcoes WHERE funcao='gestao'`).map((p) => p.id);
  const por = new Map();
  // Uma peça aparece uma vez por pessoa: a primeira regra que pegou fica.
  const cobrar = (ids, item) => { for (const id of new Set(ids)) { if (!por.has(id)) por.set(id, []); if (!por.get(id).some((x) => x.ref === item.ref && x.cliente_id === item.cliente_id)) por.get(id).push(item); } };
  for (const l of linhas) {
    const base = { ref: l.monday_item_id ? String(l.monday_item_id) : 'vybe:' + l.id, quadro: String(l.board_id) === '8385559107' ? 'demandas' : 'producao',
      titulo: l.titulo || 'Sem título', status: l.status || '', status_chave: l.status_chave || '', cliente_id: String(l.cliente_id), cliente: l.cliente, segmento: l.segmento || null, personagem: l.personagem || null, com: l.com || [] };
    const heads = l.heads.length ? l.heads : gestao;
    if (l.status_chave === 'para_agendar') {
      if (l.veiculacao && l.veiculacao <= hoje) cobrar(agendamento, { ...base, tipo: 'agendar', data: l.veiculacao, dias: diasEntre(l.veiculacao, hoje) });
      continue;
    }
    // As regras do prazo vêm primeiro (cobram quem executa); depois, se a
    // veiculação chegou e a peça nem começou, o head também é avisado.
    const peloPrazo = () => {
      if (!l.prazo || l.final) return;
      const dias = diasEntre(l.prazo, hoje);
      if (MARCAR_GRAVACAO.includes(l.status_chave)) return cobrar(heads, { ...base, tipo: 'marcar_gravacao', data: l.prazo, dias });
      if (CLIENTE_DEVE.includes(l.status_chave)) return cobrar(heads, { ...base, tipo: 'lembrar_cliente', data: l.prazo, dias });
      const tipo = l.prazo < hoje ? 'atrasada' : l.prazo === hoje ? (tarde ? 'hoje' : null) : l.prazo === amanha && NAO_COMECOU.includes(l.status_chave) ? 'vence' : null;
      if (!tipo) return;
      const quem = !l.responsaveis.length ? heads : APROVACAO_INTERNA.includes(l.status_chave) && da ? [da.id] : l.responsaveis;
      cobrar(quem, { ...base, tipo, data: l.prazo, dias, sem_responsavel: !l.responsaveis.length });
    };
    peloPrazo();
    if (!l.final && l.veiculacao && l.veiculacao <= hoje && NAO_COMECOU.includes(l.status_chave)) {
      // Também vai a quem cuida do dia a dia do que posta e entrega: as
      // funções agendamento e gestão da tabela (Paulo, 20/10/2026: Tainara e
      // Paulo), além do head do cliente.
      cobrar([...heads, ...agendamento, ...gestao], { ...base, tipo: 'postar_parada', data: l.veiculacao, dias: diasEntre(l.veiculacao, hoje), sem_responsavel: !l.responsaveis.length });
    }
  }
  for (const lista of por.values()) lista.sort((a, b) => b.dias - a.dias || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  return por;
}
export async function cobrancasDaPessoa(sql, pessoaId, agora = new Date()) {
  return (await cobrancasDaEquipe(sql, agora)).get(String(pessoaId)) || [];
}
