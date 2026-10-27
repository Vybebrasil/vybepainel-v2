-- Escritório: Desafios contra bots e temporadas dos jogos (pedido do Paulo,
-- 27/10/2026). Só acrescenta: o código de antes segue funcionando com ela.
--
-- Bots: a partida contra um bot fica em vybe_escritorio_partidas com `bot`
-- ('<jogo>:<nível>', ex. 'sinuca:lendario', o Baianinho) e sem `desafiado`
-- (o bot não é pessoa). Ganhar de um bot dá VybeCoins e XP pelo razão
-- (origem 'bot:<id>'), com teto por dia no código (server/escritorio-bots.js).
--
-- Temporadas: quinzenais (1 a 15 e 16 ao fim do mês, horário da Bahia), por
-- jogo, contando só vitórias contra pessoas. O top 3 de cada jogo ganha XP e
-- VybeCoins (origem 'temporada:<jogo>:<início>:<posição>') e o 1º leva o
-- troféu da temporada do jogo. Cada linha desta tabela é um prêmio pago:
-- repetir o fechamento não paga de novo.
-- Revisar e aplicar explicitamente.
BEGIN;
ALTER TABLE vybe_escritorio_partidas ADD COLUMN IF NOT EXISTS bot text;
ALTER TABLE vybe_escritorio_partidas DROP CONSTRAINT IF EXISTS vybe_escritorio_partidas_bot_check;
ALTER TABLE vybe_escritorio_partidas ADD CONSTRAINT vybe_escritorio_partidas_bot_check CHECK (bot IS NULL OR bot ~ '^[a-z]+:(facil|medio|lendario)$');
ALTER TABLE vybe_escritorio_partidas ALTER COLUMN desafiado DROP NOT NULL;
ALTER TABLE vybe_escritorio_partidas DROP CONSTRAINT IF EXISTS vybe_escritorio_partidas_bot_lado;
ALTER TABLE vybe_escritorio_partidas ADD CONSTRAINT vybe_escritorio_partidas_bot_lado CHECK ((bot IS NULL) = (desafiado IS NOT NULL));
CREATE INDEX IF NOT EXISTS vybe_escritorio_partidas_fim_jogo ON vybe_escritorio_partidas(jogo, terminado_em) WHERE estado = 'fim' AND bot IS NULL;
CREATE TABLE IF NOT EXISTS vybe_escritorio_temporadas (
 jogo text NOT NULL CHECK (jogo IN ('xadrez', 'domino', 'poker', 'sinuca', 'dama', 'velha', 'truco')),
 inicio date NOT NULL,
 posicao smallint NOT NULL CHECK (posicao BETWEEN 1 AND 3),
 pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
 vitorias integer NOT NULL CHECK (vitorias >= 0),
 pago_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (jogo, inicio, posicao)
);
-- Troféu do campeão de cada jogo, conferido em Production (sem marco, fora de
-- toda conquista e sem dono): passa a vir só pela temporada (não se compra).
INSERT INTO vybe_escritorio_catalogo(classe, raridade, marco) VALUES
 ('trophy_gameprize','lendario','temporada'),('trophy_ltd18_wcup','lendario','temporada'),('prizetrophy_hot','lendario','temporada'),
 ('prizetrophy_cool','lendario','temporada'),('race_trophy','lendario','temporada'),('trophy_wired','lendario','temporada'),('xm09_trophy','lendario','temporada')
ON CONFLICT (classe) DO UPDATE SET marco=COALESCE(vybe_escritorio_catalogo.marco, 'temporada');
COMMIT;
