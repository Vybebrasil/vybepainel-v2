-- Planejamentos mensais dos clientes (pedido do Paulo, 19/10/2026;
-- docs/planejamentos-plano.md). O agente de conteúdo do cliente publica o
-- planejamento; o head revisa e edita no painel e manda para o cliente
-- aprovar por um link (cópia por e-mail). PDF e documento ficam no Drive, na
-- pasta do cliente. Revisar e aplicar explicitamente.
BEGIN;
-- Identidade visual do cliente para o documento padrão: cores, logo, fonte e tom.
ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS identidade jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS vybe_planejamentos (
 id bigserial PRIMARY KEY,
 cliente_id bigint NOT NULL REFERENCES vybe_clientes(id),
 -- Primeiro dia do mês planejado.
 mes date NOT NULL CHECK (EXTRACT(DAY FROM mes) = 1),
 titulo text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 160),
 -- Conteúdo estruturado (formato padrão): visão, linhas, datas, peças…
 conteudo jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(conteudo) = 'object'),
 estado text NOT NULL DEFAULT 'revisar' CHECK (estado IN ('revisar','enviado','aprovado','ajustes','cadastrado','arquivado')),
 versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
 origem text NOT NULL DEFAULT 'painel' CHECK (origem IN ('agente','painel')),
 criado_por bigint REFERENCES vybe_pessoas(id),
 -- Arquivos no Drive (pasta do cliente) da última versão enviada.
 drive_doc_id text, drive_pdf_id text,
 -- Link de aprovação: só o hash do segredo fica no banco.
 link_hash text UNIQUE, link_expira_em timestamptz,
 enviado_em timestamptz, respondido_em timestamptz, resposta_nome text, resposta_texto text,
 criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vybe_planejamentos_cliente ON vybe_planejamentos(cliente_id, mes DESC);
CREATE INDEX IF NOT EXISTS vybe_planejamentos_estado ON vybe_planejamentos(estado);
-- Um planejamento ativo por cliente e mês (o agente publica de novo = nova versão).
CREATE UNIQUE INDEX IF NOT EXISTS vybe_planejamentos_um_por_mes ON vybe_planejamentos(cliente_id, mes) WHERE estado <> 'arquivado';

-- Histórico: quem fez o quê (publicou, editou, enviou, cliente aprovou…).
CREATE TABLE IF NOT EXISTS vybe_planejamento_eventos (
 id bigserial PRIMARY KEY,
 planejamento_id bigint NOT NULL REFERENCES vybe_planejamentos(id),
 tipo text NOT NULL CHECK (tipo IN ('publicado','nova_versao','editado','enviado','aprovado','ajustes','cadastrado','arquivado','comentario','email')),
 autor_id bigint REFERENCES vybe_pessoas(id),
 autor_externo text,
 texto text CHECK (texto IS NULL OR char_length(texto) <= 4000),
 versao integer,
 em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vybe_planejamento_eventos_plan ON vybe_planejamento_eventos(planejamento_id, em);
COMMIT;
