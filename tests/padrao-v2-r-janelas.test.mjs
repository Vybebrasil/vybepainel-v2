// Pranchas V2-R das janelas e formulários (19/11/2026): Criar, cartão rápido, notas, aparência, clientes da peça,
// cadastro do cliente, nova demanda e o menu de status com o portão de motivo nos três temas.
// SAFE: só lê arquivos (e roda funções puras num vm quando dá); nada grava nem envia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const semComentario = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const fragmentos = readdirSync('padrao-v2').filter((f) => /^zm-r-a-.*\.css$/.test(f)).map((f) => `padrao-v2/${f}`);

test('fragmentos zm-r-a: sem !important, sem html body.mundo, sem :has com [style], sem cor escrita', () => {
  assert.ok(fragmentos.length >= 1);
  for (const f of fragmentos) {
    const cru = ler(f), css = semComentario(cru);
    assert.doesNotMatch(css, /!important/, f);
    assert.doesNotMatch(css, /html body\.mundo/, f);
    assert.doesNotMatch(css, /:has\([^)]*\[style/, f);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b(?![\w-])/, `${f}: cor escrita em vez de token`);
  }
});

test('a junção leva os fragmentos zm-r-a para vybe-mundo-padrao-v2.css', () => {
  const junto = ler('vybe-mundo-padrao-v2.css');
  for (const f of fragmentos) assert.ok(junto.includes(`/* ===== ${f} ===== */`), f);
});

test('Criar: janela no vidro fumê, folha de canto 12, escolha com rádio, prévia em rótulo e valor, tipos dizem o que abrem', () => {
  const css = ler('padrao-v2/zm-r-a-1-criar.css');
  assert.match(css, /#vv-criar \.v2cr-janela\{width:min\(840px,100%\);[^}]*border-radius:var\(--d3-r-janela\);background:var\(--d3-fume-forte\)/);
  assert.match(css, /#vv-criar \.v2cr \.v2cr-dem\{padding:0;border-radius:12px;background:var\(--d3-folha\)/);
  assert.match(css, /\.v2cr-op\[aria-checked="true"\] \.v2cr-radio\{box-shadow:inset 0 0 0 5px var\(--d3-tinta\)\}/);
  assert.match(css, /\.v2cr-btn\{height:34px;[^}]*border-radius:var\(--d3-r-botao\)/);
  const js = ler('vybe-mundo.js');
  assert.match(js, /class="v2cr-janela d3-tema"/, 'no Escuro a folha escurece junto');
  assert.match(js, /o que entra na Vybe começa aqui · /);
  assert.match(js, /<i class="v2cr-radio" aria-hidden="true"><\/i>/);
  assert.match(js, /kv\('Prazos', 'calculados no passo 3'\)/);
  for (const t of ['abre Planejamentos', 'abre o cadastro completo', 'abre Reuniões']) assert.ok(js.includes(t), t);
  // os gatilhos de sempre continuam
  for (const a of ['data-criar="sair"', 'data-criar="demanda"', 'data-criar="continuar"', 'data-criar="sazonal"', 'data-criar-cliente', 'data-criar="sem-cliente"']) assert.ok(js.includes(a), a);
  // o Criar dentro do Hoje mantém a frase do pé
  assert.match(js, /\$\{jan \? '' : '<p class="v2cr-pe">Demanda e Conteúdo seguem/);
});
