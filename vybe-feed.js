// FEED DO CLIENTE (Painel de trabalho › Feed). Paulo, 15/11/2026: "uma categoria nova no estilo calendário, mas
// mostrando o feed do cliente... o estado atual do Insta + o que tem no calendário pra sair, montando o feed futuro;
// se a arte não tiver pronta fica uma artezinha com o nome do formato; se não tiver nada cadastrado fica um X
// vermelho; o arrastar funciona igual no calendário e já muda a estrutura do calendário do cliente".
//
// A grade é a do Instagram (3 colunas, o mais novo em cima à esquerda):
//   - em cima, o futuro: as peças de feed com veiculação de hoje em diante (arte do Drive quando há; sem arte, uma
//     arte provisória com o formato) e um X vermelho em cada post que falta para chegar a 3 por semana (a mesma régua
//     do "Menos de 3 posts" do Painel), nas próximas 4 semanas;
//   - embaixo, o que já está no ar: os posts públicos do perfil (server/instagram-feed.js, sem conectar conta). Sem o
//     perfil, as últimas peças veiculadas pelo Vybe OS.
// Arrastar uma peça sobre outra troca as datas das duas; sobre um X, leva a peça para aquele dia. Grava pelo mesmo
// caminho do calendário (moverDataDoItem), então o calendário e o Monday mudam junto.

const FEED_LEMBRA = 'vybe_feed_aberto';
let feedAberto = (() => { try { return localStorage.getItem(FEED_LEMBRA) === '1'; } catch { return false; } })();
const FEED = { carteira: 'all', head: 'all', cliente: 'all', perfis: new Map(), pedindo: new Set(), artes: new Map(), pedindoArtes: new Set(), arrastando: null, salvando: false };
const FEED_SEMANAS = 4, FEED_POR_SEMANA = 3, FEED_GRADE_MAX = 15;

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
function feedEsc(v) { return typeof safeText === 'function' ? safeText(v) : String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`); }
function feedNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
function feedPlural(n, um, varios) { return `${n} ${n === 1 ? um : varios}`; }

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
    return { nome, usuario: feedUsuario(insta), carteira: typeof carteiraDoCliente === 'function' ? carteiraDoCliente(nome) : '', heads, bio, site };
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
  const doCliente = feedItens().filter((x) => feedClientesDoItem(x.it).some((n) => feedNorm(n) === alvo))
    .map((x) => ({ item: x.it, request: x.request, iso: x.iso, fmt: x.request ? feedFormato({ formato: x.it.tipo || x.it.formato }) : feedFormato(x.it) }))
    .filter((x) => x.fmt.feed && /^\d{4}-\d{2}-\d{2}$/.test(x.iso));
  return doCliente;
}

// Monta a grade de um cliente: futuro (peças e buracos) e o que está no ar.
function feedMontar(cli) {
  const hoje = feedHoje(), seg0 = feedSegunda(hoje), fim = feedSomar(seg0, FEED_SEMANAS * 7 - 1);
  const todas = feedDoCliente(cli.nome);
  const futuras = todas.filter((x) => x.iso >= hoje && x.iso <= fim);
  const depois = todas.filter((x) => x.iso > fim).length;
  const buracos = [];
  for (let s = 0; s < FEED_SEMANAS; s += 1) {
    const ini = feedSomar(seg0, s * 7), fimS = feedSomar(ini, 6);
    const n = futuras.filter((x) => x.iso >= ini && x.iso <= fimS).length;
    let falta = FEED_POR_SEMANA - n; if (falta <= 0) continue;
    // Dias bons para um post: seg, qua, sex; depois ter, qui; só de hoje em diante e sem peça no dia.
    const ocupados = new Set(futuras.map((x) => x.iso));
    for (const d of [0, 2, 4, 1, 3, 5]) {
      if (!falta) break; const iso = feedSomar(ini, d);
      if (iso < hoje || ocupados.has(iso) || buracos.some((b) => b.iso === iso)) continue;
      buracos.push({ iso, buraco: true }); falta -= 1;
    }
  }
  const futuro = [...futuras, ...buracos].sort((a, b) => b.iso.localeCompare(a.iso) || Number(Boolean(a.buraco)) - Number(Boolean(b.buraco)));
  const perfil = cli.usuario ? FEED.perfis.get(cli.usuario) : null;
  const noAr = perfil?.posts?.length ? perfil.posts.map((p) => ({ ig: p }))
    : todas.filter((x) => x.iso < hoje).sort((a, b) => b.iso.localeCompare(a.iso)).slice(0, 9).map((x) => ({ ...x, passado: true }));
  // Três do mesmo formato em seguida, na ordem em que vão ao ar: a grade fica repetida.
  const seq = futuras.slice().sort((a, b) => a.iso.localeCompare(b.iso));
  let repetido = null;
  for (let i = 2; i < seq.length && !repetido; i += 1) if (seq[i].fmt.chave === seq[i - 1].fmt.chave && seq[i].fmt.chave === seq[i - 2].fmt.chave && seq[i].fmt.chave !== 'post') repetido = seq[i].fmt.nome;
  const semArte = futuras.filter((x) => FEED.artes.has(String(x.item.id)) && !FEED.artes.get(String(x.item.id))).length;
  return { futuro, noAr, futuras, buracos, depois, perfil, repetido, semArte };
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
  return /^data:image\//.test(u) ? u : `/api/painel?area=feed_instagram&foto=${encodeURIComponent(u)}`;
}
function feedNumeroIg(n) {
  const v = Number(n); if (!Number.isFinite(v)) return '–';
  if (v >= 1e6) return `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (v >= 1e4) return `${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString('pt-BR');
}

function feedTileHtml(t, cli) {
  if (t.buraco) {
    return `<div class="vfd-t vfd-x" data-vfd-alvo="${feedEsc(t.iso)}" data-vfd-cliente="${feedEsc(cli.nome)}" title="Sem post para ${FEED_DIAS[feedDiaSemana(t.iso)]} ${feedDm(t.iso)}: arraste uma peça para cá">
      <span class="vfd-x-marca" aria-hidden="true"></span><span class="vfd-x-txt">sem post</span><span class="vfd-data vfd-futuro">${FEED_DIAS[feedDiaSemana(t.iso)]} ${feedDm(t.iso)}</span></div>`;
  }
  if (t.ig) {
    const p = t.ig, icone = p.tipo === 'carrossel' ? '<i class="vfd-tipo vfd-tipo-carrossel" aria-label="Carrossel"></i>' : p.tipo === 'video' ? '<i class="vfd-tipo vfd-tipo-video" aria-label="Vídeo"></i>' : '';
    return `<a class="vfd-t vfd-ig" href="${feedEsc(p.link)}" target="_blank" rel="noopener noreferrer" title="No ar desde ${feedEsc(feedDm(String(p.data || '').slice(0, 10)))}: abrir no Instagram">
      <img src="${feedEsc(feedFotoIg(p.imagem))}" alt="" loading="lazy" onerror="this.closest('.vfd-t').classList.add('vfd-sem-img');this.remove()">${icone}</a>`;
  }
  const it = t.item, id = String(it.id), arte = t.request ? null : FEED.artes.get(id);
  const nome = String(it.nome || it.titulo || 'Peça');
  const status = typeof statusEmFrase === 'function' ? statusEmFrase(it.status || '') : String(it.status || '');
  const quando = `${FEED_DIAS[feedDiaSemana(t.iso)]} ${feedDm(t.iso)}`;
  const corpo = arte?.thumb
    ? `<img src="${feedEsc(String(arte.thumb).replace(/sz=\d+/, 'sz=480'))}" alt="" loading="lazy" onerror="this.closest('.vfd-t').classList.add('vfd-sem-img');this.remove()">${/^(mp4|mov|m4v|webm|avi)$/i.test(String(arte.extensao || '')) ? '<i class="vfd-tipo vfd-tipo-video" aria-label="Vídeo: frame do Drive"></i>' : arte.total > 1 ? '<i class="vfd-tipo vfd-tipo-carrossel" aria-label="Mais de um arquivo"></i>' : ''}`
    : `<span class="vfd-prov vfd-prov-${feedEsc(t.fmt.chave)}"><b>${feedEsc(t.fmt.nome)}</b><small>${feedEsc(nome)}</small></span>`;
  if (t.passado) return `<div class="vfd-t vfd-passado" title="${feedEsc(nome)} · veiculada em ${feedEsc(feedDm(t.iso))}">${corpo}</div>`;
  return `<button type="button" class="vfd-t vfd-peca${arte?.thumb ? '' : ' vfd-sem-arte'}" draggable="true" data-vfd-item="${feedEsc(id)}" data-vfd-alvo="${feedEsc(t.iso)}" data-vfd-cliente="${feedEsc(cli.nome)}"
      title="${feedEsc(nome)} · ${feedEsc(t.fmt.nome)} · ${feedEsc(quando)}${status ? ' · ' + feedEsc(status) : ''}${arte?.thumb || t.request ? '' : ' · arte ainda não enviada'}. Arraste para trocar o dia; clique para abrir."
      onclick="feedAbrirPeca('${jsArg(id)}')">${corpo}<span class="vfd-data vfd-futuro">${feedEsc(quando)}</span></button>`;
}

// O cartão de cada cliente é o perfil do Instagram (Paulo, 15/11/2026: "é pra ficar tipo o feed mesmo do Insta, bio,
// tudo certinho"): foto, números, nome, bio e link; depois a grade única, com o que vai sair em cima (marcado com o
// dia) e o que já está no ar embaixo, como vai ficar quando tudo for publicado.
function feedClienteHtml(cli) {
  const g = feedMontar(cli);
  const p = g.perfil && !g.perfil.erro ? g.perfil : null;
  // Corta pelo mais longe, nunca pelo mais perto: o que sai primeiro encosta no que já está no ar.
  const futuro = g.futuro.slice(-FEED_GRADE_MAX);
  const resto = g.futuro.length - futuro.length;
  const avisos = [
    p?.seguindo != null ? `<span class="vfd-aviso">${feedPlural(g.futuras.length, 'post a sair', 'posts a sair')}</span>` : '',
    g.buracos.length ? `<span class="vfd-aviso r">${feedPlural(g.buracos.length, 'post faltando', 'posts faltando')} em ${FEED_SEMANAS} semanas</span>` : `<span class="vfd-aviso g">${FEED_SEMANAS} semanas completas</span>`,
    g.semArte ? `<span class="vfd-aviso a">${feedPlural(g.semArte, 'peça sem arte', 'peças sem arte')}</span>` : '',
    g.repetido ? `<span class="vfd-aviso a" title="Três ${feedEsc(g.repetido)} seguidos deixam a grade repetida: arraste para intercalar formatos">3 ${feedEsc(g.repetido)} seguidos</span>` : '',
    resto > 0 ? `<span class="vfd-aviso" title="A grade mostra as ${FEED_GRADE_MAX} mais próximas">+ ${feedPlural(resto, 'item mais longe', 'itens mais longe')}</span>` : '',
    g.depois ? `<span class="vfd-aviso">${feedPlural(g.depois, 'peça depois', 'peças depois')} de ${feedDm(feedSomar(feedSegunda(feedHoje()), FEED_SEMANAS * 7 - 1))}</span>` : '',
  ].filter(Boolean).join('');
  const iniciais = cli.nome.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const foto = p?.foto ? `<img src="${feedEsc(feedFotoIg(p.foto))}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${jsArg(iniciais)}'}))">` : `<span>${feedEsc(iniciais)}</span>`;
  const usuario = cli.usuario ? `<a class="vfd-ig-user" href="https://www.instagram.com/${feedEsc(cli.usuario)}/" target="_blank" rel="noopener noreferrer">${feedEsc(cli.usuario)}</a>${p?.verificado ? '<i class="vfd-ig-selo" aria-label="Verificado"></i>' : ''}` : '<span class="vfd-ig-user vfd-sem-insta">sem Instagram no cadastro</span>';
  // Com a API da Meta ligada vêm a bio, o site e o "seguindo" do próprio perfil; sem ela, a bio e o site do cadastro.
  const nums = `<span><b>${feedNumeroIg(p?.total_posts)}</b> posts</span><span><b>${feedNumeroIg(p?.seguidores)}</b> seguidores</span>`
    + (p?.seguindo != null ? `<span><b>${feedNumeroIg(p.seguindo)}</b> seguindo</span>` : `<span><b>${g.futuras.length}</b> a sair</span>`);
  const siteTxt = String(p?.site || cli.site || '').trim();
  const site = siteTxt ? `<a class="vfd-ig-site" href="${feedEsc(/^https?:\/\//i.test(siteTxt) ? siteTxt : 'https://' + siteTxt)}" target="_blank" rel="noopener noreferrer">${feedEsc(siteTxt.replace(/^https?:\/\//i, '').replace(/\/$/, ''))}</a>` : '';
  const bioTxt = String(p?.bio || cli.bio || '').trim();
  const bio = bioTxt ? `<p class="vfd-ig-bio">${feedEsc(bioTxt)}</p>` : `<p class="vfd-ig-bio vazia">${p?.fonte === 'meta' ? 'Perfil sem bio.' : 'Bio aparece com a conta da Meta ligada (ou no cadastro do cliente).'}</p>`;
  // Uma grade só, contínua (Paulo, 15/11/2026: "insta de cliente aparece 2, 3 vezes... separando o perfil do que tá
  // pronto... tem que ter continuidade"): o que vai sair em cima e, colado, o que está no ar: os posts do Instagram
  // quando o servidor os lê (Meta ligada), senão as peças que a Vybe já publicou, com a arte. O perfil incorporado
  // do Instagram saiu: repetia o cabeçalho e quebrava a grade.
  const noAr = g.noAr.map((t) => feedTileHtml(t, cli)).join('');
  return `<section class="vfd-cliente" aria-label="Feed de ${feedEsc(cli.nome)}">
    <header class="vfd-ig">
      <div class="vfd-ig-topo"><span class="vfd-ig-foto">${foto}</span><div class="vfd-ig-nums">${nums}</div></div>
      <div class="vfd-ig-linha">${usuario}</div>
      <p class="vfd-ig-nome">${feedEsc(p?.nome || cli.nome)}</p>
      ${bio}${site}
      <div class="vfd-avisos">${avisos}</div>
    </header>
    <div class="vfd-ig-aba" aria-hidden="true"><i></i></div>
    <div class="vfd-grade" data-vfd-grade="${feedEsc(cli.nome)}">${futuro.map((t) => feedTileHtml(t, cli)).join('')}${noAr}${!futuro.length && !noAr ? '<p class="vfd-vazio">Nada programado nem no ar.</p>' : ''}</div>
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

function renderFeedDoCliente() {
  const wrap = document.getElementById('feed-board');
  if (!wrap) return;
  if (!feedAberto) { wrap.innerHTML = ''; wrap.classList.add('focus-hidden'); return; }
  wrap.classList.remove('focus-hidden');
  if (typeof garantirClientesAtivos === 'function') { try { garantirClientesAtivos(); } catch { /* segue */ } }
  if (typeof ensureClientMasterSources === 'function' && !feedClientes.pedido) {
    feedClientes.pedido = true;
    Promise.resolve(ensureClientMasterSources()).then(() => { if (feedAberto) renderFeedDoCliente(); }).catch(() => {});
  }
  const todos = feedClientes();
  const lista = feedFiltrados();
  // Quem tem buraco primeiro: é onde a rediagramação começa.
  const ordenada = lista.map((c) => ({ c, b: feedMontar(c).buracos.length })).sort((a, b) => b.b - a.b || a.c.nome.localeCompare(b.c.nome, 'pt-BR')).map((x) => x.c);
  const totalBuracos = lista.reduce((s, c) => s + feedMontar(c).buracos.length, 0);
  wrap.innerHTML = `<div class="vfd">
    <div class="vfd-topo"><div><h2>Feed dos clientes</h2><p>${lista.length === 1 ? 'O feed de agora e o que vai sair, como na grade do Instagram.' : `${feedPlural(lista.length, 'cliente', 'clientes')} · ${totalBuracos ? `<b class="vfd-r">${feedPlural(totalBuracos, 'post faltando', 'posts faltando')}</b> nas próximas ${FEED_SEMANAS} semanas` : `nenhum buraco nas próximas ${FEED_SEMANAS} semanas`}`}</p></div>
      <p class="vfd-legenda"><span class="vfd-l vfd-l-arte"></span>arte pronta <span class="vfd-l vfd-l-prov"></span>sem arte <span class="vfd-l vfd-l-x"></span>sem post (meta de ${FEED_POR_SEMANA} por semana)</p></div>
    ${feedFiltrosHtml(todos)}
    <div class="vfd-lista">${ordenada.map(feedClienteHtml).join('') || '<p class="vfd-vazio">Nenhum cliente neste filtro.</p>'}</div></div>`;
  feedLigarArrasto(wrap);
  feedPedirPerfis(ordenada);
  feedPedirArtes(ordenada);
}

function feedFiltrar(campo, valor) {
  if (!['carteira', 'head', 'cliente'].includes(campo)) return;
  FEED[campo] = String(valor || 'all');
  if (campo === 'cliente' && FEED.cliente !== 'all') { FEED.carteira = 'all'; FEED.head = 'all'; }
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
  const ids = [...new Set(lista.flatMap((c) => { const g = feedMontar(c); return [...g.futuras, ...g.noAr.filter((x) => x.passado)]; })
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

function feedAbrirPeca(id) {
  if (FEED.arrastou) { FEED.arrastou = false; return; }
  if (typeof window.openItemWorkspace === 'function') window.openItemWorkspace(id);
}

function feedAcharItem(id) { return feedItens().find((x) => String(x.it.id) === String(id)) || null; }

// Arrastar: peça sobre peça troca as datas; peça sobre X leva a peça para o dia do X. Só dentro do mesmo cliente.
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

async function feedSoltar(origem, idAlvo, isoAlvo) {
  const a = feedAcharItem(origem.id); if (!a || !isoAlvo || isoAlvo === origem.iso) return;
  const b = idAlvo ? feedAcharItem(idAlvo) : null;
  const item = a.it, outro = b?.it || null;
  // Solicitação de feed muda a conclusão (como no calendário); peça de produção, a veiculação.
  const mover = (x, iso) => moverDataDoItem(x.it, 'veiculacao', iso, { request: x.request, renderizar: false, avisar: false });
  if (typeof moverDataDoItem !== 'function') { showToast?.('Não foi possível mover a data agora.', 'err', 6000); return; }
  FEED.salvando = true; document.getElementById('feed-board')?.classList.add('vfd-salvando');
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
    if (typeof showToast === 'function') showToast(outro ? `Trocadas: ${nome(item)} vai para ${feedDm(isoAlvo)} e ${nome(outro)} para ${feedDm(origem.iso)}.` : `${nome(item)} vai ao ar em ${feedDm(isoAlvo)}.`, 'ok', 5000);
  } catch (erro) {
    if (typeof showToast === 'function') showToast(`Não foi possível mover a data: ${erro.message}`, 'err', 7000);
  } finally {
    FEED.salvando = false; document.getElementById('feed-board')?.classList.remove('vfd-salvando');
    renderFeedDoCliente();
    if (typeof renderManagerCalendar === 'function') renderManagerCalendar();
    if (typeof renderVisaoDeGrupos === 'function') renderVisaoDeGrupos();
  }
}

if (typeof window !== 'undefined') Object.assign(window, { toggleFeedDoCliente, renderFeedDoCliente, feedFiltrar, feedAbrirPeca });
