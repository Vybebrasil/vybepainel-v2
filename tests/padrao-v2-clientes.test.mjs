import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Padrão v2 (12/11/2026): Saúde da carteira, Onboarding e Conversas são os quadros DEPOIS do moodboard aprovado.
const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const carteira = ler('vybe-mundo-carteira.js'), wa = ler('vybe-mundo-whatsapp.js'), css = ler('padrao-v2/clientes.css');
const naOrdem = (texto, partes) => { let p = -1; for (const parte of partes) { const i = texto.indexOf(parte, p + 1); assert.ok(i > p, parte); p = i; } };

test('Saúde da carteira segue a ordem do quadro: visão e ajuda no título, fala, três números, filtros e a lista', () => {
  const tela = carteira.slice(carteira.indexOf('  function abaSaude() {'), carteira.indexOf('  // Contas por head: quantos'));
  assert.ok(tela.length > 2000);
  // Direção 3: quatro números (com Peças vencidas), o head como seletor na barra e a lista com cabeçalho e rodapé "Tira ponto".
  naOrdem(tela, ["[['agora', 'Agora'], ['meses', 'Mês a mês']]", "botao('Como a nota é feita'", "rotulo: 'Nota média'", "rotulo: 'Precisam de você'", "rotulo: 'Tranquilos'", "rotulo: 'Peças vencidas'",
    "['precisam', 'Precisam de você'], ['todos', 'Todos'], ['alto', 'Risco alto'], ['medio', 'Risco médio'], ['baixo', 'Risco baixo']", '<select data-vc-head', "botao('Filtros'", 'class="d3c-cab"', 'Tira ponto', '${ajuda}${falaDaSaude(r)}${numeros}${filtros}', 'class="v2c-card v2c-quadro"']);
  assert.match(carteira, /precisam: 'Quem precisa de você, e por quê'/);
  assert.doesNotMatch(tela, /a barra mostra o que tirou ponto/, 'sem legenda');
  // O que saiu do alto continua a um clique: média mês a mês (em linha) e contas por head em "Mês a mês"; a ordem em "Filtros".
  assert.match(tela, /if \(estado\.visao === 'meses'\) \{[\s\S]{0,300}serieHtml\(h\)[\s\S]{0,200}contasHtml\(contas\)/);
  assert.match(tela, /estado\.filtros \? `<div class="v2c-card v2c-painel">\$\{ordemHtml\('saude'/);
  assert.match(carteira, /function serieHtml\(h\) \{[\s\S]{0,700}d3Linha\(/, 'gráfico em linha');
  for (const velho of ['vc-resumo', 'Clientes prioritários', 'vc-chips']) assert.ok(!tela.includes(velho), `saiu ${velho}`);
});

test('a fala é do Mateus e diz a causa que mais tira ponto; "Ver as N peças" leva às Demandas atrasadas', () => {
  assert.match(carteira, /const AGENTE = \{ nome: 'Mateus', papel: 'Atendimento ao cliente' \};/);
  // Direção 3: a fala é o bloco de ação laranja numa frase só.
  assert.match(carteira, /d3Acao\(\{ frase: `\$\{plural\(vencidas, 'vencida', 'vencidas'\)\} em \$\{plural\(n, 'cliente', 'clientes'\)\}[\s\S]{0,200}a nota vai de/);
  assert.match(carteira, /botao: vencidas === 1 \? 'Ver a peça' : `Ver as \$\{vencidas\}`, attrs: 'data-vc-atrasadas'/);
  assert.match(carteira, /if \('vcAtrasadas' in d\) \{[\s\S]{0,260}chooseManagerMode\('demandas'\)[\s\S]{0,260}focarAtrasadas\(\)/);
});

test('a linha do cliente: nota, quem é, a barra do que tirou ponto e a ação; abre no lugar sem redesenhar', () => {
  const linha = carteira.slice(carteira.indexOf('  function linhaCliente('), carteira.indexOf('  // Mini painel dos números'));
  // Direção 3: faixa do risco, nota, cliente, head, risco em pílula com bolinha e o que tirou ponto em texto curto.
  naOrdem(linha, ['class="v2-abre v2c-linha', 'class="d3c-faixa ', 'class="v2c-nota ', 'class="v2c-quemc"', 'class="d3c-head"', 'class="d3c-pill"', 'class="d3c-perdas"', 'class="v2c-ac"', 'class="v2-mais"', 'class="v2c-mot"']);
  assert.match(linha, /`Abrir as \$\{vencidas\}`/);
  assert.match(carteira, /function alternarLinha\(chave, focar = ''\) \{[\s\S]{0,420}linha\.setAttribute\('aria-expanded', String\(abrindo\)\);/);
  assert.match(carteira, /if \(d\.vcAbrir\) return alternarLinha\(d\.vcAbrir, d\.vcFocar \|\| ''\);/);
});

test('Onboarding segue a prancha V2-M-Onboarding: busca, Como funciona e Novo onboarding no alto, fichas das etapas, a folha de quem entra e o vidro', () => {
  const tela = carteira.slice(carteira.indexOf('  function abaOnboarding() {'), carteira.indexOf('  // ---------- Churn ----------'));
  // Prancha V2 (16/11/2026): o alto, as fichas das etapas (filtram), a folha dos clientes (pede ação antes de andando), quanto
  // cada etapa demora com o pé "De olho" e, no vidro, o laranja, o questionário do cliente em foco e "Abrir".
  naOrdem(tela, ['data-vc-busca-onb', 'data-vc-como aria-expanded', 'data-vc-novo aria-expanded', 'class="ob2-fichas"', 'data-vc-etapa-onb="${ligada ?', 'class="ob2-chip" data-vc-etapa-onb=',
    "linhaOnboarding(o, etapas, i ? '' : 'Agora')", "linhaOnboarding(o, etapas, i ? '' : 'Andando')", "linhaOnboarding(o, etapas, i ? '' : 'Encerrados')", 'Quanto cada etapa demora', 'De olho',
    "laranja('parado na entrada'", "consulta('O questionário'", "vlin('Configurar as etapas'",
    'corpo: `<div class="fv2-duas ob2-duas"><div class="fv2-col">${iniciar}${fichas}${folhaLista}${folhaEtapas}</div><aside class="d3m-lado fv2-lado" aria-label="Consulta">${lado}${pe}</aside></div>`']);
  const linha = carteira.slice(carteira.indexOf('  function linhaOnboarding('), carteira.indexOf('  function editorEtapasHtml() {'));
  naOrdem(linha, ['class="v2-abre ob2-linha', 'class="ob2-abrir" data-vc-abrir=', '${rot}${fotoCli(', 'class="ob2-nm"', '${trilha}${etapa}${dias}${head}', 'class="ob2-ac"', 'class="v2-mais"']);
  // Nada some: encerrados e o editor de etapas no vidro; os dois caminhos em "Novo onboarding"; kickoff, questionário e ficha na linha aberta.
  assert.match(tela, /data-vc-encerrados aria-expanded/);
  assert.match(tela, /vlin\('Configurar as etapas', '', 'data-vc-ed-abrir'\)/);
  assert.match(tela, /data-vc-onb-novo><b>Cliente novo<\/b>[\s\S]{0,400}data-vc-contrato-novo/);
  assert.match(tela, /data-vc-quest="link" data-vc-cli=[\s\S]{0,200}data-vc-quest="junto" data-vc-cli=/, 'o questionário do cliente em foco no vidro');
  for (const a of ["btnOb('Reunião de kickoff'", "btnOb('Questionário com o cliente'", "btnOb('Link do questionário'", "btnOb('Ficha'", "btnOb('Encerrar onboarding'", "btnOb('Definir responsável'", "btnOb('Reabrir'"]) assert.ok(linha.includes(a), a);
  assert.match(linha, /data-vc-item="\$\{esc\(it\.id\)\}" data-vc-etapa="\$\{esc\(e\.id\)\}" data-vc-cli=/, 'o checklist grava pelo caminho de sempre');
  assert.match(linha, /data-vc-resp="\$\{esc\(o\.cliente_id\)\}" data-vc-etapa=/, 'o responsável grava pelo caminho de sempre');
  assert.match(carteira, /if \('vcAjuda' in d \|\| 'vcComo' in d\) \{ estado\.ajuda = !estado\.ajuda; return pintar\(\); \}/);
  assert.match(carteira, /if \('vcReunioes' in d\) \{ fechar\(\{ foco: false \}\); return window\.VybeReunioes\?\.abrir\?\.\(\); \}/);
});

test('Conversas segue o quadro: título, de onde vem e as visões; cartão da lista e cartão da conversa; continua só leitura', () => {
  const tela = wa.slice(wa.indexOf('  function pintar({ rolar = false } = {}) {'), wa.indexOf('  // ---------- Interação ----------'));
  naOrdem(tela, ['<h2>Conversas</h2>', 'WhatsApp da Vybe · ', 'class="v2w-seg"', 'data-wa-aba="conversas"', 'data-wa-aba="mencoes"', 'class="v2w-card v2w-lista"', 'data-wa-busca', "['todos', 'Todos'], ['interno', 'Internos'], ['cliente', 'Clientes'], ['naolidas', 'Não lidas']", 'id="vv-wa-itens"', 'class="v2w-card v2w-conversa"']);
  assert.match(tela, /<p class="v2w-rot">Não lidas · \$\{novas\.length\}<\/p>/);
  assert.match(tela, /<p class="v2w-rot">Já vistas<\/p>/);
  assert.match(tela, /data-wa-todas>mostrar<\/button>/);
  assert.match(tela, /class="v2w-bl\$\{m\.minha \? ' eu' : ''\}\$\{m\.vybes \? ' agt' : ''\}/);
  assert.match(tela, /data-wa-procurar aria-expanded="\$\{Boolean\(st\.procurando\)\}" aria-label="Buscar na conversa"/);
  // Direção 3 (D3-Conversas): "Abrir no WhatsApp" no topo da conversa; o convite do grupo ou o WhatsApp Web.
  assert.match(tela, /class="v2w-btn v2w-abrir-wa" href="\$\{esc\(linkDoWhatsapp\(c\)\)\}" target="_blank" rel="noopener noreferrer">Abrir no WhatsApp<\/a>/);
  assert.match(wa, /https:\/\/web\.whatsapp\.com\//);
  assert.match(tela, /Só leitura nesta etapa\. Para responder, use o seu WhatsApp\./);
  assert.doesNotMatch(wa, /method: 'POST'|🚫 Mensagem apagada<\/span>/, 'nada envia; o balão apagado não usa emoji');
  assert.doesNotMatch(tela, /vv-wa-topo|vv-wa-abas|vv-wa-item/, 'a tela antiga saiu');
});

test('o CSS do grupo ganha pelo id da janela, sem !important nem html body.mundo, com as medidas do quadro', () => {
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  for (const linha of css.split('\n')) if (/^\s*[#.]/.test(linha) && linha.includes('{')) assert.match(linha, /^\s*#vv-(carteira|whatsapp)/, linha.slice(0, 80));
  assert.match(css, /#vv-carteira \.v2c-card\{[^}]*border-radius:20px;background:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))/);
  assert.match(css, /#vv-carteira \.v2c-chip\[aria-pressed="true"\]\{background:(?:#1F1D1A|var\(--d3-(?:tinta|fume-contra|tinta-fixa)(?:,[^)]*\))?\));color:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))/);
  assert.match(css, /#vv-carteira \.v2c-btn\.p\{background:#C2490C/);
  assert.match(css, /#vv-carteira \.v2c-kpi > b\{[^}]*font:700 34px/);
  assert.match(css, /#vv-whatsapp \.v2w-grade\{[^}]*grid-template-columns:380px minmax\(0,1fr\)/);
  assert.match(css, /#vv-whatsapp \.v2w-bl\.eu\{[^}]*background:#FFE9DB/);
  assert.match(css, /#vv-whatsapp \.v2w-bl\.agt\{background:var\(--d3-agente-veu\)\}/, 'balão do agente no véu lilás (token da Direção 3)');
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('CSS dos módulos V2 do grupo B (zm-b-modulos.css): janela de vidro só no Onboarding, só tokens, sem !important nem animação que nasce invisível', () => {
  const v2 = ler('padrao-v2/zm-b-modulos.css');
  assert.doesNotMatch(v2, /!important|html body\.mundo|:has\(|@keyframes/);
  assert.doesNotMatch(v2.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b/, 'cor só por token --d3-*');
  assert.match(v2, /#vv-carteira\.ob2-janela,\.vc-camada > #vv-reunioes\.rv2-janela\{[^}]*background:var\(--d3-fume\)/);
  assert.match(v2, /:is\(#vv-carteira,#vv-reunioes\) :is\(\.ob2,\.rv2\) \.fv2-duas\{[^}]*grid-template-columns:minmax\(0,1fr\) 316px/);
  // A janela não ganha position (a regra global do dock põe bottom nela com !important; relative a deslocaria).
  assert.doesNotMatch(v2, /#vv-carteira\.ob2-janela[^{]*\{[^}]*position:/);
  assert.match(carteira, /j\.classList\?\.\[estado\.aba === 'onboarding' \? 'add' : 'remove'\]\?\.\('ob2-janela'\)/);
});
