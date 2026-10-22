-- Recado global do Escritório (decisão do Paulo, 21/10/2026): Paulo, Vinícius,
-- Ewerton e Deivid mandam um recado que aparece no meio da tela de todos, com
-- "Conferir" (leva aonde o recado aponta) e "Ignorar". Cada pessoa vê cada
-- recado uma vez; o painel guarda o que ela fez.
CREATE TABLE IF NOT EXISTS vybe_escritorio_avisos (
  id BIGSERIAL PRIMARY KEY,
  autor_id BIGINT NOT NULL REFERENCES vybe_pessoas(id),
  titulo TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 3 AND 80),
  texto TEXT NOT NULL CHECK (char_length(texto) BETWEEN 3 AND 400),
  destino TEXT NOT NULL DEFAULT '' CHECK (destino IN ('', 'reforma', 'loja', 'ranking', 'conquistas', 'missoes', 'provador')),
  estilo TEXT NOT NULL DEFAULT 'padrao' CHECK (estilo IN ('padrao', 'obra', 'festa')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  chave TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS vybe_escritorio_avisos_ativos ON vybe_escritorio_avisos (expira_em DESC);
CREATE TABLE IF NOT EXISTS vybe_escritorio_avisos_vistos (
  aviso_id BIGINT NOT NULL REFERENCES vybe_escritorio_avisos(id) ON DELETE CASCADE,
  pessoa_id BIGINT NOT NULL REFERENCES vybe_pessoas(id),
  acao TEXT NOT NULL CHECK (acao IN ('conferiu', 'ignorou')),
  em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (aviso_id, pessoa_id)
);
-- Quem pode mandar: por pessoa (o servidor confere a sessão, nunca o nome do
-- navegador). Mude aqui, sem deploy.
CREATE TABLE IF NOT EXISTS vybe_escritorio_avisos_autores (
  pessoa_id BIGINT PRIMARY KEY REFERENCES vybe_pessoas(id)
);
