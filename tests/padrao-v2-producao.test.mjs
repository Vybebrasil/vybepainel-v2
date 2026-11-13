import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Padrão v2 · Produção (12/11/2026): Planejamentos, Impressões, Toolkit e a Fila do Danilo seguem os quadros DEPOIS do moodboard.
const ler = (f) => fs.readFileSync(f, 'utf8');
const plj = ler('vybe-mundo-planejamentos.js'), imp = ler('vybe-mundo-impressoes.js'), fer = ler('vybe-mundo-ferramentas.js'), cri = ler('vybe-mundo-criacao.js');
const css = ler('padrao-v2/producao.css');

test('o fragmento de CSS não força nada: sem !important e sem html body.mundo', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  // As medidas do quadro: cartão branco de raio 20, botão 38 e 30, ficha escolhida preta, ação #C2490C.
  assert.match(css, /\.p2-card\{[^}]*border-radius:20px;background:#FFFFFF/);
  assert.match(css, /\.p2-btn\{[^}]*height:38px[^}]*border-radius:999px/);
  assert.match(css, /\.p2-btn\.s\{height:30px/);
  assert.match(css, /\.p2-btn\.p\{background:#C2490C;color:#FFFFFF/);
  assert.match(css, /\.p2-chip\.p2-chip:is\(\[aria-pressed="true"\],\[aria-checked="true"\]\)\{background:#1F1D1A;color:#FFFFFF/);
  assert.match(css, /#vv-planejamentos\.vv-plj\{gap:16px;padding:26px 30px;border:0;background:#F9F8F5/);
});

test('Planejamentos: mês e "Novo planejamento" no alto, frase do Augusto, três números, uma barra de filtro e "Pede ação" primeiro', () => {
  assert.match(plj, /janela\.id = 'vv-planejamentos';/);
  assert.match(plj, /cabecalho\(\{ titulo: 'Planejamentos', acoes: `\$\{seg\}\$\{novo\}\$\{botaoX\('data-plj-fechar'\)\}` \}\)/);
  assert.match(plj, /<summary class="p2-btn p">Novo planejamento<\/summary>/);
  assert.match(plj, /<span class="p2-quem">Augusto · Copy e conteúdo<\/span>/);
  for (const t of ['Com planejamento', 'Pedem ação', 'Sem planejamento']) assert.ok(plj.includes(`<small>${t}</small>`), t);
  assert.match(plj, /\$\{ficha\('meus', 'Meus clientes'\)\}\$\{ficha\('acao', 'Pedem ação'\)\}\$\{ficha\('sem', 'Sem planejamento'\)\}\$\{ficha\('todos', 'Todos'\)\}/);
  assert.match(plj, /filtro: 'todos'/, 'abre em Todos, como no quadro');
  assert.match(plj, /const titulo = coisas \? 'Pede ação'/);
  // A linha que pede ação abre no lugar com as etapas e "Abrir como documento"; as outras têm só "Abrir".
  assert.match(plj, /class="v2-abre p2-abre" data-plj-linha=/);
  assert.match(plj, /data-plj-aba="historico">Histórico<\/button>/);
  assert.match(plj, /class="p2-btn s k" data-plj-abrir="\$\{esc\(pl\.id\)\}" data-plj-aba="editar">Editar e revisar<\/button>/);
  assert.match(plj, />Abrir como documento<\/button>/);
  assert.match(plj, /Criar os \$\{n\}<\/button>/);
  assert.match(plj, /Abrir mostra o documento; revisar, aprovar e mandar pelo WhatsApp com o aviso do Hub ficam dentro dele\./);
  // Nada de planejamento novo aqui: as portas são as de sempre.
  assert.match(plj, /window\.abrirPlanejamento\(b\.dataset\.pljAbrir, b\.dataset\.pljAba \|\| 'documento'\)/);
  assert.match(plj, /window\.novoPlanejamento\(b\.dataset\.pljNovo, b\.dataset\.pljNome \|\| ''\)/);
});

test('Planejamentos: filtrar e ordenar continuam com a mesma regra', () => {
  const ctx = { window: {}, document: { addEventListener() {}, createElement: () => ({ setAttribute() {}, addEventListener() {} }), body: { append() {}, classList: { add() {}, remove() {} } } }, console };
  ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(plj, ctx);
  const P = ctx.window.VybePlanejamentos, postos = [{ cliente: 'B', planejamento: { estado: 'aprovado' } }, { cliente: 'A', meu: true, planejamento: { estado: 'ajustes' } }, { cliente: 'C', planejamento: null }];
  assert.deepEqual([...P._ordenar(postos)].map((p) => p.cliente), ['A', 'B', 'C']);
  assert.deepEqual([...P._filtrar(postos, 'acao')].map((p) => p.cliente), ['A']);
  assert.deepEqual([...P._filtrar(postos, 'sem')].map((p) => p.cliente), ['C']);
  assert.deepEqual([...P._filtrar(postos, 'meus')].map((p) => p.cliente), ['A']);
});

test('Impressões: frase do Nestor, três números, baralho do que espera um ok e uma linha por peça com as etapas', () => {
  assert.match(imp, /<span class="p2-quem">Nestor · Compras, fornecedores e impressões<\/span>/);
  for (const t of ['Abertas', 'Atrasadas', 'Sem fornecedor']) assert.ok(imp.includes(`<small>${t}</small>`), t);
  assert.match(imp, /<div class="v2-baralho vi2-baralho" aria-live="polite">/);
  assert.match(imp, /data-vi="agora-nao">Agora não<\/button><button type="button" class="p2-btn k v2-estado" data-vi-decidir="atual">Aprovar<\/button>/);
  assert.match(imp, /seta para os lados passa/);
  assert.match(imp, /data-vi="deck-lista">ver em lista<\/button>/);
  // O baralho só leva decisão que o sistema já tem: cotação sem escolha (gestão) e gráfica sugerida.
  assert.match(imp, /const cots = d\.gestao && Array\.isArray\(i\.cotacoes\) \? i\.cotacoes : \[\];/);
  assert.match(imp, /gravar\(\{ acao: 'cotacao_escolher', id: x\.c\.id \}/);
  assert.match(imp, /st\.form = \{ \.\.\.x\.i, fornecedor_id: x\.s\.fornecedor_id \}; pintar\(\);/, 'a sugerida abre a edição; só grava ao salvar');
  assert.match(imp, /placeholder="Buscar peça, cliente ou fornecedor" data-vi-busca/);
  assert.match(imp, /\$\{chip\('', 'Abertas', nA\)\}\$\{chip\('atrasadas', 'Atrasadas', nAt\)\}\$\{chip\('semfornecedor', 'Sem fornecedor', nS\)\}/);
  assert.match(imp, /<span class="vi2-tri" role="img" aria-label="Etapa \$\{k \+ 1\} de \$\{et\.length\}/);
  assert.match(imp, /\$\{aberta \? ficha\(\) : ''\}/, 'a ficha de sempre abre no lugar da linha');
  assert.match(imp, /vista: 'linhas'/);
  assert.match(imp, /\$\{vista\('linhas', 'Linhas'\)\}\$\{vista\('etapas', 'Etapas'\)\}\$\{vista\('lista', 'Tabela'\)\}/, 'o quadro por etapa e a tabela continuam, em Filtros');
});

test('Toolkit: visão em pílulas com a busca, usados por último em cartões e as três ferramentas com o resultado no lugar', () => {
  assert.match(fer, /<span class="p2-seg" role="tablist" aria-label="Ferramentas do Toolkit">/);
  assert.match(fer, /placeholder="Buscar ferramenta" data-vf-busca/);
  assert.match(fer, /<span class="p2-quem">VYBES · Ferramentas rápidas<\/span>/);
  assert.match(fer, /<span class="p2-sub">neste computador · refaz com um clique<\/span>/);
  for (const t of ['data-vf-gerar="qr">Gerar QR<', 'data-vf-gerar="wa">Criar link<', 'data-vf-gerar="roi">Calcular<']) assert.ok(fer.includes(t), t);
  for (const t of ['Baixar de novo', 'Refazer', 'Gerar o primeiro QR', 'Nada usado ainda neste computador.']) assert.ok(fer.includes(t), t);
  const guardado = {};
  const ctx = { window: {}, localStorage: { getItem: (k) => guardado[k] ?? null, setItem: (k, v) => { guardado[k] = v; } }, console };
  ctx.window.addEventListener = () => {};
  vm.createContext(ctx); vm.runInContext(fer, ctx);
  const F = ctx.window.VybeFerramentas;
  assert.deepEqual({ ...F._retornoSimples('1.500', '6.300') }, { pct: 320, porReal: 4.2 });
  assert.equal(F._retornoSimples('', '100'), null);
  assert.equal(F._rotuloDoUso({ tipo: 'roi', dados: { investimento: '1.500', retorno: '6.300' } }).titulo, 'Retorno de 320%');
});

test('Direção de arte: a Fila do Danilo com Delegar, parada em dias e Cobrar; aprovar continua em dois cliques', () => {
  assert.match(cri, /<b>Fila do Danilo<\/b><small>\$\{plural\(delegacoes\.length, 'delegação', 'delegações'\)\} · \$\{plural\(cobrancas\.length, 'cobrança', 'cobranças'\)\}<\/small>/);
  assert.match(cri, /\[`Parada \$\{plural\(s\.parado, 'dia', 'dias'\)\}`, 'r'\]/);
  assert.match(cri, /\$\{tipo === 'delegar' \? 'Deixar como está' : 'Agora não'\}/);
  assert.match(cri, /data-vcr-confirmar="\$\{esc\(chave\)\}"/);
  assert.match(css, /#vv-hoje \.vcr-bloco\.vcr-fila\{[^}]*border-radius:20px;background:#FFFFFF/);
});
