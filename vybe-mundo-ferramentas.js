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
  // V2 · grupo E (prancha V2-M-Toolkit, aprovada pelo Paulo em 16/11/2026): a Visão geral são três folhas, uma por
  // ferramenta, com os campos, o botão preto e o resultado no lugar; os usados por último, a dica da reunião e o atalho
  // para o Comercial ficam na consulta, no vidro. As abas de cada ferramenta seguem com tudo (resistência e cor do QR,
  // testar o link, a conta completa de ROI) dentro de uma folha. A calculadora da Visão geral é a da prancha: quantas
  // vendas pagam a Vybe (investimento, ticket e margem; a mesma conta de VybeComercialCalculos.roiCampanha).
  function contaRoi(r) {
    const calc = window.VybeComercialCalculos?.roiCampanha;
    if (calc) return calc(r);
    const inv = numero(r.investimento), tk = numero(r.ticket), mg = numero(r.margem);
    if (!inv || !tk || mg == null || mg > 100) return null;
    const lucroPorVenda = Math.round(tk * mg) / 100;
    return { investimento: inv, lucroPorVenda, empate: lucroPorVenda > 0 ? Math.ceil(inv / lucroPorVenda) : null, faturamento: null, lucro: null, roi: null };
  }
  const fraseVendas = (c) => `${c.empate == null ? 'Sem venda que pague' : `${c.empate.toLocaleString('pt-BR')} ${c.empate === 1 ? 'venda paga' : 'vendas pagam'}`} a Vybe no mês (lucro de ${din(c.lucroPorVenda)} por venda)`;
  // O resultado de cada ferramenta na Visão geral; antes de gerar, a frase que diz o que aparece ali.
  function resultadoHtml(tipo) {
    const vazio = (t, ruim = false) => `<p class="d3m-e-tk-vazio${ruim ? ' ruim' : ''}">${esc(t)}</p>`;
    if (tipo === 'qr') {
      const t = st.qr.texto.trim(), r = st.feito.qr && t ? svgQR(t) : { svg: '', erro: '' };
      if (!r.svg) return vazio(r.erro || 'O QR aparece aqui, pronto para baixar.', Boolean(r.erro));
      return `<span class="d3m-e-tk-qr">${r.svg}</span><p class="d3m-e-tk-pronto"><b>QR pronto</b><small class="d3m-e-tk-sub">${st.formato === 'svg' ? 'SVG, o melhor para a gráfica' : 'PNG de 1.200 px'}</small></p><button type="button" class="d3v-btn d3m-e-fio" data-vf="${st.formato === 'svg' ? 'svg' : 'png'}">Baixar</button>`;
    }
    if (tipo === 'wa') {
      const link = st.feito.wa ? linkWhatsapp(st.wa.numero, st.wa.mensagem) : '';
      if (!link) return vazio(st.feito.wa ? 'Número inválido: use DDD + número (10 ou 11 dígitos).' : 'O link aparece aqui, pronto para copiar.', st.feito.wa);
      return `<p class="d3m-e-tk-pronto"><b class="vf2-quebra">${esc(link.replace(/^https:\/\//, '').split('?')[0])}</b><small class="d3m-e-tk-sub">${st.wa.mensagem.trim() ? 'abre a conversa com a mensagem pronta' : 'abre a conversa'}</small></p><button type="button" class="d3v-btn d3m-e-fio v2-estado" data-vf="copiar">Copiar</button>`;
    }
    const c = st.feito.roi ? contaRoi(st.roi) : null;
    if (!c) return vazio(st.feito.roi ? 'Preencha o investimento, o ticket médio e a margem.' : 'O retorno aparece aqui, com as vendas que pagam o mês.', st.feito.roi);
    return `<b class="d3m-e-tk-num">${c.empate == null ? '–' : c.empate.toLocaleString('pt-BR')}</b><p class="d3m-e-tk-pronto"><b>${c.empate === 1 ? 'venda paga' : 'vendas pagam'} a Vybe no mês</b><small class="d3m-e-tk-sub">lucro de ${din(c.lucroPorVenda)} por venda · ${elo('conta completa', 'data-vf-aba="roi"')}</small></p><button type="button" class="d3v-btn d3m-e-fio v2-estado" data-vf="copiar-roi">Copiar</button>`;
  }
  const elo = (t, attrs) => `<button type="button" class="d3m-e-elo" ${attrs}>${esc(t)}</button>`;
  function pintarResultado(tipo) { const el = st.janela?.querySelector(`[data-vf-res="${tipo}"]`); if (el) el.innerHTML = resultadoHtml(tipo); }
  const COR_NOME = Object.fromEntries(CORES.map(([c, n]) => [c, n.toLowerCase()]));
  function abaInicio() {
    const q = norm(st.busca).trim();
    const campo = (id, rot, attr, valor, ph, tipo = 'text') => `<div class="d3m-e-tk-campo"><label class="d3m-e-tk-rot" for="${id}">${rot}</label><input id="${id}" class="d3m-e-tk-in" type="${tipo}" ${attr} value="${esc(valor)}" placeholder="${ph}"></div>`;
    const SUB = { qr: 'para peça impressa, cardápio e evento', whatsapp: 'com mensagem pronta, para bio e anúncio', roi: 'quantas vendas pagam a Vybe' };
    const cabeca = (f) => `<div class="d3m-e-tk-cab"><span class="d3m-e-tk-ico ${f.aba}" aria-hidden="true">${icone(f.ic, 14)}</span><span class="d3m-e-tk-cab-t"><b>${esc(f.nome)}</b><small class="d3m-e-tk-sub">${esc(SUB[f.aba])}</small></span><button type="button" class="d3m-e-elo" data-vf-aba="${f.aba}" title="Abrir ${esc(f.nome)} com todas as opções">mais opções</button></div>`;
    const res = (t) => `<div class="d3m-e-tk-res" data-vf-res="${t}" role="status">${resultadoHtml(t)}</div>`;
    const cartoes = {
      qr: (f) => `<section class="d3m-e-folha d3m-e-tk-fer" aria-label="${esc(f.nome)}">${cabeca(f)}
        ${campo('vf2-qr-texto', 'Link ou texto', 'data-vf-campo="qr.texto" maxlength="300"', st.qr.texto, 'https://')}
        <div class="d3m-e-tk-par"><div class="d3m-e-tk-campo"><span class="d3m-e-tk-rot" id="vf2-formato">Formato</span><span class="d3m-e-seg d3m-e-tk-seg" role="radiogroup" aria-labelledby="vf2-formato">${[['png', 'PNG'], ['svg', 'SVG']].map(([k, n]) => `<button type="button" role="radio" aria-checked="${st.formato === k}" data-vf-formato="${k}">${n}</button>`).join('')}</span></div>
          <div class="d3m-e-tk-campo"><span class="d3m-e-tk-rot">Cor</span><button type="button" class="d3m-e-tk-in d3m-e-tk-cor" data-vf-aba="qr" title="Escolher a cor nas opções do QR"><i style="background:${esc(st.qr.cor)}"></i>${esc(COR_NOME[st.qr.cor.toUpperCase()] || 'outra')}</button></div></div>
        ${res('qr')}</section>`,
      whatsapp: (f) => `<section class="d3m-e-folha d3m-e-tk-fer" aria-label="${esc(f.nome)}">${cabeca(f)}
        ${campo('vf2-wa-numero', 'Número com DDD', 'data-vf-campo="wa.numero" inputmode="tel" maxlength="20"', st.wa.numero, '(74) 90000-0000', 'tel')}
        ${campo('vf2-wa-msg', 'Mensagem pronta, se quiser', 'data-vf-campo="wa.mensagem" maxlength="500"', st.wa.mensagem, 'Olá! Quero saber mais.')}
        ${res('wa')}</section>`,
      roi: (f) => `<section class="d3m-e-folha d3m-e-tk-fer" aria-label="${esc(f.nome)}">${cabeca(f)}
        ${campo('vf2-roi-inv', 'Investimento por mês', 'data-vf-campo="roi.investimento" inputmode="decimal"', st.roi.investimento, 'R$ 1.500')}
        <div class="d3m-e-tk-par">${campo('vf2-roi-ticket', 'Ticket médio', 'data-vf-campo="roi.ticket" inputmode="decimal"', st.roi.ticket, 'R$ 180')}${campo('vf2-roi-margem', 'Margem por venda', 'data-vf-campo="roi.margem" inputmode="decimal"', st.roi.margem, '35%')}</div>
        ${res('roi')}</section>`,
    };
    const visiveis = FERRAMENTAS.filter((f) => !q || norm(`${f.nome} ${f.frase}`).includes(q));
    return visiveis.length ? `<div class="d3m-e-tk-tres" style="--n:${visiveis.length}">${visiveis.map((f) => cartoes[f.aba](f)).join('')}</div>`
      : `<section class="d3m-e-folha cresce" aria-label="Busca">${typeof d3mEEstado === 'function' ? d3mEEstado({ tipo: 'vazio', grande: true, titulo: 'Nenhuma ferramenta com esse nome', texto: 'Confira a busca: QR Code, link do WhatsApp ou calculadora de ROI.' }) : '<p class="d3m-e-tk-vazio">Nenhuma ferramenta com esse nome.</p>'}</section>`;
  }
  // A consulta no vidro: o que foi usado neste computador (refaz num clique), a dica da reunião e o atalho do Comercial.
  function ladoHtml() {
    const recentes = lerRecentes();
    const usados = recentes.length ? recentes.map((r, i) => { const n = rotuloDoUso(r);
      return `<button type="button" class="d3m-vlin" data-vf="refazer" data-vf-uso="${i}" title="Refazer: ${esc(n.sub)}"><span><b>${esc(n.titulo)}</b> · ${esc(quandoFoi(r.quando))}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`; }).join('')
      : '<p class="d3m-e-lado-txt">Nada usado ainda neste computador. O que você gerar fica guardado aqui para baixar de novo.</p>';
    return `<aside class="d3m-lado" aria-label="Consulta"><div class="d3m-cons"><div class="d3m-cons-cab"><b id="vf-recentes-titulo">Usados por último</b><span>neste computador</span></div>${usados}</div>
      ${(() => { const [t, p] = { qr: ['Para a gráfica', 'O SVG não perde qualidade em nenhum tamanho. Para banner e fachada, mande sempre ele.'], whatsapp: ['Onde usar', 'Bio do Instagram, botão do anúncio e o QR do cardápio. O texto pronto diz de onde a pessoa veio.'] }[st.aba]
        || ['Para a reunião', 'Mostre primeiro as vendas que pagam o mês: é o número que o cliente entende de cara.']; return `<div class="d3m-cons"><div class="d3m-cons-cab"><b>${t}</b></div><p class="d3m-e-lado-txt">${p}</p></div>`; })()}
      <div class="d3m-cons"><div class="d3m-cons-cab"><b>Abrir</b></div><button type="button" class="d3m-vlin" data-vf="comercial"><span><b>Comercial</b> · produtos e orçamentos</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></div></aside>`;
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
  // V2 · R (pranchas V2-R-Toolkit-QR, -WhatsApp e -ROI, aprovadas pelo Paulo): cada ferramenta numa folha de campos e
  // numa folha de resultado, que muda enquanto a pessoa escreve (sem botão de gerar nem de calcular). Os data-vf-* de
  // antes continuam (png, svg, copiar, qr-do-link, copiar-roi) e a prévia é a mesma .vf-previa trocada a cada letra.
  const NIVEL_TXT = { M: ['Padrão', 'Lê bem em tela e em peça limpa.'], Q: ['Reforçado', 'Reforçado lê mesmo com a peça amassada.'], H: ['Máximo', 'Máximo aguenta logo por cima, no meio do QR.'] };
  const cabFolha = (ic, cls, t, sub) => `<div class="d3m-r-tk-cab"><span class="d3m-e-tk-ico ${cls}" aria-hidden="true">${icone(ic, 14)}</span><span class="d3m-e-tk-cab-t"><b>${esc(t)}</b><small class="d3m-e-tk-sub">${esc(sub)}</small></span></div>`;
  const ferr = (aba) => FERRAMENTAS.find((f) => f.aba === aba) || FERRAMENTAS[0];
  const corChips = () => `${CORES.map(([c, n]) => `<button type="button" class="d3m-r-tk-chip" data-vf-cor="${c}" aria-pressed="${st.qr.cor.toUpperCase() === c}"><i style="background:${c}" aria-hidden="true"></i>${n}</button>`).join('')}<label class="d3m-r-tk-chip outra" aria-pressed="${!CORES.some(([c]) => c === st.qr.cor.toUpperCase())}" title="Outra cor (a da marca do cliente)"><input type="color" data-vf-campo="qr.cor" value="${esc(st.qr.cor)}">Outra</label>`;
  function abaQR() {
    const t = st.qr.texto.trim(), r = t ? svgQR(t) : { svg: '', erro: '' };
    return `<div class="d3m-r-tk">
      <form class="d3m-e-folha d3m-r-tk-form" data-vf-form="qr" onsubmit="return false">${cabFolha(ferr('qr').ic, 'qr', 'QR Code', 'para peça impressa, cardápio e evento')}
        <label class="d3m-r-tk-campo"><span>Link ou texto</span><span class="d3m-r-tk-in"><input type="text" data-vf-campo="qr.texto" value="${esc(st.qr.texto)}" placeholder="https://… ou o texto que o QR deve abrir" maxlength="300"><small data-vf-conta="qr.texto">${st.qr.texto.length}/300</small></span></label>
        <div class="d3m-r-tk-campo"><span id="vf-res-rot">Resistência</span><span class="d3m-r-tk-seg" role="radiogroup" aria-labelledby="vf-res-rot">${NIVEIS.map(([k]) => `<button type="button" role="radio" aria-checked="${st.qr.ecc === k}" data-vf-ecc="${k}">${NIVEL_TXT[k][0]}</button>`).join('')}</span><small class="d3m-r-tk-dica" data-vf-ecc-txt>${esc(NIVEL_TXT[st.qr.ecc]?.[1] || '')} Teste com a câmera do celular antes da gráfica.</small></div>
        <div class="d3m-r-tk-campo"><span>Cor</span><span class="d3m-r-tk-cores">${corChips()}</span><small class="d3m-r-tk-dica">Escura sobre fundo claro: cor clara demais o celular não lê.</small></div></form>
      <section class="d3m-e-folha d3m-r-tk-res" aria-label="QR pronto"><div class="d3m-e-cab"><b>Pronto para baixar</b><span class="d3m-e-cab-dir">1200 px · lê a 1 metro</span></div>
        <div class="vf-previa d3m-r-tk-previa">${r.svg ? `<div class="d3m-r-tk-qr">${r.svg}</div><small class="d3m-r-tk-url">${esc(t.replace(/^https?:\/\//, ''))}</small>
          <div class="d3m-r-tk-bts"><button type="button" class="d3v-btn" data-vf="png">Baixar PNG</button><button type="button" class="d3v-btn sec d3m-r-tk-fio" data-vf="svg">Baixar SVG para a gráfica</button></div>`
          : `<p class="d3m-r-tk-vazio${r.erro ? ' ruim' : ''}">${esc(r.erro || 'Escreva um link e o QR aparece aqui, pronto para baixar.')}</p>`}</div></section></div>`;
  }
  function abaWhatsapp() {
    const link = linkWhatsapp(st.wa.numero, st.wa.mensagem), numeroOk = !st.wa.numero || numeroWhatsapp(st.wa.numero), msg = st.wa.mensagem.trim();
    return `<div class="d3m-r-tk">
      <form class="d3m-e-folha d3m-r-tk-form" data-vf-form="wa" onsubmit="return false">${cabFolha(ferr('whatsapp').ic, 'whatsapp', 'Link do WhatsApp', 'com mensagem pronta, para bio e anúncio')}
        <label class="d3m-r-tk-campo"><span>Número com DDD</span><span class="d3m-r-tk-in"><input type="tel" inputmode="tel" data-vf-campo="wa.numero" value="${esc(st.wa.numero)}" placeholder="(74) 99999-9999" maxlength="20" aria-invalid="${!numeroOk}"></span></label>
        ${numeroOk ? '' : '<p class="vf-erro">Número inválido: use DDD + número (10 ou 11 dígitos).</p>'}<small class="d3m-r-tk-dica">Só números do Brasil; o 55 entra sozinho.</small>
        <label class="d3m-r-tk-campo"><span>Mensagem pronta · opcional</span><span class="d3m-r-tk-in"><textarea rows="4" data-vf-campo="wa.mensagem" maxlength="500" placeholder="Olá! Vi o anúncio e quero saber mais.">${esc(st.wa.mensagem)}</textarea></span></label>
        <small class="d3m-r-tk-dica" data-vf-conta="wa.mensagem">${st.wa.mensagem.length} de 500 letras</small></form>
      <section class="d3m-e-folha d3m-r-tk-res" aria-label="Link pronto"><div class="d3m-e-cab"><b>Pronto para copiar</b><span class="d3m-e-cab-dir">abre a conversa já com o texto</span></div>
        <div class="vf-previa d3m-r-tk-previa">${link ? `<p class="d3m-r-tk-link"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg><code>${esc(link.replace(/^https:\/\//, ''))}</code></p>
          <div class="d3m-r-tk-bts"><button type="button" class="d3v-btn v2-estado" data-vf="copiar">Copiar link</button><a class="d3v-btn sec d3m-r-tk-fio" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Testar</a><button type="button" class="d3v-btn sec d3m-r-tk-fio" data-vf="qr-do-link">Gerar QR deste link</button></div>
          ${msg ? `<div class="d3m-r-tk-chat"><small>Assim chega no WhatsApp</small><p>${esc(msg)}</p></div>` : ''}`
          : `<p class="d3m-r-tk-vazio${numeroOk ? '' : ' ruim'}">${numeroOk ? 'Escreva o número e o link aparece aqui, pronto para copiar.' : 'Número inválido: use DDD + número (10 ou 11 dígitos).'}</p>`}</div></section></div>`;
  }
  const din = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }));
  const dinCurto = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
  function abaRoi() {
    const r = st.roi, calc = window.VybeComercialCalculos?.roiCampanha, c = calc ? calc(r) : contaRoi(r), vd = numero(r.vendas);
    const campo = (k, rot, ph) => `<label class="d3m-r-tk-campo"><span>${rot}</span><span class="d3m-r-tk-in"><input type="text" inputmode="decimal" data-vf-campo="roi.${k}" value="${esc(r[k])}" placeholder="${ph}"></span></label>`;
    const tile = (rot, v, sub, tom = '') => `<span class="d3m-r-tk-tile"><small>${rot}</small><b class="${tom}">${v}</b><small>${sub}</small></span>`;
    const pct = c && c.empate != null && vd ? Math.max(0, Math.min(100, Math.round((c.empate / Math.max(vd, c.empate)) * 100))) : 0;
    return `<div class="d3m-r-tk">
      <form class="d3m-e-folha d3m-r-tk-form" data-vf-form="roi" onsubmit="return false">${cabFolha(ferr('roi').ic, 'roi', 'Calculadora de ROI', 'quantas vendas pagam a Vybe')}
        ${campo('investimento', 'Investimento por mês', 'R$ 1.500')}<div class="d3m-r-tk-par">${campo('ticket', 'Ticket médio', 'R$ 180')}${campo('margem', 'Margem por venda', '35%')}</div>
        ${campo('vendas', 'Vendas a mais esperadas no mês · opcional', '40')}<small class="d3m-r-tk-dica">Com este número, a conta mostra o retorno. A mesma conta está na proposta, em Comercial › Orçamentos.</small></form>
      <section class="d3m-e-folha d3m-r-tk-res" aria-label="O retorno"><div class="d3m-e-cab"><b>O retorno</b><span class="d3m-e-cab-dir">a conta para a reunião de venda</span></div>
        <div class="vf-previa d3m-r-tk-previa d3m-r-tk-roi">${c ? `<b class="d3m-r-tk-grande">${c.empate == null ? 'Nenhuma venda' : `${c.empate.toLocaleString('pt-BR')} ${c.empate === 1 ? 'venda' : 'vendas'}`}</b>
          <span class="d3m-r-tk-frase">${c.empate === 1 ? 'paga' : 'pagam'} a Vybe no mês</span><small class="d3m-r-tk-dica">${dinCurto(c.investimento)} ÷ ${din(c.lucroPorVenda)} de lucro por venda, arredondado para cima</small>
          ${vd ? `<div class="d3m-r-tk-barra"><span><span>${vd.toLocaleString('pt-BR')} vendas esperadas</span><span>${c.empate == null ? 'nenhuma paga' : `${c.empate.toLocaleString('pt-BR')} pagam o mês`}</span></span><i style="--v:${pct}%"></i></div>` : ''}
          <div class="d3m-r-tk-tiles">${tile('Lucro por venda', din(c.lucroPorVenda), `${dinCurto(numero(r.ticket))} × ${numero(r.margem)}%`)}${c.roi == null ? '' : `${tile('Faturamento', dinCurto(c.faturamento), `${vd} × ${dinCurto(numero(r.ticket))}`)}${tile('Lucro do mês', dinCurto(c.lucro), `${vd} × ${din(c.lucroPorVenda)}`)}${tile('Retorno', `${c.roi > 0 ? '' : ''}${c.roi.toLocaleString('pt-BR')}%`, `sobre ${dinCurto(c.investimento)}`, c.roi >= 0 ? 'g' : 'r')}`}</div>
          <div class="d3m-r-tk-bts d3m-r-tk-pe"><button type="button" class="d3v-btn v2-estado" data-vf="copiar-roi">Copiar o resumo</button><button type="button" class="d3v-btn sec d3m-r-tk-fio" data-vf="orcamento">Levar para o orçamento</button></div>`
          : `<p class="d3m-r-tk-vazio">${calc || window.VybeComercialCalculos ? 'Escreva o investimento, o ticket e a margem: a conta aparece aqui enquanto você digita.' : 'A calculadora ainda está carregando.'}</p>`}</div></section></div>`;
  }
  function corpoDaAba() { return st.aba === 'inicio' ? abaInicio() : st.aba === 'whatsapp' ? abaWhatsapp() : st.aba === 'roi' ? abaRoi() : abaQR(); }
  function html() {
    // As abas em pílula no vidro (a escolhida branca; grupo de botões, e não tablist, para o realce global de abas não pintá-las), a busca, a ajuda que não precisa e o Fechar: o topo do grupo E.
    const seg = `<span class="d3m-e-per d3m-e-tk-abas" role="group" aria-label="Ferramentas do Toolkit">${ABAS.map(([k, n]) => `<button type="button" aria-pressed="${st.aba === k}" data-vf-aba="${k}">${n}</button>`).join('')}</span>`;
    const busca = `<label class="d3m-e-tk-oculto" for="vf-busca">Buscar ferramenta</label><input id="vf-busca" class="d3m-e-tk-busca" type="search" placeholder="Buscar ferramenta" data-vf-busca value="${esc(st.busca)}">`;
    const fechar = `<button type="button" class="d3m-e-ico" data-vf="fechar" aria-label="Fechar" title="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    const h = '<span class="d3m-e-h" id="vf-titulo" role="heading" aria-level="2">Toolkit</span>';
    const tit = `<details class="d3m-e-troca" ontoggle="if(this.open&&typeof d3mETroca==='function')d3mETroca(this,'toolkit','toolkit')"><summary title="Trocar de tela">${h}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary><div class="d3m-e-pop" role="group" aria-label="Outras telas"></div></details>`;
    const nome = (ABAS.find(([k]) => k === st.aba) || ABAS[0])[1];
    // Cada ferramenta (pranchas V2-R-Toolkit-*): a folha de campos e a do resultado, direto no corpo; o título diz que muda sozinho.
    const main = `<div class="d3m-e-main">${st.aba === 'inicio' ? abaInicio() : corpoDaAba()}</div>`;
    const sub = { qr: `${nome} · o código muda enquanto você escreve, sem botão de gerar`, whatsapp: `${nome} · o link aparece enquanto você escreve`, roi: `${nome} · a conta muda enquanto você digita` }[st.aba]
      || 'ferramentas rápidas da Vybe · QR Code, link do WhatsApp e calculadora de ROI';
    return `<div class="d3m-e-tela d3m-e-tk" data-tk-aba="${esc(st.aba)}"><div class="d3m-e-topo"><div class="d3m-e-tit">${tit}<span class="d3m-e-sub">${esc(sub)}</span></div><div class="d3m-e-acoes">${seg}${busca}${fechar}</div></div>
      <p class="vf-aviso d3m-e-tk-aviso" role="status" aria-live="polite">${esc(st.aviso)}</p>
      <div class="vf-corpo d3m-e-corpo">${main}${ladoHtml()}</div></div>`;
  }
  function pintar(manterFoco = true) {
    if (!st.janela) return;
    const f = manterFoco ? document.activeElement?.dataset?.vfCampo : null, sel = f ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    st.janela.className = 'vc-janela d3m-e-tk-janela';
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
    // Resistência e cor do QR (prancha V2-R-Toolkit-QR): marca a escolha e troca só a prévia.
    const ecc = e.target.closest('[data-vf-ecc]');
    if (ecc) { st.qr.ecc = ecc.dataset.vfEcc; st.janela.querySelectorAll('[data-vf-ecc]').forEach((x) => x.setAttribute('aria-checked', String(x === ecc))); const tx = st.janela.querySelector('[data-vf-ecc-txt]'); if (tx) tx.textContent = `${NIVEL_TXT[st.qr.ecc][1]} Teste com a câmera do celular antes da gráfica.`; pintarPrevia(); return; }
    const cor = e.target.closest('[data-vf-cor]');
    if (cor) { st.qr.cor = cor.dataset.vfCor; marcarCor(); pintarPrevia(); return; }
    const gerar = e.target.closest('[data-vf-gerar]');
    if (gerar) {
      const t = gerar.dataset.vfGerar; st.feito[t] = true; pintarResultado(t);
      if (t === 'roi' && contaRoi(st.roi)) guardarUso('roi', { ...st.roi });
      return;
    }
    const b = e.target.closest('[data-vf]'); if (!b || b.disabled) return;
    const a = b.dataset.vf;
    // O botão conta o estado: gira e fica verde com a palavra nova (v2-estado).
    const feito = (texto) => { if (!b.classList.contains('v2-estado') || !b.isConnected) return; b.dataset.estado = 'feito'; b.innerHTML = CERTO + texto; };
    if (a === 'primeiro-qr') { st.janela.querySelector('[data-vf-campo="qr.texto"]')?.focus(); return; }
    if (a === 'copiar-roi') { const c = contaRoi(st.roi); if (c) (navigator.clipboard?.writeText(fraseVendas(c)) || Promise.reject()).then(() => { feito('Copiado'); avisar('Conta copiada.'); }, () => avisar(fraseVendas(c))); return; }
    // O atalho da consulta: o Comercial pelo próprio menu lateral (Produtos e Orçamentos ficam lá).
    if (a === 'comercial') { const item = document.querySelector?.('.vv-trilho [data-trilho="setor:comercial"]'); if (item) { fechar(); item.click(); } return; }
    // "Levar para o orçamento": a mesma conta mora na proposta (Comercial › Orçamentos); o resumo vai copiado junto.
    if (a === 'orcamento') { const c = contaRoi(st.roi); if (c) navigator.clipboard?.writeText(fraseVendas(c)).catch(() => {}); const item = document.querySelector?.('.vv-trilho [data-submodulo="orcamentos"]'); fechar(); if (item) item.click(); else window.VybeComercial?.abrir?.('orcamentos', { abas: ['orcamentos'] }); return; }
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
    // Na Visão geral, o resultado muda enquanto digita (sem botão de gerar, decisão do Paulo nas pranchas V2-R-Toolkit).
    if (st.aba === 'inicio') {
      const t = g === 'simples' ? 'roi' : g;
      st.feito[t] = t === 'qr' ? Boolean(st.qr.texto.trim()) : t === 'wa' ? Boolean(st.wa.numero.trim()) : Boolean(contaRoi(st.roi));
      pintarResultado(t);
      if (t === 'roi' && e.type === 'change' && contaRoi(st.roi)) guardarUso('roi', { ...st.roi });
      return;
    }
    // O contador de letras do campo, quando tem.
    st.janela?.querySelectorAll(`[data-vf-conta="${g}.${k}"]`).forEach((x) => { x.textContent = g === 'wa' ? `${c.value.length} de 500 letras` : `${c.value.length}/300`; });
    // A cor: a ficha escolhida fica marcada e "Outra" acende quando a cor não é da paleta.
    if (c.dataset.vfCampo === 'qr.cor') marcarCor();
    // Conta de ROI feita (ao sair do campo) entra nos usados por último.
    if (g === 'roi' && e.type === 'change' && window.VybeComercialCalculos?.roiCampanha?.(st.roi)) guardarUso('roi', { ...st.roi });
    pintarPrevia();
  }
  function marcarCor() {
    const daPaleta = CORES.some(([cor]) => cor === st.qr.cor.toUpperCase());
    st.janela?.querySelectorAll('[data-vf-cor]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.vfCor === st.qr.cor.toUpperCase())));
    st.janela?.querySelector('.d3m-r-tk-chip.outra')?.setAttribute('aria-pressed', String(!daPaleta));
    const outra = st.janela?.querySelector('.d3m-r-tk-chip.outra > input'); if (outra && daPaleta) outra.value = st.qr.cor;
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
    (st.aba === 'inicio' ? st.janela.querySelector('[data-vf-aba][aria-pressed="true"]') : st.janela.querySelector('[data-vf-campo]'))?.focus();
  }
  function fechar() {
    const { raiz, antes } = st; if (!raiz) return;
    Object.assign(st, { raiz: null, janela: null, antes: null, aviso: '', busca: '' });
    raiz.remove(); if (antes?.isConnected) antes.focus?.();
  }
  window.addEventListener('keydown', aoTeclar, true);
  window.VybeFerramentas = Object.freeze({ abrir, fechar, aberto: () => Boolean(st.raiz), _linkWhatsapp: linkWhatsapp, _numeroWhatsapp: numeroWhatsapp, _rotuloDoUso: rotuloDoUso, _retornoSimples: retornoSimples });
})();
