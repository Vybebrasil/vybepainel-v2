// Ferramentas do Comercial (Paulo, 08/11/2026: "pode fazer as que achou correto" — do Toolkit do AgencyFlow).
// QR Code (para peça impressa, cardápio, evento) e link do WhatsApp com mensagem pronta (bio, campanha).
// Tudo no navegador: o QR sai do vybe-qr.js, nada é enviado para serviço de fora.
// API: window.VybeFerramentas = { abrir(aba = 'qr' | 'whatsapp'), fechar(), aberto() }
(() => {
  'use strict';
  const ABAS = [['qr', 'QR Code'], ['whatsapp', 'Link do WhatsApp']];
  const NIVEIS = [['M', 'Padrão'], ['Q', 'Reforçado'], ['H', 'Máximo (com logo por cima)']];
  const st = { raiz: null, janela: null, antes: null, aba: 'qr', qr: { texto: '', ecc: 'M', cor: '#1F1D1A' }, wa: { numero: '', mensagem: '' }, aviso: '' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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
        <label class="vf-cor"><span>Cor</span><input type="color" data-vf-campo="qr.cor" value="${esc(st.qr.cor)}"><small>Escura sobre fundo claro: cor clara demais o celular não lê.</small></label>
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
  function html() {
    return `<div class="vf-topo"><div><small>Comercial</small><h2 id="vf-titulo">Ferramentas</h2></div>
        <button type="button" class="vf-x" data-vf="fechar" aria-label="Fechar" title="Fechar (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <div class="vf-abas" role="tablist" aria-label="Ferramentas">${ABAS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${st.aba === k}" data-vf-aba="${k}">${n}</button>`).join('')}</div>
      <p class="vf-aviso" role="status" aria-live="polite">${esc(st.aviso)}</p>
      <div class="vf-corpo">${st.aba === 'whatsapp' ? abaWhatsapp() : abaQR()}</div>`;
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
    const tmp = document.createElement('div'); tmp.innerHTML = st.aba === 'whatsapp' ? abaWhatsapp() : abaQR();
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
    else if (a === 'svg') { const s = svgQR(st.qr.texto.trim()).svg; if (s) { baixar(nomeArquivo() + '.svg', new Blob([s], { type: 'image/svg+xml' })); avisar('SVG baixado: é o melhor para a gráfica (não perde qualidade).'); } }
    else if (a === 'png') baixarPNG();
    else if (a === 'copiar') {
      const link = linkWhatsapp(st.wa.numero, st.wa.mensagem);
      (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => avisar('Link copiado.'), () => avisar('Não deu para copiar sozinho: selecione o link e copie.'));
    } else if (a === 'qr-do-link') { st.qr.texto = linkWhatsapp(st.wa.numero, st.wa.mensagem); st.aba = 'qr'; pintar(false); }
  }
  function aoDigitar(e) {
    const c = e.target.closest('[data-vf-campo]'); if (!c) return;
    const [g, k] = c.dataset.vfCampo.split('.'); (g === 'qr' ? st.qr : st.wa)[k] = c.value;
    pintarPrevia();
  }
  function aoTeclar(e) {
    if (!st.raiz || e.key !== 'Escape' || e.defaultPrevented) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault(); e.stopPropagation(); fechar();
  }

  function abrir(aba = 'qr') {
    st.aba = ABAS.some(([k]) => k === aba) ? aba : 'qr';
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
    st.janela.querySelector('[data-vf-campo]')?.focus();
  }
  function fechar() {
    const { raiz, antes } = st; if (!raiz) return;
    Object.assign(st, { raiz: null, janela: null, antes: null, aviso: '' });
    raiz.remove(); if (antes?.isConnected) antes.focus?.();
  }
  window.addEventListener('keydown', aoTeclar, true);
  window.VybeFerramentas = Object.freeze({ abrir, fechar, aberto: () => Boolean(st.raiz), _linkWhatsapp: linkWhatsapp, _numeroWhatsapp: numeroWhatsapp });
})();
