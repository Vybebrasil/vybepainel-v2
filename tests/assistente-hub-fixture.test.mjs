import test from 'node:test';
import assert from 'node:assert/strict';
import {metricasDoHub} from '../server/assistente-hub.js';

test('ponte preserva identificação explícita de dados fictícios',async()=>{
 const config={VYBE_AI_HUB_ATIVO:'1',VYBE_AI_HUB_URL:'https://vybehub-ficticio-vybe-hub.vercel.app/',VYBE_OS_METRICAS_TOKEN:'F'.repeat(64),VYBE_AI_HUB_CLIENTES:'{"1":"cliente-ficticio-ai"}'};
 const a={cliente_id:'1',de:'2026-10-24',ate:'2026-10-24',modulo:'trafego'};
 const buscar=async()=>new Response(JSON.stringify({result:{data:{json:{slug:'cliente-ficticio-ai',cliente_nome:'Cliente Ficticio AI',de:a.de,ate:a.ate,modulo:'trafego',deslocamento:0,linhas:[{amountSpent:25}],origem_dados:'homologacao_fixture'}}}}));
 const r=await metricasDoHub(async()=>[{id:'1',nome:'Cliente Ficticio AI'}],a,{config,buscar});
 assert.equal(r.origem_dados,'homologacao_fixture');
 assert.match(r.observacao,/DADOS FICTÍCIOS DE HOMOLOGAÇÃO/);
 assert.equal(r.itens[0].amountSpent,25);
});
