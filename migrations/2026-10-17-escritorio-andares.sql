-- Segundo andar usa as mesmas camadas, permissões, inventário e histórico.
-- Expande as chaves aceitas, sem alterar ou remover decoração existente.
BEGIN;
ALTER TABLE vybe_escritorio_mapa DROP CONSTRAINT IF EXISTS vybe_escritorio_mapa_camada_check;
ALTER TABLE vybe_escritorio_mapa DROP CONSTRAINT IF EXISTS vybe_escritorio_mapa_andares;
ALTER TABLE vybe_escritorio_mapa ADD CONSTRAINT vybe_escritorio_mapa_andares CHECK(camada='geral' OR camada ~ '^sala-([0-9]|1[01])(-andar-1)?$');
ALTER TABLE vybe_escritorio_mapa_versoes DROP CONSTRAINT IF EXISTS vybe_escritorio_mapa_versoes_camada_check;
ALTER TABLE vybe_escritorio_mapa_versoes DROP CONSTRAINT IF EXISTS vybe_escritorio_mapa_versoes_andares;
ALTER TABLE vybe_escritorio_mapa_versoes ADD CONSTRAINT vybe_escritorio_mapa_versoes_andares CHECK(camada='geral' OR camada ~ '^sala-([0-9]|1[01])(-andar-1)?$');
ALTER TABLE vybe_escritorio_mapa_versoes ADD COLUMN IF NOT EXISTS quarto jsonb;
ALTER TABLE IF EXISTS vybe_escritorio_imagens DROP CONSTRAINT IF EXISTS vybe_escritorio_imagens_camada_check;
ALTER TABLE IF EXISTS vybe_escritorio_imagens DROP CONSTRAINT IF EXISTS vybe_escritorio_imagens_andares;
ALTER TABLE IF EXISTS vybe_escritorio_imagens ADD CONSTRAINT vybe_escritorio_imagens_andares CHECK(camada='geral' OR camada ~ '^sala-([0-9]|1[01])(-andar-1)?$');
COMMIT;
