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
  assert.ok(js.includes('${cel ? captMesesHtml() : ""}<div class="capt-mes"'));
  assert.ok(js.includes('${cel ? "" : window.VybeDatas?.chipsDoDia(dia, { max: 1 }) || ""}'));
});

test('tocar no dia abre o dia; o + flutuante marca no dia aberto (ou hoje no mês)', () => {
  assert.ok(js.includes(`role="gridcell" onclick="captTocarDia('\${dia}')"`));
  assert.ok(js.includes('function captTocarDia(dia) { if (captNoCelular()) captVerDia(dia); }'));
  assert.ok(js.includes(`<button type="button" class="capt-fab" onclick="captNovoEvento({dia:'\${CAPT.vista === "dia" ? d : hoje}'},null)"`));
  assert.ok(js.includes('onclick="event.stopPropagation();captVerDia('), 'o +N não dispara o toque do dia duas vezes');
});

test('CSS: só no celular; faixas na cor do tipo da agenda; o + no canto de baixo; no computador nada muda', () => {
  assert.ok(css.includes('.capt-meses,.capt-fab{display:none}\n@media (max-width:700px){'));
  assert.ok(css.includes('.capt-cal.vista-mes .ag-chip{display:block;gap:0;padding:1px 3px;border-radius:3px;background:var(--ag-cor);color:#FFFFFF;'), 'a mesma cor do tipo (--ag-cor)');
  assert.ok(css.includes('.capt-fab{display:grid;place-items:center;position:fixed;z-index:660;right:16px;'));
});
