-- Sinuca em dupla (Paulo, 04/11/2026: "como tá funcionando pra jogar de dupla?
-- ... no par ou ímpar, jogar alternado"): a mesa de sinuca passa a aceitar 4
-- pessoas (quem chama, o 1º adversário e, em `mais`, o parceiro e o 2º
-- adversário). Antes só o pôquer tinha gente em `mais`.
-- Idempotente: pode rodar de novo. Não mexe em nenhuma linha existente.
ALTER TABLE vybe_escritorio_partidas DROP CONSTRAINT IF EXISTS vybe_escritorio_partidas_mais_check;
ALTER TABLE vybe_escritorio_partidas ADD CONSTRAINT vybe_escritorio_partidas_mais_check
  CHECK (cardinality(mais) <= 6 AND (cardinality(mais) = 0 OR jogo = 'poker' OR (jogo = 'sinuca' AND cardinality(mais) = 2)));
