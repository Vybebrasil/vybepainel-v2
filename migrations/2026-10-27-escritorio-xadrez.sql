-- Escritório: xadrez no tabuleiro (pedido do Paulo, 27/10/2026). Uma partida
-- entre duas pessoas da equipe, de graça ou valendo VybeCoins e móveis/roupas.
-- A aposta sai das duas carteiras e dos dois inventários quando a partida
-- começa (razão 'xadrez:<id>:aposta') e vai para quem ganha no fim
-- ('xadrez:<id>:premio'); empate devolve a cada um ('xadrez:<id>:devolucao').
-- Os lances são conferidos no servidor (chess.js); o navegador só pede.
-- Revisar e aplicar explicitamente.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_xadrez (
 id bigserial PRIMARY KEY,
 -- Gerada por quem desafia: repetir o pedido não cria outra partida.
 chave text NOT NULL UNIQUE CHECK (chave ~ '^[A-Za-z0-9_-]{8,64}$'),
 desafiante bigint NOT NULL REFERENCES vybe_pessoas(id),
 desafiado bigint NOT NULL REFERENCES vybe_pessoas(id),
 brancas bigint NOT NULL REFERENCES vybe_pessoas(id),
 pretas bigint NOT NULL REFERENCES vybe_pessoas(id),
 -- Onde fica o tabuleiro (cena e "classe@x,y"): quem passa por ele assiste.
 camada text NOT NULL CHECK (length(camada) <= 40),
 movel text NOT NULL CHECK (movel ~ '^[A-Za-z0-9_]{1,64}@\d{1,2},\d{1,2}$'),
 -- VybeCoins que cada um põe (0 = partida de graça).
 moedas integer NOT NULL DEFAULT 0 CHECK (moedas >= 0 AND moedas <= 10000),
 -- [[classe, quantidade], ...]: o que cada um põe na mesa.
 itens_desafiante jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(itens_desafiante) = 'array'),
 itens_desafiado jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(itens_desafiado) = 'array'),
 estado text NOT NULL DEFAULT 'convite' CHECK (estado IN ('convite', 'jogando', 'fim', 'recusado', 'cancelado')),
 -- Lances em notação SAN, do primeiro ao último (a posição sai deles).
 lances jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(lances) = 'array'),
 resultado text CHECK (resultado IN ('brancas', 'pretas', 'empate')),
 motivo text,
 empate_de bigint REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 iniciado_em timestamptz,
 ultimo_lance_em timestamptz,
 terminado_em timestamptz,
 CHECK (desafiante <> desafiado),
 CHECK (brancas <> pretas)
);
CREATE INDEX IF NOT EXISTS vybe_escritorio_xadrez_ativas ON vybe_escritorio_xadrez(estado) WHERE estado IN ('convite', 'jogando');
CREATE INDEX IF NOT EXISTS vybe_escritorio_xadrez_mesa ON vybe_escritorio_xadrez(camada, movel) WHERE estado = 'jogando';
COMMIT;
