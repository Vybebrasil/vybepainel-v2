import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Padrão v2 (12/11/2026): Painel de trabalho, Demandas, Agenda e captações e IA e custos são os quadros DEPOIS do
// moodboard aprovado. Cada tela nova vive num bloco "Padrão v2" no fim do arquivo dela e só vale no mundo.
const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const gestor = ler('vybe-gestor.js'), demandas = ler('vybe-demandas.js'), capt = ler('vybe-captacoes.js'), prod = ler('production_governed_v2.js');
const css = ler('padrao-v2/paineis.css');
const bloco = (js, inicio, fim) => { const a = js.indexOf(inicio); assert.ok(a >= 0, inicio); const b = fim ? js.indexOf(fim, a + 1) : js.length; return js.slice(a, b < 0 ? js.length : b); };
const painel = bloco(gestor, '// ─── Padrão v2 · Painel de trabalho');
const dem = bloco(demandas, '// ─── Padrão V2 · Demandas', '// ─── Padrão v2 · IA e custos');
const ia = bloco(demandas, '// ─── Padrão v2 · IA e custos');
const agenda = bloco(capt, '// ─── Padrão v2 · Agenda e captações');
const naOrdem = (texto, partes) => { let p = -1; for (const parte of partes) { const i = texto.indexOf(parte, p + 1); assert.ok(i > p, parte); p = i; } };

test('o padrão v2 só vale no mundo, e as funções antigas seguem sozinhas sem ele', () => {
  assert.match(painel, /function pv2Ligado\(\) \{ return typeof document !== 'undefined' && Boolean\(document\.body\?\.classList\.contains\('mundo'\)\); \}/);
  assert.match(gestor, /if \(typeof pv2RenderDias === 'function' && pv2Ligado\(\)\) \{ pv2RenderDias\(sem, filter, dayFilter\); return; \}/);
  assert.match(gestor, /if \(typeof pv2PintarAlto === 'function'\) pv2PintarAlto\(\{ pct, feitas: done, total, hoje: todayItems\.length, hojePendente: todayPending, pendentes, poucosPosts: clientesLow \}\);/);
  assert.match(demandas, /if \(typeof pv2dPintar === 'function'\) pv2dPintar\(\);/);
  assert.match(demandas, /if \(typeof pv2Ligado === 'function' && pv2Ligado\(\)\) \{ pv2iRender\(data\); return; \}/);
  assert.match(capt, /if \(typeof pv2Ligado === "function" && pv2Ligado\(\)\) return pv2aHtml\(\{ todos, pend, nPend \}\);/);
});

// Direção V2 (prancha V2-M-Producao, aprovada em 16/11/2026): o título vira "Produção" com a seta que troca de tela; os três
// números saem (o de hoje vai para o laranja e a régua, a semana fechada para a linha do topo); a busca vira ícone; a coluna
// de consulta traz o laranja, a carga de hoje, onde a semana trava e os Modos; a régua tem as setas e o Hoje.
test('Produção na prancha V2: título com a seta e a linha do dia, vistas, busca, Novo conteúdo, coluna de consulta, régua, cabeça do cartão e De olho', () => {
  naOrdem(painel, ['<h2>Produção</h2>', 'id="pv2-data"', 'data-vista="semana"', 'data-vista="mes"', 'data-vista="grupos"', 'data-vista="equipe"', 'placeholder="Buscar peça ou cliente"', 'id="pv2-busca-bt"', 'Novo conteúdo</button>',
    'id="pv2-lado"', 'id="pv2-alto"', 'id="pv2-carga"', 'id="pv2-trava"', '<b>Modos</b>',
    'id="pv2-semana-rot"', 'id="pv2-abas"', '>Por dia</button>', '>Por cliente</button>', '>Grade</button>', 'id="pv2-filtros-rot">Filtros</summary>', "regua.id = 'pv2-regua'", 'id="pv2-chips"']);
  naOrdem(painel, ['aria-label="Semana anterior"', 'class="d3m-dia', 'aria-label="Próxima semana"', '>Hoje</button>']);
  // O laranja cheio é o do Heitor (o que trava hoje), com o número grande; Novo conteúdo fica branco.
  assert.match(painel, /class="d3-acao d3p-acao d3m-laranja"/);
  assert.match(painel, /Heitor · o que trava hoje/);
  assert.match(painel, /function pv2EscolherDia\(iso\)/, 'a régua escolhe o dia');
  assert.match(painel, /const umDia = DIAS_EM_COLUNAS && !dayFilter && dias\.length > 1;/, 'Por dia abre em um dia só');
  naOrdem(painel, ["ficha('Requer ação'", "ficha('Vencidas e de hoje'", "ficha('Sem dono na semana'", "ficha('Menos de 3 posts'"]);
  assert.equal((painel.match(/class="pv2-btn p"/g) || []).length, 0);
});

test('nada da barra antiga some: vai para a reserva ou para dentro de Filtros, com os mesmos ids', () => {
  assert.match(painel, /reserva\.append\(cab, resumo, barra, nav\);/);
  for (const id of ['month-nav', 'agenda-filtros', 'ops-arquivo-btn', 'ops-clear-btn']) assert.ok(painel.includes(`document.getElementById('${id}')`), id);
  for (const f of ['toggleDailyClose()', 'toggleManagerCommandDrawer()', 'openMeetingMode()', "getElementById('ops-carga-btn')?.click()"]) assert.ok(painel.includes(f), f);
  for (const f of ['mostrarAgendaDaSemana()', 'toggleAgendaMensal()', 'toggleVisaoDeGrupos()', 'mostrarEquipeDaSemana(', 'toggleActionQueue()', 'toggleTodayQueue()', 'passarSemana(-1)', 'semanaDeHoje()']) assert.ok(painel.includes(f), f);
});

test('a semana em colunas: quatro dias à vista, cartão compacto que abre no lugar e "mostrar" no pé', () => {
  assert.match(painel, /const PV2_POR_DIA = 7, PV2_JANELA = 4;/);
  const cartao = bloco(painel, 'function pv2CartaoHtml(', 'function pv2RenderDias(');
  naOrdem(cartao, ['class="pv2-pc v2-abre', 'class="pv2-pc-lin" role="button"', 'class="pv2-t"', 'pv2Cli(clientes[0])', 'class="d3p-peca"', 'pv2StatusBotao(d)', 'class="d3p-quando', 'pv2Av(d)', 'class="v2-mais"', 'pv2EtapasHtml(d)', '>Abrir a peça</button>', 'data-day-item=']);
  assert.match(cartao, /draggable="true"\s+ondragstart="managerCalendarDragStart\(/);
  const dias = bloco(painel, 'function pv2RenderDias(');
  assert.match(dias, /ondragover="soltarNoDiaSobre\(event,this\)" ondragleave="soltarNoDiaSai\(this\)" ondrop="soltarNoDia\('\$\{dia\.iso\}',event,this\)"/);
  assert.match(dias, />Adicionar atividade<\/button>/);
  assert.match(dias, />Gerar resumo<\/button>/);
  assert.match(dias, /prontas recolhidas/);
  assert.match(dias, /class="d3p-mais" onclick="pv2MostrarDia\(\$\{sem\},'\$\{dia\.iso\}'\)" aria-label="Mostrar tudo de \$\{dataCurta\}"/);
  assert.match(dias, /dia\.iso === hoje && lista\.length \? `<span class="d3-barra"/, 'hoje tem a barra do dia');
  // O "?" é a peça sem dono: clicar escolhe o responsável.
  assert.match(painel, /class="pv2-av sd" onclick="event\.stopPropagation\(\);openOwnerEditor\(event,'\$\{id\}'\)"/);
});

// Prancha V2-M-Demandas (16/11/2026): o esqueleto mudou (uma folha por urgência e a consulta ao lado); os ids são os de antes.
test('Demandas na ordem da prancha V2: título, Lista ou Calendário, a busca, o ⋯ (ordenar, colunas e filtros), Nova demanda, a folha com as fichas e a lista, e a consulta', () => {
  naOrdem(dem, ['<h2>Demandas</h2>', 'class="d3p-data"', '>Lista</button>', '>Calendário</button>', 'placeholder="Buscar cliente ou demanda"', 'id="pv2d-colunas"', 'id="pv2d-ordenar"', '>Colunas</span>', 'Mostrar ID</label>', 'id="pv2d-filtros-rot">Filtros</summary>', 'Nova demanda</button>', 'id="pv2d-chips"', 'id="pv2d-lista"', 'id="pv2d-pe"', 'id="pv2d-alto"', 'id="pv2d-tipos"', 'id="pv2d-abrir"']);
  assert.match(dem, /const PV2D_VISOES = \[\['abertas', 'Todas'\], \['minha', 'Minha fila'\], \['atrasadas', 'Atrasadas'\], \['sem', 'Sem responsável'\], \['semana', 'Na semana'\]\];/);
  // Os quatro números viraram o pé "De olho" e a linha do dia no topo.
  naOrdem(dem, ['<span>De olho</span>', "pl(atrasadas.length, 'atrasada', 'atrasadas')", "'sem responsável'", "pl(venceHoje.length, 'vence hoje', 'vencem hoje')", "'grupo vazio, recolhido', 'grupos vazios, recolhidos'"]);
  assert.match(dem, /Distribuir \$\{sem\.length === 1 \? 'a 1' : 'as ' \+ sem\.length\}/);
  const linha = bloco(dem, 'function pv2dLinhaHtml(', 'function pv2dPintar(');
  naOrdem(linha, ['class="d3m-a-dm-q', 'class="pv2-nome"', 'class="d3d-tipo"', 'class="d3d-cli"', 'class="pv2-cs"', 'class="pv2-cp"', 'class="d3d-tar', 'class="pv2-cr"', 'class="v2-mais"', 'pv2EtapasHtml(d)', "'Trocar responsável'", '>Abrir a peça</button>']);
  naOrdem(dem, ['<span>Demanda</span>', '<span>Cliente</span>', '<span>Status</span>', '<span>Prazo</span>', '<span>Tarefas</span>']);
  assert.match(dem, />\+ Nova aqui<\/button>/);
  assert.match(dem, /class="d3p-mais" onclick="pv2dGrupoInteiro\(/);
  assert.match(dem, /ficam recolhidos/);
  // O que saiu da frente continua: filtros, resumo do recorte, visões e ordenação dentro de Filtros; o resto na reserva.
  assert.match(dem, /pop\.append\(controles\);/);
  assert.match(dem, /\[\['concluidas', 'Concluídas'\], \['todas', 'Tudo, com as concluídas'\]\]/);
  assert.match(dem, /onclick="pv2dOrdenar\('\$\{c\}'\)"/);
  assert.equal((dem.match(/class="pv2-btn p"/g) || []).length, 0, 'o laranja cheio é o bloco de ação');
});

test('Agenda e captações (Direção 3): cabeçalho com abas e Marcar captação, bloco de ação do Lucas, quatro números, a faixa da semana, Na ordem de fazer (com o ⋯ da busca, Dia e Filtros) e Agentes viram', () => {
  // Direção 3 (quadro D3-Agenda): título curto com a semana, Semana, Mês e Roteiros, o menu Mais (Feed e Calendário) e
  // Marcar captação branco.
  naOrdem(prod, ['id="pv2-agenda-topo"', '<h2 title="Agenda e captações">Agenda</h2>', 'class="d3ag-data"', "vistaAg('semana', 'Semana')", "vistaAg('mes', 'Mês')", "vistaAg('roteiros', 'Roteiros')", '${maisAg}', 'class="pv2-btn capt-marcar d3ag-marcar" onclick="captMarcarCaptacao()"']);
  assert.match(prod, /\[\['feed', 'Feed'\], \['calendar', 'Calendário'\]\]/);
  const tela = bloco(agenda, 'function pv2aHtml(');
  naOrdem(tela, ['d3AcaoHtml({ agente: "L", ...acao })', 'rotulo: "Gravações para fechar"', 'rotulo: "Peças sem roteiro"', 'rotulo: "Captações sem peças"', 'rotulo: "Captações na semana"',
    '${blocoAcao}${numeros}', 'id="pv2a-corpo"']);
  assert.doesNotMatch(tela, /class="pv2-filtros" role="toolbar"/, 'o quadro não tem a linha de busca');
  naOrdem(bloco(agenda, 'function d3agMaisHtml('), ['aria-label="Buscar, navegar e filtrar a agenda"', 'placeholder="Buscar cliente ou captação"', '${dia}', 'd3agNavHtml()', '>Na agenda</span>${tipos}']);
  assert.match(agenda, /<h3>Na ordem de fazer<\/h3><span class="d3ag-cab-dir"><span>\$\{n\}<\/span>\$\{d3agMaisHtml\(\)\}<\/span>/);
  assert.match(agenda, /<h3>Agentes viram<\/h3>/);
  assert.match(agenda, /\$\{espera\}\$\{roteiros\}\$\{d3agViramHtml\(\)\}/);
  assert.match(agenda, /<h3>Esperando captação<\/h3>/);
  assert.match(agenda, /<h3>Roteiros<\/h3>/);
  assert.match(agenda, /class="d3ag-card d3ag-faixa" aria-label="Semana"/);
  assert.match(agenda, /onclick="captAbrirFechar\('\$\{id\}'\)">Fechar gravação<\/button>/);
  assert.match(agenda, /Marcar o gravado/);
  assert.doesNotMatch(agenda, /Lucas · Audiovisual e captação/, 'a fala virou o bloco de ação');
  // A grade por hora continua em Dia e, pela semana, em Filtros.
  assert.match(agenda, /"Semana em lista por dia" : "Semana em grade por hora"/);
  assert.match(agenda, /CAPT\.vista === "dia" \? captDiaHtml\(eventos\)/);
});

/// IA e custos na direção V2 (prancha V2-M-IA-Custos, 16/11/2026): o esqueleto novo na casca do grupo E. SAFE: vm com DOM
// de mentira e fetch dublê; nada grava nem envia.
function telaIa({ fetch: busca } = {}) {
  const root = { innerHTML: '' }, pedidos = [];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ctx = vm.createContext({ console, Date, Math, JSON, Number, String, Array, Map, Set, Object, Promise, Error, Intl, safeText: esc, AI_USAGE_API: '/api/ia-custos', pv2Ligado: () => true, showToast() {}, setTimeout: (f) => { f(); return 0; },
    d3LinhaSvg: (v) => `<svg class="d3-graf" data-pontos="${v.length}"></svg>`,
    document: { getElementById: (id) => (id === 'ai-usage-root' ? root : null), querySelector: () => null, querySelectorAll: () => [] },
    fetch: async (url, op = {}) => { pedidos.push(`${op.method || 'GET'} ${url}`); return busca ? busca(url, op) : { ok: true, json: async () => ({}) }; } });
  const core = ler('vybe-core.js'), k0 = core.indexOf('const D3ME_IC'), k1 = core.indexOf('// Confirmação (família 5)', k0);
  assert.ok(k0 >= 0 && k1 > k0, 'peças do grupo E em vybe-core.js');
  vm.runInContext(core.slice(k0, k1), ctx);
  vm.runInContext(bloco(demandas, '// ─── Monitoramento de uso e custo de IA', 'async function saveAiUsageSettings') + '\n' + ia, ctx);
  return { ctx, root, pedidos };
}
// Como em loadAiUsage: os números ficam guardados (as escolhas da tela redesenham a partir deles).
const pintarIa = (ctx, d) => { ctx.dadosDoTeste = d; vm.runInContext('aiUsageData = dadosDoTeste; renderAiUsageBoard(aiUsageData)', ctx); };
const semUso = (o = {}) => ({ period_days: 30, settings: { monthly_budget_brl: 0, brl_per_usd: 5.5, gemini_billing: 'free' }, overview: { calls: 0 }, month: {}, providers: [], daily: [], people: [], ...o });

test('IA e custos (prancha V2-M-IA-Custos): sem uso e sem teto, o topo no vidro, três números, o teto do mês, o vazio e o laranja do Alex', () => {
  const { ctx, root } = telaIa();
  pintarIa(ctx, semUso());
  const h = root.innerHTML;
  assert.match(h, /^<div class="d3m-e-tela d3m-e-ia"><div class="d3m-e-topo">/);
  assert.match(h, /d3mETroca\(this,'gestao','ai-usage'\)/, 'a seta do título troca de tela dentro da Gestão');
  assert.match(h, /<span class="d3m-e-h" role="heading" aria-level="2">IA e custos<\/span>/);
  assert.match(h, /<span class="d3m-e-sub"><span class="d3m-e-so-donos"><svg[^>]*>.*?<\/svg>só donos<\/span> · uso e custo da IA · últimos 30 dias<\/span>/);
  naOrdem(h, ['class="d3m-e-per ia-periodos" role="radiogroup"', 'data-days="7" aria-checked="false" onclick="setAiUsageDays(7,this)">7 dias', 'data-days="30" aria-checked="true"', 'data-days="90"', 'onclick="loadAiUsage(true)">Atualizar</button>', 'aria-label="Buscar"', 'aria-label="Como funciona"']);
  // Três números (o teto saiu dos cartões e ganhou a folha dele).
  naOrdem(h, ['<div class="d3m-e-kpis" style="--n:3">', '<span>Gasto em 30 dias</span>', '<b class="d3m-e-kpi-v">R$', '<span>', 'fecha perto de</span>', '<span>Pedidos em 30 dias</span>', '<b class="d3m-e-kpi-v">0</b><small class="d3m-e-kpi-sub">nenhum no período</small>']);
  assert.equal((h.match(/class="d3m-e-kpi"/g) || []).length, 3);
  // Teto do mês: sem teto, o botão Definir e as duas linhas automáticas.
  naOrdem(h, ['<section class="d3m-e-folha d3m-e-ia-teto" aria-label="Teto do mês">', '<b>Teto do mês</b><span class="d3m-e-cab-dir">não definido</span>', '<span class="d3v-st d3m-e-ia-st a"><i aria-hidden="true"></i>Sem teto</span>', '<b>Teto mensal</b> <span>· o limite de gasto com IA</span>', 'onclick="pv2iAbrirParametros(true)">Definir</button>',
    '>80%</b><span class="d3m-e-ia-txt">aviso aos donos</span><span class="d3m-e-ia-auto">automático</span>', '>100%</b><span class="d3m-e-ia-txt">fica vermelho aqui e no Hoje</span><span class="d3m-e-ia-auto">automático</span>']);
  // Com quem e em quê: sem pedido, o estado vazio (a peça de estados) com o botão dos parâmetros.
  naOrdem(h, ['<section class="d3m-e-folha cresce d3m-e-ia-uso" aria-label="Com quem e em quê">', '<span class="d3m-e-cab-dir">30 dias</span>', 'class="d3m-e-estado d3m-e-estado-vazio grande"', '<b>Sem pedidos ao VYBES no período</b>', 'onclick="pv2iAbrirParametros(false)">Parâmetros</button>']);
  assert.doesNotMatch(h, /d3m-e-ia-cols|id="ai-budget-input"/, 'sem uso não há colunas; o formulário só abre com Parâmetros');
  // A consulta no vidro: o laranja do Alex (a única ação cheia), o que entra na conta e os atalhos.
  naOrdem(h, ['<aside class="d3m-lado" aria-label="Consulta">', '<section class="d3m-laranja d3m-e-ia-lar"', '<span>Alex · falta o teto</span>', '<span class="d3-acao-frase">O teto mensal de IA ainda não foi definido</span>', 'Sem teto não há aviso em 80% nem vermelho em 100%.', 'class="d3m-btn l v2-estado" onclick="pv2iAbrirParametros(true)">Definir o teto</button>', 'class="d3m-btn l s" onclick="pv2iAbrirParametros(false)">Parâmetros</button>',
    '<b>O que entra na conta</b>', '<b>Abrir</b>', `onclick="pv2iIr('agentes')"><span><b>Agentes</b> · quem pede e quem age</span>`, `onclick="pv2iIr('automacoes')"><span><b>Automações</b></span>`]);
  assert.equal((h.match(/class="d3m-laranja/g) || []).length, 1, 'um laranja cheio só');
  // "Parâmetros": o formulário entra no lugar da folha de baixo, com os ids que saveAiUsageSettings lê, e o Voltar devolve.
  ctx.pv2iAbrirParametros(true);
  naOrdem(root.innerHTML, ['aria-label="Parâmetros">', 'id="pv2i-parametros"', 'id="ai-budget-input"', 'id="ai-usd-input"', 'id="ai-gemini-billing"', 'class="ai-setting-save d3v-btn s" type="button" onclick="saveAiUsageSettings()"', 'onclick="pv2iFecharParametros()">Voltar</button>']);
  ctx.pv2iFecharParametros();
  assert.doesNotMatch(root.innerHTML, /id="ai-budget-input"/);
});

test('IA e custos: com uso, o teto usado, o gasto por dia em linha, com quem (pessoa ou cliente) e em quê (agente ou modelo)', () => {
  const { ctx, root } = telaIa();
  const hoje = new Date().toISOString().slice(0, 10), ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10), antes = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  const dados = { period_days: 7, settings: { monthly_budget_brl: 100, brl_per_usd: 5.5, gemini_billing: 'paid' }, overview: { calls: 12, cost_brl: 85, cost_usd: 15.45 }, month: { cost_brl: 85, cost_usd: 15.45, calls: 12 },
    providers: [{ provider: 'claude', model: 'm', calls: 10, cost_brl: 85 }, { provider: 'gemini', model: 'g', calls: 2, cost_brl: 0 }],
    daily: [{ day: hoje, calls: 6, cost_brl: 60 }, { day: ontem, calls: 3, cost_brl: 15 }, { day: antes, calls: 3, cost_brl: 10 }],
    people: [{ profile_name: 'Paulo Martins', calls: 9, cost_brl: 70 }, { profile_name: 'Bia', calls: 2, cost_brl: 10 }, { profile_name: 'Lia', calls: 1, cost_brl: 5 }], clients: [{ cliente: 'Cliente A', calls: 4, cost_brl: 30 }] };
  pintarIa(ctx, dados);
  let h = root.innerHTML;
  assert.match(h, /<b>Teto do mês<\/b><span class="d3m-e-cab-dir">R\$\s85,00 de R\$\s100,00<\/span>/);
  assert.match(h, /<span class="d3v-st d3m-e-ia-st a"><i aria-hidden="true"><\/i>85% usado<\/span>.*?<span class="d3m-e-ia-barra a" aria-hidden="true"><i style="--v:85%"><\/i><\/span><button type="button" class="d3v-btn s" onclick="pv2iAbrirParametros\(true\)">Mudar<\/button>/s);
  assert.match(h, /d3m-e-ia-pct a">80%<\/b><span class="d3m-e-ia-txt">aviso aos donos<\/span><span class="d3m-e-ia-auto">avisado<\/span>/);
  assert.match(h, /<span>Alex · perto do teto<\/span>.*?<b class="d3m-lar-num">85%<\/b>.*?onclick="pv2iAbrirParametros\(true\)">Rever o teto<\/button>/s);
  assert.match(h, /US\$ 15,45 · R\$\s7,08 por pedido/);
  assert.match(h, /<b class="d3m-e-kpi-v">12<\/b><small class="d3m-e-kpi-sub">17% sem custo<\/small>.*?<svg class="d3m-e-anel"/s);
  naOrdem(h, ['<div class="d3m-e-ia-cols">', 'aria-label="Gasto por dia"', '<svg class="d3-graf" data-pontos="7">', 'aria-label="Com quem"', `aria-checked="true" onclick="pv2iTrocarRecorte('pessoa')">Pessoa</button>`, '<span class="d3m-e-ia-nome">Paulo</span>', 'aria-label="Em quê"', '<span>por modelo</span>', '<span class="d3m-e-ia-nome">Claude</span>', '>estimado</span>', 'onclick="pv2iAbrirParametros(false)">Parâmetros</button>']);
  // De olho: o dia que pesou e a pessoa muito acima da média.
  assert.match(h, /<section class="d3m-cons" aria-label="De olho">.*?71% do gasto, 6 pedidos.*?<b>Paulo Martins<\/b> · 9× a média por pessoa/s);
  // O recorte por cliente e, com agentes na resposta, "Em quê" por agente.
  ctx.pv2iTrocarRecorte('cliente');
  assert.match(root.innerHTML, /aria-checked="true" onclick="pv2iTrocarRecorte\('cliente'\)">Cliente<\/button>.*?<span class="d3m-e-ia-nome">Cliente A<\/span>/s);
  ctx.pv2iTrocarRecorte('pessoa');
  pintarIa(ctx, { ...dados, agents: [{ agente: 'Heitor', calls: 5, cost_brl: 40 }] });
  assert.match(root.innerHTML, /<span>por agente<\/span><\/div><div class="d3m-e-ia-gx"[^>]*><i class="d3v-foto" aria-hidden="true">H<\/i><span class="d3m-e-ia-nome">Heitor<\/span>/);
  assert.doesNotMatch(root.innerHTML, /token|comandos/i);
});

test('IA e custos: carregando é o esqueleto parado, o erro deixa tentar de novo e "Usar R$" grava o teto sugerido', async () => {
  let responder = () => new Promise(() => {});
  const { ctx, root, pedidos } = telaIa({ fetch: (url, op) => responder(url, op) });
  ctx.loadAiUsage(true);
  assert.match(root.innerHTML, /^<div class="d3m-e-tela d3m-e-ia" aria-busy="true">.*?<b>Consultando uso e custos<\/b>.*?class="d3m-e-estado-carregando" data-forma="lista"/s);
  const falha = telaIa({ fetch: async () => ({ ok: false, json: async () => ({ error: 'Sem acesso ao banco.' }) }) });
  await falha.ctx.loadAiUsage(true);
  assert.match(falha.root.innerHTML, /class="d3m-e-estado d3m-e-estado-erro grande"[^>]*role="alert">.*?<b>Não foi possível ler os gastos da IA<\/b><span>Sem acesso ao banco\.<\/span><button type="button" class="d3m-e-estado-btn sec" onclick="loadAiUsage\(true\)">Tentar de novo<\/button>/s);
  // Com gasto no mês e sem teto, o Alex sugere um teto e o botão grava pelo mesmo POST de "Salvar".
  const hoje = new Date().toISOString().slice(0, 10);
  const comGasto = { period_days: 30, settings: { monthly_budget_brl: 0, brl_per_usd: 5.5, gemini_billing: 'free' }, overview: { calls: 4, cost_brl: 20 }, month: { cost_brl: 20, calls: 4 }, providers: [{ provider: 'gpt', model: 'x', calls: 4, cost_brl: 20 }], daily: [{ day: hoje, calls: 4, cost_brl: 20 }], people: [{ profile_name: 'Paulo', calls: 4, cost_brl: 20 }] };
  const salvo = telaIa({ fetch: async (url, op) => ({ ok: true, json: async () => (op.method === 'POST' ? { dashboard: { ...comGasto, settings: { ...comGasto.settings, monthly_budget_brl: JSON.parse(op.body).monthly_budget_brl } } } : comGasto) }) });
  await salvo.ctx.loadAiUsage(true);
  const usar = salvo.root.innerHTML.match(/class="d3m-btn l v2-estado" onclick="pv2iUsarTeto\((\d+),this\)">Usar R\$ (\d+)<\/button>/);
  assert.ok(usar && usar[1] === usar[2] && Number(usar[1]) >= 50, 'o teto sugerido no laranja');
  assert.match(salvo.root.innerHTML, /class="d3v-btn s d3m-e-fio v2-estado" onclick="pv2iUsarTeto\(\d+,this\)">Usar R\$ \d+<\/button><button type="button" class="d3v-btn s" onclick="pv2iAbrirParametros\(true\)">Definir<\/button>/);
  const botao = { dataset: {}, textContent: '' };
  await salvo.ctx.pv2iUsarTeto(Number(usar[1]), botao);
  assert.equal(botao.dataset.estado, 'feito');
  assert.ok(salvo.pedidos.includes('POST /api/ia-custos'));
  assert.match(salvo.root.innerHTML, /<b>Teto mensal<\/b> <span>· R\$\s\d+,00 por mês/);
  assert.equal(pedidos.length, 1);
});

test('IA e custos: o CSS da tela é um fragmento do grupo E, com tokens, sem !important e sem html body.mundo', () => {
  const tela = ler('padrao-v2/zm-e-ia.css').replace(/\/\*[\s\S]*?\*\//g, ''), casca = ler('padrao-v2/zm-e-casca.css'); // sem os comentários
  assert.doesNotMatch(tela, /!important|html body\.mundo|#[0-9A-Fa-f]{3,8}\b|:has\([^)]*\[style/);
  assert.doesNotMatch(tela.replace(/box-shadow:[^;}]*/g, ''), /rgba?\(/, 'rgba só em sombra');
  assert.match(ler('padrao-v2/z-direcao.css'), /body\.mundo\.mundo-modulo:is\(\[data-quadro="diario"\],\[data-quadro="ai-usage"\][^)]*\) #mundo-moldura\{[^}]*background:var\(--d3-fume\)/, 'a janela da IA é vidro fumê');
  assert.match(tela, /body\.mundo\.mundo-modulo\[data-quadro="ai-usage"\] #painel-ai-usage\{position:absolute;inset:0;/);
  for (const sel of ['.d3m-e-ia-lin', '.d3m-e-ia-cols', '.d3m-e-ia-gx', '.d3m-e-ia-form', '.d3m-e-ia-lar']) assert.ok(tela.includes(sel), sel);
  assert.match(tela, /@media \(max-width:900px\)/);
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('.d3m-e-ia-cols'), 'o fragmento entra na folha junta');
});

test('escolha única usa role="radio" com aria-checked (a visão ativa é branca) e a ficha ligada fica preta', () => {
  for (const js of [painel, dem, ia, prod.slice(prod.indexOf('const abaV2'))]) assert.ok(!/class="pv2-seg"[^>]*role="tablist"/.test(js));
  assert.match(css, /\.pv2-seg button\[aria-checked="true"\]\{background:#FFFFFF;color:#1F1D1A;/);
  assert.match(css, /\.pv2-chip:is\(\[aria-pressed="true"\],\[aria-selected="true"\]\)\{background:#1F1D1A;color:#FFFFFF;box-shadow:none\}/);
});

test('o CSS do grupo traz as medidas do quadro e não força regra antiga', () => {
  assert.ok(!css.includes('!important'));
  assert.ok(!/html body\.mundo/.test(css));
  assert.match(css, /\.pv2-card\{[^}]*border:0;border-radius:20px;background:#FFFFFF;/);
  assert.match(css, /\.pv2-btn\{[^}]*height:38px;[^}]*border-radius:999px;/);
  assert.match(css, /\.pv2-btn\.s\{height:30px;/);
  assert.match(css, /\.pv2-btn\.p\{background:#C2490C;color:#FFFFFF;/);
  assert.match(css, /\.pv2-btn\.k\{background:#1F1D1A;color:#FFFFFF;/);
  assert.match(css, /\.pv2-chip\{[^}]*height:30px;/);
  assert.match(css, /\.pv2-busca\{[^}]*height:36px;/);
  assert.match(css, /\.pv2-pill\{[^}]*height:22px;/);
  assert.match(css, /\.pv2-sub\{[^}]*color:#6B665E\}/);
  assert.match(css, /#pv2-demandas \.pv2-cs\{flex:none;width:124px;/);
  assert.match(css, /#pv2-demandas \.pv2-cp\{flex:none;width:66px\}/);
  assert.match(css, /#pv2-demandas \.pv2-cr\{[^}]*width:118px;/);
  assert.match(css, /#pv2-agenda \.pv2a-duas\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1\.15fr\);gap:14px/);
  assert.match(css, /\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);gap:14px;/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('texto de interface sem travessão', () => {
  for (const [nome, js] of [['painel', painel], ['demandas', dem], ['ia', ia], ['agenda', agenda]]) {
    const semComentario = js.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    // O "—" que sobra é só o marcador de dado vazio que vem do quadro ('—'), nunca texto de tela.
    assert.ok(!semComentario.replace(/'—'|\^—\$/g, '').includes('—'), nome);
  }
});
