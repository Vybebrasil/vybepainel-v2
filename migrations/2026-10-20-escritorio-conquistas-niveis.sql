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
 ('entregas',4,5000,'ltd22_giantcrystal'),
 ('cards',1,40,'trophy_viraldancer_bronze'),
 ('cards',2,120,'trophy_viraldancer_silver'),
 ('cards',3,300,'trophy_viraldancer_gold'),
 ('cards',4,600,'ltd22_giantcrystal'),
 ('carrosseis',1,30,'trophy_streamer_bronze'),
 ('carrosseis',2,90,'trophy_streamer_silver'),
 ('carrosseis',3,200,'trophy_streamer_gold'),
 ('carrosseis',4,400,'ltd22_giantcrystal'),
 ('reels',1,30,'trophy_videographer_bronze'),
 ('reels',2,100,'trophy_videographer_silver'),
 ('reels',3,250,'trophy_videographer_gold'),
 ('reels',4,500,'ltd22_giantcrystal'),
 ('stories',1,40,'trophy_chatterbox_bronze'),
 ('stories',2,120,'trophy_chatterbox_silver'),
 ('stories',3,300,'trophy_chatterbox_gold'),
 ('stories',4,600,'ltd22_giantcrystal'),
 ('fotografias',1,100,'trophy_photographer_bronze'),
 ('fotografias',2,300,'trophy_photographer_silver'),
 ('fotografias',3,700,'trophy_photographer_gold'),
 ('fotografias',4,1500,'ltd22_giantcrystal'),
 ('videos',1,10,'habbo20_c20_trophybronze'),
 ('videos',2,30,'habbo20_c20_trophysilver'),
 ('videos',3,80,'habbo20_c20_trophygold'),
 ('videos',4,200,'ltd22_giantcrystal'),
 ('nivel',1,15,'habbo20_c20_trophybronze'),
 ('nivel',2,25,'habbo20_c20_trophysilver'),
 ('nivel',3,40,'habbo20_c20_trophygold'),
 ('nivel',4,60,'ltd22_giantcrystal'),
 ('adiantado',1,100,'trophy_snowstorm_bronze'),
 ('adiantado',2,300,'trophy_snowstorm_silver'),
 ('adiantado',3,800,'trophy_snowstorm_gold'),
 ('adiantado',4,2000,'ltd22_giantcrystal'),
 ('deprimeira',1,25,'trophy_photographer_bronze'),
 ('deprimeira',2,75,'trophy_photographer_silver'),
 ('deprimeira',3,200,'trophy_photographer_gold'),
 ('deprimeira',4,500,'ltd22_giantcrystal'),
 ('embalo',1,15,'trophy_viraldancer_bronze'),
 ('embalo',2,30,'trophy_viraldancer_silver'),
 ('embalo',3,60,'trophy_viraldancer_gold'),
 ('embalo',4,120,'ltd22_giantcrystal'),
 ('clientes',1,10,'fball_trophybrasil_bronze'),
 ('clientes',2,15,'fball_trophybrasil_silver'),
 ('clientes',3,20,'fball_trophybrasil_gold'),
 ('clientes',4,25,'ltd22_giantcrystal'),
 ('semana',1,2,'trophy_streamer_bronze'),
 ('semana',2,6,'trophy_streamer_silver'),
 ('semana',3,16,'trophy_streamer_gold'),
 ('semana',4,40,'ltd22_giantcrystal'),
 ('filaemdia',1,20,'trophy_snowstorm_bronze'),
 ('filaemdia',2,60,'trophy_snowstorm_silver'),
 ('filaemdia',3,150,'trophy_snowstorm_gold'),
 ('filaemdia',4,300,'ltd22_giantcrystal'),
 ('meta',1,6,'habbo20_c20_trophybronze'),
 ('meta',2,16,'habbo20_c20_trophysilver'),
 ('meta',3,30,'habbo20_c20_trophygold'),
 ('meta',4,52,'ltd22_giantcrystal'),
 ('da',1,100,'trophy_videographer_bronze'),
 ('da',2,300,'trophy_videographer_silver'),
 ('da',3,800,'trophy_videographer_gold'),
 ('da',4,2000,'ltd22_giantcrystal'),
 ('agendamento',1,200,'trophy_chatterbox_bronze'),
 ('agendamento',2,800,'trophy_chatterbox_silver'),
 ('agendamento',3,2000,'trophy_chatterbox_gold'),
 ('agendamento',4,5000,'ltd22_giantcrystal'),
 ('carteira',1,200,'fball_trophybrasil_bronze'),
 ('carteira',2,800,'fball_trophybrasil_silver'),
 ('carteira',3,2000,'fball_trophybrasil_gold'),
 ('carteira',4,5000,'ltd22_giantcrystal'),
 ('cadastros',1,100,'prize3'),
 ('cadastros',2,400,'prize2'),
 ('cadastros',3,1000,'prize1'),
 ('cadastros',4,2500,'ltd22_giantcrystal'),
 ('planejamentos',1,3,'prizetrophy_storieshero'),
 ('planejamentos',2,10,'prizetrophy_habboway'),
 ('planejamentos',3,25,'prizetrophy_thumb'),
 ('planejamentos',4,60,'ltd22_giantcrystal'),
 ('quarto',1,1,'trophy_baw'),
 ('andar2',1,1,'bc_blocktrophy_1'),
 ('presente',1,1,'rare_prize21_xmas'),
 ('troca',1,1,'rare_r25_tradetrophy'),
 ('postits',1,10,'xmas_c22_penguintrophy')
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
