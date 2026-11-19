-- 2026-11-19 · meta por pessoa no Comercial (Paulo, 19/11/2026: prancha V2-R-Comercial-Metas, "meta por pessoa, além
-- da meta da agência").
-- Aplicar à mão no SQL Editor do Neon (produção), uma vez. Idempotente: rodar de novo não duplica nem muda nada.
-- Só aditivo: uma tabela nova e um índice. Nada existente muda; a meta da agência continua em vybe_carteira_config
-- (chave comercial_metas). Antes desta migração a tela e o servidor mostram só a meta da agência
-- (server/comercial-leads.js metasPorPessoa devolve disponivel:false quando a tabela não existe).
--
-- Uma linha por pessoa por mês (AAAA-MM). Meta zero em tudo = sem meta (o servidor apaga a linha). A visão anual soma
-- os meses. Quem edita: só os donos (ação metas_pessoa_salvar, em ACOES_SO_DONOS de server/comercial.js).

CREATE TABLE IF NOT EXISTS vybe_comercial_metas_pessoa (
  mes text NOT NULL CHECK (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id) ON DELETE CASCADE,
  mrr numeric(12,2) NOT NULL DEFAULT 0 CHECK (mrr >= 0),
  avulso numeric(12,2) NOT NULL DEFAULT 0 CHECK (avulso >= 0),
  negocios integer NOT NULL DEFAULT 0 CHECK (negocios >= 0),
  leads integer NOT NULL DEFAULT 0 CHECK (leads >= 0),
  atualizado_por bigint REFERENCES vybe_pessoas(id),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mes, pessoa_id)
);

CREATE INDEX IF NOT EXISTS vybe_comercial_metas_pessoa_pessoa ON vybe_comercial_metas_pessoa (pessoa_id, mes);

-- Conferência: a tabela existe e está vazia na primeira vez.
SELECT count(*) AS metas_por_pessoa FROM vybe_comercial_metas_pessoa;
