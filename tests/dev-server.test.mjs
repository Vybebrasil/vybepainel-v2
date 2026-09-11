import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createDevServer } from '../scripts/dev-server.mjs';
const server=createDevServer();
function request(url,{method='GET',cookie,body}={}) {
  return new Promise((resolve)=>{
    const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);
    Object.assign(req,{url,method,headers:{...(cookie?{cookie}:{}),'content-type':'application/json'}});
    const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},writeHead(status,headers){this.statusCode=status;Object.assign(this.headers,headers);return this;},
      end(data){resolve({status:this.statusCode,headers:this.headers,body:data?.toString()||''});}};
    server.emit('request',req,res);
  });
}
test('ambiente padrão usa dados fictícios e não permite escrita operacional',async()=>{
  assert.equal((await request('/api/conteudos')).status,401);
  const login=await request('/api/sessao',{method:'POST',body:{pessoa_id:1,senha:'demo-local'}});
  assert.equal(login.status,200);assert.match(login.headers['Set-Cookie'],/HttpOnly/);
  const cookie=login.headers['Set-Cookie'].split(';')[0];
  const dados=await request('/api/conteudos',{cookie});assert.equal(dados.status,200);assert.match(dados.body,/Peça fictícia/);
  assert.equal((await request('/api/conteudo',{cookie,method:'POST',body:{acao:'remover',item:'vybe:1'}})).status,403);
  assert.equal((await request('/api/sessao',{cookie,method:'DELETE'})).status,200);
});
test('servidor local não publica backend, ambiente, banco ou dependências',async()=>{
  for(const url of ['/vybe_sessao.js','/server/responsaveis.js','/.env','/package.json','/node_modules/esbuild/package.json','/%2e%2e%2f.env'])assert.equal((await request(url)).status,404,url);
  assert.equal((await request('/')).status,200);
  assert.equal((await request('/vybe-config.js')).status,200);
});
test('a exceção de leitura por POST é só o diagnóstico de automação',async()=>{
  // A trava de escrita é o que permite apontar o servidor local para a produção
  // sem medo. O diagnóstico passa porque só lê; qualquer vizinho dele continua
  // barrado, inclusive o ensaio, que cria peça.
  const { ehLeituraPorPost }=await import('../scripts/dev-server.mjs');
  const u=(s)=>new URL(s,'http://localhost');
  assert.equal(ehLeituraPorPost(u('/api/painel?area=automacoes&acao=simular')),true);
  for(const rota of [
    '/api/painel?area=automacoes&acao=ensaio',    // cria peça de ensaio
    '/api/painel?area=automacoes&acao=semear',    // reescreve as regras
    '/api/painel?area=automacoes&acao=salvar',
    '/api/painel?area=automacoes&acao=prioridades',
    '/api/painel?area=automacoes',                // salvar é o padrão sem ação
    '/api/painel?area=clientes&acao=simular',     // outra área, outro assunto
    '/api/conteudo?acao=simular',                 // a rota que grava de verdade
  ])assert.equal(ehLeituraPorPost(u(rota)),false,rota);
});
