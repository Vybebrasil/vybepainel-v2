// Sinuca nas mesas do Escritório: o triângulo, a física (a bola vai para a
// caçapa certa) e as regras da bola 8 (grupos, faltas, bola na mão, a 8 na
// hora certa, antes da hora e na saída).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio} from './escritorio-esquema.mjs';
import {iniciarSinuca,simular,jogarSinuca,vistaSinuca,RAIO,geometria,velocidadeDaForca,METROS_POR_UNIDADE,MEIO,CANTO} from '../server/escritorio-sinuca.js';

// Mesa arrumada: só as bolas dadas, o resto já caiu.
function mesa(bolas,extra={}){
 const b=Array(16).fill(null);for(const [n,p] of Object.entries(bolas))b[n]=p;
 return {bolas:b,vez:'desafiante',grupos:{desafiante:null,desafiado:null},bolaNaMao:false,tacadas:5,n:3,ultimo:null,...extra};
}
const DIAG=Math.PI/4; // da branca em (85,35) para a bola em (95,45) e a caçapa (100,50)
// Com a física de verdade (28/10/2026), a branca tacada no centro numa reta curta
// ainda rola quando chega e segue a bola para a caçapa, como no bar. Os testes
// das regras tacam como quem joga: um pouco abaixo do centro (tiro de parada).
const PARADA=-0.35;
// A força da barra que dá esta velocidade (m/s), pela mesma curva do servidor:
// os testes de física falam em velocidade, que é o que se mede numa mesa.
const F=(mps)=>((mps-0.1)/8.9)**0.4;
const tacar=(m,lado,angulo,forca,branca,efeito=PARADA)=>jogarSinuca(m,lado,{tipo:'tacar',angulo,forca,efeito,...(branca?{branca}:{})});

test('sinuca: triângulo com 15 bolas, a 8 no meio e um canto de cada grupo',()=>{
 const m=iniciarSinuca('desafiado',undefined,undefined,'bola8');
 const nums=m.bolas.map((p,n)=>p&&n).filter(n=>n!==null&&n!==false);
 assert.equal(m.bolas.filter(Boolean).length,16);assert.deepEqual(m.bolas[0],[25,25]);assert.equal(m.vez,'desafiado');
 const oito=m.bolas[8],x8=75+2*(2*m.r*0.866+0.02);assert.ok(Math.abs(oito[1]-25)<0.01&&Math.abs(oito[0]-x8)<0.01,'a 8 no meio da terceira fileira');
 assert.equal(m.r,RAIO,'partida nova usa a bola de 54 mm');
 const tras=m.bolas.map((p,n)=>[n,p]).filter(([n,p])=>p&&n&&p[0]>75+3.5*(2*m.r*0.866+0.02)).map(([n])=>n);
 assert.equal(tras.length,5);
 const cantos=tras.filter(n=>Math.abs(m.bolas[n][1]-25)>4.5);
 assert.equal(cantos.filter(n=>n<8).length,1);assert.equal(cantos.filter(n=>n>8).length,1);
 assert.ok(nums.length>=15);
});

test('sinuca: a física leva a bola para a caçapa e para tudo no fim',()=>{
 const r=simular(mesa({0:[85,35],3:[95,45]}).bolas,DIAG,0.5,PARADA);
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
 await db.exec(readFileSync('migrations/2026-10-27-escritorio-bots-temporadas.sql','utf8'));
 const x=await import('../server/escritorio-mesas.js');
 const {salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:3,nome:'Vinícius'}]);
 const MESA={jogo:'sinuca',camada:'jogos',movel:'bling15_pooltable@4,4'};
 const d=await x.desafiarMesa(sql,{id:1},salas,{para:'3',...MESA,chave:'sinuca-0001'});
 const r=await x.responderMesa(sql,{id:3},salas,{id:d.id,acao:'aceitar'});
 assert.equal(r.jogo.jogo,'sinuca');assert.equal(r.jogo.mesa.bolas.filter(Boolean).length,16,'a branca e as 15 bolas');assert.equal(r.jogo.mesa.modo,'parimpar');assert.deepEqual(r.jogo.mesa.grupos,{desafiante:null,desafiado:null},'mesa aberta');
 const quem=r.jogo.vez==='desafiante'?{id:1}:{id:3},outro=quem.id===1?{id:3}:{id:1};
 await assert.rejects(x.lanceMesa(sql,quem,{id:d.id,n:0,tipo:'tacar',angulo:0,forca:2}),/força/);
 const l=await x.lanceMesa(sql,quem,{id:d.id,n:0,tipo:'tacar',angulo:0.01,forca:0.9});
 assert.equal(l.jogo.n,1);
 const visto=await x.verMesa(sql,outro,d.id);
 assert.ok(visto.mesa.recentes.at(-1).quadros.length>2,'o outro recebe os quadros para animar');assert.equal(visto.mesa.recentes.at(-1).n,visto.mesa.n);
});

test('sinuca: efeito puxa ou segue a branca e a tacada traz os eventos do som',()=>{
 // Branca perto da bola (ainda escorregando quando chega): no centro ela para
 // quase seca (o tiro de parada); em cima segue; embaixo volta. Mede onde a
 // branca está 1 s depois da tacada.
 const b=Array(16).fill(null);b[0]=[40,25];b[5]=[46,25];
 const em1s=(e)=>simular(b,0,F(1.3),e).quadros[30][0]/10,contato=46-2*RAIO;
 assert.ok(Math.abs(em1s(0)-contato)<3,'no centro a branca para perto de onde bateu');
 assert.ok(em1s(1)>contato+10,'seguir leva a branca para a frente');
 assert.ok(em1s(-1)<contato-10,'puxar traz a branca para trás');
 const b2=Array(16).fill(null);b2[0]=[30,25];b2[5]=[50,25];
 const r=simular(b2,0,F(1.3),0);
 assert.deepEqual(r.eventos.map(e=>e.t).slice(0,2),['bola','tabela'],'bate na bola, que vai na tabela (e pode voltar)');
 assert.ok(r.eventos.every(e=>e.q<r.quadros.length&&e.f>0&&e.f<=1));
 assert.throws(()=>jogarSinuca(mesa({0:[30,25],5:[50,25]}),'desafiante',{tipo:'tacar',angulo:0,forca:0.3,efeito:2}),/Efeito/);
});

test('sinuca: a bola de 54 mm das partidas novas e a partida antiga com a bola de antes',()=>{
 // Partida gravada antes (sem m.r) segue com a bola de 1,15; a nova usa a de 54 mm.
 assert.equal(vistaSinuca(mesa({0:[50,25]}),'desafiante',false).r,1.15);
 const nova=iniciarSinuca('desafiante');
 assert.equal(RAIO,1.421,'54 mm numa mesa de 1,90 m');
 assert.equal(vistaSinuca(nova,'desafiante',false).r,RAIO);
 // Nenhuma bola do triângulo encosta na outra (com folga).
 const b=nova.bolas.filter(Boolean);
 for(let i=0;i<b.length;i++)for(let k=i+1;k<b.length;k++)assert.ok(Math.hypot(b[i][0]-b[k][0],b[i][1]-b[k][1])>=2*RAIO,'bolas sem sobreposição');
 // A bola maior vai para a caçapa do mesmo jeito.
 const r=simular(mesa({0:[85,35],3:[95,45]}).bolas,DIAG,0.5,PARADA,1.6);
 assert.deepEqual(r.caiu,[3]);
 // A saída espalha as bolas e alguma coisa se mexe de verdade.
 const s=jogarSinuca(nova,'desafiante',{tipo:'tacar',angulo:0,forca:1});
 assert.ok(s.mesa.bolas.some((p,n)=>p&&Math.hypot(p[0]-nova.bolas[n][0],p[1]-nova.bolas[n][1])>3));
});

test('sinuca par ou ímpar (partida de antes, sem a 1): grupos, falta, continua e quem ganha',()=>{
 const pi=(bolas,extra={})=>({...mesa(bolas,extra),modo:'parimpar',r:1.15,grupos:{desafiante:'pares',desafiado:'impares'}});
 // Encaçapou bola sua: continua.
 let r=tacar(pi({0:[85,35],4:[95,45],6:[20,20],3:[50,10],5:[10,40]}),'desafiante',DIAG,0.5);
 assert.equal(r.fim,null);assert.equal(r.mesa.vez,'desafiante');assert.equal(r.mesa.ultimo.falta,null);
 // Tocou primeiro a bola do outro: falta, bola na mão para ele.
 r=tacar(pi({0:[85,35],3:[95,45],6:[20,20],5:[10,40]}),'desafiante',DIAG,0.5);
 assert.equal(r.mesa.ultimo.falta,'errada');assert.equal(r.mesa.vez,'desafiado');assert.equal(r.mesa.bolaNaMao,true);
 // A última sua sem falta: ganhou.
 r=tacar(pi({0:[85,35],4:[95,45],3:[20,20]}),'desafiante',DIAG,0.5);
 assert.deepEqual(r.fim,{resultado:'desafiante',motivo:'todas'});
 assert.equal(vistaSinuca(r.mesa,'desafiante',true).modo,'parimpar');
});

// Paulo, 28/10/2026: "não tá todas as bolas". As 15 vão para a mesa e a 1 é a
// bola final: limpa o grupo e encaçapa a 1 para ganhar.
test('sinuca par ou ímpar com as 15 bolas: a 1 é a última, a 1 antes da hora perde e volta na saída',()=>{
 const m=iniciarSinuca('desafiante');
 assert.equal(m.modo,'parimpar');assert.equal(m.bola1,true);
 assert.equal(m.bolas.filter(Boolean).length,16,'a branca e as 15');
 assert.ok(m.bolas[1],'a 1 está na mesa');
 assert.deepEqual(m.grupos,{desafiante:null,desafiado:null},'mesa aberta na saída');
 const pi=(bolas,extra={})=>({...mesa(bolas,extra),modo:'parimpar',bola1:true,r:1.15,tacadas:3,grupos:{desafiante:'pares',desafiado:'impares'}});
 // Encaçapou a última sua: não ganha ainda, continua (falta a 1).
 let r=tacar(pi({0:[85,35],4:[95,45],1:[20,20],3:[50,10]}),'desafiante',DIAG,0.5);
 assert.equal(r.fim,null);assert.equal(r.mesa.vez,'desafiante');
 // Grupo limpo: tocar primeiro outra bola que não a 1 é falta.
 r=tacar(pi({0:[85,35],3:[95,45],1:[20,20]}),'desafiante',DIAG,0.5);
 assert.equal(r.mesa.ultimo.falta,'errada');assert.equal(r.mesa.vez,'desafiado');
 // Grupo limpo e a 1 na caçapa sem falta: ganhou.
 r=tacar(pi({0:[85,35],1:[95,45],3:[20,20]}),'desafiante',DIAG,0.5);
 assert.deepEqual(r.fim,{resultado:'desafiante',motivo:'um'});
 // Tacar na 1 antes de limpar o grupo: é falta, e a 1 na caçapa com falta perde.
 r=tacar(pi({0:[85,35],1:[95,45],4:[20,20]}),'desafiante',DIAG,0.5);
 assert.deepEqual(r.fim,{resultado:'desafiado',motivo:'um-falta'});
 // Na saída, a 1 que cai volta para a mesa.
 r=tacar({...pi({0:[85,35],1:[95,45],4:[20,20]}),tacadas:0},'desafiante',DIAG,0.5);
 assert.equal(r.fim,null);assert.ok(r.mesa.bolas[1],'a 1 voltou');
});

// Paulo, 28/10/2026: "melhorar a física". A caçapa é uma abertura na tabela com
// quinas: a bola reta cai, a que vem rente à tabela cai, e a que bate na quina volta.
test('sinuca: caçapa com boca e quinas (cai reta, cai rente à tabela, volta da quina)',()=>{
 const R=RAIO,b=(o)=>{const a=Array(16).fill(null);for(const[k,v] of Object.entries(o))a[k]=v;return a;};
 assert.deepEqual(simular(b({0:[80,30],3:[90,40]}),Math.atan2(10,10),0.5,PARADA,R).caiu.slice(0,1),[3],'reta no canto cai');
 assert.deepEqual(simular(b({0:[60,48.3]}),0,0.5,0,R).caiu,[0],'rente à tabela até o canto cai');
 assert.deepEqual(simular(b({0:[50,20]}),-Math.PI/2,0.5,0,R).caiu,[0],'reta na do meio cai');
 // Mira no fim da borracha de baixo, logo antes do dente do canto: bate e volta.
 const quina=simular(b({0:[80,25]}),Math.atan2(49.4-25,95.5-80),0.4,0,R);
 assert.deepEqual(quina.caiu,[],'bateu na quina e voltou');
 assert.ok(quina.bolas[0][0]<100&&quina.bolas[0][1]<50,'a branca ficou na mesa');
});

// Paulo, 28/10/2026: "quem matar primeiro fica com o que matou, se foi par
// (bolas preenchidas) ou ímpar (bola com listra branca)". Como no bar, a mesa
// começa aberta e a primeira bola encaçapada sem falta define o grupo.
test('sinuca par ou ímpar: mesa aberta, a primeira bola encaçapada define o grupo',()=>{
 const ab=(bolas,extra={})=>({...mesa(bolas,extra),modo:'parimpar',bola1:true,r:1.15,tacadas:3,grupos:{desafiante:null,desafiado:null}});
 // Encaçapou a 7 com a mesa aberta: fica com as ímpares e continua.
 let r=tacar(ab({0:[85,35],7:[95,45],4:[20,20],1:[50,10]}),'desafiante',DIAG,0.5);
 assert.deepEqual(r.mesa.grupos,{desafiante:'impares',desafiado:'pares'});assert.equal(r.mesa.vez,'desafiante');assert.equal(r.mesa.ultimo.grupo,'impares');
 // Encaçapou a 4: pares.
 r=tacar(ab({0:[85,35],4:[95,45],7:[20,20],1:[50,10]},{vez:'desafiado'}),'desafiado',DIAG,0.5);
 assert.deepEqual(r.mesa.grupos,{desafiado:'pares',desafiante:'impares'});
 // Mesa aberta: tocar a 1 primeiro é falta e, se ela cai, perde.
 r=tacar(ab({0:[85,35],1:[95,45],4:[20,20]}),'desafiante',DIAG,0.5);
 assert.deepEqual(r.fim,{resultado:'desafiado',motivo:'um-falta'});
 // Não encaçapou nada: a mesa continua aberta e a vez passa.
 r=tacar(ab({0:[20,25],4:[40,25],7:[20,15],1:[50,10]}),'desafiante',0,0.3);
 assert.deepEqual(r.mesa.grupos,{desafiante:null,desafiado:null});assert.equal(r.mesa.vez,'desafiado');
});

test('sinuca: caçapas medidas na arte da mesa e as tacadas recentes',()=>{
 const R=RAIO,b=(o)=>{const a=Array(16).fill(null);for(const[k,v] of Object.entries(o))a[k]=v;return a;};
 // Rente à tabela de cima, passando pela caçapa do meio: cai (o centro entra no buraco).
 assert.deepEqual(simular(b({0:[50,20]}),-Math.PI/2,F(1.65),0,R).caiu,[0],'reta na do meio cai');
 const rente=simular(b({0:[30,R]}),0,F(0.66),0,R);assert.deepEqual(rente.caiu,[],'rente à tabela, passa pela do meio (o buraco fica atrás da borracha)');assert.ok(rente.bolas[0][0]>52&&rente.bolas[0][0]<90);
 // Na diagonal até o canto: cai antes de chegar na quina.
 assert.deepEqual(simular(b({0:[10,10]}),-3*Math.PI/4,0.3,0,R).caiu,[0]);
 // As tacadas recentes: no máximo 4, em ordem, de no máximo dois lados seguidos.
 let m=iniciarSinuca('desafiante',()=>0);
 for(let i=0;i<7;i++)m=jogarSinuca(m,m.vez,{tipo:'tempo'}).mesa;
 assert.ok(m.recentes.length>=1&&m.recentes.length<=4);
 assert.deepEqual(m.recentes.map((t)=>t.n),m.recentes.map((_,i)=>m.n-m.recentes.length+1+i));
 const v=vistaSinuca(m,'desafiante');
 assert.equal(v.n,m.n);assert.equal(v.ultimo.quadros,undefined);assert.equal(v.recentes.length,m.recentes.length);
});

// Física de verdade (Paulo, 28/10/2026: "simular uma partida real pra medidas
// de bola, física, batidas de bola"). O jogo só passa se fizer o que uma mesa
// de verdade faz.
const so=(o)=>{const a=Array(16).fill(null);for(const[k,v] of Object.entries(o))a[k]=v;return a;};
test('sinuca real: medidas, força e distância rolando',()=>{
 assert.equal(METROS_POR_UNIDADE,0.019,'pano de 1,90 m');
 assert.ok(Math.abs(velocidadeDaForca(1)*METROS_POR_UNIDADE-9)<1e-9,'saída forte a 9 m/s');
 assert.ok(Math.abs(velocidadeDaForca(0)*METROS_POR_UNIDADE-0.1)<1e-9,'encostar a 0,10 m/s');
 // Tacada média (2,4 m/s) percorre umas 3 a 5 mesas, com as voltas na tabela.
 const r=simular(so({0:[10,25]}),0,F(2.44),0,RAIO);let d=0;
 for(let i=1;i<r.quadros.length;i++)d+=Math.hypot(r.quadros[i][0]-r.quadros[i-1][0],r.quadros[i][1]-r.quadros[i-1][1])/10;
 assert.ok(d>300&&d<500,`tacada média andou ${(d/100).toFixed(1)} mesas`);
 // Tacada fraca anda pouco.
 const f=simular(so({0:[50,25]}),0,F(0.19),0,RAIO).bolas[0][0]-50;assert.ok(f>2&&f<20,`tacada fraca andou ${f}`);
 // A mais fraca encosta: anda poucos centímetros.
 const m=simular(so({0:[50,25]}),0,0.05,0,RAIO).bolas[0][0]-50;assert.ok(m*METROS_POR_UNIDADE<0.05,`a mais fraca andou ${m*METROS_POR_UNIDADE} m`);
});
test('sinuca real: a regra dos 30° e o arrasto do corte',()=>{
 // Branca rolando, corte de meia bola: ela sai a uns 30° da linha da mira.
 const r=simular(so({0:[10,25],5:[40,25+RAIO]}),0,0.3,0,RAIO),q=r.quadros;
 const k=q.findIndex((f)=>Math.hypot(f[10]/10-40,f[11]/10-(25+RAIO))>0.5),a=q[k+25],c=q[k+5];
 const branca=Math.atan2(a[1]-c[1],a[0]-c[0])*180/Math.PI,bola=Math.atan2(a[11]-c[11],a[10]-c[10])*180/Math.PI;
 assert.ok(branca<-27&&branca>-36,`branca saiu a ${branca}°`);
 // A bola acertada sai a menos de 30° (o atrito entre as bolas a arrasta).
 assert.ok(bola>24&&bola<29.5,`bola acertada a ${bola}°`);
});
test('sinuca real: efeito lateral abre a volta para o lado do taco',()=>{
 const volta=(lado)=>{const q=simular(so({0:[70,25]}),0,F(1.04),0,RAIO,lado).quadros,i=q.findIndex((f,k)=>k&&f[0]<q[k-1][0]);return q[i+15][1]/10-25;};
 // Tacando para a direita da tela, a direita de quem taca é para baixo (y cresce).
 assert.ok(volta(1)>2,'taco à direita: volta para a direita');assert.ok(volta(-1)<-2,'taco à esquerda: volta para a esquerda');
 assert.ok(Math.abs(volta(0))<0.01,'sem efeito volta reta');
});
test('sinuca real: a saída espalha e derruba perto de uma bola, e a mira tem folga de gente',()=>{
 let cai=0;const n=40;
 for(let i=0;i<n;i++){let s=i*7919;const m=iniciarSinuca('desafiante',(k)=>(s=(s*48271+11)%2147483647)%k);cai+=simular(m.bolas,(i-n/2)*0.0008,1,0,m.r).caiu.filter(Boolean).length;}
 assert.ok(cai/n>0.2&&cai/n<2,`saída derrubou ${cai/n} em média`);
 // Bola reta no canto, a branca a 28 da bola e a bola a 28 do canto: a física
 // honesta pede uns 0,7° de precisão (errar 0,1° na branca já desvia a bola
 // acertada em 1°); a medida é a de mesa de verdade, não de arcade.
 const B=[65,35],O=[85,15],C=[100,0],dx=C[0]-O[0],dy=C[1]-O[1],d=Math.hypot(dx,dy),g=[O[0]-dx/d*2*RAIO,O[1]-dy/d*2*RAIO],base=Math.atan2(g[1]-B[1],g[0]-B[0]);
 const entra=[];for(let a=-3;a<=3;a+=0.05){const r=simular(so({0:B,2:O}),base+a*Math.PI/180,0.4,0,RAIO);if(r.caiu.includes(2))entra.push(a);}
 assert.ok(entra.at(-1)-entra[0]>0.4&&entra.at(-1)-entra[0]<2,`janela de ${entra.at(-1)-entra[0]}°`);
});
test('sinuca real: a geometria tem 18 paredes (6 borrachas e 12 dentes) e 6 buracos, com a boca do canto de 1,5 bola',()=>{
 const g=geometria();assert.equal(g.paredes.length,18);assert.equal(g.buracos.length,6);
 const boca=Math.hypot(CANTO.boca,CANTO.boca);assert.ok(Math.abs(boca/(2*RAIO)-1.5)<0.01,`boca do canto de ${boca/(2*RAIO)} bolas`);
});
test('sinuca real: o arrasto do corte é maior devagar, e o efeito lateral desvia a branca (squirt)',()=>{
 // Corte de meia bola com a branca escorregando (perto): a bola acertada sai a menos de 30°, mais ainda devagar.
 // Direção da bola acertada logo depois do choque (antes de chegar numa tabela).
 const saida=(mps)=>{const z=simular(so({0:[35,25],5:[40,25+RAIO]}),0,F(mps),0,RAIO).quadros,k=z.findIndex((q)=>Math.hypot(q[10]/10-40,q[11]/10-(25+RAIO))>0.3),a=z[k],b=mps<1?z.at(-1):z[k+5];return Math.atan2(b[11]-a[11],b[10]-a[10])*180/Math.PI;};
 const devagar=saida(0.38),forte=saida(3.4);
 assert.ok(devagar<forte-1,`devagar ${devagar}° e forte ${forte}°`);assert.ok(30-devagar>3&&30-devagar<9,`arrasto devagar de ${30-devagar}°`);
 // Taco à direita: a branca sai um pouco para a esquerda de quem taca (y diminui tacando para a direita).
 const y=(lado)=>simular(so({0:[20,25]}),0,F(1.04),0,RAIO,lado).quadros[15][1]/10-25;
 assert.ok(y(1)<-0.05&&y(-1)>0.05&&Math.abs(y(0))<1e-9,`desvio ${y(1)} / ${y(-1)}`);
});
test('sinuca real: taco inclinado faz a bola pular e, com efeito, fazer a curva (massé)',()=>{
 const alto=(r)=>Math.max(0,...r.alturas.filter(Boolean).flatMap((a)=>a.filter((_,i)=>i%2).map((z)=>z/10)));
 assert.equal(alto(simular(so({0:[20,25]}),0,F(3),0,RAIO)),0,'taco deitado: a bola não sai do pano');
 const pulo=alto(simular(so({0:[20,25]}),0,F(4),0,RAIO,0,{elevacao:45}))*METROS_POR_UNIDADE;
 assert.ok(pulo>0.01&&pulo<0.1,`taco a 45° a 4 m/s pula ${pulo} m`);
 const y=(lado)=>{const q=simular(so({0:[20,25]}),0,F(1),0,RAIO,lado,{elevacao:45}).quadros;return q[Math.min(q.length-1,45)][1]/10-25;};
 assert.ok(y(1)>3&&y(-1)<-3,'massé: curva para o lado do efeito');
 assert.throws(()=>jogarSinuca(mesa({0:[30,25],5:[50,25]}),'desafiante',{tipo:'tacar',angulo:0,forca:0.3,elevacao:80}),/Incline o taco/);
});
test('sinuca real: bola voando passa a tabela e sai da mesa; volta para a marca e é falta',()=>{
 const r=simular(so({0:[50,12]}),-Math.PI/2,1,0,RAIO,0,{elevacao:55});
 assert.deepEqual(r.fora,[0],'a branca pulou a tabela');
 // Bola da mesa que pula: volta para a marca, falta de quem tacou.
 const m={...mesa({0:[50,20],4:[50,12],1:[20,40],3:[80,40]}),modo:'parimpar',bola1:true,r:RAIO,grupos:{desafiante:'pares',desafiado:'impares'}};
 const j=jogarSinuca(m,'desafiante',{tipo:'tacar',angulo:-Math.PI/2,forca:1,elevacao:40});
 if(j.mesa.ultimo.fora.includes(4)){assert.ok(j.mesa.bolas[4],'a 4 voltou');assert.equal(j.mesa.ultimo.falta,'fora');assert.equal(j.mesa.vez,'desafiado');}
});
test('sinuca real: bola rápida demais sacode na boca; caçapa do meio na medida oficial; pano de bar e de torneio',()=>{
 let cai=0;for(let d=-0.6;d<=0.6;d+=0.1)if(simular(so({0:[20,20]}),-3*Math.PI/4+d*Math.PI/180,F(5),0,RAIO).caiu.includes(0))cai++;
 assert.equal(cai,13,'a 5 m/s a reta no canto entra');
 let forte=0;for(let d=-0.6;d<=0.6;d+=0.1)if(simular(so({0:[20,20]}),-3*Math.PI/4+d*Math.PI/180,1,0,RAIO).caiu.includes(0))forte++;
 assert.ok(forte<13,'a 9 m/s ela bate no fundo e às vezes volta');
 assert.ok(Math.abs((2*MEIO.boca)/(2*RAIO)-1.5)<0.01,'boca do meio de 1,5 bola');
 assert.equal(iniciarSinuca('desafiante').pano,'bar');
 const anda=(pano)=>simular(so({0:[10,25]}),0,F(0.6),0,RAIO,0,{pano}).bolas[0][0];
 assert.ok(anda('torneio')>anda('bar')+3,'pano de torneio é mais rápido');
});
