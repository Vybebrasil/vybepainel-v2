import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const fonte=fs.readFileSync('vybe-status.js','utf8');
test('seletor preserva todos os responsáveis atuais e sincroniza estado acessível',()=>{
 const campo={value:'1,2'};const botoes=[1,2,3].map(id=>({dataset:{dono:String(id)},classList:{toggle(){}},setAttribute(k,v){this[k]=v;}}));
 const c=vm.createContext({TEAM_USERS:[{id:1,name:'Ana Silva'},{id:2,name:'Ana Souza'},{id:3,name:'Bia'}],ownerEligibility:()=>({users:[]}),assignedIds:()=>['1','2'],safeText:String,ownerAvatarHtml:()=>'',document:{getElementById:()=>campo,querySelectorAll:()=>botoes}});
 vm.runInContext(fonte.slice(fonte.indexOf('function statusContextResponsibleOptions'),fonte.indexOf('// Todas as imagens da peça')),c);
 const html=c.statusContextResponsibleOptions({});assert.match(html,/value="1,2"/);assert.match(html,/Ana Silva/);assert.match(html,/Ana Souza/);
 c.escolherResponsavelDoStatus('3');assert.equal(campo.value,'1,2,3');assert.equal(botoes[2]['aria-pressed'],'true');
 c.escolherResponsavelDoStatus('2');assert.equal(campo.value,'1,3');assert.equal(botoes[1]['aria-pressed'],'false');
});
