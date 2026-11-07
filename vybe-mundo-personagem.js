// Criador de personagem do Irecity (07/11/2026).
// No Irecity o criador do Escritório (personalizarEscritorio → abrirAberturaEscritorio('espaco'), em
// vybe-escritorio-abertura.js) não aparece: vybe-mundo.css esconde .ofc-abertura com
// body.mundo-sobre-escritorio. Esta janela é o criador do mundo: mostra o boneco voxel (o mesmo de
// mundo/avatar.mjs) e só as escolhas que ele desenha. Nada novo no servidor nem no formato:
//  - A figura continua a do Habbo que o perfil guarda ("hd-180-1.hr-828-61.ch-255-1408…"). Cada escolha
//    mexe só na parte dela (hd pele, hr cabelo, ch camisa, cc casaco, lg calça, ha chapéu, ea óculos); o
//    resto (sapato, estampa, bichinho, efeito…) fica como está.
//  - A cor de cada parte é a de lerFigura (mundo/avatar.mjs): a janela pergunta ao próprio lerFigura qual
//    peça e qual cor do catálogo do Escritório (figuras.json, criadorCarregarCatalogo) dão a cor
//    escolhida, preferindo a peça que a pessoa já veste e a cor do Habbo mais parecida. Peça nova só se
//    for livre (criadorRoupaLivre: grátis, comprada ou já vestida; a mesma regra do servidor).
//  - Salvar = salvarPersonagemEscritorio, a gravação do Escritório, com o criador.f montado aqui: rota
//    area=escritorio&acao=perfil, foto do painel, cópia do boneco e reconexão da presença (o boneco
//    viaja no token: é assim que a equipe vê o boneco novo).
//  - Prévia: desenharPreviaAvatar (canvas vivo que gira) quando o pacote do mundo exporta; senão a imagem
//    do avatarVoxel nas 8 direções. As duas são o boneco do mapa.
//  - Com o Irecity ligado (body.mundo), personalizarEscritorio ("Meu personagem" na Equipe,
//    "Personalizar aparência" na ficha) abre esta janela. Fora dele, o Escritório segue igual.
// API: window.VybePersonagem = { abrir(), fechar(), aberto() }
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.VybePersonagem) return;

  const MUNDO_JS = "/assets/mundo/mundo-3d.js";
  const VIGIA_MS = 1000;
  const ESPERA_ENTRADA_MS = 15000;
  const ICONE = {
    fechar: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    esquerda: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5V9h4.5"/></svg>',
    direita: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M20 4.5V9h-4.5"/></svg>',
    dado: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><g fill="currentColor" stroke="none"><circle cx="9" cy="9" r="1.3"/><circle cx="15" cy="9" r="1.3"/><circle cx="9" cy="15" r="1.3"/><circle cx="15" cy="15" r="1.3"/></g></svg>',
  };
  const ABAS = [['pele', 'Pele'], ['cabelo', 'Cabelo'], ['roupa', 'Roupa'], ['calca', 'Calça'], ['acessorios', 'Acessórios']];
  // Cada escolha mexe numa parte da figura do Habbo; o segundo nome é o campo que lerFigura lê dela.
  const PARTES = { pele: ['hd', 'pele'], cabelo: ['hr', 'cabelo'], roupa: ['ch', 'roupa'], casaco: ['cc', 'casaco'], calca: ['lg', 'calca'], chapeu: ['ha', 'chapeu'], oculos: ['ea', 'oculos'] };
  const SEM_PECA = { pele: 'esse tom de pele', cabelo: 'cabelo nesse estilo', roupa: 'camisa nessa cor', casaco: 'casaco', calca: 'calça nessa cor', chapeu: 'chapéu', oculos: 'óculos' };
  // Funções do Escritório que esta janela usa (vybe-escritorio-abertura.js).
  const NECESSARIAS = ['criadorDaFigura', 'criadorFigura', 'criadorConjunto', 'criadorServe', 'criadorPaleta', 'criadorCarregarCatalogo', 'salvarPersonagemEscritorio'];
  // O avatarVoxel numera as 8 direções fora da ordem do giro (ângulos -.6, -.3, .3, .6, 2.6, 3, -2.6, -3).
  const GIRO_IMAGEM = [0, 1, 2, 3, 4, 5, 7, 6];

  const st = {
    aberto: false, fase: '', erro: '', aviso: '', seq: 0, pode: {},
    fundo: null, raiz: null, corpo: null, refs: {},
    mod: null, paletas: null, base: null, salva: '', f: null, figura: '', escolha: null,
    aba: 'pele', ultimoEstilo: 'curto', salvando: false, previa: null, tela: null, giro: 3, arrasto: 0,
    entrandoDesde: 0, vigia: 0, focoAntes: null,
  };

  // ---------- leitura do Escritório (sem mudar nada nele, fora o salvar) ----------
  const E = () => (typeof escritorio !== 'undefined' && escritorio ? escritorio : null);
  const base = () => E()?.base || null;
  const fn = (nome) => (typeof window[nome] === 'function' ? window[nome] : null);
  const criadorDoEscritorio = () => (typeof criador !== 'undefined' && criador ? criador : null);
  const padraoDoEscritorio = () => (typeof CRIADOR_PADRAO !== 'undefined' && CRIADOR_PADRAO ? CRIADOR_PADRAO : {});
  const catalogo = () => criadorDoEscritorio()?.cat || null;
  const noIrecity = () => Boolean(document.body?.classList?.contains('mundo'));
  const convidado = () => Boolean(window.ESCRITORIO_CONVIDADO || base()?.convidado);

  // ---------- utilidades ----------
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const copiar = (partes) => Object.fromEntries(Object.entries(partes || {}).map(([t, p]) => [t, { id: p.id, cores: [...(p.cores || [])] }]));
  const rgb = (hex) => { const n = parseInt(String(hex || '').replace('#', '').slice(0, 6), 16); return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128]; };
  const distancia = (a, b) => { const x = rgb(a), y = rgb(b); return (x[0] - y[0]) ** 2 * 0.3 + (x[1] - y[1]) ** 2 * 0.59 + (x[2] - y[2]) ** 2 * 0.11; };
  function el(tag, classe, atributos = {}) {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    for (const [k, v] of Object.entries(atributos)) n.setAttribute(k, v);
    return n;
  }
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- as cores do boneco voxel, lidas do próprio lerFigura (uma fonte só) ----------
  // Uma parte com conjunto 0 e cor i dá a i-ésima cor da lista dela; casaco e chapéu usam as cores da
  // camisa com outro deslocamento, então aparecem na mesma ordem da camisa.
  function paletasDoAvatar(ler) {
    const cores = (t, campo) => [...new Set(Array.from({ length: 240 }, (_, i) => ler(`${t}-0-${i}`)[campo]).filter(Boolean))];
    const roupa = cores('ch', 'roupa');
    const naOrdem = (lista) => [...lista].sort((a, b) => (roupa.indexOf(a) + 1 || 999) - (roupa.indexOf(b) + 1 || 999));
    return { pele: cores('hd', 'pele'), cabelo: cores('hr', 'cabelo'), roupa, calca: cores('lg', 'calca'), casaco: naOrdem(cores('cc', 'casaco')), chapeu: naOrdem(cores('ha', 'chapeu')) };
  }
  function escolhaDaFigura(figura) {
    const v = st.mod.lerFigura(figura);
    return { pele: v.pele, cabelo: v.cabelo ? (v.longo ? 'longo' : 'curto') : 'sem', corCabelo: v.cabelo || st.paletas.cabelo[0], roupa: v.roupa,
      casaco: v.casaco || null, calca: v.calca, chapeu: v.chapeu || null, oculos: Boolean(v.oculos) };
  }

  // ---------- da escolha para a figura do Escritório ----------
  // Peças que a pessoa pode vestir agora, na ordem de preferência: a que já veste, a do boneco padrão do
  // Escritório e as livres do catálogo (com cor antes das sem cor; as de assinante do Habbo por último).
  function conjuntosPara(t, g, idAtual) {
    const servir = fn('criadorServe'), livre = fn('criadorRoupaLivre');
    const padrao = Number(String(padraoDoEscritorio()[g] || '').split('.').map((p) => p.split('-')).find(([x]) => x === t)?.[1]);
    const peso = (s) => (s[0] === idAtual ? -10 : s[0] === padrao ? -5 : 0) + (Number(s[3]) > 0 ? 0 : 2) + (s[2] ? 1 : 0);
    return (catalogo()?.tipos?.[t]?.s || [])
      .filter((s) => servir(s, g) && (!livre || livre(`roupa:${t}-${s[0]}`)))
      .map((s, i) => [s, i]).sort((a, b) => peso(a[0]) - peso(b[0]) || a[1] - b[1]).map(([s]) => s);
  }
  // Veste em f a parte do campo com o valor que o boneco voxel deve mostrar. A parte que já dá esse valor
  // fica como está (peça e cores de hoje); senão procura peça livre e cor do catálogo que dêem.
  function vestir(f, campo, alvo, { longo } = {}) {
    const [t, prop] = PARTES[campo], figuraDe = fn('criadorFigura');
    const le = (id, cores) => st.mod.lerFigura(figuraDe({ g: f.g, partes: { [t]: { id, cores } } }));
    const serve = (v) => v[prop] === alvo && (longo === undefined || v.longo === longo);
    const atual = f.partes[t];
    if (atual && serve(le(atual.id, atual.cores))) return true;
    const pal = fn('criadorPaleta')(t) || [];
    // A cor do Habbo mais parecida primeiro: o boneco antigo (fora do Irecity) fica parecido com o voxel.
    const cores = typeof alvo === 'string' ? [...pal].sort((a, b) => distancia(a[1], alvo) - distancia(b[1], alvo)) : pal;
    for (const conj of conjuntosPara(t, f.g, atual?.id)) {
      const duas = Number(conj[3]) > 1, mesma = atual && conj[0] === atual.id;
      for (const [cor] of cores) {
        const lista = duas ? [cor, (mesma && atual.cores[1]) || pal[Math.min(pal.length - 1, 8)]?.[0] || cor] : [cor];
        if (serve(le(conj[0], lista))) { f.partes[t] = { id: conj[0], cores: lista }; return true; }
      }
    }
    return false;
  }
  function montar(escolha) {
    const f = { g: st.base.g, partes: copiar(st.base.partes) }, faltou = [];
    const pede = (campo, alvo, extra) => { if (!vestir(f, campo, alvo, extra)) faltou.push(campo); };
    pede('pele', escolha.pele);
    if (escolha.cabelo === 'sem') delete f.partes.hr; else pede('cabelo', escolha.corCabelo, { longo: escolha.cabelo === 'longo' });
    pede('roupa', escolha.roupa);
    if (escolha.casaco) pede('casaco', escolha.casaco); else delete f.partes.cc;
    pede('calca', escolha.calca);
    if (escolha.chapeu) pede('chapeu', escolha.chapeu); else delete f.partes.ha;
    if (escolha.oculos) pede('oculos', true); else delete f.partes.ea;
    return { f, figura: fn('criadorFigura')(f), faltou };
  }
  // Parte opcional: dá para vestir se a pessoa já tem uma ou se há peça livre no catálogo.
  function pode(campo) {
    if (campo in st.pode) return st.pode[campo];
    const t = PARTES[campo][0];
    return (st.pode[campo] = Boolean(st.base.partes[t]) || conjuntosPara(t, st.base.g).length > 0);
  }
  function podeEstilo(estilo) {
    const chave = 'estilo:' + estilo + st.escolha.corCabelo;
    if (estilo === 'sem' || estilo === st.escolha.cabelo) return true;
    if (!(chave in st.pode)) st.pode[chave] = !montar({ ...st.escolha, cabelo: estilo }).faltou.includes('cabelo');
    return st.pode[chave];
  }
  function escolher(mudanca) {
    const nova = { ...st.escolha, ...mudanca };
    const r = montar(nova);
    const pedidos = Object.keys(mudanca).map((k) => (k === 'corCabelo' ? 'cabelo' : k));
    const faltou = r.faltou.find((c) => pedidos.includes(c));
    if (faltou) { st.aviso = `Você ainda não tem ${SEM_PECA[faltou]} para vestir.`; pintar(); return; }
    if (nova.cabelo !== 'sem') st.ultimoEstilo = nova.cabelo;
    Object.assign(st, { escolha: nova, f: r.f, figura: r.figura, aviso: '' });
    st.refs.erro.textContent = '';
    pintar();
  }
  function sortear() {
    const p = st.paletas, um = (l) => l[Math.floor(Math.random() * l.length)], chance = (x) => Math.random() < x;
    const nova = {
      pele: um(p.pele), cabelo: chance(0.1) ? 'sem' : um(['curto', 'longo']), corCabelo: um(p.cabelo), roupa: um(p.roupa),
      casaco: pode('casaco') && chance(0.3) ? um(p.casaco) : null, calca: um(p.calca),
      chapeu: pode('chapeu') && chance(0.2) ? um(p.chapeu) : null, oculos: pode('oculos') && chance(0.25),
    };
    let r = montar(nova);
    if (r.faltou.length) {
      for (const c of r.faltou) { nova[c] = st.escolha[c]; if (c === 'cabelo') nova.corCabelo = st.escolha.corCabelo; }
      r = montar(nova);
    }
    if (nova.cabelo !== 'sem') st.ultimoEstilo = nova.cabelo;
    Object.assign(st, { escolha: nova, f: r.f, figura: r.figura, aviso: '' });
    st.refs.erro.textContent = '';
    pintar();
  }

  // ---------- carregar ----------
  // O catálogo de peças é o do criador do Escritório (criador.cat); se outra parte já está baixando,
  // espera ela terminar.
  async function lerCatalogo() {
    if (catalogo()) return catalogo();
    await fn('criadorCarregarCatalogo')();
    for (let i = 0; i < 40 && !catalogo() && criadorDoEscritorio()?.carregando; i++) await espera(250);
    return catalogo();
  }
  // O que a pessoa pode vestir sem comprar (criador.roupas), relido a cada abertura como no Provador.
  async function lerRoupas() {
    const c = criadorDoEscritorio(), ler = fn('criadorCarregarRoupas');
    if (!c || !ler || base()?.demo) return;
    c.destino = null; // o criador do Escritório não lê as roupas quando está no avatar de um cliente
    try { await ler(true); } catch { /* sem a lista, o servidor confere ao salvar */ }
  }
  function iniciar() {
    const perfil = E()?.perfil || {};
    const salva = perfil.figura || fn('mapaFigura')?.(perfil) || '';
    const b = fn('criadorDaFigura')(salva);
    const g = fn('criadorConjunto')('hd', b.partes.hd?.id)?.[1];
    if (g === 'M' || g === 'F') b.g = g;
    st.base = b;
    st.f = { g: b.g, partes: copiar(b.partes) };
    st.salva = st.figura = fn('criadorFigura')(b);
    st.escolha = escolhaDaFigura(st.figura);
    st.ultimoEstilo = st.escolha.cabelo === 'sem' ? 'curto' : st.escolha.cabelo;
  }
  async function carregar() {
    const seq = ++st.seq;
    Object.assign(st, { pode: {}, aviso: '', erro: '' });
    if (convidado()) { st.fase = 'convidado'; pintar(); return; }
    if (NECESSARIAS.some((n) => !fn(n))) { st.fase = 'indisponivel'; pintar(); return; }
    if (!base()) { st.fase = 'sem-escritorio'; pintar(); return; }
    st.fase = 'carregando';
    pintar();
    try {
      const [mod] = await Promise.all([st.mod || import(MUNDO_JS), lerCatalogo(), lerRoupas()]);
      if (seq !== st.seq || !st.aberto) return;
      if (typeof mod?.lerFigura !== 'function') throw new Error('O boneco do mundo não carregou.');
      if (!catalogo()) throw new Error('O catálogo de peças do Escritório não carregou.');
      st.mod = mod;
      st.paletas = st.paletas || paletasDoAvatar(mod.lerFigura);
      iniciar();
      st.fase = 'pronto';
    } catch (e) {
      if (seq !== st.seq || !st.aberto) return;
      console.error?.('[personagem] abrir', e);
      Object.assign(st, { fase: 'erro', erro: e?.message || 'Erro desconhecido.' });
    }
    pintar();
    focar();
  }

  // ---------- salvar (a gravação do Escritório) ----------
  // O Escritório só termina depois de reconectar a presença; a janela fecha assim que o perfil gravado
  // volta com a figura nova (a reconexão segue sozinha).
  function corrida(promessa, pronto) {
    return new Promise((resolve) => {
      let fim = false, t = 0;
      const acabar = () => { if (fim) return; fim = true; clearInterval(t); resolve(); };
      t = setInterval(() => { if (pronto()) acabar(); }, 120);
      promessa.then(acabar, acabar);
    });
  }
  async function salvar() {
    if (st.salvando || st.fase !== 'pronto') return;
    const c = criadorDoEscritorio(), gravar = fn('salvarPersonagemEscritorio');
    if (!c || !gravar) { st.aviso = 'O criador do Escritório não carregou. Recarregue o painel.'; pintar(); return; }
    if (st.figura === st.salva) { fechar(); return; }
    if (c.salvando) { st.aviso = 'O personagem anterior ainda está sendo salvo. Tente de novo em instantes.'; pintar(); return; }
    // O criador do Escritório grava o que estiver nele: a figura montada aqui, o objeto na mão de sempre,
    // só o personagem (sem abertura nem reforma de quarto) e nunca o avatar de um cliente.
    Object.assign(c, { f: { g: st.f.g, partes: copiar(st.f.partes) }, mao: E()?.perfil?.mao || '', so: true, destino: null, reforma: false, andar: 0 });
    const esperado = fn('criadorFigura')(c.f);
    const erro = st.refs.erro;
    erro.textContent = '';
    st.aviso = '';
    st.salvando = true;
    pintar();
    // A mensagem de erro do Escritório vai para #abr-erro; sem o criador dele aberto, aparece aqui.
    const emprestado = !document.getElementById('abr-erro');
    if (emprestado) erro.id = 'abr-erro';
    try {
      const feito = Promise.resolve().then(() => gravar(false));
      feito.catch((e) => console.error?.('[personagem] salvar', e));
      await corrida(feito, () => E()?.perfil?.figura === esperado);
    } finally {
      if (emprestado) erro.removeAttribute('id');
      st.salvando = false;
    }
    if (E()?.perfil?.figura === esperado) {
      st.salva = esperado;
      fn('showToast')?.('Personagem salvo.', 'ok', 3000);
      fechar();
      return;
    }
    if (!erro.textContent) erro.textContent = 'Não deu para salvar o personagem. Tente de novo.';
    pintar();
  }

  // ---------- sem Escritório ----------
  function entrarNoEscritorio() {
    const abrirE = fn('abrirEscritorio');
    if (!abrirE) return;
    st.entrandoDesde = Date.now();
    pintar();
    try {
      const r = abrirE();
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch { /* o Escritório guarda o erro dele; aqui a janela oferece tentar de novo */ }
    st.raiz?.focus?.({ preventScroll: true });
  }

  // ---------- desenho ----------
  function garantirRaiz() {
    if (st.raiz) {
      if (!st.raiz.parentNode && document.body) document.body.append(st.fundo, st.raiz);
      return;
    }
    const fundo = el('div', 'vv-personagem-fundo', { 'aria-hidden': 'true' });
    fundo.hidden = true;
    fundo.addEventListener('click', () => fechar());
    // Sem <header>: uma regra antiga do painel pinta todo <header> de grafite.
    const raiz = el('div', 'vv-personagem', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vv-personagem-titulo', 'aria-describedby': 'vv-personagem-sub', tabindex: '-1' });
    raiz.hidden = true;
    const topo = el('div', 'vv-personagem-topo');
    const titulo = el('div', 'vv-personagem-titulo');
    titulo.innerHTML = '<span class="vv-personagem-kicker">Irecity</span><h2 id="vv-personagem-titulo">Seu personagem</h2><p id="vv-personagem-sub">O mesmo boneco que a equipe vê no mapa.</p>';
    const x = el('button', 'vv-personagem-x', { type: 'button', 'aria-label': 'Fechar', title: 'Fechar (Esc)' });
    x.innerHTML = ICONE.fechar;
    x.addEventListener('click', () => fechar());
    topo.append(titulo, x);
    const corpo = el('div', 'vv-personagem-corpo');
    const palco = el('div', 'vv-personagem-palco');
    const giro = el('div', 'vv-personagem-giro', { role: 'group', 'aria-label': 'Girar o boneco' });
    giro.innerHTML = `<button type="button" data-vp="girar" data-valor="-1" aria-label="Girar para a esquerda" title="Girar para a esquerda">${ICONE.esquerda}</button><button type="button" data-vp="girar" data-valor="1" aria-label="Girar para a direita" title="Girar para a direita">${ICONE.direita}</button>`;
    palco.append(giro);
    const lado = el('div', 'vv-personagem-lado');
    lado.addEventListener('keydown', aoTeclarAbas);
    const rodape = el('div', 'vv-personagem-rodape');
    const msgs = el('div', 'vv-personagem-msgs');
    const aviso = el('p', 'vv-personagem-aviso', { role: 'status', 'aria-live': 'polite' });
    const erro = el('p', 'vv-personagem-erro', { role: 'alert' });
    msgs.append(aviso, erro);
    const acoes = el('div', 'vv-personagem-acoes');
    rodape.append(msgs, acoes);
    raiz.append(topo, corpo);
    raiz.addEventListener('click', aoClicar);
    // As teclas digitadas aqui não chegam ao Escritório (WASD, setas e números mexem o boneco dele) nem
    // ao mundo; o Esc e o Tab são tratados antes, na captura (aoTeclar).
    raiz.addEventListener('keydown', (ev) => ev.stopPropagation?.());
    document.body.append(fundo, raiz);
    Object.assign(st, { fundo, raiz, corpo, refs: { x, palco, lado, rodape, aviso, erro, acoes } });
  }
  function pintar() {
    if (!st.raiz) return;
    const foco = chaveDoFoco();
    if (st.fase === 'pronto') pintarPronto();
    else { st.corpo.className = 'vv-personagem-corpo'; st.corpo.innerHTML = estadoHtml(); }
    devolverFoco(foco);
  }
  function estadoHtml() {
    const caixa = (titulo, texto, botao = '', papel = '') => `<div class="vv-personagem-estado"${papel ? ` role="${papel}"` : ''}><b>${esc(titulo)}</b>${texto ? `<p>${esc(texto)}</p>` : ''}${botao}</div>`;
    if (st.fase === 'carregando') return '<div class="vv-personagem-estado" role="status"><span class="vv-personagem-girando" aria-hidden="true"></span><b>Carregando seu personagem…</b></div>';
    if (st.fase === 'sem-escritorio') {
      const entrando = Boolean(st.entrandoDesde) && Date.now() - st.entrandoDesde < ESPERA_ENTRADA_MS;
      if (entrando) return caixa('Entrando no Escritório…', 'O criador abre assim que a entrada terminar.', '', 'status');
      const venceu = Boolean(st.entrandoDesde);
      return caixa('Você ainda não está no Escritório',
        venceu ? 'A entrada não terminou. Confira a internet e tente de novo.' : 'Seu personagem fica no perfil do Escritório. Entre para escolher a aparência.',
        fn('abrirEscritorio') ? '<button type="button" class="vv-personagem-principal" data-vp="entrar">Entrar no Escritório</button>' : '<p>O Escritório não carregou nesta página. Recarregue o painel.</p>');
    }
    if (st.fase === 'convidado') return caixa('Convidados usam o boneco do convite', 'Quem entra por convite escolhe o boneco no link, ao entrar.');
    if (st.fase === 'indisponivel') return caixa('O criador não carregou', 'As peças do Escritório não carregaram nesta página. Recarregue o painel.');
    return caixa('Não deu para abrir o criador', st.erro, '<button type="button" class="vv-personagem-sec" data-vp="recarregar">Tentar de novo</button>', 'alert');
  }
  function pintarPronto() {
    const { palco, lado, rodape, aviso, erro, acoes } = st.refs;
    st.corpo.className = 'vv-personagem-corpo pronto';
    if (palco.parentNode !== st.corpo) { st.corpo.innerHTML = ''; st.corpo.append(palco, lado, rodape); }
    montarPrevia();
    lado.innerHTML = `<div class="vv-personagem-abas" role="tablist" aria-label="Partes do personagem">${ABAS.map(([id, nome]) => `<button type="button" role="tab" id="vv-personagem-aba-${id}" data-vp="aba" data-valor="${id}" aria-selected="${st.aba === id}" aria-controls="vv-personagem-painel" tabindex="${st.aba === id ? 0 : -1}">${nome}</button>`).join('')}</div>
      <div class="vv-personagem-opcoes" id="vv-personagem-painel" role="tabpanel" aria-labelledby="vv-personagem-aba-${st.aba}">${opcoesHtml()}</div>`;
    aviso.textContent = st.aviso;
    aviso.hidden = !st.aviso;
    erro.hidden = !erro.textContent;
    acoes.innerHTML = `<button type="button" class="vv-personagem-sec" data-vp="aleatorio"${st.salvando ? ' disabled' : ''}>${ICONE.dado}Aleatório</button>
      <button type="button" class="vv-personagem-sec" data-vp="cancelar">Cancelar</button>
      <button type="button" class="vv-personagem-principal" data-vp="salvar"${st.salvando ? ' disabled aria-busy="true"' : ''}>${st.salvando ? 'Salvando…' : 'Salvar'}</button>`;
  }
  const grupo = (titulo, conteudo, dica = '') => `<section class="vv-personagem-grupo"><h3>${esc(titulo)}</h3>${conteudo}${dica ? `<p class="vv-personagem-dica">${esc(dica)}</p>` : ''}</section>`;
  function amostras(campo, lista, atual, rotulo, { desligado = false, nenhum = '' } = {}) {
    const sem = nenhum ? `<button type="button" class="vv-personagem-amostra nenhum" data-vp="nenhum" data-campo="${campo}" aria-pressed="${!atual}" aria-label="${esc(nenhum)}" title="${esc(nenhum)}"><i aria-hidden="true"></i></button>` : '';
    return `<div class="vv-personagem-grade" role="group" aria-label="${esc(rotulo)}">${sem}${lista.map((cor, i) => `<button type="button" class="vv-personagem-amostra" data-vp="cor" data-campo="${campo}" data-valor="${esc(cor)}" aria-pressed="${atual === cor}" aria-label="${esc(rotulo)}: cor ${i + 1} de ${lista.length}" title="Cor ${i + 1}"${desligado ? ' disabled' : ''} style="--c:${esc(cor)}"><i aria-hidden="true"></i></button>`).join('')}</div>`;
  }
  const chips = (vp, opcoes, atual, rotulo, livre = () => true) => `<div class="vv-personagem-chips" role="group" aria-label="${esc(rotulo)}">${opcoes.map(([v, nome]) => `<button type="button" class="vv-personagem-chip" data-vp="${vp}" data-valor="${v}" aria-pressed="${atual === v}"${livre(v) ? '' : ' disabled'}>${esc(nome)}</button>`).join('')}</div>`;
  // Chapéu, óculos e casaco não são grátis (migração das skins): sem um comprado, o aviso diz de onde vêm.
  const naLoja = (faltam) => (faltam.length ? `<p class="vv-personagem-dica">Você ainda não tem ${faltam.join(' nem ')}: ${faltam.length > 1 ? 'essas peças vêm' : 'essa peça vem'} da loja de roupas do Escritório.</p>` : '');
  function opcoesHtml() {
    const e = st.escolha, p = st.paletas;
    if (st.aba === 'pele') return grupo('Tom de pele', amostras('pele', p.pele, e.pele, 'Tom de pele'));
    if (st.aba === 'cabelo') {
      return grupo('Estilo', chips('estilo', [['curto', 'Curto'], ['longo', 'Longo'], ['sem', 'Sem cabelo']], e.cabelo, 'Estilo do cabelo', podeEstilo))
        + grupo('Cor do cabelo', amostras('corCabelo', p.cabelo, e.cabelo === 'sem' ? null : e.corCabelo, 'Cor do cabelo'), e.cabelo === 'sem' ? 'Escolha uma cor para voltar a ter cabelo.' : '');
    }
    if (st.aba === 'roupa') {
      const casaco = pode('casaco');
      return grupo('Camisa', amostras('roupa', p.roupa, e.roupa, 'Camisa'))
        + grupo('Casaco', amostras('casaco', p.casaco, e.casaco, 'Casaco', { desligado: !casaco, nenhum: 'Sem casaco' })) + naLoja(casaco ? [] : ['casaco']);
    }
    if (st.aba === 'calca') return grupo('Calça', amostras('calca', p.calca, e.calca, 'Calça'));
    const chapeu = pode('chapeu'), oculos = pode('oculos');
    return grupo('Chapéu', amostras('chapeu', p.chapeu, e.chapeu, 'Chapéu', { desligado: !chapeu, nenhum: 'Sem chapéu' }))
      + grupo('Óculos', chips('oculos', [['0', 'Sem óculos'], ['1', 'Com óculos']], e.oculos ? '1' : '0', 'Óculos', (v) => v === '0' || oculos))
      + naLoja([chapeu ? '' : 'chapéu', oculos ? '' : 'óculos'].filter(Boolean));
  }

  // ---------- prévia ----------
  function montarPrevia() {
    if (st.previa) { st.previa.trocar(st.figura); return; }
    if (st.tela) { pintarImagem(); return; }
    const { palco } = st.refs;
    if (typeof st.mod.desenharPreviaAvatar === 'function') {
      const canvas = el('canvas', 'vv-personagem-tela', { role: 'img', 'aria-label': 'Prévia do seu personagem. Arraste para girar.' });
      palco.append(canvas);
      try {
        st.previa = st.mod.desenharPreviaAvatar(canvas, st.figura, { angulo: 0.3 });
        st.tela = canvas;
        ligarArrasto(canvas);
        return;
      } catch (e) {
        console.warn?.('[personagem] prévia 3D', e);
        st.previa = null;
        canvas.remove();
      }
    }
    // Sem a prévia viva: a imagem do avatarVoxel (a mesma das fichas e listas), nas 8 direções.
    const img = el('img', 'vv-personagem-tela', { alt: 'Prévia do seu personagem. Arraste para girar.', draggable: 'false' });
    palco.append(img);
    st.tela = img;
    ligarArrasto(img);
    pintarImagem();
  }
  function pintarImagem() {
    if (!st.tela || st.previa) return;
    try { st.tela.src = st.mod.avatarVoxel(st.figura, { direcao: GIRO_IMAGEM[st.giro] }); st.tela.hidden = false; } catch (e) {
      // Sem WebGL o boneco não desenha; as escolhas e o salvar continuam valendo.
      console.warn?.('[personagem] prévia', e);
      st.tela.hidden = true;
    }
  }
  function passo(sentido) {
    if (st.previa) st.previa.girar(sentido * Math.PI / 4);
    else if (st.tela) { st.giro = (st.giro + sentido + 8) % 8; pintarImagem(); }
  }
  function ligarArrasto(alvo) {
    let x = null;
    alvo.addEventListener('pointerdown', (ev) => { x = ev.clientX; st.arrasto = 0; ev.preventDefault?.(); try { alvo.setPointerCapture?.(ev.pointerId); } catch { /* sem captura, segue */ } });
    alvo.addEventListener('pointermove', (ev) => {
      if (x === null) return;
      const dx = ev.clientX - x;
      x = ev.clientX;
      if (st.previa) { st.previa.girar(dx * 0.012); return; }
      st.arrasto += dx;
      while (Math.abs(st.arrasto) >= 36) { const s = Math.sign(st.arrasto); passo(s); st.arrasto -= 36 * s; }
    });
    const soltar = () => { x = null; };
    alvo.addEventListener('pointerup', soltar);
    alvo.addEventListener('pointercancel', soltar);
  }
  function soltarPrevia() {
    try { st.previa?.destruir?.(); } catch { /* o contexto já pode ter ido embora */ }
    st.previa = null;
    st.tela?.remove?.();
    st.tela = null;
    st.giro = 3;
  }

  // ---------- teclado, cliques e foco ----------
  function aoClicar(ev) {
    const alvo = ev.target?.closest?.('[data-vp]');
    if (!alvo || alvo.disabled) return;
    const { vp, campo, valor } = alvo.dataset || {};
    if (vp === 'cancelar') { fechar(); return; }
    if (vp === 'salvar') { salvar(); return; }
    if (vp === 'entrar') { entrarNoEscritorio(); return; }
    if (vp === 'recarregar') { carregar(); return; }
    if (st.fase !== 'pronto' || st.salvando) return;
    if (vp === 'aba' && ABAS.some(([id]) => id === valor)) { st.aba = valor; st.aviso = ''; pintar(); }
    else if (vp === 'girar') passo(Number(valor) < 0 ? -1 : 1);
    else if (vp === 'aleatorio') sortear();
    else if (vp === 'cor' && PARTES[campo === 'corCabelo' ? 'cabelo' : campo]) escolher(campo === 'corCabelo' ? { corCabelo: valor, cabelo: st.escolha.cabelo === 'sem' ? st.ultimoEstilo || 'curto' : st.escolha.cabelo } : { [campo]: valor });
    else if (vp === 'nenhum' && (campo === 'casaco' || campo === 'chapeu')) escolher({ [campo]: null });
    else if (vp === 'estilo' && ['curto', 'longo', 'sem'].includes(valor)) escolher({ cabelo: valor });
    else if (vp === 'oculos') escolher({ oculos: valor === '1' });
  }
  function aoTeclarAbas(ev) {
    const aba = ev.target?.dataset?.vp === 'aba' ? ev.target.dataset.valor : null;
    if (!aba || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight')) return;
    ev.preventDefault?.();
    const i = ABAS.findIndex(([id]) => id === aba), n = ABAS.length;
    st.aba = ABAS[(i + (ev.key === 'ArrowRight' ? 1 : n - 1)) % n][0];
    pintar();
    st.raiz.querySelector?.(`[data-vp="aba"][data-valor="${st.aba}"]`)?.focus?.();
  }
  // Esc fecha só esta janela (o mundo não recebe o Esc); uma janela por cima dela (confirmação) fecha antes.
  function aoTeclar(ev) {
    if (!st.aberto) return;
    if (ev.key === 'Escape') {
      if (outraJanelaPorCima()) return;
      ev.preventDefault?.();
      ev.stopPropagation?.();
      fechar();
    } else if (ev.key === 'Tab') prenderFoco(ev);
  }
  function outraJanelaPorCima() {
    const lista = document.querySelectorAll?.('dialog[open], #workflow-modal') || [];
    return [...lista].some((n) => !st.raiz.contains?.(n) && n.getClientRects?.().length);
  }
  function prenderFoco(ev) {
    const alvos = [...(st.raiz.querySelectorAll?.('button:not(:disabled), [tabindex="0"]') || [])].filter((n) => n.getClientRects?.().length);
    if (!alvos.length) return;
    const primeiro = alvos[0], ultimo = alvos[alvos.length - 1], ativo = document.activeElement;
    if (!st.raiz.contains?.(ativo)) { ev.preventDefault?.(); (ev.shiftKey ? ultimo : primeiro).focus?.(); }
    else if (ev.shiftKey && ativo === primeiro) { ev.preventDefault?.(); ultimo.focus?.(); }
    else if (!ev.shiftKey && ativo === ultimo) { ev.preventDefault?.(); primeiro.focus?.(); }
  }
  // O desenho troca os botões a cada escolha: o foco volta para o botão equivalente.
  function chaveDoFoco() {
    const a = document.activeElement;
    if (!a?.dataset?.vp || !st.raiz?.contains?.(a)) return null;
    return { vp: a.dataset.vp, campo: a.dataset.campo || '', valor: a.dataset.valor || '' };
  }
  function devolverFoco(k) {
    if (!k || document.activeElement && st.raiz.contains?.(document.activeElement) && document.activeElement.isConnected !== false) return;
    const sel = `[data-vp="${k.vp}"]${k.campo ? `[data-campo="${k.campo}"]` : ''}${k.valor ? `[data-valor="${k.valor}"]` : ''}`;
    try { st.raiz.querySelector?.(sel)?.focus?.({ preventScroll: true }); } catch { /* foco é conforto, não regra */ }
  }
  function focar() {
    if (!st.aberto || !st.raiz) return;
    const alvo = st.raiz.querySelector?.(st.fase === 'pronto' ? '[data-vp="aba"][aria-selected="true"]' : '.vv-personagem-estado button') || st.raiz;
    try { alvo.focus?.({ preventScroll: true }); } catch { /* foco é conforto, não regra */ }
  }
  function vigiar() {
    if (!st.aberto) return;
    if (st.raiz && !st.raiz.parentNode && document.body) document.body.append(st.fundo, st.raiz);
    if (st.fase !== 'sem-escritorio') return;
    if (base()) { carregar(); return; }
    // Passou o tempo de espera da entrada: troca "Entrando…" pelo botão de novo.
    if (st.entrandoDesde && Date.now() - st.entrandoDesde >= ESPERA_ENTRADA_MS && !st.venceuPintado) { st.venceuPintado = true; pintar(); }
  }

  // ---------- API ----------
  function abrir() {
    garantirRaiz();
    if (st.aberto) { focar(); return; }
    st.focoAntes = document.activeElement || null;
    Object.assign(st, { aberto: true, aba: 'pele', entrandoDesde: 0, venceuPintado: false });
    st.refs.erro.textContent = '';
    st.vigia = setInterval(vigiar, VIGIA_MS);
    document.addEventListener?.('keydown', aoTeclar, true);
    st.fundo.hidden = false;
    st.raiz.hidden = false;
    carregar();
    focar();
  }
  function fechar() {
    if (!st.aberto) return;
    st.aberto = false;
    st.seq++;
    clearInterval(st.vigia);
    st.vigia = 0;
    document.removeEventListener?.('keydown', aoTeclar, true);
    soltarPrevia();
    if (st.raiz) st.raiz.hidden = true;
    if (st.fundo) st.fundo.hidden = true;
    const volta = st.focoAntes;
    st.focoAntes = null;
    if (volta && volta !== document.body && volta.isConnected !== false) {
      try { volta.focus?.({ preventScroll: true }); } catch { /* o elemento de antes pode ter saído */ }
    }
  }

  // Com o Irecity ligado o criador do Escritório nunca aparece: quem pede personalizarEscritorio (Equipe
  // "Meu personagem", ficha "Personalizar aparência", menus do Escritório) cai aqui. Fora dele, nada muda.
  function desviarDoEscritorio() {
    const original = window.personalizarEscritorio;
    if (typeof original !== 'function' || original.vvPersonagem) return;
    const desvio = function () { return noIrecity() ? abrir() : original.apply(this, arguments); };
    desvio.vvPersonagem = true;
    window.personalizarEscritorio = desvio;
  }

  window.VybePersonagem = { abrir, fechar, aberto: () => st.aberto };
  desviarDoEscritorio();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', desviarDoEscritorio, { once: true });
})();
