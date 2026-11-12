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
// 4. Aba "Para aprovar" (Padrão v2, 12/11/2026): as peças em aprovação interna como um baralho, uma decisão por vez.
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
  const st = { objetivos: {}, respostas: {}, pronto: null, aviso: '', carregado: false, aberto: false, aba: 'aprovar', apr: 0, aprAss: '',
    mes: '', cliente: '', peca: '', ajuda: false, links: null, erroLinks: '', novoLink: null, gerando: false, timer: 0, thumbs: {} };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = { fechar: svg('<path d="M6 6l12 12M18 6 6 18"/>'), esq: svg('<path d="M15 18l-6-6 6-6"/>'), dir: svg('<path d="M9 18l6-6-6-6"/>'),
    marca: svg('<circle cx="7" cy="12" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="17" cy="17" r="3"/>'), link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>') };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeDoMes = (m) => { const n = MESES[Number(m.slice(5)) - 1]; return `${n[0].toUpperCase()}${n.slice(1)} de ${m.slice(0, 4)}`; };
  const hoje = () => (typeof hojeDeVerdade === 'function' ? hojeDeVerdade() : new Date().toISOString().slice(0, 10));
  const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const toast = (t, tipo = 'info') => (typeof showToast === 'function' ? showToast(t, tipo) : null);
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
    if (st.pronto === false) return `<span class="vc-objetivo-campo vc-indisponivel" title="${esc(st.aviso)}">Aguardando migração</span>`;
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
    const topo = `<div class="vc-topo"><span class="vc-marca" aria-hidden="true">${IC.marca}</span>
      <span class="vc-titulo"><b>Conteúdo</b><small>Aprovação interna, objetivo das peças e aprovação do cliente</small></span>
      <span class="vc-abas" role="tablist"><button type="button" role="tab" data-vc-aba="aprovar" aria-selected="${st.aba === 'aprovar'}">Para aprovar${(() => { const n = filaParaAprovar()?.fila.length; return n ? ` <i class="vc-aba-n">${n}</i>` : ''; })()}</button><button type="button" role="tab" data-vc-aba="equilibrio" aria-selected="${st.aba === 'equilibrio'}">Equilíbrio do mês</button><button type="button" role="tab" data-vc-aba="links" aria-selected="${st.aba === 'links'}">Links de aprovação</button></span>
      <button type="button" class="vc-icone vc-ajuda-btn" data-vc-ajuda aria-expanded="${st.ajuda}" aria-label="O que é este módulo?" title="O que é este módulo?">?</button>
      <button type="button" class="vc-icone" data-vc-fechar aria-label="Fechar (Esc)" title="Fechar (Esc)">${IC.fechar}</button></div>`;
    const ajuda = st.ajuda ? `<div class="vc-ajuda" role="note"><b>Como funciona</b>
      <p>Cada peça tem um <b>objetivo</b>: <i style="--c:${E.COR.atracao}"></i>Atração traz gente nova, <i style="--c:${E.COR.educacao}"></i>Educação explica e gera confiança, <i style="--c:${E.COR.conversao}"></i>Conversão chama para comprar. Marque no cadastro ou na peça (gaveta → Objetivo).</p>
      <p>O <b>equilíbrio do mês</b> conta as peças de cada cliente pela data de veiculação e avisa o que falta: um objetivo zerado com 3 ou mais peças, ou abaixo de 20% com 5 ou mais.</p>
      <p>No calendário, a marca ao lado da bolinha mostra a <b>aprovação</b>: para aprovar internamente, alteração interna, aprovado internamente, alteração do cliente e aprovado pelo cliente (status do painel + resposta pelo link).</p>
      <p>Em <b>Links de aprovação</b>, o head gera um link com validade para o cliente aprovar ou pedir ajuste sem login. Ele só vê as peças dele em "Ag. Aprovação Cliente".</p></div>` : '';
    const aviso = st.pronto === false && st.aviso ? `<div class="vc-aviso" role="status">${esc(st.aviso)}</div>` : '';
    el.innerHTML = topo + ajuda + aviso + `<div class="vc-corpo">${st.aba === 'links' ? corpoLinks() : st.aba === 'aprovar' ? corpoAprovar() : corpoEquilibrio()}</div>`;
    if (st.aba === 'aprovar') st.aprAss = assinaturaDaFila();
  }

  // ---------- Para aprovar (Padrão v2: baralho de decisão) ----------
  // A fila é a aprovação interna que a pessoa pode ver (o servidor já filtra pela carteira; sócio vê tudo; o diretor de
  // arte vê toda peça em "Para aprovação"). A data do cliente manda: primeiro o que veicula antes. Peça que o painel
  // já mostra fora de aprovação (o portão acabou de gravar) sai na hora, sem esperar a releitura.
  const A = () => window.VybeAprovacoes;
  const itemDoPainel = (i) => (i.quadro === 'demandas' ? null : pecasDoPainel().find((d) => String(d.id) === String(i.ref)) || null);
  function filaParaAprovar() {
    const d = A()?.estado?.().dados;
    if (!d) return null;
    const pecas = Array.isArray(d.pecas) ? d.pecas : [];
    const fila = pecas.filter((i) => i.etapa === 'interna').filter((i) => { const p = itemDoPainel(i); return !p || /aprova/i.test(String(p.status || '')); })
      .sort((a, b) => String(a.veiculacao || a.prazo || '9').localeCompare(String(b.veiculacao || b.prazo || '9')) || (b.horas ?? -1) - (a.horas ?? -1));
    return { fila, comCliente: pecas.filter((i) => i.etapa === 'cliente').length };
  }
  const assinaturaDaFila = () => (filaParaAprovar()?.fila || []).map((i) => i.ref).join(',');
  function conferirFila() { if (st.aberto && st.aba === 'aprovar' && assinaturaDaFila() !== st.aprAss) pintar(); }
  const somaDia = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  function quandoVeicula(i) {
    const v = String(i.veiculacao || '').slice(0, 10), h = hoje();
    if (!v) return i.prazo ? `prazo ${i.prazo.slice(8, 10)}/${i.prazo.slice(5, 7)}` : 'sem data do cliente';
    if (v < h) return `ia ao ar ${v.slice(8)}/${v.slice(5, 7)}`;
    return v === h ? 'veicula hoje' : v === somaDia(h, 1) ? 'veicula amanhã' : `veicula ${v.slice(8)}/${v.slice(5, 7)}`;
  }
  const paradoHa = (h) => (h == null ? '' : h < 1 ? 'entrou agora' : h < 48 ? `esperando há ${h} h` : `esperando há ${Math.round(h / 24)} dias`);
  const posDaCarta = (k) => (k < st.apr ? 'fora' : k - st.apr <= 2 ? String(k - st.apr) : '');
  function cartaHtml(i, k) {
    const pos = posDaCarta(k), perto = pos !== '' && pos !== 'fora', thumb = st.thumbs[String(i.ref)];
    if (perto && thumb === undefined) buscarThumb(String(i.ref));
    const o = objetivoDe(i.ref), atrasada = String(i.veiculacao || '') && String(i.veiculacao) < hoje();
    const arte = thumb ? `<img src="${esc(thumb.thumb)}" alt="Prévia de ${esc(i.titulo)}" loading="lazy">` : `<span>${thumb === null ? 'Sem arquivo anexado' : perto ? 'Buscando a prévia…' : ''}</span>`;
    return `<article class="v2-carta vc-apr-carta"${pos ? ` data-pos="${pos}"` : ''} data-vc-carta="${k}" aria-hidden="${pos !== '0'}">
      <div class="vc-apr-arte${thumb ? '' : ' vazia'}">${arte}</div>
      <div class="vc-apr-txt"><small class="vc-apr-formato">${esc(i.formato || 'Peça')}</small><b>${esc(i.titulo)}</b>
        <span class="vc-apr-meta">${i.cliente ? cliCor(i.cliente) : ''}<span class="${atrasada ? 'ruim' : ''}">${esc(quandoVeicula(i))}</span>${o ? `<span><i class="vc-leg-ponto" style="--c:${E.COR[o]}"></i>${E.ROTULO[o]}</span>` : ''}</span>
        <span class="vc-apr-espera">${esc([i.status, paradoHa(i.horas), i.heads?.length ? 'head: ' + i.heads.map((h) => h.nome).join(', ') : ''].filter(Boolean).join(' · '))}</span>
        <button type="button" class="vc-sec" data-vc-apr-ver="${k}"${pos === '0' ? '' : ' tabindex="-1"'}>Ver material</button></div></article>`;
  }
  function corpoAprovar() {
    if (!A()) return vazio('As aprovações não carregaram.', 'Recarregue a página para tentar de novo.');
    const f = filaParaAprovar();
    if (!f) { const erro = A().estado().erro; if (!erro) A().atualizar(); return vazio(erro || 'Carregando o que espera aprovação…', '', erro ? '<button type="button" class="vc-sec" data-vc-apr-reler>Tentar de novo</button>' : ''); }
    const { fila, comCliente } = f;
    const cliLinha = comCliente ? `<button type="button" class="vc-apr-fila-linha" data-vc-aba="links"><span>Com o cliente</span><small>${comCliente} ${comCliente === 1 ? 'peça espera' : 'peças esperam'} a resposta dele</small></button>` : '';
    if (!fila.length) return vazio('Nada esperando a sua aprovação.', comCliente ? `${comCliente} ${comCliente === 1 ? 'peça está' : 'peças estão'} com o cliente.` : 'Quando uma peça entrar em Para aprovação, ela aparece aqui.', '<button type="button" class="vc-sec" data-vc-aba="equilibrio">Ver o equilíbrio do mês</button>');
    st.apr = Math.max(0, Math.min(st.apr, fila.length - 1));
    const grupos = new Map();
    fila.forEach((i, k) => { const c = i.cliente || 'Sem cliente'; if (!grupos.has(c)) grupos.set(c, { c, k, n: 0, q: quandoVeicula(i) }); grupos.get(c).n++; });
    const maisAntiga = Math.max(...fila.map((i) => i.horas ?? 0));
    const amanha = fila.filter((i) => { const v = String(i.veiculacao || ''); return v && v <= somaDia(hoje(), 1); }).length;
    const pontos = fila.length <= 12 ? `<span class="v2-pontos" aria-hidden="true">${fila.map((_, k) => `<i${k === st.apr ? ' class="on"' : ''}></i>`).join('')}</span>` : '';
    return `<div class="vc-apr"><div class="vc-apr-mesa">
        <p class="vc-apr-frase"><b>${fila.length} ${fila.length === 1 ? 'peça espera' : 'peças esperam'} a sua aprovação</b>${amanha ? `; ${amanha} ${amanha === 1 ? 'veicula' : 'veiculam'} até amanhã` : ''}.</p>
        <div class="v2-baralho vc-apr-baralho" aria-live="polite">${fila.map(cartaHtml).join('')}</div>
        <div class="vc-apr-acoes"><button type="button" class="vc-icone" data-vc-apr-passo="-1" aria-label="Peça anterior"${st.apr === 0 ? ' disabled' : ''}>${IC.esq}</button>
          <button type="button" class="vc-sec" data-vc-apr="alterar">Pedir alteração</button><button type="button" class="vc-apr-ok" data-vc-apr="aprovar">Aprovar</button>
          <button type="button" class="vc-icone" data-vc-apr-passo="1" aria-label="Próxima peça"${st.apr >= fila.length - 1 ? ' disabled' : ''}>${IC.dir}</button></div>
        <p class="vc-apr-conta">${pontos}<span data-vc-apr-conta>${st.apr + 1} de ${fila.length}</span><span>as setas do teclado passam</span></p>
        <p class="vc-apr-nota">Aprovar manda a peça para Para agendar e Pedir alteração devolve com o seu recado. As duas pedem confirmação antes de gravar. Se o quadro da peça não tiver esses status, ela abre para você decidir por lá.</p></div>
      <aside class="vc-apr-fila" aria-label="Fila de aprovação"><div class="vc-apr-fila-topo"><b>Fila de aprovação</b><small>${maisAntiga >= 1 ? `a mais antiga ${paradoHa(maisAntiga)}` : 'tudo entrou agora'}</small></div>
        ${[...grupos.values()].map((g) => `<button type="button" class="vc-apr-fila-linha" data-vc-apr-ir="${g.k}"><span>${cliCor(g.c)} <em>${g.n} ${g.n === 1 ? 'peça' : 'peças'}</em></span><small>${esc(g.q)}</small></button>`).join('')}
        ${cliLinha}</aside></div>`;
  }
  // Passar de carta mexe só nas posições (data-pos): é a troca que anima. A tela inteira só é refeita quando a fila muda.
  function passar(para) {
    const fila = filaParaAprovar()?.fila || [], el = janela();
    const novo = Math.max(0, Math.min(para, fila.length - 1));
    if (novo === st.apr || !fila.length) return;
    st.apr = novo;
    const faltaThumb = fila.slice(novo, novo + 3).some((i) => st.thumbs[String(i.ref)] === undefined);
    if (faltaThumb) return pintar(); // a prévia das que chegaram é pedida no desenho
    el.querySelectorAll('[data-vc-carta]').forEach((c) => { const k = Number(c.dataset.vcCarta), pos = posDaCarta(k);
      if (pos) c.dataset.pos = pos; else delete c.dataset.pos;
      c.setAttribute('aria-hidden', String(pos !== '0')); const b = c.querySelector('[data-vc-apr-ver]'); if (b) { if (pos === '0') b.removeAttribute('tabindex'); else b.tabIndex = -1; } });
    el.querySelectorAll('.vc-apr .v2-pontos > i').forEach((p, k) => p.classList.toggle('on', k === novo));
    const conta = el.querySelector('[data-vc-apr-conta]'); if (conta) conta.textContent = `${novo + 1} de ${fila.length}`;
    const [antes, depois] = el.querySelectorAll('[data-vc-apr-passo]'); if (antes) antes.disabled = novo === 0; if (depois) depois.disabled = novo >= fila.length - 1;
  }
  const abrirDaFila = (i) => { const abre = i.quadro === 'demandas' ? globalThis.openDemandaWorkspace : globalThis.openItemWorkspace; if (typeof abre === 'function') abre(i.ref); };
  function decidir(acao) {
    const i = (filaParaAprovar()?.fila || [])[st.apr]; if (!i) return;
    const item = itemDoPainel(i), alvo = acao === 'aprovar' ? 'para agendar' : 'alteração';
    const opcoes = item && typeof operationalStatusOptions === 'function' ? operationalStatusOptions(item) : (typeof STATUS_OPTIONS !== 'undefined' ? STATUS_OPTIONS : []);
    const opcao = (opcoes || []).find((o) => String(o.label || '').trim().toLowerCase() === alvo);
    const portao = acao === 'aprovar' ? globalThis.openQualityGate : globalThis.openStatusContextGate;
    // Sem a peça no painel, sem o status no quadro dela ou sem o portão: a decisão é na própria peça, como sempre foi.
    if (!item || !opcao || typeof portao !== 'function') { toast('Abri a peça: a decisão dela é por lá.', 'info'); return abrirDaFila(i); }
    portao(item, opcao);
  }
  // A primeira leitura das aprovações pode ter sido antes do login: sem dados, abrir a aba lê de novo na hora.
  const relerFila = (forcar = false) => A()?.atualizar?.(forcar || !A().estado().dados);
  document.addEventListener('vybe:aprovacoes', () => { if (st.aberto) pintar(); });

  // ---------- Equilíbrio ----------
  // Redesign (quadro 16, 10/11/2026): o equilíbrio é uma barra por cliente (atração, educação, conversão) com o que falta
  // em poucas palavras; a legenda fica no topo e o calendário do cliente abre só ao clicar nele (clicar de novo fecha).
  function corpoEquilibrio() {
    if (!pecasDoPainel().length) return vazio('As peças ainda estão carregando.', 'Assim que o painel trouxer a produção, o equilíbrio aparece aqui.');
    const d = dadosDoMes();
    const mesNav = `<div class="vc-mes"><button type="button" class="vc-icone" data-vc-mes="-1" aria-label="Mês anterior">${IC.esq}</button><b>${esc(nomeDoMes(st.mes))}</b><button type="button" class="vc-icone" data-vc-mes="1" aria-label="Próximo mês">${IC.dir}</button>${st.mes !== hoje().slice(0, 7) ? '<button type="button" class="vc-sec" data-vc-mes="0">Este mês</button>' : ''}${resumoDoMes(d)}</div>`;
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
      ${thumb ? `<a class="vc-thumb" href="${esc(thumb.abrir || '#')}" target="_blank" rel="noopener"><img src="${esc(thumb.thumb)}" alt="Prévia de ${esc(p.nome || 'peça')}" loading="lazy"></a>` : `<div class="vc-thumb vazio">${thumb === null ? 'Sem arquivo anexado' : 'Buscando a prévia…'}</div>`}
      <dl class="vc-ficha"><div><dt>Data</dt><dd>${data ? `${data.slice(8)}/${data.slice(5, 7)}` : '—'}</dd></div><div><dt>Status</dt><dd>${p.status ? statusCor(p) : '—'}</dd></div>
      <div><dt>Aprovação</dt><dd>${et ? `<span class="vc-etiqueta ${et}">${E.ROTULO_ETAPA[et]}</span>` : 'Em produção'}</dd></div>
      ${resp ? `<div><dt>Cliente</dt><dd>${resp.acao === 'aprovar' ? 'Aprovou' : 'Pediu ajuste'} · ${esc(resp.nome)}</dd></div>` : ''}</dl>
      <div class="vc-previa-obj"><span>Objetivo</span>${campoObjetivoHtml(p)}</div>
      <div class="vc-previa-acoes"><button type="button" class="vc-acao" data-vc-abrir-peca="${esc(p.id)}">Abrir peça</button>${olho}</div>`;
  }
  // Prévia: a miniatura do Drive que a tela de arquivos já usa (/api/painel?area=arquivos). Peça só do Vybe
  // (vybe:<id>) não passa por essa leitura: a prévia completa fica no olhinho e em "Abrir peça".
  const buscandoThumb = new Set();
  function buscarThumb(id) {
    if (buscandoThumb.has(id)) return;
    buscandoThumb.add(id);
    setTimeout(async () => {
      if (id.startsWith('vybe:')) st.thumbs[id] = null;
      else {
        try { const d = await lerJson(`/api/painel?area=arquivos&itens=${encodeURIComponent(id)}`); st.thumbs[id] = d.itens?.[id]?.thumb ? d.itens[id] : null; }
        catch { st.thumbs[id] = null; }
      }
      if (st.aberto && (st.peca === id || st.aba === 'aprovar')) pintar();
    }, 0);
  }

  // ---------- Links de aprovação ----------
  async function carregarLinks() {
    try { const d = await lerJson(`${ROTA}&acao=aprovacao`); st.links = d; st.erroLinks = ''; }
    catch (e) { st.erroLinks = e.message; }
    if (st.aberto) pintar();
  }
  function corpoLinks() {
    if (st.erroLinks) return vazio(st.erroLinks, 'Tente de novo em instantes.', '<button type="button" class="vc-sec" data-vc-recarregar-links>Tentar de novo</button>');
    if (!st.links) return vazio('Carregando os clientes…');
    const d = st.links;
    const aviso = d.pronto === false ? `<div class="vc-aviso">${esc(d.aviso || 'Os links aguardam a migração do banco.')}</div>` : '';
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

  // ---------- Interação ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest?.('button'); if (!t) return;
    const obj = t.closest('[data-vc-item]');
    if (obj && t.dataset.vcObjetivo) { e.preventDefault(); e.stopPropagation(); return definirObjetivo(obj.dataset.vcItem, t.dataset.vcObjetivo); }
    if (!t.closest('#vv-conteudo')) return;
    if (t.matches('[data-vc-fechar]')) return fechar();
    if (t.matches('[data-vc-ajuda]')) { st.ajuda = !st.ajuda; return pintar(); }
    if (t.dataset.vcAba) { st.aba = t.dataset.vcAba; if (st.aba === 'links' && !st.links) carregarLinks(); if (st.aba === 'aprovar') relerFila(); return pintar(); }
    if (t.matches('[data-vc-apr-reler]')) return relerFila(true);
    if (t.dataset.vcAprPasso) return passar(st.apr + Number(t.dataset.vcAprPasso));
    if (t.dataset.vcAprIr !== undefined) return passar(Number(t.dataset.vcAprIr));
    if (t.dataset.vcApr) return decidir(t.dataset.vcApr);
    if (t.dataset.vcAprVer !== undefined) { const i = (filaParaAprovar()?.fila || [])[Number(t.dataset.vcAprVer)]; if (i) abrirDaFila(i); return; }
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
    if (!st.aberto) return;
    // Por cima da janela pode haver a gaveta da peça (aberta pela prévia), o cadastro ou um portão: eles vêm primeiro.
    const porCima = document.getElementById('workspace-drawer') || document.getElementById('fc-overlay') || document.getElementById('workflow-modal') || document.querySelector('.workflow-modal-overlay');
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && st.aba === 'aprovar' && !porCima && !e.target.closest?.('input, textarea, select, [contenteditable="true"]')) { e.preventDefault(); return passar(st.apr + (e.key === 'ArrowRight' ? 1 : -1)); }
    if (e.key !== 'Escape') return;
    if (porCima) return;
    e.preventDefault(); e.stopPropagation();
    if (st.ajuda) { st.ajuda = false; return pintar(); }
    if (st.peca) { st.peca = ''; return pintar(); }
    fechar();
  }, true);

  function abrir({ aba = 'aprovar', cliente = '', mes = '' } = {}) {
    st.aberto = true; st.aba = ['links', 'equilibrio'].includes(aba) ? aba : 'aprovar';
    if (st.aba === 'aprovar') relerFila();
    st.mes = /^\d{4}-\d{2}$/.test(mes) ? mes : (st.mes || hoje().slice(0, 7));
    if (cliente) st.cliente = cliente;
    st.novoLink = null;
    pintar();
    carregarObjetivos();
    if (st.aba === 'links') carregarLinks();
    janela().querySelector('[data-vc-fechar]')?.focus();
  }
  function fechar() { st.aberto = false; st.peca = ''; st.ajuda = false; st.novoLink = null; pintar(); }

  function ciclo() { clearTimeout(st.timer); st.timer = setTimeout(async () => { if (!document.hidden) await carregarObjetivos(); ciclo(); }, 120e3); }
  setTimeout(() => { carregarObjetivos(); ciclo(); }, 3000);

  window.VybeConteudo = Object.freeze({ abrir, fechar, aberto: () => st.aberto, atualizar: carregarObjetivos, bolinhaHtml, campoObjetivoHtml, definirObjetivo, objetivoDe,
    estado: () => ({ aberto: st.aberto, aba: st.aba, mes: st.mes, cliente: st.cliente, pronto: st.pronto, objetivos: { ...st.objetivos } }) });
})();
