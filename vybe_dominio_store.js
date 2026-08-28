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
import { getMirrorSnapshot } from './operational_mirror_store.js';

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

function dataOuNulo(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
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
