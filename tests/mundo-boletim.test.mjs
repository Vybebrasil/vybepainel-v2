// Boletim dos agentes (vybe-mundo-boletim.js): Paulo, 09/11/2026 — "cada um passando seu relatório, o que fez e pra onde ir".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function carregar({ dono = true } = {}) {
  const ctx = { console, Date, JSON, Promise, Math, Number, String, Array, Object, Set, Map, Error,
    sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, setItem() {} },
    document: { readyState: 'complete', addEventListener() {}, body: { classList: { contains: () => false } }, querySelector: () => null } };
  ctx.window = ctx; ctx.souDonoDaSessao = () => dono;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-boletim.js', 'utf8').replace("if (typeof setTimeout === 'function'", 'if (false'), ctx);
  return ctx.VybeBoletim;
}
const AGORA = Date.parse('2026-11-09T12:00:00Z');
const h = (x) => new Date(AGORA - x * 3600e3).toISOString();
const ag = (id, agente) => ({ id, agente, funcao: '', nome: id, estado: 'ativo', andar: 'Térreo' });

test('o que fez: só as últimas 24 h; o que está errado: do mais grave; pra onde ir: falha, aprovação e sugestões (até 3)', () => {
  const B = carregar();
  const b = B.boletimDoAgente(ag('receber', 'Renato'), { agora: AGORA,
    atividade: { ultimos: [{ estado: 'concluida', em: h(3), tarefa: 'Conferiu boletos' }, { estado: 'concluida', em: h(30), tarefa: 'Antiga' }, { estado: 'falhou', em: h(2), tarefa: 'Cobrança', erro: 'sem resposta' }, { estado: 'aguardando_aprovacao', em: h(1), tarefa: 'Mandar lembrete' }] },
    perfil: { achados: { abertos: [{ fato: 'baixa', gravidade: 'baixa', sugestao: 'c' }, { fato: 'alta', gravidade: 'alta', sugestao: 'a' }, { fato: 'media', gravidade: 'media', sugestao: 'b' }], resolvidos: [{ fato: 'fechado', fechadoEm: h(5) }, { fato: 'velho', fechadoEm: h(48) }] } } });
  assert.deepEqual([...b.concluidas.map((e) => e.tarefa)], ['Conferiu boletos']);
  assert.deepEqual([...b.fechados.map((a) => a.fato)], ['fechado']);
  assert.deepEqual([...b.abertos.map((a) => a.fato)], ['alta', 'media', 'baixa']);
  assert.equal(b.urgentes, 1);
  assert.deepEqual([...b.ir.map((x) => x.texto)], ['Ver por que falhou: Cobrança', 'Aprovar ou recusar: Mandar lembrete', 'a']);
});

test('ordem: quem pede ação primeiro; quem não tem nada fica só no resumo, separado de quem está sem leitura', () => {
  const B = carregar();
  const r = B.montar([ag('a', 'Calmo'), ag('b', 'Urgente'), ag('c', 'Aberto'), ag('d', 'Mudo')], { agora: AGORA,
    atividades: { a: { ultimos: [] }, b: { ultimos: [] }, c: { ultimos: [] } },
    perfis: { a: { achados: { abertos: [], resolvidos: [] } }, b: { achados: { abertos: [{ fato: 'x', gravidade: 'alta' }], resolvidos: [] } }, c: { achados: { abertos: [{ fato: 'y', gravidade: 'media' }, { fato: 'z', gravidade: 'baixa' }], resolvidos: [] } } } });
  assert.deepEqual([...r.cartoes.map((b) => b.agente)], ['Urgente', 'Aberto']);
  assert.deepEqual(JSON.parse(JSON.stringify(r.quietos.map((b) => [b.agente, b.semLeitura]))), [['Calmo', false], ['Mudo', true]]);
  assert.equal(r.resumo.abertos, 3); assert.equal(r.resumo.urgentes, 1);
});

test('só os donos: botão no Hoje e abertura sozinha uma vez por dia, sem abrir com a central fora do ar', () => {
  assert.equal(carregar({ dono: false }).botaoHtml(), '');
  assert.match(carregar().botaoHtml(), /data-boletim/);
  const fonte = readFileSync('vybe-mundo-boletim.js', 'utf8');
  assert.match(fonte, /visto === diaBahia\(\)/);
  assert.match(fonte, /if \(await carregar\(\)\) abrir\(\);/);
  assert.match(readFileSync('vybe-mundo.js', 'utf8'), /\$\{window\.VybeBoletim\?\.botaoHtml\?\.\(\) \|\| ''\}/);
  const idx = readFileSync('index.html', 'utf8');
  assert.ok(idx.indexOf('/vybe-mundo-agentes.js') < idx.indexOf('/vybe-mundo-boletim.js'), 'depois de Agentes');
  assert.match(idx, /vybe-mundo-boletim\.css/);
});

test('o que está fazendo agora: o estado ao vivo da central; quem está executando nunca fica entre os quietos', () => {
  const B = carregar();
  const b = B.boletimDoAgente(ag('arte', 'Danilo'), { agora: AGORA, atividade: { estado: 'executando', tarefa: 'Revisando a arte da Hebravet', desde: h(0.5), emCurso: 2, ultimos: [] } });
  assert.equal(b.agora.rotulo, 'Fazendo agora');
  assert.equal(b.agora.tarefa, 'Revisando a arte da Hebravet');
  assert.equal(b.quieto, false, 'trabalhando aparece no boletim');
  assert.equal(B.boletimDoAgente(ag('x', 'X'), { agora: AGORA }).agora, null, 'sem leitura: não inventa estado');
  const M = B.montar([ag('arte', 'Danilo'), ag('x', 'X')], { agora: AGORA, atividades: { arte: { estado: 'disponivel', ultimos: [] } } });
  assert.equal(M.todos.length, 2, 'a página Agência lista o agora de todos, inclusive os quietos');
});

test('botão Boletim no topo (de qualquer lugar), só para quem vê o boletim', () => {
  const js = readFileSync('vybe-mundo.js', 'utf8');
  assert.match(js, /class="vv-botao vv-ferr-boletim" data-boletim hidden/);
  assert.ok(js.indexOf('vv-ferr-boletim') > js.indexOf('data-ferr="whatsapp"') && js.indexOf('vv-ferr-boletim') < js.indexOf('data-ferr="avisos"'), 'depois do WhatsApp');
  assert.match(js, /btBoletim\.hidden = !window\.VybeBoletim\?\.podeVer\?\.\(\)/);
  assert.equal(carregar({ dono: false }).podeVer(), false);
});
