let buscaClienteDemandas = '';
// O botão de cliente escolhe pelo nome exato; a caixa de busca aceita parte do
// nome. Os dois são o mesmo filtro: digitar na caixa desfaz o "exato", e clicar
// num cliente escreve o nome na caixa.
let clienteDemandasExato = '';
// Visões usam o mesmo filtro de grupos, calendário e contagens.
let visaoRapidaDemandas = 'todas';
let preferenciasDemandasUsuario = null;
const VISOES_DEMANDAS = { abertas:'Em aberto', minha:'Minha fila', atrasadas:'Atrasadas', sem:'Sem responsável', concluidas:'Concluídas', todas:'Todas' };
function pertenceVisaoDemanda(d, visao = visaoRapidaDemandas) {
  const concluida = DEMANDA_CONCLUIDA.includes(d.status);
  if (visao === 'concluidas') return concluida;
  if (visao === 'todas') return true;
  if (concluida) return false;
  if (visao === 'atrasadas') return demandaAtrasada(d);
  const ids = (d.responsavel_ids?.length ? d.responsavel_ids : [d.responsavel_id]).filter(Boolean).map(String);
  if (visao === 'sem') return !ids.length;
  if (visao === 'minha') {
    const eu = typeof pessoaLogada === 'function' ? pessoaLogada() : null;
    const pessoa = typeof pessoaPeloNome === 'function' ? pessoaPeloNome(eu?.nome || '') : null;
    return Boolean(eu && ids.includes(String(pessoa?.id || eu.id)));
  }
  return true;
}
function escolherVisaoDemanda(visao) {
  if (!Object.hasOwn(VISOES_DEMANDAS, visao)) return;
  visaoRapidaDemandas = visao;
  currentDemandaStatusFilter = 'all'; currentDemandaAtrasadas = false;
  currentDemandaPersonFilter = 'all';
  // 7 · Chip que voa: o chip escolhido e as linhas que ficam voam para o lugar novo; as que saem encolhem.
  if (typeof vbTransicao === 'function') vbTransicao(() => renderDemandas(), { raiz: '#painel-demandas', tipo: 'chip' }); else renderDemandas();
}
function chavePreferenciasDemandas() {
  const eu = typeof pessoaLogada === 'function' ? pessoaLogada() : null;
  return eu?.id ? 'vybe_demandas_preferencias:' + eu.id : null;
}
function restaurarPreferenciasDemandas() {
  const chave = chavePreferenciasDemandas();
  if (!chave || preferenciasDemandasUsuario === chave) return;
  preferenciasDemandasUsuario = chave;
  let salvo = {};
  try { salvo = JSON.parse(localStorage.getItem(chave) || '{}') || {}; } catch { /* preferência inválida */ }
  visaoRapidaDemandas = Object.hasOwn(VISOES_DEMANDAS, salvo.visao) ? salvo.visao : 'abertas';
  buscaClienteDemandas = typeof salvo.busca === 'string' ? salvo.busca : '';
  clienteDemandasExato = typeof salvo.cliente === 'string' ? salvo.cliente : '';
  currentDemandaStatusFilter = typeof salvo.status === 'string' ? salvo.status : 'all';
  currentDemandaPersonFilter = typeof salvo.pessoa === 'string' ? salvo.pessoa : 'all';
  currentDemandaTipoFilter = typeof salvo.tipo === 'string' ? salvo.tipo : 'all';
  currentDemandaAtrasadas = salvo.atrasadas === true;
  if (['all','vinicius','ewerton'].includes(salvo.carteira)) filtroCarteira = salvo.carteira;
  gruposDeDemandasAberto = salvo.calendario !== true; agendaDeDemandasAberta = salvo.calendario === true;
  currentDemandaDateMode = salvo.data === 'prazo' ? 'prazo' : 'conclusao';
  currentDemandaDayFilter = /^\d{4}-\d{2}-\d{2}$/.test(salvo.dia || '') ? salvo.dia : '';
  if (salvo.ordem && Object.hasOwn(CAMPOS_ORDENAVEIS, salvo.ordem.campo)) ORDEM = { campo:salvo.ordem.campo, desc:salvo.ordem.desc === true };
  const painel = document.getElementById('painel-demandas');
  for (const coluna of ['id','cadastro']) {
    painel?.classList.toggle('dem-mostrar-' + coluna, salvo[coluna] === true);
    const campo = document.getElementById('dem-coluna-' + coluna); if (campo) campo.checked = salvo[coluna] === true;
  }
  const busca = document.getElementById('busca-cliente-demandas'); if (busca) busca.value = buscaClienteDemandas;
}
function guardarPreferenciasDemandas() {
  const chave = chavePreferenciasDemandas(); if (!chave || preferenciasDemandasUsuario !== chave) return;
  const painel = document.getElementById('painel-demandas');
  try { localStorage.setItem(chave, JSON.stringify({visao:visaoRapidaDemandas, busca:buscaClienteDemandas, cliente:clienteDemandasExato,
    status:currentDemandaStatusFilter, pessoa:String(currentDemandaPersonFilter), tipo:currentDemandaTipoFilter, atrasadas:currentDemandaAtrasadas,
    data:currentDemandaDateMode, dia:currentDemandaDayFilter, ordem:ORDEM, carteira:filtroCarteira, calendario:agendaDeDemandasAberta,
    id:painel?.classList.contains('dem-mostrar-id'), cadastro:painel?.classList.contains('dem-mostrar-cadastro')})); } catch { /* armazenamento indisponível não bloqueia o trabalho */ }
}
function pintarVisoesDemandas() {
  const alvo = document.getElementById('dem-visoes'); if (!alvo) return;
  alvo.innerHTML = Object.entries(VISOES_DEMANDAS).map(([id,nome]) => `<button type="button" aria-pressed="${visaoRapidaDemandas===id}" onclick="escolherVisaoDemanda('${id}')">${nome}<span>${DADOS_DEMANDAS.filter(itemNaCarteira).filter(d=>pertenceVisaoDemanda(d,id)).length}</span></button>`).join('');
}

function buscarClienteDemandas(valor) { buscaClienteDemandas=valor; clienteDemandasExato=''; renderDemandas(); }
function escolherClienteDemandas(nome) {
  const mesmo = clienteDemandasExato && clienteDemandasExato === nome;
  clienteDemandasExato = mesmo ? '' : nome;
  buscaClienteDemandas = mesmo ? '' : nome;
  const caixa = document.getElementById('busca-cliente-demandas');
  if (caixa) caixa.value = buscaClienteDemandas;
  renderDemandas();
}
// vybe-demandas.js — board de solicitações de demandas e custos de IA
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Board Solicitações de Demandas ────────────────────────────────────────────────────────────
const BOARD_DEMANDAS_ID = 8385559107;
const BOARD_CLIENTES_ID = 7758256536;
const BOARD_ACESSOS_ID = 7758163799;
const CLIENTES_HEADS_COLUMNS = ['name','multiple_person_mm35kefy','status','link_mkzdvjjs','date_mm35wp7q','color_mkzkgn5c','lista_suspensa9__1','dropdown_mkw9njy6'];
const CLIENTES_ACESSOS_COLUMNS = ['name','monday_doc__1','link6__1','boolean_mm3248x2','link_mm3fwkja'];
const DEMANDAS_GROUP_MAP = {
  'group_mm187437':        'Novas Demandas/Ideias',
  'novo_grupo_mkmkjdqd':   'A Fazer',
  'novo_grupo_mkkyfhtw':   'Em Execução',
  'novo_grupo_mkkyx8pv':   'Concluídas'
};
const DEMANDAS_GROUP_ORDER = ['Novas Demandas/Ideias','A Fazer','Em Execução','Concluídas'];
const DEMANDAS_GROUP_ICON  = {};

let DADOS_DEMANDAS = [];
let CLIENT_MASTER_HEADS = [];
let CLIENT_MASTER_ACESSOS = [];
let CLIENT_MASTER_LOADING = false;
let CLIENT_MASTER_LOADED = false;
let CLIENT_MASTER_ERROR = '';
let currentDemandaPersonFilter = 'all';
let currentDemandaStatusFilter = 'all';
// "Tipo de demanda" veio do Monday quase todo vazio, e sem ele nao da para
// perguntar coisas simples: quantos impressos estao em pe? o que ainda nao foi
// classificado? A etiqueta so vira ferramenta quando da para ver quem esta sem
// ela — por isso "Sem tipo" e um filtro de primeira classe aqui, e nao uma
// ausencia que se descobre rolando a lista.
let currentDemandaTipoFilter = 'all';
// Atrasada nao e um status, e uma relacao entre o prazo e hoje — por isso
// precisa de estado proprio. Os outros tres numeros do topo nao precisam: eles
// acionam os filtros de status e de tipo que ja existem, e e assim que o cartao
// aceso e a etiqueta acesa contam sempre a mesma historia.
let currentDemandaAtrasadas = false;
// Solicitacao nao tem semana.
//
// Conteudo tem: ele e feito para veicular num dia, e a semana e a unidade em que
// a producao se organiza. Solicitacao chega quando chega e se arrasta ate alguem
// resolver — a de 26/06 ainda em execucao nao pertence a semana nenhuma. Recortar
// por semana aqui nao organizava, escondia: eram justamente as antigas, que sao
// as que pedem acao, que sumiam do recorte.
//
// As abas Semana 1 / Semana 2 sairam. Quem precisa de recorte de tempo tem o
// filtro de Dia, que agora vale em toda a tela, e o Calendario. A constante fica
// fixa em 0 porque as tres visoes ainda existem no arquivo e o resto do codigo
// as consulta; o que deixou de existir e o caminho para sair da esteira.
const currentDemandaWeek = 0;
const currentDemandaViewDay = false;
let currentDemandaDateMode = 'conclusao'; // 'conclusao' | 'prazo'
let currentDemandaDayFilter = '';        // ISO date string para filtro de dia
let activeBoard = 'producao';

// Abas que só quem administra abre.
const ABAS_DE_GESTAO = new Set(['ai-usage', 'performance']);

// Esconde os botões dessas abas para quem não administra. Botão que existe e
// recusa é pior que botão que não existe.
function ajustarAbasPorPapel() {
  const admin = typeof souAdmin === 'function' && souAdmin();
  ABAS_DE_GESTAO.forEach((aba) => {
    const btn = document.getElementById(`btn-board-${aba}`);
    if (btn) btn.style.display = admin ? '' : 'none';
  });
}

// ─── Monitoramento de uso e custo de IA ─────────────────────────────────────
const AI_USAGE_API = '/api/ia-custos';
let aiUsageDays = 30;
let aiUsageData = null;
let aiUsageLoading = false;

function aiNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function aiBrl(value) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2}).format(aiNumber(value)); }
// Dólar no jeito brasileiro (US$ 0,12); quatro casas só abaixo de um centavo.
function aiUsd(value) { const v = aiNumber(value); return 'US$ ' + new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:v > 0 && v < 0.01 ? 4 : 2}).format(v); }
function aiProviderLabel(provider) { return ({gpt:'GPT',gemini:'GEMINI',claude:'CLAUDE'})[provider] || String(provider || 'IA').toUpperCase(); }

async function loadAiUsage(force=false) {
  if (aiUsageLoading || (!force && aiUsageData?.period_days === aiUsageDays)) { renderAiUsageBoard(aiUsageData); return; }
  aiUsageLoading = true;
  const root = document.getElementById('ai-usage-root');
  if (root) root.innerHTML = aiCabecalhoHtml() + vbEstadoHtml({ tipo: 'carregando', titulo: 'Consultando uso e custos' });
  try {
    const response = await fetch(`${AI_USAGE_API}?days=${aiUsageDays}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Falha ao carregar monitoramento.');
    aiUsageData = data;
    renderAiUsageBoard(data);
  } catch (error) {
    if (root) root.innerHTML = aiCabecalhoHtml() + vbEstadoHtml({ tipo: 'erro', titulo: 'Não foi possível ler os gastos da IA', texto: error.message || '',
      acao: '<button type="button" class="vb-botao" onclick="loadAiUsage(true)">Tentar de novo</button>' });
  } finally {
    aiUsageLoading = false;
  }
}

function setAiUsageDays(days, button) {
  aiUsageDays = Number(days) || 30;
  document.querySelectorAll('.ia-periodos button').forEach(node => node.setAttribute('aria-pressed', String(Number(node.dataset.days) === aiUsageDays)));
  loadAiUsage(true);
}

function aiBudgetMeta(data) {
  const budget = aiNumber(data?.settings?.monthly_budget_brl);
  const spent = aiNumber(data?.month?.cost_brl);
  if (budget <= 0) return { label:'Sem teto mensal definido', value:'—', percentage:0, state:'' };
  const raw = (spent / budget) * 100;
  return {
    label:`${aiBrl(spent)} de ${aiBrl(budget)} neste mês`,
    value:`${raw.toFixed(0)}%`,
    percentage:Math.min(raw,100),
    state: raw >= 100 ? 'danger' : raw >= 80 ? 'warning' : ''
  };
}

// Quadro 12 do redesign (10/11/2026): os números numa linha, com o teto e o quanto foi usado; sem uso, um estado vazio
// só; com uso, o gasto por dia e a tabela de quem gastou. Português de quem usa: "pedidos ao VYBES" e reais (dólar
// como "US$ 0,12"). Os parâmetros da estimativa (teto, dólar, Gemini) continuam ali, recolhidos.
function aiPeriodosHtml() {
  return `<div class="vb-alternar ia-periodos" role="group" aria-label="Período">${[7, 30, 90].map((d) =>
    `<button type="button" data-days="${d}" aria-pressed="${aiUsageDays === d}" onclick="setAiUsageDays(${d},this)">${d} dias</button>`).join('')}</div>`;
}

function aiCabecalhoHtml() {
  if (typeof pv2Ligado === 'function' && pv2Ligado()) return `<div id="pv2-ia" class="pv2 pv2-ia">${pv2iTopoHtml()}</div>`;
  return vbCabecalhoHtml({ titulo: 'IA e custos', texto: 'Quanto o VYBES gasta, com quem e em quê.',
    acoes: `${aiPeriodosHtml()}<button type="button" class="vb-botao" onclick="loadAiUsage(true)">Atualizar</button>` });
}

// Um dia por barra, inclusive os dias sem pedido (o banco só devolve os dias com uso), do mais antigo até hoje.
function aiGastoPorDiaHtml(daily, dias) {
  const porDia = new Map(daily.map((row) => [String(row.day || ''), row]));
  const lista = [];
  for (let i = dias - 1; i >= 0; i -= 1) {
    const chave = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const row = porDia.get(chave) || {};
    lista.push({ chave, custo: aiNumber(row.cost_brl), pedidos: aiNumber(row.calls) });
  }
  const maior = Math.max(0.00001, ...lista.map((d) => d.custo));
  const dm = (chave) => `${chave.slice(8, 10)}/${chave.slice(5, 7)}`;
  const pico = lista.reduce((a, b) => (b.custo > a.custo ? b : a), lista[0]);
  const resumo = `Gasto por dia nos últimos ${dias} dias; o maior foi ${aiBrl(pico.custo)} em ${dm(pico.chave)}`;
  const barras = lista.map((d, i) => {
    const pedidos = `${d.pedidos} ${d.pedidos === 1 ? 'pedido' : 'pedidos'}`;
    const altura = d.custo > 0 ? Math.max(4, Math.round((d.custo / maior) * 100)) : 0;
    return `<i class="${i === lista.length - 1 ? 'hoje' : ''}${d.pedidos && !d.custo ? ' gratis' : ''}" style="height:${d.pedidos && !d.custo ? 3 : altura}%" title="${dm(d.chave)} · ${aiBrl(d.custo)} · ${pedidos}"></i>`;
  }).join('');
  return `<div class="ia-grafico" role="img" aria-label="${safeText(resumo)}">${barras}</div>
    <div class="ia-grafico-eixo"><span>${dm(lista[0].chave)}</span><span>hoje</span></div>`;
}

function aiTabelaHtml(cabecalho, linhas) {
  return `<table class="ia-tabela"><thead><tr>${cabecalho.map((c, i) => `<th${i ? ' class="num"' : ''}>${c}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map((l) => `<tr>${l.map((c, i) => `<td${i ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function renderAiUsageBoard(data) {
  const root = document.getElementById('ai-usage-root');
  if (!root || !data) return;
  // No mundo, a tela é a do quadro do padrão v2 (pv2iRender, no fim deste arquivo).
  if (typeof pv2Ligado === 'function' && pv2Ligado()) { pv2iRender(data); return; }
  const overview = data.overview || {};
  const month = data.month || {};
  const settings = data.settings || {};
  const providers = Array.isArray(data.providers) ? data.providers : [];
  const daily = Array.isArray(data.daily) ? data.daily : [];
  const people = Array.isArray(data.people) ? data.people : [];
  const dias = Number(data.period_days) || aiUsageDays;
  const pedidos = aiNumber(overview.calls);
  const teto = aiNumber(settings.monthly_budget_brl);
  const usado = teto > 0 ? (aiNumber(month.cost_brl) / teto) * 100 : 0;
  const resumo = vbResumoHtml([
    { valor: aiBrl(month.cost_brl), rotulo: `no mês (${aiUsd(month.cost_usd)})` },
    { valor: pedidos.toLocaleString('pt-BR'), rotulo: `${pedidos === 1 ? 'pedido' : 'pedidos'} ao VYBES em ${dias} dias` },
    teto > 0
      ? { valor: `${usado.toFixed(0)}%`, rotulo: `do teto de ${aiBrl(teto)} usado`, tom: usado >= 100 ? 'alerta' : usado >= 80 ? 'atencao' : '' }
      : { rotulo: 'Sem teto mensal definido' },
  ]);
  const quem = people.map((row) => [safeText(row.profile_name), aiNumber(row.calls).toLocaleString('pt-BR'), aiBrl(row.cost_brl)]);
  const modelos = providers.map((row) => [`${safeText(aiProviderLabel(row.provider))} <small>${safeText(row.model || 'modelo não identificado')}</small>`,
    aiNumber(row.calls).toLocaleString('pt-BR'), aiBrl(row.cost_brl)]);
  const corpo = pedidos === 0
    ? vbEstadoHtml({ titulo: `Nenhum pedido ao VYBES nos últimos ${dias} dias`, texto: 'Os gastos aparecem aqui assim que alguém usar o VYBES.' })
    : `<div class="ia-duas">
        <section class="ia-cartao"><h3 class="ia-rotulo">Gasto por dia</h3>${aiGastoPorDiaHtml(daily, dias)}</section>
        <section class="ia-cartao"><h3 class="ia-rotulo">Quem usou</h3>${quem.length ? aiTabelaHtml(['Quem', 'Pedidos', 'Gasto'], quem) : '<p class="ia-nota">Sem pessoas identificadas no período.</p>'}</section>
      </div>
      ${modelos.length ? `<section class="ia-cartao"><h3 class="ia-rotulo">Por modelo</h3>${aiTabelaHtml(['Modelo', 'Pedidos', 'Gasto'], modelos)}</section>` : ''}`;
  const gemini = settings.gemini_billing === 'paid' ? 'API paga: o custo entra na conta' : 'plano gratuito: custo estimado em R$ 0,00';
  root.innerHTML = `
    ${aiCabecalhoHtml()}
    ${resumo}
    ${corpo}
    <details class="ia-parametros">
      <summary>Parâmetros da estimativa</summary>
      <p class="ia-nota">O teto acende o aviso no resumo a partir de 80% e em vermelho ao chegar a 100%. O Gemini está no ${safeText(gemini)}.</p>
      <div class="ia-campos">
        <div class="ai-setting-field"><label for="ai-budget-input">Teto mensal (R$)</label><input id="ai-budget-input" type="number" min="0" step="1" value="${aiNumber(settings.monthly_budget_brl)}"></div>
        <div class="ai-setting-field"><label for="ai-usd-input">Dólar de referência (R$ por US$ 1)</label><input id="ai-usd-input" type="number" min="0.01" step="0.01" value="${aiNumber(settings.brl_per_usd) || 5.5}"></div>
        <div class="ai-setting-field"><label for="ai-gemini-billing">Gemini</label><select id="ai-gemini-billing"><option value="free" ${settings.gemini_billing === 'free' ? 'selected' : ''}>Plano gratuito</option><option value="paid" ${settings.gemini_billing === 'paid' ? 'selected' : ''}>API paga</option></select></div>
        <button class="ai-setting-save vb-botao principal" type="button" onclick="saveAiUsageSettings()">Salvar</button>
      </div>
      <p class="ia-nota">Os valores são estimativas pelo tamanho de cada pedido e da resposta. Não substituem as faturas da OpenAI, do Google e da Anthropic, que mudam com plano, créditos, descontos e cobrança intermediada.</p>
    </details>`;
}

async function saveAiUsageSettings() {
  const budget = document.getElementById('ai-budget-input');
  const usd = document.getElementById('ai-usd-input');
  const gemini = document.getElementById('ai-gemini-billing');
  const button = document.querySelector('.ai-setting-save');
  if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
  try {
    const response = await fetch(AI_USAGE_API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ days:aiUsageDays, monthly_budget_brl:aiNumber(budget?.value), brl_per_usd:aiNumber(usd?.value)||5.5, gemini_billing:gemini?.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || 'Não foi possível salvar.');
    aiUsageData = result.dashboard;
    renderAiUsageBoard(aiUsageData);
    if (typeof showToast === 'function') showToast('Parâmetros de custo atualizados.');
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message || 'Falha ao salvar parâmetros.');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Salvar'; }
  }
}

function switchBoard(board, btn) {
  if (activeBoard !== board && typeof closeTransientOverlaysForNavigation === 'function') closeTransientOverlaysForNavigation();
  // Custo de IA e desempenho individual são leitura de quem gere, não do dia a
  // dia de quem executa. Antes as oito abas apareciam para todo mundo.
  if (!souAdmin() && ABAS_DE_GESTAO.has(board)) {
    showToast('Esta área é de quem administra o painel.', 'info', 4000);
    return;
  }
  if (activeBoard === board) return;
  if (activeBoard === 'demandas' && board !== 'demandas') guardarPreferenciasDemandas();
  if (activeBoard !== 'demandas' && board === 'demandas') preferenciasDemandasUsuario = null;
  activeBoard = board;
  if(board==='demandas') { gruposDeDemandasAberto=true; agendaDeDemandasAberta=false; gruposDemandasRecolhidos.clear(); }
  document.querySelectorAll('.board-switch-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const subs = {
    producao:    'Controle semanal de conteúdo por cliente e equipe',
    demandas:    'Demandas — esteira de produção',
    clientes:    'Visão unificada por cliente',
    diario:      'Diário de Produção — snapshots do estado dos conteúdos',
    performance: 'Médias e desempenho individual da equipe',
    'ai-usage':  'Uso, custos estimados e limites do VYBES',
    automacoes:  'Regras que movem, atribuem e avisam sozinhas',
    escritorio:  'Presença, conversas e o espaço da equipe',
    conta:       'Sua conta e, para quem administra, a equipe'
  };
  document.getElementById('header-sub').textContent = subs[board] || '';
  document.querySelector('.container').style.display        = board==='producao' ? '' : 'none';
  document.getElementById('painel-demandas').style.display  = board==='demandas' ? 'block' : 'none';
  document.getElementById('painel-clientes').style.display  = board==='clientes' ? 'block' : 'none';
  document.getElementById('painel-diario').style.display       = board==='diario'      ? 'block' : 'none';
  document.getElementById('painel-performance').style.display  = board==='performance' ? 'block' : 'none';
  document.getElementById('painel-ai-usage').style.display     = board==='ai-usage' ? 'block' : 'none';
  document.getElementById('painel-automacoes').style.display   = board==='automacoes' ? 'block' : 'none';
  document.getElementById('painel-conta').style.display        = board==='conta' ? 'block' : 'none';
  document.getElementById('painel-escritorio').style.display = board==='escritorio'?'block':'none';
  // O escritório ocupa a tela inteira; fora dele, a página volta a rolar.
  document.body.classList.toggle('no-escritorio', board==='escritorio');
  if (typeof atualizarDockEscritorio === 'function') atualizarDockEscritorio();
  if(board==='escritorio')abrirEscritorio();
  if (board === 'demandas') {
    if (DADOS_DEMANDAS.length === 0) refreshDemandas();
    else renderDemandas();
  }
  if (board === 'producao') atualizarVisoesDaCarteira();
  if (board === 'clientes') renderClientesBoard();
  if (board === 'diario') renderDiarioLista();
  if (board === 'performance') renderPerformance();
  if (board === 'ai-usage') loadAiUsage();
  if (board === 'automacoes') carregarAutomacoes();
  if (board === 'conta') carregarConta();
}

// Helper: data ISO conforme modo ativo
function getDemandaDateIso(d) {
  return currentDemandaDateMode === 'prazo' ? (d.prazo_iso||'') : (d.conclusao_iso||'');
}
function getDemandaDateFmt(d) {
  return currentDemandaDateMode === 'prazo' ? (d.prazo||'') : (d.conclusao||'');
}

// Toggle modo de data
function setDemandaDateMode(mode, btn) {
  currentDemandaDateMode = mode;
  const botoes = [...document.querySelectorAll('#date-mode-bar-demandas .date-mode-btn')];
  botoes.forEach(b => b.classList.remove('active'));
  // Sem botao clicado (veio de um atalho na tela vazia): acha o que corresponde.
  const alvo = btn || botoes.find(b => (b.getAttribute('onclick') || '').includes(`'${mode}'`));
  alvo?.classList.add('active');
  populateDemandaDaySelect();
  renderDemandas();
}

// Tabs de semana

// Toggle ver por dia

// Popular select de dias da semana ativa
// Os dias disponiveis viraram uma lista do painel, nao do sistema. A funcao
// continua com o mesmo nome porque continua fazendo o mesmo: descobrir quais
// dias existem no recorte atual — so que agora guarda numa lista e escreve no
// botao o que esta escolhido.
let DIAS_DA_DEMANDA = [];
function abrirDiasDaDemanda(gatilho) {
  if (!DIAS_DA_DEMANDA.length) return showToast('Nenhum dia com solicitação neste recorte.', 'info', 3500);
  abrirListaDoPainel(gatilho, {
    titulo: 'Dia',
    atual: currentDemandaDayFilter || '',
    opcoes: [{ valor:'', rotulo:'Todos os dias' }, ...DIAS_DA_DEMANDA],
    aoEscolher: (iso) => { currentDemandaDayFilter = iso; renderDemandas(); },
  });
}
function populateDemandaDaySelect() {
  const sel = document.getElementById('day-select-demandas');
  if (!sel) return;
  // Determinar intervalo da semana
  let startIso = '', endIso = '';
  if (currentDemandaWeek === 1) { startIso = META.week1_start_iso; endIso = META.week1_end_iso; }
  else if (currentDemandaWeek === 2) { startIso = META.week2_start_iso; endIso = META.week2_end_iso; }
  const days = new Set();
  DADOS_DEMANDAS.forEach(d => {
    const iso = getDemandaDateIso(d);
    if (!iso) return;
    if (startIso && endIso && (iso < startIso || iso > endIso)) return;
    days.add(iso);
  });
  const sorted = [...days].sort();
  const DIAS_LABEL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  DIAS_DA_DEMANDA = sorted.map((iso) => {
    const dt = new Date(iso + 'T12:00:00');
    return { valor: iso, rotulo: `${DIAS_LABEL[dt.getDay()]} ${iso.slice(8,10)}/${iso.slice(5,7)}` };
  });
  // Dia que sumiu do recorte nao pode continuar filtrando escondido.
  if (currentDemandaDayFilter && !sorted.includes(currentDemandaDayFilter)) currentDemandaDayFilter = '';
  const escolhido = DIAS_DA_DEMANDA.find((d) => d.valor === currentDemandaDayFilter);
  sel.textContent = escolhido ? escolhido.rotulo : 'Todos os dias';
  sel.classList.toggle('escolhido', Boolean(escolhido));
}

function filterDemandaByDay(sel) {
  currentDemandaDayFilter = sel.value;
  renderDemandas();
}

// ─── Buscar itens do board Demandas ────────────────────────────────────────────────────────────────────
async function fetchAllDemandas() {
  // Solicitações vivem no banco da Vybe. Em modo normal, uma falha precisa ficar
  // visível e preservar o cache; nunca pode devolver autoridade ao Monday.
  // O caminho legado abaixo só é alcançado quando a contingência administrativa
  // explícita muda fonteDeLeitura() para "espelho".
  if (fonteDeLeitura() === 'dominio') {
    const dados = await buscarDemandas();
    return demandasComoItensDoMonday(dados);
  }
  const allItems = [];
  let cursor = null;
  let page = 0;
  while (true) {
    page++;
    const pct = Math.min(92, 5 + page * 16);
    document.getElementById('loading-progress').style.width = `${pct}%`;
    setLoadingState({ phase:'SINCRO DE DEMANDAS EM CURSO', text:`Coletando solicitações operacionais · pacote ${String(page).padStart(2,'0')}`, count:`${String(pct).padStart(2,'0')} / 100`, code:`DEMANDAS // ${String(page).padStart(2,'0')}`, system:'CENTRAL DE DEMANDAS ATIVA' });
    const query = cursor
      ? `query($cursor: String!) {
          next_items_page(limit: 200, cursor: $cursor) {
            cursor
            items {
              id name
              group { id title }
              column_values(ids: ["lista_suspensa_mkmet5gs","status","color_mkwtgakv","data","data_mkky6jx","person","dropdown_mkv8d52z"]) {
                  id text value
                  ... on StatusValue { index label_style { color border } updated_at }
                }
            }
          }
        }`
      : `{
          boards(ids: [${BOARD_DEMANDAS_ID}]) {
            items_page(limit: 200) {
              cursor
              items {
                id name
                group { id title }
                column_values(ids: ["lista_suspensa_mkmet5gs","status","color_mkwtgakv","data","data_mkky6jx","person","dropdown_mkv8d52z"]) {
                  id text value
                  ... on StatusValue { index label_style { color border } updated_at }
                }
              }
            }
          }
        }`;
    const data = await mondayQuery(query, cursor ? { cursor } : {});
    let items, nextCursor;
    if (cursor) {
      items = data.next_items_page.items;
      nextCursor = data.next_items_page.cursor;
    } else {
      items = data.boards[0].items_page.items;
      nextCursor = data.boards[0].items_page.cursor;
    }
    allItems.push(...items);
    if (!nextCursor || items.length < 200) break;
    cursor = nextCursor;
  }
  return allItems;
}

function processDemandas(rawItems) {
  const fmtDate = iso => iso ? `${iso.slice(8,10)}/${iso.slice(5,7)}` : '';
  return rawItems.map(item => {
    const colMap = {}, colValueMap = {}, colStyleMap = {};
    (item.column_values||[]).forEach(c => {
      colMap[c.id] = c.text || '';
      colValueMap[c.id] = c.value || '';
      colStyleMap[c.id] = { ...(c.label_style || {}), index: c.index, updated_at: c.updated_at };
    });
    const clientes = (item.clientes || (colMap[COLUNAS.demandas.cliente] || '').split(',')).map(n => normalizarCliente(n.trim())).filter(Boolean);
    const cliente = clientes[0] || '—';
    const status     = colMap['status'] || '—';
    const prioridade = colMap[COLUNAS.demandas.prioridade] || '';
    const prazoIso   = (colMap['data']||'').slice(0,10);
    const conclusaoIso = (colMap[COLUNAS.demandas.veiculacao]||'').slice(0,10);
    const tipo       = colMap[COLUNAS.demandas.formato] || '—';
    const groupId    = item.group?.id || '';
    const grupo      = DEMANDAS_GROUP_MAP[groupId] || item.group?.title || groupId || '—';
    let responsavelId = '', responsavelIds = [];
    const pv = colValueMap['person'];
    if (pv) {
      try {
        const parsed = JSON.parse(pv);
        const arr = parsed.personsAndTeams || parsed.persons || [];
        responsavelIds = arr.map(p => String(p.id));
        if (responsavelIds.length > 0) responsavelId = responsavelIds[0];
      } catch(e) {}
    }
    const hoje = META.today_iso || '';
    const prazoAtrasado = !!(prazoIso && prazoIso < hoje && !['Feito','Aprovado','Concluído','Concluido','Finalizado'].includes(status));
    return {
      // contagem de tarefas da solicitação, para a fila mostrar o andamento
      tarefas: item.tarefas || 0, tarefas_feitas: item.tarefas_feitas || 0,
      material_bruto: typeof item.material_bruto === 'string' ? item.material_bruto : null,
      tem_briefing: typeof item.tem_briefing === 'boolean' ? item.tem_briefing : null,
      criado_em: item.criado_em || '', cadastrado_por: item.cadastrado_por || '',
      id: String(item.id),
      nome: item.name || '',
      cliente, clientes, status, prioridade, tipo,
      status_color: colStyleMap['status']?.color || '',
      status_updated_at: colStyleMap['status']?.updated_at || '',
      status_border: colStyleMap['status']?.border || '',
      status_index: colStyleMap['status']?.index ?? null,
      prazo: fmtDate(prazoIso),       prazo_iso: prazoIso,       prazo_atrasado: prazoAtrasado,
      conclusao: fmtDate(conclusaoIso), conclusao_iso: conclusaoIso,
      grupo, group_id: groupId,
      responsavel: colMap['person'] || '',
      responsavel_id: responsavelId, responsavel_ids: responsavelIds,
      url: `/?vybe_item=${item.id}`
    };
  });
}

// ─── Fluxo operacional integrado · CADASTROS → Produção / Solicitações ────────
// Os módulos são visões diferentes da mesma operação. A origem continua explícita
// para que uma solicitação não seja confundida com conteúdo editorial.
const REQUEST_STATUS_FALLBACK_COLORS = Object.freeze({
  'Nova Demanda':'#579bfc', 'Pode Fazer':'#ffbd2e', 'Em execução':'#ff6b00',
  'Em Execução':'#ff6b00', 'Feito':'#00c875', 'Concluídas':'#00c875',
  'Alteração':'#ff637a', 'Aguardando Info.':'#9d50dd', 'Aguardando Aprovação':'#579bfc',
  'Para Aprovação':'#579bfc', 'Em aprovação':'#579bfc'
});
const REQUEST_STATUS_ORDER = ['Nova Demanda','Pode Fazer','Em execução','Feito','Alteração','Aguardando Info.','Para Aprovação'];
function operationalFlowStatus(item={}) {
  const status=String(item?.status || '').trim();
  if(!isRequestItem(item)) return status;
  // Todo nome que signifique "esperando aprovacao" precisa cair no MESMO estado
  // de fluxo. Faltava "Em aprovacao" — e o Modo Foco separa por estado, entao a
  // peca que a Jady mandou para aprovacao nao pertencia a grupo nenhum e sumia
  // da tela dela. Um nome fora do mapa nao vira um grupo novo: vira invisivel.
  return ({'Nova Demanda':'A Fazer','Em execução':'Em andamento','Em Execução':'Em andamento','Feito':'Finalizado','Aguardando Info.':'Falta Info','Aguardando Aprovação':'Para aprovação','Em aprovação':'Para aprovação','Em Aprovação':'Para aprovação','Para Aprovação':'Para aprovação','Aguardando aprovação':'Para aprovação'})[status] || status;
}
function isRequestItem(item={}) { return item?.origem === 'solicitacao' || item?.board_id === BOARD_DEMANDAS_ID; }
function normalizeContentForOperational(item={}) {
  return {...item, origem:item.origem || 'producao_conteudo', origem_label:item.origem_label || 'PRODUÇÃO DE CONTEÚDO', board_id:item.board_id || BOARD_ID};
}
function normalizeRequestForOperational(item={}) {
  const completionIso=item.conclusao_iso || item.prazo_iso || '';
  return {...item,
    origem:'solicitacao', origem_label:'SOLICITAÇÃO DE DEMANDA', board_id:BOARD_DEMANDAS_ID,
    // "Solicitacao" era um preenchimento para a linha nao ficar vazia, e virou um
    // tipo falso: aparecia no cartao como se fosse a classificacao da peca, e
    // escondia que ela esta SEM tipo — logo depois de a tela ganhar um filtro
    // inteiro para isso. A linha ja sabe desenhar campo vazio.
    tipo_demanda:item.tipo || '', formato:item.tipo || '', formato_original:item.tipo || '',
    veiculacao_iso:item.veiculacao_iso || completionIso, veiculacao:item.veiculacao || item.conclusao || item.prazo || '',
    updated_at:item.updated_at || item.status_updated_at || '',
    status_context:item.status_context || null
  };
}
function unifiedOperationalItems() {
  const content=(DADOS_ALL?.length ? DADOS_ALL : DADOS || []).map(normalizeContentForOperational);
  const requests=(DADOS_DEMANDAS || []).map(normalizeRequestForOperational);
  const seen=new Set();
  return [...content,...requests].filter(item=>{ const key=`${item.board_id || ''}:${String(item.id)}`; if(seen.has(key)) return false; seen.add(key); return true; });
}
function findOperationalItem(itemId) { return unifiedOperationalItems().find(item=>String(item.id)===String(itemId)); }
// UM STATUS SEM NINGUEM NAO PODE FINGIR TER INDICE.
//
// O indice de um status e do quadro, nao nosso — e so aparece aqui de carona,
// copiado de alguma solicitacao que ja esta naquele status. Quando NENHUMA esta
// — o caso de "Para Aprovação" — o codigo antigo caia na posicao da lista e
// entregava esse numero como se fosse o indice de verdade.
//
// Dois status ficavam entao com o mesmo numero, e o numero era a identidade do
// que a pessoa clicou: escolher "Para Aprovação" resolvia para o outro. Se o
// outro fosse o status atual da peca, a guarda de "ja esta neste status"
// entendia que nao havia nada a fazer, fechava o menu e nao dizia nada. Era
// isso que se via como o botao de aprovar nao funcionando.
//
// Sem exemplo, o indice fica nulo e assumido: quem manda e o rotulo.
function statusDoQuadroDeDemandas() {
  return (typeof CATALOGO_STATUS_DEMANDAS === 'undefined' ? [] : CATALOGO_STATUS_DEMANDAS) || [];
}
function requestStatusOptions(item={}) {
  // O quadro manda quando ele ja respondeu. A lista escrita a mao continua como
  // rede de seguranca para o primeiro desenho, antes de a leitura chegar.
  const doQuadro = statusDoQuadroDeDemandas();
  // '—' e o tracinho que o painel poe numa solicitacao SEM status. Ele entrava
  // na lista junto com os status de verdade e podia ser escolhido; escolher
  // manda um nome vazio ao servidor, que recusa. Nao ter status nao e um lugar
  // para onde se mande a peca.
  const eStatus = (rotulo) => Boolean(rotulo) && !/^[—–-]+$/.test(String(rotulo).trim());
  if (doQuadro.length) {
    const labels=[...new Set([...doQuadro.map(st=>String(st.rotulo||'').trim()),...(DADOS_DEMANDAS||[]).map(row=>row.status),item.status].filter(eStatus))];
    return labels.map((label)=>{
      const st=doQuadro.find(entry=>String(entry.rotulo||'').trim()===label);
      const sample=(DADOS_DEMANDAS||[]).find(row=>row.status===label);
      const cru=st?st.indice:sample?.status_index;
      const indice=(cru===null||cru===undefined||cru==='')?NaN:Number(cru);
      return {label,chave:st?.chave||chaveDeStatus(label),ativa:st?st.ativa!==false:true,
        index:Number.isFinite(indice)?indice:null,
        color:st?.cor || sample?.status_color || REQUEST_STATUS_FALLBACK_COLORS[label] || '#8f8f8f',
        border:st?.borda || st?.cor || sample?.status_border || sample?.status_color || REQUEST_STATUS_FALLBACK_COLORS[label] || '#8f8f8f'};
    });
  }
  const labels=[...new Set([...REQUEST_STATUS_ORDER,...(DADOS_DEMANDAS||[]).map(row=>row.status),item.status].filter(eStatus))];
  return labels.map((label)=>{
    const sample=(DADOS_DEMANDAS||[]).find(row=>row.status===label);
    // Number(null) e 0, e 0 e indice de verdade de alguem: a checagem tem de ser
    // por ausencia, nao por conversao — senao a peca que acabou de entrar num
    // status sem indice reinventa a colisao com o indice 0.
    const cru=sample?.status_index;
    const indice=(cru===null||cru===undefined||cru==='')?NaN:Number(cru);
    return {label,index:Number.isFinite(indice)?indice:null,color:sample?.status_color || REQUEST_STATUS_FALLBACK_COLORS[label] || '#8f8f8f',border:sample?.status_border || sample?.status_color || REQUEST_STATUS_FALLBACK_COLORS[label] || '#8f8f8f'};
  });
}
function operationalStatusOptions(item={}) { return isRequestItem(item) ? requestStatusOptions(item) : (STATUS_OPTIONS || []); }
function renderIntegratedOperationalViews() {
  if(panelMode==='foco') renderFocusDashboard();
  else if(panelMode==='controler') renderDaController();
  else if(panelMode==='gestor') {
    renderManagerIntelligence(); renderManagerCalendar();
    if(viewMode==='day') for(let sem=1;sem<=(META.weeks?.length||0);sem++) renderWeek(sem,currentFilter,currentDayFilter);
  }
}
let unifiedDemandasLoading=false;
let unifiedDemandasState='idle';
async function ensureDemandasForOperationalViews(force=false) {
  if(unifiedDemandasLoading || (!force && DADOS_DEMANDAS.length)) { renderIntegratedOperationalViews(); return; }
  unifiedDemandasLoading=true;
  unifiedDemandasState='loading';
  try {
    const rawItems=await fetchAllDemandas();
    DADOS_DEMANDAS=processDemandas(rawItems);
    unifiedDemandasState='ready';
    syncStatusLegendColors('#demanda-status-legend',DADOS_DEMANDAS);
    renderIntegratedOperationalViews();
    // Se a tela de Demandas ja estiver aberta, ela tem de acompanhar: era comum
    // o dado chegar por aqui e a tela continuar vazia ate alguem trocar de aba.
    if (typeof activeBoard !== 'undefined' && activeBoard === 'demandas') renderDemandas();
  } catch(error) {
    unifiedDemandasState='error';
    renderIntegratedOperationalViews();
    console.warn('Solicitações indisponíveis para os módulos integrados:',error);
  } finally { unifiedDemandasLoading=false; }
}

async function refreshDemandas() {
  const btn = document.getElementById('btn-refresh');
  const icon = document.getElementById('refresh-icon');
  const loading = document.getElementById('loading');
  btn.disabled = true;
  icon.className = 'spin';
  const loadingCycle = beginLoadingCycle();
  setLoadingState({ phase:'CONECTANDO À CENTRAL DE DEMANDAS', text:'Autenticando canal de solicitações...', count:'00 / 100', code:'DEMANDAS // 00', system:'CENTRAL DE DEMANDAS EM SINCRONIA' });
  showToast('Buscando demandas...', 'info', 60000);
  try {
    const rawItems = await fetchAllDemandas();
    DADOS_DEMANDAS = processDemandas(rawItems);
    unifiedDemandasState='ready';
    syncStatusLegendColors('#demanda-status-legend', DADOS_DEMANDAS);
    renderDemandas();
    renderIntegratedOperationalViews();
    showToast(`${DADOS_DEMANDAS.length} ${DADOS_DEMANDAS.length === 1 ? 'demanda carregada' : 'demandas carregadas'}`, 'ok');
  } catch(e) {
    console.error(e);
    showToast(`Erro: ${e.message}`, 'err', 8000);
  } finally {
    finishLoadingCycle(loadingCycle);
    btn.disabled = false;
    icon.className = '';
    icon.textContent = '↻';
    setTimeout(() => {
      if (loadingCycle !== loadingCycleId) return;
      loading.classList.remove('show');
    }, 620);
  }
}

// Helpers de prioridade
function prioHtml(p) {
  if (!p) return '<span class="prio-none">—</span>';
  const cls = p.toLowerCase().includes('alta') ? 'prio-alta' : p.toLowerCase().includes('média') || p.toLowerCase().includes('media') ? 'prio-media' : p.toLowerCase().includes('baixa') ? 'prio-baixa' : 'prio-none';
  return `<span class="${cls}">${p}</span>`;
}

// Mapeamento de status do board Solicitações de Demandas
const STATUS_CLS_DEMANDAS = {
  'Nova Demanda':     'nova-demanda',
  'Pode Fazer':       'pode-fazer',
  'Em execução':     'em-execucao',
  'Feito':            'feito',
  'Alteração':        'alteracao-d',
  'Aguardando Info.': 'aguardando-info',
  'Em aprovação':    'em-aprovacao',
  'Aprovado':         'aprovado',
  'Em impressão':     'em-impressao',
  'Em Orçamento':     'em-orcamento',
  'Para Orçar':       'para-orcar',
  // compat
  'Em andamento':     'em-execucao',
  'Concluído':        'feito',
  'Finalizado':       'feito',
  'A Fazer':          'a-fazer',
};
function statusClsDemanda(s) { return STATUS_CLS_DEMANDAS[s] || 'default'; }
// Mesma regra da produção: sem cor explícita, a cor vem do catálogo — não de
// uma classe de CSS com a cor escrita à mão.
function pillHtmlDemanda(s, color='', border='') {
  if (!color) {
    const c = typeof corDeStatus === 'function' ? corDeStatus(s) : null;
    if (c) { color = c.cor; border = border || c.borda; }
  }
  return `<span class="pill pill-${statusClsDemanda(s)}"${statusInlineStyle(color, border)}><span class="pill-dot"${statusDotInlineStyle(color)}></span>${s}</span>`;
}

// ─── Renderizar KPIs das demandas ────────────────────────────────────────────────────────────────────
// Atrasada: prazo vencido e ainda nao concluida. A mesma regra em todo lugar —
// no numero do topo e no filtro que ele aciona.
const DEMANDA_CONCLUIDA = ['Feito', 'Aprovado', 'Concluído', 'Concluido', 'Finalizado'];
function demandaAtrasada(d) {
  const hoje = META.today_iso || '';
  return Boolean(d.prazo_iso && hoje && d.prazo_iso < hoje && !DEMANDA_CONCLUIDA.includes(d.status));
}

// Quatro numeros, e os quatro filtram.
//
// Eram sete, e tinham tres problemas. Nao fechavam: 1 + 5 + 34 + 316 dava 356 de
// 364, porque "Em aprovacao", "Alteracao" e "Aguardando Info." nao entravam em
// nenhum cartao — oito solicitacoes existiam no quadro e nao existiam no topo.
// Nao pediam acao: "Total 364" e "Concluidas 316" ocupavam o maior tipo da
// pagina e nao mudam nada do que se faz hoje. E nao levavam a lugar nenhum:
// "Atrasadas 12" era a unica coisa urgente ali, e nao dava para clicar nela.
//
// Agora sao quatro perguntas do dia, cada uma abrindo a lista dela. E cada
// cartao le o MESMO estado que a etiqueta de status e a de tipo usam: acender o
// cartao acende a etiqueta, e vice-versa. Sem dois lugares dizendo coisas
// diferentes sobre o mesmo filtro.
function renderDemandaKPIs() {
  const all = DADOS_DEMANDAS.filter(itemNaCarteira);
  const porStatus = (nomes) => all.filter((d) => nomes.includes(d.status)).length;
  const kpis = [
    { label:'Atrasadas', valor: all.filter(demandaAtrasada).length, sub:'prazo vencido', cls:'red',
      aceso: currentDemandaAtrasadas, acao: 'focarAtrasadas()' },
    { label:'Em execução', valor: porStatus(['Em andamento','Em Andamento','Em execução']), sub:'em produção', cls:'cyan',
      aceso: currentDemandaStatusFilter === 'Em execução', acao: "focarStatus('Em execução')" },
    { label:'Pode fazer', valor: porStatus(['Pode Fazer']), sub:'briefing pronto', cls:'yellow',
      aceso: currentDemandaStatusFilter === 'Pode Fazer', acao: "focarStatus('Pode Fazer')" },
    { label:'Sem tipo', valor: all.filter((d) => !tipoDaDemanda(d)).length, sub:'falta classificar', cls:'orange',
      aceso: currentDemandaTipoFilter === '__sem__', acao: "filtrarDemandaPorTipo('__sem__')" },
  ];
  const alvo = document.getElementById('kpi-grid-demandas');
  if (!alvo) return;
  // Padrão Vybe (21/10/2026): uma linha de resumo no lugar dos quatro cartões
  // grandes, que ocupavam a primeira tela com zeros. O que pede ação ganha cor;
  // zero fica discreto; cada item continua filtrando a lista.
  alvo.className = 'vb-resumo';
  const tom = (k) => (!k.valor ? '' : k.cls === 'red' ? 'alerta' : k.cls === 'orange' ? 'atencao' : '');
  // Redesign do legado, fase 2 (Paulo, 09/11/2026): zero não pede ação, então sai da linha (fica só o filtro aceso,
  // para dar como desligar); tudo zerado, a linha some.
  const visiveis = kpis.filter((k) => k.valor || k.aceso);
  alvo.hidden = !visiveis.length;
  alvo.innerHTML = visiveis.map((k) => `<button type="button" class="vb-resumo-item ${tom(k)}" aria-pressed="${Boolean(k.aceso)}"
      onclick="${k.acao}" title="${k.aceso ? 'Clique para mostrar todas de novo' : `Ver só as ${k.label.toLowerCase()} (${k.sub})`}"><b>${k.valor}</b>${vbRotulo(k.label)}</button>`).join('');
}

function focarAtrasadas() {
  if (visaoRapidaDemandas === 'concluidas') visaoRapidaDemandas = 'abertas';
  currentDemandaAtrasadas = !currentDemandaAtrasadas;
  // Atrasada e sobre o prazo, entao a coluna de data tem de ser a do prazo:
  // filtrar por atraso e continuar lendo a data de conclusao esconde o motivo.
  if (currentDemandaAtrasadas && currentDemandaDateMode !== 'prazo') {
    const botao = document.getElementById('btn-dmode-prazo');
    if (botao) return setDemandaDateMode('prazo', botao);
  }
  renderDemandas();
}
function focarStatus(status) {
  if (DEMANDA_CONCLUIDA.includes(status)) visaoRapidaDemandas = 'concluidas';
  else if (visaoRapidaDemandas === 'concluidas') visaoRapidaDemandas = 'abertas';
  currentDemandaStatusFilter = currentDemandaStatusFilter === status ? 'all' : status;
  document.querySelectorAll('#demanda-status-legend .pill').forEach((p) => {
    p.classList.toggle('active-legend',
      currentDemandaStatusFilter !== 'all' && p.textContent.trim().toLowerCase() === status.toLowerCase());
  });
  renderDemandas();
}

// Helper: linha de item de demanda
// O CARTAO TINHA OITO PECAS SOLTAS NUMA LINHA QUE QUEBRAVA SOZINHA.
//
// Cliente, id, tipo, nome, duas datas, prioridade, status e as bolinhas, tudo
// em flex-wrap. Cada cartao quebrava num lugar diferente conforme o tamanho do
// nome, e por isso dois cartoes vizinhos nunca alinhavam nada — era essa a
// sensacao de bagunca, e nenhuma cor nova ia consertar.
//
// Agora a estrutura e FIXA, tres faixas em todo cartao:
//   1. de quem e (cliente) e o id, miudo e quieto — id de onze digitos ninguem
//      le, so copia;
//   2. o NOME, sozinho, no maior peso do cartao: e a unica coisa que se procura
//      passando o olho por uma coluna;
//   3. o rodape: status a esquerda, datas no meio, quem faz a direita — sempre
//      nessas posicoes, mesmo quando algum deles nao existe.
function demandaItemRow(d, showCliente = true) {
  const data = (rotulo, valor, classe) => valor
    ? `<span class="dem-data ${classe}" title="${rotulo}"><i>${rotulo}</i>${safeText(valor)}</span>` : '';
  const datas = `${data('Prazo', d.prazo, d.prazo_atrasado ? 'vencido' : '')}${data('Conclusão', d.conclusao, 'fim')}`;
  const selos = [
    d.prazo_atrasado ? '<span class="dem-selo atrasado">Atrasado</span>' : '',
    d.prioridade ? prioHtml(d.prioridade) : '',
    d.tipo && String(d.tipo).trim() !== '—' ? fmtHtml(d.tipo) : '',
  ].filter(Boolean).join('');

  return `<article class="item-row dem-cartao abre-resumo"
      onclick="abrirCartaoRapido('${safeText(d.id)}',event,'request')"
      title="Abrir o resumo de ${safeText(d.nome || '')}">
    <div class="dem-cartao-topo">
      ${showCliente ? vybeTagCliente(d) : ''}
      ${vybeChipId(d)}
    </div>
    <div class="dem-cartao-nome">${vybeNome(d)}</div>
    ${selos ? `<div class="dem-cartao-selos">${selos}</div>` : ''}
    <div class="dem-cartao-pe">
      <span class="dem-cartao-estado">${vybeStatus(d)}</span>
      <span class="dem-cartao-datas">${datas}</span>
      <span class="dem-cartao-donos">${vybeDono(d)}</span>
    </div>
  </article>`;
}

// Andamento das tarefas de dentro da solicitação. Sem isto, saber que 3 de 12
// já estão feitas exigia abrir a peça — e é a pergunta que se faz olhando a fila.
function tarefasHtml(d) {
  const total = Number(d?.tarefas || 0);
  if (!total) return '';
  const feitas = Number(d?.tarefas_feitas || 0);
  const completa = feitas === total;
  return `<span class="item-tarefas ${completa ? 'completa' : ''}"
    title="${feitas} de ${total} tarefa${total === 1 ? '' : 's'} concluída${feitas === 1 ? '' : 's'}">
    <i style="--feito:${Math.round((feitas / total) * 100)}%"></i>${feitas}/${total}</span>`;
}

// Ordenar por data mais recente primeiro (prazo ou conclusão, decrescente)
function sortDemandas(items) {
  const getDateKey = d => {
    // Usar a data mais recente entre prazo e conclusão
    const p = d.prazo_iso || '';
    const c = d.conclusao_iso || '';
    if (p && c) return p > c ? p : c;
    return p || c || '';
  };
  return [...items].sort((a,b) => {
    const da = getDateKey(a);
    const db = getDateKey(b);
    // Sem data vai para o final
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    // Crescente: mais antigo primeiro
    return da.localeCompare(db);
  });
}

// Onde esta o tipo, de verdade.
//
// A lista crua de Solicitacoes guarda em 'tipo'. O normalizador que a tabela usa
// copia para 'formato' — mas, quando esta vazio, escreve "Solicitacao" no lugar
// (`formato: item.tipo || 'Solicitacao'`). Isso e bom para a linha, que precisa
// mostrar alguma coisa, e pessimo para contar: lido por 'formato', NENHUMA
// solicitacao aparece sem tipo, e era por isso que o problema nunca virava
// numero. Aqui 'tipo' manda, e 'formato_original' e a copia fiel dele; so quem
// nao tem nenhum dos dois cai no formato.
// A REGRA DO CALENDARIO, dita pelo Paulo em 01/09/2026: uma solicitacao so entra
// no calendario de conteudo se ela vai pro feed — e quem diz isso e a TAG dela.
// Card, Carrossel, Fotografia e Reels vao. Relatorio, reuniao, ajuste de site e
// o que mais aparecer nao vao: sao trabalho, mas nao sao publicacao.
//
// PARA MUDAR A REGRA, mexa so nesta lista: cada linha e o comeco do nome da tag,
// sem acento e em minusculas. Vale o comeco e nao o nome inteiro porque a mesma
// tag chega escrita de varios jeitos, e o plural do portugues troca a palavra:
// 'Carrossel' vira 'Carrosseis', 'Foto' vira 'Fotografia'. Comparar pelo comeco
// pega os dois; comparar pelo nome exato perdia metade.
const TAGS_DO_FEED = ['card', 'carross', 'foto', 'reel', 'feed'];
function chaveDeTag(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z]/g, '');
}
function tagEhDeFeed(tag) {
  const chave = chaveDeTag(tag);
  return Boolean(chave) && TAGS_DO_FEED.some((comeco) => chave.startsWith(comeco));
}
// Sem tag nao e "nao vai pro feed" — e "ninguem disse ainda". Some do calendario
// so quem tem uma tag que diz explicitamente outra coisa; assim uma peca de feed
// que alguem esqueceu de etiquetar nunca desaparece da agenda em silencio.
function solicitacaoVaiProFeed(item) {
  const tag = tipoDaDemanda(item);
  return !tag || tagEhDeFeed(tag);
}
function solicitacaoSemTag(item) {
  return !tipoDaDemanda(item);
}
function tipoDaDemanda(d) {
  if (!d) return '';
  const bruto = String(
    'tipo' in d ? (d.tipo ?? '')
    : 'formato_original' in d ? (d.formato_original ?? '')
    : (d.formato ?? '')).trim();
  return bruto === '—' ? '' : bruto;
}
function filtrarPorTipoDeDemanda(lista) {
  if (currentDemandaTipoFilter === 'all') return lista;
  if (currentDemandaTipoFilter === '__sem__') return lista.filter((d) => !tipoDaDemanda(d));
  return lista.filter((d) => tipoDaDemanda(d) === currentDemandaTipoFilter);
}
function filtrarDemandaPorTipo(tipo) {
  currentDemandaTipoFilter = currentDemandaTipoFilter === tipo ? 'all' : tipo;
  renderDemandas();
}
function limparTipoDeDemanda() { currentDemandaTipoFilter = 'all'; renderDemandas(); }

// A fileira de tipos e desenhada a partir dos dados, nao de uma lista fixa: se
// alguem criar "Impresso" no cadastro de etiquetas, ele aparece aqui sozinho, e
// com a conta de quantos ja estao nele.
// ── dois nomes para o mesmo momento ──────────────────────────────────────────
// "Aguardando Aprovacao" e "Em aprovacao" convivem nas solicitacoes, herdados da
// epoca em que cada um escrevia o seu no Monday. Vocabulario dobrado nao e
// detalhe: quem filtra por um nao ve as do outro, e as duas listas ficam sempre
// pela metade. O aviso so aparece enquanto os dois existirem — feita a juncao,
// ele some sozinho, porque a condicao que o mostra deixa de ser verdadeira.
const APROVACAO_FINAL = 'Para Aprovação';
function chaveDeStatusDemanda(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
// A JUNCAO E DOS NOMES DE ESPERA, E SO DELES.
//
// "Aprovado" tambem fala de aprovacao, e nao e nome repetido de nada: e o outro
// lado da mesma porta. Uma peca em "Para Aprovação" espera resposta; uma em
// "Aprovado" ja recebeu. Procurar por /aprova/ colocava as duas no mesmo saco e
// oferecia juntar uma na outra — apagando a diferenca entre pedir e ter, sem
// desfazer. Foi o que a lista mostrou assim que ela passou a enxergar o quadro
// inteiro.
//
// Entao o que entra e so a familia da espera: "aprovacao" sozinha, ou precedida
// de em / para / aguardando / ag. Participio nao entra.
function aprovacoesParaAbsorver() {
  const item = (DADOS_DEMANDAS || [])[0] || {};
  const daLista = typeof requestStatusOptions === 'function'
    ? requestStatusOptions(item).map((o) => String(o.label || '').trim()) : [];
  const usados = (DADOS_DEMANDAS || []).map((d) => String(d.status || '').trim());
  // O que existe no quadro conta mesmo sem ninguem nele: era exatamente o nome
  // vazio que ficava sem jeito de tirar, porque nao aparecia em lugar nenhum.
  const noQuadro = typeof statusDoQuadroDeDemandas === 'function'
    ? statusDoQuadroDeDemandas().map((st) => String(st.rotulo || '').trim()) : [];
  const todos = [...new Set([...daLista, ...usados, ...noQuadro])].filter(Boolean);
  // "Em Aprovacao" deixou de ser nome repetido. Paulo em 02/09/2026: sao dois
  // momentos, nao dois nomes — "Para Aprovacao" e a peca mandada, "Em
  // Aprovacao" e ela sendo avaliada, no interno e com o cliente. Junta-las
  // apagaria a etapa do meio.
  //
  // Sobram para absorver so os nomes herdados que nao dizem nada de novo:
  // "Aguardando Aprovacao" e "Ag. Aprovacao".
  const PROPRIOS = new Set([chaveDeStatusDemanda(APROVACAO_FINAL), 'em aprovacao']);
  const esperaAprovacao = (r) => /^(?:(?:aguardando|ag|aguardo)\s+)?aprovacao\b/.test(chaveDeStatusDemanda(r));
  return todos.filter((r) => esperaAprovacao(r) && !PROPRIOS.has(chaveDeStatusDemanda(r)));
}
function pintarAvisoDeAprovacoes() {
  const caixa = document.getElementById('demanda-tipo-legend');
  if (!caixa) return;
  document.getElementById('juntar-aprovacoes')?.remove();
  const sobrando = aprovacoesParaAbsorver();
  const podeMexer = typeof podeAdministrar === 'function' ? podeAdministrar() : false;
  if (!sobrando.length || !podeMexer) return;
  const conta = (r) => (DADOS_DEMANDAS || []).filter((d) => String(d.status || '').trim() === r).length;
  const rotulo = sobrando.length === 1
    ? `tirar "${sobrando[0]}" — vira "${APROVACAO_FINAL}"`
    : `${sobrando.length} status de aprovação — juntar em "${APROVACAO_FINAL}"`;
  caixa.insertAdjacentHTML('beforeend', `<button type="button" id="juntar-aprovacoes" class="tipo-chip juntar"
    title="${safeText(sobrando.map((r) => `${r}: ${conta(r)}`).join(' · '))}"
    onclick="juntarAprovacoes()">${safeText(rotulo)}</button>`);
}
async function juntarAprovacoes() {
  const sobrando = aprovacoesParaAbsorver();
  if (!sobrando.length) return;
  const total = sobrando.reduce((n, r) => n + (DADOS_DEMANDAS || [])
    .filter((d) => String(d.status || '').trim() === r).length, 0);
  const ok = await perguntarNoPainel({
    titulo: sobrando.length === 1 ? `Tirar "${sobrando[0]}" da lista?` : 'Juntar os status de aprovação?',
    texto: `${sobrando.join(' e ')} ${sobrando.length === 1 ? 'vira' : 'viram'} "${APROVACAO_FINAL}". `
      + (total
        ? `${total} solicitaç${total === 1 ? 'ão passa' : 'ões passam'} a usar o nome novo. `
        : 'Nenhuma solicitação está nele hoje; só o nome sai da lista. ')
      + 'Isso vale para todo mundo e não tem desfazer automático.',
    confirmar: sobrando.length === 1 ? 'Tirar da lista' : 'Juntar', perigo: true });
  if (!ok) return;
  try {
    const r = await fetch('/api/painel?area=opcoes', { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ acao:'unificar-status', de: sobrando, para: APROVACAO_FINAL }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Não foi possível juntar.');
    showToast(d.pecas_movidas
      ? `✓ ${d.pecas_movidas} solicitação(ões) movidas · agora é "${APROVACAO_FINAL}"`
      : `✓ ${d.nota || 'Lista de status limpa.'}`, 'ok', 6000);
    await refreshDemandas();
  } catch (e) { showToast(e.message, 'err', 7000); }
}

function pintarTiposDeDemanda() {
  const caixa = document.getElementById('demanda-tipo-legend');
  if (!caixa) return;
  const base = (DADOS_DEMANDAS || []).filter(itemNaCarteira);
  if (!base.length) { caixa.innerHTML = ''; return; }
  const conta = new Map();
  let sem = 0;
  base.forEach((d) => { const t = tipoDaDemanda(d);
    if (!t) { sem += 1; return; }
    conta.set(t, (conta.get(t) || 0) + 1); });
  const cor = (rotulo) => {
    const coluna = 'dropdown_mkv8d52z';
    const o = (typeof CATALOGO_OPCOES === 'undefined' ? [] : CATALOGO_OPCOES)
      .find((x) => x.coluna_id === coluna && x.rotulo === rotulo);
    const c = o?.cor ? { cor:o.cor, borda:o.borda || o.cor }
      : (typeof corDeOpcao === 'function' ? corDeOpcao(rotulo, coluna) : null);
    return c ? `style="background:${c.cor};border-color:${c.borda}"` : '';
  };
  const chip = (chave, rotulo, quantos, extra = '') => `<button type="button"
    class="tipo-chip ${currentDemandaTipoFilter === chave ? 'ativo' : ''} ${extra}" ${extra ? '' : cor(rotulo)}
    onclick="filtrarDemandaPorTipo('${String(chave).replace(/'/g, "\\'")}')"
    title="${extra ? 'Solicitações que ainda não têm tipo' : `Ver só ${safeText(rotulo)}`}">${
    safeText(rotulo)}<span>${quantos}</span></button>`;
  const tipos = [...conta.entries()].sort((a, b) => b[1] - a[1]);
  caixa.innerHTML = (sem ? chip('__sem__', 'Sem tipo', sem, 'sem') : '')
    + tipos.map(([rotulo, quantos]) => chip(rotulo, rotulo, quantos)).join('')
    + (currentDemandaTipoFilter !== 'all'
      ? '<button type="button" class="tipo-chip limpar" onclick="limparTipoDeDemanda()">mostrar todas</button>' : '');
}

// ─── Renderizar demandas (dispatcher por view) ────────────────────────────────────────────────────
// semCliente: a mesma conta sem o filtro de cliente — é o que cada botão de
// cliente mostra ("quantas teria se eu escolhesse este").
function filtrarDemandasBase({ semCliente = false } = {}) {
  let fi = DADOS_DEMANDAS.filter(itemNaCarteira).filter(d=>pertenceVisaoDemanda(d));
  const busca=buscaClienteDemandas.trim().toLocaleLowerCase('pt-BR');
  const exato=clienteDemandasExato.toLocaleLowerCase('pt-BR');
  if(!semCliente && exato) fi=fi.filter(d=>clientesDoItem(d).some(n=>n.toLocaleLowerCase('pt-BR')===exato));
  else if(!semCliente && busca) fi=fi.filter(d=>clientesDoItem(d).some(n=>n.toLocaleLowerCase('pt-BR').includes(busca)) || String(d.nome || '').toLocaleLowerCase('pt-BR').includes(busca));
  if (currentDemandaPersonFilter !== 'all') {
    fi = fi.filter(d => (d.responsavel_ids && d.responsavel_ids.includes(currentDemandaPersonFilter)) || d.responsavel_id === currentDemandaPersonFilter);
  }
  if (currentDemandaStatusFilter !== 'all') {
    fi = fi.filter(d => d.status === currentDemandaStatusFilter);
  }
  fi = filtrarPorTipoDeDemanda(fi);
  if (currentDemandaAtrasadas) fi = fi.filter(demandaAtrasada);
  // O filtro de dia so era aplicado nas visoes de semana. Na esteira — que e por
  // onde a tela abre — o botao "Dia" nao fazia nada: escolher um dia mudava o
  // rotulo do botao e mais nada. Agora ele filtra aqui, junto dos outros, e por
  // isso vale em toda visao.
  if (currentDemandaDayFilter) fi = fi.filter((d) => getDemandaDateIso(d) === currentDemandaDayFilter);
  // Filtrar por semana (exceto na esteira)
  if (currentDemandaWeek === 1) {
    fi = fi.filter(d => { const iso = getDemandaDateIso(d); return iso >= META.week1_start_iso && iso <= META.week1_end_iso; });
  } else if (currentDemandaWeek === 2) {
    fi = fi.filter(d => { const iso = getDemandaDateIso(d); return iso >= META.week2_start_iso && iso <= META.week2_end_iso; });
  }
  return fi;
}

// "Mostrando 1 de 364, porque..."
//
// Era o que faltava. A tela dizia 364 no topo e uma linha embaixo, e nada ligava
// os dois numeros. Quem abria nao sabia distinguir "nao ha o que fazer" de "um
// filtro escondeu tudo" — e sao seis filtros nesta tela (status, tipo, atraso,
// semana, equipe, dia). Agora ela diz quanto esta mostrando, de quanto, e por
// que; cada motivo sai com um clique no proprio nome.
function pintarResumoDeFiltros(quantos) {
  const alvo = document.getElementById('demanda-resumo');
  if (!alvo) return;
  const total = (DADOS_DEMANDAS || []).length;
  const chip = (rotulo, limpar) => `<button type="button" class="resumo-chip" onclick="${limpar}"
    title="Tirar este filtro">${safeText(rotulo)}<i aria-hidden="true">✕</i></button>`;
  const ativos = [];
  if (visaoRapidaDemandas !== 'todas') ativos.push(chip(VISOES_DEMANDAS[visaoRapidaDemandas], "escolherVisaoDemanda('todas')"));
  if (filtroCarteira !== 'all') ativos.push(chip('Carteira: ' + (filtroCarteira === 'vinicius' ? 'Vinícius' : 'Ewerton'), "definirFiltroCarteira('all')"));
  if(buscaClienteDemandas.trim()) ativos.push(chip((clienteDemandasExato ? 'Cliente: ' : 'Busca: ')+buscaClienteDemandas, "document.getElementById('busca-cliente-demandas').value='';buscarClienteDemandas('')"));
  if (currentDemandaAtrasadas) ativos.push(chip('atrasadas', 'focarAtrasadas()'));
  if (currentDemandaStatusFilter !== 'all') ativos.push(chip(currentDemandaStatusFilter, `focarStatus('${String(currentDemandaStatusFilter).replace(/'/g, "\\'")}')`));
  if (currentDemandaTipoFilter !== 'all') ativos.push(chip(
    currentDemandaTipoFilter === '__sem__' ? 'sem tipo' : currentDemandaTipoFilter, 'limparTipoDeDemanda()'));
  if (currentDemandaPersonFilter !== 'all') {
    const quem = (typeof TEAM_USERS === 'undefined' ? [] : TEAM_USERS)
      .find((u) => String(u.id) === String(currentDemandaPersonFilter));
    ativos.push(chip(quem ? firstName(quem.name) : 'uma pessoa',
      "filterDemandaByPerson('all',document.getElementById('person-all-demandas'))"));
  }
  // Dizer "um dia" obriga a pessoa a procurar QUAL. O resumo existe para
  // responder, nao para anunciar que ha uma resposta em outro lugar.
  if (currentDemandaDayFilter) {
    const dia = DIAS_DA_DEMANDA.find((d) => d.valor === currentDemandaDayFilter);
    ativos.push(chip(dia ? dia.rotulo : currentDemandaDayFilter, 'limparDiaDaDemanda()'));
  }

  if (!ativos.length) {
    alvo.innerHTML = `<span class="resumo-conta">${total} solicitaç${total === 1 ? 'ão' : 'ões'}</span>
      <span class="resumo-nota">nenhum filtro — está tudo à vista</span>`;
    return;
  }
  alvo.innerHTML = `<span class="resumo-conta">${quantos} de ${total}</span>
    <span class="resumo-nota">filtrando por</span>${ativos.join('')}
    <button type="button" class="resumo-limpar" onclick="clearDemandaFilters()">limpar tudo</button>`;
}
function limparDiaDaDemanda() {
  currentDemandaDayFilter = '';
  renderDemandas();
}

// Os clientes das solicitações, em botões: escolher um vale para a esteira, os
// Grupos e o Calendário, porque todos passam por filtrarDemandasBase. O número
// segue os outros filtros; quem fica com zero vai para o fim, apagado.
function pintarClientesDeDemandas() {
  const caixa = document.getElementById('demanda-cliente-legend');
  if (!caixa) return;
  const base = DADOS_DEMANDAS || [];
  if (!base.length) { caixa.innerHTML = ''; return; }
  const aparece = (n) => typeof clienteApareceNaLista !== 'function' || clienteApareceNaLista(n);
  const conta = new Map();
  base.forEach((d) => clientesDoItem(d).forEach((n) => { if (aparece(n)) conta.set(n, 0); }));
  const filtradas = filtrarDemandasBase({ semCliente: true });
  filtradas.forEach((d) => clientesDoItem(d).forEach((n) => { if (conta.has(n)) conta.set(n, conta.get(n) + 1); }));
  const clientes = [...conta.entries()]
    .sort((a, b) => (b[1] > 0) - (a[1] > 0) || a[0].localeCompare(b[0], 'pt-BR'));
  const escolhido = clienteDemandasExato;
  const botao = (nome, quantos) => `<button type="button" class="manager-calendar-client ${
      escolhido === nome ? 'active' : ''} ${quantos === 0 ? 'vazio' : ''}"
      aria-pressed="${escolhido === nome}"
      title="${escolhido === nome ? 'Tirar o filtro de cliente' : `Ver só ${safeText(nome)}`}"
      data-cliente="${safeText(nome)}" onclick="escolherClienteDemandas(this.dataset.cliente)"><b>${safeText(nome)}</b> ${quantos}</button>`;
  const todos = `<button type="button" class="manager-calendar-client ${buscaClienteDemandas.trim() ? '' : 'active'}"
      aria-pressed="${!buscaClienteDemandas.trim()}" onclick="buscarClienteDemandas('');document.getElementById('busca-cliente-demandas').value=''"><b>Todos</b> ${filtradas.length}</button>`;
  caixa.innerHTML = todos + clientes.map(([n, q]) => botao(n, q)).join('');
}

// Demandas (quadro 03, 10/11/2026): o filtro ativo acende o chip dele, com a escolha escrita no próprio chip.
function pintarChipsDeDemandas() {
  const marcar = (chave, valor) => {
    const chip = document.querySelector(`#painel-demandas [data-dem-chip="${chave}"]`); if (!chip) return;
    const escolha = chip.querySelector('.agenda-filtro-escolha'); if (escolha && escolha.textContent !== valor) escolha.textContent = valor;
    chip.classList.toggle('tem-escolha', Boolean(valor));
  };
  const pessoa = currentDemandaPersonFilter !== 'all' && typeof TEAM_USERS !== 'undefined' ? TEAM_USERS.find((u) => String(u.id) === String(currentDemandaPersonFilter)) : null;
  marcar('status', currentDemandaStatusFilter !== 'all' ? String(currentDemandaStatusFilter) : '');
  marcar('tipo', currentDemandaTipoFilter === '__sem__' ? 'Sem tipo' : currentDemandaTipoFilter !== 'all' ? String(currentDemandaTipoFilter) : '');
  marcar('cliente', clienteDemandasExato || '');
  marcar('responsavel', currentDemandaPersonFilter === 'all' ? '' : String(pessoa?.name || pessoa?.nome || '1 pessoa').split(' ')[0]);
}
function renderDemandas() {
  restaurarPreferenciasDemandas();
  pintarVisoesDemandas();
  pintarChipsDeDemandas();
  document.querySelectorAll('#date-mode-bar-demandas .date-mode-btn').forEach(el=>el.classList.toggle('active', el.id === 'btn-dmode-' + currentDemandaDateMode));
  guardarPreferenciasDemandas();
  pintarFiltroCarteira();
  // A moldura da tela (numeros do topo, filtro de equipe, lista de dias) era
  // pintada SO por refreshDemandas. E o switchBoard so chama refreshDemandas
  // quando ainda nao ha dados:
  //
  //     if (DADOS_DEMANDAS.length === 0) refreshDemandas(); else renderDemandas();
  //
  // Como o Modo Gestor carrega as solicitacoes por conta propria
  // (ensureDemandasForOperationalViews), quem passa por ele antes de abrir
  // Demandas chega com os dados prontos — e cai no ramo que nao pinta a
  // moldura. Resultado: a tela abria com o topo vazio e "Equipe" so com o botao
  // Todos, exatamente como se estivesse quebrada. Agora a moldura mora aqui,
  // junto do resto do desenho: qualquer caminho que chegue nesta tela a pinta.
  pintarTiposDeDemanda();
  pintarClientesDeDemandas();
  pintarAvisoDeAprovacoes();
  buildDemandaPersonFilter();
  populateDemandaDaySelect();
  renderDemandaKPIs();
  if (typeof renderVisaoDeGrupos === 'function') renderVisaoDeGrupos('demandas');
  if (typeof renderAgendaDeDemandas === 'function') renderAgendaDeDemandas();
  const fi = filtrarDemandasBase();
  pintarResumoDeFiltros(fi.length);
  document.querySelectorAll('.dem-filtro-popover input[type="search"]').forEach(input => { if (input.value) input.dispatchEvent(new Event('input')); });
  // Atualizar título da semana
  const titleEl = document.getElementById('title-demanda-semana');
  if (titleEl) {
    if (currentDemandaWeek === 1) titleEl.textContent = `Semana 1 — ${META.week1_start} a ${META.week1_end}`;
    else if (currentDemandaWeek === 2) titleEl.textContent = `Semana 2 — ${META.week2_start} a ${META.week2_end}`;
  }
  // Mostrar/ocultar painéis
  const tabelaOuAgenda = gruposDeDemandasAberto || agendaDeDemandasAberta;
  const showEsteira = !tabelaOuAgenda && currentDemandaWeek === 0;
  const showDia     = !tabelaOuAgenda && !showEsteira && currentDemandaViewDay;
  const showSemana  = !tabelaOuAgenda && !showEsteira && !currentDemandaViewDay;
  document.getElementById('panel-demandas-semana').style.display  = showSemana  ? '' : 'none';
  document.getElementById('panel-demandas-dia').style.display     = showDia     ? '' : 'none';
  document.getElementById('panel-demandas-esteira').style.display = showEsteira ? '' : 'none';
  if (showEsteira)  renderDemandasEsteira(fi);
  else if (showDia) renderDemandasDia(fi);
  else              renderDemandasSemana(fi);
  // No mundo, a tela é a do quadro do padrão v2 (pv2dPintar, no fim deste arquivo).
  if (typeof pv2dPintar === 'function') pv2dPintar();
}

// View: Por Semana (cards de cliente)
function renderDemandasSemana(fi) {
  const clientes = [...new Set(fi.flatMap(clientesDoItem))].sort();
  const grid = document.getElementById('grid-demandas-semana');
  if (clientes.length === 0) {
    const porConclusao = currentDemandaDateMode !== 'prazo';
    const outroModo = porConclusao ? 'prazo' : 'conclusao';
    const quantasNoOutro = DADOS_DEMANDAS.filter(d => {
      const iso = outroModo === 'prazo' ? (d.prazo_iso || '') : (d.conclusao_iso || '');
      const ini = currentDemandaWeek === 2 ? META.week2_start_iso : META.week1_start_iso;
      const fim = currentDemandaWeek === 2 ? META.week2_end_iso : META.week1_end_iso;
      return iso >= ini && iso <= fim;
    }).length;
    const semData = DADOS_DEMANDAS.filter(d => !getDemandaDateIso(d)).length;
    grid.innerHTML = `<div class="demandas-vazio">
      <b>Nenhuma demanda ${porConclusao ? 'concluída' : 'com prazo'} nesta semana.</b>
      <span>São ${DADOS_DEMANDAS.length} no quadro; a semana filtra pela data de
        ${porConclusao ? 'conclusão' : 'prazo'}${semData ? `, e ${semData} ainda não têm essa data` : ''}.</span>
      <div class="demandas-vazio-acoes">
        ${quantasNoOutro
          ? `<button type="button" class="sort-btn" onclick="setDemandaDateMode('${outroModo}')">
               Ver por ${porConclusao ? 'prazo' : 'conclusão'} — ${quantasNoOutro} nesta semana</button>`
          : ''}
        <button type="button" class="sort-btn" onclick="if(!gruposDeDemandasAberto) alternarGruposDeDemandas()">
          Ver as ${DADOS_DEMANDAS.length} por grupo</button>

      </div>
    </div>`;
    return;
  }
  grid.innerHTML = clientes.map(cli => {
    let items = sortDemandas(fi.filter(d => itemTemCliente(d, cli)));
    if (currentDemandaDayFilter) items = items.filter(d => getDemandaDateIso(d) === currentDemandaDayFilter);
    if (items.length === 0) return '';
    const atrasadas = items.filter(d=>d.prazo_atrasado).length;
    const alertCls = atrasadas > 0 ? 'alert-low' : 'alert-ok';
    return `<div class="demanda-group-card ${alertCls}">
      <div class="demanda-group-header">
        <div class="demanda-group-title">${cli}</div>
        <span class="posts-count ok">${items.length} demanda${items.length!==1?'s':''}</span>
      </div>
      <div class="item-list">${items.map(d => demandaItemRow(d, false)).join('')}</div>
    </div>`;
  }).join('');
}

// View: Por Dia (dentro da semana selecionada)
function renderDemandasDia(fi) {
  let items = fi;
  if (currentDemandaDayFilter) items = fi.filter(d => getDemandaDateIso(d) === currentDemandaDayFilter);
  const byDay = {};
  items.forEach(d => {
    const iso = getDemandaDateIso(d);
    if (!iso) return;
    if (!byDay[iso]) byDay[iso] = [];
    byDay[iso].push(d);
  });
  const DIAS_LABEL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const grid = document.getElementById('grid-demandas-dia');
  const sortedDays = Object.keys(byDay).sort();
  let html = sortedDays.map(iso => {
    const dt = new Date(iso+'T12:00:00');
    const dow = DIAS_LABEL[dt.getDay()];
    const fmt = `${iso.slice(8,10)}/${iso.slice(5,7)}`;
    const isHoje = iso === META.today_iso;
    const dayItems = sortDemandas(byDay[iso]);
    return `<div style="margin-bottom:18px;">
      <div class="section-title" style="margin-bottom:8px;">
        <span></span>${dow} ${fmt}${isHoje?' <span style="color:var(--accent2);font-size:11px;">(Hoje)</span>':''}
        <span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:8px;">${dayItems.length} demanda${dayItems.length!==1?'s':''}</span>
      </div>
      <div class="demandas-grid">${dayItems.map(d => `<div class="demanda-group-card"><div class="item-list">${demandaItemRow(d,true)}</div></div>`).join('')}</div>
    </div>`;
  }).join('');
  grid.innerHTML = html || '<div style="color:var(--text-muted);padding:20px 0;">Nenhuma demanda com data neste período.</div>';
}

// TRECENTOS E TREZE CARTOES NUMA COLUNA SO.
//
// "Concluidas" guarda tudo o que ja foi entregue, e a coluna desenhava os 313 de
// uma vez. Ninguem rola trezentos cartoes de coisa pronta — o que se faz ali e
// conferir os ultimos e seguir. Cada coluna mostra os primeiros e oferece o
// resto num clique; o numero no cabecalho continua sendo o total de verdade,
// entao nada fica escondido sem ser dito.
const TETO_DA_COLUNA = 25;
let COLUNAS_ABERTAS = new Set();
function mostraTudoNaColuna(grupo) { return COLUNAS_ABERTAS.has(String(grupo)); }
function verTudoNaColuna(grupo) {
  COLUNAS_ABERTAS.add(String(grupo));
  renderDemandas();
}

// View: Por Esteira (tab 0)
function renderDemandasEsteira(fi) {
  const grid = document.getElementById('grid-demandas-esteira');
  grid.innerHTML = DEMANDAS_GROUP_ORDER.map(grupo => {
    const items = sortDemandas(fi.filter(d => d.grupo === grupo));
    const icon = DEMANDAS_GROUP_ICON[grupo] || '';
    // Coluna vazia CONTINUA na tela. Sumir com ela reordena o quadro a cada
    // filtro, e quem procurava uma etapa fica sem saber se ela nao tem nada ou
    // se ele e que errou o filtro.
    return `<div class="demanda-group-card">
      <div class="demanda-group-header">
        <div class="demanda-group-title">${icon} ${grupo}</div>
        <span class="posts-count ${items.length ? 'ok' : ''}">${items.length}</span>
      </div>
      <div class="item-list">${items.length
        ? items.slice(0, mostraTudoNaColuna(grupo) ? items.length : TETO_DA_COLUNA)
            .map(d => demandaItemRow(d, true)).join('')
          + (items.length > TETO_DA_COLUNA && !mostraTudoNaColuna(grupo)
            ? `<button type="button" class="demanda-ver-mais" onclick="verTudoNaColuna('${
                String(grupo).replace(/'/g, "\\'")}')">Ver as outras ${items.length - TETO_DA_COLUNA}</button>`
            : '')
        : '<div class="demanda-group-vazia">Nada nesta etapa agora.</div>'}</div>
    </div>`;
  }).join('');
}


// Pesquisa somente as opções do seletor; não altera o recorte operacional.
function pesquisarOpcoesDemanda(input, id) {
  const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const termo = normalizar(input.value);
  const lista = document.getElementById(id);
  if (!lista) return;
  let encontrados = 0;
  [...lista.children].forEach(el => {
    const mostrar = normalizar(el.textContent + ' ' + (el.title || '')).includes(termo);
    el.hidden = !mostrar;
    if (mostrar) encontrados++;
  });
  let vazio = input.parentElement.querySelector('.dem-opcoes-vazias');
  if (!vazio) { vazio = document.createElement('p'); vazio.className = 'dem-opcoes-vazias'; vazio.setAttribute('role','status'); input.after(vazio); }
  vazio.textContent = encontrados ? '' : 'Nenhuma opção encontrada.';
}

// ─── Padrão v2 · Demandas pelo quadro DEPOIS do moodboard (12/11/2026) ───────────────────────
// A tela é o quadro, nesta ordem: título com Lista ou Calendário e Nova demanda; a fala do Heitor ao lado de dois
// números (Atrasadas e Sem responsável); a busca, as quatro fichas (Atrasadas, Minha fila, Sem responsável, Todas),
// Filtros e Colunas; e um cartão só com os grupos, onde a linha abre no lugar com as etapas, quem faz e o prazo.
// Só vale no mundo; no tema antigo fica a tela de sempre. O que era da tela antiga segue respondendo pelos mesmos ids:
// cabeçalho, busca antiga, visões, a tabela por grupo e as vistas de semana, dia e esteira vão para
// #pv2-demandas-reserva (escondida); os filtros (Responsável geral, Status, Tipo, Cliente, Responsável, Conclusão ou
// Prazo, dia), o resumo do recorte, as visões Concluídas e Tudo e a ordenação passam para dentro de Filtros.
const PV2D_POR_GRUPO = 6;
const pv2dLinhasAbertas = new Set(), pv2dGruposInteiros = new Set();
let pv2dMostrarVazios = false;
let PV2D_ORDEM_VISIVEL = [];
const PV2D_VISOES = [['atrasadas', 'Atrasadas'], ['minha', 'Minha fila'], ['sem', 'Sem responsável'], ['abertas', 'Todas']];
function pv2dMontar() {
  if (typeof pv2Ligado !== 'function' || !pv2Ligado()) return null;
  let raiz = document.getElementById('pv2-demandas');
  if (raiz) return raiz;
  const casa = document.querySelector('#painel-demandas > .container'), controles = casa?.querySelector(':scope > .dem-controles');
  if (!casa || !controles) return null;
  raiz = document.createElement('div');
  raiz.id = 'pv2-demandas'; raiz.className = 'pv2 pv2-demandas';
  // Direção 3 (moodboard 3, 13/11/2026): título com a data, Lista ou Calendário e Nova demanda (branco); o bloco laranja
  // do Heitor; quatro números; a busca com as fichas, Filtros, Ordenar e Colunas; e a lista em colunas num cartão só.
  raiz.innerHTML = `<div class="pv2-topo"><h2>Demandas</h2><span class="d3p-data">${safeText(typeof d3pDataDeHoje === 'function' ? d3pDataDeHoje() : '')}</span>
      <span class="pv2-seg" id="pv2d-vistas" role="radiogroup" aria-label="Vista">
        <button type="button" role="radio" data-vista="lista" onclick="pv2dVista('lista')">Lista</button>
        <button type="button" role="radio" data-vista="calendario" onclick="pv2dVista('calendario')" title="Agenda mensal das demandas">Calendário</button>
      </span>
      <button type="button" class="pv2-btn d3p-novo" onclick="cadastrarNoGrupo('demandas','')">${typeof D3P_MAIS === 'string' ? D3P_MAIS : ''}Nova demanda</button></div>
    <div class="pv2-alto" id="pv2d-alto"></div>
    <div class="pv2-filtros" role="group" aria-label="Busca e filtros">
      <label class="pv2-oculto" for="pv2d-busca">Buscar cliente ou demanda</label>
      <input id="pv2d-busca" class="pv2-busca" type="search" autocomplete="off" placeholder="Buscar cliente ou demanda" oninput="buscarClienteDemandas(this.value)">
      <span class="pv2-fichas" id="pv2d-chips"></span>
      <details class="pv2-menu" id="pv2d-filtros-menu"><summary class="pv2-btn s" id="pv2d-filtros-rot">Filtros</summary>
        <div class="pv2-pop pv2-pop-filtros" id="pv2d-filtros-pop"><div class="pv2-pop-linha" id="pv2d-visoes"></div><span class="pv2-pop-rot">Recorte</span></div></details>
      <details class="pv2-menu" id="pv2d-ordenar"><summary class="pv2-btn s" title="Ordenar a lista"><span class="d3d-rot">Ordenar</span><b id="pv2d-ordem-rot"></b></summary>
        <div class="pv2-pop"><span class="pv2-pop-rot">Ordenar por</span><div class="pv2-pop-linha" id="pv2d-ordem"></div></div></details>
      <details class="pv2-menu" id="pv2d-colunas"><summary class="pv2-btn s">Colunas</summary>
        <div class="pv2-pop"><label class="pv2-lote"><input type="checkbox" data-coluna="dem-coluna-id" onchange="pv2dColuna(this)"> Mostrar ID</label><label class="pv2-lote"><input type="checkbox" data-coluna="dem-coluna-cadastro" onchange="pv2dColuna(this)"> Mostrar cadastro e criação</label></div></details>
    </div>
    <section class="pv2-card pv2-lista" id="pv2d-lista" aria-label="Demandas por grupo"></section>`;
  casa.prepend(raiz);
  const reserva = document.createElement('div');
  reserva.id = 'pv2-demandas-reserva'; reserva.hidden = true;
  casa.append(reserva);
  const pop = raiz.querySelector('#pv2d-filtros-pop');
  const resumo = document.getElementById('demanda-resumo'), kpis = document.getElementById('kpi-grid-demandas');
  if (resumo) pop.prepend(resumo);
  if (kpis) pop.append(kpis);
  pop.append(controles);
  [casa.querySelector(':scope > .pv-cabeca'), casa.querySelector(':scope > .quadro-toolbar'), document.getElementById('dem-visoes'), document.getElementById('grupos-board-demandas'),
    document.getElementById('panel-demandas-semana'), document.getElementById('panel-demandas-dia'), document.getElementById('panel-demandas-esteira')].forEach((el) => { if (el) reserva.append(el); });
  casa.classList.add('pv2-casa');
  return raiz;
}
function pv2dVista(vista) {
  // 8 · Troca de visão: a peça voa da linha da lista para o dia do calendário (e volta), pelo data-vt="peca-<id>".
  if ((vista === 'calendario') !== Boolean(agendaDeDemandasAberta)) { if (typeof vbTransicao === 'function') vbTransicao(() => alternarAgendaDeDemandas(), { raiz: '#painel-demandas', tipo: 'visao' }); else alternarAgendaDeDemandas(); }
  else pv2dPintar();
}
function pv2dColuna(caixa) {
  const antiga = document.getElementById(caixa.dataset.coluna); if (!antiga) return;
  antiga.checked = caixa.checked;
  antiga.dispatchEvent(new Event('change', { bubbles: true }));
}
function pv2dAlternarLinha(id, el) {
  const linha = el.closest('.pv2-linha'); if (!linha) return;
  const abrir = linha.getAttribute('aria-expanded') !== 'true';
  if (abrir) pv2dLinhasAbertas.add(String(id)); else pv2dLinhasAbertas.delete(String(id));
  linha.setAttribute('aria-expanded', String(abrir));
  el.setAttribute('aria-expanded', String(abrir));
}
function pv2dGrupoInteiro(id) { if (pv2dGruposInteiros.has(id)) pv2dGruposInteiros.delete(id); else pv2dGruposInteiros.add(id); pv2dPintar(); }
function pv2dVazios() { pv2dMostrarVazios = !pv2dMostrarVazios; pv2dPintar(); }
function pv2dOrdenar(campo) { ordenarPor(campo); pv2dPintar(); }
function pv2dDiasDeAtraso(iso, hoje) { return Math.max(1, Math.round((Date.parse(hoje + 'T12:00:00Z') - Date.parse(iso + 'T12:00:00Z')) / 864e5)); }
// Direção 3: o prazo é a data em texto; vermelho só no que venceu (com os dias de atraso na dica), âmbar no de hoje.
function pv2dPrazoHtml(d, hoje) {
  if (DEMANDA_CONCLUIDA.includes(d.status)) return pv2Pill('feita', 'g');
  if (!d.prazo_iso) return '<span class="d3d-data vazio">sem prazo</span>';
  if (hoje && d.prazo_iso < hoje) { const n = pv2dDiasDeAtraso(d.prazo_iso, hoje); return `<span class="d3d-data r" title="${n} ${n === 1 ? 'dia' : 'dias'} de atraso">${pv2DiaMes(d.prazo_iso)}</span>`; }
  if (d.prazo_iso === hoje) return '<span class="d3d-data a" title="Prazo hoje">hoje</span>';
  return `<span class="d3d-data" title="Prazo">${pv2DiaMes(d.prazo_iso)}</span>`;
}
function pv2dLinhaHtml(d, hoje) {
  const id = safeText(d.id), aberta = pv2dLinhasAbertas.has(String(d.id)), clientes = clientesDoItem(d);
  const marcada = typeof SELECIONADAS !== 'undefined' && SELECIONADAS.has(String(d.id));
  const donos = ownerUsersFor(d), semDono = pv2SemDono(d), atrasada = demandaAtrasada(d), feita = DEMANDA_CONCLUIDA.includes(d.status);
  const nomes = donos.length ? donos.map((u) => firstName(u.name)) : String(d.responsavel || '').replace('—', '').split(',').map((n) => firstName(n.trim())).filter((n) => n && n !== '—');
  const conclusao = d.conclusao_iso || (isRequestItem(d) ? '' : d.veiculacao_iso) || '';
  const frase = [semDono ? 'Ninguém pegou ainda' : `<b>${safeText(nomes.join(', '))}</b> ${nomes.length > 1 ? 'fazem' : 'faz'}`,
    d.prazo_iso ? `prazo ${atrasada ? 'era' : feita ? 'foi' : 'é'} ${pv2DiaMes(d.prazo_iso)}` : 'sem prazo', conclusao ? `conclusão prevista para ${pv2DiaMes(conclusao)}` : '',
    Number(d.tarefas) ? `${Number(d.tarefas_feitas || 0)} de ${Number(d.tarefas)} tarefas feitas` : ''].filter(Boolean).join(' · ');
  const tipo = String(d.tipo || d.formato || '').trim(), selos = [tipo && tipo !== '—' ? pv2Pill(tipo, 'n') : '', d.prioridade ? pv2Pill('Prioridade ' + String(d.prioridade).toLocaleLowerCase('pt-BR'), /alta|urgent|crít/i.test(d.prioridade) ? 'r' : 'n') : ''].join('');
  const cadastro = [d.cadastrado_por ? `cadastrada por ${safeText(firstName(d.cadastrado_por))}` : '', d.criado_em ? `criada em ${pv2DiaMes(String(d.criado_em).slice(0, 10))}` : ''].filter(Boolean).join(' · ');
  // Direção 3: a linha em colunas, como no quadro: Tipo, Demanda, Cliente, Status (o menu de sempre), Prazo (toca e
  // muda no lugar), Conclusão, Responsável, Tarefas e a seta; o resto abre no lugar.
  const nTar = Number(d.tarefas) || 0, nFeitas = Number(d.tarefas_feitas) || 0;
  return `<div class="pv2-linha v2-abre${marcada ? ' marcada' : ''}${pv2Chegou(d)}" data-linha="${id}" data-vt="peca-${id}" aria-expanded="${aberta}">
    <div class="pv2-lin d3d-lin" role="button" tabindex="0" aria-expanded="${aberta}" title="Abrir no lugar" onclick="pv2dAlternarLinha('${id}',this)" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();pv2dAlternarLinha('${id}',this)}">
      <span class="d3d-tipo">${tipo && tipo !== '—' ? safeText(tipo) : ''}</span>
      <p class="pv2-nome">${safeText(d.nome || '')}<small class="pv2-id">#${id}</small></p>
      <span class="d3d-cli">${clientes[0] ? pv2Cli(clientes[0]) : '<span class="d3d-data vazio">sem cliente</span>'}${clientes.length > 1 ? `<small title="${safeText(clientes.join(', '))}"> +${clientes.length - 1}</small>` : ''}</span>
      <span class="pv2-cs">${pv2StatusBotao(d)}</span><span class="pv2-cp"${feita ? '' : ` data-editar-data="prazo" data-peca="${id}" title="Tocar para mudar o prazo"`}>${pv2dPrazoHtml(d, hoje)}</span>
      <span class="d3d-conc">${conclusao ? `<span class="d3d-data">${pv2DiaMes(conclusao)}</span>` : ''}</span>
      <span class="pv2-cr">${pv2Av(d, { comNome: true })}</span>
      <span class="d3d-tar${nTar && nFeitas >= nTar ? ' ok' : ''}" title="${nTar ? `${nFeitas} de ${nTar} tarefas feitas` : 'Sem tarefas'}">${nTar ? `${nFeitas}/${nTar}` : '0'}</span>
      <i class="pv2-seta" aria-hidden="true">${PV2_IC.depois}</i></div>
    <div class="v2-mais"><div><div class="pv2-det">${pv2EtapasHtml(d)}
      <div class="pv2-det-linha"><p>${frase}${cadastro ? `<span class="pv2-cadastro"> · ${cadastro}</span>` : ''}</p>${selos}
        <label class="pv2-lote" title="Marcar para ação em lote"><input type="checkbox" ${marcada ? 'checked' : ''} aria-label="Marcar ${safeText(d.nome || '')}" onclick="alternarSelecao('${id}',this.checked,event,PV2D_ORDEM_VISIVEL)">Marcar</label>
        <button type="button" class="pv2-btn s" onclick="openOwnerEditor(event,'${id}')">${semDono ? 'Escolher responsável' : 'Trocar responsável'}</button>
        <button type="button" class="pv2-btn s k" onclick="openItemWorkspace('${id}')">Abrir a peça</button></div>
    </div></div></div></div>`;
}
function pv2dPintar() {
  const raiz = pv2dMontar(); if (!raiz) return;
  const hoje = META.today_iso || '', pl = (n, um, varios) => (n === 1 ? um : varios);
  const todas = (DADOS_DEMANDAS || []).filter(itemNaCarteira), abertas = todas.filter((d) => !DEMANDA_CONCLUIDA.includes(d.status));
  const atrasadas = abertas.filter(demandaAtrasada), sem = abertas.filter((d) => pertenceVisaoDemanda(d, 'sem'));
  const semDeHoje = sem.filter((d) => hoje && String(d.criado_em || '').slice(0, 10) === hoje).length;
  // Direção 3: a frase curta do Heitor no bloco laranja (o que venceu, o que está sem dono e o que vence hoje) e o botão
  // do que pede ação; embaixo, quatro números com a mini linha onde há série de verdade.
  const venceHoje = abertas.filter((d) => hoje && d.prazo_iso === hoje), entregueHoje = todas.filter((d) => hoje && d.prazo_iso === hoje && DEMANDA_CONCLUIDA.includes(d.status)).length;
  const partes = [];
  if (!abertas.length) partes.push('Nenhuma demanda em aberto.');
  else {
    const ruins = [atrasadas.length ? `${atrasadas.length} ${pl(atrasadas.length, 'atrasada', 'atrasadas')}` : '', sem.length ? `${sem.length} sem dono` : ''].filter(Boolean);
    partes.push(ruins.length ? `${ruins.join(' e ')}.` : 'Nada atrasado e tudo com dono.');
    if (venceHoje.length === 1) { const v = venceHoje[0], tipo = String(v.tipo || '').trim(), cli = clientesDoItem(v)[0] || ''; partes.push(`${safeText([tipo && tipo !== '—' ? tipo : 'Demanda', cli].filter(Boolean).join(' '))} vence hoje.`); }
    else if (venceHoje.length > 1) partes.push(`${venceHoje.length} vencem hoje.`);
  }
  const [botao, attrs] = atrasadas.length ? [atrasadas.length === 1 ? 'Ver a atrasada' : `Ver as ${atrasadas.length}`, `onclick="escolherVisaoDemanda('atrasadas')"`]
    : sem.length ? [`Distribuir ${sem.length === 1 ? 'a 1' : 'as ' + sem.length}`, `onclick="escolherVisaoDemanda('sem')" title="Ver as sem responsável para escolher quem faz"`] : ['', ''];
  const dia = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const semana = hoje ? [-6, -5, -4, -3, -2, -1, 0].map((n) => dia(hoje, n)) : [];
  const entraram = semana.map((iso) => todas.filter((d) => String(d.criado_em || '').slice(0, 10) === iso).length), novas = entraram.reduce((a, b) => a + b, 0);
  const proximos = hoje ? [0, 1, 2, 3, 4, 5, 6].map((n) => abertas.filter((d) => d.prazo_iso === dia(hoje, n)).length) : null;
  const maisAntiga = atrasadas.reduce((m, d) => (d.prazo_iso && (!m || d.prazo_iso < m) ? d.prazo_iso : m), '');
  const kpi = (rotulo, valor, o = {}) => (typeof d3pNum === 'function' ? d3pNum({ rotulo, valor, ...o }) : `<div class="pv2-card pv2-kpi"><small>${rotulo}</small><b>${valor}</b></div>`);
  pv2Trocar(document.getElementById('pv2d-alto'), (typeof d3pAcao === 'function' ? d3pAcao({ agente: 'H', quem: 'Heitor · Coordenação', frase: partes.join(' '), botao, attrs }) : '')
    + `<div class="d3p-nums quatro">${kpi('Abertas', abertas.length, { serie: novas ? entraram : null, serieRotulo: 'Entradas por dia na semana', sub: novas ? `+${novas} na semana` : 'em aberto', acao: "escolherVisaoDemanda('abertas')" })}
    ${kpi('Vencem hoje', venceHoje.length, { tom: venceHoje.length ? 'a' : '', serie: proximos && proximos.some(Boolean) ? proximos : null, serieRotulo: 'Prazos nos próximos 7 dias', sub: entregueHoje ? `${entregueHoje} já ${pl(entregueHoje, 'entregue', 'entregues')}` : 'nenhuma entregue' })}
    ${kpi('Atrasadas', atrasadas.length, { tom: atrasadas.length ? 'r' : '', sub: maisAntiga ? `a mais antiga · ${pv2dDiasDeAtraso(maisAntiga, hoje)} ${pv2dDiasDeAtraso(maisAntiga, hoje) === 1 ? 'dia' : 'dias'}` : 'nada vencido', subTom: maisAntiga ? 'r' : '', acao: "escolherVisaoDemanda('atrasadas')" })}
    ${kpi('Sem responsável', sem.length, { de: abertas.length, barra: abertas.length ? (sem.length * 100) / abertas.length : 0, dica: semDeHoje ? `${semDeHoje} ${pl(semDeHoje, 'entrou', 'entraram')} hoje` : sem.length ? 'esperando alguém pegar' : 'todas têm dono', acao: "escolherVisaoDemanda('sem')" })}</div>`);
  // fichas e Filtros
  const conta = (v) => todas.filter((d) => pertenceVisaoDemanda(d, v)).length;
  pv2Trocar(document.getElementById('pv2d-chips'), PV2D_VISOES.map(([id, nome]) => `<button type="button" class="pv2-chip" aria-pressed="${visaoRapidaDemandas === id}" onclick="escolherVisaoDemanda('${id}')">${nome} <b>${conta(id)}</b></button>`).join(''));
  pv2Trocar(document.getElementById('pv2d-visoes'), [['concluidas', 'Concluídas'], ['todas', 'Tudo, com as concluídas']].map(([id, nome]) => `<button type="button" class="pv2-chip" aria-pressed="${visaoRapidaDemandas === id}" onclick="escolherVisaoDemanda('${id}')">${nome} <b>${conta(id)}</b></button>`).join(''));
  const campos = (typeof COLUNAS_DA_TABELA !== 'undefined' && COLUNAS_DA_TABELA.demandas || []).filter((c) => typeof CAMPOS_ORDENAVEIS !== 'undefined' && CAMPOS_ORDENAVEIS[c]);
  pv2Trocar(document.getElementById('pv2d-ordem'), campos.map((c) => { const cfg = CAMPOS_ORDENAVEIS[c], ativa = ORDEM.campo === c;
    return `<button type="button" class="pv2-chip" aria-pressed="${ativa}" onclick="pv2dOrdenar('${c}')" title="Ordenar por ${safeText(cfg.rotuloDemandas || cfg.rotulo)}">${safeText(cfg.rotuloDemandas || cfg.rotulo)}${ativa ? (ORDEM.desc ? ' ↓' : ' ↑') : ''}</button>`; }).join(''));
  const ordemRot = document.getElementById('pv2d-ordem-rot'), campoAtivo = campos.includes(ORDEM.campo) ? CAMPOS_ORDENAVEIS[ORDEM.campo] : null;
  if (ordemRot) ordemRot.textContent = campoAtivo ? `${campoAtivo.rotuloDemandas || campoAtivo.rotulo}${ORDEM.desc ? ' ↓' : ''}` : 'Padrão';
  const recortado = filtroCarteira !== 'all' || Boolean(buscaClienteDemandas.trim()) || currentDemandaAtrasadas || currentDemandaStatusFilter !== 'all' || currentDemandaTipoFilter !== 'all' || currentDemandaPersonFilter !== 'all' || Boolean(currentDemandaDayFilter) || ['concluidas', 'todas'].includes(visaoRapidaDemandas);
  document.getElementById('pv2d-filtros-rot')?.classList.toggle('tem', recortado);
  const busca = document.getElementById('pv2d-busca');
  if (busca && document.activeElement !== busca && busca.value !== buscaClienteDemandas) busca.value = buscaClienteDemandas;
  raiz.querySelectorAll('#pv2d-colunas [data-coluna]').forEach((c) => { c.checked = Boolean(document.getElementById(c.dataset.coluna)?.checked); });
  const calendario = Boolean(agendaDeDemandasAberta);
  raiz.querySelectorAll('#pv2d-vistas [data-vista]').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.vista === 'calendario') === calendario)));
  // a lista: um cartão só, com os grupos e a linha que abre no lugar
  const lista = document.getElementById('pv2d-lista');
  lista.hidden = calendario;
  if (calendario) return;
  if (typeof garantirGruposDoPainel === 'function') garantirGruposDoPainel();
  const grupos = itensPorGrupo(filtrarDemandasBase().map(normalizeRequestForOperational), GRUPOS_DE_DEMANDAS);
  const abertasPorGrupo = new Map(); abertas.forEach((d) => abertasPorGrupo.set(String(d.group_id || ''), (abertasPorGrupo.get(String(d.group_id || '')) || 0) + 1));
  const ordemVisivel = [], vazios = grupos.filter((g) => !g.itens.length), comItens = grupos.filter((g) => g.itens.length);
  const blocoDoGrupo = (g) => {
    const inteiro = pv2dGruposInteiros.has(g.id), aVista = inteiro ? g.itens : g.itens.slice(0, PV2D_POR_GRUPO), resto = g.itens.length - aVista.length;
    aVista.forEach((d) => ordemVisivel.push(String(d.id)));
    const atras = g.itens.filter(demandaAtrasada).length, doGrupo = abertasPorGrupo.get(String(g.id)) || g.itens.length;
    const conta = atras ? `${atras} ${pl(atras, 'atrasada', 'atrasadas')} de ${Math.max(doGrupo, g.itens.length)}` : `${g.itens.length} ${pl(g.itens.length, 'demanda', 'demandas')}`;
    return `<div class="pv2-grupo" data-grupo="${safeText(g.id)}"><div class="pv2-grp"><i style="background:${safeText(corDeQualquerGrupo(g.id))}" aria-hidden="true"></i><h3>${safeText(g.nome)}</h3><span class="pv2-sub">${g.itens.length ? conta : 'nada neste filtro'}</span>
        ${typeof botaoDoMenuDoGrupo === 'function' ? botaoDoMenuDoGrupo('demandas', g.id, g.nome) : ''}<button type="button" class="pv2-btn s d3d-nova" onclick="cadastrarNoGrupo('demandas','${safeText(g.id)}')" aria-label="Nova demanda em ${safeText(g.nome)}">+ Nova aqui</button></div>
      ${aVista.map((d) => pv2dLinhaHtml(d, hoje)).join('')}
      ${resto > 0 ? `<button type="button" class="d3p-mais" onclick="pv2dGrupoInteiro('${safeText(g.id)}')" aria-label="Ver todas as ${g.itens.length} de ${safeText(g.nome)}" title="+ ${resto} neste grupo · ver todas">+${resto}</button>` : inteiro && g.itens.length > PV2D_POR_GRUPO ? `<button type="button" class="d3p-mais" onclick="pv2dGrupoInteiro('${safeText(g.id)}')">Mostrar menos</button>` : ''}</div>`;
  };
  const nomesVazios = vazios.slice(0, 1).map((g) => g.nome).join('') + (vazios.length > 1 ? ` e mais ${vazios.length - 1}` : '');
  const peVazios = vazios.length ? `<p class="pv2-sub pv2-pe-geral">${vazios.length} ${pl(vazios.length, 'grupo sem nada neste filtro', 'grupos sem nada neste filtro')} (${safeText(nomesVazios)}) ${pl(vazios.length, 'fica recolhido', 'ficam recolhidos')} · <button type="button" class="pv2-link" onclick="pv2dVazios()">${pv2dMostrarVazios ? 'recolher' : 'mostrar'}</button></p>` : '';
  const semNada = !comItens.length ? `<p class="pv2-sub pv2-nada">${(DADOS_DEMANDAS || []).length ? 'Nenhuma demanda neste filtro.' : 'Nenhuma demanda carregada ainda.'} ${recortado || visaoRapidaDemandas !== 'abertas' ? '<button type="button" class="pv2-link" onclick="clearDemandaFilters();escolherVisaoDemanda(\'abertas\')">Ver todas em aberto</button>' : '<button type="button" class="pv2-link" onclick="cadastrarNoGrupo(\'demandas\',\'\')">Criar a primeira</button>'}</p>` : '';
  const cab = comItens.length ? '<div class="d3d-cab" aria-hidden="true"><span>Tipo</span><span>Demanda</span><span>Cliente</span><span>Status</span><span>Prazo</span><span>Conclusão</span><span>Responsável</span><span>Tarefas</span><span></span></div>' : '';
  lista.innerHTML = cab + comItens.map(blocoDoGrupo).join('') + semNada + (pv2dMostrarVazios ? vazios.map(blocoDoGrupo).join('') : '') + peVazios
    + (typeof botaoNovoGrupoNoFim === 'function' && pv2dMostrarVazios ? botaoNovoGrupoNoFim('demandas') : '');
  PV2D_ORDEM_VISIVEL = ordemVisivel;
}
try { pv2dMontar(); } catch { /* a tela antiga segue valendo */ }

// ─── Padrão v2 · IA e custos pelo quadro D3-IaCustos (Direção 3, 13/11/2026) ─────────────────────
// A tela é o quadro, nesta ordem: título com o selo "só donos", o período (7, 30, 90 dias), Atualizar e Definir teto;
// o bloco de ação do Alex (frase curta e um botão); quatro números (gasto no período, como o mês fecha, pedidos e teto);
// e três colunas: "Pede ação" com o gasto por dia em linha, "Com quem" e "Em quê". Os números vêm de /api/ia-custos.
// A API devolve o gasto por pessoa e por modelo: "Em quê" mostra os modelos, que é o recorte que existe.
// As peças d3AcaoHtml, d3NumHtml e d3LinhaSvg são da base (vybe-core.js; CSS em padrao-v2/0-d3-base.css).
const PV2I_SELO = '<span class="d3-selo-donos"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>só donos</span>';
function pv2iTopoHtml() {
  return `<div class="pv2-topo"><div class="d3f-tit"><h2>IA e custos</h2><span class="d3f-data">Gestão</span>${PV2I_SELO}</div>
    <span class="pv2-seg ia-periodos" role="radiogroup" aria-label="Período">${[7, 30, 90].map((d) => `<button type="button" role="radio" data-days="${d}" aria-checked="${aiUsageDays === d}" onclick="setAiUsageDays(${d},this)">${d} dias</button>`).join('')}</span>
    <button type="button" class="pv2-btn" onclick="loadAiUsage(true)">Atualizar</button>
    <button type="button" class="pv2-btn d3f-escuro" onclick="pv2iAbrirParametros(true)">Definir teto</button></div>`;
}
function pv2iAbrirParametros(focarTeto) {
  const d = document.getElementById('pv2i-parametros'); if (!d) return;
  d.open = true;
  d.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (focarTeto) setTimeout(() => document.getElementById('ai-budget-input')?.focus({ preventScroll: true }), 80);
}
// "Usar R$ 300": grava o teto sugerido pelo mesmo caminho de "Salvar" e o botão conta o estado.
async function pv2iUsarTeto(valor, botao) {
  const s = aiUsageData?.settings || {};
  if (botao) botao.dataset.estado = 'indo';
  try {
    const response = await fetch(AI_USAGE_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: aiUsageDays, monthly_budget_brl: aiNumber(valor), brl_per_usd: aiNumber(s.brl_per_usd) || 5.5, gemini_billing: s.gemini_billing }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || 'Não foi possível salvar.');
    if (botao) { botao.dataset.estado = 'feito'; botao.textContent = 'Definido'; }
    aiUsageData = result.dashboard;
    setTimeout(() => renderAiUsageBoard(aiUsageData), 900);
    if (typeof showToast === 'function') showToast(`Teto mensal definido em ${aiBrl(valor)}.`);
  } catch (error) {
    if (botao) delete botao.dataset.estado;
    if (typeof showToast === 'function') showToast(error.message || 'Falha ao salvar o teto.');
  }
}
// Número da Direção 3 com a linha de baixo (o que era legenda vira um dado curto).
function pv2iNum(o) {
  const h = d3NumHtml(o);
  return o.sub ? h.replace(/<\/(div|button)>$/, `<span class="d3f-sub">${o.sub}</span></$1>`) : h;
}
function pv2iRender(data) {
  const root = document.getElementById('ai-usage-root');
  if (!root || !data) return;
  const overview = data.overview || {}, month = data.month || {}, settings = data.settings || {};
  const providers = Array.isArray(data.providers) ? data.providers : [], daily = Array.isArray(data.daily) ? data.daily : [], people = Array.isArray(data.people) ? data.people : [];
  const dias = Number(data.period_days) || aiUsageDays, pedidos = aiNumber(overview.calls), gasto = aiNumber(overview.cost_brl);
  const noMes = aiNumber(month.cost_brl), pedidosDoMes = aiNumber(month.calls), teto = aiNumber(settings.monthly_budget_brl);
  const usado = teto > 0 ? (noMes / teto) * 100 : 0;
  const n0 = (v) => aiNumber(v).toLocaleString('pt-BR'), pl = (n, um, varios) => (n === 1 ? um : varios);
  const redondo = (v) => 'R$ ' + Math.round(aiNumber(v)).toLocaleString('pt-BR');
  // o mês no ritmo de hoje, e o teto sugerido (40% de folga, arredondado para cima de 50 em 50)
  const agora = new Date(), diaDoMes = agora.getDate(), diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const previsto = noMes > 0 ? (noMes / diaDoMes) * diasNoMes : 0;
  const sugerido = previsto > 0 ? Math.max(50, Math.ceil((previsto * 1.4) / 50) * 50) : 0;
  const nomeDoMes = agora.toLocaleDateString('pt-BR', { month: 'long' }), Mes = nomeDoMes.charAt(0).toUpperCase() + nomeDoMes.slice(1);
  // gasto por dia, com os dias sem pedido
  const porDia = new Map(daily.map((row) => [String(row.day || ''), row])), lista = [];
  for (let i = dias - 1; i >= 0; i -= 1) { const chave = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), row = porDia.get(chave) || {}; lista.push({ chave, custo: aiNumber(row.cost_brl), pedidos: aiNumber(row.calls) }); }
  const pico = lista.reduce((a, b) => (b.custo > a.custo ? b : a), lista[0]), media = lista.length ? lista.reduce((s, d) => s + d.custo, 0) / lista.length : 0;
  const dm = (chave) => `${chave.slice(8, 10)}/${chave.slice(5, 7)}`;
  // o mês acumulado dia a dia, para a mini linha de "como o mês fecha"
  const doMes = lista.filter((d) => d.chave.slice(0, 7) === agora.toISOString().slice(0, 7)), acumulado = [];
  doMes.reduce((s, d) => { acumulado.push(s + d.custo); return s + d.custo; }, 0);
  const semCusto = providers.filter((p) => aiNumber(p.cost_brl) === 0).reduce((s, p) => s + aiNumber(p.calls), 0), pctSemCusto = pedidos ? Math.round((semCusto / pedidos) * 100) : 0;
  // o bloco de ação do Alex: uma frase e um botão
  const acao = !pedidos ? { frase: `Nenhum pedido ao VYBES em ${dias} dias.`, botao: dias < 90 ? 'Ver 90 dias' : '', attrs: 'onclick="setAiUsageDays(90,this)"' }
    : teto <= 0 && sugerido ? { frase: `Sem teto mensal. Com ${redondo(sugerido)}, aviso antes de estourar.`, botao: `Usar ${redondo(sugerido)}`, attrs: `onclick="pv2iUsarTeto(${sugerido},this)"` }
    : teto <= 0 ? { frase: 'Sem teto mensal definido.', botao: 'Definir teto', attrs: 'onclick="pv2iAbrirParametros(true)"' }
    : usado >= 80 ? { frase: `${usado.toFixed(0)}% do teto usado; ${nomeDoMes} fecha perto de ${redondo(previsto)}.`, botao: 'Rever o teto', attrs: 'onclick="pv2iAbrirParametros(true)"' }
    : { frase: `${Mes} fecha perto de ${redondo(previsto)}, dentro do teto.`, botao: 'Ver a conta', attrs: 'onclick="pv2iAbrirParametros(false)"' };
  const blocoAcao = d3AcaoHtml({ frase: `<small class="d3f-quem">Alex · Análise e números</small>${acao.frase}`, agente: 'A', botao: acao.botao, attrs: acao.attrs });
  // Pede ação: só o que os números sustentam
  const pv2iAcoes = [];
  if (teto <= 0) pv2iAcoes.push({ pill: pv2Pill('Sem teto', 'a'), texto: '<b>Teto mensal</b> não definido',
    botao: sugerido ? `<button type="button" class="pv2-btn s d3f-escuro v2-estado" onclick="event.stopPropagation();pv2iUsarTeto(${sugerido},this)">Usar ${redondo(sugerido)}</button>` : `<button type="button" class="pv2-btn s" onclick="event.stopPropagation();pv2iAbrirParametros(true)">Definir</button>`,
    mais: [previsto > 0 ? `${nomeDoMes.slice(0, 3)} ~${redondo(previsto)}` : '', `${nomeDoMes.slice(0, 3)} até hoje ${aiBrl(noMes)}`, 'aviso em 80%', 'vermelho em 100%'].filter(Boolean) });
  else if (usado >= 80) pv2iAcoes.push({ pill: pv2Pill(`${usado.toFixed(0)}% do teto`, usado >= 100 ? 'r' : 'a'), texto: usado >= 100 ? `<b>Teto estourado</b> · ${aiBrl(noMes)} de ${aiBrl(teto)}` : `<b>Perto do teto</b> · ${aiBrl(noMes)} de ${aiBrl(teto)}`,
    botao: `<button type="button" class="pv2-btn s" onclick="event.stopPropagation();pv2iAbrirParametros(true)">Rever o teto</button>`, mais: [previsto > 0 ? `${nomeDoMes.slice(0, 3)} ~${redondo(previsto)}` : ''].filter(Boolean) });
  if (pedidos && gasto > 0 && pico.custo / gasto >= 0.2 && lista.filter((d) => d.custo > 0).length > 2) pv2iAcoes.push({ pill: pv2Pill(aiBrl(pico.custo), 'a'), texto: `<b>${dm(pico.chave)}</b> · ${Math.round((pico.custo / gasto) * 100)}% do gasto, ${n0(pico.pedidos)} ${pl(pico.pedidos, 'pedido', 'pedidos')}`, botao: '' });
  const topo = people[0], mediaPessoas = people.length > 1 ? people.slice(1).reduce((s, p) => s + aiNumber(p.cost_brl), 0) / (people.length - 1) : 0;
  if (topo && mediaPessoas > 0 && aiNumber(topo.cost_brl) >= mediaPessoas * 2) pv2iAcoes.push({ pill: pv2Pill(`${(aiNumber(topo.cost_brl) / mediaPessoas).toFixed(0)}× a média`, 'b'), texto: `<b>${safeText(topo.profile_name)}</b> · pedidos por pessoa`, botao: '' });
  const linhaAcao = (a, i) => `<div class="pv2-linha v2-abre" aria-expanded="${i === 0 && a.mais?.length ? 'true' : 'false'}"><div class="pv2-lin"${a.mais?.length ? ` role="button" tabindex="0" onclick="const l=this.parentElement;l.setAttribute('aria-expanded',String(l.getAttribute('aria-expanded')!=='true'))"` : ''}>${a.pill}<p>${a.texto}</p>${a.botao}</div>
      ${a.mais?.length ? `<div class="v2-mais"><div><div class="pv2i-mais">${a.mais.map((m) => `<span class="pv2i-ficha">${m}</span>`).join('')}</div></div></div>` : ''}</div>`;
  const pedeAcao = `<section class="pv2-card pv2i-acao" aria-label="Pede ação"><div class="pv2i-cab"><h3>Pede ação</h3><span class="pv2-sub">${pv2iAcoes.length ? `${pv2iAcoes.length}${pv2iAcoes.length > 1 ? ', na ordem' : ''}` : 'nada agora'}</span></div>
      ${pv2iAcoes.length ? pv2iAcoes.map(linhaAcao).join('') : `<p class="pv2-sub pv2-nada">${pedidos ? 'Nada pede ação: o gasto está dentro do teto.' : 'Sem uso no período.'}</p>`}</section>`;
  // Por dia: o gasto de cada dia em linha, com a média tracejada e o dia mais caro marcado
  const eixo = [0, 0.25, 0.5, 0.75, 1].map((f) => lista[Math.min(lista.length - 1, Math.round(f * (lista.length - 1)))]);
  const porDiaHtml = `<section class="pv2-card pv2i-dia" aria-label="Gasto por dia"><div class="pv2i-cab"><h3>Por dia</h3><span class="pv2-sub"><span class="d3f-leg"><i></i>gasto</span><span class="d3f-leg proj"><i></i>média ${aiBrl(media)}</span></span></div>
      ${pedidos ? `<div class="pv2i-graf">${d3LinhaSvg(lista.map((d) => d.custo), { meta: media, largura: 320, altura: 96, rotulo: `Gasto por dia de ${dm(lista[0].chave)} a ${dm(lista[lista.length - 1].chave)}${pico.custo > 0 ? `; o dia mais caro foi ${dm(pico.chave)}, com ${aiBrl(pico.custo)}` : ''}` })}${pico.custo > 0 ? `<span class="pv2i-pico">${dm(pico.chave)} · ${aiBrl(pico.custo)}</span>` : ''}</div>
      <div class="d3f-eixo">${eixo.map((d, i) => (i === eixo.length - 1 ? `<b>${dm(d.chave)}</b>` : `<span>${dm(d.chave)}</span>`)).join('')}</div>` : '<p class="pv2-sub pv2-nada">Sem gasto no período.</p>'}</section>`;
  // Com quem e Em quê
  const gx = (av, nome, sub, valor, max) => `<div class="pv2i-gx"><span class="pv2-av" aria-hidden="true">${safeText(av)}</span><span class="pv2i-nome" title="${safeText(nome + (sub ? ' · ' + sub : ''))}">${safeText(nome)}</span><span class="d3-barra" style="--v:${max > 0 ? Math.max(2, Math.round((aiNumber(valor) / max) * 100)) : 0}%"><i></i></span><b>${aiBrl(valor)}</b></div>`;
  const maxPessoa = Math.max(0, ...people.map((p) => aiNumber(p.cost_brl))), maxModelo = Math.max(0, ...providers.map((p) => aiNumber(p.cost_brl)));
  const quem = people.slice(0, 6).map((p) => gx(String(p.profile_name || '?').trim().slice(0, 2).toUpperCase(), String(p.profile_name || 'Não identificado').split(' ')[0], `${n0(p.calls)} ${pl(aiNumber(p.calls), 'pedido', 'pedidos')}`, p.cost_brl, maxPessoa)).join('');
  const emQue = providers.slice(0, 6).map((p) => { const rot = aiProviderLabel(p.provider), nome = rot === 'GPT' ? rot : rot.charAt(0) + rot.slice(1).toLowerCase(); return gx(rot.slice(0, 1), nome, `${p.model || 'modelo não identificado'} · ${n0(p.calls)} ${pl(aiNumber(p.calls), 'pedido', 'pedidos')}`, p.cost_brl, maxModelo); }).join('');
  const gemini = settings.gemini_billing === 'paid' ? 'API paga: o custo entra na conta' : 'plano gratuito: custo estimado em R$ 0,00';
  const parametros = `<details class="pv2-menu" id="pv2i-parametros"><summary class="pv2-chip">Parâmetros</summary>
        <div class="pv2-pop pv2i-pop"><p class="pv2-sub">O teto acende o aviso a partir de 80% e fica vermelho ao chegar a 100%. O Gemini está no ${safeText(gemini)}.</p>
          <div class="ai-setting-field"><label for="ai-budget-input">Teto mensal (R$)</label><input id="ai-budget-input" type="number" min="0" step="1" value="${aiNumber(settings.monthly_budget_brl)}"></div>
          <div class="ai-setting-field"><label for="ai-usd-input">Dólar de referência (R$ por US$ 1)</label><input id="ai-usd-input" type="number" min="0.01" step="0.01" value="${aiNumber(settings.brl_per_usd) || 5.5}"></div>
          <div class="ai-setting-field"><label for="ai-gemini-billing">Gemini</label><select id="ai-gemini-billing"><option value="free" ${settings.gemini_billing === 'free' ? 'selected' : ''}>Plano gratuito</option><option value="paid" ${settings.gemini_billing === 'paid' ? 'selected' : ''}>API paga</option></select></div>
          <button class="ai-setting-save pv2-btn s k" type="button" onclick="saveAiUsageSettings()">Salvar</button></div></details>`;
  const comQuem = `<section class="pv2-card pv2i-quem" aria-label="Com quem"><div class="pv2i-cab"><h3>Com quem</h3><span class="pv2-sub">quem pediu</span></div>${quem || '<p class="pv2-sub pv2-nada">Sem pessoas identificadas no período.</p>'}
      ${people.length ? `<p class="pv2-sub pv2i-pe">do maior para o menor${people.length > 6 ? ` · os 6 de ${n0(people.length)}` : ''}</p>` : ''}</section>`;
  const emQueHtml = `<section class="pv2-card pv2i-que" aria-label="Em quê"><div class="pv2i-cab"><h3>Em quê</h3><span class="pv2-sub">por modelo</span></div>${emQue || '<p class="pv2-sub pv2-nada">Sem modelos usados no período.</p>'}
      <div class="pv2i-pe pv2i-fichas"><span class="pv2i-ficha" title="Valores estimados pelo preço de tabela de cada modelo e pelo dólar de referência; não substituem as faturas da OpenAI, do Google e da Anthropic.">estimado</span><span class="pv2i-ficha">preço de tabela</span>${parametros}</div></section>`;
  root.innerHTML = `<div id="pv2-ia" class="pv2 pv2-ia d3f">${pv2iTopoHtml()}
    ${blocoAcao}
    <div class="d3f-nums" style="--n:4">${[
      { rotulo: `Gasto em ${dias} dias`, valor: aiBrl(gasto), tom: gasto ? '' : 'q', sub: `${overview.cost_usd != null ? aiUsd(overview.cost_usd) : aiUsd(month.cost_usd)}${pedidos ? ` · ${aiBrl(gasto / pedidos)} por pedido` : ''}` },
      { rotulo: `${Mes} fecha perto de`, valor: previsto > 0 ? redondo(previsto) : 'R$ 0', tom: previsto > 0 ? '' : 'q', serie: acumulado.length > 1 ? acumulado : null, sub: `até hoje · ${aiBrl(noMes)}${pedidosDoMes ? ` · ${n0(pedidosDoMes)} ${pl(pedidosDoMes, 'pedido', 'pedidos')}` : ''}` },
      { rotulo: `Pedidos em ${dias} dias`, valor: n0(pedidos), tom: pedidos ? '' : 'q', barra: pctSemCusto, sub: pedidos ? `${pctSemCusto}% sem custo` : 'nenhum no período' },
      { rotulo: 'Teto mensal', valor: teto > 0 ? `${usado.toFixed(0)}%` : 'Sem teto', tom: teto > 0 ? (usado >= 100 ? 'r' : usado >= 80 ? 'a' : '') : 'a', barra: teto > 0 ? Math.min(100, usado) : null,
        sub: `${teto > 0 ? `${aiBrl(noMes)} de ${aiBrl(teto)}` : 'aviso 80% · vermelho 100%'} · <button type="button" class="pv2-link" onclick="pv2iAbrirParametros(true)">${teto > 0 ? 'mudar' : 'definir'}</button>` },
    ].map(pv2iNum).join('')}</div>
    <div class="pv2i-baixo"><div class="d3f-coluna">${pedeAcao}${porDiaHtml}</div>${comQuem}${emQueHtml}</div>
  </div>`;
}
