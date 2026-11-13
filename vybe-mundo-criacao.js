// vybe-mundo-criacao.js — O assistente do Deivid na aba Criação do Hoje (Deivid, pelo Paulo, 10/11/2026: "o que temos para
// hoje?"; a ordem de execução, o que delegar e para quem, quem cobrar, o que é demanda e o que é sugestão; "nada é executado
// sem o meu OK").
//
// Não é outro painel nem outra fila: o desenho continua em pintarCriacao (vybe-mundo.js) e a ordem é a do guia
// (passosDoGuia). Aqui ficam só as contas e as caixas de aprovar:
//   - perfis: o que cada pessoa do time fez (formato e cliente, 90 dias), em quanto tempo (cadastro → entrega, como na
//     Performance) e a carga de agora pelo peso do formato do painel antigo de direção de arte (daEffortWeight e o limite
//     de daCapacitySignal, passados por quem chama: a regra é uma só).
//   - delegações: peça ainda não começada de quem está acima do limite (ou da mesa do Deivid) para quem é da mesma
//     disciplina, tem folga e mais fez aquele formato e aquele cliente. Aprovar grava pelo gravarResponsaveisDaPeca; "Ver
//     antes" abre a peça no VybePeca com a sugestão preenchida.
//   - cobranças: peça parada no mesmo status ou com prazo vencido e a data do cliente chegando. Aprovar manda a cobrança
//     pelo WhatsApp (Paulo, 10/11/2026: "o bot cobra de verdade"): o painel pede em area=cobrancas
//     (server/cobrancas-whatsapp.js), o VYBES busca o pedido e o agente dono da cobrança (Danilo no design, Lucas no
//     audiovisual) manda no privado da pessoa. A caixa mostra se foi ou se falhou; se falhou, dá para copiar a mensagem.
//     A cobrança também fica no histórico da peça (postItemUpdate).
//   - clientes: confirmado (as peças abertas do time) × sugestão (regras do painel e os achados do Danilo na central,
//     pela mesma rota do perfil da página Agentes). Sugestão nunca vira demanda daqui.
//   - mudanças: o que mudou desde a última vez que ele marcou "Entendi" (guardado só neste navegador).
// Nada grava sem dois cliques (Aprovar → Confirmar); o servidor confere a permissão de quem está logado.
(() => {
  const G = window;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const somar = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
  const soDia = (v) => { const s = String(v || ''); if (ISO.test(s)) return s; const d = new Date(s); return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(d) : ''; };
  const dm = (iso) => (ISO.test(String(iso || '')) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
  const mediana = (l) => { const v = l.filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const primeiro = (nome) => String(nome || '').split(' ')[0];

  // ---------- regras (funções puras; os testes chamam direto) ----------
  const idsDe = (d) => [...new Set([...(Array.isArray(d?.responsavel_ids) ? d.responsavel_ids : []), d?.responsavel_id].filter((x) => x != null && x !== '').map(String))];
  const clientesDe = (d) => [...new Set((Array.isArray(d?.clientes) && d.clientes.length ? d.clientes : [d?.cliente]).map((c) => String(c || '').trim()).filter((c) => c && c !== 'Sem cliente'))];
  const formatoDe = (d) => String(d?.formato || '').trim() || 'Sem formato';
  const ehVideo = (d) => /reels|v[ií]deo|motion|anima/i.test(`${d?.formato || ''} ${d?.nome || ''}`);
  const disciplinaDaPeca = (d) => (ehVideo(d) ? 'audiovisual' : 'design');
  const veic = (d) => String(d?.veiculacao_iso || '');
  const tipoDoStatus = (st) => {
    const s = norm(st);
    if (/altera|ajuste|corre/.test(s)) return 'ajuste'; if (/aprova/.test(s)) return 'aprovar';
    if (/info|briefing|aguard|cliente|material/.test(s)) return 'esperando'; if (/andamento|produ/.test(s)) return 'fazendo';
    if (/pode fazer|a fazer|fazer|novo|backlog/.test(s)) return 'naoComecou'; return 'outro';
  };

  // Perfil de cada pessoa: { id, nome, disciplina, carga, limite, abertas, entregues, porFormato, porCliente, dias }.
  function perfis({ todas = [], time = [], hoje, peso, limite, finalizada, janela = 90 }) {
    const corte = somar(hoje, -(janela - 1));
    return time.map((u) => {
      const id = String(u.id), minhas = todas.filter((d) => idsDe(d).includes(id));
      const abertas = minhas.filter((d) => !finalizada(d)), feitas = minhas.filter((d) => finalizada(d) && soDia(d.status_updated_at) >= corte && soDia(d.status_updated_at) <= hoje);
      const porFormato = {}, porCliente = {};
      for (const d of feitas) { porFormato[formatoDe(d)] = (porFormato[formatoDe(d)] || 0) + 1; for (const c of clientesDe(d)) porCliente[c] = (porCliente[c] || 0) + 1; }
      const tempos = feitas.map((d) => { const a = soDia(d.criado_em), b = soDia(d.status_updated_at); return a && b && a <= b ? diasEntre(a, b) : NaN; });
      return { id, nome: u.name || u.nome || '', disciplina: u.disciplina || 'design', carga: abertas.reduce((s, d) => s + Number(peso(d, u) || 1), 0), limite: Number(limite(u)) || 14,
        abertas: abertas.length, entregues: feitas.length, porFormato, porCliente, dias: mediana(tempos) };
    });
  }

  // Quem melhor recebe a peça: mesma disciplina, não está nela, cabe na folga; mais experiência no formato e no cliente.
  function melhorPara(d, lista, { peso, excluir = [] }) {
    const disc = disciplinaDaPeca(d), fmt = formatoDe(d), clis = clientesDe(d), ja = idsDe(d);
    const cands = lista.filter((p) => p.disciplina === disc && !ja.includes(p.id) && !excluir.includes(p.id))
      .map((p) => { const w = Number(peso(d, { id: p.id }) || 1); return { p, w, xp: (p.porFormato[fmt] || 0) + 2 * clis.reduce((s, c) => s + (p.porCliente[c] || 0), 0) }; })
      .filter((c) => c.p.carga + c.w <= c.p.limite);
    cands.sort((a, b) => (b.xp - b.p.carga / b.p.limite * 6) - (a.xp - a.p.carga / a.p.limite * 6) || (a.p.dias ?? 99) - (b.p.dias ?? 99));
    return cands[0] || null;
  }

  // [{ chave, id, nome, cliente, de: {id,nome}, para: {id,nome}, porque, prazo }], no máximo `max`, sem lotar ninguém.
  function sugerirDelegacoes({ itens = [], perfis: lista = [], hoje, peso, deivid = '', max = 4 }) {
    const sim = lista.map((p) => ({ ...p })), porId = Object.fromEntries(sim.map((p) => [p.id, p])), out = [];
    const fontes = sim.filter((p) => p.carga > p.limite || p.id === String(deivid)).sort((a, b) => (b.id === String(deivid)) - (a.id === String(deivid)) || b.carga / b.limite - a.carga / a.limite);
    for (const de of fontes) {
      const delas = itens.filter((x) => x.ids.includes(de.id) && new Set(x.ids.map(String).filter((i) => porId[i])).size === 1 && tipoDoStatus(x.d.status) === 'naoComecou')
        .sort((a, b) => Number(peso(a.d, { id: de.id })) - Number(peso(b.d, { id: de.id })) || (veic(a.d) || '9').localeCompare(veic(b.d) || '9'));
      for (const x of delas) {
        if (out.length >= max) return out;
        if (de.id !== String(deivid) && de.carga <= de.limite) break;
        const m = melhorPara(x.d, sim, { peso, excluir: [String(deivid)] }); if (!m) continue;
        const fmt = formatoDe(x.d), cli = clientesDe(x.d)[0] || '', expF = m.p.porFormato[fmt] || 0, expC = cli ? m.p.porCliente[cli] || 0 : 0;
        const motivoDe = de.id === String(deivid) ? `${primeiro(de.nome)} fica livre para a direção de arte` : `${primeiro(de.nome)} está com ${de.carga} de ${de.limite} pontos de carga`;
        const exp = [expF ? `já fez ${plural(expF, fmt === 'Sem formato' ? 'peça' : fmt, fmt === 'Sem formato' ? 'peças' : fmt)}` : '', expC ? `${plural(expC, 'peça', 'peças')} de ${cli}` : ''].filter(Boolean).join(' e ');
        out.push({ chave: `delegar:${x.d.id}:${m.p.id}`, id: String(x.d.id), nome: String(x.d.nome || 'Peça'), cliente: cli, formato: fmt, de: { id: de.id, nome: de.nome }, para: { id: m.p.id, nome: m.p.nome },
          porque: `${motivoDe}; ${primeiro(m.p.nome)} tem folga (${m.p.carga} de ${m.p.limite})${exp ? ' e ' + exp + ' em 90 dias' : ''}${m.p.dias != null ? ` · entrega em ${String(m.p.dias).replace('.', ',')} dias (mediana)` : ''}.`,
          vaiAoAr: veic(x.d) });
        de.carga -= m.w; m.p.carga += m.w;
      }
    }
    return out;
  }

  // [{ chave, id, nome, cliente, quem: [nomes], oque, quando, destravar, parado, mensagem }]
  function sugerirCobrancas({ itens = [], hoje, agora = new Date(), max = 5, diasParado = 2 }) {
    const out = [];
    for (const x of itens) {
      const d = x.d, tipo = tipoDoStatus(d.status), v = veic(d);
      if (tipo === 'aprovar' || !x.quem?.length) continue;
      const parado = soDia(d.status_updated_at) ? diasEntre(soDia(d.status_updated_at), hoje) : null;
      const prazoVencido = ISO.test(String(d.prazo_iso || '')) && d.prazo_iso < hoje;
      const chegando = v && v <= somar(hoje, 5);
      if (!((parado != null && parado >= diasParado && chegando) || (prazoVencido && (!v || v >= hoje || x.sit === 'atrasada')))) continue;
      const oque = { ajuste: 'devolver o ajuste', fazendo: 'mandar a prévia', naoComecou: 'começar a peça', esperando: 'dizer o que falta para começar' }[tipo] || 'dizer em que pé está';
      const quando = !v || v <= somar(hoje, 1) ? 'agora' : v <= somar(hoje, 3) ? (agora.getHours() < 14 ? 'hoje até as 14h' : 'até o fim do dia') : 'amanhã cedo';
      const destravar = tipo === 'esperando' ? 'Falta informação: puxe com o head do cliente antes de cobrar o time.'
        : tipo === 'ajuste' ? 'Confira se o pedido de ajuste está claro na peça.'
          : parado >= 4 ? 'Parada há muito tempo: pergunte se está travada em algo (briefing, material, outra peça na frente).' : 'Combine a hora da prévia.';
      const por = [parado != null && parado >= diasParado ? `parada há ${plural(parado, 'dia', 'dias')} em ${d.status || 'sem status'}` : '', prazoVencido ? `prazo venceu em ${dm(d.prazo_iso)}` : '', v ? `vai ao ar ${v === hoje ? 'hoje' : v < hoje ? 'em ' + dm(v) + ' (já passou)' : dm(v)}` : ''].filter(Boolean).join(' · ');
      out.push({ chave: `cobrar:${d.id}:${hoje}`, id: String(d.id), nome: String(d.nome || 'Peça'), cliente: clientesDe(d)[0] || '', quem: x.quem, para: (Array.isArray(x.para) ? x.para : x.ids || []).map(String), oque, quando, destravar, parado, por, vaiAoAr: v,
        mensagem: `${x.quem.join(' e ')}, sobre "${String(d.nome || 'a peça').trim()}"${clientesDe(d)[0] ? ' (' + clientesDe(d)[0] + ')' : ''}: ${por}. Consegue ${oque} ${quando}?` });
    }
    return out.sort((a, b) => (a.vaiAoAr || '9').localeCompare(b.vaiAoAr || '9')).slice(0, max);
  }

  // Por cliente: { cliente, confirmadas: [{id,nome,status}], sugestoes: [{texto, origem: 'regra'|'danilo', ref}] }.
  function clientesConfirmadoSugestao({ itens = [], todas = [], achados = [], hoje, finalizada }) {
    const m = new Map(), pegar = (c) => { if (!m.has(c)) m.set(c, { cliente: c, confirmadas: [], sugestoes: [] }); return m.get(c); };
    for (const x of itens) for (const c of clientesDe(x.d)) pegar(c).confirmadas.push({ id: String(x.d.id), nome: String(x.d.nome || 'Peça'), status: String(x.d.status || '') });
    const ate7 = somar(hoje, 6), de30 = somar(hoje, -30), de90 = somar(hoje, -90);
    for (const c of m.keys()) {
      const doCli = todas.filter((d) => clientesDe(d).includes(c)), r = pegar(c);
      const noAr = doCli.filter((d) => veic(d) >= hoje && veic(d) <= ate7).length, antes = doCli.filter((d) => veic(d) >= de30 && veic(d) < hoje).length;
      if (!noAr && antes >= 4) r.sugestoes.push({ origem: 'regra', texto: `Nada marcado para ir ao ar até ${dm(ate7)} (foram ${antes} peças nos últimos 30 dias): vale antecipar uma peça.` });
      const ajustes = r.confirmadas.filter((p) => tipoDoStatus(p.status) === 'ajuste').length;
      if (ajustes >= 2) r.sugestoes.push({ origem: 'regra', texto: `${ajustes} peças voltaram para ajuste: vale um template ou um guia visual do cliente para errar menos.` });
      const reelsAbertos = itens.filter((x) => clientesDe(x.d).includes(c) && ehVideo(x.d)).length;
      if (reelsAbertos >= 3) r.sugestoes.push({ origem: 'regra', texto: `${reelsAbertos} vídeos em aberto: padronizar as capas de Reels numa série só.` });
      const videoRecente = doCli.some((d) => ehVideo(d) && (veic(d) >= de30 || !finalizada(d))), videoAntes = doCli.filter((d) => ehVideo(d) && veic(d) >= de90 && veic(d) < de30).length;
      if (!videoRecente && videoAntes >= 2) r.sugestoes.push({ origem: 'regra', texto: `Sem Reels há 30 dias (teve ${videoAntes} antes disso): sugerir um ao head.` });
    }
    for (const a of achados) {
      const c = String(a?.cliente || '').trim(); if (!c) continue;
      pegar(c).sugestoes.push({ origem: 'danilo', texto: [a.fato, a.sugestao].filter(Boolean).join(' · '), ref: /^vybe:\d+$/.test(String(a.ref || '')) ? String(a.ref) : '', chave: a.chave || '' });
    }
    return [...m.values()].sort((a, b) => b.sugestoes.length - a.sugestoes.length || b.confirmadas.length - a.confirmadas.length || a.cliente.localeCompare(b.cliente));
  }

  // O que mudou desde a foto que ele marcou como vista: { novasAtrasadas, novosAjustes, novaPrimeira }.
  const foto = (ordem) => ({ primeira: ordem[0] ? String(ordem[0].d.id) : '', pecas: Object.fromEntries(ordem.map((x) => [String(x.d.id), [x.sit === 'atrasada' ? 1 : 0, tipoDoStatus(x.d.status) === 'ajuste' ? 1 : 0, String(x.d.nome || 'Peça')]])) });
  function mudancas(antes, agora) {
    if (!antes?.pecas) return { novasAtrasadas: [], novosAjustes: [], novaPrimeira: '' };
    const novas = (i) => Object.entries(agora.pecas).filter(([id, v]) => v[i] && !(antes.pecas[id] || [])[i]).map(([id, v]) => ({ id, nome: v[2] }));
    return { novasAtrasadas: novas(0), novosAjustes: novas(1), novaPrimeira: agora.primeira && agora.primeira !== antes.primeira ? agora.primeira : '' };
  }

  // A conversa: frases de guia em ordem ("primeiro..., depois..., enquanto isso...").
  function frasesDoDia({ ordem = [], motivo = () => '', aprovar = [], delegacoes = [], cobrancas = [], minhas = [], antecipar = null, deHoje = 0, atrasadas = 0, souDeivid = true, hoje }) {
    const tit = (x) => `<b>${esc(String(x.d?.nome || x.nome || 'Peça').trim())}</b>${(clientesDe(x.d || {})[0] || x.cliente) ? ' (' + esc(clientesDe(x.d || {})[0] || x.cliente) + ')' : ''}`;
    const f = [];
    if (!ordem.length) return ['O time está sem peças em aberto. Bom momento para olhar as sugestões dos clientes abaixo.'];
    f.push(`Hoje ${deHoje ? `${plural(deHoje, 'peça do time vai', 'peças do time vão')} ao ar` : 'nada do time vai ao ar'}${atrasadas ? `, e ${plural(atrasadas, 'está atrasada', 'estão atrasadas')}` : ''}${aprovar.length ? `; ${plural(aprovar.length, 'espera', 'esperam')} aprovação` : ''}.`);
    // Peça do topo que também está para delegar: o primeiro passo é passar adiante, não fazer.
    const delTopo = delegacoes.find((s) => String(s.id) === String(ordem[0].d?.id));
    f.push(`Primeiro, ${tit(ordem[0])}: ${esc(motivo(ordem[0]).toLowerCase())}${delTopo ? `; passe para <b>${esc(primeiro(delTopo.para.nome))}</b> (aprove abaixo)` : ordem[0].quem?.length ? ', com ' + esc(ordem[0].quem.join(' e ')) : ''}.`);
    const prox = aprovar[0] && aprovar[0] !== ordem[0] ? aprovar[0] : ordem[1];
    if (prox) f.push(`Depois, ${aprovar[0] === prox ? 'confira e aprove' : 'siga para'} ${tit(prox)}${aprovar[0] === prox ? '' : ': ' + esc(motivo(prox).toLowerCase())}.`);
    const outras = delegacoes.filter((s) => s !== delTopo);
    if (outras[0]) f.push(`Enquanto isso, passe ${tit(outras[0])} de ${esc(primeiro(outras[0].de.nome))} para <b>${esc(primeiro(outras[0].para.nome))}</b>${outras.length > 1 ? ` (e mais ${outras.length - 1} abaixo)` : ''}.`);
    if (cobrancas[0]) f.push(`Cobre ${esc(cobrancas[0].quem.join(' e '))} ${esc(cobrancas[0].quando)} sobre ${tit(cobrancas[0])}: ${esc(cobrancas[0].oque)}.`);
    if (minhas.length) f.push(`${souDeivid ? 'Na sua mesa' : 'Na mesa do Deivid'}: ${plural(minhas.length, 'peça', 'peças')}; a próxima é ${tit(minhas[0])}.`);
    if (antecipar) f.push(`Se sobrar tempo, adiante ${tit(antecipar)} (vai ao ar ${esc(dm(veic(antecipar.d)))}).`);
    return f;
  }
  const util = { idsDe, clientesDe, disciplinaDaPeca, tipoDoStatus, perfis, melhorPara, sugerirDelegacoes, sugerirCobrancas, clientesConfirmadoSugestao, mudancas, foto, frasesDoDia };

  // ---------- estado (neste navegador) e leitura dos achados do Danilo ----------
  const st = { confirmando: '', gravando: '', msg: {}, feitas: new Set(), achados: { lista: [], erro: '', em: 0, lendo: null }, cob: { lista: [], erro: '', em: 0, lendo: null, relogio: null, voltas: 0 }, conversa: { texto: '', fala: '', erro: '', enviando: false } };
  const hojeIso = () => (typeof G.hojeDeVerdade === 'function' ? G.hojeDeVerdade() : new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' }));
  const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? padrao; } catch { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* fica só nesta tela */ } };
  const adiadas = () => { const a = ler('vybe.criacao.adiadas', null); return a?.dia === hojeIso() ? new Set(a.chaves || []) : new Set(); };
  const repintar = () => document.dispatchEvent(new CustomEvent('vybe:criacao'));
  const souDono = () => { try { return typeof G.souDonoDaSessao === 'function' && G.souDonoDaSessao(); } catch { return false; } };
  function lerAchados() {
    const a = st.achados;
    if (!souDono() || a.lendo || Date.now() - a.em < 5 * 60e3) return;
    a.em = Date.now();
    a.lendo = fetch('/api/painel?area=vybes&etapa=perfil&setor=design', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || !d.perfil) throw new Error(d.error || 'a central não respondeu'); a.lista = Array.isArray(d.perfil.achados?.abertos) ? d.perfil.achados.abertos : []; a.erro = ''; })
      .catch((e) => { a.erro = e.message || 'a central não respondeu'; }).finally(() => { a.lendo = null; repintar(); });
  }

  // Cobranças pelo WhatsApp de hoje (area=cobrancas): pedido → enviando → enviado ou falhou. Enquanto alguma espera o bot,
  // relê a cada 15 s (até 10 min); depois, só a cada 5 min ou quando o Deivid cobra de novo.
  const esperando = (r) => r.estado === 'pedido' || r.estado === 'enviando';
  const daPeca = (s) => st.cob.lista.filter((r) => r.ref === s.id || String(r.conteudo_id) === s.id || 'vybe:' + r.conteudo_id === s.id);
  function lerCobrancas(forcar = false) {
    const c = st.cob;
    if (!souDono() || c.lendo || (!forcar && Date.now() - c.em < 5 * 60e3)) return;
    c.em = Date.now();
    c.lendo = fetch('/api/painel?area=cobrancas', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'o painel não respondeu'); c.lista = Array.isArray(d.cobrancas) ? d.cobrancas : []; c.erro = ''; })
      .catch((e) => { c.erro = e.message || 'o painel não respondeu'; }).finally(() => { c.lendo = null; vigiarCobrancas(); repintar(); });
  }
  function vigiarCobrancas() {
    const c = st.cob; clearTimeout(c.relogio); c.relogio = null;
    if (!c.lista.some(esperando)) { c.voltas = 0; return; }
    if (c.voltas >= 40) return;
    c.relogio = setTimeout(() => { c.voltas++; lerCobrancas(true); }, 15e3);
  }
  const hora = (iso) => { const d = new Date(iso); return iso && Number.isFinite(d.getTime()) ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' }) : ''; };
  // Uma linha por pessoa cobrada: quem mandou (o agente), para quem e o que houve.
  const linhaDaCobranca = (r) => (r.estado === 'enviado' ? { texto: `${r.agente} mandou para ${primeiro(r.pessoa)} no WhatsApp${hora(r.resolvido_em) ? ' às ' + hora(r.resolvido_em) : ''}.` }
    : r.estado === 'falhou' ? { erro: true, texto: `Não foi para ${primeiro(r.pessoa)}: ${r.motivo || 'o bot não conseguiu enviar.'}` }
      : { espera: true, texto: `${r.agente} vai mandar para ${primeiro(r.pessoa)} no WhatsApp. Aguardando o bot…` });

  // ---------- desenho (pintarCriacao chama; o resto da aba continua lá) ----------
  const cli = (c) => (typeof G.cliCor === 'function' ? G.cliCor(c) : esc(c));
  function caixa({ chave, tipo, titulo, cliente, linhas, aprovar, verAntes = '', envios = [], pilula = null }) {
    // Padrão v2 (quadro "Direção de arte", 12/11/2026): a etiqueta diz o que é (Delegar em lilás, parada em vermelho, hoje em amarelo).
    const etiqueta = (padrao) => `<i class="vcr-pill ${pilula?.[1] || (tipo === 'delegar' ? 'v' : 'a')}">${esc(pilula?.[0] || padrao)}</i>`;
    const conf = st.confirmando === chave, grav = st.gravando === chave, m = st.msg[chave];
    // Cobrança já pedida hoje: a caixa mostra o que houve com cada envio; só volta a ter botão se algum falhou.
    if (envios.length && !conf && !grav) {
      const falhou = envios.some((r) => r.estado === 'falhou');
      return `<li class="vcr-sug" data-vcr-tipo="${tipo}"><div class="vcr-sug-meio"><small>${etiqueta('Cobrar')}${cliente ? cli(cliente) : ''}</small><b>${titulo}</b>${linhas.map((l) => `<span>${l}</span>`).join('')}
        ${envios.map(linhaDaCobranca).map((l) => `<p class="vcr-msg${l.erro ? ' erro' : l.espera ? ' espera' : ''}" role="status">${esc(l.texto)}</p>`).join('')}${m ? `<p class="vcr-msg${m.erro ? ' erro' : ''}" role="status">${esc(m.texto)}</p>` : ''}</div>
      <div class="vcr-sug-acoes">${falhou ? `<button type="button" class="vc-acao" data-vcr-aprovar="${esc(chave)}">Tentar de novo</button><button type="button" class="vc-sec" data-vcr-copiar="${esc(chave)}" title="Para você mesmo mandar">Copiar a mensagem</button>` : ''}</div></li>`;
    }
    return `<li class="vcr-sug" data-vcr-tipo="${tipo}"><div class="vcr-sug-meio"><small>${etiqueta(tipo === 'delegar' ? 'Delegar' : 'Cobrar')}${cliente ? cli(cliente) : ''}</small><b>${titulo}</b>${linhas.map((l) => `<span>${l}</span>`).join('')}
        ${m ? `<p class="vcr-msg${m.erro ? ' erro' : ''}" role="status">${esc(m.texto)}</p>` : ''}</div>
      <div class="vcr-sug-acoes">${conf ? `<span class="vcr-conf">${aprovar.confirmar}</span><button type="button" class="vc-acao" data-vcr-confirmar="${esc(chave)}" ${grav ? 'disabled' : ''}>${grav ? 'Gravando…' : 'Confirmar'}</button><button type="button" class="vc-sec" data-vcr-voltar ${grav ? 'disabled' : ''}>Voltar</button>`
        : `<button type="button" class="vc-acao" data-vcr-aprovar="${esc(chave)}">${aprovar.rotulo}</button>${verAntes}<button type="button" class="vc-sec" data-vcr-adiar="${esc(chave)}" title="Some só hoje, neste navegador">${tipo === 'delegar' ? 'Deixar como está' : 'Agora não'}</button>`}</div></li>`;
  }
  let ultimas = { delegacoes: [], cobrancas: [], foto: null };
  // Pergunta livre: a mesma rota do módulo VYBES (etapa=perguntar → /api/cosmos/sala na central, respondida pelo Qwen).
  function perguntaHtml() {
    const c = st.conversa;
    return `${c.texto ? `<p class="vcr-pergunta"><span>${esc(c.texto)}</span></p>` : ''}${c.enviando ? '<div class="vcr-resposta vcr-pensando" role="status"><p>A central está pensando…</p></div>' : c.fala ? `<div class="vcr-resposta" role="status"><p>${esc(c.fala)}</p></div>` : c.erro ? `<p class="vcr-msg erro" role="alert">${esc(c.erro)} <button type="button" class="vg-link" data-vcr-reperguntar>Tentar de novo</button></p>` : ''}
      <form class="vcr-perguntar" data-vcr-perguntar><label class="vcr-oculto" for="vcr-pergunta">Pergunte ao Danilo</label><input id="vcr-pergunta" name="texto" maxlength="380" autocomplete="off" placeholder="Pergunte ao Danilo" title="Ex.: quem pode pegar um Reels da VOA amanhã?" value="${esc(c.rascunho || '')}" ${c.enviando ? 'disabled' : ''}><button type="submit" class="vc-sec" ${c.enviando ? 'disabled' : ''}>Perguntar</button></form>`;
  }
  async function perguntar(texto) {
    const c = st.conversa, t = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 380); if (!t || c.enviando) return;
    Object.assign(c, { texto: t, fala: '', erro: '', enviando: true, rascunho: '' }); repintar();
    try {
      const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa: 'perguntar', texto: `Danilo, direção de arte: ${t}` }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'A central não respondeu agora.');
      if (!String(d.fala || '').trim()) throw new Error('A central respondeu vazio.');
      c.fala = String(d.fala);
    } catch (e) { c.erro = `${e?.message || 'A central não respondeu agora.'}`; }
    finally { c.enviando = false; repintar(); }
  }
  document.addEventListener('input', (e) => { if (e.target?.id === 'vcr-pergunta') st.conversa.rascunho = e.target.value; });
  document.addEventListener('submit', (e) => { const f = e.target.closest?.('[data-vcr-perguntar]'); if (!f) return; e.preventDefault(); perguntar(new FormData(f).get('texto')); });
  // ctx: { itens, todas, ordem, motivo, aprovar, deHoje, atrasadas, membros, peso, limite, finalizada, eu }
  function assistente(ctx) {
    lerAchados(); lerCobrancas();
    const hoje = hojeIso(), deivid = String(G.PESSOAS?.DEIVID || (typeof PESSOAS !== 'undefined' ? PESSOAS.DEIVID : '') || '');
    const audio = (typeof EQUIPES !== 'undefined' ? EQUIPES.audiovisual : []).map(String);
    const time = ctx.membros.map((u) => ({ ...u, disciplina: audio.includes(String(u.id)) ? 'audiovisual' : 'design' }));
    const lista = perfis({ todas: ctx.todas, time, hoje, peso: ctx.peso, limite: ctx.limite, finalizada: ctx.finalizada });
    const fora = adiadas(), visivel = (s) => !fora.has(s.chave) && !st.feitas.has(s.chave);
    const delegacoes = sugerirDelegacoes({ itens: ctx.itens, perfis: lista, hoje, peso: ctx.peso, deivid }).filter(visivel);
    // O Deivid não cobra a si mesmo: o que é só dele fica em "na sua mesa".
    const nomeDeivid = primeiro(ctx.membros.find((u) => String(u.id) === deivid)?.name || '');
    const cobrancas = sugerirCobrancas({ itens: ctx.itens.map((x) => ({ ...x, quem: (x.quem || []).filter((n) => !nomeDeivid || n !== nomeDeivid),
      para: ctx.membros.map((u) => String(u.id)).filter((id) => id !== deivid && (x.ids || []).map(String).includes(id)) })), hoje }).filter(visivel);
    const minhas = ctx.ordem.filter((x) => x.ids.includes(deivid));
    const antecipar = ctx.ordem.find((x) => tipoDoStatus(x.d.status) === 'naoComecou' && veic(x.d) >= somar(hoje, 2) && veic(x.d) <= somar(hoje, 5)) || null;
    const frases = frasesDoDia({ ordem: ctx.ordem, motivo: ctx.motivo, aprovar: ctx.aprovar, delegacoes, cobrancas, minhas, antecipar, deHoje: ctx.deHoje, atrasadas: ctx.atrasadas, souDeivid: String(ctx.eu) === deivid, hoje });
    const agora = foto(ctx.ordem); let base = ler('vybe.criacao.visto', null);
    if (!base || base.dia !== hoje) { base = { dia: hoje, ...agora }; gravar('vybe.criacao.visto', base); }
    const mud = mudancas(base, agora);
    ultimas = { delegacoes, cobrancas, foto: agora };
    const nomeDe = (id) => esc(agora.pecas[id]?.[2] || 'Peça');
    const avisos = [mud.novaPrimeira ? `<b>${nomeDe(mud.novaPrimeira)}</b> passou para o 1º lugar` : '', ...mud.novosAjustes.map((p) => `entrou ajuste em <b>${esc(p.nome)}</b>`), ...mud.novasAtrasadas.map((p) => `<b>${esc(p.nome)}</b> atrasou`)].filter(Boolean);
    const mudouHtml = avisos.length ? `<div class="vcr-mudou" role="status"><span><b>Mudou desde que você olhou:</b> ${avisos.slice(0, 4).join('; ')}${avisos.length > 4 ? `; e mais ${avisos.length - 4}` : ''}. A ordem acima já está refeita.</span><button type="button" class="vc-sec" data-vcr-visto>Entendi</button></div>` : '';
    const conversa = `<div class="vcr-conversa"><p class="vcr-pergunta"><span>O que temos para hoje?</span></p><div class="vcr-resposta">${frases.map((t) => `<p>${t}</p>`).join('')}</div>
      ${perguntaHtml()}
      <p class="vcr-nota">A ordem acima sai das regras do painel (a mesma do guia), na hora e mesmo com a central fora do ar. A pergunta livre vai para a central do VYBES, que responde pelo Qwen. Nada muda sem o seu OK.</p></div>`;
    const pessoa = (p) => esc(primeiro(p.nome));
    const sugHtml = [...delegacoes.map((s) => caixa({ chave: s.chave, tipo: 'delegar', cliente: s.cliente, titulo: `${esc(s.nome)}: de ${pessoa(s.de)} para ${pessoa(s.para)}`,
        linhas: [esc(s.porque), s.vaiAoAr ? (s.vaiAoAr < hoje ? `Ia ao ar ${esc(dm(s.vaiAoAr))} (já passou).` : `Vai ao ar ${esc(s.vaiAoAr === hoje ? 'hoje' : dm(s.vaiAoAr))}.`) : 'Sem data do cliente.'],
        aprovar: { rotulo: 'Aprovar', confirmar: `Tirar ${pessoa(s.de)} e pôr ${pessoa(s.para)} na peça?` },
        verAntes: `<button type="button" class="vc-sec" data-vcr-ver="${esc(s.chave)}">Ver antes</button>` })),
      ...cobrancas.map((s) => caixa({ chave: s.chave, tipo: 'cobrar', cliente: s.cliente, titulo: `${esc(s.quem.join(' e '))}: ${esc(s.oque)} em ${esc(s.nome)}`,
        linhas: [`${esc(s.por)}. Cobrar ${esc(s.quando)}.`, esc(s.destravar)],
        pilula: s.parado != null && s.parado >= 2 ? [`Parada ${plural(s.parado, 'dia', 'dias')}`, 'r'] : s.vaiAoAr === hoje ? ['Hoje', 'a'] : ['Cobrar', 'a'],
        envios: daPeca(s), aprovar: { rotulo: 'Cobrar', confirmar: `Mandar a cobrança no WhatsApp de ${esc(s.quem.join(' e '))} e deixar no histórico da peça?` } }))].join('');
    // Quem passou do limite sem ninguém com folga na mesma disciplina: não há para quem passar; o caminho é o prazo.
    const lotados = lista.filter((p) => p.carga > p.limite);
    const semPara = lotados.filter((p) => !delegacoes.some((d) => d.de.id === p.id) && !lista.some((q) => q.disciplina === p.disciplina && q.id !== p.id && q.id !== deivid && q.carga < q.limite));
    const lotadosHtml = semPara.length ? `<p class="vcr-lotado"><b>Acima do limite sem ter para quem passar:</b> ${semPara.map((p) => `${esc(primeiro(p.nome))} (${p.carga} de ${p.limite})`).join(', ')}. Vale renegociar prazo com o head ou segurar peça nova.</p>` : '';
    const sugestoes = `<section class="vs-bloco vcr-bloco vcr-fila" aria-label="Fila do Danilo"><div class="vs-bloco-cabeca"><span><b>Fila do Danilo</b><small>${plural(delegacoes.length, 'delegação', 'delegações')} · ${plural(cobrancas.length, 'cobrança', 'cobranças')}</small></span></div>
      ${lotadosHtml}${sugHtml ? `<ul class="vcr-sugs">${sugHtml}</ul>` : `<p class="vv-vazio">${lotados.length ? 'Nada parado com a data chegando.' : 'Nada para delegar nem cobrar agora: ninguém acima do limite e nada parado com a data chegando.'}</p>`}
      <p class="vcr-nota">Cobrar manda no WhatsApp da pessoa e fica no histórico da peça.</p></section>`;
    const clientes = clientesConfirmadoSugestao({ itens: ctx.itens, todas: ctx.todas, achados: st.achados.lista, hoje, finalizada: ctx.finalizada });
    const MAX = 8, cartao = (c) => `<li class="vcr-cli"><div class="vcr-cli-cab">${cli(c.cliente)}<small>${plural(c.confirmadas.length, 'demanda', 'demandas')} · ${plural(c.sugestoes.length, 'sugestão', 'sugestões')}</small></div>
        <div class="vcr-cli-col"><small class="vcr-rot confirmado">Demanda confirmada</small>${c.confirmadas.length ? c.confirmadas.slice(0, 3).map((p) => `<button type="button" class="vcr-peca" data-hoje-acao="peca" data-valor="${esc(p.id)}">${esc(p.nome)}</button>`).join('') + (c.confirmadas.length > 3 ? `<small>e mais ${c.confirmadas.length - 3}</small>` : '') : '<small>Nenhuma aberta com o time.</small>'}</div>
        <div class="vcr-cli-col"><small class="vcr-rot sugestao">Sugestão (não é demanda)</small>${c.sugestoes.length ? c.sugestoes.slice(0, 3).map((s) => `<p class="vcr-ideia"><em>${s.origem === 'danilo' ? 'Danilo viu' : 'Regra do painel'}</em>${esc(s.texto)}${s.ref ? ` <button type="button" class="vg-link" data-vcr-achado="${esc(s.ref)}">abrir a peça</button>` : ''}</p>`).join('') : '<small>Nada a sugerir agora.</small>'}</div></li>`;
    const aviso = st.achados.erro ? `<p class="vcr-nota">Os achados do Danilo não vieram (${esc(st.achados.erro)}); as sugestões abaixo são só as regras do painel.</p>` : '';
    const clientesHtml = `<section class="vs-bloco vcr-bloco" aria-label="Clientes: confirmado e sugestão"><div class="vs-bloco-cabeca"><span><b>Clientes: confirmado × sugestão</b><small>o que é demanda de verdade e o que é ideia para levar ao head</small></span></div>
      ${aviso}${clientes.length ? `<ul class="vcr-clis">${clientes.slice(0, MAX).map(cartao).join('')}</ul>${clientes.length > MAX ? `<p class="vv-dica">e mais ${plural(clientes.length - MAX, 'cliente', 'clientes')} sem sugestão.</p>` : ''}` : '<p class="vv-vazio">Sem clientes com peças do time agora.</p>'}
      <p class="vcr-nota">A análise das artes (capas, destaques, identidade) chega aqui quando o Danilo da central passar a olhar as imagens.</p></section>`;
    return { conversa, mudouHtml, sugestoes, clientesHtml, perfis: lista };
  }

  // ---------- aprovar e gravar (pelas funções do painel) ----------
  async function executar(chave) {
    const d = ultimas.delegacoes.find((s) => s.chave === chave), c = ultimas.cobrancas.find((s) => s.chave === chave);
    const item = typeof G.findOperationalItem === 'function' ? G.findOperationalItem((d || c)?.id) : null;
    if (!item) { st.msg[chave] = { erro: true, texto: 'A peça não está carregada agora. Abra as demandas e tente de novo.' }; st.confirmando = ''; repintar(); return; }
    st.gravando = chave; repintar();
    try {
      if (d) {
        if (typeof G.gravarResponsaveisDaPeca !== 'function') throw new Error('o painel ainda não carregou a edição de responsáveis');
        const novos = [...new Set([...idsDe(item).filter((i) => i !== d.de.id), d.para.id])];
        await G.gravarResponsaveisDaPeca(item, novos);
        G.renderIntegratedOperationalViews?.();
        G.showToast?.(`${item.nome || 'Peça'} passou para ${primeiro(d.para.nome)}.`, 'ok', 4200);
      } else {
        // 1º o pedido de envio (o que importa); depois a nota no histórico. O VYBES busca o pedido e manda no WhatsApp.
        const r = await fetch('/api/painel?area=cobrancas', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'pedir', item: String(item.id), para: c.para, oque: c.oque, quando: c.quando, por: c.por }) });
        const resp = await r.json().catch(() => ({}));
        if (!r.ok || !Array.isArray(resp.cobrancas)) throw new Error(resp.error || 'o painel não registrou o pedido de envio');
        const ids = new Set(resp.cobrancas.map((x) => x.id));
        st.cob.lista = [...resp.cobrancas, ...st.cob.lista.filter((x) => !ids.has(x.id))]; st.cob.voltas = 0; vigiarCobrancas();
        const agentes = [...new Set(resp.cobrancas.map((x) => x.agente))].join(' e ');
        const ok = typeof G.postItemUpdate === 'function' && await G.postItemUpdate(item.id, `[Vybe OS · Cobrança da Direção de Arte]\nPara: ${c.quem.join(', ')}\nO quê: ${c.oque} (${c.quando})\nPor quê: ${c.por}\nComo destravar: ${c.destravar}\nEnvio: pedido ao VYBES pelo WhatsApp (${agentes})`);
        if (!ok) { st.msg[chave] = { erro: true, texto: 'O pedido de envio foi registrado, mas a nota no histórico da peça não gravou.' }; return; }
        G.showToast?.(`Cobrança pedida: ${agentes} manda no WhatsApp.`, 'ok', 4200);
      }
      if (d) st.feitas.add(chave); delete st.msg[chave];
    } catch (e) { st.msg[chave] = { erro: true, texto: d ? `Não gravou: ${e?.message || 'tente de novo'}. A peça continua como estava.` : `A cobrança não saiu: ${e?.message || 'tente de novo'}. Nada foi enviado.` }; }
    finally { st.gravando = ''; st.confirmando = ''; repintar(); }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-vcr-reperguntar],[data-vcr-copiar],[data-vcr-aprovar],[data-vcr-confirmar],[data-vcr-voltar],[data-vcr-adiar],[data-vcr-ver],[data-vcr-visto],[data-vcr-achado]'); if (!b) return;
    if (b.hasAttribute('data-vcr-reperguntar')) { perguntar(st.conversa.texto); return; }
    if (b.dataset.vcrCopiar) {
      // Saída para quando o bot não conseguiu: a mesma mensagem, para o Deivid mandar ele mesmo.
      const s = ultimas.cobrancas.find((x) => x.chave === b.dataset.vcrCopiar), txt = (s ? daPeca(s).filter((r) => r.estado === 'falhou').map((r) => r.texto) : []).join('\n\n') || s?.mensagem || '';
      navigator.clipboard?.writeText(txt).then(() => G.showToast?.('Mensagem copiada.', 'ok', 3000), () => G.showToast?.(`Mensagem: ${txt}`, 'info', 9000));
      return;
    }
    if (b.dataset.vcrAprovar) { st.confirmando = b.dataset.vcrAprovar; repintar(); return; }
    if (b.dataset.vcrConfirmar) { if (!st.gravando) executar(b.dataset.vcrConfirmar); return; }
    if (b.hasAttribute('data-vcr-voltar')) { st.confirmando = ''; repintar(); return; }
    if (b.dataset.vcrAdiar) { const a = adiadas(); a.add(b.dataset.vcrAdiar); gravar('vybe.criacao.adiadas', { dia: hojeIso(), chaves: [...a] }); repintar(); return; }
    if (b.hasAttribute('data-vcr-visto')) { if (ultimas.foto) gravar('vybe.criacao.visto', { dia: hojeIso(), ...ultimas.foto }); repintar(); return; }
    if (b.dataset.vcrAchado) { G.VybePeca?.abrir?.(b.dataset.vcrAchado, { setor: 'design' }); return; }
    if (b.dataset.vcrVer) {
      const s = ultimas.delegacoes.find((x) => x.chave === b.dataset.vcrVer); if (!s) return;
      G.VybePeca?.abrir?.(s.id, { achado: { titulo: s.nome, cliente: s.cliente, fato: s.porque, sugestao: `Passar para ${s.para.nome}`, proposta: { responsavel: s.para.nome } } });
    }
  });

  util.relerCobrancas = () => lerCobrancas(true);
  G.VybeCriacao = { assistente, util };
})();
