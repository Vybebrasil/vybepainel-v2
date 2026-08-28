// vybe_dominio_store.js — o modelo de negócio da Vybe, em tabelas próprias.
//
// O espelho (vybe_mirror_items) guarda a resposta do Monday como veio: JSONB cru,
// com chave board_id + item_id. É uma fotocópia, não um modelo — o dado só significa
// alguma coisa junto das definições de coluna que moram no Monday.
//
// Estas tabelas descrevem a operação com o vocabulário de vocês. Enquanto a migração
// não termina elas são populadas A PARTIR do espelho e ninguém escreve nelas pelo
// painel; nada aqui altera o comportamento atual.
//
// Duas colunas do Monday são multi-seleção, o que o painel de hoje ignora:
//   cliente  — 3 itens têm dois clientes ("VOA, Antonov"), hoje contabilizados como
//              se fossem um cliente separado, então não somam para nenhum dos dois
//   formato  — combinações como "Carrossel, Fotografia"
// O cliente virou relação N:N (modelo correto). O formato continua texto por ora, e
// `clientes_texto` guarda a string original para o painel seguir idêntico até a troca.

import { neon } from '@neondatabase/serverless';
import { getMirrorSnapshot, mondayQuery } from './operational_mirror_store.js';

export const BOARD_PRODUCAO = 7829537690;

// Papel e disciplina não existem no Monday: são regra de negócio de vocês, hoje
// espalhada no vybe-config.js do cliente. Aqui vira semente do cadastro de pessoas.
const PAPEIS = {
  '68997024': { papel: 'Direção de Arte', disciplina: 'design' },
  '71130408': { papel: 'Designer', disciplina: 'design' },
  '100482777': { papel: 'Designer Jr.', disciplina: 'design' },
  '68036697': { papel: 'Edição & Motion', disciplina: 'audiovisual' },
};

// Clientes fora de operação. Hoje esta lista vive em CLIENTES_INATIVOS no
// vybe-config.js, do lado do navegador, e some 107 conteúdos da tela por regra
// de código. Isso é cadastro, não código: passa a viver em vybe_clientes.ativo.
const CLIENTES_INATIVOS = new Set(["acquaville","blog ace","camarote sertão","camarote sertao","cavaco de pau","comunidade facilite entre mães","comunidade facilite entre maes","comunidade fora da curva","daniela filgueira","dialab","dogrun","facilite aprender","feijão panela de ouro","feijao panela de ouro","gyn protect","igor r. lopes","igor r lopes","lucas deotti","vila real","vybe","armazém container","armazem container","fa","psi - jaine","psi jaine"]);

function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

function chaveStatus(rotulo) {
  return String(rotulo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const coluna = (item, id) => (item.column_values || []).find((c) => c.id === id) || null;
const texto = (item, id) => String(coluna(item, id)?.text || '').trim();
const lista = (item, id) => texto(item, id).split(',').map((s) => s.trim()).filter(Boolean);

// O Monday entrega data ora como '2026-07-25', ora com hora junto:
// '2026-07-25 00:00' ou '2026-01-28 18:30'. O processItems do painel resolve com
// slice(0,10); exigir a string inteira no formato ISO descartava esses itens.
function dataOuNulo(valor) {
  const iso = String(valor || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function pessoasDoItem(item) {
  const bruto = coluna(item, 'person')?.value;
  if (!bruto || bruto === 'null') return [];
  try {
    const { personsAndTeams } = JSON.parse(bruto) || {};
    return (personsAndTeams || []).filter((p) => p.kind === 'person').map((p) => String(p.id));
  } catch {
    return [];
  }
}

export async function criarSchema() {
  const sql = database();

  await sql`CREATE TABLE IF NOT EXISTS vybe_clientes (
    id        BIGSERIAL PRIMARY KEY,
    nome      TEXT NOT NULL UNIQUE,
    ativo     BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS vybe_pessoas (
    id             BIGSERIAL PRIMARY KEY,
    nome           TEXT NOT NULL,
    papel          TEXT,
    disciplina     TEXT,
    ativo          BOOLEAN NOT NULL DEFAULT TRUE,
    monday_user_id TEXT UNIQUE,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  // As cores hoje vêm coladas em cada um dos 1.969 itens, porque acompanham a
  // resposta do Monday. Aqui viram 18 linhas.
  await sql`CREATE TABLE IF NOT EXISTS vybe_status (
    chave        TEXT PRIMARY KEY,
    rotulo       TEXT NOT NULL,
    cor          TEXT NOT NULL,
    borda        TEXT,
    ordem        INT NOT NULL,
    monday_index INT UNIQUE,
    final        BOOLEAN NOT NULL DEFAULT FALSE
  )`;

  await sql`CREATE TABLE IF NOT EXISTS vybe_conteudos (
    id                   BIGSERIAL PRIMARY KEY,
    titulo               TEXT NOT NULL,
    formato              TEXT,
    clientes_texto       TEXT,
    status_chave         TEXT REFERENCES vybe_status(chave),
    etapa                TEXT,
    prazo                DATE,
    veiculacao           DATE,
    briefing             TEXT,
    monday_item_id       TEXT UNIQUE,
    monday_atualizado_em TIMESTAMPTZ,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS vybe_conteudo_clientes (
    conteudo_id BIGINT NOT NULL REFERENCES vybe_conteudos(id) ON DELETE CASCADE,
    cliente_id  BIGINT NOT NULL REFERENCES vybe_clientes(id),
    PRIMARY KEY (conteudo_id, cliente_id)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS vybe_conteudo_responsaveis (
    conteudo_id BIGINT NOT NULL REFERENCES vybe_conteudos(id) ON DELETE CASCADE,
    pessoa_id   BIGINT NOT NULL REFERENCES vybe_pessoas(id),
    PRIMARY KEY (conteudo_id, pessoa_id)
  )`;

  // Hoje cada mudança vira prosa dentro de um update do Monday
  // ("[Vybe OS · Responsáveis atualizados] Anterior: X Novo: Y"). Aqui vira registro
  // consultável: dá para responder quanto tempo cada peça fica em cada etapa.
  await sql`CREATE TABLE IF NOT EXISTS vybe_conteudo_eventos (
    id          BIGSERIAL PRIMARY KEY,
    conteudo_id BIGINT NOT NULL REFERENCES vybe_conteudos(id) ON DELETE CASCADE,
    tipo        TEXT NOT NULL,
    de          TEXT,
    para        TEXT,
    autor_id    BIGINT REFERENCES vybe_pessoas(id),
    texto       TEXT,
    em          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  // O espelho traz updates(limit: 3), então 539 itens estão com histórico
  // truncado. Aqui cabe o histórico inteiro.
  await sql`CREATE TABLE IF NOT EXISTS vybe_conteudo_updates (
    id               BIGSERIAL PRIMARY KEY,
    conteudo_id      BIGINT NOT NULL REFERENCES vybe_conteudos(id) ON DELETE CASCADE,
    monday_update_id TEXT UNIQUE,
    corpo            TEXT,
    autor            TEXT,
    criado_em        TIMESTAMPTZ
  )`;

  // Só metadados. O binário continua hospedado no Monday: são ~1.800 arquivos e
  // ~7 GB, e movê-los é migração de storage, não de schema. Guardar nome, tamanho
  // e URL já permite listar anexos sem consultar o Monday.
  await sql`CREATE TABLE IF NOT EXISTS vybe_conteudo_arquivos (
    id              BIGSERIAL PRIMARY KEY,
    conteudo_id     BIGINT NOT NULL REFERENCES vybe_conteudos(id) ON DELETE CASCADE,
    monday_asset_id TEXT UNIQUE,
    nome            TEXT,
    extensao        TEXT,
    tamanho_bytes   BIGINT,
    url_monday      TEXT,
    url_publica     TEXT,
    criado_em       TIMESTAMPTZ
  )`;

  await sql`CREATE INDEX IF NOT EXISTS vybe_conteudo_updates_idx ON vybe_conteudo_updates (conteudo_id, criado_em DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS vybe_conteudo_arquivos_idx ON vybe_conteudo_arquivos (conteudo_id)`;
  await sql`CREATE INDEX IF NOT EXISTS vybe_conteudos_veiculacao_idx ON vybe_conteudos (veiculacao)`;
  await sql`CREATE INDEX IF NOT EXISTS vybe_conteudos_prazo_idx ON vybe_conteudos (prazo)`;
  await sql`CREATE INDEX IF NOT EXISTS vybe_conteudos_status_idx ON vybe_conteudos (status_chave)`;
  await sql`CREATE INDEX IF NOT EXISTS vybe_conteudo_eventos_idx ON vybe_conteudo_eventos (conteudo_id, em DESC)`;

  return { ok: true };
}

// Popula a partir do espelho. Idempotente: rodar de novo atualiza, não duplica.
export async function popularDoEspelho() {
  await criarSchema();
  const sql = database();
  const espelho = await getMirrorSnapshot();
  const itens = espelho.items || [];
  if (!itens.length) throw new Error('O espelho está vazio; rode a reconciliação antes.');

  // ── status ────────────────────────────────────────────────────────────────
  const finais = new Set(['Finalizado', 'Feito', 'Concluído', 'Concluido']);
  for (const opcao of espelho.status_options || []) {
    await sql`INSERT INTO vybe_status (chave, rotulo, cor, borda, ordem, monday_index, final)
      VALUES (${chaveStatus(opcao.label)}, ${opcao.label}, ${opcao.color}, ${opcao.border || opcao.color},
              ${opcao.index}, ${opcao.index}, ${finais.has(opcao.label)})
      ON CONFLICT (chave) DO UPDATE SET rotulo=EXCLUDED.rotulo, cor=EXCLUDED.cor,
        borda=EXCLUDED.borda, ordem=EXCLUDED.ordem, monday_index=EXCLUDED.monday_index,
        final=EXCLUDED.final`;
  }

  // ── clientes ──────────────────────────────────────────────────────────────
  const nomesClientes = new Set();
  for (const item of itens) lista(item, 'lista_suspensa_mkmqnjbv').forEach((n) => nomesClientes.add(n));
  for (const nome of nomesClientes) {
    await sql`INSERT INTO vybe_clientes (nome) VALUES (${nome}) ON CONFLICT (nome) DO NOTHING`;
  }
  await sql`UPDATE vybe_clientes SET ativo = NOT (LOWER(nome) = ANY(${Array.from(CLIENTES_INATIVOS)}))`;

  const clientePorNome = new Map(
    (await sql`SELECT id, nome FROM vybe_clientes`).map((r) => [r.nome, Number(r.id)])
  );

  // ── pessoas ───────────────────────────────────────────────────────────────
  // O nome só é confiável quando o item tem exatamente um responsável: o campo
  // "text" do Monday junta os nomes numa string só, sem separar por id.
  const nomePorId = new Map();
  const idsPessoas = new Set();
  for (const item of itens) {
    const ids = pessoasDoItem(item);
    ids.forEach((id) => idsPessoas.add(id));
    if (ids.length === 1) nomePorId.set(ids[0], texto(item, 'person'));
  }
  for (const id of idsPessoas) {
    const extra = PAPEIS[id] || {};
    await sql`INSERT INTO vybe_pessoas (nome, papel, disciplina, monday_user_id)
      VALUES (${nomePorId.get(id) || `Pessoa ${id}`}, ${extra.papel || null}, ${extra.disciplina || null}, ${id})
      ON CONFLICT (monday_user_id) DO UPDATE SET
        nome = COALESCE(NULLIF(EXCLUDED.nome, ''), vybe_pessoas.nome),
        papel = COALESCE(EXCLUDED.papel, vybe_pessoas.papel),
        disciplina = COALESCE(EXCLUDED.disciplina, vybe_pessoas.disciplina)`;
  }
  const pessoaPorMonday = new Map(
    (await sql`SELECT id, monday_user_id FROM vybe_pessoas WHERE monday_user_id IS NOT NULL`)
      .map((r) => [r.monday_user_id, Number(r.id)])
  );

  // ── conteúdos ─────────────────────────────────────────────────────────────
  // Em lote: item a item seriam ~4 consultas x 1.969 itens = 8 mil idas ao banco,
  // muito além do tempo de uma função serverless. jsonb_to_recordset resolve em uma.
  const registros = itens.map((item) => ({
    titulo: item.name || 'Sem título',
    formato: texto(item, 'lista_suspensa0__1') || null,
    clientes_texto: texto(item, 'lista_suspensa_mkmqnjbv') || null,
    status_chave: texto(item, 'status') ? chaveStatus(texto(item, 'status')) : null,
    etapa: item.group?.title || null,
    prazo: dataOuNulo(texto(item, 'data')),
    veiculacao: dataOuNulo(texto(item, 'data__1')),
    monday_item_id: String(item.id),
    monday_atualizado_em: item.updated_at || null,
  }));

  await sql`INSERT INTO vybe_conteudos
    (titulo, formato, clientes_texto, status_chave, etapa, prazo, veiculacao,
     monday_item_id, monday_atualizado_em, atualizado_em)
    SELECT r.titulo, r.formato, r.clientes_texto, r.status_chave, r.etapa, r.prazo,
           r.veiculacao, r.monday_item_id, r.monday_atualizado_em, NOW()
    FROM jsonb_to_recordset(${JSON.stringify(registros)}::jsonb) AS r(
      titulo text, formato text, clientes_texto text, status_chave text, etapa text,
      prazo date, veiculacao date, monday_item_id text, monday_atualizado_em timestamptz)
    ON CONFLICT (monday_item_id) DO UPDATE SET
      titulo=EXCLUDED.titulo, formato=EXCLUDED.formato, clientes_texto=EXCLUDED.clientes_texto,
      status_chave=EXCLUDED.status_chave, etapa=EXCLUDED.etapa, prazo=EXCLUDED.prazo,
      veiculacao=EXCLUDED.veiculacao, monday_atualizado_em=EXCLUDED.monday_atualizado_em,
      atualizado_em=NOW()`;

  const conteudoPorMonday = new Map(
    (await sql`SELECT id, monday_item_id FROM vybe_conteudos WHERE monday_item_id IS NOT NULL`)
      .map((r) => [r.monday_item_id, Number(r.id)])
  );

  // ── vínculos N:N, também em lote ──────────────────────────────────────────
  const vinculosCliente = [];
  const vinculosResponsavel = [];
  for (const item of itens) {
    const conteudoId = conteudoPorMonday.get(String(item.id));
    if (!conteudoId) continue;
    for (const nome of lista(item, 'lista_suspensa_mkmqnjbv')) {
      const clienteId = clientePorNome.get(nome);
      if (clienteId) vinculosCliente.push({ conteudo_id: conteudoId, cliente_id: clienteId });
    }
    for (const mondayId of pessoasDoItem(item)) {
      const pessoaId = pessoaPorMonday.get(mondayId);
      if (pessoaId) vinculosResponsavel.push({ conteudo_id: conteudoId, pessoa_id: pessoaId });
    }
  }

  await sql`TRUNCATE vybe_conteudo_clientes`;
  if (vinculosCliente.length) {
    await sql`INSERT INTO vybe_conteudo_clientes (conteudo_id, cliente_id)
      SELECT v.conteudo_id, v.cliente_id
      FROM jsonb_to_recordset(${JSON.stringify(vinculosCliente)}::jsonb)
        AS v(conteudo_id bigint, cliente_id bigint)
      ON CONFLICT DO NOTHING`;
  }

  await sql`TRUNCATE vybe_conteudo_responsaveis`;
  if (vinculosResponsavel.length) {
    await sql`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id)
      SELECT v.conteudo_id, v.pessoa_id
      FROM jsonb_to_recordset(${JSON.stringify(vinculosResponsavel)}::jsonb)
        AS v(conteudo_id bigint, pessoa_id bigint)
      ON CONFLICT DO NOTHING`;
  }

  return {
    itens_no_espelho: itens.length,
    conteudos_gravados: conteudoPorMonday.size,
    vinculos_cliente: vinculosCliente.length,
    vinculos_responsavel: vinculosResponsavel.length,
  };
}

// Conferência: os números daqui têm que bater com os do espelho.
export async function resumo() {
  const sql = database();
  const linhas = await sql`SELECT
    (SELECT COUNT(*) FROM vybe_clientes)              AS clientes,
    (SELECT COUNT(*) FROM vybe_pessoas)               AS pessoas,
    (SELECT COUNT(*) FROM vybe_status)                AS status,
    (SELECT COUNT(*) FROM vybe_conteudos)             AS conteudos,
    (SELECT COUNT(*) FROM vybe_conteudo_clientes)     AS vinculos_cliente,
    (SELECT COUNT(*) FROM vybe_conteudo_responsaveis) AS vinculos_responsavel,
    (SELECT COUNT(*) FROM vybe_conteudos WHERE veiculacao IS NOT NULL) AS com_veiculacao,
    (SELECT COUNT(*) FROM vybe_conteudos WHERE prazo IS NOT NULL)      AS com_prazo,
    (SELECT COUNT(*) FROM (
       SELECT conteudo_id FROM vybe_conteudo_clientes
       GROUP BY conteudo_id HAVING COUNT(*) > 1) AS m)                 AS conteudos_multi_cliente`;
  return linhas[0] || {};
}

// Leitura para o painel: mesma regra de recorte que o processItems aplica hoje no
// navegador — precisa de pelo menos um cliente ativo e de pelo menos uma das duas
// datas. A diferença é que agora a regra mora no banco, não em JavaScript.
export async function listarConteudos() {
  const sql = database();
  const linhas = await sql`
    SELECT
      c.monday_item_id                          AS id,
      c.titulo                                  AS nome,
      c.formato,
      c.etapa                                   AS grupo,
      TO_CHAR(c.prazo, 'YYYY-MM-DD')            AS prazo_iso,
      TO_CHAR(c.veiculacao, 'YYYY-MM-DD')       AS veiculacao_iso,
      c.monday_atualizado_em                    AS updated_at,
      s.rotulo                                  AS status,
      s.cor                                     AS status_color,
      s.borda                                   AS status_border,
      s.monday_index                            AS status_index,
      COALESCE(
        (SELECT ARRAY_AGG(cl.nome ORDER BY cl.nome)
           FROM vybe_conteudo_clientes vcc
           JOIN vybe_clientes cl ON cl.id = vcc.cliente_id
          WHERE vcc.conteudo_id = c.id AND cl.ativo), '{}') AS clientes,
      COALESCE(
        (SELECT ARRAY_AGG(p.monday_user_id ORDER BY p.nome)
           FROM vybe_conteudo_responsaveis vcr
           JOIN vybe_pessoas p ON p.id = vcr.pessoa_id
          WHERE vcr.conteudo_id = c.id), '{}') AS responsavel_ids
    FROM vybe_conteudos c
    LEFT JOIN vybe_status s ON s.chave = c.status_chave
    WHERE (c.prazo IS NOT NULL OR c.veiculacao IS NOT NULL)
      AND EXISTS (
        SELECT 1 FROM vybe_conteudo_clientes vcc
          JOIN vybe_clientes cl ON cl.id = vcc.cliente_id
         WHERE vcc.conteudo_id = c.id AND cl.ativo)
    ORDER BY c.veiculacao NULLS LAST, c.id`;

  return linhas.map((l) => ({
    ...l,
    cliente: (l.clientes || [])[0] || '',   // o painel usa o primeiro cliente ativo
  }));
}

// Sincroniza histórico e anexos a partir do Monday, em páginas.
// O espelho traz updates(limit: 3); aqui buscamos até 100 por item, junto dos
// metadados de anexo. É paginado e retoma pelo cursor porque o board tem quase
// 2.000 itens e uma função serverless não aguenta tudo numa tanacada.
export async function sincronizarHistorico(cursor = null, paginas = 1) {
  await criarSchema();
  const sql = database();

  const conteudoPorMonday = new Map(
    (await sql`SELECT id, monday_item_id FROM vybe_conteudos WHERE monday_item_id IS NOT NULL`)
      .map((r) => [r.monday_item_id, Number(r.id)])
  );

  const campos = `id updates(limit: 100) { id body created_at creator { name } }
    assets { id name url public_url file_extension file_size created_at }`;

  let proximo = cursor;
  let itensVistos = 0;
  let updatesGravados = 0;
  let arquivosGravados = 0;

  for (let p = 0; p < paginas; p++) {
    const query = proximo
      ? `query($cursor: String!) { next_items_page(limit: 100, cursor: $cursor) { cursor items { ${campos} } } }`
      : `{ boards(ids:[${BOARD_PRODUCAO}]) { items_page(limit: 100) { cursor items { ${campos} } } } }`;
    const dados = await mondayQuery(query, proximo ? { cursor: proximo } : {});
    const pagina = proximo ? dados?.next_items_page : dados?.boards?.[0]?.items_page;
    const itens = pagina?.items || [];
    if (!itens.length) { proximo = null; break; }
    itensVistos += itens.length;

    const updates = [];
    const arquivos = [];
    for (const item of itens) {
      const conteudoId = conteudoPorMonday.get(String(item.id));
      if (!conteudoId) continue;
      for (const u of item.updates || []) {
        updates.push({
          conteudo_id: conteudoId,
          monday_update_id: String(u.id),
          corpo: u.body || '',
          autor: u.creator?.name || null,
          criado_em: u.created_at || null,
        });
      }
      for (const a of item.assets || []) {
        arquivos.push({
          conteudo_id: conteudoId,
          monday_asset_id: String(a.id),
          nome: a.name || null,
          extensao: a.file_extension || null,
          tamanho_bytes: Number(a.file_size || 0) || null,
          url_monday: a.url || null,
          url_publica: a.public_url || null,
          criado_em: a.created_at || null,
        });
      }
    }

    if (updates.length) {
      await sql`INSERT INTO vybe_conteudo_updates (conteudo_id, monday_update_id, corpo, autor, criado_em)
        SELECT u.conteudo_id, u.monday_update_id, u.corpo, u.autor, u.criado_em
        FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb)
          AS u(conteudo_id bigint, monday_update_id text, corpo text, autor text, criado_em timestamptz)
        ON CONFLICT (monday_update_id) DO UPDATE SET
          corpo=EXCLUDED.corpo, autor=EXCLUDED.autor, criado_em=EXCLUDED.criado_em`;
      updatesGravados += updates.length;
    }
    if (arquivos.length) {
      await sql`INSERT INTO vybe_conteudo_arquivos
        (conteudo_id, monday_asset_id, nome, extensao, tamanho_bytes, url_monday, url_publica, criado_em)
        SELECT a.conteudo_id, a.monday_asset_id, a.nome, a.extensao, a.tamanho_bytes,
               a.url_monday, a.url_publica, a.criado_em
        FROM jsonb_to_recordset(${JSON.stringify(arquivos)}::jsonb)
          AS a(conteudo_id bigint, monday_asset_id text, nome text, extensao text,
               tamanho_bytes bigint, url_monday text, url_publica text, criado_em timestamptz)
        ON CONFLICT (monday_asset_id) DO UPDATE SET
          nome=EXCLUDED.nome, tamanho_bytes=EXCLUDED.tamanho_bytes,
          url_monday=EXCLUDED.url_monday, url_publica=EXCLUDED.url_publica`;
      arquivosGravados += arquivos.length;
    }

    proximo = pagina?.cursor || null;
    if (!proximo) break;
  }

  const [totais] = await sql`SELECT
    (SELECT COUNT(*) FROM vybe_conteudo_updates)  AS updates_no_banco,
    (SELECT COUNT(*) FROM vybe_conteudo_arquivos) AS arquivos_no_banco,
    (SELECT COALESCE(SUM(tamanho_bytes),0) FROM vybe_conteudo_arquivos) AS bytes_no_monday`;

  return {
    itens_vistos: itensVistos,
    updates_gravados: updatesGravados,
    arquivos_gravados: arquivosGravados,
    proximo_cursor: proximo,
    concluido: !proximo,
    ...totais,
  };
}
