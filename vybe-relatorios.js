// vybe-relatorios.js — diário de produção, performance e departamentos
// "1 item", "2 itens" (Paulo, 21/10/2026: o painel mostrava "1 itens").
function qtdItens(n) { return `${n} ${Number(n) === 1 ? 'item' : 'itens'}`; }
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Diário de Produção ────────────────────────────────────────────────────────────────────────────────
const DIARIO_KEY = 'vybe_diario_snapshots_v1';
const DIARIO_MAX = 30;
let diarioSnapshotAtivo = null;
let diarioPersonFilter = 'all';
let diarioDateMode = 'veiculacao'; // 'veiculacao' ou 'prazo'
let diarioSnapshots = [];
let diarioSnapshotsCarregados = false;

function normalizarSnapshotDiario(row) {
  const payload = row?.payload || {};
  const quando = new Date(row?.atualizado_em || row?.criado_em || `${row?.data_referencia || new Date().toISOString().slice(0,10)}T12:00:00`);
  const dataHora = quando.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).replace(',', ' às');
  return {
    ...row, id: Number(row?.id), dataHora, quando: quando.getTime(),
    total: Number(payload?.conteudos?.ativos ?? payload?.conteudos?.total ?? payload?.itens?.length ?? 0),
    itens: Array.isArray(payload?.itens) ? payload.itens : [],
    temItens: Array.isArray(payload?.itens),
  };
}

// ─── Diário no padrão v2 (quadro "Diário de produção" do moodboard aprovado em 12/11/2026) ───────────────────
// A tela inteira sai daqui: a fala do Heitor, três números, a linha do tempo dos registros (a linha abre no lugar)
// e "O que mudou" entre o registro escolhido e o anterior. Tudo é contado nas peças que cada registro guardou
// (status, datas e clientes); a lista vem sem as peças, então os registros à vista são abertos um a um.
const DIARIO_VISIVEIS = 4;
const DIARIO_ETAPAS = 6;
const DIARIO_PRONTO = ['finalizado', 'agendado', 'para agendar'];
const DIARIO_ORIGEM = { manual_painel: 'Pelo painel', cron: 'Automático', servico: 'VYBES', resumo_manha: 'Resumo da manhã' };
const DIARIO_CERTO = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
const DIARIO_PESSOA = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
const DIARIO_PE = '<p class="v2d-sub">Um registro guarda como os conteúdos estão naquele momento, para comparar com outro dia. Veiculação ou Prazo escolhe a data que conta.</p>';
let diarioLista = [];
let diarioComparado = null;   // registro que os números, a fala e "O que mudou" mostram; sem escolha, o mais novo
let diarioAberto;             // linha aberta no lugar; sem escolha, a do registro comparado
let diarioTodos = false;
let diarioEtapasTodas = false;

function diarioEsc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function diarioFmt(n) { return Number(n || 0).toLocaleString('pt-BR'); }
function diarioSinal(n) { return n > 0 ? `+${diarioFmt(n)}` : n < 0 ? `−${diarioFmt(-n)}` : '0'; }
function diarioIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function diarioQuando(s) {
  if (Number.isFinite(s?.quando)) return new Date(s.quando);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\D+(\d{2}):(\d{2}))?/.exec(String(s?.dataHora || ''));
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 12), +(m[5] || 0)) : null;
}
function diarioTemItens(s) { return Boolean(s && (s.temItens || (Array.isArray(s.itens) && s.itens.length))); }
function diarioPronto(d) { return DIARIO_PRONTO.includes(String(d?.status || '').trim().toLowerCase()); }
function diarioDataRef(d, modo) { return modo === 'prazo' ? (d.prazo_iso || d.veiculacao_iso || '') : (d.veiculacao_iso || d.prazo_iso || ''); }
function diarioNomeData(modo = diarioDateMode) { return modo === 'prazo' ? 'do prazo' : 'da data de veiculação'; }

// Os números de um registro. Pronta = Finalizado, Agendado ou Para agendar; "da semana" = com a data (veiculação ou
// prazo, a que estiver escolhida) na semana do registro. Atrasada = não pronta, com essa data antes do dia do registro.
function diarioNumeros(snap, modo = diarioDateMode) {
  if (!diarioTemItens(snap)) return null;
  const q = diarioQuando(snap) || new Date();
  const dia = diarioIso(q);
  const seg = new Date(q.getFullYear(), q.getMonth(), q.getDate() - ((q.getDay() + 6) % 7));
  const ini = diarioIso(seg), fim = diarioIso(new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + 6));
  const etapas = {}, pronta = new Set(), atrasada = new Set(), alt = new Set();
  let prontas = 0;
  for (const d of snap.itens) {
    const ref = diarioDataRef(d, modo), id = String(d.id);
    if (diarioPronto(d)) { pronta.add(id); if (ref >= ini && ref <= fim) prontas++; continue; }
    const st = String(d.status || '').trim() || 'Sem status';
    etapas[st] = (etapas[st] || 0) + 1;
    if (ref && ref < dia) atrasada.add(id);
    if (/altera/i.test(st)) alt.add(id);
  }
  return { dia, prontas, atrasadas: atrasada.size, alteracao: alt.size, etapas, pronta, atrasada, alt };
}

// O que mudou de um registro para o seguinte, peça por peça.
function diarioMudanca(ant, atual, modo = diarioDateMode) {
  const a = diarioNumeros(ant, modo), b = diarioNumeros(atual, modo);
  if (!a || !b) return null;
  const antes = new Set(ant.itens.map((d) => String(d.id)));
  const prontas = [], passaram = [], voltaram = [];
  for (const d of atual.itens) {
    const id = String(d.id);
    if (b.pronta.has(id)) { if (antes.has(id) && !a.pronta.has(id)) prontas.push(d); continue; }
    if (b.atrasada.has(id) && !a.atrasada.has(id)) passaram.push(d);
    if (b.alt.has(id) && antes.has(id) && !a.alt.has(id)) voltaram.push(d);
  }
  return { a, b, prontas, passaram, voltaram };
}

// As etapas de "O que mudou", na ordem do catálogo de status, com Prontas no fim.
function diarioEtapas(m) {
  const catalogo = (typeof STATUS_OPTIONS !== 'undefined' && Array.isArray(STATUS_OPTIONS) ? STATUS_OPTIONS : []).map((o) => String(o?.label || '').trim().toLowerCase());
  const pos = (n) => { const i = catalogo.indexOf(n.toLowerCase()); return i < 0 ? 999 : i; };
  const nomes = [...new Set([...Object.keys(m.b.etapas), ...Object.keys(m.a.etapas)])];
  const linhas = nomes.map((nome) => ({ nome, n: m.b.etapas[nome] || 0, dif: (m.b.etapas[nome] || 0) - (m.a.etapas[nome] || 0) }))
    .sort((x, y) => pos(x.nome) - pos(y.nome) || y.n - x.n || x.nome.localeCompare(y.nome));
  linhas.push({ nome: 'Prontas', n: m.b.prontas, dif: m.prontas.length, pronta: true });
  return linhas;
}
function diarioCorEtapa(nome, pronta) {
  if (pronta) return 'g';
  const n = String(nome).toLowerCase();
  if (/altera|pode fazer|falta|aguard|^ag\./.test(n)) return 'a';
  if (/aprova|andamento|execu|agend/.test(n)) return 'b';
  return 'n';
}

function diarioDiaCurto(q) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dif = Math.round((hoje - new Date(q.getFullYear(), q.getMonth(), q.getDate())) / 864e5);
  return dif === 0 ? 'hoje' : dif === 1 ? 'ontem' : q.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function diarioHora(q) { return q.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
// "das 09:05" quando os dois registros são do mesmo dia; senão "de ontem", "de 10/11".
function diarioDe(s, outro) {
  const q = diarioQuando(s), o = outro ? diarioQuando(outro) : null;
  if (!q) return '';
  return o && diarioIso(q) === diarioIso(o) ? `das ${diarioHora(q)}` : `de ${diarioDiaCurto(q)}`;
}
function diarioRotuloDia(q) {
  const semana = q.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', ''), data = q.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const curto = diarioDiaCurto(q);
  return curto === 'hoje' || curto === 'ontem' ? `${curto.charAt(0).toUpperCase()}${curto.slice(1)} · ${semana}, ${data}` : `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${data}`;
}
function diarioClienteDe(d) { return (Array.isArray(d?.clientes) && d.clientes[0]) || String(d?.cliente || '').split(',')[0].trim() || 'Sem cliente'; }
function diarioClientesHtml(itens) {
  const conta = {};
  itens.forEach((d) => { const c = diarioClienteDe(d); conta[c] = (conta[c] || 0) + 1; });
  const ordem = Object.entries(conta).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  const cor = (nome) => (typeof corDoClienteV2 === 'function' ? corDoClienteV2(nome) : '#6B665E');
  const tres = ordem.slice(0, 3).map(([nome, n]) => `<span class="v2d-cli" style="--c:${cor(nome)}">${diarioEsc(nome)}</span> ${diarioFmt(n)}`).join(', ');
  return ordem.length > 3 ? `${tres} e mais ${diarioFmt(ordem.length - 3)}` : tres;
}
// O retrato que o próprio registro guardou (payload.conteudos): ativos, sem data e com o prazo já passado. O prazo
// passado conta peça de qualquer status, finalizada inclusive, então não é chamado de "atrasado".
function diarioRetratoTexto(s) {
  const c = s?.payload?.conteudos || {};
  const ativos = Number(c.ativos ?? s?.total), semData = Number(c.sem_data), passado = Number(c.prazo_passado);
  if (!Number.isFinite(ativos)) return '';
  const base = `${diarioFmt(ativos)} ${ativos === 1 ? 'conteúdo ativo' : 'conteúdos ativos'}`;
  return [semData, passado].every(Number.isFinite) ? `${base}, ${diarioFmt(semData)} sem data, ${diarioFmt(passado)} com o prazo já passado (de qualquer status)` : base;
}

// O cabeçalho vem do index.html: aqui o alternador vira a pílula clara do quadro (a escolhida em branco) e o botão
// de registrar passa a ser a ação da tela, com as classes desta tela.
function diarioCabecalho() {
  const barra = document.getElementById('date-mode-bar-diario');
  if (!barra) return;
  barra.classList.remove('date-mode-bar');
  barra.classList.add('v2d-seg');
  barra.setAttribute('role', 'radiogroup');
  barra.setAttribute('aria-label', 'Data que conta');
  barra.querySelectorAll('button').forEach((b) => {
    b.type = 'button';
    b.classList.remove('date-mode-btn', 'active');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(b.id === `diario-mode-${diarioDateMode}`));
  });
  const botao = diarioBotao();
  if (botao) { botao.classList.remove('vb-botao', 'principal'); botao.classList.add('v2d-acao', 'v2-estado'); }
}

function diarioBotao() { return document.querySelector('#painel-diario .vb-cabecalho-acoes > button[onclick^="salvarSnapshot"]'); }

function setDiarioDateMode(mode) {
  diarioDateMode = mode === 'prazo' ? 'prazo' : 'veiculacao';
  diarioCabecalho();
  if (diarioSnapshotAtivo) renderDiarioDetalhe(diarioSnapshotAtivo);
  else diarioPintar();
}

// O botão conta o estado: gira enquanto grava e fica verde, "Registrado", quando o registro entra.
function diarioBotaoEstado(estado) {
  const botao = diarioBotao();
  if (!botao) return null;
  if (estado) botao.dataset.estado = estado; else delete botao.dataset.estado;
  botao.innerHTML = estado === 'feito' ? `${DIARIO_CERTO}Registrado` : 'Registrar agora';
  return botao;
}

async function salvarSnapshot() {
  if (diarioBotao()?.dataset.estado) return;
  diarioBotaoEstado('indo');
  try {
    const resposta = await fetch('/api/painel?area=diario', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' }, body:'{}' });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados?.error || `Falha ao salvar (${resposta.status})`);
    diarioSnapshotsCarregados = false;
    diarioComparado = null;
    diarioAberto = undefined;
    diarioBotaoEstado('feito');
    setTimeout(() => diarioBotaoEstado(''), 1800);
    showToast('Registro do dia salvo.', 'ok');
    await renderDiarioLista(true);
  } catch (erro) {
    diarioBotaoEstado('');
    showToast(`Não foi possível salvar o registro: ${erro.message}`, 'err', 6000);
  }
}

async function carregarSnapshots(forcar=false) {
  if (diarioSnapshotsCarregados && !forcar) return diarioSnapshots;
  const resposta = await fetch(`/api/painel?area=diario&limite=${DIARIO_MAX}`, { credentials:'same-origin', cache:'no-store' });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.error || `Falha ao carregar (${resposta.status})`);
  // As peças já abertas continuam na mão: a lista do servidor vem sem elas.
  const abertos = new Map(diarioSnapshots.filter((s) => s.temItens).map((s) => [`${s.id}|${s.atualizado_em}`, s]));
  diarioSnapshots = (dados.snapshots || []).map(normalizarSnapshotDiario).map((s) => abertos.get(`${s.id}|${s.atualizado_em}`) || s);
  diarioSnapshotsCarregados = true;
  return diarioSnapshots;
}

// Abre as peças dos registros pedidos (os que ainda vieram sem elas). Quem falhar fica marcado e não é pedido de novo.
async function diarioGarantirItens(registros) {
  const faltam = registros.filter((s) => s && !diarioTemItens(s) && !s.semItens && Number.isFinite(Number(s.id)));
  await Promise.all(faltam.map(async (s) => {
    let novo = null;
    try {
      const resposta = await fetch(`/api/painel?area=diario&id=${encodeURIComponent(s.id)}`, { credentials:'same-origin', cache:'no-store' });
      const dados = await resposta.json();
      if (resposta.ok && dados?.snapshot) novo = normalizarSnapshotDiario(dados.snapshot);
    } catch { novo = null; }
    if (!novo) { s.semItens = true; return; }
    const troca = (x) => (Number(x.id) === Number(s.id) ? novo : x);
    diarioSnapshots = diarioSnapshots.map(troca);
    diarioLista = diarioLista.map(troca);
  }));
}
function diarioPrecisos() {
  const i = Math.max(0, diarioLista.findIndex((s) => Number(s.id) === Number(diarioComparado)));
  const ate = diarioTodos ? diarioLista.length : DIARIO_VISIVEIS + 1;
  return [...diarioLista.slice(0, ate), diarioLista[i], diarioLista[i + 1]];
}

async function renderDiarioLista(forcar=false) {
  let lista = [];
  try { lista = await carregarSnapshots(forcar); }
  catch (erro) {
    const legado = (() => { try { return JSON.parse(localStorage.getItem(DIARIO_KEY) || '[]'); } catch { return []; } })();
    lista = Array.isArray(legado) ? legado : [];
    showToast(`Diário central indisponível: ${erro.message}`, 'err', 5000);
  }
  const el = document.getElementById('diario-snapshots-list');
  if (!el) return;
  document.getElementById('diario-lista').style.display = 'block';
  document.getElementById('diario-detalhe').style.display = 'none';
  diarioCabecalho();
  diarioLista = lista;
  if (lista.length && !el.querySelector('.v2d-dois') && typeof vbEstadoHtml === 'function') el.innerHTML = vbEstadoHtml({ tipo: 'carregando', titulo: 'Abrindo os registros' });
  if (lista.length) await diarioGarantirItens(diarioPrecisos());
  diarioPintar();
}

function diarioComparar(id) {
  diarioComparado = Number(id);
  diarioAberto = Number(id);
  diarioEtapasTodas = false;
  diarioGarantirItens(diarioPrecisos()).then(diarioPintar);
}
// A linha abre no lugar, sem redesenhar a tela.
function diarioAbrirLinha(id) {
  diarioAberto = Number(diarioAberto) === Number(id) ? null : Number(id);
  document.querySelectorAll('#diario-snapshots-list .v2d-reg').forEach((linha) => {
    const aberta = Number(linha.dataset.registro) === Number(diarioAberto);
    linha.setAttribute('aria-expanded', String(aberta));
    linha.querySelector('.v2d-quem')?.setAttribute('aria-expanded', String(aberta));
  });
}
function diarioMostrarTodos(sim) {
  diarioTodos = Boolean(sim);
  diarioPintar();
  if (diarioTodos) diarioGarantirItens(diarioPrecisos()).then(diarioPintar);
}
function diarioMostrarEtapas(sim) { diarioEtapasTodas = Boolean(sim); diarioPintar(); }

function diarioFalaHtml(atual, ant, m) {
  const n = diarioNumeros(atual);
  let frase;
  if (!n) frase = `Não deu para abrir as peças deste registro. ${diarioEsc(diarioRetratoTexto(atual))}.`;
  else if (!ant) frase = `Este é o primeiro registro guardado: <b>${diarioFmt(n.prontas)} ${n.prontas === 1 ? 'pronta' : 'prontas'} na semana</b>, ${diarioFmt(n.atrasadas)} ${n.atrasadas === 1 ? 'atrasada' : 'atrasadas'} e ${diarioFmt(n.alteracao)} em alteração. O próximo registro mostra o que mudou.`;
  else if (!m) frase = `Não deu para abrir o registro anterior para comparar. Neste, <b>${diarioFmt(n.prontas)} ${n.prontas === 1 ? 'pronta' : 'prontas'} na semana</b>, ${diarioFmt(n.atrasadas)} ${n.atrasadas === 1 ? 'atrasada' : 'atrasadas'} e ${diarioFmt(n.alteracao)} em alteração.`;
  else {
    const p = m.prontas.length, a = m.passaram.length;
    const prontas = p === 0 ? 'nenhuma peça ficou pronta' : p === 1 ? '1 peça ficou pronta' : `${diarioFmt(p)} peças ficaram prontas`;
    const passou = a === 0 ? `nenhuma passou ${diarioNomeData()}` : a === 1 ? `1 passou ${diarioNomeData()}` : `${diarioFmt(a)} passaram ${diarioNomeData()}`;
    const cresceu = diarioEtapas(m).filter((e) => !e.pronta && e.dif > 0).sort((x, y) => y.dif - x.dif)[0];
    frase = `Do registro ${diarioDe(ant, atual)} para o ${diarioDe(atual, ant)}, <b>${prontas}</b> e <b>${passou}</b>.${cresceu ? ` A etapa que mais cresceu foi ${diarioEsc(cresceu.nome)}: de ${diarioFmt(cresceu.n - cresceu.dif)} para ${diarioFmt(cresceu.n)}.` : ''}`;
  }
  return `<div class="v2d-card v2d-fala"><span class="v2d-ag" aria-hidden="true">H</span><p><span class="v2d-quem-fala">Heitor · Coordenação de produção</span>${frase}</p></div>`;
}

function diarioNumerosHtml(atual, ant) {
  const n = diarioNumeros(atual), a = ant ? diarioNumeros(ant) : null;
  const eram = (v) => (a ? `${v === 1 ? 'era' : 'eram'} ${diarioFmt(v)} no registro ${diarioDe(ant, atual)}` : n ? 'primeiro registro guardado' : 'sem as peças deste registro');
  const cartao = (rotulo, chave, cls, atraso) => `<div class="v2d-card v2d-kpi${cls ? ` ${cls}` : ''}"><small>${rotulo}</small><b><span class="v2-num"${atraso ? ` style="animation-delay:${atraso}"` : ''}>${n ? diarioFmt(n[chave]) : '·'}</span></b><small>${eram(a ? a[chave] : 0)}</small></div>`;
  return `<div class="v2d-tres">${cartao('Prontas da semana', 'prontas', '', '')}${cartao('Atrasadas', 'atrasadas', 'ruim', '.12s')}${cartao('Em alteração', 'alteracao', 'atencao', '.24s')}</div>`;
}

function diarioRegistroHtml(s, ant, comparado) {
  const q = diarioQuando(s), n = diarioNumeros(s), m = ant ? diarioMudanca(ant, s) : null;
  const origem = DIARIO_ORIGEM[s.origem] || '';
  const avatar = s.origem && s.origem !== 'manual_painel' ? 'VY' : DIARIO_PESSOA;
  const cer = n ? `${diarioFmt(n.prontas)} ${n.prontas === 1 ? 'pronta' : 'prontas'} · ${diarioFmt(n.atrasadas)} ${n.atrasadas === 1 ? 'atrasada' : 'atrasadas'} · ${diarioFmt(n.alteracao)} em alteração` : diarioRetratoTexto(s).split(',')[0];
  let selo = '';
  if (m) {
    const p = m.prontas.length, dA = m.b.atrasadas - m.a.atrasadas;
    selo = p > 0 ? `<span class="v2d-pill g">+${diarioFmt(p)} ${p === 1 ? 'pronta' : 'prontas'}</span>`
      : dA > 0 ? `<span class="v2d-pill r">+${diarioFmt(dA)} ${dA === 1 ? 'atrasada' : 'atrasadas'}</span>`
      : dA < 0 ? `<span class="v2d-pill g">${diarioSinal(dA)} ${dA === -1 ? 'atrasada' : 'atrasadas'}</span>`
      : '<span class="v2d-pill n">igual</span>';
  }
  const hist = [];
  if (m) {
    const p = m.prontas.length, a = m.passaram.length, v = m.voltaram.length;
    if (p) hist.push(`<span>${p === 1 ? '1 ficou pronta' : `${diarioFmt(p)} ficaram prontas`}: ${diarioClientesHtml(m.prontas)}</span>`);
    if (a) hist.push(`<span>${a === 1 ? '1 passou' : `${diarioFmt(a)} passaram`} ${diarioNomeData()}: ${diarioClientesHtml(m.passaram)}</span>`);
    if (v) hist.push(`<span>${v === 1 ? '1 voltou' : `${diarioFmt(v)} voltaram`} para Alteração</span>`);
    if (!hist.length) hist.push('<span>Nada mudou desde o registro anterior.</span>');
  } else if (!ant) hist.push('<span>Primeiro registro guardado.</span>');
  const retrato = diarioRetratoTexto(s);
  if (retrato) hist.push(`<span>${diarioEsc(retrato)}</span>`);
  const aberta = Number(diarioAberto) === Number(s.id);
  const id = Number(s.id);
  return `<div class="v2-abre v2d-reg" data-registro="${id}" aria-expanded="${aberta}">
    <div class="v2d-lin"><i class="v2d-pt${comparado ? ' on' : ''}" aria-hidden="true"></i><span class="v2d-av" aria-hidden="true">${avatar}</span>
      <button type="button" class="v2d-quem" aria-expanded="${aberta}" onclick="diarioAbrirLinha(${id})"><span><b>${q ? diarioHora(q) : diarioEsc(s.dataHora || '')}</b>${origem ? ` · ${origem}` : ''}</span><small>${diarioEsc(cer)}</small></button>
      ${selo}<button type="button" class="v2d-btn" onclick="diarioComparar(${id})">Comparar</button></div>
    <div class="v2-mais"><div>
      ${hist.map((h) => `<p class="v2d-hist">${h}</p>`).join('')}
      <p class="v2d-hist v2d-acoes"><span><button type="button" class="v2d-link" onclick="abrirSnapshot(${id})">Ver as peças</button> · <button type="button" class="v2d-link" onclick="excluirSnapshot(${id})">Apagar registro</button></span></p>
    </div></div>
  </div>`;
}

function diarioRegistrosHtml(lista, atual) {
  const visiveis = diarioTodos ? lista : lista.slice(0, DIARIO_VISIVEIS);
  let dia = '';
  const linhas = visiveis.map((s, i) => {
    const q = diarioQuando(s), rotulo = q ? diarioRotuloDia(q) : '';
    const cab = rotulo && rotulo !== dia ? `<p class="v2d-dl">${rotulo}</p>` : '';
    dia = rotulo || dia;
    return cab + diarioRegistroHtml(s, lista[i + 1] || null, s === atual);
  }).join('');
  const resto = lista.length - DIARIO_VISIVEIS;
  const pe = resto <= 0 ? '' : diarioTodos
    ? '<p class="v2d-pe"><button type="button" class="v2d-link" onclick="diarioMostrarTodos(false)">Mostrar menos</button></p>'
    : `<p class="v2d-pe">+ ${diarioFmt(resto)} ${resto === 1 ? 'registro' : 'registros'} · <button type="button" class="v2d-link" onclick="diarioMostrarTodos(true)">mostrar</button></p>`;
  return `<section class="v2d-card v2d-registros" aria-label="Registros">
    <div class="v2d-topo"><h3>Registros</h3><small>${diarioFmt(lista.length)} ${lista.length === 1 ? 'guardado' : 'guardados'} · o mais novo em cima</small></div>
    <div class="v2d-tl">${linhas}</div>${pe}
  </section>`;
}

function diarioMudouHtml(atual, ant, m) {
  const qa = diarioQuando(atual), qb = ant ? diarioQuando(ant) : null;
  const entre = !qa || !qb ? '' : diarioIso(qa) === diarioIso(qb) ? `${diarioDiaCurto(qa)}, ${diarioHora(qb)} → ${diarioHora(qa)}` : `${diarioDiaCurto(qb)} → ${diarioDiaCurto(qa)}`;
  let corpo;
  if (!ant) corpo = '<p class="v2d-nada">Com dois registros guardados, as etapas aparecem aqui lado a lado.</p>';
  else if (!m) corpo = '<p class="v2d-nada">Não deu para abrir as peças destes dois registros.</p>';
  else {
    const todas = diarioEtapas(m);
    let visiveis = todas;
    if (!diarioEtapasTodas && todas.length > DIARIO_ETAPAS) {
      const escolha = new Set([...todas].sort((x, y) => (y.pronta ? 1 : 0) - (x.pronta ? 1 : 0) || (y.dif ? 1 : 0) - (x.dif ? 1 : 0) || y.n - x.n).slice(0, DIARIO_ETAPAS));
      visiveis = todas.filter((e) => escolha.has(e));
    }
    const maior = Math.max(1, ...todas.map((e) => e.n));
    const linhas = visiveis.map((e) => {
      const subiu = e.dif > 0 && (e.pronta || /altera/i.test(e.nome));
      const cor = e.pronta ? '#11613A' : subiu ? '#9A5B00' : '#1F1D1A';
      return `<div class="v2d-et"><span><span class="v2d-pill ${diarioCorEtapa(e.nome, e.pronta)}" title="${diarioEsc(e.nome)}">${diarioEsc(e.nome)}</span></span><div class="v2-barra"><i style="--v:${Math.round((e.n / maior) * 100)}%;--c:${cor}"></i></div><b>${diarioFmt(e.n)}</b><span class="v2d-dt${subiu ? (e.pronta ? ' g' : ' a') : ''}">${diarioSinal(e.dif)}</span></div>`;
    }).join('');
    const fora = todas.filter((e) => !visiveis.includes(e));
    const pe = fora.length
      ? `<p class="v2d-pe">+ ${fora.length === 1 ? 'outra etapa' : `outras ${fora.length} etapas`}${fora.some((e) => e.dif) ? '' : ', sem mudança'} · <button type="button" class="v2d-link" onclick="diarioMostrarEtapas(true)">mostrar</button></p>`
      : diarioEtapasTodas && todas.length > DIARIO_ETAPAS ? '<p class="v2d-pe"><button type="button" class="v2d-link" onclick="diarioMostrarEtapas(false)">Mostrar menos</button></p>' : '';
    corpo = `<div class="v2d-ets">${linhas}</div>${pe}`;
  }
  return `<section class="v2d-card v2d-mudou" aria-label="O que mudou">
    <div class="v2d-topo"><h3>O que mudou</h3>${entre ? `<small>${entre}</small>` : ''}</div>${corpo}
  </section>`;
}

function diarioPintar() {
  const el = document.getElementById('diario-snapshots-list');
  if (!el) return;
  const lista = diarioLista;
  if (!lista.length) {
    el.innerHTML = `<div class="v2d"><div class="v2d-card v2d-vazio" role="status"><p>Nenhum registro salvo ainda.</p></div>${DIARIO_PE}</div>`;
    return;
  }
  let i = lista.findIndex((s) => Number(s.id) === Number(diarioComparado));
  if (i < 0) i = 0;
  const atual = lista[i], ant = lista[i + 1] || null;
  if (diarioAberto === undefined) diarioAberto = Number(atual.id);
  const m = ant ? diarioMudanca(ant, atual) : null;
  el.innerHTML = `<div class="v2d">${diarioFalaHtml(atual, ant, m)}${diarioNumerosHtml(atual, ant)}<div class="v2d-dois">${diarioRegistrosHtml(lista, atual)}${diarioMudouHtml(atual, ant, m)}</div>${DIARIO_PE}</div>`;
}

async function abrirSnapshot(id) {
  let snap = diarioSnapshots.find(s => Number(s.id) === Number(id));
  if (!snap) return;
  try {
    if (!snap.itens?.length) {
      const resposta = await fetch(`/api/painel?area=diario&id=${encodeURIComponent(id)}`, { credentials:'same-origin', cache:'no-store' });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados?.error || `Falha ao abrir (${resposta.status})`);
      snap = normalizarSnapshotDiario(dados.snapshot);
      diarioSnapshots = diarioSnapshots.map((s) => Number(s.id) === Number(id) ? snap : s);
    }
  } catch (erro) {
    showToast(`Não foi possível abrir o snapshot: ${erro.message}`, 'err', 6000);
    return;
  }
  diarioSnapshotAtivo = snap;
  diarioPersonFilter = 'all';
  document.getElementById('diario-lista').style.display = 'none';
  document.getElementById('diario-detalhe').style.display = 'block';
  document.getElementById('diario-detalhe-titulo').textContent = `${snap.dataHora} — ${qtdItens(snap.total)}`;
  renderDiarioPersonFilter(snap);
  renderDiarioDetalhe(snap);
}

function voltarDiarioLista() {
  diarioSnapshotAtivo = null;
  renderDiarioLista();
}

function renderDiarioPersonFilter(snap) {
  const bar = document.getElementById('diario-person-filter');
  if (!bar) return;
  // Coletar pessoas presentes no snapshot
  const activePeople = new Set();
  snap.itens.forEach(d => {
    if (d.responsavel_ids && d.responsavel_ids.length > 0) d.responsavel_ids.forEach(id => activePeople.add(id));
    else if (d.responsavel_id) activePeople.add(d.responsavel_id);
  });
  bar.innerHTML = '';
  // Chip Todos
  const allWrap = document.createElement('div');
  allWrap.className = 'person-wrap';
  allWrap.onclick = () => { diarioPersonFilter='all'; renderDiarioDetalhe(snap); document.querySelectorAll('#diario-person-filter .person-chip').forEach(c=>c.classList.remove('active')); allWrap.querySelector('.person-chip').classList.add('active'); };
  const allChip = document.createElement('span');
  allChip.className = 'person-chip active';
  allChip.style.background = '#6b7280';
  allChip.textContent = 'Todos';
  allWrap.appendChild(allChip);
  bar.appendChild(allWrap);
  // Chips por pessoa
  TEAM_USERS.forEach(u => {
    if (!activePeople.has(u.id)) return;
    const wrap = document.createElement('div');
    wrap.className = 'person-wrap';
    wrap.onclick = () => {
      diarioPersonFilter = u.id;
      renderDiarioDetalhe(snap);
      document.querySelectorAll('#diario-person-filter .person-chip').forEach(c=>c.classList.remove('active'));
      wrap.querySelector('.person-chip').classList.add('active');
    };
    const chip = document.createElement('span');
    chip.className = 'person-chip';
    chip.style.background = u.color;
    chip.style.color = '#fff';
    chip.textContent = u.name;
    wrap.appendChild(chip);
    bar.appendChild(wrap);
  });
}

function renderDiarioDetalhe(snap) {
  const el = document.getElementById('diario-detalhe-content');
  if (!el) return;
  let itens = snap.itens;
  // Filtro por pessoa
  if (diarioPersonFilter !== 'all') {
    itens = itens.filter(d => (d.responsavel_ids && d.responsavel_ids.includes(diarioPersonFilter)) || d.responsavel_id === diarioPersonFilter);
  }
  // Agrupar por responsavel
  const porResp = {};
  itens.forEach(d => {
    const nome = firstName(d.responsavel) || '—';
    if (!porResp[nome]) porResp[nome] = [];
    porResp[nome].push(d);
  });
  // Buscar status atual para comparar
  const statusAtual = {};
  const respAtual = {};
  DADOS.forEach(d => { statusAtual[d.id] = d.status; respAtual[d.id] = d.responsavel; });
  const html = Object.entries(porResp).sort((a,b)=>a[0].localeCompare(b[0])).map(([resp, items]) => {
    const rows = items.sort((a,b)=>{
      const da = diarioDateMode === 'prazo' ? (a.prazo_iso||a.veiculacao_iso||'') : (a.veiculacao_iso||a.prazo_iso||'');
      const db = diarioDateMode === 'prazo' ? (b.prazo_iso||b.veiculacao_iso||'') : (b.veiculacao_iso||b.prazo_iso||'');
      return da.localeCompare(db);
    }).map(d => {
      const statusNow = statusAtual[d.id];
      const respNow   = respAtual[d.id];
      const statusMudou = statusNow && statusNow !== d.status;
      const respMudou   = respNow   && respNow   !== d.responsavel;
      const statusHtml = statusMudou
        ? `<span style="text-decoration:line-through;opacity:.5;">${pillHtml(d.status)}</span> <span style="color:#4ade80;">→</span> ${pillHtml(statusNow)} <span style="background:#4ade80;color:#000;font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700;">Mudou</span>`
        : pillHtml(d.status);
      const respHtml = respMudou
        ? `<span style="text-decoration:line-through;opacity:.5;">${firstName(d.responsavel)}</span> <span style="color:#fbbf24;">→ ${firstName(respNow)}</span>`
        : `<span>${firstName(d.responsavel)}</span>`;
      const dataExib = diarioDateMode === 'prazo' ? (d.prazo || d.veiculacao || '—') : (d.veiculacao || d.prazo || '—');
      const dataLabel = diarioDateMode === 'prazo'
        ? (d.prazo ? `${d.prazo}` : (d.veiculacao ? `${d.veiculacao}` : '—'))
        : (d.veiculacao ? `${d.veiculacao}` : (d.prazo ? `${d.prazo}` : '—'));
      return `<div class="item-row">
        <span class="item-date">${dataLabel}</span>
        ${fmtHtml(d.formato)}
        <span class="item-name"><button type="button" class="item-workspace-link" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da demanda">${safeText(d.cliente)} — ${safeText(d.nome)}</button></span>
        <span>${statusHtml}</span>
        <span class="item-resp">${respHtml}</span>
      </div>`;
    }).join('');
    return `<div class="client-card alert-ok" style="margin-bottom:12px;">
      <div class="client-header">
        <div class="client-name">${resp}</div>
        <span class="posts-count ok">${items.length} item${items.length!==1?'s':''}</span>
      </div>
      <div class="item-list">${rows}</div>
    </div>`;
  }).join('');
  el.innerHTML = html || '<div style="color:var(--text-muted);padding:20px 0;">Nenhum item para exibir.</div>';
}

async function excluirSnapshot(id) {
  try {
    const resposta = await fetch(`/api/painel?area=diario&id=${encodeURIComponent(id)}`, { method:'DELETE', credentials:'same-origin' });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados?.error || `Falha ao excluir (${resposta.status})`);
    diarioSnapshots = diarioSnapshots.filter((s) => Number(s.id) !== Number(id));
    diarioSnapshotsCarregados = true;
    if (diarioSnapshotAtivo && Number(diarioSnapshotAtivo.id) === Number(id)) voltarDiarioLista();
    else renderDiarioLista();
    showToast('Registro excluído.', 'ok');
  } catch (erro) {
    showToast(`Não foi possível excluir: ${erro.message}`, 'err', 5000);
  }
}

function exportarSnapshot() {
  if (!diarioSnapshotAtivo) return;
  const snap = diarioSnapshotAtivo;
  const linhas = [`Diário de Produção — ${snap.dataHora}`, `Total: ${qtdItens(snap.total)}`, ''];
  const porResp = {};
  snap.itens.forEach(d => {
    const n = firstName(d.responsavel) || '—';
    if (!porResp[n]) porResp[n] = [];
    porResp[n].push(d);
  });
  Object.entries(porResp).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([resp, items]) => {
    linhas.push(`=== ${resp} (${qtdItens(items.length)}) ===`);
    items.forEach(d => linhas.push(`  [${d.status}] ${d.cliente} — ${d.nome} | ${d.veiculacao || d.prazo || '—'} | ${d.url}`));
    linhas.push('');
  });
  const blob = new Blob([linhas.join('\n')], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `diario_${snap.dataHora.replace(/[/:]/g,'-').replace(/ /g,'_')}.txt`;
  a.click();
}

// ─── Performance ──────────────────────────────────────────────────────────────────────────────────────────
let perfPeriodDias = 30;
let perfFiltroAtivo = null; // 'atrasados' | 'concluidos' | 'pendentesVeic' | 'publicados' | null
let perfChartColaborador = null;
let perfChartSemanal = null;
let perfChartDiario = null;
let perfChartDiarioPrazo = null;
let perfChartDiarioVeiculacao = null;
window.perfFiltroCache = { atrasados:[], concluidos:[], pendentesVeic:[], publicados:[] };
const STATUS_CONCLUIDO = ['Finalizado','Agendado','Para Agendar'];

function setPerfPeriod(dias, btn) {
  perfPeriodDias = dias;
  perfFiltroAtivo = null;
  document.querySelectorAll('.perf-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPerformance();
}

function getPerfBase() {
  return (typeof DADOS_ALL !== 'undefined' && DADOS_ALL.length > 0) ? DADOS_ALL : DADOS;
}

function getPerfCutoff() {
  if (perfPeriodDias === 0) return '';
  const corte = new Date();
  corte.setDate(corte.getDate() - perfPeriodDias);
  return corte.toISOString().slice(0,10);
}

function togglePerfFiltro(tipo, itens) {
  if (perfFiltroAtivo === tipo) {
    perfFiltroAtivo = null;
  } else {
    perfFiltroAtivo = tipo;
  }
  renderPerfFiltradoLista(itens);
  // Atualizar visual dos KPIs
  document.querySelectorAll('.perf-kpi-clickable').forEach(el => {
    el.style.outline = el.dataset.filtro === perfFiltroAtivo ? '2px solid var(--accent2)' : 'none';
    el.style.transform = el.dataset.filtro === perfFiltroAtivo ? 'scale(1.03)' : 'scale(1)';
  });
}


function getStatusBadge(status) {
  const s = status || '—';
  const c = fcCorDeStatus(s);
  return `<span style="background:${c.bg};color:${c.color};border:1px solid ${c.border};border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap;">${s}</span>`;
}

function renderPerfFiltradoLista(itens) {
  let container = document.getElementById('perf-filtro-lista');
  if (!container) return;
  if (!perfFiltroAtivo || !itens || itens.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  const hoje = new Date().toISOString().slice(0,10);
  const EQUIPE_CORES = {
    'Paulo':['#3b82f6','#1d4ed8'],'Vinícius':['#22c55e','#15803d'],
    'Ewerton':['#ef4444','#b91c1c'],'Ewerton L.':['#ef4444','#b91c1c'],
    'Reriston':['#f97316','#c2410c'],'Thiago':['#a855f7','#7e22ce'],
    'Deivid':['#f59e0b','#b45309'],'Beatriz':['#ec4899','#be185d'],
    'Ademir':['#14b8a6','#0f766e'],'Tainara':['#06b6d4','#0e7490'],
    'Jady':['#84cc16','#4d7c0f'],'Victória':['#94a3b8','#475569']
  };
  // Ordenar cronologicamente: mais atrasado primeiro (data mais antiga no topo)
  const itensSorted = [...itens].sort((a, b) => {
    const da = a.prazo_iso || a.veiculacao_iso || '9999';
    const db = b.prazo_iso || b.veiculacao_iso || '9999';
    return da.localeCompare(db);
  });
  const rows = itensSorted.slice(0,80).map(d => {
    const resp = firstName(d.responsavel) || 'Sem responsável';
    const cores = EQUIPE_CORES[resp] || ['#7c3aed','#5b21b6'];
    const dataRef = d.prazo_iso || d.veiculacao_iso || '';
    const dataFmt = dataRef ? dataRef.split('-').reverse().join('/') : '—';
    let atrasoHtml = '';
    if (dataRef && dataRef < hoje && !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s))) {
      const dias = Math.floor((new Date(hoje) - new Date(dataRef)) / 86400000);
      atrasoHtml = `<span style="color:#ef4444;font-weight:700;font-size:10px;min-width:30px;">+${dias}d</span>`;
    }
    return `<button type="button" onclick="openItemWorkspace('${d.id}')" style="display:flex;width:100%;align-items:center;gap:8px;padding:6px 12px;border:0;border-bottom:1px solid var(--border);background:transparent;font:inherit;text-align:left;cursor:pointer;font-size:11px;transition:background .15s;" onmouseover="this.style.background='rgba(124,58,237,0.08)'" onmouseout="this.style.background='transparent'">
      ${getStatusBadge(d.status)}
      <span style="color:var(--text-muted);min-width:52px;">${dataFmt}</span>
      ${atrasoHtml}
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);">${d.cliente} — ${d.nome}</span>
      <span style="color:${cores[0]};font-weight:700;min-width:60px;text-align:right;">${resp}</span>
      <span style="color:var(--text-muted);font-size:10px;margin-left:4px;">ABRIR</span>
    </button>`;
  }).join('');
  const titulo = { atrasados:'Itens Atrasados (prazo vencido)', concluidos:'Itens Concluídos', pendentesVeic:'Pendentes Atrasados (veiculação)', publicados:'Publicados' }[perfFiltroAtivo] || 'Itens';
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border);">
      <span style="font-size:11px;font-weight:700;color:var(--accent2);">${titulo} (${itens.length})</span>
      <button onclick="togglePerfFiltro(null,[])" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;">✕ Fechar</button>
    </div>
    ${rows}
    ${itens.length > 80 ? `<div style="padding:8px 12px;color:var(--text-muted);font-size:11px;">...e mais ${qtdItens(itens.length-80)}</div>` : ''}
  `;
}

// ─── Departamentos ───────────────────────────────────────────────────────────────────────────────
// Mapeamento fixo: quem pertence a qual departamento
// CRITÉRIO PRINCIPAL: groupIds = grupo do item no Monday.com
// Se o item está no grupo certo, vai para aquele departamento independente do responsável
const DEPT_CONFIG = [
  {
    id: 'redacao',
    label: 'Redação',
    cor: '#3b82f6',
    desc: 'Copywriters e redatores',
    groupIds: ['group_title'], // Grupo "Redação" no Monday
    pessoas: ['Paulo','Thiago','Vinícius','Ewerton','Ewerton L.','Manus'],
    // Status que indicam que o item está na fila de redação
    statusAtivos: ['A Fazer','Em andamento','Em Andamento','Falta Info','Ag. Info Cliente','Aguardando Info.'],
    statusConcluidos: ['Pode Fazer','Falta D.A','Agendado','Finalizado','Para Agendar','Para agendar','Ag. Aprovação Cliente','Para aprovação','Para Aprovação','Aprovado','Ag. Interno','Alteração','Em execução']
  },
  {
    id: 'producao',
    label: 'Produção',
    cor: '#f97316',
    desc: 'Captadores de foto e vídeo',
    groupIds: ['novo_grupo57911__1'], // Grupo "Produção (Foto e Vídeo)" no Monday
    pessoas: ['Thiago','Vinícius','Ewerton','Ewerton L.','Ademir','Tainara'], // Tainara faz agendamento de fotos/vídeos com clientes
    statusAtivos: ['Aguardo','Agendando Cap.','Cap. Agendada','Em andamento','Em Andamento'],
    statusConcluidos: ['Pode Fazer','Agendado','Finalizado','Para Agendar','Para agendar','Alteração','Em execução','Ag. Aprovação Cliente','Para aprovação','Para Aprovação','Aprovado']
  },
  {
    id: 'criacao',
    label: 'Criação',
    cor: '#a855f7',
    desc: 'Designers, editores de foto e vídeo',
    groupIds: ['novo_grupo__1'], // Grupo "Design & Edição" no Monday
    pessoas: ['Deivid','Jady','Victória','Reriston','Beatriz','Vinícius','Thiago','Ewerton','Ewerton L.'],
    statusAtivos: ['Pode Fazer','Falta D.A','Em andamento','Em Andamento','Alteração','Em execução','Ag. Aprovação Cliente','Para aprovação','Para Aprovação','Ag. Interno'],
    statusConcluidos: ['Agendado','Finalizado','Para Agendar','Para agendar','Aprovado']
  },
  {
    id: 'saidas',
    label: 'Saídas',
    cor: '#22c55e',
    desc: 'Agendamento e publicação',
    groupIds: ['novo_grupo22352__1'], // Grupo "Gestão de publicações" no Monday
    pessoas: ['Tainara'],
    statusAtivos: ['Para Agendar','Para agendar','Ag. Aprovação Cliente','Aprovado','Ag. Interno'],
    statusConcluidos: ['Agendado','Finalizado']
  }
];

// Cache global de itens por departamento para filtros
window.deptFiltroCache = {};

function showDeptFiltro(titulo, itens) {
  // Reutiliza o container de filtro global
  perfFiltroAtivo = 'dept_custom';
  // Injeta título customizado no cache
  window._deptFiltroTitulo = titulo;
  renderPerfFiltradoListaCustom(titulo, itens);
  // Scroll suave até a lista
  const el = document.getElementById('perf-filtro-lista');
  if (el) setTimeout(() => el.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
}

function renderPerfFiltradoListaCustom(titulo, itens) {
  let container = document.getElementById('perf-filtro-lista');
  if (!container) return;
  if (!itens || itens.length === 0) {
    container.innerHTML = `<div style="padding:12px 16px;color:var(--text-muted);font-size:12px;">Nenhum item encontrado.</div>`;
    container.style.display = 'block';
    return;
  }
  container.style.display = 'block';
  const hoje = new Date().toISOString().slice(0,10);
  const EQUIPE_CORES = {
    'Paulo':['#3b82f6','#1d4ed8'],'Vinícius':['#22c55e','#15803d'],
    'Ewerton':['#ef4444','#b91c1c'],'Ewerton L.':['#ef4444','#b91c1c'],
    'Reriston':['#f97316','#c2410c'],'Thiago':['#a855f7','#7e22ce'],
    'Deivid':['#f59e0b','#b45309'],'Beatriz':['#ec4899','#be185d'],
    'Ademir':['#14b8a6','#0f766e'],'Tainara':['#06b6d4','#0e7490'],
    'Jady':['#84cc16','#4d7c0f'],'Victória':['#94a3b8','#475569']
  };
  const itensSorted = [...itens].sort((a, b) => {
    const da = a.prazo_iso || a.veiculacao_iso || '9999';
    const db = b.prazo_iso || b.veiculacao_iso || '9999';
    return da.localeCompare(db);
  });
  const rows = itensSorted.slice(0,100).map(d => {
    const resp = firstName(d.responsavel) || 'Sem responsável';
    const cores = EQUIPE_CORES[resp] || ['#7c3aed','#5b21b6'];
    const dataRef = d.prazo_iso || d.veiculacao_iso || '';
    const dataFmt = dataRef ? dataRef.split('-').reverse().join('/') : '—';
    let atrasoHtml = '';
    if (dataRef && dataRef < hoje && !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s))) {
      const dias = Math.floor((new Date(hoje) - new Date(dataRef)) / 86400000);
      atrasoHtml = `<span style="color:#ef4444;font-weight:700;font-size:10px;min-width:30px;">+${dias}d</span>`;
    }
    return `<button type="button" onclick="openItemWorkspace('${d.id}')" style="display:flex;width:100%;align-items:center;gap:8px;padding:6px 12px;border:0;border-bottom:1px solid var(--border);background:transparent;font:inherit;text-align:left;cursor:pointer;font-size:11px;transition:background .15s;" onmouseover="this.style.background='rgba(124,58,237,0.08)'" onmouseout="this.style.background='transparent'">
      ${getStatusBadge(d.status)}
      <span style="color:var(--text-muted);min-width:52px;">${dataFmt}</span>
      ${atrasoHtml}
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);">${d.cliente} — ${d.nome}</span>
      <span style="color:${cores[0]};font-weight:700;min-width:60px;text-align:right;">${resp}</span>
      <span style="color:var(--text-muted);font-size:10px;margin-left:4px;">ABRIR</span>
    </button>`;
  }).join('');
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border);background:var(--surface2);">
      <span style="font-size:11px;font-weight:700;color:var(--accent2);">${titulo} (${itens.length})</span>
      <button onclick="document.getElementById('perf-filtro-lista').style.display='none';perfFiltroAtivo=null;" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;">✕ Fechar</button>
    </div>
    ${rows}
    ${itens.length > 100 ? `<div style="padding:8px 12px;color:var(--text-muted);font-size:11px;">...e mais ${qtdItens(itens.length-100)}</div>` : ''}
  `;
}

function renderDepartamentos(base, hoje, corte, periodoLabel) {
  const container = document.getElementById('perf-departamentos-grid');
  if (!container) return;

  // Limpar cache
  window.deptFiltroCache = {};

  const EQUIPE_CORES_LOCAL = {
    'Paulo':'#3b82f6','Vinícius':'#22c55e','Ewerton':'#ef4444','Ewerton L.':'#ef4444',
    'Reriston':'#f97316','Thiago':'#a855f7','Deivid':'#f59e0b','Beatriz':'#ec4899',
    'Ademir':'#14b8a6','Tainara':'#06b6d4','Jady':'#84cc16','Victória':'#94a3b8'
  };
  const BTN_STYLE = 'cursor:pointer;transition:opacity .15s,transform .15s;border:none;background:transparent;padding:0;width:100%;text-align:center;border-radius:8px;';
  const BTN_HOVER = 'onmouseover="this.style.opacity=\'0.75\'" onmouseout="this.style.opacity=\'1\'"';

  const html = DEPT_CONFIG.map(dept => {
    const todosStatus = [...dept.statusAtivos, ...dept.statusConcluidos];
    const itens = base.filter(d => {
      // CRITÉRIO PRINCIPAL: grupo do item no Monday (group_id)
      const noGrupoDept = dept.groupIds && dept.groupIds.includes(d.group_id);
      if (!noGrupoDept) return false;
      if (!todosStatus.includes(d.status)) return false;
      const ref = d.prazo_iso || d.veiculacao_iso;
      if (!ref) return false;
      if (corte && ref < corte) return false;
      return true;
    });

    if (itens.length === 0) {
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;border-top:3px solid ${dept.cor};">
        <div style="font-size:13px;font-weight:700;color:${dept.cor};margin-bottom:4px;">${dept.label}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:12px;">${dept.desc}</div>
        <p style="color:var(--text-muted);font-size:11px;">Sem dados no período.</p>
      </div>`;
    }

    const total = itens.length;
    const ativos = itens.filter(d => dept.statusAtivos.includes(d.status));
    // Finalizados = apenas status 'Finalizado' (literal)
    const concluidos = itens.filter(d => d.status === 'Finalizado');
    const atrasadosPrazo = ativos.filter(d => d.prazo_iso && d.prazo_iso < hoje);
    const atrasadosVeic  = ativos.filter(d => d.veiculacao_iso && d.veiculacao_iso < hoje);
    const atrasados = ativos.filter(d => { const ref = d.prazo_iso || d.veiculacao_iso; return ref && ref < hoje; });
    // Taxa OK real: % de itens que saíram do grupo antes do prazo original
    const actLogs = window.ACTIVITY_LOGS || null;
    let taxaOKData = null;
    if (actLogs) {
      taxaOKData = calcTaxaOK(itens, dept, actLogs.moveEvents, actLogs.prazoEvents);
    }
    const taxaConclusao = taxaOKData && taxaOKData.total > 0 ? taxaOKData.pct : null;
    const taxaLabel = taxaConclusao !== null ? `${taxaConclusao}%` : '—';
    const taxaCor = taxaConclusao === null ? 'var(--text-muted)' : taxaConclusao >= 70 ? '#22c55e' : taxaConclusao >= 40 ? '#f59e0b' : '#ef4444';
      // Salvar itens OK/NOK no cache para filtro clicável
    const cid = dept.id;
    if (taxaOKData) {
      window.deptFiltroCache[cid + '_taxaOK'] = taxaOKData.okItems;
      window.deptFiltroCache[cid + '_taxaNOK'] = taxaOKData.nokItems;
    }
    let somaAtraso = 0;
    atrasados.forEach(d => { const ref = d.prazo_iso || d.veiculacao_iso; somaAtraso += Math.floor((new Date(hoje) - new Date(ref)) / 86400000); });
    const mediaAtraso = atrasados.length > 0 ? (somaAtraso/atrasados.length).toFixed(1) : 0;
    // Salvar no cache global para acesso pelos onclick
    window.deptFiltroCache[cid] = {
      todos: itens,
      concluidos,
      aberto: ativos,
      atrasadosPrazo,
      atrasadosVeic
    };

    // Por pessoa — todos os responsáveis, marcando os que são forasteiros (cadastro errado)
    const porPessoa = {};
    const itensCadastroErrado = []; // itens com responsável fora do time do departamento
    itens.forEach(d => {
      // Pegar todos os responsáveis do item
      const resps = (d.responsavel || '').split(',').map(r => r.trim().split(' ')[0]).filter(r => r && r !== '—');
      if (resps.length === 0) return;
      // Verificar se algum responsável é forasteiro (não pertence ao time do depto)
      const respsForasteiros = resps.filter(r => r && r !== '—' && !dept.pessoas.includes(r));
      const respsDept = resps.filter(r => dept.pessoas.includes(r));
      // Se NENHUM responsável é do time → item com cadastro errado
      const cadastroErrado = respsDept.length === 0;
      if (cadastroErrado) itensCadastroErrado.push({...d, _respsForasteiros: respsForasteiros});
      // Registrar TODOS os responsáveis no porPessoa, marcando forasteiros
      resps.forEach(resp => {
        if (!resp || resp === '—') return;
        const eForasteiro = !dept.pessoas.includes(resp);
        if (!porPessoa[resp]) porPessoa[resp] = { total:0, ativos:0, concluidos:0, atrasados:0, itens:[], itensAtrasados:[], forasteiro: eForasteiro };
        // Evitar duplicar o mesmo item para a mesma pessoa
        if (!porPessoa[resp].itens.includes(d)) {
          porPessoa[resp].total++;
          porPessoa[resp].itens.push(d);
          if (dept.statusAtivos.includes(d.status)) porPessoa[resp].ativos++;
          if (dept.statusConcluidos.includes(d.status)) porPessoa[resp].concluidos++;
          const ref = d.prazo_iso || d.veiculacao_iso;
          if (ref && ref < hoje && dept.statusAtivos.includes(d.status)) {
            porPessoa[resp].atrasados++;
            porPessoa[resp].itensAtrasados.push(d);
          }
        }
      });
    });
    // Salvar no cache
    window.deptFiltroCache[cid].porPessoa = porPessoa;
    window.deptFiltroCache[cid].cadastroErrado = itensCadastroErrado;

    const pessoasOrdenadas = Object.entries(porPessoa).sort((a,b) => b[1].total - a[1].total);
    const maxPessoa = pessoasOrdenadas[0]?.[1].total || 1;

    const pessoasHtml = pessoasOrdenadas.map(([nome, s]) => {
      const pct = Math.round((s.total/maxPessoa)*100);
      const taxaP = s.total > 0 ? Math.round((s.concluidos/s.total)*100) : 0;
      const eForasteiro = s.forasteiro === true;
      // Forasteiro: cor de alerta laranja-vermelho, borda tracejada
      const cor = eForasteiro ? '#f97316' : (EQUIPE_CORES_LOCAL[nome] || dept.cor);
      const barCor = eForasteiro ? '#f97316' : cor;
      const wrapStyle = eForasteiro
        ? 'margin-bottom:6px;background:rgba(249,115,22,.07);border:1px dashed rgba(249,115,22,.4);border-radius:6px;padding:5px 7px;'
        : 'margin-bottom:6px;';
      const alertaBadge = eForasteiro
        ? `<span title="Responsável fora do time deste departamento — possível cadastro errado" style="background:#f97316;color:#fff;font-size:9px;font-weight:900;padding:1px 5px;border-radius:4px;margin-left:3px;">Fora do time</span>`
        : '';
      return `<div style="${wrapStyle}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;gap:4px;">
          <span style="display:flex;align-items:center;gap:2px;">
            <button ${BTN_HOVER} onclick="showDeptFiltro('${nome} — todos os itens (${dept.label})', window.deptFiltroCache['${cid}'].porPessoa['${nome}'].itens)" style="${BTN_STYLE}text-align:left;font-size:11px;color:${cor};font-weight:700;flex-shrink:0;width:auto;">${nome}</button>
            ${alertaBadge}
          </span>
          <span style="font-size:10px;color:var(--text-muted);white-space:nowrap;display:flex;align-items:center;gap:4px;">
            <button ${BTN_HOVER} onclick="showDeptFiltro('${nome} — todos (${dept.label})', window.deptFiltroCache['${cid}'].porPessoa['${nome}'].itens)" style="${BTN_STYLE}display:inline;font-size:10px;color:var(--text-muted);width:auto;">${qtdItens(s.total)}</button>
            ${s.atrasados > 0 ? `<button ${BTN_HOVER} onclick="showDeptFiltro('${nome} — atrasados (${dept.label})', window.deptFiltroCache['${cid}'].porPessoa['${nome}'].itensAtrasados)" style="${BTN_STYLE}display:inline;font-size:10px;color:#ef4444;font-weight:700;width:auto;">${s.atrasados} atrasados</button>` : ''}
            <span style="color:${taxaP>=70?'#22c55e':taxaP>=40?'#f59e0b':'#ef4444'};">${taxaP}% ok</span>
          </span>
        </div>
        <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;cursor:pointer;" onclick="showDeptFiltro('${nome} — todos (${dept.label})', window.deptFiltroCache['${cid}'].porPessoa['${nome}'].itens)">
          <div style="height:100%;width:${pct}%;background:${barCor};border-radius:3px;${eForasteiro?'background:repeating-linear-gradient(45deg,#f97316,#f97316 4px,#f9731633 4px,#f9731633 8px);':''}"></div>
        </div>
      </div>`;
    }).join('');

    // Status breakdown — clicáveis
    const statusCount = {};
    itens.forEach(d => { statusCount[d.status] = (statusCount[d.status]||0)+1; });
    const statusTop = Object.entries(statusCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const statusHtml = statusTop.map(([s, q]) => {
      const c = fcCorDeStatus(s);
      const itensStatus = itens.filter(d => d.status === s);
      // Salvar no cache
      window.deptFiltroCache[cid][`status_${s}`] = itensStatus;
      return `<button ${BTN_HOVER} onclick="showDeptFiltro('${s} — ${dept.label} (${qtdItens(q)})', window.deptFiltroCache['${cid}']['status_${s}'])" style="background:${c.bg};color:${c.color};border:1px solid ${c.border};border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;transition:opacity .15s;">${s} <strong>${q}</strong></button>`;
    }).join(' ');

    const pctPrazo = total > 0 ? Math.round((atrasadosPrazo.length/total)*100) : 0;
    const pctVeic  = total > 0 ? Math.round((atrasadosVeic.length/total)*100) : 0;
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;border-top:3px solid ${dept.cor};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:${dept.cor};">${dept.label}</div>
          <div style="font-size:10px;color:var(--text-muted);">${dept.desc}</div>
        </div>
        <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — todos os itens', window.deptFiltroCache['${cid}'].todos)" style="${BTN_STYLE}text-align:right;">
          <div style="font-size:22px;font-weight:900;color:var(--text);line-height:1;">${total}</div>
          <div style="font-size:9px;color:var(--text-muted);">itens no período</div>
        </button>
      </div>
      <!-- KPIs clicáveis -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px;">
        <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — Finalizados', window.deptFiltroCache['${cid}'].concluidos)" style="${BTN_STYLE}background:var(--surface2);border-radius:8px;padding:7px 4px;">
          <div style="font-size:15px;font-weight:900;color:#9cd326;line-height:1;">${concluidos.length}</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">Finalizados</div>
        </button>
        <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — Em Aberto', window.deptFiltroCache['${cid}'].aberto)" style="${BTN_STYLE}background:var(--surface2);border-radius:8px;padding:7px 4px;">
          <div style="font-size:15px;font-weight:900;color:#f59e0b;line-height:1;">${ativos.length}</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">Em Aberto</div>
        </button>
        ${taxaOKData && taxaOKData.total > 0 ? `
        <div style="background:var(--surface2);border-radius:8px;padding:7px 4px;text-align:center;cursor:pointer;" onclick="showDeptFiltro('${dept.label} \u2014 Taxa OK (${taxaOKData.okCount} ok / ${taxaOKData.nokCount} fora do prazo)', window.deptFiltroCache['${cid}_taxaOK'].concat(window.deptFiltroCache['${cid}_taxaNOK']))" title="${taxaOKData.okCount} entregues no prazo, ${taxaOKData.nokCount} fora do prazo">
          <div style="font-size:15px;font-weight:900;color:${taxaCor};line-height:1;">${taxaLabel}</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">Taxa OK</div>
          <div style="font-size:8px;color:var(--text-muted);margin-top:1px;">${taxaOKData.okCount}/${taxaOKData.total}</div>
        </div>` : `
        <div style="background:var(--surface2);border-radius:8px;padding:7px 4px;text-align:center;" title="Sem histórico de movimentação para calcular">
          <div style="font-size:15px;font-weight:900;color:var(--text-muted);line-height:1;">—</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">Taxa OK</div>
          <div style="font-size:8px;color:var(--text-muted);margin-top:1px;">sem histórico</div>
        </div>`}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
        <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — Prazo em Atraso', window.deptFiltroCache['${cid}'].atrasadosPrazo)" style="${BTN_STYLE}background:${atrasadosPrazo.length > 0 ? 'rgba(239,68,68,.12)' : 'var(--surface2)'};border:1px solid ${atrasadosPrazo.length > 0 ? 'rgba(239,68,68,.3)' : 'transparent'};border-radius:8px;padding:7px 4px;">
          <div style="font-size:15px;font-weight:900;color:${atrasadosPrazo.length > 0 ? '#ef4444' : '#22c55e'};line-height:1;">${atrasadosPrazo.length}</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">Prazo em atraso${pctPrazo > 0 ? ` (${pctPrazo}%)` : ''}</div>
        </button>
        <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — Veiculação em Atraso', window.deptFiltroCache['${cid}'].atrasadosVeic)" style="${BTN_STYLE}background:${atrasadosVeic.length > 0 ? 'rgba(239,68,68,.12)' : 'var(--surface2)'};border:1px solid ${atrasadosVeic.length > 0 ? 'rgba(239,68,68,.3)' : 'transparent'};border-radius:8px;padding:7px 4px;">
          <div style="font-size:15px;font-weight:900;color:${atrasadosVeic.length > 0 ? '#ef4444' : '#22c55e'};line-height:1;">${atrasadosVeic.length}</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">Veic. Atraso${pctVeic > 0 ? ` (${pctVeic}%)` : ''}</div>
        </button>
      </div>
      ${atrasados.length > 0 ? `<div style="font-size:10px;color:#ef4444;margin-bottom:10px;">Média de atraso: <strong>${mediaAtraso} dias</strong></div>` : ''}
      <!-- Por pessoa -->
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">Por Colaborador</div>
        ${pessoasHtml}
      </div>
      <!-- Status breakdown -->
      <div style="font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">Status Atuais</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">${statusHtml}</div>
      <!-- Alerta de cadastro errado -->
      ${itensCadastroErrado.length > 0 ? `
      <div style="margin-top:12px;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.4);border-radius:8px;padding:8px 10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:10px;font-weight:900;color:#f97316;">CADASTRO INCORRETO</span>
          <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — Cadastro Incorreto (${qtdItens(itensCadastroErrado.length)})', window.deptFiltroCache['${cid}'].cadastroErrado)" style="${BTN_STYLE}font-size:9px;color:#f97316;font-weight:700;width:auto;text-decoration:underline;">ver todos</button>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">Itens neste grupo com responsável fora do time esperado:</div>
        ${itensCadastroErrado.slice(0,3).map(d => {
          const respsStr = (d._respsForasteiros || []).join(', ') || firstName(d.responsavel);
          return `<div style="font-size:10px;color:#f97316;padding:2px 0;border-bottom:1px solid rgba(249,115,22,.15);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${d.nome}">• <strong>${respsStr}</strong> — ${d.cliente || ''} ${d.nome}</div>`;
        }).join('')}
        ${itensCadastroErrado.length > 3 ? `<div style="font-size:9px;color:var(--text-muted);margin-top:4px;">...e mais ${qtdItens(itensCadastroErrado.length - 3)}</div>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');

  container.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">${html}</div>`;
}

let carregamentoDosGraficos = null;
function carregarGraficos() {
  if (window.Chart) return Promise.resolve();
  if (carregamentoDosGraficos) return carregamentoDosGraficos;
  carregamentoDosGraficos = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js';
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); carregamentoDosGraficos = null; reject(new Error('Não foi possível carregar os gráficos.')); };
    document.head.appendChild(script);
  });
  return carregamentoDosGraficos;
}

function renderPerformance() {
  const base = getPerfBase();
  if (base.length === 0) {
    document.getElementById('perf-departamentos-grid').innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Carregue os dados de Produção primeiro (clique em Atualizar Dados).</p>';
    return;
  }
  if (!window.Chart) {
    carregarGraficos().then(() => renderPerformance()).catch((erro) => showToast(erro.message, 'error', 6000));
    return;
  }
  const hoje = new Date().toISOString().slice(0,10);
  const corte = getPerfCutoff();
  const periodoLabel = perfPeriodDias === 0 ? 'histórico completo' : `últimos ${perfPeriodDias} dias`;
  const EQUIPE_CORES = {
    'Paulo':['#3b82f6','#1d4ed8'],'Vinícius':['#22c55e','#15803d'],
    'Ewerton':['#ef4444','#b91c1c'],'Ewerton L.':['#ef4444','#b91c1c'],
    'Reriston':['#f97316','#c2410c'],'Thiago':['#a855f7','#7e22ce'],
    'Deivid':['#f59e0b','#b45309'],'Beatriz':['#ec4899','#be185d'],
    'Ademir':['#14b8a6','#0f766e'],'Tainara':['#06b6d4','#0e7490'],
    'Jady':['#84cc16','#4d7c0f'],'Victória':['#94a3b8','#475569']
  };

  // Garantir container de lista filtrada
  let filtroContainer = document.getElementById('perf-filtro-lista');
  if (!filtroContainer) {
    filtroContainer = document.createElement('div');
    filtroContainer.id = 'perf-filtro-lista';
    filtroContainer.style.cssText = 'display:none;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;';
    const perfDiv = document.getElementById('painel-performance').querySelector('.container');
    const sec1 = perfDiv.querySelector('.perf-section');
    perfDiv.insertBefore(filtroContainer, sec1);
  }

  // Calcular publicados e pendentes para o cache de filtros (ainda usado por togglePerfFiltro)
  const itensVeic = base.filter(d => d.veiculacao_iso && (!corte || d.veiculacao_iso >= corte));
  const itensVeicPassados = itensVeic.filter(d => d.veiculacao_iso < hoje);
  const publicados = itensVeicPassados.filter(d => STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s)));
  const pendentesAtrasados = itensVeicPassados.filter(d => !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s)));
  const itensPassados = base.filter(d => d.veiculacao_iso && d.veiculacao_iso <= hoje && (!corte || d.veiculacao_iso >= corte));
  const diasProdUnicos = [...new Set(itensPassados.map(d=>d.veiculacao_iso).filter(Boolean))].length || 1;

  // ================================================================
  // SEÇÃO 5: DEPARTAMENTOS
  // ================================================================
  renderDepartamentos(base, hoje, corte, periodoLabel);

  // ================================================================
  // SEÇÃO 4: GRÁFICOS CHART.JS
  // ================================================================
  // Dados por colaborador (excluir sem responsável)
  // Cor de cada status: a do banco (vybe_status.cor, corDeStatus); sem ela, cinza (auditoria 09/11, A5).
  const corDoStatusNoGrafico = (st) => (typeof corDeStatus === 'function' && corDeStatus(st)?.cor) || '#676879';
  // Coletar todos os status únicos presentes nos dados
  // Usar o mesmo critério dos cards de departamento:
  // cada item pertence ao departamento pelo grupo do Monday,
  // e é atribuído aos responsáveis que pertencem ao time daquele departamento.
  const colaboradorStats = {}; // { resp: { total, porStatus: { status: count }, dept: id } }
  const statusPresentes = new Set();

  // Mapa de groupId → departamento
  const groupIdToDept = {};
  DEPT_CONFIG.forEach(dept => {
    dept.groupIds.forEach(gid => { groupIdToDept[gid] = dept; });
  });

  base.filter(d => {
    if (!d.veiculacao_iso && !d.prazo_iso) return false;
    const ref = d.veiculacao_iso || d.prazo_iso;
    if (corte && ref < corte) return false;
    return true;
  }).forEach(d => {
    const dept = groupIdToDept[d.group_id];
    // Todos os responsáveis do item
    const resps = (d.responsavel || '').split(',').map(r => r.trim().split(' ')[0]).filter(r => r && r !== '—');
    if (resps.length === 0) return;
    // Se o item tem departamento definido, usar apenas responsáveis do time daquele departamento
    // Se nenhum responsável pertence ao time, usar o primeiro (cadastro errado — ainda mostra)
    const respsDept = dept ? resps.filter(r => dept.pessoas.includes(r)) : [];
    const respList = respsDept.length > 0 ? respsDept : [resps[0]];
    const st = d.status || 'Sem status';
    statusPresentes.add(st);
    respList.forEach(resp => {
      if (!resp || resp === '—') return;
      if (!colaboradorStats[resp]) colaboradorStats[resp] = { total:0, porStatus:{}, dept: dept ? dept.id : null };
      // Evitar duplicar o mesmo item para a mesma pessoa
      if (!colaboradorStats[resp]._itens) colaboradorStats[resp]._itens = new Set();
      if (colaboradorStats[resp]._itens.has(d.id || d.nome)) return;
      colaboradorStats[resp]._itens.add(d.id || d.nome);
      colaboradorStats[resp].total++;
      colaboradorStats[resp].porStatus[st] = (colaboradorStats[resp].porStatus[st]||0) + 1;
    });
  });
  const colaboradores = Object.keys(colaboradorStats).sort((a,b) =>
    colaboradorStats[b].total - colaboradorStats[a].total
  );
  // Ordenar status: concluídos primeiro, depois por frequência
  const statusOrdenados = [...statusPresentes].sort((a,b) => {
    const aConc = STATUS_CONCLUIDO.some(s=>a.includes(s)) ? 0 : 1;
    const bConc = STATUS_CONCLUIDO.some(s=>b.includes(s)) ? 0 : 1;
    if (aConc !== bConc) return aConc - bConc;
    const aTotal = colaboradores.reduce((s,c)=>(colaboradorStats[c].porStatus[a]||0)+s, 0);
    const bTotal = colaboradores.reduce((s,c)=>(colaboradorStats[c].porStatus[b]||0)+s, 0);
    return bTotal - aTotal;
  });

  // Gráfico de linha: histórico dia a dia de publicações
  if (typeof Chart !== 'undefined') {
    // Coletar apenas dias com status FINALIZADO e veiculacao_iso ANTES de hoje (dias passados)
    const ontem = new Date(hoje); // hoje já é YYYY-MM-DD string, comparar < hoje exclui hoje
    const diasMap = {};
    base.filter(d => {
      if (!d.veiculacao_iso) return false;
      // Apenas dias estritamente anteriores a hoje
      if (d.veiculacao_iso >= hoje) return false;
      if (corte && d.veiculacao_iso < corte) return false;
      // Apenas itens com status FINALIZADO
      const isFinalizado = STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
      return isFinalizado;
    }).forEach(d => {
      diasMap[d.veiculacao_iso] = (diasMap[d.veiculacao_iso] || 0) + 1;
    });
    const diasOrdenados = Object.keys(diasMap).sort();
    const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const diasLabels = diasOrdenados.map(s => {
      const dt = new Date(s + 'T00:00:00');
      const diaSem = DIAS_SEMANA[dt.getDay()];
      const dia = String(dt.getDate()).padStart(2,'0');
      const mes = String(dt.getMonth()+1).padStart(2,'0');
      return `${diaSem} ${dia}/${mes}`;
    });
    const diasValues = diasOrdenados.map(d => diasMap[d]);
    // Média móvel de 7 dias — apenas sobre dias passados (todos os pontos já são passados)
    const mediaMovel = diasValues.map((_, i) => {
      // Usar apenas os 6 dias anteriores + o próprio dia (nunca dias futuros)
      const slice = diasValues.slice(Math.max(0, i-6), i+1);
      return Math.round((slice.reduce((a,b)=>a+b,0)/slice.length)*10)/10;
    });
    const ctxDiario = document.getElementById('chart-diario').getContext('2d');
    if (perfChartDiario) perfChartDiario.destroy();
    perfChartDiario = new Chart(ctxDiario, {
      type: 'line',
      data: {
        labels: diasLabels,
        datasets: [
          {
            label: 'Posts veiculados',
            data: diasValues,
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168,85,247,.15)',
            fill: true,
            tension: 0.3,
            pointRadius: diasOrdenados.length > 60 ? 0 : 3,
            pointHoverRadius: 5,
            borderWidth: 2
          },
          {
            label: 'Média móvel (7d)',
            data: mediaMovel,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [4,3]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode:'index', intersect:false },
        plugins: {
          legend: { labels: { color:'#8888a8', font:{size:11}, boxWidth:14 } },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return diasOrdenados[idx] ? diasOrdenados[idx].split('-').reverse().join('/') : items[0].label;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color:'#8888a8', font:{size:10},
              maxTicksLimit: 20,
              maxRotation: 45
            },
            grid: { color:'#2a2a38' }
          },
          y: {
            ticks: { color:'#8888a8', font:{size:10} },
            grid: { color:'#2a2a38' },
            beginAtZero: true,
            title: { display:true, text:'Posts', color:'#8888a8', font:{size:10} }
          }
        }
      }
    });
  }

  // Gráfico de linha: volume de produção por prazo — passado (sólido) + futuro (tracejado)
  if (typeof Chart !== 'undefined') {
    const DIAS_SEMANA2 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    // Coletar todos os dias com prazo (passado e futuro)
    const prazoPassadoMap = {}; // dias < hoje
    const prazoFuturoMap  = {}; // dias >= hoje
    // Para o futuro: mostrar sempre os próximos 60 dias a partir de hoje
    const hojeDate2 = new Date(hoje + 'T00:00:00');
    const futuro60 = new Date(hojeDate2); futuro60.setDate(futuro60.getDate() + 60);
    const futuro60iso = futuro60.toISOString().slice(0,10);
    base.forEach(d => {
      if (!d.prazo_iso) return;
      if (d.prazo_iso < hoje) {
        // Passado: respeitar corte de período
        if (corte && d.prazo_iso < corte) return;
        prazoPassadoMap[d.prazo_iso] = (prazoPassadoMap[d.prazo_iso] || 0) + 1;
      } else {
        // Futuro: até 60 dias
        if (d.prazo_iso > futuro60iso) return;
        prazoFuturoMap[d.prazo_iso] = (prazoFuturoMap[d.prazo_iso] || 0) + 1;
      }
    });
    // Unir todos os dias em ordem cronológica
    const todosDiasPrazo = [...new Set([...Object.keys(prazoPassadoMap), ...Object.keys(prazoFuturoMap)])].sort();
    const labelFnPrazo = s => {
      const dt = new Date(s + 'T00:00:00');
      const diaSem = DIAS_SEMANA2[dt.getDay()];
      const dia = String(dt.getDate()).padStart(2,'0');
      const mes = String(dt.getMonth()+1).padStart(2,'0');
      return `${diaSem} ${dia}/${mes}`;
    };
    const prazoLabels = todosDiasPrazo.map(labelFnPrazo);
    // Dataset passado: valor nos dias passados, null nos futuros
    const prazoPassadoData = todosDiasPrazo.map(d => d < hoje ? (prazoPassadoMap[d] || 0) : null);
    // Dataset futuro: null nos passados, valor nos futuros
    const prazoFuturoData  = todosDiasPrazo.map(d => d >= hoje ? (prazoFuturoMap[d] || 0) : null);
    // Média móvel 7d apenas sobre o passado
    const prazoMediaMovel = todosDiasPrazo.map((d, i) => {
      if (d >= hoje) return null;
      const vals = [];
      for (let j = Math.max(0, i-6); j <= i; j++) {
        const v = prazoPassadoData[j];
        if (v !== null) vals.push(v);
      }
      return vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : null;
    });
    const ctxDiarioPrazo = document.getElementById('chart-diario-prazo');
    if (ctxDiarioPrazo) {
      if (perfChartDiarioPrazo) perfChartDiarioPrazo.destroy();
      perfChartDiarioPrazo = new Chart(ctxDiarioPrazo.getContext('2d'), {
        type: 'line',
        data: {
          labels: prazoLabels,
          datasets: [
            {
              label: 'Passado (prazos vencidos)',
              data: prazoPassadoData,
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34,197,94,.12)',
              fill: true,
              tension: 0.3,
              pointRadius: todosDiasPrazo.length > 80 ? 0 : 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              spanGaps: false
            },
            {
              label: 'Futuro (prazos agendados)',
              data: prazoFuturoData,
              borderColor: '#60a5fa',
              backgroundColor: 'rgba(96,165,250,.08)',
              fill: true,
              tension: 0.3,
              pointRadius: todosDiasPrazo.length > 80 ? 0 : 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              borderDash: [5,4],
              spanGaps: false
            },
            {
              label: 'Média móvel 7d (passado)',
              data: prazoMediaMovel,
              borderColor: '#f59e0b',
              backgroundColor: 'transparent',
              fill: false,
              tension: 0.4,
              pointRadius: 0,
              borderWidth: 2,
              borderDash: [4,3],
              spanGaps: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode:'index', intersect:false },
          plugins: {
            legend: { labels: { color:'#8888a8', font:{size:11}, boxWidth:14 } },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  const iso = todosDiasPrazo[idx];
                  const label = iso ? iso.split('-').reverse().join('/') : items[0].label;
                  return iso >= hoje ? `${label} (futuro)` : `${label} (passado)`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { color:'#8888a8', font:{size:10}, maxTicksLimit:25, maxRotation:45 },
              grid: { color:'#2a2a38' }
            },
            y: {
              ticks: { color:'#8888a8', font:{size:10} },
              grid: { color:'#2a2a38' },
              beginAtZero: true,
              title: { display:true, text:'Itens', color:'#8888a8', font:{size:10} }
            }
          }
        }
      });
    }
  }

  // Gráfico de linha: Volume de Veiculação por Dia (passado + futuro + média móvel)
  if (typeof Chart !== 'undefined') {
    const veicPassadoMap = {};
    const veicFuturoMap  = {};
    const futuro60iso = new Date(new Date().getTime() + 60*86400000).toISOString().slice(0,10);
    base.forEach(d => {
      if (!d.veiculacao_iso) return;
      if (d.veiculacao_iso < hoje) {
        // Passado: respeita corte
        if (corte && d.veiculacao_iso < corte) return;
        veicPassadoMap[d.veiculacao_iso] = (veicPassadoMap[d.veiculacao_iso] || 0) + 1;
      } else {
        // Futuro: até 60 dias
        if (d.veiculacao_iso > futuro60iso) return;
        veicFuturoMap[d.veiculacao_iso] = (veicFuturoMap[d.veiculacao_iso] || 0) + 1;
      }
    });
    const todosDiasVeic = [...new Set([...Object.keys(veicPassadoMap), ...Object.keys(veicFuturoMap)])].sort();
    const DIAS_SEMANA_VEIC = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const labelFnVeic = s => {
      const dt = new Date(s + 'T00:00:00');
      const diaSem = DIAS_SEMANA_VEIC[dt.getDay()];
      const dia = String(dt.getDate()).padStart(2,'0');
      const mes = String(dt.getMonth()+1).padStart(2,'0');
      return `${diaSem} ${dia}/${mes}`;
    };
    const veicLabels = todosDiasVeic.map(labelFnVeic);
    const veicPassadoData = todosDiasVeic.map(d => d < hoje ? (veicPassadoMap[d] || 0) : null);
    const veicFuturoData  = todosDiasVeic.map(d => d >= hoje ? (veicFuturoMap[d] || 0) : null);
    const veicMediaMovel  = todosDiasVeic.map((d, i) => {
      if (d >= hoje) return null;
      const vals = [];
      for (let j = Math.max(0, i-6); j <= i; j++) {
        const v = veicPassadoData[j];
        if (v !== null) vals.push(v);
      }
      return vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : null;
    });
    const ctxDiarioVeic = document.getElementById('chart-diario-veiculacao');
    if (ctxDiarioVeic) {
      if (perfChartDiarioVeiculacao) perfChartDiarioVeiculacao.destroy();
      perfChartDiarioVeiculacao = new Chart(ctxDiarioVeic.getContext('2d'), {
        type: 'line',
        data: {
          labels: veicLabels,
          datasets: [
            {
              label: 'Passado (veiculações realizadas)',
              data: veicPassadoData,
              borderColor: '#a78bfa',
              backgroundColor: 'rgba(167,139,250,.12)',
              fill: true,
              tension: 0.3,
              pointRadius: todosDiasVeic.length > 80 ? 0 : 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              spanGaps: false
            },
            {
              label: 'Futuro (veiculações agendadas)',
              data: veicFuturoData,
              borderColor: '#f97316',
              backgroundColor: 'rgba(249,115,22,.08)',
              fill: true,
              tension: 0.3,
              pointRadius: todosDiasVeic.length > 80 ? 0 : 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              borderDash: [5,4],
              spanGaps: false
            },
            {
              label: 'Média móvel 7d (passado)',
              data: veicMediaMovel,
              borderColor: '#f59e0b',
              backgroundColor: 'transparent',
              fill: false,
              tension: 0.4,
              pointRadius: 0,
              borderWidth: 2,
              borderDash: [4,3],
              spanGaps: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode:'index', intersect:false },
          plugins: {
            legend: { labels: { color:'#8888a8', font:{size:11}, boxWidth:14 } },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  const iso = todosDiasVeic[idx];
                  const label = iso ? iso.split('-').reverse().join('/') : items[0].label;
                  return iso >= hoje ? `${label} (futuro)` : `${label} (passado)`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { color:'#8888a8', font:{size:10}, maxTicksLimit:25, maxRotation:45 },
              grid: { color:'#2a2a38' }
            },
            y: {
              ticks: { color:'#8888a8', font:{size:10} },
              grid: { color:'#2a2a38' },
              beginAtZero: true,
              title: { display:true, text:'Itens', color:'#8888a8', font:{size:10} }
            }
          }
        }
      });
    }
  }

  // Gráfico barras horizontais por colaborador — por status real do Monday
  if (typeof Chart !== 'undefined') {
    const ctxColaborador = document.getElementById('chart-colaborador').getContext('2d');
    if (perfChartColaborador) perfChartColaborador.destroy();
    // Usar cor exata do Monday para cada status; adicionar opacidade 0.85 para não ficar sólido demais
    const datasetsColaborador = statusOrdenados.map(st => {
      const corBase = corDoStatusNoGrafico(st);
      return {
        label: st,
        data: colaboradores.map(n => colaboradorStats[n].porStatus[st] || 0),
        backgroundColor: corBase,
        borderColor: corBase,
        borderWidth: 0,
        borderRadius: 3,
        borderSkipped: false
      };
    });
    // Altura dinâmica baseada no número de colaboradores
    const alturaColaborador = Math.max(280, colaboradores.length * 32 + 60);
    const canvasCol = document.getElementById('chart-colaborador');
    if (canvasCol) canvasCol.parentElement.style.height = alturaColaborador + 'px';
    perfChartColaborador = new Chart(ctxColaborador, {
      type: 'bar',
      data: {
        labels: colaboradores,
        datasets: datasetsColaborador
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        onHover: (event, elements) => {
          event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        onClick: (event, elements) => {
          if (!elements.length) return;
          const el = elements[0];
          const nomeColaborador = colaboradores[el.index];
          const statusClicado = statusOrdenados[el.datasetIndex];
          // Filtrar itens desta pessoa com este status
          const itensFiltrados = base.filter(d => {
            const resp = firstName(d.responsavel);
            return resp === nomeColaborador && d.status === statusClicado;
          }).sort((a,b) => {
            const da = a.prazo_iso || a.veiculacao_iso || '';
            const db = b.prazo_iso || b.veiculacao_iso || '';
            return da < db ? -1 : da > db ? 1 : 0;
          });
          showDeptFiltro(`${nomeColaborador} — ${statusClicado} (${itensFiltrados.length})`, itensFiltrados);
        },
        plugins: {
          legend: {
            labels: {
              color:'#8888a8', font:{size:10}, boxWidth:12,
              filter: (item) => {
                return datasetsColaborador[item.datasetIndex]?.data.some(v => v > 0);
              }
            },
            onClick: (e, legendItem) => {
              // Clicar na legenda filtra todos os itens com aquele status
              const statusClicado = statusOrdenados[legendItem.datasetIndex];
              const itensFiltrados = base.filter(d => d.status === statusClicado)
                .sort((a,b) => {
                  const da = a.prazo_iso || a.veiculacao_iso || '';
                  const db = b.prazo_iso || b.veiculacao_iso || '';
                  return da < db ? -1 : da > db ? 1 : 0;
                });
              showDeptFiltro(`Status: ${statusClicado} (${itensFiltrados.length})`, itensFiltrados);
            }
          },
          tooltip: {
            mode:'index', intersect:false,
            callbacks: {
              title: (items) => `${colaboradores[items[0].dataIndex]} — clique para filtrar`,
              label: (ctx) => {
                if (ctx.raw === 0) return null;
                return ` ${ctx.dataset.label}: ${ctx.raw}`;
              }
            },
            filter: (item) => item.raw > 0
          }
        },
        scales: {
          x: { stacked:true, ticks:{color:'#8888a8',font:{size:10}}, grid:{color:'#2a2a38'} },
          y: { stacked:true, ticks:{color:'#e8e8f0',font:{size:11}}, grid:{color:'#2a2a38'} }
        }
      }
    });

    // Gráfico comparativo semanal — PRAZO em atraso (contínuo) e VEICULACÃO em atraso (pontilhado) por pessoa
    const EQUIPE_CHART_COLORS = {
      'Thiago':   '#3b82f6',
      'Deivid':   '#22c55e',
      'Tainara':  '#ef4444',
      'Vinícius': '#f97316',
      'Ademir':   '#a855f7',
      'Victória': '#f59e0b',
      'Reriston': '#ec4899',
      'Jady':     '#14b8a6',
      'Beatriz':  '#06b6d4',
      'Paulo':    '#84cc16',
      'Ewerton':  '#94a3b8',
      'Manus':    '#e879f9'
    };

    // Coletar semanas a partir de prazo_iso e veiculacao_iso (apenas passados)
    const semanasSetSem = new Set();
    const prazoPorPessoa = {};   // { nome: { semKey: count } } — itens com prazo vencido
    const veicPorPessoa = {};    // { nome: { semKey: count } } — itens com veiculacao vencida

    base.forEach(d => {
      const resp = firstName(d.responsavel);
      if (!resp || resp === '—') return;
      const isConcluido = STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
      if (isConcluido) return; // só conta itens EM ATRASO (não finalizados)

      // Atraso de prazo
      if (d.prazo_iso && d.prazo_iso < hoje) {
        if (!corte || d.prazo_iso >= corte) {
          const dt = new Date(d.prazo_iso + 'T00:00:00');
          const dow = dt.getDay() || 7;
          const mon = new Date(dt); mon.setDate(dt.getDate() - dow + 1);
          const semKey = mon.toISOString().slice(0,10);
          semanasSetSem.add(semKey);
          if (!prazoPorPessoa[resp]) prazoPorPessoa[resp] = {};
          prazoPorPessoa[resp][semKey] = (prazoPorPessoa[resp][semKey]||0) + 1;
        }
      }

      // Atraso de veiculacao
      if (d.veiculacao_iso && d.veiculacao_iso < hoje) {
        if (!corte || d.veiculacao_iso >= corte) {
          const dt = new Date(d.veiculacao_iso + 'T00:00:00');
          const dow = dt.getDay() || 7;
          const mon = new Date(dt); mon.setDate(dt.getDate() - dow + 1);
          const semKey = mon.toISOString().slice(0,10);
          semanasSetSem.add(semKey);
          if (!veicPorPessoa[resp]) veicPorPessoa[resp] = {};
          veicPorPessoa[resp][semKey] = (veicPorPessoa[resp][semKey]||0) + 1;
        }
      }
    });

    const semanas = [...semanasSetSem].sort();
    const semanaLabels = semanas.map(s => {
      const d = new Date(s + 'T00:00:00');
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    });

    // Pessoas que têm pelo menos 1 atraso de prazo ou veiculacao
    const pessoasComAtraso = colaboradores.filter(n =>
      Object.values(prazoPorPessoa[n]||{}).some(v=>v>0) ||
      Object.values(veicPorPessoa[n]||{}).some(v=>v>0)
    );

    // Gerar datasets: linha contínua = prazo, pontilhada = veiculacao
    const datasetsSemanais = [];
    pessoasComAtraso.forEach(nome => {
      const cor = EQUIPE_CHART_COLORS[nome] || '#8888a8';
      const temPrazo = Object.values(prazoPorPessoa[nome]||{}).some(v=>v>0);
      const temVeic = Object.values(veicPorPessoa[nome]||{}).some(v=>v>0);
      // Linha contínua: prazo em atraso
      if (temPrazo) {
        datasetsSemanais.push({
          label: `${nome} (prazo)`,
          data: semanas.map(s => (prazoPorPessoa[nome]||{})[s] || 0),
          borderColor: cor,
          backgroundColor: cor + '22',
          borderDash: [],
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 7,
          _nome: nome,
          _tipo: 'prazo'
        });
      }
      // Linha pontilhada: veiculacao em atraso
      if (temVeic) {
        datasetsSemanais.push({
          label: `${nome} (veic.)`,
          data: semanas.map(s => (veicPorPessoa[nome]||{})[s] || 0),
          borderColor: cor,
          backgroundColor: cor + '11',
          borderDash: [6, 4],
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointStyle: 'rectRot',
          _nome: nome,
          _tipo: 'veic'
        });
      }
    });

    const ctxSemanal = document.getElementById('chart-semanal').getContext('2d');
    if (perfChartSemanal) perfChartSemanal.destroy();
    window._semanas = semanas;
    window._semanaLabels = semanaLabels;
    window._prazoPorPessoa = prazoPorPessoa;
    window._veicPorPessoa = veicPorPessoa;
    window._datasetsSemanais = datasetsSemanais;

    perfChartSemanal = new Chart(ctxSemanal, {
      type: 'line',
      data: { labels: semanaLabels, datasets: datasetsSemanais },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onHover: (event, elements) => {
          event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        onClick: (event, elements) => {
          if (!elements.length) return;
          const el = elements[0];
          const ds = datasetsSemanais[el.datasetIndex];
          const semKey = semanas[el.index];
          const semLabel = semanaLabels[el.index];
          const dtSeg = new Date(semKey + 'T00:00:00');
          const dtDom = new Date(dtSeg); dtDom.setDate(dtSeg.getDate() + 6);
          const fimSem = dtDom.toISOString().slice(0,10);
          let itensFiltrados, label;
          if (ds._tipo === 'prazo') {
            itensFiltrados = base.filter(d => {
              if (firstName(d.responsavel) !== ds._nome) return false;
              if (!d.prazo_iso || d.prazo_iso >= hoje) return false;
              if (STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s))) return false;
              return d.prazo_iso >= semKey && d.prazo_iso <= fimSem;
            }).sort((a,b) => (a.prazo_iso||'') < (b.prazo_iso||'') ? -1 : 1);
            label = `${ds._nome} — prazo em atraso — semana ${semLabel} (${itensFiltrados.length})`;
          } else {
            itensFiltrados = base.filter(d => {
              if (firstName(d.responsavel) !== ds._nome) return false;
              if (!d.veiculacao_iso || d.veiculacao_iso >= hoje) return false;
              if (STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s))) return false;
              return d.veiculacao_iso >= semKey && d.veiculacao_iso <= fimSem;
            }).sort((a,b) => (a.veiculacao_iso||'') < (b.veiculacao_iso||'') ? -1 : 1);
            label = `${ds._nome} — veicul. em atraso — semana ${semLabel} (${itensFiltrados.length})`;
          }
          showDeptFiltro(label, itensFiltrados);
        },
        plugins: {
          legend: {
            labels: { color:'#8888a8', font:{size:10}, boxWidth:12,
              generateLabels: (chart) => {
                // Agrupar por pessoa: mostrar 1 entrada com — e indicar contínuo/pontilhado
                return chart.data.datasets.map((ds, i) => ({
                  text: ds.label,
                  fillStyle: ds.borderColor,
                  strokeStyle: ds.borderColor,
                  lineWidth: 2,
                  lineDash: ds.borderDash,
                  hidden: !chart.isDatasetVisible(i),
                  datasetIndex: i
                }));
              }
            },
            onClick: (e, legendItem, legend) => {
              const ds = datasetsSemanais[legendItem.datasetIndex];
              let itensFiltrados, label;
              if (ds._tipo === 'prazo') {
                itensFiltrados = base.filter(d => {
                  if (firstName(d.responsavel) !== ds._nome) return false;
                  if (!d.prazo_iso || d.prazo_iso >= hoje) return false;
                  return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
                }).sort((a,b) => (a.prazo_iso||'') < (b.prazo_iso||'') ? -1 : 1);
                label = `${ds._nome} — todos com prazo em atraso (${itensFiltrados.length})`;
              } else {
                itensFiltrados = base.filter(d => {
                  if (firstName(d.responsavel) !== ds._nome) return false;
                  if (!d.veiculacao_iso || d.veiculacao_iso >= hoje) return false;
                  return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
                }).sort((a,b) => (a.veiculacao_iso||'') < (b.veiculacao_iso||'') ? -1 : 1);
                label = `${ds._nome} — todos com veicul. em atraso (${itensFiltrados.length})`;
              }
              showDeptFiltro(label, itensFiltrados);
            }
          },
          tooltip: {
            mode:'index', intersect:false,
            callbacks: {
              title: (items) => `Semana de ${semanaLabels[items[0].dataIndex]}`,
              label: (ctx) => {
                const ds = datasetsSemanais[ctx.datasetIndex];
                const tipo = ds._tipo === 'prazo' ? 'prazo em atraso' : 'veicul. em atraso';
                return ` ${ds._nome} (${tipo}): ${ctx.raw}`;
              }
            }
          }
        },
        scales: {
          x: { ticks:{color:'#8888a8',font:{size:10}}, grid:{color:'#2a2a38'} },
          y: {
            ticks:{color:'#8888a8',font:{size:10}},
            grid:{color:'#2a2a38'},
            beginAtZero:true,
            title:{display:true,text:'Itens em atraso',color:'#8888a8',font:{size:10}}
          }
        }
      }
    });
  }

  // Tabela de detalhamento por colaborador
  const tabelaRows = colaboradores.map(nome => {
    const s = colaboradorStats[nome];
    const total = s.total;
    const cores = EQUIPE_CORES[nome] || ['#7c3aed','#5b21b6'];

    // Calcular atrasos de prazo desta pessoa
    const atrasadosPrazoPessoa = base.filter(d => {
      if (firstName(d.responsavel) !== nome) return false;
      const ref = d.prazo_iso;
      if (!ref || ref >= hoje) return false;
      return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
    });
    const pctPrazo = total > 0 ? Math.round((atrasadosPrazoPessoa.length / total) * 100) : 0;
    const corPrazo = pctPrazo === 0 ? '#22c55e' : pctPrazo <= 20 ? '#f97316' : '#ef4444';

    // Calcular atrasos de veiculacao desta pessoa
    const atrasadosVeicPessoa = base.filter(d => {
      if (firstName(d.responsavel) !== nome) return false;
      const ref = d.veiculacao_iso;
      if (!ref || ref >= hoje) return false;
      return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
    });
    const pctVeic = total > 0 ? Math.round((atrasadosVeicPessoa.length / total) * 100) : 0;
    const corVeic = pctVeic === 0 ? '#22c55e' : pctVeic <= 20 ? '#f97316' : '#ef4444';

    // Gerar pills de status clicáveis para esta pessoa
    const statusPills = Object.entries(s.porStatus)
      .sort((a,b) => b[1]-a[1])
      .map(([st, cnt]) => {
        const cor = corDoStatusNoGrafico(st);
        const itensSt = base.filter(d => firstName(d.responsavel) === nome && d.status === st)
          .sort((a,b) => (a.prazo_iso||a.veiculacao_iso||'') < (b.prazo_iso||b.veiculacao_iso||'') ? -1 : 1);
        const payload = encodeURIComponent(JSON.stringify({ nome, st, label: `${nome} — ${st} (${cnt})` }));
        return `<span onclick="handleTabelaFiltro(event,'status','${payload}')" style="display:inline-block;background:${cor}22;color:${cor};border:1px solid ${cor}44;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;margin:1px;cursor:pointer;transition:opacity .15s;" onmouseenter="this.style.opacity='.7'" onmouseleave="this.style.opacity='1'">${st} ${cnt}</span>`;
      }).join('');

    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:8px 12px;font-weight:700;color:${cores[0]};cursor:pointer;" onclick="handleTabelaFiltro(event,'pessoa','${encodeURIComponent(nome)}')" title="Ver todos os itens de ${nome}">${nome}</td>
      <td style="padding:8px 12px;text-align:center;font-weight:700;color:var(--text);cursor:pointer;" onclick="handleTabelaFiltro(event,'pessoa','${encodeURIComponent(nome)}')" title="Ver todos os itens de ${nome}">${total}</td>
      <td style="padding:8px 12px;">${statusPills}</td>
      <td style="padding:8px 12px;min-width:110px;">
        <div onclick="handleTabelaFiltro(event,'prazo_atraso','${encodeURIComponent(nome)}')" title="Ver ${qtdItens(atrasadosPrazoPessoa.length)} com prazo em atraso" style="cursor:pointer;padding:4px 8px;border-radius:6px;background:${corPrazo}18;border:1px solid ${corPrazo}44;text-align:center;transition:background .15s;" onmouseenter="this.style.background='${corPrazo}33'" onmouseleave="this.style.background='${corPrazo}18'">
          <div style="font-size:14px;font-weight:800;color:${corPrazo};">${atrasadosPrazoPessoa.length}</div>
          <div style="font-size:9px;color:${corPrazo};opacity:.8;">${pctPrazo}% do total</div>
        </div>
      </td>
      <td style="padding:8px 12px;min-width:110px;">
        <div onclick="handleTabelaFiltro(event,'veic_atraso','${encodeURIComponent(nome)}')" title="Ver ${qtdItens(atrasadosVeicPessoa.length)} com veiculação em atraso" style="cursor:pointer;padding:4px 8px;border-radius:6px;background:${corVeic}18;border:1px solid ${corVeic}44;text-align:center;transition:background .15s;" onmouseenter="this.style.background='${corVeic}33'" onmouseleave="this.style.background='${corVeic}18'">
          <div style="font-size:14px;font-weight:800;color:${corVeic};">${atrasadosVeicPessoa.length}</div>
          <div style="font-size:9px;color:${corVeic};opacity:.8;">${pctVeic}% do total</div>
        </div>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('perf-tabela-colaborador').innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:var(--surface2);">
          <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:700;font-size:11px;">Colaborador</th>
          <th style="padding:8px 12px;text-align:center;color:var(--text-muted);font-weight:700;font-size:11px;">Total</th>
          <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:700;font-size:11px;">Status</th>
          <th style="padding:8px 12px;text-align:center;color:var(--text-muted);font-weight:700;font-size:11px;">Prazo em atraso</th>
          <th style="padding:8px 12px;text-align:center;color:var(--text-muted);font-weight:700;font-size:11px;">Veiculação em Atraso</th>
        </tr>
      </thead>
      <tbody>${tabelaRows}</tbody>
    </table>
  `;

  // Handler para filtros da tabela de detalhamento
  window.handleTabelaFiltro = function(event, tipo, payload) {
    event.stopPropagation();
    const nome = decodeURIComponent(payload);
    let itens, label;
    if (tipo === 'pessoa') {
      itens = base.filter(d => firstName(d.responsavel) === nome)
        .sort((a,b) => (a.prazo_iso||a.veiculacao_iso||'') < (b.prazo_iso||b.veiculacao_iso||'') ? -1 : 1);
      label = `${nome} — todos os itens (${itens.length})`;
    } else if (tipo === 'prazo_atraso') {
      itens = base.filter(d => {
        if (firstName(d.responsavel) !== nome) return false;
        const ref = d.prazo_iso;
        if (!ref || ref >= hoje) return false;
        return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
      }).sort((a,b) => (a.prazo_iso||'') < (b.prazo_iso||'') ? -1 : 1);
      label = `${nome} — prazo em atraso (${itens.length})`;
    } else if (tipo === 'veic_atraso') {
      itens = base.filter(d => {
        if (firstName(d.responsavel) !== nome) return false;
        const ref = d.veiculacao_iso;
        if (!ref || ref >= hoje) return false;
        return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
      }).sort((a,b) => (a.veiculacao_iso||'') < (b.veiculacao_iso||'') ? -1 : 1);
      label = `${nome} — veiculação em atraso (${itens.length})`;
    } else if (tipo === 'status') {
      try {
        const obj = JSON.parse(decodeURIComponent(payload));
        itens = base.filter(d => firstName(d.responsavel) === obj.nome && d.status === obj.st)
          .sort((a,b) => (a.prazo_iso||a.veiculacao_iso||'') < (b.prazo_iso||b.veiculacao_iso||'') ? -1 : 1);
        label = obj.label;
      } catch(e) { return; }
    }
    if (itens && itens.length >= 0) showDeptFiltro(label, itens);
  };

  // Cache de itens para filtros clicáveis
  const atrasadosPrazo = base.filter(d => d.prazo_iso && d.prazo_iso < hoje && !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s)));
  const concluidosNoPrazo = base.filter(d => STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s)));
  window.perfFiltroCache = {
    atrasados: atrasadosPrazo,
    concluidos: concluidosNoPrazo,
    pendentesVeic: pendentesAtrasados,
    publicados: publicados
  };

  // Restaurar estado do filtro ativo se houver
  if (perfFiltroAtivo && window.perfFiltroCache[perfFiltroAtivo]) {
    renderPerfFiltradoLista(window.perfFiltroCache[perfFiltroAtivo]);
    document.querySelectorAll('.perf-kpi-clickable').forEach(el => {
      el.style.outline = el.dataset.filtro === perfFiltroAtivo ? '2px solid var(--accent2)' : 'none';
      el.style.transform = el.dataset.filtro === perfFiltroAtivo ? 'scale(1.03)' : 'scale(1)';
    });
  }
}
