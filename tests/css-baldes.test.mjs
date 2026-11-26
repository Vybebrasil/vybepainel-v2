// Seletores com balde (confere de leveza, 26/11/2026): scripts/css-baldes.mjs reescreve, no build e no servidor local,
// as regras cuja parte da direita é um :is()/:where() de vários itens (o Chrome testa essas contra todo elemento da
// página). A reescrita não pode mudar o que a regra pega nem o peso dela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { baldearCss } from '../scripts/css-baldes.mjs';

const b = (css) => baldearCss(css).css;

test('itens do mesmo peso viram seletores comuns', () => {
  assert.equal(b('body.mundo :is(.a, .b) { color: red }'), 'body.mundo .a,body.mundo .b { color: red }');
  assert.equal(b('.x :is(button, input){a:b}'), '.x button,.x input{a:b}');
  assert.equal(b('.x :is(.a,.b):not(.c)::before{a:b}'), '.x .a:not(.c)::before,.x .b:not(.c)::before{a:b}');
});

test('pesos diferentes ou itens compostos: :where(chave) na frente, :is() intacto', () => {
  assert.equal(b('.x :is(.a, #b) {a:b}'), '.x :where(.a):is(.a, #b),.x :where(#b):is(.a, #b) {a:b}');
  assert.equal(b('.x :is(button.vb-link, a.vb-link:not(p a), .k > summary){a:b}'),
    '.x :where(.vb-link):is(button.vb-link, a.vb-link:not(p a), .k > summary),.x :where(summary):is(button.vb-link, a.vb-link:not(p a), .k > summary){a:b}');
  assert.equal(b(':where(body) :where(input[type="text"], textarea){a:b}'),
    ':where(body) :where([type="text"]):where(input[type="text"], textarea),:where(body) :where(textarea):where(input[type="text"], textarea){a:b}');
});

test('o que não dá para provar igual fica como está', () => {
  for (const css of ['.a :is(*, .b){a:b}', '.a :not(.b, .c){a:b}', '.a .b:is(.c, #d){a:b}', '.a :is(.b){a:b}', '@media (x) and :is(a) {}',
    '/* .a :is(.b,.c){ */ .d{a:b}'])
    assert.equal(b(css), css, css);
});

test('dentro de @media, ao lado de url(data:...;) e de comentários', () => {
  assert.equal(b('@media (max-width:600px){.a :is(.b,.c){x:y}}'), '@media (max-width:600px){.a .b,.a .c{x:y}}');
  assert.equal(b('.x{background:url(data:image/png;base64,AA{})} .y :is(.p,.q){z:w}'), '.x{background:url(data:image/png;base64,AA{})} .y .p,.y .q{z:w}');
  assert.equal(b('/* c */ .k :is(.m,.n){q:r}'), '/* c */ .k .m,.k .n{q:r}');
});

test('passar duas vezes não muda nada e todas as folhas do painel passam', () => {
  const raiz = new URL('../', import.meta.url);
  const folhas = readdirSync(raiz).filter((f) => f.endsWith('.css'));
  let regras = 0;
  for (const f of folhas) {
    const orig = readFileSync(new URL(f, raiz), 'utf8'); const r = baldearCss(orig);
    regras += r.regras;
    assert.equal(baldearCss(r.css).regras, 0, f);
    // o saldo de chaves e de parênteses não muda (a reescrita só repete seletores inteiros)
    const saldo = (s, a, z) => s.split(a).length - s.split(z).length;
    for (const [a, z] of [['{', '}'], ['(', ')']]) assert.equal(saldo(r.css, a, z), saldo(orig, a, z), `${f} ${a}${z}`);
  }
  assert.ok(regras > 500, `reescreveu ${regras} regras`);
});
