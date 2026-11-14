// Direção 3 (moodboard 3, 13/11/2026): Agentes, Perfil do agente e Automações seguem os quadros D3. O essencial: o bloco
// de ação laranja com "Ver o 1º", os números em cartão, "Para você decidir" em cartões com as mesmas rotas, o perfil em
// três colunas com a linha das execuções e as Automações com quatro números e "Nova regra" preta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const ag = ler('vybe-mundo-agentes.js'), auto = ler('vybe-automacoes-ui.js'), css = ler('padrao-v2/d3-time.css');
const secao = css.slice(css.indexOf('/* ===== AGENTES · PERFIL DO AGENTE · AUTOMAÇÕES ===== */'), css.indexOf('/* ===== FIM AGENTES'));

test('D3 · CSS da seção: preso às janelas, sem !important, sem html body.mundo e com tokens --d3-*', () => {
  assert.ok(secao.length > 1000, 'a seção existe');
  assert.doesNotMatch(secao.replace(/\/\*[\s\S]*?\*\//g, ''), /!important/);
  assert.doesNotMatch(secao, /html body\.mundo/);
  const seletores = secao.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0].trim()).filter((s) => s && !s.startsWith('@'));
  for (const s of seletores) assert.match(s, /#vv-agentes|#automacoes-root/, `regra presa à janela: ${s.slice(0, 80)}`);
  assert.match(secao, /#vv-agentes\.v2a,#automacoes-root\.v2r\{background:var\(--d3-areia\)\}/, 'fundo areia');
  assert.match(secao, /prefers-reduced-motion:reduce/);
});

test('D3 · Agentes: bloco de ação, quatro números, "Para você decidir" em cartões e o pé com as fichas', () => {
  assert.match(ag, /const fala = d3Acao\(\{ frase:[\s\S]*botao: n \? 'Ver o 1º' : '', attrs: 'data-vga-primeiro'/);
  for (const r of ["rotulo: 'Para decidir'", "rotulo: 'Agentes'", "rotulo: 'Acerto · 7 dias'", "rotulo: 'Achados de olho'"]) assert.ok(ag.includes(r), r);
  assert.match(ag, /function decidirHtml\(itens\)[\s\S]*const c = cartaDe\(it\)[\s\S]*\$\{c\.nao\[1\]\}[\s\S]*v2-estado" \$\{c\.sim\[1\]\}/, 'as mesmas rotas do baralho');
  assert.match(ag, /<h3 class="v2g-h2">Para você decidir<\/h3>/);
  assert.match(ag, /data-vga-lista="1">Ver em lista</, 'a fila inteira continua em lista');
  assert.match(ag, /d3t-sinal" role="status">Central sem sinal<button type="button" data-vga-recarregar>Tentar de novo/);
  assert.match(ag, /if \(b\.hasAttribute\('data-vga-primeiro'\)\)/);
  assert.match(ag, /acerto = <b>certos ÷ \(certos \+ errados\)<\/b>/);
});

test('D3 · Perfil do agente: bloco de ação do agente, números, três colunas, Aprendeu e a linha das execuções', () => {
  assert.match(ag, /pedidos de \$\{esc\(s\.agente\)\} esperam`[\s\S]*botao: meus\.length \? 'Ver o 1º' : ''/);
  for (const r of ["rotulo: 'Em aberto'", "rotulo: 'Resolvidos · 7 dias'", "rotulo: 'Até resolver'"]) assert.ok(ag.includes(r), r);
  assert.match(ag, /<div class="d3t-perfil"><div class="v2a-esq">\$\{fazHtml\}\$\{agoraHtml\}\$\{aprendeuHtml\}<\/div><div class="v2a-meio">\$\{meio\}<\/div><div class="v2a-dir">/);
  assert.match(ag, /d3Linha\(hist\.map\(\(\[, v\]\) => v\.concluidas\), \{ meta: hist\.map\(\(\[, v\]\) => v\.falhas\)/, 'gráfico em linha');
  assert.match(ag, /ESTADO_LICAO = \{ incorporada: \['g', 'Valendo'\], em_revisao: \['b', 'Em revisão'\], contestada: \['n', 'Não vale'\] \}/);
  assert.match(ag, /data-vga-mais aria-pressed="\$\{st\.mais\}">\$\{st\.mais \? 'Recolher a ficha' : 'Ficha completa'\}/, 'a ficha de antes continua a um clique');
});

test('D3 · Automações: bloco de ação com o agente, quatro números com Por tipo e regras com "Testar" no fim da linha', () => {
  assert.match(auto, /<section class="d3-acao" aria-label="O que pede ação agora">/);
  assert.match(auto, /class="d3-num d3t-tipos"><span class="d3-num-rot">Por tipo · 30 dias<\/span>/);
  assert.match(auto, /class="v2g-btn k auto-novo"/);
  assert.match(auto, /<span class="v2g-sub v2r-n">/);
  assert.match(auto, /botao\.textContent = 'Testar'; return;/, 'o botão que conta o estado volta ao rótulo curto');
  assert.ok(/\r\n/.test(auto) && !/[^\r]\n/.test(auto), 'fim de linha CRLF preservado');
});
