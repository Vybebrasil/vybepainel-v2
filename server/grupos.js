// server/grupos.js — os grupos de cada quadro, editáveis pelo painel.
//
// Nome, cor e ordem dos grupos estavam escritos no código, em oito lugares, e
// criar ou renomear um grupo exigia publicar o painel de novo. Agora a lista
// mora aqui, e as telas leem dela. O id do grupo nunca muda: é ele que as
// atividades, as automações e o histórico guardam — renomear ou trocar a cor não
// mexe em atividade nenhuma além do nome da etapa.
export const BOARD_PRODUCAO = 7829537690;
export const BOARD_DEMANDAS = 8385559107;
export const GRUPO_TITULO_MAX = 60;

// A mesma paleta de etiqueta do quadro: cor livre deixava o painel ilegível no
// escuro, e é pela cor que o time reconhece a etapa sem ler.
export const CORES_DE_GRUPO = [
  '#579bfc', '#66ccff', '#a25ddc', '#9d50dd', '#ff5ac4', '#e2445c',
  '#ff642e', '#fdab3d', '#cab641', '#00c875', '#037f4c', '#7c8797',
];

// O ponto de partida é o que as telas mostravam: mesma ordem, mesmas cores.
export const GRUPOS_PADRAO = [
  { board_id: BOARD_PRODUCAO, grupo_id: 'group_title', titulo: 'Redação', cor: '#579bfc', ordem: 1 },
  { board_id: BOARD_PRODUCAO, grupo_id: 'novo_grupo57911__1', titulo: 'Produção (Foto e Vídeo)', cor: '#ff642e', ordem: 2 },
  { board_id: BOARD_PRODUCAO, grupo_id: 'novo_grupo__1', titulo: 'Design & Edição', cor: '#9d50dd', ordem: 3 },
  { board_id: BOARD_PRODUCAO, grupo_id: 'novo_grupo22352__1', titulo: 'Gestão de publicações', cor: '#fdab3d', ordem: 4 },
  { board_id: BOARD_PRODUCAO, grupo_id: 'novo_grupo31348__1', titulo: 'Finalizados', cor: '#00c875', ordem: 5 },
  { board_id: BOARD_DEMANDAS, grupo_id: 'group_mm187437', titulo: 'Novas Demandas/Ideias', cor: '#a25ddc', ordem: 1 },
  { board_id: BOARD_DEMANDAS, grupo_id: 'novo_grupo_mkmkjdqd', titulo: 'A Fazer', cor: '#579bfc', ordem: 2 },
  { board_id: BOARD_DEMANDAS, grupo_id: 'novo_grupo_mkkyfhtw', titulo: 'Em Execução', cor: '#fdab3d', ordem: 3 },
  { board_id: BOARD_DEMANDAS, grupo_id: 'novo_grupo_mkkyx8pv', titulo: 'Concluídas', cor: '#00c875', ordem: 4 },
];

// Onde o cadastro põe o que chega sem grupo escolhido: apagar este grupo
// deixaria a criação sem destino.
export const GRUPO_DE_ENTRADA = { [BOARD_PRODUCAO]: 'group_title', [BOARD_DEMANDAS]: 'group_mm187437' };

export async function criarTabelaDeGrupos(sql) {
  await sql`CREATE TABLE IF NOT EXISTS vybe_grupos (
    board_id     BIGINT NOT NULL,
    grupo_id     TEXT   NOT NULL,
    titulo       TEXT   NOT NULL,
    cor          TEXT   NOT NULL,
    ordem        INT    NOT NULL,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (board_id, grupo_id)
  )`;
  // Só semeia o que falta: rodar a conferência de novo não desfaz o que alguém
  // renomeou ou reordenou.
  for (const g of GRUPOS_PADRAO) {
    await sql`INSERT INTO vybe_grupos (board_id, grupo_id, titulo, cor, ordem)
      VALUES (${g.board_id}, ${g.grupo_id}, ${g.titulo}, ${g.cor}, ${g.ordem})
      ON CONFLICT (board_id, grupo_id) DO NOTHING`;
  }
}

export async function gruposProntos(sql) {
  const [r] = await sql`SELECT to_regclass('public.vybe_grupos') IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}

function quadroValido(board) {
  const b = Number(board);
  if (b !== BOARD_PRODUCAO && b !== BOARD_DEMANDAS) throw new Error('Quadro desconhecido.');
  return b;
}

const formatar = (g) => ({ board_id: Number(g.board_id), grupo_id: g.grupo_id, titulo: g.titulo,
  cor: g.cor, ordem: Number(g.ordem) });

// Sem a tabela (antes da conferência do banco), vale a lista de partida: a tela
// e as validações continuam funcionando exatamente como antes.
export async function listarGrupos(sql) {
  if (!await gruposProntos(sql)) return GRUPOS_PADRAO.map(formatar);
  const linhas = await sql`SELECT board_id, grupo_id, titulo, cor, ordem FROM vybe_grupos
    ORDER BY board_id, ordem, titulo`;
  return linhas.map(formatar);
}

export async function gruposDoQuadro(sql, board) {
  const b = Number(board);
  return (await listarGrupos(sql)).filter((g) => g.board_id === b);
}

function tituloLimpo(titulo) {
  const t = String(titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, GRUPO_TITULO_MAX);
  if (!t) throw new Error('Dê um nome ao grupo.');
  return t;
}

function corValida(cor) {
  const c = String(cor || '').toLowerCase();
  if (!CORES_DE_GRUPO.includes(c)) throw new Error('Escolha uma cor da paleta.');
  return c;
}

async function exigirTabela(sql) {
  if (!await gruposProntos(sql)) {
    throw new Error('A estrutura dos grupos ainda não existe no banco. Em Conta & Equipe, clique em "Conferir estrutura do banco".');
  }
}

// Alterações estruturais são raras: o lock de tabela serializa administradores
// sem bloquear leituras. As gravações de atividades usam FOR SHARE no destino.
const travaEstrutura = (sql) => sql.query('LOCK TABLE vybe_grupos IN EXCLUSIVE MODE');

export async function criarGrupo(sql, { board, titulo, cor, depois_de = null } = {}) {
  await exigirTabela(sql);
  const b = quadroValido(board), t = tituloLimpo(titulo), c = corValida(cor || '#7c8797');
  const id = `vybe_${crypto.randomUUID()}`;
  const [, linhas] = await sql.transaction([
    travaEstrutura(sql),
    sql`WITH posicao AS (
      SELECT COALESCE((SELECT ordem + 1 FROM vybe_grupos WHERE board_id=${b} AND grupo_id=${depois_de}),
        (SELECT COALESCE(MAX(ordem),0)+1 FROM vybe_grupos WHERE board_id=${b})) AS n
      WHERE NOT EXISTS (SELECT 1 FROM vybe_grupos WHERE board_id=${b} AND LOWER(titulo)=LOWER(${t}))
    ), deslocados AS (
      UPDATE vybe_grupos SET ordem=ordem+1 WHERE board_id=${b} AND ordem >= (SELECT n FROM posicao)
    ) INSERT INTO vybe_grupos (board_id,grupo_id,titulo,cor,ordem)
      SELECT ${b},${id},${t},${c},n FROM posicao RETURNING *`,
  ]);
  if (!linhas.length) throw new Error(`Já existe um grupo chamado "${t}" neste quadro.`);
  return formatar(linhas[0]);
}

export async function editarGrupo(sql, { board, grupo_id, titulo, cor } = {}) {
  await exigirTabela(sql);
  const b = quadroValido(board), id = String(grupo_id);
  const t = titulo === undefined ? null : tituloLimpo(titulo);
  const c = cor === undefined ? null : corValida(cor);
  const [, linhas] = await sql.transaction([
    travaEstrutura(sql),
    sql`WITH anterior AS (SELECT * FROM vybe_grupos WHERE board_id=${b} AND grupo_id=${id}),
    editado AS (
      UPDATE vybe_grupos g SET titulo=COALESCE(${t},g.titulo),cor=COALESCE(${c},g.cor),atualizado_em=NOW()
      WHERE g.board_id=${b} AND g.grupo_id=${id} AND NOT EXISTS (
        SELECT 1 FROM vybe_grupos outro WHERE outro.board_id=${b} AND outro.grupo_id<>${id}
          AND LOWER(outro.titulo)=LOWER(COALESCE(${t},g.titulo))) RETURNING g.*
    ), atividades AS (
      UPDATE vybe_conteudos SET etapa=e.titulo,atualizado_em=NOW() FROM editado e
      WHERE vybe_conteudos.board_id=e.board_id AND vybe_conteudos.grupo_id=e.grupo_id
        AND etapa IS DISTINCT FROM e.titulo
    ) SELECT e.*, e.titulo IS DISTINCT FROM a.titulo AS renomeado FROM editado e, anterior a`,
  ]);
  if (!linhas.length) throw new Error('Grupo não encontrado ou já existe um grupo chamado assim neste quadro.');
  return { ...formatar(linhas[0]), renomeado: linhas[0].renomeado };
}

export async function moverGrupoNaOrdem(sql, { board, grupo_id, direcao } = {}) {
  await exigirTabela(sql);
  const b = quadroValido(board), id = String(grupo_id), passo = Number(direcao)<0 ? -1 : 1;
  const [, linhas] = await sql.transaction([
    travaEstrutura(sql),
    sql`WITH lista AS (SELECT grupo_id, ROW_NUMBER() OVER (ORDER BY ordem,titulo,grupo_id)::int AS n
      FROM vybe_grupos WHERE board_id=${b}), alvo AS (SELECT n FROM lista WHERE grupo_id=${id}),
    vizinho AS (SELECT n FROM lista WHERE n=(SELECT n+${passo} FROM alvo)),
    movidos AS (UPDATE vybe_grupos g SET ordem=CASE
      WHEN l.n=(SELECT n FROM alvo) THEN (SELECT n FROM vizinho)
      WHEN l.n=(SELECT n FROM vizinho) THEN (SELECT n FROM alvo) ELSE l.n END, atualizado_em=NOW()
      FROM lista l WHERE g.board_id=${b} AND g.grupo_id=l.grupo_id AND EXISTS (SELECT 1 FROM vizinho)
      RETURNING g.grupo_id)
    SELECT EXISTS(SELECT 1 FROM alvo) AS existe, EXISTS(SELECT 1 FROM movidos) AS mudou`,
  ]);
  if (!linhas[0].existe) throw new Error('Grupo não encontrado.');
  return { board_id:b, grupos:await gruposDoQuadro(sql,b), sem_mudanca:!linhas[0].mudou };
}

export async function ordenarGrupos(sql, { board, ordem } = {}) {
  await exigirTabela(sql);
  const b=quadroValido(board), ids=Array.isArray(ordem)?ordem.map(String):[];
  if (!ids.length || new Set(ids).size!==ids.length) throw new Error('A lista de grupos mudou. Recarregue a página.');
  const [, linhas] = await sql.transaction([
    travaEstrutura(sql),
    sql`WITH lista AS (SELECT id,n FROM UNNEST(${ids}::text[]) WITH ORDINALITY AS x(id,n)), valido AS (
      SELECT 1 WHERE (SELECT COUNT(*) FROM vybe_grupos WHERE board_id=${b})=${ids.length}
        AND NOT EXISTS (SELECT 1 FROM lista l WHERE NOT EXISTS
          (SELECT 1 FROM vybe_grupos g WHERE g.board_id=${b} AND g.grupo_id=l.id)))
    UPDATE vybe_grupos g SET ordem=l.n,atualizado_em=NOW() FROM lista l
      WHERE g.board_id=${b} AND g.grupo_id=l.id AND EXISTS(SELECT 1 FROM valido) RETURNING g.grupo_id`,
  ]);
  if (linhas.length!==ids.length) throw new Error('A lista de grupos mudou enquanto você arrastava. Recarregue a página e tente de novo.');
  return { board_id:b, grupos:await gruposDoQuadro(sql,b) };
}

export async function apagarGrupo(sql, { board, grupo_id } = {}) {
  await exigirTabela(sql);
  const b=quadroValido(board), id=String(grupo_id);
  if (GRUPO_DE_ENTRADA[b]===id) throw new Error('Este é o grupo de entrada do cadastro e não pode ser apagado.');
  // Tabela ausente é diferente de falha: qualquer erro real aborta a exclusão.
  const [{ existe }] = await sql`SELECT to_regclass('public.vybe_automacoes') IS NOT NULL AS existe`;
  const aspas=JSON.stringify(id);
  const regras = existe ? sql`SELECT nome FROM vybe_automacoes
    WHERE POSITION(${aspas} IN acoes::text)>0 OR POSITION(${aspas} IN COALESCE(condicao::text,''))>0 LIMIT 1`
    : sql`SELECT NULL::text AS nome WHERE FALSE`;
  // A condição é repetida no DELETE para que nenhuma dependência seja ignorada.
  const apagar = existe ? sql`DELETE FROM vybe_grupos g WHERE g.board_id=${b} AND g.grupo_id=${id}
    AND (SELECT COUNT(*) FROM vybe_grupos WHERE board_id=${b})>1
    AND NOT EXISTS (SELECT 1 FROM vybe_conteudos WHERE board_id=${b} AND grupo_id=${id})
    AND NOT EXISTS (SELECT 1 FROM vybe_automacoes WHERE POSITION(${aspas} IN acoes::text)>0
      OR POSITION(${aspas} IN COALESCE(condicao::text,''))>0) RETURNING grupo_id`
    : sql`DELETE FROM vybe_grupos WHERE board_id=${b} AND grupo_id=${id}
      AND (SELECT COUNT(*) FROM vybe_grupos WHERE board_id=${b})>1
      AND NOT EXISTS (SELECT 1 FROM vybe_conteudos WHERE board_id=${b} AND grupo_id=${id}) RETURNING grupo_id`;
  const [, grupos, atividades, dependencias, apagados] = await sql.transaction([
    travaEstrutura(sql),
    sql`SELECT grupo_id FROM vybe_grupos WHERE board_id=${b}`,
    sql`SELECT COUNT(*)::int AS n FROM vybe_conteudos WHERE board_id=${b} AND grupo_id=${id}`,
    regras, apagar,
  ]);
  if (!grupos.some(g=>g.grupo_id===id)) throw new Error('Grupo não encontrado.');
  if (atividades[0].n>0) throw new Error(`O grupo tem ${atividades[0].n} atividades, incluindo arquivadas ou removidas. Mova ou restaure as atividades antes de apagar.`);
  if (dependencias.length) throw new Error(`A automação "${dependencias[0].nome}" usa este grupo. Ajuste a automação antes de apagar.`);
  if (!apagados.length) throw new Error('O quadro precisa de pelo menos um grupo.');
  return {board_id:b,grupo_id:id,apagado:true};
}

// O destino é lido e bloqueado na MESMA instrução que grava a atividade.
// Se a exclusão vencer a corrida, não há destino e a escrita não acontece.
export async function moverAtividadeParaGrupo(sql, { id, board, grupo }) {
  if (!await gruposProntos(sql)) {
    const g=GRUPOS_PADRAO.find(g=>g.board_id===Number(board)&&g.grupo_id===String(grupo));
    if (!g) throw new Error('Grupo não encontrado neste quadro.');
    return sql`UPDATE vybe_conteudos SET grupo_id=${grupo},etapa=${g.titulo},atualizado_em=NOW()
      WHERE id=${id} AND board_id=${board} RETURNING id,etapa`;
  }
  const linhas=await sql`WITH destino AS (SELECT titulo FROM vybe_grupos
      WHERE board_id=${board} AND grupo_id=${grupo} FOR SHARE)
    UPDATE vybe_conteudos SET grupo_id=${grupo},etapa=destino.titulo,atualizado_em=NOW() FROM destino
      WHERE id=${id} AND board_id=${board} RETURNING id,etapa`;
  if (!linhas.length) throw new Error('O grupo ou a atividade mudou. Recarregue e tente novamente.');
  return linhas;
}
