-- Correção da escada "Mesas de jogo" (27/10/2026): a primeira versão da
-- migração usava as taças aladas, que já são o pódio do ranking semanal
-- (ranking_1/2/3). Bronze, Prata e Ouro passam para os "Troféus das Mesas"
-- (gift_mysterytrophy, habbo20_c20_trophylooks, prizetrophy_2011_y), que não
-- eram prêmio de nada; o Diamante continua o Trono Real. Nenhuma pessoa tinha
-- recebido troféu desta escada ainda. Pode rodar mais de uma vez.
-- Revisar e aplicar explicitamente.
BEGIN;
UPDATE vybe_escritorio_trofeus t SET classe=v.classe FROM (VALUES
 (1,'gift_mysterytrophy'),(2,'habbo20_c20_trophylooks'),(3,'prizetrophy_2011_y')
) AS v(nivel,classe) WHERE t.marco='jogos' AND t.nivel=v.nivel;
INSERT INTO vybe_escritorio_catalogo(classe, raridade, marco)
 SELECT DISTINCT t.classe, 'lendario', 'trofeu' FROM vybe_escritorio_trofeus t WHERE t.marco='jogos'
ON CONFLICT (classe) DO UPDATE SET marco=CASE WHEN vybe_escritorio_catalogo.marco LIKE 'ranking\_%' THEN vybe_escritorio_catalogo.marco ELSE 'trofeu' END;
COMMIT;
