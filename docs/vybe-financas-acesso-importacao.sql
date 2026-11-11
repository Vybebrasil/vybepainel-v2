-- Vybe OS → Vybe Finanças: leitura de MAIS TRÊS tabelas para a importação do histórico (Paulo, 11/11/2026).
--
-- Onde rodar: Supabase do VYBE FINANÇAS → SQL Editor → New query → cole tudo → Run.
-- NÃO rode no banco do Vybe OS (Neon). Ninguém rodou este script por você: confira antes de rodar.
-- É OPCIONAL: sem ele o importador (scripts/financas-importar.mjs) funciona e avisa "sem acesso" a estas tabelas;
-- os lançamentos entram com a referência da conta bancária, só sem o nome dela.
--
-- O que faz: dá ao papel vybe_os_leitura (o mesmo da ponte, criado por vybe-financas-acesso-leitura.sql) SELECT em
--   bank_accounts (contas bancárias), monthly_budgets (orçamento mensal) e period_closures (meses fechados),
-- com a mesma política que mostra só as linhas do dono da Vybe. Continua só leitura; a senha NÃO muda.
-- company_settings fica de fora de propósito: guarda integrações (chaves de outros serviços).
-- Pode rodar de novo quantas vezes quiser. Para desligar, veja o bloco comentado no fim.

SELECT set_config('vybe.dono_email', 'gestaovybe@gmail.com', false);   -- e-mail do dono da conta da Vybe no Finanças

DO $$
DECLARE
  v_email text := lower(trim(current_setting('vybe.dono_email')));
  v_dono uuid;
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vybe_os_leitura') THEN
    RAISE EXCEPTION 'O papel vybe_os_leitura não existe: rode antes docs/vybe-financas-acesso-leitura.sql.';
  END IF;
  SELECT u.id INTO v_dono FROM auth.users u WHERE lower(u.email) = v_email LIMIT 1;
  IF v_dono IS NULL THEN
    RAISE EXCEPTION 'Não achei o e-mail % em auth.users. Troque o e-mail no topo do script pelo do dono da conta da Vybe.', v_email;
  END IF;
  PERFORM set_config('vybe.dono_id', v_dono::text, false);
  FOREACH t IN ARRAY ARRAY['bank_accounts', 'monthly_budgets', 'period_closures'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Tabela public.% não existe nesta versão do Finanças: pulada.', t;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM vybe_os_leitura', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO vybe_os_leitura', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS vybe_os_leitura_dono ON public.%I', t);
    EXECUTE format('CREATE POLICY vybe_os_leitura_dono ON public.%I FOR SELECT TO vybe_os_leitura USING (user_id = %L::uuid)', t, v_dono);
  END LOOP;
END $$;

-- Conferência: as tabelas que o papel lê (devem ser 9) e nenhuma outra permissão.
SELECT 'tabelas liberadas para leitura' AS item, string_agg(table_name::text, ', ' ORDER BY table_name) AS valor
  FROM information_schema.role_table_grants WHERE grantee = 'vybe_os_leitura' AND privilege_type = 'SELECT'
UNION ALL SELECT 'outras permissoes (deve ser 0)', count(*)::text
  FROM information_schema.role_table_grants WHERE grantee = 'vybe_os_leitura' AND privilege_type <> 'SELECT';

-- ── PARA DESLIGAR SÓ ESTAS TRÊS (copie, tire os "-- " e rode) ───────────────────────────────────────────────────────
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['bank_accounts', 'monthly_budgets', 'period_closures'] LOOP
--     IF to_regclass('public.' || t) IS NOT NULL THEN
--       EXECUTE format('DROP POLICY IF EXISTS vybe_os_leitura_dono ON public.%I', t);
--       EXECUTE format('REVOKE ALL ON TABLE public.%I FROM vybe_os_leitura', t);
--     END IF;
--   END LOOP;
-- END $$;
