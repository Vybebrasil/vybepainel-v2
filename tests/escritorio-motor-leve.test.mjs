import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Motor do Escritório mais leve em todas as salas (Paulo, 27/10/2026: "melhoria
// de desempenho precisa ser no motor todo").
const ler = (f) => readFileSync(f, 'utf8').split('\r\n').join('\n'); // no Windows o checkout vem com CRLF
const mapa = ler('vybe-escritorio-mapa.js');
const css = ler('vybe-styles.css');

test('móvel fora do enquadramento não troca de quadro e o fogo fora da tela não tremula', () => {
  assert.match(mapa, /if \(quadro % 12 === 0\) conferirNaTela\(\);/);
  assert.match(mapa, /if \(\(leve \|\| item\.foraDaTela\) && !item\.transicao\) continue;/);
  assert.match(mapa, /for \(const item of animados\) item\.foraDaTela = fora\(item\.no\);/);
  assert.match(css, /\.mapa-luz\.fogo\.fora-da-tela \{animation-play-state:paused\}/);
});
test('cada grupo de camadas tem o próprio recorte, guardado só pelas artes dele', () => {
  assert.match(mapa, /function mapaDesenharMovel\([^)]*justo = false\)/);
  assert.match(mapa, /\.filter\(\(c\) => c && \(!justo \|\| !filtro \|\| filtro\(c\)\)\)/);
  assert.match(mapa, /const chave = g\.chave \+ "\|" \+ d\.caixas\.filter/);
  assert.match(mapa, /dx: pronto\.ox - d\.ox, dy: pronto\.oy - d\.oy/);
  assert.match(mapa, /if \(cv\.style\.left !== esq\) cv\.style\.left = esq;/);
});
// Luz do quarto pintada no desenho, não filtro SVG (Paulo, 04/11/2026: "alguma
// coisa no VYBE OS ainda pesa"). O filtro url(#mapa-luz-…) roda no processador e
// era refeito a cada piscada de boneco e no chão inteiro.
test('a luz do quarto vem pintada no chão, na janela, nas imagens e nos bonecos; o filtro é só reserva', () => {
  const regras = css.match(/[^}]*filter:var\(--mapa-luz\)/g) || [];
  assert.equal(regras.length, 1);
  assert.match(regras[0], /\.mapa-pessoa > img\.sem-tinta \{filter:var\(--mapa-luz\)$/);
  assert.match(mapa, /mapaDesenharFundo\(fundo, P, origem\); tingir\(fundo\);/);
  assert.match(mapa, /g\.globalCompositeOperation = "source-over";\n    tingir\(p\.c\);/);
  assert.match(mapa, /const t = luzRgb && mapaBonecoTingido\(url, luzRgb, aplicar\);/);
  assert.match(mapa, /p\.img\.classList\.toggle\("sem-tinta", Boolean\(t\?\.falhou\)\);/);
  assert.match(mapa, /baixar\("default"\)\.catch\(\(\) => baixar\("no-store"\)\)/, 'cópia do cache com CORS de outra origem: pede de novo sem cache');
  const animadas = ler('vybe-escritorio-animadas.js');
  assert.match(animadas, /const folha = animadasTingida\(dado\.folha, hex, luz\);/);
});
// "O que é fixo faz uma imagem só" (Paulo, 04/11/2026).
test('o chão parado vira uma foto só e volta a ser solto quando alguém mexe', () => {
  assert.match(css, /\.mapa-movel\.na-foto > canvas \{visibility:hidden\}/);
  assert.match(mapa, /const fixo = \(m\) => m\.plano && !m\.parede && m\.camadas\?\.length && m\.quadros <= 1 && !m\.transicao && !m\.filtro && !animados\.includes\(m\)/);
  assert.match(mapa, /const ordenarMovel = \(m\) => \{\n    fotoMexeu\(m\);/);
  assert.match(mapa, /async function trocarMoveisAgora\(lista\) \{\n    soltarFoto\(\);/);
  assert.match(mapa, /carga\.pronto = true; pedirFoto\(\); \}\);/);
});
