-- Biblioteca de roteiros da Produção (decisão do Paulo, 21/10/2026: "pegar
-- todos roteiros que já foram criados em cada cliente... manter organizado por
-- período... ver quais conteúdos geraram e estão cadastrados daqueles docs").
-- O roteiro continua no Google Docs (o Drive guarda os arquivos); aqui fica a
-- referência: o doc, o cliente, as peças que ele descreve e quais conteúdos do
-- painel saíram dele. Um conteúdo pode vir de mais de um roteiro. Não mexe em
-- dados existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_roteiros (
 id bigserial PRIMARY KEY,
 doc_id text NOT NULL UNIQUE CHECK (doc_id ~ '^[A-Za-z0-9_-]{20,100}$'),
 titulo text NOT NULL CHECK (length(titulo) BETWEEN 1 AND 300),
 cliente_id bigint REFERENCES vybe_clientes(id),
 criado_em date NOT NULL,
 pecas jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(pecas) = 'array'),
 origem text NOT NULL DEFAULT 'drive' CHECK (origem IN ('drive', 'importado', 'painel')),
 incluido_por bigint REFERENCES vybe_pessoas(id),
 incluido_em timestamptz NOT NULL DEFAULT now(),
 removido_em timestamptz
);
CREATE INDEX IF NOT EXISTS vybe_roteiros_cliente ON vybe_roteiros (cliente_id, criado_em DESC) WHERE removido_em IS NULL;
CREATE TABLE IF NOT EXISTS vybe_roteiro_conteudos (
 roteiro_id bigint NOT NULL REFERENCES vybe_roteiros(id) ON DELETE CASCADE,
 conteudo_id bigint NOT NULL REFERENCES vybe_conteudos(id),
 ligado_por bigint REFERENCES vybe_pessoas(id),
 ligado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (roteiro_id, conteudo_id)
);
CREATE INDEX IF NOT EXISTS vybe_roteiro_conteudos_conteudo ON vybe_roteiro_conteudos (conteudo_id);
COMMIT;
