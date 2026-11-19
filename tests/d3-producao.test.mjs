// Direção 3 (moodboard 3, 13/11/2026): Painel de trabalho, Demandas, Visão do setor Produção e Aprovação de conteúdo.
// SAFE: só lê os arquivos; nada grava nem envia.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const gestor = ler('vybe-gestor.js'), demandas = ler('vybe-demandas.js'), setor = ler('vybe-mundo-setor.js'), conteudo = ler('vybe-mundo-conteudo.js');
const css = ler('padrao-v2/d3-producao.css');
const junto = ler('vybe-mundo-padrao-v2.css');

test('o CSS da Direção 3 da Produção: tokens d3, pelo id da tela, sem regra forçada', () => {
  assert.ok(!css.includes('!important'));
  assert.ok(!/html body\.mundo/.test(css));
  assert.ok(junto.includes('/* ===== padrao-v2/d3-producao.css ===== */'), 'o juntador já incluiu o fragmento');
  assert.match(css, /#mundo-moldura\{background:var\(--d3-areia\)\}/);
  assert.match(css, /\.vv-gestao\.vv-setor-visao\.d3s-casa\.d3s-casa\{background:var\(--d3-areia\)\}/);
  assert.match(css, /#vv-conteudo\.vc\.vc\.vc\{background:var\(--d3-areia\)\}/);
  // Cada tela pelo seu id (ou pela classe própria que só ela usa).
  const regras = css.split('\n').filter((l) => /^[#.:a-z]/i.test(l.trim()) && l.includes('{') && !l.trim().startsWith('@'));
  for (const r of regras) assert.ok(/#pv2-|#vv-conteudo|#mundo-moldura|\.d3p-|\.d3s|\.d3d-|\.pv2\.pv2-dias|\.vv-setor-visao|\.d3-num\.d3[ps]-num|button\.d3-num|\.vv-gestao /.test(r), r.slice(0, 80));
});

// Prancha V2-M-Demandas (16/11/2026): nas Demandas o laranja do Heitor vem do pv2Laranja (o mesmo das outras telas V2)
// e os quatro números viraram o pé "De olho" da folha; o Painel segue com d3pAcao e d3pNum.
test('Painel e Demandas: bloco de ação laranja, números com linha ou barra (no Painel) ou o pé De olho (nas Demandas) e Novo branco', () => {
  assert.match(gestor, /function d3pAcao\(/);
  assert.match(gestor, /function d3pNum\(/);
  assert.match(gestor, /d3LinhaSvg\(serie, \{ largura: 90, altura: 28, rotulo: serieRotulo \}\)/);
  assert.match(gestor, /class="pv2-btn d3p-novo"/);
  assert.match(demandas, /class="pv2-btn d3p-novo"/);
  // Prancha V2-S-Filtros-Demandas (19/11/2026): sem o laranja; o que ele pedia (atrasadas, sem responsável) virou número
  // do Resumo que filtra, e o pé diz quantas os filtros esconderam.
  assert.doesNotMatch(demandas, /pv2Laranja\(\{ agente: 'H'/);
  assert.match(demandas, /rot: \['atrasada', 'atrasadas'\], aceso: currentDemandaAtrasadas, acao: 'focarAtrasadas\(\)'/);
  assert.match(demandas, /visao\('sem', \['sem responsável', 'sem responsável'\]/);
  assert.match(demandas, /<div class="s-dm-pe" id="pv2d-pe"><\/div>/);
  assert.match(demandas, /escondidas'\)\} pelos filtros · cada filtro sai no próprio ×/);
});

test('o status de cada peça continua controlável nas quatro telas', () => {
  // A pílula é o botão do menu de status (openStatusEditor) no Painel e em Demandas.
  assert.match(gestor, /onclick="event\.stopPropagation\(\);openStatusEditor\(event,'\$\{id\}'\)"/);
  assert.match(gestor, /<div class="pv2-r">\$\{pv2StatusBotao\(d\)\}/);
  assert.match(demandas, /<span class="pv2-cs">\$\{pv2StatusBotao\(d\)\}<\/span>/);
  // Aprovar e Pedir alteração seguem pelos portões; nada grava direto.
  assert.match(conteudo, /const portao = acao === 'aprovar' \? globalThis\.openQualityGate : globalThis\.openStatusContextGate;/);
});

test('a pílula cheia só no que venceu, voltou para ajuste ou ficou pronta', () => {
  const tom = gestor.slice(gestor.indexOf('function pv2Tom('), gestor.indexOf('function pv2Pill('));
  const pv2Tom = new Function(`${tom}; return pv2Tom;`)();
  assert.equal(pv2Tom('Atrasada'), 'r');
  assert.equal(pv2Tom('Alteração'), 'a');
  assert.equal(pv2Tom('Finalizado'), 'g');
  for (const s of ['A Fazer', 'Pode Fazer', 'Em Andamento', 'Para aprovação', 'Ag. Info Cliente', 'Agendado']) assert.equal(pv2Tom(s), 'n', s);
});

test('Visão do setor Produção: bloco do Heitor, quatro números, Pede ação, Pessoas, Por status e Módulos', () => {
  const p = setor.slice(setor.indexOf("async 'setor:producao'()"), setor.indexOf("async 'setor:pessoas'()"));
  // Rodada S (19/11/2026, prancha V2-S-Visao-Setor): os números, Pede ação, Pessoas com Prontas por dia e os módulos no
  // pé; à direita o laranja do Heitor e Por status.
  const ret = p.slice(p.indexOf('return `<div class="g2 vst">'));
  const ordem = ['numerosV2', 'vstPede(acoes, H)', 'pessoasV2', 'vstDias(itens, H.dia)', 'vstModsPe(numerosMods)', 'laranjaV2', 'd3PorStatus(itens)'].map((x) => ret.indexOf(x));
  assert.ok(ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
  assert.match(p, /vstLaranja\(\{ numero: num\(atrasadas\)/, 'o Heitor com o número grande');
  assert.match(p, /principal = '';/, 'o botão sai do topo e vai para o bloco laranja');
  assert.match(p, /mais\('Entregas por semana, carga do time, onde trava, cobertura e agenda'/, 'os blocos de baixo continuam');
  assert.match(setor, /el\.classList\?\.toggle\?\.\('vst-casa', atual === 'setor:producao'\);/);
});

test('Aprovação: bloco do Augusto, quatro números, baralho com setas, fila por peça e equilíbrio em linha', () => {
  for (const f of ['function acaoHtml(f)', 'function numerosHtml(f)', 'function filaHtml(f)', 'function linhasDoMes(d)', 'function cartaoEquilibrio()']) assert.ok(conteudo.includes(f), f);
  assert.match(conteudo, /<div class="v2-baralho vc-apr-baralho" aria-live="polite">/);
  assert.match(conteudo, /if \(t\.dataset\.vcAprPasso !== undefined\) \{ st\.lote = \[\]; return passar\(st\.apr \+ Number\(t\.dataset\.vcAprPasso\)\); \}/);
  assert.match(conteudo, /class="d3-graf d3a-graf"/, 'gráfico do equilíbrio em linha');
});

test('textos de tela sem travessão', () => {
  const telas = [gestor.slice(gestor.indexOf('// ----- Direção 3')), setor.slice(setor.indexOf('// ---------- Direção 3')), conteudo.slice(conteudo.indexOf('// A carta da Direção 3'), conteudo.indexOf('// ---------- Equilíbrio ----------'))];
  for (const t of telas) {
    const sem = t.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').replace(/'—'/g, '').replace(/replace\('—', ''\)/g, '');
    assert.ok(!sem.includes('—'));
  }
});
