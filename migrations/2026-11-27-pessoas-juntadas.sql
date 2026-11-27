-- 2026-11-27 · junção de pessoas duplicadas no Financeiro (Paulo, 27/11/2026: Ewerton e Thiago aparecem duas vezes).
-- Só aditivo: duas colunas em vybe_pessoas, vazias. Idempotente. Nenhuma pessoa muda ao aplicar.
-- O servidor também cria as duas sozinho (ALTER ... IF NOT EXISTS) na primeira junção, dentro da mesma transação; este
-- arquivo existe para quem preferir aplicar antes, à mão, no SQL Editor do Neon.
--
-- juntada_em_id: o id da pessoa que ficou, quando um dono junta esta a ela pela tela Finanças › Pessoas (ação
--   pessoa_juntar em server/financeiro.js). A linha nunca é apagada; ativo vira false e o desfazer (pessoa_separar) volta.
-- juntada_em: quando foi juntada.
ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS juntada_em_id BIGINT;
ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS juntada_em TIMESTAMPTZ;
