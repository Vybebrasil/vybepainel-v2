import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('sinuca: tema do lobby é removido quando outro jogo reutiliza o mesmo modal',()=>{
 const classes=new Set(['ofc-xdz-sala','ofc-snc-menu']);
 const modal={innerHTML:'',scrollTop:37,classList:{contains:c=>classes.has(c),add:(...cs)=>cs.forEach(c=>classes.add(c)),toggle:(c,v)=>v?classes.add(c):classes.delete(c)}};
 const escritorio={xadrez:{cfg:{extra:{jogo:'sinuca'}}}};
 const c=vm.createContext({escritorio,document:{getElementById:()=>modal},openWorkflowModal:html=>{modal.innerHTML=html;}});
 vm.runInContext(readFileSync('vybe-escritorio-xadrez.js','utf8'),c);
 vm.runInContext(`xadrezModal('Sinuca','ofc-xdz-sala')`,c);
 assert.ok(classes.has('ofc-snc-menu'));assert.equal(modal.scrollTop,37);
 escritorio.xadrez.cfg.extra.jogo='poker';vm.runInContext(`xadrezModal('Pôquer','ofc-xdz-sala')`,c);
 assert.equal(modal.innerHTML,'Pôquer');assert.equal(classes.has('ofc-snc-menu'),false);
});

test('sinuca: menu mantém as ações existentes e rótulos de empate e desistência',()=>{
 const estado={},c=vm.createContext({registrarMesaEscritorio:v=>v,escritorioMesa:()=>estado,document:{addEventListener(){}},escritorioSomLigado:()=>true});
 vm.runInContext(readFileSync('shared/escritorio-sinuca-mesa.js','utf8'),c);
 vm.runInContext(readFileSync('vybe-escritorio-sinuca-ui.js','utf8'),c);vm.runInContext(readFileSync('vybe-escritorio-sinuca.js','utf8'),c);
 const html=vm.runInContext(`sinucaTopoHtml('Sinuca',false,'', '<button type="button" title="Propor empate" onclick="empateExistente()">🤝</button><button type="button" title="Desistir" onclick="desistirExistente()">⚑</button>', 'fecharExistente()')`,c);
 assert.match(html,/onclick="empateExistente\(\)">Propor empate/);
 assert.match(html,/onclick="desistirExistente\(\)">Desistir/);
 assert.match(html,/onclick="fecharExistente\(\)">Voltar ao salão/);
 assert.match(html,/Como jogar/);assert.match(html,/Placar e histórico/);
});
