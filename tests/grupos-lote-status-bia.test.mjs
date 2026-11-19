// Produção › Grupos para a Coordenação (Bia, 18/11/2026): "selecionar mais de um pra fazer alterações", "filtrar pro
// status" e "editar tudo dentro do cartão da atividade". As caixas ficam sempre à vista e a de cima marca o recorte; a
// barra de lote é a de sempre (#lote-deck, que grava pelo /api/conteudo); o status filtra na cabeça da folha; a linha abre
// o cartão rápido com título, status, responsável, prazo, veiculação e formato à mão (a gaveta da peça não muda aqui).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const gestor = readFileSync('vybe-gestor.js', 'utf8');
const agenda = readFileSync('vybe-agenda.js', 'utf8');
const fatia = (src, ini) => { const i = src.indexOf(ini); assert.ok(i >= 0, ini); const m = /\r?\n\}\r?\n/.exec(src.slice(i)); return src.slice(i, i + m.index + m[0].length); };
const linhaDe = (src, ini) => { const i = src.indexOf(ini); assert.ok(i >= 0, ini); return src.slice(i, src.indexOf('\n', i)); };

function montar() {
  const SELECIONADAS = new Set();
  const itens = [
    { id: 'vybe:1', nome: 'Card - Natal', status: 'Pode Fazer', prazo_iso: '2026-11-20', veiculacao_iso: '2026-11-25', responsavel: 'Bia' },
    { id: 'vybe:2', nome: 'Reels - Bastidores', status: 'Alteração', prazo_iso: '2026-11-10', veiculacao_iso: '2026-11-12', responsavel: '' },
    { id: 'vybe:3', nome: 'Story - Oferta', status: 'Pode Fazer', prazo_iso: '2026-11-21', veiculacao_iso: '2026-11-26', responsavel: 'Bia' },
  ];
  const ctx = vm.createContext({
    SELECIONADAS, window: {}, console, Intl, ORDEM: { campo: '', desc: false }, LINHAS_POR_GRUPO: 50, gruposExpandidos: new Set(), buscaClienteConteudos: '',
    safeText: (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), jsArg: (v) => String(v), pv2HojeIso: () => '2026-11-18',
    pv2SemDono: (i) => !i.responsavel, atividadeDoDiaConcluida: () => false, managerCalendarMonthMeta: () => ({ first: new Date('2026-11-01T12:00:00Z') }),
    pillEditavel: (i, c) => `<button class="grupo-pill-btn">${i[c] || ''}</button>`, pv2StatusBotao: (i) => `<button class="pv2-st">${i.status}</button>`, pv2Av: () => '', pv2Foto: () => '',
    botaoClientesDoItem: () => '', botaoDePreviaNaLinha: () => '', clientesDoItem: () => ['Cliente'], cadastroDaPeca: () => ({ quem: '', quando: '' }), D3P_MAIS: '+', PV2_IC: { depois: '>', baixo: 'v', ok: 'ok' },
    renderVisaoDeGrupos: () => { ctx.repintou = (ctx.repintou || 0) + 1; }, repintou: 0,
  });
  const codigo = [
    linhaDe(gestor, 'let pv2GruposSel = '), linhaDe(gestor, 'let pv2GruposCaptacao = '), linhaDe(gestor, 'const PV2_GRUPOS_EXTRAS = '), linhaDe(gestor, 'const pv2GruposRedesenha = '),
    linhaDe(gestor, 'const pv2Vista = '), linhaDe(gestor, 'const pv2Pl = '), fatia(gestor, 'function pv2Cons('), fatia(gestor, 'function pv2Vlin('),
    linhaDe(gestor, 'function pv2GruposFiltrarStatus('), fatia(gestor, 'function pv2GruposMarcarRecorte('), linhaDe(gestor, 'const pv2GrupoVencida = '),
    gestor.slice(gestor.indexOf('const pv2GruposClientes = new Set();'), gestor.indexOf('function pv2GruposChavePrefs(')),
    linhaDe(gestor, "let pv2GruposMenuQual = ''"),
    fatia(gestor, 'function pv2GrupoLinha('), fatia(gestor, 'function pv2GruposHtml('),
    'this.html = (g) => pv2GruposHtml({ grupos: g, quadro: "producao" }); this.filtrar = pv2GruposFiltrarStatus; this.marcar = pv2GruposMarcarRecorte; this.vista = () => pv2Vista;',
  ].join('\n');
  vm.runInContext(codigo, ctx);
  return { ctx, SELECIONADAS, grupos: [{ id: 'g1', nome: 'Redação', itens }] };
}

test('Grupos: caixas de marcar sempre à vista, a de cima e "Marcar" marcam o recorte, a barra de lote é a de sempre', () => {
  const { ctx, SELECIONADAS, grupos } = montar();
  let html = ctx.html(grupos);
  assert.equal((html.match(/<td class="grupo-marcar"/g) || []).length, 3, 'uma caixa por linha, sem ligar "Marcar várias"');
  assert.match(html, /<th class="grupo-marcar"><input type="checkbox"[^>]*onchange="selecionarGrupo\('g1',this\.checked,'producao'\)"/, 'sem filtro, a de cima marca o grupo inteiro, como antes');
  assert.match(html, /alternarSelecao\('vybe:1',this\.checked,event\)/, 'a caixa da linha é a de sempre (shift marca o intervalo)');
  assert.match(ctx.vista().grupos.lado, /pv2GruposMarcarRecorte\(true\)/, 'na coluna de consulta, marcar as do recorte');
  assert.doesNotMatch(html, /tem-lote/);
  ctx.filtrar('Pode Fazer'); html = ctx.html(grupos);
  assert.match(html, /<th class="grupo-marcar"><input type="checkbox"[^>]*onchange="pv2GruposMarcarRecorte\(this\.checked\)"/, 'com filtro, a de cima marca só o recorte');
  ctx.marcar(true);
  assert.deepEqual([...SELECIONADAS].sort(), ['vybe:1', 'vybe:3'], 'marca só o que está no filtro de status');
  assert.equal(ctx.repintou, 2, 'repinta a folha (e com ela o #lote-deck)');
  html = ctx.html(grupos);
  assert.match(html, /d3m-a-folha d3m-a-gr tem-lote/, 'com marcadas, a folha reserva a faixa da barra de lote');
  assert.match(ctx.vista().grupos.lado, /<b>Limpar a seleção<\/b> · 2 marcadas/);
  ctx.marcar(false); assert.equal(SELECIONADAS.size, 0);
  // A barra de lote é a mesma de sempre: status, responsável, prazo e veiculação, e grava pelo /api/conteudo.
  const deck = fatia(agenda, 'function deckDeLoteHtml(');
  for (const a of ["loteStatus(event)", "loteResponsavel(event)", "lotePrazo(event,'prazo')", "lotePrazo(event,'veiculacao')"]) assert.ok(deck.includes(a), a);
  assert.match(readFileSync('vybe-dominio.js', 'utf8'), /fetch\('\/api\/conteudo'/);
});

test('Grupos: o status filtra a folha pela cabeça, com a contagem de cada um', () => {
  const { ctx, grupos } = montar();
  let html = ctx.html(grupos);
  assert.match(html, /<button type="button" class="s-f-filtro" data-s-f="status" aria-haspopup="dialog" aria-expanded="false" onclick="pv2GruposAbrirMenu\(event,'status'\)"[^>]*>Status · <b>todos<\/b>/);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.vista().grupos.filtros.status)), [['Pode Fazer', 2], ['Alteração', 1]], 'o menu traz cada status com a contagem');
  ctx.filtrar('Alteração'); html = ctx.html(grupos);
  assert.equal((html.match(/<tr /g) || []).length, 1); assert.match(html, /Reels/); assert.match(html, /class="s-f-filtro tem" data-s-f="status"[^>]*>Status · <b>Alteração<\/b>/); assert.match(html, /aria-label="Tirar o filtro Status: Alteração"/);
  assert.equal(ctx.vista().grupos.exporta.itens.length, 1, 'o exportar e o "marcar" seguem o filtro');
  ctx.filtrar('Agendado'); html = ctx.html(grupos);
  assert.equal((html.match(/<tr /g) || []).length, 3, 'status que não existe no grupo volta a todos');
});

test('Cartão da atividade: título, status, responsável, prazo, veiculação e formato editáveis ali mesmo', () => {
  const ini = agenda.indexOf('cartao.innerHTML = `'), ess = agenda.slice(agenda.indexOf('cr-campos cr-essenciais', ini), agenda.indexOf('<details class="cr-mais"', ini));
  for (const r of ["linha('Status'", "linha('Responsável'", "linha('Prazo'", "'Conclusão' : 'Veiculação'", "'Tipo de demanda' : 'Formato', pillEditavel(item, 'formato')"]) assert.ok(ess.includes(r), r);
  const mais = agenda.slice(agenda.indexOf('<details class="cr-mais"', ini), agenda.indexOf('</details>', ini));
  assert.ok(!mais.includes("pillEditavel(item, 'formato')"), 'o formato não fica repetido em Mais campos');
  assert.match(agenda, /class="cr-titulo" role="button" tabindex="0"\s+onclick="event\.stopPropagation\(\);renomearPeca/);
  // A gaveta da peça não muda aqui (outro agente cuida dela): "Abrir a peça" segue levando a ela.
  assert.match(agenda, /ehDemanda \? `openDemandaWorkspace\('\$\{jsArg\(item\.id\)\}'\)` : `openItemWorkspace\('\$\{jsArg\(item\.id\)\}'\)`/);
  // A linha continua abrindo pelo mesmo caminho (a interceptação vira o cartão rápido).
  assert.match(fatia(gestor, 'function pv2GrupoLinha('), /onclick="openItemWorkspace\('\$\{id\}'\)"/);
});

test('CSS de Grupos: só tokens --d3-*, sem !important nem html body.mundo', () => {
  const css = readFileSync('padrao-v2/zm-a-1-producao.css', 'utf8');
  const novos = css.split(/\r?\n/).filter((l) => /d3m-a-g-st|tem-lote/.test(l));
  assert.ok(novos.length >= 6);
  for (const l of novos) { assert.doesNotMatch(l, /!important|html body\.mundo|:has\(/, l); assert.doesNotMatch(l, /#[0-9a-f]{3,8}\b(?![-\w])|rgba?\(/i, l); }
  const juntado = readFileSync('vybe-mundo-padrao-v2.css', 'utf8');
  assert.ok(juntado.includes('.d3m-a-g-st > select') && !juntado.includes('gv2-com-formato'), 'rodou padrao-v2-juntar');
});
