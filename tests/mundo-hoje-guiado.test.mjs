// Hoje guiado (Paulo, 09/11/2026): o agente do setor diz o que fazer primeiro; os donos juntam o dia de várias pessoas;
// a Agência vira passos do VYBES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo.js');

function guia() {
  const ini = js.indexOf('  function guiaDe(users) {'), fim = js.indexOf('  // O guia: o agente, uma frase');
  const ctx = { EQUIPES: { design: ['10', '11', '12'], audiovisual: ['13'] }, PESSOAS: { TAINARA: '20' }, String };
  ctx.timeDeCriacao = () => ['10', '11', '12', '13'];
  vm.createContext(ctx); vm.runInContext(js.slice(ini, fim), ctx);
  return (ids) => ctx.guiaDe(ids.map((id) => ({ id })));
}

test('quem guia: Danilo para a criação, Lucas para a edição, Mateus para o agendamento, VYBES para o resto', () => {
  const g = guia();
  assert.equal(g(['11']).nome, 'Danilo');
  assert.equal(g(['13']).nome, 'Lucas');
  assert.equal(g(['10', '13']).nome, 'Danilo', 'o time de criação junto');
  assert.equal(g(['20']).nome, 'Mateus');
  assert.equal(g(['1']).nome, 'VYBES');
  assert.equal(g(['11', '1']).nome, 'VYBES', 'misturado com quem não é da criação');
});

test('fila de várias pessoas: só para os donos, sem "ver como", e a peça de duas pessoas aparece uma vez com os dois nomes', () => {
  assert.ok(js.includes('const varios = !verComo && pessoasHoje.length && souDono() ?'));
  assert.ok(js.includes("porId.get(k).quem.push(String(user.name || user.nome || '').split(' ')[0]);"));
  assert.ok(js.includes("quem: fila.users.length > 1 ? x.quem : null"));
  assert.ok(js.includes("const CHAVE_PESSOAS = 'vybe.hoje.pessoas';"), 'guardado no navegador de quem olha');
  assert.ok(js.includes("data-pessoas-atalho=\"criacao\">Time de criação"));
});

test('ordem do guia: atrasada furando a data do cliente, atrasada, vai ao ar hoje, ajuste, aprovação; a contagem é a mesma do bloco Atrasadas', () => {
  assert.ok(js.includes("if (x.sit === 'atrasada' && v && v < hoje) return 0; if (x.sit === 'atrasada' && !desatualizada(x)) return 1; if (v === hoje) return 2;"));
  assert.ok(js.includes('const urgentes = ordemGuia.filter((x) => pesoGuia(x) <= 1).length;'));
  assert.ok(js.includes('${guia}${blocosHtml}'), 'o guia vem antes das colunas');
});

test('Agência: o VYBES guia (alerta mais grave, cliente esperando no WhatsApp, os outros alertas) antes dos números', () => {
  assert.ok(js.includes("const passosAg = [\n      ...alertas.filter((a) => a.nivel === 1).map(passoAlerta),"));
  assert.ok(js.includes('filter((x) => (x.minutos || 0) >= 120)'), 'cliente esperando há 2 h ou mais');
  assert.ok(js.includes('      ${guiaAgencia}\n      ${radar}'), 'o guia vem antes dos números');
  assert.ok(js.includes('<details class="vg-resto"><summary>Mais'), 'o resto fica recolhido');
});
