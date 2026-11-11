// Redesign r5, quadros 35 e 29 (regra 4, "tudo é voxel"): a Loja sem a arte do Habbo, sem 404 e com nome em português.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { artesLocais } from '../scripts/artes-locais.mjs';
import { tipoModelado, montarMovel, montarDeParede, tipoDeParede, coresSemArte, pegadaSemArte, placaSemArte } from '../mundo/moveis-voxel.mjs';
import { tipoDeConstrucao } from '../mundo/moveis-familias.mjs';

const require = createRequire(import.meta.url);
const { nomeEmPortugues } = require('../shared/escritorio-nome-movel.js');
const ler = (f) => readFileSync(f, 'utf8');
const catalogo = JSON.parse(ler('assets/escritorio/habbo/catalogo.json'));

test('35 · a lista das peças com arte no repositório está em dia com a pasta (e o build a refaz)', async () => {
  assert.deepEqual(JSON.parse(ler('mundo/artes-locais.json')), await artesLocais());
  assert.match(ler('scripts/build.mjs'), /await gerarArtesLocais\(\);/);
});

test('35 · peça sem arte não pede a arte: o voxel sai pelo nome, a categoria e a ficha', () => {
  const quarto = ler('mundo/quarto.mjs');
  assert.match(quarto, /import ARTES_LOCAIS from '\.\/artes-locais\.json' with \{ type: 'json' \};/);
  assert.match(quarto, /if \(!temArteLocal\(classe\)\) return semArte\(\);/);
  assert.match(quarto, /function adiantarArte\(classe\) \{\r?\n {2}if \(!temArteLocal\(classe\)\)/);
  assert.match(quarto, /const VERSAO_RETRATO = 'r6';/);
  // Medidas e revestimentos da sala também só pedem a arte de quem a tem.
  assert.match(ler('vybe-mundo.js'), /!m\?\.temArteLocal \|\| m\.temArteLocal\(c\)/);
  assert.match(quarto, /if \(temArteLocal\(c\)\) corDoRevestimento\(c\)/);
  // Toda peça da Loja monta um voxel sem arte (nenhuma receita falha).
  const fis = JSON.parse(ler('assets/escritorio/habbo/fisica.json'));
  for (const m of catalogo) {
    const f = fis[m.classe];
    if (f ? f[0] & 16 : m.parede) {
      const tipo = tipoDeParede(m.classe, m), { w, h } = placaSemArte(tipo);
      assert.ok(montarDeParede(tipo, { w, h, cores: coresSemArte(m.classe, m, tipo), classe: m.classe }).solidos.length, m.classe);
      continue;
    }
    const tipo = tipoModelado(m.classe, f ? { pisa: !!(f[0] & 1), senta: !!(f[0] & 2), deita: !!(f[0] & 4), altura: f[1] } : null, m) || 'generico';
    const { w, d } = pegadaSemArte(tipo, m, m.classe);
    assert.ok(montarMovel(tipo, { w, d, cores: coresSemArte(m.classe, m, tipo), classe: m.classe })?.solidos.length, m.classe);
  }
});

test('35 · cores sem arte: a cor do nome, depois a do tipo e a da categoria', () => {
  assert.equal(coresSemArte('x', { nome: 'Pink Couch', categoria: 'Cadeiras e sofás' }, 'sofa').principal, '#F06EA0');
  assert.equal(coresSemArte('x', { nome: 'Fern', categoria: 'Jardim' }, 'planta').principal, '#4FA35A');
  assert.equal(coresSemArte('x', { nome: 'Coisa', categoria: 'Divisórias' }, '').principal, '#E2D9C8');
});

test('35 · Construção: divisórias, paredes, cantos, portas, cercas, colunas e escadas deixam de ser cubo', () => {
  const t = (nome, categoria = 'Divisórias') => tipoModelado('x', null, { nome, categoria });
  assert.equal(t('Room Divider'), 'divisoria');
  assert.equal(t('Sand Castle Wall'), 'parede');
  assert.equal(t('Beige Corner'), 'canto');
  assert.equal(t('School Gates'), 'porta');
  assert.equal(t('Wooden Divider Fence'), 'cerca');
  assert.equal(t('Greek Pillar'), 'coluna');
  assert.equal(t('Bloco Escada', 'Blocos e materiais'), 'escada');
  assert.equal(t('Janela Reino de Gelo'), 'janela');
  assert.equal(t('Bloco de mármore', 'Blocos e materiais'), 'bloco');
  assert.equal(t('Wooden Floor', 'Pisos do acervo'), 'bloco'); // piso continua bloco
  assert.equal(tipoDeConstrucao('nada aqui'), null);
  for (const tipo of ['parede', 'divisoria', 'canto', 'porta']) assert.ok(montarMovel(tipo, { w: 1, d: 1, classe: 'x' }).solidos.length > 3, tipo);
});

test('35 · nomes da Loja em português: as palavras do Habbo que sobravam em inglês', () => {
  const n = (nome, categoria = 'Casa') => nomeEmPortugues({ nome, classe: 'x', categoria });
  assert.equal(n('Body Scanner'), 'Scanner de corpo');
  assert.equal(n('Caterpillar'), 'Lagarta');
  assert.equal(n('Yellow Gum Drop Seat'), 'Assento de bala de goma amarelo');
  assert.equal(n('Fragrant Bath (Crafting Table)'), 'Banheira perfumada');
  assert.equal(n('Dove Swing'), 'Balanço de pomba');
  assert.equal(n("Survivor's Workbench"), 'Bancada de sobrevivente');
  assert.equal(n('Multicoloured Stage Fence'), 'Cerca de palco colorida');
  assert.equal(n('Rain-soaked Windows'), 'Janelas de chuva encharcadas');
  assert.equal(n('Locked Sea Chest'), 'Baú do mar trancado');
  assert.equal(n('Blue Hot Air Balloon'), 'Balão de ar azul quente');
  // Traduz na exibição: o catálogo (classe e nome) não muda, e o mesmo nome sai igual da segunda vez (cache).
  assert.equal(catalogo.find((m) => m.nome === 'Body Scanner')?.nome, 'Body Scanner');
  assert.equal(n('Body Scanner'), 'Scanner de corpo');
});

test('35 · Loja: sem Habbo nem no começo e sem travar a abertura no celular', () => {
  const css = ler('vybe-mundo.css');
  assert.match(css, /body\.mundo img\[src\*="habboassets\.com\/imaging\/furniture\/"\]:not\(\.movel-habbo\)\{object-position:-9999px -9999px/);
  assert.match(ler('vybe-mundo.js'), /if \(!url\) img\.classList\.add\('movel-habbo'\)/);
  const editor = ler('vybe-escritorio-editor.js');
  const abrir = editor.slice(editor.indexOf('function abrirCatalogoEscritorio('), editor.indexOf('function abrirCatalogoEscritorio(') + 600);
  assert.ok(abrir.indexOf('garantirBaseEscritorio()') < abrir.indexOf('carregarCatalogoEscritorio()'), 'a base é pedida antes do catálogo');
  assert.match(editor, /const lista = capa \? semFaixa : /);
  assert.match(ler('vybe-escritorio-loja.js'), /let escritorioContasLoja = null;/);
});
