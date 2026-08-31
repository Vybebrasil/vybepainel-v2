// vybe_saneamento.js — correções determinísticas do cadastro próprio.
// Datas ausentes e disciplina não são inferidas: aparecem no relatório para decisão humana.

const ALIAS_GROUPS = [
  { canonical: 'Acquaville', variants: ['Acquavile', 'Acquaville'] },
  { canonical: 'Villa Real', variants: ['Vila Real', 'Villa Real'] },
  { canonical: 'ACE - Associação Comercial de Irecê (ACE)', variants: ['Associação Comercial', 'Ace - Associação Comercial', 'ACE - Associação Comercial de Irecê (ACE)'] },
  { canonical: 'Prefeitura Canarana/BA', variants: ['Prefeitura de Canarana', 'Prefeitura Canarana/BA'] },
  { canonical: 'João Bacelar', variants: ['Dep. João Bacelar', 'João Bacelar'] },
  { canonical: 'Óticas Menina dos Óculos', variants: ['Menina dos Oculos', 'Menina dos Óculos', 'Óticas Menina dos Óculos'] },
  { canonical: 'Mangaba AI', variants: ['Mangaba.ai', 'Mangaba AI'] },
  { canonical: 'De Bull', variants: ['deBULL', 'deBull', 'De Bull'] },
  { canonical: 'DiaCenter', variants: ['Dia Center', 'DiaCenter'] },
  { canonical: 'DiaLab', variants: ['DIALAB', 'DiaLab'] },
  { canonical: 'ConectaSim', variants: ['Conectasim', 'ConectaSim'] },
  { canonical: 'Copirecê', variants: ['Copirece', 'Copirecê'] },
  { canonical: 'Irecê Modas', variants: ['irecemodas', 'Irecê Modas'] },
  { canonical: 'Camarote Sertão', variants: ['Camarote sertão', 'Camarote Sertão'] },
  { canonical: 'Serra Grande Bebidas', variants: ['Grupo Serra Grande', 'Serra Grande', 'Serra Grande Bebidas'] },
  { canonical: 'Experimente Papelaria', variants: ['Experimente', 'Experimente Papelaria'] },
];

const GRUPOS = new Map([
  ['novo_grupo31348__1', 'Finalizados'],
  ['novo_grupo__1', 'Design & Edição'],
  ['novo_grupo57911__1', 'Produção ( Foto e Vídeo, à Captar )'],
  ['novo_grupo22352__1', 'Gestão de publicações'],
  ['group_title', 'Redação'],
  ['novo_grupo_mkkyx8pv', 'Concluídas'],
  ['novo_grupo_mkmkjdqd', 'A Fazer'],
  ['novo_grupo_mkkyfhtw', 'Em Execução'],
  ['group_mm187437', 'Novas Demandas/Ideias'],
]);

function chave(valor = '') {
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/dados\s*&\s*acessos\s*[-–—:]?\s*/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

const ACCESS_CLIENT_ALIASES = new Map([
  [chave('Assessoria Facilita'), chave('Facilita Assessoria')],
  [chave('Lions Top'), chave('Academia Lions Top')],
  [chave('Igor Rodrigues Lopes'), chave('Igor R. Lopes')],
  [chave('Ramon'), chave('Ramon Adv.')],
]);

function grupoDoNome(nome) {
  const k = chave(nome);
  return ALIAS_GROUPS.find((grupo) => grupo.variants.some((v) => chave(v) === k)) || null;
}

export function nomeCanonico(nome) {
  return grupoDoNome(nome)?.canonical || String(nome || '').trim();
}

async function mesclarCliente(sql, alias, mestre) {
  await sql`INSERT INTO vybe_conteudo_clientes (conteudo_id, cliente_id)
    SELECT conteudo_id, ${mestre.id} FROM vybe_conteudo_clientes WHERE cliente_id=${alias.id}
    ON CONFLICT DO NOTHING`;
  await sql`DELETE FROM vybe_conteudo_clientes WHERE cliente_id=${alias.id}`;
  await sql`UPDATE vybe_acessos SET cliente_id=${mestre.id}, atualizado_em=NOW() WHERE cliente_id=${alias.id}`;
  await sql`INSERT INTO vybe_cliente_pessoas (cliente_id, pessoa_id, ordem)
    SELECT ${mestre.id}, pessoa_id, ordem FROM vybe_cliente_pessoas WHERE cliente_id=${alias.id}
    ON CONFLICT DO NOTHING`;
  await sql`DELETE FROM vybe_cliente_pessoas WHERE cliente_id=${alias.id}`;
  await sql`DELETE FROM vybe_clientes WHERE id=${alias.id}`;
}

export async function sanearBaseMestre(sql, { aplicar = false } = {}) {
  let clientes = await sql`SELECT id, nome FROM vybe_clientes ORDER BY id`;
  const merges = [];

  for (const grupo of ALIAS_GROUPS) {
    const chaves = new Set(grupo.variants.map(chave));
    const membros = clientes.filter((c) => chaves.has(chave(c.nome)));
    if (!membros.length) continue;
    let mestre = membros.find((c) => c.nome === grupo.canonical)
      || membros.find((c) => c.nome.localeCompare(grupo.canonical, 'pt-BR', { sensitivity: 'accent' }) === 0)
      || membros[0];

    if (mestre.nome !== grupo.canonical) {
      merges.push({ origem: mestre.nome, destino: grupo.canonical, acao: 'renomear', alias_id: mestre.id, mestre_id: mestre.id });
      if (aplicar) await sql`UPDATE vybe_clientes SET nome=${grupo.canonical} WHERE id=${mestre.id}`;
      mestre = { ...mestre, nome: grupo.canonical };
    }

    for (const alias of membros) {
      if (Number(alias.id) === Number(mestre.id)) continue;
      merges.push({ origem: alias.nome, destino: mestre.nome, acao: 'mesclar', alias_id: alias.id, mestre_id: mestre.id });
      if (aplicar) await mesclarCliente(sql, alias, mestre);
    }
    if (aplicar) clientes = clientes.filter((c) => !membros.some((m) => Number(m.id) === Number(c.id)) || Number(c.id) === Number(mestre.id))
      .map((c) => Number(c.id) === Number(mestre.id) ? mestre : c);
  }

  const clientesDepois = aplicar ? await sql`SELECT id, nome FROM vybe_clientes ORDER BY id` : clientes;
  const canonicos = new Map(clientesDepois.map((c) => [chave(nomeCanonico(c.nome)), c]));
  const acessos = await sql`SELECT id, nome, cliente_id FROM vybe_acessos ORDER BY id`;
  const vinculos = [];
  for (const acesso of acessos) {
    const nomeBase = String(acesso.nome || '').replace(/^dados\s*&\s*acessos\s*[-–—:]?\s*/i, '').trim();
    const chaveBase = chave(nomeCanonico(nomeBase));
    const cliente = canonicos.get(ACCESS_CLIENT_ALIASES.get(chaveBase) || chaveBase);
    if (!cliente || Number(acesso.cliente_id) === Number(cliente.id)) continue;
    vinculos.push({ acesso_id: acesso.id, acesso: acesso.nome, cliente_id: cliente.id, cliente: cliente.nome, anterior: acesso.cliente_id });
    if (aplicar) await sql`UPDATE vybe_acessos SET cliente_id=${cliente.id}, atualizado_em=NOW() WHERE id=${acesso.id}`;
  }

  const itens = await sql`SELECT id, titulo, board_id, grupo_id, etapa
    FROM vybe_conteudos WHERE removido_em IS NULL`;
  const grupos = itens.filter((c) => GRUPOS.has(c.grupo_id) && c.etapa !== GRUPOS.get(c.grupo_id))
    .map((c) => ({ ...c, etapa_correta: GRUPOS.get(c.grupo_id) }));
  if (aplicar) {
    for (const item of grupos) await sql`UPDATE vybe_conteudos SET etapa=${item.etapa_correta}, atualizado_em=NOW() WHERE id=${item.id}`;
  }

  const semData = await sql`SELECT board_id, COUNT(*)::int AS total
    FROM vybe_conteudos WHERE removido_em IS NULL AND prazo IS NULL AND veiculacao IS NULL
    GROUP BY board_id ORDER BY board_id`;
  const acessosSemCliente = await sql`SELECT COUNT(*)::int AS total FROM vybe_acessos WHERE cliente_id IS NULL`;

  return {
    aplicar,
    aliases: merges,
    acessos_vinculados: vinculos,
    grupos_corrigidos: grupos,
    sem_data: semData,
    acessos_sem_cliente: Number(acessosSemCliente[0]?.total || 0),
  };
}
