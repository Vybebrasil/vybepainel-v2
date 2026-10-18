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
 for(const planta of QUARTOS.plantas.filter(p=>p.legado)) for(const modelo of QUARTOS.modelos) {
  const dimensoes=new Map(modelo.itens.map(([classe])=>[classe,JSON.parse(readFileSync('assets/escritorio/habbo/'+classe+'.json','utf8')).logic.model.dimensions]));
  validarPisoQuarto(planta.id,modelo.itens,dimensoes);
  c.itens=modelo.itens.map(([classe,x,y,dir,,altura=0])=>{const d=dimensoes.get(classe);return {classe,x,y,altura,dir,dim:dir===2||dir===6?{x:d.y,y:d.x}:d};});c.modelo=planta.id;
  for(const porta of ['baixo','direita']) {
   c.porta=porta;
   assert.ok(vm.runInContext(`(()=>{const a={...ESCRITORIO_PLANTA.ambientes.find(a=>a.id==='sala-0'),planta:modelo,porta};const p=escritorioPlantaDoQuarto(a);return mapaCaminho(mapaMontarGrade(p,itens),p.entrada,{x:3,y:2});})()`,c),planta.id+'/'+modelo.id+'/'+porta);
  }
 }
});

// Plantas por formato e tamanho (scripts/quartos-plantas.mjs): o modelo vai
// para o canto de baixo à direita de cada tamanho; com ele montado, as duas
// portas continuam no piso e todo ladrilho livre do quarto (inclusive o
// mezanino, pela escada) é alcançável a pé a partir da entrada.
test('plantas novas (formato × tamanho): portas no piso, modelo cabe e o quarto inteiro é alcançável',async()=>{
 const vm=await import('node:vm');const {QUARTOS,itensDoModelo}=await import('../server/escritorio-quartos.js');
 const novas=QUARTOS.plantas.filter(p=>!p.legado);
 assert.ok(novas.length>=20,'há formatos e tamanhos para escolher');
 assert.ok(new Set(novas.map(p=>p.tamanho)).size===6 && new Set(novas.map(p=>p.formato)).size>=8);
 const c=vm.createContext({console,escritorio:{base:{quartos:QUARTOS}}});
 vm.runInContext(readFileSync('vybe-escritorio-planta.js','utf8')+'\n'+readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 for(const planta of novas) for(const modelo of QUARTOS.modelos) {
  const itens=itensDoModelo(planta.id,modelo);
  const fichas=new Map(itens.map(([classe])=>[classe,JSON.parse(readFileSync('assets/escritorio/habbo/'+classe+'.json','utf8'))]));
  const dimensoes=new Map([...fichas].map(([classe,j])=>[classe,j.logic.model.dimensions]));
  // Altura do desenho (maior quadro): mesma regra de "rente ao piso" do mapa.
  const alto=(classe)=>Math.max(0,...Object.values(fichas.get(classe).spritesheet?.frames||{}).map(f=>f.frame?.h||0));
  validarPisoQuarto(planta.id,itens,dimensoes);
  // Tapete (sem altura) é rente ao piso, como no mapa: passa-se por cima.
  c.itens=itens.map(([classe,x,y,dir,,altura=0])=>{const d=dimensoes.get(classe);return {classe,x,y,altura,dir,plano:!altura&&!(d.z>0.05)&&alto(classe)<=(d.x+d.y)*16+12,dim:dir===2||dir===6?{x:d.y,y:d.x}:d};});c.modelo=planta.id;
  // Dois móveis sólidos no mesmo ladrilho (a luminária em cima da cadeira).
  const ocupado=new Map();
  for(const it of c.itens) if(!it.plano&&!it.altura) for(let i=0;i<it.dim.x;i++) for(let j=0;j<it.dim.y;j++) {
   const k=(it.x+i)+','+(it.y+j);assert.ok(!ocupado.has(k),planta.id+'/'+modelo.id+': '+it.classe+' em cima de '+ocupado.get(k));ocupado.set(k,it.classe);
  }
  for(const porta of ['baixo','direita']) {
   c.porta=porta;
   const faltam=vm.runInContext(`(()=>{const a={...ESCRITORIO_PLANTA.ambientes.find(a=>a.id==='sala-0'),planta:modelo,porta};const p=escritorioPlantaDoQuarto(a);const g=mapaMontarGrade(p,itens);
    if(!mapaCaminho(g,p.entrada,p.saida)) return ['porta'];
    const r=[];for(let x=0;x<p.W-1;x++)for(let y=0;y<p.H-1;y++){if(!p.andavel(x,y)||g.bloqueado[g.ind(x,y)]||g.assento.has(g.ind(x,y)))continue;if(!(x===p.entrada.x&&y===p.entrada.y)&&!mapaCaminho(g,p.entrada,{x,y}))r.push(x+','+y);}return r;})()`,c);
   assert.deepEqual([...faltam],[],planta.id+'/'+modelo.id+'/'+porta);
  }
 }
});

test('reforma exige versão, guarda decoração e pintura e não altera saldo ou inventário',async t=>{
 const {db,sql}=await banco(t);
 for(const f of ['2026-10-17-escritorio-mapa-versoes.sql','2026-10-17-escritorio-andares.sql']) await db.exec(readFileSync('migrations/'+f,'utf8'));
 const p={id:1}, r=await configurarQuarto(sql,p,{sala_piso:'madeira',sala_paredes:'c02'.repeat(48)},{planta:'quadrado-m',modelo:'trabalho'});
 const antes=await carregarEconomia(sql,1);
 await assert.rejects(configurarQuarto(sql,p,{},{planta:'galeria-g',modelo:'vazio',reformar:true,versao:99,preservar:false}),/mudou/);
 const novo=await configurarQuarto(sql,p,{sala_piso:'clara'},{planta:'galeria-g',modelo:'vazio',reformar:true,versao:r.mapa.versao,preservar:false,limparPintura:true});
 assert.equal(novo.perfil.sala_planta,'galeria-g');assert.equal(novo.perfil.sala_paredes,'');assert.equal(novo.mapa.itens.length,0);
 const [backup]=await sql`SELECT itens,quarto FROM vybe_escritorio_mapa_versoes WHERE camada='sala-0'`;
 assert.equal(backup.quarto.sala_planta,'quadrado-m');assert.equal(backup.quarto.sala_paredes,'c02'.repeat(48));assert.ok(backup.itens.length>0);
 assert.equal(novo.economia.saldo,antes.saldo);assert.deepEqual(novo.economia.inventario,antes.inventario);
 await assert.rejects(configurarQuarto(sql,p,{},{planta:'galeria-g',modelo:'vazio',reformar:true,versao:r.mapa.versao,preservar:false}),/mudou/);
});

test('segundo andar tem planta própria, preserva térreo e compartilha unidades do inventário',async t=>{
 const {db,sql}=await banco(t);
 for(const f of ['2026-10-17-escritorio-mapa-versoes.sql','2026-10-17-escritorio-andares.sql','2026-10-17-escritorio-andares.sql']) await db.exec(readFileSync('migrations/'+f,'utf8'));
 await assert.rejects(configurarQuarto(sql,{id:2},{},{planta:'quadrado-m',modelo:'vazio',andar:1,reformar:true,versao:0}),/térreo/);
 const p={id:1},root=await configurarQuarto(sql,p,{sala_piso:'madeira'},{planta:'quadrado-m',modelo:'vazio'});
 const top=await configurarQuarto(sql,p,{sala_piso:'clara'},{planta:'terracos-g',modelo:'dupla',andar:1,reformar:true,versao:0});
 assert.equal(top.camada,'sala-0-andar-1');assert.equal(top.perfil.sala_planta,'quadrado-m');assert.equal(top.perfil.sala_andares[0].sala_planta,'terracos-g');assert.equal(top.economia.saldo,root.economia.saldo);
 assert.deepEqual((await sql`SELECT itens FROM vybe_escritorio_mapa WHERE camada='sala-0'`)[0].itens,root.mapa.itens);
 const {salvarCamadaEscritorio,salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:2,nome:'Jady'}]);
 await comprarMovel(sql,1,{classe:'shelves_norja',chave:crypto.randomUUID()});
 const baixo=await salvarCamadaEscritorio(sql,p,salas,{camada:'sala-0',itens:[['shelves_norja',1,1,0]],versao:root.mapa.versao});
 await assert.rejects(salvarCamadaEscritorio(sql,p,salas,{camada:top.camada,itens:[['shelves_norja',1,1,0]],versao:top.mapa.versao}),/Compre/);
 await assert.rejects(salvarCamadaEscritorio(sql,{id:2},salas,{camada:top.camada,itens:[],versao:top.mapa.versao}),/sua sala/);
 await salvarCamadaEscritorio(sql,p,salas,{camada:'sala-0',itens:[],versao:baixo.versao});
 await salvarCamadaEscritorio(sql,p,salas,{camada:top.camada,itens:[['shelves_norja',1,1,0]],versao:top.mapa.versao});
 const {salvarPerfilEscritorio}=await import('../server/escritorio.js');
 const pintura=await salvarPerfilEscritorio(sql,1,{andar:1,sala_piso:'nogueira',sala_planta:'quadrado-p'});
 assert.equal(pintura.sala_piso,'madeira');assert.equal(pintura.sala_andares[0].sala_piso,'nogueira');assert.equal(pintura.sala_andares[0].sala_planta,'terracos-g');
 const malicioso=await salvarPerfilEscritorio(sql,1,{sala_andares:[{andar:1,sala_planta:'quadrado-p',quarto_configurado:false}]});
 assert.equal(malicioso.sala_andares[0].sala_planta,'terracos-g');assert.equal(malicioso.sala_andares[0].quarto_configurado,true);
 await assert.rejects(configurarQuarto(sql,p,{},{planta:'quadrado-m',modelo:'vazio',andar:2}),/inválido/);
});
test('planta desenhada salva junto com os móveis; porta e escada não mudam; móvel não fica sem piso',async t=>{
 const {sql}=await banco(t);
 const {salvarCamadaEscritorio,salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const {plantaQuarto}=await import('../server/escritorio-quartos.js');
 const pessoa={id:1};
 const setup=await configurarQuarto(sql,pessoa,{},{planta:'amplo',modelo:'vazio'});
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:2,nome:'Jady'}]);
 // Tira o ladrilho (0,0), sobe (1,0) a patamar e tenta mexer na porta (3,7).
 const celdas=[...'0'.repeat(400)];celdas[0]='v';celdas[1]='1';celdas[7*20+3]='v';
 const livres=celdas.join('');
 const p=plantaQuarto('amplo',livres);
 assert.equal(p.celdas[0][0],-1);assert.equal(p.celdas[0][1],1);assert.equal(p.celdas[7][3],0,'porta fica');
 assert.equal(plantaQuarto('amplo').celdas[0][0],0,'a planta original não muda');
 await assert.rejects(salvarCamadaEscritorio(sql,pessoa,salas,{camada:'sala-0',itens:[['exe_table',0,0,2]],versao:setup.mapa.versao,celdas:livres}),/fora/);
 await assert.rejects(salvarCamadaEscritorio(sql,pessoa,salas,{camada:'sala-0',itens:[],versao:setup.mapa.versao,celdas:'x'}),/inválida/);
 const r=await salvarCamadaEscritorio(sql,pessoa,salas,{camada:'sala-0',itens:[['exe_table',4,4,2]],versao:setup.mapa.versao,celdas:livres});
 assert.equal(r.celdas,livres);
 const [perfil]=await sql`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=1`;
 assert.equal(perfil.preferencias.sala_celdas,livres);
 // Salvar só os móveis (sem celdas) mantém a planta e continua conferindo o piso.
 await assert.rejects(salvarCamadaEscritorio(sql,pessoa,salas,{camada:'sala-0',itens:[['exe_table',0,0,2]],versao:r.versao}),/fora/);
});
test('perfil aceita luz conhecida e não muda a planta desenhada pelo salvamento de pintura',async t=>{
 const {sql}=await banco(t);
 const {perfilEscritorio,salvarPerfilEscritorio}=await import('../server/escritorio.js');
 assert.equal(perfilEscritorio({sala_luz:'roxa'}).sala_luz,'roxa');
 assert.equal(perfilEscritorio({sala_luz:'url(x)'}).sala_luz,'');
 assert.equal(perfilEscritorio({sala_celdas:'v'.repeat(400)}).sala_celdas,'v'.repeat(400));
 // Planta desenhada antiga (12 × 12) vale ampliada para 20 × 20.
 assert.equal(perfilEscritorio({sala_celdas:'v'.repeat(144)}).sala_celdas,('v'.repeat(12)+'0'.repeat(8)).repeat(12)+'0'.repeat(160));
 assert.equal(perfilEscritorio({sala_celdas:'z'.repeat(400)}).sala_celdas,'');
 sql.comTransacao ??= (fn)=>fn(sql);
 const salvo=await salvarPerfilEscritorio(sql,1,{sala_luz:'noite',sala_celdas:'v'.repeat(400)});
 assert.equal(salvo.sala_luz,'noite');assert.equal(salvo.sala_celdas,'');
});
test('blocos baixos sobem como no Habbo; torre alta é parede; bloco invisível é grátis',async()=>{
 const vm=await import('node:vm');
 const {QUARTOS}=await import('../server/escritorio-quartos.js');
 assert.ok(QUARTOS.essenciais.includes('vybe_bloco_invisivel') && QUARTOS.essenciais.includes('vybe_assento_invisivel'));
 const c=vm.createContext({console,escritorio:{base:{quartos:QUARTOS}}});
 vm.runInContext(readFileSync('vybe-escritorio-planta.js','utf8')+'\n'+readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 const r=vm.runInContext(`(()=>{const P={W:8,H:6,divisorias:[]};
  const b=(x,y,altura=0,classe='bc_block_0_recolorable')=>({classe,x,y,dir:0,altura,dim:{x:1,y:1,z:1},plano:false});
  const g=mapaMontarGrade(P,[b(2,1),b(3,1),b(3,1,1),b(5,1),b(5,1,1),b(5,1,2),b(1,4,0,'vybe_assento_invisivel')]);
  return {sobe:mapaPassa(g,1,1,1,0),degrau:mapaPassa(g,2,1,1,0),desce:mapaPassa(g,3,1,1,0),torre:mapaPassa(g,4,1,1,0),altura:g.subida[g.ind(3,1)],assento:g.assento.has(g.ind(1,4))};})()`,c);
 assert.deepEqual(JSON.parse(JSON.stringify(r)),{sobe:true,degrau:true,desce:true,torre:false,altura:2,assento:true});
});
test('física do Habbo: portão fechado bloqueia, cama deita, esteira/gelo/placa marcam o piso, móvel em cima de bloco bloqueia',async()=>{
 const vm=await import('node:vm');
 const {QUARTOS}=await import('../server/escritorio-quartos.js');
 const c=vm.createContext({console,escritorio:{base:{quartos:QUARTOS}}});
 vm.runInContext(readFileSync('vybe-escritorio-planta.js','utf8')+'\n'+readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 const r=vm.runInContext(`(()=>{const P={W:8,H:6,divisorias:[]};
  const m=(classe,x,y,extra={})=>({classe,x,y,dir:2,altura:0,estado:0,dim:{x:1,y:1,z:1},plano:false,...extra});
  const g=mapaMontarGrade(P,[m('classic1_gate',2,1),m('classic1_gate',2,3,{estado:1}),m('bed_polyfon_one',5,1,{dim:{x:1,y:3,z:1.7}}),
   m('sf_roller',0,4,{dim:{x:1,y:1,z:0.45}}),m('es_skating_ice',3,4,{dim:{x:2,y:2,z:0},plano:true}),m('wf_pressureplate',7,0,{dim:{x:1,y:1,z:0.2}}),
   m('bc_block_0_recolorable',6,4),m('mm_lamp',6,4,{altura:1,dim:{x:1,y:1,z:2}}),m('exe_table',7,4),m('computer_flatscreen',7,4,{altura:1,dim:{x:1,y:1,z:0.5}})]);
  const b=(x,y)=>g.bloqueado[g.ind(x,y)];
  return {fechado:b(2,1),aberto:b(2,3),cama:g.cama.get(g.ind(5,2))?.dir,camaLivre:b(5,2),esteira:g.piso.get(g.ind(0,4))?.tipo,alturaEsteira:Math.round(g.subida[g.ind(0,4)]*100)/100,
   gelo:g.piso.get(g.ind(4,5))?.tipo,placa:g.piso.get(g.ind(7,0))?.tipo,lampadaNoBloco:b(6,4),mesa:b(7,4)};})()`,c);
 assert.deepEqual(JSON.parse(JSON.stringify(r)),{fechado:1,aberto:0,cama:2,camaLivre:0,esteira:'esteira',alturaEsteira:0.45,gelo:'gelo',placa:'placa',lampadaNoBloco:1,mesa:1});
 // A mesa de centro ("coffee table") não serve café; a cafeteira serve.
 const fonte=readFileSync('vybe-escritorio.js','utf8');
 const cafe=new RegExp(fonte.match(/const ESCRITORIO_CAFE = \/(.+)\/;/)[1]);
 assert.ok(!cafe.test('hygge_c25_coffeetable') && !cafe.test('mafia_c26_coffeetable_dark'));
 assert.ok(cafe.test('ktchn15_coffeemaker') && cafe.test('hc2_coffee') && cafe.test('sunsetcafe_c20_coffeemachine'));
});
test('post-its: qualquer um cola, só autor, dono da sala ou admin tira; presente passa uma unidade guardada uma vez só',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-18-escritorio-postits-presentes.sql','utf8'));
 const {colarPostit,apagarPostit,listarPostits,darPresente}=await import('../server/escritorio-social.js');
 const {salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:2,nome:'Jady'}]);
 const sala=salas.find(s=>s.pessoa_id==='1').id;
 const id=await colarPostit(sql,{id:2},{camada:sala,lado:0,posicao:3,cor:'rosa',texto:'  Reunião  às 15h '});
 await assert.rejects(colarPostit(sql,{id:2},{camada:'geral',lado:0,posicao:3,cor:'rosa',texto:'x'}),/Sala inválida/);
 await assert.rejects(colarPostit(sql,{id:2},{camada:sala,lado:0,posicao:3,cor:'roxo',texto:'x'}),/Cor/);
 const lista=await listarPostits(sql,sala);assert.equal(lista.length,1);assert.equal(lista[0].texto,'Reunião às 15h');assert.equal(lista[0].nome,'Jady');
 const outro=await colarPostit(sql,{id:1},{camada:'cafe',lado:1,posicao:2,cor:'amarelo',texto:'Café novo'});
 await assert.rejects(apagarPostit(sql,{id:2},salas,outro),/Só quem escreveu/);
 assert.equal(await apagarPostit(sql,{id:1},salas,id),sala,'o dono da sala tira o recado de outra pessoa');
 // Presente: só unidade guardada, idempotente pela chave.
 await sql`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(1,0),(2,0) ON CONFLICT DO NOTHING`;
 await sql`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(1,'shelves_norja',1)`;
 await sql`INSERT INTO vybe_escritorio_mapa(camada,itens,versao) VALUES(${sala},${JSON.stringify([['shelves_norja',1,1,2,0,0]])}::jsonb,1)`;
 await assert.rejects(darPresente(sql,{id:1},salas,{para:'2',classe:'shelves_norja',chave:'presente-0001'}),/Guarde/);
 await sql`UPDATE vybe_escritorio_mapa SET itens='[]'::jsonb WHERE camada=${sala}`;
 await assert.rejects(darPresente(sql,{id:1},salas,{para:'1',classe:'shelves_norja',chave:'presente-0001'}),/outra pessoa/);
 await assert.rejects(darPresente(sql,{id:1},salas,{para:'2',classe:'exe_table',chave:'presente-0001'}),/não se dá/);
 const r1=await darPresente(sql,{id:1},salas,{para:'2',classe:'shelves_norja',chave:'presente-0001'});
 const r2=await darPresente(sql,{id:1},salas,{para:'2',classe:'shelves_norja',chave:'presente-0001'});
 assert.equal(r1.repetido,false);assert.equal(r2.repetido,true);
 const inv=await sql`SELECT pessoa_id,quantidade FROM vybe_escritorio_inventario WHERE classe='shelves_norja' ORDER BY pessoa_id`;
 assert.deepEqual(inv.map(i=>[String(i.pessoa_id),Number(i.quantidade)]),[['2',1]]);
});
test('porta do quarto muda de lado só com o vão livre',async t=>{
 const {sql}=await banco(t);
 const {salvarCamadaEscritorio,salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const {salvarPerfilEscritorio}=await import('../server/escritorio.js');
 const pessoa={id:1};
 const setup=await configurarQuarto(sql,pessoa,{},{planta:'amplo',modelo:'vazio'});
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:2,nome:'Jady'}]);
 const sala=salas.find(s=>s.pessoa_id==='1').id;
 // A porta da direita do "amplo" fica em x=7, y=3 e 4: uma cadeira ali impede.
 const r=await salvarCamadaEscritorio(sql,pessoa,salas,{camada:sala,itens:[['hc26_10',7,3,0]],versao:setup.mapa.versao});
 await assert.rejects(salvarPerfilEscritorio(sql,1,{sala_porta:'direita'},async()=>sala),/porta nova/);
 await salvarCamadaEscritorio(sql,pessoa,salas,{camada:sala,itens:[['hc26_10',2,2,0]],versao:r.versao});
 const p=await salvarPerfilEscritorio(sql,1,{sala_porta:'direita'},async()=>sala);
 assert.equal(p.sala_porta,'direita');
});
test('física vem da ficha oficial do Habbo: assentos, cama na cabeceira, degrau de 1,5 e empilhar só no que aceita',async()=>{
 const vm=await import('node:vm');
 const ficha=JSON.parse(readFileSync('assets/escritorio/habbo/fisica.json','utf8'));
 // Ficha gerada da furnidata: poltrona e cadeira de cinema sentam, cama deita, mesa aceita coisas em cima.
 assert.ok(ficha.exe_chair[0]&2 && ficha.theatre_seat[0]&2 && ficha.bed_polyfon_one[0]&4 && ficha.exe_table[0]&8);
 assert.ok(!(ficha.lodge_dark_minibar[0]&8),'o minibar não aceita nada em cima');
 const c=vm.createContext({console,window:{},document:{},__ficha:ficha});
 vm.runInContext(readFileSync('vybe-escritorio-planta.js','utf8')+'\n'+readFileSync('vybe-escritorio-mapa.js','utf8')+'\nMAPA_FISICA=__ficha;',c);
 const r=vm.runInContext(`(()=>{const P={W:8,H:6,divisorias:[]};
  const m=(classe,x,y,extra={})=>({classe,x,y,dir:0,altura:0,estado:0,dim:{x:1,y:1,z:1},plano:false,prof:0,...extra});
  const g=mapaMontarGrade(P,[m('exe_chair',1,1),m('theatre_seat',2,1),m('bed_polyfon_one',4,0,{dim:{x:1,y:3,z:1.7}}),m('greek_block',6,0,{dim:{x:2,y:1,z:0.5}}),
   m('bc_block_0_recolorable',0,4),m('bc_block_0_recolorable',1,4),m('bc_block_0_recolorable',1,4,{altura:1})]);
  const cab=g.cama.get(g.ind(4,2));
  return {poltrona:g.assento.has(g.ind(1,1)),cinema:g.assento.has(g.ind(2,1)),cabeceira:[cab.x,cab.y],greek:g.bloqueado[g.ind(6,0)],
   degrauUm:mapaPassa(g,0,5,0,-1),degrauDois:mapaPassa(g,1,5,0,-1),deUmParaDois:mapaPassa(g,0,4,1,0),degrau:MAPA_DEGRAU};})()`,c);
 assert.deepEqual(JSON.parse(JSON.stringify(r)),{poltrona:true,cinema:true,cabeceira:[4,0],greek:1,degrauUm:true,degrauDois:false,deUmParaDois:true,degrau:1.5});
});
test('catraca de mão única fica fechada na grade; cabines do mesmo modelo nas cenas comuns formam par',async()=>{
 const vm=await import('node:vm');
 const ficha=JSON.parse(readFileSync('assets/escritorio/habbo/fisica.json','utf8'));
 const c=vm.createContext({console,window:{},document:{},__ficha:ficha});
 vm.runInContext(readFileSync('vybe-escritorio-planta.js','utf8')+'\n'+readFileSync('vybe-escritorio-mapa.js','utf8')+'\nMAPA_FISICA=__ficha;',c);
 const r=vm.runInContext(`(()=>{const P={W:6,H:6,divisorias:[]};
  const g=mapaMontarGrade(P,[{classe:'onewaydoor_c22_rosegold',x:2,y:2,dir:2,altura:0,estado:1,dim:{x:1,y:1,z:0},plano:true,prof:0}]);
  const pares=[["praca",ESCRITORIO_PRACA],...ESCRITORIO_PLANTA.ambientes.filter(a=>a.cena).map(a=>[a.id,a])].flatMap(([id,a])=>escritorioMoveisDaCena(a).filter(it=>it[0]==='mafia_c26_teleport_dark').map(it=>id));
  return {catraca:g.bloqueado[g.ind(2,2)],pares};})()`,c);
 assert.equal(r.catraca,1,'mesmo aberta, a catraca não é caminho para quem não passa por ela');
 assert.deepEqual(JSON.parse(JSON.stringify(r.pares)).sort(),['praca','recepcao']);
});
test('construção como no Habbo: 1.500 móveis, altura até 40, cor do bloco no estado e quarto sem paredes',async()=>{
 const {itensValidos}=await import('../server/escritorio-mapa.js');
 const {perfilEscritorio}=await import('../server/escritorio.js');
 const {QUARTOS}=await import('../server/escritorio-quartos.js');
 const muitos=Array.from({length:1500},(_,i)=>['bc_block_0_recolorable',i%12,Math.floor(i/12)%12,0,100+(i%20)*5,Math.floor(i/144)]);
 assert.equal(itensValidos('sala-0',muitos).length,1500);
 assert.throws(()=>itensValidos('sala-0',[...muitos,muitos[0]]),/No máximo 1500/);
 assert.equal(itensValidos('sala-0',[['bc_block_0_recolorable',1,1,0,0,39.5]])[0][5],39.5);
 assert.throws(()=>itensValidos('sala-0',[['bc_block_0_recolorable',1,1,0,0,41]]),/altura/);
 assert.ok(QUARTOS.essenciais.includes('bc_block_0_recolorable'),'blocos de construção grátis, como o Builders Club');
 assert.equal(perfilEscritorio({sala_sem_paredes:true}).sala_sem_paredes,true);
 assert.equal(perfilEscritorio({sala_sem_paredes:'sim'}).sala_sem_paredes,false);
 const vm=await import('node:vm');
 const c=vm.createContext({console,window:{}});
 vm.runInContext(readFileSync('vybe-escritorio-planta.js','utf8')+'\n'+readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 const dados=JSON.parse(readFileSync('assets/escritorio/habbo/bc_block_0_recolorable.json','utf8'));
 c.dados=dados;
 const r=vm.runInContext(`({cor:mapaCorDoEstado(dados,100+7*5+3),sem:mapaCorDoEstado(dados,2),paredes:escritorioParedesDoQuarto({...ESCRITORIO_PLANTA.ambientes.find(a=>a.id==='sala-0'),semParedes:true}).length})`,c);
 assert.deepEqual(JSON.parse(JSON.stringify(r)),{cor:{estado:3,cor:'#ffd23f'},sem:{estado:2,cor:null},paredes:0});
});

test('salas comuns: só quem administra salva a camada da cena, sem inventário; o banco aceita o id da zona',async t=>{
 const {db,sql}=await banco(t);
 for(const f of ['2026-10-17-escritorio-mapa-versoes.sql','2026-10-17-escritorio-andares.sql','2026-10-18-escritorio-cenas-editaveis.sql']) await db.exec(readFileSync('migrations/'+f,'utf8'));
 const {salvarCamadaEscritorio,salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:2,nome:'Jady'}]);
 await assert.rejects(salvarCamadaEscritorio(sql,{id:2},salas,{camada:'lounge',itens:[['shelves_norja',1,1,0]],versao:0}),/administra/);
 // Sem compra: sala comum não usa inventário.
 const r=await salvarCamadaEscritorio(sql,{id:1,admin:true},salas,{camada:'lounge',itens:[['shelves_norja',1,1,0],['val_c20_tablecounter',4,2,0,0,0]],versao:0});
 assert.equal(r.versao,1);assert.equal(r.itens.length,2);
 const [linha]=await sql`SELECT itens FROM vybe_escritorio_mapa WHERE camada='lounge'`;
 assert.equal(linha.itens.length,2);
 // Planta desenhada não vale nas salas comuns (o formato fica no código).
 await assert.rejects(salvarCamadaEscritorio(sql,{id:1,admin:true},salas,{camada:'lounge',itens:[],versao:1,celdas:'p'.repeat(400)}),/Planta/);
 // Nome fora da lista continua recusado pelo banco e pelo servidor.
 await assert.rejects(salvarCamadaEscritorio(sql,{id:1,admin:true},salas,{camada:'cozinha',itens:[],versao:0}),/inválida/);
});
