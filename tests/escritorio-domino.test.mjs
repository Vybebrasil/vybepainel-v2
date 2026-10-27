// Dominó nas mesas do Escritório: regras (abertura pela maior carroça, encaixe
// nas pontas, compra, passe, batida e trancado) e a mesa genérica (convite,
// aposta guardada, mão escondida de quem não é dono, prêmio, desistência).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio} from './escritorio-esquema.mjs';
import {iniciarDomino,jogarDomino,vistaDomino,todasAsPecas} from '../server/escritorio-domino.js';

async function banco(t){
 const {db,sql}=await bancoEscritorio(t);
 await db.exec(readFileSync('migrations/2026-10-18-escritorio-postits-presentes.sql','utf8'));
 return {db,sql};
}
const saldo=async(sql,p)=>Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${p}`)[0]?.saldo||0);
const inv=async(sql,p)=>Object.fromEntries((await sql`SELECT classe,quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${p} ORDER BY classe`).map(i=>[i.classe,Number(i.quantidade)]));
const MESA={jogo:'domino',camada:'jogos',movel:'hobbies_c26_gamingtable@5,6'};

test('dominó: 28 peças, sete para cada um e abre quem tem a maior carroça',()=>{
 assert.equal(todasAsPecas().length,28);
 const m=iniciarDomino();
 assert.equal(m.maos.desafiante.length,7);assert.equal(m.maos.desafiado.length,7);assert.equal(m.monte.length,14);
 const todas=[...m.maos.desafiante,...m.maos.desafiado,...m.monte].map(p=>p.join()).sort();
 assert.deepEqual(todas,todasAsPecas().map(p=>p.join()).sort(),'nenhuma peça repetida ou perdida');
 assert.ok(m.maos[m.vez].some(p=>p.join()===m.abertura.join()),'quem abre tem a peça da abertura');
 // Ordem fixa: o desafiado tem a 6-6.
 const pecas=todasAsPecas();
 const ordem=[...pecas.filter(p=>p.join()!=='6,6').slice(0,7),[6,6],...pecas.filter(p=>p.join()!=='6,6').slice(7)];
 const f=iniciarDomino(ordem);
 assert.equal(f.vez,'desafiado');assert.deepEqual(f.abertura,[6,6]);
 assert.throws(()=>jogarDomino(f,'desafiante',{tipo:'jogar',peca:f.maos.desafiante[0]}),/vez da outra/);
 const outra=f.maos.desafiado.find(p=>p.join()!=='6,6');
 assert.throws(()=>jogarDomino(f,'desafiado',{tipo:'jogar',peca:outra}),/maior carroça/);
 const {mesa}=jogarDomino(f,'desafiado',{tipo:'jogar',peca:[6,6]});
 assert.deepEqual(mesa.linha,[[6,6]]);assert.equal(mesa.vez,'desafiante');assert.equal(mesa.n,1);
 assert.equal(f.linha.length,0,'a mesa antiga não muda');
});

test('dominó: encaixe nas pontas, compra, passe, batida e trancado',()=>{
 const base={linha:[[2,5]],vez:'desafiante',abertura:null,passes:0,n:3,ultimo:null};
 // Encaixa nas duas pontas: tem que dizer qual; a peça vira para casar.
 let m={...base,maos:{desafiante:[[5,2],[0,0]],desafiado:[[1,1]]},monte:[[3,3]]};
 assert.throws(()=>jogarDomino(m,'desafiante',{tipo:'jogar',peca:[2,5]}),/ponta/);
 assert.throws(()=>jogarDomino(m,'desafiante',{tipo:'jogar',peca:[4,4]}),/não é sua/);
 assert.throws(()=>jogarDomino(m,'desafiante',{tipo:'jogar',peca:[0,0]}),/não encaixa/);
 assert.throws(()=>jogarDomino(m,'desafiante',{tipo:'comprar'}),/tem peça/);
 let r=jogarDomino(m,'desafiante',{tipo:'jogar',peca:[2,5],ponta:'esq'});
 assert.deepEqual(r.mesa.linha,[[5,2],[2,5]]);assert.equal(r.fim,null);
 r=jogarDomino(m,'desafiante',{tipo:'jogar',peca:[5,2],ponta:'dir'});
 assert.deepEqual(r.mesa.linha,[[2,5],[5,2]]);
 // Sem peça: compra (a vez fica), monte vazio: passa.
 m={...base,maos:{desafiante:[[0,0]],desafiado:[[1,1],[2,3]]},monte:[[4,4]]};
 assert.throws(()=>jogarDomino(m,'desafiante',{tipo:'passar'}),/compre/);
 r=jogarDomino(m,'desafiante',{tipo:'comprar'});
 assert.equal(r.mesa.vez,'desafiante');assert.equal(r.mesa.maos.desafiante.length,2);assert.equal(r.mesa.monte.length,0);
 r=jogarDomino(r.mesa,'desafiante',{tipo:'passar'});
 assert.equal(r.mesa.vez,'desafiado');assert.equal(r.fim,null);
 // A vista: o desafiado pode jogar a 2-3; não vê a mão do outro.
 const v=vistaDomino(r.mesa,'desafiado',false);
 assert.deepEqual(v.jogaveis,[{peca:[2,3],pontas:['esq']}]);assert.equal(v.pecas.desafiante,2);assert.equal(v.revelado,null);
 assert.equal(vistaDomino(r.mesa,null,false).mao,null,'quem assiste não vê mão nenhuma');
 // Batida: a última peça acaba o jogo.
 const bat=jogarDomino({...base,vez:'desafiado',maos:{desafiante:[[6,6]],desafiado:[[5,5]]},monte:[]},'desafiado',{tipo:'jogar',peca:[5,5]});
 assert.deepEqual(bat.fim,{resultado:'desafiado',motivo:'batida'});
 // Trancado: os dois passam; ganha quem tem menos pontos (empate se igual).
 const tr={...base,maos:{desafiante:[[0,1]],desafiado:[[3,3]]},monte:[]};
 let p=jogarDomino(tr,'desafiante',{tipo:'passar'});
 p=jogarDomino(p.mesa,'desafiado',{tipo:'passar'});
 assert.deepEqual(p.fim,{resultado:'desafiante',motivo:'trancado'});
 assert.deepEqual(vistaDomino(p.mesa,'desafiado',true).revelado.pontos,{desafiante:1,desafiado:6});
 const igual={...base,maos:{desafiante:[[0,4]],desafiado:[[1,3]]},monte:[]};
 p=jogarDomino(jogarDomino(igual,'desafiante',{tipo:'passar'}).mesa,'desafiado',{tipo:'passar'});
 assert.equal(p.fim.resultado,'empate');
});

test('mesa de dominó: aposta guardada, mão escondida, batida paga e desistência',async t=>{
 const {db,sql}=await banco(t);
 const x=await import('../server/escritorio-mesas.js');
 assert.equal((await x.listarMesa(sql,{id:1},MESA)).disponivel,false);
 await assert.rejects(x.desafiarMesa(sql,{id:1},[],{para:'3',...MESA,chave:'domino-0001'}),/migração/);
 await db.exec(readFileSync('migrations/2026-10-27-escritorio-mesas.sql','utf8'));
 const {salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:3,nome:'Vinícius'},{id:7,nome:'Bia'}]);
 await sql`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(1,100),(3,30),(7,0)`;
 await sql`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(1,'shelves_norja',1),(3,'pura_mdl1',2)`;
 await assert.rejects(x.desafiarMesa(sql,{id:1},salas,{...MESA,jogo:'bingo',para:'3',chave:'domino-0001'}),/Jogo inválido/);
 await assert.rejects(x.desafiarMesa(sql,{id:7},salas,{para:'1',...MESA,moedas:10,chave:'domino-0001'}),/não tem essas VybeCoins/);
 const d=await x.desafiarMesa(sql,{id:1},salas,{para:'3',...MESA,moedas:20,oferece:[['shelves_norja',1]],pede:[['pura_mdl1',1]],chave:'domino-0001'});
 assert.equal((await x.desafiarMesa(sql,{id:1},salas,{para:'3',...MESA,moedas:20,chave:'domino-0001'})).repetido,true);
 assert.equal((await x.listarMesa(sql,{id:3},MESA)).convites.length,1);
 await assert.rejects(x.verMesa(sql,{id:7},d.id),/não encontrada/);
 const r=await x.responderMesa(sql,{id:3},salas,{id:d.id,acao:'aceitar'});
 assert.equal(r.jogo.estado,'jogando');
 assert.equal(await saldo(sql,1),80);assert.equal(await saldo(sql,3),10);
 assert.deepEqual(await inv(sql,1),{});assert.deepEqual(await inv(sql,3),{pura_mdl1:1});
 assert.equal(r.jogo.mesa.mao.length,7,'quem aceitou vê as próprias 7 peças');
 // Quem passa pela mesa assiste, sem ver mão nenhuma.
 const vendo=(await x.listarMesa(sql,{id:7},MESA)).mesa;
 assert.equal(vendo.eu,null);assert.equal(vendo.mesa.mao,null);assert.equal(vendo.mesa.pecas.desafiante,7);
 // Joga de verdade até alguém bater, com mãos arrumadas para acabar logo.
 await sql`UPDATE vybe_escritorio_partidas SET mesa=${JSON.stringify({maos:{desafiante:[[6,6],[1,2]],desafiado:[[6,3]]},monte:[],linha:[],vez:'desafiante',abertura:[6,6],passes:0,n:0,ultimo:null})}::jsonb WHERE id=${d.id}`;
 await assert.rejects(x.lanceMesa(sql,{id:3},{id:d.id,n:0,tipo:'jogar',peca:[6,3]}),/vez da outra/);
 await assert.rejects(x.lanceMesa(sql,{id:7},{id:d.id,n:0,tipo:'jogar',peca:[6,6]}),/assistindo/);
 let l=await x.lanceMesa(sql,{id:1},{id:d.id,n:0,tipo:'jogar',peca:[6,6]});
 assert.equal(l.jogo.vez,'desafiado');
 await assert.rejects(x.lanceMesa(sql,{id:3},{id:d.id,n:0,tipo:'jogar',peca:[6,3]}),/mesa mudou/,'pedido repetido não joga duas vezes');
 l=await x.lanceMesa(sql,{id:3},{id:d.id,n:1,tipo:'jogar',peca:[6,3]});
 assert.equal(l.jogo.estado,'fim');assert.equal(l.jogo.resultado,'desafiado');assert.equal(l.jogo.motivo_nome,'Bateu');
 assert.ok(l.jogo.mesa.revelado,'no fim as mãos aparecem');
 assert.equal(await saldo(sql,3),50);assert.equal(await saldo(sql,1),80);
 assert.deepEqual(await inv(sql,3),{pura_mdl1:2,shelves_norja:1});
 const origens=(await sql`SELECT origem FROM vybe_escritorio_moedas WHERE pessoa_id=3 ORDER BY id`).map(m=>m.origem);
 assert.deepEqual(origens,[`domino:${d.id}:aposta`,`domino:${d.id}:premio`]);
 // De graça: desistência encerra e ninguém ganha moeda.
 const g=await x.desafiarMesa(sql,{id:7},salas,{para:'1',...MESA,chave:'domino-0002'});
 await x.responderMesa(sql,{id:1},salas,{id:g.id,acao:'aceitar'});
 await assert.rejects(x.responderMesa(sql,{id:3},salas,{id:(await x.desafiarMesa(sql,{id:3},salas,{para:'7',...MESA,chave:'domino-0003'})).id,acao:'aceitar'}),/Só quem foi chamado/);
 const fim=await x.acaoMesa(sql,{id:7},{id:g.id,acao:'desistir'});
 assert.equal(fim.jogo.resultado,'desafiado');assert.equal(fim.jogo.motivo_nome,'Desistência');
 assert.equal(await saldo(sql,7),0);
 // Vitória por tempo: quem esperou 5 minutos sem jogada da outra pessoa.
 const h=await x.desafiarMesa(sql,{id:1},salas,{para:'7',...MESA,chave:'domino-0004'});
 const jh=(await x.responderMesa(sql,{id:7},salas,{id:h.id,acao:'aceitar'})).jogo;
 const esperando=jh.vez==='desafiante'?{id:7}:{id:1};
 await assert.rejects(x.acaoMesa(sql,esperando,{id:h.id,acao:'reivindicar'}),/Espere/);
 await sql`UPDATE vybe_escritorio_partidas SET ultimo_lance_em=now()-interval '6 minutes' WHERE id=${h.id}`;
 const tempo=await x.acaoMesa(sql,esperando,{id:h.id,acao:'reivindicar'});
 assert.equal(tempo.jogo.motivo_nome,'Tempo esgotado');assert.equal(tempo.jogo.resultado,jh.vez==='desafiante'?'desafiado':'desafiante');
});

test('dominó até 100 pontos: quem bate ganha os pontos do outro e a mão seguinte começa',()=>{
 const base={linha:[[2,5]],abertura:null,passes:0,n:9,ultimo:null,alvo:100,mao:3,anterior:null};
 // Bateu com 40 pontos: ganha os 7 da mão do outro e vem a mão 4.
 let r=jogarDomino({...base,vez:'desafiado',placar:{desafiante:10,desafiado:40},maos:{desafiante:[[3,4]],desafiado:[[5,5]]},monte:[]},'desafiado',{tipo:'jogar',peca:[5,5]});
 assert.equal(r.fim,null);
 assert.deepEqual(r.mesa.placar,{desafiante:10,desafiado:47});
 assert.equal(r.mesa.mao,4);assert.equal(r.mesa.linha.length,0);
 assert.equal(r.mesa.maos.desafiante.length+r.mesa.maos.desafiado.length+r.mesa.monte.length,28,'mão nova com as 28 peças');
 assert.deepEqual({v:r.mesa.anterior.vencedor,g:r.mesa.anterior.ganho,m:r.mesa.anterior.motivo},{v:'desafiado',g:7,m:'batida'});
 assert.equal(vistaDomino(r.mesa,'desafiante',false).anterior.ganho,7);
 // Com 95, os 7 levam a 102: acabou a partida.
 r=jogarDomino({...base,vez:'desafiado',placar:{desafiante:10,desafiado:95},maos:{desafiante:[[3,4]],desafiado:[[5,5]]},monte:[]},'desafiado',{tipo:'jogar',peca:[5,5]});
 assert.deepEqual(r.fim,{resultado:'desafiado',motivo:'pontos'});
 // Trancado empatado não dá ponto e segue.
 const tr={...base,vez:'desafiante',placar:{desafiante:0,desafiado:0},maos:{desafiante:[[0,4]],desafiado:[[1,3]]},monte:[]};
 r=jogarDomino(jogarDomino(tr,'desafiante',{tipo:'passar'}).mesa,'desafiado',{tipo:'passar'});
 assert.equal(r.fim,null);assert.deepEqual(r.mesa.placar,{desafiante:0,desafiado:0});assert.equal(r.mesa.anterior.vencedor,'empate');
});
