-- Escritório: troca de móveis entre colegas, como no Habbo (pedido do Paulo,
-- 19/10/2026). Quem propõe escolhe o que dá e o que quer; quem recebe aceita
-- ou recusa. Aceitar troca os móveis numa transação só, conferindo de novo
-- que os dois ainda têm as unidades guardadas. Revisar e aplicar explicitamente.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_trocas (
 id bigserial PRIMARY KEY,
 -- Gerada por quem propõe: repetir o pedido não cria outra proposta.
 chave text NOT NULL UNIQUE CHECK (chave ~ '^[A-Za-z0-9_-]{8,64}$'),
 de_pessoa bigint NOT NULL REFERENCES vybe_pessoas(id),
 para_pessoa bigint NOT NULL REFERENCES vybe_pessoas(id),
 -- [[classe, quantidade], ...]: o que quem propõe dá e o que pede em troca.
 oferece jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(oferece) = 'array'),
 pede jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(pede) = 'array'),
 estado text NOT NULL DEFAULT 'aberta' CHECK (estado IN ('aberta', 'aceita', 'recusada', 'cancelada')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 resolvido_em timestamptz,
 CHECK (de_pessoa <> para_pessoa),
 CHECK (jsonb_array_length(oferece) + jsonb_array_length(pede) > 0)
);
CREATE INDEX IF NOT EXISTS vybe_escritorio_trocas_abertas ON vybe_escritorio_trocas(para_pessoa, estado);
CREATE INDEX IF NOT EXISTS vybe_escritorio_trocas_enviadas ON vybe_escritorio_trocas(de_pessoa, estado);
COMMIT;
