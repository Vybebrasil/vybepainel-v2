// vybe_observabilidade.js — snapshots e saúde do domínio próprio.
// Não armazena credenciais nem corpo de documentos; registra apenas indicadores.

import { saudeFilaReplica } from './vybe_replica_queue.js';

export async function garantirObservabilidade(sql) {
  await sql`CREATE TABLE IF NOT EXISTS vybe_operational_snapshots (
    id BIGSERIAL PRIMARY KEY,
    data_referencia DATE NOT NULL UNIQUE,
    origem TEXT NOT NULL DEFAULT 'cron',
    payload JSONB NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS vybe_system_health (
    id BIGSERIAL PRIMARY KEY,
    componente TEXT NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('ok','atencao','erro')),
    detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS vybe_system_health_componente_idx
    ON vybe_system_health (componente, criado_em DESC)`;
}

export async function indicadoresIndependencia(sql) {
  await garantirObservabilidade(sql);
  const [conteudos, arquivos, clientes, historico] = await Promise.all([
    sql`SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE board_id=7829537690)::int AS producao,
      COUNT(*) FILTER (WHERE board_id=8385559107)::int AS solicitacoes,
      COUNT(*) FILTER (WHERE removido_em IS NULL)::int AS ativos,
      COUNT(*) FILTER (WHERE removido_em IS NULL AND prazo IS NULL AND veiculacao IS NULL)::int AS sem_data,
      COUNT(*) FILTER (WHERE removido_em IS NULL AND prazo < CURRENT_DATE)::int AS prazo_passado
      FROM vybe_conteudos`,
    sql`SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE drive_file_id IS NOT NULL)::int AS proprios,
      COUNT(*) FILTER (WHERE drive_file_id IS NULL AND ausente_em IS NULL AND monday_asset_id IS NOT NULL)::int AS dependentes_monday,
      COUNT(*) FILTER (WHERE ausente_em IS NOT NULL)::int AS ausentes
      FROM vybe_conteudo_arquivos`,
    sql`SELECT
      (SELECT COUNT(*)::int FROM vybe_clientes) AS clientes,
      (SELECT COUNT(*)::int FROM vybe_acessos) AS acessos,
      (SELECT COUNT(*)::int FROM vybe_acessos WHERE cliente_id IS NULL) AS acessos_sem_cliente,
      (SELECT COUNT(*)::int FROM vybe_pessoas WHERE ativo) AS pessoas_ativas,
      (SELECT COUNT(*)::int FROM vybe_pessoas WHERE ativo AND foto_url IS NULL) AS pessoas_sem_foto`,
    sql`SELECT
      (SELECT COUNT(*)::int FROM vybe_conteudo_eventos) AS eventos,
      (SELECT COUNT(*)::int FROM vybe_conteudo_updates) AS updates,
      (SELECT COUNT(*)::int FROM vybe_subitens) AS subitens`,
  ]);
  const replica = await saudeFilaReplica(sql);
  return {
    autoridade: 'vybe',
    gerado_em: new Date().toISOString(),
    conteudos: conteudos[0] || {},
    arquivos: arquivos[0] || {},
    cadastro: clientes[0] || {},
    historico: historico[0] || {},
    replica,
  };
}

async function itensDoSnapshot(sql) {
  const linhas = await sql`SELECT c.id, c.board_id, c.titulo AS nome, c.formato, s.rotulo AS status,
      TO_CHAR(c.prazo,'YYYY-MM-DD') AS prazo_iso,
      TO_CHAR(c.veiculacao,'YYYY-MM-DD') AS veiculacao_iso,
      COALESCE((SELECT JSONB_AGG(x.nome ORDER BY x.nome) FROM (
        SELECT DISTINCT cl.nome FROM vybe_conteudo_clientes cc
          JOIN vybe_clientes cl ON cl.id=cc.cliente_id WHERE cc.conteudo_id=c.id
      ) x), '[]'::jsonb) AS clientes,
      COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id',p.monday_user_id,'nome',p.nome) ORDER BY cr.ordem)
        FROM vybe_conteudo_responsaveis cr JOIN vybe_pessoas p ON p.id=cr.pessoa_id
        WHERE cr.conteudo_id=c.id), '[]'::jsonb) AS responsaveis
    FROM vybe_conteudos c
      LEFT JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
    WHERE c.removido_em IS NULL ORDER BY c.id`;
  const br = (iso) => iso ? `${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}` : '';
  return linhas.map((item) => {
    const clientes = Array.isArray(item.clientes) ? item.clientes : [];
    const responsaveis = Array.isArray(item.responsaveis) ? item.responsaveis : [];
    const ids = responsaveis.map((p) => p.id).filter(Boolean);
    return {
      id: String(item.id), board_id: String(item.board_id), nome: item.nome || '',
      cliente: clientes.join(', '), formato: item.formato || '', status: item.status || '',
      responsavel: responsaveis.map((p) => p.nome).filter(Boolean).join(', '),
      responsavel_id: ids[0] || null, responsavel_ids: ids,
      prazo_iso: item.prazo_iso || '', prazo: br(item.prazo_iso),
      veiculacao_iso: item.veiculacao_iso || '', veiculacao: br(item.veiculacao_iso),
    };
  });
}

export async function registrarSnapshotOperacional(sql, origem = 'cron') {
  const [indicadores, itens] = await Promise.all([indicadoresIndependencia(sql), itensDoSnapshot(sql)]);
  const payload = { ...indicadores, itens };
  const data = new Date().toISOString().slice(0, 10);
  const [linha] = await sql`INSERT INTO vybe_operational_snapshots
      (data_referencia, origem, payload, criado_em, atualizado_em)
    VALUES (${data}, ${String(origem)}, ${JSON.stringify(payload)}::jsonb, NOW(), NOW())
    ON CONFLICT (data_referencia) DO UPDATE SET
      origem=EXCLUDED.origem, payload=EXCLUDED.payload, atualizado_em=NOW()
    RETURNING id, data_referencia, origem, atualizado_em`;
  return { ...linha, payload };
}

export async function registrarSaude(sql, componente, estado, detalhes = {}) {
  await garantirObservabilidade(sql);
  const nivel = ['ok','atencao','erro'].includes(estado) ? estado : 'atencao';
  const [linha] = await sql`INSERT INTO vybe_system_health (componente, estado, detalhes)
    VALUES (${String(componente)}, ${nivel}, ${JSON.stringify(detalhes || {})}::jsonb)
    RETURNING id, componente, estado, criado_em`;
  return linha;
}

export async function historicoSaude(sql, limite = 100) {
  await garantirObservabilidade(sql);
  return sql`SELECT id, componente, estado, detalhes, criado_em
    FROM vybe_system_health ORDER BY criado_em DESC
    LIMIT ${Math.max(1, Math.min(Number(limite) || 100, 500))}`;
}

export async function listarSnapshots(sql, limite = 30) {
  await garantirObservabilidade(sql);
  return sql`SELECT id, data_referencia, origem, payload - 'itens' AS payload, criado_em, atualizado_em
    FROM vybe_operational_snapshots ORDER BY data_referencia DESC
    LIMIT ${Math.max(1, Math.min(Number(limite) || 30, 365))}`;
}

export async function obterSnapshot(sql, id) {
  await garantirObservabilidade(sql);
  return (await sql`SELECT id, data_referencia, origem, payload, criado_em, atualizado_em
    FROM vybe_operational_snapshots WHERE id=${Number(id) || 0}`)[0] || null;
}

export async function excluirSnapshot(sql, id) {
  await garantirObservabilidade(sql);
  return (await sql`DELETE FROM vybe_operational_snapshots WHERE id=${Number(id) || 0}
    RETURNING id, data_referencia`)[0] || null;
}
