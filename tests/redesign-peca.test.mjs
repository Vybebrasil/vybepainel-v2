// Redesign, quadros 23 (menus da tabela e lote) e 27 (prévia da peça), 10/11/2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const gestor = readFileSync('vybe-gestor.js', 'utf8');
const agenda = readFileSync('vybe-agenda.js', 'utf8');
const material = readFileSync('vybe-material.js', 'utf8');
const mundoCss = readFileSync('vybe-mundo.css', 'utf8');
const padraoCss = readFileSync('vybe-padrao.css', 'utf8');

const trecho = (fonte, de, ate) => fonte.slice(fonte.indexOf(de), fonte.indexOf(ate));

function seletorDeDono() {
  const time = ['Paulo', 'Deivid', 'Beatriz', 'Jady', 'Reriston', 'Tainara', 'Vinícius'].map((name, i) => ({ id: String(i + 1), name }));
  const c = vm.createContext({
    TEAM_USERS: time,
    ownerUsersFor: () => [time[0]],
    safeText: (t) => String(t ?? ''),
    firstName: (n) => String(n).split(' ')[0],
    ownerAvatarHtml: () => '',
    donoSelecionados: new Set(['1']),
    donoMostraTimeTodo: false,
  });
  vm.runInContext(trecho(gestor, 'let donoBusca', 'function redesenharListaDeDonos'), c);
  const regra = { label: 'Design', users: [time[1], time[2], time[3]] };
  const nomes = () => [...c.listaDoSeletorDeDono({}, regra).matchAll(/<b>([^<]+)<\/b>/g)].map((m) => m[1]);
  return { c, regra, nomes };
}

test('responsável: quem está na peça e a disciplina primeiro, o resto recolhido em "+ N fora da disciplina"', () => {
  const { c, regra, nomes } = seletorDeDono();
  assert.deepEqual(nomes(), ['Paulo', 'Deivid', 'Beatriz', 'Jady']);
  assert.equal(c.rotuloDoVerTodos({}, regra), '+ 3 fora da disciplina');
  vm.runInContext('donoMostraTimeTodo = true', c);
  assert.equal(nomes().length, 7);
  assert.equal(c.rotuloDoVerTodos({}, regra), 'Só a disciplina');
  // O atual vem marcado com o visto e aria-pressed.
  assert.match(c.listaDoSeletorDeDono({}, regra), /aria-pressed="true"[^]*?Paulo[^]*?✓/);
});

test('responsável: a busca acha qualquer pessoa do time, sem acento, e esconde o pé', () => {
  const { c, regra, nomes } = seletorDeDono();
  vm.runInContext("donoBusca = 'vini'", c);
  assert.deepEqual(nomes(), ['Vinícius']);
  assert.equal(c.rotuloDoVerTodos({}, regra), '');
  vm.runInContext("donoBusca = 'zz'", c);
  assert.match(c.listaDoSeletorDeDono({}, regra), /Ninguém do time com/);
});

test('responsável: abre recolhido, com a busca no topo, e o Esc da busca fecha o balão', () => {
  assert.match(gestor, /donoMostraTimeTodo = false;\r?\n\s*donoBusca = '';/);
  assert.match(gestor, /id="dono-busca"[^>]*oninput="buscarNoSeletorDeDono\(this\.value\)" onkeydown="teclaNaBuscaDeDono\(event\)"/);
  assert.match(gestor, /if \(event\.key === 'Escape'\) \{ event\.preventDefault\(\); event\.stopPropagation\(\); closeOwnerEditor\(\); return; \}/);
  // Grava pelo mesmo caminho: o estado da seleção, não o que está visível na lista recolhida.
  assert.match(gestor, /const selected = \[\.\.\.donoSelecionados\];/);
});

test('lote: quatro ações à vista e "Mais" com grupo, formato, captação e prioridade pelas mesmas funções', () => {
  const deck = trecho(agenda, 'function deckDeLoteHtml', 'function loteMais');
  for (const a of ["acao('Status'", "acao('Responsável'", "lotePrazo(event,'prazo')", "lotePrazo(event,'veiculacao')", 'loteMais(event,', 'loteArquivar()', 'limparSelecao()']) assert.ok(deck.includes(a), a);
  for (const fora of ['loteGrupo(', "loteEscolha(event,'formato')", "loteEscolha(event,'captacao')", "loteEscolha(event,'prioridade')"]) assert.ok(!deck.includes(fora), fora);
  const mais = trecho(agenda, 'function loteMais', '// A MESMA tabela do painel');
  for (const f of ['loteGrupo(ev, quadro)', "loteEscolha(ev, 'formato')", "loteEscolha(ev, 'captacao')", "loteEscolha(ev, 'prioridade')", "'#lote-deck .lote-mais'"]) assert.ok(mais.includes(f), f);
  assert.match(mais, /\.\.\.\(demandas \? \[\] : \[\{ rotulo: 'Captação'/, 'demandas não têm captação');
});

test('prévia: datas sem fuso e legenda saída do briefing', () => {
  const c = vm.createContext({ briefingDaPeca: (d) => (d?.briefing ? { texto: d.briefing } : null) });
  vm.runInContext(trecho(readFileSync('vybe-briefing.js', 'utf8'), 'function briefingEhTitulo', '// O que aparece sem precisar abrir'), c);
  vm.runInContext(trecho(material, 'function dataDaFichaDaPrevia', 'function fichaDaPreviaHtml'), c);
  assert.equal(c.dataDaFichaDaPrevia('2026-11-14'), 'sáb 14/11');
  assert.equal(c.dataDaFichaDaPrevia('2027-01-01'), 'sex 01/01');
  assert.equal(c.dataDaFichaDaPrevia(''), '');
  assert.equal(c.legendaDaPrevia({ briefing: 'Objetivo: vender\nLegenda: Bastidores da gravação' }), 'Bastidores da gravação');
  assert.equal(c.legendaDaPrevia({ briefing: 'LEGENDA\nPrimeira linha\nSegunda linha' }), 'Primeira linha\nSegunda linha');
  assert.equal(c.legendaDaPrevia({ briefing: 'Objetivo: vender' }), '');
  assert.equal(c.legendaDaPrevia({}), '');
});

test('prévia: ficha ao lado com status, cliente e datas pelo padrão; sem material, "Ainda sem material" e entregar', () => {
  const ficha = trecho(material, 'function fichaDaPreviaHtml', 'function pintarFichaDaPrevia');
  for (const p of ['statusCor(local)', 'nomesCli.map(cliCor)', "linha('Prazo'", "pedido ? 'Conclusão' : 'Veicula'", "linha('Quem fez'", 'openItemWorkspace(']) assert.ok(ficha.includes(p), p);
  assert.match(material, /<aside id="previa-ficha" class="previa-ficha" aria-label="Sobre a peça" hidden><\/aside>/);
  assert.match(material, /ficha\.hidden = !PREVIA_PECA;/, 'portão e arquivo solto: sem ficha');
  assert.match(material, /titulo: 'Ainda sem material'[^]*?vb-botao principal" onclick="trocarMaterialDaPrevia\(event\)">Entregar material/);
  assert.match(material, /conta\.hidden = PREVIA_MATERIAL\.length < 2; conta\.textContent = `\$\{PREVIA_GRANDE_INDICE \+ 1\} de \$\{PREVIA_MATERIAL\.length\}`/);
});

test('prévia: escuro só atrás da mídia no mundo; o visual antigo escopado fora dele, sem !important novo', () => {
  assert.doesNotMatch(mundoCss, /html body\.mundo(\.mundo-modulo)? \.previa-(grande|peca|video|capa|pasta)/, 'remendos de cor da prévia saíram');
  const bloco = mundoCss.slice(mundoCss.indexOf('/* ===== Menus da tabela (quadro 23'));
  assert.ok(bloco.length > 100);
  assert.doesNotMatch(bloco, /!important|html body\.mundo/);
  assert.match(bloco, /body\.mundo \.previa-ficha\{[^}]*background:#FFFFFF/);
  assert.match(bloco, /body\.mundo \.previa-grande-midia\{/);
  assert.match(bloco, /@media \(max-width:760px\)\{[^]*grid-template-rows:minmax\(58dvh,1fr\) auto/, 'no celular a ficha desce');
  assert.match(padraoCss, /^:where\(body:not\(\.mundo\)\) \.previa-grande\{/m);
  assert.doesNotMatch(padraoCss, /^\.previa-grande(-vidro)?\{/m);
});
