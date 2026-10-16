-- Cópia dos bonecos do escritório (em pé, 8 direções) para não depender do
-- site do Habbo. Aplicação explícita após revisão.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_bonecos (
 figura text NOT NULL CHECK (length(figura) BETWEEN 4 AND 400),
 direcao smallint NOT NULL CHECK (direcao BETWEEN 0 AND 7),
 png bytea NOT NULL CHECK (octet_length(png) BETWEEN 1 AND 200000),
 criado_em timestamptz NOT NULL DEFAULT NOW(),
 PRIMARY KEY (figura, direcao)
);
COMMIT;
