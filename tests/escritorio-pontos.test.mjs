// Pontos (XP) e VybeCoins por função: cada regra, a repetição (nada credita
// duas vezes), o fechamento do dia e da semana e a reconstrução do histórico.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conexao} from './postgres.mjs';
import {carregarEconomia} from '../server/escritorio-economia.js';
import {fecharPontosEscritorio,metaDaSemana,nivelPorXp,inicioDaSemana,diaBahia} from '../server/escritorio-pontos.js';
const BAHIA='T15:00:00-03:00';
// `historico` entra antes da loja (como em produção: marcado sem moedas);
// `semMarcas` apaga as marcas de instalação para fechar datas do passado no teste.
async function banco(t,{historico=async()=>{},semMarcas=false}={}) {
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,monday_user_id text,ativo boolean DEFAULT true,pode_entrar boolean DEFAULT true);
 INSERT INTO vybe_pessoas(id,nome,monday_user_id) VALUES(1,'Paulo Martins','68035537'),(2,'Reriston Souza Silva','68036697'),(3,'Vinícius Damascena','68035653'),
  (4,'Deivid Oliveira Ribeiro','68997024'),(5,'Tainara Sodré','80146924'),(6,'Jady Amynne Oliveira Lima','100482777'),(7,'Beatriz Rocha Cardoso','71130408'),
  (24,'Ewerton Luis Souza da Silva','68036687'),(28,'Ademir Dourado Santana','78158742');
 CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true,responsavel text);
 INSERT INTO vybe_clientes VALUES(1,'Cliente laranja',true,'Vinícius'),(2,'Cliente azul',true,'Ewerton'),(3,'Sem carteira',true,NULL);
 CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,status_chave text,prazo date,veiculacao date,briefing text,removido_em timestamptz);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean DEFAULT false);
 INSERT INTO vybe_status VALUES(8385559107,'feito','Feito',true),(8385559107,'pode_fazer','Pode Fazer',false),(8385559107,'alteracao','Alteração',false),
  (7829537690,'pode_fazer','Pode Fazer',false),(7829537690,'em_andamento','Em andamento',false),(7829537690,'para_aprovacao','Para aprovação',false),
  (7829537690,'alteracao','Alteração',false),(7829537690,'para_agendar','Para agendar',true),(7829537690,'agendado','Agendado',true),(7829537690,'finalizado','Finalizado',true),(7829537690,'segurar_post','Segurar Post',false);
 CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint,ordem int DEFAULT 0,PRIMARY KEY(conteudo_id,pessoa_id));
 CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint,PRIMARY KEY(conteudo_id,cliente_id));
 CREATE TABLE vybe_conteudo_eventos(id bigserial PRIMARY KEY,conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text,em timestamptz NOT NULL DEFAULT now());`);
 for(const f of ['2026-10-15-escritorio.sql','2026-10-16-escritorio-mapa.sql']) await db.exec(readFileSync('migrations/'+f,'utf8'));
 await historico(db,sql);
 for(const f of ['2026-10-17-escritorio-vybecoins.sql','2026-10-17-escritorio-pontos.sql']) await db.exec(readFileSync('migrations/'+f,'utf8'));
 if(semMarcas) await db.exec('DELETE FROM vybe_escritorio_fechamentos');
 return {db,sql};
}
const saldo=async(sql,p)=>{const [c]=await sql`SELECT saldo,xp FROM vybe_escritorio_carteiras WHERE pessoa_id=${p}`;return c?[Number(c.saldo),Number(c.xp)]:[0,0];};
const evento=(db,conteudo,tipo,para,autor=null,de=null,em=null)=>db.query(`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id,em) VALUES($1,$2,$3,$4,$5,COALESCE($6::timestamptz,now()))`,[conteudo,tipo,de,para,autor,em]);
const hoje=diaBahia(new Date());
const dias=(iso,n)=>new Date(Date.UTC(...iso.split('-').map(Number).map((v,i)=>i===1?v-1:v))+n*864e5).toISOString().slice(0,10);

test('Solicitações: entrega, prazo e carteira uma vez por demanda; sem prazo não há extra',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,prazo) VALUES(10,8385559107,'pode_fazer','${dias(hoje,1)}'),(11,8385559107,'pode_fazer','${dias(hoje,-1)}'),(12,8385559107,'pode_fazer',NULL);
  INSERT INTO vybe_conteudo_responsaveis VALUES(10,4,0),(11,4,0),(12,4,0);INSERT INTO vybe_conteudo_clientes VALUES(10,1),(10,3);`);
 await evento(db,10,'status','Feito',4,'Pode Fazer');
 assert.deepEqual(await saldo(sql,4),[65,65]);           // 10 entrega + 5 prazo + 50 conquista (1ª demanda)
 assert.deepEqual(await saldo(sql,3),[5,5]);             // carteira laranja (Vinícius)
 assert.deepEqual(await saldo(sql,24),[0,0]);
 await evento(db,10,'status','Feito',4,'Alteração');     // reabrir e fechar de novo não credita
 assert.deepEqual(await saldo(sql,4),[65,65]);assert.deepEqual(await saldo(sql,3),[5,5]);
 await evento(db,11,'status','Feito',4);                 // atrasada: só a entrega
 await evento(db,12,'status','Feito',4);                 // sem prazo: só a entrega
 assert.deepEqual(await saldo(sql,4),[85,85]);
 const entregas=await sql`SELECT origem,regra FROM vybe_escritorio_entregas WHERE pessoa_id=4 ORDER BY origem`;
 assert.deepEqual(entregas.map(e=>e.origem),['demanda:10','demanda:11','demanda:12']);
 const e=await carregarEconomia(sql,4);
 assert.equal(e.pontos.nivel,2);assert.equal(e.pontos.xpTotal,85);assert.equal(e.pontos.funcao,'criacao');
 assert.equal(e.pontos.meta.entregas,3);assert.equal(e.pontos.meta.meta,1);
 assert.ok(e.pontos.extrato.some(l=>l.descricao==='Entrega dentro do prazo'&&Number(l.moedas)===5));
});
test('Produção: aprovação, aprovada sem alteração, alteração (uma por dia, para no zero) e agendamento',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,prazo) VALUES(20,7829537690,'em_andamento','${hoje}'),(21,7829537690,'em_andamento',NULL),(22,7829537690,'para_agendar',NULL),(23,7829537690,'em_andamento',NULL);
  INSERT INTO vybe_conteudo_responsaveis VALUES(20,6,0),(21,7,0),(23,2,0);INSERT INTO vybe_conteudo_clientes VALUES(21,2),(20,1);`);
 await evento(db,20,'status','Para aprovação',6,'Em andamento');
 assert.deepEqual(await saldo(sql,6),[15,15]);           // 10 + 5 no prazo
 await evento(db,20,'status','Para aprovação',6,'Alteração');
 assert.deepEqual(await saldo(sql,6),[15,15]);
 await evento(db,20,'status','Alteração',4,'Para aprovação');
 assert.deepEqual(await saldo(sql,6),[10,15]);           // perde 5 moedas, XP fica
 await evento(db,20,'status','Alteração',4,'Para aprovação');
 assert.deepEqual(await saldo(sql,6),[10,15]);           // mesma peça, mesmo dia: uma vez
 await evento(db,20,'status','Para agendar',4,'Para aprovação');
 assert.deepEqual(await saldo(sql,6),[10,15]);           // teve alteração: sem bônus
 assert.deepEqual(await saldo(sql,3),[0,0]);             // e a carteira também não
 await evento(db,21,'status','Para aprovação',7,'Em andamento');
 await evento(db,21,'status','Para agendar',4,'Para aprovação');
 assert.deepEqual(await saldo(sql,7),[15,15]);           // 10 aprovação + 5 aprovada de primeira
 assert.deepEqual(await saldo(sql,24),[5,5]);            // carteira azul (Ewerton)
 await evento(db,21,'status','Finalizado',5,'Para agendar');
 assert.deepEqual(await saldo(sql,5),[5,5]);             // Tainara agendou
 await evento(db,21,'status','Finalizado',5,'Agendado');
 assert.deepEqual(await saldo(sql,5),[5,5]);
 await evento(db,22,'status','Finalizado',1,'Para agendar');
 assert.deepEqual(await saldo(sql,1),[0,0]);             // Paulo agendando não é Agendamento
 await evento(db,23,'status','Alteração',4,'Para aprovação');
 assert.deepEqual(await saldo(sql,2),[0,0]);             // Reriston sem saldo: a perda para no zero
 const [perda]=await sql`SELECT quantidade FROM vybe_escritorio_moedas WHERE pessoa_id=2 AND origem LIKE 'alteracao:23:%'`;
 assert.equal(Number(perda.quantidade),0);
 await evento(db,23,'status','Para aprovação',2,'Alteração');
 assert.deepEqual(await saldo(sql,2),[10,10]);           // sem responsável? tem: Reriston; sem prazo: só os 10
});
test('Produção e Gestão: captação ou material bruto uma vez por peça; briefing só de quem é da Gestão',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,briefing) VALUES(30,7829537690,'pode_fazer',NULL),(31,7829537690,'pode_fazer','Texto do briefing'),(32,7829537690,'pode_fazer','  '),(33,8385559107,'pode_fazer','Briefing')`);
 await evento(db,30,'captacao','Captação Feita',1,'Captação Agendada');
 assert.deepEqual(await saldo(sql,28),[10,10]);
 await evento(db,30,'material_bruto','https://drive.google.com/x',1);
 assert.deepEqual(await saldo(sql,28),[10,10]);
 await evento(db,31,'criacao','Card - Teste',1);
 await evento(db,32,'criacao','Card - Sem briefing',1);
 await evento(db,33,'criacao','Demanda',4);
 assert.deepEqual(await saldo(sql,1),[2,2]);
 assert.deepEqual(await saldo(sql,4),[0,0]);
});
test('rollback do evento desfaz pontos, entregas e recibo',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave) VALUES(20,7829537690,'em_andamento');INSERT INTO vybe_conteudo_responsaveis VALUES(20,6,0)`);
 await assert.rejects(sql.comTransacao(async tx=>{await tx`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para,autor_id) VALUES(20,'status','Para aprovação',6)`;throw new Error('interrompido');}),/interrompido/);
 assert.deepEqual(await saldo(sql,6),[0,0]);
 assert.equal((await sql`SELECT 1 FROM vybe_escritorio_entregas`).length,0);
});
test('regras na tabela mudam o resultado sem deploy; regra desligada não credita',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave) VALUES(20,7829537690,'em_andamento'),(21,7829537690,'em_andamento');INSERT INTO vybe_conteudo_responsaveis VALUES(20,6,0),(21,6,0);
  UPDATE vybe_escritorio_regras SET moedas=20,pontos=3 WHERE chave='criacao_aprovacao'`);
 await evento(db,20,'status','Para aprovação',6);
 assert.deepEqual(await saldo(sql,6),[20,3]);
 await db.exec(`UPDATE vybe_escritorio_regras SET ativa=false WHERE chave='criacao_aprovacao'`);
 await evento(db,21,'status','Para aprovação',6);
 assert.deepEqual(await saldo(sql,6),[20,3]);
});
test('fechamento do dia: vencida, sem vencida, agendamento, sem furo e dia ativo; só dias úteis; nunca duas vezes',async t=>{
 const {db,sql}=await banco(t,{semMarcas:true});
 const D='2026-10-14'; // quarta
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,prazo,veiculacao) VALUES
   (40,8385559107,'pode_fazer','${D}',NULL),(41,7829537690,'em_andamento','${dias(D,3)}',NULL),(42,7829537690,'para_agendar',NULL,'${D}'),(43,7829537690,'em_andamento',NULL,'${D}'),(44,7829537690,'para_aprovacao','${dias(D,-5)}',NULL);
  INSERT INTO vybe_conteudo_responsaveis VALUES(40,6,0),(41,7,0),(44,2,0);
  SELECT vybe_creditar_moedas(6,'conquista:teste',50);`);
 await evento(db,41,'comentario','x',6,null,D+BAHIA);
 const r=await fecharPontosEscritorio(sql,new Date('2026-10-15T03:10:00Z'),{janela:1});
 assert.deepEqual(r.dias.map(d=>d.dia),[D]);
 assert.deepEqual(await saldo(sql,6),[45,52]);           // −5 vencida (XP fica) +2 dia ativo
 assert.deepEqual(await saldo(sql,7),[5,5]);             // fila sem vencida
 assert.deepEqual(await saldo(sql,2),[0,0]);             // em aprovação não é atraso; sem fila, sem bônus
 assert.deepEqual(await saldo(sql,5),[0,0]);             // Para agendar vencido
 assert.deepEqual(await saldo(sql,1),[0,0]);             // furo: 43 veicula hoje e está aberta
 const de=await fecharPontosEscritorio(sql,new Date('2026-10-15T03:10:00Z'),{janela:1});
 assert.equal(de.dias.length,0);assert.deepEqual(await saldo(sql,6),[45,52]);
 await db.exec(`UPDATE vybe_conteudos SET status_chave='agendado' WHERE id=42;UPDATE vybe_conteudos SET status_chave='segurar_post',veiculacao='${dias(D,1)}' WHERE id=43;UPDATE vybe_conteudos SET prazo='${dias(D,5)}' WHERE id=40`);
 const amanha=await fecharPontosEscritorio(sql,new Date('2026-10-16T03:10:00Z'),{janela:1});
 assert.deepEqual(amanha.dias.map(d=>d.dia),[dias(D,1)]);
 assert.deepEqual(await saldo(sql,5),[5,5]);
 assert.deepEqual(await saldo(sql,1),[10,10]);
 assert.deepEqual(await saldo(sql,6),[50,57]);
 assert.equal((await sql`SELECT 1 FROM vybe_escritorio_entregas WHERE pessoa_id=1 AND regra='dia_sem_furo'`).length,1);
 // Dias que ficaram para trás (até 7) fecham com o estado atual; fim de semana só conta dia ativo.
 const atrasados=await fecharPontosEscritorio(sql,new Date('2026-10-16T03:10:00Z'));
 assert.deepEqual(atrasados.dias.map(d=>d.dia),['2026-10-09','2026-10-10','2026-10-11','2026-10-12','2026-10-13']);
 assert.deepEqual(atrasados.dias.filter(d=>!d.util).map(d=>d.dia),['2026-10-10','2026-10-11']);
 assert.deepEqual(await saldo(sql,2),[0,0]);
});
test('semana: meta pela média das últimas 8 semanas, bônus igual para quem bate, uma vez por semana',async t=>{
 const {db,sql}=await banco(t,{semMarcas:true});
 const linhas=[];
 const semanas=['2026-09-14','2026-09-21','2026-09-28','2026-10-05'];
 semanas.forEach((s,i)=>{for(let k=0;k<(i+1)*10;k++)linhas.push(`(7,'aprovacao:${s}-${k}','criacao_aprovacao','${s}')`);});
 for(let k=0;k<30;k++)linhas.push(`(7,'aprovacao:atual-${k}','criacao_aprovacao','${dias('2026-10-12',k%5)}')`);
 ['2026-09-28','2026-10-05'].forEach((s,i)=>{for(let k=0;k<3+2*i;k++)linhas.push(`(6,'aprovacao:j-${s}-${k}','criacao_aprovacao','${s}')`);});
 for(let k=0;k<3;k++)linhas.push(`(6,'aprovacao:j-atual-${k}','criacao_aprovacao','2026-10-13')`);
 linhas.push(`(28,'captacao:1','captacao','2026-10-14')`);
 linhas.push(`(1,'briefing:1','briefing','2026-10-14')`);            // briefing não é entrega: Paulo não bate meta
 await db.exec(`INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,dia) VALUES ${linhas.join(',')}`);
 const m=await metaDaSemana(sql,7,'2026-10-12');
 assert.deepEqual([m.meta,m.entregas,m.semanas,m.media],[25,30,4,25]);
 assert.deepEqual((({meta,entregas})=>[meta,entregas])(await metaDaSemana(sql,6,'2026-10-12')),[4,3]);
 assert.deepEqual((({meta,entregas,semanas})=>[meta,entregas,semanas])(await metaDaSemana(sql,28,'2026-10-12')),[1,1,0]);
 const r=await fecharPontosEscritorio(sql,new Date('2026-10-19T03:10:00Z'));
 assert.deepEqual(r.semanas.map(s=>s.inicio),['2026-10-05','2026-10-12']);
 const metas=async p=>(await sql`SELECT origem,quantidade,pontos FROM vybe_escritorio_moedas WHERE pessoa_id=${p} AND regra='meta_semanal' ORDER BY origem`).map(m=>[m.origem,Number(m.quantidade),Number(m.pontos)]);
 assert.deepEqual(await metas(7),[['semana:2026-10-05:meta',50,50],['semana:2026-10-12:meta',50,50]]); // 40 ≥ 20 e 30 ≥ 25
 assert.deepEqual(await metas(6),[['semana:2026-10-05:meta',50,50]]);                                  // 5 ≥ 3; depois 3 < 4
 assert.deepEqual(await metas(28),[['semana:2026-10-12:meta',50,50]]);                                 // sem histórico: meta 1
 assert.deepEqual(await metas(1),[['semana:2026-10-12:meta',50,50]]);                                  // briefing não é entrega; os 5 dias sem furo da semana são
 const de=await fecharPontosEscritorio(sql,new Date('2026-10-20T03:10:00Z'));
 assert.equal(de.semanas.length,0);assert.equal((await metas(7)).length,2);
});
test('chegada reconstrói o histórico (responsáveis, registro de responsáveis, autor) com teto nas moedas',async t=>{
 const {db,sql}=await banco(t,{historico:async db=>{
  await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave) VALUES(50,8385559107,'feito'),(51,8385559107,'feito'),(52,8385559107,'feito'),(53,7829537690,'finalizado'),(54,7829537690,'finalizado'),(55,7829537690,'finalizado'),(56,7829537690,'finalizado'),(57,7829537690,'finalizado');
   INSERT INTO vybe_conteudos(id,board_id,status_chave) SELECT 100+n,7829537690,'finalizado' FROM generate_series(1,120) n;
   INSERT INTO vybe_conteudo_responsaveis VALUES(50,4,0),(54,2,0);INSERT INTO vybe_conteudo_clientes VALUES(55,2),(56,1);
   INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id,em) VALUES
    (50,'status','Pode Fazer','Feito',4,'2026-09-01T15:00:00Z'),
    (51,'responsavel','sem responsável','Beatriz Rocha Cardoso, Jady Amynne Oliveira Lima',1,'2026-09-02T15:00:00Z'),(51,'status','Pode Fazer','Feito',1,'2026-09-03T15:00:00Z'),
    (52,'status','Pode Fazer','Feito',3,'2026-09-04T15:00:00Z'),
    (53,'status','Em andamento','Para aprovação',7,'2026-09-05T15:00:00Z'),(53,'status','Alteração','Para aprovação',7,'2026-09-06T15:00:00Z'),
    (54,'status','Em andamento','Para aprovação',1,'2026-09-05T15:00:00Z'),
    (55,'status','Para aprovação','Para agendar',4,'2026-09-07T15:00:00Z'),(55,'status','Para agendar','Finalizado',5,'2026-09-08T15:00:00Z'),
    (56,'status','Para aprovação','Alteração',4,'2026-09-07T15:00:00Z'),(56,'status','Para aprovação','Para agendar',4,'2026-09-09T15:00:00Z'),
    (57,'captacao','Captação Agendada','Captação Feita',1,'2026-09-10T15:00:00Z'),(57,'material_bruto',NULL,'https://drive',1,'2026-09-11T15:00:00Z');
   INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id,em) SELECT 100+n,'status','Em andamento','Para aprovação',6,'2026-09-12T15:00:00Z' FROM generate_series(1,120) n;`);
 }});
 const conta=async p=>(await sql`SELECT regra FROM vybe_escritorio_entregas WHERE pessoa_id=${p} ORDER BY regra`).map(r=>r.regra);
 assert.deepEqual(await conta(4),['entrega']);                       // 50: responsável atual
 assert.deepEqual(await conta(7),['criacao_aprovacao','entrega']);   // 51 pelo registro, 53 por mandar aprovar
 assert.deepEqual(await conta(3),['entrega']);                       // 52: quem marcou (não é carteira de 56, que teve alteração)
 assert.deepEqual(await conta(2),['criacao_aprovacao']);             // 54: Paulo mandou, Reriston era o responsável
 assert.deepEqual(await conta(24),['carteira']);                     // 55: cliente azul aprovado sem alteração
 assert.deepEqual(await conta(5),['agendamento']);
 assert.deepEqual(await conta(28),['captacao']);
 assert.deepEqual(await conta(1),[]);
 assert.equal((await conta(6)).length,121);
 assert.deepEqual(await saldo(sql,6),[200,1210]);                    // teto de 200 moedas; XP sem teto
 assert.deepEqual(await saldo(sql,7),[4,20]);
 assert.equal((await sql`SELECT TO_CHAR(dia,'YYYY-MM-DD') AS dia FROM vybe_escritorio_entregas WHERE pessoa_id=4`)[0].dia,'2026-09-01');
 await evento(db,50,'status','Feito',4);                             // já premiada na instalação: nada
 assert.deepEqual(await saldo(sql,4),[2,10]);
 await evento(db,53,'status','Para aprovação',7);                    // já contada no histórico: nada
 assert.deepEqual(await saldo(sql,7),[4,20]);
 // A instalação marca os 7 dias e as 2 semanas anteriores: o primeiro ciclo não fecha o passado.
 const marcas=await sql`SELECT chave FROM vybe_escritorio_fechamentos ORDER BY chave`;
 assert.equal(marcas.filter(m=>m.chave.startsWith('dia:')).length,7);assert.equal(marcas.filter(m=>m.chave.startsWith('semana:')).length,2);
 assert.ok(marcas.some(m=>m.chave==='dia:'+dias(hoje,-1)));
 assert.equal((await fecharPontosEscritorio(sql)).dias.length,0);
});
test('nível pelo XP e início da semana',()=>{
 assert.deepEqual(nivelPorXp(0),{nivel:1,xp:0,xpProximo:50,xpTotal:0});
 assert.deepEqual(nivelPorXp(85),{nivel:2,xp:35,xpProximo:110,xpTotal:85});
 assert.equal(nivelPorXp(160).nivel,3);
 assert.equal(inicioDaSemana('2026-10-18'),'2026-10-12');assert.equal(inicioDaSemana('2026-10-12'),'2026-10-12');
});
