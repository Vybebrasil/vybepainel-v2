-- Vybe OS → Vybe Finanças: o Vybe OS CRIA E ATUALIZA o cliente no Finanças (Paulo, 09/11/2026: "pode liberar").
--
-- Onde rodar: Supabase do VYBE FINANÇAS → SQL Editor → New query → cole tudo → Run.
-- NÃO rode no banco do Vybe OS (Neon). Pode rodar de novo (idempotente); rodar de novo gera OUTRA senha.
--
-- O que faz:
--   1. cria (ou atualiza) o papel vybe_os_cadastro: LOGIN, sem permissão em tabela NENHUMA;
--   2. cria a função public.vybe_os_salvar_cliente(...), a ÚNICA coisa que esse papel pode chamar. Ela:
--      - acha o cliente do dono da Vybe pelo CNPJ (só os números) ou, sem CNPJ, pelo nome (sem maiúscula/espaço nas pontas);
--      - se não existe, cria com contract_status = 'Pendente' (NUNCA 'Ativo': a cobrança automática do Finanças só
--        roda para 'Ativo'; quem administra muda para Ativo no Finanças quando o contrato estiver certo);
--      - se existe, só preenche o que veio e não muda contract_status;
--      - não apaga nada e não mexe em contratos, transações ou cobranças;
--   3. mostra no fim a senha gerada (linha "COPIE").
--
-- ANTES DE RODAR, confira o e-mail do dono da conta da Vybe no Finanças:
SELECT set_config('vybe.dono_email', 'gestaovybe@gmail.com', false);

-- 1. O papel ---------------------------------------------------------------------------------------------------------
DO $$
DECLARE v_senha text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
BEGIN
  PERFORM set_config('vybe.senha_cadastro', v_senha, false);
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vybe_os_cadastro') THEN
    EXECUTE format('CREATE ROLE vybe_os_cadastro LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3 PASSWORD %L', v_senha);
  ELSE
    EXECUTE format('ALTER ROLE vybe_os_cadastro LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3 PASSWORD %L', v_senha);
  END IF;
END $$;
ALTER ROLE vybe_os_cadastro SET statement_timeout = '10s';
ALTER ROLE vybe_os_cadastro SET idle_in_transaction_session_timeout = '20s';
GRANT USAGE ON SCHEMA public TO vybe_os_cadastro;

-- 2. A função (o uuid do dono é procurado AGORA e fica escrito dentro dela) ------------------------------------------
DO $$
DECLARE v_dono uuid;
BEGIN
  SELECT id INTO v_dono FROM auth.users WHERE lower(email) = lower(current_setting('vybe.dono_email')) LIMIT 1;
  IF v_dono IS NULL THEN RAISE EXCEPTION 'Não achei o usuário % em auth.users. Confira o e-mail no topo.', current_setting('vybe.dono_email'); END IF;
  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION public.vybe_os_salvar_cliente(
      p_nome text, p_cnpj text, p_contato text, p_email text, p_telefone text, p_plano text, p_valor numeric, p_vencimento int)
    RETURNS TABLE (cliente_id uuid, criado boolean)
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $body$
    DECLARE v_id uuid; v_doc text := nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), '');
    BEGIN
      IF coalesce(trim(p_nome), '') = '' THEN RAISE EXCEPTION 'nome obrigatório'; END IF;
      IF p_vencimento IS NOT NULL AND (p_vencimento < 1 OR p_vencimento > 31) THEN p_vencimento := NULL; END IF;
      IF v_doc IS NOT NULL THEN
        SELECT c.id INTO v_id FROM clients c WHERE c.user_id = %L AND regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') = v_doc LIMIT 1;
      END IF;
      IF v_id IS NULL THEN
        SELECT c.id INTO v_id FROM clients c WHERE c.user_id = %L AND lower(trim(c.name)) = lower(trim(p_nome)) LIMIT 1;
      END IF;
      IF v_id IS NULL THEN
        INSERT INTO clients (user_id, name, cnpj, contact_person, email, phone, active_plan, monthly_fee, due_day, contract_status)
        VALUES (%L, trim(p_nome), nullif(trim(p_cnpj), ''), nullif(trim(p_contato), ''), nullif(trim(p_email), ''),
                nullif(trim(p_telefone), ''), nullif(trim(p_plano), ''), p_valor, p_vencimento, 'Pendente')
        RETURNING id INTO v_id;
        RETURN QUERY SELECT v_id, true;
      ELSE
        UPDATE clients SET
          cnpj = coalesce(nullif(trim(p_cnpj), ''), cnpj),
          contact_person = coalesce(nullif(trim(p_contato), ''), contact_person),
          email = coalesce(nullif(trim(p_email), ''), email),
          phone = coalesce(nullif(trim(p_telefone), ''), phone),
          active_plan = coalesce(nullif(trim(p_plano), ''), active_plan),
          monthly_fee = coalesce(p_valor, monthly_fee),
          due_day = coalesce(p_vencimento, due_day)
        WHERE id = v_id;
        RETURN QUERY SELECT v_id, false;
      END IF;
    END $body$;
  $f$, v_dono, v_dono, v_dono);
END $$;

REVOKE ALL ON FUNCTION public.vybe_os_salvar_cliente(text, text, text, text, text, text, numeric, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vybe_os_salvar_cliente(text, text, text, text, text, text, numeric, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vybe_os_salvar_cliente(text, text, text, text, text, text, numeric, int) TO vybe_os_cadastro;

-- 3. Conferência ------------------------------------------------------------------------------------------------------
SELECT 'COPIE: senha do vybe_os_cadastro' AS item, current_setting('vybe.senha_cadastro') AS valor
UNION ALL
SELECT 'tabelas que o papel pode escrever direto (deve ser 0)', count(*)::text
  FROM information_schema.role_table_grants WHERE grantee = 'vybe_os_cadastro' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
UNION ALL
SELECT 'função criada', CASE WHEN to_regprocedure('public.vybe_os_salvar_cliente(text,text,text,text,text,text,numeric,int)') IS NOT NULL THEN 'sim' ELSE 'NÃO' END;

-- Para desligar (o Vybe OS volta a só ler):
-- REVOKE EXECUTE ON FUNCTION public.vybe_os_salvar_cliente(text, text, text, text, text, text, numeric, int) FROM vybe_os_cadastro;
-- ALTER ROLE vybe_os_cadastro NOLOGIN;
