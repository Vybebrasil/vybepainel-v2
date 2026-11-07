// Conversa da equipe e recados no Irecity (07/11/2026).
// No Irecity o #painel-escritorio fica escondido (body.mundo-sobre-escritorio): a aba Conversa
// e os Recados do Escritório eram desenhados lá dentro e não apareciam. Este painel flutuante
// mora no <body> e só DESENHA; lê e envia pelo mesmo caminho do Escritório, que segue como motor.
//  - Conversa: lê area=escritorio&acao=mensagens&sala=<escritorio.sala> (a leitura de
//    carregarChatEscritorio) e envia por enviarChatEscritorio(form), a própria função do
//    Escritório (grava, avisa a sala com chat:changed, balão e comandos como ":sentar").
//  - Recados: as rotas de abrirRecadosEscritorio e vizinhas (recados, recado, recados-lidos),
//    o mesmo aviso recado:novo pelo socket e o resumo de não lidos de carregarResumoRecados
//    (escritorio.recadosResumo).
//  - Atualiza sozinho: ouve o MESMO socket (chat:changed, recado:novo) com addEventListener,
//    sem trocar o onmessage do Escritório; sem socket aberto, relê a cada 10 s enquanto aberto.
//  - Com o Irecity ligado (body.mundo), abrirRecadosEscritorio e alternarAbaEscritorio
//    ('conversa' | 'recados') abrem este painel: a ficha ("Deixar recado"), o menu da pessoa e a
//    Equipe do mundo chamam essas duas. Fora do Irecity, o Escritório antigo segue igual.
// API: window.VybeConversa = { abrir(aba = 'conversa' | 'recados', pessoaId?), fechar(), aberto() }
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.VybeConversa) return;

  const VIGIA_MS = 1500;
  const RELEITURA_SEM_SOCKET_MS = 10000;
  const ESPERA_ENTRADA_MS = 15000;
  const ICONE_FECHAR = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  const st = {
    aberto: false, aba: 'conversa', com: null, busca: '',
    raiz: null, botoesAba: {}, badge: null, corpo: null, refs: {},
    vigia: 0, socket: null, tinhaBase: null, resumo: '', naoLidos: -1,
    entrandoDesde: 0, mostrandoEntrada: false, focoAntes: null,
    chat: { sala: '', lista: null, erro: '', seq: 0, lidoEm: 0 },
    recado: { com: '', lista: null, erro: '', seq: 0, lidoEm: 0 },
  };

  // ---------- leitura do estado do Escritório (sem mudar nada nele) ----------
  const E = () => (typeof escritorio !== 'undefined' && escritorio ? escritorio : null);
  const base = () => E()?.base || null;
  const eu = () => String(base()?.eu ?? '');
  const equipe = () => (Array.isArray(base()?.equipe) ? base().equipe : []);
  const fn = (nome) => (typeof window[nome] === 'function' ? window[nome] : null);
  const salaAtual = () => E()?.sala || 'convivencia';
  const nomeSala = (sala) => (typeof ESCRITORIO_SALAS !== 'undefined' && ESCRITORIO_SALAS?.[sala]) || 'Convivência';
  const nomeDe = (id) => equipe().find((p) => String(p.id) === String(id))?.nome || 'Alguém';
  const primeiro = (nome) => String(nome || '').trim().split(/\s+/)[0] || 'Alguém';
  const totalNaoLidos = () => Object.values(E()?.recadosResumo || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const assinaturaResumo = () => JSON.stringify([E()?.recadosResumo || {}, E()?.recadosIndisponivel || '', equipe().length]);
  const socketAberto = () => E()?.socket?.readyState === 1; // WebSocket.OPEN
  const noIrecity = () => Boolean(document.body?.classList?.contains('mundo') || document.body?.classList?.contains('mundo-sobre-escritorio'));
  const toque = () => Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);

  // ---------- utilidades de texto ----------
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
  function hora(iso) {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? h : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + h;
  }
  // Mesmo formato que o servidor exige (a do Escritório usa crypto.randomUUID).
  function novaChave() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const h = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
    h[12] = '4'; h[16] = '89ab'[Math.floor(Math.random() * 4)];
    return `${h.slice(0, 8).join('')}-${h.slice(8, 12).join('')}-${h.slice(12, 16).join('')}-${h.slice(16, 20).join('')}-${h.slice(20).join('')}`;
  }
  function el(tag, classe, atributos = {}) {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    for (const [k, v] of Object.entries(atributos)) n.setAttribute(k, v);
    return n;
  }
  const notaHtml = (texto) => `<p class="vv-conversa-nota" role="status">${esc(texto)}</p>`;
  const vazioHtml = (titulo, texto) => `<div class="vv-conversa-vazio"><b>${esc(titulo)}</b><p>${esc(texto)}</p></div>`;
  const erroHtml = (texto) => `<div class="vv-conversa-vazio" role="alert"><b>Não deu para carregar</b><p>${esc(texto)}</p><button type="button" class="vv-conversa-sec" data-vc="recarregar">Tentar de novo</button></div>`;
  // Bolhas: as minhas à direita; nome só na primeira de uma sequência da mesma pessoa.
  function bolhasHtml(itens) {
    return itens.map((m, i) => {
      const seguido = i > 0 && String(itens[i - 1].autor) === String(m.autor);
      const quando = hora(m.quando);
      return `<article class="vv-conversa-msg${m.meu ? ' meu' : ''}${seguido ? ' seguido' : ''}">${seguido ? '' : `<b>${esc(m.meu ? 'Você' : m.nome)}</b>`}<p>${esc(m.texto)}</p>${quando || m.extra ? `<time datetime="${esc(m.quando || '')}">${esc(quando)}${m.extra ? ' · ' + esc(m.extra) : ''}</time>` : ''}</article>`;
    }).join('');
  }

  // ---------- estrutura ----------
  function garantirRaiz() {
    if (st.raiz) {
      if (!st.raiz.parentNode && document.body) document.body.append(st.raiz);
      return st.raiz;
    }
    const raiz = el('section', 'vv-conversa', { role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Conversa da equipe', tabindex: '-1' });
    raiz.hidden = true;
    const topo = el('header', 'vv-conversa-topo');
    const abas = el('div', 'vv-conversa-abas', { role: 'tablist', 'aria-label': 'Conversa da equipe ou recados' });
    for (const [id, rotulo] of [['conversa', 'Conversa'], ['recados', 'Recados']]) {
      const b = el('button', '', { type: 'button', role: 'tab', id: 'vv-conversa-aba-' + id, 'aria-controls': 'vv-conversa-corpo', 'data-aba': id });
      b.textContent = rotulo;
      b.addEventListener('click', () => { mostrar(id, null); focar(); });
      b.addEventListener('keydown', (ev) => {
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
        ev.preventDefault?.();
        const outra = id === 'conversa' ? 'recados' : 'conversa';
        mostrar(outra, null);
        st.botoesAba[outra].focus?.();
      });
      st.botoesAba[id] = b;
      abas.append(b);
    }
    st.badge = el('span', 'vv-conversa-badge', { 'aria-hidden': 'true' });
    st.badge.hidden = true;
    st.botoesAba.recados.append(st.badge);
    const x = el('button', 'vv-conversa-x', { type: 'button', 'aria-label': 'Fechar', title: 'Fechar (Esc)' });
    x.innerHTML = ICONE_FECHAR;
    x.addEventListener('click', () => fechar());
    topo.append(abas, x);
    st.corpo = el('div', 'vv-conversa-corpo', { id: 'vv-conversa-corpo', role: 'tabpanel' });
    raiz.append(topo, st.corpo);
    // Esc fecha só o que está por cima: o evento não sobe para o mundo.
    raiz.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      ev.preventDefault?.();
      ev.stopPropagation?.();
      fechar();
    });
    raiz.addEventListener('click', aoClicar);
    document.body.append(raiz);
    st.raiz = raiz;
    return raiz;
  }
  function pintarAbas() {
    if (!st.raiz) return;
    for (const [id, b] of Object.entries(st.botoesAba)) {
      b.setAttribute('aria-selected', String(st.aba === id));
      b.setAttribute('tabindex', st.aba === id ? '0' : '-1');
    }
    const n = totalNaoLidos();
    st.naoLidos = n;
    st.badge.textContent = String(n);
    st.badge.hidden = !n;
    if (n) st.botoesAba.recados.setAttribute('aria-label', `Recados, ${n} ${n === 1 ? 'não lido' : 'não lidos'}`);
    else st.botoesAba.recados.removeAttribute('aria-label');
  }
  // Cliques no que foi desenhado por texto (lista de pessoas, voltar, tentar de novo, entrar).
  function aoClicar(ev) {
    const alvo = ev.target?.closest?.('[data-vc]');
    if (!alvo) return;
    const { vc, valor } = alvo.dataset || {};
    if (vc === 'pessoa') mostrar('recados', valor);
    else if (vc === 'voltar') mostrar('recados', null);
    else if (vc === 'entrar') { entrarNoEscritorio(); return; }
    else if (vc === 'recarregar') {
      if (st.aba === 'conversa') lerConversa();
      else if (st.com) lerRecados();
      else lerResumo();
      return;
    } else return;
    focar();
  }
  function focar() {
    if (!st.raiz || !st.aberto) return;
    const alvo = (!toque() && (st.refs.campo || st.refs.busca)) || st.raiz;
    try { alvo.focus?.({ preventScroll: true }); } catch { /* foco é conforto, não regra */ }
  }
  function destino(aba, com) {
    const qual = aba === 'recados' ? 'recados' : 'conversa';
    const id = com == null || com === '' ? null : String(com);
    return { aba: qual, com: qual === 'recados' && id && id !== eu() ? id : null };
  }
  function mostrar(aba, com) {
    Object.assign(st, destino(aba, com));
    montar();
  }
  function montar() {
    garantirRaiz();
    pintarAbas();
    st.refs = {};
    st.corpo.innerHTML = '';
    st.tinhaBase = Boolean(base());
    if (!st.tinhaBase) { montarSemEscritorio(); return; }
    st.entrandoDesde = 0;
    st.mostrandoEntrada = false;
    st.resumo = assinaturaResumo();
    ligarSocket();
    if (st.aba === 'conversa') montarConversa();
    else if (st.com) montarRecado();
    else montarListaRecados();
  }

  // ---------- sem Escritório ----------
  function montarSemEscritorio() {
    const pode = Boolean(fn('abrirEscritorio'));
    const entrando = Boolean(st.entrandoDesde) && Date.now() - st.entrandoDesde < ESPERA_ENTRADA_MS;
    const venceu = Boolean(st.entrandoDesde) && !entrando;
    st.mostrandoEntrada = entrando;
    const caixa = el('div', 'vv-conversa-vazio');
    caixa.innerHTML = entrando
      ? '<b>Entrando no Escritório…</b><p>A conversa e os recados aparecem assim que a entrada terminar.</p>'
      : `<b>Você ainda não está no Escritório</b><p>${venceu ? 'A entrada não terminou. Confira a internet e tente de novo.' : 'A conversa da equipe e os recados vêm do Escritório. Entre para ler e escrever.'}</p>${pode ? '<button type="button" class="vv-conversa-acao" data-vc="entrar">Entrar no Escritório</button>' : '<p>O Escritório não carregou nesta página. Recarregue o painel.</p>'}`;
    st.corpo.append(caixa);
  }
  function entrarNoEscritorio() {
    const abrirE = fn('abrirEscritorio');
    if (!abrirE) return;
    st.entrandoDesde = Date.now();
    montar();
    try {
      const r = abrirE();
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch { /* o Escritório guarda o erro dele; aqui o painel oferece tentar de novo */ }
    st.raiz?.focus?.({ preventScroll: true });
  }

  // ---------- campo de escrever (Conversa e Recados) ----------
  function formulario({ placeholder, rotulo, aoEnviar, digitando }) {
    const form = el('form', 'vv-conversa-form', { autocomplete: 'off' });
    const erro = el('p', 'vv-conversa-erro', { role: 'alert' });
    erro.hidden = true;
    const campo = el('input', 'vv-conversa-campo', { type: 'text', name: 'texto', maxlength: '2000', required: '', autocomplete: 'off', 'aria-label': rotulo, placeholder });
    const botao = el('button', 'vv-conversa-enviar', { type: 'submit' });
    botao.textContent = 'Enviar';
    // O botão de enviar é o primeiro do formulário: enviarChatEscritorio o procura assim.
    form.append(campo, botao, erro);
    form.addEventListener('submit', (ev) => { ev.preventDefault?.(); aoEnviar(form, campo, botao); });
    campo.addEventListener('input', () => {
      delete form.dataset.chave;
      if (digitando) fn('escritorioDigitando')?.(Boolean(campo.value));
    });
    if (digitando) campo.addEventListener('blur', () => fn('escritorioDigitando')?.(false));
    Object.assign(st.refs, { form, campo, botao, erro });
    return form;
  }
  function mostrarErroEnvio(texto) {
    if (!st.refs.erro) return;
    st.refs.erro.textContent = texto;
    st.refs.erro.hidden = !texto;
  }

  // ---------- Conversa da equipe ----------
  function montarConversa() {
    const cab = el('div', 'vv-conversa-cab');
    const log = el('div', 'vv-conversa-log', { role: 'log', 'aria-live': 'polite', 'aria-label': 'Mensagens da conversa' });
    st.refs.cab = cab;
    st.refs.log = log;
    const form = formulario({ placeholder: 'Mensagem para ' + nomeSala(salaAtual()), rotulo: 'Mensagem para este chat', aoEnviar: enviarConversa, digitando: true });
    st.corpo.append(cab, log, form);
    pintarCabConversa();
    if (st.chat.sala === salaAtual() && st.chat.lista) pintarConversa(true);
    else log.innerHTML = notaHtml('Carregando mensagens…');
    lerConversa();
  }
  function pintarCabConversa() {
    if (!st.refs.cab) return;
    const sala = salaAtual();
    let nota = '';
    try { nota = fn('escritorioNotaChat')?.(sala) || ''; } catch { nota = ''; }
    st.refs.cab.innerHTML = `<h3>Conversa · ${esc(nomeSala(sala))}</h3>${nota ? `<small>${esc(nota)}</small>` : ''}`;
    if (st.refs.campo) st.refs.campo.placeholder = 'Mensagem para ' + nomeSala(sala);
  }
  async function lerConversa() {
    const api = fn('escritorioApi');
    if (!api || !base()) return;
    const sala = salaAtual(), seq = ++st.chat.seq;
    if (st.chat.sala !== sala) { st.chat.lista = null; st.chat.erro = ''; }
    st.chat.sala = sala;
    st.chat.lidoEm = Date.now();
    try {
      // A mesma leitura de carregarChatEscritorio: /api/painel?area=escritorio&acao=mensagens&sala=…
      const d = await api('mensagens', null, { sala });
      if (seq !== st.chat.seq) return;
      st.chat.lista = Array.isArray(d?.mensagens) ? d.mensagens : [];
      st.chat.erro = '';
    } catch (e) {
      if (seq !== st.chat.seq) return;
      st.chat.erro = e?.message || 'Não foi possível ler a conversa.';
    }
    if (st.aberto && st.aba === 'conversa') pintarConversa();
  }
  function pintarConversa(primeira = false) {
    const log = st.refs.log;
    if (!log) return;
    const { lista, erro } = st.chat;
    let html;
    if (!lista) html = erro ? erroHtml(erro) : notaHtml('Carregando mensagens…');
    else {
      const meu = eu();
      html = (erro ? notaHtml(erro) : '') + (lista.length
        ? bolhasHtml(lista.map((m) => ({ meu: String(m.pessoa_id) === meu, autor: m.pessoa_id, nome: m.nome, texto: m.texto, quando: m.criado_em })))
        : vazioHtml('Ninguém escreveu ainda', 'O que você escrever aqui aparece para quem está nesta conversa.'));
    }
    if (!primeira && html === st.refs.ultimoLog) return; // nada mudou: a rolagem fica onde está
    const noFim = primeira || !st.refs.ultimoLog || log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    st.refs.ultimoLog = html;
    log.innerHTML = html;
    if (noFim) log.scrollTop = log.scrollHeight;
  }
  async function enviarConversa(form, campo, botao) {
    const texto = campo.value;
    if (!texto.trim() || botao.disabled) return;
    const enviar = fn('enviarChatEscritorio');
    if (!enviar) { mostrarErroEnvio('O Escritório não carregou: não dá para enviar agora.'); return; }
    mostrarErroEnvio('');
    // A função do Escritório: grava, avisa a sala (chat:changed), mostra o balão e trata
    // ":sentar". Ela limpa o campo quando dá certo e põe o erro no aviso dela (#office-feedback).
    try { await enviar(form); } catch { /* enviarChatEscritorio já trata os próprios erros */ }
    if (campo.value && campo.value === texto) {
      const aviso = document.getElementById?.('office-feedback')?.textContent?.trim();
      mostrarErroEnvio(aviso || 'Não foi possível enviar. Tente de novo.');
      return;
    }
    await lerConversa();
    if (st.aberto && !toque()) campo.focus?.({ preventScroll: true });
  }

  // ---------- Recados ----------
  function montarListaRecados() {
    const cab = el('div', 'vv-conversa-cab');
    cab.innerHTML = '<h3>Recados</h3><small>Mensagem só para uma pessoa. Fica guardada até ela ler, mesmo fora do escritório.</small>';
    const busca = el('input', 'vv-conversa-campo vv-conversa-busca', { type: 'search', placeholder: 'Buscar pessoa', 'aria-label': 'Buscar pessoa', autocomplete: 'off' });
    busca.value = st.busca;
    busca.addEventListener('input', () => { st.busca = busca.value; pintarListaRecados(); });
    const lista = el('ul', 'vv-conversa-pessoas', { 'aria-label': 'Pessoas da equipe' });
    Object.assign(st.refs, { busca, lista });
    st.corpo.append(cab, busca, lista);
    pintarListaRecados();
    lerResumo();
  }
  function pintarListaRecados() {
    const lista = st.refs.lista;
    if (!lista) return;
    const e = E();
    if (e?.recadosIndisponivel) { lista.innerHTML = `<li>${notaHtml(e.recadosIndisponivel)}</li>`; return; }
    const resumo = e?.recadosResumo || {}, q = semAcento(st.busca).trim(), meu = eu();
    const pessoas = equipe().filter((p) => String(p.id) !== meu)
      .sort((a, b) => (Number(resumo[b.id]) || 0) - (Number(resumo[a.id]) || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
      .filter((p) => !q || semAcento(p.nome).includes(q));
    lista.innerHTML = pessoas.length
      ? pessoas.map((p) => {
        const n = Number(resumo[p.id]) || 0;
        return `<li><button type="button" class="vv-conversa-pessoa" data-vc="pessoa" data-valor="${esc(p.id)}"><span class="vv-conversa-av" aria-hidden="true">${esc(iniciais(p.nome))}</span><span class="vv-conversa-pessoa-nome">${esc(p.nome)}</span>${n ? `<span class="vv-conversa-badge">${n}<span class="vv-conversa-so-leitor"> ${n === 1 ? 'não lido' : 'não lidos'}</span></span>` : ''}</button></li>`;
      }).join('')
      : `<li>${notaHtml(q ? 'Ninguém com esse nome.' : 'Ninguém da equipe por aqui ainda.')}</li>`;
  }
  // carregarResumoRecados é a do Escritório: atualiza escritorio.recadosResumo (ou o aviso de
  // indisponível) e o envelope da mesa. O painel só redesenha a partir dela.
  async function lerResumo() {
    const ler = fn('carregarResumoRecados');
    if (!ler || !base()) return;
    try { await ler(); } catch { /* o erro fica em escritorio.recadosIndisponivel */ }
    if (!st.aberto) return;
    pintarAbas();
    st.resumo = assinaturaResumo();
    if (st.aba === 'recados' && !st.com) pintarListaRecados();
  }
  function montarRecado() {
    const com = st.com, nome = nomeDe(com);
    const cab = el('div', 'vv-conversa-cab vv-conversa-cab-recado');
    cab.innerHTML = `<button type="button" class="vv-conversa-voltar" data-vc="voltar" aria-label="Voltar para a lista de recados">‹ Recados</button><h3>${esc(nome)}</h3>`;
    const log = el('div', 'vv-conversa-log', { role: 'log', 'aria-live': 'polite', 'aria-label': 'Recados com ' + nome });
    st.refs.log = log;
    const form = formulario({ placeholder: 'Recado para ' + primeiro(nome), rotulo: 'Recado para ' + nome, aoEnviar: enviarRecado });
    st.corpo.append(cab, log, form);
    if (st.recado.com === com && st.recado.lista) pintarRecado(true);
    else log.innerHTML = notaHtml('Carregando recados…');
    lerRecados();
  }
  async function lerRecados() {
    const api = fn('escritorioApi'), com = st.com;
    if (!api || !base() || !com) return;
    const seq = ++st.recado.seq;
    if (st.recado.com !== com) { st.recado.lista = null; st.recado.erro = ''; }
    st.recado.com = com;
    st.recado.lidoEm = Date.now();
    let lido = false;
    try {
      // A mesma leitura de carregarConversaRecados: /api/painel?area=escritorio&acao=recados&com=…
      const d = await api('recados', null, { com });
      if (seq !== st.recado.seq) return;
      st.recado.lista = Array.isArray(d?.recados) ? d.recados : [];
      st.recado.erro = '';
      lido = true;
    } catch (e) {
      if (seq !== st.recado.seq) return;
      st.recado.erro = e?.message || 'Não foi possível ler os recados.';
    }
    const vendo = st.aberto && st.aba === 'recados' && st.com === com;
    if (vendo) pintarRecado();
    // Como carregarConversaRecados: com a conversa na tela, marca como lido e relê o resumo.
    const meu = eu();
    if (vendo && lido && !base()?.demo && st.recado.lista.some((m) => String(m.para) === meu && !m.lido_em)) {
      try { await api('recados-lidos', { com }); } catch { return; }
      lerResumo();
    }
  }
  function pintarRecado(primeira = false) {
    const log = st.refs.log;
    if (!log) return;
    const { lista, erro } = st.recado;
    let html;
    if (!lista) html = erro ? erroHtml(erro) : notaHtml('Carregando recados…');
    else {
      const meu = eu();
      html = (erro ? notaHtml(erro) : '') + (lista.length
        ? bolhasHtml(lista.map((m) => {
          const minha = String(m.de) === meu;
          return { meu: minha, autor: m.de, nome: primeiro(nomeDe(m.de)), texto: m.texto, quando: m.criado_em, extra: minha && m.lido_em ? 'lido' : '' };
        }))
        : vazioHtml('Nenhum recado ainda', `Escreva o primeiro: ${primeiro(nomeDe(st.com))} vê quando abrir o escritório.`));
    }
    if (!primeira && html === st.refs.ultimoLog) return;
    const noFim = primeira || !st.refs.ultimoLog || log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    st.refs.ultimoLog = html;
    log.innerHTML = html;
    if (noFim) log.scrollTop = log.scrollHeight;
  }
  // As mesmas chamadas de enviarRecadoEscritorioForm, sem mexer em escritorio.recadoCom
  // (estado da aba antiga): grava, avisa a pessoa pelo socket e relê a conversa.
  async function enviarRecado(form, campo, botao) {
    const api = fn('escritorioApi'), para = st.com, texto = campo.value;
    if (!api || !para || !texto.trim() || botao.disabled) return;
    mostrarErroEnvio('');
    botao.disabled = true;
    const chave = form.dataset.chave || novaChave();
    form.dataset.chave = chave;
    try {
      await api('recado', { para, texto, chave });
      campo.value = '';
      delete form.dataset.chave;
      fn('escritorioEmitir')?.('recado:novo', { para });
      await lerRecados();
    } catch (e) {
      mostrarErroEnvio(e?.message || 'Não foi possível enviar o recado.');
    } finally {
      botao.disabled = false;
    }
    if (st.aberto && !toque()) campo.focus?.({ preventScroll: true });
  }

  // ---------- atualização sozinha ----------
  // Ouve o mesmo socket do Escritório sem trocar o onmessage dele. A renovação da sessão
  // abre um socket novo a cada 4,5 min: a vigia troca o ouvinte junto.
  function aoMensagemDoSocket(ev) {
    if (!st.aberto) return;
    let m;
    try { m = JSON.parse(ev?.data); } catch { return; }
    if (m?.type === 'chat:changed') {
      if (st.aba === 'conversa' && m.payload?.sala === salaAtual()) lerConversa();
    } else if (m?.type === 'recado:novo') {
      if (st.aba === 'recados' && st.com && String(m.payload?.de) === st.com) lerRecados();
      else lerResumo();
    }
  }
  function ligarSocket() {
    const s = E()?.socket || null;
    if (s === st.socket) return;
    desligarSocket();
    st.socket = s;
    try { s?.addEventListener?.('message', aoMensagemDoSocket); } catch { /* sem socket: a vigia relê */ }
  }
  function desligarSocket() {
    try { st.socket?.removeEventListener?.('message', aoMensagemDoSocket); } catch { /* socket já fechado */ }
    st.socket = null;
  }
  function vigiar() {
    if (!st.aberto) return;
    if (st.raiz && !st.raiz.parentNode && document.body) document.body.append(st.raiz);
    const tem = Boolean(base());
    if (tem !== st.tinhaBase) { montar(); return; }
    if (!tem) {
      // Passou o tempo de espera da entrada: troca "Entrando…" pelo botão de novo.
      if (st.mostrandoEntrada && Date.now() - st.entrandoDesde >= ESPERA_ENTRADA_MS) montar();
      return;
    }
    ligarSocket();
    if (totalNaoLidos() !== st.naoLidos) pintarAbas();
    const resumo = assinaturaResumo();
    if (resumo !== st.resumo) {
      st.resumo = resumo;
      if (st.aba === 'recados' && !st.com) pintarListaRecados();
    }
    const semSocket = !socketAberto();
    if (st.aba === 'conversa') {
      // Mudou de ala no prédio: a conversa passa para o chat de lá (como atualizarChatEscritorio).
      if (salaAtual() !== st.chat.sala) { pintarCabConversa(); lerConversa(); }
      else if (semSocket && Date.now() - st.chat.lidoEm >= RELEITURA_SEM_SOCKET_MS) lerConversa();
    } else if (st.com && semSocket && Date.now() - st.recado.lidoEm >= RELEITURA_SEM_SOCKET_MS) lerRecados();
  }

  // ---------- API ----------
  function abrir(aba = 'conversa', pessoaId = null) {
    const raiz = garantirRaiz();
    const alvo = destino(aba, pessoaId);
    // Já aberto no mesmo lugar: não redesenha (o texto que está sendo escrito fica).
    const mesmo = st.aberto && st.aba === alvo.aba && st.com === alvo.com && st.tinhaBase === Boolean(base());
    if (!st.aberto) {
      st.focoAntes = document.activeElement || null;
      st.vigia = setInterval(vigiar, VIGIA_MS);
    }
    st.aberto = true;
    raiz.hidden = false;
    if (!mesmo) mostrar(alvo.aba, alvo.com);
    focar();
  }
  function fechar() {
    if (!st.aberto) return;
    st.aberto = false;
    clearInterval(st.vigia);
    st.vigia = 0;
    desligarSocket();
    if (st.aba === 'conversa') fn('escritorioDigitando')?.(false);
    if (st.raiz) st.raiz.hidden = true;
    const volta = st.focoAntes;
    st.focoAntes = null;
    if (volta && volta !== document.body && volta.isConnected !== false) {
      try { volta.focus?.({ preventScroll: true }); } catch { /* o elemento de antes pode ter saído */ }
    }
  }

  // Com o Irecity ligado o painel antigo nunca aparece: quem pede a aba Conversa ou os
  // Recados do Escritório (ficha, menu da pessoa, Equipe do mundo) cai aqui. Fora dele, nada muda.
  function desviarDoEscritorio() {
    const recados = window.abrirRecadosEscritorio;
    if (typeof recados === 'function' && !recados.vvConversa) {
      const desvio = function (id) { return noIrecity() ? abrir('recados', id) : recados.apply(this, arguments); };
      desvio.vvConversa = true;
      window.abrirRecadosEscritorio = desvio;
    }
    const aba = window.alternarAbaEscritorio;
    if (typeof aba === 'function' && !aba.vvConversa) {
      const desvio = function (qual) { return noIrecity() && (qual === 'conversa' || qual === 'recados') ? abrir(qual) : aba.apply(this, arguments); };
      desvio.vvConversa = true;
      window.alternarAbaEscritorio = desvio;
    }
  }

  window.VybeConversa = { abrir, fechar, aberto: () => st.aberto };
  desviarDoEscritorio();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', desviarDoEscritorio, { once: true });
})();
