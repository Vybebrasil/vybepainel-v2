// Redesign, frente "sistema" (quadros 00, 29 e 30 do moodboard, 10/11/2026): as peças que valem para o sistema
// inteiro. O seletor do padrão no lugar do <select> nativo no mundo, o texto clicável como botão discreto, o foco
// laranja só do teclado, o rodapé técnico fora do mundo e o zero discreto do vbResumoHtml.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// Carrega vybe-seletor.js com o mínimo do navegador e guarda os ouvintes que ele registra.
function carregarSeletor({ mundo = true } = {}) {
  const ouvintes = [];
  const body = { classList: { contains: (c) => c === 'mundo' && mundo } };
  const ctx = {
    console, Date, Math, String, Number,
    window: { addEventListener: (tipo, fn, op) => ouvintes.push({ tipo, op }) },
    document: { body, readyState: 'complete', addEventListener() {} },
    Node: function Node() {},
  };
  vm.createContext(ctx);
  vm.runInContext(ler('vybe-seletor.js') + '\n;this.__s = { seletorElegivel, seletorOpcoes, seletorNormaliza, seletorNome };', ctx);
  return { ...ctx.__s, ouvintes };
}

function campo({ multiple = false, size = 0, disabled = false, nativo = false, opcoes = [] } = {}) {
  const grupo = { tagName: 'OPTGROUP', label: 'Grupo A', disabled: false };
  return {
    tagName: 'SELECT', multiple, size, disabled,
    closest: (s) => (s === '[data-nativo]' && nativo ? {} : null),
    getAttribute: (n) => (n === 'aria-label' ? 'Ordem' : null),
    options: opcoes.map(([texto, extra = {}]) => ({ textContent: texto, label: '', disabled: !!extra.desligada, hidden: !!extra.escondida,
      parentElement: extra.grupo ? grupo : { tagName: 'SELECT' } })),
  };
}

test('seletor: só <select> simples, ligado e no mundo ganha o menu do padrão', () => {
  const s = carregarSeletor();
  assert.equal(s.seletorElegivel(campo()), true);
  assert.equal(s.seletorElegivel(campo({ multiple: true })), false);
  assert.equal(s.seletorElegivel(campo({ size: 5 })), false);
  assert.equal(s.seletorElegivel(campo({ disabled: true })), false);
  assert.equal(s.seletorElegivel(campo({ nativo: true })), false);
  assert.equal(s.seletorElegivel({ tagName: 'INPUT', closest: () => null }), false);
  const fora = carregarSeletor({ mundo: false });
  assert.equal(fora.seletorElegivel(campo()), false, 'fora do mundo fica o do navegador');
});

test('seletor: as opções vêm do <select> na hora (grupo, desligada e escondida)', () => {
  const s = carregarSeletor();
  const ops = s.seletorOpcoes(campo({ opcoes: [['Em destaque'], ['Mais caros', { grupo: true }], ['Antiga', { escondida: true }], ['Esgotado', { desligada: true }]] }));
  assert.deepEqual(JSON.parse(JSON.stringify(ops.map((o) => [o.i, o.texto, o.grupo, o.desligada]))), [[0, 'Em destaque', '', false], [1, 'Mais caros', 'Grupo A', false], [3, 'Esgotado', '', true]]);
  assert.equal(s.seletorNormaliza('  Março '), 'marco', 'busca sem acento');
  assert.equal(s.seletorNome(campo()), 'Ordem');
});

test('seletor: ouve na captura da janela (o Esc do menu chega antes do Esc das janelas)', () => {
  const { ouvintes } = carregarSeletor();
  for (const tipo of ['mousedown', 'keydown', 'click', 'touchend', 'scroll']) {
    const o = ouvintes.find((x) => x.tipo === tipo);
    assert.ok(o, `ouve ${tipo}`);
    assert.ok(o.op === true || o.op?.capture === true, `${tipo} na captura`);
  }
  const src = ler('vybe-seletor.js');
  assert.match(src, /dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
  assert.match(src, /dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  assert.match(src, /new MutationObserver/);
  assert.match(src, /SELETOR_BUSCA_A_PARTIR = 9/, 'busca a partir de 9 opções (mais de 8)');
  assert.match(src, /closest\('dialog\[open\]'\)/, 'dentro de dialog modal o menu nasce no dialog (fora dele fica inerte)');
});

test('seletor: carrega sempre, antes dos módulos do mundo e depois do calendário', () => {
  const html = ler('index.html');
  const i = html.indexOf('<script src="/vybe-seletor.js"></script>');
  assert.ok(i > 0, 'vybe-seletor.js no index.html, sem sob-demanda');
  assert.ok(i > html.indexOf('/vybe-calendario.js'));
  for (const f of ['/vybe-mundo.js', '/vybe-mundo-pessoas.js', '/vybe-mundo-ferramentas.js', '/vybe-mundo-carteira.js', '/vybe-mundo-impressoes.js']) {
    assert.ok(i < html.indexOf(f), `antes de ${f} (que ouvem o Esc na captura da janela)`);
  }
});

test('peças: rodapé técnico fora do mundo, texto clicável como botão, foco sem anel do navegador, sem !important novo', () => {
  const css = ler('vybe-mundo.css');
  const bloco = css.slice(css.indexOf('PEÇAS COMPARTILHADAS DO SISTEMA, parte 2'));
  assert.ok(bloco.length > 100);
  assert.doesNotMatch(bloco, /!important/, 'o bloco novo não força nada');
  assert.doesNotMatch(bloco, /html body\.mundo/);
  assert.match(bloco, /body\.mundo > footer\{display:none\}/);
  assert.match(bloco, /button\.vb-link,a\.vb-link:not\(p a\),\.resumo-limpar,\.capt-trocar > summary/);
  assert.match(bloco, /:is\(dialog,\[tabindex="-1"\],\[role="dialog"\]/);
  assert.match(bloco, /\.vb-seletor-menu\{/);
  // os remendos que só pintavam o rodapé e o vb-link saíram
  assert.doesNotMatch(css, /mundo-modulo footer/);
  assert.doesNotMatch(css, /html body\.mundo\.mundo-modulo \.vb-link\{/);
  const total = (css.match(/!important/g) || []).length;
  assert.ok(total <= 3933, `!important em vybe-mundo.css não sobe (${total}; eram 3.942 antes desta frente)`);
});

test('vbResumoHtml: zero vira texto discreto, sem a cor de estado', () => {
  const src = ler('vybe-core.js').replace(/\r\n/g, '\n');
  const ini = src.indexOf('function vbResumoHtml');
  const fim = src.indexOf('\n}\n', ini) + 2;
  const ctx = { safeText: (v) => String(v ?? '') };
  vm.createContext(ctx);
  vm.runInContext(src.slice(ini, fim) + ';this.f = vbResumoHtml;', ctx);
  const html = ctx.f([{ valor: 0, rotulo: ' atrasadas', tom: 'alerta' }, { valor: 3, rotulo: ' atrasadas', tom: 'alerta' }]);
  assert.match(html, /class="vb-resumo-item zero"><b>0<\/b>/);
  assert.match(html, /class="vb-resumo-item alerta"><b>3<\/b>/);
});
