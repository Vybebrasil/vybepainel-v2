-- Captação ligada a um evento que alguém já marcou no Google Agenda (Paulo,
-- 21/10/2026: "uma agenda tem que conversar com a outra"). As peças entram na
-- captação azul que já existe, sem criar outro evento; o evento é de quem o
-- marcou, então o painel não o reescreve nem o apaga ao cancelar. As captações
-- que já existem foram criadas pelo painel (padrão true). Depende de
-- 2026-10-21-producao-captacoes.sql.
BEGIN;
ALTER TABLE vybe_captacoes ADD COLUMN IF NOT EXISTS evento_do_painel boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS vybe_captacoes_evento_unico ON vybe_captacoes (evento_google) WHERE evento_google IS NOT NULL AND estado <> 'cancelada';
COMMIT;
