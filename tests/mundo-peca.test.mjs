// A peça do achado (vybe-mundo-peca.js) e o boletim que resolve (Paulo, 09/11/2026: "se eu clicasse ali, talvez podia abrir
// um HUD com o calendário ... e alterar qualquer coisa nessa demanda"; "não ficar só me mostrando que tem algo errado").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function carregar() {
  const ctx = { console, Date, JSON, Promise, Math, Number, String, Array, Object, Set, Map, Error, setTimeout,
    document: { addEventListener() {}, body: { append() {} }, createElement: () => ({}) } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-peca.js', 'utf8'), ctx);
  return ctx.VybePeca;
}
const json = (x) => JSON.parse(JSON.stringify(x));

test('sugestão do agente: proposta da central primeiro; senão, o texto "Passar para X ... com prazo dia dd/mm"', () => {
  const P = carregar();
  assert.deepEqual(json(P.sugestaoDe({ sugestao: 'Passar para Bia (já faz foto/card; 3 peças até 14/11) com prazo ter 11/11.' }, '2026-11-09')), { responsavel: 'Bia', prazo: '2026-11-11' });
  assert.deepEqual(json(P.sugestaoDe({ sugestao: 'Passar para Ewerton L. com prazo 02/01' }, '2026-12-20')), { responsavel: 'Ewerton L', prazo: '2027-01-02' }, 'janeiro visto de dezembro é do ano seguinte');
  assert.deepEqual(json(P.sugestaoDe({ sugestao: 'texto livre', proposta: { responsavel: 'Lucas', prazo: '2026-11-12', grupo: 'Design & Edição', status: 'Pode Fazer' } }, '2026-11-09')),
    { responsavel: 'Lucas', prazo: '2026-11-12', grupo: 'Design & Edição', status: 'Pode Fazer' });
  assert.equal(P.sugestaoDe({ sugestao: 'Ninguém do time tem vídeo aberto agora' }, '2026-11-09'), null);
});

test('quem é o nome da sugestão na equipe', () => {
  const P = carregar(), eq = [{ id: 1, name: 'Ewerton Luis' }, { id: 2, name: 'Beatriz Souza' }, { id: 3, name: 'Bia' }];
  assert.equal(P.pessoaDoNome('Bia', eq).id, 3);
  assert.equal(P.pessoaDoNome('Ewerton L', eq).id, 1);
  assert.equal(P.pessoaDoNome('Zé', eq), null);
});

test('calendário: duas semanas a partir da segunda da semana do prazo; vizinhas são do mesmo cliente', () => {
  const P = carregar();
  const dias = P.diasDoCalendario({ prazo_iso: '2026-11-12' }, '2026-11-09');
  assert.equal(dias.length, 14); assert.equal(dias[0], '2026-11-09'); assert.equal(dias[13], '2026-11-22');
  assert.equal(P.diasDoCalendario({}, '2026-11-01')[0], '2026-10-26', 'sem datas: a semana de hoje (domingo cai na semana que começou na segunda)');
  const item = { id: 'vybe:1', cliente: 'VOA' };
  const viz = P.vizinhas(item, [item, { id: 'vybe:2', cliente: 'VOA', nome: 'Card', prazo_iso: '2026-11-10' }, { id: 'vybe:3', cliente: 'Outro', prazo_iso: '2026-11-10' }, { id: 'vybe:4', clientes: ['VOA', 'X'], nome: 'Reels', veiculacao_iso: '2026-11-11' }], dias);
  assert.deepEqual(json(viz), { '2026-11-10': [{ id: 'vybe:2', nome: 'Card', rot: 'prazo' }], '2026-11-11': [{ id: 'vybe:4', nome: 'Reels', rot: 'veicula' }] });
});

test('grava pelas funções do painel, sem editor novo; erro aparece e não vira sucesso', () => {
  const js = readFileSync('vybe-mundo-peca.js', 'utf8');
  assert.match(js, /G\.gravarResponsaveisDaPeca\(item,/); assert.match(js, /G\.moverDataDoItem\(item,/);
  assert.match(js, /G\.openItemWorkspace\(ref\)/, 'a demanda completa abre na gaveta de sempre');
  assert.match(js, /st\.erro = true; st\.msg = /);
  assert.match(js, /etapa: 'achado', chave: st\.achado\.chave, acao: 'resolvido'/);
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.indexOf('/vybe-mundo-peca.js') > 0 && html.indexOf('/vybe-mundo-peca.js') < html.indexOf('/vybe-mundo-boletim.js'));
});

test('boletim: achado abre a peça, grupos, números de 14 dias, onde estão os problemas, e ações no próprio boletim', () => {
  const js = readFileSync('vybe-mundo-boletim.js', 'utf8'), ag = readFileSync('vybe-mundo-agentes.js', 'utf8');
  assert.match(js, /G\.VybePeca\?\.abrir\?\.\(b\.dataset\.vblPeca,/);
  assert.match(js, /G\.VybeAgentes\.agrupar\(b\.abertos\)/, 'mesma conta de grupos do "Depende de você"');
  assert.match(js, /secao\('numeros', 'Como está indo'/); assert.match(js, /secao\('numeros', 'Onde estão os problemas'/);
  assert.match(js, /data-vbl-achado="resolvido"/); assert.match(js, /data-vbl-achado="ignorar"/);
  assert.match(js, /<span class="vbl-vezes">×\$\{e\.vezes\}<\/span>/, 'o que fez repetido vira uma linha com a contagem');
  assert.match(ag, /G\.VybePeca\?\.abrir\?\.\(b\.dataset\.vgaPeca,/, 'a página Agentes abre a mesma peça');
  assert.match(ag, /G\.VybeAgentes = \{ abrir, abrirCerebro, fechar, filaDoDono, agrupar,/);
});
