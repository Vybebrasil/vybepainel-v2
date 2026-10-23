-- Vybe AI: vínculos por identidade WhatsApp e códigos temporários.
-- Executar somente em homologação antes de propor aplicação em produção.
CREATE TABLE IF NOT EXISTS vybe_ai_vinculos (
  id BIGSERIAL PRIMARY KEY,
  pessoa_id BIGINT NOT NULL REFERENCES vybe_pessoas(id) ON DELETE CASCADE,
  jid_hash CHAR(64) NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revogado_em TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS vybe_ai_vinculos_pessoa_jid_ativo
  ON vybe_ai_vinculos(pessoa_id, jid_hash) WHERE revogado_em IS NULL;
CREATE INDEX IF NOT EXISTS vybe_ai_vinculos_pessoa ON vybe_ai_vinculos(pessoa_id);

CREATE TABLE IF NOT EXISTS vybe_ai_desafios (
  id BIGSERIAL PRIMARY KEY,
  pessoa_id BIGINT NOT NULL REFERENCES vybe_pessoas(id) ON DELETE CASCADE,
  codigo_hash CHAR(64) NOT NULL UNIQUE,
  expira_em TIMESTAMPTZ NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usado_em TIMESTAMPTZ,
  CONSTRAINT vybe_ai_desafios_expiracao CHECK (expira_em > criado_em)
);
CREATE INDEX IF NOT EXISTS vybe_ai_desafios_pendentes
  ON vybe_ai_desafios(pessoa_id, expira_em) WHERE usado_em IS NULL;
