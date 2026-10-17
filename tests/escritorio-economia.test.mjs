import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conexao} from './postgres.mjs';
import {comprarMovel,carregarEconomia} from '../server/escritorio-economia.js';
import {configurarQuarto,validarPisoQuarto} from '../server/escritorio-quartos.js';
async function banco(t) {
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true,pode_entrar boolean DEFAULT true);
 INSERT INTO vybe_pessoas(id,nome) VALUES(1,'Paulo'),(2,'Jady');
 CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,status_chave text);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text);
 CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);
 CREATE TABLE vybe_conteudo_eventos(id bigserial PRIMARY KEY,conteudo_id bigint,tipo text,para text);
 INSERT INTO vybe_conteudos VALUES(1,8385559107,'aberta'),(2,7829537690,'aberta'),(3,8385559107,'final'),(4,8385559107,'aberta'),(5,8385559107,'feito');
 INSERT INTO vybe_status VALUES(8385559107,'final','Finalizado'),(8385559107,'feito','Feito');
 INSERT INTO vybe_conteudo_responsaveis VALUES(1,1),(2,1),(3,1),(4,1),(5,1);`);
 for(const f of ['2026-10-15-escritorio.sql','2026-10-16-escritorio-mapa.sql','2026-10-17-escritorio-vybecoins.sql']) await db.exec(readFileSync('migrations/'+f,'utf8'));
 return {db,sql};
}
test('finalização premia só demandas e uma vez, com conquista única; produção e legado não premiam',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para) VALUES(1,'status',NULL)`);
 assert.equal((await carregarEconomia(sql,1)).saldo,0);
 await db.exec(`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para) VALUES(1,'status','Finalizado'),(1,'status','Finalizado'),(2,'status','Finalizado'),(3,'status','Finalizado');`);
 assert.equal((await carregarEconomia(sql,1)).saldo,60);
 await db.exec(`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para) VALUES(4,'status','Feito'),(5,'status','Feito');`);
 assert.equal((await carregarEconomia(sql,1)).saldo,70);
 await db.exec(`DELETE FROM vybe_conteudo_responsaveis WHERE conteudo_id=1;INSERT INTO vybe_conteudo_responsaveis VALUES(1,2);INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para) VALUES(1,'status','Finalizado');`);
 assert.equal((await carregarEconomia(sql,2)).saldo,0);
});
test('compra debita atomicamente, repetições não duplicam, falhas não alteram saldo',async t=>{
 const {sql}=await banco(t);await sql`SELECT vybe_creditar_moedas(1,'conquista:teste',50)`;
 const compra={classe:'shelves_norja',chave:crypto.randomUUID()};
 assert.equal((await comprarMovel(sql,1,compra)).saldo,25);
 assert.equal((await comprarMovel(sql,1,compra)).inventario[0].quantidade,1);
 await assert.rejects(comprarMovel(sql,1,{...compra,classe:'shelves_silo'}),/já utilizado/);
 await comprarMovel(sql,1,{...compra,chave:crypto.randomUUID()});
 await assert.rejects(comprarMovel(sql,1,{...compra,chave:crypto.randomUUID()}),/insuficientes/);
 assert.equal((await carregarEconomia(sql,1)).saldo,0);
 await assert.rejects(comprarMovel(sql,2,compra),/insuficientes/);
});
test('configuração é individual e idempotente, salva a planta, móveis e conquista juntos',async t=>{
 const {sql}=await banco(t);
 const r=await configurarQuarto(sql,{id:1},{figura:'hd-180-1'},{planta:'ele',modelo:'trabalho'});
 assert.equal(r.perfil.sala_planta,'ele');assert.equal(r.economia.saldo,50);assert.ok(r.mapa.itens.some(it=>it[0]==='computer_flatscreen')); 
 await configurarQuarto(sql,{id:1},{},{planta:'compacto',modelo:'vazio'});
 const [p]=await sql`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=1`;
 assert.equal(p.preferencias.sala_planta,'ele');assert.equal((await carregarEconomia(sql,1)).saldo,50);
 const {salvarPerfilEscritorio}=await import('../server/escritorio.js');
 const atualizado=await salvarPerfilEscritorio(sql,1,{sala_planta:'compacto',quarto_configurado:false,figura:'hd-180-1'});
 assert.equal(atualizado.sala_planta,'ele');assert.equal(atualizado.quarto_configurado,true);
 await assert.rejects(configurarQuarto(sql,{id:2},{},{planta:'invalida',modelo:'vazio'}),/inválido/);
 assert.throws(()=>validarPisoQuarto('ele',[['chair_polyfon',0,0,2]]),/fora/);
});
test('rollback da finalização reverte moedas e recibo',async t=>{
 const {sql}=await banco(t);
 await assert.rejects(sql.comTransacao(async tx=>{await tx`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para) VALUES(1,'status','Finalizado')`;throw new Error('interrompido');}),/interrompido/);
 assert.equal((await carregarEconomia(sql,1)).saldo,0);
 const recibos=await sql`SELECT * FROM vybe_escritorio_demandas_premiadas WHERE conteudo_id=1`;assert.equal(recibos.length,0);
});
test('salvamento exige inventário do dono, não aceita classe livre ou móvel atravessando o piso',async t=>{
 const {sql}=await banco(t);
 const {salvarCamadaEscritorio,salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const pessoa={id:1};
 const setup=await configurarQuarto(sql,pessoa,{},{planta:'compacto',modelo:'vazio'});
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:2,nome:'Jady'}]);
 await assert.rejects(salvarCamadaEscritorio(sql,pessoa,salas,{camada:'sala-0',itens:[['shelves_norja',4,4,2]],versao:setup.mapa.versao}),/Compre/);
 await assert.rejects(salvarCamadaEscritorio(sql,pessoa,salas,{camada:'sala-0',itens:[['chair_polyfon',0,0,2]],versao:setup.mapa.versao}),/fora/);
 await assert.rejects(salvarCamadaEscritorio(sql,{id:2},salas,{camada:'sala-0',itens:[],versao:setup.mapa.versao}),/sua sala/);
 const [mapa]=await sql`SELECT itens,versao FROM vybe_escritorio_mapa WHERE camada='sala-0'`;assert.equal(mapa.itens.length,0);assert.equal(mapa.versao,setup.mapa.versao);
 assert.throws(()=>validarPisoQuarto('niveis',[['chair_polyfon',3,3,2]]),/escada/);
 assert.throws(()=>validarPisoQuarto('compacto',[['table_polyfon_small',7,7,2]],new Map([['table_polyfon_small',{x:2,y:2}]])),/fora/);
});
test('plantas mantêm porta alcançável e a escada é a rota real entre patamares',async()=>{
 const vm=await import('node:vm');
 const {QUARTOS}=await import('../server/escritorio-quartos.js');
 const c=vm.createContext({console,escritorio:{base:{quartos:QUARTOS}}});
 vm.runInContext(readFileSync('vybe-escritorio-planta.js','utf8')+'\n'+readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 for(const p of QUARTOS.plantas) {
  c.modelo=p.id;
  const r=vm.runInContext(`(()=>{const a={...ESCRITORIO_PLANTA.ambientes.find(a=>a.id==='sala-0'),planta:modelo};const p=escritorioPlantaDoQuarto(a);const g=mapaMontarGrade(p,[]);return {porta:mapaCaminho(g,p.entrada,p.saida),alto:mapaCaminho(g,p.entrada,{x:4,y:1}),salto:mapaPassa(g,0,4,0,-1),compacto:p.andavel(0,0)};})()`,c);
  assert.ok(r.porta,p.id+': porta acessível');
  if(p.id==='niveis') {assert.ok(r.alto.some(t=>t.y===3&&(t.x===3||t.x===4)));assert.equal(r.salto,false);}
  if(p.id==='compacto') assert.equal(r.compacto,false);
 }
});

test('conquistas de cinco e dez entregas não se repetem; compras concorrentes não gastam além do saldo',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(`INSERT INTO vybe_conteudos SELECT n,8385559107,'aberta' FROM generate_series(10,19) n; INSERT INTO vybe_conteudo_responsaveis SELECT n,1 FROM generate_series(10,19) n;INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para) SELECT n,'status','Finalizado' FROM generate_series(10,19) n;`);
 assert.equal((await carregarEconomia(sql,1)).saldo,250);
 await db.exec(`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para) SELECT n,'status','Finalizado' FROM generate_series(10,19) n;`);
 assert.equal((await carregarEconomia(sql,1)).saldo,250);
 await sql`SELECT vybe_creditar_moedas(2,'conquista:teste',50)`;
 const resultados=await Promise.allSettled(Array.from({length:3},()=>comprarMovel(sql,2,{classe:'shelves_norja',chave:crypto.randomUUID()})));
 assert.equal(resultados.filter(r=>r.status==='fulfilled').length,2);assert.equal((await carregarEconomia(sql,2)).saldo,0);
});
test('trocar decoração legada exige histórico e preserva os móveis no inventário',async t=>{
 const {db,sql}=await banco(t);
 await sql`INSERT INTO vybe_escritorio_mapa(camada,itens,versao,atualizado_por) VALUES('sala-0','[["shelves_norja",0,0,2]]'::jsonb,2,1)`;
 await assert.rejects(configurarQuarto(sql,{id:1},{},{planta:'compacto',modelo:'trabalho'}),/fora/);
 assert.equal((await carregarEconomia(sql,1)).saldo,0);
 await assert.rejects(configurarQuarto(sql,{id:1},{},{planta:'compacto',modelo:'trabalho',preservar:false}),/histórico/);
 await db.exec(readFileSync('migrations/2026-10-17-escritorio-mapa-versoes.sql','utf8'));
 const r=await configurarQuarto(sql,{id:1},{},{planta:'compacto',modelo:'trabalho',preservar:false});
 assert.equal(r.economia.inventario.find(i=>i.classe==='shelves_norja').quantidade,1);
 const [v]=await sql`SELECT itens FROM vybe_escritorio_mapa_versoes WHERE camada='sala-0'`;
 assert.equal(v.itens[0][0],'shelves_norja');assert.equal(r.economia.saldo,50);
});
test('todos os modelos iniciais cabem nas seis plantas e deixam passagem pelas duas portas',async()=>{
 const vm=await import('node:vm');const {QUARTOS}=await import('../server/escritorio-quartos.js');
 const c=vm.createContext({console,escritorio:{base:{quartos:QUARTOS}}});
 vm.runInContext(readFileSync('vybe-escritorio-planta.js','utf8')+'\n'+readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 for(const planta of QUARTOS.plantas) for(const modelo of QUARTOS.modelos) {
  const dimensoes=new Map(modelo.itens.map(([classe])=>[classe,JSON.parse(readFileSync('assets/escritorio/habbo/'+classe+'.json','utf8')).logic.model.dimensions]));
  validarPisoQuarto(planta.id,modelo.itens,dimensoes);
  c.itens=modelo.itens.map(([classe,x,y,dir,,altura=0])=>{const d=dimensoes.get(classe);return {classe,x,y,altura,dir,dim:dir===2||dir===6?{x:d.y,y:d.x}:d};});c.modelo=planta.id;
  for(const porta of ['baixo','direita']) {
   c.porta=porta;
   assert.ok(vm.runInContext(`(()=>{const a={...ESCRITORIO_PLANTA.ambientes.find(a=>a.id==='sala-0'),planta:modelo,porta};const p=escritorioPlantaDoQuarto(a);return mapaCaminho(mapaMontarGrade(p,itens),p.entrada,{x:3,y:2});})()`,c),planta.id+'/'+modelo.id+'/'+porta);
  }
 }
});
