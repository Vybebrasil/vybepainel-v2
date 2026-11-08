-- Comercial e finanças da agência (Paulo, 07/11/2026; inspirado no AgencyFlow).
-- Aplicação MANUAL pelo Paulo no SQL Editor do Neon, DEPOIS de 2026-11-07-crm-prospeccao.sql.
-- Não é executada pela API nem pelo build. Não envia mensagens. Não altera clientes nem pessoas.
-- Sem ela o painel continua funcionando: a área Comercial responde 503 explicando a migração pendente,
-- e o CRM segue com as etapas antigas (Follow-up e valor da negociação dependem dela).
BEGIN;

-- Pacotes da Vybe (esteira de produtos). Custo estimado = horas × custo/hora + captações × custo por captação.
CREATE TABLE IF NOT EXISTS vybe_comercial_pacotes (
 id bigserial PRIMARY KEY,
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 120),
 tipo text NOT NULL CHECK (tipo IN ('recorrente','avulso')),
 preco numeric(12,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
 entregas jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(entregas) = 'array'),
 horas numeric(8,2) NOT NULL DEFAULT 0 CHECK (horas >= 0),
 custo_hora numeric(10,2) NOT NULL DEFAULT 0 CHECK (custo_hora >= 0),
 captacoes integer NOT NULL DEFAULT 0 CHECK (captacoes >= 0),
 custo_captacao numeric(10,2) NOT NULL DEFAULT 0 CHECK (custo_captacao >= 0),
 -- Carga do pacote: demandas por mês por cargo (função do Escritório), para Capacidade × vendas.
 carga jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(carga) = 'object'),
 ativo boolean NOT NULL DEFAULT true,
 criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 versao bigint NOT NULL DEFAULT 1
);

-- CRM: etapa Follow-up e valor da negociação (recorrente mensal × avulso) com o pacote vendido.
ALTER TABLE vybe_crm_oportunidades DROP CONSTRAINT IF EXISTS vybe_crm_oportunidades_etapa_check;
-- Etapas do meio do funil são configuráveis (vybe_crm_etapas_config): o banco confere o formato; o servidor confere a lista.
ALTER TABLE vybe_crm_oportunidades ADD CONSTRAINT vybe_crm_oportunidades_etapa_check CHECK (etapa ~ '^[a-z]' AND etapa !~ '[^a-z0-9_]' AND length(etapa) BETWEEN 2 AND 40);
CREATE TABLE IF NOT EXISTS vybe_crm_etapas_config (
 etapa text PRIMARY KEY CHECK (etapa ~ '^[a-z]' AND etapa !~ '[^a-z0-9_]' AND length(etapa) BETWEEN 2 AND 40 AND etapa NOT IN ('empresa','qualificacao','abordagem_proposta','aprovada','ganho','perdido')),
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 60),
 ordem integer NOT NULL,
 extra boolean NOT NULL DEFAULT false,
 atualizado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vybe_crm_oportunidades ADD COLUMN IF NOT EXISTS valor_mensal numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_mensal >= 0);
ALTER TABLE vybe_crm_oportunidades ADD COLUMN IF NOT EXISTS valor_avulso numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_avulso >= 0);
ALTER TABLE vybe_crm_oportunidades ADD COLUMN IF NOT EXISTS pacote_id bigint REFERENCES vybe_comercial_pacotes(id);

-- Orçamentos: os itens guardam nome/tipo/preço do pacote no momento da proposta (mudar o pacote depois não muda a proposta).
CREATE TABLE IF NOT EXISTS vybe_comercial_orcamentos (
 id bigserial PRIMARY KEY,
 cliente_nome text NOT NULL CHECK (length(trim(cliente_nome)) BETWEEN 1 AND 200),
 oportunidade_id bigint REFERENCES vybe_crm_oportunidades(id),
 itens jsonb NOT NULL CHECK (jsonb_typeof(itens) = 'array' AND jsonb_array_length(itens) BETWEEN 1 AND 30),
 desconto_percentual numeric(5,2) NOT NULL DEFAULT 0 CHECK (desconto_percentual BETWEEN 0 AND 100),
 validade date NOT NULL,
 observacoes text NOT NULL DEFAULT '' CHECK (length(observacoes) <= 4000),
 status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','aceito','recusado')),
 criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vybe_comercial_orcamentos_recentes ON vybe_comercial_orcamentos (criado_em DESC, id DESC);

-- Finanças por cliente (só donos e administração): contrato mensal, pacote e status de pagamento informado à mão.
CREATE TABLE IF NOT EXISTS vybe_comercial_financas_cliente (
 cliente_id bigint PRIMARY KEY REFERENCES vybe_clientes(id),
 valor_mensal numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_mensal >= 0),
 pacote_id bigint REFERENCES vybe_comercial_pacotes(id),
 status_pagamento text NOT NULL DEFAULT 'em_dia' CHECK (status_pagamento IN ('em_dia','atrasado','inadimplente')),
 observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 1000),
 atualizado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 versao bigint NOT NULL DEFAULT 1
);

-- Creators de Irecê (influenciadores locais).
CREATE TABLE IF NOT EXISTS vybe_comercial_creators (
 id bigserial PRIMARY KEY,
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 120),
 arroba text NOT NULL DEFAULT '' CHECK (length(arroba) <= 60),
 seguidores integer NOT NULL DEFAULT 0 CHECK (seguidores >= 0),
 engajamento numeric(5,2) NOT NULL DEFAULT 0 CHECK (engajamento BETWEEN 0 AND 100),
 nicho text NOT NULL DEFAULT '' CHECK (length(nicho) <= 60),
 cidade text NOT NULL DEFAULT '' CHECK (length(cidade) <= 60),
 contato text NOT NULL DEFAULT '' CHECK (length(contato) <= 200),
 observacoes text NOT NULL DEFAULT '' CHECK (length(observacoes) <= 2000),
 ativo boolean NOT NULL DEFAULT true,
 criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Fornecedores (só donos e administração), com BV (% de bonificação de volume).
CREATE TABLE IF NOT EXISTS vybe_comercial_fornecedores (
 id bigserial PRIMARY KEY,
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 120),
 categoria text NOT NULL CHECK (categoria IN ('grafica','eventos','brindes','audiovisual','fotografia','midia_ooh','trafego','ti','cenografia','textil','outros')),
 bv_percentual numeric(5,2) NOT NULL DEFAULT 0 CHECK (bv_percentual BETWEEN 0 AND 100),
 contato text NOT NULL DEFAULT '' CHECK (length(contato) <= 200),
 observacoes text NOT NULL DEFAULT '' CHECK (length(observacoes) <= 2000),
 ativo boolean NOT NULL DEFAULT true,
 criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Recebimentos (só donos e administração). Uma linha por fatura: o recorrente lança o próximo ciclo como nova linha,
-- para o histórico ficar. Status (recebido, pendente, atrasado, inadimplente) é calculado pela data, não gravado.
CREATE TABLE IF NOT EXISTS vybe_comercial_recebiveis (
 id bigserial PRIMARY KEY,
 tipo text NOT NULL CHECK (tipo IN ('recorrente','pontual')),
 cliente_id bigint REFERENCES vybe_clientes(id),
 descricao text NOT NULL DEFAULT '' CHECK (length(descricao) <= 200),
 categoria text NOT NULL DEFAULT '' CHECK (length(categoria) <= 60),
 ciclo text CHECK (ciclo IS NULL OR ciclo IN ('mensal','trimestral','semestral','anual')),
 valor numeric(12,2) NOT NULL CHECK (valor > 0),
 valor_recebido numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_recebido >= 0),
 vencimento date NOT NULL,
 recebido_em date,
 cancelado boolean NOT NULL DEFAULT false,
 criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 CHECK (tipo = 'pontual' OR (cliente_id IS NOT NULL AND ciclo IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS vybe_comercial_recebiveis_vencimento ON vybe_comercial_recebiveis (vencimento);

-- Contas a pagar (só donos e administração).
CREATE TABLE IF NOT EXISTS vybe_comercial_contas (
 id bigserial PRIMARY KEY,
 grupo text NOT NULL CHECK (grupo IN ('fixa','variavel','folha','imposto','investimento')),
 descricao text NOT NULL CHECK (length(trim(descricao)) BETWEEN 1 AND 200),
 fornecedor_id bigint REFERENCES vybe_comercial_fornecedores(id),
 valor numeric(12,2) NOT NULL CHECK (valor > 0),
 vencimento date NOT NULL,
 pago_em date,
 cancelada boolean NOT NULL DEFAULT false,
 criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vybe_comercial_contas_vencimento ON vybe_comercial_contas (vencimento);
-- Capacidade mensal por cargo (os donos configuram): quantas demandas cada cargo dá conta por mês.
CREATE TABLE IF NOT EXISTS vybe_comercial_capacidade (
 cargo text PRIMARY KEY CHECK (cargo IN ('criacao','atendimento','agendamento','producao','gestao')),
 capacidade_mensal integer NOT NULL DEFAULT 0 CHECK (capacidade_mensal BETWEEN 0 AND 100000),
 atualizado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
COMMIT;
