-- CRM do 1º andar. Aplicação MANUAL pelo Paulo no SQL Editor do Neon.
-- Não é executada pela API nem pelo build. Não envia mensagens.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_crm_oportunidades (
 id bigserial PRIMARY KEY,
 chave_empresa text NOT NULL UNIQUE,
 cnpj text NOT NULL DEFAULT '' CHECK (cnpj = '' OR cnpj ~ '^[0-9]{14}$'),
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 200),
 setor_empresa text NOT NULL DEFAULT '',
 etapa text NOT NULL DEFAULT 'empresa' CHECK (etapa IN ('empresa','qualificacao','abordagem_proposta','aprovada','contato_feito','reuniao','proposta_comercial','ganho','perdido')),
 responsavel bigint REFERENCES vybe_pessoas(id),
 agente_responsavel text NOT NULL DEFAULT 'sdr' CHECK (agente_responsavel = 'sdr'),
 proxima_acao text NOT NULL DEFAULT '' CHECK (length(proxima_acao) <= 2000),
 proxima_acao_data date,
 criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 versao bigint NOT NULL DEFAULT 1,
 aprovada_por bigint REFERENCES vybe_pessoas(id),
 aprovada_em timestamptz,
 encerrado_em timestamptz,
 legado jsonb
);
CREATE INDEX IF NOT EXISTS vybe_crm_etapa ON vybe_crm_oportunidades (etapa, atualizado_em DESC, id DESC);
CREATE INDEX IF NOT EXISTS vybe_crm_responsavel ON vybe_crm_oportunidades (responsavel);
CREATE TABLE IF NOT EXISTS vybe_crm_historico (
 id bigserial PRIMARY KEY,
 oportunidade_id bigint NOT NULL REFERENCES vybe_crm_oportunidades(id),
 quem bigint NOT NULL REFERENCES vybe_pessoas(id),
 quem_nome text NOT NULL,
 quando timestamptz NOT NULL DEFAULT now(),
 de_etapa text,
 para_etapa text NOT NULL,
 tipo text NOT NULL CHECK (tipo IN ('criacao','importacao','etapa','edicao','comentario')),
 observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 4000),
 detalhes jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS vybe_crm_historico_oportunidade ON vybe_crm_historico (oportunidade_id, id DESC);
COMMIT;
