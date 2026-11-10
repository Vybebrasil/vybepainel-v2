// Toolkit da Vybe (Paulo, 08/11/2026: "o que era de toolkit deixa na aba de toolkit até pra gente adicionar mais depois").
// Uma área própria no dock, com uma aba por ferramenta. Ferramenta nova = uma entrada em ABAS e a função da aba.
// QR Code (para peça impressa, cardápio, evento) e link do WhatsApp com mensagem pronta (bio, campanha).
// Tudo no navegador: o QR sai do vybe-qr.js, nada é enviado para serviço de fora.
// API: window.VybeFerramentas = { abrir(aba = 'inicio' | 'qr' | 'whatsapp' | 'roi'), fechar(), aberto() }
// Visão geral (fase 3d, quadro 39 do moodboard): o Toolkit abria em branco pelo dock. Agora abre nos cartões das
// ferramentas e em "Usados por último" (o que foi baixado, copiado ou calculado neste navegador, para refazer num clique).
// Calculadora de ROI: a mesma conta da proposta em Orçamentos (VybeComercialCalculos.roiCampanha), aqui sem proposta.
(() => {
  'use strict';
  const ABAS = [['inicio', 'Visão geral'], ['qr', 'QR Code'], ['whatsapp', 'Link do WhatsApp'], ['roi', 'Calculadora de ROI']];
  // As três ferramentas da Visão geral: o ícone, o que faz e o botão de começar.
  const FERRAMENTAS = [
    { aba: 'qr', nome: 'QR Code', frase: 'Link ou texto vira QR em PNG ou SVG para a gráfica.', botao: 'Gerar QR', ic: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M21 14v7h-7"/>' },
    { aba: 'whatsapp', nome: 'Link do WhatsApp', frase: 'Número e mensagem pronta num link para bio, anúncio e cardápio.', botao: 'Criar link', ic: '<path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5z"/>' },
    { aba: 'roi', nome: 'Calculadora de ROI', frase: 'Investimento e retorno para mostrar na reunião de venda.', botao: 'Calcular', ic: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>' },
  ];
  // Paleta do QR (no lugar da cor nativa): tons escuros que o celular lê. "Outra" continua para a cor da marca.
  const CORES = [['#1F1D1A', 'Preto'], ['#3A3F44', 'Grafite'], ['#C2490C', 'Laranja Vybe'], ['#1F4FA8', 'Azul'], ['#11613A', 'Verde'], ['#7A1F3D', 'Vinho']];
  const RECENTES = 'vybe-toolkit-recentes';
  const MAX_RECENTES = 6;
  const NIVEIS = [['M', 'Padrão'], ['Q', 'Reforçado'], ['H', 'Máximo (com logo por cima)']];
  const st = { raiz: null, janela: null, antes: null, aba: 'inicio', qr: { texto: '', ecc: 'M', cor: '#1F1D1A' }, wa: { numero: '', mensagem: '' }, roi: { investimento: '', ticket: '', margem: '', vendas: '' }, aviso: '' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const icone = (d, t = 16) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" aria-hidden="true">${d}</svg>`;
  const numero = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || null;

  // ---------- Usados por último (só neste navegador; nada vai ao servidor) ----------
  function lerRecentes() {
    try { const l = JSON.parse(localStorage.getItem(RECENTES) || '[]'); return Array.isArray(l) ? l.filter((r) => r && r.dados && FERRAMENTAS.some((f) => f.aba === r.tipo)) : []; } catch { return []; }
  }
  // Guarda o uso no topo da lista; o mesmo QR, link ou conta não se repete (sobe para o topo).
  function guardarUso(tipo, dados) {
    const chave = tipo + ':' + JSON.stringify(dados);
    const lista = [{ tipo, dados, chave, quando: Date.now() }].concat(lerRecentes().filter((r) => r.chave !== chave)).slice(0, MAX_RECENTES);
    try { localStorage.setItem(RECENTES, JSON.stringify(lista)); } catch { /* sem memória no navegador: segue sem a lista */ }
  }
  function quandoFoi(ms) {
    const d = new Date(ms); if (!ms || Number.isNaN(d.getTime())) return '';
    const hoje = new Date(), ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoje.toDateString()) return 'hoje, ' + hora;
    if (d.toDateString() === ontem.toDateString()) return 'ontem, ' + hora;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ', ' + hora;
  }
  // O nome de cada uso: o endereço do QR, o número do link ou os valores da conta.
  function rotuloDoUso(r) {
    const d = r.dados || {};
    if (r.tipo === 'qr') return { titulo: String(d.texto || '').replace(/^https?:\/\//, '') || 'QR', sub: 'QR Code' };
    if (r.tipo === 'whatsapp') return { titulo: d.numero || 'Link do WhatsApp', sub: 'Link do WhatsApp' + (d.mensagem ? ` · "${d.mensagem}"` : '') };
    return { titulo: `Investimento ${din(numero(d.investimento))} · ticket ${din(numero(d.ticket))}`, sub: `Calculadora de ROI · margem ${d.margem || '—'}%` };
  }
  function abaInicio() {
    const recentes = lerRecentes();
    const acoes = (r, i) => r.tipo === 'qr' ? `<button type="button" class="vf-botao" data-vf="refazer" data-vf-uso="${i}">Abrir</button><button type="button" class="vf-botao" data-vf="baixar-uso" data-vf-uso="${i}">Baixar PNG</button>`
      : r.tipo === 'whatsapp' ? `<button type="button" class="vf-botao" data-vf="refazer" data-vf-uso="${i}">Abrir</button><button type="button" class="vf-botao" data-vf="copiar-uso" data-vf-uso="${i}">Copiar</button>`
      : `<button type="button" class="vf-botao" data-vf="refazer" data-vf-uso="${i}">Abrir a conta</button>`;
    return `<p class="vf-frase">Ferramentas rápidas da Vybe para o dia a dia com o cliente. Tudo roda aqui no navegador: nada é enviado para fora.</p>
      <div class="vf-cartoes">${FERRAMENTAS.map((f) => `<article class="vf-cartao">
        <span class="vf-cartao-ic">${icone(f.ic, 18)}</span><h3>${esc(f.nome)}</h3><p>${esc(f.frase)}</p>
        <button type="button" class="vf-botao principal" data-vf-aba="${f.aba}">${esc(f.botao)}</button></article>`).join('')}</div>
      <section class="vf-recentes" aria-labelledby="vf-recentes-titulo"><h3 id="vf-recentes-titulo">Usados por último</h3>
        ${recentes.length ? `<ul>${recentes.map((r, i) => { const f = FERRAMENTAS.find((x) => x.aba === r.tipo), n = rotuloDoUso(r); return `<li class="vf-uso">
          <span class="vf-uso-ic">${icone(f.ic)}</span><div class="vf-uso-txt"><b>${esc(n.titulo)}</b><small>${esc(n.sub)} · ${esc(quandoFoi(r.quando))}</small></div>
          <div class="vf-uso-acoes">${acoes(r, i)}</div></li>`; }).join('')}</ul>`
        : '<p class="vf-vazio">Nada usado ainda neste computador. O QR que você baixar, o link que copiar e a conta que fizer aparecem aqui para refazer com um clique.</p>'}
      </section>`;
  }

  // Número brasileiro → só dígitos com 55 na frente. Aceita (74) 99999-9999, 74999999999, +55 74 9…
  function numeroWhatsapp(entrada) {
    let d = String(entrada || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 10 || d.length === 11) d = '55' + d;
    if (!/^55\d{10,11}$/.test(d)) return '';
    return d;
  }
  function linkWhatsapp(numero, mensagem) {
    const n = numeroWhatsapp(numero); if (!n) return '';
    const m = String(mensagem || '').trim();
    return `https://wa.me/${n}${m ? '?text=' + encodeURIComponent(m) : ''}`;
  }

  function svgQR(texto) {
    try { return { svg: window.VybeQR.svg(texto, { ecc: st.qr.ecc, cor: st.qr.cor }), erro: '' }; }
    catch (e) { return { svg: '', erro: e.message }; }
  }
  function abaQR() {
    const t = st.qr.texto.trim(), r = t ? svgQR(t) : { svg: '', erro: '' };
    return `<div class="vf-grade">
      <form class="vf-campos" data-vf-form="qr" onsubmit="return false">
        <label><span>Link ou texto</span><textarea rows="3" data-vf-campo="qr.texto" placeholder="https://… ou o texto que o QR deve abrir" maxlength="300">${esc(st.qr.texto)}</textarea></label>
        <label><span>Resistência</span><select data-vf-campo="qr.ecc">${NIVEIS.map(([k, n]) => `<option value="${k}"${k === st.qr.ecc ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <fieldset class="vf-cor"><legend>Cor</legend><div class="vf-paleta">${CORES.map(([c, n]) => `<label class="vf-amostra" title="${n}"><input type="radio" name="vf-cor" data-vf-campo="qr.cor" value="${c}"${st.qr.cor.toUpperCase() === c ? ' checked' : ''}><i style="background:${c}" aria-hidden="true"></i><span class="vf-oculto">${n}</span></label>`).join('')}
          <label class="vf-amostra outra${CORES.some(([c]) => c === st.qr.cor.toUpperCase()) ? '' : ' on'}" title="Outra cor (a da marca do cliente)"><input type="color" data-vf-campo="qr.cor" value="${esc(st.qr.cor)}"><span>Outra</span></label></div>
          <small>Escura sobre fundo claro: cor clara demais o celular não lê.</small></fieldset>
        <p class="vf-dica">Para impressão, use "Máximo" se for colocar a logo do cliente no meio. Teste sempre com a câmera do celular antes de mandar para a gráfica.</p>
      </form>
      <div class="vf-previa">
        <div class="vf-qr${r.svg ? '' : ' vazio'}">${r.svg || `<p>${esc(r.erro || 'Escreva um link para ver o QR aqui.')}</p>`}</div>
        <div class="vf-acoes">
          <button type="button" class="vf-botao principal" data-vf="png"${r.svg ? '' : ' disabled'}>Baixar PNG</button>
          <button type="button" class="vf-botao" data-vf="svg"${r.svg ? '' : ' disabled'}>Baixar SVG (gráfica)</button>
        </div>
      </div>
    </div>`;
  }
  function abaWhatsapp() {
    const link = linkWhatsapp(st.wa.numero, st.wa.mensagem), numeroOk = !st.wa.numero || numeroWhatsapp(st.wa.numero);
    return `<div class="vf-grade">
      <form class="vf-campos" data-vf-form="wa" onsubmit="return false">
        <label><span>WhatsApp (com DDD)</span><input type="tel" inputmode="tel" data-vf-campo="wa.numero" value="${esc(st.wa.numero)}" placeholder="(74) 99999-9999" maxlength="20" aria-invalid="${!numeroOk}"></label>
        ${numeroOk ? '' : '<p class="vf-erro">Número inválido: use DDD + número (10 ou 11 dígitos).</p>'}
        <label><span>Mensagem pronta (opcional)</span><textarea rows="4" data-vf-campo="wa.mensagem" maxlength="500" placeholder="Olá! Vi o anúncio e quero saber mais.">${esc(st.wa.mensagem)}</textarea></label>
        <p class="vf-dica">Quem toca no link abre a conversa com essa mensagem já escrita. Bom para bio do Instagram, anúncio e cardápio.</p>
      </form>
      <div class="vf-previa">
        <div class="vf-link${link ? '' : ' vazio'}">${link ? `<code>${esc(link)}</code>` : '<p>Preencha o número para gerar o link.</p>'}</div>
        <div class="vf-acoes">
          <button type="button" class="vf-botao principal" data-vf="copiar"${link ? '' : ' disabled'}>Copiar link</button>
          <a class="vf-botao${link ? '' : ' desligado'}" ${link ? `href="${esc(link)}"` : 'aria-disabled="true"'} target="_blank" rel="noopener noreferrer">Testar</a>
          <button type="button" class="vf-botao" data-vf="qr-do-link"${link ? '' : ' disabled'}>Gerar QR deste link</button>
        </div>
      </div>
    </div>`;
  }
  const din = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }));
  function abaRoi() {
    const r = st.roi, calc = window.VybeComercialCalculos?.roiCampanha, c = calc ? calc(r) : null;
    const campo = (k, rot, ph, dica = '') => `<label><span>${rot}</span><input type="text" inputmode="decimal" data-vf-campo="roi.${k}" value="${esc(r[k])}" placeholder="${ph}">${dica ? `<small>${dica}</small>` : ''}</label>`;
    return `<div class="vf-grade">
      <form class="vf-campos" data-vf-form="roi" onsubmit="return false">
        ${campo('investimento', 'Investimento por mês (R$)', '2.500', 'quanto o cliente paga à Vybe por mês')}
        ${campo('ticket', 'Ticket médio do cliente (R$)', '180', 'o valor de uma venda dele')}
        ${campo('margem', 'Margem por venda (%)', '35', 'o lucro dele em cada venda')}
        ${campo('vendas', 'Vendas a mais por mês (opcional)', '40', 'o que a campanha deve trazer')}
        <p class="vf-dica">Serve para a conversa de venda: quantas vendas a mais pagam a Vybe e o retorno esperado. A mesma conta está na proposta, em Comercial › Orçamentos.</p>
      </form>
      <div class="vf-previa">
        ${c ? `<div class="vf-roi">
          <div><span>Lucro por venda</span><b>${din(c.lucroPorVenda)}</b></div>
          <div><span>Vendas para pagar a Vybe</span><b>${c.empate == null ? '—' : c.empate.toLocaleString('pt-BR')}</b></div>
          ${c.roi == null ? '' : `<div><span>Faturamento a mais</span><b>${din(c.faturamento)}</b></div><div><span>Lucro a mais</span><b>${din(c.lucro)}</b></div>
          <div class="g ${c.roi >= 0 ? 'ok' : 'ruim'}"><span>ROI estimado</span><b>${c.roi > 0 ? '+' : ''}${c.roi.toLocaleString('pt-BR')}%</b></div>`}
        </div>` : `<div class="vf-link vazio"><p>${calc ? 'Preencha investimento, ticket e margem para ver a conta.' : 'A calculadora ainda está carregando.'}</p></div>`}
      </div>
    </div>`;
  }
  function corpoDaAba() { return st.aba === 'inicio' ? abaInicio() : st.aba === 'whatsapp' ? abaWhatsapp() : st.aba === 'roi' ? abaRoi() : abaQR(); }
  function html() {
    return `<div class="vf-topo"><div><small>Vybe</small><h2 id="vf-titulo">Toolkit</h2></div>
        <button type="button" class="vf-x" data-vf="fechar" aria-label="Fechar" title="Fechar (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <div class="vf-abas" role="tablist" aria-label="Ferramentas do Toolkit">${ABAS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${st.aba === k}" data-vf-aba="${k}">${n}</button>`).join('')}</div>
      <p class="vf-aviso" role="status" aria-live="polite">${esc(st.aviso)}</p>
      <div class="vf-corpo">${corpoDaAba()}</div>`;
  }
  function pintar(manterFoco = true) {
    if (!st.janela) return;
    const f = manterFoco ? document.activeElement?.dataset?.vfCampo : null, sel = f ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    st.janela.innerHTML = html();
    if (f) { const el = st.janela.querySelector(`[data-vf-campo="${f}"]`); el?.focus(); try { if (sel && el.setSelectionRange) el.setSelectionRange(...sel); } catch {} }
  }
  // Só a prévia muda enquanto digita (não refaz o formulário, para o cursor não pular).
  function pintarPrevia() {
    const p = st.janela?.querySelector('.vf-previa'); if (!p) return;
    const tmp = document.createElement('div'); tmp.innerHTML = corpoDaAba();
    p.replaceWith(tmp.querySelector('.vf-previa'));
    const erro = st.janela.querySelector('.vf-erro'), novoErro = tmp.querySelector('.vf-erro');
    if (erro && !novoErro) erro.remove(); else if (!erro && novoErro) st.janela.querySelector('[data-vf-campo="wa.numero"]')?.closest('label')?.after(novoErro);
  }
  function avisar(t) { st.aviso = t; const el = st.janela?.querySelector('.vf-aviso'); if (el) el.textContent = t; clearTimeout(avisar.t); avisar.t = setTimeout(() => { st.aviso = ''; if (el) el.textContent = ''; }, 3500); }

  function baixar(nome, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const nomeArquivo = () => 'qr-' + (st.qr.texto.trim().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'vybe');
  function baixarPNG() {
    const svg = svgQR(st.qr.texto.trim()).svg; if (!svg) return;
    guardarUso('qr', { texto: st.qr.texto.trim(), ecc: st.qr.ecc, cor: st.qr.cor });
    const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 1200;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, 1200, 1200); URL.revokeObjectURL(url);
      c.toBlob((b) => { if (b) { baixar(nomeArquivo() + '.png', b); avisar('PNG de 1200 × 1200 baixado.'); } }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); avisar('Não foi possível gerar o PNG. Baixe o SVG.'); };
    img.src = url;
  }

  function aoClicar(e) {
    if (e.target === st.raiz) { fechar(); return; }
    const aba = e.target.closest('[data-vf-aba]'); if (aba) { st.aba = aba.dataset.vfAba; st.aviso = ''; pintar(false); return; }
    const b = e.target.closest('[data-vf]'); if (!b || b.disabled) return;
    const a = b.dataset.vf;
    if (a === 'fechar') fechar();
    else if (a === 'svg') { const s = svgQR(st.qr.texto.trim()).svg; if (s) { guardarUso('qr', { texto: st.qr.texto.trim(), ecc: st.qr.ecc, cor: st.qr.cor }); baixar(nomeArquivo() + '.svg', new Blob([s], { type: 'image/svg+xml' })); avisar('SVG baixado: é o melhor para a gráfica (não perde qualidade).'); } }
    else if (a === 'png') baixarPNG();
    else if (a === 'copiar') {
      const link = linkWhatsapp(st.wa.numero, st.wa.mensagem);
      guardarUso('whatsapp', { numero: st.wa.numero.trim(), mensagem: st.wa.mensagem.trim() });
      (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => avisar('Link copiado.'), () => avisar('Não deu para copiar sozinho: selecione o link e copie.'));
    } else if (a === 'refazer' || a === 'baixar-uso' || a === 'copiar-uso') {
      const r = lerRecentes()[Number(b.dataset.vfUso)]; if (!r) return;
      if (r.tipo === 'qr') Object.assign(st.qr, { texto: '', ecc: 'M', cor: CORES[0][0] }, r.dados);
      else if (r.tipo === 'whatsapp') Object.assign(st.wa, { numero: '', mensagem: '' }, r.dados);
      else Object.assign(st.roi, r.dados);
      if (a === 'baixar-uso') baixarPNG();
      else if (a === 'copiar-uso') {
        const link = linkWhatsapp(st.wa.numero, st.wa.mensagem); guardarUso('whatsapp', { numero: st.wa.numero.trim(), mensagem: st.wa.mensagem.trim() });
        (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => avisar('Link copiado.'), () => avisar('Não deu para copiar sozinho: abra e copie o link.'));
      } else { st.aba = r.tipo; st.aviso = ''; pintar(false); }
    } else if (a === 'qr-do-link') { st.qr.texto = linkWhatsapp(st.wa.numero, st.wa.mensagem); st.aba = 'qr'; pintar(false); }
  }
  function aoDigitar(e) {
    const c = e.target.closest('[data-vf-campo]'); if (!c) return;
    const [g, k] = c.dataset.vfCampo.split('.'); ({ qr: st.qr, wa: st.wa, roi: st.roi })[g][k] = c.value;
    // A cor: a amostra escolhida fica marcada e "Outra" acende quando a cor não é da paleta.
    if (c.dataset.vfCampo === 'qr.cor') {
      const daPaleta = CORES.some(([cor]) => cor === c.value.toUpperCase());
      st.janela?.querySelectorAll('[data-vf-campo="qr.cor"]').forEach((x) => { if (x.type === 'radio') x.checked = x.value === c.value.toUpperCase(); else if (x !== c) x.value = c.value; });
      st.janela?.querySelector('.vf-amostra.outra')?.classList.toggle('on', !daPaleta);
    }
    // Conta de ROI feita (ao sair do campo) entra nos usados por último.
    if (g === 'roi' && e.type === 'change' && window.VybeComercialCalculos?.roiCampanha?.(st.roi)) guardarUso('roi', { ...st.roi });
    pintarPrevia();
  }
  function aoTeclar(e) {
    if (!st.raiz || e.key !== 'Escape' || e.defaultPrevented) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault(); e.stopPropagation(); fechar();
  }

  function abrir(aba = 'inicio') {
    st.aba = ABAS.some(([k]) => k === aba) ? aba : 'inicio';
    if (!st.raiz) {
      st.antes = document.activeElement || null;
      const raiz = document.createElement('div'), janela = document.createElement('section');
      raiz.className = 'vc-camada vf-camada';
      janela.id = 'vv-ferramentas'; janela.className = 'vc-janela';
      janela.setAttribute('role', 'dialog'); janela.setAttribute('aria-modal', 'true'); janela.setAttribute('aria-labelledby', 'vf-titulo');
      raiz.append(janela);
      raiz.addEventListener('click', aoClicar); raiz.addEventListener('input', aoDigitar); raiz.addEventListener('change', aoDigitar);
      document.body.append(raiz);
      Object.assign(st, { raiz, janela });
    }
    pintar(false);
    (st.janela.querySelector('[data-vf-campo]') || st.janela.querySelector('.vf-cartao .vf-botao'))?.focus();
  }
  function fechar() {
    const { raiz, antes } = st; if (!raiz) return;
    Object.assign(st, { raiz: null, janela: null, antes: null, aviso: '' });
    raiz.remove(); if (antes?.isConnected) antes.focus?.();
  }
  window.addEventListener('keydown', aoTeclar, true);
  window.VybeFerramentas = Object.freeze({ abrir, fechar, aberto: () => Boolean(st.raiz), _linkWhatsapp: linkWhatsapp, _numeroWhatsapp: numeroWhatsapp, _rotuloDoUso: rotuloDoUso });
})();
