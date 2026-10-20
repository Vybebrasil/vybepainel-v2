-- Móveis comprados no recomeço do bolo por peça (decisão do Paulo, 20/10/2026):
-- quem comprou fica com o móvel e o preço é descontado do saldo novo, na data
-- da compra (a ficha do móvel mostra a compra e o desconto). Roda depois do
-- bolo e das conquistas refeitas (o saldo novo já tem as moedas delas). O
-- saldo nunca fica negativo: se não cobre, desconta o que houver.
-- Uma vez só (marcador bolo-compras-2026-10-20). Revisar e aplicar explicitamente.
BEGIN;
DO $$
DECLARE c record;
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='bolo-compras-2026-10-20') THEN
  RAISE NOTICE 'Compras já descontadas; nenhuma alteração.';
  RETURN;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='bolo-2026-10-20') THEN
  RAISE EXCEPTION 'Aplique antes 2026-10-20-escritorio-bolo-por-peca.sql.';
 END IF;
 FOR c IN SELECT m.* FROM vybe_escritorio_copia_bolo_moedas m
  WHERE m.origem LIKE 'compra:%' AND m.quantidade < 0
   AND NOT EXISTS (SELECT 1 FROM vybe_escritorio_copia_bolo_moedas r WHERE r.pessoa_id=m.pessoa_id AND r.origem='reembolso:compra:'||m.id)
  ORDER BY m.criado_em, m.id LOOP
  IF (SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=c.pessoa_id) > 0 THEN
   PERFORM set_config('vybe.em', c.criado_em::text, true);
   PERFORM vybe_lancar_pontos(c.pessoa_id, c.origem, NULL, NULL, c.quantidade, 0);
  END IF;
 END LOOP;
 PERFORM set_config('vybe.em', '', true);
 INSERT INTO vybe_escritorio_reinicios(chave) VALUES('bolo-compras-2026-10-20');
END $$;
COMMIT;
