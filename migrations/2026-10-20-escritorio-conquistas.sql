-- Conquistas com objeto (Paulo, 20/10/2026): toda conquista dá um móvel só
-- por marco, em escada (bronze, prata, ouro), e as conquistas novas por fazer
-- as coisas (server/escritorio-marcos.js) ganham o delas. Móvel de marco sai
-- da venda e da vitrine.
-- Uma vez só (marcador conquistas-2026-10-20): quem já tem a conquista recebe
-- o móvel que não tem. Os reinícios de 18 e 19/10 apagaram os inventários e a
-- conquista, registrada uma vez, não devolvia o objeto.
BEGIN;
INSERT INTO vybe_escritorio_catalogo(classe,raridade,marco) VALUES
 ('prize3','lendario','primeira'),('prize2','lendario','dez'),('prize1','lendario','cinquenta'),
 ('fball_trophy','lendario','cem'),('trophy_torch','lendario','embalo'),('exe_globe','lendario','carteira'),
 ('prizetrophy_thumb','lendario','zerado'),('habbo20_c20_trophybronze','lendario','nivel5'),
 ('habbo20_c20_trophysilver','lendario','nivel10'),('habbo20_c20_trophygold','lendario','nivel30'),
 ('trophy_baw','lendario','quarto'),('trophy_snowstorm_bronze','lendario','adiantado10'),
 ('trophy_snowstorm_gold','lendario','adiantado100'),('trophy_photographer_silver','lendario','deprimeira10'),
 ('trophy_photographer_gold','lendario','deprimeira50'),('prizetrophy_habboway','lendario','semana'),
 ('prizetrophy_storieshero','lendario','planejamento'),('rare_prize21_xmas','lendario','presente'),
 ('rare_r25_tradetrophy','lendario','troca'),('bc_blocktrophy_1','lendario','andar2'),
 ('trophy_chatterbox_bronze','lendario','postits')
 ON CONFLICT (classe) DO UPDATE SET marco=EXCLUDED.marco;

CREATE TABLE IF NOT EXISTS vybe_escritorio_reinicios (
 chave text PRIMARY KEY, executado_em timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='conquistas-2026-10-20') THEN
  RAISE NOTICE 'Objetos das conquistas já devolvidos; nenhuma alteração.';
  RETURN;
 END IF;
 INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade)
 SELECT m.pessoa_id,c.classe,1 FROM vybe_escritorio_marcos m
 JOIN vybe_escritorio_catalogo c ON c.marco=m.marco
 ON CONFLICT (pessoa_id,classe) DO NOTHING;
 INSERT INTO vybe_escritorio_reinicios(chave) VALUES('conquistas-2026-10-20');
END $$;
COMMIT;
