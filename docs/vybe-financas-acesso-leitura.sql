-- Vybe OS → Vybe Finanças: acesso SÓ DE LEITURA (Paulo, 08/11/2026).
--
-- Onde rodar: Supabase do VYBE FINANÇAS → SQL Editor → New query → cole tudo → Run.
-- NÃO rode no banco do Vybe OS (Neon). Ninguém rodou este script por você: confira antes de rodar.
--
-- O que faz:
--   1. cria (ou atualiza) o papel vybe_os_leitura: LOGIN, NOINHERIT, sem BYPASSRLS, transação sempre só leitura;
--   2. dá USAGE no schema public e SELECT só nas 6 tabelas que o Vybe OS lê
--      (clients, transactions, employees, employee_compensation_history, subscriptions, contracts);
--   3. cria em cada uma a política "vybe_os_leitura_dono" (FOR SELECT TO vybe_os_leitura) que mostra só as linhas
--      do dono da Vybe. O uuid do dono é procurado AGORA em auth.users pelo e-mail abaixo e fica gravado na política
--      (o papel não precisa ler auth.users depois);
--   4. termina com a conferência: o que o papel vai enxergar, por tabela.
-- Pode rodar de novo quantas vezes quiser (idempotente). Para desligar, veja o bloco comentado no fim.
--
-- ANTES DE RODAR, troque as duas linhas abaixo:
SELECT set_config('vybe.dono_email', 'gestaovybe@gmail.com', false);   -- e-mail do dono da conta da Vybe no Finanças
SELECT set_config('vybe.senha_leitura', 'GERAR', false);  -- deixe GERAR: o script cria uma senha forte sozinho e mostra no fim
-- (rodar de novo gera OUTRA senha: aí é preciso atualizar a VYBE_FINANCAS_DB_URL na Vercel)

-- 1. O papel ---------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_senha text := current_setting('vybe.senha_leitura');
BEGIN
  -- Senha gerada aqui dentro (64 letras e números, aleatória): ninguém precisa inventar nem trocar senha nenhuma.
  IF v_senha IS NULL OR v_senha IN ('', 'GERAR', 'TROQUE-ESTA-SENHA') THEN
    v_senha := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  END IF;
  PERFORM set_config('vybe.senha_gerada', v_senha, false);
  IF length(v_senha) < 16 THEN
    RAISE EXCEPTION 'A senha escolhida no topo é curta demais: deixe GERAR para o script criar uma.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vybe_os_leitura') THEN
    EXECUTE format('CREATE ROLE vybe_os_leitura LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5 PASSWORD %L', v_senha);
  ELSE
    EXECUTE format('ALTER ROLE vybe_os_leitura LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5 PASSWORD %L', v_senha);
  END IF;
END $$;

ALTER ROLE vybe_os_leitura SET default_transaction_read_only = on;
ALTER ROLE vybe_os_leitura SET statement_timeout = '10s';
ALTER ROLE vybe_os_leitura SET idle_in_transaction_session_timeout = '20s';

-- 2. Permissões: só ler, só estas tabelas ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO vybe_os_leitura;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'transactions', 'employees', 'employee_compensation_history', 'subscriptions', 'contracts'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM vybe_os_leitura', t);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO vybe_os_leitura', t);
    ELSE
      RAISE NOTICE 'Tabela public.% não existe nesta versão do Finanças: pulada (o Vybe OS segue sem ela).', t;
    END IF;
  END LOOP;
END $$;

-- As políticas antigas do Finanças (FOR ALL ... user_data_owner_ids()) valem para todos os papéis e são avaliadas
-- junto com a nossa. Para não darem "permission denied" ao vybe_os_leitura, ele precisa poder chamar essa função
-- (ela devolve vazio para ele, porque auth.uid() é nulo fora do login do app). Nenhuma tabela nova fica visível por isso.
-- Se o Supabase não deixar dar alguma dessas permissões, segue com um aviso (NOTICE) em vez de parar.
DO $$
BEGIN
  IF to_regprocedure('public.user_data_owner_ids()') IS NOT NULL THEN
    BEGIN
      GRANT EXECUTE ON FUNCTION public.user_data_owner_ids() TO vybe_os_leitura;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Sem permissão para GRANT EXECUTE em public.user_data_owner_ids(): confira a conferência no fim.';
    END;
  END IF;
  IF to_regprocedure('auth.uid()') IS NOT NULL THEN
    BEGIN
      GRANT USAGE ON SCHEMA auth TO vybe_os_leitura;      -- só o schema (nenhuma tabela de auth)
      GRANT EXECUTE ON FUNCTION auth.uid() TO vybe_os_leitura;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Sem permissão para liberar auth.uid() ao papel (em geral já é liberada a todos): siga.';
    END;
  END IF;
END $$;

-- 3. RLS: o papel vê só as linhas do dono da Vybe --------------------------------------------------------------------
DO $$
DECLARE
  v_email text := lower(trim(current_setting('vybe.dono_email')));
  v_dono uuid;
  t text;
BEGIN
  SELECT u.id INTO v_dono FROM auth.users u WHERE lower(u.email) = v_email LIMIT 1;
  IF v_dono IS NULL THEN
    RAISE EXCEPTION 'Não achei o e-mail % em auth.users. Troque o e-mail no topo do script pelo do dono da conta da Vybe.', v_email;
  END IF;
  PERFORM set_config('vybe.dono_id', v_dono::text, false);
  FOREACH t IN ARRAY ARRAY['clients', 'transactions', 'employees', 'employee_compensation_history', 'subscriptions', 'contracts'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS vybe_os_leitura_dono ON public.%I', t);
    EXECUTE format('CREATE POLICY vybe_os_leitura_dono ON public.%I FOR SELECT TO vybe_os_leitura USING (user_id = %L::uuid)', t, v_dono);
  END LOOP;
END $$;

-- 4. Conferência ------------------------------------------------------------------------------------------------------
-- (a) o que o papel vai enxergar em cada tabela (as linhas do dono) e (b) as permissões e políticas criadas.
SELECT 'clients' AS tabela, count(*) AS linhas_visiveis FROM public.clients WHERE user_id = current_setting('vybe.dono_id')::uuid
UNION ALL SELECT 'transactions', count(*) FROM public.transactions WHERE user_id = current_setting('vybe.dono_id')::uuid
UNION ALL SELECT 'employees', count(*) FROM public.employees WHERE user_id = current_setting('vybe.dono_id')::uuid
UNION ALL SELECT 'subscriptions', count(*) FROM public.subscriptions WHERE user_id = current_setting('vybe.dono_id')::uuid
UNION ALL SELECT 'employee_compensation_history', (xpath('/row/c/text()', query_to_xml(format(
  'SELECT count(*) AS c FROM public.employee_compensation_history WHERE user_id = %L::uuid', current_setting('vybe.dono_id')), false, true, '')))[1]::text::bigint
  WHERE to_regclass('public.employee_compensation_history') IS NOT NULL
UNION ALL SELECT 'contracts', (xpath('/row/c/text()', query_to_xml(format(
  'SELECT count(*) AS c FROM public.contracts WHERE user_id = %L::uuid', current_setting('vybe.dono_id')), false, true, '')))[1]::text::bigint
  WHERE to_regclass('public.contracts') IS NOT NULL
UNION ALL SELECT 'permissao SELECT: ' || string_agg(table_name::text, ', ' ORDER BY table_name), count(*)
  FROM information_schema.role_table_grants WHERE grantee = 'vybe_os_leitura' AND privilege_type = 'SELECT'
UNION ALL SELECT 'politicas vybe_os_leitura_dono', count(*) FROM pg_policies WHERE policyname = 'vybe_os_leitura_dono'
UNION ALL SELECT 'outras permissoes (deve ser 0)', count(*)
  FROM information_schema.role_table_grants WHERE grantee = 'vybe_os_leitura' AND privilege_type <> 'SELECT';

-- Teste opcional, entrando como o próprio papel (se o Supabase deixar o SET ROLE no SQL Editor):
--   BEGIN; SET LOCAL ROLE vybe_os_leitura;
--   SELECT count(*) FROM public.clients;          -- igual à linha "clients" acima
--   INSERT INTO public.clients (user_id, name) VALUES (gen_random_uuid(), 'teste');  -- deve FALHAR (só leitura)
--   ROLLBACK;

-- ── PARA DESLIGAR (copie, tire os "-- " e rode) ─────────────────────────────────────────────────────────────────────
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['clients', 'transactions', 'employees', 'employee_compensation_history', 'subscriptions', 'contracts'] LOOP
--     IF to_regclass('public.' || t) IS NOT NULL THEN
--       EXECUTE format('DROP POLICY IF EXISTS vybe_os_leitura_dono ON public.%I', t);
--       EXECUTE format('REVOKE ALL ON TABLE public.%I FROM vybe_os_leitura', t);
--     END IF;
--   END LOOP;
--   IF to_regprocedure('public.user_data_owner_ids()') IS NOT NULL THEN REVOKE EXECUTE ON FUNCTION public.user_data_owner_ids() FROM vybe_os_leitura; END IF;
--   IF to_regprocedure('auth.uid()') IS NOT NULL THEN REVOKE EXECUTE ON FUNCTION auth.uid() FROM vybe_os_leitura; REVOKE USAGE ON SCHEMA auth FROM vybe_os_leitura; END IF;
--   REVOKE USAGE ON SCHEMA public FROM vybe_os_leitura;
--   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vybe_os_leitura') THEN DROP ROLE vybe_os_leitura; END IF;
-- END $$;
-- Depois apague VYBE_FINANCAS_DB_URL na Vercel: as telas voltam ao "Conectar o Vybe Finanças".

-- ── RESULTADO PARA COPIAR (o SQL Editor mostra esta tabela) ─────────────────────
SELECT 'COPIE: senha do vybe_os_leitura (vai no lugar de [YOUR-PASSWORD])' AS item, current_setting('vybe.senha_gerada') AS valor
UNION ALL SELECT 'tabelas liberadas para leitura', count(*)::text FROM information_schema.role_table_grants WHERE grantee = 'vybe_os_leitura' AND privilege_type = 'SELECT'
UNION ALL SELECT 'outras permissoes (deve ser 0)', count(*)::text FROM information_schema.role_table_grants WHERE grantee = 'vybe_os_leitura' AND privilege_type <> 'SELECT';
