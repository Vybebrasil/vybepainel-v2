-- Economia virtual. Revisar e aplicar explicitamente antes de liberar a loja.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_carteiras (
 pessoa_id bigint PRIMARY KEY REFERENCES vybe_pessoas(id),
 saldo integer NOT NULL DEFAULT 0 CHECK(saldo >= 0)
);
CREATE TABLE IF NOT EXISTS vybe_escritorio_moedas (
 id bigserial PRIMARY KEY, pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
 origem text NOT NULL, quantidade integer NOT NULL CHECK(quantidade <> 0),
 criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE(pessoa_id,origem)
);
CREATE TABLE IF NOT EXISTS vybe_escritorio_inventario (
 pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id), classe text NOT NULL,
 quantidade integer NOT NULL CHECK(quantidade > 0), PRIMARY KEY(pessoa_id,classe)
);
-- Recibo global: trocar executor ou reabrir não premia a mesma atividade outra vez.
CREATE TABLE IF NOT EXISTS vybe_escritorio_demandas_premiadas (
 conteudo_id bigint PRIMARY KEY REFERENCES vybe_conteudos(id),
 criado_em timestamptz NOT NULL DEFAULT now()
);
-- Congela eventos durante a instalação para não deixar finalizações no intervalo.
LOCK TABLE vybe_conteudo_eventos IN SHARE ROW EXCLUSIVE MODE;
-- Histórico anterior é marcado sem conceder moedas retroativas.
INSERT INTO vybe_escritorio_demandas_premiadas(conteudo_id)
 SELECT DISTINCT c.id FROM vybe_conteudos c
 LEFT JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
 WHERE c.board_id=8385559107 AND (lower(trim(s.rotulo))='finalizado' OR EXISTS(
 SELECT 1 FROM vybe_conteudo_eventos e WHERE e.conteudo_id=c.id AND e.tipo='status' AND lower(trim(e.para))='finalizado'))
 ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION vybe_creditar_moedas(p bigint, origem_evento text, valor integer)
 RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE recibo bigint;
BEGIN
 INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade) VALUES(p,origem_evento,valor)
 ON CONFLICT DO NOTHING RETURNING id INTO recibo;
 IF recibo IS NULL THEN RETURN false; END IF;
 INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(p,valor)
 ON CONFLICT(pessoa_id) DO UPDATE SET saldo=vybe_escritorio_carteiras.saldo+EXCLUDED.saldo;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION vybe_premiar_demanda() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recibo bigint; executor bigint; total integer;
BEGIN
 IF NEW.tipo IS DISTINCT FROM 'status' OR lower(trim(NEW.para)) IS DISTINCT FROM 'finalizado' OR NOT EXISTS(
 SELECT 1 FROM vybe_conteudos WHERE id=NEW.conteudo_id AND board_id=8385559107) THEN RETURN NEW; END IF;
 INSERT INTO vybe_escritorio_demandas_premiadas(conteudo_id) VALUES(NEW.conteudo_id)
 ON CONFLICT DO NOTHING RETURNING conteudo_id INTO recibo;
 IF recibo IS NULL THEN RETURN NEW; END IF;
 FOR executor IN SELECT DISTINCT pessoa_id FROM vybe_conteudo_responsaveis WHERE conteudo_id=NEW.conteudo_id ORDER BY pessoa_id LOOP
 PERFORM vybe_creditar_moedas(executor,'demanda:'||NEW.conteudo_id,10);
 -- Serializa por carteira também a contagem das conquistas concorrentes.
 SELECT count(*) INTO total FROM vybe_escritorio_moedas WHERE pessoa_id=executor AND origem LIKE 'demanda:%';
 IF total >= 1 THEN PERFORM vybe_creditar_moedas(executor,'conquista:primeira-demanda',50); END IF;
 IF total >= 5 THEN PERFORM vybe_creditar_moedas(executor,'conquista:cinco-demandas',50); END IF;
 IF total >= 10 THEN PERFORM vybe_creditar_moedas(executor,'conquista:dez-demandas',50); END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vybe_demanda_moedas ON vybe_conteudo_eventos;
CREATE TRIGGER vybe_demanda_moedas AFTER INSERT ON vybe_conteudo_eventos FOR EACH ROW EXECUTE FUNCTION vybe_premiar_demanda();
COMMIT;
