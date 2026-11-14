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
  const doFin = (id) => String(id || '').startsWith('fin:');
  const emAtraso = (x) => x.status === 'atrasado' || x.status === 'inadimplente';
  const SETA = { esq: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>', dir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' };
  const IC = {
    cadeado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    lupa: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
    filtro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  };
  const SELO = `<span class="d3-selo-donos">${IC.cadeado}só donos</span>`;
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
      nota: ctx.verFalta ? `<div class="fv2-nota" role="note"><p>${esc(d.motivo || 'O controle financeiro ainda não está ligado.')}${d.aviso ? ' · ' + esc(d.aviso) : ''}</p>${(d.passos || []).length ? `<ol>${d.passos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}</div>` : '' };
  }
  const fonte = (d) => (d?.fonte === 'Vybe Finanças' ? '<span class="fv2-pill b">Vybe Finanças</span>' : '');

  // ----- Faturas (Recebimentos e Inadimplência) -----
  const oQueE = (x) => (x.tipo === 'recorrente' ? `${x.ciclo && x.ciclo !== 'mensal' ? 'parcela ' + x.ciclo : 'mensalidade'} de ${mesDe(x.vencimento)}` : String(x.descricao || 'recebimento pontual'));
  const tipoFatura = (x) => (x.tipo === 'recorrente' ? (x.ciclo && x.ciclo !== 'mensal' ? maiuscula(x.ciclo) : 'Recorrente') : maiuscula(x.categoria || 'Pontual'));
  // Colunas "Contrato" e "Forma" do quadro D3-Recebimentos: o contrato é a categoria lançada (Redes, Tráfego) e, sem ela,
  // o tipo; a forma de pagamento só vem das faturas que a trazem (as importadas do Vybe Finanças), senão o traço curto.
  const contratoFatura = (x) => String(x.categoria || '').trim() || tipoFatura(x);
  const FORMA_NOME = { pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão', transferencia: 'Transferência' };
  const formaFatura = (x) => { const f = String(x.forma_pagamento || x.forma || '').trim(); return FORMA_NOME[f] || f || '–'; };
  // A forma de pagamento se escolhe no detalhe (vybe_comercial_recebivel_forma; vale também para a fatura do Finanças).
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
    else if (doFin(x.id)) acoes = '<small class="fv2-sub">Dê baixa no Vybe Finanças</small>';
    else if (!comForm) acoes = '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="recebimentos">Abrir em Recebimentos</button>';
    else acoes = `${x.status !== 'recebido' ? `<button type="button" class="fv2-btn s" data-vc="receber" data-id="${esc(x.id)}">Recebi uma parte</button>` : ''}
      ${dentro && x.tipo === 'recorrente' ? `<button type="button" class="fv2-btn s" data-vc="proximo" data-id="${esc(x.id)}">Próximo ciclo</button>` : ''}
      ${dentro ? `<button type="button" class="fv2-btn s" data-vc="recebivel" data-id="${esc(x.id)}">Editar</button><button type="button" class="fv2-btn s fv2-perigo" data-vc="cancelar-rec" data-id="${esc(x.id)}">Cancelar</button>`
        : `<button type="button" class="fv2-btn s" data-vc-mes-ir="${String(x.vencimento).slice(0, 7)}">Ver em ${esc(mesDe(x.vencimento))}</button>`}`;
    const forma = comForm && dentro ? trocarForma(x) : '';
    return `${linhas}${acoes || forma ? `<div class="fv2-det-acoes">${forma}${acoes}</div>` : ''}`;
  }
  const botaoRecebi = (x) => (doFin(x.id) ? '<small class="fv2-sub fv2-so-la">baixa no Vybe Finanças</small>' : umToque('receber', x.id, 'Recebi', ` data-total="${Number(x.valor) || 0}"`));
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
    return `<div class="fv2 d3f" data-tela="rec"><div class="fv2-in">
      ${topo({ titulo: 'Recebimentos', meio: periodoHtml(per, hoje), acoes: comoFunciona + novo('recebivel', 'Novo recebimento'), extra: fonte(d) })}
      ${acao('Vorcaro · Financeiro', frase, atrasadas.length ? `Ver ${atrasadas.length === 1 ? 'a fatura' : 'as ' + n0(atrasadas.length)}` : '', 'data-fv="foco" data-valor="acao"')}
      ${numeros}${barra}
      ${semNada ? vazioLinha('Nenhum recebimento neste período.', '<button type="button" class="fv2-btn s" data-vc="recebivel">Lançar o primeiro</button>')
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
    const acoes = !aberta ? '' : doFin(c.id) ? '<small class="fv2-sub">Dê baixa no Vybe Finanças</small>'
      : !comForm ? '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="contas">Abrir em Contas a pagar</button>'
      : dentro ? `<button type="button" class="fv2-btn s" data-vc="conta" data-id="${esc(c.id)}">Editar</button><button type="button" class="fv2-btn s fv2-perigo" data-vc="cancelar-conta" data-id="${esc(c.id)}">Cancelar</button>`
      : `<button type="button" class="fv2-btn s" data-vc-mes-ir="${v.slice(0, 7)}">Ver em ${esc(mesDe(v))}</button>`;
    return `${linhas}${acoes ? `<div class="fv2-det-acoes">${acoes}</div>` : ''}`;
  }
  const botaoPaguei = (c) => (c.pago_em || c.cancelada ? '' : doFin(c.id) ? '<small class="fv2-sub fv2-so-la">baixa no Vybe Finanças</small>' : umToque('pagar', c.id, 'Paguei'));
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
            ${c.cancelada || c.pago_em ? '' : doFin(c.id) ? '<small class="fv2-sub">Dê baixa no Vybe Finanças</small>' : `${umToque('pagar', c.id, 'Paguei')}<button type="button" class="fv2-btn s" data-vc="conta" data-id="${esc(c.id)}">Editar</button><button type="button" class="fv2-btn s fv2-perigo" data-vc="cancelar-conta" data-id="${esc(c.id)}">Cancelar</button>`}</div>`).join('') || '<p class="fv2-hist">Nenhuma conta deste grupo neste filtro.</p>'}</div></div></div></div>`;
    };
    // Grupo sem nada lançado fica na tabela, apagado e sem abrir (a divisão inteira à vista).
    const linhaZerada = (g) => `<div class="fv2-lin fv2-gr d3f-zero" data-grupo="${esc(g.id)}"><span class="fv2-txt"><b>${esc(g.nome)}</b> <span class="d3f-mes">· 0</span></span><span class="d3-barra" style="--v:0%"><i></i></span><b class="fv2-valor">0%</b><span class="fv2-sub">nada lançado</span><span aria-hidden="true"></span></div>`;
    const visiveis = doFiltro.filter(comConta), zerados = termo || u.extra || !vivas.length ? [] : doFiltro.filter((g) => !comConta(g));
    const doFinancas = f?.conectado ? `<div class="fv2-lin fv2-fin"><span class="fv2-pill b">Vybe Finanças</span><p>${mil(f.resumo?.despesas_sem_folha ?? f.despesas?.total)} em despesas de ${esc(nomeMes(f.mes))}${f.folha?.total ? ` · folha ${mil(f.folha.total)}` : ''}</p>
        <span class="fv2-btn s espiavel" data-espiar="financas:comercial:despesas" role="button" tabindex="0">Por categoria</span><span class="fv2-btn s espiavel" data-espiar="financas:comercial:fixos" role="button" tabindex="0">Custos fixos</span></div>` : '';
    const paraOnde = cartao({ titulo: 'Para onde vai', rotulo: 'grupos', cls: 'd3f-tabela', sub: Number(r.total) ? `${parteDe(r.pago, r.total)} pagos` : '',
      cab: visiveis.length ? cabeca([['fv2-txt', 'Grupo'], ['d3f-cab-barra', 'Já saiu'], ['fv2-valor', '%'], ['fv2-sub', 'Pago'], ['d3f-cab-falta', 'Falta']]) : '',
      corpo: (visiveis.map(linhaGrupo).join('') + zerados.map(linhaZerada).join('') || `<p class="fv2-nada">${termo || u.extra ? 'Nenhuma conta neste filtro.' : 'A divisão aparece com a primeira conta lançada.'}</p>`) + doFinancas });
    const falta = oQueFalta(ctx), semNada = !todas.length && !pedem.length;
    return `<div class="fv2 d3f" data-tela="con"><div class="fv2-in">
      ${topo({ titulo: 'Contas a pagar', meio: periodoHtml(per, hoje), acoes: comoFunciona + novo('conta', 'Nova conta'), extra: fonte(d) })}
      ${acao('Vorcaro · Financeiro', frase, nVenc + nSete ? `Ver ${nVenc + nSete === 1 ? 'a conta' : 'as ' + n0(nVenc + nSete)}` : '', 'data-fv="foco" data-valor="acao"')}
      ${numeros}${barra}
      ${semNada ? vazioLinha('Nenhuma conta neste período.', `<button type="button" class="fv2-btn s" data-vc="conta">Lançar a primeira</button>${falta.botao}`)
        : `<div class="fv2-grade b">${acaoCard}${paraOnde}</div>${falta.botao ? `<div class="fv2-rodape">${falta.botao}</div>` : ''}`}
      ${falta.nota}</div></div>`;
  }

  // ----- Inadimplência -----
  function inadimplencia(ctx) {
    anfitriao = ctx;
    const u = ui.ina, d = ctx.d || {}, hoje = d.hoje || hojeBahia(), f = estado('comercial', hoje.slice(0, 7))?.dados, real = f?.conectado ? f.inadimplencia : null;
    // Com o Vybe Finanças ligado, os números e os clientes vêm dele; as faturas com baixa no Vybe OS continuam nas linhas.
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
      { rotulo: 'Críticos · +30 dias', valor: n0(criticos.length), tom: criticos.length ? 'r' : 'g', attrs: real ? '' : 'data-espiar="comercial:inadimplencia:criticos"',
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
            ${doFin(x.id) ? '<small class="fv2-sub">Dê baixa no Vybe Finanças</small>' : `${uma ? '' : botaoRecebi(x)}<button type="button" class="fv2-btn s" data-vc="receber" data-id="${esc(x.id)}">Recebi uma parte</button>`}</div>`).join('')
          : '<p class="fv2-hist">A baixa destes lançamentos é no Vybe Finanças</p>');
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
    return `<div class="fv2 d3f" data-tela="ina"><div class="fv2-in">
      ${topo({ titulo: 'Inadimplência', acoes: comoFunciona + '<button type="button" class="fv2-btn" data-fv="ir" data-valor="recebimentos">Ver recebimentos</button>', extra: `<span class="d3f-data">${esc(diaDeHoje(hoje))}</span>${real ? '<span class="fv2-pill b">Vybe Finanças</span>' : fonte(d)}` })}
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
      ...(ligado ? [['Folha do mês (Vybe Finanças)', rs(ligado.folha?.total)], ['Custos fixos (Vybe Finanças)', rs(ligado.custos_fixos?.total)], ['Outras despesas (Vybe Finanças)', rs(R.despesas_sem_folha ?? ligado.despesas?.total)]] : [])];
    const acaoHtml = `<div class="v2-abre fv2-conta" data-linha="conta" aria-expanded="${u.conta}">${acao('Vorcaro · Tesouraria', frase, semDado ? '' : 'Ver a conta', `data-fv="conta" aria-expanded="${u.conta}"`)}
      <div class="v2-mais"><div><dl class="fv2-dl">${conta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div></div></div>`;
    // Para onde saiu: os grupos de contas (ou as categorias do Vybe Finanças), do maior para o menor.
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
    if (L.vf && L.vf.conectado === false) itens.push(simples(pilula('Ligar', 'n'), '<b>Controle financeiro</b> · valores reais', '', '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="financas">Ver como</button>'));
    const semContrato = (L.porCliente?.clientes || []).filter((c) => !(Number(c.valor_mensal) > 0)).length;
    if (semContrato) itens.push(simples(pilula('Contrato', 'n'), `<b>${quantos(semContrato, 'cliente', 'clientes')}</b> sem contrato informado`, '', '<button type="button" class="fv2-btn s" data-fv="ir" data-valor="financas">Informar</button>'));
    const cabe = u.inteira ? itens : itens.slice(0, 5);
    // Rodapé do quadro D3-FinVisao: "Sócios avisados" (o sistema ainda não registra aviso aos sócios, então fica o vazio)
    // e o dia da folha quando o Vybe Finanças manda.
    const diaFolha = (ligado?.folha?.funcionarios || []).map((f) => Number(f.dia_pagamento)).filter((n) => n > 0).sort((a, b) => a - b)[0];
    const socios = `${sociosAvisados(L.ina?.avisos)}${diaFolha ? `<span class="fv2-sub d3f-folha">folha · dia ${n0(diaFolha)}</span>` : ''}`;
    const acaoCard = cartao({ titulo: 'Pede ação', rotulo: 'acao', cls: 'd3f-pede', sub: itens.length ? `${quantos(itens.length, 'coisa', 'coisas')}, na ordem` : '', corpo: cabe.join('') || '<p class="fv2-nada">Nada pedindo ação agora.</p>',
      pe: maisHtml(itens.length - cabe.length, '', 'mostrar', 'vis') + socios });
    // Caixa: três meses atrás (o que entrou), o mês de agora e três à frente (projeção dos recorrentes), numa linha só.
    const serie = new Map((ligado?.series || L.vf?.series || []).map((s) => [s.mes, Number(s.faturamento) || 0]));
    const prev = L.cx?.previsao?.meses || [];
    const colunas = [...L.passados.map((p) => ({ mes: p.mes, valor: serie.has(p.mes) ? serie.get(p.mes) : Number(p.dados?.resumo?.atual?.recebido) || 0, tipo: 'antes' })),
      ...[0, 1, 2, 3].map((n) => { const m = somaMes(atual, n), x = prev.find((y) => y.mes === m); return { mes: m, valor: Number(x?.entradas) || 0, tipo: n ? 'depois' : 'agora' }; })];
    const temCaixa = colunas.some((c) => c.valor > 0), agora = colunas[3];
    const caixa = cartao({ titulo: 'Caixa', rotulo: 'caixa', cls: 'fv2-caixa', sub: temCaixa ? `<b class="d3f-caixa-v">${mil(agora.valor)}</b><span class="d3f-leg"><i></i>realizado</span><span class="d3f-leg proj"><i></i>projeção</span>` : '',
      corpo: temCaixa ? `${linhaDupla(colunas.slice(0, 4).map((c) => c.valor), colunas.slice(3).map((c) => c.valor), { rotulo: `Entradas de ${colunas.map((c) => `${mesDe(c.mes + '-01')} ${mil(c.valor)}`).join(', ')}; de ${mesDe(colunas[4].mes + '-01')} em diante é projeção` })}
          <div class="d3f-eixo">${colunas.map((c) => (c.tipo === 'agora' ? `<b>${esc(mes3(c.mes + '-01'))}</b>` : `<span>${esc(mes3(c.mes + '-01'))}</span>`)).join('')}</div>`
        : '<p class="fv2-nada">O caixa aparece com o primeiro recebimento recorrente.</p>' });
    const saiuPor = grupos.length ? cartao({ titulo: 'Saiu por grupo', rotulo: 'grupos', sub: mil(aSair), corpo: grupos.slice(0, 5).map((g) => barraGrupo(`<b>${esc(g.nome)}</b>`, g.fatia, mil(g.total))).join('') }) : '';
    // Atalhos com a contagem do que pede ação em cada tela.
    const contagem = { recebimentos: [(L.rec?.recebiveis || []).filter((x) => !x.cancelado).length, ''], contas: [(L.con?.contas || []).filter((c) => !c.cancelada).length, ''],
      inadimplencia: [atrasados.length, 'r'], extrato: [aConferir, 'a'], vorcaro: [pendentes.length, 'a'] };
    const subs = (ctx.subs || []).map((s) => { const [n, tom] = contagem[s.id] || [0, '']; return `<button type="button" class="fv2-chip" data-fv="ir" data-valor="${esc(s.id)}">${esc(s.nome)}${s.url ? ' ↗' : ''}${n ? ` <b${tom ? ` class="${tom}"` : ''}>${n0(n)}</b>` : ''}</button>`; }).join('');
    const seg = [['anterior', maiuscula(mesDe(somaMes(atual, -1) + '-01'))], ['atual', maiuscula(mesDe(atual + '-01'))], ['ano', 'Ano']];
    return `<div class="fv2 d3f" data-tela="vis"><div class="fv2-in">
      ${topo({ titulo: 'Finanças', trilha: false, extra: `<span class="d3f-data">${esc(diaDeHoje(hoje))}</span>${ligado ? '<span class="fv2-pill b">Vybe Finanças</span>' : ''}`, meio: `<span class="fv2-seg" role="group" aria-label="Período">${seg.map(([k, n]) => `<button type="button" data-fv="per" data-valor="${k}" aria-pressed="${u.per === k}">${esc(n)}</button>`).join('')}</span>`,
        acoes: `<span class="fv2-lancar"><button type="button" class="fv2-btn p" data-fv="lancar" aria-expanded="${u.lancar}">${IC.mais}Lançar</button>${u.lancar ? '<span class="fv2-menu" role="menu"><button type="button" role="menuitem" data-fv="novo" data-valor="recebimentos">Recebimento</button><button type="button" role="menuitem" data-fv="novo" data-valor="contas">Conta a pagar</button></span>' : ''}</span>` })}
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
    // Forma de pagamento da fatura (tocar na escolhida tira) e o aviso aos sócios: só registro + o sino do Vybe OS.
    if (acao === 'forma') return baixa(b, { acao: 'recebivel_forma', id: b.dataset.id, forma: valor }, valor ? (FORMA_NOME[valor] || valor) : 'Sem forma');
    if (acao === 'avisar') return baixa(b, { acao: 'inadimplencia_avisar', cliente_id: b.dataset.clienteId || '', cliente_nome: b.dataset.clienteNome || '', atraso_dias: Number(b.dataset.atraso) || 0 }, 'Avisado');
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', aoClicar);
    document.addEventListener('click', (ev) => { if (ui.vis.lancar && !ev.target.closest?.('.fv2-lancar')) { ui.vis.lancar = false; repintarVisao(); } });
  }
  const telas = Object.freeze({ recebimentos, contas, inadimplencia, visao, _teste: { ui, visaoHtml, lidas } });

  window.VybeFinancas = Object.freeze({ carregar, estado, ligado, contratosDaCarteira, contratoDoCliente, telas });
})();
