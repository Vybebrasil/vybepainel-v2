import test from 'node:test';
import assert from 'node:assert/strict';
import {conferirEdicao,salasDoEscritorio,salvarCamadaEscritorio} from '../server/escritorio-mapa.js';
import {conferirEditorEscritorio} from '../server/escritorio-construcao.js';
const salas=salasDoEscritorio([{id:11,nome:'Paulo'},{id:22,nome:'Tainara S.'},{id:33,nome:'Jady'}]);
test('apenas Paulo edita público; nem administrador edita quarto alheio',()=>{
 const paulo={id:11,admin:true}, outraAdmin={id:22,admin:true};
 for(const camada of ['geral','cafe','recepcao']) {
  assert.doesNotThrow(()=>conferirEdicao(paulo,salas,camada));
  assert.throws(()=>conferirEdicao(outraAdmin,salas,camada),{status:403});
 }
 assert.doesNotThrow(()=>conferirEdicao(outraAdmin,salas,'sala-7'));
 assert.doesNotThrow(()=>conferirEdicao(outraAdmin,salas,'sala-7-andar-1'));
 assert.throws(()=>conferirEdicao(paulo,salas,'sala-7'),{status:403});
 assert.throws(()=>conferirEdicao(outraAdmin,salas,'sala-0'),{status:403});
 assert.throws(()=>conferirEdicao(paulo,[],'recepcao'),{status:403});
});
test('tentativas de salvar ou conferir sala alheia são recusadas antes do banco',async()=>{
 const sql=()=>{throw Error('banco não deveria ser consultado')};sql.comTransacao=async fn=>fn(sql);
 for(const camada of ['recepcao','sala-0']) {
  await assert.rejects(salvarCamadaEscritorio(sql,{id:22,admin:true},salas,{camada,itens:[],versao:0}),{status:403});
  await assert.rejects(conferirEditorEscritorio(sql,{id:22,admin:true},salas,{camada,itens:[]}),{status:403});
 }
});
