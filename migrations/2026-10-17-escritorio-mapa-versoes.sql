-- Histórico do mapa editável: a cada salvamento, a versão anterior de cada
-- camada é guardada aqui (as 30 mais recentes por camada), para voltar atrás.
-- Aplicação explícita após revisão.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_mapa_versoes (
 id bigserial PRIMARY KEY,
 camada text NOT NULL CHECK (camada = 'geral' OR camada ~ '^sala-([0-9]|1[01])$'),
 itens jsonb NOT NULL CHECK (jsonb_typeof(itens) = 'array'),
 versao integer NOT NULL,
 atualizado_por bigint,
 salvo_em timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS vybe_escritorio_mapa_versoes_camada ON vybe_escritorio_mapa_versoes (camada, id DESC);
COMMIT;
