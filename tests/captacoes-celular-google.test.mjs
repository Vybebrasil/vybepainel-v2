// Agenda da Produção no celular no jeito do Google Agenda (Paulo, 09/11/2026: "o Mizinho já é acostumado com essa forma").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync('vybe-captacoes.js', 'utf8').replace(/\r\n/g, '\n');
const css = readFileSync('vybe-styles.css', 'utf8').replace(/\r\n/g, '\n');

test('celular abre no mês, com a faixa dos meses, as letras dos dias, até 5 por dia e sem as datas comemorativas', () => {
  assert.ok(js.includes('vista: captNoCelular() ? "mes" : "semana",'), 'no computador continua a semana');
  assert.ok(js.includes('const cel = captNoCelular(), max = cel ? 5 : 3;'));
  assert.ok(js.includes('["S", "T", "Q", "Q", "S", "S", "D"]'));
  assert.ok(js.includes('${cel && !semMeses ? captMesesHtml() : ""}<div class="capt-mes"'));
  assert.ok(js.includes('${cel ? "" : window.VybeDatas?.chipsDoDia(dia, { max: 1 }) || ""}'));
});

test('tocar no dia abre o dia; o + flutuante marca no dia aberto (ou hoje no mês)', () => {
  assert.ok(js.includes(`role="gridcell" onclick="captTocarDia('\${dia}')"`));
  assert.ok(js.includes('function captTocarDia(dia) { if (captNoCelular()) captVerDia(dia); }'));
  assert.ok(js.includes(`<button type="button" class="capt-fab" onclick="captNovoEvento({dia:'\${dia}'},null)"`));
  assert.ok(js.includes('const dia = CAPT.vista === "dia" ? d : CAPT.vista === "mes" && d.slice(0, 7) !== hoje.slice(0, 7) ? `${d.slice(0, 7)}-01` : hoje;'));
  assert.equal(js.match(/\$\{captFabHtml\(\)\}/g)?.length, 2, 'o + está na tela antiga e na do padrão v2');
  assert.ok(js.includes('onclick="event.stopPropagation();captVerDia('), 'o +N não dispara o toque do dia duas vezes');
});

test('CSS: só no celular; faixas na cor do tipo da agenda; o + no canto de baixo; no computador nada muda', () => {
  assert.ok(css.includes('.capt-meses,.capt-fab{display:none}\n@media (max-width:700px){'));
  assert.ok(css.includes('.capt-cal.vista-mes .ag-chip{display:block;gap:0;padding:1px 3px;border-radius:3px;background:var(--ag-cor);color:#FFFFFF;'), 'a mesma cor do tipo (--ag-cor)');
  assert.ok(css.includes('.capt-fab{display:grid;place-items:center;position:fixed;z-index:660;right:16px;'));
});

// Rodada de 13/11/2026 (Paulo, com os prints do Google Agenda): no padrão v2 o mês do celular perdia o espaço em blocos
// grandes de várias linhas e não tinha o +.
const frag = readFileSync('padrao-v2/agenda-celular.css', 'utf8').replace(/\r\n/g, '\n');

test('padrão v2 no celular: faixa única de meses e Hoje no cabeçalho do cartão do mês', () => {
  assert.ok(js.includes('const mesCel = CAPT.vista === "mes" && captNoCelular();'));
  assert.ok(js.includes('captMesHtml(eventos, { semMeses: mesCel })'), 'a faixa não aparece duas vezes');
  assert.ok(js.includes('<div class="pv2a-cab pv2a-cab-meses">${captMesesHtml()}'));
  assert.ok(frag.includes('.pv2a-cab-meses{display:flex;flex-wrap:nowrap;'));
});

test('padrão v2 no celular: barrinhas de uma linha, sem o toque mínimo de 44 px, e o + no cartão branco', () => {
  assert.ok(frag.includes('.capt-mes .ag-chip{display:block;flex:none;width:100%;min-width:0;height:15px;min-height:0;'));
  assert.ok(frag.includes('.capt-mes .ag-chip span{display:block;-webkit-line-clamp:none;overflow:hidden;white-space:nowrap;'));
  assert.ok(frag.includes('body.mundo #pv2-agenda .capt-fab{display:grid;'));
});

test('fragmento da agenda no celular: sem !important, sem html body.mundo, o mês e o + dentro do corte de 700 px', () => {
  assert.ok(!frag.includes('!important'));
  assert.ok(!frag.includes('html body.mundo'));
  const media = frag.indexOf('@media (max-width:700px){'), fim = frag.indexOf('\n}\n', media);
  assert.ok(media > 0 && fim > media);
  for (const sel of ['.pv2a-mes-cartao{', '.pv2a-cab-meses{', '.capt-fab{']) { const i = frag.indexOf(sel); assert.ok(i > media && i < fim, sel); }
  const junto = readFileSync('vybe-mundo-padrao-v2.css', 'utf8').replace(/\r\n/g, '\n');
  assert.ok(junto.includes('/* ===== padrao-v2/agenda-celular.css ===== */'), 'rodar node scripts/padrao-v2-juntar.mjs');
});
