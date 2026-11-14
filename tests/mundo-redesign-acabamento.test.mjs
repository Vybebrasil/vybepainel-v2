// Redesign do legado, fase 1 (Paulo, 09/11/2026: "aquele tchan de macOS… acabamento premium… sistema fluido").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('vybe-mundo.css', 'utf8'), padrao = readFileSync('vybe-padrao.css', 'utf8');
const bloco = css.slice(css.indexOf('Redesign do legado, fase 1'));

test('tokens de movimento e material numa camada só', () => {
  assert.match(bloco, /--vv-mola:cubic-bezier\(\.32,\.72,0,1\)/);
  assert.match(bloco, /--vv-mola-viva:cubic-bezier\(\.34,1\.32,\.64,1\)/);
  assert.match(bloco, /--vv-sombra-janela:/);
  assert.doesNotMatch(bloco, /!important/, 'a camada nova não força nada');
});

test('entradas só com movimento (nunca começam transparentes) e tudo dentro de "Reduzir movimento"', () => {
  for (const k of ['vv-janela', 'vv-desce', 'vv-aviso']) {
    const m = bloco.match(new RegExp(`@keyframes ${k}\\{from\\{([^}]*)\\}`));
    assert.ok(m, k); assert.doesNotMatch(m[1], /opacity|filter/, `${k} sem opacidade nem desfoque no começo`);
  }
  const movimento = bloco.slice(bloco.indexOf('@media (prefers-reduced-motion:no-preference){'));
  assert.ok(movimento.includes('vv-janela var(--vv-t-janela) var(--vv-mola) both'));
  assert.match(bloco, /@media \(prefers-reduced-motion:no-preference\) and \(hover:hover\)\{/, 'resposta ao ponteiro só com mouse de verdade');
  assert.doesNotMatch(bloco, /html\.vb-ocioso/, 'o repouso continua pausando só laços infinitos');
});

test('o legado sem os vícios: sem ícone colorido no título, rótulo neutro, sem manchas, sem atalhos repetindo o dock', () => {
  assert.match(bloco, /html body\.mundo :is\(\.workspace-heading,\.pv-cabeca\) > \.pv-ic,html body\.mundo \.pv-ic-aba\{display:none\}/);
  assert.match(bloco, /html body\.mundo \.pv-kpi::after\{display:none\}/);
  // Limpeza de 14/11/2026: a regra de .vs-atalhos saiu na poda das regras mortas (nenhum JS/HTML monta mais .vs-atalhos).
  // Limpeza de 14/11/2026: a regra de .workspace-eyebrow saiu na poda das regras mortas (nenhum JS/HTML monta mais .workspace-eyebrow).
  assert.ok(padrao.includes(':where(body:not(.mundo)) :is(.auto-kicker,.ai-usage-kicker){color:#ff8f4f!important}'));
  assert.ok(padrao.includes(':where(body:not(.mundo)) .client-module-hero .client-module-kicker{color:#7aa7ff!important}'));
});

test('"Ativo" de cliente não pega a cor de selecionado', () => {
  const regras = css.split('\n').filter((l) => /:is\(\.active,\.(marcado,\.ativo|ativo,\.ativa)/.test(l));
  assert.ok(regras.length >= 6);
  for (const l of regras) assert.ok(l.includes(':not(.cli-situacao)'), l.slice(0, 80));
});

test('o aviso curto do painel antigo (#toast) é claro no mundo, acima do dock, com o plural certo', () => {
  assert.ok(padrao.includes(':where(body:not(.mundo)) #toast{display:flex!important;'));
  assert.match(css, /html body\.mundo #toast\{background:rgba\(255,255,255,\.97\);color:#1F1D1A;/);
  assert.match(readFileSync('vybe-demandas.js', 'utf8'), /DADOS_DEMANDAS\.length === 1 \? 'demanda carregada' : 'demandas carregadas'/);
});
