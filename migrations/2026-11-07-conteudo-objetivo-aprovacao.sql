-- Módulo Conteúdo (07/11/2026): objetivo de cada peça e link público de aprovação para o cliente.
-- Aplicação MANUAL pelo Paulo no SQL Editor do Neon. Não é executada pela API nem pelo build.
-- Sem ela o painel funciona: o objetivo e os links ficam indisponíveis, com aviso na tela.
-- Não envia mensagens.
BEGIN;
-- Objetivo da peça (a bolinha): atração, educação ou conversão. Vazio = ainda não escolhido.
ALTER TABLE vybe_conteudos ADD COLUMN IF NOT EXISTS objetivo text
  CHECK (objetivo IS NULL OR objetivo IN ('atracao','educacao','conversao'));

-- Links de aprovação: só o hash do token fica no banco (o token sai uma vez, para o head copiar).
CREATE TABLE IF NOT EXISTS vybe_aprovacao_links (
 id bigserial PRIMARY KEY,
 cliente_id bigint NOT NULL REFERENCES vybe_clientes(id),
 token_hash char(64) NOT NULL UNIQUE,
 criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 expira_em timestamptz NOT NULL,
 revogado_em timestamptz,
 revogado_por bigint REFERENCES vybe_pessoas(id),
 ultimo_acesso_em timestamptz
);
CREATE INDEX IF NOT EXISTS vybe_aprovacao_links_cliente ON vybe_aprovacao_links (cliente_id, criado_em DESC);

-- Cada resposta do cliente: quem (nome digitado), quando, o que e de qual status para qual.
CREATE TABLE IF NOT EXISTS vybe_aprovacao_respostas (
 id bigserial PRIMARY KEY,
 link_id bigint NOT NULL REFERENCES vybe_aprovacao_links(id),
 conteudo_id bigint NOT NULL REFERENCES vybe_conteudos(id),
 acao text NOT NULL CHECK (acao IN ('aprovar','ajuste')),
 nome text NOT NULL CHECK (length(nome) BETWEEN 1 AND 80),
 comentario text NOT NULL DEFAULT '' CHECK (length(comentario) <= 1000),
 status_de text,
 status_para text,
 em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vybe_aprovacao_respostas_conteudo ON vybe_aprovacao_respostas (conteudo_id, em DESC);
CREATE INDEX IF NOT EXISTS vybe_aprovacao_respostas_link ON vybe_aprovacao_respostas (link_id, em DESC);
COMMIT;
