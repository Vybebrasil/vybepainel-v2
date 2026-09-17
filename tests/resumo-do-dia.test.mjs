// O Resumo do dia para o grupo de Criação: dividido por etapa, na ordem de quem
// precisa agir, com as atrasadas de dias anteriores no fim.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function resumo(itens, dia = '2026-09-17') {
  const c = vm.createContext({ console });
  vm.runInContext(fs.readFileSync('vybe-resumo.js', 'utf8'), c);
  c.args = { itens, dia };
  return vm.runInContext(`resumoDoDiaTexto(args.itens, args.dia, {
    referencia: 'Veiculação', dataDe: (i) => i.veiculacao_iso, statusDe: (i) => i.status })`, c);
}

const peca = (o) => ({ cliente: 'Copirecê', responsavel: 'Jady Amynne Oliveira Lima', veiculacao_iso: '2026-09-17', ...o });

test('as etapas saem na ordem de ação, só as que têm peça, com a contagem', () => {
  const texto = resumo([
    peca({ nome: 'Card - Pronto', formato: 'Card', status: 'Finalizado' }),
    peca({ nome: 'Card - Sabor', formato: 'Card', status: 'Alteração' }),
    peca({ nome: 'Reels - Heuler 04', formato: 'Reels', status: 'Em andamento', cliente: 'Hebravet', responsavel: 'Reriston Souza Silva' }),
    peca({ nome: 'Reels - Visita Pablo', formato: 'Reels', status: 'Pode Fazer', responsavel: 'Reriston Souza Silva' }),
    peca({ nome: 'Card - Agenda', formato: 'Card', status: 'Para agendar' }),
  ]);
  const titulos = texto.split('\n').filter((l) => /^\S+ \*[A-ZÁ-Ú]/.test(l));
  assert.deepEqual(titulos, ['⚠️ *ALTERAR (1)*', '▶️ *EXECUTAR HOJE (2)*', '📲 *PRONTO PARA POSTAR (1)*', '✅ *JÁ POSTADO / CONCLUÍDO (1)*']);
  assert.match(texto, /^\*RESUMO DE CRIAÇÃO — Qui 17\/09\*\n_5 peças com veiculação neste dia_/);
  // Executar separa o que já anda do que ainda não começou.
  assert.match(texto, /EXECUTAR HOJE \(2\)\*\nEm andamento:\n• Hebravet — Reels - Heuler 04 · Reriston\nA começar:\n• Copirecê — Reels - Visita Pablo · Reriston/);
  assert.ok(!texto.includes('AGUARDANDO APROVAÇÃO'), 'etapa vazia não aparece');
});

test('a linha tem cliente, peça, formato só quando não está no nome, primeiro nome e motivo', () => {
  const texto = resumo([
    peca({ nome: 'Sabores da história', formato: 'Card', status: 'Falta Info',
      responsavel: 'Jady Amynne Oliveira Lima, Vinícius Damascena', status_context: { reason: 'SEM CONTEÚDO' } }),
  ]);
  assert.match(texto, /⛔ \*TRAVADO — FALTA INFORMAÇÃO \(1\)\*\n• Copirecê — Sabores da história \(Card\) · Jady, Vinícius — motivo: SEM CONTEÚDO/);
});

test('atrasadas de dias anteriores: só em aberto, dos últimos 30 dias, com o dia na frente', () => {
  const texto = resumo([
    peca({ nome: 'Card - Hoje', status: 'Pode Fazer' }),
    peca({ nome: 'Card - Atrasado', status: 'Pode Fazer', veiculacao_iso: '2026-09-14', cliente: 'Alpha1', responsavel: 'Deivid' }),
    peca({ nome: 'Card - Agendado ontem', status: 'Agendado', veiculacao_iso: '2026-09-16' }),
    peca({ nome: 'Card - Postado', status: 'Finalizado', veiculacao_iso: '2026-09-15' }),
    peca({ nome: 'Card - Antigo demais', status: 'Pode Fazer', veiculacao_iso: '2026-07-01' }),
  ]);
  assert.match(texto, /🔥 \*ATRASADAS DE DIAS ANTERIORES \(1\)\*\n• Seg 14\/09 — Alpha1 — Card - Atrasado · Deivid$/);
});

test('status fora do mapa não some, e dia vazio diz que está vazio', () => {
  assert.match(resumo([peca({ nome: 'X', status: 'Status Novo' })]), /\*OUTROS STATUS \(1\)\*\n• Copirecê — X · Jady — Status Novo/);
  assert.match(resumo([]), /_0 peças com veiculação neste dia_\n\nNenhuma peça com data neste dia\./);
});
