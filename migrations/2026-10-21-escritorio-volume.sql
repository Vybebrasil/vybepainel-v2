-- Economia pelo volume (decisões do Paulo, 21/10/2026):
-- "tem que continuar com a fatia, só dividir melhor"; "todos poderem ter poder
-- de compra: o que vai contar para ser level mais alto e ter mais dinheiro é o
-- VOLUME que cada um faz"; "a cada 1 a 3 demandas compra 1 item comum e algo
-- lendário em torno de 50 demandas"; os heads (Atendimento) não ficam abaixo
-- da Produção; quem posta a peça ganha a fatia do agendamento; voltar para
-- alteração e dia com demanda vencida tiram moeda e XP; dia com ação no
-- painel e cada ação no painel dão moeda.
--
-- 1. Fatias (o bolo continua: 10 moedas e 20 XP por ponto de peso):
--      tipo     Criação Produção Atendimento Agendamento Gestão
--      normal     48%      —        26%         15%       11%
--      foto       52%      8%       20%         11%        9%
--      vídeo      42%     16%       22%         11%        9%
--    A fatia do Agendamento vai para quem posta (agenda ou finaliza), de
--    qualquer função.
-- 2. Preço em demandas (uma demanda da Criação ≈ 7 moedas):
--      comum 2 (15), incomum 5 (35), raro 12 (85), épico 25 (175), lendário 50 (350).
--    Skin completa com 20% de desconto sobre a soma das peças.
-- 3. Penalidades com XP: voltou para alteração −2 moedas e −5 XP; dia com
--    demanda vencida −3 moedas e −5 XP. O XP nunca fica abaixo de zero (o
--    nível pode descer).
-- 4. Dia com ação no painel: +2 moedas e +2 XP. Cada ação no painel (troca de
--    status, campo, comentário, cadastro): +1 moeda e +1 XP, até 10 por dia.
-- Só eventos daqui para a frente; saldos e XP de hoje não mudam.
-- Depende de 2026-10-20-escritorio-bolo-producao.sql (fatias por tipo).
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vybe_escritorio_fatias' AND column_name='tipo') THEN
  RAISE EXCEPTION 'Aplique antes 2026-10-20-escritorio-bolo-producao.sql (fatias por tipo).';
 END IF;
END $$;

-- 1. Fatias.
INSERT INTO vybe_escritorio_fatias(papel,captada,tipo,fatia) VALUES
 ('criacao',false,'normal',.48),('producao',false,'normal',0),('atendimento',false,'normal',.26),('agendamento',false,'normal',.15),('gestao',false,'normal',.11),
 ('criacao',true,'foto',.52),('producao',true,'foto',.08),('atendimento',true,'foto',.20),('agendamento',true,'foto',.11),('gestao',true,'foto',.09),
 ('criacao',true,'video',.42),('producao',true,'video',.16),('atendimento',true,'video',.22),('agendamento',true,'video',.11),('gestao',true,'video',.09)
ON CONFLICT (papel,tipo) DO UPDATE SET fatia=EXCLUDED.fatia;
UPDATE vybe_escritorio_regras SET funcao=NULL, descricao='Peça agendada ou finalizada por você (parte de quem posta)' WHERE chave='peca_agendamento';

-- 2. Preços e skins.
UPDATE vybe_escritorio_raridades r SET preco=v.preco FROM (VALUES
 ('comum',15),('incomum',35),('raro',85),('epico',175),('lendario',350)
) AS v(chave,preco) WHERE r.chave=v.chave;
UPDATE vybe_escritorio_kits SET desconto=0.20 WHERE chave LIKE 'visual-%';

-- 3 e 4. Regras.
-- A regra "XP nunca cai" (17/10) muda: penalidade pode tirar XP; a carteira
-- continua com XP >= 0.
ALTER TABLE vybe_escritorio_regras DROP CONSTRAINT IF EXISTS vybe_escritorio_regras_pontos_check;
ALTER TABLE vybe_escritorio_moedas DROP CONSTRAINT IF EXISTS vybe_escritorio_moedas_pontos_check;
UPDATE vybe_escritorio_regras SET moedas=-2, pontos=-5 WHERE chave='criacao_alteracao';
UPDATE vybe_escritorio_regras SET moedas=-3, pontos=-5 WHERE chave='dia_vencida';
UPDATE vybe_escritorio_regras SET moedas=2, pontos=2 WHERE chave='dia_ativo';
INSERT INTO vybe_escritorio_regras(chave,funcao,descricao,moedas,pontos,teto,entrega,ativa,por_complexidade) VALUES
 ('acao_painel',NULL,'Ação no painel (até 10 por dia)',1,1,10,false,true,false)
ON CONFLICT (chave) DO UPDATE SET moedas=EXCLUDED.moedas, pontos=EXCLUDED.pontos, teto=EXCLUDED.teto, descricao=EXCLUDED.descricao, ativa=true;

-- XP também pode cair (penalidades), nunca abaixo de zero.
CREATE OR REPLACE FUNCTION vybe_lancar_pontos(p bigint, origem_evento text, regra_chave text, conteudo bigint, moedas integer, pontos integer)
 RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE recibo bigint; atual integer; xp_atual integer; aplicado integer; aplicado_xp integer;
 quando timestamptz := COALESCE(NULLIF(current_setting('vybe.em', true), '')::timestamptz, now());
BEGIN
 INSERT INTO vybe_escritorio_carteiras(pessoa_id) VALUES(p) ON CONFLICT DO NOTHING;
 SELECT saldo, xp INTO atual, xp_atual FROM vybe_escritorio_carteiras WHERE pessoa_id=p FOR UPDATE;
 aplicado := CASE WHEN moedas < 0 THEN GREATEST(moedas,-atual) ELSE moedas END;
 aplicado_xp := CASE WHEN pontos < 0 THEN GREATEST(pontos,-xp_atual) ELSE pontos END;
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

-- Quem posta (agenda ou finaliza) recebe a fatia do Agendamento, de qualquer função.
DO $$
DECLARE f text;
BEGIN
 SELECT pg_get_functiondef('vybe_pontuar_linha(vybe_conteudo_eventos)'::regprocedure) INTO f;
 IF position('AND autor_funcao=''agendamento'' THEN' IN f) = 0 THEN
  RAISE EXCEPTION 'vybe_pontuar_linha mudou: confira a regra de quem agenda antes de aplicar.';
 END IF;
 f := replace(f, 'AND autor_funcao=''agendamento'' THEN', 'AND ev.autor_id IS NOT NULL THEN');
 EXECUTE f;
END $$;
COMMIT;
