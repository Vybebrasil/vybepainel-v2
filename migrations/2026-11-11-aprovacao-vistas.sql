-- Aprovação do cliente (redesign, quadro 26, 11/11/2026): registro de "vista" das peças no link de aprovação.
-- Aplicação MANUAL pelo Paulo no SQL Editor do Neon. Não é executada pela API nem pelo build.
-- Idempotente (IF NOT EXISTS) e compatível com o código antigo, que não lê esta tabela.
-- Sem ela a página funciona como antes: o progresso conta as respondidas e "Aprovar todas" aprova
-- as peças em aprovação que têm arte. Não envia mensagens.
--
-- Uma linha por link e peça: a peça conta como vista quando o cliente passou pela arte inteira na página
-- (cada imagem na tela por um instante, o vídeo tocado, o arquivo aberto). visto_em é a última vez; a vista
-- só vale se for depois do arquivo mais novo da peça (arte trocada depois de um ajuste pede outra vista).
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_aprovacao_vistas (
 link_id bigint NOT NULL REFERENCES vybe_aprovacao_links(id),
 conteudo_id bigint NOT NULL REFERENCES vybe_conteudos(id),
 primeira_em timestamptz NOT NULL DEFAULT now(),
 visto_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (link_id, conteudo_id)
);
CREATE INDEX IF NOT EXISTS vybe_aprovacao_vistas_conteudo ON vybe_aprovacao_vistas (conteudo_id, visto_em DESC);
COMMIT;
