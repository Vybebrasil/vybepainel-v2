// Clientes cobrando nos quartos: quem é cobrado e quando (19/10/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {bancoEscritorio} from './escritorio-esquema.mjs';
import {cobrancasDaEquipe} from '../server/escritorio-cobrancas.js';

test('cada demanda que pede ação manda o cliente para o quarto de quem deve agir',async t=>{
 const {db,sql}=await bancoEscritorio(t);
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN titulo text, ADD COLUMN monday_item_id text;
  ALTER TABLE vybe_clientes ADD COLUMN segmento text;
  CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint,ordem int DEFAULT 0);
  INSERT INTO vybe_cliente_pessoas VALUES(1,3),(2,24);
  INSERT INTO vybe_status VALUES(7829537690,'ag_info_cliente','Ag. Info Cliente',false),(7829537690,'a_fazer','A Fazer',false);
  INSERT INTO vybe_conteudos(id,board_id,titulo,status_chave,prazo,veiculacao) VALUES
   (1,7829537690,'Card atrasado','em_andamento','2026-10-19',NULL),
   (2,7829537690,'Card para aprovar','para_aprovacao','2026-10-18',NULL),
   (3,7829537690,'Card do dia','pode_fazer','2026-10-20',NULL),
   (4,7829537690,'Vence amanhã sem começar','pode_fazer','2026-10-21',NULL),
   (5,7829537690,'Vence amanhã em andamento','em_andamento','2026-10-21',NULL),
   (6,7829537690,'Esperando o cliente','ag_info_cliente','2026-10-19',NULL),
   (7,7829537690,'Para agendar hoje','para_agendar','2026-10-18','2026-10-20'),
   (8,7829537690,'Sem responsável','pode_fazer','2026-10-19',NULL),
   (9,7829537690,'Finalizado atrasado','finalizado','2026-10-01',NULL),
   (10,7829537690,'Em dia','pode_fazer','2026-10-30',NULL),
   (11,7829537690,'Dois clientes','em_andamento','2026-10-17',NULL),
   (12,7829537690,'Esperando a gravação','aguardo','2026-10-19',NULL),
   (13,7829537690,'Posta hoje sem começar','pode_fazer','2026-10-25','2026-10-20'),
   (14,7829537690,'Posta hoje em andamento','em_andamento','2026-10-25','2026-10-20');
  INSERT INTO vybe_conteudo_clientes VALUES(1,1),(2,1),(3,1),(4,1),(5,1),(6,1),(7,1),(8,2),(9,1),(10,1),(11,1),(11,2),(12,1),(13,1),(14,1);
  INSERT INTO vybe_conteudo_responsaveis VALUES(1,2,0),(2,2,0),(3,7,0),(4,6,0),(5,6,0),(6,2,0),(7,7,0),(9,2,0),(10,2,0),(11,7,0),(12,2,0),(13,2,0),(14,2,0);
  INSERT INTO vybe_escritorio_funcoes(pessoa_id,funcao) VALUES(5,'agendamento'),(1,'gestao') ON CONFLICT (pessoa_id) DO UPDATE SET funcao=EXCLUDED.funcao;`);
 const titulos=(m,id)=>(m.get(String(id))||[]).map(c=>`${c.titulo}:${c.tipo}`).sort();
 // 20/10 às 14h na Bahia (17h UTC): depois do meio-dia.
 const tarde=await cobrancasDaEquipe(sql,new Date('2026-10-20T17:00:00Z'));
 assert.deepEqual(titulos(tarde,2),['Card atrasado:atrasada'],'responsável cobra o atrasado; aprovação vai para o D.A.');
 assert.deepEqual(titulos(tarde,4),['Card para aprovar:atrasada'],'aprovação interna atrasada cobra o Deivid');
 assert.deepEqual(titulos(tarde,7),['Card do dia:hoje','Dois clientes:atrasada','Dois clientes:atrasada'],'do dia depois do meio-dia; peça de dois clientes manda os dois');
 assert.deepEqual(titulos(tarde,6),['Vence amanhã sem começar:vence'],'vencendo amanhã só se não começou');
 assert.deepEqual(titulos(tarde,5),['Para agendar hoje:agendar'],'veiculação chegando cobra o agendamento');
 assert.deepEqual(titulos(tarde,3),['Esperando a gravação:marcar_gravacao','Esperando o cliente:lembrar_cliente','Posta hoje sem começar:postar_parada'],'esperando o cliente vira lembrete no quarto do head; Aguardo é marcar a gravação (Paulo, 20/10/2026)');
 assert.deepEqual(titulos(tarde,24),['Sem responsável:atrasada'],'sem responsável cobra o head do cliente');
 // Veiculação chegou e a peça nem começou: o head do cliente é avisado de quem
 // está com ela (Paulo, 20/10/2026); em andamento não entra.
 const posta=(tarde.get('3')||[]).find(c=>c.tipo==='postar_parada');
 assert.deepEqual(posta.com,['Reriston Souza Silva']);
 assert.equal(posta.data,'2026-10-20');
 assert.ok(!(tarde.get('3')||[]).some(c=>c.titulo==='Posta hoje em andamento'));
 assert.ok(!(tarde.get('2')||[]).some(c=>/Finalizado|Em dia/.test(c.titulo)));
 assert.equal(tarde.get('2')[0].dias,1,'um dia de atraso já cobra');
 assert.deepEqual(tarde.get('2')[0].com,['Reriston Souza Silva'],'toda cobrança diz com quem está a peça');
 // Antes do meio-dia, a do dia ainda não cobra.
 const manha=await cobrancasDaEquipe(sql,new Date('2026-10-20T13:00:00Z'));
 assert.ok(!titulos(manha,7).some(t=>t.startsWith('Card do dia')));
});
