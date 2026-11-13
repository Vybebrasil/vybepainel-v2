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
  naOrdem(tela, ["[['agora', 'Agora'], ['meses', 'Mês a mês']]", "botao('Como a nota é feita'", "rotulo: 'Nota média'", "rotulo: 'Precisam de você'", "rotulo: 'Tranquilos'",
    "['precisam', 'Precisam de você'], ['todos', 'Todos'], ['alto', 'Risco alto'], ['medio', 'Risco médio'], ['baixo', 'Risco baixo']", "botao('Filtros'", '${ajuda}${falaDaSaude(r)}${numeros}${filtros}', 'class="v2c-card v2c-quadro"']);
  assert.match(carteira, /precisam: 'Quem precisa de você, e por quê'/);
  assert.match(carteira, /a barra mostra o que tirou ponto de 100; o verde que sobra é a nota\./);
  // O que saiu do alto continua a um clique: média mês a mês e contas por head em "Mês a mês"; head e ordem em "Filtros".
  assert.match(tela, /if \(estado\.visao === 'meses'\) \{[\s\S]{0,300}serieHtml\(h\)[\s\S]{0,200}contasHtml\(contas\)/);
  assert.match(tela, /estado\.filtros \? `<div class="v2c-card v2c-painel"><label class="vc-ordem"><span>Head<\/span><select data-vc-head>/);
  for (const velho of ['vc-resumo', 'Clientes prioritários', 'vc-chips']) assert.ok(!tela.includes(velho), `saiu ${velho}`);
});

test('a fala é do Mateus e diz a causa que mais tira ponto; "Ver as N peças" leva às Demandas atrasadas', () => {
  assert.match(carteira, /const AGENTE = \{ nome: 'Mateus', papel: 'Atendimento ao cliente' \};/);
  assert.match(carteira, /Quem puxa para baixo é <b>\$\{esc\(causa\)\}<\/b>: \$\{quem\}\. Resolver/);
  assert.match(carteira, /if \('vcAtrasadas' in d\) \{[\s\S]{0,260}chooseManagerMode\('demandas'\)[\s\S]{0,260}focarAtrasadas\(\)/);
});

test('a linha do cliente: nota, quem é, a barra do que tirou ponto e a ação; abre no lugar sem redesenhar', () => {
  const linha = carteira.slice(carteira.indexOf('  function linhaCliente('), carteira.indexOf('  // Mini painel dos números'));
  naOrdem(linha, ['class="v2-abre v2c-linha', 'class="v2c-nota ', 'class="v2c-quemc"', 'class="v2c-perde"', 'class="v2c-leg"', 'class="v2c-ac"', 'class="v2-mais"', 'class="v2c-mot"']);
  assert.match(linha, /`Abrir as \$\{vencidas\}`/);
  assert.match(carteira, /function alternarLinha\(chave, focar = ''\) \{[\s\S]{0,420}linha\.setAttribute\('aria-expanded', String\(abrindo\)\);/);
  assert.match(carteira, /if \(d\.vcAbrir\) return alternarLinha\(d\.vcAbrir, d\.vcFocar \|\| ''\);/);
});

test('Onboarding segue o quadro: Como funciona e Novo onboarding, fala, três números, busca e etapas, Pede ação antes de Andando', () => {
  const tela = carteira.slice(carteira.indexOf('  function abaOnboarding() {'), carteira.indexOf('  // ---------- Churn ----------'));
  naOrdem(tela, ["botao('Como funciona'", "botao('Novo onboarding'", "rotulo: 'Em entrada'", 'rotulo: `Parados há mais de ${DIAS_PARADO} dias`', "rotulo: 'Tempo médio de entrada'",
    'data-vc-busca-onb', "ficha('Todas as etapas'", "botao('Filtros'", "secao('Pede ação'", "secao('Andando'", '${ajuda}${iniciar}${fala}${numeros}${filtros}<section class="v2c-card v2c-quadro"']);
  const linha = carteira.slice(carteira.indexOf('  function linhaOnboarding('), carteira.indexOf('  function editorEtapasHtml() {'));
  naOrdem(linha, ['class="v2c-st"', 'class="v2c-nm"', '${tri}', 'class="v2c-agora"', '${progresso}', 'class="v2c-ac"', 'class="v2-mais"']);
  // Nada some: encerrados e o editor de etapas em "Filtros"; os dois caminhos em "Novo onboarding"; kickoff, questionário e ficha na linha aberta.
  assert.match(tela, /data-vc-encerrados aria-expanded/);
  assert.match(tela, /botao\('Configurar etapas', 'data-vc-ed-abrir'\)/);
  assert.match(tela, /data-vc-onb-novo><b>Cliente novo<\/b>[\s\S]{0,400}data-vc-contrato-novo/);
  for (const a of ["botao('Reunião de kickoff'", "botao('Questionário com o cliente'", "botao('Link do questionário'", "botao('Ficha'", "botao('Encerrar onboarding'"]) assert.ok(linha.includes(a), a);
  assert.match(linha, /data-vc-item="\$\{esc\(it\.id\)\}" data-vc-etapa="\$\{esc\(e\.id\)\}" data-vc-cli=/, 'o checklist grava pelo caminho de sempre');
});

test('Conversas segue o quadro: título, de onde vem e as visões; cartão da lista e cartão da conversa; continua só leitura', () => {
  const tela = wa.slice(wa.indexOf('  function pintar({ rolar = false } = {}) {'), wa.indexOf('  // ---------- Interação ----------'));
  naOrdem(tela, ['<h2>Conversas</h2>', 'WhatsApp da Vybe · ', 'class="v2w-seg"', 'data-wa-aba="conversas"', 'data-wa-aba="mencoes"', 'class="v2w-card v2w-lista"', 'data-wa-busca', "['todos', 'Todos'], ['interno', 'Internos'], ['cliente', 'Clientes'], ['naolidas', 'Não lidas']", 'id="vv-wa-itens"', 'class="v2w-card v2w-conversa"']);
  assert.match(tela, /<p class="v2w-rot">Não lidas · \$\{novas\.length\}<\/p>/);
  assert.match(tela, /<p class="v2w-rot">Já vistas<\/p>/);
  assert.match(tela, /data-wa-todas>mostrar<\/button>/);
  assert.match(tela, /class="v2w-bl\$\{m\.minha \? ' eu' : ''\}\$\{m\.vybes \? ' agt' : ''\}/);
  assert.match(tela, /data-wa-procurar aria-expanded="\$\{Boolean\(st\.procurando\)\}">Buscar na conversa<\/button>/);
  assert.match(tela, /Só leitura nesta etapa\. Para responder, use o seu WhatsApp\./);
  assert.doesNotMatch(wa, /method: 'POST'|🚫 Mensagem apagada<\/span>/, 'nada envia; o balão apagado não usa emoji');
  assert.doesNotMatch(tela, /vv-wa-topo|vv-wa-abas|vv-wa-item/, 'a tela antiga saiu');
});

test('o CSS do grupo ganha pelo id da janela, sem !important nem html body.mundo, com as medidas do quadro', () => {
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  for (const linha of css.split('\n')) if (/^\s*[#.]/.test(linha) && linha.includes('{')) assert.match(linha, /^\s*#vv-(carteira|whatsapp)/, linha.slice(0, 80));
  assert.match(css, /#vv-carteira \.v2c-card\{[^}]*border-radius:20px;background:#FFFFFF/);
  assert.match(css, /#vv-carteira \.v2c-chip\[aria-pressed="true"\]\{background:#1F1D1A;color:#FFFFFF/);
  assert.match(css, /#vv-carteira \.v2c-btn\.p\{background:#C2490C/);
  assert.match(css, /#vv-carteira \.v2c-kpi > b\{[^}]*font:700 34px/);
  assert.match(css, /#vv-whatsapp \.v2w-grade\{[^}]*grid-template-columns:380px minmax\(0,1fr\)/);
  assert.match(css, /#vv-whatsapp \.v2w-bl\.eu\{[^}]*background:#FFE9DB/);
  assert.match(css, /#vv-whatsapp \.v2w-bl\.agt\{background:#EEEAFB\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
