-- VYBES dentro do Vybe OS (decisão do Paulo, 02/11/2026: "os heads usam a interface como eu, sem link novo").
-- O VYBES roda no PC do Paulo (WhatsApp, modelo local, turno da noite) e publica aqui, a cada poucos minutos, o mesmo
-- estado que a central dele mostra. Uma linha só: o estado mais recente.
-- Quem pode AGIR pelo VYBES (aprovar, pedir alteração, trocar responsável, mudar data, cobrar): Paulo, Vinícius,
-- Ewerton L. e Deivid — hoje as mesmas pessoas de vybe_escritorio_avisos_autores, copiadas uma vez como ponto de partida.
-- Todo o resto da equipe só vê (sem o texto das conversas). Mudar quem age é mudar esta tabela, sem deploy.
-- Só cria; não apaga nem altera nada existente. Pode rodar de novo sem efeito.

CREATE TABLE IF NOT EXISTS vybe_vybes_estado (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  estado jsonb NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vybe_vybes_operadores (
  pessoa_id bigint PRIMARY KEY REFERENCES vybe_pessoas(id),
  desde timestamptz NOT NULL DEFAULT now()
);

INSERT INTO vybe_vybes_operadores (pessoa_id)
SELECT pessoa_id FROM vybe_escritorio_avisos_autores
ON CONFLICT (pessoa_id) DO NOTHING;
