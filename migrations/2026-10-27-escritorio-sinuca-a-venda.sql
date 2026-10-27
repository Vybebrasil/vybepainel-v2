-- Mesa de Sinuca à venda sempre (pedido do Paulo, 27/10/2026: "o sinuca pode
-- comprar também"). Era épico pelo nome ("Bling"), que só vende na semana em
-- que entra na vitrine; agora é jogo de verdade e fica como incomum, igual às
-- outras mesas de jogo (120 VybeCoins, sem limite de estoque, sem vitrine).
-- Revisar e aplicar explicitamente.
BEGIN;
UPDATE vybe_escritorio_catalogo SET raridade='incomum', estoque=NULL, preco=NULL WHERE classe='bling15_pooltable';
COMMIT;
