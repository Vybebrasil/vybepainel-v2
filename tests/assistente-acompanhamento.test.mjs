import test from 'node:test';
import assert from 'node:assert/strict';
import { mensagemAguardandoCliente, mensagemPlantao, mensagemFimDeSemana, mensagemRanking } from '../server/assistente-acompanhamento.js';

const st = (i) => i.status;
const item = (id, nome, status, extra = {}) => ({ id, nome, status, cliente: 'Gonzalez', origem: 'producao_conteudo', responsavel: 'Jady Lima', veiculacao_iso: '2026-10-29', status_updated_at: '2026-10-24T10:00:00Z', ...extra });

test('esperando o cliente: parada 2+ dias em Ag. Aprovação Cliente, por cliente, com a mensagem pronta', () => {
  const t = mensagemAguardandoCliente([item('1', 'Card - Agenda Musical', 'Ag. Aprovação Cliente'), item('2', 'Reels', 'Ag. Aprovação Cliente', { status_updated_at: '2026-10-27T08:00:00Z' }),
    item('3', 'Card - Rodízio', 'Pode Fazer')], '2026-10-27', st);
  assert.match(t, /\*Gonzalez\* · 1 peça\(s\)\n- Card - Agenda Musical · há 3 dias · veicula 29\/10\n  🔗 https:\/\/vybepainel-v2\.vercel\.app\/\?atividade=1/);
  assert.match(t, /Oi, pessoal da Gonzalez! 😊 Ficou aguardando a aprovação de vocês: Card - Agenda Musical \(vai ao ar 29\/10\)\./);
  assert.doesNotMatch(t, /Reels|Rodízio/);
  assert.equal(mensagemAguardandoCliente([item('3', 'x', 'Pode Fazer')], '2026-10-27', st), null);
});

test('plantão de sábado: só o que publica hoje e não está agendado; fim de semana na segunda', () => {
  const itens = [item('1', 'Reels - Sábado', 'Para agendar', { veiculacao_iso: '2026-10-31' }), item('2', 'Card - Sábado', 'Agendado', { veiculacao_iso: '2026-10-31' }),
    item('3', 'Card - Domingo', 'Pode Fazer', { veiculacao_iso: '2026-11-01' })];
  const p = mensagemPlantao(itens, '2026-10-31', st);
  assert.match(p, /^🛟 \*Plantão de sábado \(31\/10\)\*\nPublica hoje e ainda não está agendado:\n\n- Reels - Sábado \(Gonzalez\) · \*Para agendar\* · 👤 Jady/);
  assert.doesNotMatch(p, /Card - Sábado|Domingo/);
  assert.match(mensagemPlantao(itens, '2026-11-01', st), /Plantão de domingo/);
  const f = mensagemFimDeSemana(itens, '2026-11-02', st);
  assert.match(f, /✅ 1 de 3 publicaram ou estão agendadas\.\n\n⚠️ \*Não saíram:\*\n- 31\/10 · Reels - Sábado[\s\S]*- 01\/11 · Card - Domingo/);
});

test('ranking da semana: entregas por pessoa (uma vez por peça), no prazo e alterações', () => {
  const ev = (conteudo_id, para, em, responsaveis, extra = {}) => ({ conteudo_id, para, em, prazo: '2026-10-29', final: false, responsaveis, ...extra });
  const t = mensagemRanking([
    ev('1', 'Para aprovação', '2026-10-27T10:00:00Z', ['Jady Lima']), ev('1', 'Alteração', '2026-10-27T12:00:00Z', ['Jady Lima']), ev('1', 'Para aprovação', '2026-10-28T10:00:00Z', ['Jady Lima']),
    ev('2', 'Para aprovação', '2026-10-30T10:00:00Z', ['Jady Lima']), ev('3', 'Finalizado', '2026-10-28T10:00:00Z', ['Bia Costa'], { final: true }),
    ev('4', 'Para aprovação', '2026-10-28T10:00:00Z', ['Bia Costa']), ev('5', 'Para aprovação', '2026-10-28T10:00:00Z', ['Bia Costa']),
  ], '2026-10-30');
  assert.match(t, /Semana do time \(26\/10 a 30\/10\)/);
  assert.match(t, /🥇 Bia: 3 entregas · 100% no prazo\n🥈 Jady: 2 entregas · 50% no prazo · 1 alteração\(ões\)/);
  assert.match(t, /Mais entregas: \*Bia\*\n⏱️ 100% no prazo: \*Bia\*\n🎯 Sem nenhuma alteração: \*Bia\*/);
});

test('"o que eu faço agora": atrasada primeiro, depois alteração e o que veicula antes; fora o que está com outra pessoa', async () => {
  const { mensagemFoco } = await import('../server/assistente-acompanhamento.js');
  const it = (id, nome, status, extra = {}) => ({ id, nome, status, cliente: 'Gonzalez', origem: 'producao_conteudo', responsavel_ids: ['7'], prazo_iso: '2026-10-29', veiculacao_iso: '2026-10-31', ...extra });
  const t = mensagemFoco([it('1', 'Card longe', 'Pode Fazer'), it('2', 'Card atrasado', 'Em andamento', { prazo_iso: '2026-10-25' }), it('3', 'Reels ajuste', 'Alteração'),
    it('4', 'Card hoje', 'Pode Fazer', { veiculacao_iso: '2026-10-27', prazo_iso: '2026-10-27' }), it('5', 'Em aprovação', 'Para aprovação'), it('6', 'De outra pessoa', 'Pode Fazer', { responsavel_ids: ['9'] })],
    '2026-10-27', (i) => i.status, '7', 'Jady Lima');
  assert.match(t, /^🎯 \*Jady, sua ordem agora\*\n\n1\. Card atrasado \(Gonzalez\) · \*Em andamento\* · ⏰ atrasada há 2 dia\(s\)/);
  assert.match(t, /2\. Reels ajuste[\s\S]*3\. Card hoje[\s\S]*📣 veicula hoje[\s\S]*4\. Card longe/);
  assert.doesNotMatch(t, /Em aprovação|De outra pessoa/);
  assert.match(mensagemFoco([], '2026-10-27', (i) => i.status, '7', 'Jady Lima'), /nada esperando por você/);
});
