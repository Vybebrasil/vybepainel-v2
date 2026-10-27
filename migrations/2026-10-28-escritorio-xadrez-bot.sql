-- Escritório: Desafios contra bot no xadrez (pedido do Paulo, 27/10/2026).
-- A partida contra o bot fica em vybe_escritorio_xadrez com `bot`
-- ('xadrez:<nível>') e sem `desafiado`; a cor do bot fica vazia (brancas ou
-- pretas NULL), porque o bot não é pessoa. Partida contra bot é sempre de
-- graça; ganhar dá VybeCoins e XP pelo razão (origem 'bot:xadrez:<id>'),
-- dentro do mesmo teto do dia dos outros bots, e `premio_bot` guarda o que
-- foi pago para a tela mostrar. Só acrescenta: o código de antes segue
-- funcionando com ela. Revisar e aplicar explicitamente.
BEGIN;
ALTER TABLE vybe_escritorio_xadrez ADD COLUMN IF NOT EXISTS bot text;
ALTER TABLE vybe_escritorio_xadrez ADD COLUMN IF NOT EXISTS premio_bot jsonb;
ALTER TABLE vybe_escritorio_xadrez DROP CONSTRAINT IF EXISTS vybe_escritorio_xadrez_bot_check;
ALTER TABLE vybe_escritorio_xadrez ADD CONSTRAINT vybe_escritorio_xadrez_bot_check CHECK (bot IS NULL OR bot ~ '^xadrez:(facil|medio|lendario)$');
ALTER TABLE vybe_escritorio_xadrez ALTER COLUMN desafiado DROP NOT NULL;
ALTER TABLE vybe_escritorio_xadrez ALTER COLUMN brancas DROP NOT NULL;
ALTER TABLE vybe_escritorio_xadrez ALTER COLUMN pretas DROP NOT NULL;
-- Sem bot, os dois lados são pessoas; com bot, falta exatamente uma cor e não há aposta.
ALTER TABLE vybe_escritorio_xadrez DROP CONSTRAINT IF EXISTS vybe_escritorio_xadrez_bot_lado;
ALTER TABLE vybe_escritorio_xadrez ADD CONSTRAINT vybe_escritorio_xadrez_bot_lado CHECK (
 (bot IS NULL AND desafiado IS NOT NULL AND brancas IS NOT NULL AND pretas IS NOT NULL)
 OR (bot IS NOT NULL AND desafiado IS NULL AND (brancas IS NULL) <> (pretas IS NULL) AND moedas = 0
  AND itens_desafiante = '[]'::jsonb AND itens_desafiado = '[]'::jsonb));
COMMIT;
