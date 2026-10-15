import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function mensagens(itens,dia='2026-12-31') {
  const ctx=vm.createContext({itens,dia});
  vm.runInContext(fs.readFileSync('vybe-resumo.js','utf8'),ctx);
  return vm.runInContext(`resumosPorGrupo(itens,dia,{statusDe:i=>i.status,clientesDe:i=>i.clientes||[i.cliente],equipe:[{id:'68036697',nome:'Reriston',limite:4},{id:'b',nome:'Bia',nomeCompleto:'Beatriz',limite:5},{id:'d',nome:'Deivid',limite:5,aprovacoesExtras:true},{id:'j',nome:'Jady',limite:5},{id:'p',nome:'Paulo',grupo:'atendimento'},{id:'v',nome:'Vinícius',grupo:'atendimento'},{id:'e',nome:'Ewerton',grupo:'atendimento'}]})`,ctx);
}
const peca=o=>({id:1,nome:'Card - Teste',cliente:'Cliente A',status:'Pode Fazer',veiculacao_iso:'2026-12-31',responsavel:'Jady Amynne Oliveira Lima',...o});
const grupo=(msgs,id)=>msgs.find(m=>m.id===id).texto;
test('publicações separa pronto de publicado, conta atividades sem inflar múltiplos clientes e não confunde IDs dos quadros',()=>{
  const msgs=mensagens([
    peca({clientes:['A','B'],status:'Finalizado'}),peca({clientes:['A','B'],status:'Finalizado'}),
    peca({id:2,status:'Agendado'}),peca({id:3,status:'Publicado'}),
    peca({id:1,origem:'solicitacao',status:'Finalizado',nome:'Demanda concluída',conclusao_iso:'2026-12-31'}),
  ]);
  assert.match(grupo(msgs,'geral'),/3 conteúdos com veiculação/);
  assert.match(grupo(msgs,'geral'),/Publicados: 33% \(1\)/);
  assert.match(grupo(msgs,'publicacoes'),/Prontos para agendar \(1\)/);
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
  assert.match(grupo(msgs,'criacao'),/Sem data.*sem data/);
  assert.doesNotMatch(grupo(msgs,'criacao'),/Finalizada/);
  assert.equal(grupo(msgs,'producao'),'');
  assert.equal(msgs.find(m=>m.id==='producao').pronta,false);
});
test('próximos dias atravessam ano; status desconhecido não some e vazio é explícito',()=>{
  const msgs=mensagens([peca({status:'Novo status'}),peca({id:2,veiculacao_iso:'2027-01-01'})]);
  assert.match(grupo(msgs,'publicacoes'),/Sex 01\/01:\* 1 conteúdos/);
  assert.match(grupo(msgs,'criacao'),/Novo status/);
  assert.match(grupo(mensagens([]),'correcao'),/Nenhuma alteração pendente/);
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
