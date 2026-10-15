import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function mensagens(itens,dia='2026-12-31',extra={}) {
  const ctx=vm.createContext({itens,dia,extra});
  vm.runInContext(fs.readFileSync('vybe-resumo.js','utf8'),ctx);
  return vm.runInContext(`resumosPorGrupo(itens,dia,{...extra,statusDe:i=>i.status,clientesDe:i=>i.clientes||[i.cliente],equipe:[{id:'68036697',nome:'Reriston',limite:4},{id:'b',nome:'Bia',nomeCompleto:'Beatriz',limite:5},{id:'d',nome:'Deivid',limite:5,aprovacoesExtras:true},{id:'j',nome:'Jady',limite:5},{id:'p',nome:'Paulo',grupo:'atendimento'},{id:'v',nome:'Vinícius',grupo:'atendimento'},{id:'e',nome:'Ewerton',grupo:'atendimento'}]})`,ctx);
}
const peca=o=>({id:1,nome:'Card - Teste',cliente:'Cliente A',status:'Pode Fazer',veiculacao_iso:'2026-12-31',responsavel:'Jady Amynne Oliveira Lima',...o});
const grupo=(msgs,id)=>msgs.find(m=>m.id===id)?.texto || '';
test('publicações separa pronto de publicado, conta atividades sem inflar múltiplos clientes e não confunde IDs dos quadros',()=>{
  const msgs=mensagens([
    peca({clientes:['A','B'],status:'Finalizado'}),peca({clientes:['A','B'],status:'Finalizado'}),
    peca({id:2,status:'Agendado'}),peca({id:3,status:'Publicado'}),
    peca({id:1,origem:'solicitacao',status:'Finalizado',nome:'Demanda concluída',conclusao_iso:'2026-12-31'}),
  ]);
  assert.match(grupo(msgs,'geral'),/3 conteúdos no total/);
  assert.match(grupo(msgs,'geral'),/Publicado: 33% \(1\)/);
  assert.match(grupo(msgs,'publicacoes'),/Finalizados \(1\)/);
  assert.match(grupo(msgs,'publicacoes'),/\(A \/ B\)/);
  assert.doesNotMatch(grupo(msgs,'criacao'),/Demanda concluída/);
});
test('criação destaca quatro de Reriston, mantém restante na fila e compartilhadas em cada pessoa',()=>{
  const itens=Array.from({length:6},(_,n)=>peca({id:n+1,nome:`Reels - Peça ${n+1}`,responsavel:'Reriston Souza Silva',responsavel_ids:['68036697']}));
  itens.push(peca({id:7,nome:'Compartilhada',responsavel:'Jady Lima, Deivid Souza',responsavel_ids:['j','d']}));
  const texto=grupo(mensagens(itens),'criacao');
  assert.match(texto,/Reriston · foco em até 4 demandas \(4\)/);
  assert.match(texto,/Reriston · próxima fila \(2\)/);
  assert.match(texto,/\*Jady · foco em até 5 demandas \(1\)\*/);
  assert.match(texto,/\*Deivid · foco em até 5 demandas \(1\)\*/);
});
test('pendências antigas e sem data, conclusão da demanda, alterações e captação vão ao destino correto',()=>{
  const msgs=mensagens([
    peca({id:1,nome:'Alterar antiga',status:'Alteração',prazo_iso:'2026-01-01',veiculacao_iso:'2026-02-01'}),
    peca({id:2,nome:'Sem data',origem:'solicitacao',veiculacao_iso:''}),
    peca({id:3,nome:'Conclusão futura',origem:'solicitacao',conclusao_iso:'2027-03-01',veiculacao_iso:'2026-12-31'}),
    peca({id:4,nome:'Captação',grupo:'Produção (Foto e Vídeo)',status:'Cap. Agendada'}),
    peca({id:5,nome:'Finalizada',origem:'solicitacao',status:'Finalizado'}),
  ]);
  assert.match(grupo(msgs,'correcao'),/Alterar antiga.*prazo venceu/);
  assert.match(grupo(msgs,'conferencia'),/Prazo de entrega não confirmado: Sem data/);
  assert.doesNotMatch(grupo(msgs,'criacao'),/Finalizada/);
  assert.equal(grupo(msgs,'producao'),'');
  assert.equal(msgs.find(m=>m.id==='producao').pronta,false);
});
test('próximos dias atravessam ano; status desconhecido não some e vazio é explícito',()=>{
  const msgs=mensagens([peca({status:'Novo status'}),peca({id:2,veiculacao_iso:'2027-01-01'})]);
  assert.match(grupo(msgs,'publicacoes'),/Prévia Sex 01\/01/);
  assert.match(grupo(msgs,'criacao'),/Novo status/);
  assert.equal(grupo(mensagens([]),'correcao'),'');
});

test('trocar destino preserva a edição de cada mensagem',async()=>{
  const fonte=fs.readFileSync('vybe-gestor.js','utf8');
  const area={value:'Geral revisado'};
  const seletor={value:'criacao'};
  const ctx=vm.createContext({dailySummarySelected:'geral',dailySummaryMessages:[{id:'geral',texto:'Original'},{id:'criacao',texto:'Criação original'}],document:{getElementById:id=>id==='daily-summary-group'?seletor:area}});
  vm.runInContext(fonte.slice(fonte.indexOf('async function selectDailySummary()'),fonte.indexOf('async function openDailySummary')),ctx);
  await ctx.selectDailySummary();
  assert.equal(area.value,'Criação original');
  area.value='Criação revisada'; seletor.value='geral'; await ctx.selectDailySummary();
  assert.equal(area.value,'Geral revisado');
  assert.equal(ctx.dailySummaryMessages[1].texto,'Criação revisada');
});

test('design limita cinco, aprovações de Deivid são extras e atendimento tem destino próprio',()=>{
  const itens=[];
  for(const [id,nome] of [['b','Beatriz Souza'],['d','Deivid Souza'],['j','Jady Lima']]) {
    for(let n=1;n<=7;n++) itens.push(peca({id:`${id}${n}`,nome:`Arte ${id}${n}`,responsavel:nome,responsavel_ids:[id]}));
  }
  itens.push(peca({id:'aprova1',nome:'Aprovar carrossel',responsavel:'Deivid Souza',responsavel_ids:['d'],status:'Para aprovação'}));
  itens.push(peca({id:'paulo',nome:'Planejamento da conta',responsavel:'Paulo Martins',responsavel_ids:['p'],veiculacao_iso:'2027-01-01'}));
  itens.push(peca({id:'vinicius',nome:'Retorno do briefing',responsavel:'Vinícius Damascena',responsavel_ids:['v'],veiculacao_iso:'2027-01-01'}));
  const msgs=mensagens(itens);
  const criacao=grupo(msgs,'criacao');
  for(const nome of ['Bia','Deivid','Jady']) {
    assert.match(criacao,new RegExp(`${nome} · foco em até 5 demandas \\(5\\)`));
    assert.match(criacao,new RegExp(`${nome} · próxima fila \\(2\\)`));
  }
  assert.match(criacao,/Deivid · aprovações extras \(além das 5\) \(1\)/);
  assert.doesNotMatch(criacao,/Planejamento da conta|Retorno do briefing/);
  assert.match(grupo(msgs,'atendimento'),/Planejamento da conta/);
  assert.match(grupo(msgs,'atendimento'),/Retorno do briefing/);
  assert.ok(msgs.every(m=>!m.nome.includes('VYBE')));
});

test('caso de 21 conteúdos distingue três Finalizados de nove Para agendar e fecha ontem por Finalizado',()=>{
  const itens=[];
  for(const [status,quantidade] of [['Finalizado',3],['Para agendar',9],['Pode Fazer',5],['Segurar Post',2],['Em andamento',1],['Alteração',1]]) {
    for(let n=0;n<quantidade;n++) itens.push(peca({id:`${status}-${n}`,status}));
  }
  for(let n=0;n<18;n++) itens.push(peca({id:`ontem-${n}`,status:'Finalizado',veiculacao_iso:'2026-12-30'}));
  const msgs=mensagens(itens);
  const geral=grupo(msgs,'geral'),publicacoes=grupo(msgs,'publicacoes');
  assert.match(geral,/100% finalizados: 18 de 18/);
  assert.match(geral,/Finalizados: 14% \(3\)/);
  assert.match(geral,/Para agendar: 43% \(9\)/);
  assert.match(geral,/Em produção: 29% \(6\)/);
  assert.match(geral,/Post segurado: 9% \(2\)/);
  assert.doesNotMatch(grupo(msgs,'criacao'),/Segurar Post/);
  assert.match(publicacoes,/Finalizados \(3\)/);
  assert.match(publicacoes,/Para agendar \(9\)/);
  assert.doesNotMatch(geral,/Publicados|prontos para agendar|outros status/i);
  assert.doesNotMatch(grupo(msgs,'criacao'),/ontem-/);
});

test('normaliza grafia sem juntar estados e mantém a separação na antecipação dos próximos dias',()=>{
  const msgs=mensagens([
    peca({id:1,status:' FINALIZADO ',veiculacao_iso:'2027-01-01'}),
    peca({id:2,status:' PARA  AGENDAR ',veiculacao_iso:'2027-01-01'}),
    peca({id:3,status:'Agendado',veiculacao_iso:'2027-01-01'}),
  ]);
  assert.match(grupo(msgs,'publicacoes'),/3 conteúdos · 1 finalizados · 1 para agendar · 1 agendados · 0 pendentes/);
});

test('base original distingue remanejados de ausentes e preserva denominador do fechamento',()=>{
  const msgs=mensagens([peca({id:1,status:'Finalizado',veiculacao_iso:'2026-12-30'}),peca({id:2,veiculacao_iso:'2027-01-02'})],'2026-12-31',{
    baseAnterior:{data:'2026-12-30',itens:[{id:1},{id:2},{id:3}]},
  });
  assert.match(grupo(msgs,'geral'),/33% finalizados: 1 de 3/);
  assert.match(grupo(msgs,'geral'),/1 remanejados · 1 não localizados/);
  assert.match(grupo(msgs,'conferencia'),/100% \(1 atividades\)/);
  assert.match(grupo(msgs,'conferencia'),/não presumir remanejamento: \[3\]/);
});

test('sexta antecipa fim de semana e percentuais inteiros fecham em cem',()=>{
  const msgs=mensagens([peca({id:1,status:'Finalizado',veiculacao_iso:'2026-10-16'}),peca({id:2,status:'Para agendar',veiculacao_iso:'2026-10-16'}),peca({id:3,veiculacao_iso:'2026-10-16'}),peca({id:4,veiculacao_iso:'2026-10-18'})],'2026-10-16');
  const valores=[...grupo(msgs,'geral').matchAll(/: (\d+)% \(/g)].map(m=>Number(m[1]));
  assert.equal(valores.reduce((a,b)=>a+b,0),100);
  assert.match(grupo(msgs,'publicacoes'),/Prévia Sáb 17\/10/);
  assert.match(grupo(msgs,'publicacoes'),/Prévia Dom 18\/10/);
});

test('pausas, espera do cliente e informação do Paulo não inflam atrasos',()=>{
  const msgs=mensagens([
    peca({id:1,status:'Segurar Post',prazo_iso:'2026-01-01'}),
    peca({id:2,status:'Ag. Info Cliente',prazo_iso:'2026-01-01'}),
    peca({id:3,status:'Falta Info',responsavel:'Paulo Martins',responsavel_ids:['p'],prazo_iso:'2026-01-01'}),
    peca({id:4,prazo_iso:'2026-01-01',responsavel:'',responsavel_ids:[]}),
  ]);
  assert.match(grupo(msgs,'geral'),/0 atividades com prazo vencido/);
  assert.match(grupo(msgs,'conferencia'),/Pendência de informação do Paulo/);
  assert.match(grupo(msgs,'conferencia'),/Veicula hoje sem responsável/);
});
