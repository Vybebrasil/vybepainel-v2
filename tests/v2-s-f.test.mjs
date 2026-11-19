// Rodada S, frente f (Paulo, 19/11/2026): Grupos da Produção filtra por cliente junto com a pessoa e a busca, a tabela
// ordena pelo cabeçalho (data como data, crescente e decrescente), o selecionado da cabeça da folha deixa de sumir na
// barra, e o menu de status da peça separa Status e Captação.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = (x) => JSON.parse(JSON.stringify(x));
const agenda = ler('vybe-agenda.js'), gestor = ler('vybe-gestor.js'), status = ler('vybe-status.js'), perfis = ler('vybe-perfis.js');
const trecho = (src, ini, fim) => { const i = src.indexOf(ini); assert.ok(i >= 0, ini); const j = src.indexOf(fim, i + ini.length); assert.ok(j > i, fim); return src.slice(i, j); };
const safeText = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function contextoGrupos(extra = {}) {
  const c = vm.createContext({
    safeText, Date, Number, String, Set, Map,
    clientesDoItem: (d) => (d.clientes || [d.cliente]).filter(Boolean),
    clienteApareceNaLista: (n) => Boolean(n) && n !== 'Sem cliente',
    itemNaCarteira: () => true,
    cadastroDaPeca: (i) => ({ quem: i.cadastrado_por || '', ordem: i.criado_em || '' }),
    ORDEM_DOS_GRUPOS: ['topics', 'g2'], TITULO_DOS_GRUPOS: { topics: 'Redação', g2: 'Design' }, GROUP_MAP: {},
    selectedPersonIds: new Set(),
    ...extra,
  });
  vm.runInContext(trecho(agenda, 'function valorDeData(', 'function ordenarPor('), c);
  vm.runInContext('ORDEM = { campo: "veiculacao_iso", desc: false };', c);
  vm.runInContext(trecho(agenda, 'function itensPorGrupo(', '// ── ordenação por coluna'), c);
  vm.runInContext(trecho(perfis, 'function itemMatchesSelectedPeople(', 'function syncPersonFilterVisual('), c);
  vm.runInContext(trecho(gestor, 'const pv2GruposClientes = new Set();', 'function pv2GruposChavePrefs('), c);
  return c;
}
const pecas = [
  { id: '1', nome: 'Feed A', cliente: 'Alpha1', group_id: 'topics', responsavel_id: '10', prazo_iso: '2026-11-20', veiculacao_iso: '2026-11-21' },
  { id: '2', nome: 'Story B', cliente: 'Gonzalez', group_id: 'topics', responsavel_id: '20', prazo_iso: '2026-11-03', veiculacao_iso: '2026-11-05' },
  { id: '3', nome: 'Reels C', cliente: 'Alpha1', group_id: 'topics', responsavel_id: '20', prazo_iso: '2026-12-01', veiculacao_iso: '' },
  { id: '4', nome: 'Card D', cliente: 'VOA', group_id: 'g2', responsavel_id: '20', prazo_iso: '2026-11-09', veiculacao_iso: '2026-11-09' },
  { id: '5', nome: 'Card E', clientes: ['alpha1', 'VOA'], group_id: 'g2', responsavel_ids: ['10'], prazo_iso: '', veiculacao_iso: '2026-11-30' },
];

test('Cliente: um ou mais clientes, sem diferença de maiúscula, e quem não está na lista de clientes não aparece para escolher', () => {
  const c = contextoGrupos();
  vm.runInContext("pv2GruposClientes", c).add('Alpha1');
  assert.deepEqual(js(c.pv2GruposFiltroCliente(pecas).map((i) => i.id)), ['1', '3', '5'], 'a peça com "alpha1" também é do Alpha1');
  vm.runInContext("pv2GruposClientes", c).add('VOA');
  assert.deepEqual(js(c.pv2GruposFiltroCliente(pecas).map((i) => i.id)), ['1', '3', '4', '5']);
  vm.runInContext("pv2GruposClientes", c).clear();
  assert.equal(c.pv2GruposFiltroCliente(pecas).length, pecas.length, 'sem cliente escolhido, nada sai');
  const ops = c.pv2GruposOpcoesDeCliente([...pecas, { id: '9', cliente: 'Sem cliente', group_id: 'topics' }]);
  assert.deepEqual(js(ops.map(([n]) => n)), ['Alpha1', 'Gonzalez', 'VOA'], 'um Alpha1 só, com a grafia do painel; Sem cliente fica de fora');
  assert.equal(ops.find(([n]) => n === 'Alpha1')[1], 3, 'a peça de dois clientes conta uma vez para cada');
});

test('Cliente combina com a pessoa: os dois filtros valem juntos na tabela de grupos', () => {
  const c = contextoGrupos();
  vm.runInContext("pv2GruposClientes", c).add('Alpha1');
  c.selectedPersonIds.add('20');
  const grupos = c.itensPorGrupo(c.pv2GruposFiltroCliente(pecas));
  assert.deepEqual(js(grupos.map((g) => [g.id, g.itens.map((i) => i.id)])), [['topics', ['3']], ['g2', []]], 'só a peça do Alpha1 que é da pessoa 20');
  c.selectedPersonIds.clear(); c.selectedPersonIds.add('10');
  assert.deepEqual(js(c.itensPorGrupo(c.pv2GruposFiltroCliente(pecas)).map((g) => g.itens.map((i) => i.id))), [['1'], ['5']], 'responsavel_ids também conta');
  // As opções de cliente seguem a pessoa (quantas teria se escolhesse), e o escolhido aparece mesmo com zero.
  c.selectedPersonIds.clear(); c.selectedPersonIds.add('20');
  const ops = Object.fromEntries(c.pv2GruposOpcoesDeCliente(pecas));
  assert.equal(ops.Alpha1, 1); assert.equal(ops.Gonzalez, 1); assert.equal(ops.VOA, 1);
});

test('Ordem: data ordena como data, crescente no primeiro clique e decrescente no segundo; sem data vai para o fim', () => {
  const c = contextoGrupos();
  assert.equal(c.valorDeData('2026-11-05'), Date.parse('2026-11-05T12:00:00Z'));
  assert.equal(c.valorDeData('05/11/2026'), c.valorDeData('2026-11-05'), 'dd/mm/aaaa é a mesma data');
  assert.equal(c.valorDeData('5/11/2026'), c.valorDeData('2026-11-05'));
  assert.equal(c.valorDeData(''), ''); assert.equal(c.valorDeData('—'), ''); assert.equal(c.valorDeData('sem data'), '');
  const datas = [
    { id: 'a', prazo_iso: '2026-11-20' }, { id: 'b', prazo_iso: '03/11/2026' }, { id: 'c', prazo_iso: '' },
    { id: 'd', prazo_iso: '2026-12-01' }, { id: 'e', prazo_iso: '9/11/2026' },
  ];
  vm.runInContext('ORDEM = { campo: "prazo_iso", desc: false };', c);
  assert.deepEqual(js(c.ordenarItens(datas).map((i) => i.id)), ['b', 'e', 'a', 'd', 'c'], 'texto ordenaria "03/11" depois de "2026-..." e "9/11" depois de "20"');
  vm.runInContext('ORDEM = { campo: "prazo_iso", desc: true };', c);
  assert.deepEqual(js(c.ordenarItens(datas).map((i) => i.id)), ['d', 'a', 'e', 'b', 'c'], 'decrescente, e a sem prazo continua no fim');
  vm.runInContext('ORDEM = { campo: "veiculacao_iso", desc: false };', c);
  assert.deepEqual(js(c.itensPorGrupo(pecas)[0].itens.map((i) => i.id)), ['2', '1', '3'], 'a tabela de grupos já sai na ordem escolhida');
  vm.runInContext('ORDEM = { campo: "criado_em", desc: true };', c);
  assert.deepEqual(js(c.ordenarItens([{ id: 'x', criado_em: '2026-11-02T09:00' }, { id: 'y', criado_em: '2026-11-10T08:00:00Z' }]).map((i) => i.id)), ['y', 'x']);
});

test('Ordem: o cabeçalho da V2 marca aria-sort e a seta, a escolha é guardada e o foco volta ao cabeçalho', () => {
  const pv2 = trecho(gestor, 'function pv2GruposHtml(', '\n}\n');
  assert.match(pv2, /aria-sort="\$\{ORDEM\.desc \? 'descending' : 'ascending'\}"/);
  assert.match(pv2, /<i class="s-f-seta" aria-hidden="true">\$\{on \? \(ORDEM\.desc \? '↓' : '↑'\) : pv2SetaDupla\}<\/i>/, 'todo cabeçalho mostra ↕; o ativo, ↑ ou ↓');
  const ordenar = trecho(agenda, 'function ordenarPor(', 'function cabecalhoOrdenavel(');
  assert.match(ordenar, /pv2GruposGuardar\(\)/, 'a ordem de Produção fica guardada como a das Demandas');
  assert.match(ordenar, /\.focus\(\)/, 'quem ordena pelo teclado não perde o lugar');
  assert.match(trecho(agenda, 'function renderVisaoDeGrupos(', 'const peca = (n)'), /pv2GruposFiltroCliente\(semCliente\)/);
});

test('Contraste: o select branco da cabeça saiu; filtros viram botões com menu e o selecionado é cheio de tinta', () => {
  const pv2 = trecho(gestor, 'function pv2GruposHtml(', '\n}\n');
  assert.doesNotMatch(pv2, /<select/, 'a regra antiga de campos pintava o select de branco com !important');
  assert.match(pv2, /class="s-f-filtro\$\{escolha \? ' tem' : ''\}" data-s-f="\$\{qual\}" aria-haspopup="dialog"/);
  assert.match(pv2, /chip\(`Cliente: \$\{n\}`, 'pv2GruposTirarCliente\(this\.dataset\.v\)', n\)/, 'o chip "Cliente: X ×"');
  const css = ler('padrao-v2/s-f.css');
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  assert.doesNotMatch(css, /:has\(/);
  assert.match(css, /\.d3m-a-seg > button:is\(\[aria-pressed="true"\],\[aria-checked="true"\]\)\{background:var\(--d3-tinta\);color:var\(--d3-contra\)/);
  assert.match(css, /\.s-f-filtro\.tem\{background:var\(--d3-tinta\);box-shadow:none;color:var\(--d3-contra\)\}/);
  const tokens = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((t) => !t.startsWith('--d3-') && t !== '--vv-texto');
  // A única variável fora do --d3- é a --ds-linha, redefinida (não lida) para apagar a borda que a regra antiga dá ao input.
  assert.deepEqual([...css.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]).filter((t) => !t.startsWith('--d3-')), ['--ds-linha', '--ds-foco-borda', '--ds-foco']);
  assert.deepEqual(tokens, [], 'só tokens --d3-*');
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('.s-f-filtro.tem{'), 'o juntado traz o fragmento');
});

test('Status de captação: a peça com captação mostra os dois blocos, cada um grava no seu campo; sem captação, só Status', () => {
  const c = vm.createContext({
    safeText, jsArg: (v) => String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"),
    isRequestItem: (i) => i.origem === 'demanda',
    campoExisteNoQuadro: (campo, i) => campo === 'captacao' && i.origem !== 'demanda',
    catalogoDoCampo: () => [
      { chave: '1', rotulo: 'Agendar Captação', cor: '#C98A12', ativa: true },
      { chave: '2', rotulo: 'Captado', cor: '#2E8B57', ativa: true },
      { chave: '3', rotulo: 'Antiga', cor: '#888', ativa: false },
    ],
  });
  vm.runInContext(trecho(status, 'function pecaTemCaptacao(', 'function updateLocalStatus('), c);
  const peca = { id: 'vybe:7', status: 'Pode Fazer', captacao: 'Agendar Captação' };
  const html = c.blocoDeCaptacaoHtml(peca);
  assert.match(html, /<span>Captação<\/span><small>agora: Agendar Captação<\/small>/);
  assert.equal((html.match(/data-captacao/g) || []).length, 2, 'só as opções ligadas (a desligada não é a atual)');
  assert.match(html, /onclick="closeStatusEditor\(\);escolherValor\('vybe:7','captacao','2'\)"/, 'grava pelo caminho da coluna Captação');
  assert.match(html, /s-f-cap-on" data-captacao/, 'a atual marcada');
  assert.equal(c.blocoDeCaptacaoHtml({ ...peca, captacao: '' }), '', 'sem captação: só Status');
  assert.equal(c.blocoDeCaptacaoHtml({ ...peca, captacao: '—' }), '');
  assert.equal(c.blocoDeCaptacaoHtml({ ...peca, origem: 'demanda' }), '', 'solicitação não tem captação');
  const menu = trecho(status, 'function openStatusEditor(', 'function pecaTemCaptacao(');
  assert.equal((menu.match(/\$\{fluxoBtn\}\$\{captacao\}/g) || []).length, 2, 'nos dois jeitos do menu (curto e "Todos os N status")');
  assert.match(menu, /updateFocusStatus\('\$\{item\.id\}'/, 'o Status segue gravando pelo caminho de sempre');
  assert.match(gestor, /op\.hasAttribute\('data-captacao'\)/, 'escolher captação não faz a pílula de status girar');
});

test('Ordem: texto em pt-BR sem acento nem maiúscula; Status e Captação seguem o fluxo do catálogo', () => {
  const c = contextoGrupos({
    operationalStatusOptions: () => [{ label: 'A Fazer' }, { label: 'Em Andamento' }, { label: 'Para aprovação' }, { label: 'Finalizado' }],
    catalogoDoCampo: (campo) => (campo === 'captacao' ? [{ rotulo: 'Agendar Captação' }, { rotulo: 'Captação agendada' }, { rotulo: 'Captado' }] : []),
  });
  const ids = (lista) => js(c.ordenarItens(lista).map((i) => i.id));
  const clientes = [{ id: 'z', cliente: 'Zeta' }, { id: 'o', cliente: 'ágora' }, { id: 'b', cliente: 'Abelha' }, { id: 'g', cliente: 'Ágil' }, { id: 'v', cliente: '' }];
  vm.runInContext('ORDEM = { campo: "cliente", desc: false };', c);
  assert.deepEqual(ids(clientes), ['b', 'g', 'o', 'z', 'v'], 'o "Á" não vai para depois do Z; vazio no fim');
  vm.runInContext('ORDEM = { campo: "cliente", desc: true };', c);
  assert.deepEqual(ids(clientes), ['z', 'o', 'g', 'b', 'v']);
  vm.runInContext('ORDEM = { campo: "responsavel", desc: false };', c);
  assert.deepEqual(ids([{ id: '1', responsavel: 'paulo' }, { id: '2', responsavel: 'Ewerton' }, { id: '3', responsavel: 'Érica' }]), ['3', '2', '1']);
  const st = [{ id: 'f', status: 'Finalizado' }, { id: 'a', status: 'A Fazer' }, { id: 'p', status: 'para aprovação' }, { id: 'e', status: 'Em Andamento' }, { id: 'x', status: '' }];
  vm.runInContext('ORDEM = { campo: "status", desc: false };', c);
  assert.deepEqual(ids(st), ['a', 'e', 'p', 'f', 'x'], 'a ordem do fluxo, não a alfabética (Finalizado viria antes de Para aprovação)');
  vm.runInContext('ORDEM = { campo: "status", desc: true };', c);
  assert.deepEqual(ids(st), ['f', 'p', 'e', 'a', 'x']);
  vm.runInContext('ORDEM = { campo: "captacao", desc: false };', c);
  assert.deepEqual(ids([{ id: '3', captacao: 'Captado' }, { id: '1', captacao: 'Agendar Captação' }, { id: '0', captacao: '—' }, { id: '2', captacao: 'Captação agendada' }]), ['1', '2', '3', '0']);
});

test('Captação: coluna própria ao lado do Status, à mostra por padrão, com pílula e menu só dela; "Colunas" esconde', () => {
  const pv2 = trecho(gestor, 'function pv2GruposHtml(', '\n}\n'), linha = trecho(gestor, 'function pv2GrupoLinha(', '\n}\n');
  assert.match(pv2, /cap = pv2GruposCaptacao && quadro === 'producao'/, 'nas solicitações a coluna não aparece');
  assert.ok(pv2.includes("th('status', 'Status') + (cap ? th('captacao', 'Captação') : '') + th('prazo_iso', 'Prazo')"), 'Captação logo depois do Status');
  assert.ok(!pv2.includes("extras ? th('captacao'"), 'não fica mais entre as colunas escondidas');
  const iSt = linha.indexOf('pv2StatusBotao(item)'), iCap = linha.indexOf("${pillEditavel(item, 'captacao')}"), iPrazo = linha.indexOf("data('prazo'");
  assert.ok(iSt > 0 && iSt < iCap && iCap < iPrazo, 'a célula da Captação fica entre Status e Prazo');
  assert.ok(linha.includes('(cap ? `<td class="s-f-cap" data-label="Captação"'), 'a pílula abre o seletor da coluna (abrirEscolha → escolherValor)');
  assert.ok(linha.includes("PV2_GRUPOS_EXTRAS.filter((c) => c !== 'captacao')"));
  assert.ok(gestor.includes('let pv2GruposCaptacao = true;'));
  assert.ok(gestor.includes('pv2GruposCaptacao = salvo.semCaptacao !== true;'), 'quem escondeu continua sem ela');
  assert.ok(pv2.includes('data-s-f="colunas" aria-haspopup="dialog"'), '"Colunas" abre o menu com Captação e as outras cinco');
  assert.ok(gestor.includes("op('captacao', 'Captação', pv2GruposCaptacao)"));
  // A pílula de Status da tabela abre só o bloco Status; o menu da peça (fora da tabela) segue com os dois.
  const menu = trecho(status, 'function openStatusEditor(', 'function pecaTemCaptacao(');
  assert.ok(menu.includes("const daTabela = Boolean(event.currentTarget?.closest?.('#grupos-board.d3m-a-v2 .d3m-a-g-tab'));"));
  assert.ok(menu.includes("const captacao = !daTabela && typeof blocoDeCaptacaoHtml === 'function'"));
  const css = ler('padrao-v2/s-f.css');
  assert.ok(css.includes('.s-f-com-cap:not(.larga) th:nth-last-child(3){width:62px}'), 'Prazo inteiro');
  assert.ok(css.includes('.s-f-com-cap:not(.larga) th:nth-last-child(2){width:94px}'), 'Veiculação inteira');
  assert.match(css, /\.d3m-a-th > i\.s-f-seta\{[^}]*color:var\(--d3-rotulo\)\}/);
  assert.match(css, /\.d3m-a-th\.on > i\.s-f-seta\{[^}]*color:var\(--d3-tinta\)\}/);
});

test('Busca e faixa da pessoa: o campo usa os tokens do vidro sem regra forçada e a faixa antiga sai com a V2', () => {
  const css = ler('padrao-v2/s-f.css');
  assert.ok(css.includes('input#busca-cliente-conteudos{--d3-cartao:transparent;--ds-linha:transparent;--d3-tinta:var(--d3-fume-texto)}'), 'a regra antiga lê essas três variáveis');
  assert.match(css, /#pv2-lado-v \.d3m-a-busca\{box-shadow:inset 0 0 0 1px var\(--d3-fume-apagado\)\}/, 'contorno visível');
  assert.match(css, /#pv2-lado-v \.d3m-a-busca\{[^}]*border-radius:var\(--d3-r-botao\)/, 'canto 8');
  assert.ok(gestor.includes('placeholder="Cliente, conteúdo ou ID"'));
  assert.ok(gestor.includes('class="s-f-busca-x" onclick="event.preventDefault();pv2GruposTirarBusca()'), 'o × fica dentro do campo');
  assert.ok(css.includes('body.mundo[data-pv2-vista="grupos"] #ops-selection-summary[data-s-f-chips]{display:none}'));
  assert.ok(trecho(agenda, 'function renderVisaoDeGrupos(', 'const peca = (n)').includes("if (quadro === 'producao') document.getElementById('ops-selection-summary')?.toggleAttribute('data-s-f-chips', gruposV2);"));
  const pv2 = trecho(gestor, 'function pv2GruposHtml(', '\n}\n');
  assert.ok(pv2.includes('opsSelectionNumeros()'), 'os números da faixa (entregas, riscos, vencem hoje) vão para a linha dos chips');
  assert.match(gestor, /function renderOpsSelectionSummary\(\)\{[\s\S]*?const \{ scope, risks, due \}=opsSelectionNumeros\(\);/, 'a faixa antiga e os chips contam igual');
});
