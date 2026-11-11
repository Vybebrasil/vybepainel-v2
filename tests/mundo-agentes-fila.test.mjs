// "Depende de você" no módulo Agentes (vybe-mundo-agentes.js): Paulo, 09/11/2026 — "o que cada um tá dependendo de mim".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function carregar() {
  const ctx = { console, Date, JSON, Promise, Math, Number, String, Array, Object, Set, Map, Error, setInterval() {}, setTimeout,
    sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, setItem() {} },
    document: { hidden: false, addEventListener() {}, body: { classList: { contains: () => false } }, querySelector: () => null } };
  ctx.window = ctx; ctx.souDonoDaSessao = () => true;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-agentes.js', 'utf8'), ctx);
  return ctx.VybeAgentes;
}
const AGORA = Date.parse('2026-11-09T15:00:00Z');
const agentes = [{ id: 'design', agente: 'Danilo', nome: 'Design Visual' }, { id: 'compras', agente: 'Nestor', nome: 'Compras' }];

test('urgente, lição em revisão, falha e autonomia vão para "Para decidir"; o resto é acompanhado por agente', () => {
  const { filaDoDono } = carregar();
  const perfis = {
    design: { achados: { abertos: [
      { chave: 'a1', gravidade: 'alta', fato: 'Arte sem logo', primeiraVez: '2026-11-08T10:00:00Z' },
      { chave: 'a2', gravidade: 'media', fato: 'Cor fora da paleta' }, { chave: 'a3', gravidade: 'baixa', fato: 'Fonte pequena' }] },
      licoes: [{ id: 'l1', estado: 'em_revisao', texto: 'Antonov não usa preto' }, { id: 'l2', estado: 'incorporada', texto: 'já vale' }],
      projecao: { subirNivel: 'aceitação de 80% em 25 decisões' } },
    compras: { achados: { abertos: [] }, licoes: [], projecao: {} },
  };
  const atividades = { compras: { ultimos: [{ estado: 'falhou', em: '2026-11-09T14:00:00Z', tarefa: 'Pedir orçamento', erro: 'Gráfica sem contato' }] } };
  const F = filaDoDono({ agentes, perfis, atividades, agora: AGORA });
  assert.deepEqual(JSON.parse(JSON.stringify(F.decidir.map((x) => x.tipo))), ['falha', 'achado', 'licao', 'nivel'], 'falha primeiro, depois urgente, lição e autonomia');
  assert.equal(F.total, 4);
  assert.equal(F.decidir[1].a.chave, 'a1');
  assert.equal(F.decidir[2].l.id, 'l1', 'lição já incorporada não pede nada');
  assert.deepEqual(JSON.parse(JSON.stringify(F.acompanhar.map((x) => [x.setor, x.n]))), [['design', 2]]);
});

test('esperando: ação só enquanto o código vale; proposta até 1 semana; nada que já foi fechado depois', () => {
  const { filaDoDono } = carregar();
  const min = (m) => new Date(AGORA - m * 60e3).toISOString();
  const atividades = { design: { ultimos: [
    { estado: 'concluida', em: min(1), tarefa: 'Confirmar ação no Vybe OS', ferramenta: 'executor_confirmar', ref: 'r-fechada' },
    { estado: 'aguardando_aprovacao', em: min(2), tarefa: 'Aguardar aprovação de ação', ferramenta: 'executor_aprovacao', ref: 'r-fechada' },
    { estado: 'aguardando_aprovacao', em: min(3), tarefa: 'Aguardar aprovação de ação', ferramenta: 'executor_aprovacao', ref: 'r-viva' },
    { estado: 'aguardando_aprovacao', em: min(30), tarefa: 'Aguardar aprovação de ação', ferramenta: 'executor_aprovacao', ref: 'r-vencida' },
    { estado: 'aguardando_aprovacao', em: min(60 * 24 * 3), tarefa: 'Propor tarefa do setor', ferramenta: 'proposta_agente', ref: 'prop-1' },
    { estado: 'aguardando_aprovacao', em: min(60 * 24 * 9), tarefa: 'Propor tarefa do setor', ferramenta: 'proposta_agente', ref: 'prop-velha' },
  ] } };
  const F = filaDoDono({ agentes, perfis: {}, atividades, agora: AGORA });
  assert.deepEqual(JSON.parse(JSON.stringify(F.esperando.map((x) => [x.tipo, x.e.ref]))), [['acao', 'r-viva'], ['proposta', 'prop-1']]);
  assert.equal(F.total, 0, 'esperar o SIM de quem pediu não conta no número do dono');
});

test('a tela: abrir pelo dock cai na fila; pela mesa ou pelo boletim, no agente; número no dock só para quem vê o boletim', () => {
  const js = readFileSync('vybe-mundo-agentes.js', 'utf8'), css = readFileSync('vybe-mundo.css', 'utf8');
  assert.match(js, /if \(setor\) \{ st\.setor = setor; st\.vista = 'agente'; \} else st\.vista = pedido\.vista && Date\.now\(\) < pedido\.ate \? pedido\.vista : 'fila';/, 'pelo dock cai na fila (ou em Como o VYBES pensa, quando o atalho das Sinapses acabou de pedir)');
  assert.match(js, /if \(st\.vista === 'fila'\) return filaHtml\(\);/);
  assert.match(js, /data-vga-de="\$\{esc\(it\.setor\)\}"/, 'decidir na fila atualiza o perfil do agente certo');
  assert.match(js, /G\.VybeBoletim\?\.podeVer\?\.\(\) \? filaAgora\(\)\.total : 0/);
  assert.match(js, /Date\.now\(\) - ultimaContagem < 10 \* 60e3/, 'lê no máximo a cada 10 min');
  assert.match(css, /\.vv-trilho-n\{position:absolute/);
  assert.doesNotMatch(js.slice(js.indexOf('Depende de você')), /!important/);
});

test('agrupados: urgentes do mesmo agente e tipo viram uma linha; o número do dock conta linhas', () => {
  const { filaDoDono } = carregar();
  const sem = (c) => ({ chave: 'sem-' + c, tipo: 'sem_conteudo_semana', gravidade: 'alta', cliente: c, fato: `${c}: nenhum conteúdo com veiculação na semana.`, primeiraVez: '2026-11-09T11:00:00Z' });
  const perfis = { design: { achados: { abertos: [sem('Ace'), sem('Alpha1'), sem('Mangaba AI'),
    { chave: 'v1', tipo: 'veiculacao_passou', gravidade: 'alta', cliente: 'DiaCenter', fato: 'Card com veiculação (04/11) já passou e a peça não saiu.', primeiraVez: '2026-11-08T11:00:00Z' },
    { chave: 'v2', tipo: 'veiculacao_passou', gravidade: 'alta', cliente: 'DiaCenter', fato: 'Card com veiculação (06/11) já passou e a peça não saiu.', primeiraVez: '2026-11-07T11:00:00Z' },
    { chave: 'u1', tipo: 'outro', gravidade: 'alta', fato: 'Sozinho' }] } } };
  const F = filaDoDono({ agentes, perfis, atividades: {}, agora: AGORA });
  assert.equal(F.total, 3, 'três linhas: dois grupos e o achado sozinho');
  const [g1, g2, so] = F.decidir;
  assert.equal(g1.tipo, 'grupo'); assert.equal(g1.titulo, '3 clientes: nenhum conteúdo com veiculação na semana.');
  assert.deepEqual(JSON.parse(JSON.stringify(g1.achados.map((a) => a.chave))), ['sem-Ace', 'sem-Alpha1', 'sem-Mangaba AI']);
  assert.equal(g2.titulo, '2 achados do mesmo tipo', 'fatos diferentes: título genérico com exemplo');
  assert.equal(g2.em, '2026-11-07T11:00:00Z', 'desde o mais antigo');
  assert.equal(so.tipo, 'achado');
  const js = readFileSync('vybe-mundo-agentes.js', 'utf8');
  assert.match(js, /data-vga-lote="\$\{acao\}"/); assert.match(js, /botaoAchado\(it, 'resolvido', `Resolver os \$\{n\}`/); assert.match(js, /botaoAchado\(it, 'ignorar', `Ignorar os \$\{n\}`\)/);
  assert.match(js, /if \(r\.ok \|\| d\.error === 'Esse achado já foi fechado\.'\) feitos\+\+/, 'o que já estava fechado conta como feito');
  assert.match(js, /confirm\(/, 'pede confirmação antes de fechar o grupo');
});
