// Loja fase 2: preço por faixa, estoque esgotado, vitrine por semana, móvel só
// por marco e marcos idempotentes (docs/escritorio-pontos.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio as banco} from './escritorio-esquema.mjs';
import {comprarMovel,carregarEconomia,carregarLoja,infoMovel,vitrineDaSemana} from '../server/escritorio-economia.js';
import {conferirMarcos,conferirMarcosDaEquipe,MARCOS} from '../server/escritorio-marcos.js';
import {diaBahia,inicioDaSemana,somarDias} from '../server/escritorio-pontos.js';
const saldo=async(sql,p)=>{const [c]=await sql`SELECT saldo,xp FROM vybe_escritorio_carteiras WHERE pessoa_id=${p}`;return c?[Number(c.saldo),Number(c.xp)]:[0,0];};
const creditar=(sql,p,n)=>sql`SELECT vybe_lancar_pontos(${p},${'teste:'+crypto.randomUUID()},NULL,NULL,${n},0)`;
const umaClasse=async(sql,raridade)=>(await sql`SELECT classe FROM vybe_escritorio_catalogo WHERE raridade=${raridade} AND marco IS NULL ORDER BY classe LIMIT 1`)[0].classe;
const inventario=async(sql,p,classe)=>Number((await sql`SELECT quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${p} AND classe=${classe}`)[0]?.quantidade||0);
// O relógio real: as compras gravam criado_em=now(), e a vitrine olha a semana corrente.
const AGORA=new Date(), SEMANA=inicioDaSemana(diaBahia(AGORA));
const em=(iso,hora)=>new Date(`${iso}T${hora}-03:00`);

test('preço vem da faixa na tabela; comum e raro sempre à venda; essenciais grátis; sem marcos repetidos',async t=>{
 const {sql}=await banco(t);
 await creditar(sql,1,1000);
 const raro=await umaClasse(sql,'raro');
 let e=await comprarMovel(sql,1,{classe:'shelves_norja',chave:crypto.randomUUID()},AGORA);
 assert.equal(e.saldo,975);                                   // comum: 25
 assert.equal(infoMovel(e.loja,'shelves_norja').raridade,'comum');
 e=await comprarMovel(sql,1,{classe:raro,chave:crypto.randomUUID()},AGORA);
 assert.equal(e.saldo,855);                                   // raro: 120
 assert.equal(infoMovel(e.loja,raro).restante,9);             // estoque padrão da faixa (10) menos a venda
 await sql`UPDATE vybe_escritorio_raridades SET preco=100 WHERE chave='raro'`;
 e=await comprarMovel(sql,1,{classe:raro,chave:crypto.randomUUID()},AGORA);
 assert.equal(e.saldo,755);                                   // novo preço da faixa, sem deploy
 await sql`UPDATE vybe_escritorio_catalogo SET preco=30 WHERE classe=${raro}`;
 e=await comprarMovel(sql,1,{classe:raro,chave:crypto.randomUUID()},AGORA);
 assert.equal(e.saldo,725);                                   // preço próprio do móvel vale sobre o da faixa
 await assert.rejects(comprarMovel(sql,1,{classe:'exe_table',chave:crypto.randomUUID()},AGORA),/gratuitos/);
 await assert.rejects(comprarMovel(sql,1,{classe:'nao_existe',chave:crypto.randomUUID()},AGORA),/não está disponível/);
 assert.equal(e.inventario.find(i=>i.classe===raro).quantidade,3);
});
test('estoque esgotado: o último exemplar vai para uma pessoa só, mesmo em compras ao mesmo tempo',async t=>{
 const {sql}=await banco(t);
 const raro=await umaClasse(sql,'raro');
 await sql`UPDATE vybe_escritorio_catalogo SET estoque=2 WHERE classe=${raro}`;
 for(const p of [1,2,3]) await creditar(sql,p,500);
 const r=await Promise.allSettled([1,2,3].map(p=>comprarMovel(sql,p,{classe:raro,chave:crypto.randomUUID()},AGORA)));
 assert.equal(r.filter(x=>x.status==='fulfilled').length,2);
 assert.match(r.find(x=>x.status==='rejected').reason.message,/Esgotado/);
 const loja=await carregarLoja(sql,AGORA);
 assert.equal(infoMovel(loja,raro).restante,0);
 await assert.rejects(comprarMovel(sql,1,{classe:raro,chave:crypto.randomUUID()},AGORA),/Esgotado/);
 // Quem comprou gastou; quem não comprou ficou com o saldo inteiro.
 const saldos=await Promise.all([1,2,3].map(p=>saldo(sql,p).then(s=>s[0])));
 assert.deepEqual(saldos.sort(),[380,380,500]);
 const [v]=await sql`SELECT vendidos FROM vybe_escritorio_catalogo WHERE classe=${raro}`;assert.equal(Number(v.vendidos),2);
});
test('vitrine da semana: 6 muito raros e 2 lendários fixos por semana; fora dela não se compra; esgotar não tira da vitrine',async t=>{
 const {sql}=await banco(t);
 await creditar(sql,1,5000);
 const loja=await carregarLoja(sql,AGORA);
 assert.equal(loja.semana,SEMANA);
 const faixa=c=>loja.itens.find(i=>i.classe===c).raridade;
 assert.equal(loja.vitrine.length,8);
 assert.deepEqual(loja.vitrine.map(faixa),['muito_raro','muito_raro','muito_raro','muito_raro','muito_raro','muito_raro','lendario','lendario']);
 assert.ok(loja.vitrine.every(c=>!loja.itens.find(i=>i.classe===c).marco));
 assert.deepEqual((await carregarLoja(sql,em(somarDias(SEMANA,6),'20:00:00'))).vitrine,loja.vitrine); // domingo: mesma semana
 const proxima=await carregarLoja(sql,em(somarDias(SEMANA,7),'01:00:00'));                           // segunda 01:00 da Bahia
 assert.equal(proxima.semana,somarDias(SEMANA,7));assert.notDeepEqual(proxima.vitrine,loja.vitrine);
 const fora=loja.itens.find(i=>i.raridade==='muito_raro'&&!i.marco&&!loja.vitrine.includes(i.classe)).classe;
 await assert.rejects(comprarMovel(sql,1,{classe:fora,chave:crypto.randomUUID()},AGORA),/vitrine desta semana/);
 assert.equal(infoMovel(loja,fora).naVitrine,false);
 const lendario=loja.vitrine[7];
 const e=await comprarMovel(sql,1,{classe:lendario,chave:crypto.randomUUID()},AGORA);
 assert.equal(e.saldo,3500);                                  // lendário: 1.500
 assert.equal(infoMovel(e.loja,lendario).restante,0);
 assert.deepEqual(e.loja.vitrine,loja.vitrine);               // esgotou nesta semana: continua na vitrine, como "Esgotado"
 await assert.rejects(comprarMovel(sql,2,{classe:lendario,chave:crypto.randomUUID()},AGORA),/Esgotado/);
 // Na semana seguinte o esgotado sai do sorteio.
 assert.ok(!(await carregarLoja(sql,em(somarDias(SEMANA,9),'15:00:00'))).vitrine.includes(lendario));
 // O sorteio é só função da semana e do móvel.
 assert.deepEqual(vitrineDaSemana({semana:SEMANA,raridades:loja.raridades,itens:loja.itens,vendidosNaSemana:[lendario]}),e.loja.vitrine);
});
test('móvel só por marco não se compra; o marco traz o móvel e a conquista uma vez, mesmo conferindo de novo',async t=>{
 const {sql}=await banco(t);
 await creditar(sql,1,5000);
 await assert.rejects(comprarMovel(sql,1,{classe:'se_trophyG',chave:crypto.randomUUID()},AGORA),/marco/);
 assert.equal(infoMovel(await carregarLoja(sql,AGORA),'se_trophyG').marco,'nivel20');
 assert.ok(!(await carregarLoja(sql,AGORA)).vitrine.includes('se_trophyG'));
 // XP alto (chegada) leva ao nível 20 (6.620 XP): marcos de nível saem conquistados, com o sofá do nível 20.
 await sql`SELECT vybe_lancar_pontos(1,'xp:teste',NULL,NULL,0,7000)`;
 const antes=await saldo(sql,1);
 const lista=await conferirMarcos(sql,1,AGORA);
 const ok=lista.filter(m=>m.ok).map(m=>m.id);
 assert.deepEqual(ok,['nivel5','nivel10','nivel20']);
 assert.deepEqual(lista.find(m=>m.id==='nivel20').moveis,['se_trophyG']);
 assert.equal(await inventario(sql,1,'se_trophyG'),1);
 assert.deepEqual(await saldo(sql,1),[antes[0]+150,antes[1]+150]);
 const de_novo=await conferirMarcos(sql,1,AGORA);
 assert.deepEqual(de_novo.filter(m=>m.ok).map(m=>m.id),ok);
 assert.equal(await inventario(sql,1,'se_trophyG'),1);
 assert.deepEqual(await saldo(sql,1),[antes[0]+150,antes[1]+150]);
 assert.equal(de_novo.find(m=>m.id==='nivel20').em.toISOString(),lista.find(m=>m.id==='nivel20').em.toISOString());
 // A ficha lista todos os marcos, conquistados ou não, com o móvel de cada um.
 assert.equal(lista.length,MARCOS.length);
 assert.deepEqual(lista.find(m=>m.id==='duzentas').moveis,['trophy_ltd23_goldmonsterplant']);
});
test('marcos de contagem contam toda entrega e substituem as conquistas antigas do gatilho; quem já tinha não ganha de novo',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave) VALUES(10,8385559107,'pode_fazer'),(20,7829537690,'em_andamento');
  INSERT INTO vybe_conteudo_responsaveis VALUES(10,4,0),(20,6,0);
  INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para,autor_id) VALUES(10,'status','Feito',4);
  SELECT vybe_creditar_moedas(6,'conquista:primeira-demanda',50);`);
 assert.deepEqual(await saldo(sql,4),[10,10]);                // só a entrega: o gatilho não dá mais a 1ª demanda
 const e=await carregarEconomia(sql,4,{agora:AGORA});
 assert.deepEqual(await saldo(sql,4),[110,110]);              // marcos "Primeira entrega" e "Fila em dia" dão a conquista (50 cada)
 assert.deepEqual(e.marcos.filter(m=>m.ok).map(m=>m.id),['primeira','zerado']);
 assert.equal((await sql`SELECT 1 FROM vybe_escritorio_moedas WHERE pessoa_id=4 AND origem='conquista:primeira-demanda'`).length,1);
 // Jady já tinha a conquista antiga: entrega de Produção conta, o marco aparece, mas não paga duas vezes.
 await db.exec(`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para,autor_id) VALUES(20,'status','Para aprovação',6)`);
 assert.deepEqual(await saldo(sql,6),[60,60]);
 const j=await conferirMarcos(sql,6,AGORA);
 assert.ok(j.find(m=>m.id==='primeira').ok);
 assert.deepEqual(await saldo(sql,6),[110,110]);              // só "Fila em dia" paga; a 1ª entrega já estava paga
 // Fechamento da equipe confere todo mundo que tem função, sem abrir a ficha.
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave) SELECT n,8385559107,'pode_fazer' FROM generate_series(30,39) n;
  INSERT INTO vybe_conteudo_responsaveis SELECT n,2,0 FROM generate_series(30,39) n;
  INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para,autor_id) SELECT n,'status','Feito',2 FROM generate_series(30,39) n;`);
 assert.deepEqual(await saldo(sql,2),[100,100]);
 const r=await conferirMarcosDaEquipe(sql,AGORA);
 assert.equal(r.pessoas,9);assert.ok(r.novos>=2);
 assert.deepEqual(await saldo(sql,2),[250,250]);              // primeira + dez + fila em dia (50 cada)
 assert.deepEqual((await sql`SELECT marco FROM vybe_escritorio_marcos WHERE pessoa_id=2 ORDER BY marco`).map(m=>m.marco),['dez','primeira','zerado']);
});
test('compra pela metade (falha) não deixa venda nem móvel; repetição da mesma chave não cobra de novo',async t=>{
 const {sql}=await banco(t);
 await creditar(sql,1,200);
 const raro=await umaClasse(sql,'raro');
 const compra={classe:raro,chave:crypto.randomUUID()};
 const e1=await comprarMovel(sql,1,compra,AGORA);
 const e2=await comprarMovel(sql,1,compra,AGORA);
 assert.equal(e1.saldo,80);assert.equal(e2.saldo,80);assert.equal(await inventario(sql,1,raro),1);
 const [v]=await sql`SELECT vendidos FROM vybe_escritorio_catalogo WHERE classe=${raro}`;assert.equal(Number(v.vendidos),1);
 await assert.rejects(comprarMovel(sql,1,{classe:raro,chave:crypto.randomUUID()},AGORA),/insuficientes/);
 const [v2]=await sql`SELECT vendidos FROM vybe_escritorio_catalogo WHERE classe=${raro}`;assert.equal(Number(v2.vendidos),1);
});
// A migração das conquistas vem depois da economia de 20/10 (em produção, nessa ordem).
const MIGRACAO_CONQUISTAS=readFileSync('migrations/2026-10-20-escritorio-conquistas.sql','utf8');
test('conquistas por fazer as coisas: entregas adiantadas, semana sem atraso e segundo andar, cada uma com seu móvel',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(MIGRACAO_CONQUISTAS);
 const hoje=diaBahia(AGORA), depois=somarDias(hoje,5);
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,prazo) SELECT n,8385559107,'pode_fazer','${depois}' FROM generate_series(40,49) n;
  INSERT INTO vybe_conteudo_responsaveis SELECT n,3,0 FROM generate_series(40,49) n;
  INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para,autor_id) SELECT n,'status','Feito',3 FROM generate_series(40,49) n;
  INSERT INTO vybe_escritorio_perfis(pessoa_id,preferencias) VALUES(3,'{"sala_andares":[{"andar":1,"quarto_configurado":true}]}')
  ON CONFLICT (pessoa_id) DO UPDATE SET preferencias=EXCLUDED.preferencias;`);
 const lista=await conferirMarcos(sql,3,AGORA);
 const ok=lista.filter(m=>m.ok).map(m=>m.id);
 for (const id of ['adiantado10','semana','andar2']) assert.ok(ok.includes(id),id);
 assert.ok(!ok.includes('adiantado100') && !ok.includes('presente'));
 assert.equal(await inventario(sql,3,'trophy_snowstorm_bronze'),1);
 assert.equal(await inventario(sql,3,'bc_blocktrophy_1'),1);
 // Toda conquista da lista tem um móvel.
 assert.ok(lista.every(m=>m.moveis.length>=1),lista.filter(m=>!m.moveis.length).map(m=>m.id).join());
 // Móvel de conquista não se compra.
 await creditar(sql,3,5000);
 await assert.rejects(comprarMovel(sql,3,{classe:'prize3',chave:crypto.randomUUID()},AGORA),/marco/);
});
test('devolução única: quem já tinha a conquista recebe o móvel que sumiu, e rodar de novo não duplica',async t=>{
 const {db,sql}=await banco(t);
 const migracao=MIGRACAO_CONQUISTAS;
 await db.exec(migracao);
 // Conquistas registradas antes dos reinícios, inventário vazio; uma pessoa já tem o troféu.
 await db.exec(`INSERT INTO vybe_escritorio_marcos(pessoa_id,marco) VALUES(4,'duzentas'),(4,'primeira'),(5,'duzentas');
  INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(5,'trophy_ltd23_goldmonsterplant',1);
  DELETE FROM vybe_escritorio_reinicios WHERE chave='conquistas-2026-10-20';`);
 await db.exec(migracao);
 assert.equal(await inventario(sql,4,'trophy_ltd23_goldmonsterplant'),1);
 assert.equal(await inventario(sql,4,'prize3'),1);
 assert.equal(await inventario(sql,5,'trophy_ltd23_goldmonsterplant'),1);
 await db.exec(`DELETE FROM vybe_escritorio_inventario WHERE pessoa_id=4`);
 await db.exec(migracao);                                    // marcador: não devolve outra vez
 assert.equal(await inventario(sql,4,'prize3'),0);
});
