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

async function exigirNomeLivre(sql, board, titulo, excetoId = null) {
  const [igual] = await sql`SELECT grupo_id FROM vybe_grupos
    WHERE board_id = ${board} AND LOWER(titulo) = LOWER(${titulo})
      AND grupo_id IS DISTINCT FROM ${excetoId}`;
  if (igual) throw new Error(`Já existe um grupo chamado "${titulo}" neste quadro.`);
}

// O grupo novo entra logo abaixo do grupo em que a pessoa clicou; sem
// referência, no fim.
export async function criarGrupo(sql, { board, titulo, cor, depois_de = null } = {}) {
  await exigirTabela(sql);
  const b = quadroValido(board);
  const t = tituloLimpo(titulo);
  const c = corValida(cor || '#7c8797');
  await exigirNomeLivre(sql, b, t);
  const grupos = await gruposDoQuadro(sql, b);
  const ref = grupos.find((g) => g.grupo_id === depois_de);
  const ordem = ref ? ref.ordem + 1 : (grupos.at(-1)?.ordem || 0) + 1;
  const id = `vybe_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await sql.transaction([
    sql`UPDATE vybe_grupos SET ordem = ordem + 1 WHERE board_id = ${b} AND ordem >= ${ordem}`,
    sql`INSERT INTO vybe_grupos (board_id, grupo_id, titulo, cor, ordem) VALUES (${b}, ${id}, ${t}, ${c}, ${ordem})`,
  ]);
  return { board_id: b, grupo_id: id, titulo: t, cor: c, ordem };
}

// A coluna 'etapa' das atividades guarda o NOME do grupo, e é dela que a
// listagem tira o campo 'grupo'. Renomear sem ela deixaria as atividades com o
// nome antigo — por isso as duas mudam juntas.
export async function editarGrupo(sql, { board, grupo_id, titulo, cor } = {}) {
  await exigirTabela(sql);
  const b = quadroValido(board);
  const [atual] = await sql`SELECT titulo, cor FROM vybe_grupos WHERE board_id = ${b} AND grupo_id = ${String(grupo_id)}`;
  if (!atual) throw new Error('Grupo não encontrado.');
  const t = titulo === undefined ? atual.titulo : tituloLimpo(titulo);
  const c = cor === undefined ? atual.cor : corValida(cor);
  if (t !== atual.titulo) await exigirNomeLivre(sql, b, t, String(grupo_id));
  await sql.transaction([
    sql`UPDATE vybe_grupos SET titulo = ${t}, cor = ${c}, atualizado_em = NOW()
      WHERE board_id = ${b} AND grupo_id = ${String(grupo_id)}`,
    sql`UPDATE vybe_conteudos SET etapa = ${t}, atualizado_em = NOW()
      WHERE board_id = ${b} AND grupo_id = ${String(grupo_id)} AND etapa IS DISTINCT FROM ${t}`,
  ]);
  return { board_id: b, grupo_id: String(grupo_id), titulo: t, cor: c, renomeado: t !== atual.titulo };
}

// Sobe ou desce uma posição, trocando de lugar com o vizinho.
export async function moverGrupoNaOrdem(sql, { board, grupo_id, direcao } = {}) {
  await exigirTabela(sql);
  const b = quadroValido(board);
  const passo = Number(direcao) < 0 ? -1 : 1;
  const grupos = await gruposDoQuadro(sql, b);
  const i = grupos.findIndex((g) => g.grupo_id === String(grupo_id));
  if (i < 0) throw new Error('Grupo não encontrado.');
  const j = i + passo;
  if (j < 0 || j >= grupos.length) return { board_id: b, grupos, sem_mudanca: true };
  // Renumera o quadro inteiro: ordens repetidas (de uma edição à mão no banco)
  // fariam a troca não mudar nada na tela.
  const nova = grupos.map((g) => g.grupo_id);
  [nova[i], nova[j]] = [nova[j], nova[i]];
  await sql.transaction(nova.map((id, k) =>
    sql`UPDATE vybe_grupos SET ordem = ${k + 1}, atualizado_em = NOW() WHERE board_id = ${b} AND grupo_id = ${id}`));
  return { board_id: b, grupos: await gruposDoQuadro(sql, b) };
}

// Arrastar solta o grupo em qualquer posição: a tela manda a ordem inteira.
// A lista tem de ter exatamente os grupos do quadro — nem um a mais, nem um a
// menos —, senão uma tela desatualizada apagaria da ordem um grupo que outra
// pessoa acabou de criar.
export async function ordenarGrupos(sql, { board, ordem } = {}) {
  await exigirTabela(sql);
  const b = quadroValido(board);
  const ids = Array.isArray(ordem) ? ordem.map(String) : [];
  const atuais = (await gruposDoQuadro(sql, b)).map((g) => g.grupo_id);
  const mesmos = ids.length === atuais.length && new Set(ids).size === ids.length
    && ids.every((id) => atuais.includes(id));
  if (!mesmos) throw new Error('A lista de grupos mudou enquanto você arrastava. Recarregue a página e tente de novo.');
  await sql.transaction(ids.map((id, k) =>
    sql`UPDATE vybe_grupos SET ordem = ${k + 1}, atualizado_em = NOW() WHERE board_id = ${b} AND grupo_id = ${id}`));
  return { board_id: b, grupos: await gruposDoQuadro(sql, b) };
}

// Apagar só grupo vazio: grupo com atividade dentro sumiria com elas da tela.
// Quem quer apagar move as atividades antes — a tela diz isso.
export async function apagarGrupo(sql, { board, grupo_id } = {}) {
  await exigirTabela(sql);
  const b = quadroValido(board);
  const id = String(grupo_id);
  if (GRUPO_DE_ENTRADA[b] === id) throw new Error('Este é o grupo de entrada do cadastro e não pode ser apagado.');
  const grupos = await gruposDoQuadro(sql, b);
  if (!grupos.some((g) => g.grupo_id === id)) throw new Error('Grupo não encontrado.');
  if (grupos.length <= 1) throw new Error('O quadro precisa de pelo menos um grupo.');
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM vybe_conteudos
    WHERE board_id = ${b} AND grupo_id = ${id} AND removido_em IS NULL`;
  if (n > 0) throw new Error(`O grupo tem ${n} ${n === 1 ? 'atividade' : 'atividades'}. Mova para outro grupo antes de apagar.`);
  // Automação que manda para este grupo passaria a mandar para lugar nenhum.
  // POSITION e não LIKE: o sublinhado dos ids do Monday é curinga no LIKE.
  const aspas = `"${id}"`;
  let regra = null;
  try {
    [regra] = await sql`SELECT nome FROM vybe_automacoes
      WHERE POSITION(${aspas} IN acoes::text) > 0 OR POSITION(${aspas} IN COALESCE(condicao::text, '')) > 0
      LIMIT 1`;
  } catch { /* sem a tabela de automações, não há regra que dependa do grupo */ }
  if (regra) throw new Error(`A automação "${regra.nome}" usa este grupo. Ajuste a automação antes de apagar.`);
  await sql`DELETE FROM vybe_grupos WHERE board_id = ${b} AND grupo_id = ${id}`;
  return { board_id: b, grupo_id: id, apagado: true };
}
