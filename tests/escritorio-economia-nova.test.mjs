// Nova economia (20/10/2026): moedas mais raras, preços por tempo de trabalho e
// saldo recalculado pela regra nova, uma vez, sem mexer no XP.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio} from './escritorio-esquema.mjs';

const MIGRACAO=readFileSync('migrations/2026-10-20-escritorio-economia.sql','utf8');
test('economia nova: regras e preços na tabela, saldo recalculado uma vez, XP intacto',async t=>{
 const {db,sql}=await bancoEscritorio(t);
 await db.exec(readFileSync('migrations/2026-10-19-escritorio-gestao-pontos.sql','utf8'));
 // Paulo: chegada grande, 3 conquistas, uma compra. Reriston: chegada pequena, perda que parou no zero.
 await db.exec(`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo,xp) VALUES(1,0,0),(2,0,0) ON CONFLICT DO NOTHING`);
 await sql`SELECT vybe_lancar_pontos(1,'chegada:1','chegada',NULL,4000,20000)`;
 for(const k of ['a','b','c'])await sql`SELECT vybe_lancar_pontos(1,${'conquista:'+k},'conquista',NULL,50,50)`;
 await sql`SELECT vybe_lancar_pontos(1,'agencia:9','agencia',9,5,5)`;
 await db.exec(`INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade) VALUES(1,'compra:x:shelves',-120); UPDATE vybe_escritorio_carteiras SET saldo=saldo-120 WHERE pessoa_id=1`);
 await sql`SELECT vybe_lancar_pontos(2,'chegada:2','chegada',NULL,100,500)`;
 await sql`SELECT vybe_lancar_pontos(2,'aprov:1','criacao_aprovacao',1,10,10)`;
 const marcosAntes=await sql`SELECT classe,raridade,marco FROM vybe_escritorio_catalogo WHERE marco IS NOT NULL ORDER BY classe`;
 assert.ok(marcosAntes.length>0);
 assert.ok((await sql`SELECT count(*)::int n FROM vybe_escritorio_catalogo WHERE raridade='muito_raro'`)[0].n>0);
 const antes=Object.fromEntries((await sql`SELECT pessoa_id,saldo,xp FROM vybe_escritorio_carteiras`).map(c=>[c.pessoa_id,c]));
 assert.equal(Number(antes[1].saldo),4000+150+5-120);
 await db.exec(MIGRACAO);
 const depois=Object.fromEntries((await sql`SELECT pessoa_id,saldo,xp FROM vybe_escritorio_carteiras`).map(c=>[c.pessoa_id,c]));
 // Paulo: chegada 4000 → no máximo 500; conquistas 3×25; agência 1; compra −120.
 assert.equal(Number(depois[1].saldo),500+75+1-120);
 // Reriston: chegada 100 → 25; aprovação 4.
 assert.equal(Number(depois[2].saldo),25+4);
 assert.equal(depois[1].xp,antes[1].xp,'XP não muda');
 const [aj]=await sql`SELECT quantidade,pontos FROM vybe_escritorio_moedas WHERE pessoa_id=1 AND origem='ajuste:economia-2026-10-20'`;
 assert.equal(Number(aj.quantidade),Number(depois[1].saldo)-Number(antes[1].saldo));assert.equal(aj.pontos,0);
 const preco=Object.fromEntries((await sql`SELECT chave,preco FROM vybe_escritorio_raridades`).map(r=>[r.chave,r.preco]));
 assert.deepEqual(preco,{comum:40,incomum:120,raro:300,epico:900,lendario:2500});
 // Cinco faixas na ordem; muito raro virou épico; marcos intactos; catálogo pelo script.
 assert.deepEqual((await sql`SELECT chave FROM vybe_escritorio_raridades ORDER BY ordem`).map(r=>r.chave),['comum','incomum','raro','epico','lendario']);
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_catalogo WHERE raridade='muito_raro'`)[0].n,0);
 assert.deepEqual(await sql`SELECT classe,raridade,marco FROM vybe_escritorio_catalogo WHERE marco IS NOT NULL ORDER BY classe`,marcosAntes);
 const {raridadesDoCatalogo}=await import('../scripts/escritorio-raridades.mjs');
 const mapa=raridadesDoCatalogo();
 const fora=(await sql`SELECT classe,raridade FROM vybe_escritorio_catalogo WHERE marco IS NULL`).filter(r=>(mapa[r.classe]||'comum')!==r.raridade);
 assert.deepEqual(fora,[]);
 await assert.rejects(db.exec(`INSERT INTO vybe_escritorio_raridades(chave,nome,ordem,preco) VALUES('muito_raro','x',9,1)`));
 const [conq]=await sql`SELECT moedas,pontos FROM vybe_escritorio_regras WHERE chave='conquista'`;
 assert.equal(conq.moedas,25);assert.equal(conq.pontos,50);
 // Conquista nova paga pela tabela, mesmo quem chama passando 50.
 await sql`SELECT vybe_creditar_moedas(2,'conquista:meu-quarto',50)`;
 const [r2]=await sql`SELECT saldo,xp FROM vybe_escritorio_carteiras WHERE pessoa_id=2`;
 assert.equal(Number(r2.saldo),29+25);assert.equal(Number(r2.xp),Number(depois[2].xp)+50);
 // Rodar de novo não muda nada.
 await db.exec(MIGRACAO);
 const [r3]=await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=1`;
 assert.equal(Number(r3.saldo),Number(depois[1].saldo));
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_moedas WHERE origem='ajuste:economia-2026-10-20'`)[0].n,2);
});
