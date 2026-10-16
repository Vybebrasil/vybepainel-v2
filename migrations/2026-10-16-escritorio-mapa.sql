-- Mapa editável do escritório. Aplicação explícita após revisão.
-- Uma linha por camada: 'geral' (o mapa, só administrador) ou 'sala-0'…'sala-11'
-- (sala individual, o dono ou administrador). Sem linha, vale o mapa padrão do código.
-- Itens: [classe, x, y, direção, estado, altura]; nas salas, x/y relativos à sala.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_mapa (
 camada text PRIMARY KEY CHECK (camada = 'geral' OR camada ~ '^sala-([0-9]|1[01])$'),
 itens jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(itens) = 'array'),
 versao integer NOT NULL DEFAULT 1,
 atualizado_por bigint REFERENCES vybe_pessoas(id),
 atualizado_em timestamptz NOT NULL DEFAULT NOW()
);
COMMIT;
