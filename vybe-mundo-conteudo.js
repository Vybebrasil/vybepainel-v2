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
    // O topo do quadro: título, as três abas, o mês e a ajuda. O mês vale para o equilíbrio e para a fala do Augusto.
    const mesAtual = st.mes === hoje().slice(0, 7);
    const topo = `<div class="v2c-topo"><h2>Conteúdo</h2>
      <span class="v2c-seg" role="tablist"><button type="button" role="tab" data-vc-aba="aprovar" aria-selected="${st.aba === 'aprovar'}">Para aprovar</button><button type="button" role="tab" data-vc-aba="equilibrio" aria-selected="${st.aba === 'equilibrio'}">Equilíbrio do mês</button><button type="button" role="tab" data-vc-aba="links" aria-selected="${st.aba === 'links'}">Links de aprovação</button></span>
      <span class="v2c-mes" role="group" aria-label="Mês"><button type="button" data-vc-mes="-1" aria-label="Mês anterior">‹</button><button type="button" class="v2c-mes-nome" data-vc-mes="0" title="${mesAtual ? 'Este é o mês atual' : 'Voltar para este mês'}">${esc(nomeDoMes(st.mes))}</button><button type="button" data-vc-mes="1" aria-label="Próximo mês">›</button></span>
      <button type="button" class="v2c-btn" data-vc-ajuda aria-expanded="${st.ajuda}" aria-label="O que é este módulo?" title="O que é este módulo?">?</button>
      <button type="button" class="v2c-btn v2c-x" data-vc-fechar aria-label="Fechar (Esc)" title="Fechar (Esc)">${IC.fechar}</button></div>`;
    const ajuda = st.ajuda ? `<div class="vc-ajuda" role="note"><b>Como funciona</b>
      <p>Cada peça tem um <b>objetivo</b>: <i style="--c:${E.COR.atracao}"></i>Atração traz gente nova, <i style="--c:${E.COR.educacao}"></i>Educação explica e gera confiança, <i style="--c:${E.COR.conversao}"></i>Conversão chama para comprar. Marque no cadastro ou na peça (gaveta → Objetivo).</p>
      <p>O <b>equilíbrio do mês</b> conta as peças de cada cliente pela data de veiculação e avisa o que falta: um objetivo zerado com 3 ou mais peças, ou abaixo de 20% com 5 ou mais.</p>
      <p>No calendário, a marca ao lado da bolinha mostra a <b>aprovação</b>: para aprovar internamente, alteração interna, aprovado internamente, alteração do cliente e aprovado pelo cliente (status do painel + resposta pelo link).</p>
      <p>Em <b>Links de aprovação</b>, o head gera um link com validade para o cliente aprovar ou pedir ajuste sem login. Ele só vê as peças dele em "Ag. Aprovação Cliente".</p>
      <p>Em <b>Para aprovar</b>, Aprovar manda a peça para Para agendar e Pedir alteração devolve com o seu recado. As duas pedem confirmação antes de gravar. Se o quadro da peça não tiver esses status, ela abre para você decidir por lá. Tocar na arte abre a peça; as setas do teclado, ou arrastar o cartão, passam para a próxima.</p></div>` : '';
    const aviso = st.pronto === false && st.aviso ? `<div class="vc-aviso" role="status">${esc(st.aviso)}</div>` : '';
    el.innerHTML = topo + ajuda + aviso + `<div class="vc-corpo">${st.aba === 'links' ? corpoLinks() : st.aba === 'aprovar' ? corpoAprovar() : corpoEquilibrio()}</div>`;
    if (st.aba === 'aprovar') st.aprAss = assinaturaDaFila();
  }

  // ---------- Para aprovar (Padrão v2: a tela é o quadro "Aprovação de conteúdo" do moodboard) ----------
  // Nesta ordem, como no quadro: a fala do Augusto com o atalho das peças de amanhã; à esquerda o baralho (arte, nome,
  // cliente, quando veicula, objetivo, quem fez e a legenda), os dois botões e os pontos; à direita a fila por cliente
  // e o equilíbrio do mês resumido. A fila é a aprovação interna que a pessoa pode ver (o servidor já filtra pela
  // carteira; sócio vê tudo; o diretor de arte vê toda peça em "Para aprovação"). A data do cliente manda: primeiro o
  // que veicula antes. Peça que o painel já mostra fora de aprovação (o portão acabou de gravar) sai na hora.
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
  function cartaHtml(i, k) {
    const pos = posDaCarta(k), perto = pos !== '' && pos !== 'fora', thumb = st.thumbs[String(i.ref)];
    if (perto && thumb === undefined) buscarThumb(String(i.ref));
    const o = objetivoDe(i.ref), q = quando(i), item = itemDoPainel(i);
    const carteira = typeof carteiraDoCliente === 'function' ? carteiraDoCliente(String(i.cliente || '').split(',')[0].trim()) : '';
    const arte = thumb ? `<img src="${esc(thumb.thumb)}" alt="Prévia de ${esc(i.titulo)}" loading="lazy">` : `<span>${thumb === null ? 'Sem arquivo anexado' : perto ? 'Buscando a prévia…' : ''}</span>`;
    // A legenda é a da peça, quando o painel a traz; sem ela, a linha conta há quanto tempo a peça espera.
    const legenda = String(item?.legenda || '').trim() || [i.status, i.horas == null ? '' : i.horas < 1 ? 'entrou agora' : `esperando há ${esperaHa(i.horas)}`].filter(Boolean).join(' · ');
    return `<article class="v2-carta v2c-carta"${pos ? ` data-pos="${pos}"` : ''} data-vc-carta="${k}" data-carteira="${esc(carteira || '')}" aria-hidden="${pos !== '0'}">
      <button type="button" class="v2c-arte${thumb ? '' : ' vazia'}" data-vc-apr-ver="${k}" title="Abrir a peça" aria-label="Abrir a peça: ${esc(i.titulo)}"${pos === '0' ? '' : ' tabindex="-1"'}>${arte}</button>
      <p class="v2c-nome"><b>${esc(nomeDaPeca(i))}</b></p>
      <p class="v2c-meta">${cliHtml(i.cliente)}<span${q.tom === 'r' ? ' class="ruim"' : ''}>${esc(q.frase)}</span>${o ? `<span class="v2c-pill ${PILULA_OBJETIVO[o]}">${E.ROTULO[o]}</span>` : ''}${avsHtml(quemFez(i))}</p>
      <p class="v2c-leg">${esc(legenda)}</p></article>`;
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
    return `<div class="v2c-mesa">
        <div class="v2-baralho vc-apr-baralho" aria-live="polite">${fila.map(cartaHtml).join('')}</div>
        <div class="v2c-acoes"><button type="button" class="v2c-btn g" data-vc-apr="alterar">Pedir alteração</button><button type="button" class="v2c-btn g k" data-vc-apr="aprovar">Aprovar</button></div>
        <p class="v2c-conta">${pontos}<span><span data-vc-apr-conta>${st.apr + 1} de ${fila.length}</span> · as setas passam · <button type="button" class="v2c-link" data-vc-apr-lista>ver em lista</button></span></p></div>`;
  }
  // Fila de aprovação: uma linha por cliente, com quem fez e quando veicula a primeira; a última linha é o que está com o cliente.
  function filaHtml(f) {
    const fila = f?.fila || [], grupos = new Map();
    fila.forEach((i, k) => { const c = i.cliente || 'Sem cliente'; if (!grupos.has(c)) grupos.set(c, { c, k, n: 0, q: quando(i), quem: [] }); const g = grupos.get(c); g.n++; g.quem.push(...quemFez(i)); });
    const maisAntiga = fila.length ? Math.max(...fila.map((i) => i.horas ?? 0)) : 0;
    // Cabem três clientes, como no quadro, sem empurrar o equilíbrio para fora da tela; o resto fica a um toque, na lista.
    const todos = [...grupos.values()], MAX = 3;
    const mais = todos.length > MAX ? `<p class="v2c-lin v2c-sub"><span>+ ${plural(todos.length - MAX, 'cliente', 'clientes')} na fila · <button type="button" class="v2c-link" data-vc-apr-lista>ver em lista</button></span></p>` : '';
    const linhas = todos.slice(0, MAX).map((g) => `<button type="button" class="v2c-lin" data-vc-apr-ir="${g.k}"><span class="v2c-lin-txt">${cliHtml(g.c)}<span>· ${plural(g.n, 'peça', 'peças')}</span></span>${avsHtml(g.quem)}<span class="v2c-pill ${g.q.tom}">${esc(g.q.curto)}</span></button>`).join('') + mais;
    const abertos = st.links?.clientes ? st.links.clientes.reduce((s, c) => s + (c.links?.length || 0), 0) : null;
    const aprovadas = pecasDoPainel().length ? dadosDoMes().aprovadasAgora : null;
    const comCliente = [f?.comCliente ? plural(f.comCliente, 'peça espera a resposta', 'peças esperam a resposta') : '', abertos == null ? '' : plural(abertos, 'link aberto', 'links abertos'),
      aprovadas == null ? '' : `${plural(aprovadas, 'peça aprovada', 'peças aprovadas')} por clientes no mês`].filter(Boolean).join(', ');
    return `<section class="v2c-card v2c-fila" aria-label="Fila de aprovação"><div class="v2c-card-topo"><h3>Fila de aprovação</h3><span class="v2c-sub">${!f ? '' : !fila.length ? 'fila limpa' : maisAntiga >= 1 ? `a mais antiga espera há ${esperaHa(maisAntiga)}` : 'tudo entrou agora'}</span></div>
      ${linhas}<div class="v2c-lin"><p class="v2c-lin-txt"><span><b>Com o cliente</b>${comCliente ? ` · ${esc(comCliente)}` : ''}</span></p><button type="button" class="v2c-btn" data-vc-aba="links">Links de aprovação</button></div></section>`;
  }
  // Equilíbrio do mês resumido: os números, os primeiros clientes com a barra e o que falta, e o caminho para a aba inteira.
  function cartaoEquilibrio() {
    const topo = (sub) => `<div class="v2c-card-topo"><h3>Equilíbrio do mês</h3><span class="v2c-sub">${sub}</span></div>`;
    if (!pecasDoPainel().length) return `<section class="v2c-card v2c-eq" aria-label="Equilíbrio do mês">${topo('')}<p class="v2c-sub">As peças ainda estão carregando.</p></section>`;
    const d = dadosDoMes(), g = d.atual.geral, cl = d.atual.clientes, ant = MESES[Number(E.mesAnterior(st.mes).slice(5)) - 1];
    const abrirAba = '<button type="button" class="v2c-link" data-vc-aba="equilibrio">abrir Equilíbrio do mês</button>';
    if (!cl.length) return `<section class="v2c-card v2c-eq" aria-label="Equilíbrio do mês">${topo(`eram ${d.anterior.geral.total} em ${ant}`)}<p class="v2c-sub">Nenhuma peça com data em ${esc(nomeDoMes(st.mes).toLowerCase())}.</p><p class="v2c-sub v2c-pe">${abrirAba}</p></section>`;
    const pontos = [...E.OBJETIVOS.map((o) => [g[o] || 0, E.ROTULO[o].toLowerCase(), E.COR[o]]), [g.sem || 0, 'sem objetivo', '#C9C2B6']];
    const linhas = cl.slice(0, 4).map((c) => { const t = c.total || 1, r = E.resumoCurto(c);
      return `<button type="button" class="v2c-eq-lin" data-vc-eq-cliente="${esc(c.cliente)}" title="${esc(c.frase)}">${cliHtml(c.cliente)}<span class="v2c-emp" role="img" aria-label="${esc(c.frase)}">${E.OBJETIVOS.map((o) => (c[o] ? `<i style="width:${(c[o] / t) * 100}%;background:${E.COR[o]}"></i>` : '')).join('')}</span><span class="v2c-sub ${r.tom}">${esc(r.texto)}</span></button>`; }).join('');
    const resto = cl.length - Math.min(4, cl.length), media = Math.round(g.total / cl.length);
    return `<section class="v2c-card v2c-eq" aria-label="Equilíbrio do mês">${topo(`${plural(g.total, 'peça', 'peças')}, ${d.anterior.geral.total === 1 ? 'era 1' : `eram ${d.anterior.geral.total}`} em ${ant}`)}
      <p class="v2c-pts">${pontos.map(([n, r, c]) => `<span style="--c:${c}"><b>${n}</b> ${r}</span>`).join('')}</p>
      <div class="v2c-eq-grade">${linhas}</div>
      <p class="v2c-sub v2c-pe">${resto > 0 ? `+ ${plural(resto, 'cliente', 'clientes')} · ` : ''}${plural(media, 'peça', 'peças')} por cliente em média, com a divisão de cada um · ${abrirAba}</p></section>`;
  }
  function corpoAprovar() {
    if (!A()) return vazio('As aprovações não carregaram.', 'Recarregue a página para tentar de novo.');
    const f = filaParaAprovar();
    return `<div class="v2c-apr">${falaHtml(f)}<div class="v2c-cols">${mesaHtml(f)}<div class="v2c-lado">${filaHtml(f)}${cartaoEquilibrio()}</div></div></div>`;
  }
  // Passar de carta mexe só nas posições (data-pos): é a troca que anima. A tela inteira só é refeita quando a fila muda.
  function passar(para) {
    const fila = filaParaAprovar()?.fila || [], el = janela();
    const novo = Math.max(0, Math.min(para, fila.length - 1));
    if (novo === st.apr || !fila.length) return;
    st.apr = novo;
    const faltaThumb = fila.slice(novo, novo + 3).some((i) => st.thumbs[String(i.ref)] === undefined);
    if (faltaThumb || st.aprLista) return pintar(); // a prévia das que chegaram é pedida no desenho
    el.querySelectorAll('[data-vc-carta]').forEach((c) => { const k = Number(c.dataset.vcCarta), pos = posDaCarta(k);
      if (pos) c.dataset.pos = pos; else delete c.dataset.pos;
      c.setAttribute('aria-hidden', String(pos !== '0')); const b = c.querySelector('[data-vc-apr-ver]'); if (b) { if (pos === '0') b.removeAttribute('tabindex'); else b.tabIndex = -1; } });
    el.querySelectorAll('.v2c-mesa .v2-pontos > i').forEach((p, k) => p.classList.toggle('on', k === novo));
    const conta = el.querySelector('[data-vc-apr-conta]'); if (conta) conta.textContent = `${novo + 1} de ${fila.length}`;
  }
  const abrirDaFila = (i) => { const abre = i.quadro === 'demandas' ? globalThis.openDemandaWorkspace : globalThis.openItemWorkspace; if (typeof abre === 'function') abre(i.ref); };
  function decidir(acao, doLote = false) {
    if (!doLote) st.lote = [];
    const i = (filaParaAprovar()?.fila || [])[st.apr]; if (!i) return;
    const item = itemDoPainel(i), alvo = acao === 'aprovar' ? 'para agendar' : 'alteração';
    const opcoes = item && typeof operationalStatusOptions === 'function' ? operationalStatusOptions(item) : (typeof STATUS_OPTIONS !== 'undefined' ? STATUS_OPTIONS : []);
    const opcao = (opcoes || []).find((o) => String(o.label || '').trim().toLowerCase() === alvo);
    const portao = acao === 'aprovar' ? globalThis.openQualityGate : globalThis.openStatusContextGate;
    // Sem a peça no painel, sem o status no quadro dela ou sem o portão: a decisão é na própria peça, como sempre foi.
    if (!item || !opcao || typeof portao !== 'function') { st.lote = []; toast('Abri a peça: a decisão dela é por lá.', 'info'); return abrirDaFila(i); }
    portao(item, opcao);
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
    if (t.dataset.vcAba) { st.aba = t.dataset.vcAba; st.lote = []; if (st.aba === 'links' && !st.links) carregarLinks(); if (st.aba === 'aprovar') relerFila(); return pintar(); }
    if (t.dataset.vcEqCliente !== undefined) { st.aba = 'equilibrio'; st.cliente = t.dataset.vcEqCliente; st.peca = ''; st.lote = []; return pintar(); }
    if (t.matches('[data-vc-apr-lista]')) { st.aprLista = t.closest('.v2c-fila') ? true : !st.aprLista; st.lote = []; return pintar(); }
    if (t.matches('[data-vc-apr-lote]')) { st.lote = deAmanha(filaParaAprovar()?.fila || []).map((i) => String(i.ref)); return seguirLote(); }
    if (t.matches('[data-vc-apr-reler]')) return relerFila(true);
    if (t.dataset.vcAprIr !== undefined) { st.lote = []; if (st.aprLista) { st.aprLista = false; st.apr = Number(t.dataset.vcAprIr); return pintar(); } return passar(Number(t.dataset.vcAprIr)); }
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
    if (!st.aberto) return;
    // Por cima da janela pode haver a gaveta da peça (aberta pela prévia), o cadastro ou um portão: eles vêm primeiro.
    const porCima = porCimaDaJanela();
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && st.aba === 'aprovar' && !porCima && !e.target.closest?.('input, textarea, select, [contenteditable="true"]')) { e.preventDefault(); st.lote = []; return passar(st.apr + (e.key === 'ArrowRight' ? 1 : -1)); }
    if (e.key !== 'Escape') return;
    if (porCima) return;
    e.preventDefault(); e.stopPropagation();
    if (st.ajuda) { st.ajuda = false; return pintar(); }
    if (st.peca) { st.peca = ''; return pintar(); }
    fechar();
  }, true);

  function abrir({ aba = 'aprovar', cliente = '', mes = '' } = {}) {
    st.aberto = true; st.aba = ['links', 'equilibrio'].includes(aba) ? aba : 'aprovar';
    if (st.aba === 'aprovar') { relerFila(); st.aprLista = false; st.falaN = -1; if (!st.links && !st.erroLinks) carregarLinks(); }
    st.lote = [];
    st.mes = /^\d{4}-\d{2}$/.test(mes) ? mes : (st.mes || hoje().slice(0, 7));
    if (cliente) st.cliente = cliente;
    st.novoLink = null;
    pintar();
    carregarObjetivos();
    if (st.aba === 'links') carregarLinks();
    janela().querySelector('[data-vc-fechar]')?.focus();
  }
  function fechar() { st.aberto = false; st.peca = ''; st.ajuda = false; st.novoLink = null; st.lote = []; pintar(); }

  function ciclo() { clearTimeout(st.timer); st.timer = setTimeout(async () => { if (!document.hidden) await carregarObjetivos(); ciclo(); }, 120e3); }
  setTimeout(() => { carregarObjetivos(); ciclo(); }, 3000);

  window.VybeConteudo = Object.freeze({ abrir, fechar, aberto: () => st.aberto, atualizar: carregarObjetivos, bolinhaHtml, campoObjetivoHtml, definirObjetivo, objetivoDe,
    estado: () => ({ aberto: st.aberto, aba: st.aba, mes: st.mes, cliente: st.cliente, pronto: st.pronto, objetivos: { ...st.objetivos } }) });
})();
