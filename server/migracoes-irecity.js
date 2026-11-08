// Migrações do Irecity (07/11/2026), aplicadas pelo próprio servidor no primeiro uso
// (autorizado pelo Paulo em 08/11/2026; mesmo padrão de garantirTabelasVybes em server/vybes.js).
// Todas as instruções são idempotentes (IF NOT EXISTS / ON CONFLICT DO NOTHING) e rodam uma por vez
// via sql.query() para compatibilidade com o driver HTTP do Neon e com o PGlite dos testes.

const COMANDOS = [
  // 1. 2026-11-07-crm-prospeccao.sql
  `CREATE TABLE IF NOT EXISTS vybe_crm_oportunidades (
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
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_crm_etapa ON vybe_crm_oportunidades (etapa, atualizado_em DESC, id DESC)`,
  `CREATE INDEX IF NOT EXISTS vybe_crm_responsavel ON vybe_crm_oportunidades (responsavel)`,
  `CREATE TABLE IF NOT EXISTS vybe_crm_historico (
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
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_crm_historico_oportunidade ON vybe_crm_historico (oportunidade_id, id DESC)`,

  // 2. 2026-11-07-carteira.sql
  `CREATE TABLE IF NOT EXISTS vybe_carteira_config (
    chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'),
    valor jsonb NOT NULL,
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_por bigint REFERENCES vybe_pessoas(id)
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_cliente_onboarding (
    cliente_id bigint PRIMARY KEY REFERENCES vybe_clientes(id) ON DELETE CASCADE,
    etapas jsonb NOT NULL DEFAULT '{}'::jsonb,
    iniciado_em timestamptz NOT NULL DEFAULT now(),
    iniciado_por bigint REFERENCES vybe_pessoas(id),
    encerrado_em timestamptz,
    atualizado_em timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_cliente_contratos (
    cliente_id bigint PRIMARY KEY REFERENCES vybe_clientes(id) ON DELETE CASCADE,
    valor_mensal numeric(12,2) CHECK (valor_mensal IS NULL OR valor_mensal >= 0),
    inicio date,
    renovacao date,
    status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','negociando','aviso_previo','encerrado')),
    observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 1000),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_por bigint REFERENCES vybe_pessoas(id)
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_cliente_contratos_renovacao ON vybe_cliente_contratos (renovacao)`,
  `CREATE TABLE IF NOT EXISTS vybe_cliente_churn (
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
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_cliente_churn_saiu ON vybe_cliente_churn (saiu_em DESC)`,
  `CREATE TABLE IF NOT EXISTS vybe_carteira_saude_mensal (
    mes date NOT NULL CHECK (extract(day FROM mes) = 1),
    cliente_id bigint NOT NULL REFERENCES vybe_clientes(id) ON DELETE CASCADE,
    score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
    risco text NOT NULL CHECK (risco IN ('alto','medio','baixo')),
    motivos jsonb NOT NULL DEFAULT '[]'::jsonb,
    heads text NOT NULL DEFAULT '',
    registrado_em timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (mes, cliente_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_carteira_clima (
    cliente_id bigint PRIMARY KEY REFERENCES vybe_clientes(id) ON DELETE CASCADE,
    pontos smallint NOT NULL CHECK (pontos BETWEEN -20 AND 10),
    motivo text NOT NULL DEFAULT '' CHECK (length(motivo) <= 200),
    origem text NOT NULL DEFAULT 'bot' CHECK (length(origem) <= 40),
    atualizado_em timestamptz NOT NULL DEFAULT now()
  )`,

  // 3. 2026-11-07-comercial.sql
  `CREATE TABLE IF NOT EXISTS vybe_comercial_pacotes (
    id bigserial PRIMARY KEY,
    nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 120),
    tipo text NOT NULL CHECK (tipo IN ('recorrente','avulso')),
    preco numeric(12,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
    entregas jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(entregas) = 'array'),
    horas numeric(8,2) NOT NULL DEFAULT 0 CHECK (horas >= 0),
    custo_hora numeric(10,2) NOT NULL DEFAULT 0 CHECK (custo_hora >= 0),
    captacoes integer NOT NULL DEFAULT 0 CHECK (captacoes >= 0),
    custo_captacao numeric(10,2) NOT NULL DEFAULT 0 CHECK (custo_captacao >= 0),
    carga jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(carga) = 'object'),
    ativo boolean NOT NULL DEFAULT true,
    criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    versao bigint NOT NULL DEFAULT 1
  )`,
  `ALTER TABLE vybe_crm_oportunidades DROP CONSTRAINT IF EXISTS vybe_crm_oportunidades_etapa_check`,
  `ALTER TABLE vybe_crm_oportunidades ADD CONSTRAINT vybe_crm_oportunidades_etapa_check CHECK (etapa ~ '^[a-z]' AND etapa !~ '[^a-z0-9_]' AND length(etapa) BETWEEN 2 AND 40)`,
  `CREATE TABLE IF NOT EXISTS vybe_crm_etapas_config (
    etapa text PRIMARY KEY CHECK (etapa ~ '^[a-z]' AND etapa !~ '[^a-z0-9_]' AND length(etapa) BETWEEN 2 AND 40 AND etapa NOT IN ('empresa','qualificacao','abordagem_proposta','aprovada','ganho','perdido')),
    nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 60),
    ordem integer NOT NULL,
    extra boolean NOT NULL DEFAULT false,
    atualizado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
    atualizado_em timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE vybe_crm_oportunidades ADD COLUMN IF NOT EXISTS valor_mensal numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_mensal >= 0)`,
  `ALTER TABLE vybe_crm_oportunidades ADD COLUMN IF NOT EXISTS valor_avulso numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_avulso >= 0)`,
  `ALTER TABLE vybe_crm_oportunidades ADD COLUMN IF NOT EXISTS pacote_id bigint REFERENCES vybe_comercial_pacotes(id)`,
  `CREATE TABLE IF NOT EXISTS vybe_comercial_orcamentos (
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
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_comercial_orcamentos_recentes ON vybe_comercial_orcamentos (criado_em DESC, id DESC)`,
  `CREATE TABLE IF NOT EXISTS vybe_comercial_financas_cliente (
    cliente_id bigint PRIMARY KEY REFERENCES vybe_clientes(id),
    valor_mensal numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_mensal >= 0),
    pacote_id bigint REFERENCES vybe_comercial_pacotes(id),
    status_pagamento text NOT NULL DEFAULT 'em_dia' CHECK (status_pagamento IN ('em_dia','atrasado','inadimplente')),
    observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 1000),
    atualizado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    versao bigint NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_comercial_creators (
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
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_comercial_fornecedores (
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
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_comercial_recebiveis (
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
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_comercial_recebiveis_vencimento ON vybe_comercial_recebiveis (vencimento)`,
  `CREATE TABLE IF NOT EXISTS vybe_comercial_contas (
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
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_comercial_contas_vencimento ON vybe_comercial_contas (vencimento)`,
  `CREATE TABLE IF NOT EXISTS vybe_comercial_capacidade (
    cargo text PRIMARY KEY CHECK (cargo IN ('criacao','atendimento','agendamento','producao','gestao')),
    capacidade_mensal integer NOT NULL DEFAULT 0 CHECK (capacidade_mensal BETWEEN 0 AND 100000),
    atualizado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
    atualizado_em timestamptz NOT NULL DEFAULT now()
  )`,

  // 4. 2026-11-07-conteudo-objetivo-aprovacao.sql
  `ALTER TABLE vybe_conteudos ADD COLUMN IF NOT EXISTS objetivo text
    CHECK (objetivo IS NULL OR objetivo IN ('atracao','educacao','conversao'))`,
  `CREATE TABLE IF NOT EXISTS vybe_aprovacao_links (
    id bigserial PRIMARY KEY,
    cliente_id bigint NOT NULL REFERENCES vybe_clientes(id),
    token_hash char(64) NOT NULL UNIQUE,
    criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
    criado_em timestamptz NOT NULL DEFAULT now(),
    expira_em timestamptz NOT NULL,
    revogado_em timestamptz,
    revogado_por bigint REFERENCES vybe_pessoas(id),
    ultimo_acesso_em timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_aprovacao_links_cliente ON vybe_aprovacao_links (cliente_id, criado_em DESC)`,
  `CREATE TABLE IF NOT EXISTS vybe_aprovacao_respostas (
    id bigserial PRIMARY KEY,
    link_id bigint NOT NULL REFERENCES vybe_aprovacao_links(id),
    conteudo_id bigint NOT NULL REFERENCES vybe_conteudos(id),
    acao text NOT NULL CHECK (acao IN ('aprovar','ajuste')),
    nome text NOT NULL CHECK (length(nome) BETWEEN 1 AND 80),
    comentario text NOT NULL DEFAULT '' CHECK (length(comentario) <= 1000),
    status_de text,
    status_para text,
    em timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_aprovacao_respostas_conteudo ON vybe_aprovacao_respostas (conteudo_id, em DESC)`,
  `CREATE INDEX IF NOT EXISTS vybe_aprovacao_respostas_link ON vybe_aprovacao_respostas (link_id, em DESC)`,

  // 5. 2026-11-07-pessoas.sql
  `CREATE TABLE IF NOT EXISTS vybe_pessoas_config (
    chave text PRIMARY KEY CHECK (chave IN ('pesos','metas','capacidade','etapas_recrutamento')),
    valor jsonb NOT NULL,
    atualizado_por bigint REFERENCES vybe_pessoas(id),
    atualizado_em timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_rh_perfil (
    pessoa_id bigint PRIMARY KEY REFERENCES vybe_pessoas(id),
    nascimento date,
    entrada date,
    saida date,
    atualizado_em timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_rh_pedidos (
    id bigserial PRIMARY KEY,
    pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
    tipo text NOT NULL CHECK (tipo IN ('documento','ferias','folha','beneficio','equipamento','outro')),
    titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 200),
    descricao text NOT NULL DEFAULT '' CHECK (length(descricao) <= 2000),
    inicio date,
    fim date,
    status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','andamento','resolvido','recusado','cancelado')),
    prazo date NOT NULL,
    resposta text NOT NULL DEFAULT '' CHECK (length(resposta) <= 2000),
    respondido_por bigint REFERENCES vybe_pessoas(id),
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CHECK (tipo <> 'ferias' OR (inicio IS NOT NULL AND fim IS NOT NULL AND fim >= inicio))
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_rh_pedidos_pessoa ON vybe_rh_pedidos (pessoa_id, criado_em DESC)`,
  `CREATE INDEX IF NOT EXISTS vybe_rh_pedidos_status ON vybe_rh_pedidos (status, prazo)`,
  `CREATE TABLE IF NOT EXISTS vybe_clima_respostas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trimestre text NOT NULL CHECK (trimestre ~ '^\\d{4}-T[1-4]$'),
    enps smallint NOT NULL CHECK (enps BETWEEN 0 AND 10),
    lideranca smallint NOT NULL CHECK (lideranca BETWEEN 1 AND 5),
    ambiente smallint NOT NULL CHECK (ambiente BETWEEN 1 AND 5),
    crescimento smallint NOT NULL CHECK (crescimento BETWEEN 1 AND 5),
    processos smallint NOT NULL CHECK (processos BETWEEN 1 AND 5),
    beneficios smallint NOT NULL CHECK (beneficios BETWEEN 1 AND 5),
    comentario text NOT NULL DEFAULT '' CHECK (length(comentario) <= 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_clima_respostas_trimestre ON vybe_clima_respostas (trimestre)`,
  `CREATE TABLE IF NOT EXISTS vybe_clima_participacao (
    trimestre text NOT NULL,
    pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
    PRIMARY KEY (trimestre, pessoa_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_projetos (
    id bigserial PRIMARY KEY,
    nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 200),
    tipo text NOT NULL DEFAULT 'outro' CHECK (tipo IN ('evento','lancamento','site','campanha','outro')),
    cliente text NOT NULL DEFAULT '' CHECK (length(cliente) <= 200),
    descricao text NOT NULL DEFAULT '' CHECK (length(descricao) <= 2000),
    inicio date NOT NULL,
    fim date NOT NULL CHECK (fim >= inicio),
    status text NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado','andamento','concluido','cancelado')),
    criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_projeto_etapas (
    id bigserial PRIMARY KEY,
    projeto_id bigint NOT NULL REFERENCES vybe_projetos(id) ON DELETE CASCADE,
    nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 200),
    responsavel bigint REFERENCES vybe_pessoas(id),
    inicio date NOT NULL,
    fim date NOT NULL CHECK (fim >= inicio),
    esforco smallint NOT NULL DEFAULT 1 CHECK (esforco BETWEEN 1 AND 3),
    feita boolean NOT NULL DEFAULT false,
    ordem int NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_projeto_etapas_projeto ON vybe_projeto_etapas (projeto_id, ordem, id)`,
  `CREATE INDEX IF NOT EXISTS vybe_projeto_etapas_responsavel ON vybe_projeto_etapas (responsavel, inicio, fim)`,
  `CREATE TABLE IF NOT EXISTS vybe_academy_trilhas (
    id bigserial PRIMARY KEY,
    nome text NOT NULL UNIQUE CHECK (length(trim(nome)) BETWEEN 1 AND 200),
    descricao text NOT NULL DEFAULT '' CHECK (length(descricao) <= 2000),
    ordem int NOT NULL DEFAULT 0,
    criado_em timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_academy_aulas (
    id bigserial PRIMARY KEY,
    trilha_id bigint NOT NULL REFERENCES vybe_academy_trilhas(id) ON DELETE CASCADE,
    titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 200),
    tipo text NOT NULL DEFAULT 'video' CHECK (tipo IN ('video','doc')),
    link text NOT NULL DEFAULT '' CHECK (link = '' OR link ~ '^https://'),
    minutos int NOT NULL DEFAULT 10 CHECK (minutos BETWEEN 1 AND 600),
    ordem int NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_academy_aulas_trilha ON vybe_academy_aulas (trilha_id, ordem, id)`,
  `CREATE TABLE IF NOT EXISTS vybe_academy_atribuicoes (
    trilha_id bigint NOT NULL REFERENCES vybe_academy_trilhas(id) ON DELETE CASCADE,
    pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
    atribuido_por bigint REFERENCES vybe_pessoas(id),
    atribuido_em timestamptz NOT NULL DEFAULT now(),
    prazo date,
    PRIMARY KEY (trilha_id, pessoa_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_academy_progresso (
    aula_id bigint NOT NULL REFERENCES vybe_academy_aulas(id) ON DELETE CASCADE,
    pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
    concluida_em timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (aula_id, pessoa_id)
  )`,
  `INSERT INTO vybe_academy_trilhas (nome, descricao, ordem)
    VALUES ('Primeira semana na Vybe', 'O básico para começar bem: quem somos, como a produção anda e onde fica cada coisa.', 0)
    ON CONFLICT (nome) DO NOTHING`,
  `INSERT INTO vybe_academy_aulas (trilha_id, titulo, tipo, minutos, ordem)
    SELECT t.id, a.titulo, a.tipo, a.minutos, a.ordem FROM vybe_academy_trilhas t
    CROSS JOIN (VALUES ('Boas-vindas: quem é a Vybe','video',10,1), ('Como funciona o Vybe OS','video',15,2),
      ('Fluxo de uma peça: do briefing à veiculação','doc',15,3), ('Clientes ativos e as carteiras','doc',10,4),
      ('Padrão visual e tom de voz','doc',15,5), ('Combinados da equipe e o RH','doc',10,6)) AS a(titulo,tipo,minutos,ordem)
    WHERE t.nome = 'Primeira semana na Vybe' AND NOT EXISTS (SELECT 1 FROM vybe_academy_aulas x WHERE x.trilha_id = t.id)`,
  `CREATE TABLE IF NOT EXISTS vybe_rh_vagas (
    id bigserial PRIMARY KEY,
    titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 200),
    cargo text NOT NULL DEFAULT '' CHECK (length(cargo) <= 100),
    descricao text NOT NULL DEFAULT '' CHECK (length(descricao) <= 2000),
    status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','pausada','fechada')),
    aberta_em date NOT NULL DEFAULT CURRENT_DATE,
    fechada_em date,
    criado_por bigint NOT NULL REFERENCES vybe_pessoas(id)
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_rh_candidatos (
    id bigserial PRIMARY KEY,
    vaga_id bigint NOT NULL REFERENCES vybe_rh_vagas(id) ON DELETE CASCADE,
    nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 200),
    contato text NOT NULL DEFAULT '' CHECK (length(contato) <= 200),
    etapa text NOT NULL CHECK (length(etapa) BETWEEN 1 AND 40),
    observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 2000),
    criado_em date NOT NULL DEFAULT CURRENT_DATE,
    contratado_em date,
    atualizado_em timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_rh_candidatos_vaga ON vybe_rh_candidatos (vaga_id, etapa)`,
  `CREATE TABLE IF NOT EXISTS vybe_rh_documentos (
    id bigserial PRIMARY KEY,
    pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
    tipo text NOT NULL CHECK (tipo IN ('contrato','aditivo','nda','exame','certificado','outro')),
    titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 200),
    inicio date,
    renovacao date,
    status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado')),
    link text NOT NULL DEFAULT '' CHECK (link = '' OR link ~ '^https://'),
    observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 2000),
    atualizado_em timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_rh_documentos_renovacao ON vybe_rh_documentos (status, renovacao)`,
];

// 6. 2026-11-08-rh-pedidos-clima.sql (pedidos ao RH com prazo configurável e pesquisa de clima com período).
// Roda à parte: se falhar, só o RH novo fica "aguardando a migração" — CRM, Carteira e o resto seguem.
// A ordem importa: a última instrução cria vybe_rh_prazos, e é ela que diz que tudo já rodou.
const COMANDOS_RH = [
  `ALTER TABLE vybe_rh_pedidos ADD COLUMN IF NOT EXISTS data_desejada date`,
  `ALTER TABLE vybe_rh_pedidos ADD COLUMN IF NOT EXISTS respondido_em timestamptz`,
  `ALTER TABLE vybe_rh_pedidos DROP CONSTRAINT IF EXISTS vybe_rh_pedidos_tipo_check`,
  `ALTER TABLE vybe_rh_pedidos ADD CONSTRAINT vybe_rh_pedidos_tipo_check
    CHECK (tipo IN ('documento','ferias','folha','beneficio','equipamento','reembolso','outro'))`,
  `CREATE TABLE IF NOT EXISTS vybe_clima_pesquisas (
    id bigserial PRIMARY KEY,
    titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 120),
    abre date NOT NULL,
    fecha date NOT NULL CHECK (fecha >= abre),
    criada_por bigint REFERENCES vybe_pessoas(id),
    criada_em timestamptz NOT NULL DEFAULT now(),
    encerrada_em timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_clima_pesquisas_abre ON vybe_clima_pesquisas (abre DESC, id DESC)`,
  `CREATE TABLE IF NOT EXISTS vybe_clima_pesquisa_respostas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pesquisa_id bigint NOT NULL REFERENCES vybe_clima_pesquisas(id) ON DELETE CASCADE,
    enps smallint NOT NULL CHECK (enps BETWEEN 0 AND 10),
    lideranca smallint NOT NULL CHECK (lideranca BETWEEN 1 AND 5),
    comunicacao smallint NOT NULL CHECK (comunicacao BETWEEN 1 AND 5),
    reconhecimento smallint NOT NULL CHECK (reconhecimento BETWEEN 1 AND 5),
    carga smallint NOT NULL CHECK (carga BETWEEN 1 AND 5),
    ambiente smallint NOT NULL CHECK (ambiente BETWEEN 1 AND 5),
    comentario text NOT NULL DEFAULT '' CHECK (length(comentario) <= 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_clima_pesquisa_respostas_pesquisa ON vybe_clima_pesquisa_respostas (pesquisa_id)`,
  `CREATE TABLE IF NOT EXISTS vybe_clima_pesquisa_participacao (
    pesquisa_id bigint NOT NULL REFERENCES vybe_clima_pesquisas(id) ON DELETE CASCADE,
    pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
    PRIMARY KEY (pesquisa_id, pessoa_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vybe_rh_prazos (
    tipo text PRIMARY KEY CHECK (tipo IN ('documento','ferias','folha','beneficio','equipamento','reembolso','outro')),
    dias_uteis smallint NOT NULL CHECK (dias_uteis BETWEEN 1 AND 30),
    atualizado_por bigint REFERENCES vybe_pessoas(id),
    atualizado_em timestamptz NOT NULL DEFAULT now()
  )`,
];

let promessa = null, promessaRh = null, falhaRh = 0;
async function garantirRh(sql) {
  // Falhou (sem permissão, banco fora): tenta de novo só depois de 10 minutos, sem travar a tela.
  if (promessaRh && falhaRh && Date.now() - falhaRh > 10 * 60e3) { promessaRh = null; falhaRh = 0; }
  if (!promessaRh) promessaRh = (async () => {
    const [r] = await sql`SELECT (to_regclass('public.vybe_rh_prazos') IS NOT NULL) AS ok`;
    if (r?.ok) return;
    for (const cmd of COMANDOS_RH) await sql.query(cmd);
  })().catch((e) => { falhaRh = Date.now(); console.error('[migracoes-irecity] RH 08/11 aguardando:', e?.message || e); });
  return promessaRh;
}
export function garantirMigracoesIrecity(sql) {
  if (!promessa) promessa = (async () => {
    const [r] = await sql`SELECT (
      to_regclass('public.vybe_carteira_clima') IS NOT NULL AND
      to_regclass('public.vybe_comercial_capacidade') IS NOT NULL AND
      to_regclass('public.vybe_aprovacao_respostas') IS NOT NULL AND
      to_regclass('public.vybe_rh_documentos') IS NOT NULL
    ) AS ok`;
    if (!r?.ok) for (const cmd of COMANDOS) await sql.query(cmd);
  })().catch((e) => { promessa = null; throw e; });
  return promessa.then(() => garantirRh(sql));
}

export function esquecerMigracoesIrecity() { promessa = null; promessaRh = null; falhaRh = 0; }
