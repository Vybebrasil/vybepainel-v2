-- Importação única dos roteiros que já existiam no Google Docs da Vybe (Paulo,
-- 21/10/2026). Foram lidos pelo Drive do Paulo: título, data de criação, cliente
-- e as peças de cada doc. Só os conteúdos com ligação clara (mesmo cliente, data
-- e assunto) já entram ligados; os outros a equipe liga na aba Roteiros, que
-- sugere os candidatos. Pode rodar de novo sem duplicar (doc_id único).
-- Depende de 2026-10-21-producao-roteiros.sql.
BEGIN;
INSERT INTO vybe_roteiros (doc_id, titulo, cliente_id, criado_em, pecas, origem)
SELECT v.doc_id, v.titulo, cl.id, v.criado_em, v.pecas, 'importado'
FROM (VALUES
 ('1aUzIl15OyQQCJU1D9tNCW7XRxk326k0r0cYApqfCHyQ', 'Roteiro de Captação: Chef Miguel Delhaye x Brussolo', 32, '2026-10-06'::date, '["Entrevista com o chef Miguel (A-roll)","Pré-serviço e preparo","Montagem dos pratos: Spalla d''Agnello, Controfiletto, Vatapá de Siri, Cioccolatissimo","Brigada e comando","Salão durante o serviço","Chamadas: almoço executivo, jantar à la carte, fim de semana","Retratos do chef"]'::jsonb),
 ('1Y5pbfwOBwd1XYvrU1c_uMTEVhV4el4XQRFOe61KPfqc', 'Roteiro Tráfego Avila Rocha', 15, '2026-09-28'::date, '["Intensivão Facilite: notas baixas e recuperação (tráfego)"]'::jsonb),
 ('1WJVADeREuM3zs9JjUw1mD40KrCKsWMf5-W33d6SXnK8', 'Roteiro Roberto - Senar Copirecê', 22, '2026-08-27'::date, '["Roberto (Senar): plantadeira manual na fazenda da Copirecê"]'::jsonb),
 ('1SX7AS513Q1KBFBjzJOoE2lFKLsTStte6aLY8FBUNWeI', 'Roteiro de Entrevista: Chef Francis Delhaye x Brussolo', 32, '2026-08-03'::date, '["O conceito e a chegada em Irecê","O prato superstar","Inspiração e identidade gastronômica","Ingredientes e valorização local","Bastidores e desafios","A experiência completa","A atmosfera do Brussolo","O convite para a inauguração"]'::jsonb),
 ('15NVs0_nMk30-JgfEHHOnWMou_4eYppEh5bC9XWM0Ml8', 'Roteiro Audiovisual Institucional Completo: Chef Francis Delhaye x Brussolo', 32, '2026-08-03'::date, '["Institucional: Gastronomia de Raiz, Técnica e Alma (manifesto do chef Francis)"]'::jsonb),
 ('1-VpdpSrFpkHWu41jcxzjhZT7s7gTau_P7M1v8_l2Ink', 'Roteiro de Entrevista e Captação - Matheus Martins', 28, '2026-08-03'::date, '["Matheus Martins, campeão brasileiro de XCO Sub-13: entrevista e treino na Antonov"]'::jsonb),
 ('1T89xEs7954z4XVRdhSrq84a-wKUMjWeOqaxpxy5-9qE', 'Roteiro Institucional | Laboratório DiaCenter', 31, '2026-07-30'::date, '["Institucional do laboratório: fachada, recepção, coleta, bastidores e equipe"]'::jsonb),
 ('1pv_OuzSoGh6rI8oBE8jEKj4hcg8z_V9bMQ1Cwx8RAuE', 'ROTEIRO DE ENTREVISTA DIAMANTE - JAIRO RIBEIRO (COMPLETO)', 26, '2026-05-21'::date, '["Entrevista Diamante com Jairo Ribeiro"]'::jsonb),
 ('1i4GjZVHswcD_BswahAuO8K5-GF9Tu5oExU4IwF3x01s', 'Roteiro de Vídeo: Convite "Café com os Personais"', 28, '2026-05-27'::date, '["Convite Café com os Personais (Son)"]'::jsonb),
 ('1RhpysMfsnfVpoXvgOxRpXAuGjUoqL-a-kdoSKLLtADk', 'Roteiro de Vídeo: Trend dos Licores', 6, '2026-05-25'::date, '["Trend dos licores: o sabor que anima (São João)"]'::jsonb),
 ('1O2c5zBkQ9rcIsm86Zm3n5ehSQevyYdCtetMd0LSWe6Y', 'ROTEIRO: 11 ANOS - A NOSSA SEGUNDA CASA DIACENTER', 5, '2026-04-28'::date, '["11 anos: a nossa segunda casa"]'::jsonb),
 ('1_M4fNpShS8OKoSzTnq36hCH311-hMDiqI-GwIMIER5U', 'Roteiro - 3º encontro Escola viva', 13, '2026-03-30'::date, '["3º encontro"]'::jsonb),
 ('1NHZCcAFXByXsMGTc4B0NaI7jazUGWo6XerAdQRrvNpo', 'ROTEIRO DE STORIES (RETA FINAL - AULA 01)', NULL, '2026-03-26'::date, '["Stories da reta final: aula 01 da Jornada Live do Zero"]'::jsonb),
 ('1DWU8dRrF2ECsvh4X1uxWyOxPVZKD_CbRs7VT2cQ7k24', 'ROTEIRO DE VÍDEO: Agradecimento Embrapa (Zene Vieira)', 22, '2026-03-26'::date, '["Agradecimento à Embrapa (Zene Vieira)"]'::jsonb),
 ('1paMnk_yjN_8yYcqmggDmRIjhZ5T6EvHzYs3FXq3lQaw', 'ROTEIRO — DIA DA MULHER | EXPERIMENTE', 6, '2026-03-02'::date, '["Dia da Mulher"]'::jsonb),
 ('134FAxG9chS-MMaEnQJmrrEmj-kYBRIKPNPCi0gu3uZU', 'Roteiros Hellen Dia 17 Agosto', 8, '2026-08-17'::date, '["Você ainda acha que precisa de 10 contribuições para receber salário-maternidade?","Meu filho tem autismo. Ele automaticamente tem direito ao BPC?","Trabalhou na roça a vida toda e nunca pagou INSS?","Voltou a trabalhar depois de um acidente? Você ainda pode ter um direito","O INSS negou. E agora?","Vai se aposentar em 2026? Não use a regra do ano passado"]'::jsonb),
 ('1VMwmiTemzt4mMvKDlPffiw3BzXbijCDLwJ9GjzzYvSA', 'Roteiros DiaCenter 27/07', 5, '2026-07-27'::date, '["O fim do não pode (nutrição)","A matemática da sede (nutrição)","O mapa dos direitos (serviço social)","A rede de apoio (serviço social)"]'::jsonb),
 ('1C2g21ELYVUO5AkA6WbBDsw1B85rtNLDPYCdBw9Y0_gg', 'Roteiros Hellen Rocha 12/06/2026', 8, '2026-06-12'::date, '["Trend: quanto menos esperar, clareou (evolução Hellen)","STF invalidou a idade mínima para aposentadoria especial","Entenda o BPC/LOAS e seus direitos","Benefícios do INSS que você não conhece","O salário-maternidade que o INSS quer esconder","O que é Direito Previdenciário?","3 direitos previdenciários que toda mulher precisa conhecer"]'::jsonb),
 ('1_wjDhzZo4D5fmi8IGXkR7PnCjSW148Dn5DSh8BsyX5A', 'Roteiros Inauguração', 28, '2026-05-31'::date, '["Convite para a visitação de 6 de junho (Son)"]'::jsonb),
 ('155saOW-OumXdVWoRIKhkDn1VtAAhoG-SXNtYG8JUtX4', 'Roteiros de Treino - Lions / 30 Abril', 24, '2026-05-30'::date, '["Roteiros de treino"]'::jsonb),
 ('1O-M969c-60qBKSCnSdcfb02rmSHSg9k5rU0Y2UO22xQ', 'Roteiros stories - Daniela Filgueira', 237, '2025-04-22'::date, '["Stories de 24/04 a 06/05: encontro para mães"]'::jsonb)
) AS v(doc_id, titulo, cliente_id, criado_em, pecas)
LEFT JOIN vybe_clientes cl ON cl.id = v.cliente_id
ON CONFLICT (doc_id) DO NOTHING;
INSERT INTO vybe_roteiro_conteudos (roteiro_id, conteudo_id)
SELECT r.id, c.id
FROM (VALUES
 ('1i4GjZVHswcD_BswahAuO8K5-GF9Tu5oExU4IwF3x01s', 1110),
 ('1i4GjZVHswcD_BswahAuO8K5-GF9Tu5oExU4IwF3x01s', 10197),
 ('1DWU8dRrF2ECsvh4X1uxWyOxPVZKD_CbRs7VT2cQ7k24', 594),
 ('1C2g21ELYVUO5AkA6WbBDsw1B85rtNLDPYCdBw9Y0_gg', 1188),
 ('1O2c5zBkQ9rcIsm86Zm3n5ehSQevyYdCtetMd0LSWe6Y', 819),
 ('1paMnk_yjN_8yYcqmggDmRIjhZ5T6EvHzYs3FXq3lQaw', 386),
 ('1pv_OuzSoGh6rI8oBE8jEKj4hcg8z_V9bMQ1Cwx8RAuE', 1238)
) AS v(doc_id, conteudo_id)
JOIN vybe_roteiros r ON r.doc_id = v.doc_id
JOIN vybe_conteudos c ON c.id = v.conteudo_id
ON CONFLICT DO NOTHING;
COMMIT;
