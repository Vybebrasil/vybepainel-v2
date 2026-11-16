// V2 · grupo F · o mundo Vybe (pranchas V2-M-Centro, Predio, Minha-Sala, Jogos, Loja, Ranking e Conquistas, aprovadas
// pelo Paulo em 16/11/2026). Prende o esqueleto novo de cada tela e as regras dos fragmentos zm-f-*.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const mundo = ler('vybe-mundo.js');
const trecho = (a, b, fonte = mundo) => { const i = fonte.indexOf(a); assert.ok(i >= 0, a); const j = fonte.indexOf(b, i + a.length); return fonte.slice(i, j < 0 ? undefined : j); };
const fragmentos = fs.readdirSync(new URL('../padrao-v2/', import.meta.url)).filter((f) => /^zm-f-.*\.css$/.test(f));

test('fragmentos zm-f-*: só tokens --d3-*, sem !important, sem html body.mundo, sem :has com [style], sem keyframes de opacity 0', () => {
  assert.ok(fragmentos.includes('zm-f-casca.css') && fragmentos.includes('zm-f-centro.css'));
  const junto = ler('vybe-mundo-padrao-v2.css');
  for (const f of fragmentos) {
    const css = ler('padrao-v2/' + f), semComentario = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(semComentario, /!important/, f);
    assert.doesNotMatch(semComentario, /html body\.mundo/, f);
    assert.doesNotMatch(semComentario, /:has\([^)]*\[style/, f);
    assert.doesNotMatch(semComentario, /#[0-9a-fA-F]{3,8}\b(?![^{]*\{)/, f + ': cor só por token');
    assert.doesNotMatch(semComentario, /@keyframes[^{]*\{\s*(0%|from)\s*\{[^}]*opacity:\s*0[;}]/, f);
    assert.ok(junto.includes(`/* ===== padrao-v2/${f} ===== */`), f + ' entrou em vybe-mundo-padrao-v2.css (rode scripts/padrao-v2-juntar.mjs)');
    assert.ok(junto.includes(css.trimEnd().split('\n').pop()), f + ': a folha juntada está em dia');
  }
});

test('Centro (V2-M-Centro): janela no vidro, tiras, cartão da cena e consulta; os cartões de módulo saíram', () => {
  const c = trecho('  function pintarCentroD3(', '  function filtrarCidade(');
  for (const t of ['class="d3m-e-topo d3m-f-topo"', 'class="d3c-mapa d3m-f-cena"', 'class="d3m-f-tiras"', 'class="d3m-lado d3m-f-lado"', 'class="d3m-laranja d3m-f-lar"', 'VYBES · a loja mais apertada', 'data-loja-apertada', 'data-d3-lojas', 'data-d3-cheio', 'data-busca-loja', 'data-filtro-cidade="atraso"', 'data-entrar-zona=', 'data-trilho="equipe"', 'aria-label="Online agora"', 'aria-label="Salas"']) assert.ok(c.includes(t), t);
  assert.ok(!/data-trilho="(loja|ranking|conquistas|jogos|minha-sala)"/.test(c) && !c.includes('d3c-mods'), 'sem os oito cartões de módulo');
  const css = ler('padrao-v2/zm-f-centro.css');
  assert.match(css, /body\.mundo\.mundo-centro\.d3c-painel #mundo::before\{[^}]*background:var\(--d3-fume\)/, 'a janela fica atrás do canvas: o vidro não escurece a cena');
  assert.match(css, /#d3-centro\.d3m-f-mundo > \.d3m-f-corpo\{[^}]*pointer-events:none/, 'o toque passa para o 3D');
  assert.doesNotMatch(css, /backdrop-filter|animation/, 'nada de blur nem animação por cima da cena');
});

test('Prédio (V2-M-Predio): o prédio 3D no cartão, a folha do elevador e a consulta; o andar em voxel segue em tela cheia', () => {
  const c = trecho('  function pintarCentroD3(', '  function filtrarCidade(');
  for (const t of ['class="d3m-e-folha d3m-f-elev" aria-label="Prédio · elevador"', 'class="d3m-f-andar" data-andar=', 'toque no andar para subir', 'data-d3-agentes-tentar>Tentar de novo', 'data-trilho="agentes"', 'numerosDoAndar(a)', 'avisoDosAgentes()']) assert.ok(c.includes(t), t);
  assert.match(mundo, /const noPainelDoCentro = \(\) => centroAberto && !centroCheio && !body\.classList\.contains\('mundo-modulo'\) && !body\.classList\.contains\('mundo-andar'\);/, 'o Prédio também abre no painel; o andar em voxel não');
  assert.ok(mundo.includes("body.classList.add('mundo-andar'); if (centroAberto) pintarCentroD3(naTela);"), 'entrar no andar tira o painel');
  const css = ler('padrao-v2/zm-f-predio.css');
  assert.match(css, /\[data-vista="predio"\] > \.d3m-f-corpo\{grid-template-columns:minmax\(0,1fr\) 400px 316px/);
  assert.match(css, /#vv-placa:has\(> \.vv-elevador-lista\)\{display:none\}/, 'a lista de andares é a folha do elevador');
});
