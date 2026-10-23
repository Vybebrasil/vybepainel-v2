import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {conexao} from './postgres.mjs';
import {desempenhoTrabalho} from '../server/escritorio-pontos.js';

test('desempenho separa papéis, deduplica reabertura e consulta recordes além da série',async t=>{
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_escritorio_regras(chave text); CREATE TABLE vybe_escritorio_fechamentos(chave text);
 CREATE TABLE vybe_escritorio_funcoes(pessoa_id int,funcao text); INSERT INTO vybe_escritorio_funcoes VALUES(6,'criacao');
 CREATE TABLE vybe_conteudos(id int,formato text); INSERT INTO vybe_conteudos VALUES(1,'Card'),(2,'Reels'),(3,'Feed/Story'),(4,NULL);
 CREATE TABLE vybe_escritorio_entregas(pessoa_id int,origem text,regra text,conteudo_id int,dia date);
 CREATE TABLE vybe_escritorio_moedas(pessoa_id int,origem text,regra text,conteudo_id int,criado_em timestamptz,pontos int);
 CREATE FUNCTION vybe_dia_bahia(timestamptz) RETURNS date LANGUAGE sql AS $$ SELECT ($1 AT TIME ZONE 'America/Bahia')::date $$;
 INSERT INTO vybe_escritorio_entregas VALUES
 (6,'um','peca_criacao',1,'2026-10-01'),(6,'reaberta','peca_criacao',1,'2026-10-02'),
 (6,'head','peca_atendimento',1,'2026-10-01'),(6,'dois','peca_criacao',2,'2026-10-01'),
 (6,'antigo','peca_criacao',3,'2025-01-01'),(7,'outro','peca_criacao',4,'2026-10-01');
 INSERT INTO vybe_escritorio_moedas VALUES
 (6,'um','peca_criacao',1,'2026-10-01T12:00:00Z',30),
 (6,'acao','acao_painel',NULL,'2026-10-02T01:30:00Z',1),
 (6,'premio','copa_1',NULL,'2026-10-01T12:00:00Z',500),
 (7,'alheio','peca_criacao',4,'2026-10-01T12:00:00Z',100);`);
 const d=await desempenhoTrabalho(sql,6,new Date('2026-10-23T12:00:00Z'));
 assert.equal(d.funcao,'criacao');
 assert.equal(d.linhas.filter(l=>l.regra==='peca_criacao').reduce((n,l)=>n+l.n,0),2);
 assert.equal(d.linhas.find(l=>l.regra==='peca_atendimento').n,1);
 assert.equal(d.linhas.find(l=>l.regra==='acao_painel').dia,'2026-10-01');
 assert.equal(d.recordes.find(l=>l.regra==='peca_criacao'&&l.formato===null).n,2);
 assert.equal(d.recordes.find(l=>l.formato==='feed/story').dia,'2025-01-01');
 assert.equal(d.ganhos.reduce((n,l)=>n+l.xp,0),31);
 const vazio=await desempenhoTrabalho(sql,99,new Date('2026-10-23T12:00:00Z'));
 assert.deepEqual(vazio.linhas,[]);assert.deepEqual(vazio.recordes,[]);
});

const fonte=readFileSync('vybe-escritorio-ficha.js','utf8');
const conta=fonte.slice(fonte.indexOf('function escritorioTrabalhoConta('),fonte.indexOf('function escritorioTrabalhoHtml('));
const ctx=vm.createContext({});vm.runInContext(conta,ctx);
test('médias explicitam dias úteis com zero, separam fim de semana e comparam períodos iguais',()=>{
 const d={hoje:'2026-10-23',linhas:[{dia:'2026-10-23',regra:'peca_criacao',formato:'card',n:10},{dia:'2026-10-18',regra:'peca_criacao',formato:'card',n:20},{dia:'2026-10-16',regra:'peca_criacao',formato:'card',n:5},{dia:'2026-10-23',regra:'peca_atendimento',formato:'card',n:100}]};
 const c=ctx.escritorioTrabalhoConta(d,{dias:7,regra:'peca_criacao',formato:'card'});
 assert.equal(c.atual.total,30);assert.equal(c.atual.media,2);assert.equal(c.atual.diasUteis,5);
 assert.equal(c.atual.mediaAtiva,15);assert.equal(c.antes.media,1);assert.equal(c.variacao,100);
 assert.equal(c.serie.length,7);assert.equal(c.serie[0].n,0);
});
test('base vazia não inventa crescimento percentual; formato não mistura papéis',()=>{
 const c=ctx.escritorioTrabalhoConta({hoje:'2026-01-01',linhas:[]},{dias:28,regra:'peca_criacao'});
 assert.equal(c.variacao,null);assert.equal(c.atual.total,0);assert.equal(c.serie.length,28);
});

test('início de histórico não vira ausência de produção nem crescimento fictício',()=>{
 const c=ctx.escritorioTrabalhoConta({hoje:'2026-10-23',linhas:[{dia:'2026-10-23',regra:'peca_criacao',formato:'card',n:10}],recordes:[{regra:'peca_criacao',formato:null,primeiro:'2026-10-23',dia:'2026-10-23',n:10}]},{dias:28,regra:'peca_criacao'});
 assert.equal(c.atual.diasUteis,1);assert.equal(c.atual.media,10);assert.equal(c.variacao,null);assert.equal(c.atual.diasCobertos,1);
});
