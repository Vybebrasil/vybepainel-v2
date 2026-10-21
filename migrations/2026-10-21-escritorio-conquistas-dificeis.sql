-- Conquistas mais difíceis, prêmio novo e escadas novas (decisões do Paulo,
-- 21/10/2026: "as conquistas sim precisam ser difíceis"; "não zera todos, só
-- o que a pessoa vai perder na regra nova"; títulos por nível).
-- Metas: Bronze fica; Prata ×1,5, Ouro ×2, Diamante ×2,5 (Nível e Muitos
-- clientes com metas próprias). A régua: Bronze em cerca de 1 mês, Prata 3,
-- Ouro 6 e Diamante perto de 1 ano no ritmo de quem mais faz.
-- Prêmio por nível, na régua de preços de 21/10 (comum 10, raro 40, épico 100):
-- Bronze 10 moedas e 25 XP, Prata 20 e 50, Ouro 40 e 100, Diamante 100 e 200;
-- sociais (um nível) 10 e 25. Vale para as conquistas daqui para a frente;
-- as já pagas ficam como foram.
-- Escadas novas: Impressos, Meta turbinada (160%), Pódio (top 3 da semana) e
-- No painel (dias com as 10 ações do painel; o histórico tem um ano, então
-- 60/150/250/365 dias: Tainara, com 143, fica no Bronze).
-- Depois desta migração, rodar uma vez `node scripts/escritorio-revisar-conquistas.mjs`
-- (tira de cada pessoa só os níveis que a meta nova não alcança, com o troféu,
-- inclusive do quarto; marcador conquistas-dificeis-2026-10-21).
BEGIN;
ALTER TABLE vybe_escritorio_trofeus ADD COLUMN IF NOT EXISTS moedas integer, ADD COLUMN IF NOT EXISTS pontos integer;
-- A multiplicação roda uma vez só (marcador), para a meta não subir de novo.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='conquistas-metas-2026-10-21') THEN
  UPDATE vybe_escritorio_trofeus SET meta = round(meta * CASE nivel WHEN 2 THEN 1.5 WHEN 3 THEN 2 WHEN 4 THEN 2.5 ELSE 1 END)
   WHERE marco NOT IN ('nivel','clientes') AND marco NOT IN (SELECT marco FROM vybe_escritorio_trofeus GROUP BY marco HAVING count(*) = 1);
  INSERT INTO vybe_escritorio_reinicios(chave) VALUES('conquistas-metas-2026-10-21');
 END IF;
END $$;
UPDATE vybe_escritorio_trofeus t SET meta=v.meta FROM (VALUES
 ('nivel',1,15),('nivel',2,30),('nivel',3,50),('nivel',4,75),
 ('clientes',1,10),('clientes',2,18),('clientes',3,25),('clientes',4,35)
) AS v(marco,nivel,meta) WHERE t.marco=v.marco AND t.nivel=v.nivel;
INSERT INTO vybe_escritorio_trofeus(marco,nivel,meta,classe) VALUES
 ('impressos',1,10,'prizetrophy_2011_b'),('impressos',2,45,'prizetrophy_2011_w'),('impressos',3,160,'prizetrophy_2011_g'),('impressos',4,500,'habbo20_c20_trophydesign'),
 ('meta_turbo',1,2,'prizetrophy_2011_r'),('meta_turbo',2,6,'prizetrophy_2011_p'),('meta_turbo',3,15,'habbo20_c20_trophyblock'),('meta_turbo',4,35,'anc_trophy_obsidian'),
 ('podio',1,2,'fball_trophy'),('podio',2,6,'ads_cp_trophy'),('podio',3,15,'lt_c26_goldenstatue'),('podio',4,35,'olympus_r25_zeusstatue'),
 ('painel',1,60,'classic8_statue'),('painel',2,150,'legotrophy'),('painel',3,250,'se_trophyS'),('painel',4,365,'se_trophyG')
ON CONFLICT DO NOTHING;
UPDATE vybe_escritorio_trofeus t SET moedas = CASE WHEN s.um THEN 10 ELSE (ARRAY[10,20,40,100])[t.nivel] END,
 pontos = CASE WHEN s.um THEN 25 ELSE (ARRAY[25,50,100,200])[t.nivel] END
 FROM (SELECT marco, count(*) = 1 AS um FROM vybe_escritorio_trofeus GROUP BY marco) s WHERE s.marco=t.marco;
-- Os troféus novos entram no catálogo como móvel de marco (não se compram).
INSERT INTO vybe_escritorio_catalogo(classe, raridade, marco)
 SELECT DISTINCT t.classe, 'lendario', 'trofeu' FROM vybe_escritorio_trofeus t
 WHERE t.marco IN ('impressos','meta_turbo','podio','painel')
ON CONFLICT (classe) DO UPDATE SET marco=CASE WHEN vybe_escritorio_catalogo.marco LIKE 'ranking\_%' THEN vybe_escritorio_catalogo.marco ELSE 'trofeu' END;
COMMIT;
