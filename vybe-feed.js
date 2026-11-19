// FEED DO CLIENTE (Painel de trabalho › Feed). Paulo, 15/11/2026: "uma categoria nova no estilo calendário, mas
// mostrando o feed do cliente... o estado atual do Insta + o que tem no calendário pra sair, montando o feed futuro;
// se a arte não tiver pronta fica uma artezinha com o nome do formato; se não tiver nada cadastrado fica um X
// vermelho; o arrastar funciona igual no calendário e já muda a estrutura do calendário do cliente".
//
// A grade é a do Instagram (3 colunas, o mais novo em cima à esquerda):
//   - em cima, o futuro: o que está cadastrado no calendário (arte do Drive quando há; sem arte, uma arte provisória
//     com o formato) e um X vermelho em cada post que falta para a semana chegar a 3 (a mesma régua do "Menos de 3
//     posts" do Painel), nas próximas 4 semanas ou no mês escolhido;
//   - embaixo, o que já está no ar: o feed do Instagram (Meta ou a captura gravada) ou as últimas peças veiculadas.
// Montar o mês ali mesmo (Paulo, 15/11/2026: "o head consegue adicionar ali o formato e quantidade de peças em lote
// ou individual... encaixar, reorganizar, clicar na data que tava furada e add um conteúdo, mudar datas furadas em
// lote pra add conteúdo em lote"):
//   - o + de um X cadastra uma peça naquele dia;
//   - tocar nos X marca as datas; com o formato escolhido, "Cadastrar" abre o cadastro com uma peça por data;
//   - "+ Em lote": formato e quantidade, e o Feed marca as próximas datas livres (os X primeiro);
//   - arrastar troca datas (no celular, segurando a peça); "Intercalar formatos" propõe a troca para não repetir.
// Toda gravação passa pelos caminhos do calendário (cadastro e moverDataDoItem): o calendário muda junto.

const FEED_LEMBRA = 'vybe_feed_aberto';
let feedAberto = (() => { try { return localStorage.getItem(FEED_LEMBRA) === '1'; } catch { return false; } })();
const FEED = { carteira: 'all', head: 'all', cliente: 'all', perfis: new Map(), pedindo: new Set(), artes: new Map(), pedindoArtes: new Set(), arrastando: null, salvando: false,
  // vista: 'semanas' (as próximas 4) ou 'mes' (FEED.mes 'AAAA-MM'). sel: as datas marcadas de um cliente para o lote.
  // lote: o painel "+ Em lote" aberto. intercalar: a prévia da troca de datas. atualizar: o painel do favorito.
  vista: 'semanas', mes: '', sel: null, lote: null, intercalar: null, atualizar: null,
  // noArMax: quantas peças do que já saiu cada cliente desenha (cresce ao rolar até o fim da grade).
  noArMax: new Map() };
const FEED_SEMANAS = 4, FEED_POR_SEMANA = 3, FEED_LOTE_MAX = 20;
// Os dias bons para um post quando a semana tem buraco: seg, qua, sex; depois ter, qui, sáb, dom (0 = segunda).
const FEED_DIAS_PADRAO = [0, 2, 4, 1, 3, 5, 6];
// Os formatos do lote, com o nome que o cadastro usa para cada um.
const FEED_FORMATOS = [
  { chave: 'reels', nome: 'Reels', plural: 'Reels', cadastro: 'Reels' },
  { chave: 'carrossel', nome: 'Carrossel', plural: 'Carrosséis', cadastro: 'Carrossel' },
  { chave: 'card', nome: 'Card', plural: 'Cards', cadastro: 'Card' },
  { chave: 'foto', nome: 'Fotografia', plural: 'Fotografias', cadastro: 'Fotografia' },
  { chave: 'post', nome: 'Post', plural: 'Posts', cadastro: 'Feed' },
];

function toggleFeedDoCliente() { alternarPainelDaBarra('feed'); }

function feedHoje() {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
}
function feedSomar(iso, dias) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); }
function feedDiaSemana(iso) { return new Date(`${iso}T12:00:00Z`).getUTCDay(); }
function feedSegunda(iso) { const w = feedDiaSemana(iso); return feedSomar(iso, w === 0 ? -6 : 1 - w); }
function feedDm(iso) { return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : ''; }
const FEED_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function feedQuando(iso) { return `${FEED_DIAS[feedDiaSemana(iso)]} ${feedDm(iso)}`; }
function feedEsc(v) { return typeof safeText === 'function' ? safeText(v) : String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`); }
function feedNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
function feedPlural(n, um, varios) { return `${n} ${n === 1 ? um : varios}`; }
function feedToast(msg, tipo = 'info', ms) { if (typeof showToast === 'function') showToast(msg, tipo, ms); }

// Formato da peça e se ela entra na grade (story, motion e vídeo solto não entram; sem formato conta como feed).
function feedFormato(item) {
  const bruto = String(item?.formato || item?.tipo_conteudo || '').trim();
  const k = feedNorm(bruto);
  if (!k) return { nome: 'Post', feed: true, chave: 'post' };
  if (k.startsWith('reel')) return { nome: 'Reels', feed: true, chave: 'reels' };
  if (k.startsWith('carross')) return { nome: 'Carrossel', feed: true, chave: 'carrossel' };
  if (k.startsWith('card')) return { nome: 'Card', feed: true, chave: 'card' };
  if (k.startsWith('foto')) return { nome: 'Fotografia', feed: true, chave: 'foto' };
  if (k.startsWith('feed')) return { nome: 'Post', feed: true, chave: 'post' };
  const feed = typeof tagEhDeFeed === 'function' ? tagEhDeFeed(bruto) : false;
  return { nome: bruto, feed, chave: 'outro' };
}

// Clientes ativos, com carteira, heads e o @ do Instagram (cadastro único; sem ele, o cérebro do cliente).
function feedClientes() {
  const linhas = typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : [];
  const ativo = (c) => (typeof clienteAtivo === 'function' ? clienteAtivo(c) : c.ativo !== false);
  let nomes = linhas.filter(ativo).map((c) => c.nome).filter(Boolean);
  if (!nomes.length) {
    const vistos = new Set();
    for (const x of feedItens()) for (const n of feedClientesDoItem(x.it)) if (n) vistos.add(n);
    nomes = [...vistos];
  }
  if (typeof clienteApareceNaLista === 'function') nomes = nomes.filter((n) => { try { return clienteApareceNaLista(n); } catch { return true; } });
  const base = typeof VYBES_CEREBRO_BASE !== 'undefined' && Array.isArray(VYBES_CEREBRO_BASE) ? VYBES_CEREBRO_BASE : [];
  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((nome) => {
    const linha = linhas.find((c) => c.nome === nome) || {};
    const n = feedNorm(nome);
    const dossie = base.find((d) => feedNorm(d.nome) === n || (d.apelidos || []).some((a) => feedNorm(a) === n) || feedNorm(d.nome).startsWith(n) || n.startsWith(feedNorm(d.nome)));
    const insta = linha.cadastro?.instagram || linha.instagram || dossie?.instagram || '';
    const heads = typeof headsDoClienteNaLista === 'function' ? headsDoClienteNaLista(nome) : String(linha.heads || '').split(',').map((h) => h.trim()).filter(Boolean);
    const bio = String(linha.cadastro?.bio_instagram || '').trim(), site = String(linha.cadastro?.site || '').trim();
    return { nome, id: linha.id ?? null, usuario: feedUsuario(insta), carteira: typeof carteiraDoCliente === 'function' ? carteiraDoCliente(nome) : '', heads, bio, site };
  }).filter((c, i, l) => {
    // Um cliente, um perfil: o mesmo nome (com ou sem acento) ou o mesmo @ em dois cadastros aparece uma vez só.
    const antes = l.slice(0, i);
    return !antes.some((o) => feedNorm(o.nome) === feedNorm(c.nome) || (c.usuario && o.usuario === c.usuario));
  });
}
function feedUsuario(v) {
  let s = String(v || '').trim(); const url = s.match(/instagram\.com\/([^/?#\s]+)/i); if (url) s = url[1];
  s = s.replace(/^@+/, '').replace(/\/+$/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : '';
}

// A janela da grade: as próximas 4 semanas (de segunda) ou um mês inteiro ("Visão do mês").
const FEED_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function feedMesAtual() { return feedHoje().slice(0, 7); }
function feedFimDoMes(mes) { const [a, m] = mes.split('-').map(Number); return new Date(Date.UTC(a, m, 0, 12)).toISOString().slice(0, 10); }
function feedSomarMes(mes, n) { const [a, m] = mes.split('-').map(Number); return new Date(Date.UTC(a, m - 1 + n, 1, 12)).toISOString().slice(0, 7); }
function feedNomeMes(mes) { const [a, m] = mes.split('-').map(Number); return `${FEED_MESES[m - 1]}${a !== Number(feedHoje().slice(0, 4)) ? ` de ${a}` : ''}`; }
function feedJanela() {
  const hoje = feedHoje();
  if (FEED.vista === 'mes') {
    const mes = FEED.mes || feedMesAtual(), ini = `${mes}-01`, fim = feedFimDoMes(mes), seg0 = feedSegunda(ini);
    const dias = Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${seg0}T12:00:00Z`)) / 864e5) + 1;
    return { modo: 'mes', mes, ini, fim, seg0, semanas: Math.ceil(dias / 7), hoje, rotulo: `em ${feedNomeMes(mes)}` };
  }
  const seg0 = feedSegunda(hoje);
  return { modo: 'semanas', ini: seg0, fim: feedSomar(seg0, FEED_SEMANAS * 7 - 1), seg0, semanas: FEED_SEMANAS, hoje, rotulo: `nas próximas ${FEED_SEMANAS} semanas` };
}

// A data comemorativa do dia (o calendário sazonal do Vybe OS, vybe-sazonal.js): a mais forte do dia, para o X
// sugerir o tema e o lote usar no título. Guardada por ano.
const FEED_SAZONAL = new Map();
function feedSazonal(iso) {
  // O calendário sazonal é sob demanda (vybe-sob-demanda.js): a primeira vez que o Feed precisa, ele pede o grupo e
  // redesenha quando chegar.
  const fonte = typeof datasSazonaisDoAno === 'function' ? datasSazonaisDoAno : null;
  if (!fonte) {
    if (!feedSazonal.pedido && typeof carregarSobDemanda === 'function') {
      feedSazonal.pedido = true;
      carregarSobDemanda('sazonal').then(() => { if (feedAberto) renderFeedDoCliente(); }).catch(() => {});
    }
    return '';
  }
  if (!iso) return '';
  const ano = Number(iso.slice(0, 4));
  if (!FEED_SAZONAL.has(ano)) {
    const porDia = new Map();
    try {
      for (const d of fonte(ano)) {
        const atual = porDia.get(d.iso);
        const forca = (Number(d.destaque) || 0) * 2 + (d.feriado ? 1 : 0);
        if (forca > 0 && (!atual || forca > atual.forca)) porDia.set(d.iso, { nome: d.nome, forca });
      }
    } catch { /* sem calendário sazonal */ }
    FEED_SAZONAL.set(ano, porDia);
  }
  return FEED_SAZONAL.get(ano).get(iso)?.nome || '';
}

// O nome do cliente como o calendário o vê: o do Monday passa pelo cadastro (clientMasterResolveName), senão
// "Academia Lions" do quadro não acha "Academia Lions Top" do cadastro (Paulo, 15/11/2026: "não apareceu o que já tá
// cadastrado no feed").
function feedNomeCliente(n) {
  const bruto = String(n || '').trim(); if (!bruto) return '';
  try { if (typeof clientMasterResolveName === 'function') return clientMasterResolveName(bruto) || bruto; } catch { /* segue */ }
  return typeof normalizarCliente === 'function' ? normalizarCliente(bruto) : bruto;
}
function feedClientesDoItem(it) {
  const brutos = typeof clientesDoItem === 'function' ? clientesDoItem(it) : (Array.isArray(it?.clientes) ? it.clientes : [it?.cliente]);
  return [...new Set(brutos.filter(Boolean).map(feedNomeCliente).filter(Boolean))];
}
// As mesmas peças do calendário: produção pela veiculação e solicitações de feed pela conclusão.
function feedItens() {
  const prod = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) && DADOS_ALL.length ? DADOS_ALL : (typeof DADOS !== 'undefined' && Array.isArray(DADOS) ? DADOS : []);
  const pedidos = typeof DADOS_DEMANDAS !== 'undefined' && Array.isArray(DADOS_DEMANDAS) ? DADOS_DEMANDAS : [];
  const vivo = (it) => it && !/cancel/i.test(String(it.status || ''));
  return [
    ...prod.filter(vivo).map((it) => ({ it, request: false, iso: String(it.veiculacao_iso || '') })),
    ...pedidos.filter(vivo).filter((it) => (typeof solicitacaoVaiProFeed === 'function' ? solicitacaoVaiProFeed(it) : true))
      .map((it) => ({ it, request: true, iso: String(it.conclusao_iso || it.veiculacao_iso || '') })),
  ];
}
function feedDoCliente(nome) {
  const alvo = feedNorm(feedNomeCliente(nome));
  return feedItens().filter((x) => feedClientesDoItem(x.it).some((n) => feedNorm(n) === alvo))
    .map((x) => ({ item: x.it, request: x.request, iso: x.iso, fmt: x.request ? feedFormato({ formato: x.it.tipo || x.it.formato }) : feedFormato(x.it) }))
    .filter((x) => x.fmt.feed && /^\d{4}-\d{2}-\d{2}$/.test(x.iso));
}

// Prazo de ouro vencido e a peça ainda não chegou em Para agendar / Agendado / Finalizado: contorno vermelho.
function feedAtrasada(x) {
  if (!x || x.request || x.passado || !x.item) return false;
  const p = String(x.item.prazo_iso || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p) || p >= feedHoje()) return false;
  return !/agendad|para agendar|finaliz|publicad/i.test(String(x.item.status || ''));
}

// Monta a grade de um cliente: futuro (peças, buracos e datas marcadas) e o que está no ar.
function feedMontar(cli) {
  const jan = feedJanela(), hoje = jan.hoje, inicio = jan.ini > hoje ? jan.ini : hoje, fim = jan.fim;
  // A prévia do "Intercalar formatos" muda as datas só na tela, até alguém aplicar.
  const troca = FEED.intercalar?.cliente === cli.nome ? new Map(FEED.intercalar.moves.map((m) => [m.id, m.para])) : null;
  const todas = feedDoCliente(cli.nome).map((x) => (troca?.has(String(x.item.id)) ? { ...x, iso: troca.get(String(x.item.id)), trocada: true } : x));
  const futuras = todas.filter((x) => x.iso >= inicio && x.iso <= fim);
  const depois = todas.filter((x) => x.iso > fim).length;
  const ocupados = new Set(todas.map((x) => x.iso));
  const buracos = [];
  for (let s = 0; s < jan.semanas; s += 1) {
    const ini = feedSomar(jan.seg0, s * 7), fimS = feedSomar(ini, 6);
    // Conta tudo da semana dentro da janela (o que já saiu também conta); buraco só de hoje em diante, sem peça no dia.
    const diasNaJanela = FEED_DIAS_PADRAO.map((d) => feedSomar(ini, d)).filter((iso) => iso >= jan.ini && iso <= fim);
    let falta = Math.min(FEED_POR_SEMANA, diasNaJanela.length) - todas.filter((x) => x.iso >= ini && x.iso <= fimS && x.iso >= jan.ini && x.iso <= fim).length;
    for (const iso of diasNaJanela) {
      if (falta <= 0) break;
      if (iso < hoje || ocupados.has(iso) || buracos.some((b) => b.iso === iso)) continue;
      buracos.push({ iso, buraco: true, sazonal: feedSazonal(iso) }); falta -= 1;
    }
  }
  // Datas marcadas para o lote que não são buraco (o "+ Em lote" passou dos X): entram como quadro livre.
  const sel = FEED.sel?.cliente === cli.nome ? FEED.sel : null;
  const livres = sel ? [...sel.isos].filter((iso) => !buracos.some((b) => b.iso === iso) && !ocupados.has(iso)).map((iso) => ({ iso, buraco: true, livre: true, sazonal: feedSazonal(iso) })) : [];
  for (const b of [...buracos, ...livres]) b.marcado = Boolean(sel?.isos.has(b.iso));
  const ordem = (a, b) => b.iso.localeCompare(a.iso) || Number(Boolean(a.buraco)) - Number(Boolean(b.buraco));
  const futuro = [...futuras, ...buracos, ...livres].sort(ordem);
  // A grade rola com tudo o que o cliente tem no calendário (Paulo, 19/11/2026: "não tá mostrando todos os posts.. pode
  // deixar rolar o feed com o que tiver no calendário pra ver tudo"): o que vem depois da janela (e, no mês adiante, o
  // que vem antes dele) entra em cima, pela data. Buraco e data livre continuam só dentro da janela.
  const fora = todas.filter((x) => x.iso >= hoje && (x.iso < inicio || x.iso > fim)).map((x) => ({ ...x, fora: true }));
  const grade = [...futuro, ...fora].sort(ordem);
  const perfil = cli.usuario ? FEED.perfis.get(cli.usuario) : null;
  const publicadas = todas.filter((x) => x.iso < hoje).sort((a, b) => b.iso.localeCompare(a.iso)).map((x) => ({ ...x, passado: true }));
  // Com a captura (o feed lido uma vez no navegador da Vybe), o que a Vybe publicou depois dela entra na frente dos
  // posts capturados: a grade vai se atualizando sozinha (Paulo, 15/11/2026: "depois o que for saindo o sistema vai
  // atualizando"). Com a Meta ligada, os posts já vêm atualizados do próprio Instagram.
  const desde = perfil?.fonte === 'captura' ? String(perfil.capturado_em || '').slice(0, 10) : '';
  const noAr = perfil?.posts?.length
    ? [...(desde ? publicadas.filter((x) => x.iso > desde) : []), ...perfil.posts.map((p) => ({ ig: p }))]
    : publicadas;
  // Três do mesmo formato em seguida, na ordem em que vão ao ar: a grade fica repetida.
  const seq = futuras.slice().sort((a, b) => a.iso.localeCompare(b.iso));
  let repetido = null;
  for (let i = 2; i < seq.length && !repetido; i += 1) if (seq[i].fmt.chave === seq[i - 1].fmt.chave && seq[i].fmt.chave === seq[i - 2].fmt.chave && seq[i].fmt.chave !== 'post') repetido = seq[i].fmt.nome;
  const semArte = futuras.filter((x) => FEED.artes.has(String(x.item.id)) && !FEED.artes.get(String(x.item.id))).length;
  const atrasadas = futuras.filter(feedAtrasada).length;
  const noMes = jan.modo === 'mes' ? todas.filter((x) => x.iso >= jan.ini && x.iso <= fim) : [];
  return { futuro, grade, fora, noAr, futuras, buracos, livres, depois, perfil, repetido, semArte, atrasadas, jan, noMes, ocupados };
}

function feedFiltrados() {
  const todos = feedClientes();
  return todos.filter((c) => (FEED.carteira === 'all' || c.carteira === FEED.carteira)
    && (FEED.head === 'all' || c.heads.includes(FEED.head))
    && (FEED.cliente === 'all' || c.nome === FEED.cliente));
}

// A imagem do Instagram passa pelo servidor (o endereço assinado do CDN nem sempre abre direto no navegador).
function feedFotoIg(url) {
  const u = String(url || '');
  if (!u) return '';
  // A captura gravada já vem com o endereço do próprio Vybe OS.
  if (/^data:image\//.test(u) || u.startsWith('/api/painel?area=feed_instagram&captura=')) return u;
  return `/api/painel?area=feed_instagram&foto=${encodeURIComponent(u)}`;
}
function feedNumeroIg(n) {
  const v = Number(n); if (!Number.isFinite(v)) return '–';
  if (v >= 1e6) return `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (v >= 1e4) return `${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString('pt-BR');
}

// O que já saiu desenha por partes (Paulo, 19/11/2026: rolar o feed para ver tudo, sem travar): FEED_NO_AR_LOTE
// de cada vez; um marcador no fim da grade pede a próxima parte quando chega perto da vista.
const FEED_NO_AR_LOTE = 36;
function feedNoArLimite(nome) { return FEED.noArMax.get(nome) || FEED_NO_AR_LOTE; }
function feedNoArHtml(cli, g) {
  const lim = feedNoArLimite(cli.nome);
  const html = g.noAr.slice(0, lim).map((t) => feedTileHtml(t, cli)).join('');
  return g.noAr.length > lim ? `${html}<span class="vfd-mais" data-vfd-mais="${feedEsc(cli.nome)}" aria-hidden="true"></span>` : html;
}
const FEED_MAIS_OBS = new WeakMap();
function feedLigarMais(raiz) {
  if (!raiz || typeof IntersectionObserver !== 'function') return;
  raiz.querySelectorAll('[data-vfd-mais]').forEach((el) => {
    if (el.vfdObservado) return; el.vfdObservado = true;
    // A raiz é quem rola (a grade); sem rolagem própria (celular estreito), a própria tela.
    const rola = el.closest('.vfd2-rola, .vfd-cel-rola');
    const raizIo = rola && /auto|scroll/.test(getComputedStyle(rola).overflowY) ? rola : document;
    let obs = FEED_MAIS_OBS.get(raizIo);
    if (!obs) {
      obs = new IntersectionObserver((vistos) => {
        let mudou = false;
        for (const v of vistos) {
          if (!v.isIntersecting) continue;
          obs.unobserve(v.target);
          const nome = v.target.dataset.vfdMais;
          FEED.noArMax.set(nome, feedNoArLimite(nome) + FEED_NO_AR_LOTE); mudou = true;
        }
        if (mudou && feedAberto) renderFeedDoCliente();
      }, { root: raizIo === document ? null : raizIo, rootMargin: '0px 0px 600px 0px' });
      FEED_MAIS_OBS.set(raizIo, obs);
    }
    obs.observe(el);
  });
}

function feedTileHtml(t, cli) {
  if (t.buraco) {
    const quando = feedQuando(t.iso);
    const rotulo = t.livre ? 'data livre' : 'sem post';
    // Tocar no quadro marca a data para o lote; o + cadastra só ela.
    return `<div class="vfd-t vfd-x${t.livre ? ' vfd-livre' : ''}${t.marcado ? ' vfd-marcado' : ''}" data-vfd-alvo="${feedEsc(t.iso)}" data-vfd-cliente="${feedEsc(cli.nome)}">
      <button type="button" class="vfd-x-marcar" aria-pressed="${t.marcado}" onclick="feedMarcar('${jsArg(cli.nome)}','${jsArg(t.iso)}')"
        title="${t.marcado ? 'Desmarcar' : 'Marcar'} ${quando}${t.sazonal ? ` (${feedEsc(t.sazonal)})` : ''} para cadastrar em lote; arraste uma peça para cá para trocar o dia"
        aria-label="${t.marcado ? 'Desmarcar' : 'Marcar'} ${quando} para o lote">
        <span class="vfd-x-marca" aria-hidden="true"></span><span class="vfd-x-txt">${t.marcado ? 'marcada' : rotulo}</span>${t.sazonal ? `<span class="vfd-x-data">${feedEsc(t.sazonal)}</span>` : ''}</button>
      <span class="vfd-data vfd-futuro">${quando}</span>
      <button type="button" class="vfd-x-criar" title="Cadastrar um post para ${quando}" aria-label="Cadastrar post de ${feedEsc(cli.nome)} para ${quando}" onclick="feedCriarNoDia('${jsArg(cli.nome)}','${jsArg(t.iso)}')"><i aria-hidden="true"></i></button></div>`;
  }
  if (t.ig) {
    const p = t.ig, icone = p.tipo === 'carrossel' ? '<i class="vfd-tipo vfd-tipo-carrossel" aria-label="Carrossel"></i>' : p.tipo === 'video' ? '<i class="vfd-tipo vfd-tipo-video" aria-label="Vídeo"></i>' : '';
    return `<a class="vfd-t vfd-ig" href="${feedEsc(p.link)}" target="_blank" rel="noopener noreferrer" title="${p.data ? `No ar desde ${feedEsc(feedDm(String(p.data).slice(0, 10)))}` : 'No ar'}${p.fixado ? ' (fixado)' : ''}: abrir no Instagram">
      <img src="${feedEsc(feedFotoIg(p.imagem))}" alt="" loading="lazy" onerror="this.closest('.vfd-t').classList.add('vfd-sem-img');this.remove()">${icone}</a>`;
  }
  const it = t.item, id = String(it.id), arte = t.request ? null : FEED.artes.get(id);
  const nome = String(it.nome || it.titulo || 'Peça');
  const status = typeof statusEmFrase === 'function' ? statusEmFrase(it.status || '') : String(it.status || '');
  const quando = feedQuando(t.iso);
  const corpo = arte?.thumb
    ? `<img src="${feedEsc(String(arte.thumb).replace(/sz=\d+/, 'sz=480'))}" alt="" loading="lazy" onerror="this.closest('.vfd-t').classList.add('vfd-sem-img');this.remove()">${/^(mp4|mov|m4v|webm|avi)$/i.test(String(arte.extensao || '')) ? '<i class="vfd-tipo vfd-tipo-video" aria-label="Vídeo: frame do Drive"></i>' : arte.total > 1 ? '<i class="vfd-tipo vfd-tipo-carrossel" aria-label="Mais de um arquivo"></i>' : ''}`
    : `<span class="vfd-prov vfd-prov-${feedEsc(t.fmt.chave)}"><b>${feedEsc(t.fmt.nome)}</b><small>${feedEsc(nome)}</small></span>`;
  if (t.passado) return `<div class="vfd-t vfd-passado" title="${feedEsc(nome)} · veiculada em ${feedEsc(feedDm(t.iso))}">${corpo}</div>`;
  const atrasada = feedAtrasada(t);
  // A etapa da peça em cima (o status do calendário) e, com o prazo de ouro vencido, o contorno vermelho.
  const etapa = status ? `<span class="vfd-etapa" aria-hidden="true">${feedEsc(status)}</span>` : '';
  return `<button type="button" class="vfd-t vfd-peca${arte?.thumb ? '' : ' vfd-sem-arte'}${atrasada ? ' vfd-atrasada' : ''}${t.trocada ? ' vfd-trocada' : ''}" draggable="true" data-vfd-item="${feedEsc(id)}" data-vfd-alvo="${feedEsc(t.iso)}" data-vfd-cliente="${feedEsc(cli.nome)}"
      title="${feedEsc(nome)} · ${feedEsc(t.fmt.nome)} · ${feedEsc(quando)}${status ? ' · ' + feedEsc(status) : ''}${atrasada ? ' · prazo de ouro vencido' : ''}${arte?.thumb || t.request ? '' : ' · arte ainda não enviada'}. Arraste para trocar o dia; clique para abrir."
      onclick="feedAbrirPeca('${jsArg(id)}',event,${t.request ? 'true' : 'false'})">${corpo}${etapa}<span class="vfd-data vfd-futuro">${feedEsc(quando)}</span></button>`;
}

function feedSouDono() {
  if (typeof souDonoDaSessao === 'function') { try { return souDonoDaSessao(); } catch { /* segue */ } }
  return typeof SESSAO_ATUAL !== 'undefined' && Boolean(SESSAO_ATUAL?.dono);
}

// O cartão de cada cliente é o perfil do Instagram (Paulo, 15/11/2026: "é pra ficar tipo o feed mesmo do Insta, bio,
// tudo certinho"): foto, números, nome, bio e link; depois a grade única, com o que vai sair em cima (marcado com o
// dia) e o que já está no ar embaixo, como vai ficar quando tudo for publicado.
function feedClienteHtml(cli) {
  const g = feedMontar(cli);
  const p = g.perfil && !g.perfil.erro ? g.perfil : null;
  // Corta pelo mais longe, nunca pelo mais perto: o que sai primeiro encosta no que já está no ar. No mês, tudo.
  // Tudo o que o cliente tem no calendário, sem corte: a grade rola por dentro do celular.
  const futuro = g.grade;
  const contaFmt = (lista) => FEED_FORMATOS.map((f) => [f, lista.filter((x) => x.fmt.chave === f.chave).length]).filter(([, n]) => n).map(([f, n]) => `${n} ${f.nome}`).join(', ');
  const avisos = [
    g.jan.modo === 'mes' ? `<span class="vfd-aviso" title="Peças de feed com veiculação ${feedEsc(g.jan.rotulo)}">${feedPlural(g.noMes.length, 'post', 'posts')} ${feedEsc(g.jan.rotulo)}${g.noMes.length ? ` · ${feedEsc(contaFmt(g.noMes))}` : ''}</span>`
      : (p?.seguindo != null ? `<span class="vfd-aviso">${feedPlural(g.futuras.length, 'post a sair', 'posts a sair')}</span>` : ''),
    g.buracos.length ? `<span class="vfd-aviso r" title="Semanas com menos de ${FEED_POR_SEMANA} posts">${feedPlural(g.buracos.length, 'post faltando', 'posts faltando')} ${feedEsc(g.jan.rotulo)}</span>` : `<span class="vfd-aviso g">${FEED_POR_SEMANA} por semana ${feedEsc(g.jan.rotulo)}</span>`,
    g.atrasadas ? `<span class="vfd-aviso r" title="Prazo de ouro vencido e a peça ainda não está em Para agendar">${feedPlural(g.atrasadas, 'peça atrasada', 'peças atrasadas')}</span>` : '',
    g.semArte ? `<span class="vfd-aviso a">${feedPlural(g.semArte, 'peça sem arte', 'peças sem arte')}</span>` : '',
    g.repetido ? `<span class="vfd-aviso a" title="Três ${feedEsc(g.repetido)} seguidos deixam a grade repetida: use Intercalar formatos ou arraste">3 ${feedEsc(g.repetido)} seguidos</span>` : '',
    p?.fonte === 'captura' ? `<span class="vfd-aviso" title="O feed atual foi lido no Instagram nesse dia; o que a Vybe publica depois entra na frente sozinho">feed lido em ${feedDm(String(p.capturado_em || '').slice(0, 10))}</span>` : '',
    g.depois ? `<span class="vfd-aviso" title="Estão na grade, acima das próximas semanas">${feedPlural(g.depois, 'peça depois', 'peças depois')} de ${feedDm(g.jan.fim)}</span>` : '',
  ].filter(Boolean).join('');
  const iniciais = cli.nome.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const foto = p?.foto ? `<img src="${feedEsc(feedFotoIg(p.foto))}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${jsArg(iniciais)}'}))">` : `<span>${feedEsc(iniciais)}</span>`;
  const usuario = cli.usuario ? `<a class="vfd-ig-user" href="https://www.instagram.com/${feedEsc(cli.usuario)}/" target="_blank" rel="noopener noreferrer">${feedEsc(cli.usuario)}</a>${p?.verificado ? '<i class="vfd-ig-selo" aria-label="Verificado"></i>' : ''}` : '<span class="vfd-ig-user vfd-sem-insta">sem Instagram no cadastro</span>';
  const nums = `<span><b>${feedNumeroIg(p?.total_posts)}</b> posts</span><span><b>${feedNumeroIg(p?.seguidores)}</b> seguidores</span>`
    + (p?.seguindo != null ? `<span><b>${feedNumeroIg(p.seguindo)}</b> seguindo</span>` : `<span><b>${g.futuras.length}</b> a sair</span>`);
  const siteTxt = String(p?.site || cli.site || '').trim();
  const site = siteTxt ? `<a class="vfd-ig-site" href="${feedEsc(/^https?:\/\//i.test(siteTxt) ? siteTxt : 'https://' + siteTxt)}" target="_blank" rel="noopener noreferrer">${feedEsc(siteTxt.replace(/^https?:\/\//i, '').replace(/\/$/, ''))}</a>` : '';
  const bioTxt = String(p?.bio || cli.bio || '').trim();
  const bio = bioTxt ? `<p class="vfd-ig-bio">${feedEsc(bioTxt)}</p>` : `<p class="vfd-ig-bio vazia">${p?.fonte === 'meta' || p?.fonte === 'captura' ? 'Perfil sem bio.' : 'Bio aparece com a conta da Meta ligada (ou no cadastro do cliente).'}</p>`;
  const nome = jsArg(cli.nome);
  const acoes = [
    `<button type="button" class="vfd-acao" onclick="feedCriarNoDia('${nome}','')">+ Novo post</button>`,
    `<button type="button" class="vfd-acao" aria-expanded="${FEED.lote?.cliente === cli.nome}" onclick="feedLoteAbrir('${nome}')">+ Em lote</button>`,
    g.futuras.filter((x) => !x.request).length >= 3 ? `<button type="button" class="vfd-acao${g.repetido ? ' vfd-acao-a' : ''}" aria-expanded="${FEED.intercalar?.cliente === cli.nome}" onclick="feedIntercalarPropor('${nome}')">Intercalar formatos</button>` : '',
    feedSouDono() && cli.usuario ? `<button type="button" class="vfd-acao" aria-expanded="${FEED.atualizar === cli.nome}" onclick="feedAtualizarAbrir('${nome}')">Atualizar Instagram</button>` : '',
  ].filter(Boolean).join('');
  // Uma grade só, contínua (Paulo, 15/11/2026: "tem que ter continuidade"): o que vai sair em cima e, colado, o que
  // está no ar.
  const noAr = feedNoArHtml(cli, g);
  return `<section class="vfd-cliente${FEED.sel?.cliente === cli.nome && FEED.sel.isos.size ? ' vfd-com-sel' : ''}" aria-label="Feed de ${feedEsc(cli.nome)}">
    <header class="vfd-ig">
      <div class="vfd-ig-topo"><span class="vfd-ig-foto">${foto}</span><div class="vfd-ig-nums">${nums}</div></div>
      <div class="vfd-ig-linha">${usuario}</div>
      <p class="vfd-ig-nome">${feedEsc(p?.nome || cli.nome)}</p>
      ${bio}${site}
      <div class="vfd-acoes">${acoes}</div>
      ${FEED.lote?.cliente === cli.nome ? feedLoteHtml(cli, g) : ''}
      ${FEED.intercalar?.cliente === cli.nome ? feedIntercalarHtml(cli) : ''}
      ${FEED.atualizar === cli.nome ? feedAtualizarHtml(cli) : ''}
      <div class="vfd-avisos">${avisos}</div>
    </header>
    <div class="vfd-ig-aba" aria-hidden="true"><i></i></div>
    <div class="vfd-grade" data-vfd-grade="${feedEsc(cli.nome)}">${futuro.map((t) => feedTileHtml(t, cli)).join('')}${noAr}${!futuro.length && !noAr ? '<p class="vfd-vazio">Nada programado nem no ar.</p>' : ''}</div>
    ${FEED.sel?.cliente === cli.nome && FEED.sel.isos.size ? feedBarraDoLoteHtml(cli) : ''}
  </section>`;
}

function feedFiltrosHtml(todos) {
  const cart = typeof CARTEIRAS_DA_AGENDA !== 'undefined' ? CARTEIRAS_DA_AGENDA : [];
  const heads = [...new Set(todos.flatMap((c) => c.heads))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const opc = (v, rot, atual) => `<option value="${feedEsc(v)}"${v === atual ? ' selected' : ''}>${feedEsc(rot)}</option>`;
  const ficha = (v, rot) => `<button type="button" class="vfd-chip" aria-pressed="${FEED.carteira === v}" onclick="feedFiltrar('carteira','${jsArg(v)}')">${feedEsc(rot)}</button>`;
  return `<div class="vfd-filtros" role="group" aria-label="Filtros do feed">
    ${ficha('all', 'Todas as carteiras')}${cart.map((c) => ficha(c.id, c.apelido)).join('')}
    <label class="vfd-sel"><span>Head</span><select onchange="feedFiltrar('head',this.value)">${opc('all', 'Todos', FEED.head)}${heads.map((h) => opc(h, h, FEED.head)).join('')}</select></label>
    <label class="vfd-sel"><span>Cliente</span><select onchange="feedFiltrar('cliente',this.value)">${opc('all', 'Todos os clientes', FEED.cliente)}${todos.map((c) => opc(c.nome, c.nome, FEED.cliente)).join('')}</select></label>
  </div>`;
}

// "Próximas 4 semanas" ou um mês inteiro, com as setas para andar de mês em mês.
function feedVistaHtml() {
  const mes = FEED.mes || feedMesAtual();
  return `<div class="vfd-vista" role="group" aria-label="Período do feed">
    <button type="button" class="vfd-chip" aria-pressed="${FEED.vista !== 'mes'}" onclick="feedVista('semanas')">Próximas ${FEED_SEMANAS} semanas</button>
    <button type="button" class="vfd-chip" aria-pressed="${FEED.vista === 'mes'}" onclick="feedVista('mes')">Mês</button>
    ${FEED.vista === 'mes' ? `<span class="vfd-mes"><button type="button" class="vfd-mes-seta" aria-label="Mês anterior" onclick="feedVista('mes',-1)" ${mes <= feedMesAtual() ? 'disabled' : ''}>‹</button><b>${feedEsc(feedNomeMes(mes))}</b><button type="button" class="vfd-mes-seta" aria-label="Próximo mês" onclick="feedVista('mes',1)">›</button></span>` : ''}
  </div>`;
}
function feedVista(vista, passo = 0) {
  if (vista === 'mes') {
    const atual = FEED.mes || feedMesAtual(), novo = feedSomarMes(atual, passo);
    FEED.mes = novo < feedMesAtual() ? feedMesAtual() : novo;
    FEED.vista = 'mes';
  } else FEED.vista = 'semanas';
  FEED.sel = null; FEED.intercalar = null;
  renderFeedDoCliente();
}

// ── A camada do Feed (Paulo, 15/11/2026: "quando clicar em feed, ao invés de abrir assim, vem um hover pra frente com
// o feed do cliente... tela cheia que vem por cima... essa troca de feed tá dura, amador; deixa fluida", com painéis
// de vidro de referência). Um "celular" por cliente, lado a lado: o do meio grande e mexível, os vizinhos menores
// atrás. Os celulares ficam montados: trocar de cliente só muda a posição (--d) e o CSS desliza com mola; cada um
// rola por dentro, sem a página rolar. Setas, ← →, dois dedos no trackpad, deslizar no celular, clicar no vizinho; Esc
// fecha.
const FEED_VIZINHOS = 3;
function renderFeedDoCliente() {
  const wrap = document.getElementById('feed-board');
  // Direção V2 (prancha V2-M-Feed): no mundo, o Feed é uma vista dentro da janela da Produção, não a camada por cima.
  if (wrap && feedAberto && feedV2Ligado()) { feedFecharCamada(); feedV2Pintar(wrap); return; }
  // Fora do mundo (e ao fechar), o quadro dentro do Painel fica vazio: o Feed abre por cima de tudo.
  if (wrap) { wrap.innerHTML = ''; wrap.classList.add('focus-hidden'); }
  if (wrap) wrap.classList.remove('d3m-a-v2', 'vfd-com-sel');
  if (!feedAberto) { feedFecharCamada(); return; }
  if (typeof garantirClientesAtivos === 'function') { try { garantirClientesAtivos(); } catch { /* segue */ } }
  if (typeof ensureClientMasterSources === 'function' && !feedClientes.pedido) {
    feedClientes.pedido = true;
    Promise.resolve(ensureClientMasterSources()).then(() => { if (feedAberto) renderFeedDoCliente(); }).catch(() => {});
  }
  const camada = feedCamada();
  if (!camada) return;
  const todos = feedClientes();
  const ordenada = feedOrdem();
  const jan = feedJanela();
  const totalBuracos = ordenada.reduce((s, c) => s + feedMontar(c).buracos.length, 0);
  let i = ordenada.findIndex((c) => c.nome === FEED.foco);
  if (i < 0 && ordenada.length) { i = 0; FEED.foco = ordenada[0].nome; }
  camada.querySelector('.vfd-c-topo').innerHTML = `<div class="vfd-c-tit"><h2>Feed dos clientes</h2><p>${ordenada.length === 1 ? 'O feed de agora e o que vai sair, como na grade do Instagram.' : `${feedPlural(ordenada.length, 'cliente', 'clientes')} · ${totalBuracos ? `<b class="vfd-r">${feedPlural(totalBuracos, 'post faltando', 'posts faltando')}</b> ${feedEsc(jan.rotulo)}` : `nenhum buraco ${feedEsc(jan.rotulo)}`}`}</p></div>
    <div class="vfd-c-ctl">${feedVistaHtml()}${feedFiltrosHtml(todos)}</div>
    <button type="button" class="vfd-c-fechar" onclick="feedFechar()" aria-label="Fechar o Feed (Esc)"><i aria-hidden="true"></i></button>`;
  feedPintarPalco(camada, ordenada, i);
  feedPintarDoca(camada, ordenada, i);
  const perto = ordenada.filter((_, j) => Math.abs(feedDistancia(j, i, ordenada.length)) <= 2);
  feedPedirPerfis(perto);
  feedPedirArtes(perto);
}
// A camada por cima de tudo; montada uma vez e reaproveitada enquanto o Feed estiver aberto.
function feedCamada() {
  if (typeof document === 'undefined' || !document.body) return null;
  let c = document.getElementById('vfd-camada');
  if (c) { clearTimeout(feedFecharCamada.timer); c.classList.remove('vfd-saindo'); return c; }
  c = document.createElement('div');
  c.id = 'vfd-camada'; c.className = 'vfd-camada';
  c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'true'); c.setAttribute('aria-label', 'Feed dos clientes');
  c.innerHTML = '<div class="vfd-c-topo"></div><div class="vfd-c-palco" aria-live="polite"></div><div class="vfd-c-doca"></div>';
  document.body.append(c);
  document.body.classList.add('vfd-aberto');
  // Na moldura do módulo, não na tela toda: o menu e a barra do Vybe OS seguem à vista (Paulo, 15/11/2026: "agora
  // parece que tô saindo do sistema; acha um meio-termo").
  feedEncaixar(c);
  if (!feedEncaixar.ligado) { feedEncaixar.ligado = true; window.addEventListener('resize', () => { const x = document.getElementById('vfd-camada'); if (x) feedEncaixar(x); }); }
  feedLigarArrasto(c); feedLigarToque(c); feedLigarCarrossel(c);
  requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('vfd-entrou')));
  return c;
}
function feedEncaixar(el) {
  const m = document.getElementById('mundo-moldura'), r = m?.getBoundingClientRect();
  if (r && r.width > 600 && r.height > 400 && innerWidth > 980) {
    Object.assign(el.style, { inset: 'auto', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: getComputedStyle(m).borderRadius || '28px' });
  } else Object.assign(el.style, { inset: '0', left: '', top: '', width: '', height: '', borderRadius: '0' });
}
function feedFecharCamada() {
  const c = typeof document !== 'undefined' ? document.getElementById('vfd-camada') : null;
  if (!c) return;
  c.classList.add('vfd-saindo'); c.classList.remove('vfd-entrou');
  document.body.classList.remove('vfd-aberto');
  clearTimeout(feedFecharCamada.timer);
  feedFecharCamada.timer = setTimeout(() => { if (!feedAberto) c.remove(); }, 320);
}
function feedFechar() {
  FEED.sel = null; FEED.lote = null; FEED.intercalar = null; FEED.atualizar = null;
  if (typeof PAINEIS_DA_BARRA !== 'undefined' && PAINEIS_DA_BARRA.feed && typeof alternarPainelDaBarra === 'function') { if (feedAberto) alternarPainelDaBarra('feed'); }
  else { feedAberto = false; renderFeedDoCliente(); }
}
// Distância de j até a frente i, em círculo (depois do último vem o primeiro).
function feedDistancia(j, i, n) { if (n <= 1) return 0; let d = (((j - i) % n) + n) % n; if (d > Math.floor(n / 2)) d -= n; return d; }
function feedPintarPalco(camada, lista, i) {
  const palco = camada.querySelector('.vfd-c-palco');
  if (!lista.length) { palco.innerHTML = '<p class="vfd-vazio vfd-c-vazio">Nenhum cliente neste filtro.</p>'; return; }
  palco.querySelector('.vfd-c-vazio')?.remove();
  const vivos = new Set();
  lista.forEach((cli, j) => {
    const d = feedDistancia(j, i, lista.length), ad = Math.abs(d);
    vivos.add(cli.nome);
    let cel = [...palco.children].find((x) => x.dataset.cli === cli.nome);
    if (!cel) {
      cel = document.createElement('section');
      cel.className = 'vfd-cel'; cel.dataset.cli = cli.nome;
      cel.innerHTML = '<div class="vfd-cel-rola"></div><button type="button" class="vfd-cel-capa"></button>';
      cel.style.setProperty('--d', String(d > 0 ? FEED_VIZINHOS + 1 : -(FEED_VIZINHOS + 1)));
      palco.append(cel);
    }
    // Quem pula de um lado para o outro (a volta do círculo) não atravessa a tela: some e reaparece.
    const antes = Number(cel.dataset.d ?? d);
    cel.classList.toggle('vfd-pula', Math.abs(antes - d) > FEED_VIZINHOS);
    cel.dataset.d = String(d);
    cel.style.setProperty('--d', String(d)); cel.style.setProperty('--ad', String(ad)); cel.dataset.ad = String(Math.min(ad, 4));
    cel.classList.toggle('vfd-frente', d === 0);
    cel.classList.toggle('vfd-longe', ad > FEED_VIZINHOS);
    cel.setAttribute('aria-hidden', String(d !== 0));
    const capa = cel.querySelector('.vfd-cel-capa');
    capa.setAttribute('aria-label', `Ver o feed de ${cli.nome}`);
    capa.onclick = d === 0 ? null : () => feedFoco(cli.nome);
    capa.tabIndex = d === 0 || ad > FEED_VIZINHOS ? -1 : 0;
    // O conteúdo só de quem aparece; o mesmo HTML não é trocado (a rolagem e o foco ficam onde estavam).
    if (ad <= FEED_VIZINHOS) {
      const html = feedClienteHtml(cli);
      if (cel.vfdHtml !== html) { cel.querySelector('.vfd-cel-rola').innerHTML = html; cel.vfdHtml = html; feedLigarMais(cel); }
    }
  });
  [...palco.children].forEach((x) => { if (x.dataset.cli && !vivos.has(x.dataset.cli)) x.remove(); });
  requestAnimationFrame(() => palco.querySelectorAll('.vfd-pula').forEach((x) => x.classList.remove('vfd-pula')));
}
function feedPintarDoca(camada, lista, i) {
  const doca = camada.querySelector('.vfd-c-doca'), n = lista.length;
  if (n <= 1) { doca.innerHTML = ''; return; }
  const ant = lista[(i - 1 + n) % n], prox = lista[(i + 1) % n];
  const pontos = n <= 30 ? `<span class="vfd-pontos" aria-hidden="true">${lista.map((_, j) => `<i${j === i ? ' class="on"' : ''}></i>`).join('')}</span>` : '';
  doca.innerHTML = `<div class="vfd-doca" role="group" aria-label="Trocar de cliente">
    <button type="button" class="vfd-doca-seta" onclick="feedPasso(-1)" aria-label="Cliente anterior: ${feedEsc(ant.nome)}">‹</button>
    <span class="vfd-doca-meio"><b>${feedEsc(lista[i].nome)}</b><small>${i + 1} / ${n} · próximo: ${feedEsc(prox.nome)}</small>${pontos}</span>
    <button type="button" class="vfd-doca-seta" onclick="feedPasso(1)" aria-label="Próximo cliente: ${feedEsc(prox.nome)}">›</button>
  </div>`;
}
function feedFoco(nome) {
  if (FEED.foco === nome) return;
  FEED.foco = nome;
  // Marcações, lote e prévias são do cliente que estava na frente.
  FEED.sel = null; FEED.lote = null; FEED.intercalar = null; FEED.atualizar = null;
  renderFeedDoCliente();
}
function feedPasso(passo) {
  const lista = feedOrdem(); if (!lista.length) return;
  const i = Math.max(0, lista.findIndex((c) => c.nome === FEED.foco));
  feedFoco(lista[(i + passo + lista.length) % lista.length].nome);
}
// A ordem do carrossel: quem tem buraco primeiro (é onde a rediagramação começa). Fica a mesma enquanto a camada está
// aberta, para o cliente não trocar de lugar no meio da navegação.
function feedOrdem() {
  const lista = feedFiltrados();
  const chave = lista.map((c) => c.nome).sort().join('|') + '#' + (FEED.vista === 'mes' ? FEED.mes : 'semanas');
  if (FEED.ordem?.chave !== chave) {
    const nomes = lista.map((c) => ({ c, b: feedMontar(c).buracos.length })).sort((a, b) => b.b - a.b || a.c.nome.localeCompare(b.c.nome, 'pt-BR')).map((x) => x.c.nome);
    FEED.ordem = { chave, nomes };
  }
  const pos = new Map(FEED.ordem.nomes.map((n, k) => [n, k]));
  return lista.slice().sort((a, b) => (pos.get(a.nome) ?? 0) - (pos.get(b.nome) ?? 0));
}
function feedLigarCarrossel(camada) {
  if (camada.vfdCarrossel) return; camada.vfdCarrossel = true;
  const algoPorCima = () => [...document.querySelectorAll('#fc-overlay, #cartao-rapido, #workspace-drawer, .workflow-modal-overlay')].some((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden' && !x.closest('#vfd-camada'));
  // O Esc é segurado antes por outra parte do painel (no keydown): o Feed fecha quando a tecla sobe.
  window.addEventListener('keyup', (e) => {
    if (e.key !== 'Escape' || !feedAberto || !camada.isConnected || algoPorCima()) return;
    e.preventDefault(); feedFechar();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!feedAberto || !camada.isConnected || algoPorCima()) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault(); feedPasso(e.key === 'ArrowRight' ? 1 : -1);
  });
  // Dois dedos no trackpad (ou a roda com Shift): um passo por gesto.
  let acumulado = 0, travado = 0;
  camada.addEventListener('wheel', (e) => {
    const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0);
    if (!dx || Math.abs(dx) < Math.abs(e.deltaY) * (e.shiftKey ? 0 : 1)) return;
    e.preventDefault();
    if (Date.now() < travado) return;
    acumulado += dx;
    if (Math.abs(acumulado) > 50) { feedPasso(acumulado > 0 ? 1 : -1); acumulado = 0; travado = Date.now() + 520; }
  }, { passive: false });
  // Deslizar no celular, fora de quando o dedo segura uma peça para arrastar.
  let ini = null;
  camada.addEventListener('touchstart', (e) => { ini = e.touches.length === 1 && !e.target.closest?.('.vfd-c-topo') ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null; }, { passive: true });
  camada.addEventListener('touchend', (e) => {
    if (!ini || FEED.arrastando || FEED.arrastou) { ini = null; return; }
    const t = e.changedTouches[0], dx = t.clientX - ini.x, dy = t.clientY - ini.y; ini = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) feedPasso(dx < 0 ? 1 : -1);
  }, { passive: true });
  // A peça abre por inteiro (a gaveta) por baixo desta camada: a camada se recolhe e um botão traz o Feed de volta.
  document.addEventListener('click', (e) => {
    if (!feedAberto || !e.target.closest?.('.cr-abrir')) return;
    camada.classList.add('vfd-recolhida');
    let volta = document.getElementById('vfd-voltar');
    if (!volta) {
      volta = document.createElement('button'); volta.type = 'button'; volta.id = 'vfd-voltar'; volta.className = 'vfd-voltar';
      volta.textContent = '‹ Voltar ao Feed';
      volta.onclick = () => { camada.classList.remove('vfd-recolhida'); volta.remove(); document.querySelector('#workspace-drawer .workspace-close, #workspace-drawer [data-fechar]')?.click?.(); };
      document.body.append(volta);
    }
  }, true);
}

function feedFiltrar(campo, valor) {
  if (!['carteira', 'head', 'cliente'].includes(campo)) return;
  FEED[campo] = String(valor || 'all');
  if (campo === 'cliente' && FEED.cliente !== 'all') { FEED.carteira = 'all'; FEED.head = 'all'; }
  if (campo === 'cliente' && FEED.cliente !== 'all') FEED.foco = FEED.cliente;
  renderFeedDoCliente();
}

async function feedPedirPerfis(lista) {
  const faltam = [...new Set(lista.map((c) => c.usuario).filter((u) => u && !FEED.perfis.has(u) && !FEED.pedindo.has(u)))].slice(0, 40);
  if (!faltam.length) return;
  faltam.forEach((u) => FEED.pedindo.add(u));
  try {
    const r = await fetch(`/api/painel?area=feed_instagram&usuarios=${encodeURIComponent(faltam.join(','))}`, { credentials: 'same-origin' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`);
    for (const u of faltam) FEED.perfis.set(u, d.perfis?.[u] || { usuario: u, erro: 'O Instagram não respondeu agora.' });
  } catch (erro) {
    console.warn('Feed do Instagram indisponível:', erro.message);
    for (const u of faltam) FEED.perfis.set(u, { usuario: u, erro: 'O Instagram não respondeu agora.' });
  } finally {
    faltam.forEach((u) => FEED.pedindo.delete(u));
    if (feedAberto) renderFeedDoCliente();
  }
}

async function feedPedirArtes(lista) {
  // As capas do que vai sair e, sem os posts do Instagram, também das peças já publicadas (o "no ar" da grade).
  // A grade inteira (o calendário todo à frente) e o que já saiu até a próxima parte do "por partes".
  const ids = [...new Set(lista.flatMap((c) => { const g = feedMontar(c); return [...g.grade.filter((x) => x.item), ...g.noAr.slice(0, feedNoArLimite(c.nome) + FEED_NO_AR_LOTE).filter((x) => x.passado)]; })
    .filter((x) => !x.request).map((x) => String(x.item.id)))]
    .filter((id) => !FEED.artes.has(id) && !FEED.pedindoArtes.has(id)).slice(0, 300);
  if (!ids.length) return;
  ids.forEach((id) => FEED.pedindoArtes.add(id));
  try {
    const r = await fetch(`/api/painel?area=arquivos&capa=1&itens=${encodeURIComponent(ids.join(','))}`, { credentials: 'same-origin', cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`);
    for (const id of ids) FEED.artes.set(id, d.itens?.[id] || null);
  } catch (erro) {
    console.warn('Artes do feed indisponíveis:', erro.message);
  } finally {
    ids.forEach((id) => FEED.pedindoArtes.delete(id));
    if (feedAberto) renderFeedDoCliente();
  }
}

// ── Cadastrar: uma peça (o + do X ou "+ Novo post") ou várias de uma vez (as datas marcadas) ─────────────────────────
function feedAbrirCadastro(inicial) {
  if (typeof window.openCadastrosGoverned !== 'function') { feedToast('O cadastro ainda não carregou. Tente de novo em instantes.', 'info'); return false; }
  window.openCadastrosGoverned({ board: 'producao', ...inicial });
  return true;
}
// O + do "sem post" (Paulo, 15/11/2026: "já podia ter o + pra eu cadastrar a demanda direto no feed"): o mesmo cadastro
// do + do calendário, já com o cliente e o dia como veiculação (prazo de ouro calculado) e a data comemorativa no título.
function feedCriarNoDia(cliente, iso) {
  if (!iso) return feedAbrirCadastro({ client: cliente });
  const prazo = typeof goldenDeadlineIso === 'function' ? goldenDeadlineIso(iso) : '';
  const tema = feedSazonal(iso);
  return feedAbrirCadastro({ client: cliente, veic: iso, ...(prazo ? { prazo } : {}), ...(tema ? { titulo: tema, brief: `Data comemorativa: ${tema}.` } : {}) });
}

// Marcar datas: tocar no X (ou na data livre) liga e desliga. As marcações são de um cliente por vez.
function feedMarcar(cliente, iso) {
  if (FEED.arrastou) return;
  if (FEED.sel?.cliente !== cliente) FEED.sel = { cliente, isos: new Set(), fmt: FEED.sel?.fmt || 'reels' };
  if (FEED.sel.isos.has(iso)) FEED.sel.isos.delete(iso);
  else if (FEED.sel.isos.size >= FEED_LOTE_MAX) { feedToast(`Dá para marcar até ${FEED_LOTE_MAX} datas de uma vez.`, 'info'); return; }
  else FEED.sel.isos.add(iso);
  if (!FEED.sel.isos.size) FEED.sel = null;
  renderFeedDoCliente();
}
function feedBarraDoLoteHtml(cli) {
  const s = FEED.sel, isos = [...s.isos].sort();
  const fmts = FEED_FORMATOS.map((f) => `<button type="button" class="vfd-chip" aria-pressed="${s.fmt === f.chave}" onclick="feedLoteFormato('${f.chave}')">${feedEsc(f.nome)}</button>`).join('');
  const fmt = FEED_FORMATOS.find((f) => f.chave === s.fmt) || FEED_FORMATOS[0];
  return `<div class="vfd-barra" role="region" aria-label="Datas marcadas de ${feedEsc(cli.nome)}">
    <p class="vfd-barra-tit"><b>${feedPlural(isos.length, 'data marcada', 'datas marcadas')}</b> · ${isos.map(feedQuando).join(', ')}</p>
    <div class="vfd-ajuste-op" role="group" aria-label="Formato">${fmts}</div>
    <div class="vfd-ajuste-pe">
      <button type="button" class="vfd-acao" onclick="feedLimparMarcas()">Limpar</button>
      <button type="button" class="vfd-acao vfd-acao-p" onclick="feedCadastrarMarcadas()">Cadastrar ${feedPlural(isos.length, fmt.nome, fmt.plural)}</button>
    </div>
    <p class="vfd-ajuste-nota">Abre o cadastro com uma peça por data, já com o dia e o prazo de ouro. Dá para mudar título e briefing de cada uma lá.</p>
  </div>`;
}
function feedLoteFormato(chave) { if (FEED.sel && FEED_FORMATOS.some((f) => f.chave === chave)) { FEED.sel.fmt = chave; renderFeedDoCliente(); } }
function feedLimparMarcas() { FEED.sel = null; renderFeedDoCliente(); }
function feedCadastrarMarcadas() {
  const s = FEED.sel; if (!s?.isos.size) return;
  const fmt = FEED_FORMATOS.find((f) => f.chave === s.fmt) || FEED_FORMATOS[0];
  const itens = [...s.isos].sort().map((iso) => {
    const tema = feedSazonal(iso);
    return { veic: iso, prazo: typeof goldenDeadlineIso === 'function' ? goldenDeadlineIso(iso) : '', titulo: tema || '', brief: tema ? `Data comemorativa: ${tema}.` : '' };
  });
  if (feedAbrirCadastro({ client: s.cliente, format: fmt.cadastro, itens })) { FEED.sel = null; FEED.lote = null; renderFeedDoCliente(); }
}

// "+ Em lote": o formato e quantas peças; o Feed marca as próximas datas livres (os X primeiro, depois os dias sem
// post na ordem seg, qua, sex, ter, qui, sáb, dom) e a barra de baixo cadastra.
function feedLoteAbrir(nome) {
  FEED.lote = FEED.lote?.cliente === nome ? null : { cliente: nome, fmt: FEED.sel?.cliente === nome ? FEED.sel.fmt : 'reels', qtd: 3 };
  FEED.intercalar = null; FEED.atualizar = null;
  renderFeedDoCliente();
}
function feedLoteMudar(campo, valor) {
  const l = FEED.lote; if (!l) return;
  if (campo === 'fmt' && FEED_FORMATOS.some((f) => f.chave === valor)) l.fmt = valor;
  if (campo === 'qtd') l.qtd = Math.max(1, Math.min(FEED_LOTE_MAX, l.qtd + Number(valor || 0)));
  renderFeedDoCliente();
}
function feedLoteHtml(cli) {
  const l = FEED.lote;
  const fmts = FEED_FORMATOS.map((f) => `<button type="button" class="vfd-chip" aria-pressed="${l.fmt === f.chave}" onclick="feedLoteMudar('fmt','${f.chave}')">${feedEsc(f.nome)}</button>`).join('');
  return `<div class="vfd-ajuste" role="group" aria-label="Adicionar em lote para ${feedEsc(cli.nome)}">
    <p class="vfd-ajuste-tit">Formato</p><div class="vfd-ajuste-op">${fmts}</div>
    <p class="vfd-ajuste-tit">Quantas peças</p>
    <div class="vfd-qtd"><button type="button" class="vfd-mes-seta" aria-label="Menos uma" onclick="feedLoteMudar('qtd',-1)">−</button><b>${l.qtd}</b><button type="button" class="vfd-mes-seta" aria-label="Mais uma" onclick="feedLoteMudar('qtd',1)">+</button></div>
    <p class="vfd-ajuste-nota">Marca as próximas datas livres ${feedEsc(feedJanela().rotulo)} (os X primeiro). Depois dá para tirar ou trocar datas na grade antes de cadastrar.</p>
    <div class="vfd-ajuste-pe">
      <button type="button" class="vfd-acao" onclick="feedLoteAbrir('${jsArg(cli.nome)}')">Fechar</button>
      <button type="button" class="vfd-acao vfd-acao-p" onclick="feedLoteEncaixar()">Marcar ${feedPlural(l.qtd, 'data', 'datas')}</button>
    </div>
  </div>`;
}
function feedLoteEncaixar() {
  const l = FEED.lote; if (!l) return;
  const cli = feedClientes().find((c) => c.nome === l.cliente); if (!cli) return;
  FEED.sel = null;
  const g = feedMontar(cli), jan = g.jan, hoje = jan.hoje;
  const escolhidas = g.buracos.map((b) => b.iso).sort().slice(0, l.qtd);
  // Depois dos X, os outros dias livres da janela, semana a semana, na ordem dos dias bons.
  for (let s = 0; s < jan.semanas && escolhidas.length < l.qtd; s += 1) {
    const ini = feedSomar(jan.seg0, s * 7);
    for (const d of FEED_DIAS_PADRAO) {
      if (escolhidas.length >= l.qtd) break;
      const iso = feedSomar(ini, d);
      if (iso < hoje || iso < jan.ini || iso > jan.fim || g.ocupados.has(iso) || escolhidas.includes(iso)) continue;
      escolhidas.push(iso);
    }
  }
  if (!escolhidas.length) { feedToast(`Não há data livre ${jan.rotulo}. Troque para o mês seguinte e tente de novo.`, 'info', 6000); return; }
  if (escolhidas.length < l.qtd) feedToast(`Só ${feedPlural(escolhidas.length, 'data livre', 'datas livres')} ${jan.rotulo}.`, 'info', 5000);
  FEED.sel = { cliente: l.cliente, isos: new Set(escolhidas), fmt: l.fmt };
  FEED.lote = null;
  renderFeedDoCliente();
}

// ── Intercalar formatos: troca as datas das peças entre si para não sair o mesmo formato seguido ───────────────────
function feedIntercalarPropor(nome) {
  if (FEED.intercalar?.cliente === nome) { FEED.intercalar = null; renderFeedDoCliente(); return; }
  FEED.intercalar = null; FEED.lote = null; FEED.atualizar = null;
  const cli = feedClientes().find((c) => c.nome === nome); if (!cli) return;
  const pecas = feedMontar(cli).futuras.filter((x) => !x.request).sort((a, b) => a.iso.localeCompare(b.iso) || String(a.item.id).localeCompare(String(b.item.id)));
  const datas = pecas.map((x) => x.iso), resto = pecas.slice(), ordem = [];
  // As mesmas datas, outra ordem: sempre a próxima peça de formato diferente da anterior (se houver).
  while (resto.length) {
    const ultimo = ordem[ordem.length - 1]?.fmt.chave;
    let i = resto.findIndex((x) => x.fmt.chave !== ultimo); if (i < 0) i = 0;
    ordem.push(resto.splice(i, 1)[0]);
  }
  const moves = ordem.map((x, i) => ({ id: String(x.item.id), de: x.iso, para: datas[i], nome: String(x.item.nome || x.item.titulo || 'Peça'), fmt: x.fmt.nome })).filter((m) => m.de !== m.para);
  if (!moves.length) { feedToast('Os formatos já estão intercalados.', 'info'); renderFeedDoCliente(); return; }
  FEED.intercalar = { cliente: nome, moves };
  renderFeedDoCliente();
}
function feedIntercalarHtml(cli) {
  const m = FEED.intercalar.moves;
  return `<div class="vfd-ajuste" role="group" aria-label="Intercalar formatos de ${feedEsc(cli.nome)}">
    <p class="vfd-ajuste-tit">Intercalar formatos · ${feedPlural(m.length, 'peça muda', 'peças mudam')} de dia</p>
    <ul class="vfd-trocas">${m.map((x) => `<li><b>${feedEsc(x.fmt)}</b> ${feedEsc(x.nome)}: ${feedDm(x.de)} → ${feedDm(x.para)}</li>`).join('')}</ul>
    <p class="vfd-ajuste-nota">A grade abaixo já mostra como fica (as peças que mudam estão marcadas). Aplicar muda a veiculação no calendário.</p>
    <div class="vfd-ajuste-pe">
      <button type="button" class="vfd-acao" onclick="feedIntercalarPropor('${jsArg(cli.nome)}')">Cancelar</button>
      <button type="button" class="vfd-acao vfd-acao-p" ${FEED.salvando ? 'disabled' : ''} onclick="feedIntercalarAplicar()">${FEED.salvando ? 'Aplicando…' : 'Aplicar'}</button>
    </div>
  </div>`;
}
async function feedIntercalarAplicar() {
  const prop = FEED.intercalar; if (!prop || FEED.salvando) return;
  if (typeof moverDataDoItem !== 'function') { feedToast('Não foi possível mover as datas agora.', 'err', 6000); return; }
  FEED.salvando = true; renderFeedDoCliente();
  let feitas = 0, erro = null;
  for (const m of prop.moves) {
    const x = feedAcharItem(m.id); if (!x) continue;
    try { await moverDataDoItem(x.it, 'veiculacao', m.para, { request: x.request, renderizar: false, avisar: false }); feitas += 1; }
    catch (e) { erro = e; break; }
  }
  FEED.salvando = false; FEED.intercalar = null;
  if (erro) feedToast(`${feedPlural(feitas, 'peça mudou', 'peças mudaram')} de dia; a seguinte não gravou: ${erro.message}`, 'err', 8000);
  else feedToast(`Formatos intercalados: ${feedPlural(feitas, 'peça mudou', 'peças mudaram')} de dia.`, 'ok', 5000);
  renderFeedDoCliente();
  if (typeof renderManagerCalendar === 'function') renderManagerCalendar();
  if (typeof renderVisaoDeGrupos === 'function') renderVisaoDeGrupos();
}

// ── Atualizar o Instagram (só os donos): um favorito do navegador lê o perfil aberto no Instagram e grava aqui ──────
// A captura é a mesma de 15/11/2026 (server/instagram-captura.js): o cabeçalho e os 12 primeiros quadros, reduzidos no
// próprio navegador, mandados a uma janela do Vybe OS (?vfd-receber=1), que grava com a sessão do dono.
function feedAtualizarAbrir(nome) { FEED.atualizar = FEED.atualizar === nome ? null : nome; FEED.lote = null; FEED.intercalar = null; renderFeedDoCliente(); }
function feedFavoritoCodigo() {
  const origem = location.origin;
  const corpo = `(async()=>{const O=${JSON.stringify(origem)};const P=location.pathname.split('/').filter(Boolean);`
    + `if(!/(^|\\.)instagram\\.com$/.test(location.hostname)||P.length!==1){alert('Abra o perfil do cliente no Instagram e clique de novo.');return}`
    + `const W=window.open(O+'/?vfd-receber=1','vfdreceber','width=460,height=380');if(!W){alert('O navegador bloqueou a janela do Vybe OS. Libere pop-ups para o Instagram.');return}`
    + `const pk=i=>{if(!i)return'';const s=(i.getAttribute('srcset')||'').split(',').map(x=>x.trim().split(/\\s+/)).filter(x=>x[0]).map(([u,w])=>[u,parseInt(w)||0]);const b=s.filter(x=>x[1]>=300).sort((a,c)=>a[1]-c[1])[0];return(b&&b[0])||i.currentSrc||i.src||''};`
    + `const rd=async(u,l)=>{if(!u)return'';try{const bm=await createImageBitmap(await(await fetch(u,{mode:'cors'})).blob());const s=Math.max(l/bm.width,l/bm.height),w=Math.round(bm.width*s),h=Math.round(bm.height*s),c=document.createElement('canvas');c.width=l;c.height=l;c.getContext('2d').drawImage(bm,(l-w)/2,(l-h)/2,w,h);return c.toDataURL('image/jpeg',.72)}catch(e){return''}};`
    + `const H=document.querySelector('main header')||document.querySelector('header');const M=[...(H?H.querySelectorAll('span,div[role=button]'):[])].find(x=>/^\\s*mais\\s*$/i.test(x.textContent));if(M){M.click();await new Promise(r=>setTimeout(r,600))}`
    + `const L=[...document.querySelectorAll('main a[href*="/p/"],main a[href*="/reel/"]')].slice(0,12);const posts=[];`
    + `for(const a of L){const h=a.getAttribute('href')||'';const c=(h.match(/\\/(?:p|reel)\\/([^/]+)/)||[])[1]||'';const g=a.querySelector('img');`
    + `posts.push({codigo:c,tipo:/\\/reel\\//.test(h)||a.querySelector('svg[aria-label*="Clip" i],svg[aria-label*="Reel" i]')?'reel':a.querySelector('svg[aria-label*="Carross" i],svg[aria-label*="Carousel" i]')?'carrossel':'imagem',fixado:!!a.querySelector('svg[aria-label*="fixad" i],svg[aria-label*="Pinned" i]'),legenda:(g&&g.alt||'').slice(0,300),imagem:await rd(pk(g),360)})}`
    + `const perfil={usuario:P[0].toLowerCase(),capturado_em:new Date().toISOString(),cabecalho:(H&&H.innerText||'').slice(0,2500),foto:await rd(pk(H&&H.querySelector('img')),160),posts};`
    + `let ok=false;await new Promise(r=>{const t=setTimeout(r,90000);addEventListener('message',function f(e){if(e.origin!==O||!e.data)return;`
    + `if(e.data.vfd==='pronto'&&!ok){ok=true;W.postMessage({vfd:'perfil',perfil},O)}`
    + `if(e.data.vfd==='gravado'){clearTimeout(t);removeEventListener('message',f);alert(e.data.ok?'Feed de @'+perfil.usuario+' atualizado no Vybe OS ('+e.data.posts+' posts).':'Não gravou: '+(e.data.erro||'tente de novo.'));r()}})})})()`;
  return `javascript:${encodeURIComponent(corpo)}`;
}
function feedAtualizarHtml(cli) {
  return `<div class="vfd-ajuste" role="group" aria-label="Atualizar o Instagram de ${feedEsc(cli.nome)}">
    <p class="vfd-ajuste-tit">Atualizar o feed lido do Instagram</p>
    <ol class="vfd-passos">
      <li>Arraste este botão para a barra de favoritos do navegador (só na primeira vez): <a class="vfd-favorito" href="${feedFavoritoCodigo()}" onclick="event.preventDefault();feedToast('Arraste o botão para a barra de favoritos; ele funciona na página do Instagram.','info',6000)">Atualizar no Vybe OS</a></li>
      <li>Abra o perfil <a href="https://www.instagram.com/${feedEsc(cli.usuario)}/" target="_blank" rel="noopener noreferrer">@${feedEsc(cli.usuario)}</a> no Instagram, logado em qualquer conta.</li>
      <li>Clique no favorito. Uma janela do Vybe OS abre, grava e avisa quando terminar.</li>
    </ol>
    <p class="vfd-ajuste-nota">Só os donos gravam. Vale para qualquer cliente: é só abrir o perfil dele e clicar no favorito.</p>
  </div>`;
}
// A janela que recebe a captura do favorito: avisa o Instagram que está pronta, grava e responde.
function feedReceberCaptura() {
  if (typeof window === 'undefined' || !/[?&]vfd-receber=1\b/.test(location.search) || !window.opener) return;
  const INSTA = 'https://www.instagram.com';
  let feito = false;
  const ping = setInterval(() => { try { window.opener.postMessage({ vfd: 'pronto' }, INSTA); } catch { /* segue */ } }, 700);
  setTimeout(() => clearInterval(ping), 120000);
  window.addEventListener('message', async (e) => {
    if (e.origin !== INSTA || e.data?.vfd !== 'perfil' || feito) return;
    feito = true; clearInterval(ping);
    let out;
    try {
      const r = await fetch('/api/painel?area=feed_instagram', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'captura', perfil: e.data.perfil }) });
      const d = await r.json().catch(() => ({}));
      out = { ok: r.ok, posts: d.posts, erro: r.status === 401 ? 'entre no Vybe OS nesta janela e clique no favorito de novo.' : r.status === 403 ? 'só os donos atualizam o feed.' : d.error };
    } catch (erro) { out = { ok: false, erro: erro.message }; }
    try { e.source.postMessage({ vfd: 'gravado', ...out }, INSTA); } catch { /* segue */ }
    document.title = out.ok ? 'Feed atualizado' : 'Feed não atualizado';
    if (out.ok) setTimeout(() => window.close(), 1500);
  });
}
feedReceberCaptura();

// ── Abrir a peça: o cartão rápido do calendário, ali mesmo na grade (status, datas, prévia, abrir completa) ─────────
function feedAbrirPeca(id, event, request = false) {
  if (FEED.arrastou) { FEED.arrastou = false; return; }
  if (typeof abrirCartaoRapido === 'function' && event) { abrirCartaoRapido(id, event, request ? 'request' : 'content'); return; }
  if (request && typeof window.openDemandaWorkspace === 'function') { window.openDemandaWorkspace(id); return; }
  if (typeof window.openItemWorkspace === 'function') window.openItemWorkspace(id);
}

function feedAcharItem(id) { return feedItens().find((x) => String(x.it.id) === String(id)) || null; }

// Arrastar: peça sobre peça troca as datas; peça sobre X (ou data livre) leva a peça para aquele dia. Só dentro do
// mesmo cliente.
function feedLigarArrasto(wrap) {
  if (wrap.vfLigado) return; wrap.vfLigado = true;
  wrap.addEventListener('dragstart', (e) => {
    const t = e.target.closest?.('[data-vfd-item]'); if (!t || FEED.salvando) { e.preventDefault?.(); return; }
    FEED.arrastando = { id: t.dataset.vfdItem, cliente: t.dataset.vfdCliente, iso: t.dataset.vfdAlvo };
    try { e.dataTransfer.setData('text/plain', t.dataset.vfdItem); e.dataTransfer.effectAllowed = 'move'; } catch { /* segue */ }
    t.classList.add('vfd-arrastando'); FEED.arrastou = true;
  });
  wrap.addEventListener('dragend', (e) => { e.target.closest?.('[data-vfd-item]')?.classList.remove('vfd-arrastando'); wrap.querySelectorAll('.vfd-sobre').forEach((x) => x.classList.remove('vfd-sobre')); setTimeout(() => { FEED.arrastou = false; }, 0); });
  const alvoDe = (e) => { const a = e.target.closest?.('[data-vfd-alvo]'); const x = FEED.arrastando; return a && x && a.dataset.vfdCliente === x.cliente && a.dataset.vfdItem !== x.id ? a : null; };
  wrap.addEventListener('dragover', (e) => { const a = alvoDe(e); if (!a) return; e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch { /* segue */ } a.classList.add('vfd-sobre'); });
  wrap.addEventListener('dragleave', (e) => { e.target.closest?.('[data-vfd-alvo]')?.classList.remove('vfd-sobre'); });
  wrap.addEventListener('drop', async (e) => {
    const a = alvoDe(e); if (!a) return; e.preventDefault();
    const x = FEED.arrastando; FEED.arrastando = null; a.classList.remove('vfd-sobre');
    await feedSoltar(x, a.dataset.vfdItem || null, a.dataset.vfdAlvo);
  });
}

// No celular não existe arrastar do navegador: segurar a peça (meio segundo) pega; arrastar mostra onde cai; soltar
// grava pelo mesmo caminho. Rolar a tela continua normal se o dedo andar antes de pegar.
function feedLigarToque(wrap) {
  if (wrap.vfdToque) return; wrap.vfdToque = true;
  let toque = null, timer = null, fantasma = null, sobre = null;
  const mover = (x, y) => { if (fantasma) { fantasma.style.left = `${x - fantasma.offsetWidth / 2}px`; fantasma.style.top = `${y - fantasma.offsetHeight / 2}px`; } };
  wrap.addEventListener('touchstart', (e) => {
    const el = e.target.closest?.('.vfd-peca[data-vfd-item]'); if (!el || FEED.salvando || e.touches.length !== 1) return;
    const p = e.touches[0]; toque = { el, x: p.clientX, y: p.clientY, ativo: false };
    timer = setTimeout(() => {
      if (!toque) return;
      toque.ativo = true; FEED.arrastou = true;
      FEED.arrastando = { id: el.dataset.vfdItem, cliente: el.dataset.vfdCliente, iso: el.dataset.vfdAlvo };
      el.classList.add('vfd-arrastando');
      const r = el.getBoundingClientRect();
      fantasma = el.cloneNode(true); fantasma.classList.add('vfd-fantasma'); fantasma.removeAttribute('onclick');
      fantasma.style.width = `${r.width}px`; fantasma.style.height = `${r.height}px`;
      document.body.append(fantasma); mover(toque.x, toque.y);
      try { navigator.vibrate?.(15); } catch { /* segue */ }
    }, 450);
  }, { passive: true });
  wrap.addEventListener('touchmove', (e) => {
    if (!toque) return;
    const p = e.touches[0];
    if (!toque.ativo) { if (Math.hypot(p.clientX - toque.x, p.clientY - toque.y) > 10) { clearTimeout(timer); toque = null; } return; }
    e.preventDefault(); mover(p.clientX, p.clientY);
    const alvo = document.elementFromPoint(p.clientX, p.clientY)?.closest?.('[data-vfd-alvo]');
    const x = FEED.arrastando;
    const ok = alvo && x && alvo.dataset.vfdCliente === x.cliente && alvo.dataset.vfdItem !== x.id ? alvo : null;
    if (sobre && sobre !== ok) sobre.classList.remove('vfd-sobre');
    sobre = ok; sobre?.classList.add('vfd-sobre');
  }, { passive: false });
  const fim = async () => {
    clearTimeout(timer);
    const era = toque; toque = null;
    if (!era?.ativo) return;
    fantasma?.remove(); fantasma = null; era.el.classList.remove('vfd-arrastando');
    const x = FEED.arrastando, a = sobre; FEED.arrastando = null; sobre = null; a?.classList.remove('vfd-sobre');
    setTimeout(() => { FEED.arrastou = false; }, 60);
    if (a && x) await feedSoltar(x, a.dataset.vfdItem || null, a.dataset.vfdAlvo);
  };
  wrap.addEventListener('touchend', fim);
  wrap.addEventListener('touchcancel', fim);
}

async function feedSoltar(origem, idAlvo, isoAlvo) {
  const a = feedAcharItem(origem.id); if (!a || !isoAlvo || isoAlvo === origem.iso) return;
  const b = idAlvo ? feedAcharItem(idAlvo) : null;
  const item = a.it, outro = b?.it || null;
  // Solicitação de feed muda a conclusão (como no calendário); peça de produção, a veiculação.
  const mover = (x, iso) => moverDataDoItem(x.it, 'veiculacao', iso, { request: x.request, renderizar: false, avisar: false });
  if (typeof moverDataDoItem !== 'function') { feedToast('Não foi possível mover a data agora.', 'err', 6000); return; }
  FEED.salvando = true; document.getElementById('vfd-camada')?.classList.add('vfd-salvando'); document.getElementById('feed-board')?.classList.add('vfd-salvando');
  // A data que a peça ocupou deixa de estar marcada para o lote.
  FEED.sel?.isos.delete(isoAlvo);
  try {
    await mover(a, isoAlvo);
    if (b) {
      try { await mover(b, origem.iso); }
      catch (erro) {
        // A segunda não gravou: desfaz a primeira para as duas não caírem no mesmo dia.
        try { await mover(a, origem.iso); } catch { /* fica o aviso */ }
        throw erro;
      }
    }
    const nome = (it) => String(it.nome || it.titulo || 'Peça');
    feedToast(outro ? `Trocadas: ${nome(item)} vai para ${feedDm(isoAlvo)} e ${nome(outro)} para ${feedDm(origem.iso)}.` : `${nome(item)} vai ao ar em ${feedDm(isoAlvo)}.`, 'ok', 5000);
  } catch (erro) {
    feedToast(`Não foi possível mover a data: ${erro.message}`, 'err', 7000);
  } finally {
    FEED.salvando = false; document.getElementById('vfd-camada')?.classList.remove('vfd-salvando'); document.getElementById('feed-board')?.classList.remove('vfd-salvando');
    if (FEED.sel && !FEED.sel.isos.size) FEED.sel = null;
    renderFeedDoCliente();
    if (typeof renderManagerCalendar === 'function') renderManagerCalendar();
    if (typeof renderVisaoDeGrupos === 'function') renderVisaoDeGrupos();
  }
}

// ── O FEED NA DIREÇÃO V2 (prancha V2-M-Feed, aprovada pelo Paulo em 16/11/2026) ──────────────────────────────────────
// No mundo, o Feed deixa de ser a camada com os celulares em carrossel e vira uma vista da Produção, dentro da janela:
// a lista dos clientes à esquerda (quem tem buraco primeiro), a grade inteira do cliente escolhido no meio e, à direita,
// o cartão laranja (quantos posts faltam), as semanas em calendário, as datas marcadas e os atalhos. Tudo que grava é
// o de sempre: feedMarcar, feedCriarNoDia, feedCadastrarMarcadas, o lote, o Intercalar, o arrastar e o Atualizar.
function feedV2Ligado() {
  return typeof document !== 'undefined' && typeof pv2Ligado === 'function' && pv2Ligado() && typeof panelMode !== 'undefined' && panelMode === 'gestor' && Boolean(document.getElementById('pv2-painel'));
}
const FEED_V2_SETA = { antes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>', depois: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' };
function feedV2Foto(cli, classe = 'd3v-foto') {
  const p = cli.usuario ? FEED.perfis.get(cli.usuario) : null;
  const iniciais = cli.nome.trim().slice(0, 2).toUpperCase();
  // A mesma logo das outras telas (vybe-logo-cliente.js); sem esse arquivo, a foto do perfil que o Feed leu.
  if (typeof logoDoClienteHtml === 'function') return logoDoClienteHtml(cli.nome, { classe, iniciais });
  return p && !p.erro && p.foto ? `<img class="${classe}" src="${feedEsc(feedFotoIg(p.foto))}" alt="" loading="lazy">` : `<i class="${classe}" aria-hidden="true">${feedEsc(iniciais)}</i>`;
}
function feedV2Troca(el, html) { if (el && el.vfdHtml !== html) { el.innerHTML = html; el.vfdHtml = html; return true; } return false; }
// A lista dos clientes, direto no vidro: quantos são, quantos posts faltam, a carteira e cada cliente com os buracos dele.
function feedV2ListaHtml(lista, montados, cli, todos) {
  const cart = typeof CARTEIRAS_DA_AGENDA !== 'undefined' ? CARTEIRAS_DA_AGENDA : [];
  const total = lista.reduce((s, c) => s + montados.get(c.nome).buracos.length, 0);
  const heads = [...new Set(todos.flatMap((c) => c.heads))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const seg = (v, rot) => `<button type="button" role="radio" aria-checked="${FEED.carteira === v}" onclick="feedFiltrar('carteira','${jsArg(v)}')">${feedEsc(rot)}</button>`;
  const opc = (v, rot) => `<option value="${feedEsc(v)}"${v === FEED.head ? ' selected' : ''}>${feedEsc(rot)}</option>`;
  return `<div class="d3m-cons-cab"><b>${feedPlural(lista.length, 'cliente', 'clientes')}</b><span>${total ? feedPlural(total, 'post faltando', 'posts faltando') : 'nenhum buraco'}</span></div>
    <div class="d3m-a-vseg" role="radiogroup" aria-label="Carteira">${seg('all', 'Todos')}${cart.map((c) => seg(c.id, c.apelido)).join('')}</div>
    <div class="vfd2-clis" role="radiogroup" aria-label="Cliente">${lista.map((c) => { const b = montados.get(c.nome).buracos.length, on = c.nome === cli?.nome;
      return `<button type="button" class="d3m-vlin vfd2-cli${on ? ' on' : ''}" role="radio" aria-checked="${on}" data-vfd2-cli="${feedEsc(c.nome)}" onclick="feedFoco('${jsArg(c.nome)}')" title="${feedEsc(c.nome)}: ${b ? feedPlural(b, 'post faltando', 'posts faltando') : 'sem buracos'} ${feedEsc(feedJanela().rotulo)}">${feedV2Foto(c)}<span class="d3m-vnome">${feedEsc(c.nome)}</span>${b ? `<i class="d3m-pt r" aria-hidden="true"></i><b class="d3m-vn">${b}</b>` : '<svg class="vfd2-ok" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>'}</button>`; }).join('') || '<p class="d3m-vvazio">Nenhum cliente neste filtro.</p>'}</div>
    ${heads.length > 1 ? `<label class="vfd2-head"><span>Head</span><select onchange="feedFiltrar('head',this.value)" aria-label="Filtrar por head">${opc('all', 'Todos')}${heads.map((h) => opc(h, h)).join('')}</select></label>` : ''}`;
}
// A grade do cliente, como no Instagram: o perfil em cima; o que vai sair (o mais novo em cima) e, colado, o que está no ar.
function feedV2GradeHtml(cli, g) {
  const p = g.perfil && !g.perfil.erro ? g.perfil : null;
  // Tudo o que o cliente tem no calendário, sem corte: a grade rola por dentro da folha.
  const futuro = g.grade, aSair = futuro.filter((t) => t.item).length;
  const usuario = cli.usuario ? `<a class="vfd-ig-user" href="https://www.instagram.com/${feedEsc(cli.usuario)}/" target="_blank" rel="noopener noreferrer">${feedEsc(cli.usuario)}</a>` : `<span class="vfd-ig-user vfd-sem-insta">${feedEsc(cli.nome)}</span>`;
  const nums = p ? `${feedNumeroIg(p.total_posts)} posts · ${feedNumeroIg(p.seguidores)} seguidores` : cli.usuario ? 'lendo o Instagram…' : 'sem Instagram no cadastro';
  const bio = String(p?.bio || cli.bio || '').trim();
  const noAr = feedNoArHtml(cli, g);
  const lido = p?.fonte === 'captura' ? `feed lido em ${feedDm(String(p.capturado_em || '').slice(0, 10))}` : p?.fonte === 'meta' ? 'pela conta da Meta' : p ? 'do perfil público' : noAr ? 'as últimas veiculadas' : '';
  return `<div class="vfd2-perfil">${feedV2Foto(cli, 'vfd2-avatar')}<div><p class="vfd2-user">${usuario}</p><p class="vfd2-nums">${feedEsc(nums)}</p>${bio ? `<p class="vfd2-bio" title="${feedEsc(bio)}">${feedEsc(bio.split('\n')[0])}</p>` : ''}</div></div>
    <div class="vfd2-rola" data-vfd2-rola="${feedEsc(cli.nome)}">
      <p class="vfd2-rot"><span>a sair, o mais novo em cima</span><span>${aSair ? `${feedPlural(aSair, 'post', 'posts')} até ${feedDm(futuro[0].iso)}` : ''}</span></p>
      <div class="vfd-grade" data-vfd-grade="${feedEsc(cli.nome)}">${futuro.map((t) => feedTileHtml(t, cli)).join('') || `<p class="vfd-vazio">Nada programado ${feedEsc(g.jan.rotulo)}.</p>`}</div>
      <p class="vfd2-rot vfd2-hoje" data-vfd2-hoje><span>no ar</span><span>até hoje, ${feedEsc(feedQuando(g.jan.hoje))}${lido ? ` · ${feedEsc(lido)}` : ''}</span></p>
      <div class="vfd-grade">${noAr || '<p class="vfd-vazio">Nada no ar ainda por aqui.</p>'}</div>
    </div>`;
}
// As semanas em calendário: uma linha por semana, sete dias; a peça com o formato (a cor embaixo é o status), o X onde
// falta post (tocar marca a data para o lote) e o ponto no dia livre. À direita, quantos posts a semana tem de três.
function feedV2SemanasHtml(cli, g) {
  const jan = g.jan, hoje = jan.hoje, nome = jsArg(cli.nome);
  const troca = FEED.intercalar?.cliente === cli.nome ? new Map(FEED.intercalar.moves.map((m) => [m.id, m.para])) : null;
  const pecas = feedDoCliente(cli.nome).map((x) => (troca?.has(String(x.item.id)) ? { ...x, iso: troca.get(String(x.item.id)) } : x)).filter((x) => x.iso >= jan.ini && x.iso <= jan.fim);
  const buraco = new Map([...g.buracos, ...g.livres].map((b) => [b.iso, b]));
  const curto = (iso) => `${Number(iso.slice(8, 10))} ${FEED_MESES[Number(iso.slice(5, 7)) - 1].slice(0, 3)}`;
  const linhas = [];
  for (let s = 0; s < jan.semanas; s += 1) {
    const ini = feedSomar(jan.seg0, s * 7), fim = feedSomar(ini, 6);
    const daSemana = pecas.filter((x) => x.iso >= ini && x.iso <= fim);
    const meta = Math.min(FEED_POR_SEMANA, FEED_DIAS_PADRAO.map((d) => feedSomar(ini, d)).filter((iso) => iso >= jan.ini && iso <= jan.fim).length);
    const dias = Array.from({ length: 7 }, (_, d) => {
      const iso = feedSomar(ini, d), fora = iso < jan.ini || iso > jan.fim, doDia = daSemana.filter((x) => x.iso === iso), b = buraco.get(iso), quando = feedQuando(iso);
      if (doDia.length) {
        const x = doDia[0], it = x.item, st = String(it.status || ''), cor = it.status_color || (typeof corDeStatus === 'function' ? corDeStatus(st)?.cor : '') || '';
        return `<button type="button" class="vfd2-dia vfd2-peca${iso < hoje ? ' passou' : ''}" ${iso < hoje ? '' : 'draggable="true" '}data-vfd-item="${feedEsc(String(it.id))}" data-vfd-alvo="${feedEsc(iso)}" data-vfd-cliente="${feedEsc(cli.nome)}"${cor ? ` style="--st:${feedEsc(cor)}"` : ''} onclick="feedAbrirPeca('${jsArg(String(it.id))}',event,${x.request ? 'true' : 'false'})" title="${feedEsc(String(it.nome || it.titulo || 'Peça'))} · ${feedEsc(quando)}${st ? ' · ' + feedEsc(st) : ''}${doDia.length > 1 ? ` · mais ${doDia.length - 1} no dia` : ''}"><span>${feedEsc(x.fmt.nome)}</span>${doDia.length > 1 ? `<small>+${doDia.length - 1}</small>` : ''}</button>`;
      }
      if (b) return `<button type="button" class="vfd2-dia vfd2-x${b.marcado ? ' on' : ''}${b.livre ? ' livre' : ''}" role="switch" aria-checked="${Boolean(b.marcado)}" data-vfd-alvo="${feedEsc(iso)}" data-vfd-cliente="${feedEsc(cli.nome)}" onclick="feedMarcar('${nome}','${jsArg(iso)}')" title="${b.marcado ? 'Desmarcar' : 'Marcar'} ${feedEsc(quando)}${b.sazonal ? ` (${feedEsc(b.sazonal)})` : ''} para cadastrar em lote" aria-label="${b.livre ? 'Data livre' : 'Sem post'} ${feedEsc(quando)}${b.marcado ? ', marcada' : ''}"><i aria-hidden="true"></i></button>`;
      if (fora || iso < hoje) return '<span class="vfd2-dia vfd2-nada" aria-hidden="true"><i></i></span>';
      return `<button type="button" class="vfd2-dia vfd2-nada" data-vfd-alvo="${feedEsc(iso)}" data-vfd-cliente="${feedEsc(cli.nome)}" onclick="feedMarcar('${nome}','${jsArg(iso)}')" title="Marcar ${feedEsc(quando)} como data livre para o lote" aria-label="Dia livre ${feedEsc(quando)}: marcar para o lote"><i aria-hidden="true"></i></button>`;
    }).join('');
    const n = daSemana.length;
    linhas.push(`<div class="vfd2-sem" role="row"><span class="vfd2-sem-rot">${curto(ini > jan.ini ? ini : jan.ini).split(' ')[0]} a ${curto(fim < jan.fim ? fim : jan.fim)}</span>${dias}<b class="vfd2-sem-n ${n >= meta ? 'g' : 'r'}">${n} de ${meta}</b></div>`);
  }
  const mes = FEED.mes || feedMesAtual();
  const titulo = jan.modo === 'mes' ? `<span class="d3m-a-setas" role="group" aria-label="Trocar de mês"><button type="button" class="d3v-btn txt ico s" aria-label="Mês anterior" onclick="feedVista('mes',-1)" ${mes <= feedMesAtual() ? 'disabled' : ''}>${FEED_V2_SETA.antes}</button><button type="button" class="d3v-btn txt ico s" aria-label="Próximo mês" onclick="feedVista('mes',1)">${FEED_V2_SETA.depois}</button></span>` : '';
  const nota = `${FEED_POR_SEMANA} posts por semana · a cor embaixo é o status`;
  return `<section class="d3m-a-folha vfd2-semanas" aria-label="Semanas de ${feedEsc(cli.nome)}"><div class="d3m-a-cab"><h3 class="${titulo ? '' : 'd3m-a-so'}"><span>${jan.modo === 'mes' ? feedEsc(feedNomeMes(mes).replace(/^./, (c) => c.toUpperCase())) : `As próximas ${FEED_SEMANAS} semanas`}</span></h3>${titulo}<span class="d3v-rot">${feedEsc(nota)}</span></div>
    <div class="vfd2-cal" role="table" aria-label="Posts por dia"><div class="vfd2-sem vfd2-sem-cab" aria-hidden="true"><span class="vfd2-sem-rot"></span>${['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => `<span>${d}</span>`).join('')}<b class="vfd2-sem-n"></b></div>${linhas.join('')}</div></section>`;
}
// A coluna da direita: o laranja, as semanas, as datas marcadas (ou o painel aberto) e os atalhos no vidro.
function feedV2LadoHtml(cli, g) {
  const nome = jsArg(cli.nome), jan = g.jan, b = g.buracos.length;
  const podeIntercalar = g.futuras.filter((x) => !x.request).length >= 3;
  const palavras = ['Nenhum', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco'];
  const apoio = [g.semArte ? `${palavras[g.semArte] || g.semArte} já ${g.semArte === 1 ? 'cadastrado ainda está' : 'cadastrados ainda estão'} sem arte.` : '',
    g.atrasadas ? `${feedPlural(g.atrasadas, 'peça com o prazo de ouro vencido', 'peças com o prazo de ouro vencido')}.` : '',
    g.repetido ? `Três ${g.repetido} seguidos deixam a grade repetida.` : '',
    cli.heads?.length ? `${cli.heads.slice(0, 2).join(' e ')} ${cli.heads.length > 1 ? 'são os heads' : 'é o head'}.` : ''].filter(Boolean).join(' ');
  const botoes = `<button type="button" class="d3m-btn l" aria-expanded="${FEED.lote?.cliente === cli.nome}" onclick="feedLoteAbrir('${nome}')">Preencher em lote</button>${podeIntercalar ? `<button type="button" class="d3m-btn l s" aria-expanded="${FEED.intercalar?.cliente === cli.nome}" onclick="feedIntercalarPropor('${nome}')">Intercalar formatos</button>` : ''}`;
  const laranja = `<section class="d3-acao d3p-acao d3m-laranja vfd2-laranja" aria-label="O que falta no feed de ${feedEsc(cli.nome)}"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">V</span>VYBES · o feed de ${feedEsc(cli.nome)}</span>
      <span class="d3m-lar-txt"><b class="d3m-lar-num">${b || g.futuras.length}</b><span class="d3-acao-frase">${b ? `${b === 1 ? 'post faltando' : 'posts faltando'} ${feedEsc(jan.rotulo)}` : `${g.futuras.length === 1 ? 'post a sair' : 'posts a sair'} ${feedEsc(jan.rotulo)}, ${FEED_POR_SEMANA} por semana`}</span>${apoio ? `<small>${feedEsc(apoio)}</small>` : ''}</span><span class="d3m-lar-bts">${botoes}</span></section>`;
  const sel = FEED.sel?.cliente === cli.nome && FEED.sel.isos.size ? FEED.sel : null;
  let marcadas = '';
  if (sel) {
    const isos = [...sel.isos].sort(), fmt = FEED_FORMATOS.find((f) => f.chave === sel.fmt) || FEED_FORMATOS[0];
    marcadas = `<div class="vfd2-marcadas" role="region" aria-label="Datas marcadas de ${feedEsc(cli.nome)}"><button type="button" class="vfd2-desmarcar" onclick="feedLimparMarcas()" title="Desmarcar todas" aria-label="Desmarcar todas as datas"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></button>
      <span class="vfd2-marcadas-txt"><b>${feedPlural(isos.length, 'data marcada', 'datas marcadas')}</b> · ${feedEsc(isos.map(feedQuando).join(isos.length === 2 ? ' e ' : ', '))}</span>
      <select class="vfd2-fmt" aria-label="Formato das peças" onchange="feedLoteFormato(this.value)">${FEED_FORMATOS.map((f) => `<option value="${f.chave}"${f.chave === sel.fmt ? ' selected' : ''}>${feedEsc(f.nome)}</option>`).join('')}</select>
      <button type="button" class="d3v-btn vfd2-cadastrar" onclick="feedCadastrarMarcadas()" title="Abre o cadastro com uma peça por data, já com o dia e o prazo de ouro">Cadastrar ${isos.length === 1 ? `1 ${feedEsc(fmt.nome)}` : `as ${isos.length}`}</button></div>`;
  }
  const painel = FEED.lote?.cliente === cli.nome ? feedLoteHtml(cli) : FEED.intercalar?.cliente === cli.nome ? feedIntercalarHtml(cli) : FEED.atualizar === cli.nome ? feedAtualizarHtml(cli) : '';
  const p = g.perfil && !g.perfil.erro ? g.perfil : null;
  const lido = p?.fonte === 'captura' ? `última leitura em ${feedDm(String(p.capturado_em || '').slice(0, 10))}` : 'ler o feed de agora';
  const vlin = (html, acao, dica, extra = '') => `<button type="button" class="d3m-vlin" onclick="${acao}" title="${feedEsc(dica)}"${extra}><span>${html}</span>${FEED_V2_SETA.depois}</button>`;
  const atalhos = `<p class="d3m-vlin vfd2-info"><span><b>Arrastar troca as datas</b> · e o calendário do cliente muda junto</span></p>`
    + vlin('<b>Novo post</b> · escolher o dia no cadastro', `feedCriarNoDia('${nome}','')`, 'Cadastrar um post deste cliente')
    + (feedSouDono() && cli.usuario ? vlin(`<b>Atualizar o Instagram</b> · ${feedEsc(lido)}`, `feedAtualizarAbrir('${nome}')`, 'Atualizar o feed lido do Instagram', ` aria-expanded="${FEED.atualizar === cli.nome}"`) : '');
  return `${laranja}${feedV2SemanasHtml(cli, g)}${marcadas}${painel ? `<div class="d3m-a-folha vfd2-painel">${painel}</div>` : ''}<div class="vfd2-atalhos">${atalhos}</div>`;
}
function feedV2Pintar(wrap) {
  if (typeof garantirClientesAtivos === 'function') { try { garantirClientesAtivos(); } catch { /* segue */ } }
  if (typeof ensureClientMasterSources === 'function' && !feedClientes.pedido) {
    feedClientes.pedido = true;
    Promise.resolve(ensureClientMasterSources()).then(() => { if (feedAberto) renderFeedDoCliente(); }).catch(() => {});
  }
  // A lista é o seletor de cliente: o filtro "cliente" da camada antiga não vale aqui.
  if (FEED.cliente !== 'all') FEED.cliente = 'all';
  wrap.classList.remove('focus-hidden'); wrap.classList.add('d3m-a-v2');
  if (!wrap.querySelector('#vfd2-lista')) {
    wrap.innerHTML = '<aside class="vfd2-lista d3m-lado" id="vfd2-lista" aria-label="Clientes"></aside><section class="d3m-a-folha vfd2-cel" id="vfd2-cel" aria-live="polite"></section><div class="vfd2-lado" id="vfd2-lado"></div>';
    feedLigarArrasto(wrap); feedLigarToque(wrap); feedV2Teclas();
  }
  const todos = feedClientes(), ordenada = feedOrdem(), jan = feedJanela();
  let i = ordenada.findIndex((c) => c.nome === FEED.foco);
  if (i < 0 && ordenada.length) { i = 0; FEED.foco = ordenada[0].nome; }
  const cli = ordenada[i] || null;
  const montados = new Map(ordenada.map((c) => [c.nome, feedMontar(c)]));
  feedV2Troca(wrap.querySelector('#vfd2-lista'), feedV2ListaHtml(ordenada, montados, cli, todos));
  const cel = wrap.querySelector('#vfd2-cel'), lado = wrap.querySelector('#vfd2-lado');
  if (!cli) {
    feedV2Troca(cel, '<p class="d3v-estado"><b>Nenhum cliente neste filtro.</b>Troque a carteira ou o head para ver os feeds.</p>'); feedV2Troca(lado, '');
  } else {
    const g = montados.get(cli.nome), rola = cel.querySelector('.vfd2-rola'), chave = `${cli.nome}|${FEED.vista}|${FEED.mes}`;
    const topo = rola && rola.dataset.vfd2Rola === cli.nome && cel.vfdChave === chave ? rola.scrollTop : null;
    cel.setAttribute('aria-label', `Feed de ${cli.nome}`);
    if (feedV2Troca(cel, feedV2GradeHtml(cli, g))) {
      const novo = cel.querySelector('.vfd2-rola');
      if (novo && topo != null) novo.scrollTop = topo; else if (novo) feedV2Ancorar(novo, g.jan);
    }
    cel.vfdChave = chave;
    feedLigarMais(cel);
    feedV2Troca(lado, feedV2LadoHtml(cli, g));
    wrap.classList.toggle('vfd-com-sel', Boolean(FEED.sel?.cliente === cli.nome && FEED.sel.isos.size));
    wrap.querySelector('.vfd2-cli.on')?.scrollIntoView?.({ block: 'nearest' });
  }
  // No topo da janela: o período (4 semanas ou o mês) e as setas que passam de cliente.
  const n = ordenada.length, prox = n > 1 ? ordenada[(i + 1) % n] : null, ant = n > 1 ? ordenada[(i - 1 + n) % n] : null;
  const ctl = document.getElementById('pv2-feed-ctl');
  if (ctl) feedV2Troca(ctl, `<span class="pv2-seg d3m-a-vseg" role="radiogroup" aria-label="Período do feed"><button type="button" role="radio" aria-checked="${FEED.vista !== 'mes'}" onclick="feedVista('semanas')">${FEED_SEMANAS} semanas</button><button type="button" role="radio" aria-checked="${FEED.vista === 'mes'}" onclick="feedVista('mes')">Mês</button></span>
    <button type="button" class="d3m-ico" onclick="feedPasso(-1)" ${n > 1 ? '' : 'disabled'} aria-label="Cliente anterior${ant ? `: ${feedEsc(ant.nome)}` : ''}" title="Cliente anterior${ant ? `: ${feedEsc(ant.nome)}` : ''} (seta para a esquerda)">${FEED_V2_SETA.antes}</button><button type="button" class="d3m-ico" onclick="feedPasso(1)" ${n > 1 ? '' : 'disabled'} aria-label="Próximo cliente${prox ? `: ${feedEsc(prox.nome)}` : ''}" title="Próximo cliente${prox ? `: ${feedEsc(prox.nome)}` : ''} (seta para a direita)">${FEED_V2_SETA.depois}</button>`);
  if (typeof pv2Vista !== 'undefined') {
    pv2Vista.feed = { linha: cli ? `feed dos clientes · ${cli.nome}, ${i + 1} de ${n}${prox ? ` · depois vem ${prox.nome}` : ''}` : `feed dos clientes · nenhum cliente neste filtro ${jan.rotulo}`, lado: '' };
    if (typeof pv2PintarVista === 'function' && document.body.dataset.pv2Vista === 'feed') pv2PintarVista('feed');
  }
  // As fotos da lista são as do perfil de cada cliente; as artes, só do cliente à mostra.
  feedPedirPerfis(ordenada);
  if (cli) feedPedirArtes([cli]);
}
// A posição de abrir: a peça mais nova dentro da janela (as próximas semanas ou o mês) no alto da grade; o que vem
// depois fica acima, a um rolar de distância.
function feedV2Ancorar(rola, jan) {
  const ir = () => {
    const alvo = [...rola.querySelectorAll('.vfd-grade[data-vfd-grade] > [data-vfd-alvo]')].find((el) => el.dataset.vfdAlvo <= jan.fim);
    if (!alvo) { rola.scrollTop = 0; return; }
    rola.scrollTop = Math.max(0, alvo.getBoundingClientRect().top - rola.getBoundingClientRect().top + rola.scrollTop - 24);
  };
  ir(); if (typeof requestAnimationFrame === 'function') requestAnimationFrame(ir);
}
// ← e → passam de cliente enquanto o Feed está aberto na janela (fora de campo de texto e sem nada por cima).
function feedV2Teclas() {
  if (feedV2Teclas.ligado) return; feedV2Teclas.ligado = true;
  document.addEventListener('keydown', (e) => {
    if (!feedAberto || !feedV2Ligado() || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if ([...document.querySelectorAll('#fc-overlay, #cartao-rapido, #workspace-drawer, .workflow-modal-overlay, dialog[open]')].some((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden')) return;
    e.preventDefault(); feedPasso(e.key === 'ArrowRight' ? 1 : -1);
  });
}

if (typeof window !== 'undefined') Object.assign(window, { toggleFeedDoCliente, renderFeedDoCliente, feedFiltrar, feedAbrirPeca, feedFechar, feedPasso, feedFoco });
