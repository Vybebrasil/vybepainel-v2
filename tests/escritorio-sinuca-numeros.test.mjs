import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('números: seguem a mesma coluna de rotação do disco e centralizam os limites da tinta',()=>{
 const c=vm.createContext({registrarMesaEscritorio:v=>v,document:{addEventListener(){}}});
 for(const f of ['shared/escritorio-sinuca-mesa.js','vybe-escritorio-sinuca-ui.js','vybe-escritorio-sinuca.js'])vm.runInContext(readFileSync(f,'utf8'),c);
 const deslocamentos=[],textos=[],g={globalAlpha:1,save(){},restore(){},translate(...v){deslocamentos.push(v);},rotate(){},scale(){},beginPath(){},arc(){},clip(){},measureText(){return {actualBoundingBoxLeft:1,actualBoundingBoxRight:9,actualBoundingBoxAscent:7,actualBoundingBoxDescent:2};},fillText(...v){textos.push(v);}};
 c.g=g;vm.runInContext('sinucaNumeroPintar(g,100,200,20,[.8,-.36,.48,.6,.48,-.64,0,.8,.6],12,0)',c);
 assert.equal(deslocamentos.length,1);assert.ok(Math.abs(deslocamentos[0][0]-(100+.86*.48*20))<1e-9);assert.ok(Math.abs(deslocamentos[0][1]-(200-.86*.64*20))<1e-9);assert.deepEqual(textos,[['12',-4,2.5]]);
});
test('números: disco oculto ou borrado não deixa número flutuando na cor da bola',()=>{
 const c=vm.createContext({registrarMesaEscritorio:v=>v,document:{addEventListener(){}}});for(const f of ['shared/escritorio-sinuca-mesa.js','vybe-escritorio-sinuca-ui.js','vybe-escritorio-sinuca.js'])vm.runInContext(readFileSync(f,'utf8'),c);
 c.g={save(){throw new Error('não pode pintar número invisível');}};
 vm.runInContext('sinucaNumeroPintar(g,0,0,20,[1,0,0,0,1,0,0,0,1],8,.9);sinucaNumeroPintar(g,0,0,20,[0,0,1,0,1,0,-1,0,0],8,0)',c);
});
