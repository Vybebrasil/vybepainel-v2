-- Escritório: mesas de jogo entre duas pessoas da equipe (pedido do Paulo,
-- 27/10/2026), começando pelo dominó; poker e sinuca entram na mesma tabela.
-- De graça ou valendo VybeCoins e móveis/roupas, com a mesma aposta do xadrez
-- (server/escritorio-apostas.js): sai das duas carteiras e dos dois
-- inventários quando a partida começa (razão '<jogo>:<id>:aposta') e vai para
-- quem ganha no fim ('<jogo>:<id>:premio'); empate devolve ('...:devolucao').
-- O estado do jogo fica em `mesa` (com as mãos escondidas): o servidor só
-- mostra a cada um o que é dele. Revisar e aplicar explicitamente.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_partidas (
 id bigserial PRIMARY KEY,
 jogo text NOT NULL CHECK (jogo IN ('domino', 'poker', 'sinuca')),
 -- Gerada por quem desafia: repetir o pedido não cria outra partida.
 chave text NOT NULL UNIQUE CHECK (chave ~ '^[A-Za-z0-9_-]{8,64}$'),
 desafiante bigint NOT NULL REFERENCES vybe_pessoas(id),
 desafiado bigint NOT NULL REFERENCES vybe_pessoas(id),
 -- Onde fica a mesa (cena e "classe@x,y"): quem passa por ela assiste.
 camada text NOT NULL CHECK (length(camada) <= 40),
 movel text NOT NULL CHECK (movel ~ '^[A-Za-z0-9_]{1,64}@\d{1,2},\d{1,2}$'),
 -- VybeCoins que cada um põe (0 = partida de graça).
 moedas integer NOT NULL DEFAULT 0 CHECK (moedas >= 0 AND moedas <= 10000),
 -- [[classe, quantidade], ...]: o que cada um põe na mesa.
 itens_desafiante jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(itens_desafiante) = 'array'),
 itens_desafiado jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(itens_desafiado) = 'array'),
 estado text NOT NULL DEFAULT 'convite' CHECK (estado IN ('convite', 'jogando', 'fim', 'recusado', 'cancelado')),
 -- Estado do jogo (peças, mãos, de quem é a vez, quantos lances já foram).
 mesa jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(mesa) = 'object'),
 resultado text CHECK (resultado IN ('desafiante', 'desafiado', 'empate')),
 motivo text,
 empate_de bigint REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 iniciado_em timestamptz,
 ultimo_lance_em timestamptz,
 terminado_em timestamptz,
 CHECK (desafiante <> desafiado)
);
CREATE INDEX IF NOT EXISTS vybe_escritorio_partidas_ativas ON vybe_escritorio_partidas(jogo, estado) WHERE estado IN ('convite', 'jogando');
CREATE INDEX IF NOT EXISTS vybe_escritorio_partidas_mesa ON vybe_escritorio_partidas(camada, movel) WHERE estado = 'jogando';
COMMIT;
