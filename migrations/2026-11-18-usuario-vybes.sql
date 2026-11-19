-- 2026-11-18 · conta própria do VYBES no Vybe OS (Paulo, 18/11/2026: "hoje tudo o que o VYBES faz sai com o meu nome").
-- Aplicar à mão no SQL Editor do Neon (produção), uma vez. Idempotente: rodar de novo não duplica nem muda nada.
-- Só aditivo: uma coluna, uma regra (CHECK) e uma pessoa nova. Nenhuma pessoa existente muda.
-- Depois de aplicar: o SELECT do fim devolve o id; ele vai em VYBE_VYBES_PESSOA_ID na Vercel (server/conta-vybes.js).
--
-- A pessoa VYBES:
--  - ativa, sem id do Monday (o sincronizarEquipe só atualiza quem casa pelo id do Monday: ela nunca é tocada nem apagada);
--  - pode_entrar FALSE e sem senha: não entra no painel e fica fora da regra única da equipe (ativo AND pode_entrar),
--    ou seja, fora de Equipe, RH, Carteira, heads, Escritório, rostos do login, rankings e distribuição;
--  - servico TRUE: a marca que tira a conta das listas que não usam essa regra. A marca nunca dá permissão:
--    dono ela é só pelo id em VYBE_VYBES_PESSOA_ID (server/donos.js).

ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS servico BOOLEAN NOT NULL DEFAULT FALSE;
-- As colunas que a regra abaixo confere. O servidor já as cria (vybe_sessao.js); aqui só garante, com a mesma definição.
ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS senha_hash TEXT;
ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Conta de serviço nunca entra no painel: sem acesso, sem senha, sem id do Monday e sem a marca antiga de admin.
-- Vale para sempre, não só hoje: liberar acesso ou definir senha para ela falha no próprio banco.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'vybe_pessoas_servico_sem_acesso' AND conrelid = 'vybe_pessoas'::regclass) THEN
    ALTER TABLE vybe_pessoas ADD CONSTRAINT vybe_pessoas_servico_sem_acesso
      CHECK (NOT servico OR (pode_entrar IS FALSE AND senha_hash IS NULL AND monday_user_id IS NULL AND admin IS FALSE));
  END IF;
END $$;

INSERT INTO vybe_pessoas (nome, email, papel, ativo, pode_entrar, servico)
SELECT 'VYBES', 'vybes@vybe.local', 'Serviço', TRUE, FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM vybe_pessoas WHERE LOWER(email) = 'vybes@vybe.local');

-- O id para VYBE_VYBES_PESSOA_ID (uma linha só; se vier vazio, a pessoa não foi criada).
SELECT id, nome, email, ativo, pode_entrar, servico
FROM vybe_pessoas
WHERE LOWER(email) = 'vybes@vybe.local' AND servico IS TRUE;
