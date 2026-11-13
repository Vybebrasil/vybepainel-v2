// vybe-mundo-financeiro.js — o Financeiro do próprio Vybe OS, sem o Vybe Finanças (Paulo, 13/11/2026).
//
// Cinco telas no padrão v2 (classes fv2-* de padrao-v2/financas.css e fx-* de padrao-v2/financeiro.css), hospedadas na
// janela do Comercial como as de vybe-mundo-financas.js (o pintor da janela procura VybeFinanceiro.telas[aba]):
//   extrato      o extrato do banco: importar o CSV (prévia antes de gravar), conferir, dizer para onde foi de verdade,
//                dividir uma entrada entre clientes, pago | não pago | em aberto, e criar regra a partir do lançamento
//   clientes_mes cada cliente × mês: pago, parcial, em aberto, sem cobrança
//   cartao       as faturas com cada item, o que foi pago e o que falta, colar os itens da fatura
//   fixos        gastos fixos (programas, assinaturas, aluguel…): cadastrar, editar, ver se já saiu no mês
//   vorcaro      a tela do Vorcaro (Tesouraria): o que ele viu no setor, o que chegou do grupo Vybe Financeiro e lançar à mão
//   projecao     caixa realizado e projetado para 3, 6 e 12 meses, com cenários (cortar, somar clientes, perder…)
// Dados: GET/POST /api/painel?area=financeiro (server/financeiro.js; só os quatro donos). Contas: shared/financeiro-extrato.js
// (window.VybeFinanceiroExtrato). Interação: data-fx="<ação>" (cliques), data-fx-campo (campos), data-fx-arquivo (CSV).
(() => {
  'use strict';
  const X = () => window.VybeFinanceiroExtrato;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const nomeMes = (m) => (/^\d{4}-\d{2}$/.test(m || '') ? `${MESES[Number(m.slice(5)) - 1]} de ${m.slice(0, 4)}` : '');
  const mesCurto = (m) => (/^\d{4}-\d{2}$/.test(m || '') ? `${MES_CURTO[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}` : '');
  const dataCurta = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '');
  const rs = (v) => { const n = Number(v) || 0; return `${n < 0 ? '-' : ''}R$ ${Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
  const mil = (v) => { const n = Number(v) || 0, a = Math.abs(n); return `${n < 0 ? '-' : ''}R$ ${a >= 1000 ? (a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : Math.round(a).toLocaleString('pt-BR')}`; };
  const n0 = (v) => Math.round(Number(v) || 0).toLocaleString('pt-BR');
  const quantos = (n, um, varios) => `${n0(n)} ${Number(n) === 1 ? um : varios}`;
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const numero = (s) => { const t = String(s ?? '').trim(); if (!t) return 0; const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return Number.isFinite(n) ? n : 0; };
  const SETA = { esq: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>', dir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' };
  const pill = (t, tom = 'n') => `<span class="fv2-pill ${tom}">${esc(t)}</span>`;
  const STATUS_NOME = { pago: 'Pago', nao_pago: 'Não pago', em_aberto: 'Em aberto' };
  const STATUS_TOM = { pago: 'g', nao_pago: 'r', em_aberto: 'a' };

  // ---------- Estado da tela (o que fica entre uma pintura e outra) ----------
  const ui = {
    extrato: { mes: '', chip: 'conferir', cat: '', aberta: '', mostrar: 60, partes: {}, previa: null, csv: '', nomeArquivo: '', lendo: false, regra: '' },
    clientes_mes: { chip: 'todos', aberta: '' },
    cartao: { fatura: '', novo: false, colar: false, editando: '' },
    fixos: { mes: '', novo: false, editando: '' },
    vorcaro: { mao: false },
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
  function topo(titulo, acoes = '', meio = '') {
    return `<div class="fv2-topo"><div class="fv2-ola"><p class="fv2-sub"><button type="button" class="fv2-link" data-fx="ir" data-valor="setor:financas">Finanças</button> › ${esc(titulo)}</p><h1>${esc(titulo)}</h1></div>${meio}${acoes}</div>`;
  }
  const fala = (frase, botao = '') => `<section class="fv2-fala" aria-label="Vorcaro"><span class="fv2-ag" aria-hidden="true">V</span><p><span class="fv2-quem">Vorcaro · Tesouraria</span>${frase}</p>${botao}</section>`;
  const kpi = ({ rotulo, valor, tom = '', sub = '' }, i) => `<div class="fv2-kpi${tom ? ' ' + tom : ''}"><small>${esc(rotulo)}</small><b><span class="v2-num"${i ? ` style="animation-delay:${(i * 0.12).toFixed(2)}s"` : ''}>${esc(valor)}</span></b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const kpis = (l) => `<div class="fv2-kpis fx-kpis-${l.length}">${l.map(kpi).join('')}</div>`;
  const card = (titulo, corpo, sub = '', cls = '') => `<section class="fv2-card${cls ? ' ' + cls : ''}"><div class="fv2-card-topo"><h2>${esc(titulo)}</h2>${sub ? `<span class="fv2-sub">${sub}</span>` : ''}</div>${corpo}</section>`;
  function mesNav(lista, atual, alvo) {
    const i = lista.indexOf(atual), antes = lista[i - 1] || '', depois = lista[i + 1] || '';
    return `<span class="fv2-mes" role="group" aria-label="Mês"><button type="button" class="fv2-btn s fv2-seta" data-fx="mes" data-alvo="${alvo}" data-valor="${antes}" aria-label="Mês anterior"${antes ? '' : ' disabled'}>${SETA.esq}</button><span class="fv2-chip" aria-live="polite">${esc(nomeMes(atual))}</span><button type="button" class="fv2-btn s fv2-seta" data-fx="mes" data-alvo="${alvo}" data-valor="${depois}" aria-label="Próximo mês"${depois ? '' : ' disabled'}>${SETA.dir}</button></span>`;
  }
  const chips = (alvo, lista, atual) => `<span class="fv2-fichas" role="group" aria-label="Filtrar">${lista.map(([k, nome, n]) => `<button type="button" class="fv2-chip" data-fx="chip" data-alvo="${alvo}" data-valor="${k}" aria-pressed="${atual === k}">${esc(nome)}${n != null ? ` · ${n0(n)}` : ''}</button>`).join('')}</span>`;
  const categorias = (d) => d.categorias || X().CATEGORIAS;
  const nomeCat = (d, id) => (categorias(d).find((c) => c.id === id) || {}).nome || id || '—';
  function opcoesCat(d, sel, { tipo = '' } = {}) {
    const grupos = new Map();
    for (const c of categorias(d)) { if (tipo && c.tipo !== tipo && c.tipo !== 'indefinido' && !(tipo === 'saida' && c.tipo === 'transferencia')) continue; if (!grupos.has(c.grupo)) grupos.set(c.grupo, []); grupos.get(c.grupo).push(c); }
    return [...grupos].map(([g, l]) => `<optgroup label="${esc(g)}">${l.map((c) => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>`).join('');
  }
  const opcoesCliente = (d, sel) => `<option value="">— sem cliente —</option>${(d.clientes || []).filter((c) => c.ativo !== false || String(c.id) === String(sel)).map((c) => `<option value="${esc(c.id)}"${String(c.id) === String(sel) ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}`;
  const nomeCliente = (d, id) => (d.clientes || []).find((c) => String(c.id) === String(id))?.nome || '';
  const campo = (rot, html, cls = '') => `<label class="fx-campo${cls ? ' ' + cls : ''}"><span>${esc(rot)}</span>${html}</label>`;
  const barra = (pct, tom = '') => `<span class="fx-barra${tom ? ' ' + tom : ''}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>`;
  const vazio = (frase, botao = '') => `<div class="fv2-vz"><p>${frase}</p>${botao}</div>`;

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
    const importar = `<label class="fv2-btn p fx-arquivo">Importar extrato<input type="file" accept=".csv,text/csv" data-fx-arquivo hidden></label>`;
    const partes = [topo('Extrato e conciliação', importar, meses.length ? mesNav(meses, u.mes, 'extrato') : '')];
    if (u.previa) partes.push(previaHtml(d));
    if (!todas.length && !u.previa) {
      partes.push(fala('Ainda não tem extrato aqui. Baixe o extrato da conta PJ no site do Banco do Brasil (CSV) e importe: eu mostro a prévia com o que acho que é cada lançamento, e só grava quando você mandar.'));
      return casca(partes, 'extrato');
    }
    if (r) {
      const sem = doMes.filter((t) => t.real.categoria === 'receita_boleto' && !t.real.partes?.length).length;
      const frase = aConferir
        ? `Em ${esc(nomeMes(u.mes))} faltam <b>${quantos(aConferir, 'lançamento', 'lançamentos')}</b> para você conferir${sem ? `, ${quantos(sem, 'boleto', 'boletos')} para dividir entre os clientes` : ''}. O banco mostra para quem foi; aqui você diz para onde foi de verdade.`
        : `${esc(nomeMes(u.mes)).replace(/^./, (c) => c.toUpperCase())} está todo conferido. Entrou ${esc(rs(r.entradas))} e saiu ${esc(rs(r.saidas + r.cartao_e_transferencias))}.`;
      partes.push(fala(frase, aConferir ? `<button type="button" class="fv2-btn s" data-fx="chip" data-alvo="extrato" data-valor="conferir">Ver o que falta</button>` : ''));
      partes.push(kpis([
        { rotulo: 'Entrou', valor: mil(r.entradas), tom: 'bom' },
        { rotulo: 'Saiu (sem o cartão)', valor: mil(r.saidas) },
        { rotulo: 'Pago no cartão da agência', valor: mil(r.cartao_e_transferencias), sub: 'os itens ficam no Cartão' },
        { rotulo: 'Saldo no fim do mês', valor: r.saldo_final == null ? '—' : mil(r.saldo_final), tom: Number(r.saldo_final) < 0 ? 'ruim' : '' },
      ]));
    }
    const contar = (k) => doMes.filter((t) => ({ conferir: !t.real.conferido, entradas: t.banco.valor > 0, saidas: t.banco.valor < 0, abertos: t.real.status !== 'pago', todos: true })[k]).length;
    const catsMes = [...new Set(doMes.flatMap((t) => X().pedacos(t).map((p) => p.categoria)))];
    const filtrosHtml = `<div class="fv2-filtros"><label class="fv2-sr" for="fx-busca-extrato">Buscar no extrato</label><input class="fv2-busca" id="fx-busca-extrato" type="search" data-vc-busca="fx_extrato" placeholder="Buscar nome, cliente, categoria" value="${esc(ctx.filtro?.fx_extrato || '')}">
      ${chips('extrato', [['conferir', 'A conferir', contar('conferir')], ['todos', 'Todos', contar('todos')], ['entradas', 'Entradas', contar('entradas')], ['saidas', 'Saídas', contar('saidas')], ['abertos', 'Não pago / em aberto', contar('abertos')]], u.chip)}
      <label class="fv2-sr" for="fx-cat">Categoria</label><select id="fx-cat" class="fx-sel" data-fx-campo="filtro-cat"><option value="">Todas as categorias</option>${catsMes.map((c) => `<option value="${c}"${u.cat === c ? ' selected' : ''}>${esc(nomeCat(d, c))}</option>`).join('')}</select></div>`;
    const conferirTodos = u.chip === 'conferir' && lista.length ? `<button type="button" class="fv2-btn s" data-fx="conferir-todos">Conferir os ${n0(Math.min(lista.length, u.mostrar))} como sugeridos</button>` : '';
    const linhas = lista.slice(0, u.mostrar).map((t) => linhaExtrato(d, t)).join('');
    const resto = lista.length - u.mostrar;
    partes.push(`<div class="fx-duas"><div class="fx-col">${card(`Lançamentos de ${nomeMes(u.mes)}`, filtrosHtml + (linhas || vazio(u.chip === 'conferir' ? 'Tudo conferido neste mês.' : 'Nada com esse filtro.')) + (resto > 0 ? `<p class="fv2-sub fv2-pe">+ ${n0(resto)} · <button type="button" class="fv2-link" data-fx="mais" data-alvo="extrato">mostrar mais</button></p>` : ''), conferirTodos)}</div>
      <div class="fx-col fx-lado">${r ? card('Para onde foi o dinheiro', porCategoriaHtml(d, r), 'pelo lado real, não pelo banco') : ''}${regrasHtml(d)}${importacoesHtml(d)}</div></div>`);
    return casca(partes, 'extrato');
  }
  function linhaExtrato(d, t) {
    const u = ui.extrato, aberta = u.aberta === t.id, entrada = t.banco.valor > 0;
    const cat = t.real.partes?.length ? `dividido em ${t.real.partes.length}` : nomeCat(d, t.real.categoria);
    const quem = t.real.partes?.length ? t.real.partes.map((p) => p.cliente_nome || p.quem).filter(Boolean).join(', ') : (t.real.cliente_nome || t.real.quem || '');
    const tomCat = t.real.categoria === 'a_classificar' ? 'r' : t.real.conferido ? 'n' : 'a';
    const status = (t.real.status !== 'pago' ? pill(STATUS_NOME[t.real.status], STATUS_TOM[t.real.status]) : '') + (t.banco.origem ? pill(t.banco.origem === 'mao' ? 'à mão' : 'WhatsApp', 'b') : '');
    return `<div class="v2-abre fv2-linha fx-lanc${t.real.conferido ? ' ok' : ''}" data-linha="${esc(t.id)}" aria-expanded="${aberta}">
      <div class="fv2-lin"><span class="fx-dia">${dataCurta(t.banco.data)}</span><button type="button" class="fv2-txt" data-fx="abrir" data-alvo="extrato" data-valor="${esc(t.id)}" aria-expanded="${aberta}">
        <span class="fx-banco">${esc(t.banco.historico)}</span><span class="fx-real">→ ${pill(cat, tomCat)}${quem ? ` <span class="fx-quem">${esc(quem)}</span>` : ''}${status}</span></button>
        <b class="fx-valor ${entrada ? 'e' : 's'}">${esc(rs(t.banco.valor))}</b>
        <button type="button" class="fx-ok" data-fx="conferir" data-valor="${esc(t.id)}" aria-pressed="${t.real.conferido}" title="${t.real.conferido ? 'Conferido' + (t.real.conferido_por ? ' por ' + t.real.conferido_por : '') : 'Marcar como conferido'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg><span class="fv2-sr">Conferido</span></button></div>
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
    const sug = t.sugestao?.nota ? `<p class="fv2-sub">Sugestão: ${esc(t.sugestao.nota)}${t.sugestao.regra ? ` (regra ${esc(t.sugestao.regra)})` : ''}.</p>` : '';
    const contra = t.banco.contraparte || '';
    return `<div class="fv2-det fx-editor" data-fx-editor="${esc(t.id)}">
      <p class="fx-comobanco"><small>Como está no banco</small> ${esc(dataCurta(t.banco.data))} · ${esc(t.banco.historico)}${t.banco.documento ? ` · doc ${esc(t.banco.documento)}` : ''} · <b>${esc(rs(t.banco.valor))}</b>${t.banco.saldo != null ? ` · saldo ${esc(rs(t.banco.saldo))}` : ''}</p>
      ${sug}
      <div class="fx-grade">
        ${campo('Para onde foi de verdade', `<select name="categoria" class="fx-sel">${opcoesCat(d, t.real.categoria, { tipo })}</select>`)}
        ${campo(entrada ? 'Cliente' : 'Cliente (se foi gasto de um cliente)', `<select name="cliente_id" class="fx-sel">${opcoesCliente(d, t.real.cliente_id)}</select>`)}
        ${campo('Quem / fornecedor', `<input name="quem" class="fx-in" value="${esc(t.real.quem)}" placeholder="${esc(contra || 'ex.: posto, Mizinho, Adobe')}">`)}
        ${campo('Mês a que se refere', `<input name="competencia" type="month" class="fx-in" value="${esc(t.real.competencia)}">`)}
        ${campo('Observação', `<input name="descricao" class="fx-in" value="${esc(t.real.descricao)}" placeholder="o que foi">`, 'largo')}
        ${t.real.categoria === 'cartao_agencia' || (!entrada && /cart/i.test(t.real.categoria)) ? campo('Fatura que este pagamento quitou', `<select name="fatura" class="fx-sel"><option value="">— escolher —</option>${faturas.map((f) => `<option value="${esc(f)}"${t.real.fatura === f ? ' selected' : ''}>${esc(f.split('|')[0])} · ${esc(nomeMes(f.split('|')[1]))}</option>`).join('')}</select>`) : ''}
      </div>
      <div class="fx-linha-acoes"><span class="fv2-seg" role="group" aria-label="Situação">${['pago', 'nao_pago', 'em_aberto'].map((s) => `<button type="button" data-fx="status" data-valor="${s}" data-id="${esc(t.id)}" aria-pressed="${t.real.status === s}">${STATUS_NOME[s]}</button>`).join('')}</span>
        ${partes ? '' : `<button type="button" class="fv2-btn s" data-fx="dividir" data-valor="${esc(t.id)}">${entrada ? 'Dividir entre clientes' : 'Dividir em partes'}</button>`}</div>
      ${partes ? `<div class="fx-partes"><p class="fv2-sub">${entrada ? 'Quanto foi de cada cliente' : 'Em quê foi cada parte'} — as partes somam o valor do banco. ${falta === 0 ? pill('fechou', 'g') : pill(`${falta > 0 ? 'faltam' : 'passou'} ${rs(Math.abs(falta))}`, 'r')}</p>
        ${partes.map((p, i) => `<div class="fx-parte" data-parte="${i}">
          <input name="p_valor" class="fx-in fx-num" inputmode="decimal" value="${esc(p.valor === '' || p.valor == null ? '' : String(p.valor).replace('.', ','))}" placeholder="valor" aria-label="Valor da parte ${i + 1}">
          ${entrada ? `<select name="p_cliente" class="fx-sel" aria-label="Cliente da parte ${i + 1}">${opcoesCliente(d, p.cliente_id)}</select>` : `<select name="p_categoria" class="fx-sel" aria-label="Categoria da parte ${i + 1}">${opcoesCat(d, p.categoria || t.real.categoria, { tipo })}</select>`}
          ${entrada ? `<input name="p_competencia" type="month" class="fx-in" value="${esc(p.competencia || t.real.competencia)}" aria-label="Mês a que se refere a parte ${i + 1}">`
            : `<input name="p_quem" class="fx-in" value="${esc(p.quem || p.descricao || '')}" placeholder="quem / o quê" aria-label="Quem ou o quê na parte ${i + 1}">`}
          <button type="button" class="fv2-btn s fv2-seta" data-fx="parte-tirar" data-id="${esc(t.id)}" data-valor="${i}" aria-label="Tirar parte ${i + 1}">×</button></div>`).join('')}
        <div class="fx-linha-acoes"><button type="button" class="fv2-btn s" data-fx="parte-mais" data-valor="${esc(t.id)}">+ parte</button>${falta > 0 ? `<button type="button" class="fv2-btn s" data-fx="parte-resto" data-valor="${esc(t.id)}">pôr o resto (${esc(rs(falta))}) numa parte</button>` : ''}<button type="button" class="fv2-btn s" data-fx="parte-desfazer" data-valor="${esc(t.id)}">não dividir</button></div></div>` : ''}
      <div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn p" data-fx="salvar-lanc" data-valor="${esc(t.id)}">Salvar e conferir</button><button type="button" class="fv2-btn s" data-fx="regra-de" data-valor="${esc(t.id)}">Sempre que aparecer${contra ? ` “${esc(contra.split(' ').slice(0, 2).join(' '))}”` : ''}, fazer assim</button></div>
      ${ui.extrato.regra === t.id ? regraForm(d, t) : ''}
    </div>`;
  }
  function regraForm(d, t) {
    const sugerido = t.banco.contraparte ? t.banco.contraparte.split(' ').slice(0, 2).join(' ') : t.banco.historico.split(' ').slice(0, 3).join(' ');
    return `<div class="fx-regra" data-fx-regra="${esc(t.id)}"><p class="fv2-sub">Regra nova: o que tiver este pedaço no histórico do banco ganha a categoria escolhida acima (e o cliente/quem). Vale para o que ainda não foi conferido e para os próximos extratos.</p>
      <div class="fx-grade">${campo('Quando o histórico tiver', `<input name="r_contem" class="fx-in" value="${esc(sugerido)}">`)}${campo('Só em', `<select name="r_sinal" class="fx-sel"><option value="${t.banco.valor < 0 ? 'saida' : 'entrada'}">${t.banco.valor < 0 ? 'saídas' : 'entradas'}</option><option value="">entradas e saídas</option></select>`)}
      ${campo('Pedir para eu conferir mesmo assim', `<select name="r_revisar" class="fx-sel"><option value="">não, já entra conferido</option><option value="1">sim, sugerir e eu confiro</option></select>`)}</div>
      <div class="fx-linha-acoes"><button type="button" class="fv2-btn p" data-fx="regra-salvar" data-valor="${esc(t.id)}">Criar regra</button><button type="button" class="fv2-btn s" data-fx="regra-de" data-valor="">Cancelar</button></div></div>`;
  }
  function porCategoriaHtml(d, r) {
    const saidas = r.categorias.filter((c) => c.total < 0), entradas = r.categorias.filter((c) => c.total > 0);
    const max = Math.max(1, ...r.categorias.map((c) => Math.abs(c.total)));
    const bloco = (l, tom) => l.map((c) => `<button type="button" class="fx-cat" data-fx="cat" data-valor="${c.categoria}" aria-pressed="${ui.extrato.cat === c.categoria}"><span>${esc(c.nome)}<small>${quantos(c.quantidade, 'lançamento', 'lançamentos')}</small></span><b>${esc(rs(c.total))}</b>${barra(Math.abs(c.total) / max * 100, tom)}</button>`).join('');
    return `${entradas.length ? `<p class="fx-rot">Entradas</p>${bloco(entradas, 'bom')}` : ''}${saidas.length ? `<p class="fx-rot">Saídas</p>${bloco(saidas, '')}` : ''}`;
  }
  function regrasHtml(d) {
    const minhas = d.regras || [];
    const corpo = `${minhas.length ? minhas.map((r) => `<div class="fx-mini"><span><b>“${esc(r.quando?.contem)}”</b> → ${esc(nomeCat(d, r.categoria))}${r.quem ? ` · ${esc(r.quem)}` : ''}${r.cliente_nome ? ` · ${esc(r.cliente_nome)}` : ''}</span><button type="button" class="fv2-link" data-fx="regra-tirar" data-valor="${esc(r.id)}">tirar</button></div>`).join('') : '<p class="fv2-sub">Nenhuma regra sua ainda. Abra um lançamento e use “Sempre que aparecer…”.</p>'}
      <details class="fx-det"><summary>Regras que já vêm prontas (${(d.regras_padrao || []).length})</summary>${(d.regras_padrao || []).map((r) => `<p class="fv2-sub">“${esc(r.quando.contem || r.quando.comeca)}” → ${esc(nomeCat(d, r.categoria))}${r.revisar ? ' (você confere)' : ''}</p>`).join('')}</details>`;
    return card('Regras', corpo, 'o que eu sugiro sozinho');
  }
  function importacoesHtml(d) {
    const l = (d.importacoes || []).slice(-4).reverse();
    if (!l.length) return '';
    return card('Importações', l.map((i) => `<p class="fv2-sub">${esc(dataCurta(i.em))} · ${esc(i.por || '')}: ${esc(dataCurta(i.de))} a ${esc(dataCurta(i.ate))} · ${quantos(i.novas, 'novo', 'novos')}${i.repetidas ? `, ${n0(i.repetidas)} já estavam` : ''}</p>`).join(''));
  }
  function previaHtml(d) {
    const p = ui.extrato.previa;
    if (p.erro) return card('Prévia do extrato', `<p class="fv2-sub">${esc(p.erro)}</p><div class="fx-linha-acoes"><button type="button" class="fv2-btn s" data-fx="previa-fechar">Fechar</button></div>`, '', 'fx-previa');
    const porRegra = new Map();
    for (const t of p.transacoes.filter((x) => !x.ja_importada)) { const k = nomeCat(d, t.real.categoria); porRegra.set(k, (porRegra.get(k) || 0) + 1); }
    const meses = p.meses.map((m) => `<div class="fx-mini"><span><b>${esc(nomeMes(m.mes || ''))}</b> · ${quantos(m.lancamentos, 'lançamento', 'lançamentos')}</span><span>entrou ${esc(rs(m.entradas))} · saiu ${esc(rs(m.saidas + m.cartao_e_transferencias))}</span></div>`).join('');
    const exemplos = p.transacoes.filter((x) => !x.ja_importada).slice(-12).reverse().map((t) => `<div class="fx-mini"><span>${esc(dataCurta(t.banco.data))} · ${esc(t.banco.historico)}</span><span>${pill(nomeCat(d, t.real.categoria), t.real.conferido ? 'n' : 'a')} <b>${esc(rs(t.banco.valor))}</b></span></div>`).join('');
    return card(`Prévia: ${ui.extrato.nomeArquivo || 'extrato'}`, `<p class="fx-previa-num"><b>${quantos(p.novas, 'lançamento novo', 'lançamentos novos')}</b>${p.repetidas ? ` · ${n0(p.repetidas)} já estavam aqui e ficam como estão` : ''} · agência ${esc(p.agencia)} conta ${esc(p.conta)}</p>
      ${p.avisos?.length ? `<p class="fv2-sub">${p.avisos.map(esc).join(' · ')}</p>` : ''}${meses}
      <p class="fx-rot">Como eu classifiquei (você confere depois)</p><p class="fv2-sub">${[...porRegra].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(k)}: ${n}`).join(' · ')}</p>
      <details class="fx-det"><summary>Ver os últimos lançamentos</summary>${exemplos}</details>
      <div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn p" data-fx="importar"${p.novas ? '' : ' disabled'}>${p.novas ? `Importar ${quantos(p.novas, 'lançamento', 'lançamentos')}` : 'Nada novo para importar'}</button><button type="button" class="fv2-btn s" data-fx="previa-fechar">Cancelar</button></div>`,
    'nada foi gravado ainda', 'fx-previa');
  }

  // =====================================================================================================
  // CLIENTES MÊS A MÊS
  // =====================================================================================================

  function clientesMes(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.clientes_mes, pc = d.por_cliente || { meses: [], linhas: [] };
    const meses = pc.meses, atual = meses[meses.length - 1];
    const linhas = pc.linhas.filter((l) => l.meses.some((m) => m.situacao !== 'sem'));
    const doMes = linhas.map((l) => l.meses.find((m) => m.mes === atual)).filter(Boolean);
    const recebido = doMes.reduce((s, m) => s + m.recebido, 0), aberto = linhas.reduce((s, l) => s + l.total_aberto, 0), aReceber = linhas.reduce((s, l) => s + (l.a_receber || 0), 0);
    const pagos = doMes.filter((m) => m.situacao === 'pago').length, cobrados = doMes.filter((m) => m.situacao !== 'sem').length;
    const busca = semAcento(ctx.filtro?.fx_clientes || '');
    const vis = linhas.filter((l) => (u.chip === 'aberto' ? l.total_aberto > 0 : u.chip === 'pagos' ? l.total_aberto === 0 : true) && (!busca || semAcento(l.cliente_nome).includes(busca)));
    const maior = linhas.slice().sort((a, b) => b.total_aberto - a.total_aberto)[0];
    const partes = [topo('Clientes mês a mês')];
    partes.push(fala(!pc.desde ? 'Sem o extrato do banco não dá para dizer quem pagou. Importe o extrato no Extrato e conciliação; aqui aparece cada cliente com a mensalidade contra o que entrou.' : !linhas.length ? 'Ainda não há recebimento ligado a cliente. No Extrato, abra cada entrada e diga de qual cliente foi (o boleto que veio junto você divide entre eles).'
      : aberto > 0 ? `Desde ${esc(nomeMes(pc.desde))} (o começo do extrato) ficaram <b>${esc(rs(aberto))}</b> em aberto${maior?.total_aberto ? `; o maior é ${esc(maior.cliente_nome)} (${esc(rs(maior.total_aberto))})` : ''}. Em aberto é mensalidade do contrato sem entrada ligada a esse cliente no Extrato: pode ser que pagou e a entrada ainda não foi ligada.${aReceber ? ` Neste mês ainda faltam entrar ${esc(rs(aReceber))}.` : ''}`
        : `Todo mundo com contrato está em dia desde ${esc(nomeMes(pc.desde))}.${aReceber ? ` Neste mês ainda faltam entrar ${esc(rs(aReceber))}.` : ''}`));
    partes.push(kpis([
      { rotulo: `Recebido em ${nomeMes(atual)}`, valor: mil(recebido), tom: 'bom' },
      { rotulo: 'Em aberto (meses passados)', valor: mil(aberto), tom: aberto > 0 ? 'ruim' : '', sub: aReceber ? `e ${esc(mil(aReceber))} a receber neste mês` : '' },
      { rotulo: `Pagaram em ${MESES[Number(String(atual).slice(5)) - 1] || ''}`, valor: `${n0(pagos)} de ${n0(cobrados)}` },
    ]));
    const filtro = `<div class="fv2-filtros"><label class="fv2-sr" for="fx-busca-cli">Buscar cliente</label><input class="fv2-busca" id="fx-busca-cli" type="search" data-vc-busca="fx_clientes" placeholder="Buscar cliente" value="${esc(ctx.filtro?.fx_clientes || '')}">
      ${chips('clientes_mes', [['todos', 'Todos', linhas.length], ['aberto', 'Com algo em aberto', linhas.filter((l) => l.total_aberto > 0).length], ['pagos', 'Em dia', linhas.filter((l) => !l.total_aberto).length]], u.chip)}</div>`;
    const cab = `<div class="fx-mm fx-mm-cab" style="--n:${meses.length}"><span>Cliente</span>${meses.map((m) => `<span>${esc(mesCurto(m))}</span>`).join('')}<span>Em aberto</span></div>`;
    const corpo = vis.map((l) => {
      const aberta = u.aberta === l.cliente_id;
      return `<div class="fx-mm-bloco"><div class="fx-mm" style="--n:${meses.length}"><button type="button" class="fx-mm-nome" data-fx="abrir" data-alvo="clientes_mes" data-valor="${esc(l.cliente_id)}" aria-expanded="${aberta}">${esc(l.cliente_nome)}${l.mensalidade ? `<small>${esc(rs(l.mensalidade))}/mês</small>` : '<small>sem mensalidade</small>'}</button>
        ${l.meses.map((m) => `<span class="fx-cel ${m.situacao}" title="${esc(m.situacao === 'fora' ? `${nomeMes(m.mes)}: antes do extrato importado` : `${nomeMes(m.mes)}: previsto ${rs(m.previsto)}, recebido ${rs(m.recebido)}${m.em_aberto ? `, em aberto ${rs(m.em_aberto)}` : ''}${m.a_receber ? `, a receber ${rs(m.a_receber)}` : ''}`)}">${m.situacao === 'sem' || m.situacao === 'fora' ? '·' : m.situacao === 'pago' ? '✓' : esc(mil(m.em_aberto || m.a_receber).replace('R$ ', ''))}</span>`).join('')}
        <b class="${l.total_aberto ? 'fx-neg' : ''}">${l.total_aberto ? esc(rs(l.total_aberto)) : '—'}</b></div>${aberta ? detalheCliente(d, l) : ''}</div>`;
    }).join('');
    const legenda = `<p class="fv2-sub fx-legenda"><span class="fx-cel pago">✓</span> pago <span class="fx-cel parcial">½</span> parcial <span class="fx-cel aberto">!</span> em aberto <span class="fx-cel a_receber">…</span> a receber no mês <span class="fx-cel sem">·</span> sem cobrança ou antes do extrato · o mês é o “mês a que se refere” do lançamento</p>`;
    partes.push(card('Pago e em aberto por mês', filtro + `<div class="fx-mm-rolo">${cab}${corpo || vazio('Ninguém com esse filtro.')}</div>` + legenda));
    return casca(partes, 'clientes_mes');
  }
  function detalheCliente(d, l) {
    const doCliente = (d.transacoes || []).flatMap((t) => X().pedacos(t).filter((p) => String(p.cliente_id) === String(l.cliente_id) && p.valor > 0).map((p) => ({ ...p, historico: t.banco.historico })));
    return `<div class="fx-mm-det">${doCliente.length ? doCliente.slice().reverse().map((p) => `<div class="fx-mini"><span>${esc(dataCurta(p.data))} · ${esc(p.historico)} <small>(ref. ${esc(mesCurto(p.competencia))})</small></span><span>${p.status !== 'pago' ? pill(STATUS_NOME[p.status], STATUS_TOM[p.status]) : ''} <b>${esc(rs(p.valor))}</b> <button type="button" class="fv2-link" data-fx="ir-lanc" data-valor="${esc(p.id)}" data-mes="${esc(p.data.slice(0, 7))}">abrir</button></span></div>`).join('')
      : '<p class="fv2-sub">Nenhuma entrada ligada a este cliente. No Extrato, diga de quem foi cada entrada.</p>'}</div>`;
  }

  // =====================================================================================================
  // CARTÃO
  // =====================================================================================================
  function cartao(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.cartao, faturas = d.cartao?.faturas || [], soltos = d.cartao?.pagamentos_sem_fatura || [];
    if (!/^d{4}-d{2}$/.test(u.fatura || '')) u.fatura = faturas[0]?.fatura || d.hoje?.slice(0, 7) || '';
    const meses = [...new Set([...faturas.map((f) => f.fatura), d.hoje?.slice(0, 7), u.fatura].filter(Boolean))].sort();
    const doMes = faturas.filter((f) => f.fatura === u.fatura);
    const total = doMes.reduce((s, f) => s + f.total, 0), pago = doMes.reduce((s, f) => s + f.pago_no_extrato, 0), falta = doMes.reduce((s, f) => s + f.falta, 0);
    const semCat = doMes.flatMap((f) => f.itens).filter((i) => i.categoria === 'a_classificar').length;
    const acoes = `<button type="button" class="fv2-btn s" data-fx="cartao-colar">Colar fatura</button><button type="button" class="fv2-btn p" data-fx="cartao-novo">Novo item</button>`;
    const partes = [topo('Cartão de crédito', acoes, mesNav(meses, u.fatura, 'cartao'))];
    partes.push(fala(!faturas.length ? 'O banco só mostra o pagamento da fatura (o Pix para o Vinícius ou o débito automático). Cole aqui os itens da fatura para saber o que é cada coisinha e o que já foi pago.'
      : `Fatura de ${esc(nomeMes(u.fatura))}: <b>${esc(rs(total))}</b> em ${quantos(doMes.reduce((s, f) => s + f.itens.length, 0), 'item', 'itens')}; ${falta > 0 ? `faltam <b>${esc(rs(falta))}</b> para quitar` : 'quitada pelo extrato'}${semCat ? `, ${quantos(semCat, 'item sem categoria', 'itens sem categoria')}` : ''}${soltos.length ? `. Há ${quantos(soltos, 'pagamento de cartão', 'pagamentos de cartão')} no extrato sem fatura escolhida` : ''}.`));
    partes.push(kpis([{ rotulo: 'Total da fatura', valor: mil(total) }, { rotulo: 'Pago (pelo extrato)', valor: mil(pago), tom: 'bom' }, { rotulo: 'Falta pagar', valor: mil(falta), tom: falta > 0 ? 'ruim' : '' }]));
    if (u.colar) partes.push(colarHtml(d));
    if (u.novo || u.editando) partes.push(itemForm(d, (d.cartao?.itens || []).find((i) => i.id === u.editando) || { fatura: u.fatura, data: `${u.fatura}-01`, status: 'em_aberto' }));
    const fat = doMes.map((f) => {
      const max = Math.max(1, ...f.por_categoria.map((c) => c.total));
      const itens = f.itens.map((i) => `<div class="fx-item"><span class="fx-dia">${dataCurta(i.data)}</span><span class="fx-item-txt"><b>${esc(i.descricao)}</b><small>${esc(nomeCat(d, i.categoria))}${i.parcela ? ` · parcela ${esc(i.parcela)}` : ''}${i.cliente_nome ? ` · ${esc(i.cliente_nome)}` : ''}${i.quem ? ` · ${esc(i.quem)}` : ''}</small></span>
        <span class="fv2-seg fx-seg-p" role="group" aria-label="Situação do item">${['pago', 'nao_pago', 'em_aberto'].map((s) => `<button type="button" data-fx="item-status" data-id="${esc(i.id)}" data-valor="${s}" aria-pressed="${i.status === s}">${STATUS_NOME[s]}</button>`).join('')}</span>
        <b class="fx-valor s">${esc(rs(i.valor))}</b><button type="button" class="fv2-link" data-fx="item-editar" data-valor="${esc(i.id)}">editar</button></div>`).join('');
      const pagamentos = f.pagamentos.length ? f.pagamentos.map((p) => `<p class="fv2-sub">Pago ${esc(dataCurta(p.data))} · ${esc(p.historico)} · ${esc(rs(p.valor))}</p>`).join('') : '<p class="fv2-sub">Nenhum pagamento do extrato ligado a esta fatura.</p>';
      return card(f.cartao, `${pill({ paga: 'Paga', parcial: 'Paga em parte', em_aberto: 'Em aberto', vazia: 'Vazia' }[f.situacao], { paga: 'g', parcial: 'a', em_aberto: 'r', vazia: 'n' }[f.situacao])}
        <div class="fx-duas"><div class="fx-col">${itens || vazio('Nenhum item.')}</div><div class="fx-col fx-lado"><p class="fx-rot">Por categoria</p>${f.por_categoria.map((c) => `<div class="fx-cat"><span>${esc(c.nome)}</span><b>${esc(rs(c.total))}</b>${barra(c.total / max * 100)}</div>`).join('')}<p class="fx-rot">Pagamentos</p>${pagamentos}</div></div>`, `${esc(rs(f.total))} · fatura de ${esc(nomeMes(f.fatura))}`);
    }).join('');
    partes.push(fat || card(`Fatura de ${nomeMes(u.fatura)}`, vazio('Nenhum item nesta fatura.', '<button type="button" class="fv2-btn s" data-fx="cartao-colar">Colar itens da fatura</button>')));
    if (soltos.length) partes.push(card('Pagamentos de cartão sem fatura escolhida', soltos.map((p) => `<div class="fx-mini"><span>${esc(dataCurta(p.data))} · ${esc(p.historico)} · <b>${esc(rs(p.valor))}</b></span><button type="button" class="fv2-link" data-fx="ir-lanc" data-valor="${esc(p.id)}" data-mes="${esc(p.data.slice(0, 7))}">escolher a fatura no extrato</button></div>`).join(''), 'Pix para o Vinícius e débito automático'));
    return casca(partes, 'cartao');
  }
  function itemForm(d, it) {
    return card(it.id ? 'Editar item da fatura' : 'Novo item da fatura', `<div class="fx-grade" data-fx-form="item" data-id="${esc(it.id || '')}">
      ${campo('O que é', `<input name="descricao" class="fx-in" value="${esc(it.descricao || '')}" placeholder="ex.: Adobe, almoço com cliente">`, 'largo')}
      ${campo('Valor', `<input name="valor" class="fx-in fx-num" inputmode="decimal" value="${esc(it.valor != null ? String(it.valor).replace('.', ',') : '')}">`)}
      ${campo('Data da compra', `<input name="data" type="date" class="fx-in" value="${esc(it.data || '')}">`)}
      ${campo('Fatura', `<input name="fatura" type="month" class="fx-in" value="${esc(it.fatura || '')}">`)}
      ${campo('Categoria', `<select name="categoria" class="fx-sel">${opcoesCat(d, it.categoria || 'a_classificar', { tipo: 'saida' })}</select>`)}
      ${campo('Parcela', `<input name="parcela" class="fx-in" value="${esc(it.parcela || '')}" placeholder="1/3">`)}
      ${campo('Cliente', `<select name="cliente_id" class="fx-sel">${opcoesCliente(d, it.cliente_id)}</select>`)}
      ${campo('Quem usou', `<input name="quem" class="fx-in" value="${esc(it.quem || '')}">`)}
      ${campo('Cartão', `<input name="cartao" class="fx-in" value="${esc(it.cartao || 'Cartão da agência')}">`)}
      ${campo('Situação', `<select name="status" class="fx-sel">${['pago', 'nao_pago', 'em_aberto'].map((s) => `<option value="${s}"${(it.status || 'em_aberto') === s ? ' selected' : ''}>${STATUS_NOME[s]}</option>`).join('')}</select>`)}
    </div><div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn p" data-fx="item-salvar">Salvar</button><button type="button" class="fv2-btn s" data-fx="item-fechar">Cancelar</button>${it.id ? `<button type="button" class="fv2-btn s fv2-perigo" data-fx="item-tirar" data-valor="${esc(it.id)}">Tirar da fatura</button>` : ''}</div>`);
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
    return card('Colar itens da fatura', `<p class="fv2-sub">Uma compra por linha: <code>12/10 ADOBE 2/12 99,90</code>. Depois é só dar a categoria e a situação de cada uma.</p>
      <div class="fx-grade">${campo('Fatura de', `<input name="cf_fatura" type="month" class="fx-in" value="${esc(ui.cartao.fatura)}">`)}${campo('Cartão', '<input name="cf_cartao" class="fx-in" value="Cartão da agência">')}</div>
      <textarea name="cf_texto" class="fx-in fx-area" rows="7" aria-label="Itens da fatura"></textarea>
      <div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn p" data-fx="colar-salvar">Lançar os itens</button><button type="button" class="fv2-btn s" data-fx="cartao-colar">Cancelar</button></div>`, '', 'fx-colar');
  }

  // =====================================================================================================
  // GASTOS FIXOS
  // =====================================================================================================
  const FORMA_NOME = { pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão', debito: 'Débito automático' };
  function fixos(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.fixos, lista = d.fixos || [];
    const meses = [...new Set([...(d.meses || []), d.hoje?.slice(0, 7)].filter(Boolean))].sort();
    if (!u.mes || !meses.includes(u.mes)) u.mes = d.hoje?.slice(0, 7) || meses[meses.length - 1] || '';
    const a = X().analisarFixos(lista, d.transacoes || [], u.mes, d.cartao?.itens || []);
    const entradaMedia = Object.values(d.projecao?.base?.entradas_por_categoria || {}).reduce((s, v) => s + Number(v || 0), 0);
    const pct = entradaMedia ? Math.round(a.total / entradaMedia * 100) : null;
    const provaveis = fixosProvaveis(d.transacoes || [], lista);
    const partes = [topo('Gastos fixos', `<button type="button" class="fv2-btn p" data-fx="fixo-novo">Novo gasto fixo</button>`, mesNav(meses, u.mes, 'fixos'))];
    const faltam = a.fixos.filter((f) => !f.achado && f.vence <= (d.hoje || '')).length;
    partes.push(fala(!lista.length ? `Cadastre aqui o que sai todo mês: programas, assinaturas, aluguel, internet, contador, empréstimo. ${provaveis.length ? `Pelo extrato, achei <b>${quantos(provaveis.length, 'coisa', 'coisas')} que parecem fixas</b>; é só confirmar.` : ''}`
      : `Os fixos somam <b>${esc(rs(a.total))}</b> por mês (${esc(rs(a.anual))} no ano)${pct != null ? `, ${pct}% do que entra em média` : ''}. ${faltam ? `${quantos(faltam, 'já venceu e não apareceu', 'já venceram e não apareceram')} no extrato de ${esc(MESES[Number(u.mes.slice(5)) - 1])}.` : 'Tudo que já venceu apareceu no extrato.'}`));
    partes.push(kpis([{ rotulo: 'Por mês', valor: mil(a.total) }, { rotulo: 'No ano', valor: mil(a.anual) }, { rotulo: `Já saíram em ${MESES[Number(u.mes.slice(5)) - 1] || ''}`, valor: `${n0(a.achados)} de ${n0(a.quantidade)}`, tom: a.achados < a.quantidade ? '' : 'bom' }]));
    if (u.novo || u.editando) partes.push(fixoForm(d, lista.find((f) => f.id === u.editando) || u.rascunho || {}));
    const linhas = a.fixos.map((f) => `<div class="fx-item"><span class="fx-dia">dia ${n0(f.dia)}</span><span class="fx-item-txt"><b>${esc(f.nome)}</b><small>${esc(nomeCat(d, f.categoria))} · ${esc(FORMA_NOME[f.forma] || f.forma)}${f.observacao ? ` · ${esc(f.observacao)}` : ''}</small></span>
      ${f.achado ? pill(`saiu ${dataCurta(f.achado.data)}${f.diferenca ? ` (${f.diferenca > 0 ? '+' : ''}${rs(f.diferenca)})` : ''}`, f.diferenca > 0 ? 'a' : 'g') : f.vence <= (d.hoje || '') ? pill('não apareceu', 'r') : pill(`vence ${dataCurta(f.vence)}`, 'n')}
      <b class="fx-valor s">${esc(rs(f.valor))}</b><button type="button" class="fv2-link" data-fx="fixo-editar" data-valor="${esc(f.id)}">editar</button></div>`).join('');
    const inativos = lista.filter((f) => !X().fixoVigente(f, u.mes));
    const max = Math.max(1, ...a.por_categoria.map((c) => c.total));
    partes.push(`<div class="fx-duas"><div class="fx-col">${card(`Fixos de ${nomeMes(u.mes)}`, (linhas || vazio('Nenhum gasto fixo cadastrado.')) + (inativos.length ? `<details class="fx-det"><summary>${quantos(inativos.length, 'parado ou fora do período', 'parados ou fora do período')}</summary>${inativos.map((f) => `<div class="fx-mini"><span>${esc(f.nome)} · ${esc(rs(f.valor))}${f.fim ? ` · até ${esc(mesCurto(f.fim))}` : ''}</span><button type="button" class="fv2-link" data-fx="fixo-editar" data-valor="${esc(f.id)}">editar</button></div>`).join('')}</details>` : ''))}</div>
      <div class="fx-col fx-lado">${card('Onde pesa', a.por_categoria.map((c) => `<div class="fx-cat"><span>${esc(c.nome)}<small>${c.pct}% dos fixos</small></span><b>${esc(rs(c.total))}</b>${barra(c.total / max * 100)}</div>`).join('') || '<p class="fv2-sub">Cadastre para ver.</p>')}
      ${provaveis.length ? card('Parecem fixos (pelo extrato)', provaveis.slice(0, 8).map((p, i) => `<div class="fx-mini"><span><b>${esc(p.nome)}</b> · ${esc(nomeCat(d, p.categoria))} · ${n0(p.meses)} meses · dia ~${n0(p.dia)}</span><span><b>${esc(rs(p.valor))}</b> <button type="button" class="fv2-link" data-fx="fixo-provavel" data-valor="${i}">cadastrar</button></span></div>`).join(''), 'mesmo destino e valor parecido em meses diferentes') : ''}</div></div>`);
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
  function fixoForm(d, f) {
    return card(f.id ? 'Editar gasto fixo' : 'Novo gasto fixo', `<div class="fx-grade" data-fx-form="fixo" data-id="${esc(f.id || '')}">
      ${campo('Nome', `<input name="nome" class="fx-in" value="${esc(f.nome || '')}" placeholder="ex.: Adobe, aluguel, contador">`, 'largo')}
      ${campo('Valor por mês', `<input name="valor" class="fx-in fx-num" inputmode="decimal" value="${esc(f.valor != null ? String(f.valor).replace('.', ',') : '')}">`)}
      ${campo('Dia que vence', `<input name="dia" type="number" min="1" max="31" class="fx-in" value="${esc(f.dia || '')}">`)}
      ${campo('Categoria', `<select name="categoria" class="fx-sel">${opcoesCat(d, f.categoria || 'ferramentas', { tipo: 'saida' })}</select>`)}
      ${campo('Como paga', `<select name="forma" class="fx-sel">${Object.entries(FORMA_NOME).map(([k, n]) => `<option value="${k}"${(f.forma || 'pix') === k ? ' selected' : ''}>${n}</option>`).join('')}</select>`)}
      ${campo('Como aparece no extrato/fatura', `<input name="contem" class="fx-in" value="${esc(f.contem || '')}" placeholder="pedaço do nome (opcional)">`)}
      ${campo('Desde', `<input name="inicio" type="month" class="fx-in" value="${esc(f.inicio || '')}">`)}
      ${campo('Até (se acaba)', `<input name="fim" type="month" class="fx-in" value="${esc(f.fim || '')}">`)}
      ${campo('Observação', `<input name="observacao" class="fx-in" value="${esc(f.observacao || '')}">`, 'largo')}
      ${campo('Ativo', `<select name="ativo" class="fx-sel"><option value="1"${f.ativo !== false ? ' selected' : ''}>sim</option><option value=""${f.ativo === false ? ' selected' : ''}>parado</option></select>`)}
    </div><div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn p" data-fx="fixo-salvar">Salvar</button><button type="button" class="fv2-btn s" data-fx="fixo-fechar">Cancelar</button>${f.id ? `<button type="button" class="fv2-btn s fv2-perigo" data-fx="fixo-tirar" data-valor="${esc(f.id)}">Apagar</button>` : ''}</div>`);
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
      partes.push(fala('A projeção nasce do que já aconteceu: importe o extrato (e confira para onde foi cada coisa) que eu calculo a média por categoria e projeto o caixa.'));
      return casca(partes, 'projecao');
    }
    const cen = cenarioAtual(d);
    const hoje = X().projetar(base, {}, u.horizonte), com = X().projetar(base, cen, u.horizonte);
    const mexeu = Boolean(cen.cortes.length || cen.economias.length || cen.clientes_novos.length || cen.clientes_perdidos.length || cen.gastos_novos.length || cen.ajuste_entradas_pct);
    const diff = Math.round((com.saldo_final - hoje.saldo_final) * 100) / 100;
    partes.push(fala(`Pela média de ${esc(listaE(base.meses_usados.map((m) => MESES[Number(m.slice(5)) - 1])))} (${base.meses_usados.length === 1 ? 'mês fechado' : 'meses fechados'}), entra ${esc(rs(sumObj(base.entradas_por_categoria)))} e sai ${esc(rs(sumObj(base.saidas_por_categoria)))} por mês. Assim, em ${u.horizonte} meses o caixa vai a <b>${esc(rs(hoje.saldo_final))}</b>${hoje.primeiro_mes_negativo ? `, e fica negativo em ${esc(nomeMes(hoje.primeiro_mes_negativo))}` : ''}.${mexeu ? ` Com o seu cenário: <b>${esc(rs(com.saldo_final))}</b> (${diff >= 0 ? '+' : ''}${esc(rs(diff))})${com.primeiro_mes_negativo ? `, negativo em ${esc(nomeMes(com.primeiro_mes_negativo))}` : ', sem ficar negativo'}.` : ' Mexa no cenário ao lado para ver o “e se”.'}`));
    partes.push(kpis([
      { rotulo: 'Caixa hoje', valor: mil(base.saldo_hoje) },
      { rotulo: `Em ${u.horizonte} meses, como está`, valor: mil(hoje.saldo_final), tom: hoje.saldo_final < 0 ? 'ruim' : '' },
      { rotulo: `Em ${u.horizonte} meses, com o cenário`, valor: mil(com.saldo_final), tom: com.saldo_final < 0 ? 'ruim' : com.saldo_final > hoje.saldo_final ? 'bom' : '' },
    ]));
    partes.push(`<div class="fx-duas fx-proj"><div class="fx-col">${card('Caixa mês a mês', grafico(d, hoje, com, mexeu) + tabelaProj(hoje, com, mexeu), 'realizado (extrato) e projetado')}${card('Realizado: fluxo de caixa', fluxoRealizado(d), 'do extrato, pelo lado real')}${card('Realizado: resultado por grupo', dreHtml(d), 'como um DRE de caixa')}</div>
      <div class="fx-col fx-lado">${cenarioHtml(d, base)}</div></div>`);
    return casca(partes, 'projecao');
  }
  const listaE = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l[0] || '');
  const sumObj = (o) => Object.values(o || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  function grafico(d, hoje, com, mexeu) {
    const real = (d.serie || []).filter((s) => s.saldo_final != null).map((s) => ({ mes: s.mes, saldo: s.saldo_final }));
    const pontos = [...real.map((r) => ({ ...r, tipo: 'real' })), ...hoje.meses.map((m, i) => ({ mes: m.mes, saldo: m.saldo, com: com.meses[i].saldo, tipo: 'proj' }))];
    if (!pontos.length) return '';
    const vals = pontos.flatMap((p) => [p.saldo, p.com]).filter((v) => v != null);
    const min = Math.min(0, ...vals), max = Math.max(0, ...vals), W = 640, H = 200, pad = 26;
    const x = (i) => pad + (pontos.length === 1 ? 0 : i * (W - 2 * pad) / (pontos.length - 1));
    const y = (v) => H - pad - ((v - min) / ((max - min) || 1)) * (H - 2 * pad);
    const linha = (f) => pontos.map((p, i) => (f(p) == null ? null : `${x(i).toFixed(1)},${y(f(p)).toFixed(1)}`)).filter(Boolean).join(' ');
    const nReal = real.length;
    const projHoje = pontos.map((p, i) => (i >= nReal - 1 ? `${x(i).toFixed(1)},${y(p.saldo).toFixed(1)}` : null)).filter(Boolean).join(' ');
    const projCom = pontos.map((p, i) => (i === nReal - 1 ? `${x(i).toFixed(1)},${y(p.saldo).toFixed(1)}` : i >= nReal ? `${x(i).toFixed(1)},${y(p.com).toFixed(1)}` : null)).filter(Boolean).join(' ');
    return `<svg class="fx-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo do caixa: realizado e projetado">
      <line x1="${pad}" x2="${W - pad}" y1="${y(0)}" y2="${y(0)}" class="zero"/>
      ${nReal ? `<polyline points="${linha((p) => (p.tipo === 'real' ? p.saldo : null))}" class="real"/>` : ''}
      <polyline points="${projHoje}" class="hoje"/>${mexeu ? `<polyline points="${projCom}" class="com"/>` : ''}
      ${pontos.map((p, i) => (i % Math.ceil(pontos.length / 8) === 0 || i === pontos.length - 1 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(mesCurto(p.mes))}</text>` : '')).join('')}
      <text x="${pad}" y="12">${esc(mil(max))}</text>${min < 0 ? `<text x="${pad}" y="${H - pad + 12}">${esc(mil(min))}</text>` : ''}
    </svg><p class="fv2-sub fx-legenda"><i class="fx-l real"></i> realizado <i class="fx-l hoje"></i> se nada mudar ${mexeu ? '<i class="fx-l com"></i> com o cenário' : ''}</p>`;
  }
  function tabelaProj(hoje, com, mexeu) {
    return `<details class="fx-det"><summary>Ver a tabela mês a mês</summary><div class="fx-tab" role="table"><div class="fx-tr fx-th" role="row"><span>Mês</span><span>Entra</span><span>Sai</span><span>Resultado</span><span>Saldo</span>${mexeu ? '<span>Saldo c/ cenário</span>' : ''}</div>
      ${hoje.meses.map((m, i) => `<div class="fx-tr" role="row"><span>${esc(mesCurto(m.mes))}</span><span>${esc(mil(mexeu ? com.meses[i].entradas : m.entradas))}</span><span>${esc(mil(mexeu ? com.meses[i].saidas : m.saidas))}</span><span class="${(mexeu ? com.meses[i].resultado : m.resultado) < 0 ? 'fx-neg' : ''}">${esc(mil(mexeu ? com.meses[i].resultado : m.resultado))}</span><span class="${m.saldo < 0 ? 'fx-neg' : ''}">${esc(mil(m.saldo))}</span>${mexeu ? `<span class="${com.meses[i].saldo < 0 ? 'fx-neg' : ''}">${esc(mil(com.meses[i].saldo))}</span>` : ''}</div>`).join('')}</div></details>`;
  }
  function fluxoRealizado(d) {
    const s = d.serie || [];
    if (!s.length) return '<p class="fv2-sub">Sem extrato ainda.</p>';
    const max = Math.max(1, ...s.flatMap((m) => [m.entradas, m.saidas + m.cartao]));
    return s.map((m) => `<div class="fx-fluxo"><span>${esc(mesCurto(m.mes))}${m.a_revisar ? `<small>${n0(m.a_revisar)} a conferir</small>` : ''}</span><span class="fx-fluxo-b"><i class="e" style="width:${m.entradas / max * 100}%"></i><i class="s" style="width:${(m.saidas + m.cartao) / max * 100}%"></i></span><span>entrou <b>${esc(mil(m.entradas))}</b> · saiu <b>${esc(mil(m.saidas + m.cartao))}</b> · <b class="${m.resultado < 0 ? 'fx-neg' : ''}">${esc(mil(m.resultado))}</b></span></div>`).join('');
  }
  function dreHtml(d) {
    const meses = d.meses || [];
    if (!meses.length) return '<p class="fv2-sub">Sem extrato ainda.</p>';
    const ultimos = meses.slice(-4);
    const grupos = new Map();
    for (const m of ultimos) for (const c of X().resumo(d.transacoes || [], { mes: m }).categorias) {
      const g = grupos.get(c.grupo) || { grupo: c.grupo, tipo: c.tipo, por: {} };
      g.por[m] = (g.por[m] || 0) + c.total; grupos.set(c.grupo, g);
    }
    const linhas = [...grupos.values()].sort((a, b) => (a.tipo === 'entrada' ? -1 : 1) - (b.tipo === 'entrada' ? -1 : 1) || Math.abs(sumObj(b.por)) - Math.abs(sumObj(a.por)));
    const total = Object.fromEntries(ultimos.map((m) => [m, linhas.reduce((s, g) => s + (g.por[m] || 0), 0)]));
    return `<div class="fx-tab fx-dre" role="table" style="--n:${ultimos.length}"><div class="fx-tr fx-th" role="row"><span>Grupo</span>${ultimos.map((m) => `<span>${esc(mesCurto(m))}</span>`).join('')}</div>
      ${linhas.map((g) => `<div class="fx-tr" role="row"><span>${esc(g.grupo)}</span>${ultimos.map((m) => `<span class="${(g.por[m] || 0) < 0 ? 'fx-neg' : ''}">${g.por[m] ? esc(mil(g.por[m])) : '—'}</span>`).join('')}</div>`).join('')}
      <div class="fx-tr fx-tot" role="row"><span>Resultado</span>${ultimos.map((m) => `<span class="${total[m] < 0 ? 'fx-neg' : ''}">${esc(mil(total[m]))}</span>`).join('')}</div></div>`;
  }
  function cenarioHtml(d, base) {
    const c = ui.projecao.cenario;
    const saidas = Object.entries(base.saidas_por_categoria || {}).sort((a, b) => b[1] - a[1]);
    const cortes = saidas.map(([cat, v]) => `<div class="fx-corte"><span>${esc(nomeCat(d, cat))}<small>${esc(rs(v))}/mês</small></span><select class="fx-sel" data-fx-campo="corte" data-valor="${cat}" aria-label="Cortar ${esc(nomeCat(d, cat))}">${[0, 10, 25, 50, 75, 100].map((p) => `<option value="${p}"${Number(c.cortes[cat] || 0) === p ? ' selected' : ''}>${p ? `−${p}%` : 'manter'}</option>`).join('')}</select></div>`).join('');
    const fixos = (d.fixos || []).filter((f) => f.ativo !== false).map((f) => `<label class="fx-check"><input type="checkbox" data-fx-campo="economia" data-valor="${esc(f.id)}"${c.economias[f.id] ? ' checked' : ''}> ${esc(f.nome)} <small>${esc(rs(f.valor))}</small></label>`).join('');
    const perder = (d.clientes || []).filter((x) => x.ativo !== false && x.mensalidade > 0).map((x) => `<label class="fx-check"><input type="checkbox" data-fx-campo="perder" data-valor="${esc(x.id)}"${c.clientes_perdidos[x.id] ? ' checked' : ''}> ${esc(x.nome)} <small>${esc(rs(x.mensalidade))}</small></label>`).join('');
    const novos = c.clientes_novos.map((x, i) => `<div class="fx-parte"><input class="fx-in fx-num" data-fx-campo="novo-quantos" data-valor="${i}" type="number" min="1" max="50" value="${esc(x.quantos)}" aria-label="Quantos clientes"><span>cliente(s) de</span><input class="fx-in fx-num" data-fx-campo="novo-valor" data-valor="${i}" inputmode="decimal" value="${esc(x.valor)}" placeholder="R$/mês" aria-label="Valor por mês"><span>a partir do mês</span><input class="fx-in fx-num" data-fx-campo="novo-mes" data-valor="${i}" type="number" min="1" max="12" value="${esc(x.a_partir)}" aria-label="A partir de qual mês"><button type="button" class="fv2-btn s fv2-seta" data-fx="novo-tirar" data-valor="${i}" aria-label="Tirar">×</button></div>`).join('');
    const gastos = c.gastos_novos.map((x, i) => `<div class="fx-parte fx-gasto"><input class="fx-in" data-fx-campo="gasto-nome" data-valor="${i}" value="${esc(x.nome)}" placeholder="o quê" aria-label="Gasto novo"><input class="fx-in fx-num" data-fx-campo="gasto-valor" data-valor="${i}" inputmode="decimal" value="${esc(x.valor)}" placeholder="R$/mês" aria-label="Valor por mês"><span>a partir do mês</span><input class="fx-in fx-num" data-fx-campo="gasto-mes" data-valor="${i}" type="number" min="1" max="12" value="${esc(x.a_partir)}" aria-label="A partir de qual mês"><button type="button" class="fv2-btn s fv2-seta" data-fx="gasto-tirar" data-valor="${i}" aria-label="Tirar">×</button></div>`).join('');
    const salvos = (d.projecao?.cenarios || []).map((s) => `<div class="fx-mini"><button type="button" class="fv2-link" data-fx="cenario-usar" data-valor="${esc(s.id)}">${esc(s.nome)}</button><button type="button" class="fv2-link" data-fx="cenario-tirar" data-valor="${esc(s.id)}">tirar</button></div>`).join('');
    return card('E se…', `<p class="fx-rot">Pegar clientes novos</p>${novos}<button type="button" class="fv2-btn s" data-fx="novo-mais">+ clientes novos</button>
      <p class="fx-rot">Perder um cliente</p><details class="fx-det"><summary>escolher (${Object.values(c.clientes_perdidos).filter(Boolean).length})</summary>${perder || '<p class="fv2-sub">Nenhum cliente com mensalidade.</p>'}</details>
      <p class="fx-rot">Cortar um gasto fixo</p>${fixos ? `<details class="fx-det"><summary>escolher (${Object.values(c.economias).filter(Boolean).length})</summary>${fixos}</details>` : '<p class="fv2-sub">Cadastre os fixos para cortar um a um.</p>'}
      <p class="fx-rot">Cortar por categoria (média do realizado)</p>${cortes}
      <p class="fx-rot">Gasto novo</p>${gastos}<button type="button" class="fv2-btn s" data-fx="gasto-mais">+ gasto novo</button>
      <p class="fx-rot">Entradas</p><div class="fx-corte"><span>Reajuste do que já entra</span><select class="fx-sel" data-fx-campo="ajuste" aria-label="Reajuste das entradas">${[-30, -20, -10, 0, 5, 10, 20, 30].map((p) => `<option value="${p}"${Number(c.ajuste_entradas_pct) === p ? ' selected' : ''}>${p > 0 ? '+' : ''}${p}%</option>`).join('')}</select></div>
      <div class="fx-linha-acoes fx-fim"><input class="fx-in" data-fx-campo="cenario-nome" value="${esc(ui.projecao.nome)}" placeholder="nome do cenário" aria-label="Nome do cenário"><button type="button" class="fv2-btn p" data-fx="cenario-salvar">Guardar</button><button type="button" class="fv2-btn s" data-fx="cenario-limpar">Limpar</button></div>
      ${salvos ? `<p class="fx-rot">Guardados</p>${salvos}` : ''}`, 'o cálculo muda na hora', 'fx-cenario');
  }

  // =====================================================================================================
  // VORCARO (Tesouraria): a tela de quem cuida do setor. O que ele viu, o que pede decisão e o que chegou do WhatsApp.
  // =====================================================================================================
  const ANEXO = { print: 'print', audio: 'áudio', mensagem: 'mensagem' };
  // A análise do setor: cada achado diz o que é, quanto pesa e leva ao lugar de resolver. Do mais grave ao mais leve.
  function analise(d) {
    const out = [], lista = d.transacoes || [], hoje = d.hoje || '', mes = hoje.slice(0, 7);
    const ir = (aba, extra = {}) => ({ aba, ...extra });
    const saldo = d.projecao?.base?.saldo_hoje;
    if (saldo != null && saldo < 0) out.push({ g: 3, texto: `A conta está no negativo (${rs(saldo)}): o banco cobra juros do limite todo dia.`, ...ir('projecao') });
    const proj = d.projecao?.base?.meses_usados?.length ? X().projetar(d.projecao.base, {}, 6) : null;
    if (proj?.primeiro_mes_negativo) out.push({ g: 3, texto: `No ritmo dos últimos meses, o caixa fica negativo em ${nomeMes(proj.primeiro_mes_negativo)}.`, ...ir('projecao') });
    const juros = lista.filter((t) => t.banco.data.startsWith(mes)).flatMap((t) => X().pedacos(t)).filter((p) => p.categoria === 'juros_banco').reduce((s, p) => s - p.valor, 0);
    if (juros > 0) out.push({ g: 2, texto: `Em ${MESES[Number(mes.slice(5)) - 1]} já foram ${rs(juros)} de juros por usar o limite da conta.`, ...ir('extrato', { cat: 'juros_banco' }) });
    const pend = (d.vorcaro?.propostas || []).filter((p) => p.estado === 'pendente').length;
    if (pend) out.push({ g: 2, texto: `${quantos(pend, 'lançamento chegou', 'lançamentos chegaram')} pelo WhatsApp e espera${pend === 1 ? '' : 'm'} vocês decidirem.`, ancora: 'whats' });
    const conferir = lista.filter((t) => !t.real.conferido).length;
    if (conferir) out.push({ g: 2, texto: `${quantos(conferir, 'lançamento do banco', 'lançamentos do banco')} ainda sem conferir (para onde foi de verdade).`, ...ir('extrato', { chip: 'conferir' }) });
    const boletos = lista.filter((t) => t.real.categoria === 'receita_boleto' && !t.real.partes?.length);
    if (boletos.length) out.push({ g: 2, texto: `${quantos(boletos.length, 'boleto recebido', 'boletos recebidos')} (${rs(boletos.reduce((s, t) => s + t.banco.valor, 0))}) para dividir entre os clientes.`, ...ir('extrato', { cat: 'receita_boleto' }) });
    const abertos = (d.por_cliente?.linhas || []).filter((l) => l.total_aberto > 0).sort((a, b) => b.total_aberto - a.total_aberto);
    if (abertos.length) out.push({ g: 2, texto: `${quantos(abertos.length, 'cliente', 'clientes')} com mensalidade em aberto, ${rs(abertos.reduce((s, l) => s + l.total_aberto, 0))} no total: ${abertos.slice(0, 3).map((l) => l.cliente_nome).join(', ')}${abertos.length > 3 ? '…' : '.'}`, ...ir('clientes_mes', { chip: 'aberto' }) });
    const fx = d.fixos?.length ? X().analisarFixos(d.fixos, lista, mes, d.cartao?.itens || []) : null;
    const fxFalta = (fx?.fixos || []).filter((f) => !f.achado && f.vence <= hoje);
    if (fxFalta.length) out.push({ g: 1, texto: `${quantos(fxFalta.length, 'gasto fixo venceu', 'gastos fixos venceram')} e não apareceu no extrato: ${fxFalta.slice(0, 3).map((f) => f.nome).join(', ')}${fxFalta.length > 3 ? '…' : '.'}`, ...ir('fixos') });
    if (!d.fixos?.length) out.push({ g: 1, texto: 'Os gastos fixos ainda não foram cadastrados (programas, assinaturas, aluguel): sem eles a projeção é só média.', ...ir('fixos') });
    const soltos = d.cartao?.pagamentos_sem_fatura?.length || 0;
    if (soltos) out.push({ g: 1, texto: `${quantos(soltos, 'pagamento de cartão', 'pagamentos de cartão')} no extrato sem saber de qual fatura (e o que tinha dentro dela).`, ...ir('cartao') });
    const semCat = (d.cartao?.itens || []).filter((i) => i.categoria === 'a_classificar').length;
    if (semCat) out.push({ g: 1, texto: `${quantos(semCat, 'item do cartão', 'itens do cartão')} sem categoria.`, ...ir('cartao') });
    // A saída que mais cresceu no último mês fechado contra o anterior.
    const meses = (d.meses || []).filter((m) => m < mes);
    if (meses.length >= 2) {
      const [a, b] = meses.slice(-2).map((m) => X().resumo(lista, { mes: m }).categorias);
      const antes = new Map(a.map((c) => [c.categoria, -c.total]));
      const subiu = b.filter((c) => c.total < 0 && c.categoria !== 'cartao_agencia').map((c) => ({ ...c, de: antes.get(c.categoria) || 0, para: -c.total }))
        .filter((c) => c.para - c.de > 300 && c.para > c.de * 1.25).sort((x, y) => (y.para - y.de) - (x.para - x.de))[0];
      if (subiu) out.push({ g: 1, texto: `${subiu.nome} subiu de ${rs(subiu.de)} para ${rs(subiu.para)} em ${MESES[Number(meses[meses.length - 1].slice(5)) - 1]}.`, ...ir('extrato', { cat: subiu.categoria, mes: meses[meses.length - 1] }) });
    }
    return out.sort((x, y) => y.g - x.g);
  }
  const ATALHOS = [['extrato', 'Extrato e conciliação', 'conferir e dividir'], ['clientes_mes', 'Clientes mês a mês', 'quem pagou e quem deve'], ['cartao', 'Cartão de crédito', 'cada item da fatura'],
    ['fixos', 'Gastos fixos', 'o que sai todo mês'], ['projecao', 'Relatórios e projeção', 'e se…']];
  function vorcaro(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.vorcaro, mes = (d.hoje || '').slice(0, 7), nomeDoMes = MESES[Number(mes.slice(5)) - 1] || '';
    const achados = analise(d);
    const r = X().resumo(d.transacoes || [], { mes });
    const propostas = d.vorcaro?.propostas || [], pend = propostas.filter((p) => p.estado === 'pendente');
    const graves = achados.filter((a) => a.g >= 2).length;
    const partes = [topo('Vorcaro · Tesouraria', `<button type="button" class="fv2-btn p" data-fx="mao-abrir">Lançar à mão</button>`)];
    const frase = !(d.transacoes || []).length ? 'Ainda não tenho o extrato da conta. Importe o CSV do Banco do Brasil no Extrato que eu passo a cuidar do setor: o que entrou, o que saiu, quem está devendo e como fica o caixa.'
      : `${achados.length ? `Olhei o financeiro inteiro: <b>${quantos(achados.length, 'coisa pede', 'coisas pedem')} atenção</b>${graves ? `, ${quantos(graves, 'mais séria', 'mais sérias')}` : ''}.` : 'Olhei o financeiro inteiro e está tudo em ordem.'} Em ${esc(nomeDoMes)} entrou ${esc(rs(r.entradas))} e saiu ${esc(rs(r.saidas + r.cartao_e_transferencias))}.`;
    partes.push(fala(frase));
    const saldo = d.projecao?.base?.saldo_hoje || 0;
    partes.push(kpis([
      { rotulo: 'Caixa hoje', valor: mil(saldo), tom: saldo < 0 ? 'ruim' : '' },
      { rotulo: `Resultado de ${nomeDoMes}`, valor: mil(r.resultado), tom: r.resultado < 0 ? 'ruim' : 'bom' },
      { rotulo: 'Pede decisão', valor: n0(achados.length), tom: achados.length ? '' : 'bom' },
    ]));
    if (u.mao) partes.push(maoForm(d));
    const lista = achados.map((a) => `<div class="fx-achado g${a.g}"><span class="fx-sinal" aria-hidden="true"></span><p>${esc(a.texto)}</p>${a.aba ? `<button type="button" class="fv2-btn s" data-fx="ir-aba" data-valor="${a.aba}" data-chip="${esc(a.chip || '')}" data-cat="${esc(a.cat || '')}" data-mes="${esc(a.mes || '')}">Resolver</button>` : a.ancora ? '<span class="fv2-pill b">aqui embaixo</span>' : ''}</div>`).join('');
    const whats = pend.length ? pend.map((p) => propostaHtml(d, p)).join('')
      : '<p class="fv2-sub">Nada esperando. Quando o grupo <b>Vybe Financeiro</b> estiver ligado ao bot, cada print, áudio ou mensagem do que entrou e saiu chega aqui já com a minha sugestão; vocês só lançam, juntam com o extrato ou descartam.</p>';
    const decididas = propostas.filter((p) => p.estado !== 'pendente').slice(-8).reverse();
    const decididasHtml = decididas.length ? `<details class="fx-det"><summary>Decididas (${decididas.length})</summary>${decididas.map((p) => `<div class="fx-mini"><span>${esc(dataCurta(p.data))} · ${esc(p.texto || p.quem || 'sem texto')}</span><span>${pill({ lancada: 'lançada', juntada: 'juntada ao extrato', descartada: 'descartada' }[p.estado], p.estado === 'descartada' ? 'n' : 'g')} <b>${esc(rs(p.tipo === 'entrada' ? p.valor : -p.valor))}</b></span></div>`).join('')}</details>` : '';
    const atalhos = ATALHOS.map(([a, nome, sub]) => `<button type="button" class="fx-cat" data-fx="ir-aba" data-valor="${a}"><span>${esc(nome)}<small>${esc(sub)}</small></span><b>›</b></button>`).join('');
    partes.push(`<div class="fx-duas"><div class="fx-col">${card('O que eu vi', lista || vazio('Nada pedindo atenção agora.'), 'do mais sério ao mais leve')}${card('Chegou pelo WhatsApp', whats + decididasHtml, 'grupo Vybe Financeiro')}</div>
      <div class="fx-col fx-lado">${card('Onde mexer', atalhos)}${card('Como eu trabalho', '<p class="fv2-sub">Leio o extrato do banco e o que vocês mandam no grupo, sugiro para onde foi cada coisa e aviso o que está fora do lugar. Quem decide são os quatro donos: nada é lançado sem um de vocês confirmar. Dinheiro é só de vocês; nada disso vai para outro grupo.</p>')}</div></div>`);
    return casca(partes, 'vorcaro');
  }
  function propostaHtml(d, p) {
    const sinal = p.tipo === 'entrada' ? 1 : -1;
    const cands = (p.candidatos || []).map((c) => `<button type="button" class="fv2-btn s" data-fx="proposta-juntar" data-valor="${esc(p.id)}" data-transacao="${esc(c.id)}" title="${esc(c.historico)}">Juntar com ${esc(dataCurta(c.data))} · ${esc(c.historico.slice(0, 28))}</button>`).join('');
    return `<div class="fx-proposta" data-fx-proposta="${esc(p.id)}"><p class="fx-comobanco"><small>${esc(p.autor || 'Grupo')} · ${esc(ANEXO[p.anexo] || 'mensagem')} · ${esc(dataCurta(p.recebido_em))}</small>${esc(p.texto || '(sem texto)')}</p>
      <div class="fx-grade">
        ${campo('Tipo', `<select name="tipo" class="fx-sel"><option value="saida"${p.tipo !== 'entrada' ? ' selected' : ''}>saiu</option><option value="entrada"${p.tipo === 'entrada' ? ' selected' : ''}>entrou</option></select>`)}
        ${campo('Valor', `<input name="valor" class="fx-in fx-num" inputmode="decimal" value="${esc(String(p.valor).replace('.', ','))}">`)}
        ${campo('Dia', `<input name="data" type="date" class="fx-in" value="${esc(p.data)}">`)}
        ${campo('Para onde foi', `<select name="categoria" class="fx-sel">${opcoesCat(d, p.categoria)}</select>`)}
        ${campo('Cliente', `<select name="cliente_id" class="fx-sel">${opcoesCliente(d, p.cliente_id)}</select>`)}
        ${campo('Quem', `<input name="quem" class="fx-in" value="${esc(p.quem)}">`)}
      </div>
      <div class="fx-linha-acoes"><b class="fx-valor ${sinal > 0 ? 'e' : 's'}">${esc(rs(sinal * p.valor))}</b>${cands}
        <button type="button" class="fv2-btn s" data-fx="proposta-lancar" data-valor="${esc(p.id)}" title="Entra como lançamento à parte (dinheiro que não passou pela conta)">${cands ? 'Lançar à parte' : 'Lançar'}</button>
        <button type="button" class="fv2-btn s fv2-perigo" data-fx="proposta-descartar" data-valor="${esc(p.id)}">Descartar</button></div>
      ${cands ? '<p class="fv2-sub">Parece já estar no extrato do banco: juntar põe esta classificação no lançamento do banco, sem contar duas vezes.</p>' : ''}</div>`;
  }
  function maoForm(d) {
    return card('Lançar à mão', `<p class="fv2-sub">Para o que não passou pela conta do banco (dinheiro vivo, maquininha, outra conta). O que passou pela conta vem pelo extrato.</p>
      <div class="fx-grade" data-fx-form="mao">
        ${campo('Tipo', '<select name="tipo" class="fx-sel"><option value="saida">saiu</option><option value="entrada">entrou</option></select>')}
        ${campo('Valor', '<input name="valor" class="fx-in fx-num" inputmode="decimal">')}
        ${campo('Dia', `<input name="data" type="date" class="fx-in" value="${esc(d.hoje || '')}">`)}
        ${campo('Para onde foi', `<select name="categoria" class="fx-sel">${opcoesCat(d, 'a_classificar')}</select>`)}
        ${campo('Cliente', `<select name="cliente_id" class="fx-sel">${opcoesCliente(d, '')}</select>`)}
        ${campo('Quem', '<input name="quem" class="fx-in">')}
        ${campo('Situação', `<select name="status" class="fx-sel">${['pago', 'nao_pago', 'em_aberto'].map((s) => `<option value="${s}">${STATUS_NOME[s]}</option>`).join('')}</select>`)}
        ${campo('O que foi', '<input name="texto" class="fx-in">', 'largo')}
      </div><div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn p" data-fx="mao-salvar">Lançar</button><button type="button" class="fv2-btn s" data-fx="mao-abrir">Cancelar</button></div>`);
  }

  function casca(partes, tela) { return `<div class="fv2 fx" data-tela="fx-${tela}"><div class="fv2-in">${partes.join('')}</div></div>`; }

  // =====================================================================================================
  // Interação
  // =====================================================================================================
  const dadosAtuais = () => anfitriao.d || {};
  function valoresDe(el) {
    const v = {};
    for (const c of el.querySelectorAll('input[name], select[name], textarea[name]')) if (!c.closest('[data-parte]')) v[c.name] = c.type === 'checkbox' ? c.checked : c.value;
    return v;
  }
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
  async function aoClicar(ev) {
    const b = ev.target.closest?.('[data-fx]'); if (!b || !b.closest('.fx')) return;
    const acao = b.dataset.fx, valor = b.dataset.valor ?? '', alvo = b.dataset.alvo || '', d = dadosAtuais();
    const ue = ui.extrato;
    switch (acao) {
      case 'ir': { const el = document.querySelector(`.vv-trilho [data-visao-setor="${valor}"], .vv-trilho [data-trilho="${valor}"]`); if (el) el.click(); return; }
      case 'mes': if (valor) { ui[alvo].mes = valor; if (alvo === 'cartao') ui.cartao.fatura = valor; ui[alvo].aberta = ''; } return repintar();
      case 'chip': ui[alvo].chip = valor; ui[alvo].aberta = ''; if (alvo === 'extrato') ue.mostrar = 60; return repintar();
      case 'mais': ue.mostrar += 100; return repintar();
      case 'cat': ue.cat = ue.cat === valor ? '' : valor; ue.chip = 'todos'; return repintar();
      case 'abrir': ui[alvo].aberta = ui[alvo].aberta === valor ? '' : valor; if (alvo === 'extrato') ue.regra = ''; return repintar();
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
      case 'conferir': { const t = (d.transacoes || []).find((x) => x.id === valor); if (!t) return; await gravar({ acao: 'editar', id: valor, mudanca: { conferido: !t.real.conferido } }); return; }
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
        const r = await gravar({ acao: 'editar', id: valor, mudanca });
        if (r) { delete ue.partes[valor]; const prox = proximoAConferir(d, valor); ue.aberta = prox || ''; repintar(); }
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
      case 'item-editar': ui.cartao.editando = valor; ui.cartao.novo = false; return repintar();
      case 'item-fechar': ui.cartao.editando = ''; ui.cartao.novo = false; return repintar();
      case 'item-salvar': {
        const f = b.closest('.fv2-card')?.querySelector('[data-fx-form="item"]'); if (!f) return;
        const v = valoresDe(f);
        const r = await gravar({ acao: 'cartao_salvar', item: { ...v, id: f.dataset.id || '', valor: numero(v.valor), cliente_nome: nomeCliente(d, v.cliente_id) } }, 'Item salvo.');
        if (r) { ui.cartao.editando = ''; ui.cartao.novo = false; ui.cartao.fatura = r.item.fatura; repintar(); }
        return;
      }
      case 'item-tirar': { const r = await gravar({ acao: 'cartao_remover', id: valor }); if (r) { ui.cartao.editando = ''; repintar(); } return; }
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
        let ok = 0;
        for (const it of itens) { try { await post({ acao: 'cartao_salvar', item: { ...it, cartao: cartaoNome, status: 'em_aberto' } }); ok++; } catch (e) { avisar(e.message); break; } }
        avisar(`${ok} itens lançados na fatura de ${nomeMes(fatura)}.`, 'success');
        ui.cartao.colar = false; ui.cartao.fatura = fatura; await anfitriao.recarregar?.(); return;
      }
      // Fixos
      case 'fixo-novo': ui.fixos.novo = !ui.fixos.novo; ui.fixos.editando = ''; ui.fixos.rascunho = null; return repintar();
      case 'fixo-editar': ui.fixos.editando = valor; ui.fixos.novo = false; return repintar();
      case 'fixo-fechar': ui.fixos.editando = ''; ui.fixos.novo = false; ui.fixos.rascunho = null; return repintar();
      case 'fixo-provavel': {
        const p = fixosProvaveis(d.transacoes || [], d.fixos || [])[Number(valor)]; if (!p) return;
        ui.fixos.rascunho = { nome: p.nome, valor: p.valor, dia: p.dia, categoria: ['ferramentas', 'estrutura', 'emprestimo', 'impostos', 'tarifa_bancaria'].includes(p.categoria) ? p.categoria : 'ferramentas', contem: p.nome };
        ui.fixos.novo = true; ui.fixos.editando = ''; return repintar();
      }
      case 'fixo-salvar': {
        const f = b.closest('.fv2-card')?.querySelector('[data-fx-form="fixo"]'); if (!f) return;
        const v = valoresDe(f);
        const r = await gravar({ acao: 'fixo_salvar', fixo: { ...v, id: f.dataset.id || '', valor: numero(v.valor), dia: Number(v.dia), ativo: Boolean(v.ativo) } }, 'Gasto fixo salvo.');
        if (r) { ui.fixos.editando = ''; ui.fixos.novo = false; ui.fixos.rascunho = null; repintar(); }
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
      case 'cenario-salvar': {
        const nome = ui.projecao.nome.trim(); if (!nome) return avisar('Dê um nome ao cenário.');
        const c = cenarioAtual(d);
        await gravar({ acao: 'cenario_salvar', cenario: { nome, ...c, economias: c.economias, _fixos: undefined } }, 'Cenário guardado.');
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
        const f = b.closest('.fv2-card')?.querySelector('[data-fx-form="mao"]'); if (!f) return;
        const v = valoresDe(f);
        const r = await gravar({ acao: 'lancar_mao', lancamento: { ...v, valor: numero(v.valor), cliente_nome: nomeCliente(d, v.cliente_id) } }, 'Lançado.');
        if (r) { ui.vorcaro.mao = false; repintar(); }
        return;
      }
      case 'proposta-lancar': case 'proposta-juntar': case 'proposta-descartar': {
        const box = b.closest('[data-fx-proposta]'); if (!box) return;
        const v = valoresDe(box);
        const mudanca = { tipo: v.tipo, valor: numero(v.valor), data: v.data, categoria: v.categoria, cliente_id: v.cliente_id, cliente_nome: nomeCliente(d, v.cliente_id), quem: v.quem };
        b.disabled = true;
        const r = await gravar({ acao: acao.replace('-', '_'), id: valor, mudanca, transacao_id: b.dataset.transacao || '' },
          { 'proposta-lancar': 'Lançado no extrato.', 'proposta-juntar': 'Juntado ao lançamento do banco.', 'proposta-descartar': 'Descartado.' }[acao]);
        if (!r) b.disabled = false;
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
