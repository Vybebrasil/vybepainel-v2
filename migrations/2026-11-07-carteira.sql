-- Carteira de clientes (Paulo, 07/11/2026, inspirado no AgencyFlow): onboarding em esteira,
-- contratos, cancelamentos (churn), o histórico mensal da nota de saúde e o clima do grupo (bot).
-- Aplicação MANUAL pelo Paulo no SQL Editor do Neon. Não é executada pela API nem pelo build.
-- Idempotente (pode rodar duas vezes). Não envia mensagens e não mexe em tabela existente.
-- Sem estas tabelas o módulo Carteira continua abrindo: a saúde é calculada na tela e as outras
-- abas mostram "aguardando ativação".
BEGIN;

-- Configuração do módulo (hoje só as etapas do onboarding: chave 'onboarding_etapas').
CREATE TABLE IF NOT EXISTS vybe_carteira_config (
 chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'),
 valor jsonb NOT NULL,
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_por bigint REFERENCES vybe_pessoas(id)
);

-- Onboarding: um por cliente. `etapas` = { etapa_id: { responsavel_id, feitos: { item_id: { em, por_id, por } } } }.
CREATE TABLE IF NOT EXISTS vybe_cliente_onboarding (
 cliente_id bigint PRIMARY KEY REFERENCES vybe_clientes(id) ON DELETE CASCADE,
 etapas jsonb NOT NULL DEFAULT '{}'::jsonb,
 iniciado_em timestamptz NOT NULL DEFAULT now(),
 iniciado_por bigint REFERENCES vybe_pessoas(id),
 encerrado_em timestamptz,
 atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Contrato vigente do cliente (sem assinatura eletrônica: só o registro).
CREATE TABLE IF NOT EXISTS vybe_cliente_contratos (
 cliente_id bigint PRIMARY KEY REFERENCES vybe_clientes(id) ON DELETE CASCADE,
 valor_mensal numeric(12,2) CHECK (valor_mensal IS NULL OR valor_mensal >= 0),
 inicio date,
 renovacao date,
 status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','negociando','aviso_previo','encerrado')),
 observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 1000),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_por bigint REFERENCES vybe_pessoas(id)
);
CREATE INDEX IF NOT EXISTS vybe_cliente_contratos_renovacao ON vybe_cliente_contratos (renovacao);

-- Saída do cliente: data, tipo e motivo. A desativação continua no ciclo de vida (vybe-ciclo.js);
-- isto só classifica o porquê.
CREATE TABLE IF NOT EXISTS vybe_cliente_churn (
 id bigserial PRIMARY KEY,
 cliente_id bigint NOT NULL REFERENCES vybe_clientes(id) ON DELETE CASCADE,
 saiu_em date NOT NULL,
 tipo text NOT NULL CHECK (tipo IN ('cancelamento','nao_renovou','pausa')),
 motivo text NOT NULL CHECK (motivo IN ('preco','resultado','atendimento','fechou_empresa','internalizou','outro')),
 detalhe text NOT NULL DEFAULT '' CHECK (length(detalhe) <= 1000),
 receita_mensal numeric(12,2) CHECK (receita_mensal IS NULL OR receita_mensal >= 0),
 registrado_em timestamptz NOT NULL DEFAULT now(),
 registrado_por bigint REFERENCES vybe_pessoas(id),
 UNIQUE (cliente_id, saiu_em)
);
CREATE INDEX IF NOT EXISTS vybe_cliente_churn_saiu ON vybe_cliente_churn (saiu_em DESC);

-- Nota de saúde do mês (a última do mês vale). `mes` é sempre o dia 1.
CREATE TABLE IF NOT EXISTS vybe_carteira_saude_mensal (
 mes date NOT NULL CHECK (extract(day FROM mes) = 1),
 cliente_id bigint NOT NULL REFERENCES vybe_clientes(id) ON DELETE CASCADE,
 score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
 risco text NOT NULL CHECK (risco IN ('alto','medio','baixo')),
 motivos jsonb NOT NULL DEFAULT '[]'::jsonb,
 heads text NOT NULL DEFAULT '',
 registrado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (mes, cliente_id)
);

-- Clima do grupo do cliente: sinal opcional que o bot do WhatsApp grava (uma linha por cliente).
-- pontos de -20 a +10 entram na nota de saúde (vybe-carteira-saude.js); mais de 14 dias, ignorado.
CREATE TABLE IF NOT EXISTS vybe_carteira_clima (
 cliente_id bigint PRIMARY KEY REFERENCES vybe_clientes(id) ON DELETE CASCADE,
 pontos smallint NOT NULL CHECK (pontos BETWEEN -20 AND 10),
 motivo text NOT NULL DEFAULT '' CHECK (length(motivo) <= 200),
 origem text NOT NULL DEFAULT 'bot' CHECK (length(origem) <= 40),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMIT;
