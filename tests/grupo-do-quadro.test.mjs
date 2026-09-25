// Os grupos de cada quadro, editáveis pelo painel (server/grupos.js), e a regra
// de que uma atividade só entra em grupo do próprio quadro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { grupoDoQuadro } from '../api/conteudo.js';
import { criarTabelaDeGrupos, listarGrupos, gruposDoQuadro, criarGrupo, editarGrupo,
  moverGrupoNaOrdem, ordenarGrupos, apagarGrupo, BOARD_PRODUCAO as PRODUCAO, BOARD_DEMANDAS as DEMANDAS } from '../server/grupos.js';

async function banco({ comTabela = true } = {}) {
  const { db, sql } = conexao();
  await db.exec(`
    CREATE TABLE vybe_conteudos (id int primary key, board_id bigint, grupo_id text, etapa text,
      removido_em timestamptz, atualizado_em timestamptz);
    CREATE TABLE vybe_automacoes (id serial primary key, nome text, acoes jsonb, condicao jsonb);
    INSERT INTO vybe_conteudos VALUES
      (1, ${PRODUCAO}, 'novo_grupo__1', 'Design & Edição', NULL, NULL),
      (2, ${PRODUCAO}, 'novo_grupo__1', 'Design & Edição', NULL, NULL),
      (3, ${DEMANDAS}, 'novo_grupo_mkmkjdqd', 'A Fazer', NULL, NULL);`);
  if (comTabela) await criarTabelaDeGrupos(sql);
  return sql;
}
const nomes = (grupos) => grupos.map((g) => g.titulo);

test('sem a tabela, valem os grupos de hoje, na ordem de hoje', async () => {
  const sql = await banco({ comTabela: false });
  assert.deepEqual(nomes(await gruposDoQuadro(sql, DEMANDAS)),
    ['Novas Demandas/Ideias', 'A Fazer', 'Em Execução', 'Concluídas']);
  await assert.rejects(criarGrupo(sql, { board: DEMANDAS, titulo: 'Orçamento' }), /Conferir estrutura do banco/);
});

test('a conferência semeia uma vez e não desfaz o que foi editado', async () => {
  const sql = await banco();
  await editarGrupo(sql, { board: PRODUCAO, grupo_id: 'group_title', titulo: 'Roteiro' });
  await criarTabelaDeGrupos(sql);
  const producao = await gruposDoQuadro(sql, PRODUCAO);
  assert.equal(producao.length, 5);
  assert.equal(producao[0].titulo, 'Roteiro');
});

test('grupo novo entra logo abaixo do grupo escolhido', async () => {
  const sql = await banco();
  const novo = await criarGrupo(sql, { board: DEMANDAS, titulo: '  Orçamento ', cor: '#ff5ac4', depois_de: 'novo_grupo_mkmkjdqd' });
  assert.equal(novo.titulo, 'Orçamento');
  assert.deepEqual(nomes(await gruposDoQuadro(sql, DEMANDAS)),
    ['Novas Demandas/Ideias', 'A Fazer', 'Orçamento', 'Em Execução', 'Concluídas']);
  // Produção não é tocada.
  assert.equal((await gruposDoQuadro(sql, PRODUCAO)).length, 5);
  await assert.rejects(criarGrupo(sql, { board: DEMANDAS, titulo: 'orçamento' }), /Já existe um grupo chamado/);
  await assert.rejects(criarGrupo(sql, { board: DEMANDAS, titulo: 'X', cor: '#123456' }), /cor da paleta/);
  await assert.rejects(criarGrupo(sql, { board: DEMANDAS, titulo: '   ' }), /Dê um nome/);
});

test('renomear leva o nome novo para as atividades do grupo, e só delas', async () => {
  const sql = await banco();
  const r = await editarGrupo(sql, { board: PRODUCAO, grupo_id: 'novo_grupo__1', titulo: 'Design', cor: '#e2445c' });
  assert.equal(r.renomeado, true);
  const linhas = await sql`SELECT id, etapa FROM vybe_conteudos ORDER BY id`;
  assert.deepEqual(linhas.map((l) => l.etapa), ['Design', 'Design', 'A Fazer']);
  const g = (await gruposDoQuadro(sql, PRODUCAO)).find((x) => x.grupo_id === 'novo_grupo__1');
  assert.equal(g.cor, '#e2445c');
  // Só a cor: o nome fica.
  await editarGrupo(sql, { board: PRODUCAO, grupo_id: 'novo_grupo__1', cor: '#00c875' });
  assert.equal((await gruposDoQuadro(sql, PRODUCAO)).find((x) => x.grupo_id === 'novo_grupo__1').titulo, 'Design');
});

test('subir e descer trocam de lugar com o vizinho; nas pontas não mudam nada', async () => {
  const sql = await banco();
  await moverGrupoNaOrdem(sql, { board: DEMANDAS, grupo_id: 'novo_grupo_mkkyx8pv', direcao: -1 });
  assert.deepEqual(nomes(await gruposDoQuadro(sql, DEMANDAS)),
    ['Novas Demandas/Ideias', 'A Fazer', 'Concluídas', 'Em Execução']);
  const topo = await moverGrupoNaOrdem(sql, { board: DEMANDAS, grupo_id: 'group_mm187437', direcao: -1 });
  assert.equal(topo.sem_mudanca, true);
});

test('apagar: só grupo vazio, nunca o de entrada, nem o que uma automação usa', async () => {
  const sql = await banco();
  await assert.rejects(apagarGrupo(sql, { board: PRODUCAO, grupo_id: 'novo_grupo__1' }), /tem 2 atividades/);
  await assert.rejects(apagarGrupo(sql, { board: PRODUCAO, grupo_id: 'group_title' }), /grupo de entrada/);
  await sql`INSERT INTO vybe_automacoes (nome, acoes) VALUES ('Aprovou, publica', '[{"tipo":"grupo","para":"novo_grupo22352__1"}]')`;
  await assert.rejects(apagarGrupo(sql, { board: PRODUCAO, grupo_id: 'novo_grupo22352__1' }), /automação "Aprovou, publica"/);
  const r = await apagarGrupo(sql, { board: DEMANDAS, grupo_id: 'novo_grupo_mkkyfhtw' });
  assert.equal(r.apagado, true);
  assert.deepEqual(nomes(await gruposDoQuadro(sql, DEMANDAS)), ['Novas Demandas/Ideias', 'A Fazer', 'Concluídas']);
});

test('atividade só entra em grupo do próprio quadro — inclusive num grupo recém-criado', async () => {
  const sql = await banco();
  await assert.rejects(grupoDoQuadro(sql, 'novo_grupo__1', DEMANDAS), /"Design & Edição" não pertence a este quadro/);
  await assert.rejects(grupoDoQuadro(sql, 'novo_grupo_mkmkjdqd', PRODUCAO), /"A Fazer" não pertence/);
  await assert.rejects(grupoDoQuadro(sql, 'grupo_inventado', PRODUCAO), /não pertence/);
  assert.equal(await grupoDoQuadro(sql, 'novo_grupo__1', PRODUCAO), 'Design & Edição');
  const novo = await criarGrupo(sql, { board: DEMANDAS, titulo: 'Orçamento' });
  assert.equal(await grupoDoQuadro(sql, novo.grupo_id, DEMANDAS), 'Orçamento');
  assert.equal((await listarGrupos(sql)).length, 10);
});

test('arrastar grava a ordem inteira, e recusa uma lista desatualizada', async () => {
  const sql = await banco();
  await ordenarGrupos(sql, { board: DEMANDAS,
    ordem: ['novo_grupo_mkkyx8pv', 'group_mm187437', 'novo_grupo_mkmkjdqd', 'novo_grupo_mkkyfhtw'] });
  assert.deepEqual(nomes(await gruposDoQuadro(sql, DEMANDAS)),
    ['Concluídas', 'Novas Demandas/Ideias', 'A Fazer', 'Em Execução']);
  // Falta um grupo (criado por outra pessoa depois que a tela carregou).
  await criarGrupo(sql, { board: DEMANDAS, titulo: 'Orçamento' });
  await assert.rejects(ordenarGrupos(sql, { board: DEMANDAS,
    ordem: ['group_mm187437', 'novo_grupo_mkkyx8pv', 'novo_grupo_mkmkjdqd', 'novo_grupo_mkkyfhtw'] }), /mudou enquanto você arrastava/);
  // Repetido ou de outro quadro também não passa.
  await assert.rejects(ordenarGrupos(sql, { board: PRODUCAO,
    ordem: ['group_title', 'group_title', 'novo_grupo__1', 'novo_grupo22352__1', 'novo_grupo31348__1'] }), /mudou/);
});

test('grupo com atividade removida permanece disponível para restauração', async () => {
  const sql = await banco();
  await sql`UPDATE vybe_conteudos SET removido_em=NOW() WHERE board_id=${DEMANDAS}`;
  await assert.rejects(apagarGrupo(sql, {board:DEMANDAS,grupo_id:'novo_grupo_mkmkjdqd'}), /incluindo arquivadas ou removidas/);
  assert.ok((await gruposDoQuadro(sql,DEMANDAS)).some(g=>g.grupo_id==='novo_grupo_mkmkjdqd'));
});

test('erro na consulta de automações aborta exclusão; tabela ausente é permitida', async () => {
  const sql = await banco();
  await sql`ALTER TABLE vybe_automacoes RENAME COLUMN acoes TO acoes_indisponiveis`;
  await assert.rejects(apagarGrupo(sql,{board:DEMANDAS,grupo_id:'novo_grupo_mkkyfhtw'}), /acoes/);
  assert.ok((await gruposDoQuadro(sql,DEMANDAS)).some(g=>g.grupo_id==='novo_grupo_mkkyfhtw'));
  await sql`DROP TABLE vybe_automacoes`;
  assert.equal((await apagarGrupo(sql,{board:DEMANDAS,grupo_id:'novo_grupo_mkkyfhtw'})).apagado,true);
});

test('movimentação recusa destino apagado e usa o nome atual do grupo', async () => {
  const {moverAtividadeParaGrupo}=await import('../server/grupos.js');
  const sql=await banco();
  const novo=await criarGrupo(sql,{board:DEMANDAS,titulo:'Revisão'});
  await editarGrupo(sql,{board:DEMANDAS,grupo_id:novo.grupo_id,titulo:'Revisão final'});
  await moverAtividadeParaGrupo(sql,{id:3,board:DEMANDAS,grupo:novo.grupo_id});
  assert.equal((await sql`SELECT etapa FROM vybe_conteudos WHERE id=3`)[0].etapa,'Revisão final');
  await moverAtividadeParaGrupo(sql,{id:3,board:DEMANDAS,grupo:'novo_grupo_mkmkjdqd'});
  await apagarGrupo(sql,{board:DEMANDAS,grupo_id:novo.grupo_id});
  await assert.rejects(moverAtividadeParaGrupo(sql,{id:3,board:DEMANDAS,grupo:novo.grupo_id}), /mudou/);
  assert.equal((await sql`SELECT grupo_id FROM vybe_conteudos WHERE id=3`)[0].grupo_id,'novo_grupo_mkmkjdqd');
});

test('renomear com nome ocupado não altera grupo nem atividades', async () => {
  const sql=await banco();
  await assert.rejects(editarGrupo(sql,{board:PRODUCAO,grupo_id:'novo_grupo__1',titulo:'Redação'}),/já existe/);
  assert.equal((await sql`SELECT etapa FROM vybe_conteudos WHERE id=1`)[0].etapa,'Design & Edição');
});

test('automação só grava referências existentes e protege o grupo da exclusão', async () => {
  const {salvarRegra}=await import('../vybe_automacoes.js');
  const sql=await banco();
  await sql`ALTER TABLE vybe_automacoes ADD COLUMN ativa boolean, ADD COLUMN ordem int,
    ADD COLUMN gatilho jsonb, ADD COLUMN origem text, ADD COLUMN alterada_em timestamptz`;
  const novo=await criarGrupo(sql,{board:DEMANDAS,titulo:'Revisão'});
  const dados={nome:'Enviar para revisão',gatilho:{campo:'status'},acoes:[{tipo:'grupo',para:novo.grupo_id}]};
  const regra=await salvarRegra(sql,dados);
  await assert.rejects(apagarGrupo(sql,{board:DEMANDAS,grupo_id:novo.grupo_id}),/automação/);
  await sql`DELETE FROM vybe_automacoes WHERE id=${regra.id}`;
  await apagarGrupo(sql,{board:DEMANDAS,grupo_id:novo.grupo_id});
  await assert.rejects(salvarRegra(sql,dados),/não existe mais/);
  await assert.rejects(salvarRegra(sql,{...dados,acoes:[],condicao:{grupo_em:[novo.grupo_id]}}),/não existe mais/);
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_automacoes`)[0].n,0);
});

test('duas criações concorrentes não duplicam o nome nem a posição', async () => {
  const sql=await banco();
  const resultados=await Promise.allSettled([
    criarGrupo(sql,{board:DEMANDAS,titulo:'Revisão'}),
    criarGrupo(sql,{board:DEMANDAS,titulo:'Revisão'}),
  ]);
  assert.equal(resultados.filter(r=>r.status==='fulfilled').length,1);
  assert.match(resultados.find(r=>r.status==='rejected').reason.message,/Já existe/);
  const grupos=await gruposDoQuadro(sql,DEMANDAS);
  assert.equal(grupos.filter(g=>g.titulo==='Revisão').length,1);
  assert.equal(new Set(grupos.map(g=>g.ordem)).size,grupos.length);
});
