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

test('Painel de trabalho na ordem do quadro: título, vistas, Modos, Novo conteúdo, fala e números, busca e fichas, semana', () => {
  naOrdem(painel, ['<h2>Painel de trabalho</h2>', 'data-vista="semana"', 'data-vista="mes"', 'data-vista="grupos"', 'data-vista="equipe"', '>Modos</summary>', '>Novo conteúdo</button>',
    'id="pv2-alto"', 'placeholder="Buscar peça ou cliente"', 'id="pv2-chips"', 'id="pv2-filtros-rot">Filtros</summary>',
    'aria-label="Semana anterior"', 'id="pv2-semana-rot"', 'aria-label="Próxima semana"', '>Hoje</button>', 'id="pv2-abas"', '>Por dia</button>', '>Por cliente</button>', '>Grade</button>']);
  assert.match(painel, /Heitor · Coordenação de produção/);
  naOrdem(painel, ["kpi('Publica hoje'", "kpi('Pendentes'", "kpi('Semana fechada'"]);
  naOrdem(painel, ["ficha('Requer ação'", "ficha('Vence hoje'", "ficha('Sem dono'", "ficha('Menos de 3 posts'"]);
  // Uma ação cheia por tela.
  assert.equal((painel.match(/class="pv2-btn p"/g) || []).length, 1);
});

test('nada da barra antiga some: vai para a reserva ou para dentro de Filtros, com os mesmos ids', () => {
  assert.match(painel, /reserva\.append\(cab, resumo, barra, nav\);/);
  for (const id of ['month-nav', 'agenda-filtros', 'ops-arquivo-btn', 'ops-clear-btn']) assert.ok(painel.includes(`document.getElementById('${id}')`), id);
  for (const f of ['toggleDailyClose()', 'toggleManagerCommandDrawer()', 'openMeetingMode()', "getElementById('ops-carga-btn')?.click()"]) assert.ok(painel.includes(f), f);
  for (const f of ['mostrarAgendaDaSemana()', 'toggleAgendaMensal()', 'toggleVisaoDeGrupos()', 'mostrarEquipeDaSemana(', 'toggleActionQueue()', 'toggleTodayQueue()', 'passarSemana(-1)', 'semanaDeHoje()']) assert.ok(painel.includes(f), f);
});

test('a semana em colunas: quatro dias à vista, cartão compacto que abre no lugar e "mostrar" no pé', () => {
  assert.match(painel, /const PV2_POR_DIA = 3, PV2_JANELA = 4;/);
  const cartao = bloco(painel, 'function pv2CartaoHtml(', 'function pv2RenderDias(');
  naOrdem(cartao, ['class="pv2-pc v2-abre', 'class="pv2-pc-lin" role="button"', 'class="pv2-t"', 'pv2Cli(clientes[0])', 'pv2StatusBotao(d)', 'pv2Av(d)', 'class="v2-mais"', 'pv2EtapasHtml(d)', '>Abrir a peça</button>', 'data-day-item=']);
  assert.match(cartao, /draggable="true"\s+ondragstart="managerCalendarDragStart\(/);
  const dias = bloco(painel, 'function pv2RenderDias(');
  assert.match(dias, /ondragover="soltarNoDiaSobre\(event,this\)" ondragleave="soltarNoDiaSai\(this\)" ondrop="soltarNoDia\('\$\{dia\.iso\}',event,this\)"/);
  assert.match(dias, />Adicionar atividade<\/button>/);
  assert.match(dias, />Gerar resumo<\/button>/);
  assert.match(dias, /prontas recolhidas/);
  assert.match(dias, /aria-label="Mostrar tudo de \$\{dataCurta\}">mostrar<\/button>/);
  // O "?" é a peça sem dono: clicar escolhe o responsável.
  assert.match(painel, /class="pv2-av sd" onclick="event\.stopPropagation\(\);openOwnerEditor\(event,'\$\{id\}'\)"/);
});

test('Demandas na ordem do quadro: título, Lista ou Calendário, Nova demanda, fala e dois números, fichas, Filtros, Colunas e a lista', () => {
  naOrdem(dem, ['<h2>Demandas</h2>', '>Lista</button>', '>Calendário</button>', '>Nova demanda</button>', 'id="pv2d-alto"', 'placeholder="Buscar cliente ou demanda"', 'id="pv2d-chips"', 'id="pv2d-filtros-rot">Filtros</summary>', '>Colunas</summary>', 'id="pv2d-lista"']);
  assert.match(dem, /const PV2D_VISOES = \[\['atrasadas', 'Atrasadas'\], \['minha', 'Minha fila'\], \['sem', 'Sem responsável'\], \['abertas', 'Todas'\]\];/);
  naOrdem(dem, ["kpi('Atrasadas'", "kpi('Sem responsável'"]);
  assert.match(dem, /Distribuir \$\{sem\.length === 1 \? 'a 1' : 'as ' \+ sem\.length\}/);
  const linha = bloco(dem, 'function pv2dLinhaHtml(', 'function pv2dPintar(');
  naOrdem(linha, ['class="pv2-nome"', 'class="pv2-cs"', 'class="pv2-cp"', 'class="pv2-cr"', 'class="pv2-seta"', 'class="v2-mais"', 'pv2EtapasHtml(d)', "'Trocar responsável'", '>Abrir a peça</button>']);
  assert.match(dem, />Nova aqui<\/button>/);
  assert.match(dem, /neste grupo · <button type="button" class="pv2-link" onclick="pv2dGrupoInteiro\(/);
  assert.match(dem, /ficam recolhidos/);
  // O que saiu da frente continua: filtros, resumo do recorte, visões e ordenação dentro de Filtros; o resto na reserva.
  assert.match(dem, /pop\.append\(controles\);/);
  assert.match(dem, /\[\['concluidas', 'Concluídas'\], \['todas', 'Tudo, com as concluídas'\]\]/);
  assert.match(dem, /onclick="pv2dOrdenar\('\$\{c\}'\)"/);
  assert.equal((dem.match(/class="pv2-btn p"/g) || []).length, 1);
});

test('Agenda e captações na ordem do quadro: cabeçalho com abas e Marcar captação, fala do Lucas, busca e Dia, Semana, Mês, Pede ação e a semana por dia', () => {
  naOrdem(prod, ['id="pv2-agenda-topo"', '<h2>Agenda e captações</h2>', "abaV2('captacoes', 'Captações')", "abaV2('roteiros', 'Roteiros')", "abaV2('feed', 'Feed')", "abaV2('calendar', 'Calendário')", 'class="pv2-btn p capt-marcar" onclick="captMarcarCaptacao()"']);
  const tela = bloco(agenda, 'function pv2aHtml(');
  naOrdem(tela, ['Lucas · Audiovisual e captação', 'placeholder="Buscar cliente ou captação"', '${vistas}', 'aria-label="Filtros: escolher o que exibir na agenda">Filtros</summary>', 'id="pv2a-corpo"']);
  assert.match(agenda, /<h3>Pede ação<\/h3>/);
  assert.match(agenda, /onclick="event\.stopPropagation\(\);captAbrirFechar\('\$\{id\}'\)">Fechar gravação<\/button>/);
  assert.match(agenda, /Marcar o que foi gravado/);
  assert.match(agenda, /class="pv2a-ev\$\{e\.id === CAPT\.sel \? " sel" : ""\}" data-ev="\$\{id\}"/);
  assert.match(agenda, /sem nada, \$\{vazios\.length === 1 \? "recolhido" : "recolhidos"\}/);
  // A grade por hora continua em Dia e, pela semana, em Filtros.
  assert.match(agenda, /"Semana em lista por dia" : "Semana em grade por hora"/);
  assert.match(agenda, /CAPT\.vista === "dia" \? captDiaHtml\(eventos\)/);
});

test('IA e custos na ordem do quadro: período, Atualizar, Definir teto, fala do Alex, três cartões, Pede ação, Com quem e Em quê', () => {
  naOrdem(ia, ['<h2>IA e custos</h2>', '[7, 30, 90].map', '>Atualizar</button>', '>Definir teto</button>']);
  const tela = bloco(ia, 'root.innerHTML = `<div id="pv2-ia"');
  naOrdem(tela, ['Alex · Análise e números', '>Ver a conta</button>', '<small>Gasto no mês</small>', 'class="pv2i-dias"', 'Pedidos em ${dias} dias', '<small>Teto mensal</small>', '${pedeAcao}${lados}', '>Parâmetros da estimativa</summary>', 'id="ai-budget-input"', 'id="ai-usd-input"', 'id="ai-gemini-billing"', 'onclick="saveAiUsageSettings()"']);
  assert.match(ia, /<h3>Com quem<\/h3>/);
  assert.match(ia, /<h3>Em quê<\/h3><span class="pv2-sub">por modelo<\/span>/);
  assert.match(ia, /class="pv2-btn s v2-estado" onclick="event\.stopPropagation\(\);pv2iUsarTeto\(\$\{sugerido\},this\)">Usar \$\{redondo\(sugerido\)\}<\/button>/);
  assert.equal((ia.match(/class="pv2-btn p"/g) || []).length, 1);
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
