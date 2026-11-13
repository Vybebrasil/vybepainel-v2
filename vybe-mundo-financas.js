// vybe-mundo-financas.js — o Vybe Finanças dentro das janelas do Irecity (Paulo, 08/11/2026). SÓ LEITURA.
//
// Lê /api/painel?area=vybe_financas (server/vybe-financas-api.js) e guarda a resposta por parte e mês, para o
// Comercial (abas de dinheiro), a Carteira (Contratos) e o setor de Pessoas (RH → Folha). Cada módulo desenha com as
// próprias classes (vc-* / vp-*); aqui ficam a leitura, a junção dos contratos, o mini painel dos números e as telas de
// Finanças no padrão v2 (classes fv2-*, CSS em padrao-v2/financas.css).
//   window.VybeFinancas.carregar(parte, mes, { forcar }) → Promise<estado>   (parte = comercial | carteira | rh)
//   window.VybeFinancas.estado(parte, mes) → { carregando, dados, erro } | null
//   window.VybeFinancas.contratosDaCarteira(listaDoVybeOS, mes) → lista no formato da Carteira, com o Finanças por cima
//   window.VybeFinancas.contratoDoCliente(clienteId, mes) → o contrato principal do Finanças daquele cliente (ou null)
//   window.VybeEspiarProvedores.financas   os números clicáveis (data-espiar="financas:<parte>:<o quê>")
//   window.VybeFinancas.telas   as telas do padrão v2: recebimentos, contas, inadimplencia (janela do Comercial) e visao (setor)
// Quem vê o quê é o servidor que decide (os campos de dinheiro e de salário nem chegam a quem não pode).
(() => {
  'use strict';
  const VALIDADE = 2 * 60 * 1000;
  const guardados = new Map(); // `${parte}|${mes}` → { carregando, dados, erro, em, promessa }
  const ultimo = {}; // parte → chave do último estado carregado (o mini painel lê dele)
  const chave = (parte, mes) => `${parte}|${mes || ''}`;
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const din = (v) => (v == null ? '—' : BRL.format(Number(v) || 0));
  const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : '—');
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeMes = (m) => (/^\d{4}-\d{2}$/.test(m || '') ? `${MESES[Number(m.slice(5)) - 1]} de ${m.slice(0, 4)}` : '');

  async function pedir(parte, mes) {
    const r = await fetch(`/api/painel?area=vybe_financas&parte=${encodeURIComponent(parte)}${mes ? `&mes=${encodeURIComponent(mes)}` : ''}`,
      { credentials: 'same-origin', cache: 'no-store' });
    let d = {}; try { d = await r.json(); } catch { /* sem corpo */ }
    if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || 'O Vybe Finanças não respondeu agora.'), { status: r.status, indisponivel: Boolean(d.financas_indisponivel) });
    return d;
  }
  function carregar(parte, mes = '', { forcar = false } = {}) {
    const k = chave(parte, mes), atual = guardados.get(k);
    if (atual?.promessa) return atual.promessa;
    if (atual && !forcar && Date.now() - atual.em < VALIDADE) return Promise.resolve(atual);
    const e = { carregando: true, dados: atual?.dados || null, erro: '', em: Date.now(), promessa: null };
    guardados.set(k, e);
    e.promessa = pedir(parte, mes).then((d) => { e.dados = d; e.erro = ''; ultimo[parte] = k; })
      .catch((err) => { e.erro = err.message; e.status = err.status; if (err.status === 403) e.dados = null; })
      .then(() => { e.carregando = false; e.em = Date.now(); e.promessa = null; return e; });
    return e.promessa;
  }
  const estado = (parte, mes = '') => guardados.get(chave(parte, mes)) || null;
  const ligado = (parte, mes = '') => estado(parte, mes)?.dados?.conectado === true;

  // ---------- Carteira: contratos ----------
  // O contrato principal do Finanças (o ativo mais recente) entra no lugar do registro do Vybe OS daquele cliente:
  // início, renovação (= fim no Finanças) e status; o valor só quando o servidor mandou (quem vê dinheiro).
  function contratoDoCliente(clienteId, mes = '') {
    const d = estado('carteira', mes)?.dados;
    if (!d?.conectado || clienteId == null) return null;
    return (d.contratos || []).find((c) => c.principal && String(c.cliente_id) === String(clienteId)) || null;
  }
  function contratosDaCarteira(locais = [], mes = '') {
    const d = estado('carteira', mes)?.dados;
    if (!d?.conectado) return locais;
    const deLocal = new Map((locais || []).map((c) => [String(c.cliente_id), c]));
    const saida = new Map(deLocal);
    for (const f of d.contratos || []) {
      if (!f.principal || !f.cliente_id) continue;
      const l = deLocal.get(String(f.cliente_id));
      saida.set(String(f.cliente_id), { cliente_id: String(f.cliente_id), valor_mensal: f.valor != null ? f.valor : l?.valor_mensal ?? null,
        inicio: f.inicio || l?.inicio || null, renovacao: f.fim || null, status: f.status_carteira || 'ativo', observacao: l?.observacao || '', fonte: 'financas' });
    }
    return [...saida.values()];
  }

  // ---------- Mini painel (data-espiar="financas:<parte>:<o quê>[:<extra>]") ----------
  (window.VybeEspiarProvedores = window.VybeEspiarProvedores || {}).financas = (resto) => {
    const [parte, tipo, extra = ''] = String(resto).split(':');
    const d = ultimo[parte] ? guardados.get(ultimo[parte])?.dados : null;
    if (!d?.conectado) return null;
    const rodape = 'fonte: Vybe Finanças';
    if (parte === 'comercial') {
      if (tipo === 'despesas') return { titulo: `Despesas de ${nomeMes(d.mes)} por categoria`, rodape, vazio: 'Nenhuma despesa no mês.',
        itens: d.despesas.categorias.map((c) => ({ nome: c.categoria, sub: `${c.quantidade} lançamento${c.quantidade === 1 ? '' : 's'}${c.pendente ? ` · ${din(c.pendente)} pendente` : ''}`, dir: din(c.total) })) };
      if (tipo === 'fixos') return { titulo: 'Custos fixos (assinaturas ativas)', rodape, vazio: 'Nenhuma assinatura ativa.',
        itens: d.custos_fixos.itens.map((s) => ({ nome: s.nome, sub: s.dia_renovacao ? `renova dia ${s.dia_renovacao}` : '', dir: din(s.custo) + '/mês' })) };
      if (tipo === 'inad') return { titulo: 'Receitas vencidas e não pagas', cls: 'u1', rodape, vazio: 'Ninguém em atraso no Finanças.',
        itens: d.inadimplencia.clientes.map((c) => ({ nome: c.cliente_nome, sub: `${c.faturas} lançamento${c.faturas === 1 ? '' : 's'} · ${c.atraso_mais_antigo} dia${Number(c.atraso_mais_antigo) === 1 ? '' : 's'} de atraso${c.no_vybe ? '' : ' · sem par no Vybe OS'}`, dir: din(c.valor), cls: c.atraso_mais_antigo > 30 ? 'u1' : '' })) };
      if (tipo === 'margem') {
        const lista = extra === 'negativa' ? d.margens.filter((m) => m.periodo.margem < 0) : d.margens;
        return { titulo: extra === 'negativa' ? 'Clientes com margem negativa (3 meses)' : 'Margem real por cliente (3 meses)', cls: extra === 'negativa' ? 'u1' : '', rodape, vazio: 'Nenhum cliente.',
          itens: lista.map((m) => ({ nome: m.cliente_nome, sub: `recebido ${din(m.periodo.receita)} · despesas ${din(m.periodo.despesas)}`, dir: din(m.periodo.margem), cls: m.periodo.margem < 0 ? 'u1' : '' })) };
      }
      if (tipo === 'serie') {
        const m = d.series.find((s) => s.mes === extra); if (!m) return null;
        return { titulo: nomeMes(m.mes), rodape, itens: [{ nome: 'Faturamento recebido', dir: din(m.faturamento) }, { nome: 'Custos pagos', dir: din(m.custos) },
          { nome: 'Resultado', dir: din(m.resultado), cls: m.resultado < 0 ? 'u1' : '' }, { nome: 'Ticket médio', sub: `${m.clientes_pagantes} cliente${m.clientes_pagantes === 1 ? '' : 's'} pagaram`, dir: din(m.ticket_medio) }] };
      }
      if (tipo === 'sempar') return { titulo: 'No Finanças, sem par no Vybe OS', rodape: 'Ligação pelo CNPJ ou pelo nome', vazio: 'Todos ligados.',
        itens: d.ligacao.sem_par.map((c) => ({ nome: c.nome, sub: c.status })) };
    }
    if (parte === 'carteira') {
      if (tipo === 'sempar') return { titulo: 'No Finanças, sem par no Vybe OS', rodape: 'Ligação pelo CNPJ ou pelo nome', vazio: 'Todos ligados.',
        itens: d.ligacao.sem_par.map((c) => ({ nome: c.nome, sub: c.status })) };
      if (tipo === 'faltafin') return { titulo: 'Ativos no Vybe OS, sem cadastro no Finanças', rodape: 'Cadastre no Vybe Finanças com o mesmo nome ou CNPJ', vazio: 'Todos os ativos estão no Finanças.',
        itens: (d.ligacao.vybe_sem_par || []).map((c) => ({ nome: c.nome, sub: 'falta no Vybe Finanças' })) };
      if (tipo === 'contratos') return { titulo: 'Contratos no Vybe Finanças', rodape, vazio: 'Nenhum contrato no Finanças.',
        itens: d.contratos.map((c) => ({ nome: c.cliente_nome, sub: [c.titulo, c.status, c.fim ? `até ${dataBr(c.fim)}` : 'sem fim', c.tem_pdf ? 'com PDF' : ''].filter(Boolean).join(' · '),
          dir: c.valor != null ? din(c.valor) + '/mês' : '', cls: c.dias_restantes != null && c.dias_restantes < 0 && c.status_carteira !== 'encerrado' ? 'u1' : '' })) };
    }
    if (parte === 'rh' && tipo === 'folha' && d.folha) return { titulo: `Folha de ${nomeMes(d.folha.mes)}`, rodape, vazio: 'Nenhum funcionário no Finanças.',
      itens: d.folha.funcionarios.map((f) => ({ nome: f.nome, sub: [f.cargo, f.dia_pagamento ? `paga dia ${f.dia_pagamento}` : ''].filter(Boolean).join(' · '), dir: din(f.total),
        cls: f.variacao > 0 ? 'u2' : '' })) };
    return null;
  };

  // ---------- Telas do padrão v2 (quadros Finanças, Recebimentos, Contas a pagar e Inadimplência) ----------
  // Cada tela é o quadro, nesta ordem: cabeçalho com a ação, a fala do Vorcaro, três números, a barra de filtro, o
  // "Pede ação" com o botão na linha e o cartão do lado. Quem hospeda é a janela do Comercial (as três abas) e a Visão
  // geral do setor (Finanças):
  //   VybeFinancas.telas.recebimentos|contas|inadimplencia({ d, filtro, verFalta, admin, repintar, recarregar }) → HTML
  //   VybeFinancas.telas.visao({ subs, abrirSub }) → Promise<HTML>
  // d = a resposta de /api/painel?area=comercial&aba=…; filtro = o objeto das buscas da janela (rec, conta, inad).
  // Os botões que já existiam (formulários, período, busca, ajuda) saem com os mesmos data-vc da janela; o que é só
  // destas telas (fichas, linha que abre, "Recebi" e "Paguei" de um toque) usa data-fv e é tratado aqui.
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const n0 = (v) => Math.round(Number(v) || 0).toLocaleString('pt-BR');
  const mil = (v) => { const n = Number(v) || 0, a = Math.abs(n); return `${n < 0 ? '-' : ''}R$ ${a >= 1000 ? (a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : n0(a)}`; };
  const rs = (v) => { const n = Number(v) || 0; return `${n < 0 ? '-' : ''}R$ ${Math.abs(n).toLocaleString('pt-BR', Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
  // "R$ 5,7 de 9,6 mil": os dois em mil, a unidade uma vez só.
  const parteDe = (a, b) => (Math.abs(Number(a)) >= 1000 && Math.abs(Number(b)) >= 1000 ? `${mil(a).replace(' mil', '')} de ${mil(b).replace('R$ ', '')}` : `${mil(a)} de ${mil(b)}`);
  const soma = (l, campo) => l.reduce((t, x) => t + (Number(x[campo]) || 0), 0);
  const pc = (a, b) => (Number(b) > 0 ? Math.max(0, Math.min(100, Math.round((Number(a) || 0) / Number(b) * 100))) : 0);
  const quantos = (n, um, varios) => `${n0(n)} ${Number(n) === 1 ? um : varios}`;
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hojeBahia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const ehDia = (iso) => /^\d{4}-\d{2}-\d{2}/.test(String(iso || ''));
  const diasEntre = (de, ate) => Math.round((Date.parse(String(ate).slice(0, 10) + 'T12:00:00Z') - Date.parse(String(de).slice(0, 10) + 'T12:00:00Z')) / 864e5);
  const somaDia = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const somaMes = (ym, n) => { const [a, m] = String(ym).split('-').map(Number), d = new Date(Date.UTC(a, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const mesDe = (iso) => MESES[Number(String(iso || '').slice(5, 7)) - 1] || '';
  const extenso = (iso) => (ehDia(iso) ? `${Number(String(iso).slice(8, 10)) === 1 ? '1º' : Number(String(iso).slice(8, 10))} de ${mesDe(iso)}` : 'sem data');
  const curta = (iso) => (ehDia(iso) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : 'sem data');
  const maiuscula = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
  const doFin = (id) => String(id || '').startsWith('fin:');
  const emAtraso = (x) => x.status === 'atrasado' || x.status === 'inadimplente';
  const SETA = { esq: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>', dir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' };
  const pilula = (texto, tom = 'n') => `<span class="fv2-pill ${tom}">${esc(texto)}</span>`;
  // O cliente com a bolinha na cor da carteira dele.
  function carteiraDe(nome) {
    try { return typeof carteiraDoCliente === 'function' ? String(carteiraDoCliente(nome) || '') : ''; } catch { return ''; }
  }
  const cli = (nome) => `<span class="fv2-cli" data-carteira="${esc(carteiraDe(nome))}">${esc(nome)}</span>`;
  // O que cada tela lembra entre uma pintura e outra: ficha escolhida, linha aberta, "mostrar" e o período da Visão geral.
  const ui = {
    rec: { chip: 'todas', extra: '', filtros: false, aberta: '', inteira: false, acaoInteira: false },
    con: { chip: 'todas', extra: '', filtros: false, aberta: '', acaoInteira: false },
    ina: { chip: 'todos', extra: '', filtros: false, aberta: '', inteira: false },
    vis: { per: 'atual', aberta: '', conta: false, lancar: false, inteira: false },
  };
  let anfitriao = null, visita = null; // quem hospeda as abas (janela do Comercial) e a Visão geral (setor)

  // Leituras das outras abas (o que está em atraso hoje, o caixa), guardadas por 1 minuto.
  const lidas = new Map();
  function buscar(q) {
    const c = lidas.get(q);
    if (c && (c.promessa || Date.now() - c.em < 60000)) return c.promessa || Promise.resolve(c.dados);
    if (typeof fetch !== 'function') return Promise.resolve(null);
    const e = { em: Date.now(), dados: c?.dados || null, promessa: null };
    lidas.set(q, e);
    e.promessa = fetch(`/api/painel?area=comercial&aba=${q}`, { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => r.json().then((d) => (r.ok && d && d.ok !== false ? d : null))).catch(() => null)
      .then((d) => { e.dados = d || e.dados; e.em = Date.now(); e.promessa = null; return e.dados; });
    return e.promessa;
  }
  // Na pintura (que não espera): devolve o que já chegou e, quando chegar o resto, pede para pintar de novo.
  function jaLida(q, aoChegar) {
    const c = lidas.get(q);
    if (!c || (!c.promessa && Date.now() - c.em >= 60000)) buscar(q).then(() => aoChegar?.());
    return lidas.get(q)?.dados || null;
  }

  // ----- Peças -----
  function topo({ titulo, trilha = true, meio = '', acoes = '' }) {
    return `<div class="fv2-topo"><div class="fv2-ola">${trilha ? `<p class="fv2-sub"><button type="button" class="fv2-link" data-fv="ir" data-valor="setor:financas">Finanças</button> › ${esc(titulo)}</p>` : ''}<h1>${esc(titulo)}</h1></div>${meio}${acoes}</div>`;
  }
  function periodoHtml(per, hoje) {
    const anual = per.tipo === 'anual', mes = /^\d{4}-\d{2}$/.test(per.mes || '') ? per.mes : hoje.slice(0, 7), passo = anual ? 12 : 1, corte = anual ? 4 : 7;
    const antes = somaMes(mes, -passo), depois = somaMes(mes, passo), fim = depois.slice(0, corte) > hoje.slice(0, corte), nome = anual ? 'ano' : 'mês';
    return `<span class="fv2-seg" role="group" aria-label="Período">${[['mensal', 'Mensal'], ['anual', 'Anual']].map(([k, n]) => `<button type="button" data-vc-periodo="${k}" aria-pressed="${(per.tipo || 'mensal') === k}">${n}</button>`).join('')}</span>
      <span class="fv2-mes" role="group" aria-label="${anual ? 'Ano' : 'Mês'}"><button type="button" class="fv2-btn s fv2-seta" data-vc-mes-ir="${antes}" aria-label="${maiuscula(nome)} anterior">${SETA.esq}</button><span class="fv2-chip" aria-live="polite">${anual ? mes.slice(0, 4) : esc(nomeMes(mes))}</span><button type="button" class="fv2-btn s fv2-seta" data-vc-mes-ir="${depois}" aria-label="Próximo ${nome}"${fim ? ' disabled' : ''}>${SETA.dir}</button></span>`;
  }
  const rotuloFala = (per, hoje) => { const r = rotuloPeriodo(per, hoje); return per.tipo !== 'anual' && r.endsWith(' de ' + hoje.slice(0, 4)) ? r.slice(0, -8) : r; };
  const rotuloPeriodo = (per, hoje) => (per.tipo === 'anual' ? String(per.mes || hoje).slice(0, 4) : nomeMes(/^\d{4}-\d{2}$/.test(per.mes || '') ? per.mes : hoje.slice(0, 7)));
  const fala = (quem, frase, botao = '') => `<section class="fv2-fala" aria-label="${esc(quem)}"><span class="fv2-ag" aria-hidden="true">V</span><p><span class="fv2-quem">${esc(quem)}</span>${frase}</p>${botao}</section>`;
  function kpi({ rotulo, valor, tom = '', barra = null, sub = '', i = 0, dica = '', espiar = '' }) {
    return `<div class="fv2-kpi${tom ? ' ' + tom : ''}"${dica ? ` title="${esc(dica)}"` : ''}><small>${esc(rotulo)}</small><b${espiar ? ` class="espiavel" data-espiar="${esc(espiar)}" role="button" tabindex="0"` : ''}><span class="v2-num"${i ? ` style="animation-delay:${(i * 0.12).toFixed(2)}s"` : ''}>${esc(valor)}</span></b>${barra ? `<div class="v2-barra"><i style="--v:${barra.v}%;--c:${barra.cor || '#11613A'}"></i></div>` : ''}${sub ? `<small class="fv2-kpi-sub">${sub}</small>` : ''}</div>`;
  }
  const kpis = (lista) => `<div class="fv2-kpis">${lista.map((k, i) => kpi({ ...k, i })).join('')}</div>`;
  const variou = (v, contra) => (v == null || !Number.isFinite(Number(v)) ? '' : `${Number(v) > 0 ? 'subiu' : Number(v) < 0 ? 'caiu' : 'igual'} ${String(Math.abs(Number(v))).replace('.', ',')}% ${contra}`);
  function filtros({ tela, busca, chips, extras = [] }) {
    const u = ui[tela], id = 'fv2-busca-' + tela;
    return `<div class="fv2-filtros"><label class="fv2-sr" for="${id}">${esc(busca.rotulo)}</label><input class="fv2-busca" id="${id}" type="search" data-vc-busca="${busca.chave}" placeholder="${esc(busca.dica)}" value="${esc(busca.valor || '')}">
      <span class="fv2-fichas" role="group" aria-label="Filtrar a lista">${chips.map(([k, nome, n]) => `<button type="button" class="fv2-chip" data-fv="chip" data-tela="${tela}" data-valor="${k}" aria-pressed="${!u.extra && u.chip === k}">${esc(nome)} · ${n0(n)}</button>`).join('')}</span>
      ${extras.length ? `<button type="button" class="fv2-btn s" data-fv="filtros" data-tela="${tela}" aria-expanded="${u.filtros}">Filtros</button>` : ''}</div>
      ${extras.length && u.filtros ? `<div class="fv2-filtros fv2-extras" role="group" aria-label="Mais filtros">${extras.map(([k, nome, n]) => `<button type="button" class="fv2-chip" data-fv="extra" data-tela="${tela}" data-valor="${k}" aria-pressed="${u.extra === k}">${esc(nome)} · ${n0(n)}</button>`).join('')}</div>` : ''}`;
  }
  // Linha que abre no lugar: o texto é o botão que abre; à direita, o que a linha pede (valor, status, botão).
  function linha({ tela, id, pill = '', texto, dir = '', detalhe = '' }) {
    const aberta = ui[tela].aberta === String(id);
    return `<div class="v2-abre fv2-linha" data-linha="${esc(id)}" aria-expanded="${aberta}"><div class="fv2-lin">${pill}<button type="button" class="fv2-txt" data-fv="linha" data-tela="${tela}" data-valor="${esc(id)}" aria-expanded="${aberta}">${texto}</button>${dir}</div>
      <div class="v2-mais"><div><div class="fv2-det">${detalhe}</div></div></div></div>`;
  }
  const hist = (frases) => frases.filter(Boolean).map((f) => `<p class="fv2-hist">${f}</p>`).join('');
  const umToque = (acao, id, texto, extra = '') => `<button type="button" class="fv2-btn s v2-estado" data-fv="${acao}" data-valor="${esc(id)}"${extra}>${texto}</button>`;
  const cartao = ({ titulo, sub = '', corpo, pe = '', cls = '', rotulo = '' }) => `<section class="fv2-card${cls ? ' ' + cls : ''}"${rotulo ? ` data-fv-card="${rotulo}"` : ''}><div class="fv2-card-topo"><h2>${esc(titulo)}</h2>${sub ? `<span class="fv2-sub">${sub}</span>` : ''}</div>${corpo}${pe ? `<p class="fv2-sub fv2-pe">${pe}</p>` : ''}</section>`;
  const vazioLinha = (frase, botoes = '') => `<div class="fv2-vz"><p>${frase}</p>${botoes}</div>`;
  const maisHtml = (resto, nome, acao, tela) => (resto > 0 ? `+ ${n0(resto)}${nome ? ' ' + nome : ''} · <button type="button" class="fv2-link" data-fv="${acao}" data-tela="${tela}">mostrar</button>` : '');
  // O controle financeiro ainda não ligado: o motivo técnico fica a um clique, só para quem administra.
  function oQueFalta(ctx) {
    const d = estado('comercial', ctx.d?.periodo?.mes || hojeBahia().slice(0, 7))?.dados;
    if (!d || d.conectado || !ctx.admin) return { botao: '', nota: '' };
    return { botao: `<button type="button" class="fv2-btn s" data-vc="falta" aria-expanded="${Boolean(ctx.verFalta)}">Para quem administra: ver o que falta</button>`,
      nota: ctx.verFalta ? `<div class="fv2-nota" role="note"><p>${esc(d.motivo || 'O controle financeiro ainda não está ligado.')}${d.aviso ? ' · ' + esc(d.aviso) : ''}</p>${(d.passos || []).length ? `<ol>${d.passos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}</div>` : '' };
  }
  const fonte = (d) => (d?.fonte === 'Vybe Finanças' ? ' Fonte: Vybe Finanças.' : '');

  // ----- Faturas (Recebimentos e Inadimplência) -----
  const oQueE = (x) => (x.tipo === 'recorrente' ? `${x.ciclo && x.ciclo !== 'mensal' ? 'parcela ' + x.ciclo : 'mensalidade'} de ${mesDe(x.vencimento)}` : String(x.descricao || 'recebimento pontual'));
  const nomeFatura = (x) => (x.cliente_nome ? `${cli(x.cliente_nome)} · ${esc(oQueE(x))}` : `<b>${esc(x.descricao || 'Recebimento')}</b>`);
  function statusFatura(x, hoje) {
    if (x.cancelado) return pilula('Cancelado', 'n');
    if (x.status === 'recebido') return pilula(x.recebido_em ? 'Recebido em ' + curta(x.recebido_em) : 'Recebido', 'g');
    if (emAtraso(x)) return pilula(quantos(x.atraso, 'dia', 'dias'), 'r');
    if (x.status === 'parcial') return pilula('Parcial', 'a');
    return pilula(String(x.vencimento).slice(0, 7) === hoje.slice(0, 7) ? 'vence dia ' + Number(String(x.vencimento).slice(8, 10)) : 'vence ' + curta(x.vencimento), 'b');
  }
  // dentro = a fatura está na lista da janela (os formulários de editar e cancelar a encontram); comForm = há janela com formulário.
  function detalheFatura(x, { dentro = true, comForm = true } = {}) {
    const venceu = emAtraso(x) || x.status === 'recebido';
    const linhas = hist([
      x.tipo === 'recorrente' ? `Recorrente ${esc(x.ciclo || 'mensal')}${x.descricao ? ' · ' + esc(x.descricao) : ''}` : `Pontual${x.categoria ? ' · ' + esc(x.categoria) : ''}`,
      `${venceu ? 'Venceu' : 'Vence'} em ${extenso(x.vencimento)}${emAtraso(x) ? ', há ' + quantos(x.atraso, 'dia', 'dias') : ''}`,
      Number(x.valor_recebido) > 0 && x.status !== 'recebido' ? `Recebido até agora ${rs(x.valor_recebido)} de ${rs(x.valor)}` : '',
      x.recebido_em ? `Recebido em ${extenso(x.recebido_em)}` : '', x.cancelado ? 'Cancelado: fora dos totais' : '']);
    let acoes = '';
    if (x.cancelado) acoes = '';
    else if (doFin(x.id)) acoes = '<small class="fv2-sub">Dê baixa no Vybe Finanças</small>';
    else if (!comForm) acoes = '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="recebimentos">Abrir em Recebimentos</button>';
    else acoes = `${x.status !== 'recebido' ? `<button type="button" class="fv2-btn s" data-vc="receber" data-id="${esc(x.id)}">Recebi uma parte</button>` : ''}
      ${dentro && x.tipo === 'recorrente' ? `<button type="button" class="fv2-btn s" data-vc="proximo" data-id="${esc(x.id)}">Próximo ciclo</button>` : ''}
      ${dentro ? `<button type="button" class="fv2-btn s" data-vc="recebivel" data-id="${esc(x.id)}">Editar</button><button type="button" class="fv2-btn s fv2-perigo" data-vc="cancelar-rec" data-id="${esc(x.id)}">Cancelar</button>`
        : `<button type="button" class="fv2-btn s" data-vc-mes-ir="${String(x.vencimento).slice(0, 7)}">Ver em ${esc(mesDe(x.vencimento))}</button>`}`;
    return `${linhas}${acoes ? `<div class="fv2-det-acoes">${acoes}</div>` : ''}`;
  }
  const botaoRecebi = (x) => (doFin(x.id) ? '<small class="fv2-sub fv2-so-la">baixa no Vybe Finanças</small>' : umToque('receber', x.id, 'Recebi', ` data-total="${Number(x.valor) || 0}"`));
  const linhaAtrasada = (tela, x, opc) => linha({ tela, id: 'a' + x.id, pill: pilula(quantos(x.atraso, 'dia', 'dias'), 'r'),
    texto: `${nomeFatura(x)}, ${rs(x.aberto ?? x.valor)}`, dir: botaoRecebi(x), detalhe: detalheFatura(x, opc) });

  function recebimentos(ctx) {
    anfitriao = ctx;
    const u = ui.rec, d = ctx.d || {}, hoje = d.hoje || hojeBahia(), per = d.periodo || {}, a = d.resumo?.atual || {}, v = d.resumo?.variacao || {};
    const todas = d.recebiveis || [], vivas = todas.filter((x) => !x.cancelado), rot = rotuloPeriodo(per, hoje), contra = per.tipo === 'anual' ? 'contra o ano anterior' : 'contra o mês anterior';
    const grupo = { atraso: vivas.filter(emAtraso), vencer: vivas.filter((x) => x.status === 'pendente' || x.status === 'parcial'), recebidas: vivas.filter((x) => x.status === 'recebido'),
      recorrentes: vivas.filter((x) => x.tipo === 'recorrente'), pontuais: vivas.filter((x) => x.tipo !== 'recorrente'), parciais: vivas.filter((x) => x.status === 'parcial'), canceladas: todas.filter((x) => x.cancelado) };
    // Em atraso hoje, de qualquer mês (a aba Inadimplência); enquanto não chega, as do período.
    const ina = ctx.atrasadas || jaLida('inadimplencia', () => anfitriao?.repintar?.())?.faturas;
    const atrasadas = [...(ina || grupo.atraso)].sort((x, z) => z.atraso - x.atraso), ids = new Set(todas.map((x) => String(x.id)));
    const deFora = atrasadas.filter((x) => !ids.has(String(x.id))), totalAtraso = soma(atrasadas, 'aberto');
    const termo = semAcento(ctx.filtro?.rec), bate = (x) => !termo || semAcento(`${x.cliente_nome || ''} ${x.descricao || ''} ${x.categoria || ''} ${oQueE(x)}`).includes(termo);
    const proxima = [...grupo.vencer].sort((x, z) => String(x.vencimento).localeCompare(String(z.vencimento)))[0];
    const mesesFora = [...new Set(deFora.map((x) => String(x.vencimento).slice(0, 7)))];
    const frase = !vivas.length && !atrasadas.length ? `Nenhum recebimento lançado em ${esc(rotuloFala(per, hoje))}.`
      : `Entraram <b>${mil(a.recebido)}</b> dos ${mil(a.a_receber)} de ${esc(rotuloFala(per, hoje))}. ${atrasadas.length ? `<b>${atrasadas.length === 1 ? '1 fatura está' : n0(atrasadas.length) + ' faturas estão'} em atraso</b>${deFora.length ? `, ${deFora.length === 1 ? 'uma' : n0(deFora.length)} de ${mesesFora.length === 1 ? esc(mesDe(mesesFora[0] + '-01')) : 'meses anteriores'}` : ''}.` : 'Nada em atraso.'}`;
    const numeros = kpis([
      { rotulo: 'Recebido', valor: mil(a.recebido), barra: { v: pc(a.recebido, a.a_receber) }, dica: variou(v.recebido, contra),
        sub: Number(a.a_receber) ? `${pc(a.recebido, a.a_receber)}% dos ${mil(a.a_receber)} previstos · ${quantos(vivas.length, 'fatura', 'faturas')}` : 'nenhum recebimento lançado no período', tom: Number(a.recebido) ? '' : 'quieto' },
      { rotulo: 'A vencer', valor: mil(soma(grupo.vencer, 'aberto')), dica: variou(v.pendente, contra), tom: grupo.vencer.length ? '' : 'quieto',
        sub: grupo.vencer.length ? `${quantos(grupo.vencer.length, 'fatura', 'faturas')}${proxima ? ` · ${proxima.cliente_nome ? cli(proxima.cliente_nome) : esc(proxima.descricao || '')}, dia ${Number(String(proxima.vencimento).slice(8, 10))}` : ''}` : 'nada a vencer no período' },
      { rotulo: 'Em atraso', valor: mil(totalAtraso), tom: totalAtraso ? 'ruim' : 'quieto', dica: variou(v.inadimplente, contra),
        sub: atrasadas.length ? `${quantos(atrasadas.length, 'fatura', 'faturas')}${deFora.length ? ` · ${mil(soma(deFora, 'aberto'))} ${deFora.length === 1 ? 'vem' : 'vêm'} de ${mesesFora.length === 1 ? esc(mesDe(mesesFora[0] + '-01')) : 'meses anteriores'}` : ''} · <button type="button" class="fv2-link" data-fv="ir" data-valor="inadimplencia">ver inadimplência</button>` : 'ninguém em atraso' }]);
    const barra = filtros({ tela: 'rec', busca: { chave: 'rec', rotulo: 'Buscar fatura por cliente', dica: 'Buscar cliente ou fatura', valor: ctx.filtro?.rec },
      chips: [['todas', 'Todas', vivas.length], ['atraso', 'Em atraso', grupo.atraso.length], ['vencer', 'A vencer', grupo.vencer.length], ['recebidas', 'Recebidas', grupo.recebidas.length], ['recorrentes', 'Recorrentes', grupo.recorrentes.length], ['pontuais', 'Pontuais', grupo.pontuais.length]],
      extras: [['parciais', 'Parciais', grupo.parciais.length], ['canceladas', 'Canceladas', grupo.canceladas.length]] });
    // Pede ação: as faturas em atraso, da mais antiga à mais nova, com o Recebi na linha.
    const pedem = atrasadas.filter(bate), cabeA = u.acaoInteira || termo ? pedem : pedem.slice(0, 4);
    const acao = cartao({ titulo: 'Pede ação', rotulo: 'acao', sub: atrasadas.length ? `${quantos(atrasadas.length, 'fatura', 'faturas')} em atraso` : 'nada em atraso',
      corpo: cabeA.map((x) => linhaAtrasada('rec', x, { dentro: ids.has(String(x.id)) })).join('') || `<p class="fv2-nada">${termo && atrasadas.length ? 'Nenhuma fatura em atraso com esse texto.' : 'Nenhuma fatura em atraso.'}</p>`,
      pe: [maisHtml(pedem.length - cabeA.length, 'em atraso', 'mostrar-acao', 'rec'), 'A baixa é manual: quem viu o dinheiro entrar toca em Recebi.'].filter(Boolean).join(' · ') });
    // A lista do período, uma linha por fatura. Em "Todas", as em atraso já estão no Pede ação.
    const ordem = (x) => (x.cancelado ? 4 : x.status === 'recebido' ? 3 : emAtraso(x) ? 2 : 1);
    const base = (u.extra ? grupo[u.extra] : u.chip === 'todas' ? vivas.filter((x) => !emAtraso(x)) : grupo[u.chip] || vivas).filter(bate)
      .sort((x, z) => ordem(x) - ordem(z) || (ordem(x) === 3 ? String(z.recebido_em || '').localeCompare(String(x.recebido_em || '')) : String(x.vencimento).localeCompare(String(z.vencimento))));
    const cabe = u.inteira || termo ? base : base.slice(0, 6), resto = base.length - cabe.length, soRecebidas = base.slice(cabe.length).every((x) => x.status === 'recebido');
    const lista = cartao({ titulo: rot, sub: 'uma linha por fatura',
      corpo: cabe.map((x) => linha({ tela: 'rec', id: x.id, texto: x.cliente_nome ? `${cli(x.cliente_nome)} · ${esc(x.tipo === 'recorrente' ? mesDe(x.vencimento) : x.descricao || 'pontual')}` : `<b>${esc(x.descricao || 'Recebimento')}</b>`,
        dir: `<b class="fv2-valor">${rs(x.valor)}</b>${statusFatura(x, hoje)}`, detalhe: detalheFatura(x) })).join('')
        || `<p class="fv2-nada">${!vivas.length ? 'Nenhum recebimento neste período.' : termo ? 'Nenhuma fatura com esse texto neste filtro.' : 'Nenhuma fatura neste filtro.'}</p>`,
      pe: maisHtml(resto, soRecebidas ? (resto === 1 ? 'recebida' : 'recebidas') : '', 'mostrar', 'rec') });
    const semNada = !todas.length && !atrasadas.length;
    return `<div class="fv2" data-tela="rec"><div class="fv2-in">
      ${topo({ titulo: 'Recebimentos', meio: periodoHtml(per, hoje), acoes: '<button type="button" class="fv2-btn" data-vc="ajuda">Como funciona</button><button type="button" class="fv2-btn p" data-vc="recebivel">Novo recebimento</button>' })}
      ${fala('Vorcaro · Financeiro', frase, atrasadas.length ? `<button type="button" class="fv2-btn s" data-fv="foco" data-valor="acao">Ver ${atrasadas.length === 1 ? 'a fatura' : 'as ' + n0(atrasadas.length)}</button>` : '')}
      ${numeros}${barra}
      ${semNada ? vazioLinha('Nenhum recebimento neste período; lance os contratos recorrentes e os pontuais.', '<button type="button" class="fv2-btn s" data-vc="recebivel">Lançar o primeiro</button>')
        : `<div class="fv2-grade a">${acao}${lista}</div>`}
      <p class="fv2-sub">Faturas recorrentes e pontuais, uma linha por fatura. A fatura abre no lugar com os detalhes.${fonte(d)}</p></div></div>`;
  }

  // ----- Contas a pagar -----
  function quandoConta(c, hoje) {
    const v = String(c.vencimento).slice(0, 10);
    if (c.cancelada) return pilula('Cancelada', 'n');
    if (c.pago_em) return pilula('Paga em ' + curta(c.pago_em), 'g');
    if (v < hoje) return pilula(quantos(diasEntre(v, hoje), 'dia', 'dias'), 'r');
    if (v === hoje) return pilula('Hoje', 'a');
    if (v === somaDia(hoje, 1)) return pilula('Amanhã', 'a');
    return pilula(v.slice(0, 7) === hoje.slice(0, 7) ? 'Dia ' + Number(v.slice(8, 10)) : curta(v), 'n');
  }
  function detalheConta(c, nomeGrupo, hoje, { dentro = true, comForm = true } = {}) {
    const v = String(c.vencimento).slice(0, 10), aberta = !c.pago_em && !c.cancelada;
    const linhas = hist([`${esc(nomeGrupo)}${c.fornecedor_nome ? ' · ' + esc(c.fornecedor_nome) : ''}`, `${v < hoje || c.pago_em ? 'Venceu' : 'Vence'} em ${extenso(v)}`, c.pago_em ? `Paga em ${extenso(c.pago_em)}` : '', c.cancelada ? 'Cancelada: fora dos totais' : '']);
    const acoes = !aberta ? '' : doFin(c.id) ? '<small class="fv2-sub">Dê baixa no Vybe Finanças</small>'
      : !comForm ? '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="contas">Abrir em Contas a pagar</button>'
      : dentro ? `<button type="button" class="fv2-btn s" data-vc="conta" data-id="${esc(c.id)}">Editar</button><button type="button" class="fv2-btn s fv2-perigo" data-vc="cancelar-conta" data-id="${esc(c.id)}">Cancelar</button>`
      : `<button type="button" class="fv2-btn s" data-vc-mes-ir="${v.slice(0, 7)}">Ver em ${esc(mesDe(v))}</button>`;
    return `${linhas}${acoes ? `<div class="fv2-det-acoes">${acoes}</div>` : ''}`;
  }
  const botaoPaguei = (c) => (c.pago_em || c.cancelada ? '' : doFin(c.id) ? '<small class="fv2-sub fv2-so-la">baixa no Vybe Finanças</small>' : umToque('pagar', c.id, 'Paguei'));
  const SINGULAR = { fixa: 'fixa', variavel: 'variável', folha: 'folha', imposto: 'imposto', investimento: 'investimento' };
  const linhaConta = (tela, c, nomeGrupo, hoje, opc) => linha({ tela, id: 'c' + c.id, pill: quandoConta(c, hoje),
    texto: `<b>${esc(c.descricao || 'Conta')}</b> · ${esc(SINGULAR[c.grupo] || nomeGrupo.toLowerCase())}, ${rs(c.valor)}`, dir: botaoPaguei(c), detalhe: detalheConta(c, nomeGrupo, hoje, opc) });
  // O que pede ação nas contas: as vencidas sem pagar e as que vencem em 7 dias, na ordem do vencimento.
  function contasQuePedem(d, hoje) {
    const r = d.resumo || {}, doPeriodo = (d.contas || []).filter((c) => !c.pago_em && !c.cancelada && String(c.vencimento).slice(0, 10) < hoje);
    const sete = r.sete_dias?.contas || (d.contas || []).filter((c) => !c.pago_em && !c.cancelada && String(c.vencimento).slice(0, 10) >= hoje && String(c.vencimento).slice(0, 10) <= somaDia(hoje, 7));
    const vistos = new Set(), unica = (c) => !vistos.has(String(c.id)) && vistos.add(String(c.id));
    return { vencidas: doPeriodo.filter(unica).sort((x, z) => String(x.vencimento).localeCompare(String(z.vencimento))), sete: sete.filter(unica).sort((x, z) => String(x.vencimento).localeCompare(String(z.vencimento))) };
  }

  function contas(ctx) {
    anfitriao = ctx;
    const u = ui.con, d = ctx.d || {}, hoje = d.hoje || hojeBahia(), per = d.periodo || {}, r = d.resumo || {}, rot = rotuloPeriodo(per, hoje), f = estado('comercial', per.mes || hoje.slice(0, 7))?.dados;
    const todas = d.contas || [], vivas = todas.filter((c) => !c.cancelada), ids = new Set(todas.map((c) => String(c.id))), contra = per.tipo === 'anual' ? 'contra o ano anterior' : 'contra o mês anterior';
    const grupos = (r.grupos || []).length ? r.grupos : (d.grupos || []).map((g) => ({ ...g, total: 0 })), nomeGrupo = (id) => grupos.find((g) => g.id === id)?.nome || id;
    const { vencidas, sete } = contasQuePedem(d, hoje), nVenc = Number(r.vencidas?.quantidade) || vencidas.length, nSete = sete.length;
    const termo = semAcento(ctx.filtro?.conta), bate = (c) => !termo || semAcento(`${c.descricao || ''} ${c.fornecedor_nome || ''} ${nomeGrupo(c.grupo)}`).includes(termo);
    const extra = { pagas: (c) => Boolean(c.pago_em), abertas: (c) => !c.pago_em, vencidas: (c) => !c.pago_em && String(c.vencimento).slice(0, 10) < hoje };
    const frase = !vivas.length ? `Nenhuma conta lançada em ${esc(rotuloFala(per, hoje))}.`
      : `Já saíram <b>${mil(r.pago)}</b> dos ${mil(r.total)} de ${esc(rotuloFala(per, hoje))}. ${nVenc ? `<b>${quantos(nVenc, 'conta venceu', 'contas venceram')} sem pagar</b>${nSete ? ` e ${quantos(nSete, 'vence', 'vencem')} em 7 dias` : ''}.` : nSete ? `<b>${quantos(nSete, 'conta vence', 'contas vencem')} em 7 dias</b>.` : 'Nada vence nos próximos 7 dias.'}`;
    // O faturamento do período é o "a receber"; se não vier como número, sai da conta do próprio resultado.
    const fat = typeof d.faturamento === 'number' ? d.faturamento : (Number(r.resultado) || 0) + (Number(r.total) || 0), temNumero = Number(r.total) || fat;
    const numeros = kpis([
      { rotulo: 'Pago', valor: mil(r.pago), barra: { v: pc(r.pago, r.total), cor: '#1F1D1A' }, tom: Number(r.pago) ? '' : 'quieto', dica: variou(r.variacao_total, contra),
        sub: Number(r.total) ? `${pc(r.pago, r.total)}% dos ${mil(r.total)} lançados` : 'nenhuma conta lançada no período' },
      { rotulo: 'A pagar', valor: mil(r.a_pagar), tom: nVenc ? 'ruim' : Number(r.a_pagar) ? '' : 'quieto',
        sub: `${nVenc ? `${quantos(nVenc, 'vencida', 'vencidas')} (${mil(r.vencidas?.total)})` : 'nenhuma vencida'} · ${nSete ? quantos(nSete, 'vence', 'vencem') + ' em 7 dias' : 'nada vence em 7 dias'}` },
      { rotulo: per.tipo === 'anual' ? 'Resultado do ano' : 'Resultado do mês', valor: temNumero ? mil(r.resultado) : 'R$ 0', tom: !temNumero ? 'quieto' : Number(r.resultado) < 0 ? 'ruim' : 'bom',
        sub: temNumero ? `faturamento a receber ${mil(fat)}, menos as contas` : 'sem faturamento nem contas no período' }]);
    const barra = filtros({ tela: 'con', busca: { chave: 'conta', rotulo: 'Buscar conta', dica: 'Buscar conta', valor: ctx.filtro?.conta },
      chips: [['todas', 'Todas', vivas.length], ...grupos.map((g) => [g.id, g.nome, vivas.filter((c) => c.grupo === g.id).length])],
      extras: [['pagas', 'Pagas', vivas.filter(extra.pagas).length], ['abertas', 'A pagar', vivas.filter(extra.abertas).length], ['vencidas', 'Vencidas', vivas.filter(extra.vencidas).length], ['canceladas', 'Canceladas', todas.length - vivas.length]] });
    const pedem = [...vencidas, ...sete].filter(bate), cabeA = u.acaoInteira || termo ? pedem : pedem.slice(0, 5);
    const acao = cartao({ titulo: 'Pede ação', rotulo: 'acao', sub: [nVenc ? quantos(nVenc, 'vencida', 'vencidas') : '', nSete ? quantos(nSete, 'vence', 'vencem') + ' em 7 dias' : ''].filter(Boolean).join(' · ') || 'nada vence em 7 dias',
      corpo: cabeA.map((c) => linhaConta('con', c, nomeGrupo(c.grupo), hoje, { dentro: ids.has(String(c.id)) })).join('') || `<p class="fv2-nada">${termo && vencidas.length + sete.length ? 'Nenhuma conta com esse texto vencendo.' : 'Nenhuma conta vencida nem vencendo em 7 dias.'}</p>`,
      pe: [maisHtml(pedem.length - cabeA.length, '', 'mostrar-acao', 'con'), 'A baixa é manual: quem pagou toca em Paguei.'].filter(Boolean).join(' · ') });
    // Para onde vai o dinheiro: um grupo por linha; a barra é a fatia do que já saiu; o grupo abre com as contas dele.
    const pagoTotal = Number(r.pago) || 0, somaGrupo = (g, so) => soma(vivas.filter((c) => c.grupo === g.id && (!so || c.pago_em)), 'valor');
    const filtradas = (g) => (u.extra === 'canceladas' ? todas.filter((c) => c.cancelada) : vivas.filter(u.extra ? extra[u.extra] : () => true)).filter((c) => c.grupo === g.id).filter(bate)
      .sort((x, z) => String(x.vencimento).localeCompare(String(z.vencimento)));
    const visiveis = grupos.filter((g) => (u.chip === 'todas' || u.extra ? true : g.id === u.chip)).filter((g) => (termo || u.extra ? filtradas(g).length : somaGrupo(g) > 0 || g.id === u.chip));
    const linhaGrupo = (g) => {
      const total = somaGrupo(g), pago = somaGrupo(g, true), n = vivas.filter((c) => c.grupo === g.id).length, falta = Math.max(0, total - pago), fatia = pc(pago, pagoTotal);
      const aberto = u.aberta === 'g' + g.id || (u.chip === g.id && !u.extra) || Boolean(termo) || Boolean(u.extra), dentro = filtradas(g);
      return `<div class="v2-abre fv2-linha" data-linha="g${esc(g.id)}" aria-expanded="${aberto}"><div class="fv2-lin fv2-gr">
          <button type="button" class="fv2-txt" data-fv="linha" data-tela="con" data-valor="g${esc(g.id)}" aria-expanded="${aberto}"><b>${esc(g.nome)}</b> · ${quantos(n, 'conta', 'contas')}</button>
          <div class="v2-barra"><i style="--v:${fatia}%;--c:#1F1D1A"></i></div><b class="fv2-valor">${fatia}%</b>
          <span class="fv2-sub">${falta ? `${parteDe(pago, total)} pagos` : `${mil(pago)} pagos`}</span>${falta ? pilula('falta ' + mil(falta), 'a') : total ? pilula('tudo pago', 'g') : pilula('nada lançado', 'n')}</div>
        <div class="v2-mais"><div><div class="fv2-det fv2-det-contas">${hist([g.percentual_faturamento != null && fat ? `${String(g.percentual_faturamento).replace('.', ',')}% do faturamento${variou(g.variacao, contra) ? ' · ' + variou(g.variacao, contra) : ''}` : variou(g.variacao, contra)])}
          ${dentro.map((c) => `<div class="fv2-mini">${quandoConta(c, hoje)}<p><b>${esc(c.descricao || 'Conta')}</b>${c.fornecedor_nome ? ' · ' + esc(c.fornecedor_nome) : ''} · ${rs(c.valor)}${c.pago_em || c.cancelada ? '' : ' · vence ' + curta(c.vencimento)}</p>
            ${c.cancelada || c.pago_em ? '' : doFin(c.id) ? '<small class="fv2-sub">Dê baixa no Vybe Finanças</small>' : `${umToque('pagar', c.id, 'Paguei')}<button type="button" class="fv2-btn s" data-vc="conta" data-id="${esc(c.id)}">Editar</button><button type="button" class="fv2-btn s fv2-perigo" data-vc="cancelar-conta" data-id="${esc(c.id)}">Cancelar</button>`}</div>`).join('') || '<p class="fv2-hist">Nenhuma conta deste grupo neste filtro.</p>'}</div></div></div></div>`;
    };
    const zerados = grupos.filter((g) => !somaGrupo(g)).map((g) => g.nome);
    const doFinancas = f?.conectado ? `<div class="fv2-lin fv2-fin"><span class="fv2-pill b">Vybe Finanças</span><p>${mil(f.resumo?.despesas_sem_folha ?? f.despesas?.total)} em despesas de ${esc(nomeMes(f.mes))}${f.folha?.total ? ` · folha ${mil(f.folha.total)}` : ''}</p>
        <span class="fv2-btn s espiavel" data-espiar="financas:comercial:despesas" role="button" tabindex="0">Por categoria</span><span class="fv2-btn s espiavel" data-espiar="financas:comercial:fixos" role="button" tabindex="0">Custos fixos</span></div>` : '';
    const paraOnde = cartao({ titulo: 'Para onde vai o dinheiro', sub: Number(r.total) ? `${parteDe(r.pago, r.total)} pagos` : '',
      corpo: (visiveis.map(linhaGrupo).join('') || `<p class="fv2-nada">${termo || u.extra ? 'Nenhuma conta neste filtro.' : 'A divisão aparece com a primeira conta lançada.'}</p>`) + doFinancas,
      pe: `A barra é a fatia do que já saiu.${zerados.length && vivas.length ? ` ${zerados.join(', ')}: nada lançado.` : ''} A folha entra como um grupo só, sem valor por pessoa.` });
    const falta = oQueFalta(ctx), semNada = !todas.length && !pedem.length;
    return `<div class="fv2" data-tela="con"><div class="fv2-in">
      ${topo({ titulo: 'Contas a pagar', meio: periodoHtml(per, hoje), acoes: '<button type="button" class="fv2-btn" data-vc="ajuda">Como funciona</button><button type="button" class="fv2-btn p" data-vc="conta">Nova conta</button>' })}
      ${fala('Vorcaro · Financeiro', frase, nVenc + nSete ? `<button type="button" class="fv2-btn s" data-fv="foco" data-valor="acao">Ver ${nVenc + nSete === 1 ? 'a conta' : 'as ' + n0(nVenc + nSete)}</button>` : '')}
      ${numeros}${barra}
      ${semNada ? vazioLinha('Nenhuma conta neste período; a divisão aparece com a primeira conta lançada.', `<button type="button" class="fv2-btn s" data-vc="conta">Lançar a primeira</button>${falta.botao}`)
        : `<div class="fv2-grade b">${acao}${paraOnde}</div>${falta.botao ? `<div class="fv2-rodape">${falta.botao}</div>` : ''}`}
      ${falta.nota}
      <p class="fv2-sub">Fixas, variáveis, folha, impostos e investimentos do período. O grupo abre no lugar com as contas dele.${fonte(d)}</p></div></div>`;
  }

  // ----- Inadimplência -----
  function inadimplencia(ctx) {
    anfitriao = ctx;
    const u = ui.ina, d = ctx.d || {}, hoje = d.hoje || hojeBahia(), f = estado('comercial', hoje.slice(0, 7))?.dados, real = f?.conectado ? f.inadimplencia : null;
    // Com o Vybe Finanças ligado, os números e os clientes vêm dele; as faturas com baixa no Vybe OS continuam nas linhas.
    const clientes = [...((real ? real.clientes : d.clientes) || [])].sort((x, z) => z.atraso_mais_antigo - x.atraso_mais_antigo), faturas = d.faturas || [];
    const total = Number(real ? real.total : d.total) || 0, nFat = Number(real ? real.faturas : faturas.length) || soma(clientes, 'faturas'), criticos = clientes.filter((c) => c.atraso_mais_antigo > 30);
    const antigo = clientes[0], termo = semAcento(ctx.filtro?.inad), bate = (c) => !termo || semAcento(c.cliente_nome).includes(termo);
    const faixa = { todos: () => true, ate7: (c) => c.atraso_mais_antigo <= 7, de8a30: (c) => c.atraso_mais_antigo > 7 && c.atraso_mais_antigo <= 30, criticos: (c) => c.atraso_mais_antigo > 30 };
    const marcados = d.marcados_a_mao || [], semPar = real ? clientes.filter((c) => c.no_vybe === false && (c.cliente_id || c.cliente_nome !== 'Sem cliente')) : [];
    const frase = !clientes.length ? 'Ninguém em atraso. As faturas vencidas e não recebidas aparecem aqui.'
      : `<b>${mil(total)}</b> em atraso de ${quantos(clientes.length, 'cliente', 'clientes')}; o mais antigo há ${quantos(antigo.atraso_mais_antigo, 'dia', 'dias')}. ${criticos.length ? `<b>${quantos(criticos.length, 'passou', 'passaram')} de 30 dias</b>.` : 'Ninguém passou de 30 dias.'}`;
    const numeros = kpis([
      { rotulo: 'Em atraso', valor: mil(total), tom: total ? 'ruim' : 'quieto', sub: clientes.length ? `${quantos(nFat, 'fatura', 'faturas')} de ${quantos(clientes.length, 'cliente', 'clientes')}` : 'nada em atraso', espiar: real ? 'financas:comercial:inad' : '' },
      { rotulo: 'O mais antigo', valor: antigo ? quantos(antigo.atraso_mais_antigo, 'dia', 'dias') : '0 dias', tom: antigo ? '' : 'quieto', sub: antigo ? `${cli(antigo.cliente_nome)} · venceu em ${extenso(antigo.vencimento_mais_antigo)}` : 'nenhuma fatura vencida' },
      { rotulo: 'Críticos (mais de 30 dias)', valor: n0(criticos.length), tom: criticos.length ? 'ruim' : 'quieto', espiar: real ? '' : 'comercial:inadimplencia:criticos',
        sub: criticos.length ? criticos.slice(0, 3).map((c) => cli(c.cliente_nome)).join(' ') : 'ninguém passou de 30 dias' }]);
    const barra = filtros({ tela: 'ina', busca: { chave: 'inad', rotulo: 'Buscar cliente em atraso', dica: 'Buscar cliente', valor: ctx.filtro?.inad },
      chips: [['todos', 'Todos', clientes.length], ['ate7', 'Até 7 dias', clientes.filter(faixa.ate7).length], ['de8a30', '8 a 30 dias', clientes.filter(faixa.de8a30).length], ['criticos', 'Críticos', criticos.length]],
      extras: [['marcados', 'Marcados à mão', marcados.length], ...(real ? [['sempar', 'Sem par no Vybe OS', semPar.length]] : [])] });
    const doCliente = (c) => faturas.filter((x) => (c.cliente_id != null && String(x.cliente_id) === String(c.cliente_id)) || (c.cliente_id == null && (x.cliente_nome || x.descricao) === c.cliente_nome));
    const meses = (l) => [...new Set(l.map((x) => mesDe(x.vencimento)))].filter(Boolean).join(' e ');
    const linhaCliente = (c) => {
      const l = doCliente(c), uma = l.length === 1 && Number(c.faturas) <= 1 ? l[0] : null;
      const detalhe = hist([`Venceu em ${extenso(c.vencimento_mais_antigo)}`, c.descricao ? esc(c.descricao) : '', real && c.no_vybe === false ? 'Sem par no Vybe OS: a ligação é pelo CNPJ ou pelo nome' : ''])
        + (l.length ? l.map((x) => `<div class="fv2-mini">${pilula(quantos(x.atraso, 'dia', 'dias'), 'r')}<p>${esc(oQueE(x))} · ${rs(x.aberto ?? x.valor)} em aberto · venceu em ${extenso(x.vencimento)}</p>
            ${doFin(x.id) ? '<small class="fv2-sub">Dê baixa no Vybe Finanças</small>' : `${uma ? '' : botaoRecebi(x)}<button type="button" class="fv2-btn s" data-vc="receber" data-id="${esc(x.id)}">Recebi uma parte</button>`}</div>`).join('')
          : '<p class="fv2-hist">A baixa destes lançamentos é no Vybe Finanças</p>');
      return linha({ tela: 'ina', id: 'k' + (c.cliente_id ?? c.cliente_nome), pill: pilula(quantos(c.atraso_mais_antigo, 'dia', 'dias'), 'r'),
        texto: `${cli(c.cliente_nome)} · ${l.length ? esc(meses(l)) + ', ' : ''}${rs(c.valor)}${Number(c.faturas) > 1 ? ' · ' + quantos(c.faturas, 'fatura', 'faturas') : ''}`,
        dir: uma ? botaoRecebi(uma) : `<button type="button" class="fv2-btn s" data-fv="linha" data-tela="ina" data-valor="k${esc(c.cliente_id ?? c.cliente_nome)}">${l.length ? 'Ver as faturas' : 'Ver'}</button>`, detalhe });
    };
    const base = (u.extra === 'sempar' ? semPar : clientes.filter(faixa[u.chip] || faixa.todos)).filter(bate), cabe = u.inteira || termo ? base : base.slice(0, 6);
    const STATUS = { atrasado: 'Atrasado', inadimplente: 'Inadimplente' };
    const lista = u.extra === 'marcados'
      ? cartao({ titulo: 'Marcados à mão', rotulo: 'acao', sub: 'em Finanças por cliente', corpo: marcados.filter(bate).map((m) => `<div class="fv2-lin">${pilula(STATUS[m.status_pagamento] || 'Marcado', m.status_pagamento === 'inadimplente' ? 'r' : 'a')}<p class="fv2-txt">${cli(m.cliente_nome)}</p><button type="button" class="fv2-btn s" data-fv="ir" data-valor="financas">Abrir</button></div>`).join('') || '<p class="fv2-nada">Ninguém marcado à mão.</p>',
        pe: 'O status marcado à mão não muda as faturas.' })
      : cartao({ titulo: 'Clientes em atraso', rotulo: 'acao', sub: clientes.length ? `${quantos(clientes.length, 'pede', 'pedem')} ação, do mais antigo ao mais novo` : '',
        corpo: cabe.map(linhaCliente).join('') || `<p class="fv2-nada">${clientes.length ? 'Nenhum cliente neste filtro.' : 'Ninguém em atraso.'}</p>`,
        pe: [maisHtml(base.length - cabe.length, '', 'mostrar', 'ina'), 'A linha abre no lugar com as faturas do cliente.'].filter(Boolean).join(' · ') });
    // Régua do atraso: cada bolinha é um cliente, na cor dele, no dia em que está (a escala vai até 30 dias).
    const pos = (dias) => Math.max(2, Math.min(97, Math.round(Math.min(Number(dias) || 0, 33) / 33 * 100)));
    const regua = cartao({ titulo: 'Régua do atraso', rotulo: 'regua', cls: 'fv2-regua', sub: clientes.length ? quantos(clientes.length, 'cliente', 'clientes') : '',
      corpo: `<div class="fv2-tri" role="img" aria-label="${esc(clientes.map((c) => `${c.cliente_nome}: ${quantos(c.atraso_mais_antigo, 'dia', 'dias')}`).join(', ') || 'Ninguém em atraso')}">
          ${clientes.map((c) => `<span class="fv2-pt fv2-cli" data-carteira="${esc(carteiraDe(c.cliente_nome))}" style="left:${pos(c.atraso_mais_antigo)}%" title="${esc(c.cliente_nome)}: ${quantos(c.atraso_mais_antigo, 'dia', 'dias')}"></span>`).join('')}
          <span class="fv2-mk" style="left:${pos(7)}%">7 dias</span><span class="fv2-mk" style="left:${pos(30)}%">30 dias</span></div>
        <div class="fv2-lin fv2-faixa">${pilula('Até 7 dias', 'n')}<p>atenção: ${quantos(clientes.filter(faixa.ate7).length, 'cliente', 'clientes')}</p></div>
        <div class="fv2-lin fv2-faixa">${pilula('8 a 30 dias', 'a')}<p>alto: ${quantos(clientes.filter(faixa.de8a30).length, 'cliente', 'clientes')}</p></div>
        <div class="fv2-lin fv2-faixa">${pilula('Mais de 30', 'r')}<p>crítico: ${quantos(criticos.length, 'cliente', 'clientes')}</p></div>`,
      pe: 'A cobrança é com o cliente e quem fala com ele é o sócio; aqui fica só o registro do que entrou.' });
    const falta = oQueFalta(ctx), semNada = !clientes.length && u.extra !== 'marcados';
    return `<div class="fv2" data-tela="ina"><div class="fv2-in">
      ${topo({ titulo: 'Inadimplência', acoes: '<button type="button" class="fv2-btn" data-vc="ajuda">Como funciona</button><button type="button" class="fv2-btn" data-fv="ir" data-valor="recebimentos">Ver recebimentos</button>' })}
      ${fala('Vorcaro · Financeiro', frase, clientes.length ? '<button type="button" class="fv2-btn s" data-fv="foco" data-valor="regua">Ver a régua</button>' : '')}
      ${numeros}${barra}
      ${semNada ? vazioLinha('Ninguém em atraso; as faturas vencidas e não recebidas aparecem aqui.', `<button type="button" class="fv2-btn s" data-fv="ir" data-valor="recebimentos">Ver recebimentos</button>${falta.botao}`)
        : `<div class="fv2-grade c">${lista}${regua}</div>${falta.botao ? `<div class="fv2-rodape">${falta.botao}</div>` : ''}`}
      ${falta.nota}
      <p class="fv2-sub">Faturas vencidas e não recebidas, por cliente. Cada bolinha na régua é um cliente, na cor dele, no dia em que está.${real ? ' Fonte: Vybe Finanças.' : fonte(d)}</p></div></div>`;
  }

  // ----- Finanças (Visão geral do setor) -----
  async function lerVisao() {
    const hoje = hojeBahia(), atual = hoje.slice(0, 7), u = ui.vis, mes = u.per === 'anterior' ? somaMes(atual, -1) : atual, tipo = u.per === 'ano' ? 'anual' : 'mensal', q = `&mes=${mes}&periodo=${tipo}`;
    const passados = [3, 2, 1].map((n) => somaMes(atual, -n));
    const [vf, rec, con, ina, cx, porCliente, ...antes] = await Promise.all([carregar('comercial', mes), buscar('recebimentos' + q), buscar('contas' + q), buscar('inadimplencia'), buscar('caixa'), buscar('financas'),
      ...passados.map((m) => buscar(`recebimentos&mes=${m}&periodo=mensal`))]);
    return { hoje, atual, mes, tipo, vf: vf?.dados || null, rec, con, ina, cx, porCliente, passados: passados.map((m, i) => ({ mes: m, dados: antes[i] })) };
  }
  function visaoHtml(L, ctx = {}) {
    const u = ui.vis, { hoje, atual, mes, tipo } = L, ligado = tipo === 'mensal' && L.vf?.conectado && L.vf.resumo ? L.vf : null;
    const R = ligado?.resumo || {}, A = L.rec?.resumo?.atual || {}, K = L.con?.resumo || {};
    const entrou = Number(ligado ? R.recebido : A.recebido) || 0, previsto = Number(ligado ? R.previsto : A.a_receber) || 0;
    const saiu = Number(ligado ? R.despesas_pagas : K.pago) || 0, aSair = Number(ligado ? (Number(R.despesas_pagas) || 0) + (Number(R.despesas_pendentes) || 0) : K.total) || 0;
    const I = ligado?.inadimplencia || L.ina || {}, atrasados = [...(I.clientes || [])].sort((x, z) => z.atraso_mais_antigo - x.atraso_mais_antigo), totalAtraso = Number(I.total) || 0;
    const noPeriodo = (L.rec?.recebiveis || []).filter((x) => !x.cancelado && emAtraso(x)), atrasoPeriodo = Math.min(previsto, soma(noPeriodo, 'aberto'));
    const resultado = previsto - aSair, semEles = resultado - atrasoPeriodo, verbo = u.per === 'anterior' ? 'fechou' : 'fecha';
    const nomeP = tipo === 'anual' ? mes.slice(0, 4) : maiuscula(mesDe(mes + '-01')), sobra = (v) => (v >= 0 ? `<b>${mil(v)} de sobra</b>` : `<b>${mil(-v)} no vermelho</b>`);
    const semDado = !previsto && !aSair && !entrou && !saiu;
    const frase = semDado ? `Sem lançamentos em ${esc(tipo === 'anual' ? mes.slice(0, 4) : nomeMes(mes))}. Lance os recebimentos e as contas para ver como o período fecha.`
      : noPeriodo.length ? `${esc(nomeP)} ${verbo} com ${sobra(resultado)} se ${noPeriodo.length === 1 ? 'a fatura em atraso for paga' : `as ${n0(noPeriodo.length)} faturas em atraso forem pagas`}. Sem ${noPeriodo.length === 1 ? 'ela' : 'elas'}, ${semEles >= 0 ? `sobra <b>${mil(semEles)}</b>` : `faltam <b>${mil(-semEles)}</b>`}.${ligado?.folha?.total ? ` A folha do mês é de ${mil(ligado.folha.total)}.` : ''}`
      : `${esc(nomeP)} ${verbo} com ${sobra(resultado)}: ${mil(previsto)} previstos para entrar e ${mil(aSair)} em contas.${ligado?.folha?.total ? ` A folha do mês é de ${mil(ligado.folha.total)}.` : ''}`;
    // "Ver a conta": de onde sai a frase, e os números que não têm cartão próprio.
    const F = L.porCliente?.resumo || {}, conta = [['Previsto para entrar', rs(previsto)], ['Já entrou', rs(entrou)], ['Contas do período', rs(aSair)], ['Já saiu', rs(saiu)], ['Resultado previsto', rs(resultado)],
      ...(atrasoPeriodo ? [['Em atraso no período', rs(atrasoPeriodo)]] : []), ['Em atraso, de qualquer mês', rs(totalAtraso)],
      ...(Number(A.pendente) ? [['Pendente de receber', rs(A.pendente)]] : []),
      ...(Number(F.receita) ? [['Receita contratada por mês', `${rs(F.receita)}${F.margem_percentual != null ? ` · margem estimada ${String(F.margem_percentual).replace('.', ',')}%` : ''}`]] : []),
      ...(ligado ? [['Folha do mês (Vybe Finanças)', rs(ligado.folha?.total)], ['Custos fixos (Vybe Finanças)', rs(ligado.custos_fixos?.total)], ['Outras despesas (Vybe Finanças)', rs(R.despesas_sem_folha ?? ligado.despesas?.total)]] : [])];
    const falaHtml = `<div class="v2-abre fv2-conta" data-linha="conta" aria-expanded="${u.conta}">${fala('Vorcaro · Tesouraria', frase, semDado ? '' : `<button type="button" class="fv2-btn s" data-fv="conta" aria-expanded="${u.conta}">Ver a conta</button>`)}
      <div class="v2-mais"><div><dl class="fv2-dl">${conta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div></div></div>`;
    const fatias = ligado ? (ligado.despesas?.categorias || []).slice(0, 3).map((c) => `${esc(c.categoria)} ${Math.round(Number(c.percentual) || 0)}%`)
      : [...(K.grupos || [])].filter((g) => Number(g.total) > 0).sort((x, z) => z.total - x.total).slice(0, 3).map((g) => `${esc(g.nome)} ${pc(g.total, K.total)}%`);
    const numeros = kpis([
      { rotulo: 'Entrou', valor: mil(entrou), barra: { v: pc(entrou, previsto) }, tom: entrou ? '' : 'quieto', sub: previsto ? `${pc(entrou, previsto)}% dos ${mil(previsto)} previstos` : 'nada previsto no período' },
      { rotulo: 'Saiu', valor: mil(saiu), barra: { v: pc(saiu, aSair), cor: '#1F1D1A' }, tom: saiu ? '' : 'quieto', sub: aSair ? `${fatias.join(' · ')}${fatias.length ? ' · ' : ''}${pc(saiu, aSair)}% dos ${mil(aSair)} do período` : 'nenhuma conta lançada no período' },
      { rotulo: 'Em atraso', valor: mil(totalAtraso), tom: totalAtraso ? 'ruim' : 'quieto',
        sub: atrasados.length ? `<span class="fv2-clis">${atrasados.slice(0, 3).map((c) => cli(c.cliente_nome)).join('')}</span>o mais antigo há ${quantos(atrasados[0].atraso_mais_antigo, 'dia', 'dias')} · <button type="button" class="fv2-link" data-fv="ir" data-valor="inadimplencia">ver quem</button>` : 'ninguém em atraso' }]);
    // Pede ação: quem está em atraso, as contas vencendo e o que falta ligar ou informar.
    const faturas = L.ina?.faturas || [], itens = [];
    for (const c of atrasados) {
      const l = faturas.filter((x) => c.cliente_id != null && String(x.cliente_id) === String(c.cliente_id)), uma = l.length === 1 && Number(c.faturas) <= 1 ? l[0] : null;
      itens.push(linha({ tela: 'vis', id: 'k' + (c.cliente_id ?? c.cliente_nome), pill: pilula(quantos(c.atraso_mais_antigo, 'dia', 'dias'), 'r'),
        texto: `${cli(c.cliente_nome)} · ${uma ? esc(oQueE(uma)) + ', ' : ''}${rs(c.valor)}${Number(c.faturas) > 1 ? ' · ' + quantos(c.faturas, 'fatura', 'faturas') : ''}`,
        dir: uma && !doFin(uma.id) ? botaoRecebi(uma) : '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="inadimplencia">Abrir</button>',
        detalhe: hist([`Venceu em ${extenso(c.vencimento_mais_antigo)}`, Number(c.faturas) > 1 ? `${quantos(c.faturas, 'fatura vencida', 'faturas vencidas')}, a mais antiga há ${quantos(c.atraso_mais_antigo, 'dia', 'dias')}` : '', 'A baixa e o histórico ficam em Inadimplência']) }));
    }
    if (L.con) { const p = contasQuePedem(L.con, hoje), nome = (id) => (K.grupos || []).find((g) => g.id === id)?.nome || id;
      for (const c of [...p.vencidas, ...p.sete]) itens.push(linhaConta('vis', c, nome(c.grupo), hoje, { comForm: false })); }
    if (L.vf && L.vf.conectado === false) itens.push(`<div class="fv2-lin">${pilula('Ligar', 'n')}<p class="fv2-txt"><b>Controle financeiro</b> · os valores reais chegam quando ele for ligado</p><button type="button" class="fv2-btn s" data-fv="ir" data-valor="financas">Ver como</button></div>`);
    const semContrato = (L.porCliente?.clientes || []).filter((c) => !(Number(c.valor_mensal) > 0)).length;
    if (semContrato) itens.push(`<div class="fv2-lin">${pilula('Contrato', 'n')}<p class="fv2-txt"><b>${quantos(semContrato, 'cliente', 'clientes')}</b> sem contrato informado: sem o valor não há margem</p><button type="button" class="fv2-btn s" data-fv="ir" data-valor="financas">Informar</button></div>`);
    const cabe = u.inteira ? itens : itens.slice(0, 5);
    const acao = cartao({ titulo: 'Pede ação', rotulo: 'acao', sub: itens.length ? `${quantos(itens.length, 'coisa', 'coisas')}, na ordem` : '', corpo: cabe.join('') || '<p class="fv2-nada">Nada pedindo ação agora.</p>',
      pe: [maisHtml(itens.length - cabe.length, '', 'mostrar', 'vis'), 'A linha abre no lugar com o detalhe. A baixa é manual, de quem viu o dinheiro entrar ou sair.'].filter(Boolean).join(' · ') });
    // Caixa: três meses atrás (o que entrou), o mês de agora e três à frente (projeção).
    const serie = new Map((ligado?.series || L.vf?.series || []).map((s) => [s.mes, Number(s.faturamento) || 0]));
    const prev = L.cx?.previsao?.meses || [];
    const colunas = [...L.passados.map((p) => ({ mes: p.mes, valor: serie.has(p.mes) ? serie.get(p.mes) : Number(p.dados?.resumo?.atual?.recebido) || 0, tipo: 'antes' })),
      ...[0, 1, 2, 3].map((n) => { const m = somaMes(atual, n), x = prev.find((y) => y.mes === m); return { mes: m, valor: Number(x?.entradas) || 0, tipo: n ? 'depois' : 'agora' }; })];
    const teto = Math.max(1, ...colunas.map((c) => c.valor)), temCaixa = colunas.some((c) => c.valor > 0);
    const caixa = cartao({ titulo: 'Caixa', rotulo: 'caixa', cls: 'fv2-caixa', sub: '3 meses atrás, 3 à frente',
      corpo: temCaixa ? `<div class="fv2-cols" role="img" aria-label="${esc(colunas.map((c) => `${mesDe(c.mes + '-01')}: ${mil(c.valor)}`).join(', '))}">${colunas.map((c) => `<div class="fv2-col ${c.tipo}" title="${esc(mesDe(c.mes + '-01'))}: ${mil(c.valor)}"><i style="--h:${c.valor ? Math.max(4, Math.round(c.valor / teto * 100)) : 0}%"></i><span>${esc(mesDe(c.mes + '-01').slice(0, 3))}</span></div>`).join('')}</div>`
        : '<p class="fv2-nada">O caixa aparece com o primeiro recebimento recorrente lançado.</p>',
      pe: 'Cinza é o que entrou; laranja, o previsto do mês; listrado é projeção dos recebimentos recorrentes e do ciclo de cada contrato.' });
    const subs = (ctx.subs || []).map((s) => `<button type="button" class="fv2-chip" data-fv="ir" data-valor="${esc(s.id)}">${esc(s.nome)}${s.url ? ' ↗' : ''}</button>`).join('');
    const seg = [['anterior', maiuscula(mesDe(somaMes(atual, -1) + '-01'))], ['atual', maiuscula(mesDe(atual + '-01'))], ['ano', 'Ano']];
    return `<div class="fv2" data-tela="vis"><div class="fv2-in">
      ${topo({ titulo: 'Finanças', trilha: false, meio: `<span class="fv2-seg" role="group" aria-label="Período">${seg.map(([k, n]) => `<button type="button" data-fv="per" data-valor="${k}" aria-pressed="${u.per === k}">${esc(n)}</button>`).join('')}</span>`,
        acoes: `<span class="fv2-lancar"><button type="button" class="fv2-btn p" data-fv="lancar" aria-expanded="${u.lancar}">Lançar</button>${u.lancar ? '<span class="fv2-menu" role="menu"><button type="button" role="menuitem" data-fv="novo" data-valor="recebimentos">Recebimento</button><button type="button" role="menuitem" data-fv="novo" data-valor="contas">Conta a pagar</button></span>' : ''}</span>` })}
      ${falaHtml}${numeros}
      <div class="fv2-grade a">${acao}${caixa}</div>
      <div class="fv2-abrir"><span class="fv2-sub">Abrir:</span>${subs}<button type="button" class="fv2-chip" data-fv="ir" data-valor="caixa">Caixa</button><button type="button" class="fv2-chip" data-fv="ir" data-valor="rh">Folha</button></div></div></div>`;
  }
  async function visao(ctx = {}) { visita = ctx; return visaoHtml(await lerVisao(), ctx); }

  // ----- Interação -----
  const avisar = (texto) => { try { if (typeof showToast === 'function') return showToast(texto, 'error', 4500); } catch { /* sem aviso na tela */ } console.warn('[financas]', texto); };
  // Vai para outra tela pelo menu lateral (que marca o item); sem ele, pela janela do módulo.
  function ir(id) {
    if (visita?.abrirSub && (visita.subs || []).some((s) => s.id === id) && document.querySelector('.fv2[data-tela="vis"]')?.getClientRects().length) return visita.abrirSub(id);
    const alvo = document.querySelector(`.vv-trilho [data-submodulo="${id}"], .vv-trilho [data-visao-setor="${id}"], .vv-trilho [data-trilho="${id}"]`);
    if (alvo) return alvo.click();
    if (id === 'rh') return window.VybePessoas?.abrir?.('rh', { abas: ['rh'], rotulo: 'Recursos Humanos' });
    if (!id.startsWith('setor:')) window.VybeComercial?.abrir?.(id, { abas: [id], rotulo: 'Finanças' });
  }
  async function repintarVisao() {
    const el = document.querySelector('.fv2[data-tela="vis"]'); if (!el) return;
    el.classList.add('fv2-lendo');
    const html = visaoHtml(await lerVisao(), visita || {}), t = document.createElement('template');
    t.innerHTML = html;
    if (el.isConnected && t.content.firstElementChild) el.replaceWith(t.content.firstElementChild);
  }
  const repintar = (tela) => (tela === 'vis' ? repintarVisao() : anfitriao?.repintar?.());
  // "Recebi" e "Paguei": o botão gira, grava e vira "Recebido" ou "Pago"; se o servidor recusar, volta ao que era.
  async function baixa(b, corpo, feito) {
    if (b.dataset.estado) return;
    const tela = b.closest('.fv2')?.dataset.tela;
    b.dataset.estado = 'indo';
    try {
      const r = await fetch('/api/painel?area=comercial', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Não foi possível gravar agora.');
      b.dataset.estado = 'feito'; b.textContent = feito;
      lidas.clear();
      setTimeout(() => (tela === 'vis' ? repintarVisao() : (anfitriao?.recarregar || anfitriao?.repintar)?.()), 900);
    } catch (e) { delete b.dataset.estado; avisar(e.message); }
  }
  function aoClicar(ev) {
    const b = ev.target.closest?.('[data-fv]'), raiz = b?.closest('.fv2'); if (!b || !raiz) return;
    const acao = b.dataset.fv, valor = b.dataset.valor || '', tela = b.dataset.tela || raiz.dataset.tela, u = ui[tela] || {};
    if (acao === 'chip') { u.chip = valor; u.extra = ''; u.aberta = ''; u.inteira = false; return repintar(tela); }
    if (acao === 'extra') { u.extra = u.extra === valor ? '' : valor; u.aberta = ''; return repintar(tela); }
    if (acao === 'filtros') { u.filtros = !u.filtros; if (!u.filtros) u.extra = ''; return repintar(tela); }
    if (acao === 'mostrar') { u.inteira = true; return repintar(tela); }
    if (acao === 'mostrar-acao') { u.acaoInteira = true; return repintar(tela); }
    if (acao === 'linha') { // abre no lugar, sem pintar a tela de novo; uma por vez
      u.aberta = u.aberta === valor ? '' : valor;
      for (const l of raiz.querySelectorAll('.fv2-linha')) { const on = l.dataset.linha === u.aberta; l.setAttribute('aria-expanded', on); l.querySelector('.fv2-txt')?.setAttribute('aria-expanded', on); }
      return;
    }
    if (acao === 'conta') { u.conta = !u.conta; raiz.querySelector('.fv2-conta')?.setAttribute('aria-expanded', u.conta); b.setAttribute('aria-expanded', u.conta); return; }
    if (acao === 'foco') { const alvo = raiz.querySelector(`[data-fv-card="${valor}"]`); if (alvo) { alvo.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); alvo.classList.remove('fv2-olha'); void alvo.offsetWidth; alvo.classList.add('fv2-olha'); } return; }
    if (acao === 'ir') return ir(valor);
    if (acao === 'per') { ui.vis.per = valor; ui.vis.aberta = ''; ui.vis.inteira = false; return repintarVisao(); }
    if (acao === 'lancar') { ui.vis.lancar = !ui.vis.lancar; return repintarVisao(); }
    if (acao === 'novo') { // abre a tela e, quando ela estiver pintada, o formulário de lançar
      ui.vis.lancar = false; ir(valor);
      let n = 0; const t = setInterval(() => { const novo = document.querySelector(`#vv-comercial .fv2 .fv2-btn.p[data-vc="${valor === 'contas' ? 'conta' : 'recebivel'}"]`); if (novo) { clearInterval(t); novo.click(); } else if (++n > 40) clearInterval(t); }, 150);
      return;
    }
    if (acao === 'receber') return baixa(b, { acao: 'recebivel_receber', id: valor, valor_recebido: Number(b.dataset.total) || 0, recebido_em: hojeBahia() }, 'Recebido');
    if (acao === 'pagar') return baixa(b, { acao: 'conta_pagar', id: valor }, 'Pago');
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', aoClicar);
    document.addEventListener('click', (ev) => { if (ui.vis.lancar && !ev.target.closest?.('.fv2-lancar')) { ui.vis.lancar = false; repintarVisao(); } });
  }
  const telas = Object.freeze({ recebimentos, contas, inadimplencia, visao, _teste: { ui, visaoHtml, lidas } });

  window.VybeFinancas = Object.freeze({ carregar, estado, ligado, contratosDaCarteira, contratoDoCliente, telas });
})();
