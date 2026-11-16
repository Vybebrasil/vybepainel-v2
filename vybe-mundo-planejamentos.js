// Planejamentos no Irecity: o Centro de Operação sem a sala do Habbo (Paulo, 07/11/2026: "o planejamento que eu
// tinha feito na sala de operação quando abria cada cliente… abria pra aprovar de vários modos, editar, corrigir,
// mandava direto pro zap com o aviso pro hub pro cliente aprovar… preciso disso nesse novo também").
// A porta de entrada era o agente de cada cliente na sala Operação. Aqui vira um módulo: uma linha por cliente
// (mesma rota area=planejamentos&acao=operacao), com o estado do planejamento do mês, o placar da revisão e os
// avisos das peças. Abrir usa a MESMA janela de sempre (vybe-planejamentos.js: abrirPlanejamento): documento em
// tela cheia, editar, revisar peça a peça, histórico, marca do cliente, aprovar e enviar ao cliente pelo WhatsApp
// com o aviso do Hub. Nada de lógica nova de planejamento aqui: só a entrada e a visão da carteira.
(function () {
  // Cliente com a cor da carteira (cliCor de vybe-core.js); fora do painel (testes), o nome escapado.
  function cliCor(n) { const g = globalThis.cliCor; return typeof g === 'function' && g !== cliCor ? g(n) : String(n ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  // No padrão v2 o cliente é bolinha na cor da carteira e nome escuro: a cor fica na bolinha, o nome ganha a própria caixa.
  const cliPonto = (n) => cliCor(n).replace(/>([^<>]*)<\/span>$/, '><span class="p2-nome">$1</span></span>');
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Cabeçalho único da janela (vbCabecalhoHtml e vbFecharHtml, vybe-core.js). Sem o vybe-core (testes), só o título e as ações.
  const cabecalho = (o) => (typeof window !== 'undefined' && typeof window.vbCabecalhoHtml === 'function' ? window.vbCabecalhoHtml(o) : `<h2${o.id ? ` id="${o.id}"` : ''}>${esc(o.titulo)}</h2>${o.texto ? `<p>${esc(o.texto)}</p>` : ''}${o.acoes || ''}`);
  const botaoX = (attr, classe = '') => (typeof window !== 'undefined' && typeof window.vbFecharHtml === 'function' ? window.vbFecharHtml(attr, classe) : `<button type="button" class="vb-janela-x ${classe}" ${attr} aria-label="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`);
  // Padrão v2 (quadro "Planejamentos" do moodboard, 12/11/2026): a janela inteira segue o quadro. Título, mês e "Novo
  // planejamento" no alto; a frase do Augusto; três números; busca e fichas; e um cartão só, com "Pede ação" primeiro
  // (a primeira linha abre no lugar com as etapas) e uma linha por cliente depois.
  const ESTADOS = {
    revisar: ['Para revisar', 'v'], ajustes: ['Ajustes pedidos', 'a'], aprovado: ['Aprovado', 'g'],
    enviado: ['Com o cliente', 'b'], cadastrado: ['Peças cadastradas', 'g'], rascunho: ['Rascunho', 'n'],
  };
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const mesTxt = (m) => { const x = String(m || '').slice(0, 7).split('-'); return x.length === 2 ? `${MES[Number(x[1]) - 1] || ''}/${x[0].slice(2)}` : ''; };
  const mesNome = (m) => MES_NOME[Number(String(m || '').slice(5, 7)) - 1] || '';
  const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const MAX_LINHAS = 6;
  const CERTO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  let estado = { postos: [], filtro: 'todos', mes: '', busca: '', situacao: '', filtros: false, todos: false, aberta: null, carregando: false, erro: '' };
  let janela = null;

  function criarJanela() {
    janela = document.createElement('section');
    janela.id = 'vv-planejamentos';
    janela.className = 'vv-plj';
    janela.setAttribute('role', 'dialog');
    janela.setAttribute('aria-label', 'Planejamentos');
    janela.hidden = true;
    document.body.append(janela);
    janela.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) { const l = ev.target.closest('[data-plj-linha]'); if (l && !ev.target.closest('a,input,summary')) { estado.aberta = l.getAttribute('aria-expanded') === 'true' ? '' : l.dataset.pljLinha; pintarLista(); } return; }
      if (b.dataset.pljFechar !== undefined) return fechar();
      if (b.dataset.pljFiltro) { estado.filtro = b.dataset.pljFiltro; estado.todos = false; return pintar(); }
      if (b.dataset.pljMes) { estado.mes = b.dataset.pljMes; estado.aberta = null; return pintar(); }
      if (b.dataset.pljSituacao !== undefined) { estado.situacao = b.dataset.pljSituacao; return pintar(); }
      if (b.dataset.pljFiltros !== undefined) { estado.filtros = !estado.filtros; if (!estado.filtros) estado.situacao = ''; return pintar(); }
      if (b.dataset.pljMostrar !== undefined) { estado.todos = !estado.todos; return pintarLista(); }
      if (b.dataset.pljCriar !== undefined) { estado.aberta = estado.aberta === 'sem' ? '' : 'sem'; return pintarLista(); }
      if (b.dataset.pljAbrir) { if (typeof window.abrirPlanejamento === 'function') window.abrirPlanejamento(b.dataset.pljAbrir, b.dataset.pljAba || 'documento'); return; }
      if (b.dataset.pljNovo) { b.closest('details')?.removeAttribute('open'); if (typeof window.novoPlanejamento === 'function') window.novoPlanejamento(b.dataset.pljNovo, b.dataset.pljNome || ''); return; }
      if (b.dataset.pljRecarregar !== undefined) carregar();
    });
    // A busca refaz só o cartão da lista: o campo fica onde está e o cursor não pula.
    janela.addEventListener('input', (ev) => { if (ev.target.matches?.('[data-plj-busca]')) { estado.busca = ev.target.value; pintarLista(); } });
    // O planejamento aberto por cima (#workflow-modal, que não ganha a classe "open") fecha primeiro com o próprio Esc.
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !ev.defaultPrevented && janela && !janela.hidden && !document.querySelector('#workflow-modal, #cli-pergunta, #vb-apagar')) fechar(); });
  }

  // Ordem: o que pede ação primeiro (ajustes do cliente, depois para revisar), com planejamento antes de sem.
  const PESO = { ajustes: 0, revisar: 1, rascunho: 2, aprovado: 3, enviado: 4, cadastrado: 5 };
  function ordenar(lista) {
    return [...lista].sort((a, b) => (PESO[a.planejamento?.estado] ?? 9) - (PESO[b.planejamento?.estado] ?? 9) || String(a.cliente).localeCompare(String(b.cliente), 'pt-BR'));
  }
  const pedeAcao = (p) => ['revisar', 'ajustes'].includes(p.planejamento?.estado);
  function filtrar(lista) {
    const f = estado.filtro;
    if (f === 'meus') return lista.filter((p) => p.meu);
    if (f === 'acao') return lista.filter(pedeAcao);
    if (f === 'sem') return lista.filter((p) => !p.planejamento);
    return lista;
  }
  // Meses que têm planejamento, do mais antigo ao mais novo; a janela abre no mais novo. Cliente com planejamento de
  // outro mês conta como sem planejamento no mês escolhido.
  const mesesDe = (postos) => [...new Set(postos.map((p) => String(p.planejamento?.mes || '').slice(0, 7)).filter(Boolean))].sort();
  const mesesVizinhos = (agora = new Date()) => [0, 1].map((n) => { const d = new Date(agora.getFullYear(), agora.getMonth() + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const noMes = (postos, mes) => postos.map((p) => (p.planejamento && mes && String(p.planejamento.mes || '').slice(0, 7) !== mes ? { ...p, planejamento: null, alertas: null } : p));

  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Os avisos das peças em pílulas curtas ("1 atrasada", "1 aprovar", "1 sem info"); só o atraso vai em vermelho.
  function avisosHtml(p) {
    const a = p.alertas || {};
    return [['atrasadas', ['atrasada', 'atrasadas']], ['aprovar', 'aprovar'], ['sem_info', 'sem info']]
      .map(([k, t]) => { const q = (a[k] || []).length; return q ? `<span class="d3pl-av${k === 'atrasadas' ? ' r' : ''}">${q} ${Array.isArray(t) ? t[q === 1 ? 0 : 1] : t}</span>` : ''; }).join('');
  }
  // Status em pílula clara com a bolinha; cheia só em Ajustes pedidos (âmbar) e no que fechou (verde).
  const PONTO = { v: '#E0A21B', b: '#3B82F6', n: '#B5AFA5' };
  const pilula = (rot, cor) => (PONTO[cor] ? `<span class="d3pl-pill"><i style="--c:${PONTO[cor]}"></i>${esc(rot)}</span>` : `<span class="d3pl-pill ${cor}">${esc(rot)}</span>`);
  // Onde o planejamento está, pelas etapas de sempre: escrito, revisado, enviado, (ajustes), aprovado.
  function etapasHtml(pl) {
    const feitas = { rascunho: 0, revisar: 1, enviado: 3, ajustes: 3, aprovado: 9, cadastrado: 9 }[pl.estado] ?? 0;
    const nomes = ['Escrito', 'Revisado', 'Enviado ao cliente', ...(pl.estado === 'ajustes' ? [`Ajustes da versão ${pl.versao || 1}`] : []), 'Aprovado pelo cliente'];
    return nomes.map((n, i) => `<span class="p2-etp"><i class="p2-cx${i < feitas ? ' ok' : i === feitas ? ' at' : ''}">${i < feitas ? CERTO : ''}</i>${esc(n)}</span>`).join('');
  }
  const cliente = (p) => `<span class="p2-c1">${cliPonto(p.cliente)}${p.segmento ? ` <span class="p2-seg2">· ${esc(p.segmento)}</span>` : ''}</span>`;
  // Direção 3 (quadro D3-Planejamentos): uma tabela só, com Cliente, Versão, Status, Peças, Com OK e os botões; "Pede
  // ação" e "Com planejamento" viram faixas de seção.
  function linha(p, { acao = false, aberta = false } = {}) {
    const pl = p.planejamento, [rot, cor] = ESTADOS[pl.estado] || [pl.estado, 'n'];
    const r = pl.revisao || {}, n = Number(r.total) || 0, ok = Number(r.head_ok) || 0, avisos = avisosHtml(p);
    const pecas = r.total == null ? '' : `<span class="d3pl-n">${n} ${n === 1 ? 'peça' : 'peças'}</span>`;
    const emDia = !avisos && p.alertas ? '<span class="d3pl-n">em dia</span>' : '';
    const barra = n ? `<span class="p2-c5 d3pl-ok"><span class="d3-barra" role="img" aria-label="${ok} de ${n} peças com o OK do head" style="--v:${Math.round(ok / n * 100)}%"><i class="${ok === n ? 'g' : ''}"></i></span><small>${ok}/${n}</small></span>` : '<span class="p2-c5 d3pl-ok"></span>';
    const edita = !['aprovado', 'cadastrado'].includes(pl.estado);
    const meio = `${cliente(p)}<span class="p2-c2">${esc(mesTxt(pl.mes))} · v${esc(pl.versao || 1)}</span><span class="p2-c3">${pilula(rot, cor)}</span><p class="d3pl-pecas">${pecas}${avisos || emDia}</p>${barra}`;
    if (!acao) return `<div class="p2-lin d3pl-lin">${meio}<span class="d3pl-bts"><button type="button" class="p2-btn s" data-plj-abrir="${esc(pl.id)}">Abrir</button></span></div>`;
    return `<div class="v2-abre p2-abre d3pl-abre" data-plj-linha="${esc(pl.id)}" aria-expanded="${aberta}">
      <div class="p2-lin d3pl-lin">${meio}<span class="d3pl-bts"><button type="button" class="p2-btn s" data-plj-abrir="${esc(pl.id)}" data-plj-aba="historico">Histórico</button>${edita ? `<button type="button" class="p2-btn s k" data-plj-abrir="${esc(pl.id)}" data-plj-aba="editar">Editar e revisar</button>` : ''}</span></div>
      <div class="v2-mais"><div><div class="p2-det">${etapasHtml(pl)}<span class="p2-vao"></span><button type="button" class="p2-btn s" data-plj-abrir="${esc(pl.id)}">Abrir como documento</button></div></div></div></div>`;
  }
  // Todo botão que começa um planejamento diz o verbo e o cliente no nome acessível.
  const rotuloNovo = (p) => `aria-label="Começar o planejamento de ${esc(p.cliente)}"`;
  const comecar = (p) => `<button type="button" class="p2-btn s" data-plj-novo="${esc(p.cliente_id)}" data-plj-nome="${esc(p.cliente)}" ${rotuloNovo(p)}>Começar planejamento</button>`;
  const linhaSem = (p, mes) => `<div class="p2-lin d3pl-lin">${cliente(p)}<span class="p2-c2">${esc(mesTxt(mes))}</span><span class="p2-c3">${pilula('Sem planejamento', 'n')}</span><p class="d3pl-pecas"><span class="d3pl-n">não publicado</span></p><span class="p2-c5 d3pl-ok"></span><span class="d3pl-bts">${comecar(p)}</span></div>`;
  // Todos os clientes sem planejamento numa linha só; "Criar" abre ali mesmo a lista, um "Começar planejamento" por cliente.
  function linhaSemResumo(sem, mes) {
    const n = sem.length;
    const topo = `<span class="p2-c1"><b>Sem planejamento</b></span><span class="p2-c2">${esc(mesTxt(mes))}</span><span class="p2-c3"><span class="d3pl-pill r">${n} ${n === 1 ? 'cliente' : 'clientes'}</span></span><p class="p2-corta d3pl-nomes">${sem.map((p) => cliPonto(p.cliente)).join('')}</p><span class="p2-c5 d3pl-ok"></span>`;
    if (n === 1) return `<div class="p2-lin d3pl-lin">${topo}<span class="d3pl-bts">${comecar(sem[0])}</span></div>`;
    return `<div class="v2-abre p2-abre d3pl-abre" aria-expanded="${estado.aberta === 'sem'}"><div class="p2-lin d3pl-lin">${topo}<span class="d3pl-bts"><button type="button" class="p2-btn s k" data-plj-criar aria-expanded="${estado.aberta === 'sem'}">Criar os ${n}</button></span></div>
      <div class="v2-mais"><div><div class="p2-det p2-det-sem">${sem.map((p) => `<span class="p2-etp">${cliPonto(p.cliente)}${comecar(p)}</span>`).join('')}</div></div></div></div>`;
  }

  function contas() {
    const comPlano = mesesDe(estado.postos);
    // Direção 3: o seletor é um segmento com os meses. Entram o mês corrente e o próximo, além dos que já têm
    // planejamento; a janela continua abrindo no mês mais novo que tem planejamento.
    const meses = [...new Set([...comPlano, ...mesesVizinhos()])].sort();
    if (!meses.includes(estado.mes)) estado.mes = comPlano[comPlano.length - 1] || meses[meses.length - 1] || '';
    const todos = ordenar(noMes(estado.postos, estado.mes));
    return { meses, todos, contar: { acao: todos.filter(pedeAcao).length, sem: todos.filter((p) => !p.planejamento).length, meus: todos.filter((p) => p.meu).length, todos: todos.length } };
  }
  function listaHtml({ todos }) {
    if (estado.carregando) return '<p class="p2-vazio">Buscando os planejamentos…</p>';
    if (estado.erro) return `<p class="p2-vazio">Não foi possível buscar: ${esc(estado.erro)} <button type="button" class="p2-btn s" data-plj-recarregar>Tentar de novo</button></p>`;
    const q = norm(estado.busca).trim();
    const lista = filtrar(todos).filter((p) => (!q || norm(`${p.cliente} ${p.segmento || ''}`).includes(q)) && (!estado.situacao || p.planejamento?.estado === estado.situacao));
    if (!lista.length) return '<p class="p2-vazio">Nada aqui agora.</p>';
    const acao = lista.filter(pedeAcao), sem = lista.filter((p) => !p.planejamento), resto = lista.filter((p) => p.planejamento && !pedeAcao(p));
    const soSem = estado.filtro === 'sem' || estado.todos || Boolean(q);
    const coisas = acao.length + (sem.length && !soSem ? 1 : 0);
    // Sem escolha de quem usa, a primeira linha de "Pede ação" já vem aberta.
    const aberta = estado.aberta == null ? String(acao[0]?.planejamento.id || '') : estado.aberta;
    const visiveis = estado.todos || q ? resto : resto.slice(0, MAX_LINHAS), fora = resto.length - visiveis.length, prim = resto[visiveis.length];
    const titulo = coisas ? 'Pede ação' : ({ meus: 'Meus clientes', sem: 'Sem planejamento' }[estado.filtro] || 'Todos em dia');
    const fora2 = fora && prim ? ` · ${esc(prim.cliente)}${fora > 1 ? '…' : ''}` : '';
    const mostrar = fora || estado.todos ? `<p class="p2-sub p2-pe">${fora ? `+${fora}${fora2} · ` : ''}<button type="button" class="p2-link" data-plj-mostrar>${estado.todos ? 'recolher' : 'mostrar'}</button></p>` : '';
    const secao = (nome, n, tom, sub = '') => `<div class="d3pl-sec ${tom}"><h3>${nome}</h3><span>${n}${sub}</span></div>`;
    const cab = '<div class="d3pl-cab" aria-hidden="true"><span>Cliente</span><span>Versão</span><span>Status</span><span>Peças</span><span>OK do head</span><span></span></div>';
    const com = [...visiveis.map((p) => linha(p)), ...(soSem ? sem.map((p) => linhaSem(p, estado.mes)) : [])];
    return `${cab}${acao.length ? `${secao(titulo, acao.length, 'a', ' na ordem')}${acao.map((p) => linha(p, { acao: true, aberta: String(p.planejamento.id) === aberta })).join('')}` : ''}
      ${sem.length && !soSem ? linhaSemResumo(sem, estado.mes) : ''}
      ${com.length ? `${secao(acao.length ? 'Com planejamento' : titulo, resto.length + (soSem ? sem.length : 0), 'g')}${com.join('')}` : ''}
      ${mostrar}`;
  }
  function pintarLista() {
    if (v2()) { const l = janela?.querySelector('#plj2-lista'); if (l) l.innerHTML = lista2Html(contas()); return; }
    const c = janela?.querySelector('.p2-lista'); if (c) c.innerHTML = listaHtml(contas());
  }

  function pintar() {
    if (!janela) return;
    // Direção V2 (prancha V2-M-Planejamentos): no computador, o esqueleto novo (pintarV2, logo abaixo).
    if (v2()) return pintarV2();
    janela.classList?.remove('d3m-c-janela');
    const C = contas(), { meses, todos, contar } = C, com = contar.todos - contar.sem, mes = estado.mes, nomeMes = mesNome(mes);
    const ficha = (id, t) => `<button type="button" class="p2-chip" data-plj-filtro="${id}" aria-pressed="${estado.filtro === id}">${t} <b>${contar[id]}</b></button>`;
    const prim = todos.find(pedeAcao), semLista = todos.filter((p) => !p.planejamento);
    const novo = `<details class="p2-menu"><summary class="p2-btn d3pl-novo">+ Novo planejamento</summary><div class="p2-menu-pop" role="menu" aria-label="Para qual cliente">
        ${[...semLista, ...todos.filter((p) => p.planejamento)].map((p) => `<button type="button" role="menuitem" data-plj-novo="${esc(p.cliente_id)}" data-plj-nome="${esc(p.cliente)}" ${rotuloNovo(p)}>${esc(p.cliente)}${p.planejamento ? '' : '<small>sem planejamento</small>'}</button>`).join('') || '<p class="p2-sub">Nenhum cliente carregado.</p>'}</div></details>`;
    const seg = meses.length ? `<span class="p2-seg" role="group" aria-label="Mês">${meses.map((m) => `<button type="button" data-plj-mes="${m}" aria-pressed="${m === mes}">${maiuscula(mesNome(m))}</button>`).join('')}</span>` : '';
    const pronto = !estado.carregando && !estado.erro && todos.length;
    // Direção 3: a frase do Augusto vira o bloco de ação laranja, com o botão que abre o primeiro que pede ação.
    const quem = '<small class="d3pl-quem">Augusto · Copy</small>';
    const frase = prim ? `${esc(prim.cliente)} ${prim.planejamento.estado === 'ajustes' ? `pediu ajustes na versão ${esc(prim.planejamento.versao || 1)}` : 'espera a revisão'}.${contar.sem ? ` ${contar.sem} sem planejamento.` : ''}`
      : contar.sem ? `${contar.sem} ${contar.sem === 1 ? 'cliente' : 'clientes'} sem planejamento${nomeMes ? ' de ' + nomeMes : ''}.` : `Todos com planejamento${nomeMes ? ' de ' + nomeMes : ''}.`;
    const semUm = !prim && contar.sem === 1 ? todos.find((p) => !p.planejamento) : null;
    const fala = !pronto || typeof window.d3AcaoHtml !== 'function' ? '' : window.d3AcaoHtml({ agente: 'A', frase: `${quem}<span>${frase}</span>`,
      botao: prim ? `Abrir o ${prim.cliente}` : semUm ? 'Começar' : contar.sem ? `Criar os ${contar.sem}` : '',
      attrs: prim ? `data-plj-abrir="${esc(prim.planejamento.id)}"` : semUm ? `data-plj-novo="${esc(semUm.cliente_id)}" data-plj-nome="${esc(semUm.cliente)}" ${rotuloNovo(semUm)}` : 'data-plj-criar' });
    const ajustes = todos.filter((p) => p.planejamento?.estado === 'ajustes').length, revisar = contar.acao - ajustes;
    const num = (o, pe = '') => (typeof window.d3NumHtml === 'function' ? window.d3NumHtml(o).replace(/<\/(div|button)>$/, `${pe ? `<span class="d3pl-pe">${pe}</span>` : ''}</$1>`) : '');
    const aprovar = todos.filter((p) => (p.alertas?.aprovar || []).length), nAprovar = aprovar.reduce((s, p) => s + p.alertas.aprovar.length, 0);
    const kpis = !pronto ? '' : `<div class="d3pl-nums">
        ${num({ rotulo: 'Com planejamento', valor: `${com}<small> / ${contar.todos}</small>`, barra: com / contar.todos * 100 }, nomeMes ? `${nomeMes} de ${mes.slice(0, 4)}` : 'sem mês publicado')}
        ${num({ rotulo: 'Pedem ação', valor: String(contar.acao), tom: contar.acao ? 'a' : '', attrs: 'data-plj-filtro="acao"' }, [ajustes ? `${ajustes === 1 ? 'ajuste' : 'ajustes'}${prim?.planejamento.estado === 'ajustes' ? ' · ' + esc(prim.cliente) : ''}` : '', revisar ? `${revisar} revisar` : ''].filter(Boolean).join(' · ') || 'nada esperando')}
        ${num({ rotulo: 'Sem planejamento', valor: String(contar.sem), tom: contar.sem ? 'r' : '', attrs: 'data-plj-filtro="sem"' }, contar.sem ? `nada para ${nomeMes || 'o mês'}` : 'todos com')}
        ${num({ rotulo: 'Peças para aprovar', valor: String(nAprovar) }, aprovar.length ? `em ${aprovar.length} ${aprovar.length === 1 ? 'cliente' : 'clientes'}` : 'nenhuma')}</div>`;
    const sit = (id, t) => `<button type="button" class="p2-chip" data-plj-situacao="${id}" aria-pressed="${estado.situacao === id}">${t}</button>`;
    const barra = `<div class="p2-filtros"><label class="p2-oculto" for="plj-busca">Buscar cliente</label><input id="plj-busca" class="p2-busca" type="search" placeholder="Buscar cliente" data-plj-busca value="${esc(estado.busca)}">
        ${ficha('meus', 'Meus clientes')}${ficha('acao', 'Pedem ação')}${ficha('sem', 'Sem planejamento')}${ficha('todos', 'Todos')}
        <button type="button" class="p2-btn s" data-plj-filtros aria-expanded="${estado.filtros}"${estado.filtros ? ' aria-pressed="true"' : ''}>Filtros</button></div>
      ${estado.filtros ? `<div class="p2-filtros p2-filtros-mais" role="group" aria-label="Situação do planejamento"><span class="p2-sub">Situação</span>${sit('', 'Todas')}${Object.entries(ESTADOS).map(([id, [t]]) => sit(id, t)).join('')}</div>` : ''}`;
    janela.innerHTML = `<div class="vv-plj-cabeca vb-janela-topo">${cabecalho({ titulo: 'Planejamentos', acoes: `${seg}${novo}${botaoX('data-plj-fechar')}` })}</div>
      ${fala}${kpis}${barra}
      <div class="p2-card p2-lista">${listaHtml(C)}</div>`;
  }

  // ─── Direção V2 · Planejamentos na prancha V2-M-Planejamentos (16/11/2026) ───────────────────
  // A janela vira vidro fumê. O mês inteiro numa folha: uma linha por cliente, na ordem do que pede você ("Agora"), do
  // que anda e do que falta, com a versão, a trilha do escrito ao aprovado, onde está, as peças e o OK do head. À direita,
  // no vidro: o cartão laranja do Augusto, o mês em números (cada linha filtra pela situação), o que dá para fazer de uma
  // vez e onde o cliente aprova. Os botões são os de sempre (data-plj-*): o nome abre o documento, a linha abre no lugar
  // com as etapas, Histórico e Editar e revisar; "Criar" começa o planejamento. Só no computador; no celular fica a tela
  // de antes (pintar), até a prancha do celular.
  const v2 = () => typeof window.matchMedia === 'function' && !window.matchMedia('(max-width: 700px)').matches;
  const IC2 = { mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>', lupa: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
    seta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>', pontos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="3" d="M6 12h.01M12 12h.01M18 12h.01"/></svg>', x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' };
  // Onde o planejamento está: o nome, a cor do ponto e quantos passos da trilha (de 5) já foram.
  const ONDE = { rascunho: ['Escrito', 'var(--d3-meta)', 0, ''], revisar: ['Para revisar', 'var(--d3-acao)', 1, 'a'], enviado: ['Com o cliente', 'var(--d3-agente)', 2, 'b'],
    ajustes: ['Ajustes pedidos', 'var(--d3-perigo)', 3, 'r'], aprovado: ['Aprovado', 'var(--d3-pronto)', 4, 'g'], cadastrado: ['Peças cadastradas', 'var(--d3-pronto)', 4, 'g'] };
  const foto2 = (nome) => (typeof pv2Foto === 'function' ? pv2Foto(nome) : `<i class="d3v-foto" aria-hidden="true">${esc(String(nome || '').trim().slice(0, 2).toUpperCase())}</i>`);
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  function trilha2(pl) {
    const [nome, , feitas, tom] = pl ? (ONDE[pl.estado] || [pl.estado, '', 0, '']) : ['sem planejamento', '', -1, ''];
    return `<span class="plj2-trilha" role="img" aria-label="${esc(pl ? `Etapa ${Math.min(feitas + 1, 5)} de 5: ${nome}` : 'Sem planejamento')}">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < feitas ? 'ok' : i === feitas ? `vez ${tom}` : ''}"></i>`).join('')}</span>`;
  }
  function linha2(p, grupo, aberta) {
    const pl = p.planejamento, [nome, cor] = ONDE[pl.estado] || [pl.estado, 'var(--d3-meta)'];
    const r = pl.revisao || {}, n = Number(r.total) || 0, ok = Number(r.head_ok) || 0, edita = !['aprovado', 'cadastrado'].includes(pl.estado);
    const head = `${p.meu ? '<span class="plj2-meu" title="Você é head deste cliente">você</span>' : ''}${n ? `<span title="${ok} de ${n} peças com o OK do head">${ok}/${n}</span>${ok === n ? `<span class="plj2-ok" aria-hidden="true">${CERTO}</span>` : ''}` : ''}`;
    const lin = `<div class="plj2-lin${aberta ? ' aberta' : ''}" data-plj-linha="${esc(pl.id)}" aria-expanded="${aberta}" title="Abrir as etapas no lugar">${grupo}${foto2(p.cliente)}
      <button type="button" class="plj2-nome" data-plj-abrir="${esc(pl.id)}" title="Abrir o planejamento de ${esc(p.cliente)}">${esc(p.cliente)}</button>
      <span class="plj2-ver">${esc(MES[Number(String(pl.mes || '').slice(5, 7)) - 1] || '')} · v${esc(pl.versao || 1)}</span>${trilha2(pl)}
      <span class="d3v-st" style="--st:${cor}"><i aria-hidden="true"></i>${esc(nome)}</span><span class="plj2-n">${r.total == null ? '' : plural(n, 'peça', 'peças')}</span><span class="plj2-head">${head}</span></div>`;
    if (!aberta) return lin;
    return `${lin}<div class="plj2-det"><span class="plj2-etapas">${etapasHtml(pl)}</span>${avisosHtml(p)}<span class="plj2-vao"></span>
      <button type="button" class="d3m-c-btn c" data-plj-abrir="${esc(pl.id)}" data-plj-aba="historico">Histórico</button>${edita ? `<button type="button" class="d3m-c-btn c" data-plj-abrir="${esc(pl.id)}" data-plj-aba="editar">Editar e revisar</button>` : ''}<button type="button" class="d3m-c-btn c k" data-plj-abrir="${esc(pl.id)}">Abrir como documento</button></div>`;
  }
  const linhaSem2 = (p, grupo, mes) => `<div class="plj2-lin sem">${grupo}${foto2(p.cliente)}<span class="plj2-nome">${esc(p.cliente)}</span><span class="plj2-ver">${esc(MES[Number(String(mes || '').slice(5, 7)) - 1] || '')}</span>${trilha2(null)}
      <span class="plj2-semtxt">sem planejamento</span><span class="plj2-n"></span><button type="button" class="plj2-criar" data-plj-novo="${esc(p.cliente_id)}" data-plj-nome="${esc(p.cliente)}" ${rotuloNovo(p)}>Criar</button></div>`;
  function lista2Html({ todos }) {
    if (estado.carregando) return '<p class="d3v-estado" role="status"><b>Buscando os planejamentos</b></p>';
    if (estado.erro) return `<p class="d3v-estado erro" role="alert"><b>Não foi possível buscar</b>${esc(estado.erro)}<button type="button" class="d3v-btn sec" data-plj-recarregar>Tentar de novo</button></p>`;
    const q = norm(estado.busca).trim();
    const lista = filtrar(todos).filter((p) => (!q || norm(`${p.cliente} ${p.segmento || ''}`).includes(q)) && (!estado.situacao || p.planejamento?.estado === estado.situacao));
    if (!todos.length) return '<p class="d3v-estado"><b>Nenhum cliente ativo</b>Os clientes aparecem aqui com o planejamento do mês.</p>';
    if (!lista.length) return `<p class="d3v-estado"><b>Nada com esse filtro</b>${q ? 'Confira a busca.' : 'Troque a ficha ou a situação.'}</p>`;
    const grupos = [['Agora', 'r', lista.filter(pedeAcao)], ['Andando', '', lista.filter((p) => p.planejamento && !pedeAcao(p))], ['Falta', 'a', lista.filter((p) => !p.planejamento)]];
    return grupos.map(([nome, tom, itens]) => itens.map((p, i) => { const g = `<span class="plj2-g ${tom}">${i ? '' : nome}</span>`;
      return p.planejamento ? linha2(p, g, String(p.planejamento.id) === String(estado.aberta || '')) : linhaSem2(p, g, estado.mes); }).join('')).join('');
  }
  function pintarV2() {
    const C = contas(), { meses, todos, contar } = C, com = contar.todos - contar.sem, mes = estado.mes, nomeMes = mesNome(mes), ano = String(mes || '').slice(0, 4);
    janela.classList.add('d3m-c-janela');
    const pronto = !estado.carregando && !estado.erro && todos.length;
    const prim = todos.find(pedeAcao), semLista = todos.filter((p) => !p.planejamento);
    const sub = pronto ? `${nomeMes ? `${nomeMes} de ${ano} · ` : ''}${com} de ${plural(contar.todos, 'cliente', 'clientes')} · ${contar.acao ? `${contar.acao} ${contar.acao === 1 ? 'pede' : 'pedem'} ação` : 'nada pedindo ação'}` : estado.erro ? 'não foi possível buscar' : 'buscando os planejamentos';
    const seg = meses.length ? `<span class="d3m-c-seg" role="radiogroup" aria-label="Mês">${meses.map((m) => `<button type="button" role="radio" data-plj-mes="${m}" aria-checked="${m === mes}">${maiuscula(mesNome(m))}</button>`).join('')}</span>` : '';
    const novo = `<details class="d3m-c-menu"><summary class="d3m-c-btn">${IC2.mais}Novo planejamento</summary><div class="d3m-c-pop dir" role="menu" aria-label="Para qual cliente">
        ${[...semLista, ...todos.filter((p) => p.planejamento)].map((p) => `<button type="button" role="menuitem" data-plj-novo="${esc(p.cliente_id)}" data-plj-nome="${esc(p.cliente)}" ${rotuloNovo(p)}>${esc(p.cliente)}${p.planejamento ? '' : '<small class="d3m-c-s">sem planejamento</small>'}</button>`).join('') || '<span class="d3m-c-pop-rot">Nenhum cliente carregado.</span>'}</div></details>`;
    const sit = (id, t) => `<button type="button" role="menuitemradio" data-plj-situacao="${id}" aria-checked="${estado.situacao === id}">${t}</button>`;
    const mais = `<details class="d3m-c-menu"><summary class="d3m-c-ico${estado.situacao ? ' on' : ''}" aria-label="Filtrar pela situação do planejamento" title="Filtrar pela situação">${IC2.pontos}</summary><div class="d3m-c-pop dir" role="menu" aria-label="Situação do planejamento">
        <span class="d3m-c-pop-rot">Situação</span>${sit('', 'Todas')}${Object.entries(ESTADOS).map(([id, [t]]) => sit(id, t)).join('')}</div></details>`;
    const titulo = typeof window.d3mcTrocaHtml === 'function' ? window.d3mcTrocaHtml('Planejamentos', 'producao', 'planejamentos') : '<b class="d3m-c-h" role="heading" aria-level="2">Planejamentos</b>';
    const topo = `<div class="d3m-c-topo"><div class="d3m-c-tit">${titulo}<span class="d3m-c-sub">${esc(sub)}</span></div>${seg}
      <label class="d3m-c-busca" title="Buscar cliente">${IC2.lupa}<input id="plj-busca" type="search" aria-label="Buscar cliente" autocomplete="off" placeholder="Buscar cliente" data-plj-busca value="${esc(estado.busca)}"></label>${mais}${novo}<button type="button" class="d3m-c-ico" data-plj-fechar aria-label="Fechar" title="Fechar">${IC2.x}</button></div>`;
    const ficha = (id, t) => `<button type="button" role="radio" data-plj-filtro="${id}" aria-checked="${estado.filtro === id}">${t} <b>${contar[id]}</b></button>`;
    const soma = (k) => todos.reduce((s, p) => s + (p.alertas?.[k] || []).length, 0), nAprovar = soma('aprovar'), nAtras = soma('atrasadas'), nInfo = soma('sem_info');
    const olho = [[nAprovar, 'peça para aprovar', 'peças para aprovar', ''], [nAtras, 'peça atrasada', 'peças atrasadas', 'r'], [nInfo, 'peça sem informação', 'peças sem informação', 'a']]
      .map(([n, um, varios, tom]) => `<span class="${n ? tom : ''}"><b>${n}</b> ${n === 1 ? um : varios}</span>`).join('');
    const folha = `<section class="d3m-c-folha plj2-folha" aria-label="Planejamentos do mês"><div class="d3m-c-folha-cab"><b class="d3m-c-h3" role="heading" aria-level="3">${nomeMes ? `${maiuscula(nomeMes)} de ${ano}` : 'Planejamentos'}${pronto ? ` <span>· ${com} de ${contar.todos} com planejamento</span>` : ''}</b>
        <span class="d3m-c-abas" role="radiogroup" aria-label="Mostrar">${ficha('todos', 'Todos')}${ficha('meus', 'Meus')}${ficha('acao', 'Pedem ação')}${ficha('sem', 'Sem planejamento')}</span></div>
      <div class="plj2-cab" aria-hidden="true"><span></span><span></span><span>Cliente</span><span>Versão</span><span>Escrito até aprovado</span><span>Onde está</span><span>Peças</span><span>OK do head</span></div>
      <div id="plj2-lista" class="plj2-lista">${lista2Html(C)}</div>
      ${pronto ? `<div class="plj2-pe"><span class="plj2-pe-rot">De olho</span>${olho}</div>` : ''}</section>`;
    // O cartão laranja: o primeiro que pede ação, ou os que faltam, ou tudo em dia.
    const bt = (txt, attrs, sec) => `<button type="button" class="d3m-btn l${sec ? ' s' : ''}" ${attrs}>${txt}</button>`;
    const semUm = !prim && contar.sem === 1 ? semLista[0] : null, a = prim?.alertas || {};
    const avisos = prim ? [[a.atrasadas, 'peça atrasada', 'peças atrasadas'], [a.aprovar, 'para aprovar', 'para aprovar'], [a.sem_info, 'sem informação', 'sem informação']].filter(([l]) => (l || []).length).map(([l, um, varios]) => `${l.length} ${l.length === 1 ? um : varios}`).join(' · ') : '';
    const c = prim ? { frase: `${esc(prim.cliente)} ${prim.planejamento.estado === 'ajustes' ? `pediu ajustes na versão ${esc(prim.planejamento.versao || 1)}` : 'espera a revisão'}`, sub: avisos ? `${avisos}.` : prim.planejamento.estado === 'ajustes' ? 'O cliente devolveu: ajuste e mande de novo.' : 'Revise peça a peça e mande ao cliente.',
        bts: bt(`Abrir a versão ${esc(prim.planejamento.versao || 1)}`, `data-plj-abrir="${esc(prim.planejamento.id)}"`) + bt(prim.planejamento.estado === 'ajustes' ? 'Ver os ajustes' : 'Editar e revisar', `data-plj-abrir="${esc(prim.planejamento.id)}" data-plj-aba="editar"`, true) }
      : contar.sem ? { frase: `${plural(contar.sem, 'cliente', 'clientes')} sem planejamento${nomeMes ? ` de ${nomeMes}` : ''}`, sub: 'Sem planejamento não há peça para cadastrar.',
        bts: semUm ? `<button type="button" class="d3m-btn l" data-plj-novo="${esc(semUm.cliente_id)}" data-plj-nome="${esc(semUm.cliente)}" ${rotuloNovo(semUm)}>Começar</button>` : bt(`Ver os ${contar.sem}`, 'data-plj-filtro="sem"') }
      : { frase: `Todos com planejamento${nomeMes ? ` de ${nomeMes}` : ''}`, sub: 'Nada esperando revisão nem ajuste.', bts: '' };
    const laranja = !pronto ? '' : `<section class="d3m-laranja plj2-laranja" aria-label="O que pede você agora"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">A</span>Augusto · o que trava ${esc(nomeMes || 'o mês')}</span>
        <div class="d3m-lar-txt"><b class="d3-acao-frase">${c.frase}</b><small class="d3m-c-s">${c.sub}</small></div>${c.bts ? `<div class="d3m-lar-bts">${c.bts}</div>` : ''}</section>`;
    // O mês em números: cada linha filtra a lista pela situação (a de "sem planejamento" troca a ficha).
    const conta = (ids) => todos.filter((p) => ids.includes(p.planejamento?.estado)).length;
    const dist = [['aprovado', 'Aprovados', conta(['aprovado']), ''], ['cadastrado', 'Peças cadastradas', conta(['cadastrado']), ''], ['enviado', 'Com o cliente', conta(['enviado']), 'b'], ['revisar', 'Para revisar', conta(['revisar']), 'a'], ['rascunho', 'Escritos', conta(['rascunho']), 'n'], ['ajustes', 'Ajustes pedidos', conta(['ajustes']), 'r']]
      .filter(([id, , n]) => n || ['aprovado', 'enviado', 'revisar', 'ajustes'].includes(id))
      .map(([id, t, n, tom]) => `<button type="button" class="plj2-dl" role="switch" aria-checked="${estado.situacao === id}" data-plj-situacao="${estado.situacao === id ? '' : id}" title="${estado.situacao === id ? 'Mostrar todas as situações' : `Mostrar só: ${t}`}"><span>${t}</span><span class="d3m-vbarra ${tom}"><i style="--v:${contar.todos ? Math.round(n / contar.todos * 100) : 0}%"></i></span><b>${n}</b></button>`).join('')
      + `<button type="button" class="plj2-dl" role="switch" aria-checked="${estado.filtro === 'sem'}" data-plj-filtro="${estado.filtro === 'sem' ? 'todos' : 'sem'}" title="Mostrar só quem está sem planejamento"><span>Sem planejamento</span><span class="d3m-vbarra n"><i style="--v:${contar.todos ? Math.round(contar.sem / contar.todos * 100) : 0}%"></i></span><b>${contar.sem}</b></button>`;
    const umPl = prim || todos.find((p) => p.planejamento);
    const deUmaVez = [contar.sem ? `<button type="button" class="d3m-vlin" data-plj-filtro="sem"><span class="d3m-vnome"><b>Criar ${contar.sem === 1 ? 'o que falta' : `os ${contar.sem} que faltam`}</b></span>${IC2.seta}</button>` : '',
      umPl ? `<button type="button" class="d3m-vlin" data-plj-abrir="${esc(umPl.planejamento.id)}" title="${esc(umPl.cliente)}"><span class="d3m-vnome"><b>Abrir como documento</b> · ${esc(umPl.cliente)}</span>${IC2.seta}</button>
        <button type="button" class="d3m-vlin" data-plj-abrir="${esc(umPl.planejamento.id)}" data-plj-aba="historico" title="${esc(umPl.cliente)}"><span class="d3m-vnome"><b>Histórico de versões</b> · ${esc(umPl.cliente)}</span>${IC2.seta}</button>` : ''].join('');
    const lado = !pronto ? '<aside class="d3m-lado" aria-label="Consulta"></aside>' : `<aside class="d3m-lado" aria-label="Consulta">${laranja}
      <div class="d3m-cons"><div class="d3m-cons-cab"><b>${maiuscula(nomeMes || 'mês')}</b><span>${com} de ${contar.todos}</span></div><div class="plj2-dist">${dist}</div></div>
      ${deUmaVez ? `<div class="d3m-cons"><div class="d3m-cons-cab"><b>De uma vez</b></div>${deUmaVez}</div>` : ''}
      <div class="d3m-cons plj2-nota-bloco"><div class="d3m-cons-cab"><b>Onde o cliente aprova</b></div><p class="plj2-nota">O cliente vê e responde a grade do mês no VybeHub. Aqui fica só o trabalho da equipe.</p></div></aside>`;
    // A busca guarda o foco e o cursor quando a tela inteira é repintada.
    const foco = document.activeElement?.id === 'plj-busca';
    janela.innerHTML = `${topo}<div class="d3m-c-corpo plj2">${folha}${lado}</div>`;
    if (foco) { const b = janela.querySelector('#plj-busca'); b?.focus(); try { b?.setSelectionRange(b.value.length, b.value.length); } catch { /* campo sem seleção */ } }
  }

  async function carregar() {
    estado.carregando = true; estado.erro = ''; pintar();
    try {
      const r = await fetch('/api/painel?area=planejamentos&acao=operacao', { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'o painel não respondeu');
      estado.postos = Array.isArray(d.postos) ? d.postos : [];
    } catch (e) { estado.erro = e.message; }
    estado.carregando = false; pintar();
  }

  function abrir(filtro) {
    if (!janela) criarJanela();
    if (filtro) estado.filtro = filtro;
    janela.hidden = false;
    document.body.classList.add('mundo-plj');
    carregar();
  }
  function fechar() { if (janela) janela.hidden = true; document.body.classList.remove('mundo-plj'); }
  // Fechar a janela do planejamento devolve a lista atualizada (estado e placar mudam ao aprovar/enviar).
  const fecharModal = window.pljFecharModal;
  // A lista repintada devolve o foco ao mesmo botão que abriu o planejamento (o antigo saiu da tela com a repintura).
  if (typeof fecharModal === 'function') window.pljFecharModal = async function (...a) {
    const m = document.getElementById('workflow-modal'), id = m?.dataset.pljId, origem = m?.returnFocus;
    const r = await fecharModal.apply(this, a);
    if (!janela || janela.hidden || document.getElementById('workflow-modal')) return r;
    await carregar();
    const ativo = document.activeElement;
    if (id && (!ativo || ativo === document.body || !ativo.isConnected)) {
      const botoes = [...janela.querySelectorAll('[data-plj-abrir]')].filter((b) => b.dataset.pljAbrir === id && b.getClientRects().length);
      (botoes.find((b) => b.className === origem?.className && b.dataset.pljAba === origem?.dataset?.pljAba) || botoes[0])?.focus({ preventScroll: true });
    }
    return r;
  };

  // "Ir ao Centro de Operação" (aviso de planejamentos) levava à sala do Habbo: no Irecity abre este módulo.
  const irSala = window.irParaSalaEscritorio;
  if (typeof irSala === 'function') window.irParaSalaEscritorio = function (zona, ...r) {
    if (zona === 'operacao' && window.mundoVoxel?.ligado?.()) { abrir('acao'); return; }
    return irSala.call(this, zona, ...r);
  };
  // aberto: o dock (remarcarAoFechar em vybe-mundo.js) pergunta antes de acender o Hoje no lugar de Planejamentos.
  window.VybePlanejamentos = { abrir, fechar, aberto: () => Boolean(janela && !janela.hidden), _ordenar: ordenar, _filtrar: (lista, f) => { const antes = estado.filtro; estado.filtro = f; const r = filtrar(lista); estado.filtro = antes; return r; } };
})();
