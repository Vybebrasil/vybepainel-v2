import test from 'node:test';
import assert from 'node:assert/strict';
import {conferirEditorEscritorio} from '../server/escritorio-construcao.js';
import {conferirConstrucao} from '../scripts/escritorio-auditar.mjs';
const semBanco=()=>{throw new Error('Não deveria consultar o banco');};
test('conferência não permite que não administrador inspecione sala alheia ou comum',async()=>{
 await assert.rejects(conferirEditorEscritorio(semBanco,{id:1,admin:false},[],{camada:'cafe',itens:[]}),{status:403});
 await assert.rejects(conferirEditorEscritorio(semBanco,{id:1,admin:false},[{id:'sala-0',pessoa_id:'2'}],{camada:'sala-0',itens:[]}),{status:403});
});
test('conferência valida limite e classe antes de carregar o motor',async()=>{
 await assert.rejects(conferirEditorEscritorio(semBanco,{id:1,admin:true},[{id:'sala-0',pessoa_id:'1'}],{camada:'cafe',itens:[['../../arquivo',1,1,2]]}),/Móvel inválido/);
 await assert.rejects(conferirEditorEscritorio(semBanco,{id:1,admin:true},[{id:'sala-0',pessoa_id:'1'}],{camada:'cafe',itens:[],celdas:'v'.repeat(576)}),/Planta/);
});
test('mesmo verificador das cenas acusa arte ausente e não contamina a próxima conferência',()=>{
 const ruim=conferirConstrucao('cafe',[['sem_arte_no_painel',1,1,2]]);
 assert.ok(ruim.problemas.some(t=>t.includes('sem arte')));
 const outra=conferirConstrucao('cafe',[]);
 assert.ok(!outra.problemas.some(t=>t.includes('sem_arte_no_painel')));
 assert.throws(()=>conferirConstrucao('inexistente',[]),/Sala inválida/);
});

test('editor distingue arte remota não verificável de erro de construção e permite localizar a peça',async()=>{
 const r=await conferirEditorEscritorio(semBanco,{id:1,admin:true},[{id:'sala-0',pessoa_id:'1'}],{camada:'cafe',itens:[['sem_arte_no_painel',1,1,2]]});
 assert.ok(!r.problemas.some(t=>t.includes('sem arte')));
 assert.ok(r.avisos.some(t=>t.includes('indisponível para análise local')));
 assert.deepEqual(r.detalhes.find(d=>d.mensagem.includes('indisponível')).indices,[0]);
});
