-- Reinício autorizado pelo Paulo em 17/10/2026: quartos E inventários zerados.
-- Aplicar explicitamente após publicar e revisar a prévia; nunca no build.
-- Prévia (somente leitura):
-- SELECT count(*) AS perfis FROM vybe_escritorio_perfis;
-- SELECT camada, versao, jsonb_array_length(itens) AS moveis
-- FROM vybe_escritorio_mapa WHERE camada <> 'geral' ORDER BY camada;
-- Guarda perfis, inventário e todas as camadas antes de limpar. Não altera
-- saldo, XP, razão, conquistas ou arquivos de imagens. Geral volta à planta do código.
BEGIN;
LOCK TABLE vybe_escritorio_perfis, vybe_escritorio_mapa, vybe_escritorio_inventario IN EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS vybe_escritorio_quartos_reinicio (
 chave text PRIMARY KEY,
 criado_em timestamptz NOT NULL DEFAULT now(),
 perfis jsonb NOT NULL,
 camadas jsonb NOT NULL,
 inventario jsonb NOT NULL
);
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_quartos_reinicio WHERE chave='formatos-2026-10-17') THEN
  RAISE NOTICE 'Reinício já executado; nenhuma alteração.';
  RETURN;
 END IF;
 IF to_regclass('public.vybe_escritorio_mapa_versoes') IS NULL THEN
  RAISE EXCEPTION 'Ative o histórico do mapa antes de reiniciar quartos.';
 END IF;
 INSERT INTO vybe_escritorio_quartos_reinicio(chave,perfis,camadas,inventario)
 VALUES('formatos-2026-10-17',
  (SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) FROM vybe_escritorio_perfis p),
  (SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) FROM vybe_escritorio_mapa m),
  (SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) FROM vybe_escritorio_inventario i));
 INSERT INTO vybe_escritorio_mapa_versoes(camada,itens,versao,atualizado_por,salvo_em)
 SELECT camada,itens,versao,atualizado_por,atualizado_em FROM vybe_escritorio_mapa;
 DELETE FROM vybe_escritorio_inventario;
 DELETE FROM vybe_escritorio_mapa WHERE camada='geral';
 UPDATE vybe_escritorio_mapa SET itens='[]'::jsonb,versao=versao+1,atualizado_em=now()
 WHERE camada <> 'geral';
 UPDATE vybe_escritorio_perfis SET preferencias=(preferencias
  - 'sala_planta' - 'sala_piso' - 'sala_parede' - 'sala_pisos' - 'sala_paredes' - 'sala_andares')
  || '{"quarto_configurado":false}'::jsonb,atualizado_em=now();
END $$;
COMMIT;
