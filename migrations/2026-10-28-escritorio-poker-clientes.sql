-- Escritório: pôquer de até 8 na mesa, com os clientes da Vybe como bots
-- (pedido do Paulo, 28/10/2026: "no pôquer não tem os bots também? Podia ser
-- os clientes, cada um com sua carteira... e no meio da partida eles soltam
-- piadas sobre as demandas"; "a mesa pode ser até de 8 pessoas").
--
-- `clientes`: os clientes sentados na mesa (vybe_clientes.id), nos lugares
-- depois das pessoas. Com clientes, a mesa pode não ter outra pessoa
-- (`desafiado` vazio): eu contra os clientes.
-- Cada cliente tem a carteira de VybeCoins dele (vybe_escritorio_clientes_carteira):
-- paga a aposta da mesa como qualquer um e recebe o pote quando ganha. Toda
-- segunda (dia da Bahia) quem tem menos de 500 volta a 500 ("pingou a
-- mensalidade"). O razão (vybe_escritorio_clientes_moedas) guarda cada
-- movimento, uma vez por origem.
-- Só acrescenta: o código de antes segue funcionando com a tabela nova.
-- Revisar e aplicar explicitamente.
BEGIN;
ALTER TABLE vybe_escritorio_partidas ADD COLUMN IF NOT EXISTS clientes bigint[] NOT NULL DEFAULT '{}';
ALTER TABLE vybe_escritorio_partidas DROP CONSTRAINT IF EXISTS vybe_escritorio_partidas_mais_check;
ALTER TABLE vybe_escritorio_partidas ADD CONSTRAINT vybe_escritorio_partidas_mais_check CHECK (cardinality(mais) <= 6 AND (cardinality(mais) = 0 OR jogo = 'poker'));
ALTER TABLE vybe_escritorio_partidas DROP CONSTRAINT IF EXISTS vybe_escritorio_partidas_clientes_check;
ALTER TABLE vybe_escritorio_partidas ADD CONSTRAINT vybe_escritorio_partidas_clientes_check CHECK (
 cardinality(clientes) = 0 OR (jogo = 'poker' AND bot IS NULL AND 1 + (desafiado IS NOT NULL)::int + cardinality(mais) + cardinality(clientes) <= 8));
-- Sem bot, a mesa tem a outra pessoa; só com clientes ela pode faltar.
ALTER TABLE vybe_escritorio_partidas DROP CONSTRAINT IF EXISTS vybe_escritorio_partidas_bot_lado;
ALTER TABLE vybe_escritorio_partidas ADD CONSTRAINT vybe_escritorio_partidas_bot_lado CHECK (
 (bot IS NOT NULL AND desafiado IS NULL) OR (bot IS NULL AND (desafiado IS NOT NULL OR cardinality(clientes) > 0)));
ALTER TABLE vybe_escritorio_partidas DROP CONSTRAINT IF EXISTS vybe_escritorio_partidas_resultado_check;
ALTER TABLE vybe_escritorio_partidas ADD CONSTRAINT vybe_escritorio_partidas_resultado_check CHECK (resultado IN
 ('desafiante', 'desafiado', 'jogador3', 'jogador4', 'jogador5', 'jogador6', 'jogador7', 'jogador8', 'empate'));
CREATE TABLE IF NOT EXISTS vybe_escritorio_clientes_carteira (
 cliente_id bigint PRIMARY KEY REFERENCES vybe_clientes(id),
 saldo integer NOT NULL DEFAULT 500 CHECK (saldo >= 0),
 recarga date
);
CREATE TABLE IF NOT EXISTS vybe_escritorio_clientes_moedas (
 id bigserial PRIMARY KEY,
 cliente_id bigint NOT NULL REFERENCES vybe_clientes(id),
 origem text NOT NULL,
 quantidade integer NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE (cliente_id, origem)
);
COMMIT;
