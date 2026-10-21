-- Valor por papel (decisão do Paulo, 21/10/2026). Cada papel ganha um valor
-- fixo pela peça, vezes o peso do formato: "o Deivid ganha 100 porque fez, o
-- Vinícius como head ganha uma parte, o Paulo como geral, a Tainara porque
-- postou, o Mizinho porque tirou a foto". Volume conta (quem faz mais ganha
-- mais), sem que passar por todas as peças valha mais do que fazê-las.
--
-- Por peça de peso 1 (10 pontos = 1 moeda; XP em dobro):
--   quem fez 10 moedas (100%), DA que aprovou +15%, head do cliente 25%,
--   quem postou (agendou ou finalizou, de qualquer função) 15%, geral 5%,
--   quem captou: foto 30%, vídeo 32% (um Reels de peso 2,5 dá 8 moedas).
-- Bônus: no prazo +1, aprovada de primeira +1, briefing +1; cadastro só XP.
-- Penalidades com moeda e XP (moeda e XP nunca abaixo de zero):
--   voltou para alteração −2 e −5 XP; dia com demanda vencida −3 e −5 XP.
-- Dia com ação no painel +2; cada ação no painel +1, até 10 por dia.
-- Meta em degraus (no fechamento da semana, só o maior): 100% +30,
--   130% +60, 160% +100.
-- Teto suave: acima de 600 moedas na semana, cada moeda conta metade (o XP
--   não tem teto).
-- Pesos (Paulo, 21/10/2026: "para o Deivid comprar a Jukebox, uns 4 cards ou
--   2 carrosséis; o Reriston 2 vídeos; impresso 1; fotografia umas 6 a 8"):
--   fotografia 0,6, Reels e vídeo 2, motion 2,5, impresso 4; os outros como
--   estavam. Preço em cards (um card = 10 moedas para quem fez): comum 10,
--   incomum 20, raro 40, épico 100, lendário 250; skin completa 20% abaixo
--   da soma.
--
-- O histórico inteiro conta, inclusive as ações no painel (Paulo, 21/10/2026:
-- "vamos usar todo histórico sim, inclusive para os ranks").
-- Uma vez só (marcador valor-papel-2026-10-21), o histórico é refeito pela
-- regra nova: as linhas de peça e os bônus de peça saem do razão e o log é
-- pontuado de novo, na ordem, com a data de cada evento; os fechamentos de
-- dia e de semana ficam e recebem o valor novo da regra; compras,
-- devoluções, conquistas, ranking e chegada ficam como estão. Saldo e XP
-- passam a ser a soma do razão (nunca abaixo de zero; um ajuste no extrato
-- explica a diferença). Cópia antes. Revisar e aplicar explicitamente.
-- Depende de 2026-10-20-escritorio-bolo-producao.sql (fatias por tipo).
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vybe_escritorio_fatias' AND column_name='tipo') THEN
  RAISE EXCEPTION 'Aplique antes 2026-10-20-escritorio-bolo-producao.sql (fatias por tipo).';
 END IF;
END $$;

-- Valor de cada papel por peça (fração do valor de quem fez).
INSERT INTO vybe_escritorio_fatias(papel,captada,tipo,fatia) VALUES
 ('criacao',false,'normal',1),('producao',false,'normal',0),('atendimento',false,'normal',.25),('agendamento',false,'normal',.15),('gestao',false,'normal',.05),('direcao_arte',false,'normal',.15),
 ('criacao',true,'foto',1),('producao',true,'foto',.30),('atendimento',true,'foto',.25),('agendamento',true,'foto',.15),('gestao',true,'foto',.05),('direcao_arte',true,'foto',.15),
 ('criacao',true,'video',1),('producao',true,'video',.32),('atendimento',true,'video',.25),('agendamento',true,'video',.15),('gestao',true,'video',.05),('direcao_arte',true,'video',.15)
ON CONFLICT (papel,tipo) DO UPDATE SET fatia=EXCLUDED.fatia;
UPDATE vybe_escritorio_regras SET descricao='Peça feita por você' WHERE chave='peca_criacao';
UPDATE vybe_escritorio_regras SET descricao='Peça aprovada como DA (15% do valor de quem fez)' WHERE chave='peca_da';
UPDATE vybe_escritorio_regras SET descricao='Foto ou vídeo captado por você' WHERE chave='peca_producao';
UPDATE vybe_escritorio_regras SET descricao='Peça de cliente da sua carteira (head)' WHERE chave='peca_atendimento';
UPDATE vybe_escritorio_regras SET funcao=NULL, descricao='Peça agendada ou finalizada por você (quem postou)' WHERE chave='peca_agendamento';
UPDATE vybe_escritorio_regras SET descricao='Peça da agência (geral)' WHERE chave='peca_gestao';

-- Bônus, penalidades e degraus. XP pode cair nas penalidades (muda a regra de
-- 17/10 "XP nunca cai"); a carteira continua com moeda e XP >= 0.
ALTER TABLE vybe_escritorio_regras DROP CONSTRAINT IF EXISTS vybe_escritorio_regras_pontos_check;
ALTER TABLE vybe_escritorio_moedas DROP CONSTRAINT IF EXISTS vybe_escritorio_moedas_pontos_check;
ALTER TABLE vybe_escritorio_moedas DROP CONSTRAINT IF EXISTS vybe_escritorio_moedas_quantidade_check;
ALTER TABLE vybe_escritorio_moedas ADD CONSTRAINT vybe_escritorio_moedas_quantidade_check CHECK (quantidade <> 0 OR pontos <> 0 OR regra IS NOT NULL);
UPDATE vybe_escritorio_regras r SET moedas=v.moedas, pontos=v.pontos FROM (VALUES
 ('entrega_prazo',1,2),('criacao_aprovada',1,2),('criacao_alteracao',-2,-5),('dia_vencida',-3,-5),
 ('dia_sem_vencida',3,5),('dia_agendamento',3,5),('dia_sem_furo',5,10),('dia_ativo',2,2),
 ('cadastro',0,2),('briefing',1,2),('meta_semanal',30,50)
) AS v(chave,moedas,pontos) WHERE r.chave=v.chave;
INSERT INTO vybe_escritorio_regras(chave,funcao,descricao,moedas,pontos,teto,entrega,ativa,por_complexidade) VALUES
 ('meta_semanal_130',NULL,'Meta da semana: 130% ou mais',60,80,NULL,false,true,false),
 ('meta_semanal_160',NULL,'Meta da semana: 160% ou mais',100,120,NULL,false,true,false),
 ('acao_painel',NULL,'Ação no painel (até 10 por dia)',1,1,10,false,true,false)
ON CONFLICT (chave) DO UPDATE SET moedas=EXCLUDED.moedas, pontos=EXCLUDED.pontos, teto=EXCLUDED.teto, descricao=EXCLUDED.descricao, ativa=true;

-- Parâmetros da economia que não são regra de ganho.
CREATE TABLE IF NOT EXISTS vybe_escritorio_parametros (chave text PRIMARY KEY, valor numeric NOT NULL, descricao text NOT NULL);
INSERT INTO vybe_escritorio_parametros VALUES
 ('teto_semana',600,'Acima destas moedas na semana, cada moeda conta metade')
ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor, descricao=EXCLUDED.descricao;

-- Pesos, preços e skins.
UPDATE vybe_escritorio_complexidade c SET peso=v.peso FROM (VALUES
 ('fotografia',0.6),('reels',2),('video',2),('motion',2.5),('impresso',4)
) AS v(chave,peso) WHERE c.chave=v.chave;
UPDATE vybe_escritorio_raridades r SET preco=v.preco FROM (VALUES
 ('comum',10),('incomum',20),('raro',40),('epico',100),('lendario',250)
) AS v(chave,preco) WHERE r.chave=v.chave;
UPDATE vybe_escritorio_kits SET desconto=0.20 WHERE chave LIKE 'visual-%';

-- Lançamento: penalidade tira até o que houver (moeda e XP); ganho acima do
-- teto da semana conta metade.
CREATE OR REPLACE FUNCTION vybe_lancar_pontos(p bigint, origem_evento text, regra_chave text, conteudo bigint, moedas integer, pontos integer)
 RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE recibo bigint; atual integer; xp_atual integer; aplicado integer; aplicado_xp integer; teto numeric; semana date; soma integer;
 quando timestamptz := COALESCE(NULLIF(current_setting('vybe.em', true), '')::timestamptz, now());
BEGIN
 INSERT INTO vybe_escritorio_carteiras(pessoa_id) VALUES(p) ON CONFLICT DO NOTHING;
 SELECT saldo, xp INTO atual, xp_atual FROM vybe_escritorio_carteiras WHERE pessoa_id=p FOR UPDATE;
 aplicado := CASE WHEN moedas < 0 THEN GREATEST(moedas,-atual) ELSE moedas END;
 aplicado_xp := CASE WHEN pontos < 0 THEN GREATEST(pontos,-xp_atual) ELSE pontos END;
 IF regra_chave IS NOT NULL AND moedas > 0 THEN
  SELECT valor INTO teto FROM vybe_escritorio_parametros WHERE chave='teto_semana';
  IF teto IS NOT NULL THEN
   semana := date_trunc('week', vybe_dia_bahia(quando))::date;
   SELECT COALESCE(sum(quantidade),0) INTO soma FROM vybe_escritorio_moedas
    WHERE pessoa_id=p AND regra IS NOT NULL AND quantidade > 0
      AND criado_em >= (semana::timestamp AT TIME ZONE 'America/Bahia') AND criado_em < ((semana + 7)::timestamp AT TIME ZONE 'America/Bahia');
   IF soma >= teto THEN aplicado := ceil(moedas / 2.0);
   ELSIF soma + moedas > teto THEN aplicado := (teto - soma) + ceil((soma + moedas - teto) / 2.0);
   END IF;
  END IF;
 END IF;
 INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade,pontos,regra,conteudo_id,criado_em) VALUES(p,origem_evento,aplicado,aplicado_xp,regra_chave,conteudo,quando)
 ON CONFLICT DO NOTHING RETURNING id INTO recibo;
 IF recibo IS NULL THEN RETURN false; END IF;
 UPDATE vybe_escritorio_carteiras SET saldo=saldo+aplicado, xp=xp+aplicado_xp WHERE pessoa_id=p;
 RETURN true;
END $$;

-- Ação no painel: cada evento com autor, até o teto do dia.
CREATE OR REPLACE FUNCTION vybe_pontuar_acao(ev vybe_conteudo_eventos) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r vybe_escritorio_regras; dia date; feitas int;
BEGIN
 IF ev.autor_id IS NULL THEN RETURN; END IF;
 SELECT * INTO r FROM vybe_escritorio_regras WHERE chave='acao_painel' AND ativa;
 IF r.chave IS NULL THEN RETURN; END IF;
 dia := vybe_dia_bahia(COALESCE(ev.em,now()));
 SELECT count(*) INTO feitas FROM vybe_escritorio_moedas WHERE pessoa_id=ev.autor_id AND regra='acao_painel' AND origem LIKE 'acao:'||dia||':%';
 IF feitas >= COALESCE(r.teto, 2147483647) THEN RETURN; END IF;
 PERFORM vybe_aplicar_regra(ev.autor_id,'acao_painel','acao:'||dia||':'||ev.id,NULL,dia);
END $$;
CREATE OR REPLACE FUNCTION vybe_pontuar_evento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM vybe_pontuar_linha(NEW);
 PERFORM vybe_pontuar_acao(NEW);
 RETURN NEW;
END $$;

-- Quem postou recebe a parte dele, de qualquer função; quem fez fica com o
-- valor inteiro e o DA ganha a parte dele por cima (não sai de quem fez).
DO $$
DECLARE f text;
BEGIN
 SELECT pg_get_functiondef('vybe_pontuar_linha(vybe_conteudo_eventos)'::regprocedure) INTO f;
 IF position('AND autor_funcao=''agendamento'' THEN' IN f) = 0 THEN RAISE EXCEPTION 'vybe_pontuar_linha mudou: confira quem posta antes de aplicar.'; END IF;
 EXECUTE replace(f, 'AND autor_funcao=''agendamento'' THEN', 'AND ev.autor_id IS NOT NULL THEN');
 SELECT pg_get_functiondef('vybe_pagar_bolo(bigint,date,bigint)'::regprocedure) INTO f;
 IF position('parte_exec := 1 - COALESCE(vybe_parte_do_da(c.id), 0);' IN f) = 0 OR position(',1 - parte_exec);' IN f) = 0 THEN
  RAISE EXCEPTION 'vybe_pagar_bolo mudou: confira a parte do DA antes de aplicar.';
 END IF;
 f := replace(f, 'parte_exec := 1 - COALESCE(vybe_parte_do_da(c.id), 0);', 'parte_exec := 1;');
 EXECUTE replace(f, ',1 - parte_exec);', ',vybe_parte_do_da(c.id));');
END $$;

-- O histórico pela regra nova, uma vez só.
DO $$
DECLARE ev vybe_conteudo_eventos;
 refeitas text[] := ARRAY['peca_criacao','peca_da','peca_producao','peca_atendimento','peca_agendamento','peca_gestao',
  'entrega_prazo','criacao_aprovada','criacao_alteracao','cadastro','briefing','acao_painel'];
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='valor-papel-2026-10-21') THEN
  RAISE NOTICE 'Valor por papel já aplicado; nenhuma alteração.';
  RETURN;
 END IF;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_papel_moedas AS SELECT * FROM vybe_escritorio_moedas;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_papel_carteiras AS SELECT * FROM vybe_escritorio_carteiras;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_papel_entregas AS SELECT * FROM vybe_escritorio_entregas;
 DELETE FROM vybe_escritorio_moedas WHERE regra = ANY(refeitas);
 DELETE FROM vybe_escritorio_entregas WHERE regra = ANY(refeitas);
 -- Fechamentos de dia e de semana: o valor novo da regra.
 UPDATE vybe_escritorio_moedas m SET quantidade=r.moedas, pontos=r.pontos FROM vybe_escritorio_regras r
  WHERE m.regra=r.chave AND m.regra IN ('dia_ativo','dia_sem_vencida','dia_vencida','dia_agendamento','dia_sem_furo','meta_semanal');
 -- Carteira de partida: o que ficou no razão.
 UPDATE vybe_escritorio_carteiras c SET saldo=GREATEST(0,COALESCE(s.m,0)), xp=GREATEST(0,COALESCE(s.x,0))
  FROM (SELECT p.pessoa_id, sum(m.quantidade)::int m, sum(m.pontos)::int x FROM vybe_escritorio_carteiras p
   LEFT JOIN vybe_escritorio_moedas m ON m.pessoa_id=p.pessoa_id GROUP BY 1) s WHERE s.pessoa_id=c.pessoa_id;
 FOR ev IN SELECT * FROM vybe_conteudo_eventos ORDER BY em, id LOOP
  PERFORM set_config('vybe.em', ev.em::text, true);
  PERFORM vybe_pontuar_linha(ev);
  PERFORM vybe_pontuar_acao(ev);
 END LOOP;
 PERFORM set_config('vybe.em', '', true);
 -- Saldo e XP = soma do razão, nunca abaixo de zero; o ajuste explica a diferença.
 UPDATE vybe_escritorio_carteiras c SET saldo=GREATEST(0,s.m), xp=GREATEST(0,s.x)
  FROM (SELECT pessoa_id, sum(quantidade)::int m, sum(pontos)::int x FROM vybe_escritorio_moedas GROUP BY 1) s WHERE s.pessoa_id=c.pessoa_id;
 INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade,pontos)
  SELECT c.pessoa_id, 'ajuste:valor-papel-2026-10-21', c.saldo - s.m, c.xp - s.x
  FROM vybe_escritorio_carteiras c JOIN (SELECT pessoa_id, sum(quantidade)::int m, sum(pontos)::int x FROM vybe_escritorio_moedas GROUP BY 1) s ON s.pessoa_id=c.pessoa_id
  WHERE c.saldo <> s.m OR c.xp <> s.x;
 INSERT INTO vybe_escritorio_reinicios(chave) VALUES('valor-papel-2026-10-21');
END $$;
COMMIT;
