// Dia de cada pessoa: o balão da mesa e a janela Dia da equipe (Paulo,
// 22/10/2026: "a gente como Head tem muita dificuldade de saber o que o time
// fez no dia, deixou de fazer"). Todos veem o de todos.
//   para o dia: conteúdo ou demanda da pessoa com o prazo no dia (sem prazo,
//               a veiculação), dos dois quadros;
//   adiada:     o prazo ou a veiculação saiu do dia (histórico de datas em
//               vybe_conteudo_eventos), mudado na véspera ou depois;
//   finalizada: a entrega da pessoa naquele dia (vybe_escritorio_entregas, a
//               mesma do ranking) ou, sem ela, o dia em que o status virou
//               final. A coluna "Conclusão" das demandas é uma data
//               planejada, não o dia em que a peça ficou pronta.
// O status sai como está no painel (Para agendar e Agendado não viram
// "publicado"); "pronta" é o status final da tabela vybe_status.
import { diaBahia, somarDias } from './escritorio-pontos.js';

export function diaUtilAntes(iso) {
  let d = somarDias(iso, -1);
  while ([0, 6].includes(new Date(d + 'T12:00:00Z').getUTCDay())) d = somarDias(d, -1);
  return d;
}
const FAZENDO = /^em (andamento|execu)/i;

export async function diaDaEquipe(sql, agora = new Date()) {
  const hoje = diaBahia(agora), ontem = diaUtilAntes(hoje), vespera = somarDias(ontem, -1);
  const [pecas, entregas] = await Promise.all([
    sql`WITH adiadas AS (
        SELECT DISTINCT ON (e.conteudo_id, e.tipo, e.de) e.conteudo_id, e.tipo, e.de, e.para
        FROM vybe_conteudo_eventos e
        WHERE e.tipo IN ('prazo','veiculacao') AND e.de IN (${hoje}, ${ontem}) AND e.para IS DISTINCT FROM e.de
          AND vybe_dia_bahia(e.em) >= ${vespera}::date
        ORDER BY e.conteudo_id, e.tipo, e.de, e.em DESC),
      entregues AS (
        SELECT e.conteudo_id FROM vybe_escritorio_entregas e JOIN vybe_escritorio_regras g ON g.chave=e.regra AND g.entrega
        WHERE e.dia >= ${ontem}::date AND e.conteudo_id IS NOT NULL)
      SELECT c.id, c.monday_item_id, c.board_id, c.titulo, c.status_chave, s.rotulo AS status, COALESCE(s.final,false) AS final,
        TO_CHAR(c.prazo,'YYYY-MM-DD') AS prazo, TO_CHAR(c.veiculacao,'YYYY-MM-DD') AS veiculacao,
        COALESCE(ARRAY(SELECT r.pessoa_id::text FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id=c.id ORDER BY r.ordem), '{}') AS responsaveis,
        COALESCE(ARRAY(SELECT cl.nome FROM vybe_conteudo_clientes v JOIN vybe_clientes cl ON cl.id=v.cliente_id WHERE v.conteudo_id=c.id ORDER BY cl.nome), '{}') AS clientes,
        COALESCE((SELECT json_agg(json_build_object('tipo',a.tipo,'de',a.de,'para',a.para)) FROM adiadas a WHERE a.conteudo_id=c.id), '[]'::json) AS adiada,
        CASE WHEN COALESCE(s.final,false) THEN (SELECT TO_CHAR(vybe_dia_bahia(max(e.em)),'YYYY-MM-DD') FROM vybe_conteudo_eventos e WHERE e.conteudo_id=c.id AND e.tipo='status') END AS pronta_em
      FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
      WHERE c.removido_em IS NULL AND (
        (COALESCE(c.prazo, c.veiculacao) < ${hoje}::date AND NOT COALESCE(s.final,false))
        OR COALESCE(c.prazo, c.veiculacao) IN (${hoje}::date, ${ontem}::date)
        OR c.id IN (SELECT conteudo_id FROM adiadas) OR c.id IN (SELECT conteudo_id FROM entregues))`,
    sql`SELECT e.pessoa_id::text AS pessoa, e.conteudo_id::text AS conteudo, TO_CHAR(min(e.dia),'YYYY-MM-DD') AS dia
      FROM vybe_escritorio_entregas e JOIN vybe_escritorio_regras g ON g.chave=e.regra AND g.entrega
      WHERE e.dia >= ${ontem}::date AND e.conteudo_id IS NOT NULL GROUP BY 1, 2`,
  ]);
  const entregou = new Map(entregas.map((e) => [e.pessoa + ':' + e.conteudo, e.dia]));
  const pessoas = new Map();
  const daPessoa = (id) => {
    if (!pessoas.has(id)) pessoas.set(id, { hoje: [], ontem: [], atrasadas: [] });
    return pessoas.get(id);
  };
  for (const p of pecas) {
    const data = p.prazo || p.veiculacao;
    const base = {
      ref: p.monday_item_id ? String(p.monday_item_id) : 'vybe:' + p.id, quadro: String(p.board_id) === '8385559107' ? 'demandas' : 'producao',
      titulo: p.titulo || 'Sem título', clientes: p.clientes || [], status: p.status || '', prazo: p.prazo, veiculacao: p.veiculacao,
    };
    const quem = new Set([...(p.responsaveis || []), ...entregas.filter((e) => e.conteudo === String(p.id)).map((e) => e.pessoa)]);
    for (const pessoa of quem) {
      const feita = entregou.get(pessoa + ':' + p.id) || (p.final ? p.pronta_em || null : null);
      const estado = (dia) => (feita && feita <= dia ? 'pronta' : feita ? 'depois' : p.final ? 'pronta' : FAZENDO.test(p.status || '') ? 'fazendo' : 'falta');
      const lista = daPessoa(pessoa);
      for (const [dia, chave] of [[hoje, 'hoje'], [ontem, 'ontem']]) {
        const saiu = (p.adiada || []).find((a) => a.de === dia && data !== dia);
        const no = data === dia || feita === dia || saiu;
        if (!no || (!p.responsaveis?.includes(pessoa) && feita !== dia)) continue;
        lista[chave].push({ ...base, estado: estado(dia), pronta_em: feita, adiada: saiu && feita !== dia ? { campo: saiu.tipo, para: saiu.para || null } : null });
      }
      if (!p.final && data && data < hoje && p.responsaveis?.includes(pessoa) && !lista.hoje.some((x) => x.ref === base.ref)) lista.atrasadas.push({ ...base, estado: estado(hoje), pronta_em: null, adiada: null });
    }
  }
  const ordem = { fazendo: 0, falta: 1, depois: 2, pronta: 3 };
  for (const l of pessoas.values()) for (const k of ['hoje', 'ontem', 'atrasadas']) l[k].sort((a, b) => Boolean(a.adiada) - Boolean(b.adiada) || ordem[a.estado] - ordem[b.estado] || String(a.prazo || a.veiculacao || '').localeCompare(String(b.prazo || b.veiculacao || '')) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  return { hoje, ontem, pessoas: Object.fromEntries(pessoas) };
}
