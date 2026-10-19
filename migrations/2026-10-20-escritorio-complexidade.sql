-- Recompensa por complexidade (pedido do Paulo, 19/10/2026: "fazer um
-- impresso de um cardápio deve dar mais que um card de aba única"). Cada
-- formato tem um peso nesta tabela (mude aqui, sem deploy); as regras por peça
-- marcadas com por_complexidade pagam moedas e XP multiplicados pelo peso do
-- formato da peça. Peça com mais de um formato soma os pesos, até 5; formato
-- desconhecido ou vazio vale 1. Penalidades e regras por pessoa não mudam.
-- Só vale para eventos novos: nada do razão é recalculado.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_complexidade (
 chave text PRIMARY KEY CHECK (chave = lower(chave)),
 nome text NOT NULL,
 peso numeric(4,2) NOT NULL CHECK (peso > 0 AND peso <= 5)
);
INSERT INTO vybe_escritorio_complexidade(chave,nome,peso) VALUES
 ('texto','Texto',0.5),('story','Story',0.5),
 ('card','Card',1),('feed','Feed',1),('post','Post',1),('fotografia','Fotografia',1),('capa videos','Capa de vídeo',1),('avulso','Avulso',1),
 ('design','Design',1.5),('digital','Digital',1.5),('feed/story','Feed/Story',1.5),
 ('carrossel','Carrossel',2),('implementacao','Implementação',2),('planejamento','Planejamento',2),
 ('reels','Reels',2.5),
 ('video','Vídeo',3),('motion','Motion',3),('impresso','Impresso',3)
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE vybe_escritorio_regras ADD COLUMN IF NOT EXISTS por_complexidade boolean NOT NULL DEFAULT false;
UPDATE vybe_escritorio_regras SET por_complexidade = true
 WHERE chave IN ('entrega','criacao_aprovacao','criacao_aprovada','captacao');

-- Chave do formato: minúsculas, sem acento, espaços simples.
CREATE OR REPLACE FUNCTION vybe_formato_chave(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT regexp_replace(translate(lower(trim(coalesce(t,''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g')
$$;
-- Peso da peça: soma dos formatos (vírgula separa), no máximo 5; vazio = 1.
CREATE OR REPLACE FUNCTION vybe_peso_conteudo(conteudo bigint) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT LEAST(5, GREATEST(COALESCE(sum(COALESCE(c.peso, 1)), 1), 0.5))
 FROM vybe_conteudos v
 CROSS JOIN LATERAL unnest(string_to_array(v.formato, ',')) AS f(parte)
 LEFT JOIN vybe_escritorio_complexidade c ON c.chave = vybe_formato_chave(f.parte)
 WHERE v.id = conteudo AND vybe_formato_chave(f.parte) <> ''
$$;

CREATE OR REPLACE FUNCTION vybe_aplicar_regra(p bigint, regra_chave text, origem_evento text, conteudo bigint, dia date)
 RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r vybe_escritorio_regras; ok boolean; peso numeric := 1;
BEGIN
 IF p IS NULL THEN RETURN false; END IF;
 SELECT * INTO r FROM vybe_escritorio_regras WHERE chave=regra_chave AND ativa;
 IF r.chave IS NULL THEN RETURN false; END IF;
 IF r.funcao IS NOT NULL AND NOT EXISTS(SELECT 1 FROM vybe_escritorio_funcoes f WHERE f.pessoa_id=p AND f.funcao=r.funcao) THEN RETURN false; END IF;
 IF r.por_complexidade AND conteudo IS NOT NULL THEN peso := COALESCE(vybe_peso_conteudo(conteudo), 1); END IF;
 ok := vybe_lancar_pontos(p,origem_evento,r.chave,conteudo,round(r.moedas*peso)::int,round(r.pontos*peso)::int);
 IF ok AND r.entrega THEN
  INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia) VALUES(p,origem_evento,r.chave,conteudo,dia) ON CONFLICT DO NOTHING;
 END IF;
 RETURN ok;
END $$;
COMMIT;
