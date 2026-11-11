-- Financeiro dentro do Vybe OS, fase 1: a base de dados (Paulo, 11/11/2026: abolir o Vybe Finanças e trazer tudo para cá).
-- Aplicação MANUAL pelo Paulo no SQL Editor do Neon, DEPOIS de 2026-11-07-comercial.sql e 2026-11-07-carteira.sql.
-- Não é executada pela API nem pelo build. Não envia mensagens. Não apaga nem altera nenhum dado existente:
-- só acrescenta colunas e tabelas e afrouxa três limites para as linhas que vêm do Finanças.
-- Pode rodar de novo quantas vezes quiser (idempotente).
-- Sem ela o painel continua igual (a ponte com o Finanças segue sendo a fonte); com ela aplicada, nada muda na tela
-- até o importador (scripts/financas-importar.mjs) gravar e a chave VYBE_FINANCAS_FONTE=local ser ligada.
-- Quem vê: tudo aqui é dinheiro ou salário, só dos quatro donos. O banco não tem RLS: a regra fica no servidor
-- (server/financas-local.js, server/comercial.js, server/vybe-financas-api.js).
BEGIN;

-- 1. Cliente do Vybe OS ↔ cliente do Finanças (hoje a ligação é refeita a cada leitura por CNPJ e nome). -------------
ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS financas_cliente_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS vybe_clientes_financas_cliente ON vybe_clientes (financas_cliente_id) WHERE financas_cliente_id IS NOT NULL;

-- Os clientes do Finanças como vieram de lá (uma linha por cliente de lá, ligado ou não). É a lista que o Paulo decide:
-- cliente sem par NUNCA vira cliente do Vybe OS sozinho. A mensalidade e o status de contrato de lá alimentam o
-- "previsto do mês" enquanto a recorrência não mora aqui.
CREATE TABLE IF NOT EXISTS vybe_financas_clientes_origem (
 origem_financas_id uuid PRIMARY KEY,
 nome text NOT NULL DEFAULT '',
 cnpj text NOT NULL DEFAULT '',
 contato text NOT NULL DEFAULT '',
 email text NOT NULL DEFAULT '',
 telefone text NOT NULL DEFAULT '',
 plano text NOT NULL DEFAULT '',
 valor_mensal numeric(12,2) NOT NULL DEFAULT 0,
 dia_vencimento integer,
 status_contrato text NOT NULL DEFAULT '',
 cliente_id bigint REFERENCES vybe_clientes(id),
 -- Como foi ligado: id (já gravado em vybe_clientes), cnpj, nome ou nome_parecido (um candidato só). Vazio = sem par.
 ligado_por text NOT NULL DEFAULT '' CHECK (ligado_por IN ('', 'id', 'cnpj', 'nome', 'nome_parecido')),
 -- pendente = o Paulo ainda não decidiu; ligar = usar cliente_id; ignorar = cliente antigo, fica só no histórico.
 decisao text NOT NULL DEFAULT 'pendente' CHECK (decisao IN ('pendente', 'ligar', 'ignorar')),
 importado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vybe_financas_clientes_origem_cliente ON vybe_financas_clientes_origem (cliente_id);

-- 2. Contas bancárias e transferências entre elas. --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vybe_financas_contas_bancarias (
 id bigserial PRIMARY KEY,
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 120),
 instituicao text NOT NULL DEFAULT '' CHECK (length(instituicao) <= 120),
 tipo text NOT NULL DEFAULT 'corrente' CHECK (tipo IN ('corrente', 'cartao_credito', 'dinheiro', 'outro')),
 saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
 padrao boolean NOT NULL DEFAULT false,
 ativo boolean NOT NULL DEFAULT true,
 -- true = a conta veio só como referência de um lançamento (o papel de leitura não enxergava bank_accounts): falta o nome.
 nome_pendente boolean NOT NULL DEFAULT false,
 origem_financas_id uuid UNIQUE,
 criado_por bigint REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vybe_financas_transferencias (
 id bigserial PRIMARY KEY,
 descricao text NOT NULL DEFAULT '' CHECK (length(descricao) <= 1000),
 categoria text NOT NULL DEFAULT '' CHECK (length(categoria) <= 120),
 valor numeric(12,2) NOT NULL,
 data date NOT NULL,
 efetivada_em date,
 cancelada boolean NOT NULL DEFAULT false,
 conta_origem_id bigint REFERENCES vybe_financas_contas_bancarias(id),
 conta_destino_id bigint REFERENCES vybe_financas_contas_bancarias(id),
 forma_pagamento text NOT NULL DEFAULT '' CHECK (length(forma_pagamento) <= 60),
 comprovante_url text NOT NULL DEFAULT '' CHECK (length(comprovante_url) <= 2000),
 origem_financas_id uuid UNIQUE,
 criado_por bigint REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 CHECK (valor > 0 OR origem_financas_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS vybe_financas_transferencias_data ON vybe_financas_transferencias (data);

-- 3. Remuneração da equipe (só donos): valor atual, histórico por mês de vigência e vales. --------------------------
-- pessoa_id liga à pessoa do Vybe OS quando o nome bate exatamente; sem par, a linha fica só com o nome de lá.
CREATE TABLE IF NOT EXISTS vybe_financas_equipe (
 id bigserial PRIMARY KEY,
 pessoa_id bigint UNIQUE REFERENCES vybe_pessoas(id),
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 160),
 cargo text NOT NULL DEFAULT '' CHECK (length(cargo) <= 160),
 salario numeric(12,2) NOT NULL DEFAULT 0 CHECK (salario >= 0),
 bonus numeric(12,2) NOT NULL DEFAULT 0 CHECK (bonus >= 0),
 dia_pagamento integer CHECK (dia_pagamento IS NULL OR dia_pagamento BETWEEN 1 AND 31),
 chave_pix text NOT NULL DEFAULT '' CHECK (length(chave_pix) <= 200),
 observacoes text NOT NULL DEFAULT '' CHECK (length(observacoes) <= 4000),
 ativo boolean NOT NULL DEFAULT true,
 origem_financas_id uuid UNIQUE,
 atualizado_por bigint REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
-- vigente_desde = AAAA-MM. '1970-01' é a base ("desde sempre"), como no Finanças.
CREATE TABLE IF NOT EXISTS vybe_financas_equipe_historico (
 id bigserial PRIMARY KEY,
 equipe_id bigint NOT NULL REFERENCES vybe_financas_equipe(id) ON DELETE CASCADE,
 vigente_desde text NOT NULL CHECK (vigente_desde ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 salario numeric(12,2) NOT NULL CHECK (salario >= 0),
 bonus numeric(12,2) NOT NULL DEFAULT 0 CHECK (bonus >= 0),
 criado_por bigint REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE (equipe_id, vigente_desde)
);

-- 4. Assinaturas e custos fixos. -----------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vybe_financas_assinaturas (
 id bigserial PRIMARY KEY,
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 160),
 custo numeric(12,2) NOT NULL DEFAULT 0,
 dia_renovacao integer CHECK (dia_renovacao IS NULL OR dia_renovacao BETWEEN 1 AND 31),
 forma_pagamento text NOT NULL DEFAULT '' CHECK (length(forma_pagamento) <= 60),
 categoria text NOT NULL DEFAULT '' CHECK (length(categoria) <= 120),
 conta_bancaria_id bigint REFERENCES vybe_financas_contas_bancarias(id),
 ativo boolean NOT NULL DEFAULT true,
 origem_financas_id uuid UNIQUE,
 criado_por bigint REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- 5. Orçamento mensal por categoria e fechamento do mês. ------------------------------------------------------------
-- (vybe_comercial_orcamentos é outra coisa: as propostas comerciais.)
CREATE TABLE IF NOT EXISTS vybe_financas_orcamento_mensal (
 id bigserial PRIMARY KEY,
 mes text NOT NULL CHECK (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 categoria text NOT NULL CHECK (length(trim(categoria)) BETWEEN 1 AND 120),
 valor numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
 origem_financas_id uuid UNIQUE,
 atualizado_por bigint REFERENCES vybe_pessoas(id),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE (mes, categoria)
);
-- Mês fechado: `totais` guarda a foto dos números no fechamento; `documento_url` é o documento do mês para a contabilidade.
CREATE TABLE IF NOT EXISTS vybe_financas_fechamentos (
 mes text PRIMARY KEY CHECK (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 fechado_em timestamptz NOT NULL DEFAULT now(),
 fechado_por bigint REFERENCES vybe_pessoas(id),
 fechado_por_email text NOT NULL DEFAULT '' CHECK (length(fechado_por_email) <= 200),
 observacoes text NOT NULL DEFAULT '' CHECK (length(observacoes) <= 4000),
 totais jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(totais) = 'object'),
 documento_url text NOT NULL DEFAULT '' CHECK (length(documento_url) <= 2000),
 origem_financas_id uuid UNIQUE
);

-- 6. Recebimentos: o que faltava para receber o histórico do Finanças. ----------------------------------------------
ALTER TABLE vybe_comercial_recebiveis ADD COLUMN IF NOT EXISTS forma_pagamento text NOT NULL DEFAULT '' CHECK (length(forma_pagamento) <= 60);
ALTER TABLE vybe_comercial_recebiveis ADD COLUMN IF NOT EXISTS comprovante_url text NOT NULL DEFAULT '' CHECK (length(comprovante_url) <= 2000);
ALTER TABLE vybe_comercial_recebiveis ADD COLUMN IF NOT EXISTS conta_bancaria_id bigint REFERENCES vybe_financas_contas_bancarias(id);
-- O cliente como estava no lançamento do Finanças (fica mesmo sem par no Vybe OS ou apagado lá).
ALTER TABLE vybe_comercial_recebiveis ADD COLUMN IF NOT EXISTS financas_cliente_id uuid;
-- uuid da transação no Finanças: é o que deixa a importação rodar de novo sem duplicar.
ALTER TABLE vybe_comercial_recebiveis ADD COLUMN IF NOT EXISTS origem_financas_id uuid;
ALTER TABLE vybe_comercial_recebiveis ADD COLUMN IF NOT EXISTS importado_em timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS vybe_comercial_recebiveis_origem ON vybe_comercial_recebiveis (origem_financas_id);
-- Linha importada não tem "quem lançou" no Vybe OS; a do painel continua exigindo.
ALTER TABLE vybe_comercial_recebiveis ALTER COLUMN criado_por DROP NOT NULL;
ALTER TABLE vybe_comercial_recebiveis DROP CONSTRAINT IF EXISTS vybe_comercial_recebiveis_autor_check;
ALTER TABLE vybe_comercial_recebiveis ADD CONSTRAINT vybe_comercial_recebiveis_autor_check CHECK (criado_por IS NOT NULL OR origem_financas_id IS NOT NULL);
-- Os limites do formulário (valor > 0, descrição até 200, categoria até 60) valem para o que é digitado aqui; o que vem
-- do Finanças entra como está lá (valor zero ou negativo, texto longo), para os números baterem.
ALTER TABLE vybe_comercial_recebiveis DROP CONSTRAINT IF EXISTS vybe_comercial_recebiveis_valor_check;
ALTER TABLE vybe_comercial_recebiveis ADD CONSTRAINT vybe_comercial_recebiveis_valor_check CHECK (valor > 0 OR origem_financas_id IS NOT NULL);
ALTER TABLE vybe_comercial_recebiveis DROP CONSTRAINT IF EXISTS vybe_comercial_recebiveis_descricao_check;
ALTER TABLE vybe_comercial_recebiveis ADD CONSTRAINT vybe_comercial_recebiveis_descricao_check CHECK (length(descricao) <= 200 OR (origem_financas_id IS NOT NULL AND length(descricao) <= 1000));
ALTER TABLE vybe_comercial_recebiveis DROP CONSTRAINT IF EXISTS vybe_comercial_recebiveis_categoria_check;
ALTER TABLE vybe_comercial_recebiveis ADD CONSTRAINT vybe_comercial_recebiveis_categoria_check CHECK (length(categoria) <= 60 OR (origem_financas_id IS NOT NULL AND length(categoria) <= 120));

-- 7. Contas a pagar: categoria, forma de pagamento, comprovante, conta bancária, pessoa (folha) e cliente (margem). ---
ALTER TABLE vybe_comercial_contas ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT '' CHECK (length(categoria) <= 120);
ALTER TABLE vybe_comercial_contas ADD COLUMN IF NOT EXISTS forma_pagamento text NOT NULL DEFAULT '' CHECK (length(forma_pagamento) <= 60);
ALTER TABLE vybe_comercial_contas ADD COLUMN IF NOT EXISTS comprovante_url text NOT NULL DEFAULT '' CHECK (length(comprovante_url) <= 2000);
ALTER TABLE vybe_comercial_contas ADD COLUMN IF NOT EXISTS conta_bancaria_id bigint REFERENCES vybe_financas_contas_bancarias(id);
-- De quem é o pagamento quando é folha (salário, bônus, vale): a linha da equipe, que aponta para a pessoa do Vybe OS.
ALTER TABLE vybe_comercial_contas ADD COLUMN IF NOT EXISTS equipe_id bigint REFERENCES vybe_financas_equipe(id);
-- Despesa ligada a um cliente (entra na margem real do cliente).
ALTER TABLE vybe_comercial_contas ADD COLUMN IF NOT EXISTS cliente_id bigint REFERENCES vybe_clientes(id);
ALTER TABLE vybe_comercial_contas ADD COLUMN IF NOT EXISTS financas_cliente_id uuid;
ALTER TABLE vybe_comercial_contas ADD COLUMN IF NOT EXISTS origem_financas_id uuid;
ALTER TABLE vybe_comercial_contas ADD COLUMN IF NOT EXISTS importado_em timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS vybe_comercial_contas_origem ON vybe_comercial_contas (origem_financas_id);
CREATE INDEX IF NOT EXISTS vybe_comercial_contas_equipe ON vybe_comercial_contas (equipe_id) WHERE equipe_id IS NOT NULL;
ALTER TABLE vybe_comercial_contas ALTER COLUMN criado_por DROP NOT NULL;
ALTER TABLE vybe_comercial_contas DROP CONSTRAINT IF EXISTS vybe_comercial_contas_autor_check;
ALTER TABLE vybe_comercial_contas ADD CONSTRAINT vybe_comercial_contas_autor_check CHECK (criado_por IS NOT NULL OR origem_financas_id IS NOT NULL);
ALTER TABLE vybe_comercial_contas DROP CONSTRAINT IF EXISTS vybe_comercial_contas_valor_check;
ALTER TABLE vybe_comercial_contas ADD CONSTRAINT vybe_comercial_contas_valor_check CHECK (valor > 0 OR origem_financas_id IS NOT NULL);
ALTER TABLE vybe_comercial_contas DROP CONSTRAINT IF EXISTS vybe_comercial_contas_descricao_check;
ALTER TABLE vybe_comercial_contas ADD CONSTRAINT vybe_comercial_contas_descricao_check CHECK (length(trim(descricao)) BETWEEN 1 AND 200 OR (origem_financas_id IS NOT NULL AND length(descricao) <= 1000));

-- Vales da equipe (só donos). Depois das contas: o vale pode apontar para o lançamento que o pagou.
-- No Finanças o vale não era tabela: era a despesa ligada ao funcionário fora do salário, e o abatimento uma categoria.
-- A importação NÃO preenche esta tabela (essas despesas ficam em vybe_comercial_contas com equipe_id); ela é para o
-- registro explícito daqui para a frente.
CREATE TABLE IF NOT EXISTS vybe_financas_vales (
 id bigserial PRIMARY KEY,
 equipe_id bigint NOT NULL REFERENCES vybe_financas_equipe(id),
 tipo text NOT NULL CHECK (tipo IN ('vale', 'abatimento')),
 valor numeric(12,2) NOT NULL CHECK (valor > 0),
 data date NOT NULL,
 descricao text NOT NULL DEFAULT '' CHECK (length(descricao) <= 200),
 conta_id bigint REFERENCES vybe_comercial_contas(id),
 criado_por bigint REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vybe_financas_vales_equipe ON vybe_financas_vales (equipe_id, data);

-- 8. Contratos: vários por cliente, com título, assinatura, fim, parâmetros e PDF. ----------------------------------
-- Antes: cliente_id era a chave (um contrato por cliente). Agora cada contrato tem id próprio; o contrato lançado à mão
-- na Carteira continua sendo um por cliente (índice parcial abaixo), e os que vêm do Finanças entram ao lado.
DO $$
DECLARE v_coluna text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'vybe_cliente_contratos' AND column_name = 'id') THEN
    ALTER TABLE vybe_cliente_contratos ADD COLUMN id bigint GENERATED BY DEFAULT AS IDENTITY;
  END IF;
  SELECT a.attname INTO v_coluna FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'vybe_cliente_contratos'::regclass AND c.contype = 'p' AND array_length(c.conkey, 1) = 1;
  IF v_coluna = 'cliente_id' THEN
    ALTER TABLE vybe_cliente_contratos DROP CONSTRAINT vybe_cliente_contratos_pkey;
    v_coluna := NULL;
  END IF;
  IF v_coluna IS NULL THEN
    ALTER TABLE vybe_cliente_contratos ADD CONSTRAINT vybe_cliente_contratos_pkey PRIMARY KEY (id);
  END IF;
END $$;
ALTER TABLE vybe_cliente_contratos ALTER COLUMN cliente_id DROP NOT NULL;
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS titulo text NOT NULL DEFAULT '' CHECK (length(titulo) <= 300);
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS assinado_em date;
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS fim date;
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS dia_vencimento integer CHECK (dia_vencimento IS NULL OR dia_vencimento BETWEEN 1 AND 31);
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS modelo text NOT NULL DEFAULT '' CHECK (length(modelo) <= 120);
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS parametros jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(parametros) = 'object');
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS pdf_url text NOT NULL DEFAULT '' CHECK (length(pdf_url) <= 2000);
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS pdf_nome text NOT NULL DEFAULT '' CHECK (length(pdf_nome) <= 300);
-- O status escrito no Finanças (Ativo, Pendente, Encerrado, Cancelado); `status` guarda o equivalente da Carteira.
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS status_origem text NOT NULL DEFAULT '' CHECK (length(status_origem) <= 40);
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS financas_cliente_id uuid;
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS origem_financas_id uuid;
ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS importado_em timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS vybe_cliente_contratos_origem ON vybe_cliente_contratos (origem_financas_id);
-- O contrato da Carteira (lançado à mão) segue um por cliente.
CREATE UNIQUE INDEX IF NOT EXISTS vybe_cliente_contratos_manual ON vybe_cliente_contratos (cliente_id) WHERE origem_financas_id IS NULL;
CREATE INDEX IF NOT EXISTS vybe_cliente_contratos_cliente ON vybe_cliente_contratos (cliente_id);
-- Contrato sem cliente do Vybe OS só existe se veio do Finanças (cliente de lá ainda sem par).
ALTER TABLE vybe_cliente_contratos DROP CONSTRAINT IF EXISTS vybe_cliente_contratos_cliente_check;
ALTER TABLE vybe_cliente_contratos ADD CONSTRAINT vybe_cliente_contratos_cliente_check CHECK (cliente_id IS NOT NULL OR origem_financas_id IS NOT NULL);
ALTER TABLE vybe_cliente_contratos DROP CONSTRAINT IF EXISTS vybe_cliente_contratos_observacao_check;
ALTER TABLE vybe_cliente_contratos ADD CONSTRAINT vybe_cliente_contratos_observacao_check CHECK (length(observacao) <= 1000 OR (origem_financas_id IS NOT NULL AND length(observacao) <= 8000));

-- 9. Registro de cada rodada do importador (quando, quem rodou, quanto entrou e o que ficou de fora). ---------------
CREATE TABLE IF NOT EXISTS vybe_financas_importacoes (
 id bigserial PRIMARY KEY,
 rodada_em timestamptz NOT NULL DEFAULT now(),
 resumo jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(resumo) = 'object')
);
COMMIT;
