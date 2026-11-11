// Dock lateral (Paulo, 11/11/2026): área sem acesso não aparece, VybeHub como item e favoritos por pessoa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../vybe-mundo.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../vybe-mundo.css', import.meta.url), 'utf8');

test('área só dos donos some do dock para quem não tem acesso (sem borrão nem cadeado)', () => {
  assert.match(css, /\.vv-trilho \.trancado\{display:none\}/);
  assert.doesNotMatch(css, /\.vv-trilho \.trancado>span[^{]*\{filter:blur/, 'o borrão antigo saiu');
  assert.match(css, /body\.trilho-largo \.vv-trilho-grupo\[hidden\]/, 'o título do grupo vazio some no dock largo');
  assert.match(js, /const vazio = itens\.length > 0 && itens\.every\(\(b\) => b\.classList\.contains\('trancado'\)\);/);
  assert.match(js, /if \(TRANCADOS\.has\(id\) && !souDono\(\)\)/, 'atalho e busca continuam barrados');
  assert.match(js, /b\.hidden \|\| b\.classList\.contains\('trancado'\)\) continue;/, 'o Mais do celular também não mostra');
});

test('VybeHub é item do dock e abre o Hub ao lado', () => {
  assert.match(js, /\{ id: 'vybehub', grupo: 'Operação', nome: 'VybeHub',[^}]*url: 'https:\/\/vybehub\.vercel\.app\/'/);
  assert.match(js, /const fora = TRILHO\.find\(\(t\) => t && typeof t === 'object' && t\.id === id && t\.url\);/);
  assert.match(js, /if \(fora\) \{ window\.open\(fora\.url, '_blank', 'noopener'\); return; \}/);
});

test('favoritos: por pessoa, só o que abre tela, com limite e sem mostrar o que a pessoa não abre', () => {
  assert.match(js, /const chaveFav = \(\) => 'vybe\.mundo\.favoritos\.' \+/);
  assert.match(js, /operadorDoTopo\(\)\?\.id/);
  assert.match(js, /const favoritavel = \(t\) => Boolean\(t && typeof t === 'object' && !Array\.isArray\(t\.sub\) && !t\.acao && t\.id !== 'hoje'\);/);
  assert.match(js, /const FAV_MAX = 12;/);
  assert.match(js, /const favVisivel = \(x\) => Boolean\(x\) && \(souDono\(\) \|\| !\(TRANCADOS\.has\(x\.id\) \|\| TRANCADOS\.has\(x\.setor\)\)\)/);
  assert.match(js, /if \(marca\(\) === favPintado\) return;/, 'não repinta sem mudança (os observadores do HUD)');
  assert.match(js, /const fav = e\.target\.closest\?\.\('\.vv-trilho \[data-fav\]'\); if \(fav\) \{ e\.preventDefault\(\); alternarFavorito\(fav\.dataset\.fav\); return; \}/, 'a estrela não abre o item');
  assert.match(js, /<h3>Favoritos<\/h3>/, 'no celular os favoritos vêm no Mais');
  assert.doesNotMatch(css.slice(css.indexOf('/* Favoritos do dock'), css.indexOf('/* Ver como: faixa no topo')), /!important/, 'bloco novo sem !important');
});
