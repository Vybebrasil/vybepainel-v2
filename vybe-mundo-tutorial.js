// vybe-mundo-tutorial.js — o VYBES apresenta o Vybe OS (Irecity) para quem chega. Ninguém fica perdido.
//
// Três peças, todas faladas pelo VYBES (a bolinha lilás-laranja):
//   · Passeio de boas-vindas (iniciar): escurece a tela, acende um recorte em volta de cada parte do HUD
//     e explica em uma ou duas frases. Só na primeira vez de cada pessoa; { forcar: true } refaz.
//   · Dica de primeira vez (dica(id)): balão curto ancorado no que acabou de abrir, com "Entendi",
//     "Ver de novo depois" e "Não mostrar mais dicas". Já vista, não aparece; { forcar: true } mostra sempre.
//     Só começam depois do passeio (visto, pulado ou fechado com Esc); pedidas juntas, entram em fila.
//   · Ajuda do VYBES (ajuda()): rever o passeio e qualquer dica, ligar e desligar as dicas.
//
// O que o VYBES diz mora em VybeTutorial.CONTEUDO (logo abaixo): é o lugar de revisar e editar os textos
// e os alvos, sem mexer no resto. "{nome}" vira o primeiro nome da pessoa.
//
// Memória: só no navegador, em localStorage "vybe.tour.<id da pessoa>" (operadorDoTopo; sem ela, "anon").
// Nada vai ao servidor. O Sair do painel apaga as chaves "vybe*": quem sair e entrar de novo pode rever
// o passeio — aceito de propósito.
//
// Visual em vybe-mundo-tutorial.css (classes .vv-tour*), acima do HUD e das janelas (z-index 2000).
// O DOM é montado com createElement e textContent (nada de innerHTML): texto de conteúdo nunca vira HTML.
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const doc = G.document;
  const PREFIXO = 'vybe.tour.';
  const ATRASO_DICA = 450; // ms: o módulo que acabou de abrir termina de entrar antes do balão medir o alvo
  const ESPERAS = 8; // tentativas de 750 ms esperando o operadorDoTopo depois do login (a equipe chega depois da sessão)
  const MARGEM = 12, VAO = 14, FOLGA = 8; // px: borda da tela, balão ↔ alvo, recorte em volta do alvo
  const PRIMEIRO_PASSEIO = 'boas-vindas'; // as dicas só começam depois dele (visto, pulado ou fechado com Esc)

  // ======================================================================================
  // CONTEÚDO — o que o VYBES fala. Edite aqui.
  //   alvo: seletor CSS (ou lista: vale o primeiro visível). Sem alvo, o balão fica no centro.
  //   lado: lado preferido do balão (direita, esquerda, baixo, cima); se não couber, procura outro.
  //   area: 'livre' recorta a parte do mapa que o HUD deixa livre (para o passo do mapa).
  //   variantes: [{ se: seletor, titulo, texto }] — a primeira cujo seletor está visível vence.
  //   marca: id(s) de dica que o passo já explicou (contam como vistas quando o passo aparece).
  //   so: 'dono' — a dica só aparece na lista da Ajuda para os sócios (body.eh-dono).
  // ======================================================================================
  const CONTEUDO = {
    passeios: {
      'boas-vindas': {
        titulo: 'Boas-vindas ao Vybe OS',
        resumo: 'O seu dia, o menu, as ferramentas, o Centro e onde me chamar.',
        passos: [
          { id: 'oi', alvo: null, titulo: 'Boas-vindas ao Vybe OS',
            texto: 'Oi, {nome}. Eu sou o VYBES, e vou te mostrar a casa nova: o Vybe OS abre no seu dia, e cada módulo do menu ocupa a tela inteira.' },
          { id: 'hoje', alvo: '#vv-hoje', lado: 'direita', titulo: 'Seu dia',
            texto: 'Esse é o seu dia: o que vence hoje, o que está atrasado e o que vem nos próximos dias. Quando não souber por onde começar, comece por aqui.',
            variantes: [{ se: '#vv-hoje .vv-seg', titulo: 'Seu painel',
              texto: 'Esse é o seu painel. Para os sócios ele abre em Agência, a visão de dono da produção, e no seletor aqui em cima você troca para Minhas tarefas.' }] },
          { id: 'dock', alvo: '.vv-trilho', lado: 'direita', titulo: 'O dock',
            texto: 'Essa barra é o dock. Cada botão abre uma área de trabalho, e o que está marcado é onde você está agora.' },
          { id: 'criar', alvo: '.vv-trilho-btn[data-trilho="criar"]', lado: 'direita', titulo: 'Criar',
            texto: 'Precisa cadastrar um conteúdo ou uma demanda nova? É aqui, no Criar.' },
          { id: 'ferramentas', alvo: '.vv-barra-topo .vv-ferramentas', lado: 'baixo', titulo: 'Ferramentas',
            texto: 'Aqui em cima ficam as ferramentas: buscar qualquer coisa (⌘K ou Ctrl+K), avisos, a conversa da equipe, suas notas, claro ou escuro e a sua conta.' },
          { id: 'vistas', alvo: '.vv-barra-topo .vv-vistas', lado: 'baixo', titulo: 'Cidade, Prédio e Cérebro',
            texto: 'Aqui você troca o que vê: a Cidade, o Prédio da Vybe, onde cada andar é um setor com os agentes dele, e o Cérebro, com tudo o que eu sei e consulto antes de agir.' },
          { id: 'mapa', alvo: '[data-trilho="centro"]', titulo: 'O Centro',
            texto: 'No Centro fica o Prédio da Vybe com a loja de cada cliente em volta. As bolinhas mostram o status das peças de cada um; clique na loja para abrir o cliente.' },
          { id: 'voz', alvo: '.vv-chamada', lado: 'cima', marca: 'chamada', titulo: 'Barra de voz',
            texto: 'Essa é a barra de voz. Por ela você entra no Escritório, fala com quem está na mesma sala, põe uma música e chama alguém para perto.' },
          { id: 'vybes', alvo: '.vv-trilho-btn[data-trilho="vybes"]', lado: 'direita', titulo: 'Fale comigo',
            texto: 'Quer pedir alguma coisa? Escreva em Pergunte ao VYBES, no seu painel, ou aperte este botão: é só me chamar.' },
          { id: 'fim', alvo: null, titulo: 'Pronto',
            texto: 'Pronto, {nome}. Quando você abrir alguma coisa pela primeira vez eu apareço com uma dica curta, e qualquer dúvida é só apertar o ? no topo.' },
        ],
      },
    },
    // Ordem dos grupos na Ajuda.
    grupos: ['Dock', 'Topo', 'Mapa e prédio', 'Telas'],
    dicas: {
      'trilho:gestao': { grupo: 'Dock', so: 'dono', titulo: 'Gestão da Vybe', alvo: ['.vv-gestao .vv-g-abas', '.vv-trilho-btn[data-trilho="gestao"]'],
        texto: 'Essa é a Gestão, só para os sócios. Nas abas você vê o agora, a semana, os clientes, o time e os bots, e o histórico com a projeção das próximas semanas.' },
      'trilho:tarefas': { grupo: 'Dock', titulo: 'Minhas tarefas', alvo: '.vv-trilho-btn[data-trilho="tarefas"]',
        texto: 'Essa é a sua fila, separada pelo que fazer: o que está em execução, o que sai hoje e o que voltou com ajuste. Clique numa peça para abrir tudo dela.' },
      'trilho:gestor': { grupo: 'Dock', titulo: 'Gestor', alvo: '.vv-trilho-btn[data-trilho="gestor"]',
        texto: 'O Gestor mostra a operação inteira: prioridades, prazos e quanto cada pessoa ainda aguenta. É daqui que se distribui o trabalho.' },
      'trilho:direcao': { grupo: 'Dock', titulo: 'Direção de arte', alvo: '.vv-trilho-btn[data-trilho="direcao"]',
        texto: 'Aqui a direção de arte acompanha a régua de entregas de cada pessoa: o que vence, o que está em alerta e o que espera aprovação.' },
      'trilho:agenda': { grupo: 'Dock', titulo: 'Agenda da Produção', alvo: '.vv-trilho-btn[data-trilho="agenda"]',
        texto: 'Essa é a agenda da Produção: as captações de cada dia, com o cliente e as peças de cada gravação. Ela é a mesma agenda do Google da Vybe.' },
      'trilho:clientes': { grupo: 'Dock', titulo: 'Clientes', alvo: '.vv-trilho-btn[data-trilho="clientes"]',
        texto: 'Aqui está cada cliente ativo, com as peças em aberto, os heads e o cérebro dele. Se já sabe o nome, comece pela busca.' },
      'trilho:equipe': { grupo: 'Dock', titulo: 'Equipe', alvo: '.vv-trilho-btn[data-trilho="equipe"]',
        texto: 'Aqui você vê quem está online, conversa e deixa recado. As missões, o ranking, as conquistas e as VybeCoins da equipe também ficam aqui.' },
      'trilho:jogos': { grupo: 'Dock', titulo: 'Jogos', alvo: '.vv-trilho-btn[data-trilho="jogos"]',
        texto: 'Para o intervalo: sinuca, xadrez, pôquer, dominó, dama, jogo da velha e truco com quem estiver online.' },
      'trilho:predio': { grupo: 'Dock', titulo: 'Prédio da Vybe', alvo: '.vv-trilho-btn[data-trilho="predio"]',
        texto: 'Esse é o Prédio da Vybe. Cada andar é um setor, com os agentes que trabalham nele e as salas da equipe.' },
      'trilho:perfil': { grupo: 'Dock', titulo: 'Seu perfil', alvo: '.vv-trilho-btn[data-trilho="perfil"]',
        texto: 'Esse é o seu perfil: nível, VybeCoins, a meta da semana, o que você ganhou, conquistas, inventário e os números do seu trabalho.' },
      'trilho:vybes': { grupo: 'Dock', titulo: 'VYBES', alvo: '.vv-trilho-btn[data-trilho="vybes"]',
        texto: 'Essa é a minha central: aqui você fala comigo por voz ou por escrito. Eu faço o que você pedir, dentro do que você tem permissão para fazer.' },
      'vista:predio': { grupo: 'Mapa e prédio', titulo: 'O Elevador', alvo: ['#vv-placa .vv-elevador-lista', '#vv-placa'], lado: 'esquerda',
        texto: 'Esse é o Elevador: cada andar aparece com a cor da situação dele. Clique para entrar no andar e passe o mouse num agente para ver o que ele está fazendo.' },
      'ferr:camadas': { grupo: 'Topo', titulo: 'Camadas do mapa', alvo: '#vv-placa', lado: 'esquerda',
        texto: 'Aqui você escolhe o que aparece no mapa. Na Prospecção entram as empresas que ainda não são clientes, filtradas pelo CRM: sem contato, em contato, disseram sim ou disseram não.' },
      'ferr:conversa': { grupo: 'Topo', titulo: 'Conversa da equipe', alvo: ['section.vv-conversa', '[data-ferr="conversa"]'], lado: 'esquerda',
        texto: 'Aqui ficam a conversa da sala em que você está e os recados que deixaram para você. Nas duas abas dá para escrever.' },
      'ferr:whatsapp': { grupo: 'Topo', titulo: 'WhatsApp da Vybe', alvo: ['#vv-whatsapp', '[data-ferr="whatsapp"]'], lado: 'esquerda',
        texto: 'Aqui estão os grupos internos e os dos clientes de que você participa, com as menções a você numa aba só, e eu aviso quando chega mensagem nova. Por enquanto é só para ler: para responder, use o seu WhatsApp.' },
      pessoas: { grupo: 'Topo', titulo: 'Pessoas', alvo: '#vv-pessoas .vp-abas', lado: 'esquerda',
        texto: 'Aqui fica o setor de Pessoas: o seu mês de produtividade, o RH, os projetos pontuais e a Academy. O score sai das demandas do painel, sem nada para preencher, e no botão de interrogação eu explico cada aba.' },
      'ferr:aparencia': { grupo: 'Topo', titulo: 'Aparência', alvo: '.vv-menu-tema', lado: 'esquerda',
        texto: 'Claro, escuro ou automático, que segue o seu computador. Em Mais ajustes dá para reduzir o movimento da tela.' },
      'ferr:conta': { grupo: 'Topo', titulo: 'Sua conta', alvo: '.vv-menu-conta:not(.vv-menu-tema)', lado: 'esquerda',
        texto: 'Aqui ficam a sua conta, com perfil e senha, o botão de atualizar os dados do painel e o Sair.' },
      chamada: { grupo: 'Mapa e prédio', titulo: 'Barra de voz', alvo: '.vv-chamada', lado: 'cima',
        texto: 'Essa é a voz, como no Discord: cada sala é uma conversa, e no botão de pessoas você vê quem está em cada sala e entra com um clique. Microfone, câmera, música e TV ficam aqui também.' },
      decorar: { grupo: 'Mapa e prédio', titulo: 'Decorar a sua sala', alvo: '#vv-decorar', lado: 'esquerda',
        texto: 'Escolha um móvel do inventário e solte na sala; arraste para mudar de lugar, R gira e Delete guarda. Nada vale até apertar Salvar.' },
      andar: { grupo: 'Mapa e prédio', titulo: 'Dentro do andar', alvo: '#mundo-andar .andar-topo', lado: 'baixo',
        texto: 'Aqui dentro você vê todo mundo que está no andar. Clique numa sala para entrar: a voz liga só com quem estiver na mesma sala.' },
      cliente: { grupo: 'Mapa e prédio', titulo: 'Ficha do cliente', alvo: '#vv-placa', lado: 'esquerda',
        texto: 'Essa é a ficha do cliente: onde ele fica, o que está em aberto e o que está atrasado. Em Abrir o cliente você vê tudo dele.' },
      'cerebro-cliente': { grupo: 'Telas', titulo: 'Cérebro do cliente', alvo: null,
        texto: 'Esse é o cérebro do cliente: tudo o que eu sei dele, em nove áreas, cada uma com o agente que cuida dela. Clique numa área para ver de onde veio cada informação.' },
      modulo: { grupo: 'Telas', titulo: 'Tela de trabalho', alvo: '.vv-canto-modulo', lado: 'esquerda',
        texto: 'Você abriu uma tela de trabalho: ela ocupa a tela toda. Esc ou o × voltam para o seu dia.' },
    },
  };

  // ---------- quem é a pessoa e o que ela já viu ----------
  function quem() {
    let p = null, s = null;
    try { p = typeof operadorDoTopo === 'function' ? operadorDoTopo() : null; } catch { p = null; }
    try { s = typeof pessoaLogada === 'function' ? pessoaLogada() : null; } catch { s = null; }
    const id = p && p.id != null && String(p.id) !== '' ? String(p.id) : 'anon';
    const nome = String(p?.name || p?.nome || s?.nome || s?.name || '').trim().split(/\s+/)[0] || '';
    // Paulo, 03/11/2026: o VYBES trata os quatro donos por "senhor"; o resto da equipe, pelo nome.
    const DONOS = ['paulo', 'vinicius', 'ewerton', 'deivid'];
    const chave = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (DONOS.includes(chave)) return { id, nome: 'senhor', esperando: !p && Boolean(s) };
    return { id, nome, esperando: !p && Boolean(s) };
  }
  const vazio = () => ({ v: 1, passeios: {}, dicas: {}, semDicas: false });
  function ler(id = quem().id) {
    try {
      const e = JSON.parse(G.localStorage?.getItem(PREFIXO + id) || 'null');
      if (e && typeof e === 'object') return { ...vazio(), ...e, passeios: { ...(e.passeios || {}) }, dicas: { ...(e.dicas || {}) }, semDicas: e.semDicas === true };
    } catch { /* armazenamento ilegível: começa do zero */ }
    return vazio();
  }
  function mudar(fn, id = quem().id) {
    const e = ler(id); fn(e);
    try { G.localStorage?.setItem(PREFIXO + id, JSON.stringify(e)); } catch { /* navegador sem armazenamento: vale só nesta abertura */ }
    return e;
  }
  const agora = () => new Date().toISOString();
  // "Oi, {nome}." vira "Oi, Paulo." ou, sem nome, "Oi."
  const comNome = (t, nome) => String(t || '').replace(/(,\s*)?\{nome\}/g, (_, v) => (nome ? (v || '') + nome : ''));

  // ---------- DOM ----------
  function h(tag, props = {}, ...filhos) {
    const el = doc.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const f of filhos.flat(Infinity)) if (f != null && f !== false) el.append(f);
    return el;
  }
  const botao = (cls, rotulo, acao, extra = {}) => h('button', { type: 'button', class: cls, onclick: acao, ...extra }, rotulo);
  const cabeca = (sub) => h('div', { class: 'vv-tour-cabeca' },
    h('span', { class: 'vv-tour-avatar', 'aria-hidden': 'true' }, h('i')),
    h('span', { class: 'vv-tour-quem' }, h('b', {}, 'VYBES'), sub ? h('small', {}, sub) : null));

  let raiz = null;
  function raizDoTutorial() {
    if (!raiz || raiz.isConnected === false) { raiz = h('div', { class: 'vv-tour-raiz' }); doc.body.append(raiz); }
    raiz.classList.toggle('vv-tour-quieto', quieto());
    return raiz;
  }
  // "Reduzir movimento": o do sistema, o da Aparência do painel (body[data-motion=reduce]) ou a classe.
  function quieto() {
    const b = doc.body;
    if (b?.dataset?.motion === 'reduce' || b?.classList?.contains('reduzir-movimento')) return true;
    try { return Boolean(G.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches); } catch { return false; }
  }

  // ---------- alvos ----------
  function visivel(el) {
    if (!el || el.isConnected === false) return false;
    if (el.closest?.('[hidden]')) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect?.();
    if (!r || r.width < 2 || r.height < 2) return false;
    const W = G.innerWidth || 0, H = G.innerHeight || 0;
    const dir = r.right ?? r.left + r.width, baixo = r.bottom ?? r.top + r.height;
    if (dir <= 0 || baixo <= 0 || r.left >= W || r.top >= H) return false;
    try {
      const cs = G.getComputedStyle?.(el);
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05)) return false;
    } catch { /* sem estilo calculado: vale o retângulo */ }
    return true;
  }
  function acharAlvo(alvo) {
    for (const sel of [].concat(alvo || [])) {
      let lista = [];
      try { lista = [...doc.querySelectorAll(sel)]; } catch { lista = []; }
      const el = lista.find((x) => !x.closest?.('.vv-tour-raiz') && visivel(x));
      if (el) return el;
    }
    return null;
  }
  const px = (n) => Math.round(n) + 'px';
  const lim = (v, a, z) => Math.max(a, Math.min(z, v));
  function estilo(el, s) { for (const [k, v] of Object.entries(s)) if (el.style[k] !== v) el.style[k] = v; }
  function caixaDe(el, p = {}) {
    const W = G.innerWidth || 0, H = G.innerHeight || 0;
    if (p.area === 'livre') {
      let esq = 0, dir = 0;
      try { const cs = G.getComputedStyle(doc.body); esq = parseFloat(cs.getPropertyValue('--vv-livre-esq')) || 0; dir = parseFloat(cs.getPropertyValue('--vv-livre-dir')) || 0; } catch { /* sem área livre medida */ }
      const l = esq + 24, t = 84, r = W - dir - 24, b = H - 110;
      if (r - l >= 200 && b - t >= 160) return { left: l, top: t, width: r - l, height: b - t };
      return { left: W * 0.15, top: H * 0.2, width: W * 0.7, height: H * 0.5 };
    }
    const r = el.getBoundingClientRect();
    const l = Math.max(4, r.left - FOLGA), t = Math.max(4, r.top - FOLGA);
    const dir = Math.min(W - 4, (r.right ?? r.left + r.width) + FOLGA), baixo = Math.min(H - 4, (r.bottom ?? r.top + r.height) + FOLGA);
    return { left: l, top: t, width: Math.max(0, dir - l), height: Math.max(0, baixo - t) };
  }
  // Balão ao lado do alvo: o lado pedido, senão direita, baixo, esquerda, cima; nada cabendo, dentro do recorte.
  function colocarBalao(b, c, preferido) {
    const W = G.innerWidth || 0, H = G.innerHeight || 0;
    const bw = b.offsetWidth || 320, bh = b.offsetHeight || 180;
    let x, y, lado = 'centro', bico = 0;
    if (!c) { x = (W - bw) / 2; y = (H - bh) / 2; }
    else {
      const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
      const yLado = lim(cy - bh / 2, MARGEM, H - bh - MARGEM), xLado = lim(cx - bw / 2, MARGEM, W - bw - MARGEM);
      const lugares = {
        direita: [c.left + c.width + VAO, yLado, c.left + c.width + VAO + bw <= W - MARGEM],
        esquerda: [c.left - VAO - bw, yLado, c.left - VAO - bw >= MARGEM],
        baixo: [xLado, c.top + c.height + VAO, c.top + c.height + VAO + bh <= H - MARGEM],
        cima: [xLado, c.top - VAO - bh, c.top - VAO - bh >= MARGEM],
      };
      lado = [preferido, 'direita', 'baixo', 'esquerda', 'cima'].find((l) => lugares[l]?.[2]) || 'dentro';
      if (lado === 'dentro') { x = xLado; y = lim(c.top + c.height - bh - 16, MARGEM, H - bh - MARGEM); }
      else [x, y] = lugares[lado];
      bico = lado === 'direita' || lado === 'esquerda' ? lim(cy - y, 22, bh - 22) : lim(cx - x, 22, bw - 22);
    }
    estilo(b, { left: px(x), top: px(y) });
    b.style.setProperty?.('--bico', px(bico));
    if (b.getAttribute('data-lado') !== lado) b.setAttribute('data-lado', lado);
  }

  // ---------- teclado, redimensionar e o relógio de reposicionar (só enquanto algo está aberto) ----------
  let ouvindo = false, relogio = null, quadro = false;
  function atualizarOuvidos() {
    const sim = Boolean(passeio || dicaAtual || ajudaAtual);
    if (sim && !ouvindo) {
      G.addEventListener?.('keydown', aoTeclar, true); G.addEventListener?.('resize', aoMudarTela);
      relogio = G.setInterval?.(reposicionar, 400); ouvindo = true;
    } else if (!sim && ouvindo) {
      G.removeEventListener?.('keydown', aoTeclar, true); G.removeEventListener?.('resize', aoMudarTela);
      G.clearInterval?.(relogio); relogio = null; ouvindo = false;
    }
  }
  function aoMudarTela() {
    if (quadro) return; quadro = true;
    const prox = G.requestAnimationFrame ? (f) => G.requestAnimationFrame(f) : (f) => G.setTimeout(f, 16);
    prox(() => { quadro = false; reposicionar(); });
  }
  function reposicionar() { if (passeio) posicionarPasseio(); if (dicaAtual) posicionarDica(); }
  const engolir = (e) => { e.preventDefault?.(); e.stopPropagation?.(); e.stopImmediatePropagation?.(); };
  const ehCampo = (el) => Boolean(el?.closest?.('input, textarea, select, [contenteditable="true"]'));
  function prenderFoco(e, lista) {
    const f = lista.filter((x) => x && !x.disabled && !x.hidden && x.isConnected !== false);
    if (!f.length) return;
    const i = f.indexOf(doc.activeElement);
    const alvo = e.shiftKey ? (i <= 0 ? f[f.length - 1] : f[i - 1]) : (i < 0 || i === f.length - 1 ? f[0] : f[i + 1]);
    engolir(e); alvo.focus?.({ preventScroll: true });
  }
  // O Esc é de quem está por cima (ajuda → passeio → dica) e não chega ao mapa nem ao módulo.
  function aoTeclar(e) {
    const k = e.key;
    if (ajudaAtual) {
      if (k === 'Escape') { engolir(e); fecharAjuda(); } else if (k === 'Tab') prenderFoco(e, ajudaAtual.focaveis);
      return;
    }
    if (passeio) {
      if (k === 'Escape') { engolir(e); fecharPasseio(true); }
      else if (k === 'Tab') prenderFoco(e, [passeio.el.pular, passeio.el.voltar, passeio.el.proximo]);
      else if (!ehCampo(e.target) && k === 'ArrowRight') { engolir(e); proximo(); }
      else if (!ehCampo(e.target) && k === 'ArrowLeft') { engolir(e); voltar(); }
      return;
    }
    if (dicaAtual && k === 'Escape') { engolir(e); fecharDica('entendi'); }
  }

  // ======================================================================================
  // PASSEIO
  // ======================================================================================
  let passeio = null, tentativas = 0, esperando = null;
  function iniciar({ forcar = false, passeio: qual = 'boas-vindas' } = {}) {
    const def = CONTEUDO.passeios[qual];
    if (!def || passeio || !doc?.body) return false;
    if (doc.body.classList?.contains('auth-pending')) return false;
    const eu = quem();
    // Logou mas a equipe ainda não chegou: espera um pouco para não guardar como "anon".
    if (eu.esperando && !forcar && tentativas < ESPERAS) {
      tentativas++; G.clearTimeout?.(esperando);
      esperando = G.setTimeout?.(() => { esperando = null; iniciar({ forcar, passeio: qual }); }, 750);
      return false;
    }
    tentativas = 0;
    if (!forcar && ler(eu.id).passeios[qual]) return false;
    cancelarDica(); fecharDica('depois'); fecharAjuda(false);

    const el = {};
    el.titulo = h('h2', { class: 'vv-tour-titulo', id: 'vv-tour-titulo' });
    el.texto = h('p', { class: 'vv-tour-texto', id: 'vv-tour-texto' });
    el.conta = h('span', { class: 'vv-tour-conta' });
    el.anuncio = h('p', { class: 'vv-tour-so-leitor', 'aria-live': 'polite', 'aria-atomic': 'true' });
    el.pular = botao('vv-tour-pular', 'Pular', () => fecharPasseio(true), { 'data-tour': 'pular' });
    el.voltar = botao('vv-tour-sec', 'Voltar', () => voltar(), { 'data-tour': 'voltar' });
    el.proximo = botao('vv-tour-principal', 'Próximo', () => proximo(), { 'data-tour': 'proximo' });
    el.luz = h('div', { class: 'vv-tour-luz vazia', 'aria-hidden': 'true' });
    el.balao = h('section', { class: 'vv-tour-balao', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vv-tour-titulo', 'aria-describedby': 'vv-tour-texto', tabindex: '-1' },
      h('span', { class: 'vv-tour-bico', 'aria-hidden': 'true' }),
      cabeca(def.titulo), el.titulo, el.texto,
      h('div', { class: 'vv-tour-rodape' },
        h('span', { class: 'vv-tour-esq' }, el.conta, el.pular),
        h('span', { class: 'vv-tour-acoes' }, el.voltar, el.proximo)),
      el.anuncio);
    // O fundo segura os cliques: durante o passeio nada abre por baixo sem querer.
    el.tela = h('div', { class: 'vv-tour', 'data-modo': 'passeio' }, h('div', { class: 'vv-tour-fundo' }), el.luz, el.balao);
    raizDoTutorial().append(el.tela);
    passeio = { qual, def, i: -1, eu, el, focoAntes: doc.activeElement };
    atualizarOuvidos();
    irPara(0, 1);
    if (passeio) G.setTimeout?.(() => passeio?.el.tela.classList.add('vv-tour-anda'), 30); // transições só depois do 1º lugar
    return true;
  }
  const passoValido = (p) => !p.alvo || Boolean(acharAlvo(p.alvo));
  // Procura, na direção pedida, o próximo passo cujo alvo está na tela. Passou do último: concluiu.
  function irPara(i, dir) {
    const passos = passeio.def.passos;
    for (; i >= 0 && i < passos.length; i += dir) if (passoValido(passos[i])) { passeio.i = i; pintarPasso(); return true; }
    if (dir > 0) fecharPasseio(true);
    return false;
  }
  function proximo() { if (passeio) irPara(passeio.i + 1, 1); }
  function voltar() { if (passeio && passeio.i > 0) irPara(passeio.i - 1, -1); }
  function variante(p) {
    for (const v of p.variantes || []) if (v.se && acharAlvo(v.se)) return { titulo: v.titulo || p.titulo, texto: v.texto || p.texto };
    return { titulo: p.titulo, texto: p.texto };
  }
  function pintarPasso() {
    const { def, i, eu, el } = passeio;
    const v = variante(def.passos[i]);
    const validos = def.passos.map((p, j) => (passoValido(p) || j === i ? j : -1)).filter((j) => j >= 0);
    const n = validos.indexOf(i) + 1, total = validos.length;
    const primeiro = validos[0] === i, ultimo = validos[validos.length - 1] === i;
    const texto = comNome(v.texto, eu.nome);
    el.titulo.textContent = v.titulo;
    el.texto.textContent = texto;
    el.conta.textContent = `${n} de ${total}`;
    el.voltar.hidden = primeiro;
    el.pular.hidden = ultimo;
    el.proximo.textContent = ultimo ? 'Concluir' : 'Próximo';
    el.anuncio.textContent = `Passo ${n} de ${total}. ${v.titulo}. ${texto}`;
    el.balao.setAttribute('data-passo', def.passos[i].id || String(i));
    // O passo que já explicou uma coisa conta como a dica dela (a barra de voz não ganha dica repetida).
    const marca = [].concat(def.passos[i].marca || []);
    if (marca.length) mudar((e) => { for (const id of marca) e.dicas[id] ||= agora(); }, eu.id);
    posicionarPasseio();
    el.proximo.focus?.({ preventScroll: true });
  }
  function posicionarPasseio() {
    const { def, i, el } = passeio; const p = def.passos[i];
    const alvo = p.alvo ? acharAlvo(p.alvo) : null;
    const c = alvo ? caixaDe(alvo, p) : null; // alvo sumiu no meio do passo: balão no centro, sem pular sozinho
    const W = G.innerWidth || 0, H = G.innerHeight || 0;
    const luz = c || { left: W / 2, top: H / 2, width: 0, height: 0 };
    estilo(el.luz, { left: px(luz.left), top: px(luz.top), width: px(luz.width), height: px(luz.height) });
    el.luz.classList.toggle('vazia', !c);
    colocarBalao(el.balao, c, p.lado);
  }
  // Concluir, Pular e Esc marcam como visto: dá para rever pela Ajuda.
  function fecharPasseio(marcar) {
    if (!passeio) return;
    const { qual, eu, el, focoAntes } = passeio;
    passeio = null;
    if (marcar) mudar((e) => { e.passeios[qual] = agora(); }, eu.id);
    el.tela.remove();
    atualizarOuvidos();
    if (focoAntes && focoAntes.isConnected !== false) focoAntes.focus?.({ preventScroll: true });
  }

  // ======================================================================================
  // DICAS
  // ======================================================================================
  let dicaAtual = null, dicaPendente = null, pendenteId = '';
  const adiadas = new Set(); // "Ver de novo depois": volta na próxima abertura do painel
  // Dicas pedidas juntas (ex.: o botão do dock e o "módulo aberto") entram em fila: uma de cada vez.
  const fila = [];
  function cancelarPendente() { if (dicaPendente) G.clearTimeout?.(dicaPendente); dicaPendente = null; pendenteId = ''; }
  function cancelarDica() { cancelarPendente(); fila.length = 0; }
  // Primeiro o passeio: antes de a pessoa ver (ou pular) as boas-vindas, nenhuma dica aparece por cima dele.
  function podeMostrar(id) {
    const e = ler();
    if (CONTEUDO.passeios[PRIMEIRO_PASSEIO] && !e.passeios[PRIMEIRO_PASSEIO]) return false;
    return !(e.semDicas || e.dicas[id] || adiadas.has(id));
  }
  function agendar(id, ms) {
    cancelarPendente(); pendenteId = id;
    dicaPendente = G.setTimeout?.(() => { dicaPendente = null; pendenteId = ''; mostrarDica(id); }, ms);
  }
  function proximaDaFila() { while (fila.length) { const id = fila.shift(); if (podeMostrar(id)) { agendar(id, 300); return; } } }
  function dica(id, { forcar = false } = {}) {
    const d = CONTEUDO.dicas[id];
    if (!d || passeio || ajudaAtual || !doc?.body) return false;
    if (!forcar) {
      if (dicaAtual?.id === id || pendenteId === id || fila.includes(id)) return true;
      if (!podeMostrar(id)) return false;
      if (dicaAtual || pendenteId) { fila.push(id); return true; }
    }
    agendar(id, forcar ? 0 : ATRASO_DICA);
    return true;
  }
  function mostrarDica(id) {
    const d = CONTEUDO.dicas[id];
    if (!d || passeio || ajudaAtual) return;
    fecharDica('depois', false);
    const eu = quem();
    const alvo = d.alvo ? acharAlvo(d.alvo) : null;
    const anel = alvo ? h('div', { class: 'vv-tour-anel', 'aria-hidden': 'true' }) : null;
    const entendi = botao('vv-tour-principal', 'Entendi', () => fecharDica('entendi'), { 'data-tour': 'entendi' });
    const depois = botao('vv-tour-sec', 'Ver de novo depois', () => fecharDica('depois'), { 'data-tour': 'depois' });
    const nunca = botao('vv-tour-link', 'Não mostrar mais dicas', () => { fecharDica(null); desligarDicas(true); }, { 'data-tour': 'sem-dicas' });
    const balao = h('section', { class: 'vv-tour-balao vv-tour-dica', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'vv-tour-dica-titulo', 'aria-describedby': 'vv-tour-dica-texto', tabindex: '-1', 'data-dica': id },
      h('span', { class: 'vv-tour-bico', 'aria-hidden': 'true' }),
      cabeca('Dica'),
      h('h2', { class: 'vv-tour-titulo', id: 'vv-tour-dica-titulo' }, d.titulo),
      h('p', { class: 'vv-tour-texto', id: 'vv-tour-dica-texto', 'aria-live': 'polite' }, comNome(d.texto, eu.nome)),
      h('div', { class: 'vv-tour-rodape' }, h('span', { class: 'vv-tour-acoes' }, depois, entendi)),
      h('div', { class: 'vv-tour-mais' }, nunca));
    const r = raizDoTutorial();
    if (anel) r.append(anel);
    r.append(balao);
    dicaAtual = { id, eu, anel, balao, temAlvo: Boolean(alvo), focoAntes: doc.activeElement };
    posicionarDica();
    atualizarOuvidos();
    // Não tira o foco de quem está digitando (busca do módulo que acabou de abrir): o aria-live avisa.
    if (!ehCampo(doc.activeElement)) balao.focus?.({ preventScroll: true });
  }
  function posicionarDica() {
    const d = dicaAtual; const def = CONTEUDO.dicas[d.id];
    const alvo = def?.alvo ? acharAlvo(def.alvo) : null;
    if (d.temAlvo && !alvo) { fecharDica('depois'); return; } // o que ela explicava fechou: volta outro dia
    const c = alvo ? caixaDe(alvo) : null;
    if (d.anel && c) estilo(d.anel, { left: px(c.left), top: px(c.top), width: px(c.width), height: px(c.height) });
    colocarBalao(d.balao, c, def?.lado);
  }
  // motivo: 'entendi' marca como vista; 'depois' guarda para a próxima abertura; null só fecha.
  // seguir: chama a próxima da fila (não quando outra dica já vai tomar o lugar).
  function fecharDica(motivo, seguir = true) {
    const d = dicaAtual; if (!d) return;
    dicaAtual = null;
    d.anel?.remove(); d.balao.remove();
    if (motivo === 'entendi') mudar((e) => { e.dicas[d.id] = agora(); }, d.eu.id);
    else if (motivo === 'depois') adiadas.add(d.id);
    atualizarOuvidos();
    const foco = doc.activeElement;
    if ((!foco || foco === doc.body || foco === d.balao || d.balao.contains?.(foco)) && d.focoAntes && d.focoAntes.isConnected !== false) d.focoAntes.focus?.({ preventScroll: true });
    if (seguir && motivo) proximaDaFila();
  }
  function desligarDicas(sim = true) {
    const e = mudar((x) => { x.semDicas = Boolean(sim); });
    if (sim) { cancelarDica(); fecharDica(null); }
    return e.semDicas;
  }

  // ======================================================================================
  // AJUDA DO VYBES
  // ======================================================================================
  let ajudaAtual = null;
  function ajuda() {
    if (!doc?.body) return false;
    if (passeio) fecharPasseio(false);
    cancelarDica(); fecharDica('depois');
    if (ajudaAtual) fecharAjuda(false);
    const eu = quem(), e = ler(eu.id), dono = Boolean(doc.body.classList?.contains('eh-dono'));
    const focaveis = [];
    const guardar = (el) => { focaveis.push(el); return el; };
    const linha = (titulo, sub, visto, acao, extra, [sim, nao] = ['Vista', 'Nova']) => guardar(h('button', { type: 'button', class: 'vv-tour-linha', onclick: acao, ...extra },
      h('b', {}, titulo), h('small', {}, sub), h('em', { class: visto ? 'vista' : 'nova' }, visto ? sim : nao)));

    const fechar = guardar(botao('vv-tour-x', '×', () => fecharAjuda(), { 'aria-label': 'Fechar a ajuda', 'data-tour': 'fechar-ajuda' }));
    const refazer = guardar(botao('vv-tour-principal vv-tour-largo', 'Refazer o passeio', () => { fecharAjuda(false); iniciar({ forcar: true }); }, { 'data-tour': 'refazer' }));
    const passeios = Object.entries(CONTEUDO.passeios).map(([id, p]) =>
      linha(p.titulo, p.resumo || '', Boolean(e.passeios[id]), () => { fecharAjuda(false); iniciar({ forcar: true, passeio: id }); }, { 'data-tour-passeio': id }, ['Visto', 'Novo']));
    const ids = Object.keys(CONTEUDO.dicas).filter((id) => CONTEUDO.dicas[id].so !== 'dono' || dono);
    const grupos = [...new Set([...(CONTEUDO.grupos || []), ...ids.map((id) => CONTEUDO.dicas[id].grupo || 'Outras')])]
      .map((g) => [g, ids.filter((id) => (CONTEUDO.dicas[id].grupo || 'Outras') === g)]).filter(([, l]) => l.length)
      .map(([g, l]) => [h('h4', { class: 'vv-tour-grupo' }, g), h('div', { class: 'vv-tour-lista' },
        l.map((id) => linha(CONTEUDO.dicas[id].titulo, comNome(CONTEUDO.dicas[id].texto, eu.nome), Boolean(e.dicas[id]), () => { fecharAjuda(false); dica(id, { forcar: true }); }, { 'data-tour-dica': id })))]);
    const chave = guardar(h('input', { type: 'checkbox', 'data-tour': 'chave-dicas', checked: !e.semDicas, onchange: (ev) => desligarDicas(!ev.target.checked) }));
    const zerar = guardar(botao('vv-tour-link', 'Zerar o que já vi', () => { fecharAjuda(false); reset(); ajuda(); }, { 'data-tour': 'zerar' }));

    const janela = h('section', { class: 'vv-tour-janela', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vv-tour-ajuda-titulo', 'aria-describedby': 'vv-tour-ajuda-texto', tabindex: '-1' },
      h('header', { class: 'vv-tour-janela-topo' },
        h('span', { class: 'vv-tour-avatar', 'aria-hidden': 'true' }, h('i')),
        h('div', {}, h('small', { class: 'vv-tour-kicker' }, 'Ajuda'), h('h2', { class: 'vv-tour-titulo', id: 'vv-tour-ajuda-titulo' }, 'Ajuda do VYBES')),
        fechar),
      h('p', { class: 'vv-tour-texto', id: 'vv-tour-ajuda-texto' }, comNome('Oi, {nome}. Aqui você revê o passeio e qualquer dica, quando quiser.', eu.nome)),
      refazer,
      h('h3', { class: 'vv-tour-secao' }, 'Passeios'), h('div', { class: 'vv-tour-lista' }, passeios),
      h('h3', { class: 'vv-tour-secao' }, 'Dicas'), grupos,
      h('div', { class: 'vv-tour-janela-pe' },
        h('label', { class: 'vv-tour-chave' }, chave, h('span', {}, 'Mostrar uma dica quando eu abrir algo pela primeira vez')),
        zerar));
    const tela = h('div', { class: 'vv-tour vv-tour-ajuda', 'data-modo': 'ajuda' }, h('div', { class: 'vv-tour-veu', onclick: () => fecharAjuda() }), janela);
    raizDoTutorial().append(tela);
    ajudaAtual = { tela, janela, focaveis, focoAntes: doc.activeElement };
    atualizarOuvidos();
    janela.focus?.({ preventScroll: true });
    return true;
  }
  function fecharAjuda(devolverFoco = true) {
    const a = ajudaAtual; if (!a) return;
    ajudaAtual = null;
    a.tela.remove();
    atualizarOuvidos();
    if (devolverFoco && a.focoAntes && a.focoAntes.isConnected !== false) a.focoAntes.focus?.({ preventScroll: true });
  }

  // ---------- zerar e fechar ----------
  // Esquece o que a pessoa já viu (passeio, dicas e "não mostrar dicas") neste navegador.
  function reset() {
    const eu = quem();
    try { G.localStorage?.removeItem(PREFIXO + eu.id); } catch { /* sem armazenamento */ }
    adiadas.clear(); cancelarDica(); fecharDica(null);
    if (passeio) fecharPasseio(false);
    return true;
  }
  function fechar() { cancelarDica(); fecharDica(null); fecharAjuda(); if (passeio) fecharPasseio(false); }
  function estado() { const eu = quem(); return { pessoa: eu.id, ...ler(eu.id), adiadas: [...adiadas], aberto: passeio ? 'passeio' : ajudaAtual ? 'ajuda' : dicaAtual ? 'dica:' + dicaAtual.id : '' }; }

  G.VybeTutorial = { iniciar, dica, ajuda, desligarDicas, reset, fechar, estado, CONTEUDO };
})();
