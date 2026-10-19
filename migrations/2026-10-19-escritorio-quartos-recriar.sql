-- Terceiro reinício, autorizado por Paulo em 19/10/2026, para todos refazerem
-- o quarto no novo criador (tamanho antes do formato). Quartos e inventário
-- vazios, devolvendo o preço realmente pago por cada compra, sem XP adicional.
-- Não guarda nova cópia da decoração; não afeta cenas comuns, XP ou conquistas.
-- Aplicar explicitamente depois da publicação. Nunca no build ou carregamento.
-- Prévia: SELECT pessoa_id, count(*), -sum(quantidade) AS devolver
-- FROM vybe_escritorio_moedas c WHERE origem LIKE 'compra:%' AND quantidade<0
-- AND NOT EXISTS(SELECT 1 FROM vybe_escritorio_moedas r
-- WHERE r.pessoa_id=c.pessoa_id AND r.origem='reembolso:compra:'||c.id)
-- GROUP BY pessoa_id ORDER BY pessoa_id;
BEGIN;
LOCK TABLE vybe_escritorio_perfis, vybe_escritorio_mapa,
 vybe_escritorio_mapa_versoes, vybe_escritorio_inventario,
 vybe_escritorio_carteiras, vybe_escritorio_moedas IN EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS vybe_escritorio_reinicios (
 chave text PRIMARY KEY, executado_em timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='quartos-criacao-2026-10-19') THEN
  RAISE NOTICE 'Reinício já executado; nenhuma alteração.';
  RETURN;
 END IF;
 -- Uma origem por compra, inclusive numa futura tentativa de reembolso.
 -- Compras já devolvidas no reinício de 18/10 não são devolvidas de novo.
 WITH recibos AS (
  INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade)
  SELECT pessoa_id,'reembolso:compra:'||id,-quantidade
  FROM vybe_escritorio_moedas WHERE origem LIKE 'compra:%' AND quantidade<0
  ON CONFLICT(pessoa_id,origem) DO NOTHING
  RETURNING pessoa_id,quantidade
 ), totais AS (SELECT pessoa_id,sum(quantidade)::integer AS valor FROM recibos GROUP BY pessoa_id)
 INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo)
 SELECT pessoa_id,valor FROM totais
 ON CONFLICT(pessoa_id) DO UPDATE SET saldo=vybe_escritorio_carteiras.saldo+EXCLUDED.saldo;
 DELETE FROM vybe_escritorio_inventario;
 -- Não toca nas camadas das salas comuns nem da Praça.
 UPDATE vybe_escritorio_mapa SET itens='[]'::jsonb,versao=versao+1,atualizado_em=now()
 WHERE camada ~ '^sala-[0-9]+(-andar-1)?$';
 DELETE FROM vybe_escritorio_mapa_versoes WHERE camada ~ '^sala-[0-9]+(-andar-1)?$';
 UPDATE vybe_escritorio_perfis p SET preferencias=(
  SELECT coalesce(jsonb_object_agg(k,v),'{}'::jsonb)
  FROM jsonb_each(p.preferencias) e(k,v) WHERE k NOT LIKE 'sala\_%' ESCAPE '\'
 ) || '{"quarto_configurado":false}'::jsonb,atualizado_em=now();
 INSERT INTO vybe_escritorio_reinicios(chave) VALUES('quartos-criacao-2026-10-19');
END $$;
COMMIT;
