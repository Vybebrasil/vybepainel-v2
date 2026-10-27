-- Escritório: escada de conquistas "Mesas de jogo" (pedido do Paulo,
-- 27/10/2026). Conta vitórias no xadrez, dominó, pôquer e sinuca contra outra
-- pessoa da equipe, uma por jogo, adversário e dia (server/escritorio-marcos.js,
-- vitoriasNasMesas). Bronze 1 vitória, Prata 10, Ouro 30, Diamante 100, com os
-- prêmios das escadas comuns (10/20/40/100 moedas e 25/50/100/200 XP de
-- conquista, fora do ranking de trabalho). Troféus: os "Troféus das Mesas"
-- (Misterioso, Visual e do Ano Amarelo do acervo) e o Trono Real, que passam a
-- vir só pela conquista. As taças aladas não: são o pódio do ranking semanal.
-- Revisar e aplicar explicitamente.
BEGIN;
INSERT INTO vybe_escritorio_trofeus(marco,nivel,meta,classe,moedas,pontos) VALUES
 ('jogos',1,1,'gift_mysterytrophy',10,25),
 ('jogos',2,10,'habbo20_c20_trophylooks',20,50),
 ('jogos',3,30,'prizetrophy_2011_y',40,100),
 ('jogos',4,100,'royal_chair',100,200)
ON CONFLICT (marco,nivel) DO NOTHING;
-- Os troféus entram no catálogo como móvel de marco (não se compram).
INSERT INTO vybe_escritorio_catalogo(classe, raridade, marco)
 SELECT DISTINCT t.classe, 'lendario', 'trofeu' FROM vybe_escritorio_trofeus t WHERE t.marco='jogos'
ON CONFLICT (classe) DO UPDATE SET marco=CASE WHEN vybe_escritorio_catalogo.marco LIKE 'ranking\_%' THEN vybe_escritorio_catalogo.marco ELSE 'trofeu' END;
COMMIT;
