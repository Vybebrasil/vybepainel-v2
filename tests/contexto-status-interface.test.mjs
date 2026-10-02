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
test('etapa recusa obrigatório vazio, link inválido e qualidade incompleta',()=>{
 const campo={value:'',type:'text'};let link=null,check=null;
 const etapa={dataset:{required:'resposta'},querySelector:s=>s.includes('url')?link:check};
 const c=vm.createContext({document:{getElementById:()=>campo}});
 vm.runInContext(fonte.slice(fonte.indexOf('function erroEtapaContexto'),fonte.indexOf('function avancarContextoStatus')),c);
 assert.match(c.erroEtapaContexto(etapa).mensagem,/Preencha/);
 campo.value='Resposta';assert.equal(c.erroEtapaContexto(etapa),null);
 link={value:'javascript:alert(1)',checkValidity:()=>true};assert.match(c.erroEtapaContexto(etapa).mensagem,/link válido/);
 link.value='https://example.com';check={};assert.match(c.erroEtapaContexto(etapa).mensagem,/Confira/);
 check=null;assert.equal(c.erroEtapaContexto(etapa),null);
});
test('continuar só grava na revisão e revalida etapas anteriores',()=>{
 const etapas=[{dataset:{contextStep:'0'}},{dataset:{contextStep:'1'}}];
 const form={dataset:{step:'0'},querySelectorAll:()=>etapas};const aviso={};let gravacoes=0,invalido=false;
 const c=vm.createContext({document:{getElementById:id=>id==='status-context-form'?form:aviso},erroEtapaContexto:etapa=>invalido&&etapa===etapas[0]?{campo:{type:'hidden'},mensagem:'Obrigatório'}:null,mostrarEtapaContexto:i=>{form.dataset.step=String(i);},submitStatusContext:()=>gravacoes++});
 vm.runInContext(fonte.slice(fonte.indexOf('function avancarContextoStatus'),fonte.indexOf('async function submitStatusContext')),c);
 c.avancarContextoStatus();assert.equal(form.dataset.step,'1');assert.equal(gravacoes,0);
 invalido=true;c.avancarContextoStatus();assert.equal(form.dataset.step,'0');assert.equal(gravacoes,0);assert.equal(aviso.hidden,false);
 invalido=false;c.avancarContextoStatus();c.avancarContextoStatus();assert.equal(gravacoes,1);
});
