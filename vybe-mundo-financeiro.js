// vybe-mundo-financeiro.js — o Financeiro do próprio Vybe OS, sem o Vybe Finanças (Paulo, 13/11/2026).
//
// Telas na Direção 3 (moodboard 3, aprovado em 13/11/2026; classes fv2-* de padrao-v2/financas.css, fx-* de
// padrao-v2/financeiro.css e d3f-* de padrao-v2/d3-financas.css), hospedadas na janela do Comercial como as de
// vybe-mundo-financas.js (o pintor da janela procura VybeFinanceiro.telas[aba]):
//   extrato      o extrato do banco: importar o CSV (prévia antes de gravar), conferir, dizer para onde foi de verdade,
//                dividir uma entrada entre clientes, pago | não pago | em aberto, e criar regra a partir do lançamento
//   clientes_mes cada cliente × mês: pago, parcial, em aberto, sem cobrança
//   cartao       as faturas com cada item, o que foi pago e o que falta, colar os itens da fatura
//   fixos        gastos fixos (programas, assinaturas, aluguel…): cadastrar, editar, ver se já saiu no mês
//   vorcaro      a tela do Vorcaro (Tesouraria): o que ele viu no setor, o que chegou do grupo Vybe Financeiro e lançar à mão
//   projecao     caixa realizado e projetado para 3, 6 e 12 meses, com cenários (cortar, somar clientes, perder…)
// Cada tela segue o quadro D3 dela: selo "só donos", o bloco de ação laranja (frase curta e um botão), os números com a
// barra ou a mini linha (d3NumHtml, d3LinhaSvg e d3AcaoHtml, de vybe-core.js) e os cartões só com título e conteúdo.
// Dados: GET/POST /api/painel?area=financeiro (server/financeiro.js; só os quatro donos). Contas: shared/financeiro-extrato.js
// (window.VybeFinanceiroExtrato). Interação: data-fx="<ação>" (cliques), data-fx-campo (campos), data-fx-arquivo (CSV).
(() => {
  'use strict';
  const X = () => window.VybeFinanceiroExtrato;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const nomeMes = (m) => (/^\d{4}-\d{2}$/.test(m || '') ? `${MESES[Number(m.slice(5)) - 1]} de ${m.slice(0, 4)}` : '');
  const soMes = (m) => MESES[Number(String(m || '').slice(5, 7)) - 1] || '';
  const mesCurto = (m) => (/^\d{4}-\d{2}$/.test(m || '') ? `${MES_CURTO[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}` : '');
  const mes3 = (m) => MES_CURTO[Number(String(m || '').slice(5, 7)) - 1] || '';
  const dataCurta = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '');
  const rs = (v) => { const n = Number(v) || 0; return `${n < 0 ? '-' : ''}R$ ${Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
  const mil = (v) => { const n = Number(v) || 0, a = Math.abs(n); return `${n < 0 ? '-' : ''}R$ ${a >= 1000 ? (a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : Math.round(a).toLocaleString('pt-BR')}`; };
  const n0 = (v) => Math.round(Number(v) || 0).toLocaleString('pt-BR');
  const quantos = (n, um, varios) => `${n0(n)} ${Number(n) === 1 ? um : varios}`;
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const numero = (s) => { const t = String(s ?? '').trim(); if (!t) return 0; const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return Number.isFinite(n) ? n : 0; };
  const pc = (a, b) => (Number(b) > 0 ? Math.max(0, Math.min(100, Math.round((Number(a) || 0) / Number(b) * 100))) : 0);
  // Valor com sinal, como no quadro: "+R$ 1.800,00" e "−R$ 300,00".
  const comSinal = (v) => `${Number(v) > 0 ? '+' : Number(v) < 0 ? '−' : ''}${rs(Math.abs(Number(v) || 0))}`;
  const SETA = { esq: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>', dir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' };
  const IC = {
    cadeado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  };
  const SELO = `<span class="d3-selo-donos">${IC.cadeado}só donos</span>`;
  const pill = (t, tom = 'n') => `<span class="fv2-pill ${tom}">${esc(t)}</span>`;
  const STATUS_NOME = { pago: 'Pago', nao_pago: 'Não pago', em_aberto: 'Em aberto' };
  const STATUS_TOM = { pago: 'g', nao_pago: 'r', em_aberto: 'a' };

  // ---------- Estado da tela (o que fica entre uma pintura e outra) ----------
  const ui = {
    extrato: { mes: '', chip: 'conferir', cat: '', aberta: '', mostrar: 60, partes: {}, previa: null, csv: '', nomeArquivo: '', lendo: false, regra: '' },
    clientes_mes: { chip: 'todos', aberta: '' },
    cartao: { fatura: '', novo: false, colar: false, editando: '', chip: 'todos', aberta: '', inteira: false },
    fixos: { mes: '', novo: false, editando: '' },
    vorcaro: { mao: false, frente: '' },
    projecao: { horizonte: 6, cenario: { cortes: {}, economias: {}, clientes_novos: [], clientes_perdidos: {}, gastos_novos: [], ajuste_entradas_pct: 0 }, nome: '', base: null },
  };
  let anfitriao = {}; // { d, repintar, recarregar } da última pintura (janela do Comercial)
  const avisar = (texto, tipo = 'error') => { try { if (typeof showToast === 'function') return showToast(texto, tipo, 4500); } catch { /* sem aviso */ } console.warn('[financeiro]', texto); };

  async function post(corpo) {
    const r = await fetch('/api/painel?area=financeiro', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || 'Não foi possível gravar agora.');
    return d;
  }
  async function gravar(corpo, okTexto = '') {
    try { const d = await post(corpo); if (okTexto) avisar(okTexto, 'success'); await anfitriao.recarregar?.(); return d; }
    catch (e) { avisar(e.message); return null; }
  }
  const repintar = () => anfitriao.repintar?.();

  // ---------- Peças ----------
  function topo(titulo, acoes = '', meio = '', extra = '') {
    return `<div class="fv2-topo"><div class="fv2-ola"><p class="fv2-sub"><button type="button" class="fv2-link" data-fx="ir" data-valor="setor:financas">Finanças</button> › ${esc(titulo)}</p><div class="d3f-tit"><h1>${esc(titulo)}</h1>${SELO}${extra}</div></div>${meio}${acoes}</div>`;
  }
  // Bloco de ação (a única faixa laranja): o Vorcaro, a frase curta e um botão; `junto` entra no lugar do botão (ex.: o arquivo).
  const acao = (frase, botao = '', attrs = '', junto = '') => globalThis.d3AcaoHtml({ frase: `<small class="d3f-quem">Vorcaro · Tesouraria</small>${frase}`, agente: 'V', botao, attrs })
    .replace(/<\/section>$/, `${junto}</section>`);
  // Número da Direção 3 com a linha de baixo (o que era legenda vira um dado curto).
  function num({ rotulo, valor, tom = '', serie = null, meta = null, barra = null, sub = '', attrs = '' }) {
    const h = globalThis.d3NumHtml({ rotulo, valor, tom, serie, meta, barra, attrs });
    return sub ? h.replace(/<\/(div|button)>$/, `<span class="d3f-sub">${sub}</span></$1>`) : h;
  }
  const nums = (l) => `<div class="d3f-nums" style="--n:${l.length}">${l.map((k) => num(k)).join('')}</div>`;
  // Duas barras pequenas lado a lado (entrou × saiu), para o rodapé de um número.
  const duas = (a, b, ra, rb) => { const m = Math.max(1, Math.abs(a), Math.abs(b)); return `<span class="d3f-duas"><span class="d3-barra" style="--v:${pc(Math.abs(a), m)}%"><i></i></span>${ra}<span class="d3-barra cinza" style="--v:${pc(Math.abs(b), m)}%"><i></i></span>${rb}</span>`; };
  const card = (titulo, corpo, sub = '', cls = '', rotulo = '') => `<section class="fv2-card${cls ? ' ' + cls : ''}"${rotulo ? ` data-fx-card="${rotulo}"` : ''}><div class="fv2-card-topo"><h2>${esc(titulo)}</h2>${sub ? `<span class="fv2-sub">${sub}</span>` : ''}</div>${corpo}</section>`;
  const cabeca = (cols) => `<div class="d3f-cab" aria-hidden="true">${cols.map(([cls, t]) => `<span class="${cls}">${esc(t)}</span>`).join('')}</div>`;
  function mesNav(lista, atual, alvo, rotulo = nomeMes) {
    const i = lista.indexOf(atual), antes = lista[i - 1] || '', depois = lista[i + 1] || '';
    return `<span class="fv2-mes" role="group" aria-label="Mês"><button type="button" class="fv2-btn s fv2-seta" data-fx="mes" data-alvo="${alvo}" data-valor="${antes}" aria-label="Mês anterior"${antes ? '' : ' disabled'}>${SETA.esq}</button><b class="d3f-mes" aria-live="polite">${esc(rotulo(atual))}</b><button type="button" class="fv2-btn s fv2-seta" data-fx="mes" data-alvo="${alvo}" data-valor="${depois}" aria-label="Próximo mês"${depois ? '' : ' disabled'}>${SETA.dir}</button></span>`;
  }
  const chips = (alvo, lista, atual) => `<span class="fv2-fichas" role="group" aria-label="Filtrar">${lista.map(([k, nome, n, tom]) => `<button type="button" class="fv2-chip" data-fx="chip" data-alvo="${alvo}" data-valor="${k}" aria-pressed="${atual === k}">${esc(nome)}${n != null ? ` <b${tom ? ` class="${tom}"` : ''}>${n0(n)}</b>` : ''}</button>`).join('')}</span>`;
  const categorias = (d) => d.categorias || X().CATEGORIAS;
  const nomeCat = (d, id) => (categorias(d).find((c) => c.id === id) || {}).nome || id || '—';
  function opcoesCat(d, sel, { tipo = '' } = {}) {
    const grupos = new Map();
    for (const c of categorias(d)) { if (tipo && c.tipo !== tipo && c.tipo !== 'indefinido' && !(tipo === 'saida' && c.tipo === 'transferencia')) continue; if (!grupos.has(c.grupo)) grupos.set(c.grupo, []); grupos.get(c.grupo).push(c); }
    return [...grupos].map(([g, l]) => `<optgroup label="${esc(g)}">${l.map((c) => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>`).join('');
  }
  const opcoesCliente = (d, sel) => `<option value="">sem cliente</option>${(d.clientes || []).filter((c) => c.ativo !== false || String(c.id) === String(sel)).map((c) => `<option value="${esc(c.id)}"${String(c.id) === String(sel) ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}`;
  const nomeCliente = (d, id) => (d.clientes || []).find((c) => String(c.id) === String(id))?.nome || '';
  const campo = (rot, html, cls = '') => `<label class="fx-campo${cls ? ' ' + cls : ''}"><span>${esc(rot)}</span>${html}</label>`;
  // Barra de grupo: nome, a barra, (a fatia) e o valor.
  const gx = (nome, pct, valor, { tom = '', fatia = null, attrs = '', on = null } = {}) => {
    const tag = attrs ? 'button' : 'div';
    return `<${tag}${attrs ? ` type="button" ${attrs}` : ''} class="d3f-gx${fatia == null ? ' sem-fatia' : ''}${tom ? ' ' + tom : ''}"${on != null ? ` aria-pressed="${on}"` : ''}><span>${nome}</span><span class="d3-barra" style="--v:${Math.max(0, Math.min(100, Math.round(pct)))}%"><i></i></span>${fatia == null ? '' : `<b>${fatia}%</b>`}<span class="d3f-gx-v">${valor}</span></${tag}>`;
  };
  const vazio = (frase, botao = '') => `<div class="fv2-vz"><p>${frase}</p>${botao}</div>`;
  const ultimos = (serie, ate, campo, n = 6) => (serie || []).filter((s) => s.mes <= ate && s[campo] != null).slice(-n).map((s) => Number(s[campo]) || 0);

  // =====================================================================================================
  // EXTRATO
  // =====================================================================================================
  function extrato(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.extrato, todas = d.transacoes || [];
    const meses = d.meses || [];
    if (!u.mes || !meses.includes(u.mes)) u.mes = meses[meses.length - 1] || '';
    const doMes = todas.filter((t) => t.banco.data.startsWith(u.mes));
    const r = u.mes ? X().resumo(todas, { mes: u.mes }) : null;
    const busca = semAcento(ctx.filtro?.fx_extrato || '');
    const filtro = (t) => {
      if (u.cat && !X().pedacos(t).some((p) => p.categoria === u.cat)) return false;
      if (busca && !semAcento([t.banco.historico, t.real.quem, t.real.descricao, t.real.cliente_nome, nomeCat(d, t.real.categoria), ...(t.real.partes || []).map((p) => p.cliente_nome)].join(' ')).includes(busca)) return false;
      if (u.chip === 'conferir') return !t.real.conferido;
      if (u.chip === 'entradas') return t.banco.valor > 0;
      if (u.chip === 'saidas') return t.banco.valor < 0;
      if (u.chip === 'abertos') return t.real.status !== 'pago';
      return true;
    };
    const lista = doMes.filter(filtro).slice().reverse();
    const aConferir = doMes.filter((t) => !t.real.conferido).length;
    const arquivo = (cls) => `<label class="${cls} fx-arquivo">${cls.includes('fv2-btn') ? IC.mais : ''}Importar extrato<input type="file" accept=".csv,text/csv" data-fx-arquivo hidden></label>`;
    const partes = [topo('Extrato e conciliação', arquivo('fv2-btn p'), meses.length ? mesNav(meses, u.mes, 'extrato') : '', '<span class="d3f-data">Banco do Brasil · conta PJ</span>')];
    if (u.previa) partes.push(previaHtml(d));
    if (!todas.length && !u.previa) {
      partes.push(acao('Sem extrato ainda. Importe o CSV da conta PJ.', '', '', arquivo('d3-acao-btn')));
      return casca(partes, 'extrato');
    }
    if (r) {
      const sem = doMes.filter((t) => t.real.categoria === 'receita_boleto' && !t.real.partes?.length).length;
      const frase = aConferir ? `${quantos(aConferir, 'lançamento', 'lançamentos')} para conferir${sem ? ` e ${quantos(sem, 'boleto', 'boletos')} para dividir` : ''}.`
        : `${esc(soMes(u.mes)).replace(/^./, (c) => c.toUpperCase())} todo conferido.`;
      partes.push(acao(frase, aConferir ? 'Ver o que falta' : '', 'data-fx="chip" data-alvo="extrato" data-valor="conferir"'));
      const anterior = (d.serie || []).filter((s) => s.mes < u.mes && s.saldo_final != null).slice(-1)[0];
      const ultimoDia = doMes.filter((t) => t.banco.saldo != null).map((t) => t.banco.data).sort().slice(-1)[0];
      const nCartao = doMes.filter((t) => X().pedacos(t).some((p) => p.categoria === 'cartao_agencia')).length;
      partes.push(nums([
        { rotulo: 'Entrou', valor: mil(r.entradas), tom: 'g', serie: ultimos(d.serie, u.mes, 'entradas'), sub: quantos(doMes.filter((t) => t.banco.valor > 0).length, 'entrada', 'entradas'), attrs: 'data-fx="chip" data-alvo="extrato" data-valor="entradas"' },
        { rotulo: 'Saiu sem o cartão', valor: mil(r.saidas), serie: ultimos(d.serie, u.mes, 'saidas'), sub: quantos(doMes.filter((t) => t.banco.valor < 0).length - nCartao, 'saída', 'saídas'), attrs: 'data-fx="chip" data-alvo="extrato" data-valor="saidas"' },
        { rotulo: 'Pago no cartão', valor: mil(r.cartao_e_transferencias), sub: `${quantos(nCartao, 'pagamento', 'pagamentos')} · <button type="button" class="fv2-link" data-fx="ir-aba" data-valor="cartao">itens no Cartão</button>` },
        { rotulo: ultimoDia ? `Saldo · ${dataCurta(ultimoDia)}` : 'Saldo', valor: r.saldo_final == null ? 'sem saldo' : mil(r.saldo_final), tom: Number(r.saldo_final) < 0 ? 'r' : '', serie: ultimos(d.serie, u.mes, 'saldo_final'),
          sub: anterior ? `era ${mil(anterior.saldo_final)} em ${soMes(anterior.mes).slice(0, 3)}` : '' },
      ]));
    }
    const contar = (k) => doMes.filter((t) => ({ conferir: !t.real.conferido, entradas: t.banco.valor > 0, saidas: t.banco.valor < 0, abertos: t.real.status !== 'pago', todos: true })[k]).length;
    const catsMes = [...new Set(doMes.flatMap((t) => X().pedacos(t).map((p) => p.categoria)))];
    const filtrosHtml = `<div class="fv2-filtros fx-filtros">${chips('extrato', [['conferir', 'A conferir', contar('conferir'), 'a'], ['todos', 'Todos', contar('todos')], ['entradas', 'Entradas', contar('entradas')], ['saidas', 'Saídas', contar('saidas')], ['abertos', 'Não pago / em aberto', contar('abertos')]], u.chip)}
      <label class="fv2-sr" for="fx-cat">Categoria</label><select id="fx-cat" class="fx-sel fx-sel-chip" data-fx-campo="filtro-cat"><option value="">Categoria</option>${catsMes.map((c) => `<option value="${c}"${u.cat === c ? ' selected' : ''}>${esc(nomeCat(d, c))}</option>`).join('')}</select>
      <label class="fv2-sr" for="fx-busca-extrato">Buscar no extrato</label><input class="fv2-busca fx-busca" id="fx-busca-extrato" type="search" data-vc-busca="fx_extrato" placeholder="Buscar" value="${esc(ctx.filtro?.fx_extrato || '')}"></div>`;
    const linhas = lista.slice(0, u.mostrar).map((t) => linhaExtrato(d, t)).join('');
    const resto = lista.length - u.mostrar;
    const pe = [resto > 0 ? `<button type="button" class="d3f-mais" data-fx="mais" data-alvo="extrato">+${n0(resto)}</button>` : '',
      u.chip === 'conferir' && lista.length ? `<button type="button" class="fv2-btn s" data-fx="conferir-todos">Conferir os ${n0(Math.min(lista.length, u.mostrar))} sugeridos</button>` : ''].filter(Boolean).join('');
    const corpo = filtrosHtml + (linhas ? cabeca([['fx-dia', 'Dia'], ['fx-banco', 'No banco'], ['fx-real', 'De verdade'], ['fx-valor', 'Valor'], ['fx-ok-cab', '']]) + linhas : vazio(u.chip === 'conferir' ? 'Tudo conferido neste mês.' : 'Nada com esse filtro.')) + (pe ? `<div class="fv2-pe">${pe}</div>` : '');
    partes.push(`<div class="fx-duas"><div class="fx-col">${card('Lançamentos', corpo, '', 'd3f-tabela fx-lancs', 'lancamentos')}</div>
      <div class="fx-col fx-lado">${r ? card('Para onde foi', porCategoriaHtml(d, r), 'de verdade') : ''}${regrasHtml(d)}${importacoesHtml(d)}</div></div>`);
    return casca(partes, 'extrato');
  }
  function linhaExtrato(d, t) {
    const u = ui.extrato, aberta = u.aberta === t.id, entrada = t.banco.valor > 0;
    const cat = t.real.partes?.length ? `dividido em ${t.real.partes.length}` : nomeCat(d, t.real.categoria);
    const quem = t.real.partes?.length ? t.real.partes.map((p) => p.cliente_nome || p.quem).filter(Boolean).join(', ') : (t.real.cliente_nome || t.real.quem || '');
    const tomCat = t.real.categoria === 'a_classificar' ? 'r' : t.real.conferido && !t.real.partes?.length ? 'n' : 'a';
    const status = (t.real.status !== 'pago' ? pill(STATUS_NOME[t.real.status], STATUS_TOM[t.real.status]) : '') + (t.banco.origem ? pill(t.banco.origem === 'mao' ? 'à mão' : 'WhatsApp', 'b') : '');
    return `<div class="v2-abre fv2-linha fx-lanc${t.real.conferido ? ' ok' : ''}" data-linha="${esc(t.id)}" aria-expanded="${aberta}">
      <div class="fv2-lin"><span class="fx-dia">${dataCurta(t.banco.data)}</span><button type="button" class="fv2-txt" data-fx="abrir" data-alvo="extrato" data-valor="${esc(t.id)}" aria-expanded="${aberta}">
        <span class="fx-banco">${esc(t.banco.historico)}</span><span class="fx-real">${pill(cat, tomCat)}${quem ? `<span class="fx-quem">${esc(quem)}</span>` : ''}${status}</span></button>
        <b class="fx-valor ${entrada ? 'e' : 's'}">${esc(comSinal(t.banco.valor))}</b>
        <button type="button" class="fx-ok" data-fx="conferir" data-valor="${esc(t.id)}" aria-pressed="${t.real.conferido}" title="${t.real.conferido ? 'Conferido' + (t.real.conferido_por ? ' por ' + esc(t.real.conferido_por) : '') : 'Marcar como conferido'}">${IC.ok}<span class="fv2-sr">Conferido</span></button></div>
      <div class="v2-mais"><div>${aberta ? editorExtrato(d, t) : ''}</div></div></div>`;
  }
  function editorExtrato(d, t) {
    const u = ui.extrato, entrada = t.banco.valor > 0;
    const partes = u.partes[t.id] || (t.real.partes?.length ? t.real.partes.map((p) => ({ ...p })) : null);
    if (partes && !u.partes[t.id]) u.partes[t.id] = partes;
    const tipo = entrada ? 'entrada' : 'saida';
    const somaPartes = (partes || []).reduce((s, p) => s + Math.round(numero(p.valor) * 100), 0) / 100;
    const falta = Math.round((Math.abs(t.banco.valor) - somaPartes) * 100) / 100;
    const faturas = [...new Set([...(d.cartao?.itens || []).map((i) => `${i.cartao}|${i.fatura}`), `Cartão da agência|${t.banco.data.slice(0, 7)}`, `Cartão da agência|${X().somarMeses(t.banco.data.slice(0, 7), -1)}`])].sort().reverse();
    const sug = t.sugestao?.nota ? `<p class="fx-sug">${pill('Sugestão', 'b')}${esc(t.sugestao.nota)}${t.sugestao.regra ? ` · regra ${esc(t.sugestao.regra)}` : ''}</p>` : '';
    const contra = t.banco.contraparte || '';
    return `<div class="fv2-det fx-editor" data-fx-editor="${esc(t.id)}">
      <div class="fx-lados"><p class="fx-comobanco"><small>Como está no banco</small><span>${esc(dataCurta(t.banco.data))} · ${esc(t.banco.historico)}${t.banco.documento ? ` · doc ${esc(t.banco.documento)}` : ''} · <b>${esc(comSinal(t.banco.valor))}</b>${t.banco.saldo != null ? ` · saldo ${esc(rs(t.banco.saldo))}` : ''}</span></p>
      <div class="fx-real-lado"><small>Para onde foi de verdade</small><div class="fx-grade">
        ${campo('Categoria', `<select name="categoria" class="fx-sel">${opcoesCat(d, t.real.categoria, { tipo })}</select>`)}
        ${campo('Cliente', `<select name="cliente_id" class="fx-sel">${opcoesCliente(d, t.real.cliente_id)}</select>`)}
        ${campo('Quem', `<input name="quem" class="fx-in" value="${esc(t.real.quem)}" placeholder="${esc(contra || 'posto, gráfica, Adobe')}">`)}
        ${campo('Referente a', `<input name="competencia" type="month" class="fx-in" value="${esc(t.real.competencia)}">`)}
        ${campo('Observação', `<input name="descricao" class="fx-in" value="${esc(t.real.descricao)}" placeholder="o que foi">`, 'largo')}
        ${t.real.categoria === 'cartao_agencia' || (!entrada && /cart/i.test(t.real.categoria)) ? campo('Fatura quitada', `<select name="fatura" class="fx-sel"><option value="">escolher</option>${faturas.map((f) => `<option value="${esc(f)}"${t.real.fatura === f ? ' selected' : ''}>${esc(f.split('|')[0])} · ${esc(nomeMes(f.split('|')[1]))}</option>`).join('')}</select>`) : ''}
      </div></div></div>
      ${sug}
      ${partes ? `<div class="fx-partes">
        ${partes.map((p, i) => `<div class="fx-parte" data-parte="${i}">
          <input name="p_valor" class="fx-in fx-num" inputmode="decimal" value="${esc(p.valor === '' || p.valor == null ? '' : String(p.valor).replace('.', ','))}" placeholder="valor" aria-label="Valor da parte ${i + 1}">
          ${entrada ? `<select name="p_cliente" class="fx-sel" aria-label="Cliente da parte ${i + 1}">${opcoesCliente(d, p.cliente_id)}</select>` : `<select name="p_categoria" class="fx-sel" aria-label="Categoria da parte ${i + 1}">${opcoesCat(d, p.categoria || t.real.categoria, { tipo })}</select>`}
          ${entrada ? `<input name="p_competencia" type="month" class="fx-in" value="${esc(p.competencia || t.real.competencia)}" aria-label="Mês a que se refere a parte ${i + 1}">`
            : `<input name="p_quem" class="fx-in" value="${esc(p.quem || p.descricao || '')}" placeholder="quem / o quê" aria-label="Quem ou o quê na parte ${i + 1}">`}
          <button type="button" class="fv2-btn s fv2-seta" data-fx="parte-tirar" data-id="${esc(t.id)}" data-valor="${i}" aria-label="Tirar parte ${i + 1}">×</button></div>`).join('')}</div>` : ''}
      <div class="fx-linha-acoes fx-fim">${partes ? (falta === 0 ? pill('fechou', 'g') : pill(`${falta > 0 ? 'faltam' : 'passou'} ${rs(Math.abs(falta))}`, 'r')) : ''}
        <span class="fv2-seg" role="group" aria-label="Situação">${['pago', 'nao_pago', 'em_aberto'].map((s) => `<button type="button" data-fx="status" data-valor="${s}" data-id="${esc(t.id)}" aria-pressed="${t.real.status === s}">${STATUS_NOME[s]}</button>`).join('')}</span>
        ${partes ? `<button type="button" class="fv2-btn s" data-fx="parte-mais" data-valor="${esc(t.id)}">+ parte</button>${falta > 0 ? `<button type="button" class="fv2-btn s" data-fx="parte-resto" data-valor="${esc(t.id)}">Resto: ${esc(rs(falta))}</button>` : ''}<button type="button" class="fv2-btn s" data-fx="parte-desfazer" data-valor="${esc(t.id)}">Não dividir</button>`
          : `<button type="button" class="fv2-btn s" data-fx="dividir" data-valor="${esc(t.id)}">${entrada ? 'Dividir entre clientes' : 'Dividir em partes'}</button>`}
        <button type="button" class="fv2-btn s" data-fx="regra-de" data-valor="${esc(t.id)}" title="Sempre que aparecer${contra ? ` “${esc(contra.split(' ').slice(0, 2).join(' '))}”` : ' este histórico'}, fazer assim">Sempre assim</button>
        <button type="button" class="fv2-btn d3f-escuro v2-estado" data-fx="salvar-lanc" data-valor="${esc(t.id)}">Salvar e conferir</button></div>
      ${ui.extrato.regra === t.id ? regraForm(d, t) : ''}
    </div>`;
  }
  function regraForm(d, t) {
    const sugerido = t.banco.contraparte ? t.banco.contraparte.split(' ').slice(0, 2).join(' ') : t.banco.historico.split(' ').slice(0, 3).join(' ');
    return `<div class="fx-regra" data-fx-regra="${esc(t.id)}">
      <div class="fx-grade">${campo('Quando o histórico tiver', `<input name="r_contem" class="fx-in" value="${esc(sugerido)}">`)}${campo('Só em', `<select name="r_sinal" class="fx-sel"><option value="${t.banco.valor < 0 ? 'saida' : 'entrada'}">${t.banco.valor < 0 ? 'saídas' : 'entradas'}</option><option value="">entradas e saídas</option></select>`)}
      ${campo('Conferir mesmo assim', `<select name="r_revisar" class="fx-sel"><option value="">não, já entra conferido</option><option value="1">sim, sugerir e eu confiro</option></select>`)}</div>
      <div class="fx-linha-acoes"><button type="button" class="fv2-btn s d3f-escuro" data-fx="regra-salvar" data-valor="${esc(t.id)}">Criar regra</button><button type="button" class="fv2-btn s" data-fx="regra-de" data-valor="">Cancelar</button></div></div>`;
  }
  function porCategoriaHtml(d, r) {
    const entradas = r.categorias.filter((c) => c.total > 0), saidas = r.categorias.filter((c) => c.total < 0);
    const max = Math.max(1, ...r.categorias.map((c) => Math.abs(c.total)));
    const linha = (c) => gx(`${esc(c.nome)}<small>${quantos(c.quantidade, 'lançamento', 'lançamentos')}</small>`, Math.abs(c.total) / max * 100, `${c.total > 0 ? '+' : ''}${esc(mil(Math.abs(c.total)).replace('R$ ', ''))}`,
      { tom: c.categoria === 'a_classificar' ? 'r' : c.total > 0 ? 'g' : '', attrs: `data-fx="cat" data-valor="${c.categoria}"`, on: ui.extrato.cat === c.categoria });
    return [...entradas, ...saidas].map(linha).join('');
  }
  function regrasHtml(d) {
    const minhas = d.regras || [], prontas = d.regras_padrao || [];
    const corpo = `${minhas.length ? minhas.map((r) => `<div class="fx-mini"><span><b>“${esc(r.quando?.contem)}”</b> → ${esc(nomeCat(d, r.categoria))}${r.quem ? ` · ${esc(r.quem)}` : ''}${r.cliente_nome ? ` · ${esc(r.cliente_nome)}` : ''}</span><button type="button" class="fv2-link" data-fx="regra-tirar" data-valor="${esc(r.id)}">tirar</button></div>`).join('') : '<p class="fv2-sub">Nenhuma regra sua ainda.</p>'}
      <details class="fx-det"><summary>Prontas · ${n0(prontas.length)}</summary>${prontas.map((r) => `<p class="fv2-sub">“${esc(r.quando.contem || r.quando.comeca)}” → ${esc(nomeCat(d, r.categoria))}${r.revisar ? ' (você confere)' : ''}</p>`).join('')}</details>`;
    return card('Regras', corpo);
  }
  function importacoesHtml(d) {
    const l = (d.importacoes || []).slice(-4).reverse();
    if (!l.length) return '';
    return card('Importações', l.map((i) => `<div class="fx-mini"><span>${esc(dataCurta(i.em))} · ${esc(i.por || '')} · ${esc(dataCurta(i.de))} a ${esc(dataCurta(i.ate))}${i.repetidas ? ` · ${n0(i.repetidas)} já estavam` : ''}</span><b>${n0(i.novas)}</b></div>`).join(''));
  }
  function previaHtml(d) {
    const p = ui.extrato.previa;
    if (p.erro) return card('Prévia do extrato', `<p class="fv2-sub">${esc(p.erro)}</p><div class="fx-linha-acoes"><button type="button" class="fv2-btn s" data-fx="previa-fechar">Fechar</button></div>`, '', 'fx-previa');
    const porRegra = new Map();
    for (const t of p.transacoes.filter((x) => !x.ja_importada)) { const k = nomeCat(d, t.real.categoria); porRegra.set(k, (porRegra.get(k) || 0) + 1); }
    const meses = p.meses.map((m) => `<div class="fx-mini"><span><b>${esc(nomeMes(m.mes || ''))}</b> · ${quantos(m.lancamentos, 'lançamento', 'lançamentos')}</span><span>entrou ${esc(rs(m.entradas))} · saiu ${esc(rs(m.saidas + m.cartao_e_transferencias))}</span></div>`).join('');
    const exemplos = p.transacoes.filter((x) => !x.ja_importada).slice(-12).reverse().map((t) => `<div class="fx-mini"><span>${esc(dataCurta(t.banco.data))} · ${esc(t.banco.historico)}</span><span>${pill(nomeCat(d, t.real.categoria), t.real.conferido ? 'n' : 'a')} <b>${esc(rs(t.banco.valor))}</b></span></div>`).join('');
    return card(`Prévia: ${ui.extrato.nomeArquivo || 'extrato'}`, `<p class="fx-previa-num"><b>${quantos(p.novas, 'lançamento novo', 'lançamentos novos')}</b>${p.repetidas ? ` · ${n0(p.repetidas)} já estavam aqui` : ''} · agência ${esc(p.agencia)} conta ${esc(p.conta)}</p>
      ${p.avisos?.length ? `<p class="fv2-sub">${p.avisos.map(esc).join(' · ')}</p>` : ''}${meses}
      <p class="fx-rot">Como ficou classificado</p><p class="fv2-sub">${[...porRegra].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(k)}: ${n}`).join(' · ')}</p>
      <details class="fx-det"><summary>Últimos lançamentos</summary>${exemplos}</details>
      <div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn s d3f-escuro" data-fx="importar"${p.novas ? '' : ' disabled'}>${p.novas ? `Importar ${quantos(p.novas, 'lançamento', 'lançamentos')}` : 'Nada novo para importar'}</button><button type="button" class="fv2-btn s" data-fx="previa-fechar">Cancelar</button></div>`,
    'nada gravado ainda', 'fx-previa');
  }

  // =====================================================================================================
  // CLIENTES MÊS A MÊS
  // =====================================================================================================
  function clientesMes(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.clientes_mes, pc2 = d.por_cliente || { meses: [], linhas: [] };
    const meses = pc2.meses, atual = meses[meses.length - 1];
    const linhas = pc2.linhas.filter((l) => l.meses.some((m) => m.situacao !== 'sem'));
    const doMes = linhas.map((l) => l.meses.find((m) => m.mes === atual)).filter(Boolean);
    const recebido = doMes.reduce((s, m) => s + m.recebido, 0), aberto = linhas.reduce((s, l) => s + l.total_aberto, 0), aReceber = linhas.reduce((s, l) => s + (l.a_receber || 0), 0);
    const pagos = doMes.filter((m) => m.situacao === 'pago').length, cobrados = doMes.filter((m) => m.situacao !== 'sem').length;
    const busca = semAcento(ctx.filtro?.fx_clientes || '');
    const vis = linhas.filter((l) => (u.chip === 'aberto' ? l.total_aberto > 0 : u.chip === 'pagos' ? l.total_aberto === 0 : true) && (!busca || semAcento(l.cliente_nome).includes(busca)));
    const maior = linhas.slice().sort((a, b) => b.total_aberto - a.total_aberto)[0];
    const partes = [topo('Clientes mês a mês')];
    partes.push(!pc2.desde ? acao('Sem extrato, não dá para saber quem pagou.', 'Ir ao extrato', 'data-fx="ir-aba" data-valor="extrato"')
      : !linhas.length ? acao('Nenhuma entrada ligada a cliente ainda.', 'Ligar no extrato', 'data-fx="ir-aba" data-valor="extrato" data-chip="entradas"')
      : aberto > 0 ? acao(`${esc(rs(aberto))} em aberto${maior?.total_aberto ? `; o maior é ${esc(maior.cliente_nome)}` : ''}.`, 'Ver quem deve', 'data-fx="chip" data-alvo="clientes_mes" data-valor="aberto"')
      : acao(`Todos em dia desde ${esc(soMes(pc2.desde))}.`));
    partes.push(nums([
      { rotulo: `Recebido em ${soMes(atual)}`, valor: mil(recebido), tom: 'g' },
      { rotulo: 'Em aberto', valor: mil(aberto), tom: aberto > 0 ? 'r' : '', sub: aReceber ? `${esc(mil(aReceber))} a receber no mês` : 'meses passados' },
      { rotulo: `Pagaram em ${soMes(atual)}`, valor: `${n0(pagos)}<small class="d3f-de"> / ${n0(cobrados)}</small>`, barra: pc(pagos, cobrados) },
    ]));
    const filtro = `<div class="fv2-filtros"><label class="fv2-sr" for="fx-busca-cli">Buscar cliente</label><input class="fv2-busca" id="fx-busca-cli" type="search" data-vc-busca="fx_clientes" placeholder="Buscar cliente" value="${esc(ctx.filtro?.fx_clientes || '')}">
      ${chips('clientes_mes', [['todos', 'Todos', linhas.length], ['aberto', 'Em aberto', linhas.filter((l) => l.total_aberto > 0).length, 'r'], ['pagos', 'Em dia', linhas.filter((l) => !l.total_aberto).length, 'g']], u.chip)}</div>`;
    const cab = `<div class="fx-mm fx-mm-cab" style="--n:${meses.length}"><span>Cliente</span>${meses.map((m) => `<span>${esc(mesCurto(m))}</span>`).join('')}<span>Em aberto</span></div>`;
    const corpo = vis.map((l) => {
      const aberta = u.aberta === l.cliente_id;
      return `<div class="fx-mm-bloco"><div class="fx-mm" style="--n:${meses.length}"><button type="button" class="fx-mm-nome" data-fx="abrir" data-alvo="clientes_mes" data-valor="${esc(l.cliente_id)}" aria-expanded="${aberta}">${esc(l.cliente_nome)}${l.mensalidade ? `<small>${esc(rs(l.mensalidade))}/mês</small>` : '<small>sem mensalidade</small>'}</button>
        ${l.meses.map((m) => `<span class="fx-cel ${m.situacao}" title="${esc(m.situacao === 'fora' ? `${nomeMes(m.mes)}: antes do extrato importado` : `${nomeMes(m.mes)}: previsto ${rs(m.previsto)}, recebido ${rs(m.recebido)}${m.em_aberto ? `, em aberto ${rs(m.em_aberto)}` : ''}${m.a_receber ? `, a receber ${rs(m.a_receber)}` : ''}`)}">${m.situacao === 'sem' || m.situacao === 'fora' ? '·' : m.situacao === 'pago' ? '✓' : esc(mil(m.em_aberto || m.a_receber).replace('R$ ', ''))}</span>`).join('')}
        <b class="${l.total_aberto ? 'fx-neg' : ''}">${l.total_aberto ? esc(rs(l.total_aberto)) : '·'}</b></div>${aberta ? detalheCliente(d, l) : ''}</div>`;
    }).join('');
    const legenda = `<p class="fv2-sub fx-legenda"><span class="fx-cel pago">✓</span> pago <span class="fx-cel parcial">½</span> parcial <span class="fx-cel aberto">!</span> em aberto <span class="fx-cel a_receber">…</span> a receber <span class="fx-cel sem">·</span> sem cobrança</p>`;
    partes.push(card('Pago e em aberto', filtro + `<div class="fx-mm-rolo">${cab}${corpo || vazio('Ninguém com esse filtro.')}</div>` + legenda, 'pelo mês de referência'));
    return casca(partes, 'clientes_mes');
  }
  function detalheCliente(d, l) {
    const doCliente = (d.transacoes || []).flatMap((t) => X().pedacos(t).filter((p) => String(p.cliente_id) === String(l.cliente_id) && p.valor > 0).map((p) => ({ ...p, historico: t.banco.historico })));
    return `<div class="fx-mm-det">${doCliente.length ? doCliente.slice().reverse().map((p) => `<div class="fx-mini"><span>${esc(dataCurta(p.data))} · ${esc(p.historico)} <small>(ref. ${esc(mesCurto(p.competencia))})</small></span><span>${p.status !== 'pago' ? pill(STATUS_NOME[p.status], STATUS_TOM[p.status]) : ''} <b>${esc(rs(p.valor))}</b> <button type="button" class="fv2-link" data-fx="ir-lanc" data-valor="${esc(p.id)}" data-mes="${esc(p.data.slice(0, 7))}">abrir</button></span></div>`).join('')
      : '<p class="fv2-sub">Nenhuma entrada ligada a este cliente no extrato.</p>'}</div>`;
  }

  // =====================================================================================================
  // CARTÃO
  // =====================================================================================================
  const SITUACAO_FATURA = { paga: ['Paga', 'g'], parcial: ['Paga em parte', 'a'], em_aberto: ['Em aberto', 'r'], vazia: ['Vazia', 'n'] };
  function cartao(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.cartao, faturas = d.cartao?.faturas || [], soltos = d.cartao?.pagamentos_sem_fatura || [];
    if (!/^\d{4}-\d{2}$/.test(u.fatura || '')) u.fatura = faturas[0]?.fatura || d.hoje?.slice(0, 7) || '';
    const meses = [...new Set([...faturas.map((f) => f.fatura), d.hoje?.slice(0, 7), u.fatura].filter(Boolean))].sort();
    const doMes = faturas.filter((f) => f.fatura === u.fatura);
    const total = doMes.reduce((s, f) => s + f.total, 0), pago = doMes.reduce((s, f) => s + f.pago_no_extrato, 0), falta = doMes.reduce((s, f) => s + f.falta, 0);
    const itens = doMes.flatMap((f) => f.itens.map((i) => ({ ...i, _cartao: f.cartao }))).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const semCat = itens.filter((i) => i.categoria === 'a_classificar').length, emAberto = itens.filter((i) => i.status !== 'pago').length;
    const pagamentos = doMes.flatMap((f) => f.pagamentos).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const situacao = !doMes.length ? 'vazia' : doMes.every((f) => f.situacao === 'paga') ? 'paga' : doMes.some((f) => f.situacao === 'parcial' || f.situacao === 'paga') ? 'parcial' : doMes.every((f) => f.situacao === 'vazia') ? 'vazia' : 'em_aberto';
    const cartoes = [...new Set(doMes.map((f) => f.cartao))];
    const acoes = `<button type="button" class="fv2-btn d3f-cinza" data-fx="cartao-colar">Colar fatura</button><button type="button" class="fv2-btn p" data-fx="cartao-novo">${IC.mais}Novo item</button>`;
    const partes = [topo('Cartão de crédito', acoes, mesNav(meses, u.fatura, 'cartao', (m) => `fatura de ${soMes(m)}`), `<span class="d3f-data">${esc(cartoes.join(' · ') || 'Cartão da agência')}</span>`)];
    const frase = !faturas.length ? 'Cole os itens da fatura para ver cada compra.'
      : falta > 0 || semCat ? `${falta > 0 ? `Faltam ${esc(rs(falta))} na fatura` : 'Fatura quitada'}${semCat ? ` e ${quantos(semCat, 'item sem categoria', 'itens sem categoria')}` : ''}.`
      : soltos.length ? `${quantos(soltos.length, 'pagamento', 'pagamentos')} de cartão sem fatura.` : 'Fatura quitada e tudo com categoria.';
    partes.push(!faturas.length ? acao(frase, 'Colar fatura', 'data-fx="cartao-colar"')
      : semCat ? acao(frase, `Ver ${semCat === 1 ? 'o item' : 'os ' + n0(semCat)}`, 'data-fx="chip" data-alvo="cartao" data-valor="semcat"')
      : soltos.length && !(falta > 0) ? acao(frase, 'Ver', 'data-fx="foco" data-valor="soltos"') : acao(frase));
    const anteriores = faturas.filter((f) => f.fatura <= u.fatura), porFatura = [...new Set(anteriores.map((f) => f.fatura))].sort().slice(-6).map((m) => anteriores.filter((f) => f.fatura === m).reduce((s, f) => s + f.total, 0));
    const antes = [...new Set(faturas.map((f) => f.fatura))].sort().filter((m) => m < u.fatura).slice(-1)[0];
    partes.push(nums([
      { rotulo: 'Total da fatura', valor: mil(total), serie: porFatura, sub: antes ? `${mes3(antes)} ${mil(faturas.filter((f) => f.fatura === antes).reduce((s, f) => s + f.total, 0))}` : quantos(itens.length, 'item', 'itens') },
      { rotulo: 'Pago · pelo extrato', valor: mil(pago), tom: pago ? 'g d3f-verde' : 'q', barra: pc(pago, total), sub: `${quantos(pagamentos.length, 'pagamento', 'pagamentos')} · ${pc(pago, total)}%` },
      { rotulo: 'Falta pagar', valor: mil(falta), tom: falta > 0 ? '' : 'q', sub: pill(...SITUACAO_FATURA[situacao]) },
      { rotulo: 'Itens', valor: n0(itens.length), sub: semCat ? `<span class="d3f-r">${n0(semCat)} sem categoria</span>` : 'todos com categoria', attrs: 'data-fx="chip" data-alvo="cartao" data-valor="todos"' },
    ]));
    if (u.colar) partes.push(colarHtml(d));
    if (u.novo) partes.push(card('Novo item da fatura', itemCampos(d, { fatura: u.fatura, data: `${u.fatura}-01`, status: 'em_aberto' }), '', 'fx-form-caixa'));
    const vis = itens.filter((i) => (u.chip === 'aberto' ? i.status !== 'pago' : u.chip === 'semcat' ? i.categoria === 'a_classificar' : true));
    const cabe = u.inteira ? vis : vis.slice(0, 10), resto = vis.slice(cabe.length);
    const linhaItem = (i) => {
      const aberta = u.aberta === i.id || u.editando === i.id, semC = i.categoria === 'a_classificar';
      const quem = [semC ? '' : nomeCat(d, i.categoria), i.quem, i.cliente_nome, cartoes.length > 1 ? i._cartao : ''].filter(Boolean).map(esc).join(' · ');
      return `<div class="v2-abre fv2-linha fx-item" data-linha="${esc(i.id)}" aria-expanded="${aberta}"><div class="fv2-lin"><span class="fx-dia">${dataCurta(i.data)}</span>
          <button type="button" class="fv2-txt" data-fx="abrir" data-alvo="cartao" data-valor="${esc(i.id)}" aria-expanded="${aberta}"><span class="fx-item-txt"><b>${esc(i.descricao)}${i.parcela ? ` <span class="d3f-mes">· ${esc(i.parcela)}</span>` : ''}</b><small${semC ? ' class="d3f-r"' : ''}>${semC ? 'A classificar' + (quem ? ' · ' + quem : '') : quem}</small></span></button>
          <span class="d3f-dir">${pill(STATUS_NOME[i.status] || 'Em aberto', STATUS_TOM[i.status] || 'a')}</span><b class="fx-valor s">${esc(rs(i.valor))}</b></div>
        <div class="v2-mais"><div><div class="fv2-det">${u.editando === i.id ? `<div class="fx-form-caixa">${itemCampos(d, i)}</div>` : `<div class="fx-linha-acoes"><span class="fv2-seg fx-seg-p" role="group" aria-label="Situação do item">${['pago', 'nao_pago', 'em_aberto'].map((s) => `<button type="button" data-fx="item-status" data-id="${esc(i.id)}" data-valor="${s}" aria-pressed="${i.status === s}">${STATUS_NOME[s]}</button>`).join('')}</span><button type="button" class="fv2-btn s" data-fx="item-editar" data-valor="${esc(i.id)}">Editar</button></div>`}</div></div></div></div>`;
    };
    const cabItens = `<span class="d3f-card-meio">${pill(...SITUACAO_FATURA[situacao])}${chips('cartao', [['todos', 'Todos', itens.length], ['aberto', 'Em aberto', emAberto], ['semcat', 'Sem categoria', semCat, semCat ? 'r' : '']], u.chip)}</span>`;
    const itensCard = `<section class="fv2-card d3f-tabela fx-itens" data-fx-card="itens"><div class="fv2-card-topo"><h2>Itens</h2>${cabItens}</div>
      ${cabe.length ? cabeca([['fx-dia', 'Dia'], ['fv2-txt', 'Item'], ['d3f-dir', 'Situação'], ['fx-valor', 'Valor']]) + cabe.map(linhaItem).join('') : vazio(itens.length ? 'Nada com esse filtro.' : 'Nenhum item nesta fatura.', itens.length ? '' : '<button type="button" class="fv2-btn s" data-fx="cartao-colar">Colar itens da fatura</button>')}
      ${resto.length ? `<div class="fv2-pe"><button type="button" class="d3f-mais" data-fx="mais" data-alvo="cartao">+${n0(resto.length)} <span>· ${esc(rs(resto.reduce((s, i) => s + Number(i.valor || 0), 0)))}</span></button></div>` : ''}</section>`;
    const porCat = new Map();
    for (const f of doMes) for (const c of f.por_categoria) porCat.set(c.categoria, { ...c, total: (porCat.get(c.categoria)?.total || 0) + c.total });
    const cats = [...porCat.values()].sort((a, b) => b.total - a.total), maxCat = Math.max(1, ...cats.map((c) => c.total));
    const lado = [cats.length ? card('Por categoria', cats.map((c) => gx(esc(c.nome), c.total / maxCat * 100, esc(rs(c.total)), { tom: c.categoria === 'a_classificar' ? 'r' : '' })).join(''), esc(rs(total))) : '',
      card('Pagamentos', pagamentos.length ? pagamentos.map((p) => `<div class="fx-mini fx-pag"><span class="fx-dia">${esc(dataCurta(p.data))}</span><span>${esc(p.historico)}</span><b class="fx-valor e">${esc(rs(p.valor))}</b></div>`).join('') : '<p class="fv2-sub">Nenhum pagamento ligado a esta fatura.</p>', 'do extrato'),
      soltos.length ? card('Sem fatura', soltos.map((p) => `<div class="fx-mini fx-pag"><span class="fx-dia">${esc(dataCurta(p.data))}</span><span>${esc(p.historico)}</span><b>${esc(rs(p.valor))}</b><button type="button" class="fv2-btn s" data-fx="ir-lanc" data-valor="${esc(p.id)}" data-mes="${esc(p.data.slice(0, 7))}">No extrato</button></div>`).join(''), pill(String(soltos.length), 'a'), 'fx-soltos', 'soltos') : ''].join('');
    partes.push(`<div class="fx-duas"><div class="fx-col">${itensCard}</div><div class="fx-col fx-lado">${lado}</div></div>`);
    return casca(partes, 'cartao');
  }
  // Os campos do item da fatura: no "Novo item" (cartão no topo) e na linha que abre (editar no lugar).
  function itemCampos(d, it) {
    return `<div class="fx-grade" data-fx-form="item" data-id="${esc(it.id || '')}">
      ${campo('O que é', `<input name="descricao" class="fx-in" value="${esc(it.descricao || '')}" placeholder="Adobe, almoço com cliente">`, 'largo')}
      ${campo('Valor', `<input name="valor" class="fx-in fx-num" inputmode="decimal" value="${esc(it.valor != null ? String(it.valor).replace('.', ',') : '')}">`)}
      ${campo('Data da compra', `<input name="data" type="date" class="fx-in" value="${esc(it.data || '')}">`)}
      ${campo('Fatura', `<input name="fatura" type="month" class="fx-in" value="${esc(it.fatura || '')}">`)}
      ${campo('Categoria', `<select name="categoria" class="fx-sel">${opcoesCat(d, it.categoria || 'a_classificar', { tipo: 'saida' })}</select>`)}
      ${campo('Parcela', `<input name="parcela" class="fx-in" value="${esc(it.parcela || '')}" placeholder="1/3">`)}
      ${campo('Cliente', `<select name="cliente_id" class="fx-sel">${opcoesCliente(d, it.cliente_id)}</select>`)}
      ${campo('Quem usou', `<input name="quem" class="fx-in" value="${esc(it.quem || '')}">`)}
      ${campo('Cartão', `<input name="cartao" class="fx-in" value="${esc(it.cartao || 'Cartão da agência')}">`)}
      ${campo('Situação', `<select name="status" class="fx-sel">${['pago', 'nao_pago', 'em_aberto'].map((s) => `<option value="${s}"${(it.status || 'em_aberto') === s ? ' selected' : ''}>${STATUS_NOME[s]}</option>`).join('')}</select>`)}
    </div><div class="fx-linha-acoes fx-fim">${it.id ? `<button type="button" class="fv2-btn s fv2-perigo" data-fx="item-tirar" data-valor="${esc(it.id)}">Tirar da fatura</button>` : ''}<button type="button" class="fv2-btn s" data-fx="item-fechar">Cancelar</button><button type="button" class="fv2-btn s d3f-escuro v2-estado" data-fx="item-salvar">Salvar</button></div>`;
  }
  // Colar a fatura: uma linha por compra, "dd/mm descrição valor" (como vem no app do banco ou no PDF). Parcela "2/5" vira parcela.
  function lerFaturaColada(texto, fatura) {
    const ano = Number(fatura.slice(0, 4)), mesF = Number(fatura.slice(5));
    return String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const dm = /^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\s+/.exec(l);
      const v = /(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+(?:\.\d{2})?)\s*$/.exec(l);
      if (!v) return null;
      let resto = l.slice(dm ? dm[0].length : 0, v.index).replace(/R\$\s*$/, '').trim();
      const pa = /(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(resto) || /parc(?:ela)?\s*(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/i.exec(resto);
      const parcela = pa ? `${Number(pa[1])}/${Number(pa[2])}` : '';
      if (pa) resto = resto.replace(pa[0], '').trim();
      let data = '';
      if (dm) { const m = Number(dm[2]); const a = dm[3] ? (dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3])) : (m > mesF ? ano - 1 : ano); data = `${a}-${dm[2]}-${dm[1]}`; }
      return { descricao: resto || 'Item da fatura', valor: numero(v[1]), data, parcela, fatura };
    }).filter((x) => x && x.valor);
  }
  function colarHtml(d) {
    return card('Colar itens da fatura', `<p class="fv2-sub">Uma compra por linha: <code>12/10 ADOBE 2/12 99,90</code></p>
      <div class="fx-grade">${campo('Fatura de', `<input name="cf_fatura" type="month" class="fx-in" value="${esc(ui.cartao.fatura)}">`)}${campo('Cartão', '<input name="cf_cartao" class="fx-in" value="Cartão da agência">')}</div>
      <textarea name="cf_texto" class="fx-in fx-area" rows="7" aria-label="Itens da fatura"></textarea>
      <div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn s" data-fx="cartao-colar">Cancelar</button><button type="button" class="fv2-btn s d3f-escuro" data-fx="colar-salvar">Lançar os itens</button></div>`, '', 'fx-colar');
  }

  // =====================================================================================================
  // GASTOS FIXOS
  // =====================================================================================================
  const FORMA_NOME = { pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão', debito: 'Débito automático' };
  function fixos(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.fixos, lista = d.fixos || [], hoje = d.hoje || '';
    const meses = [...new Set([...(d.meses || []), d.hoje?.slice(0, 7)].filter(Boolean))].sort();
    if (!u.mes || !meses.includes(u.mes)) u.mes = d.hoje?.slice(0, 7) || meses[meses.length - 1] || '';
    const a = X().analisarFixos(lista, d.transacoes || [], u.mes, d.cartao?.itens || []);
    const entradaMedia = Object.values(d.projecao?.base?.entradas_por_categoria || {}).reduce((s, v) => s + Number(v || 0), 0);
    const pct = entradaMedia ? Math.round(a.total / entradaMedia * 100) : null;
    const provaveis = fixosProvaveis(d.transacoes || [], lista);
    const partes = [topo('Gastos fixos', `<button type="button" class="fv2-btn p" data-fx="fixo-novo">${IC.mais}Novo gasto fixo</button>`, mesNav(meses, u.mes, 'fixos'))];
    const faltam = a.fixos.filter((f) => !f.achado && f.vence <= hoje);
    partes.push(!lista.length ? acao(provaveis.length ? `${quantos(provaveis.length, 'gasto parece fixo', 'gastos parecem fixos')} pelo extrato.` : 'Nenhum gasto fixo cadastrado.', provaveis.length ? 'Ver' : 'Cadastrar', provaveis.length ? 'data-fx="foco" data-valor="provaveis"' : 'data-fx="fixo-novo"')
      : faltam.length === 1 ? acao(`${esc(faltam[0].nome)} venceu dia ${n0(faltam[0].dia)} e não saiu no extrato.`, 'Ver no extrato', 'data-fx="ir-aba" data-valor="extrato" data-chip="saidas"')
      : faltam.length ? acao(`${n0(faltam.length)} fixos venceram e não saíram no extrato.`, 'Ver no extrato', 'data-fx="ir-aba" data-valor="extrato" data-chip="saidas"')
      : acao('Tudo que venceu já saiu no extrato.'));
    partes.push(nums([
      { rotulo: 'Por mês', valor: mil(a.total), sub: quantos(a.quantidade, 'fixo', 'fixos') },
      { rotulo: 'No ano', valor: mil(a.anual), sub: `${esc(rs(a.total))} × 12` },
      { rotulo: `Já saíram em ${soMes(u.mes)}`, valor: `${n0(a.achados)}<small class="d3f-de"> / ${n0(a.quantidade)}</small>`, barra: pc(a.achados, a.quantidade), tom: a.quantidade && a.achados === a.quantidade ? 'g' : '' },
      { rotulo: 'Do que entra', valor: pct != null ? `${pct}%` : '0%', barra: pct != null ? pct : null, tom: pct == null ? 'q' : '', sub: pct == null ? 'sem média ainda' : '' },
    ]));
    if (u.novo) partes.push(card('Novo gasto fixo', fixoCampos(d, u.rascunho || {}), '', 'fx-form-caixa'));
    const linhas = a.fixos.map((f) => {
      const editando = u.editando === f.id, naoVeio = !f.achado && f.vence <= hoje;
      const onde = f.achado ? pill(`saiu ${dataCurta(f.achado.data)}${f.diferenca ? ` · ${f.diferenca > 0 ? '+' : '−'}${rs(Math.abs(f.diferenca))}` : ''}`, f.diferenca > 0 ? 'a' : 'g') : naoVeio ? pill('não apareceu', 'r') : pill(`vence ${dataCurta(f.vence)}`, 'n');
      return `<div class="v2-abre fv2-linha fx-item${naoVeio ? ' d3f-alerta' : ''}" data-linha="${esc(f.id)}" aria-expanded="${editando}"><div class="fv2-lin"><b class="fx-dia">${String(f.dia).padStart(2, '0')}</b>
          <span class="fv2-txt fx-item-txt"><b>${esc(f.nome)}</b> <small>· ${esc(nomeCat(d, f.categoria))} · ${esc(FORMA_NOME[f.forma] || f.forma)}${f.observacao ? ` · ${esc(f.observacao)}` : ''}</small></span>
          <span class="d3f-dir">${onde}</span><b class="fx-valor s">${esc(rs(f.valor))}</b><button type="button" class="fv2-link fx-editar" data-fx="fixo-editar" data-valor="${esc(f.id)}" aria-expanded="${editando}">${editando ? 'fechar' : 'editar'}</button></div>
        <div class="v2-mais"><div>${editando ? `<div class="fv2-det fx-form-caixa">${fixoCampos(d, f)}</div>` : ''}</div></div></div>`;
    }).join('');
    const inativos = lista.filter((f) => !X().fixoVigente(f, u.mes));
    const pe = `${inativos.length ? `<details class="fx-det"><summary>${quantos(inativos.length, 'parado', 'parados')}</summary>${inativos.map((f) => `<div class="fx-mini"><span>${esc(f.nome)} · ${esc(rs(f.valor))}${f.fim ? ` · até ${esc(mesCurto(f.fim))}` : ''}</span><button type="button" class="fv2-link" data-fx="fixo-editar" data-valor="${esc(f.id)}">editar</button></div>`).join('')}</details>` : ''}${a.quantidade ? `<span class="d3f-total"><span class="fv2-sub">total</span><b>${esc(rs(a.total))}</b></span>` : ''}`;
    const edInativo = inativos.find((f) => f.id === u.editando);
    const lado = [card('Onde pesa', a.por_categoria.map((c) => gx(esc(c.nome), c.total / Math.max(1, a.por_categoria[0]?.total || 1) * 100, esc(rs(c.total)), { fatia: c.pct })).join('') || '<p class="fv2-sub">Cadastre para ver.</p>', 'dos fixos'),
      provaveis.length ? card('Parecem fixos', provaveis.slice(0, 8).map((p, i) => `<div class="fx-mini fx-provavel"><span><b>${esc(p.nome)}</b> <small>· ${esc(nomeCat(d, p.categoria))} · ${n0(p.meses)} meses · dia ~${n0(p.dia)}</small></span><b>${esc(rs(p.valor))}</b><button type="button" class="fv2-btn s${i ? '' : ' d3f-escuro'} d3f-voa" data-fx="fixo-provavel" data-valor="${i}">cadastrar</button></div>`).join('')
        + `<div class="fx-criterios">${pill('mesmo destino')}${pill('valor ±10%')}${pill('2+ meses')}</div>`, `pelo extrato · ${n0(provaveis.length)}`, '', 'provaveis') : ''].join('');
    partes.push(`<div class="fx-duas"><div class="fx-col"><section class="fv2-card d3f-tabela fx-fixos" data-fx-card="fixos"><div class="fv2-card-topo"><h2>Fixos de ${esc(soMes(u.mes))}</h2><span class="fv2-sub">pelo dia</span></div>
      ${linhas ? cabeca([['fx-dia', 'Dia'], ['fv2-txt', 'Gasto'], ['d3f-dir', 'No extrato'], ['fx-valor', 'Valor'], ['fx-editar', '']]) + linhas : vazio('Nenhum gasto fixo cadastrado.')}
      ${edInativo ? `<div class="fv2-det fx-form-caixa">${fixoCampos(d, edInativo)}</div>` : ''}${pe ? `<div class="fv2-pe">${pe}</div>` : ''}</section></div>
      <div class="fx-col fx-lado">${lado}</div></div>`);
    return casca(partes, 'fixos');
  }
  // O que se repete no extrato: mesma contraparte (ou mesmo histórico) e valor parecido (±10%) em 2+ meses diferentes.
  function fixosProvaveis(lista, cadastrados) {
    const grupos = new Map();
    for (const t of lista) {
      if (t.banco.valor >= 0) continue;
      const cat = t.real.categoria;
      if (['cartao_agencia', 'salario', 'pro_labore', 'retirada_socio', 'freela', 'combustivel', 'alimentacao', 'juros_banco'].includes(cat)) continue;
      const nome = (t.banco.contraparte || t.banco.historico.replace(/\d[\d/.]*/g, '').trim()).slice(0, 40);
      const k = semAcento(nome) + '|' + Math.round(Math.log(Math.abs(t.banco.valor)) * 10);
      const g = grupos.get(k) || { nome, categoria: cat, valores: [], meses: new Set(), dias: [] };
      g.valores.push(Math.abs(t.banco.valor)); g.meses.add(t.banco.data.slice(0, 7)); g.dias.push(Number(t.banco.data.slice(8, 10)));
      grupos.set(k, g);
    }
    const ja = cadastrados.map((f) => semAcento(f.contem || f.nome));
    return [...grupos.values()].filter((g) => g.meses.size >= 2 && !ja.some((j) => j && semAcento(g.nome).includes(j)))
      .map((g) => ({ nome: g.nome, categoria: g.categoria, meses: g.meses.size, valor: Math.round(g.valores.reduce((s, v) => s + v, 0) / g.valores.length * 100) / 100, dia: Math.round(g.dias.reduce((s, v) => s + v, 0) / g.dias.length) }))
      .sort((a, b) => b.meses - a.meses || b.valor - a.valor);
  }
  // Os campos do gasto fixo: no "Novo gasto fixo" (cartão no topo) e na linha que abre (editar no lugar).
  function fixoCampos(d, f) {
    return `<div class="fx-grade" data-fx-form="fixo" data-id="${esc(f.id || '')}">
      ${campo('Nome', `<input name="nome" class="fx-in" value="${esc(f.nome || '')}" placeholder="Adobe, aluguel, contador">`, 'largo')}
      ${campo('Valor por mês', `<input name="valor" class="fx-in fx-num" inputmode="decimal" value="${esc(f.valor != null ? String(f.valor).replace('.', ',') : '')}">`)}
      ${campo('Dia', `<input name="dia" type="number" min="1" max="31" class="fx-in" value="${esc(f.dia || '')}">`)}
      ${campo('Categoria', `<select name="categoria" class="fx-sel">${opcoesCat(d, f.categoria || 'ferramentas', { tipo: 'saida' })}</select>`)}
      ${campo('Como paga', `<select name="forma" class="fx-sel">${Object.entries(FORMA_NOME).map(([k, n]) => `<option value="${k}"${(f.forma || 'pix') === k ? ' selected' : ''}>${n}</option>`).join('')}</select>`)}
      ${campo('No extrato', `<input name="contem" class="fx-in" value="${esc(f.contem || '')}" placeholder="pedaço do nome">`)}
      ${campo('Desde', `<input name="inicio" type="month" class="fx-in" value="${esc(f.inicio || '')}">`)}
      ${campo('Até', `<input name="fim" type="month" class="fx-in" value="${esc(f.fim || '')}">`)}
      ${campo('Observação', `<input name="observacao" class="fx-in" value="${esc(f.observacao || '')}">`, 'largo')}
      ${campo('Ativo', `<select name="ativo" class="fx-sel"><option value="1"${f.ativo !== false ? ' selected' : ''}>sim</option><option value=""${f.ativo === false ? ' selected' : ''}>parado</option></select>`)}
    </div><div class="fx-linha-acoes fx-fim">${f.id ? `<button type="button" class="fv2-btn s fv2-perigo" data-fx="fixo-tirar" data-valor="${esc(f.id)}">Apagar</button>` : ''}<button type="button" class="fv2-btn s" data-fx="fixo-fechar">Cancelar</button><button type="button" class="fv2-btn s d3f-escuro v2-estado" data-fx="fixo-salvar">Salvar</button></div>`;
  }

  // =====================================================================================================
  // PROJEÇÃO
  // =====================================================================================================
  function cenarioAtual(d) {
    const c = ui.projecao.cenario;
    const fixosPorId = new Map((d.fixos || []).map((f) => [f.id, f]));
    const clientes = new Map((d.clientes || []).map((x) => [String(x.id), x]));
    return {
      cortes: Object.entries(c.cortes).filter(([, p]) => Number(p) > 0).map(([categoria, percentual]) => ({ categoria, percentual: Number(percentual) })),
      economias: Object.entries(c.economias).filter(([id, on]) => on && fixosPorId.has(id)).map(([id]) => ({ nome: fixosPorId.get(id).nome, valor: fixosPorId.get(id).valor, a_partir: 1 })),
      clientes_novos: c.clientes_novos.filter((x) => numero(x.valor) > 0).map((x) => ({ quantos: Number(x.quantos) || 1, valor: numero(x.valor), a_partir: Number(x.a_partir) || 1 })),
      clientes_perdidos: Object.entries(c.clientes_perdidos).filter(([id, on]) => on && clientes.has(id)).map(([id]) => ({ nome: clientes.get(id).nome, valor: clientes.get(id).mensalidade || 0, a_partir: 1 })),
      gastos_novos: c.gastos_novos.filter((x) => numero(x.valor) > 0).map((x) => ({ nome: x.nome, valor: numero(x.valor), a_partir: Number(x.a_partir) || 1 })),
      ajuste_entradas_pct: Number(c.ajuste_entradas_pct) || 0,
    };
  }
  function projecao(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.projecao, base = d.projecao?.base;
    const partes = [topo('Relatórios e projeção', '', `<span class="fv2-seg" role="group" aria-label="Horizonte">${[3, 6, 12].map((n) => `<button type="button" data-fx="horizonte" data-valor="${n}" aria-pressed="${u.horizonte === n}">${n} meses</button>`).join('')}</span>`)];
    if (!base || !base.meses_usados?.length) {
      partes.push(acao('Sem mês fechado e conferido para projetar.', 'Ir ao extrato', 'data-fx="ir-aba" data-valor="extrato"'));
      return casca(partes, 'projecao');
    }
    const cen = cenarioAtual(d);
    const hoje = X().projetar(base, {}, u.horizonte), com = X().projetar(base, cen, u.horizonte);
    const mexeu = Boolean(cen.cortes.length || cen.economias.length || cen.clientes_novos.length || cen.clientes_perdidos.length || cen.gastos_novos.length || cen.ajuste_entradas_pct);
    const diff = Math.round((com.saldo_final - hoje.saldo_final) * 100) / 100, ultimo = hoje.meses[hoje.meses.length - 1]?.mes || '';
    const queda = Math.round((hoje.saldo_final - base.saldo_hoje) * 100) / 100;
    const entra = sumObj(base.entradas_por_categoria), sai = sumObj(base.saidas_por_categoria);
    partes.push(acao(`No ritmo atual, o caixa vai a <b>${esc(mil(hoje.saldo_final))}</b> em ${esc(soMes(ultimo))}.${hoje.primeiro_mes_negativo ? ` Negativo em ${esc(soMes(hoje.primeiro_mes_negativo))}.` : ''}`,
      mexeu ? 'Guardar o cenário' : '', 'data-fx="cenario-focar"'));
    const usados = base.meses_usados.map((m) => mes3(m));
    partes.push(nums([
      { rotulo: 'Caixa hoje', valor: mil(base.saldo_hoje), tom: base.saldo_hoje < 0 ? 'r' : '', serie: (d.serie || []).filter((s) => s.saldo_final != null).slice(-6).map((s) => s.saldo_final),
        sub: (d.serie || []).find((s) => s.saldo_final != null) ? `${mes3(d.serie.find((s) => s.saldo_final != null).mes)} ${mil(d.serie.find((s) => s.saldo_final != null).saldo_final)}` : '' },
      { rotulo: `Em ${u.horizonte} meses · como está`, valor: mil(hoje.saldo_final), tom: hoje.saldo_final < 0 ? 'r' : queda < 0 ? 'a' : 'g', sub: `<span class="${queda < 0 ? 'd3f-a' : 'd3f-g'}">${queda < 0 ? '−' : '+'}${esc(mil(Math.abs(queda)).replace('-', ''))}</span>` },
      { rotulo: `Em ${u.horizonte} meses · com o cenário`, valor: mil(com.saldo_final), tom: !mexeu ? 'q' : com.saldo_final < 0 ? 'r' : com.saldo_final >= hoje.saldo_final ? 'g' : 'a',
        sub: mexeu ? `<span class="${diff >= 0 ? 'd3f-g' : 'd3f-a'}">${diff >= 0 ? '+' : '−'}${esc(mil(Math.abs(diff)))} · ${com.primeiro_mes_negativo ? `negativo em ${esc(mes3(com.primeiro_mes_negativo))}` : 'sem negativo'}</span>` : 'mexa no E se…' },
      { rotulo: `Por mês · ${usados.length > 1 ? `${usados[0]} a ${usados[usados.length - 1]}` : usados[0]}`, valor: mil(entra - sai), tom: entra - sai < 0 ? 'r' : 'g',
        sub: duas(entra, sai, `entra ${esc(mil(entra).replace('R$ ', ''))}`, `sai ${esc(mil(sai).replace('R$ ', ''))}`) },
    ]));
    const leg = `<span class="d3f-leg"><i></i>realizado</span><span class="d3f-leg proj"><i></i>como está</span>${mexeu ? '<span class="d3f-leg cen"><i></i>com o cenário</span>' : ''}`;
    partes.push(`<div class="fx-duas fx-proj"><div class="fx-col">${card('Caixa mês a mês', grafico(d, hoje, com, mexeu) + tabelaProj(hoje, com, mexeu), leg, 'fx-caixa')}
      <div class="fx-par">${card('Fluxo realizado', fluxoRealizado(d), '<span class="d3f-leg"><i></i>entrou</span><span class="d3f-leg cinza"><i></i>saiu</span>')}${card('Resultado por grupo', dreHtml(d), 'em mil')}</div></div>
      <div class="fx-col fx-lado">${cenarioHtml(d, base)}</div></div>`);
    return casca(partes, 'projecao');
  }
  const sumObj = (o) => Object.values(o || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const emMil = (v) => { const n = Number(v) || 0; return `${n < 0 ? '−' : ''}${(Math.abs(n) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`; };
  // Caixa mês a mês: o realizado (cheio, com o ponto no hoje), o "como está" (tracejado) e o cenário (verde).
  function grafico(d, hoje, com, mexeu) {
    const real = (d.serie || []).filter((s) => s.saldo_final != null).map((s) => ({ mes: s.mes, saldo: s.saldo_final }));
    const pontos = [...real.map((r) => ({ ...r, tipo: 'real' })), ...hoje.meses.map((m, i) => ({ mes: m.mes, saldo: m.saldo, com: com.meses[i].saldo, tipo: 'proj' }))];
    if (!pontos.length) return '';
    const vals = pontos.flatMap((p) => [p.saldo, p.com]).filter((v) => v != null);
    const min = Math.min(0, ...vals), max = Math.max(0, ...vals), W = 640, H = 190, pad = 14;
    const x = (i) => pad + (pontos.length === 1 ? 0 : i * (W - 2 * pad) / (pontos.length - 1));
    const y = (v) => H - pad - ((v - min) / ((max - min) || 1)) * (H - 2 * pad);
    const nReal = real.length;
    const ptsReal = pontos.slice(0, nReal).map((p, i) => [x(i), y(p.saldo)]);
    const fmt = (l) => l.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
    const projHoje = pontos.map((p, i) => (i >= Math.max(0, nReal - 1) ? [x(i), y(p.saldo)] : null)).filter(Boolean);
    const projCom = pontos.map((p, i) => (i === nReal - 1 ? [x(i), y(p.saldo)] : i >= nReal ? [x(i), y(p.com)] : null)).filter(Boolean);
    let comp = 0; for (let i = 1; i < ptsReal.length; i++) comp += Math.hypot(ptsReal[i][0] - ptsReal[i - 1][0], ptsReal[i][1] - ptsReal[i - 1][1]);
    const fim = ptsReal[ptsReal.length - 1];
    const ult = pontos.length - 1;
    const rot = (v, cls, yy) => `<span class="d3f-rot ${cls}" style="top:${(yy / H * 100).toFixed(1)}%">${esc(mil(v))}</span>`;
    return `<div class="fx-graf-caixa"><svg class="d3-graf fx-graf" viewBox="0 0 ${W} ${H}" style="--d3-comp:${Math.ceil(comp) || 1}" role="img" aria-label="Saldo do caixa: realizado de ${esc(soMes(pontos[0].mes))} a ${esc(soMes(real[nReal - 1]?.mes || pontos[0].mes))} e projetado até ${esc(soMes(pontos[ult].mes))}${mexeu ? ', como está e com o cenário' : ''}">
      ${min < 0 ? `<line x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="zero"/>` : ''}
      ${projHoje.length > 1 ? `<polyline points="${fmt(projHoje)}" class="meta"/>` : ''}${mexeu && projCom.length > 1 ? `<polyline points="${fmt(projCom)}" class="com"/>` : ''}
      ${ptsReal.length > 1 ? `<polyline points="${fmt(ptsReal)}"/>` : ''}${fim ? `<circle cx="${fim[0].toFixed(1)}" cy="${fim[1].toFixed(1)}" r="5"/>` : ''}
    </svg>${mexeu ? rot(com.saldo_final, 'cen', y(com.saldo_final)) : ''}${rot(hoje.saldo_final, 'proj', y(hoje.saldo_final))}${fim ? `<span class="d3f-rot hoje" style="top:${(fim[1] / H * 100).toFixed(1)}%;left:${(fim[0] / W * 100).toFixed(1)}%">hoje · ${esc(mil(real[nReal - 1].saldo))}</span>` : ''}</div>
      <div class="d3f-eixo">${pontos.map((p, i) => (i === nReal - 1 ? `<b>${esc(mes3(p.mes))}</b>` : `<span>${esc(mes3(p.mes))}</span>`)).join('')}</div>`;
  }
  function tabelaProj(hoje, com, mexeu) {
    const m = hoje.meses, c = (v) => (v < 0 ? ' class="fx-neg"' : '');
    const linha = (rotulo, f, cls = '') => `<div class="fx-tr${cls ? ' ' + cls : ''}" role="row"><span>${rotulo}</span>${m.map((x, i) => { const v = f(x, i); return `<span${c(v)}>${esc(emMil(v))}</span>`; }).join('')}</div>`;
    return `<div class="fx-rolo"><div class="fx-tab fx-tab-proj" role="table" style="--n:${m.length}"><div class="fx-tr fx-th" role="row"><span>em mil</span>${m.map((x) => `<span>${esc(mes3(x.mes))}</span>`).join('')}</div>
      ${linha('Entra', (x, i) => (mexeu ? com.meses[i].entradas : x.entradas))}${linha('Sai', (x, i) => (mexeu ? com.meses[i].saidas : x.saidas))}${linha('Resultado', (x, i) => (mexeu ? com.meses[i].resultado : x.resultado))}
      ${linha('Saldo · como está', (x) => x.saldo, 'fx-apagado')}${mexeu ? linha('Saldo · cenário', (x, i) => com.meses[i].saldo, 'fx-tot') : ''}</div></div>`;
  }
  function fluxoRealizado(d) {
    const s = (d.serie || []).slice(-6);
    if (!s.length) return '<p class="fv2-sub">Sem extrato ainda.</p>';
    const max = Math.max(1, ...s.flatMap((m) => [m.entradas, m.saidas + m.cartao]));
    return s.map((m) => `<div class="fx-fluxo"><b>${esc(mes3(m.mes))}</b><span class="fx-fluxo-b"><i class="e" style="--v:${(m.entradas / max * 100).toFixed(1)}%"></i><i class="s" style="--v:${((m.saidas + m.cartao) / max * 100).toFixed(1)}%"></i></span><b class="${m.resultado < 0 ? 'd3f-a' : ''}">${esc(emMil(m.resultado))}</b>
      <span class="fv2-sub fx-fluxo-sub">${esc(emMil(m.entradas))} · ${esc(emMil(m.saidas + m.cartao))}${m.a_revisar ? ` · <b class="d3f-a">${n0(m.a_revisar)} a conferir</b>` : ''}</span></div>`).join('');
  }
  function dreHtml(d) {
    const meses = d.meses || [];
    if (!meses.length) return '<p class="fv2-sub">Sem extrato ainda.</p>';
    const ult = meses.slice(-4);
    const grupos = new Map();
    for (const m of ult) for (const c of X().resumo(d.transacoes || [], { mes: m }).categorias) {
      const g = grupos.get(c.grupo) || { grupo: c.grupo, tipo: c.tipo, por: {} };
      g.por[m] = (g.por[m] || 0) + c.total; grupos.set(c.grupo, g);
    }
    const linhas = [...grupos.values()].sort((a, b) => (a.tipo === 'entrada' ? -1 : 1) - (b.tipo === 'entrada' ? -1 : 1) || Math.abs(sumObj(b.por)) - Math.abs(sumObj(a.por)));
    const total = Object.fromEntries(ult.map((m) => [m, linhas.reduce((s, g) => s + (g.por[m] || 0), 0)]));
    return `<div class="fx-tab fx-dre" role="table" style="--n:${ult.length}"><div class="fx-tr fx-th" role="row"><span>Grupo</span>${ult.map((m, i) => `<span${i === ult.length - 1 ? ' class="fx-agora"' : ''}>${esc(mes3(m))}</span>`).join('')}</div>
      ${linhas.map((g) => `<div class="fx-tr" role="row"><span>${esc(g.grupo)}</span>${ult.map((m) => `<span class="${(g.por[m] || 0) < 0 ? 'fx-saida' : ''}">${g.por[m] ? esc(emMil(g.por[m])) : '·'}</span>`).join('')}</div>`).join('')}
      <div class="fx-tr fx-tot" role="row"><span>Resultado</span>${ult.map((m) => `<span class="${total[m] < 0 ? 'd3f-a' : ''}">${esc(emMil(total[m]))}</span>`).join('')}</div></div>`;
  }
  function cenarioHtml(d, base) {
    const c = ui.projecao.cenario;
    const saidas = Object.entries(base.saidas_por_categoria || {}).sort((a, b) => b[1] - a[1]);
    const cortes = saidas.map(([cat, v]) => `<div class="fx-corte"><span>${esc(nomeCat(d, cat))}</span><small>${esc(mil(v))}</small><select class="fx-sel" data-fx-campo="corte" data-valor="${cat}" aria-label="Cortar ${esc(nomeCat(d, cat))}">${[0, 10, 25, 50, 75, 100].map((p) => `<option value="${p}"${Number(c.cortes[cat] || 0) === p ? ' selected' : ''}>${p ? `−${p}%` : 'manter'}</option>`).join('')}</select></div>`).join('');
    const fixos = (d.fixos || []).filter((f) => f.ativo !== false).map((f) => `<label class="fx-check"><input type="checkbox" data-fx-campo="economia" data-valor="${esc(f.id)}"${c.economias[f.id] ? ' checked' : ''}> ${esc(f.nome)} <b>${esc(rs(f.valor))}</b></label>`).join('');
    const perder = (d.clientes || []).filter((x) => x.ativo !== false && x.mensalidade > 0).map((x) => `<label class="fx-check"><input type="checkbox" data-fx-campo="perder" data-valor="${esc(x.id)}"${c.clientes_perdidos[x.id] ? ' checked' : ''}> ${esc(x.nome)} <b>${esc(rs(x.mensalidade))}</b></label>`).join('');
    const novos = c.clientes_novos.map((x, i) => `<div class="fx-parte fx-frase d3-chegou"><input class="fx-in fx-num" data-fx-campo="novo-quantos" data-valor="${i}" type="number" min="1" max="50" value="${esc(x.quantos)}" aria-label="Quantos clientes"><span>de</span><input class="fx-in fx-num" data-fx-campo="novo-valor" data-valor="${i}" inputmode="decimal" value="${esc(x.valor)}" placeholder="R$/mês" aria-label="Valor por mês"><span>desde o mês</span><input class="fx-in fx-num" data-fx-campo="novo-mes" data-valor="${i}" type="number" min="1" max="12" value="${esc(x.a_partir)}" aria-label="A partir de qual mês"><button type="button" class="fv2-btn s fv2-seta" data-fx="novo-tirar" data-valor="${i}" aria-label="Tirar">×</button></div>`).join('');
    const gastos = c.gastos_novos.map((x, i) => `<div class="fx-parte fx-frase fx-gasto d3-chegou"><input class="fx-in" data-fx-campo="gasto-nome" data-valor="${i}" value="${esc(x.nome)}" placeholder="o quê" aria-label="Gasto novo"><input class="fx-in fx-num" data-fx-campo="gasto-valor" data-valor="${i}" inputmode="decimal" value="${esc(x.valor)}" placeholder="R$/mês" aria-label="Valor por mês"><span>desde o mês</span><input class="fx-in fx-num" data-fx-campo="gasto-mes" data-valor="${i}" type="number" min="1" max="12" value="${esc(x.a_partir)}" aria-label="A partir de qual mês"><button type="button" class="fv2-btn s fv2-seta" data-fx="gasto-tirar" data-valor="${i}" aria-label="Tirar">×</button></div>`).join('');
    const salvos = (d.projecao?.cenarios || []).map((s) => `<span class="fx-salvo"><button type="button" class="fv2-chip" data-fx="cenario-usar" data-valor="${esc(s.id)}">${esc(s.nome)}</button><button type="button" class="fv2-link" data-fx="cenario-tirar" data-valor="${esc(s.id)}" aria-label="Tirar ${esc(s.nome)}">×</button></span>`).join('');
    const nPerder = Object.values(c.clientes_perdidos).filter(Boolean).length, nCortar = Object.values(c.economias).filter(Boolean).length;
    return card('E se…', `<p class="fx-rot">Clientes novos</p>${novos}<button type="button" class="fv2-btn s" data-fx="novo-mais">+ clientes novos</button>
      <details class="fx-det fx-escolha"><summary><span class="fx-rot">Perder um cliente</span><span class="fv2-chip">escolher · ${n0(nPerder)}</span></summary>${perder || '<p class="fv2-sub">Nenhum cliente com mensalidade.</p>'}</details>
      ${fixos ? `<details class="fx-det fx-escolha"${nCortar ? ' open' : ''}><summary><span class="fx-rot">Cortar um gasto fixo</span><span class="fv2-chip">escolher · ${n0(nCortar)}</span></summary><div class="fx-checks">${fixos}</div></details>` : '<p class="fx-rot">Cortar um gasto fixo</p><p class="fv2-sub">Cadastre os fixos para cortar um a um.</p>'}
      <p class="fx-rot">Cortar por categoria · média</p>${cortes}
      <div class="fx-corte fx-corte-linha"><span class="fx-rot">Gasto novo</span><button type="button" class="fv2-btn s" data-fx="gasto-mais">+ gasto novo</button></div>${gastos}
      <div class="fx-corte"><span class="fx-rot">Reajuste das entradas</span><small></small><select class="fx-sel" data-fx-campo="ajuste" aria-label="Reajuste das entradas">${[-30, -20, -10, 0, 5, 10, 20, 30].map((p) => `<option value="${p}"${Number(c.ajuste_entradas_pct) === p ? ' selected' : ''}>${p > 0 ? '+' : ''}${p}%</option>`).join('')}</select></div>
      <div class="fx-linha-acoes fx-fim"><input class="fx-in" data-fx-campo="cenario-nome" value="${esc(ui.projecao.nome)}" placeholder="nome do cenário" aria-label="Nome do cenário"><button type="button" class="fv2-btn s" data-fx="cenario-limpar">Limpar</button><button type="button" class="fv2-btn s d3f-escuro v2-estado" data-fx="cenario-salvar">Guardar</button></div>
      ${salvos ? `<div class="fx-salvos"><span class="fv2-sub">Guardados</span>${salvos}</div>` : ''}`, 'muda na hora', 'fx-cenario');
  }

  // =====================================================================================================
  // VORCARO (Tesouraria): a tela de quem cuida do setor. O que ele viu, o que pede decisão e o que chegou do WhatsApp.
  // =====================================================================================================
  const ANEXO = { print: 'print', audio: 'áudio', mensagem: 'mensagem' };
  // A análise do setor: cada achado diz o que é (rot), quanto pesa (det) e leva ao lugar de resolver (btn). Do mais grave ao mais leve.
  function analise(d) {
    const out = [], lista = d.transacoes || [], hoje = d.hoje || '', mes = hoje.slice(0, 7);
    const ir = (aba, extra = {}) => ({ aba, ...extra });
    const saldo = d.projecao?.base?.saldo_hoje;
    if (saldo != null && saldo < 0) out.push({ g: 3, rot: 'Conta no negativo', det: rs(saldo), btn: 'Projeção', texto: `A conta está no negativo (${rs(saldo)}): o banco cobra juros do limite todo dia.`, ...ir('projecao') });
    const proj = d.projecao?.base?.meses_usados?.length ? X().projetar(d.projecao.base, {}, 6) : null;
    if (proj?.primeiro_mes_negativo) out.push({ g: 3, rot: 'Caixa fica negativo', det: nomeMes(proj.primeiro_mes_negativo), btn: 'Projeção', texto: `No ritmo dos últimos meses, o caixa fica negativo em ${nomeMes(proj.primeiro_mes_negativo)}.`, ...ir('projecao') });
    const juros = lista.filter((t) => t.banco.data.startsWith(mes)).flatMap((t) => X().pedacos(t)).filter((p) => p.categoria === 'juros_banco').reduce((s, p) => s - p.valor, 0);
    if (juros > 0) out.push({ g: 2, rot: 'Juros do limite', det: `${rs(juros)} em ${MESES[Number(mes.slice(5)) - 1]}`, btn: 'Extrato', texto: `Em ${MESES[Number(mes.slice(5)) - 1]} já foram ${rs(juros)} de juros por usar o limite da conta.`, ...ir('extrato', { cat: 'juros_banco' }) });
    const pend = (d.vorcaro?.propostas || []).filter((p) => p.estado === 'pendente').length;
    if (pend) out.push({ g: 2, rot: 'WhatsApp', det: `${n0(pend)} esperando`, texto: `${quantos(pend, 'lançamento chegou', 'lançamentos chegaram')} pelo WhatsApp e espera${pend === 1 ? '' : 'm'} vocês decidirem.`, ancora: 'whats' });
    const conferir = lista.filter((t) => !t.real.conferido).length;
    if (conferir) out.push({ g: 2, rot: 'Banco sem conferir', det: n0(conferir), btn: 'Extrato', texto: `${quantos(conferir, 'lançamento do banco', 'lançamentos do banco')} ainda sem conferir (para onde foi de verdade).`, ...ir('extrato', { chip: 'conferir' }) });
    const boletos = lista.filter((t) => t.real.categoria === 'receita_boleto' && !t.real.partes?.length);
    if (boletos.length) out.push({ g: 2, rot: 'Boletos para dividir', det: `${n0(boletos.length)} · ${rs(boletos.reduce((s, t) => s + t.banco.valor, 0))}`, btn: 'Dividir', texto: `${quantos(boletos.length, 'boleto recebido', 'boletos recebidos')} (${rs(boletos.reduce((s, t) => s + t.banco.valor, 0))}) para dividir entre os clientes.`, ...ir('extrato', { cat: 'receita_boleto' }) });
    const abertos = (d.por_cliente?.linhas || []).filter((l) => l.total_aberto > 0).sort((a, b) => b.total_aberto - a.total_aberto);
    if (abertos.length) out.push({ g: 2, rot: 'Mensalidade em aberto', det: rs(abertos.reduce((s, l) => s + l.total_aberto, 0)), btn: 'Ver', clientes: abertos.slice(0, 3).map((l) => l.cliente_nome), texto: `${quantos(abertos.length, 'cliente', 'clientes')} com mensalidade em aberto, ${rs(abertos.reduce((s, l) => s + l.total_aberto, 0))} no total: ${abertos.slice(0, 3).map((l) => l.cliente_nome).join(', ')}${abertos.length > 3 ? '…' : '.'}`, ...ir('clientes_mes', { chip: 'aberto' }) });
    const fx = d.fixos?.length ? X().analisarFixos(d.fixos, lista, mes, d.cartao?.itens || []) : null;
    const fxFalta = (fx?.fixos || []).filter((f) => !f.achado && f.vence <= hoje);
    if (fxFalta.length) out.push({ g: 1, rot: 'Fixo não apareceu', det: fxFalta.length === 1 ? `${fxFalta[0].nome} · ${rs(fxFalta[0].valor)}` : `${n0(fxFalta.length)} · ${fxFalta.slice(0, 2).map((f) => f.nome).join(', ')}${fxFalta.length > 2 ? '…' : ''}`, btn: 'Fixos', texto: `${quantos(fxFalta.length, 'gasto fixo venceu', 'gastos fixos venceram')} e não apareceu no extrato: ${fxFalta.slice(0, 3).map((f) => f.nome).join(', ')}${fxFalta.length > 3 ? '…' : '.'}`, ...ir('fixos') });
    if (!d.fixos?.length) out.push({ g: 1, rot: 'Fixos sem cadastro', det: 'projeção só pela média', btn: 'Fixos', texto: 'Os gastos fixos ainda não foram cadastrados (programas, assinaturas, aluguel): sem eles a projeção é só média.', ...ir('fixos') });
    const semCat = (d.cartao?.itens || []).filter((i) => i.categoria === 'a_classificar').length;
    if (semCat) out.push({ g: 1, rot: 'Cartão sem categoria', det: quantos(semCat, 'item', 'itens'), btn: 'Cartão', texto: `${quantos(semCat, 'item do cartão', 'itens do cartão')} sem categoria.`, ...ir('cartao') });
    const soltos = d.cartao?.pagamentos_sem_fatura?.length || 0;
    if (soltos) out.push({ g: 1, rot: 'Pagamento sem fatura', det: n0(soltos), btn: 'Cartão', texto: `${quantos(soltos, 'pagamento de cartão', 'pagamentos de cartão')} no extrato sem saber de qual fatura (e o que tinha dentro dela).`, ...ir('cartao') });
    // A saída que mais cresceu no último mês fechado contra o anterior.
    const meses = (d.meses || []).filter((m) => m < mes);
    if (meses.length >= 2) {
      const [a, b] = meses.slice(-2).map((m) => X().resumo(lista, { mes: m }).categorias);
      const antes = new Map(a.map((c) => [c.categoria, -c.total]));
      const subiu = b.filter((c) => c.total < 0 && c.categoria !== 'cartao_agencia').map((c) => ({ ...c, de: antes.get(c.categoria) || 0, para: -c.total }))
        .filter((c) => c.para - c.de > 300 && c.para > c.de * 1.25).sort((x, y) => (y.para - y.de) - (x.para - x.de))[0];
      if (subiu) out.push({ g: 1, rot: `${subiu.nome} subiu`, det: `${rs(subiu.de)} → ${rs(subiu.para)}`, btn: 'Extrato', texto: `${subiu.nome} subiu de ${rs(subiu.de)} para ${rs(subiu.para)} em ${MESES[Number(meses[meses.length - 1].slice(5)) - 1]}.`, ...ir('extrato', { cat: subiu.categoria, mes: meses[meses.length - 1] }) });
    }
    return out.sort((x, y) => y.g - x.g);
  }
  const ATALHOS = [['extrato', 'Extrato', 'conferir e dividir'], ['clientes_mes', 'Clientes mês a mês', 'quem pagou, quem deve'], ['cartao', 'Cartão de crédito', 'item por item'],
    ['fixos', 'Gastos fixos', 'o que sai todo mês'], ['projecao', 'Relatórios e projeção', 'e se…']];
  const iniciais = (nome) => String(nome || '?').trim().slice(0, 2).toUpperCase();
  function vorcaro(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.vorcaro, mes = (d.hoje || '').slice(0, 7), nomeDoMes = MESES[Number(mes.slice(5)) - 1] || '';
    const achados = analise(d);
    const r = X().resumo(d.transacoes || [], { mes });
    const propostas = d.vorcaro?.propostas || [], pend = propostas.filter((p) => p.estado === 'pendente');
    const graves = achados.filter((a) => a.g >= 2).length;
    const partes = [topo('Vorcaro · Tesouraria', `<button type="button" class="fv2-btn p" data-fx="mao-abrir">${IC.mais}Lançar à mão</button>`)];
    partes.push(!(d.transacoes || []).length && !pend.length ? acao('Sem extrato ainda; importe o CSV da conta PJ.', 'Ir ao extrato', 'data-fx="ir-aba" data-valor="extrato"')
      : achados.length ? acao(`${quantos(achados.length, 'coisa pede', 'coisas pedem')} atenção${pend.length ? `; ${quantos(pend.length, 'chegou', 'chegaram')} pelo WhatsApp` : ''}.`,
        pend.length ? `Ver ${pend.length === 1 ? 'o lançamento' : 'os ' + n0(pend.length)}` : 'Ver o que vi', `data-fx="foco" data-valor="${pend.length ? 'whats' : 'vi'}"`)
      : acao('Tudo em ordem no financeiro.'));
    const saldo = d.projecao?.base?.saldo_hoje || 0;
    const proj = d.projecao?.base?.meses_usados?.length ? X().projetar(d.projecao.base, {}, 6) : null;
    const antiga = pend.map((p) => p.recebido_em || p.data).filter(Boolean).sort()[0];
    partes.push(nums([
      { rotulo: 'Caixa hoje', valor: mil(saldo), tom: saldo < 0 ? 'r' : '', serie: (d.serie || []).filter((s) => s.saldo_final != null).slice(-6).map((s) => s.saldo_final), sub: proj ? `em 6 meses · ${mil(proj.saldo_final)}` : '', attrs: 'data-fx="ir-aba" data-valor="projecao"' },
      { rotulo: `Resultado de ${nomeDoMes}`, valor: mil(r.resultado), tom: r.resultado < 0 ? 'a' : 'g', sub: duas(r.entradas, r.saidas + r.cartao_e_transferencias, `entrou ${esc(mil(r.entradas).replace('R$ ', ''))}`, `saiu ${esc(mil(r.saidas + r.cartao_e_transferencias).replace('R$ ', ''))}`) },
      { rotulo: 'Pede decisão', valor: n0(achados.length), tom: achados.length ? '' : 'g', sub: graves ? `<span class="d3f-a">${quantos(graves, 'mais séria', 'mais sérias')}</span>` : 'nada sério', attrs: 'data-fx="foco" data-valor="vi"' },
      { rotulo: 'Chegou pelo WhatsApp', valor: n0(pend.length), tom: pend.length ? '' : 'q', sub: antiga ? `a mais antiga · ${dataCurta(antiga)}` : 'nada esperando', attrs: 'data-fx="foco" data-valor="whats"' },
    ]));
    if (u.mao) partes.push(maoForm(d));
    const lista = achados.map((a) => `<div class="fx-achado g${a.g}" title="${esc(a.texto)}"><span class="fx-sinal" aria-hidden="true"></span><p><b>${esc(a.rot)}</b>${a.det ? ` · ${esc(a.det)}` : ''}${a.clientes?.length ? `<span class="fx-clis">${a.clientes.map((n) => `<span class="fv2-cli">${esc(n)}</span>`).join('')}</span>` : ''}</p>${a.aba ? `<button type="button" class="fv2-btn s" data-fx="ir-aba" data-valor="${a.aba}" data-chip="${esc(a.chip || '')}" data-cat="${esc(a.cat || '')}" data-mes="${esc(a.mes || '')}">${esc(a.btn || 'Resolver')}</button>` : a.ancora ? '<span class="fv2-pill n">ao lado</span>' : ''}</div>`).join('');
    const decididas = propostas.filter((p) => p.estado !== 'pendente').slice(-8).reverse();
    const ESTADO = { lancada: ['lançada', 'g'], juntada: ['juntada', 'g'], descartada: ['descartada', 'n'] };
    const decididasHtml = decididas.length ? card('Decididas', decididas.map((p) => `<div class="fx-decidida${p.estado === 'descartada' ? ' fora' : ''}"><span class="fx-dia">${esc(dataCurta(p.data))}</span><span class="fx-dec-txt${p.estado === 'descartada' ? ' v2-risca feita' : ''}">${esc(p.texto || p.quem || 'sem texto')}</span>${pill(...(ESTADO[p.estado] || ['decidida', 'n']))}<b class="fx-valor ${p.tipo === 'entrada' ? 'e' : 's'}">${esc(comSinal(p.tipo === 'entrada' ? p.valor : -p.valor))}</b></div>`).join(''), `${n0(decididas.length)} últimas`) : '';
    // O baralho: a proposta da frente com o formulário, as outras atrás; tocar numa da lista traz para a frente.
    const frente = pend.find((p) => p.id === u.frente) || pend[0];
    const atras = Math.min(2, pend.length - 1);
    const whats = pend.length ? `<div class="fx-baralho" style="--atras:${atras}">${Array.from({ length: atras }, (_, i) => `<span class="fx-carta-atras" style="--i:${i + 1}" aria-hidden="true"></span>`).join('')}${propostaHtml(d, frente)}</div>
        <div class="fx-fila">${pend.map((p) => `<button type="button" class="fx-fila-l${p === frente ? ' on' : ''}" data-fx="proposta-frente" data-valor="${esc(p.id)}" aria-pressed="${p === frente}"><span class="d3f-av">${esc(iniciais(p.autor))}</span><span class="fx-fila-txt">${esc(p.texto || '(sem texto)')}</span><small>${esc(ANEXO[p.anexo] || 'mensagem')} · ${esc(dataCurta(p.recebido_em))}</small><b class="fx-valor ${p.tipo === 'entrada' ? 'e' : 's'}">${esc(comSinal(p.tipo === 'entrada' ? p.valor : -p.valor))}</b></button>`).join('')}</div>`
      : vazio('Nada esperando do grupo <b>Vybe Financeiro</b>.');
    const contagem = { extrato: (d.transacoes || []).filter((t) => !t.real.conferido).length, clientes_mes: (d.por_cliente?.linhas || []).filter((l) => l.total_aberto > 0).length,
      cartao: (d.cartao?.itens || []).filter((i) => i.categoria === 'a_classificar').length + (d.cartao?.pagamentos_sem_fatura?.length || 0),
      fixos: (d.fixos?.length ? X().analisarFixos(d.fixos, d.transacoes || [], mes, d.cartao?.itens || []).fixos.filter((f) => !f.achado && f.vence <= (d.hoje || '')).length : 0) };
    const atalhos = ATALHOS.map(([a, nome, sub]) => `<button type="button" class="fx-atalho" data-fx="ir-aba" data-valor="${a}"><span><b>${esc(nome)}</b><small>${esc(sub)}</small></span>${contagem[a] ? `<b class="${a === 'extrato' || a === 'clientes_mes' ? 'd3f-a' : ''}">${n0(contagem[a])}</b>` : '<span></span>'}<i aria-hidden="true">›</i></button>`).join('');
    const comoTrabalho = `<div class="fx-passos"><span><b>1</b>Extrato + grupo</span><i aria-hidden="true">↓</i><span><b>2</b>Vorcaro sugere</span><i aria-hidden="true">↓</i><span class="on"><b>3</b>Um dono confirma</span></div><div class="fx-criterios">${pill('4 donos')}${pill('fora dos outros grupos')}</div>`;
    partes.push(`<div class="fx-tres"><div class="fx-col">${card('O que eu vi', lista || vazio('Nada pedindo atenção agora.'), 'mais sério primeiro', '', 'vi')}${decididasHtml}</div>
      <div class="fx-col">${card('Chegou pelo WhatsApp', whats, pend.length ? `Vybe Financeiro · ${n0(pend.findIndex((p) => p === frente) + 1)} de ${n0(pend.length)}` : 'Vybe Financeiro', 'fx-whats', 'whats')}</div>
      <div class="fx-col fx-lado">${card('Onde mexer', atalhos)}${card('Como eu trabalho', comoTrabalho)}</div></div>`);
    return casca(partes, 'vorcaro');
  }
  function propostaHtml(d, p) {
    const sinal = p.tipo === 'entrada' ? 1 : -1;
    const cands = (p.candidatos || []).map((c, i) => `<button type="button" class="fv2-btn s${i ? '' : ' d3f-escuro'} v2-estado" data-fx="proposta-juntar" data-valor="${esc(p.id)}" data-transacao="${esc(c.id)}" title="${esc(c.historico)}">Juntar com ${esc(dataCurta(c.data))}</button>`).join('');
    const ja = (p.candidatos || [])[0];
    return `<div class="fx-proposta fx-carta" data-fx-proposta="${esc(p.id)}"><p class="fx-comobanco"><span class="d3f-av">${esc(iniciais(p.autor))}</span><small>${esc(p.autor || 'Grupo')} · ${esc(ANEXO[p.anexo] || 'mensagem')} · ${esc(dataCurta(p.recebido_em))}</small><b class="fx-valor ${sinal > 0 ? 'e' : 's'}">${esc(comSinal(sinal * p.valor))}</b></p>
      <p class="fx-prop-txt">${esc(p.texto || '(sem texto)')}</p>
      <div class="fx-grade fx-grade-3">
        ${campo('Tipo', `<select name="tipo" class="fx-sel"><option value="saida"${p.tipo !== 'entrada' ? ' selected' : ''}>saiu</option><option value="entrada"${p.tipo === 'entrada' ? ' selected' : ''}>entrou</option></select>`)}
        ${campo('Valor', `<input name="valor" class="fx-in fx-num" inputmode="decimal" value="${esc(String(p.valor).replace('.', ','))}">`)}
        ${campo('Dia', `<input name="data" type="date" class="fx-in" value="${esc(p.data)}">`)}
        ${campo('Para onde foi', `<select name="categoria" class="fx-sel">${opcoesCat(d, p.categoria)}</select>`)}
        ${campo('Cliente', `<select name="cliente_id" class="fx-sel">${opcoesCliente(d, p.cliente_id)}</select>`)}
        ${campo('Quem', `<input name="quem" class="fx-in" value="${esc(p.quem)}">`)}
      </div>
      ${ja ? `<p class="fx-ja">${pill(`já no extrato · ${dataCurta(ja.data)} · ${ja.historico.slice(0, 32)}`, 'b')}</p>` : ''}
      <div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn s fv2-perigo" data-fx="proposta-descartar" data-valor="${esc(p.id)}">Descartar</button>
        <button type="button" class="fv2-btn s${cands ? '' : ' d3f-escuro'} v2-estado" data-fx="proposta-lancar" data-valor="${esc(p.id)}" title="Entra como lançamento à parte (dinheiro que não passou pela conta)">${cands ? 'Lançar à parte' : 'Lançar'}</button>${cands}</div></div>`;
  }
  function maoForm(d) {
    return card('Lançar à mão', `<p class="fv2-sub">O que não passou pela conta do banco</p>
      <div class="fx-grade" data-fx-form="mao">
        ${campo('Tipo', '<select name="tipo" class="fx-sel"><option value="saida">saiu</option><option value="entrada">entrou</option></select>')}
        ${campo('Valor', '<input name="valor" class="fx-in fx-num" inputmode="decimal">')}
        ${campo('Dia', `<input name="data" type="date" class="fx-in" value="${esc(d.hoje || '')}">`)}
        ${campo('Para onde foi', `<select name="categoria" class="fx-sel">${opcoesCat(d, 'a_classificar')}</select>`)}
        ${campo('Cliente', `<select name="cliente_id" class="fx-sel">${opcoesCliente(d, '')}</select>`)}
        ${campo('Quem', '<input name="quem" class="fx-in">')}
        ${campo('Situação', `<select name="status" class="fx-sel">${['pago', 'nao_pago', 'em_aberto'].map((s) => `<option value="${s}">${STATUS_NOME[s]}</option>`).join('')}</select>`)}
        ${campo('O que foi', '<input name="texto" class="fx-in">', 'largo')}
      </div><div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn s" data-fx="mao-abrir">Cancelar</button><button type="button" class="fv2-btn s d3f-escuro v2-estado" data-fx="mao-salvar">Lançar</button></div>`, '', 'fx-form-caixa');
  }

  function casca(partes, tela) { return `<div class="fv2 fx d3f" data-tela="fx-${tela}"><div class="fv2-in">${partes.join('')}</div></div>`; }

  // =====================================================================================================
  // Interação
  // =====================================================================================================
  const dadosAtuais = () => anfitriao.d || {};
  function valoresDe(el) {
    const v = {};
    for (const c of el.querySelectorAll('input[name], select[name], textarea[name]')) if (!c.closest('[data-parte]')) v[c.name] = c.type === 'checkbox' ? c.checked : c.value;
    return v;
  }
  // O formulário do botão: o do cartão no topo (novo) ou o da linha que abriu (editar no lugar).
  const formDe = (b, tipo) => b.closest('.fx-form-caixa, .fv2-card')?.querySelector(`[data-fx-form="${tipo}"]`);
  // Guarda o que já foi digitado nas partes antes de pintar de novo (pintar refaz o HTML).
  function lerPartes(id) {
    const ed = document.querySelector(`[data-fx-editor="${CSS.escape(id)}"]`), partes = ui.extrato.partes[id];
    if (!ed || !partes) return;
    for (const linha of ed.querySelectorAll('[data-parte]')) {
      const p = partes[Number(linha.dataset.parte)]; if (!p) continue;
      const q = (n) => linha.querySelector(`[name="${n}"]`)?.value;
      p.valor = q('p_valor') ?? p.valor; p.competencia = q('p_competencia') ?? p.competencia; p.quem = q('p_quem') ?? p.quem;
      if (q('p_cliente') != null) { p.cliente_id = q('p_cliente'); p.cliente_nome = nomeCliente(dadosAtuais(), p.cliente_id); }
      if (q('p_categoria') != null) p.categoria = q('p_categoria');
    }
  }
  function lerArquivo(arquivo) {
    return new Promise((ok, falha) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result || ''));
      r.onerror = () => falha(new Error('Não consegui ler o arquivo.'));
      r.readAsText(arquivo, 'windows-1252'); // o BB exporta em Windows-1252
    });
  }
  async function previa(arquivo) {
    const u = ui.extrato;
    try {
      u.csv = await lerArquivo(arquivo); u.nomeArquivo = arquivo.name;
      u.previa = await post({ acao: 'previa', csv: u.csv });
    } catch (e) { u.previa = { erro: e.message }; }
    repintar();
  }
  // O botão que conta o estado: gira enquanto grava; se der erro, volta como estava.
  const indo = (b) => { if (b?.classList.contains('v2-estado')) b.dataset.estado = 'indo'; };
  const voltou = (b) => { if (b) delete b.dataset.estado; };
  async function aoClicar(ev) {
    const b = ev.target.closest?.('[data-fx]'); if (!b || !b.closest('.fx')) return;
    const acaoFx = b.dataset.fx, valor = b.dataset.valor ?? '', alvo = b.dataset.alvo || '', d = dadosAtuais();
    const ue = ui.extrato;
    switch (acaoFx) {
      case 'ir': { const el = document.querySelector(`.vv-trilho [data-visao-setor="${valor}"], .vv-trilho [data-trilho="${valor}"]`); if (el) el.click(); return; }
      case 'mes': if (valor) { ui[alvo].mes = valor; if (alvo === 'cartao') ui.cartao.fatura = valor; ui[alvo].aberta = ''; } return repintar();
      case 'chip': ui[alvo].chip = valor; ui[alvo].aberta = ''; if (alvo === 'extrato') ue.mostrar = 60; if (alvo === 'cartao') ui.cartao.inteira = false; return repintar();
      case 'mais': if (alvo === 'cartao') ui.cartao.inteira = true; else ue.mostrar += 100; return repintar();
      case 'cat': ue.cat = ue.cat === valor ? '' : valor; ue.chip = 'todos'; return repintar();
      case 'abrir': ui[alvo].aberta = ui[alvo].aberta === valor ? '' : valor; if (alvo === 'extrato') ue.regra = ''; if (alvo === 'cartao' && ui.cartao.editando && ui.cartao.editando !== valor) ui.cartao.editando = ''; return repintar();
      case 'foco': { // leva ao cartão e acende a borda
        const c = b.closest('.fx')?.querySelector(`[data-fx-card="${valor}"]`); if (!c) return;
        c.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); c.classList.remove('fv2-olha'); void c.offsetWidth; c.classList.add('fv2-olha'); return;
      }
      case 'ir-lanc': { // de outra tela para o lançamento no Extrato
        ue.mes = b.dataset.mes || ue.mes; ue.aberta = valor; ue.chip = 'todos'; ue.cat = '';
        window.VybeComercial?.abrir?.('extrato', { abas: ['extrato'], rotulo: 'Finanças' }); return repintar();
      }
      case 'previa-fechar': ue.previa = null; ue.csv = ''; return repintar();
      case 'importar': {
        if (!ue.csv) return;
        b.disabled = true;
        const r = await gravar({ acao: 'importar', csv: ue.csv });
        if (r) { avisar(`Importados ${r.importado.novas} lançamentos.`, 'success'); ue.previa = null; ue.csv = ''; ue.chip = 'conferir'; ue.mes = ''; repintar(); }
        else b.disabled = false;
        return;
      }
      case 'conferir': { const t = (d.transacoes || []).find((x) => x.id === valor); if (!t) return; b.setAttribute('aria-pressed', String(!t.real.conferido)); await gravar({ acao: 'editar', id: valor, mudanca: { conferido: !t.real.conferido } }); return; }
      case 'conferir-todos': {
        const ids = [...document.querySelectorAll('.fx [data-fx="conferir"][aria-pressed="false"]')].map((x) => x.dataset.valor);
        if (ids.length) await gravar({ acao: 'conferir_varios', ids, conferido: true }, `${ids.length} conferidos.`);
        return;
      }
      case 'status': { const id = b.dataset.id; await gravar({ acao: 'editar', id, mudanca: { status: valor } }); return; }
      case 'dividir': {
        const t = (d.transacoes || []).find((x) => x.id === valor); if (!t) return;
        const metade = Math.round(Math.abs(t.banco.valor) * 50) / 100;
        ue.partes[valor] = [{ valor: metade, cliente_id: t.real.cliente_id, cliente_nome: t.real.cliente_nome, categoria: t.real.categoria, competencia: t.real.competencia },
          { valor: Math.round((Math.abs(t.banco.valor) - metade) * 100) / 100, cliente_id: '', cliente_nome: '', categoria: t.real.categoria, competencia: t.real.competencia }];
        return repintar();
      }
      case 'parte-mais': lerPartes(valor); ue.partes[valor].push({ valor: '', cliente_id: '', competencia: '' }); return repintar();
      case 'parte-tirar': { const id = b.dataset.id; lerPartes(id); ue.partes[id].splice(Number(valor), 1); if (!ue.partes[id].length) delete ue.partes[id]; return repintar(); }
      case 'parte-resto': {
        lerPartes(valor);
        const t = (d.transacoes || []).find((x) => x.id === valor), l = ue.partes[valor];
        const soma = l.reduce((s, p) => s + Math.round(numero(p.valor) * 100), 0);
        const resto = (Math.round(Math.abs(t.banco.valor) * 100) - soma) / 100;
        const vazia = l.find((p) => !numero(p.valor));
        if (vazia) vazia.valor = resto; else l.push({ valor: resto, cliente_id: '', competencia: '' });
        return repintar();
      }
      case 'parte-desfazer': delete ue.partes[valor]; return repintar();
      case 'salvar-lanc': {
        const ed = b.closest('[data-fx-editor]'); if (!ed) return;
        lerPartes(valor);
        const v = valoresDe(ed);
        const mudanca = { categoria: v.categoria, cliente_id: v.cliente_id, cliente_nome: nomeCliente(d, v.cliente_id), quem: v.quem, competencia: v.competencia, descricao: v.descricao, conferido: true };
        if ('fatura' in v) mudanca.fatura = v.fatura;
        const partes = ue.partes[valor];
        mudanca.partes = partes ? partes.map((p) => ({ valor: numero(p.valor), cliente_id: p.cliente_id || '', cliente_nome: p.cliente_nome || nomeCliente(d, p.cliente_id), categoria: p.categoria || v.categoria, competencia: p.competencia || v.competencia, quem: p.quem || '' })) : [];
        indo(b);
        const r = await gravar({ acao: 'editar', id: valor, mudanca });
        if (r) { delete ue.partes[valor]; const prox = proximoAConferir(d, valor); ue.aberta = prox || ''; repintar(); } else voltou(b);
        return;
      }
      case 'regra-de': ue.regra = valor; return repintar();
      case 'regra-salvar': {
        const ed = b.closest('[data-fx-editor]'); if (!ed) return;
        const v = valoresDe(ed);
        const r = await gravar({ acao: 'regra_salvar', regra: { contem: v.r_contem, sinal: v.r_sinal, revisar: Boolean(v.r_revisar), categoria: v.categoria, quem: v.quem, cliente_id: v.cliente_id, cliente_nome: nomeCliente(d, v.cliente_id) } });
        if (r) { avisar(`Regra criada; ${r.reaplicadas} lançamento(s) mudaram.`, 'success'); ue.regra = ''; repintar(); }
        return;
      }
      case 'regra-tirar': await gravar({ acao: 'regra_remover', id: valor }); return;
      // Cartão
      case 'cartao-novo': ui.cartao.novo = !ui.cartao.novo; ui.cartao.editando = ''; return repintar();
      case 'cartao-colar': ui.cartao.colar = !ui.cartao.colar; return repintar();
      case 'item-editar': ui.cartao.editando = valor; ui.cartao.aberta = valor; ui.cartao.novo = false; return repintar();
      case 'item-fechar': ui.cartao.editando = ''; ui.cartao.novo = false; return repintar();
      case 'item-salvar': {
        const f = formDe(b, 'item'); if (!f) return;
        const v = valoresDe(f);
        indo(b);
        const r = await gravar({ acao: 'cartao_salvar', item: { ...v, id: f.dataset.id || '', valor: numero(v.valor), cliente_nome: nomeCliente(d, v.cliente_id) } }, 'Item salvo.');
        if (r) { ui.cartao.editando = ''; ui.cartao.novo = false; ui.cartao.fatura = r.item.fatura; repintar(); } else voltou(b);
        return;
      }
      case 'item-tirar': { const r = await gravar({ acao: 'cartao_remover', id: valor }); if (r) { ui.cartao.editando = ''; ui.cartao.aberta = ''; repintar(); } return; }
      case 'item-status': {
        const it = (d.cartao?.itens || []).find((i) => i.id === b.dataset.id); if (!it) return;
        await gravar({ acao: 'cartao_salvar', item: { ...it, status: valor } }); return;
      }
      case 'colar-salvar': {
        const c = b.closest('.fv2-card'); if (!c) return;
        const fatura = c.querySelector('[name="cf_fatura"]').value, cartaoNome = c.querySelector('[name="cf_cartao"]').value;
        if (!/^\d{4}-\d{2}$/.test(fatura)) return avisar('Escolha o mês da fatura.');
        const itens = lerFaturaColada(c.querySelector('[name="cf_texto"]').value, fatura);
        if (!itens.length) return avisar('Não achei nenhuma linha com valor. Use uma compra por linha: 12/10 ADOBE 99,90');
        let ok = 0, falha = '';
        for (const it of itens) { try { await post({ acao: 'cartao_salvar', item: { ...it, cartao: cartaoNome, status: 'em_aberto' } }); ok++; } catch (e) { falha = e.message || 'falhou'; break; } }
        // Parou no meio: diz quantos entraram e de onde recomeçar (colar tudo de novo duplicaria os que já entraram).
        if (falha) { avisar(`${ok} de ${itens.length} itens lançados; parou no ${ok + 1}º: ${falha}. Cole só a partir dele para não duplicar.`); ui.cartao.fatura = fatura; await anfitriao.recarregar?.(); return; }
        avisar(`${ok} itens lançados na fatura de ${nomeMes(fatura)}.`, 'success');
        ui.cartao.colar = false; ui.cartao.fatura = fatura; await anfitriao.recarregar?.(); return;
      }
      // Fixos
      case 'fixo-novo': ui.fixos.novo = !ui.fixos.novo; ui.fixos.editando = ''; ui.fixos.rascunho = null; return repintar();
      case 'fixo-editar': ui.fixos.editando = ui.fixos.editando === valor ? '' : valor; ui.fixos.novo = false; return repintar();
      case 'fixo-fechar': ui.fixos.editando = ''; ui.fixos.novo = false; ui.fixos.rascunho = null; return repintar();
      case 'fixo-provavel': {
        const p = fixosProvaveis(d.transacoes || [], d.fixos || [])[Number(valor)]; if (!p) return;
        ui.fixos.rascunho = { nome: p.nome, valor: p.valor, dia: p.dia, categoria: ['ferramentas', 'estrutura', 'emprestimo', 'impostos', 'tarifa_bancaria'].includes(p.categoria) ? p.categoria : 'ferramentas', contem: p.nome };
        ui.fixos.novo = true; ui.fixos.editando = '';
        b.classList.add('voando'); // o chip voa para o formulário que abre no topo
        return setTimeout(repintar, typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380);
      }
      case 'fixo-salvar': {
        const f = formDe(b, 'fixo'); if (!f) return;
        const v = valoresDe(f);
        indo(b);
        const r = await gravar({ acao: 'fixo_salvar', fixo: { ...v, id: f.dataset.id || '', valor: numero(v.valor), dia: Number(v.dia), ativo: Boolean(v.ativo) } }, 'Gasto fixo salvo.');
        if (r) { ui.fixos.editando = ''; ui.fixos.novo = false; ui.fixos.rascunho = null; repintar(); } else voltou(b);
        return;
      }
      case 'fixo-tirar': {
        const fx = (d.fixos || []).find((f) => f.id === valor);
        const r = await gravar({ acao: 'fixo_remover', id: valor });
        if (r) {
          ui.fixos.editando = ''; repintar();
          if (fx && typeof mostrarDesfazer === 'function') mostrarDesfazer(`${fx.nome} apagado.`, () => gravar({ acao: 'fixo_salvar', fixo: fx }));
        }
        return;
      }
      // Projeção
      case 'horizonte': ui.projecao.horizonte = Number(valor) || 6; return repintar();
      case 'novo-mais': ui.projecao.cenario.clientes_novos.push({ quantos: 1, valor: '', a_partir: 1 }); return repintar();
      case 'novo-tirar': ui.projecao.cenario.clientes_novos.splice(Number(valor), 1); return repintar();
      case 'gasto-mais': ui.projecao.cenario.gastos_novos.push({ nome: '', valor: '', a_partir: 1 }); return repintar();
      case 'gasto-tirar': ui.projecao.cenario.gastos_novos.splice(Number(valor), 1); return repintar();
      case 'cenario-limpar': ui.projecao.cenario = { cortes: {}, economias: {}, clientes_novos: [], clientes_perdidos: {}, gastos_novos: [], ajuste_entradas_pct: 0 }; ui.projecao.nome = ''; return repintar();
      case 'cenario-focar': { const n = document.querySelector('.fx [data-fx-campo="cenario-nome"]'); n?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); n?.focus?.({ preventScroll: true }); return; }
      case 'cenario-salvar': {
        const nome = ui.projecao.nome.trim(); if (!nome) { document.querySelector('.fx [data-fx-campo="cenario-nome"]')?.focus?.(); return avisar('Dê um nome ao cenário.'); }
        const c = cenarioAtual(d);
        indo(b);
        const r = await gravar({ acao: 'cenario_salvar', cenario: { nome, ...c, economias: c.economias, _fixos: undefined } }, 'Cenário guardado.');
        if (!r) voltou(b);
        return;
      }
      case 'cenario-usar': {
        const s = (d.projecao?.cenarios || []).find((x) => x.id === valor); if (!s) return;
        const porNome = new Map((d.fixos || []).map((f) => [f.nome, f.id])), cliNome = new Map((d.clientes || []).map((x) => [x.nome, String(x.id)]));
        ui.projecao.cenario = { cortes: Object.fromEntries((s.cortes || []).map((x) => [x.categoria, x.percentual])), economias: Object.fromEntries((s.economias || []).map((x) => [porNome.get(x.nome), true]).filter(([k]) => k)),
          clientes_novos: (s.clientes_novos || []).map((x) => ({ ...x })), clientes_perdidos: Object.fromEntries((s.clientes_perdidos || []).map((x) => [cliNome.get(x.nome), true]).filter(([k]) => k)),
          gastos_novos: (s.gastos_novos || []).map((x) => ({ ...x })), ajuste_entradas_pct: s.ajuste_entradas_pct || 0 };
        ui.projecao.nome = s.nome; return repintar();
      }
      case 'cenario-tirar': await gravar({ acao: 'cenario_remover', id: valor }); return;
      // Vorcaro
      case 'ir-aba': {
        if (valor === 'extrato') { ue.chip = b.dataset.chip || (b.dataset.cat ? 'todos' : ue.chip); ue.cat = b.dataset.cat || ''; if (b.dataset.mes) ue.mes = b.dataset.mes; ue.aberta = ''; }
        if (valor === 'clientes_mes' && b.dataset.chip) ui.clientes_mes.chip = b.dataset.chip;
        const el = document.querySelector(`.vv-trilho [data-submodulo="${valor}"]`);
        if (el && el.getClientRects().length) el.click(); else window.VybeComercial?.abrir?.(valor, { abas: [valor], rotulo: 'Finanças' });
        return;
      }
      case 'mao-abrir': ui.vorcaro.mao = !ui.vorcaro.mao; return repintar();
      case 'mao-salvar': {
        const f = formDe(b, 'mao'); if (!f) return;
        const v = valoresDe(f);
        indo(b);
        const r = await gravar({ acao: 'lancar_mao', lancamento: { ...v, valor: numero(v.valor), cliente_nome: nomeCliente(d, v.cliente_id) } }, 'Lançado.');
        if (r) { ui.vorcaro.mao = false; repintar(); } else voltou(b);
        return;
      }
      case 'proposta-frente': ui.vorcaro.frente = valor; return repintar();
      case 'proposta-lancar': case 'proposta-juntar': case 'proposta-descartar': {
        const box = b.closest('[data-fx-proposta]'); if (!box) return;
        const v = valoresDe(box);
        const mudanca = { tipo: v.tipo, valor: numero(v.valor), data: v.data, categoria: v.categoria, cliente_id: v.cliente_id, cliente_nome: nomeCliente(d, v.cliente_id), quem: v.quem };
        b.disabled = true; indo(b);
        box.classList.add('fx-sai'); // a carta decidida sai do baralho para a esquerda enquanto grava
        const r = await gravar({ acao: acaoFx.replace('-', '_'), id: valor, mudanca, transacao_id: b.dataset.transacao || '' },
          { 'proposta-lancar': 'Lançado no extrato.', 'proposta-juntar': 'Juntado ao lançamento do banco.', 'proposta-descartar': 'Descartado.' }[acaoFx]);
        if (!r) { b.disabled = false; voltou(b); box.classList.remove('fx-sai'); } else if (ui.vorcaro.frente === valor) ui.vorcaro.frente = '';
        return;
      }
      default:
    }
  }
  function proximoAConferir(d, depoisDe) {
    const doMes = (d.transacoes || []).filter((t) => t.banco.data.startsWith(ui.extrato.mes)).slice().reverse();
    const i = doMes.findIndex((t) => t.id === depoisDe);
    return doMes.slice(i + 1).find((t) => !t.real.conferido)?.id || '';
  }
  function aoMudar(ev) {
    const t = ev.target;
    if (t.matches?.('[data-fx-arquivo]')) { const f = t.files?.[0]; if (f) previa(f); t.value = ''; return; }
    const c = t.dataset?.fxCampo; if (!c || !t.closest('.fx')) return;
    const cen = ui.projecao.cenario, i = Number(t.dataset.valor);
    switch (c) {
      case 'filtro-cat': ui.extrato.cat = t.value; ui.extrato.chip = 'todos'; return repintar();
      case 'corte': cen.cortes[t.dataset.valor] = Number(t.value); return repintar();
      case 'economia': cen.economias[t.dataset.valor] = t.checked; return repintar();
      case 'perder': cen.clientes_perdidos[t.dataset.valor] = t.checked; return repintar();
      case 'ajuste': cen.ajuste_entradas_pct = Number(t.value); return repintar();
      case 'novo-quantos': cen.clientes_novos[i].quantos = Number(t.value) || 1; return repintar();
      case 'novo-valor': cen.clientes_novos[i].valor = t.value; return repintar();
      case 'novo-mes': cen.clientes_novos[i].a_partir = Number(t.value) || 1; return repintar();
      case 'gasto-nome': cen.gastos_novos[i].nome = t.value; return;
      case 'gasto-valor': cen.gastos_novos[i].valor = t.value; return repintar();
      case 'gasto-mes': cen.gastos_novos[i].a_partir = Number(t.value) || 1; return repintar();
      case 'cenario-nome': ui.projecao.nome = t.value; return;
      default:
    }
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', aoClicar);
    document.addEventListener('change', aoMudar);
  }

  const telas = Object.freeze({ vorcaro, extrato, clientes_mes: clientesMes, cartao, fixos, projecao });
  window.VybeFinanceiro = Object.freeze({ telas, _teste: { ui, lerFaturaColada, fixosProvaveis, cenarioAtual, analise } });
})();
