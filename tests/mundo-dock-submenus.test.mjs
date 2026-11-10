// Dock e HUDs fora do padrão (Paulo, 09/11/2026): "quando eu clico em produção, além de abrir a visão geral já devia abrir
// os submenus... quando eu troco de submenu tem hora que fecha eles... tem que continuar aberto".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync('vybe-mundo.js', 'utf8'), css = readFileSync('vybe-mundo.css', 'utf8'), legado = readFileSync('vybe-styles.css', 'utf8');

test('submenus: marcar outra coisa não recolhe; o setor abre a visão geral e os submenus juntos', () => {
  assert.match(js, /if \(dockLargo\(\) && String\(alvo\)\.startsWith\('setor:'\)\) expandirSetor\(alvo\);/, 'marcarTrilho só abre, nunca recolhe');
  assert.doesNotMatch(js, /expandirSetor\(String\(alvo\)\.startsWith\('setor:'\) \? alvo : ''\)/);
  assert.match(js, /if \(aberto && window\.VybeSetor\?\.aberto\?\.\(\) === b\.dataset\.trilho\) \{ expandirSetor\(''\); return; \}/, 'recolhe só clicando no setor já na visão geral dele');
  assert.match(js, /\} else if \(!b\.classList\.contains\('criar'\)\) expandirSetor\(''\);/, 'outro item do dock recolhe');
});

test('a janela que fecha não acende o Hoje por cima da visão geral, de Planejamentos ou da Direção de arte', () => {
  assert.match(js, /centroAberto \|\| window\.VybeSetor\?\.aberto\?\.\(\)\) return;/);
  assert.match(js, /criacaoPeloDock && visaoHoje === 'criacao' && !body\.classList\.contains\('mundo-modulo'\) \? 'direcao' : 'hoje'/);
  assert.match(readFileSync('vybe-mundo-planejamentos.js', 'utf8'), /aberto: \(\) => Boolean\(janela && !janela\.hidden\)/);
  assert.ok(js.includes("'VybePlanejamentos'"), 'Planejamentos está entre as janelas que o dock pergunta');
});

test('HUDs: X da janela sem o filtro do kicker, rodapé do tema antigo só no tema antigo, módulo para na moldura', () => {
  assert.match(css, /\[class\*="-kicker"\],\.day-today-label,\.client-module-kicker\):not\(:has\(button,a,input,select\)\)/);
  // O grupo de botões dentro do kicker (barra da gaveta, quadro 06) também fica fora do filtro.
  assert.match(css, /\[class\*="-kicker"\]:has\(button,a,input,select\) > :not\(button,a,input,select\):not\(:has\(button,a,input,select\)\)\{filter:/);
  assert.ok(legado.includes(':where(body:not(.mundo)) :is(.workspace-actions,.workflow-actions){position:sticky;bottom:0!important;'));
  assert.ok(css.includes('html body.mundo.mundo-modulo{position:fixed!important;top:var(--vv-m)!important;bottom:calc(var(--vv-m) + var(--vv-dock-alto, 0px))!important;'));
  assert.match(css, /@media \(max-width:900px\)\{body\.mundo\.mundo-modulo\.com-dock-salas::after\{/, 'a folga embaixo só no celular');
});
