// Cadastro em etapas (Paulo, 20/11/2026: "em relação ao cadastrar de conteúdo ou demanda... não gosto que apareça
// tudo de vez.. gosto de etapa a etapa pra não ficar confuso"). A mesma janela (cadastros_governed_v2.js) para
// conteúdo e demanda, uma pergunta-grupo por vez: Cliente e formato, O que é, Datas e responsável, Confere.
// Aqui roda o código de verdade da navegação num contexto isolado: Continuar só passa com os obrigatórios da etapa,
// o erro aparece embaixo do campo, Voltar e o resumo levam de volta, o Esc pergunta antes de jogar fora o que foi
// preenchido, e a gravação é a mesma fcSubmit de antes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const cad = ler('cadastros_governed_v2.js');
const css = ler('padrao-v2/s-k.css');
const trecho = (de, ate) => {
  const a = cad.indexOf(de), b = cad.indexOf(ate, a + 1);
  assert.ok(a >= 0 && b > a, `trecho ${de}`);
  return cad.slice(a, b);
};

function elemento() {
  const classes = new Set(), attrs = {};
  return {
    hidden: true, textContent: '', classes, attrs, focou: 0,
    classList: { toggle: (c, v) => (v ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; },
    querySelector() { return this; }, focus() { this.focou += 1; },
  };
}

function montar({ state = {}, resposta = true } = {}) {
  const ids = ['fc-erro-formato', 'fc-erro-cliente', 'fc-erro-titulo', 'fc-erro-brief', 'fc-erro-data', 'fc-erro-prazo', 'fc-titulo', 'fc-brief', 'fc-busca-cliente', 'fc-submit-btn', 'fc-overlay'];
  const els = Object.fromEntries(ids.map((id) => [id, elemento()]));
  const chamadas = { submit: 0, fechou: 0, perguntou: [], desenhou: 0 };
  const c = vm.createContext({
    state: { board: 'producao', client: '', clients: [], format: '', itens: [{ titulo: '', veic: '', prazo: '', brief: '' }], assignees: [], removidos: [], ...state },
    document: { getElementById: (id) => els[id] || null, querySelector: () => null, querySelectorAll: () => [] },
    chamadas, fcEnviando: false,
    fcSincronizarDaTela() {}, fcPintarProgresso() {},
    fcSubmit: () => { chamadas.submit += 1; },
    fcCloseModal: () => { chamadas.fechou += 1; },
    perguntarNoPainel: async (p) => { chamadas.perguntou.push(p); return resposta; },
    todayIso: () => '2026-11-20',
  });
  c.window = c;
  vm.runInContext(`${trecho('  const FC_PASSOS = ', '  let fcPasso = 0;')}
    let fcPasso = -1;
    ${trecho('  const FC_ETAPAS = ', '  // Objetivo da peça')}
    ${trecho('  function fcConferirDatas(', '  window.fcConferirDatas')}
    function fcItemAtivo() { return Math.min(Math.max(Number(state.itemAtivo) || 0, 0), state.itens.length - 1); }
    // O redesenho de verdade monta a tela; aqui ele só leva à etapa da resposta que falta, como o de verdade faz.
    function fcDesenharPasso() { chamadas.desenhou += 1; if (fcPasso >= 0) { fcEtapa = fcEtapaDoPasso(FC_PASSOS[fcPasso]); fcPasso = -1; fcMostrarFaltas(); } }
    ${trecho('  window.fcIrPara = function(n) {', '  // Etapa 4 · o resumo')}
    ${trecho('  // O que mudou desde que a janela abriu', '  // O que muda sem redesenhar')}
    globalThis.etapa = () => fcEtapa;
    globalThis.irPara = (n) => { fcEtapa = n; };
    state.assinaturaInicial = fcAssinatura();`, c);
  const visivel = (id) => !els[id].hidden;
  return { c, els, chamadas, visivel, etapa: () => c.etapa() };
}

test('etapas: quatro, com a pergunta de cada uma, e "N de 4 · etapa" no topo', () => {
  assert.match(cad, /const FC_ETAPAS = \['Cliente e formato', 'O que é', 'Datas e responsável', 'Confere'\];/);
  assert.match(cad, /const FC_ETAPA_PERGUNTA = \['Para quem é e de que tipo\?', 'O que é\?', 'Para quando e com quem\?', 'Confere e cadastra'\];/);
  assert.match(cad, /texto\.textContent = `\$\{fcEtapa \+ 1\} de \$\{FC_ETAPAS\.length\} · \$\{FC_ETAPAS\[fcEtapa\]\}`/);
  // Uma folha por vez: só a da vez sai sem hidden; trocar de etapa só troca o hidden (os campos continuam no lugar).
  assert.match(cad, /<section class="nd-passo" data-etapa="\$\{i\}" aria-labelledby="fc-passo-\$\{i\}"\$\{i === fcEtapa \? ' aria-current="step"' : ' hidden'\}>/);
  assert.match(cad, /passo\.hidden = !agora;/);
  // O mesmo componente para conteúdo e demanda: muda só o título da janela.
  assert.match(cad, /titulo\.textContent = demanda \? 'Nova demanda' : 'Novo conteúdo';/);
  // Continuar é o botão de sempre (fcAvancar); na última etapa vira Cadastrar (ou "Cadastrar N conteúdos").
  assert.match(cad, /botao\.textContent = fcEtapa >= ultima \? \(n > 1 \? `Cadastrar \$\{n\} \$\{demanda \? 'demandas' : 'conteúdos'\}` : 'Cadastrar'\) : 'Continuar';/);
  // Cada etapa mora no seu lugar: 1 · onde entra, formato e cliente; 2 · título, briefing, objetivo e referências;
  // 3 · data do cliente e responsável; 4 · o resumo, "Como chega na equipe" e Mais campos.
  const corpo = trecho('    const passo = (i, corpo, depois', '    renderPersons();');
  assert.match(corpo, /passo\(0, `\$\{fcQuadroFormatoHtml\(\)\}\$\{pq\.clientes\}`\)/);
  assert.match(corpo, /passo\(2, `<div class="nd-passo-duas"><div class="nd-passo-col">\$\{fcCartaoQuandoHtml\(n, it\)\}<\/div><div class="nd-passo-col">\$\{pq\.responsavel\}<\/div><\/div>`\)/);
  assert.match(corpo, /passo\(3, `<div class="nd-resumo" id="fc-resumo">\$\{fcResumoHtml\(\)\}<\/div>`/);
  for (const id of ['id="fc-prev-title"', 'id="fc-mais-chip"', 'id="fc-mais"', 'fcMaisCamposHtml(n, it)', '>Criar em escala</button>']) assert.ok(corpo.includes(id), id);
});

test('Continuar só passa com os obrigatórios da etapa; o erro aparece embaixo do campo, sem alert', () => {
  const t = montar();
  t.c.fcAvancar();
  assert.equal(t.etapa(), 0, 'sem formato e cliente, fica');
  assert.ok(t.visivel('fc-erro-formato') && t.visivel('fc-erro-cliente'), 'os dois avisos da etapa aparecem');
  assert.ok(!t.visivel('fc-erro-titulo'), 'o aviso de outra etapa não aparece antes da hora');
  assert.ok(t.els['fc-busca-cliente'].classes.has('er'));
  Object.assign(t.c.state, { format: 'Card', client: 'Academia Lions' });
  t.c.fcAvancar();
  assert.equal(t.etapa(), 1);
  t.c.state.itens[0].titulo = 'Promoção de sábado';
  t.c.fcAvancar();
  assert.equal(t.etapa(), 1, 'sem briefing não passa do O que é');
  assert.ok(t.visivel('fc-erro-brief') && !t.visivel('fc-erro-titulo') && !t.visivel('fc-erro-formato'));
  t.c.state.itens[0].brief = 'Foto do produto com o preço';
  t.c.fcAvancar();
  assert.equal(t.etapa(), 2);
  t.c.fcAvancar();
  assert.equal(t.etapa(), 2, 'sem data não passa');
  assert.ok(t.visivel('fc-erro-data'));
  Object.assign(t.c.state.itens[0], { veic: '2026-11-18', prazo: '2026-11-11' });
  t.c.fcAvancar();
  assert.equal(t.etapa(), 2, 'data do cliente antes de hoje não passa');
  assert.ok(t.visivel('fc-erro-prazo'));
  assert.equal(t.els['fc-erro-prazo'].textContent, 'A data do cliente não pode ficar antes de hoje.');
  Object.assign(t.c.state.itens[0], { veic: '2026-11-27', prazo: '2026-11-20' });
  t.c.fcAvancar();
  assert.equal(t.etapa(), 3, 'chega ao Confere');
  assert.equal(t.chamadas.submit, 0, 'chegar ao resumo não cadastra');
  t.c.fcAvancar();
  assert.equal(t.chamadas.submit, 1, 'Cadastrar no resumo grava pela fcSubmit de sempre');
  assert.doesNotMatch(trecho('  window.fcAvancar = function() {', '  window.fcVoltar = function() {'), /showToast|alert\(/, 'sem toast nem alert ao validar');
});

test('antes de cadastrar a conferência roda em todos os conteúdos do lote e leva à etapa que falta', () => {
  const t = montar({ state: { format: 'Card', client: 'Academia Lions', itens: [
    { titulo: 'A', brief: 'a', veic: '2026-11-27', prazo: '2026-11-20' },
    { titulo: 'B', brief: '', veic: '2026-12-04', prazo: '2026-11-27' }] } });
  t.c.irPara(3);
  t.c.fcAvancar();
  assert.equal(t.chamadas.submit, 0);
  assert.equal(t.etapa(), 1, 'o briefing que falta no segundo leva ao O que é');
  t.c.state.itens[1].brief = 'b';
  t.c.state.itens[1].veic = '2026-11-10';
  t.c.irPara(3);
  t.c.fcAvancar();
  assert.equal(t.chamadas.submit, 0, 'data antes de hoje em qualquer um não cadastra');
  assert.equal(t.etapa(), 2);
  assert.equal(t.c.state.itemAtivo, 1, 'abre o conteúdo que errou');
});

test('Voltar e o resumo levam de volta sem conferir; na primeira etapa Voltar fecha', () => {
  const t = montar({ state: { format: 'Card', client: 'Academia Lions', itens: [{ titulo: 'A', brief: 'a', veic: '2026-11-27', prazo: '2026-11-20' }] } });
  t.c.irPara(3);
  t.c.fcVoltar();
  assert.equal(t.etapa(), 2);
  t.c.fcIrPara(0);
  assert.equal(t.etapa(), 0, 'a linha do resumo volta à etapa dela');
  t.c.fcIrPara(9);
  t.c.fcIrPara(-1);
  assert.equal(t.etapa(), 0, 'etapa que não existe não muda nada');
  t.c.fcVoltar();
  assert.equal(t.chamadas.fechou, 1, 'nada mudou desde que abriu: fecha sem perguntar');
  assert.equal(t.chamadas.perguntou.length, 0);
});

test('Esc, X e clique fora: com algo preenchido perguntam antes; o que veio do contexto não conta', async () => {
  // Aberta pelo calendário (cliente e dia já escolhidos): fechar sem mexer não pergunta.
  const doCalendario = montar({ state: { client: 'Academia Lions', clients: ['Academia Lions'], itens: [{ titulo: '', veic: '2026-11-27', prazo: '2026-11-20', brief: '' }] } });
  await doCalendario.c.fcPedirFechar();
  assert.equal(doCalendario.chamadas.perguntou.length, 0);
  assert.equal(doCalendario.chamadas.fechou, 1);
  // Escreveu o título: pergunta; "Cancelar" mantém a janela aberta.
  const nao = montar({ resposta: false });
  nao.c.state.itens[0].titulo = 'Promoção';
  await nao.c.fcPedirFechar();
  assert.equal(nao.chamadas.perguntou.length, 1);
  assert.equal(nao.chamadas.perguntou[0].confirmar, 'Descartar');
  assert.equal(nao.chamadas.fechou, 0);
  const sim = montar({ resposta: true });
  sim.c.state.format = 'Reels';
  await sim.c.fcPedirFechar();
  assert.equal(sim.chamadas.fechou, 1);
  // Os três jeitos de fechar passam por fcPedirFechar; depois de cadastrar, a janela fecha direto (fcCloseModal).
  assert.match(cad, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); fcPedirFechar\(\); return; \}/);
  assert.match(cad, /overlay\.onclick = e => \{ if\(e\.target === overlay\) fcPedirFechar\(\); \};/);
  assert.match(cad, /aria-label="Fechar cadastro" class="nd-btn s nd-x" onclick="fcPedirFechar\(\)"/);
  assert.match(cad, /if \(fechar\) fcCloseModal\(\);/);
  assert.match(cad, /state\.assinaturaInicial = fcAssinatura\(\);/);
  // Enter continua (no briefing quebra linha), Ctrl+Enter segue criando.
  assert.match(cad, /if \(e\.key === 'Enter' && !e\.shiftKey && !\['TEXTAREA','BUTTON','SELECT','A'\]\.includes\(e\.target\.tagName\)\) \{\s+e\.preventDefault\(\);\s+fcAvancar\(\);/);
});

test('resumo: cada linha volta à etapa dela e mostra o que falta', () => {
  const c = vm.createContext({
    state: { board: 'demandas', client: 'Academia Lions', clients: ['Academia Lions'], format: 'Impresso', objetivo: '', itens: [{ titulo: 'Banner da loja', brief: '', veic: '2026-11-27', prazo: '2026-11-20', arquivos: [{}, {}] }] },
    esc: (t) => String(t ?? '').replace(/</g, '&lt;'), fcQuadro: () => ({ nome: 'Solicitação de demanda', rotuloFormato: 'Tipo de demanda' }),
    fcRegraDoFormato: () => ({ dest: { aguardando: 'Nestor' } }), fcEquipeFinal: () => [], fcClienteHtml: (n) => `<span>${n}</span>`,
    fcDataCurta: (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '—'), fcTemTexto: (v) => Boolean(String(v || '').trim()),
  });
  vm.runInContext(`const FC_ETAPAS = ['Cliente e formato', 'O que é', 'Datas e responsável', 'Confere']; const FC_OBJETIVOS = [['atracao', 'Atração']];
    ${trecho('  function fcResumoHtml() {', '  // O que mudou desde que a janela abriu')}`, c);
  const html = c.fcResumoHtml();
  const linhas = [...html.matchAll(/onclick="fcIrPara\((\d)\)"[^>]*><small>([^<]+)<\/small><span>(.*?)<\/span>/g)].map((m) => [Number(m[1]), m[2], m[3]]);
  assert.deepEqual(linhas.map(([e, r]) => [e, r]), [[0, 'Onde entra'], [0, 'Tipo de demanda'], [0, 'Cliente'], [1, 'Título'], [1, 'Briefing'], [1, 'Referências'],
    [2, 'Conclusão'], [2, 'Prazo interno'], [2, 'Responsável']], 'demanda não tem Objetivo; a data do cliente é a Conclusão');
  assert.match(linhas[4][2], /nd-res-falta/, 'briefing que falta aparece no resumo');
  assert.equal(linhas[5][2], '2 arquivos');
  assert.equal(linhas[8][2], 'aguardando o Nestor', 'impresso sem dono espera o Nestor');
  c.state.board = 'producao';
  assert.match(c.fcResumoHtml(), /<small>Veiculação<\/small>/, 'conteúdo usa a veiculação');
  assert.match(c.fcResumoHtml(), /<small>Objetivo<\/small><span>nenhum<\/span>/);
});

test('o pedido ao servidor é o de antes e os pré-preenchimentos de contexto continuam', () => {
  // A gravação não foi tocada: fcCriarUm manda os mesmos campos (o teste de campo por campo está em padrao-v2-peca).
  assert.match(cad, /const pelaEscritaDupla = await tentarEscritaDupla\(\{ id: '' \}, \{\s+acao: 'criar', board: fcQuadro\(\)\.id,/);
  // Quem abre com contexto (cliente, dia, quadro, título) cai na primeira etapa que falta; com tudo, no Confere.
  assert.match(cad, /if \(!inicio\.escolherQuadro && \(inicio\.client \|\| inicio\.veic \|\| inicio\.board \|\| inicio\.titulo\)\) \{\s+const pendente = FC_PASSOS\.findIndex\(\(q\) => !fcRespondido\(q\)\);/);
  // O lote e a escala voltam ao O que é, onde moram título e briefing de cada conteúdo.
  assert.match(trecho('  window.fcIrParaConteudo = function(n) {', '  function fcMostrarNaLista(n) {'), /fcEtapa = 1;/);
  assert.match(trecho('  window.fcAdicionarItem = function() {', '  // "seg, 16/11"'), /fcEtapa = 1;/);
  // Arquivo solto fora da caixa vai para o conteúdo aberto e mostra a etapa das referências.
  assert.match(cad, /fcSoltarArquivos\(e, fcItemAtivo\(\), null\);\s+fcIrPara\(1\);/);
});

test('CSS da frente: uma folha por vez, Continuar laranja (o único), 34 de altura e canto 8, sem atalhos proibidos', () => {
  const regras = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(regras, /!important/);
  assert.doesNotMatch(regras, /html body\.mundo/);
  assert.doesNotMatch(regras, /:has\(/);
  const P = 'body.mundo #fc-overlay#fc-overlay .nd.nd-em-passos';
  assert.ok(css.includes(`${P} .nd-passo[hidden]{display:none}`), 'a etapa escondida não aparece (o legado põe display:flex)');
  assert.ok(css.includes(`${P} .nd-pe .nd-btn{min-width:96px;height:34px;padding:0 16px;border-radius:var(--d3-r-botao);`));
  assert.ok(css.includes(`${P} .nd-pe .nd-btn.k{background:var(--d3-acao);box-shadow:none;color:var(--d3-escuro-texto);`));
  assert.ok(css.includes(`${P} .nd-passo-folha{--fc-apoio:var(--d3-rotulo);`), 'o cinza de apoio sai da folha, que escurece no Escuro');
  const cores = regras.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || [];
  assert.deepEqual(cores, [], 'só tokens --d3-*');
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('/* ===== padrao-v2/s-k.css ===== */'), 'o fragmento entrou na junção');
});
