BEGIN;
-- Subsolo do Escritório (Paulo, 27/10/2026): sala comum escondida embaixo do
-- Centro de Operação, onde ficam os clientes e colaboradores desativados. Tem
-- camada própria no editor, post-its, voz e conversa escrita, como as outras.
-- Só amplia as chaves aceitas; nada é apagado nem reescrito. Pode rodar de novo.
ALTER TABLE IF EXISTS vybe_escritorio_mapa DROP CONSTRAINT IF EXISTS vybe_escritorio_mapa_andares;
ALTER TABLE IF EXISTS vybe_escritorio_mapa ADD CONSTRAINT vybe_escritorio_mapa_andares CHECK(camada='geral' OR camada ~ '^(sala-([0-9]|1[01])(-andar-1)?|recepcao|reuniao|auditorio|producao|cafe|jogos|foco|academia|lounge|operacao|subsolo)$');
ALTER TABLE IF EXISTS vybe_escritorio_mapa_versoes DROP CONSTRAINT IF EXISTS vybe_escritorio_mapa_versoes_andares;
ALTER TABLE IF EXISTS vybe_escritorio_mapa_versoes ADD CONSTRAINT vybe_escritorio_mapa_versoes_andares CHECK(camada='geral' OR camada ~ '^(sala-([0-9]|1[01])(-andar-1)?|recepcao|reuniao|auditorio|producao|cafe|jogos|foco|academia|lounge|operacao|subsolo)$');
ALTER TABLE IF EXISTS vybe_escritorio_imagens DROP CONSTRAINT IF EXISTS vybe_escritorio_imagens_andares;
ALTER TABLE IF EXISTS vybe_escritorio_imagens ADD CONSTRAINT vybe_escritorio_imagens_andares CHECK(camada='geral' OR camada ~ '^(sala-([0-9]|1[01])(-andar-1)?|recepcao|reuniao|auditorio|producao|cafe|jogos|foco|academia|lounge|operacao|subsolo)$');
ALTER TABLE IF EXISTS vybe_escritorio_postits DROP CONSTRAINT IF EXISTS vybe_escritorio_postits_camada_check;
ALTER TABLE IF EXISTS vybe_escritorio_postits ADD CONSTRAINT vybe_escritorio_postits_camada_check CHECK (camada ~ '^(sala-([0-9]|1[01])(-andar-1)?|recepcao|reuniao|auditorio|producao|cafe|jogos|foco|academia|lounge|operacao|subsolo)$');
-- Conversa escrita do subsolo: a sala nova entra na lista das mensagens.
ALTER TABLE IF EXISTS vybe_escritorio_mensagens DROP CONSTRAINT IF EXISTS vybe_escritorio_mensagens_sala_check;
ALTER TABLE IF EXISTS vybe_escritorio_mensagens ADD CONSTRAINT vybe_escritorio_mensagens_sala_check CHECK (sala IN ('convivencia','criacao','atendimento','producao','reuniao','foco','subsolo'));
-- Ciclo de vida de cliente e colaborador (server/ciclo-de-vida.js). O código
-- também cria estas colunas sozinho no primeiro uso; aqui ficam registradas.
ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS desativado_em TIMESTAMPTZ;
ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS apagado_em TIMESTAMPTZ;
ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS ciclo_em TIMESTAMPTZ;
ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS desativado_em TIMESTAMPTZ;
ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS apagado_em TIMESTAMPTZ;
ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS ciclo_em TIMESTAMPTZ;
ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS entrava_antes BOOLEAN;
CREATE TABLE IF NOT EXISTS vybe_pessoa_eventos (
  id        BIGSERIAL PRIMARY KEY,
  pessoa_id BIGINT NOT NULL REFERENCES vybe_pessoas(id) ON DELETE CASCADE,
  tipo      TEXT NOT NULL,
  de        TEXT,
  para      TEXT,
  motivo    TEXT,
  autor     TEXT,
  em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vybe_pessoa_eventos_pessoa ON vybe_pessoa_eventos (pessoa_id, em DESC);
COMMIT;
