// vybe-mundo-conteudo.js — módulo Conteúdo do Irecity (07/11/2026, ideias do AgencyFlow para a Vybe).
//
// 1. Objetivo de cada peça — Atração, Educação ou Conversão — como bolinha colorida: nas linhas de demanda
//    do Irecity (decoradas aqui, sem mexer no vybe-mundo.js), no calendário (vybe-agenda.js chama
//    bolinhaHtml), na gaveta da peça (vybe-gaveta.js chama campoObjetivoHtml, que deixa trocar) e no
//    cadastro (cadastros_governed_v2.js).
// 2. Janela "Equilíbrio do mês": os números do mês numa linha (com o mês anterior), uma barra por cliente com
//    o que falta ("falta conversão", "equilibrado") e a frase inteira embaixo; clicar no cliente abre o
//    calendário dele com cada peça como bolinha do objetivo e a marca da etapa de aprovação, e a prévia ao lado.
// 3. Aba "Links de aprovação": o head gera o link público (/aprovar-pecas/<token>) para o cliente aprovar
//    ou pedir ajuste sem login (server/conteudo-aprovacao.js).
// 4. Aba "Para aprovar" (Padrão v2, 12/11/2026): a tela é o quadro "Aprovação de conteúdo" do moodboard. A fala do
//    Augusto, o baralho com uma decisão por vez, a fila por cliente e o equilíbrio do mês resumido; o mês fica no topo.
//    A lista vem de VybeAprovacoes (/api/painel?area=aprovacoes). Aprovar e Pedir alteração abrem os portões de sempre
//    (openQualityGate para "Para agendar", openStatusContextGate para "Alteração"): nada é gravado sem passar por eles.
// Contas: vybe-conteudo-equilibrio.js (VybeEquilibrio). Leitura: /api/painel?area=conteudo_modulo.
// Escrita do objetivo: /api/conteudo (acao=objetivo). Sem a migração, tudo abre e avisa.
(() => {
  // Status na cor do quadro (statusCor de vybe-core.js); fora do painel (testes), o nome escapado.
  function statusCor(d) { const g = globalThis.statusCor; return typeof g === 'function' && g !== statusCor ? g(d) : String(d?.status || 'Sem status').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  // Cliente com a cor da carteira (cliCor de vybe-core.js); fora do painel (testes), o nome escapado.
  function cliCor(n) { const g = globalThis.cliCor; return typeof g === 'function' && g !== cliCor ? g(n) : String(n ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  const E = window.VybeEquilibrio;
  if (!E) return;
  const ROTA = '/api/painel?area=conteudo_modulo';
  const st = { objetivos: {}, respostas: {}, pronto: null, aviso: '', carregado: false, aberto: false, aba: 'aprovar', apr: 0, aprAss: '', aprLista: false, lote: [], loteRef: '', falaN: -1,
    mes: '', cliente: '', peca: '', ajuda: false, verFalta: false, links: null, erroLinks: '', novoLink: null, gerando: false, timer: 0, thumbs: {} };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = { fechar: svg('<path d="M6 6l12 12M18 6 6 18"/>'), esq: svg('<path d="M15 18l-6-6 6-6"/>'), dir: svg('<path d="M9 18l6-6-6-6"/>'),
    marca: svg('<circle cx="7" cy="12" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="17" cy="17" r="3"/>'), link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>') };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeDoMes = (m) => { const n = MESES[Number(m.slice(5)) - 1]; return `${n[0].toUpperCase()}${n.slice(1)} de ${m.slice(0, 4)}`; };
  // Mês no seletor por extenso (padrão de datas, docs/padrao-visual.md): "Novembro de 2026", não "nov 2026".
  const mesCurto = (m) => nomeDoMes(m);
  const hoje = () => (typeof hojeDeVerdade === 'function' ? hojeDeVerdade() : new Date().toISOString().slice(0, 10));
  const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const toast = (t, tipo = 'info') => (typeof showToast === 'function' ? showToast(t, tipo) : null);
  // Parte que ainda não está pronta no banco: uma frase neutra para todos; o detalhe técnico (o que o servidor mandou)
  // só atrás do "Para quem administra: o que falta", e só para quem administra.
  const souAdminAqui = () => { try { return typeof souAdmin === 'function' && Boolean(souAdmin()); } catch { return false; } };
  const avisoParte = (tecnico) => `<div class="vc-aviso" role="status">Esta parte ainda está sendo ligada.${souAdminAqui() && tecnico ? ` <button type="button" class="vc-sec" data-vc-falta aria-expanded="${st.verFalta}">Para quem administra: o que falta</button>${st.verFalta ? `<small class="vc-nota-tec">${esc(tecnico)}</small>` : ''}` : ''}</div>`;
  const mesSeguinte = (m) => { const [a, n] = m.split('-').map(Number); return n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, '0')}`; };

  // ---------- Dados ----------
  async function lerJson(url, opcoes = {}) {
    const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opcoes, signal: AbortSignal.timeout?.(25000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d?.error || 'Não foi possível falar com o painel agora.'), { status: r.status });
    return d;
  }
  async function carregarObjetivos() {
    try {
      const d = await lerJson(`${ROTA}&acao=objetivos`);
      st.objetivos = d.objetivos && typeof d.objetivos === 'object' ? d.objetivos : {};
      st.respostas = d.respostas && typeof d.respostas === 'object' ? d.respostas : {};
      st.pronto = d.pronto !== false; st.aviso = d.aviso || '';
    } catch (e) { if (e.status !== 401) { st.pronto = st.pronto ?? false; st.aviso = st.aviso || e.message; } }
    st.carregado = true;
    decorarTudo();
    if (st.aberto) pintar();
  }
  const objetivoDe = (id) => E.objetivoValido(st.objetivos[String(id)]) || null;
  const respostaDe = (id) => st.respostas[String(id)]?.acao || null;
  const pecasDoPainel = () => (typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : []);
  const clientesDe = (d) => (typeof clientesDoItem === 'function' ? clientesDoItem(d) : E.clientesDe(d));
  function clientesAtivos() {
    const cad = typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : [];
    const ativo = window.VybeDono?.util?.ativoNoCadastro || ((c) => c && c.ativo !== false);
    const nomes = cad.filter(ativo).map((c) => c.nome).filter(Boolean);
    return nomes.length ? nomes : null;
  }
  const paraConta = (d) => ({ id: String(d.id), clientes: clientesDe(d), veiculacao_iso: d.veiculacao_iso, prazo_iso: d.prazo_iso, objetivo: objetivoDe(d.id) });

  // ---------- Bolinha (listas, calendário, gaveta) ----------
  function bolinhaHtml(item) {
    const o = objetivoDe(item?.id);
    return o ? `<i class="vc-bolinha" style="--c:${E.COR[o]}" title="Objetivo: ${E.ROTULO[o]}" aria-label="Objetivo: ${E.ROTULO[o]}"></i>` : '';
  }
  function campoObjetivoHtml(item) {
    const id = String(item?.id || ''), atual = objetivoDe(id);
    if (st.pronto === false) return `<span class="vc-objetivo-campo vc-indisponivel" title="Esta parte ainda está sendo ligada.">Ainda indisponível</span>`;
    return `<span class="vc-objetivo-campo" role="radiogroup" aria-label="Objetivo da peça" data-vc-item="${esc(id)}">${E.OBJETIVOS.map((o) =>
      `<button type="button" role="radio" aria-checked="${atual === o}" class="${atual === o ? 'ativo' : ''}" data-vc-objetivo="${o}" title="${atual === o ? 'Tirar o objetivo' : 'Marcar como ' + E.ROTULO[o]}"><i style="--c:${E.COR[o]}"></i>${E.ROTULO[o]}</button>`).join('')}</span>`;
  }
  async function definirObjetivo(itemId, objetivo) {
    const id = String(itemId), antes = st.objetivos[id] || null;
    const novo = objetivo && objetivo !== antes ? objetivo : null;
    if (novo) st.objetivos[id] = novo; else delete st.objetivos[id];
    redesenharItem(id);
    try {
      await lerJson('/api/conteudo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'objetivo', item: id, objetivo: novo || '' }) });
      toast(novo ? `Objetivo: ${E.ROTULO[novo]}` : 'Objetivo retirado', 'ok');
    } catch (e) {
      if (antes) st.objetivos[id] = antes; else delete st.objetivos[id];
      redesenharItem(id);
      toast(e.message, 'err');
    }
  }
  function redesenharItem(id) {
    document.querySelectorAll(`[data-vc-item="${CSS.escape(id)}"]`).forEach((el) => { el.outerHTML = campoObjetivoHtml({ id }); });
    document.querySelectorAll(`.vv-demanda-abrir[data-valor="${CSS.escape(id)}"]`).forEach(decorarLinha);
    if (typeof renderManagerCalendar === 'function' && document.querySelector('.manager-calendar-event')) { try { renderManagerCalendar(true); } catch { /* calendário fechado */ } }
    if (st.aberto) pintar();
  }
  // As linhas do Irecity (linhaDemanda em vybe-mundo.js) são redesenhadas o tempo todo: um observador põe a
  // bolinha antes do título. O vybe-mundo.js não sabe deste módulo.
  function decorarLinha(botao) {
    const id = botao.dataset.valor, b = botao.querySelector('b');
    if (!b) return;
    const o = objetivoDe(id), atual = b.querySelector(':scope > .vc-bolinha');
    if (atual?.dataset.o === (o || '')) return;
    atual?.remove();
    if (o) { b.insertAdjacentHTML('afterbegin', bolinhaHtml({ id })); b.firstElementChild.dataset.o = o; }
  }
  function decorarTudo(raiz = document) { raiz.querySelectorAll?.('.vv-demanda-abrir[data-valor]').forEach(decorarLinha); }
  let agendado = 0;
  new MutationObserver(() => { if (agendado || !st.carregado) return; agendado = requestAnimationFrame(() => { agendado = 0; decorarTudo(); conferirFila(); }); })
    .observe(document.documentElement, { childList: true, subtree: true });

  // ---------- Janela ----------
  function janela() {
    let el = document.getElementById('vv-conteudo');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vv-conteudo'; el.className = 'vc'; el.hidden = true;
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Conteúdo: equilíbrio do mês');
      document.body.append(el);
    }
    return el;
  }
  function dadosDoMes() {
    const todas = pecasDoPainel().filter((d) => clientesDe(d).length);
    const ativos = clientesAtivos();
    const conta = todas.map(paraConta);
    const atual = E.equilibrioDoMes(conta, { mes: st.mes, clientes: ativos });
    const anterior = E.equilibrioDoMes(conta, { mes: E.mesAnterior(st.mes), clientes: ativos });
    const etapaDe = (d) => E.etapaDeAprovacao(d.status, respostaDe(d.id));
    const doMes = (m) => todas.filter((d) => E.dataDaPeca(d).startsWith(m + '-') && (!ativos || clientesDe(d).some((c) => ativos.some((a) => normal(a) === normal(c)))));
    const aprovadas = (m) => doMes(m).filter((d) => etapaDe(d) === 'aprovado_cliente').length;
    return { todas, atual, anterior, etapaDe, aprovadasAgora: aprovadas(st.mes), aprovadasAntes: aprovadas(E.mesAnterior(st.mes)) };
  }
  // Os números do mês numa linha (redesign, quadro 16): peças, cada objetivo e as aprovadas pelo cliente, com a
  // diferença para o mês anterior quando muda; zero fica discreto.
  function resumoDoMes(d) {
    const g = d.atual.geral, a = d.anterior.geral, ant = MESES[Number(E.mesAnterior(st.mes).slice(5)) - 1];
    const item = (valor, antes, um, varios) => {
      const c = E.comparar(valor, antes);
      return { valor: c.atual, rotulo: `${c.atual === 1 ? um : varios}${c.diferenca ? ` (${c.diferenca > 0 ? '+' : '−'}${Math.abs(c.diferenca)} vs ${ant})` : ''}`, tom: c.atual ? '' : 'zero' };
    };
    const itens = [item(g.total, a.total, 'peça no mês', 'peças no mês'),
      ...E.OBJETIVOS.map((o) => item(g[o], a[o], E.ROTULO[o].toLowerCase(), E.ROTULO[o].toLowerCase())),
      item(d.aprovadasAgora, d.aprovadasAntes, 'aprovada pelo cliente', 'aprovadas pelo cliente')];
    if (typeof vbResumoHtml === 'function') return `<div class="vc-resumo">${vbResumoHtml(itens)}</div>`;
    return `<div class="vc-resumo">${itens.map((x) => `<span><b>${x.valor}</b> ${esc(x.rotulo)}</span>`).join(' · ')}</div>`;
  }
  const legendaObjetivos = () => `<div class="vc-leg-topo" aria-label="Legenda">${E.OBJETIVOS.map((o) => `<span><i class="vc-leg-ponto" style="--c:${E.COR[o]}"></i>${E.ROTULO[o]}</span>`).join('')}<span><i class="vc-leg-ponto" style="--c:#D9D3C8"></i>Sem objetivo</span></div>`;
  function pintar() {
    const el = janela();
    // A gaveta da peça fica abaixo desta janela (621 contra 640): com a janela aberta, o CSS sobe a gaveta (body.vc-aberto).
    document.body.classList.toggle('vc-aberto', st.aberto);
    if (!st.aberto) { el.hidden = true; return; }
    el.hidden = false;
    // O topo do quadro: título, as três abas, o mês e a ajuda. O mês vale para o equilíbrio e para a fala do Augusto.
    const mesAtual = st.mes === hoje().slice(0, 7);
    // Direção 3 (quadro D3-Aprovacao): o título com o mês ao lado, as abas à direita (Para aprovar com quantas esperam),
    // a ajuda e o fechar.
    const nFila = filaParaAprovar()?.fila?.length, nCliente = filaParaAprovar()?.comCliente;
    const topo = `<div class="v2c-topo"><h2>Aprovação</h2>
      <span class="v2c-mes" role="group" aria-label="Mês"><button type="button" data-vc-mes="-1" aria-label="Mês anterior">‹</button><button type="button" class="v2c-mes-nome" data-vc-mes="0" title="${esc(nomeDoMes(st.mes))}${mesAtual ? '' : ': voltar para este mês'}">${esc(mesCurto(st.mes))}</button><button type="button" data-vc-mes="1" aria-label="Próximo mês">›</button></span>
      <span class="v2c-seg" role="tablist"><button type="button" role="tab" data-vc-aba="aprovar" aria-selected="${st.aba === 'aprovar'}">Para aprovar${nFila ? ` <span class="d3a-n">${nFila}</span>` : ''}</button><button type="button" role="tab" data-vc-aba="cliente" aria-selected="${st.aba === 'cliente'}">Com o cliente${nCliente ? ` <span class="d3a-n">${nCliente}</span>` : ''}</button><button type="button" role="tab" data-vc-aba="equilibrio" aria-selected="${st.aba === 'equilibrio'}">Equilíbrio do mês</button><button type="button" role="tab" data-vc-aba="links" aria-selected="${st.aba === 'links'}" title="Links de aprovação">Links</button></span>
      <button type="button" class="v2c-btn" data-vc-ajuda aria-expanded="${st.ajuda}" aria-label="Como funciona" title="Como funciona">Como funciona</button>
      <button type="button" class="v2c-btn v2c-x" data-vc-fechar aria-label="Fechar (Esc)" title="Fechar (Esc)">${IC.fechar}</button></div>`;
    const ajuda = st.ajuda ? `<div class="vc-ajuda" role="note"><b>Como funciona</b>
      <p>Cada peça tem um <b>objetivo</b>: <i style="--c:${E.COR.atracao}"></i>Atração traz gente nova, <i style="--c:${E.COR.educacao}"></i>Educação explica e gera confiança, <i style="--c:${E.COR.conversao}"></i>Conversão chama para comprar. Marque no cadastro ou na peça (gaveta → Objetivo).</p>
      <p>O <b>equilíbrio do mês</b> conta as peças de cada cliente pela data de veiculação e avisa o que falta: um objetivo zerado com 3 ou mais peças, ou abaixo de 20% com 5 ou mais.</p>
      <p>No calendário, a marca ao lado da bolinha mostra a <b>aprovação</b>: para aprovar internamente, alteração interna, aprovado internamente, alteração do cliente e aprovado pelo cliente (status do painel + resposta pelo link).</p>
      <p>Em <b>Links de aprovação</b>, o head gera um link com validade para o cliente aprovar ou pedir ajuste sem login. Ele só vê as peças dele em "Ag. Aprovação Cliente".</p>
      <p>Em <b>Para aprovar</b>, Aprovar manda a peça para Para agendar e Pedir alteração devolve com o seu recado. As duas pedem confirmação antes de gravar. Se o quadro da peça não tiver esses status, ela abre para você decidir por lá. Tocar na arte abre a peça; as setas do teclado, ou arrastar o cartão, passam para a próxima.</p></div>` : '';
    const aviso = st.pronto === false ? avisoParte(st.aviso) : '';
    // Direção V2: no mundo, o topo e o corpo de cada aba são os das pranchas V2-M-Aprovacao (Links mostra a tela de Com o cliente).
    const emV2 = v2();
    el.classList.toggle('d3m-a-v2', emV2);
    if (emV2) {
      el.innerHTML = topoV2() + ajuda + aviso + `<div class="vc-corpo d3m-a-ap-corpo" data-aba="${st.aba}">${st.aba === 'equilibrio' ? corpoEquilibrioV2() : st.aba === 'aprovar' ? corpoAprovarV2() : corpoClienteV2()}</div>`;
      if (st.aba === 'aprovar') st.aprAss = assinaturaDaFila();
      return;
    }
    el.innerHTML = topo + ajuda + aviso + `<div class="vc-corpo">${st.aba === 'links' ? corpoLinks() : st.aba === 'cliente' ? corpoCliente() : st.aba === 'aprovar' ? corpoAprovar() : corpoEquilibrio()}</div>`;
    if (st.aba === 'aprovar') st.aprAss = assinaturaDaFila();
  }

  // ---------- Para aprovar (Padrão v2: a tela é o quadro "Aprovação de conteúdo" do moodboard) ----------
  // Nesta ordem, como no quadro: a fala do Augusto com o atalho das peças de amanhã; à esquerda o baralho (arte, nome,
  // cliente, quando veicula, objetivo, quem fez e a legenda), os dois botões e os pontos; à direita a fila por cliente
  // e o equilíbrio do mês resumido. A fila é a aprovação interna que a pessoa pode ver (o servidor já filtra pela
  // carteira; sócio vê tudo; o diretor de arte vê toda peça em "Para aprovação"). A data do cliente manda: primeiro o
  // que veicula antes. Peça que o painel já mostra fora de aprovação (o portão acabou de gravar) sai na hora.
  const A = () => window.VybeAprovacoes;
  // A peça da fila no painel, no formato que os portões e a gaveta usam: conteúdo (DADOS_ALL), solicitação
  // (DADOS_DEMANDAS) ou peça que nasceu no Vybe (vybe:<id>). O quadro dela desempata um id repetido.
  const ehSolicitacao = (x) => (typeof isRequestItem === 'function' ? isRequestItem(x) : x?.origem === 'solicitacao');
  function itemDoPainel(i) {
    const ref = String(i?.ref ?? ''); if (!ref) return null;
    const demandas = typeof DADOS_DEMANDAS !== 'undefined' && Array.isArray(DADOS_DEMANDAS) ? DADOS_DEMANDAS : [];
    const conteudo = pecasDoPainel().find((x) => String(x?.id) === ref && !ehSolicitacao(x)), pedido = demandas.find((x) => String(x?.id) === ref);
    const comoPedido = i.quadro === 'demandas' ? Boolean(pedido) || !conteudo : !conteudo && Boolean(pedido);
    const bruto = comoPedido ? pedido : conteudo;
    if (!bruto) return null;
    // O mesmo formato de findOperationalItem (vybe-demandas.js): é ele que diz ao portão de qual quadro é a peça.
    const norm = comoPedido ? globalThis.normalizeRequestForOperational : globalThis.normalizeContentForOperational;
    return typeof norm === 'function' ? norm(bruto) : bruto;
  }
  // Para onde Aprovar e Pedir alteração levam a peça, no quadro dela. Aprovar: "Para agendar"; o quadro que não tem esse
  // status (Solicitações) segue o fluxo dele (proximoStatusDaPeca, server/fluxo-status.js), desde que o próximo não seja
  // outra aprovação interna nem alteração. Pedir alteração: "Alteração".
  const INTERNAS = ['para aprovacao', 'em aprovacao'];
  function destinosDaDecisao(item) {
    const opcoes = ((typeof operationalStatusOptions === 'function' ? operationalStatusOptions(item) : (typeof STATUS_OPTIONS !== 'undefined' ? STATUS_OPTIONS : [])) || [])
      .filter((o) => o && o.label && o.ativa !== false);
    const seguinte = typeof proximoStatusDaPeca === 'function' ? proximoStatusDaPeca(item) : null;
    const serve = (o) => o && !/altera/.test(normal(o.label)) && !INTERNAS.includes(normal(o.label)) && normal(o.label) !== normal(item?.status);
    const aprovar = opcoes.find((o) => normal(o.label) === 'para agendar') || (serve(seguinte) ? seguinte : null);
    const alterar = opcoes.find((o) => normal(o.label) === 'alteracao') || opcoes.find((o) => /^altera/.test(normal(o.label))) || null;
    return { aprovar, alterar };
  }
  // A decisão de uma peça da fila: a peça, o status de destino e o portão de sempre (openQualityGate para aprovar,
  // openStatusContextGate para alteração). Sem um dos três, o motivo curto que o aviso mostra.
  function decisaoDaFila(i, acao) {
    const item = itemDoPainel(i);
    if (!item) return { motivo: 'ela ainda não carregou no painel' };
    const portao = acao === 'aprovar' ? globalThis.openQualityGate : globalThis.openStatusContextGate;
    if (typeof portao !== 'function') return { item, motivo: 'a conferência ainda não carregou' };
    const d = destinosDaDecisao(item), opcao = acao === 'aprovar' ? d.aprovar : d.alterar;
    if (!opcao) return { item, motivo: acao === 'aprovar' ? 'o quadro dela não tem o status depois da aprovação' : 'o quadro dela não tem Alteração' };
    return { item, opcao, portao };
  }
  // Espera aprovação interna: Para aprovação, Em aprovação ou Aguardando aprovação. "Aprovado" e "Ag. Aprovação
  // Cliente" não entram (a regex é ancorada no começo do status sem acento).
  const esperaAprovacao = (status) => /^(para|em|aguardando) aprova/.test(normal(status));
  function filaParaAprovar() {
    const d = A()?.estado?.().dados;
    if (!d) return null;
    const pecas = Array.isArray(d.pecas) ? d.pecas : [];
    const fila = pecas.filter((i) => i.etapa === 'interna').filter((i) => { const p = itemDoPainel(i); return !p || esperaAprovacao(p.status); })
      .sort((a, b) => String(a.veiculacao || a.prazo || '9').localeCompare(String(b.veiculacao || b.prazo || '9')) || (b.horas ?? -1) - (a.horas ?? -1));
    const comO = pecas.filter((i) => i.etapa === 'cliente');
    return { fila, comCliente: comO.length, comO };
  }
  const assinaturaDaFila = () => (filaParaAprovar()?.fila || []).map((i) => i.ref).join(',');
  function conferirFila() { if (st.aberto && st.aba === 'aprovar' && assinaturaDaFila() !== st.aprAss) { pintar(); tentarLote(); } }
  const somaDia = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const diaMes = (v) => `${v.slice(8, 10)}/${v.slice(5, 7)}`;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  // Quando a peça veicula: a frase do cartão ("veicula sexta") e a pílula da fila ("sexta"), com o tom da urgência.
  function quando(i) {
    const v = String(i.veiculacao || '').slice(0, 10), h = hoje();
    if (!v) return i.prazo ? { frase: `prazo ${diaMes(i.prazo)}`, curto: diaMes(i.prazo), tom: 'n' } : { frase: 'sem data do cliente', curto: 'sem data', tom: 'n' };
    if (v < h) return { frase: `ia ao ar ${diaMes(v)}`, curto: diaMes(v), tom: 'r' };
    if (v === h) return { frase: 'veicula hoje', curto: 'hoje', tom: 'a' };
    if (v === somaDia(h, 1)) return { frase: 'veicula amanhã', curto: 'amanhã', tom: 'a' };
    const dia = v <= somaDia(h, 6) ? NOME_DIA[new Date(`${v}T12:00:00Z`).getUTCDay()] : diaMes(v);
    return { frase: `veicula ${dia}`, curto: dia, tom: 'n' };
  }
  const deAmanha = (fila) => fila.filter((i) => String(i.veiculacao || '').slice(0, 10) === somaDia(hoje(), 1));
  const esperaHa = (h) => (h < 48 ? `${h} h` : `${Math.round(h / 24)} dias`);
  // O cliente como no quadro: ponto na cor da carteira e o nome em tinta.
  function cliHtml(nome) {
    const n = String(nome || '').trim(); if (!n) return '';
    const primeiro = n.split(',')[0].trim();
    const carteira = typeof carteiraDoCliente === 'function' ? carteiraDoCliente(primeiro) : '';
    const descricao = typeof descricaoCarteiraCliente === 'function' ? descricaoCarteiraCliente(primeiro) : '';
    return `<span class="v2c-cli" data-carteira="${esc(carteira || '')}"${descricao ? ` title="${esc(descricao)}"` : ''}>${esc(n)}</span>`;
  }
  // Quem fez a peça é o responsável dela no painel; sem a peça no painel, fica o head do cliente (o título diz qual é).
  function quemFez(i) {
    const nomes = String(itemDoPainel(i)?.responsavel || '').split(/\s*[,;]\s*/).filter(Boolean);
    if (nomes.length) return nomes.map((nome) => ({ nome, papel: 'Fez a peça' }));
    return (i.heads || []).map((h) => ({ nome: h.nome, papel: 'Head do cliente' }));
  }
  const avHtml = (p) => `<span class="v2c-av" title="${esc(`${p.papel}: ${p.nome}`)}">${esc(String(p.nome || '?').trim().slice(0, 2).toUpperCase())}</span>`;
  const avsHtml = (lista) => { const vistos = lista.filter((p, k, a) => a.findIndex((x) => x.nome === p.nome) === k).slice(0, 3); return vistos.length ? `<span class="v2c-avs">${vistos.map(avHtml).join('')}</span>` : ''; };
  const PILULA_OBJETIVO = { atracao: 'b', educacao: 'g', conversao: 'a' };
  function nomeDaPeca(i) {
    const t = String(i.titulo || 'Sem título').trim(), f = String(i.formato || '').trim();
    if (!f) return t;
    return normal(t).startsWith(normal(f)) ? `${f} · ${t.slice(f.length).replace(/^[\s\-–—:·|]+/, '')}`.replace(/ · $/, '') : `${f} · ${t}`;
  }
  const posDaCarta = (k) => (k < st.apr ? 'fora' : k - st.apr <= 2 ? String(k - st.apr) : '');
  // A carta da Direção 3: a arte à esquerda (com o baralho atrás) e, ao lado, o nome, o cliente, as pílulas (status,
  // formato e objetivo), quando vai ao ar, há quanto espera, quem fez, o head e a legenda.
  const NOME_DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const quandoNoAr = (i) => { const v = String(i.veiculacao || '').slice(0, 10); return v ? `${NOME_DIA_CURTO[new Date(`${v}T12:00:00Z`).getUTCDay()]} ${Number(v.slice(8, 10))}` : ''; };
  function cartaHtml(i, k) {
    const pos = posDaCarta(k), perto = pos !== '' && pos !== 'fora', thumb = st.thumbs[String(i.ref)];
    if (perto && thumb === undefined) buscarThumb(String(i.ref));
    const o = objetivoDe(i.ref), q = quando(i), item = itemDoPainel(i);
    const carteira = typeof carteiraDoCliente === 'function' ? carteiraDoCliente(String(i.cliente || '').split(',')[0].trim()) : '';
    const arte = arteHtml(String(i.ref), thumb, `Prévia de ${i.titulo || 'peça'}`, perto);
    const legenda = String(item?.legenda || '').trim();
    const fez = quemFez(i), heads = (i.heads || []).map((h) => h.nome).filter(Boolean);
    const noAr = quandoNoAr(i), corSt = (typeof corDeStatus === 'function' ? corDeStatus(i.status || '')?.cor : '') || '';
    const dados = [noAr || q.frase ? ['no ar', `<b class="${q.tom === 'r' ? 'r' : ''}">${esc(noAr || q.frase)}</b>`] : null,
      i.horas == null ? null : ['espera', `<b class="${i.horas >= 24 ? 'a' : ''}">${i.horas < 1 ? 'entrou agora' : esc(esperaHa(i.horas))}</b>`],
      fez.length && fez[0].papel === 'Fez a peça' ? ['arte', esc(fez.map((p) => p.nome).join(', '))] : null,
      heads.length ? ['head', esc(heads.join(', '))] : null].filter(Boolean);
    // O painel ao lado da arte (Paulo, 15/11/2026: "do lado, com a copy certinha como ia ficar no Insta, quem fez, as
    // infos"): o post como sai no Instagram (o @ e a foto do cliente, a legenda inteira), quem fez e as informações,
    // cada uma com a sua cor (status, formato, objetivo, quando vai ao ar, espera).
    const ig = perfilDoCliente(i.cliente);
    const prazo = String(i.prazo || item?.prazo_iso || '').slice(0, 10);
    const infos = [
      ['status', 'Status', `<span class="d3a-st"${corSt ? ` style="--d3-st:${esc(corSt)}"` : ''}><i aria-hidden="true"></i>${esc(i.status || 'Para aprovação')}</span>`],
      i.formato ? ['formato', 'Formato', esc(i.formato)] : null,
      o ? [`obj-${o}`, 'Objetivo', esc(E.ROTULO[o])] : null,
      ['ar', 'Vai ao ar', `<b class="${q.tom === 'r' ? 'r' : q.tom === 'a' ? 'a' : ''}">${esc(noAr || q.frase)}</b>`],
      prazo ? ['prazo', 'Prazo de ouro', esc(diaMes(prazo))] : null,
      i.horas == null ? null : ['espera', 'Esperando', `<b class="${i.horas >= 24 ? 'a' : ''}">${i.horas < 1 ? 'entrou agora' : esc(esperaHa(i.horas))}</b>`],
    ].filter(Boolean);
    const pessoas = [...fez.map((p) => ({ ...p, papel: p.papel === 'Fez a peça' ? 'Fez a peça' : p.papel })),
      ...heads.filter((h) => !fez.some((p) => p.nome === h)).map((nome) => ({ nome, papel: 'Head do cliente' }))]
      .filter((p, n, l) => l.findIndex((x) => x.nome === p.nome) === n).slice(0, 4);
    return `<article class="v2-carta v2c-carta d3a-ig"${pos ? ` data-pos="${pos}"` : ''} data-vc-carta="${k}" data-carteira="${esc(carteira || '')}" aria-hidden="${pos !== '0'}">
      <span class="d3a-arte-caixa"><button type="button" class="v2c-arte${thumb?.thumb ? '' : ' vazia'}" data-vc-apr-ver="${k}" title="Abrir a peça" aria-label="Abrir a peça: ${esc(i.titulo)}"${pos === '0' ? '' : ' tabindex="-1"'}>${i.formato ? `<span class="d3a-selo">${esc(i.formato)}</span>` : ''}${arte}</button></span>
      <div class="d3a-info">
        <p class="d3a-ig-tit"><b>${esc(nomeDaPeca(i))}</b><span>${cliHtml(i.cliente)}</span></p>
        <section class="d3a-ig-post" aria-label="Como fica no Instagram">
          <header class="d3a-ig-cab"><span class="d3a-ig-av">${ig.foto ? `<img src="${esc(ig.foto)}" alt="" loading="lazy">` : esc(ig.iniciais)}</span><b>${esc(ig.usuario || ig.nome)}</b><small>como fica no Instagram</small></header>
          <p class="d3a-ig-leg">${legenda ? `<b>${esc(ig.usuario || ig.nome)}</b> ${esc(legenda)}` : '<span class="d3a-ig-sem">A legenda ainda não foi escrita. O Augusto (Copy) sugere, ou escreva na peça.</span>'}</p>
        </section>
        ${pessoas.length ? `<section class="d3a-ig-quem" aria-label="Quem fez"><h4>Quem fez</h4>${pessoas.map((p) => `<span class="d3a-ig-pessoa">${avHtml(p)}<span><b>${esc(p.nome)}</b><small>${esc(p.papel)}</small></span></span>`).join('')}</section>` : ''}
        <dl class="d3a-ig-infos">${infos.map(([cor, r, v]) => `<div class="d3a-ig-info" data-cor="${esc(cor)}"><dt><i aria-hidden="true"></i>${r}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </div></article>`;
  }
  // O @ e a foto do cliente para o "como fica no Instagram": do cadastro e, se o Feed já leu o perfil, a foto de lá.
  function perfilDoCliente(cliente) {
    const nome = String(cliente || '').split(',')[0].trim();
    const linhas = typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : [];
    const linha = linhas.find((c) => normal(c.nome) === normal(nome)) || {};
    const bruto = String(linha.cadastro?.instagram || linha.instagram || '');
    const usuario = typeof feedUsuario === 'function' ? feedUsuario(bruto) : bruto.replace(/^@/, '').toLowerCase();
    const perfil = usuario && typeof FEED !== 'undefined' ? FEED.perfis?.get?.(usuario) : null;
    const foto = perfil && !perfil.erro && perfil.foto && typeof feedFotoIg === 'function' ? feedFotoIg(perfil.foto) : '';
    return { nome, usuario, foto, iniciais: nome.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() };
  }
  // O leque (Paulo, 15/11/2026: "melhora a forma de mostrar os conteúdos para aprovar... quero foda assim também", com o
  // card fan de referência): as artes da fila abertas como cartas na mão, a da vez de pé no meio, as anteriores à
  // esquerda e as próximas à direita. Passar de peça só troca as posições (--lp), e as cartas giram com mola.
  const LEQUE_LADO = 3;
  function lequeHtml(i, k) {
    const d = k - st.apr, a = Math.abs(d), ref = String(i.ref), thumb = st.thumbs[ref];
    if (a <= LEQUE_LADO && thumb === undefined) buscarThumb(ref);
    return `<button type="button" class="d3a-leque-c${d === 0 ? ' vez' : ''}" data-vc-leque="${k}" style="--lp:${d};--alp:${a}"${a > LEQUE_LADO ? ' hidden' : ''} tabindex="-1" title="${esc(nomeDaPeca(i))}" aria-label="Ver ${esc(nomeDaPeca(i))}">${i.formato ? `<span class="d3a-selo">${esc(i.formato)}</span>` : ''}${arteHtml(ref, thumb, '', a <= LEQUE_LADO)}</button>`;
  }
  // A fala do Augusto: quantas esperam, quantas veiculam amanhã e como está o mês. O botão aprova as de amanhã, uma por
  // vez, cada uma pelo portão de sempre.
  function falaHtml(f) {
    const mesAtual = st.mes === hoje().slice(0, 7);
    let frase = '', botao = '';
    if (!f) frase = esc(A()?.estado?.().erro || 'Carregando o que espera a sua aprovação…');
    else if (!f.fila.length) frase = `Nada esperando a sua aprovação.${f.comCliente ? ` ${plural(f.comCliente, 'peça está', 'peças estão')} com o cliente.` : ''}`;
    else {
      const n = f.fila.length, am = deAmanha(f.fila).length;
      frase = `<b><span${st.falaN === n ? '' : ' class="v2-num"'}>${plural(n, 'peça', 'peças')}</span></b> ${n === 1 ? 'espera' : 'esperam'} a sua aprovação${am ? `; ${am === n ? (n === 1 ? 'ela veicula' : 'todas veiculam') : am === 1 ? '1 delas veicula' : `${am} delas veiculam`} amanhã` : ''}.`;
      st.falaN = n;
      if (am) botao = `<button type="button" class="v2c-btn" data-vc-apr-lote>${am === 1 ? 'Aprovar a de amanhã' : `Aprovar as ${am} de amanhã`}</button>`;
    }
    if (pecasDoPainel().length) {
      const d = dadosDoMes(), g = d.atual.geral, cl = d.atual.clientes;
      if (g.total) {
        const classificadas = E.OBJETIVOS.reduce((s, o) => s + (g[o] || 0), 0);
        const falta = E.OBJETIVOS.map((o) => [o, cl.filter((c) => (c.falta || []).includes(o)).length]).sort((a, b) => b[1] - a[1])[0];
        const sobra = E.OBJETIVOS.map((o) => [o, g[o] || 0]).sort((a, b) => b[1] - a[1])[0];
        const partes = [sobra[1] && sobra[0] !== falta[0] && sobra[1] / classificadas >= 0.4 ? `sobra ${E.ROTULO[sobra[0]].toLowerCase()}` : '',
          falta[1] ? `<b>falta ${E.ROTULO[falta[0]].toLowerCase()} em ${plural(falta[1], 'cliente', 'clientes')}</b>` : ''].filter(Boolean);
        frase += ` ${mesAtual ? 'No mês' : `Em ${nomeDoMes(st.mes).toLowerCase()}`} ${g.total === 1 ? 'é 1 peça' : `são ${g.total} peças`}${partes.length ? `: ${partes.join(' e ')}` : ''}.`;
      } else frase += ` Nenhuma peça com data em ${nomeDoMes(st.mes).toLowerCase()}.`;
    }
    return `<section class="v2c-card v2c-fala" aria-label="Augusto, copy e conteúdo"><span class="v2c-ag" aria-hidden="true">A</span><p><span class="v2c-quem">Augusto · Copy e conteúdo</span>${frase}</p>${botao}</section>`;
  }
  // O bloco de ação da Direção 3: a frase curta do Augusto (quantas esperam e o que falta no mês) e um botão só. Com peça
  // que vai ao ar amanhã, o botão aprova as de amanhã (uma por vez, cada uma pelo portão); senão, abre o que falta.
  function acaoHtml(f) {
    let frase = '', botao = '';
    if (!f) frase = esc(A()?.estado?.().erro || 'Carregando o que espera a sua aprovação…');
    else {
      const n = f.fila.length, am = deAmanha(f.fila).length;
      // Uma frase por bloco e o botão faz o que a frase pede (acabamento 15/11): com peça de amanhã, a frase diz quantas
      // vão ao ar amanhã e o botão aprova; sem fila, o que falta no equilíbrio do mês e o botão abre os clientes.
      frase = n ? `<span${st.falaN === n ? '' : ' class="v2-num"'}>${plural(n, 'peça', 'peças')}</span> ${n === 1 ? 'espera' : 'esperam'} você${am ? `; ${am === 1 ? '1 vai' : `${am} vão`} ao ar amanhã` : ''}` : 'Nada esperando você';
      st.falaN = n;
      if (am) botao = `<button type="button" class="d3-acao-btn" data-vc-apr-lote>${am === 1 ? 'Aprovar a de amanhã' : `Aprovar as ${am} de amanhã`}</button>`;
      if (!n && pecasDoPainel().length) {
        const cl = dadosDoMes().atual.clientes;
        const falta = E.OBJETIVOS.map((o) => [o, cl.filter((c) => (c.falta || []).includes(o)).length]).sort((a, b) => b[1] - a[1])[0];
        if (falta?.[1]) { frase = `Nada esperando você; falta ${E.ROTULO[falta[0]].toLowerCase()} em ${plural(falta[1], 'cliente', 'clientes')} neste mês`; botao = `<button type="button" class="d3-acao-btn" data-vc-aba="equilibrio">${falta[1] === 1 ? 'Ver o cliente' : `Ver os ${falta[1]} clientes`}</button>`; }
      }
    }
    // Sem botão, a frase vai na nota branca: o laranja é só para ação.
    if (!botao) return `<section class="d3-nota d3a-acao" role="status"><span class="d3-nota-av" aria-hidden="true">A</span><span class="d3-nota-frase"><small class="d3a-quem">Augusto · Copy</small><span class="d3a-frase">${frase}${f ? '.' : ''}</span></span></section>`;
    return `<section class="d3-acao d3a-acao" aria-label="Augusto · Copy e conteúdo"><span class="d3-acao-av" aria-hidden="true">A</span><span class="d3-acao-frase"><small class="d3a-quem">Augusto · Copy</small><span class="d3a-frase">${frase}${f ? '.' : ''}</span></span>${botao}</section>`;
  }
  // Os quatro números: quantas esperam (e de quem), a mais antiga, as que estão com o cliente e as aprovadas pelo cliente.
  function numerosHtml(f) {
    const fila = f?.fila || [], nomes = [...new Set(fila.map((i) => String(i.cliente || '').split(',')[0].trim()).filter(Boolean))];
    const antiga = fila.reduce((m, i) => ((i.horas ?? -1) > (m?.horas ?? -1) ? i : m), null);
    const abertos = st.links?.clientes ? st.links.clientes.reduce((s, c) => s + (c.links?.length || 0), 0) : null;
    const d = pecasDoPainel().length ? dadosDoMes() : null;
    const num = ({ rotulo, valor, de = '', sub = '', tom = '', barra = null, attrs = '' }) => `<${attrs ? `button type="button" ${attrs}` : 'div'} class="d3-num d3a-num${tom ? ' ' + tom : ''}"><span class="d3-num-rot">${esc(rotulo)}</span><b class="d3-num-v">${valor}${de ? `<small>${de}</small>` : ''}</b>${barra == null ? '' : `<span class="d3-barra" style="--v:${Math.max(0, Math.min(100, Math.round(barra)))}%"><i></i></span>`}${sub ? `<span class="d3a-sub">${sub}</span>` : ''}</${attrs ? 'button' : 'div'}>`;
    const h = antiga?.horas;
    return `<div class="d3a-nums">${num({ rotulo: 'Esperando você', valor: fila.length, sub: esc(nomes.slice(0, 4).join(' · ')) + (nomes.length > 4 ? ` +${nomes.length - 4}` : ''), attrs: fila.length ? 'data-vc-apr-lista' : '' })}
      ${num({ rotulo: 'Mais antiga', valor: h == null ? '0' : h < 48 ? h : Math.round(h / 24), de: h == null ? '' : h < 48 ? ' h' : ' dias', tom: (h ?? 0) >= 24 ? 'a' : '', sub: antiga ? esc([quandoNoAr(antiga) ? `ar ${quandoNoAr(antiga)}` : quando(antiga).frase, String(antiga.cliente || '').split(',')[0].trim()].filter(Boolean).join(' · ')) : 'fila limpa' })}
      ${num({ rotulo: 'Com o cliente', valor: f?.comCliente || 0, sub: abertos == null ? '' : plural(abertos, 'link aberto', 'links abertos'), attrs: 'data-vc-aba="cliente"' })}
      ${num({ rotulo: 'Aprovadas pelo cliente', valor: d ? d.aprovadasAgora : 0, de: d ? ` / ${d.atual.geral.total}` : '', barra: d && d.atual.geral.total ? (d.aprovadasAgora * 100) / d.atual.geral.total : 0 })}</div>`;
  }
  // Coluna esquerda: o baralho, os dois botões e os pontos; "ver em lista" troca o baralho pela fila inteira.
  function mesaHtml(f) {
    if (!f) { const erro = A().estado().erro; if (!erro) A().atualizar(); return `<div class="v2c-mesa"><div class="v2c-card v2c-nada"><b>${esc(erro || 'Carregando o que espera aprovação…')}</b>${erro ? '<button type="button" class="v2c-btn" data-vc-apr-reler>Tentar de novo</button>' : ''}</div></div>`; }
    const { fila } = f;
    if (!fila.length) return '<div class="v2c-mesa"><div class="v2c-card v2c-nada"><b>Nada esperando a sua aprovação.</b><span>Quando uma peça entrar em Para aprovação, ela aparece aqui.</span></div></div>';
    st.apr = Math.max(0, Math.min(st.apr, fila.length - 1));
    if (st.aprLista) return `<div class="v2c-mesa"><section class="v2c-card v2c-lista" aria-label="Peças para aprovar">
        ${fila.map((i, k) => { const q = quando(i); return `<button type="button" class="v2c-lin" data-vc-apr-ir="${k}"${k === st.apr ? ' aria-current="true"' : ''}><span class="v2c-lin-txt">${cliHtml(i.cliente)}<span>${esc(nomeDaPeca(i))}</span></span><span class="v2c-pill ${q.tom}">${esc(q.curto)}</span></button>`; }).join('')}</section>
      <p class="v2c-conta"><span>${plural(fila.length, 'peça', 'peças')} · toque para decidir · <button type="button" class="v2c-link" data-vc-apr-lista>ver em baralho</button></span></p></div>`;
    const pontos = fila.length <= 12 ? `<span class="v2-pontos" aria-hidden="true">${fila.map((_, k) => `<i${k === st.apr ? ' class="on"' : ''}></i>`).join('')}</span>` : '';
    // Direção 3: o cartão "Para aprovar" com o baralho, ‹ Pedir alteração · Aprovar › embaixo e os pontos.
    return `<div class="v2c-mesa"><section class="d3a-card d3a-mesa" aria-label="Para aprovar"><div class="d3a-topo"><h3>Para aprovar</h3><span><b data-vc-apr-conta>${st.apr + 1} de ${fila.length}</b> · <button type="button" class="v2c-link" data-vc-apr-lista>ver em lista</button> · <button type="button" class="d3a-tela-cheia" data-vc-im-abrir>Aprovar em tela cheia</button></span></div>
        <div class="d3a-palco"><div class="d3a-leque">${fila.map(lequeHtml).join('')}</div><div class="v2-baralho vc-apr-baralho" aria-live="polite">${fila.map(cartaHtml).join('')}</div></div>
        <div class="v2c-acoes"><button type="button" class="v2c-btn d3a-passo" data-vc-apr-passo="-1" aria-label="Anterior"${st.apr <= 0 ? ' disabled' : ''}>‹</button><button type="button" class="v2c-btn g" data-vc-apr="alterar">Pedir alteração</button><button type="button" class="v2c-btn g k" data-vc-apr="aprovar">Aprovar</button><button type="button" class="v2c-btn d3a-passo" data-vc-apr-passo="1" aria-label="Próxima"${st.apr >= fila.length - 1 ? ' disabled' : ''}>›</button></div>
        <p class="v2c-conta">${pontos}</p></section></div>`;
  }
  // Fila (Direção 3): uma linha por peça, pela ordem da data do cliente, com o número, o cliente, o formato e há quanto
  // espera; embaixo, o que está com o cliente (abre os links).
  function filaHtml(f) {
    const fila = f?.fila || [], MAX = 4;
    const linhas = fila.slice(0, MAX).map((i, k) => `<button type="button" class="v2c-lin d3a-fila-lin" data-vc-apr-ir="${k}"${k === st.apr ? ' aria-current="true"' : ''}><span class="d3a-ord">${k + 1}</span><span class="v2c-lin-txt">${cliHtml(String(i.cliente || 'Sem cliente').split(',')[0].trim())}<span>· ${esc(String(i.titulo || 'Sem título').trim())}</span></span>${i.formato ? `<span class="d3a-pill">${esc(i.formato)}</span>` : ''}<span class="d3a-horas${(i.horas ?? 0) >= 24 ? ' a' : ''}">${i.horas == null ? esc(quando(i).curto) : i.horas < 1 ? 'agora' : esc(esperaHa(i.horas))}</span></button>`).join('');
    const mais = fila.length > MAX ? `<button type="button" class="d3a-mais" data-vc-apr-lista>+${fila.length - MAX}</button>` : '';
    const abertos = st.links?.clientes ? st.links.clientes.reduce((s, c) => s + (c.links?.length || 0), 0) : null;
    const aprovadas = pecasDoPainel().length ? dadosDoMes().aprovadasAgora : null;
    const chips = [f?.comCliente ? plural(f.comCliente, 'espera resposta', 'esperam resposta') : '', abertos == null ? '' : plural(abertos, 'link aberto', 'links abertos')].filter(Boolean)
      .map((t) => `<button type="button" class="d3a-chip" data-vc-aba="links">${esc(t)}</button>`).join('') + (aprovadas ? `<button type="button" class="d3a-chip g" data-vc-aba="links">${plural(aprovadas, 'aprovada', 'aprovadas')}</button>` : '');
    return `<section class="d3a-card v2c-fila" aria-label="Fila de aprovação"><div class="d3a-topo"><h3>Fila</h3><span>${!f ? '' : fila.length ? 'pela data do cliente' : 'fila limpa'}</span></div>
      <div class="d3a-fila">${linhas || '<p class="d3a-vazio">Nada esperando a sua aprovação.</p>'}${mais}</div>
      <div class="d3a-pe"><span>Com o cliente</span>${chips || '<button type="button" class="d3a-chip" data-vc-aba="links">Links de aprovação</button>'}</div></section>`;
  }
  // Equilíbrio do mês (Direção 3): os números de cada objetivo, a linha de cada um semana a semana (acumulada no mês),
  // os primeiros clientes com o que falta em pílula e o caminho para a aba inteira.
  function linhasDoMes(d) {
    const doMes = d.todas.filter((x) => E.dataDaPeca(x).startsWith(st.mes + '-'));
    const semanas = Math.ceil(new Date(Date.UTC(Number(st.mes.slice(0, 4)), Number(st.mes.slice(5)), 0)).getUTCDate() / 7);
    const series = [...E.OBJETIVOS, 'sem'].map((o) => {
      const n = Array(semanas).fill(0);
      doMes.forEach((x) => { const k = Math.min(semanas - 1, Math.floor((Number(E.dataDaPeca(x).slice(8, 10)) - 1) / 7)); if ((objetivoDe(x.id) || 'sem') === o) n[k]++; });
      let a = 0; return { o, v: n.map((x) => (a += x)) };
    });
    const W = 520, H = 70, pad = 4, max = Math.max(1, ...series.flatMap((x) => x.v));
    const px = (k) => pad + (k * (W - 2 * pad)) / Math.max(1, semanas - 1), py = (v) => H - pad - (v * (H - 2 * pad)) / max;
    const hojeSem = st.mes === hoje().slice(0, 7) ? Math.floor((Number(hoje().slice(8, 10)) - 1) / 7) : -1;
    let comp = 0;
    const linhas = series.map(({ o, v }) => {
      const pts = v.map((y, k) => [px(k), py(y)]);
      comp = Math.max(comp, pts.reduce((s, p, k) => (k ? s + Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) : 0), 0));
      const [ux, uy] = pts[pts.length - 1];
      return `<polyline class="d3a-l-${o}" points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}"/><circle class="d3a-l-${o}" cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="3"/>`;
    }).join('');
    return `<svg class="d3-graf d3a-graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="--d3-comp:${Math.ceil(comp)}" role="img" aria-label="Peças do mês por objetivo, semana a semana">${linhas}</svg>
      <p class="d3a-eixo">${Array.from({ length: semanas }, (_, k) => `<span${k === hojeSem ? ' class="on"' : ''}>sem ${k + 1}</span>`).join('')}</p>`;
  }
  function cartaoEquilibrio() {
    const topo = (sub) => `<div class="d3a-topo"><h3>Equilíbrio do mês</h3><span>${sub}</span></div>`;
    if (!pecasDoPainel().length) return `<section class="d3a-card v2c-eq" aria-label="Equilíbrio do mês">${topo('')}<p class="d3a-vazio">As peças ainda estão carregando.</p></section>`;
    const d = dadosDoMes(), g = d.atual.geral, cl = d.atual.clientes, ant = MESES[Number(E.mesAnterior(st.mes).slice(5)) - 1];
    const abrirAba = '<button type="button" class="d3a-chip" data-vc-aba="equilibrio">Abrir</button>';
    if (!cl.length) return `<section class="d3a-card v2c-eq" aria-label="Equilíbrio do mês">${topo(`${d.anterior.geral.total} em ${ant}`)}<p class="d3a-vazio">Nenhuma peça com data em ${esc(nomeDoMes(st.mes).toLowerCase())}.</p><div class="d3a-pe">${abrirAba}</div></section>`;
    const pontos = [...E.OBJETIVOS.map((o) => [g[o] || 0, E.ROTULO[o].toLowerCase(), o]), [g.sem || 0, 'sem objetivo', 'sem']];
    const linhas = cl.slice(0, 4).map((c) => {
      const r = E.resumoCurto(c), falta = c.falta || [];
      return `<button type="button" class="v2c-eq-lin d3a-eq-lin" data-vc-eq-cliente="${esc(c.cliente)}" title="${esc(c.frase)}">${cliHtml(c.cliente)}<span class="d3a-faltas">${falta.length ? falta.map((o) => `<span class="d3a-pill">falta ${esc(E.ROTULO[o].toLowerCase())}</span>`).join('') : `<span class="d3a-pill${r.tom === 'ok' ? ' g' : ''}">${esc(r.texto)}</span>`}</span></button>`;
    }).join('');
    const resto = cl.length - Math.min(4, cl.length), media = Math.round(g.total / cl.length);
    return `<section class="d3a-card v2c-eq" aria-label="Equilíbrio do mês">${topo(`${plural(g.total, 'peça', 'peças')} · ${d.anterior.geral.total} em ${ant}`)}
      <p class="d3a-leg">${pontos.map(([n, r, o]) => `<span class="d3a-l-${o}"><i aria-hidden="true"></i><b>${n}</b> ${r}</span>`).join('')}</p>
      <div class="d3a-linhas">${linhasDoMes(d)}</div>
      <div class="d3a-eq-lista">${linhas}</div>
      <div class="d3a-pe"><span>${resto > 0 ? `+ ${plural(resto, 'cliente', 'clientes')} · ` : ''}${plural(media, 'peça', 'peças')}/cliente</span>${abrirAba}</div></section>`;
  }
  function corpoAprovar() {
    if (!A()) return vazio('As aprovações não carregaram.', 'Recarregue a página para tentar de novo.');
    const f = filaParaAprovar();
    // Direção 3: o bloco laranja do Augusto, os quatro números e as duas colunas (o baralho; a fila e o equilíbrio).
    // A fala de antes (falaHtml) fica escrita para quem a chama de fora.
    return `<div class="v2c-apr d3a">${acaoHtml(f)}${numerosHtml(f)}<div class="v2c-cols">${mesaHtml(f)}<div class="v2c-lado">${filaHtml(f)}${cartaoEquilibrio()}</div></div></div>`;
  }

  // ---------- Direção V2 (pranchas V2-M-Aprovacao, -Com-o-Cliente, -Equilibrio e -Celular, aprovadas em 16/11/2026) ----------
  // No mundo, a janela é vidro fumê e cada aba tem o esqueleto da prancha. Para aprovar: a fila à esquerda (direto no
  // vidro), a arte da vez no centro com a próxima atrás, e à direita o cartão laranja com Aprovar e Pedir alteração, a
  // legenda como fica no Instagram, quem fez e os detalhes. Com o cliente (e Links, que mostra a mesma tela): cada
  // cliente com o link e as peças mandadas. Equilíbrio: o mix de cada cliente em uma linha. Os botões levam os mesmos
  // data-vc-* de antes: quem grava e quem passa de peça são as funções de sempre.
  const v2 = () => typeof document !== 'undefined' && Boolean(document.body?.classList.contains('mundo'));
  const V2_SETA = { antes: svg('<path d="M15 6l-6 6 6 6"/>'), depois: svg('<path d="M9 6l6 6-6 6"/>') };
  const fotoV2 = (nome) => (typeof pv2Foto === 'function' ? pv2Foto(String(nome || '').split(',')[0].trim()) : `<i class="d3v-foto" aria-hidden="true">${esc(String(nome || '?').trim().slice(0, 2).toUpperCase())}</i>`);
  const consV2 = (titulo, nota, corpo, attrs = '') => `<section class="d3m-cons"${attrs}><div class="d3m-cons-cab"><b>${esc(titulo)}</b><span>${nota}</span></div>${corpo}</section>`;
  const laranjaV2 = ({ quem, numero = '', selo = '', titulo, apoio = '', botoes = '' }) => `<section class="d3-acao d3m-laranja" aria-label="${esc(quem)}"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">A</span>${esc(quem)}</span>
      <span class="d3m-lar-txt">${selo ? `<span class="d3m-a-ap-selo">${esc(selo)}</span>` : ''}${numero !== '' ? `<b class="d3m-lar-num">${esc(String(numero))}</b>` : ''}<span class="d3-acao-frase">${esc(titulo)}</span>${apoio ? `<small>${esc(apoio)}</small>` : ''}</span>${botoes ? `<span class="d3m-lar-bts">${botoes}</span>` : ''}</section>`;
  const mesMinusculo = () => nomeDoMes(st.mes).toLowerCase();
  // A linha embaixo do título: o mês e o que a aba conta.
  function linhaV2() {
    const f = filaParaAprovar();
    if (st.aba === 'equilibrio') return `${mesMinusculo()} · atração, educação e conversão de cada cliente`;
    if (st.aba === 'cliente' || st.aba === 'links') {
      const ativos = st.links?.clientes ? st.links.clientes.reduce((s, c) => s + (c.links?.length || 0), 0) : null;
      return `${mesMinusculo()} · ${plural(f?.comCliente || 0, 'peça com o cliente', 'peças com o cliente')}${ativos == null ? '' : ` · ${plural(ativos, 'link ativo', 'links ativos')}`}`;
    }
    if (!f) return `${mesMinusculo()} · lendo o que espera você`;
    const n = f.fila.length, h = f.fila.reduce((m, i) => Math.max(m, i.horas ?? -1), -1);
    return `${mesMinusculo()} · ${n ? `${n} ${n === 1 ? 'espera' : 'esperam'} você` : 'nada esperando você'}${h >= 1 ? ` · a mais antiga há ${esperaHa(h)}` : ''}`;
  }
  function topoV2() {
    const f = filaParaAprovar(), nFila = f?.fila?.length, nCliente = f?.comCliente, mesAtual = st.mes === hoje().slice(0, 7);
    // As abas V2 são escolha única (rádio): a folha antiga pinta de preto, com força, todo [role="tab"] com aria-selected.
    const aba = (id, rot, n) => `<button type="button" role="radio" data-vc-aba="${id}" aria-checked="${st.aba === id}">${rot}${n ? ` <span class="d3a-n">${n}</span>` : ''}</button>`;
    return `<div class="v2c-topo d3m-a-ap-topo"><div class="d3m-a-ap-tit"><h2>Aprovação</h2><span class="d3m-a-ap-linha">${esc(linhaV2())}</span></div>
      <span class="d3m-a-vseg" role="radiogroup" aria-label="O que ver">${aba('aprovar', 'Para aprovar', nFila)}${aba('cliente', 'Com o cliente', nCliente)}${aba('equilibrio', 'Equilíbrio do mês')}${aba('links', 'Links')}</span>
      <span class="v2c-mes d3m-a-ap-mes" role="group" aria-label="Mês"><button type="button" class="d3m-ico" data-vc-mes="-1" aria-label="Mês anterior" title="Mês anterior">${V2_SETA.antes}</button>${mesAtual ? '' : `<button type="button" class="d3v-btn vidro v2c-mes-nome" data-vc-mes="0" title="${esc(nomeDoMes(st.mes))}: voltar para este mês">Este mês</button>`}<button type="button" class="d3m-ico" data-vc-mes="1" aria-label="Próximo mês" title="Próximo mês">${V2_SETA.depois}</button></span>
      <button type="button" class="d3m-ico" data-vc-como aria-expanded="${st.ajuda}" aria-label="Como funciona" title="Como funciona">${svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01"/>')}</button>
      <button type="button" class="d3m-ico" data-vc-fechar aria-label="Fechar (Esc)" title="Fechar (Esc)">${IC.fechar}</button></div>`;
  }
  // O resumo do mês que a coluna de consulta repete: as aprovadas pelo cliente e o equilíbrio em três barras.
  function mesV2() {
    if (!pecasDoPainel().length) return '';
    const d = dadosDoMes(), g = d.atual.geral, total = g.total || 0, classificadas = E.OBJETIVOS.reduce((s, o) => s + (g[o] || 0), 0) || 1;
    const nomeMes = MESES[Number(st.mes.slice(5)) - 1];
    return consV2(nomeMes[0].toUpperCase() + nomeMes.slice(1), `${d.aprovadasAgora} de ${total}`, `<div class="d3m-a-caixa d3m-a-ap-barra"><span class="d3m-vbarra" style="--v:${total ? Math.round(d.aprovadasAgora * 100 / total) : 0}%"><i></i></span><span>aprovadas pelo cliente</span></div>`)
      + consV2('Equilíbrio do mês', '<button type="button" class="d3m-a-ap-link" data-vc-aba="equilibrio">abrir</button>', `<div class="d3m-a-caixa">${E.OBJETIVOS.map((o) => { const p = Math.round((g[o] || 0) * 100 / classificadas); return `<span class="d3m-a-ap-obj" data-obj="${o}"><span>${esc(E.ROTULO[o])}</span><i class="d3m-vbarra" style="--v:${p}%"><i></i></i><b>${p}%</b></span>`; }).join('')}</div>`);
  }
  function miniV2(i, perto = true) {
    const ref = String(i.ref), thumb = st.thumbs[ref];
    if (perto && thumb === undefined) buscarThumb(ref);
    return `<span class="d3m-a-ap-mini${thumb?.thumb ? '' : ' vazia'}">${thumb?.thumb ? `<img src="${esc(thumb.thumb)}" alt="" loading="lazy" data-vc-previa="${esc(ref)}">` : esc(String(i.formato || i.titulo || '?').trim().slice(0, 2).toUpperCase())}</span>`;
  }
  // O título sem o formato na frente ("Reels - Treino de pernas" vira "Treino de pernas"): o formato já vai na etiqueta.
  const tituloV2 = (i) => { const t = String(i.titulo || 'Sem título').trim(), f = String(i.formato || '').trim(); const resto = f && normal(t).startsWith(normal(f)) ? t.slice(f.length).replace(/^[\s\-–:·|]+/, '') : ''; return resto || t; };
  const primeiroCliente = (i) => String(i.cliente || 'Sem cliente').split(',')[0].trim();
  // A coluna da esquerda: quem espera você, o que está com o cliente e o mês.
  function esquerdaV2(f) {
    const fila = f?.fila || [], comO = f?.comO || [], am = deAmanha(fila).length;
    const abertos = st.links?.clientes ? st.links.clientes.reduce((s, c) => s + (c.links?.length || 0), 0) : null;
    const item = (i, k) => `<button type="button" class="d3m-a-ap-item" data-vc-apr-ir="${k}"${k === st.apr ? ' aria-current="true"' : ''} title="${esc(nomeDaPeca(i))}">${miniV2(i, k < 8)}<span><b>${esc(tituloV2(i))}</b><span>${esc(primeiroCliente(i))}${i.formato ? ` · ${esc(i.formato)}` : ''}</span><small class="${(i.horas ?? 0) >= 24 ? 'r' : ''}">${i.horas == null ? esc(quando(i).frase) : i.horas < 1 ? 'entrou agora' : `${(i.horas ?? 0) >= 24 ? 'parada há' : 'há'} ${esc(esperaHa(i.horas))}`}</small></span></button>`;
    const doCliente = (i) => `<button type="button" class="d3m-a-ap-item" data-vc-aba="cliente" title="Ver o que está com o cliente">${miniV2(i)}<span><b>${esc(tituloV2(i))}</b><span>${esc(primeiroCliente(i))}${i.formato ? ` · ${esc(i.formato)}` : ''}</span><small>${i.horas == null ? 'com o cliente' : `enviado há ${esc(esperaHa(i.horas))}`}</small></span></button>`;
    return `<aside class="d3m-lado d3m-a-ap-esq" aria-label="Fila de aprovação">
      ${consV2('Esperando você', String(fila.length), `<div class="v2c-fila d3m-a-ap-fila">${fila.map(item).join('') || `<p class="d3m-vvazio">${f ? 'Nada esperando a sua aprovação.' : esc(A()?.estado?.().erro || 'Lendo o que espera você…')}</p>`}</div>${am ? `<button type="button" class="d3v-btn vidro d3m-a-ap-lote" data-vc-apr-lote>${am === 1 ? 'Aprovar a de amanhã' : `Aprovar as ${am} de amanhã`}</button>` : ''}`)}
      ${consV2('Com o cliente', abertos == null ? '' : plural(abertos, 'link aberto', 'links abertos'), comO.slice(0, 2).map(doCliente).join('') || '<button type="button" class="d3m-vlin" data-vc-aba="cliente"><span>Nada com o cliente agora</span></button>')}
      ${mesV2()}</aside>`;
  }
  // A arte no centro: a da vez de pé, a próxima atrás à direita. As posições são as mesmas variáveis do leque (--lp).
  function lequeV2(i, k) {
    const d = k - st.apr, a = Math.abs(d), ref = String(i.ref), thumb = st.thumbs[ref], ig = perfilDoCliente(i.cliente);
    if (a <= LEQUE_LADO && thumb === undefined) buscarThumb(ref);
    return `<button type="button" class="d3a-leque-c${d === 0 ? ' vez' : d === 1 ? ' prox' : ''}" data-vc-leque="${k}" style="--lp:${d};--alp:${a}"${a > LEQUE_LADO ? ' hidden' : ''} tabindex="-1" title="${esc(nomeDaPeca(i))}: abrir em tela cheia" aria-label="Ver ${esc(nomeDaPeca(i))}">`
      + `<span class="d3m-a-ap-ig"><i aria-hidden="true">${ig.foto ? `<img src="${esc(ig.foto)}" alt="" loading="lazy">` : esc(ig.iniciais)}</i><b>${esc(ig.usuario || ig.nome)}</b>${i.formato ? `<span class="d3m-a-ap-selo">${esc(i.formato)}</span>` : ''}</span>`
      + `<span class="d3m-a-ap-arte${thumb?.thumb ? '' : ' vazia'}">${arteHtml(ref, thumb, '', a <= LEQUE_LADO)}</span>${thumb?.thumb ? '' : `<span class="d3m-a-ap-nome"><b>${esc(tituloV2(i))}</b><small>${esc(primeiroCliente(i))}</small></span>`}</button>`;
  }
  // O que a peça da vez diz, à direita: o laranja com a decisão, a legenda, quem fez e os detalhes.
  function cartaV2(i, k, n) {
    const pos = k === st.apr ? '0' : k < st.apr ? 'fora' : String(Math.min(k - st.apr, 3));
    const o = objetivoDe(i.ref), q = quando(i), item = itemDoPainel(i), ig = perfilDoCliente(i.cliente);
    const legenda = String(item?.legenda || '').trim(), prazo = String(i.prazo || item?.prazo_iso || '').slice(0, 10), noAr = quandoNoAr(i);
    const fez = quemFez(i), heads = (i.heads || []).map((h) => h.nome).filter(Boolean);
    const pessoas = [...fez, ...heads.filter((h) => !fez.some((p) => p.nome === h)).map((nome) => ({ nome, papel: 'Head do cliente' }))].filter((p, x, l) => l.findIndex((y) => y.nome === p.nome) === x).slice(0, 3);
    const passou = prazo && prazo < hoje();
    const apoio = `${primeiroCliente(i)}.${i.horas == null ? '' : i.horas < 1 ? ' Entrou agora.' : ` ${i.horas >= 24 ? 'Parada' : 'Esperando'} há ${esperaHa(i.horas)}${passou ? ', passou do prazo de ouro' : ''}.`}`;
    const det = [o ? ['Objetivo', esc(E.ROTULO[o]), ''] : null, ['Vai ao ar', esc(noAr || q.frase), q.tom === 'r' ? 'r' : q.tom === 'a' ? 'a' : ''], prazo ? ['Prazo de ouro', esc(diaMes(prazo)), passou ? 'r' : ''] : null,
      i.horas == null ? null : ['Esperando', i.horas < 1 ? 'entrou agora' : esc(esperaHa(i.horas)), i.horas >= 24 ? 'a' : ''], ['Status', esc(i.status || 'Para aprovação'), '']].filter(Boolean);
    return `<article class="d3m-a-ap-carta" data-vc-carta="${k}" data-pos="${pos}" aria-hidden="${pos !== '0'}">
      ${laranjaV2({ quem: `Augusto · para aprovar, ${k + 1} de ${n}`, selo: i.formato || '', titulo: tituloV2(i), apoio, botoes: '<button type="button" class="d3m-btn l" data-vc-apr="aprovar">Aprovar</button><button type="button" class="d3m-btn l s" data-vc-apr="alterar">Pedir alteração</button>' })}
      ${consV2('Legenda', 'como fica no Instagram', `<p class="d3m-a-caixa d3m-a-ap-leg">${legenda ? `<b>${esc(ig.usuario || ig.nome)}</b> ${esc(legenda)}` : 'A legenda ainda não foi escrita. O Augusto (Copy) sugere, ou escreva na peça.'}</p>`)}
      ${pessoas.length ? consV2('Quem fez', '', pessoas.map((p) => `<p class="d3m-vlin d3m-a-ap-pes"><i class="d3m-pes" aria-hidden="true">${esc(String(p.nome || '?').trim().slice(0, 2).toUpperCase())}</i><span><b>${esc(String(p.nome).split(' ')[0])}</b> · ${esc(p.papel === 'Fez a peça' ? 'fez a peça' : 'head do cliente')}</span></p>`).join('')) : ''}
      ${consV2('Detalhes', `<button type="button" class="d3m-a-ap-link" data-vc-apr-ver="${k}"${pos === '0' ? '' : ' tabindex="-1"'}>abrir a peça</button>`, `<dl class="d3m-a-caixa d3m-a-ap-det">${det.map(([r, v, tom]) => `<div><dt>${r}</dt><dd${tom ? ` class="${tom}"` : ''}>${v}</dd></div>`).join('')}</dl>`)}
    </article>`;
  }
  function corpoAprovarV2() {
    if (!A()) return vazio('As aprovações não carregaram.', 'Recarregue a página para tentar de novo.');
    const f = filaParaAprovar(), fila = f?.fila || [], n = fila.length;
    if (!f) { const erro = A().estado().erro; if (!erro) A().atualizar(); }
    if (n) st.apr = Math.max(0, Math.min(st.apr, n - 1));
    const pontos = n > 1 && n <= 12 ? `<span class="v2-pontos" aria-hidden="true">${fila.map((_, k) => `<i${k === st.apr ? ' class="on"' : ''}></i>`).join('')}</span>` : '';
    const erro = !f ? A().estado().erro : '';
    const meio = !f ? `<div class="d3v-estado${erro ? ' erro' : ''}"><b>${esc(erro || 'Carregando o que espera aprovação…')}</b>${erro ? '<button type="button" class="d3v-btn vidro" data-vc-apr-reler>Tentar de novo</button>' : ''}</div>`
      : !n ? '<div class="d3v-estado"><b>Nada esperando a sua aprovação.</b>Quando uma peça entrar em Para aprovação, ela aparece aqui.</div>'
      : st.aprLista ? `<section class="d3m-a-folha v2c-lista d3m-a-ap-lista" aria-label="Peças para aprovar"><div class="d3m-a-cab"><h3 class="d3m-a-so"><span>Para aprovar</span> <span>· ${plural(n, 'peça', 'peças')}, pela data do cliente</span></h3><button type="button" class="d3m-a-filtro" data-vc-apr-lista>ver a arte</button></div>
          <div class="d3m-a-ap-linhas">${fila.map((i, k) => { const q = quando(i); return `<button type="button" class="d3m-a-ap-lin" data-vc-apr-ir="${k}"${k === st.apr ? ' aria-current="true"' : ''}>${fotoV2(i.cliente)}<span><b>${esc(primeiroCliente(i))}</b> · ${esc(nomeDaPeca(i))}</span><small class="${q.tom === 'r' ? 'r' : ''}">${esc(q.curto)}</small></button>`; }).join('')}</div></section>`
      : `<button type="button" class="d3m-ico d3a-passo" data-vc-apr-passo="-1" aria-label="Peça anterior"${st.apr <= 0 ? ' disabled' : ''}>${V2_SETA.antes}</button>
        <div class="d3a-leque vc-apr-baralho d3m-a-ap-leque" aria-live="polite">${fila.map(lequeV2).join('')}</div>
        <button type="button" class="d3m-ico d3a-passo" data-vc-apr-passo="1" aria-label="Próxima peça"${st.apr >= n - 1 ? ' disabled' : ''}>${V2_SETA.depois}</button>
        <p class="d3m-a-ap-pe">${pontos}<b data-vc-apr-conta>${st.apr + 1} de ${n}</b><span class="d3m-a-ap-dica">A aprova · R pede alteração · setas trocam de peça</span><button type="button" class="d3m-a-ap-link" data-vc-im-abrir>tela cheia</button><button type="button" class="d3m-a-ap-link" data-vc-apr-lista>ver em lista</button></p>`;
    // Sem fila, a direita diz o que o mês pede (o que falta no equilíbrio), sem laranja: o laranja é só para decidir.
    let direita = fila.map((i, k) => cartaV2(i, k, n)).join('');
    if (!n && f) {
      const cl = pecasDoPainel().length ? dadosDoMes().atual.clientes : [];
      const falta = E.OBJETIVOS.map((o) => [o, cl.filter((c) => (c.falta || []).includes(o)).length]).sort((a, b) => b[1] - a[1])[0];
      direita = consV2('Augusto · Copy', '', `<p class="d3m-a-caixa d3m-a-ap-leg">Nada esperando você.${falta?.[1] ? ` Falta ${esc(E.ROTULO[falta[0]].toLowerCase())} em ${plural(falta[1], 'cliente', 'clientes')} neste mês.` : ''}${f.comCliente ? ` ${plural(f.comCliente, 'peça está', 'peças estão')} com o cliente.` : ''}</p>${falta?.[1] ? `<button type="button" class="d3m-vlin" data-vc-aba="equilibrio"><span><b>Equilíbrio do mês</b> · ver ${falta[1] === 1 ? 'o cliente' : `os ${falta[1]} clientes`}</span>${V2_SETA.depois}</button>` : ''}`);
    }
    return `<div class="v2c-apr d3m-a-ap${st.aprLista ? ' em-lista' : ''}">${esquerdaV2(f)}<div class="v2c-mesa d3m-a-ap-meio">${meio}</div><div class="d3m-lado d3m-a-ap-dir">${direita}</div></div>`;
  }
  // Com o cliente (e a aba Links): cada cliente numa folha, com o link, a validade e as peças que foram para ele.
  function corpoClienteV2() {
    const f = filaParaAprovar(), comO = f?.comO || [], d = st.links;
    const chave = (n) => normal(String(n || '').split(',')[0]);
    const erro = st.erroLinks ? `<div class="d3v-estado erro"><b>${esc(st.erroLinks)}</b><button type="button" class="d3v-btn sec" data-vc-recarregar-links>Tentar de novo</button></div>` : '';
    const clientes = d?.clientes || [];
    const pecasDe = (nome) => comO.filter((i) => chave(i.cliente) === chave(nome));
    const semCadastro = comO.filter((i) => !clientes.some((c) => chave(c.nome) === chave(i.cliente)));
    const peca = (i) => `<span class="d3m-a-cl-peca">${miniV2(i)}<span><b>${esc(tituloV2(i))}</b><small>${i.formato ? `${esc(i.formato)} · ` : ''}${i.horas == null ? esc(quando(i).frase) : `esperando há ${esc(esperaHa(i.horas))}`}</small></span></span>`;
    const validade = (c) => `<label class="vc-validade d3m-a-cl-val">Validade <select data-vc-dias="${esc(c.id)}"><option value="7">7 dias</option><option value="14" selected>14 dias</option><option value="30">30 dias</option></select></label>`;
    const gerar = (c, forte) => `<button type="button" class="d3v-btn${forte ? '' : ' sec'} s" data-vc-gerar="${esc(c.id)}"${d?.pronto === false || st.gerando ? ' disabled' : ''}>Gerar link</button>`;
    const novo = (c) => (st.novoLink && chave(st.novoLink.cliente) === chave(c.nome) ? `<div class="vc-novo-link d3m-a-cl-novo" role="status"><b>Link pronto</b><span>Copie e mande pelo canal de sempre. Ele aparece só agora.</span><span class="vc-novo-linha"><input readonly value="${esc(st.novoLink.link)}" aria-label="Link de aprovação" data-vc-link-campo><button type="button" class="d3v-btn s" data-vc-copiar>Copiar o link</button></span></div>` : '');
    const comAlgo = clientes.filter((c) => c.links?.length || c.pendentes || pecasDe(c.nome).length), semNada = clientes.filter((c) => !comAlgo.includes(c));
    const folha = (c) => { const l = c.links?.[0], pecas = pecasDe(c.nome);
      const estado = !l ? ['', 'Sem link ativo'] : l.ultimo_acesso_em ? ['roxo', `Aberto${l.respostas ? `, ${plural(l.respostas, 'resposta', 'respostas')}` : ', sem resposta'}`] : ['r', 'Link ainda não aberto'];
      return `<section class="d3m-a-folha d3m-a-cl" aria-label="${esc(c.nome)}"><div class="d3m-a-cab d3m-a-cl-cab">${fotoV2(c.nome)}<span class="d3m-a-cl-nome"><b>${esc(c.nome)}</b><small>${l ? `link gerado por ${esc(l.criado_por || 'alguém do time')} · vale até ${esc(dataHora(l.expira_em))} · ${l.respostas ? plural(l.respostas, 'resposta', 'respostas') : 'nenhuma resposta'}` : c.pendentes ? `${plural(c.pendentes, 'peça esperando', 'peças esperando')} o cliente, sem link` : 'nada esperando o cliente'}</small></span>
          <span class="d3v-st d3m-a-cl-st"><i${estado[0] ? ` class="${estado[0]}"` : ''} aria-hidden="true"></i>${estado[1]}</span>${validade(c)}${gerar(c, !l)}${(c.links || []).map((x, n) => `<button type="button" class="d3v-btn sec s" data-vc-revogar="${esc(x.id)}" title="Desligar o link${c.links.length > 1 ? ` ${n + 1}` : ''} (vale até ${esc(dataHora(x.expira_em))})">Desligar${c.links.length > 1 ? ` ${n + 1}` : ''}</button>`).join('')}</div>
        ${novo(c)}${pecas.length ? `<div class="d3m-a-cl-pecas">${pecas.map(peca).join('')}</div>` : ''}</section>`; };
    const resto = semNada.length ? `<section class="d3m-a-folha d3m-a-cl" aria-label="Mandar mais peças ao cliente"><div class="d3m-a-cab"><h3 class="d3m-a-so"><span>Mandar mais peças ao cliente</span> <span>· o link reúne o que estiver em aprovação do cliente</span></h3></div>
        <div class="d3m-a-cl-resto">${semNada.map((c) => `<div class="d3m-a-cl-lin">${fotoV2(c.nome)}<b>${esc(c.nome)}</b>${validade(c)}${gerar(c, false)}${novo(c)}</div>`).join('')}</div></section>` : '';
    const soltas = semCadastro.length ? `<section class="d3m-a-folha d3m-a-cl" aria-label="Peças com o cliente"><div class="d3m-a-cab"><h3 class="d3m-a-so"><span>Com o cliente</span> <span>· ${plural(semCadastro.length, 'peça', 'peças')} de cliente em que você não gera link</span></h3></div><div class="d3m-a-cl-pecas">${semCadastro.map((i) => peca({ ...i, titulo: `${primeiroCliente(i)} · ${tituloV2(i)}` })).join('')}</div></section>` : '';
    const aviso = d && d.pronto === false && !(st.pronto === false) ? avisoParte(d.aviso) : '';
    const principal = erro || (!d ? '<div class="d3v-estado"><b>Carregando os clientes…</b></div>'
      : aviso + (comAlgo.map(folha).join('') + soltas + resto || '<div class="d3v-estado"><b>Você ainda não é head de nenhum cliente.</b>O link de aprovação é gerado pelo head do cliente ou por quem administra.</div>'));
    // A coluna de consulta: a peça que espera há mais tempo, os números do mês e o que esta aba é.
    const antiga = comO.reduce((m, i) => ((i.horas ?? -1) > (m?.horas ?? -1) ? i : m), null);
    const dono = antiga ? clientes.find((c) => chave(c.nome) === chave(antiga.cliente)) : null;
    const ativos = clientes.reduce((s, c) => s + (c.links?.length || 0), 0);
    const aprovadas = pecasDoPainel().length ? dadosDoMes().aprovadasAgora : 0;
    const laranja = antiga && antiga.horas != null ? laranjaV2({ quem: `Augusto · ${dono?.links?.length ? (dono.links[0].ultimo_acesso_em ? 'esperando resposta' : 'link sem abrir') : 'sem link'}`, numero: esperaHa(antiga.horas), titulo: `e ${primeiroCliente(antiga)} ainda não respondeu`, apoio: `${antiga.formato ? `${antiga.formato}, ` : ''}${tituloV2(antiga)}.${dono?.links?.length ? ` O link vale até ${dataHora(dono.links[0].expira_em)}.` : ''}`,
      botoes: dono ? `<button type="button" class="d3m-btn l" data-vc-gerar="${esc(dono.id)}"${d?.pronto === false || st.gerando ? ' disabled' : ''}>${dono.links?.length ? 'Gerar outro link' : 'Gerar o link'}</button>` : '' }) : '';
    const nomeMes = MESES[Number(st.mes.slice(5)) - 1];
    const lado = `${laranja}${consV2(nomeMes[0].toUpperCase() + nomeMes.slice(1), 'com o cliente', `<div class="d3m-a-cl-nums"><span><b>${comO.length}</b>esperando</span><span><b>${aprovadas}</b>aprovadas</span><span><b>${ativos}</b>${ativos === 1 ? 'link ativo' : 'links ativos'}</span></div>`)}
      <section class="d3m-cons d3m-a-nota-v"><div class="d3m-cons-cab"><b>Links e Com o cliente são um só</b></div><p>Cada link aparece aqui com o que foi mandado nele. Depois de gerado, o endereço aparece uma vez só: copie na hora.</p></section>
      <section class="d3m-cons d3m-a-nota-v"><div class="d3m-cons-cab"><b>Onde o cliente aprova</b></div><p>A grade do mês fica no VybeHub. Este link é para peça avulsa, quando não dá para esperar a grade.</p></section>`;
    return `<div class="d3m-a-cl-tela"><div class="d3m-a-cl-meio">${principal}</div><aside class="d3m-lado d3m-a-ap-dir" aria-label="Consulta">${lado}</aside></div>`;
  }
  // Equilíbrio do mês: o mix de cada cliente numa linha (foto, a barra de atração, educação e conversão, as peças e o que
  // falta); clicar no cliente abre o calendário dele no lugar, como antes.
  function corpoEquilibrioV2() {
    if (!pecasDoPainel().length) return '<div class="d3v-estado"><b>As peças ainda estão carregando.</b>Assim que o painel trouxer a produção, o equilíbrio aparece aqui.</div>';
    const d = dadosDoMes(), g = d.atual.geral, a = d.anterior.geral, cls = d.atual.clientes, ant = MESES[Number(E.mesAnterior(st.mes).slice(5)) - 1];
    if (st.cliente && !cls.some((c) => normal(c.cliente) === normal(st.cliente))) { st.cliente = ''; st.peca = ''; }
    const legenda = `<span class="d3m-a-eq-leg d3m-a-mx-leg" aria-hidden="true">${E.OBJETIVOS.map((o) => `<span><i data-obj="${o}"></i>${E.ROTULO[o].toLowerCase()}</span>`).join('')}<span><i data-obj="sem"></i>sem objetivo</span></span>`;
    const linhas = cls.map((c) => {
      const cl = c.total || 1, aberto = normal(c.cliente) === normal(st.cliente), r = E.resumoCurto(c);
      return `<button type="button" class="d3m-a-mx-lin vc-eq-linha${aberto ? ' ativo' : ''}" role="listitem" data-vc-cliente="${esc(c.cliente)}" aria-expanded="${aberto}" title="${esc(c.frase)}. ${aberto ? 'Fechar o calendário' : 'Ver o calendário do cliente'}">${fotoV2(c.cliente)}<b class="d3m-a-mx-nome">${esc(c.cliente)}</b>
          <span class="d3m-a-mx-barra" role="img" aria-label="${esc(c.frase)}">${E.OBJETIVOS.map((o) => (c[o] ? `<i data-obj="${o}" style="flex-grow:${c[o]}"></i>` : '')).join('')}${c.sem ? `<i data-obj="sem" style="flex-grow:${c.sem}"></i>` : ''}</span><span class="d3m-a-mx-n">${cl}</span><span class="d3m-a-mx-falta${r.tom === 'ok' ? ' g' : ''}">${esc(r.texto)}</span></button>`
        + (aberto ? `<div class="vc-eq-detalhe d3m-a-mx-det"><div class="vc-grade${st.peca ? ' com-previa' : ''}"><div class="vc-cal-caixa">${calendario(d)}</div>${st.peca ? `<div class="vc-previa">${previa(d)}</div>` : ''}</div></div>` : '');
    }).join('');
    const folha = `<section class="d3m-a-folha d3m-a-mx" aria-label="O mix de cada cliente"><div class="d3m-a-cab"><h3 class="d3m-a-so"><span>O mix de cada cliente</span> <span>· ${plural(g.total, 'peça', 'peças')} em ${esc(MESES[Number(st.mes.slice(5)) - 1])}</span></h3>${legenda}</div>
        ${cls.length ? `<div class="d3m-a-mx-cab" aria-hidden="true"><span>Cliente</span><span>Atração, educação e conversão</span><span>Peças</span><span>O que falta</span></div><div class="d3m-a-mx-lista vc-eq-lista" role="list" aria-label="Clientes do mês">${linhas}</div>`
          : `<div class="d3v-estado"><b>Nenhuma peça com data em ${esc(nomeDoMes(st.mes))}.</b>Cadastre os conteúdos do mês e marque o objetivo de cada um.<button type="button" class="d3v-btn sec" data-vc-novo>Novo conteúdo</button></div>`}
        <div class="d3m-a-pe"><span>No mês</span>${E.OBJETIVOS.map((o) => `<span><b>${g[o] || 0}</b>${esc(E.ROTULO[o].toLowerCase())}</span>`).join('')}<span><b${g.sem ? ' class="a"' : ''}>${g.sem || 0}</b>sem objetivo</span></div></section>`;
    const comFalta = cls.filter((c) => (c.falta || []).length), primeiro = comFalta[0];
    const laranja = comFalta.length ? laranjaV2({ quem: 'Augusto · o mix do mês', numero: comFalta.length, titulo: `${comFalta.length === 1 ? 'cliente sem mistura' : 'clientes sem mistura'} no mês`, apoio: `${g.sem ? `${plural(g.sem, 'peça está', 'peças estão')} sem objetivo marcado. ` : ''}Falta ao menos um objetivo em cada um deles.`,
      botoes: `<button type="button" class="d3m-btn l" data-vc-cliente="${esc(primeiro.cliente)}">Ver ${esc(primeiro.cliente.split(' ')[0])}</button><button type="button" class="d3m-btn l s" data-vc-novo>Novo conteúdo</button>` }) : '';
    const maior = Math.max(1, ...E.OBJETIVOS.map((o) => Math.max(g[o] || 0, a[o] || 0)));
    const sinal = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
    const contra = consV2(`Contra ${ant}`, 'peças', `<div class="d3m-a-caixa">${E.OBJETIVOS.map((o) => `<span class="d3m-a-ap-obj" data-obj="${o}"><span>${esc(E.ROTULO[o])}</span><i class="d3m-vbarra" style="--v:${Math.round((g[o] || 0) * 100 / maior)}%"><i></i></i><b>${sinal((g[o] || 0) - (a[o] || 0))}</b></span>`).join('')}</div>`);
    const dif = d.aprovadasAgora - d.aprovadasAntes;
    const aprov = consV2('Aprovadas pelo cliente', `${d.aprovadasAgora} de ${g.total}`, `<div class="d3m-a-caixa d3m-a-ap-barra"><span class="d3m-vbarra" style="--v:${g.total ? Math.round(d.aprovadasAgora * 100 / g.total) : 0}%"><i></i></span><span>${dif > 0 ? `${dif} a mais que em ${ant}` : dif < 0 ? `${Math.abs(dif)} a menos que em ${ant}` : `igual a ${ant}`}</span></div>`);
    const abrir = consV2('Abrir', '', `<button type="button" class="d3m-vlin" data-vc-planejamentos onclick="window.mundoVoxel?.irPara?.('planejamentos')"><span><b>Planejamentos</b> · o mix nasce lá</span>${V2_SETA.depois}</button>`);
    return `<div class="d3m-a-cl-tela"><div class="d3m-a-cl-meio d3m-a-mx-meio">${folha}</div><aside class="d3m-lado d3m-a-ap-dir" aria-label="Consulta">${laranja}${contra}${aprov}${abrir}</aside></div>`;
  }
  // Passar de carta mexe só nas posições (data-pos): é a troca que anima. A tela inteira só é refeita quando a fila muda.
  function passar(para) {
    const fila = filaParaAprovar()?.fila || [], el = janela();
    const novo = Math.max(0, Math.min(para, fila.length - 1));
    if (novo === st.apr || !fila.length) return;
    st.apr = novo;
    const faltaThumb = fila.slice(Math.max(0, novo - LEQUE_LADO), novo + LEQUE_LADO + 1).some((i) => st.thumbs[String(i.ref)] === undefined);
    if (faltaThumb || st.aprLista) return pintar(); // a prévia das que chegaram é pedida no desenho
    el.querySelectorAll('[data-vc-carta]').forEach((c) => { const k = Number(c.dataset.vcCarta), pos = posDaCarta(k);
      if (pos) c.dataset.pos = pos; else delete c.dataset.pos;
      c.setAttribute('aria-hidden', String(pos !== '0')); const b = c.querySelector('[data-vc-apr-ver]'); if (b) { if (pos === '0') b.removeAttribute('tabindex'); else b.tabIndex = -1; } });
    el.querySelectorAll('.v2c-mesa .v2-pontos > i').forEach((p, k) => p.classList.toggle('on', k === novo));
    // O leque gira: cada arte vai para a posição nova (a transição do CSS faz o resto).
    el.querySelectorAll('[data-vc-leque]').forEach((c) => { const d = Number(c.dataset.vcLeque) - novo, a = Math.abs(d);
      c.style.setProperty('--lp', d); c.style.setProperty('--alp', a); c.hidden = a > LEQUE_LADO; c.classList.toggle('vez', d === 0); c.classList.toggle('prox', d === 1); });
    // A linha destacada da Fila acompanha a carta da frente.
    el.querySelectorAll('.v2c-fila [data-vc-apr-ir]').forEach((l) => { if (Number(l.dataset.vcAprIr) === novo) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
    const conta = el.querySelector('[data-vc-apr-conta]'); if (conta) conta.textContent = `${novo + 1} de ${fila.length}`;
    el.querySelectorAll('[data-vc-apr-passo]').forEach((b) => { b.disabled = Number(b.dataset.vcAprPasso) < 0 ? novo <= 0 : novo >= fila.length - 1; });
  }
  const abrirDaFila = (i) => { const abre = i.quadro === 'demandas' ? globalThis.openDemandaWorkspace : globalThis.openItemWorkspace; if (typeof abre === 'function') abre(i.ref); };
  function decidir(acao, doLote = false) {
    if (!doLote) st.lote = [];
    const i = (filaParaAprovar()?.fila || [])[st.apr]; if (!i) return;
    const d = decisaoDaFila(i, acao);
    // Só quando não há como decidir daqui (a peça não está no painel, o quadro não tem o destino ou o portão não
    // carregou) a peça abre, com o motivo.
    if (!d.opcao) { st.lote = []; toast(`Abri a peça: ${d.motivo}.`, 'info'); return abrirDaFila(i); }
    d.portao(d.item, d.opcao);
  }
  // "Aprovar as de amanhã": a primeira abre o portão; quando ela sai da fila (o portão gravou), abre o da seguinte.
  // Passar de carta, trocar de aba ou decidir outra peça encerra a sequência.
  const porCimaDaJanela = () => document.getElementById('workspace-drawer') || document.getElementById('fc-overlay') || document.getElementById('workflow-modal') || document.querySelector('.workflow-modal-overlay');
  function seguirLote() {
    const fila = filaParaAprovar()?.fila || [];
    st.lote = st.lote.filter((ref) => fila.some((i) => String(i.ref) === ref));
    if (!st.lote.length || !st.aberto || st.aba !== 'aprovar') { st.lote = []; return; }
    const k = fila.findIndex((i) => String(i.ref) === st.lote[0]);
    st.loteRef = st.lote[0];
    if (k !== st.apr || st.aprLista) { st.apr = k; st.aprLista = false; pintar(); }
    decidir('aprovar', true);
  }
  function tentarLote(vez = 0) {
    if (!st.lote.length) return;
    const fila = filaParaAprovar()?.fila || [];
    if (fila.some((i) => String(i.ref) === st.loteRef)) return; // a que está no portão ainda não saiu da fila
    if (porCimaDaJanela()) { if (vez < 20) setTimeout(() => tentarLote(vez + 1), 500); else st.lote = []; return; }
    seguirLote();
  }
  // A primeira leitura das aprovações pode ter sido antes do login: sem dados, abrir a aba lê de novo na hora.
  const relerFila = (forcar = false) => A()?.atualizar?.(forcar || !A().estado().dados);
  document.addEventListener('vybe:aprovacoes', () => { if (st.aberto) { pintar(); tentarLote(); } });
  // No toque não há setas: arrastar o baralho para o lado passa a peça.
  let arrasto = null, arrastouEm = 0;
  document.addEventListener('pointerdown', (e) => { arrasto = e.target.closest?.('#vv-conteudo .vc-apr-baralho') ? { x: e.clientX, y: e.clientY } : null; }, true);
  document.addEventListener('pointerup', (e) => {
    if (!arrasto) return;
    const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y; arrasto = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    arrastouEm = Date.now(); st.lote = []; passar(st.apr + (dx < 0 ? 1 : -1));
  }, true);

  // ---------- Equilíbrio ----------
  // Redesign (quadro 16, 10/11/2026): o equilíbrio é uma barra por cliente (atração, educação, conversão) com o que falta
  // em poucas palavras; a legenda fica no topo e o calendário do cliente abre só ao clicar nele (clicar de novo fecha).
  function corpoEquilibrio() {
    if (!pecasDoPainel().length) return vazio('As peças ainda estão carregando.', 'Assim que o painel trouxer a produção, o equilíbrio aparece aqui.');
    const d = dadosDoMes();
    const mesNav = `<div class="vc-mes">${st.mes !== hoje().slice(0, 7) ? '<button type="button" class="v2c-btn" data-vc-mes="0">Este mês</button>' : ''}${resumoDoMes(d)}</div>`;
    if (!d.atual.clientes.length) return mesNav + vazio(`Nenhuma peça com data em ${nomeDoMes(st.mes)}.`, 'Cadastre os conteúdos do mês e marque o objetivo de cada um para ver o equilíbrio.', '<button type="button" class="vc-acao" data-vc-novo>Novo conteúdo</button>');
    if (st.cliente && !d.atual.clientes.some((c) => normal(c.cliente) === normal(st.cliente))) { st.cliente = ''; st.peca = ''; }
    const linhas = d.atual.clientes.map((c) => {
      const cl = c.total || 1, aberto = normal(c.cliente) === normal(st.cliente), r = E.resumoCurto(c);
      const linha = `<button type="button" class="vc-eq-linha${aberto ? ' ativo' : ''}" role="listitem" data-vc-cliente="${esc(c.cliente)}" aria-expanded="${aberto}" title="${esc(aberto ? 'Fechar o calendário' : 'Ver o calendário do cliente')}">
        <span class="vc-eq-nome">${cliCor(c.cliente)}</span>
        <span class="vc-eq-barra"><span class="vc-barra" role="img" aria-label="${esc(c.frase)}">${E.OBJETIVOS.map((o) => `<i style="--c:${E.COR[o]};width:${(c[o] / cl) * 100}%"></i>`).join('')}<i class="sem" style="width:${(c.sem / cl) * 100}%"></i></span><small>${esc(c.frase)}</small></span>
        <span class="vc-eq-falta ${r.tom}">${esc(r.texto)}</span></button>`;
      return linha + (aberto ? `<div class="vc-eq-detalhe"><div class="vc-grade${st.peca ? ' com-previa' : ''}"><div class="vc-cal-caixa">${calendario(d)}</div>${st.peca ? `<div class="vc-previa">${previa(d)}</div>` : ''}</div></div>` : '');
    }).join('');
    return mesNav + `<div class="vc-eq">${legendaObjetivos()}<div class="vc-eq-lista" role="list" aria-label="Clientes do mês">${linhas}</div></div>`;
  }
  function calendario(d) {
    const pecas = d.todas.filter((x) => E.dataDaPeca(x).startsWith(st.mes + '-') && clientesDe(x).some((c) => normal(c) === normal(st.cliente)));
    const porDia = new Map();
    for (const p of pecas) { const dia = E.dataDaPeca(p); if (!porDia.has(dia)) porDia.set(dia, []); porDia.get(dia).push(p); }
    const [ano, mes] = st.mes.split('-').map(Number);
    const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay(), dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const vazios = (primeiro + 6) % 7, h = hoje();
    let celulas = Array.from({ length: vazios }, () => '<div class="vc-dia fora" aria-hidden="true"></div>').join('');
    for (let n = 1; n <= dias; n++) {
      const iso = `${st.mes}-${String(n).padStart(2, '0')}`, doDia = porDia.get(iso) || [];
      celulas += `<div class="vc-dia${iso === h ? ' hoje' : ''}"><span class="vc-dia-n">${n}</span><span class="vc-pontos">${doDia.map((p) => {
        const o = objetivoDe(p.id), et = d.etapaDe(p);
        return `<button type="button" class="vc-ponto${String(p.id) === st.peca ? ' ativo' : ''}" data-vc-peca="${esc(p.id)}" style="--c:${o ? E.COR[o] : '#B9B2A6'}" title="${esc(`${p.nome || 'Peça'} · ${o ? E.ROTULO[o] : 'sem objetivo'}${et ? ' · ' + E.ROTULO_ETAPA[et] : ''}`)}" aria-label="${esc(p.nome || 'Peça')}">${et ? `<span class="vc-etapa ${et}" aria-hidden="true"></span>` : ''}</button>`;
      }).join('')}</span></div>`;
    }
    const c = d.atual.clientes.find((x) => normal(x.cliente) === normal(st.cliente));
    return `<div class="vc-cal-topo"><b>${esc(st.cliente)}</b><small>${esc(c?.frase || '')}</small></div>
      <div class="vc-cal" role="grid" aria-label="Calendário de ${esc(st.cliente)}">${['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((s) => `<span class="vc-sem">${s}</span>`).join('')}${celulas}</div>
      <div class="vc-legenda"><span class="vc-leg-grupo">${E.OBJETIVOS.map((o) => `<span><i class="vc-leg-ponto" style="--c:${E.COR[o]}"></i>${E.ROTULO[o]}</span>`).join('')}<span><i class="vc-leg-ponto" style="--c:#B9B2A6"></i>Sem objetivo</span></span>
      <span class="vc-leg-grupo">${E.ETAPAS.map(([k, r]) => `<span><i class="vc-etapa ${k}"></i>${r}</span>`).join('')}</span></div>`;
  }
  function previa(d) {
    const p = d.todas.find((x) => String(x.id) === st.peca && E.dataDaPeca(x).startsWith(st.mes + '-') && clientesDe(x).some((c) => normal(c) === normal(st.cliente)));
    if (!p) { st.peca = ''; return '<div class="vc-vazio"><span>Escolha uma peça no calendário.</span></div>'; }
    const et = d.etapaDe(p), resp = st.respostas[String(p.id)], data = E.dataDaPeca(p);
    const thumb = st.thumbs[String(p.id)];
    if (thumb === undefined) buscarThumb(String(p.id));
    const olho = typeof botaoDePreviaNaLinha === 'function' ? botaoDePreviaNaLinha(p, 'vc-sec vc-olho') : '';
    return `<div class="vc-previa-topo"><b>${esc(p.nome || 'Peça')}</b><button type="button" class="vc-icone" data-vc-fechar-previa aria-label="Fechar prévia">${IC.fechar}</button></div>
      ${thumb?.abrir ? `<a class="vc-thumb vc-previa-arte" href="${esc(thumb.abrir)}" target="_blank" rel="noopener">${arteHtml(String(p.id), thumb, `Prévia de ${p.nome || 'peça'}`)}</a>` : `<div class="vc-thumb vc-previa-arte${thumb?.thumb ? '' : ' vazio'}">${arteHtml(String(p.id), thumb, `Prévia de ${p.nome || 'peça'}`)}</div>`}
      <dl class="vc-ficha"><div><dt>Data</dt><dd>${data ? `${data.slice(8)}/${data.slice(5, 7)}` : '—'}</dd></div><div><dt>Status</dt><dd>${p.status ? statusCor(p) : '—'}</dd></div>
      <div><dt>Aprovação</dt><dd>${et ? `<span class="vc-etiqueta ${et}">${E.ROTULO_ETAPA[et]}</span>` : 'Em produção'}</dd></div>
      ${resp ? `<div><dt>Cliente</dt><dd>${resp.acao === 'aprovar' ? 'Aprovou' : 'Pediu ajuste'} · ${esc(resp.nome)}</dd></div>` : ''}</dl>
      <div class="vc-previa-obj"><span>Objetivo</span>${campoObjetivoHtml(p)}</div>
      <div class="vc-previa-acoes"><button type="button" class="vc-acao" data-vc-abrir-peca="${esc(p.id)}">Abrir peça</button>${olho}</div>`;
  }
  // ---------- Prévia da peça (o baralho daqui, a prévia do Equilíbrio e o "Para você decidir" do Hoje) ----------
  // Vem de onde a gaveta tira os arquivos. Primeiro a miniatura de /api/painel?area=arquivos (o arquivo mais novo, pelo
  // id do Monday ou por vybe:<id>). Quando ela não basta (sem miniatura, mais de um arquivo, ou a imagem não abriu
  // porque o Drive ainda não liberou a prévia), o detalhe da peça (/api/painel?area=peca), a mesma leitura da gaveta:
  // ele libera a prévia no Drive (tornarPublico) para quem já pode abrir a peça e traz todos os arquivos.
  // O resultado: { tipo: imagem | video | arquivo, thumb, abrir, nome, n } (n = imagens do carrossel) ou null sem arquivo.
  const EXT_VIDEO = /^(mp4|mov|m4v|webm|avi|mkv|wmv|mpe?g|3gp)$/i, EXT_IMAGEM = /^(png|jpe?g|gif|webp|heic|heif|avif|bmp|svg|tiff?)$/i;
  function tipoDoArquivo(nome, ext) {
    const e = String(ext || '').replace(/^\./, '') || (String(nome || '').includes('.') ? String(nome).split('.').pop() : '');
    return EXT_VIDEO.test(e) ? 'video' : EXT_IMAGEM.test(e) ? 'imagem' : 'arquivo';
  }
  // Os arquivos do detalhe: 2 ou mais imagens é carrossel (a 1ª pelo nome, "1/N"); senão o vídeo; senão a imagem; senão
  // o primeiro arquivo, pelo nome.
  function previaDoDetalhe(det) {
    const lista = (Array.isArray(det?.assets) ? det.assets : []).filter((a) => a && (a.name || a.url_thumbnail || a.public_url))
      .map((a) => ({ a, tipo: tipoDoArquivo(a.name, a.file_extension) }));
    if (!lista.length) return null;
    const pelaOrdem = (x, y) => String(x.a.name || '').localeCompare(String(y.a.name || ''), 'pt-BR', { numeric: true }) || String(x.a.created_at || '').localeCompare(String(y.a.created_at || ''));
    const imagens = lista.filter((x) => x.tipo === 'imagem').sort(pelaOrdem), video = lista.find((x) => x.tipo === 'video');
    const escolha = imagens.length > 1 || (!video && imagens.length) ? imagens[0] : video || lista.slice().sort(pelaOrdem)[0];
    const a = escolha.a;
    return { tipo: escolha.tipo, thumb: a.url_thumbnail || (escolha.tipo === 'imagem' ? a.public_url || '' : '') || null,
      abrir: a.link_drive || a.public_url || a.url || null, nome: String(a.name || ''), n: imagens.length > 1 ? imagens.length : 0, detalhe: true };
  }
  const previas = st.thumbs, buscandoPrevia = new Map(), avisosPrevia = new Set();
  async function lerPrevia(ref) {
    let curta = null;
    try {
      const d = await lerJson(`/api/painel?area=arquivos&itens=${encodeURIComponent(ref)}`), x = d.itens?.[ref];
      if (x) curta = { tipo: tipoDoArquivo(x.nome, x.extensao), thumb: x.thumb ? String(x.thumb).replace(/sz=w\d+/, 'sz=w480') : null, abrir: x.abrir || null, nome: String(x.nome || ''), n: 0, total: Number(x.total) || 1 };
    } catch { /* o detalhe ainda pode responder */ }
    if (curta && curta.thumb && curta.total === 1) return curta;
    return lerDetalhe(ref, curta);
  }
  async function lerDetalhe(ref, reserva = null) {
    try { return previaDoDetalhe(await lerJson(`/api/painel?area=peca&item=${encodeURIComponent(ref)}`)) || reserva; }
    catch { return reserva; }
  }
  function avisarPrevia(ref) {
    if (st.aberto && (st.peca === ref || st.aba === 'aprovar')) pintar();
    for (const f of avisosPrevia) { try { f(ref); } catch { /* quem ouve cuida de si */ } }
  }
  function buscarPrevia(ref, ler = lerPrevia) {
    ref = String(ref || '');
    if (!ref || buscandoPrevia.has(ref)) return;
    buscandoPrevia.set(ref, setTimeout(async () => {
      previas[ref] = await ler(ref);
      buscandoPrevia.delete(ref);
      avisarPrevia(ref);
    }, 0));
  }
  const buscarThumb = (id) => buscarPrevia(id);
  // O valor de agora (undefined enquanto busca) e a busca, se ainda não houve.
  function previaDe(ref) { const r = String(ref || ''); if (previas[r] === undefined) buscarPrevia(r); return previas[r]; }
  // A arte do cartão: a imagem com ▶ (vídeo) ou "1/N" (carrossel); sem miniatura, um quadro com ▶ e o nome do arquivo.
  function arteHtml(ref, p, alt, perto = true) {
    if (p === undefined) return perto ? '<span class="vc-previa-msg">Buscando a prévia…</span>' : '';
    if (!p) return '<span class="vc-previa-msg">Sem arquivo anexado</span>';
    const selo = p.tipo === 'video' ? '<i class="vc-previa-selo vc-previa-play" aria-label="Vídeo">▶</i>' : p.n > 1 ? `<i class="vc-previa-selo vc-previa-n" aria-label="Carrossel com ${p.n} imagens">1/${p.n}</i>` : '';
    if (p.thumb) return `<img src="${esc(p.thumb)}" alt="${esc(alt)}" loading="lazy" data-vc-previa="${esc(ref)}">${selo}`;
    return `<span class="vc-previa-quadro">${p.tipo === 'video' ? '<i class="vc-previa-play" aria-hidden="true">▶</i>' : ''}<b>${esc(p.nome || 'Arquivo anexado')}</b></span>${p.tipo === 'video' ? '' : selo}`;
  }
  // A miniatura não abriu (o Drive ainda não liberou a prévia do arquivo): o detalhe da peça libera e traz de novo;
  // se nem assim, fica o quadro com o nome do arquivo.
  document.addEventListener('error', (e) => {
    const img = e.target; if (img?.tagName !== 'IMG' || !img.dataset?.vcPrevia) return;
    const ref = img.dataset.vcPrevia, p = previas[ref];
    if (!p || buscandoPrevia.has(ref)) return;
    if (!p.detalhe) return buscarPrevia(ref, (r) => lerDetalhe(r, { ...p, thumb: null, detalhe: true }).then((x) => (x && x.thumb === p.thumb ? { ...x, thumb: null } : x)));
    previas[ref] = { ...p, thumb: null }; avisarPrevia(ref);
  }, true);

  // ---------- Links de aprovação ----------
  async function carregarLinks() {
    try { const d = await lerJson(`${ROTA}&acao=aprovacao`); st.links = d; st.erroLinks = ''; }
    catch (e) { st.erroLinks = e.message; }
    if (st.aberto) pintar();
  }
  // Com o cliente (Direção 3, aba do quadro D3-Aprovacao): as peças que esperam a resposta do cliente, pela data dele,
  // e embaixo os links de aprovação de cada cliente (a mesma lista da aba Links).
  function corpoCliente() {
    const f = filaParaAprovar(), l = f?.comO || [];
    const lin = l.slice().sort((a, b) => String(a.veiculacao || a.prazo || '9').localeCompare(String(b.veiculacao || b.prazo || '9')))
      .map((i) => `<div class="v2c-lin d3a-fila-lin"><span class="v2c-lin-txt">${cliHtml(String(i.cliente || 'Sem cliente').split(',')[0].trim())}<span>· ${esc(String(i.titulo || 'Sem título').trim())}</span></span>${i.formato ? `<span class="d3a-pill">${esc(i.formato)}</span>` : ''}<span class="d3a-horas${(i.horas ?? 0) >= 48 ? ' a' : ''}">${i.horas == null ? esc(quando(i).curto) : i.horas < 1 ? 'agora' : esc(esperaHa(i.horas))}</span></div>`).join('');
    return `<section class="d3a-card v2c-fila d3a-cliente" aria-label="Com o cliente"><div class="d3a-topo"><h3>Com o cliente</h3><span>${!f ? '' : l.length ? plural(l.length, 'espera resposta', 'esperam resposta') : 'nada esperando'}</span></div>
      <div class="d3a-fila">${lin || `<p class="d3a-vazio">${f ? 'Nenhuma peça esperando o cliente.' : 'As peças ainda estão carregando.'}</p>`}</div></section>${corpoLinks()}`;
  }
  function corpoLinks() {
    if (st.erroLinks) return vazio(st.erroLinks, 'Tente de novo em instantes.', '<button type="button" class="vc-sec" data-vc-recarregar-links>Tentar de novo</button>');
    if (!st.links) return vazio('Carregando os clientes…');
    const d = st.links;
    const aviso = d.pronto === false && !(st.pronto === false) ? avisoParte(d.aviso) : '';
    if (!d.clientes?.length) return aviso + vazio('Você ainda não é head de nenhum cliente.', 'O link de aprovação é gerado pelo head do cliente ou por quem administra.');
    const novo = st.novoLink ? `<div class="vc-novo-link" role="status"><b>Link de ${esc(st.novoLink.cliente)} pronto</b><span>Copie e mande para o cliente pelo canal de sempre. Ele aparece só agora.</span>
      <span class="vc-novo-linha"><input readonly value="${esc(st.novoLink.link)}" aria-label="Link de aprovação" data-vc-link-campo><button type="button" class="vc-acao" data-vc-copiar>Copiar</button></span></div>` : '';
    return aviso + novo + `<div class="vc-links-lista">${d.clientes.map((c) => `<div class="vc-link-cliente">
      <div class="vc-link-linha"><b>${esc(c.nome)}</b><span class="vc-etiqueta ${c.pendentes ? 'aprovado_interno' : ''}">${c.pendentes ? `${c.pendentes} esperando o cliente` : 'nada esperando o cliente'}</span>
        <label class="vc-validade">Validade <select data-vc-dias="${esc(c.id)}"><option value="7">7 dias</option><option value="14" selected>14 dias</option><option value="30">30 dias</option></select></label>
        <button type="button" class="vc-sec" data-vc-gerar="${esc(c.id)}"${d.pronto === false || st.gerando ? ' disabled' : ''}>${IC.link}Gerar link</button></div>
      ${c.links.length ? `<ul>${c.links.map((l) => `<li><span>Gerado por ${esc(l.criado_por || '—')} · vale até ${esc(dataHora(l.expira_em))}${l.ultimo_acesso_em ? ` · aberto ${esc(dataHora(l.ultimo_acesso_em))}` : ' · ainda não aberto'} · ${l.respostas} resposta${l.respostas === 1 ? '' : 's'}</span><button type="button" class="vc-perigo" data-vc-revogar="${esc(l.id)}">Desligar</button></li>`).join('')}</ul>` : ''}
    </div>`).join('')}</div>`;
  }
  const dataHora = (d) => { try { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d)); } catch { return ''; } };
  async function gerar(clienteId) {
    const dias = Number(document.querySelector(`[data-vc-dias="${CSS.escape(clienteId)}"]`)?.value || 14);
    st.gerando = true; pintar();
    try {
      const d = await lerJson(`${ROTA}&acao=gerar_link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'gerar_link', cliente_id: clienteId, dias }) });
      st.novoLink = { cliente: d.cliente, link: d.link };
      await carregarLinks();
    } catch (e) { toast(e.message, 'err'); }
    st.gerando = false; pintar();
  }
  async function revogar(id) {
    if (!confirm('Desligar este link? Quem tiver o endereço não consegue mais abrir.')) return;
    try { await lerJson(`${ROTA}&acao=revogar_link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'revogar_link', id }) }); toast('Link desligado.', 'ok'); }
    catch (e) { toast(e.message, 'err'); }
    carregarLinks();
  }
  async function copiar() {
    const campo = document.querySelector('[data-vc-link-campo]');
    if (!campo) return;
    try { await navigator.clipboard.writeText(campo.value); toast('Link copiado.', 'ok'); }
    catch { campo.select(); toast('Selecionado: use Ctrl/Cmd + C.', 'info'); }
  }
  function vazio(titulo, detalhe = '', botao = '') { return `<div class="vc-vazio"><b>${esc(titulo)}</b>${detalhe ? `<span>${esc(detalhe)}</span>` : ''}${botao}</div>`; }

  // ---------- Aprovar em tela cheia (modo imersivo) ----------
  // Paulo, 15/11/2026: "olha a diferença... tá zoando?" (com a referência dos painéis de vidro do visionOS) e "na hora de
  // mostrar um conteúdo pra aprovar, do lado a copy certinha como ia ficar no Insta, quem fez, as infos... os princípios
  // de modernidade". O fundo é a própria arte, ampliada e desfocada (cada peça muda a luz da tela); no centro, um cartão
  // de vidro claro com a arte grande e a copy como sai no Instagram; à esquerda a anterior, à direita quem fez, os
  // detalhes (cada um com a sua cor) e a próxima; embaixo, a cápsula com Pedir alteração e Aprovar (o laranja é a ação).
  // As decisões passam pelos portões de sempre (decidir): enquanto um portão está aberto, a tela cheia se recolhe.
  const imer = { aberta: false, lado: '' };
  function imerAbrir() { if (!filaParaAprovar()?.fila?.length) return; imer.aberta = true; imer.lado = ''; pintarImersao(); }
  function imerFechar() {
    imer.aberta = false;
    document.body.classList.remove('vc-imersivo');
    document.getElementById('vv-conteudo')?.classList.remove('vc-com-imersao');
    const el = document.getElementById('vc-imersao');
    if (el) { el.classList.remove('vc-im-entrou'); setTimeout(() => { if (!imer.aberta) el.remove(); }, 320); }
  }
  function imerIr(passo) {
    const fila = filaParaAprovar()?.fila || [];
    const novo = Math.max(0, Math.min(fila.length - 1, st.apr + passo));
    if (novo === st.apr) return;
    imer.lado = passo > 0 ? 'dir' : 'esq';
    st.lote = [];
    passar(novo);
    pintarImersao();
  }
  const fotoGrande = (p) => (p?.thumb ? String(p.thumb).replace(/=s\d+(-[a-z]+)?$/i, '=s1600').replace(/sz=w?\d+/i, 'sz=w1600') : '');
  function imerArte(i, grande) {
    const ref = String(i.ref), p = st.thumbs[ref];
    if (p === undefined) buscarThumb(ref);
    if (p?.thumb) return `<img src="${esc(grande ? fotoGrande(p) : p.thumb)}" alt="${esc(`Arte de ${i.titulo || 'peça'}`)}" loading="lazy" data-vc-previa="${esc(ref)}">${p.tipo === 'video' ? '<i class="vc-im-play" aria-label="Vídeo">▶</i>' : p.n > 1 ? `<i class="vc-im-n" aria-label="Carrossel com ${p.n} imagens">1/${p.n}</i>` : ''}`;
    return `<span class="vc-im-sem"><b>${esc(i.formato || 'Peça')}</b><small>${p === undefined ? 'Buscando a arte…' : 'A arte ainda não foi anexada'}</small></span>`;
  }
  function imerMini(i, lado) {
    const q = quando(i);
    return `<button type="button" class="vc-im-mini vc-im-vidro" data-vc-im="${lado < 0 ? 'ant' : 'prox'}" aria-label="${lado < 0 ? 'Peça anterior' : 'Próxima peça'}: ${esc(nomeDaPeca(i))}">
      <span class="vc-im-mini-rot">${lado < 0 ? '‹ Anterior' : 'Próxima ›'}</span>
      <span class="vc-im-mini-arte">${imerArte(i, false)}</span>
      <b>${esc(nomeDaPeca(i))}</b><small>${esc(String(i.cliente || '').split(',')[0].trim())} · ${esc(q.curto)}</small></button>`;
  }
  function pintarImersao() {
    if (!imer.aberta) return;
    const f = filaParaAprovar(), fila = f?.fila || [];
    let el = document.getElementById('vc-imersao');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vc-imersao'; el.className = 'vc-im';
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Aprovar uma peça por vez');
      // Dentro da janela da Aprovação: o menu e a barra do Vybe OS continuam à vista (Paulo, 15/11/2026: "agora
      // parece que tô saindo do sistema").
      const j = janela(); j.scrollTop = 0; j.classList.add('vc-com-imersao'); j.append(el);
      document.body.classList.add('vc-imersivo');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('vc-im-entrou')));
    }
    if (!fila.length) {
      el.innerHTML = `<div class="vc-im-fundo vc-im-fundo-vazio"></div><div class="vc-im-fim vc-im-vidro"><b>Tudo aprovado por aqui.</b><span>Nada esperando a sua aprovação agora.</span><button type="button" class="vc-im-btn k" data-vc-im="fechar">Voltar</button></div>`;
      return;
    }
    st.apr = Math.max(0, Math.min(st.apr, fila.length - 1));
    const i = fila[st.apr], ant = fila[st.apr - 1], prox = fila[st.apr + 1];
    const ref = String(i.ref), p = st.thumbs[ref], item = itemDoPainel(i), ig = perfilDoCliente(i.cliente);
    const legenda = String(item?.legenda || '').trim(), o = objetivoDe(i.ref), q = quando(i), noAr = quandoNoAr(i);
    const prazo = String(i.prazo || item?.prazo_iso || '').slice(0, 10);
    const corSt = (typeof corDeStatus === 'function' ? corDeStatus(i.status || '')?.cor : '') || '';
    const fez = quemFez(i), heads = (i.heads || []).map((h) => h.nome).filter(Boolean);
    const pessoas = [...fez, ...heads.filter((h) => !fez.some((x) => x.nome === h)).map((nome) => ({ nome, papel: 'Head do cliente' }))]
      .filter((x, n, l) => l.findIndex((y) => y.nome === x.nome) === n).slice(0, 4);
    const detalhes = [
      ['status', 'Status', `<span${corSt ? ` style="--d3-st:${esc(corSt)}"` : ''}>${esc(i.status || 'Para aprovação')}</span>`],
      i.formato ? ['formato', 'Formato', esc(i.formato)] : null,
      o ? [`obj-${o}`, 'Objetivo', esc(E.ROTULO[o])] : null,
      ['ar', 'Vai ao ar', `<b class="${q.tom === 'r' ? 'r' : ''}">${esc(noAr || q.frase)}</b>`],
      prazo ? ['prazo', 'Prazo de ouro', esc(diaMes(prazo))] : null,
      i.horas == null ? null : ['espera', 'Esperando', esc(i.horas < 1 ? 'entrou agora' : esperaHa(i.horas))],
    ].filter(Boolean);
    const fundo = p?.thumb ? ` style="--arte:url('${esc(fotoGrande(p)).replace(/'/g, '%27')}')"` : '';
    el.innerHTML = `
      <div class="vc-im-fundo${p?.thumb ? '' : ' vc-im-fundo-vazio'}"${fundo}></div>
      <header class="vc-im-topo vc-im-vidro">
        <span class="vc-im-topo-tit"><b>Para aprovar</b><small>${st.apr + 1} de ${fila.length}</small></span>
        <span class="vc-im-pontos" aria-hidden="true">${fila.length <= 20 ? fila.map((_, k) => `<i${k === st.apr ? ' class="on"' : ''}></i>`).join('') : ''}</span>
        <button type="button" class="vc-im-x" data-vc-im="fechar" aria-label="Sair da tela cheia (Esc)">${IC.fechar}</button>
      </header>
      <div class="vc-im-palco">
        <aside class="vc-im-lado vc-im-esq">${ant ? imerMini(ant, -1) : ''}</aside>
        <article class="vc-im-centro vc-im-vidro${imer.lado ? ` vc-im-vem-${imer.lado}` : ''}" aria-live="polite">
          <button type="button" class="vc-im-arte" data-vc-im="abrir" title="Abrir a peça inteira"><span class="vc-im-brilho" aria-hidden="true"></span>${imerArte(i, true)}</button>
          <div class="vc-im-texto">
            <p class="vc-im-tit"><b>${esc(nomeDaPeca(i))}</b><span>${cliHtml(i.cliente)}</span></p>
            <section class="vc-im-ig" aria-label="Como fica no Instagram">
              <header><span class="vc-im-av">${ig.foto ? `<img src="${esc(ig.foto)}" alt="">` : esc(ig.iniciais)}</span><b>${esc(ig.usuario || ig.nome)}</b><small>como fica no Instagram</small></header>
              <p>${legenda ? `<b>${esc(ig.usuario || ig.nome)}</b> ${esc(legenda)}` : '<span class="vc-im-sem-leg">A legenda ainda não foi escrita. O Augusto (Copy) sugere, ou escreva na peça.</span>'}</p>
            </section>
          </div>
        </article>
        <aside class="vc-im-lado vc-im-dir">
          ${pessoas.length ? `<section class="vc-im-vidro vc-im-quem" aria-label="Quem fez"><h4>Quem fez</h4><div>${pessoas.map((x) => `<span class="vc-im-pessoa"><span class="vc-im-rosto">${esc(String(x.nome).trim().slice(0, 2).toUpperCase())}</span><span><b>${esc(String(x.nome).split(' ')[0])}</b><small>${esc(x.papel)}</small></span></span>`).join('')}</div></section>` : ''}
          <section class="vc-im-vidro vc-im-det" aria-label="Detalhes"><h4>Detalhes</h4><dl>${detalhes.map(([c, r, v]) => `<div data-cor="${esc(c)}"><dt><i aria-hidden="true"></i>${r}</dt><dd>${v}</dd></div>`).join('')}</dl></section>
          ${prox ? imerMini(prox, 1) : ''}
        </aside>
      </div>
      <footer class="vc-im-acoes vc-im-vidro">
        <button type="button" class="vc-im-seta" data-vc-im="ant" aria-label="Peça anterior"${ant ? '' : ' disabled'}>‹</button>
        <button type="button" class="vc-im-btn" data-vc-im="alterar">Pedir alteração</button>
        <button type="button" class="vc-im-btn k" data-vc-im="aprovar">Aprovar</button>
        <button type="button" class="vc-im-seta" data-vc-im="prox" aria-label="Próxima peça"${prox ? '' : ' disabled'}>›</button>
      </footer>`;
    // As vizinhas já vêm buscadas: passar de peça não espera a arte.
    for (const x of [ant, prox, fila[st.apr + 2]]) if (x && st.thumbs[String(x.ref)] === undefined) buscarThumb(String(x.ref));
    imer.lado = '';
  }
  // Decidir: o portão abre por cima e a tela cheia se recolhe até ele fechar; aí volta, já com a fila nova.
  function imerDecidir(acao) {
    const el = document.getElementById('vc-imersao'); if (!el) return;
    el.classList.add('vc-im-pausa');
    decidir(acao);
    let vez = 0;
    const esperar = () => {
      if (!imer.aberta) return;
      if (porCimaDaJanela() && vez++ < 600) { setTimeout(esperar, 400); return; }
      el.classList.remove('vc-im-pausa');
      pintarImersao();
    };
    setTimeout(esperar, 500);
  }
  avisosPrevia.add(() => { if (imer.aberta) pintarImersao(); });
  document.addEventListener('vybe:aprovacoes', () => { if (imer.aberta) pintarImersao(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('#vc-imersao [data-vc-im], [data-vc-im-abrir]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.matches('[data-vc-im-abrir]')) return imerAbrir();
    const a = b.dataset.vcIm;
    if (a === 'fechar') return imerFechar();
    if (a === 'ant') return imerIr(-1);
    if (a === 'prox') return imerIr(1);
    if (a === 'aprovar' || a === 'alterar') return imerDecidir(a);
    if (a === 'abrir') { const i = (filaParaAprovar()?.fila || [])[st.apr]; if (i) { document.getElementById('vc-imersao')?.classList.add('vc-im-pausa'); abrirDaFila(i); setTimeout(function volta() { if (porCimaDaJanela()) return setTimeout(volta, 400); document.getElementById('vc-imersao')?.classList.remove('vc-im-pausa'); }, 600); } }
  }, true);
  // Deslizar no celular troca de peça.
  let imerToque = null;
  document.addEventListener('touchstart', (e) => { imerToque = imer.aberta && e.target.closest?.('#vc-imersao .vc-im-palco') ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!imerToque) return;
    const t = e.changedTouches[0], dx = t.clientX - imerToque.x, dy = t.clientY - imerToque.y; imerToque = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) imerIr(dx < 0 ? 1 : -1);
  }, { passive: true });

  // ---------- Interação ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest?.('button'); if (!t) return;
    const obj = t.closest('[data-vc-item]');
    if (obj && t.dataset.vcObjetivo) { e.preventDefault(); e.stopPropagation(); return definirObjetivo(obj.dataset.vcItem, t.dataset.vcObjetivo); }
    if (!t.closest('#vv-conteudo')) return;
    if (t.matches('[data-vc-fechar]')) return fechar();
    // data-vc-como é o "Como funciona" do topo V2 (a regra do canto das janelas pinta de branco todo [data-vc-ajuda]).
    if (t.matches('[data-vc-ajuda],[data-vc-como]')) { st.ajuda = !st.ajuda; return pintar(); }
    if (t.matches('[data-vc-falta]')) { st.verFalta = !st.verFalta; return pintar(); }
    if (t.dataset.vcAba) { st.aba = t.dataset.vcAba; st.lote = []; if (['links', 'cliente'].includes(st.aba) && !st.links) carregarLinks(); if (st.aba === 'aprovar') relerFila(); return pintar(); }
    if (t.dataset.vcEqCliente !== undefined) { st.aba = 'equilibrio'; st.cliente = t.dataset.vcEqCliente; st.peca = ''; st.lote = []; return pintar(); }
    if (t.matches('[data-vc-apr-lista]')) { st.aprLista = t.closest('.v2c-fila') ? true : !st.aprLista; st.lote = []; return pintar(); }
    if (t.matches('[data-vc-apr-lote]')) { st.lote = deAmanha(filaParaAprovar()?.fila || []).map((i) => String(i.ref)); return seguirLote(); }
    if (t.matches('[data-vc-apr-reler]')) return relerFila(true);
    if (t.dataset.vcAprIr !== undefined) { st.lote = []; if (st.aprLista) { st.aprLista = false; st.apr = Number(t.dataset.vcAprIr); return pintar(); } return passar(Number(t.dataset.vcAprIr)); }
    if (t.dataset.vcLeque !== undefined) { st.lote = []; if (Number(t.dataset.vcLeque) === st.apr) return imerAbrir(); return passar(Number(t.dataset.vcLeque)); }
    if (t.dataset.vcAprPasso !== undefined) { st.lote = []; return passar(st.apr + Number(t.dataset.vcAprPasso)); }
    if (t.dataset.vcApr) return decidir(t.dataset.vcApr);
    if (t.dataset.vcAprVer !== undefined) { if (Date.now() - arrastouEm < 400) return; const i = (filaParaAprovar()?.fila || [])[Number(t.dataset.vcAprVer)]; if (i) abrirDaFila(i); return; }
    if (t.dataset.vcMes !== undefined) { const n = Number(t.dataset.vcMes); st.mes = n === 0 ? hoje().slice(0, 7) : n < 0 ? E.mesAnterior(st.mes) : mesSeguinte(st.mes); st.peca = ''; return pintar(); }
    if (t.dataset.vcCliente !== undefined) { st.cliente = normal(st.cliente) === normal(t.dataset.vcCliente) ? '' : t.dataset.vcCliente; st.peca = ''; return pintar(); }
    if (t.dataset.vcPeca) { st.peca = st.peca === t.dataset.vcPeca ? '' : t.dataset.vcPeca; return pintar(); }
    if (t.matches('[data-vc-fechar-previa]')) { st.peca = ''; return pintar(); }
    if (t.dataset.vcAbrirPeca) { if (typeof openItemWorkspace === 'function') openItemWorkspace(t.dataset.vcAbrirPeca); return; }
    if (t.matches('[data-vc-novo]')) { if (typeof window.openCadastrosGoverned === 'function') window.openCadastrosGoverned({ board: 'producao', client: st.cliente || undefined }); return; }
    if (t.dataset.vcGerar) return gerar(t.dataset.vcGerar);
    if (t.dataset.vcRevogar) return revogar(t.dataset.vcRevogar);
    if (t.matches('[data-vc-copiar]')) return copiar();
    if (t.matches('[data-vc-recarregar-links]')) { st.erroLinks = ''; st.links = null; pintar(); return carregarLinks(); }
  }, true);
  window.addEventListener('keydown', (e) => {
    if (imer.aberta && !porCimaDaJanela()) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); return imerIr(e.key === 'ArrowRight' ? 1 : -1); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return imerFechar(); }
    }
    if (!st.aberto) return;
    // Por cima da janela pode haver a gaveta da peça (aberta pela prévia), o cadastro ou um portão: eles vêm primeiro.
    const porCima = porCimaDaJanela();
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && st.aba === 'aprovar' && !porCima && !e.target.closest?.('input, textarea, select, [contenteditable="true"]')) { e.preventDefault(); st.lote = []; return passar(st.apr + (e.key === 'ArrowRight' ? 1 : -1)); }
    // Direção V2: A aprova e R pede alteração a peça da vez, pelo mesmo portão dos botões (ele confirma antes de gravar).
    if (v2() && st.aba === 'aprovar' && !st.aprLista && !porCima && !imer.aberta && !e.ctrlKey && !e.metaKey && !e.altKey && /^[ar]$/i.test(e.key) && !e.target.closest?.('input, textarea, select, [contenteditable="true"]') && (filaParaAprovar()?.fila || []).length) { e.preventDefault(); st.lote = []; return decidir(/a/i.test(e.key) ? 'aprovar' : 'alterar'); }
    if (e.key !== 'Escape') return;
    if (porCima) return;
    e.preventDefault(); e.stopPropagation();
    if (st.ajuda) { st.ajuda = false; return pintar(); }
    if (st.peca) { st.peca = ''; return pintar(); }
    fechar();
  }, true);

  function abrir({ aba = 'aprovar', cliente = '', mes = '' } = {}) {
    st.aberto = true; st.aba = ['links', 'equilibrio', 'cliente'].includes(aba) ? aba : 'aprovar';
    if (st.aba === 'aprovar') { relerFila(); st.aprLista = false; st.falaN = -1; if (!st.links && !st.erroLinks) carregarLinks(); }
    st.lote = [];
    st.mes = /^\d{4}-\d{2}$/.test(mes) ? mes : (st.mes || hoje().slice(0, 7));
    if (cliente) st.cliente = cliente;
    st.novoLink = null;
    pintar();
    carregarObjetivos();
    if (st.aba === 'links' || st.aba === 'cliente') carregarLinks();
    janela().querySelector('[data-vc-fechar]')?.focus();
  }
  function fechar() { if (imer.aberta) imerFechar(); st.aberto = false; st.peca = ''; st.ajuda = false; st.novoLink = null; st.lote = []; pintar(); }

  function ciclo() { clearTimeout(st.timer); st.timer = setTimeout(async () => { if (!document.hidden) await carregarObjetivos(); ciclo(); }, 120e3); }
  setTimeout(() => { carregarObjetivos(); ciclo(); }, 3000);

  // O "Para você decidir" do Hoje (vybe-mundo.js) usa as mesmas peças: a peça da fila, a decisão e a prévia.
  const ouvirPrevia = (f) => { if (typeof f === 'function') avisosPrevia.add(f); };
  window.VybeConteudo = Object.freeze({ abrir, fechar, aberto: () => st.aberto, atualizar: carregarObjetivos, bolinhaHtml, campoObjetivoHtml, definirObjetivo, objetivoDe,
    itemDaFila: itemDoPainel, decisaoDaFila, previaDe, arteHtml, ouvirPrevia,
    estado: () => ({ aberto: st.aberto, aba: st.aba, mes: st.mes, cliente: st.cliente, pronto: st.pronto, objetivos: { ...st.objetivos } }) });
})();
