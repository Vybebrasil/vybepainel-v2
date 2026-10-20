-- Escadas próprias da Produção (decisão do Paulo, 20/10/2026): dias de
-- gravação, fotos captadas e vídeos captados. As peças captadas deixam de
-- contar nas escadas da Criação (server/escritorio-marcos.js). Troféus
-- novos, fora da venda. Os níveis que a conta nova não sustenta saem uma vez
-- (revisarNiveisEscritorio, chave conquistas-producao-2026-10-20) e os novos
-- são concedidos pelo histórico (conferirMarcosDaEquipe). Revisar e aplicar.
BEGIN;
INSERT INTO vybe_escritorio_trofeus(marco,nivel,meta,classe) VALUES
 ('gravacoes',1,20,'statue_griffin'),
 ('gravacoes',2,60,'dino15_dinoprize5'),
 ('gravacoes',3,150,'thai_ltd21_yakgodstatue'),
 ('gravacoes',4,300,'diamond_painting94'),
 ('fotos_captadas',1,200,'lt_statue'),
 ('fotos_captadas',2,600,'hhistory_c24_silvertimecapsule'),
 ('fotos_captadas',3,1500,'china_goldenrabbit'),
 ('fotos_captadas',4,3000,'xmas14_sharkthrone'),
 ('videos_captados',1,50,'hc26_8'),
 ('videos_captados',2,150,'hhistory_c24_silvertimecapsuleb'),
 ('videos_captados',3,400,'china_goldensnake'),
 ('videos_captados',4,800,'bazaar_r17_throne')
ON CONFLICT (marco,nivel) DO NOTHING;
INSERT INTO vybe_escritorio_catalogo(classe,raridade,marco)
 SELECT t.classe,'lendario','trofeu' FROM vybe_escritorio_trofeus t WHERE t.marco IN ('gravacoes','fotos_captadas','videos_captados')
 ON CONFLICT (classe) DO UPDATE SET marco=CASE WHEN vybe_escritorio_catalogo.marco LIKE 'ranking\_%' THEN vybe_escritorio_catalogo.marco ELSE 'trofeu' END;
COMMIT;
