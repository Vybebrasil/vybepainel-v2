// Rodada S, frente f, segunda volta (Paulo, 19/11/2026): a coluna ID sai da vista ("coisa de backend") e a folha de Grupos
// ganha mais filtros ("não seria ideal ter mais filtros?"): Pessoa, Formato, Data e "+ Filtros" (Carteira e Captação), todos
// juntos, com a busca e a ordem, e guardados por pessoa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = (x) => JSON.parse(JSON.stringify(x));
const agenda = ler('vybe-agenda.js'), gestor = ler('vybe-gestor.js'), perfis = ler('vybe-perfis.js');
const trecho = (src, ini, fim) => { const i = src.indexOf(ini); assert.ok(i >= 0, ini); const j = src.indexOf(fim, i + ini.length); assert.ok(j > i, fim); return src.slice(i, j); };

const HOJE = '2026-11-19'; // quinta-feira
const CARTEIRA = { Alpha1: 'vinicius', Gonzalez: 'ewerton', VOA: 'vinicius' };
function contexto(extra = {}) {
  const c = vm.createContext({
    Date, Number, String, Set, Map, Object, JSON,
    clientesDoItem: (d) => (d.clientes || [d.cliente]).filter(Boolean),
    clienteApareceNaLista: (n) => Boolean(n),
    carteiraDoCliente: (n) => CARTEIRA[n] || '',
    filtroCarteira: 'all',
    CARTEIRAS_DA_AGENDA: [{ id: 'vinicius', apelido: 'Viniceta', dono: 'Vinícius' }, { id: 'ewerton', apelido: 'Galeguinho', dono: 'Ewerton' }],
    TEAM_USERS: [{ id: '10', name: 'Paulo Martins' }, { id: '20', name: 'Bia Souza' }],
    catalogoDoCampo: () => [{ rotulo: 'Agendar Captação', ativa: true }, { rotulo: 'Captado', ativa: true }, { rotulo: 'Velha', ativa: false }],
    atividadeDoDiaConcluida: (i) => i.status === 'Finalizado',
    pv2HojeIso: () => HOJE,
    ORDEM_DOS_GRUPOS: ['topics', 'g2'], TITULO_DOS_GRUPOS: { topics: 'Redação', g2: 'Design' }, GROUP_MAP: {},
    selectedPersonIds: new Set(),
    ...extra,
  });
  vm.runInContext('function itemNaCarteira(item) { return filtroCarteira === "all" || clientesDoItem(item).some((n) => carteiraDoCliente(n) === filtroCarteira); }', c);
  vm.runInContext('let pv2GruposCaptacao = true, pv2GruposComId = false;', c);
  vm.runInContext(trecho(gestor, 'const pv2DiaMes = ', '\n'), c);
  vm.runInContext(trecho(agenda, 'function valorDeData(', 'function ordenarPor('), c);
  vm.runInContext('ORDEM = { campo: "veiculacao_iso", desc: false };', c);
  vm.runInContext(trecho(agenda, 'function itensPorGrupo(', '// ── ordenação por coluna'), c);
  vm.runInContext(trecho(perfis, 'function itemMatchesSelectedPeople(', 'function syncPersonFilterVisual('), c);
  vm.runInContext(trecho(gestor, 'const pv2GruposFormatos = new Set()', 'const pv2GruposRedesenha = '), c);
  vm.runInContext(trecho(gestor, 'const pv2GruposClientes = new Set();', 'function pv2GruposChavePrefs('), c);
  // const e let não viram propriedade do contexto: os conjuntos e a seta ficam à mão do teste por aqui.
  vm.runInContext('Object.assign(globalThis, { pv2GruposFormatos, pv2GruposCaptacoes, pv2GruposClientes, pv2GruposDataLigada });', c);
  return c;
}
const pecas = [
  { id: '1', nome: 'Feed A', cliente: 'Alpha1', group_id: 'topics', formato: 'Card', captacao: 'Captado', responsavel_id: '10', prazo_iso: '2026-11-17', veiculacao_iso: '2026-11-20', status: 'Pode Fazer' },
  { id: '2', nome: 'Story B', cliente: 'Gonzalez', group_id: 'topics', formato: 'Story', captacao: '—', responsavel_id: '20', prazo_iso: '2026-11-03', veiculacao_iso: '2026-11-05', status: 'Pode Fazer' },
  { id: '3', nome: 'Reels C', cliente: 'Alpha1', group_id: 'topics', formato: 'Reels', captacao: 'Agendar Captação', responsavel_id: '20', prazo_iso: '2026-12-01', veiculacao_iso: '', status: 'Pode Fazer' },
  { id: '4', nome: 'Card D', cliente: 'VOA', group_id: 'g2', formato: 'card', captacao: 'Captado', responsavel_id: '20', prazo_iso: '2026-11-09', veiculacao_iso: '2026-11-19', status: 'Finalizado' },
  { id: '5', nome: 'Card E', clientes: ['alpha1', 'VOA'], group_id: 'g2', formato: 'Card', captacao: '', responsavel_ids: ['10'], prazo_iso: '', veiculacao_iso: '2026-11-30', status: 'Pode Fazer' },
  { id: '6', nome: 'Card F', cliente: 'Gonzalez', group_id: 'g2', formato: 'Card', captacao: 'Captado', responsavel_id: '10', prazo_iso: '2026-11-25', veiculacao_iso: '2026-11-10', status: 'Alteração' },
];
const ids = (l) => js(l.map((i) => i.id));
const grupos = (c, l) => js(c.itensPorGrupo(l).map((g) => g.itens.map((i) => i.id)));

test('ID: fora da vista por padrão, volta pelo menu "Colunas", fica guardado; o title da linha e a busca ainda têm o ID', () => {
  assert.ok(gestor.includes('let pv2GruposComId = false;'), 'desligado por padrão');
  const pv2 = trecho(gestor, 'function pv2GruposHtml(', '\n}\n'), linha = trecho(gestor, 'function pv2GrupoLinha(', '\n}\n');
  assert.ok(pv2.includes("+ (comId ? th('id', 'ID') : '') + th('nome', 'Conteúdo')"), 'a cabeça só com o ID ligado');
  assert.ok(linha.includes("(comId ? `<td class=\"grupo-id\" onclick=\"${parar};copiarId('${id}')\""), 'a célula também, e com a cópia de sempre');
  assert.ok(linha.includes('title="Abrir ${safeText(nome)} · ${safeText(item.id)}"'), 'o ID inteiro no title da linha');
  assert.ok(pv2.includes("(comId ? [] : ['ID'])"), 'o rodapé conta o ID entre as colunas escondidas');
  assert.ok(gestor.includes("op('id', 'ID', pv2GruposComId)"), 'a opção no menu Colunas');
  assert.ok(gestor.includes("if (qual === 'id') { pv2GruposComId = !pv2GruposComId; pv2GruposGuardar(); }"));
  assert.ok(gestor.includes('pv2GruposComId = salvo.comId === true;'), 'guardado nas preferências');
  assert.match(trecho(agenda, 'function renderVisaoDeGrupos(', 'const peca = (n)'), /gruposV2 && \(String\(i\.nome[^)]*\)[^\n]*String\(i\.id\)\.toLocaleLowerCase/, 'a busca continua achando pelo ID');
  assert.ok(gestor.includes("['ID', 'Conteúdo', 'Cliente'"), 'o CSV continua com o ID');
  // Demandas já nasce sem o ID (preferência própria, desligada) e a tabela antiga da ficha não é chamada em lugar nenhum.
  assert.ok(ler('vybe-demandas.js').includes("painel?.classList.toggle('dem-mostrar-' + coluna, salvo[coluna] === true);"));
  assert.ok(ler('vybe-appearance.css').includes('#painel-demandas:not(.dem-mostrar-id) .grupo-tabela :is(th,td):nth-child(2)'));
});

test('ID: a largura sai da classe da cabeça, não da posição, e o Conteúdo fica com o que sobra', () => {
  const css = ler('padrao-v2/s-f.css'), pv2 = trecho(gestor, 'function pv2GruposHtml(', '\n}\n');
  assert.ok(pv2.includes('`<th class="s-f-c-${campo}"'), 'cada cabeça leva a classe do campo');
  assert.ok(pv2.includes('grupo-tabela s-f-cols'));
  assert.doesNotMatch(css, /nth-last-child|nth-child/, 'nada depende da posição da coluna');
  for (const [campo, w] of [['id', '60px'], ['nome', 'auto'], ['cliente', '15%'], ['formato', '78px'], ['status', '142px'], ['captacao', '156px'], ['prazo_iso', '62px'], ['veiculacao_iso', '94px'], ['responsavel', '74px']]) {
    assert.ok(css.includes(`.d3m-a-g-tab.s-f-cols:not(.larga) th.s-f-c-${campo}{width:${w}}`), campo);
  }
  assert.ok(css.includes('.d3m-a-g-tab.s-f-cols:not(.larga) th.grupo-marcar{width:40px}'), 'a caixa de marcar não herda a largura de outra coluna');
  assert.ok(trecho(gestor, 'function pv2GrupoLinha(', '\n}\n').includes('`<td class="s-f-td-${campo}"'), 'o Formato justo pela classe');
});

test('Filtros: cliente, formato, captação e data se somam, e pessoa e carteira entram por cima (itensPorGrupo)', () => {
  const c = contexto();
  assert.deepEqual(ids(c.pv2GruposAplicarFiltros(pecas)), ['1', '2', '3', '4', '5', '6'], 'sem nada ligado, nada sai');
  c.pv2GruposFormatos.add('Card');
  assert.deepEqual(ids(c.pv2GruposAplicarFiltros(pecas)), ['1', '4', '5', '6'], 'o formato sem diferença de maiúscula');
  c.pv2GruposClientes.add('Alpha1');
  assert.deepEqual(ids(c.pv2GruposAplicarFiltros(pecas)), ['1', '5'], 'cliente + formato');
  c.pv2GruposClientes.clear(); c.pv2GruposCaptacoes.add('Captado');
  assert.deepEqual(ids(c.pv2GruposAplicarFiltros(pecas)), ['1', '4', '6'], 'formato + captação');
  c.pv2GruposCaptacoes.add('');
  assert.deepEqual(ids(c.pv2GruposAplicarFiltros(pecas)), ['1', '4', '5', '6'], '"Sem captação" junta a peça vazia');
  vm.runInContext('pv2GruposData = { campo: "veiculacao_iso", recorte: "semana", de: "", ate: "" };', c);
  assert.deepEqual(ids(c.pv2GruposAplicarFiltros(pecas)), ['1', '4'], '+ esta semana na veiculação');
  c.selectedPersonIds.add('10');
  assert.deepEqual(grupos(c, c.pv2GruposAplicarFiltros(pecas)), [['1'], []], '+ pessoa (o mesmo selectedPersonIds do painel)');
  c.selectedPersonIds.clear(); vm.runInContext('filtroCarteira = "ewerton";', c);
  assert.deepEqual(grupos(c, c.pv2GruposAplicarFiltros(pecas)), [[], []], 'a carteira do Ewerton não tem nenhuma dessas');
  vm.runInContext('filtroCarteira = "vinicius";', c);
  assert.deepEqual(grupos(c, c.pv2GruposAplicarFiltros(pecas)), [['1'], ['4']]);
  // Os parâmetros explícitos (o que os números dos menus usam) não mexem no que está escolhido.
  assert.deepEqual(ids(c.pv2GruposAplicarFiltros(pecas, { formatos: new Set(), captacoes: new Set(), data: { recorte: '' } })), ['1', '2', '3', '4', '5', '6']);
  assert.equal(c.pv2GruposFormatos.size, 1);
});

test('Data: atrasadas, hoje, esta semana, próximos 7 dias, este mês e de/até, na Veiculação ou no Prazo', () => {
  const c = contexto();
  assert.deepEqual(js(c.pv2GruposJanela('hoje', HOJE)), [HOJE, HOJE]);
  assert.deepEqual(js(c.pv2GruposJanela('semana', HOJE)), ['2026-11-16', '2026-11-22'], 'de segunda a domingo');
  assert.deepEqual(js(c.pv2GruposJanela('semana', '2026-11-22')), ['2026-11-16', '2026-11-22'], 'o domingo ainda é desta semana');
  assert.deepEqual(js(c.pv2GruposJanela('7dias', HOJE)), [HOJE, '2026-11-25'], 'hoje e os seis seguintes');
  assert.deepEqual(js(c.pv2GruposJanela('mes', HOJE)), ['2026-11-01', '2026-11-30']);
  assert.deepEqual(js(c.pv2GruposJanela('mes', '2028-02-10')), ['2028-02-01', '2028-02-29'], 'fevereiro bissexto');
  const veic = (recorte, extra = {}) => ids(pecas.filter((i) => c.pv2GruposNaData(i, { campo: 'veiculacao_iso', recorte, de: '', ate: '', ...extra }, HOJE)));
  assert.deepEqual(veic('atrasadas'), ['2', '6'], 'antes de hoje e não finalizada (a 4 é de hoje; a sem data fica fora)');
  assert.deepEqual(veic('hoje'), ['4']);
  assert.deepEqual(veic('semana'), ['1', '4']);
  assert.deepEqual(veic('7dias'), ['1', '4']);
  assert.deepEqual(veic('mes'), ['1', '2', '4', '5', '6'], 'a peça sem veiculação não entra num recorte de data');
  assert.deepEqual(veic('intervalo', { de: '2026-11-10', ate: '2026-11-20' }), ['1', '4', '6'], 'de/até com as duas pontas');
  assert.deepEqual(veic('intervalo', { de: '2026-11-20' }), ['1', '5'], 'só "de"');
  assert.deepEqual(veic('intervalo', { ate: '2026-11-05' }), ['2'], 'só "até"');
  assert.deepEqual(veic('intervalo'), ['1', '2', '3', '4', '5', '6'], 'intervalo vazio ainda não filtra');
  assert.equal(c.pv2GruposDataLigada({ recorte: 'intervalo', de: '', ate: '' }), false);
  const prazo = (recorte) => ids(pecas.filter((i) => c.pv2GruposNaData(i, { campo: 'prazo_iso', recorte }, HOJE)));
  assert.deepEqual(prazo('atrasadas'), ['1', '2'], 'no Prazo (a 4 venceu, mas está finalizada)');
  assert.deepEqual(prazo('7dias'), ['6']);
  assert.equal(c.pv2GruposRotuloData({ recorte: 'semana' }), 'esta semana');
  assert.equal(c.pv2GruposRotuloData({ recorte: 'intervalo', de: '2026-11-10', ate: '2026-11-20' }), '10/11 a 20/11');
  assert.equal(c.pv2GruposRotuloData({ recorte: 'intervalo', de: '2026-11-10', ate: '' }), 'a partir de 10/11');
});

test('Opções dos menus: o número de cada uma soma os outros filtros, menos o do próprio menu', () => {
  const c = contexto();
  c.pv2GruposFormatos.add('Card');
  const o = js(c.pv2GruposOpcoesExtras(pecas, 'producao', HOJE));
  assert.deepEqual(o.formatos, [['Card', 'Card', 4], ['Reels', 'Reels', 1], ['Story', 'Story', 1]], 'o próprio Formato não se conta');
  assert.deepEqual(o.captacoes, [['Agendar Captação', 'Agendar Captação', 0], ['Captado', 'Captado', 3], ['', 'Sem captação', 1]], 'na ordem do catálogo; "Sem captação" no fim; a desligada fora');
  assert.deepEqual(o.pessoas, [['20', 'Bia Souza', 1], ['10', 'Paulo Martins', 3]]);
  assert.deepEqual(o.carteiras, { all: 4, vinicius: 3, ewerton: 1 });
  assert.equal(o.datas.semana, 2);
  assert.equal(js(c.pv2GruposOpcoesExtras(pecas, 'demandas', HOJE)).captacoes, null, 'Captação só na Produção');
  c.pv2GruposFormatos.add('Motion');
  assert.deepEqual(js(c.pv2GruposOpcoesExtras(pecas, 'producao', HOJE)).formatos.find((f) => f[0] === 'Motion'), ['Motion', 'Motion', 0], 'o escolhido aparece com zero, para poder sair');
});

test('Preferências: tudo fica guardado por pessoa, e pessoa e carteira só voltam quando nada está escolhido', () => {
  const guardado = new Map();
  const c = contexto({
    localStorage: { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, v) },
    pessoaLogada: () => ({ id: '10' }), CAMPOS_ORDENAVEIS: { veiculacao_iso: {}, prazo_iso: {} },
  });
  vm.runInContext(trecho(gestor, 'function pv2GruposChavePrefs(', 'const pv2GruposTemCliente'), c);
  c.pv2GruposRestaurar();
  c.pv2GruposFormatos.add('Card'); c.pv2GruposCaptacoes.add('Captado'); c.selectedPersonIds.add('20');
  vm.runInContext('pv2GruposData = { campo: "prazo_iso", recorte: "intervalo", de: "2026-11-01", ate: "2026-11-10" }; filtroCarteira = "ewerton"; pv2GruposComId = true;', c);
  c.pv2GruposGuardar();
  const salvo = JSON.parse(guardado.get('vybe_grupos_producao:10'));
  assert.deepEqual(salvo, { clientes: [], ordem: { campo: 'veiculacao_iso', desc: false }, comId: true, formatos: ['Card'], captacoes: ['Captado'],
    data: { campo: 'prazo_iso', recorte: 'intervalo', de: '2026-11-01', ate: '2026-11-10' }, pessoas: ['20'], carteira: 'ewerton' });
  // Outra sessão, mesma pessoa: volta tudo.
  const d = contexto({ localStorage: { getItem: (k) => guardado.get(k) ?? null, setItem: () => {} }, pessoaLogada: () => ({ id: '10' }), CAMPOS_ORDENAVEIS: { veiculacao_iso: {} } });
  vm.runInContext(trecho(gestor, 'function pv2GruposChavePrefs(', 'const pv2GruposTemCliente'), d);
  d.pv2GruposRestaurar();
  assert.deepEqual(js([...d.pv2GruposFormatos]), ['Card']);
  assert.deepEqual(js([...d.selectedPersonIds]), ['20']);
  assert.equal(vm.runInContext('filtroCarteira + "|" + pv2GruposData.campo + "|" + pv2GruposData.recorte + "|" + pv2GruposComId', d), 'ewerton|prazo_iso|intervalo|true');
  // Com uma pessoa já escolhida no painel, a guardada não passa por cima.
  const e = contexto({ localStorage: { getItem: (k) => guardado.get(k) ?? null, setItem: () => {} }, pessoaLogada: () => ({ id: '10' }), CAMPOS_ORDENAVEIS: {}, selectedPersonIds: new Set(['10']), filtroCarteira: 'vinicius' });
  vm.runInContext('function itemNaCarteira() { return true; }', e);
  vm.runInContext(trecho(gestor, 'function pv2GruposChavePrefs(', 'const pv2GruposTemCliente'), e);
  e.pv2GruposRestaurar();
  assert.deepEqual(js([...e.selectedPersonIds]), ['10']);
  assert.equal(vm.runInContext('filtroCarteira', e), 'vinicius');
});

test('Linha dos filtros: botões, menus de vidro e chips com × para cada filtro; "Limpar tudo" limpa todos', () => {
  const pv2 = trecho(gestor, 'function pv2GruposHtml(', '\n}\n');
  for (const qual of ['status', 'cliente', 'pessoa', 'formato', 'data']) assert.ok(pv2.includes(`filtroBt('${qual}', `), qual);
  assert.ok(pv2.includes('data-s-f="mais" aria-haspopup="dialog"'), 'Carteira e Captação no "+ Filtros"');
  assert.ok(pv2.includes("class=\"s-f-filtro s-f-mais${nMais ? ' tem' : ''}\""), 'o "+ Filtros" cheio quando tem um dos dois ligado');
  for (const chip of ['Pessoa: ${nomeDe(id)}', 'Formato: ${rotFormato(v)}', '${campoData}: ${rotData}', 'Carteira: ${rotCarteira}', "Captação: ${v || 'Sem captação'}"]) assert.ok(pv2.includes(`chip(\`${chip}\``), chip);
  assert.ok(pv2.includes('<b>${recorte.length}</b> de ${doGrupoTodo}'), '"N de M": M é o grupo sem filtro nenhum');
  assert.ok(trecho(agenda, 'function renderVisaoDeGrupos(', 'const peca = (n)').includes('pv2GruposHtml({ grupos, quadro, base: semCliente, semFiltro: cfg.fonte() })'));
  const limpar = trecho(gestor, 'function pv2GruposLimparTudo(', '\n}\n');
  for (const parte of ['pv2GruposClientes.clear()', "pv2GruposStatus = ''", 'pv2GruposFormatos.clear()', 'pv2GruposCaptacoes.clear()', "recorte: ''", "filterByPerson('all'", "definirFiltroCarteira('all')", "buscaClienteConteudos = ''"]) assert.ok(limpar.includes(parte), parte);
  const menu = trecho(gestor, 'function pv2GruposPintarMenu(', '\n}\n');
  for (const qual of ['pessoa', 'formato', 'data', 'mais']) assert.ok(menu.includes(`pv2GruposMenuQual === '${qual}'`), qual);
  assert.ok(menu.includes('type="date" class="s-f-busca" data-k="de"') && menu.includes('data-k="ate"'), 'o intervalo de/até');
  assert.ok(menu.includes("pv2GruposAlternarPessoa(this.dataset.v)"), 'a pessoa pelo filterByPerson de sempre');
  assert.match(trecho(gestor, 'function pv2GruposAlternarPessoa(', '\n'), /filterByPerson\(String\(id\)/);
  const css = ler('padrao-v2/s-f.css');
  assert.doesNotMatch(css, /!important/);
  assert.match(css, /@media \(max-width:760px\)\{\n  #grupos-board\.d3m-a-v2 \.s-f-ativos\{flex-wrap:nowrap;overflow-x:auto;/, 'no celular a linha rola de lado, só ela');
  assert.match(css, /\.s-f-seg > button\[aria-checked="true"\]\{--d3-tinta:var\(--d3-fume-painel\);background:var\(--d3-fume-texto\);color:var\(--d3-fume-painel\)/, 'Veiculação/Prazo escolhido cheio de tinta, letra contrária');
});
