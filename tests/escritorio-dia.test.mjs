// Dia de cada pessoa (balão da mesa e Dia da equipe, Paulo 22/10/2026): os
// dois quadros, prazo e veiculação, o que foi adiado e o dia real da entrega.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bancoEscritorio} from './escritorio-esquema.mjs';
import {diaDaEquipe, diaUtilAntes} from '../server/escritorio-dia.js';

test('dia útil anterior pula o fim de semana',()=>{
 assert.equal(diaUtilAntes('2026-10-26'),'2026-10-23');
 assert.equal(diaUtilAntes('2026-10-22'),'2026-10-21');
});

test('dia: prazo ou veiculação, adiadas, prontas no dia ou depois, e atrasadas',async t=>{
 const {db,sql}=await bancoEscritorio(t);
 const [regra]=await sql`SELECT chave FROM vybe_escritorio_regras WHERE entrega ORDER BY chave LIMIT 1`;
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN titulo text, ADD COLUMN monday_item_id text;
  INSERT INTO vybe_status VALUES(8385559107,'a_fazer','A Fazer',false);
  UPDATE vybe_status SET cor='#579bfc' WHERE chave='para_agendar';
  INSERT INTO vybe_conteudos(id,board_id,titulo,status_chave,prazo,veiculacao) VALUES
   (1,7829537690,'Fazendo hoje','em_andamento','2026-10-22',NULL),
   (2,7829537690,'Pronta hoje','finalizado','2026-10-22',NULL),
   (3,7829537690,'Só veiculação hoje','pode_fazer',NULL,'2026-10-22'),
   (4,8385559107,'Demanda de hoje','a_fazer','2026-10-22',NULL),
   (5,7829537690,'Adiada de hoje','pode_fazer','2026-10-24',NULL),
   (6,7829537690,'Ontem no dia','para_agendar','2026-10-21',NULL),
   (7,7829537690,'Ontem depois','finalizado','2026-10-21',NULL),
   (8,7829537690,'Ontem aberta','pode_fazer','2026-10-21',NULL),
   (9,7829537690,'Atrasada antiga','pode_fazer','2026-10-15',NULL),
   (10,7829537690,'Adiada há uma semana','pode_fazer','2026-10-30',NULL),
   (11,7829537690,'De outra pessoa','pode_fazer','2026-10-22',NULL);
  INSERT INTO vybe_conteudo_responsaveis VALUES(1,7,0),(2,7,0),(3,7,0),(4,7,0),(5,7,0),(6,7,0),(7,7,0),(8,7,0),(9,7,0),(10,7,0),(11,2,0);
  INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,em) VALUES
   (5,'prazo','2026-10-22','2026-10-24','2026-10-22T14:00:00Z'),
   (10,'prazo','2026-10-22','2026-10-30','2026-10-14T14:00:00Z');`);
 await db.query(`INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia) VALUES
   (7,'t:2',$1,2,'2026-10-22'),(7,'t:6',$1,6,'2026-10-21'),(7,'t:7',$1,7,'2026-10-22')`,[regra.chave]);
 // 22/10 às 15h na Bahia.
 const r=await diaDaEquipe(sql,new Date('2026-10-22T18:00:00Z'));
 assert.equal(r.hoje,'2026-10-22'); assert.equal(r.ontem,'2026-10-21');
 const p=r.pessoas['7'], por=(l)=>Object.fromEntries(l.map(x=>[x.titulo,x.adiada?'adiada:'+x.adiada.para:x.estado]));
 assert.deepEqual(por(p.hoje),{
  'Fazendo hoje':'fazendo','Pronta hoje':'pronta','Só veiculação hoje':'falta','Demanda de hoje':'falta',
  'Adiada de hoje':'adiada:2026-10-24',
  // Entregue hoje (era de ontem): também é entrega de hoje.
  'Ontem depois':'pronta',
 },'os dois quadros; sem prazo vale a veiculação; adiada no dia aparece; adiada uma semana antes não');
 assert.deepEqual(por(p.ontem),{'Ontem no dia':'pronta','Ontem depois':'depois','Ontem aberta':'falta'},'pronta no dia (pela entrega), depois, ou ficou aberta');
 assert.deepEqual(p.atrasadas.map(x=>x.titulo).sort(),['Atrasada antiga','Ontem aberta']);
 assert.equal(p.ontem.find(x=>x.titulo==='Ontem no dia').status,'Para agendar','status do painel como está');
 assert.equal(p.ontem.find(x=>x.titulo==='Ontem no dia').status_cor,'#579bfc','a cor do status vem do quadro, como nas demandas');
 assert.equal(p.hoje.find(x=>x.titulo==='Demanda de hoje').status_cor,'','status sem cor fica vazio');
 assert.deepEqual(r.pessoas['2'].hoje.map(x=>x.titulo),['De outra pessoa'],'cada um vê só o que é seu');
 assert.equal(p.hoje.find(x=>x.titulo==='Demanda de hoje').quadro,'demandas');
});
