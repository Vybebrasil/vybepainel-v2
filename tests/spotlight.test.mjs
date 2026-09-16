// O Spotlight: a busca global aberta por ⌘K.
//
// A regra do que aparece — e em qual bloco — mora numa função sem tela. Estes
// testes rodam o arquivo de verdade numa sandbox e leem só essa regra.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function spotlight() {
  const c = vm.createContext({
    console,
    document: { addEventListener() {}, body: { classList: { contains: () => false } } },
    safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`),
  });
  vm.runInContext(fs.readFileSync('vybe-spotlight.js', 'utf8'), c);
  return c;
}

const HOJE = '2026-09-16';
const concluida = (i) => ['Finalizado', 'Feito', 'Agendado'].includes(i.status);
const ehDemanda = (i) => i.origem === 'solicitacao';
const itens = [
  { id: '1', nome: 'Reels - Bastidores da fábrica', cliente: 'Antonov', status: 'Em andamento', formato: 'Reels', veiculacao_iso: '2026-09-20', responsavel_ids: ['10'] },
  { id: '2', nome: 'Card - Promoção de setembro', clientes: ['VOA', 'Antonov'], status: 'Pode Fazer', formato: 'Card', veiculacao_iso: '2026-09-13' },
  { id: '3', nome: 'Carrossel - Linha nova', cliente: 'Antonov', status: 'Finalizado', formato: 'Carrossel', veiculacao_iso: '2026-09-10' },
  { id: '4', nome: 'Card - Dia das mães', cliente: 'Antonov', status: 'Pode Fazer', formato: 'Card', veiculacao_iso: '2026-05-10' },
  { id: '5', nome: 'Arte para fachada', cliente: 'Antonov', status: 'Nova Demanda', tipo: 'Impresso', origem: 'solicitacao', veiculacao_iso: '2026-09-18' },
  { id: '6', nome: 'Reels - Hebravet na TV', cliente: 'Hebravet', status: 'Em andamento', formato: 'Reels', veiculacao_iso: '2026-09-19', responsavel_ids: ['10'] },
];
const pessoas = [{ id: '10', name: 'Reriston', color: '#f60' }, { id: '11', name: 'Deivid', color: '#fa0' }];

const buscar = (c, consulta, extra = {}) => {
  c.args = { consulta, opcoes: { itens, pessoas, hojeIso: HOJE, concluida, ehDemanda, ...extra } };
  vm.runInContext(`r = spotlightResultados(args.consulta, args.opcoes);
    saida = JSON.stringify({ andamento: r.andamento.map((i) => i.id), encerradas: r.encerradas.map((i) => i.id),
      clientes: r.clientes, pessoas: r.pessoas.map((p) => ({ nome: p.nome, ativas: p.ativas })) });`, c);
  return JSON.parse(c.saida);
};

test('digitar antonov traz tudo que tem Antonov, com ou sem acento e maiúscula', () => {
  const c = spotlight();
  const r = buscar(c, 'ANTÔNOV');
  const todos = [...r.andamento, ...r.encerradas].sort();
  // A peça com dois clientes entra: Antonov não é o primeiro da lista dela.
  assert.deepEqual(todos, ['1', '2', '3', '4', '5']);
  assert.ok(!todos.includes('6'), 'peça de outro cliente não entra');
});

test('finalizadas e antigas ficam num bloco à parte, e atrasada recente continua em andamento', () => {
  const r = buscar(spotlight(), 'antonov');
  // 3 está finalizada; 4 é de maio, mais de trinta dias atrás e nunca foi fechada.
  assert.deepEqual([...r.encerradas].sort(), ['3', '4']);
  // 2 venceu há três dias e está aberta: é trabalho, não arquivo.
  assert.ok(r.andamento.includes('2'));
  assert.ok(r.andamento.includes('5'), 'a solicitação entra junto dos conteúdos');
});

test('várias palavras precisam aparecer todas, em qualquer campo', () => {
  const c = spotlight();
  assert.deepEqual(buscar(c, 'antonov reels').andamento, ['1']);
  // Formato e cliente em campos diferentes da mesma peça.
  assert.deepEqual(buscar(c, 'card antonov').andamento, ['2']);
  assert.deepEqual(buscar(c, 'card antonov').encerradas, ['4']);
});

test('as abas separam conteúdos de demandas', () => {
  const c = spotlight();
  assert.deepEqual(buscar(c, 'antonov', { aba: 'demandas' }).andamento, ['5']);
  assert.ok(!buscar(c, 'antonov', { aba: 'conteudos' }).andamento.includes('5'));
  const soClientes = buscar(c, 'antonov', { aba: 'clientes' });
  assert.deepEqual(soClientes.andamento, []);
  assert.equal(soClientes.clientes[0].nome, 'Antonov');
});

test('o atalho de cliente conta o que está em andamento e o total', () => {
  const r = buscar(spotlight(), 'anto');
  assert.deepEqual(r.clientes, [{ nome: 'Antonov', ativas: 3, total: 5 }]);
});

test('filtrar por cliente mostra tudo dele, mesmo o que não tem o nome no título', () => {
  const c = spotlight();
  const r = buscar(c, '', { escopo: { tipo: 'cliente', valor: 'antônov' } });
  assert.deepEqual([...r.andamento, ...r.encerradas].sort(), ['1', '2', '3', '4', '5']);
  // Dentro do filtro, a busca continua valendo.
  assert.deepEqual(buscar(c, 'fachada', { escopo: { tipo: 'cliente', valor: 'Antonov' } }).andamento, ['5']);
  // E os atalhos não se repetem dentro do filtro.
  assert.deepEqual(buscar(c, 'antonov', { escopo: { tipo: 'cliente', valor: 'Antonov' } }).clientes, []);
});

test('pessoa vira atalho e filtro pelas atividades dela', () => {
  const c = spotlight();
  assert.deepEqual(buscar(c, 'reri').pessoas, [{ nome: 'Reriston', ativas: 2 }]);
  const r = buscar(c, '', { escopo: { tipo: 'pessoa', valor: '10' } });
  assert.deepEqual([...r.andamento].sort(), ['1', '6']);
});

test('uma letra só não despeja o painel inteiro', () => {
  const r = buscar(spotlight(), 'a');
  assert.deepEqual([r.andamento, r.encerradas, r.clientes], [[], [], []]);
});

test('o cliente com o nome exato vem antes de quem só cita a palavra no título', () => {
  const extra = [...itens, { id: '7', nome: 'Card - Antonov convida', cliente: 'Hebravet', status: 'Pode Fazer', veiculacao_iso: '2026-09-17' }];
  const r = buscar(spotlight(), 'antonov', { itens: extra });
  assert.ok(r.andamento.indexOf('7') > r.andamento.indexOf('1'));
});

test('o destaque respeita acentos e não deixa HTML passar', () => {
  const c = spotlight();
  vm.runInContext(`a = spotlightRealce('Óticas Antônov', 'antonov');
    b = spotlightRealce('<b>antonov</b>', 'antonov');
    d = spotlightDiasAntes('2026-03-15', 30); e = spotlightDataBr('2026-09-20', '2026-09-16');
    f = spotlightDataBr('2025-06-12', '2026-09-16');`, c);
  assert.equal(c.a, 'Óticas <mark>Antônov</mark>');
  assert.ok(!c.b.includes('<b>'), 'o texto da peça não vira HTML');
  assert.equal(c.d, '2026-02-13', 'a conta de dias atravessa o mês sem escorregar de fuso');
  assert.equal(c.e, '20/09');
  assert.equal(c.f, '12/06/2025');
});
