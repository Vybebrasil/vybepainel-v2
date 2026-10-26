-- Fechar gravação (Paulo, 26/10/2026: "preciso que o Mizinho finalize a
-- captação que ele fez direto no sistema, dando um check na agenda da
-- gravação, com o link que foi pro Drive, e veja o que aquela gravação gerou").
-- A captação guarda a pasta do material no Drive, quem fechou, quando e uma
-- observação. Só acrescenta colunas; não mexe em dados existentes.
BEGIN;
ALTER TABLE vybe_captacoes
  ADD COLUMN IF NOT EXISTS drive_link text CHECK (drive_link IS NULL OR length(drive_link) <= 2000),
  ADD COLUMN IF NOT EXISTS fechada_em timestamptz,
  ADD COLUMN IF NOT EXISTS fechada_por bigint REFERENCES vybe_pessoas(id),
  ADD COLUMN IF NOT EXISTS observacao_final text NOT NULL DEFAULT '' CHECK (length(observacao_final) <= 2000);
COMMIT;
