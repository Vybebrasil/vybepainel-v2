import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Padrão v2 (13/11/2026), quadro Status do moodboard, passos 1 e 3: nas listas de demandas e peças o status mora na
// linha, numa pílula com a setinha que abre o menu curto; ao trocar, a pílula vira e a linha chega deslizando.
const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const gestor = ler('vybe-gestor.js'), demandas = ler('vybe-demandas.js'), css = ler('padrao-v2/listas.css');
const bloco = (js, inicio, fim) => { const a = js.indexOf(inicio); assert.ok(a >= 0, inicio); const b = fim ? js.indexOf(fim, a + 1) : js.length; return js.slice(a, b < 0 ? js.length : b); };
const funcao = (js, nome) => { const a = js.indexOf(`function ${nome}(`); assert.ok(a >= 0, nome); let i = js.indexOf('{', js.indexOf(')', a)), n = 0; for (let j = i; j < js.length; j++) { if (js[j] === '{') n++; else if (js[j] === '}' && --n === 0) return js.slice(a, j + 1); } return js.slice(a); };
const status = bloco(gestor, '// ----- o status mora na linha, com a setinha');

// Monta só as peças da pílula num contexto isolado, com o relógio na mão do teste.
function pilulas() {
  let agora = 1000;
  const ctx = { Date: { now: () => agora }, setTimeout: () => 0, clearTimeout: () => {}, document: undefined,
    safeText: (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') };
  vm.createContext(ctx);
  const ic = gestor.slice(gestor.indexOf('const PV2_IC = {'), gestor.indexOf('};', gestor.indexOf('const PV2_IC = {')) + 2);
  vm.runInContext(`${ic}\n${funcao(gestor, 'pv2Tom')}\n${status.slice(0, status.indexOf('// Escolheu no menu'))}\nthis.api={pv2StatusBotao,pv2Chegou};`, ctx);
  return { ...ctx.api, passa: (ms) => { agora += ms; } };
}

test('a pílula é o botão do status: cor do significado, setinha e o menu curto no lugar, sem abrir a linha', () => {
  const { pv2StatusBotao } = pilulas();
  const html = pv2StatusBotao({ id: 'vybe:7', nome: 'Card · Promoção', status: 'Para Aprovação' });
  assert.match(html, /^<button type="button" class="pv2-st v" data-v2-st="vybe:7" aria-haspopup="menu" aria-expanded="false"/);
  assert.match(html, /onclick="event\.stopPropagation\(\);openStatusEditor\(event,'vybe:7'\)"/);
  assert.match(html, /<span class="pv2-st-rot">Para Aprovação<\/span><i class="pv2-st-seta" aria-hidden="true"><svg[^>]*><path d="M6 9l6 6 6-6"\/><\/svg><\/i><\/button>$/);
  assert.doesNotMatch(html, /data-estado|pv2-st-ok/, 'na primeira vez a pílula só aparece');
  assert.match(pv2StatusBotao({ id: 1, status: 'Alteração' }), /class="pv2-st r"/);
  assert.match(pv2StatusBotao({ id: 2, status: 'Pode Fazer' }), /class="pv2-st a"/);
  assert.match(pv2StatusBotao({ id: 3, status: 'Finalizado' }), /class="pv2-st g"/);
});

test('trocou o status: a linha chega (v2-chegou) e a pílula vem verde com o visto; depois assenta', () => {
  const { pv2StatusBotao, pv2Chegou, passa } = pilulas();
  const peca = { id: '9', nome: 'Reels', status: 'A Fazer' };
  assert.equal(pv2Chegou(peca), '');
  pv2StatusBotao(peca);
  peca.status = 'Em Andamento';
  assert.equal(pv2Chegou(peca), ' v2-chegou', 'a linha que acabou de trocar desliza');
  const nova = pv2StatusBotao(peca);
  assert.match(nova, /class="pv2-st a v2-estado" data-v2-st="9" data-estado="feito"/);
  assert.match(nova, /<i class="pv2-st-ok" aria-hidden="true"><svg[^>]*><path d="M5 12l5 5 9-10"\/><\/svg><\/i><span class="pv2-st-rot">Em Andamento<\/span>/);
  passa(2000);
  assert.equal(pv2Chegou(peca), '', 'passou o instante, a linha não chega de novo a cada desenho');
  assert.doesNotMatch(pv2StatusBotao(peca), /data-estado/);
});

test('as listas do Painel de trabalho e de Demandas usam a pílula, e o "Trocar status" de dentro da linha sai', () => {
  const cartao = funcao(gestor, 'pv2CartaoHtml'), linha = funcao(demandas, 'pv2dLinhaHtml');
  assert.match(cartao, /class="pv2-pc v2-abre\$\{marcada \? ' marcada' : ''\}\$\{feita \? ' feita' : ''\}\$\{pv2Chegou\(d\)\}"/);
  assert.match(cartao, /\$\{pv2StatusBotao\(d\)\}<span class="pv2-avs">/);
  assert.match(linha, /class="pv2-linha v2-abre\$\{marcada \? ' marcada' : ''\}\$\{pv2Chegou\(d\)\}"/);
  assert.match(linha, /<span class="pv2-cs">\$\{pv2StatusBotao\(d\)\}<\/span>/);
  for (const html of [cartao, linha]) { assert.doesNotMatch(html, />Trocar status</); assert.doesNotMatch(html, /pv2Pill\(d\.status\)/); }
});

test('as funções globais seguem iguais fora do mundo e ganham a pílula no mundo', () => {
  const controle = funcao(gestor, 'managerStatusControl');
  assert.match(controle, /const pill = pv2Ligado\(\) \? pv2StatusBotao\(item\) : `<button type="button" class="manager-status-control" onclick="openStatusEditor\(event,'\$\{item\.id\}'\)"/);
  assert.match(controle, /if \(pv2Ligado\(\)\) return `<span class="pv2-st-com-tempo">\$\{pill\}<span class="live-timer pv2-st-tempo" data-start=/);
  assert.match(funcao(gestor, 'vybeStatus'), /if \(typeof pv2Ligado === 'function' && pv2Ligado\(\)\) return pv2StatusBotao\(item\);\n  const rotulo = item\?\.status \|\| 'Sem status';/);
  assert.match(gestor, /<div class="item-row\$\{isUrgent\?' urgent':''\}\$\{pv2Ligado\(\)\?pv2Chegou\(d\):''\}">/);
  assert.match(funcao(gestor, 'filaLinhaHtml'), /\$\{pv2Ligado\(\) \? pv2Chegou\(d\) : ''\}" data-id=/);
  assert.match(gestor, /\$\{pv2Ligado\(\) \? pv2StatusBotao\(d\) : pillHtml\(d\.status, d\.status_color, d\.status_border\)\}/);
});

test('escolher no menu faz a pílula girar até a lista voltar; portão, recusa ou o mesmo status devolvem a pílula', () => {
  assert.match(status, /document\.addEventListener\('click', pv2StatusIndo, true\);/);
  assert.match(status, /document\.addEventListener\('click', pv2StatusAberto, true\);/);
  const indo = funcao(gestor, 'pv2StatusIndo');
  assert.match(indo, /closest\?\.\('#status-editor button\.status-editor-option'\)/);
  assert.match(indo, /op\.hasAttribute\('data-status-todos'\)/, '"Todos os N status" só abre a lista inteira');
  assert.match(indo, /b\.dataset\.estado = 'indo'/);
  assert.match(indo, /statusEmGravacao\.has\(id\)/);
  assert.match(indo, /document\.getElementById\('workflow-modal'\)/);
});

test('o CSS do grupo segue o quadro e não força regra antiga', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  for (const id of ['#pv2-dias-s1', '#pv2-demandas', '#grid-s1', '#ops-action-panel', '#ops-today-panel', '#ops-daily-panel']) assert.ok(css.includes(id), id);
  assert.match(css, /\.pv2-st\{[^}]*height:22px;[^}]*border-radius:999px;font:600 11\.5px\/22px/);
  assert.match(css, /\.pv2-st\.v\{background:#EEEAFB;color:#4B36A8\}/);
  assert.match(css, /\.pv2-st\[aria-expanded="true"\]\{box-shadow:0 0 0 2px #1F1D1A\}/);
  assert.match(css, /\.pv2-st\[data-estado="feito"\]\{pointer-events:none;background:#11613A;color:#FFFFFF;box-shadow:none\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('/* ===== padrao-v2/listas.css ===== */'), 'o fragmento entra na folha juntada');
});
