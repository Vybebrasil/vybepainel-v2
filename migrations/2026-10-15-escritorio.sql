-- Aplicação explícita após revisão. Nenhuma leitura cria tabelas.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_perfis (
 pessoa_id bigint PRIMARY KEY REFERENCES vybe_pessoas(id) ON DELETE CASCADE,
 preferencias jsonb NOT NULL DEFAULT '{}'::jsonb,
 atualizado_em timestamptz NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS vybe_escritorio_mensagens (
 id bigserial PRIMARY KEY,
 pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
 sala text NOT NULL CHECK(sala IN ('convivencia','criacao','atendimento','producao','reuniao','foco')),
 texto text NOT NULL CHECK(length(texto) BETWEEN 1 AND 2000),
 chave uuid NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT NOW(),
 UNIQUE(pessoa_id,chave)
);
CREATE INDEX IF NOT EXISTS vybe_escritorio_mensagens_sala ON vybe_escritorio_mensagens(sala,id DESC);
CREATE TABLE IF NOT EXISTS vybe_escritorio_salas(sala text PRIMARY KEY,reuniao_id text NOT NULL);
COMMIT;
