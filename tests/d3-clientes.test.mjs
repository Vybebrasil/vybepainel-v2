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
  // (o title do teto, auditoria 15/11 item 33, fica entre a classe e o número)
  assert.match(carteira, /<span class="\$\{ehVencida\(m\) \? 'r' : ''\}"\$\{noTeto\(m\)[^\n]*?><b>−\$\{-m\.pontos\}<\/b>/);
});

test('Onboarding: quatro números, colunas no quadro e, ao lado, tempo de entrada em linha, etapas e configuração', () => {
  const tela = carteira.slice(carteira.indexOf('  function abaOnboarding() {'), carteira.indexOf('  // ---------- Churn ----------'));
  assert.match(tela, /numD3\(\{ rotulo: 'Concluídos no mês'/);
  assert.match(tela, /class="d3c-cab d3c-cab-onb"/);
  assert.match(tela, /aria-label="Tempo de entrada"[\s\S]{0,200}d3Linha\(/);
  assert.match(tela, /botao\('Configurar etapas', 'data-vc-ed-abrir'\)/, 'o editor de etapas continua');
  assert.match(tela, /data-vc-encerrados aria-expanded/, 'os encerrados continuam a um clique');
});

test('Clientes na Direção V2: cartão laranja do Mateus, o pé "De olho" no lugar dos quatro números e "Novo cliente" branco no vidro', () => {
  assert.match(clientes, /class="d3-acao d3m-laranja cv2-laranja"/);
  for (const r of ['sem próxima reunião', 'com cadastro incompleto', 'com NPS']) assert.ok(clientes.includes(r), r);
  assert.match(clientes, /class="cv2-novo d3f-novo" onclick="novoClienteNoPainel\(\)"/);
  assert.match(clientes, /class="d3-acao d3m-laranja cv2-laranja fv2-laranja"/, 'a ficha usa o mesmo cartão laranja');
  assert.match(ler('padrao-v2/zm-b-clientes.css'), /#painel-clientes \.cv2-novo\{[^}]*background:var\(--d3-fume-texto\)/);
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

test('Contratos e Churn: saíram do quadro da Direção 3 para as pranchas V2-M (laranja, folhas e coluna de consulta); o envio não muda', () => {
  const ct = carteira.slice(carteira.indexOf('  function abaContratos() {'), carteira.indexOf('  // ---------- janela ----------'));
  const ch = carteira.slice(carteira.indexOf('  function abaChurn() {'), carteira.indexOf('  // Como o churn é contado'));
  assert.match(carteira, /const TELAS_M = new Set\(\['contratos', 'churn'\]\);/);
  assert.match(carteira, /if \(TELAS_M\.has\(estado\.aba\)\) return htmlDaJanelaM\(\);/);
  for (const r of ['larMq(AGENTE_CONTRATOS', '<small>De olho</small>', 'em contratos, por mês', 'tempo de casa', 'sem contrato</button>']) assert.ok(ct.includes(r), r);
  for (const r of ['larMq(AGENTE_CHURN', "rotulo: 'Receita perdida'", "rotulo: 'Tempo até sair'", '<b>Em risco agora</b>']) assert.ok(ch.includes(r), r);
  assert.match(ct, /d3Linha\(valores/, 'mês a mês em linha');
  assert.match(ch, /<span>Motivo<\/span>\$\{din \? '<span class="d3m-d-ch-v">Por mês<\/span>' : ''\}<span class="d3m-d-ch-v">Ficou<\/span>/, 'a coluna "Por mês" só entra para quem vê dinheiro');
  assert.doesNotMatch(ch, /barrasMes\(/, 'sem o gráfico de barras de antes');
  // O que vai ao servidor não muda.
  assert.equal((carteira.match(/acao: 'contrato_salvar'|acao: 'churn_registrar'/g) || []).length, 2);
});

test('CSS da Direção 3 do grupo: tokens, id da janela, sem !important nem html body.mundo', () => {
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  for (const linha of css.split('\n')) if (/^\s*[#.]/.test(linha) && linha.includes('{')) assert.match(linha, /^\s*#(vv-carteira|painel-clientes|vv-reunioes|vv-whatsapp)/, linha.slice(0, 80));
  assert.match(css, /var\(--d3-areia\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
