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
});

test('D3 · Agentes: a tela principal é a prancha V2-M-Agentes; a fila em lista (a um clique) segue com o bloco de ação e os quatro números', () => {
  assert.match(ag, /const emM = \(\) => st\.vista === 'fila';/);
  assert.match(ag, /if \(!st\.lista\) return filaMHtml\(\{ F, dono, lendo \}\);/);
  const m = ag.slice(ag.indexOf('  function laranjaFilaHtml('), ag.indexOf('  function filaHtml() {'));
  assert.match(m, /const it = n \? F\.decidir\[st\.frente\] : null, c = it \? cartaDe\(it\) : null;/);
  assert.match(m, /class="d3m-btn l v2-estado" \$\{c\.sim\[1\]\}\$\{trava\}[\s\S]*class="d3m-btn l s" \$\{c\.nao\[1\]\}\$\{trava\}/, 'as mesmas rotas do baralho');
  assert.match(m, /<h3>Para você decidir<\/h3>/);
  assert.match(m, /data-vga-lista="1">ver em lista</, 'a fila inteira continua em lista');
  assert.match(ag, /class="d3m-d-ag-sinal" role="status">Central sem sinal<button type="button" class="d3m-d-vbtn" data-vga-recarregar>Tentar de novo/);
  // A lista de antes: bloco de ação, quatro números e a conta do acerto.
  assert.match(ag, /const fala = d3Acao\(\{ frase:[\s\S]*botao: n \? 'Ver o 1º' : '', attrs: 'data-vga-primeiro'/);
  for (const r of ["rotulo: 'Para decidir'", "rotulo: 'Agentes'", "rotulo: 'Acerto · 7 dias'", "rotulo: 'Achados de olho'"]) assert.ok(ag.includes(r), r);
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

test('V2 · Automações: o laranja do agente só com falha, por tipo na consulta e regras com "Testar" no fim da linha', () => {
  // Prancha V2-M-Automacoes: com falha, o cartão laranja do agente na consulta; sem falha (nada a fazer), ele some.
  assert.match(auto, /fala\.hidden = !pendentes\.length;/);
  assert.match(auto, /class="d3m-laranja d3m-e-au-lar" aria-label="O que pede ação agora"/);
  assert.match(auto, /class="d3m-vlin d3m-e-au-tipo"><span><b>\$\{nome\}<\/b> · \$\{texto\}<\/span>/, 'o que uma regra pode fazer, com a contagem de 30 dias por tipo');
  // "Nova regra" do topo é a pastilha branca no vidro, para quem administra (a prancha mostra-a também sem regra).
  assert.match(auto, /class="d3v-btn d3m-e-claro auto-novo"/);
  assert.match(auto, /const novo = admin \?/);
  assert.match(auto, /<span class="d3m-e-au-n">/);
  assert.match(auto, /botao\.textContent = 'Testar'; return;/, 'o botão que conta o estado volta ao rótulo curto');
  // O fim de linha não entra na conta: o git guarda LF e a cópia local no Windows tem CRLF (o CI lê LF).
  assert.ok(!/\r(?!\n)/.test(auto), 'sem \\r solto');
});
