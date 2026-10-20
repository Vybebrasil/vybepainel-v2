// Ranking da semana (Paulo, 20/10/2026): geral por % da própria meta, XP e
// atividades da semana; no fechamento, pódio premiado e bônus da agência, uma vez.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio} from './escritorio-esquema.mjs';
import {rankingDaSemana, rankingEscritorio, fecharPontosEscritorio, inicioDaSemana, diaBahia, somarDias} from '../server/escritorio-pontos.js';

const ler=f=>readFileSync('migrations/'+f,'utf8');
async function banco(t){
 const {db,sql}=await bancoEscritorio(t);
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text, ADD COLUMN titulo text, ADD COLUMN clientes_texto text, ADD COLUMN monday_item_id text, ADD COLUMN etapa text;`);
 for(const f of ['2026-10-19-escritorio-gestao-pontos.sql','2026-10-20-escritorio-complexidade.sql','2026-10-20-escritorio-bolo-por-peca.sql','2026-10-20-escritorio-ranking.sql']) await db.exec(ler(f));
 return {db,sql};
}
// Uma peça feita por `p` no dia `dia` (entrega da Criação + XP no razão).
async function peca(db,sql,p,id,dia,xp=20){
 await db.exec(`INSERT INTO vybe_conteudos(id,board_id) VALUES(${id},7829537690) ON CONFLICT DO NOTHING`);
 await sql`SELECT set_config('vybe.em',${dia+'T12:00:00-03:00'},false)`;
 await sql`SELECT vybe_lancar_pontos(${p},${'peca:'+id+':criacao'},'peca_criacao',${id},7,${xp})`;
 await sql`SELECT set_config('vybe.em','',false)`;
 await sql`INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia) VALUES(${p},${'peca:'+id+':criacao'},'peca_criacao',${id},${dia}::date)`;
}
test('geral pelo % da meta (desempate pelo XP), atividades da semana e meta da agência; pódio pago uma vez no fechamento',async t=>{
 const {db,sql}=await banco(t);
 const AGORA=new Date(), SEG=inicioDaSemana(diaBahia(AGORA)), PASSADA=somarDias(SEG,-7);
 // O dia sem furo conta entrega da Gestão: fora do teste, para o pódio ser só de peças.
 await sql`UPDATE vybe_escritorio_regras SET ativa=false WHERE chave IN ('dia_sem_furo','dia_agendamento','dia_sem_vencida','dia_ativo')`;
 // Semana passada: Reriston (2) 3 peças, Jady (6) 2, Bia (7) 1.
 let id=1000;
 for(const [p,n] of [[2,3],[6,2],[7,1]]) for(let k=0;k<n;k++) await peca(db,sql,p,id++,somarDias(PASSADA,1+k));
 const r=await rankingDaSemana(sql,AGORA,PASSADA);
 assert.deepEqual(r.pessoas.filter(p=>p.posicao).map(p=>[p.nome.split(' ')[0],p.posicao,p.atividades.peca_criacao]),[['Reriston',1,3],['Jady',2,2],['Beatriz',3,1]]);
 assert.equal(r.pessoas.find(p=>p.id==='2').xp,60);
 // Detalhe de cada um: o que contou como entrega, quais peças e de onde veio o XP.
 const rer=r.pessoas.find(p=>p.id==='2');
 assert.deepEqual(rer.porRegra,{peca_criacao:3});assert.equal(rer.pecas.length,3);assert.deepEqual(rer.xpPor,{peca_criacao:60});
 assert.ok(r.regras.peca_criacao);
 assert.equal(r.agencia.pecas,6);
 assert.ok(r.agencia.bateu,'sem histórico a meta da agência é 1');
 // Fechamento: pódio com moedas, XP e troféu; todos com o bônus da agência; repetir não paga de novo.
 await fecharPontosEscritorio(sql,AGORA);
 await fecharPontosEscritorio(sql,AGORA);
 const ganho=async(p,origem)=>(await sql`SELECT quantidade,pontos FROM vybe_escritorio_moedas WHERE pessoa_id=${p} AND origem=${origem}`).map(m=>[Number(m.quantidade),Number(m.pontos)]);
 assert.deepEqual(await ganho(2,`ranking:${PASSADA}:1`),[[50,100]]);
 assert.deepEqual(await ganho(6,`ranking:${PASSADA}:2`),[[30,60]]);
 assert.deepEqual(await ganho(7,`ranking:${PASSADA}:3`),[[20,40]]);
 const inv=async(p,c)=>Number((await sql`SELECT quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${p} AND classe=${c}`)[0]?.quantidade||0);
 assert.equal(await inv(2,'trophy_fball_c26_wingedgold'),1);
 assert.equal(await inv(7,'trophy_fball_c26_wingedbronze'),1);
 assert.deepEqual(await ganho(4,`agencia-semana:${PASSADA}`),[[20,40]]);  // Deivid não entregou, mas a agência bateu
 // A tela: semana atual e o pódio da anterior.
 const tela=await rankingEscritorio(sql,AGORA);
 assert.equal(tela.inicio,SEG);
 assert.deepEqual(tela.anterior.podio.map(p=>[p.id,p.posicao]),[['2',1],['6',2],['7',3]]);
 assert.ok(tela.anterior.agenciaBateu);
 // Mais rico e Colecionador: saldo e móveis de todos os tempos.
 const pat=tela.patrimonio.find(p=>p.id==='2');
 assert.equal(pat.trofeus,1);assert.ok(pat.saldo>=50);assert.equal(pat.moveis,1);
 // Prêmio e bônus não entram no XP do ranking.
 assert.equal((await rankingDaSemana(sql,AGORA,PASSADA)).pessoas.find(p=>p.id==='2').xp,60);
});
