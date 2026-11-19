// Minhas tarefas para a Coordenação (Bia, 18/11/2026): "quero que apareça quem tá atribuído e que eu possa alterar o
// responsável" e "ver prazo e veiculação". Na aba do Hoje e no módulo do dock, cada linha traz quem faz (abre o editor
// de responsável de sempre, openOwnerEditor, que grava pelo /api/conteudo) e as duas datas, cada uma editável ali mesmo
// (data-editar-data, vybe-core.js), com a vencida em vermelho.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const mundo = readFileSync('vybe-mundo.js', 'utf8');
const trecho = (ini, fim) => { const i = mundo.indexOf(ini), j = mundo.indexOf(fim, i); assert.ok(i > 0 && j > i, ini); return mundo.slice(i, j); };

test('as duas linhas (aba do Hoje e módulo do dock) têm quem faz, que abre o editor de responsável, e as duas datas editáveis', () => {
  const hoje = trecho('const linha = (x, rep = false) =>', 'function listaHtml()');
  const dock = trecho('const linhaV2 = (x, rot) =>', 'const [, baseV2, , vazioV2]');
  for (const [nome, l] of [['Hoje', hoje], ['dock', dock]]) {
    assert.match(l, /<button type="button" class="v2t-dono[^"]*" onclick="openOwnerEditor\(event,'\$\{id\}'\)" \$\{donoRot\(x\)\}>/, `${nome}: quem faz abre openOwnerEditor`);
    assert.ok(l.includes('data-editar-data="prazo" data-peca="${id}"') && l.includes('data-editar-data="veiculacao" data-peca="${id}"'), `${nome}: prazo e veiculação editáveis`);
    assert.match(l, /dataTom\(x, 'prazo'\)[\s\S]*dataTom\(x, 'veiculacao'\)/, `${nome}: a cor de cada data`);
    assert.ok(l.includes("onclick=\"openStatusEditor(event,'${id}')\""), `${nome}: o status continua trocando na linha`);
  }
  assert.ok(hoje.includes('${avD3(quem)}'), 'Hoje: a mesma bolinha de iniciais, agora dentro do botão');
  assert.match(mundo, /<span>Status<\/span><span>Prazo · no ar<\/span><span>Quem<\/span><\/div>/, 'dock: cabeçalho das colunas novas');
});

test('as datas: hoje e amanhã por extenso, vencida em vermelho, a de hoje em âmbar, feita sem cor; quem faz pelo time', () => {
  const ini = mundo.indexOf('    const donosDe = (d) =>'), fim = mundo.indexOf('\n', mundo.indexOf('    const datasFeitas = (x) =>'));
  const ctx = vm.createContext({ hoje: '2026-11-18', somar: (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    dmD3: (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, esc: (v) => String(v ?? '').replace(/"/g, '&quot;'),
    ownerUsersFor: (d) => (d.responsavel_ids || []).map((id) => ({ 2: { name: 'Beatriz Souza' }, 3: { name: 'Jady Lima' } })[id]).filter(Boolean) });
  vm.runInContext(mundo.slice(ini, fim) + '\nthis.f = { donoRot, donoCurto, dataTom, dataTxt, dataAttrs, datasFeitas };', ctx);
  const { donoRot, donoCurto, dataTom, dataTxt, dataAttrs, datasFeitas } = ctx.f;
  const aberta = { sit: 'atrasada', d: { id: 'vybe:1', prazo_iso: '2026-11-15', veiculacao_iso: '2026-11-18', responsavel_ids: ['2', '3'] } };
  assert.equal(dataTom(aberta, 'prazo'), ' r'); assert.equal(dataTom(aberta, 'veiculacao'), ' a');
  assert.equal(dataTxt(aberta, 'prazo'), '<small>prazo</small>15/11'); assert.equal(dataTxt(aberta, 'veiculacao'), '<small>no ar</small>hoje');
  assert.match(dataAttrs(aberta, 'prazo'), /aria-label="Prazo 15\/11, vencido\. Mudar"/);
  assert.match(dataAttrs(aberta, 'prazo'), /onkeydown="if\(event\.key==='Enter'\|\|event\.key===' '\)\{event\.preventDefault\(\);this\.click\(\)\}"/, 'Enter e espaço abrem a data');
  assert.equal(dataTxt({ sit: 'aberta', d: { veiculacao_iso: '2026-11-19' } }, 'veiculacao'), '<small>no ar</small>amanhã');
  assert.equal(dataTxt({ sit: 'aberta', d: {} }, 'prazo'), '<small>prazo</small>—');
  const feita = { sit: 'concluida', d: { prazo_iso: '2026-11-10', veiculacao_iso: '2026-11-11' } };
  assert.equal(dataTom(feita, 'prazo'), '', 'feita não fica vermelha'); assert.doesNotMatch(datasFeitas(feita), /data-editar-data/);
  assert.equal(donoCurto(aberta), 'Beatriz +1'); assert.equal(donoRot(aberta), 'title="Responsável: Beatriz Souza, Jady Lima. Trocar" aria-label="Responsável: Beatriz Souza, Jady Lima. Trocar"');
  assert.equal(donoCurto({ d: { responsavel: '—' } }), 'ninguém');
  assert.match(donoRot({ d: { responsavel: '' } }), /Sem responsável\. Escolher/);
});

test('o editor de responsável é o de sempre e grava pelo /api/conteudo; o tutorial não abre por cima dele (#729)', () => {
  const gestor = readFileSync('vybe-gestor.js', 'utf8');
  assert.match(gestor, /function openOwnerEditor\(event, itemId\)/);
  assert.match(gestor, /menu\.id = 'dono-editor'/);
  const tutorial = readFileSync('vybe-mundo-tutorial.js', 'utf8');
  assert.match(tutorial, /const EM_ACAO = \['#status-editor', '#dono-editor'/);
});

test('CSS das linhas: só tokens --d3-*, sem !important, html body.mundo nem :has', () => {
  const css = readFileSync('padrao-v2/zm-a-5-tarefas.css', 'utf8');
  const bloco = css.slice(css.indexOf('/* Quem faz e as duas datas na linha'));
  assert.ok(bloco.length > 400);
  for (const l of bloco.split(/\r?\n/).filter((x) => x.includes('{'))) {
    assert.doesNotMatch(l, /!important|html body\.mundo|:has\(/, l);
    assert.doesNotMatch(l, /#[0-9a-f]{3,8}\b|rgba?\(/i, l);
  }
  assert.match(css, /grid-template-columns:60px 28px minmax\(0,1fr\) 112px 120px 148px 84px/);
  assert.match(css, /grid-template-areas:"f n n w" "f t s d"/, 'no celular, quem faz sobe para a linha do nome');
  assert.ok(readFileSync('vybe-mundo-padrao-v2.css', 'utf8').includes('#vv-hoje .v2t-dono{appearance:none'), 'rodou padrao-v2-juntar');
});
