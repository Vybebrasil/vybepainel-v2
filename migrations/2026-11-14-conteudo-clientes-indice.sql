-- 2026-11-14 · Índice por cliente em vybe_conteudo_clientes (confere do back, 14/11/2026).
-- Só aditiva e idempotente. As consultas da aprovação de peças (server/conteudo-aprovacao.js), dos alertas dos clientes e
-- da Carteira filtram por cliente_id; sem o índice, cada uma varria a tabela inteira de vínculos.
-- CONCURRENTLY não trava a escrita enquanto cria (rode fora de uma transação).
CREATE INDEX CONCURRENTLY IF NOT EXISTS vybe_conteudo_clientes_cliente ON vybe_conteudo_clientes (cliente_id, conteudo_id);
