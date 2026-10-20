-- Ranking da semana (decisão do Paulo, 20/10/2026): competição saudável.
-- Prêmios do pódio (1º, 2º e 3º pelo % da própria meta da semana) e o bônus
-- de todos quando a agência bate a meta de peças da semana. Os valores ficam
-- aqui na tabela (mudam sem deploy); os troféus do pódio são móveis só por
-- prêmio (marco = chave da regra), fora da venda e da vitrine.
-- Não mexe em saldo nem XP de ninguém: paga só no fechamento da semana
-- (server/escritorio-pontos.js, fecharRankingSemana). Revisar e aplicar.
BEGIN;
INSERT INTO vybe_escritorio_regras(chave,funcao,descricao,moedas,pontos,teto,entrega,ativa,por_complexidade) VALUES
 ('ranking_1',NULL,'1º lugar no ranking da semana',50,100,NULL,false,true,false),
 ('ranking_2',NULL,'2º lugar no ranking da semana',30,60,NULL,false,true,false),
 ('ranking_3',NULL,'3º lugar no ranking da semana',20,40,NULL,false,true,false),
 ('meta_agencia',NULL,'A agência bateu a meta de peças da semana',20,40,NULL,false,true,false)
ON CONFLICT (chave) DO NOTHING;
INSERT INTO vybe_escritorio_catalogo(classe,raridade,marco) VALUES
 ('trophy_fball_c26_wingedgold','lendario','ranking_1'),
 ('trophy_fball_c26_wingedsilver','lendario','ranking_2'),
 ('trophy_fball_c26_wingedbronze','lendario','ranking_3')
ON CONFLICT (classe) DO UPDATE SET marco=EXCLUDED.marco;
COMMIT;
