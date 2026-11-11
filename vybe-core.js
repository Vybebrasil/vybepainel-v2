// Preserva todos os vínculos sem criar cópias da atividade.
function clientesDoItem(item) {
  const nomes = Array.isArray(item?.clientes) ? item.clientes : [item?.cliente];
  return [...new Set(nomes.filter(Boolean).map(n => normalizarCliente(String(n))))];
}
// Cliente ativo, regra única (auditoria 09/11, A1): o servidor manda `ativo_de_verdade` (ativo e não marcado "não é
// cliente"). Sem o campo (cache antigo), a mesma conta pelos dois campos. Cadastro de demanda e agenda não usam esta
// regra: a Vybe e os freelas não são clientes, mas têm peças.
function clienteAtivo(c) {
  if (!c) return false;
  if (typeof c.ativo_de_verdade === 'boolean') return c.ativo_de_verdade;
  return c.ativo !== false && !c.nao_e_cliente && !/inativ/i.test(String(c.status || ''));
}
function itemTemCliente(item, nome) { return clientesDoItem(item).includes(normalizarCliente(nome)); }

function carteiraDoCliente(nome) {
  const chave = valor => normalizarCliente(String(valor || '')).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = chave(nome);
  // Só o nome canônico exato participa: aproximações não podem transferir carteira.
  const cadastro = typeof CADASTRO_CLIENTES === 'undefined' ? null : CADASTRO_CLIENTES.find(c => chave(c.nome) === key);
  const definido = String(cadastro?.responsavel || '').trim();
  if (definido === 'Sem responsável geral') return '';
  if (definido === 'Vinícius') return 'vinicius';
  if (definido === 'Ewerton') return 'ewerton';
  // Valores legados são preservados; a divisão aprovada vale até edição explícita.
  const carteira = Object.keys(CARTEIRAS_CLIENTES).find(id => CARTEIRAS_CLIENTES[id].some(n => chave(n) === key));
  return carteira || '';
}
function descricaoCarteiraCliente(nome) {
  const carteira = carteiraDoCliente(nome);
  const responsavel = carteira === 'vinicius' ? 'Vinícius' : carteira === 'ewerton' ? 'Ewerton' : '';
  const site = normalizarCliente(String(nome || '')).toUpperCase() === 'VOA' ? ' · Site: Ewerton' : '';
  return responsavel ? `Responsável geral: ${responsavel}${site}` : `Responsável geral não definido${site}`;
}
function tagClienteHtml(nome, { dentroDeBotao = false } = {}) {
  const carteira = carteiraDoCliente(nome);
  const descricao = descricaoCarteiraCliente(nome);
  return `<span class="cliente-carteira" data-carteira="${carteira}" title="${safeText(descricao)}" aria-label="${safeText(nome)} — ${safeText(descricao)}"${dentroDeBotao ? '' : ' tabindex="0"'}>${safeText(nome)}</span>`;
}

// O nome do cliente em qualquer lista, cartão ou linha: sempre com a cor da carteira (Paulo, 08/11/2026: "aparece o nome do
// cliente sem a cor dele pra eu saber o head"). Sem foco próprio, porque quase sempre está dentro de um botão.
// O status de uma peça em qualquer lista: a pílula do painel, na cor do quadro (Paulo, 08/11/2026: "tem lugar que aparece o
// status sem a cor do status"). pillHtml (vybe-gestor.js) usa status_color e, sem ela, a cor do catálogo pelo nome.
function statusCor(d) {
  const s = String(d?.status || "Sem status");
  return typeof pillHtml === "function" ? pillHtml(safeText(s), d?.status_color || "", d?.status_border || "") : safeText(s);
}
function cliCor(nome) { return nome ? tagClienteHtml(String(nome), { dentroDeBotao: true }) : ""; }
// Prazo (entrega interna da equipe) e veiculação (dia em que vai ao ar) sempre com o nome, nunca uma data solta
// (Paulo, 09/11/2026: "essa data que tá aparecendo aí é veiculação ou prazo?"). Datas sem hora, sem fuso.
function pecaDatasHtml(d) {
  const dm = (v) => { const s = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : ""; };
  const prazo = dm(d?.prazo_iso ?? d?.prazo), ar = dm(d?.veiculacao_iso ?? d?.veiculacao);
  return (prazo ? `<span class="peca-data"><i>Prazo</i> ${prazo}</span>` : "") + (ar ? `<span class="peca-data"><i>No ar</i> ${ar}</span>` : "");
}
// Linha de peça nas listas curtas (espiar, Gestão): cliente com a cor da carteira, status com a cor do quadro e quem faz.
function pecaMetaHtml(d) {
  return [d?.cliente ? cliCor(d.cliente) : "", d?.status ? statusCor(d) : "", d?.responsavel ? `<span class="peca-quem">${safeText(String(d.responsavel))}</span>` : ""].filter(Boolean).join("");
}

function atualizarCoresDasCarteiras() {
  document.querySelectorAll('.cliente-carteira, .manager-calendar-client[data-carteira]').forEach(el => {
    const nome = el.dataset.cliente || el.querySelector('b')?.textContent || el.textContent;
    el.dataset.carteira = carteiraDoCliente(nome);
    el.title = descricaoCarteiraCliente(nome);
    if (el.classList.contains('cliente-carteira')) el.setAttribute('aria-label', `${nome} — ${el.title}`);
  });
}

// Um recorte compartilhado entre conteúdos, demandas e calendário.
// Uma atividade de duas carteiras aparece em ambas, sempre uma única vez.
let filtroCarteira = 'all';
function itemNaCarteira(item) {
  return filtroCarteira === 'all' || clientesDoItem(item).some(nome => carteiraDoCliente(nome) === filtroCarteira);
}
const ROTULO_CARTEIRA = { all: 'Todos', vinicius: 'Vinícius', ewerton: 'Ewerton' };
function pintarFiltroCarteira() {
  document.querySelectorAll('[data-filtro-carteira]').forEach(campo => {
    // O chip "Pessoa" do Painel de trabalho (quadro 01): o nome escolhido no chip e a opção marcada no menu.
    const rotulo = campo.querySelector?.('[data-filtro-carteira-rotulo]');
    if (!rotulo) campo.value = filtroCarteira;
    campo.dataset.carteira = filtroCarteira;
    if (rotulo) { rotulo.textContent = ROTULO_CARTEIRA[filtroCarteira] || 'Todos'; rotulo.parentElement?.classList.toggle('tem-escolha', filtroCarteira !== 'all'); }
    campo.querySelectorAll?.('[data-carteira-opcao]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.carteiraOpcao === filtroCarteira)));
  });
}
function atualizarVisoesDaCarteira() {
  pintarFiltroCarteira();
  if (activeBoard === 'demandas') { renderDemandas(); return; }
  renderCompactSummary();
  for (let n = 1; n <= (META.weeks?.length || 4); n++) renderWeek(n, currentFilter, currentDayFilter);
  renderOperationalTools();
  renderManagerCalendar();
  renderManagerIntelligence();
  updateClearFiltersState();
}
function definirFiltroCarteira(valor) {
  if (!['all', 'vinicius', 'ewerton'].includes(valor)) return;
  filtroCarteira = valor;
  atualizarVisoesDaCarteira();
  // A leitura existente traz escolhas explícitas do cadastro, inclusive alterações recentes.
  void ensureClientMasterSources();
}

// QUANDO FOI, NO RELÓGIO DE IRECÊ.
//
// O banco guarda em UTC e a Vybe trabalha em Irecê. Cortar a letra T do texto
// mostrava a hora de Londres com cara de hora daqui — três horas de diferença
// numa frase cujo trabalho é dizer quando a pessoa mexeu na peça.
//
// Morava na tela de Automações; veio para o núcleo quando o histórico da gaveta
// precisou da mesma resposta, para não nascer uma segunda versão. O ano só
// aparece quando não é o ano de agora — "18/08 às 06:14", mas "18/08/2025 às
// 06:14" —, e 'agora' entra por parâmetro para o teste não mudar de resposta
// quando o calendário virar.
function quandoNaBahia(em, agora = Date.now()) {
  const d = em ? new Date(em) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const fuso = 'America/Bahia';
  const ano = (x) => new Date(x).toLocaleDateString('pt-BR', { timeZone: fuso, year: 'numeric' });
  const mesmoAno = ano(d) === ano(agora);
  const dia = d.toLocaleDateString('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit', ...(mesmoAno ? {} : { year: 'numeric' }) });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit' });
  return `${dia} às ${hora}`;
}

// QUEM CADASTROU E QUANDO. Uma leitura só para tabela, cartão e ficha. Peça que
// veio do Monday não tem autor gravado — e o Monday está desligado, então não há
// de onde buscar: ela diz que foi importada, e a data é a do dia da importação.
function cadastroDaPeca({ id = '', criado_em = '', cadastrado_por = '', importada } = {}) {
  const veioDoMonday = importada ?? !String(id).startsWith('vybe:');
  const iso = String(criado_em || '');
  // A leitura do quadro manda 'YYYY-MM-DDTHH:MM' já na hora da Bahia; a ficha
  // manda o carimbo do banco, com fuso.
  const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso);
  const quando = !iso ? '' : local
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`
    : (() => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      const fuso = { timeZone: 'America/Bahia' };
      return `${d.toLocaleDateString('pt-BR', { ...fuso, day: '2-digit', month: '2-digit', year: 'numeric' })} ${
        d.toLocaleTimeString('pt-BR', { ...fuso, hour: '2-digit', minute: '2-digit' })}`;
    })();
  return {
    quem: cadastrado_por || (veioDoMonday ? 'Importado do Monday' : 'Sem registro'),
    quando: quando || '—',
    // Para ordenar: o texto local já ordena; o carimbo com fuso também.
    ordem: iso,
  };
}

// vybe-core.js — núcleo: toast, GraphQL, carregamento, semanas e parsing de itens
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Modo de data (Veiculação / Prazo) ───────────────────────────────────────
// Retorna o campo ISO correto de um item conforme o modo ativo
function getDateIso(d) { return dateMode === 'prazo' ? (d.prazo_iso || '') : d.veiculacao_iso; }
function getDateFmt(d) { return dateMode === 'prazo' ? (d.prazo || '—') : d.veiculacao; }

function setDateMode(mode, btn) {
  if (dateMode === mode) return;
  dateMode = mode;
  // Atualizar visual dos botões
  document.querySelectorAll('.date-mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // A referência muda: o dia anteriormente selecionado pode não existir no novo calendário.
  // Mantemos os demais filtros ativos, inclusive a seleção acumulada da equipe.
  currentDayFilter = '';
  recalcSemanas();
  populateDaySelect();
  const weeksCount = META.weeks ? META.weeks.length : 4;
  for (let s = 1; s <= weeksCount; s++) renderWeek(s, currentFilter, currentDayFilter);
  renderOperationalTools();
  renderManagerCalendar();
  renderManagerIntelligence();
  updateClearFiltersState();
}

// Recalcula o campo `semana` de cada item com base no dateMode atual
function recalcSemanas() {
  const weeks = META.weeks || [];
  [DADOS, DADOS_ALL].forEach(list => (list || []).forEach(d => {
    const iso = getDateIso(d);
    d.semana = null;
    for (let i = 0; i < weeks.length; i++) {
      if (iso && iso >= weeks[i].startIso && iso <= weeks[i].endIso) {
        d.semana = i + 1;
        break;
      }
    }
  }));
}

// ─── Toast ────────────────────────────────────────────────────────────────────
// Um aviso so, e cada chamada agendava o proprio sumico sem cancelar o
// anterior. Dois avisos seguidos e o relogio do PRIMEIRO apagava o SEGUNDO no
// meio — foi assim que a mensagem de "a referencia nao subiu" desapareceu atras
// do "✓ conteudo criado", e e o que impedia um aviso de progresso de ficar de
// pe enquanto o lote roda.
let TEMPO_DO_AVISO = null;
function showToast(msg, type='info', duration=3000) {
  // No mundo o aviso curto é um só (quadro 45): mesmo lugar (canto de cima, com os do WhatsApp) e mesmo desenho.
  if (avisoCurtoNoMundo(msg, { erro: type === 'err' || type === 'error', tempo: Math.max(duration, 4000) })) return;
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `show ${type}`;
  if (TEMPO_DO_AVISO) clearTimeout(TEMPO_DO_AVISO);
  TEMPO_DO_AVISO = setTimeout(() => { t.className = ''; TEMPO_DO_AVISO = null; }, duration);
}

// ─── Aviso curto do mundo (fase 3d, quadro 45 do moodboard) ───────────────────
// Um desenho só para os avisos que chegam (menção, mensagem do WhatsApp, aviso do sino): ícone neutro, o título
// inteiro, a frase e até duas ações. Sem faixa colorida na borda; cor só para erro. Empilham no canto de cima à direita,
// na caixa #vv-wa-avisos (decisão do Paulo de 09/11/2026), no máximo três. Fora do mundo não aparece (devolve null) e
// quem chamou segue com o aviso antigo. Parar o mouse em cima, ou chegar nele pelo teclado, segura o aviso na tela; o
// foco posto pelo código depois de um clique (o da Música) não segura: o aviso some sozinho no tempo dele.
const AVISO_CURTO_ICONES = {
  mencao: '<circle cx="12" cy="12" r="3.5"/><path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.4 6.8"/>',
  conversa: '<path d="M4 5h16v11H8l-4 4z"/>',
  sino: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  musica: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  erro: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
};
// Aviso de uma frase só (toast antigo, aviso do Escritório) vira o aviso curto no mundo; fora dele devolve false.
function avisoCurtoNoMundo(texto, { erro = false, tempo = 6000, icone = 'info', acoes = [] } = {}) {
  if (typeof document === 'undefined' || !document.body?.classList?.contains('mundo') || !texto) return false;
  return Boolean(mostrarAvisoCurto({ chave: 'curto:' + String(texto).slice(0, 80), icone, titulo: String(texto), erro, tempo, acoes }));
}
function mostrarAvisoCurto({ chave = '', icone = 'info', titulo = '', frase = '', acoes = [], erro = false, tempo = 7000 } = {}) {
  if (typeof document === 'undefined' || !document.body?.classList?.contains('mundo') || !titulo) return null;
  let caixa = document.getElementById('vv-wa-avisos');
  if (!caixa) { caixa = document.createElement('div'); caixa.id = 'vv-wa-avisos'; caixa.setAttribute('aria-live', 'polite'); document.body.append(caixa); }
  if (chave) caixa.querySelectorAll('.vv-aviso-curto').forEach((x) => { if (x.dataset.chave === chave) x.remove(); });
  // O sino mostra o último aviso quando não há nada novo (quadro 41).
  globalThis.ULTIMO_AVISO_CURTO = { titulo: String(titulo), frase: String(frase || ''), em: new Date().toISOString() };
  const el = document.createElement('div');
  el.className = 'vv-aviso-curto' + (erro ? ' erro' : '');
  el.setAttribute('role', erro ? 'alert' : 'status');
  if (chave) el.dataset.chave = chave;
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const lista = (Array.isArray(acoes) ? acoes : []).filter((a) => a && a.rotulo && typeof a.fazer === 'function').slice(0, 2);
  el.innerHTML = `<span class="vv-aviso-curto-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16">${AVISO_CURTO_ICONES[erro ? 'erro' : icone] || AVISO_CURTO_ICONES.info}</svg></span>
    <div class="vv-aviso-curto-txt" title="${esc(frase ? `${titulo} · ${frase}` : titulo)}"><b>${esc(titulo)}</b>${frase ? `<small>${esc(frase)}</small>` : ''}${lista.length ? `<div class="vv-aviso-curto-acoes">${lista.map((a, i) => `<button type="button" class="${a.principal ? 'vc-acao' : 'vc-sec'}" data-aviso-curto="${i}">${esc(a.rotulo)}</button>`).join('')}</div>` : ''}</div>
    <button type="button" class="vc-ico vv-aviso-curto-x" aria-label="Fechar o aviso" title="Fechar"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
  let relogio = null;
  const sair = () => { clearTimeout(relogio); el.remove(); ajustarAvisosCurtos(); };
  const contar = () => { clearTimeout(relogio); if (tempo > 0) relogio = setTimeout(sair, tempo); };
  // No celular, o aviso que espera a vez na pilha (ajustarAvisosCurtos) não gasta o tempo dele escondido.
  el.vvPausar = () => clearTimeout(relogio);
  el.vvContar = contar;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    sair();
    if (b.dataset.avisoCurto != null) { try { lista[Number(b.dataset.avisoCurto)].fazer(); } catch { /* a ação falhou: o aviso já saiu */ } }
  });
  // Só o mouse que se mexe em cima segura o aviso: nascer debaixo de um ponteiro parado (ou do último toque) não conta.
  let comMouse = false;
  el.addEventListener('pointermove', (e) => { if (!comMouse && e.pointerType !== 'touch') { comMouse = true; clearTimeout(relogio); } });
  el.addEventListener('pointerleave', () => { comMouse = false; contar(); });
  // O foco do teclado segura o aviso, mas com teto: no máximo AVISO_CURTO_TETO_FOCO desde que ele apareceu (ou o tempo
  // dele, se for maior). Antes ficava enquanto o foco não saísse (medido: 13,5 s com o aviso da Música).
  const nasceu = Date.now(), teto = Math.max(tempo, AVISO_CURTO_TETO_FOCO);
  const restante = () => Math.max(0, nasceu + teto - Date.now());
  el.addEventListener('focusin', () => { if (AVISO_CURTO_PELO_TECLADO && tempo > 0 && !comMouse) { clearTimeout(relogio); relogio = setTimeout(sair, restante()); } });
  el.addEventListener('focusout', (e) => { if (el.contains(e.relatedTarget) || comMouse || !(tempo > 0)) return; clearTimeout(relogio); relogio = setTimeout(sair, Math.min(tempo, restante())); });
  caixa.append(el);
  while (caixa.children.length > 3) caixa.firstElementChild.remove();
  contar();
  ajustarAvisosCurtos();
  if (!AVISO_CURTO_VIGIA) AVISO_CURTO_VIGIA = setInterval(ajustarAvisosCurtos, 500);
  return el;
}
// De onde veio o último gesto: só o foco que chega pelo teclado segura o aviso na tela, e por no máximo ~8 s.
let AVISO_CURTO_PELO_TECLADO = false;
let AVISO_CURTO_VIGIA = null;
const AVISO_CURTO_TETO_FOCO = 8000;
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', () => { AVISO_CURTO_PELO_TECLADO = true; }, true);
  document.addEventListener('pointerdown', () => { AVISO_CURTO_PELO_TECLADO = false; }, true);
}
// O aviso nunca fica sobre um controle clicável: botão de janela, campo, botão da tela, dock lateral, barra de baixo
// (quadro 29, regra 6; re-auditorias de 10/11/2026). O lugar continua o canto de cima à direita (decisão do Paulo) e vale
// quando não há nada embaixo. Havendo, nesta ordem: (1) com um painel encostado à direita e vaga entre o dock e ele, fica
// ao lado do painel, na mesma altura; (2) vai para a vaga sem controle mais perto do canto; (3) sem vaga, encolhe (uma
// linha, mais estreito) e procura de novo, primeiro no alto e depois na tela toda; (4) só então fica onde cobre menos.
// No celular, com uma janela ou o Hoje aberto, ele encolhe e fica logo acima da barra de baixo, na largura da tela; não
// usa a faixa do título nem o meio da tela.
// Roda quando um aviso entra e enquanto houver aviso na tela (uma janela pode abrir depois dele).
const AVISO_CURTO_CONTROLES = 'button,a[href],input,select,textarea,summary,[role="button"],[role="tab"],[role="switch"],[onclick],[tabindex]:not([tabindex="-1"])';
// Faixas que são só controle: contam inteiras, com os vãos entre os botões.
const AVISO_CURTO_BARRAS = '.vv-trilho,.vv-dock-salas,.vv-canto-modulo';
function ajustarAvisosCurtos() {
  const caixa = document.getElementById('vv-wa-avisos');
  if (!caixa || !caixa.children.length) {
    if (caixa?.style) { caixa.style.right = ''; caixa.style.top = ''; caixa.style.width = ''; caixa.classList?.remove('compacto', 'minimo'); }
    clearInterval(AVISO_CURTO_VIGIA); AVISO_CURTO_VIGIA = null;
    return;
  }
  if (typeof document.elementsFromPoint !== 'function') return;
  // Com o mouse ou o foco em cima, a caixa não sai do lugar (não foge de quem vai clicar nela).
  if (caixa.matches(':hover') || (AVISO_CURTO_PELO_TECLADO && caixa.contains(document.activeElement))) return;
  const W = window.innerWidth, H = window.innerHeight;
  // Os controles que estão de fato à vista (por cima de tudo, sem contar a caixa). Um "controle" do tamanho da tela é
  // uma região que rola, não um botão: não conta.
  const obstaculos = [];
  for (const c of document.querySelectorAll(AVISO_CURTO_CONTROLES)) {
    if (caixa.contains(c) || c.disabled) continue;
    const q = c.getBoundingClientRect();
    if (q.width < 3 || q.height < 3 || q.bottom <= 0 || q.top >= H || q.right <= 0 || q.left >= W || q.width * q.height > W * H * 0.35) continue;
    const x = Math.min(W - 1, Math.max(0, q.left + q.width / 2)), y = Math.min(H - 1, Math.max(0, q.top + q.height / 2));
    const visto = document.elementsFromPoint(x, y).find((e) => !caixa.contains(e));
    if (visto && (visto === c || c.contains(visto))) obstaculos.push({ el: c, l: q.left, t: q.top, r: q.right, b: q.bottom });
  }
  const barras = [...document.querySelectorAll(AVISO_CURTO_BARRAS)].map((b) => b.getBoundingClientRect()).filter((q) => q.width > 2 && q.height > 2);
  for (const q of barras) obstaculos.push({ el: null, l: q.left, t: q.top, r: q.right, b: q.bottom });
  const cobertos = (l, t, w, h) => obstaculos.filter((o) => o.r > l + 1 && o.l < l + w - 1 && o.b > t + 1 && o.t < t + h - 1);
  const quantos = (l, t, w, h, teto) => { let n = 0; for (const o of obstaculos) if (o.r > l + 1 && o.l < l + w - 1 && o.b > t + 1 && o.t < t + h - 1 && ++n > teto) break; return n; };
  // Volta ao lugar e ao tamanho de sempre (quem esperava a vez reaparece e o tempo dele começa) e mede de novo.
  caixa.style.right = ''; caixa.style.top = ''; caixa.style.width = ''; caixa.classList.remove('compacto', 'minimo');
  const esperando = [...caixa.children].filter((x) => x.hidden);
  for (const x of esperando) x.hidden = false;
  const acordar = () => { for (const x of esperando) if (!x.hidden) x.vvContar?.(); };
  const r = caixa.getBoundingClientRect(), embaixo = cobertos(r.left, r.top, r.width, r.height);
  if (W > 600) acordar();
  if (!embaixo.length && W > 600) return;
  const margem = Math.max(8, W - r.right);
  const por = (l, t, w) => { caixa.style.right = `${Math.round(W - l - w)}px`; caixa.style.top = `${Math.round(t)}px`; caixa.style.width = `${Math.round(w)}px`; };
  // A vaga mais perto do alvo dentro da área, de passo em passo; sem vaga, a posição que cobre menos controles.
  const procurar = (w, h, area, alvo) => {
    let melhor = null;
    const passo = 12, xs = [], ys = [];
    for (let x = Math.min(alvo.x, area.r - w); x >= area.l; x -= passo) xs.push(x);
    for (let x = alvo.x + passo; x <= area.r - w; x += passo) xs.push(x);
    for (let y = Math.min(alvo.y, area.b - h); y >= area.t; y -= passo) ys.push(y);
    for (let y = alvo.y + passo; y <= area.b - h; y += passo) ys.push(y);
    for (const y of ys) for (const x of xs) {
      const custo = Math.abs(x - alvo.x) + Math.abs(y - alvo.y);
      if (melhor && !melhor.n && custo >= melhor.custo) continue;
      const n = quantos(x - 4, y - 4, w + 8, h + 8, melhor ? melhor.n : Infinity);
      if (!melhor || n < melhor.n || (n === melhor.n && custo < melhor.custo)) melhor = { x, y, n, custo };
    }
    return melhor;
  };
  // O que fecha a área por baixo e pela esquerda: a barra de baixo ou o dock das salas, e o dock lateral.
  const pe = Math.min(H, ...barras.filter((q) => q.top > H / 2 && q.width > W / 3).map((q) => q.top));
  const lateral = barras.find((q) => q.left < W / 2 && q.right < W / 2 && q.height > H / 2);
  const esquerda = (lateral ? lateral.right : 0) + margem;
  if (W <= 600) {
    // Celular: encolhido, na largura da tela, sempre logo acima da barra de baixo (título e frase em até duas linhas);
    // a faixa do título e o meio da tela não entram. Dois ou três avisos empilham para cima; se o que sobe cobriria um
    // botão ou uma linha clicável, os mais novos esperam o primeiro sair (o tempo deles só conta quando aparecem).
    caixa.classList.add('compacto');
    const larga = W - 2 * margem; caixa.style.width = `${Math.round(larga)}px`;
    const filhos = [...caixa.children];
    for (let i = filhos.length - 1; i > 0; i--) {
      const alto = caixa.getBoundingClientRect().height, primeiro = filhos[0].getBoundingClientRect().height;
      if (!quantos(margem - 4, pe - 8 - alto - 4, larga + 8, alto - primeiro, 0)) break;
      filhos[i].hidden = true; filhos[i].vvPausar?.();
    }
    const alto = caixa.getBoundingClientRect().height, base = pe - 8 - alto;
    // Com a gaveta da demanda aberta (tela inteira, com o campo e os botões no pé), sobe até onde cobre menos.
    const naGaveta = document.getElementById('workspace-drawer') ? procurar(larga, alto, { l: margem, r: W - margem, t: Math.max(margem, base - H * 0.2), b: pe - 8 }, { x: margem, y: base }) : null;
    por(margem, naGaveta ? naGaveta.y : base, larga);
    acordar();
    return;
  }
  // (1) Painel encostado à direita (gaveta, ficha): ao lado dele, sem entrar no dock lateral.
  for (const c of embaixo) {
    if (!c.el) continue;
    let p = c.el.parentElement, q = null;
    for (; p && p !== document.body; p = p.parentElement) {
      const pos = getComputedStyle(p).position; if (pos !== 'fixed' && pos !== 'absolute') continue;
      q = p.getBoundingClientRect(); if (q.width >= 240 && q.height >= 160 && q.width < W - 2) break;
      q = null;
    }
    if (!q || q.right < W - 80) continue;
    const vaga = q.left - esquerda - margem;
    if (vaga < 240) break;
    const w = Math.min(r.width, vaga), l = q.left - margem - w;
    caixa.style.width = `${Math.round(w)}px`;
    const h = caixa.getBoundingClientRect().height;
    if (!cobertos(l - 4, r.top - 4, w + 8, h + 8).length) { por(l, r.top, w); return; }
    caixa.style.width = '';
    break;
  }
  // (2) A vaga sem controle mais perto do canto, da metade da tela para cima.
  const area = { l: esquerda, r: W - margem, t: margem, b: Math.min(pe - margem, Math.max(r.bottom, H * 0.62)) };
  let v = procurar(r.width, r.height, area, { x: r.left, y: r.top });
  if (v && !v.n) { por(v.x, v.y, r.width); return; }
  // (3) Encolhido e mais estreito, no alto e depois na tela toda; por fim só o título e a ação (a frase fica na dica e
  // no sino); (4) sem vaga nem assim, onde cobre menos.
  caixa.classList.add('compacto');
  let menor = null;
  for (const minimo of [false, true]) {
    caixa.classList.toggle('minimo', minimo);
    for (const onde of [area, { ...area, b: pe - margem }]) for (const w of [Math.min(r.width, 340), 300, 260]) {
      caixa.style.width = `${w}px`;
      const h = caixa.getBoundingClientRect().height;
      v = procurar(w, h, onde, { x: r.right - w, y: r.top });
      if (v && !v.n) { por(v.x, v.y, w); return; }
      if (v && (!menor || v.n < menor.n)) menor = { ...v, w, minimo };
    }
  }
  if (menor) { caixa.classList.toggle('minimo', menor.minimo); por(menor.x, menor.y, menor.w); }
}

// ─── GraphQL Query ────────────────────────────────────────────────────────────
async function mondayQuery() {
  throw new Error('Integração Monday encerrada. Use os dados e ações do Vybe.');
}
// ─── Buscar activity logs do board (movimentações de grupo e alterações de prazo) ──────────────────────────────────────────────────────
let ACTIVITY_LOGS_CACHE = null; // cache para não rebuscar a cada render
async function fetchActivityLogs() {
  if (ACTIVITY_LOGS_CACHE) return ACTIVITY_LOGS_CACHE;
  const r=await fetch('/api/painel?area=historico',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok) throw new Error(`Histórico Vybe indisponível (${r.status})`);
  const dados=await r.json();
  if(!dados.logs) throw new Error('Histórico Vybe sem registros válidos.');
  ACTIVITY_LOGS_CACHE=dados.logs;
  return ACTIVITY_LOGS_CACHE;
}

// Calcula Taxa OK para um departamento: % de itens que saíram do grupo antes do prazo original
function calcTaxaOK(itens, dept, moveEvents, prazoEvents) {
  // Apenas itens que já saíram do grupo deste departamento
  const groupIds = dept.groupIds || [];
  let okCount = 0, nokCount = 0;
  const okItems = [], nokItems = [];
  for (const item of itens) {
    const pid = String(item.id);
    const moves = moveEvents[pid] || [];
    // Encontrar o momento em que saiu do grupo deste departamento
    const saidaMove = moves.find(m => groupIds.includes(m.sourceGroupId));
    if (!saidaMove) continue; // ainda não saiu do grupo, não conta
    const dataSaida = saidaMove.date; // YYYY-MM-DD
    // Encontrar o primeiro prazo cadastrado para este item
    const prazos = prazoEvents[pid] || [];
    let primeiroPrazo = null;
    if (prazos.length > 0) {
      // O primeiro evento de prazo tem previousPrazoDate (prazo anterior) ou prazoDate
      // O prazo original é o previousPrazoDate do evento mais antigo, ou o prazoDate se não há anterior
      const primEvento = prazos[0];
      primeiroPrazo = primEvento.previousPrazoDate || primEvento.prazoDate;
    }
    // Se não há log de prazo, usar o prazo atual do item
    if (!primeiroPrazo) primeiroPrazo = item.prazo_iso || null;
    if (!primeiroPrazo) continue; // sem prazo, não conta
    // Comparar: saiu antes ou no prazo = OK; saiu depois = NOK
    if (dataSaida <= primeiroPrazo) {
      okCount++;
      okItems.push({...item, _dataSaida: dataSaida, _primeiroPrazo: primeiroPrazo});
    } else {
      nokCount++;
      nokItems.push({...item, _dataSaida: dataSaida, _primeiroPrazo: primeiroPrazo});
    }
  }
  const total = okCount + nokCount;
  const pct = total > 0 ? Math.round((okCount / total) * 100) : null;
  return { okCount, nokCount, total, pct, okItems, nokItems };
}

// ─── Controle visual de carregamento ─────────────────────────────────────────
let loadingCycleId = 0;
let outboundMutationGuardUntil = 0;
let outboundMutationGuardLabel = '';
function armOutboundMutationGuard(label='alteração local') {
  outboundMutationGuardUntil = Date.now() + 45000;
  outboundMutationGuardLabel = label;
}
function outboundMutationGuardActive() {
  return Date.now() < outboundMutationGuardUntil;
}
function setLoadingState({ phase, text, count, code, system } = {}) {
  const target = (id) => document.getElementById(id);
  if (phase) target('loading-phase').textContent = phase;
  if (text) target('loading-text').textContent = text;
  if (count) target('loading-count').textContent = count;
  if (code) target('loading-stage-code').textContent = code;
  if (system) target('loading-system').textContent = system;
}
function setBootAct(act) {
  const loading = document.getElementById('loading');
  if (!loading) return;
  loading.dataset.bootAct = act;
  const order = ['link','data','stations'];
  const current = order.indexOf(act);
  document.querySelectorAll('[data-boot-act]').forEach(node => {
    const index = order.indexOf(node.dataset.bootAct);
    node.classList.toggle('done', index >= 0 && index < current);
    node.classList.toggle('active', index === current);
  });
}
function beginLoadingCycle() {
  const cycleId = ++loadingCycleId;
  const loading = document.getElementById('loading');
  const spinner = document.getElementById('loading-spinner');
  const progress = document.getElementById('loading-progress');
  // Reinicia a sequência visual para evitar estado congelado entre atualizações.
  loading.classList.remove('show','is-complete','is-unlocking');
  spinner.classList.remove('is-spinning');
  progress.style.transition = 'none';
  progress.style.width = '0%';
  setLoadingState({ phase:'ESTABELECENDO VÍNCULO', text:'Autenticando conexão com a operação Vybe...', count:'00 / 100', code:'SYNC // 00', system:'NÚCLEO EM SINCRONIA' });
  setBootAct('link');
  void spinner.offsetWidth;
  spinner.classList.add('is-spinning');
  loading.classList.add('show');
  requestAnimationFrame(() => {
    if (cycleId !== loadingCycleId) return;
    progress.style.transition = 'width .35s ease';
    progress.style.width = '5%';
  });
  return cycleId;
}
function updateLoadingProgress(page) {
  const pct = Math.min(92, 5 + page * 9);
  document.getElementById('loading-progress').style.width = `${pct}%`;
  setBootAct('data');
  setLoadingState({ phase:'DADOS MAPEADOS EM TEMPO REAL', text:`Coletando sinais da produção · pacote ${String(page).padStart(2,'0')}`, count:`${String(pct).padStart(2,'0')} / 100`, code:`SYNC // ${String(page).padStart(2,'0')}`, system:'NÚCLEO PROCESSANDO PACOTES' });
}
function finishLoadingCycle(cycleId) {
  if (cycleId !== loadingCycleId) return;
  document.getElementById('loading-progress').style.width = '100%';
  document.getElementById('loading-spinner')?.classList.remove('is-spinning');
  const loading = document.getElementById('loading');
  loading?.classList.add('is-complete','is-unlocking');
  setBootAct('stations');
  setLoadingState({ phase:'ESTAÇÕES ARMADAS', text:'Operação sincronizada. Central liberada.', count:'100 / 100', code:'SYNC // READY', system:'SISTEMA OPERACIONAL ATIVO' });
}

// ─── Buscar todos os itens com paginação ──────────────────────────────────────────────────────
async function fetchAllItems(options={}) {
  const { silent=false } = options;
  if (typeof fonteDeLeitura === 'function' && fonteDeLeitura() === 'dominio') {
    const dados = await buscarDominio();
    return dominioComoItensDoMonday(dados);
  }
  const allItems = [];
  let cursor = null;
  let page = 0;

  const loadingText = document.getElementById('loading-text');

  while (true) {
    page++;
    if (!silent) updateLoadingProgress(page);

    const query = cursor
      ? `query($cursor: String!) {
          next_items_page(limit: 200, cursor: $cursor) {
            cursor
            items {
              id name updated_at
              group { id title }
              updates(limit: 3) { id body created_at creator { name } }
              column_values(ids: ["lista_suspensa_mkmqnjbv","status","lista_suspensa0__1","person","data__1","data"]) {
                  id text value
                  ... on StatusValue { index label_style { color border } updated_at }
                }
            }
          }
        }`
      : `{
          boards(ids: [${BOARD_ID}]) {
            items_page(limit: 200) {
              cursor
              items {
                id name updated_at
                group { id title }
                updates(limit: 3) { id body created_at creator { name } }
                column_values(ids: ["lista_suspensa_mkmqnjbv","status","lista_suspensa0__1","person","data__1","data"]) {
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

// ─── Opções oficiais de status ───────────────────────────────────────────────
let STATUS_OPTIONS = [];
async function fetchStatusOptions() {
  if (typeof fonteDeLeitura === 'function' && fonteDeLeitura() === 'dominio') {
    const dados = DOMINIO_ULTIMA_RESPOSTA || await buscarDominio();
    // A chave e a identidade da etiqueta; sem ela o menu nao tem como renomear,
    // recolorir nem apagar. E a ordem e a do catalogo, nao a do indice do
    // Monday: etiqueta criada aqui nao tem indice, e Number(null) daria 0 —
    // ela furaria a fila para o primeiro lugar.
    STATUS_OPTIONS = (dados.status || []).map((s) => ({
      chave: s.chave, label: s.rotulo, ativa: s.ativa !== false,
      index: s.indice === null || s.indice === undefined ? null : Number(s.indice),
      color: validStatusColor(s.cor) || '#c4c4c4',
      border: validStatusColor(s.borda) || validStatusColor(s.cor) || '#c4c4c4'
    }));
    return STATUS_OPTIONS;
  }
  const q = `{ boards(ids:[${BOARD_ID}]) { columns(ids:["status"]) { settings_str } } }`;
  const data = await mondayQuery(q);
  const raw = data?.boards?.[0]?.columns?.[0]?.settings_str || '{}';
  const settings = JSON.parse(raw);
  const labels = settings.labels || {};
  const colors = settings.labels_colors || {};
  STATUS_OPTIONS = Object.entries(labels)
    .filter(([, label]) => label)
    .map(([index, label]) => ({
      index: Number(index),
      label,
      color: validStatusColor(colors[index]?.color) || '#c4c4c4',
      border: validStatusColor(colors[index]?.border) || validStatusColor(colors[index]?.color) || '#c4c4c4'
    }))
    .sort((a, b) => a.index - b.index);
  return STATUS_OPTIONS;
}

// ─── Calcular semanas ────────────────────────────────────────────────────────────────────────────────
// Retorna as 4 (ou 5) semanas do mês atual, cada uma começando na segunda-feira.
// Se o dia 1 do mês não cai numa segunda, a Semana 01 começa na segunda-feira
// da semana anterior (garantindo que dias como 28/06–05/07 apareçam).
function calcWeeks() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  const iso  = d => d.toISOString().slice(0,10);
  const todayFmt = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
  // Mês-alvo com offset
  const targetDate = new Date(today);
  targetDate.setMonth(today.getMonth() + MONTH_OFFSET, 1);
  const year  = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const firstDay = new Date(year, month, 1, 12, 0, 0);
  const firstDow = firstDay.getDay(); // 0=Dom, 1=Seg, ...

  // Encontrar a segunda-feira que CONTÉM o dia 1 do mês.
  // Se dia 1 é segunda (dow=1), firstMon = dia 1.
  // Senão, voltar para a segunda-feira anterior.
  let firstMon;
  if (firstDow === 1) {
    firstMon = new Date(firstDay);
  } else {
    // Voltar para a segunda anterior
    // dow 0(Dom) → voltar 6 dias; dow 2(Ter) → voltar 1; dow 3(Qua) → voltar 2; etc.
    const daysBack = firstDow === 0 ? 6 : (firstDow - 1);
    firstMon = new Date(firstDay);
    firstMon.setDate(1 - daysBack);
  }

  // Último dia do mês
  const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0);

  // Gerar semanas até cobrir todo o mês (normalmente 4 ou 5)
  const weeks = [];
  let weekStart = new Date(firstMon);
  while (weekStart <= lastDayOfMonth && weeks.length < 6) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    weeks.push({ start, end, startFmt: fmt(start), endFmt: fmt(end), startIso: iso(start), endIso: iso(end) });
    weekStart.setDate(weekStart.getDate() + 7);
  }

  // Semana atual = semana que contém hoje (para destacar)
  const todayIso = iso(today);
  let currentWeekIdx = weeks.findIndex(w => todayIso >= w.startIso && todayIso <= w.endIso);
  if (currentWeekIdx < 0) currentWeekIdx = 0;

  const result = {
    weeks,
    currentWeekIdx,
    today: todayFmt,
    today_iso: todayIso,
    generated_at: `${todayFmt.slice(0,10)} às ${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}`,
    // Compat: manter week1/week2 apontando para semana atual e próxima
    ...(() => {
      const seguinte = weeks[currentWeekIdx + 1] || (() => {
        const seteDiasDepois = (isoStr) => {
          const d = new Date(`${isoStr}T12:00:00`);
          d.setDate(d.getDate() + 7);
          return d;
        };
        const ini = seteDiasDepois(weeks[currentWeekIdx].startIso);
        const fim = seteDiasDepois(weeks[currentWeekIdx].endIso);
        return { startIso: iso(ini), endIso: iso(fim), startFmt: fmt(ini), endFmt: fmt(fim) };
      })();
      return {
        week1_start: weeks[currentWeekIdx].startFmt, week1_end: weeks[currentWeekIdx].endFmt,
        week2_start: seguinte.startFmt, week2_end: seguinte.endFmt,
        week1_start_iso: weeks[currentWeekIdx].startIso, week1_end_iso: weeks[currentWeekIdx].endIso,
        week2_start_iso: seguinte.startIso, week2_end_iso: seguinte.endIso,
      };
    })(),
  };
  return result;
}

// ─── Processar itens brutos ───────────────────────────────────────────────
function statusContextPlainText(body='') { return String(body).replace(/<\/(p|div|li|br)>/gi,'\n').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+\n/g,'\n').replace(/\n\s+/g,'\n').trim(); }
function contextLine(text,label) { const match=String(text||'').match(new RegExp(`(?:^|\\n)${label}:\\s*([^\\n]+)`, 'i')); return match ? match[1].trim() : ''; }
function latestStatusContext(item) { const update=(item?.updates||[]).find(u=>String(u.body||'').includes('Vybe OS · Contexto de status')); if(!update) return null; const text=statusContextPlainText(update.body); return { text, target:contextLine(text,'Etapa').split('→').pop().trim(), reason:contextLine(text,'Motivo'), next:contextLine(text,'Próximo passo'), requester:contextLine(text,'Solicitante/Dependência'), source:contextLine(text,'Origem'), created_at:update.created_at||'', creator:update.creator?.name||'' }; }
function processItems(rawItems, meta) {
  // Aceitar itens de qualquer das 4 semanas do mês
  const allWeekRanges = meta.weeks || [];
  // Compat: se não tiver meta.weeks, usar as 2 semanas antigas
  const weekRanges = allWeekRanges.length > 0 ? allWeekRanges : [
    { startIso: meta.week1_start_iso, endIso: meta.week1_end_iso },
    { startIso: meta.week2_start_iso, endIso: meta.week2_end_iso }
  ];

  const processed = [];
  const seen = new Set();

  for (const item of rawItems) {
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);

    const colMap = {};
    const colValueMap = {};
    const colStyleMap = {};
    (item.column_values || []).forEach(c => {
      colMap[c.id] = c.text || '';
      colValueMap[c.id] = c.value || '';
      colStyleMap[c.id] = { ...(c.label_style || {}), index: c.index, updated_at: c.updated_at };
    });

    // Suporte a múltiplos clientes na mesma coluna (ex: "Daiana Miron, Larissa Fernanda")
    const clienteRaw = colMap[COLUNAS.producao.cliente] || '';
    if (!clienteRaw) continue;
    // Os dois quadros precisam chamar o cliente pelo mesmo nome. So Solicitacoes
    // passava por normalizarCliente; Producao lia o nome cru — e o mesmo cliente
    // aparecia em duas fichas, uma com o apelido e outra sem.
    const clientesList = (Array.isArray(item.clientes) ? item.clientes : clienteRaw.split(',')).map(s=>normalizarCliente(s.trim())).filter(Boolean);
    // Filtrar clientes inativos — se TODOS forem inativos, pular o item
    const clientesAtivos = clientesList.filter(c => !clienteDesativado(c));
    if (clientesAtivos.length === 0) continue;
    // Usar apenas o primeiro cliente ativo (evita card duplo)
    const cliente = clientesAtivos[0];

    const veiculacaoStr = colMap[COLUNAS.producao.veiculacao] || '';
    const prazoStr = colMap['data'] || '';
    // Uma demanda operacional pode existir por prazo antes de receber veiculação.
    // Só ignoramos itens realmente sem referência temporal nas duas colunas.
    if (!veiculacaoStr && !prazoStr) continue;

    const veiculacaoIso = veiculacaoStr ? veiculacaoStr.slice(0,10) : '';
    const veiculacao = veiculacaoIso ? new Date(veiculacaoIso + 'T12:00:00') : null;
    // prazoStr pode vir como YYYY-MM-DD ou vazio.
    const prazoIso = prazoStr ? prazoStr.slice(0,10) : '';
    const referenceIso = dateMode === 'prazo' ? (prazoIso || veiculacaoIso) : (veiculacaoIso || prazoIso);

    // Manter o item se prazo OU veiculação estiverem dentro da janela mensal.
    // A semana efetivamente exibida será recalculada conforme o modo ativo.
    const matchingWeeks = weekRanges
      .map((week, index) => ({ week, index }))
      .filter(({week}) => [veiculacaoIso, prazoIso].some(iso => iso && iso >= week.startIso && iso <= week.endIso));
    if (!matchingWeeks.length) continue;
    const activeWeek = weekRanges.findIndex(week => referenceIso && referenceIso >= week.startIso && referenceIso <= week.endIso);
    let semana = activeWeek >= 0 ? activeWeek + 1 : matchingWeeks[0].index + 1;

    const today = meta.today_iso;
    const prazoAtrasado = !!(prazoIso && prazoIso < today);

    const groupId = item.group?.id || '';
    const grupo = GROUP_MAP[groupId] || groupId || '—';

    const diasSem = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const diaSemana = veiculacao ? diasSem[veiculacao.getDay()] : (prazoIso ? diasSem[new Date(prazoIso + 'T12:00:00').getDay()] : '—');
    const fmtDate = d => d ? `${String(new Date(d+'T12:00:00').getDate()).padStart(2,'0')}/${String(new Date(d+'T12:00:00').getMonth()+1).padStart(2,'0')}` : '';

    // Extrair IDs dos responsáveis para filtro por pessoa (suporta múltiplos)
    let responsavelId = '';
    let responsavelIds = [];
    const personValue = colValueMap['person'] || '';
    if (personValue) {
      try {
        const pv = JSON.parse(personValue);
        const personsArr = pv.personsAndTeams || pv.persons || [];
        responsavelIds = personsArr.map(p => String(p.id));
        if (responsavelIds.length > 0) responsavelId = responsavelIds[0];
      } catch(e) {}
    }

    processed.push({
      id,
      nome: item.name || '',
      cliente, clientes: clientesAtivos,
      status: colMap['status'] || '—',
      status_color: colStyleMap['status']?.color || '',
      status_updated_at: colStyleMap['status']?.updated_at || '',
      status_border: colStyleMap['status']?.border || '',
      status_index: colStyleMap['status']?.index ?? null,
      formato: colMap[COLUNAS.producao.formato] || '—',
      captacao: colMap[COLUNAS.producao.captacao] || '',
      tipo_conteudo: colMap[COLUNAS.producao.etapa] || '',
      off_audio: colMap['color_mkynd7j8'] || '',
      off_audio_color: colStyleMap['color_mkynd7j8']?.color || '',
      prioridade: colMap['color_mm164yv8'] || '',
      prioridade_color: colStyleMap['color_mm164yv8']?.color || '',
      material_bruto: typeof item.material_bruto === 'string' ? item.material_bruto : null,
      tem_briefing: typeof item.tem_briefing === 'boolean' ? item.tem_briefing : null,
      criado_em: item.criado_em || '', cadastrado_por: item.cadastrado_por || '',
      responsavel: colMap['person'] || '',
      responsavel_id: responsavelId,
      responsavel_ids: responsavelIds,
      veiculacao: fmtDate(veiculacaoIso),
      veiculacao_iso: veiculacaoIso,
      dia_semana: diaSemana,
      prazo: fmtDate(prazoIso),
      prazo_iso: prazoIso,
      prazo_atrasado: prazoAtrasado,
      grupo,
      group_id: groupId,
      url: `/?vybe_item=${id}`,
      status_context: latestStatusContext(item),
      updated_at: item.updated_at || '',
      semana
    });
  }

  return processed;
}

// Versão sem filtro de semana — usada pela aba Clientes
function processItemsAll(rawItems, meta) {
  const weekRanges = meta.weeks || [];
  const processed = [];
  const seen = new Set();
  for (const item of rawItems) {
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const colMap = {}, colValueMap = {}, colStyleMap = {};
    (item.column_values || []).forEach(c => {
      colMap[c.id] = c.text || '';
      colValueMap[c.id] = c.value || '';
      colStyleMap[c.id] = { ...(c.label_style || {}), index: c.index, updated_at: c.updated_at };
    });
    const clienteRaw = colMap[COLUNAS.producao.cliente] || '';
    const clientesAtivos = (Array.isArray(item.clientes) ? item.clientes : clienteRaw.split(',')).map(s=>normalizarCliente(s.trim())).filter(c => c && !clienteDesativado(c));
    // Itens sem cliente não desaparecem: entram como exceção visível para correção de cadastro.
    const cliente = clientesAtivos[0] || 'Sem cliente';
    const veiculacaoStr = colMap[COLUNAS.producao.veiculacao] || '';
    const veiculacaoIso = veiculacaoStr ? veiculacaoStr.slice(0,10) : '';
    const prazoStr = colMap['data'] || '';
    const prazoIso = prazoStr ? prazoStr.slice(0,10) : '';
    const today = meta.today_iso;
    const prazoAtrasado = !!(prazoIso && prazoIso < today && !isFinishedItem({ status: colMap['status'] || '' }));
    const groupId = item.group?.id || '';
    const grupo = GROUP_MAP[groupId] || groupId || '—';
    const fmtDate = d => d ? `${String(new Date(d+'T12:00:00').getDate()).padStart(2,'0')}/${String(new Date(d+'T12:00:00').getMonth()+1).padStart(2,'0')}` : '';
    let responsavelId = '', responsavelIds = [];
    const personValue = colValueMap['person'] || '';
    if (personValue) {
      try {
        const pv = JSON.parse(personValue);
        const arr = pv.personsAndTeams || pv.persons || [];
        responsavelIds = arr.map(p => String(p.id));
        if (responsavelIds.length > 0) responsavelId = responsavelIds[0];
      } catch(e) {}
    }
    const referenceIso = dateMode === 'prazo' ? (prazoIso || veiculacaoIso) : (veiculacaoIso || prazoIso);
    const weekIndex = weekRanges.findIndex(week => referenceIso && referenceIso >= week.startIso && referenceIso <= week.endIso);
    const semana = weekIndex >= 0 ? weekIndex + 1 : null;
    processed.push({
      id, nome: item.name || '', cliente, clientes: clientesAtivos,
      status: colMap['status'] || '—',
      status_color: colStyleMap['status']?.color || '',
      status_updated_at: colStyleMap['status']?.updated_at || '',
      status_border: colStyleMap['status']?.border || '',
      status_index: colStyleMap['status']?.index ?? null,
      formato: colMap[COLUNAS.producao.formato] || '—',
      captacao: colMap[COLUNAS.producao.captacao] || '',
      tipo_conteudo: colMap[COLUNAS.producao.etapa] || '',
      off_audio: colMap['color_mkynd7j8'] || '',
      off_audio_color: colStyleMap['color_mkynd7j8']?.color || '',
      prioridade: colMap['color_mm164yv8'] || '',
      prioridade_color: colStyleMap['color_mm164yv8']?.color || '',
      material_bruto: typeof item.material_bruto === 'string' ? item.material_bruto : null,
      tem_briefing: typeof item.tem_briefing === 'boolean' ? item.tem_briefing : null,
      criado_em: item.criado_em || '', cadastrado_por: item.cadastrado_por || '',
      responsavel: colMap['person'] || '',
      responsavel_id: responsavelId, responsavel_ids: responsavelIds,
      veiculacao: fmtDate(veiculacaoIso), veiculacao_iso: veiculacaoIso,
      prazo: fmtDate(prazoIso), prazo_iso: prazoIso, prazo_atrasado: prazoAtrasado,
      grupo, group_id: groupId,
      url: `/?vybe_item=${id}`,
      status_context: latestStatusContext(item),
      updated_at: item.updated_at || '',
      semana
    });
  }
  return processed;
}

let DADOS_ALL = []; // todos os itens de produção sem filtro de semana
let DIAS_SEMANAS = [[], [], [], []]; // DIAS para cada semana (1-4)
let producaoRefreshRunning = false;

// Padrão Vybe (Paulo, 21/10/2026; regras no AGENTS.md): as peças que as abas
// usam para cabeçalho, resumo e estados. Os textos chegam já em português de
// quem usa; o HTML de ação é do chamador (botões prontos).
const VB_ICONES = {
  vazio: '<path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  erro: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  ok: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16 9.6"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  documento: '<path d="M6.5 3h7.5l4 4v14h-11.5z"/><path d="M14 3v4h4M9.5 12h5M9.5 16h5"/>',
};
// Rótulo depois do número: "3 atrasadas"; sigla continua sigla ("NPS médio").
function vbRotulo(texto) { const t = String(texto || ''); return /^[A-ZÀ-Ý]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1); }
function vbIcone(nome) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${VB_ICONES[nome] || VB_ICONES.vazio}</svg>`; }
// id: o id do título, para a janela que aponta para ele (aria-labelledby). O mesmo cabeçalho serve à página e à janela:
// na janela, o X (vbFecharHtml) é a última ação, na mesma linha do título (quadros 00 Main, 00 Sistema e 29).
function vbCabecalhoHtml({ titulo, texto = '', acoes = '', id = '' }) {
  return `<header class="vb-cabecalho"><div class="vb-cabecalho-texto"><h2${id ? ` id="${safeText(id)}"` : ''}>${safeText(titulo)}</h2>${texto ? `<p>${safeText(texto)}</p>` : ''}</div>${acoes ? `<div class="vb-cabecalho-acoes">${acoes}</div>` : ''}</header>`;
}
// O X das janelas, um desenho só (caixa de 34 px, borda fina): `attr` leva o gancho do módulo (ex. 'data-vp-fechar').
function vbFecharHtml(attr = '', classe = '') {
  return `<button type="button" class="vb-janela-x${classe ? ' ' + classe : ''}" ${attr} aria-label="Fechar" title="Fechar (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
}
// itens: [{ valor, rotulo, tom: 'alerta'|'atencao'|'ok'|'zero'|'', onclick, espiar, dica }]; tom 'zero' = texto discreto.
// espiar: a chave do mini painel (data-espiar, "quem está neste número"); dica: a explicação no ⓘ ao passar o mouse.
function vbResumoHtml(itens) {
  return `<div class="vb-resumo" role="group" aria-label="Resumo">${itens.filter(Boolean).map((x) => {
    const corpo = (x.valor === null || x.valor === undefined || x.valor === '' ? safeText(x.rotulo) : `<b>${safeText(String(x.valor))}</b>${safeText(x.rotulo)}`)
      + (x.dica ? `<span class="ar-dica vb-jogo-dica" tabindex="0" data-dica="${safeText(x.dica)}" aria-label="${safeText(x.dica)}"><span class="ar-dica-i" aria-hidden="true">i</span></span>` : '');
    // Zero não pede ação: perde a cor de estado e vira texto discreto ("0 atrasadas" não é alarme).
    const zero = x.valor === 0 || x.valor === '0';
    const cls = `vb-resumo-item${zero ? ' zero' : (x.tom ? ' ' + x.tom : '')}`;
    if (x.onclick) return `<button type="button" class="${cls}" onclick="${x.onclick}">${corpo}</button>`;
    return x.espiar ? `<span class="${cls} espiavel" data-espiar="${safeText(x.espiar)}" role="button" tabindex="0">${corpo}</span>` : `<span class="${cls}">${corpo}</span>`;
  }).join('')}</div>`;
}
// Seletor de período (Padrão Vybe): ‹ novembro de 2026 › no lugar do campo de mês. O botão leva o mês de destino
// (AAAA-MM) no atributo `attr`, que o módulo escuta; `ano: true` anda de ano em ano. Não passa de `max` (AAAA-MM).
const VB_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function vbMesSomar(mes, n) {
  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function vbMesHtml({ mes, max = '', attr = 'data-vb-mes', ano = false } = {}) {
  if (!/^\d{4}-\d{2}$/.test(mes || '')) return '';
  const passo = ano ? 12 : 1, antes = vbMesSomar(mes, -passo), depois = vbMesSomar(mes, passo), corte = ano ? 4 : 7;
  const fim = /^\d{4}-\d{2}/.test(max) && depois.slice(0, corte) > max.slice(0, corte);
  const nome = ano ? 'ano' : 'mês', seta = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  return `<div class="vb-mes" role="group" aria-label="${ano ? 'Ano' : 'Mês'}">`
    + `<button type="button" ${attr}="${antes}" aria-label="${ano ? 'Ano' : 'Mês'} anterior" title="${ano ? 'Ano' : 'Mês'} anterior">${seta('m15 6-6 6 6 6')}</button>`
    + `<b aria-live="polite">${ano ? mes.slice(0, 4) : `${VB_MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`}</b>`
    + `<button type="button" ${attr}="${depois}" aria-label="Próximo ${nome}" title="Próximo ${nome}"${fim ? ' disabled' : ''}>${seta('m9 6 6 6-6 6')}</button></div>`;
}
// tipo: 'vazio' | 'erro' | 'carregando'; acao: HTML de um botão (opcional).
function vbEstadoHtml({ tipo = 'vazio', titulo = '', texto = '', acao = '', icone = '' } = {}) {
  if (tipo === 'carregando') return `<div class="vb-carregando" role="status" aria-label="${safeText(titulo || 'Carregando')}"><div class="vb-brilho"></div><div class="vb-brilho"></div><div class="vb-brilho"></div></div>`;
  return `<div class="vb-estado ${tipo}" role="${tipo === 'erro' ? 'alert' : 'status'}"><span class="vb-estado-icone">${vbIcone(icone || tipo)}</span>${titulo ? `<b>${safeText(titulo)}</b>` : ''}${texto ? `<p>${safeText(texto)}</p>` : ''}${acao}</div>`;
}
// Escolha em chip (moodboard 10/11/2026, quadros 17, 21, 30, 39, 49 e 61: "select nativo vira o menu do sistema"): um
// chip com o valor atual e um menu de opções. O valor vai num campo escondido (`campo` = os atributos dele, ex.
// 'name="nasc_mes"' ou 'data-vc-filtro="nicho"'), que dispara `change` como o select fazia: os ouvintes de sempre
// (FormData, aoMudar) continuam iguais. opcoes: [{ valor, nome, n? }]; vazio: a opção "todos"/"nenhum" (valor '');
// grade: colunas do menu (o dia do mês usa 7).
function vbEscolhaHtml({ rotulo = '', valor = '', opcoes = [], campo = '', vazio = '', grade = 0 } = {}) {
  const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const v = String(valor ?? ''), atual = opcoes.find((o) => String(o.valor) === v);
  const nomeAtual = atual ? atual.nome : (vazio || 'Escolha');
  const conta = (n) => (n === undefined || n === null || n === '' ? '' : `<em>${e(n)}</em>`);
  const lista = (vazio ? [{ valor: '', nome: vazio }] : []).concat(opcoes);
  return `<details class="vb-escolha"><summary class="vb-chip${atual ? ' vb-escolha-com' : ''}" aria-label="${e(rotulo)}: ${e(nomeAtual)}">${rotulo ? `<span class="vb-escolha-rotulo">${e(rotulo)}</span>` : ''}<b class="vb-escolha-valor">${e(nomeAtual)}</b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>`
    + `<input type="hidden" ${campo} value="${e(v)}">`
    + `<div class="vb-escolha-menu${grade ? ' grade' : ''}" role="listbox" aria-label="${e(rotulo)}"${grade ? ` style="--colunas:${Number(grade) || 1}"` : ''}>${lista.map((o) => `<button type="button" role="option" data-vb-escolha="${e(o.valor)}" aria-selected="${String(o.valor) === v}"><span>${e(o.nome)}</span>${conta(o.n)}</button>`).join('')}</div></details>`;
}
if (typeof window !== 'undefined') { window.vbEscolhaHtml = vbEscolhaHtml; window.vbCabecalhoHtml = vbCabecalhoHtml; window.vbFecharHtml = vbFecharHtml; window.vbMesHtml = vbMesHtml; window.vbResumoHtml = vbResumoHtml; }
// Um menu aberto por vez: a opção grava no campo escondido e avisa (input e change); clicar fora ou Esc fecha.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  const fecharEscolhas = (menos) => document.querySelectorAll('details.vb-escolha[open]').forEach((d) => { if (d !== menos) d.open = false; });
  document.addEventListener('click', (ev) => {
    const op = ev.target?.closest?.('.vb-escolha [data-vb-escolha]'), caixa = ev.target?.closest?.('details.vb-escolha');
    fecharEscolhas(op ? null : caixa);
    if (!op || !caixa) return;
    ev.preventDefault();
    const campo = caixa.querySelector(':scope > input[type=hidden]'), valor = op.dataset.vbEscolha, resumo = caixa.querySelector('summary');
    caixa.querySelectorAll('[data-vb-escolha]').forEach((b) => b.setAttribute('aria-selected', String(b === op)));
    const nome = op.querySelector('span')?.textContent || '', alvo = caixa.querySelector('.vb-escolha-valor'); if (alvo) alvo.textContent = nome;
    resumo?.setAttribute('aria-label', `${caixa.querySelector('[role=listbox]')?.getAttribute('aria-label') || ''}: ${nome}`);
    resumo?.classList.toggle('vb-escolha-com', valor !== '');
    resumo?.focus?.();
    if (campo && campo.value !== valor) { campo.value = valor; campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  // Na captura, antes das janelas: Esc com o menu aberto fecha só o menu.
  window.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const aberto = document.querySelector('details.vb-escolha[open]'); if (!aberto) return;
    ev.preventDefault(); ev.stopImmediatePropagation(); aberto.open = false; aberto.querySelector('summary')?.focus?.();
  }, true);
}
// Números que contam (Padrão Vybe): um <b data-vb-contar="463" data-vb-chave="moedas">
// sobe ou desce contando do último valor visto até o novo, como placar de
// jogo. Na primeira vez só guarda o valor; "Reduzir movimento" pula a conta.
function vbAnimarContagens(raiz = document) {
  const parado = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for (const el of raiz.querySelectorAll('[data-vb-contar][data-vb-chave]')) {
    const novo = Number(el.dataset.vbContar), chave = 'vb-contar:' + el.dataset.vbChave;
    if (!Number.isFinite(novo)) continue;
    let antes = null;
    try { const v = sessionStorage.getItem(chave); antes = v === null ? null : Number(v); sessionStorage.setItem(chave, String(novo)); } catch {}
    if (parado || antes === null || !Number.isFinite(antes) || antes === novo) continue;
    const inicio = performance.now(), dur = Math.min(900, 350 + Math.abs(novo - antes) * 8);
    el.classList.add('vb-contando');
    const passo = (t) => {
      const p = Math.min(1, (t - inicio) / dur), suave = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(antes + (novo - antes) * suave).toLocaleString('pt-BR');
      if (p < 1 && el.isConnected) requestAnimationFrame(passo); else el.classList.remove('vb-contando');
    };
    el.textContent = antes.toLocaleString('pt-BR');
    requestAnimationFrame(passo);
  }
}
