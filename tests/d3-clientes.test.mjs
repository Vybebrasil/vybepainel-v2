// Direção 3 (moodboard 3 aprovado em 13/11/2026), grupo "clientes": Saúde da carteira, Onboarding, Gestão de clientes,
// ficha e Reuniões. Confere o essencial de cada quadro no código e que o CSS novo segue as regras do padrão.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const carteira = ler('vybe-mundo-carteira.js'), clientes = ler('vybe-clientes.js'), reunioes = ler('vybe-clientes-reunioes.js'), css = ler('padrao-v2/d3-clientes.css');

test('Saúde da carteira: bloco de ação, quatro números com linha, lista com faixa do risco e "Tira ponto"', () => {
  const tela = carteira.slice(carteira.indexOf('  function abaSaude() {'), carteira.indexOf('  // Contas por head: quantos'));
  assert.match(carteira, /const d3Acao = \(o\) => \(typeof d3AcaoHtml === 'function' \? d3AcaoHtml\(o\) : ''\);/);
  for (const r of ['Nota média', 'Precisam de você', 'Tranquilos', 'Peças vencidas']) assert.ok(tela.includes(`numD3({ rotulo: '${r}'`), r);
  assert.match(tela, /linha: d3Linha\(serieMedia/);
  assert.match(tela, /<label class="d3c-sel"><span>Head:<\/span><select data-vc-head/);
  assert.match(tela, /class="d3c-pe-rot">Tira ponto/);
  assert.match(carteira, /<i class="d3c-faixa \$\{tom\}" aria-hidden="true"><\/i>/);
  // Vermelho só no que venceu.
  assert.match(carteira, /<span class="\$\{ehVencida\(m\) \? 'r' : ''\}"><b>−\$\{-m\.pontos\}<\/b>/);
});

test('Onboarding: quatro números, colunas no quadro e, ao lado, tempo de entrada em linha, etapas e configuração', () => {
  const tela = carteira.slice(carteira.indexOf('  function abaOnboarding() {'), carteira.indexOf('  // ---------- Churn ----------'));
  assert.match(tela, /numD3\(\{ rotulo: 'Concluídos no mês'/);
  assert.match(tela, /class="d3c-cab d3c-cab-onb"/);
  assert.match(tela, /aria-label="Tempo de entrada"[\s\S]{0,200}d3Linha\(/);
  assert.match(tela, /botao\('Configurar etapas', 'data-vc-ed-abrir'\)/, 'o editor de etapas continua');
  assert.match(tela, /data-vc-encerrados aria-expanded/, 'os encerrados continuam a um clique');
});

test('Gestão de clientes e ficha: bloco de ação, quatro números e "Novo cliente" sem laranja cheio', () => {
  assert.match(clientes, /aviso\.className = 'cli-aviso d3f-acao';/);
  for (const r of ['Ativos', 'Sem reunião registrada', 'Com NPS', 'Só na operação']) assert.ok(clientes.includes(`numero('${r}'`), r);
  assert.match(clientes, /class="v2f-btn p d3f-novo"/);
  assert.match(clientes, /<div class="v2f-alto d3f-alto">\$\{d3AcaoHtml\(/);
  assert.match(ler('padrao-v2/ficha.css'), /\.p\{background:var\(--d3-cartao,#FFFFFF\)/);
});

test('Reuniões: bloco de ação, quatro números ("No mês" em linha), Pede ação e lista em cartões separados', () => {
  assert.match(reunioes, /kpi\('No mês', doMes\.length/);
  assert.match(reunioes, /d3LinhaSvg\(serie/);
  assert.match(reunioes, /class="v2r-card v2r-pede"/);
  assert.doesNotMatch(reunioes, /class="v2r-sub v2r-rodape"/, 'sem frase explicativa no rodapé');
});

test('Conversas: bloco de ação pela menção não lida ou pela conversa com mais novas; continua só leitura', () => {
  const wa = ler('vybe-mundo-whatsapp.js');
  assert.match(wa, /function acaoD3\(porConversa\) \{/);
  assert.match(wa, /<\/div>\n      \$\{acaoD3\(porConversa\)\}/);
  assert.match(wa, /botao: 'Abrir', attrs: `data-wa-conversa=/);
  assert.match(wa, /Só leitura nesta etapa\. Para responder, use o seu WhatsApp\./);
  assert.doesNotMatch(wa, /method: 'POST'/, 'nada envia');
  assert.match(css, /#vv-whatsapp \.d3w \.v2w-bl\.eu\{background:var\(--d3-tinta\)/);
});

test('Contratos e Churn: bloco de ação, quatro números, tabela com "Até renovar" e "Quem saiu", gráficos em linha', () => {
  const ct = carteira.slice(carteira.indexOf('  function abaContratos() {'), carteira.indexOf('  // ---------- janela ----------'));
  const ch = carteira.slice(carteira.indexOf('  function abaChurn() {'), carteira.indexOf('  // Como o churn é contado'));
  assert.match(carteira, /const d3AcaoOu = \(ag, frase, rotulo = '', attrs = ''\) => \(typeof d3AcaoHtml === 'function'/);
  for (const r of ['Em contratos', 'Renovam em 30 dias', 'Tempo de casa', 'Sem contrato']) assert.ok(ct.includes(`numD3({ rotulo: '${r}'`), r);
  for (const r of ['Taxa de churn', 'Saídas', 'Receita perdida', 'Até sair']) assert.ok(ch.includes(`numD3({ rotulo: '${r}'`), r);
  assert.match(ct, /<span>Até renovar<\/span>/);
  assert.match(ct, /d3Linha\(valores/, 'mês a mês em linha');
  assert.match(ch, /<span>Motivo<\/span><span>Na casa<\/span><span>Por mês<\/span>/);
  assert.doesNotMatch(ch, /barrasMes\(/, 'sem gráfico de barras');
  // O que vai ao servidor não muda.
  assert.equal((carteira.match(/acao: 'contrato_salvar'|acao: 'churn_registrar'/g) || []).length, 2);
});

test('CSS da Direção 3 do grupo: tokens, id da janela, sem !important nem html body.mundo', () => {
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  for (const linha of css.split('\n')) if (/^\s*[#.]/.test(linha) && linha.includes('{')) assert.match(linha, /^\s*#(vv-carteira|painel-clientes|vv-reunioes|vv-whatsapp)/, linha.slice(0, 80));
  assert.match(css, /var\(--d3-areia\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
