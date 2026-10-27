-- Escritório: relógio no xadrez (pedido do Paulo, 27/10/2026). Cada lado tem
-- 10 minutos, mais 2 segundos por lance; quem fica sem tempo na vez dele
-- perde (server/escritorio-xadrez.js). `relogio` = milissegundos de cada cor
-- no último lance: {"brancas": 600000, "pretas": 600000}. Partidas que
-- começaram antes ficam sem relógio (NULL) e seguem com a vitória por tempo
-- de 5 minutos sem lance. Revisar e aplicar explicitamente.
BEGIN;
ALTER TABLE vybe_escritorio_xadrez ADD COLUMN IF NOT EXISTS relogio jsonb CHECK (relogio IS NULL OR jsonb_typeof(relogio) = 'object');
COMMIT;
