-- Setor de Pessoas (Paulo, 07/11/2026): produtividade (pesos e metas), RH leve,
-- clima/eNPS anônimo, projetos pontuais, Academy, recrutamento e documentos.
-- Aplicação MANUAL pelo Paulo no SQL Editor do Neon. Não é executada pela API
-- nem pelo build. Não envia mensagens. Pode rodar mais de uma vez.
-- Sem ela, o módulo abre com o estado vazio e a produtividade usa os pesos padrão.
BEGIN;

-- Pesos do score, metas por cargo, capacidade semanal, etapas do recrutamento.
CREATE TABLE IF NOT EXISTS vybe_pessoas_config (
 chave text PRIMARY KEY CHECK (chave IN ('pesos','metas','capacidade','etapas_recrutamento')),
 valor jsonb NOT NULL,
 atualizado_por bigint REFERENCES vybe_pessoas(id),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Datas de RH de cada pessoa. Do nascimento a tela mostra só dia e mês.
CREATE TABLE IF NOT EXISTS vybe_rh_perfil (
 pessoa_id bigint PRIMARY KEY REFERENCES vybe_pessoas(id),
 nascimento date,
 entrada date,
 saida date,
 atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Pedidos ao RH com prazo (SLA em dias úteis por tipo). Férias levam início e fim.
CREATE TABLE IF NOT EXISTS vybe_rh_pedidos (
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
);
CREATE INDEX IF NOT EXISTS vybe_rh_pedidos_pessoa ON vybe_rh_pedidos (pessoa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS vybe_rh_pedidos_status ON vybe_rh_pedidos (status, prazo);

-- Clima trimestral ANÔNIMO: a resposta não tem pessoa, hora nem número sequencial;
-- a participação (para não votar duas vezes) não tem a resposta nem hora.
CREATE TABLE IF NOT EXISTS vybe_clima_respostas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 trimestre text NOT NULL CHECK (trimestre ~ '^\d{4}-T[1-4]$'),
 enps smallint NOT NULL CHECK (enps BETWEEN 0 AND 10),
 lideranca smallint NOT NULL CHECK (lideranca BETWEEN 1 AND 5),
 ambiente smallint NOT NULL CHECK (ambiente BETWEEN 1 AND 5),
 crescimento smallint NOT NULL CHECK (crescimento BETWEEN 1 AND 5),
 processos smallint NOT NULL CHECK (processos BETWEEN 1 AND 5),
 beneficios smallint NOT NULL CHECK (beneficios BETWEEN 1 AND 5),
 comentario text NOT NULL DEFAULT '' CHECK (length(comentario) <= 1000)
);
CREATE INDEX IF NOT EXISTS vybe_clima_respostas_trimestre ON vybe_clima_respostas (trimestre);
CREATE TABLE IF NOT EXISTS vybe_clima_participacao (
 trimestre text NOT NULL,
 pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
 PRIMARY KEY (trimestre, pessoa_id)
);

-- Projetos pontuais (fora do mensal) com etapas.
CREATE TABLE IF NOT EXISTS vybe_projetos (
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
);
CREATE TABLE IF NOT EXISTS vybe_projeto_etapas (
 id bigserial PRIMARY KEY,
 projeto_id bigint NOT NULL REFERENCES vybe_projetos(id) ON DELETE CASCADE,
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 200),
 responsavel bigint REFERENCES vybe_pessoas(id),
 inicio date NOT NULL,
 fim date NOT NULL CHECK (fim >= inicio),
 esforco smallint NOT NULL DEFAULT 1 CHECK (esforco BETWEEN 1 AND 3),
 feita boolean NOT NULL DEFAULT false,
 ordem int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS vybe_projeto_etapas_projeto ON vybe_projeto_etapas (projeto_id, ordem, id);
CREATE INDEX IF NOT EXISTS vybe_projeto_etapas_responsavel ON vybe_projeto_etapas (responsavel, inicio, fim);

-- Academy: trilhas, aulas (link de vídeo ou documento), atribuição e progresso.
CREATE TABLE IF NOT EXISTS vybe_academy_trilhas (
 id bigserial PRIMARY KEY,
 nome text NOT NULL UNIQUE CHECK (length(trim(nome)) BETWEEN 1 AND 200),
 descricao text NOT NULL DEFAULT '' CHECK (length(descricao) <= 2000),
 ordem int NOT NULL DEFAULT 0,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vybe_academy_aulas (
 id bigserial PRIMARY KEY,
 trilha_id bigint NOT NULL REFERENCES vybe_academy_trilhas(id) ON DELETE CASCADE,
 titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 200),
 tipo text NOT NULL DEFAULT 'video' CHECK (tipo IN ('video','doc')),
 link text NOT NULL DEFAULT '' CHECK (link = '' OR link ~ '^https://'),
 minutos int NOT NULL DEFAULT 10 CHECK (minutos BETWEEN 1 AND 600),
 ordem int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS vybe_academy_aulas_trilha ON vybe_academy_aulas (trilha_id, ordem, id);
CREATE TABLE IF NOT EXISTS vybe_academy_atribuicoes (
 trilha_id bigint NOT NULL REFERENCES vybe_academy_trilhas(id) ON DELETE CASCADE,
 pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
 atribuido_por bigint REFERENCES vybe_pessoas(id),
 atribuido_em timestamptz NOT NULL DEFAULT now(),
 prazo date,
 PRIMARY KEY (trilha_id, pessoa_id)
);
CREATE TABLE IF NOT EXISTS vybe_academy_progresso (
 aula_id bigint NOT NULL REFERENCES vybe_academy_aulas(id) ON DELETE CASCADE,
 pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
 concluida_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (aula_id, pessoa_id)
);

-- Trilha de boas-vindas com placeholders (títulos e links editáveis no painel).
INSERT INTO vybe_academy_trilhas (nome, descricao, ordem)
VALUES ('Primeira semana na Vybe', 'O básico para começar bem: quem somos, como a produção anda e onde fica cada coisa.', 0)
ON CONFLICT (nome) DO NOTHING;
INSERT INTO vybe_academy_aulas (trilha_id, titulo, tipo, minutos, ordem)
SELECT t.id, a.titulo, a.tipo, a.minutos, a.ordem FROM vybe_academy_trilhas t
CROSS JOIN (VALUES ('Boas-vindas: quem é a Vybe','video',10,1), ('Como funciona o Vybe OS','video',15,2),
 ('Fluxo de uma peça: do briefing à veiculação','doc',15,3), ('Clientes ativos e as carteiras','doc',10,4),
 ('Padrão visual e tom de voz','doc',15,5), ('Combinados da equipe e o RH','doc',10,6)) AS a(titulo,tipo,minutos,ordem)
WHERE t.nome = 'Primeira semana na Vybe' AND NOT EXISTS (SELECT 1 FROM vybe_academy_aulas x WHERE x.trilha_id = t.id);

-- Recrutamento: vagas e candidatos (etapa = nome de uma etapa configurada).
CREATE TABLE IF NOT EXISTS vybe_rh_vagas (
 id bigserial PRIMARY KEY,
 titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 200),
 cargo text NOT NULL DEFAULT '' CHECK (length(cargo) <= 100),
 descricao text NOT NULL DEFAULT '' CHECK (length(descricao) <= 2000),
 status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','pausada','fechada')),
 aberta_em date NOT NULL DEFAULT CURRENT_DATE,
 fechada_em date,
 criado_por bigint NOT NULL REFERENCES vybe_pessoas(id)
);
CREATE TABLE IF NOT EXISTS vybe_rh_candidatos (
 id bigserial PRIMARY KEY,
 vaga_id bigint NOT NULL REFERENCES vybe_rh_vagas(id) ON DELETE CASCADE,
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 200),
 contato text NOT NULL DEFAULT '' CHECK (length(contato) <= 200),
 etapa text NOT NULL CHECK (length(etapa) BETWEEN 1 AND 40),
 observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 2000),
 criado_em date NOT NULL DEFAULT CURRENT_DATE,
 contratado_em date,
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vybe_rh_candidatos_vaga ON vybe_rh_candidatos (vaga_id, etapa);

-- Documentos e contratos de cada colaborador (sem assinatura eletrônica).
CREATE TABLE IF NOT EXISTS vybe_rh_documentos (
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
);
CREATE INDEX IF NOT EXISTS vybe_rh_documentos_renovacao ON vybe_rh_documentos (status, renovacao);
COMMIT;
