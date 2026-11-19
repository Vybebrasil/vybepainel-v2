-- Regras de Impressos do Nestor (Paulo, 19/11/2026: "impresso: quem vai ditar as regras é o Nestor (já falei que os bots
-- que organizam e tomam conta dos setores)"). Aditiva e idempotente: só cria a tabela e o índice se não existirem.
-- NÃO roda sozinha (fora do server/migracoes-irecity.js de propósito): aplicar à mão com o OK do Paulo. Sem a tabela, a tela
-- e o Nestor seguem sem regras (o impresso fica "aguardando o Nestor" e ele só avisa que falta regra).
--
-- Cada regra diz, para um tipo de impresso, quem faz a arte, em quantos dias e em qual gráfica. "palavras" casa com o
-- título, o material e o briefing da peça (sem acento, sem maiúscula); lista vazia é a regra padrão (vale quando nenhuma
-- outra casou). A primeira ativa pela ordem ganha. O Nestor consulta e PROPÕE; quem aplica é o caminho de sempre dos
-- agentes (core/porta-agentes.js no bot: em sombra, só com o "sim" de um dono).
CREATE TABLE IF NOT EXISTS vybe_impressao_regras (
    id bigserial PRIMARY KEY,
    nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 120),
    palavras text[] NOT NULL DEFAULT '{}',
    responsavel bigint REFERENCES vybe_pessoas(id) ON DELETE SET NULL,
    prazo_dias integer CHECK (prazo_dias IS NULL OR prazo_dias BETWEEN 0 AND 120),
    fornecedor_id bigint REFERENCES vybe_comercial_fornecedores(id) ON DELETE SET NULL,
    observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 500),
    ordem integer NOT NULL DEFAULT 100,
    ativa boolean NOT NULL DEFAULT true,
    criado_por bigint REFERENCES vybe_pessoas(id) ON DELETE SET NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    alterado_em timestamptz NOT NULL DEFAULT now()
  );
CREATE INDEX IF NOT EXISTS vybe_impressao_regras_ativas ON vybe_impressao_regras (ativa, ordem, id);
