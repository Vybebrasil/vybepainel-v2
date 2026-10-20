// Bolo por peça (Paulo, 20/10/2026): cada peça concluída é dividida por quem
// trabalhou nela, pelas fatias da tabela; o histórico é refeito uma vez.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio} from './escritorio-esquema.mjs';

const ler=f=>readFileSync('migrations/'+f,'utf8');
const BOLO=ler('2026-10-20-escritorio-bolo-por-peca.sql');
async function banco(t){
 const {db,sql}=await bancoEscritorio(t);
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text, ADD COLUMN titulo text, ADD COLUMN clientes_texto text, ADD COLUMN monday_item_id text, ADD COLUMN etapa text;`);
 for(const f of ['2026-10-19-escritorio-gestao-pontos.sql','2026-10-20-escritorio-complexidade.sql']) await db.exec(ler(f));
 return {db,sql};
}
const ganho=async(sql,p,origem)=>{const [m]=await sql`SELECT quantidade,pontos FROM vybe_escritorio_moedas WHERE pessoa_id=${p} AND origem=${origem}`;return m?[Number(m.quantidade),Number(m.pontos)]:null;};

test('reels: Criação 53% (DA com 10% dela), Produção 25%, Atendimento, Agendamento e Gestão; card sem Produção; antes de 17/10 só parte das moedas',async t=>{
 const {db,sql}=await banco(t);
 // Peça 100: reels de Reriston (2), cliente da carteira do Vinícius (3), aprovada pelo Deivid (DA, 4), agendada pela Tainara (5).
 // Peça 101: card da Bia (7) aprovado pelo Paulo (não é DA). Peça 102: card da Jady (6) de setembro.
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,formato) VALUES(100,7829537690,'agendado','Reels'),(101,7829537690,'para_agendar','Card'),(102,7829537690,'para_agendar','Card');
  INSERT INTO vybe_conteudo_responsaveis VALUES(100,2,0),(101,7,0),(102,6,0);
  INSERT INTO vybe_conteudo_clientes VALUES(100,1);
  INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id) VALUES
   (100,'status','Em andamento','Para aprovação',2),(100,'status','Para aprovação','Para agendar',4),(100,'status','Para agendar','Agendado',5),
   (101,'status','Em andamento','Para aprovação',7),(101,'status','Para aprovação','Para agendar',1);
  INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id,em) VALUES(102,'status','Para aprovação','Para agendar',1,'2026-09-01T15:00:00-03:00');`);
 await sql`SELECT vybe_lancar_pontos(2,'chegada:velha','chegada',NULL,999,9999)`;
 await db.exec(BOLO);
 // Tudo recomeçou: a chegada antiga sumiu e ficou a cópia.
 assert.equal(await ganho(sql,2,'chegada:velha'),null);
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_copia_bolo_moedas WHERE origem='chegada:velha'`)[0].n,1);
 // Reels (peso 2,5; bolo 10 moedas e 20 XP por peso).
 assert.deepEqual(await ganho(sql,2,'peca:100:criacao'),[12,24]);   // 53% × 90%
 assert.deepEqual(await ganho(sql,4,'peca:100:da'),[1,3]);          // 53% × 10%
 assert.deepEqual(await ganho(sql,28,'peca:100:producao'),[6,13]);  // 25%: foto e vídeo são do Mizinho
 assert.deepEqual(await ganho(sql,3,'peca:100:atendimento'),[3,5]); // 10%
 assert.deepEqual(await ganho(sql,5,'peca:100:agendamento'),[3,5]); // 10%
 assert.deepEqual(await ganho(sql,1,'peca:100:gestao'),[1,1]);      // 2%
 // Card (peso 1): Criação 70%, sem Produção e sem DA (quem aprovou não é DA).
 assert.deepEqual(await ganho(sql,7,'peca:101:criacao'),[7,14]);
 assert.equal(await ganho(sql,28,'peca:101:producao'),null);
 assert.equal(await ganho(sql,4,'peca:101:da'),null);
 // Antes de 17/10: XP inteiro, 20% das moedas; o razão guarda a data do evento.
 assert.deepEqual(await ganho(sql,6,'peca:102:criacao'),[1,14]);
 const [d]=await sql`SELECT TO_CHAR(criado_em AT TIME ZONE 'America/Bahia','YYYY-MM-DD') AS dia FROM vybe_escritorio_moedas WHERE origem='peca:102:criacao'`;
 assert.equal(d.dia,'2026-09-01');
 // Conclusão de novo não paga outra vez; o gatilho novo paga as peças novas.
 await db.exec(`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id) VALUES(100,'status','Agendado','Finalizado',5)`);
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_moedas WHERE origem LIKE 'peca:100:%'`)[0].n,6);
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,formato) VALUES(103,7829537690,'em_andamento','Fotografia');
  INSERT INTO vybe_conteudo_responsaveis VALUES(103,4,0);
  INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id) VALUES(103,'status','Para aprovação','Para agendar',4);`);
 assert.deepEqual(await ganho(sql,4,'peca:103:criacao'),[5,11]);     // o DA fez a peça: a parte inteira da Criação
 assert.equal(await ganho(sql,4,'peca:103:da'),null);
 assert.deepEqual(await ganho(sql,28,'peca:103:producao'),[3,5]);
 // Saldo e XP batem com o razão; rodar de novo não refaz nada.
 const soma=async()=>(await sql`SELECT sum(saldo)::int s, sum(xp)::int x FROM vybe_escritorio_carteiras`)[0];
 const [r]=await sql`SELECT sum(quantidade)::int s, sum(pontos)::int x FROM vybe_escritorio_moedas`;
 assert.deepEqual(await soma(),{s:r.s,x:r.x});
 await db.exec(BOLO);
 assert.deepEqual(await soma(),{s:r.s,x:r.x});
});
test('ficha e missões mostram a parte de cada um no bolo',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(BOLO);
 const {regrasDaFuncao,missoesDaPessoa}=await import('../server/escritorio-pontos.js');
 const regras=await regrasDaFuncao(sql,'criacao');
 const peca=regras.find(r=>r.chave==='peca_criacao');
 assert.deepEqual(peca.parte,{captada:.53,normal:.7});
 assert.equal(peca.moedas,7);                                          // peça simples de peso 1: 70% de 10
 assert.ok(!regras.some(r=>r.chave==='historico'||r.chave==='criacao_aprovacao'));
 assert.deepEqual(regras.find(r=>r.chave==='peca_da').parte,{captada:.053,normal:.07});
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,formato) VALUES(200,7829537690,'em_andamento','Reels'),(201,7829537690,'em_andamento','Card');
  INSERT INTO vybe_conteudo_responsaveis VALUES(200,2,0),(201,2,0);`);
 const {missoes}=await missoesDaPessoa(sql,2);
 const de=id=>missoes.find(m=>m.ref==='vybe:'+id).recompensa;
 assert.deepEqual(de(200),{moedas:13,pontos:27});                      // reels: 53% de 2,5 × bolo
 assert.deepEqual(de(201),{moedas:7,pontos:14});                       // card: 70%
});
test('móveis comprados ficam e o preço sai do saldo novo, na data da compra, uma vez',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(2,500) ON CONFLICT (pessoa_id) DO UPDATE SET saldo=500;
  INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade,criado_em) VALUES(2,'compra:k1:shelves_norja',-40,'2026-10-18T10:00:00-03:00'),(2,'compra:k2:waasa_desk',-40,'2026-10-18T11:00:00-03:00');
  INSERT INTO vybe_escritorio_inventario VALUES(2,'shelves_norja',1),(2,'waasa_desk',1);`);
 const [{id}]=await sql`SELECT id FROM vybe_escritorio_moedas WHERE origem='compra:k2:waasa_desk'`;
 await sql`INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade) VALUES(2,${'reembolso:compra:'+id},40)`;
 await db.exec(BOLO);
 const COMPRAS=ler('2026-10-20-escritorio-bolo-compras.sql');
 await sql`SELECT vybe_lancar_pontos(2,'teste:saldo-novo','historico',NULL,100,0)`;
 await db.exec(COMPRAS);
 const [c]=await sql`SELECT quantidade, TO_CHAR(criado_em AT TIME ZONE 'America/Bahia','YYYY-MM-DD') dia FROM vybe_escritorio_moedas WHERE origem='compra:k1:shelves_norja'`;
 assert.deepEqual([Number(c.quantidade),c.dia],[-40,'2026-10-18']);
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_moedas WHERE origem='compra:k2:waasa_desk'`)[0].n,0); // já devolvida antes: não desconta
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_inventario WHERE pessoa_id=2`)[0].n,2);
 const saldo=async()=>Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=2`)[0].saldo);
 assert.equal(await saldo(),60);
 await db.exec(COMPRAS);
 assert.equal(await saldo(),60);
});
test('quem cadastra a demanda ganha, e mais com briefing, seja de qual função for',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(BOLO);
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,briefing) VALUES(300,7829537690,'pode_fazer','Roteiro e referências'),(301,7829537690,'pode_fazer',NULL);
  INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,autor_id) VALUES(300,'criacao',3),(301,'criacao',1);`);
 assert.deepEqual(await ganho(sql,3,'cadastro:300'),[1,2]);
 assert.deepEqual(await ganho(sql,3,'briefing:300'),[1,2]);          // Vinícius cadastrou com briefing
 assert.deepEqual(await ganho(sql,1,'cadastro:301'),[1,2]);
 assert.equal(await ganho(sql,1,'briefing:301'),null);              // sem briefing, só o cadastro
});
