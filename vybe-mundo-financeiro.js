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
    extrato: { mes: '', chip: 'conferir', cat: '', lado: '', aberta: '', mostrar: 60, partes: {}, previa: null, csv: '', nomeArquivo: '', lendo: false, regra: '' },
    clientes_mes: { chip: 'todos', aberta: '' },
    cartao: { fatura: '', novo: false, colar: false, editando: '', chip: 'todos', aberta: '', inteira: false },
    fixos: { mes: '', novo: false, editando: '' },
    vorcaro: { mao: false, frente: '', baixo: '' },
    vales: { aberta: '', chip: 'todos', ajuste: '' },
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
  // O molde V2 das telas de Finanças (pecasFin, mais abaixo).
  const M = () => pecasFin;

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
  // Para quem foi (14/11/2026): a pessoa do time, sócio incluído (Pix para Lusolimar → Paulo).
  const opcoesPessoa = (d, sel) => `<option value="">ninguém do time</option>${(d.pessoas || []).map((p) => `<option value="${esc(p.id)}"${String(p.id) === String(sel) ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}`;
  const nomePessoa = (d, id) => (d.pessoas || []).find((p) => String(p.id) === String(id))?.nome || '';
  // Ligar a um gasto fixo: o lançamento conta como o pagamento daquele fixo no mês a que se refere.
  const opcoesFixo = (d, sel) => `<option value="">nenhum</option>${(d.fixos || []).filter((f) => f.ativo !== false || f.id === sel).map((f) => `<option value="${esc(f.id)}"${f.id === sel ? ' selected' : ''}>${esc(f.nome)} · ${esc(rs(f.valor))}</option>`).join('')}`;
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
    const aConferir = doMes.filter((t) => !t.real.conferido).length;
    // Padrão V2 (prancha V2-M-Financas-Extrato): o molde. Um cartão com os lançamentos do mês (Dia, No banco, De verdade,
    // Valor e Conferir), as fichas na cabeça e o "De olho" no pé; "Para onde foi", as regras, as importações e os apagados
    // ficam atrás de botões e abrem embaixo da lista. O laranja só quando há o que conferir ou dividir.
    const arquivo = (cls, rot = 'Importar extrato') => `<label class="${cls} fx-arquivo">${cls.includes('p') ? IC.mais : ''}${rot}<input type="file" accept=".csv,text/csv" data-fx-arquivo hidden></label>`;
    const i = meses.indexOf(u.mes), antes = meses[i - 1] || '', depois = meses[i + 1] || '';
    const contar = (k) => doMes.filter((t) => ({ conferir: !t.real.conferido, entradas: t.banco.valor > 0, saidas: t.banco.valor < 0, abertos: t.real.status !== 'pago', todos: true })[k]).length;
    const sem = doMes.filter((t) => t.real.categoria === 'receita_boleto' && !t.real.partes?.length);
    const ultimoDia = doMes.filter((t) => t.banco.saldo != null).map((t) => t.banco.data).sort().slice(-1)[0];
    const lista = doMes.filter(filtro).slice().reverse();
    const linhas = lista.slice(0, u.mostrar).map((t) => linhaExtrato(d, t)).join(''), resto = lista.length - u.mostrar;
    const fichas = M().fichas([['todos', 'Todos'], ['conferir', 'A conferir', 'a'], ['entradas', 'Entradas'], ['saidas', 'Saídas'], ['abertos', 'Não pago']]
      .map(([k, nome, tom]) => { const n = contar(k); return { nome, n, tom: n ? tom : '', on: u.chip === k && !u.cat, attrs: `data-fx="chip" data-alvo="extrato" data-valor="${k}"` }; })
      .concat([{ nome: u.cat ? nomeCat(d, u.cat) : 'Categoria', on: u.lado === 'para' || Boolean(u.cat), attrs: `data-fx="extrato-lado" data-valor="para" aria-expanded="${u.lado === 'para'}"` }]), 'Filtrar os lançamentos');
    const pe = [resto > 0 ? `<button type="button" class="d3f-mais" data-fx="mais" data-alvo="extrato">+${n0(resto)}</button>` : '',
      u.chip === 'conferir' && lista.length ? `<button type="button" class="fv2-btn s" data-fx="conferir-todos">Conferir os ${n0(Math.min(lista.length, u.mostrar))} sugeridos</button>` : ''].filter(Boolean).join('');
    const COLS = COLS_EXTRATO;
    const corpo = !todas.length ? `<div class="d3m-d-fm-vazio"><p>Sem extrato ainda. Importe o CSV da conta PJ.</p>${arquivo('fv2-btn s d3f-escuro')}</div>`
      : (linhas || `<p class="d3m-d-fm-vazio">${u.chip === 'conferir' ? 'Tudo conferido neste mês.' : 'Nada com esse filtro.'}</p>`) + (pe ? `<div class="d3m-d-fm-pe">${pe}</div>` : '');
    const ultImp = (d.importacoes || []).slice(-1)[0];
    const olho = r ? M().olho([[esc(comSinal(r.entradas)), 'entrou', 'g'], [esc(comSinal(-r.saidas)), 'saiu'], r.cartao_e_transferencias ? [esc(mil(r.cartao_e_transferencias)), '<button type="button" class="d3m-d-fm-elo" data-fx="ir-aba" data-valor="cartao">no cartão</button>'] : null,
      r.saldo_final != null ? [esc(mil(r.saldo_final)), ultimoDia ? `saldo em ${dataCurta(ultimoDia)}` : 'saldo', Number(r.saldo_final) < 0 ? 'r' : ''] : null,
      ultImp ? [n0(ultImp.novas), `<button type="button" class="d3m-d-fm-elo" data-fx="extrato-lado" data-valor="importacoes" aria-expanded="${u.lado === 'importacoes'}">importados em ${esc(dataCurta(ultImp.em))}</button>`] : null,
      (d.apagados || []).length ? [n0(d.total_apagados || d.apagados.length), `<button type="button" class="d3m-d-fm-elo" data-fx="extrato-lado" data-valor="apagados" aria-expanded="${u.lado === 'apagados'}">apagados</button>`] : null]) : '';
    const principal = M().folha({ titulo: `Lançamentos de ${soMes(u.mes) || 'agora'}`, sub: 'Banco do Brasil, conta PJ', dir: todas.length ? fichas : '', cab: todas.length ? M().cab(COLS) : '', corpo, olho, rotulo: 'lancamentos', cls: 'fx-lancs' });
    // O que mora atrás dos botões: um painel por vez, embaixo da lista, com o fechar no alto.
    const PAINEL = { para: ['Para onde foi', () => (r ? porCategoriaHtml(d, r) : '') + `<div class="d3m-d-fm-busca"><label class="fv2-sr" for="fx-busca-extrato">Buscar no extrato</label><input class="fv2-busca fx-busca" id="fx-busca-extrato" type="search" data-vc-busca="fx_extrato" placeholder="Buscar no extrato" title="Buscar no extrato" value="${esc(ctx.filtro?.fx_extrato || '')}">${u.cat ? `<button type="button" class="fv2-btn s" data-fx="cat" data-valor="${esc(u.cat)}">Tirar a categoria</button>` : ''}</div>`],
      regras: ['Regras', () => regrasHtml(d)], importacoes: ['Importações', () => importacoesHtml(d) || '<p class="fv2-sub">Nenhuma importação ainda.</p>'], apagados: ['Apagados', () => lixeiraHtml(d) || '<p class="fv2-sub">Nada apagado.</p>'] };
    const painel = PAINEL[u.lado] ? M().folha({ titulo: PAINEL[u.lado][0], dir: `<button type="button" class="d3m-d-fm-elo" data-fx="extrato-lado" data-valor="${u.lado}">fechar</button>`, corpo: `<div class="d3m-d-fm-painel">${PAINEL[u.lado][1]()}</div>`, cls: 'd3m-d-fm-curta d3m-d-fm-segundo', rotulo: u.lado }) : '';
    const laranja = !todas.length ? '' : aConferir ? M().laranja({ rot: 'já sugeri o destino', num: n0(aConferir), frase: aConferir === 1 ? 'lançamento para conferir' : 'lançamentos para conferir',
      apoio: sem.length ? `E ${quantos(sem.length, 'boleto', 'boletos')} de ${esc(rs(sem.reduce((s, t) => s + t.banco.valor, 0)))} para dividir entre clientes.` : 'A categoria sugerida já está na linha; abra para corrigir.',
      bts: [[aConferir === 1 ? 'Ver o lançamento' : `Ver os ${n0(aConferir)}`, 'data-fx="chip" data-alvo="extrato" data-valor="conferir"'], sem.length ? ['Dividir', 'data-fx="cat" data-valor="receita_boleto"'] : null] })
      : sem.length ? M().laranja({ rot: 'boleto para dividir', num: n0(sem.length), frase: sem.length === 1 ? 'boleto para dividir entre clientes' : 'boletos para dividir entre clientes', apoio: `${esc(rs(sem.reduce((s, t) => s + t.banco.valor, 0)))} no total.`, bts: [['Dividir', 'data-fx="cat" data-valor="receita_boleto"']] }) : '';
    const corpoTela = (u.previa ? M().folha({ titulo: `Prévia: ${ui.extrato.nomeArquivo || 'extrato'}`, dir: 'nada gravado ainda', corpo: `<div class="d3m-d-fm-painel">${previaHtml(d)}</div>`, cls: 'd3m-d-fm-curta d3m-d-fm-segundo', rotulo: 'previa' }) : '') + principal + painel;
    return M().molde({ tela: 'fx-extrato', aba: 'extrato', titulo: 'Extrato e conciliação', d, repintar,
      sub: `${esc(nomeMes(u.mes) || 'sem extrato')}${doMes.length ? ` · ${quantos(doMes.length, 'lançamento', 'lançamentos')}` : ''}${aConferir ? ` · ${n0(aConferir)} para conferir` : todas.length ? ' · tudo conferido' : ''}`,
      ferr: (meses.length ? M().setas(antes ? `data-fx="mes" data-alvo="extrato" data-valor="${antes}"` : '', depois ? `data-fx="mes" data-alvo="extrato" data-valor="${depois}"` : '') : '')
        + `<button type="button" class="d3m-d-vbtn" data-fx="extrato-lado" data-valor="regras" aria-expanded="${u.lado === 'regras'}">Regras</button>`,
      acao: arquivo('d3m-d-vbtn p'), laranja, corpo: corpoTela });
  }
  // As colunas do Extrato (prancha V2-M-Financas-Extrato): Dia, No banco, De verdade, Valor e o Conferir.
  const COLS_EXTRATO = [[48, 'Dia'], [0, 'No banco'], [300, 'De verdade'], [110, 'Valor', 'r'], [96, '']];
  function linhaExtrato(d, t) {
    const u = ui.extrato, aberta = u.aberta === t.id, entrada = t.banco.valor > 0;
    const cat = t.real.partes?.length ? `dividido em ${t.real.partes.length}` : nomeCat(d, t.real.categoria);
    const quem = t.real.partes?.length ? [...new Set(t.real.partes.map((p) => p.cliente_nome || p.pessoa_nome || p.quem).filter(Boolean))].join(', ') : (t.real.cliente_nome || t.real.pessoa_nome || t.real.quem || '');
    const fixo = t.real.fixo_id ? (d.fixos || []).find((f) => f.id === t.real.fixo_id) : null;
    const semCli = entrada && /receita_cliente|receita_boleto/.test(t.real.categoria) && !quem && !t.real.partes?.length;
    const status = (t.real.status !== 'pago' ? ` <small class="${STATUS_TOM[t.real.status] === 'r' ? 'r' : 'a'}">· ${esc(STATUS_NOME[t.real.status]).toLowerCase()}</small>` : '') + (t.banco.origem ? ` <small>· ${t.banco.origem === 'mao' ? 'à mão' : 'WhatsApp'}</small>` : '');
    const real = `<b class="${t.real.categoria === 'a_classificar' ? 'r' : ''}">${esc(cat)}</b>${quem ? ` <small>· ${esc(quem)}</small>` : semCli ? ' <small class="a">· sem cliente</small>' : ''}${fixo ? ` <small>· fixo ${esc(fixo.nome)}</small>` : ''}${status}`;
    const ok = t.real.conferido ? `<button type="button" class="fx-ok d3m-d-fm-ok" data-fx="conferir" data-valor="${esc(t.id)}" aria-pressed="true" title="${'Conferido' + (t.real.conferido_por ? ' por ' + esc(t.real.conferido_por) : '') + '. Tocar desfaz.'}"><i aria-hidden="true"></i>conferido</button>`
      : `<button type="button" class="fv2-btn s fx-ok" data-fx="conferir" data-valor="${esc(t.id)}" aria-pressed="false" title="Marcar como conferido">Conferir</button>`;
    return `<div class="v2-abre d3m-d-fm-linha fx-lanc${t.real.conferido ? ' ok' : ''}" data-linha="${esc(t.id)}" aria-expanded="${aberta}">${M().tr(COLS_EXTRATO, [dataCurta(t.banco.data),
      `<button type="button" class="d3m-d-fm-nome" data-fx="abrir" data-alvo="extrato" data-valor="${esc(t.id)}" aria-expanded="${aberta}">${esc(t.banco.historico)}</button>`, real,
      `<span class="${entrada ? 'g' : ''}">${esc(comSinal(t.banco.valor))}</span>`, ok])}
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
    const opcoes = (t.sugestao?.opcoes || []).length ? `<span class="fv2-seg" role="group" aria-label="O que foi">${t.sugestao.opcoes.map((c) => `<button type="button" data-fx="escolher-cat" data-id="${esc(t.id)}" data-valor="${c}" aria-pressed="${t.real.categoria === c}">${esc(nomeCat(d, c))}</button>`).join('')}</span>` : '';
    const sug = t.sugestao?.nota ? `<p class="fx-sug">${pill('Sugestão', 'b')}${esc(t.sugestao.nota)}${t.sugestao.regra ? ` · regra ${esc(t.sugestao.regra)}` : ''}</p>${opcoes ? `<div class="fx-linha-acoes"><span class="fv2-sub">O que foi</span>${opcoes}</div>` : ''}` : '';
    const contra = t.banco.contraparte || '';
    return `<div class="fv2-det fx-editor" data-fx-editor="${esc(t.id)}">
      <div class="fx-lados"><p class="fx-comobanco"><small>Como está no banco</small><span>${esc(dataCurta(t.banco.data))} · ${esc(t.banco.historico)}${t.banco.documento ? ` · doc ${esc(t.banco.documento)}` : ''} · <b>${esc(comSinal(t.banco.valor))}</b>${t.banco.saldo != null ? ` · saldo ${esc(rs(t.banco.saldo))}` : ''}</span>
        <span class="fx-origem">${esc(origemDe(t))}</span></p>
      <div class="fx-real-lado"><small>Para onde foi de verdade</small><div class="fx-grade">
        ${campo('Categoria', `<select name="categoria" class="fx-sel">${opcoesCat(d, t.real.categoria, { tipo })}</select>`)}
        ${campo('Cliente', `<select name="cliente_id" class="fx-sel">${opcoesCliente(d, t.real.cliente_id)}</select>`)}
        ${campo(entrada ? 'Recebido de' : 'Pago a', `<input name="quem" class="fx-in" value="${esc(t.real.quem)}" placeholder="${esc(contra || (entrada ? 'quem mandou o dinheiro' : 'posto, gráfica, Adobe'))}">`)}
        ${campo('Como', `<select name="forma" class="fx-sel">${opcoesForma(X().formaDe(t))}</select>`)}
        ${campo('Pessoa do time', `<select name="pessoa_id" class="fx-sel" title="Se foi salário, pró-labore ou vale de alguém da Vybe">${opcoesPessoa(d, t.real.pessoa_id)}</select>`)}
        ${entrada ? '' : campo('Gasto fixo', `<select name="fixo_id" class="fx-sel">${opcoesFixo(d, t.real.fixo_id)}</select>`)}
        ${campo('Referente a', `<input name="competencia" type="month" class="fx-in" value="${esc(t.real.competencia)}">`)}
        ${campo('Observação', `<input name="descricao" class="fx-in" value="${esc(t.real.descricao)}" placeholder="o que foi">`, 'largo')}
        ${t.real.categoria === 'cartao_agencia' || (!entrada && /cart/i.test(t.real.categoria)) ? campo('Fatura quitada', `<select name="fatura" class="fx-sel"><option value="">escolher</option>${faturas.map((f) => `<option value="${esc(f)}"${t.real.fatura === f ? ' selected' : ''}>${esc(f.split('|')[0])} · ${esc(nomeMes(f.split('|')[1]))}</option>`).join('')}</select>`) : ''}
      </div></div></div>
      ${sug}
      ${partes ? `<div class="fx-partes">
        ${partes.map((p, i) => `<div class="fx-parte${entrada ? '' : ' fx-parte-saida'}" data-parte="${i}">
          <input name="p_valor" class="fx-in fx-num" inputmode="decimal" value="${esc(p.valor === '' || p.valor == null ? '' : String(p.valor).replace('.', ','))}" placeholder="valor" aria-label="Valor da parte ${i + 1}">
          ${entrada ? `<select name="p_cliente" class="fx-sel" aria-label="Cliente da parte ${i + 1}">${opcoesCliente(d, p.cliente_id)}</select>` : `<select name="p_categoria" class="fx-sel" aria-label="Categoria da parte ${i + 1}">${opcoesCat(d, p.categoria || t.real.categoria, { tipo })}</select>`}
          ${entrada ? `<input name="p_competencia" type="month" class="fx-in" value="${esc(p.competencia || t.real.competencia)}" aria-label="Mês a que se refere a parte ${i + 1}">`
            : `<select name="p_pessoa" class="fx-sel" aria-label="Para quem na parte ${i + 1}">${opcoesPessoa(d, p.pessoa_id)}</select><input name="p_quem" class="fx-in" value="${esc(p.quem || p.descricao || '')}" placeholder="quem / o quê" aria-label="Quem ou o quê na parte ${i + 1}"><input name="p_competencia" type="month" class="fx-in" value="${esc(p.competencia || t.real.competencia)}" title="Referente a" aria-label="Mês a que se refere a parte ${i + 1}">`}
          <button type="button" class="fv2-btn s fv2-seta" data-fx="parte-tirar" data-id="${esc(t.id)}" data-valor="${i}" aria-label="Tirar parte ${i + 1}">×</button></div>`).join('')}</div>` : ''}
      <div class="fx-linha-acoes fx-fim">${partes ? (falta === 0 ? pill('fechou', 'g') : pill(`${falta > 0 ? 'faltam' : 'passou'} ${rs(Math.abs(falta))}`, 'r')) : ''}
        <span class="fv2-seg" role="group" aria-label="Situação">${['pago', 'nao_pago', 'em_aberto'].map((s) => `<button type="button" data-fx="status" data-valor="${s}" data-id="${esc(t.id)}" aria-pressed="${t.real.status === s}">${STATUS_NOME[s]}</button>`).join('')}</span>
        ${partes ? `<button type="button" class="fv2-btn s" data-fx="parte-mais" data-valor="${esc(t.id)}">+ parte</button>${falta > 0 ? `<button type="button" class="fv2-btn s" data-fx="parte-resto" data-valor="${esc(t.id)}">Resto: ${esc(rs(falta))}</button>` : ''}<button type="button" class="fv2-btn s" data-fx="parte-desfazer" data-valor="${esc(t.id)}">Não dividir</button>`
          : `<button type="button" class="fv2-btn s" data-fx="dividir" data-valor="${esc(t.id)}">${entrada ? 'Dividir entre clientes' : 'Dividir em partes'}</button>`}
        <button type="button" class="fv2-btn s fv2-perigo" data-fx="lanc-apagar" data-valor="${esc(t.id)}">Apagar</button>
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
    const corpo = `${minhas.length ? minhas.map((r) => `<div class="fx-mini"><span><b>“${esc(r.quando?.contem)}”</b> → ${esc(nomeCat(d, r.categoria))}${r.pessoa_nome ? ` · para ${esc(r.pessoa_nome)}` : ''}${r.quem ? ` · ${esc(r.quem)}` : ''}${r.cliente_nome ? ` · ${esc(r.cliente_nome)}` : ''}${r.fixo_id ? ` · fixo ${esc((d.fixos || []).find((f) => f.id === r.fixo_id)?.nome || '')}` : ''}</span><button type="button" class="fv2-link" data-fx="regra-tirar" data-valor="${esc(r.id)}">tirar</button></div>`).join('') : '<p class="fv2-sub">Nenhuma regra sua ainda.</p>'}
      <details class="fx-det"><summary>Prontas · ${n0(prontas.length)}</summary>${prontas.map((r) => `<p class="fv2-sub">“${esc(r.quando.contem || r.quando.comeca)}” → ${esc(nomeCat(d, r.categoria))}${r.revisar ? ' (você confere)' : ''}</p>`).join('')}</details>`;
    return card('Regras', corpo);
  }
  // Apagados (15/11/2026): ficam aqui para voltar com um toque; o do banco não volta sozinho ao reimportar.
  function lixeiraHtml(d) {
    const l = d.apagados || [];
    if (!l.length) return '';
    return card('Apagados', `<details class="fx-det"><summary>${quantos(d.total_apagados || l.length, 'lançamento apagado', 'lançamentos apagados')}</summary>${l.map((a) => `<div class="fx-mini"><span>${esc(dataCurta(a.data))} · ${esc(a.historico)}${a.apagado_por ? ` · apagou ${esc(a.apagado_por)}` : ''}</span><span><b>${esc(comSinal(a.valor))}</b> <button type="button" class="fv2-btn s v2-estado" data-fx="lanc-restaurar" data-valor="${esc(a.id)}">Restaurar</button></span></div>`).join('')}</details>`);
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
    const nAberto = linhas.filter((l) => l.total_aberto > 0).length;
    // Padrão V2 (prancha V2-M-Financas-Clientes-Mes): a matriz cliente × mês num cartão só (os 6 meses mais novos), cada
    // célula na cor da situação, o "De olho" no pé e o laranja só quando alguém deve.
    const seis = meses.slice(-6), ini = meses.length - seis.length;
    const COLS = [[28, ''], [0, 'Cliente e mensalidade'], ...seis.map((m) => [84, mesCurto(m), 'm']), [110, 'Em aberto', 'r']];
    const CEL = { pago: 'pago', parcial: 'parcial', aberto: 'aberto', a_receber: 'a receber', sem: 'sem cobrança', fora: 'antes do extrato' };
    const cel = (m) => `<span class="d3m-d-fm-mes ${esc(m.situacao)}" title="${esc(m.situacao === 'fora' ? `${nomeMes(m.mes)}: antes do extrato importado` : `${nomeMes(m.mes)}: previsto ${rs(m.previsto)}, recebido ${rs(m.recebido)}${m.em_aberto ? `, em aberto ${rs(m.em_aberto)}` : ''}${m.a_receber ? `, a receber ${rs(m.a_receber)}` : ''}`)}">${m.situacao === 'sem' || m.situacao === 'fora' ? '·' : m.situacao === 'pago' ? 'pago' : esc(mil(m.em_aberto || m.a_receber).replace('R$ ', ''))}<span class="fv2-sr"> ${esc(CEL[m.situacao] || m.situacao)}</span></span>`;
    const corpo = !pc2.desde ? `<div class="d3m-d-fm-vazio"><p>Sem extrato, não dá para saber quem pagou.</p><button type="button" class="fv2-btn s" data-fx="ir-aba" data-valor="extrato">Ir ao extrato</button></div>`
      : !linhas.length ? `<div class="d3m-d-fm-vazio"><p>Nenhuma entrada ligada a cliente ainda.</p><button type="button" class="fv2-btn s" data-fx="ir-aba" data-valor="extrato" data-chip="entradas">Ligar no extrato</button></div>`
        : vis.map((l) => {
          const aberta = u.aberta === l.cliente_id;
          return `<div class="v2-abre d3m-d-fm-linha d3m-d-fm-alta" data-linha="${esc(l.cliente_id)}" aria-expanded="${aberta}">${M().tr(COLS, [M().av(l.cliente_nome),
            `<button type="button" class="d3m-d-fm-nome" data-fx="abrir" data-alvo="clientes_mes" data-valor="${esc(l.cliente_id)}" aria-expanded="${aberta}"><b>${esc(l.cliente_nome)}</b><small>${l.mensalidade ? `${esc(rs(l.mensalidade))} por mês` : 'sem mensalidade'}</small></button>`,
            ...l.meses.slice(ini).map(cel), l.total_aberto ? `<b class="r">${esc(rs(l.total_aberto))}</b>` : '<span class="q">em dia</span>'])}
            <div class="v2-mais"><div>${aberta ? detalheCliente(d, l) : ''}</div></div></div>`;
        }).join('') || '<p class="d3m-d-fm-vazio">Ninguém com esse filtro.</p>';
    const fichas = M().fichas([['todos', 'Todos', linhas.length], ['aberto', 'Em aberto', nAberto, 'r'], ['pagos', 'Em dia', linhas.length - nAberto]]
      .map(([k, nome, n, tom]) => ({ nome, n, tom: n ? tom : '', on: u.chip === k, attrs: `data-fx="chip" data-alvo="clientes_mes" data-valor="${k}"` })), 'Filtrar os clientes')
      + '<span class="d3m-d-fm-leg" aria-hidden="true"><span><i class="pago"></i>pago</span><span><i class="aberto"></i>em aberto</span><span><i class="a_receber"></i>a receber</span></span>';
    const semCobranca = (d.clientes || []).filter((c) => c.ativo !== false && !c.mensalidade).length;
    const olho = pc2.desde ? M().olho([[esc(mil(recebido)), atual ? `recebido em ${soMes(atual)}` : 'recebido no mês', recebido ? 'g' : ''], [esc(mil(aReceber)), 'a receber no mês'],
      [`${n0(pagos)} de ${n0(cobrados)}`, atual ? `já pagou ${soMes(atual)}` : 'já pagaram no mês'], semCobranca ? [n0(semCobranca), semCobranca === 1 ? 'cliente ativo sem cobrança' : 'clientes ativos sem cobrança', 'a'] : null]) : '';
    const laranja = aberto > 0 ? M().laranja({ rot: 'quem deve', num: n0(nAberto), frase: nAberto === 1 ? 'cliente com mês em aberto' : 'clientes com mês em aberto',
      apoio: `${esc(rs(aberto))} no total.${maior?.total_aberto ? ` O maior é ${esc(maior.cliente_nome)}, com ${esc(rs(maior.total_aberto))}.` : ''}`,
      bts: [['Ver quem deve', 'data-fx="chip" data-alvo="clientes_mes" data-valor="aberto"'], maior?.total_aberto ? [`Abrir ${maior.cliente_nome}`, `data-fx="abrir" data-alvo="clientes_mes" data-valor="${esc(maior.cliente_id)}"`] : null] }) : '';
    return M().molde({ tela: 'fx-clientes_mes', aba: 'clientes_mes', titulo: 'Clientes mês a mês', d, repintar,
      sub: `${seis.length ? `${esc(soMes(seis[0]))} a ${esc(nomeMes(atual))}` : 'sem extrato'}${aberto ? ` · ${esc(mil(aberto))} em aberto` : linhas.length ? ' · todos em dia' : ''}`, laranja,
      corpo: M().folha({ titulo: 'Pago e em aberto', sub: 'pelo mês de referência', dir: linhas.length ? fichas : '', cab: linhas.length ? M().cab(COLS) : '', corpo, olho, rotulo: 'matriz', cls: 'd3m-d-fm-matriz' }) });
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
    // Vencimento da fatura (dia por cartão, chave financeiro_cartoes, 14/11/2026): a fatura do mês vence no dia do cartão.
    const vence = doMes.map((f) => f.vence).filter(Boolean).sort()[0] || '';
    const venc = d.cartao?.vencimentos || {}, nomesCartao = [...new Set([...cartoes, ...Object.keys(venc), 'Cartão da agência'])];
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
      { rotulo: 'Falta pagar', valor: mil(falta), tom: falta > 0 ? '' : 'q', sub: `${pill(...SITUACAO_FATURA[situacao])}${vence ? ` <span${falta > 0 && vence < (d.hoje || '') ? ' class="d3f-r"' : ''}>vence ${esc(dataCurta(vence))}</span>` : ' <button type="button" class="fv2-link" data-fx="foco" data-valor="vencimento">vencimento?</button>'}` },
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
      card('Vencimento', nomesCartao.map((n) => `<div class="fx-mini fx-venc"><span>${esc(n)}</span><label class="fx-venc-dia">dia <input class="fx-in" type="number" min="1" max="31" step="1" inputmode="numeric" value="${esc(venc[n] ?? '')}" aria-label="Dia do vencimento da fatura do ${esc(n)}"></label><button type="button" class="fv2-btn s v2-estado" data-fx="venc-salvar" data-valor="${esc(n)}">Salvar</button></div>`).join(''), vence ? `esta vence ${esc(dataCurta(vence))}` : 'dia do mês', 'fx-vencimento', 'vencimento'),
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
      'Guardar o cenário', 'data-fx="cenario-focar"'));
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
  // As telas de Finanças, na ordem do menu (o título do Vorcaro e a coluna de consulta levam a cada uma).
  const TELAS_FIN = [['financas', 'Por cliente'], ['recebimentos', 'Recebimentos'], ['contas', 'Contas a pagar'], ['inadimplencia', 'Inadimplência'], ['extrato', 'Extrato e conciliação'],
    ['clientes_mes', 'Clientes mês a mês'], ['cartao', 'Cartão de crédito'], ['fixos', 'Gastos fixos'], ['vales', 'Pessoas e vales'], ['projecao', 'Relatórios e projeção']];
  const iniciais = (nome) => String(nome || '?').trim().slice(0, 2).toUpperCase();
  const ICV = {
    seta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>', baixo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    busca: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>', ajuda: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.300c-.7.4-1 .9-1 1.7M12 17h.01"/></svg>',
    cifrao: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M16 7h-5.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H8"/></svg>', alta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l6-6 4 4 6-8"/><path d="M14 7h6v6"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6M12 17h.01"/></svg>', relogio: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 9v3l2 1"/></svg>',
  };
  // =====================================================================================================
  // MOLDE V2 DAS TELAS DE FINANÇAS (prancha V2-M-Financas-Modelo, 16/11/2026). O esqueleto comum de todas as telas do
  // setor, menos o Vorcaro: o topo no vidro (título que troca de tela, "só donos" · o mês · a frase que resume, busca,
  // "Como funciona" e a ação da tela), à esquerda o cartão principal (lista, matriz ou gráfico, com a faixa "De olho" no
  // pé) e, quando a tela pede, os números em cima e um segundo cartão embaixo; à direita o laranja do Vorcaro só quando
  // há algo a decidir e a coluna de Finanças com o que espera em cada tela. Também usado por vybe-mundo-financas.js
  // (Recebimentos, Contas a pagar, Inadimplência) e vybe-mundo-comercial.js (Por cliente), por window.VybeFinanceiro.molde.
  // O desenho mora em padrao-v2/zm-d-financas.css (peças .d3m-d-fm-*).
  // =====================================================================================================
  // O que espera em cada tela: a última contagem que se conhece (as telas da janela do Comercial não têm o extrato).
  const contagemFin = {};
  function contarFin(d) {
    if (!d || !Array.isArray(d.transacoes)) return contagemFin;
    const lista = d.transacoes, mes = (d.hoje || '').slice(0, 7);
    const fxAn = d.fixos?.length ? X().analisarFixos(d.fixos, lista, mes, d.cartao?.itens || []) : null;
    Object.assign(contagemFin, { vorcaro: analise(d).length, extrato: lista.filter((t) => !t.real.conferido).length, clientes_mes: (d.por_cliente?.linhas || []).filter((l) => l.total_aberto > 0).length,
      cartao: (d.cartao?.itens || []).filter((i) => i.categoria === 'a_classificar').length + (d.cartao?.pagamentos_sem_fatura?.length || 0),
      fixos: (fxAn?.fixos || []).filter((f) => !f.achado && f.vence <= (d.hoje || '')).length });
    return contagemFin;
  }
  const TELAS_MOLDE = [['vorcaro', 'Vorcaro · Tesouraria'], ...TELAS_FIN];
  // A coluna de Finanças: cada tela com o que espera nela; a de agora em branco.
  const navFin = (tela) => `<nav class="d3m-cons d3m-d-fm-nav" aria-label="Finanças"><div class="d3m-cons-cab"><b>Finanças</b><span>o que espera em cada tela</span></div>${TELAS_MOLDE.map(([a, n]) => `<button type="button" class="d3m-vlin" data-fx="ir-aba" data-valor="${a}"${a === tela ? ' aria-current="page"' : ''}><span><b>${esc(n)}</b></span>${contagemFin[a] ? `<b class="d3m-vn">${n0(contagemFin[a])}</b>` : ''}</button>`).join('')}</nav>`;
  // O laranja do Vorcaro: quem fala e sobre o quê, o número grande, a frase, o apoio e até dois botões ([texto, attrs]).
  function laranjaFin({ rot = '', num = '', frase = '', apoio = '', bts = [] } = {}) {
    const b = bts.filter(Boolean).map(([t, attrs], i) => `<button type="button" class="d3m-btn l${i ? ' s' : ''}" ${attrs}>${esc(t)}</button>`).join('');
    return `<section class="d3m-laranja d3m-d-fm-lar" data-fx-card="decisao" aria-label="O que pede decisão"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">V</span>Vorcaro${rot ? ' · ' + esc(rot) : ''}</span>
      <div class="d3m-lar-txt">${num !== '' ? `<b class="d3m-lar-num">${esc(num)}</b>` : ''}<span class="d3-acao-frase">${frase}</span>${apoio ? `<small>${apoio}</small>` : ''}${b ? `<div class="d3m-lar-bts">${b}</div>` : ''}</div></section>`;
  }
  // As fichas da cabeça do cartão: { nome, n, tom, on, attrs }.
  const fichasFin = (l, rotulo = 'Filtrar') => `<span class="d3m-d-fm-fichas" role="group" aria-label="${esc(rotulo)}">${l.filter(Boolean).map((f) => `<button type="button" class="d3m-d-fm-ficha" ${f.attrs || ''} aria-pressed="${Boolean(f.on)}">${esc(f.nome)}${f.n != null ? `<span${f.tom ? ` class="${f.tom}"` : ''}>${n0(f.n)}</span>` : ''}</button>`).join('')}</span>`;
  // A faixa "De olho" no pé do cartão: [valor, rótulo, tom].
  const olhoFin = (l) => { const i = l.filter(Boolean); return i.length ? `<div class="d3m-d-fm-olho"><span class="d3m-d-fm-olho-rot">De olho</span>${i.map(([v, r, tom]) => `<span><b${tom ? ` class="${tom}"` : ''}>${v}</b> ${r}</span>`).join('')}</div>` : ''; };
  // Colunas de largura fixa (a flexível é 0): o cabeçalho e as linhas usam a mesma lista.
  const celFin = (w, html = '', cls = '') => `<span class="d3m-d-fm-c${w ? '' : ' f'}${cls ? ' ' + cls : ''}"${w ? ` style="--w:${w}px"` : ''}>${html}</span>`;
  const cabFin = (cols) => `<div class="d3m-d-fm-th" aria-hidden="true">${cols.map(([w, t, cls]) => celFin(w, esc(t || ''), cls)).join('')}</div>`;
  const trFin = (cols, cels, cls = '') => `<div class="d3m-d-fm-tr${cls ? ' ' + cls : ''}">${cols.map(([w, , c], i) => celFin(w, cels[i] ?? '', c)).join('')}</div>`;
  // O quadradinho com as iniciais do cliente, na cor da carteira.
  const avFin = (nome) => { let cart = ''; try { cart = typeof carteiraDoCliente === 'function' ? String(carteiraDoCliente(nome) || '') : ''; } catch { /* sem carteira */ } return `<span class="d3m-d-fm-av" data-carteira="${esc(cart)}" aria-hidden="true">${esc((String(nome || '').trim().split(/\s+/)[0] || '?').slice(0, 2).toUpperCase())}</span>`; };
  // Cartão folha do molde: cabeça de 44 (título · apoio e, à direita, as fichas), as colunas, a lista que rola e o "De olho".
  const folhaFin = ({ titulo, sub = '', dir = '', cab = '', corpo = '', olho = '', cls = '', rotulo = '' }) => `<section class="d3m-d-folha d3m-d-fm-folha${cls ? ' ' + cls : ''}"${rotulo ? ` data-fx-card="${rotulo}"` : ''}><div class="d3m-d-cab d3m-d-fm-cab"><h3>${esc(titulo)}${sub ? ` <small>· ${sub}</small>` : ''}</h3>${dir ? `<span class="d3m-d-fm-dir">${dir}</span>` : ''}</div>${cab}<div class="d3m-d-fm-rolo">${corpo}</div>${olho}</section>`;
  // Número em folha (rótulo e selo em cima; o número de 28, a linha de apoio e o gráfico pequeno embaixo).
  const numFin = ({ rotulo, selo = '', ic = IC.ok, valor, tom = '', sub = '', graf = '', attrs = '' }) => `<${attrs ? `button type="button" ${attrs}` : 'div'} class="d3m-d-folha d3m-d-fx-num"><span class="d3m-d-fx-num-cab"><span>${esc(rotulo)}</span><span class="d3m-d-selo${selo ? ' ' + selo : ''}">${ic}</span></span><span class="d3m-d-fx-num-pe"><span><b class="d3m-d-fx-v${tom ? ' ' + tom : ''}">${valor}</b><small>${sub}</small></span>${graf}</span></${attrs ? 'button' : 'div'}>`;
  // O esqueleto: { tela (data-tela), aba (a da coluna), titulo, sub (depois de "só donos"), ferr, acao, nums, corpo, laranja }.
  // Nas telas sem o extrato (as da janela do Comercial), a contagem vem de uma leitura só de /api/painel?area=financeiro.
  let contagemLendo = false;
  function garantirContagem(repintar) {
    if (Object.keys(contagemFin).length || contagemLendo || typeof fetch !== 'function' || typeof location === 'undefined') return;
    contagemLendo = true;
    fetch('/api/painel?area=financeiro', { credentials: 'same-origin', cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && Array.isArray(d.transacoes)) { contarFin(d); repintar?.(); } }).catch(() => { /* sem contagem */ });
  }
  function molde({ tela, aba = tela, titulo, sub = '', ferr = '', acao = '', nums = '', corpo = '', laranja = '', d = null, repintar = null }) {
    if (d && Array.isArray(d.transacoes)) contarFin(d); else garantirContagem(repintar);
    const pop = TELAS_MOLDE.map(([a, n]) => `<button type="button" data-fx="ir-aba" data-valor="${a}"${a === aba ? ' aria-current="page"' : ''}>${esc(n)}</button>`).join('');
    const topoM = `<div class="d3m-d-topo d3m-d-fx-topo d3m-d-fm-topo"><div class="d3m-d-tit"><details class="d3m-d-troca"><summary aria-label="${esc(titulo)}: ir a outra tela de Finanças"><h1>${esc(titulo)}</h1>${ICV.baixo}</summary>
        <div class="d3m-d-pop"><button type="button" data-fx="ir" data-valor="setor:financas">Visão geral de Finanças</button>${pop}</div></details>
        <span class="d3m-d-sub">${SELO}${sub ? ` · ${sub}` : ''}</span></div>
      <div class="d3m-d-ferr"><button type="button" class="d3m-d-ico" data-fx="buscar" aria-label="Buscar" title="Buscar">${ICV.busca}</button><button type="button" class="d3m-d-ico" data-v2="ajuda" aria-label="Como funciona" title="Como funciona">${ICV.ajuda}</button>${ferr}${acao}</div></div>`;
    return `<div class="fv2 fx d3f d3m-d-fx d3m-d-fm" data-tela="${esc(tela)}">${topoM}<div class="d3m-d-fx-grade d3m-d-fm-grade"><div class="d3m-d-fm-main">${nums ? `<div class="d3m-d-fx-nums">${nums}</div>` : ''}${corpo}</div>
      <aside class="d3m-lado d3m-d-fx-lado d3m-d-fm-lado" aria-label="Consulta">${laranja}${navFin(aba)}</aside></div></div>`;
  }
  // Botões do topo, no vidro: a ação principal em branco e a secundária com borda.
  const acaoFin = (texto, attrs, mais = true) => `<button type="button" class="d3m-d-vbtn p" ${attrs}>${mais ? IC.mais : ''}${esc(texto)}</button>`;
  // As setas do mês (ou do ano), no vidro; sem o atributo, a seta fica desligada.
  const setasFin = (antes, depois, nome = 'mês') => `<span class="d3m-d-fm-setas" role="group" aria-label="Trocar o ${esc(nome)}"><button type="button" class="d3m-d-ico" ${antes || 'disabled'} aria-label="${nome === 'ano' ? 'Ano' : 'Mês'} anterior" title="${nome === 'ano' ? 'Ano' : 'Mês'} anterior">${SETA.esq}</button><button type="button" class="d3m-d-ico" ${depois || 'disabled'} aria-label="Próximo ${esc(nome)}" title="Próximo ${esc(nome)}">${SETA.dir}</button></span>`;
  const segFin = (l, rotulo) => `<span class="d3m-d-seg" role="group" aria-label="${esc(rotulo)}">${l.map(([t, attrs, on]) => `<button type="button" ${attrs} aria-pressed="${Boolean(on)}">${esc(t)}</button>`).join('')}</span>`;
  const pecasFin = Object.freeze({ molde, laranja: laranjaFin, fichas: fichasFin, olho: olhoFin, cab: cabFin, tr: trFin, av: avFin, folha: folhaFin, num: numFin, acao: acaoFin, seg: segFin, setas: setasFin, contar: contarFin, contagem: contagemFin });

  // Direção V2 (prancha V2-M-Financeiro, 16/11/2026): a janela é vidro fumê. Em cima, três números (caixa, resultado do
  // mês e o caixa em 6 meses); embaixo, "Pede decisão" e "Entrou e saiu" em folha, e o cartão laranja, que é o lançamento
  // que chegou pelo WhatsApp (com os campos para corrigir antes de decidir) ou, sem nenhum, o item mais sério do "Pede
  // decisão". A coluna de consulta fica no vidro: cada tela de Finanças com o que espera nela, como o Vorcaro trabalha e
  // o banco. "Decididas" abre no lugar do gráfico e "Lançar à mão" ocupa a coluna da esquerda (o formulário cabe inteiro). O desenho mora em padrao-v2/zm-d-financeiro.css.
  function vorcaro(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.vorcaro, mes = (d.hoje || '').slice(0, 7), nomeDoMes = MESES[Number(mes.slice(5)) - 1] || '';
    const achados = analise(d), lista = d.transacoes || [];
    contarFin(d);
    const r = X().resumo(lista, { mes });
    const propostas = d.vorcaro?.propostas || [], pend = propostas.filter((p) => p.estado === 'pendente');
    const daqui = achados.filter((a) => !a.ancora).length;
    const fxAn = d.fixos?.length ? X().analisarFixos(d.fixos, lista, mes, d.cartao?.itens || []) : null;
    const contagem = { extrato: lista.filter((t) => !t.real.conferido).length, clientes_mes: (d.por_cliente?.linhas || []).filter((l) => l.total_aberto > 0).length,
      cartao: (d.cartao?.itens || []).filter((i) => i.categoria === 'a_classificar').length + (d.cartao?.pagamentos_sem_fatura?.length || 0),
      fixos: (fxAn?.fixos || []).filter((f) => !f.achado && f.vence <= (d.hoje || '')).length };
    // Topo, direto no vidro.
    const topoV2 = `<div class="d3m-d-topo d3m-d-fx-topo"><div class="d3m-d-tit"><details class="d3m-d-troca"><summary aria-label="Vorcaro · Tesouraria: ir a outra tela de Finanças"><h1>Vorcaro · Tesouraria</h1>${ICV.baixo}</summary>
        <div class="d3m-d-pop"><button type="button" data-fx="ir" data-valor="setor:financas">Visão geral de Finanças</button>${TELAS_FIN.map(([a, n]) => `<button type="button" data-fx="ir-aba" data-valor="${a}">${esc(n)}</button>`).join('')}</div></details>
        <span class="d3m-d-sub">${SELO} · <button type="button" class="d3m-d-fx-elo" data-fx="ir" data-valor="setor:financas">Finanças</button> · ${esc(nomeMes(mes))} · ${achados.length ? quantos(achados.length, 'coisa pede', 'coisas pedem') + ' decisão' : 'nada pede decisão'}</span></div>
      <div class="d3m-d-ferr"><button type="button" class="d3m-d-ico" data-fx="buscar" aria-label="Buscar" title="Buscar">${ICV.busca}</button><button type="button" class="d3m-d-ico" data-fx="foco" data-valor="como" aria-label="Como funciona" title="Como funciona">${ICV.ajuda}</button>
        <button type="button" class="d3m-d-vbtn p" data-fx="mao-abrir" aria-expanded="${Boolean(u.mao)}">${IC.mais}Lançar à mão</button></div></div>`;
    // Três números: rótulo, selo, o número de 28, a linha de apoio e um gráfico pequeno na cor do número.
    const saldo = d.projecao?.base?.saldo_hoje, serie = d.serie || [];
    const proj = d.projecao?.base?.meses_usados?.length ? X().projetar(d.projecao.base, {}, 6) : null;
    const fioDe = (vals, w = 84, h = 40) => { const v = vals.map(Number).filter(Number.isFinite); if (v.length < 2) return ''; const mn = Math.min(...v), mx = Math.max(...v); return v.map((n, i) => `${i ? 'L' : 'M'}${(2 + (i * (w - 4)) / (v.length - 1)).toFixed(1)} ${(mx === mn ? h / 2 : h - 3 - ((n - mn) * (h - 6)) / (mx - mn)).toFixed(1)}`).join(' '); };
    const mini = (vals, cls) => { const f = fioDe(vals); return f ? `<svg class="d3m-d-fx-mini ${cls}" viewBox="0 0 84 40" preserveAspectRatio="none" aria-hidden="true"><path class="veu" d="${f} V40 H2 Z"/><path class="fio" d="${f}"/></svg>` : ''; };
    const numV2 = ({ rotulo, selo, ic, valor, tom = '', sub = '', graf = '', attrs = '' }) => `<${attrs ? `button type="button" ${attrs}` : 'div'} class="d3m-d-folha d3m-d-fx-num"><span class="d3m-d-fx-num-cab"><span>${esc(rotulo)}</span><span class="d3m-d-selo ${selo}">${ic}</span></span><span class="d3m-d-fx-num-pe"><span><b class="d3m-d-fx-v${tom ? ' ' + tom : ''}">${esc(valor)}</b><small>${sub}</small></span>${graf}</span></${attrs ? 'button' : 'div'}>`;
    const antes = serie.filter((s) => s.mes < mes && s.saldo_final != null).slice(-1)[0];
    const ent = r.entradas, sai = r.saidas + r.cartao_e_transferencias, topoES = Math.max(1, ent, sai), semR = (v) => esc(mil(v).replace('R$ ', ''));
    const ultimoProj = proj?.meses?.[proj.meses.length - 1];
    const numsV2 = `<div class="d3m-d-fx-nums">${numV2({ rotulo: 'Caixa hoje', selo: '', ic: ICV.cifrao, valor: saldo != null ? mil(saldo) : 'sem saldo', tom: saldo < 0 ? 'r' : '', sub: antes ? `era ${esc(mil(antes.saldo_final))} em ${esc(soMes(antes.mes))}` : 'pelo extrato do banco', graf: mini(serie.filter((s) => s.saldo_final != null).slice(-6).map((s) => s.saldo_final), saldo < 0 ? 'r' : ''), attrs: 'data-fx="ir-aba" data-valor="extrato"' })}
      ${numV2({ rotulo: `Resultado de ${nomeDoMes}`, selo: r.resultado < 0 ? 'r' : 'vybe', ic: r.resultado < 0 ? ICV.alerta : IC.ok, valor: mil(r.resultado), tom: r.resultado < 0 ? 'r' : 'g', sub: `entrou ${semR(ent)}, saiu ${semR(sai)}`, graf: `<span class="d3m-d-fx-duas" aria-hidden="true"><i style="--v:${pc(ent, topoES)}%"></i><i style="--v:${pc(sai, topoES)}%"></i></span>` })}
      ${numV2({ rotulo: 'Em 6 meses, no ritmo de hoje', selo: 'negocio', ic: ICV.alta, valor: proj ? mil(proj.saldo_final) : 'sem base', tom: proj && proj.saldo_final < 0 ? 'r' : '', sub: proj ? `${ultimoProj?.mes ? `em ${esc(soMes(ultimoProj.mes))} · ` : ''}abrir a projeção` : 'falta extrato para projetar', graf: proj ? mini([saldo || 0, ...(proj.meses || []).map((m) => m.saldo)], 'l') : '', attrs: 'data-fx="ir-aba" data-valor="projecao"' })}</div>`;
    // Pede decisão: o mais sério primeiro. Selo na cor da gravidade, o rótulo com o detalhe, o valor e um botão.
    const TOM_G = { 3: ['r', ICV.alerta], 2: ['a', ICV.relogio], 1: ['n', ICV.relogio] };
    const linhaAchado = (a) => { const det = String(a.det || ''), valor = (det.match(/-?R\$ [\d.,]+(?! mil)\b/) || [''])[0], resto = (a.clientes?.length ? a.clientes.join(', ') : det.replace(valor, '').replace(/^[\s·]+|[\s·]+$/g, '').replace(/\s·\s·\s/, ' · '));
      const [tom, ic] = TOM_G[a.g] || TOM_G[1];
      return `<div class="d3m-d-fx-ach" title="${esc(a.texto)}"><span class="d3m-d-selo ${tom}">${ic}</span><span class="d3m-d-fx-ach-txt"><b>${esc(a.rot)}</b>${resto ? ` <span>· ${esc(resto)}</span>` : ''}</span><span class="d3m-d-fx-ach-v">${esc(valor)}</span>${a.aba ? `<button type="button" class="d3m-d-fx-btn" data-fx="ir-aba" data-valor="${a.aba}" data-chip="${esc(a.chip || '')}" data-cat="${esc(a.cat || '')}" data-mes="${esc(a.mes || '')}">${esc(a.btn || 'Resolver')}</button>` : `<button type="button" class="d3m-d-fx-btn" data-fx="foco" data-valor="whats">Ver</button>`}</div>`; };
    const pede = `<section class="d3m-d-folha d3m-d-fx-pede" data-fx-card="vi" aria-label="Pede decisão"><div class="d3m-d-cab"><h3>Pede decisão</h3><small>${achados.length ? `o mais sério primeiro · ${n0(daqui)} daqui${pend.length ? ` e ${n0(pend.length)} do WhatsApp` : ''}` : 'nada agora'}</small></div>
      <div class="d3m-d-fx-rolo">${achados.map(linhaAchado).join('') || '<p class="d3v-estado"><b>Nada pedindo decisão agora.</b>O Vorcaro avisa aqui quando aparecer.</p>'}</div></section>`;
    // O lugar de baixo: o gráfico "Entrou e saiu"; "Lançar à mão" e "Decididas" abrem no mesmo lugar.
    const decididas = propostas.filter((p) => p.estado !== 'pendente').slice(-8).reverse();
    const ESTADO = { lancada: ['lançada', 'g'], juntada: ['juntada', 'g'], descartada: ['descartada', 'n'] };
    const m4 = serie.slice(-4), topoM = Math.max(1, ...m4.flatMap((s) => [s.entradas, s.saidas + s.cartao])), k1 = (v) => (Math.abs(v) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const baixo = u.mao ? maoForm(d)
      : u.baixo === 'decididas' ? `<section class="d3m-d-folha d3m-d-fx-baixo" aria-label="Decididas"><div class="d3m-d-cab"><h3>Decididas</h3><small>${n0(decididas.length)} últimas</small><button type="button" class="d3m-d-elo" data-fx="vorcaro-baixo" data-valor="">voltar ao gráfico</button></div>
          <div class="d3m-d-fx-rolo">${decididas.map((p) => `<div class="d3m-d-lin fx-decidida${p.estado === 'descartada' ? ' fora' : ''}"><i class="${(ESTADO[p.estado] || [0, 'n'])[1]}"></i><span class="fx-dec-txt${p.estado === 'descartada' ? ' v2-risca feita' : ''}">${esc(dataCurta(p.data))} · ${esc(p.texto || p.quem || 'sem texto')}</span><small>${esc((ESTADO[p.estado] || ['decidida'])[0])} · ${esc(comSinal(p.tipo === 'entrada' ? p.valor : -p.valor))}</small></div>`).join('') || '<p class="d3v-estado"><b>Nada decidido ainda.</b></p>'}</div></section>`
        : `<section class="d3m-d-folha d3m-d-fx-baixo" aria-label="Entrou e saiu"><div class="d3m-d-cab"><h3>Entrou e saiu</h3><small class="d3m-d-fx-leg">em mil reais <span><i class="e"></i>entrou</span><span><i></i>saiu</span></small></div>
          ${m4.length ? `<div class="d3m-d-fx-meses" style="--n:${m4.length}">${m4.map((s) => { const sa = s.saidas + s.cartao; return `<div class="d3m-d-fx-mes"><div class="d3m-d-fx-par"><span><b>${k1(s.entradas)}</b><i class="e" style="--k:${pc(s.entradas, topoM) / 100}"></i></span><span><span>${k1(sa)}</span><i style="--k:${pc(sa, topoM) / 100}"></i></span></div><span class="d3m-d-fx-mes-pe"><span>${esc(mes3(s.mes))}</span><b class="${s.resultado < 0 ? 'r' : 'g'}">${s.resultado < 0 ? '−' : '+'}${k1(s.resultado)}</b></span></div>`; }).join('')}</div>`
    : '<p class="d3v-estado"><b>Sem extrato ainda.</b>Importe o CSV da conta PJ para ver o que entrou e saiu.</p>'}</section>`;
    // O laranja: o lançamento do WhatsApp da frente; sem ele, o item mais sério do "Pede decisão".
    const frente = pend.find((p) => p.id === u.frente) || pend[0], serio = achados.find((a) => !a.ancora);
    const laranja = frente ? propostaHtml(d, frente, pend.indexOf(frente) + 1, pend.length)
      : `<section class="d3m-laranja d3m-d-fx-prop" data-fx-card="whats" aria-label="O que pede decisão agora"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">V</span>Vorcaro · ${serio ? 'o mais sério agora' : 'Tesouraria'}</span>
        <div class="d3m-lar-txt"><span class="d3-acao-frase">${serio ? esc(serio.rot) + (serio.det ? ` · ${esc(serio.det)}` : '') : !lista.length ? 'Sem extrato ainda' : 'Tudo em ordem no financeiro'}</span><small>${serio ? esc(serio.texto) : !lista.length ? 'Importe o CSV da conta PJ para o Vorcaro começar a conferir.' : 'Nada chegou pelo grupo Vybe Financeiro e nada pede decisão.'}</small>
        <div class="d3m-lar-bts">${serio?.aba ? `<button type="button" class="d3m-btn l" data-fx="ir-aba" data-valor="${serio.aba}" data-chip="${esc(serio.chip || '')}" data-cat="${esc(serio.cat || '')}" data-mes="${esc(serio.mes || '')}">${esc(serio.btn || 'Resolver')}</button>` : !lista.length ? '<button type="button" class="d3m-btn l" data-fx="ir-aba" data-valor="extrato">Ir ao extrato</button>' : ''}</div></div></section>`;
    const outras = pend.filter((p) => p !== frente);
    const aSeguir = pend.length > 1 ? `<section class="d3m-cons d3m-d-fx-seguir" aria-label="A seguir"><div class="d3m-cons-cab"><b>A seguir</b><span>${n0(outras.length)} de ${n0(pend.length)}</span></div><div class="d3m-d-fx-rolo">${outras.map((p) => `<button type="button" class="d3m-vlin" data-fx="proposta-frente" data-valor="${esc(p.id)}" aria-pressed="false"><i class="d3m-pes" aria-hidden="true">${esc(iniciais(p.autor))}</i><span class="d3m-vnome"><b>${esc(p.texto || '(sem texto)')}</b> <small>· ${esc(p.autor || 'Grupo')}, ${esc(ANEXO[p.anexo] || 'mensagem')}</small></span><b class="d3m-vn">${esc(comSinal(p.tipo === 'entrada' ? p.valor : -p.valor))}</b></button>`).join('')}</div></section>` : '';
    // A coluna de consulta, no vidro.
    const vai = (a, nome) => `<button type="button" class="d3m-vlin" data-fx="ir-aba" data-valor="${a}"><span><b>${esc(nome)}</b></span>${contagem[a] ? `<b class="d3m-vn">${n0(contagem[a])}</b>` : ''}${ICV.seta}</button>`;
    const ultimaData = lista.map((t) => t.banco.data).sort().slice(-1)[0], imp = (d.importacoes || []).map((i) => i.em).filter(Boolean).sort().slice(-1)[0];
    const lado = `<aside class="d3m-lado d3m-d-fx-lado" aria-label="Consulta"><nav class="d3m-cons" aria-label="Finanças"><div class="d3m-cons-cab"><b>Finanças</b><span>o que espera em cada tela</span></div>${TELAS_FIN.map(([a, n]) => vai(a, n)).join('')}</nav>
      <section class="d3m-cons" data-fx-card="como" aria-label="Como o Vorcaro trabalha"><div class="d3m-cons-cab"><b>Como o Vorcaro trabalha</b><span></span></div><p class="d3m-d-fx-como">O extrato e o grupo entram, o Vorcaro sugere, e um dono confirma. Nada é lançado sozinho. Só os 4 donos veem; fica fora dos outros grupos.</p></section>
      <section class="d3m-cons" aria-label="Banco"><div class="d3m-cons-cab"><b>Banco do Brasil · conta PJ</b><span>${ultimaData ? `saldo de ${esc(dataCurta(ultimaData))}` : 'sem extrato'}</span></div>
        <button type="button" class="d3m-vlin" data-fx="ir-aba" data-valor="extrato"><span><b>Importar o extrato</b>${imp ? ` <small>· último em ${esc(dataCurta(imp))}</small>` : ''}</span>${ICV.seta}</button>
        ${decididas.length ? `<button type="button" class="d3m-vlin" data-fx="vorcaro-baixo" data-valor="decididas" aria-pressed="${u.baixo === 'decididas'}"><span><b>Decididas</b> <small>· ${n0(decididas.length)} últimas do WhatsApp</small></span>${ICV.seta}</button>` : ''}</section></aside>`;
    return `<div class="fv2 fx d3f d3m-d-fx" data-tela="fx-vorcaro">${topoV2}<div class="d3m-d-fx-grade"><div class="d3m-d-fx-main">${numsV2}<div class="d3m-d-fx-meio"><div class="d3m-d-fx-esq">${u.mao ? '' : pede}${baixo}</div><div class="d3m-d-fx-dir">${laranja}${aSeguir}</div></div></div>${lado}</div></div>`;
  }
  // O lançamento que chegou pelo WhatsApp, no cartão laranja: quem mandou, o valor grande, o que é, os campos para
  // corrigir (os mesmos nomes de antes: tipo, valor, data, categoria, cliente_id e quem) e as três decisões.
  function propostaHtml(d, p, i = 1, n = 1) {
    const sinal = p.tipo === 'entrada' ? 1 : -1;
    const cands = (p.candidatos || []).map((c, k) => `<button type="button" class="d3m-btn l${k ? ' s' : ''} v2-estado" data-fx="proposta-juntar" data-valor="${esc(p.id)}" data-transacao="${esc(c.id)}" title="${esc(c.historico)}">Juntar com ${esc(dataCurta(c.data))}</button>`).join('');
    const ja = (p.candidatos || [])[0];
    const cmp = (rot, html) => `<label><span>${esc(rot)}</span>${html}</label>`;
    return `<section class="d3m-laranja d3m-d-fx-prop" data-fx-proposta="${esc(p.id)}" data-fx-card="whats" aria-label="Chegou pelo WhatsApp"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">V</span>Vorcaro · chegou pelo WhatsApp, ${n0(i)} de ${n0(n)}</span>
      <p class="d3m-d-fx-quem"><i aria-hidden="true">${esc(iniciais(p.autor))}</i><span><b>${esc(p.autor || 'Grupo')}</b> mandou ${p.anexo === 'print' ? 'um print' : p.anexo === 'audio' ? 'um áudio' : 'uma mensagem'}${p.recebido_em ? ` em ${esc(dataCurta(p.recebido_em))}` : ''}</span></p>
      <div class="d3m-d-fx-val"><b class="d3m-lar-num">${esc(comSinal(sinal * p.valor))}</b><span class="d3-acao-frase">${esc(p.texto || '(sem texto)')}</span></div>
      <div class="d3m-d-fx-campos">
        ${cmp('Tipo', `<select name="tipo"><option value="saida"${p.tipo !== 'entrada' ? ' selected' : ''}>saiu</option><option value="entrada"${p.tipo === 'entrada' ? ' selected' : ''}>entrou</option></select>`)}
        ${cmp('Valor', `<input name="valor" inputmode="decimal" value="${esc(String(p.valor).replace('.', ','))}">`)}
        ${cmp('Para onde foi', `<select name="categoria">${opcoesCat(d, p.categoria)}</select>`)}
        ${cmp('Cliente', `<select name="cliente_id">${opcoesCliente(d, p.cliente_id)}</select>`)}
        ${cmp('Quem', `<input name="quem" value="${esc(p.quem)}">`)}
        ${cmp('Dia', `<input name="data" type="date" value="${esc(p.data)}">`)}
      </div>
      ${ja ? `<small class="d3m-d-fx-ja">Já está no extrato de ${esc(dataCurta(ja.data))}: ${esc(String(ja.historico || '').slice(0, 48))}. Juntar evita lançar duas vezes.</small>` : ''}
      <div class="d3m-lar-bts">${cands}<button type="button" class="d3m-btn l${cands ? ' s' : ''} v2-estado" data-fx="proposta-lancar" data-valor="${esc(p.id)}" title="Entra como lançamento à parte (dinheiro que não passou pela conta)">${cands ? 'Lançar à parte' : 'Lançar'}</button>
        <button type="button" class="d3m-d-fx-descartar" data-fx="proposta-descartar" data-valor="${esc(p.id)}">Descartar</button></div></section>`;
  }
  const opcoesForma = (atual = '') => `<option value="">escolher</option>${X().FORMAS_LANCAMENTO.map((f) => `<option value="${f.id}"${atual === f.id ? ' selected' : ''}>${esc(f.nome)}</option>`).join('')}`;
  // De onde veio o lançamento e quem registrou (16/11/2026: "o quem é quem pagou ou quem está lançando?").
  function origemDe(t) {
    const por = t.real.lancado_por || '';
    if (t.banco.origem === 'mao') return `Lançado à mão${por ? ' por ' + por : ''}`;
    if (t.banco.origem === 'whatsapp') return `Veio do grupo Vybe Financeiro${por ? ', mandado por ' + por : ''}`;
    return `Veio do extrato do banco${t.real.conferido && t.real.conferido_por ? ' · conferido por ' + t.real.conferido_por : ''}`;
  }
  function maoForm(d) {
    return card('Lançar à mão', `<p class="fv2-sub">O que não passou pela conta do banco</p>
      <div class="fx-grade" data-fx-form="mao">
        ${campo('Tipo', '<select name="tipo" class="fx-sel"><option value="saida">saiu</option><option value="entrada">entrou</option></select>')}
        ${campo('Valor', '<input name="valor" class="fx-in fx-num" inputmode="decimal">')}
        ${campo('Dia', `<input name="data" type="date" class="fx-in" value="${esc(d.hoje || '')}">`)}
        ${campo('Categoria', `<select name="categoria" class="fx-sel">${opcoesCat(d, 'a_classificar')}</select>`)}
        ${campo('Como', `<select name="forma" class="fx-sel">${opcoesForma(ui.vorcaro.status === 'nao_pago' ? 'boleto' : 'dinheiro')}</select>`)}
        ${campo('Cliente', `<select name="cliente_id" class="fx-sel">${opcoesCliente(d, '')}</select>`)}
        <label class="fx-campo"><span data-fx-rot="quem">Pago a</span><input name="quem" class="fx-in" placeholder="posto, gráfica, Adobe"></label>
        ${campo('Situação', `<select name="status" class="fx-sel">${['pago', 'nao_pago', 'em_aberto'].map((s) => `<option value="${s}"${(ui.vorcaro.status || 'pago') === s ? ' selected' : ''}>${STATUS_NOME[s]}</option>`).join('')}</select>`)}
        ${campo('O que foi', '<input name="texto" class="fx-in" placeholder="aluguel, Adobe, internet…">', 'largo')}
        ${campo('Repete todo mês?', `<select name="repete" class="fx-sel" data-fx-campo="mao-repete"><option value="">Não, só esta vez</option><option value="sim">Sim, é conta fixa</option></select>`, 'fx-so-saida')}
        <span class="fx-so-fixo" hidden>${campo('Vence todo dia', `<input name="fixo_dia" type="number" min="1" max="31" step="1" inputmode="numeric" class="fx-in" placeholder="o do dia acima">`)}</span>
      </div>
      <p class="fv2-sub fx-origem">Fica registrado que foi você quem lançou.</p>
      <p class="fv2-sub fx-so-fixo" hidden>Vira gasto fixo: aparece todo mês em Contas a pagar e o Vorcaro avisa se não sair.</p><div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn s" data-fx="mao-abrir">Cancelar</button><button type="button" class="fv2-btn s d3f-escuro v2-estado" data-fx="mao-salvar">Lançar</button></div>`, '', 'fx-form-caixa');
  }

  // =====================================================================================================
  // PESSOAS E VALES (Paulo, 14/11/2026): o combinado de cada pessoa × o que ela recebeu no extrato; o que passou vira vale
  // (o que a pessoa deve à Vybe), que vai abatendo quando ela recebe menos que o combinado.
  // =====================================================================================================
  function cartaoPessoa(d, c) {
    const meses = c.meses.slice().reverse();
    const linhaMes = (m) => `<div class="fx-pm"><span>${esc(mesCurto(m.mes))}${m.aberto ? ' <small>aberto</small>' : ''}</span><span>${m.combinado ? esc(rs(m.combinado)) : '·'}</span><span>${m.pago ? esc(rs(m.pago)) : '·'}</span>
      <span class="${m.vale_do_mes ? 'fx-neg' : ''}">${m.vale_do_mes ? '+' + esc(rs(m.vale_do_mes)) : m.abatido || m.devolvido ? '−' + esc(rs(m.abatido + m.devolvido)) : m.a_pagar ? esc(rs(m.a_pagar)) + ' a pagar' : m.falta_pagar ? esc(rs(m.falta_pagar)) + ' falta' : '·'}</span><b class="${m.vale_acumulado ? 'fx-neg' : ''}">${esc(rs(m.vale_acumulado))}</b></div>`;
    const tabela = `<div class="fx-pm fx-pm-cab" aria-hidden="true"><span>Mês</span><span>Combinado</span><span>Pago</span><span>No mês</span><span>Vale</span></div>${meses.map(linhaMes).join('') || '<p class="fv2-sub">Nenhum mês com extrato ainda.</p>'}`;
    const pix = c.itens.slice(0, 12).map((i) => `<div class="fx-mini"><span>${esc(dataCurta(i.data))} · ${esc(i.historico)} <small>${esc(i.nome)} · ref. ${esc(mesCurto(i.mes))}</small></span><b class="${i.valor < 0 ? 'fx-neg' : ''}">${esc(comSinal(i.valor))}</b><button type="button" class="fv2-link" data-fx="ir-lanc" data-valor="${esc(i.id)}" data-mes="${esc(i.data.slice(0, 7))}">abrir</button></div>`).join('')
      || '<p class="fv2-sub">Nenhum Pix atribuído a esta pessoa. No Extrato, escolha "Para quem".</p>';
    const ajustes = (d.vales || []).filter((a) => String(a.pessoa_id) === String(c.pessoa_id));
    const formAjuste = ui.vales.ajuste === c.pessoa_id ? `<div class="fx-grade" data-fx-form="ajuste">${campo('Mês', `<input name="mes" type="month" class="fx-in" value="${esc((d.hoje || '').slice(0, 7))}">`)}${campo('O quê', '<select name="tipo" class="fx-sel"><option value="devolveu">Devolveu</option><option value="abater">Abater do vale</option></select>')}
      ${campo('Valor', '<input name="valor" class="fx-in fx-num" inputmode="decimal">')}${campo('Nota', '<input name="nota" class="fx-in" placeholder="como foi">', 'largo')}
      <div class="fx-linha-acoes"><button type="button" class="fv2-btn s d3f-escuro v2-estado" data-fx="pessoa-ajuste" data-valor="${esc(c.pessoa_id)}">Lançar</button></div></div>` : '';
    return `<div class="fv2-det fx-pessoa" data-fx-pessoa="${esc(c.pessoa_id)}">
      <div class="fx-grade" data-fx-form="salario">${campo('Salário / pró-labore combinado', `<input name="valor" class="fx-in fx-num" inputmode="decimal" value="${c.salario ? esc(String(c.salario.valor).replace('.', ',')) : ''}" placeholder="por mês">`)}${campo('Desde', `<input name="desde" type="month" class="fx-in" value="${esc(c.salario?.desde || '')}">`)}
        <div class="fx-linha-acoes"><button type="button" class="fv2-btn s d3f-escuro v2-estado" data-fx="pessoa-salario" data-valor="${esc(c.pessoa_id)}">Salvar combinado</button></div></div>
      <div class="fx-pm-rolo">${tabela}</div>
      <p class="fv2-sub fx-legenda">Vale = o que passou do combinado (a pessoa deve à Vybe). Quando recebe menos que o combinado, a diferença abate o vale; sem vale, fica a pagar à pessoa.</p>
      <h3 class="fx-h3">Pix que compõem</h3>${pix}
      <h3 class="fx-h3">Devolveu ou abateu à mão</h3>${ajustes.map((a) => `<div class="fx-mini"><span>${esc(mesCurto(a.mes))} · ${a.tipo === 'abater' ? 'abatido' : 'devolveu'}${a.nota ? ' · ' + esc(a.nota) : ''}</span><b>${esc(rs(a.valor))}</b><button type="button" class="fv2-link" data-fx="pessoa-ajuste-tirar" data-valor="${esc(a.id)}">desfazer</button></div>`).join('') || '<p class="fv2-sub">Nenhum.</p>'}
      <div class="fx-linha-acoes"><button type="button" class="fv2-btn s" data-fx="pessoa-ajuste-abrir" data-valor="${esc(c.pessoa_id)}" aria-expanded="${ui.vales.ajuste === c.pessoa_id}">Devolveu / abater</button></div>${formAjuste}</div>`;
  }
  function vales(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.vales, contas = d.contas_pessoas || [];
    const comVale = contas.filter((c) => c.vale > 0), aPagar = contas.filter((c) => c.a_pagar > 0), semComb = contas.filter((c) => !c.salario?.valor);
    const totalVale = comVale.reduce((s, c) => s + c.vale, 0);
    const partes = [topo('Pessoas e vales')];
    partes.push(comVale.length ? acao(`${esc(rs(totalVale))} em vale${comVale[0] ? `; o maior é ${esc(comVale[0].nome)}` : ''}.`, 'Ver quem', 'data-fx="chip" data-alvo="vales" data-valor="vale"')
      : !contas.length ? acao('Nenhum Pix atribuído a alguém do time ainda.', 'Ir ao extrato', 'data-fx="ir-aba" data-valor="extrato"')
      : acao('Ninguém com vale.'));
    partes.push(nums([
      { rotulo: 'Em vale', valor: mil(totalVale), tom: totalVale ? 'r' : '', sub: quantos(comVale.length, 'pessoa', 'pessoas') },
      { rotulo: 'A pagar às pessoas', valor: mil(aPagar.reduce((s, c) => s + c.a_pagar, 0)), sub: quantos(aPagar.length, 'pessoa', 'pessoas') },
      { rotulo: 'Sem combinado', valor: n0(semComb.length), tom: semComb.length ? 'a' : '', sub: 'salário não informado' },
    ]));
    const vis = contas.filter((c) => (u.chip === 'vale' ? c.vale > 0 : u.chip === 'semcomb' ? !c.salario?.valor : true));
    const ultimo = (c) => c.meses[c.meses.length - 1] || {};
    const corpo = vis.map((c) => {
      const aberta = u.aberta === c.pessoa_id, m = ultimo(c);
      return `<div class="v2-abre fv2-linha" data-linha="${esc(c.pessoa_id)}" aria-expanded="${aberta}"><div class="fv2-lin"><button type="button" class="fv2-txt" data-fx="abrir" data-alvo="vales" data-valor="${esc(c.pessoa_id)}" aria-expanded="${aberta}"><b>${esc(c.nome)}</b> <small class="fv2-sub">${c.salario?.valor ? esc(rs(c.salario.valor)) + '/mês' : 'sem combinado'}</small></button>
        <span class="fv2-sub">pago em ${esc(soMes(m.mes))}: ${esc(rs(m.pago || 0))}</span>${c.a_pagar ? pill(`${rs(c.a_pagar)} a pagar`, 'a') : ''}<b class="fv2-valor ${c.vale ? 'fx-neg' : ''}">${c.vale ? esc(rs(c.vale)) + ' de vale' : 'sem vale'}</b></div>
        <div class="v2-mais"><div>${aberta ? cartaoPessoa(d, c) : ''}</div></div></div>`;
    }).join('');
    // Quem do time ainda não tem conta: escolher para informar o combinado.
    const semConta = (d.pessoas || []).filter((p) => !contas.some((c) => c.pessoa_id === String(p.id)));
    const novo = semConta.length ? `<details class="fx-det"><summary>Informar o combinado de outra pessoa · ${n0(semConta.length)}</summary>${semConta.map((p) => `<div class="fx-mini" data-fx-form="salario"><span>${esc(p.nome)}</span><input name="valor" class="fx-in fx-num" inputmode="decimal" placeholder="combinado" aria-label="Combinado de ${esc(p.nome)}"><input name="desde" type="month" class="fx-in" aria-label="Desde"><button type="button" class="fv2-btn s v2-estado" data-fx="pessoa-salario" data-valor="${esc(p.id)}">Salvar</button></div>`).join('')}</details>` : '';
    partes.push(card('Por pessoa', `<div class="fv2-filtros">${chips('vales', [['todos', 'Todos', contas.length], ['vale', 'Com vale', comVale.length, 'r'], ['semcomb', 'Sem combinado', semComb.length]], u.chip)}</div>${corpo || vazio('Ninguém com esse filtro.')}${novo}`, 'combinado × pago × vale'));
    return casca(partes, 'vales');
  }
  // Abrir a conta de uma pessoa de outra tela (RH › Folha).
  function abrirPessoa(id) { ui.vales.aberta = String(id || ''); window.VybeComercial?.abrir?.('vales', { abas: ['vales'], rotulo: 'Finanças' }); }
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
      if (q('p_pessoa') != null) { p.pessoa_id = q('p_pessoa'); p.pessoa_nome = nomePessoa(dadosAtuais(), p.pessoa_id); }
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
      // Extrato V2: Para onde foi, Regras, Importações e Apagados abrem atrás de botões, um por vez.
      case 'extrato-lado': ue.lado = ue.lado === valor ? '' : valor; return repintar();
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
      case 'lanc-apagar': {
        const tr = (d.transacoes || []).find((x) => x.id === valor); if (!tr) return;
        const doBanco = tr.banco.saldo != null;
        if (doBanco && typeof perguntarNoPainel === 'function') {
          const ok = await perguntarNoPainel({ titulo: 'Apagar este lançamento do banco?', perigo: true, confirmar: 'Apagar',
            texto: `${dataCurta(tr.banco.data)} · ${tr.banco.historico} · ${comSinal(tr.banco.valor)}. Ele sai das contas e não volta ao reimportar o extrato. Fica em "Apagados", no Extrato, de onde volta com um toque.` });
          if (!ok) return;
        }
        indo(b);
        const r = await gravar({ acao: 'apagar', id: valor });
        if (r) {
          if (ue.aberta === valor) ue.aberta = '';
          repintar();
          if (typeof mostrarDesfazer === 'function') mostrarDesfazer('Lançamento apagado.', () => gravar({ acao: 'restaurar', id: valor }, 'Lançamento de volta.'));
        } else voltou(b);
        return;
      }
      case 'lanc-restaurar': {
        indo(b);
        if (!(await gravar({ acao: 'restaurar', id: valor }, 'Lançamento de volta.'))) voltou(b);
        return;
      }
      case 'salvar-lanc': {
        const ed = b.closest('[data-fx-editor]'); if (!ed) return;
        lerPartes(valor);
        const v = valoresDe(ed);
        const mudanca = { categoria: v.categoria, cliente_id: v.cliente_id, cliente_nome: nomeCliente(d, v.cliente_id), quem: v.quem, competencia: v.competencia, descricao: v.descricao, conferido: true,
          pessoa_id: v.pessoa_id || '', pessoa_nome: nomePessoa(d, v.pessoa_id) };
        if ('fatura' in v) mudanca.fatura = v.fatura;
        if ('fixo_id' in v) mudanca.fixo_id = v.fixo_id;
        if ('forma' in v) mudanca.forma = v.forma;
        const partes = ue.partes[valor];
        mudanca.partes = partes ? partes.map((p) => ({ valor: numero(p.valor), cliente_id: p.cliente_id || '', cliente_nome: p.cliente_nome || nomeCliente(d, p.cliente_id), categoria: p.categoria || v.categoria, competencia: p.competencia || v.competencia, quem: p.quem || '', pessoa_id: p.pessoa_id || '', pessoa_nome: p.pessoa_nome || nomePessoa(d, p.pessoa_id) })) : [];
        indo(b);
        const r = await gravar({ acao: 'editar', id: valor, mudanca });
        if (r) { delete ue.partes[valor]; const prox = proximoAConferir(d, valor); ue.aberta = prox || ''; repintar(); } else voltou(b);
        return;
      }
      case 'regra-de': ue.regra = valor; return repintar();
      case 'escolher-cat': { // a pergunta da regra pronta: só troca a categoria no formulário (grava no "Salvar e conferir")
        const ed = b.closest('[data-fx-editor]'), sel = ed?.querySelector('select[name="categoria"]'); if (sel) sel.value = valor;
        for (const x of b.parentElement.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
        return;
      }
      // Pessoas e vales
      case 'pessoa-salario': {
        const f = b.closest('[data-fx-form="salario"]'); if (!f) return;
        const v = valoresDe(f); indo(b);
        const r = await gravar({ acao: 'salario_salvar', pessoa_id: valor, valor: v.valor === '' ? '' : numero(v.valor), desde: v.desde || '' }, v.valor === '' ? 'Combinado tirado.' : 'Combinado salvo.');
        if (!r) voltou(b); return;
      }
      case 'pessoa-ajuste-abrir': ui.vales.ajuste = ui.vales.ajuste === valor ? '' : valor; return repintar();
      case 'pessoa-ajuste': {
        const f = b.closest('[data-fx-form="ajuste"]'); if (!f) return;
        const v = valoresDe(f); indo(b);
        const r = await gravar({ acao: 'vale_ajuste_salvar', ajuste: { pessoa_id: valor, mes: v.mes, tipo: v.tipo, valor: numero(v.valor), nota: v.nota } }, 'Lançado no vale.');
        if (r) { ui.vales.ajuste = ''; repintar(); } else voltou(b); return;
      }
      case 'pessoa-ajuste-tirar': await gravar({ acao: 'vale_ajuste_remover', id: valor }, 'Ajuste desfeito.'); return;
      case 'regra-salvar': {
        const ed = b.closest('[data-fx-editor]'); if (!ed) return;
        const v = valoresDe(ed);
        const r = await gravar({ acao: 'regra_salvar', regra: { contem: v.r_contem, sinal: v.r_sinal, revisar: Boolean(v.r_revisar), categoria: v.categoria, quem: v.quem, cliente_id: v.cliente_id, cliente_nome: nomeCliente(d, v.cliente_id),
          pessoa_id: v.pessoa_id || '', pessoa_nome: nomePessoa(d, v.pessoa_id), fixo_id: v.fixo_id || '' } });
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
      case 'venc-salvar': { // o dia do vencimento da fatura do cartão (só donos: a rota confere)
        const campo = b.parentElement?.querySelector('input'), dia = String(campo?.value || '').trim();
        indo(b);
        const r = await gravar({ acao: 'cartao_vencimento', cartao: valor, dia: dia === '' ? null : Number(dia) }, dia ? `Fatura do ${valor} vence no dia ${dia}.` : 'Vencimento tirado.');
        if (!r) voltou(b);
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
      // Prancha V2: "Decididas" abre no lugar do gráfico; a busca do topo é a busca de todo o painel.
      case 'vorcaro-baixo': ui.vorcaro.baixo = ui.vorcaro.baixo === valor ? '' : valor; ui.vorcaro.mao = false; return repintar();
      case 'buscar': document.querySelector('#mundo-hud [data-ferr="busca"]')?.click?.(); return;
      case 'mao-salvar': {
        const f = formDe(b, 'mao'); if (!f) return;
        const v = valoresDe(f);
        indo(b);
        const repete = v.repete === 'sim' && v.tipo === 'saida';
        const fixo = repete ? { repete: true, nome: v.texto || v.quem, dia: v.fixo_dia ? Number(v.fixo_dia) : undefined } : undefined;
        for (const k of ['repete', 'fixo_dia']) delete v[k];
        const r = await gravar({ acao: 'lancar_mao', lancamento: { ...v, valor: numero(v.valor), cliente_nome: nomeCliente(d, v.cliente_id) }, fixo }, repete ? 'Lançado e cadastrado como conta fixa.' : 'Lançado.');
        if (r) { ui.vorcaro.mao = false; ui.vorcaro.status = ''; repintar(); } else voltou(b);
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
  // Lançar à mão: "Repete todo mês?" só para saída; com "sim", aparecem o dia do vencimento e a forma de pagar.
  function mostrarFixoMao(form) {
    if (!form) return;
    const saida = form.querySelector('select[name="tipo"]')?.value !== 'entrada';
    const sim = saida && form.querySelector('[name="repete"]')?.value === 'sim';
    for (const el of form.querySelectorAll('.fx-so-saida')) el.hidden = !saida;
    const rot = form.querySelector('[data-fx-rot="quem"]'), q = form.querySelector('input[name="quem"]');
    if (rot) rot.textContent = saida ? 'Pago a' : 'Recebido de';
    if (q) q.placeholder = saida ? 'posto, gráfica, Adobe' : 'quem mandou o dinheiro';
    for (const el of form.closest('.fx-form-caixa, .fv2-card')?.querySelectorAll('.fx-so-fixo') || []) el.hidden = !sim;
  }
  function aoMudar(ev) {
    const t = ev.target;
    if (t.matches?.('[data-fx-arquivo]')) { const f = t.files?.[0]; if (f) previa(f); t.value = ''; return; }
    if (t.matches?.('[data-fx-form="mao"] select[name="tipo"], [data-fx-campo="mao-repete"]')) { mostrarFixoMao(t.closest('[data-fx-form="mao"]')); return; }
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

  const telas = Object.freeze({ vorcaro, extrato, clientes_mes: clientesMes, cartao, fixos, projecao, vales });
  // Contas a pagar › "Lançar à mão" abre o formulário já aberto, como saída ainda não paga.
  function abrirLancarMao({ status = '' } = {}) { ui.vorcaro.mao = true; ui.vorcaro.status = status; }
  window.VybeFinanceiro = Object.freeze({ telas, abrirPessoa, abrirLancarMao, molde: pecasFin, _teste: { cartaoPessoa, ui, lerFaturaColada, fixosProvaveis, cenarioAtual, analise } });
})();
