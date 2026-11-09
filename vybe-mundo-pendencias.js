// vybe-mundo-pendencias.js — Pendências do WhatsApp na Gestão e no Minhas tarefas (Paulo, 08/11/2026: "na aba da
// Gestão, logo de cara, o agente responsável pelo atendimento já mostra as mensagens dos clientes sem responder, as
// mensagens do time sem resolver, e pra quem executa aparece o que tiver no WhatsApp pendente pra eles").
//
// Uma fonte só: a central do VYBES (GET /api/painel?area=vybes&etapa=pendencias → /api/cosmos/whatsapp/pendencias).
// - Clientes esperando resposta = a mesma leitura do bot que avisa os heads (painelClientes), sem efeito colateral.
// - Time sem resolver e "para você" = a mesma regra dos achados do agente (menção ou pedido sem resposta).
// Cada pessoa só recebe os grupos de que participa (a central filtra pelo crachá). Clicar abre a conversa no WhatsApp da
// Vybe (vybe-mundo-whatsapp.js). Nada é enviado daqui.
(() => {
  // Cliente com a cor da carteira (cliCor de vybe-core.js); fora do painel (testes), o nome escapado.
  function cliCor(n) { const g = globalThis.cliCor; return typeof g === 'function' && g !== cliCor ? g(n) : String(n ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  const G = window;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const st = { dados: null, erro: '', lidoEm: 0, lendo: null };
  const VALE_MS = 60e3;

  function atualizar(forcar = false) {
    if (st.lendo) return st.lendo;
    if (!forcar && Date.now() - st.lidoEm < VALE_MS) return Promise.resolve(st);
    st.lidoEm = Date.now();
    st.lendo = fetch('/api/painel?area=vybes&etapa=pendencias', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || d.ok !== true || !d.atendimento) throw new Error(d.error || 'Sem leitura da central do VYBES agora.'); st.dados = d; st.erro = ''; })
      .catch((e) => { st.erro = e.message || 'Sem leitura da central do VYBES agora.'; })
      .finally(() => { st.lendo = null; try { document.dispatchEvent(new CustomEvent('vybe:pendencias')); } catch {} });
    return st.lendo;
  }
  const tempo = (min) => min == null ? '' : min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`;
  const desde = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? tempo(Math.round((Date.now() - t) / 60e3)) : ''; };
  const linhaCliente = (x) => `<button type="button" class="vv-dono-linha" data-pend-cliente="${esc(x.cliente)}" title="${esc(x.autor)}: ${esc(x.texto)}">
      <span class="saude ${x.minutos >= 60 ? 'u1' : 'u2'}"></span><span class="meio"><b>${cliCor(x.cliente)} <i class="vv-pend-tempo">${esc(tempo(x.minutos))}</i></b><small>${esc(x.autor)}: “${esc(x.texto)}”${x.para ? ` · para ${esc(x.para)}` : ''}</small></span></button>`;
  const linhaTime = (x) => `<button type="button" class="vv-dono-linha" ${x.conversa ? `data-pend-conversa="${esc(x.conversa)}"` : ''} title="${esc(x.prova)}">
      <span class="saude ${x.gravidade === 'alta' ? 'u1' : 'u2'}"></span><span class="meio"><b>${esc(x.fato)}</b><small>${esc(x.prova)}${x.sugestao ? ' · ' + esc(x.sugestao) : ''}</small></span></button>`;
  const sinal = () => !st.dados ? `<p class="vv-dica">${esc(st.erro || 'Consultando o WhatsApp pela central do VYBES…')}</p>` : '';

  // Gestão (aba Agência): o atendimento do Mateus, logo abaixo dos números do dia.
  function atendimentoHtml() {
    void atualizar();
    const a = st.dados?.atendimento || {}, cli = a.clientesEsperando || [], time = a.timeSemResolver || [], agente = a.agente || 'Mateus';
    return `<section class="vv-bloco vv-pend" aria-label="Atendimento: WhatsApp pendente">
      <div class="vv-rotulo-secao" style="--c:var(--vv-lilas)"><i></i>${esc(agente)} · Atendimento<span class="vv-pilula">${cli.length + time.length}</span><button type="button" class="vv-pend-agente" data-pend-agente="concierge">ver o agente</button></div>
      ${sinal()}
      <div class="vv-pend-colunas">
        <div><small class="vv-pend-sub">Clientes esperando resposta</small>${cli.length ? cli.slice(0, 4).map(linhaCliente).join('') : st.dados ? '<p class="vv-vazio">Nenhum cliente esperando resposta.</p>' : ''}${cli.length > 4 ? `<button type="button" class="vv-mais" data-pend-whatsapp>+ ${cli.length - 4} clientes</button>` : ''}</div>
        <div><small class="vv-pend-sub">Time sem resolver</small>${time.length ? time.slice(0, 4).map(linhaTime).join('') : st.dados ? '<p class="vv-vazio">Nada parado nos grupos internos.</p>' : ''}${time.length > 4 ? `<button type="button" class="vv-mais" data-pend-whatsapp>+ ${time.length - 4} pendências</button>` : ''}</div>
      </div></section>`;
  }
  // Minhas tarefas: o que está parado no WhatsApp esperando esta pessoa.
  function paraVoceHtml() {
    void atualizar();
    const lista = st.dados?.paraVoce || [];
    if (st.dados && !lista.length) return '';
    return `<section class="vv-bloco vv-pend" aria-label="WhatsApp esperando você">
      <div class="vv-rotulo-secao" style="--c:#25A55F"><i></i>No WhatsApp, esperando você<span class="vv-pilula">${lista.length}</span></div>
      ${sinal()}${lista.slice(0, 4).map(linhaTime).join('')}${lista.length > 4 ? `<button type="button" class="vv-mais" data-pend-whatsapp>+ ${lista.length - 4} no WhatsApp</button>` : ''}</section>`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-pend-conversa],[data-pend-whatsapp],[data-pend-cliente],[data-pend-agente]'); if (!b) return;
    if (b.dataset.pendAgente) { G.VybeAgentes?.abrir?.(b.dataset.pendAgente); return; }
    G.vybeWhatsapp?.abrir?.(b.dataset.pendConversa || null);
  });
  G.VybePendencias = { atualizar, atendimentoHtml, paraVoceHtml, estado: () => ({ ...st }) };
})();
