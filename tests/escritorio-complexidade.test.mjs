// Recompensa por complexidade (19/10/2026): regras por peça multiplicam moedas e
// XP pelo peso do formato; penalidades e regras por pessoa não mudam.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio} from './escritorio-esquema.mjs';
import {tabelaDasMissoes, missoesDaPessoa} from '../server/escritorio-pontos.js';
import {areaEscritorio} from '../server/escritorio.js';

test('peso do formato multiplica as regras por peça, soma formatos até 5 e vazio vale 1',async t=>{
 const {db,sql}=await bancoEscritorio(t);
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text;
  INSERT INTO vybe_conteudos(id,board_id,formato) VALUES(1,7829537690,'Card'),(2,8385559107,'Impresso'),(3,7829537690,'Carrossel, Fotografia'),(4,7829537690,NULL),
   (5,7829537690,'Vídeo, Motion, Impresso'),(6,7829537690,'Story'),(7,7829537690,'Formato novo');
  INSERT INTO vybe_escritorio_carteiras(pessoa_id) VALUES(2) ON CONFLICT DO NOTHING;`);
 await db.exec(readFileSync('migrations/2026-10-20-escritorio-complexidade.sql','utf8'));
 const peso=async id=>Number((await sql`SELECT vybe_peso_conteudo(${id}) p`)[0].p);
 assert.equal(await peso(1),1);assert.equal(await peso(2),3);assert.equal(await peso(3),3);
 assert.equal(await peso(4),1,'sem formato vale 1');assert.equal(await peso(5),5,'soma até 5');
 assert.equal(await peso(6),0.5);assert.equal(await peso(7),1,'formato desconhecido vale 1');
 // Reriston (criação): enviar para aprovação um Impresso vale 3× um Card.
 const [r]=await sql`SELECT moedas,pontos FROM vybe_escritorio_regras WHERE chave='criacao_aprovacao'`;
 const saldo=async()=>(await sql`SELECT saldo,xp FROM vybe_escritorio_carteiras WHERE pessoa_id=2`)[0];
 const a=await saldo();
 await sql`SELECT vybe_aplicar_regra(2,'criacao_aprovacao','aprov:1',1,current_date)`;
 const b=await saldo();
 await sql`SELECT vybe_aplicar_regra(2,'criacao_aprovacao','aprov:2',2,current_date)`;
 const c=await saldo();
 assert.equal(Number(b.saldo)-Number(a.saldo),r.moedas);assert.equal(Number(b.xp)-Number(a.xp),r.pontos);
 assert.equal(Number(c.saldo)-Number(b.saldo),r.moedas*3);assert.equal(Number(c.xp)-Number(b.xp),r.pontos*3);
 // Penalidade não é multiplicada.
 await sql`SELECT vybe_aplicar_regra(2,'criacao_alteracao','alt:2',2,current_date)`;
 const [pen]=await sql`SELECT quantidade FROM vybe_escritorio_moedas WHERE origem='alt:2'`;
 const [regPen]=await sql`SELECT moedas FROM vybe_escritorio_regras WHERE chave='criacao_alteracao'`;
 assert.equal(Number(pen.quantidade),regPen.moedas);
 // Peso muda na tabela, sem deploy.
 await sql`UPDATE vybe_escritorio_complexidade SET peso=4 WHERE chave='impresso'`;
 assert.equal(await peso(2),4);
 // A tela das missões recebe as regras da função e os pesos.
 const tab=await tabelaDasMissoes(sql,'criacao');
 const chaves=tab.regras.map(r=>r.chave).sort();
 assert.ok(chaves.includes('criacao_aprovacao')&&chaves.includes('entrega'));assert.ok(!chaves.includes('carteira'),'regra de outra função fica de fora');
 assert.equal(tab.regras.find(r=>r.chave==='criacao_aprovacao').por_complexidade,true);
 assert.equal(tab.complexidade.find(c=>c.chave==='impresso').peso,4);
 // Rodar de novo não duplica nem quebra.
 await db.exec(readFileSync('migrations/2026-10-20-escritorio-complexidade.sql','utf8'));
 assert.equal(await peso(2),4,'a migração não sobrescreve peso já ajustado');
});

// Peças abertas do Reriston (2, criação) e do Paulo (1, gestão); a 15 é de outra pessoa.
async function bancoComMissoes(t){
 const {db,sql}=await bancoEscritorio(t);
 await db.exec(readFileSync('migrations/2026-10-19-escritorio-gestao-pontos.sql','utf8'));
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text, ADD COLUMN titulo text, ADD COLUMN clientes_texto text, ADD COLUMN monday_item_id text, ADD COLUMN etapa text;
  INSERT INTO vybe_conteudos(id,board_id,status_chave,prazo,formato,titulo,clientes_texto,monday_item_id) VALUES
   (11,7829537690,'pode_fazer','2026-10-15','Impresso','Cardápio','Brussolo','900'),
   (12,7829537690,'em_andamento','2026-10-25','Card','Card de domingo','Gonzalez',NULL),
   (13,7829537690,'finalizado','2026-10-10','Card','Já entregue','Gonzalez',NULL),
   (14,8385559107,'pode_fazer','2026-10-22','Design','Arte da fachada','DiaLab',NULL),
   (15,7829537690,'pode_fazer','2026-10-25','Card','De outra pessoa','VOA',NULL);
  INSERT INTO vybe_conteudo_responsaveis VALUES(11,2,0),(12,2,0),(13,2,0),(14,2,0),(15,4,0),(11,1,1);
  UPDATE vybe_conteudos SET etapa='Criação' WHERE id=11;`);
 await db.exec(readFileSync('migrations/2026-10-20-escritorio-complexidade.sql','utf8'));
 return {db,sql};
}

test('missões: peças abertas da pessoa, com o valor da regra da função e o peso do formato',async t=>{
 const {sql}=await bancoComMissoes(t);
 const r=await missoesDaPessoa(sql,2,new Date('2026-10-20T15:00:00Z'));
 assert.equal(r.funcao,'criacao');
 assert.deepEqual(r.missoes.map(m=>m.titulo),['Cardápio','Arte da fachada','Card de domingo'],'abertas, da pessoa, por prazo');
 const [card]=await sql`SELECT moedas,pontos FROM vybe_escritorio_regras WHERE chave='criacao_aprovacao'`;
 const cardapio=r.missoes[0];
 assert.equal(cardapio.ref,'900');assert.equal(cardapio.atrasada,true);assert.equal(cardapio.peso,3);
 assert.deepEqual([cardapio.recompensa.moedas,cardapio.recompensa.pontos],[card.moedas*3,card.pontos*3],'impresso vale 3× o card');
 const domingo=r.missoes[2];
 assert.equal(domingo.ref,'vybe:12');assert.deepEqual([domingo.recompensa.moedas,domingo.recompensa.pontos],[card.moedas,card.pontos]);
 const fachada=r.missoes[1];
 assert.equal(fachada.quadro,'demandas');assert.ok(fachada.recompensa&&fachada.bonus,'solicitação paga a entrega e o bônus de prazo');
 assert.equal(cardapio.grupo,'Criação');assert.ok(cardapio.status);
 // Gestão (Paulo) vê o que ganha pela agência, não zero.
 const gestao=await missoesDaPessoa(sql,1,new Date('2026-10-20T15:00:00Z'));
 const [ag]=await sql`SELECT moedas,pontos FROM vybe_escritorio_regras WHERE chave='agencia'`;
 assert.equal(gestao.funcao,'gestao');
 assert.deepEqual([gestao.missoes[0].recompensa.moedas,gestao.missoes[0].recompensa.pontos],[ag.moedas,ag.pontos]);
});

// Rota escritorio/missoes (server/escritorio.js, Irecity 07/11/2026): a mesma
// regra da ficha de outra pessoa (acao=economia). Só leitura.
test('rota missões: as próprias como sempre; as de outra pessoa só para quem administra',async t=>{
 const {sql}=await bancoComMissoes(t);
 const pedir=async(pessoa,query={})=>{
  const r={};
  const res={status(n){r.status=n;return this;},json(d){r.body=d;return d;}};
  await areaEscritorio({method:'GET',query:{acao:'missoes',...query}},res,{tipo:'sessao',pessoa},sql);
  return r;
 };
 const titulos=r=>r.body.missoes.map(m=>m.titulo);
 const contar=async()=>Number((await sql`SELECT (SELECT count(*) FROM vybe_escritorio_moedas)+(SELECT count(*) FROM vybe_escritorio_entregas) AS n`)[0].n);
 const antes=await contar();
 // A própria pessoa, como sempre: sem `pessoa` ou com o próprio id.
 const propria=await pedir({id:2,admin:false});
 assert.equal(propria.status,200);assert.equal(propria.body.ok,true);assert.equal(propria.body.funcao,'criacao');
 assert.deepEqual(titulos(propria),['Cardápio','Arte da fachada','Card de domingo']);
 assert.ok(propria.body.missoes.every(m=>m.recompensa),'com o XP e as moedas');
 assert.deepEqual(await pedir({id:2,admin:false},{pessoa:'2'}),propria);
 // Quem administra (Paulo, 1) vê as do Reriston (2): a mesma conta, com XP e moedas.
 const admin=await pedir({id:1,admin:true},{pessoa:'2'});
 assert.equal(admin.status,200);
 assert.deepEqual(admin.body,propria.body,'as mesmas missões que o Reriston vê');
 const proprioAdmin=await pedir({id:1,admin:true});
 assert.equal(proprioAdmin.body.funcao,'gestao','sem `pessoa`, quem administra vê as dele');
 // Quem não administra e pede outra pessoa: 403, nada calculado (como a ficha).
 const bloqueado=await pedir({id:2,admin:false},{pessoa:'1'});
 assert.equal(bloqueado.status,403);
 assert.deepEqual(bloqueado.body,{error:'Só quem administra vê as missões de outra pessoa.'});
 assert.equal((await pedir({id:2,admin:false},{pessoa:'abc'})).status,403,'antes de validar o id, a permissão');
 // Id que não é número: 400, mesmo para quem administra.
 assert.equal((await pedir({id:1,admin:true},{pessoa:'2 OR 1=1'})).status,400);
 // A ficha segue com a mesma regra.
 const ficha=await (async()=>{const r={};await areaEscritorio({method:'GET',query:{acao:'economia',pessoa:'1'}},{status(n){r.status=n;return this;},json(d){r.body=d;return d;}},{tipo:'sessao',pessoa:{id:2,admin:false}},sql);return r;})();
 assert.deepEqual(ficha,{status:403,body:{error:'Só quem administra vê a ficha de outra pessoa.'}});
 assert.equal(await contar(),antes,'só leitura: nenhuma moeda nem entrega gravada');
});
