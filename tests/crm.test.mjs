import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { areaCrm } from '../server/crm-api.js';
import handler from '../api/painel.js';
const resposta=()=>({codigo:0,body:null,setHeader(){},status(n){this.codigo=n;return this;},json(d){this.body=d;return this;}});
const admin={tipo:'sessao',pessoa:{id:1,nome:'Paulo',admin:true}};
const comercial={tipo:'sessao',pessoa:{id:2,nome:'Comercial',admin:false}};
const outro={tipo:'sessao',pessoa:{id:3,nome:'Criação',admin:false}};
async function banco(t) {
 const {db,sql}=conexao(); t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY,nome text,ativo boolean,pode_entrar boolean);
 CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY,funcao text);
 INSERT INTO vybe_pessoas VALUES (1,'Paulo',true,true),(2,'Comercial',true,true),(3,'Criação',true,true),(4,'Bloqueado',false,false);
 INSERT INTO vybe_escritorio_funcoes VALUES (2,'atendimento'),(3,'criacao');`);
 const migracao=readFileSync('migrations/2026-11-07-crm-prospeccao.sql','utf8');
 await db.exec(migracao); await db.exec(migracao);
 return {db,sql};
}
async function chamar(sql,quem,body=null,query={}) {
 const r=resposta(); await areaCrm({method:body?'POST':'GET',body,query},r,quem,()=>sql);return r;
}
test('rota crm exige sessão: 401 sem login; serviço não ganha acesso',async()=>{
 for (const method of ['GET','POST']) {
  const r=resposta(); await handler({method,headers:{},query:{area:'crm'},body:{acao:'criar'}},r);assert.equal(r.codigo,401);
 }
 const r=resposta();await areaCrm({method:'POST'},r,{tipo:'servico'},()=>{throw Error('não deve acessar banco');});assert.equal(r.codigo,403);
});
test('rota crm: permissões, funil, histórico atômico e importação sem duplicar',async t=>{
 const {db,sql}=await banco(t);
 let r=await chamar(sql,outro);assert.equal(r.codigo,200);assert.equal(r.body.pode_editar,false);
 for(const acao of ['criar','mover','atualizar','comentar','importar']) { r=await chamar(sql,outro,{acao,nome:'Negada'});assert.equal(r.codigo,403); }
 r=await chamar(sql,comercial,{acao:'criar',nome:'Empresa A',cnpj:'12.345.678/0001-90',setor_empresa:'Saúde'});assert.equal(r.codigo,200);const id=String(r.body.id);
 r=await chamar(sql,admin,{acao:'criar',nome:'Empresa duplicada',cnpj:'12345678000190'});assert.equal(r.body.criada,false);
 r=await chamar(sql,admin,{acao:'mover',id,de_etapa:'empresa',etapa:'contato_feito'});assert.equal(r.codigo,400);
 for(const [de,para] of [['empresa','qualificacao'],['qualificacao','abordagem_proposta'],['abordagem_proposta','aprovada'],['aprovada','contato_feito'],['contato_feito','reuniao'],['reuniao','proposta_comercial'],['proposta_comercial','ganho']]) {
  r=await chamar(sql,comercial,{acao:'mover',id,de_etapa:de,etapa:para,observacao:'Registro humano'});assert.equal(r.codigo,200,JSON.stringify(r.body));
 }
 r=await chamar(sql,admin,null,{id});assert.equal(r.body.oportunidade.etapa,'ganho');assert.equal(String(r.body.oportunidade.aprovada_por),'2');assert.ok(r.body.oportunidade.encerrado_em);
 const h=r.body.historico.find(h=>h.de_etapa==='abordagem_proposta');assert.equal(h.para_etapa,'aprovada');assert.equal(String(h.quem),'2');assert.equal(h.quem_nome,'Comercial');assert.ok(h.quando);
 r=await chamar(sql,admin,{acao:'comentar',id,observacao:'Fechado pela equipe.'});assert.equal(r.codigo,200);
 r=await chamar(sql,admin,null,{id});const v=r.body.oportunidade.versao;
 r=await chamar(sql,admin,{acao:'atualizar',id,versao:v,responsavel:'2',proxima_acao:'Agendar onboarding',proxima_acao_data:'2026-11-10'});assert.equal(r.codigo,200);
 r=await chamar(sql,admin,{acao:'atualizar',id,versao:v,proxima_acao:'Sobrescrever'});assert.equal(r.codigo,409);
 r=await chamar(sql,admin,null,{id});assert.equal(r.body.oportunidade.proxima_acao,'Agendar onboarding');assert.equal(r.body.historico[0].tipo,'edicao');
 r=await chamar(sql,admin,{acao:'mover',id,de_etapa:'ganho',etapa:'empresa'});assert.equal(r.codigo,400);
 const propostas=[{nome:'Legado',cnpj:'',setorEmpresa:'Varejo',status:'proposta',quem:'Autor antigo',em:'2026-11-01'}];
 for(let i=0;i<2;i++){r=await chamar(sql,admin,{acao:'importar',propostas});assert.equal(r.codigo,200);}
 r=await chamar(sql,admin);assert.equal(r.body.total,2);const legado=r.body.oportunidades.find(o=>o.nome==='Legado');assert.equal(legado.setor_empresa,'Varejo');assert.equal(legado.etapa,'abordagem_proposta');assert.equal(legado.legado.quem,'Autor antigo');
 r=await chamar(sql,admin,null,{id:legado.id});assert.equal(r.body.historico.length,1);assert.equal(r.body.historico[0].tipo,'importacao');
 const antes=r.body.oportunidade;
 r=await chamar(sql,admin,{acao:'mover',id:legado.id,de_etapa:'empresa',etapa:'aprovada'});assert.equal(r.codigo,409);
 r=await chamar(sql,admin,{acao:'atualizar',id:legado.id,versao:antes.versao,responsavel:4});assert.equal(r.codigo,400);
 r=await chamar(sql,admin,{acao:'atualizar',id:legado.id,versao:antes.versao,proxima_acao_data:'2026-02-30'});assert.equal(r.codigo,400);
 r=await chamar(sql,admin,{acao:'importar',propostas:[{nome:'Válida'},{nome:''}]});assert.equal(r.codigo,400);
 r=await chamar(sql,admin,{acao:'criar',nome:'Inválida',etapa:'aprovada'});assert.equal(r.codigo,400);
 // Se o histórico falha, nem oportunidade nem etapa podem ser persistidas.
 await db.exec(`CREATE FUNCTION recusar_crm_hist() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'histórico indisponível'; END $$;
 CREATE TRIGGER recusar BEFORE INSERT ON vybe_crm_historico FOR EACH ROW EXECUTE FUNCTION recusar_crm_hist();`);
 r=await chamar(sql,admin,{acao:'mover',id:legado.id,de_etapa:'abordagem_proposta',etapa:'aprovada'});assert.equal(r.codigo,500);
 r=await chamar(sql,admin,{acao:'criar',nome:'Rollback'});assert.equal(r.codigo,500);
 r=await chamar(sql,admin,null,{id:legado.id});assert.equal(r.body.oportunidade.etapa,'abordagem_proposta');assert.equal(r.body.oportunidade.aprovada_por,null);
 r=await chamar(sql,admin);assert.equal(r.body.total,2);
});
test('CRM não cria tabelas: sem migração responde 503 explicitamente',async t=>{
 const {db,sql}=conexao();t.after(()=>db.close());const r=await chamar(sql,admin);assert.equal(r.codigo,503);assert.match(r.body.error,/migração/);
});
