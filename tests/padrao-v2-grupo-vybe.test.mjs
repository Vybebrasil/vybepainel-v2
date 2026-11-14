// Padrão v2 · grupo Vybe: Loja e Conquistas, Ranking e Jogos, e a bandeja de decorar da Minha sala,
// pelos quadros "Depois" do moodboard (12/11/2026). O essencial do que cada tela monta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = ler('padrao-v2/grupo-vybe.css');
const loja = ler('vybe-escritorio-loja.js');
const editor = ler('vybe-escritorio-editor.js');
const ficha = ler('vybe-escritorio-ficha.js');
const decorar = ler('vybe-mundo-decorar.js');
const fatia = (t, ini, fim) => { const a = t.indexOf(ini); assert.ok(a >= 0, 'não achei ' + ini); const b = t.indexOf(fim, a + ini.length); return t.slice(a, b < 0 ? undefined : b); };

test('CSS do grupo: sem !important, sem html body.mundo e tudo pelo id da janela', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  const seletores = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]+\{/g, '').replace(/@keyframes[^{]+\{[^}]*\}[^}]*\}/g, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);
  for (const s of seletores) for (const parte of s.split(/,(?![^(]*\))/)) assert.match(parte.trim(), /^(#office-catalogo|#ofc-ranking|#workflow-modal\.rk2-janela|#vv-decorar#vv-decorar)/, parte);
});

test('Loja: a casca do quadro (título, partes, três números, barra única, grade e conquistas)', () => {
  const casca = fatia(loja, 'function escritorioLojaCascaHtml(', '\nfunction escritorioLojaAbasHtml');
  for (const pedaco of ['<h1>Loja</h1>', 'id="office-catj-abas"', 'id="v2l-kpis"', 'id="v2l-busca"', 'id="v2l-chips"', 'id="v2l-painel"', 'id="office-catj-grade"', 'id="v2l-conq"', 'id="office-catj-ficha"']) assert.ok(casca.includes(pedaco), pedaco);
  assert.ok(casca.indexOf('v2l-kpis') < casca.indexOf('v2l-busca') && casca.indexOf('v2l-busca') < casca.indexOf('office-catj-grade') && casca.indexOf('office-catj-grade') < casca.indexOf('v2l-conq'), 'ordem do quadro');
  const abas = fatia(loja, 'function escritorioLojaAbasHtml(', '\n// Quantas peças cabem');
  assert.match(abas, /aba\("Loja", "loja"\) \+ aba\("Inventário", "inventario".*aba\("Carteira", "carteira"\) \+ aba\("Conquistas", "conquistas"\)/);
  assert.doesNotMatch(abas, /role="tab"|aria-selected/, 'a parte escolhida não pode cair na regra antiga que a pinta de preto');
  const kpis = fatia(loja, 'function escritorioLojaKpisHtml(', '\n// A barra de filtro única');
  for (const rotulo of ['Seu saldo', 'Seus troféus', 'Próximo troféu', 'sua estante', 'para subir']) assert.ok(kpis.includes(rotulo), rotulo);
  assert.match(editor, /d\.innerHTML = escritorioLojaCascaHtml\(escritorio\.cat\);/);
  assert.match(editor, /d\.className = "ofc-dialogo ofc-catjanela v2l-janela";/);
});

test('Loja: uma barra de filtro só, e o que saiu dela continua em Filtros', () => {
  const chips = fatia(loja, 'function escritorioLojaChipsHtml(', '\nfunction escritorioLojaPainelHtml');
  for (const ficha_ of ['>Destaques<', 'Jogos · ', 'Vitrine · ', '>Cabe no saldo<', '>Filtros']) assert.ok(chips.includes(ficha_), ficha_);
  const painel = fatia(loja, 'function escritorioLojaPainelHtml(', '\nfunction escritorioLojaPintarFiltros');
  for (const grupo of ['Categorias', 'Raridade', 'Ordem', 'Desejos', 'Vistos por você', 'Mais baratos', 'Mais raros']) assert.ok(painel.includes(grupo), grupo);
  const desenha = fatia(editor, 'function desenharCatalogoJanelaEscritorio()', '\n// Ordem da Loja e do inventário em chips');
  assert.doesNotMatch(desenha, /ofc-cat-chip r-/, 'as faixas de raridade não voltam a ser uma segunda barra');
  assert.match(desenha, /escritorioLojaPintarFiltros\(d, Boolean\(capa\), faixas, conta\)/);
  assert.match(desenha, /escritorioItemLojaHtml\(m, \{ troca \}\)/);
});

test('Loja: o item tem o botão na linha e o botão mostra o estado da compra', () => {
  const item = fatia(loja, 'function escritorioItemLojaHtml(', '\nfunction escritorioKitLojaHtml');
  for (const texto of ['>Comprar<', '>Ver na vitrine<', '"Desejar"', '"Seu"', 'Troca em ', 'class="v2l-preco', 'v2-estado']) assert.ok(item.includes(texto), texto);
  assert.ok(item.includes("abrirPreviaMovelEscritorio('${classe}')"), 'a ficha do móvel continua a um clique na arte');
  const comprar = fatia(loja, 'async function escritorioComprarNaLoja(', '\nfunction escritorioDesejarNaLoja');
  assert.match(comprar, /botao\.dataset\.estado = "indo"/);
  assert.match(comprar, /await escritorioAcaoMovel\(classe, true, 1, false\)/, 'a compra é a de sempre, validada no servidor');
  assert.match(comprar, /botao\.dataset\.estado = "feito"/);
  assert.match(comprar, /delete botao\.dataset\.estado/, 'compra que não sai devolve o botão');
  const capa = fatia(loja, 'function escritorioCapaLojaHtml()', '\n// Venda à loja');
  assert.match(capa, /Jogos com a equipe/); assert.match(capa, /loja\?\.vitrine/); assert.match(capa, /kits\.map\(escritorioKitLojaHtml\)/);
});

test('Conquistas: moram na Loja, com a escada que abre no lugar, o título e a estante', () => {
  const conq = fatia(loja, 'function escritorioConquistasLojaHtml(', '\nfunction redesenharConquistasLoja');
  for (const texto of ['<h2>Conquistas</h2>', 'as mais perto de subir primeiro', 'Perto de subir', 'class="v2-abre v2l-esc"', 'class="v2-mais"', 'class="v2l-niv"', 'Seu título no mapa', 'Trocar título · ', 'Sua estante', 'Completa', 'escolherTituloEscritorio(']) assert.ok(conq.includes(texto), texto);
  assert.match(conq, /ESCRITORIO_GRUPOS_CONQUISTA/, 'os mesmos grupos da janela antiga');
  const abrir = fatia(ficha, 'async function abrirConquistasEscritorio()', '\nfunction pintarConquistasEscritorio');
  assert.match(abrir, /abrirCatalogoEscritorio\("conquistas"\); return;/);
  assert.match(ficha, /if \(typeof redesenharConquistasLoja === "function"\) redesenharConquistasLoja\(\);/);
  assert.match(loja, /function escritorioAbrirEscadaLoja\(botao, id\)/);
});

test('Ranking: título com período e porquê numa linha, fichas, pódio, você, lista curta e jogos ao lado', () => {
  const pinta = fatia(ficha, 'function pintarRankingEscritorio()', '\n// A barra "Você" fica fixa embaixo');
  for (const texto of ['<h1>Ranking</h1>', 'class="v2r-seg"', 'Por que essa ordem?', 'class="v2r-chips"', 'Atividade · ', 'class="v2r-card v2r-podio"', 'class="v2r-voce"', 'De onde veio o XP', 'class="v2r-card v2r-lista"', '>mostrar<', 'conquistas e prêmios da Copa não contam no XP', 'escritorioJogosRankingHtml()']) assert.ok(pinta.includes(texto), texto);
  assert.doesNotMatch(pinta, /rk2-camp|rk2-periodos|rk2-regra/, 'os cartões de campeão e a faixa de período antigos saíram');
  assert.match(pinta, /resto\.slice\(0, 2\)/, 'duas linhas à vista; o resto em "mostrar"');
  for (const fica of ['Tesouros', 'Agência', 'Como funciona', 'Semana passada', 'Copa Vybe de ', 'abrirDetalheRankingEscritorio(']) assert.ok(pinta.includes(fica), 'continua a um clique: ' + fica);
  const jogos = fatia(ficha, 'const V2R_JOGOS = [', '\n// O detalhe abre num cartão ao lado da pessoa');
  for (const texto of ['Sinuca', 'Xadrez', 'Pôquer', 'Dominó', 'Dama', 'Velha', 'Truco', 'Jogos · terraço', ' online', 'Online: ', '>Chamar<']) assert.ok(jogos.includes(texto), texto);
  assert.match(jogos, /window\.mundoVoxel\.jogar\(id\)/, 'a partida abre pela mesma função do mundo');
});

test('Minha sala: decorar é uma bandeja com fichas, itens em fileira, Loja no fim e Salvar a sala', () => {
  assert.match(decorar, /class="v2s-chips" role="group"/);
  assert.match(decorar, /Meus itens\$\{conta == null/);
  assert.doesNotMatch(fatia(decorar, 'function htmlAbas()', 'function htmlBarra()'), /role="tab"/);
  assert.match(decorar, /class="vv-decorar-peca v2s-loja" data-vd-acao="loja"/);
  assert.match(decorar, /'Salvar a sala'/);
  assert.match(decorar, /class="v2s-modo">Modo decorar/);
  assert.match(decorar, /<div class="v2s-linha">\$\{htmlAbas\(\)\}\$\{htmlBarra\(\)\}\$\{htmlRodape\(\)\}<\/div>/);
  for (const acao of ['data-vd-acao="girar"', 'data-vd-acao="guardar"', 'data-vd-acao="desfazer"', 'data-vd-acao="sair"', 'data-vd-acao="salvar"']) assert.ok(decorar.includes(acao), acao);
});

test('medidas do padrão no CSS: cartão de raio 20, ficha preta, parte escolhida branca', () => {
  assert.match(css, /#office-catalogo \.v2l-card\{[^}]*border-radius:20px;background:#FFFFFF/);
  assert.match(css, /#office-catalogo \.v2l-chip\[aria-pressed="true"\]\{background:#1F1D1A;color:#FFFFFF/);
  assert.match(css, /#office-catalogo \.v2l-seg > button\[aria-pressed="true"\]\{background:#FFFFFF;color:#1F1D1A/);
  assert.match(css, /#ofc-ranking \.v2r-voce\{[^}]*background:#1F1D1A;color:#FFFFFF/);
  assert.match(css, /#ofc-ranking \.v2r-corpo\{[^}]*grid-template-columns:minmax\(0,1\.3fr\) minmax\(0,1fr\)/);
  assert.match(css, /#office-catalogo \.v2l-corpo\{[^}]*grid-template-columns:minmax\(0,1\.4fr\) minmax\(0,1fr\)/);
});
