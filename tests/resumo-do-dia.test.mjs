import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function mensagens(itens,dia='2026-12-31') {
  const ctx=vm.createContext({itens,dia});
  vm.runInContext(fs.readFileSync('vybe-resumo.js','utf8'),ctx);
  return vm.runInContext(`resumosPorGrupo(itens,dia,{statusDe:i=>i.status,clientesDe:i=>i.clientes||[i.cliente]})`,ctx);
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
  assert.match(texto,/próxima fila \(além das 4\) \(2\)/);
  assert.match(texto,/\*Jady \(1\)\*/);
  assert.match(texto,/\*Deivid \(1\)\*/);
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
  assert.doesNotMatch(grupo(msgs,'criacao'),/Conclusão futura|Finalizada|Captação|Alterar antiga/);
  assert.match(grupo(msgs,'producao'),/Captação/);
  assert.match(grupo(msgs,'producao'),/Horários do Google Agenda não estão conectados/);
});
test('próximos dias atravessam ano; status desconhecido não some e vazio é explícito',()=>{
  const msgs=mensagens([peca({status:'Novo status'}),peca({id:2,veiculacao_iso:'2027-01-01'})]);
  assert.match(grupo(msgs,'publicacoes'),/Sex 01\/01:\* 1 conteúdos/);
  assert.match(grupo(msgs,'criacao'),/Novo status/);
  assert.match(grupo(mensagens([]),'correcao'),/Nenhuma alteração pendente/);
});

test('trocar destino preserva a edição de cada mensagem',()=>{
  const fonte=fs.readFileSync('vybe-gestor.js','utf8');
  const area={value:'Geral revisado'};
  const seletor={value:'criacao'};
  const ctx=vm.createContext({dailySummarySelected:'geral',dailySummaryMessages:[{id:'geral',texto:'Original'},{id:'criacao',texto:'Criação original'}],document:{getElementById:id=>id==='daily-summary-group'?seletor:area}});
  vm.runInContext(fonte.slice(fonte.indexOf('function selectDailySummary()'),fonte.indexOf('async function openDailySummary')),ctx);
  ctx.selectDailySummary();
  assert.equal(area.value,'Criação original');
  area.value='Criação revisada'; seletor.value='geral'; ctx.selectDailySummary();
  assert.equal(area.value,'Geral revisado');
  assert.equal(ctx.dailySummaryMessages[1].texto,'Criação revisada');
});
