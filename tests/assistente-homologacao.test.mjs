import test from 'node:test';import assert from 'node:assert/strict';
import {verificarBancoHomologacao,verificarUrlPreview} from '../scripts/assistente-homologacao.mjs';
const producao='postgresql://ficticio:ficticio@ep-prod.sa-east-1.aws.neon.tech/neondb',destino='postgresql://ficticio:ficticio@ep-teste-pooler.sa-east-1.aws.neon.tech/neondb';
test('homologação exige flag explícita e dois endpoints Neon distintos',()=>{
 assert.throws(()=>verificarBancoHomologacao({producao,destino}),/VYBE_HOMOLOGACAO/);
 assert.equal(verificarBancoHomologacao({habilitado:'1',producao,destino}),true);
 for(const banco of [producao,producao.replace('ep-prod.','ep-prod-pooler.')])assert.throws(()=>verificarBancoHomologacao({habilitado:'1',producao,destino:banco}),/coincide/);
 assert.throws(()=>verificarBancoHomologacao({habilitado:'1',producao,destino:'postgresql://ficticio:ficticio@localhost/neondb'}),/Neon/);
});
test('testes HTTP rejeitam domínio de produção e aceitam deployment Preview',()=>{
 for(const url of ['https://vybepainel-v2.vercel.app','https://vybepainel-v2-git-main-vybe-hub.vercel.app','http://vybepainel-v2-teste-vybe-hub.vercel.app','https://outro.example'])assert.throws(()=>verificarUrlPreview(url),/Preview/);
 assert.equal(verificarUrlPreview('https://vybepainel-v2-teste-vybe-hub.vercel.app'),'https://vybepainel-v2-teste-vybe-hub.vercel.app');
});
