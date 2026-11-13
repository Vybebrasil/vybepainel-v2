// SAFE: contas puras do relatório mensal do cliente (vybe-relatorio-resumo.js) num vm, com peças fixas e
// dia fixo; sem rede, sem banco e sem DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ctx = vm.createContext({ window: {} });
vm.runInContext(readFileSync('vybe-relatorio-resumo.js', 'utf8'), ctx);
const R = ctx.window.VybeRelatorioResumo;
// O resultado nasce em outro contexto (vm): o JSON deixa os objetos comparáveis.
const resumo = (entrada) => JSON.parse(JSON.stringify(R.resumoDoMes(entrada)));
// Hora local do dia: o dia da entrega sai o mesmo em qualquer fuso (a CI roda em UTC).
const em = (iso, h = 10) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, h).toISOString(); };

const HOJE = '2026-10-20';
const PECAS = [
  { id: 1, nome: 'Reels lançamento', clientes: ['Padaria Sol'], formato: 'Reels', status: 'Finalizado', veiculacao_iso: '2026-10-05', status_updated_at: em('2026-10-04'), objetivo: 'Atração' },
  { id: 2, nome: 'Carrossel receita', cliente: 'Padaria Sol', formato: 'Carrossel', status: 'Finalizado', veiculacao_iso: '2026-10-08', status_updated_at: em('2026-10-09'), objetivo: 'educativo' },
  { id: 3, nome: 'Card promoção', cliente: 'padaria sol', formato: 'Card', status: 'Para agendar', veiculacao_iso: '2026-10-12', status_updated_at: em('2026-10-12', 23), objetivo: 'Conversão' },
  { id: 4, nome: 'Reels bastidores', cliente: 'Padaria Sol', formato: 'Reels', status: 'Em andamento', veiculacao_iso: '2026-10-15' },
  { id: 5, nome: 'Story enquete', cliente: 'Padaria Sol', formato: '—', status: 'Segurar Post', veiculacao_iso: '2026-10-16' },
  { id: 6, nome: 'Post data comemorativa', cliente: 'Padaria Sol', formato: 'Card', status: 'Ag. Aprovação Cliente', veiculacao_iso: '2026-10-28', objetivo: 'Atração' },
  { id: 7, nome: 'Sem veiculação, prazo no mês', cliente: 'Padaria Sol', formato: 'Card', status: 'Feito', prazo_iso: '2026-10-30', status_updated_at: em('2026-10-18') },
  { id: 8, nome: 'Entregue sem dia', cliente: 'Padaria Sol', formato: 'Reels', status: 'Publicado', veiculacao_iso: '2026-10-02' },
  { id: 9, nome: 'Campanha conjunta', clientes: ['Outra Loja', 'Padaria Sol'], formato: 'Reels', status: 'A Fazer', veiculacao_iso: '2026-10-31' },
  { id: 10, nome: 'Outro mês', cliente: 'Padaria Sol', formato: 'Reels', status: 'Finalizado', veiculacao_iso: '2026-11-01' },
  { id: 11, nome: 'Setembro', cliente: 'Padaria Sol', formato: 'Reels', status: 'Finalizado', veiculacao_iso: '2026-09-30' },
  { id: 12, nome: 'Outro cliente', cliente: 'Outra Loja', formato: 'Reels', status: 'Finalizado', veiculacao_iso: '2026-10-10' },
  { id: 13, nome: 'Solicitação de arte', cliente: 'Padaria Sol', origem: 'solicitacao', status: 'Finalizado', veiculacao_iso: '2026-10-10' },
  { id: 1, nome: 'Reels lançamento (repetido)', cliente: 'Padaria Sol', formato: 'Reels', status: 'Finalizado', veiculacao_iso: '2026-10-05' },
];

test('peças do mês: só o cliente (qualquer dos clientes da peça), só o mês, sem solicitação e sem repetir', () => {
  const r = resumo({ pecas: PECAS, cliente: 'Padaria Sol', mes: '2026-10', hoje: HOJE });
  assert.equal(r.mes, '2026-10');
  assert.equal(r.rotuloMes, 'outubro de 2026');
  assert.equal(r.inicio, '2026-10-01');
  assert.equal(r.fim, '2026-10-31');
  assert.deepEqual(r.pecas.map((p) => p.id), ['8', '1', '2', '3', '4', '5', '6', '7', '9']);
  assert.equal(r.total, 9);
});

test('entregas: entregues pela lista do painel; no prazo pelo dia da entrega até a data da peça', () => {
  const r = resumo({ pecas: PECAS, cliente: 'Padaria Sol', mes: '2026-10', hoje: HOJE });
  // Paulo, 13/11/2026: pronta é só Finalizado. A 3 (Para agendar) ainda espera a postagem: não é entregue e, com a
  // veiculação de 12/10 passada, está atrasada.
  assert.equal(r.entregues, 4); // 1, 2, 7 (Feito) e 8 (Publicado)
  assert.equal(r.abertas, 5);
  assert.equal(r.noPrazo, 2); // 1 (véspera) e 7 (pelo prazo, sem veiculação)
  assert.equal(r.foraDoPrazo, 1); // 2: entregue um dia depois da veiculação
  assert.equal(r.semDiaDaEntrega, 1); // 8: sem status_updated_at
  assert.equal(r.noPrazoPct, 67);
  assert.equal(r.atrasadas, 2, 'a 4 e a 3 (Para agendar com a data passada); a 5 está em Segurar Post e 6 e 9 ainda não chegaram');
  assert.equal(r.pecas.find((p) => p.id === '3').noPrazo, null, 'Para agendar não conta como entregue');
  assert.equal(r.pecas.find((p) => p.id === '2').noPrazo, false);
  assert.equal(r.pecas.find((p) => p.id === '8').noPrazo, null);
});

test('por formato: mais peças primeiro, "—" vira "Sem formato" e vai por último no empate', () => {
  const r = resumo({ pecas: PECAS, cliente: 'Padaria Sol', mes: '2026-10', hoje: HOJE });
  assert.deepEqual(r.porFormato, [
    { formato: 'Reels', total: 4, entregues: 2 },
    { formato: 'Card', total: 3, entregues: 1 },
    { formato: 'Carrossel', total: 1, entregues: 1 },
    { formato: 'Sem formato', total: 1, entregues: 0 },
  ]);
  assert.equal(r.porStatus.reduce((t, s) => t + s.total, 0), r.total);
});

test('equilíbrio Atração/Educação/Conversão: grafias livres, porcentagem sobre as peças com objetivo', () => {
  const r = resumo({ pecas: PECAS, cliente: 'Padaria Sol', mes: '2026-10', hoje: HOJE });
  assert.equal(r.objetivos.disponivel, true);
  assert.equal(r.objetivos.comObjetivo, 4);
  assert.equal(r.objetivos.semObjetivo, 5);
  assert.deepEqual(r.objetivos.itens.map((o) => [o.chave, o.total, o.pct]), [['atracao', 2, 50], ['educacao', 1, 25], ['conversao', 1, 25]]);
  // objetivoDe (VybeConteudo) manda sobre o campo da peça.
  const s = resumo({ pecas: PECAS, cliente: 'Padaria Sol', mes: '2026-10', hoje: HOJE, objetivoDe: (d) => (d.id === 4 ? { objetivo: 'venda' } : undefined) });
  assert.equal(s.objetivos.itens.find((o) => o.chave === 'conversao').total, 2);
  // Sem nenhum objetivo, o bloco fica indisponível (vazio não é 0%).
  const semObj = resumo({ pecas: PECAS.map(({ objetivo, ...d }) => d), cliente: 'Padaria Sol', mes: '2026-10', hoje: HOJE });
  assert.equal(semObj.objetivos.disponivel, false);
});

test('regras trocáveis, mês vazio e entradas inválidas', () => {
  const r = resumo({ pecas: PECAS, cliente: 'Padaria Sol', mes: '2026-10-15', hoje: HOJE, entregue: (d) => d.status === 'Finalizado', ehSolicitacao: () => false });
  assert.equal(r.mes, '2026-10');
  assert.equal(r.total, 10, 'a solicitação entra quando quem chama diz que não é solicitação');
  assert.equal(r.entregues, 3); // 1, 2 e 13 (o repetido não conta)
  const vazio = resumo({ pecas: [], cliente: 'Padaria Sol', mes: '2026-02', hoje: HOJE });
  assert.equal(vazio.fim, '2026-02-28');
  assert.equal(vazio.noPrazoPct, null);
  assert.deepEqual(vazio.porFormato, []);
  assert.throws(() => R.resumoDoMes({ pecas: [], cliente: 'x', mes: '2026-13' }), /Mês inválido/);
  assert.equal(R.util.somarMeses('2026-01', -1), '2025-12');
  assert.equal(R.util.somarMeses('2026-12', 1), '2027-01');
  assert.equal(R.util.ultimoDia('2028-02'), '2028-02-29');
});

test('a lista de entregue é a mesma da Gestão (ENTREGUE de vybe-dono-metricas.js)', () => {
  const lista = (arquivo) => JSON.parse(readFileSync(arquivo, 'utf8').match(/const ENTREGUE = new Set\((\[[^\]]+\])\)/)[1].replace(/'/g, '"')).sort();
  assert.deepEqual(lista('vybe-relatorio-resumo.js'), lista('vybe-dono-metricas.js'));
});
