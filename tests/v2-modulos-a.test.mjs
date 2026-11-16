// Módulos V2 · grupo A (pranchas V2-M-* aprovadas pelo Paulo em 16/11/2026): as vistas da Produção (Mês, Grupos, Equipe
// e Feed) no esqueleto das pranchas, com as mesmas funções de antes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const fragmentos = readdirSync(new URL('../padrao-v2/', import.meta.url)).filter((f) => /^zm-a-.*\.css$/.test(f)).sort();
const semComentario = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('os fragmentos do grupo A seguem as regras do padrão: sem !important, sem html body.mundo, sem :has com [style], cor só por token', () => {
  assert.ok(fragmentos.length >= 2, 'há fragmentos zm-a-*');
  for (const f of fragmentos) {
    const css = semComentario(ler('padrao-v2/' + f));
    assert.doesNotMatch(css, /!important/, `${f}: sem !important`);
    assert.doesNotMatch(css, /html body\.mundo/, `${f}: sem html body.mundo`);
    assert.doesNotMatch(css, /:has\([^)]*\[style/, `${f}: sem :has com [style]`);
    // Cor em hex só na declaração dos tokens locais (--d3m-a-*), nunca solta numa regra.
    const semTokens = css.replace(/--d3m-a-[a-z-]+:#[0-9a-fA-F]{3,8}/g, '');
    assert.doesNotMatch(semTokens, /:[^;{}"']*#[0-9a-fA-F]{3,8}\b/, `${f}: hex só nos tokens locais`);
    // Animação nova não nasce de opacity 0 (o repouso congela o primeiro quadro e a peça some).
    for (const k of css.matchAll(/@keyframes[^{]+\{((?:[^{}]|\{[^}]*\})*)\}/g)) assert.doesNotMatch(k[1], /(from|0%)\s*\{[^}]*opacity:\s*0\b/, `${f}: keyframes sem começar em opacity 0`);
  }
  const junto = ler('vybe-mundo-padrao-v2.css');
  for (const f of fragmentos) assert.ok(junto.includes(`/* ===== padrao-v2/${f} ===== */`), `${f} entrou na folha junta`);
  assert.ok(junto.indexOf('padrao-v2/z-direcao.css') < junto.indexOf(`padrao-v2/${fragmentos[0]}`), 'depois da direção V2');
});

test('escolha e chave nas peças V2 usam aria-checked: a folha antiga pinta de preto todo botão com aria-pressed ou .active', () => {
  const gestor = ler('vybe-gestor.js');
  const semLinhaDeComentario = (t) => t.split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n');
  const v2 = semLinhaDeComentario(gestor.slice(gestor.indexOf('// ----- Direção V2: as outras vistas da Produção'), gestor.indexOf('// ----- a semana em colunas de dia')));
  assert.ok(v2.length > 2000);
  assert.doesNotMatch(v2, /aria-pressed|aria-selected|class="[^"]*\bactive\b/);
  assert.match(v2, /role="radio" aria-checked=/);
  assert.match(v2, /role="switch" aria-checked=/);
  const feed = ler('vybe-feed.js');
  const feedV2 = semLinhaDeComentario(feed.slice(feed.indexOf('function feedV2Ligado'), feed.indexOf('function feedV2Teclas')));
  assert.doesNotMatch(feedV2, /aria-pressed|aria-selected/);
});

test('Mês: a folha com o resumo de cada dia mantém as funções do calendário (lista do dia, cadastro, arrastar, mês, referência, cliente, carteira e fora do feed)', () => {
  const gestor = ler('vybe-gestor.js'), agenda = ler('vybe-agenda.js');
  assert.match(agenda, /const mesV2 = !noDa && typeof pv2MesHtml === 'function' && typeof pv2Ligado === 'function' && pv2Ligado\(\);/);
  assert.match(agenda, /if \(mesV2\) \{ wrap\.innerHTML = pv2MesHtml\(\{ meta, grouped, clients, semCarteira, escolhido \}\);/);
  // O calendário de antes continua inteiro para o tema antigo e para o DA Controler.
  assert.ok(agenda.includes('<div class="manager-calendar-title">Agenda mensal por cliente</div>'));
  const mes = gestor.slice(gestor.indexOf('function pv2MesHtml'), gestor.indexOf('// GRUPOS (prancha'));
  for (const f of ["abrirDiaDoCalendario(event,'${cell.iso}')", "managerCalendarAdd('${cell.iso}')", 'managerCalendarDragOver(event,this)', "managerCalendarDrop('${cell.iso}',event,this)", 'previaDoDiaAttrs(itens',
    'managerCalendarGoMonth(-1)', 'managerCalendarGoMonth(1)', 'managerCalendarGoToday()', "managerCalendarSetDateMode('veiculacao')", "managerCalendarSetDateMode('prazo')", 'abrirBuscaDeCliente(event)',
    'managerCalendarTodos()', "managerCalendarSetCarteira('${id}')", 'alternarForaDoFeed()', "switchBoard('demandas'", 'managerCalendarOpenClientMaster()', "abrirDoResumo('hoje')"]) assert.ok(mes.includes(f), `Mês mantém ${f}`);
  assert.ok(mes.includes('data-date="${cell.iso}"'), 'o dia guarda a data');
  assert.ok(mes.includes('atividadeDoDiaConcluida'), 'pronta é a regra de sempre (só Finalizado)');
});

test('Grupos: um grupo por vez, com os editores de sempre em cada célula, o lote, a ordem por coluna e o menu do grupo', () => {
  const gestor = ler('vybe-gestor.js'), agenda = ler('vybe-agenda.js');
  assert.match(agenda, /const gruposV2 = quadro === 'producao' && !forcar && !emprestadaAoDa\(cfg\.alvo\)/);
  assert.match(agenda, /if \(gruposV2\) \{ wrap\.innerHTML = pv2GruposHtml\(\{ grupos, quadro \}\);/);
  const g = gestor.slice(gestor.indexOf('// GRUPOS (prancha'), gestor.indexOf('// EQUIPE (prancha'));
  for (const f of ["openItemWorkspace('${id}')", "alternarSelecao('${id}',this.checked,event)", "copiarId('${id}')", 'botaoDePreviaNaLinha(item)', 'botaoClientesDoItem(item)', "escolha('formato')", 'pv2StatusBotao(item)',
    "salvarDataNaLinha('${item.id}','${campo}',this)", 'pv2Av(item)', "selecionarGrupo('${jsArg(grupo.id)}',this.checked,'${quadro}')", "ordenarPor('${campo}')", 'botaoDoMenuDoGrupo(quadro, grupo.id, grupo.nome)',
    "cadastrarNoGrupo('${quadro}','${jsArg(grupo.id)}')", "verGrupoInteiro('${jsArg(grupo.id)}')", 'buscarClienteConteudos(this.value)', 'botaoNovoGrupoNoFim(quadro)', 'renomearGrupoPeloNome(event']) assert.ok(g.includes(f), `Grupos mantém ${f}`);
  assert.ok(g.includes('id="busca-cliente-conteudos"'), 'a busca guarda o id');
  assert.ok(g.includes("class=\"d3m-a-g-tab grupo-tabela"), 'a tabela segue .grupo-tabela (o Shift marca o intervalo por ela)');
});

test('Equipe: a mesma conta do mês em linhas por pessoa e colunas por formato; pronta é só Finalizado', () => {
  const gestor = ler('vybe-gestor.js'), agenda = ler('vybe-agenda.js');
  assert.match(agenda, /if \(typeof pv2EquipePintar === 'function'\) pv2EquipePintar\(\);\r?\n\}/);
  const e = gestor.slice(gestor.indexOf('// EQUIPE (prancha'), gestor.indexOf('// ----- a semana em colunas de dia'));
  assert.ok(e.includes("const etapa = (d) => (atividadeDoDiaConcluida(d) ? 'g'"));
  assert.ok(e.includes('C.calcular({ itens: abertas, time, hoje: pv2HojeIso(), periodo: \'semana\''), 'o limite é o da Coordenação');
  assert.ok(e.includes("pv2FiltrarPessoa('${jsArg(x.id)}')") && e.includes('pv2AlternarSemDono()'));
});

// O Feed V2 montado fora do navegador: a lista, a grade e as semanas saem das mesmas contas da camada.
function ambienteFeed(itens, hoje = '2026-11-16') {
  const c = vm.createContext({ console, Intl, Date: class extends Date { constructor(...a) { super(...(a.length ? a : [`${hoje}T15:00:00Z`])); } static now() { return Date.parse(`${hoje}T15:00:00Z`); } },
    localStorage: { getItem: () => null, setItem() {} }, DADOS: itens, clientesDoItem: (i) => [i.cliente], safeText: String, jsArg: String,
    CADASTRO_CLIENTES: [{ nome: 'Lions', ativo: true, cadastro: { instagram: '@lions' }, heads: 'Ana' }, { nome: 'Voa', ativo: true, heads: 'Bia' }], carteiraDoCliente: (n) => (n === 'Lions' ? 'vinicius' : 'ewerton'),
    CARTEIRAS_DA_AGENDA: [{ id: 'vinicius', apelido: 'Viniceta' }, { id: 'ewerton', apelido: 'Galeguinho' }] });
  vm.runInContext(ler('vybe-feed.js'), c);
  return c;
}

test('Feed V2: fora do navegador nada liga; no mundo, a vista é desenhada dentro do Painel e a camada não abre', () => {
  const src = ler('vybe-feed.js');
  assert.ok(src.includes("if (wrap && feedAberto && feedV2Ligado()) { feedFecharCamada(); feedV2Pintar(wrap); return; }"));
  assert.ok(src.includes("feedLigarArrasto(wrap); feedLigarToque(wrap); feedV2Teclas();"), 'arrastar e segurar ligados no quadro');
  const c = ambienteFeed([]);
  assert.equal(vm.runInContext('feedV2Ligado()', c), false);
  const gestor = ler('vybe-gestor.js');
  assert.ok(gestor.includes('<span class="d3m-a-feed-ctl" id="pv2-feed-ctl"></span>'), 'o período e as setas do Feed moram no topo da janela');
});

test('Feed V2: a lista traz os clientes com os buracos, a carteira em escolha única e o cliente à mostra marcado', () => {
  const c = ambienteFeed([{ id: '1', cliente: 'Lions', formato: 'Reels', veiculacao_iso: '2026-11-17', status: 'A Fazer' }]);
  const html = vm.runInContext(`(() => { const l = feedOrdem(), m = new Map(l.map((x) => [x.nome, feedMontar(x)])); return feedV2ListaHtml(l, m, l[0], feedClientes()); })()`, c);
  assert.match(html, /<b>2 clientes<\/b><span>\d+ posts faltando<\/span>/);
  assert.match(html, /role="radio" aria-checked="true" onclick="feedFiltrar\('carteira','all'\)">Todos</);
  assert.match(html, /onclick="feedFiltrar\('carteira','vinicius'\)">Viniceta</);
  assert.equal((html.match(/data-vfd2-cli=/g) || []).length, 2);
  assert.match(html, /class="d3m-vlin vfd2-cli on" role="radio" aria-checked="true" data-vfd2-cli="[^"]+" onclick="feedFoco\(/);
  assert.match(html, /<select onchange="feedFiltrar\('head',this\.value\)"/, 'o filtro de head continua');
});

test('Feed V2: as semanas em calendário marcam o X, abrem a peça e deixam arrastar; a conta da semana é a régua de 3', () => {
  const c = ambienteFeed([
    { id: '1', cliente: 'Lions', formato: 'Reels', veiculacao_iso: '2026-11-17', status: 'A Fazer' },
    { id: '2', cliente: 'Lions', formato: 'Carrossel', veiculacao_iso: '2026-11-19', status: 'A Fazer' },
    { id: '3', cliente: 'Lions', formato: 'Card', veiculacao_iso: '2026-11-21', status: 'Finalizado' },
  ]);
  const html = vm.runInContext("(() => { const cli = { nome: 'Lions', usuario: '', heads: ['Ana'] }; return feedV2SemanasHtml(cli, feedMontar(cli)); })()", c);
  assert.equal((html.match(/class="vfd2-sem" role="row"/g) || []).length, 4, 'quatro semanas');
  assert.match(html, /16 a 22 nov<\/span>/);
  assert.match(html, /<b class="vfd2-sem-n g">3 de 3<\/b>/, 'a primeira semana está completa');
  assert.match(html, /<b class="vfd2-sem-n r">0 de 3<\/b>/);
  assert.match(html, /class="vfd2-dia vfd2-peca" draggable="true" data-vfd-item="1" data-vfd-alvo="2026-11-17" data-vfd-cliente="Lions" onclick="feedAbrirPeca\('1',event,false\)"/);
  assert.match(html, /class="vfd2-dia vfd2-x" role="switch" aria-checked="false" data-vfd-alvo="2026-11-23" data-vfd-cliente="Lions" onclick="feedMarcar\('Lions','2026-11-23'\)"/);
  assert.match(html, /class="vfd2-dia vfd2-nada" data-vfd-alvo="2026-11-18" data-vfd-cliente="Lions" onclick="feedMarcar\('Lions','2026-11-18'\)"/, 'dia livre também marca');
  // Marcada, a data vira chave ligada e a coluna da direita mostra a barra de cadastrar.
  const lado = vm.runInContext("(() => { FEED.sel = { cliente: 'Lions', isos: new Set(['2026-11-23', '2026-11-25']), fmt: 'card' }; const cli = { nome: 'Lions', usuario: '', heads: ['Ana'] }; return feedV2LadoHtml(cli, feedMontar(cli)); })()", c);
  assert.match(lado, /vfd2-x on" role="switch" aria-checked="true" data-vfd-alvo="2026-11-23"/);
  assert.match(lado, /<b>2 datas marcadas<\/b> · seg 23\/11 e qua 25\/11/);
  assert.match(lado, /onchange="feedLoteFormato\(this\.value\)"/);
  assert.match(lado, /onclick="feedCadastrarMarcadas\(\)"[^>]*>Cadastrar as 2</);
  assert.match(lado, /onclick="feedLimparMarcas\(\)"/);
  assert.match(lado, /onclick="feedLoteAbrir\('Lions'\)">Preencher em lote</);
  assert.match(lado, /Ana é o head\./);
  assert.match(lado, /onclick="feedCriarNoDia\('Lions',''\)"/, 'o Novo post continua');
});

test('Feed V2: a grade do meio usa as mesmas peças da camada (o X com o +, a peça que abre e arrasta) e separa o que vai sair do que está no ar', () => {
  const c = ambienteFeed([
    { id: '1', cliente: 'Lions', formato: 'Reels', veiculacao_iso: '2026-11-17', status: 'A Fazer' },
    { id: '4', cliente: 'Lions', formato: 'Card', veiculacao_iso: '2026-11-10', status: 'Finalizado' },
  ]);
  const html = vm.runInContext("(() => { const cli = { nome: 'Lions', usuario: '', heads: [], bio: '', site: '' }; return feedV2GradeHtml(cli, feedMontar(cli)); })()", c);
  assert.match(html, /a sair, o mais novo em cima/);
  assert.match(html, /<span>no ar<\/span>/);
  assert.match(html, /class="vfd-x-criar"[^>]*onclick="feedCriarNoDia\('Lions','2026-11-/);
  assert.match(html, /data-vfd-item="1" data-vfd-alvo="2026-11-17"/);
  assert.match(html, /vfd-passado/);
});
