// vybe-mundo-whatsapp.js — WhatsApp interno do Vybe OS (Paulo, 07/11/2026).
//
// O botão da barra do topo do Irecity (data-ferr="whatsapp", em vybe-mundo.js) abre um painel no jeito do WhatsApp com os
// grupos internos da Vybe e os grupos dos clientes que o VYBES espelha no PC do Paulo: as mensagens que chegam, a aba
// "Menções a você", o número de não lidas e o aviso (notificação do navegador + aviso na tela) quando chega mensagem nova
// ou alguém marca a pessoa.
// SÓ LEITURA nesta etapa: não há campo de envio. Lê /api/painel?area=vybes&etapa=whatsapp (server/vybes-whatsapp.js), que vai
// à central pelo túnel com o crachá de quem está logado; a central decide quem vê o quê (donos: tudo; equipe: os grupos de que
// participa). As não lidas ficam neste aparelho (localStorage, por pessoa) e só conta o que chegou depois da primeira abertura.
(() => {
  const ROTA = '/api/painel?area=vybes&etapa=whatsapp';
  const ABERTO_MS = 12e3, FECHADO_MS = 40e3, ESCONDIDO_MS = 60e3, ERRO_MS = 90e3, SEM_HUD_MS = 10e3;
  const st = { dados: null, erro: '', aberto: false, aba: 'conversas', filtro: 'todos', busca: '', conversa: null, msgs: null, erroConversa: '',
    lidas: null, chave: '', ultimoSeq: null, timer: 0, buscando: null, avisos: [], foco: null };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = { balao: svg('<path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5z"/>'), fechar: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    voltar: svg('<path d="M15 18l-6-6 6-6"/>'), cadeado: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    sino: svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>') };
  const fmt = (o) => { try { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', ...o }); } catch { return new Intl.DateTimeFormat('pt-BR', o); } };
  const F_HORA = fmt({ hour: '2-digit', minute: '2-digit' }), F_DIA = fmt({ day: '2-digit', month: '2-digit' }), F_SEMANA = fmt({ weekday: 'short', day: '2-digit', month: '2-digit' }), F_ISO = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' });
  const diaDe = (ms) => F_ISO.format(new Date(ms));
  const hora = (ms) => F_HORA.format(new Date(ms));
  const relativo = (ms) => { const d = diaDe(ms), hoje = diaDe(Date.now()), ontem = diaDe(Date.now() - 864e5); return d === hoje ? 'Hoje' : d === ontem ? 'Ontem' : F_SEMANA.format(new Date(ms)); };
  const quando = (ms) => { const r = relativo(ms); return r === 'Hoje' ? hora(ms) : r === 'Ontem' ? 'Ontem' : F_DIA.format(new Date(ms)); };
  const nomeCurto = (c) => (c.tipo === 'cliente' && c.cliente) || String(c.nome || '').replace(/^\s*#?\s*vybe\s*[-–—:]\s*/i, '') || c.nome;
  const iniciais = (n) => String(n || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '#';
  // Cor de identificação de quem escreve (ponto ao lado do nome, nunca o texto): estável por nome.
  const CORES = ['#0B6E4F', '#1F4FA8', '#6E3DB8', '#A3366F', '#8A5A00', '#0E6F7C', '#5B4BD6', '#9C3D00'];
  const corDe = (n) => { let h = 0; for (const ch of String(n || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0; return CORES[h % CORES.length]; };
  const resumoMsg = (m) => (m.apagada ? '🚫 Mensagem apagada' : [m.midia, m.texto].filter(Boolean).join(' ') || 'Mensagem');

  // ---------- Lidas (por pessoa, neste aparelho) ----------
  function carregarLidas(eu, seq) {
    const chave = 'vybe.whatsapp.v1.' + (eu?.pessoa || eu?.nome || 'eu');
    if (st.chave === chave && st.lidas) return;
    if (st.chave && st.chave !== chave) st.ultimoSeq = null; // trocou de pessoa no mesmo navegador: não avisa o que era da outra
    st.chave = chave;
    try { st.lidas = JSON.parse(localStorage.getItem(chave)); } catch { st.lidas = null; }
    if (!st.lidas || !Number.isSafeInteger(st.lidas.inicio) || typeof st.lidas.conv !== 'object') st.lidas = { inicio: seq, conv: {}, mencoes: seq };
    guardarLidas();
  }
  function guardarLidas() { try { localStorage.setItem(st.chave, JSON.stringify(st.lidas)); } catch { /* sem armazenamento: vale até fechar */ } }
  const lidaAte = (id) => Math.max(st.lidas?.conv?.[id] ?? st.lidas?.inicio ?? 0, 0);
  const naoLidasDe = (c) => (st.lidas ? c.recebidas.filter((s) => s > lidaAte(c.id)).length : 0);
  const mencaoNaoLida = (m) => st.lidas && m.seq > Math.max(st.lidas.mencoes ?? 0, lidaAte(m.conversa));
  function marcarLida(id, seq) {
    if (!st.lidas) return;
    const c = st.dados?.conversas?.find((x) => x.id === id);
    const ate = Math.max(seq ?? 0, c?.ultima?.seq ?? 0, st.msgs?.id === id ? (st.msgs.mensagens.at(-1)?.seq ?? 0) : 0);
    if (ate > lidaAte(id)) { st.lidas.conv[id] = ate; guardarLidas(); }
    pintarBadge();
  }
  function marcarMencoesLidas() {
    if (!st.lidas) return;
    const ate = Math.max(0, ...(st.dados?.mencoes || []).map((m) => m.seq));
    if (ate > (st.lidas.mencoes ?? 0)) { st.lidas.mencoes = ate; guardarLidas(); }
    pintarBadge();
  }
  function contagem() {
    const conversas = st.dados?.conversas || [], porConversa = {};
    let naoLidas = 0;
    for (const c of conversas) { const n = naoLidasDe(c); if (n) { porConversa[c.id] = n; naoLidas += n; } }
    const mencoesNaoLidas = (st.dados?.mencoes || []).filter(mencaoNaoLida).length;
    return { naoLidas, porConversa, mencoesNaoLidas };
  }

  // ---------- Leitura ----------
  async function lerJson(url) {
    const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout?.(25000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d?.error || (r.status === 401 ? 'Entre no painel para ver o WhatsApp.' : 'WhatsApp indisponível agora.')), { status: r.status });
    return d;
  }
  async function atualizar() {
    if (st.buscando) return st.buscando;
    st.buscando = (async () => {
      try {
        const d = await lerJson(ROTA);
        if (!d?.eu || !Array.isArray(d.conversas) || !Array.isArray(d.mencoes) || !Number.isSafeInteger(d.seq)) throw new Error('Resposta inesperada da central do VYBES.');
        carregarLidas(d.eu, d.seq);
        const antes = st.ultimoSeq;
        st.dados = d; st.erro = '';
        if (antes != null && d.seq > antes) avisarNovidades(d, antes);
        st.ultimoSeq = Math.max(antes ?? 0, d.seq);
        // Conversa aberta com mensagem nova: relê só ela.
        const aberta = st.conversa && d.conversas.find((c) => c.id === st.conversa);
        if (st.aberto && aberta && aberta.ultima.seq > (st.msgs?.id === aberta.id ? st.msgs.mensagens.at(-1)?.seq ?? 0 : 0)) await abrirConversa(aberta.id, { manter: true });
      } catch (e) { st.erro = e.message || 'WhatsApp indisponível agora.'; }
      finally { st.buscando = null; pintarBadge(); pintar(); }
    })();
    return st.buscando;
  }
  async function abrirConversa(id, { manter = false, focar = null } = {}) {
    st.conversa = id; st.erroConversa = ''; st.foco = focar;
    if (!manter || st.msgs?.id !== id) { st.msgs = null; pintar(); }
    const lista = document.getElementById?.('vv-wa-mensagens'), noFim = !lista || lista.scrollHeight - lista.scrollTop - lista.clientHeight < 60;
    try {
      const d = await lerJson(`${ROTA}&conversa=${encodeURIComponent(id)}`);
      if (st.conversa !== id) return;
      if (d?.conversa?.id !== id || !Array.isArray(d.conversa.mensagens)) throw new Error('Resposta inesperada da central do VYBES.');
      st.msgs = d.conversa;
    } catch (e) { if (st.conversa === id) st.erroConversa = e.message; }
    pintar({ rolar: !manter || noFim });
    if (st.aberto && !document.hidden && st.msgs?.id === id) marcarLida(id);
  }

  // ---------- Avisos: notificação do navegador e aviso na tela ----------
  function avisarNovidades(d, antes) {
    const lendo = (id) => st.aberto && !document.hidden && st.conversa === id;
    const mencoes = (d.mencoes || []).filter((m) => m.seq > antes && !lendo(m.conversa));
    const comMencao = new Set(mencoes.map((m) => m.conversa));
    const conversas = (d.conversas || []).filter((c) => !comMencao.has(c.id) && !lendo(c.id) && c.recebidas.some((s) => s > antes) && !c.ultima.minha);
    const avisos = mencoes.slice(0, 3).map((m) => ({ titulo: `${m.autor} mencionou você em ${m.grupo}`, corpo: resumoMsg(m), conversa: m.conversa, seq: m.seq, mencao: true }));
    if (conversas.length === 1) { const c = conversas[0]; avisos.push({ titulo: c.nome, corpo: `${c.ultima.autor}: ${resumoMsg(c.ultima)}`, conversa: c.id }); }
    else if (conversas.length > 1) {
      const n = conversas.reduce((t, c) => t + c.recebidas.filter((s) => s > antes).length, 0);
      avisos.push({ titulo: 'WhatsApp da Vybe', corpo: `${n} mensagens novas em ${conversas.length} conversas: ${conversas.slice(0, 3).map(nomeCurto).join(', ')}${conversas.length > 3 ? '…' : ''}` });
    }
    for (const a of avisos) {
      st.avisos.push(a); if (st.avisos.length > 20) st.avisos.shift();
      notificar(a);
      if (!st.aberto && !document.hidden) avisoNaTela(a);
    }
  }
  function notificar(a) {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      // Com a aba à vista, o aviso é o da tela; o do sistema é para quando o Vybe OS está escondido ou sem foco.
      if (!(document.hidden || document.hasFocus?.() === false)) return;
      const n = new Notification(a.titulo, { body: a.corpo.slice(0, 180), tag: 'vybe-wa-' + (a.conversa || 'varias'), renotify: Boolean(a.mencao), icon: '/assets/app/cor/os-192.png' });
      n.onclick = () => { try { window.focus(); } catch {} abrir(a.conversa, a.seq); n.close?.(); };
    } catch { /* navegador sem notificação fora de service worker (Android): fica o aviso na tela */ }
  }
  function avisoNaTela(a) {
    try {
      let caixa = document.getElementById('vv-wa-avisos');
      if (!caixa) { caixa = document.createElement('div'); caixa.id = 'vv-wa-avisos'; caixa.setAttribute('aria-live', 'polite'); document.body.append(caixa); }
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'vv-wa-toast' + (a.mencao ? ' mencao' : '');
      el.innerHTML = `<span class="vv-wa-toast-ic">${a.mencao ? '@' : IC.balao}</span><span><b>${esc(a.titulo)}</b><small>${esc(a.corpo)}</small></span>`;
      el.addEventListener('click', () => { el.remove(); abrir(a.conversa, a.seq); });
      caixa.append(el);
      while (caixa.children.length > 3) caixa.firstElementChild.remove();
      setTimeout(() => el.remove(), a.mencao ? 12000 : 7000);
    } catch { /* sem DOM */ }
  }

  // ---------- Botão da barra do topo ----------
  function pintarBadge() {
    const b = document.querySelector?.('[data-ferr="whatsapp"]'); if (!b) return;
    const el = b.querySelector('#vv-badge-whatsapp'), { naoLidas, mencoesNaoLidas } = contagem();
    b.setAttribute('aria-pressed', String(st.aberto));
    b.title = st.erro ? `WhatsApp da Vybe — ${st.erro}` : naoLidas ? `WhatsApp da Vybe — ${naoLidas} não lida${naoLidas > 1 ? 's' : ''}${mencoesNaoLidas ? `, ${mencoesNaoLidas} menção a você` : ''}` : 'WhatsApp da Vybe: grupos internos, clientes e menções a você (só leitura)';
    if (!el) return;
    el.hidden = !naoLidas && !mencoesNaoLidas;
    el.textContent = mencoesNaoLidas ? '@' + (naoLidas > 99 ? '99+' : naoLidas || '') : naoLidas > 99 ? '99+' : String(naoLidas);
    el.classList.toggle('com-mencao', Boolean(mencoesNaoLidas));
  }

  // ---------- Painel ----------
  function raiz() {
    let el = document.getElementById('vv-whatsapp');
    if (el || !st.aberto) return el;
    el = document.createElement('section');
    el.id = 'vv-whatsapp'; el.className = 'vv-wa'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'WhatsApp da Vybe');
    el.addEventListener('click', aoClicar); el.addEventListener('input', aoDigitar);
    document.body.append(el);
    return el;
  }
  function pintar({ rolar = false } = {}) {
    const el = raiz(); if (!el) return;
    el.hidden = !st.aberto; if (!st.aberto) return;
    const lista = el.querySelector('#vv-wa-itens'), scrollLista = lista ? lista.scrollTop : 0, busca = el.querySelector('[data-wa-busca]'), focado = document.activeElement === busca;
    const antigas = el.querySelector('#vv-wa-mensagens'), scrollMsgs = antigas ? antigas.scrollTop : 0;
    const { porConversa, naoLidas, mencoesNaoLidas } = contagem();
    const d = st.dados;
    el.classList.toggle('com-conversa', Boolean(st.conversa));
    const html = `
      <div class="vv-wa-topo">
        <span class="vv-wa-marca">${IC.balao}</span>
        <span class="vv-wa-titulo"><b>WhatsApp da Vybe</b><small>${esc(d?.eu?.socio ? 'Todos os grupos internos e de clientes' : 'Os grupos de que você participa')} · espelho do VYBES</small></span>
        <button type="button" class="vv-wa-fechar" data-wa-fechar aria-label="Fechar" title="Fechar (Esc)">${IC.fechar}</button>
      </div>
      ${typeof Notification !== 'undefined' && Notification.permission === 'default' ? `<div class="vv-wa-permissao">${IC.sino}<span>Quer aviso quando chegar mensagem ou alguém marcar você?</span><button type="button" class="vv-wa-acao" data-wa-notificar>Ativar avisos</button></div>` : ''}
      <div class="vv-wa-corpo">
        <div class="vv-wa-lista" role="region" aria-label="Conversas">
          <div class="vv-wa-abas" role="tablist">
            <button type="button" role="tab" data-wa-aba="conversas" aria-selected="${st.aba === 'conversas'}">Conversas${naoLidas ? `<span class="vv-wa-n">${naoLidas > 99 ? '99+' : naoLidas}</span>` : ''}</button>
            <button type="button" role="tab" data-wa-aba="mencoes" aria-selected="${st.aba === 'mencoes'}">Menções a você${mencoesNaoLidas ? `<span class="vv-wa-n">${mencoesNaoLidas}</span>` : ''}</button>
          </div>
          ${st.aba === 'conversas' ? `<div class="vv-wa-filtros" role="group" aria-label="Filtrar">${[['todos', 'Todos'], ['interno', 'Internos'], ['cliente', 'Clientes'], ['naolidas', 'Não lidas']].map(([k, n]) => `<button type="button" data-wa-filtro="${k}" aria-pressed="${st.filtro === k}">${n}</button>`).join('')}</div>
          <input type="search" class="vv-wa-busca" data-wa-busca placeholder="Buscar grupo ou cliente" value="${esc(st.busca)}" aria-label="Buscar grupo ou cliente">` : ''}
          <div class="vv-wa-itens" id="vv-wa-itens" role="list">${st.aba === 'conversas' ? itensConversas(porConversa) : itensMencoes()}</div>
          <p class="vv-wa-rodape">${st.erro && d ? `⚠️ ${esc(st.erro)} · mostrando a última leitura` : d ? `Atualizado às ${hora(Date.parse(d.geradoEm) || Date.now())}` : ''}</p>
        </div>
        <div class="vv-wa-conversa" role="region" aria-label="Mensagens">${painelConversa()}</div>
      </div>`;
    // Nada mudou (a leitura de 12 em 12 s quase sempre volta igual): não mexe na tela, nem na rolagem, nem na seleção.
    if (html === st.ultimoHtml && !rolar && !st.foco) return;
    st.ultimoHtml = html; el.innerHTML = html;
    const novaLista = el.querySelector('#vv-wa-itens'); if (novaLista) novaLista.scrollTop = scrollLista;
    if (focado) { const b = el.querySelector('[data-wa-busca]'); b?.focus(); b?.setSelectionRange?.(b.value.length, b.value.length); }
    const msgs = el.querySelector('#vv-wa-mensagens');
    if (msgs && st.foco) { const alvo = msgs.querySelector(`[data-seq="${Number(st.foco)}"]`); if (alvo) { alvo.scrollIntoView({ block: 'center' }); alvo.classList.add('piscar'); st.foco = null; } }
    else if (msgs && rolar) msgs.scrollTop = msgs.scrollHeight;
    else if (msgs && antigas) msgs.scrollTop = scrollMsgs;
  }
  function vazio(texto, detalhe = '') { return `<div class="vv-wa-vazio"><b>${esc(texto)}</b>${detalhe ? `<span>${esc(detalhe)}</span>` : ''}</div>`; }
  function itensConversas(porConversa) {
    const d = st.dados;
    if (!d) return st.erro ? vazio(st.erro, 'Tento de novo sozinho em instantes.') : vazio('Carregando as conversas…');
    if (!d.eu.vinculado) return vazio('Seu WhatsApp ainda não está vinculado ao Vybe OS.', 'Quando o seu número estiver vinculado, aparecem aqui os grupos de que você participa.');
    const busca = st.busca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const lista = d.conversas.filter((c) => (st.filtro === 'todos' || (st.filtro === 'naolidas' ? porConversa[c.id] : c.tipo === st.filtro))
      && (!busca || `${c.nome} ${c.cliente || ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(busca)));
    if (!d.conversas.length) return vazio('Nenhuma mensagem ainda.', 'As conversas aparecem aqui conforme chegam ao WhatsApp do VYBES.');
    if (!lista.length) return vazio('Nada com esse filtro.');
    return lista.map((c) => {
      const n = porConversa[c.id] || 0, u = c.ultima, mencao = (d.mencoes || []).some((m) => m.conversa === c.id && mencaoNaoLida(m));
      return `<button type="button" role="listitem" class="vv-wa-item${st.conversa === c.id ? ' ativo' : ''}${n ? ' nao-lida' : ''}" data-wa-conversa="${c.id}" aria-current="${st.conversa === c.id}">
        <span class="vv-wa-avatar ${c.tipo}" aria-hidden="true">${esc(iniciais(nomeCurto(c)))}</span>
        <span class="vv-wa-meio"><span class="vv-wa-linha"><b>${esc(c.nome)}</b><time>${esc(quando(u.em))}</time></span>
          <span class="vv-wa-linha"><small>${u.minha ? 'Você: ' : u.autor ? esc(u.autor.split(' ')[0]) + ': ' : ''}${esc(resumoMsg(u))}</small>${mencao ? '<i class="vv-wa-arroba" title="Menção a você">@</i>' : ''}${n ? `<span class="vv-wa-n">${n > 99 ? '99+' : n}</span>` : ''}</span></span>
      </button>`;
    }).join('');
  }
  function itensMencoes() {
    const d = st.dados;
    if (!d) return st.erro ? vazio(st.erro) : vazio('Carregando…');
    if (!d.mencoes?.length) return vazio('Ninguém marcou você por enquanto.', 'Quando alguém marcar você com @ num grupo, aparece aqui.');
    return d.mencoes.map((m) => `<button type="button" role="listitem" class="vv-wa-item vv-wa-mencao${mencaoNaoLida(m) ? ' nao-lida' : ''}" data-wa-conversa="${m.conversa}" data-wa-seq="${m.seq}">
      <span class="vv-wa-avatar mencao" aria-hidden="true">@</span>
      <span class="vv-wa-meio"><span class="vv-wa-linha"><b>${esc(m.grupo)}</b><time>${esc(quando(m.em))}</time></span>
        <span class="vv-wa-linha"><small>${esc(m.autor.split(' ')[0])}: ${esc(resumoMsg(m))}</small></span></span>
    </button>`).join('');
  }
  function painelConversa() {
    if (!st.conversa) return `<div class="vv-wa-vazio grande">${IC.balao}<b>Escolha uma conversa</b><span>Só leitura nesta etapa: para responder, use o seu WhatsApp.</span></div>`;
    const c = st.dados?.conversas?.find((x) => x.id === st.conversa) || st.msgs;
    const cab = `<div class="vv-wa-cab"><button type="button" class="vv-wa-voltar" data-wa-voltar aria-label="Voltar para a lista">${IC.voltar}</button>
      <span class="vv-wa-avatar ${c?.tipo || ''}" aria-hidden="true">${esc(iniciais(c ? nomeCurto(c) : ''))}</span>
      <span class="vv-wa-titulo"><b>${esc(c?.nome || 'Conversa')}</b><small>${c?.tipo === 'interno' ? 'Grupo interno da Vybe' : c?.cliente ? 'Grupo do cliente ' + esc(c.cliente) : 'Grupo de cliente'}</small></span></div>`;
    if (st.erroConversa) return cab + vazio(st.erroConversa);
    if (!st.msgs || st.msgs.id !== st.conversa) return cab + vazio('Carregando as mensagens…');
    let dia = '', html = '';
    for (const m of st.msgs.mensagens) {
      const r = relativo(m.em);
      if (r !== dia) { dia = r; html += `<p class="vv-wa-dia"><span>${esc(r)}</span></p>`; }
      html += `<div class="vv-wa-msg${m.minha ? ' minha' : ''}${m.vybes ? ' vybes' : ''}${m.paraVoce ? ' para-voce' : ''}" data-seq="${m.seq}">
        ${m.minha ? '' : `<span class="vv-wa-autor"><i style="--c:${m.vybes ? '#8B7DFF' : corDe(m.autor)}"></i>${esc(m.autor)}${m.paraVoce ? '<em>marcou você</em>' : ''}</span>`}
        ${m.citada ? `<span class="vv-wa-citada">${esc(m.citada)}</span>` : ''}
        ${m.apagada ? '<span class="vv-wa-apagada">🚫 Mensagem apagada</span>' : `${m.midia ? `<span class="vv-wa-midia">${esc(m.midia)}</span>` : ''}${m.texto ? `<span class="vv-wa-texto">${esc(m.texto)}</span>` : ''}`}
        <time>${m.editada ? 'editada · ' : ''}${esc(hora(m.em))}</time></div>`;
    }
    return cab + `<div class="vv-wa-mensagens" id="vv-wa-mensagens">${html || vazio('Sem mensagens guardadas nesta conversa.')}</div>
      <div class="vv-wa-so-leitura">${IC.cadeado}<span>Só leitura nesta etapa. Para responder, use o seu WhatsApp.</span></div>`;
  }

  // ---------- Interação ----------
  function aoClicar(e) {
    const t = e.target.closest?.('button'); if (!t) return;
    if (t.matches('[data-wa-fechar]')) return fechar();
    if (t.matches('[data-wa-voltar]')) { st.conversa = null; st.msgs = null; return pintar(); }
    if (t.matches('[data-wa-notificar]')) { Notification.requestPermission?.().then(() => pintar(), () => pintar()); return; }
    if (t.dataset.waAba) { st.aba = t.dataset.waAba; if (st.aba === 'mencoes') marcarMencoesLidas(); return pintar(); }
    if (t.dataset.waFiltro) { st.filtro = t.dataset.waFiltro; return pintar(); }
    if (t.dataset.waConversa) { abrirConversa(t.dataset.waConversa, { focar: t.dataset.waSeq ? Number(t.dataset.waSeq) : null }); }
  }
  function aoDigitar(e) { if (e.target.matches?.('[data-wa-busca]')) { st.busca = e.target.value.slice(0, 60); pintar(); } }
  function abrir(conversa = null, seq = null) {
    st.aberto = true;
    if (conversa) { st.aba = 'conversas'; abrirConversa(conversa, { focar: seq }); } else pintar();
    pintarBadge(); agendar(0);
  }
  function fechar() { st.aberto = false; st.ultimoHtml = ''; const el = document.getElementById('vv-whatsapp'); if (el) el.hidden = true; pintarBadge(); agendar(); }
  function alternar() { if (st.aberto) fechar(); else abrir(); }

  // ---------- Ciclo de leitura ----------
  function agendar(ms) {
    clearTimeout(st.timer);
    const temBotao = Boolean(document.querySelector?.('[data-ferr="whatsapp"]'));
    const espera = ms ?? (!temBotao ? SEM_HUD_MS : st.erro ? ERRO_MS : document.hidden ? ESCONDIDO_MS : st.aberto ? ABERTO_MS : FECHADO_MS);
    st.timer = setTimeout(async () => {
      if (document.querySelector?.('[data-ferr="whatsapp"]')) await atualizar();
      agendar();
    }, espera);
  }
  document.addEventListener?.('click', (e) => { if (e.target.closest?.('[data-ferr="whatsapp"]')) alternar(); });
  window.addEventListener?.('keydown', (e) => {
    if (e.key !== 'Escape' || !st.aberto) return;
    e.preventDefault(); e.stopPropagation();
    const estreito = (document.getElementById('vv-whatsapp')?.getBoundingClientRect?.().width || 0) < 620; // uma coluna: Esc volta para a lista
    if (st.conversa && estreito) { st.conversa = null; st.msgs = null; pintar(); } else fechar();
  }, true);
  document.addEventListener?.('visibilitychange', () => {
    if (!document.hidden && st.aberto && st.conversa) marcarLida(st.conversa);
    agendar(document.hidden ? undefined : 500);
  });
  agendar(4000);

  window.vybeWhatsapp = { atualizar, abrir, fechar, alternar, marcarLida, estado: () => ({ ...contagem(), erro: st.erro, aberto: st.aberto, avisos: [...st.avisos] }) };
})();
