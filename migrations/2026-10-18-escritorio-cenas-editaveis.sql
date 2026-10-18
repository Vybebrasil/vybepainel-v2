-- Salas comuns (Convivência, Reunião, Auditório, Produção, Café, Jogos, Foco,
-- Academia, Lounge) passam a ter camada própria, editada no editor do mapa
-- só por quem administra (decisão do Paulo, 18/10/2026). Só amplia as chaves
-- aceitas; não altera nem remove decoração existente. Sem camada salva, a
-- cena continua com os móveis padrão do código.
BEGIN;
ALTER TABLE vybe_escritorio_mapa DROP CONSTRAINT IF EXISTS vybe_escritorio_mapa_camada_check;
ALTER TABLE vybe_escritorio_mapa DROP CONSTRAINT IF EXISTS vybe_escritorio_mapa_andares;
ALTER TABLE vybe_escritorio_mapa ADD CONSTRAINT vybe_escritorio_mapa_andares CHECK(camada='geral' OR camada ~ '^(sala-([0-9]|1[01])(-andar-1)?|recepcao|reuniao|auditorio|producao|cafe|jogos|foco|academia|lounge)$');
ALTER TABLE vybe_escritorio_mapa_versoes DROP CONSTRAINT IF EXISTS vybe_escritorio_mapa_versoes_camada_check;
ALTER TABLE vybe_escritorio_mapa_versoes DROP CONSTRAINT IF EXISTS vybe_escritorio_mapa_versoes_andares;
ALTER TABLE vybe_escritorio_mapa_versoes ADD CONSTRAINT vybe_escritorio_mapa_versoes_andares CHECK(camada='geral' OR camada ~ '^(sala-([0-9]|1[01])(-andar-1)?|recepcao|reuniao|auditorio|producao|cafe|jogos|foco|academia|lounge)$');
ALTER TABLE IF EXISTS vybe_escritorio_imagens DROP CONSTRAINT IF EXISTS vybe_escritorio_imagens_camada_check;
ALTER TABLE IF EXISTS vybe_escritorio_imagens DROP CONSTRAINT IF EXISTS vybe_escritorio_imagens_andares;
ALTER TABLE IF EXISTS vybe_escritorio_imagens ADD CONSTRAINT vybe_escritorio_imagens_andares CHECK(camada='geral' OR camada ~ '^(sala-([0-9]|1[01])(-andar-1)?|recepcao|reuniao|auditorio|producao|cafe|jogos|foco|academia|lounge)$');
COMMIT;
