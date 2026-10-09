-- Instala apenas a regra solicitada; não altera atividades antigas nem regras personalizadas.
-- Executar na publicação, após validação em banco isolado. Pode ser reaplicada.
BEGIN;
INSERT INTO vybe_automacoes (nome, ordem, gatilho, condicao, acoes, origem)
SELECT 'Demanda feita vai para Concluídas, sem responsável', 23,
  '{"tipo":"status","para":"feito"}'::jsonb,
  '{"board_em":[8385559107]}'::jsonb,
  '[{"tipo":"grupo","para":"novo_grupo_mkkyx8pv"},{"tipo":"responsaveis","modo":"replace","pessoas":[]}]'::jsonb,
  'importada do Monday' -- Identificador legado das regras de SEMENTE; não usa Monday.
WHERE NOT EXISTS (SELECT 1 FROM vybe_automacoes
  WHERE nome='Demanda feita vai para Concluídas, sem responsável');
COMMIT;
