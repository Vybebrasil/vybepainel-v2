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
  const st = { raiz: null, janela: null, antes: null, aba: 'inicio', qr: { texto: '', ecc: 'M', cor: '#1F1D1A' }, wa: { numero: '', mensagem: '' }, roi: { investimento: '', ticket: '', margem: '', vendas: '' }, simples: { investimento: '', retorno: '' }, formato: 'png', feito: { qr: false, wa: false, roi: false }, busca: '', aviso: '' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Cabeçalho único da janela (vbCabecalhoHtml e vbFecharHtml, vybe-core.js). Sem o vybe-core (testes), só o título e as ações.
  const cabecalho = (o) => (typeof window !== 'undefined' && typeof window.vbCabecalhoHtml === 'function' ? window.vbCabecalhoHtml(o) : `<h2${o.id ? ` id="${o.id}"` : ''}>${esc(o.titulo)}</h2>${o.texto ? `<p>${esc(o.texto)}</p>` : ''}${o.acoes || ''}`);
  const botaoX = (attr, classe = '') => (typeof window !== 'undefined' && typeof window.vbFecharHtml === 'function' ? window.vbFecharHtml(attr, classe) : `<button type="button" class="vb-janela-x ${classe}" ${attr} aria-label="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`);
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
    if (d.retorno != null) { const c = retornoSimples(d.investimento, d.retorno); return { titulo: c ? `Retorno de ${c.pct.toLocaleString('pt-BR')}%` : 'Conta de retorno', sub: `ROI · investiu ${din(numero(d.investimento))} e voltou ${din(numero(d.retorno))}` }; }
    return { titulo: `Investimento ${din(numero(d.investimento))} · ticket ${din(numero(d.ticket))}`, sub: `Calculadora de ROI · margem ${d.margem || '—'}%` };
  }
  // Padrão v2 (quadro "Toolkit" do moodboard, 12/11/2026): a Visão geral deixa de ser vitrine. Em cima, a frase e os
  // "Usados por último" em cartões; embaixo, as três ferramentas já com os campos, o botão preto e o resultado no lugar.
  // As abas de cada ferramenta continuam com tudo (resistência e cor do QR, testar o link, a conta completa de ROI).
  const CERTO = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Conta direta da Visão geral: quanto investiu e quanto voltou. { pct, porReal } ou null.
  function retornoSimples(inv, ret) {
    const i = numero(inv), r = numero(ret); if (!i || i <= 0 || r == null) return null;
    return { pct: Math.round((r - i) / i * 100), porReal: r / i };
  }
  const fraseRoi = (c) => `Retorno de ${c.pct.toLocaleString('pt-BR')}% (${din(c.porReal)} para cada R$ 1)`;
  // O resultado de cada ferramenta na Visão geral; antes de gerar, a frase que diz o que aparece ali.
  function resultadoHtml(tipo) {
    if (tipo === 'qr') {
      const t = st.qr.texto.trim(), r = st.feito.qr && t ? svgQR(t) : { svg: '', erro: '' };
      if (!r.svg) return `<p class="p2-sub">${esc(r.erro || 'O QR aparece aqui, pronto para baixar.')}</p>`;
      return `<span class="vf2-qr">${r.svg}</span><p><b>QR pronto</b><br><span class="p2-sub">${st.formato === 'svg' ? 'SVG, o melhor para a gráfica' : 'PNG de 1.200 px'}</span></p><button type="button" class="p2-btn s" data-vf="${st.formato === 'svg' ? 'svg' : 'png'}">Baixar</button>`;
    }
    if (tipo === 'wa') {
      const link = st.feito.wa ? linkWhatsapp(st.wa.numero, st.wa.mensagem) : '';
      if (!link) return `<p class="p2-sub${st.feito.wa ? ' ruim' : ''}">${st.feito.wa ? 'Número inválido: use DDD + número (10 ou 11 dígitos).' : 'O link aparece aqui, pronto para copiar.'}</p>`;
      return `<p><b class="vf2-quebra">${esc(link.replace(/^https:\/\//, '').split('?')[0])}</b><br><span class="p2-sub">${st.wa.mensagem.trim() ? 'abre a conversa com a mensagem pronta' : 'abre a conversa'}</span></p><button type="button" class="p2-btn s v2-estado" data-vf="copiar">Copiar</button>`;
    }
    const c = st.feito.roi ? retornoSimples(st.simples.investimento, st.simples.retorno) : null;
    if (!c) return `<p class="p2-sub${st.feito.roi ? ' ruim' : ''}">${st.feito.roi ? 'Preencha o investimento e o retorno em reais.' : 'O retorno aparece aqui.'}</p>`;
    return `<b class="vf2-roi${c.pct < 0 ? ' ruim' : ''}"><span class="v2-num">${c.pct.toLocaleString('pt-BR')}%</span></b><p><b>de retorno</b><br><span class="p2-sub">${din(c.porReal)} para cada R$ 1</span></p><button type="button" class="p2-btn s v2-estado" data-vf="copiar-roi">Copiar</button>`;
  }
  function pintarResultado(tipo) { const el = st.janela?.querySelector(`[data-vf-res="${tipo}"]`); if (el) el.innerHTML = resultadoHtml(tipo); }
  function abaInicio() {
    const recentes = lerRecentes(), q = norm(st.busca).trim();
    const campo = (id, rot, attr, valor, ph, tipo = 'text') => `<div><label class="vf2-rot" for="${id}">${rot}</label><input id="${id}" class="p2-campo" type="${tipo}" ${attr} value="${esc(valor)}" placeholder="${ph}"></div>`;
    const cabeca = (f) => `<div class="vf2-cab"><span class="vf2-ico">${icone(f.ic, 18)}</span><h3>${esc(f.nome)}</h3><button type="button" class="p2-link vf2-mais" data-vf-aba="${f.aba}">mais opções</button></div><p class="p2-sub">${esc(f.frase)}</p>`;
    const cartoes = {
      qr: (f) => `<article class="p2-card vf2-fer">${cabeca(f)}
        ${campo('vf2-qr-texto', 'Link ou texto', 'data-vf-campo="qr.texto" maxlength="300"', st.qr.texto, 'https://')}
        <div><span class="vf2-rot" id="vf2-formato">Formato</span><div class="vf2-formato" role="radiogroup" aria-labelledby="vf2-formato">${[['png', 'PNG'], ['svg', 'SVG']].map(([k, n]) => `<button type="button" class="p2-chip" role="radio" aria-checked="${st.formato === k}" data-vf-formato="${k}">${n}</button>`).join('')}</div></div>
        <div><button type="button" class="p2-btn k" data-vf-gerar="qr">Gerar QR</button></div>
        <div class="vf2-res" data-vf-res="qr" role="status">${resultadoHtml('qr')}</div></article>`,
      whatsapp: (f) => `<article class="p2-card vf2-fer">${cabeca(f)}
        ${campo('vf2-wa-numero', 'Número com DDD', 'data-vf-campo="wa.numero" inputmode="tel" maxlength="20"', st.wa.numero, '(74) 99999-9999', 'tel')}
        ${campo('vf2-wa-msg', 'Mensagem pronta', 'data-vf-campo="wa.mensagem" maxlength="500"', st.wa.mensagem, 'Olá! Quero saber mais.')}
        <div><button type="button" class="p2-btn k" data-vf-gerar="wa">Criar link</button></div>
        <div class="vf2-res" data-vf-res="wa" role="status">${resultadoHtml('wa')}</div></article>`,
      roi: (f) => `<article class="p2-card vf2-fer">${cabeca({ ...f, frase: 'Quanto investiu e quanto voltou viram o retorno da campanha.' })}
        ${campo('vf2-roi-inv', 'Investimento', 'data-vf-campo="simples.investimento" inputmode="decimal"', st.simples.investimento, 'R$ 1.500')}
        ${campo('vf2-roi-ret', 'Retorno', 'data-vf-campo="simples.retorno" inputmode="decimal"', st.simples.retorno, 'R$ 6.300')}
        <div><button type="button" class="p2-btn k" data-vf-gerar="roi">Calcular</button></div>
        <div class="vf2-res" data-vf-res="roi" role="status">${resultadoHtml('roi')}</div></article>`,
    };
    const visiveis = FERRAMENTAS.filter((f) => !q || norm(`${f.nome} ${f.frase}`).includes(q));
    const acoes = (r, i) => `${r.tipo === 'qr' ? `<button type="button" class="p2-btn s" data-vf="baixar-uso" data-vf-uso="${i}">Baixar de novo</button>` : r.tipo === 'whatsapp' || r.dados.retorno != null ? `<button type="button" class="p2-btn s" data-vf="copiar-uso" data-vf-uso="${i}">Copiar</button>` : ''}<button type="button" class="p2-btn s" data-vf="refazer" data-vf-uso="${i}">Refazer</button>`;
    const usados = recentes.length ? `<section class="vf2-usados" aria-labelledby="vf-recentes-titulo"><div class="p2-lista-topo"><h3 class="p2-h" id="vf-recentes-titulo">Usados por último</h3><span class="p2-sub">neste computador · refaz com um clique</span></div>
        <div class="vf2-tres">${recentes.map((r, i) => { const n = rotuloDoUso(r); return `<div class="p2-card vf2-rec"><p class="vf2-rec-topo"><span class="p2-pill">${esc(n.sub.split(' · ')[0])}</span><span class="p2-sub">${esc(quandoFoi(r.quando))}</span></p>
          <p class="vf2-rec-oq"><b>${esc(n.titulo)}</b>${n.sub.includes(' · ') ? ` · ${esc(n.sub.split(' · ').slice(1).join(' · '))}` : ''}</p><p class="vf2-rec-acoes">${acoes(r, i)}</p></div>`; }).join('')}</div></section>` : '';
    return `<div class="p2-card p2-fala"><span class="p2-ag" aria-hidden="true">V</span><p><span class="p2-quem">VYBES · Ferramentas rápidas</span><b>${FERRAMENTAS.length} ferramentas</b> para o dia a dia com o cliente. Tudo roda aqui no navegador: nada é enviado para fora.</p></div>
      ${usados}
      ${visiveis.length ? `<div class="vf2-tres vf2-fers">${visiveis.map((f) => cartoes[f.aba](f)).join('')}</div>` : '<p class="p2-vazio">Nenhuma ferramenta com esse nome.</p>'}
      ${recentes.length ? '' : '<p class="p2-sub vf-vazio"><b>Nada usado ainda neste computador.</b> <button type="button" class="p2-link" data-vf="primeiro-qr">Gerar o primeiro QR</button></p>'}`;
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
  // Resistência no menu do sistema (quadro 39, 10/11/2026: sem select nativo). Sem o vybe-core (testes), só o valor.
  function escolhaNivel() {
    if (typeof window.vbEscolhaHtml === 'function') return window.vbEscolhaHtml({ rotulo: 'Resistência', valor: st.qr.ecc, campo: 'data-vf-campo="qr.ecc"', opcoes: NIVEIS.map(([k, n]) => ({ valor: k, nome: n })) });
    return `<input type="hidden" data-vf-campo="qr.ecc" value="${esc(st.qr.ecc)}">`;
  }
  function abaQR() {
    const t = st.qr.texto.trim(), r = t ? svgQR(t) : { svg: '', erro: '' };
    return `<div class="vf-grade">
      <form class="vf-campos" data-vf-form="qr" onsubmit="return false">
        <label><span>Link ou texto</span><textarea rows="3" data-vf-campo="qr.texto" placeholder="https://… ou o texto que o QR deve abrir" maxlength="300">${esc(st.qr.texto)}</textarea></label>
        <div class="vf-campo-escolha"><span>Resistência</span>${escolhaNivel()}</div>
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
    const seg = `<span class="p2-seg" role="tablist" aria-label="Ferramentas do Toolkit">${ABAS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${st.aba === k}" data-vf-aba="${k}">${n}</button>`).join('')}</span>`;
    const busca = `<label class="p2-oculto" for="vf-busca">Buscar ferramenta</label><input id="vf-busca" class="p2-busca vf2-busca" type="search" placeholder="Buscar ferramenta" data-vf-busca value="${esc(st.busca)}">`;
    return `<div class="vf-topo vb-janela-topo">${cabecalho({ id: 'vf-titulo', titulo: 'Toolkit', acoes: `${seg}${busca}${botaoX('data-vf="fechar"', 'vf-x')}` })}</div>
      <p class="vf-aviso" role="status" aria-live="polite">${esc(st.aviso)}</p>
      <div class="vf-corpo${st.aba === 'inicio' ? ' vf2-inicio' : ' p2-card'}">${corpoDaAba()}</div>`;
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
    const fmt = e.target.closest('[data-vf-formato]'); if (fmt) { st.formato = fmt.dataset.vfFormato; st.janela.querySelectorAll('[data-vf-formato]').forEach((x) => x.setAttribute('aria-checked', String(x === fmt))); pintarResultado('qr'); return; }
    const gerar = e.target.closest('[data-vf-gerar]');
    if (gerar) {
      const t = gerar.dataset.vfGerar; st.feito[t] = true; pintarResultado(t);
      if (t === 'roi' && retornoSimples(st.simples.investimento, st.simples.retorno)) guardarUso('roi', { ...st.simples });
      return;
    }
    const b = e.target.closest('[data-vf]'); if (!b || b.disabled) return;
    const a = b.dataset.vf;
    // O botão conta o estado: gira e fica verde com a palavra nova (v2-estado).
    const feito = (texto) => { if (!b.classList.contains('v2-estado') || !b.isConnected) return; b.dataset.estado = 'feito'; b.innerHTML = CERTO + texto; };
    if (a === 'primeiro-qr') { st.janela.querySelector('[data-vf-campo="qr.texto"]')?.focus(); return; }
    if (a === 'copiar-roi') { const c = retornoSimples(st.simples.investimento, st.simples.retorno); if (c) (navigator.clipboard?.writeText(fraseRoi(c)) || Promise.reject()).then(() => { feito('Copiado'); avisar('Retorno copiado.'); }, () => avisar(fraseRoi(c))); return; }
    if (a === 'fechar') fechar();
    else if (a === 'svg') { const s = svgQR(st.qr.texto.trim()).svg; if (s) { guardarUso('qr', { texto: st.qr.texto.trim(), ecc: st.qr.ecc, cor: st.qr.cor }); baixar(nomeArquivo() + '.svg', new Blob([s], { type: 'image/svg+xml' })); avisar('SVG baixado: é o melhor para a gráfica (não perde qualidade).'); } }
    else if (a === 'png') baixarPNG();
    else if (a === 'copiar') {
      const link = linkWhatsapp(st.wa.numero, st.wa.mensagem);
      guardarUso('whatsapp', { numero: st.wa.numero.trim(), mensagem: st.wa.mensagem.trim() });
      (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => { feito('Copiado'); avisar('Link copiado.'); }, () => avisar('Não deu para copiar sozinho: selecione o link e copie.'));
    } else if (a === 'refazer' || a === 'baixar-uso' || a === 'copiar-uso') {
      const r = lerRecentes()[Number(b.dataset.vfUso)]; if (!r) return;
      if (r.tipo === 'qr') Object.assign(st.qr, { texto: '', ecc: 'M', cor: CORES[0][0] }, r.dados);
      else if (r.tipo === 'whatsapp') Object.assign(st.wa, { numero: '', mensagem: '' }, r.dados);
      else if (r.dados.retorno != null) { Object.assign(st.simples, r.dados); st.feito.roi = true; if (a === 'copiar-uso') { const c = retornoSimples(st.simples.investimento, st.simples.retorno); if (c) (navigator.clipboard?.writeText(fraseRoi(c)) || Promise.reject()).then(() => avisar('Retorno copiado.'), () => avisar(fraseRoi(c))); } else { st.aba = 'inicio'; st.aviso = ''; pintar(false); } return; }
      else Object.assign(st.roi, r.dados);
      if (a === 'baixar-uso') baixarPNG();
      else if (a === 'copiar-uso') {
        const link = linkWhatsapp(st.wa.numero, st.wa.mensagem); guardarUso('whatsapp', { numero: st.wa.numero.trim(), mensagem: st.wa.mensagem.trim() });
        (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => avisar('Link copiado.'), () => avisar('Não deu para copiar sozinho: abra e copie o link.'));
      } else { st.aba = r.tipo; st.aviso = ''; pintar(false); }
    } else if (a === 'qr-do-link') { st.qr.texto = linkWhatsapp(st.wa.numero, st.wa.mensagem); st.aba = 'qr'; pintar(false); }
  }
  function aoDigitar(e) {
    if (e.target.matches?.('[data-vf-busca]')) { if (e.type !== 'input') return; st.busca = e.target.value; if (st.aba !== 'inicio') st.aba = 'inicio'; const pos = e.target.selectionStart; pintar(false); const n = st.janela.querySelector('[data-vf-busca]'); n?.focus(); try { n?.setSelectionRange(pos, pos); } catch {} return; }
    const c = e.target.closest('[data-vf-campo]'); if (!c) return;
    const [g, k] = c.dataset.vfCampo.split('.'); ({ qr: st.qr, wa: st.wa, roi: st.roi, simples: st.simples })[g][k] = c.value;
    // Na Visão geral, mexer no campo desfaz o resultado: ele volta com o botão.
    if (st.aba === 'inicio') { const t = g === 'simples' ? 'roi' : g; if (st.feito[t]) { st.feito[t] = false; pintarResultado(t); } return; }
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
    (st.aba === 'inicio' ? st.janela.querySelector('[role="tab"][aria-selected="true"]') : st.janela.querySelector('[data-vf-campo]'))?.focus();
  }
  function fechar() {
    const { raiz, antes } = st; if (!raiz) return;
    Object.assign(st, { raiz: null, janela: null, antes: null, aviso: '', busca: '' });
    raiz.remove(); if (antes?.isConnected) antes.focus?.();
  }
  window.addEventListener('keydown', aoTeclar, true);
  window.VybeFerramentas = Object.freeze({ abrir, fechar, aberto: () => Boolean(st.raiz), _linkWhatsapp: linkWhatsapp, _numeroWhatsapp: numeroWhatsapp, _rotuloDoUso: rotuloDoUso, _retornoSimples: retornoSimples });
})();
