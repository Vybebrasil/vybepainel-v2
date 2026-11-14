-- 2026-11-14 · campos e registros dos quadros D3 (Paulo, 14/11/2026).
-- Aplicado pelo servidor no primeiro uso: server/migracoes-campos.js (garantirMigracoesCampos). Este arquivo é o registro.
-- Só aditivo e idempotente; nenhum UPDATE em dado existente (o passado é lido, não reescrito).
-- Ficam em vybe_carteira_config, sem migração: o vencimento da fatura por cartão (financeiro_cartoes) e as metas
-- da carteira (meta_carteira) e de acerto dos agentes (meta_acerto_agentes, a mesma chave de server/series-historicas.js).

-- orcamentos_aprovado_em (só roda com vybe_comercial_orcamentos no banco)
ALTER TABLE vybe_comercial_orcamentos ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE vybe_comercial_orcamentos ADD COLUMN IF NOT EXISTS aprovado_por bigint;

-- inadimplencia_avisos (só roda com vybe_pessoas no banco)
CREATE TABLE IF NOT EXISTS vybe_financeiro_avisos (
  id bigserial PRIMARY KEY,
  cliente_id bigint,
  cliente_nome text NOT NULL CHECK (length(trim(cliente_nome)) BETWEEN 1 AND 200),
  nivel smallint NOT NULL CHECK (nivel IN (3, 10, 30)),
  atraso_dias integer CHECK (atraso_dias IS NULL OR atraso_dias BETWEEN 0 AND 10000),
  quem bigint NOT NULL REFERENCES vybe_pessoas(id),
  quem_nome text NOT NULL DEFAULT '',
  para jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(para) = 'array'),
  em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vybe_financeiro_avisos_cliente ON vybe_financeiro_avisos (cliente_id, em DESC);
CREATE INDEX IF NOT EXISTS vybe_financeiro_avisos_em ON vybe_financeiro_avisos (em DESC);

-- recebivel_forma (só roda com vybe_pessoas no banco)
CREATE TABLE IF NOT EXISTS vybe_comercial_recebivel_forma (
  recebivel text PRIMARY KEY CHECK (recebivel ~ '^[A-Za-z0-9:_-]{1,80}$'),
  forma text NOT NULL CHECK (forma IN ('pix','boleto','cartao','transferencia')),
  atualizado_por bigint REFERENCES vybe_pessoas(id),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- ia_agente_cliente (só roda com ai_usage_events no banco)
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS agente text;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS cliente text;
CREATE INDEX IF NOT EXISTS ai_usage_events_agente_idx ON ai_usage_events (agente, created_at DESC);

-- creator_campanhas (só roda com vybe_comercial_creators no banco)
CREATE TABLE IF NOT EXISTS vybe_creator_campanhas (
  id bigserial PRIMARY KEY,
  creator_id bigint NOT NULL REFERENCES vybe_comercial_creators(id),
  cliente_id bigint,
  cliente_nome text NOT NULL CHECK (length(trim(cliente_nome)) BETWEEN 1 AND 200),
  inicio date NOT NULL,
  fim date,
  status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada','ativa','encerrada','cancelada')),
  observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 1000),
  criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (fim IS NULL OR fim >= inicio)
);
CREATE INDEX IF NOT EXISTS vybe_creator_campanhas_creator ON vybe_creator_campanhas (creator_id, inicio DESC);

-- crm_origem (só roda com vybe_crm_oportunidades no banco)
ALTER TABLE vybe_crm_oportunidades ADD COLUMN IF NOT EXISTS origem text CHECK (origem IS NULL OR origem IN ('sdr','manual','formulario'));

-- minha_sala (só roda com vybe_pessoas no banco)
CREATE TABLE IF NOT EXISTS vybe_sala_preferencias (
  pessoa_id bigint PRIMARY KEY REFERENCES vybe_pessoas(id),
  cor text CHECK (cor IS NULL OR cor ~ '^#[0-9a-f]{6}$'),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vybe_sala_focos (
  id bigserial PRIMARY KEY,
  pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  item text NOT NULL DEFAULT '' CHECK (length(item) <= 80),
  rotulo text NOT NULL DEFAULT '' CHECK (length(rotulo) <= 200),
  CHECK (fim IS NULL OR fim >= inicio)
);
CREATE INDEX IF NOT EXISTS vybe_sala_focos_pessoa ON vybe_sala_focos (pessoa_id, inicio DESC);
CREATE UNIQUE INDEX IF NOT EXISTS vybe_sala_focos_um_aberto ON vybe_sala_focos (pessoa_id) WHERE fim IS NULL;

-- peca_complemento (só roda com vybe_pessoas no banco)
CREATE TABLE IF NOT EXISTS vybe_peca_complemento (
  item text PRIMARY KEY CHECK (item ~ '^(vybe:)?[0-9]{1,20}$'),
  publicar_hora time,
  atualizado_por bigint REFERENCES vybe_pessoas(id),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
