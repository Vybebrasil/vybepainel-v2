-- Copa Vybe (decisões do Paulo, 21/10/2026: "já me reclamaram sentindo falta
-- do da Copa do Mundo"; "a taça da Copa tem que ser um item épico"; "dá pra
-- criar uma mecânica pra isso?"; "tudo aprovado").
-- A taça da Copa do Mundo (fball_trophy, épica, nunca à venda) é o prêmio do
-- campeão do mês: 1º no ranking Geral do mês (o % da própria meta). 2º e 3º
-- levam as taças clássicas de prata e bronze. Paga no fechamento do mês
-- (server/escritorio-pontos.js, fecharCopaMes), uma vez por mês, com o título
-- "Campeão da Copa · <mês>". O primeiro fechamento é o de setembro.
-- O Pódio (semanas no pódio) passa a pedir 1, 5, 12 e 30 semanas e o Bronze
-- dele vira a taça prata pequena. Escada nova Artilheiro (semanas em 1º):
-- 1, 3, 8 e 20, com chuteira azul, Chuteira de Ouro, taça prata e a estátua
-- do gol de bicicleta. Ninguém tinha o Pódio nem a taça quando esta migração
-- foi escrita: mudar as metas não tira nada de ninguém.
BEGIN;
INSERT INTO vybe_escritorio_regras(chave,funcao,descricao,moedas,pontos,teto,entrega,ativa,por_complexidade) VALUES
 ('copa_1',NULL,'Campeão da Copa Vybe do mês',150,300,NULL,false,true,false),
 ('copa_2',NULL,'2º lugar na Copa Vybe do mês',60,120,NULL,false,true,false),
 ('copa_3',NULL,'3º lugar na Copa Vybe do mês',30,60,NULL,false,true,false)
ON CONFLICT (chave) DO NOTHING;
UPDATE vybe_escritorio_trofeus t SET meta=v.meta FROM (VALUES ('podio',1,1),('podio',2,5),('podio',3,12),('podio',4,30)) AS v(marco,nivel,meta)
 WHERE t.marco=v.marco AND t.nivel=v.nivel;
UPDATE vybe_escritorio_trofeus SET classe='ads_aftv_trophy2' WHERE marco='podio' AND nivel=1;
INSERT INTO vybe_escritorio_trofeus(marco,nivel,meta,classe,moedas,pontos) VALUES
 ('artilheiro',1,1,'fball_goldenboot2',10,25),('artilheiro',2,3,'fball_goldenboot',20,50),
 ('artilheiro',3,8,'ads_drsports_trophy3',40,100),('artilheiro',4,20,'fball_ltd14',100,200)
ON CONFLICT DO NOTHING;
-- Troféus só de conquista (fora da venda): os do Pódio e do Artilheiro.
INSERT INTO vybe_escritorio_catalogo(classe, raridade, marco)
 SELECT DISTINCT t.classe, 'lendario', 'trofeu' FROM vybe_escritorio_trofeus t WHERE t.marco IN ('artilheiro','podio')
ON CONFLICT (classe) DO UPDATE SET marco='trofeu';
-- As taças da Copa: prêmio do fechamento do mês (marco = chave da regra).
INSERT INTO vybe_escritorio_catalogo(classe, raridade, marco) VALUES
 ('fball_trophy','epico','copa_1'),('prizetrophy2','lendario','copa_2'),('prizetrophy3','lendario','copa_3')
ON CONFLICT (classe) DO UPDATE SET marco=EXCLUDED.marco, raridade=EXCLUDED.raridade;
COMMIT;
