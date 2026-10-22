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
// Ranking 2 (Paulo, 21/10/2026): hoje, semana, mês e sempre, com a posição no
// período anterior (seta), o ritmo do XP e os dias seguidos entregando.
test('ranking por período: hoje, semana, mês e sempre, com seta, ritmo e sequência',async t=>{
 const {db,sql}=await banco(t);
 await sql`UPDATE vybe_escritorio_regras SET ativa=false WHERE chave IN ('dia_sem_furo','dia_agendamento','dia_sem_vencida','dia_ativo')`;
 const AGORA=new Date(), HOJE=diaBahia(AGORA);
 let id=5000;
 // Jady (6) entregou hoje e ontem; Reriston (2) só ontem, com mais peças.
 await peca(db,sql,6,id++,HOJE,30); await peca(db,sql,6,id++,somarDias(HOJE,-1));
 for(let k=0;k<3;k++) await peca(db,sql,2,id++,somarDias(HOJE,-1));
 const dia=await rankingEscritorio(sql,AGORA,{periodo:'dia'});
 assert.equal(dia.periodo,'dia');
 assert.deepEqual([dia.inicio,dia.fim],[HOJE,HOJE]);
 const jady=dia.pessoas.find(p=>p.id==='6'), rer=dia.pessoas.find(p=>p.id==='2');
 assert.equal(jady.posicao,1);                         // só ela entregou hoje
 assert.equal(rer.posicao,null);
 assert.equal(rer.antes,1);                            // ontem o Reriston liderava
 assert.ok(jady.sequencia>=2);
 assert.deepEqual(jady.ritmo,[[HOJE,30]]);
 const total=await rankingEscritorio(sql,AGORA,{periodo:'total'});
 assert.equal(total.inicio,null);
 assert.equal(total.pessoas[0].id,'2');                // Sempre: vale o XP total
 assert.ok(total.pessoas[0].nivel>=1);
 const mes=await rankingEscritorio(sql,AGORA,{periodo:'mes'});
 assert.equal(mes.inicio,HOJE.slice(0,8)+'01');
 await assert.rejects(rankingEscritorio(sql,AGORA,{periodo:'ano'}),/Período inválido/);
});

test('Copa Vybe: o 1º do mês leva a taça da Copa, o título e o prêmio; 2º e 3º as taças; uma vez só',async t=>{
 const {db,sql}=await banco(t);
 // Como em produção (economia de 20/10/2026): a faixa Épica existe.
 await db.exec(`ALTER TABLE vybe_escritorio_raridades DROP CONSTRAINT IF EXISTS vybe_escritorio_raridades_chave_check; INSERT INTO vybe_escritorio_raridades(chave,nome,ordem,preco) VALUES('epico','Épico',5,100) ON CONFLICT DO NOTHING;`);
 for(const f of ['2026-10-20-escritorio-conquistas-niveis.sql','2026-10-20-escritorio-conquistas-producao.sql','2026-10-21-escritorio-conquistas-dificeis.sql','2026-10-21-escritorio-copa.sql']) await db.exec(ler(f));
 await sql`UPDATE vybe_escritorio_regras SET ativa=false WHERE chave IN ('dia_sem_furo','dia_agendamento','dia_sem_vencida','dia_ativo')`;
 const {fecharCopaMes,mesAnterior}=await import('../server/escritorio-pontos.js');
 const {titulosDaPessoa}=await import('../server/escritorio-marcos.js');
 const MES=mesAnterior(diaBahia(new Date()));
 // Mês passado: Reriston (2) 4 peças, Jady (6) 2, Bia (7) 1.
 let id=5000;
 for(const [p,n] of [[2,4],[6,2],[7,1]]) for(let k=0;k<n;k++) await peca(db,sql,p,id++,somarDias(MES,3+k));
 const r=await sql.comTransacao(tx=>fecharCopaMes(tx,MES));
 assert.deepEqual(r.pagos.map(p=>[p.id,p.posicao]),[['2',1],['6',2],['7',3]]);
 const inv=async(p,c)=>Number((await sql`SELECT quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${p} AND classe=${c}`)[0]?.quantidade||0);
 assert.equal(await inv(2,'fball_trophy'),1,'a taça da Copa');
 assert.equal(await inv(6,'prizetrophy2'),1);
 assert.equal(await inv(7,'prizetrophy3'),1);
 const [g]=await sql`SELECT quantidade,pontos FROM vybe_escritorio_moedas WHERE origem=${'copa:'+MES+':1'}`;
 assert.deepEqual([g.quantidade,g.pontos],[150,300]);
 const tit=await titulosDaPessoa(sql,2);
 assert.ok(tit.some(x=>x.texto.startsWith('Campeão da Copa · ') && x.nivel===4));
 assert.equal(await sql.comTransacao(tx=>fecharCopaMes(tx,MES)),null,'não paga de novo');
 assert.equal((await sql`SELECT raridade FROM vybe_escritorio_catalogo WHERE classe='fball_trophy'`)[0].raridade,'epico');
});

test('Geral pelo XP do trabalho: quem produz mais vence; a Gestão aparece fora da disputa',async t=>{
 const {db,sql}=await banco(t);
 await sql`UPDATE vybe_escritorio_regras SET ativa=false WHERE chave IN ('dia_sem_furo','dia_agendamento','dia_sem_vencida','dia_ativo')`;
 const AGORA=new Date(), SEG=inicioDaSemana(diaBahia(AGORA));
 // Reriston (2) 3 peças pequenas; Jady (6) 1 peça que vale 100 XP; Paulo (1, Gestão) 1 peça grande.
 let id=7000;
 for(let k=0;k<3;k++) await peca(db,sql,2,id++,SEG,20);
 await peca(db,sql,6,id++,SEG,100);
 await sql`INSERT INTO vybe_escritorio_funcoes(pessoa_id,funcao) VALUES(1,'gestao') ON CONFLICT (pessoa_id) DO UPDATE SET funcao='gestao'`;
 await peca(db,sql,1,id++,SEG,500);
 const r=await rankingDaSemana(sql,AGORA,SEG);
 const com=r.pessoas.filter(p=>p.entregas>0);
 assert.equal(com[0].id,'1','a Gestão aparece no topo do XP');
 assert.equal(com[0].posicao,null,'mas fica fora da disputa');
 assert.ok(com[0].foraDaDisputa);
 assert.deepEqual(r.pessoas.filter(p=>p.posicao).map(p=>[p.id,p.posicao]),[['6',1],['2',2]],'Jady (100 XP) passa Reriston (60 XP)');
});

test('Copa refeita pela regra nova: tira tudo do pódio antigo e paga o novo, sem saldo negativo',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(`ALTER TABLE vybe_escritorio_raridades DROP CONSTRAINT IF EXISTS vybe_escritorio_raridades_chave_check; INSERT INTO vybe_escritorio_raridades(chave,nome,ordem,preco) VALUES('epico','Épico',5,100) ON CONFLICT DO NOTHING;`);
 for(const f of ['2026-10-20-escritorio-conquistas-niveis.sql','2026-10-20-escritorio-conquistas-producao.sql','2026-10-21-escritorio-conquistas-dificeis.sql','2026-10-21-escritorio-copa.sql']) await db.exec(ler(f));
 await sql`UPDATE vybe_escritorio_regras SET ativa=false WHERE chave IN ('dia_sem_furo','dia_agendamento','dia_sem_vencida','dia_ativo')`;
 const {fecharCopaMes,refazerCopaMes,mesAnterior}=await import('../server/escritorio-pontos.js');
 const MES=mesAnterior(diaBahia(new Date()));
 let id=9000;
 for(const [p,n] of [[2,3],[6,1],[7,1]]) for(let k=0;k<n;k++) await peca(db,sql,p,id++,somarDias(MES,3+k),20);
 await sql.comTransacao(tx=>fecharCopaMes(tx,MES));
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_inventario WHERE pessoa_id=2 AND classe='fball_trophy'`)[0].n,1);
 // A Jady faz uma peça grande no mês: pela regra de agora ela passa a ganhar.
 await peca(db,sql,6,id++,somarDias(MES,10),500);
 const r=await sql.comTransacao(tx=>refazerCopaMes(tx,MES));
 assert.equal(r.desfeitos.length,3);
 assert.equal(r.novo.pagos[0].id,'6');
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_inventario WHERE pessoa_id=2 AND classe='fball_trophy'`)[0].n,0,'a taça sai de quem perdeu');
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_inventario WHERE pessoa_id=6 AND classe='fball_trophy'`)[0].n,1);
 const t1=await sql`SELECT pessoa_id FROM vybe_escritorio_marcos WHERE marco LIKE 'copa_%'`;
 assert.deepEqual(t1.map(x=>String(x.pessoa_id)),['6'],'o título fica com o novo campeão');
 const [c]=await sql`SELECT sum(saldo)::int s FROM vybe_escritorio_carteiras`; const [m]=await sql`SELECT sum(quantidade)::int s FROM vybe_escritorio_moedas`;
 assert.equal(c.s,m.s,'saldo bate com o razão');
});
