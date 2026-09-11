// Regras de fluxo que vivem no navegador e nenhuma tela cobria.
//
// São as decisões que mudam o que a pessoa pode fazer — quando o painel pede
// conferência, como um briefing se divide, qual é a margem entre as duas datas e
// quem pode corrigir o que foi escrito. Todas puras: entram dados, sai decisão,
// sem DOM e sem rede.
//
// Existem porque a divisão de vybe-risco.js moveu estas regras de arquivo sem
// mudar uma linha delas. Mover sem teste é confiar na leitura; com teste, a
// próxima pessoa que mexer descobre na hora se mudou o comportamento.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const carregar = (...arquivos) => {
  const contexto = vm.createContext({ console });
  for (const arquivo of arquivos) vm.runInContext(fs.readFileSync(arquivo, 'utf8'), contexto);
  return contexto;
};

const PRODUCAO = 'novo_grupo57911__1';
const REDACAO = 'group_title';
const DESIGN = 'novo_grupo__1';

test('finalizar no meio da esteira não pede conferência de entrega', () => {
  const c = carregar('vybe-portoes.js');
  c.peca = (grupo) => ({ id: '1', nome: 'Fotografia - Equipe', group_id: grupo });
  c.opcao = (label) => ({ label });
  const pede = (grupo, status) => {
    c.g = grupo; c.s = status;
    vm.runInContext('r = precisaDeConferenciaFinal(peca(g), opcao(s));', c);
    return Boolean(c.r);
  };

  // Em Produção e Redação, "Finalizado" quer dizer "minha etapa acabou, segue" —
  // quem captou a foto ou escreveu o roteiro não publicou nada.
  assert.equal(pede(PRODUCAO, 'Finalizado'), false);
  assert.equal(pede(REDACAO, 'Finalizado'), false);
  assert.equal(pede(PRODUCAO, 'Feito'), false);

  // No fim da esteira a peça sai para o cliente: a conferência vale inteira.
  assert.equal(pede(DESIGN, 'Finalizado'), true);

  // Agendar é publicar com hora marcada, não é passar o bastão.
  assert.equal(pede(PRODUCAO, 'Agendado'), true);

  // Sem grupo conhecido, o painel não abre mão da conferência.
  c.g = ''; c.s = 'Finalizado';
  vm.runInContext('r = precisaDeConferenciaFinal({}, opcao(s));', c);
  assert.equal(Boolean(c.r), true);
});

test('o id do grupo é lido pelos dois nomes que ele tem no painel', () => {
  const c = carregar('vybe-portoes.js');
  // processItemsAll grava 'group_id'; a gaveta e o banco falam 'grupo_id'.
  // Enquanto os dois existirem, ler só um esconde metade dos casos.
  c.a = { group_id: PRODUCAO }; c.b = { grupo_id: PRODUCAO };
  vm.runInContext('r1 = precisaDeConferenciaFinal(a, {label:"Finalizado"});', c);
  vm.runInContext('r2 = precisaDeConferenciaFinal(b, {label:"Finalizado"});', c);
  assert.equal(Boolean(c.r1), false);
  assert.equal(Boolean(c.r2), false);
});

test('mandar para aprovação pede a conferência visual da arte', () => {
  const c = carregar('vybe-portoes.js');
  for (const [status, esperado] of [['Para aprovação', true], ['Para aprovacao', true],
    ['Finalizado', false], ['Pode Fazer', false]]) {
    c.s = status;
    vm.runInContext('r = statusNeedsConferenciaVisual({label:s});', c);
    assert.equal(Boolean(c.r), esperado, status);
  }
  // Finalizado e Pode Fazer não exigem justificativa escrita para entrar.
  for (const status of ['Finalizado', 'Pode Fazer', 'Em andamento']) {
    c.s = status;
    vm.runInContext('r = statusNeedsContext({label:s});', c);
    assert.equal(Boolean(c.r), false, status);
  }
});

test('o briefing se divide nas partes do modelo da casa', () => {
  const c = carregar('vybe-briefing.js');
  c.texto = [
    'NOME DA TAREFA: Hebravet | Reels',
    '🎯 1. O CORAÇÃO DO PEDIDO',
    'Objetivo: escuta e avaliação.',
    'CTA: fale com a equipe.',
    '✍️ 2. ROTEIRO',
    '- Cena 1: recepção',
    '3. LEGENDA DO POST',
    'Segurança começa antes.',
  ].join('\n');
  // O resultado volta como JSON: array feito dentro do vm é de outro realm e
  // não passa na comparação estrita, mesmo tendo o conteúdo certo.
  vm.runInContext(`secoes = briefingEmSecoes(texto);
    titulos = JSON.stringify(secoes.map((s) => s.titulo));
    resumo = JSON.stringify(briefingResumoRapido(secoes));
    primeiraLinha = JSON.stringify(secoes[1].linhas[0]);
    tipoDoItem = secoes[2].linhas[0].tipo;`, c);

  assert.deepEqual(JSON.parse(c.titulos),
    ['', 'O CORAÇÃO DO PEDIDO', 'ROTEIRO', 'LEGENDA DO POST']);
  // "Objetivo: ..." é um par rótulo/valor; "- Cena 1: ..." é item de lista.
  assert.equal(JSON.parse(c.primeiraLinha).tipo, 'par');
  assert.equal(JSON.parse(c.primeiraLinha).valor, 'escuta e avaliação.');
  assert.equal(c.tipoDoItem, 'item');
  assert.deepEqual(JSON.parse(c.resumo), [{ rotulo: 'CTA', valor: 'fale com a equipe.' }]);
});

test('o texto da arte entre cercas não vira título de seção', () => {
  const c = carregar('vybe-briefing.js');
  // Cerca quer dizer "não interprete o que está aqui dentro". O time de design
  // já viu um "```text" solto na tela, e uma linha numerada do texto da arte
  // abrindo uma seção que não existe.
  c.texto = [
    '1. TEXTO DA ARTE',
    '```text',
    'CUIDADO NÃO SE IMPROVISA',
    '2. ISSO NÃO É TÍTULO',
    '```',
    '2. LEGENDA DO POST',
    'Segurança começa antes.',
  ].join('\n');
  vm.runInContext(`secoes = briefingEmSecoes(texto);
    titulos = JSON.stringify(secoes.map((s) => s.titulo));
    arte = JSON.stringify(secoes[0].linhas.find((l) => l.tipo === 'arte') || null);`, c);

  assert.deepEqual(JSON.parse(c.titulos), ['TEXTO DA ARTE', 'LEGENDA DO POST']);
  const arte = JSON.parse(c.arte);
  assert.ok(arte, 'o bloco entre cercas precisa virar uma linha de arte');
  assert.match(arte.valor, /CUIDADO NÃO SE IMPROVISA/);
  assert.match(arte.valor, /2\. ISSO NÃO É TÍTULO/);
  assert.ok(!arte.valor.includes('```'), 'a cerca não pode aparecer como conteúdo');
});

test('o Prazo de Ouro são sete dias antes da veiculação, e é aviso', () => {
  const c = carregar('vybe-datas.js');
  vm.runInContext('dias = PRAZO_OURO_DIAS; ouro = goldenDeadlineIso("2026-09-12");', c);
  assert.equal(c.dias, 7);
  assert.equal(c.ouro, '2026-09-05');

  const margem = (prazo, veiculacao) => {
    c.p = prazo; c.v = veiculacao;
    vm.runInContext('r = goldenDeadlineGap(p, v);', c);
    return c.r;
  };
  assert.equal(margem('2026-09-04', '2026-09-12'), 8);   // folgada
  assert.equal(margem('2026-09-10', '2026-09-12'), 2);   // apertada, mas permitida
  assert.equal(margem('', '2026-09-12'), null);          // sem as duas datas não há margem

  vm.runInContext('cheia = planningDateBr("2026-09-12"); vazia = planningDateBr("");', c);
  assert.equal(c.cheia, '12/09/2026');
  assert.equal(c.vazia, 'não definido');
});

test('registro do sistema não se corrige; nota de pessoa sim', () => {
  const c = carregar('vybe-atualizacoes.js');
  const doSistema = (update) => {
    c.u = update;
    vm.runInContext('r = atualizacaoDoSistema(u);', c);
    return Boolean(c.r);
  };
  // A diferença mora no separador, e é assim que o painel sempre escreveu.
  assert.equal(doSistema({ body: '<p>[Vybe OS] combinei com o cliente</p>' }), false);
  assert.equal(doSistema({ body: '<p>[Vybe OS · Checklist de qualidade] ...</p>' }), true);
  assert.equal(doSistema({ body: '<p>[Vybe OS · Link de entrega] https://…</p>' }), true);
  // E quem assina como automação é sistema, escreva o que escrever.
  assert.equal(doSistema({ body: '<p>qualquer coisa</p>', creator: { name: 'Automação' } }), true);
  assert.equal(doSistema({ body: '<p>qualquer coisa</p>', creator: { name: 'Paulo Martins' } }), false);
});
