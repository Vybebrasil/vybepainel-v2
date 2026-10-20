-- Fatia da Produção por tipo de captação (decisão do Paulo, 20/10/2026: "o
-- Mizinho não devia ganhar uma parcela disso?"). Uma gravação gera muitas
-- fotos; cada foto pagava 25% do bolo a quem gravou. Agora:
--   foto:  Produção 12%, Criação 66%, Atendimento 10%, Agendamento 10%, Gestão 2%;
--   vídeo e reels: Produção 20%, Criação 58%, Atendimento 10%, Agendamento 10%, Gestão 2%;
--   demais peças: como antes (Criação 70%, Atendimento 15%, Agendamento 12%, Gestão 3%).
-- O DA continua com 10% da fatia da Criação. A fatia passa a ser escolhida
-- pelo tipo (vybe_tipo_captacao: foto, video ou normal), não mais por
-- "captada sim/não".
-- Uma vez só (marcador bolo-producao-2026-10-20): as linhas do razão das peças
-- de foto e vídeo já pagas são refeitas pela fatia nova (mesma conta, só a
-- fatia muda) e a carteira recebe a diferença (saldo nunca negativo; XP
-- acompanha, autorizado pelo Paulo). Cópia antes. Revisar e aplicar.
BEGIN;
ALTER TABLE vybe_escritorio_fatias ADD COLUMN IF NOT EXISTS tipo text;
UPDATE vybe_escritorio_fatias SET tipo = CASE WHEN captada THEN 'video' ELSE 'normal' END WHERE tipo IS NULL;
ALTER TABLE vybe_escritorio_fatias DROP CONSTRAINT IF EXISTS vybe_escritorio_fatias_pkey;
ALTER TABLE vybe_escritorio_fatias ALTER COLUMN tipo SET NOT NULL;
ALTER TABLE vybe_escritorio_fatias ADD CONSTRAINT vybe_escritorio_fatias_pkey PRIMARY KEY (papel, tipo);
ALTER TABLE vybe_escritorio_fatias DROP CONSTRAINT IF EXISTS vybe_escritorio_fatias_tipo_check;
ALTER TABLE vybe_escritorio_fatias ADD CONSTRAINT vybe_escritorio_fatias_tipo_check CHECK (tipo IN ('normal','foto','video'));
-- Vídeo (as linhas "captada" de antes) e foto (novas).
UPDATE vybe_escritorio_fatias SET fatia = v.fatia FROM (VALUES ('producao',.20),('criacao',.58)) AS v(papel,fatia)
 WHERE vybe_escritorio_fatias.papel=v.papel AND vybe_escritorio_fatias.tipo='video';
INSERT INTO vybe_escritorio_fatias(papel,captada,tipo,fatia) VALUES
 ('producao',true,'foto',.12),('criacao',true,'foto',.66),('atendimento',true,'foto',.10),
 ('agendamento',true,'foto',.10),('gestao',true,'foto',.02),('direcao_arte',true,'foto',.10)
ON CONFLICT (papel,tipo) DO NOTHING;

-- Foto pelo formato; vídeo pelo formato captado ou porque houve captação.
CREATE OR REPLACE FUNCTION vybe_tipo_captacao(conteudo bigint) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT CASE
  WHEN EXISTS(SELECT 1 FROM vybe_conteudos v CROSS JOIN LATERAL unnest(string_to_array(v.formato, ',')) AS f(parte)
   WHERE v.id = conteudo AND vybe_formato_chave(f.parte) = 'fotografia') THEN 'foto'
  WHEN vybe_peca_captada(conteudo) THEN 'video'
  ELSE 'normal' END
$$;

CREATE OR REPLACE FUNCTION vybe_pagar_fatia(p bigint, regra_chave text, origem_evento text, conteudo bigint, dia date, parte numeric)
 RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r vybe_escritorio_regras; h vybe_escritorio_regras; v_papel text; fat numeric; peso numeric; fm numeric := 1; fx numeric := 1; ok boolean;
BEGIN
 IF p IS NULL OR parte IS NULL OR parte <= 0 THEN RETURN false; END IF;
 SELECT * INTO r FROM vybe_escritorio_regras WHERE chave=regra_chave AND ativa;
 IF r.chave IS NULL THEN RETURN false; END IF;
 IF r.funcao IS NOT NULL AND NOT EXISTS(SELECT 1 FROM vybe_escritorio_funcoes f WHERE f.pessoa_id=p AND f.funcao=r.funcao) THEN RETURN false; END IF;
 v_papel := CASE regra_chave WHEN 'peca_da' THEN 'criacao' ELSE substr(regra_chave, 6) END;
 SELECT fatia INTO fat FROM vybe_escritorio_fatias WHERE papel=v_papel AND tipo=vybe_tipo_captacao(conteudo);
 IF COALESCE(fat,0) <= 0 THEN RETURN false; END IF;
 peso := COALESCE(vybe_peso_conteudo(conteudo), 1);
 IF dia < DATE '2026-10-17' THEN
  SELECT * INTO h FROM vybe_escritorio_regras WHERE chave='historico' AND ativa;
  IF h.chave IS NOT NULL THEN fm := h.moedas / 100.0; fx := h.pontos / 100.0; END IF;
 END IF;
 ok := vybe_lancar_pontos(p,origem_evento,r.chave,conteudo,round(r.moedas*peso*fat*parte*fm)::int,round(r.pontos*peso*fat*parte*fx)::int);
 IF ok AND r.entrega THEN
  INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia) VALUES(p,origem_evento,r.chave,conteudo,dia) ON CONFLICT DO NOTHING;
 END IF;
 RETURN ok;
END $$;

-- A parte do DA também pelo tipo (o resto de vybe_pagar_bolo continua igual).
CREATE OR REPLACE FUNCTION vybe_parte_do_da(conteudo bigint) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT COALESCE((SELECT fatia FROM vybe_escritorio_fatias WHERE papel='direcao_arte' AND tipo=vybe_tipo_captacao(conteudo)), 0)
$$;

DO $$
DECLARE f text;
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='bolo-producao-2026-10-20') THEN
  RAISE NOTICE 'Fatias da Produção já refeitas; nenhuma alteração.';
  RETURN;
 END IF;
 -- vybe_pagar_bolo passa a ler a parte do DA pelo tipo.
 SELECT pg_get_functiondef('vybe_pagar_bolo(bigint,date,bigint)'::regprocedure) INTO f;
 IF position('captada=vybe_peca_captada(c.id))' IN f) = 0 THEN RAISE EXCEPTION 'vybe_pagar_bolo mudou: confira a parte do DA antes de aplicar.'; END IF;
 f := replace(f, '(SELECT fatia FROM vybe_escritorio_fatias WHERE papel=''direcao_arte'' AND captada=vybe_peca_captada(c.id))', 'vybe_parte_do_da(c.id)');
 EXECUTE f;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_producao_moedas AS
  SELECT * FROM vybe_escritorio_moedas WHERE regra IN ('peca_producao','peca_criacao','peca_da');
 -- Mesma conta, só a fatia muda: multiplica pela razão nova ÷ antiga.
 CREATE TEMP TABLE ajuste_bolo ON COMMIT DROP AS
  SELECT m.id, m.pessoa_id, m.quantidade AS antes_m, m.pontos AS antes_x,
   round(m.quantidade * CASE vybe_tipo_captacao(m.conteudo_id)
     WHEN 'foto' THEN CASE m.regra WHEN 'peca_producao' THEN .12/.25 ELSE .66/.53 END
     WHEN 'video' THEN CASE m.regra WHEN 'peca_producao' THEN .20/.25 ELSE .58/.53 END ELSE 1 END)::int AS novo_m,
   round(m.pontos * CASE vybe_tipo_captacao(m.conteudo_id)
     WHEN 'foto' THEN CASE m.regra WHEN 'peca_producao' THEN .12/.25 ELSE .66/.53 END
     WHEN 'video' THEN CASE m.regra WHEN 'peca_producao' THEN .20/.25 ELSE .58/.53 END ELSE 1 END)::int AS novo_x
  FROM vybe_escritorio_moedas m
  WHERE m.regra IN ('peca_producao','peca_criacao','peca_da') AND m.conteudo_id IS NOT NULL AND vybe_tipo_captacao(m.conteudo_id) <> 'normal';
 UPDATE vybe_escritorio_moedas m SET quantidade=a.novo_m, pontos=a.novo_x FROM ajuste_bolo a WHERE a.id=m.id;
 UPDATE vybe_escritorio_carteiras c SET saldo=GREATEST(0, c.saldo + d.m), xp=GREATEST(0, c.xp + d.x)
  FROM (SELECT pessoa_id, sum(novo_m-antes_m)::int m, sum(novo_x-antes_x)::int x FROM ajuste_bolo GROUP BY 1) d WHERE d.pessoa_id=c.pessoa_id;
 -- Se o saldo parou no zero, o razão recebe o ajuste para continuar batendo.
 INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade,pontos)
  SELECT c.pessoa_id, 'ajuste:bolo-producao-2026-10-20', c.saldo - s.m, c.xp - s.x
  FROM vybe_escritorio_carteiras c JOIN (SELECT pessoa_id, sum(quantidade)::int m, sum(pontos)::int x FROM vybe_escritorio_moedas GROUP BY 1) s ON s.pessoa_id=c.pessoa_id
  WHERE c.saldo <> s.m OR c.xp <> s.x;
 INSERT INTO vybe_escritorio_reinicios(chave) VALUES('bolo-producao-2026-10-20');
END $$;
COMMIT;
