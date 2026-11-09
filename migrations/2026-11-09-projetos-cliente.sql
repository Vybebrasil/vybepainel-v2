-- Projetos pontuais com o cliente pelo cadastro (auditoria de 09/11/2026).
-- Também roda sozinha no primeiro acesso (server/migracoes-irecity.js, bloco 7), com o ok do Paulo.
ALTER TABLE vybe_projetos ADD COLUMN IF NOT EXISTS cliente_id bigint REFERENCES vybe_clientes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS vybe_projetos_cliente ON vybe_projetos (cliente_id);
