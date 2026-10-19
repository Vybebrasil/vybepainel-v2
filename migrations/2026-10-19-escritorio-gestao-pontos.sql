-- Gestão ganha pelo trabalho da agência (decisão do Paulo, 19/10/2026, opção C):
-- (A) +5 moedas e +5 XP por peça de qualquer cliente finalizada (Solicitações)
-- ou aprovada sem alteração (Produção), como os heads ganham pela carteira;
-- (B) demanda criada com briefing passa a contar como entrega da Gestão.
-- O histórico entra como as outras funções entraram: antes da instalação dos
-- pontos (17/10/2026), bônus de chegada (2 moedas e 10 XP por entrega); de 17/10
-- em diante, a regra normal. Tudo com origem única: repetir não credita de novo.
-- Revisar e aplicar explicitamente.
BEGIN;
INSERT INTO vybe_escritorio_regras(chave,funcao,descricao,moedas,pontos,teto,entrega)
 VALUES('agencia','gestao','Peça da agência finalizada ou aprovada',5,5,NULL,true)
 ON CONFLICT (chave) DO NOTHING;
UPDATE vybe_escritorio_regras SET entrega=true WHERE chave='briefing';

-- A mesma função que já paga os heads da carteira passa a pagar a Gestão
-- (é chamada na finalização de Solicitações e na aprovação sem alteração).
CREATE OR REPLACE FUNCTION vybe_pontuar_carteira(conteudo bigint, dia date) RETURNS void LANGUAGE plpgsql AS $$
DECLARE head bigint; gestor bigint;
BEGIN
 FOR head IN SELECT DISTINCT f.pessoa_id FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id=cc.cliente_id
  JOIN vybe_escritorio_funcoes f ON f.funcao='atendimento' AND f.carteira IS NOT NULL AND lower(f.carteira)=lower(trim(COALESCE(cl.responsavel,'')))
  WHERE cc.conteudo_id=conteudo ORDER BY 1 LOOP
  PERFORM vybe_aplicar_regra(head,'carteira','carteira:'||conteudo,conteudo,dia);
 END LOOP;
 FOR gestor IN SELECT pessoa_id FROM vybe_escritorio_funcoes WHERE funcao='gestao' ORDER BY 1 LOOP
  PERFORM vybe_aplicar_regra(gestor,'agencia','agencia:'||conteudo,conteudo,dia);
 END LOOP;
END $$;

LOCK TABLE vybe_conteudo_eventos IN SHARE ROW EXCLUSIVE MODE;
-- Histórico da agência: as mesmas peças que contam para a carteira.
WITH pecas AS (
 SELECT DISTINCT ON (e.conteudo_id) e.conteudo_id,e.em FROM vybe_conteudo_eventos e JOIN vybe_conteudos c ON c.id=e.conteudo_id
 WHERE e.tipo='status' AND ((c.board_id=8385559107 AND lower(trim(COALESCE(e.para,''))) IN ('finalizado','feito'))
  OR (c.board_id=7829537690 AND lower(trim(COALESCE(e.para,'')))='para agendar'
   AND NOT EXISTS(SELECT 1 FROM vybe_conteudo_eventos a WHERE a.conteudo_id=e.conteudo_id AND a.tipo='status' AND a.para ILIKE 'altera%' AND a.em<e.em)))
 ORDER BY e.conteudo_id,e.em,e.id)
INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia)
 SELECT f.pessoa_id,'agencia:'||p.conteudo_id,'agencia',p.conteudo_id,vybe_dia_bahia(p.em)
 FROM pecas p CROSS JOIN vybe_escritorio_funcoes f WHERE f.funcao='gestao' AND vybe_dia_bahia(p.em) < DATE '2026-10-17'
 ON CONFLICT DO NOTHING;
-- Demandas criadas com briefing por quem é da Gestão (antes e depois da instalação;
-- as de depois já receberam os +2 pela regra, aqui só entram como entrega).
INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia)
 SELECT DISTINCT ON (e.conteudo_id) e.autor_id,'briefing:'||e.conteudo_id,'briefing',e.conteudo_id,vybe_dia_bahia(e.em)
 FROM vybe_conteudo_eventos e JOIN vybe_conteudos c ON c.id=e.conteudo_id
 JOIN vybe_escritorio_funcoes f ON f.pessoa_id=e.autor_id AND f.funcao='gestao'
 WHERE e.tipo='criacao' AND NULLIF(trim(COALESCE(c.briefing,'')),'') IS NOT NULL
 ORDER BY e.conteudo_id,e.em,e.id ON CONFLICT DO NOTHING;
-- De 17/10 até agora a regra já existia para os heads: a Gestão recebe a
-- regra normal pelas peças desses dias (uma vez por peça, origem única).
DO $$
DECLARE p record; gestor bigint;
BEGIN
 FOR p IN
  SELECT DISTINCT ON (e.conteudo_id) e.conteudo_id,vybe_dia_bahia(e.em) AS dia FROM vybe_conteudo_eventos e JOIN vybe_conteudos c ON c.id=e.conteudo_id
  WHERE e.tipo='status' AND vybe_dia_bahia(e.em) >= DATE '2026-10-17' AND ((c.board_id=8385559107 AND lower(trim(COALESCE(e.para,''))) IN ('finalizado','feito'))
   OR (c.board_id=7829537690 AND lower(trim(COALESCE(e.para,'')))='para agendar'
    AND NOT EXISTS(SELECT 1 FROM vybe_conteudo_eventos a WHERE a.conteudo_id=e.conteudo_id AND a.tipo='status' AND a.para ILIKE 'altera%' AND a.em<e.em)))
   -- Peça que já entrou no histórico (antes de 17/10) não é paga de novo.
   AND NOT EXISTS(SELECT 1 FROM vybe_escritorio_entregas h WHERE h.regra='agencia' AND h.conteudo_id=e.conteudo_id)
  ORDER BY e.conteudo_id,e.em,e.id
 LOOP
  FOR gestor IN SELECT pessoa_id FROM vybe_escritorio_funcoes WHERE funcao='gestao' ORDER BY 1 LOOP
   PERFORM vybe_aplicar_regra(gestor,'agencia','agencia:'||p.conteudo_id,p.conteudo_id,p.dia);
  END LOOP;
 END LOOP;
END $$;
-- Bônus de chegada da Gestão pelas entregas de antes da instalação, como as
-- outras funções receberam (origem própria: não repete nem soma de novo).
DO $$
DECLARE r vybe_escritorio_regras; p record;
BEGIN
 SELECT * INTO r FROM vybe_escritorio_regras WHERE chave='chegada' AND ativa;
 IF r.chave IS NULL THEN RETURN; END IF;
 FOR p IN SELECT e.pessoa_id,count(*) AS n FROM vybe_escritorio_entregas e JOIN vybe_escritorio_funcoes f ON f.pessoa_id=e.pessoa_id AND f.funcao='gestao'
  WHERE e.regra IN ('agencia','briefing') AND e.dia < DATE '2026-10-17' GROUP BY e.pessoa_id ORDER BY e.pessoa_id LOOP
  PERFORM vybe_lancar_pontos(p.pessoa_id,'chegada:gestao-2026-10-19','chegada',NULL,
   LEAST(COALESCE(r.teto,2147483647),(p.n*r.moedas)::integer),(p.n*r.pontos)::integer);
 END LOOP;
END $$;
COMMIT;
