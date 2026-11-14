-- 2026-11-14 · Séries históricas dos quadros D3 (Paulo, 14/11/2026).
-- Aplicada pelo servidor no primeiro uso (server/migracoes-historico.js, garantirMigracoesHistorico).
-- Só aditiva e idempotente. Gravação e leitura: server/series-historicas.js.
--
-- Configurações novas (sem tabela nova; vybe_carteira_config da migração 2026-11-07-carteira.sql):
--   chave 'limite_carga'        → { "padrao": 8, "pessoas": { "<vybe_pessoas.id>": 10 } }   (só os donos gravam)
--   chave 'meta_acerto_agentes' → { "meta": 75 }                                          (só os donos gravam)

CREATE TABLE IF NOT EXISTS vybe_serie_diaria (
  dia date NOT NULL,
  serie text NOT NULL CHECK (serie ~ '^[a-z_]{1,40}$'),
  sujeito text NOT NULL CHECK (length(sujeito) BETWEEN 1 AND 80),
  valor numeric,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  gravado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dia, serie, sujeito)
);
CREATE INDEX IF NOT EXISTS vybe_serie_diaria_leitura ON vybe_serie_diaria (serie, sujeito, dia DESC);
