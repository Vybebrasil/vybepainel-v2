// Marcos da ficha, calculados no servidor a partir das entregas, do XP e das
// metas (fase 2, docs/escritorio-pontos.md). Cada marco conquistado dá a
// conquista da tabela de regras (50 moedas e 50 XP) uma vez só e, quando o
// catálogo marca um móvel com o marco, põe o móvel no inventário da pessoa.
import { nivelPorXp, diaBahia, somarDias, diaDaSemana, STATUS_NA_MAO } from './escritorio-pontos.js';
// `origem` reaproveita as conquistas antigas do gatilho (quem já tem não ganha de novo).
export const MARCOS = [
  { id: 'primeira', nome: 'Primeira entrega', dica: 'Concluiu a primeira entrega', origem: 'conquista:primeira-demanda', ok: n => n.total >= 1 },
  { id: 'dez', nome: '10 entregas', dica: '10 entregas concluídas', origem: 'conquista:dez-demandas', ok: n => n.total >= 10 },
  { id: 'cinquenta', nome: '50 entregas', dica: '50 entregas concluídas', ok: n => n.total >= 50 },
  { id: 'cem', nome: '100 entregas', dica: '100 entregas concluídas', ok: n => n.total >= 100 },
  { id: 'duzentas', nome: '250 entregas', dica: '250 entregas concluídas', ok: n => n.total >= 250 },
  { id: 'quinhentas', nome: '500 entregas', dica: '500 entregas concluídas', ok: n => n.total >= 500 },
  { id: 'semfuro', nome: 'Mês sem furo', dica: '10 ou mais entregas no mês, todas dentro do prazo', ok: n => n.comPrazo >= 10 && n.emDia === n.comPrazo },
  { id: 'embalo', nome: 'Embalado', dica: '5 dias úteis seguidos com entrega', ok: n => n.seq >= 5 },
  { id: 'maratona', nome: 'Maratona', dica: '15 dias úteis seguidos com entrega', ok: n => n.seq >= 15 },
  { id: 'carteira', nome: 'Muitos clientes', dica: 'Entregou para 5 clientes diferentes no mês', ok: n => n.clientes >= 5 },
  { id: 'zerado', nome: 'Fila em dia', dica: 'Já entregou e não tem demanda vencida agora', ok: n => n.total >= 1 && n.vencidas === 0 },
  { id: 'nivel5', nome: 'Nível 5', dica: 'Chegou ao nível 5 pelo XP', ok: n => n.nivel >= 5 },
  { id: 'nivel10', nome: 'Nível 10', dica: 'Chegou ao nível 10 pelo XP', ok: n => n.nivel >= 10 },
  { id: 'nivel20', nome: 'Nível 20', dica: 'Chegou ao nível 20 pelo XP', ok: n => n.nivel >= 20 },
  { id: 'nivel30', nome: 'Nível 30', dica: 'Chegou ao nível 30 pelo XP', ok: n => n.nivel >= 30 },
  { id: 'meta4', nome: 'Meta em dia', dica: 'Bateu a meta da semana 4 vezes', ok: n => n.metas >= 4 },
  { id: 'quarto', nome: 'Meu quarto', dica: 'Montou o próprio quarto', origem: 'conquista:meu-quarto', ok: n => n.quarto },
  // Conquistas por fazer as coisas (Paulo, 20/10/2026). Tempo online e
  // presença não contam (docs/escritorio-pontos.md).
  { id: 'adiantado10', nome: 'Adiantado', dica: '10 entregas antes do prazo', ok: n => n.antes >= 10 },
  { id: 'adiantado100', nome: 'Sempre adiantado', dica: '100 entregas antes do prazo', ok: n => n.antes >= 100 },
  { id: 'deprimeira10', nome: 'De primeira', dica: '10 peças aprovadas sem alteração', ok: n => n.deprimeira >= 10 },
  { id: 'deprimeira50', nome: 'Mão certeira', dica: '50 peças aprovadas sem alteração', ok: n => n.deprimeira >= 50 },
  { id: 'semana', nome: 'Semana sem atraso', dica: '3 ou mais entregas nos últimos 7 dias, todas dentro do prazo', ok: n => n.semanaComPrazo >= 3 && n.semanaEmDia === n.semanaComPrazo },
  { id: 'planejamento', nome: 'Planejamento aprovado', dica: 'Enviou um planejamento que o cliente aprovou', ok: n => n.planejamentos >= 1 },
  { id: 'presente', nome: 'Presenteador', dica: 'Deu o primeiro presente a alguém da equipe', ok: n => n.presentes >= 1 },
  { id: 'troca', nome: 'Negociante', dica: 'Fez a primeira troca de móveis', ok: n => n.trocas >= 1 },
  { id: 'andar2', nome: 'Segundo andar', dica: 'Montou o segundo andar do quarto', ok: n => n.andar2 },
  { id: 'postits', nome: 'Recadeiro', dica: 'Colou 10 post-its', ok: n => n.postits >= 10 },
];
export async function marcosProntos(sql) {
  const [r] = await sql`SELECT (to_regclass('public.vybe_escritorio_marcos') IS NOT NULL AND to_regclass('public.vybe_escritorio_entregas') IS NOT NULL) AS existe`;
  return Boolean(r?.existe);
}
// Dia útil anterior (pula sábado e domingo), em AAAA-MM-DD sem fuso.
function diaUtilAntes(iso) {
  let d = iso;
  do d = somarDias(d, -1); while (diaDaSemana(d) > 5);
  return d;
}
// Os números que os marcos olham, lidos agora.
export async function numerosDosMarcos(sql, pessoaId, agora = new Date()) {
  const hoje = diaBahia(agora), mes = hoje.slice(0, 8) + '01';
  // Todas as contagens ao mesmo tempo (uma por vez deixava a carteira lenta).
  const [[t], diasLinhas, [m], [cl], [v], [c], [g], [a], [d], [tem]] = await Promise.all([
    sql`SELECT count(*) AS n FROM vybe_escritorio_entregas WHERE pessoa_id=${pessoaId}`,
    sql`SELECT DISTINCT TO_CHAR(dia,'YYYY-MM-DD') AS dia FROM vybe_escritorio_entregas WHERE pessoa_id=${pessoaId} AND dia >= ${somarDias(hoje, -120)}::date`,
    sql`SELECT count(*) AS com_prazo, count(*) FILTER (WHERE e.dia <= c.prazo) AS em_dia
      FROM vybe_escritorio_entregas e JOIN vybe_conteudos c ON c.id=e.conteudo_id
      WHERE e.pessoa_id=${pessoaId} AND e.dia >= ${mes}::date AND c.prazo IS NOT NULL`,
    sql`SELECT count(DISTINCT cc.cliente_id) AS n FROM vybe_escritorio_entregas e
      JOIN vybe_conteudo_clientes cc ON cc.conteudo_id=e.conteudo_id WHERE e.pessoa_id=${pessoaId} AND e.dia >= ${mes}::date`,
    sql`SELECT count(*) AS n FROM vybe_conteudos c JOIN vybe_conteudo_responsaveis x ON x.conteudo_id=c.id
      WHERE x.pessoa_id=${pessoaId} AND c.removido_em IS NULL AND c.status_chave=ANY(${STATUS_NA_MAO}::text[]) AND c.prazo IS NOT NULL AND c.prazo < ${hoje}::date`,
    sql`SELECT xp FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId}`,
    sql`SELECT count(*) FILTER (WHERE regra='meta_semanal') AS metas, bool_or(origem='conquista:meu-quarto') AS quarto
      FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId}`,
    sql`SELECT count(*) FILTER (WHERE e.dia < c.prazo) AS antes,
        count(*) FILTER (WHERE e.dia >= ${somarDias(hoje, -6)}::date) AS semana_com_prazo,
        count(*) FILTER (WHERE e.dia >= ${somarDias(hoje, -6)}::date AND e.dia <= c.prazo) AS semana_em_dia
      FROM vybe_escritorio_entregas e JOIN vybe_conteudos c ON c.id=e.conteudo_id
      WHERE e.pessoa_id=${pessoaId} AND c.prazo IS NOT NULL`,
    sql`SELECT count(DISTINCT origem) AS n FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND regra='criacao_aprovada'`,
    // Tabelas que podem não existir (instalação antiga ou banco de teste): contam zero.
    sql`SELECT to_regclass('public.vybe_escritorio_presentes') IS NOT NULL AS presentes,
      to_regclass('public.vybe_escritorio_trocas') IS NOT NULL AS trocas, to_regclass('public.vybe_escritorio_postits') IS NOT NULL AS postits,
      to_regclass('public.vybe_planejamento_eventos') IS NOT NULL AS planejamentos`,
  ]);
  const dias = new Set(diasLinhas.map((x) => x.dia));
  // Sequência: dias úteis seguidos com pelo menos uma entrega (hoje conta se já houve).
  let seq = 0, dia = dias.has(hoje) ? hoje : diaUtilAntes(hoje);
  while (dias.has(dia) && seq < 400) { seq++; dia = diaUtilAntes(dia); }
  const contar = async (existe, consulta) => existe ? Number((await consulta())[0]?.n || 0) : 0;
  const [presentes, trocas, postits, planejamentos] = await Promise.all([
    contar(tem.presentes, () => sql`SELECT count(*) AS n FROM vybe_escritorio_presentes WHERE de_pessoa=${pessoaId}`),
    contar(tem.trocas, () => sql`SELECT count(*) AS n FROM vybe_escritorio_trocas WHERE estado='aceita' AND (de_pessoa=${pessoaId} OR para_pessoa=${pessoaId})`),
    contar(tem.postits, () => sql`SELECT count(*) AS n FROM vybe_escritorio_postits WHERE pessoa_id=${pessoaId}`),
    contar(tem.planejamentos, () => sql`SELECT count(DISTINCT p.id) AS n FROM vybe_planejamentos p
      JOIN vybe_planejamento_eventos ev ON ev.planejamento_id=p.id AND ev.tipo='enviado' AND ev.autor_id=${pessoaId}
      WHERE p.estado IN ('aprovado','cadastrado')`),
  ]);
  const [pf] = await sql`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=${pessoaId}`;
  const andar2 = (pf?.preferencias?.sala_andares || []).some(x => x?.andar === 1 && x.quarto_configurado === true);
  return { hoje, total: Number(t.n), seq, comPrazo: Number(m.com_prazo), emDia: Number(m.em_dia), clientes: Number(cl.n), vencidas: Number(v.n),
    nivel: nivelPorXp(c?.xp || 0).nivel, metas: Number(g?.metas || 0), quarto: Boolean(g?.quarto),
    antes: Number(a.antes), semanaComPrazo: Number(a.semana_com_prazo), semanaEmDia: Number(a.semana_em_dia), deprimeira: Number(d.n),
    planejamentos, presentes, trocas, postits, andar2 };
}
// Lista dos marcos da pessoa (conquistado, quando, e o móvel que dá),
// concedendo os novos: registro em vybe_escritorio_marcos, conquista no razão
// e móvel no inventário na mesma transação. Repetir não concede de novo.
export async function conferirMarcos(sql, pessoaId, agora = new Date()) {
  if (!await marcosProntos(sql)) return null;
  const n = await numerosDosMarcos(sql, pessoaId, agora);
  const feitos = new Map((await sql`SELECT marco,em FROM vybe_escritorio_marcos WHERE pessoa_id=${pessoaId}`).map(f => [f.marco, f.em]));
  const moveis = await sql`SELECT classe,marco FROM vybe_escritorio_catalogo WHERE marco IS NOT NULL ORDER BY classe`;
  const lista = [];
  for (const m of MARCOS) {
    const classes = moveis.filter(x => x.marco === m.id).map(x => x.classe);
    let em = feitos.get(m.id) || null;
    if (!em && m.ok(n)) {
      em = await sql.comTransacao(async tx => {
        const [novo] = await tx`INSERT INTO vybe_escritorio_marcos(pessoa_id,marco) VALUES(${pessoaId},${m.id}) ON CONFLICT DO NOTHING RETURNING em`;
        if (!novo) return null;
        await tx`SELECT vybe_aplicar_regra(${pessoaId},'conquista',${m.origem || 'conquista:' + m.id},NULL,${n.hoje}::date)`;
        for (const classe of classes) await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${pessoaId},${classe},1)
          ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=vybe_escritorio_inventario.quantidade+1`;
        return novo.em;
      });
      // Outra conferência ao mesmo tempo registrou primeiro: vale a data dela.
      if (!em) em = (await sql`SELECT em FROM vybe_escritorio_marcos WHERE pessoa_id=${pessoaId} AND marco=${m.id}`)[0]?.em || null;
    }
    lista.push({ id: m.id, nome: m.nome, dica: m.dica, ok: Boolean(em), em, moveis: classes });
  }
  return lista;
}
// No fechamento do dia: confere todo mundo que tem função, para o marco não
// esperar a pessoa abrir a ficha.
export async function conferirMarcosDaEquipe(sql, agora = new Date()) {
  if (!await marcosProntos(sql)) return { disponivel: false };
  const pessoas = await sql`SELECT pessoa_id FROM vybe_escritorio_funcoes ORDER BY pessoa_id`;
  let novos = 0;
  for (const p of pessoas) {
    const antes = Number((await sql`SELECT count(*) AS n FROM vybe_escritorio_marcos WHERE pessoa_id=${p.pessoa_id}`)[0].n);
    const lista = await conferirMarcos(sql, p.pessoa_id, agora);
    novos += lista.filter(m => m.ok).length - antes;
  }
  return { disponivel: true, pessoas: pessoas.length, novos };
}
