-- Cliente de um evento da agenda escolhido à mão (Paulo, 26/10/2026: "quando
-- não tem um cliente vinculado na agenda, não posso vincular um cliente?").
-- O cliente sai do título do evento (clienteDoEvento); quando o título não
-- diz, alguém escolhe aqui. O evento no Google não é reescrito: o painel guarda
-- só o vínculo. Só cria a tabela; não mexe em dados existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_agenda_clientes (
 evento_google text PRIMARY KEY CHECK (evento_google ~ '^[A-Za-z0-9_-]+$' AND length(evento_google) BETWEEN 5 AND 1024),
 cliente_id bigint NOT NULL REFERENCES vybe_clientes(id),
 definido_por bigint REFERENCES vybe_pessoas(id),
 definido_em timestamptz NOT NULL DEFAULT now()
);
COMMIT;
