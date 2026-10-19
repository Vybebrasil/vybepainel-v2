-- Nova economia do Escritório (pedido do Paulo, 19/10/2026: itens baratos
-- demais, dinheiro demais). Leitura do banco em 19/10: o ritmo normal dava de
-- 150 a 550 moedas por semana por pessoa, o bônus de chegada pôs de 350 a
-- 5.400 moedas de uma vez e um móvel comum custava 25. Regra nova
-- (docs/escritorio-pontos.md, "Economia de 20/10/2026"):
-- - XP não muda: continua premiando todo o trabalho e nunca cai.
-- - Moedas ficam mais raras (cerca de 100 por semana de trabalho normal).
-- - Preço por tempo de trabalho: comum 2 dias, raro 2 a 3 semanas, muito raro
--   2 meses, lendário 6 meses.
-- - Saldo de cada pessoa recalculado como se a regra nova valesse desde o
--   começo: cada lançamento do razão pelo valor novo da regra, bônus de chegada
--   a 1/4 e no máximo 500, compras e devoluções como foram. Um lançamento de
--   ajuste por pessoa explica a diferença; nunca abaixo de zero.
-- Aplicar uma vez, com o "Aprovado" do Paulo. Marcador economia-2026-10-20.
BEGIN;
LOCK TABLE vybe_escritorio_carteiras, vybe_escritorio_moedas, vybe_escritorio_regras, vybe_escritorio_raridades IN EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS vybe_escritorio_reinicios (
 chave text PRIMARY KEY, executado_em timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='economia-2026-10-20') THEN
  RAISE NOTICE 'Economia de 20/10/2026 já aplicada; nenhuma alteração.';
  RETURN;
 END IF;

 -- Moedas por ação (XP igual ao de antes).
 UPDATE vybe_escritorio_regras r SET moedas=v.moedas FROM (VALUES
  ('entrega',5),('entrega_prazo',2),('criacao_aprovacao',4),('criacao_aprovada',2),('criacao_alteracao',-2),
  ('carteira',2),('agendamento',2),('captacao',8),('agencia',1),('briefing',0),
  ('dia_sem_vencida',3),('dia_vencida',-3),('dia_agendamento',3),('dia_sem_furo',5),
  ('meta_semanal',30),('conquista',25)
 ) AS v(chave,moedas) WHERE r.chave=v.chave;

 -- Preço de cada faixa (o móvel com preço próprio no catálogo continua o dele).
 UPDATE vybe_escritorio_raridades f SET preco=v.preco FROM (VALUES
  ('comum',40),('raro',250),('muito_raro',900),('lendario',2500)
 ) AS v(chave,preco) WHERE f.chave=v.chave;

 -- Saldo pela regra nova. Perda que parou no zero continua zero; perda
 -- parcial não passa do que foi tirado.
 CREATE TEMP TABLE economia_saldos ON COMMIT DROP AS
 SELECT c.pessoa_id, c.saldo AS antes, GREATEST(0, COALESCE(sum(
   CASE
    WHEN m.regra = 'chegada' THEN LEAST(500, round(m.quantidade * 0.25)::int)
    WHEN m.regra IS NULL THEN m.quantidade
    WHEN m.quantidade = 0 THEN 0
    WHEN m.quantidade < 0 THEN GREATEST(LEAST(r.moedas, 0), m.quantidade)
    ELSE GREATEST(r.moedas, 0)
   END), 0))::int AS depois
 FROM vybe_escritorio_carteiras c
 LEFT JOIN vybe_escritorio_moedas m ON m.pessoa_id = c.pessoa_id
 LEFT JOIN vybe_escritorio_regras r ON r.chave = m.regra
 GROUP BY c.pessoa_id, c.saldo;

 INSERT INTO vybe_escritorio_moedas(pessoa_id, origem, quantidade, pontos, regra)
 SELECT pessoa_id, 'ajuste:economia-2026-10-20', depois - antes, 0, NULL
 FROM economia_saldos WHERE depois <> antes
 ON CONFLICT DO NOTHING;
 UPDATE vybe_escritorio_carteiras c SET saldo = e.depois
 FROM economia_saldos e WHERE e.pessoa_id = c.pessoa_id AND e.depois <> e.antes;

 INSERT INTO vybe_escritorio_reinicios(chave) VALUES('economia-2026-10-20');
END $$;

-- Conquista paga o valor da regra "conquista" da tabela (antes, 50 fixo no
-- código de quem chamava). Assim a moeda e o XP da conquista mudam na tabela.
CREATE OR REPLACE FUNCTION vybe_creditar_moedas(p bigint, origem_evento text, valor integer)
 RETURNS boolean LANGUAGE sql AS $$
 SELECT vybe_lancar_pontos(p, origem_evento, 'conquista', NULL,
  COALESCE((SELECT moedas FROM vybe_escritorio_regras WHERE chave='conquista'), valor),
  COALESCE((SELECT pontos FROM vybe_escritorio_regras WHERE chave='conquista'), GREATEST(valor, 0)))
$$;
COMMIT;
