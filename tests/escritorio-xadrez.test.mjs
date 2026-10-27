// Xadrez no tabuleiro: convite, aposta que sai das duas carteiras e dos dois
// inventários ao começar, lances conferidos no servidor, prêmio para quem dá
// xeque-mate, devolução no empate e vitória por tempo de quem sumiu.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio} from './escritorio-esquema.mjs';

// Esquema do Escritório (carteira, pontos, loja) mais post-its/presentes.
async function banco(t){
 const {db,sql}=await bancoEscritorio(t);
 await db.exec(readFileSync('migrations/2026-10-18-escritorio-postits-presentes.sql','utf8'));
 return {db,sql};
}
const saldo=async(sql,p)=>Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${p}`)[0]?.saldo||0);
const inv=async(sql,p)=>Object.fromEntries((await sql`SELECT classe,quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${p} ORDER BY classe`).map(i=>[i.classe,Number(i.quantidade)]));
const MESA={camada:'jogos',movel:'CF_250_goldenchessboard@3,4'};

test('xadrez: aposta guardada, xeque-mate paga, lance conferido e sem repetir',async t=>{
 const {db,sql}=await banco(t);
 const x=await import('../server/escritorio-xadrez.js');
 await assert.rejects(x.desafiarXadrez(sql,{id:1},[],{para:'3',...MESA,chave:'xadrez-0001'}),/migração/);
 await db.exec(readFileSync('migrations/2026-10-27-escritorio-xadrez.sql','utf8'));
 const {salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:3,nome:'Vinícius'},{id:7,nome:'Bia'}]);
 await sql`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(1,100),(3,30),(7,0)`;
 await sql`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(1,'shelves_norja',1),(3,'pura_mdl1',2),(3,'roupa:hr-828',1)`;
 await sql`INSERT INTO vybe_escritorio_perfis(pessoa_id,preferencias) VALUES(3,'{"figura":"hd-180-1.hr-828-61"}')`;
 // Aposta acima do saldo, roupa vestida e móvel que a pessoa não tem: barrados.
 await assert.rejects(x.desafiarXadrez(sql,{id:7},salas,{para:'1',...MESA,moedas:10,chave:'xadrez-0001'}),/não tem essas VybeCoins/);
 await assert.rejects(x.desafiarXadrez(sql,{id:1},salas,{para:'3',...MESA,pede:[['roupa:hr-828',1]],chave:'xadrez-0001'}),/vestindo/);
 await assert.rejects(x.desafiarXadrez(sql,{id:1},salas,{para:'3',...MESA,pede:[['pura_mdl1',3]],chave:'xadrez-0001'}),/não tem esses móveis/);
 await assert.rejects(x.desafiarXadrez(sql,{id:1},salas,{para:'1',...MESA,chave:'xadrez-0001'}),/outra pessoa/);
 const d=await x.desafiarXadrez(sql,{id:1},salas,{para:'3',...MESA,moedas:20,oferece:[['shelves_norja',1]],pede:[['pura_mdl1',1]],chave:'xadrez-0001'});
 assert.equal((await x.desafiarXadrez(sql,{id:1},salas,{para:'3',...MESA,moedas:20,chave:'xadrez-0001'})).repetido,true,'repetir não cria outro convite');
 assert.equal((await x.listarXadrez(sql,{id:3},MESA)).convites.length,1);
 // Convite é só dos dois.
 await assert.rejects(x.verXadrez(sql,{id:7},d.id),/não encontrada/);
 await assert.rejects(x.responderXadrez(sql,{id:1},salas,{id:d.id,acao:'aceitar'}),/Só quem foi chamado/);
 const r=await x.responderXadrez(sql,{id:3},salas,{id:d.id,acao:'aceitar'});
 assert.equal(r.jogo.estado,'jogando');
 assert.equal(await saldo(sql,1),80);assert.equal(await saldo(sql,3),10);
 assert.deepEqual(await inv(sql,1),{},'o móvel apostado foi para a mesa');
 assert.deepEqual(await inv(sql,3),{pura_mdl1:1,'roupa:hr-828':1});
 assert.equal((await x.responderXadrez(sql,{id:3},salas,{id:d.id,acao:'aceitar'})).repetido,true,'aceitar de novo não tira de novo');
 assert.equal(await saldo(sql,3),10);
 // Qualquer um da equipe assiste; só os dois jogam.
 assert.equal((await x.listarXadrez(sql,{id:7},MESA)).mesa.id,d.id);
 const j=r.jogo, branco=j.brancas.id, preto=j.pretas.id;
 assert.equal(j.vez,'brancas');
 await assert.rejects(x.lanceXadrez(sql,{id:7},{id:d.id,de:'f2',para:'f3',n:0}),/assistindo/);
 await assert.rejects(x.lanceXadrez(sql,{id:preto},{id:d.id,de:'e7',para:'e5',n:0}),/vez da outra/);
 await assert.rejects(x.lanceXadrez(sql,{id:branco},{id:d.id,de:'e2',para:'e5',n:0}),/não vale/);
 assert.deepEqual((await x.verXadrez(sql,{id:branco},d.id)).legais.g1.sort(),['f3','h3']);
 // Mate do pastor ao contrário (o mais curto): as pretas ganham no 2º lance.
 await x.lanceXadrez(sql,{id:branco},{id:d.id,de:'f2',para:'f3',n:0});
 await assert.rejects(x.lanceXadrez(sql,{id:branco},{id:d.id,de:'f2',para:'f3',n:0}),/vez da outra/,'pedido repetido não joga de novo');
 await x.lanceXadrez(sql,{id:preto},{id:d.id,de:'e7',para:'e5',n:1});
 await assert.rejects(x.lanceXadrez(sql,{id:branco},{id:d.id,de:'g2',para:'g4',n:1}),/posição mudou/);
 await x.lanceXadrez(sql,{id:branco},{id:d.id,de:'g2',para:'g4',n:2});
 const fim=await x.lanceXadrez(sql,{id:preto},{id:d.id,de:'d8',para:'h4',n:3});
 assert.equal(fim.jogo.estado,'fim');assert.equal(fim.jogo.resultado,'pretas');assert.equal(fim.jogo.motivo,'mate');
 assert.deepEqual(fim.jogo.lances,['f3','e5','g4','Qh4#']);
 assert.equal(await saldo(sql,Number(preto)),(preto==='1'?80:10)+40,'quem ganhou leva as duas apostas');
 assert.equal(await saldo(sql,Number(branco)),branco==='1'?80:10);
 const doVencedor=await inv(sql,Number(preto));
 assert.equal(doVencedor.shelves_norja,1);assert.equal(doVencedor.pura_mdl1,preto==='3'?2:1);
 const razao=await sql`SELECT pessoa_id,origem,quantidade FROM vybe_escritorio_moedas ORDER BY id`;
 assert.deepEqual(razao.map(l=>l.origem).sort(),[`xadrez:${d.id}:aposta`,`xadrez:${d.id}:aposta`,`xadrez:${d.id}:premio`].sort());
 assert.equal(razao.reduce((s,l)=>s+Number(l.quantidade),0),0,'nada some nem aparece do nada');
 await assert.rejects(x.lanceXadrez(sql,{id:branco},{id:d.id,de:'e2',para:'e4',n:4}),/já acabou/);
});

test('xadrez: de graça, empate combinado devolve, desistência e vitória por tempo',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-27-escritorio-xadrez.sql','utf8'));
 const x=await import('../server/escritorio-xadrez.js');
 await sql`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(1,50),(3,50)`;
 // Empate combinado: cada um recebe a aposta de volta.
 const a=await x.desafiarXadrez(sql,{id:1},[],{para:'3',...MESA,moedas:15,chave:'xadrez-1001'});
 const ja=(await x.responderXadrez(sql,{id:3},[],{id:a.id,acao:'aceitar'})).jogo;
 assert.equal(await saldo(sql,1),35);
 await assert.rejects(x.desafiarXadrez(sql,{id:1},[],{para:'7',...MESA,chave:'xadrez-1002'}),/Termine a sua partida/);
 await assert.rejects(x.acaoXadrez(sql,{id:1},{id:a.id,acao:'aceitar-empate'}),/Não há proposta/);
 await x.acaoXadrez(sql,{id:1},{id:a.id,acao:'empate'});
 await assert.rejects(x.acaoXadrez(sql,{id:1},{id:a.id,acao:'aceitar-empate'}),/Não há proposta/,'quem propôs não aceita a própria');
 const e=await x.acaoXadrez(sql,{id:3},{id:a.id,acao:'aceitar-empate'});
 assert.equal(e.jogo.resultado,'empate');assert.equal(e.jogo.motivo,'acordo');
 assert.equal(await saldo(sql,1),50);assert.equal(await saldo(sql,3),50);
 assert.ok(ja.brancas.id);
 // De graça e desistência: ninguém ganha ou perde moedas.
 const b=await x.desafiarXadrez(sql,{id:3},[],{para:'1',...MESA,chave:'xadrez-1003'});
 await x.responderXadrez(sql,{id:1},[],{id:b.id,acao:'aceitar'});
 const dz=await x.acaoXadrez(sql,{id:3},{id:b.id,acao:'desistir'});
 assert.equal(dz.jogo.resultado,dz.jogo.brancas.id==='1'?'brancas':'pretas');
 assert.equal(await saldo(sql,1),50);assert.equal(await saldo(sql,3),50);
 // Tempo: só depois de 5 minutos sem lance de quem tem a vez.
 const c=await x.desafiarXadrez(sql,{id:1},[],{para:'3',...MESA,moedas:10,chave:'xadrez-1004'});
 const jc=(await x.responderXadrez(sql,{id:3},[],{id:c.id,acao:'aceitar'})).jogo;
 const esperando=jc.pretas.id;
 await assert.rejects(x.acaoXadrez(sql,{id:jc.brancas.id},{id:c.id,acao:'reivindicar'}),/vez é sua/);
 await assert.rejects(x.acaoXadrez(sql,{id:esperando},{id:c.id,acao:'reivindicar'}),/Espere 5 minutos/);
 await sql`UPDATE vybe_escritorio_xadrez SET ultimo_lance_em=now()-interval '6 minutes' WHERE id=${c.id}`;
 assert.equal((await x.verXadrez(sql,{id:esperando},c.id)).pode_reivindicar,true);
 const tm=await x.acaoXadrez(sql,{id:esperando},{id:c.id,acao:'reivindicar'});
 assert.equal(tm.jogo.motivo,'tempo');
 assert.equal(await saldo(sql,Number(esperando)),60);
 // Largada um dia: termina sozinha e perde quem tinha a vez.
 const f=await x.desafiarXadrez(sql,{id:1},[],{para:'3',...MESA,moedas:5,chave:'xadrez-1005'});
 const jf=(await x.responderXadrez(sql,{id:3},[],{id:f.id,acao:'aceitar'})).jogo;
 await sql`UPDATE vybe_escritorio_xadrez SET ultimo_lance_em=now()-interval '25 hours' WHERE id=${f.id}`;
 const vf=await x.verXadrez(sql,{id:1},f.id);
 assert.equal(vf.estado,'fim');assert.equal(vf.motivo,'abandono');assert.equal(vf.resultado,'pretas');
 assert.ok(jf);
 // Convite recusado e cancelado não mexem em nada.
 const g=await x.desafiarXadrez(sql,{id:1},[],{para:'3',...MESA,moedas:5,chave:'xadrez-1006'});
 await assert.rejects(x.responderXadrez(sql,{id:3},[],{id:g.id,acao:'cancelar'}),/só quem chamou/);
 await x.responderXadrez(sql,{id:3},[],{id:g.id,acao:'recusar'});
 assert.equal((await x.listarXadrez(sql,{id:3},MESA)).convites.length,0);
});
