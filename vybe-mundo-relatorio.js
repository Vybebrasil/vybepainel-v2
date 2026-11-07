// vybe-mundo-relatorio.js — o relatório mensal do cliente, para imprimir e salvar em PDF.
//
// Paulo, 07/11/2026: o head abre a ficha do cliente, toca em "Relatório do mês" e sai com o PDF no padrão
// da Vybe. A página junta, do mês escolhido:
//   · Entregas: quantas peças, quantas entregues, quantas no prazo e por formato (as contas são de
//     VybeRelatorioResumo.resumoDoMes, vybe-relatorio-resumo.js, testadas em tests/relatorio-resumo.test.mjs);
//   · Equilíbrio Atração/Educação/Conversão, quando as peças têm objetivo (VybeConteudo, se existir);
//   · Anúncios: o painel não lê o VybeHub/Meta no navegador (a ponte de server/assistente-hub.js é do bot),
//     então o head cola os números; em branco, o bloco não sai no PDF;
//   · Destaques e próximos passos: texto que o head escreve antes de imprimir.
// Os textos e números colados ficam só neste aparelho (localStorage, por cliente e mês), para não se
// perderem ao fechar. Nada é gravado no servidor nem enviado a ninguém: imprimir é do navegador.
//
//   window.VybeRelatorio.abrir(cliente, mes)   cliente = nome; mes = 'AAAA-MM' (sem mês: até o dia 10, o
//                                              mês passado; depois, o atual).
// Visual em vybe-mundo-relatorio.css (tela: janela clara; impressão: só a folha A4).
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
  const lista = (v) => (Array.isArray(v) ? v : []);
  const pad = (n) => String(n).padStart(2, '0');
  const hojeIso = () => { if (typeof hojeDeVerdade === 'function') { try { const h = hojeDeVerdade(); if (/^\d{4}-\d{2}-\d{2}$/.test(h)) return h; } catch { /* relógio local */ } } const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
  const normCliente = (n) => (typeof normalizarCliente === 'function' ? normalizarCliente(String(n || '')) : String(n || '').trim());

  // Campos de anúncios que o head pode colar (os mesmos nomes do resumo de tráfego do VybeHub).
  const ANUNCIOS = [
    ['investido', 'Investido'], ['alcance', 'Alcance'], ['impressoes', 'Impressões'], ['cliques', 'Cliques'],
    ['conversas', 'Conversas'], ['resultados', 'Resultados'], ['custo', 'Custo por resultado'], ['seguidores', 'Novos seguidores'],
  ];
  // Situação da peça para o cliente ler: sem os nomes internos das etapas.
  const ESPERA = ['falta info', 'ag info cliente', 'aguardo', 'ag aprovacao cliente'];
  const st = { raiz: null, antes: null, cliente: '', mes: '', resumo: null };

  function todasAsPecas() {
    if (typeof unifiedOperationalItems === 'function') { try { return lista(unifiedOperationalItems()); } catch { /* cai para DADOS_ALL */ } }
    return lista(typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : null);
  }
  const ehSolicitacao = (d) => (typeof isRequestItem === 'function' ? isRequestItem(d) : d?.origem === 'solicitacao');
  const R = () => G.VybeRelatorioResumo;
  function mesPadrao() { const h = hojeIso(); return Number(h.slice(8, 10)) <= 10 ? R().util.somarMeses(h.slice(0, 7), -1) : h.slice(0, 7); }
  function situacao(p) {
    if (p.entregue) return p.noPrazo === false ? 'Entregue após a data' : 'Entregue';
    const k = R().util.chaveStatus(p.status);
    if (ESPERA.includes(k)) return 'Aguardando o cliente';
    if (k === 'segurar post') return 'Pausada';
    return 'Em produção';
  }
  function logo() {
    const src = (typeof document !== 'undefined' && document.querySelector('.logo img')?.getAttribute('src')) || '/assets/vybe-branca.png';
    return /^\/[\w./-]+$/.test(src) ? src : '/assets/vybe-branca.png';
  }

  // ---------- Rascunho do head (por cliente e mês, neste aparelho) ----------
  const chaveRascunho = () => `vybe.relatorio.v1.${R().util.chaveTexto(st.cliente)}.${st.mes}`;
  function lerRascunho() { try { const v = JSON.parse(localStorage.getItem(chaveRascunho()) || 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
  function gravarRascunho() {
    if (!st.raiz) return;
    const dados = {};
    st.raiz.querySelectorAll('[data-rel-campo]').forEach((el) => { const v = String(el.value || '').slice(0, 4000); if (v.trim()) dados[el.dataset.relCampo] = v; });
    try { if (Object.keys(dados).length) localStorage.setItem(chaveRascunho(), JSON.stringify(dados)); else localStorage.removeItem(chaveRascunho()); } catch { /* sem armazenamento: segue sem rascunho */ }
  }

  // ---------- A folha ----------
  function folhaHtml(r, rascunho) {
    const pctPrazo = r.noPrazoPct == null ? '–' : `${r.noPrazoPct}%`;
    const kpis = [[r.total, 'peças no mês'], [r.entregues, 'entregues'], [pctPrazo, 'no prazo'], [r.abertas, 'em andamento']];
    const formatos = r.porFormato.length ? `<table class="vv-rel-tabela"><thead><tr><th>Formato</th><th>Peças</th><th>Entregues</th></tr></thead>
      <tbody>${r.porFormato.map((f) => `<tr><td>${esc(f.formato)}</td><td>${f.total}</td><td>${f.entregues}</td></tr>`).join('')}</tbody></table>` : '';
    const pecas = r.pecas.length ? `<table class="vv-rel-tabela vv-rel-pecas"><thead><tr><th>Data</th><th>Peça</th><th>Formato</th>${r.objetivos.disponivel ? '<th>Objetivo</th>' : ''}<th>Situação</th></tr></thead>
      <tbody>${r.pecas.map((p) => `<tr><td>${esc(dataBr(p.data))}</td><td>${esc(p.nome)}</td><td>${esc(p.formato)}</td>${r.objetivos.disponivel ? `<td>${esc(R().OBJETIVOS.find((o) => o.chave === p.objetivo)?.rotulo || '–')}</td>` : ''}<td>${esc(situacao(p))}</td></tr>`).join('')}</tbody></table>` : '<p class="vv-rel-vazio">Nenhum conteúdo com data neste mês.</p>';
    const prazoNota = r.entregues
      ? `No prazo = entregue até a data de veiculação. ${r.noPrazo} no prazo, ${r.foraDoPrazo} depois${r.semDiaDaEntrega ? `, ${r.semDiaDaEntrega} sem dia de entrega registrado` : ''}.`
      : '';
    const equilibrio = r.objetivos.disponivel ? `<section class="vv-rel-secao"><h3>Equilíbrio do conteúdo</h3>
      <div class="vv-rel-barra" role="img" aria-label="${esc(r.objetivos.itens.map((o) => `${o.rotulo} ${o.pct}%`).join(', '))}">${r.objetivos.itens.filter((o) => o.total).map((o) => `<i style="flex:${o.total};background:${o.cor}"></i>`).join('')}</div>
      <div class="vv-rel-legenda">${r.objetivos.itens.map((o) => `<div><i style="background:${o.cor}"></i><b>${o.pct}%</b><span>${esc(o.rotulo)} · ${o.total} ${o.total === 1 ? 'peça' : 'peças'}</span></div>`).join('')}</div>
      ${r.objetivos.semObjetivo ? `<p class="vv-rel-nota">${r.objetivos.semObjetivo} ${r.objetivos.semObjetivo === 1 ? 'peça sem objetivo marcado' : 'peças sem objetivo marcado'}.</p>` : ''}</section>` : '';
    const campoTexto = (id, titulo, dica) => `<section class="vv-rel-secao" data-rel-bloco="${id}"><h3>${titulo}</h3>
      <textarea class="vv-rel-so-tela" data-rel-campo="${id}" rows="4" placeholder="${esc(dica)}">${esc(rascunho[id] || '')}</textarea>
      <div class="vv-rel-so-papel vv-rel-texto" data-rel-espelho="${id}"></div></section>`;
    const anuncios = `<section class="vv-rel-secao" data-rel-bloco="anuncios"><h3>Anúncios</h3>
      <p class="vv-rel-nota vv-rel-so-tela">Opcional: cole os números do mês do VybeHub/Gerenciador de Anúncios. Em branco, este bloco não sai no PDF.</p>
      <div class="vv-rel-anuncios">${ANUNCIOS.map(([k, rot]) => `<label><span>${esc(rot)}</span><input class="vv-rel-so-tela" type="text" inputmode="decimal" maxlength="40" data-rel-campo="ads_${k}" value="${esc(rascunho['ads_' + k] || '')}"><b class="vv-rel-so-papel" data-rel-espelho="ads_${k}"></b></label>`).join('')}</div></section>`;
    return `<article class="vv-rel-folha" aria-label="Relatório de ${esc(r.cliente)}, ${esc(r.rotuloMes)}">
      <div class="vv-rel-topo"><img src="${esc(logo())}" alt="Vybe" width="74" height="44"><div><small>Relatório mensal</small><h2>${esc(r.cliente)}</h2><p>${esc(r.rotuloMes.charAt(0).toUpperCase() + r.rotuloMes.slice(1))}</p></div></div>
      <section class="vv-rel-secao"><h3>Entregas do mês</h3>
        <div class="vv-rel-kpis">${kpis.map(([n, t]) => `<div><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join('')}</div>
        ${prazoNota ? `<p class="vv-rel-nota">${esc(prazoNota)}</p>` : ''}${formatos}</section>
      ${equilibrio}
      ${anuncios}
      ${campoTexto('destaques', 'Destaques do mês', 'O que deu certo, as peças de mais resultado, o que o cliente precisa saber…')}
      ${campoTexto('proximos', 'Próximos passos', 'O que vem no mês que vem: datas, campanhas, o que precisamos do cliente…')}
      <section class="vv-rel-secao vv-rel-quebra"><h3>Peças do mês</h3>${pecas}</section>
      <div class="vv-rel-rodape">Vybe · Irecê-BA · gerado pelo Vybe OS em ${esc(dataBr(hojeIso()))}/${esc(hojeIso().slice(0, 4))}</div>
    </article>`;
  }
  // O que vai para o papel: o texto dos campos; bloco de anúncios ou de texto vazio fica fora.
  function espelhar() {
    if (!st.raiz) return;
    st.raiz.querySelectorAll('[data-rel-espelho]').forEach((el) => { el.textContent = st.raiz.querySelector(`[data-rel-campo="${el.dataset.relEspelho}"]`)?.value || ''; });
    const ads = [...st.raiz.querySelectorAll('[data-rel-campo^="ads_"]')];
    st.raiz.querySelector('[data-rel-bloco="anuncios"]')?.classList.toggle('vv-rel-vazio-papel', !ads.some((i) => i.value.trim()));
    ads.forEach((i) => i.closest('label')?.classList.toggle('vv-rel-vazio-papel', !i.value.trim()));
    ['destaques', 'proximos'].forEach((id) => st.raiz.querySelector(`[data-rel-bloco="${id}"]`)?.classList.toggle('vv-rel-vazio-papel', !st.raiz.querySelector(`[data-rel-campo="${id}"]`)?.value.trim()));
  }

  function pintar() {
    const r = st.resumo;
    st.raiz.querySelector('[data-rel-mes]').value = st.mes;
    st.raiz.querySelector('.vv-rel-rolagem').innerHTML = folhaHtml(r, lerRascunho());
    espelhar();
  }
  function calcular() {
    const objetivoDe = G.VybeClientePlaca?.fontes?.(st.cliente)?.objetivoDe || null;
    st.resumo = R().resumoDoMes({ pecas: todasAsPecas(), cliente: st.cliente, mes: st.mes, hoje: hojeIso(), objetivoDe, ehSolicitacao });
  }
  function trocarMes(mes) {
    const m = R().util.mesDe(mes);
    if (!m || m === st.mes) return;
    gravarRascunho();
    st.mes = m; calcular(); pintar();
  }

  function fechar() {
    if (!st.raiz) return;
    gravarRascunho();
    st.raiz.remove(); st.raiz = null;
    document.body.classList.remove('vv-rel-aberto');
    document.removeEventListener('keydown', teclado, true);
    try { st.antes?.focus?.(); } catch { /* o foco volta para onde der */ }
  }
  function teclado(e) {
    if (!st.raiz || e.key !== 'Escape') return;
    e.preventDefault(); e.stopPropagation(); fechar();
  }

  function abrir(cliente, mes) {
    if (typeof document === 'undefined' || !R()?.resumoDoMes) return false;
    const nome = normCliente(typeof cliente === 'object' && cliente ? cliente.nome : cliente);
    if (!nome) return false;
    if (st.raiz) fechar();
    st.cliente = G.VybeClientePlaca?.fontes?.(nome)?.nome || nome;
    st.mes = R().util.mesDe(mes) || mesPadrao();
    calcular();
    st.antes = document.activeElement;
    const raiz = document.createElement('div');
    raiz.id = 'vv-rel';
    raiz.className = 'vv-rel';
    raiz.setAttribute('role', 'dialog');
    raiz.setAttribute('aria-modal', 'true');
    raiz.setAttribute('aria-label', `Relatório do mês de ${st.cliente}`);
    raiz.innerHTML = `<div class="vv-rel-janela">
      <div class="vv-rel-barra-topo">
        <div class="vv-rel-titulo"><small>Relatório do mês</small><b>${esc(st.cliente)}</b></div>
        <div class="vv-rel-mes" role="group" aria-label="Mês do relatório"><button type="button" data-rel-passo="-1" aria-label="Mês anterior">‹</button><input type="month" data-rel-mes aria-label="Mês"><button type="button" data-rel-passo="1" aria-label="Mês seguinte">›</button></div>
        <button type="button" class="vv-rel-acao" data-rel-imprimir>Imprimir ou salvar PDF</button>
        <button type="button" class="vv-rel-fechar" data-rel-fechar aria-label="Fechar">×</button>
      </div>
      <div class="vv-rel-rolagem"></div></div>`;
    document.body.appendChild(raiz);
    document.body.classList.add('vv-rel-aberto');
    st.raiz = raiz;
    pintar();
    raiz.addEventListener('click', (e) => {
      const b = e.target.closest?.('button');
      if (e.target === raiz) { fechar(); return; }
      if (!b) return;
      if (b.hasAttribute('data-rel-fechar')) fechar();
      else if (b.dataset.relPasso) trocarMes(R().util.somarMeses(st.mes, Number(b.dataset.relPasso)));
      else if (b.hasAttribute('data-rel-imprimir')) { gravarRascunho(); espelhar(); G.print?.(); }
    });
    raiz.addEventListener('change', (e) => { if (e.target.matches?.('[data-rel-mes]')) trocarMes(e.target.value); });
    raiz.addEventListener('input', (e) => { if (e.target.matches?.('[data-rel-campo]')) { espelhar(); gravarRascunho(); } });
    document.addEventListener('keydown', teclado, true);
    raiz.querySelector('[data-rel-imprimir]')?.focus();
    return true;
  }

  G.VybeRelatorio = Object.freeze({ abrir, fechar, aberto: () => Boolean(st.raiz) });
})();
