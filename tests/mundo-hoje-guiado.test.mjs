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
  // Quem não tem a fila pelo usuário também escolhe (quadro 31), mas só uma pessoa; juntar várias continua dos donos.
  assert.ok(js.includes('const escolhidos = !verComo && pessoasHoje.length && (souDono() || !eu) ?'));
  assert.ok(js.includes('const varios = souDono() ? escolhidos : escolhidos.slice(0, 1);'));
  assert.ok(js.includes("porId.get(k).quem.push(String(user.name || user.nome || '').split(' ')[0]);"));
  assert.ok(js.includes("quem: fila.users.length > 1 ? x.quem : null"));
  assert.ok(js.includes("const CHAVE_PESSOAS = 'vybe.hoje.pessoas';"), 'guardado no navegador de quem olha');
  assert.ok(js.includes("data-pessoas-atalho=\"criacao\">Time de criação"));
});

test('ordem do guia: atrasada furando a data do cliente, atrasada, vai ao ar hoje, ajuste, aprovação; a contagem é a mesma do bloco Atrasadas', () => {
  assert.ok(js.includes("if (x.sit === 'atrasada' && v && v < hoje) return 0; if (x.sit === 'atrasada' && !prazoDesatualizado(x, hoje)) return 1; if (v === hoje) return 2;"));
  assert.ok(js.includes('urgentes: ordem.filter((x) => pesoNoGuia(x, hoje) <= 1).length'));
  assert.ok(js.includes('const { passos: passosGuia, ordem: ordemGuia } = passosDoGuia(abertas, hoje, varios);'), 'Minhas tarefas usa a ordem compartilhada');
  assert.ok(js.includes('const veic = veicDe, desatualizada = (x) => prazoDesatualizado(x, hoje), chaveFila = (x) => chaveDaFila(x, hoje);'), 'sem cópia das regras da fila');
  // Direção 3 (D3-Tarefas): a faixa do guia com os três primeiros passos vem antes dos números e da lista.
  assert.ok(js.includes('${faixa}\n      ${numeros}\n      <div class="d3h-grade"><div class="d3h-col">${tarefas}</div>'), 'a faixa do guia abre a tela, antes dos números');
});

test('Agência: o VYBES guia (alerta mais grave, cliente esperando no WhatsApp, os outros alertas) antes dos números', () => {
  // Direção 3 (D3-Agencia): o alerta mais grave vai para a faixa laranja; sem alerta, o cliente esperando no WhatsApp.
  assert.ok(js.includes('const ordemAlertas = [...alertas.filter((a) => a.nivel === 1), ...alertas.filter((a) => a.nivel !== 1)];'));
  assert.ok(js.includes('filter((x) => (x.minutos || 0) >= 120)'), 'cliente esperando há 2 h ou mais');
  assert.ok(js.includes("const QUANDO_D3 = [['Agora', 'r'], ['Depois', 'a'], ['Em seguida', '']];"), 'Pede ação em Agora, Depois, Em seguida');
  assert.ok(js.includes('ordemAlertas.slice(0, 3).forEach((a, k) => {'), 'até três alertas, na ordem');
  assert.ok(js.includes("${acaoD3({ ...faixa, agente: 'V' })}\n      ${numeros}"), 'a faixa vem antes dos números');
});

test('Criação: o time do Deivid (design e edição), guiado pelo Danilo, com as pessoas, as filas e a semana; o dock abre ela', () => {
  assert.ok(js.includes("const timeDeCriacao = () => (typeof EQUIPES !== 'undefined' ? [...EQUIPES.design, ...EQUIPES.audiovisual] : []).map(String);"));
  assert.ok(js.includes("${acaoD3({ ...faixa, agente: 'D' })}"), 'a faixa do Danilo (D3-Criacao)');
  assert.ok(js.includes("['criacao', 'Criação']"), 'aba dos donos');
  assert.ok(js.includes("if (visaoHoje === 'criacao' && ((dono && !verComo) || criacaoPeloDock)) { pintarCriacao(el, { data }); return; }"));
  assert.ok(js.includes("if (id === 'direcao') { visaoHoje = 'criacao'; criacaoPeloDock = true;"), 'Direção de arte do dock abre a Criação');
  // Quadro "Direção de arte" do moodboard (12/11/2026): três números, Fila do Danilo, baralho "Esperando o seu parecer" e o Time.
  assert.ok(js.includes("decidirHtml({ titulo: 'Esperando o seu parecer', artes: true })"), 'o baralho do parecer');
  assert.ok(js.includes("cartaoD3({ titulo: 'O time'") && js.includes("cartaoD3({ titulo: 'Pediram ajuste'") && js.includes('data-criacao-atalho="ajustes"'));
  assert.ok(js.includes("if (b.dataset.criacaoAtalho === 'antigo') { chamar('chooseDaControllerMode'); return; }"), 'o painel antigo continua atendido');
});
