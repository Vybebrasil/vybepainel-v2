import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function preparar(){
 const bolas=Array(16).fill(null);bolas[0]=[25,25];bolas[2]=[75,25];
 const estado={jogo:{id:17,n:2,eu:'desafiante',vez:'desafiante',estado:'jogando',mesa:{bolas,r:1.421,bolaNaMao:false,pode_tacar:true}},angulo:0,forca:.4};
 const pedidos=[],canvas={width:1376,height:768,getBoundingClientRect:()=>({left:0,top:0,width:1376,height:768}),setPointerCapture(){},classList:{add(){}}};
 const barra={getBoundingClientRect:()=>({left:0,top:0,width:500,height:32}),setPointerCapture(){}};
 const c=vm.createContext({registrarMesaEscritorio:v=>v,escritorioMesa:()=>estado,document:{addEventListener(){},querySelector:()=>null,activeElement:null},performance:{now:()=>0},lanceMesaEscritorio:(_,p)=>pedidos.push(p),escritorioAviso(){}});
 vm.runInContext(readFileSync('shared/escritorio-sinuca-mesa.js','utf8'),c);vm.runInContext(readFileSync('vybe-escritorio-sinuca-ui.js','utf8'),c);vm.runInContext(readFileSync('vybe-escritorio-sinuca.js','utf8'),c);vm.runInContext('sinucaPintar=()=>{}',c);
 const evento=(x,y,target=canvas,id=1,pointerType='mouse')=>({clientX:x,clientY:y,currentTarget:target,pointerId:id,pointerType,button:0});
 const mesa=(x,y,tipo,id=1,pointerType='mouse')=>{c.ev=evento(x,y,canvas,id,pointerType);vm.runInContext(`sinucaPonteiro(ev,'${tipo}')`,c);};
 const forca=(x,tipo,id=1)=>{c.ev=evento(x,16,barra,id);vm.runInContext(`sinucaForca${tipo}(ev)`,c);};
 return {estado,pedidos,c,mesa,forca,evento};
}
test('gesto: clique e tremor de 1 px miram sem disparar; caminho até a barra preserva a mira',()=>{
 const t=preparar();t.mesa(996,383.5,'down');t.mesa(995,383.5,'up');
 assert.equal(t.pedidos.length,0);assert.equal(t.estado.travada,true);assert.equal(t.estado.angulo,0);
 t.mesa(900,680,'move');assert.equal(t.estado.angulo,0,'hover não muda a direção confirmada');
 t.forca(125,'Comeca');t.forca(125,'Solta');assert.equal(t.pedidos.length,0,'clique na força só seleciona');assert.equal(t.estado.forca,.25);assert.equal(t.estado.angulo,0);
});
test('gesto: arrasto deliberado usa o ângulo fotografado ao começar, não um estado mutável',()=>{
 const t=preparar();t.mesa(996,383.5,'down');t.estado.angulo=.7;t.mesa(896,383.5,'move');t.mesa(896,383.5,'up');
 assert.equal(t.pedidos.length,1);assert.equal(t.pedidos[0].angulo,0);assert.ok(t.pedidos[0].forca>.1);assert.equal(t.estado.gesto,null);
});
test('gesto: cancelamento limpa a carga; movimento ou soltura posterior não disparam',()=>{
 const t=preparar();t.mesa(996,383.5,'down');t.mesa(896,383.5,'move');t.c.cancel={pointerId:1};vm.runInContext('sinucaGestoCancelar(cancel)',t.c);
 t.mesa(850,383.5,'move');t.mesa(850,383.5,'up');assert.equal(t.pedidos.length,0);assert.equal(t.estado.puxada,null);assert.equal(t.estado.gesto,null);assert.equal(t.estado.puxando,null);
});
test('gesto: mudança de rodada ou outro ponteiro não conclui uma tacada antiga',()=>{
 const t=preparar();t.forca(50,'Comeca',1);t.forca(300,'Move',2);t.forca(300,'Solta',2);assert.equal(t.pedidos.length,0);assert.equal(t.estado.gesto.pointerId,1);
 t.estado.jogo.n++;t.forca(300,'Solta',1);assert.equal(t.pedidos.length,0);assert.equal(t.estado.gesto,null);
});
test('gesto: barra arrastada dispara uma única vez com a força final e o ângulo original',()=>{
 const t=preparar();t.forca(50,'Comeca');t.estado.angulo=.5;t.forca(250,'Move');t.forca(250,'Solta');t.forca(250,'Solta');
 assert.equal(t.pedidos.length,1);assert.equal(t.pedidos[0].angulo,0);assert.equal(t.pedidos[0].forca,.5);
});
test('gesto: toque e arrasto no celular ajustam a mira sem tacada involuntária',()=>{
 const t=preparar();t.mesa(996,383.5,'down',7,'touch');t.mesa(800,500,'move',7,'touch');t.mesa(800,500,'up',7,'touch');
 assert.equal(t.pedidos.length,0);assert.ok(t.estado.angulo>0);assert.equal(t.estado.gesto,null);
});
