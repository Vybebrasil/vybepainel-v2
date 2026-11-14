// Guarda do CSS (limpeza do !important, 14/11/2026). O padrão novo (padrao-v2/*.css, juntado em vybe-mundo-padrao-v2.css)
// não usa !important nem "html body.mundo" para ganhar no grito; as folhas antigas só podem encolher: cada uma tem um teto
// de !important igual à contagem depois da poda das regras mortas. Se um teto quebrar, a saída é ajustar a regra antiga
// (tirar o !important, estreitar o seletor ou apagar), não subir o número.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const ler = (f) => readFileSync(new URL(f, raiz), 'utf8');
const semComentario = (css) => css.replace(/\/\*[\s\S]*?\*\//g, ' ');
const importants = (css) => (semComentario(css).match(/!\s*important/gi) || []).length;
const fragmentos = readdirSync(new URL('padrao-v2/', raiz)).filter((f) => f.endsWith('.css')).sort();

test('padrão novo: nenhum !important em declaração (comentário não conta)', () => {
  for (const f of fragmentos) assert.equal(importants(ler(`padrao-v2/${f}`)), 0, `padrao-v2/${f}`);
  assert.equal(importants(ler('vybe-mundo-padrao-v2.css')), 0, 'vybe-mundo-padrao-v2.css');
});

// Contagem depois da poda de 14/11/2026. Só pode descer.
const TETO = {
  'vybe-appearance.css': 547,
  'vybe-mundo-aprovacoes.css': 0,
  'vybe-mundo-boletim.css': 0,
  'vybe-mundo-carteira.css': 4,
  'vybe-mundo-cliente.css': 0,
  'vybe-mundo-clientes-ficha.css': 2,
  'vybe-mundo-comercial.css': 0,
  'vybe-mundo-conteudo.css': 1,
  'vybe-mundo-conversa.css': 0,
  'vybe-mundo-decorar.css': 10,
  'vybe-mundo-ferramentas.css': 0,
  'vybe-mundo-impressoes.css': 0,
  'vybe-mundo-missoes.css': 20,
  'vybe-mundo-personagem.css': 1,
  'vybe-mundo-pessoas.css': 5,
  'vybe-mundo-planejamentos.css': 0,
  'vybe-mundo-relatorio.css': 7,
  'vybe-mundo-tutorial.css': 6,
  'vybe-mundo-whatsapp.css': 1,
  'vybe-mundo.css': 3598,
  'vybe-padrao.css': 1798,
  'vybe-sinuca.css': 971,
  'vybe-styles.css': 1465,
};

test('folhas antigas: o !important não volta a crescer', () => {
  const antigas = readdirSync(raiz).filter((f) => /^vybe-.*\.css$/.test(f) && f !== 'vybe-mundo-padrao-v2.css').sort();
  for (const f of antigas) {
    assert.ok(f in TETO, `${f}: folha nova fora da guarda — CSS novo vai em padrao-v2/, sem !important`);
    const n = importants(ler(f));
    assert.ok(n <= TETO[f], `${f}: ${n} !important, teto ${TETO[f]}`);
  }
});

test('padrão novo: nenhum seletor "html body.mundo" nos fragmentos', () => {
  for (const f of fragmentos) assert.doesNotMatch(semComentario(ler(`padrao-v2/${f}`)), /html\s+body\.mundo/, `padrao-v2/${f}`);
});

// Paleta da Direção 3: os tokens --d3-* da base, os hex do catálogo de status (cores de grupo do quadro e as bolinhas
// do menu de status) e os neutros do padrão. Os fragmentos de antes da Direção 3 ainda têm hex fora dela (os mais comuns:
// #EFEBE4, #4B36A8, #8A847A, #8A3207, #000000, #F6F3EE): a regra é um teto de contagem, que só pode descer.
const TETO_HEX_FORA = 327;
test('padrão novo: hex fora da paleta da Direção 3 não cresce', () => {
  const base = ler('padrao-v2/0-d3-base.css');
  const norm = (h) => { h = h.toUpperCase(); return h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h; };
  const paleta = new Set([...base.matchAll(/--d3-[\w-]+:\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => norm(m[1])));
  for (const h of ['#FFFFFF', '#F9F8F5', '#F3F1EC', '#EAE6DE', '#E6E0D6', '#F1EDE6', '#C9C2B6', '#B5AFA5', '#6B665E', '#4A463F', '#1F1D1A',
    '#579BFC', '#66CCFF', '#A25DDC', '#9D50DD', '#FF5AC4', '#E2445C', '#FF642E', '#FDAB3D', '#CAB641', '#00C875', '#037F4C', '#7C8797', '#C4C4C4', '#FFCB00']) paleta.add(h);
  assert.ok(paleta.size > 30, 'a base perdeu os tokens --d3-*');
  let fora = 0; const exemplos = new Set();
  for (const f of fragmentos) {
    for (const m of semComentario(ler(`padrao-v2/${f}`)).matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      if (m[0].length !== 4 && m[0].length !== 7) continue;
      if (!paleta.has(norm(m[0]))) { fora++; exemplos.add(`${f} ${m[0]}`); }
    }
  }
  assert.ok(fora <= TETO_HEX_FORA, `${fora} hex fora da paleta (teto ${TETO_HEX_FORA}); novos: ${[...exemplos].slice(-8).join(', ')}`);
});
