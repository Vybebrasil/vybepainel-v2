// vybe-mundo-aprovacoes.js — Aprovações no Seu dia (Paulo, 09/11/2026: "não pode virar um gargalo").
//
// Logo de cara, para quem tem que agir: o que depende da aprovação interna (head do cliente; a arte, o Deivid), o que
// está com o cliente e o que o cliente aprovou e falta cadastrar. O Vinícius e o Ewerton veem primeiro os clientes deles,
// com "Ver todos"; os sócios veem a agência inteira, com o head de cada item; o Deivid vê toda peça "Para aprovação"
// (card, foto, vídeo) para aprovar a arte. Uma fonte só: GET /api/painel?area=aprovacoes (server/aprovacoes.js).
// Clicar abre o mesmo planejamento/peça de sempre. Nada é aprovado nem enviado daqui.
(() => {
  function cliCor(n) { const g = globalThis.cliCor; return typeof g === 'function' && g !== cliCor ? g(n) : esc(n); }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LIMITE = { interna: 24, cliente: 48, cadastrar: 24 };
  const st = { dados: null, erro: '', lidoEm: 0, lendo: null, todos: null };
  const VALE_MS = 60e3;

  function atualizar(forcar = false) {
    if (st.lendo) return st.lendo;
    if (!forcar && Date.now() - st.lidoEm < VALE_MS) return Promise.resolve(st);
    st.lidoEm = Date.now();
    st.lendo = fetch('/api/painel?area=aprovacoes', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || d.ok !== true) throw new Error(d.error || 'Não consegui ler as aprovações.'); st.dados = d; st.erro = ''; })
      .catch((e) => { st.erro = e.message || 'Não consegui ler as aprovações.'; })
      .finally(() => { st.lendo = null; try { document.dispatchEvent(new CustomEvent('vybe:aprovacoes')); } catch {} });
    return st.lendo;
  }

  const parado = (h) => (h == null ? '' : h < 1 ? 'agora' : h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} d`);
  const atrasado = (i) => i.horas != null && i.horas >= (LIMITE[i.etapa] ?? 24);
  const ICONE = {
    planejamento: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M9 3v4M15 3v4"/>',
    video: '<rect x="3.5" y="6" width="12" height="12" rx="2"/><path d="M15.5 10.5l5-3v9l-5-3z"/>',
    foto: '<rect x="3.5" y="6" width="17" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.2"/><path d="M8.5 6l1.5-2h4l1.5 2"/>',
    card: '<rect x="4.5" y="4.5" width="15" height="15" rx="2"/><path d="M4.5 15l4-4 4 4 3-3 3.5 3.5"/>',
  };
  const tipoDe = (i) => {
    if (i.tipo === 'planejamento') return 'planejamento';
    const f = String(i.formato || i.titulo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return /reels|video|motion/.test(f) ? 'video' : /foto/.test(f) ? 'foto' : 'card';
  };
  const icone = (i) => `<svg class="vap-ico" viewBox="0 0 24 24" aria-hidden="true">${ICONE[tipoDe(i)]}</svg>`;

  function linha(i, { comHead }) {
    const nome = i.tipo === 'planejamento' ? `Planejamento ${esc(i.mes ? i.mes.split('-').reverse().join('/') : '')}${i.pecas ? ` · ${i.pecas} peças` : ''}` : esc(i.titulo);
    const head = comHead && i.heads?.length ? `<span class="vap-head">${esc(i.heads.map((h) => h.nome).join(', '))}</span>` : '';
    const abrir = i.tipo === 'planejamento' ? `data-aprov-plano="${esc(i.id)}"` : `data-aprov-peca="${esc(i.ref)}" data-aprov-quadro="${esc(i.quadro)}"`;
    return `<button type="button" class="vap-item${atrasado(i) ? ' atrasado' : ''}" ${abrir}>${icone(i)}
      <span class="vap-meio"><b>${nome}</b><small>${cliCor(i.cliente || '')}${i.tipo === 'peca' && i.status ? ` · ${esc(i.status)}` : ''}</small></span>
      ${head}<span class="vap-tempo">${parado(i.horas)}</span></button>`;
  }

  // visao: 'tarefas' (Seu dia de cada pessoa), 'agencia' (sócios), 'criacao'.
  function blocoHtml(visao = 'tarefas') {
    const d = st.dados;
    if (!d) { atualizar(); return ''; }
    const eu = d.eu || {};
    const temCarteira = (eu.clientes || []).length > 0;
    const todos = st.todos ?? (!temCarteira || visao === 'agencia');
    const filtra = (lista) => lista.filter((i) => todos || i.meu || (eu.diretor_arte && i.tipo === 'peca' && i.etapa === 'interna'));
    const itens = [...filtra(d.planejamentos || []), ...filtra(d.pecas || [])].sort((a, b) => (b.horas ?? -1) - (a.horas ?? -1));
    const arteDeivid = eu.diretor_arte ? itens.filter((i) => i.tipo === 'peca' && i.etapa === 'interna') : [];
    const interna = itens.filter((i) => i.etapa === 'interna' && !arteDeivid.includes(i));
    const cliente = itens.filter((i) => i.etapa === 'cliente');
    const cadastrar = itens.filter((i) => i.etapa === 'cadastrar');
    if (!itens.length) return '';
    const comHead = todos || eu.dono;
    const secao = (titulo, sub, lista, cor) => (lista.length ? `<div class="vap-secao" style="--c:${cor}">
        <div class="vap-rotulo"><i></i><b>${titulo}</b><span class="vv-pilula">${lista.length}</span>${sub ? `<small>${sub}</small>` : ''}</div>
        ${lista.slice(0, 6).map((i) => linha(i, { comHead })).join('')}
        ${lista.length > 6 ? `<button type="button" class="vv-mais" data-aprov-mais>+ ${lista.length - 6}</button>` : ''}</div>` : '');
    const atrasados = itens.filter(atrasado).length;
    const alternar = temCarteira ? `<button type="button" class="vv-pilula vap-alternar" data-aprov-todos aria-pressed="${todos}">${todos ? 'Só meus clientes' : 'Ver todos'}</button>` : '';
    return `<section class="vs-bloco vap" aria-label="Aprovações">
      <div class="vap-cabeca"><span><b>Aprovações</b><small>${atrasados ? `${atrasados} parada${atrasados > 1 ? 's' : ''} além do prazo` : 'nada além do prazo'} · interna 24 h, cliente 48 h</small></span>${alternar}</div>
      ${secao('Arte para você aprovar', 'cards, fotos e vídeos em "Para aprovação"', arteDeivid, 'var(--sit-aprovar, #8E4EC6)')}
      ${secao(eu.dono && todos ? 'Esperando a aprovação interna' : 'Depende de você', 'planejamentos e peças antes de ir ao cliente', interna, 'var(--sit-hoje, #F76808)')}
      ${secao('Com o cliente', 'esperando a resposta dele', cliente, 'var(--sit-fazer, #0D74CE)')}
      ${secao('Aprovado, falta cadastrar', 'o cliente aprovou: cadastre as peças para a criação', cadastrar, 'var(--sit-aprovar, #8E4EC6)')}
    </section>`;
  }

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest?.('[data-aprov-plano],[data-aprov-peca],[data-aprov-todos],[data-aprov-mais]');
    if (!b) return;
    if (b.hasAttribute('data-aprov-todos')) { const eu = st.dados?.eu || {}; const atual = st.todos ?? !(eu.clientes || []).length; st.todos = !atual; document.dispatchEvent(new CustomEvent('vybe:aprovacoes')); return; }
    if (b.hasAttribute('data-aprov-mais')) { if (typeof window.mundoVoxel?.irPara === 'function') window.mundoVoxel.irPara('planejamentos'); return; }
    if (b.dataset.aprovPlano) { if (typeof window.abrirPlanejamento === 'function') window.abrirPlanejamento(b.dataset.aprovPlano, 'documento'); return; }
    const abrir = b.dataset.aprovQuadro === 'demandas' ? window.openDemandaWorkspace : window.openItemWorkspace;
    if (typeof abrir === 'function') abrir(b.dataset.aprovPeca);
  });
  // A lista muda quando alguém aprova ou envia: relê a cada minuto enquanto a tela está aberta.
  setInterval(() => { if (!document.hidden) atualizar(true); }, VALE_MS);
  window.VybeAprovacoes = { atualizar, blocoHtml, estado: () => st };
  atualizar();
})();
