// Redistribuição real da Produção para o Heitor (Coordenação de Produção, agente do VYBES; Paulo, 09/11/2026: "ele
// aprende com a redistribuição que o time vai fazendo"). Lê os eventos 'responsavel' que o Vybe OS já grava quando o
// responsável muda (server/responsaveis.js substituirResponsaveis e as automações): de quem, para quem, quando e QUEM
// trocou. Só leitura, só a Produção, últimos N dias (até 60), no máximo 500 eventos.
import { BOARD_PRODUCAO } from './grupos.js';

export async function redistribuicoes(sql, { dias = 30 } = {}) {
  const n = Math.min(60, Math.max(1, Number.parseInt(dias, 10) || 30));
  const eventos = await sql`
    SELECT e.conteudo_id::text AS conteudo_id, COALESCE(c.monday_item_id::text, 'vybe:' || c.id) AS ref, c.titulo, c.formato,
      c.prazo::text AS prazo, c.veiculacao::text AS veiculacao, e.de, e.para, e.em, e.texto AS origem,
      a.nome AS autor, a.monday_user_id::text AS autor_monday_id,
      (SELECT cl.nome FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id WHERE cc.conteudo_id = c.id ORDER BY cl.nome LIMIT 1) AS cliente
    FROM vybe_conteudo_eventos e
    JOIN vybe_conteudos c ON c.id = e.conteudo_id
    LEFT JOIN vybe_pessoas a ON a.id = e.autor_id
    WHERE e.tipo = 'responsavel' AND c.board_id = ${BOARD_PRODUCAO} AND c.removido_em IS NULL
      AND e.em >= NOW() - make_interval(days => ${n})
    ORDER BY e.em ASC LIMIT 500`;
  const nomes = (t) => (!t || /^sem respons/i.test(String(t)) ? [] : String(t).split(',').map((s) => s.trim()).filter(Boolean));
  return {
    dias: n,
    eventos: eventos.map((e) => ({
      conteudo_id: e.conteudo_id, ref: e.ref, titulo: e.titulo, formato: e.formato || '', cliente: e.cliente || '',
      prazo: e.prazo, veiculacao: e.veiculacao, de: nomes(e.de), para: nomes(e.para),
      em: e.em instanceof Date ? e.em.toISOString() : String(e.em), autor: e.autor || (e.origem === 'automacao' ? 'automação' : ''),
      autor_monday_id: e.autor_monday_id || '',
    })),
  };
}
