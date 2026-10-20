// Loja fase 2: preço por faixa, estoque esgotado, vitrine por semana, móvel só
// por marco e marcos idempotentes (docs/escritorio-pontos.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio as banco} from './escritorio-esquema.mjs';
import {comprarMovel,carregarEconomia,carregarLoja,infoMovel,vitrineDaSemana} from '../server/escritorio-economia.js';
import {conferirMarcos,conferirMarcosDaEquipe,MARCOS} from '../server/escritorio-marcos.js';
import {diaBahia,inicioDaSemana,somarDias} from '../server/escritorio-pontos.js';
const saldo=async(sql,p)=>{const [c]=await sql`SELECT saldo,xp FROM vybe_escritorio_carteiras WHERE pessoa_id=${p}`;return c?[Number(c.saldo),Number(c.xp)]:[0,0];};
const creditar=(sql,p,n)=>sql`SELECT vybe_lancar_pontos(${p},${'teste:'+crypto.randomUUID()},NULL,NULL,${n},0)`;
const umaClasse=async(sql,raridade)=>(await sql`SELECT classe FROM vybe_escritorio_catalogo WHERE raridade=${raridade} AND marco IS NULL ORDER BY classe LIMIT 1`)[0].classe;
const inventario=async(sql,p,classe)=>Number((await sql`SELECT quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${p} AND classe=${classe}`)[0]?.quantidade||0);
// O relógio real: as compras gravam criado_em=now(), e a vitrine olha a semana corrente.
const AGORA=new Date(), SEMANA=inicioDaSemana(diaBahia(AGORA));
const em=(iso,hora)=>new Date(`${iso}T${hora}-03:00`);

test('preço vem da faixa na tabela; comum e raro sempre à venda; essenciais grátis; sem marcos repetidos',async t=>{
 const {sql}=await banco(t);
 await creditar(sql,1,1000);
 const raro=await umaClasse(sql,'raro');
 let e=await comprarMovel(sql,1,{classe:'shelves_norja',chave:crypto.randomUUID()},AGORA);
 assert.equal(e.saldo,975);                                   // comum: 25
 assert.equal(infoMovel(e.loja,'shelves_norja').raridade,'comum');
 e=await comprarMovel(sql,1,{classe:raro,chave:crypto.randomUUID()},AGORA);
 assert.equal(e.saldo,855);                                   // raro: 120
 assert.equal(infoMovel(e.loja,raro).restante,9);             // estoque padrão da faixa (10) menos a venda
 await sql`UPDATE vybe_escritorio_raridades SET preco=100 WHERE chave='raro'`;
 e=await comprarMovel(sql,1,{classe:raro,chave:crypto.randomUUID()},AGORA);
 assert.equal(e.saldo,755);                                   // novo preço da faixa, sem deploy
 await sql`UPDATE vybe_escritorio_catalogo SET preco=30 WHERE classe=${raro}`;
 e=await comprarMovel(sql,1,{classe:raro,chave:crypto.randomUUID()},AGORA);
 assert.equal(e.saldo,725);                                   // preço próprio do móvel vale sobre o da faixa
 await assert.rejects(comprarMovel(sql,1,{classe:'exe_table',chave:crypto.randomUUID()},AGORA),/gratuitos/);
 await assert.rejects(comprarMovel(sql,1,{classe:'nao_existe',chave:crypto.randomUUID()},AGORA),/não está disponível/);
 assert.equal(e.inventario.find(i=>i.classe===raro).quantidade,3);
});
test('estoque esgotado: o último exemplar vai para uma pessoa só, mesmo em compras ao mesmo tempo',async t=>{
 const {sql}=await banco(t);
 const raro=await umaClasse(sql,'raro');
 await sql`UPDATE vybe_escritorio_catalogo SET estoque=2 WHERE classe=${raro}`;
 for(const p of [1,2,3]) await creditar(sql,p,500);
 const r=await Promise.allSettled([1,2,3].map(p=>comprarMovel(sql,p,{classe:raro,chave:crypto.randomUUID()},AGORA)));
 assert.equal(r.filter(x=>x.status==='fulfilled').length,2);
 assert.match(r.find(x=>x.status==='rejected').reason.message,/Esgotado/);
 const loja=await carregarLoja(sql,AGORA);
 assert.equal(infoMovel(loja,raro).restante,0);
 await assert.rejects(comprarMovel(sql,1,{classe:raro,chave:crypto.randomUUID()},AGORA),/Esgotado/);
 // Quem comprou gastou; quem não comprou ficou com o saldo inteiro.
 const saldos=await Promise.all([1,2,3].map(p=>saldo(sql,p).then(s=>s[0])));
 assert.deepEqual(saldos.sort(),[380,380,500]);
 const [v]=await sql`SELECT vendidos FROM vybe_escritorio_catalogo WHERE classe=${raro}`;assert.equal(Number(v.vendidos),2);
});
test('vitrine da semana: 6 muito raros e 2 lendários fixos por semana; fora dela não se compra; esgotar não tira da vitrine',async t=>{
 const {sql}=await banco(t);
 await creditar(sql,1,5000);
 const loja=await carregarLoja(sql,AGORA);
 assert.equal(loja.semana,SEMANA);
 const faixa=c=>loja.itens.find(i=>i.classe===c).raridade;
 assert.equal(loja.vitrine.length,8);
 assert.deepEqual(loja.vitrine.map(faixa),['muito_raro','muito_raro','muito_raro','muito_raro','muito_raro','muito_raro','lendario','lendario']);
 assert.ok(loja.vitrine.every(c=>!loja.itens.find(i=>i.classe===c).marco));
 assert.deepEqual((await carregarLoja(sql,em(somarDias(SEMANA,6),'20:00:00'))).vitrine,loja.vitrine); // domingo: mesma semana
 const proxima=await carregarLoja(sql,em(somarDias(SEMANA,7),'01:00:00'));                           // segunda 01:00 da Bahia
 assert.equal(proxima.semana,somarDias(SEMANA,7));assert.notDeepEqual(proxima.vitrine,loja.vitrine);
 const fora=loja.itens.find(i=>i.raridade==='muito_raro'&&!i.marco&&!loja.vitrine.includes(i.classe)).classe;
 await assert.rejects(comprarMovel(sql,1,{classe:fora,chave:crypto.randomUUID()},AGORA),/vitrine desta semana/);
 assert.equal(infoMovel(loja,fora).naVitrine,false);
 const lendario=loja.vitrine[7];
 const e=await comprarMovel(sql,1,{classe:lendario,chave:crypto.randomUUID()},AGORA);
 assert.equal(e.saldo,3500);                                  // lendário: 1.500
 assert.equal(infoMovel(e.loja,lendario).restante,0);
 assert.deepEqual(e.loja.vitrine,loja.vitrine);               // esgotou nesta semana: continua na vitrine, como "Esgotado"
 await assert.rejects(comprarMovel(sql,2,{classe:lendario,chave:crypto.randomUUID()},AGORA),/Esgotado/);
 // Na semana seguinte o esgotado sai do sorteio.
 assert.ok(!(await carregarLoja(sql,em(somarDias(SEMANA,9),'15:00:00'))).vitrine.includes(lendario));
 // O sorteio é só função da semana e do móvel.
 assert.deepEqual(vitrineDaSemana({semana:SEMANA,raridades:loja.raridades,itens:loja.itens,vendidosNaSemana:[lendario]}),e.loja.vitrine);
});
test('compra pela metade (falha) não deixa venda nem móvel; repetição da mesma chave não cobra de novo',async t=>{
 const {sql}=await banco(t);
 await creditar(sql,1,200);
 const raro=await umaClasse(sql,'raro');
 const compra={classe:raro,chave:crypto.randomUUID()};
 const e1=await comprarMovel(sql,1,compra,AGORA);
 const e2=await comprarMovel(sql,1,compra,AGORA);
 assert.equal(e1.saldo,80);assert.equal(e2.saldo,80);assert.equal(await inventario(sql,1,raro),1);
 const [v]=await sql`SELECT vendidos FROM vybe_escritorio_catalogo WHERE classe=${raro}`;assert.equal(Number(v.vendidos),1);
 await assert.rejects(comprarMovel(sql,1,{classe:raro,chave:crypto.randomUUID()},AGORA),/insuficientes/);
 const [v2]=await sql`SELECT vendidos FROM vybe_escritorio_catalogo WHERE classe=${raro}`;assert.equal(Number(v2.vendidos),1);
});
// A migração das conquistas vem depois da economia de 20/10 (em produção, nessa ordem).
const MIGRACAO_CONQUISTAS=readFileSync('migrations/2026-10-20-escritorio-conquistas.sql','utf8');
const NIVEIS=readFileSync('migrations/2026-10-20-escritorio-conquistas-niveis.sql','utf8');
// Escadas de conquistas: precisam do peso por formato e do bolo (regras peca_*).
async function bancoNiveis(t){
 const {db,sql}=await banco(t);
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text, ADD COLUMN titulo text, ADD COLUMN clientes_texto text, ADD COLUMN monday_item_id text, ADD COLUMN etapa text;`);
 for (const f of ['2026-10-19-escritorio-gestao-pontos.sql','2026-10-20-escritorio-complexidade.sql','2026-10-20-escritorio-bolo-por-peca.sql']) await db.exec(readFileSync('migrations/'+f,'utf8'));
 await db.exec(NIVEIS);
 return {db,sql};
}
test('escadas: cada tipo de entrega sobe de Bronze a Diamante, com o troféu e a conquista do nível, uma vez',async t=>{
 const {db,sql}=await bancoNiveis(t);
 const cards=async(de,ate)=>db.exec(`INSERT INTO vybe_conteudos(id,board_id,formato) SELECT n,7829537690,'Card' FROM generate_series(${de},${ate}) n;
  INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia) SELECT 3,'peca:'||n||':criacao','peca_criacao',n,current_date FROM generate_series(${de},${ate}) n;`);
 await cards(1,39);
 let lista=await conferirMarcos(sql,3,AGORA), c=lista.find(m=>m.id==='cards');
 assert.equal(c.nivel,0);assert.deepEqual([c.valor,c.proximo.meta,c.proximo.nome],[39,40,'Bronze']);
 await cards(40,40);
 const antes=await saldo(sql,3);
 lista=await conferirMarcos(sql,3,AGORA); c=lista.find(m=>m.id==='cards');
 assert.deepEqual([c.nivel,c.nomeNivel,c.proximo.meta],[1,'Bronze',120]);
 assert.equal(await inventario(sql,3,'trophy_viraldancer_bronze'),1);
 const [r]=await sql`SELECT moedas,pontos FROM vybe_escritorio_regras WHERE chave='conquista'`;
 assert.deepEqual(await saldo(sql,3),[antes[0]+r.moedas,antes[1]+r.pontos]);
 await conferirMarcos(sql,3,AGORA);
 assert.equal(await inventario(sql,3,'trophy_viraldancer_bronze'),1,'conferir de novo não dá outro');
 await cards(41,120);
 lista=await conferirMarcos(sql,3,AGORA); c=lista.find(m=>m.id==='cards');
 assert.deepEqual([c.nivel,c.nomeNivel],[2,'Prata']);
 assert.equal(await inventario(sql,3,'trophy_viraldancer_silver'),1);
 assert.equal(await inventario(sql,3,'trophy_viraldancer_bronze'),0,'o troféu troca: o Bronze guardado sai');
 assert.deepEqual(await saldo(sql,3),[antes[0]+r.moedas*3,antes[1]+r.pontos*3],'Prata vale 2 vezes o Bronze');
 // Entregas no geral pedem 200 para o Bronze: 120 ainda não.
 assert.equal(lista.find(m=>m.id==='entregas').nivel,0);
 // Troféu de conquista não se compra.
 await creditar(sql,3,5000);
 await assert.rejects(comprarMovel(sql,3,{classe:'trophy_viraldancer_gold',chave:crypto.randomUUID()},AGORA),/marco/);
});
test('reavaliação única: conquistas antigas saem (moedas, XP, troféus do inventário e do quarto) sem saldo negativo',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(MIGRACAO_CONQUISTAS);
 await db.exec(`INSERT INTO vybe_escritorio_marcos(pessoa_id,marco) VALUES(4,'primeira'),(4,'dez');
  INSERT INTO vybe_escritorio_inventario VALUES(4,'prize3',1),(4,'shelves_norja',1) ON CONFLICT DO NOTHING;
  INSERT INTO vybe_escritorio_mapa(camada,itens,versao) VALUES('sala-3','[["prize3",1,1,2,0,0],["shelves_norja",2,2,2,0,0]]',1) ON CONFLICT (camada) DO UPDATE SET itens=EXCLUDED.itens;`);
 await sql`SELECT vybe_lancar_pontos(4,'conquista:primeira','conquista',NULL,25,50)`;
 await sql`SELECT vybe_lancar_pontos(4,'conquista:dez','conquista',NULL,25,50)`;
 await sql`UPDATE vybe_escritorio_carteiras SET saldo=30 WHERE pessoa_id=4`;
 await db.exec(NIVEIS);
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_marcos`)[0].n,0);
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_moedas WHERE origem LIKE 'conquista:%'`)[0].n,0);
 assert.equal((await saldo(sql,4))[0],0,'o saldo para no zero');
 assert.equal(await inventario(sql,4,'prize3'),0);assert.equal(await inventario(sql,4,'shelves_norja'),1,'o comprado fica');
 const [m]=await sql`SELECT itens FROM vybe_escritorio_mapa WHERE camada='sala-3'`;
 assert.deepEqual(m.itens.map(i=>i[0]),['shelves_norja'],'o troféu sai do quarto, o resto fica');
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_copia_niveis_marcos`)[0].n,2,'com cópia');
 await db.exec(`INSERT INTO vybe_escritorio_marcos(pessoa_id,marco) VALUES(4,'cards:1')`);
 await db.exec(NIVEIS);
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_marcos`)[0].n,1,'não repete');
});
test('ficha do móvel diz de quem é a sala e como o dono conseguiu: compra, conquista, essencial, sala comum',async t=>{
 const {db,sql}=await bancoNiveis(t);
 const {origemDoMovel}=await import('../server/escritorio-social.js');
 const {salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const equipe=(await sql`SELECT id,nome FROM vybe_pessoas ORDER BY nome`).map(p=>({id:String(p.id),nome:p.nome}));
 const salas=salasDoEscritorio(equipe), sala=salas.find(s=>s.pessoa_id==='1').id;
 await creditar(sql,1,1000);
 await comprarMovel(sql,1,{classe:'shelves_norja',chave:crypto.randomUUID()},AGORA);
 let o=await origemDoMovel(sql,salas,{camada:sala,classe:'shelves_norja'});
 assert.equal(o.dono.nome,'Paulo Martins');assert.equal(o.tipo,'compra');assert.equal(o.unidades,1);
 assert.match(o.origens[0].texto,/Comprado na loja por 40|Comprado na loja por 25/);
 await db.exec(`INSERT INTO vybe_escritorio_marcos(pessoa_id,marco) VALUES(1,'cards:1')`);
 o=await origemDoMovel(sql,salas,{camada:sala,classe:'trophy_viraldancer_bronze'});
 assert.equal(o.tipo,'conquista');assert.match(o.origens[0].texto,/Bronze da conquista "Cards" \(40 cards entregues\)/);assert.ok(o.origens[0].em);
 assert.equal((await origemDoMovel(sql,salas,{camada:sala,classe:'exe_table'})).tipo,'essencial');
 assert.equal((await origemDoMovel(sql,salas,{camada:'cafe',classe:'exe_table'})).tipo,'sala_comum');
 await assert.rejects(origemDoMovel(sql,salas,{camada:sala,classe:"x'; drop"}),/inválido/);
});
test('kit da loja: soma dos preços com desconto, tudo ou nada, repetir a chave não cobra de novo; inventário diz de onde veio',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-escritorio-kits.sql','utf8'));
 const {comprarKit,kitsDaLoja}=await import('../server/escritorio-economia.js');
 const kit=(await kitsDaLoja(sql,AGORA)).find(k=>k.chave==='madeira');
 assert.ok(kit.disponivel);assert.equal(kit.preco,Math.round(kit.cheio*0.85));
 await creditar(sql,1,kit.preco-1);
 await assert.rejects(comprarKit(sql,1,{kit:'madeira',chave:crypto.randomUUID()},AGORA),/insuficientes/);
 assert.equal(await inventario(sql,1,'waasa_desk'),0,'nada entra se não pagou');
 await creditar(sql,1,1);
 const chave=crypto.randomUUID();
 const e=await comprarKit(sql,1,{kit:'madeira',chave},AGORA);
 assert.equal(e.saldo,0);
 for (const c of kit.classes) assert.equal(await inventario(sql,1,c),1);
 await comprarKit(sql,1,{kit:'madeira',chave},AGORA);
 assert.equal(await inventario(sql,1,'waasa_desk'),1,'repetição não cobra nem dá de novo');
 assert.deepEqual(e.origens.waasa_desk,['compra']);
 assert.equal(e.ritmo.dias.length,7);
});
