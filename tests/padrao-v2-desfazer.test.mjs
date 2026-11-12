import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Padrão v2 (12/11/2026): trocar o status termina num aviso em pílula com "Desfazer", que volta ao status de antes.
const core = fs.readFileSync('vybe-core.js', 'utf8');
const status = fs.readFileSync('vybe-status.js', 'utf8');
const css = fs.readFileSync('vybe-mundo.css', 'utf8');

function pagina() {
  const nos = new Map();
  const novo = (tag) => ({ tag, hidden: false, filhos: [], attrs: {}, textContent: '', offsetWidth: 1,
    setAttribute(k, v) { this.attrs[k] = v; }, replaceChildren(...f) { this.filhos = f; } });
  const document = { getElementById: (id) => nos.get(id) || null, createElement: novo,
    body: { append(el) { nos.set(el.id, el); } } };
  const relogios = [];
  const c = vm.createContext({ document, console, setTimeout: (f, ms) => { relogios.push({ f, ms }); return relogios.length; }, clearTimeout: (n) => { if (relogios[n - 1]) relogios[n - 1].f = null; } });
  const ini = core.indexOf('function mostrarDesfazer(');
  vm.runInContext(core.slice(ini, core.indexOf('function mostrarAvisoCurto(')), c);
  return { c, nos, relogios };
}

test('mostrarDesfazer mostra a frase e o botão, e chama o desfazer uma vez', () => {
  const { c, nos } = pagina();
  let voltou = 0;
  assert.equal(c.mostrarDesfazer('Movida para Aprovação', () => { voltou++; }), true);
  const el = nos.get('v2-desfazer');
  assert.equal(el.hidden, false);
  assert.equal(el.attrs.role, 'status');
  assert.equal(el.filhos[0].textContent, 'Movida para Aprovação');
  assert.equal(el.filhos[1].textContent, 'Desfazer');
  el.filhos[1].onclick();
  assert.equal(voltou, 1);
  assert.equal(el.hidden, true, 'some ao desfazer');
});

test('mostrarDesfazer some sozinho e um aviso novo toma o lugar do anterior', () => {
  const { c, nos, relogios } = pagina();
  c.mostrarDesfazer('Movida para Fazendo', () => {});
  c.mostrarDesfazer('Movida para Feita', () => {});
  const el = nos.get('v2-desfazer');
  assert.equal(el.filhos[0].textContent, 'Movida para Feita');
  assert.equal(relogios[0].f, null, 'o relógio do primeiro foi cancelado');
  relogios[1].f();
  assert.equal(el.hidden, true);
  assert.equal(c.mostrarDesfazer('sem função'), false, 'sem o que desfazer não há aviso');
});

test('a troca de status guarda o status de antes e só oferece Desfazer sem automação por trás', () => {
  assert.match(status, /const statusDeAntes = String\(item\.status \|\| ''\);/);
  assert.match(status, /else if \(!efeito && statusDeAntes && !mesmoStatus\(statusDeAntes, final\.label\) && typeof mostrarDesfazer === 'function'/);
  assert.match(status, /mostrarDesfazer\(`Status: \$\{final\.label\}`, \(\) => updateFocusStatus\(id, statusDeAntes\)\)/);
  // o aviso antigo continua para quando há efeito de automação ou fora do mundo
  assert.match(status, /else showToast\(efeito \|\| `✓ Status atualizado para \$\{final\.label\}/);
});

test('o aviso é uma pílula preta acima do dock e para com Reduzir movimento', () => {
  assert.match(css, /#v2-desfazer\{position:fixed;left:50%;bottom:calc\(var\(--vv-dock-alto,0px\) \+ 22px\);[^}]*border-radius:999px;background:#1F1D1A;color:#FFFFFF/);
  assert.match(css, /#v2-desfazer\[hidden\]\{display:none\}/);
  const fim = css.slice(css.indexOf('PADRÃO V2 · BASE'));
  assert.match(fim, /@media \(prefers-reduced-motion:reduce\)\{[^@]*#v2-desfazer\{animation:none\}/);
  assert.doesNotMatch(fim, /!important/);
});
