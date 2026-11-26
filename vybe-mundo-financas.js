// vybe-mundo-financas.js — as telas de Finanças das janelas do Irecity, com o dinheiro do extrato do banco. SÓ LEITURA.
// Paulo, 14/11/2026: "o financeiro você não vai puxar os dados do Vybe Finanças; os dados são só o histórico dos 3 meses
// que mandei do banco". Lê /api/painel?area=financeiro&parte=… (server/financeiro.js → server/financeiro-fonte.js, o
// extrato no formato que estas telas já sabiam mostrar) e guarda a resposta por parte e mês, para o
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
    // Contratos da Carteira: só os do Vybe OS (o extrato não tem contrato); nada a pedir.
    if (parte === 'carteira') return { ok: true, parte, conectado: false, contratos: [] };
    const r = await fetch(`/api/painel?area=financeiro&parte=${encodeURIComponent(parte)}${mes ? `&mes=${encodeURIComponent(mes)}` : ''}`,
      { credentials: 'same-origin', cache: 'no-store' });
    let d = {}; try { d = await r.json(); } catch { /* sem corpo */ }
    if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || 'O financeiro não respondeu agora.'), { status: r.status, indisponivel: Boolean(d.financas_indisponivel) });
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
    const rodape = 'fonte: extrato do banco';
    if (parte === 'comercial') {
      if (tipo === 'despesas') return { titulo: `Despesas de ${nomeMes(d.mes)} por categoria`, rodape, vazio: 'Nenhuma despesa no mês.',
        itens: d.despesas.categorias.map((c) => ({ nome: c.categoria, sub: `${c.quantidade} lançamento${c.quantidade === 1 ? '' : 's'}${c.pendente ? ` · ${din(c.pendente)} pendente` : ''}`, dir: din(c.total) })) };
      if (tipo === 'fixos') return { titulo: 'Gastos fixos', rodape, vazio: 'Nenhum gasto fixo cadastrado.',
        itens: d.custos_fixos.itens.map((s) => ({ nome: s.nome, sub: s.dia_renovacao ? `renova dia ${s.dia_renovacao}` : '', dir: din(s.custo) + '/mês' })) };
      if (tipo === 'inad') return { titulo: 'Receitas vencidas e não pagas', cls: 'u1', rodape, vazio: 'Ninguém em atraso.',
        itens: d.inadimplencia.clientes.map((c) => ({ nome: c.cliente_nome, sub: `${c.faturas} lançamento${c.faturas === 1 ? '' : 's'} · ${c.atraso_mais_antigo} dia${Number(c.atraso_mais_antigo) === 1 ? '' : 's'} de atraso`, dir: din(c.valor), cls: c.atraso_mais_antigo > 30 ? 'u1' : '' })) };
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
    }
    if (parte === 'rh' && tipo === 'folha' && d.folha) return { titulo: `Folha de ${nomeMes(d.folha.mes)}`, rodape, vazio: 'Nenhum salário no extrato do mês.',
      itens: d.folha.funcionarios.map((f) => ({ nome: f.nome, sub: [f.cargo, f.dia_pagamento ? `paga dia ${f.dia_pagamento}` : ''].filter(Boolean).join(' · '), dir: din(f.total),
        cls: f.variacao > 0 ? 'u2' : '' })) };
    return null;
  };

  // ---------- Telas de Finanças na Direção 3 (moodboard 3, aprovado pelo Paulo em 13/11/2026) ----------
  // Cada tela é o quadro D3 dela, nesta ordem: cabeçalho com o selo "só donos", o bloco de ação laranja do Vorcaro
  // (frase curta e um botão), os números (d3NumHtml, com a barra ou a mini linha), as fichas com a contagem e,
  // embaixo, o "Pede ação" ao lado do cartão da tela. A frase explicativa virou forma: o que era legenda está no número,
  // na pílula ou na linha que abre. Quem hospeda é a janela do Comercial (as três abas) e a Visão geral do setor:
  //   VybeFinancas.telas.recebimentos|contas|inadimplencia({ d, filtro, verFalta, admin, repintar, recarregar }) → HTML
  //   VybeFinancas.telas.visao({ subs, abrirSub }) → Promise<HTML>
  // d = a resposta de /api/painel?area=comercial&aba=…; filtro = o objeto das buscas da janela (rec, conta, inad).
  // Os botões que já existiam (formulários, período, busca, ajuda) saem com os mesmos data-vc da janela; o que é só
  // destas telas (fichas, linha que abre, "Recebi" e "Paguei" de um toque) usa data-fv e é tratado aqui.
  // As peças d3AcaoHtml, d3NumHtml e d3LinhaSvg são da base (vybe-core.js; CSS em padrao-v2/0-d3-base.css).
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const n0 = (v) => Math.round(Number(v) || 0).toLocaleString('pt-BR');
  const mil = (v) => { const n = Number(v) || 0, a = Math.abs(n); return `${n < 0 ? '-' : ''}R$ ${a >= 1000 ? (a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : n0(a)}`; };
  const rs = (v) => { const n = Number(v) || 0; return `${n < 0 ? '-' : ''}R$ ${Math.abs(n).toLocaleString('pt-BR', Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
  // "R$ 5,7 de 9,6 mil": os dois em mil, a unidade uma vez só.
  const parteDe = (a, b) => (Math.abs(Number(a)) >= 1000 && Math.abs(Number(b)) >= 1000 ? `${mil(a).replace(' mil', '')} de ${mil(b).replace('R$ ', '')}` : `${mil(a)} de ${mil(b)}`);
  // O número com o total ao lado, mais apagado: "R$ 38,2 mil / 48,6".
  const sobre = (a, b) => (Number(b) ? `${mil(a)}<small class="d3f-de"> / ${Math.abs(Number(a)) >= 1000 && Math.abs(Number(b)) >= 1000 ? mil(b).replace('R$ ', '').replace(' mil', '') : mil(b).replace('R$ ', '')}</small>` : mil(a));
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
  const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mes3 = (iso) => MES3[Number(String(iso || '').slice(5, 7)) - 1] || '';
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const diaDeHoje = (iso) => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); return Number.isNaN(d.getTime()) ? '' : `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} ${MES3[d.getUTCMonth()]}`; };
  const extenso = (iso) => (ehDia(iso) ? `${Number(String(iso).slice(8, 10)) === 1 ? '1º' : Number(String(iso).slice(8, 10))} de ${mesDe(iso)}` : 'sem data');
  const curta = (iso) => (ehDia(iso) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : 'sem data');
  const maiuscula = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
  // Lançamento do extrato (ext:…) ou antigo do Finanças (fin:…): leitura aqui; confere-se no Extrato.
  const doFin = (id) => /^(fin|ext):/.test(String(id || ''));
  const NO_EXTRATO = '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="extrato">Conferir no Extrato</button>';
  const doExtrato = (d) => d?.fonte === 'Extrato do banco';
  const emAtraso = (x) => x.status === 'atrasado' || x.status === 'inadimplente';
  const SETA = { esq: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>', dir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' };
  const IC = {
    cadeado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    lupa: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
    filtro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  };
  const SELO = `<span class="d3-selo-donos">${IC.cadeado}só donos</span>`;
  // Padrão V2 (16/11/2026): o molde comum das telas de Finanças, de vybe-mundo-financeiro.js. Sem ele (testes que carregam
  // só este arquivo), as telas saem como antes.
  const molde = () => (typeof window !== 'undefined' ? window.VybeFinanceiro?.molde : null);
  // Rodapé "Sócios avisados" dos quadros D3 (Visão geral, Recebimentos e Inadimplência): as iniciais de quem avisou ou foi
  // avisado nos últimos 30 dias, pelo registro de avisos (vybe_financeiro_avisos, desde 14/11/2026). O aviso é só registro
  // interno e o sino do Vybe OS: nada sai por WhatsApp. Sem a tabela ainda, o vazio honesto.
  const iniciais = (nome) => String(nome || '?').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().slice(0, 2).toUpperCase();
  function sociosAvisados(av) {
    if (!av?.disponivel) return '<span class="d3f-socios"><span class="fv2-sub">Sócios avisados</span><span class="d3f-vazio">sem registro ainda</span></span>';
    const desde = new Date(Date.now() - 30 * 864e5).toISOString(), recentes = (av.lista || []).filter((a) => String(a.em || '') >= desde);
    const nomes = [...new Set(recentes.flatMap((a) => [a.quem_nome, ...(a.para || [])]).filter(Boolean))];
    return `<span class="d3f-socios"><span class="fv2-sub">Sócios avisados</span>${nomes.length ? nomes.map((n) => `<span class="d3f-av" title="${esc(n)}">${esc(iniciais(n))}</span>`).join('')
      : '<span class="d3f-vazio">nenhum aviso em 30 dias</span>'}</span>`;
  }
  // Os avisos de um cliente (do mais novo para o mais velho) e o botão "Avisar o sócio" / "Avisar de novo".
  const chaveAviso = (c) => (c.cliente_id != null && c.cliente_id !== '' ? 'id:' + c.cliente_id : 'nome:' + c.cliente_nome);
  const avisosDe = (av, c) => (av?.lista || []).filter((a) => (a.cliente_id ? 'id:' + a.cliente_id : 'nome:' + a.cliente_nome) === chaveAviso(c));
  const nAvisos = (av, c) => Number(av?.contagem_por_cliente?.[chaveAviso(c)]) || avisosDe(av, c).length;
  const botaoAvisar = (av, c) => (!av?.disponivel ? '' : `<button type="button" class="fv2-btn s v2-estado" data-fv="avisar" data-cliente-id="${esc(c.cliente_id ?? '')}" data-cliente-nome="${esc(c.cliente_nome)}" data-atraso="${Number(c.atraso_mais_antigo ?? c.atraso) || 0}">${nAvisos(av, c) ? 'Avisar de novo' : 'Avisar o sócio'}</button>`);
  const historicoAvisos = (av, c) => avisosDe(av, c).slice(0, 4).map((a) => `${esc(String(a.quem_nome || 'Um dono').split(' ')[0])} avisou ${a.para?.length ? esc(a.para.map((n) => String(n).split(' ')[0]).join(', ')) : 'os sócios'} em ${curta(String(a.em).slice(0, 10))} · régua de ${a.nivel} dias`);
  // Pílula: clara com a bolinha (n, b) ou cheia de cor só no que pede (r venceu, a ajuste, g pago/recebido).
  const pilula = (texto, tom = 'n') => `<span class="fv2-pill ${tom}">${esc(texto)}</span>`;
  // O cliente com a bolinha na cor da carteira dele.
  function carteiraDe(nome) {
    try { return typeof carteiraDoCliente === 'function' ? String(carteiraDoCliente(nome) || '') : ''; } catch { return ''; }
  }
  const cli = (nome) => `<span class="fv2-cli" data-carteira="${esc(carteiraDe(nome))}">${esc(nome)}</span>`;
  // O sócio do cliente pela carteira (VI, EW): é quem fala com ele.
  const SOCIO = { vinicius: ['VI', 'Vinícius'], ewerton: ['EW', 'Ewerton'] };
  const socio = (nome) => { const s = SOCIO[carteiraDe(nome)]; return s ? `<span class="d3f-av" title="${esc(s[1])}">${s[0]}</span>` : '<span class="d3f-av vazio" aria-hidden="true"></span>'; };
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
  function buscar(q, area = 'comercial') {
    const k = `${area}|${q}`, c = lidas.get(k);
    if (c && (c.promessa || Date.now() - c.em < 60000)) return c.promessa || Promise.resolve(c.dados);
    if (typeof fetch !== 'function') return Promise.resolve(null);
    const e = { em: Date.now(), dados: c?.dados || null, promessa: null };
    lidas.set(k, e);
    e.promessa = fetch(`/api/painel?area=${area}${q ? `&aba=${q}` : ''}`, { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => r.json().then((d) => (r.ok && d && d.ok !== false ? d : null))).catch(() => null)
      .then((d) => { e.dados = d || e.dados; e.em = Date.now(); e.promessa = null; return e.dados; });
    return e.promessa;
  }
  // Na pintura (que não espera): devolve o que já chegou e, quando chegar o resto, pede para pintar de novo.
  function jaLida(q, aoChegar) {
    const c = lidas.get(`comercial|${q}`);
    if (!c || (!c.promessa && Date.now() - c.em >= 60000)) buscar(q).then(() => aoChegar?.());
    return lidas.get(`comercial|${q}`)?.dados || null;
  }

  // ----- Peças -----
  function topo({ titulo, trilha = true, meio = '', acoes = '', extra = '' }) {
    return `<div class="fv2-topo"><div class="fv2-ola">${trilha ? `<p class="fv2-sub"><button type="button" class="fv2-link" data-fv="ir" data-valor="setor:financas">Finanças</button> › ${esc(titulo)}</p>` : ''}<div class="d3f-tit"><h1>${esc(titulo)}</h1>${SELO}${extra}</div></div>${meio}${acoes}</div>`;
  }
  // Com o extrato como fonte, lançar à mão é pelo Vorcaro (vira lançamento do extrato, sem saldo).
  const lancarMao = (nome, status = '') => `<button type="button" class="fv2-btn p" data-fv="ir" data-valor="vorcaro" data-mao="${status || 'pago'}">${IC.mais}${esc(nome)}</button>`;
  const novo = (vc, nome) => `<button type="button" class="fv2-btn p" data-vc="${vc}">${IC.mais}${esc(nome)}</button>`;
  const comoFunciona = '<button type="button" class="fv2-btn d3f-cinza" data-vc="ajuda">Como funciona</button>';
  function periodoHtml(per, hoje) {
    const anual = per.tipo === 'anual', mes = /^\d{4}-\d{2}$/.test(per.mes || '') ? per.mes : hoje.slice(0, 7), passo = anual ? 12 : 1, corte = anual ? 4 : 7;
    const antes = somaMes(mes, -passo), depois = somaMes(mes, passo), fim = depois.slice(0, corte) > hoje.slice(0, corte), nome = anual ? 'ano' : 'mês';
    return `<span class="fv2-seg" role="group" aria-label="Período">${[['mensal', 'Mensal'], ['anual', 'Anual']].map(([k, n]) => `<button type="button" data-vc-periodo="${k}" aria-pressed="${(per.tipo || 'mensal') === k}">${n}</button>`).join('')}</span>
      <span class="fv2-mes" role="group" aria-label="${anual ? 'Ano' : 'Mês'}"><button type="button" class="fv2-btn s fv2-seta" data-vc-mes-ir="${antes}" aria-label="${maiuscula(nome)} anterior">${SETA.esq}</button><b class="d3f-mes" aria-live="polite">${anual ? mes.slice(0, 4) : esc(nomeMes(mes))}</b><button type="button" class="fv2-btn s fv2-seta" data-vc-mes-ir="${depois}" aria-label="Próximo ${nome}"${fim ? ' disabled' : ''}>${SETA.dir}</button></span>`;
  }
  const rotuloFala = (per, hoje) => { const r = rotuloPeriodo(per, hoje); return per.tipo !== 'anual' && r.endsWith(' de ' + hoje.slice(0, 4)) ? r.slice(0, -8) : r; };
  const rotuloPeriodo = (per, hoje) => (per.tipo === 'anual' ? String(per.mes || hoje).slice(0, 4) : nomeMes(/^\d{4}-\d{2}$/.test(per.mes || '') ? per.mes : hoje.slice(0, 7)));
  // Bloco de ação (a única faixa laranja): quem fala, a frase curta e um botão.
  const acao = (quem, frase, botao = '', attrs = '') => globalThis.d3AcaoHtml({ frase: `<small class="d3f-quem">${esc(quem)}</small>${frase}`, agente: 'V', botao, attrs });
  // Número da Direção 3 com a linha de baixo: o que era legenda vira um dado curto.
  function num({ rotulo, valor, tom = '', serie = null, meta = null, barra = null, sub = '', attrs = '' }) {
    const h = globalThis.d3NumHtml({ rotulo, valor, tom, serie, meta, barra, attrs });
    return sub ? h.replace(/<\/(div|button)>$/, `<span class="d3f-sub">${sub}</span></$1>`) : h;
  }
  const nums = (lista) => `<div class="d3f-nums" style="--n:${lista.length}">${lista.map((k) => num(k)).join('')}</div>`;
  const variou = (v, contra) => (v == null || !Number.isFinite(Number(v)) ? '' : `${Number(v) > 0 ? 'subiu' : Number(v) < 0 ? 'caiu' : 'igual'} ${String(Math.abs(Number(v))).replace('.', ',')}% ${contra}`);
  function filtros({ tela, busca, chips, extras = [] }) {
    const u = ui[tela], id = 'fv2-busca-' + tela;
    const ficha = (acaoFv, [k, nome, n, tom = ''], on) => `<button type="button" class="fv2-chip" data-fv="${acaoFv}" data-tela="${tela}" data-valor="${k}" aria-pressed="${on}">${esc(nome)} <b${tom ? ` class="${tom}"` : ''}>${n0(n)}</b></button>`;
    return `<div class="fv2-filtros"><label class="fv2-sr" for="${id}">${esc(busca.rotulo)}</label><span class="d3f-busca">${IC.lupa}<input class="fv2-busca" id="${id}" type="search" data-vc-busca="${busca.chave}" placeholder="${esc(busca.dica)}" value="${esc(busca.valor || '')}"></span>
      <span class="fv2-fichas" role="group" aria-label="Filtrar a lista">${chips.map((c) => ficha('chip', c, !u.extra && u.chip === c[0])).join('')}</span>
      ${extras.length ? `<button type="button" class="fv2-chip d3f-filtros" data-fv="filtros" data-tela="${tela}" aria-expanded="${u.filtros}">${IC.filtro}Filtros</button>` : ''}</div>
      ${extras.length && u.filtros ? `<div class="fv2-filtros fv2-extras" role="group" aria-label="Mais filtros">${extras.map((c) => ficha('extra', c, u.extra === c[0])).join('')}</div>` : ''}`;
  }
  // Linha que abre no lugar: pílula, o texto (o botão que abre), uma coluna do meio, o valor e o que a linha pede.
  function linha({ tela, id, pill = '', texto, meio = '', valor = '', dir = '', detalhe = '' }) {
    const aberta = ui[tela].aberta === String(id);
    return `<div class="v2-abre fv2-linha" data-linha="${esc(id)}" aria-expanded="${aberta}"><div class="fv2-lin">${pill}<button type="button" class="fv2-txt" data-fv="linha" data-tela="${tela}" data-valor="${esc(id)}" aria-expanded="${aberta}">${texto}</button>${meio}${valor ? `<b class="fv2-valor">${valor}</b>` : ''}${dir ? `<span class="d3f-dir">${dir}</span>` : ''}</div>
      <div class="v2-mais"><div><div class="fv2-det">${detalhe}</div></div></div></div>`;
  }
  const hist = (frases) => frases.filter(Boolean).map((f) => `<p class="fv2-hist">${f}</p>`).join('');
  const umToque = (acaoFv, id, texto, extra = '') => `<button type="button" class="fv2-btn s v2-estado" data-fv="${acaoFv}" data-valor="${esc(id)}"${extra}>${texto}</button>`;
  const cartao = ({ titulo, sub = '', corpo, pe = '', cls = '', rotulo = '', cab = '' }) => `<section class="fv2-card${cls ? ' ' + cls : ''}"${rotulo ? ` data-fv-card="${rotulo}"` : ''}><div class="fv2-card-topo"><h2>${esc(titulo)}</h2>${sub ? `<span class="fv2-sub">${sub}</span>` : ''}</div>${cab}${corpo}${pe ? `<div class="fv2-pe">${pe}</div>` : ''}</section>`;
  const cabeca = (cols) => `<div class="d3f-cab" aria-hidden="true">${cols.map(([cls, t]) => `<span class="${cls}">${esc(t)}</span>`).join('')}</div>`;
  const vazioLinha = (frase, botoes = '') => `<div class="fv2-vz"><p>${frase}</p>${botoes}</div>`;
  const maisHtml = (resto, nome, acaoFv, tela, total = null) => (resto > 0 ? `<button type="button" class="d3f-mais" data-fv="${acaoFv}" data-tela="${tela}">+${n0(resto)}${nome ? ' ' + esc(nome) : ''}${total != null ? ` <span>· ${mil(total)}</span>` : ''}</button>` : '');
  // Gráfico em linha de duas partes: o realizado (cheio, com o ponto no fim) e a projeção (tracejada).
  function linhaDupla(real, proj, { largura = 400, altura = 140, rotulo = '' } = {}) {
    const todos = [...real, ...proj].map(Number).filter(Number.isFinite);
    if (todos.length < 2) return '';
    const alto = Math.max(...todos), baixo = Math.min(...todos), folga = (alto - baixo) * 0.25 || alto * 0.1 || 1, min = Math.max(0, baixo - folga), max = alto + folga * 0.2, faixa = max - min || 1, pad = 8, n = real.length + Math.max(0, proj.length - 1);
    const x = (i) => pad + (i * (largura - 2 * pad)) / Math.max(1, n - 1), y = (v) => altura - pad - ((v - min) * (altura - 2 * pad)) / faixa;
    const pts = real.map((v, i) => [x(i), y(v)]), pp = proj.map((v, i) => [x(real.length - 1 + i), y(v)]);
    let comp = 0; for (let i = 1; i < pts.length; i++) comp += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const fmt = (l) => l.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
    const fim = pts[pts.length - 1] || pp[0];
    return `<svg class="d3-graf d3f-graf" viewBox="0 0 ${largura} ${altura}" style="--d3-comp:${Math.ceil(comp) || 1}"${rotulo ? ` role="img" aria-label="${esc(rotulo)}"` : ' aria-hidden="true"'}><line class="d3f-base" x1="0" x2="${largura}" y1="${y(min).toFixed(1)}" y2="${y(min).toFixed(1)}"/>${pp.length > 1 ? `<polyline class="meta" points="${fmt(pp)}"/>` : ''}${pts.length > 1 ? `<polyline points="${fmt(pts)}"/>` : ''}<circle cx="${fim[0].toFixed(1)}" cy="${fim[1].toFixed(1)}" r="4.5"/></svg>`;
  }
  // Barra de grupo: nome, a barra, a fatia e o valor.
  const barraGrupo = (nome, fatia, valor, tom = '') => `<div class="d3f-gx${tom ? ' ' + tom : ''}"><span>${nome}</span><span class="d3-barra" style="--v:${fatia}%"><i></i></span><b>${fatia}%</b><span class="d3f-gx-v">${valor}</span></div>`;
  // O controle financeiro ainda não ligado: o motivo técnico fica a um clique, só para quem administra.
  function oQueFalta(ctx) {
    const d = estado('comercial', ctx.d?.periodo?.mes || hojeBahia().slice(0, 7))?.dados;
    if (!d || d.conectado || !ctx.admin) return { botao: '', nota: '' };
    return { botao: `<button type="button" class="fv2-btn s" data-vc="falta" aria-expanded="${Boolean(ctx.verFalta)}">Para quem administra: ver o que falta</button>`,
      nota: ctx.verFalta ? `<div class="fv2-nota" role="note"><p>${esc(d.motivo || 'O controle financeiro ainda não está disponível.')}${d.aviso ? ' · ' + esc(d.aviso) : ''}</p>${(d.passos || []).length ? `<ol>${d.passos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}</div>` : '' };
  }
  const fonte = (d) => (doExtrato(d) ? '<span class="fv2-pill b">Extrato</span>' : '');

  // ----- Faturas (Recebimentos e Inadimplência) -----
  const oQueE = (x) => (x.tipo === 'recorrente' ? `${x.ciclo && x.ciclo !== 'mensal' ? 'parcela ' + x.ciclo : 'mensalidade'} de ${mesDe(x.vencimento)}` : String(x.descricao || 'recebimento pontual'));
  const tipoFatura = (x) => (x.tipo === 'recorrente' ? (x.ciclo && x.ciclo !== 'mensal' ? maiuscula(x.ciclo) : 'Recorrente') : maiuscula(x.categoria || 'Pontual'));
  // Colunas "Contrato" e "Forma" do quadro D3-Recebimentos: o contrato é a categoria lançada (Redes, Tráfego) e, sem ela,
  // o tipo; a forma de pagamento só vem das faturas que a trazem (as do extrato ou lançadas à mão), senão o traço curto.
  const contratoFatura = (x) => String(x.categoria || '').trim() || tipoFatura(x);
  const FORMA_NOME = { pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão', transferencia: 'Transferência' };
  const formaFatura = (x) => { const f = String(x.forma_pagamento || x.forma || '').trim(); return FORMA_NOME[f] || f || '–'; };
  // A forma de pagamento se escolhe no detalhe (vybe_comercial_recebivel_forma; vale também para a fatura do extrato).
  const trocarForma = (x) => (x.cancelado ? '' : `<span class="fv2-seg d3f-formas" role="group" aria-label="Forma de pagamento">${Object.entries(FORMA_NOME).map(([k, n]) =>
    `<button type="button" data-fv="forma" data-id="${esc(x.id)}" data-valor="${x.forma === k ? '' : k}" aria-pressed="${x.forma === k}">${esc(n)}</button>`).join('')}</span>`);
  const quemFatura = (x, comMes = true) => (x.cliente_nome ? `${cli(x.cliente_nome)}${comMes ? ` · ${esc(x.tipo === 'recorrente' ? mesDe(x.vencimento) : x.descricao || 'pontual')}` : ''}` : `<b>${esc(x.descricao || 'Recebimento')}</b>`);
  function statusFatura(x, hoje) {
    if (x.cancelado) return pilula('Cancelada', 'n');
    if (x.status === 'recebido') return pilula(x.recebido_em ? 'Recebido · ' + curta(x.recebido_em) : 'Recebido', 'g');
    if (emAtraso(x)) return pilula('Atrasada · ' + curta(x.vencimento), 'r');
    if (x.status === 'parcial') return pilula('Parcial', 'a');
    return pilula('Vence ' + curta(x.vencimento), 'n');
  }
  // dentro = a fatura está na lista da janela (os formulários de editar e cancelar a encontram); comForm = há janela com formulário.
  function detalheFatura(x, { dentro = true, comForm = true } = {}) {
    const venceu = emAtraso(x) || x.status === 'recebido';
    const linhas = hist([
      x.tipo === 'recorrente' ? `Recorrente ${esc(x.ciclo || 'mensal')}${x.descricao ? ' · ' + esc(x.descricao) : ''}` : `Pontual${x.categoria ? ' · ' + esc(x.categoria) : ''}`,
      `${venceu ? 'Venceu' : 'Vence'} em ${extenso(x.vencimento)}${emAtraso(x) ? ', há ' + quantos(x.atraso, 'dia', 'dias') : ''}`,
      Number(x.valor_recebido) > 0 && x.status !== 'recebido' ? `Recebido até agora ${rs(x.valor_recebido)} de ${rs(x.valor)}` : '',
      x.recebido_em ? `Recebido em ${extenso(x.recebido_em)}` : '', x.cancelado ? 'Cancelada: fora dos totais' : '']);
    let acoes = '';
    if (x.cancelado) acoes = '';
    else if (doFin(x.id)) acoes = NO_EXTRATO;
    else if (!comForm) acoes = '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="recebimentos">Abrir em Recebimentos</button>';
    else acoes = `${x.status !== 'recebido' ? `<button type="button" class="fv2-btn s" data-vc="receber" data-id="${esc(x.id)}">Recebi uma parte</button>` : ''}
      ${dentro && x.tipo === 'recorrente' ? `<button type="button" class="fv2-btn s" data-vc="proximo" data-id="${esc(x.id)}">Próximo ciclo</button>` : ''}
      ${dentro ? `<button type="button" class="fv2-btn s" data-vc="recebivel" data-id="${esc(x.id)}">Editar</button><button type="button" class="fv2-btn s fv2-perigo" data-vc="cancelar-rec" data-id="${esc(x.id)}">Cancelar</button>`
        : `<button type="button" class="fv2-btn s" data-vc-mes-ir="${String(x.vencimento).slice(0, 7)}">Ver em ${esc(mesDe(x.vencimento))}</button>`}`;
    const forma = comForm && dentro ? trocarForma(x) : '';
    return `${linhas}${acoes || forma ? `<div class="fv2-det-acoes">${forma}${acoes}</div>` : ''}`;
  }
  const botaoRecebi = (x) => (doFin(x.id) ? '<small class="fv2-sub fv2-so-la">pelo extrato</small>' : umToque('receber', x.id, 'Recebi', ` data-total="${Number(x.valor) || 0}"`));
  const linhaAtrasada = (tela, x, opc) => linha({ tela, id: 'a' + x.id, pill: pilula(quantos(x.atraso, 'dia', 'dias'), 'r'),
    texto: quemFatura(x), valor: rs(x.aberto ?? x.valor), dir: botaoRecebi(x), detalhe: detalheFatura(x, opc) });

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
    const mesesFora = [...new Set(deFora.map((x) => String(x.vencimento).slice(0, 7)))], deQuando = mesesFora.length === 1 ? esc(mesDe(mesesFora[0] + '-01')) : 'meses anteriores';
    const frase = !vivas.length && !atrasadas.length ? `Nada lançado em ${esc(rotuloFala(per, hoje))}.`
      : atrasadas.length ? `${atrasadas.length === 1 ? '1 fatura em atraso' : n0(atrasadas.length) + ' faturas em atraso'}${deFora.length ? `, ${deFora.length === 1 ? 'uma' : n0(deFora.length)} ainda de ${deQuando}` : ''}.`
      : `Nada em atraso; ${pc(a.recebido, a.a_receber)}% já entrou.`;
    const numeros = nums([
      { rotulo: 'Recebido', valor: sobre(a.recebido, a.a_receber), barra: pc(a.recebido, a.a_receber), tom: Number(a.recebido) ? 'd3f-verde' : 'q d3f-verde',
        sub: Number(a.a_receber) ? `${quantos(grupo.recebidas.length, 'fatura', 'faturas')} · ${pc(a.recebido, a.a_receber)}%` : 'nada previsto', attrs: `data-fv="chip" data-tela="rec" data-valor="recebidas" title="${esc(variou(v.recebido, contra))}"` },
      { rotulo: 'A vencer', valor: mil(soma(grupo.vencer, 'aberto')), tom: grupo.vencer.length ? '' : 'q', attrs: `data-fv="chip" data-tela="rec" data-valor="vencer" title="${esc(variou(v.pendente, contra))}"`,
        sub: grupo.vencer.length ? `${quantos(grupo.vencer.length, 'fatura', 'faturas')}${proxima ? ` · ${proxima.cliente_nome ? cli(proxima.cliente_nome) : esc(proxima.descricao || '')} · ${curta(proxima.vencimento)}` : ''}` : 'nada a vencer' },
      { rotulo: 'Em atraso', valor: mil(totalAtraso), tom: totalAtraso ? 'r' : 'q', attrs: `data-fv="ir" data-valor="inadimplencia" title="${esc(variou(v.inadimplente, contra))}"`,
        sub: atrasadas.length ? `<span class="d3f-r">${quantos(atrasadas.length, 'fatura', 'faturas')}${deFora.length ? ` · ${mil(soma(deFora, 'aberto'))} de ${deQuando}` : ''}</span>` : 'ninguém em atraso' }]);
    const barra = filtros({ tela: 'rec', busca: { chave: 'rec', rotulo: 'Buscar fatura por cliente', dica: 'Buscar cliente ou fatura', valor: ctx.filtro?.rec },
      chips: [['todas', 'Todas', vivas.length], ['atraso', 'Em atraso', grupo.atraso.length, 'r'], ['vencer', 'A vencer', grupo.vencer.length], ['recebidas', 'Recebidas', grupo.recebidas.length, 'g'], ['recorrentes', 'Recorrentes', grupo.recorrentes.length], ['pontuais', 'Pontuais', grupo.pontuais.length]],
      extras: [['parciais', 'Parciais', grupo.parciais.length], ['canceladas', 'Canceladas', grupo.canceladas.length]] });
    // Pede ação: as faturas em atraso, da mais antiga à mais nova, com o Recebi na linha.
    const pedem = atrasadas.filter(bate), cabeA = u.acaoInteira || termo ? pedem : pedem.slice(0, 4);
    const acaoCard = cartao({ titulo: 'Pede ação', rotulo: 'acao', cls: 'd3f-pede', sub: atrasadas.length ? `${n0(atrasadas.length)} em atraso` : 'nada em atraso',
      corpo: cabeA.map((x) => linhaAtrasada('rec', x, { dentro: ids.has(String(x.id)) })).join('') || `<p class="fv2-nada">${termo && atrasadas.length ? 'Nenhuma em atraso com esse texto.' : 'Nenhuma fatura em atraso.'}</p>`,
      pe: maisHtml(pedem.length - cabeA.length, 'em atraso', 'mostrar-acao', 'rec', soma(pedem.slice(cabeA.length), 'aberto')) + (atrasadas.length ? sociosAvisados(d.avisos || jaLida('inadimplencia', () => anfitriao?.repintar?.())?.avisos) : '') });
    // A lista do período, uma linha por fatura. Em "Todas", as em atraso já estão no Pede ação.
    const ordem = (x) => (x.cancelado ? 4 : x.status === 'recebido' ? 3 : emAtraso(x) ? 2 : 1);
    const base = (u.extra ? grupo[u.extra] : u.chip === 'todas' ? vivas.filter((x) => !emAtraso(x)) : grupo[u.chip] || vivas).filter(bate)
      .sort((x, z) => ordem(x) - ordem(z) || (ordem(x) === 3 ? String(z.recebido_em || '').localeCompare(String(x.recebido_em || '')) : String(x.vencimento).localeCompare(String(z.vencimento))));
    const cabe = u.inteira || termo ? base : base.slice(0, 8), resto = base.slice(cabe.length), soRecebidas = resto.every((x) => x.status === 'recebido');
    const mesPer = per.tipo === 'anual' ? '' : (/^\d{4}-\d{2}$/.test(per.mes || '') ? per.mes : hoje.slice(0, 7));
    const lista = cartao({ titulo: 'Faturas', rotulo: 'lista', cls: 'd3f-tabela', sub: esc(rot),
      cab: cabe.length ? cabeca([['fv2-txt', 'Cliente'], ['d3f-meio', 'Contrato'], ['d3f-meio d3f-forma', 'Forma'], ['fv2-valor', 'Valor'], ['d3f-dir', 'Situação']]) : '',
      corpo: cabe.map((x) => linha({ tela: 'rec', id: x.id, texto: `${quemFatura(x, false)}${x.cliente_nome && mesPer && String(x.vencimento).slice(0, 7) !== mesPer ? ` <span class="d3f-mes">· ${esc(mes3(x.vencimento))}</span>` : ''}`,
        meio: `<span class="d3f-meio" title="${esc(tipoFatura(x))}">${esc(contratoFatura(x))}</span><span class="d3f-meio d3f-forma">${esc(formaFatura(x))}</span>`, valor: rs(x.valor), dir: statusFatura(x, hoje), detalhe: detalheFatura(x) })).join('')
        || `<p class="fv2-nada">${!vivas.length ? 'Nenhum recebimento neste período.' : termo ? 'Nenhuma fatura com esse texto neste filtro.' : 'Nenhuma fatura neste filtro.'}</p>`,
      pe: maisHtml(resto.length, soRecebidas ? (resto.length === 1 ? 'recebida' : 'recebidas') : '', 'mostrar', 'rec', soma(resto, 'valor')) });
    const semNada = !todas.length && !atrasadas.length;
    const M = molde();
    if (M) {
      // Padrão V2 (prancha V2-M-Financas-Recebimentos): um cartão com as faturas do período agrupadas (Agora: em atraso;
      // A vencer; Recebida), a linha que abre no lugar e o "De olho" no pé; o laranja só com fatura em atraso.
      const COLS = [[60, ''], [28, ''], [0, 'Cliente'], [84, 'Referência'], [104, 'Valor', 'r'], [230, 'Situação'], [70, '']];
      const ROT = [['Agora', 'r'], ['A vencer', ''], ['Recebida', 'g'], ['Cancelada', 'q']];
      const grupoX = (x) => (x.cancelado ? 3 : x.status === 'recebido' ? 2 : emAtraso(x) ? 0 : 1);
      const vis = (u.extra ? grupo[u.extra] : u.chip === 'todas' ? vivas : grupo[u.chip] || vivas).filter(bate)
        .sort((x, z) => grupoX(x) - grupoX(z) || (grupoX(x) === 2 ? String(z.recebido_em || '').localeCompare(String(x.recebido_em || '')) : String(x.vencimento).localeCompare(String(z.vencimento))));
      const situacao = (x) => (x.cancelado ? '<span class="q">cancelada, fora dos totais</span>' : x.status === 'recebido' ? `<span class="g">recebida${x.recebido_em ? ` em ${curta(x.recebido_em)}` : ''}${x.forma ? `, por ${esc(FORMA_NOME[x.forma] || x.forma)}` : ''}</span>`
        : emAtraso(x) ? `<span class="r">atrasada há ${quantos(x.atraso, 'dia', 'dias')}${Number(x.valor_recebido) > 0 ? `, recebido ${rs(x.valor_recebido)}` : ''}</span>`
          : x.status === 'parcial' ? `<span class="a">parcial, recebido ${rs(x.valor_recebido)} · vence ${curta(x.vencimento)}</span>` : `a receber · vence ${curta(x.vencimento)}`);
      const linhaR = (x, i) => {
        const aberta = u.aberta === String(x.id), g = grupoX(x), primeiro = !i || grupoX(vis[i - 1]) !== g;
        const nome = x.cliente_nome ? `<b>${esc(x.cliente_nome)}</b> <small>· ${esc(x.tipo === 'recorrente' ? 'recorrente' : x.descricao || 'pontual')}</small>` : `<b>${esc(x.descricao || 'Recebimento')}</b> <small>· ${esc(x.categoria || 'pontual')}</small>`;
        return `<div class="v2-abre d3m-d-fm-linha" data-linha="${esc(x.id)}" aria-expanded="${aberta}">${M.tr(COLS, [primeiro ? `<span class="${ROT[g][1]}">${ROT[g][0]}</span>` : '', M.av(x.cliente_nome || x.descricao || '?'),
          `<button type="button" class="d3m-d-fm-nome" data-fv="linha" data-tela="rec" data-valor="${esc(x.id)}" aria-expanded="${aberta}">${nome}</button>`, `${esc(mes3(x.vencimento))}/${esc(String(x.vencimento).slice(2, 4))}`, rs(x.valor), situacao(x),
          x.cancelado || x.status === 'recebido' ? '' : botaoRecebi(x)])}
          <div class="v2-mais"><div><div class="fv2-det d3m-d-fm-det">${detalheFatura(x)}</div></div></div></div>`;
      };
      const fichas = M.fichas([['todas', 'Todas', vivas.length], ['atraso', 'Em atraso', grupo.atraso.length, 'r'], ['vencer', 'A vencer', grupo.vencer.length], ['recebidas', 'Recebidas', grupo.recebidas.length], ['recorrentes', 'Recorrentes', grupo.recorrentes.length], ['pontuais', 'Pontuais', grupo.pontuais.length]]
        .map(([k, nome, n, tom]) => ({ nome, n, tom: n ? tom : '', on: !u.extra && u.chip === k, attrs: `data-fv="chip" data-tela="rec" data-valor="${k}"` }))
        .concat([['parciais', 'Parciais', grupo.parciais.length], ['canceladas', 'Canceladas', grupo.canceladas.length]].filter(([, , n]) => n).map(([k, nome, n]) => ({ nome, n, on: u.extra === k, attrs: `data-fv="extra" data-tela="rec" data-valor="${k}"` }))), 'Filtrar as faturas');
      const corpo = semNada ? `<div class="d3m-d-fm-vazio"><p>Nenhum recebimento em ${esc(rotuloFala(per, hoje))}.</p>${doExtrato(d) ? '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="extrato">Abrir o Extrato</button>' : '<button type="button" class="fv2-btn s" data-vc="recebivel">Lançar o primeiro</button>'}</div>`
        : vis.map(linhaR).join('') || `<p class="d3m-d-fm-vazio">${termo ? 'Nenhuma fatura com esse texto neste filtro.' : 'Nenhuma fatura neste filtro.'}</p>`;
      const olho = M.olho([[mil(a.recebido), 'recebido', Number(a.recebido) ? 'g' : ''], [mil(soma(grupo.vencer, 'aberto')), per.tipo === 'anual' ? 'a receber no ano' : 'a receber no mês'],
        totalAtraso ? [mil(totalAtraso), `em atraso${deFora.length ? `, ${mil(soma(deFora, 'aberto'))} de ${deQuando}` : ''}`, 'r'] : null]) ;
      const anual = per.tipo === 'anual', mesP = /^\d{4}-\d{2}$/.test(per.mes || '') ? per.mes : hoje.slice(0, 7), passo = anual ? 12 : 1, depois = somaMes(mesP, passo);
      const laranja = atrasadas.length ? M.laranja({ rot: 'em atraso', num: n0(atrasadas.length), frase: atrasadas.length === 1 ? 'fatura em atraso' : 'faturas em atraso',
        apoio: `${mil(totalAtraso)} no total${deFora.length ? `, ${deFora.length === 1 ? 'uma' : n0(deFora.length)} de ${deQuando}` : ''}.${atrasadas[0]?.cliente_nome ? ` A mais antiga é ${esc(atrasadas[0].cliente_nome)}, há ${quantos(atrasadas[0].atraso, 'dia', 'dias')}.` : ''}`,
        bts: [[`Ver ${atrasadas.length === 1 ? 'a fatura' : 'as ' + n0(atrasadas.length)}`, 'data-fv="chip" data-tela="rec" data-valor="atraso"'], ['Inadimplência', 'data-fv="ir" data-valor="inadimplencia"']] }) : '';
      return M.molde({ tela: 'rec', aba: 'recebimentos', titulo: 'Recebimentos', repintar: ctx.repintar,
        sub: `${esc(rot)}${vivas.length ? ` · ${n0(grupo.recebidas.length)} de ${quantos(vivas.length, 'fatura recebida', 'faturas recebidas')}` : ''}${doExtrato(d) ? ' · pelo extrato' : ''}`,
        ferr: M.setas(`data-vc-mes-ir="${somaMes(mesP, -passo)}"`, depois.slice(0, anual ? 4 : 7) > hoje.slice(0, anual ? 4 : 7) ? '' : `data-vc-mes-ir="${depois}"`, anual ? 'ano' : 'mês')
          + M.seg([['Mensal', 'data-vc-periodo="mensal"', !anual], ['Anual', 'data-vc-periodo="anual"', anual]], 'Período'),
        acao: doExtrato(d) ? M.acao('Lançar à mão', 'data-fv="ir" data-valor="vorcaro" data-mao="pago"') : M.acao('Novo recebimento', 'data-vc="recebivel"'), laranja,
        corpo: M.folha({ titulo: `Faturas de ${anual ? mesP.slice(0, 4) : mesDe(mesP + '-01')}`, sub: quantos(grupo.recorrentes.length, 'recorrente', 'recorrentes') + (grupo.pontuais.length ? ` e ${quantos(grupo.pontuais.length, 'pontual', 'pontuais')}` : ''),
          dir: fichas, cab: semNada ? '' : M.cab(COLS), corpo, olho, rotulo: 'lista' }) });
    }
    return `<div class="fv2 d3f" data-tela="rec"><div class="fv2-in">
      ${topo({ titulo: 'Recebimentos', meio: periodoHtml(per, hoje), acoes: comoFunciona + (doExtrato(d) ? lancarMao('Lançar à mão') : novo('recebivel', 'Novo recebimento')), extra: fonte(d) })}
      ${acao('Vorcaro · Financeiro', frase, atrasadas.length ? `Ver ${atrasadas.length === 1 ? 'a fatura' : 'as ' + n0(atrasadas.length)}` : '', 'data-fv="foco" data-valor="acao"')}
      ${numeros}${barra}
      ${semNada ? vazioLinha('Nenhum recebimento neste período.', doExtrato(d) ? '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="extrato">Abrir o Extrato</button>' : '<button type="button" class="fv2-btn s" data-vc="recebivel">Lançar o primeiro</button>')
        : `<div class="fv2-grade a">${acaoCard}${lista}</div>`}</div></div>`;
  }

  // ----- Contas a pagar -----
  function quandoConta(c, hoje) {
    const v = String(c.vencimento).slice(0, 10);
    if (c.cancelada) return pilula('Cancelada', 'n');
    if (c.pago_em) return pilula('Paga · ' + curta(c.pago_em), 'g');
    if (v < hoje) return pilula(quantos(diasEntre(v, hoje), 'dia', 'dias'), 'r');
    if (v === hoje) return pilula('Hoje', 'a');
    if (v === somaDia(hoje, 1)) return pilula('Amanhã', 'a');
    return pilula(v.slice(0, 7) === hoje.slice(0, 7) ? 'Dia ' + Number(v.slice(8, 10)) : curta(v), 'n');
  }
  function detalheConta(c, nomeGrupo, hoje, { dentro = true, comForm = true } = {}) {
    const v = String(c.vencimento).slice(0, 10), aberta = !c.pago_em && !c.cancelada;
    const linhas = hist([`${esc(nomeGrupo)}${c.fornecedor_nome ? ' · ' + esc(c.fornecedor_nome) : ''}`, `${v < hoje || c.pago_em ? 'Venceu' : 'Vence'} em ${extenso(v)}`, c.pago_em ? `Paga em ${extenso(c.pago_em)}` : '', c.cancelada ? 'Cancelada: fora dos totais' : '']);
    const acoes = !aberta ? '' : doFin(c.id) ? NO_EXTRATO
      : !comForm ? '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="contas">Abrir em Contas a pagar</button>'
      : dentro ? `<button type="button" class="fv2-btn s" data-vc="conta" data-id="${esc(c.id)}">Editar</button><button type="button" class="fv2-btn s fv2-perigo" data-vc="cancelar-conta" data-id="${esc(c.id)}">Cancelar</button>`
      : `<button type="button" class="fv2-btn s" data-vc-mes-ir="${v.slice(0, 7)}">Ver em ${esc(mesDe(v))}</button>`;
    return `${linhas}${acoes ? `<div class="fv2-det-acoes">${acoes}</div>` : ''}`;
  }
  const botaoPaguei = (c) => (c.pago_em || c.cancelada ? '' : doFin(c.id) ? '<small class="fv2-sub fv2-so-la">pelo extrato</small>' : umToque('pagar', c.id, 'Paguei'));
  const SINGULAR = { fixa: 'fixa', variavel: 'variável', folha: 'folha', imposto: 'imposto', investimento: 'investimento' };
  const linhaConta = (tela, c, nomeGrupo, hoje, opc) => linha({ tela, id: 'c' + c.id, pill: quandoConta(c, hoje),
    texto: `<b>${esc(c.descricao || 'Conta')}</b> · ${esc(SINGULAR[c.grupo] || nomeGrupo.toLowerCase())}`, valor: rs(c.valor), dir: botaoPaguei(c), detalhe: detalheConta(c, nomeGrupo, hoje, opc) });
  // O que pede ação nas contas: as vencidas sem pagar e as que vencem em 7 dias, na ordem do vencimento.
  function contasQuePedem(d, hoje) {
    const r = d.resumo || {}, doPeriodo = (d.contas || []).filter((c) => !c.pago_em && !c.cancelada && String(c.vencimento).slice(0, 10) < hoje);
    const sete = r.sete_dias?.contas || (d.contas || []).filter((c) => !c.pago_em && !c.cancelada && String(c.vencimento).slice(0, 10) >= hoje && String(c.vencimento).slice(0, 10) <= somaDia(hoje, 7));
    const vistos = new Set(), unica = (c) => !vistos.has(String(c.id)) && vistos.add(String(c.id));
    return { vencidas: doPeriodo.filter(unica).sort((x, z) => String(x.vencimento).localeCompare(String(z.vencimento))), sete: sete.filter(unica).sort((x, z) => String(x.vencimento).localeCompare(String(z.vencimento))) };
  }

  function contas(ctx) {
    anfitriao = ctx;
    const u = ui.con, d = ctx.d || {}, hoje = d.hoje || hojeBahia(), per = d.periodo || {}, r = d.resumo || {}, f = estado('comercial', per.mes || hoje.slice(0, 7))?.dados;
    const todas = d.contas || [], vivas = todas.filter((c) => !c.cancelada), ids = new Set(todas.map((c) => String(c.id))), contra = per.tipo === 'anual' ? 'contra o ano anterior' : 'contra o mês anterior';
    const grupos = (r.grupos || []).length ? r.grupos : (d.grupos || []).map((g) => ({ ...g, total: 0 })), nomeGrupo = (id) => grupos.find((g) => g.id === id)?.nome || id;
    const { vencidas, sete } = contasQuePedem(d, hoje), nVenc = Number(r.vencidas?.quantidade) || vencidas.length, nSete = sete.length;
    const termo = semAcento(ctx.filtro?.conta), bate = (c) => !termo || semAcento(`${c.descricao || ''} ${c.fornecedor_nome || ''} ${nomeGrupo(c.grupo)}`).includes(termo);
    const extra = { pagas: (c) => Boolean(c.pago_em), abertas: (c) => !c.pago_em, vencidas: (c) => !c.pago_em && String(c.vencimento).slice(0, 10) < hoje };
    const logo = sete[0] && [hoje, somaDia(hoje, 1)].includes(String(sete[0].vencimento).slice(0, 10)) ? ` ${esc(sete[0].descricao || 'Uma conta')} vence ${String(sete[0].vencimento).slice(0, 10) === hoje ? 'hoje' : 'amanhã'}.` : '';
    const frase = !vivas.length ? `Nenhuma conta em ${esc(rotuloFala(per, hoje))}.`
      : nVenc ? `${quantos(nVenc, 'conta venceu', 'contas venceram')} sem pagar.${nSete ? ` ${quantos(nSete, 'vence', 'vencem')} em 7 dias.` : ''}`
      : nSete ? `${quantos(nSete, 'conta vence', 'contas vencem')} em 7 dias.${logo}` : 'Nada vence nos próximos 7 dias.';
    // O faturamento do período é o "a receber"; se não vier como número, sai da conta do próprio resultado.
    const fat = typeof d.faturamento === 'number' ? d.faturamento : (Number(r.resultado) || 0) + (Number(r.total) || 0), temNumero = Number(r.total) || fat;
    const numeros = nums([
      { rotulo: 'Pago', valor: sobre(r.pago, r.total), barra: pc(r.pago, r.total), tom: Number(r.pago) ? '' : 'q', attrs: `data-fv="extra" data-tela="con" data-valor="pagas" title="${esc(variou(r.variacao_total, contra))}"`,
        sub: Number(r.total) ? `${pc(r.pago, r.total)}%${variou(r.variacao_total, contra) ? ' · ' + variou(r.variacao_total, '').trim() : ''}` : 'nada lançado' },
      { rotulo: 'A pagar', valor: mil(r.a_pagar), tom: nVenc ? 'r' : Number(r.a_pagar) ? '' : 'q', attrs: 'data-fv="extra" data-tela="con" data-valor="abertas"',
        sub: `${nVenc ? `<span class="d3f-r">${quantos(nVenc, 'vencida', 'vencidas')}</span>` : '0 vencidas'} · ${nSete ? `<b class="d3f-a">${n0(nSete)} em 7 dias</b>` : 'nada em 7 dias'}` },
      { rotulo: per.tipo === 'anual' ? 'Resultado do ano' : 'Resultado do mês', valor: temNumero ? mil(r.resultado) : 'R$ 0', tom: !temNumero ? 'q' : Number(r.resultado) < 0 ? 'r' : 'g',
        sub: temNumero ? `${mil(fat)} − contas` : 'sem faturamento' }]);
    const barra = filtros({ tela: 'con', busca: { chave: 'conta', rotulo: 'Buscar conta', dica: 'Buscar conta', valor: ctx.filtro?.conta },
      chips: [['todas', 'Todas', vivas.length], ...grupos.map((g) => [g.id, g.nome, vivas.filter((c) => c.grupo === g.id).length])],
      extras: [['pagas', 'Pagas', vivas.filter(extra.pagas).length, 'g'], ['abertas', 'A pagar', vivas.filter(extra.abertas).length], ['vencidas', 'Vencidas', vivas.filter(extra.vencidas).length, 'r'], ['canceladas', 'Canceladas', todas.length - vivas.length]] });
    const pedem = [...vencidas, ...sete].filter(bate), cabeA = u.acaoInteira || termo ? pedem : pedem.slice(0, 5);
    // As já pagas do período, em fichas verdes: a última primeiro.
    const pagas = vivas.filter((c) => c.pago_em).sort((x, z) => String(z.pago_em).localeCompare(String(x.pago_em)));
    const jaPagas = pagas.length ? `<div class="d3f-pagas"><span class="fv2-sub">Já pagas</span>${pagas.slice(0, 3).map((c) => pilula(`${c.descricao || 'Conta'} · ${curta(c.pago_em)}`, 'g')).join('')}${pagas.length > 3 ? `<button type="button" class="fv2-chip" data-fv="extra" data-tela="con" data-valor="pagas">+${n0(pagas.length - 3)}</button>` : ''}</div>` : '';
    const acaoCard = cartao({ titulo: 'Pede ação', rotulo: 'acao', cls: 'd3f-pede', sub: pedem.length ? `${mil(soma(pedem, 'valor'))}${nVenc ? ` · ${quantos(nVenc, 'vencida', 'vencidas')}` : ' em 7 dias'}` : 'nada vence em 7 dias',
      corpo: cabeA.map((c) => linhaConta('con', c, nomeGrupo(c.grupo), hoje, { dentro: ids.has(String(c.id)) })).join('') || `<p class="fv2-nada">${termo && vencidas.length + sete.length ? 'Nenhuma conta com esse texto vencendo.' : 'Nenhuma conta vencida nem vencendo em 7 dias.'}</p>`,
      pe: maisHtml(pedem.length - cabeA.length, '', 'mostrar-acao', 'con') + jaPagas });
    // Para onde vai o dinheiro: um grupo por linha; a barra é a fatia do que já saiu; o grupo abre com as contas dele.
    const pagoTotal = Number(r.pago) || 0, somaGrupo = (g, so) => soma(vivas.filter((c) => c.grupo === g.id && (!so || c.pago_em)), 'valor');
    const filtradas = (g) => (u.extra === 'canceladas' ? todas.filter((c) => c.cancelada) : vivas.filter(u.extra ? extra[u.extra] : () => true)).filter((c) => c.grupo === g.id).filter(bate)
      .sort((x, z) => String(x.vencimento).localeCompare(String(z.vencimento)));
    const comConta = (g) => (termo || u.extra ? filtradas(g).length : somaGrupo(g) > 0 || g.id === u.chip);
    const doFiltro = grupos.filter((g) => (u.chip === 'todas' || u.extra ? true : g.id === u.chip));
    const linhaGrupo = (g) => {
      const total = somaGrupo(g), pago = somaGrupo(g, true), n = vivas.filter((c) => c.grupo === g.id).length, falta = Math.max(0, total - pago), fatia = pc(pago, pagoTotal);
      const aberto = u.aberta === 'g' + g.id || (u.chip === g.id && !u.extra) || Boolean(termo) || Boolean(u.extra), dentro = filtradas(g);
      return `<div class="v2-abre fv2-linha" data-linha="g${esc(g.id)}" aria-expanded="${aberto}"><div class="fv2-lin fv2-gr">
          <button type="button" class="fv2-txt" data-fv="linha" data-tela="con" data-valor="g${esc(g.id)}" aria-expanded="${aberto}"><b>${esc(g.nome)}</b> <span class="d3f-mes">· ${quantos(n, 'conta', 'contas')}</span></button>
          <span class="d3-barra" style="--v:${fatia}%"><i></i></span><b class="fv2-valor">${fatia}%</b>
          <span class="fv2-sub">${falta ? parteDe(pago, total) : mil(pago)}</span>${falta ? pilula(mil(falta), 'a') : total ? pilula('Tudo pago', 'g') : pilula('Nada lançado', 'n')}</div>
        <div class="v2-mais"><div><div class="fv2-det fv2-det-contas">${hist([g.percentual_faturamento != null && fat ? `${String(g.percentual_faturamento).replace('.', ',')}% do faturamento${variou(g.variacao, contra) ? ' · ' + variou(g.variacao, contra) : ''}` : variou(g.variacao, contra)])}
          ${dentro.map((c) => `<div class="fv2-mini">${quandoConta(c, hoje)}<p><b>${esc(c.descricao || 'Conta')}</b>${c.fornecedor_nome ? ' · ' + esc(c.fornecedor_nome) : ''} · ${rs(c.valor)}${c.pago_em || c.cancelada ? '' : ' · vence ' + curta(c.vencimento)}</p>
            ${c.cancelada || c.pago_em ? '' : doFin(c.id) ? NO_EXTRATO : `${umToque('pagar', c.id, 'Paguei')}<button type="button" class="fv2-btn s" data-vc="conta" data-id="${esc(c.id)}">Editar</button><button type="button" class="fv2-btn s fv2-perigo" data-vc="cancelar-conta" data-id="${esc(c.id)}">Cancelar</button>`}</div>`).join('') || '<p class="fv2-hist">Nenhuma conta deste grupo neste filtro.</p>'}</div></div></div></div>`;
    };
    // Grupo sem nada lançado fica na tabela, apagado e sem abrir (a divisão inteira à vista).
    const linhaZerada = (g) => `<div class="fv2-lin fv2-gr d3f-zero" data-grupo="${esc(g.id)}"><span class="fv2-txt"><b>${esc(g.nome)}</b> <span class="d3f-mes">· 0</span></span><span class="d3-barra" style="--v:0%"><i></i></span><b class="fv2-valor">0%</b><span class="fv2-sub">nada lançado</span><span aria-hidden="true"></span></div>`;
    const visiveis = doFiltro.filter(comConta), zerados = termo || u.extra || !vivas.length ? [] : doFiltro.filter((g) => !comConta(g));
    const doFinancas = f?.conectado ? `<div class="fv2-lin fv2-fin"><span class="fv2-pill b">Extrato</span><p>${mil(f.resumo?.despesas_sem_folha ?? f.despesas?.total)} em despesas de ${esc(nomeMes(f.mes))}${f.folha?.total ? ` · folha ${mil(f.folha.total)}` : ''}</p>
        <span class="fv2-btn s espiavel" data-espiar="financas:comercial:despesas" role="button" tabindex="0">Por categoria</span><span class="fv2-btn s espiavel" data-espiar="financas:comercial:fixos" role="button" tabindex="0">Custos fixos</span></div>` : '';
    const paraOnde = cartao({ titulo: 'Para onde vai', rotulo: 'grupos', cls: 'd3f-tabela', sub: Number(r.total) ? `${parteDe(r.pago, r.total)} pagos` : '',
      cab: visiveis.length ? cabeca([['fv2-txt', 'Grupo'], ['d3f-cab-barra', 'Já saiu'], ['fv2-valor', '%'], ['fv2-sub', 'Pago'], ['d3f-cab-falta', 'Falta']]) : '',
      corpo: (visiveis.map(linhaGrupo).join('') + zerados.map(linhaZerada).join('') || `<p class="fv2-nada">${termo || u.extra ? 'Nenhuma conta neste filtro.' : 'A divisão aparece com a primeira conta lançada.'}</p>`) + doFinancas });
    const falta = oQueFalta(ctx), semNada = !todas.length && !pedem.length;
    const M = molde();
    if (M) {
      // Padrão V2 (prancha V2-M-Financas-Contas): um cartão com as contas do período agrupadas (Agora: vencidas sem pagar;
      // A pagar; Pagas), o "Paguei" na linha e o "De olho" no pé; o laranja só com conta vencida ou vencendo em 7 dias.
      const COLS = [[60, ''], [48, 'Dia'], [0, 'Conta'], [104, 'Valor', 'r'], [190, 'Situação'], [76, '']];
      const ROT = [['Agora', 'r'], ['A pagar', 'a'], ['Pagas', 'g'], ['Canceladas', 'q']];
      const venceu = (c) => !c.pago_em && !c.cancelada && String(c.vencimento).slice(0, 10) < hoje;
      const grupoC = (c) => (c.cancelada ? 3 : c.pago_em ? 2 : venceu(c) ? 0 : 1);
      const base = u.extra === 'canceladas' ? todas.filter((c) => c.cancelada) : vivas.filter(u.extra ? extra[u.extra] : u.chip === 'todas' ? () => true : (c) => c.grupo === u.chip);
      const vis = base.filter(bate).sort((x, z) => grupoC(x) - grupoC(z) || (grupoC(x) === 2 ? String(z.pago_em).localeCompare(String(x.pago_em)) : String(x.vencimento).localeCompare(String(z.vencimento))));
      const situacao = (c) => { const v = String(c.vencimento).slice(0, 10), dias = diasEntre(hoje, v);
        return c.cancelada ? '<span class="q">cancelada</span>' : c.pago_em ? `<span class="g">paga em ${curta(c.pago_em)}</span>` : dias < 0 ? `<span class="r">venceu há ${quantos(-dias, 'dia', 'dias')}</span>` : dias === 0 ? '<span class="a">vence hoje</span>' : dias === 1 ? 'vence amanhã' : `vence em ${quantos(dias, 'dia', 'dias')}`; };
      const linhaC = (c, i) => {
        const id = 'c' + c.id, aberta = u.aberta === id, g = grupoC(c), primeiro = !i || grupoC(vis[i - 1]) !== g;
        return `<div class="v2-abre d3m-d-fm-linha" data-linha="${esc(id)}" aria-expanded="${aberta}">${M.tr(COLS, [primeiro ? `<span class="${ROT[g][1]}">${ROT[g][0]}</span>` : '', curta(c.pago_em || c.vencimento),
          `<button type="button" class="d3m-d-fm-nome" data-fv="linha" data-tela="con" data-valor="${esc(id)}" aria-expanded="${aberta}"><b>${esc(c.descricao || 'Conta')}</b> <small>· ${esc(SINGULAR[c.grupo] || nomeGrupo(c.grupo).toLowerCase())}${c.fornecedor_nome ? ' · ' + esc(c.fornecedor_nome) : ''}</small></button>`,
          rs(c.valor), situacao(c), botaoPaguei(c)])}
          <div class="v2-mais"><div><div class="fv2-det d3m-d-fm-det">${detalheConta(c, nomeGrupo(c.grupo), hoje, { dentro: ids.has(String(c.id)) })}</div></div></div></div>`;
      };
      const nAbertas = vivas.filter(extra.abertas).length, nPagas = vivas.filter(extra.pagas).length;
      const fichas = M.fichas([{ nome: 'Todas', n: vivas.length, on: !u.extra && u.chip === 'todas', attrs: 'data-fv="chip" data-tela="con" data-valor="todas"' },
        { nome: 'A pagar', n: nAbertas, tom: nVenc ? 'r' : nAbertas ? 'a' : '', on: u.extra === 'abertas', attrs: 'data-fv="extra" data-tela="con" data-valor="abertas"' },
        { nome: 'Pagas', n: nPagas, on: u.extra === 'pagas', attrs: 'data-fv="extra" data-tela="con" data-valor="pagas"' },
        ...grupos.filter((g) => vivas.some((c) => c.grupo === g.id)).map((g) => ({ nome: g.nome, n: vivas.filter((c) => c.grupo === g.id).length, on: !u.extra && u.chip === g.id, attrs: `data-fv="chip" data-tela="con" data-valor="${esc(g.id)}"` })),
        todas.length > vivas.length ? { nome: 'Canceladas', n: todas.length - vivas.length, on: u.extra === 'canceladas', attrs: 'data-fv="extra" data-tela="con" data-valor="canceladas"' } : null], 'Filtrar as contas');
      const corpo = (semNada ? `<div class="d3m-d-fm-vazio"><p>Nenhuma conta em ${esc(rotuloFala(per, hoje))}.</p>${doExtrato(d) ? '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="extrato">Abrir o Extrato</button>' : '<button type="button" class="fv2-btn s" data-vc="conta">Lançar a primeira</button>'}</div>`
        : vis.map(linhaC).join('') || `<p class="d3m-d-fm-vazio">${termo ? 'Nenhuma conta com esse texto neste filtro.' : 'Nenhuma conta neste filtro.'}</p>`) + (doFinancas ? `<div class="d3m-d-fm-resto">${doFinancas}</div>` : '') + falta.nota;
      const fixa = grupos.find((g) => g.id === 'fixa'), pctFixa = fixa && fat && fixa.percentual_faturamento != null ? String(fixa.percentual_faturamento).replace('.', ',') : null;
      const olho = M.olho([[mil(r.pago), 'pago'], [mil(r.a_pagar), 'a pagar', nVenc ? 'r' : Number(r.a_pagar) ? 'a' : ''], pctFixa != null ? [`${pctFixa}%`, 'do que entra vai nas fixas'] : null,
        temNumero ? [mil(r.resultado), per.tipo === 'anual' ? 'resultado do ano' : 'resultado do mês', Number(r.resultado) < 0 ? 'r' : 'g'] : null, falta.botao ? [falta.botao, ''] : null]);
      const v0 = vencidas[0], dias0 = v0 ? diasEntre(String(v0.vencimento).slice(0, 10), hoje) : 0;
      const laranja = v0 ? M.laranja({ rot: 'venceu e não saiu', num: quantos(dias0, 'dia', 'dias'), frase: `${esc(v0.descricao || 'Uma conta')} vencida`,
        apoio: `${rs(v0.valor)}, venceu em ${curta(v0.vencimento)}.${nVenc > 1 ? ` E mais ${quantos(nVenc - 1, 'conta vencida', 'contas vencidas')}.` : ''}`,
        bts: [doFin(v0.id) ? ['Ver no extrato', 'data-fv="ir" data-valor="extrato"'] : ['Paguei', `data-fv="pagar" data-valor="${esc(v0.id)}"`], nVenc > 1 ? [`Ver as ${n0(nVenc)}`, 'data-fv="extra" data-tela="con" data-valor="vencidas"'] : ['Contas a pagar', 'data-fv="extra" data-tela="con" data-valor="abertas"']] })
        : nSete ? M.laranja({ rot: 'vence em 7 dias', num: n0(nSete), frase: nSete === 1 ? 'conta vence em 7 dias' : 'contas vencem em 7 dias', apoio: `${mil(soma(sete, 'valor'))} no total.${logo}`, bts: [[nSete === 1 ? 'Ver a conta' : `Ver as ${n0(nSete)}`, 'data-fv="extra" data-tela="con" data-valor="abertas"']] }) : '';
      const anual = per.tipo === 'anual', mesP = /^\d{4}-\d{2}$/.test(per.mes || '') ? per.mes : hoje.slice(0, 7), passo = anual ? 12 : 1, depois = somaMes(mesP, passo);
      return M.molde({ tela: 'con', aba: 'contas', titulo: 'Contas a pagar', repintar: ctx.repintar,
        sub: `${esc(rotuloPeriodo(per, hoje))}${vivas.length ? ` · ${quantos(nPagas, 'paga', 'pagas')}, ${n0(nAbertas)} a pagar` : ''}${doExtrato(d) ? ' · pelo extrato' : ''}`,
        ferr: M.setas(`data-vc-mes-ir="${somaMes(mesP, -passo)}"`, depois.slice(0, anual ? 4 : 7) > hoje.slice(0, anual ? 4 : 7) ? '' : `data-vc-mes-ir="${depois}"`, anual ? 'ano' : 'mês')
          + M.seg([['Mensal', 'data-vc-periodo="mensal"', !anual], ['Anual', 'data-vc-periodo="anual"', anual]], 'Período'),
        acao: doExtrato(d) ? M.acao('Nova conta', 'data-fv="ir" data-valor="vorcaro" data-mao="nao_pago"') : M.acao('Nova conta', 'data-vc="conta"'), laranja,
        corpo: M.folha({ titulo: `Contas de ${anual ? mesP.slice(0, 4) : mesDe(mesP + '-01')}`, sub: quantos(vivas.length, 'lançada', 'lançadas'), dir: fichas, cab: semNada ? '' : M.cab(COLS), corpo, olho, rotulo: 'lista' }) });
    }
    return `<div class="fv2 d3f" data-tela="con"><div class="fv2-in">
      ${topo({ titulo: 'Contas a pagar', meio: periodoHtml(per, hoje), acoes: comoFunciona + (doExtrato(d) ? lancarMao('Nova conta', 'nao_pago') : novo('conta', 'Nova conta')), extra: fonte(d) })}
      ${acao('Vorcaro · Financeiro', frase, nVenc + nSete ? `Ver ${nVenc + nSete === 1 ? 'a conta' : 'as ' + n0(nVenc + nSete)}` : '', 'data-fv="foco" data-valor="acao"')}
      ${numeros}${barra}
      ${semNada ? vazioLinha('Nenhuma conta neste período.', `${doExtrato(d) ? '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="extrato">Abrir o Extrato</button>' : '<button type="button" class="fv2-btn s" data-vc="conta">Lançar a primeira</button>'}${falta.botao}`)
        : `<div class="fv2-grade b">${acaoCard}${paraOnde}</div>${falta.botao ? `<div class="fv2-rodape">${falta.botao}</div>` : ''}`}
      ${falta.nota}</div></div>`;
  }

  // ----- Inadimplência -----
  function inadimplencia(ctx) {
    anfitriao = ctx;
    const u = ui.ina, d = ctx.d || {}, hoje = d.hoje || hojeBahia(), f = estado('comercial', hoje.slice(0, 7))?.dados, real = f?.conectado ? f.inadimplencia : null;
    // Os números e os clientes vêm do extrato (mensalidade do contrato × o que entrou, por competência).
    const clientes = [...((real ? real.clientes : d.clientes) || [])].sort((x, z) => z.atraso_mais_antigo - x.atraso_mais_antigo), faturas = d.faturas || [];
    const total = Number(real ? real.total : d.total) || 0, nFat = Number(real ? real.faturas : faturas.length) || soma(clientes, 'faturas'), criticos = clientes.filter((c) => c.atraso_mais_antigo > 30);
    const antigo = clientes[0], termo = semAcento(ctx.filtro?.inad), bate = (c) => !termo || semAcento(c.cliente_nome).includes(termo);
    const faixa = { todos: () => true, ate7: (c) => c.atraso_mais_antigo <= 7, de8a30: (c) => c.atraso_mais_antigo > 7 && c.atraso_mais_antigo <= 30, criticos: (c) => c.atraso_mais_antigo > 30,
      semaviso: (c) => Boolean(d.avisos?.disponivel) && !nAvisos(d.avisos, c) };
    const marcados = d.marcados_a_mao || [], semPar = real ? clientes.filter((c) => c.no_vybe === false && (c.cliente_id || c.cliente_nome !== 'Sem cliente')) : [];
    const av = d.avisos, semAviso = av?.disponivel ? clientes.filter((c) => !nAvisos(av, c)) : [];
    const semAvisoJa = av?.disponivel ? clientes.filter((c) => c.atraso_mais_antigo >= 3 && !nAvisos(av, c)).sort((x, z) => x.atraso_mais_antigo - z.atraso_mais_antigo)[0] : null;
    const frase = !clientes.length ? 'Ninguém em atraso.'
      : semAvisoJa ? `${esc(semAvisoJa.cliente_nome)} atrasou ${quantos(semAvisoJa.atraso_mais_antigo, 'dia', 'dias')} e ninguém avisou o sócio.`
      : `${quantos(clientes.length, 'cliente', 'clientes')} em atraso; ${esc(antigo.cliente_nome)} há ${quantos(antigo.atraso_mais_antigo, 'dia', 'dias')}.${criticos.length ? ` ${quantos(criticos.length, 'passou', 'passaram')} de 30.` : ''}`;
    const numeros = nums([
      { rotulo: 'Em atraso', valor: mil(total), tom: total ? 'r' : 'q', sub: clientes.length ? `${quantos(nFat, 'fatura', 'faturas')} · ${quantos(clientes.length, 'cliente', 'clientes')}` : 'nada em atraso', attrs: real ? 'data-espiar="financas:comercial:inad"' : '' },
      { rotulo: 'O mais antigo', valor: antigo ? `${n0(antigo.atraso_mais_antigo)}<small class="d3f-de"> / 30 dias</small>` : '0 dias', tom: antigo ? (antigo.atraso_mais_antigo > 30 ? 'r' : '') : 'q', barra: antigo ? Math.min(100, antigo.atraso_mais_antigo / 30 * 100) : null,
        sub: antigo ? `${cli(antigo.cliente_nome)} · venceu ${curta(antigo.vencimento_mais_antigo)}` : 'nenhuma vencida' },
      { rotulo: 'Críticos · 30+ dias', valor: n0(criticos.length), tom: criticos.length ? 'r' : 'g', attrs: real ? '' : 'data-espiar="comercial:inadimplencia:criticos"',
        sub: criticos.length ? criticos.slice(0, 3).map((c) => cli(c.cliente_nome)).join(' ') : 'nenhum passou de 30' }]);
    const barra = filtros({ tela: 'ina', busca: { chave: 'inad', rotulo: 'Buscar cliente em atraso', dica: 'Buscar cliente', valor: ctx.filtro?.inad },
      chips: [['todos', 'Todos', clientes.length], ['ate7', 'Até 7 dias', clientes.filter(faixa.ate7).length], ['de8a30', '8 a 30 dias', clientes.filter(faixa.de8a30).length], ['criticos', 'Críticos', criticos.length, criticos.length ? 'r' : ''],
        ...(av?.disponivel ? [['semaviso', 'Sem aviso', semAviso.length, semAviso.length ? 'a' : '']] : [])],
      extras: [['marcados', 'Marcados à mão', marcados.length], ...(real ? [['sempar', 'Sem par no Vybe OS', semPar.length]] : [])] });
    const doCliente = (c) => faturas.filter((x) => (c.cliente_id != null && String(x.cliente_id) === String(c.cliente_id)) || (c.cliente_id == null && (x.cliente_nome || x.descricao) === c.cliente_nome));
    const meses = (l) => [...new Set(l.map((x) => mesDe(x.vencimento)))].filter(Boolean).join(' e ');
    const linhaCliente = (c) => {
      const l = doCliente(c), uma = l.length === 1 && Number(c.faturas) <= 1 ? l[0] : null;
      const detalhe = hist([`Venceu em ${extenso(c.vencimento_mais_antigo)}`, c.descricao ? esc(c.descricao) : '', real && c.no_vybe === false ? 'Sem par no Vybe OS: a ligação é pelo CNPJ ou pelo nome' : '', ...historicoAvisos(av, c)])
        + (l.length ? l.map((x) => `<div class="fv2-mini">${pilula(quantos(x.atraso, 'dia', 'dias'), 'r')}<p>${esc(oQueE(x))} · ${rs(x.aberto ?? x.valor)} em aberto · venceu em ${extenso(x.vencimento)}</p>
            ${doFin(x.id) ? NO_EXTRATO : `${uma ? '' : botaoRecebi(x)}<button type="button" class="fv2-btn s" data-vc="receber" data-id="${esc(x.id)}">Recebi uma parte</button>`}</div>`).join('')
          : '<p class="fv2-hist">Estes lançamentos se conferem no Extrato</p>');
      return linha({ tela: 'ina', id: 'k' + (c.cliente_id ?? c.cliente_nome), pill: pilula(quantos(c.atraso_mais_antigo, 'dia', 'dias'), 'r'),
        texto: `${cli(c.cliente_nome)}${l.length ? ' · ' + esc(meses(l)) : ''}${Number(c.faturas) > 1 ? ` <span class="d3f-mes">· ${quantos(c.faturas, 'fatura', 'faturas')}</span>` : ''}`,
        meio: `<span class="d3f-meio">${socio(c.cliente_nome)}${av?.disponivel ? `<small class="d3f-nav" title="${esc(quantos(nAvisos(av, c), 'aviso', 'avisos'))} aos sócios">${n0(nAvisos(av, c))}×</small>` : ''}</span>`, valor: rs(c.valor),
        dir: `${uma ? botaoRecebi(uma) : `<button type="button" class="fv2-btn s" data-fv="linha" data-tela="ina" data-valor="k${esc(c.cliente_id ?? c.cliente_nome)}">${l.length ? 'Ver as faturas' : 'Ver'}</button>`}${botaoAvisar(av, c)}`, detalhe });
    };
    const base = (u.extra === 'sempar' ? semPar : clientes.filter(faixa[u.chip] || faixa.todos)).filter(bate), cabe = u.inteira || termo ? base : base.slice(0, 6);
    const STATUS = { atrasado: 'Atrasado', inadimplente: 'Inadimplente' };
    const lista = u.extra === 'marcados'
      ? cartao({ titulo: 'Marcados à mão', rotulo: 'acao', sub: 'em Finanças por cliente', corpo: marcados.filter(bate).map((m) => `<div class="fv2-lin">${pilula(STATUS[m.status_pagamento] || 'Marcado', m.status_pagamento === 'inadimplente' ? 'r' : 'a')}<p class="fv2-txt">${cli(m.cliente_nome)}</p><button type="button" class="fv2-btn s" data-fv="ir" data-valor="financas">Abrir</button></div>`).join('') || '<p class="fv2-nada">Ninguém marcado à mão.</p>' })
      : cartao({ titulo: 'Clientes em atraso', rotulo: 'acao', cls: 'd3f-tabela', sub: clientes.length ? 'do mais antigo ao mais novo' : '',
        cab: cabe.length ? cabeca([['d3f-cab-pill', 'Atraso'], ['fv2-txt', 'Cliente'], ['d3f-meio', 'Sócio'], ['fv2-valor', 'Valor'], ['d3f-dir', '']]) : '',
        corpo: cabe.map(linhaCliente).join('') || `<p class="fv2-nada">${clientes.length ? 'Nenhum cliente neste filtro.' : 'Ninguém em atraso.'}</p>`,
        pe: maisHtml(base.length - cabe.length, '', 'mostrar', 'ina') + (clientes.length ? `${sociosAvisados(av)}<span class="d3f-total"><span class="fv2-sub">Total</span><b class="d3f-r">${rs(total)}</b></span>` : '') });
    // Régua de avisos (quadro D3-Inadimplencia): cada bolinha é um cliente, na cor dele, no dia em que está; as marcas
    // de 3, 10 e 30 dias dizem a quem levar o atraso. A escala vai até 33 dias. Quem já foi avisado está nas linhas
    // (N× e "Avisar de novo") e no rodapé "Sócios avisados" (registro de avisos, desde 14/11/2026).
    const pos = (dias) => Math.max(2, Math.min(97, Math.round(Math.min(Number(dias) || 0, 33) / 33 * 100)));
    const de3a9 = clientes.filter((c) => c.atraso_mais_antigo >= 3 && c.atraso_mais_antigo < 10).length, de10a30 = clientes.filter((c) => c.atraso_mais_antigo >= 10 && c.atraso_mais_antigo <= 30).length;
    const regua = cartao({ titulo: 'Régua de avisos', rotulo: 'regua', cls: 'fv2-regua d3f-avisos', sub: clientes.length ? quantos(clientes.length, 'cliente', 'clientes') : '',
      corpo: `<div class="fv2-tri" role="img" aria-label="${esc(clientes.map((c) => `${c.cliente_nome}: ${quantos(c.atraso_mais_antigo, 'dia', 'dias')}`).join(', ') || 'Ninguém em atraso')}">
          ${clientes.map((c, i) => `<span class="fv2-pt fv2-cli" data-carteira="${esc(carteiraDe(c.cliente_nome))}" style="left:${pos(c.atraso_mais_antigo)}%;animation-delay:${(i * 0.08).toFixed(2)}s" title="${esc(c.cliente_nome)}: ${quantos(c.atraso_mais_antigo, 'dia', 'dias')}"></span>`).join('')}
          <span class="fv2-mk" style="left:${pos(3)}%">3 d</span><span class="fv2-mk" style="left:${pos(10)}%">10 d</span><span class="fv2-mk r" style="left:${pos(30)}%">30 d</span></div>
        <div class="fv2-lin fv2-faixa">${pilula('3 dias', 'n')}<p>Sócio do cliente</p><b class="d3f-conta">${n0(de3a9)}</b></div>
        <div class="fv2-lin fv2-faixa">${pilula('10 dias', 'a')}<p>Os quatro sócios</p><b class="d3f-conta">${n0(de10a30)}</b></div>
        <div class="fv2-lin fv2-faixa">${pilula('30 dias', 'r')}<p>Crítico</p><b class="d3f-conta">${n0(criticos.length)}</b></div>` });
    // Em atraso por mês do vencimento, nos últimos 6 meses: o que segue aberto de cada mês.
    const seis = [5, 4, 3, 2, 1, 0].map((n) => somaMes(hoje.slice(0, 7), -n)), porMes = seis.map((m) => soma(faturas.filter((x) => String(x.vencimento).slice(0, 7) === m), 'aberto'));
    const grafMes = porMes.some((v) => v > 0) ? cartao({ titulo: 'Em atraso · 6 meses', rotulo: 'meses', sub: 'pelo vencimento',
      corpo: `${globalThis.d3LinhaSvg(porMes, { largura: 320, altura: 90, rotulo: `Valor em atraso por mês de vencimento: ${seis.map((m, i) => `${mesDe(m + '-01')} ${mil(porMes[i])}`).join(', ')}` })}<div class="d3f-eixo">${seis.map((m, i) => (i === 5 ? `<b>${esc(mes3(m + '-01'))}</b>` : `<span>${esc(mes3(m + '-01'))}</span>`)).join('')}</div>` }) : '';
    const falta = oQueFalta(ctx), semNada = !clientes.length && u.extra !== 'marcados';
    const M = molde();
    if (M) {
      // Padrão V2 (prancha V2-M-Financas-Inadimplencia): os clientes em atraso, do mais antigo ao mais novo, com a barra dos
      // dias até 30, o sócio e o valor; "De olho" no pé, a Régua de avisos embaixo e o laranja com o mais antigo (ou o
      // primeiro que ninguém avisou).
      const COLS = [[28, ''], [0, 'Cliente'], [200, 'Dias em atraso'], [64, 'Sócio'], [110, 'Valor', 'r'], [96, '']];
      const tomDias = (n) => (n > 30 ? 'r' : n > 7 ? 'a' : '');
      const linhaI = (c) => {
        const l = doCliente(c), uma = l.length === 1 && Number(c.faturas) <= 1 ? l[0] : null, id = 'k' + (c.cliente_id ?? c.cliente_nome), aberta = u.aberta === String(id), n = Number(c.atraso_mais_antigo) || 0;
        const detalhe = hist([`Venceu em ${extenso(c.vencimento_mais_antigo)}`, c.descricao ? esc(c.descricao) : '', real && c.no_vybe === false ? 'Sem par no Vybe OS: a ligação é pelo CNPJ ou pelo nome' : '', ...historicoAvisos(av, c)])
          + l.map((x) => `<div class="fv2-mini">${pilula(quantos(x.atraso, 'dia', 'dias'), 'r')}<p>${esc(oQueE(x))} · ${rs(x.aberto ?? x.valor)} em aberto · venceu em ${extenso(x.vencimento)}</p>
              ${doFin(x.id) ? NO_EXTRATO : `${uma ? '' : botaoRecebi(x)}<button type="button" class="fv2-btn s" data-vc="receber" data-id="${esc(x.id)}">Recebi uma parte</button>`}</div>`).join('')
          + (l.length ? '' : '<p class="fv2-hist">Estes lançamentos se conferem no Extrato</p>') + (botaoAvisar(av, c) ? `<div class="fv2-det-acoes">${botaoAvisar(av, c)}</div>` : '');
        return `<div class="v2-abre d3m-d-fm-linha" data-linha="${esc(id)}" aria-expanded="${aberta}">${M.tr(COLS, [M.av(c.cliente_nome),
          `<button type="button" class="d3m-d-fm-nome" data-fv="linha" data-tela="ina" data-valor="${esc(id)}" aria-expanded="${aberta}"><b>${esc(c.cliente_nome)}</b>${Number(c.faturas) ? ` <small>· ${quantos(c.faturas, 'fatura', 'faturas')}</small>` : ''}</button>`,
          `<span class="d3m-d-fm-dias ${tomDias(n)}"><span class="d3m-d-fm-barra" style="--v:${Math.min(100, Math.round(n / 30 * 100))}%"><i></i></span><b>${quantos(n, 'dia', 'dias')}</b></span>`,
          `${socio(c.cliente_nome)}${av?.disponivel && nAvisos(av, c) ? `<small title="${esc(quantos(nAvisos(av, c), 'aviso', 'avisos'))} aos sócios"> ${n0(nAvisos(av, c))}×</small>` : ''}`, rs(c.valor),
          uma ? botaoRecebi(uma) : `<button type="button" class="fv2-btn s" data-fv="linha" data-tela="ina" data-valor="${esc(id)}">Ver</button>`])}
          <div class="v2-mais"><div><div class="fv2-det d3m-d-fm-det">${detalhe}</div></div></div></div>`;
      };
      const fichas = M.fichas([['todos', 'Todos', clientes.length], ['ate7', 'Até 7 dias', clientes.filter(faixa.ate7).length], ['de8a30', 'De 8 a 30 dias', clientes.filter(faixa.de8a30).length], ['criticos', 'Críticos', criticos.length, 'r'],
        ...(av?.disponivel ? [['semaviso', 'Sem aviso', semAviso.length, 'a']] : [])].map(([k, nome, n, tom]) => ({ nome, n, tom: n ? tom : '', on: !u.extra && u.chip === k, attrs: `data-fv="chip" data-tela="ina" data-valor="${k}"` }))
        .concat([['marcados', 'Marcados à mão', marcados.length], ...(real ? [['sempar', 'Sem par no Vybe OS', semPar.length]] : [])].filter(([, , n]) => n).map(([k, nome, n]) => ({ nome, n, on: u.extra === k, attrs: `data-fv="extra" data-tela="ina" data-valor="${k}"` }))), 'Filtrar os clientes');
      const corpo = u.extra === 'marcados'
        ? marcados.filter(bate).map((m) => M.tr(COLS, [M.av(m.cliente_nome), `<b>${esc(m.cliente_nome)}</b>`, `<span class="${m.status_pagamento === 'inadimplente' ? 'r' : 'a'}">${esc(STATUS[m.status_pagamento] || 'Marcado')} à mão</span>`, '', '', '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="financas">Abrir</button>'])).join('') || '<p class="d3m-d-fm-vazio">Ninguém marcado à mão.</p>'
        : semNada ? `<div class="d3m-d-fm-vazio"><p>Ninguém em atraso.</p><button type="button" class="fv2-btn s" data-fv="ir" data-valor="recebimentos">Ver recebimentos</button></div>`
          : base.map(linhaI).join('') || '<p class="d3m-d-fm-vazio">Nenhum cliente neste filtro.</p>';
      const avisados = av?.disponivel ? new Set((av.lista || []).filter((a) => String(a.em || '') >= new Date(Date.now() - 30 * 864e5).toISOString()).flatMap((a) => [a.quem_nome, ...(a.para || [])]).filter(Boolean)).size : 0;
      const olho = M.olho([[mil(total), 'em atraso', total ? 'r' : ''], [n0(nFat), nFat === 1 ? 'fatura' : 'faturas'], [n0(avisados), av?.disponivel ? 'sócios avisados em 30 dias' : 'sócios avisados, sem registro ainda'], falta.botao ? [falta.botao, ''] : null]);
      const regua = M.folha({ titulo: 'Régua de avisos', dir: 'quem é avisado e quando', cls: 'd3m-d-fm-regua', rotulo: 'regua', corpo: [['3 dias', 'o sócio do cliente', de3a9, ''], ['10 dias', 'os quatro sócios', de10a30, 'a'], ['30 dias', 'crítico', criticos.length, 'r']]
        .map(([q, quem, n, tom]) => M.tr([[90, ''], [0, ''], [110, '', 'r']], [`<span class="d3m-d-fm-ponto ${tom}"></span>${q}`, quem, n ? `<b>${quantos(n, 'cliente', 'clientes')}</b>` : '<span class="q">0 clientes</span>'])).join('') + falta.nota });
      const alvo = semAvisoJa || antigo, nomeS = alvo ? SOCIO[carteiraDe(alvo.cliente_nome)] : null;
      const laranja = alvo ? M.laranja({ rot: semAvisoJa ? 'ninguém avisou' : 'o mais antigo', num: quantos(alvo.atraso_mais_antigo, 'dia', 'dias'), frase: `de atraso de ${esc(alvo.cliente_nome)}`,
        apoio: `${rs(alvo.valor)}${Number(alvo.faturas) ? ` em ${quantos(alvo.faturas, 'fatura', 'faturas')}` : ''}, a primeira de ${curta(alvo.vencimento_mais_antigo)}.${criticos.length > 1 ? ` ${quantos(criticos.length, 'cliente passou', 'clientes passaram')} de 30 dias.` : ''}`,
        bts: [av?.disponivel ? [`${nAvisos(av, alvo) ? 'Avisar de novo' : nomeS ? 'Avisar o ' + nomeS[1] : 'Avisar o sócio'}`, `data-fv="avisar" data-cliente-id="${esc(alvo.cliente_id ?? '')}" data-cliente-nome="${esc(alvo.cliente_nome)}" data-atraso="${Number(alvo.atraso_mais_antigo) || 0}"`] : null,
          [`Ver ${alvo.cliente_nome}`, `data-fv="linha" data-tela="ina" data-valor="${esc('k' + (alvo.cliente_id ?? alvo.cliente_nome))}"`]] }) : '';
      return M.molde({ tela: 'ina', aba: 'inadimplencia', titulo: 'Inadimplência', repintar: ctx.repintar,
        sub: `${esc(diaDeHoje(hoje))}${total ? ` · ${mil(total)} em atraso` : ''}${criticos.length ? ` · ${quantos(criticos.length, 'passou', 'passaram')} de 30 dias` : ''}${real ? ' · pelo extrato' : ''}`,
        acao: '<button type="button" class="d3m-d-vbtn" data-fv="ir" data-valor="recebimentos">Ver recebimentos</button>', laranja,
        corpo: M.folha({ titulo: quantos(clientes.length, 'cliente em atraso', 'clientes em atraso'), sub: clientes.length ? 'do mais antigo ao mais novo' : '', dir: fichas, cab: semNada || u.extra === 'marcados' ? '' : M.cab(COLS), corpo, olho, cls: 'd3m-d-fm-curta', rotulo: 'acao' }) + regua });
    }
    return `<div class="fv2 d3f" data-tela="ina"><div class="fv2-in">
      ${topo({ titulo: 'Inadimplência', acoes: comoFunciona + '<button type="button" class="fv2-btn" data-fv="ir" data-valor="recebimentos">Ver recebimentos</button>', extra: `<span class="d3f-data">${esc(diaDeHoje(hoje))}</span>${real ? '<span class="fv2-pill b">Extrato</span>' : fonte(d)}` })}
      ${semAvisoJa ? acao('Vorcaro · Financeiro', frase, `Avisar ${SOCIO[carteiraDe(semAvisoJa.cliente_nome)] ? 'o ' + SOCIO[carteiraDe(semAvisoJa.cliente_nome)][1] : 'o sócio'}`, `data-fv="avisar" data-cliente-id="${esc(semAvisoJa.cliente_id ?? '')}" data-cliente-nome="${esc(semAvisoJa.cliente_nome)}" data-atraso="${Number(semAvisoJa.atraso_mais_antigo) || 0}"`)
        : acao('Vorcaro · Financeiro', frase, clientes.length ? `Ver ${clientes.length === 1 ? 'o cliente' : 'os ' + n0(clientes.length)}` : '', 'data-fv="foco" data-valor="acao"')}
      ${numeros}${barra}
      ${semNada ? vazioLinha('Ninguém em atraso.', `<button type="button" class="fv2-btn s" data-fv="ir" data-valor="recebimentos">Ver recebimentos</button>${falta.botao}`)
        : `<div class="fv2-grade c">${lista}<div class="d3f-coluna">${regua}${grafMes}</div></div>${falta.botao ? `<div class="fv2-rodape">${falta.botao}</div>` : ''}`}
      ${falta.nota}</div></div>`;
  }

  // ----- Finanças (Visão geral do setor) -----
  async function lerVisao() {
    const hoje = hojeBahia(), atual = hoje.slice(0, 7), u = ui.vis, mes = u.per === 'anterior' ? somaMes(atual, -1) : atual, tipo = u.per === 'ano' ? 'anual' : 'mensal', q = `&mes=${mes}&periodo=${tipo}`;
    const passados = [3, 2, 1].map((n) => somaMes(atual, -n));
    const [vf, rec, con, ina, cx, porCliente, fx, ...antes] = await Promise.all([carregar('comercial', mes), buscar('recebimentos' + q), buscar('contas' + q), buscar('inadimplencia'), buscar('caixa'), buscar('financas'),
      buscar('', 'financeiro'), ...passados.map((m) => buscar(`recebimentos&mes=${m}&periodo=mensal`))]);
    return { hoje, atual, mes, tipo, vf: vf?.dados || null, rec, con, ina, cx, porCliente, fx, passados: passados.map((m, i) => ({ mes: m, dados: antes[i] })) };
  }
  function visaoHtml(L, ctx = {}) {
    const u = ui.vis, { hoje, atual, mes, tipo } = L, ligado = tipo === 'mensal' && L.vf?.conectado && L.vf.resumo ? L.vf : null;
    const R = ligado?.resumo || {}, A = L.rec?.resumo?.atual || {}, K = L.con?.resumo || {};
    const entrou = Number(ligado ? R.recebido : A.recebido) || 0, previsto = Number(ligado ? R.previsto : A.a_receber) || 0;
    const saiu = Number(ligado ? R.despesas_pagas : K.pago) || 0, aSair = Number(ligado ? (Number(R.despesas_pagas) || 0) + (Number(R.despesas_pendentes) || 0) : K.total) || 0;
    const I = ligado?.inadimplencia || L.ina || {}, atrasados = [...(I.clientes || [])].sort((x, z) => z.atraso_mais_antigo - x.atraso_mais_antigo), totalAtraso = Number(I.total) || 0;
    const noPeriodo = (L.rec?.recebiveis || []).filter((x) => !x.cancelado && emAtraso(x)), atrasoPeriodo = Math.min(previsto, soma(noPeriodo, 'aberto'));
    const resultado = previsto - aSair, semEles = resultado - atrasoPeriodo, passou = u.per === 'anterior';
    const nomeP = tipo === 'anual' ? mes.slice(0, 4) : maiuscula(mesDe(mes + '-01'));
    const sobra = (v) => (v >= 0 ? `${passou ? 'sobrou' : 'sobra'} <b>${mil(v)}</b>` : `${passou ? 'ficou' : 'fica'} <b>${mil(-v)}</b> no vermelho`);
    const semDado = !previsto && !aSair && !entrou && !saiu;
    const frase = semDado ? `Sem lançamentos em ${esc(tipo === 'anual' ? mes.slice(0, 4) : nomeMes(mes))}.`
      : noPeriodo.length ? `${esc(nomeP)} ${sobra(resultado)} se ${noPeriodo.length === 1 ? 'o atrasado pagar' : `os ${n0(noPeriodo.length)} atrasados pagarem`}.`
      : `${esc(nomeP)} ${sobra(resultado)}.`;
    // "Ver a conta": de onde sai a frase, e os números que não têm cartão próprio.
    const F = L.porCliente?.resumo || {}, conta = [['Previsto para entrar', rs(previsto)], ['Já entrou', rs(entrou)], ['Contas do período', rs(aSair)], ['Já saiu', rs(saiu)], ['Resultado previsto', rs(resultado)],
      ...(atrasoPeriodo ? [['Em atraso no período', rs(atrasoPeriodo)], ['Sem os atrasados', rs(semEles)]] : []), ['Em atraso, de qualquer mês', rs(totalAtraso)],
      ...(Number(A.pendente) ? [['Pendente de receber', rs(A.pendente)]] : []),
      ...(Number(F.receita) ? [['Receita contratada por mês', `${rs(F.receita)}${F.margem_percentual != null ? ` · margem estimada ${String(F.margem_percentual).replace('.', ',')}%` : ''}`]] : []),
      ...(ligado ? [['Folha do mês (extrato)', rs(ligado.folha?.total)], ['Gastos fixos por mês', rs(ligado.custos_fixos?.total)], ['Outras saídas (extrato)', rs(R.despesas_sem_folha ?? ligado.despesas?.total)]] : [])];
    const acaoHtml = `<div class="v2-abre fv2-conta" data-linha="conta" aria-expanded="${u.conta}">${acao('Vorcaro · Tesouraria', frase, semDado ? '' : 'Ver a conta', `data-fv="conta" aria-expanded="${u.conta}"`)}
      <div class="v2-mais"><div><dl class="fv2-dl">${conta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div></div></div>`;
    // Para onde saiu: os grupos de contas (as categorias do extrato), do maior para o menor.
    const grupos = ligado ? (ligado.despesas?.categorias || []).map((c) => ({ nome: c.categoria, total: Number(c.total) || 0, fatia: Math.round(Number(c.percentual) || 0) }))
      : [...(K.grupos || [])].filter((g) => Number(g.total) > 0).map((g) => ({ nome: g.nome, total: Number(g.total) || 0, fatia: pc(g.total, K.total) }));
    grupos.sort((x, z) => z.total - x.total);
    const numeros = nums([
      { rotulo: 'Entrou', valor: mil(entrou), barra: pc(entrou, previsto), tom: entrou ? 'd3f-verde' : 'q d3f-verde', sub: previsto ? `${pc(entrou, previsto)}% de ${mil(previsto)}` : 'nada previsto', attrs: 'data-fv="ir" data-valor="recebimentos"' },
      { rotulo: 'Saiu', valor: mil(saiu), barra: pc(saiu, aSair), tom: saiu ? '' : 'q', sub: aSair ? `de ${mil(aSair)}${grupos[0] ? ` · ${esc(grupos[0].nome)} ${grupos[0].fatia}%` : ''}` : 'nada lançado', attrs: 'data-fv="ir" data-valor="contas"' },
      { rotulo: 'Em atraso', valor: mil(totalAtraso), tom: totalAtraso ? 'r' : 'q', attrs: 'data-fv="ir" data-valor="inadimplencia"',
        sub: atrasados.length ? `<span class="d3f-r">${quantos(atrasados.length, 'cliente', 'clientes')} · o mais antigo há ${quantos(atrasados[0].atraso_mais_antigo, 'dia', 'dias')}</span>` : 'ninguém em atraso' },
      { rotulo: 'Resultado', valor: mil(resultado), tom: semDado ? 'q' : resultado < 0 ? 'r' : 'g', sub: atrasoPeriodo ? `sem atrasos · ${mil(semEles)}` : `${mil(previsto)} − ${mil(aSair)}` }]);
    // Pede ação: quem está em atraso, as contas vencendo, o que chegou do grupo, o extrato a conferir e o que falta informar.
    const faturas = L.ina?.faturas || [], itens = [];
    for (const c of atrasados) {
      const l = faturas.filter((x) => c.cliente_id != null && String(x.cliente_id) === String(c.cliente_id)), uma = l.length === 1 && Number(c.faturas) <= 1 ? l[0] : null;
      itens.push(linha({ tela: 'vis', id: 'k' + (c.cliente_id ?? c.cliente_nome), pill: pilula(quantos(c.atraso_mais_antigo, 'dia', 'dias'), 'r'),
        texto: `${cli(c.cliente_nome)}${uma ? ' · ' + esc(mesDe(uma.vencimento)) : ''}${Number(c.faturas) > 1 ? ` <span class="d3f-mes">· ${quantos(c.faturas, 'fatura', 'faturas')}</span>` : ''}`, valor: rs(c.valor),
        dir: `${uma && !doFin(uma.id) ? botaoRecebi(uma) : '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="inadimplencia">Abrir</button>'}${botaoAvisar(L.ina?.avisos, c)}`,
        detalhe: hist([`Venceu em ${extenso(c.vencimento_mais_antigo)}`, Number(c.faturas) > 1 ? `${quantos(c.faturas, 'fatura vencida', 'faturas vencidas')}, a mais antiga há ${quantos(c.atraso_mais_antigo, 'dia', 'dias')}` : '', ...historicoAvisos(L.ina?.avisos, c), 'A baixa e o histórico ficam em Inadimplência']) }));
    }
    if (L.con) { const p = contasQuePedem(L.con, hoje), nome = (id) => (K.grupos || []).find((g) => g.id === id)?.nome || id;
      for (const c of [...p.vencidas, ...p.sete]) itens.push(linhaConta('vis', c, nome(c.grupo), hoje, { comForm: false })); }
    const simples = (pill, texto, dir, botao) => `<div class="fv2-lin">${pill}<p class="fv2-txt">${texto}</p>${dir ? `<span class="fv2-sub fv2-valor">${dir}</span>` : ''}<span class="d3f-dir">${botao}</span></div>`;
    // Do Financeiro do Vybe OS (só os donos leem): o que chegou do grupo Vybe Financeiro e o extrato a conferir.
    const X = L.fx, pendentes = (X?.vorcaro?.propostas || []).filter((p) => p.estado === 'pendente');
    const aConferir = (X?.transacoes || []).filter((t) => !t.real?.conferido).length, aDividir = (X?.transacoes || []).filter((t) => t.real?.categoria === 'receita_boleto' && !t.real?.partes?.length).length;
    if (pendentes.length) itens.push(simples('<span class="fv2-pill n d3f-ag">Do grupo</span>', `<b>${quantos(pendentes.length, 'lançamento', 'lançamentos')}</b> · Vybe Financeiro`, curta(pendentes[0].recebido_em), '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="vorcaro">Conferir</button>'));
    if (aConferir) itens.push(simples(pilula('Extrato', 'n'), `<b>${n0(aConferir)} a conferir</b>${aDividir ? ` · ${quantos(aDividir, 'boleto a dividir', 'boletos a dividir')}` : ''}`, X?.importacoes?.length ? curta(X.importacoes[X.importacoes.length - 1].ate) : '', '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="extrato">Conferir</button>'));
    if (L.vf && L.vf.conectado === false) itens.push(simples(pilula('Extrato', 'n'), '<b>Nenhum extrato importado</b>', '', '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="extrato">Importar</button>'));
    const semContrato = (L.porCliente?.clientes || []).filter((c) => !(Number(c.valor_mensal) > 0)).length;
    if (semContrato) itens.push(simples(pilula('Contrato', 'n'), `<b>${quantos(semContrato, 'cliente', 'clientes')}</b> sem contrato informado`, '', '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="financas">Informar</button>'));
    const cabe = u.inteira ? itens : itens.slice(0, 5);
    // Rodapé do quadro D3-FinVisao: "Sócios avisados" (o sistema ainda não registra aviso aos sócios, então fica o vazio)
    // e o dia em que a folha saiu no extrato.
    const diaFolha = (ligado?.folha?.funcionarios || []).map((f) => Number(f.dia_pagamento)).filter((n) => n > 0).sort((a, b) => a - b)[0];
    const socios = `${sociosAvisados(L.ina?.avisos)}${diaFolha ? `<span class="fv2-sub d3f-folha">folha · dia ${n0(diaFolha)}</span>` : ''}`;
    const acaoCard = cartao({ titulo: 'Pede ação', rotulo: 'acao', cls: 'd3f-pede', sub: itens.length ? `${quantos(itens.length, 'coisa', 'coisas')}, na ordem` : '', corpo: cabe.join('') || '<p class="fv2-nada">Nada pedindo ação agora.</p>',
      pe: maisHtml(itens.length - cabe.length, '', 'mostrar', 'vis') + socios });
    // Caixa: três meses atrás (o que entrou), o mês de agora (o que já entrou) e três à frente (projeção), numa linha só.
    const serie = new Map((ligado?.series || L.vf?.series || []).map((s) => [s.mes, Number(s.faturamento) || 0]));
    // Projeção: a do extrato (média dos meses fechados, sem cenário); sem extrato, a dos recorrentes.
    const PX = window.VybeFinanceiroExtrato, projX = L.fx?.projecao?.base && typeof PX?.projetar === 'function' && (L.fx.transacoes || []).length ? PX.projetar(L.fx.projecao.base, {}, 4).meses : null;
    const prev = projX || L.cx?.previsao?.meses || [];
    const colunas = [...L.passados.map((p) => ({ mes: p.mes, valor: serie.has(p.mes) ? serie.get(p.mes) : Number(p.dados?.resumo?.atual?.recebido) || 0, tipo: 'antes' })),
      ...[0, 1, 2, 3].map((n) => { const m = somaMes(atual, n), x = prev.find((y) => y.mes === m); return { mes: m, valor: !n && serie.has(m) ? serie.get(m) : Number(x?.entradas) || 0, tipo: n ? 'depois' : 'agora' }; })];
    const temCaixa = colunas.some((c) => c.valor > 0), agora = colunas[3];
    const caixa = cartao({ titulo: 'Caixa', rotulo: 'caixa', cls: 'fv2-caixa', sub: temCaixa ? `<b class="d3f-caixa-v">${mil(agora.valor)}</b><span class="d3f-leg"><i></i>realizado</span><span class="d3f-leg proj"><i></i>projeção</span>` : '',
      corpo: temCaixa ? `${linhaDupla(colunas.slice(0, 4).map((c) => c.valor), colunas.slice(3).map((c) => c.valor), { rotulo: `Entradas de ${colunas.map((c) => `${mesDe(c.mes + '-01')} ${mil(c.valor)}`).join(', ')}; de ${mesDe(colunas[4].mes + '-01')} em diante é projeção` })}
          <div class="d3f-eixo">${colunas.map((c) => (c.tipo === 'agora' ? `<b>${esc(mes3(c.mes + '-01'))}</b>` : `<span>${esc(mes3(c.mes + '-01'))}</span>`)).join('')}</div>`
        : '<p class="fv2-nada">O caixa aparece com o extrato importado.</p>' });
    const saiuPor = grupos.length ? cartao({ titulo: 'Saiu por grupo', rotulo: 'grupos', sub: mil(aSair), corpo: grupos.slice(0, 5).map((g) => barraGrupo(`<b>${esc(g.nome)}</b>`, g.fatia, mil(g.total))).join('') }) : '';
    // Atalhos com a contagem do que pede ação em cada tela.
    const contagem = { recebimentos: [(L.rec?.recebiveis || []).filter((x) => !x.cancelado).length, ''], contas: [(L.con?.contas || []).filter((c) => !c.cancelada).length, ''],
      inadimplencia: [atrasados.length, 'r'], extrato: [aConferir, 'a'], vorcaro: [pendentes.length, 'a'] };
    const subs = (ctx.subs || []).map((s) => { const [n, tom] = contagem[s.id] || [0, '']; return `<button type="button" class="fv2-chip" data-fv="ir" data-valor="${esc(s.id)}">${esc(s.nome)}${s.url ? ' ↗' : ''}${n ? ` <b${tom ? ` class="${tom}"` : ''}>${n0(n)}</b>` : ''}</button>`; }).join('');
    const seg = [['anterior', maiuscula(mesDe(somaMes(atual, -1) + '-01'))], ['atual', maiuscula(mesDe(atual + '-01'))], ['ano', 'Ano']];
    return `<div class="fv2 d3f" data-tela="vis"><div class="fv2-in">
      ${topo({ titulo: 'Finanças', trilha: false, extra: `<span class="d3f-data">${esc(diaDeHoje(hoje))}</span>${ligado ? '<span class="fv2-pill b">Extrato</span>' : ''}`, meio: `<span class="fv2-seg" role="group" aria-label="Período">${seg.map(([k, n]) => `<button type="button" data-fv="per" data-valor="${k}" aria-pressed="${u.per === k}">${esc(n)}</button>`).join('')}</span>`,
        acoes: `<span class="fv2-lancar"><button type="button" class="fv2-btn p" data-fv="lancar" aria-expanded="${u.lancar}">${IC.mais}Lançar</button>${u.lancar ? '<span class="fv2-menu" role="menu"><button type="button" role="menuitem" data-fv="ir" data-valor="vorcaro">Lançar à mão</button><button type="button" role="menuitem" data-fv="ir" data-valor="extrato">Importar extrato</button></span>' : ''}</span>` })}
      ${acaoHtml}${numeros}
      <div class="fv2-grade a">${acaoCard}<div class="d3f-coluna">${caixa}${saiuPor}</div></div>
      <div class="fv2-abrir"><span class="fv2-sub">Abrir</span>${subs}<button type="button" class="fv2-chip" data-fv="ir" data-valor="caixa">Caixa</button><button type="button" class="fv2-chip" data-fv="ir" data-valor="rh">Folha</button></div></div></div>`;
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
      for (const l of raiz.querySelectorAll('.fv2-linha, .d3m-d-fm-linha')) { const on = l.dataset.linha === u.aberta; l.setAttribute('aria-expanded', on); l.querySelector('.fv2-txt, .d3m-d-fm-nome')?.setAttribute('aria-expanded', on); }
      return;
    }
    if (acao === 'conta') { u.conta = !u.conta; raiz.querySelector('.fv2-conta')?.setAttribute('aria-expanded', u.conta); b.setAttribute('aria-expanded', u.conta); return; }
    if (acao === 'foco') { const alvo = raiz.querySelector(`[data-fv-card="${valor}"]`); if (alvo) { alvo.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); alvo.classList.remove('fv2-olha'); void alvo.offsetWidth; alvo.classList.add('fv2-olha'); } return; }
    if (acao === 'ir') { if (b.dataset.mao) window.VybeFinanceiro?.abrirLancarMao?.({ status: b.dataset.mao }); return ir(valor); }
    if (acao === 'per') { ui.vis.per = valor; ui.vis.aberta = ''; ui.vis.inteira = false; return repintarVisao(); }
    if (acao === 'lancar') { ui.vis.lancar = !ui.vis.lancar; return repintarVisao(); }
    if (acao === 'novo') { // abre a tela e, quando ela estiver pintada, o formulário de lançar
      ui.vis.lancar = false; ir(valor);
      let n = 0; const t = setInterval(() => { const novo = document.querySelector(`#vv-comercial .fv2 :is(.fv2-btn.p,.d3m-d-vbtn.p)[data-vc="${valor === 'contas' ? 'conta' : 'recebivel'}"]`); if (novo) { clearInterval(t); novo.click(); } else if (++n > 40) clearInterval(t); }, 150);
      return;
    }
    if (acao === 'receber') return baixa(b, { acao: 'recebivel_receber', id: valor, valor_recebido: Number(b.dataset.total) || 0, recebido_em: hojeBahia() }, 'Recebido');
    if (acao === 'pagar') return baixa(b, { acao: 'conta_pagar', id: valor }, 'Pago');
    // Forma de pagamento da fatura (tocar na escolhida tira) e o aviso aos sócios: só registro + o sino do Vybe OS.
    if (acao === 'forma') return baixa(b, { acao: 'recebivel_forma', id: b.dataset.id, forma: valor }, valor ? (FORMA_NOME[valor] || valor) : 'Sem forma');
    if (acao === 'avisar') return baixa(b, { acao: 'inadimplencia_avisar', cliente_id: b.dataset.clienteId || '', cliente_nome: b.dataset.clienteNome || '', atraso_dias: Number(b.dataset.atraso) || 0 }, 'Avisado');
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', aoClicar);
    document.addEventListener('click', (ev) => { if (ui.vis.lancar && !ev.target.closest?.('.fv2-lancar')) { ui.vis.lancar = false; repintarVisao(); } });
  }
  const telas = Object.freeze({ recebimentos, contas, inadimplencia, visao, _teste: { ui, visaoHtml, lidas } });

  // O relatório do Finanças (vybe-relatorio-financas.js): o mesmo contrato do motor de relatórios, só donos.
  const relatorio = (o = {}) => (window.VybeRelatorioFinancas ? window.VybeRelatorioFinancas.gerar(o) : Promise.resolve({ erro: 'O relatório do Finanças não carregou.' }));
  window.VybeFinancas = Object.freeze({ carregar, estado, ligado, contratosDaCarteira, contratoDoCliente, telas, relatorio });
})();
