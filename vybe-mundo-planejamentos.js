// Planejamentos no Irecity: o Centro de Operação sem a sala do Habbo (Paulo, 07/11/2026: "o planejamento que eu
// tinha feito na sala de operação quando abria cada cliente… abria pra aprovar de vários modos, editar, corrigir,
// mandava direto pro zap com o aviso pro hub pro cliente aprovar… preciso disso nesse novo também").
// A porta de entrada era o agente de cada cliente na sala Operação. Aqui vira um módulo: um cartão por cliente
// (mesma rota area=planejamentos&acao=operacao), com o estado do planejamento do mês, o placar da revisão e os
// avisos das peças. Abrir usa a MESMA janela de sempre (vybe-planejamentos.js: abrirPlanejamento): documento em
// tela cheia, editar, revisar peça a peça, histórico, marca do cliente, aprovar e enviar ao cliente pelo WhatsApp
// com o aviso do Hub. Nada de lógica nova de planejamento aqui: só a entrada e a visão da carteira.
(function () {
  // Cliente com a cor da carteira (cliCor de vybe-core.js); fora do painel (testes), o nome escapado.
  function cliCor(n) { const g = globalThis.cliCor; return typeof g === 'function' && g !== cliCor ? g(n) : String(n ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ESTADOS = {
    revisar: ['Para revisar', 'u2'], ajustes: ['Ajustes pedidos', 'u3'], aprovado: ['Aprovado', 'u6'],
    enviado: ['Com o cliente', 'u4'], cadastrado: ['Peças cadastradas', 'u6'], rascunho: ['Rascunho', 'u5'],
  };
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesTxt = (m) => { const x = String(m || '').slice(0, 7).split('-'); return x.length === 2 ? `${MES[Number(x[1]) - 1] || ''}/${x[0].slice(2)}` : ''; };
  let estado = { postos: [], filtro: 'meus', carregando: false, erro: '' };
  let janela = null;

  function criarJanela() {
    janela = document.createElement('section');
    janela.className = 'vv-plj';
    janela.setAttribute('role', 'dialog');
    janela.setAttribute('aria-label', 'Planejamentos');
    janela.hidden = true;
    document.body.append(janela);
    janela.addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.pljFechar !== undefined) return fechar();
      if (b.dataset.pljFiltro) { estado.filtro = b.dataset.pljFiltro; return pintar(); }
      if (b.dataset.pljAbrir) { if (typeof window.abrirPlanejamento === 'function') window.abrirPlanejamento(b.dataset.pljAbrir, b.dataset.pljAba || 'documento'); return; }
      if (b.dataset.pljNovo) { if (typeof window.novoPlanejamento === 'function') window.novoPlanejamento(b.dataset.pljNovo, b.dataset.pljNome || ''); return; }
      if (b.dataset.pljRecarregar !== undefined) carregar();
    });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && janela && !janela.hidden && !document.getElementById('workflow-modal')?.classList.contains('open')) fechar(); });
  }

  // Ordem: o que pede ação primeiro (ajustes do cliente, depois para revisar), com planejamento antes de sem.
  const PESO = { ajustes: 0, revisar: 1, rascunho: 2, aprovado: 3, enviado: 4, cadastrado: 5 };
  function ordenar(lista) {
    return [...lista].sort((a, b) => (PESO[a.planejamento?.estado] ?? 9) - (PESO[b.planejamento?.estado] ?? 9) || String(a.cliente).localeCompare(String(b.cliente), 'pt-BR'));
  }
  function filtrar(lista) {
    const f = estado.filtro;
    if (f === 'meus') return lista.filter((p) => p.meu);
    if (f === 'acao') return lista.filter((p) => ['revisar', 'ajustes'].includes(p.planejamento?.estado));
    if (f === 'sem') return lista.filter((p) => !p.planejamento);
    return lista;
  }

  function cartao(p) {
    const pl = p.planejamento, [rot, cor] = pl ? (ESTADOS[pl.estado] || [pl.estado, 'u5']) : ['Sem planejamento', 'u5'];
    const r = pl?.revisao || {}, a = p.alertas || {};
    const placar = r.total ? `${r.head_ok || 0} de ${r.total} peças OK${r.cliente_ajustes ? ` · ${r.cliente_ajustes} com ajuste do cliente` : ''}` : '';
    const avisos = [['atrasadas', 'atrasadas', 'u1'], ['aprovar', 'para aprovar', 'u2'], ['sem_info', 'sem informação', 'u5']]
      .map(([k, t, c]) => { const n = (a[k] || []).length; return n ? `<span class="vv-plj-aviso ${c}">${n} ${t}</span>` : ''; }).join('');
    const edita = pl && !['aprovado', 'cadastrado'].includes(pl.estado);
    return `<article class="vv-plj-cartao${p.meu ? ' meu' : ''}">
      <div class="vv-plj-topo"><b>${cliCor(p.cliente)}</b><span class="pill ${cor}">${esc(rot)}</span></div>
      <small class="vv-plj-sub">${esc(p.segmento || '')}${pl ? `${p.segmento ? ' · ' : ''}${esc(mesTxt(pl.mes))} · versão ${esc(pl.versao || 1)}` : ''}</small>
      ${placar ? `<p class="vv-plj-placar">${esc(placar)}</p>` : ''}
      ${avisos ? `<div class="vv-plj-avisos">${avisos}</div>` : ''}
      <div class="vv-plj-acoes">${pl
        ? `<button type="button" class="vv-botao acao" data-plj-abrir="${esc(pl.id)}">Abrir</button>${edita ? `<button type="button" class="vv-botao" data-plj-abrir="${esc(pl.id)}" data-plj-aba="editar">Editar e revisar</button>` : ''}<button type="button" class="vv-botao" data-plj-abrir="${esc(pl.id)}" data-plj-aba="historico">Histórico</button>`
        : `<button type="button" class="vv-botao" data-plj-novo="${esc(p.cliente_id)}" data-plj-nome="${esc(p.cliente)}">Começar planejamento</button>`}</div>
    </article>`;
  }

  function pintar() {
    if (!janela) return;
    const todos = ordenar(estado.postos), lista = filtrar(todos);
    const contar = { acao: todos.filter((p) => ['revisar', 'ajustes'].includes(p.planejamento?.estado)).length, sem: todos.filter((p) => !p.planejamento).length, meus: todos.filter((p) => p.meu).length, todos: todos.length };
    // Quem não é head de nenhum cliente começa no que pede ação ("Meus clientes 0" mostrando todos confundia).
    if (estado.filtro === 'meus' && !contar.meus && !estado.carregando) { estado.filtro = 'acao'; return pintar(); }
    const aba = (id, t) => `<button type="button" role="tab" data-plj-filtro="${id}" aria-selected="${estado.filtro === id}">${t} <span>${contar[id]}</span></button>`;
    janela.innerHTML = `<div class="vv-plj-cabeca">
        <div><span class="vv-plj-kicker">Produção · Centro de Operação</span><h2>Planejamentos</h2>
        <p>Cada cliente com o planejamento do mês. Abra para ler como documento, editar, revisar peça a peça, aprovar e mandar para o cliente pelo WhatsApp com o aviso do Hub.</p></div>
        <button type="button" class="vv-botao ic" data-plj-fechar aria-label="Fechar">✕</button></div>
      <div class="vv-plj-abas" role="tablist">${aba('meus', 'Meus clientes')}${aba('acao', 'Pedem ação')}${aba('sem', 'Sem planejamento')}${aba('todos', 'Todos')}</div>
      <div class="vv-plj-grade">${estado.carregando ? '<p class="vv-plj-vazio">Buscando os planejamentos…</p>'
        : estado.erro ? `<p class="vv-plj-vazio">Não foi possível buscar: ${esc(estado.erro)} <button type="button" class="vv-botao" data-plj-recarregar>Tentar de novo</button></p>`
        : lista.length ? lista.map(cartao).join('') : '<p class="vv-plj-vazio">Nada aqui agora.</p>'}</div>`;
  }

  async function carregar() {
    estado.carregando = true; estado.erro = ''; pintar();
    try {
      const r = await fetch('/api/painel?area=planejamentos&acao=operacao', { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'o painel não respondeu');
      estado.postos = Array.isArray(d.postos) ? d.postos : [];
    } catch (e) { estado.erro = e.message; }
    estado.carregando = false; pintar();
  }

  function abrir(filtro) {
    if (!janela) criarJanela();
    if (filtro) estado.filtro = filtro;
    janela.hidden = false;
    document.body.classList.add('mundo-plj');
    carregar();
  }
  function fechar() { if (janela) janela.hidden = true; document.body.classList.remove('mundo-plj'); }
  // Fechar a janela do planejamento devolve a lista atualizada (estado e placar mudam ao aprovar/enviar).
  const fecharModal = window.pljFecharModal;
  if (typeof fecharModal === 'function') window.pljFecharModal = async function (...a) { const r = await fecharModal.apply(this, a); if (janela && !janela.hidden) carregar(); return r; };

  // "Ir ao Centro de Operação" (aviso de planejamentos) levava à sala do Habbo: no Irecity abre este módulo.
  const irSala = window.irParaSalaEscritorio;
  if (typeof irSala === 'function') window.irParaSalaEscritorio = function (zona, ...r) {
    if (zona === 'operacao' && window.mundoVoxel?.ligado?.()) { abrir('acao'); return; }
    return irSala.call(this, zona, ...r);
  };
  // aberto: o dock (remarcarAoFechar em vybe-mundo.js) pergunta antes de acender o Hoje no lugar de Planejamentos.
  window.VybePlanejamentos = { abrir, fechar, aberto: () => Boolean(janela && !janela.hidden), _ordenar: ordenar, _filtrar: (lista, f) => { const antes = estado.filtro; estado.filtro = f; const r = filtrar(lista); estado.filtro = antes; return r; } };
})();
