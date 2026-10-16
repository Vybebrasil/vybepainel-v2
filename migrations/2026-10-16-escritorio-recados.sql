-- Recados individuais do escritório (mensagem de uma pessoa para outra, que
-- fica guardada até ser lida). Aplicação explícita após revisão.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_recados (
 id bigserial PRIMARY KEY,
 de_id bigint NOT NULL REFERENCES vybe_pessoas(id),
 para_id bigint NOT NULL REFERENCES vybe_pessoas(id),
 texto text NOT NULL CHECK (length(texto) BETWEEN 1 AND 2000),
 chave uuid NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT NOW(),
 lido_em timestamptz,
 CHECK (de_id <> para_id),
 UNIQUE (de_id, chave)
);
CREATE INDEX IF NOT EXISTS vybe_escritorio_recados_para ON vybe_escritorio_recados(para_id, lido_em, id DESC);
CREATE INDEX IF NOT EXISTS vybe_escritorio_recados_par ON vybe_escritorio_recados(LEAST(de_id, para_id), GREATEST(de_id, para_id), id DESC);
COMMIT;
