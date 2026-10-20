-- Bolo por peça (decisão do Paulo, 20/10/2026). Cada peça concluída gera um
-- bolo de moedas e XP do tamanho do formato (peso de vybe_escritorio_complexidade)
-- e o bolo é dividido por quem trabalhou nela, pelas fatias da tabela
-- vybe_escritorio_fatias:
--   foto, reels e vídeo (captados): Produção 25%, Criação 53%, Atendimento 10%,
--     Agendamento 10%, Gestão 2%;
--   as demais peças: Criação 70%, Atendimento 15%, Agendamento 12%, Gestão 3%.
-- A Gestão leva pouco de cada peça; quem cadastra a demanda (e escreve o
-- briefing) ganha por isso, seja quem for (Paulo, 20/10/2026).
-- Toda foto e todo vídeo é do Mizinho (Produção), mesmo sem o evento de
-- captação. O DA (Deivid) que aprova a peça de outra pessoa fica com 10% da
-- fatia da Criação; quem executou fica com o resto. Quem fez é quem está como
-- responsável da peça no log.
-- Depois, uma vez só (marcador bolo-2026-10-20): moedas, XP, conquistas e os
-- móveis de conquista recomeçam do zero e o histórico inteiro do log é
-- refeito pela regra nova. O que era antes de 17/10 paga o XP inteiro e só
-- uma parte das moedas (regra "historico"). Cópia de tudo antes de limpar.
-- Revisar e aplicar explicitamente.
BEGIN;
LOCK TABLE vybe_conteudo_eventos IN SHARE ROW EXCLUSIVE MODE;

-- Quem é o DA (aprova como direção de arte).
ALTER TABLE vybe_escritorio_funcoes ADD COLUMN IF NOT EXISTS direcao_arte boolean NOT NULL DEFAULT false;
UPDATE vybe_escritorio_funcoes f SET direcao_arte=true FROM vybe_pessoas p
 WHERE p.id=f.pessoa_id AND p.nome ILIKE 'Deivid%' AND f.funcao='criacao';

-- Formatos captados (foto e vídeo): a Produção entra no bolo.
ALTER TABLE vybe_escritorio_complexidade ADD COLUMN IF NOT EXISTS captada boolean NOT NULL DEFAULT false;
UPDATE vybe_escritorio_complexidade SET captada = chave IN ('fotografia','reels','video');

CREATE TABLE IF NOT EXISTS vybe_escritorio_fatias (
 papel text NOT NULL CHECK (papel IN ('producao','criacao','direcao_arte','atendimento','agendamento','gestao')),
 captada boolean NOT NULL,
 fatia numeric(4,3) NOT NULL CHECK (fatia >= 0 AND fatia <= 1),
 PRIMARY KEY (papel, captada)
);
-- direcao_arte é a parte da fatia da Criação que vai para o DA.
INSERT INTO vybe_escritorio_fatias(papel,captada,fatia) VALUES
 ('producao',true,.25),('criacao',true,.53),('atendimento',true,.10),('agendamento',true,.10),('gestao',true,.02),
 ('producao',false,0),('criacao',false,.70),('atendimento',false,.15),('agendamento',false,.12),('gestao',false,.03),
 ('direcao_arte',true,.10),('direcao_arte',false,.10)
ON CONFLICT (papel,captada) DO NOTHING;

-- O bolo: moedas e XP por ponto de peso (uma peça de peso 1 inteira).
INSERT INTO vybe_escritorio_regras(chave,funcao,descricao,moedas,pontos,teto,entrega,ativa,por_complexidade) VALUES
 ('peca_criacao',NULL,'Peça feita por você (parte da Criação)',10,20,NULL,true,true,true),
 ('peca_da','criacao','Peça aprovada como DA (10% da parte da Criação)',10,20,NULL,true,true,true),
 ('peca_producao','producao','Foto ou vídeo captado (parte da Produção)',10,20,NULL,true,true,true),
 ('peca_atendimento','atendimento','Peça de cliente da sua carteira (parte do Atendimento)',10,20,NULL,true,true,true),
 ('peca_agendamento','agendamento','Peça agendada (parte do Agendamento)',10,20,NULL,true,true,true),
 ('peca_gestao','gestao','Peça da agência (parte da Gestão)',10,20,NULL,true,true,true),
 -- Percentuais do histórico de antes de 17/10: moedas 20%, XP 100%.
 ('historico',NULL,'Peças de antes de 17/10 (parte das moedas)',20,100,NULL,false,true,false)
ON CONFLICT (chave) DO NOTHING;
-- Cadastrar a demanda e escrever o briefing pagam quem fez, de qualquer função.
INSERT INTO vybe_escritorio_regras(chave,funcao,descricao,moedas,pontos,teto,entrega,ativa,por_complexidade) VALUES
 ('cadastro',NULL,'Demanda cadastrada',1,2,NULL,false,true,false)
ON CONFLICT (chave) DO NOTHING;
UPDATE vybe_escritorio_regras SET funcao=NULL, moedas=1, pontos=2, descricao='Briefing escrito no cadastro', entrega=true WHERE chave='briefing';
-- As regras antigas por função saem: o bolo paga cada uma delas.
UPDATE vybe_escritorio_regras SET ativa=false
 WHERE chave IN ('entrega','criacao_aprovacao','captacao','carteira','agendamento','agencia','chegada');

-- O razão aceita a data do evento quando o histórico é refeito.
CREATE OR REPLACE FUNCTION vybe_lancar_pontos(p bigint, origem_evento text, regra_chave text, conteudo bigint, moedas integer, pontos integer)
 RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE recibo bigint; atual integer; aplicado integer;
 quando timestamptz := COALESCE(NULLIF(current_setting('vybe.em', true), '')::timestamptz, now());
BEGIN
 INSERT INTO vybe_escritorio_carteiras(pessoa_id) VALUES(p) ON CONFLICT DO NOTHING;
 SELECT saldo INTO atual FROM vybe_escritorio_carteiras WHERE pessoa_id=p FOR UPDATE;
 aplicado := CASE WHEN moedas < 0 THEN GREATEST(moedas,-atual) ELSE moedas END;
 INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade,pontos,regra,conteudo_id,criado_em) VALUES(p,origem_evento,aplicado,pontos,regra_chave,conteudo,quando)
 ON CONFLICT DO NOTHING RETURNING id INTO recibo;
 IF recibo IS NULL THEN RETURN false; END IF;
 UPDATE vybe_escritorio_carteiras SET saldo=saldo+aplicado, xp=xp+pontos WHERE pessoa_id=p;
 RETURN true;
END $$;

-- As outras regras (bônus de prazo, aprovada de primeira, alteração) seguem a
-- mesma parte do histórico nas peças de antes de 17/10.
CREATE OR REPLACE FUNCTION vybe_aplicar_regra(p bigint, regra_chave text, origem_evento text, conteudo bigint, dia date)
 RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r vybe_escritorio_regras; h vybe_escritorio_regras; ok boolean; peso numeric := 1; fm numeric := 1; fx numeric := 1;
BEGIN
 IF p IS NULL THEN RETURN false; END IF;
 SELECT * INTO r FROM vybe_escritorio_regras WHERE chave=regra_chave AND ativa;
 IF r.chave IS NULL THEN RETURN false; END IF;
 IF r.funcao IS NOT NULL AND NOT EXISTS(SELECT 1 FROM vybe_escritorio_funcoes f WHERE f.pessoa_id=p AND f.funcao=r.funcao) THEN RETURN false; END IF;
 IF r.por_complexidade AND conteudo IS NOT NULL THEN peso := COALESCE(vybe_peso_conteudo(conteudo), 1); END IF;
 IF conteudo IS NOT NULL AND dia < DATE '2026-10-17' THEN
  SELECT * INTO h FROM vybe_escritorio_regras WHERE chave='historico' AND ativa;
  IF h.chave IS NOT NULL THEN fm := h.moedas / 100.0; fx := h.pontos / 100.0; END IF;
 END IF;
 ok := vybe_lancar_pontos(p,origem_evento,r.chave,conteudo,round(r.moedas*peso*fm)::int,round(r.pontos*peso*fx)::int);
 IF ok AND r.entrega THEN
  INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia) VALUES(p,origem_evento,r.chave,conteudo,dia) ON CONFLICT DO NOTHING;
 END IF;
 RETURN ok;
END $$;

-- Foto ou vídeo: pelo formato, ou porque houve captação/material bruto.
CREATE OR REPLACE FUNCTION vybe_peca_captada(conteudo bigint) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(
  SELECT 1 FROM vybe_conteudos v CROSS JOIN LATERAL unnest(string_to_array(v.formato, ',')) AS f(parte)
  JOIN vybe_escritorio_complexidade c ON c.chave = vybe_formato_chave(f.parte) AND c.captada
  WHERE v.id = conteudo)
 OR EXISTS(SELECT 1 FROM vybe_conteudo_eventos e WHERE e.conteudo_id = conteudo
  AND ((e.tipo='captacao' AND e.para ILIKE 'capta%feita') OR (e.tipo='material_bruto' AND e.para IS NOT NULL)))
$$;

-- Paga a fatia de uma pessoa na peça: bolo × peso × fatia × parte (a divisão
-- entre quem divide o mesmo papel). Antes de 17/10, só a parte "historico".
CREATE OR REPLACE FUNCTION vybe_pagar_fatia(p bigint, regra_chave text, origem_evento text, conteudo bigint, dia date, parte numeric)
 RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r vybe_escritorio_regras; h vybe_escritorio_regras; v_papel text; fat numeric; peso numeric; fm numeric := 1; fx numeric := 1; ok boolean;
BEGIN
 IF p IS NULL OR parte IS NULL OR parte <= 0 THEN RETURN false; END IF;
 SELECT * INTO r FROM vybe_escritorio_regras WHERE chave=regra_chave AND ativa;
 IF r.chave IS NULL THEN RETURN false; END IF;
 IF r.funcao IS NOT NULL AND NOT EXISTS(SELECT 1 FROM vybe_escritorio_funcoes f WHERE f.pessoa_id=p AND f.funcao=r.funcao) THEN RETURN false; END IF;
 v_papel := CASE regra_chave WHEN 'peca_da' THEN 'criacao' ELSE substr(regra_chave, 6) END;
 SELECT fatia INTO fat FROM vybe_escritorio_fatias WHERE papel=v_papel AND captada=vybe_peca_captada(conteudo);
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

-- O bolo da peça na conclusão (Produção aprovada/agendada/finalizada,
-- Solicitações finalizada): Criação (+DA), Produção, Atendimento e Gestão.
-- O Agendamento recebe a parte dele quando agenda. Origem única por papel:
-- chegar de novo à conclusão não paga outra vez.
CREATE OR REPLACE FUNCTION vybe_pagar_bolo(conteudo bigint, dia date, autor bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c record; executores bigint[]; da bigint; n int; pessoa bigint; parte_exec numeric := 1; no_prazo boolean;
BEGIN
 SELECT id,board_id,prazo INTO c FROM vybe_conteudos WHERE id=conteudo;
 IF c.id IS NULL THEN RETURN; END IF;
 no_prazo := c.prazo IS NOT NULL AND dia <= c.prazo;
 -- Quem fez: responsáveis da Criação (Produção) ou todos os responsáveis
 -- (Solicitações). Sem nenhum, quem concluiu, se for da Criação.
 IF c.board_id=8385559107 THEN
  SELECT array_agg(DISTINCT r.pessoa_id ORDER BY r.pessoa_id) INTO executores FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id=c.id;
 ELSE
  SELECT array_agg(DISTINCT r.pessoa_id ORDER BY r.pessoa_id) INTO executores FROM vybe_conteudo_responsaveis r
   JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE r.conteudo_id=c.id;
  -- Quem mandou para aprovação, se for da Criação.
  IF executores IS NULL THEN
   SELECT array_agg(DISTINCT e.autor_id) INTO executores FROM vybe_conteudo_eventos e JOIN vybe_escritorio_funcoes f ON f.pessoa_id=e.autor_id AND f.funcao='criacao'
    WHERE e.conteudo_id=c.id AND e.tipo='status' AND e.para ILIKE 'para aprova%';
  END IF;
  IF executores IS NULL AND EXISTS(SELECT 1 FROM vybe_escritorio_funcoes f WHERE f.pessoa_id=autor AND f.funcao='criacao') THEN executores := ARRAY[autor]; END IF;
  -- DA: quem tirou a peça de "Para aprovação" para "Para agendar" e não a fez.
  SELECT e.autor_id INTO da FROM vybe_conteudo_eventos e JOIN vybe_escritorio_funcoes f ON f.pessoa_id=e.autor_id AND f.direcao_arte
   WHERE e.conteudo_id=c.id AND e.tipo='status' AND e.de ILIKE 'para aprova%' AND lower(trim(e.para))='para agendar'
     AND NOT (e.autor_id = ANY(COALESCE(executores, ARRAY[]::bigint[])))
   ORDER BY e.em, e.id LIMIT 1;
  IF da IS NOT NULL THEN
   parte_exec := 1 - COALESCE((SELECT fatia FROM vybe_escritorio_fatias WHERE papel='direcao_arte' AND captada=vybe_peca_captada(c.id)), 0);
   PERFORM vybe_pagar_fatia(da,'peca_da','peca:'||c.id||':da',c.id,dia,1 - parte_exec);
  END IF;
 END IF;
 n := COALESCE(array_length(executores,1),0);
 IF n > 0 THEN
  FOREACH pessoa IN ARRAY executores LOOP
   PERFORM vybe_pagar_fatia(pessoa,'peca_criacao','peca:'||c.id||':criacao',c.id,dia,parte_exec/n);
   IF no_prazo THEN PERFORM vybe_aplicar_regra(pessoa,'entrega_prazo','prazo:'||c.id,c.id,dia); END IF;
  END LOOP;
 END IF;
 -- Produção: toda foto e todo vídeo.
 SELECT count(*) INTO n FROM vybe_escritorio_funcoes WHERE funcao='producao';
 FOR pessoa IN SELECT pessoa_id FROM vybe_escritorio_funcoes WHERE funcao='producao' ORDER BY 1 LOOP
  PERFORM vybe_pagar_fatia(pessoa,'peca_producao','peca:'||c.id||':producao',c.id,dia,1.0/n);
 END LOOP;
 -- Atendimento: heads da carteira dos clientes da peça.
 SELECT count(DISTINCT f.pessoa_id) INTO n FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id=cc.cliente_id
  JOIN vybe_escritorio_funcoes f ON f.funcao='atendimento' AND f.carteira IS NOT NULL AND lower(f.carteira)=lower(trim(COALESCE(cl.responsavel,'')))
  WHERE cc.conteudo_id=c.id;
 FOR pessoa IN SELECT DISTINCT f.pessoa_id FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id=cc.cliente_id
  JOIN vybe_escritorio_funcoes f ON f.funcao='atendimento' AND f.carteira IS NOT NULL AND lower(f.carteira)=lower(trim(COALESCE(cl.responsavel,'')))
  WHERE cc.conteudo_id=c.id ORDER BY 1 LOOP
  PERFORM vybe_pagar_fatia(pessoa,'peca_atendimento','peca:'||c.id||':atendimento',c.id,dia,1.0/n);
 END LOOP;
 -- Gestão.
 SELECT count(*) INTO n FROM vybe_escritorio_funcoes WHERE funcao='gestao';
 FOR pessoa IN SELECT pessoa_id FROM vybe_escritorio_funcoes WHERE funcao='gestao' ORDER BY 1 LOOP
  PERFORM vybe_pagar_fatia(pessoa,'peca_gestao','peca:'||c.id||':gestao',c.id,dia,1.0/n);
 END LOOP;
END $$;

-- O que cada evento do log paga. O gatilho chama esta função; o histórico
-- é refeito chamando-a evento a evento, na ordem.
CREATE OR REPLACE FUNCTION vybe_pontuar_linha(ev vybe_conteudo_eventos) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c record; executor bigint; para text; de text; dia date; autor_funcao text;
BEGIN
 SELECT id,board_id,prazo,briefing INTO c FROM vybe_conteudos WHERE id=ev.conteudo_id;
 IF c.id IS NULL THEN RETURN; END IF;
 para := lower(trim(COALESCE(ev.para,''))); de := lower(trim(COALESCE(ev.de,'')));
 dia := vybe_dia_bahia(COALESCE(ev.em,now()));
 SELECT funcao INTO autor_funcao FROM vybe_escritorio_funcoes WHERE pessoa_id=ev.autor_id;
 IF ev.tipo = 'status' THEN
  -- Conclusão: o bolo da peça.
  IF (c.board_id=8385559107 AND para IN ('finalizado','feito'))
   OR (c.board_id=7829537690 AND para IN ('para agendar','agendado','finalizado')) THEN
   PERFORM vybe_pagar_bolo(c.id,dia,ev.autor_id);
  END IF;
  -- Bônus: aprovada sem nunca ter voltado para alteração.
  IF c.board_id=7829537690 AND para='para agendar'
   AND NOT EXISTS(SELECT 1 FROM vybe_conteudo_eventos a WHERE a.conteudo_id=c.id AND a.tipo='status' AND a.para ILIKE 'altera%' AND a.id<>ev.id AND (a.em,a.id) < (ev.em,ev.id)) THEN
   FOR executor IN SELECT r.pessoa_id FROM vybe_conteudo_responsaveis r JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE r.conteudo_id=c.id ORDER BY 1 LOOP
    PERFORM vybe_aplicar_regra(executor,'criacao_aprovada','aprovada:'||c.id,c.id,dia);
   END LOOP;
  END IF;
  -- Voltou para alteração (no máximo uma vez por peça por dia).
  IF para ILIKE 'altera%' THEN
   FOR executor IN SELECT r.pessoa_id FROM vybe_conteudo_responsaveis r JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE r.conteudo_id=c.id ORDER BY 1 LOOP
    PERFORM vybe_aplicar_regra(executor,'criacao_alteracao','alteracao:'||c.id||':'||dia,c.id,dia);
   END LOOP;
  END IF;
  -- Agendou: a parte do Agendamento, para quem agendou.
  IF para IN ('agendado','finalizado') AND de IN ('para agendar','agendado') AND autor_funcao='agendamento' THEN
   PERFORM vybe_pagar_fatia(ev.autor_id,'peca_agendamento','peca:'||c.id||':agendamento',c.id,dia,1);
  END IF;
 ELSIF (ev.tipo='captacao' AND para ILIKE 'capta%feita') OR (ev.tipo='material_bruto' AND ev.para IS NOT NULL) THEN
  -- Captação feita: a Produção recebe já (a mesma origem do bolo: não paga duas vezes).
  FOR executor IN SELECT pessoa_id FROM vybe_escritorio_funcoes WHERE funcao='producao' ORDER BY 1 LOOP
   PERFORM vybe_pagar_fatia(executor,'peca_producao','peca:'||c.id||':producao',c.id,dia,1.0/(SELECT count(*) FROM vybe_escritorio_funcoes WHERE funcao='producao'));
  END LOOP;
 ELSIF ev.tipo='criacao' THEN
  -- Quem cadastrou a demanda; com briefing, ganha também por ele.
  PERFORM vybe_aplicar_regra(ev.autor_id,'cadastro','cadastro:'||c.id,c.id,dia);
  IF NULLIF(trim(COALESCE(c.briefing,'')),'') IS NOT NULL THEN
   PERFORM vybe_aplicar_regra(ev.autor_id,'briefing','briefing:'||c.id,c.id,dia);
  END IF;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION vybe_pontuar_evento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM vybe_pontuar_linha(NEW);
 RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS vybe_escritorio_reinicios (
 chave text PRIMARY KEY, executado_em timestamptz NOT NULL DEFAULT now()
);
DO $$
DECLARE ev vybe_conteudo_eventos;
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='bolo-2026-10-20') THEN
  RAISE NOTICE 'Bolo por peça já aplicado; nenhuma alteração.';
  RETURN;
 END IF;
 -- Cópia de tudo o que vai ser limpo.
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_bolo_moedas AS SELECT * FROM vybe_escritorio_moedas;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_bolo_carteiras AS SELECT * FROM vybe_escritorio_carteiras;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_bolo_entregas AS SELECT * FROM vybe_escritorio_entregas;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_bolo_marcos AS SELECT * FROM vybe_escritorio_marcos;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_bolo_inventario AS SELECT * FROM vybe_escritorio_inventario;
 CREATE TABLE IF NOT EXISTS vybe_escritorio_copia_bolo_fechamentos AS SELECT * FROM vybe_escritorio_fechamentos;
 -- Recomeço: moedas, XP, conquistas e móveis de conquista. Os móveis
 -- comprados continuam no inventário.
 DELETE FROM vybe_escritorio_moedas;
 DELETE FROM vybe_escritorio_entregas;
 DELETE FROM vybe_escritorio_marcos;
 DELETE FROM vybe_escritorio_fechamentos;
 DELETE FROM vybe_escritorio_inventario i USING vybe_escritorio_catalogo c WHERE c.classe=i.classe AND c.marco IS NOT NULL;
 UPDATE vybe_escritorio_carteiras SET saldo=0, xp=0;
 -- O histórico inteiro do log pela regra nova, na ordem, com a data de cada evento.
 FOR ev IN SELECT * FROM vybe_conteudo_eventos ORDER BY em, id LOOP
  PERFORM set_config('vybe.em', ev.em::text, true);
  PERFORM vybe_pontuar_linha(ev);
 END LOOP;
 PERFORM set_config('vybe.em', '', true);
 INSERT INTO vybe_escritorio_reinicios(chave) VALUES('bolo-2026-10-20');
END $$;
COMMIT;
