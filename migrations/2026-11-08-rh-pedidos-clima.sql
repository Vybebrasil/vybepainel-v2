-- RH (Paulo, 08/11/2026): pedidos ao RH com prazo configurável, data desejada e hora da
-- resposta; pesquisa de clima com período aberta pelos donos (eNPS + 5 dimensões).
-- Depende de 2026-11-07-pessoas.sql (vybe_rh_pedidos). Idempotente: pode rodar mais de uma vez.
-- Também está em server/migracoes-irecity.js (aplicada pelo servidor no primeiro uso, padrão
-- autorizado pelo Paulo em 08/11/2026). Sem ela, a tela abre e avisa "aguardando a migração".
-- Não envia mensagens.
BEGIN;

-- Pedidos: data desejada (documento, reembolso, equipamento…), hora da resposta (tempo médio)
-- e o tipo novo "reembolso". Férias e folga seguem com primeiro e último dia (inicio/fim).
ALTER TABLE vybe_rh_pedidos ADD COLUMN IF NOT EXISTS data_desejada date;
ALTER TABLE vybe_rh_pedidos ADD COLUMN IF NOT EXISTS respondido_em timestamptz;
ALTER TABLE vybe_rh_pedidos DROP CONSTRAINT IF EXISTS vybe_rh_pedidos_tipo_check;
ALTER TABLE vybe_rh_pedidos ADD CONSTRAINT vybe_rh_pedidos_tipo_check
  CHECK (tipo IN ('documento','ferias','folha','beneficio','equipamento','reembolso','outro'));

-- Prazo de resposta (dias úteis) por tipo, que os donos ajustam. Sem linha, vale o padrão.
CREATE TABLE IF NOT EXISTS vybe_rh_prazos (
 tipo text PRIMARY KEY CHECK (tipo IN ('documento','ferias','folha','beneficio','equipamento','reembolso','outro')),
 dias_uteis smallint NOT NULL CHECK (dias_uteis BETWEEN 1 AND 30),
 atualizado_por bigint REFERENCES vybe_pessoas(id),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Pesquisa de clima com período, aberta pelos donos.
CREATE TABLE IF NOT EXISTS vybe_clima_pesquisas (
 id bigserial PRIMARY KEY,
 titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 120),
 abre date NOT NULL,
 fecha date NOT NULL CHECK (fecha >= abre),
 criada_por bigint REFERENCES vybe_pessoas(id),
 criada_em timestamptz NOT NULL DEFAULT now(),
 encerrada_em timestamptz
);
CREATE INDEX IF NOT EXISTS vybe_clima_pesquisas_abre ON vybe_clima_pesquisas (abre DESC, id DESC);

-- Resposta ANÔNIMA: sem pessoa, sem hora e sem número sequencial (id aleatório).
CREATE TABLE IF NOT EXISTS vybe_clima_pesquisa_respostas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 pesquisa_id bigint NOT NULL REFERENCES vybe_clima_pesquisas(id) ON DELETE CASCADE,
 enps smallint NOT NULL CHECK (enps BETWEEN 0 AND 10),
 lideranca smallint NOT NULL CHECK (lideranca BETWEEN 1 AND 5),
 comunicacao smallint NOT NULL CHECK (comunicacao BETWEEN 1 AND 5),
 reconhecimento smallint NOT NULL CHECK (reconhecimento BETWEEN 1 AND 5),
 carga smallint NOT NULL CHECK (carga BETWEEN 1 AND 5),
 ambiente smallint NOT NULL CHECK (ambiente BETWEEN 1 AND 5),
 comentario text NOT NULL DEFAULT '' CHECK (length(comentario) <= 1000)
);
CREATE INDEX IF NOT EXISTS vybe_clima_pesquisa_respostas_pesquisa ON vybe_clima_pesquisa_respostas (pesquisa_id);

-- Quem já respondeu (para não votar duas vezes): sem a resposta e sem hora.
CREATE TABLE IF NOT EXISTS vybe_clima_pesquisa_participacao (
 pesquisa_id bigint NOT NULL REFERENCES vybe_clima_pesquisas(id) ON DELETE CASCADE,
 pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
 PRIMARY KEY (pesquisa_id, pessoa_id)
);
COMMIT;
