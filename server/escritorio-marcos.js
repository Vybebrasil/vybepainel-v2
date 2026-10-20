// Conquistas da ficha em níveis (decisão do Paulo, 20/10/2026): cada escada
// sobe de Bronze para Prata, Ouro e Diamante, com metas altas, pensadas para
// meses de trabalho; há uma escada por tipo de entrega (Card, Reels,
// Carrossel…) e uma por função. As sociais (quarto, presente, troca…) têm um
// nível só. Metas e troféus ficam na tabela vybe_escritorio_trofeus
// (migrations/2026-10-20-escritorio-conquistas-niveis.sql); aqui fica só como
// cada número é contado. Cada nível alcançado dá a conquista (regra
// "conquista" × nível) e o troféu do nível, uma vez só, na mesma transação.
// A pessoa fica com todos os troféus da escada (Paulo, 20/10/2026: para expor
// no quarto a evolução, do Bronze ao Diamante).
import { nivelPorXp, diaBahia, somarDias, diaDaSemana } from './escritorio-pontos.js';

export const NIVEIS = ['', 'Bronze', 'Prata', 'Ouro', 'Diamante'];
// Entregas de quem executou a peça (Criação e Produção): as escadas de entrega,
// ritmo e qualidade contam só elas. Gestão, Atendimento e Agendamento sobem
// pela escada da própria função (Paulo, 20/10/2026: "conquistas mais difíceis").
const EXECUCAO = ['peca_criacao', 'peca_producao'];
// Formatos de cada escada de entrega (chave de vybe_escritorio_complexidade).
const FORMATOS = {
  cards: ['card', 'feed', 'post', 'avulso', 'feed/story'], carrosseis: ['carrossel'], reels: ['reels'],
  stories: ['story'], fotografias: ['fotografia'], videos: ['video', 'motion', 'capa videos'],
};
const NOME_TIPO = { cards: 'Cards', carrosseis: 'Carrosséis', reels: 'Reels', stories: 'Stories', fotografias: 'Fotografias' };
export const MARCOS = [
  { id: 'entregas', nome: 'Entregas', unidade: 'entregas', valor: (n) => n.total },
  { id: 'cards', nome: 'Cards', unidade: 'cards entregues', valor: (n) => n.formatos.cards },
  { id: 'carrosseis', nome: 'Carrosséis', unidade: 'carrosséis entregues', valor: (n) => n.formatos.carrosseis },
  { id: 'reels', nome: 'Reels', unidade: 'reels entregues', valor: (n) => n.formatos.reels },
  { id: 'stories', nome: 'Stories', unidade: 'stories entregues', valor: (n) => n.formatos.stories },
  { id: 'fotografias', nome: 'Fotografias', unidade: 'fotografias entregues', valor: (n) => n.formatos.fotografias },
  { id: 'videos', nome: 'Vídeos e motions', unidade: 'vídeos entregues', valor: (n) => n.formatos.videos },
  { id: 'nivel', nome: 'Nível', unidade: 'de nível', valor: (n) => n.nivel },
  { id: 'adiantado', nome: 'Adiantado', unidade: 'entregas antes do prazo', valor: (n) => n.antes },
  { id: 'deprimeira', nome: 'De primeira', unidade: 'peças aprovadas sem alteração', valor: (n) => n.deprimeira },
  { id: 'embalo', nome: 'Embalado', unidade: 'dias úteis seguidos com entrega', valor: (n) => n.seqMax },
  { id: 'clientes', nome: 'Muitos clientes', unidade: 'clientes diferentes num mês', valor: (n) => n.clientesMax },
  { id: 'semana', nome: 'Semana sem atraso', unidade: 'semanas com 15+ entregas, todas no prazo', valor: (n) => n.semanasLimpas },
  { id: 'filaemdia', nome: 'Fila em dia', unidade: 'dias fechados sem demanda vencida', valor: (n) => n.regras.dia_sem_vencida || 0 },
  { id: 'meta', nome: 'Meta em dia', unidade: 'semanas com a meta batida', valor: (n) => n.regras.meta_semanal || 0 },
  { id: 'da', nome: 'Direção de arte', unidade: 'aprovações como DA', valor: (n) => n.regras.peca_da || 0 },
  { id: 'agendamento', nome: 'Agendamento', unidade: 'peças agendadas', valor: (n) => n.regras.peca_agendamento || 0 },
  { id: 'carteira', nome: 'Carteira', unidade: 'peças da carteira', valor: (n) => n.regras.peca_atendimento || 0 },
  { id: 'cadastros', nome: 'Cadastros', unidade: 'demandas cadastradas', valor: (n) => n.regras.cadastro || 0 },
  // Categorias por tipo também para quem agenda, atende e gere (Paulo, 20/10/2026:
  // equilibrar com quem executa, que tem uma escada por tipo de peça).
  ...['cards', 'carrosseis', 'reels', 'stories', 'fotografias'].flatMap((f) => [
    { id: 'agendados_' + f, nome: `${NOME_TIPO[f]} agendados`, unidade: `${NOME_TIPO[f].toLowerCase()} agendados`, valor: (n) => n.porRegra.peca_agendamento?.[f] || 0 },
    { id: 'carteira_' + f, nome: `${NOME_TIPO[f]} da carteira`, unidade: `${NOME_TIPO[f].toLowerCase()} da carteira`, valor: (n) => n.porRegra.peca_atendimento?.[f] || 0 },
  ]),
  { id: 'briefings', nome: 'Briefings', unidade: 'briefings escritos', valor: (n) => n.regras.briefing || 0 },
  { id: 'agencia', nome: 'Peças da agência', unidade: 'peças da agência acompanhadas', valor: (n) => n.regras.peca_gestao || 0 },
  { id: 'planejamentos', nome: 'Planejamentos', unidade: 'planejamentos aprovados', valor: (n) => n.planejamentos },
  // Sociais: um nível só.
  { id: 'quarto', nome: 'Meu quarto', unidade: 'quarto montado', valor: (n) => (n.quarto ? 1 : 0), origem: 'conquista:meu-quarto' },
  { id: 'andar2', nome: 'Segundo andar', unidade: 'segundo andar montado', valor: (n) => (n.andar2 ? 1 : 0) },
  { id: 'presente', nome: 'Presenteador', unidade: 'presentes dados', valor: (n) => n.presentes },
  { id: 'troca', nome: 'Negociante', unidade: 'trocas feitas', valor: (n) => n.trocas },
  { id: 'postits', nome: 'Recadeiro', unidade: 'post-its colados', valor: (n) => n.postits },
];
// "entregas:3" → { marco: 'entregas', nivel: 3 }.
export function partesDoMarco(chave) {
  const [marco, n] = String(chave || '').split(':');
  return { marco, nivel: Number(n) || 1 };
}
export function nomeDoMarco(chave) {
  const { marco, nivel } = partesDoMarco(chave), m = MARCOS.find((x) => x.id === marco);
  if (!m) return chave;
  return MARCOS_SOCIAIS.has(marco) ? m.nome : `${m.nome} ${NIVEIS[nivel] || ''}`.trim();
}
const MARCOS_SOCIAIS = new Set(['quarto', 'andar2', 'presente', 'troca', 'postits']);
export async function marcosProntos(sql) {
  const [r] = await sql`SELECT (to_regclass('public.vybe_escritorio_marcos') IS NOT NULL AND to_regclass('public.vybe_escritorio_entregas') IS NOT NULL
    AND to_regclass('public.vybe_escritorio_trofeus') IS NOT NULL) AS existe`;
  return Boolean(r?.existe);
}
// Dia útil anterior (pula sábado e domingo), em AAAA-MM-DD sem fuso.
function diaUtilAntes(iso) {
  let d = iso;
  do d = somarDias(d, -1); while (diaDaSemana(d) > 5);
  return d;
}
// Os números que as escadas olham, de todo o histórico.
export async function numerosDosMarcos(sql, pessoaId) {
  const [[ex]] = await Promise.all([sql`SELECT to_regclass('public.vybe_escritorio_presentes') IS NOT NULL AS presentes,
    to_regclass('public.vybe_escritorio_trocas') IS NOT NULL AS trocas, to_regclass('public.vybe_escritorio_postits') IS NOT NULL AS postits,
    to_regclass('public.vybe_planejamento_eventos') IS NOT NULL AS planejamentos, to_regprocedure('vybe_formato_chave(text)') IS NOT NULL AS formato,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='vybe_conteudos' AND column_name='formato') AS colformato`]);
  const contar = (existe, consulta) => existe ? consulta().then((r) => Number(r[0]?.n || 0)) : Promise.resolve(0);
  const [[t], diasLinhas, [cl], [c], regrasLinhas, [a], semanas, formatos, presentes, trocas, postits, planejamentos, [pf], [quarto]] = await Promise.all([
    sql`SELECT count(*) AS n FROM vybe_escritorio_entregas WHERE pessoa_id=${pessoaId} AND regra = ANY(${EXECUCAO}::text[])`,
    sql`SELECT DISTINCT TO_CHAR(dia,'YYYY-MM-DD') AS dia FROM vybe_escritorio_entregas WHERE pessoa_id=${pessoaId} AND regra = ANY(${EXECUCAO}::text[])`,
    sql`SELECT COALESCE(max(n),0) AS n FROM (SELECT date_trunc('month', e.dia) m, count(DISTINCT cc.cliente_id) n FROM vybe_escritorio_entregas e
      JOIN vybe_conteudo_clientes cc ON cc.conteudo_id=e.conteudo_id WHERE e.pessoa_id=${pessoaId} AND e.regra = ANY(${EXECUCAO}::text[]) GROUP BY 1) x`,
    sql`SELECT xp FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId}`,
    sql`SELECT regra, count(DISTINCT origem)::int AS n FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND regra IS NOT NULL GROUP BY regra`,
    sql`SELECT count(*) FILTER (WHERE e.dia < c.prazo) AS antes FROM vybe_escritorio_entregas e JOIN vybe_conteudos c ON c.id=e.conteudo_id
      WHERE e.pessoa_id=${pessoaId} AND e.regra = ANY(${EXECUCAO}::text[]) AND c.prazo IS NOT NULL`,
    sql`SELECT count(*)::int AS n FROM (SELECT date_trunc('week', e.dia) s FROM vybe_escritorio_entregas e JOIN vybe_conteudos c ON c.id=e.conteudo_id
      WHERE e.pessoa_id=${pessoaId} AND e.regra = ANY(${EXECUCAO}::text[]) AND c.prazo IS NOT NULL GROUP BY 1 HAVING count(*) >= 15 AND count(*) FILTER (WHERE e.dia > c.prazo) = 0) x`,
    ex.formato && ex.colformato
      ? sql`SELECT e.regra, vybe_formato_chave(split_part(c.formato, ',', 1)) AS f, count(DISTINCT e.conteudo_id)::int AS n FROM vybe_escritorio_entregas e
          JOIN vybe_conteudos c ON c.id=e.conteudo_id WHERE e.pessoa_id=${pessoaId} AND e.regra IN ('peca_criacao','peca_producao','peca_agendamento','peca_atendimento') GROUP BY 1,2`
      : Promise.resolve([]),
    contar(ex.presentes, () => sql`SELECT count(*) AS n FROM vybe_escritorio_presentes WHERE de_pessoa=${pessoaId}`),
    contar(ex.trocas, () => sql`SELECT count(*) AS n FROM vybe_escritorio_trocas WHERE estado='aceita' AND (de_pessoa=${pessoaId} OR para_pessoa=${pessoaId})`),
    contar(ex.postits, () => sql`SELECT count(*) AS n FROM vybe_escritorio_postits WHERE pessoa_id=${pessoaId}`),
    contar(ex.planejamentos, () => sql`SELECT count(DISTINCT p.id) AS n FROM vybe_planejamentos p
      JOIN vybe_planejamento_eventos ev ON ev.planejamento_id=p.id AND ev.tipo='enviado' AND ev.autor_id=${pessoaId}
      WHERE p.estado IN ('aprovado','cadastrado')`),
    sql`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=${pessoaId}`,
    sql`SELECT EXISTS(SELECT 1 FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND origem='conquista:meu-quarto') OR EXISTS(
      SELECT 1 FROM vybe_escritorio_perfis WHERE pessoa_id=${pessoaId} AND preferencias->>'quarto_configurado'='true') AS sim`,
  ]);
  // Maior sequência de dias úteis com entrega no histórico.
  const dias = new Set(diasLinhas.map((x) => x.dia));
  let seqMax = 0;
  for (const d of dias) {
    if (diaDaSemana(d) > 5 || dias.has(proximoUtil(d, -1))) continue; // começa só no início de uma sequência
    let n = 0, x = d;
    while (dias.has(x) && n < 800) { n++; x = proximoUtil(x, 1); }
    seqMax = Math.max(seqMax, n);
  }
  const regras = Object.fromEntries(regrasLinhas.map((r) => [r.regra, Number(r.n)]));
  const somar = (linhas) => Object.fromEntries(Object.keys(FORMATOS).map((k) => [k, linhas.filter((f) => FORMATOS[k].includes(f.f)).reduce((s, f) => s + Number(f.n), 0)]));
  const porFormato = somar(formatos.filter((f) => EXECUCAO.includes(f.regra)));
  const porRegra = Object.fromEntries(['peca_agendamento', 'peca_atendimento'].map((r) => [r, somar(formatos.filter((f) => f.regra === r))]));
  return { hoje: diaBahia(), total: Number(t.n), seqMax, clientesMax: Number(cl.n), nivel: nivelPorXp(c?.xp || 0).nivel, regras, antes: Number(a.antes),
    deprimeira: regras.criacao_aprovada || 0, semanasLimpas: Number(semanas[0]?.n || 0), formatos: porFormato, porRegra, presentes, trocas, postits, planejamentos,
    quarto: Boolean(quarto?.sim), andar2: (pf?.preferencias?.sala_andares || []).some((x) => x?.andar === 1 && x.quarto_configurado === true) };
}
function proximoUtil(iso, passo) {
  let d = iso;
  do d = somarDias(d, passo); while (diaDaSemana(d) > 5);
  return d;
}
// Lista das escadas da pessoa (nível alcançado, próximo alvo, troféus),
// concedendo os níveis novos: registro em vybe_escritorio_marcos ("id:nível"),
// conquista no razão (regra × nível) e o troféu no inventário, na mesma
// transação. Repetir não concede de novo.
export async function conferirMarcos(sql, pessoaId, agora = new Date()) {
  if (!await marcosProntos(sql)) return null;
  const [n, feitosLinhas, trofeus, [regra]] = await Promise.all([
    numerosDosMarcos(sql, pessoaId),
    sql`SELECT marco,em FROM vybe_escritorio_marcos WHERE pessoa_id=${pessoaId}`,
    sql`SELECT marco, nivel, meta, classe FROM vybe_escritorio_trofeus ORDER BY marco, nivel`,
    sql`SELECT moedas, pontos FROM vybe_escritorio_regras WHERE chave='conquista' AND ativa`,
  ]);
  const feitos = new Map(feitosLinhas.map((f) => [f.marco, f.em]));
  const lista = [];
  for (const m of MARCOS) {
    const degraus = trofeus.filter((x) => x.marco === m.id).map((x) => ({ nivel: Number(x.nivel), meta: Number(x.meta), classe: x.classe }));
    if (!degraus.length) continue;
    const valor = Number(m.valor(n) || 0);
    for (const d of degraus) {
      const chave = `${m.id}:${d.nivel}`;
      if (feitos.has(chave) || valor < d.meta) continue;
      const em = await sql.comTransacao(async (tx) => {
        const [novo] = await tx`INSERT INTO vybe_escritorio_marcos(pessoa_id,marco) VALUES(${pessoaId},${chave}) ON CONFLICT DO NOTHING RETURNING em`;
        if (!novo) return null;
        if (regra) await tx`SELECT vybe_lancar_pontos(${pessoaId},${d.nivel === 1 && m.origem ? m.origem : 'conquista:' + chave},'conquista',NULL,${Number(regra.moedas) * d.nivel},${Number(regra.pontos) * d.nivel})`;
        if (d.classe) await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${pessoaId},${d.classe},1)
          ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=vybe_escritorio_inventario.quantidade+1`;
        return novo.em;
      });
      feitos.set(chave, em || (await sql`SELECT em FROM vybe_escritorio_marcos WHERE pessoa_id=${pessoaId} AND marco=${chave}`)[0]?.em || null);
    }
    const alcancados = degraus.filter((d) => feitos.has(`${m.id}:${d.nivel}`));
    const nivel = alcancados.length ? Math.max(...alcancados.map((d) => d.nivel)) : 0;
    const proximo = degraus.find((d) => d.nivel === nivel + 1) || null;
    const social = MARCOS_SOCIAIS.has(m.id);
    lista.push({
      id: m.id, nome: m.nome, nivel, nomeNivel: social ? (nivel ? 'Conquistado' : '') : NIVEIS[nivel] || '', social, valor, unidade: m.unidade,
      proximo: proximo ? { nivel: proximo.nivel, nome: social ? 'Conquistado' : NIVEIS[proximo.nivel], meta: proximo.meta, classe: proximo.classe } : null,
      degraus: degraus.map((d) => ({ ...d, nome: social ? 'Conquistado' : NIVEIS[d.nivel], ok: feitos.has(`${m.id}:${d.nivel}`), em: feitos.get(`${m.id}:${d.nivel}`) || null,
        moedas: regra ? Number(regra.moedas) * d.nivel : 0, pontos: regra ? Number(regra.pontos) * d.nivel : 0 })),
      // Compatível com as telas antigas: ok, em, dica e o móvel do próximo nível (ou do último).
      ok: nivel > 0, em: alcancados.length ? feitos.get(`${m.id}:${nivel}`) : null,
      dica: proximo ? `${proximo.meta.toLocaleString('pt-BR')} ${m.unidade}` : 'Nível máximo',
      moveis: [(proximo || degraus.at(-1))?.classe].filter(Boolean),
    });
  }
  return lista;
}
// No fechamento do dia: confere todo mundo que tem função, para o nível não
// esperar a pessoa abrir a ficha.
export async function conferirMarcosDaEquipe(sql, agora = new Date()) {
  if (!await marcosProntos(sql)) return { disponivel: false };
  const pessoas = await sql`SELECT pessoa_id FROM vybe_escritorio_funcoes ORDER BY pessoa_id`;
  let novos = 0;
  for (const p of pessoas) {
    const antes = Number((await sql`SELECT count(*) AS n FROM vybe_escritorio_marcos WHERE pessoa_id=${p.pessoa_id}`)[0].n);
    await conferirMarcos(sql, p.pessoa_id, agora);
    novos += Number((await sql`SELECT count(*) AS n FROM vybe_escritorio_marcos WHERE pessoa_id=${p.pessoa_id}`)[0].n) - antes;
  }
  return { disponivel: true, pessoas: pessoas.length, novos };
}
