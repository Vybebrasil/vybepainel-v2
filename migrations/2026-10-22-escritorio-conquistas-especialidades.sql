-- Complemento das conquistas (Paulo, 22/10/2026): preservar escadas,
-- títulos e recompensas existentes. Só acrescenta Implementações e Motion.
-- Não recalcula XP, não revisa níveis, não reseta inventários e não aplica
-- os valores experimentais da simulação. Prêmios seguem os níveis atuais.
-- Metas iniciais: implementação 5/20/60/150; motion 10/40/120/300.
-- Conferir em homologação antes de aplicar em produção.
BEGIN;
DO $$ BEGIN
 IF (SELECT count(*) FROM vybe_escritorio_trofeus WHERE marco='impressos' AND nivel BETWEEN 1 AND 4 AND moedas IS NOT NULL AND pontos IS NOT NULL) <> 4 THEN
  RAISE EXCEPTION 'Os quatro níveis de Impressos com recompensas precisam estar configurados antes das novas especialidades.';
 END IF;
END $$;
INSERT INTO vybe_escritorio_trofeus(marco,nivel,meta,classe,moedas,pontos)
SELECT v.marco,v.nivel,v.meta,t.classe,t.moedas,t.pontos
FROM (VALUES
 ('implementacoes',1,5),('implementacoes',2,20),('implementacoes',3,60),('implementacoes',4,150),
 ('motions',1,10),('motions',2,40),('motions',3,120),('motions',4,300)
) AS v(marco,nivel,meta)
JOIN vybe_escritorio_trofeus t ON t.marco='impressos' AND t.nivel=v.nivel
ON CONFLICT (marco,nivel) DO NOTHING;
-- As artes são troféus existentes, já registrados no catálogo. Cada nova
-- especialidade tem seu título e sua origem única, pelo motor atual.
COMMIT;
