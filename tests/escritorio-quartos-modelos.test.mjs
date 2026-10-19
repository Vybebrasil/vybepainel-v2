import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const QUARTOS=JSON.parse(readFileSync('assets/escritorio/habbo/quartos.json','utf8'));

test('âncoras dos modelos iniciais estão em dia com o gerador',()=>{
 execFileSync(process.execPath,['scripts/escritorio-quartos-modelos.mjs','--conferir'],{stdio:'pipe'});
});

test('modelo inicial fica encostado no fundo, não solto no canto da frente',()=>{
 const m=QUARTOS.modelos.find(m=>m.id==='trabalho');
 const mesa=m.itens.find(i=>i[0]==='exe_table');
 let encostadas=0,total=0;
 for(const p of QUARTOS.plantas.filter(p=>!p.legado)) {
  const [dx,dy]=p.ancoras.trabalho, x=mesa[1]+dx, y=mesa[2]+dy, nv=p.celdas[y][x];
  total++;
  if([0,1,2].every(i=>{const atras=p.celdas[y-1]?.[x+i] ?? -1;return atras<0||atras>nv;})) encostadas++;
  // Mesa no terço de trás do quarto.
  assert.ok(y<=Math.ceil(p.celdas.length/2),p.id+': mesa no fundo');
 }
 assert.ok(encostadas>=total-2,`mesa encostada em ${encostadas} de ${total} plantas`);
});

test('guarda-corpo cobre a borda inteira do mezanino e a escada cabe no próprio ladrilho',()=>{
 const c=vm.createContext({console,escritorio:{base:{quartos:QUARTOS}}});
 vm.runInContext(readFileSync('vybe-escritorio-planta.js','utf8')+'\n'+readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 for(const id of ['niveis-m','niveis-g','terracos-g','mirante-g']) {
  c.id=id;
  const {guardas,borda,degraus}=JSON.parse(vm.runInContext(`(()=>{const a={...ESCRITORIO_PLANTA.ambientes.find(a=>a.id==='sala-0'),planta:id};const p=escritorioPlantaDoQuarto(a);
   const g=p.fixos.filter(f=>f[0]===ESCRITORIO_PECA_GUARDA&&f[3]===4);const cob=[];for(const f of g) for(const i of [0,1]) cob.push((f[1]+i)+','+Math.floor(f[2]));
   const {w,h}=escritorioDimQuarto(a),n=(x,y)=>escritorioNivelQuarto(a,x,y),b=[];
   for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(n(x,y+1)>=0&&n(x,y)-n(x,y+1)>=2) b.push(x+','+y);
   const d=p.escadas.flatMap(e=>mapaDegrausDaPlanta(e).flatMap(s=>s.piso.map(q=>[q.x-e.x,q.y-e.y])));
   return JSON.stringify({guardas:cob,borda:b,degraus:d});})()`,c));
  // Cada trecho de borda tem guarda-corpo; num trecho ímpar fica um só
  // ladrilho aberto (do lado da escada), sem peças sobrepostas.
  const linhas=new Map();for(const k of borda){const [x,y]=k.split(',').map(Number);linhas.set(y,[...(linhas.get(y)||[]),x]);}
  for(const [y,xs] of linhas) {
   xs.sort((a,b)=>a-b);let ini=0;
   for(let i=1;i<=xs.length;i++) if(i===xs.length||xs[i]!==xs[i-1]+1) {const trecho=xs.slice(ini,i);ini=i;
    const abertos=trecho.filter(x=>!guardas.includes(x+','+y));
    assert.ok(abertos.length<=1,id+': trecho da linha '+y+' com '+abertos.length+' ladrilhos sem guarda-corpo');}
  }
  assert.equal(new Set(guardas).size,guardas.length,id+': guarda-corpos sobrepostos');
  for(const [x,y] of degraus) assert.ok(x>=-1e-9&&x<=1+1e-9&&y>=-1e-9&&y<=1+1e-9,id+': degrau fora do ladrilho');
 }
});
