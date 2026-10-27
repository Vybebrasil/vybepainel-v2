-- Escritório: dama, jogo da velha e truco nas mesas de jogo (pedido do Paulo,
-- 27/10/2026). Só amplia a lista de jogos aceitos em vybe_escritorio_partidas;
-- regras em server/escritorio-dama.js, escritorio-velha.js e escritorio-truco.js.
-- Revisar e aplicar explicitamente.
BEGIN;
ALTER TABLE vybe_escritorio_partidas DROP CONSTRAINT IF EXISTS vybe_escritorio_partidas_jogo_check;
ALTER TABLE vybe_escritorio_partidas ADD CONSTRAINT vybe_escritorio_partidas_jogo_check CHECK (jogo IN ('domino', 'poker', 'sinuca', 'dama', 'velha', 'truco'));
COMMIT;
