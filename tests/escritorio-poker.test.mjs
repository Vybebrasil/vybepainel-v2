// Pôquer nas mesas do Escritório: blinds, vez antes e depois do flop, mesa,
// pagar, aumentar (mínimo e all-in), largar, showdown com a mão certa,
// devolução do que ninguém pagou e fim quando alguém fica sem fichas.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio} from './escritorio-esquema.mjs';
import {iniciarPoker,jogarPoker,vistaPoker} from '../server/escritorio-poker.js';

// Baralho arrumado: as cartas saem na ordem de `seq` (o servidor tira do fim).
function arrumado(seq){
 const todas=[];for(const r of '23456789TJQKA')for(const n of 'shdc')todas.push(r+n);
 return [...todas.filter(c=>!seq.includes(c)),...[...seq].reverse()];
}
const j=(m,l,tipo,valor)=>jogarPoker(m,l,{tipo,valor});

test('pôquer: blinds, vez e mão até o showdown',()=>{
 // Botão (desafiante) recebe A♠A♥; o outro, 7♣2♦; mesa sem nada para o 7-2.
 let m=iniciarPoker('desafiante',arrumado(['As','Ah','7c','2d','Kd','9s','4h','Jc','3s']));
 assert.equal(m.blind,20);assert.deepEqual(m.fichas,{desafiante:990,desafiado:980});assert.equal(m.vez,'desafiante');
 let v=vistaPoker(m,'desafiante',false);
 assert.deepEqual(v.minhas,['As','Ah']);assert.equal(v.pote,30);
 assert.deepEqual(v.acoes,{pagar:10,mesa:false,aumentar:{min:40,max:1000}});
 assert.equal(vistaPoker(m,'desafiado',false).acoes,null,'só quem tem a vez joga');
 assert.equal(vistaPoker(m,null,false).minhas,null,'quem assiste não vê carta');
 assert.throws(()=>j(m,'desafiado','mesa'),/vez da outra/);
 assert.throws(()=>j(m,'desafiante','mesa'),/pague 10/);
 assert.throws(()=>j(m,'desafiante','aumentar',30),/de 40 a 1000/);
 // Small blind completa; big blind ainda pode falar e passa: sai o flop.
 m=j(m,'desafiante','pagar').mesa;
 assert.equal(m.vez,'desafiado');assert.equal(m.fase,'preflop');
 m=j(m,'desafiado','mesa').mesa;
 assert.equal(m.fase,'flop');assert.deepEqual(m.comunitarias,['Kd','9s','4h']);assert.equal(m.vez,'desafiado','depois do flop fala o big blind');
 // Aposta e pagamento no flop, mesa até o river.
 m=j(m,'desafiado','aumentar',20).mesa;assert.equal(m.ultimo.acao,'apostou');
 m=j(m,'desafiante','pagar').mesa;assert.equal(m.fase,'turn');
 m=j(m,'desafiado','mesa').mesa;m=j(m,'desafiante','mesa').mesa;assert.equal(m.fase,'river');
 m=j(m,'desafiado','mesa').mesa;
 const r=j(m,'desafiante','mesa');
 assert.equal(r.fim,null);
 const a=r.mesa.anterior;
 assert.equal(a.vencedor,'desafiante');assert.equal(a.pote,80);assert.equal(a.maos.desafiante.nome,'Par');assert.deepEqual(a.maos.desafiado.cartas,['7c','2d']);
 // Mão 2: o botão troca e os blinds saem de novo.
 assert.equal(r.mesa.mao,2);assert.equal(r.mesa.botao,'desafiado');
 assert.deepEqual(r.mesa.fichas,{desafiante:1040-20,desafiado:960-10});
});

test('pôquer: largar, aumento mínimo, all-in pago a menos e fim por fichas',()=>{
 // Largar: quem larga perde o que pôs (o big blind leva o small blind).
 let m=iniciarPoker('desafiante');
 let r=j(m,'desafiante','largar');
 assert.equal(r.mesa.anterior.vencedor,'desafiado');assert.equal(r.mesa.anterior.maos,null,'quem larga não mostra');
 assert.equal(r.mesa.fichas.desafiante+r.mesa.posto.desafiante,990);
 // Aumento: o próximo aumento tem que ser pelo menos do tamanho do último.
 m=iniciarPoker('desafiante');
 m=j(m,'desafiante','aumentar',100).mesa;
 assert.deepEqual(vistaPoker(m,'desafiado',false).acoes.aumentar,{min:180,max:1000});
 // All-in pago a menos: o que ninguém pagou volta para o dono.
 m=iniciarPoker('desafiante',arrumado(['As','Ah','7c','2d','Kd','9s','4h','Jc','3s']));
 m.fichas.desafiado=80; // big blind fica com 100 no total
 m=j(m,'desafiante','aumentar',500).mesa;
 r=j(m,'desafiado','pagar');
 assert.deepEqual(r.fim,{resultado:'desafiante',motivo:'fichas'},'o 7-2 perde tudo e a partida acaba');
 assert.equal(r.mesa.anterior.pote,600);assert.equal(r.mesa.fichas.desafiante,1100);assert.equal(r.mesa.fichas.desafiado,0);
 // Empate no showdown divide o pote.
 m=iniciarPoker('desafiante',arrumado(['2s','3h','2c','3d','As','Ks','Qh','Jd','Tc']));
 m=j(m,'desafiante','pagar').mesa;m=j(m,'desafiado','mesa').mesa;
 for(let i=0;i<3;i++){m=j(m,'desafiado','mesa').mesa;m=j(m,'desafiante','mesa').mesa;}
 assert.equal(m.anterior.vencedor,'empate');assert.equal(m.anterior.maos.desafiante.nome,'Sequência');
 assert.equal(m.fichas.desafiante+m.fichas.desafiado+m.posto.desafiante+m.posto.desafiado,2000,'nenhuma ficha some');
});

test('mesa de pôquer: começa pela mesa genérica e só cada um vê as próprias cartas',async t=>{
 const {db,sql}=await bancoEscritorio(t);
 await db.exec(readFileSync('migrations/2026-10-18-escritorio-postits-presentes.sql','utf8'));
 await db.exec(readFileSync('migrations/2026-10-27-escritorio-mesas.sql','utf8'));
 const x=await import('../server/escritorio-mesas.js');
 const {salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:3,nome:'Vinícius'},{id:7,nome:'Bia'}]);
 const MESA={jogo:'poker',camada:'jogos',movel:'wildwest_table@2,2'};
 const d=await x.desafiarMesa(sql,{id:1},salas,{para:'3',...MESA,chave:'poker-0001'});
 const r=await x.responderMesa(sql,{id:3},salas,{id:d.id,acao:'aceitar'});
 assert.equal(r.jogo.jogo,'poker');assert.equal(r.jogo.mesa.minhas.length,2);
 const vendo=(await x.listarMesa(sql,{id:7},MESA)).mesa;
 assert.equal(vendo.mesa.minhas,null);assert.equal(vendo.mesa.pote,30);
 const quem=r.jogo.vez==='desafiante'?{id:1}:{id:3};
 const l=await x.lanceMesa(sql,quem,{id:d.id,n:0,tipo:'largar'});
 assert.equal(l.jogo.mesa.mao,2);assert.equal(l.jogo.estado,'jogando');
 const banco=(await sql`SELECT mesa FROM vybe_escritorio_partidas WHERE id=${d.id}`)[0].mesa;
 assert.equal(banco.baralho.length,48,'o baralho fica no banco, não na tela');
 assert.equal(JSON.stringify(l.jogo).includes('baralho'),false);
});
