-- Conquistas em níveis (decisão do Paulo, 20/10/2026): cada escada sobe de
-- Bronze (1) para Prata (2), Ouro (3) e Diamante (4), com metas altas; uma
-- escada por tipo de entrega (Card, Carrossel, Reels, Story, Fotografia,
-- Vídeo) e por função; as sociais têm um nível só. Metas e troféus ficam aqui
-- (mudam sem deploy); como cada número é contado fica em
-- server/escritorio-marcos.js. Os troféus não se compram (marco='trofeu').
-- Reavaliação única (marcador conquistas-niveis-2026-10-20, decisão do Paulo):
-- as conquistas antigas saem (registro, moedas e XP delas, troféus do
-- inventário e dos quartos), com cópia; os níveis novos são concedidos de
-- novo pelo histórico (conferirMarcosDaEquipe, logo depois). O saldo não fica
-- negativo. Troféus do ranking não mudam. Revisar e aplicar.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_trofeus (
 marco text NOT NULL, nivel integer NOT NULL CHECK (nivel BETWEEN 1 AND 4), meta integer NOT NULL CHECK (meta > 0),
 classe text NOT NULL, PRIMARY KEY (marco, nivel)
);
INSERT INTO vybe_escritorio_trofeus(marco,nivel,meta,classe) VALUES
 ('entregas',1,200,'prize3'),
 ('entregas',2,800,'prize2'),
 ('entregas',3,2000,'prize1'),
 ('entregas',4,5000,'diamond_throne'),
 ('cards',1,40,'trophy_viraldancer_bronze'),
 ('cards',2,120,'trophy_viraldancer_silver'),
 ('cards',3,300,'trophy_viraldancer_gold'),
 ('cards',4,600,'crystal_throne'),
 ('carrosseis',1,30,'trophy_streamer_bronze'),
 ('carrosseis',2,90,'trophy_streamer_silver'),
 ('carrosseis',3,200,'trophy_streamer_gold'),
 ('carrosseis',4,400,'diamond_r23_elephant_statue'),
 ('reels',1,30,'trophy_videographer_bronze'),
 ('reels',2,100,'trophy_videographer_silver'),
 ('reels',3,250,'trophy_videographer_gold'),
 ('reels',4,500,'mystics_ltstatue'),
 ('stories',1,40,'trophy_chatterbox_bronze'),
 ('stories',2,120,'trophy_chatterbox_silver'),
 ('stories',3,300,'trophy_chatterbox_gold'),
 ('stories',4,600,'xmas_r19_crystalfountain'),
 ('fotografias',1,100,'trophy_photographer_bronze'),
 ('fotografias',2,300,'trophy_photographer_silver'),
 ('fotografias',3,700,'trophy_photographer_gold'),
 ('fotografias',4,1500,'suncity_r19_glassfountain'),
 ('videos',1,10,'sp_statue'),
 ('videos',2,30,'bling11_pillar'),
 ('videos',3,80,'gold_c15_arc_tree1'),
 ('videos',4,200,'lt_r26_gemstatue'),
 ('nivel',1,15,'habbo20_c20_trophybronze'),
 ('nivel',2,25,'habbo20_c20_trophysilver'),
 ('nivel',3,40,'habbo20_c20_trophygold'),
 ('nivel',4,60,'rainbow_ltd22_elephant_statue'),
 ('adiantado',1,100,'trophy_snowstorm_bronze'),
 ('adiantado',2,300,'trophy_snowstorm_silver'),
 ('adiantado',3,800,'trophy_snowstorm_gold'),
 ('adiantado',4,2000,'fest_r19_gemowl'),
 ('deprimeira',1,25,'greek_c19_statue'),
 ('deprimeira',2,75,'coco_throne_c3'),
 ('deprimeira',3,200,'gold_c15_arc_tree2'),
 ('deprimeira',4,500,'xmas_ltd19_icethrone'),
 ('embalo',1,15,'thai_c21_woodenstatue'),
 ('embalo',2,30,'trophy_ltd23_silvermonsterplant'),
 ('embalo',3,60,'winter15_tree4'),
 ('embalo',4,120,'throne'),
 ('clientes',1,10,'fball_trophybrasil_bronze'),
 ('clientes',2,15,'fball_trophybrasil_silver'),
 ('clientes',3,20,'fball_trophybrasil_gold'),
 ('clientes',4,25,'LT_throne'),
 ('semana',1,2,'lt_c26_monkey1'),
 ('semana',2,6,'wed_icesculp'),
 ('semana',3,16,'trophy_ltd23_goldmonsterplant'),
 ('semana',4,40,'dng_throne'),
 ('filaemdia',1,20,'lt_c26_monkey2'),
 ('filaemdia',2,60,'winter15_icehockey'),
 ('filaemdia',3,150,'cmp_fish_g'),
 ('filaemdia',4,300,'coco_throne__c2'),
 ('meta',1,6,'lt_c26_monkey3'),
 ('meta',2,16,'winter15_snowboard'),
 ('meta',3,30,'gold_c15_arc_statue'),
 ('meta',4,52,'mini_c24_cakethrone3'),
 ('da',1,100,'lt_c26_stonefountain'),
 ('da',2,300,'winter15_iceskater'),
 ('da',3,800,'gold_c15_arc_lantern'),
 ('da',4,2000,'wonderland_c25_cardthrone'),
 ('agendamento',1,200,'lt_c26_stonepillar'),
 ('agendamento',2,800,'sc_snowglobe3'),
 ('agendamento',3,2000,'gold_c15_arc_lamp'),
 ('agendamento',4,5000,'coco_throne'),
 ('carteira',1,200,'anc_trophy_sstone'),
 ('carteira',2,800,'sc_snowglobe2'),
 ('carteira',3,2000,'winter15_lmppst'),
 ('carteira',4,5000,'coco_throne_c4'),
 ('cadastros',1,100,'trophy_viraldancer_iron'),
 ('cadastros',2,400,'lt_c26_monkey4'),
 ('cadastros',3,1000,'bazaar_r17_monkey'),
 ('cadastros',4,2500,'cloud_throne'),
 ('planejamentos',1,3,'trophy_chatterbox_iron'),
 ('planejamentos',2,10,'ads_idol_chmpgn'),
 ('planejamentos',3,25,'coralking_r18_goldenchest'),
 ('planejamentos',4,60,'mystics_gthrone'),
 ('quarto',1,1,'trophy_baw'),
 ('andar2',1,1,'bc_blocktrophy_1'),
 ('presente',1,1,'rare_prize21_xmas'),
 ('troca',1,1,'rare_r25_tradetrophy'),
 ('postits',1,10,'xmas_c22_penguintrophy'),
 ('agendados_cards',1,80,'trophy_photographer_iron'),
 ('agendados_cards',2,250,'ads_mtvtrophy_silver'),
 ('agendados_cards',3,600,'china_goldenpig'),
 ('agendados_cards',4,1200,'mystics_bthrone'),
 ('agendados_carrosseis',1,50,'trophy_snowstorm_stone'),
 ('agendados_carrosseis',2,150,'anc_trophy_marble'),
 ('agendados_carrosseis',3,350,'china_goldenrat'),
 ('agendados_carrosseis',4,700,'xmas_r23_cakethrone'),
 ('agendados_reels',1,60,'trophy_streamer_iron'),
 ('agendados_reels',2,200,'cloud_egg'),
 ('agendados_reels',3,500,'zengarden_c20_goldenmobile'),
 ('agendados_reels',4,1000,'cland15_candythrone'),
 ('agendados_stories',1,50,'trophy_videographer_iron'),
 ('agendados_stories',2,150,'greek_c19_pythagorascup'),
 ('agendados_stories',3,350,'china_goldentiger'),
 ('agendados_stories',4,700,'india_ltd20_sultanthrone'),
 ('agendados_fotografias',1,100,'xmas_c22_pillar'),
 ('agendados_fotografias',2,300,'ny2013_cup'),
 ('agendados_fotografias',3,700,'uni_ltd23_goldenfountain'),
 ('agendados_fotografias',4,1500,'ranch_r26_pumpkinthrone'),
 ('carteira_cards',1,80,'statue'),
 ('carteira_cards',2,250,'qt_xm10_ice_fish'),
 ('carteira_cards',3,600,'china_goldenhorse'),
 ('carteira_cards',4,1200,'diamond_painting69'),
 ('carteira_carrosseis',1,50,'china_ox'),
 ('carteira_carrosseis',2,150,'rare_prize19_xmas'),
 ('carteira_carrosseis',3,350,'ads_mtvtrophy_gold'),
 ('carteira_carrosseis',4,700,'dino_ltd22_lavathrone'),
 ('carteira_reels',1,60,'bling11_statue1'),
 ('carteira_reels',2,200,'sc_snowglobe1'),
 ('carteira_reels',3,500,'china_goldendragon'),
 ('carteira_reels',4,1000,'easter_ltd19_flowerthrone'),
 ('carteira_stories',1,50,'anc_artifact3'),
 ('carteira_stories',2,150,'xmas13_snowflake3'),
 ('carteira_stories',3,350,'habbo25_sc25_goldenfountain'),
 ('carteira_stories',4,700,'xmas_r16_throne'),
 ('carteira_fotografias',1,100,'china_snake'),
 ('carteira_fotografias',2,300,'xmas14_snowglobe'),
 ('carteira_fotografias',3,700,'china_goldenox'),
 ('carteira_fotografias',4,1500,'vikings_throne'),
 ('briefings',1,100,'statue_elk'),
 ('briefings',2,400,'qt_xm10_icelupin'),
 ('briefings',3,1000,'rare_blackrosegold_dragonlamp'),
 ('briefings',4,2500,'hween13_throne'),
 ('agencia',1,300,'stories_shakespeare_fairy'),
 ('agencia',2,1000,'xmas_r20_icefountain'),
 ('agencia',3,2500,'rare_blackrosegold_elephant_statue'),
 ('agencia',4,6000,'hween_c20_tentaclethrone')
ON CONFLICT (marco,nivel) DO NOTHING;
-- Troféus das escadas: fora da venda e da vitrine (os do ranking continuam com o marco deles).
INSERT INTO vybe_escritorio_catalogo(classe,raridade,marco)
 SELECT DISTINCT t.classe,'lendario','trofeu' FROM vybe_escritorio_trofeus t
 ON CONFLICT (classe) DO UPDATE SET marco=CASE WHEN vybe_escritorio_catalogo.marco LIKE 'ranking\_%' THEN vybe_escritorio_catalogo.marco ELSE 'trofeu' END;
-- Os prêmios das conquistas antigas continuam fora da venda.
UPDATE vybe_escritorio_catalogo SET marco='trofeu' WHERE marco IS NOT NULL AND marco NOT LIKE 'ranking\_%' AND marco<>'trofeu';

CREATE TABLE IF NOT EXISTS vybe_escritorio_reinicios (chave text PRIMARY KEY, executado_em timestamptz NOT NULL DEFAULT now());
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='conquistas-niveis-2026-10-20') THEN
  RAISE NOTICE 'Conquistas em níveis já aplicadas; nenhuma alteração.';
  RETURN;
 END IF;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_niveis_marcos AS SELECT * FROM vybe_escritorio_marcos;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_niveis_moedas AS SELECT * FROM vybe_escritorio_moedas WHERE regra='conquista' OR origem LIKE 'conquista:%';
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_niveis_inventario AS SELECT * FROM vybe_escritorio_inventario;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_niveis_mapa AS SELECT * FROM vybe_escritorio_mapa WHERE camada ~ '^sala-[0-9]+(-andar-1)?$';
 -- Tira as moedas e o XP das conquistas antigas (o saldo para no zero).
 UPDATE vybe_escritorio_carteiras c SET saldo=GREATEST(0, c.saldo - x.moedas), xp=GREATEST(0, c.xp - x.pontos)
  FROM (SELECT pessoa_id, sum(quantidade)::int moedas, sum(pontos)::int pontos FROM vybe_escritorio_moedas WHERE regra='conquista' OR origem LIKE 'conquista:%' GROUP BY 1) x
  WHERE x.pessoa_id=c.pessoa_id;
 DELETE FROM vybe_escritorio_moedas WHERE regra='conquista' OR origem LIKE 'conquista:%';
 DELETE FROM vybe_escritorio_marcos;
 -- Troféus de conquista saem do inventário e dos quartos (os do ranking ficam).
 DELETE FROM vybe_escritorio_inventario i USING vybe_escritorio_catalogo c WHERE c.classe=i.classe AND c.marco='trofeu';
 UPDATE vybe_escritorio_mapa m SET itens=COALESCE((SELECT jsonb_agg(it) FROM jsonb_array_elements(m.itens) it
   WHERE NOT EXISTS (SELECT 1 FROM vybe_escritorio_catalogo c WHERE c.classe=it->>0 AND c.marco='trofeu')),'[]'::jsonb), versao=versao+1, atualizado_em=now()
  WHERE m.camada ~ '^sala-[0-9]+(-andar-1)?$' AND EXISTS (SELECT 1 FROM jsonb_array_elements(m.itens) it JOIN vybe_escritorio_catalogo c ON c.classe=it->>0 AND c.marco='trofeu');
 INSERT INTO vybe_escritorio_reinicios(chave) VALUES('conquistas-niveis-2026-10-20');
END $$;
COMMIT;
