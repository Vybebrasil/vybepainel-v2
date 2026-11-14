// Rodada "fiel ao quadro" (14/11/2026): o essencial de cada diferença zerada nas telas de Finanças, IA, RH, Agentes,
// Automações, gaveta e famílias. Confere o código-fonte; os testes de cada tela renderizam o HTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('Finanças: rodapé "Sócios avisados" com vazio honesto, Contrato e Forma, régua de avisos 3/10/30', () => {
  const s = ler('vybe-mundo-financas.js');
  assert.match(s, /Sócios avisados<\/span><span class="d3f-vazio">sem registro ainda/);
  assert.match(s, /cabeca\(\[\['fv2-txt', 'Cliente'\], \['d3f-meio', 'Contrato'\], \['d3f-meio d3f-forma', 'Forma'\]/);
  assert.match(s, /const formaFatura = \(x\) => \{ const f = String\(x\.forma_pagamento \|\| x\.forma \|\| ''\)\.trim\(\); return FORMA_NOME\[f\] \|\| f \|\| '–'; \}/, 'sem dado, o traço curto');
  assert.match(s, /titulo: 'Régua de avisos'/);
  assert.match(s, /left:\$\{pos\(3\)\}%">3 d<[\s\S]*left:\$\{pos\(10\)\}%">10 d<[\s\S]*left:\$\{pos\(30\)\}%">30 d</);
  // Desde 14/11/2026 o aviso aos sócios é registrado (vybe_financeiro_avisos): o botão só aparece com o registro ligado.
  assert.match(s, /const botaoAvisar = \(av, c\) => \(!av\?\.disponivel \? '' :/);
  assert.match(s, /\['semaviso', 'Sem aviso', semAviso\.length/);
});

test('Extrato numa linha e "Guardar o cenário" sempre no bloco laranja', () => {
  const s = ler('vybe-mundo-financeiro.js');
  assert.match(s, /<div class="fv2-card-topo fx-lancs-topo"><h2>Lançamentos<\/h2>\$\{filtrosHtml\}<\/div>/);
  assert.match(s, /'Guardar o cenário', 'data-fx="cenario-focar"'/);
  const css = ler('padrao-v2/d3-financas.css');
  assert.match(css, /\.fx-lancs-topo\{flex-wrap:nowrap/);
});

test('RH: Seus pedidos na coluna da esquerda, Score por semana, vagas em colunas e Academy com miniatura', () => {
  const s = ler('vybe-mundo-pessoas.js');
  assert.match(s, /<div class="v2p-col v2p-col-esq"><div class="v2p-col-baralho">[\s\S]{0,200}\$\{seusPedidos\}<\/div>/);
  assert.match(s, /aria-label="Score por semana"[\s\S]{0,120}Sem histórico por semana ainda\./);
  assert.match(s, /<span>Vaga<\/span><span>Aberta<\/span><span>Conduz<\/span><span>Etapas<\/span>/);
  assert.match(s, /class="v2p-etp-card"/);
  assert.match(s, /rotulo: 'Aulas feitas', valor: aulasTime \? feitasTime/);
  assert.match(s, /class="v2p-mini"/); assert.match(s, /<span>Trilha<\/span><span>Para<\/span>/);
});

test('Agentes: linha das execuções, aviso discreto e "Sair da sombra" pela régua de 20 decisões', () => {
  const s = ler('vybe-mundo-agentes.js');
  assert.match(s, /perfil\?\.historico[\s\S]{0,160}d3Linha\(hist/);
  assert.match(s, /class="vga-nota d3t-aviso-leve"/);
  assert.match(s, /const REGUA_SOMBRA = 20;/); assert.match(s, /n\?\.decididas14d/);
  assert.match(s, /\$\{d3Num\(sairDaSombra\(modo, n\)\)\}<\/div>/);
  assert.match(ler('padrao-v2/d3-time.css'), /\.d3t-nums\.d3t-nums-ag\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)\}/);
});

test('Automações: a lista inteira (8) e as falhas do mesmo motivo numa linha', () => {
  const s = ler('vybe-automacoes-ui.js');
  assert.match(s, /const REGRAS_NA_FRENTE = 8,/);
  assert.match(s, /porMotivo\.get\(k\)\.push\(f\)/); assert.match(s, /`\$\{fs\.length\} falhas`/);
});

test('Gaveta e famílias: Checklist, material bruto discreto, escolha clara e etapas em barra', () => {
  const g = ler('vybe-gaveta.js');
  assert.match(g, /gv2-checklist">Checklist/);
  assert.ok(g.indexOf('${gavetaFichaResumoHtml(detail, item)}') < g.indexOf('${faixaDeMaterialBrutoHtml(detail, item, { compacta: true })}'), 'material bruto embaixo da ficha');
  const f = ler('padrao-v2/familias.css');
  assert.match(f, /\.vb-escolha > summary\.vb-chip\.vb-escolha-com\{border:0;background:var\(--d3-trilho,#F3F1EC\)/);
  assert.match(f, /\.vb-etapas > \.vb-etapa::after\{content:""[^}]*height:4px/);
});
