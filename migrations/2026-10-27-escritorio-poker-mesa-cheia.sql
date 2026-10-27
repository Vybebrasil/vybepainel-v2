-- Escritório: pôquer de até 4 na mesma mesa (pedido do Paulo, 27/10/2026).
-- Quem chama escolhe até três pessoas: a primeira continua em `desafiado` e as
-- outras duas ficam em `mais` (jogador3, jogador4, na ordem). A partida começa
-- quando todos os chamados aceitam (`aceitos`); quem recusa sai da lista. Em
-- grupo a aposta é só de VybeCoins (cada um põe o mesmo, quem ganha leva
-- tudo). Os outros jogos continuam de dois. Só acrescenta: o código de antes
-- segue funcionando com a tabela nova. Revisar e aplicar explicitamente.
BEGIN;
ALTER TABLE vybe_escritorio_partidas ADD COLUMN IF NOT EXISTS mais bigint[] NOT NULL DEFAULT '{}';
ALTER TABLE vybe_escritorio_partidas ADD COLUMN IF NOT EXISTS aceitos bigint[] NOT NULL DEFAULT '{}';
ALTER TABLE vybe_escritorio_partidas DROP CONSTRAINT IF EXISTS vybe_escritorio_partidas_mais_check;
ALTER TABLE vybe_escritorio_partidas ADD CONSTRAINT vybe_escritorio_partidas_mais_check CHECK (cardinality(mais) <= 2 AND (cardinality(mais) = 0 OR jogo = 'poker'));
ALTER TABLE vybe_escritorio_partidas DROP CONSTRAINT IF EXISTS vybe_escritorio_partidas_resultado_check;
ALTER TABLE vybe_escritorio_partidas ADD CONSTRAINT vybe_escritorio_partidas_resultado_check CHECK (resultado IN ('desafiante', 'desafiado', 'jogador3', 'jogador4', 'empate'));
CREATE INDEX IF NOT EXISTS vybe_escritorio_partidas_mais ON vybe_escritorio_partidas USING gin (mais) WHERE estado IN ('convite', 'jogando');
COMMIT;
