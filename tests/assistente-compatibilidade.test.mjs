import test from 'node:test';
import assert from 'node:assert/strict';
import {verificarCompatibilidade} from '../scripts/assistente-verificar-compatibilidade.mjs';
const ferramenta=(name,properties={})=>({type:'function',function:{name,parameters:{type:'object',properties}}});
const contrato=()=>[
 ...['consultar_perfil_trabalho','consultar_perfil_jogo','consultar_ranking','consultar_dia_equipe'].map(x=>ferramenta(x)),
 ...['minhas_demandas','buscar_demandas'].map(x=>ferramenta(x,{situacao:{enum:['todas','pendentes','atrasadas']}})),
 ferramenta('detalhar_demanda',{secao:{enum:['ficha','comentarios','historico','tarefas','arquivos']}}),
 ferramenta('consultar_metricas_trafego',{modulo:{enum:['trafego','alcance','interacoes','seguidores','faturamento','objetivos','aprovacoes','documentos','marca','campanhas','anuncios','publico','segmentacao']}})
];
test('compatibilidade: conhecer o nome da ferramenta não comprova suporte aos filtros amplos',()=>{
 const r=verificarCompatibilidade(contrato().map(x=>ferramenta(x.function.name)));
 assert.equal(r.compativel,false);assert.ok(r.faltantes.includes('minhas_demandas.situacao'));assert.ok(r.faltantes.includes('consultar_metricas_trafego.modulo'));
});
test('compatibilidade: contrato completo aceita ampliação sem exigir remoção de outras ferramentas',()=>{
 assert.equal(verificarCompatibilidade([...contrato(),ferramenta('listar_clientes')]).compativel,true);
});
test('compatibilidade: contrato incompleto não é aprovado nem reduz o escopo solicitado',()=>{
 const r=verificarCompatibilidade(contrato().filter(x=>x.function.name!=='consultar_perfil_trabalho'));
 assert.deepEqual(r.faltantes,['consultar_perfil_trabalho']);assert.equal(r.compativel,false);
});
