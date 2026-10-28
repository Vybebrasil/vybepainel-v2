import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import mapa from '../shared/escritorio-sinuca-mesa.js';
import {simular,RAIO,BOCAS,geometria,velocidadeDaForca,METROS_POR_UNIDADE,jogarSinuca} from '../server/escritorio-sinuca.js';
const so=(x,y)=>{const b=Array(16).fill(null);b[0]=[x,y];return b;};
const F=v=>((v-0.1)/6.9)**0.4;

test('mesa verde: as seis caçapas deixam a bola apoiada na beirada e caem com mais impulso',()=>{
  BOCAS.buracos.forEach(([cx,cy,cr],i)=>{
    const alvo=i===1||i===4?[50,25]:[i===0||i===3?12:88,i<3?12:38],d=Math.hypot(alvo[0]-cx,alvo[1]-cy),ux=(alvo[0]-cx)/d,uy=(alvo[1]-cy)/d,b=so(cx+ux*12,cy+uy*12),a=Math.atan2(-uy,-ux);
    let lo=0.3,hi=0.7,fica;
    assert.ok(simular(b,a,F(hi),0,RAIO).caiu.includes(0),`caçapa ${i}: entra pelo meio da boca`);
    for(let k=0;k<22;k++){
      const v=(lo+hi)/2,r=simular(b,a,F(v),0,RAIO);
      if(r.caiu.includes(0))hi=v;else {lo=v;fica=r;}
    }
    assert.ok(fica?.bolas[0],`caçapa ${i}: permanece apoiada`);
    const p=fica.bolas[0],folga=Math.hypot(p[0]-cx,p[1]-cy)-cr;
    assert.ok(folga>=0&&folga<0.002,`caçapa ${i}: folga ${folga}, corpo avançado sobre a boca`);
    // Outra tacada longe dela não atrai a bola que ficou pendurada.
    const outra=so(50,25);outra[2]=p;
    const quieta=simular(outra,0,0.001,0,RAIO);
    assert.deepEqual(quieta.bolas[2],p,`caçapa ${i}: fica parada sem ímã`);
  });
});

test('mesa verde: os doze dentes devolvem o choque antes de a bola seguir ou cair',()=>{
  for(const [i,[x1,y1,x2,y2]] of geometria().paredes.slice(6).entries()){
    const ex=x2-x1,ey=y2-y1,len=Math.hypot(ex,ey),mx=x1+ex*0.05,my=y1+ey*0.05;
    let nx=-ey/len,ny=ex/len;
    const c=BOCAS.buracos.reduce((a,b)=>Math.hypot(b[0]-mx,b[1]-my)<Math.hypot(a[0]-mx,a[1]-my)?b:a);
    if(nx*(c[0]-mx)+ny*(c[1]-my)<0){nx=-nx;ny=-ny;}
    const r=simular(so(mx+nx*(RAIO+0.1),my+ny*(RAIO+0.1)),Math.atan2(-ny,-nx),0.2,0,RAIO,0,{trilhas:true});
    const l=r.trilhas[0],dist=[];
    for(let k=0;k<l.length;k+=4)if(l[k+1]!==-1&&l[k+2]!==-1)dist.push((l[k+1]/10-mx)*nx+(l[k+2]/10-my)*ny);
    const contato=dist.findIndex(d=>d<RAIO+0.08);
    assert.ok(contato>=0,`dente ${i}: chegou ao contato`);
    assert.ok(dist.slice(contato+1).some(d=>d>RAIO+0.25),`dente ${i}: rebateu antes de seguir`);
  }
});

test('força: aceita 0,1% a 100%, curva contínua sem impulso mínimo e transferência progressiva',()=>{
  let anterior=0;
  for(const f of [.001,.002,.01,.0499,.05,.0501,.1,.25,.5,1]){
    const v=velocidadeDaForca(f)*METROS_POR_UNIDADE;
    assert.ok(v>anterior,`força ${f}: velocidade ${v}`);anterior=v;
    assert.equal(v,mapa.velocidade(f));
  }
  assert.equal(anterior,7);
  let distancia=0;
  for(const f of [.001,.005,.01,.02,.05,.1,.2]){
    const b=so(30,25);b[2]=[30+2*RAIO+0.000001,25];
    const r=simular(b,0,f,0,RAIO),anda=r.bolas[2][0]-b[2][0];
    assert.equal(r.primeiro,2,`força ${f}: toca a bola encostada`);
    assert.ok(anda>distancia,`força ${f}: outra bola andou ${anda}, antes ${distancia}`);distancia=anda;
  }
  const mesa={bolas:so(25,25),r:RAIO,vez:'desafiante',grupos:{desafiante:null,desafiado:null},tacadas:2,n:0,bolaNaMao:false};
  assert.doesNotThrow(()=>jogarSinuca(mesa,'desafiante',{tipo:'tacar',angulo:0,forca:.001}));
  for(const f of [0,.0009,1.001,Infinity,NaN])assert.throws(()=>jogarSinuca(mesa,'desafiante',{tipo:'tacar',angulo:0,forca:f}),/força/);
});

test('mesa verde: mapa idêntico no navegador e no servidor e carregado antes da interface',()=>{
  const ctx=vm.createContext({});vm.runInContext(readFileSync('shared/escritorio-sinuca-mesa.js','utf8'),ctx);
  assert.equal(vm.runInContext('JSON.stringify(ESCRITORIO_SINUCA_MESA.paredes)',ctx),JSON.stringify(geometria().paredes));
  const html=readFileSync('index.html','utf8');assert.ok(html.indexOf('/shared/escritorio-sinuca-mesa.js')<html.indexOf('/vybe-escritorio-sinuca.js'));
  assert.ok(mapa.arte.pano.x>0&&mapa.arte.pano.x+mapa.arte.pano.largura<mapa.arte.largura);
});
