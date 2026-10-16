-- Imagens enviadas pela equipe para usar no escritório: quadro (pintado na
-- parede alta da sala) ou tapete (no piso). O tamanho é em ladrilhos.
-- Aplicação explícita após revisão.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_imagens (
 id bigserial PRIMARY KEY,
 camada text NOT NULL CHECK (camada = 'geral' OR camada ~ '^sala-([0-9]|1[01])$'),
 tipo text NOT NULL CHECK (tipo IN ('quadro', 'tapete')),
 largura smallint NOT NULL CHECK (largura BETWEEN 1 AND 6),
 altura smallint NOT NULL CHECK (altura BETWEEN 1 AND 6),
 nome text NOT NULL DEFAULT '' CHECK (length(nome) <= 80),
 mime text NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp')),
 dados bytea NOT NULL CHECK (octet_length(dados) BETWEEN 1 AND 1572864),
 criado_por text NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vybe_escritorio_imagens_camada ON vybe_escritorio_imagens (camada);
COMMIT;
