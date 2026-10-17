-- Pontos (XP) e VybeCoins por função. Revisar e aplicar explicitamente.
-- Plano e valores: docs/escritorio-pontos.md. As regras ficam em tabela.
BEGIN;
-- Quem é o quê. A carteira de Atendimento é o mesmo texto de vybe_clientes.responsavel.
CREATE TABLE IF NOT EXISTS vybe_escritorio_funcoes (
 pessoa_id bigint PRIMARY KEY REFERENCES vybe_pessoas(id),
 funcao text NOT NULL CHECK (funcao IN ('criacao','atendimento','agendamento','producao','gestao')),
 carteira text
);
INSERT INTO vybe_escritorio_funcoes(pessoa_id,funcao,carteira)
 SELECT p.id,f.funcao,f.carteira FROM (VALUES
  ('68036697','criacao',NULL),('68997024','criacao',NULL),('71130408','criacao',NULL),('100482777','criacao',NULL),
  ('68035653','atendimento','Vinícius'),('68036687','atendimento','Ewerton'),
  ('80146924','agendamento',NULL),('78158742','producao',NULL),('68035537','gestao',NULL)) AS f(monday,funcao,carteira)
 JOIN vybe_pessoas p ON p.monday_user_id=f.monday
 ON CONFLICT (pessoa_id) DO NOTHING;
-- Regras: moedas podem ser negativas (perda); pontos (XP) nunca. `entrega` marca
-- o que conta para a meta semanal da função. `teto` limita o total (chegada).
CREATE TABLE IF NOT EXISTS vybe_escritorio_regras (
 chave text PRIMARY KEY, funcao text CHECK (funcao IN ('criacao','atendimento','agendamento','producao','gestao')),
 descricao text NOT NULL, moedas integer NOT NULL, pontos integer NOT NULL CHECK (pontos >= 0),
 teto integer, entrega boolean NOT NULL DEFAULT false, ativa boolean NOT NULL DEFAULT true
);
INSERT INTO vybe_escritorio_regras(chave,funcao,descricao,moedas,pontos,teto,entrega) VALUES
 ('entrega',NULL,'Demanda de Solicitações finalizada',10,10,NULL,true),
 ('entrega_prazo',NULL,'Entrega dentro do prazo',5,5,NULL,false),
 ('criacao_aprovacao','criacao','Peça enviada para aprovação',10,10,NULL,true),
 ('criacao_aprovada','criacao','Peça aprovada sem alteração',5,5,NULL,false),
 ('criacao_alteracao','criacao','Peça voltou para alteração',-5,0,NULL,false),
 ('carteira','atendimento','Peça de cliente da carteira finalizada ou aprovada',5,5,NULL,true),
 ('agendamento','agendamento','Peça agendada',5,5,NULL,true),
 ('captacao','producao','Captação feita ou material bruto entregue',10,10,NULL,true),
 ('briefing','gestao','Demanda criada com briefing',2,2,NULL,false),
 ('dia_sem_vencida','criacao','Dia fechado sem demanda vencida',5,5,NULL,false),
 ('dia_vencida','criacao','Dia fechado com demanda vencida',-5,0,NULL,false),
 ('dia_agendamento','agendamento','Dia fechado sem "Para agendar" vencido',5,5,NULL,false),
 ('dia_sem_furo','gestao','Dia fechado sem furo de veiculação',10,10,NULL,true),
 ('dia_ativo',NULL,'Dia com ação no painel',0,2,NULL,false),
 ('meta_semanal',NULL,'Meta da semana batida',50,50,NULL,false),
 ('conquista',NULL,'Conquista',50,50,NULL,false),
 ('chegada',NULL,'Bônus de chegada pelo histórico, por entrega',2,10,NULL,false)
 ON CONFLICT (chave) DO NOTHING;
-- XP na carteira; no razão, pontos, regra e peça. Perda com saldo zero grava
-- quantidade 0 (fica registrada), por isso a verificação antiga muda.
ALTER TABLE vybe_escritorio_carteiras ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0);
ALTER TABLE vybe_escritorio_moedas ADD COLUMN IF NOT EXISTS pontos integer NOT NULL DEFAULT 0 CHECK (pontos >= 0);
ALTER TABLE vybe_escritorio_moedas ADD COLUMN IF NOT EXISTS regra text;
ALTER TABLE vybe_escritorio_moedas ADD COLUMN IF NOT EXISTS conteudo_id bigint;
ALTER TABLE vybe_escritorio_moedas DROP CONSTRAINT IF EXISTS vybe_escritorio_moedas_quantidade_check;
ALTER TABLE vybe_escritorio_moedas ADD CONSTRAINT vybe_escritorio_moedas_quantidade_check CHECK (quantidade <> 0 OR pontos > 0 OR regra IS NOT NULL);
CREATE INDEX IF NOT EXISTS vybe_escritorio_moedas_regra ON vybe_escritorio_moedas(regra,conteudo_id);
-- Entregas por pessoa e dia (base da meta semanal), com o histórico reconstruído.
CREATE TABLE IF NOT EXISTS vybe_escritorio_entregas (
 pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id), origem text NOT NULL,
 regra text NOT NULL REFERENCES vybe_escritorio_regras(chave), conteudo_id bigint, dia date NOT NULL,
 PRIMARY KEY (pessoa_id,origem)
);
CREATE INDEX IF NOT EXISTS vybe_escritorio_entregas_dia ON vybe_escritorio_entregas(pessoa_id,dia);
CREATE INDEX IF NOT EXISTS vybe_escritorio_entregas_peca ON vybe_escritorio_entregas(regra,conteudo_id);
-- Dias e semanas já fechados pelo ciclo diário ('dia:AAAA-MM-DD', 'semana:AAAA-MM-DD').
CREATE TABLE IF NOT EXISTS vybe_escritorio_fechamentos (chave text PRIMARY KEY, em timestamptz NOT NULL DEFAULT now());

CREATE OR REPLACE FUNCTION vybe_dia_bahia(ts timestamptz) RETURNS date LANGUAGE sql IMMUTABLE AS $$ SELECT (ts AT TIME ZONE 'America/Bahia')::date $$;
-- Lança moedas e pontos com origem única por pessoa. A perda para no zero da
-- carteira; o razão guarda o que foi aplicado de fato.
CREATE OR REPLACE FUNCTION vybe_lancar_pontos(p bigint, origem_evento text, regra_chave text, conteudo bigint, moedas integer, pontos integer)
 RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE recibo bigint; atual integer; aplicado integer;
BEGIN
 INSERT INTO vybe_escritorio_carteiras(pessoa_id) VALUES(p) ON CONFLICT DO NOTHING;
 SELECT saldo INTO atual FROM vybe_escritorio_carteiras WHERE pessoa_id=p FOR UPDATE;
 aplicado := CASE WHEN moedas < 0 THEN GREATEST(moedas,-atual) ELSE moedas END;
 INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade,pontos,regra,conteudo_id) VALUES(p,origem_evento,aplicado,pontos,regra_chave,conteudo)
 ON CONFLICT DO NOTHING RETURNING id INTO recibo;
 IF recibo IS NULL THEN RETURN false; END IF;
 UPDATE vybe_escritorio_carteiras SET saldo=saldo+aplicado, xp=xp+pontos WHERE pessoa_id=p;
 RETURN true;
END $$;
-- Compatível com as conquistas já existentes (quarto, 1ª/5ª/10ª demanda): 50 moedas e 50 XP.
CREATE OR REPLACE FUNCTION vybe_creditar_moedas(p bigint, origem_evento text, valor integer)
 RETURNS boolean LANGUAGE sql AS $$ SELECT vybe_lancar_pontos(p,origem_evento,'conquista',NULL,valor,GREATEST(valor,0)) $$;
-- Aplica uma regra da tabela a uma pessoa: só se ativa e se a função bater.
CREATE OR REPLACE FUNCTION vybe_aplicar_regra(p bigint, regra_chave text, origem_evento text, conteudo bigint, dia date)
 RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r vybe_escritorio_regras; ok boolean;
BEGIN
 IF p IS NULL THEN RETURN false; END IF;
 SELECT * INTO r FROM vybe_escritorio_regras WHERE chave=regra_chave AND ativa;
 IF r.chave IS NULL THEN RETURN false; END IF;
 IF r.funcao IS NOT NULL AND NOT EXISTS(SELECT 1 FROM vybe_escritorio_funcoes f WHERE f.pessoa_id=p AND f.funcao=r.funcao) THEN RETURN false; END IF;
 ok := vybe_lancar_pontos(p,origem_evento,r.chave,conteudo,r.moedas,r.pontos);
 IF ok AND r.entrega THEN
  INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia) VALUES(p,origem_evento,r.chave,conteudo,dia) ON CONFLICT DO NOTHING;
 END IF;
 RETURN ok;
END $$;
-- Heads da carteira (azul/laranja) dos clientes vinculados à peça.
CREATE OR REPLACE FUNCTION vybe_pontuar_carteira(conteudo bigint, dia date) RETURNS void LANGUAGE plpgsql AS $$
DECLARE head bigint;
BEGIN
 FOR head IN SELECT DISTINCT f.pessoa_id FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id=cc.cliente_id
  JOIN vybe_escritorio_funcoes f ON f.funcao='atendimento' AND f.carteira IS NOT NULL AND lower(f.carteira)=lower(trim(COALESCE(cl.responsavel,'')))
  WHERE cc.conteudo_id=conteudo ORDER BY 1 LOOP
  PERFORM vybe_aplicar_regra(head,'carteira','carteira:'||conteudo,conteudo,dia);
 END LOOP;
END $$;
-- O gatilho roda na transação do evento, antes de as automações trocarem os
-- responsáveis. Rótulos com acento são comparados por prefixo (ILIKE).
CREATE OR REPLACE FUNCTION vybe_pontuar_evento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record; recibo bigint; executor bigint; total integer; para text; de text; dia date; no_prazo boolean; autor_funcao text;
BEGIN
 SELECT id,board_id,prazo,briefing INTO c FROM vybe_conteudos WHERE id=NEW.conteudo_id;
 IF c.id IS NULL THEN RETURN NEW; END IF;
 para := lower(trim(COALESCE(NEW.para,''))); de := lower(trim(COALESCE(NEW.de,'')));
 dia := vybe_dia_bahia(COALESCE(NEW.em,now()));
 no_prazo := c.prazo IS NOT NULL AND dia <= c.prazo;
 SELECT funcao INTO autor_funcao FROM vybe_escritorio_funcoes WHERE pessoa_id=NEW.autor_id;
 IF NEW.tipo = 'status' THEN
  -- 1 e 2: demanda de Solicitações finalizada, uma vez por demanda (recibo global).
  IF c.board_id=8385559107 AND para IN ('finalizado','feito') THEN
   INSERT INTO vybe_escritorio_demandas_premiadas(conteudo_id) VALUES(c.id) ON CONFLICT DO NOTHING RETURNING conteudo_id INTO recibo;
   IF recibo IS NOT NULL THEN
    FOR executor IN SELECT DISTINCT pessoa_id FROM vybe_conteudo_responsaveis WHERE conteudo_id=c.id ORDER BY pessoa_id LOOP
     PERFORM vybe_aplicar_regra(executor,'entrega','demanda:'||c.id,c.id,dia);
     IF no_prazo THEN PERFORM vybe_aplicar_regra(executor,'entrega_prazo','prazo:'||c.id,c.id,dia); END IF;
     SELECT count(*) INTO total FROM vybe_escritorio_moedas WHERE pessoa_id=executor AND origem LIKE 'demanda:%';
     IF total >= 1 THEN PERFORM vybe_creditar_moedas(executor,'conquista:primeira-demanda',50); END IF;
     IF total >= 5 THEN PERFORM vybe_creditar_moedas(executor,'conquista:cinco-demandas',50); END IF;
     IF total >= 10 THEN PERFORM vybe_creditar_moedas(executor,'conquista:dez-demandas',50); END IF;
    END LOOP;
    PERFORM vybe_pontuar_carteira(c.id,dia);
   END IF;
  END IF;
  -- 3: a Criação mandou a peça para aprovação (primeira vez na peça). Sem
  -- responsável da Criação, vale quem mandou, se for da Criação.
  IF c.board_id=7829537690 AND para ILIKE 'para aprova%'
   AND NOT EXISTS(SELECT 1 FROM vybe_escritorio_entregas WHERE regra='criacao_aprovacao' AND conteudo_id=c.id) THEN
   FOR executor IN
    SELECT r.pessoa_id FROM vybe_conteudo_responsaveis r JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE r.conteudo_id=c.id
    UNION SELECT NEW.autor_id WHERE autor_funcao='criacao' AND NOT EXISTS(
     SELECT 1 FROM vybe_conteudo_responsaveis r JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE r.conteudo_id=c.id)
    ORDER BY 1 LOOP
    PERFORM vybe_aplicar_regra(executor,'criacao_aprovacao','aprovacao:'||c.id,c.id,dia);
    IF no_prazo THEN PERFORM vybe_aplicar_regra(executor,'entrega_prazo','prazo:'||c.id,c.id,dia); END IF;
   END LOOP;
  END IF;
  -- 4 e 6: aprovada sem nunca ter voltado para alteração.
  IF c.board_id=7829537690 AND para='para agendar'
   AND NOT EXISTS(SELECT 1 FROM vybe_conteudo_eventos a WHERE a.conteudo_id=c.id AND a.tipo='status' AND a.para ILIKE 'altera%' AND a.id<>NEW.id) THEN
   FOR executor IN SELECT r.pessoa_id FROM vybe_conteudo_responsaveis r JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE r.conteudo_id=c.id ORDER BY 1 LOOP
    PERFORM vybe_aplicar_regra(executor,'criacao_aprovada','aprovada:'||c.id,c.id,dia);
   END LOOP;
   PERFORM vybe_pontuar_carteira(c.id,dia);
  END IF;
  -- 5: voltou para alteração (no máximo uma vez por peça por dia).
  IF para ILIKE 'altera%' THEN
   FOR executor IN SELECT r.pessoa_id FROM vybe_conteudo_responsaveis r JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE r.conteudo_id=c.id ORDER BY 1 LOOP
    PERFORM vybe_aplicar_regra(executor,'criacao_alteracao','alteracao:'||c.id||':'||dia,c.id,dia);
   END LOOP;
  END IF;
  -- 7: agendou (saiu de Para agendar/Agendado para Agendado/Finalizado), quem fez.
  IF para IN ('agendado','finalizado') AND de IN ('para agendar','agendado') AND autor_funcao='agendamento' THEN
   PERFORM vybe_aplicar_regra(NEW.autor_id,'agendamento','agendou:'||c.id,c.id,dia);
  END IF;
 ELSIF (NEW.tipo='captacao' AND para ILIKE 'capta%feita') OR (NEW.tipo='material_bruto' AND NEW.para IS NOT NULL) THEN
  -- 8: captação feita ou material bruto entregue (primeira vez na peça).
  FOR executor IN SELECT pessoa_id FROM vybe_escritorio_funcoes WHERE funcao='producao' ORDER BY 1 LOOP
   PERFORM vybe_aplicar_regra(executor,'captacao','captacao:'||c.id,c.id,dia);
  END LOOP;
 ELSIF NEW.tipo='criacao' AND NULLIF(trim(COALESCE(c.briefing,'')),'') IS NOT NULL THEN
  -- 9: criada com briefing.
  PERFORM vybe_aplicar_regra(NEW.autor_id,'briefing','briefing:'||c.id,c.id,dia);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vybe_demanda_moedas ON vybe_conteudo_eventos;
CREATE TRIGGER vybe_demanda_moedas AFTER INSERT ON vybe_conteudo_eventos FOR EACH ROW EXECUTE FUNCTION vybe_pontuar_evento();

-- Histórico: entregas reconstruídas (sem moedas por evento; a chegada resume).
LOCK TABLE vybe_conteudo_eventos IN SHARE ROW EXCLUSIVE MODE;
-- a) Solicitações finalizadas: quem ainda está na demanda; senão os nomes do
-- último registro de responsáveis antes da finalização; senão quem marcou.
WITH fin AS (
 SELECT DISTINCT ON (e.conteudo_id) e.conteudo_id,e.em,e.autor_id FROM vybe_conteudo_eventos e JOIN vybe_conteudos c ON c.id=e.conteudo_id
 WHERE e.tipo='status' AND lower(trim(COALESCE(e.para,''))) IN ('finalizado','feito') AND c.board_id=8385559107 ORDER BY e.conteudo_id,e.em,e.id),
atuais AS (SELECT f.conteudo_id,r.pessoa_id,f.em FROM fin f JOIN vybe_conteudo_responsaveis r ON r.conteudo_id=f.conteudo_id),
registro AS (
 SELECT f.conteudo_id,p.id AS pessoa_id,f.em FROM fin f
 JOIN LATERAL (SELECT r.para FROM vybe_conteudo_eventos r WHERE r.conteudo_id=f.conteudo_id AND r.tipo='responsavel' AND r.em<=f.em
  AND r.para IS NOT NULL AND r.para<>'sem responsável' ORDER BY r.em DESC,r.id DESC LIMIT 1) u ON true
 JOIN vybe_pessoas p ON p.nome=ANY(string_to_array(u.para,', '))
 WHERE NOT EXISTS(SELECT 1 FROM atuais a WHERE a.conteudo_id=f.conteudo_id)),
autor AS (SELECT f.conteudo_id,f.autor_id AS pessoa_id,f.em FROM fin f WHERE f.autor_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM atuais a WHERE a.conteudo_id=f.conteudo_id) AND NOT EXISTS(SELECT 1 FROM registro g WHERE g.conteudo_id=f.conteudo_id)),
todos AS (SELECT * FROM atuais UNION SELECT * FROM registro UNION SELECT * FROM autor)
INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia)
 SELECT DISTINCT pessoa_id,'demanda:'||conteudo_id,'entrega',conteudo_id,vybe_dia_bahia(em) FROM todos ON CONFLICT DO NOTHING;
-- b) Produção: primeira ida para aprovação, por quem mandou (se da Criação); senão os responsáveis da Criação.
WITH ap AS (
 SELECT DISTINCT ON (e.conteudo_id) e.conteudo_id,e.em,e.autor_id FROM vybe_conteudo_eventos e JOIN vybe_conteudos c ON c.id=e.conteudo_id
 WHERE e.tipo='status' AND e.para ILIKE 'para aprova%' AND c.board_id=7829537690 ORDER BY e.conteudo_id,e.em,e.id),
autor AS (SELECT a.conteudo_id,a.autor_id AS pessoa_id,a.em FROM ap a JOIN vybe_escritorio_funcoes f ON f.pessoa_id=a.autor_id AND f.funcao='criacao'),
resp AS (SELECT a.conteudo_id,r.pessoa_id,a.em FROM ap a JOIN vybe_conteudo_responsaveis r ON r.conteudo_id=a.conteudo_id
 JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE NOT EXISTS(SELECT 1 FROM autor x WHERE x.conteudo_id=a.conteudo_id))
INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia)
 SELECT DISTINCT pessoa_id,'aprovacao:'||conteudo_id,'criacao_aprovacao',conteudo_id,vybe_dia_bahia(em) FROM (SELECT * FROM autor UNION SELECT * FROM resp) t ON CONFLICT DO NOTHING;
-- c) Agendamento: quem tirou a peça de Para agendar/Agendado para Agendado/Finalizado.
INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia)
 SELECT DISTINCT ON (e.conteudo_id) e.autor_id,'agendou:'||e.conteudo_id,'agendamento',e.conteudo_id,vybe_dia_bahia(e.em)
 FROM vybe_conteudo_eventos e JOIN vybe_escritorio_funcoes f ON f.pessoa_id=e.autor_id AND f.funcao='agendamento'
 WHERE e.tipo='status' AND lower(trim(COALESCE(e.para,''))) IN ('agendado','finalizado') AND lower(trim(COALESCE(e.de,''))) IN ('para agendar','agendado')
 ORDER BY e.conteudo_id,e.em,e.id ON CONFLICT DO NOTHING;
-- d) Produção: captação feita ou material bruto, para quem é da Produção.
INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia)
 SELECT f.pessoa_id,'captacao:'||x.conteudo_id,'captacao',x.conteudo_id,vybe_dia_bahia(x.em)
 FROM (SELECT DISTINCT ON (conteudo_id) conteudo_id,em FROM vybe_conteudo_eventos
  WHERE (tipo='captacao' AND para ILIKE 'capta%feita') OR (tipo='material_bruto' AND para IS NOT NULL) ORDER BY conteudo_id,em,id) x
 CROSS JOIN vybe_escritorio_funcoes f WHERE f.funcao='producao' ON CONFLICT DO NOTHING;
-- e) Carteira: Solicitações finalizadas e peças de Produção aprovadas sem alteração.
WITH pecas AS (
 SELECT DISTINCT ON (e.conteudo_id) e.conteudo_id,e.em FROM vybe_conteudo_eventos e JOIN vybe_conteudos c ON c.id=e.conteudo_id
 WHERE e.tipo='status' AND ((c.board_id=8385559107 AND lower(trim(COALESCE(e.para,''))) IN ('finalizado','feito'))
  OR (c.board_id=7829537690 AND lower(trim(COALESCE(e.para,'')))='para agendar'
   AND NOT EXISTS(SELECT 1 FROM vybe_conteudo_eventos a WHERE a.conteudo_id=e.conteudo_id AND a.tipo='status' AND a.para ILIKE 'altera%' AND a.em<e.em)))
 ORDER BY e.conteudo_id,e.em,e.id)
INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia)
 SELECT DISTINCT f.pessoa_id,'carteira:'||p.conteudo_id,'carteira',p.conteudo_id,vybe_dia_bahia(p.em)
 FROM pecas p JOIN vybe_conteudo_clientes cc ON cc.conteudo_id=p.conteudo_id JOIN vybe_clientes cl ON cl.id=cc.cliente_id
 JOIN vybe_escritorio_funcoes f ON f.funcao='atendimento' AND f.carteira IS NOT NULL AND lower(f.carteira)=lower(trim(COALESCE(cl.responsavel,'')))
 ON CONFLICT DO NOTHING;
-- A primeira execução do ciclo não fecha dias nem semanas anteriores à instalação.
INSERT INTO vybe_escritorio_fechamentos(chave)
 SELECT 'dia:'||to_char(vybe_dia_bahia(now())-n,'YYYY-MM-DD') FROM generate_series(1,7) n
 UNION ALL SELECT 'semana:'||to_char(date_trunc('week',vybe_dia_bahia(now())::timestamp)::date-7*n,'YYYY-MM-DD') FROM generate_series(1,2) n
 ON CONFLICT DO NOTHING;
-- Bônus de chegada: por entrega histórica, sem teto (decisão do Paulo); `teto` na regra limitaria se preenchido.
DO $$
DECLARE r vybe_escritorio_regras; p record;
BEGIN
 SELECT * INTO r FROM vybe_escritorio_regras WHERE chave='chegada' AND ativa;
 IF r.chave IS NULL THEN RETURN; END IF;
 FOR p IN SELECT pessoa_id,count(*) AS n FROM vybe_escritorio_entregas GROUP BY pessoa_id ORDER BY pessoa_id LOOP
  PERFORM vybe_lancar_pontos(p.pessoa_id,'chegada:historico','chegada',NULL,
   LEAST(COALESCE(r.teto,2147483647),(p.n*r.moedas)::integer),(p.n*r.pontos)::integer);
 END LOOP;
END $$;
COMMIT;
