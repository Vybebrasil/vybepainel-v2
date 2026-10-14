-- Alinha cadastros anteriores à regra de head único. Executar na publicação.
-- Não altera clientes com múltiplos heads, sem head ou outra pessoa.
BEGIN;
WITH unicos AS (
  SELECT cliente_id, MIN(pessoa_id) AS pessoa_id
  FROM vybe_cliente_pessoas GROUP BY cliente_id HAVING COUNT(*) = 1
), carteiras AS (
  SELECT u.cliente_id, CASE p.monday_user_id::text
    WHEN '68035653' THEN 'Vinícius' WHEN '68036687' THEN 'Ewerton' END AS responsavel
  FROM unicos u JOIN vybe_pessoas p ON p.id=u.pessoa_id
  WHERE p.ativo AND p.monday_user_id::text IN ('68035653','68036687')
)
UPDATE vybe_clientes c SET responsavel=k.responsavel
FROM carteiras k WHERE c.id=k.cliente_id AND c.responsavel IS DISTINCT FROM k.responsavel;
COMMIT;
