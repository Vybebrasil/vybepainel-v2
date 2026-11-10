// Redesign fase 3, resto da 3b e telas de trabalho (Paulo, 10/11/2026: "executa tudo! depois sobe de uma vez só").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const css = ler('vybe-mundo.css'), js = ler('vybe-mundo.js');

test('Camadas: balão junto dos controles, interruptores e as etapas da prospecção só com ela ligada', () => {
  assert.match(js, /data-ctl="camadas"/);
  assert.match(js, /<input type="checkbox" role="switch" data-camada=/);
  assert.match(js, /<div class="vv-cb-legenda"\$\{pros \? '' : ' hidden'\}>/);
  assert.match(css, /body\.mundo \.vv-placa:has\(\.vv-camada\)\{position:absolute;top:auto;left:auto;bottom:96px;/);
  assert.match(css, /body\.mundo \.vv-camada input\[type="checkbox"\]\{order:2;[^}]*appearance:none;/);
});

test('menu da conta: quem você é, ícones, aparência na linha e Sair sem a regra antiga do perigoso', () => {
  assert.match(js, /<div class="vv-menu-quem">/);
  assert.match(js, /<div class="vv-menu-tema-linha" role="group" aria-label="Aparência">/);
  assert.match(js, /item\('sair', 'Sair', '', 'vv-menu-perigo'\)/);
  assert.match(css, /\.vv-menu-conta \.vv-menu-perigo b\{color:#B42318\}/);
});

test('Planejamentos em linhas, Comercial e Conteúdo sem ícone laranja no título', () => {
  const plj = ler('vybe-mundo-planejamentos.css');
  assert.match(plj, /\.vv-plj-grade\{display:grid;grid-template-columns:1fr;/);
  assert.match(plj, /grid-template-areas:"topo placar avisos acoes" "sub placar avisos acoes"/);
  assert.match(ler('vybe-mundo-comercial.css'), /#vv-comercial \.vc-marca\{display:none\}/);
  assert.match(ler('vybe-mundo-conteudo.css'), /#vv-conteudo \.vc-marca\{display:none\}/);
});

test('avisos de ativação falam com quem usa: sem nome de arquivo nem "o Paulo aplica" para a equipe', () => {
  const telas = ler('vybe-mundo-carteira.js') + ler('vybe-mundo-comercial.js') + ler('vybe-mundo-pessoas.js');
  assert.doesNotMatch(telas, /o Paulo aplica|Falta o Paulo aplicar|Peça ao Paulo para aplicar/);
  assert.match(ler('vybe-mundo-carteira.js'), /souAdmin\(\) \? `<small class="vc-ativacao-tec">Para quem administra: migração/);
  assert.match(ler('vybe-mundo-carteira.css'), /#vv-carteira \.vc-ativacao\{[^}]*background:#FFFFFF;color:#1F1D1A\}/);
});

test('Cérebro da ficha sem Claude nem conector; busca com frase curta; rodapé da captação no padrão', () => {
  const ficha = ler('vybe-clientes-ficha.js');
  assert.ok(!ficha.includes('<h3>Registros dos chats do Claude</h3>') && !ficha.includes('pelo conector "Ecossistema Vybe".</p>'), 'a tela da ficha não fala de Claude nem de conector');
  assert.match(ficha, /<h3>O que a equipe registrou<\/h3>/);
  assert.match(ler('vybe-spotlight.js'), /placeholder="Buscar peça, cliente ou pessoa">/);
  assert.match(css, /body\.mundo \.capt-gerir \.vb-link\.perigo\{order:-1;margin-right:auto;/);
  assert.match(css, /\.vb-link:not\(\.capt-gerir > \.vb-link\):not\(#ds-a\)/);
  assert.ok(ler('vybe-padrao.css').includes(':where(body:not(.mundo)) .capt-gerir .vb-link{'));
  assert.match(js, /Ranking, Loja e Conquistas ficam no dock, no grupo Vybe\./);
});
