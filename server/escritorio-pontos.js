// Pontos (XP) e VybeCoins por função: fechamento do dia e da semana, meta
// semanal e a leitura que a ficha usa. Os eventos instantâneos ficam no gatilho
// do banco e os valores na tabela vybe_escritorio_regras
// (migrations/2026-10-17-escritorio-pontos.sql; plano em docs/escritorio-pontos.md).
export function diaBahia(valor = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(valor);
}
// Datas sem hora (AAAA-MM-DD) somadas em UTC: nunca deslocam de fuso.
export function somarDias(iso, n) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
// 1 = segunda … 7 = domingo.
export function diaDaSemana(iso) {
  const [a, m, d] = String(iso).split('-').map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}
export function inicioDaSemana(iso) { return somarDias(iso, 1 - diaDaSemana(iso)); }
// Nível pelo XP: cada nível pede um pouco mais que o anterior (50, 110, 140…).
export function nivelPorXp(total) {
  let xp = Math.max(0, Number(total) || 0), nivel = 1, base = 0, passo = 50;
  while (xp >= base + passo) { base += passo; nivel++; passo = (5 + nivel * 3) * 10; }
  return { nivel, xp: xp - base, xpProximo: passo, xpTotal: xp };
}
export async function pontosProntos(sql) {
  const [r] = await sql`SELECT (to_regclass('public.vybe_escritorio_regras') IS NOT NULL
    AND to_regclass('public.vybe_escritorio_entregas') IS NOT NULL
    AND to_regclass('public.vybe_escritorio_fechamentos') IS NOT NULL) AS existe`;
  return Boolean(r?.existe);
}
// Status em que a peça está na mão de quem executa. Só esses contam como
// "vencida" no fechamento: em aprovação ou esperando cliente não é atraso de quem fez.
export const STATUS_NA_MAO = ['a_fazer', 'pode_fazer', 'em_andamento', 'alteracao', 'nova_demanda', 'em_execucao'];

// Meta da semana que começa em `inicio` (segunda): média das entregas da função
// nas últimas `semanas` completas, desde a primeira entrega da pessoa.
export async function metaDaSemana(sql, pessoaId, inicio, { semanas = 8 } = {}) {
  const fim = somarDias(inicio, 6), desde = somarDias(inicio, -7 * semanas);
  const [f] = await sql`SELECT funcao FROM vybe_escritorio_funcoes WHERE pessoa_id=${pessoaId}`;
  const funcao = f?.funcao || null;
  const linhas = await sql`SELECT TO_CHAR(e.dia,'YYYY-MM-DD') AS dia FROM vybe_escritorio_entregas e
    JOIN vybe_escritorio_regras g ON g.chave=e.regra
    WHERE e.pessoa_id=${pessoaId} AND g.entrega AND (g.funcao IS NULL OR g.funcao=${funcao})
      AND e.dia >= ${desde}::date AND e.dia <= ${fim}::date`;
  const entregas = linhas.filter(l => l.dia >= inicio && l.dia <= fim).length;
  const [primeira] = await sql`SELECT TO_CHAR(MIN(e.dia),'YYYY-MM-DD') AS dia FROM vybe_escritorio_entregas e
    JOIN vybe_escritorio_regras g ON g.chave=e.regra
    WHERE e.pessoa_id=${pessoaId} AND g.entrega AND (g.funcao IS NULL OR g.funcao=${funcao}) AND e.dia < ${inicio}::date`;
  if (!primeira?.dia) return { inicio, fim, funcao, entregas, meta: 1, semanas: 0, media: null };
  const comeco = [inicioDaSemana(primeira.dia), desde].sort().pop();
  const n = Math.max(1, Math.round((Date.UTC(...inicio.split('-').map(Number)) - Date.UTC(...comeco.split('-').map(Number))) / 6048e5));
  const total = linhas.filter(l => l.dia >= comeco && l.dia < inicio).length;
  const media = total / n;
  return { inicio, fim, funcao, entregas, meta: Math.max(1, Math.round(media)), semanas: n, media: Math.round(media * 10) / 10 };
}

async function marcar(tx, chave) {
  const r = await tx`INSERT INTO vybe_escritorio_fechamentos(chave) VALUES(${chave}) ON CONFLICT DO NOTHING RETURNING chave`;
  return r.length > 0;
}
async function aplicar(tx, pessoa, regra, origem, dia) {
  const [r] = await tx`SELECT vybe_aplicar_regra(${pessoa},${regra},${origem},NULL,${dia}::date) AS ok`;
  return Boolean(r?.ok);
}
// Fecha um dia (estado lido agora, logo depois da meia-noite da Bahia).
async function fecharDia(tx, dia) {
  if (!await marcar(tx, 'dia:' + dia)) return null;
  const r = { dia, util: diaDaSemana(dia) <= 5, ativos: 0, lancamentos: 0 };
  const lancar = async (pessoa, regra, origem) => { if (await aplicar(tx, pessoa, regra, origem, dia)) r.lancamentos++; };
  const ativos = await tx`SELECT DISTINCT autor_id FROM vybe_conteudo_eventos WHERE autor_id IS NOT NULL AND vybe_dia_bahia(em)=${dia}::date ORDER BY autor_id`;
  r.ativos = ativos.length;
  for (const a of ativos) await lancar(a.autor_id, 'dia_ativo', `dia:${dia}:ativo`);
  if (!r.util) return r;
  const criacao = await tx`SELECT f.pessoa_id,
    (SELECT count(*) FROM vybe_conteudos c JOIN vybe_conteudo_responsaveis x ON x.conteudo_id=c.id
      WHERE x.pessoa_id=f.pessoa_id AND c.removido_em IS NULL AND c.status_chave=ANY(${STATUS_NA_MAO}::text[])
        AND c.prazo IS NOT NULL AND c.prazo <= ${dia}::date) AS vencidas,
    (SELECT count(*) FROM vybe_conteudos c JOIN vybe_conteudo_responsaveis x ON x.conteudo_id=c.id
      WHERE x.pessoa_id=f.pessoa_id AND c.removido_em IS NULL AND c.status_chave=ANY(${STATUS_NA_MAO}::text[])) AS fila,
    (SELECT count(*) FROM vybe_escritorio_entregas e WHERE e.pessoa_id=f.pessoa_id AND e.dia=${dia}::date) AS entregas
    FROM vybe_escritorio_funcoes f WHERE f.funcao='criacao' ORDER BY f.pessoa_id`;
  for (const p of criacao) {
    if (Number(p.vencidas) > 0) await lancar(p.pessoa_id, 'dia_vencida', `dia:${dia}:vencida`);
    else if (Number(p.fila) > 0 || Number(p.entregas) > 0) await lancar(p.pessoa_id, 'dia_sem_vencida', `dia:${dia}:sem-vencida`);
  }
  const [{ n: paraAgendar }] = await tx`SELECT count(*) AS n FROM vybe_conteudos c
    WHERE c.removido_em IS NULL AND c.status_chave='para_agendar' AND c.veiculacao IS NOT NULL AND c.veiculacao <= ${dia}::date`;
  // Furo: o mesmo critério do resumo do dia — veicula hoje e ainda está aberta (post segurado não conta).
  const [{ n: furos }] = await tx`SELECT count(*) AS n FROM vybe_conteudos c
    JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
    WHERE c.board_id=7829537690 AND c.removido_em IS NULL AND c.veiculacao=${dia}::date
      AND NOT COALESCE(s.final,false) AND c.status_chave<>'segurar_post'`;
  r.paraAgendarVencidos = Number(paraAgendar); r.furos = Number(furos);
  const equipe = await tx`SELECT pessoa_id,funcao FROM vybe_escritorio_funcoes WHERE funcao IN ('agendamento','gestao') ORDER BY pessoa_id`;
  for (const p of equipe) {
    if (p.funcao === 'agendamento' && !r.paraAgendarVencidos) await lancar(p.pessoa_id, 'dia_agendamento', `dia:${dia}:agendamento`);
    if (p.funcao === 'gestao' && !r.furos) await lancar(p.pessoa_id, 'dia_sem_furo', `dia:${dia}:sem-furo`);
  }
  return r;
}
// Fecha a semana que começa em `inicio`: quem bateu a própria meta ganha o bônus.
async function fecharSemana(tx, inicio) {
  if (!await marcar(tx, 'semana:' + inicio)) return null;
  const r = { inicio, fim: somarDias(inicio, 6), pessoas: [] };
  const pessoas = await tx`SELECT pessoa_id FROM vybe_escritorio_funcoes ORDER BY pessoa_id`;
  for (const p of pessoas) {
    const m = await metaDaSemana(tx, p.pessoa_id, inicio);
    const bateu = m.entregas > 0 && m.entregas >= m.meta && await aplicar(tx, p.pessoa_id, 'meta_semanal', `semana:${inicio}:meta`, r.fim);
    r.pessoas.push({ pessoa_id: p.pessoa_id, meta: m.meta, entregas: m.entregas, bateu });
  }
  return r;
}
// Chamado pelo ciclo diário (00:00 da Bahia). Idempotente: dia e semana já
// fechados não são refeitos; dias que ficaram para trás (até `janela`) são
// fechados com o estado atual.
export async function fecharPontosEscritorio(sql, agora = new Date(), { janela = 7 } = {}) {
  if (!await pontosProntos(sql)) return { disponivel: false };
  const hoje = diaBahia(agora), dias = [], semanas = [];
  for (let i = janela; i >= 1; i--) {
    const r = await sql.comTransacao(tx => fecharDia(tx, somarDias(hoje, -i)));
    if (r) dias.push(r);
  }
  const atual = inicioDaSemana(hoje);
  for (const inicio of [somarDias(atual, -14), somarDias(atual, -7)]) {
    const r = await sql.comTransacao(tx => fecharSemana(tx, inicio));
    if (r) semanas.push(r);
  }
  return { disponivel: true, hoje, dias, semanas };
}
// O que a ficha mostra da própria pessoa: nível, meta da semana e extrato.
export async function resumoPontos(sql, pessoaId, agora = new Date()) {
  if (!await pontosProntos(sql)) return null;
  const [c] = await sql`SELECT xp FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId}`;
  const [f] = await sql`SELECT funcao,carteira FROM vybe_escritorio_funcoes WHERE pessoa_id=${pessoaId}`;
  const meta = await metaDaSemana(sql, pessoaId, inicioDaSemana(diaBahia(agora)));
  const extrato = await sql`SELECT m.origem,m.regra,m.quantidade AS moedas,m.pontos,m.criado_em,
      COALESCE(g.descricao, CASE WHEN m.origem LIKE 'compra:%' THEN 'Compra na loja' WHEN m.origem LIKE 'conquista:%' THEN 'Conquista' WHEN m.origem LIKE 'reembolso:%' THEN 'Devolução de compra' WHEN m.origem LIKE 'ajuste:economia%' THEN 'Ajuste da nova economia' ELSE m.origem END) AS descricao
    FROM vybe_escritorio_moedas m LEFT JOIN vybe_escritorio_regras g ON g.chave=m.regra
    WHERE m.pessoa_id=${pessoaId} ORDER BY m.criado_em DESC, m.id DESC LIMIT 12`;
  return { ...nivelPorXp(c?.xp || 0), funcao: f?.funcao || null, carteira: f?.carteira || null, meta, extrato, trabalho: await resumoTrabalho(sql, pessoaId, f?.funcao || null, agora) };
}
// Números de trabalho da ficha pelas mesmas entregas que valem XP e meta
// (regras com "entrega", da função da pessoa, nos dois quadros). Antes a
// ficha contava só o quadro de Solicitações no navegador e a Criação, que
// entrega pelo quadro de Produção, aparecia "sem demanda".
export async function resumoTrabalho(sql, pessoaId, funcao, agora = new Date()) {
  const hoje = diaBahia(agora), mes = hoje.slice(0, 7), semana = inicioDaSemana(hoje);
  const dias = await sql`SELECT TO_CHAR(e.dia,'YYYY-MM-DD') AS dia, count(*)::int AS n FROM vybe_escritorio_entregas e
    JOIN vybe_escritorio_regras g ON g.chave=e.regra
    WHERE e.pessoa_id=${pessoaId} AND g.entrega AND (g.funcao IS NULL OR g.funcao=${funcao}) GROUP BY 1`;
  const por = new Map(dias.map((d) => [d.dia, Number(d.n)]));
  const soma = (f) => dias.filter((d) => f(d.dia)).reduce((t, d) => t + Number(d.n), 0);
  // Sequência: dias úteis seguidos com entrega (hoje conta se já houve).
  let seq = 0, dia = por.has(hoje) ? hoje : diaUtilAntes(hoje);
  while (por.has(dia) && seq < 400) { seq++; dia = diaUtilAntes(dia); }
  return { total: soma(() => true), hoje: por.get(hoje) || 0, semana: soma((d) => d >= semana && d <= hoje), mes: soma((d) => d.startsWith(mes)), sequencia: seq, funcao };
}
function diaUtilAntes(iso) {
  let d = somarDias(iso, -1);
  while ([6, 7].includes(diaDaSemana(d))) d = somarDias(d, -1);
  return d;
}
