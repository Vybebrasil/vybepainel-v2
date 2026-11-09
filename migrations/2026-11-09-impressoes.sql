-- Impressões com módulo próprio (Paulo, 09/11/2026). Também roda sozinha no primeiro acesso (server/migracoes-irecity.js, bloco 8).
CREATE TABLE IF NOT EXISTS vybe_impressoes (
    id bigserial PRIMARY KEY,
    cliente_id bigint REFERENCES vybe_clientes(id) ON DELETE SET NULL,
    projeto_id bigint REFERENCES vybe_projetos(id) ON DELETE SET NULL,
    conteudo_id bigint REFERENCES vybe_conteudos(id) ON DELETE SET NULL,
    fornecedor_id bigint REFERENCES vybe_comercial_fornecedores(id) ON DELETE SET NULL,
    titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 200),
    material text NOT NULL DEFAULT '' CHECK (length(material) <= 80),
    quantidade integer CHECK (quantidade IS NULL OR quantidade BETWEEN 1 AND 10000000),
    especificacao text NOT NULL DEFAULT '' CHECK (length(especificacao) <= 2000),
    arquivo_url text NOT NULL DEFAULT '' CHECK (length(arquivo_url) <= 1000),
    etapa text NOT NULL DEFAULT 'arte' CHECK (etapa IN ('arte','orcamento','aprovado','arquivo_enviado','em_impressao','pronto','entregue','cancelado')),
    responsavel bigint REFERENCES vybe_pessoas(id) ON DELETE SET NULL,
    pedido_em date,
    previsao date,
    entregue_em date,
    valor numeric(12,2) CHECK (valor IS NULL OR valor >= 0),
    observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 2000),
    criado_por bigint REFERENCES vybe_pessoas(id) ON DELETE SET NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
  );
CREATE INDEX IF NOT EXISTS vybe_impressoes_etapa ON vybe_impressoes (etapa, previsao);
CREATE INDEX IF NOT EXISTS vybe_impressoes_fornecedor ON vybe_impressoes (fornecedor_id, etapa);
CREATE UNIQUE INDEX IF NOT EXISTS vybe_impressoes_conteudo ON vybe_impressoes (conteudo_id) WHERE conteudo_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS vybe_impressao_eventos (
    id bigserial PRIMARY KEY,
    impressao_id bigint NOT NULL REFERENCES vybe_impressoes(id) ON DELETE CASCADE,
    de text,
    para text NOT NULL,
    nota text NOT NULL DEFAULT '' CHECK (length(nota) <= 500),
    autor_id bigint REFERENCES vybe_pessoas(id) ON DELETE SET NULL,
    em timestamptz NOT NULL DEFAULT now()
  );
CREATE INDEX IF NOT EXISTS vybe_impressao_eventos_impressao ON vybe_impressao_eventos (impressao_id, em);
INSERT INTO vybe_impressoes (cliente_id, conteudo_id, titulo, etapa, previsao, criado_em)
  SELECT (SELECT v.cliente_id FROM vybe_conteudo_clientes v WHERE v.conteudo_id = c.id ORDER BY v.cliente_id LIMIT 1), c.id,
    left(CASE WHEN c.titulo ILIKE 'Impresso - %' THEN substr(c.titulo, 12) ELSE c.titulo END, 200),
    CASE c.status_chave WHEN 'em_impressao' THEN 'em_impressao' WHEN 'para_orcar' THEN 'orcamento' WHEN 'em_orcamento' THEN 'orcamento'
      WHEN 'aprovado' THEN 'aprovado' ELSE 'arte' END,
    c.prazo, now()
  FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
  WHERE c.board_id = 8385559107 AND c.removido_em IS NULL AND c.formato ILIKE '%impresso%' AND NOT COALESCE(s.final, false)
    AND NOT EXISTS (SELECT 1 FROM vybe_impressoes i WHERE i.conteudo_id = c.id);
INSERT INTO vybe_impressao_eventos (impressao_id, de, para, nota)
  SELECT i.id, NULL, i.etapa, 'Trazida das Solicitações' FROM vybe_impressoes i
  WHERE NOT EXISTS (SELECT 1 FROM vybe_impressao_eventos e WHERE e.impressao_id = i.id);
