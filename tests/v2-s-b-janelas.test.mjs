// V2-S, frente b (pranchas V2-S-Datas-da-Peca, V2-S-Conferir-Status, V2-S-Pergunta e V2-S-Previa-Grande, 19/11/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8');
const portoes = ler('vybe-portoes.js'), datas = ler('vybe-datas.js'), clientes = ler('vybe-clientes.js');
const material = ler('vybe-material.js'), captacoes = ler('vybe-captacoes.js'), roteiros = ler('vybe-roteiros.js');
const tutorial = ler('vybe-mundo-tutorial.js'), fragmento = ler('padrao-v2/s-b.css').replace(/\/\*[^]*?\*\//g, ''), junto = ler('vybe-mundo-padrao-v2.css');
const trecho = (fonte, de, ate) => { const i = fonte.indexOf(de); return fonte.slice(i, fonte.indexOf(ate, i)); };
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function janelaV2() {
  const c = vm.createContext({ safeText: esc, corDoClienteV2: () => '#3B5BA9' });
  vm.runInContext(trecho(portoes, 'const VBJ_ICONES', 'function abrirJanelaV2'), c);
  vm.runInContext(trecho(portoes, 'function janelaDeConferenciaHtml', 'function openQualityGate'), c);
  return c;
}

test('peças comuns: sigla do cliente, avatar com a cor da carteira, status com o ponto e o topo com o fechar', () => {
  const c = janelaV2();
  assert.equal(c.vbjSiglaDoCliente('Academia Lions'), 'AL');
  assert.equal(c.vbjSiglaDoCliente('Hebravet'), 'HE');
  assert.equal(c.vbjSiglaDoCliente(''), '?');
  assert.match(c.vbjAvatarHtml('Academia Lions', 'vbj-av g'), /<span class="vbj-av g" style="--c:#3B5BA9" aria-hidden="true">AL<\/span>/);
  assert.match(c.vbjStatusHtml('Agendado', '#2E7DD7'), /<span class="vbj-st" style="--st:#2E7DD7"><i><\/i>Agendado<\/span>/);
  assert.equal(c.vbjStatusHtml(''), '');
  const topo = c.vbjTopoHtml({ titulo: 'Editar <roteiro>', sub: 'Agenda · biblioteca de roteiros' });
  assert.match(topo, /<h2 class="vbj-titulo" id="vbj-titulo">Editar &lt;roteiro&gt;<\/h2><span class="vbj-sub">Agenda · biblioteca de roteiros<\/span>/);
  assert.match(topo, /class="vbj-x" aria-label="Fechar" title="Fechar" onclick="closeWorkflowModal\(\)"/);
});

test('conferir antes de trocar o status: de → para, caixas com contador, prévia ao lado e o Confirmar apagado até marcar tudo', () => {
  const c = janelaV2();
  const html = c.janelaDeConferenciaHtml({ item: { nome: 'Feed - Novidade do mês', cliente: 'Hebravet', formato: 'Feed', status: 'Em andamento', veiculacao_iso: '2026-11-20' },
    option: { label: 'Agendado', color: '#2E7DD7' }, titulo: 'Conferir antes de agendar', sub: 's', cab: 'Antes de liberar o agendamento',
    idForm: 'material-review-form', mudar: 'updateMaterialReviewState()', checks: ['a', 'b', 'c'], marca: 'data-material-review-check',
    nota: 'n', idBotao: 'material-review-submit', onclick: 'submitMaterialReview()', acao: 'Confirmar e agendar' });
  assert.match(html, /Hebravet · Feed · veiculação 20\/11/);
  assert.match(html, /<span class="vbc-de-para"><span class="vbj-st"[^>]*><i><\/i>Em andamento<\/span><svg[^]*?<\/svg><span class="vbj-st" style="--st:#2E7DD7"><i><\/i>Agendado<\/span>/);
  assert.match(html, /<span class="vbc-conta" style="--p:0%"><b>0 de 3<\/b>/);
  assert.equal((html.match(/data-material-review-check/g) || []).length, 3);
  assert.match(html, /<button id="material-review-submit" type="button" class="vbj-btn k" disabled onclick="submitMaterialReview\(\)">Confirmar e agendar<\/button>/);
  assert.match(html, /id="material-review-preview" class="vbc-palco"/);
  // A conferência visual (sem caixas) nasce com o Confirmar aceso.
  assert.match(portoes, /abrirJanelaV2\(janelaDeConferenciaHtml\(\{[^]*?idBotao: 'conferencia-confirmar'[^]*?desligado: false/);
  // O bastão não mudou: o botão só acende com todas as caixas marcadas.
  assert.match(portoes, /button\.disabled=!checks\.length\|\|checks\.some\(check=>!check\.checked\)/);
});

test('datas da peça: prazo e veiculação com nome, a régua do Prazo de Ouro e o motivo só quando sai do padrão', () => {
  const c = vm.createContext({ safeText: esc, vbjIcone: () => '' });
  vm.runInContext(trecho(datas, 'const PRAZO_OURO_DIAS', 'function updateGoldenDeadlineState'), c);
  const ok = c.painelDoPrazoDeOuro('2026-11-09', '2026-11-16');
  assert.match(ok, /class="vbd-regra vbd-ok"[^]*No padrão[^]*7 dias completos de antecedência/);
  assert.match(ok, /<label class="vbd-motivo" hidden>/);
  const risco = c.painelDoPrazoDeOuro('2026-11-19', '2026-11-20');
  assert.match(risco, /class="vbd-regra vbd-risco"[^]*1 dia de antecedência[^]*6 abaixo do padrão · o ideal é 13\/11[^]*Usar 13\/11/);
  assert.match(risco, /<label class="vbd-motivo">\s*<span>Por que fora do padrão\? · fica no histórico da peça<\/span>/);
  assert.match(c.painelDoPrazoDeOuro('2026-11-01', '2026-11-20'), /vbd-folga[^]*19 dias de antecedência[^]*<label class="vbd-motivo">/);
  assert.match(c.painelDoPrazoDeOuro('', ''), /vbd-pendente[^]*Falta a veiculação[^]*<label class="vbd-motivo" hidden>/);
  const editor = trecho(datas, 'function openPlanningEditor', 'function savePlanningDates');
  for (const p of ['<span>Prazo de produção</span>', 'id="planning-prazo"', '<span>Veiculação · data do cliente</span>', 'id="planning-veiculacao"', 'id="planning-golden-state"', 'id="planning-save"']) assert.ok(editor.includes(p), p);
  assert.ok(editor.indexOf('planning-prazo') < editor.indexOf('planning-veiculacao'), 'prazo antes da veiculação');
});

test('pergunta do painel: uma janela nas três formas, devolvendo o mesmo de antes', () => {
  const fn = trecho(clientes, 'function perguntarNoPainel', '\n}\n') ;
  assert.match(fn, /nota = '' \}\)/);
  assert.match(fn, /fundo\.className = 'vbp-fundo';/);
  assert.match(fn, /const dizerSim = \(\) => fechar\(campo \? String\(entrada\(\)\?\.value \?\? ''\)\.trim\(\) : true\);/);
  assert.match(fn, /fechar\(campo \? null : false\)/);
  assert.match(ler('vybe-briefing.js'), /nota: 'Fica no histórico: quem salvou e quando\.'/);
  // Roteiros e captação na mesma peça, com os erros no lugar novo.
  assert.match(roteiros, /abrirJanelaV2\(`\$\{vbjTopoHtml\(\{ titulo: "Editar roteiro"/);
  assert.match(roteiros, /class="vbj-btn vbj-txt vbj-perigo" onclick="rotEditar\(this\.form,'\$\{id\}',true\)"/);
  assert.match(captacoes, /function captAbrirFolha\(html\) \{\s*abrirJanelaV2\(html, "vbp vbp-capt"\);/);
  for (const f of ['captMontar', 'captReagendar', 'captFechar']) assert.match(trecho(captacoes, `async function ${f}(`, '\n}'), /querySelector\("\.vbp-erro"\)/, f);
  assert.doesNotMatch(captacoes, /capt-folha|class="capt-form"|workflow-primary/);
});

test('prévia grande: "Prévia", a barra das peças, a legenda do arquivo e a ficha com Abrir a peça', () => {
  const abrir = trecho(material, 'function abrirPreviaGrande', 'function eVideoDoMaterial');
  for (const id of ['previa-baixar', 'previa-trocar', 'previa-peca-antes', 'previa-peca-depois', 'previa-peca-nome', 'previa-peca-onde', 'previa-grande-media', 'previa-grande-nome', 'previa-ficha']) assert.ok(abrir.includes(`id="${id}"`), id);
  assert.match(abrir, /caixa\.className = 'previa-grande vbg';/);
  assert.match(material, /\$\{indice \+ 1\} de \$\{ids\.length\}\$\{rotulo \? ` em \$\{rotulo\}` : ''\} · ↑ ↓ passam a peça/);
  const c = vm.createContext({});
  vm.runInContext(trecho(material, 'function dataDaFichaDaPrevia', 'function legendaDaPrevia'), c);
  assert.equal(c.dataDaFichaDaPrevia('2026-11-19').replace(' ', ', '), 'qui, 19/11');
});

test('tutorial: não abre por cima da pergunta nem da prévia grande (PR #729)', () => {
  assert.match(tutorial, /const EM_ACAO = \[.*'dialog\[open\]', '#cli-pergunta', '#previa-grande'\];/);
});

test('fragmento s-b: só tokens, sem !important, sem html body.mundo e sem :has com [style]; juntado na folha gerada', () => {
  assert.doesNotMatch(fragmento, /!important/);
  assert.doesNotMatch(fragmento, /html body\.mundo/);
  assert.doesNotMatch(fragmento, /:has\([^)]*\[style/);
  assert.doesNotMatch(fragmento, /#[0-9A-Fa-f]{3,8}\b/, 'sem cor escrita');
  assert.doesNotMatch(fragmento, /text-transform:uppercase/);
  assert.ok(junto.includes('/* ===== padrao-v2/s-b.css ===== */'));
  assert.match(fragmento, /\.vbj-btn\{[^}]*height:34px[^}]*border-radius:var\(--d3-r-botao\)/);
  assert.match(fragmento, /\.vbd-motivo\[hidden\]\{display:none\}/);
});
