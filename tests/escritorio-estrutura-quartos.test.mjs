import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const quartos=JSON.parse(readFileSync('assets/escritorio/habbo/quartos.json'));
function contexto() {
 const c=vm.createContext({console,escritorio:{base:{quartos}}});
 vm.runInContext(readFileSync('vybe-escritorio-planta.js','utf8')+'\n'+readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 return c;
}
test('escada da planta encontra os extremos, chega no patamar e não duplica uma peça menor',()=>{
 const c=contexto();
 for(const modelo of quartos.plantas.filter(p=>p.escada?.length)) {
  c.id=modelo.id;
  const r=vm.runInContext(`(()=>{const a={...ESCRITORIO_PLANTA.ambientes.find(a=>a.id==='sala-0'),planta:id};const P=escritorioPlantaDoQuarto(a);return {escadas:P.escadas,fixos:P.fixos,geometrias:P.escadas.map(e=>mapaDegrausDaPlanta(e))};})()`,c);
  assert.equal(r.escadas.length,modelo.escada.length,modelo.id+': toda escada tem saída baixa e alta');
  assert.ok(!r.fixos.some(it=>it[0]==='bc_stairs_recolorable'),'sem peça de 0,5 fingindo subir dois níveis');
  r.escadas.forEach((e,i)=>{
   assert.equal(modelo.celdas[e.y+e.dy][e.x+e.dx],e.alto);
   assert.equal(modelo.celdas[e.y-e.dy][e.x-e.dx],e.baixo);
   assert.equal(e.meio,(e.alto+e.baixo)/2);
   const pisos=r.geometrias[i].flatMap(d=>d.piso);
   assert.equal(Math.max(...pisos.map(p=>p.z)),e.alto,modelo.id+': último degrau toca o alto');
   assert.ok(pisos.some(p=>Math.abs((p.x-e.x-.5)*e.dx+(p.y-e.y-.5)*e.dy-1)<1e-6));
  });
 }
});
test('subida real continua alcançável em todos os formatos com patamar',()=>{
 const c=contexto();
 for(const modelo of quartos.plantas.filter(p=>p.escada?.length)) {
  c.id=modelo.id;
  const r=vm.runInContext(`(()=>{const a={...ESCRITORIO_PLANTA.ambientes.find(a=>a.id==='sala-0'),planta:id};const P=escritorioPlantaDoQuarto(a),g=mapaMontarGrade(P,[]);const e=P.escadas[0];return {rota:mapaCaminho(g,P.entrada,{x:e.x+e.dx,y:e.y+e.dy}),escadas:P.escadas};})()`,c);
  assert.ok(r.rota?.length,modelo.id+': subida tem rota');
  assert.ok(r.rota.some(p=>r.escadas.some(e=>e.x===p.x&&e.y===p.y)),modelo.id+': personagem passa pela escada, não salta o patamar');
 }
});
test('recorte em U fica aberto à vista e paredes de fundo mantêm topo alinhado',()=>{
 const c=contexto();
 for(const id of ['u-m','u-g','u-gg','terracos-g','terracos-gg','mirante-g','mirante-gg']) {
  c.id=id;
  const r=vm.runInContext(`(()=>{const a={...ESCRITORIO_PLANTA.ambientes.find(a=>a.id==='sala-0'),planta:id};const paredes=escritorioParedesDoQuarto(a);return {recortes:paredes.filter(p=>p.recorte).map(p=>({alt:p.alt,baixa:p.baixa})),topos:paredes.filter(p=>p.sala&&!p.recorte).map(p=>escritorioAlturaQuarto(a,p[0],p[1])+p.alt/32)};})()`,c);
  assert.ok(r.recortes.length,id+': parede no meio da vista vira seção baixa');
  assert.ok(r.recortes.every(p=>p.baixa&&p.alt===16));
  assert.ok(Math.max(...r.topos)-Math.min(...r.topos)<.04,id+': teto não muda com o desnível');
 }
});
test('degraus acompanham a direção e a altura em quatro orientações',()=>{
 const c=contexto();
 for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
  c.e={x:4,y:4,dx,dy,baixo:1,meio:2,alto:3};
  const ds=vm.runInContext('mapaDegrausDaPlanta(e)',c);
  assert.equal(ds.length,8);
  assert.equal(Math.max(...ds.flatMap(d=>d.piso.map(p=>p.z))),3);
  assert.ok(ds.every(d=>d.base===1));
 }
});
