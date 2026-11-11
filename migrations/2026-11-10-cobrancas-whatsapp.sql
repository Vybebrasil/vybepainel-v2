-- Cobrança pelo WhatsApp (Paulo, 10/11/2026): o botão "Cobrar" da Criação do Hoje (painel do Deivid) pede o envio e o
-- VYBES (bot) manda no privado de quem responde pela peça, pelo agente dono da cobrança. server/cobrancas-whatsapp.js.
-- A mesma tabela é criada por garantirTabelaCobrancas (CREATE TABLE IF NOT EXISTS) no primeiro uso; este arquivo é o
-- registro revisável. Só cria; não mexe em dado existente. Pode rodar mais de uma vez.
CREATE TABLE IF NOT EXISTS vybe_cobrancas_whatsapp (
  id BIGSERIAL PRIMARY KEY,
  conteudo_id BIGINT NOT NULL,          -- vybe_conteudos.id da peça
  ref TEXT NOT NULL,                    -- número do painel (Monday ou vybe:N)
  titulo TEXT NOT NULL,
  cliente TEXT,
  pessoa_id BIGINT NOT NULL,            -- vybe_pessoas.id de quem é cobrado (responsável da peça)
  pessoa_nome TEXT NOT NULL,
  setor TEXT NOT NULL,                  -- agente que manda: design (Danilo) ou edicao (Lucas)
  texto TEXT NOT NULL,                  -- a mensagem, montada no servidor
  pedido_por BIGINT NOT NULL,           -- vybe_pessoas.id do dono que clicou
  pedido_por_nome TEXT,
  dia DATE NOT NULL,                    -- dia (Bahia) do pedido: uma cobrança por pessoa, por peça, por dia
  estado TEXT NOT NULL DEFAULT 'pedido',-- pedido → enviando → enviado | falhou
  motivo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pego_em TIMESTAMPTZ,                  -- quando o bot buscou
  resolvido_em TIMESTAMPTZ,
  UNIQUE (conteudo_id, pessoa_id, dia)
);
CREATE INDEX IF NOT EXISTS vybe_cobrancas_whatsapp_estado ON vybe_cobrancas_whatsapp (estado, criado_em);
