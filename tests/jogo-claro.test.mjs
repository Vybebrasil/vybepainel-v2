// Redesign fase 3c, o jogo claro (Paulo, moodboard de 10/11/2026, quadros 35 a 38): nome em português para todo o
// catálogo, preço da Loja inteiro, Loja/Ranking/Conquistas no material claro sem forçar nada, retrato voxel dos móveis
// e Jogos/Equipe online como telas com conteúdo.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { nomeEmPortugues } = require('../shared/escritorio-nome-movel.js');
const catalogo = JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/catalogo.json', import.meta.url), 'utf8'));

test('nomes do catálogo: substantivo na frente, adjetivo concordando, aviso do Habbo fora', () => {
  const n = (nome, categoria = 'Casa') => nomeEmPortugues({ nome, classe: 'x', categoria });
  assert.equal(n('Blue Couch'), 'Sofá azul');
  assert.equal(n('Magic Carpet (Stand on it!)'), 'Carpete mágico');
  assert.equal(n('Pink Couch (non-tradeable)'), 'Sofá rosa');
  assert.equal(n('Red Locker (NOT FOR SALE)'), 'Armário vermelho');
  assert.equal(n('Elegant Red Chair'), 'Cadeira elegante vermelha');
  assert.equal(n('Dark Iced Coffee Table (Beige)'), 'Mesa de gelo de centro escura bege');
  assert.equal(n('Bling Sofa'), 'Sofá Bling');
  assert.equal(n('Cryo-Bed'), 'Cama de criogenia');
  // O que já está em português fica como está (inclusive com palavra emprestada).
  assert.equal(n('Bandeja de cupcakes'), 'Bandeja de cupcakes');
  assert.equal(n('Estátua do Zodiaco - Leão'), 'Estátua do Zodiaco - Leão');
  // Computadores têm nome próprio da Vybe.
  assert.equal(nomeEmPortugues({ nome: 'Computador antigo', classe: 'computer_old', categoria: 'Computadores' }), 'Computador antigo');
});

test('o catálogo inteiro sai em português: nenhuma palavra comum do inglês sobra', () => {
  const INGLES = new Set(['the', 'of', 'couch', 'table', 'chair', 'sofa', 'lamp', 'rug', 'stand', 'magic', 'tradeable', 'tradable', 'non', 'sale',
    'blue', 'red', 'green', 'pink', 'black', 'white', 'dark', 'large', 'small', 'carpet', 'corner', 'divider', 'plant', 'light', 'tree', 'bed',
    'shelf', 'desk', 'stool', 'bench', 'wall', 'floor', 'yellow', 'purple', 'modern', 'wooden', 'gold', 'golden', 'with', 'and', 'for']);
  // Nome próprio de marca ou coleção que já vem assim no acervo (não é palavra solta para traduzir).
  const PROPRIOS = new Set(["Red'n'Blue Stage Lights", 'Dark, o Gato Preto da Sorte', 'Stand de Feira Tóquio', 'ads_711shelf name']);
  const sobra = [];
  for (const m of catalogo) {
    if (PROPRIOS.has(m.nome)) continue;
    const saida = nomeEmPortugues(m);
    assert.ok(saida && saida.trim(), `sem nome: ${m.classe}`);
    const ruins = saida.toLowerCase().split(/[^a-zÀ-ſ]+/).filter((w) => INGLES.has(w));
    if (ruins.length) sobra.push(`${m.nome} → ${saida}`);
  }
  assert.deepEqual(sobra, []);
});

test('o editor usa a tradução única e a página a carrega antes dele', () => {
  const editor = readFileSync('vybe-escritorio-editor.js', 'utf8');
  assert.match(editor, /function escritorioNomeMovel\(m\) \{\r?\n {2}return VybeNomeMovel\.nomeEmPortugues\(m\);\r?\n\}/);
  assert.doesNotMatch(editor, /ESCRITORIO_SUBSTANTIVOS|ESCRITORIO_ADJETIVOS/, 'um dicionário só');
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.indexOf('/shared/escritorio-nome-movel.js') > 0 && html.indexOf('/shared/escritorio-nome-movel.js') < html.indexOf('/vybe-escritorio-editor.js'));
  // No navegador e nos testes de vm, o nome fica no global.
  const c = vm.createContext({});
  vm.runInContext(readFileSync('shared/escritorio-nome-movel.js', 'utf8'), c);
  assert.equal(vm.runInContext('VybeNomeMovel.nomeEmPortugues({ nome: "Blue Couch", classe: "x" })', c), 'Sofá azul');
});

test('cartão da Loja: raridade numa etiqueta e o preço em linha própria (nada de "900 moedas res…")', () => {
  const editor = readFileSync('vybe-escritorio-editor.js', 'utf8');
  const loja = editor.slice(editor.indexOf('if (naLoja && !travado'), editor.indexOf('// Prêmio (conquista ou ranking)'));
  assert.match(loja, /<i class="ofc-movel-faixa r-\$\{safeText\(i\.raridade\)\}">\$\{safeText\(i\.nome\)\}<\/i>/);
  assert.match(loja, /<em class="ofc-movel-linha ofc-preco">\$\{i\.preco\.toLocaleString\("pt-BR"\)\} moedas/);
  assert.doesNotMatch(loja, /ofc-preco">\$\{i\.raridade/, 'a raridade não divide a linha com o preço');
});

test('o jogo claro no fim do vybe-mundo.css: sem !important, sem html body.mundo, cada janela pelo id', () => {
  const css = readFileSync('vybe-mundo.css', 'utf8');
  const i = css.indexOf('O JOGO TAMBÉM É CLARO');
  assert.ok(i > 0);
  const bloco = css.slice(i);
  assert.doesNotMatch(bloco, /!important/);
  assert.doesNotMatch(bloco, /html body\.mundo/);
  for (const id of ['#office-catalogo', '#ofc-ranking', '#ofc-conquistas']) assert.ok(bloco.includes(id), id);
  // A janela da Loja para acima do dock.
  assert.match(bloco, /#office-catalogo\[open\]\{max-height:var\(--vv-janela-alto\)/);
  // A regra genérica antiga não pinta mais todo rk2-* de branco nem deixa a categoria escolhida preta.
  const antiga = css.slice(0, i);
  assert.doesNotMatch(antiga, /\[class\*="rk2-"\]:not\(\.rk2-janela\)/);
  // O período do Ranking também fica de fora da regra preta: a seleção é o laranja do padrão (segunda rodada, 10/11/2026).
  assert.match(antiga, /\[role="tab"\]\[aria-selected="true"\]\):not\(\.rk2-camp\):not\(\.rk2-chip\):not\(\.vb-chip\):not\(\.rk2-periodos > button\)\{background:#1F1D1A!important/);
  assert.match(css, /#ofc-ranking \.rk2-periodos button\[aria-selected="true"\]\{background:var\(--ds-on-fundo\);color:var\(--ds-on-texto\)\}/);
  // Os grupos das Conquistas quebram em linhas (nenhum chip cortado) e a Loja fica à direita do dock lateral.
  assert.match(css, /#workflow-modal\.ofc-menu-jogo \.ofc-cq-abas\{flex-wrap:wrap;overflow:visible\}/);
  assert.match(css, /body\.mundo #office-catalogo\{left:var\(--vv-palco-esq,0px\);right:var\(--vv-m\);/);
});

test('retrato voxel do móvel: o mesmo voxel do quarto, uma foto por vez, só para imagens de móvel', () => {
  const quarto = readFileSync('mundo/quarto.mjs', 'utf8');
  assert.match(quarto, /export async function movelEmVoxel\(/);
  assert.match(quarto, /export function retratoDoMovel\(/);
  // O quarto monta pela mesma função (não há duas regras de qual voxel usar).
  assert.match(quarto, /const v = await movelEmVoxel\(classe, d, estado, fichaDe\(classe\)\)/);
  assert.equal((quarto.match(/montarMovel\(/g) || []).length, 1);
  assert.match(readFileSync('mundo/mundo-3d.mjs', 'utf8'), /export \{ abrirQuarto, retratoDoMovel \} from '\.\/quarto\.mjs'/);
  const mundo = readFileSync('vybe-mundo.js', 'utf8');
  const ramo = mundo.slice(mundo.indexOf("if (/\\/imaging\\/furniture\\//.test(u.pathname)) {"), mundo.indexOf('const fig = q.get'));
  assert.match(ramo, /modAvatar\.retratoDoMovel\?\.\(classe[,)]/);
  assert.match(ramo, /img\.dataset\.movel === classe/);
});

test('Jogos e Equipe online mostram conteúdo: mesas com Jogar e quem está online com Ir até e Chamar', () => {
  const mundo = readFileSync('vybe-mundo.js', 'utf8');
  const jogos = mundo.slice(mundo.indexOf('function mostrarJogos()'), mundo.indexOf('let jogandoAgora'));
  for (const id of ['sinuca', 'xadrez', 'poker', 'mesa']) assert.ok(mundo.includes(`['${id}', `), id);
  assert.match(jogos, /class="vc-acao" data-jogo=/);
  assert.match(jogos, /Quem pode jogar agora/);
  assert.doesNotMatch(mundo, /Ranking, Missões e Conquistas ficam em Equipe/, 'sai a frase velha');
  const equipe = mundo.slice(mundo.indexOf('const EQUIPE_NO_DOCK'), mundo.indexOf('// Perfil = a ficha completa'));
  assert.match(equipe, /data-entrar-zona=/);
  assert.match(equipe, /data-chamar-online=/);
  assert.match(equipe, /EQUIPE_NO_DOCK = new Set\(\['ranking', 'conquistas', 'inventario', 'catalogo'\]\)/);
  assert.match(mundo, /else if \(b\.dataset\.chamarOnline\) fn\('chamarParaSalaEscritorio'\)/);
});
