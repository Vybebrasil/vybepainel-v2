// Paulo, 18/11/2026: "juntou status e status de captação... dentro da demanda também... são coisas diferentes. Assim como
// quando aparecer uma data, precisa tá claro se é prazo ou veiculação". Na gaveta da peça: Status e Captação em campos
// separados, cada um com o rótulo; toda data diz o que é ("prazo", "veic.").
// SAFE: só lê vybe-gaveta.js e roda funções puras num vm; nada grava nem envia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const fonte = readFileSync('vybe-gaveta.js', 'utf8');
const funcao = (nome) => { const a = fonte.indexOf(`function ${nome}(`); assert.ok(a >= 0, nome); let i = fonte.indexOf('{', a), n = 0; for (; i < fonte.length; i++) { if (fonte[i] === '{') n++; else if (fonte[i] === '}' && --n === 0) break; } return fonte.slice(a, i + 1); };
const ctx = { safeText: (s) => String(s).replace(/</g, '&lt;'), Date, Math, String, Number };
vm.runInNewContext([funcao('gavetaCaptacaoHtml'), funcao('gavetaAtrasoHtml'), funcao('solicitacaoAtrasoHtml'), funcao('solicitacaoVencida')].join('\n'), ctx);

test('captação tem campo próprio, com o rótulo "Captação", e some quando a peça não tem', () => {
  const html = ctx.gavetaCaptacaoHtml({ captacao: 'Captação agendada' });
  assert.match(html, /<span class="gv2-rot-campo">Captação<\/span><span class="gv2-capt-v">Captação agendada<\/span>/);
  assert.equal(ctx.gavetaCaptacaoHtml({ captacao: '' }), '');
  assert.equal(ctx.gavetaCaptacaoHtml({ captacao: '—' }), '');
  assert.equal(ctx.gavetaCaptacaoHtml({}), '');
});

test('o status da peça leva o rótulo "Status" e a captação vem separada, no computador e no celular', () => {
  assert.match(fonte, /<span class="gv2-rot-campo" aria-hidden="true">Status<\/span><span class="gv2-status"/);
  assert.match(fonte, /GAVETA_ICONE\.seta\)\}<\/span>\r?\n\s*\$\{gavetaCaptacaoHtml\(item\)\}\$\{gavetaObjetivoHtml\(item\)\}/);
  assert.match(fonte, /gv2-cel-st"[^\n]*GAVETA_ICONE\.seta\)\}<\/span>\$\{gavetaCaptacaoHtml\(item\)\}/);
});

test('atraso diz que é o prazo ("Prazo venceu há N dias", "Prazo hoje")', () => {
  ctx.gavetaHojeIso = () => '2026-11-18'; ctx.etapaDaPeca = () => 0;
  assert.match(ctx.gavetaAtrasoHtml({ prazo_iso: '2026-11-15' }), />Prazo venceu há 3 dias</);
  assert.match(ctx.gavetaAtrasoHtml({ prazo_iso: '2026-11-17' }), />Prazo venceu há 1 dia</);
  assert.match(ctx.gavetaAtrasoHtml({ prazo_iso: '2026-11-18' }), />Prazo hoje</);
  ctx.solicitacaoHojeIso = () => '2026-11-18'; ctx.solicitacaoConcluida = () => false;
  assert.match(ctx.solicitacaoAtrasoHtml({ prazo_iso: '2026-11-16' }), />Prazo venceu há 2 dias</);
  assert.doesNotMatch(fonte, />Atrasada \$\{dias\}/);
});

test('datas da gaveta com nome: Prazo interno, Veiculação/Conclusão no bloco e "veic." no celular', () => {
  assert.match(fonte, /<small>Prazo interno<\/small>/);
  assert.match(fonte, /<small>\$\{ehPedido \? 'Conclusão' : 'Veiculação'\}<\/small>/);
  assert.match(fonte, /\$\{ehPedido \? 'conclusão' : 'veic\.'\} \$\{safeText\(data\)\}/);
  assert.match(fonte, /<div class="gv2-cmp"><small>Prazo<\/small>\$\{dado\(item\.prazo/);
});
