-- Fornecedores por cidade, Emballar, cotações e histórico de impressos (Paulo, 09/11/2026). Também roda sozinha (server/migracoes-irecity.js, bloco 9).
ALTER TABLE vybe_comercial_fornecedores ADD COLUMN IF NOT EXISTS cidade text NOT NULL DEFAULT '' CHECK (length(cidade) <= 80);
ALTER TABLE vybe_comercial_fornecedores ADD COLUMN IF NOT EXISTS uf text NOT NULL DEFAULT '' CHECK (length(uf) <= 2);
ALTER TABLE vybe_comercial_fornecedores ADD COLUMN IF NOT EXISTS telefone text NOT NULL DEFAULT '' CHECK (length(telefone) <= 40);
INSERT INTO vybe_comercial_fornecedores (nome, categoria, contato, telefone, cidade, uf, observacoes, criado_por)
  SELECT 'Emballar', 'grafica', '(74) 99970-9126', '(74) 99970-9126', 'Irecê', 'BA', 'Embalagens e impressos. Cadastrada a pedido do Paulo em 09/11/2026.',
    COALESCE((SELECT id FROM vybe_pessoas WHERE monday_user_id = '68035537' ORDER BY id LIMIT 1), (SELECT MIN(id) FROM vybe_pessoas WHERE admin))
  WHERE NOT EXISTS (SELECT 1 FROM vybe_comercial_fornecedores WHERE lower(nome) = 'emballar');
INSERT INTO vybe_impressoes (cliente_id, conteudo_id, titulo, etapa, previsao, entregue_em, criado_em, atualizado_em)
  SELECT (SELECT v.cliente_id FROM vybe_conteudo_clientes v WHERE v.conteudo_id = c.id ORDER BY v.cliente_id LIMIT 1), c.id,
    left(CASE WHEN c.titulo ILIKE 'Impresso - %' THEN substr(c.titulo, 12) ELSE c.titulo END, 200), 'entregue', c.prazo,
    COALESCE((c.status_em AT TIME ZONE 'America/Bahia')::date, c.prazo), COALESCE(c.criado_em, c.status_em, now()), COALESCE(c.status_em, c.criado_em, now())
  FROM vybe_conteudos c JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
  WHERE c.board_id = 8385559107 AND c.removido_em IS NULL AND c.formato ILIKE '%impresso%' AND s.final
    AND NOT EXISTS (SELECT 1 FROM vybe_impressoes i WHERE i.conteudo_id = c.id);
INSERT INTO vybe_impressao_eventos (impressao_id, de, para, nota, em)
  SELECT i.id, NULL, 'entregue', 'Finalizada nas Solicitações (histórico)', i.atualizado_em FROM vybe_impressoes i
  WHERE NOT EXISTS (SELECT 1 FROM vybe_impressao_eventos e WHERE e.impressao_id = i.id);
CREATE TABLE IF NOT EXISTS vybe_impressao_cotacoes (
    id bigserial PRIMARY KEY,
    impressao_id bigint NOT NULL REFERENCES vybe_impressoes(id) ON DELETE CASCADE,
    fornecedor_id bigint NOT NULL REFERENCES vybe_comercial_fornecedores(id),
    valor numeric(12,2) NOT NULL CHECK (valor >= 0),
    prazo_dias integer CHECK (prazo_dias IS NULL OR prazo_dias BETWEEN 0 AND 365),
    observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 1000),
    escolhida boolean NOT NULL DEFAULT false,
    criado_por bigint REFERENCES vybe_pessoas(id) ON DELETE SET NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    UNIQUE (impressao_id, fornecedor_id)
  );
