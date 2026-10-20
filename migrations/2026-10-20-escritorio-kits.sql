-- Kits da loja (decisão do Paulo, 20/10/2026: "conjuntos prontos com
-- desconto"). Cada kit é uma lista de móveis à venda; o preço é a soma dos
-- preços atuais da loja menos o desconto da linha. Comprar é tudo ou nada
-- (server/escritorio-economia.js, comprarKit). Valores ficam aqui na tabela.
-- Não mexe em saldo nem inventário de ninguém. Revisar e aplicar.
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_kits (
 chave text PRIMARY KEY CHECK (chave ~ '^[a-z0-9_-]{1,40}$'),
 nome text NOT NULL,
 descricao text NOT NULL DEFAULT '',
 classes text[] NOT NULL CHECK (cardinality(classes) BETWEEN 2 AND 12),
 desconto numeric(3,2) NOT NULL DEFAULT 0.15 CHECK (desconto >= 0 AND desconto < 0.6),
 ordem integer NOT NULL DEFAULT 0,
 ativo boolean NOT NULL DEFAULT true
);
INSERT INTO vybe_escritorio_kits(chave,nome,descricao,classes,desconto,ordem) VALUES
 ('estudio-trabalho','Kit Estúdio: trabalho','Mesa, cadeira, luminária, estante e planta da linha Estúdio.',ARRAY['modern_c17_desk','modern_c17_chair','modern_c17_lamp','modern_c17_shelf','modern_c17_plant'],0.20,1),
 ('estudio-sala','Kit Estúdio: sala','Sofá, mesinha, tapete, TV e luminária de chão.',ARRAY['modern_c17_sofa','modern_c17_lowtable','modern_c17_rug','modern_c17_tv','modern_c17_floorlamp'],0.20,2),
 ('estudio-descanso','Kit Estúdio: descanso','Cama, almofada, mesa de canto e caixinhas de som.',ARRAY['modern_c17_bed','modern_c17_pillow','modern_c17_endtable','modern_c17_speakers'],0.15,3),
 ('madeira','Kit Madeira','Escrivaninha, cadeira, estante de parede, mesinha e tapete laranja.',ARRAY['waasa_desk','waasa_chair','waasa_wall_shelf1','waasa_table1','waasa_rug3'],0.15,4)
ON CONFLICT (chave) DO NOTHING;
COMMIT;
