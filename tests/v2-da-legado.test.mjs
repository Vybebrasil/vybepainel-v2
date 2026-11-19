// Confere de diretor de arte, frente da-3 (Paulo, 19/11/2026): telas com legado de tema. Conversas e a janela "só donos"
// escurecem no Escuro com os mesmos tokens da folha escura, o campo da Conta volta para os tokens, a gravação sem fechar
// sai do laranja da ação, as barras de produção saem do laranja local e a risca da tarefa feita
// deixa a cor escrita.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const frag = ler('padrao-v2/da-legado.css');
const base = ler('padrao-v2/0-d3-base.css');
const junto = ler('vybe-mundo-padrao-v2.css');
const regra = (css, inicio) => { const i = css.indexOf(inicio); assert.ok(i >= 0, inicio); const a = css.indexOf('{', i); const f = css.indexOf('}', a); return css.slice(a + 1, f); };
const decl = (corpo) => Object.fromEntries(corpo.replace(/\/\*[\s\S]*?\*\//g, '').split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const k = d.indexOf(':'); return [d.slice(0, k).trim(), d.slice(k + 1).trim()]; }));

test('o fragmento entra na folha gerada e segue as regras do padrão (sem important, sem html body.mundo, sem :has com [style])', () => {
  assert.ok(junto.includes('/* ===== padrao-v2/da-legado.css ===== */'));
  assert.ok(junto.replace(/\r\n/g, '\n').includes(frag.trimEnd()), 'gerado em dia com o fragmento');
  const sem = frag.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/!important/.test(sem));
  assert.ok(!/html\s+body\.mundo/.test(sem));
  assert.ok(!/:has\([^)]*\[style/.test(sem));
});

test('Conversas e a janela "só donos" recebem exatamente a folha escura de 0-d3-base.css', () => {
  const i = base.indexOf('[data-d3-tema="escuro"] :is(#vv-hoje');
  const original = decl(regra(base, base.slice(i, i + 40)));
  const nossa = decl(regra(frag, '[data-d3-tema="escuro"] :is(#vv-whatsapp,#workflow-modal.vb-sem-acesso-janela)'));
  for (const [k, v] of Object.entries(original)) assert.equal(nossa[k], v, `${k} igual ao da base`);
  assert.ok(nossa['--d3-cartao'] && nossa['--d3-tinta']);
});

test('o campo da Conta vence a regra antiga de campos com dois ids e só usa tokens', () => {
  const c = decl(regra(frag, '#painel-conta #conta-root :is(input'));
  assert.equal(c.background, 'var(--d3-cartao)');
  assert.equal(c.color, 'var(--d3-tinta)');
  assert.match(c.border, /var\(--d3-apagado\)/);
});

test('a gravação sem fechar fica no verde da captação, não no laranja da ação', () => {
  const c = decl(regra(frag, '.agv2 .fechar{'));
  assert.equal(c['--agv2-cor'], 'var(--d3-mod-vybe)');
  assert.ok(!/--d3-acao\b/.test(regra(frag, '.agv2 .agv2-ev.fechar{')));
});

// contraste WCAG
const lum = (h) => { const n = h.replace('#', ''); const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('as barras de produção usam o âmbar do sistema, com 3:1 ou mais sobre a folha nos três temas', () => {
  assert.equal(decl(regra(frag, ':is(.d3m-a-eq-leg,'))['--d3m-a-producao'], 'var(--d3-ambar)');
  const ambarClaro = base.match(/\[data-d3-tema="fume"\]\{[\s\S]*?--d3-ambar:(#[0-9A-F]{6})/)[1];
  const ambarEscuro = regra(base, '[data-d3-tema="escuro"] :is(#vv-hoje').match(/--d3-ambar:(#[0-9A-F]{6})/)[1];
  assert.ok(cr(ambarClaro, '#FFFFFF') >= 3, 'Fumê e Claro sobre a folha branca');
  assert.ok(cr(ambarEscuro, '#2C2A28') >= 3, 'Escuro sobre a folha escura');
});

test('a risca da tarefa feita usa o token apagado da folha, não cor escrita', () => {
  assert.equal(decl(regra(frag, '.v2-risca.feita{')).color, 'var(--d3-apagado)');
});
