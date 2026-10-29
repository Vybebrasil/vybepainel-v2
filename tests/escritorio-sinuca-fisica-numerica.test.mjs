import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import mapa from '../shared/escritorio-sinuca-mesa.js';
import {simular,RAIO} from '../server/escritorio-sinuca.js';
const so=ps=>{const b=Array(16).fill(null);for(const[n,p]of Object.entries(ps))b[n]=p;return b;};
function medir(ps,f=1,dt=1/600,e=0,l=0){
 let primeiro=null,maxSobreposicao=0,energiaInicial=0;
 let src=readFileSync(new URL('../server/escritorio-sinuca.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+(?=(const|function)\b)/g,'');
 src=src.replace("     evento('bola', jn, `bola:${i}:${k}`);", "     contato(i,k,p,q);");
 src=src.replace('  if (tempo >= proximoQuadro-1e-9 || !algum)', '  quadro(b);\n  if (tempo >= proximoQuadro-1e-9 || !algum)');
 src=src.replace(' const caiu = [], fora = [], quadros = [], alturas = [], eventos = [];',' inicial(b[0]);\n const caiu = [], fora = [], quadros = [], alturas = [], eventos = [];');
 const run=new Function('mesaSinuca','erro','randomInt','contato','quadro','inicial',src+';return simular;')(mapa,m=>new Error(m),()=>0,(i,k,p,q)=>{if(primeiro===null&&(i===0||k===0)){const obj=i===0?q:p;primeiro=Math.atan2(obj.vy,obj.vx)*180/Math.PI;}},b=>{for(let i=0;i<16;i++)for(let k=i+1;k<16;k++)if(b[i]&&b[k])maxSobreposicao=Math.max(maxSobreposicao,2*RAIO-Math.hypot(b[i].x-b[k].x,b[i].y-b[k].y,b[i].z-b[k].z));},p=>{energiaInicial=.5*(p.vx*p.vx+p.vy*p.vy+p.vz*p.vz)+.2*(p.wx*p.wx+p.wy*p.wy+p.s*p.s);});
 const r=run(ps,0,f,e,RAIO,l,{passoMaximo:dt});return {r,primeiro,maxSobreposicao,energiaInicial};
}
test('física: corte fino converge e não espera a bola penetrar para colidir',()=>{
 const b=so({0:[30,25],2:[40,25+1.9*RAIO/mapa.metricaY]});const a=medir(b),ref=medir(b,1,1/9600);
 assert.ok(Math.abs(a.primeiro-ref.primeiro)<.15,`ângulos ${a.primeiro} e ${ref.primeiro}`);
 assert.ok(a.maxSobreposicao<.0001,`sobreposição ${a.maxSobreposicao}`);
 console.log('Corte fino:',JSON.stringify({padrao:a.primeiro,refinado:ref.primeiro,sobreposicao:a.maxSobreposicao}));
});
test('física: renumerar bolas encostadas preserva os movimentos físicos',()=>{
 const ps=[[40,25],[40+2*RAIO,25],[40+4*RAIO,25],[40+6*RAIO,25]],a=so({0:[30,25],2:ps[0],3:ps[1],4:ps[2],5:ps[3]}),b=so({0:[30,25],5:ps[0],4:ps[1],3:ps[2],2:ps[3]});
 const x=simular(a,0,1),y=simular(b,0,1);let erro=0;
 for(let i=0;i<4;i++){const p=x.bolas[i+2],q=y.bolas[5-i];assert.equal(Boolean(p),Boolean(q));if(p)erro=Math.max(erro,Math.hypot(p[0]-q[0],p[1]-q[1]));}
 assert.ok(erro<1e-7,`diferença ${erro}`);
});
test('física: força tem derivada contínua e efeito não cria energia',()=>{
 const h=1e-7,v=mapa.velocidade,esq=(v(.05)-v(.05-h))/h,dir=(v(.05+h)-v(.05))/h;
 assert.ok(Math.abs(esq-dir)<.001,`derivadas ${esq} / ${dir}`);
 const b=so({0:[50,25]}),base=medir(b,.5).energiaInicial;
 for(const [e,l]of [[1,0],[0,1],[1,1],[-1,-1]]){const a=medir(b,.5,1/600,e,l);assert.ok(Math.abs(a.energiaInicial/base-1)<1e-9);}
});
test('física: mesma distância física horizontal e vertical tem mesmo alcance sem tabela',()=>{
 const b=so({0:[50,25]}),x=simular(b,0,.15),y=simular(b,Math.PI/2,.15),dx=x.bolas[0][0]-50,dy=(y.bolas[0][1]-25)*mapa.metricaY;
 assert.ok(Math.abs(dx-dy)<1e-9,`${dx} / ${dy}`);
});
