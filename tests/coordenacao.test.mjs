// SAFE: a conta da aba Coordenação do Hoje (vybe-mundo-coordenacao.js) num vm, com peças e dia fixos; sem rede nem DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ctx = vm.createContext({ localStorage: { getItem: () => null, setItem() {} }, CustomEvent: class {} });
vm.runInContext(ler('vybe-mundo-coordenacao.js'), ctx);
const C = ctx.VybeCoordenacao;
const J = (x) => JSON.parse(JSON.stringify(x));

const HOJE = '2026-11-13'; // sexta
const TIME = [
  { id: 'bia', nome: 'Beatriz', disciplina: 'design', limiteSemana: 14 },
  { id: 'jady', nome: 'Jady', disciplina: 'design', limiteSemana: 14 },
  { id: 'rer', nome: 'Reriston', disciplina: 'audiovisual', limiteSemana: 24 },
];
const peca = (id, quem, data, extra = {}) => ({ id, nome: 'P' + id, responsavel_ids: quem ? [quem] : [], veiculacao_iso: data, status: 'Em andamento', formato: 'Card', ...extra });

test('janela: dia, semana de segunda a domingo e mês inteiro', () => {
  assert.deepEqual(J(C.janelaDe('dia', HOJE)), { inicio: HOJE, fim: HOJE });
  assert.deepEqual(J(C.janelaDe('semana', HOJE)), { inicio: '2026-11-09', fim: '2026-11-15' });
  assert.deepEqual(J(C.janelaDe('mes', HOJE)), { inicio: '2026-11-01', fim: '2026-11-30' });
  assert.equal(C.disciplinaDe({ formato: 'Reels' }), 'audiovisual');
  assert.equal(C.disciplinaDe({ formato: 'Carrossel' }), 'design');
});

test('carga: atrasada conta, fora da janela não; limite do dia é 1/5 da semana', () => {
  const itens = [peca(1, 'bia', '2026-11-10'), peca(2, 'bia', '2026-11-01'), peca(3, 'bia', '2026-11-20'), peca(4, 'jady', HOJE)];
  const s = J(C.calcular({ itens, time: TIME, hoje: HOJE, periodo: 'semana' }));
  const bia = s.pessoas.find((p) => p.id === 'bia');
  assert.equal(bia.pontos, 2, 'a de 10/11 e a atrasada de 01/11; a de 20/11 é da semana que vem');
  assert.equal(bia.atrasadas, 2);
  const d = J(C.calcular({ itens, time: TIME, hoje: HOJE, periodo: 'dia' }));
  assert.equal(d.pessoas.find((p) => p.id === 'jady').limite, 3, '14 ÷ 5, arredondado');
  assert.equal(d.pessoas.find((p) => p.id === 'jady').hoje, 1);
  assert.equal(J(C.calcular({ itens, time: TIME, hoje: HOJE, periodo: 'mes' })).pessoas.find((p) => p.id === 'bia').pontos, 3);
});

test('sem ninguém: aparece com a sugestão de quem fica mais leve na disciplina, sem mandar tudo para a mesma pessoa', () => {
  const itens = [peca(1, 'bia', HOJE), peca(2, 'bia', HOJE), peca(10, '', HOJE), peca(11, '', HOJE), peca(12, '', HOJE, { formato: 'Reels' }), peca(13, '', '')];
  const r = J(C.calcular({ itens, time: TIME, hoje: HOJE, periodo: 'semana' }));
  assert.deepEqual(r.semDono.map((x) => x.d.id), [10, 11, 12]);
  assert.equal(r.semDono[0].sugerido, 'jady');
  assert.equal(r.semDono[2].sugerido, 'rer', 'Reels vai para o audiovisual');
  assert.deepEqual(r.semDono[2].ordem, ['rer']);
  assert.equal(r.semData, 1, 'sem data e sem ninguém fica fora da conta, só contada');
});

test('equilíbrio: tira de quem passou do limite a peça que não começou e passa para quem fica abaixo de 80%', () => {
  const itens = Array.from({ length: 16 }, (_, i) => peca(i + 1, 'bia', '2026-11-1' + (i % 5), { status: i < 4 ? 'A Fazer' : 'Em andamento' }));
  const r = J(C.calcular({ itens, time: TIME, hoje: HOJE, periodo: 'semana' }));
  assert.equal(r.pessoas.find((p) => p.id === 'bia').nivel, 'sobrecarregada');
  assert.ok(r.trocas.length >= 1 && r.trocas.length <= 4);
  for (const t of r.trocas) { assert.equal(t.de, 'bia'); assert.equal(t.para, 'jady'); assert.equal(t.d.status, 'A Fazer'); }
  const leve = J(C.calcular({ itens: itens.slice(0, 3), time: TIME, hoje: HOJE, periodo: 'semana' }));
  assert.equal(leve.trocas.length, 0, 'ninguém acima do limite: nada a trocar');
});

test('no Hoje: aba Coordenação para os donos e para quem coordena (Beatriz), gravando pela função de responsáveis', () => {
  const mundo = ler('vybe-mundo.js'), cfg = ler('vybe-config.js'), mod = ler('vybe-mundo-coordenacao.js'), idx = ler('index.html');
  assert.ok(cfg.includes('coordenacao:          Object.freeze([PESSOAS.BEATRIZ])'));
  assert.ok(mundo.includes("['coordenacao', 'Coordenação']"));
  assert.ok(mundo.includes("if (visaoHoje === 'coordenacao' && podeCoordenar() && pintarCoordenacao(el, { data })) return;"));
  assert.ok(idx.includes('<script src="/vybe-mundo-coordenacao.js"></script>'));
  assert.ok(mod.includes('await G.gravarResponsaveisDaPeca(item, novos);'));
  assert.ok(mod.includes('data-coord-ok'), 'cada troca pede confirmação antes de gravar');
});
