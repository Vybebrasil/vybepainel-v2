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
    // Meta em degraus (Paulo, 21/10/2026: valorizar quem faz muito): só o
    // maior degrau batido, pela regra da tabela.
    const pct = m.meta > 0 ? m.entregas / m.meta : 0;
    const degrau = pct >= 1.6 ? 'meta_semanal_160' : pct >= 1.3 ? 'meta_semanal_130' : 'meta_semanal';
    const bateu = m.entregas > 0 && m.entregas >= m.meta
      && (await aplicar(tx, p.pessoa_id, degrau, `semana:${inicio}:meta`, r.fim) || (degrau !== 'meta_semanal' && await aplicar(tx, p.pessoa_id, 'meta_semanal', `semana:${inicio}:meta`, r.fim)));
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
  // Ranking: só a semana que acabou (o pódio é pago uma vez, depois da meta).
  const ranking = await sql.comTransacao(tx => fecharRankingSemana(tx, somarDias(atual, -7)));
  return { disponivel: true, hoje, dias, semanas, ranking };
}
// O que a ficha mostra da própria pessoa: nível, meta da semana e extrato.
export async function resumoPontos(sql, pessoaId, agora = new Date()) {
  if (!await pontosProntos(sql)) return null;
  // Ao mesmo tempo: em sequência a ficha e a carteira demoravam segundos.
  const [[c], [f], meta] = await Promise.all([
    sql`SELECT xp FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId}`,
    sql`SELECT funcao,carteira FROM vybe_escritorio_funcoes WHERE pessoa_id=${pessoaId}`,
    metaDaSemana(sql, pessoaId, inicioDaSemana(diaBahia(agora)))]);
  const extratoP = sql`SELECT m.origem,m.regra,m.quantidade AS moedas,m.pontos,m.criado_em,
      COALESCE(g.descricao, CASE WHEN m.origem LIKE 'compra:%' THEN 'Compra na loja' WHEN m.origem LIKE 'conquista:%' THEN 'Conquista' WHEN m.origem LIKE 'reembolso:%' THEN 'Devolução de compra' WHEN m.origem LIKE 'ajuste:economia%' THEN 'Ajuste da nova economia' ELSE m.origem END) AS descricao
    FROM vybe_escritorio_moedas m LEFT JOIN vybe_escritorio_regras g ON g.chave=m.regra
    WHERE m.pessoa_id=${pessoaId} ORDER BY m.criado_em DESC, m.id DESC LIMIT 12`;
  // Ganhos da semana agrupados por regra (Paulo, 20/10/2026: o extrato
  // repetia "Demanda criada com briefing" linha a linha) e a tabela de como
  // a pessoa ganha, para a ficha explicar de onde vem cada coisa.
  const ganhosP = sql`SELECT COALESCE(g.descricao, CASE WHEN m.origem LIKE 'compra:%' THEN 'Compras na loja' WHEN m.origem LIKE 'conquista:%' THEN 'Conquistas' WHEN m.origem LIKE 'reembolso:%' THEN 'Devoluções de compra' WHEN m.origem LIKE 'ajuste:economia%' THEN 'Ajuste da nova economia' ELSE 'Outros' END) AS descricao,
      COUNT(*)::int AS vezes, COALESCE(SUM(m.quantidade),0)::int AS moedas, COALESCE(SUM(m.pontos),0)::int AS pontos, MAX(m.criado_em) AS ultimo
    FROM vybe_escritorio_moedas m LEFT JOIN vybe_escritorio_regras g ON g.chave=m.regra
    WHERE m.pessoa_id=${pessoaId} AND m.criado_em >= ${agora}::timestamptz - interval '7 days'
    GROUP BY 1 ORDER BY 4 DESC, 3 DESC, 2 DESC LIMIT 15`;
  const [extrato, ganhos, regras, bolo, trabalho, missoes] = await Promise.all([extratoP, ganhosP, regrasDaFuncao(sql, f?.funcao || null), fatiasDoBolo(sql),
    resumoTrabalho(sql, pessoaId, f?.funcao || null, agora), tabelaDasMissoes(sql, f?.funcao || null)]);
  return { ...nivelPorXp(c?.xp || 0), funcao: f?.funcao || null, carteira: f?.carteira || null, meta, extrato, ganhos, regras, bolo, trabalho, missoes };
}
// Todas as regras que valem para a função (e as de todo mundo), com o valor
// da tabela: é o "como ganhar" da ficha. Peso por formato só com a migração.
export async function regrasDaFuncao(sql, funcao) {
  const [m] = await sql`SELECT to_regclass('public.vybe_escritorio_complexidade') IS NOT NULL AS existe`;
  const linhas = m?.existe
    ? await sql`SELECT chave,descricao,moedas,pontos,entrega,por_complexidade,funcao FROM vybe_escritorio_regras WHERE ativa AND (funcao IS NULL OR funcao=${funcao}) ORDER BY entrega DESC, pontos DESC, moedas DESC`
    : await sql`SELECT chave,descricao,moedas,pontos,entrega,false AS por_complexidade,funcao FROM vybe_escritorio_regras WHERE ativa AND (funcao IS NULL OR funcao=${funcao}) ORDER BY entrega DESC, pontos DESC, moedas DESC`;
  const fatias = await fatiasDoBolo(sql);
  // "historico" é só o percentual das peças de antes de 17/10, não uma regra de ganhar.
  return linhas.filter((r) => r.chave !== 'historico').map((r) => {
    const parte = fatias && PAPEL_DA_REGRA[r.chave] ? parteDoBolo(fatias, r.chave) : null;
    // Regra do bolo: o valor mostrado é a parte da pessoa numa peça de peso 1.
    const f = parte ? (parte.normal || parte.video || parte.foto) : 1;
    return { ...r, moedas: Math.round(Number(r.moedas) * f), pontos: Math.round(Number(r.pontos) * f), ...(parte ? { parte } : {}) };
  });
}
// Bolo por peça (2026-10-20-escritorio-bolo-por-peca.sql): a fatia de cada
// papel, com e sem captação (foto e vídeo). O DA fica com uma parte da fatia
// da Criação. Sem a migração, null (as regras antigas valem inteiras).
const PAPEL_DA_REGRA = { peca_criacao: 'criacao', peca_da: 'criacao', peca_producao: 'producao', peca_atendimento: 'atendimento', peca_agendamento: 'agendamento', peca_gestao: 'gestao' };
const PAPEL_DA_FUNCAO = { criacao: 'peca_criacao', producao: 'peca_producao', atendimento: 'peca_atendimento', agendamento: 'peca_agendamento', gestao: 'peca_gestao' };
export async function fatiasDoBolo(sql) {
  const [m] = await sql`SELECT to_regclass('public.vybe_escritorio_fatias') IS NOT NULL AS existe`;
  if (!m?.existe) return null;
  // Com a coluna tipo (foto, video, normal); antes dela, captada vira vídeo e foto.
  const [comTipo] = await sql`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='vybe_escritorio_fatias' AND column_name='tipo') AS existe`;
  const f = {};
  if (comTipo?.existe) for (const l of await sql`SELECT papel,tipo,fatia FROM vybe_escritorio_fatias`) (f[l.papel] ||= {})[l.tipo] = Number(l.fatia);
  else for (const l of await sql`SELECT papel,captada,fatia FROM vybe_escritorio_fatias`) {
    const x = (f[l.papel] ||= {});
    if (l.captada) { x.video = Number(l.fatia); x.foto ??= Number(l.fatia); } else x.normal = Number(l.fatia);
  }
  return f;
}
// tipo: 'foto', 'video' ou 'normal' (true/false de antes valem vídeo/normal).
export function parteDoBolo(fatias, regra, tipo) {
  if (tipo === true) tipo = 'video'; else if (tipo === false) tipo = 'normal';
  const papel = PAPEL_DA_REGRA[regra];
  if (!papel || !fatias?.[papel]) return null;
  const da = regra === 'peca_da' ? fatias.direcao_arte || {} : null;
  const de = (k) => Math.round((fatias[papel][k] || 0) * (da ? da[k] || 0 : 1) * 10000) / 10000;
  if (tipo === undefined) return { foto: de('foto'), video: de('video'), normal: de('normal') };
  return de(tipo);
}
// O que cada missão vale, para a tela das missões: as regras por peça da
// função da pessoa e o peso de cada formato (2026-10-20-escritorio-complexidade).
// Sem a migração, as regras valem sem peso. A conta de verdade é do banco.
// Regras que nascem de uma peça (as que a missão pode prometer).
const REGRAS_DE_MISSAO = ['entrega', 'entrega_prazo', 'criacao_aprovacao', 'criacao_aprovada', 'captacao', 'carteira', 'agendamento', 'agencia', ...Object.keys(PAPEL_DA_REGRA)];
export async function tabelaDasMissoes(sql, funcao) {
  const [m] = await sql`SELECT to_regclass('public.vybe_escritorio_complexidade') IS NOT NULL AS existe`;
  const regras = m?.existe
    ? await sql`SELECT chave,descricao,moedas,pontos,por_complexidade FROM vybe_escritorio_regras WHERE ativa AND chave = ANY(${REGRAS_DE_MISSAO}) AND (funcao IS NULL OR funcao=${funcao})`
    : await sql`SELECT chave,descricao,moedas,pontos,false AS por_complexidade FROM vybe_escritorio_regras WHERE ativa AND chave = ANY(${REGRAS_DE_MISSAO}) AND (funcao IS NULL OR funcao=${funcao})`;
  const complexidade = m?.existe ? await sql`SELECT chave,nome,peso FROM vybe_escritorio_complexidade ORDER BY peso, nome` : [];
  return { regras: regras.map((r) => ({ ...r, moedas: Number(r.moedas), pontos: Number(r.pontos) })), complexidade: complexidade.map((c) => ({ ...c, peso: Number(c.peso) })) };
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

// Missões (Paulo, 19/10/2026): as peças abertas em que a pessoa é
// responsável, com o que cada uma vale pela regra da função dela e pelo peso
// do formato. É uma promessa calculada com a mesma tabela do banco; quem paga
// de verdade continua sendo o gatilho, no evento.
const QUADRO_DEMANDAS = '8385559107', QUADRO_PRODUCAO = '7829537690';
// Regra que paga cada função pela peça (a de Gestão e Atendimento paga quando
// a peça do cliente/da agência é finalizada ou aprovada).
const REGRA_DA_MISSAO = { criacao: ['criacao_aprovacao', 'criacao_aprovada'], producao: ['captacao'], agendamento: ['agendamento'], gestao: ['agencia'], atendimento: ['carteira'] };
export async function missoesDaPessoa(sql, pessoaId, agora = new Date()) {
  if (!await pontosProntos(sql)) return { disponivel: false, missoes: [] };
  const [f] = await sql`SELECT funcao FROM vybe_escritorio_funcoes WHERE pessoa_id=${pessoaId}`;
  const funcao = f?.funcao || null;
  const { regras } = await tabelaDasMissoes(sql, funcao);
  const regra = new Map(regras.map((r) => [r.chave, r]));
  const fatias = await fatiasDoBolo(sql);
  const [comPeso] = await sql`SELECT to_regprocedure('vybe_peso_conteudo(bigint)') IS NOT NULL AS existe`;
  const linhas = comPeso?.existe
    ? await sql`SELECT c.id,c.monday_item_id,c.board_id,c.titulo,c.formato,c.etapa,c.clientes_texto,TO_CHAR(c.prazo,'YYYY-MM-DD') AS prazo,TO_CHAR(c.veiculacao,'YYYY-MM-DD') AS veiculacao,s.rotulo AS status,vybe_peso_conteudo(c.id) AS peso
        FROM vybe_conteudos c JOIN vybe_conteudo_responsaveis r ON r.conteudo_id=c.id AND r.pessoa_id=${pessoaId}
        LEFT JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
        WHERE c.removido_em IS NULL AND NOT COALESCE(s.final,false)
        ORDER BY COALESCE(c.prazo,c.veiculacao) NULLS LAST, c.id LIMIT 40`
    : await sql`SELECT c.id,c.monday_item_id,c.board_id,c.titulo,c.formato,c.etapa,c.clientes_texto,TO_CHAR(c.prazo,'YYYY-MM-DD') AS prazo,TO_CHAR(c.veiculacao,'YYYY-MM-DD') AS veiculacao,s.rotulo AS status,1 AS peso
        FROM vybe_conteudos c JOIN vybe_conteudo_responsaveis r ON r.conteudo_id=c.id AND r.pessoa_id=${pessoaId}
        LEFT JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
        WHERE c.removido_em IS NULL AND NOT COALESCE(s.final,false)
        ORDER BY COALESCE(c.prazo,c.veiculacao) NULLS LAST, c.id LIMIT 40`;
  // Foto ou vídeo (a Produção entra no bolo e a fatia da Criação muda).
  // Foto, vídeo ou normal (muda a fatia de cada papel).
  const [comTipo] = fatias ? await sql`SELECT to_regprocedure('vybe_tipo_captacao(bigint)') IS NOT NULL AS existe` : [null];
  const tipos = new Map(fatias && linhas.length
    ? (comTipo?.existe
      ? await sql`SELECT id, vybe_tipo_captacao(id) AS tipo FROM unnest(${linhas.map((l) => l.id)}::bigint[]) AS id`
      : (await sql`SELECT id, CASE WHEN vybe_peca_captada(id) THEN 'video' ELSE 'normal' END AS tipo FROM unnest(${linhas.map((l) => l.id)}::bigint[]) AS id`)).map((r) => [String(r.id), r.tipo])
    : []);
  const hoje = diaBahia(agora);
  // Regra do bolo: a fatia do papel da pessoa (com ou sem captação) entra na conta.
  const valor = (r, peso, captada) => {
    if (!r) return null;
    const f = (r.por_complexidade ? peso : 1) * (fatias && PAPEL_DA_REGRA[r.chave] ? parteDoBolo(fatias, r.chave, captada) : 1);
    return { moedas: Math.round(r.moedas * f), pontos: Math.round(r.pontos * f) };
  };
  const missoes = linhas.map((l) => {
    const demanda = String(l.board_id) === QUADRO_DEMANDAS;
    const peso = Number(l.peso) || 1;
    const captada = tipos.get(String(l.id)) || 'normal';
    // Com o bolo, a regra é a parte da função; sem a migração, a regra antiga.
    const bolo = fatias && PAPEL_DA_FUNCAO[funcao] && regra.has(PAPEL_DA_FUNCAO[funcao]);
    const [principal, extra] = demanda ? [fatias && regra.has('peca_criacao') ? 'peca_criacao' : 'entrega', 'entrega_prazo']
      : bolo ? [PAPEL_DA_FUNCAO[funcao], funcao === 'criacao' ? 'criacao_aprovada' : null] : (REGRA_DA_MISSAO[funcao] || []);
    const quando = l.prazo || l.veiculacao || null;
    return {
      ref: l.monday_item_id ? String(l.monday_item_id) : 'vybe:' + l.id, quadro: demanda ? 'demandas' : 'producao',
      titulo: l.titulo || 'Sem título', cliente: l.clientes_texto || '', formato: l.formato || '', peso, status: l.status || '', grupo: l.etapa || '',
      // A data é o prazo; sem prazo, a veiculação. O tipo vai junto para a tela
      // sempre dizer qual das duas é (Paulo, 19/10/2026).
      prazo: quando, tipo_data: l.prazo ? 'prazo' : l.veiculacao ? 'veiculacao' : null, atrasada: Boolean(quando && quando < hoje), hoje: quando === hoje,
      recompensa: valor(regra.get(principal), peso, captada),
      bonus: extra && regra.get(extra) ? { ...valor(regra.get(extra), peso, captada), descricao: regra.get(extra).descricao } : null,
    };
  });
  return { disponivel: true, funcao, missoes };
}

// Ranking da semana (decisão do Paulo, 20/10/2026: "competição saudável").
// Zera toda segunda (semana da Bahia). Geral por % da própria meta da semana
// (justo entre funções diferentes), com XP e moedas da semana e um ranking
// por tipo de atividade. No fechamento da semana o pódio ganha prêmio e, se a
// agência bater a meta de peças, todo mundo ganha o bônus (valores em
// vybe_escritorio_regras; troféus em vybe_escritorio_catalogo.marco).
export const ATIVIDADES_DO_RANKING = [
  ['peca_criacao', 'Peças feitas'], ['peca_producao', 'Fotos e vídeos captados'], ['peca_da', 'Aprovações do DA'],
  ['peca_agendamento', 'Peças agendadas'], ['peca_atendimento', 'Peças da carteira'], ['cadastro', 'Demandas cadastradas'],
  ['briefing', 'Briefings escritos'], ['entrega_prazo', 'Entregas no prazo'], ['criacao_aprovada', 'Aprovadas de primeira'],
  ['peca_gestao', 'Peças da agência'], ['acao_painel', 'Ações no painel'],
];
const FORA_DO_RANKING = ['conquista', 'ranking_1', 'ranking_2', 'ranking_3', 'meta_agencia'];
export async function rankingProntoEscritorio(sql) {
  const [r] = await sql`SELECT EXISTS(SELECT 1 FROM vybe_escritorio_regras WHERE chave='ranking_1') AS existe`;
  return Boolean(r?.existe);
}
// Peças concluídas pela agência numa semana (cada peça uma vez, por qualquer papel do bolo).
async function pecasDaAgencia(sql, de, ate) {
  const [r] = await sql`SELECT count(DISTINCT conteudo_id)::int AS n FROM vybe_escritorio_entregas
    WHERE regra LIKE 'peca_%' AND conteudo_id IS NOT NULL AND dia >= ${de}::date AND dia <= ${ate}::date`;
  return Number(r?.n || 0);
}
// Meta da agência: média de peças por semana nas últimas 8 semanas completas.
async function metaDaAgencia(sql, inicio, semanas = 8) {
  const desde = somarDias(inicio, -7 * semanas);
  const linhas = await sql`SELECT TO_CHAR(date_trunc('week', dia),'YYYY-MM-DD') AS semana, count(DISTINCT conteudo_id)::int AS n
    FROM vybe_escritorio_entregas WHERE regra LIKE 'peca_%' AND conteudo_id IS NOT NULL AND dia >= ${desde}::date AND dia < ${inicio}::date GROUP BY 1`;
  const usadas = linhas.filter((l) => Number(l.n) > 0);
  if (!usadas.length) return 1;
  return Math.max(1, Math.round(usadas.reduce((t, l) => t + Number(l.n), 0) / usadas.length));
}
export async function rankingDaSemana(sql, agora = new Date(), inicio = inicioDaSemana(diaBahia(agora))) {
  if (!await pontosProntos(sql)) return { disponivel: false };
  const fim = somarDias(inicio, 6);
  const pessoas = await pessoasDoRanking(sql);
  const metas = await Promise.all(pessoas.map((p) => metaDaSemana(sql, p.pessoa_id, inicio)));
  const r = await rankingIntervalo(sql, { de: inicio, ate: fim, pessoas, metas, fator: 1, entregasDaMeta: true });
  const [pecas, metaAg] = await Promise.all([pecasDaAgencia(sql, inicio, fim), metaDaAgencia(sql, inicio)]);
  return { ...r, inicio, fim, agencia: agenciaDe(pecas, metaAg) };
}
const pessoasDoRanking = (sql) => sql`SELECT f.pessoa_id, f.funcao, p.nome FROM vybe_escritorio_funcoes f JOIN vybe_pessoas p ON p.id=f.pessoa_id
  WHERE p.ativo=TRUE ORDER BY p.nome`;
const agenciaDe = (pecas, meta) => { const m = Math.max(1, Math.round(meta)); return { pecas, meta: m, pct: Math.round((pecas / m) * 100), bateu: pecas >= m }; };
// Um período qualquer (dia, semana, mês ou desde sempre): entregas, XP e
// moedas do trabalho, o que cada um fez por atividade, o ritmo dia a dia (ou
// semana a semana) e o % da meta da semana na proporção do período (`fator`).
// Na semana, as entregas da meta vêm de metaDaSemana (a mesma conta do prêmio).
async function rankingIntervalo(sql, { de, ate, pessoas, metas, fator, entregasDaMeta = false, porSemana = false }) {
  const ganhos = await sql`SELECT pessoa_id, regra, count(*)::int AS n, COALESCE(sum(pontos),0)::int AS xp, COALESCE(sum(quantidade) FILTER (WHERE quantidade > 0),0)::int AS moedas
    FROM vybe_escritorio_moedas WHERE vybe_dia_bahia(criado_em) >= ${de}::date AND vybe_dia_bahia(criado_em) <= ${ate}::date
      AND regra IS NOT NULL AND NOT (regra = ANY(${FORA_DO_RANKING}::text[])) GROUP BY 1,2`;
  const ritmo = porSemana
    ? await sql`SELECT pessoa_id, date_trunc('week', vybe_dia_bahia(criado_em))::date::text AS dia, COALESCE(sum(pontos),0)::int AS xp
        FROM vybe_escritorio_moedas WHERE vybe_dia_bahia(criado_em) >= ${somarDias(ate, -83)}::date AND vybe_dia_bahia(criado_em) <= ${ate}::date
          AND regra IS NOT NULL AND NOT (regra = ANY(${FORA_DO_RANKING}::text[])) GROUP BY 1,2`
    : await sql`SELECT pessoa_id, vybe_dia_bahia(criado_em)::text AS dia, COALESCE(sum(pontos),0)::int AS xp
        FROM vybe_escritorio_moedas WHERE vybe_dia_bahia(criado_em) >= ${de}::date AND vybe_dia_bahia(criado_em) <= ${ate}::date
          AND regra IS NOT NULL AND NOT (regra = ANY(${FORA_DO_RANKING}::text[])) GROUP BY 1,2`;
  const contagem = await sql`SELECT e.pessoa_id, count(*)::int AS n FROM vybe_escritorio_entregas e JOIN vybe_escritorio_regras g ON g.chave=e.regra AND g.entrega
    WHERE e.dia >= ${de}::date AND e.dia <= ${ate}::date GROUP BY 1`;
  const lista = pessoas.map((p, k) => {
    const meus = ganhos.filter((g) => String(g.pessoa_id) === String(p.pessoa_id));
    const m = metas[k] || { meta: 1, entregas: 0 };
    const entregas = entregasDaMeta ? m.entregas : Number(contagem.find((c) => String(c.pessoa_id) === String(p.pessoa_id))?.n || 0);
    const meta = Math.max(1, Math.round(m.meta * fator));
    return {
      id: String(p.pessoa_id), nome: p.nome, funcao: p.funcao, meta, entregas, pct: Math.round((entregas / meta) * 100),
      xp: meus.reduce((t, g) => t + Number(g.xp), 0), moedas: meus.reduce((t, g) => t + Number(g.moedas), 0),
      atividades: Object.fromEntries(meus.map((g) => [g.regra, Number(g.n)])),
      xpPor: Object.fromEntries(meus.map((g) => [g.regra, Number(g.xp)])),
      ritmo: ritmo.filter((g) => String(g.pessoa_id) === String(p.pessoa_id)).map((g) => [g.dia, Number(g.xp)]),
    };
  });
  // Geral: % da meta, desempate pelo XP.
  lista.sort((a, b) => b.pct - a.pct || b.xp - a.xp || a.nome.localeCompare(b.nome));
  lista.forEach((p, i) => { p.posicao = p.entregas > 0 ? i + 1 : null; });
  // O que conta como entrega e de onde vem o XP de cada um (Paulo, 20/10/2026:
  // "22 de 22 o quê? quais foram? XP de onde?"). Títulos das peças do período.
  const [comTitulo] = await sql`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='vybe_conteudos' AND column_name='titulo') AS existe`;
  const entregas = comTitulo?.existe
    ? await sql`SELECT e.pessoa_id, e.regra, TO_CHAR(e.dia,'YYYY-MM-DD') AS dia, c.titulo, c.clientes_texto AS cliente FROM vybe_escritorio_entregas e
        JOIN vybe_escritorio_regras g ON g.chave=e.regra AND g.entrega LEFT JOIN vybe_conteudos c ON c.id=e.conteudo_id
        WHERE e.dia >= ${de}::date AND e.dia <= ${ate}::date ORDER BY e.dia DESC, e.origem LIMIT 3000`
    : await sql`SELECT e.pessoa_id, e.regra, TO_CHAR(e.dia,'YYYY-MM-DD') AS dia, NULL AS titulo, NULL AS cliente FROM vybe_escritorio_entregas e
        JOIN vybe_escritorio_regras g ON g.chave=e.regra AND g.entrega WHERE e.dia >= ${de}::date AND e.dia <= ${ate}::date ORDER BY e.dia DESC, e.origem LIMIT 3000`;
  for (const p of lista) {
    const minhas = entregas.filter((e) => String(e.pessoa_id) === p.id);
    p.porRegra = minhas.reduce((t, e) => ({ ...t, [e.regra]: (t[e.regra] || 0) + 1 }), {});
    p.pecas = minhas.slice(0, 40).map((e) => ({ regra: e.regra, dia: e.dia, titulo: e.titulo || null, cliente: e.cliente || null }));
  }
  const regras = Object.fromEntries((await sql`SELECT chave, descricao FROM vybe_escritorio_regras`).map((r) => [r.chave, r.descricao]));
  const premios = await sql`SELECT r.chave, r.moedas, r.pontos, c.classe FROM vybe_escritorio_regras r
    LEFT JOIN vybe_escritorio_catalogo c ON c.marco=r.chave WHERE r.chave = ANY(${['ranking_1', 'ranking_2', 'ranking_3', 'meta_agencia']}::text[]) AND r.ativa ORDER BY r.chave`;
  return { disponivel: true, pessoas: lista, regras, atividades: ATIVIDADES_DO_RANKING.map(([chave, nome]) => ({ chave, nome })),
    premios: premios.map((p) => ({ chave: p.chave, moedas: Number(p.moedas), pontos: Number(p.pontos), classe: p.classe || null })) };
}
// Dias seguidos entregando, até hoje (ou até ontem, se hoje ainda não teve).
async function sequencias(sql, hoje) {
  const linhas = await sql`SELECT pessoa_id, TO_CHAR(dia,'YYYY-MM-DD') AS dia FROM vybe_escritorio_entregas
    WHERE dia >= ${somarDias(hoje, -90)}::date AND dia <= ${hoje}::date GROUP BY 1,2`;
  const por = new Map();
  for (const l of linhas) { const k = String(l.pessoa_id); if (!por.has(k)) por.set(k, new Set()); por.get(k).add(l.dia); }
  const fora = (d) => diaDaSemana(d) > 5; // fim de semana não quebra a sequência
  const out = {};
  for (const [k, dias] of por) {
    let d = dias.has(hoje) ? hoje : somarDias(hoje, -1), n = 0;
    while (n < 90) { if (dias.has(d)) n++; else if (!fora(d)) break; d = somarDias(d, -1); }
    out[k] = n;
  }
  return out;
}
// O que a tela mostra: a semana atual e o resultado da anterior (pódio pago).
export async function rankingEscritorio(sql, agora = new Date(), { periodo = 'semana' } = {}) {
  if (!await pontosProntos(sql) || !await rankingProntoEscritorio(sql)) return { disponivel: false };
  const hoje = diaBahia(agora), semana = inicioDaSemana(hoje);
  const pessoas = await pessoasDoRanking(sql);
  const metas = await Promise.all(pessoas.map((p) => metaDaSemana(sql, p.pessoa_id, semana)));
  // Cada período e o anterior, para a seta de quem subiu ou desceu.
  const mes = hoje.slice(0, 8) + '01', fimMes = somarDias(somarDias(mes, 32).slice(0, 8) + '01', -1);
  const mesAntes = somarDias(mes, -1).slice(0, 8) + '01';
  const diasNoMes = Number(fimMes.slice(8)), diasMesAntes = Number(somarDias(mes, -1).slice(8));
  const P = {
    dia: { de: hoje, ate: hoje, fator: 1 / 5, antes: { de: somarDias(hoje, -1), ate: somarDias(hoje, -1), fator: 1 / 5 } },
    semana: { de: semana, ate: somarDias(semana, 6), fator: 1, entregasDaMeta: true, antes: { de: somarDias(semana, -7), ate: somarDias(semana, -1), fator: 1 } },
    mes: { de: mes, ate: fimMes, fator: diasNoMes / 7, antes: { de: mesAntes, ate: somarDias(mes, -1), fator: diasMesAntes / 7 } },
    total: { de: '2000-01-01', ate: hoje, fator: 1, porSemana: true },
  }[periodo] || null;
  if (!P) throw Object.assign(new Error('Período inválido.'), { status: 400 });
  const [atual, antes, seq] = await Promise.all([
    rankingIntervalo(sql, { ...P, pessoas, metas }),
    P.antes ? rankingIntervalo(sql, { ...P.antes, pessoas, metas }) : null,
    sequencias(sql, hoje),
  ]);
  const carteiras = await sql`SELECT pessoa_id, saldo, xp FROM vybe_escritorio_carteiras`;
  for (const p of atual.pessoas) {
    const ant = antes?.pessoas.find((x) => x.id === p.id);
    p.antes = ant?.posicao || null;
    p.sequencia = seq[p.id] || 0;
    const c = carteiras.find((x) => String(x.pessoa_id) === p.id);
    p.xpTotal = Number(c?.xp || 0); p.nivel = nivelPorXp(p.xpTotal).nivel;
  }
  // Desde sempre: vale o XP total (o nível), não o % da meta.
  if (periodo === 'total') {
    atual.pessoas.sort((a, b) => b.xpTotal - a.xpTotal || a.nome.localeCompare(b.nome));
    atual.pessoas.forEach((p, i) => { p.posicao = p.xpTotal > 0 ? i + 1 : null; });
  }
  const semanasNoPeriodo = { dia: 1 / 5, semana: 1, mes: diasNoMes / 7, total: 1 }[periodo];
  const [pecas, metaAg] = await Promise.all([pecasDaAgencia(sql, P.de, P.ate), metaDaAgencia(sql, semana)]);
  const anterior = somarDias(semana, -7);
  const pagos = await sql`SELECT m.pessoa_id, m.regra, p.nome FROM vybe_escritorio_moedas m JOIN vybe_pessoas p ON p.id=m.pessoa_id
    WHERE m.origem LIKE ${'ranking:' + anterior + ':%'} ORDER BY m.regra`;
  const [agenciaPaga] = await sql`SELECT count(*)::int AS n FROM vybe_escritorio_moedas WHERE origem LIKE ${'agencia-semana:' + anterior + '%'}`;
  // Mais rico e Colecionador (Paulo, 20/10/2026): de todos os tempos.
  const patrimonio = await sql`SELECT p.id, p.nome, f.funcao, COALESCE(c.saldo,0)::int AS saldo,
      COALESCE((SELECT sum(i.quantidade) FROM vybe_escritorio_inventario i WHERE i.pessoa_id=p.id),0)::int AS moveis,
      COALESCE((SELECT count(*) FROM vybe_escritorio_inventario i WHERE i.pessoa_id=p.id),0)::int AS distintos,
      COALESCE((SELECT sum(i.quantidade) FROM vybe_escritorio_inventario i JOIN vybe_escritorio_catalogo k ON k.classe=i.classe WHERE i.pessoa_id=p.id AND k.raridade='lendario'),0)::int AS lendarios,
      COALESCE((SELECT sum(i.quantidade) FROM vybe_escritorio_inventario i JOIN vybe_escritorio_catalogo k ON k.classe=i.classe WHERE i.pessoa_id=p.id AND k.raridade='epico'),0)::int AS epicos,
      COALESCE((SELECT sum(i.quantidade) FROM vybe_escritorio_inventario i JOIN vybe_escritorio_catalogo k ON k.classe=i.classe WHERE i.pessoa_id=p.id AND k.marco IS NOT NULL),0)::int AS trofeus
    FROM vybe_escritorio_funcoes f JOIN vybe_pessoas p ON p.id=f.pessoa_id LEFT JOIN vybe_escritorio_carteiras c ON c.pessoa_id=p.id
    WHERE p.ativo=TRUE ORDER BY p.nome`;
  return { ...atual, periodo, inicio: P.de === '2000-01-01' ? null : P.de, fim: P.ate, hoje,
    agencia: agenciaDe(pecas, metaAg * semanasNoPeriodo),
    patrimonio: patrimonio.map((p) => ({ ...p, id: String(p.id) })),
    anterior: { inicio: anterior, fim: somarDias(anterior, 6), podio: pagos.map((p) => ({ id: String(p.pessoa_id), nome: p.nome, posicao: Number(p.regra.slice(-1)) })), agenciaBateu: Number(agenciaPaga?.n || 0) > 0 } };
}
// Fecha o ranking de uma semana: 1º, 2º e 3º (com entrega na semana) ganham
// o prêmio e o troféu; meta da agência batida dá o bônus a todos. Uma vez só
// (marca em vybe_escritorio_fechamentos, origens únicas no razão).
async function fecharRankingSemana(tx, inicio) {
  if (!await rankingProntoEscritorio(tx)) return null;
  if (!await marcar(tx, 'ranking:' + inicio)) return null;
  const r = await rankingDaSemana(tx, new Date(), inicio);
  const fim = somarDias(inicio, 6), pagos = [];
  const podio = r.pessoas.filter((p) => p.entregas > 0 && p.pct > 0).slice(0, 3);
  for (const [i, p] of podio.entries()) {
    const chave = 'ranking_' + (i + 1);
    if (!await aplicar(tx, p.id, chave, `ranking:${inicio}:${i + 1}`, fim)) continue;
    const trofeu = r.premios.find((x) => x.chave === chave)?.classe;
    if (trofeu) await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${p.id},${trofeu},1)
      ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=vybe_escritorio_inventario.quantidade+1`;
    pagos.push({ id: p.id, posicao: i + 1 });
  }
  let agencia = 0;
  if (r.agencia.bateu) for (const p of r.pessoas) if (await aplicar(tx, p.id, 'meta_agencia', `agencia-semana:${inicio}`, fim)) agencia++;
  return { inicio, pagos, agencia };
}
