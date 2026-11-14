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

test('Painel e Demandas: bloco de ação laranja, números com linha ou barra e Novo branco', () => {
  assert.match(gestor, /function d3pAcao\(/);
  assert.match(gestor, /function d3pNum\(/);
  assert.match(gestor, /d3LinhaSvg\(serie, \{ largura: 90, altura: 28, rotulo: serieRotulo \}\)/);
  assert.match(gestor, /class="pv2-btn d3p-novo"/);
  assert.match(demandas, /class="pv2-btn d3p-novo"/);
  assert.match(demandas, /d3pAcao\(\{ agente: 'H', quem: 'Heitor · Coordenação'/);
  assert.match(demandas, /<div class="d3p-nums quatro">/);
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
  const ordem = ['d3Acao({ agente: \'heitor\'', 'd3s-nums', 'd3Pede(curtas', 'd3Pessoas(time, semDono, itens, H.dia)', 'd3PorStatus(itens)', 'd3Modulos('].map((x) => p.indexOf(x));
  assert.ok(ordem.every((x) => x >= 0), ordem.join(','));
  assert.match(p, /principal = '';/, 'o botão sai do topo e vai para o bloco laranja');
  assert.match(p, /mais\('Entregas por semana, carga do time, onde trava, cobertura e agenda'/, 'os blocos de baixo continuam');
  assert.match(setor, /el\.classList\?\.toggle\?\.\('d3s-casa', atual === 'setor:producao'\);/);
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
