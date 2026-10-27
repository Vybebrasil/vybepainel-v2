// Sinuca nas mesas do Escritório: o triângulo, a física (a bola vai para a
// caçapa certa) e as regras da bola 8 (grupos, faltas, bola na mão, a 8 na
// hora certa, antes da hora e na saída).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio} from './escritorio-esquema.mjs';
import {iniciarSinuca,simular,jogarSinuca,vistaSinuca} from '../server/escritorio-sinuca.js';

// Mesa arrumada: só as bolas dadas, o resto já caiu.
function mesa(bolas,extra={}){
 const b=Array(16).fill(null);for(const [n,p] of Object.entries(bolas))b[n]=p;
 return {bolas:b,vez:'desafiante',grupos:{desafiante:null,desafiado:null},bolaNaMao:false,tacadas:5,n:3,ultimo:null,...extra};
}
const DIAG=Math.PI/4; // da branca em (85,35) para a bola em (95,45) e a caçapa (100,50)
const tacar=(m,lado,angulo,forca,branca)=>jogarSinuca(m,lado,{tipo:'tacar',angulo,forca,...(branca?{branca}:{})});

test('sinuca: triângulo com 15 bolas, a 8 no meio e um canto de cada grupo',()=>{
 const m=iniciarSinuca('desafiado');
 const nums=m.bolas.map((p,n)=>p&&n).filter(n=>n!==null&&n!==false);
 assert.equal(m.bolas.filter(Boolean).length,16);assert.deepEqual(m.bolas[0],[25,25]);assert.equal(m.vez,'desafiado');
 const oito=m.bolas[8],x8=75+2*(2*m.r*0.866+0.02);assert.ok(Math.abs(oito[1]-25)<0.01&&Math.abs(oito[0]-x8)<0.01,'a 8 no meio da terceira fileira');
 assert.equal(m.r,1.45,'partida nova usa a bola maior');
 const tras=m.bolas.map((p,n)=>[n,p]).filter(([n,p])=>p&&n&&p[0]>83).map(([n])=>n);
 assert.equal(tras.length,5);
 const cantos=tras.filter(n=>Math.abs(m.bolas[n][1]-25)>4.5);
 assert.equal(cantos.filter(n=>n<8).length,1);assert.equal(cantos.filter(n=>n>8).length,1);
 assert.ok(nums.length>=15);
});

test('sinuca: a física leva a bola para a caçapa e para tudo no fim',()=>{
 const r=simular(mesa({0:[85,35],3:[95,45]}).bolas,DIAG,0.5);
 assert.deepEqual(r.caiu,[3]);assert.equal(r.primeiro,3);
 assert.ok(r.bolas[0],'a branca ficou na mesa');
 assert.ok(r.quadros.length>2);assert.equal(r.quadros[0].length,32);
 // Tacada fraca no vazio: ninguém toca em nada.
 const fraca=simular(mesa({0:[50,25],5:[10,10]}).bolas,0,0.05);
 assert.equal(fraca.primeiro,null);assert.deepEqual(fraca.caiu,[]);
});

test('sinuca: grupos, continua quem encaçapa, faltas e bola na mão',()=>{
 // Mesa aberta: encaçapou a 3 (lisa) → lisas para quem tacou, e continua.
 let r=tacar(mesa({0:[85,35],3:[95,45],9:[20,20],8:[50,10]}),'desafiante',DIAG,0.5);
 assert.deepEqual(r.mesa.grupos,{desafiante:'lisas',desafiado:'listradas'});assert.equal(r.mesa.vez,'desafiante');assert.equal(r.mesa.ultimo.falta,null);
 assert.throws(()=>tacar(r.mesa,'desafiado',0,0.5),/vez da outra/);
 // Tocar primeiro a bola do outro é falta: bola na mão para o outro.
 const lisas={desafiante:'lisas',desafiado:'listradas'};
 r=tacar(mesa({0:[85,35],9:[95,45],2:[20,20],8:[50,10]},{grupos:lisas}),'desafiante',DIAG,0.5);
 assert.equal(r.mesa.ultimo.falta,'errada');assert.equal(r.mesa.vez,'desafiado');assert.equal(r.mesa.bolaNaMao,true);
 // Branca na caçapa: some da mesa e o outro põe onde quiser.
 r=tacar(mesa({0:[5,5],2:[60,30],9:[20,40],8:[50,10]},{grupos:lisas}),'desafiante',-3*Math.PI/4,0.3);
 assert.equal(r.mesa.ultimo.falta,'branca');assert.equal(r.mesa.bolas[0],null);assert.equal(r.mesa.bolaNaMao,true);
 assert.throws(()=>tacar(r.mesa,'desafiado',0,0.5),/Ponha a branca/);
 assert.throws(()=>tacar(r.mesa,'desafiado',0,0.5,{x:60,y:30}),/em cima de outra bola/);
 const depois=tacar(r.mesa,'desafiado',Math.PI,0.2,{x:40,y:40});
 assert.equal(depois.mesa.ultimo.lado,'desafiado');
 // Errar tudo também é falta.
 r=tacar(mesa({0:[50,25],2:[10,10],9:[90,40],8:[30,45]},{grupos:lisas}),'desafiante',0,0.05);
 assert.equal(r.mesa.ultimo.falta,'nenhuma');
 assert.equal(vistaSinuca(r.mesa,'desafiado',false).pode_tacar,true);
 assert.equal(vistaSinuca(r.mesa,'desafiante',false).pode_tacar,false);
});

test('sinuca: a 8 ganha com o grupo limpo, perde antes da hora e volta na saída',()=>{
 const lisas={desafiante:'lisas',desafiado:'listradas'};
 // Grupo limpo (nenhuma lisa na mesa): a 8 na caçapa ganha.
 let r=tacar(mesa({0:[85,35],8:[95,45],9:[20,20]},{grupos:lisas}),'desafiante',DIAG,0.5);
 assert.deepEqual(r.fim,{resultado:'desafiante',motivo:'oito'});
 // Ainda tem lisa: mirar na 8 já é falta, e ela caindo perde a partida.
 r=tacar(mesa({0:[85,35],8:[95,45],2:[20,20],9:[20,40]},{grupos:lisas}),'desafiante',DIAG,0.5);
 assert.deepEqual(r.fim,{resultado:'desafiado',motivo:'oito-falta'});
 // A 8 que cai junto com a bola da vez, com lisa ainda na mesa: antes da hora.
 r=tacar(mesa({0:[85,35],2:[95,45],8:[2,48],3:[20,20],9:[20,40]},{grupos:lisas,tacadas:5}),'desafiante',DIAG,0.5);
 assert.equal(r.fim,null,'a 8 longe da caçapa não cai');
 // Na saída a 8 que cai volta para a marca e o jogo segue.
 const saida=mesa({0:[85,35],8:[95,45],2:[20,20],9:[20,40]},{tacadas:0});
 r=tacar(saida,'desafiante',DIAG,0.5);
 assert.equal(r.fim,null);assert.ok(r.mesa.bolas[8],'a 8 voltou');assert.equal(r.mesa.bolas[8][1],25);
});

test('mesa de sinuca: começa pela mesa genérica e anima a tacada para os dois',async t=>{
 const {db,sql}=await bancoEscritorio(t);
 await db.exec(readFileSync('migrations/2026-10-18-escritorio-postits-presentes.sql','utf8'));
 await db.exec(readFileSync('migrations/2026-10-27-escritorio-mesas.sql','utf8'));
 await db.exec(readFileSync('migrations/2026-10-27-escritorio-poker-mesa-cheia.sql','utf8'));
 const x=await import('../server/escritorio-mesas.js');
 const {salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:3,nome:'Vinícius'}]);
 const MESA={jogo:'sinuca',camada:'jogos',movel:'bling15_pooltable@4,4'};
 const d=await x.desafiarMesa(sql,{id:1},salas,{para:'3',...MESA,chave:'sinuca-0001'});
 const r=await x.responderMesa(sql,{id:3},salas,{id:d.id,acao:'aceitar'});
 assert.equal(r.jogo.jogo,'sinuca');assert.equal(r.jogo.mesa.bolas.filter(Boolean).length,16);
 const quem=r.jogo.vez==='desafiante'?{id:1}:{id:3},outro=quem.id===1?{id:3}:{id:1};
 await assert.rejects(x.lanceMesa(sql,quem,{id:d.id,n:0,tipo:'tacar',angulo:0,forca:2}),/força/);
 const l=await x.lanceMesa(sql,quem,{id:d.id,n:0,tipo:'tacar',angulo:0.01,forca:0.9});
 assert.equal(l.jogo.n,1);
 const visto=await x.verMesa(sql,outro,d.id);
 assert.ok(visto.mesa.ultimo.quadros.length>2,'o outro recebe os quadros para animar');
});

test('sinuca: efeito puxa ou segue a branca e a tacada traz os eventos do som',()=>{
 const b=Array(16).fill(null);b[0]=[30,25];b[5]=[50,25];
 const parada=simular(b,0,0.35,0).bolas[0][0],segue=simular(b,0,0.35,1).bolas[0][0],puxa=simular(b,0,0.35,-1).bolas[0][0];
 assert.ok(segue>parada+5,'seguir leva a branca para a frente');
 assert.ok(puxa<parada-10,'puxar traz a branca para trás');
 const r=simular(b,0,0.35,0);
 assert.deepEqual(r.eventos.map(e=>e.t),['bola','tabela']);
 assert.ok(r.eventos.every(e=>e.q<r.quadros.length&&e.f>0&&e.f<=1));
 assert.throws(()=>jogarSinuca(mesa({0:[30,25],5:[50,25]}),'desafiante',{tipo:'tacar',angulo:0,forca:0.3,efeito:2}),/Efeito/);
});

test('sinuca: a bola maior das partidas novas e a partida antiga com a bola de antes',()=>{
 // Partida gravada antes (sem m.r) segue com a bola de 1,15; a nova usa 1,45.
 assert.equal(vistaSinuca(mesa({0:[50,25]}),'desafiante',false).r,1.15);
 const nova=iniciarSinuca('desafiante');
 assert.equal(vistaSinuca(nova,'desafiante',false).r,1.45);
 // Nenhuma bola do triângulo encosta na outra (com folga).
 const b=nova.bolas.filter(Boolean);
 for(let i=0;i<b.length;i++)for(let k=i+1;k<b.length;k++)assert.ok(Math.hypot(b[i][0]-b[k][0],b[i][1]-b[k][1])>=2*1.45,'bolas sem sobreposição');
 // A bola maior vai para a caçapa do mesmo jeito.
 const r=simular(mesa({0:[85,35],3:[95,45]}).bolas,DIAG,0.5,0,1.45);
 assert.deepEqual(r.caiu,[3]);
 // A saída espalha as bolas e alguma coisa se mexe de verdade.
 const s=jogarSinuca(nova,'desafiante',{tipo:'tacar',angulo:0,forca:1});
 assert.ok(s.mesa.bolas.some((p,n)=>p&&Math.hypot(p[0]-nova.bolas[n][0],p[1]-nova.bolas[n][1])>3));
});
