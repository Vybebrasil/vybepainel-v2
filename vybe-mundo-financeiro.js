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
    cartao: { fatura: '', lado: '', novo: false, colar: false, editando: '', chip: 'todos', aberta: '', inteira: false },
    fixos: { mes: '', novo: false, editando: '' },
    vorcaro: { mao: false, frente: '', baixo: '' },
    vales: { aberta: '', chip: 'todos', ajuste: '', combinado: false },
    projecao: { horizonte: 6, aba: 'caixa', cenario: { cortes: {}, economias: {}, clientes_novos: [], clientes_perdidos: {}, gastos_novos: [], ajuste_entradas_pct: 0 }, nome: '', base: null },
  };
  let anfitriao = {}; // { d, repintar, recarregar } da última pintura (janela do Comercial)
  // O que o "Importar extrato" aceita: OFX, CSV e Excel (o .xls antigo entra só para dizer por que não dá).
  const ACEITA_EXTRATO = '.ofx,.csv,.xlsx,.xls,text/csv,application/x-ofx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
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
    const arquivo = (cls, rot = 'Importar extrato') => `<label class="${cls} fx-arquivo">${cls.includes('p') ? IC.mais : ''}${rot}<input type="file" accept="${ACEITA_EXTRATO}" data-fx-arquivo hidden></label>`;
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
    const principal = M().folha({ titulo: `Lançamentos de ${soMes(u.mes) || 'agora'}`, sub: 'Santander, conta PJ', dir: todas.length ? fichas : '', cab: todas.length ? M().cab(COLS) : '', corpo, olho, rotulo: 'lancamentos', cls: 'fx-lancs' });
    // O que mora atrás dos botões: um painel por vez, embaixo da lista, com o fechar no alto.
    const PAINEL = { para: ['Para onde foi', () => (r ? porCategoriaHtml(d, r) : '') + `<div class="d3m-d-fm-busca"><label class="fv2-sr" for="fx-busca-extrato">Buscar no extrato</label><input class="fv2-busca fx-busca" id="fx-busca-extrato" type="search" data-vc-busca="fx_extrato" placeholder="Buscar no extrato" title="Buscar no extrato" value="${esc(ctx.filtro?.fx_extrato || '')}">${u.cat ? `<button type="button" class="fv2-btn s" data-fx="cat" data-valor="${esc(u.cat)}">Tirar a categoria</button>` : ''}</div>`],
      regras: ['Regras', () => regrasHtml(d)], importacoes: ['Importações', () => importacoesHtml(d) || '<p class="fv2-sub">Nenhuma importação ainda.</p>'], apagados: ['Apagados', () => lixeiraHtml(d) || '<p class="fv2-sub">Nada apagado.</p>'] };
    const painel = PAINEL[u.lado] ? M().folha({ titulo: PAINEL[u.lado][0], dir: `<button type="button" class="d3m-d-fm-elo" data-fx="extrato-lado" data-valor="${u.lado}">fechar</button>`, corpo: `<div class="d3m-d-fm-painel">${PAINEL[u.lado][1]()}</div>`, cls: 'd3m-d-fm-curta d3m-d-fm-segundo', rotulo: u.lado }) : '';
    const laranja = !todas.length ? '' : aConferir ? M().laranja({ rot: 'já sugeri o destino', num: n0(aConferir), frase: aConferir === 1 ? 'lançamento para conferir' : 'lançamentos para conferir',
      apoio: sem.length ? `E ${quantos(sem.length, 'boleto', 'boletos')} de ${esc(rs(sem.reduce((s, t) => s + t.banco.valor, 0)))} para dividir entre clientes.` : 'A categoria sugerida já está na linha; abra para corrigir.',
      bts: [[aConferir === 1 ? 'Ver o lançamento' : `Ver os ${n0(aConferir)}`, 'data-fx="chip" data-alvo="extrato" data-valor="conferir"'], sem.length ? ['Dividir', 'data-fx="cat" data-valor="receita_boleto"'] : null] })
      : sem.length ? M().laranja({ rot: 'boleto para dividir', num: n0(sem.length), frase: sem.length === 1 ? 'boleto para dividir entre clientes' : 'boletos para dividir entre clientes', apoio: `${esc(rs(sem.reduce((s, t) => s + t.banco.valor, 0)))} no total.`, bts: [['Dividir', 'data-fx="cat" data-valor="receita_boleto"']] }) : '';
    const corpoTela = principal + painel + importacaoPorCima(d);
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
    if (p.erro) return card('Não deu para ler o extrato', `<p class="fx-previa-num">${esc(p.erro)}</p>${ui.extrato.nomeArquivo ? `<p class="fv2-sub">Arquivo: ${esc(ui.extrato.nomeArquivo)}</p>` : ''}<div class="fx-linha-acoes fx-fim"><label class="fv2-btn s d3f-escuro fx-arquivo">Escolher outro arquivo<input type="file" accept="${ACEITA_EXTRATO}" data-fx-arquivo hidden></label><button type="button" class="fv2-btn s" data-fx="previa-fechar">Fechar</button></div>`, 'nada gravado', 'fx-previa');
    const datas = (p.transacoes || []).map((t) => t.banco.data).sort(), de = datas[0], ate = datas[datas.length - 1];
    const conta = [p.agencia ? `agência ${esc(p.agencia)}` : '', p.conta ? `conta ${esc(p.conta)}` : ''].filter(Boolean).join(' ');
    const porRegra = new Map();
    for (const t of p.transacoes.filter((x) => !x.ja_importada)) { const k = nomeCat(d, t.real.categoria); porRegra.set(k, (porRegra.get(k) || 0) + 1); }
    const meses = p.meses.map((m) => `<div class="fx-mini"><span><b>${esc(nomeMes(m.mes || ''))}</b> · ${quantos(m.lancamentos, 'lançamento', 'lançamentos')}</span><span>entrou ${esc(rs(m.entradas))} · saiu ${esc(rs(m.saidas + m.cartao_e_transferencias))}</span></div>`).join('');
    const exemplos = p.transacoes.filter((x) => !x.ja_importada).slice(-12).reverse().map((t) => `<div class="fx-mini"><span>${esc(dataCurta(t.banco.data))} · ${esc(t.banco.historico)}</span><span>${pill(nomeCat(d, t.real.categoria), t.real.conferido ? 'n' : 'a')} <b>${esc(rs(t.banco.valor))}</b></span></div>`).join('');
    return card(`Prévia: ${ui.extrato.nomeArquivo || 'extrato'}`, `<p class="fx-previa-num"><b>${quantos(p.novas, 'lançamento novo', 'lançamentos novos')}</b>${p.repetidas ? ` · ${n0(p.repetidas)} já estavam aqui${p.de_outro_formato ? ` (${n0(p.de_outro_formato)} vieram antes em outro formato)` : ''}` : ''}</p>
      <p class="fv2-sub">${de ? `De ${esc(dataCurta(de))} a ${esc(dataCurta(ate))} · ` : ''}${quantos(datas.length, 'lançamento no arquivo', 'lançamentos no arquivo')}${p.formato ? ` · ${esc(String(p.formato).toUpperCase())}` : ''}${conta ? ` · ${conta}` : ''}</p>
      ${p.falhou ? `<p class="fx-previa-num" role="alert">${esc(p.falhou)}</p>` : ''}
      ${p.avisos?.length ? `<p class="fv2-sub">${p.avisos.map(esc).join(' · ')}</p>` : ''}${meses}
      <p class="fx-rot">Como ficou classificado</p><p class="fv2-sub">${[...porRegra].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(k)}: ${n}`).join(' · ')}</p>
      <details class="fx-det"><summary>Últimos lançamentos</summary>${exemplos}</details>
      <div class="fx-linha-acoes fx-fim"><button type="button" class="fv2-btn s d3f-escuro" data-fx="importar"${p.novas ? '' : ' disabled'}>${p.novas ? `${p.falhou ? 'Tentar de novo: importar' : 'Importar'} ${quantos(p.novas, 'lançamento', 'lançamentos')}` : 'Nada novo para importar'}</button><button type="button" class="fv2-btn s" data-fx="previa-fechar">${p.novas ? 'Cancelar' : 'Fechar'}</button></div>`,
    'nada gravado ainda', 'fx-previa');
  }
  // A leitura e a prévia por cima da tela atual (Hoje, Movimento, Extrato ou outra): a mesma janela de qualquer botão.
  function importacaoPorCima(d) {
    const u = ui.extrato;
    if (!u.lendo && !u.previa) return '';
    const corpo = u.lendo ? `<p class="fe-imp-lendo" role="status"><span class="fe-imp-gira" aria-hidden="true"></span><span>Lendo o extrato${u.nomeArquivo ? ` <b>${esc(u.nomeArquivo)}</b>` : ''}…</span></p>` : previaHtml(d);
    return `<div class="fe-imp-veu"${u.lendo ? '' : ' data-fx="previa-fechar"'} aria-hidden="true"></div><section class="fe-imp" role="dialog" aria-modal="true" aria-label="Importar extrato" data-fx-card="importar">${corpo}</section>`;
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
    const corpo = !linhas.length && !pc2.desde ? `<div class="d3m-d-fm-vazio"><p>Sem extrato, não dá para saber quem pagou.</p><button type="button" class="fv2-btn s" data-fx="ir-aba" data-valor="extrato">Ir ao extrato</button></div>`
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
    const olho = pc2.desde || linhas.length ? M().olho([[esc(mil(recebido)), atual ? `recebido em ${soMes(atual)}` : 'recebido no mês', recebido ? 'g' : ''], [esc(mil(aReceber)), 'a receber no mês'],
      [`${n0(pagos)} de ${n0(cobrados)}`, atual ? `já pagou ${soMes(atual)}` : 'já pagaram no mês'], semCobranca ? [n0(semCobranca), semCobranca === 1 ? 'cliente ativo sem cobrança' : 'clientes ativos sem cobrança', 'a'] : null]) : '';
    const laranja = aberto > 0 ? M().laranja({ rot: 'quem deve', num: n0(nAberto), frase: nAberto === 1 ? 'cliente com mês em aberto' : 'clientes com mês em aberto',
      apoio: `${esc(rs(aberto))} no total.${maior?.total_aberto ? ` O maior é ${esc(maior.cliente_nome)}, com ${esc(rs(maior.total_aberto))}.` : ''}`,
      bts: [['Ver quem deve', 'data-fx="chip" data-alvo="clientes_mes" data-valor="aberto"'], maior?.total_aberto ? [`Abrir ${maior.cliente_nome}`, `data-fx="abrir" data-alvo="clientes_mes" data-valor="${esc(maior.cliente_id)}"`] : null] }) : '';
    return M().molde({ tela: 'fx-clientes_mes', aba: 'clientes_mes', titulo: 'Clientes mês a mês', d, repintar,
      sub: `${seis.length ? `${esc(soMes(seis[0]))} a ${esc(nomeMes(atual))}` : 'sem extrato'}${aberto ? ` · ${esc(mil(aberto))} em aberto` : linhas.length ? ' · todos em dia' : ''}${!pc2.desde ? ' · sem extrato importado' : ''}`, laranja,
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
    // Padrão V2 (prancha V2-M-Financas-Cartao): o molde com três números em cima, os itens da fatura no cartão principal,
    // os pagamentos sem fatura no segundo cartão; categorias, pagamentos e o vencimento atrás de botões; o laranja só
    // quando há o que decidir (pagamento sem fatura, item sem categoria, fatura vencida sem pagar).
    const pagoSolto = soltos.reduce((s, p) => s + Number(p.valor || 0), 0);
    const vista = !doMes.length ? 'ainda vazia' : SITUACAO_FATURA[situacao][0].toLowerCase();
    const ultimoPag = pagamentos[0];
    const nums = [M().num({ rotulo: 'Total da fatura', ic: ICV.cifrao, valor: esc(mil(total)), sub: itens.length ? quantos(itens.length, 'item', 'itens') : 'nenhum item colado' }),
      M().num({ rotulo: 'Pago, pelo extrato', selo: pago ? 'vybe' : '', ic: IC.ok, valor: esc(rs(pago)), tom: pago ? 'g' : '', sub: pagamentos.length ? `${quantos(pagamentos.length, 'pagamento', 'pagamentos')}${ultimoPag ? `, o último em ${esc(dataCurta(ultimoPag.data))}` : ''}` : 'nenhum pagamento ligado' }),
      M().num({ rotulo: 'Falta pagar', selo: 'negocio', ic: ICV.relogio, valor: !itens.length && pago ? 'sem fatura' : esc(mil(falta)), tom: !itens.length && pago ? 'q' : '', sub: !itens.length && pago ? 'não dá para saber sem os itens' : `${esc(SITUACAO_FATURA[situacao][0])}${vence ? ` · vence ${esc(dataCurta(vence))}` : ''}` })].join('');
    const vis = itens.filter((i) => (u.chip === 'aberto' ? i.status !== 'pago' : u.chip === 'semcat' ? i.categoria === 'a_classificar' : true));
    const cabe = u.inteira ? vis : vis.slice(0, 30), resto = vis.slice(cabe.length);
    const COLS = [[48, 'Dia'], [0, 'Item'], [130, 'Situação'], [110, 'Valor', 'r'], [14, '']];
    const linhaItem = (i) => {
      const aberta = u.aberta === i.id || u.editando === i.id, semC = i.categoria === 'a_classificar';
      const quem = [semC ? '' : nomeCat(d, i.categoria), i.quem, i.cliente_nome, cartoes.length > 1 ? i._cartao : ''].filter(Boolean).map(esc).join(' · ');
      return `<div class="v2-abre d3m-d-fm-linha fx-item" data-linha="${esc(i.id)}" aria-expanded="${aberta}">${M().tr(COLS, [dataCurta(i.data),
        `<button type="button" class="d3m-d-fm-nome" data-fx="abrir" data-alvo="cartao" data-valor="${esc(i.id)}" aria-expanded="${aberta}"><b>${esc(i.descricao)}</b>${i.parcela ? ` <small>· ${esc(i.parcela)}</small>` : ''} <small${semC ? ' class="r"' : ''}>· ${semC ? 'A classificar' + (quem ? ' · ' + quem : '') : quem}</small></button>`,
        `<span class="${STATUS_TOM[i.status] === 'g' ? 'g' : STATUS_TOM[i.status] === 'r' ? 'r' : 'a'}">${esc(STATUS_NOME[i.status] || 'Em aberto')}</span>`, esc(rs(i.valor)), ''])}
        <div class="v2-mais"><div><div class="fv2-det d3m-d-fm-det">${u.editando === i.id ? `<div class="fx-form-caixa">${itemCampos(d, i)}</div>` : `<div class="fx-linha-acoes"><span class="fv2-seg fx-seg-p" role="group" aria-label="Situação do item">${['pago', 'nao_pago', 'em_aberto'].map((s) => `<button type="button" data-fx="item-status" data-id="${esc(i.id)}" data-valor="${s}" aria-pressed="${i.status === s}">${STATUS_NOME[s]}</button>`).join('')}</span><button type="button" class="fv2-btn s" data-fx="item-editar" data-valor="${esc(i.id)}">Editar</button></div>`}</div></div></div></div>`;
    };
    const fichas = M().fichas([['todos', 'Todos', itens.length], ['aberto', 'Em aberto', emAberto], ['semcat', 'Sem categoria', semCat, 'r']]
      .map(([k, nome, n, tom]) => ({ nome, n, tom: n ? tom : '', on: u.chip === k, attrs: `data-fx="chip" data-alvo="cartao" data-valor="${k}"` })), 'Filtrar os itens')
      + `<button type="button" class="d3m-d-fm-ficha" data-fx="cartao-novo" aria-expanded="${Boolean(u.novo)}">${IC.mais}Novo item</button>`;
    const corpo = cabe.length ? cabe.map(linhaItem).join('') + (resto.length ? `<div class="d3m-d-fm-pe"><button type="button" class="d3f-mais" data-fx="mais" data-alvo="cartao">+${n0(resto.length)} · ${esc(rs(resto.reduce((s, i) => s + Number(i.valor || 0), 0)))}</button></div>` : '')
      : itens.length ? '<p class="d3m-d-fm-vazio">Nada com esse filtro.</p>'
        : `<div class="d3m-d-fm-vazio d3m-d-fm-vazio-alto"><span class="d3m-d-fm-vazio-ic" aria-hidden="true">${ICV.cifrao}</span><p><b>Nenhum item nesta fatura</b>Cole os itens da fatura para ver cada compra, o que foi pago e o que falta.</p><span class="d3m-d-fm-vazio-bts"><button type="button" class="fv2-btn s d3f-escuro" data-fx="cartao-colar">Colar os itens da fatura</button><button type="button" class="fv2-btn s" data-fx="cartao-novo">Novo item</button></span></div>`;
    const porCat = new Map();
    for (const f of doMes) for (const c of f.por_categoria) porCat.set(c.categoria, { ...c, total: (porCat.get(c.categoria)?.total || 0) + c.total });
    const cats = [...porCat.values()].sort((a, b) => b.total - a.total), maxCat = Math.max(1, ...cats.map((c) => c.total));
    const olho = M().olho([[esc(mil(total)), 'na fatura'], pagamentos.length ? [esc(rs(pago)), `<button type="button" class="d3m-d-fm-elo" data-fx="cartao-lado" data-valor="pagamentos" aria-expanded="${u.lado === 'pagamentos'}">${quantos(pagamentos.length, 'pagamento', 'pagamentos')}</button>`, 'g'] : null,
      cats.length ? [n0(cats.length), `<button type="button" class="d3m-d-fm-elo" data-fx="cartao-lado" data-valor="categorias" aria-expanded="${u.lado === 'categorias'}">${cats.length === 1 ? 'categoria' : 'categorias'}</button>`] : null]);
    const principal = M().folha({ titulo: `Itens da fatura de ${soMes(u.fatura)}`, sub: esc(cartoes.join(' e ') || 'cartão da agência'), dir: fichas, cab: cabe.length ? M().cab(COLS) : '', corpo, olho: itens.length ? olho : '', rotulo: 'itens', cls: 'fx-itens' });
    const PAINEL = { categorias: ['Por categoria', () => cats.map((c) => gx(esc(c.nome), c.total / maxCat * 100, esc(rs(c.total)), { tom: c.categoria === 'a_classificar' ? 'r' : '' })).join('') || '<p class="fv2-sub">Nada nesta fatura.</p>'],
      pagamentos: ['Pagamentos', () => pagamentos.map((p) => `<div class="fx-mini fx-pag"><span class="fx-dia">${esc(dataCurta(p.data))}</span><span>${esc(p.historico)}</span><b class="fx-valor e">${esc(rs(p.valor))}</b></div>`).join('') || '<p class="fv2-sub">Nenhum pagamento ligado a esta fatura.</p>'],
      vencimento: ['Vencimento', () => nomesCartao.map((n) => `<div class="fx-mini fx-venc"><span>${esc(n)}</span><label class="fx-venc-dia">dia <input class="fx-in" type="number" min="1" max="31" step="1" inputmode="numeric" value="${esc(venc[n] ?? '')}" aria-label="Dia do vencimento da fatura do ${esc(n)}"></label><button type="button" class="fv2-btn s v2-estado" data-fx="venc-salvar" data-valor="${esc(n)}">Salvar</button></div>`).join('')] };
    const fechar = (k) => `<button type="button" class="d3m-d-fm-elo" data-fx="${k}" data-valor="${k === 'cartao-lado' ? u.lado : ''}">fechar</button>`;
    const formas = (u.colar ? M().folha({ titulo: 'Colar itens da fatura', dir: fechar('cartao-colar'), corpo: `<div class="d3m-d-fm-painel">${colarHtml(d)}</div>`, cls: 'd3m-d-fm-curta d3m-d-fm-segundo', rotulo: 'colar' }) : '')
      + (u.novo ? M().folha({ titulo: 'Novo item da fatura', dir: fechar('cartao-novo'), corpo: `<div class="d3m-d-fm-painel">${itemCampos(d, { fatura: u.fatura, data: `${u.fatura}-01`, status: 'em_aberto' })}</div>`, cls: 'd3m-d-fm-curta d3m-d-fm-segundo', rotulo: 'novo' }) : '');
    const painel = PAINEL[u.lado] ? M().folha({ titulo: PAINEL[u.lado][0], dir: vence && u.lado === 'vencimento' ? `esta vence ${esc(dataCurta(vence))} · ${fechar('cartao-lado')}` : fechar('cartao-lado'), corpo: `<div class="d3m-d-fm-painel">${PAINEL[u.lado][1]()}</div>`, cls: 'd3m-d-fm-curta d3m-d-fm-segundo', rotulo: u.lado === 'vencimento' ? 'vencimento' : u.lado }) : '';
    const COLS_S = [[48, 'Dia'], [28, ''], [0, 'No extrato'], [110, 'Valor', 'r'], [150, ''], [96, '']];
    const semFatura = soltos.length ? M().folha({ titulo: 'Pagamentos do cartão sem fatura', sub: `${n0(soltos.length)}, pelo extrato`, dir: `${esc(rs(pagoSolto))} no total`, cls: 'd3m-d-fm-curta d3m-d-fm-segundo', rotulo: 'soltos',
      corpo: soltos.map((p) => M().tr(COLS_S, [esc(dataCurta(p.data)), `<span class="d3m-d-fm-av">${ICV.cifrao}</span>`, esc(p.historico), esc(rs(p.valor)), '<span class="a">no extrato, sem fatura</span>', `<button type="button" class="fv2-btn s" data-fx="ir-lanc" data-valor="${esc(p.id)}" data-mes="${esc(p.data.slice(0, 7))}">No extrato</button>`])).join('') }) : '';
    const laranja = soltos.length ? M().laranja({ rot: 'pago sem saber o quê', num: n0(soltos.length), frase: soltos.length === 1 ? 'pagamento sem fatura' : 'pagamentos sem fatura', apoio: `${esc(rs(pagoSolto))} pagos no cartão sem os itens.`, bts: [['Colar a fatura', 'data-fx="cartao-colar"'], [soltos.length === 1 ? 'Ver' : `Ver os ${n0(soltos.length)}`, 'data-fx="foco" data-valor="soltos"']] })
      : semCat ? M().laranja({ rot: 'sem categoria', num: n0(semCat), frase: semCat === 1 ? 'item sem categoria' : 'itens sem categoria', apoio: `Na fatura de ${esc(soMes(u.fatura))}.`, bts: [[semCat === 1 ? 'Ver o item' : `Ver os ${n0(semCat)}`, 'data-fx="chip" data-alvo="cartao" data-valor="semcat"']] })
        : falta > 0 && vence && vence < (d.hoje || '') ? M().laranja({ rot: 'venceu sem pagar', num: esc(mil(falta)), frase: `faltam na fatura de ${esc(soMes(u.fatura))}`, apoio: `Venceu em ${esc(dataCurta(vence))}.`, bts: [['Ver no extrato', 'data-fx="ir-aba" data-valor="extrato" data-chip="saidas"']] }) : '';
    const vNome = Object.values(venc).find((x) => x != null && x !== '');
    return M().molde({ tela: 'fx-cartao', aba: 'cartao', titulo: 'Cartão de crédito', d, repintar,
      sub: `${esc(cartoes.join(' e ') || 'cartão da agência')} · fatura de ${esc(soMes(u.fatura))}, ${esc(vista)}`,
      ferr: M().setas(meses[meses.indexOf(u.fatura) - 1] ? `data-fx="mes" data-alvo="cartao" data-valor="${meses[meses.indexOf(u.fatura) - 1]}"` : '', meses[meses.indexOf(u.fatura) + 1] ? `data-fx="mes" data-alvo="cartao" data-valor="${meses[meses.indexOf(u.fatura) + 1]}"` : '', 'mês')
        + `<button type="button" class="d3m-d-vbtn" data-fx="cartao-lado" data-valor="vencimento" aria-expanded="${u.lado === 'vencimento'}">Vencimento: ${vence ? esc(dataCurta(vence)) : vNome ? 'dia ' + esc(vNome) : 'sem dia'}</button>`,
      acao: M().acao('Colar fatura', `data-fx="cartao-colar" aria-expanded="${Boolean(u.colar)}"`), laranja, nums, corpo: formas + principal + painel + semFatura });
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
    // Padrão V2 (prancha V2-M-Financas-Fixos): o molde. Os fixos do mês pelo dia no cartão principal (o que já saiu e o
    // que não apareceu), o "De olho" com o mês, o ano e a fatia do que entra; "Onde pesa" e "Parecem fixos" embaixo; o
    // laranja do Vorcaro só quando um fixo venceu e não saiu (ou, sem cadastro, quando o extrato mostra os prováveis).
    const faltam = a.fixos.filter((f) => !f.achado && f.vence <= hoje);
    const COLS = [[48, 'Dia'], [0, 'Gasto'], [150, 'No extrato'], [110, 'Valor', 'r'], [60, '', 'r']];
    const linhas = a.fixos.map((f) => {
      const editando = u.editando === f.id, naoVeio = !f.achado && f.vence <= hoje;
      const onde = f.achado ? `<span class="${f.diferenca > 0 ? 'a' : 'g'}">saiu em ${esc(dataCurta(f.achado.data))}${f.diferenca ? ` · ${f.diferenca > 0 ? '+' : '−'}${esc(rs(Math.abs(f.diferenca)))}` : ''}</span>` : naoVeio ? '<span class="r">não apareceu</span>' : `vence em ${esc(dataCurta(f.vence))}`;
      return `<div class="v2-abre d3m-d-fm-linha d3m-d-fm-alta fx-item${naoVeio ? ' d3m-d-fm-naoveio' : ''}" data-linha="${esc(f.id)}" aria-expanded="${editando}">${M().tr(COLS, [`<b>${String(f.dia).padStart(2, '0')}</b>`,
        `<span class="d3m-d-fm-nome"><b>${esc(f.nome)}</b><small>${esc(nomeCat(d, f.categoria))} · ${esc(FORMA_NOME[f.forma] || f.forma)}${f.observacao ? ` · ${esc(f.observacao)}` : ''}</small></span>`, onde, esc(rs(f.valor)),
        `<button type="button" class="d3m-d-fm-elo fx-editar" data-fx="fixo-editar" data-valor="${esc(f.id)}" aria-expanded="${editando}">${editando ? 'fechar' : 'editar'}</button>`])}
        <div class="v2-mais"><div>${editando ? `<div class="fv2-det d3m-d-fm-det fx-form-caixa">${fixoCampos(d, f)}</div>` : ''}</div></div></div>`;
    }).join('');
    const inativos = lista.filter((f) => !X().fixoVigente(f, u.mes));
    const edInativo = inativos.find((f) => f.id === u.editando);
    const pe = inativos.length ? `<div class="d3m-d-fm-pe"><details class="fx-det"><summary>${quantos(inativos.length, 'parado', 'parados')}</summary>${inativos.map((f) => `<div class="fx-mini"><span>${esc(f.nome)} · ${esc(rs(f.valor))}${f.fim ? ` · até ${esc(mesCurto(f.fim))}` : ''}</span><button type="button" class="fv2-link" data-fx="fixo-editar" data-valor="${esc(f.id)}">editar</button></div>`).join('')}</details></div>` : '';
    const corpo = (linhas || `<div class="d3m-d-fm-vazio"><p>Nenhum gasto fixo cadastrado.</p><button type="button" class="fv2-btn s d3f-escuro" data-fx="fixo-novo">Novo gasto fixo</button></div>`)
      + (edInativo ? `<div class="fv2-det d3m-d-fm-det fx-form-caixa">${fixoCampos(d, edInativo)}</div>` : '') + pe;
    const olho = a.quantidade ? M().olho([[esc(rs(a.total)), 'por mês'], [esc(rs(a.anual)), 'no ano'], [pct != null ? `${pct}%` : '0%', pct != null ? 'do que entra' : 'do que entra, sem média ainda']]) : '';
    const principal = M().folha({ titulo: `Fixos de ${soMes(u.mes)}`, sub: 'pelo dia', dir: a.quantidade ? `${n0(a.achados)} de ${n0(a.quantidade)} já ${a.achados === 1 ? 'saiu' : 'saíram'}` : '', cab: linhas ? M().cab(COLS) : '', corpo, olho, rotulo: 'fixos', cls: 'fx-fixos d3m-d-fm-curta' });
    const maxCat = Math.max(1, a.por_categoria[0]?.total || 1);
    const pesa = M().folha({ titulo: 'Onde pesa', dir: 'dos fixos', rotulo: 'pesa', corpo: `<div class="d3m-d-fm-painel d3m-d-fm-pesa">${a.por_categoria.map((c) => gx(esc(c.nome), c.total / maxCat * 100, esc(rs(c.total)), { fatia: c.pct })).join('') || '<p class="fv2-sub">Cadastre para ver.</p>'}</div>` });
    const COLS_P = [[0, ''], [100, '', 'r'], [80, '', 'r']];
    const parecem = M().folha({ titulo: 'Parecem fixos', sub: `${n0(provaveis.length)}, pelo extrato`, rotulo: 'provaveis', olho: provaveis.length ? '<p class="d3m-d-fm-nota">mesmo destino, valor parecido, 2 meses ou mais</p>' : '',
      corpo: provaveis.slice(0, 8).map((p, i) => M().tr(COLS_P, [`<b>${esc(p.nome)}</b> <small>· ${n0(p.meses)} meses, perto do dia ${n0(p.dia)}</small>`, esc(rs(p.valor)), `<button type="button" class="d3m-d-fm-elo d3f-voa" data-fx="fixo-provavel" data-valor="${i}">cadastrar</button>`])).join('') || '<p class="d3m-d-fm-vazio">Nada se repete no extrato.</p>' });
    const novo = u.novo ? M().folha({ titulo: 'Novo gasto fixo', dir: '<button type="button" class="d3m-d-fm-elo" data-fx="fixo-fechar">fechar</button>', corpo: `<div class="d3m-d-fm-painel">${fixoCampos(d, u.rascunho || {})}</div>`, cls: 'd3m-d-fm-curta d3m-d-fm-segundo', rotulo: 'novo' }) : '';
    const f0 = faltam[0];
    const laranja = f0 ? M().laranja({ rot: 'fixo que não apareceu', frase: faltam.length === 1 ? `${esc(f0.nome)} venceu dia ${n0(f0.dia)} e não saiu no extrato` : `${n0(faltam.length)} fixos venceram e não saíram no extrato`,
      apoio: faltam.length === 1 ? `São ${esc(rs(f0.valor))}. Pode ter sido pago por fora da conta.` : `${faltam.slice(0, 3).map((f) => esc(f.nome)).join(', ')}${faltam.length > 3 ? '…' : '.'}`,
      bts: [['Ver no extrato', 'data-fx="ir-aba" data-valor="extrato" data-chip="saidas"'], ['Lançar à mão', 'data-fx="ir-aba" data-valor="vorcaro" data-mao="pago"']] })
      : !lista.length && provaveis.length ? M().laranja({ rot: 'parecem fixos', num: n0(provaveis.length), frase: provaveis.length === 1 ? 'gasto parece fixo pelo extrato' : 'gastos parecem fixos pelo extrato', apoio: 'Cadastre para o Vorcaro avisar quando não saírem.', bts: [['Ver', 'data-fx="foco" data-valor="provaveis"']] }) : '';
    return M().molde({ tela: 'fx-fixos', aba: 'fixos', titulo: 'Gastos fixos', d, repintar,
      sub: `${esc(nomeMes(u.mes))} · ${quantos(a.quantidade, 'fixo', 'fixos')}${a.quantidade ? ` · ${esc(mil(a.total))} por mês` : ''}`,
      ferr: M().setas(meses[meses.indexOf(u.mes) - 1] ? `data-fx="mes" data-alvo="fixos" data-valor="${meses[meses.indexOf(u.mes) - 1]}"` : '', meses[meses.indexOf(u.mes) + 1] ? `data-fx="mes" data-alvo="fixos" data-valor="${meses[meses.indexOf(u.mes) + 1]}"` : ''),
      acao: M().acao('Novo gasto fixo', `data-fx="fixo-novo" aria-expanded="${Boolean(u.novo)}"`), laranja,
      corpo: novo + principal + `<div class="d3m-d-fm-par">${pesa}${parecem}</div>` });
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
    // Padrão V2 (prancha V2-M-Financas-Projecao): o molde. "Caixa mês a mês" (o gráfico, o realizado e o projetado) e
    // "Resultado por grupo" são duas abas do mesmo cartão; o "E se…" fica ao lado e muda na hora; o laranja do Vorcaro diz
    // onde o caixa chega no ritmo de hoje, com "Montar um cenário" e "Guardar o cenário".
    const horizonte = M().seg([3, 6, 12].map((n) => [`${n} meses`, `data-fx="horizonte" data-valor="${n}"`, u.horizonte === n]), 'Horizonte');
    if (!base || !base.meses_usados?.length) {
      return M().molde({ tela: 'fx-projecao', aba: 'projecao', titulo: 'Relatórios e projeção', d, repintar, sub: 'caixa realizado e projetado · sem mês fechado ainda', ferr: horizonte,
        corpo: M().folha({ titulo: 'Caixa mês a mês', corpo: '<div class="d3m-d-fm-vazio"><p>Sem mês fechado e conferido para projetar.</p><button type="button" class="fv2-btn s d3f-escuro" data-fx="ir-aba" data-valor="extrato">Ir ao extrato</button></div>', rotulo: 'caixa' }) });
    }
    const cen = cenarioAtual(d);
    const hoje = X().projetar(base, {}, u.horizonte), com = X().projetar(base, cen, u.horizonte);
    const mexeu = Boolean(cen.cortes.length || cen.economias.length || cen.clientes_novos.length || cen.clientes_perdidos.length || cen.gastos_novos.length || cen.ajuste_entradas_pct);
    const diff = Math.round((com.saldo_final - hoje.saldo_final) * 100) / 100, ultimo = hoje.meses[hoje.meses.length - 1]?.mes || '';
    const entra = sumObj(base.entradas_por_categoria), sai = sumObj(base.saidas_por_categoria);
    const usados = base.meses_usados.map((m) => soMes(m));
    const leg = `<span class="d3f-leg"><i></i>realizado</span><span class="d3f-leg proj"><i></i>como está</span>${mexeu ? '<span class="d3f-leg cen"><i></i>com o cenário</span>' : ''}`;
    const abas = M().fichas([{ nome: 'Caixa mês a mês', on: u.aba !== 'grupos', attrs: 'data-fx="proj-aba" data-valor="caixa"' }, { nome: 'Resultado por grupo', on: u.aba === 'grupos', attrs: 'data-fx="proj-aba" data-valor="grupos"' }], 'Abas do relatório');
    const corpoCaixa = `<div class="d3m-d-fm-painel d3m-d-fm-graf"><p class="d3m-d-fm-leg-graf">em mil reais ${leg}</p>${grafico(d, hoje, com, mexeu)}</div><p class="d3m-d-fm-rot">Realizado</p>${realizadoHtml(d)}<p class="d3m-d-fm-rot">Projetado</p><div class="d3m-d-fm-painel">${tabelaProj(hoje, com, mexeu)}</div>`;
    const relatorio = M().folha({ titulo: '', dir: abas, rotulo: 'caixa', cls: 'fx-caixa',
      corpo: u.aba === 'grupos' ? `<p class="d3m-d-fm-leg-graf">em mil reais, últimos 4 meses</p><div class="d3m-d-fm-painel">${dreHtml(d)}</div>` : corpoCaixa });
    const ese = M().folha({ titulo: 'E se…', dir: 'muda na hora · <button type="button" class="d3m-d-fm-elo" data-fx="cenario-limpar">limpar</button>', rotulo: 'cenario', cls: 'd3m-d-fm-ese',
      corpo: `<div class="d3m-d-fm-painel">${cenarioHtml(d, base)}</div>`,
      olho: mexeu ? M().olho([[esc(mil(com.saldo_final)), `com o cenário em ${esc(mes3(ultimo))}`, com.saldo_final < 0 ? 'r' : com.saldo_final >= hoje.saldo_final ? 'g' : 'a'], [`${diff >= 0 ? '+' : '−'}${esc(mil(Math.abs(diff)))}`, com.primeiro_mes_negativo ? `negativo em ${esc(mes3(com.primeiro_mes_negativo))}` : 'sem negativo']]) : '' });
    const laranja = M().laranja({ rot: hoje.primeiro_mes_negativo ? 'o caixa fica negativo' : 'no ritmo de hoje', num: mil(hoje.saldo_final).replace('R$ ', ''), frase: `reais em caixa em ${esc(soMes(ultimo))}`,
      apoio: `Entram ${esc(mil(entra))} e saem ${esc(mil(sai))} por mês.${hoje.primeiro_mes_negativo ? ` Negativo em ${esc(soMes(hoje.primeiro_mes_negativo))}.` : ''}`,
      bts: [['Montar um cenário', 'data-fx="foco" data-valor="cenario"'], ['Guardar', 'data-fx="cenario-focar" title="Guardar o cenário"']] });
    return M().molde({ tela: 'fx-projecao', aba: 'projecao', titulo: 'Relatórios e projeção', d, repintar,
      sub: `caixa realizado e projetado · média de ${usados.length > 1 ? `${esc(usados[0])} a ${esc(usados[usados.length - 1])}` : esc(usados[0])}`, ferr: horizonte, laranja,
      corpo: `<div class="d3m-d-fm-par d3m-d-fm-proj">${relatorio}${ese}</div>` });
  }
  // O realizado mês a mês (prancha V2-M-Financas-Projecao): entrou, saiu, resultado e o que falta conferir, em mil.
  function realizadoHtml(d) {
    const s = (d.serie || []).slice(-4);
    if (!s.length) return '<p class="d3m-d-fm-vazio">Sem extrato ainda.</p>';
    const COLS = [[0, ''], ...s.map(() => [90, '', 'r'])];
    const linha = (rot, f, cls = '') => M().tr(COLS, [rot, ...s.map((m) => { const v = f(m); return `<span class="${cls}${typeof v === 'number' && v < 0 ? ' r' : ''}">${typeof v === 'number' ? esc(emMil(v)) : esc(v)}</span>`; })]);
    return `<div class="d3m-d-fm-th">${COLS.map(([w], i) => `<span class="d3m-d-fm-c${w ? ' r' : ' f'}"${w ? ` style="--w:${w}px"` : ''}>${i ? esc(mes3(s[i - 1].mes)) : ''}</span>`).join('')}</div>`
      + linha('Entrou', (m) => m.entradas) + linha('Saiu', (m) => m.saidas + m.cartao) + linha('Resultado', (m) => m.resultado, 'b') + linha('A conferir', (m) => String(m.a_revisar || 0), 'q');
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
      <div class="d3f-eixo">${pontos.map((p, i) => `<${i === nReal - 1 ? 'b' : 'span'}${i >= nReal ? ' class="proj"' : ''}>${esc(mes3(p.mes))}<small>${esc(emMil(mexeu && i >= nReal ? p.com : p.saldo))}</small></${i === nReal - 1 ? 'b' : 'span'}>`).join('')}</div>`;
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
    // fin2: a mensalidade que pode já ter entrado (Pix ou boleto de cliente sem dizer de quem no mesmo mês) não conta como aberta.
    const incerto = new Map(); for (const i of d.analise?.aging?.itens || []) if (i.incerto) incerto.set(String(i.cliente_id), (incerto.get(String(i.cliente_id)) || 0) + i.valor);
    const abertos = (d.por_cliente?.linhas || []).map((l) => ({ ...l, total_aberto: Math.round((l.total_aberto - (incerto.get(String(l.cliente_id)) || 0)) * 100) / 100 })).filter((l) => l.total_aberto > 0).sort((a, b) => b.total_aberto - a.total_aberto);
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
      <section class="d3m-cons" aria-label="Banco"><div class="d3m-cons-cab"><b>Santander · conta PJ</b><span>${ultimaData ? `saldo de ${esc(dataCurta(ultimaData))}` : 'sem extrato'}</span></div>
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
        ${campo('Categoria', `<select name="categoria" class="fx-sel">${opcoesCat(d, ui.vorcaro.cat || 'a_classificar')}</select>`)}
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
  function cartaoPessoa(d, c, { semCombinado = false } = {}) {
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
      ${semCombinado ? '' : `<div class="fx-grade" data-fx-form="salario">${campo('Salário / pró-labore combinado', `<input name="valor" class="fx-in fx-num" inputmode="decimal" value="${c.salario ? esc(String(c.salario.valor).replace('.', ',')) : ''}" placeholder="por mês">`)}${campo('Desde', `<input name="desde" type="month" class="fx-in" value="${esc(c.salario?.desde || '')}">`)}
        <div class="fx-linha-acoes"><button type="button" class="fv2-btn s d3f-escuro v2-estado" data-fx="pessoa-salario" data-valor="${esc(c.pessoa_id)}">Salvar combinado</button></div></div>`}
      <div class="fx-pm-rolo">${tabela}</div>
      <p class="fv2-sub fx-legenda">Vale = o que passou do combinado (a pessoa deve à Vybe). Quando recebe menos que o combinado, a diferença abate o vale; sem vale, fica a pagar à pessoa.</p>
      <h3 class="fx-h3">Pix que compõem</h3>${pix}
      <h3 class="fx-h3">Devolveu ou abateu à mão</h3>${ajustes.map((a) => `<div class="fx-mini"><span>${esc(mesCurto(a.mes))} · ${a.tipo === 'abater' ? 'abatido' : a.tipo === 'descontar' ? 'desconto no salário (planejado)' : 'devolveu'}${a.nota ? ' · ' + esc(a.nota) : ''}</span><b>${esc(rs(a.valor))}</b><button type="button" class="fv2-link" data-fx="pessoa-ajuste-tirar" data-valor="${esc(a.id)}">desfazer</button></div>`).join('') || '<p class="fv2-sub">Nenhum.</p>'}
      <div class="fx-linha-acoes"><button type="button" class="fv2-btn s" data-fx="pessoa-ajuste-abrir" data-valor="${esc(c.pessoa_id)}" aria-expanded="${ui.vales.ajuste === c.pessoa_id}">Devolveu / abater</button></div>${formAjuste}</div>`;
  }
  function vales(ctx) {
    anfitriao = ctx;
    const d = ctx.d, u = ui.vales, contas = d.contas_pessoas || [];
    const comVale = contas.filter((c) => c.vale > 0), aPagar = contas.filter((c) => c.a_pagar > 0), semComb = contas.filter((c) => !c.salario?.valor);
    const totalVale = comVale.reduce((s, c) => s + c.vale, 0), totalPagar = aPagar.reduce((s, c) => s + c.a_pagar, 0);
    // Padrão V2 (prancha V2-M-Financas-Vales): o molde com três números, as pessoas no cartão principal (combinado, pago
    // no mês, a pagar e o vale; a linha abre com a conta da pessoa) e, vazio, os três passos. O laranja só com vale.
    const pessoasSemComb = semComb.length + (d.pessoas || []).filter((p) => !contas.some((c) => c.pessoa_id === String(p.id))).length;
    const nums = [M().num({ rotulo: 'Em vale', ic: ICV.cifrao, valor: esc(mil(totalVale)), tom: totalVale ? 'r' : '', sub: comVale.length ? quantos(comVale.length, 'pessoa', 'pessoas') : 'nenhuma pessoa' }),
      M().num({ rotulo: 'A pagar às pessoas', selo: 'negocio', ic: ICV.relogio, valor: esc(mil(totalPagar)), sub: aPagar.length ? quantos(aPagar.length, 'pessoa', 'pessoas') : 'nenhuma pessoa' }),
      M().num({ rotulo: 'Sem combinado', selo: pessoasSemComb ? 'a' : '', ic: ICV.alerta, valor: n0(pessoasSemComb), sub: pessoasSemComb === 1 ? 'pessoa com o salário não informado' : 'pessoas com o salário não informado' })].join('');
    const vis = contas.filter((c) => (u.chip === 'vale' ? c.vale > 0 : u.chip === 'semcomb' ? !c.salario?.valor : true));
    const ultimo = (c) => c.meses[c.meses.length - 1] || {};
    const COLS = [[28, ''], [0, 'Pessoa'], [170, 'Pago no mês'], [130, 'A pagar', 'r'], [130, 'Vale', 'r']];
    const corpo = vis.map((c) => {
      const aberta = u.aberta === c.pessoa_id, m = ultimo(c);
      return `<div class="v2-abre d3m-d-fm-linha" data-linha="${esc(c.pessoa_id)}" aria-expanded="${aberta}">${M().tr(COLS, [M().av(c.nome),
        `<button type="button" class="d3m-d-fm-nome" data-fx="abrir" data-alvo="vales" data-valor="${esc(c.pessoa_id)}" aria-expanded="${aberta}"><b>${esc(c.nome)}</b> <small>· ${c.salario?.valor ? esc(rs(c.salario.valor)) + ' por mês' : 'sem combinado'}</small></button>`,
        `${esc(rs(m.pago || 0))}${m.mes ? ` <small>em ${esc(mes3(m.mes))}</small>` : ''}`, c.a_pagar ? `<span class="a">${esc(rs(c.a_pagar))}</span>` : '<span class="q">nada</span>',
        c.vale ? `<b class="r">${esc(rs(c.vale))}</b>` : '<span class="q">sem vale</span>'])}
        <div class="v2-mais"><div>${aberta ? cartaoPessoa(d, c) : ''}</div></div></div>`;
    }).join('');
    const passos = [['Diga o combinado', 'O salário de cada pessoa, uma vez.'], ['Atribua os Pix', 'No extrato, diga para quem foi cada um.'], ['O que passar vira vale', 'E o que faltar aparece como a pagar.']]
      .map(([t, s], i) => `<div class="d3m-d-fm-passo"><span class="d3m-d-fm-passo-n">${i + 1}</span><b>${t}</b><small>${s}</small></div>`).join('');
    const vazioH = !contas.length ? `<div class="d3m-d-fm-vazio d3m-d-fm-vazio-alto"><span class="d3m-d-fm-vazio-ic" aria-hidden="true">${ICV.cifrao}</span><p><b>Ninguém aqui ainda</b>Nenhum Pix foi atribuído a alguém do time. Quando for, cada pessoa aparece com o combinado, o que recebeu e o vale.</p><span class="d3m-d-fm-vazio-bts"><button type="button" class="fv2-btn s d3f-escuro" data-fx="ir-aba" data-valor="extrato">Ir ao extrato</button><button type="button" class="fv2-btn s" data-fx="vales-combinado">Informar um combinado</button></span></div>` : '';
    const semConta = (d.pessoas || []).filter((p) => !contas.some((c) => c.pessoa_id === String(p.id)));
    const combinado = u.combinado ? M().folha({ titulo: 'Informar o combinado', sub: semConta.length ? quantos(semConta.length, 'pessoa sem conta', 'pessoas sem conta') : '', dir: '<button type="button" class="d3m-d-fm-elo" data-fx="vales-combinado">fechar</button>', cls: 'd3m-d-fm-curta d3m-d-fm-segundo', rotulo: 'combinado',
      corpo: `<div class="d3m-d-fm-painel">${semConta.map((p) => `<div class="fx-mini" data-fx-form="salario"><span>${esc(p.nome)}</span><input name="valor" class="fx-in fx-num" inputmode="decimal" placeholder="combinado" aria-label="Combinado de ${esc(p.nome)}"><input name="desde" type="month" class="fx-in" aria-label="Desde"><button type="button" class="fv2-btn s v2-estado" data-fx="pessoa-salario" data-valor="${esc(p.id)}">Salvar</button></div>`).join('') || '<p class="fv2-sub">Todo o time já tem conta; o combinado se muda na linha da pessoa.</p>'}</div>` }) : '';
    const fichas = M().fichas([['todos', 'Todos', contas.length], ['vale', 'Com vale', comVale.length, 'r'], ['semcomb', 'Sem combinado', semComb.length, 'a']]
      .map(([k, nome, n, tom]) => ({ nome, n, tom: n ? tom : '', on: u.chip === k, attrs: `data-fx="chip" data-alvo="vales" data-valor="${k}"` })), 'Filtrar as pessoas');
    const principal = M().folha({ titulo: 'Por pessoa', sub: 'combinado, pago e vale', dir: fichas, cab: corpo ? M().cab(COLS) : '', rotulo: 'pessoas',
      corpo: corpo || vazioH || '<p class="d3m-d-fm-vazio">Ninguém com esse filtro.</p>', olho: contas.length ? '' : `<div class="d3m-d-fm-passos">${passos}</div>` });
    const maior = comVale.slice().sort((a, b) => b.vale - a.vale)[0];
    const laranja = maior ? M().laranja({ rot: 'em vale', num: esc(mil(totalVale)), frase: comVale.length === 1 ? 'em vale de uma pessoa' : `em vale de ${n0(comVale.length)} pessoas`,
      apoio: `O maior é ${esc(maior.nome)}, com ${esc(rs(maior.vale))}. Vale é o que passou do combinado.`, bts: [['Ver quem', 'data-fx="chip" data-alvo="vales" data-valor="vale"'], [`Abrir ${maior.nome}`, `data-fx="abrir" data-alvo="vales" data-valor="${esc(maior.pessoa_id)}"`]] }) : '';
    return M().molde({ tela: 'fx-vales', aba: 'vales', titulo: 'Pessoas e vales', d, repintar,
      sub: `${esc(nomeMes((d.hoje || '').slice(0, 7)))} · ${contas.length ? quantos(contas.length, 'pessoa com conta', 'pessoas com conta') : 'nenhum Pix atribuído ao time ainda'}`,
      acao: M().acao('Informar combinado', `data-fx="vales-combinado" aria-expanded="${Boolean(u.combinado)}"`), laranja, nums, corpo: combinado + principal });
  }
  // Abrir a conta de uma pessoa de outra tela (RH › Folha).
  function abrirPessoa(id) { ui.vales.aberta = String(id || ''); ui.fe.pes.sel = ui.vales.aberta; window.VybeComercial?.abrir?.('fin_pessoas', { abas: ['fin_pessoas'], rotulo: 'Finanças' }); }
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
      r.onload = () => ok(new Uint8Array(r.result || new ArrayBuffer(0)));
      r.onerror = () => falha(new Error('Não consegui abrir o arquivo. Escolha de novo.'));
      r.readAsArrayBuffer(arquivo);
    });
  }
  // Importar extrato (Paulo, 27/11/2026: "não aconteceu nada"). De qualquer botão (Hoje, Movimento, Extrato parado),
  // na hora aparece "Lendo o extrato…" por cima da tela; depois a prévia ou o erro, no mesmo lugar. Nenhum caminho
  // termina em silêncio: arquivo vazio, formato desconhecido, Excel antigo e falta de rede viram frase clara.
  const erroDeRede = (e) => (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(e?.message || '') ? 'Não consegui falar com o servidor agora. Confira a internet e tente de novo.' : e?.message || 'Não deu para ler o extrato.');
  async function previa(arquivo) {
    const u = ui.extrato;
    u.previa = null; u.csv = ''; u.nomeArquivo = arquivo.name || ''; u.lendo = true; repintar();
    try {
      // UTF-8 quando o arquivo é UTF-8; senão Windows-1252 (o CSV e o OFX dos bancos costumam vir assim); o .xlsx vira CSV.
      const texto = await X().textoDoExtrato(await lerArquivo(arquivo), arquivo.name || '');
      u.previa = await post({ acao: 'previa', csv: texto });
      u.csv = texto;
    } catch (e) { u.previa = { erro: erroDeRede(e) }; u.csv = ''; }
    u.lendo = false; repintar();
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
        b.textContent = 'Importando…';
        const naFe = Boolean(b.closest('.fe'));
        let r;
        try { r = await post({ acao: 'importar', csv: ue.csv }); }
        catch (e) { ue.previa = { ...ue.previa, falhou: erroDeRede(e) }; return repintar(); }
        const imp = r.importado || {};
        ue.previa = null; ue.csv = '';
        try { await anfitriao.recarregar?.(); } catch { /* gravou; a tela recarrega na próxima abertura */ }
        avisar(`Entraram ${quantos(imp.novas || 0, 'lançamento novo', 'lançamentos novos')}${imp.repetidas ? ` (${n0(imp.repetidas)} já estavam)` : ''}. Confira em Movimento.`, 'success');
        ue.chip = 'conferir'; ue.mes = '';
        // Leva ao Movimento no filtro "conferir", no mês do último dia que chegou.
        if (naFe) { feDe('fin_movimento', { chip: 'conferir', mes: String(imp.ate || '').slice(0, 7) }); feAbrir('fin_movimento'); }
        repintar();
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
        const r = await gravar({ acao: 'vale_ajuste_salvar', ajuste: { pessoa_id: valor, mes: v.mes, tipo: v.tipo, valor: numero(v.valor), nota: v.nota } }, v.tipo === 'descontar' ? `Desconto guardado para o salário de ${soMes(v.mes)}.` : 'Lançado no vale.');
        if (r) { ui.vales.ajuste = ''; ui.fe.pes.desconto = ''; repintar(); } else voltou(b); return;
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
      // Cartão V2: por categoria, pagamentos e o vencimento atrás de botões, um por vez.
      case 'vales-combinado': ui.vales.combinado = !ui.vales.combinado; return repintar();
      case 'cartao-lado': ui.cartao.lado = ui.cartao.lado === valor ? '' : valor; return repintar();
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
      // Projeção V2: Caixa mês a mês e Resultado por grupo são duas abas do mesmo cartão.
      case 'proj-aba': ui.projecao.aba = valor === 'grupos' ? 'grupos' : 'caixa'; return repintar();
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
        // As telas de antes viram um lugar das cinco (FE_DE): o chip, a categoria e o mês vêm junto.
        const nova = feDe(valor, b.dataset);
        if (nova) return feAbrir(nova);
        if (valor === 'extrato') { ue.chip = b.dataset.chip || (b.dataset.cat ? 'todos' : ue.chip); ue.cat = b.dataset.cat || ''; if (b.dataset.mes) ue.mes = b.dataset.mes; ue.aberta = ''; }
        if (valor === 'clientes_mes' && b.dataset.chip) ui.clientes_mes.chip = b.dataset.chip;
        if (valor === 'vorcaro' && b.dataset.mao) abrirLancarMao({ status: b.dataset.mao });
        const el = document.querySelector(`.vv-trilho [data-submodulo="${valor}"]`);
        if (el && el.getClientRects().length) el.click(); else window.VybeComercial?.abrir?.(valor, { abas: [valor], rotulo: 'Finanças' });
        return;
      }
      case 'mao-abrir': ui.vorcaro.mao = !ui.vorcaro.mao; ui.vorcaro.cat = ''; ui.fe.pes.variavel = false; return repintar();
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
        if (r) { ui.vorcaro.mao = false; ui.vorcaro.status = ''; ui.vorcaro.cat = ''; ui.fe.pes.variavel = false; repintar(); } else voltou(b);
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
    if (c.startsWith('fn-') && aoMudarFin(t)) return;
    const cen = ui.projecao.cenario, i = Number(t.dataset.valor);
    switch (c) {
      case 'fe-per-de': ui.fe.per.de = t.value; return repintar();
      case 'fe-per-ate': ui.fe.per.ate = t.value; return repintar();
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

  // =====================================================================================================
  // FINANÇAS EM 5 TELAS (Paulo, 23/11/2026: "muita ABA com muita coisa espalhada"; quadro aprovado "Finanças enxuto",
  // claude.ai/artifact/PHtvV6fLj1ToPDqRaH9Ber). Hoje, Movimento, Clientes, Pessoas e Análise no lugar das 11 de antes:
  // um mês só no topo vale para as cinco, todo número leva à lista que explica ele e o que se clica abre a ficha na
  // lateral. Os editores, as contas e as ações (data-fx) são os das telas de antes; só o esqueleto é novo.
  //   Hoje       o Vorcaro no topo, saldo/entrou/saiu/resultado, o caixa e os 3 meses, o que pede atenção, para onde foi
  //   Movimento  extrato, cartão, fixos, previsto e o baralho de conferir (o que chegou do grupo entra na mesma fila)
  //   Clientes   cliente × mês com a margem real e a ficha (dia em que pagou, lançamentos dele)
  //   Pessoas    combinado × recebeu × vale, e o desconto do vale no salário seguinte (quanto a pessoa vai receber)
  //   Análise    fôlego, fixo ÷ entrada, concentração, resultado por grupo e o "E se…" com o caixa projetado
  // O desenho mora em padrao-v2/zz-financas-5telas.css (peças .fe-*).
  // =====================================================================================================
  const FE_ABAS = [['fin_hoje', 'Hoje'], ['fin_movimento', 'Movimento'], ['fin_clientes', 'Clientes'], ['fin_pessoas', 'Pessoas'], ['fin_assinaturas', 'Assinaturas'], ['fin_analise', 'Análise'], ['fin_projecao', 'Projeção'], ['fin_fechamento', 'Fechamento']];
  // As telas de antes viram um lugar das cinco (links do Vorcaro, do RH, da Gestão e as abas antigas guardadas no dock).
  const FE_DE = { vorcaro: 'fin_hoje', extrato: 'fin_movimento', cartao: 'fin_movimento', fixos: 'fin_movimento', recebimentos: 'fin_movimento', contas: 'fin_movimento',
    clientes_mes: 'fin_clientes', financas: 'fin_clientes', inadimplencia: 'fin_clientes', vales: 'fin_pessoas', projecao: 'fin_projecao' };
  const FE_CHIP = { cartao: 'cartao', fixos: 'fixos', recebimentos: 'entradas', contas: 'previsto' };
  ui.fe = { mes: '', per: { k: '6', de: '', ate: '' }, hud: '', chip: 'conferir', grupo: '', pular: [], lado: '', cli: { chip: 'todos', sel: '' }, pes: { sel: '', desconto: '' } };
  const feMeses = (d) => [...new Set([...(d.meses || []), (d.hoje || '').slice(0, 7)].filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort();
  function feIniciar(ctx) {
    anfitriao = ctx;
    const d = ctx.d, meses = feMeses(d);
    if (!meses.includes(ui.fe.mes)) ui.fe.mes = d.mes && meses.includes(d.mes) ? d.mes : meses[meses.length - 1] || '';
    // As telas de antes leem o mês delas: o mês do topo vale para todas.
    ui.extrato.mes = ui.fe.mes; ui.cartao.fatura = ui.fe.mes; ui.fixos.mes = ui.fe.mes;
    contarFin(d);
    return d;
  }
  const feBtn = (texto, attrs, cls = '') => `<button type="button" class="fe-btn${cls ? ' ' + cls : ''}" ${attrs}>${texto}</button>`;
  const feCard = (titulo, corpo, { dir = '', cls = '', rotulo = '' } = {}) => `<section class="fe-card${cls ? ' ' + cls : ''}"${rotulo ? ` data-fx-card="${rotulo}"` : ''}>${titulo || dir ? `<div class="fe-card-cab">${titulo ? `<h2 class="fe-rot">${esc(titulo)}</h2>` : ''}${dir ? `<span class="fe-dir">${dir}</span>` : ''}</div>` : ''}${corpo}</section>`;
  const feChips = (lista, rotulo) => `<div class="fe-chips" role="group" aria-label="${esc(rotulo)}">${lista.map(([k, nome, n, attrs, on]) => `<button type="button" class="fe-chip" ${attrs} aria-pressed="${Boolean(on)}">${esc(nome)}${n != null ? `<b>${n0(n)}</b>` : ''}</button>`).join('')}</div>`;
  const feTag = (t, tom = '') => `<span class="fe-tag${tom ? ' ' + tom : ''}">${esc(t)}</span>`;
  const feNum = ({ rot, valor, sub = '', attrs = '', tom = '' }) => `<${attrs ? `button type="button" ${attrs}` : 'div'} class="fe-num"><span class="fe-rot">${esc(rot)}</span><b class="fe-v${tom ? ' ' + tom : ''}">${valor}</b><span class="fe-sub">${sub}</span></${attrs ? 'button' : 'div'}>`;
  const feIr = (aba, extra = '') => `data-fx="ir-aba" data-valor="${aba}"${extra ? ' ' + extra : ''}`;
  const feArquivo = (cls = 'fe-btn s') => `<label class="${cls} fx-arquivo">Importar extrato<input type="file" accept="${ACEITA_EXTRATO}" data-fx-arquivo hidden></label>`;
  // O laranja (o único cartão cheio da tela): o Vorcaro, a frase e um botão.
  const feLaranja = (frase, botao = '') => `<section class="fe-lar" aria-label="Vorcaro · Tesouraria"><span class="fe-lar-av" aria-hidden="true">V</span><div class="fe-lar-txt"><small>Vorcaro · Tesouraria</small><p>${frase}</p></div>${botao}</section>`;
  // A linha do caixa: o realizado cheio e o que vem tracejado, com a linha do zero quando passa dela.
  function feLinha(real, proj, { rotulo = '', alto = 190, tom = '' } = {}) {
    const pts = [...real.map((p) => ({ ...p, r: 1 })), ...proj];
    if (!pts.length) return '<p class="fe-vazio">Sem mês no extrato ainda.</p>';
    const W = alto < 150 ? 360 : 600, H = alto, pad = 22, vals = pts.flatMap((p) => [p.v, p.c]).filter((v) => v != null);
    const min = Math.min(0, ...vals), max = Math.max(0, ...vals);
    const x = (i) => pad + (pts.length === 1 ? (W - 2 * pad) / 2 : i * (W - 2 * pad) / (pts.length - 1));
    const y = (v) => H - 30 - ((v - min) / ((max - min) || 1)) * (H - 56);
    const linha = (l) => l.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
    const nR = real.length;
    const cheio = real.map((p, i) => [x(i), y(p.v)]);
    const trac = pts.map((p, i) => (i >= nR - 1 && i >= 0 ? [x(i), y(p.v)] : null)).filter(Boolean);
    const cen = pts.some((p) => p.c != null) ? pts.map((p, i) => (i === nR - 1 ? [x(i), y(p.v)] : i >= nR ? [x(i), y(p.c)] : null)).filter(Boolean) : [];
    const ult = cheio[cheio.length - 1], fimP = pts[pts.length - 1];
    return `<svg class="fe-graf d3-graf${tom ? ' ' + tom : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo)}">
      ${min < 0 ? `<line class="fe-zero" x1="${pad}" x2="${W - pad}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/><text class="fe-zero-t" x="${W - pad}" y="${(y(0) - 6).toFixed(1)}" text-anchor="end">zero</text>` : ''}
      ${trac.length > 1 ? `<polyline class="fe-trac" points="${linha(trac)}"/>` : ''}${cen.length > 1 ? `<polyline class="fe-cen" points="${linha(cen)}"/>` : ''}
      ${cheio.length > 1 ? `<polyline class="fe-cheia" points="${linha(cheio)}"/>` : ''}
      ${ult ? `<circle class="fe-pt" cx="${ult[0].toFixed(1)}" cy="${ult[1].toFixed(1)}" r="5"/><text class="fe-pt-t" x="${ult[0].toFixed(1)}" y="${(ult[1] - 12).toFixed(1)}" text-anchor="middle">${esc(mil(real[nR - 1].v))}</text>` : ''}
      ${proj.length ? `<circle class="fe-fim" cx="${x(pts.length - 1).toFixed(1)}" cy="${y(fimP.c ?? fimP.v).toFixed(1)}" r="5"/>` : ''}
      ${proj.length ? `<text class="fe-fim-t${(fimP.c ?? fimP.v) < 0 ? ' r' : ''}" x="${x(pts.length - 1).toFixed(1)}" y="${(y(fimP.c ?? fimP.v) + ((fimP.c ?? fimP.v) < 0 ? 18 : -12)).toFixed(1)}" text-anchor="end">${esc(mes3(fimP.mes))}: ${esc(mil(fimP.c ?? fimP.v))}</text>` : ''}
      ${pts.map((p, i) => `<text class="fe-eixo" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(mes3(p.mes))}</text>`).join('')}
    </svg>`;
  }
  // A casca das cinco: marca, as abas, o mês (vale para todas) e o "Como funciona"; dentro, a tela.
  function feCasca(aba, d, corpo) {
    const meses = feMeses(d), i = meses.indexOf(ui.fe.mes), antes = meses[i - 1] || '', depois = meses[i + 1] || '';
    const abas = FE_ABAS.map(([a, n]) => `<button type="button" class="fe-aba" ${feIr(a)}${a === aba ? ' aria-current="page"' : ''}>${esc(n)}</button>`).join('');
    return `<div class="fx fv2 d3f fe d3-tema" data-tela="fe-${aba}"><header class="fe-topo">
      <div class="fe-marca"><span class="fe-ic" aria-hidden="true">${ICV.cifrao}</span><h1>Finanças</h1>${SELO}</div>
      <nav class="fe-abas" aria-label="Telas de Finanças">${abas}</nav>
      <div class="fe-mes" role="group" aria-label="Mês"><button type="button" class="fe-ico" data-fx="fe-mes" data-valor="${antes}" aria-label="Mês anterior"${antes ? '' : ' disabled'}>${SETA.esq}</button><b aria-live="polite">${esc(nomeMes(ui.fe.mes) || 'sem extrato')}</b><button type="button" class="fe-ico" data-fx="fe-mes" data-valor="${depois}" aria-label="Próximo mês"${depois ? '' : ' disabled'}>${SETA.dir}</button></div>
      <button type="button" class="fe-ico" data-v2="ajuda" aria-label="Como funciona" title="Como funciona">${ICV.ajuda}</button><button type="button" class="fe-ico" data-vc="fechar" aria-label="Fechar" title="Fechar (Esc)">${IC_FECHAR}</button></header>${corpo}${importacaoPorCima(d)}</div>`;
  }
  const grupoDe = (d, cat) => (categorias(d).find((c) => c.id === cat) || {}).grupo || 'Outros';
  // As saídas do mês por grupo (Pessoas, Sócios, Estrutura…), do maior para o menor.
  function saidasPorGrupo(d, r) {
    const g = new Map();
    for (const c of r.categorias || []) if (c.total < 0) g.set(grupoDe(d, c.categoria), (g.get(grupoDe(d, c.categoria)) || 0) - c.total);
    return [...g].map(([grupo, total]) => ({ grupo, total })).sort((a, b) => b.total - a.total);
  }
  const ultimoSaldo = (lista) => lista.filter((t) => t.banco.saldo != null).sort((a, b) => a.banco.data.localeCompare(b.banco.data)).slice(-1)[0] || null;

  // ---------- HOJE ----------
  // ---------- GRÁFICOS DO HOJE (Paulo, 24/11/2026: "sinto falta de gráficos… linhas com comparativo… pizza com gastos") ----------
  // Linhas: várias séries no mesmo eixo (um eixo só), grade discreta, rótulo na ponta, legenda em cima, dica ao passar o
  // mouse (data-tip) e a tabela escondida para leitor de tela. Séries: { nome, cls, vals, trac }.
  const eixoMil = (v) => (!v ? '0' : Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : Math.round(v).toLocaleString('pt-BR'));
  function feLinhas(rotX, series, { rotulo = '', alto = 210, fmt = mil, marcarX = -1 } = {}) {
    const n = rotX.length, todos = series.flatMap((s) => s.vals).filter((v) => v != null);
    if (!n || !todos.length) return '<p class="fe-vazio">Sem dado para desenhar ainda.</p>';
    const W = 600, H = alto, pe = 44, pd = 64, pt = 14, pb = 26;
    const max = Math.max(1, ...todos), min = Math.min(0, ...todos);
    const passo = (() => { const bruto = (max - min) / 3, p10 = 10 ** Math.floor(Math.log10(bruto || 1)); return [1, 2, 2.5, 5, 10].map((k) => k * p10).find((k) => k >= bruto) || bruto; })();
    const topo = Math.ceil(max / passo) * passo, base = Math.floor(min / passo) * passo;
    const x = (i) => pe + (n === 1 ? (W - pe - pd) / 2 : i * (W - pe - pd) / (n - 1));
    const y = (v) => pt + (1 - (v - base) / ((topo - base) || 1)) * (H - pt - pb);
    const grade = []; for (let v = base; v <= topo + 1e-6; v += passo) grade.push(v);
    const pontos = (s) => s.vals.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    const cada = (s) => { const p = pontos(s); if (!p.length) return '';
      const fim = p[p.length - 1], iFim = s.vals.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0).pop();
      return `${p.length > 1 ? `<polyline class="fe-ln ${s.cls}${s.trac ? ' trac' : ''}" points="${p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}"/>` : ''}
        <circle class="fe-ln-pt ${s.cls}" cx="${fim[0].toFixed(1)}" cy="${fim[1].toFixed(1)}" r="4.5"/>
        <text class="fe-ln-t" x="${(fim[0] + 8).toFixed(1)}" y="${(fim[1] + 4).toFixed(1)}">${esc(fmt(s.vals[iFim]))}</text>`; };
    // Os rótulos da ponta não se encostam: quando ficam a menos de 14px, o de baixo desce.
    const fins = series.map((s) => { const p = pontos(s); return p.length ? p[p.length - 1][1] : null; });
    const ordem = fins.map((v, i) => [v, i]).filter(([v]) => v != null).sort((a, b) => a[0] - b[0]);
    for (let k = 1; k < ordem.length; k++) if (ordem[k][0] - ordem[k - 1][0] < 14) ordem[k][0] = ordem[k - 1][0] + 14;
    const desloc = new Map(ordem.map(([v, i]) => [i, v - fins[i]]));
    const larg = n > 1 ? (W - pe - pd) / (n - 1) : W - pe - pd;
    const alvos = rotX.map((r, i) => `<rect class="fe-hv-alvo" x="${(x(i) - larg / 2).toFixed(1)}" y="0" width="${larg.toFixed(1)}" height="${H - pb}" data-i="${i}" data-x="${x(i).toFixed(1)}"
      data-tip="${esc([r.longo || r.curto, ...series.map((s) => `${s.nome}: ${s.vals[i] == null ? '—' : rs(s.vals[i])}`)].join('\n'))}"/>`).join('');
    const passoX = Math.max(1, Math.ceil(n / 8));
    const svg = `<svg class="fe-graf d3-graf fe-lns" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo)}">
      ${grade.map((v) => `<line class="fe-grade" x1="${pe}" x2="${W - pd + 8}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="fe-eixo" x="${pe - 8}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${esc(eixoMil(v))}</text>`).join('')}
      ${marcarX >= 0 ? `<line class="fe-hoje-x" x1="${x(marcarX).toFixed(1)}" x2="${x(marcarX).toFixed(1)}" y1="${pt}" y2="${H - pb}"/>` : ''}
      ${series.map((s, i) => cada(s).replace(/<text class="fe-ln-t" x="([\d.]+)" y="([\d.-]+)"/, (m, a, b) => `<text class="fe-ln-t" x="${a}" y="${(Number(b) + (desloc.get(i) || 0)).toFixed(1)}"`)).join('')}
      ${rotX.map((r, i) => (i % passoX === 0 || i === n - 1 ? `<text class="fe-eixo" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(r.curto)}</text>` : '')).join('')}
      <line class="fe-cruz" x1="0" x2="0" y1="${pt}" y2="${H - pb}" hidden/>${alvos}</svg>`;
    const leg = `<div class="fe-leg-ln" aria-hidden="true">${series.map((s) => `<span><i class="${s.cls}${s.trac ? ' trac' : ''}"></i>${esc(s.nome)}</span>`).join('')}</div>`;
    const tabela = `<table class="fv2-sr"><caption>${esc(rotulo)}</caption><tr><th scope="col"></th>${series.map((s) => `<th scope="col">${esc(s.nome)}</th>`).join('')}</tr>${rotX.map((r, i) => `<tr><th scope="row">${esc(r.longo || r.curto)}</th>${series.map((s) => `<td>${s.vals[i] == null ? '—' : esc(rs(s.vals[i]))}</td>`).join('')}</tr>`).join('')}</table>`;
    return `${leg}<div class="fe-hv">${svg}<div class="fe-tip" hidden></div></div>${tabela}`;
  }
  // Rosca dos gastos: até 6 grupos com cor própria e o resto em "Outros" (cinza). A legenda ao lado traz nome, valor e %
  // e abre o Movimento daquele grupo. As cores seguem o grupo, não a posição: o mesmo grupo tem a mesma cor todo mês.
  const FE_COR_GRUPO = ['Pessoas', 'Sócios', 'Estrutura', 'Operação', 'Cartão', 'Empréstimos', 'Impostos', 'Banco', 'Outros'];
  function feRosca(grupos, { rotulo = '', sub = 'saiu no mês' } = {}) {
    const tot = grupos.reduce((s, g) => s + g.total, 0);
    if (!tot) return '<p class="fe-vazio">Nenhuma saída neste mês.</p>';
    const top = grupos.slice(0, 6), resto = grupos.slice(6).reduce((s, g) => s + g.total, 0);
    const fatias = [...top.map((g) => ({ ...g, cor: 'c' + ((Math.max(0, FE_COR_GRUPO.indexOf(g.grupo)) % 6) + 1) })), ...(resto ? [{ grupo: 'Demais grupos', total: resto, cor: 'c0', outros: true }] : [])];
    const hud = (f) => `data-fx="fe-hud" data-valor="${esc(f.outros ? '__resto' : f.grupo)}"`;
    // Cores únicas dentro da rosca: se dois grupos caírem na mesma, o segundo pega a primeira livre.
    const usadas = new Set(); for (const f of fatias) { if (f.cor === 'c0') continue; if (usadas.has(f.cor)) f.cor = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].find((c) => !usadas.has(c)) || 'c0'; usadas.add(f.cor); }
    const R = 70, r = 46, C = 90; let ang = -Math.PI / 2;
    const arco = (a0, a1) => { const g = a1 - a0 > Math.PI ? 1 : 0, p = (rr, a) => `${(C + rr * Math.cos(a)).toFixed(2)},${(C + rr * Math.sin(a)).toFixed(2)}`;
      return `M${p(R, a0)} A${R},${R} 0 ${g} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${g} 0 ${p(r, a0)} Z`; };
    const fatia = fatias.map((f) => { const a0 = ang, a1 = ang + (f.total / tot) * Math.PI * 2; ang = a1;
      const d = fatias.length === 1 ? `M${C},${C - R} A${R},${R} 0 1 1 ${C - 0.01},${C - R} L${C - 0.01},${C - r} A${r},${r} 0 1 0 ${C},${C - r} Z` : arco(a0, a1);
      return `<path class="fe-fatia ${f.cor}" d="${d}" ${hud(f)} data-tip="${esc(`${f.grupo}\n${rs(f.total)} · ${Math.round(f.total / tot * 100)}%`)}"/>`; }).join('');
    const svg = `<div class="fe-hv fe-rosca-g"><svg class="fe-graf d3-graf fe-rosca" viewBox="0 0 180 180" role="img" aria-label="${esc(rotulo)}">${fatia}
      <text class="fe-rosca-v" x="${C}" y="${C + 2}" text-anchor="middle">${esc(mil(tot))}</text><text class="fe-rosca-s" x="${C}" y="${C + 18}" text-anchor="middle">${esc(sub)}</text></svg><div class="fe-tip" hidden></div></div>`;
    const leg = `<div class="fe-rosca-leg">${fatias.map((f) => `<button type="button" class="fe-rl" ${hud(f)} aria-haspopup="dialog"><i class="${f.cor}" aria-hidden="true"></i><span>${esc(f.grupo)}</span><b>${esc(mil(f.total))}</b><small>${Math.round(f.total / tot * 100)}%</small></button>`).join('')}</div>`;
    return `<div class="fe-rosca-caixa">${svg}${leg}</div>`;
  }
  // A dica dos gráficos: segue o mouse (ou o dedo) dentro do gráfico e mostra a linha vertical no mês/dia.
  function aoPassarFe(ev) {
    const caixa = ev.target.closest?.('.fe .fe-hv');
    document.querySelectorAll('.fe .fe-hv .fe-tip:not([hidden])').forEach((t) => { if (!caixa || !caixa.contains(t)) t.hidden = true; });
    if (!caixa) return;
    const alvo = ev.target.closest('[data-tip]'), tip = caixa.querySelector('.fe-tip'), cruz = caixa.querySelector('.fe-cruz');
    if (!alvo || !tip) { if (tip) tip.hidden = true; if (cruz) cruz.setAttribute('hidden', ''); return; }
    tip.textContent = ''; alvo.dataset.tip.split('\n').forEach((l, i) => { const e = document.createElement(i ? 'span' : 'b'); e.textContent = l; tip.append(e); });
    tip.hidden = false;
    const cx = caixa.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.max(0, Math.min(cx.width - w, ev.clientX - cx.left + 14))}px`;
    tip.style.top = `${Math.max(0, ev.clientY - cx.top - h - 10)}px`;
    if (cruz && alvo.dataset.x) { cruz.setAttribute('x1', alvo.dataset.x); cruz.setAttribute('x2', alvo.dataset.x); cruz.removeAttribute('hidden'); }
    caixa.querySelectorAll('.fe-fatia.on').forEach((f) => f.classList.remove('on')); if (alvo.classList.contains('fe-fatia')) alvo.classList.add('on');
  }
  function saiuDoGrafico(ev) { const caixa = ev.target.closest?.('.fe .fe-hv'); if (!caixa || caixa.contains(ev.relatedTarget)) return;
    caixa.querySelector('.fe-tip')?.setAttribute('hidden', ''); caixa.querySelector('.fe-cruz')?.setAttribute('hidden', ''); caixa.querySelectorAll('.fe-fatia.on').forEach((f) => f.classList.remove('on')); }
  // Gasto acumulado dia a dia: o mês escolhido × o anterior (Paulo pediu comparativo). Só o que saiu do banco.
  function acumuladoDoMes(lista, mes, tipo = 'saida') {
    const dias = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate(), por = new Array(dias).fill(0);
    for (const t of lista) if (t.banco.data.startsWith(mes) && (tipo === 'saida' ? t.banco.valor < 0 : t.banco.valor > 0)) por[Number(t.banco.data.slice(8, 10)) - 1] += Math.abs(t.banco.valor);
    let s = 0; return por.map((v) => (s += v));
  }
  // Período dos gráficos do Hoje (Paulo, 24/11/2026: "deixa o período personalizado… o ano todo? 6 meses?"). Vale para
  // "Entrou × saiu" e para a rosca; "Falta entrar", "Falta pagar" e os pontos de atenção continuam sendo do mês.
  const FE_PER = [['3', '3 meses'], ['6', '6 meses'], ['12', '12 meses'], ['ano', 'Este ano'], ['tudo', 'Tudo'], ['custom', 'Escolher']];
  function mesesDoPeriodo(d, mes) {
    const p = ui.fe.per, todos = (d.serie || []).map((s) => s.mes);
    let de, ate = mes;
    if (p.k === 'custom' && p.de && p.ate) { [de, ate] = p.de <= p.ate ? [p.de, p.ate] : [p.ate, p.de]; }
    else if (p.k === 'ano') de = `${mes.slice(0, 4)}-01`;
    else if (p.k === 'tudo') de = todos[0] || mes;
    else de = X().somarMeses(mes, -(Number(p.k === 'custom' ? 6 : p.k) - 1));
    const out = []; for (let m = de; m <= ate && out.length < 120; m = X().somarMeses(m, 1)) out.push(m);
    return out;
  }
  const curtoMes = (m, anos) => (anos ? `${mes3(m)}/${m.slice(2, 4)}` : mes3(m));
  function fePeriodo(d, meses) {
    const p = ui.fe.per;
    const chips = FE_PER.map(([k, nome]) => `<button type="button" class="fe-chip" data-fx="fe-per" data-valor="${k}" aria-pressed="${p.k === k}">${esc(nome)}</button>`).join('');
    const custom = p.k === 'custom' ? `<span class="fe-per-de">${selMes('de', p.de || meses[0], d, { rotulo: 'De', attrs: 'data-fx-campo="fe-per-de"' })}<span>até</span>${selMes('ate', p.ate || meses[meses.length - 1], d, { rotulo: 'Até', attrs: 'data-fx-campo="fe-per-ate"' })}</span>` : '';
    const rot = meses.length > 1 ? `${soMes(meses[0])}${meses[0].slice(0, 4) !== meses[meses.length - 1].slice(0, 4) ? ` de ${meses[0].slice(0, 4)}` : ''} a ${soMes(meses[meses.length - 1])} de ${meses[meses.length - 1].slice(0, 4)}` : nomeMes(meses[0]);
    return { html: `<div class="fe-periodo" role="group" aria-label="Período dos gráficos"><span class="fe-rot">Período</span><div class="fe-chips">${chips}</div>${custom}<span class="fe-sub">${esc(rot)}</span></div>`, rot };
  }
  // HUD da rosca (Paulo, 24/11/2026: "quando clico em Outros devia abrir um HUD mostrando de onde tá puxando cada valor e
  // o que é cada um"): o total do pedaço, aberto por grupo e categoria, e cada lançamento do período com "abrir".
  function feHud(d, lista, mesesP, rotPer, grupos) {
    const k = ui.fe.hud; if (!k) return '';
    const resto = k === '__resto', alvo = new Set(resto ? grupos.slice(6).map((g) => g.grupo) : [k]);
    const set = new Set(mesesP), itens = [];
    for (const t of lista) {
      if (!set.has(t.banco.data.slice(0, 7))) continue;
      for (const p of X().pedacos(t)) if (p.valor < 0 && alvo.has(grupoDe(d, p.categoria))) itens.push({ t, p, g: grupoDe(d, p.categoria) });
    }
    itens.sort((a, b) => a.p.valor - b.p.valor);
    const tot = itens.reduce((s, i) => s - i.p.valor, 0);
    const porCat = new Map(); for (const i of itens) { const c = `${i.g}|${i.p.categoria}`; const x = porCat.get(c) || { g: i.g, cat: i.p.categoria, v: 0, n: 0 }; x.v -= i.p.valor; x.n++; porCat.set(c, x); }
    const cats = [...porCat.values()].sort((a, b) => b.v - a.v);
    const nome = (t) => t.real.descricao || t.banco.contraparte || t.banco.historico;
    const lin = itens.slice(0, 80).map(({ t, p, g }) => `<div class="fe-kv fe-orig"><span>${esc(dataCurta(t.banco.data))} · ${esc(nome(t))}<small>${esc(nomeCat(d, p.categoria))}${resto ? ` · ${esc(g)}` : ''}${t.banco.contraparte && nome(t) !== t.banco.contraparte ? ` · ${esc(t.banco.contraparte)}` : ''}${t.real.conferido ? '' : ' · sem conferir'}</small></span><b>${esc(rs(-p.valor))} <button type="button" class="fv2-link" data-fx="ir-lanc" data-valor="${esc(t.id)}" data-mes="${esc(t.banco.data.slice(0, 7))}">abrir</button></b></div>`).join('');
    const titulo = resto ? 'Demais grupos' : k;
    return `<div class="fe-hud-veu" data-fx="fe-hud" data-valor="" aria-hidden="true"></div><section class="fe-hud" role="dialog" aria-modal="true" aria-label="${esc(`De onde vem ${titulo}`)}">
      <div class="fe-lado-cab"><div><span class="fe-rot">De onde vem · ${esc(rotPer)}</span><h3 class="fe-nome">${esc(titulo)}</h3><span class="fe-sub">${esc(rs(tot))} em ${esc(quantos(itens.length, 'lançamento', 'lançamentos'))}${resto ? ` · junta ${esc([...alvo].join(', '))}` : ''}</span></div><button type="button" class="fe-ico" data-fx="fe-hud" data-valor="" aria-label="Fechar">${IC_FECHAR}</button></div>
      <div class="fe-conta"><span class="fe-rot">Por categoria</span>${cats.map((c) => `<div class="fe-kv"><span>${esc(nomeCat(d, c.cat))}<small>${resto ? `${esc(c.g)} · ` : ''}${esc(quantos(c.n, 'lançamento', 'lançamentos'))}</small></span><b>${esc(rs(c.v))} <small>${tot ? Math.round(c.v / tot * 100) : 0}%</small></b></div>`).join('') || '<p class="fe-vazio">Nada neste período.</p>'}</div>
      <div class="fe-conta"><span class="fe-rot">Cada lançamento, do maior para o menor</span>${lin}${itens.length > 80 ? `<p class="fe-sub">e mais ${n0(itens.length - 80)} no Movimento.</p>` : ''}</div>
      ${resto ? '' : `<div class="fe-bts">${feBtn(`Ver ${titulo} no Movimento`, `data-fx="fe-grupo" data-valor="${esc(k)}"`, 'q')}</div>`}
    </section>`;
  }
  function feHoje(ctx) {
    const d = feIniciar(ctx), lista = d.transacoes || [], mes = ui.fe.mes, hoje = d.hoje || '', mesHoje = hoje.slice(0, 7);
    const r = X().resumo(lista, { mes });
    const pend = lista.filter((t) => !t.real.conferido), sabe = pend.filter((t) => t.real.categoria !== 'a_classificar').length;
    const whats = (d.vorcaro?.propostas || []).filter((p) => p.estado === 'pendente').length;
    // O que já está em Falta pagar não se repete nos pontos de atenção (Paulo, 24/11/2026: o Hoje estava redundante).
    const doServidor = (d.analise?.achados || []).filter((a) => a.id !== 'extrato_parado').map((a) => ({ ...a, det: a.det + (a.impacto ? ` · impacto ${rs(a.impacto)}` : '') }));
    const achados = [...doServidor, ...analise(d).filter((a) => !['Banco sem conferir', 'WhatsApp', 'Fixo não apareceu', 'Fixos sem cadastro'].includes(a.rot) && !doServidor.some((x) => x.rot === a.rot))].sort((x, y) => (y.g || 0) - (x.g || 0));
    let laranja;
    if (!lista.length) laranja = feLaranja('Ainda sem extrato. Importe o extrato da conta PJ do Santander (OFX, CSV ou Excel) e eu digo para onde foi cada lançamento.', feArquivo('fe-lar-btn'));
    else if (pend.length || whats) {
      const frases = [pend.length ? `${quantos(pend.length, 'lançamento esperando', 'lançamentos esperando')} o lado real.${sabe ? ` Em ${n0(sabe)} eu já sei para onde foi, é só confirmar.` : ''}` : '',
        whats ? `${pend.length ? 'E ' : ''}${quantos(whats, 'chegou', 'chegaram')} pelo grupo Vybe Financeiro.` : ''].filter(Boolean).join(' ');
      laranja = feLaranja(esc(frases), feBtn('Conferir agora', feIr('fin_movimento', 'data-chip="conferir"'), 'fe-lar-btn'));
    } else if (achados[0]) laranja = feLaranja(esc(achados[0].texto), achados[0].aba ? feBtn('Ver', feAchadoIr(achados[0]), 'fe-lar-btn') : '');
    else laranja = feLaranja('Tudo conferido. Nada pedindo decisão agora.');
    // O mês em quatro perguntas (Paulo, 24/11/2026): o que já entrou, o que falta entrar, o que já pagou e o que falta pagar
    // (salários, programas e contas fixas). Cada linha abre a tela onde o valor nasce.
    const pc2 = d.por_cliente || { meses: [], linhas: [] };
    const doMes = pc2.meses.includes(mes) ? pc2.linhas.map((l) => ({ l, m: l.meses.find((x) => x.mes === mes) })).filter((x) => x.m && x.m.situacao !== 'sem' && x.m.situacao !== 'fora') : [];
    const pagos = doMes.filter((x) => x.m.situacao === 'pago').length;
    const SIT = { aberto: ['r', 'em aberto'], parcial: ['a', 'pagou parte'], a_receber: ['n', 'a receber'] };
    const faltaCli = doMes.map(({ l, m }) => ({ id: l.cliente_id, nome: l.cliente_nome, v: (m.em_aberto || 0) + (m.a_receber || 0), sit: m.situacao }))
      .filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const soma = (l) => l.reduce((s, x) => s + (x.v ?? x.valor ?? 0), 0);
    const faltaEntrar = soma(faltaCli);
    const sal = (d.contas_pessoas || []).map((c) => { const m = c.meses.find((x) => x.mes === mes); return { id: c.pessoa_id, nome: c.nome, v: m ? (m.aberto ? m.falta_pagar || 0 : m.a_pagar || 0) : 0, comb: m?.combinado || 0, pago: m?.pago || 0 }; })
      .filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const fa = (d.fixos || []).length ? X().analisarFixos(d.fixos, lista, mes, d.cartao?.itens || []) : null;
    const fxFalta = fa ? fa.fixos.filter((f) => !f.achado) : [];
    const prog = fxFalta.filter((f) => f.categoria === 'ferramentas'), contas = fxFalta.filter((f) => f.categoria !== 'ferramentas');
    const faltaPagar = soma(sal) + soma(prog) + soma(contas);
    const saiu = r.saidas + r.cartao_e_transferencias;
    const us = ultimoSaldo(lista), saldo = r.saldo_final ?? us?.banco.saldo ?? null;
    const fecha = saldo != null && mes === mesHoje ? saldo + faltaEntrar - faltaPagar : null;
    const nums = `<div class="fe-nums">${[
      feNum({ rot: 'Saldo no banco', valor: saldo == null ? '—' : esc(rs(saldo)), tom: saldo < 0 ? 'r' : '', sub: us ? `pelo extrato de ${esc(dataCurta(us.banco.data))}` : 'sem extrato', attrs: feIr('fin_movimento', 'data-chip="todos"') }),
      feNum({ rot: 'Já entrou', valor: esc(mil(r.entradas)), sub: `falta entrar ${esc(mil(faltaEntrar))}`, attrs: feIr('fin_movimento', 'data-chip="entradas"') }),
      feNum({ rot: 'Já pagou', valor: esc(mil(saiu)), sub: `falta pagar ${esc(mil(faltaPagar))}`, attrs: feIr('fin_movimento', 'data-chip="saidas"') }),
      feNum({ rot: fecha != null ? 'Fecha o mês com' : 'Resultado do mês', valor: fecha != null ? esc(rs(fecha)) : esc(comSinal(r.resultado)), tom: (fecha ?? r.resultado) < 0 ? 'r' : '',
        sub: fecha != null ? 'saldo + falta entrar − falta pagar' : 'o que entrou − o que saiu', attrs: feIr('fin_analise') }),
    ].join('')}</div>`;
    const linha = (attrs, rot, det, val, tom = '') => `<button type="button" class="fe-al" ${attrs}><i class="fe-dot ${tom}" aria-hidden="true"></i><span><b>${esc(rot)}</b>${det ? `<small>${esc(det)}</small>` : ''}</span><b class="fe-al-v">${esc(rs(val))}</b></button>`;
    const grupo = (rot, itens, total) => (itens.length ? `<div class="fe-gr"><span class="fe-rot">${esc(rot)}</span><b>${esc(rs(total))}</b></div>${itens.join('')}` : '');
    const total = (v) => `<div class="fe-gr fe-tot"><span>Total</span><b>${esc(rs(v))}</b></div>`;
    const entrar = feCard('Falta entrar', faltaCli.length
      ? faltaCli.slice(0, 8).map((x) => linha(`data-fx="fe-cli" data-valor="${esc(x.id)}"`, x.nome, (SIT[x.sit] || SIT.aberto)[1], x.v, (SIT[x.sit] || SIT.aberto)[0])).join('')
        + (faltaCli.length > 8 ? `<button type="button" class="fe-elo" ${feIr('fin_clientes')}>Mais ${n0(faltaCli.length - 8)} na grade de clientes</button>` : '') + total(faltaEntrar)
      : `<p class="fe-vazio">${doMes.length ? 'Todos os clientes com mensalidade já pagaram este mês.' : 'Sem mensalidade prevista neste mês.'}</p>`,
    { dir: doMes.length ? `${n0(pagos)} de ${quantos(doMes.length, 'cliente pagou', 'clientes pagaram')}` : '', cls: 'fe-entrar' });
    const vence = (f) => (f.vence < hoje ? `venceu dia ${f.dia}` : `vence dia ${f.dia}`) + (f.forma === 'cartao' ? ' · no cartão' : '');
    const pagar = feCard('Falta pagar', faltaPagar
      ? grupo('Salários', sal.map((x) => linha(feIr('fin_pessoas', `data-pes="${esc(x.id)}"`), x.nome, x.comb ? `recebeu ${rs(x.pago)} de ${rs(x.comb)}` : '', x.v, 'n')), soma(sal))
        + grupo('Programas e assinaturas', prog.map((f) => linha(feIr('fin_assinaturas', `data-fixo="${esc(f.id)}"`), f.nome, vence(f), f.valor, f.vence < hoje ? 'r' : 'a')), soma(prog))
        + grupo('Contas fixas', contas.map((f) => linha(`data-fx="fe-chip-fixo" data-valor="${esc(f.id)}"`, f.nome, vence(f), f.valor, f.vence < hoje ? 'r' : 'a')), soma(contas))
        + total(faltaPagar)
      : `<p class="fe-vazio">${(d.contas_pessoas || []).some((c) => c.salario?.valor) || fa ? 'Nada de salário, programa ou conta fixa faltando neste mês.' : 'Informe o combinado do time em Pessoas e cadastre as assinaturas para eu dizer o que falta pagar.'}</p>`, { cls: 'fe-pagar' });
    // Pontos de atenção: o fim do mês no vermelho, os achados do Vorcaro e o vale.
    const MONEY = /[−-]?R\$\s?[\d.]+,\d{2}/;
    const partir = (det) => { const t = String(det ?? ''), m = MONEY.exec(t); if (!m) return { det: t, val: '' };
      const v = numero(m[0].replace(/R\$\s?/, '').replace('−', '-')); return { det: t.replace(m[0], '').replace(/^\s*·\s*|\s*·\s*$/g, '').trim(), val: mil(Math.abs(v)) }; };
    const vale = (d.contas_pessoas || []).filter((c) => c.vale > 0);
    const itens = [fecha != null && fecha < 0 ? { g: 3, rot: 'O mês fecha no vermelho', det: 'se entrar e sair tudo o que falta', val: mil(Math.abs(fecha)), attrs: feIr('fin_analise') } : null,
      ...achados.map((a) => ({ g: a.g, rot: a.rot, ...partir(a.det), attrs: feAchadoIr(a) })),
      vale.length ? { g: 0, rot: 'Vale acumulado', det: quantos(vale.length, 'pessoa', 'pessoas'), val: mil(vale.reduce((s, c) => s + c.vale, 0)), attrs: feIr('fin_pessoas'), roxo: true } : null].filter(Boolean).slice(0, 6);
    const atencao = feCard('Pontos de atenção', itens.map((a) => `<button type="button" class="fe-al" ${a.attrs}><i class="fe-dot ${a.roxo ? 'v' : a.g >= 2 ? 'r' : 'a'}" aria-hidden="true"></i><span><b>${esc(a.rot)}</b>${a.det ? `<small>${esc(a.det)}</small>` : ''}</span>${a.val ? `<b class="fe-al-v">${esc(a.val)}</b>` : ICV.seta}</button>`).join('') || '<p class="fe-vazio">Nada pedindo atenção.</p>');
    const mesesP = mesesDoPeriodo(d, mes), per = fePeriodo(d, mesesP);
    const porMes = new Map((d.serie || []).map((s) => [s.mes, s]));
    const umMes = mesesP.length === 1 && mesesP[0] === mes;
    // Rosca: soma as saídas por grupo em todos os meses do período.
    const gMap = new Map();
    for (const m of mesesP) for (const g of saidasPorGrupo(d, m === mes ? r : X().resumo(lista, { mes: m }))) gMap.set(g.grupo, (gMap.get(g.grupo) || 0) + g.total);
    const grupos = [...gMap].map(([grupo, total]) => ({ grupo, total })).sort((a, b) => b.total - a.total);
    const onde = feCard(`Para onde foi o dinheiro${umMes ? '' : ` · ${per.rot}`}`, feRosca(grupos, { rotulo: `Saídas de ${per.rot} por grupo`, sub: umMes ? 'saiu no mês' : 'saiu no período' }), { dir: grupos.length ? 'toque num pedaço para ver de onde vem' : '', cls: 'fe-onde' });
    // Entrou × saiu nos últimos 6 meses, até o mês escolhido (o resultado é a distância entre as duas linhas).
    const anos = mesesP[0].slice(0, 4) !== mesesP[mesesP.length - 1].slice(0, 4);
    const ent = mesesP.map((m) => (porMes.has(m) ? porMes.get(m).entradas : null)), sai = mesesP.map((m) => (porMes.has(m) ? porMes.get(m).saidas + porMes.get(m).cartao : null));
    const somar = (a) => a.reduce((s, v) => s + (v || 0), 0), tE = somar(ent), tS = somar(sai), comDado = ent.filter((v) => v != null).length || 1;
    const totais = `<div class="fe-per-tot"><div><small>Entrou</small><b>${esc(mil(tE))}</b></div><div><small>Saiu</small><b>${esc(mil(tS))}</b></div><div><small>Resultado</small><b class="${tE - tS < 0 ? 'r' : 'g'}">${esc((tE - tS < 0 ? '−' : '') + mil(Math.abs(tE - tS)))}</b></div><div><small>Saída média/mês</small><b>${esc(mil(tS / comDado))}</b></div></div>`;
    const linhas6 = feCard('Entrou × saiu', totais + feLinhas(mesesP.map((m) => ({ curto: curtoMes(m, anos), longo: nomeMes(m) })), [
      { nome: 'Entrou', cls: 's1', vals: ent }, { nome: 'Saiu', cls: 's0', vals: sai }],
    { rotulo: `Entrou e saiu de ${per.rot}` }), { cls: 'fe-6m', dir: `<button type="button" class="fe-elo" ${feIr('fin_analise')}>mais na Análise</button>` });
    // O gasto do mês dia a dia, contra o mês anterior no mesmo dia.
    const mAnt = X().somarMeses(mes, -1), acA = acumuladoDoMes(lista, mes), acB = acumuladoDoMes(lista, mAnt);
    const diaHoje = mes === mesHoje ? Number(hoje.slice(8, 10)) : acA.length, nD = Math.max(acA.length, acB.length);
    const noDia = acA[Math.min(diaHoje, acA.length) - 1] || 0, antDia = acB[Math.min(diaHoje, acB.length) - 1] || 0;
    const comp = antDia ? Math.round((noDia / antDia - 1) * 100) : null;
    const diaADia = feCard(`Gasto dia a dia: ${soMes(mes)} × ${soMes(mAnt)}`, `<p class="fe-sub fe-comp">Até o dia ${n0(diaHoje)}: <b>${esc(rs(noDia))}</b>${comp != null ? `, ${comp === 0 ? 'igual a' : `${Math.abs(comp)}% ${comp > 0 ? 'a mais que' : 'a menos que'}`} ${esc(soMes(mAnt))} no mesmo dia (${esc(rs(antDia))})` : ''}.</p>`
      + feLinhas(Array.from({ length: nD }, (_, i) => ({ curto: String(i + 1), longo: `Dia ${i + 1}` })), [
        { nome: soMes(mes), cls: 's0', vals: Array.from({ length: nD }, (_, i) => (i < diaHoje && i < acA.length ? acA[i] : null)) },
        { nome: soMes(mAnt), cls: 'sq', trac: true, vals: Array.from({ length: nD }, (_, i) => (i < acB.length ? acB[i] : null)) }],
      { rotulo: `Gasto acumulado por dia em ${soMes(mes)} e ${soMes(mAnt)}`, alto: 190, marcarX: mes === mesHoje ? diaHoje - 1 : -1 }), { cls: 'fe-dia-a-dia' });
    return feCasca('fin_hoje', d, `${feHud(d, lista, mesesP, per.rot, grupos)}${laranja}${feParado(d)}${nums}${per.html}<div class="fe-par">${linhas6}${onde}</div><div class="fe-par">${entrar}${pagar}</div><div class="fe-par">${diaADia}${atencao}</div>`);
  }
  // O achado do Vorcaro leva à tela nova certa, com o filtro dele.
  function feAchadoIr(a) {
    if (a.ancora === 'whats') return feIr('fin_movimento', 'data-chip="conferir" data-lado="whats"');
    const nova = FE_DE[a.aba] || a.aba || 'fin_hoje';
    const chip = a.chip || FE_CHIP[a.aba] || '';
    return feIr(nova, `${chip ? `data-chip="${esc(chip)}"` : ''}${a.sub ? ` data-sub="${esc(a.sub)}"` : ''}${a.cat ? ` data-cat="${esc(a.cat)}"` : ''}${a.mes ? ` data-mes="${esc(a.mes)}"` : ''}${nova === 'fin_clientes' && a.rot === 'Mensalidade em aberto' ? ' data-cli-chip="aberto"' : ''}`);
  }

  // ---------- MOVIMENTO ----------
  function feMovimento(ctx) {
    const d = feIniciar(ctx), u = ui.fe, ue = ui.extrato, lista = d.transacoes || [], mes = u.mes, hoje = d.hoje || '';
    const doMes = lista.filter((t) => t.banco.data.startsWith(mes));
    const busca = semAcento(ctx.filtro?.fx_extrato || '');
    const casa = (t) => !busca || semAcento([t.banco.historico, t.real.quem, t.real.descricao, t.real.cliente_nome, t.real.pessoa_nome, nomeCat(d, t.real.categoria), String(Math.abs(t.banco.valor)).replace('.', ','), ...(t.real.partes || []).map((p) => p.cliente_nome)].join(' ')).includes(busca);
    const fa = X().analisarFixos(d.fixos || [], lista, mes, d.cartao?.itens || []);
    const faturas = (d.cartao?.faturas || []).filter((f) => f.fatura === mes);
    const itensCartao = faturas.flatMap((f) => f.itens.map((i) => ({ ...i, _cartao: f.cartao }))).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const pc2 = d.por_cliente || { meses: [], linhas: [] };
    const aReceber = pc2.meses.includes(mes) ? pc2.linhas.map((l) => ({ l, m: l.meses.find((x) => x.mes === mes) })).filter((x) => x.m && (x.m.em_aberto || x.m.a_receber)) : [];
    const fixosVem = fa.fixos.filter((f) => !f.achado);
    const nPrev = fixosVem.length + aReceber.length + faturas.filter((f) => f.falta > 0).length;
    const filtroT = { todos: () => true, conferir: (t) => !t.real.conferido, entradas: (t) => t.banco.valor > 0, saidas: (t) => t.banco.valor < 0 };
    const conta = (k) => doMes.filter(filtroT[k]).length;
    const chips = feChips([['todos', 'Tudo', conta('todos')], ['conferir', 'A conferir', lista.filter((t) => !t.real.conferido).length], ['lote', 'Em lote', (d.analise?.lote || []).length], ['entradas', 'Entradas', conta('entradas')], ['saidas', 'Saídas', conta('saidas')],
      ['cartao', 'Cartão', itensCartao.length], ['fixos', 'Fixos', fa.quantidade], ['previsto', 'Previsto', nPrev]]
      .map(([k, n, c]) => [k, n, c, `data-fx="fe-chip" data-valor="${k}"`, u.chip === k && !u.grupo && !ue.cat]), 'Filtrar o movimento');
    const filtrosExtra = [u.grupo ? `<button type="button" class="fe-chip on" data-fx="fe-grupo" data-valor="" aria-pressed="true">${esc(u.grupo)} ×</button>` : '',
      ue.cat ? `<button type="button" class="fe-chip on" data-fx="cat" data-valor="${esc(ue.cat)}" aria-pressed="true">${esc(nomeCat(d, ue.cat))} ×</button>` : ''].join('');
    const barra = `<div class="fe-barra-ferr">${chips}${filtrosExtra}<label class="fe-busca"><span class="fv2-sr">Buscar no movimento</span>${ICV.busca}<input role="searchbox" enterkeyhint="search" autocomplete="off" data-vc-busca="fx_extrato" placeholder="Buscar: nome, valor, cliente" value="${esc(ctx.filtro?.fx_extrato || '')}"></label>
      ${feBtn('Lançar à mão', `data-fx="mao-abrir" aria-expanded="${Boolean(ui.vorcaro.mao)}"`, 's')}${feArquivo('fe-btn s')}</div>`;
    // A lista da esquerda, pelo filtro.
    let corpo = '', cab = ['No banco', 'De verdade', 'Valor'];
    const chip = u.chip;
    if (chip === 'lote' && !u.grupo && !ue.cat) { cab = ['No banco', 'Sugestão do Vorcaro', 'Valor']; corpo = feLote(d); }
    else if (['todos', 'conferir', 'entradas', 'saidas'].includes(chip) || u.grupo || ue.cat) {
      const base = chip === 'conferir' && !u.grupo && !ue.cat ? lista : doMes;
      const vis = base.filter((t) => (u.grupo ? X().pedacos(t).some((p) => grupoDe(d, p.categoria) === u.grupo && p.valor < 0) : true)
        && (ue.cat ? X().pedacos(t).some((p) => p.categoria === ue.cat) : true) && (u.grupo || ue.cat ? true : filtroT[chip](t)) && casa(t))
        .slice().sort((a, b) => b.banco.data.localeCompare(a.banco.data));
      const cabem = vis.slice(0, ue.mostrar);
      let dia = '';
      corpo = cabem.map((t) => { const h = t.banco.data !== dia ? `<p class="fe-dia">${esc(diaLongo(t.banco.data))}</p>` : ''; dia = t.banco.data; return h + feLinhaLanc(d, t); }).join('')
        + (vis.length > cabem.length ? `<button type="button" class="fe-elo" data-fx="mais" data-alvo="extrato">Mais ${n0(vis.length - cabem.length)}</button>` : '');
      if (!lista.length) corpo = `<div class="fe-vazio"><p>Sem extrato ainda. Importe o extrato da conta PJ (OFX, CSV ou Excel).</p>${feArquivo('fe-btn k')}</div>`;
      else if (!vis.length) corpo = `<p class="fe-vazio">${chip === 'conferir' ? 'Tudo conferido.' : 'Nada com esse filtro.'}</p>`;
    } else if (chip === 'cartao') {
      cab = ['Item', 'Situação', 'Valor'];
      const vis = itensCartao.filter((i) => !busca || semAcento([i.descricao, i.quem, i.cliente_nome, nomeCat(d, i.categoria)].join(' ')).includes(busca));
      corpo = vis.map((i) => `<button type="button" class="fe-lin" data-fx="fe-sel-item" data-valor="${esc(i.id)}" aria-pressed="${ui.cartao.editando === i.id}"><span class="fe-bk">${esc(dataCurta(i.data))} · ${esc(i.descricao)}${i.parcela ? ` · ${esc(i.parcela)}` : ''}</span>
        <span class="fe-real">${i.categoria === 'a_classificar' ? feTag('sem categoria', 'r') : feTag(nomeCat(d, i.categoria), 'i')}<span>${esc([i.quem, i.cliente_nome].filter(Boolean).join(' · ') || STATUS_NOME[i.status] || '')}</span></span><span class="fe-val">${esc(rs(-Math.abs(i.valor)))}</span></button>`).join('')
        || `<div class="fe-vazio"><p>Nenhum item na fatura de ${esc(soMes(mes))}.</p>${feBtn('Colar os itens da fatura', 'data-fx="cartao-colar"', 'k')}</div>`;
    } else if (chip === 'fixos') {
      cab = ['Gasto', 'No extrato', 'Valor'];
      corpo = fa.fixos.map((f) => { const naoVeio = !f.achado && f.vence <= hoje;
        return `<button type="button" class="fe-lin" data-fx="fixo-editar" data-valor="${esc(f.id)}" aria-pressed="${ui.fixos.editando === f.id}"><span class="fe-bk">dia ${String(f.dia).padStart(2, '0')} · ${esc(f.nome)}</span>
        <span class="fe-real">${f.achado ? feTag(`saiu ${dataCurta(f.achado.data)}`, 'g') : naoVeio ? feTag('não apareceu', 'r') : feTag(`vence ${dataCurta(f.vence)}`)}<span>${esc(nomeCat(d, f.categoria))} · ${esc(FORMA_NOME[f.forma] || f.forma || '')}</span></span><span class="fe-val">${esc(rs(-f.valor))}</span></button>`; }).join('')
        || `<div class="fe-vazio"><p>Nenhum gasto fixo cadastrado.</p>${feBtn('Novo gasto fixo', 'data-fx="fixo-novo"', 'k')}</div>`;
      const prov = fixosProvaveis(lista, d.fixos || []);
      if (prov.length) corpo += `<p class="fe-dia">Parecem fixos pelo extrato</p>${prov.slice(0, 6).map((p, i) => `<div class="fe-lin fe-prev"><span class="fe-bk">perto do dia ${n0(p.dia)} · ${esc(p.nome)}</span><span class="fe-real">${feTag(`${n0(p.meses)} meses`)}<button type="button" class="fe-elo" data-fx="fixo-provavel" data-valor="${i}">cadastrar</button></span><span class="fe-val">${esc(rs(-p.valor))}</span></div>`).join('')}`;
    } else if (chip === 'previsto') {
      cab = ['Quando', 'O quê', 'Valor'];
      const l = [...fixosVem.map((f) => ({ k: f.vence, h: `<button type="button" class="fe-lin fe-prev" data-fx="fe-chip-fixo" data-valor="${esc(f.id)}"><span class="fe-bk">fixo · dia ${String(f.dia).padStart(2, '0')}</span><span class="fe-real">${f.vence <= hoje ? feTag('não apareceu', 'r') : feTag('fixo')}<span>${esc(f.nome)}</span></span><span class="fe-val">${esc(rs(-f.valor))}</span></button>` })),
        ...faturas.filter((f) => f.falta > 0).map((f) => ({ k: f.vence || `${mes}-28`, h: `<button type="button" class="fe-lin fe-prev" data-fx="fe-chip" data-valor="cartao"><span class="fe-bk">cartão${f.vence ? ` · vence ${esc(dataCurta(f.vence))}` : ''}</span><span class="fe-real">${feTag('cartão', 'i')}<span>Falta na fatura · ${esc(f.cartao)}</span></span><span class="fe-val">${esc(rs(-f.falta))}</span></button>` })),
        ...aReceber.map(({ l: c, m }) => ({ k: `${mes}-00`, h: `<button type="button" class="fe-lin fe-prev" data-fx="fe-cli" data-valor="${esc(c.cliente_id)}"><span class="fe-bk">a receber · ${esc(soMes(mes))}</span><span class="fe-real">${m.em_aberto ? feTag('em aberto', 'r') : feTag('a receber')}<span>${esc(c.cliente_nome)}</span></span><span class="fe-val g">${esc(comSinal(m.em_aberto || m.a_receber))}</span></button>` }))]
        .sort((a, b) => a.k.localeCompare(b.k));
      corpo = l.map((x) => x.h).join('') || '<p class="fe-vazio">Nada previsto até o fim do mês.</p>';
    }
    const lado = feLadoMovimento(d, doMes);
    const listaCard = feCard('', `<div class="fe-cab" aria-hidden="true">${cab.map((c, i) => `<span${i === 2 ? ' class="rt"' : ''}>${esc(c)}</span>`).join('')}</div>${corpo}`, { cls: 'fe-lista', rotulo: 'lancamentos' });
    return feCasca('fin_movimento', d, `${barra}<div class="fe-duas">${listaCard}<aside class="fe-lado" aria-label="Ficha">${lado}</aside></div>`);
  }
  const DIAS_SEM = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const diaLongo = (iso, semana = false) => { const dt = new Date(`${iso}T12:00:00Z`); return Number.isNaN(dt.getTime()) ? iso : `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}${semana ? ` · ${DIAS_SEM[dt.getUTCDay()]}` : ''}`; };
  // A linha do Movimento: o banco à esquerda, o de verdade no meio (com o selo de quem decidiu) e o valor.
  function feLinhaLanc(d, t) {
    const entrada = t.banco.valor > 0, sel = ui.extrato.aberta === t.id;
    const quem = t.real.partes?.length ? [...new Set(t.real.partes.map((p) => p.cliente_nome || p.pessoa_nome || p.quem).filter(Boolean))].join(', ') : (t.real.cliente_nome || t.real.pessoa_nome || t.real.quem || '');
    const boleto = t.real.categoria === 'receita_boleto' && !t.real.partes?.length;
    const tag = t.real.categoria === 'a_classificar' ? feTag('a classificar', 'r') : boleto ? feTag('dividir', 'a') : !t.real.conferido ? feTag('Vorcaro sugere', 'a')
      : t.real.categoria === 'cartao_agencia' ? feTag('cartão', 'i') : t.real.partes?.length ? feTag(`dividido em ${t.real.partes.length}`) : t.real.cliente_id ? feTag('cliente', 'g') : t.real.pessoa_id ? feTag('pessoa', 'v') : t.real.fixo_id ? feTag('fixo') : feTag('conferido');
    const real = boleto ? 'entre clientes' : `${esc(nomeCat(d, t.real.categoria))}${quem ? ` · ${esc(quem)}` : ''}`;
    return `<button type="button" class="fe-lin${t.real.conferido ? ' ok' : ''}" data-fx="abrir" data-alvo="extrato" data-valor="${esc(t.id)}" aria-pressed="${sel}"><span class="fe-bk">${esc(t.banco.historico)}</span><span class="fe-real">${tag}<span>${real}</span></span><span class="fe-val${entrada ? ' g' : ''}">${esc(comSinal(t.banco.valor))}</span></button>`;
  }
  // A lateral do Movimento: o formulário aberto, a ficha do lançamento, o baralho de conferir ou o resumo do filtro.
  function feLadoMovimento(d, doMes) {
    const u = ui.fe, ue = ui.extrato, lista = d.transacoes || [];
    const fechar = (attrs) => `<button type="button" class="fe-ico" ${attrs} aria-label="Fechar">${IC_FECHAR}</button>`;
    if (ui.vorcaro.mao) return maoForm(d);
    if (u.lado === 'whats') {
      const ps = (d.vorcaro?.propostas || []).filter((p) => p.estado === 'pendente');
      return `<div class="fe-lado-cab"><span class="fe-rot">Do grupo Vybe Financeiro · ${n0(ps.length)}</span>${fechar('data-fx="fe-lado" data-valor=""')}</div>${ps.slice(0, 3).map((p, i) => propostaHtml(d, p, i + 1, ps.length)).join('') || '<p class="fe-vazio">Nada esperando do grupo.</p>'}`;
    }
    if (u.chip === 'cartao') {
      if (ui.cartao.colar) return colarHtml(d);
      const item = (d.cartao?.itens || []).find((i) => i.id === ui.cartao.editando);
      if (ui.cartao.novo || item) return feCard(item ? 'Item da fatura' : 'Novo item da fatura', `<div class="fx-form-caixa">${itemCampos(d, item || { fatura: u.mes, data: `${u.mes}-01`, status: 'em_aberto' })}</div>`, { dir: fechar('data-fx="item-fechar"'), cls: 'fe-ficha' });
      const fs = (d.cartao?.faturas || []).filter((f) => f.fatura === u.mes), total = fs.reduce((s, f) => s + f.total, 0), pago = fs.reduce((s, f) => s + f.pago_no_extrato, 0), falta = fs.reduce((s, f) => s + f.falta, 0);
      const vence = fs.map((f) => f.vence).filter(Boolean).sort()[0] || '';
      const venc = d.cartao?.vencimentos || {}, nomes = [...new Set([...fs.map((f) => f.cartao), ...Object.keys(venc), 'Cartão da agência'])];
      return feCard(`Fatura de ${soMes(u.mes)}`, `<div class="fe-mini3"><div><small>Total</small><b>${esc(mil(total))}</b></div><div><small>Pago</small><b class="g">${esc(mil(pago))}</b></div><div><small>Falta</small><b class="${falta ? 'r' : ''}">${esc(mil(falta))}</b></div></div>
        ${vence ? `<p class="fe-sub">Vence em ${esc(dataCurta(vence))}.</p>` : ''}
        <div class="fe-bts">${feBtn('Colar os itens da fatura', 'data-fx="cartao-colar"', 'k')}${feBtn('Novo item', 'data-fx="cartao-novo"')}</div>
        <details class="fe-det"><summary>Dia do vencimento</summary>${nomes.map((n) => `<div class="fx-mini fx-venc"><span>${esc(n)}</span><label class="fx-venc-dia">dia <input class="fx-in" type="number" min="1" max="31" step="1" inputmode="numeric" value="${esc(venc[n] ?? '')}" aria-label="Dia do vencimento da fatura do ${esc(n)}"></label><button type="button" class="fv2-btn s v2-estado" data-fx="venc-salvar" data-valor="${esc(n)}">Salvar</button></div>`).join('')}</details>
        ${(d.cartao?.pagamentos_sem_fatura || []).length ? `<p class="fe-sub">${quantos(d.cartao.pagamentos_sem_fatura.length, 'pagamento do cartão', 'pagamentos do cartão')} no extrato sem os itens da fatura.</p>` : ''}`, { cls: 'fe-ficha' });
    }
    if (u.chip === 'fixos' || u.chip === 'previsto') {
      const f = (d.fixos || []).find((x) => x.id === ui.fixos.editando);
      if (ui.fixos.novo || f) return feCard(f ? f.nome : 'Novo gasto fixo', `<div class="fx-form-caixa">${fixoCampos(d, f || ui.fixos.rascunho || {})}</div>`, { dir: fechar('data-fx="fixo-fechar"'), cls: 'fe-ficha' });
      const a = X().analisarFixos(d.fixos || [], lista, u.mes, d.cartao?.itens || []), max = Math.max(1, a.por_categoria[0]?.total || 1);
      return feCard('Gastos fixos', `<div class="fe-mini3"><div><small>Por mês</small><b>${esc(mil(a.total))}</b></div><div><small>No ano</small><b>${esc(mil(a.anual))}</b></div><div><small>Já saíram</small><b>${n0(a.achados)} de ${n0(a.quantidade)}</b></div></div>
        ${a.por_categoria.map((c) => `<div class="fe-gl"><span>${esc(c.nome)}</span><span class="fe-barra"><i style="--v:${pc(c.total, max)}%"></i></span><b>${esc(mil(c.total))}</b></div>`).join('')}
        <div class="fe-bts">${feBtn('Novo gasto fixo', 'data-fx="fixo-novo"', 'k')}</div>`, { cls: 'fe-ficha' });
    }
    const t = lista.find((x) => x.id === ue.aberta);
    if (t) return feCard('', `<div class="fe-lado-cab"><span class="fe-bk">${esc(t.banco.historico)}</span>${fechar(`data-fx="abrir" data-alvo="extrato" data-valor="${esc(t.id)}"`)}</div>
      <p class="fe-valor-grande${t.banco.valor > 0 ? ' g' : ''}">${esc(comSinal(t.banco.valor))}</p><p class="fe-sub">${esc(diaLongo(t.banco.data, true))} · ${esc(origemDe(t))}</p>${editorExtrato(d, t)}
      ${t.banco.valor < 0 && !t.real.fixo_id ? `<div class="fe-bts">${feBtn('Isto se repete todo mês', `data-fx="fn-fixo-de" data-valor="${esc(t.id)}"`, 's v2-estado')}</div>` : t.real.fixo_id ? `<p class="fe-sub">Ligado ao gasto fixo ${esc((d.fixos || []).find((f) => f.id === t.real.fixo_id)?.nome || '')}.</p>` : ''}`, { cls: 'fe-ficha' });
    if (u.chip === 'conferir') return feBaralho(d);
    if (u.chip === 'lote') return feLadoLote(d);
    // Sem nada aberto: para onde foi o mês, as regras e o que foi importado e apagado.
    const r = X().resumo(lista, { mes: u.mes });
    return feCard('Para onde foi', porCategoriaHtml(d, r) || '<p class="fe-vazio">Nada neste mês.</p>', { cls: 'fe-ficha' })
      + `<details class="fe-det fe-card"><summary>Regras, importações e apagados</summary>${regrasHtml(d)}${importacoesHtml(d)}${lixeiraHtml(d)}</details>`;
  }
  const IC_FECHAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  // O baralho de conferir: um cartão por vez, com a sugestão do Vorcaro e o "sempre assim" já marcado.
  function feBaralho(d) {
    const lista = d.transacoes || [], fila = lista.filter((t) => !t.real.conferido && !ui.fe.pular.includes(t.id)).sort((a, b) => b.banco.data.localeCompare(a.banco.data));
    const total = lista.filter((t) => !t.real.conferido).length;
    const semCat = (d.cartao?.itens || []).filter((i) => i.categoria === 'a_classificar').length, whats = (d.vorcaro?.propostas || []).filter((p) => p.estado === 'pendente').length;
    const fila2 = `<section class="fe-card"><h2 class="fe-rot">Também na fila</h2>
      <div class="fe-kv"><span>Do extrato</span><b>${n0(total)}</b></div>
      <button type="button" class="fe-kv" data-fx="fe-chip" data-valor="cartao"><span>Itens do cartão sem categoria</span><b>${n0(semCat)}</b></button>
      <button type="button" class="fe-kv" data-fx="fe-lado" data-valor="whats"><span>Do grupo Vybe Financeiro</span><b>${n0(whats)}</b></button>
      <p class="fe-sub">Print, áudio e mensagem do grupo entram aqui, com o lançamento do banco já casado quando der.</p></section>`;
    const t = fila[0];
    if (!t) return `<section class="fe-card fe-ficha"><p class="fe-vazio">${total ? `Você pulou os ${n0(total)} que faltam.` : 'Tudo conferido.'}</p>${ui.fe.pular.length ? feBtn('Voltar os pulados', 'data-fx="fe-pular" data-valor=""') : ''}</section>${fila2}`;
    const contra = t.banco.contraparte ? t.banco.contraparte.split(' ').slice(0, 2).join(' ') : '';
    const sabe = t.real.categoria !== 'a_classificar';
    const quem = t.real.cliente_nome || t.real.pessoa_nome || t.real.quem || '';
    const pos = total - fila.length + 1;
    return `<div class="fe-lado-cab"><span class="fe-rot">Conferir · ${n0(pos)} de ${n0(total)}</span></div>
      <div class="fe-baralho"><span class="fe-carta-atras" aria-hidden="true"></span><span class="fe-carta-atras b" aria-hidden="true"></span>
      <section class="fe-card fe-carta" data-fx-editor="${esc(t.id)}">
        <div class="fe-lado-cab"><span class="fe-bk">${esc(t.banco.historico)}</span><span class="fe-sub">${esc(dataCurta(t.banco.data))}</span></div>
        <p class="fe-valor-grande${t.banco.valor > 0 ? ' g' : ''}">${esc(comSinal(t.banco.valor))}</p>
        <div class="fe-acha"><small>${sabe ? 'O Vorcaro acha que é' : 'O Vorcaro ainda não sabe'}</small><b>${sabe ? esc(nomeCat(d, t.real.categoria)) + (quem ? ` · ${esc(quem)}` : '') : 'Diga para onde foi'}</b>${t.sugestao?.nota ? `<span class="fe-sub">${esc(t.sugestao.nota)}</span>` : ''}</div>
        ${sabe && contra && !t.sugestao?.regra ? `<label class="fe-check"><input type="checkbox" data-fe-regra checked> Sempre que for ${esc(contra)}, lançar assim</label>` : ''}
        <div class="fe-bts">${sabe ? feBtn('Confirmar', `data-fx="fe-confirmar" data-valor="${esc(t.id)}"`, 'k v2-estado') : ''}${feBtn(sabe ? 'Outra coisa' : 'Dizer o que foi', `data-fx="abrir" data-alvo="extrato" data-valor="${esc(t.id)}"`, sabe ? '' : 'k')}
          ${feBtn('Dividir', `data-fx="fe-dividir" data-valor="${esc(t.id)}"`)}${feBtn('Pular', `data-fx="fe-pular" data-valor="${esc(t.id)}"`, 'q')}</div>
      </section></div>${fila2}`;
  }

  // ---------- CLIENTES ----------
  // A margem real de cada cliente: o que entrou ligado a ele menos as saídas ligadas a ele (todo o extrato).
  function margensDosClientes(d) {
    const m = new Map();
    for (const t of d.transacoes || []) for (const p of X().pedacos(t)) {
      if (!p.cliente_id) continue;
      const k = String(p.cliente_id), x = m.get(k) || { entrou: 0, saiu: 0, dias: [] };
      if (p.valor > 0) { x.entrou += p.valor; if (p.status === 'pago') x.dias.push({ mes: p.competencia || p.data.slice(0, 7), dia: Number(p.data.slice(8, 10)), data: p.data }); } else x.saiu -= p.valor;
      m.set(k, x);
    }
    for (const x of m.values()) x.margem = x.entrou > 0 ? Math.round((x.entrou - x.saiu) / x.entrou * 100) : null;
    return m;
  }
  // O contrato do cliente, editável na ficha (Paulo, 24/11/2026: "cadê o lugar de colocar o contrato?"). Grava no mesmo
  // contrato da Carteira (contrato_salvar, só donos); início, renovação e observação vão junto para não serem apagados.
  function contratoForm(d, l) {
    const c = (d.clientes || []).find((x) => String(x.id) === String(l.cliente_id)) || {};
    return `<div class="fe-conta fe-contrato" data-fx-form="contrato"><span class="fe-rot">Contrato</span><div class="fe-contrato-g">
      <label class="fx-campo"><span>Valor por mês</span><input name="valor_mensal" class="fx-in fx-num" inputmode="decimal" placeholder="0,00" value="${l.mensalidade ? esc(String(l.mensalidade).replace('.', ',')) : ''}"></label>
      <label class="fx-campo"><span>Início</span><input name="inicio" type="date" class="fx-in" value="${esc(c.inicio || '')}"></label>
      <label class="fx-campo"><span>Vence todo dia</span><input name="dia_vencimento" type="number" min="1" max="31" step="1" inputmode="numeric" class="fx-in fx-num" placeholder="último dia" value="${esc(c.dia_vencimento || '')}"></label>
      <label class="fx-campo"><span>Fim</span><input name="fim" type="date" class="fx-in" value="${esc(c.fim || '')}"${c.tem_contrato && !c.fim ? ' data-sem-fim' : ''}></label>
      <label class="fe-check fe-sem-fim"><input type="checkbox" name="sem_fim"${!c.fim ? ' checked' : ''}> sem fim</label>
      <label class="fx-campo"><span>Reajuste em</span><input name="reajuste_em" type="date" class="fx-in" value="${esc(c.reajuste_em || '')}"></label>
      <label class="fx-campo"><span>Reajuste (%)</span><input name="reajuste_pct" class="fx-in fx-num" inputmode="decimal" placeholder="0" value="${c.reajuste_pct != null ? esc(String(c.reajuste_pct).replace('.', ',')) : ''}"></label>
      <label class="fx-campo"><span>Situação</span><select name="status" class="fx-in">${[['ativo', 'Ativo'], ['negociando', 'Negociando'], ['aviso_previo', 'Aviso prévio'], ['encerrado', 'Encerrado']].map(([k, n]) => `<option value="${k}"${(c.status || 'ativo') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="fx-campo"><span>Renovação</span><input name="renovacao" type="date" class="fx-in" value="${esc(c.renovacao || '')}"></label>
      <label class="fx-campo fe-largo"><span>Observação</span><input name="observacao" class="fx-in" maxlength="1000" placeholder="o que está incluso, forma de pagamento" value="${esc(c.observacao || '')}"></label></div>
      <p class="fe-sub">O dia do vencimento é o que a Análise usa para o atraso e a Projeção para o dia em que o dinheiro entra.</p>
      <div class="fe-bts">${feBtn(l.mensalidade ? 'Salvar contrato' : 'Cadastrar contrato', `data-fx="fe-contrato-salvar" data-valor="${esc(l.cliente_id)}"`, 'k v2-estado')}</div></div>`;
  }
  // O que o cliente pagou no mês da tela, lançamento a lançamento.
  function pagosNoMes(d, l) {
    const mes = ui.fe.mes, its = [];
    for (const t of d.transacoes || []) for (const p of X().pedacos(t)) if (String(p.cliente_id) === String(l.cliente_id) && p.valor > 0 && (p.competencia || p.data.slice(0, 7)) === mes) its.push({ id: t.id, data: t.banco.data, txt: t.banco.historico, v: p.valor, pago: p.status === 'pago' });
    const m = l.meses.find((x) => x.mes === mes) || {}, tot = its.filter((x) => x.pago).reduce((s, x) => s + x.v, 0);
    return `<div class="fe-conta"><span class="fe-rot">Pagou em ${esc(soMes(mes))}</span>${its.map((x) => `<div class="fe-kv fe-orig"><span>${esc(dataCurta(x.data))} · ${esc(x.txt)}${x.pago ? '' : ' <small>ainda não caiu</small>'}</span><b>${esc(rs(x.v))} <button type="button" class="fv2-link" data-fx="ir-lanc" data-valor="${esc(x.id)}" data-mes="${esc(x.data.slice(0, 7))}">abrir</button></b></div>`).join('') || '<p class="fe-sub">Nada ligado a este cliente neste mês.</p>'}
      <div class="fe-kv fe-tot"><span>${m.previsto ? `Recebido de ${esc(rs(m.previsto))}` : 'Recebido'}</span><b>${esc(rs(tot))}</b></div>${m.previsto && tot < m.previsto ? `<div class="fe-kv"><span>Falta</span><b class="r">${esc(rs(m.previsto - tot))}</b></div>` : ''}</div>`;
  }
  function feClientes(ctx) {
    const d = feIniciar(ctx), u = ui.fe.cli, pc2 = d.por_cliente || { meses: [], linhas: [] }, hoje = d.hoje || '';
    const margens = margensDosClientes(d);
    const comDinheiro = pc2.linhas.filter((l) => l.meses.some((m) => m.situacao !== 'sem' && m.situacao !== 'fora'));
    // Todo cliente ativo aparece (Paulo, 24/11/2026: Eai Primos, Diacenter e Dialab ativos e fora de Finanças). Sem mensalidade
    // cadastrada e sem entrada ligada, entra com os meses em "—" e o filtro "Sem mensalidade" mostra quem falta cadastrar.
    const semMens = (d.clientes || []).filter((c) => c.ativo !== false && !comDinheiro.some((l) => String(l.cliente_id) === String(c.id)))
      .map((c) => ({ cliente_id: String(c.id), cliente_nome: c.nome, mensalidade: c.mensalidade || null, meses: pc2.meses.map((mes) => ({ mes, situacao: 'sem', previsto: 0, recebido: 0, em_aberto: 0 })), total_recebido: 0, total_aberto: 0, a_receber: 0 }));
    const linhas = comDinheiro.concat(semMens);
    const desde = (l) => l.meses.find((m) => m.em_aberto > 0)?.mes || '';
    const dias = (mes) => (mes ? Math.max(0, Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${mes}-01T12:00:00Z`)) / 864e5)) : 0);
    const mais30 = (l) => l.total_aberto > 0 && dias(desde(l)) > 30, baixa = (l) => (margens.get(String(l.cliente_id))?.margem ?? 100) < 20;
    const busca = semAcento(ctx.filtro?.fx_clientes || '');
    const vis = linhas.filter((l) => (u.chip === 'aberto' ? l.total_aberto > 0 : u.chip === '30' ? mais30(l) : u.chip === 'margem' ? baixa(l) : u.chip === 'sem' ? !l.mensalidade : true) && (!busca || semAcento(l.cliente_nome).includes(busca)))
      .sort((a, b) => b.total_aberto - a.total_aberto || a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR'));
    const chips = feChips([['todos', 'Todos', linhas.length], ['aberto', 'Em aberto', linhas.filter((l) => l.total_aberto > 0).length], ['30', 'Mais de 30 dias', linhas.filter(mais30).length], ['margem', 'Margem abaixo de 20%', linhas.filter(baixa).length], ['sem', 'Sem mensalidade', linhas.filter((l) => !l.mensalidade).length]]
      .map(([k, n, c]) => [k, n, c, `data-fx="fe-cli-chip" data-valor="${k}"`, u.chip === k]), 'Filtrar os clientes');
    const quatro = pc2.meses.filter((m) => m <= ui.fe.mes).slice(-4), mes = ui.fe.mes;
    // Casas curtas (símbolo + cor; o mês e o valor vão no title): pago ✓, parcial ½, aberto !, a receber …
    const CEL = { pago: ['ok', '✓'], parcial: ['pa', '½'], aberto: ['ab', '!'], a_receber: ['ar', '…'], sem: ['no', '—'], fora: ['no', '·'] };
    // Quanto cada cliente pagou no mês e se foi integral, metade ou parte (Paulo, 24/11/2026).
    const doMesCli = (l) => l.meses.find((x) => x.mes === mes) || { situacao: 'sem', previsto: 0, recebido: 0 };
    const como = (m) => { const p = m.previsto ? Math.round((m.recebido || 0) / m.previsto * 100) : null;
      if (!m.previsto) return m.recebido ? ['g', 'sem contrato', 100] : ['', '—', 0];
      if (p > 100) return ['g', `pagou a mais (${p}%)`, 100]; if (p === 100) return ['g', 'integral', 100];
      if (p >= 45 && p <= 55) return ['a', `metade (${p}%)`, p]; if (p > 0) return ['a', `parte (${p}%)`, p];
      return m.situacao === 'a_receber' ? ['n', 'a receber', 0] : ['r', 'não pagou', 0]; };
    const contratado = linhas.reduce((s, l) => s + (doMesCli(l).previsto || 0), 0), recebidoMes = linhas.reduce((s, l) => s + (doMesCli(l).recebido || 0), 0);
    const faltaMes = linhas.reduce((s, l) => { const m = doMesCli(l); return s + (m.em_aberto || 0) + (m.a_receber || 0); }, 0), devendo = linhas.filter((l) => { const m = doMesCli(l); return (m.em_aberto || 0) + (m.a_receber || 0) > 0; }).length;
    const semContrato = linhas.filter((l) => !l.mensalidade).length;
    const numsCli = `<div class="fe-nums">${[
      feNum({ rot: `Contratado em ${soMes(mes)}`, valor: esc(mil(contratado)), sub: quantos(linhas.filter((l) => doMesCli(l).previsto).length, 'contrato ativo', 'contratos ativos') }),
      feNum({ rot: 'Recebido', valor: esc(mil(recebidoMes)), sub: contratado ? `${pc(recebidoMes, contratado)}% do contratado` : 'das entradas ligadas a cliente' }),
      feNum({ rot: 'Falta receber', valor: esc(mil(faltaMes)), tom: faltaMes ? 'r' : '', sub: quantos(devendo, 'cliente', 'clientes'), attrs: 'data-fx="fe-cli-chip" data-valor="aberto"' }),
      feNum({ rot: 'Sem contrato', valor: n0(semContrato), tom: semContrato ? 'a' : '', sub: semContrato ? 'toque para cadastrar' : 'todos com valor mensal', attrs: 'data-fx="fe-cli-chip" data-valor="sem"' }),
    ].join('')}</div>`;
    const grade = vis.map((l) => { const mg = margens.get(String(l.cliente_id))?.margem;
      const m = doMesCli(l), [tom, txt, w] = como(m);
      return `<div class="fe-g fe-g-lin${u.sel === String(l.cliente_id) ? ' sel' : ''}"><button type="button" class="fe-g-nome" data-fx="fe-cli" data-valor="${esc(l.cliente_id)}" aria-pressed="${u.sel === String(l.cliente_id)}">${esc(l.cliente_nome)}</button>
        <span class="rt">${l.mensalidade ? esc(rs(l.mensalidade)) : '<button type="button" class="fv2-link" data-fx="fe-cli" data-valor="' + esc(l.cliente_id) + '">cadastrar</button>'}</span>
        <span class="rt">${m.recebido ? esc(rs(m.recebido)) : '—'}</span>
        <span class="fe-pg"><span class="fe-pg-b ${tom}" aria-hidden="true"><i style="--v:${w}%"></i></span>${feTag(txt, tom)}</span>
        <span class="fe-cels">${quatro.map((mes) => { const m = l.meses.find((x) => x.mes === mes) || { situacao: 'sem' }; const [c, t] = CEL[m.situacao] || CEL.sem; return `<span class="fe-cel ${c}" title="${esc(`${nomeMes(mes)}: ${({ ok: 'pago', pa: 'pagou parte', ab: 'em aberto', ar: 'a receber', no: 'sem cobrança' })[c]}, previsto ${rs(m.previsto || 0)}, recebido ${rs(m.recebido || 0)}`)}">${t}</span>`; }).join('')}</span>
        <span class="rt${mg != null && mg < 20 ? ' rr' : ''}">${mg == null ? '—' : `${mg}%`}</span></div>`; }).join('');
    const cab = `<div class="fe-g fe-g-cab" aria-hidden="true"><span>Cliente</span><span class="rt">Contrato</span><span class="rt">Pagou em ${esc(mes3(mes))}</span><span>Como pagou</span><span class="fe-cels">${quatro.map((m) => `<span class="c">${esc(mes3(m))}</span>`).join('')}</span><span class="rt">Margem</span></div>`;
    const corpo = !linhas.length ? `<div class="fe-vazio"><p>${pc2.desde ? 'Nenhuma entrada ligada a cliente ainda.' : 'Sem extrato, não dá para saber quem pagou.'}</p>${feBtn('Ligar no Movimento', feIr('fin_movimento', 'data-chip="entradas"'), 'k')}</div>`
      : cab + (grade || '<p class="fe-vazio">Ninguém com esse filtro.</p>') + '<p class="fe-sub fe-pe">Margem real = o que entrou do cliente − as saídas ligadas a ele, em todo o extrato.</p>';
    const l = linhas.find((x) => String(x.cliente_id) === u.sel);
    let lado;
    if (l) {
      const mg = margens.get(String(l.cliente_id)) || { dias: [], margem: null };
      const seis = pc2.meses.slice(-6), pago = seis.map((mes) => ({ mes, dia: (mg.dias.filter((x) => x.mes === mes).sort((a, b) => a.data.localeCompare(b.data))[0] || null) }));
      const W = 360, H = 96, x = (i) => 18 + i * (W - 36) / Math.max(1, seis.length - 1), y = (dia) => 10 + (Math.min(31, dia) - 1) / 30 * (H - 34);
      const comDia = pago.map((p, i) => (p.dia ? [x(i), y(p.dia.dia)] : null));
      const traco = comDia.filter(Boolean).map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
      const graf = `<svg class="fe-graf d3-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dia do mês em que ${esc(l.cliente_nome)} pagou, de ${esc(soMes(seis[0]))} a ${esc(soMes(seis[seis.length - 1]))}">
        ${traco ? `<polyline class="fe-cheia" points="${traco}"/>` : ''}${pago.map((p, i) => (p.dia ? `<circle class="fe-pt" cx="${x(i).toFixed(1)}" cy="${y(p.dia.dia).toFixed(1)}" r="4"/><text class="fe-eixo" x="${x(i).toFixed(1)}" y="${(y(p.dia.dia) - 8).toFixed(1)}" text-anchor="middle">dia ${n0(p.dia.dia)}</text>` : (l.meses.find((m) => m.mes === p.mes)?.em_aberto ? `<circle class="fe-pt-aberto" cx="${x(i).toFixed(1)}" cy="${H - 26}" r="4"/>` : ''))).join('')}
        ${seis.map((m, i) => `<text class="fe-eixo" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(mes3(m))}</text>`).join('')}</svg>`;
      lado = feCard('', `<div class="fe-lado-cab"><div><span class="fe-rot">Ficha do cliente</span><h3 class="fe-nome">${esc(l.cliente_nome)}</h3><span class="fe-sub">${l.mensalidade ? `Contrato mensal ${esc(rs(l.mensalidade))}` : 'Sem mensalidade cadastrada'}</span></div><button type="button" class="fe-ico" data-fx="fe-cli" data-valor="${esc(l.cliente_id)}" aria-label="Fechar ficha">${IC_FECHAR}</button></div>
        ${contratoForm(d, l)}${pagosNoMes(d, l)}
        <div class="fe-mini3"><div class="${l.total_aberto ? 'rv' : ''}"><small>Em aberto</small><b>${esc(mil(l.total_aberto))}</b></div><div><small>Atraso</small><b>${desde(l) ? quantos(dias(desde(l)), 'dia', 'dias') : 'em dia'}</b></div><div><small>Margem real</small><b>${mg.margem == null ? '—' : `${mg.margem}%`}</b></div></div>
        <span class="fe-rot">Dia em que pagou, mês a mês</span>${graf}
        <span class="fe-rot">Lançamentos dele</span>${detalheCliente(d, l)}
        <div class="fe-bts">${feBtn('Ver no Movimento', `data-fx="fe-cli-mov" data-valor="${esc(l.cliente_nome)}"`, 'k')}</div>`, { cls: 'fe-ficha' });
    } else {
      const aberto = linhas.reduce((s, x) => s + x.total_aberto, 0), maior = linhas.slice().sort((a, b) => b.total_aberto - a.total_aberto)[0];
      const semCob = (d.clientes || []).filter((c) => c.ativo !== false && !c.mensalidade).length;
      lado = feCard('Carteira', `<div class="fe-mini3"><div class="${aberto ? 'rv' : ''}"><small>Em aberto</small><b>${esc(mil(aberto))}</b></div><div><small>Clientes</small><b>${n0(linhas.length)}</b></div><div><small>Sem cobrança</small><b>${n0(semCob)}</b></div></div>
        ${maior?.total_aberto ? `<p class="fe-sub">O maior em aberto é ${esc(maior.cliente_nome)}, com ${esc(rs(maior.total_aberto))}.</p>${feBtn(`Abrir ${esc(maior.cliente_nome)}`, `data-fx="fe-cli" data-valor="${esc(maior.cliente_id)}"`, 'k')}` : '<p class="fe-sub">Todos em dia.</p>'}
        <p class="fe-sub">Toque num cliente para abrir a ficha.</p>`, { cls: 'fe-ficha' });
    }
    const barra = `<div class="fe-barra-ferr">${chips}<label class="fe-busca"><span class="fv2-sr">Buscar cliente</span>${ICV.busca}<input role="searchbox" enterkeyhint="search" autocomplete="off" data-vc-busca="fx_clientes" placeholder="Buscar cliente" value="${esc(ctx.filtro?.fx_clientes || '')}"></label></div>`;
    return feCasca('fin_clientes', d, `${numsCli}${barra}<div class="fe-duas">${feCard('', corpo, { cls: 'fe-lista fe-grade' })}<aside class="fe-lado" aria-label="Ficha">${lado}</aside></div>`);
  }

  // ---------- PESSOAS ----------
  const SOCIO_CATS = ['pro_labore', 'retirada_socio'];
  function fePessoas(ctx) {
    const d = feIniciar(ctx), u = ui.fe.pes, contas = d.contas_pessoas || [], mes = ui.fe.mes;
    const doMes = (c) => c.meses.find((m) => m.mes === mes) || { pago: 0, combinado: c.salario?.valor || 0 };
    const socio = (c) => !c.salario?.valor && c.itens.length && c.itens.every((i) => SOCIO_CATS.includes(i.categoria));
    const equipe = contas.filter((c) => !socio(c)), socios = contas.filter(socio);
    const combinado = equipe.reduce((s, c) => s + (doMes(c).combinado || 0), 0), pago = equipe.reduce((s, c) => s + (doMes(c).pago || 0), 0), vale = contas.reduce((s, c) => s + c.vale, 0);
    // Gente que não é fixa (Paulo, 24/11/2026): freela e prestador do mês, na mesma aba, para ter controle do variável.
    const variaveis = [];
    for (const t of d.transacoes || []) for (const p of X().pedacos(t)) if (p.categoria === 'freela' && p.valor < 0 && (p.competencia || p.data.slice(0, 7)) === mes)
      variaveis.push({ id: t.id, data: p.data, nome: p.pessoa_nome || t.real?.quem || t.banco.contraparte || t.banco.historico, texto: t.real?.descricao || '', valor: Math.abs(p.valor), pago: p.status === 'pago' });
    variaveis.sort((a, b) => b.data.localeCompare(a.data));
    const totalVar = variaveis.reduce((s, x) => s + x.valor, 0);
    const nums = `<div class="fe-nums">${[feNum({ rot: 'Combinado no mês', valor: esc(mil(combinado)), sub: 'de quem tem combinado' }), feNum({ rot: 'Já pago', valor: esc(mil(pago)), sub: combinado ? `${pc(pago, combinado)}% do combinado` : 'sem combinado informado' }),
      feNum({ rot: 'Vale acumulado', valor: esc(mil(vale)), tom: vale ? 'v' : '', sub: 'o que as pessoas devem à Vybe' }),
      feNum({ rot: 'Variáveis no mês', valor: esc(mil(totalVar)), sub: variaveis.length ? quantos(variaveis.length, 'pagamento a freela', 'pagamentos a freela') : 'nenhum freela neste mês' })].join('')}</div>`;
    const varCard = feCard(`Gente que não é fixa · ${soMes(mes)}`, (variaveis.length ? variaveis.map((x) => `<div class="fe-kv fe-orig"><span>${esc(x.nome)} <small>${esc(dataCurta(x.data))}${x.texto ? ' · ' + esc(x.texto) : ''}${x.pago ? '' : ' · ainda não pago'}</small></span><b>${esc(rs(x.valor))} <button type="button" class="fv2-link" data-fx="ir-lanc" data-valor="${esc(x.id)}" data-mes="${esc(x.data.slice(0, 7))}">abrir</button></b></div>`).join('')
      + `<div class="fe-gr fe-tot"><span>Total</span><b>${esc(rs(totalVar))}</b></div>` : '<p class="fe-sub">Nenhum freela ou prestador neste mês. Pix para quem não é fixo entra aqui quando a categoria é "Freela / prestador".</p>')
      + feBtn('Lançar gasto variável', 'data-fx="fe-var-novo"', 'k'), { cls: 'fe-var', dir: variaveis.length ? esc(rs(totalVar)) : '' });
    const linha = (c, ehSocio) => {
      const m = doMes(c), comb = m.combinado || 0, pg = m.pago || 0, sel = u.sel === c.pessoa_id;
      const topo = Math.max(comb, pg, 1) * 1.15, w = pc(Math.min(pg, comb || pg), topo), over = comb && pg > comb ? pc(pg - comb, topo) : 0;
      const prox = c.proximo && c.proximo.desconto ? `<small class="v">${esc(soMes(c.proximo.mes))}: recebe ${esc(rs(c.proximo.a_receber))}</small>` : m.desconto ? `<small class="v">recebe ${esc(rs(m.a_receber))} este mês</small>` : '';
      return `<div class="fe-p${sel ? ' sel' : ''}"><button type="button" class="fe-p-nome" data-fx="fe-pes" data-valor="${esc(c.pessoa_id)}" aria-pressed="${sel}"><span class="fe-av ${ehSocio ? 's' : 'c' + ([...String(c.nome)].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 4)}" aria-hidden="true">${esc(iniciais(c.nome))}</span><span><b>${esc(c.nome)}</b>${prox}</span></button>
        ${ehSocio ? `<span class="fe-sub">${quantos(c.itens.filter((i) => i.mes === mes).length, 'retirada', 'retiradas')} em ${esc(soMes(mes))}</span>` : `<span class="fe-trilho" aria-hidden="true"><i style="--v:${w}%"></i>${over ? `<i class="v" style="--l:${w}%;--v:${over}%"></i>` : ''}${comb ? `<em style="--l:${pc(comb, topo)}%"></em>` : ''}</span>`}
        <span class="rt">${comb ? esc(rs(comb)) : '—'}</span><button type="button" class="rt fe-p-num" data-fx="fe-pes" data-valor="${esc(c.pessoa_id)}" aria-label="De onde vem o que ${esc(c.nome)} recebeu em ${esc(soMes(mes))}">${esc(rs(pg))}</button><button type="button" class="rt fe-p-num${c.vale ? ' v' : ''}" data-fx="fe-pes" data-valor="${esc(c.pessoa_id)}" aria-label="De onde vem o vale de ${esc(c.nome)}">${c.vale ? esc(rs(c.vale)) : '—'}</button></div>`;
    };
    const cab = '<div class="fe-p fe-p-cab" aria-hidden="true"><span>Pessoa</span><span>Recebeu × combinado</span><span class="rt">Combinado</span><span class="rt">Recebeu</span><span class="rt">Vale</span></div>';
    const corpo = contas.length ? cab + equipe.map((c) => linha(c, false)).join('') + (socios.length ? `<p class="fe-dia">Sócios · pró-labore e retiradas</p>${socios.map((c) => linha(c, true)).join('')}` : '')
      + '<p class="fe-sub fe-pe">Recebeu é só o mês escolhido; Vale é o acumulado de todos os meses (o que passou do combinado), não se soma ao recebido. Sem combinado não há vale. Toque num valor para ver de onde vem.</p>'
      : '<div class="fe-vazio"><p>Nenhum Pix atribuído ao time ainda. No Movimento, diga para quem foi cada um.</p></div>';
    const c = contas.find((x) => x.pessoa_id === u.sel);
    let lado;
    if (ui.vorcaro.mao && u.variavel) lado = maoForm(d);
    else if (c) lado = feFichaPessoa(d, c);
    else {
      const foraIds = new Set(Object.entries(d.salarios || {}).filter(([, s]) => s?.fora).map(([id]) => id));
      const semConta = (d.pessoas || []).filter((p) => !contas.some((x) => x.pessoa_id === String(p.id)) && !foraIds.has(String(p.id)));
      const foraLista = (d.pessoas || []).filter((p) => foraIds.has(String(p.id)));
      lado = feCard('Informar o combinado', (semConta.length ? semConta.map((p) => `<div class="fx-mini fe-comb" data-fx-form="salario"><span>${esc(p.nome)}</span><input name="valor" class="fx-in fx-num" inputmode="decimal" placeholder="combinado" aria-label="Combinado de ${esc(p.nome)}">${selMes('desde', '', d, { vazio: 'desde sempre', rotulo: `Desde quando, ${p.nome}` })}<button type="button" class="fe-btn s v2-estado" data-fx="pessoa-salario" data-valor="${esc(p.id)}">Salvar</button><button type="button" class="fe-ico" data-fx="fe-pes-fora" data-valor="${esc(p.id)}" aria-label="Tirar ${esc(p.nome)} de Pessoas" title="Não recebe da Vybe: tirar da lista">${IC_FECHAR}</button></div>`).join('')
        : '<p class="fe-sub">Todo mundo do time já tem conta aqui. Toque numa pessoa para abrir a ficha.</p>')
        + (foraLista.length ? `<details class="fe-det"><summary>Fora de Pessoas · ${n0(foraLista.length)}</summary>${foraLista.map((p) => `<div class="fe-kv"><span>${esc(p.nome)}</span><b><button type="button" class="fv2-link" data-fx="fe-pes-volta" data-valor="${esc(p.id)}">trazer de volta</button></b></div>`).join('')}</details>` : ''), { cls: 'fe-ficha' });
    }
    return feCasca('fin_pessoas', d, `${nums}<div class="fe-duas">${feCard('', corpo, { cls: 'fe-lista' })}<aside class="fe-lado" aria-label="Ficha">${lado}</aside></div>${varCard}`);
  }
  // A ficha da pessoa: o vale mês a mês, o próximo salário já descontado e o "Descontar no salário" (Paulo, 23/11/2026).
  // De onde vem cada número da linha (Paulo, 24/11/2026: "se eu clicar não devia mostrar o que vem de cada valor?").
  function origemRecebido(c) {
    const mes = ui.fe.mes, its = c.itens.filter((i) => i.mes === mes && i.valor < 0), tot = its.reduce((s, i) => s - i.valor, 0);
    const lin = its.map((i) => `<div class="fe-kv fe-orig"><span>${esc(dataCurta(i.data))} · ${esc(i.historico)} <small>${esc(i.nome)}${i.data.slice(0, 7) !== i.mes ? ` · pago em ${esc(soMes(i.data.slice(0, 7)))}` : ''}</small></span><b>${esc(rs(-i.valor))} <button type="button" class="fv2-link" data-fx="ir-lanc" data-valor="${esc(i.id)}" data-mes="${esc(i.data.slice(0, 7))}">abrir</button></b></div>`).join('');
    return `<div class="fe-conta"><span class="fe-rot">Recebeu em ${esc(soMes(mes))}</span>${lin || '<p class="fe-sub">Nada atribuído a esta pessoa neste mês.</p>'}${its.length ? `<div class="fe-kv fe-tot"><span>Total do mês</span><b>${esc(rs(tot))}</b></div>` : ''}</div>`;
  }
  function origemVale(c, dentro = false) {
    if (!c.salario?.valor) return `<div class="fe-conta"><span class="fe-rot">Vale</span><p class="fe-sub">Sem combinado informado, nada do que ${esc(c.nome)} recebeu conta como vale. Informe o combinado aqui em cima para comparar.</p></div>`;
    const mov = c.meses.filter((m) => m.vale_do_mes || m.abatido || m.devolvido);
    if (!mov.length) return '';
    const lin = mov.map((m) => [m.vale_do_mes ? `<div class="fe-kv"><span>${esc(soMes(m.mes))}: recebeu ${esc(rs(m.pago))} de ${esc(rs(m.combinado))}</span><b class="v">+${esc(rs(m.vale_do_mes))}</b></div>` : '',
      m.abatido ? `<div class="fe-kv"><span>${esc(soMes(m.mes))}: abateu do salário</span><b>−${esc(rs(m.abatido))}</b></div>` : '',
      m.devolvido ? `<div class="fe-kv"><span>${esc(soMes(m.mes))}: devolveu</span><b>−${esc(rs(m.devolvido))}</b></div>` : ''].join('')).join('');
    const miolo = `${lin}<div class="fe-kv fe-tot"><span>Vale agora</span><b class="v">${esc(rs(c.vale))}</b></div>`;
    return dentro ? `<span class="fe-rot fe-sub-rot">De onde vem</span>${miolo}` : `<div class="fe-conta"><span class="fe-rot">De onde vem o vale</span>${miolo}</div>`;
  }
  // Mês num <select> (Paulo, 24/11/2026: "não consigo mudar a data"): o <input type="month"> não abre seletor no Safari do
  // Mac. Os 18 meses de trás até 3 à frente, e o valor de agora mesmo se estiver fora disso.
  function selMes(nome, valor, d, { vazio = '', rotulo = '', attrs = '' } = {}) {
    const base = (d.hoje || '').slice(0, 7) || ui.fe.mes, lista = [];
    for (let i = -18; i <= 3; i++) lista.push(X().somarMeses(base, i));
    if (valor && !lista.includes(valor)) lista.push(valor);
    lista.sort().reverse();
    return `<select name="${nome}" class="fx-sel"${attrs ? ` ${attrs}` : ''}${rotulo ? ` aria-label="${esc(rotulo)}"` : ''}>${vazio ? `<option value="">${esc(vazio)}</option>` : ''}${lista.map((m) => `<option value="${m}"${m === valor ? ' selected' : ''}>${esc(nomeMes(m))}</option>`).join('')}</select>`;
  }
  // A ficha da pessoa, em seções na ordem em que se usa (Paulo, 24/11/2026: "mal diagramado"): o combinado (mudar, tirar),
  // os números, o que recebeu no mês, o salário do mês e o próximo, o vale (de onde vem e jogar para o salário) e, no fim,
  // o histórico e "Tirar de Pessoas".
  function feFichaPessoa(d, c) {
    const u = ui.fe.pes, aberto = c.meses.find((m) => m.aberto), prox = c.proximo;
    const serie = c.meses.slice(-6).map((m) => ({ mes: m.mes, v: m.vale_acumulado }));
    const planos = (d.vales || []).filter((a) => String(a.pessoa_id) === c.pessoa_id && a.tipo === 'descontar');
    // Em que mês descontar: o mês aberto se o salário dele ainda não saiu inteiro, senão o seguinte.
    const alvo = aberto && aberto.pago < aberto.combinado ? aberto : prox;
    const sugerido = Math.min(c.vale, alvo?.combinado || c.vale);
    const contaMes = (m, rot) => (m && m.combinado ? `<div class="fe-conta"><span class="fe-rot">${esc(rot)}</span><div class="fe-kv"><span>Combinado</span><b>${esc(rs(m.combinado))}</b></div>
      ${m.desconto ? `<div class="fe-kv"><span>Desconto do vale</span><b class="v">−${esc(rs(m.desconto))}</b></div>` : ''}<div class="fe-kv fe-tot"><span>Vai receber</span><b>${esc(rs(m.a_receber))}</b></div>
      ${m.pago ? `<div class="fe-kv"><span>Já recebeu</span><b>${esc(rs(m.pago))}</b></div><div class="fe-kv"><span>Falta pagar</span><b>${esc(rs(m.falta_pagar || 0))}</b></div>` : ''}</div>` : '');
    const form = c.vale > 0 && alvo ? (u.desconto === c.pessoa_id
      ? `<div class="fe-desc" data-fx-form="ajuste"><input type="hidden" name="tipo" value="descontar"><div class="fe-dois"><label class="fx-campo"><span>Descontar</span><input name="valor" class="fx-in fx-num" inputmode="decimal" value="${esc(String(sugerido).replace('.', ','))}"></label>
          <label class="fx-campo"><span>No salário de</span>${selMes('mes', alvo.mes, d)}</label></div><input type="hidden" name="nota" value="desconto do vale no salário">
          <div class="fe-bts">${feBtn('Descontar', `data-fx="pessoa-ajuste" data-valor="${esc(c.pessoa_id)}"`, 'k v2-estado')}${feBtn('Cancelar', 'data-fx="fe-desconto" data-valor=""', 'q')}</div></div>`
      : feBtn(`Jogar o vale para ${soMes(alvo.mes)}`, `data-fx="fe-desconto" data-valor="${esc(c.pessoa_id)}"`, 'k')) : '';
    const tem = Boolean(c.salario?.valor);
    const combinado = `<div class="fe-conta fe-combinado" data-fx-form="salario"><span class="fe-rot">Combinado</span><div class="fe-dois">
        <label class="fx-campo"><span>Por mês</span><input name="valor" class="fx-in fx-num" inputmode="decimal" value="${tem ? esc(String(c.salario.valor).replace('.', ',')) : ''}" placeholder="0,00"></label>
        <label class="fx-campo"><span>Desde</span>${selMes('desde', c.salario?.desde || '', d, { vazio: 'sempre' })}</label></div>
      <div class="fe-bts">${feBtn(tem ? 'Salvar mudança' : 'Salvar combinado', `data-fx="pessoa-salario" data-valor="${esc(c.pessoa_id)}"`, 'k v2-estado')}${tem ? feBtn('Tirar combinado', `data-fx="fe-comb-tirar" data-valor="${esc(c.pessoa_id)}"`, 'q') : ''}</div></div>`;
    const vale = c.vale > 0 || planos.length || serie.some((s) => s.v) ? `<div class="fe-conta"><span class="fe-rot">Vale</span>
      ${serie.length > 1 && serie.some((s) => s.v) ? feLinha(serie, [], { rotulo: `Vale de ${c.nome} de ${soMes(serie[0].mes)} a ${soMes(serie[serie.length - 1].mes)}`, alto: 110, tom: 'v' }) : ''}
      ${c.salario?.valor ? origemVale(c, true) : ''}
      ${planos.length ? `<div class="fe-planos">${planos.map((a) => `<div class="fe-kv"><span>Desconto planejado em ${esc(soMes(a.mes))}</span><b>−${esc(rs(a.valor))} <button type="button" class="fv2-link" data-fx="pessoa-ajuste-tirar" data-valor="${esc(a.id)}">tirar</button></b></div>`).join('')}</div>` : ''}
      ${form}</div>` : origemVale(c);
    return feCard('', `<div class="fe-lado-cab"><div><span class="fe-rot">Ficha da pessoa</span><h3 class="fe-nome">${esc(c.nome)}</h3><span class="fe-sub">${tem ? `Combinado ${esc(rs(c.salario.valor))} por mês${c.salario.desde ? ` desde ${esc(soMes(c.salario.desde))}` : ''}` : 'Sem combinado informado'}</span></div><button type="button" class="fe-ico" data-fx="fe-pes" data-valor="${esc(c.pessoa_id)}" aria-label="Fechar ficha">${IC_FECHAR}</button></div>
      <div class="fe-mini3"><div class="${c.vale ? 'vv' : ''}"><small>Vale agora</small><b>${esc(rs(c.vale))}</b></div><div><small>A pagar</small><b>${esc(rs(c.a_pagar))}</b></div><div><small>Depois do desconto</small><b>${esc(rs(prox ? prox.vale_depois : c.vale))}</b></div></div>
      ${combinado}
      ${origemRecebido(c)}
      ${contaMes(aberto, `Salário de ${soMes(aberto?.mes)}`)}${prox?.desconto ? contaMes(prox, `Salário de ${soMes(prox.mes)}`) : ''}
      ${vale}
      <details class="fe-det"><summary>Histórico: mês a mês, Pix e ajustes à mão</summary>${cartaoPessoa(d, c, { semCombinado: true })}</details>
      <div class="fe-bts fe-fim-ficha">${feBtn('Tirar de Pessoas', `data-fx="fe-pes-fora" data-valor="${esc(c.pessoa_id)}"`, 'q')}<span class="fe-sub">some da lista e do "Falta pagar"; os Pix continuam no Movimento.</span></div>`, { cls: 'fe-ficha' });
  }

  // ---------- ASSINATURAS ----------
  // Programas e softwares (Paulo, 24/11/2026: "preciso de algo para controlar as assinaturas dos programas e softwares").
  // São os gastos fixos da categoria "Ferramentas e assinaturas": quanto custa por mês e por ano, se já foi paga no mês
  // (no extrato ou na fatura do cartão), se cobrou diferente, e o que parece assinatura e ainda não está cadastrado.
  function feAssinaturas(ctx) {
    const d = feIniciar(ctx), lista = d.transacoes || [], mes = ui.fe.mes, hoje = d.hoje || '';
    const fa = X().analisarFixos(d.fixos || [], lista, mes, d.cartao?.itens || []);
    const ass = fa.fixos.filter((f) => f.categoria === 'ferramentas');
    const paradas = (d.fixos || []).filter((f) => f.categoria === 'ferramentas' && !ass.some((a) => a.id === f.id));
    const total = ass.reduce((s, f) => s + f.valor, 0), pagas = ass.filter((f) => f.achado), dif = ass.filter((f) => f.diferenca && Math.abs(f.diferenca) >= 0.01);
    const faltam = ass.filter((f) => !f.achado), faltaV = faltam.reduce((s, f) => s + f.valor, 0);
    const nums = `<div class="fe-nums">${[
      feNum({ rot: 'Por mês', valor: esc(rs(total)), sub: quantos(ass.length, 'assinatura ativa', 'assinaturas ativas') }),
      feNum({ rot: 'Por ano', valor: esc(mil(total * 12)), sub: 'se nada mudar' }),
      feNum({ rot: `Pagas em ${soMes(mes)}`, valor: `${n0(pagas.length)} <small>de ${n0(ass.length)}</small>`, sub: faltam.length ? `falta ${esc(rs(faltaV))}` : 'todas pagas' }),
      feNum({ rot: 'Cobrou diferente', valor: n0(dif.length), tom: dif.length ? 'a' : '', sub: dif.length ? `${esc(comSinal(dif.reduce((s, f) => s + f.diferenca, 0)))} no mês` : 'tudo no valor combinado' }),
    ].join('')}</div>`;
    const sit = (f) => (f.achado ? ['g', `pago ${dataCurta(f.achado.data)}${f.achado.onde === 'cartao' ? ' no cartão' : ''}`] : f.vence < hoje ? ['r', `venceu dia ${f.dia}`] : ['n', `vence dia ${f.dia}`]);
    const sel = ui.fixos.editando;
    const linha = (f, parada = false) => { const [tom, txt] = parada ? ['', f.fim ? `parada desde ${soMes(f.fim)}` : 'parada'] : sit(f);
      return `<button type="button" class="fe-as${sel === f.id ? ' sel' : ''}${parada ? ' q' : ''}" data-fx="fixo-editar" data-valor="${esc(f.id)}" aria-pressed="${sel === f.id}"><span class="fe-as-nome"><b>${esc(f.nome)}</b><small>${esc(FORMA_NOME[f.forma] || 'Pix')} · dia ${n0(f.dia)}</small></span>
        ${feTag(txt, tom)}<span class="rt">${esc(rs(f.valor))}${f.diferenca && Math.abs(f.diferenca) >= 0.01 ? `<small class="a">cobrou ${esc(rs(f.achado.valor))}</small>` : ''}</span><span class="rt">${esc(mil(f.valor * 12))}</span></button>`; };
    const cab = '<div class="fe-as fe-as-cab" aria-hidden="true"><span>Assinatura</span><span>Em ' + esc(soMes(mes)) + '</span><span class="rt">Por mês</span><span class="rt">Por ano</span></div>';
    const corpo = ass.length || paradas.length
      ? cab + ass.slice().sort((a, b) => b.valor - a.valor).map((f) => linha(f)).join('') + (paradas.length ? `<p class="fe-dia">Paradas</p>${paradas.map((f) => linha(f, true)).join('')}` : '')
        + '<p class="fe-sub fe-pe">Paga quando aparece no extrato ou na fatura do cartão do mês. Toque numa assinatura para mudar valor, dia, forma ou parar.</p>'
      : '<div class="fe-vazio"><p>Nenhuma assinatura cadastrada ainda. Cadastre os programas que a Vybe paga todo mês.</p></div>';
    // O que parece assinatura e não está cadastrado: saídas do mês em "Ferramentas e assinaturas" que nenhuma assinatura achou.
    const usados = new Set(ass.filter((f) => f.achado?.id).map((f) => f.achado.id));
    const temNome = (txt) => ass.concat(paradas).some((f) => f.contem && semAcento(txt).includes(semAcento(f.contem)));
    const sug = [];
    for (const t of lista) if (t.banco.data.startsWith(mes) && !usados.has(t.id) && !t.real?.fixo_id && !temNome(t.banco.historico))
      for (const p of X().pedacos(t)) if (p.categoria === 'ferramentas' && p.valor < 0) sug.push({ nome: t.real?.quem || t.banco.historico, valor: Math.abs(p.valor), dia: Number(t.banco.data.slice(8, 10)), forma: 'pix' });
    for (const i of d.cartao?.itens || []) if (i.fatura === mes && i.categoria === 'ferramentas' && !temNome(i.descricao)) sug.push({ nome: i.descricao, valor: Math.abs(Number(i.valor) || 0), dia: Number(String(i.data || '').slice(8, 10)) || 1, forma: 'cartao' });
    const editando = (d.fixos || []).find((f) => f.id === sel);
    let lado;
    if (ui.fixos.novo || editando) lado = feCard(editando ? editando.nome : 'Nova assinatura', `<div class="fx-form-caixa">${fixoCampos(d, editando || ui.fixos.rascunho || { categoria: 'ferramentas', forma: 'cartao' })}</div>`,
      { dir: `<button type="button" class="fe-ico" data-fx="fixo-fechar" aria-label="Fechar">${IC_FECHAR}</button>`, cls: 'fe-ficha' });
    else lado = feCard('Parece assinatura', (sug.length ? sug.slice(0, 8).map((s) => `<div class="fe-kv fe-orig"><span>${esc(s.nome)} <small>${esc(FORMA_NOME[s.forma])} · dia ${n0(s.dia)}</small></span><b>${esc(rs(s.valor))} <button type="button" class="fv2-link" data-fx="fe-ass-sug" data-nome="${esc(s.nome)}" data-v="${esc(String(s.valor))}" data-dia="${esc(String(s.dia))}" data-forma="${esc(s.forma)}">cadastrar</button></b></div>`).join('')
      : `<p class="fe-sub">Nada em "Ferramentas e assinaturas" em ${esc(soMes(mes))} fora das cadastradas.</p>`) + feBtn('Nova assinatura', 'data-fx="fe-ass-nova"', 'k'), { cls: 'fe-ficha' });
    return feCasca('fin_assinaturas', d, `${nums}<div class="fe-duas">${feCard('', corpo, { cls: 'fe-lista' })}<aside class="fe-lado" aria-label="Ficha">${lado}</aside></div>`);
  }

  // ---------- ANÁLISE ----------
  function feAnalise(ctx) {
    const d = feIniciar(ctx), lista = d.transacoes || [], base = d.projecao?.base, up = ui.projecao;
    const meses = (d.meses || []).filter((m) => m <= ui.fe.mes).slice(-4);
    const resumos = meses.map((m) => ({ mes: m, r: X().resumo(lista, { mes: m }) }));
    const entraMedia = sumObj(base?.entradas_por_categoria), saiMedia = sumObj(base?.saidas_por_categoria);
    const saldo = base?.saldo_hoje ?? ultimoSaldo(lista)?.banco.saldo ?? null;
    const folego = saldo != null && saiMedia > 0 ? Math.max(0, Math.round(saldo / (saiMedia / 30))) : null;
    const fa = X().analisarFixos(d.fixos || [], lista, (d.hoje || '').slice(0, 7), d.cartao?.itens || []);
    const comb = Object.values(d.salarios || {}).reduce((s, x) => s + (Number(x?.valor) || 0), 0);
    const fixoPct = entraMedia ? Math.round((fa.total + comb) / entraMedia * 100) : null;
    // Concentração e dia do pagamento: as entradas ligadas a cliente nos meses da tela.
    const porCli = new Map(), diaPorMes = new Map();
    for (const t of lista) if (meses.includes(t.banco.data.slice(0, 7))) for (const p of X().pedacos(t)) if (p.cliente_id && p.valor > 0) {
      porCli.set(p.cliente_nome || nomeCliente(d, p.cliente_id) || 'Cliente', (porCli.get(p.cliente_nome || nomeCliente(d, p.cliente_id) || 'Cliente') || 0) + p.valor);
      const mm = p.data.slice(0, 7); diaPorMes.set(mm, [...(diaPorMes.get(mm) || []), Number(p.data.slice(8, 10))]);
    }
    const cli = [...porCli].sort((a, b) => b[1] - a[1]), totCli = cli.reduce((s, [, v]) => s + v, 0);
    const top3 = totCli ? Math.round(cli.slice(0, 3).reduce((s, [, v]) => s + v, 0) / totCli * 100) : null;
    const mens = (d.clientes || []).filter((c) => c.ativo !== false && c.mensalidade > 0);
    const ticket = mens.length ? mens.reduce((s, c) => s + c.mensalidade, 0) / mens.length : null;
    const media = (l) => (l?.length ? Math.round(l.reduce((s, v) => s + v, 0) / l.length) : null);
    const diaFim = media(diaPorMes.get(meses[meses.length - 1])), diaIni = media(diaPorMes.get(meses[0]));
    const nums = `<div class="fe-nums cinco">${[
      feNum({ rot: 'Fôlego do caixa', valor: folego == null ? '—' : quantos(folego, 'dia', 'dias'), tom: folego != null && folego < 30 ? 'r' : '', sub: 'quanto o saldo aguenta sem entrar nada' }),
      feNum({ rot: 'Fixo ÷ o que entra', valor: fixoPct == null ? '—' : `${fixoPct}%`, sub: 'fixos cadastrados + combinados ÷ média que entra' }),
      feNum({ rot: '3 maiores clientes', valor: top3 == null ? '—' : `${top3}%`, sub: cli.length ? `da receita · o maior é ${esc(cli[0][0])}` : 'sem entrada ligada a cliente' }),
      feNum({ rot: 'Ticket médio', valor: ticket == null ? '—' : esc(mil(ticket)), sub: `por cliente com mensalidade (${n0(mens.length)})` }),
      feNum({ rot: 'Dia médio do pagamento', valor: diaFim == null ? '—' : `dia ${n0(diaFim)}`, sub: diaIni != null && meses.length > 1 ? `era dia ${n0(diaIni)} em ${esc(soMes(meses[0]))}` : 'quando os clientes pagam' }),
    ].join('')}</div>`;
    // Resultado por grupo (DRE de caixa), em mil, com a tendência.
    const grupos = [...new Set(resumos.flatMap(({ r }) => saidasPorGrupo(d, r).map((g) => g.grupo)))];
    const valorG = (r, g) => saidasPorGrupo(d, r).find((x) => x.grupo === g)?.total || 0;
    const mediaEntra = resumos.reduce((s, { r }) => s + r.entradas, 0) / Math.max(1, resumos.length);
    const spark = (vals, tom = '') => { const mx = Math.max(...vals), mn = Math.min(...vals), h = (v) => 17 - ((v - mn) / ((mx - mn) || 1)) * 14; return `<svg class="d3-graf fe-spark${tom ? ' ' + tom : ''}" viewBox="0 0 60 20" aria-hidden="true"><polyline points="${vals.map((v, i) => `${(2 + i * 56 / Math.max(1, vals.length - 1)).toFixed(1)},${h(v).toFixed(1)}`).join(' ')}"/></svg>`; };
    const linhaD = (rot, vals, { attrs = '', tot = false, sinal = 1 } = {}) => {
      const pct = mediaEntra ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length / mediaEntra * 100) : 0;
      const sobe = vals[vals.length - 1] > vals[0];
      return `<tr${tot ? ' class="tot"' : ''}><th scope="row">${attrs ? `<button type="button" class="fe-elo" ${attrs}>${esc(rot)}</button>` : esc(rot)}</th>${vals.map((v) => `<td class="${tot ? (v < 0 ? 'r' : 'g') : ''}">${esc(emMil(sinal * v))}</td>`).join('')}<td>${tot ? '' : `${pct}%`}</td><td>${vals.length > 1 ? spark(vals, tot ? (sobe ? 'g' : 'r') : sinal > 0 ? (sobe ? 'g' : 'r') : (sobe ? 'a' : '')) : ''}</td></tr>`;
    };
    const dre = resumos.length ? `<div class="fe-rolo"><table class="fe-dre"><thead><tr><th scope="col">Grupo</th>${meses.map((m) => `<th scope="col">${esc(mes3(m))}</th>`).join('')}<th scope="col">% do que entra</th><th scope="col">Tendência</th></tr></thead><tbody>
      ${linhaD('Entrou', resumos.map(({ r }) => r.entradas), { attrs: feIr('fin_movimento', 'data-chip="entradas"') })}
      ${grupos.map((g) => linhaD(g, resumos.map(({ r }) => valorG(r, g)), { attrs: `data-fx="fe-grupo" data-valor="${esc(g)}"`, sinal: -1 })).join('')}
      ${linhaD('Resultado', resumos.map(({ r }) => r.resultado), { tot: true })}</tbody></table></div><p class="fe-sub">Em mil reais. O cartão entra pelo pagamento da fatura.</p>` : '<p class="fe-vazio">Sem extrato ainda.</p>';
    const maxC = cli[0]?.[1] || 1, outros = cli.slice(6).reduce((s, [, v]) => s + v, 0);
    const conc = cli.slice(0, 6).map(([n, v]) => `<div class="fe-gl"><span>${esc(n)}</span><span class="fe-barra"><i style="--v:${pc(v, maxC)}%"></i></span><b>${totCli ? Math.round(v / totCli * 100) : 0}%</b></div>`).join('')
      + (outros ? `<div class="fe-gl q"><span>Outros ${n0(cli.length - 6)}</span><span class="fe-barra q"><i style="--v:${pc(outros, Math.max(maxC, outros))}%"></i></span><b>${Math.round(outros / totCli * 100)}%</b></div>` : '');
    // E se…: os controles de sempre (cortes, clientes novos e perdidos, gastos novos, reajuste) e o caixa com e sem.
    let ese = feCard('E se…', '<p class="fe-vazio">Sem mês fechado e conferido para projetar.</p>');
    if (base?.meses_usados?.length) {
      const cen = cenarioAtual(d), sem = X().projetar(base, {}, up.horizonte), com = X().projetar(base, cen, up.horizonte);
      const mexeu = Boolean(cen.cortes.length || cen.economias.length || cen.clientes_novos.length || cen.clientes_perdidos.length || cen.gastos_novos.length || cen.ajuste_entradas_pct);
      const real = (d.serie || []).filter((s) => s.saldo_final != null).slice(-1).map((s) => ({ mes: s.mes, v: s.saldo_final }));
      const proj = sem.meses.map((m, i) => ({ mes: m.mes, v: m.saldo, c: mexeu ? com.meses[i].saldo : null }));
      const fim = sem.meses[sem.meses.length - 1]?.mes || '', resMes = mexeu ? com.meses[0]?.resultado : sem.meses[0]?.resultado;
      const horiz = feChips([3, 6, 12].map((n) => [String(n), `${n} meses`, null, `data-fx="horizonte" data-valor="${n}"`, up.horizonte === n]), 'Horizonte');
      ese = `<div class="fe-par fe-ese">${cenarioHtml(d, base)}${feCard(`Caixa nos próximos ${up.horizonte} meses`, `<div class="fe-tres"><div><small>Em ${esc(soMes(fim))}, se nada mudar</small><b class="${sem.saldo_final < 0 ? 'r' : ''}">${esc(mil(sem.saldo_final))}</b></div>
        ${mexeu ? `<div><small>Em ${esc(soMes(fim))}, com o cenário</small><b class="${com.saldo_final < 0 ? 'r' : 'g'}">${esc(mil(com.saldo_final))}</b></div>` : ''}<div><small>Resultado por mês</small><b>${esc(comSinal(resMes || 0))}</b></div></div>
        ${feLinha(real, proj, { rotulo: `Caixa até ${soMes(fim)}: ${mil(sem.saldo_final)} se nada mudar${mexeu ? ` e ${mil(com.saldo_final)} com o cenário` : ''}` })}
        <p class="fe-sub">Base: a média dos meses fechados do extrato (${esc(base.meses_usados.map((m) => soMes(m)).join(', '))}). O cenário é só simulação, não lança nada.</p>`, { dir: horiz })}</div>`;
    }
    return feCasca('fin_analise', d, `${nums}<div class="fe-duas">${feCard('Resultado por grupo · DRE de caixa', dre, { cls: 'fe-lista', dir: 'cada grupo abre os lançamentos dele' })}<aside class="fe-lado">${feCard('De quem vem a receita', conc || '<p class="fe-vazio">Nenhuma entrada ligada a cliente.</p>', { cls: 'fe-ficha', dir: meses.length ? `${esc(soMes(meses[0]))} a ${esc(soMes(meses[meses.length - 1]))}` : '' })}</aside></div>${ese}`);
  }

  // Ações das cinco telas (as de antes continuam em aoClicar).
  async function aoClicarFe(ev) {
    const b = ev.target.closest?.('[data-fx]'); if (!b || !b.closest('.fe')) return;
    const a = b.dataset.fx, valor = b.dataset.valor ?? '', d = dadosAtuais(), u = ui.fe;
    const limparLado = () => { ui.extrato.aberta = ''; ui.cartao.editando = ''; ui.cartao.novo = false; ui.cartao.colar = false; ui.fixos.editando = ''; ui.fixos.novo = false; ui.vorcaro.mao = false; u.lado = ''; };
    if (a.startsWith('fn-') && await aoClicarFin(a, b, valor, d)) return;
    switch (a) {
      case 'fe-mes': u.hud = ''; if (valor) { u.mes = valor; ui.extrato.mes = valor; ui.cartao.fatura = valor; ui.fixos.mes = valor; ui.extrato.aberta = ''; } return repintar();
      case 'fe-chip': limparLado(); u.chip = valor; u.grupo = ''; ui.extrato.cat = ''; ui.extrato.mostrar = 60; return feAbrir('fin_movimento');
      case 'fe-chip-fixo': limparLado(); u.chip = 'fixos'; ui.fixos.editando = valor; return feAbrir('fin_movimento');
      case 'fe-ass-nova': ui.fixos.novo = true; ui.fixos.editando = ''; ui.fixos.rascunho = { categoria: 'ferramentas', forma: 'cartao' }; return repintar();
      case 'fe-ass-sug': { const nome = b.dataset.nome || ''; ui.fixos.novo = true; ui.fixos.editando = '';
        ui.fixos.rascunho = { nome, valor: Number(b.dataset.v) || '', dia: Number(b.dataset.dia) || 1, forma: b.dataset.forma || 'pix', categoria: 'ferramentas', contem: nome.slice(0, 40) }; return repintar(); }
      case 'fe-contrato-salvar': {
        const f = b.closest('[data-fx-form="contrato"]'); if (!f) return;
        const v = valoresDe(f), vm = numero(v.valor_mensal);
        if (!(vm > 0)) { avisar('Informe o valor por mês do contrato.'); return; }
        indo(b);
        try {
          const semFim = f.querySelector('[name="sem_fim"]')?.checked;
          await post({ acao: 'contrato_salvar', cliente_id: valor, valor_mensal: vm, dia_vencimento: v.dia_vencimento || '', inicio: v.inicio || '', fim: semFim ? '' : v.fim || '', sem_fim: Boolean(semFim),
            reajuste_em: v.reajuste_em || '', reajuste_pct: v.reajuste_pct ? numero(v.reajuste_pct) : '', status: v.status || 'ativo', renovacao: v.renovacao || '', observacao: v.observacao || '' });
          avisar('Contrato salvo.', 'success'); await anfitriao.recarregar?.();
        } catch (e) { avisar(e.message); voltou(b); }
        return;
      }
      case 'fe-comb-tirar': return gravar({ acao: 'salario_salvar', pessoa_id: valor, valor: '' }, 'Combinado tirado.');
      case 'fe-pes-fora': { const nome = (d.pessoas || []).find((p) => String(p.id) === valor)?.nome || (d.contas_pessoas || []).find((c) => c.pessoa_id === valor)?.nome || 'Pessoa';
        const r = await gravar({ acao: 'pessoa_fora', pessoa_id: valor, fora: true });
        if (r) { if (u.pes.sel === valor) u.pes.sel = ''; repintar(); if (typeof mostrarDesfazer === 'function') mostrarDesfazer(`${nome} saiu de Pessoas.`, () => gravar({ acao: 'pessoa_fora', pessoa_id: valor, fora: false })); }
        return; }
      case 'fe-pes-volta': return gravar({ acao: 'pessoa_fora', pessoa_id: valor, fora: false }, 'Voltou para Pessoas.');
      case 'fe-var-novo': abrirLancarMao(); ui.vorcaro.cat = 'freela'; u.pes.variavel = true; u.pes.sel = ''; return repintar();
      case 'fe-grupo': u.hud = ''; limparLado(); u.grupo = valor; ui.extrato.cat = ''; u.chip = valor ? 'todos' : u.chip; return feAbrir('fin_movimento');
      case 'fe-lado': u.lado = u.lado === valor ? '' : valor; return repintar();
      case 'fe-sel-item': ui.cartao.editando = ui.cartao.editando === valor ? '' : valor; ui.cartao.novo = false; ui.cartao.colar = false; return repintar();
      case 'fe-pular': if (valor) u.pular.push(valor); else u.pular = []; return repintar();
      case 'fe-dividir': { // abre a ficha já com as duas metades (o mesmo "Dividir" do editor)
        const t = (d.transacoes || []).find((x) => x.id === valor); if (!t) return;
        const metade = Math.round(Math.abs(t.banco.valor) * 50) / 100;
        ui.extrato.aberta = valor;
        ui.extrato.partes[valor] = [{ valor: metade, cliente_id: t.real.cliente_id, cliente_nome: t.real.cliente_nome, categoria: t.real.categoria, competencia: t.real.competencia },
          { valor: Math.round((Math.abs(t.banco.valor) - metade) * 100) / 100, cliente_id: '', cliente_nome: '', categoria: t.real.categoria, competencia: t.real.competencia }];
        return repintar();
      }
      case 'fe-confirmar': {
        const t = (d.transacoes || []).find((x) => x.id === valor); if (!t) return;
        const carta = b.closest('.fe-carta'), regra = carta?.querySelector('[data-fe-regra]')?.checked;
        indo(b); carta?.classList.add('fe-sai');
        if (regra && t.banco.contraparte) await post({ acao: 'regra_salvar', regra: { contem: t.banco.contraparte.split(' ').slice(0, 2).join(' '), sinal: t.banco.valor < 0 ? 'saida' : 'entrada', revisar: false, categoria: t.real.categoria, quem: t.real.quem || '',
          cliente_id: t.real.cliente_id || '', cliente_nome: t.real.cliente_nome || '', pessoa_id: t.real.pessoa_id || '', pessoa_nome: t.real.pessoa_nome || '', fixo_id: t.real.fixo_id || '' } }).catch((e) => avisar(e.message));
        const r = await gravar({ acao: 'editar', id: valor, mudanca: { conferido: true } });
        if (!r) { voltou(b); carta?.classList.remove('fe-sai'); }
        return;
      }
      case 'fe-cli': u.cli.sel = u.cli.sel === String(valor) ? '' : String(valor); return feAbrir('fin_clientes');
      case 'fe-hud': u.hud = valor; return repintar();
      case 'fe-per': { const p = ui.fe.per; p.k = valor; if (valor === 'custom' && !p.de) { p.de = X().somarMeses(ui.fe.mes, -5); p.ate = ui.fe.mes; } return repintar(); }
      case 'fe-cli-chip': u.cli.chip = valor; return repintar();
      case 'fe-cli-mov': limparLado(); u.chip = 'entradas'; u.grupo = ''; if (anfitriao.filtro) anfitriao.filtro.fx_extrato = valor; return feAbrir('fin_movimento');
      case 'fe-pes': u.pes.sel = u.pes.sel === valor ? '' : valor; u.pes.desconto = ''; u.pes.variavel = false; ui.vorcaro.mao = false; return repintar();
      case 'fe-desconto': u.pes.desconto = valor; return repintar();
      default:
    }
  }
  // Leva um id de antes (ou das cinco) para a tela nova, já com o filtro: { chip, cat, mes, lado, mao }. Devolve o id novo.
  function feDe(aba, o = {}) {
    const nova = String(aba || '').startsWith('fin_') ? aba : FE_DE[aba];
    if (!nova) return '';
    const u = ui.fe;
    if (o.mes) { u.mes = o.mes; ui.extrato.mes = o.mes; ui.cartao.fatura = o.mes; ui.fixos.mes = o.mes; }
    if (nova === 'fin_movimento' && (o.chip || o.cat || o.lado || FE_CHIP[aba] || aba === 'extrato')) {
      ui.extrato.aberta = ''; ui.cartao.editando = ''; ui.fixos.editando = ''; u.grupo = '';
      u.chip = o.chip || FE_CHIP[aba] || 'todos'; ui.extrato.cat = o.cat || ''; u.lado = o.lado || '';
    }
    if (o.mao) { abrirLancarMao({ status: o.mao }); u.chip = 'todos'; }
    if (o.pes) { u.pes.sel = String(o.pes); u.pes.desconto = ''; u.pes.variavel = false; }
    if (o.fixo) { ui.fixos.editando = String(o.fixo); ui.fixos.novo = false; }
    if (o.cliChip) u.cli.chip = o.cliChip;
    if (o.sub) u.sub = o.sub;
    return nova;
  }
  // Abre uma das cinco (a mesma janela; o dock marca o item).
  function feAbrir(aba) {
    const el = document.querySelector(`.vv-trilho [data-submodulo="${aba}"]`);
    if (el && el.getClientRects().length && !el.closest('[aria-current="page"]') && anfitriao?.aba !== aba) { el.click(); return; }
    if (window.VybeComercial?.aberto?.() && document.querySelector(`.fe[data-tela="fe-${aba}"]`)) return repintar();
    window.VybeComercial?.abrir?.(aba, { abas: [aba], rotulo: 'Finanças' });
  }
  if (typeof document !== 'undefined' && document.addEventListener) { document.addEventListener('click', aoClicarFe); document.addEventListener('pointermove', aoPassarFe); document.addEventListener('pointerout', saiuDoGrafico);
    // Esc fecha só o HUD da rosca ou a prévia do extrato (antes de chegar ao Esc que fecha a janela).
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && ui.extrato.previa && !ui.extrato.lendo && document.querySelector('.fx .fe-imp')) { ev.preventDefault(); ev.stopImmediatePropagation(); ui.extrato.previa = null; ui.extrato.csv = ''; repintar(); return; }
      if (ev.key === 'Escape' && ui.fe.hud && document.querySelector('.fe .fe-hud')) { ev.preventDefault(); ev.stopImmediatePropagation(); ui.fe.hud = ''; document.querySelectorAll('.fe .fe-hud, .fe .fe-hud-veu').forEach((e) => e.remove()); } }, true); }

  // =====================================================================================================================
  // Finanças completo (Paulo, 26/11/2026: "preciso que seja FODA, COMPLETO… gráficos de linha, pizza, projeções,
  // históricos… inclusive o módulo sendo inteligente"). As contas vêm prontas do servidor (d.analise, montada por
  // server/financeiro-analise.js com shared/financeiro-analises.js); o "E se" refaz a projeção aqui, com as mesmas funções.
  // Gráficos: vybe-graficos.js (SVG próprio). O banco da Vybe é o Santander (extrato de 17/08 a 13/11/2026).
  // =====================================================================================================================
  const A = () => window.VybeFinancasAnalises;
  const G = () => window.VybeGraficos;
  ui.fe.sub = 'dre'; ui.fe.dreBase = 'competencia';
  ui.fe.lote = { marc: {}, cat: {}, regras: true, foco: 0 };
  ui.fe.cen = { contratar: [], aumentar: [], perder_maior: false, perder_maior_a_partir: 1, ajuste_entradas_pct: 0, nome: '', ver: 'base', comparar: {} };
  const FE_SUBS = [['dre', 'DRE'], ['recorrente', 'Recorrente'], ['margem', 'Margem'], ['receber', 'A receber'], ['orcamento', 'Orçamento'], ['historico', 'Histórico']];
  const ROT_MES = (m, anos = false) => ({ curto: curtoMes(m, anos), longo: nomeMes(m) });
  const variosAnos = (ms) => ms.length > 1 && ms[0].slice(0, 4) !== ms[ms.length - 1].slice(0, 4);
  // "base em 3 meses: confiança baixa" — em toda conta que usa média do histórico.
  const feConf = (c) => (c ? `<span class="fe-conf ${esc(c.nivel)}" title="${esc(c.motivo ? `Quanto histórico a conta usou. A confiança caiu porque ${c.motivo}.` : 'Quanto histórico a conta usou')}">${esc(String(c.texto).split(' · ')[0])}</span>` : '');
  // O porquê da confiança (fin2): com poucos contratos cadastrados, a conta vive da média do extrato e a tela diz isso.
  const feConfMotivo = (c) => (c?.motivo ? `A confiança é ${esc({ alta: 'alta', media: 'média', baixa: 'baixa' }[c.nivel] || c.nivel)} porque ${esc(c.motivo)}.` : '');
  const feCobertura = (cob) => (cob && cob.sem_contrato > 0 ? `<p class="fe-sub"><b>${esc(cob.texto)}</b>${cob.pct_receita != null ? ` · os contratos explicam ${cob.pct_receita}% da receita recente` : ''}. ${feBtn('Cadastrar contratos', feIr('fin_clientes'), 's')}</p>` : '');
  // O "por quê" de um número: o que puxou a variação, de onde vem e o link para os lançamentos.
  const fePorque = (texto, attrs = '') => `<p class="fe-porque"><span class="fe-rot">Por quê</span> ${texto}${attrs ? ` <button type="button" class="fe-elo" ${attrs}>ver lançamentos</button>` : ''}</p>`;

  // ---------- Extrato parado (Santander) ----------
  // O Paulo só tem o extrato de 17/08 a 13/11; o aviso diz há quantos dias parou e como trazer o próximo.
  function feParado(d) {
    const p = d.analise?.extrato_parado;
    if (!p?.parado) return '';
    const desde = p.ultimo ? dataCurta(new Date(Date.parse(p.ultimo + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10)) : '';
    return `<section class="fe-card fe-parado" aria-label="Extrato parado"><div class="fe-card-cab"><h2 class="fe-rot">Extrato parado há ${quantos(p.dias, 'dia', 'dias')}</h2><span class="fe-dir">${feArquivo('fe-btn k')}</span></div>
      <p>O último dia do banco aqui é <b>${esc(dataCurta(p.ultimo))}</b>. Tudo depois disso (saldo, projeção, a receber) é estimativa até o próximo extrato.</p>
      <ol class="fe-passos"><li>Entre no Santander Empresas (internet banking ou app) da conta PJ.</li><li>Abra <b>Conta corrente › Extrato</b> e escolha o período${desde ? ` a partir de <b>${esc(desde)}</b>` : ''} até hoje.</li>
      <li>Exporte em <b>OFX</b> (Money/Quicken) ou, se não tiver, em <b>CSV</b> ou <b>Excel (.xlsx)</b>.</li><li>Volte aqui e toque em <b>Importar extrato</b>: a prévia mostra o que entra antes de gravar, e o que já estava não duplica.</li></ol>
      <p class="fe-sub">O nome do menu pode mudar um pouco no Santander; o arquivo certo é o extrato da conta corrente, não a fatura do cartão.</p></section>`;
  }

  // ---------- Conferir em lote ----------
  function feLote(d) {
    const lista = d.transacoes || [], porId = new Map(lista.map((t) => [t.id, t]));
    const sug = (d.analise?.lote || []).filter((s) => porId.has(s.id)).sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.confianca] - { alta: 0, media: 1, baixa: 2 }[b.confianca]) || porId.get(b.id).banco.data.localeCompare(porId.get(a.id).banco.data));
    const L = ui.fe.lote;
    if (!sug.length) return '<p class="fe-vazio">Nada para conferir. Tudo do extrato já tem o lado real.</p>';
    const cats = categorias(d);
    const ORIG = { historico: (s) => `como as ${n0(s.vezes)} vezes de ${s.contraparte}`, regra: () => 'por uma regra', nenhuma: () => 'sem pista ainda' };
    const linhas = sug.map((s, i) => {
      const t = porId.get(s.id), cat = L.cat[s.id] || s.sugestao.categoria, marc = Boolean(L.marc[s.id]);
      const sinal = t.banco.valor < 0 ? 'saida' : 'entrada';
      const opcoes = cats.filter((c) => c.id === 'a_classificar' || c.tipo === sinal || c.tipo === 'transferencia').map((c) => `<option value="${esc(c.id)}"${c.id === cat ? ' selected' : ''}>${esc(c.nome)}</option>`).join('');
      const quem = s.sugestao.cliente_nome || s.sugestao.pessoa_nome || s.sugestao.quem || '';
      return `<div class="fe-lote-l${marc ? ' on' : ''}" tabindex="0" data-lote-i="${i}" data-lote-id="${esc(s.id)}">
        <label class="fe-lote-m"><input type="checkbox" data-fx-campo="fn-lote-marca" data-valor="${esc(s.id)}"${marc ? ' checked' : ''} aria-label="Marcar ${esc(t.banco.historico)}"></label>
        <span class="fe-bk"><small>${esc(dataCurta(t.banco.data))}</small> ${esc(t.banco.historico)}</span>
        <span class="fe-lote-s"><select class="fx-in" data-fx-campo="fn-lote-cat" data-valor="${esc(s.id)}" aria-label="Categoria de ${esc(t.banco.historico)}">${opcoes}</select>
          <small>${feTag(s.confianca === 'alta' ? 'confiança alta' : s.confianca === 'media' ? 'confiança média' : 'sem pista', s.confianca === 'alta' ? 'g' : s.confianca === 'media' ? 'a' : 'r')} ${esc(ORIG[s.origem](s))}${quem ? ` · ${esc(quem)}` : ''}</small></span>
        <span class="fe-val${t.banco.valor > 0 ? ' g' : ''}">${esc(comSinal(t.banco.valor))}</span></div>`;
    }).join('');
    const nMarc = Object.values(L.marc).filter(Boolean).length, nAlta = sug.filter((s) => s.confianca === 'alta').length;
    return `<div class="fe-lote" role="list" aria-label="Lançamentos para conferir em lote">
      <div class="fe-lote-ferr">${feBtn(`Marcar os de confiança alta (${n0(nAlta)})`, 'data-fx="fn-lote-alta"', 's')}${feBtn('Marcar todos', 'data-fx="fn-lote-todos"', 's')}${feBtn('Desmarcar', 'data-fx="fn-lote-nada"', 'q')}
        <label class="fe-check"><input type="checkbox" data-fx-campo="fn-lote-regras"${L.regras ? ' checked' : ''}> Cada confirmação vira regra</label>
        ${feBtn(`Confirmar ${n0(nMarc)} marcado${nMarc === 1 ? '' : 's'}`, 'data-fx="fn-lote-ok"', `k v2-estado${nMarc ? '' : ' fe-off'}`)}</div>
      <p class="fe-sub fe-teclas">Teclado: <kbd>j</kbd>/<kbd>k</kbd> ou setas andam, <kbd>x</kbd> marca, <kbd>Enter</kbd> confirma a linha, <kbd>a</kbd> confirma os marcados.</p>
      ${linhas}</div>`;
  }
  async function confirmarLote(ids, b) {
    const d = dadosAtuais(), L = ui.fe.lote, porId = new Map((d.analise?.lote || []).map((s) => [s.id, s]));
    const itens = ids.filter((id) => porId.has(id)).map((id) => { const s = porId.get(id).sugestao, cat = L.cat[id] || s.categoria;
      const m = { categoria: cat }; for (const k of ['cliente_id', 'cliente_nome', 'pessoa_id', 'pessoa_nome', 'quem', 'fixo_id']) if (s[k] && cat === s.categoria) m[k] = s[k];
      return { id, mudanca: m, regra: cat !== 'a_classificar' }; }).filter((x) => x.mudanca.categoria !== 'a_classificar');
    if (!itens.length) { avisar('Escolha a categoria antes de confirmar.'); return; }
    indo(b);
    const r = await gravar({ acao: 'conferir_lote', itens, regras: L.regras }, '');
    voltou(b);
    if (r) { for (const i of itens) delete L.marc[i.id]; avisar(`${quantos(r.conferidos, 'lançamento conferido', 'lançamentos conferidos')}${r.regras_novas ? `, ${quantos(r.regras_novas, 'regra nova', 'regras novas')}` : ''}.`, 'success'); }
  }
  // Teclado do lote: j/k ou setas andam; x ou espaço marca; Enter confirma a linha; a confirma os marcados.
  function teclaLote(ev) {
    const linha = ev.target.closest?.('.fe-lote-l'); if (!linha || ev.target.matches('select, input[type="text"]')) return;
    const todas = [...linha.parentElement.querySelectorAll('.fe-lote-l')], i = todas.indexOf(linha), k = ev.key;
    if (k === 'j' || k === 'ArrowDown') { ev.preventDefault(); todas[Math.min(todas.length - 1, i + 1)]?.focus(); }
    else if (k === 'k' || k === 'ArrowUp') { ev.preventDefault(); todas[Math.max(0, i - 1)]?.focus(); }
    else if (k === 'x' || k === ' ') { ev.preventDefault(); const id = linha.dataset.loteId; ui.fe.lote.marc[id] = !ui.fe.lote.marc[id]; ui.fe.lote.foco = i; repintar(); requestAnimationFrame(() => document.querySelector(`.fe-lote-l[data-lote-i="${i}"]`)?.focus()); }
    else if (k === 'Enter') { ev.preventDefault(); ui.fe.lote.foco = i; confirmarLote([linha.dataset.loteId], null); }
    else if (k === 'a') { ev.preventDefault(); confirmarLote(Object.keys(ui.fe.lote.marc).filter((x) => ui.fe.lote.marc[x]), null); }
  }
  function feLadoLote(d) {
    const sug = d.analise?.lote || [], conta = (c) => sug.filter((s) => s.confianca === c).length;
    return feCard('Conferir em lote', `<div class="fe-mini3"><div><small>Confiança alta</small><b class="g">${n0(conta('alta'))}</b></div><div><small>Média</small><b>${n0(conta('media'))}</b></div><div><small>Sem pista</small><b class="${conta('baixa') ? 'r' : ''}">${n0(conta('baixa'))}</b></div></div>
      <p class="fe-sub">O Vorcaro sugere pelo que já foi conferido com a mesma contraparte (o nome que vem no Pix ou no boleto) e pelas regras. Confirme muitos de uma vez ou um a um pelo teclado. Com "vira regra" marcado, o próximo extrato já chega classificado; as regras ficam em Regras, para editar.</p>`, { cls: 'fe-ficha' });
  }

  // ---------- ANÁLISE ----------
  function feAnaliseNova(ctx) {
    const d = feIniciar(ctx), an = d.analise;
    if (!an || !A() || !G()) return feAnalise(ctx);
    const sub = FE_SUBS.some(([k]) => k === ui.fe.sub) ? ui.fe.sub : 'dre';
    const pj = an.projecao, rec = an.recorrente, dreC = an.dre.competencia, ag = an.aging;
    const folegoDias = (() => { const s = ultimoSaldo(d.transacoes || [])?.banco.saldo, sai = pj?.premissas ? (pj.premissas.fixos + pj.premissas.combinados + pj.premissas.variaveis_base) : 0; return s != null && sai > 0 ? Math.max(0, Math.round(s / (sai / 30))) : null; })();
    const nums = `<div class="fe-nums cinco">${[
      feNum({ rot: 'Fôlego do caixa', valor: pj?.base.folego_meses != null ? quantos(pj.base.folego_meses, 'mês', 'meses') : folegoDias == null ? '—' : pj?.base.saldo_final >= 0 ? '12+ meses' : quantos(folegoDias, 'dia', 'dias'), tom: pj?.base.folego_meses != null && pj.base.folego_meses < 3 ? 'r' : '',
        sub: pj?.base.primeiro_dia_negativo ? `negativo em ${esc(dataCurta(pj.base.primeiro_dia_negativo))} no base` : 'no cenário base, até ficar negativo', attrs: feIr('fin_projecao') }),
      feNum({ rot: 'MRR de contrato', valor: esc(mil(rec.mrr)), sub: rec.mrr_estimado != null && rec.mrr_estimado !== rec.mrr ? `estimado ${esc(mil(rec.mrr_estimado))} pelo extrato${rec.cobertura ? ` · ${esc(rec.cobertura.com_contrato)} de ${esc(rec.cobertura.ativos)} com contrato` : ''}` : `${quantos(rec.meses[rec.meses.length - 1]?.ativos || 0, 'contrato ativo', 'contratos ativos')}`, attrs: 'data-fx="fn-sub" data-valor="recorrente"' }),
      feNum({ rot: 'Margem', valor: dreC.margem_total == null ? '—' : `${String(dreC.margem_total).replace('.', ',')}%`, tom: dreC.margem_total != null && dreC.margem_total < 0 ? 'r' : '', sub: `resultado ${esc(mil(dreC.total_resultado))} no período`, attrs: 'data-fx="fn-sub" data-valor="dre"' }),
      feNum({ rot: 'Vencido a receber', valor: esc(mil(ag.vencido)), tom: ag.vencido > 0 ? 'r' : '', sub: ag.vencido_incerto ? `${esc(mil(ag.vencido_incerto))} pode já ter entrado sem cliente` : ag.atraso_medio_dias ? `atraso médio de ${quantos(ag.atraso_medio_dias, 'dia', 'dias')}` : 'ninguém em atraso', attrs: 'data-fx="fn-sub" data-valor="receber"' }),
      feNum({ rot: 'Churn médio', valor: `${String(rec.churn_medio_pct).replace('.', ',')}%`, sub: 'da receita recorrente por mês', attrs: 'data-fx="fn-sub" data-valor="recorrente"' }),
    ].join('')}</div>`;
    const subs = `<nav class="fe-subs" aria-label="Análises">${FE_SUBS.map(([k, n]) => `<button type="button" class="fe-sub-b" data-fx="fn-sub" data-valor="${k}"${k === sub ? ' aria-current="true"' : ''}>${esc(n)}</button>`).join('')}${feConf(an.confianca)}</nav>`;
    const corpo = { dre: anDre, recorrente: anRecorrente, margem: anMargem, receber: anReceber, orcamento: anOrcamento, historico: anHistorico }[sub](d, an);
    return feCasca('fin_analise', d, `${nums}${subs}${corpo}`);
  }
  function anDre(d, an) {
    const base = ui.fe.dreBase === 'caixa' ? 'caixa' : 'competencia', r = an.dre[base], ms = r.meses;
    if (!ms.length) return feCard('DRE', '<p class="fe-vazio">Sem extrato ainda.</p>');
    const anos = variosAnos(ms);
    const spark = (vals, tom = '') => { const mx = Math.max(...vals), mn = Math.min(...vals), h = (v) => 17 - ((v - mn) / ((mx - mn) || 1)) * 14; return vals.length > 1 ? `<svg class="d3-graf fe-spark${tom ? ' ' + tom : ''}" viewBox="0 0 60 20" aria-hidden="true"><polyline points="${vals.map((v, i) => `${(2 + i * 56 / Math.max(1, vals.length - 1)).toFixed(1)},${h(v).toFixed(1)}`).join(' ')}"/></svg>` : ''; };
    const abre = ui.fe.dreAberta || '';
    // Nada rola: a tabela mostra os últimos 6 meses (no celular, os 3 últimos); "Ver os N meses" abre todos. O gráfico
    // embaixo continua com o período inteiro.
    const ini = ui.fe.dreTodos ? 0 : Math.max(0, ms.length - 6), vis = (a) => a.slice(ini), nV = ms.length - ini;
    const ca = (j) => (nV - j > 3 ? ' class="m-ant"' : nV - j === 3 ? ' class="m-3"' : ''), soma = (a) => Math.round(vis(a).reduce((s, v) => s + v, 0) * 100) / 100;
    const linha = (l) => { const mostrar = l.total !== 0 || l.id === 'receita';
      if (!mostrar) return '';
      const sobe = l.valores[l.valores.length - 1] > l.valores[0];
      return `<tr><th scope="row"><button type="button" class="fe-elo" data-fx="fn-dre-abre" data-valor="${esc(l.id)}" aria-expanded="${abre === l.id}">${esc(l.nome)}</button></th>${vis(l.valores).map((v, j) => `<td${ca(j)}>${esc(emMil(v * (l.sinal < 0 ? -1 : 1)))}</td>`).join('')}<td><b>${esc(emMil(soma(l.valores) * (l.sinal < 0 ? -1 : 1)))}</b></td><td class="fe-tend">${spark(l.valores, l.sinal > 0 ? (sobe ? 'g' : 'r') : (sobe ? 'a' : ''))}</td></tr>`
        + (abre === l.id ? l.categorias.map((c) => `<tr class="sub"><th scope="row"><button type="button" class="fe-elo" ${feIr('fin_movimento', `data-cat="${esc(c.categoria)}" data-chip="todos"`)}>${esc(c.nome)}</button></th>${vis(c.valores).map((v, j) => `<td${ca(j)}>${esc(emMil(v * (l.sinal < 0 ? -1 : 1)))}</td>`).join('')}<td>${esc(emMil(soma(c.valores) * (l.sinal < 0 ? -1 : 1)))}</td><td class="fe-tend"></td></tr>`).join('') : ''); };
    const recVis = soma(r.linhas[0].valores), margemVis = recVis > 0 ? Math.round(soma(r.resultado) / recVis * 1000) / 10 : null;
    const tab = `<div class="fe-rolo"><table class="fe-dre"><thead><tr><th scope="col">Linha</th>${vis(ms).map((m, j) => `<th scope="col"${ca(j)}>${esc(curtoMes(m, anos))}</th>`).join('')}<th scope="col">${ini ? `${nV} meses` : 'Período'}</th><th scope="col" class="fe-tend">Tendência</th></tr></thead><tbody>
      ${r.linhas.map(linha).join('')}
      <tr class="tot"><th scope="row">Resultado</th>${vis(r.resultado).map((v, j) => `<td class="${v < 0 ? 'r' : 'g'}${nV - j > 3 ? ' m-ant' : nV - j === 3 ? ' m-3' : ''}">${esc(emMil(v))}</td>`).join('')}<td class="${soma(r.resultado) < 0 ? 'r' : 'g'}"><b>${esc(emMil(soma(r.resultado)))}</b></td><td class="fe-tend">${spark(r.resultado, r.resultado[r.resultado.length - 1] >= r.resultado[0] ? 'g' : 'r')}</td></tr>
      <tr class="tot"><th scope="row">Margem</th>${vis(r.margem).map((v, j) => `<td${ca(j)}>${v == null ? '—' : `${String(v).replace('.', ',')}%`}</td>`).join('')}<td><b>${margemVis == null ? '—' : `${String(margemVis).replace('.', ',')}%`}</b></td><td class="fe-tend"></td></tr></tbody></table></div>
      ${ms.length > 6 ? `<button type="button" class="fe-elo fe-dre-todos" data-fx="fn-dre-todos">${ui.fe.dreTodos ? 'Ver só os últimos 6 meses' : `Ver os ${ms.length} meses`}</button>` : ''}
      <p class="fe-sub">Em mil reais. ${base === 'competencia' ? 'Por competência: cada lançamento no mês a que se refere; o cartão entra pelos itens da fatura (quando lançados).' : 'De caixa: cada lançamento no dia em que passou no banco; o cartão entra pelo pagamento da fatura.'} Empréstimo, aporte, retirada de sócio e transferência ficam fora do resultado${r.fora.total ? ` (${esc(mil(r.fora.total))} no período)` : ''}.</p>`;
    // Por quê: a linha que mais mudou entre os dois últimos meses.
    let porque = '';
    if (ms.length >= 2) {
      const i = ms.length - 1, dif = r.linhas.map((l) => ({ l, v: (l.valores[i] - l.valores[i - 1]) * l.sinal })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
      const dr = r.resultado[i] - r.resultado[i - 1];
      if (dif && dif.v) porque = fePorque(`O resultado de ${esc(soMes(ms[i]))} ${dr >= 0 ? 'subiu' : 'caiu'} ${esc(mil(Math.abs(dr)))} contra ${esc(soMes(ms[i - 1]))}; quem mais puxou foi <b>${esc(dif.l.nome)}</b> (${dif.v >= 0 ? 'ajudou' : 'pesou'} ${esc(mil(Math.abs(dif.v)))}). Fonte: o extrato do Santander com o lado real de cada lançamento.`, feIr('fin_movimento', `data-chip="todos" data-mes="${ms[i]}"`));
    }
    const custos = r.linhas.filter((l) => l.sinal < 0 && l.total);
    const graf = G().area({ rotX: ms.map((m) => ROT_MES(m, anos)), series: custos.map((l, k) => ({ nome: l.nome, vals: l.valores, cor: 'k' + ((k % 6) + 1) })), rotulo: 'Custos por linha da DRE, mês a mês' });
    const rr = G().barras({ rotX: ms.map((m) => ROT_MES(m, anos)), series: [{ nome: 'Receita', vals: r.linhas[0].valores, cor: 'k2' }, { nome: 'Resultado', vals: r.resultado, cor: 'k1' }], rotulo: 'Receita e resultado por mês' });
    const chips = feChips([['competencia', 'Competência'], ['caixa', 'Caixa']].map(([k, n]) => [k, n, null, `data-fx="fn-dre-base" data-valor="${k}"`, base === k]), 'Base da DRE');
    return `${feCard(`DRE ${base === 'competencia' ? 'por competência' : 'de caixa'}`, tab + porque, { dir: chips, cls: 'fe-lista' })}<div class="fe-par">${feCard('Receita × resultado', rr)}${feCard('Para onde vão os custos', graf)}</div>`;
  }
  function anRecorrente(d, an) {
    const rec = an.recorrente, ms = rec.meses.filter((m) => m.mrr || m.mrr_anterior || m.movimentos.length || m.com_extrato);
    if (!ms.length) return feCard('Receita recorrente', `<p class="fe-vazio">Nenhum contrato com valor por mês. Cadastre os contratos em Clientes (valor, dia do vencimento, início e fim).</p>${feBtn('Ir para Clientes', feIr('fin_clientes'), 'k')}`);
    const anos = variosAnos(ms.map((m) => m.mes)), ult = ms[ms.length - 1];
    // fin2: sem contrato cadastrado, o cliente entra pelo extrato (estimado) e nunca como "perdido" ou zero.
    const temEst = rec.mrr_estimado != null && rec.mrr_estimado !== rec.mrr, cob = rec.cobertura;
    const nums = `<div class="fe-nums cinco">${[
      feNum({ rot: 'MRR de contrato', valor: esc(mil(rec.mrr)), sub: `${quantos(ult.ativos, 'cliente', 'clientes')} com contrato` }),
      feNum({ rot: 'MRR estimado', valor: esc(mil(temEst ? rec.mrr_estimado : rec.mrr)), sub: temEst ? 'contratos + o que entra todo mês pelo extrato' : 'igual ao de contrato' }),
      feNum({ rot: temEst ? 'Ticket estimado' : 'Ticket médio', valor: esc(mil(temEst ? rec.ticket_estimado : rec.ticket)), sub: temEst ? `de contrato: ${esc(mil(rec.ticket))}` : 'MRR ÷ clientes ativos' }),
      feNum({ rot: 'LTV', valor: (temEst ? rec.ltv_estimado : rec.ltv) == null ? '—' : esc(mil(temEst ? rec.ltv_estimado : rec.ltv)), sub: rec.vida_media_meses == null ? 'sem início de contrato para medir a vida média' : `ticket × vida média de ${quantos(rec.vida_media_meses, 'mês', 'meses').replace('.', ',')} (${quantos(rec.vidas_conhecidas, 'contrato', 'contratos')})` }),
      feNum({ rot: 'Churn médio', valor: `${String(rec.churn_medio_pct).replace('.', ',')}%`, tom: rec.churn_medio_pct > 5 ? 'r' : '', sub: cob?.sem_contrato ? 'só dos contratos cadastrados' : 'receita perdida ÷ MRR do mês anterior' }),
    ].join('')}</div>`;
    const linhaMrr = G().linhaFaixa({ rotX: ms.map((m) => ROT_MES(m.mes, anos)), series: [{ nome: 'MRR de contrato', vals: ms.map((m) => m.mrr), cor: 'k1' },
      ...(ms.some((m) => m.com_extrato != null && m.recebido_sem_contrato) ? [{ nome: 'Com o que entrou sem contrato', vals: ms.map((m) => m.com_extrato), cor: 'k2', trac: true }] : [])], rotulo: 'MRR mês a mês', zero: true });
    const casc = G().cascata({ passos: [{ nome: `MRR ${mes3(X().somarMeses(ult.mes, -1))}`, valor: ult.mrr_anterior, tipo: 'total' }, { nome: 'Novo', valor: ult.novo }, { nome: 'Expansão', valor: ult.expansao }, { nome: 'Contração', valor: ult.contracao }, { nome: 'Perdido', valor: ult.perdido }, { nome: `MRR ${mes3(ult.mes)}`, valor: ult.mrr, tipo: 'total' }], rotulo: `De onde veio a mudança do MRR em ${soMes(ult.mes)}` });
    const TIPO = { novo: ['g', 'novo'], expansao: ['g', 'aumentou'], contracao: ['a', 'reduziu'], perdido: ['r', 'saiu'] };
    const movs = ms.slice().reverse().flatMap((m) => m.primeiro ? [] : m.movimentos.map((x) => ({ ...x, mes: m.mes }))).slice(0, 14);
    const lista = movs.map((x) => `<button type="button" class="fe-al" data-fx="fe-cli" data-valor="${esc(x.cliente_id)}"><i class="fe-dot ${TIPO[x.tipo][0]}" aria-hidden="true"></i><span><b>${esc(x.cliente_nome)}</b><small>${esc(TIPO[x.tipo][1])} em ${esc(soMes(x.mes))}</small></span><b class="fe-al-v">${esc(comSinal(x.valor))}</b></button>`).join('') || '<p class="fe-vazio">Nenhuma mudança de contrato no período.</p>';
    const porque = fePorque(`O MRR de contrato soma o valor por mês de cada contrato vigente (início, fim e reajuste respeitados). Quem saiu conta até o fim do contrato ou a saída registrada na Carteira. Fonte: contratos do Vybe OS.${temEst ? ` O estimado soma a isso a média, nos meses fechados do extrato, de quem paga sem contrato (${quantos((rec.estimados || []).length, 'cliente identificado', 'clientes identificados')}${rec.sem_identificar ? ` e ${esc(mil(rec.sem_identificar))} de Pix ou boleto de cliente ainda sem dizer de quem` : ''}). Cliente sem contrato não aparece como novo nem perdido na cascata.` : ''}`);
    return `${nums}${feCobertura(cob)}<div class="fe-par">${feCard('MRR mês a mês', linhaMrr + porque)}${feCard(`Cascata de ${soMes(ult.mes)}`, casc)}</div>${feCard('Quem mudou', lista, { cls: 'fe-lista' })}`;
  }
  function anMargem(d, an) {
    const mg = an.margem, ms = mg.meses;
    if (!mg.linhas.length) return feCard('Margem por cliente', '<p class="fe-vazio">Nenhuma entrada ou saída ligada a cliente ainda. Ligue os recebimentos ao cliente no Movimento.</p>');
    const anos = variosAnos(ms);
    const regra = mg.regra.includes('pecas') ? 'pelas peças que cada cliente consumiu na produção (vybe_conteudos ligados a ele, não cancelados, pelo mês da veiculação)' : 'pela parte da receita de cada cliente (não há peças da produção registradas nesses meses)';
    const explica = `<p class="fe-regra"><b>Como a conta é feita.</b> Margem = o que o cliente pagou − o custo direto dele (saídas e itens do cartão ligados a ele) − a parte dele no custo de equipe do mês. A parte da equipe é dividida ${regra}. Num mês sem peça, vale a parte da receita.</p>`;
    const rank = G().barrasH({ itens: mg.linhas.slice(0, 15).map((l) => ({ nome: l.cliente_nome, valor: l.margem, sub: `${l.margem_pct == null ? '' : String(l.margem_pct).replace('.', ',') + '% · '}${quantos(l.pecas, 'peça', 'peças')}`, attrs: `data-fx="fe-cli" data-valor="${esc(l.cliente_id)}"` })), rotulo: 'Margem por cliente no período' });
    const calor = G().calor({ colunas: ms.map((m) => ROT_MES(m, anos)), linhas: mg.linhas.slice(0, 15).map((l) => ({ nome: l.cliente_nome, vals: l.por_mes.map((p) => (p.receita || p.custo ? p.margem : null)), attrs: `data-fx="fe-cli" data-valor="${esc(l.cliente_id)}"` })), rotulo: 'Margem por cliente e mês' });
    const tab = `<div class="fe-rolo"><table class="fe-dre fe-mgt"><thead><tr><th scope="col">Cliente</th><th scope="col">Receita</th><th scope="col">Custo direto</th><th scope="col">Equipe (rateio)</th><th scope="col">Margem</th><th scope="col">%</th><th scope="col">Peças</th><th scope="col">Custo por peça</th></tr></thead><tbody>
      ${mg.linhas.map((l) => `<tr><th scope="row"><button type="button" class="fe-elo" data-fx="fe-cli" data-valor="${esc(l.cliente_id)}">${esc(l.cliente_nome)}</button></th><td>${esc(mil(l.receita))}</td><td>${esc(mil(l.custo_direto))}</td><td>${esc(mil(l.custo_equipe))}</td><td class="${l.margem < 0 ? 'r' : 'g'}">${esc(mil(l.margem))}</td><td>${l.margem_pct == null ? '—' : String(l.margem_pct).replace('.', ',') + '%'}</td><td>${n0(l.pecas)}</td><td>${l.custo_por_peca == null ? '—' : esc(rs(l.custo_por_peca))}</td></tr>`).join('')}</tbody></table></div>`;
    const semRec = (mg.sem_receita || []).length ? `<p class="fe-sub">${esc((mg.sem_receita || []).slice(0, 6).map((l) => l.cliente_nome).join(', '))}${mg.sem_receita.length > 6 ? ` e mais ${n0(mg.sem_receita.length - 6)}` : ''}: sem recebimento ligado ao cliente no extrato, então não ${mg.sem_receita.length === 1 ? 'entra' : 'entram'} como prejuízo. O pagamento pode estar entre as entradas sem cliente.</p>` : '';
    const prej = mg.prejuizo.length ? `<div class="fe-alerta">${mg.prejuizo.slice(0, 5).map((l) => `<button type="button" class="fe-al" data-fx="fe-cli" data-valor="${esc(l.cliente_id)}"><i class="fe-dot r" aria-hidden="true"></i><span><b>${esc(l.cliente_nome)} dá prejuízo</b><small>custou ${esc(mil(l.custo_direto + l.custo_equipe))} e trouxe ${esc(mil(l.receita))}</small></span><b class="fe-al-v">${esc(mil(l.margem))}</b></button>`).join('')}</div>` : '<p class="fe-sub">Nenhum cliente com prejuízo no período.</p>';
    const prejSem = prej + semRec;
    return `${explica}<div class="fe-par">${feCard('Ranking de margem', rank)}${feCard('Clientes com prejuízo', prejSem)}</div>${feCard('Cliente × mês', calor)}${feCard('Margem real por cliente', tab, { cls: 'fe-lista' })}`;
  }
  function anReceber(d, an) {
    const ag = an.aging;
    const faixas = `<div class="fe-nums cinco">${ag.faixas.map((f) => feNum({ rot: f.nome, valor: esc(mil(f.total)), tom: f.id !== 'em_dia' && f.total > 0 ? 'r' : '', sub: quantos(f.quantos, 'mensalidade', 'mensalidades') })).join('')}</div>`;
    const graf = G().barras({ rotX: ag.faixas.map((f) => ({ curto: f.nome.replace(' dias', 'd'), longo: f.nome })), series: [{ nome: 'A receber', vals: ag.faixas.map((f) => f.total), cor: 'k4' }], rotulo: 'A receber por idade' });
    const lista = ag.itens.map((i) => `<div class="fe-lin fe-rec"><span class="fe-bk"><b>${esc(i.cliente_nome)}</b> · ${esc(soMes(i.mes))} · venceu ${esc(dataCurta(i.vence))}</span>
      <span class="fe-real">${i.incerto ? feTag('pode já ter entrado', 'i') : i.atraso_dias ? feTag(`${quantos(i.atraso_dias, 'dia', 'dias')} de atraso`, i.atraso_dias > 30 ? 'r' : 'a') : feTag('em dia', 'g')}${i.cobrado_em ? `<small>cobrado ${esc(dataCurta(i.cobrado_em))}${i.cobrado_por ? ` por ${esc(i.cobrado_por.split(' ')[0])}` : ''}</small>` : ''}
        ${i.atraso_dias ? `<button type="button" class="fe-btn s v2-estado" data-fx="fn-cobrar" data-valor="${esc(i.cliente_id)}" data-nome="${esc(i.cliente_nome)}" data-dias="${i.atraso_dias}">Cobrar</button>` : ''}</span><span class="fe-val g">${esc(rs(i.valor))}</span></div>`).join('') || '<p class="fe-vazio">Nada a receber em aberto.</p>';
    return `${faixas}<div class="fe-par">${feCard('A receber por idade', graf + `<p class="fe-sub">O vencimento é o dia do contrato de cada cliente (sem o dia cadastrado, o último dia do mês). Atraso médio de quem está vencido: ${quantos(ag.atraso_medio_dias, 'dia', 'dias')}. Cliente sem contrato só aparece aqui se alguém marcou o mês em aberto: nada de vencido inventado.${ag.vencido_incerto ? ` ${esc(mil(ag.vencido_incerto))} (${quantos(ag.incertos, 'mensalidade', 'mensalidades')}) pode já ter entrado: no mesmo mês há Pix ou boleto de cliente sem dizer de quem. Ligue a entrada ao cliente no Movimento para tirar a dúvida.` : ''}</p>`)}
      ${feCard('Cobrar', '<p>"Cobrar" só registra a cobrança e avisa os outros donos no Vybe OS. O VYBES <b>não</b> fala com o cliente sobre dinheiro: quem fala é um de vocês.</p>', { cls: 'fe-ficha' })}</div>${feCard('Quem está devendo', lista, { cls: 'fe-lista' })}`;
  }
  function anOrcamento(d, an) {
    const mes = ui.fe.mes || (d.hoje || '').slice(0, 7), o = A().orcadoReal(an.orcamento.guardado, d.transacoes || [], mes), guard = an.orcamento.guardado[mes] || {};
    const sug = an.orcamento.sugestao || {}, grupos = an.orcamento.grupos;
    const ant = X().somarMeses(mes, -1), temAnt = Object.keys(an.orcamento.guardado[ant] || {}).length > 0;
    const linhas = grupos.map((g) => { const l = o.linhas.find((x) => x.grupo === g) || { orcado: 0, real: 0, desvio: 0, desvio_pct: null, estourou: false };
      return `<tr><th scope="row">${esc(g)}</th><td><input class="fx-in fx-num" name="${esc(g)}" inputmode="decimal" aria-label="Orçado para ${esc(g)}" placeholder="${sug[g] ? esc(String(sug[g]).replace('.', ',')) : '0'}" value="${guard[g] != null ? esc(String(guard[g]).replace('.', ',')) : ''}"></td>
        <td class="${l.estourou ? 'r' : ''}">${esc(mil(l.real))}</td><td class="${l.estourou ? 'r' : l.orcado ? 'g' : ''}">${l.orcado ? `${l.desvio > 0 ? '+' : ''}${esc(mil(l.desvio))}${l.desvio_pct != null ? ` (${l.desvio_pct > 0 ? '+' : ''}${l.desvio_pct}%)` : ''}` : '—'}</td></tr>`; }).join('');
    const form = `<div data-fx-form="orcamento"><div class="fe-rolo"><table class="fe-dre fe-orc"><thead><tr><th scope="col">Grupo</th><th scope="col">Orçado</th><th scope="col">Realizado</th><th scope="col">Desvio</th></tr></thead><tbody>${linhas}
      <tr class="tot"><th scope="row">Total</th><td>${esc(mil(o.orcado))}</td><td>${esc(mil(o.real))}</td><td class="${o.desvio > 0 && o.orcado ? 'r' : ''}">${o.orcado ? esc(mil(o.desvio)) : '—'}</td></tr></tbody></table></div>
      <div class="fe-bts">${feBtn('Salvar orçamento', `data-fx="fn-orc-salvar" data-valor="${mes}"`, 'k v2-estado')}${feBtn('Usar a média como base', 'data-fx="fn-orc-sug"', 's')}
        ${temAnt ? `<label class="fx-campo fe-curto"><span>Ajuste %</span><input class="fx-in fx-num" name="pct" inputmode="decimal" value="0" data-fx-orc-pct></label>${feBtn(`Copiar de ${soMes(ant)}`, `data-fx="fn-orc-copiar" data-valor="${mes}" data-de="${ant}"`, 's v2-estado')}` : ''}</div>
      <p class="fe-sub">O realizado é o que saiu do banco no mês, pelo grupo da categoria. O cinza no campo é a média dos meses fechados (${feConf(an.confianca)}).</p></div>`;
    const ms = an.orcamento.meses.filter((x) => x.tem_orcamento || x.real);
    const graf = G().barras({ rotX: ms.map((x) => ROT_MES(x.mes)), series: [{ nome: 'Orçado', vals: ms.map((x) => (x.tem_orcamento ? x.orcado : null)), cor: 'k0' }, { nome: 'Realizado', vals: ms.map((x) => x.real), cor: 'k1' }], rotulo: 'Orçado e realizado por mês' });
    const est = o.estourados.length ? fePorque(`${o.estourados.map((e) => `<b>${esc(e.grupo)}</b> passou ${esc(mil(e.desvio))}`).join(', ')} do orçado em ${esc(soMes(mes))}.`, feIr('fin_movimento', `data-chip="saidas" data-mes="${mes}"`)) : '';
    return `<div class="fe-par">${feCard(`Orçamento de ${soMes(mes)}`, form + est, { cls: 'fe-lista' })}${feCard('Orçado × realizado', graf)}</div>`;
  }
  function anHistorico(d, an) {
    const h = an.historico;
    if (!h.linhas.length) return feCard('Histórico', '<p class="fe-vazio">Sem extrato ainda.</p>');
    const ms = h.linhas.map((l) => l.mes), anos = variosAnos(ms);
    const graf = G().linhaFaixa({ rotX: ms.map((m) => ROT_MES(m, anos)), series: [{ nome: 'Entrou', vals: h.linhas.map((l) => l.entradas), cor: 'k2' }, { nome: 'Saiu', vals: h.linhas.map((l) => l.saidas), cor: 'k5' }, { nome: 'Resultado', vals: h.linhas.map((l) => l.resultado), cor: 'k1', trac: true }], rotulo: `Entradas, saídas e resultado de ${nomeMes(h.de)} a ${nomeMes(h.ate)}` });
    const pct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`);
    const tab = `<div class="fe-rolo"><table class="fe-dre"><thead><tr><th scope="col">Mês</th><th scope="col">Entrou</th><th scope="col">Saiu</th><th scope="col">Resultado</th><th scope="col">Entradas × mês anterior</th><th scope="col">Saídas × mês anterior</th>${h.tem_ano_anterior ? '<th scope="col">× mesmo mês do ano passado</th>' : ''}</tr></thead><tbody>
      ${h.linhas.slice().reverse().map((l) => `<tr><th scope="row">${esc(nomeMes(l.mes))}</th><td>${esc(mil(l.entradas))}</td><td>${esc(mil(l.saidas))}</td><td class="${l.resultado < 0 ? 'r' : 'g'}">${esc(mil(l.resultado))}</td><td>${pct(l.vs_anterior?.entradas)}</td><td>${pct(l.vs_anterior?.saidas)}</td>${h.tem_ano_anterior ? `<td>${l.vs_ano_anterior ? `${pct(l.vs_ano_anterior.entradas)} entradas` : '—'}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
    const saz = h.sazonalidade ? feCard('Sazonalidade', G().barras({ rotX: h.sazonalidade.map((s) => ({ curto: MES_CURTO[s.mes_do_ano - 1], longo: MESES[s.mes_do_ano - 1] })), series: [{ nome: 'Entra (média)', vals: h.sazonalidade.map((s) => s.entradas), cor: 'k2' }, { nome: 'Sai (média)', vals: h.sazonalidade.map((s) => s.saidas), cor: 'k5' }], rotulo: 'Média por mês do ano' }))
      : `<p class="fe-aviso12">${esc(h.aviso_12)}</p>`;
    return `${feCard(`Todo o período · ${quantos(h.meses, 'mês', 'meses')} de extrato`, graf, { dir: feConf(an.confianca) })}${saz}${feCard('Mês a mês', tab, { cls: 'fe-lista' })}`;
  }

  // ---------- PROJEÇÃO ----------
  // O "E se" de agora (o que está nos controles) por cima do cenário base.
  const cenFe = () => { const c = ui.fe.cen; return { contratar: c.contratar.filter((x) => numero(x.salario) > 0).map((x) => ({ ...x, salario: numero(x.salario) })), aumentar: c.aumentar.filter((x) => x.cliente_id && numero(x.pct)).map((x) => ({ ...x, pct: numero(x.pct) })),
    perder_maior: c.perder_maior, perder_maior_a_partir: c.perder_maior_a_partir, ajuste_entradas_pct: numero(c.ajuste_entradas_pct) }; };
  const mexeuFe = (c) => Boolean(c.contratar.length || c.aumentar.length || c.perder_maior || c.ajuste_entradas_pct);
  function projetarFe(d, cenario = {}) {
    const an = d.analise;
    return A().projecao3({ hoje: d.hoje, saldo_hoje: ultimoSaldo(d.transacoes || [])?.banco.saldo || 0, lista: d.transacoes || [], meses_base: an.meses_base, contratos: an.contratos.filter((c) => c.ativo && c.valor_mensal > 0), clientes_ativos: an.clientes_ativos || null,
      fixos: d.fixos || [], salarios: d.salarios || {}, pessoas: d.pessoas || [], itensCartao: d.cartao?.itens || [], risco: an.risco, pipeline: an.pipeline, atraso_medio: an.atraso_medio_dias ?? 10, horizonte: 12, cenario });
  }
  function feProjecao(ctx) {
    const d = feIniciar(ctx), an = d.analise;
    if (!an || !A() || !G()) return feCasca('fin_projecao', d, feCard('Projeção', '<p class="fe-vazio">Importe o extrato da conta PJ para ver a projeção em três cenários.</p>'));
    const c = cenFe(), mexeu = mexeuFe(c), pj = mexeu ? projetarFe(d, c) : an.projecao, semCen = an.projecao;
    const ms = pj.meses, anos = variosAnos(ms);
    const conf = feConf(pj.confianca);
    const NOMES = { pessimista: 'Pessimista', base: 'Base', otimista: 'Otimista' };
    const cart = (k) => { const s = pj[k]; return `<div class="fe-cen3-c ${k}"><small>${NOMES[k]}</small><b class="${s.saldo_final < 0 ? 'r' : ''}">${esc(mil(s.saldo_final))}</b><span>${s.primeiro_dia_negativo ? `negativo em ${esc(dataCurta(s.primeiro_dia_negativo))}/${s.primeiro_dia_negativo.slice(2, 4)}` : 'não fica negativo em 12 meses'}</span><span>fôlego: ${s.folego_meses == null ? '12+ meses' : quantos(s.folego_meses, 'mês', 'meses')} · menor saldo ${esc(mil(s.menor_saldo))}</span></div>`; };
    const graf = G().linhaFaixa({ rotX: ms.map((m) => ROT_MES(m, anos)), series: [{ nome: 'Base', vals: pj.base.meses.map((m) => m.saldo), cor: 'k1' }, ...(mexeu ? [{ nome: 'Base sem o "E se"', vals: semCen.base.meses.map((m) => m.saldo), cor: 'k0', trac: true }] : [])],
      faixa: { nome: 'Pessimista a otimista', de: pj.pessimista.meses.map((m) => m.saldo), ate: pj.otimista.meses.map((m) => m.saldo) }, rotulo: 'Saldo no fim de cada mês: base, e a faixa entre o pessimista e o otimista' });
    const pr = pj.premissas;
    const rcb = pr.receita || null;
    const receitaBase = rcb ? `<li><b>Receita da base:</b> ${esc(mil(rcb.projetada))}/mês, contra ${esc(mil(rcb.media_recente))} de média real recente: contratos ${esc(mil(rcb.contratos))}${rcb.clientes_estimados ? `, ${quantos(rcb.clientes_estimados, 'cliente sem contrato', 'clientes sem contrato')} pela média de cada um no extrato ${esc(mil(rcb.estimados))} (estimado pelo extrato)` : ''}, e ${esc(mil(rcb.outras))} das entradas sem cliente identificado e outras entradas, pela média${rcb.deduzido ? ` (já sem ${esc(mil(rcb.deduzido))} de mensalidade de contrato que não aparece ligada ao cliente)` : ''}${rcb.complemento ? `; mais ${esc(mil(rcb.complemento))} de complemento para não ficar abaixo de 90% da média recente` : ''}${rcb.saiu ? `. Fora: ${esc(mil(rcb.saiu))}/mês de quem saiu` : ''}.</li>` : '';
    // As saídas (fin3): o base contra a média real dos meses da base e o que foi feito com os combinados do time.
    const cbd = pr.combinados_detalhe || null, nComb = cbd ? cbd.identificados + cbd.embutidos + cbd.novos : 0;
    const saidasBase = pr.saidas_historicas_media != null ? `<li><b>Saídas do base:</b> ${esc(mil(pr.saidas_projetadas_base))}/mês, contra ${esc(mil(pr.saidas_historicas_media))} de média real nos meses da base.${nComb ? ` Combinados do time: ${quantos(cbd.identificados, 'identificado', 'identificados')} no extrato e ${quantos(cbd.embutidos, 'considerado embutido', 'considerados embutidos')} no histórico (sem pagamento ligado à pessoa, não somam duas vezes)${cbd.novos ? `; ${quantos(cbd.novos, 'novo', 'novos')} depois da base, ${esc(mil(cbd.valor_novos))}/mês por cima` : ''}.` : ''}</li>` : '';
    const premissas = `<ul class="fe-prem"><li><b>Base:</b> contratos ativos no dia do vencimento de cada um (fim e reajuste respeitados), cliente sem contrato no dia em que costuma pagar, os gastos fixos no dia deles, os combinados do time no dia em que o extrato mostra o pagamento (sem pagamento ligado à pessoa, espalhados como no histórico) e a média do variável (${esc(mil(pr.variaveis_base))}/mês).</li>${receitaBase}${saidasBase}
      <li><b>Pessimista:</b> o que vem pela média do extrato entra 15% menor, os clientes com contrato pagam ${quantos(pr.atraso_medio_dias, 'dia', 'dias')} depois do vencimento (o atraso médio${an.atraso_medio_dias == null ? ' ainda não medido; uso 10 dias' : ' medido no extrato'}), ${pr.em_risco.length ? `${quantos(pr.em_risco.length, 'cliente em risco alto sai', 'clientes em risco alto saem')} a partir do mês que vem` : 'nenhum cliente em risco alto na Carteira'}, e o variável fica no alto (${esc(mil(pr.variaveis_alto))}/mês, ${esc(pr.variaveis_alto_regra || 'percentil 80')}).</li>
      <li><b>Otimista:</b> o funil do Comercial ponderado pela chance de cada etapa (${quantos(pr.pipeline, 'oportunidade', 'oportunidades')}, ${esc(mil(pr.pipeline_ponderado))}/mês) entra a partir do mês que vem.</li>
      <li>Meses usados de base: ${pr.meses_base.length ? esc(pr.meses_base.map((m) => soMes(m)).join(', ')) : 'nenhum fechado ainda'}. ${conf} ${feConfMotivo(pj.confianca)}</li></ul>${feCobertura(pr.cobertura)}`;
    const eq = an.equilibrio;
    const equil = feCard('Ponto de equilíbrio', `<div class="fe-mini3"><div><small>${eq.estimado ? 'MRR estimado' : 'MRR'}</small><b>${esc(mil(eq.mrr))}</b>${eq.estimado ? `<small>de contrato: ${esc(mil(eq.mrr_contrato))}</small>` : ''}</div><div><small>Custo fixo por mês</small><b>${esc(mil(eq.custo_fixo))}</b></div><div><small>Com o variável</small><b>${esc(mil(eq.custo_total))}</b></div></div>
      <p>${eq.cobre_total ? `O MRR cobre o fixo e o variável médio, com ${esc(mil(eq.mrr - eq.custo_total))} de folga por mês.` : eq.cobre_fixo ? `O MRR cobre o custo fixo, mas faltam ${esc(mil(eq.falta_total))} por mês para cobrir também o variável médio.` : `Faltam ${esc(mil(eq.falta_fixo))} de MRR por mês só para cobrir o custo fixo (gastos fixos + combinados do time).`}</p>${eq.pct_do_fixo != null ? `<div class="fe-barra-meta"><i style="--v:${Math.min(100, eq.pct_do_fixo)}%"></i></div><p class="fe-sub">O MRR é ${eq.pct_do_fixo}% do custo fixo.</p>` : ''}`, { cls: 'fe-ficha' });
    // E se ampliado
    // fin2: o "E se" também vale para quem paga sem contrato (pela média dele no extrato).
    const C = ui.fe.cen, comCt = an.contratos.filter((x) => x.ativo && x.valor_mensal > 0);
    const clientes = [...comCt, ...((an.projecao?.receita_base?.estimados) || []).filter((e) => !comCt.some((k) => String(k.cliente_id) === String(e.cliente_id))).map((e) => ({ cliente_id: e.cliente_id, cliente_nome: `${e.cliente_nome} (sem contrato)`, valor_mensal: e.media }))];
    const mc = an.projecao?.premissas?.maior_cliente, maior = mc ? { cliente_nome: mc.cliente_nome, valor_mensal: mc.valor, estimado: mc.estimado } : clientes.slice().sort((a, b) => b.valor_mensal - a.valor_mensal)[0];
    const mesSel = (campo, i, v) => `<select class="fx-in" data-fx-campo="${campo}" data-valor="${i}" aria-label="A partir de">${ms.map((m, k) => `<option value="${k + 1}"${Number(v) === k + 1 ? ' selected' : ''}>${esc(curtoMes(m, anos))}</option>`).join('')}</select>`;
    const ese = `<div class="fe-ese2">
      <fieldset><legend>Contratar alguém</legend>${C.contratar.map((x, i) => `<div class="fe-ese-l"><input class="fx-in fx-num" inputmode="decimal" placeholder="salário" value="${esc(x.salario || '')}" data-fx-campo="fn-cen-sal" data-valor="${i}" aria-label="Salário"> a partir de ${mesSel('fn-cen-sal-mes', i, x.a_partir)}<button type="button" class="fe-ico" data-fx="fn-cen-tira" data-tipo="contratar" data-valor="${i}" aria-label="Tirar">${IC_FECHAR}</button></div>`).join('')}${feBtn('+ contratação', 'data-fx="fn-cen-mais" data-valor="contratar"', 'q')}</fieldset>
      <fieldset><legend>Aumentar o preço de um cliente</legend>${C.aumentar.map((x, i) => `<div class="fe-ese-l"><select class="fx-in" data-fx-campo="fn-cen-cli" data-valor="${i}" aria-label="Cliente"><option value="">cliente</option>${clientes.map((k) => `<option value="${esc(k.cliente_id)}"${k.cliente_id === x.cliente_id ? ' selected' : ''}>${esc(k.cliente_nome)}</option>`).join('')}</select><input class="fx-in fx-num" inputmode="decimal" placeholder="%" value="${esc(x.pct || '')}" data-fx-campo="fn-cen-pct" data-valor="${i}" aria-label="Aumento em %"> a partir de ${mesSel('fn-cen-pct-mes', i, x.a_partir)}<button type="button" class="fe-ico" data-fx="fn-cen-tira" data-tipo="aumentar" data-valor="${i}" aria-label="Tirar">${IC_FECHAR}</button></div>`).join('')}${feBtn('+ aumento', 'data-fx="fn-cen-mais" data-valor="aumentar"', 'q')}</fieldset>
      <fieldset><legend>Perder o maior cliente</legend><label class="fe-check"><input type="checkbox" data-fx-campo="fn-cen-perder"${C.perder_maior ? ' checked' : ''}${maior ? '' : ' disabled'}> ${maior ? `${esc(maior.cliente_nome)} (${esc(mil(maior.valor_mensal))}/mês${maior.estimado ? ', média do extrato' : ''})` : 'nenhum cliente com contrato ou pagamento no extrato'}</label>${C.perder_maior ? ` a partir de ${mesSel('fn-cen-perder-mes', 0, C.perder_maior_a_partir)}` : ''}</fieldset>
      <fieldset><legend>Entradas</legend><label class="fe-ese-l">ajustar <input class="fx-in fx-num" inputmode="decimal" value="${esc(C.ajuste_entradas_pct || 0)}" data-fx-campo="fn-cen-ajuste" aria-label="Ajuste das entradas em %"> %</label></fieldset>
      <div class="fe-bts"><input class="fx-in" placeholder="nome do cenário" value="${esc(C.nome)}" data-fx-campo="fn-cen-nome" aria-label="Nome do cenário">${feBtn('Guardar cenário', 'data-fx="fn-cen-salvar"', `k v2-estado${mexeu ? '' : ' fe-off'}`)}${mexeu ? feBtn('Limpar', 'data-fx="fn-cen-limpar"', 'q') : ''}</div>
      <p class="fe-sub">Só simulação: nada é lançado. O "E se" vale para os três cenários.</p></div>`;
    // Guardados lado a lado
    const guard = (d.projecao?.cenarios || []).filter((x) => x.contratar || x.aumentar || x.perder_maior || x.ajuste_entradas_pct || x.clientes_novos?.length || x.clientes_perdidos?.length);
    const comp = guard.length ? `<div class="fe-rolo"><table class="fe-dre"><thead><tr><th scope="col">Cenário</th><th scope="col">Saldo em ${esc(curtoMes(ms[ms.length - 1], true))}</th><th scope="col">Menor saldo</th><th scope="col">Fôlego</th><th scope="col">1º dia negativo</th><th scope="col"></th></tr></thead><tbody>
      ${[{ nome: 'Sem mudança', p: semCen }, ...guard.map((g) => ({ nome: g.nome, id: g.id, p: projetarFe(d, g), g }))].map((x) => `<tr><th scope="row">${esc(x.nome)}</th><td class="${x.p.base.saldo_final < 0 ? 'r' : ''}">${esc(mil(x.p.base.saldo_final))}</td><td>${esc(mil(x.p.base.menor_saldo))}</td><td>${x.p.base.folego_meses == null ? '12+ meses' : quantos(x.p.base.folego_meses, 'mês', 'meses')}</td><td>${x.p.base.primeiro_dia_negativo ? esc(dataCurta(x.p.base.primeiro_dia_negativo)) : '—'}</td>
        <td>${x.id ? `<button type="button" class="fe-elo" data-fx="fn-cen-usar" data-valor="${esc(x.id)}">abrir</button> <button type="button" class="fe-elo" data-fx="fn-cen-apagar" data-valor="${esc(x.id)}">apagar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="fe-vazio">Nenhum cenário guardado. Monte um "E se" e guarde para comparar lado a lado.</p>';
    // Metas
    const mt = an.metas, mg = an.metas_guardadas || {};
    const metas = `<div data-fx-form="metas" class="fe-metas">${[['mrr', 'MRR por mês', 'R$'], ['margem_pct', 'Margem', '%'], ['caixa_minimo', 'Caixa mínimo', 'R$']].map(([k, n, u]) => { const m = mt.find((x) => x.id === (k === 'margem_pct' ? 'margem' : k === 'caixa_minimo' ? 'caixa' : 'mrr'));
      return `<div class="fe-meta"><label class="fx-campo"><span>${esc(n)} (${u})</span><input class="fx-in fx-num" name="${k}" inputmode="decimal" value="${mg[k] != null ? esc(String(mg[k]).replace('.', ',')) : ''}"></label>${m ? `<div class="fe-barra-meta${m.ok ? ' ok' : ''}"><i style="--v:${Math.max(0, Math.min(100, m.pct ?? (m.ok ? 100 : m.meta ? Math.round((m.atual || 0) / m.meta * 100) : 0)))}%"></i></div><small>${m.ok ? 'meta batida' : `falta ${m.unidade === '%' ? `${String(m.falta).replace('.', ',')} pontos` : esc(mil(m.falta))}`} · hoje ${m.unidade === '%' ? `${m.atual == null ? '—' : String(m.atual).replace('.', ',') + '%'}` : esc(mil(m.atual))}</small>` : ''}</div>`; }).join('')}
      <div class="fe-bts">${feBtn('Salvar metas', 'data-fx="fn-metas"', 'k v2-estado')}</div><p class="fe-sub">Caixa mínimo é comparado com o menor saldo do cenário base em 12 meses.</p></div>`;
    const folego = pj.base.folego_meses;
    const laranja = feLaranja(esc(folego != null && folego < 3 ? `No cenário base o caixa fica negativo em ${dataCurta(pj.base.primeiro_dia_negativo)}/${pj.base.primeiro_dia_negativo.slice(2, 4)}. Faltam ${mil(Math.abs(pj.base.menor_saldo))} até lá.`
      : pj.pessimista.primeiro_dia_negativo ? `O base aguenta os 12 meses, mas no pessimista o caixa fica negativo em ${dataCurta(pj.pessimista.primeiro_dia_negativo)}/${pj.pessimista.primeiro_dia_negativo.slice(2, 4)}.` : 'Nos três cenários o caixa aguenta os próximos 12 meses.'));
    return feCasca('fin_projecao', d, `${laranja}<div class="fe-cen3">${cart('pessimista')}${cart('base')}${cart('otimista')}</div>
      ${feCard('Saldo nos próximos 12 meses', graf + premissas, { dir: conf })}
      <div class="fe-par">${feCard('E se…', ese)}${equil}</div>
      <div class="fe-par">${feCard('Cenários guardados', comp, { cls: 'fe-lista' })}${feCard('Metas', metas)}</div>`);
  }

  // ---------- FECHAMENTO ----------
  function feFechamento(ctx) {
    const d = feIniciar(ctx), an = d.analise;
    if (!an || !A()) return feCasca('fin_fechamento', d, feCard('Fechamento', '<p class="fe-vazio">Importe o extrato da conta PJ para fechar o mês.</p>'));
    const ms = an.fechamento.meses.slice().reverse();
    if (!ms.length) return feCasca('fin_fechamento', d, feCard('Fechamento do mês', '<p class="fe-vazio">Nenhum mês terminado no extrato ainda.</p>'));
    const sel = ms.find((m) => m.mes === ui.fe.fechMes) || ms.find((m) => !m.fechado) || ms[0];
    const lista = ms.map((m) => `<button type="button" class="fe-al" data-fx="fn-fech-mes" data-valor="${m.mes}" aria-pressed="${m.mes === sel.mes}"><i class="fe-dot ${m.fechado ? 'g' : m.pronto ? 'a' : 'r'}" aria-hidden="true"></i><span><b>${esc(nomeMes(m.mes))}</b><small>${m.fechado ? `fechado ${m.registro?.em ? `em ${esc(dataCurta(m.registro.em))}` : ''}${m.registro?.por_nome ? ` por ${esc(m.registro.por_nome.split(' ')[0])}` : ''}` : m.registro?.situacao === 'reaberto' ? 'reaberto' : m.pronto ? 'pronto para fechar' : `${quantos(m.faltam, 'item faltando', 'itens faltando')}`}</small></span></button>`).join('');
    const itens = sel.itens.map((i) => `<button type="button" class="fe-al" ${i.sub ? `data-fx="fn-sub-ir" data-valor="${i.sub}"` : feIr(i.aba, i.chip ? `data-chip="${i.chip}" data-mes="${sel.mes}"` : `data-mes="${sel.mes}"`)}><i class="fe-dot ${i.ok ? 'g' : 'r'}" aria-hidden="true"></i><span><b>${esc(i.nome)}</b><small>${esc(i.det)}</small></span>${i.ok ? feTag('ok', 'g') : ICV.seta}</button>`).join('');
    const res = A().resumoContabil({ lista: d.transacoes || [], mes: sel.mes, itensCartao: d.cartao?.itens || [] });
    const resumo = `<div class="fe-kvs">${[['Saldo inicial', res.saldo_inicial], ['Entradas', res.entradas], ['Saídas', -res.saidas], ['Cartão e transferências', -res.cartao_e_transferencias], ['Resultado de caixa', res.resultado_caixa], ['Resultado por competência', res.competencia.total_resultado], ['Saldo final', res.saldo_final]]
      .map(([n, v]) => `<div class="fe-kv"><span>${esc(n)}</span><b>${v == null ? '—' : esc(rs(v))}</b></div>`).join('')}<div class="fe-kv"><span>Lançamentos</span><b>${n0(res.lancamentos)}</b></div></div>
      <details class="fe-det"><summary>Por categoria</summary>${(res.categorias || []).map((c) => `<div class="fe-kv"><span>${esc(nomeCat(d, c.categoria))}</span><b>${esc(rs(c.total))}</b></div>`).join('')}</details>`;
    const bts = sel.fechado ? `${feBtn('Reabrir o mês', `data-fx="fn-reabrir" data-valor="${sel.mes}"`, 's v2-estado')}` : `${feBtn('Fechar o mês', `data-fx="fn-fechar" data-valor="${sel.mes}"`, `${sel.pronto ? 'k' : 's'} v2-estado`)}${sel.pronto ? '' : `<small class="fe-sub">Feche quando os ${n0(sel.faltam)} itens estiverem ok (dá para fechar mesmo assim).</small>`}`;
    const pdf = feBtn('Resumo para a contabilidade (PDF)', `data-fx="fn-pdf" data-valor="${sel.mes}"`, 's');
    const hist = (sel.registro?.historico || []).slice().reverse().map((h) => `<li>${esc(h.acao)} em ${esc(dataCurta(h.em))} por ${esc(String(h.por_nome || '').split(' ')[0])}${h.motivo ? `: ${esc(h.motivo)}` : ''}</li>`).join('');
    return feCasca('fin_fechamento', d, `<div class="fe-duas">${feCard(`Fechamento de ${nomeMes(sel.mes)}`, `${itens}<div class="fe-bts">${bts}${pdf}</div><p class="fe-sub">Mês fechado não aceita edição (nem conferir, nem apagar) até ser reaberto. O resumo vai para a contabilidade.</p>${hist ? `<ul class="fe-hist">${hist}</ul>` : ''}`, { cls: 'fe-lista' })}
      <aside class="fe-lado">${feCard('Meses', lista, { cls: 'fe-ficha' })}${feCard('Resumo para a contabilidade', resumo, { cls: 'fe-ficha' })}</aside></div>`);
  }

  // ---------- Cliques e campos das telas novas ----------
  async function aoClicarFin(a, b, valor, d) {
    const L = ui.fe.lote, C = ui.fe.cen;
    switch (a) {
      case 'fn-sub': ui.fe.sub = valor; ui.fe.dreAberta = ''; if (anfitriao?.aba !== 'fin_analise') feAbrir('fin_analise'); else repintar(); return true;
      case 'fn-sub-ir': ui.fe.sub = valor; feAbrir('fin_analise'); return true;
      case 'fn-dre-base': ui.fe.dreBase = valor; repintar(); return true;
      case 'fn-dre-abre': ui.fe.dreAberta = ui.fe.dreAberta === valor ? '' : valor; repintar(); return true;
      case 'fn-lote-alta': for (const s of d.analise?.lote || []) if (s.confianca === 'alta' && s.sugestao.categoria !== 'a_classificar') L.marc[s.id] = true; repintar(); return true;
      case 'fn-lote-todos': for (const s of d.analise?.lote || []) if ((L.cat[s.id] || s.sugestao.categoria) !== 'a_classificar') L.marc[s.id] = true; repintar(); return true;
      case 'fn-lote-nada': L.marc = {}; repintar(); return true;
      case 'fn-lote-ok': await confirmarLote(Object.keys(L.marc).filter((x) => L.marc[x]), b); return true;
      case 'fn-fixo-de': { const r = await gravar({ acao: 'fixo_de_lancamento', id: valor }, 'Virou gasto fixo: aparece todo mês em Fixos e no Previsto.'); if (r) ui.extrato.aberta = valor; return true; }
      case 'fn-cobrar': { indo(b); const r = await gravar({ acao: 'cobrar', cliente_id: valor, cliente_nome: b.dataset.nome || '', atraso_dias: Number(b.dataset.dias) || 0 }, 'Cobrança registrada. Os outros donos foram avisados no Vybe OS.'); if (!r) voltou(b); return true; }
      case 'fn-orc-sug': { const f = b.closest('[data-fx-form="orcamento"]'), sug = d.analise?.orcamento?.sugestao || {}; for (const [g, v] of Object.entries(sug)) { const i = f?.querySelector(`input[name="${CSS.escape(g)}"]`); if (i && !i.value) i.value = String(v).replace('.', ','); } return true; }
      case 'fn-orc-salvar': { const f = b.closest('[data-fx-form="orcamento"]'); if (!f) return true; const grupos = {};
        for (const g of d.analise?.orcamento?.grupos || []) { const i = f.querySelector(`input[name="${CSS.escape(g)}"]`); if (i && i.value.trim() !== '') grupos[g] = numero(i.value); }
        indo(b); const r = await gravar({ acao: 'orcamento_salvar', mes: valor, grupos }, 'Orçamento salvo.'); if (!r) voltou(b); return true; }
      case 'fn-orc-copiar': { const pct = numero(b.closest('[data-fx-form="orcamento"]')?.querySelector('[data-fx-orc-pct]')?.value); indo(b); const r = await gravar({ acao: 'orcamento_copiar', de: b.dataset.de, para: valor, pct }, `Copiado de ${soMes(b.dataset.de)}${pct ? ` com ${pct > 0 ? '+' : ''}${pct}%` : ''}.`); if (!r) voltou(b); return true; }
      case 'fn-fech-mes': ui.fe.fechMes = valor; repintar(); return true;
      case 'fn-fechar': { indo(b); const r = await gravar({ acao: 'fechar_mes', mes: valor }, `${nomeMes(valor)} fechado.`); if (!r) voltou(b); return true; }
      case 'fn-reabrir': { const motivo = typeof prompt === 'function' ? prompt(`Por que reabrir ${nomeMes(valor)}?`) : ''; if (motivo === null) return true; indo(b); const r = await gravar({ acao: 'reabrir_mes', mes: valor, motivo }, `${nomeMes(valor)} reaberto.`); if (!r) voltou(b); return true; }
      case 'fn-pdf': {
        const rel = window.VybeFinancas?.relatorio;
        if (typeof rel === 'function') { try { const r = await rel({ mes: valor, tipo: 'fechamento' }); if (r?.erro) avisar(r.erro); else if (!window.VybeRelatorioFinancas?.imprimir(r)) avisar('O navegador bloqueou a janela do PDF. Libere pop-ups para o Vybe OS e toque de novo.'); } catch (e) { avisar(e.message); } }
        else avisar('O relatório em PDF ainda está sendo ligado. O resumo está na tela.');
        return true;
      }
      case 'fn-dre-todos': ui.fe.dreTodos = !ui.fe.dreTodos; repintar(); return true;
      case 'fn-metas': { const f = b.closest('[data-fx-form="metas"]'), v = valoresDe(f); indo(b); const r = await gravar({ acao: 'meta_salvar', metas: { mrr: v.mrr ? numero(v.mrr) : '', margem_pct: v.margem_pct ? numero(v.margem_pct) : '', caixa_minimo: v.caixa_minimo ? numero(v.caixa_minimo) : '' } }, 'Metas salvas.'); if (!r) voltou(b); return true; }
      case 'fn-cen-mais': if (valor === 'contratar') C.contratar.push({ salario: '', a_partir: 2 }); else C.aumentar.push({ cliente_id: '', pct: '', a_partir: 2 }); repintar(); return true;
      case 'fn-cen-tira': C[b.dataset.tipo].splice(Number(valor), 1); repintar(); return true;
      case 'fn-cen-limpar': ui.fe.cen = { ...ui.fe.cen, contratar: [], aumentar: [], perder_maior: false, perder_maior_a_partir: 1, ajuste_entradas_pct: 0, nome: '' }; repintar(); return true;
      case 'fn-cen-salvar': {
        const c = cenFe(); if (!mexeuFe(c)) return true;
        const nome = C.nome.trim() || [c.contratar.length ? `contratar ${c.contratar.length}` : '', c.aumentar.length ? `aumentar ${c.aumentar.length}` : '', c.perder_maior ? 'perder o maior' : '', c.ajuste_entradas_pct ? `entradas ${c.ajuste_entradas_pct}%` : ''].filter(Boolean).join(', ');
        const nomes = Object.fromEntries((d.analise?.contratos || []).map((k) => [k.cliente_id, k.cliente_nome]));
        indo(b); const r = await gravar({ acao: 'cenario_salvar', cenario: { nome, ...c, aumentar: c.aumentar.map((x) => ({ ...x, cliente_nome: nomes[x.cliente_id] || '' })) } }, 'Cenário guardado.'); if (!r) voltou(b); return true;
      }
      case 'fn-cen-usar': { const g = (d.projecao?.cenarios || []).find((x) => x.id === valor); if (!g) return true;
        ui.fe.cen = { ...ui.fe.cen, nome: g.nome, contratar: (g.contratar || []).map((x) => ({ ...x })), aumentar: (g.aumentar || []).map((x) => ({ ...x })), perder_maior: Boolean(g.perder_maior), perder_maior_a_partir: g.perder_maior_a_partir || 1, ajuste_entradas_pct: g.ajuste_entradas_pct || 0 }; repintar(); return true; }
      case 'fn-cen-apagar': await gravar({ acao: 'cenario_remover', id: valor }, 'Cenário apagado.'); return true;
      default: return false;
    }
  }
  function aoMudarFin(t) {
    const c = t.dataset.fxCampo, i = Number(t.dataset.valor), C = ui.fe.cen, L = ui.fe.lote;
    switch (c) {
      case 'fn-lote-marca': L.marc[t.dataset.valor] = t.checked; repintar(); return true;
      case 'fn-lote-cat': L.cat[t.dataset.valor] = t.value; if (t.value !== 'a_classificar') L.marc[t.dataset.valor] = true; repintar(); return true;
      case 'fn-lote-regras': L.regras = t.checked; return true;
      case 'fn-cen-sal': C.contratar[i].salario = t.value; repintar(); return true;
      case 'fn-cen-sal-mes': C.contratar[i].a_partir = Number(t.value) || 1; repintar(); return true;
      case 'fn-cen-cli': C.aumentar[i].cliente_id = t.value; repintar(); return true;
      case 'fn-cen-pct': C.aumentar[i].pct = t.value; repintar(); return true;
      case 'fn-cen-pct-mes': C.aumentar[i].a_partir = Number(t.value) || 1; repintar(); return true;
      case 'fn-cen-perder': C.perder_maior = t.checked; repintar(); return true;
      case 'fn-cen-perder-mes': C.perder_maior_a_partir = Number(t.value) || 1; repintar(); return true;
      case 'fn-cen-ajuste': C.ajuste_entradas_pct = t.value; repintar(); return true;
      case 'fn-cen-nome': C.nome = t.value; return true;
      default: return false;
    }
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', teclaLote);

  const telas = Object.freeze({ vorcaro, extrato, clientes_mes: clientesMes, cartao, fixos, projecao, vales,
    fin_hoje: feHoje, fin_movimento: feMovimento, fin_clientes: feClientes, fin_pessoas: fePessoas, fin_assinaturas: feAssinaturas, fin_analise: feAnaliseNova,
    fin_projecao: feProjecao, fin_fechamento: feFechamento });
  // Contas a pagar › "Lançar à mão" abre o formulário já aberto, como saída ainda não paga.
  function abrirLancarMao({ status = '' } = {}) { ui.vorcaro.mao = true; ui.vorcaro.status = status; }
  window.VybeFinanceiro = Object.freeze({ telas, abrirPessoa, abrirLancarMao, telaNova: feDe, molde: pecasFin, _teste: { cartaoPessoa, ui, lerFaturaColada, fixosProvaveis, cenarioAtual, analise, FE_DE, feDe, projetarFe, cenFe } });
})();
