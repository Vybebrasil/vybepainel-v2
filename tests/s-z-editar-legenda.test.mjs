// Frente s-z, segundo pedido (25/11/2026): editar a legenda e o briefing ali mesmo, no Checklist de qualidade. Recado da
// equipe sobre o print da peça de vinho com "Sem legenda cadastrada": "seria bom poder editar o que não está ok"; Paulo:
// "entendeu também? melhora". SAFE: funções no vm com DOM de mentira e PGlite em memória; nada sai do teste.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { conexao } from './postgres.mjs';
import { editarLegendaDaPeca, podeEditarLegendaDaPeca, pecaDoPlanejamento, conteudoDoItem } from '../server/planejamentos.js';
import { areaPlanejamentos } from '../server/planejamentos-api.js';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const portoes = ler('vybe-portoes.js'), material = ler('vybe-material.js'), briefing = ler('vybe-briefing.js');
const trecho = (fonte, de, ate) => { const i = fonte.indexOf(de); assert.ok(i >= 0, `sem ${de}`); const f = fonte.indexOf(ate, i); assert.ok(f > i, `sem ${ate}`); return fonte.slice(i, f); };
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// O pedaço da mesa que lê e grava os textos, com um DOM mínimo (elementos por id) e as gravações de mentira.
function mesa() {
  const els = new Map();
  const el = (id) => { if (!els.has(id)) els.set(id, { id, hidden: true, disabled: false, textContent: '', innerHTML: '', value: '', classes: new Set(), addEventListener() {}, focus() {}, setSelectionRange() {} }); const x = els.get(id); x.classList ??= { toggle: (k, on) => (on ? x.classes.add(k) : x.classes.delete(k)), contains: (k) => x.classes.has(k) }; return x; };
  const _ignorar = () => { return els.get(id); };
  const chamadas = { fetch: [], briefing: [], historico: [], toast: [] };
  const c = vm.createContext({
    safeText: esc, console,
    document: { getElementById: (id) => el(id) },
    fetch: async (url, op) => { chamadas.fetch.push({ url, corpo: JSON.parse(op.body) }); const b = JSON.parse(op.body); return { ok: true, status: 200, json: async () => ({ ok: true, legenda: b.legenda, mudou: true, versao: 4 }) }; },
    gravarBriefing: async (item, texto) => { chamadas.briefing.push({ item, texto }); return { ok: true, briefing: texto }; },
    postItemUpdate: async (item, corpo) => { chamadas.historico.push({ item, corpo }); return true; },
    showToast: (...a) => chamadas.toast.push(a),
    pendingWorkflowChange: null,
  });
  vm.runInContext(trecho(briefing, 'function briefingDaPeca', '// O mesmo indicador'), c);
  vm.runInContext(trecho(briefing, 'function briefingEhTitulo', '// O briefing chega como texto corrido'), c);
  vm.runInContext(trecho(briefing, 'function briefingEmSecoes', '// O que aparece sem precisar abrir'), c);
  vm.runInContext(trecho(material, '// A legenda mora no briefing', 'function fichaDaPreviaHtml'), c);
  vm.runInContext(trecho(portoes, 'const ESSENCIAL_DO_BRIEFING', '// O palco:'), c);
  vm.runInContext(`let LEGENDA_DA_CONFERENCIA = ''; let DETALHE_DA_CONFERENCIA = null;
    globalThis.porDetalhe = (d) => { DETALHE_DA_CONFERENCIA = d; };`, c);
  vm.runInContext(trecho(portoes, 'function pintarTextosDaConferencia', 'function copiarLegendaDaConferencia'), c);
  return { c, el, chamadas };
}
const plan = (extra = {}) => ({ legenda: '', objetivo: '', tema: '', linha: '', telas: [], referencia: '', observacao: '', ajuste_cliente: '', mes: '2026-11-01', ...extra });
const BRIEF = 'O CORAÇÃO DO PEDIDO\nObjetivo: Vender o rodízio de dezembro\nCTA: Reserve pelo link\n\nLEGENDA DO POST\nLegenda antiga do vinho\n\nREFERÊNCIAS\n- Foto da mesa posta';

test('destino: planejamento para quem edita o planejamento; briefing sem planejamento; sem permissão e com legenda do planejamento, sem botão', () => {
  const { c } = mesa();
  assert.equal(c.destinoDaLegendaDaConferencia({ id: 'vybe:1', planejamento: plan({ legenda: 'Do plano', pode_editar: true }) }), 'planejamento');
  assert.equal(c.destinoDaLegendaDaConferencia({ id: 'vybe:1', planejamento: plan({ legenda: '', pode_editar: true }) }), 'planejamento', 'plano sem legenda: grava no plano (o VybeHub vê)');
  assert.equal(c.destinoDaLegendaDaConferencia({ id: 'vybe:1', planejamento: plan({ legenda: 'Do plano', pode_editar: false }) }), '', 'a do plano é a que aparece: sem permissão, sem botão');
  assert.equal(c.destinoDaLegendaDaConferencia({ id: 'vybe:1', planejamento: plan({ legenda: '' }) }), 'briefing', 'plano sem legenda e sem permissão: o briefing, que é o que a janela mostra');
  assert.equal(c.destinoDaLegendaDaConferencia({ id: 'vybe:1', briefing: BRIEF, planejamento: null }), 'briefing');
  assert.equal(c.destinoDaLegendaDaConferencia({ id: 'vybe:1' }), 'briefing', 'sem legenda nenhuma: escreve no briefing');
  assert.equal(c.destinoDaLegendaDaConferencia(null), '');
  assert.equal(c.destinoDaLegendaDaConferencia({ planejamento: null }), '', 'sem a peça lida, sem botão');
  assert.equal(c.podeEditarBriefingDaConferencia(null), false);
  assert.equal(c.podeEditarBriefingDaConferencia({ id: '9900' }), true);
});

test('briefing com a legenda nova: troca a seção Legenda, tira a linha solta, cria a seção, apaga; a janela lê de volta a mesma', () => {
  const { c } = mesa();
  const legendaDe = (texto) => c.textosDaConferencia({ id: 'x', briefing: texto }).legenda;
  const nova = 'Dezembro começa à mesa 🍷\nReserve: link na bio';
  const trocado = c.briefingComLegenda(BRIEF, nova);
  assert.deepEqual({ ...legendaDe(trocado) }, { texto: nova, origem: 'do briefing' });
  assert.match(trocado, /^O CORAÇÃO DO PEDIDO\nObjetivo: Vender o rodízio de dezembro\nCTA: Reserve pelo link/, 'o resto do briefing fica');
  assert.match(trocado, /REFERÊNCIAS\n- Foto da mesa posta$/);
  assert.doesNotMatch(trocado, /Legenda antiga/);
  // "Legenda: …" numa linha só, sem seção: sai a linha, entra a seção no fim
  const solta = c.briefingComLegenda('Objetivo: Vender\nLegenda: velha\nCTA: link', 'Nova legenda');
  assert.equal(solta, 'Objetivo: Vender\nCTA: link\n\nLEGENDA DO POST\n```\nNova legenda\n```');
  assert.equal(legendaDe(solta).texto, 'Nova legenda');
  // sem briefing nenhum: só a seção; a janela segue dizendo "Sem briefing" (a legenda tem o bloco dela)
  const sem = c.briefingComLegenda('', 'Primeira legenda');
  assert.equal(legendaDe(sem).texto, 'Primeira legenda');
  assert.equal(c.textosDaConferencia({ id: 'x', briefing: sem }).briefing.tem, false);
  // apagar a legenda tira a seção
  assert.equal(legendaDe(c.briefingComLegenda(BRIEF, '')).texto, '');
  // cerca dentro da legenda não quebra o briefing
  assert.equal(legendaDe(c.briefingComLegenda(BRIEF, 'a\n```\nb')).texto, "a\n'''\nb");
});

test('salvar: a legenda do planejamento vai por legenda_da_peca e a do briefing pela rota do briefing; histórico e origem na tela', async () => {
  // 1. planejamento aprovado, quem pode editar
  let { c, el, chamadas } = mesa();
  let detalhe = { id: '9900', planejamento: plan({ legenda: '', pode_editar: true }) };
  c.porDetalhe(detalhe); c.pintarTextosDaConferencia(detalhe);
  assert.equal(el('vbc-legenda-editar').hidden, false);
  assert.equal(el('vbc-legenda-editar').textContent, 'Escrever legenda', 'vazia: o botão diz o que faz');
  assert.match(el('vbc-legenda-corpo').innerHTML, /Sem legenda cadastrada/);
  c.editarTextoDaConferencia('legenda');
  assert.match(el('vbc-legenda-corpo').innerHTML, /<textarea id="vbc-campo"[^]*Ctrl\+Enter salva[^]*Cancelar[^]*Salvar/);
  assert.match(el('vbc-legenda-corpo').innerHTML, /no planejamento aprovado \(o cliente vê no VybeHub\)/);
  el('vbc-campo').value = 'Vinho da casa em dobro\r\naté sexta';
  await c.salvarTextoDaConferencia();
  assert.deepEqual(chamadas.fetch.map((x) => [x.url, x.corpo]), [['/api/painel?area=planejamentos', { acao: 'legenda_da_peca', item: '9900', legenda: 'Vinho da casa em dobro\naté sexta' }]]);
  assert.equal(chamadas.briefing.length, 0, 'o briefing não muda');
  assert.deepEqual(chamadas.historico, [{ item: '9900', corpo: '[Vybe OS · Legenda editada na conferência]\nVinho da casa em dobro\naté sexta' }]);
  assert.match(el('vbc-legenda-corpo').innerHTML, /<p class="vbc-legenda-txt">Vinho da casa em dobro\naté sexta<\/p>/);
  assert.equal(el('vbc-legenda-info').textContent, 'do planejamento aprovado');
  assert.equal(el('vbc-legenda-editar').textContent, 'Editar');

  // 1b. o teto de 2.200 (Instagram e VybeHub): o contador embaixo do campo, vermelho perto do fim; acima, não salva
  ({ c, el, chamadas } = mesa());
  detalhe = { id: '9900', planejamento: plan({ legenda: '', pode_editar: true }) };
  c.porDetalhe(detalhe); c.pintarTextosDaConferencia(detalhe);
  c.editarTextoDaConferencia('legenda');
  assert.match(el('vbc-legenda-corpo').innerHTML, /<\/textarea>\s*<span id="vbc-campo-conta" class="vbc-campo-conta" aria-live="polite"><\/span>/);
  assert.equal(el('vbc-campo-conta').textContent, '0/2200');
  const contar = (n) => { el('vbc-campo').value = 'x'.repeat(n); c.contarLegendaDaConferencia(); const k = el('vbc-campo-conta'); return [k.textContent, k.classList.contains('perto'), k.classList.contains('passou'), el('vbc-campo-salvar').disabled]; };
  assert.deepEqual(contar(1979), ['1979/2200', false, false, false]);
  assert.deepEqual(contar(1980), ['1980/2200', true, false, false], 'vermelho a partir de 90%');
  assert.deepEqual(contar(2200), ['2200/2200', true, false, false], '2.200 ainda salva');
  assert.deepEqual(contar(2201), ['2201/2200', true, true, true], 'acima: Salvar desligado');
  await c.salvarTextoDaConferencia();
  assert.equal(chamadas.fetch.length, 0, 'nem pelo Ctrl+Enter');
  assert.match(chamadas.toast.at(-1)[0], /2201 caracteres; o máximo é 2200 \(o limite do Instagram\)/);
  contar(2200); await c.salvarTextoDaConferencia();
  assert.equal(chamadas.fetch.length, 1);
  assert.equal(chamadas.fetch[0].corpo.legenda.length, 2200);

  // 2. sem planejamento: a seção Legenda do briefing, pela rota do briefing
  ({ c, el, chamadas } = mesa());
  detalhe = { id: 'vybe:77', briefing: BRIEF, planejamento: null };
  c.porDetalhe(detalhe); c.pintarTextosDaConferencia(detalhe);
  c.editarTextoDaConferencia('legenda');
  assert.equal(el('vbc-campo').value, 'Legenda antiga do vinho', 'o campo abre com a legenda que está na tela');
  el('vbc-campo').value = 'Legenda nova do vinho';
  await c.salvarTextoDaConferencia();
  assert.equal(chamadas.fetch.length, 0, 'nada no planejamento');
  assert.equal(chamadas.briefing.length, 1);
  assert.equal(chamadas.briefing[0].item, 'vybe:77');
  assert.match(chamadas.briefing[0].texto, /LEGENDA DO POST\n```\nLegenda nova do vinho\n```/);
  assert.match(chamadas.briefing[0].texto, /Objetivo: Vender o rodízio de dezembro/);
  assert.match(el('vbc-legenda-corpo').innerHTML, /Legenda nova do vinho/);
  assert.equal(el('vbc-legenda-info').textContent, 'do briefing');
  assert.equal(chamadas.historico.length, 1);

  // 3. o briefing inteiro, pela mesma rota; sem nota de legenda
  c.editarTextoDaConferencia('briefing');
  Object.assign(el('vbc-campo-salvar'), { disabled: false, textContent: 'Salvar' }); // no DOM de verdade o Salvar é novo a cada edição (innerHTML)
  assert.equal(el('vbc-campo').value, detalhe.briefing);
  el('vbc-campo').value = 'Objetivo: Vender mais vinho\nCTA: Reserve já';
  await c.salvarTextoDaConferencia();
  assert.deepEqual(chamadas.briefing[1], { item: 'vybe:77', texto: 'Objetivo: Vender mais vinho\nCTA: Reserve já' });
  assert.equal(chamadas.historico.length, 1);
  assert.match(el('vbc-briefing-corpo').innerHTML, /Vender mais vinho/);

  // 4. sem permissão no planejamento que tem legenda: sem botão
  ({ c, el } = mesa());
  detalhe = { id: '9901', planejamento: plan({ legenda: 'Do plano', pode_editar: false }) };
  c.porDetalhe(detalhe); c.pintarTextosDaConferencia(detalhe);
  assert.equal(el('vbc-legenda-editar').hidden, true);
  c.editarTextoDaConferencia('legenda');
  assert.equal(el('vbc-legenda-corpo').innerHTML.includes('textarea'), false, 'nem pela função');
  // a leitura falhou: nenhum botão
  c.pintarTextosDaConferencia(null);
  assert.equal(el('vbc-legenda-editar').hidden, true);
  assert.equal(el('vbc-briefing-editar').hidden, true);
});

test('a janela: os botões no cabeçalho dos blocos, Cancelar volta o texto, e a caixa "Copy, legenda e CTA revisados" continua manual', () => {
  assert.match(portoes, /id="vbc-legenda-editar" class="vbj-btn vbc-editar" hidden onclick="editarTextoDaConferencia\('legenda'\)"/);
  assert.match(portoes, /id="vbc-briefing-editar" class="vbj-btn vbc-editar" hidden onclick="editarTextoDaConferencia\('briefing'\)"/);
  const salvar = trecho(portoes, 'async function salvarTextoDaConferencia', 'function copiarLegendaDaConferencia');
  assert.doesNotMatch(salvar, /checked|vbc-checks|updateQualityGateState/, 'salvar não marca caixa');
  assert.match(portoes, /'Copy, legenda e CTA revisados'/);
  const { c, el } = mesa();
  const d = { id: '1', briefing: BRIEF };
  c.porDetalhe(d); c.pintarTextosDaConferencia(d);
  const antes = el('vbc-briefing-corpo').innerHTML;
  c.editarTextoDaConferencia('briefing');
  assert.equal(el('vbc-briefing-editar').hidden, true);
  c.cancelarTextoDaConferencia();
  assert.equal(el('vbc-briefing-corpo').innerHTML, antes);
  assert.equal(el('vbc-briefing-editar').hidden, false);
});

async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY, nome text);
  INSERT INTO vybe_pessoas VALUES (1,'Head'),(2,'Outra pessoa');
  CREATE TABLE vybe_clientes(id bigint PRIMARY KEY, nome text);
  INSERT INTO vybe_clientes VALUES (5,'Gonzalez');
  CREATE TABLE vybe_cliente_pessoas(cliente_id bigint, pessoa_id bigint);
  INSERT INTO vybe_cliente_pessoas VALUES (5,1);
  CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY, monday_item_id text, titulo text, removido_em timestamptz);
  INSERT INTO vybe_conteudos VALUES (42,'9900','Card - Rodízio',NULL),(43,NULL,'Card - Vinho',NULL);
  CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint, cliente_id bigint);
  INSERT INTO vybe_conteudo_clientes VALUES (42,5),(43,5);
  CREATE TABLE vybe_planejamentos(id bigserial PRIMARY KEY, cliente_id bigint NOT NULL REFERENCES vybe_clientes(id), mes date NOT NULL, titulo text NOT NULL,
    conteudo jsonb NOT NULL DEFAULT '{}'::jsonb, estado text NOT NULL DEFAULT 'revisar', versao integer NOT NULL DEFAULT 1, atualizado_em timestamptz NOT NULL DEFAULT now());
  CREATE TABLE vybe_planejamento_eventos(id bigserial PRIMARY KEY, planejamento_id bigint NOT NULL REFERENCES vybe_planejamentos(id),
    tipo text NOT NULL CHECK (tipo IN ('publicado','nova_versao','editado','enviado','aprovado','ajustes','cadastrado','arquivado','comentario','email')),
    autor_id bigint REFERENCES vybe_pessoas(id), autor_externo text, texto text CHECK (texto IS NULL OR char_length(texto) <= 4000), versao integer, em timestamptz NOT NULL DEFAULT now());`);
  const conteudo = { visao: 'Dezembro', pecas: [
    { conteudo_id: '42', formato: 'Card', tema: 'Rodízio', legenda: '', objetivo: 'Vender' },
    { conteudo_id: '43', formato: 'Card', tema: 'Vinho', legenda: 'Vinho antigo', objetivo: 'Vender' }] };
  await sql`INSERT INTO vybe_planejamentos(cliente_id, mes, titulo, conteudo, estado, versao) VALUES (5, '2026-12-01', 'Dezembro', ${JSON.stringify(conteudo)}::jsonb, 'aprovado', 3)`;
  return { db, sql };
}

test('servidor: só a legenda daquela peça muda, a versão sobe, o estado fica, o evento é "comentario"; head e admin podem, os outros 403', async (t) => {
  const { db, sql } = await banco(); t.after(() => db.close());
  const head = { id: 1 }, outra = { id: 2 }, admin = { id: 9, admin: true };
  assert.equal(await podeEditarLegendaDaPeca(sql, head, 42), true);
  assert.equal(await podeEditarLegendaDaPeca(sql, admin, 42), true);
  assert.equal(await podeEditarLegendaDaPeca(sql, outra, 42), false);
  assert.equal(await podeEditarLegendaDaPeca(sql, null, 42), false);
  assert.equal(await podeEditarLegendaDaPeca(sql, head, 99), false, 'peça fora de planejamento: sem botão');
  assert.equal(await conteudoDoItem(sql, '9900'), '42');
  assert.equal(await conteudoDoItem(sql, 'vybe:43'), '43');
  assert.equal(await conteudoDoItem(sql, "9900' OR 1=1"), '');

  await assert.rejects(editarLegendaDaPeca(sql, outra, { item: '9900', legenda: 'Não pode' }), (e) => e.status === 403);
  await assert.rejects(editarLegendaDaPeca(sql, head, { item: '9900' }), /Falta o texto/);
  await assert.rejects(editarLegendaDaPeca(sql, head, { item: 'nada', legenda: 'x' }), /Peça inválida/);
  await assert.rejects(editarLegendaDaPeca(sql, head, { item: '9900', legenda: 'x'.repeat(2201) }), (e) => e.status === 400 && /A legenda tem 2201 caracteres; o máximo é 2200 \(o limite do Instagram\)\. Encurte e salve de novo\. Nada foi alterado\./.test(e.message));
  const r = await editarLegendaDaPeca(sql, head, { item: '9900', legenda: ' Dezembro começa à mesa\r\nlink na bio ' });
  assert.deepEqual(r, { planejamento_id: '1', legenda: 'Dezembro começa à mesa\nlink na bio', mudou: true, versao: 4 });
  const [p] = await sql`SELECT estado, versao, conteudo FROM vybe_planejamentos WHERE id = 1`;
  assert.equal(p.estado, 'aprovado', 'a aprovação do cliente fica');
  assert.equal(p.versao, 4);
  assert.deepEqual(p.conteudo.pecas.map((x) => x.legenda), ['Dezembro começa à mesa\nlink na bio', 'Vinho antigo'], 'só a peça 42');
  assert.deepEqual(p.conteudo.pecas[0], { conteudo_id: '42', formato: 'Card', tema: 'Rodízio', legenda: 'Dezembro começa à mesa\nlink na bio', objetivo: 'Vender' });
  assert.equal(p.conteudo.visao, 'Dezembro');
  const ev = await sql`SELECT tipo, autor_id, versao, texto FROM vybe_planejamento_eventos`;
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tipo, 'comentario');
  assert.equal(Number(ev[0].autor_id), 1);
  assert.match(ev[0].texto, /^Legenda editada na conferência \(Peça 1, [^)]*\): Dezembro começa à mesa/);
  // a conferência e o VybeHub leem o mesmo lugar
  assert.equal((await pecaDoPlanejamento(sql, 42)).legenda, 'Dezembro começa à mesa\nlink na bio');
  // o mesmo texto de novo não sobe versão nem registra
  assert.equal((await editarLegendaDaPeca(sql, admin, { item: 'vybe:42', legenda: 'Dezembro começa à mesa\nlink na bio' })).mudou, false);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_planejamento_eventos`)[0].n, 1);

  // pela rota de sempre (area=planejamentos), com a sessão
  const resposta = () => { const x = { codigo: 0, corpo: null }; x.status = (s) => { x.codigo = s; return x; }; x.json = (b) => { x.corpo = b; return x; }; x.setHeader = () => {}; return x; };
  let res = resposta();
  await areaPlanejamentos({ method: 'POST', query: { area: 'planejamentos' }, body: { acao: 'legenda_da_peca', item: 'vybe:43', legenda: 'Vinho novo' } }, res, { tipo: 'sessao', pessoa: outra }, sql);
  assert.equal(res.codigo, 403);
  res = resposta();
  await areaPlanejamentos({ method: 'POST', query: { area: 'planejamentos' }, body: { acao: 'legenda_da_peca', item: 'vybe:43', legenda: 'Vinho novo' } }, res, { tipo: 'sessao', pessoa: head }, sql);
  assert.equal(res.codigo, 200);
  assert.equal(res.corpo.legenda, 'Vinho novo');
  res = resposta();
  await areaPlanejamentos({ method: 'POST', query: {}, body: { acao: 'legenda_da_peca', item: 'vybe:43', legenda: 'x' } }, res, null, sql);
  assert.equal(res.codigo, 403, 'sem sessão');
  assert.equal((await editarLegendaDaPeca(sql, head, { item: 'vybe:43', legenda: 'y'.repeat(2200) })).legenda.length, 2200, '2.200 entra (o teto do Instagram)');
  assert.match(ler('api/painel.js'), /planejamento\.pode_editar = await Promise\.resolve\(\)\.then\(\(\) => podeEditarLegendaDaPeca\(db, quem\?\.pessoa, c\.id\)\)\.catch\(\(\) => false\);/);
});

test('CSS da edição: no fragmento s-z, só tokens, botões de 34', () => {
  const css = ler('padrao-v2/s-z.css').replace(/\/\*[^]*?\*\//g, '');
  assert.match(css, /\.vbc-editor-acoes \.vbj-btn\{height:34px;min-height:34px;[^}]*border-radius:var\(--d3-r-botao\)/);
  assert.match(css, /\.vbc-campo\{[^}]*color:var\(--d3-fume-texto\)/);
  assert.doesNotMatch(css, /!important|:has\(|html\s+body\.mundo|(?:rgba?|hsla?)\(/);
});
