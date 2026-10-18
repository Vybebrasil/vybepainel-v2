-- Escritório: post-its nas paredes das salas e presentes de móveis entre
-- colegas (mecânicas do Habbo). Revisar e aplicar explicitamente.
BEGIN;
-- Recado colado na parede de uma cena (quarto ou espaço comum). "lado" é a
-- parede (0 fundo, 1 esquerda), "posicao" o ponto ao longo dela (em
-- ladrilhos) e "altura" a altura na parede (0 rodapé … 1 topo).
CREATE TABLE IF NOT EXISTS vybe_escritorio_postits (
 id bigserial PRIMARY KEY,
 camada text NOT NULL CHECK (camada ~ '^(sala-([0-9]|1[01])(-andar-1)?|recepcao|reuniao|auditorio|producao|cafe|jogos|foco|academia|lounge)$'),
 lado smallint NOT NULL CHECK (lado IN (0, 1)),
 posicao real NOT NULL CHECK (posicao >= 0 AND posicao <= 20),
 altura real NOT NULL DEFAULT 0.55 CHECK (altura >= 0 AND altura <= 1),
 cor text NOT NULL CHECK (cor IN ('amarelo', 'rosa', 'azul', 'verde')),
 texto text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 280),
 pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vybe_escritorio_postits_camada ON vybe_escritorio_postits(camada, criado_em);
-- Presente: uma unidade do inventário de uma pessoa passa para outra. A chave
-- (gerada por quem dá) torna o pedido idempotente: repetir não dá duas vezes.
CREATE TABLE IF NOT EXISTS vybe_escritorio_presentes (
 chave text PRIMARY KEY CHECK (chave ~ '^[A-Za-z0-9_-]{8,64}$'),
 de_pessoa bigint NOT NULL REFERENCES vybe_pessoas(id),
 para_pessoa bigint NOT NULL REFERENCES vybe_pessoas(id),
 classe text NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 CHECK (de_pessoa <> para_pessoa)
);
COMMIT;
