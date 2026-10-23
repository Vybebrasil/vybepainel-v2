import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {conexao} from './postgres.mjs';
import {desempenhoTrabalho,periodoTrabalho} from '../server/escritorio-pontos.js';

test('desempenho separa papéis, deduplica reabertura e consulta recordes além da série',async t=>{
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_escritorio_regras(chave text,descricao text); CREATE TABLE vybe_escritorio_fechamentos(chave text);
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
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN monday_item_id text, ADD COLUMN board_id bigint,ADD COLUMN titulo text,ADD COLUMN clientes_texto text;
 UPDATE vybe_conteudos SET board_id=7829537690,titulo='Peça de teste';
 CREATE TABLE vybe_conteudo_eventos(conteudo_id int,tipo text,de text,para text,em timestamptz);
 INSERT INTO vybe_conteudo_eventos VALUES
 (1,'prazo',NULL,'2026-10-01','2026-09-30T12:00:00Z'),(1,'status','Em andamento','Para aprovação','2026-10-01T12:00:00Z'),
 (1,'prazo','2026-10-01','2030-01-01','2026-10-02T12:00:00Z'),(1,'status','Para aprovação','Alteração','2026-10-02T13:00:00Z'),
 (1,'status','Para aprovação','Para agendar','2026-10-03T12:00:00Z'),
 (2,'prazo',NULL,'2026-09-30','2026-09-30T12:00:00Z'),(2,'status','Em andamento','Para aprovação','2026-10-01T12:00:00Z');
 INSERT INTO vybe_escritorio_moedas VALUES(6,'bonus','meta_semana',NULL,'2026-10-01T12:00:00Z',50),(6,'perda','criacao_alteracao',1,'2026-10-02T12:00:00Z',-7);`);
 await t.test('detalhamento usa os mesmos papéis, não duplica reabertura e não inclui prêmio',async()=>{
  const op={de:'2026-10-01',ate:'2026-10-23',detalhes:true,regra:'peca_criacao'};
  const l=await desempenhoTrabalho(sql,6,new Date('2026-10-23T12:00:00Z'),op);
  assert.equal(l.total,2);assert.equal(l.itens[0].ref,'vybe:1');
  const xp=await desempenhoTrabalho(sql,6,new Date('2026-10-23T12:00:00Z'),{...op,regra:'*',fonte:'xp'});
  assert.equal(xp.total,4);assert.equal(xp.itens.reduce((n,l)=>n+l.xp,0),74);
  const bonus=await desempenhoTrabalho(sql,6,new Date('2026-10-23T12:00:00Z'),{...op,regra:'meta_semana',fonte:'xp'});
  assert.equal(bonus.itens[0].ref,null);assert.ok(bonus.itens[0].observacao.includes('sem demanda'));
 });
 await t.test('prazo é reconstruído na entrega; retorno observa apenas o período selecionado',async()=>{
  const q=(await desempenhoTrabalho(sql,6,new Date('2026-10-23T12:00:00Z'),{de:'2026-10-01',ate:'2026-10-23'})).qualidade;
  assert.equal(q.entregas,2);assert.equal(q.com_prazo,2);assert.equal(q.no_prazo,1);assert.equal(q.com_retorno,1);
  const cedo=(await desempenhoTrabalho(sql,6,new Date('2026-10-23T12:00:00Z'),{de:'2026-10-01',ate:'2026-10-01'})).qualidade;
  assert.equal(cedo.com_retorno,0);
 });
 await t.test('XP público agrupa ações do mesmo dia sem expor a origem do razão',async()=>{
  await db.exec(`INSERT INTO vybe_escritorio_moedas VALUES(6,'acao2','acao_painel',NULL,'2026-10-01T14:00:00Z',1)`);
  const r=await desempenhoTrabalho(sql,6,new Date('2026-10-23T12:00:00Z'),{de:'2026-10-01',ate:'2026-10-23',detalhes:true,fonte:'xp',regra:'acao_painel'});
  assert.equal(r.total,1);assert.equal(r.itens[0].eventos,2);assert.equal(r.itens[0].xp,2);assert.ok(!('origem' in r.itens[0]));
 });


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

test('datas reais, limite, virada de ano e período futuro são validados no servidor',()=>{
 assert.throws(()=>periodoTrabalho('2026-10-23',{de:'2026-02-30',ate:'2026-10-23'}),{status:400});
 assert.throws(()=>periodoTrabalho('2026-10-23',{de:'2026-10-24',ate:'2026-10-25'}),{status:400});
 assert.throws(()=>periodoTrabalho('2026-10-23',{de:'2025-01-01',ate:'2026-10-23'}),{status:400});
 assert.equal(periodoTrabalho('2026-01-03',{de:'2026-01-01',ate:'2026-01-03'}).desde,'2025-12-29');
});

test('calendário mensal e personalizado preservam datas sem fuso e média móvel inclui zeros',()=>{
 const trecho=fonte.slice(fonte.indexOf('function escritorioTrabalhoPeriodo('),fonte.indexOf('function escritorioTrabalhoDatas('));
 vm.runInContext(trecho,ctx);
 assert.equal(ctx.escritorioTrabalhoPeriodo('2026-01-23',{periodo:'mes-passado'}).de,'2025-12-01');
 assert.equal(ctx.escritorioTrabalhoPeriodo('2024-03-10',{periodo:'mes-passado'}).ate,'2024-02-29');
 const c=ctx.escritorioTrabalhoConta({hoje:'2026-10-23',linhas:[{dia:'2026-10-20',regra:'peca_criacao',formato:'card',n:7}]},{de:'2026-10-20',ate:'2026-10-20',regra:'peca_criacao'});
 assert.equal(c.serie.length,1);assert.equal(c.atual.total,7);assert.equal(c.movel[0],1);
});

test('a tela discrimina bônus e penalidade e mantém todos os papéis acessíveis sem interpolar HTML do cadastro',()=>{
 const safe=readFileSync('vybe-gestor.js','utf8').match(/function safeText\(value\) \{[\s\S]*?\n\}/)[0];
 const tela=vm.createContext({escritorio:{trabalhos:{'6':{dados:{disponivel:true,hoje:'2026-10-23',funcao:'criacao',regras:{meta_semana:'Meta da semana',criacao_alteracao:'Retorno'},atividades:[{regra:'peca_criacao',nome:'Peças feitas'}],linhas:[{dia:'2026-10-20',regra:'peca_criacao',formato:'<img onerror=alert(1)>',n:1}],recordes:[],ganhos:[{dia:'2026-10-20',regra:'peca_criacao',xp:30,eventos:1},{dia:'2026-10-20',regra:'meta_semana',xp:50,eventos:1},{dia:'2026-10-20',regra:'criacao_alteracao',xp:-7,eventos:1}]}}}},vbEstadoHtml:()=>'',vbCabecalhoHtml:()=>'<header class="vb-cabecalho"></header>'});
 vm.runInContext(safe+'\n'+fonte.slice(fonte.indexOf('function escritorioTrabalhoPeriodo('),fonte.indexOf('const ESCRITORIO_FICHA_ABAS')),tela);
 const html=tela.escritorioTrabalhoHtml('6');
 assert.ok(html.includes('Meta da semana'));assert.ok(html.includes('Retorno'));assert.ok(html.includes('>73</th>'));
 assert.ok(html.includes('escritorioTrabalhoDetalhar'));assert.ok(html.includes('ofc-trabalho-media'));assert.ok(!html.includes('<img onerror='));
});

test('troca de período ignora resposta antiga que termina depois da consulta nova',async()=>{
 const pendentes=[];
 const c=vm.createContext({escritorio:{trabalhoFiltros:{'6':{periodo:'7'}}},escritorioApi:(_a,_b,q)=>new Promise(resolve=>pendentes.push({q,resolve})),document:{getElementById:()=>null}});
 vm.runInContext(fonte.slice(fonte.indexOf('function escritorioTrabalhoPeriodo('),fonte.indexOf('const ESCRITORIO_FICHA_ABAS')),c);
 c.escritorioTrabalhoCarregar('6');c.escritorio.trabalhoFiltros['6'].periodo='90';c.escritorioTrabalhoCarregar('6');
 assert.equal(pendentes.length,2);assert.notEqual(pendentes[0].q.de,pendentes[1].q.de);
 pendentes[1].resolve({perfil:{trabalho:{selo:'nova'}}});await new Promise(r=>setImmediate(r));
 pendentes[0].resolve({perfil:{trabalho:{selo:'antiga'}}});await new Promise(r=>setImmediate(r));
 assert.equal(c.escritorio.trabalhos['6'].dados.selo,'nova');
});
