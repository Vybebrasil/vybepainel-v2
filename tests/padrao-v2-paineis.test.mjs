import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Padrão v2 (12/11/2026): Painel de trabalho, Demandas, Agenda e captações e IA e custos são os quadros DEPOIS do
// moodboard aprovado. Cada tela nova vive num bloco "Padrão v2" no fim do arquivo dela e só vale no mundo.
const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const gestor = ler('vybe-gestor.js'), demandas = ler('vybe-demandas.js'), capt = ler('vybe-captacoes.js'), prod = ler('production_governed_v2.js');
const css = ler('padrao-v2/paineis.css');
const bloco = (js, inicio, fim) => { const a = js.indexOf(inicio); assert.ok(a >= 0, inicio); const b = fim ? js.indexOf(fim, a + 1) : js.length; return js.slice(a, b < 0 ? js.length : b); };
const painel = bloco(gestor, '// ─── Padrão v2 · Painel de trabalho');
const dem = bloco(demandas, '// ─── Padrão v2 · Demandas', '// ─── Padrão v2 · IA e custos');
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

test('Painel de trabalho na ordem do quadro D3: título com a data, vistas, Modos, Novo conteúdo, bloco de ação e números, busca e fichas, semana', () => {
  naOrdem(painel, ['<h2>Painel de trabalho</h2>', 'id="pv2-data"', 'data-vista="semana"', 'data-vista="mes"', 'data-vista="grupos"', 'data-vista="equipe"', '>Modos</summary>', 'Novo conteúdo</button>',
    'id="pv2-alto"', 'placeholder="Buscar peça ou cliente"', 'id="pv2-chips"', 'id="pv2-filtros-rot">Filtros</summary>',
    'aria-label="Semana anterior"', 'id="pv2-semana-rot"', 'aria-label="Próxima semana"', '>Hoje</button>', 'id="pv2-abas"', '>Por dia</button>', '>Por cliente</button>', '>Grade</button>']);
  // Direção 3: o laranja cheio é o bloco de ação do Heitor; Novo conteúdo fica branco.
  assert.match(painel, /d3pAcao\(\{ agente: 'H', quem: 'Heitor · Coordenação', frase, botao, attrs: `onclick="\$\{acao\}"` \}\)/);
  naOrdem(painel, ["kpi('Publica hoje'", "kpi('Pendentes'", "kpi('Semana fechada'"]);
  assert.match(painel, /serie: porDia\(\(\) => true\)/, 'a mini linha vem das publicações de cada dia da semana');
  naOrdem(painel, ["ficha('Requer ação'", "ficha('Vence hoje'", "ficha('Sem dono'", "ficha('Menos de 3 posts'"]);
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

test('Demandas na ordem do quadro: título, Lista ou Calendário, Nova demanda, fala e dois números, fichas, Filtros, Mostrar ID, o ⋯ com Colunas e a lista', () => {
  naOrdem(dem, ['<h2>Demandas</h2>', 'class="d3p-data"', '>Lista</button>', '>Calendário</button>', 'Nova demanda</button>', 'id="pv2d-alto"', 'placeholder="Buscar cliente ou demanda"', 'id="pv2d-chips"', 'id="pv2d-filtros-rot">Filtros</summary>', 'id="pv2d-ordenar"', 'Mostrar ID</label>', 'id="pv2d-colunas"', '>Colunas</span>', 'id="pv2d-lista"']);
  assert.match(dem, /const PV2D_VISOES = \[\['atrasadas', 'Atrasadas'\], \['minha', 'Minha fila'\], \['sem', 'Sem responsável'\], \['semana', 'Vencem na semana'\], \['abertas', 'Todas'\]\];/);
  naOrdem(dem, ["kpi('Abertas'", "kpi('Vencem hoje'", "kpi('Atrasadas'", "kpi('Sem dono'"]);
  assert.match(dem, /Distribuir \$\{sem\.length === 1 \? 'a 1' : 'as ' \+ sem\.length\}/);
  const linha = bloco(dem, 'function pv2dLinhaHtml(', 'function pv2dPintar(');
  naOrdem(linha, ['class="d3d-tipo"', 'class="pv2-nome"', 'class="d3d-cli"', 'class="pv2-cs"', 'class="pv2-cp"', 'class="d3d-conc"', 'class="pv2-cr"', 'class="d3d-tar', 'class="pv2-seta"', 'class="v2-mais"', 'pv2EtapasHtml(d)', "'Trocar responsável'", '>Abrir a peça</button>']);
  naOrdem(dem, ['<span>Tipo</span>', '<span>Demanda</span>', '<span>Cliente</span>', '<span>Status</span>', '<span>Prazo</span>', '<span>Conclusão</span>', '<span>Responsável</span>', '<span>Tarefas</span>']);
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

// IA e custos segue o quadro D3-IaCustos (Direção 3, 13/11/2026): selo "só donos", bloco de ação do Alex (o único laranja
// cheio), quatro números e três colunas; o gasto por dia é uma linha (d3LinhaSvg) e os parâmetros ficam em "Em quê".
test('IA e custos na ordem do quadro D3: período, Atualizar, Definir teto, bloco do Alex, quatro números, Pede ação com o gasto por dia, Com quem e Em quê', () => {
  naOrdem(ia, ['<h2>IA e custos</h2>', 'PV2I_SELO', '[7, 30, 90].map', '>Atualizar</button>', 'class="pv2-btn d3f-escuro" onclick="pv2iAbrirParametros(true)">Definir teto</button>']);
  naOrdem(ia, ['d3LinhaSvg(lista.map((d) => d.custo), { meta: media', '>Parâmetros</summary>', 'id="ai-budget-input"', 'id="ai-usd-input"', 'id="ai-gemini-billing"', 'onclick="saveAiUsageSettings()"', '<h3>Com quem</h3>', "<h3>Em quê</h3><span class=\"pv2-sub\">${agentes.length ? 'por agente' : 'por modelo'}</span>", '${parametros}']);
  const tela = bloco(ia, 'root.innerHTML = `<div id="pv2-ia"');
  naOrdem(tela, ['${pv2iTopoHtml()}', '${blocoAcao}', 'Gasto em ${dias} dias', '${Mes} fecha perto de', 'Pedidos em ${dias} dias', "'Teto mensal'", '${pedeAcao}${porDiaHtml}', '${comQuem}${emQueHtml}']);
  assert.match(ia, /d3AcaoHtml\(\{ frase: `<small class="d3f-quem">Alex · Análise e números<\/small>\$\{acao\.frase\}`, agente: 'A'/);
  assert.match(ia, /class="pv2-btn s d3f-escuro v2-estado" onclick="event\.stopPropagation\(\);pv2iUsarTeto\(\$\{sugerido\},this\)">Usar \$\{redondo\(sugerido\)\}<\/button>/);
  assert.equal((ia.match(/class="pv2-btn p"/g) || []).length, 0, 'o laranja cheio é só o bloco de ação');
  assert.doesNotMatch(ia, /pv2i-dias/, 'gasto por dia em linha, sem barras');
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
  assert.match(css, /#pv2-ia \.pv2i-tres\{display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px\}/);
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
