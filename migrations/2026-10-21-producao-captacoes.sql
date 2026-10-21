-- Captações da Produção (decisão do Paulo, 21/10/2026: "o fluxo fica dentro do
-- sistema e todos têm que usar"). Uma captação junta as peças de um cliente que
-- estão em "Agendar Captação" num dia e horário, vira evento no Google Agenda da
-- Vybe e cada peça é marcada "Gravado" na hora. Status de captação de cada peça
-- continua em vybe_conteudos.captacao_chave (mesmo caminho do painel, com as
-- automações); aqui fica só o agrupamento. Não mexe em dados existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_captacoes (
 id bigserial PRIMARY KEY,
 cliente_id bigint REFERENCES vybe_clientes(id),
 dia date NOT NULL,
 inicio time,
 fim time,
 local text NOT NULL DEFAULT '' CHECK (length(local) <= 300),
 observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 2000),
 estado text NOT NULL DEFAULT 'agendada' CHECK (estado IN ('agendada', 'gravada', 'cancelada')),
 evento_google text,
 aviso text,
 criado_por bigint REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 CHECK (fim IS NULL OR inicio IS NULL OR fim > inicio)
);
CREATE INDEX IF NOT EXISTS vybe_captacoes_dia ON vybe_captacoes (dia) WHERE estado <> 'cancelada';
CREATE TABLE IF NOT EXISTS vybe_captacao_pecas (
 captacao_id bigint NOT NULL REFERENCES vybe_captacoes(id) ON DELETE CASCADE,
 conteudo_id bigint NOT NULL REFERENCES vybe_conteudos(id),
 ordem integer NOT NULL DEFAULT 0,
 gravado_em timestamptz,
 gravado_por bigint REFERENCES vybe_pessoas(id),
 PRIMARY KEY (captacao_id, conteudo_id)
);
CREATE INDEX IF NOT EXISTS vybe_captacao_pecas_conteudo ON vybe_captacao_pecas (conteudo_id);
COMMIT;
