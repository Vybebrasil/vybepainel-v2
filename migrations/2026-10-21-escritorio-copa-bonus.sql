-- Bônus de campeão da Copa Vybe (Paulo, 21/10/2026: "tem que ganhar um bônus
-- na hora que ganha, mas precisa ter um bônus durante o mês todo de XP e
-- VybeCoin, um bônus de % que fica ativo e mostrando na tela").
-- O campeão do mês ganha, durante o mês seguinte (desde o dia em que levou a
-- taça), mais esta porcentagem sobre o que ganhar trabalhando em cada dia,
-- em moedas e em XP. Pago no fechamento do dia (bonusCopaDoDia), uma vez por
-- dia (origem única). Compras, conquistas e prêmios não entram na conta.
-- Mude a porcentagem aqui na tabela, sem publicar.
BEGIN;
INSERT INTO vybe_escritorio_parametros(chave,valor,descricao) VALUES
 ('copa_bonus_pct',100,'Bônus do campeão da Copa: % a mais sobre o que ganha trabalhando no mês seguinte (100 = em dobro)')
ON CONFLICT (chave) DO NOTHING;
INSERT INTO vybe_escritorio_regras(chave,funcao,descricao,moedas,pontos,teto,entrega,ativa,por_complexidade) VALUES
 ('copa_bonus',NULL,'Bônus de campeão da Copa',0,0,NULL,false,true,false)
ON CONFLICT (chave) DO NOTHING;
COMMIT;
