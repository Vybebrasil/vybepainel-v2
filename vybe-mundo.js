// vybe-mundo.js — o Vybe OS pousado no mundo voxel (Irecê + Prédio da Vybe).
//
// Não é outra interface: a tela de módulos (#mode-gate) continua a mesma, com
// as mesmas estações e funções (chooseManagerMode, chooseClientMode,
// chooseOfficeMode, chooseVybesMode…). Aqui só se acrescenta o mundo atrás
// dela, o HUD de mapa e as portas do prédio, que abrem os módulos existentes.
// Desligado (Aparência → "Mundo voxel"), o painel é exatamente o de antes.
//
// O 3D (three.js) é carregado sob demanda: o módulo do mundo, o relevo e a base de empresas
// ganham hash no nome no build (scripts/build.mjs troca os três endereços abaixo).
(() => {
  const CHAVE = 'vybe.mundo.v1';
  const MUNDO_JS = "/assets/mundo/mundo-3d.js";
  const MUNDO_DADOS = "/assets/mundo/irece.json";
  const MUNDO_CRM = "/assets/mundo/crm-irece.json";
  const body = document.body;
  // Sem escolha guardada, abre o modo legado (o painel de hoje): o Irecity entra por escolha, no portão de
  // login (Entrar no Irecity) ou na Aparência. Assim ninguém da equipe é pego de surpresa ao publicar.
  // O Irecity é o Vybe OS (Paulo, 07/11/2026: "quero me livrar do modo legado"). Não há mais escolha nem
  // lembrança por navegador. Porta de emergência: ?legado=1 no endereço (só nesta abertura da página).
  // Tema claro / escuro / automático (Paulo, 07/11/2026). A chave não começa com "vybe" para o Sair não apagar.
  const CHAVE_TEMA = 'irecity.tema';
  const temaEscolhido = () => { try { return localStorage.getItem(CHAVE_TEMA) || 'claro'; } catch { return 'claro'; } };
  const sistemaEscuro = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; } };
  function aplicarTema(t = temaEscolhido()) {
    const escuro = t === 'escuro' || (t === 'auto' && sistemaEscuro());
    document.documentElement?.classList?.toggle('tema-escuro', escuro);
    document.documentElement?.style && (document.documentElement.style.colorScheme = escuro ? 'dark' : 'light');
  }
  function trocarTema(t) { try { localStorage.setItem(CHAVE_TEMA, t); } catch {} aplicarTema(t); }
  aplicarTema();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (temaEscolhido() === 'auto') aplicarTema(); }); } catch {}
  const pedeLegado = (() => { try { return new URLSearchParams(location.search).get('legado') === '1'; } catch { return false; } })();
  let ligado = !pedeLegado;
  const semWebGL = (() => { try { const c = document.createElement('canvas'); return !(c.getContext('webgl2') || c.getContext('webgl')); } catch { return true; } })();
  if (semWebGL) ligado = false;

  // ---------- Situação: a cor de cada peça (a mesma regra em todo o mundo) ----------
  const SITUACOES = [
    ['atrasada', 'Atrasada'], ['aprovar', 'Para aprovar'], ['ajuste', 'Ajuste pedido'], ['hoje', 'Sai hoje'],
    ['briefing', 'Sem briefing'], ['fazer', 'A fazer'], ['pronta', 'Pronta'], ['concluida', 'Concluída'],
  ];
  const ORDEM = Object.fromEntries(SITUACOES.map(([k], i) => [k, i]));
  const COR = { atrasada: '#E5484D', aprovar: '#8E4EC6', ajuste: '#D6409F', hoje: '#F76808', briefing: '#7A8B82', fazer: '#0D74CE', pronta: '#18A957', concluida: '#8FA398' };
  const hojeIso = () => (typeof hojeDeVerdade === 'function' ? hojeDeVerdade() : new Date().toISOString().slice(0, 10));
  // A data do cliente (veiculação/conclusão) manda; o prazo interno também conta como atraso da equipe.
  function situacaoDaPeca(item, hoje = hojeIso()) {
    const st = String(item?.status || '');
    const fechada = typeof isFinishedItem === 'function' ? isFinishedItem(item) : /finalizad|feito|conclu/i.test(st);
    if (fechada) return 'concluida';
    const veic = String(item?.veiculacao_iso || ''), prazo = String(item?.prazo_iso || '');
    if ((veic && veic < hoje) || item?.prazo_atrasado || (prazo && prazo < hoje)) return 'atrasada';
    if (/aprova/i.test(st)) return 'aprovar';
    if (/altera|ajuste|corre/i.test(st)) return 'ajuste';
    if (veic === hoje || prazo === hoje) return 'hoje';
    if (/falta (briefing|info)|sem briefing|ag\. info/i.test(st)) return 'briefing';
    if (/agendad|para agendar|aprovado|pronta/i.test(st)) return 'pronta';
    return 'fazer';
  }
  window.situacaoDaPecaNoMundo = situacaoDaPeca;

  // ---------- Clientes do mundo: só os ativos do cadastro, com as peças em aberto ----------
  const norm = (n) => (typeof normalizarCliente === 'function' ? normalizarCliente(String(n || '')) : String(n || '').trim());
  function clientesDoMundo() {
    const cadastro = (typeof CADASTRO_CLIENTES !== 'undefined' ? CADASTRO_CLIENTES : []).filter((c) => c.ativo !== false && !/inativ/i.test(String(c.status || '')));
    const itens = [...(typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : []), ...(typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : [])];
    const mapa = new Map();
    const chave = (n) => norm(n).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    // id do cadastro: a logo do Drive sai por /api/painel?area=logo&c=<id> (a mesma da capa do planejamento).
    const logoDe = (c) => { const id = String(c.id ?? c.cliente_id ?? ''); return /^\d{1,18}$/.test(id) ? `/api/painel?area=logo&c=${id}` : ''; };
    for (const c of cadastro) mapa.set(chave(c.nome), { nome: norm(c.nome) || c.nome, segmento: c.segmento || '', endereco: c.endereco || '', logo: logoDe(c), total: 0, por: {}, situacao: 'concluida' });
    const semCadastro = !cadastro.length; // demonstração / cadastro ainda não carregado
    const vistos = new Set();
    const hoje = hojeIso();
    for (const item of itens) {
      if (vistos.has(item.id)) continue; vistos.add(item.id);
      const nomes = typeof clientesDoItem === 'function' ? clientesDoItem(item) : [item.cliente].filter(Boolean);
      const sit = situacaoDaPeca(item, hoje);
      for (const n of nomes) {
        let c = mapa.get(chave(n));
        if (!c && semCadastro && n && n !== '—') { c = { nome: n, segmento: '', total: 0, por: {}, situacao: 'concluida' }; mapa.set(chave(n), c); }
        if (!c || sit === 'concluida') continue;
        c.total++; c.por[sit] = (c.por[sit] || 0) + 1;
        // Bolinhas do Centro: o status de verdade da peça, na cor do quadro (Paulo: "aprovação azul 1, alteração vermelha 1").
        const nomeSt = String(item.status || 'Sem status').trim() || 'Sem status';
        const st = (c.status ||= {})[nomeSt] ||= { nome: nomeSt, n: 0, cor: corStatus(item, sit), ordem: ORDEM[sit] ?? 9 };
        st.n++; st.ordem = Math.min(st.ordem, ORDEM[sit] ?? 9);
        if (ORDEM[sit] < ORDEM[c.situacao]) c.situacao = sit;
      }
    }
    return [...mapa.values()].map((c) => ({ ...c, cor: COR[c.situacao], peso: 8 - ORDEM[c.situacao],
      status: Object.values(c.status || {}).sort((a, b) => a.ordem - b.ordem || b.n - a.n) }));
  }

  // ---------- Montagem ----------
  let mundo = null, carregando = null, erroCarga = false, tentativasCarga = 0, ultimaAssinatura = '', naTela = [];
  // Centro comercial aberto (Paulo, 08/11/2026): só com ele o 3D é montado e desenhado.
  let centroAberto = false;
  const raiz = document.createElement('div'); raiz.id = 'mundo';
  raiz.innerHTML = '<canvas aria-label="Mapa de Irecê com o Prédio da Vybe e os clientes"></canvas><div class="mundo-vinheta"></div><div class="mundo-carregando">Montando o Centro…</div>'
    + '<div class="mundo-fonte">Arraste para andar · botão direito ou Shift para girar · clique numa loja para abrir o cliente</div>';
  const hud = document.createElement('div'); hud.id = 'mundo-hud';
  raiz.addEventListener?.('click', (e) => {
    if (!e.target.closest('[data-mundo-repetir]')) return;
    erroCarga = false; tentativasCarga++; void carregar();
  });
  const ic = {
    cidade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V9l5-3v15M14 21V4l5 3v14M8 11h0M8 15h0M17 10h0M17 14h0"/></svg>',
    predio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h6M9 11h6M9 15h6M10 21v-3h4v3"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    menos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    girar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    tudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };
  // ---------- Trilho da esquerda: os módulos como ícones (Paulo, 06/11/2026) ----------
  // Cada botão chama a MESMA função da estação na tela de módulos. "Módulos" mostra
  // as estações completas (nada some); "Hoje" é o painel do dia guiado pelo VYBES.
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  // Setores com submódulos (Paulo, 07/11/2026, olhando o AgencyFlow: "módulos nesse esquema com os submódulos").
  // O setor é um ícone do trilho; clicar abre ao lado a lista dos submódulos. Submódulo com `mod` só aparece
  // quando o módulo dele está carregado (window[mod[0]]), assim um setor nunca mostra botão que não abre nada.
  const TRILHO = [
    { id: 'hoje', nome: 'Hoje', dica: 'Seu dia', ic: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>') },
    { id: 'setor:gestao', nome: 'Gestão', dica: 'Gestão da Vybe', ic: svg('<path d="M4 19h16"/><path d="M6 15l4-5 3 3 5-7"/><circle cx="18" cy="6" r="1.6"/>'), sub: [
      { id: 'gestao', nome: 'Visão geral', dica: 'Agora, semana, clientes, time e bots, histórico e projeção' },
      { id: 'gestor', nome: 'Gestor', dica: 'Prioridades, prazos e capacidade' },
      { id: 'produtividade', nome: 'Produtividade', dica: 'Score, ranking, metas e conquistas do time', mod: ['VybePessoas', 'produtividade'] },
    ] },
    { id: 'criar', nome: 'Criar', dica: 'Cadastros: criar conteúdo ou demanda', acao: true, ic: svg('<path d="M12 5v14M5 12h14"/>') },
    { id: 'setor:producao', nome: 'Produção', dica: 'Produção: tarefas, agenda, direção de arte e conteúdo', ic: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'), sub: [
      { id: 'tarefas', nome: 'Minhas tarefas', dica: 'Sua fila, na ordem do dia' },
      { id: 'agenda', nome: 'Agenda e captações', dica: 'Produção e agenda de captações' },
      { id: 'direcao', nome: 'Direção de arte', dica: 'Fila, radar e revisão das peças' },
      { id: 'planejamentos', nome: 'Planejamentos', dica: 'Centro de Operação: o planejamento de cada cliente para revisar, editar, aprovar e enviar', mod: ['VybePlanejamentos'] },
      { id: 'conteudo', nome: 'Equilíbrio e aprovação', dica: 'Atração, educação e conversão de cada cliente; link de aprovação', mod: ['VybeConteudo'] },
      { id: 'projetos', nome: 'Projetos pontuais', dica: 'Eventos, lançamentos e sites, com a carga da equipe', mod: ['VybePessoas', 'projetos'] },
    ] },
    { id: 'setor:clientes', nome: 'Clientes', dica: 'Clientes: carteira, saúde e onboarding', ic: svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'), sub: [
      { id: 'clientes', nome: 'Todos os clientes', dica: 'Clientes, fichas e cérebro de cada um' },
      { id: 'carteira', nome: 'Saúde da carteira', dica: 'Nota de saúde, risco e clientes prioritários', mod: ['VybeCarteira', 'saude'] },
      { id: 'onboarding', nome: 'Onboarding', dica: 'Cliente novo: boas-vindas, contrato, acessos e kickoff', mod: ['VybeCarteira', 'onboarding'] },
      { id: 'churn', nome: 'Churn', dica: 'Quem saiu, por quê, receita perdida e retenção', mod: ['VybeCarteira', 'churn'] },
      { id: 'contratos', nome: 'Contratos', dica: 'Valor, início e renovações em breve', mod: ['VybeCarteira', 'contratos'] },
    ] },
    { id: 'setor:comercial', nome: 'Comercial', dica: 'Comercial: funil, pacotes, orçamentos e creators', ic: svg('<path d="M3 11l18-7-7 18-2-8z"/>'), sub: [
      { id: 'funil', nome: 'Funil de vendas', dica: 'Leads, propostas, ganhos e motivos de perda', mod: ['VybeComercial', 'funil'] },
      { id: 'pacotes', nome: 'Pacotes', dica: 'Produtos da Vybe com custo e margem', mod: ['VybeComercial', 'pacotes'] },
      { id: 'orcamentos', nome: 'Orçamentos', dica: 'Propostas a partir dos pacotes', mod: ['VybeComercial', 'orcamentos'] },
      { id: 'creators', nome: 'Creators', dica: 'Influenciadores de Irecê e região', mod: ['VybeComercial', 'creators'] },
      { id: 'fornecedores', nome: 'Fornecedores', dica: 'Gráficas, audiovisual, eventos, com BV', mod: ['VybeComercial', 'fornecedores'] },
    ] },
    { id: 'setor:financas', nome: 'Finanças', dica: 'Finanças: margem e pagamento por cliente', ic: svg('<path d="M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>'), sub: [
      { id: 'financas', nome: 'Por cliente', dica: 'Contrato, custo, margem e pagamento', mod: ['VybeComercial', 'financas'] },
      { id: 'recebimentos', nome: 'Recebimentos', dica: 'Recorrentes e pontuais: a receber, recebido e pendente', mod: ['VybeComercial', 'recebimentos'] },
      { id: 'contas', nome: 'Contas a pagar', dica: 'Fixas, variáveis, folha, impostos, com % do faturamento', mod: ['VybeComercial', 'contas'] },
      { id: 'inadimplencia', nome: 'Inadimplência', dica: 'Quem está em atraso e há quanto tempo', mod: ['VybeComercial', 'inadimplencia'] },
      { id: 'vybe-financas', nome: 'Vybe Finanças', dica: 'Abrir o app financeiro da Vybe', url: 'https://vybe-financas.vercel.app/' },
    ] },
    { id: 'setor:pessoas', nome: 'Pessoas', dica: 'Pessoas: equipe, RH, academy e perfil', ic: svg('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c0-2.5 1.5-4.5 4-4.5s3 1.5 3 4.5"/>'), sub: [
      { id: 'equipe', nome: 'Equipe', dica: 'Quem está online, conversa, recados, missões e ranking' },
      { id: 'rh', nome: 'RH', dica: 'Pedidos, aniversários, férias e clima', mod: ['VybePessoas', 'rh'] },
      { id: 'recrutamento', nome: 'Recrutamento', dica: 'Vagas e candidatos', mod: ['VybePessoas', 'recrutamento'] },
      { id: 'documentos', nome: 'Documentos', dica: 'Contratos e documentos do time', mod: ['VybePessoas', 'documentos'] },
      { id: 'academy', nome: 'Academy', dica: 'Trilhas de treinamento da Vybe', mod: ['VybePessoas', 'academy'] },
      { id: 'perfil', nome: 'Meu perfil', dica: 'Nível, VybeCoins, conquistas e números do trabalho' },
    ] },
    // Centro comercial (Paulo, 08/11/2026): o mapa deixou de ser a tela principal e virou este botão. O 3D só
    // carrega quando ele (ou o Prédio) é aberto; Hoje, Gestão e os módulos ocupam a tela sem nada atrás.
    { id: 'centro', nome: 'Centro', dica: 'Centro comercial: a Vybe no meio e os clientes ao redor, com o status de cada um', ic: svg('<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9h18"/><path d="M9 20v-6h6v6"/>') },
    // Agentes (Paulo, 08/11/2026): quem é quem, o que cada um faz, a rotina e as atribuições, em tela cheia.
    { id: 'agentes', nome: 'Agentes', dica: 'Agentes da Vybe: quem é quem, rotina e atribuições', ic: svg('<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/><path d="M3 13v2M21 13v2"/>') },
    { id: 'predio', nome: 'Prédio', dica: 'Prédio da Vybe: setores, agentes e as salas da equipe', ic: svg('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h6M9 11h6M9 15h6"/>') },
    { id: 'jogos', nome: 'Jogos', dica: 'Jogos com a equipe: sinuca, xadrez, pôquer, dominó, dama, velha e truco', ic: svg('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 14h.01"/>') },
    '-',
    { id: 'vybes', nome: 'VYBES', dica: 'Abrir o VYBES', ic: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>') },
  ];
  // O separador '-' é string, e String.prototype.sub existe: só objeto com lista de verdade tem submódulos.
  const SUBMODULOS = TRILHO.flatMap((t) => (t && typeof t === 'object' && Array.isArray(t.sub) ? t.sub : []).map((x) => ({ ...x, setor: t.id })));
  const setorDe = (id) => SUBMODULOS.find((x) => x.id === id)?.setor || id;
  const subVisivel = (x) => !x.mod || typeof window[x.mod[0]]?.abrir === 'function';
  function chamar(nome, ...a) { return typeof window[nome] === 'function' ? window[nome](...a) : undefined; }
  function marcarTrilho(id) { const alvo = setorDe(id); hud.querySelectorAll('[data-trilho]').forEach((b) => b.toggleAttribute('aria-current', b.dataset.trilho === alvo)); }
  // Lista de submódulos ao lado do setor (ou acima, no celular). Esc ou clique fora fecha.
  function fecharSetor() { hud.querySelector('.vv-setor')?.remove(); hud.querySelectorAll('[data-trilho][aria-expanded]').forEach((b) => b.setAttribute('aria-expanded', 'false')); }
  function abrirSetor(id, botao) {
    const aberto = hud.querySelector('.vv-setor');
    if (aberto?.dataset.setor === id) { fecharSetor(); return; }
    fecharSetor();
    const t = TRILHO.find((x) => x.id === id); if (!t) return;
    const itens = t.sub.filter(subVisivel);
    const el = document.createElement('div');
    el.className = 'vv-setor'; el.dataset.setor = id; el.setAttribute?.('role', 'menu'); el.setAttribute?.('aria-label', t.nome);
    el.innerHTML = `<div class="vv-setor-topo">${t.ic}<b>${esc(t.nome)}</b></div>` + itens.map((x) => `<button type="button" role="menuitem" data-submodulo="${esc(x.id)}"><b>${esc(x.nome)}</b><small>${esc(x.dica)}</small>${x.url ? '<i aria-hidden="true">↗</i>' : ''}</button>`).join('');
    hud.append(el);
    const r = botao?.getBoundingClientRect?.(), trilho = hud.querySelector('.vv-trilho')?.getBoundingClientRect?.();
    if (r && trilho) {
      if (trilho.height < 90) { el.style.left = Math.max(8, Math.min(innerWidth - 300, r.left)) + 'px'; el.style.bottom = (innerHeight - trilho.top + 8) + 'px'; }
      else { el.style.left = (trilho.right + 8) + 'px'; el.style.top = Math.max(8, Math.min(innerHeight - el.offsetHeight - 8, r.top - 6)) + 'px'; }
    }
    botao?.setAttribute?.('aria-expanded', 'true');
    el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-submodulo]'); if (!b) return; fecharSetor(); usarTrilho(b.dataset.submodulo); });
  }
  if (typeof document !== 'undefined') {
    document.addEventListener?.('click', (ev) => { if (hud.querySelector('.vv-setor') && !ev.target.closest?.('.vv-setor,[data-trilho^="setor:"]')) fecharSetor(); }, true);
    document.addEventListener?.('keydown', (ev) => { if (ev.key === 'Escape' && hud.querySelector('.vv-setor')) { fecharSetor(); ev.stopPropagation(); } }, true);
  }
  function usarTrilho(id, botao) {
    if (String(id).startsWith('setor:')) { abrirSetor(id, botao || hud.querySelector(`[data-trilho="${id}"]`)); return; }
    window.VybeTutorial?.dica?.('trilho:' + id);
    // Centro e Prédio abrem o 3D; qualquer outro módulo fecha o Centro e ocupa a tela (o mapa para e some).
    if (id === 'centro' || id === 'predio') {
      if (!gestao.hidden) fecharGestao();
      if (body.classList.contains('mundo-modulo')) { chamar('voltarAoMenu'); setTimeout(() => usarTrilho(id), 350); return; }
      abrirCentro(id === 'predio' ? 'predio' : 'cidade'); return;
    }
    if (centroAberto && id !== 'criar' && id !== 'vybes') fecharCentro();
    if (id === 'agentes') { if (!gestao.hidden) fecharGestao(); marcarTrilho('agentes'); window.VybeAgentes?.abrir?.(); return; }
    if (id !== 'criar' && id !== 'vybes') window.VybeAgentes?.fechar?.();
    // Submódulo de um módulo novo (Carteira, Conteúdo, Comercial, Pessoas) ou link externo.
    const sub = SUBMODULOS.find((x) => x.id === id);
    if (sub?.url) { window.open(sub.url, '_blank', 'noopener'); return; }
    if (sub?.mod) { if (!gestao.hidden) fecharGestao(); marcarTrilho(id); window[sub.mod[0]]?.abrir?.(sub.mod[1]); return; }
    if (id === 'gestao') { abrirGestao(); return; }
    if (!gestao.hidden) fecharGestao();
    const eu = typeof operadorDoTopo === 'function' ? operadorDoTopo() : null;
    const noModulo = body.classList.contains('mundo-modulo');
    if (noModulo && ['hoje', 'predio', 'equipe', 'modulos', 'jogos'].includes(id)) { chamar('voltarAoMenu'); setTimeout(() => usarTrilho(id), 350); return; }
    if (id === 'hoje') { body.classList.remove('mundo-cartoes'); marcarTrilho('hoje'); pintarHoje(); ajustarAreaLivre(); return; }
    if (id === 'modulos') { const abrir = !body.classList.contains('mundo-cartoes'); body.classList.toggle('mundo-cartoes', abrir); marcarTrilho(abrir ? 'modulos' : 'hoje'); ajustarAreaLivre(); return; }
    if (id === 'equipe') { marcarTrilho('equipe'); mostrarEquipe(); return; }
    if (id === 'jogos') { marcarTrilho('jogos'); mostrarJogos(); return; }
    if (id === 'perfil') { abrirPerfil(); return; }
    if (id === 'tarefas') { if (eu) chamar('chooseFocusUser', String(eu.id)); else chamar('openFocusPicker'); return; }
    ({ criar: () => chamar('openCadastrosStation'), gestor: () => chamar('chooseManagerMode'), direcao: () => chamar('chooseDaControllerMode'),
      agenda: () => abrirAgenda(), clientes: () => chamar('chooseClientMode'), vybes: () => chamar('chooseVybesMode') })[id]?.();
  }

  // ---------- Painel "Hoje": o dia da pessoa, com o VYBES dizendo por onde começar ----------
  // Mesma fila do topo (operadorDoTopo + focusOwnItems + focusReferenceDate): o número aqui
  // é o mesmo da barra e do Modo Foco.
  // "Ver como" (Paulo, 06/11/2026): quem administra vê o painel Hoje de qualquer pessoa da equipe.
  let verComo = '';
  function minhaFila() {
    const time = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
    const user = (verComo && time.find((u) => String(u.id) === verComo)) || (typeof operadorDoTopo === 'function' ? operadorDoTopo() : null);
    if (!user || typeof focusOwnItems !== 'function') return null;
    let itens = []; try { itens = focusOwnItems(user) || []; } catch { return null; }
    const ref = (d) => (typeof focusReferenceDate === 'function' ? focusReferenceDate(d, user) : (d.veiculacao_iso || d.prazo_iso || ''));
    return { user, itens: itens.map((d) => ({ d, ref: ref(d), sit: situacaoDaPeca(d) })).sort((a, b) => (a.ref || '9').localeCompare(b.ref || '9')) };
  }
  const somar = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const COR_SIT = (k) => `var(--sit-${k})`;
  // Linha de demanda, a mesma em todo o mundo (Hoje, agentes, clientes): barra e selo na cor do
  // status (status_color do quadro, a regra de sempre), cliente na cor da carteira do head
  // (tagClienteHtml), data em vermelho só se atrasou e o olhinho da prévia quando já há material.
  const semGrito = (t) => { const s = String(t || '').trim(); const letras = s.replace(/[^A-Za-zÀ-ÿ]/g, ''); return letras && letras === letras.toUpperCase() && letras.length > 4 ? s.charAt(0) + s.slice(1).toLowerCase() : s; };
  // Regra de cor dos status (Paulo, 08/11/2026: "para aprovação tá roxo"): a cor do quadro (status_color) e, sem ela,
  // as cores exatas do Monday que o painel já usa (vybe-relatorios.js, STATUS_CORES). A escala de situação é o último recurso.
  const STATUS_CORES = { 'em andamento': '#fdab3d', 'falta d.a': '#4eccc6', 'alteracao': '#df2f4a', 'finalizado': '#9cd326', 'aguardo': '#9d50dd',
    'a fazer': '#c4c4c4', 'para agendar': '#037f4c', 'para aprovacao': '#579bfc', 'em aprovacao': '#579bfc', 'aguardando aprovacao': '#579bfc', 'cap. agendada': '#ff007f',
    'ag. aprovacao cliente': '#faa1f1', 'ag. info cliente': '#bca58a', 'falta info': '#ff6d3b', 'agendando cap': '#ff5ac4', 'agendando cap.': '#ff5ac4',
    'segurar post': '#7f5347', 'agendado': '#a1e3f6', 'pode fazer': '#ffcb00', 'ag. interno': '#bca58a', 'revisao': '#fdab3d', 'aprovado': '#9cd326',
    'falta briefing': '#ff6d3b', 'nova demanda': '#579bfc', 'em execucao': '#ff6b00', 'feito': '#00c875', 'aguardando info.': '#9d50dd' };
  const chaveStatus = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const corStatus = (d, sit) => String(d?.status_color || '').match(/^#[0-9a-f]{3,8}$/i)?.[0] || STATUS_CORES[chaveStatus(d?.status)] || COR_SIT(sit || 'fazer');
  function linhaDemanda(d, { ref = '', sit = '', aviso = '' } = {}) {
    if (!d) return '';
    sit = sit || situacaoDaPeca(d); ref = ref || d.veiculacao_iso || d.prazo_iso || '';
    const hoje = hojeIso(), cor = corStatus(d, sit);
    const cli = (typeof clientesDoItem === 'function' ? clientesDoItem(d)[0] : d.cliente) || '';
    const tagCli = cli ? (typeof tagClienteHtml === 'function' ? tagClienteHtml(cli, { dentroDeBotao: true }) : `<span class="cliente-carteira">${esc(cli)}</span>`) : '';
    const quando = ref === hoje ? 'Hoje' : ref ? ref.slice(8) + '/' + ref.slice(5, 7) : '';
    const olho = typeof botaoDePreviaNaLinha === 'function' ? botaoDePreviaNaLinha(d, 'linha-previa vv-olho') : '';
    return `<div class="vv-demanda${sit === 'atrasada' ? ' atrasada' : ''}" style="--st:${esc(cor)}">
      <button type="button" class="vv-demanda-abrir" data-hoje-acao="peca" data-valor="${esc(d.id)}" title="${esc(String(d.nome || '') + (cli ? ' · ' + cli : '') + (d.status ? ' · ' + d.status : ''))}">
        <b>${esc(semGrito(d.nome || d.titulo || 'Peça'))}</b>
        <span class="vv-demanda-meta">${tagCli}${d.status ? `<span class="vv-demanda-status"><i></i>${esc(d.status)}</span>` : ''}${aviso ? `<span class="vv-demanda-aviso">${esc(aviso)}</span>` : ''}</span>
      </button>
      <span class="vv-demanda-lado">${olho}${quando ? `<time${sit === 'atrasada' ? ' class="atrasada"' : ''}>${esc(quando)}</time>` : ''}</span>
    </div>`;
  }
  // ---------- Visão do dono (Paulo, Vinícius, Ewerton e Deivid) ----------
  // Paulo, 07/11/2026: quando os sócios abrem o sistema, a primeira coisa é a agência (produção do dia,
  // semana, clientes com problema, gargalos, o que cobrar de cada um e dos bots), não a fila pessoal.
  // "Minhas tarefas" continua a um toque. Os números vêm de VybeDono.calcular (vybe-dono-metricas.js).
  const DONOS = ['paulo', 'vinicius', 'ewerton', 'deivid'];
  const primeiroNome = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().split(/\s+/)[0];
  function souDono() {
    const u = typeof operadorDoTopo === 'function' ? operadorDoTopo() : null;
    return Boolean(u && DONOS.includes(primeiroNome(u.name || u.nome)));
  }
  let visaoHoje = (() => { try { return localStorage.getItem('vybe.mundo.visaoHoje') || 'agencia'; } catch { return 'agencia'; } })();
  function trocarVisaoHoje(v) { visaoHoje = v; try { localStorage.setItem('vybe.mundo.visaoHoje', v); } catch {} pintarHoje(); }
  let cacheDono = { chave: '', valor: null };
  const semanaAgencia = { campo: 'veiculacao', referencia: '' };
  function numerosDoDono() {
    const D = typeof window !== 'undefined' ? window.VybeDono : null;
    if (!D?.calcular || typeof DADOS_ALL === 'undefined' || !Array.isArray(DADOS_ALL) || !DADOS_ALL.length) return null;
    const clientes = typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : [];
    const chave = DADOS_ALL.length + ':' + clientes.length + ':' + Math.floor(Date.now() / 60000) + ':' + (DADOS_ALL[0]?.updated_at || '') + ':' + JSON.stringify(semanaAgencia);
    if (cacheDono.chave === chave) return cacheDono.valor;
    const time = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
    const pessoas = Object.fromEntries(time.map((u) => [String(u.id), u.name || u.nome || '']));
    let valor = null;
    try { valor = D.calcular({ demandas: DADOS_ALL, clientes, pessoas, hoje: new Date(), graficoSemana: semanaAgencia }); } catch (e) { console.error('[mundo] números do dono', e); }
    cacheDono = { chave, valor };
    return valor;
  }
  const n0 = (v) => Number(v || 0).toLocaleString('pt-BR');
  const SAUDE = { critico: ['Crítico', 'u1'], atencao: ['Atenção', 'u2'], ok: ['Em dia', 'u6'] };
  const dataCompleta = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : 'Não definido';
  function controlesSemana(g) {
    return `<div class="vv-semana-controles"><div class="vv-seg" role="group" aria-label="Data das peças previstas">${[['prazo', 'Prazo'], ['veiculacao', 'Veiculação']].map(([campo, nome]) => `<button type="button" data-semana-campo="${campo}" aria-pressed="${g.campo === campo}">${nome}</button>`).join('')}</div>
      <nav aria-label="Navegar pelas semanas"><button type="button" data-semana-passo="-1" aria-label="Semana anterior">‹</button><span>${esc(dataCompleta(g.inicio))} – ${esc(dataCompleta(g.fim))}</span><button type="button" data-semana-passo="1" aria-label="Próxima semana">›</button><button type="button" data-semana-passo="0">Atual</button></nav></div>`;
  }
  function selecionarSemana(b) {
    if (b.dataset.semanaCampo) {
      if (!['prazo', 'veiculacao'].includes(b.dataset.semanaCampo)) return false;
      semanaAgencia.campo = b.dataset.semanaCampo;
    } else if (b.dataset.semanaPasso !== undefined) {
      const passo = Number(b.dataset.semanaPasso); if (![-1, 0, 1].includes(passo)) return false;
      const inicio = window.VybeDono.util.inicioDaSemana(semanaAgencia.referencia || hojeIso());
      semanaAgencia.referencia = passo ? somar(inicio, passo * 7) : '';
    } else return false;
    cacheDono.chave = ''; pintarHoje(); pintarGestao(); return true;
  }
  function corDaPendencia(p) {
    const d = (typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : []).find((d) => String(d.id) === String(p?.id));
    return d ? corStatus(d, situacaoDaPeca(d)) : STATUS_CORES[chaveStatus(p?.status)] || '#9AA3A8';
  }
  function mostrarPendencias(cliente = '', status = '') {
    const N = numerosDoDono(); if (!N) return;
    const c = cliente ? N.clientes.find((c) => c.cliente === cliente) : null;
    const g = status ? N.gargalos.find((g) => g.status === status) : null;
    if (!c && !g) return;
    if (!gestao.hidden) fecharGestao();
    const lista = c ? c.pendencias : g.lista, titulo = c ? c.cliente : g.status;
    const motivos = c ? c.motivos : [`${g.qtd} peças neste status · ${g.idadeMedianaDias} dias paradas (mediana)`];
    const p = placa();
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button><h3>${esc(titulo)}</h3><p class="vv-sub">${c ? 'O que pede atenção' : 'Demandas neste gargalo'}</p>
      <ul class="vv-pendencia-motivos">${motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <div class="vv-pendencias-lista">${lista.length ? lista.map((d) => `<button type="button" class="vv-pendencia" style="--st:${esc(corDaPendencia(d))}" data-hoje-acao="peca" data-valor="${esc(d.id)}"><b>${esc(d.nome)}</b><span class="vv-pendencia-status">${esc(d.status || 'Sem status')}</span><small>${esc(d.cliente)}</small><dl><div><dt>Responsável</dt><dd>${esc(d.responsavel || 'Sem responsável')}</dd></div><div><dt>Prazo</dt><dd>${esc(dataCompleta(d.prazo_iso))}</dd></div><div><dt>Veiculação</dt><dd>${esc(dataCompleta(d.veiculacao_iso))}</dd></div></dl>${d.motivos?.length ? `<small>${esc(d.motivos.join(' · '))}</small>` : ''}<span class="vv-pendencia-abrir">Abrir demanda →</span></button>`).join('') : '<p class="vv-vazio">Os alertas acima não têm uma demanda específica vinculada. Confira a cobertura de conteúdo e o planejamento do cliente.</p>'}</div>
      ${c ? `<button type="button" class="vv-botao" data-abrir-cliente="${esc(c.cliente)}">Abrir o cliente →</button>` : ''}`;
    p.hidden = false; ajustarAreaLivre();
  }
  // Gráfico de barras da semana: previstas (cinza) e entregues (verde), um par por dia.
  function barrasSemana(porDia = [], { w = 300, h = 86 } = {}) {
    const max = Math.max(1, ...porDia.map((d) => Math.max(d.previstas || 0, d.entregues || 0)));
    const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'], hoje = hojeIso();
    const bw = w / Math.max(1, porDia.length);
    return `<svg class="vv-graf" viewBox="0 0 ${w} ${h + 16}" role="img" aria-label="Previstas e entregues por dia da semana">
      ${porDia.map((d, i) => { const x = i * bw, hp = (d.previstas || 0) / max * h, he = (d.entregues || 0) / max * h, eHoje = d.dia === hoje;
        return `<g><title>${esc(d.dia)}: ${d.previstas || 0} previstas, ${d.entregues || 0} entregues</title>
          <rect x="${x + bw * .14}" y="${h - hp}" width="${bw * .34}" height="${Math.max(hp, 1.5)}" rx="3" fill="#E1DACE"/>
          <rect x="${x + bw * .52}" y="${h - he}" width="${bw * .34}" height="${Math.max(he, 1.5)}" rx="3" fill="#18A957"/>
          <text x="${x + bw / 2}" y="${h + 13}" text-anchor="middle" class="${eHoje ? 'hoje' : ''}">${DIAS[i] || ''}</text></g>`; }).join('')}
    </svg>`;
  }
  // Linha de 12 semanas (entregues) com a mediana tracejada e, se houver, a projeção pontilhada.
  function linhaHistorico(semanas = [], { mediana = 0, projecao = [], w = 640, h = 150 } = {}) {
    const pts = semanas.map((s) => s.entregues || 0), proj = projecao.map((p) => p.previstas || 0);
    const total = pts.length + proj.length; if (!total) return '';
    const max = Math.max(1, mediana, ...pts, ...proj) * 1.15, px = (i) => 24 + i * ((w - 40) / Math.max(1, total - 1)), py = (v) => 8 + (h - 24) * (1 - v / max);
    const caminho = (arr, off = 0) => arr.map((v, i) => `${i ? 'L' : 'M'}${px(i + off).toFixed(1)},${py(v).toFixed(1)}`).join('');
    const area = pts.length ? `${caminho(pts)}L${px(pts.length - 1).toFixed(1)},${h - 16}L${px(0).toFixed(1)},${h - 16}Z` : '';
    return `<svg class="vv-graf linha" viewBox="0 0 ${w} ${h}" role="img" aria-label="Entregas por semana nas últimas ${pts.length} semanas">
      <defs><linearGradient id="vvg-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#FF7A2F" stop-opacity=".22"/><stop offset="1" stop-color="#FF7A2F" stop-opacity="0"/></linearGradient></defs>
      ${[0, .5, 1].map((f) => `<line x1="24" x2="${w - 16}" y1="${py(max / 1.15 * f)}" y2="${py(max / 1.15 * f)}" class="grade"/>`).join('')}
      ${mediana ? `<line x1="24" x2="${w - 16}" y1="${py(mediana)}" y2="${py(mediana)}" class="mediana"/><text x="${w - 18}" y="${py(mediana) - 4}" text-anchor="end" class="rot">mediana ${n0(mediana)}</text>` : ''}
      ${area ? `<path d="${area}" fill="url(#vvg-area)"/>` : ''}
      <path d="${caminho(pts)}" class="serie"/>
      ${proj.length ? `<path d="M${px(pts.length - 1).toFixed(1)},${py(pts[pts.length - 1] || 0).toFixed(1)}${proj.map((v, i) => `L${px(pts.length + i).toFixed(1)},${py(v).toFixed(1)}`).join('')}" class="proj"/>` : ''}
      ${pts.map((v, i) => `<circle cx="${px(i)}" cy="${py(v)}" r="${i === pts.length - 1 ? 4.5 : 3}" class="${i === pts.length - 1 ? 'atual' : 'pt'}"><title>${esc(semanas[i].inicio || '')}: ${v} entregues${semanas[i].noPrazo != null ? ', ' + semanas[i].noPrazo + ' no prazo' : ''}</title></circle>`).join('')}
      ${proj.map((v, i) => `<circle cx="${px(pts.length + i)}" cy="${py(v)}" r="3" class="ptproj"><title>${esc(projecao[i].inicio || '')}: ${v} previstas</title></circle>`).join('')}
      ${semanas.map((s, i) => i % 2 === 0 || i === pts.length - 1 ? `<text x="${px(i)}" y="${h - 2}" text-anchor="middle" class="eixo">${esc(String(s.inicio || '').slice(8, 10) + '/' + String(s.inicio || '').slice(5, 7))}</text>` : '').join('')}
    </svg>`;
  }
  const pecaCurta = (p) => `${esc(p.nome || 'Peça')}${p.cliente ? ' · ' + esc(p.cliente) : ''}`;
  function botsParaCobrar() {
    let f = null; try { f = fonteAgentes?.ler(); } catch { f = null; } if (!f?.dados?.agentes) return { sinal: false, lista: [] };
    const lista = f.dados.agentes.map((a) => ({ a, e: estadoDoAgente(a.setor) })).filter(({ e }) => ['falhou', 'aguardando_aprovacao'].includes(e.estado))
      .map(({ a, e }) => ({ nome: a.agente || a.setor, andar: a.andar, setor: a.setor, estado: e.estado, texto: e.estado === 'falhou' ? 'falhou na última execução' + (e.ultimos?.[0]?.erro ? ': ' + e.ultimos[0].erro : '') : 'esperando sua aprovação' + (e.tarefa ? ': ' + e.tarefa : '') }));
    return { sinal: !f.erro, lista };
  }
  function pintarAgencia(el, { data, saud, nome }) {
    const N = numerosDoDono();
    const seg = `<div class="vv-seg" role="tablist" aria-label="O que ver"><button type="button" role="tab" aria-selected="true" data-visao-hoje="agencia">Agência</button><button type="button" role="tab" aria-selected="false" data-visao-hoje="tarefas">Minhas tarefas</button></div>`;
    if (!N) {
      el.innerHTML = `${seg}<small class="vv-data">${esc(data)}</small><h2>${saud}${nome ? ', <em>' + esc(nome) + '</em>' : ''}</h2><p class="vv-vazio">Juntando os números da agência…</p>`;
      return;
    }
    const H = N.hoje || {}, S = N.semana || {}, C = N.cobertura || {}, prevHoje = H.previstas || 0, feitasHoje = H.feitas || 0;
    const largo = !centroAberto; // em tela cheia mostra mais de cada lista
    const clientesRuins = (N.clientes || []).filter((c) => c.saude !== 'ok').slice(0, 4);
    const gargalos = (N.gargalos || []).slice(0, 3), time = (N.time || []).filter((t) => (t.cobrar || []).length).slice(0, 3), bots = botsParaCobrar();
    const sem3 = C.sem3 || [], ativos = C.clientesAtivos || 0;
    const frase = (H.atrasadas || 0) || (H.emRisco || 0)
      ? `Hoje: <b>${n0(H.atrasadas)} atrasada${H.atrasadas === 1 ? '' : 's'}</b> e <b>${n0(H.emRisco)} com risco de furo</b>.${clientesRuins[0] ? ` O cliente mais apertado é <b>${esc(clientesRuins[0].cliente)}</b>.` : ''}`
      : `Produção em dia. ${sem3.length ? `<b>${sem3.length} cliente${sem3.length > 1 ? 's' : ''}</b> ainda sem 3 posts na semana.` : 'Todos os clientes com 3 posts na semana.'}`;
    el.innerHTML = `${seg}<div class="vv-hoje-topo"><span><small class="vv-data">${esc(data)}</small><h2>${saud}${nome ? ', <em>' + esc(nome) + '</em>' : ''}</h2></span>
        <span class="vv-anel" style="--p:${prevHoje ? Math.round(feitasHoje / prevHoje * 100) : 100}" title="Produção de hoje: feitas de previstas"><b>${n0(feitasHoje)}</b><small>/${n0(prevHoje)}</small></span></div>
      <button type="button" class="vv-fala" data-abrir-gestao><span class="vv-ser" aria-hidden="true"><i></i></span><span>${frase}</span><b aria-hidden="true">→</b></button>
      <div class="vv-dono-kpis">
        <button type="button" class="u1" data-abrir-gestao="hoje"><b>${n0(H.atrasadas)}</b><small>atrasadas</small></button>
        <button type="button" class="u2" data-abrir-gestao="hoje"><b>${n0(H.emRisco)}</b><small>risco de furo</small></button>
        <button type="button" data-abrir-gestao="hoje"><b>${n0(H.faltam)}</b><small>faltam hoje</small></button>
        <button type="button" class="u6" data-abrir-gestao="semana"><b>${n0(S.entregues)}<i>/${n0(S.previstas)}</i></b><small>na semana</small></button>
      </div>
      <div class="vv-blocos"><section class="vv-bloco">
      <div class="vv-rotulo-secao" style="--c:#18A957"><i></i>Semana da agência</div>
      <div class="vv-dono-cartao">${controlesSemana(N.graficoSemana)}${barrasSemana(N.graficoSemana.porDia)}<p class="vv-legenda"><i class="pv"></i>previstas por ${semanaAgencia.campo === 'prazo' ? 'prazo' : 'veiculação'} <i class="en"></i>entregues no dia</p></div>
      </section><section class="vv-bloco">
      <div class="vv-rotulo-secao" style="--c:#D93D42"><i></i>Clientes que pedem atenção<span class="vv-pilula">${(N.clientes || []).filter((c) => c.saude !== 'ok').length}</span></div>
      ${clientesRuins.length ? clientesRuins.map((c) => `<button type="button" class="vv-dono-linha" data-atencao-cliente="${esc(c.cliente)}"><span class="saude ${SAUDE[c.saude]?.[1] || ''}"></span><span class="meio"><b>${esc(c.cliente)}</b><small>${esc((c.motivos || []).slice(0, 2).join(' · ') || '—')}</small></span><em class="${c.semana >= 3 ? 'ok' : ''}">${n0(c.semana)}/3</em></button>`).join('') : '<p class="vv-vazio">Nenhum cliente em atenção agora.</p>'}
      </section><section class="vv-bloco">
      <div class="vv-rotulo-secao" style="--c:#0D74CE"><i></i>3 posts por semana</div>
      <div class="vv-dono-cartao vv-cobertura"><div class="barra"><i style="width:${ativos ? Math.round((ativos - sem3.length) / ativos * 100) : 0}%"></i></div>
        <p><b>${n0(ativos - sem3.length)} de ${n0(ativos)}</b> clientes com 3 ou mais na semana${(C.semConteudo || []).length ? ` · <b class="t-u1">${C.semConteudo.length} sem nenhum</b>` : ''}${(C.semPlanejamento || []).length ? ` · ${C.semPlanejamento.length} sem planejamento` : ''}</p>
        ${sem3.length ? `<div class="vv-chips-mini">${sem3.slice(0, 6).map((x) => `<span>${esc(x.cliente)} <b>${x.qtd}</b></span>`).join('')}${sem3.length > 6 ? `<span>+${sem3.length - 6}</span>` : ''}</div>` : ''}</div>
      ${gargalos.length ? `</section><section class="vv-bloco"><div class="vv-rotulo-secao" style="--c:#E2A11B"><i></i>Gargalos agora</div>
      ${gargalos.map((g) => `<button type="button" class="vv-dono-linha" data-gargalo="${esc(g.status)}"><span class="saude" style="background:${esc(corDaPendencia(g.lista[0]))}"></span><span class="meio"><b>${esc(g.status)}</b><small>${n0(g.qtd)} peças · paradas há ${n0(g.idadeMedianaDias)} dias (mediana)</small></span></button>`).join('')}` : ''}
      </section><section class="vv-bloco">
      <div class="vv-rotulo-secao" style="--c:#8E4EC6"><i></i>O que cobrar hoje</div>
      ${time.map((t) => `<div class="vv-dono-linha estatica"><span class="av">${esc(String(t.pessoa || '?').slice(0, 2).toUpperCase())}</span><span class="meio"><b>${esc(t.pessoa)}</b><small>${esc(t.cobrar[0])}</small></span></div>`).join('')}
      ${bots.lista.slice(0, 3).map((b) => `<button type="button" class="vv-dono-linha" data-agente="${esc(b.andar)}|${esc(b.setor)}"><span class="av bot">AI</span><span class="meio"><b>${esc(b.nome)}</b><small>${esc(b.texto)}</small></span></button>`).join('')}
      ${!time.length && !bots.lista.length ? '<p class="vv-vazio">Nada para cobrar agora.</p>' : ''}
      ${!bots.sinal ? '<p class="vv-dica">Bots: sem sinal da central agora.</p>' : ''}
      </section></div>
      <button type="button" class="vv-botao acao vv-dono-abrir" data-abrir-gestao>Abrir a Gestão completa →</button>
      <div class="vv-chips"><button type="button" data-visao-hoje="tarefas">Minhas tarefas</button><button type="button" data-hoje-acao="demandas">Todas as demandas</button><button type="button" data-hoje-acao="agenda">Agenda</button></div>`;
  }

  // ---------- Módulo Gestão: passado, agora e futuro da agência ----------
  const gestao = document.createElement('section');
  gestao.className = 'vv-gestao'; gestao.hidden = true; gestao.setAttribute?.('aria-label', 'Gestão da Vybe');
  document.body.append?.(gestao);
  let gestaoAba = 'agora';
  function abrirGestao(aba) {
    if (aba && ['agora', 'semana', 'clientes', 'time', 'historico'].includes(aba)) gestaoAba = aba;
    if (body.classList.contains('mundo-modulo')) chamar('voltarAoMenu');
    gestao.hidden = false; body.classList.add('mundo-gestao'); marcarTrilho('gestao'); pintarGestao(); gestao.scrollTop = 0; window.VybeTutorial?.dica?.('trilho:gestao');
  }
  function fecharGestao() { gestao.hidden = true; body.classList.remove('mundo-gestao', 'mundo-tela-cheia'); marcarTrilho('hoje'); }
  const kpi = (v, r, cls = '', sub = '') => `<div class="vv-g-kpi ${cls}"><b>${v}</b><small>${r}</small>${sub ? `<em>${sub}</em>` : ''}</div>`;
  function pintarGestao() {
    if (gestao.hidden) return;
    const N = numerosDoDono();
    const abas = [['agora', 'Agora'], ['semana', 'Semana'], ['clientes', 'Clientes'], ['time', 'Time e bots'], ['historico', 'Histórico e projeção']];
    const topo = `<div class="vv-g-topo"><span><small class="vv-cb-kicker">Gestão da Vybe</small><h2>${gestaoAba === 'historico' ? 'Passado e futuro' : gestaoAba === 'clientes' ? 'Clientes' : gestaoAba === 'time' ? 'Time e bots' : gestaoAba === 'semana' ? 'Semana da agência' : 'Agora na agência'}</h2>
        <p>${N ? 'Atualizado às ' + new Date(N.geradoEm || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' · ' + n0((N.cobertura || {}).clientesAtivos) + ' clientes ativos' : 'Juntando os números…'}</p></span>
      <span class="vv-g-acoes"><button type="button" class="vv-botao" data-gestao-cheia title="Tela cheia">⛶</button><button type="button" class="vv-botao" data-gestao-fechar aria-label="Fechar">✕</button></span></div>
      <nav class="vv-seg vv-g-abas" role="tablist">${abas.map(([id, n]) => `<button type="button" role="tab" aria-selected="${id === gestaoAba}" data-gestao-aba="${id}">${n}</button>`).join('')}</nav>`;
    if (!N) { gestao.innerHTML = topo + '<p class="vv-vazio">Os números aparecem quando a produção terminar de carregar.</p>'; return; }
    const H = N.hoje || {}, S = N.semana || {}, C = N.cobertura || {}, Hi = N.historico || {}, P = N.projecao || {};
    const ultima = (Hi.semanas || []).slice(-1)[0] || {};
    let corpo = '';
    if (gestaoAba === 'agora') {
      corpo = `<div class="vv-g-kpis">
          ${kpi(`${n0(H.feitas)}<i>/${n0(H.previstas)}</i>`, 'produção de hoje', H.previstas && H.feitas < H.previstas ? 'u2' : 'u6')}
          ${kpi(n0(H.atrasadas), 'atrasadas', H.atrasadas ? 'u1' : '')}
          ${kpi(n0(H.emRisco), 'risco de furo (2 dias)', H.emRisco ? 'u2' : '')}
          ${kpi(n0(H.faltam), 'ainda não feitas hoje')}
          ${kpi(`${n0(S.entregues)}<i>/${n0(S.previstas)}</i>`, 'entregues na semana', '', Hi.medianaEntregues ? 'mediana ' + n0(Hi.medianaEntregues) + '/semana' : '')}
          ${kpi(`${n0((C.sem3 || []).length)}`, 'clientes sem 3 posts', (C.sem3 || []).length ? 'u2' : 'u6')}
        </div>
        <div class="vv-g-grade">
          <section class="vv-g-cartao"><h4>Risco de furo <span class="u2">${n0(H.emRisco)}</span></h4>${listaPecas((H.lista || {}).emRisco, 'Nada com risco de furo.')}</section>
          <section class="vv-g-cartao"><h4>Atrasadas <span class="u1">${n0(H.atrasadas)}</span></h4>${listaPecas((H.lista || {}).atrasadas, 'Nada atrasado.')}</section>
          <section class="vv-g-cartao"><h4>Ainda não feitas hoje <span>${n0(H.faltam)}</span></h4>${listaPecas((H.lista || {}).faltam, 'Tudo de hoje feito.')}</section>
          <section class="vv-g-cartao"><h4>Gargalos</h4>${barrasGargalo(N.gargalos || [])}</section>
          <section class="vv-g-cartao largo"><h4>Alertas</h4>${(N.alertas || []).slice(0, 10).map((a) => `<div class="vv-g-alerta n${a.nivel}"><i></i>${esc(a.texto)}</div>`).join('') || '<p class="vv-vazio">Sem alertas.</p>'}</section>
        </div>`;
    } else if (gestaoAba === 'semana') {
      corpo = `<div class="vv-g-kpis">${kpi(`${n0(S.entregues)}<i>/${n0(S.previstas)}</i>`, 'entregues / previstas')}${kpi(n0(C.clientesAtivos - (C.sem3 || []).length) + '<i>/' + n0(C.clientesAtivos) + '</i>', 'clientes com 3+ posts', (C.sem3 || []).length ? 'u2' : 'u6')}${kpi(n0((C.semConteudo || []).length), 'clientes sem nenhum conteúdo', (C.semConteudo || []).length ? 'u1' : '')}${kpi(n0((C.semPlanejamento || []).length), 'clientes sem planejamento', (C.semPlanejamento || []).length ? 'u2' : '')}${kpi(n0((C.proximaSemanaSem3 || []).length), 'sem 3 posts na próxima semana', (C.proximaSemanaSem3 || []).length ? 'u2' : '')}</div>
        <div class="vv-g-grade">
          <section class="vv-g-cartao largo"><h4>Dia a dia da semana</h4>${controlesSemana(N.graficoSemana)}${barrasSemana(N.graficoSemana.porDia, { w: Math.max(640, Math.round((gestao.clientWidth || 900) - 80)), h: 150 })}<p class="vv-legenda"><i class="pv"></i>previstas por ${semanaAgencia.campo === 'prazo' ? 'prazo' : 'veiculação'} <i class="en"></i>entregues no dia</p></section>
          <section class="vv-g-cartao"><h4>Sem 3 posts nesta semana <span class="u2">${n0((C.sem3 || []).length)}</span></h4>${(C.sem3 || []).map((x) => `<div class="vv-g-linha"><b>${esc(x.cliente)}</b><span class="pill ${x.qtd ? 'u2' : 'u1'}">${x.qtd}/3</span></div>`).join('') || '<p class="vv-vazio">Todos com 3 ou mais.</p>'}</section>
          <section class="vv-g-cartao"><h4>Próxima semana sem 3 <span class="u2">${n0((C.proximaSemanaSem3 || []).length)}</span></h4>${(C.proximaSemanaSem3 || []).map((x) => `<div class="vv-g-linha"><b>${esc(x.cliente)}</b><span class="pill ${x.qtd ? 'u2' : 'u1'}">${x.qtd}/3</span></div>`).join('') || '<p class="vv-vazio">Próxima semana coberta.</p>'}</section>
          <section class="vv-g-cartao"><h4>Sem planejamento <span>${n0((C.semPlanejamento || []).length)}</span></h4>${(C.semPlanejamento || []).map((c) => `<div class="vv-g-linha"><b>${esc(typeof c === 'string' ? c : c.cliente)}</b></div>`).join('') || '<p class="vv-vazio">Todos com planejamento.</p>'}<p class="vv-dica">${esc((N.fonte || {}).planejamento || '')}</p></section>
        </div>`;
    } else if (gestaoAba === 'clientes') {
      corpo = `<section class="vv-g-cartao largo"><table class="vv-g-tabela"><thead><tr><th>Cliente</th><th>Saúde</th><th class="n">Abertas</th><th class="n">Atrasadas</th><th class="n">Risco</th><th class="n">Semana</th><th class="n">Próx.</th><th>Planej.</th><th>Por quê</th></tr></thead><tbody>
        ${(N.clientes || []).map((c) => `<tr data-cerebro-cliente="${esc(c.cliente)}"><td><b>${esc(c.cliente)}</b></td><td><span class="pill ${SAUDE[c.saude]?.[1] || ''}">${SAUDE[c.saude]?.[0] || c.saude}</span></td><td class="n">${n0(c.abertas)}</td><td class="n ${c.atrasadas ? 't-u1' : ''}">${n0(c.atrasadas)}</td><td class="n ${c.emRisco ? 't-u2' : ''}">${n0(c.emRisco)}</td><td class="n ${c.semana < 3 ? 't-u2' : ''}">${n0(c.semana)}/3</td><td class="n">${n0(c.proximaSemana)}</td><td>${c.temPlanejamento ? '<span class="ok">✓</span>' : '<span class="nao">—</span>'}</td><td class="mot">${esc((c.motivos || []).join(' · '))}</td></tr>`).join('')}
        </tbody></table></section>`;
    } else if (gestaoAba === 'time') {
      const bots = botsParaCobrar(); let f = null; try { f = fonteAgentes?.ler(); } catch {} const ags = f?.dados?.agentes || [];
      corpo = `<div class="vv-g-grade">
        <section class="vv-g-cartao largo"><h4>Time</h4><table class="vv-g-tabela"><thead><tr><th>Pessoa</th><th class="n">Abertas</th><th class="n">Atrasadas</th><th class="n">Risco</th><th class="n">Entregues 7d</th><th class="n">Parado (med.)</th><th>O que cobrar</th></tr></thead><tbody>
          ${(N.time || []).map((t) => `<tr><td><b>${esc(t.pessoa)}</b></td><td class="n">${n0(t.abertas)}</td><td class="n ${t.atrasadas ? 't-u1' : ''}">${n0(t.atrasadas)}</td><td class="n ${t.emRisco ? 't-u2' : ''}">${n0(t.emRisco)}</td><td class="n">${n0(t.entregues7d)}</td><td class="n">${n0(t.idadeMedianaDias)} d</td><td class="mot">${esc((t.cobrar || []).join(' · ') || '—')}</td></tr>`).join('')}
        </tbody></table></section>
        <section class="vv-g-cartao largo"><h4>Bots (agentes do prédio)</h4>${ags.length ? `<table class="vv-g-tabela"><thead><tr><th>Agente</th><th>Estado</th><th class="n">Em curso</th><th class="n">Últimas</th><th class="n">Falhas</th><th>O que cobrar</th></tr></thead><tbody>
          ${ags.map((a) => { const e = estadoDoAgente(a.setor), u = e.ultimos || [], fl = u.filter((x) => x.estado === 'falhou').length; const b = bots.lista.find((x) => x.setor === a.setor);
            return `<tr data-agente="${esc(a.andar)}|${esc(a.setor)}"><td><b>${esc(a.agente || a.setor)}</b><small>${esc(a.nome || '')}</small></td><td><span class="pill" style="--e:${e.cor}">${esc(e.rotulo)}</span></td><td class="n">${n0(a.emCurso)}</td><td class="n">${n0(u.length)}</td><td class="n ${fl ? 't-u1' : ''}">${n0(fl)}</td><td class="mot">${esc(b?.texto || '—')}</td></tr>`; }).join('')}
          </tbody></table>` : `<p class="vv-vazio">${esc(avisoDosAgentes())}.</p>`}</section></div>`;
    } else {
      const proj = P.proximaSemana || {};
      corpo = `<div class="vv-g-kpis">${kpi(n0(ultima.entregues), 'entregues nesta semana', '', 'mediana ' + n0(Hi.medianaEntregues))}${kpi((Hi.mediaNoPrazoPct != null ? Math.round(Hi.mediaNoPrazoPct) : '—') + '<i>%</i>', 'no prazo (12 semanas)', Hi.mediaNoPrazoPct != null && Hi.mediaNoPrazoPct < 80 ? 'u2' : 'u6')}${kpi({ subindo: '↗ subindo', estavel: '→ estável', caindo: '↘ caindo' }[Hi.tendencia] || '—', 'tendência', Hi.tendencia === 'caindo' ? 'u1' : Hi.tendencia === 'subindo' ? 'u6' : '')}${kpi(`${n0(proj.previstas)}<i>/${n0(proj.capacidadeMediana)}</i>`, 'próxima semana: previstas / capacidade', proj.risco === 'alto' ? 'u1' : proj.risco === 'medio' ? 'u2' : 'u6', proj.folga != null ? (proj.folga >= 0 ? 'folga de ' + n0(proj.folga) : 'faltam ' + n0(-proj.folga)) : '')}</div>
        <div class="vv-g-grade">
          <section class="vv-g-cartao largo"><h4>Entregas por semana · últimas ${n0((Hi.semanas || []).length)} e as próximas 4 previstas</h4>${linhaHistorico(Hi.semanas || [], { mediana: Hi.medianaEntregues, projecao: P.proximas4 || [] })}<p class="vv-legenda"><i class="en2"></i>entregues <i class="md"></i>mediana <i class="pj"></i>previstas (futuro)</p></section>
          <section class="vv-g-cartao largo"><h4>Semana a semana</h4><table class="vv-g-tabela"><thead><tr><th>Semana</th><th class="n">Previstas</th><th class="n">Entregues</th><th class="n">No prazo</th><th class="n">Entregues atrasadas</th></tr></thead><tbody>
            ${(Hi.semanas || []).slice().reverse().map((s) => `<tr><td>${esc(String(s.inicio || '').slice(8, 10) + '/' + String(s.inicio || '').slice(5, 7))}</td><td class="n">${n0(s.previstas)}</td><td class="n">${n0(s.entregues)}</td><td class="n">${n0(s.noPrazo)}</td><td class="n ${s.atrasadasEntregues ? 't-u2' : ''}">${n0(s.atrasadasEntregues)}</td></tr>`).join('')}
          </tbody></table></section></div>`;
    }
    gestao.innerHTML = topo + `<div class="vv-g-corpo">${corpo}</div>`;
  }
  function listaPecas(lista = [], vazio = '') {
    if (!lista?.length) return `<p class="vv-vazio">${vazio}</p>`;
    return lista.slice(0, 8).map((p) => `<button type="button" class="vv-g-linha peca" data-hoje-acao="peca" data-valor="${esc(p.id)}"><b>${esc(p.nome || 'Peça')}</b><small>${esc([p.cliente, p.status, p.responsavel].filter(Boolean).join(' · '))}</small><em>${esc(String(p.veiculacao_iso || p.prazo_iso || '').slice(8, 10) + '/' + String(p.veiculacao_iso || p.prazo_iso || '').slice(5, 7))}</em></button>`).join('') + (lista.length > 8 ? `<p class="vv-dica">+ ${lista.length - 8}</p>` : '');
  }
  function barrasGargalo(g = []) {
    if (!g.length) return '<p class="vv-vazio">Sem gargalo agora.</p>';
    const max = Math.max(1, ...g.map((x) => x.qtd || 0));
    return g.slice(0, 7).map((x) => `<button type="button" class="vv-g-gargalo" data-gargalo="${esc(x.status)}" style="--st:${esc(corDaPendencia(x.lista[0]))}"><span><b>${esc(x.status)}</b><small>${n0(x.qtd)} · ${n0(x.idadeMedianaDias)} d parado</small></span><i><u style="width:${Math.round((x.qtd || 0) / max * 100)}%"></u></i></button>`).join('');
  }
  gestao.addEventListener?.('click', (ev) => {
    const b = ev.target.closest('button, tr[data-cerebro-cliente], tr[data-agente]'); if (!b) return;
    if (selecionarSemana(b)) return;
    if (b.dataset.gargalo) { mostrarPendencias('', b.dataset.gargalo); return; }
    if (b.dataset.gestaoFechar !== undefined) { fecharGestao(); return; }
    if (b.dataset.gestaoCheia !== undefined) { body.classList.toggle('mundo-tela-cheia'); return; }
    if (b.dataset.gestaoAba) { gestaoAba = b.dataset.gestaoAba; pintarGestao(); gestao.scrollTop = 0; return; }
    if (b.dataset.hojeAcao === 'peca') { chamar('openItemWorkspace', String(b.dataset.valor)); return; }
    if (b.dataset.cerebroCliente) { fecharGestao(); chamar('chooseClientMode'); setTimeout(() => { chamar('abrirModalCerebroCliente', b.dataset.cerebroCliente); window.VybeTutorial?.dica?.('cerebro-cliente'); }, 450); return; }
    if (b.dataset.agente) { fecharGestao(); const [an, se] = b.dataset.agente.split('|'); window.vybesAbrirAgente?.(an, se); }
  });
  if (typeof setInterval === 'function') setInterval(() => { if (!gestao.hidden) pintarGestao(); }, 60000);

  let diaEscolhido = '';
  function pintarHoje() {
    const el = hud.querySelector('#vv-hoje'); if (!el || body.classList.contains('mundo-cartoes')) return;
    const fila = minhaFila(), hoje = hojeIso(), agora = new Date();
    const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const h = agora.getHours(), saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const nome = String(fila?.user?.name || fila?.user?.nome || (typeof operadorDoTopo === 'function' ? (operadorDoTopo()?.name || operadorDoTopo()?.nome) : '') || '').split(' ')[0];
    const dono = souDono(); body.classList.toggle('eh-dono', dono);
    if (dono && !verComo && visaoHoje === 'agencia') { pintarAgencia(el, { data, saud, nome }); return; }
    const segDono = dono && !verComo ? `<div class="vv-seg" role="tablist" aria-label="O que ver"><button type="button" role="tab" aria-selected="false" data-visao-hoje="agencia">Agência</button><button type="button" role="tab" aria-selected="true" data-visao-hoje="tarefas">Minhas tarefas</button></div>` : '';
    if (!fila) {
      const carregou = typeof DADOS_ALL !== 'undefined' && DADOS_ALL?.length;
      el.innerHTML = `<small class="vv-data">${esc(data)}</small><h2>${saud}${nome ? ', <em>' + esc(nome) + '</em>' : ''}</h2>
        <button type="button" class="vv-fala" data-trilho="tarefas"><span class="vv-ser" aria-hidden="true"><i></i></span><span>${carregou ? 'Não achei sua fila pelo seu usuário. Escolha de quem acompanhar as tarefas.' : 'Carregando sua fila…'}</span><b aria-hidden="true">→</b></button>
        <div class="vv-chips"><button type="button" data-hoje-acao="demandas">Todas as demandas</button><button type="button" data-hoje-acao="agenda">Agenda</button><button type="button" data-hoje-acao="radar">Radar da equipe</button></div>`;
      return;
    }
    const abertas = fila.itens.filter((x) => x.sit !== 'concluida');
    const atrasadas = abertas.filter((x) => x.sit === 'atrasada'), deHoje = abertas.filter((x) => x.ref === hoje && x.sit !== 'atrasada');
    const proximos = Array.from({ length: 6 }, (_, i) => somar(hoje, i + 1)).map((dia) => ({ dia, n: abertas.filter((x) => x.ref === dia).length }));
    const titulo = (x) => String(x.d.nome || x.d.titulo || 'Peça').trim();
    const cliente = (x) => (typeof clientesDoItem === 'function' ? clientesDoItem(x.d)[0] : x.d.cliente) || '';
    const primeiro = atrasadas[0] || deHoje[0] || abertas[0];
    const fala = atrasadas.length
      ? `Você tem <b>${atrasadas.length} atrasada${atrasadas.length > 1 ? 's' : ''}</b>. Comece por <b>${esc(titulo(primeiro))}</b>${cliente(primeiro) ? ' (' + esc(cliente(primeiro)) + ')' : ''}.`
      : deHoje.length ? `Hoje saem <b>${deHoje.length}</b>. Comece por <b>${esc(titulo(primeiro))}</b>${cliente(primeiro) ? ' (' + esc(cliente(primeiro)) + ')' : ''}.`
      : abertas.length ? `Nada vence hoje. Nos próximos dias, <b>${proximos.reduce((n, p) => n + p.n, 0)} peças</b>. Dá para adiantar <b>${esc(titulo(primeiro))}</b>.`
      : 'Fila limpa. Bom momento para adiantar o que vem.';
    const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    // A data do cliente manda (Paulo, 08/11/2026): a fila segue a VEICULAÇÃO. Prazo interno vencido com veiculação
    // adiante é "prazo desatualizado" (o time não atualizou o prazo): alerta, mas não passa na frente de quem veicula antes.
    const veic = (x) => String(x.d.veiculacao_iso || '');
    const desatualizada = (x) => Boolean(x.d.prazo_iso && x.d.prazo_iso < hoje && veic(x) && veic(x) >= hoje);
    const chaveFila = (x) => (veic(x) && veic(x) < hoje ? '0' : '1') + (veic(x) || x.d.prazo_iso || '9999');
    const naFila = (diaEscolhido ? abertas.filter((x) => (veic(x) || x.ref) === diaEscolhido) : abertas).slice().sort((a, b) => chaveFila(a).localeCompare(chaveFila(b)));
    const desatualizadas = abertas.filter(desatualizada);
    // Por status, como o Minhas Tarefas: o grupo mais urgente primeiro (alteração, aprovação…), e dentro dele pela veiculação.
    const grupos = new Map();
    for (const x of naFila) { const st = String(x.d.status || 'Sem status').trim() || 'Sem status'; if (!grupos.has(st)) grupos.set(st, { st, itens: [], ordem: 9, cor: corStatus(x.d, x.sit) }); const g = grupos.get(st); g.itens.push(x); g.ordem = Math.min(g.ordem, ORDEM[x.sit === 'atrasada' && desatualizada(x) ? (/altera|ajuste/i.test(st) ? 'ajuste' : /aprova/i.test(st) ? 'aprovar' : 'fazer') : x.sit] ?? 9); }
    // Ordem do fluxo (não do relógio): o que pede retrabalho e aprovação primeiro, depois produção, cliente e agendado.
    const rankStatus = (st) => /altera|ajuste|corre/i.test(st) ? 0 : /aprova/i.test(st) ? 1 : /andamento|produ/i.test(st) ? 2 : /pode fazer/i.test(st) ? 3 : /a fazer|fazer/i.test(st) ? 4 : /info|briefing|cliente/i.test(st) ? 5 : /agend|pronta|aprovado/i.test(st) ? 7 : 6;
    const porStatus = [...grupos.values()].sort((a, b) => rankStatus(a.st) - rankStatus(b.st) || chaveFila(a.itens[0]).localeCompare(chaveFila(b.itens[0])));
    const item = (x) => linhaDemanda(x.d, { ref: veic(x) || x.ref, sit: desatualizada(x) ? (x.sit === 'atrasada' ? 'fazer' : x.sit) : x.sit, aviso: desatualizada(x) ? 'prazo desatualizado' : '' });
    const POR_GRUPO = innerHeight >= 1000 ? 4 : innerHeight >= 760 ? 3 : 2; // cabe na tela; o resto fica no "+N" (Modo Foco)
    const admin = typeof souAdmin === 'function' && souAdmin(), time = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
    const seletor = admin && time.length ? `<label class="vv-ver-como"><span>Ver como</span><select data-ver-como><option value="">Eu</option>${time.map((u) => `<option value="${esc(u.id)}"${String(u.id) === verComo ? ' selected' : ''}>${esc(u.name || u.nome)}</option>`).join('')}</select></label>` : '';
    el.innerHTML = `${segDono}${seletor}<div class="vv-hoje-topo"><span><small class="vv-data">${esc(data)}</small><h2>${saud}${nome ? ', <em>' + esc(nome) + '</em>' : ''}</h2></span>
        <span class="vv-anel" style="--p:${abertas.length ? Math.round((1 - atrasadas.length / abertas.length) * 100) : 100}" title="Fila em dia"><b>${abertas.length - atrasadas.length}</b><small>/${abertas.length}</small></span></div>
      <button type="button" class="vv-fala" data-hoje-acao="foco"><span class="vv-ser" aria-hidden="true"><i></i></span><span>${fala}</span><b aria-hidden="true">→</b></button>
      ${desatualizadas.length && !diaEscolhido ? `<button type="button" class="vv-alerta-prazo" data-hoje-acao="foco"><b>${desatualizadas.length} peça${desatualizadas.length > 1 ? 's' : ''} com prazo desatualizado</b><span>O prazo interno já passou, mas a veiculação ainda vem. A fila segue a veiculação; atualize o prazo. Quem acompanha: Alex (BI).</span></button>` : ''}
      <div class="vv-blocos">${porStatus.length ? porStatus.map((g) => `<section class="vv-bloco vv-bloco-status" style="--st:${esc(g.cor)}">
      <div class="vv-rotulo-secao" style="--c:${esc(g.cor)}"><i></i>${esc(g.st)}<span class="vv-pilula">${g.itens.length}</span></div>
      ${g.itens.slice(0, POR_GRUPO).map(item).join('')}${g.itens.length > POR_GRUPO ? `<button type="button" class="vv-mais" data-hoje-acao="foco">+ ${g.itens.length - POR_GRUPO} em ${esc(g.st)}</button>` : ''}
      </section>`).join('') : `<section class="vv-bloco"><p class="vv-vazio">${diaEscolhido ? 'Nada veicula neste dia.' : 'Fila limpa. Bom momento para adiantar o que vem.'}</p></section>`}<section class="vv-bloco">
      <div class="vv-rotulo-secao" style="--c:var(--sit-fazer)"><i></i>Próximos dias<span class="vv-pilula">${proximos.reduce((n, p) => n + p.n, 0)}</span></div>
      <div class="vv-dias">${proximos.map((p, i) => `<button type="button" class="vv-dia${p.dia === diaEscolhido ? ' ativo' : ''}" data-hoje-acao="dia" data-valor="${p.dia}"><small>${i === 0 ? 'Amanhã' : DIAS[new Date(p.dia + 'T12:00:00Z').getUTCDay()]}</small><b>${Number(p.dia.slice(8))}</b><span>${p.n || '–'}</span></button>`).join('')}</div>
      <form class="vv-pergunta" data-pergunta><span class="vv-ser" aria-hidden="true"><i></i></span><input type="text" placeholder="Pergunte ao VYBES…" aria-label="Pergunte ao VYBES"><button type="submit" aria-label="Perguntar">→</button></form>
      <div class="vv-chips"><button type="button" data-hoje-acao="foco">Meu dia</button><button type="button" data-hoje-acao="missoes">Missões e cobranças</button><button type="button" data-hoje-acao="demandas">Todas as demandas</button><button type="button" data-hoje-acao="agenda">Agenda</button><button type="button" data-hoje-acao="radar">Radar da equipe</button></div>
      </section></div>`;
  }
  function acaoDoHoje(acao, valor) {
    const eu = typeof operadorDoTopo === 'function' ? operadorDoTopo() : null;
    if (acao === 'dia') { diaEscolhido = diaEscolhido === valor ? '' : valor; pintarHoje(); return; }
    if (acao === 'peca') { chamar('openItemWorkspace', String(valor)); return; }
    if (acao === 'foco') { const alvo = verComo || eu?.id; if (alvo) chamar('chooseFocusUser', String(alvo)); return; }
    if (acao === 'demandas') { chamar('chooseManagerMode'); const b = document.getElementById('btn-board-demandas'); if (b) chamar('switchBoard', 'demandas', b); return; }
    if (acao === 'agenda') { abrirAgenda(); return; }
    if (acao === 'missoes') { window.VybeMissoes?.abrir?.('missoes', verComo || undefined); window.VybeTutorial?.dica?.('missoes'); return; }
    if (acao === 'radar') chamar('chooseManagerMode');
  }
  // "Pergunte ao VYBES": abre o VYBES de verdade (a central) com o pedido, que ela atende ao abrir
  // (chooseVybesMode({ pedido })). Não cria outro chat.
  hud.addEventListener('change', (e) => { const sel = e.target.closest('[data-ver-como]'); if (!sel) return; verComo = sel.value; diaEscolhido = ''; pintarHoje(); });
  hud.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-pergunta]'); if (!f) return;
    e.preventDefault();
    const texto = f.querySelector('input').value.trim();
    const setor = f.dataset.setor;
    chamar('chooseVybesMode', texto ? { pedido: setor ? `[${setor}] ${texto}` : texto } : undefined);
  });

  hud.innerHTML = `
    <nav class="vv-ilha vv-trilho" aria-label="Módulos do Vybe OS">${TRILHO.map((t) => t === '-' ? '<span class="vv-trilho-espaco"></span>' : `<button type="button" class="vv-trilho-btn${t.acao ? ' criar' : ''}" data-trilho="${t.id}" title="${t.dica}" aria-label="${t.dica}"${t.id === 'hoje' ? ' aria-current="page"' : ''}>${t.ic}<span>${t.nome}</span></button>`).join('')}</nav>
    <section class="vv-hoje" id="vv-hoje" aria-label="Seu dia"></section>
    <div class="vv-topo">
      <div class="vv-espaco"></div>
      <div class="vv-ilha vv-barra-topo">
      <div class="vv-ferramentas" role="group" aria-label="Ferramentas">
        <button type="button" class="vv-botao" data-ferr="busca" title="Buscar em todo o painel (⌘K)" aria-label="Buscar">${svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>')}</button>
        <button type="button" class="vv-botao" data-ferr="avisos" title="Avisos" aria-label="Avisos">${svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>')}<span class="vv-badge" id="vv-badge-avisos" hidden></span></button>
        <button type="button" class="vv-botao" data-ferr="conversa" title="Conversa da equipe e recados" aria-label="Conversa da equipe">${svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>')}</button>
        <button type="button" class="vv-botao" data-ferr="whatsapp" title="WhatsApp da Vybe (só leitura)" aria-label="WhatsApp da Vybe" aria-pressed="false">${svg('<path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5z"/>')}<span class="vv-badge" id="vv-badge-whatsapp" hidden></span></button>
        <button type="button" class="vv-botao" data-ferr="notas" title="Suas notas" aria-label="Notas">${svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>')}</button>
        <button type="button" class="vv-botao" data-ferr="camadas" title="Camadas do mapa: clientes, marcos, captações e prospecção do CRM" aria-label="Camadas">${svg('<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>')}</button>
        <button type="button" class="vv-botao" data-ferr="aparencia" title="Aparência (inclui ligar e desligar o mundo)" aria-label="Aparência">${svg('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>')}</button>
        <button type="button" class="vv-botao" data-ferr="ajuda" title="Ajuda do VYBES: refazer o passeio e rever as dicas" aria-label="Ajuda do VYBES">${svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.5"/><path d="M12 16.8h.01"/>')}</button>
        <button type="button" class="vv-botao" data-ferr="conta" title="Sua conta e equipe" aria-label="Conta">${svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>')}</button>
      </div>
      <span class="vv-divisor" aria-hidden="true"></span>
      <div class="vv-vistas" role="group" aria-label="Vista do mundo">
        <button type="button" class="vv-botao" data-vista="cidade" aria-pressed="true">${ic.cidade}<span class="vv-rotulo-longo">Cidade</span></button>
        <button type="button" class="vv-botao" data-vista="predio" aria-pressed="false">${ic.predio}<span class="vv-rotulo-longo">Prédio da Vybe</span></button>
        <button type="button" class="vv-botao" data-vista="cerebro" aria-pressed="false">${svg('<path d="M9 4a3 3 0 0 0-3 3v.5A3 3 0 0 0 4 10.5 3 3 0 0 0 5 13a3 3 0 0 0 2 5 3 3 0 0 0 5 1V4.5A2.5 2.5 0 0 0 9 4zM15 4a3 3 0 0 1 3 3v.5a3 3 0 0 1 2 3 3 3 0 0 1-1 2.5 3 3 0 0 1-2 5 3 3 0 0 1-5 1"/>')}<span class="vv-rotulo-longo">Cérebro</span></button>
      </div>
      </div>
    </div>
    <div class="vv-ilha vv-controles" role="group" aria-label="Controles do mapa">
      <button type="button" class="vv-botao" data-ctl="mais" aria-label="Aproximar">${ic.mais}</button>
      <button type="button" class="vv-botao" data-ctl="menos" aria-label="Afastar">${ic.menos}</button>
      <button type="button" class="vv-botao" data-ctl="girar" aria-label="Girar 90 graus">${ic.girar}</button>
      <button type="button" class="vv-botao" data-ctl="tudo" aria-label="Ver a cidade toda">${ic.tudo}</button>
    </div>
    <aside class="vv-agenda" id="vv-agenda" aria-label="Agenda da Vybe">
      <button type="button" class="vv-agenda-topo" data-agenda-recolher aria-expanded="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><b>Agenda</b><span class="vv-agenda-seta">⌃</span></button>
      <div class="vv-agenda-lista" id="vv-agenda-lista"><p class="vv-dica">Carregando a agenda…</p></div>
      <div class="vv-roteiros" id="vv-roteiros" hidden></div>
      <button type="button" class="vv-botao vv-agenda-abrir" data-abrir-agenda>Abrir a agenda completa →</button>
    </aside>
    <aside class="vv-placa" id="vv-placa" hidden></aside>
    <div class="vv-cartao-mouse" id="vv-cartao" hidden></div>`;

  const placa = () => hud.querySelector('#vv-placa');
  const cartao = () => hud.querySelector('#vv-cartao');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function ajustarAreaLivre() {
    if (!mundo) return;
    const celular = innerWidth <= 900;
    const gate = body.classList.contains('mundo-cartoes') ? document.querySelector('#mode-gate .identity-shell') : centroAberto ? hud.querySelector('.vv-trilho') : hud.querySelector('#vv-hoje');
    const esq = celular ? 0 : (gate?.getBoundingClientRect().right || 0) + 6;
    const dir = !celular && !placa().hidden ? placa().offsetWidth + 20 : 0;
    mundo.areaLivre(esq, dir, celular ? innerHeight * .5 : 0);
    body.style.setProperty('--vv-livre-esq', Math.round(esq) + 'px'); body.style.setProperty('--vv-livre-dir', Math.round(dir) + 'px');
  }

  // ---------- Portas: cada sala abre o módulo que já existe ----------
  function abrirModulo(mod) {
    if (!mod) return;
    const chamar = (nome, ...a) => (typeof window[nome] === 'function' ? window[nome](...a) : undefined);
    if (mod.tipo === 'link' && /^https:\/\//.test(mod.url || '')) { window.open(mod.url, '_blank', 'noopener'); return; } // sistema irmão (ex.: Vybe Finanças)
    if (mod.tipo === 'modo') {
      ({ vybes: () => chamar('chooseVybesMode'), escritorio: () => chamar('chooseOfficeMode'), clientes: () => chamar('chooseClientMode'),
        controler: () => chamar('chooseDaControllerMode'), producao: () => chamar('chooseProductionMode'), gestor: () => chamar('chooseManagerMode') })[mod.alvo]?.();
      return;
    }
    // Quadro: o mesmo caminho do Modo Gestor, mais a aba pedida.
    chamar('chooseManagerMode');
    const btn = document.getElementById('btn-board-' + mod.alvo);
    if (btn) chamar('switchBoard', mod.alvo, btn);
  }
  const NOME_MODULO = { financas: 'Abrir o Vybe Finanças', vybehub: 'Abrir o VybeHub', vybes: 'Abrir o VYBES', escritorio: 'Entrar no Escritório', clientes: 'Abrir Clientes', controler: 'Abrir Direção de arte', producao: 'Abrir Produção',
    gestor: 'Abrir Gestor', automacoes: 'Abrir Automações', performance: 'Abrir Performance', 'ai-usage': 'Abrir IA e custos' };

  // ---------- Números de cada setor (o que o painel sabe de verdade; sem número inventado) ----------
  const SIT_COR = { verde: '#18A957', amarelo: '#E2A11B', vermelho: '#D93D42', cinza: '#9AA3A8' };
  // ---------- Prédio vivo (Paulo, 07/11/2026): a saúde do andar acende a faixa dele ----------
  // Regra pura em mundo/saude-andares.mjs (Criação, Comercial/Atendimento e Financeiro); aqui só os dados
  // do painel e dos módulos irmãos, se existirem. A cor vira 'u1'…'u6' (escala de urgência) em SIT_COR.
  let saudeCache = null, saudeEm = 0;
  const moduloIrmao = (ler) => { try { const d = ler(); return d && typeof d === 'object' && typeof d.then !== 'function' ? d : null; } catch { return null; } };
  function saudeDoPredio() {
    if (!mundo?.saudeDosAndares) return null;
    if (saudeCache && Date.now() - saudeEm < 2000) return saudeCache;
    const agentes = {}; for (const a of mundo.planta) agentes[a.id] = a.setores.filter((s) => s.agente).map((s) => estadoDoAgente(s.id).estado);
    saudeCache = mundo.saudeDosAndares({ itens: itensDoPainel(), hoje: hojeIso(), situacao: (i, h) => situacaoDaPeca(i, h), agentes,
      comercial: moduloIrmao(() => window.VybeComercial?.dados?.()), carteira: moduloIrmao(() => window.VybeCarteira?.dados?.()) });
    saudeEm = Date.now(); return saudeCache;
  }
  function comSaude(a, r) {
    const s = saudeDoPredio()?.[a.id]; if (!s) return r;
    SIT_COR['u' + s.nivel] = s.cor;
    return { ...r, sit: 'u' + s.nivel, motivo: s.motivo };
  }
  const MOTIVO_SIT = { vermelho: 'Um agente do andar falhou ou há peça atrasada.', amarelo: 'Tem coisa esperando aprovação.', verde: 'Tudo andando.', cinza: 'Agentes sem execução ou sem leitura da central.' };
  function motivoDoAndar(a) { const r = numerosDoAndar(a); return { motivo: r.motivo || MOTIVO_SIT[r.sit] || '', cor: SIT_COR[r.sit] || SIT_COR.cinza }; }
  // ---------- fim do prédio vivo ----------
  function numerosDoAndar(a) {
    const pecas = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : [];
    const sits = pecas.map((d) => situacaoDaPeca(d));
    const conta = (k) => sits.filter((x) => x === k).length;
    const agentes = a.setores.filter((s) => s.agente).map((s) => estadoDoAgente(s.id).estado);
    const falhou = agentes.includes('falhou'), aguardando = agentes.filter((e) => e === 'aguardando_aprovacao').length, executando = agentes.filter((e) => e === 'executando').length;
    let n = [], sit = falhou ? 'vermelho' : aguardando ? 'amarelo' : 'verde';
    if (a.id === 'criacao') {
      const atr = conta('atrasada'), apr = conta('aprovar');
      n = [[sits.filter((x) => x !== 'concluida').length, 'em produção'], [atr, 'atrasadas'], [apr, 'para aprovar']];
      sit = falhou || atr ? 'vermelho' : apr || aguardando ? 'amarelo' : 'verde';
    } else if (a.id === 'comercial') {
      const crm = crmCache || [], contato = crm.filter((o) => ['abordagem_proposta', 'aprovada', 'contato_feito', 'reuniao', 'proposta_comercial'].includes(o.etapa)).length;
      n = [[naTela.length, 'clientes ativos'], [contato, 'em contato'], [crm.filter((o) => o.etapa === 'ganho').length, 'ganhos']];
      sit = falhou ? 'vermelho' : crm.some((o) => o.etapa === 'abordagem_proposta') || aguardando ? 'amarelo' : 'verde';
    } else if (a.id === 'terreo') {
      n = [[sits.filter((x) => x !== 'concluida').length, 'peças em aberto'], [conta('hoje'), 'saem hoje'], [executando, 'agentes trabalhando']];
    } else if (a.tipo === 'equipe' && a.id !== 'terraco') {
      // Andar do time: quem está nele agora e quantas salas têm gente (não há agente aqui).
      const zonas = Object.entries(mundo.zonasDoPredio || {}).filter(([, z]) => z.andar === a.id).map(([id]) => id);
      const aqui = presencaDoEscritorio().filter((g) => zonas.includes(g.zona));
      n = [[aqui.length, 'no andar agora'], [new Set(aqui.map((g) => g.zona)).size, 'salas com gente'], [zonas.length, 'salas']];
      sit = 'verde';
    } else if (a.id === 'terraco') {
      const gente = presencaDoEscritorio();
      n = [[gente.length, 'online agora'], [gente.filter((g) => g.zona && g.zona !== 'recepcao').length, 'em salas'], [Object.keys(mundo.zonasDoPredio || {}).length, 'salas']];
      sit = 'verde';
    } else {
      n = [[executando, 'trabalhando'], [aguardando, 'aguardando você'], [agentes.filter((e) => e === 'disponivel').length, 'disponíveis']];
      if (!agentes.length || agentes.every((e) => ['sem_execucao', 'indisponivel'].includes(e))) sit = 'cinza';
    }
    return comSaude(a, { n, sit });
  }
  function pintarSituacaoDosAndares() {
    if (!mundo?.situacaoDosAndares) return;
    const m = {}; for (const a of mundo.planta) { const s = numerosDoAndar(a).sit; m[a.id] = SIT_COR[s] || s; }
    mundo.situacaoDosAndares(m);
  }
  // Elevador: coluna fina colada ao prédio. Cada andar com número, nome, o número que mais importa e a cor
  // da situação (a mesma da faixa de luz do andar). Clicar abre o andar com tudo.
  function mostrarAndares() {
    const p = placa();
    const f = fonteAgentes?.ler(), semCentral = Boolean(f?.erro);
    p.innerHTML = `<div class="vv-elevador-lista">
      <div class="vv-elevador-topo"><small class="vv-cb-kicker">Elevador</small><button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button></div>
      <h3>Prédio da Vybe</h3>
      ${[...mundo.planta].reverse().map((a) => { const { n, sit, motivo } = numerosDoAndar(a); const [v, r] = n[0] || [0, ''];
        return `<button type="button" class="vv-elevador" data-andar="${a.id}" style="--c:${a.cor};--s:${SIT_COR[sit]}" title="${esc((motivo ? motivo + ' · ' : '') + n.map(([x, y]) => Number(x).toLocaleString('pt-BR') + ' ' + y).join(' · '))}">
          <span class="num">${a.nivel === 0 ? 'T' : a.id === 'terraco' ? '☀' : a.nivel}</span>
          <span class="meio"><b>${esc(a.nome.replace(/^Terraço · /, ''))}</b><em><strong>${Number(v).toLocaleString('pt-BR')}</strong> ${esc(r)}</em></span>
          <span class="sit" aria-hidden="true"></span></button>`; }).join('')}
      <p class="vv-elevador-aviso${semCentral ? ' off' : ''}">${semCentral ? 'Agentes sem sinal: a central do VYBES está desligada. Os números de produção continuam valendo.' : esc(avisoDosAgentes())}</p>
    </div>`;
    p.hidden = false; ajustarAreaLivre();
    pintarSituacaoDosAndares();
  }
  // Operação do andar em números: por agente, o estado agora, execuções de hoje, taxa de sucesso, última execução,
  // maturidade (ativo / em sombra / planejado) e se já tem módulo. Só o que a central informa; sem número inventado.
  const MATURIDADE = { ativo: ['Ativo', '#18A957'], sombra: ['Em sombra', '#E2A11B'], planejado: ['Planejado', '#9AA3A8'] };
  function opAndarHtml(a) {
    const ags = a.setores.filter((s) => s.agente); if (!ags.length) return '';
    const hoje = new Date().toDateString(), f = fonteAgentes?.ler(), sinal = Boolean(f?.dados && !f.erro);
    let exec = 0, ok = 0, falha = 0, curso = 0;
    const linhas = ags.map((s) => {
      const e = estadoDoAgente(s.id), ult = (e.ultimos || []), dHoje = ult.filter((u) => new Date(u.em).toDateString() === hoje);
      const c = ult.filter((u) => u.estado === 'concluida').length, fl = ult.filter((u) => u.estado === 'falhou').length;
      exec += dHoje.length; ok += c; falha += fl; curso += e.emCurso || 0;
      const taxa = c + fl ? Math.round(c / (c + fl) * 100) + '%' : '—', m = MATURIDADE[s.estado] || MATURIDADE.planejado;
      return `<tr data-agente="${esc(a.id)}|${esc(s.id)}" title="Abrir o dia de ${esc(s.agente)}">
        <td><i class="pt" style="--e:${e.cor}"></i><b>${esc(s.agente)}</b><small>${esc(s.nome)}</small></td>
        <td><span class="mat" style="--m:${m[1]}">${m[0]}</span></td>
        <td class="n">${sinal ? dHoje.length : '—'}</td><td class="n">${sinal ? taxa : '—'}</td>
        <td class="n">${sinal && ult[0] ? esc(horaAgentes(ult[0].em)) : '—'}</td>
        <td class="n">${s.modulo ? '<span class="mod ok" title="Tem módulo">●</span>' : '<span class="mod" title="Sem módulo no painel ainda">○</span>'}</td></tr>`;
    }).join('');
    const taxa = ok + falha ? Math.round(ok / (ok + falha) * 100) + '%' : '—';
    return `<div class="vv-rotulo-secao" style="--c:#0D74CE"><i></i>Operação do andar</div>
      <div class="vv-op-resumo">${[[sinal ? exec : '—', 'execuções hoje'], [sinal ? taxa : '—', 'sucesso (últimas)'], [sinal ? falha : '—', 'falhas'], [sinal ? curso : '—', 'em curso']].map(([v, r]) => `<div><b>${v}</b><small>${r}</small></div>`).join('')}</div>
      <table class="vv-op-tabela"><thead><tr><th>Agente</th><th>Fase</th><th class="n">Hoje</th><th class="n">Sucesso</th><th class="n">Última</th><th class="n">Mód.</th></tr></thead><tbody>${linhas}</tbody></table>
      ${sinal ? '' : `<p class="vv-elevador-aviso off">${esc(avisoDosAgentes())}. A tabela enche quando a central voltar.</p>`}`;
  }
  // Um botão só para entrar e sair (Paulo, 08/11/2026: "se eu já tô no andar tem sentido o botão entrar?").
  function botaoDoAndarHtml(id) {
    return andarAbertoId === id
      ? `<button type="button" class="vv-botao acao vv-entrar-andar" data-sair-andar data-andar-id="${esc(id)}">← Voltar ao prédio</button>`
      : `<button type="button" class="vv-botao acao vv-entrar-andar" data-entrar-andar="${esc(id)}" data-andar-id="${esc(id)}">Entrar no andar →</button>`;
  }
  function trocarBotaoDoAndar() {
    const b = placa()?.querySelector('.vv-entrar-andar');
    if (b) b.outerHTML = botaoDoAndarHtml(b.dataset.andarId);
  }
  function mostrarAndar(idAndar, idSetor) {
    const a = mundo.planta.find((x) => x.id === idAndar); if (!a) return;
    const p = placa(), E = mundo.estadosReais;
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button>
      <button type="button" class="vv-botao" data-voltar style="margin:-6px 0 6px -8px;height:28px">← Andares</button>
      <h3>${a.nivel === 0 ? 'Térreo' : a.id === 'terraco' ? 'Terraço' : a.nivel + 'º andar'} · ${esc(a.nome.replace(/^Terraço · /, ''))}</h3><p class="vv-sub">${esc(a.resumo)}</p>
      ${(() => { const { n, sit } = numerosDoAndar(a); return `<div class="vv-andar-kpis" style="--s:${SIT_COR[sit]}">${n.map(([v, r]) => `<div><b>${Number(v).toLocaleString('pt-BR')}</b><small>${esc(r)}</small></div>`).join('')}</div>`; })()}
      ${(() => { const espera = a.setores.filter((s) => s.agente && estadoDoAgente(s.id).estado === 'aguardando_aprovacao');
        return espera.length ? `<div class="vv-rotulo-secao" style="--c:#8E4EC6"><i></i>Precisa de você<span class="vv-pilula">${espera.length}</span></div>${espera.map((s) => { const e = estadoDoAgente(s.id); return `<button type="button" class="vv-cb-camada" data-agente="${esc(a.id)}|${esc(s.id)}" style="--c:#8E4EC6"><i></i><span><b>${esc(s.agente)}</b><small>${esc(e.tarefa || 'Aguardando aprovação')}${e.desde ? ' · desde ' + esc(horaAgentes(e.desde)) : ''}</small></span><em>Ver →</em></button>`; }).join('')}` : ''; })()}
      ${opAndarHtml(a)}
      <div class="vv-rotulo-secao" style="--c:${a.cor}"><i></i>${a.tipo === 'equipe' ? 'O andar' : 'Agentes do andar'}</div>
      ${a.setores.map((s) => `<article class="vv-sala" ${s.id === idSetor ? 'style="outline:2px solid ' + a.cor + '"' : ''}>
        <div class="vv-sala-topo"><span class="vv-agente ${['sem_execucao','indisponivel'].includes(estadoDoAgente(s.id).estado) ? 'planejado' : ''}" data-avatar-agente="${esc(s.id)}">${s.agente ? esc(s.agente.slice(0, 2).toUpperCase()) : '★'}</span>
        <span><b>${esc(s.nome)}${s.agente ? ' · ' + esc(s.agente) : ''}</b><p class="papel">${esc(s.papel)}</p></span></div>
        ${s.agente ? seloAgente(s.id) : ''}
        ${s.skills.length ? `<ul class="vv-skills">${s.skills.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
        <div class="vv-sala-acoes">${s.agente ? `<button type="button" class="vv-botao" data-agente="${esc(a.id)}|${esc(s.id)}">Ver o dia</button>` : ''}${s.modulo ? `<button type="button" class="vv-botao acao" data-modulo='${esc(JSON.stringify(s.modulo))}'>${esc(NOME_MODULO[s.modulo.alvo] || 'Abrir')} →</button>` : '<span class="vv-dica">Ainda sem sistema próprio: começa quando o setor tiver ferramenta.</span>'}</div>
      </article>`).join('')}
      ${salasDaEquipeHtml(a.id)}${a.id === 'terraco' ? equipeLazerHtml() : ''}`;
    if (Object.values(mundo.zonasDoPredio || {}).some((z) => z.andar === a.id) || a.setores.some((s) => s.agente))
      p.querySelector('.vv-sub').insertAdjacentHTML('afterend', botaoDoAndarHtml(a.id));
    p.hidden = false; ajustarAreaLivre();
    mundo.focarAndar(a.nivel);
    hud.querySelector('[data-voltar]')?.addEventListener('click', () => mundo.focarAndar(null), { once: true });
  }
  // ---------- O Escritório dentro do prédio: salas, quem está nelas e a porta de entrada ----------
  // A presença vem do próprio Escritório (o mesmo Worker): conectado, a lista da sala;
  // de fora, o modo "observar" do saguão (observarLobbyEscritorio). Nada novo no servidor.
  function presencaDoEscritorio() {
    if (typeof escritorio === 'undefined' || !escritorio) return [];
    const lista = escritorio.conectado ? (escritorio.onlineTodos || escritorio.online || []) : (escritorio.lobbyOnline || []);
    const gente = lista.map((p) => ({ id: String(p.id), nome: p.nome || '', zona: p.zona || '', roupa: p.perfil?.roupa || p.roupa || '', figura: p.perfil?.figura || p.figura || '' }));
    const eu = escritorio.base?.eu;
    if (escritorio.conectado && escritorio.zona && eu && !gente.some((p) => p.id === String(eu)))
      gente.push({ id: String(eu), nome: 'Você', zona: escritorio.zona, roupa: escritorio.perfil?.roupa || '', figura: escritorio.perfil?.figura || '' });
    return gente;
  }
  function observarPresenca() {
    try { if (typeof escritorio !== 'undefined' && escritorio?.base && !escritorio.conectado && typeof observarLobbyEscritorio === 'function') observarLobbyEscritorio(); } catch { /* o mundo segue sem presença */ }
  }
  let ultimaPresenca = '';
  function pintarPresenca() {
    if (!mundo?.presenca) return;
    const gente = presencaDoEscritorio(), assinatura = gente.map((p) => p.id + ':' + p.zona).sort().join('|');
    if (assinatura === ultimaPresenca) return;
    ultimaPresenca = assinatura; mundo.presenca(gente);
  }
  function salasDaEquipeHtml(idAndar) {
    const zonas = Object.entries(mundo.zonasDoPredio || {}).filter(([, z]) => z.andar === idAndar);
    if (!zonas.length) return '';
    const gente = presencaDoEscritorio();
    return `<div class="vv-rotulo-secao" style="--c:#FF7A2F"><i></i>Salas da equipe</div>` + zonas.map(([id, z]) => {
      const aqui = gente.filter((p) => p.zona === id);
      return `<div class="vv-zona"><span><b>${esc(z.nome)}</b><small>${aqui.length ? esc(aqui.map((p) => p.nome.split(' ')[0]).join(', ')) : 'ninguém agora'}</small></span>
        <button type="button" class="vv-botao" data-entrar-zona="${esc(id)}">Entrar</button></div>`;
    }).join('') + '<p class="vv-dica">Todos se veem no andar; a voz liga só com quem está na mesma sala.</p>';
  }

  // ---------- Equipe e lazer (o que vinha do Escritório clássico) ----------
  // Ficha e conquistas abrem em janela própria, por cima do mapa. Jogos, sinuca e música são lugares:
  // a pessoa entra na sala. Missões, baú, loja e construção ainda vivem só no Escritório clássico.
  function equipeLazerHtml() {
    const e = typeof escritorio !== 'undefined' ? escritorio : null, base = Boolean(e?.base);
    const Z = mundo.zonasDoPredio || {}, temZona = (id) => Boolean(Z[id]);
    const item = (attr, titulo, sub, cor, icone) => `<button type="button" class="vv-lazer" ${attr} style="--c:${cor}"><i>${icone}</i><span><b>${titulo}</b><small>${sub}</small></span></button>`;
    return `<div class="vv-rotulo-secao" style="--c:#8E4EC6"><i></i>Equipe e lazer</div>
      ${base ? '' : '<p class="vv-dica">Entre no Escritório (barra de voz, embaixo) para ver sua ficha e as conquistas.</p>'}
      <div class="vv-lazer-grade">
        ${base ? item('data-legado="ficha"', 'Sua ficha', 'nível, moedas e troféus', '#FF7A2F', '★') : ''}
        ${base ? item('data-legado="conquistas"', 'Conquistas', 'ranking da equipe', '#E2A11B', '♛') : ''}
        ${temZona('jogos') ? item('data-entrar-zona="jogos"', 'Sala de jogos', 'sinuca, xadrez, pôquer, dominó, truco', '#18A957', '●') : ''}
        ${temZona('lounge') ? item('data-entrar-zona="lounge"', 'Lounge', 'música da sala, todos ouvem junto', '#8E4EC6', '♪') : ''}
        ${temZona('cafe') ? item('data-entrar-zona="cafe"', 'Café', 'pausa e conversa', '#B07A45', '☕') : ''}
        ${item('data-legado="missoes"', 'Missões e cobranças', 'o que cada um entrega e quem está cobrando', '#5B6268', '✓')}
      </div>`;
  }

  // ---------- O andar por dentro (escritório aberto; a voz é da sala onde você entra) ----------
  let andarAberto = null, timerAndar = null, andarAbertoId = '', geracaoAndar = 0, focoSala = 0;
  const TIPO_DA_ZONA = (id) => (/^sala-\d+$/.test(id) ? 'pessoal' : id === 'recepcao' ? 'convivencia' : id);
  function perfilDoDono(zona) {
    try {
      const s = (escritorio.base?.salas || []).find((x) => x.id === zona); if (!s?.pessoa_id) return null;
      return (escritorio.base?.equipe || []).find((p) => String(p.id) === String(s.pessoa_id))?.perfil || null;
    } catch { return null; }
  }
  function tamanhoDaZona(zona) {
    try { const a = ESCRITORIO_PLANTA.ambientes.find((x) => x.id === zona); return a ? { w: a.x1 - a.x0, d: a.y1 - a.y0 } : null; } catch { return null; }
  }
  // Presença com posição local da sala (ladrilhos), para o boneco ficar onde está no Escritório.
  function genteDoAndar() {
    if (typeof escritorio === 'undefined' || !escritorio) return [];
    const lista = escritorio.conectado ? (escritorio.onlineTodos || escritorio.online || []) : (escritorio.lobbyOnline || []);
    const pos = (p) => (typeof escritorioPosicao === 'function' ? escritorioPosicao(p) : { x: NaN, y: NaN });
    const gente = lista.map((p) => { const q = pos(p); return { id: String(p.id), nome: p.nome || '', zona: p.zona || '', x: q.x, y: q.y, L: tamanhoDaZona(p.zona),
      roupa: p.perfil?.roupa || p.roupa, pele: p.perfil?.pele, cabelo: p.perfil?.cabelo, figura: p.perfil?.figura || p.figura || '' }; });
    const eu = escritorio.base?.eu;
    if (escritorio.conectado && escritorio.zona && eu && !gente.some((p) => p.id === String(eu)) && typeof movimento !== 'undefined')
      gente.push({ id: String(eu), nome: 'Você', eu: true, zona: escritorio.zona, x: movimento.x, y: movimento.y, L: tamanhoDaZona(escritorio.zona),
        roupa: escritorio.perfil?.roupa, pele: escritorio.perfil?.pele, cabelo: escritorio.perfil?.cabelo, figura: escritorio.perfil?.figura || '' });
    return gente;
  }
  async function abrirAndarVoxel(idAndar) {
    if (andarAberto && andarAbertoId === idAndar) return;
    fecharAndarVoxel(false);
    const geracao = geracaoAndar;
    const a = mundo.planta.find((x) => x.id === idAndar); if (!a) return;
    const zonas = Object.entries(mundo.zonasDoPredio).filter(([, z]) => z.andar === idAndar)
      .map(([id, z]) => ({ id, nome: z.nome, dono: z.dono || null, tipo: TIPO_DA_ZONA(id), perfil: perfilDoDono(id), L: tamanhoDaZona(id),
        itens: /^sala-\d+$/.test(id) && typeof escritorioItensDaCamada === 'function' ? (() => { try { return escritorioItensDaCamada(id) || []; } catch { return []; } })() : [], ...(window.VybeDecorar?.acabamentoDaSala?.(id) || {}) }));
    const agentesDoAndar = a.setores.filter((s) => s.agente).map((s) => ({ id: s.id, agente: s.agente, nome: s.nome }));
    if (!zonas.length && !agentesDoAndar.length) return;
    const mesasLivres = a.tipo === 'agentes' ? Math.max(0, (mundo.mesasPorAndar || 6) - agentesDoAndar.length) : 0;
    const minhaSala = window.VybeDecorar?.salaDecoravel?.(zonas.map((z) => z.id)) || '';
    const el = document.createElement('section'); el.id = 'mundo-andar';
    el.innerHTML = `<div class="andar-palco"><canvas aria-label="${esc(a.nome)} por dentro"></canvas></div>
      <header class="vv-ilha andar-topo"><button type="button" class="vv-botao andar-voltar" data-sair-andar hidden>← Voltar ao prédio</button>
        <span><small>${a.nivel === 0 ? 'Térreo' : a.id === 'terraco' ? 'Terraço' : a.nivel + 'º andar'}</small><b>${esc(a.nome.replace(/^Terraço · /, ''))}</b></span>
        <span class="andar-voz" id="andar-voz"></span>${minhaSala ? `<button type="button" class="vv-botao acao" data-decorar="${esc(minhaSala)}">Decorar minha sala</button>` : ''}</header>
      <p class="andar-dica">Todo mundo do andar aparece aqui. Clique numa sala para entrar nela: a voz liga só com quem está na mesma sala.</p>`;
    body.append(el); body.classList.add('mundo-andar');
    window.VybeTutorial?.dica?.('andar');
    const m = await import(MUNDO_JS);
    if (geracao !== geracaoAndar || el.isConnected === false) return;
    andarAberto = m.abrirAndar(el.querySelector('canvas'), { zonas, titulo: a.nome, agentes: agentesDoAndar, cor: a.cor, mesasLivres });
    // A mesa de cada agente no andar abre o dia dele no painel do andar (o mesmo "Ver o dia" do Prédio).
    andarAberto.aoClicarAgente?.((setor) => mostrarAgente(a.id, setor));
    andarAbertoId = idAndar;
    window.VybeDecorar?.ligarCena?.(andarAberto, m);
    andarAberto.aoClicarSala((zona, fx, fz, jogo) => {
      if (jogo) { abrirJogo(jogo); return; }
      const naSala = typeof escritorio !== 'undefined' && escritorio?.conectado && escritorio.zona === zona && escritorio.mapa;
      if (naSala) {
        const L = tamanhoDaZona(zona); if (L && typeof escritorioIrPara === 'function') escritorioIrPara(Math.round(fx * L.w), Math.round(fz * L.d));
      } else irParaSala(zona);
    });
    el.querySelector('[data-sair-andar]').addEventListener('click', () => sairDoAndar());
    trocarBotaoDoAndar();
    el.querySelector('[data-decorar]')?.addEventListener('click', (ev) => { window.VybeDecorar?.abrir?.(ev.currentTarget.dataset.decorar); window.VybeTutorial?.dica?.('decorar'); });
    const pintar = () => {
      if (!andarAberto) return;
      const voltar = el.querySelector('.andar-voltar'), semPainel = placa().hidden || !placa().querySelector('[data-sair-andar]');
      if (voltar && voltar.hidden !== !semPainel) voltar.hidden = !semPainel;
      const minha = typeof escritorio !== 'undefined' && escritorio?.conectado ? escritorio.zona : '';
      andarAberto.pessoas(manualAndar || genteDoAndar(), minha);
      // Estado de cada agente do andar: a mesma leitura da central que pinta o prédio por fora.
      const f = fonteAgentes?.ler(), conectado = Boolean(f?.dados && !f.erro);
      andarAberto.agentes?.(Object.fromEntries(agentesDoAndar.map((s) => { const e = estadoDoAgente(s.id); return [s.id, { estado: e.estado, cor: e.cor, rotulo: e.rotulo, conectado }]; })));
      const voz = el.querySelector('#andar-voz');
      if (voz) voz.textContent = minha && zonas.some((z) => z.id === minha) ? (typeof escritorioEstadoVozTexto === 'function' ? escritorioEstadoVozTexto() : 'Na sala') : 'Fora das salas · sem voz';
    };
    pintar(); timerAndar = setInterval(pintar, 200);
    sincronizar();
  }
  // Sair do andar volta ao Prédio com o painel daquele andar aberto (os HUDs seguem onde estavam).
  async function sairDoAndar() {
    if (window.VybeDecorar?.aberto?.() && !(await window.VybeDecorar.fechar())) return;
    const id = andarAbertoId;
    fecharAndarVoxel(false);
    if (id && mundo) mostrarAndar(id);
  }
  function fecharAndarVoxel(voltar) {
    geracaoAndar++; andarAbertoId = '';
    clearInterval(timerAndar); timerAndar = null;
    window.VybeDecorar?.ligarCena?.(null);
    andarAberto?.destruir(); andarAberto = null;
    document.getElementById('mundo-andar')?.remove(); body.classList.remove('mundo-andar');
    trocarBotaoDoAndar();
    if (voltar && typeof openModeGate === 'function' && !document.getElementById('mode-gate')?.classList.contains('open')) openModeGate();
    sincronizar();
  }
  let manualAndar = null;

  // ---------- Agenda (a mesma das Captações: /api/painel?area=captacoes, só leitura) ----------
  const TIPO_COR = { captacao: '#0E9A45', reuniao: '#1A8FA0', outro: '#6B7A72' };
  const TIPO_NOME = { captacao: 'Captação', reuniao: 'Reunião', outro: 'Compromisso' };
  let agendaEm = 0, agendaEventos = null;
  async function carregarAgenda(forcar = false) {
    if (!forcar && agendaEventos && Date.now() - agendaEm < 5 * 60e3) return pintarAgenda();
    const hoje = mundo?.diaNaBahia?.() || hojeIso();
    try {
      const r = await fetch(`/api/painel?area=captacoes&semana=${hoje}&dias=7`, { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Agenda indisponível.');
      agendaEventos = (d.agenda || []).filter((e) => e.dia >= hoje); agendaEm = Date.now();
    } catch (e) { agendaEventos = null; hud.querySelector('#vv-agenda-lista').innerHTML = `<p class="vv-dica">${esc(e.message)}</p>`; return; }
    pintarAgenda();
    const hoje2 = mundo?.diaNaBahia?.() || hojeIso();
    mundo?.definirCaptacoes?.(agendaEventos.filter((e) => e.dia === hoje2 && e.tipo === 'captacao' && e.cliente)
      .map((e) => ({ cliente: e.cliente, dia: e.dia, inicio: e.inicio || '', fim: e.fim || '' })));
  }
  document.addEventListener('vybe-datas-prontas', () => pintarAgenda());
  function pintarAgenda() {
    const el = hud.querySelector('#vv-agenda-lista'); if (!el || !agendaEventos) return;
    pintarRoteiros();
    const hoje = hojeIso(), agora = new Date(), hm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    const amanha = (() => { const x = new Date(`${hoje}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); })();
    const proximos = agendaEventos.filter((e) => e.dia > hoje || !e.fim || e.fim >= hm)
      .sort((a, b) => (a.dia + (a.inicio || '00:00')).localeCompare(b.dia + (b.inicio || '00:00'))).slice(0, 3);
    // Datas comemorativas dos próximos 14 dias, abaixo dos compromissos e com menos destaque (Paulo, 08/11/2026).
    const datas = window.VybeDatas?.proximas(hoje, 14) || [];
    const datasHtml = datas.length ? `<div class="vd-agenda"><small class="vd-agenda-rotulo">Datas comemorativas</small>${datas.slice(0, centroAberto ? 3 : 6).map((d) => `<div class="vd-agenda-linha"><span>${d.iso === hoje ? 'Hoje' : d.iso.slice(8, 10) + '/' + d.iso.slice(5, 7)}</span>${window.VybeDatas.chipHtml(d)}</div>`).join('')}</div>` : '';
    if (!proximos.length) { el.innerHTML = '<p class="vv-dica">Nada marcado nos próximos 7 dias.</p>' + datasHtml; return; }
    el.innerHTML = proximos.map((e) => {
      const quando = e.dia === hoje ? 'Hoje' : e.dia === amanha ? 'Amanhã' : new Date(`${e.dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).replace('.', '');
      const hora = e.inicio ? ' · ' + e.inicio.replace(':00', 'h').replace(':', 'h') : '';
      return `<button type="button" class="vv-evento" style="--c:${TIPO_COR[e.tipo] || TIPO_COR.outro}" data-agenda-dia="${esc(e.dia)}">
        <small>${esc(quando + hora)} · ${esc(TIPO_NOME[e.tipo] || 'Compromisso')}</small><b>${esc(e.titulo || 'Sem título')}</b>${e.local || e.cliente ? `<span>${esc(e.local || e.cliente)}</span>` : ''}</button>`;
    }).join('') + datasHtml;
  }
  // ---------- Roteiro da semana (Paulo, 07/11/2026): juntar captações por dia e bairro ----------
  // Só sugestão (mundo/captacoes.mjs, roteirosDaSemana): a agenda não muda. Ordem pelo vizinho mais próximo.
  function pintarRoteiros() {
    const el = hud.querySelector('#vv-roteiros'); if (!el) return;
    const r = agendaEventos && mundo?.roteirosDaSemana ? mundo.roteirosDaSemana(agendaEventos, mundo.diaNaBahia?.() || hojeIso()) : null;
    if (!r || (!r.dias.length && !r.juntar.length)) { el.hidden = true; el.innerHTML = ''; el.vvAss = ''; return; }
    const kmTxt = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    const html = `<div class="vv-rotulo-secao" style="--c:#0E9A45"><i></i>Roteiro da semana</div>`
      + r.dias.slice(0, 3).map((d) => `<div class="vv-roteiro"><b>${esc(d.frase)}</b>
        <small>${['Vybe', ...d.ordem.map((p) => p.cliente + (p.noMapa ? '' : ' (sem endereço no mapa)')), 'Vybe'].map(esc).join(' → ')}</small>
        ${d.km ? `<span>≈ ${kmTxt(d.km)} km${d.economia >= .1 ? ` · ${kmTxt(d.economia)} km a menos que na ordem da agenda` : ''}</span>` : ''}</div>`).join('')
      + r.juntar.slice(0, 2).map((j) => `<p class="vv-dica">${esc(j.frase)}</p>`).join('');
    if (el.vvAss !== html) { el.innerHTML = html; el.vvAss = html; }
    el.hidden = false;
  }
  // A agenda completa é a das Captações (módulo Produção): uma agenda só.
  function abrirAgenda(dia) {
    abrirModulo({ tipo: 'modo', alvo: 'producao' });
    if (dia) setTimeout(() => { if (typeof captVerDia === 'function') captVerDia(dia); }, 250);
  }

  // ---------- O dia de cada agente (clique no agente na mesa dele) ----------
  // Só leitura, pelos mesmos endpoints que os módulos já usam. Nada novo no servidor.
  const lerApi = async (url) => { const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d?.error || 'Indisponível agora.'); return d; };
  const hora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const itensDoPainel = () => { const v = new Set(); return [...(typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : []), ...(typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : [])].filter((i) => !v.has(i.id) && v.add(i.id)); };
  const tituloDe = (i) => String(i.nome || i.titulo || 'Peça').trim();
  const clienteDe = (i) => (typeof clientesDoItem === 'function' ? clientesDoItem(i)[0] : i.cliente) || '';
  const FONTES = {
    async orquestrador() {
      const hoje = hojeIso(), itens = itensDoPainel();
      let online = null; try { const d = await lerApi('/api/painel?area=vybes'); online = Boolean(d.noAr); } catch { /* sem central */ }
      const mexidas = itens.filter((i) => String(i.status_updated_at || '').slice(0, 10) === hoje).sort((a, b) => String(b.status_updated_at).localeCompare(String(a.status_updated_at)));
      const atrasadas = itens.filter((i) => situacaoDaPeca(i, hoje) === 'atrasada');
      return { agora: online === null ? 'Não consegui ver a central agora.' : online ? 'No ar, recebendo pedidos do WhatsApp, da central e do painel.' : 'A central está fora do ar.',
        feitos: mexidas.slice(0, 8).map((i) => ({ quando: hora(i.status_updated_at), texto: `${tituloDe(i)} → ${i.status}`, sub: clienteDe(i) })),
        fila: atrasadas.slice(0, 6).map((i) => ({ texto: tituloDe(i), sub: `${clienteDe(i)} · atrasada`, peca: i.id })), rotuloFeitos: 'Movimento de hoje', rotuloFila: 'Precisa de alguém' };
    },
    async copy() {
      const d = await lerApi('/api/painel?area=planejamentos&acao=pendentes');
      const lista = d.pendentes || [];
      return { agora: lista.length ? `${lista.length} planejamento${lista.length > 1 ? 's' : ''} em revisão com os heads.` : 'Nenhum planejamento esperando revisão.',
        feitos: lista.filter((p) => p.origem === 'agente').slice(0, 8).map((p) => ({ quando: p.mes || '', texto: `${p.titulo || 'Planejamento'} · ${p.cliente || ''}`, sub: `versão ${p.versao || 1} · ${p.estado || ''}` })),
        fila: lista.slice(0, 6).map((p) => ({ texto: `${p.cliente || ''} · ${p.mes || ''}`, sub: p.estado === 'ajustes' ? 'voltou com ajustes' : 'esperando o head' })),
        rotuloFeitos: 'Planejamentos que ele publicou', rotuloFila: 'Esperando o head' };
    },
    async automacao() {
      const [h, f] = await Promise.all([lerApi('/api/painel?area=automacoes&historico=1&limite=12'), lerApi('/api/painel?area=automacoes&falhas=1').catch(() => ({}))]);
      const ex = h.execucoes || [], falhas = f.falhas || f.itens || [];
      return { agora: ex[0] ? `Última regra rodou ${hora(ex[0].em)}.` : 'Nenhuma regra disparou ainda.',
        feitos: ex.slice(0, 8).map((e) => ({ quando: hora(e.em), texto: e.titulo || '(conteúdo removido)', sub: e.regra?.nome || e.nome || (e.evento?.tipo === 'data' ? 'por data' : `${e.evento?.de || ''} → ${e.evento?.para || ''}`) })),
        fila: falhas.slice(0, 6).map((x) => ({ texto: x.titulo || x.regra || 'Falha de automação', sub: x.erro || x.motivo || 'para revisar' })),
        rotuloFeitos: 'O que ele fez', rotuloFila: 'Falhas para revisar' };
    },
    async edicao() {
      const d = await lerApi(`/api/painel?area=captacoes&semana=${hojeIso()}&dias=7`);
      const rec = d.recentes || [];
      return { agora: 'Acompanhando o que foi gravado (a decupagem automática ainda não está ligada).',
        feitos: rec.filter((e) => e.captacao_id).map((e) => ({ quando: e.dia, texto: e.titulo, sub: 'gravação fechada' })),
        fila: rec.filter((e) => !e.captacao_id).map((e) => ({ texto: e.titulo, sub: `${e.dia} · falta fechar a gravação` })),
        rotuloFeitos: 'Gravações fechadas', rotuloFila: 'Falta fechar' };
    },
    async design() {
      const itens = itensDoPainel().filter((i) => /aprova/i.test(i.status || '') && situacaoDaPeca(i) !== 'concluida');
      return { agora: itens.length ? `${itens.length} peça${itens.length > 1 ? 's' : ''} esperando aprovação.` : 'Nada esperando aprovação.',
        feitos: [], fila: itens.slice(0, 8).map((i) => ({ texto: tituloDe(i), sub: `${clienteDe(i)} · ${i.status}`, peca: i.id })), rotuloFila: 'Fila de aprovação' };
    },
    async bi() {
      const hoje = hojeIso(), itens = itensDoPainel(), abertas = itens.filter((i) => situacaoDaPeca(i, hoje) !== 'concluida');
      const porCliente = new Map(); for (const i of abertas) { const c = clienteDe(i); if (c) porCliente.set(c, (porCliente.get(c) || 0) + 1); }
      const atrasadas = abertas.filter((i) => situacaoDaPeca(i, hoje) === 'atrasada').length;
      return { agora: `${abertas.length} peças em aberto · ${atrasadas} atrasadas.`,
        feitos: [...porCliente].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => ({ quando: '', texto: c, sub: `${n} em aberto` })), fila: [],
        rotuloFeitos: 'Onde está o volume' };
    },
    // CRM de prospecção do Qualificador (SDR): empresas públicas de Irecê que ainda não são clientes.
    async sdr() {
      const lista = (mundo.empresas || []).filter((e) => !/police|place_of_worship|townhall|courthouse|public_building|fire_station|park|pitch|stadium|bus_station|square/.test(e.tipo) && !/^(pra[cç]a|hospital regional|prefeitura|c[aâ]mara)/i.test(e.nome)), clientes = new Set(naTela.map((c) => norm(c.nome).toLowerCase()));
      const ag = mundo.agencia || { x: 0, z: 0 };
      const linhas = lista.map((e) => ({ ...e, cliente: [...clientes].some((c) => c && c.length > 3 && (e.nome.toLowerCase() === c || e.nome.toLowerCase().startsWith(c + ' ') || (e.razao || '').toLowerCase().startsWith(c + ' '))), dist: Math.round(Math.hypot(e.x - ag.x, e.z - ag.z) * 10) }))
        .sort((a, b) => a.dist - b.dist);
      crmLinhas = linhas;
      const prospects = linhas.filter((l) => !l.cliente);
      return { agora: `${prospects.length.toLocaleString('pt-BR')} empresas ativas para prospectar em Irecê. ${linhas.length - prospects.length} já são clientes da Vybe.`, crm: true, feitos: [], fila: [] };
    },
    async concierge() {
      const d = await lerApi('/api/painel?area=planejamentos&acao=pendentes');
      const alertas = d.alertas || [];
      return { agora: alertas.length ? `${alertas.length} cliente${alertas.length > 1 ? 's' : ''} com aviso.` : 'Nenhum aviso de cliente agora.',
        feitos: [], fila: alertas.slice(0, 8).map((a) => ({ texto: a.cliente || 'Cliente', sub: [a.ajustes && `${a.ajustes} ajuste(s)`, a.avisos && `${a.avisos} aviso(s)`].filter(Boolean).join(' · ') || 'para olhar' })),
        rotuloFila: 'Clientes pedindo atenção' };
    },
  };
  let crmLinhas = [], crmBusca = '', crmTipo = '', crmBairro = '', crmAce = false, crmPagina = 1;
  const CRM_CHAVE = 'vybe.crm.propostas';
  let crmBanco = null, crmErro = '', crmAviso = '', crmDetalhe = null, crmOcupado = false, crmConsulta = 0;
  const crmPropostas = () => crmBanco?.oportunidades || [];
  async function crmPedido(corpo, query = '') {
    const r = await fetch('/api/painel?area=crm' + query, { credentials: 'same-origin', cache: 'no-store',
      ...(corpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) } : {}) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || 'Não foi possível acessar o CRM.');
    return d;
  }
  async function crmImportar(dados) {
    let antigas, bruto;
    try { bruto = localStorage.getItem(CRM_CHAVE) || '[]'; antigas = JSON.parse(bruto); }
    catch { crmAviso = 'Não foi possível ler as propostas antigas deste navegador. Elas foram preservadas.'; return; }
    if (!Array.isArray(antigas)) { crmAviso = 'As propostas antigas estão em formato inválido; nada foi removido.'; return; }
    const chave = CRM_CHAVE + '.importado:' + dados.pessoa_id;
    try { if (!antigas.length || localStorage.getItem(chave) === bruto) return; } catch { /* banco deduplica */ }
    if (!dados.pode_editar) { crmAviso = 'Há propostas antigas neste navegador. Abra este CRM com uma conta autorizada para importá-las.'; return; }
    for (let i = 0; i < antigas.length; i += 100) await crmPedido({ acao: 'importar', propostas: antigas.slice(i, i + 100) });
    try { localStorage.setItem(chave, bruto); } catch { /* repetição segura pela chave única no banco */ }
    crmAviso = 'Propostas antigas levadas ao banco. A cópia local foi preservada.';
  }
  async function crmCarregar(mais = false, importar = false) {
    const n = ++crmConsulta;
    const d = await crmPedido(null, '&pagina=' + (mais ? crmBanco.pagina + 1 : 1));
    if (importar) { if (n !== crmConsulta) return; crmBanco = d; await crmImportar(d); Object.assign(d, await crmPedido()); }
    if (n !== crmConsulta) return;
    if (mais) d.oportunidades = [...crmBanco.oportunidades, ...d.oportunidades].filter((o, i, a) => a.findIndex(x => String(x.id) === String(o.id)) === i);
    crmBanco = d;
    if (crmDetalhe) crmDetalhe = await crmPedido(null, '&id=' + encodeURIComponent(crmDetalhe.oportunidade.id));
    crmRepintar();
  }
  async function crmExecutar(corpo, b) {
    if (crmOcupado) return;
    crmOcupado = true; if (b) b.disabled = true;
    crmErro = ''; const erroEl = placa().querySelector('#vv-crm-erro'); if (erroEl) erroEl.textContent = '';
    try { await crmPedido(corpo); await crmCarregar(); }
    catch (e) { crmErro = e.message; const el = placa().querySelector('#vv-crm-erro'); if (el) el.textContent = crmErro; }
    finally { crmOcupado = false; if (b?.isConnected) b.disabled = false; }
  }
  function crmQuadroHtml() {
    if (!crmBanco) return '<p class="vv-dica">Oportunidades ainda não carregadas.</p><button type="button" class="vv-botao" data-crm-recarregar>Tentar carregar</button>';
    const { etapas, oportunidades, contagens } = crmBanco;
    return `<div class="vv-rotulo-secao"><i></i>Funil comercial <span class="vv-pilula">${crmBanco.total}</span></div>
      <p class="vv-dica">O SDR propõe. Uma pessoa aprova. A equipe faz o contato; o CRM não envia mensagens.</p>
      <button type="button" class="vv-botao" data-crm-recarregar>Atualizar quadro</button>
      <div class="vv-crm-quadro" id="vv-crm-quadro" role="region" aria-label="Oportunidades por etapa" tabindex="0">${etapas.map(et => `<section class="vv-crm-coluna"><h4>${esc(et.nome)} <small>${contagens.find(c => c.etapa === et.id)?.total || 0}</small></h4>${oportunidades.filter(o => o.etapa === et.id).map(o => `<button type="button" class="vv-crm-oportunidade" data-crm-detalhe="${esc(o.id)}"><b>${esc(o.nome)}</b><small>${esc(o.responsavel_nome || 'Sem responsável')}</small><span>${esc(o.proxima_acao || 'Definir próxima ação')}</span>${o.proxima_acao_data ? `<small>${esc(String(o.proxima_acao_data).slice(0,10))}</small>` : ''}</button>`).join('') || '<p class="vv-dica">Nenhuma carregada.</p>'}</section>`).join('')}</div>
      ${oportunidades.length < crmBanco.total ? `<button type="button" class="vv-botao" data-crm-pagina>Carregar mais oportunidades (${oportunidades.length} de ${crmBanco.total})</button>` : ''}
      ${crmDetalheHtml()}`;
  }
  function crmDetalheHtml() {
    if (!crmDetalhe) return '';
    const { oportunidade: o, historico, historico_pagina } = crmDetalhe, pode = crmBanco.pode_editar;
    const etapaNome = id => crmBanco.etapas.find(e => e.id === id)?.nome || 'Início';
    const indice = crmBanco.etapas.findIndex(e => e.id === o.etapa), fim = ['ganho','perdido'].includes(o.etapa), proxima = crmBanco.etapas[indice + 1];
    return `<section class="vv-crm-ficha"><button type="button" class="vv-botao" data-crm-fechar>Fechar oportunidade</button><h4>${esc(o.nome)}</h4>
      <p>${esc(o.cnpj || 'Sem CNPJ')} · ${esc(o.setor_empresa)} · ${esc(etapaNome(o.etapa))}</p>
      ${pode ? `<form data-crm-editar><label>Responsável<select name="responsavel" aria-label="Responsável"><option value="">Sem responsável</option>${crmBanco.pessoas.map(p => `<option value="${esc(p.id)}"${String(p.id) === String(o.responsavel) ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
        <label>Próxima ação<textarea aria-label="Próxima ação" name="proxima_acao" maxlength="2000">${esc(o.proxima_acao)}</textarea></label><label>Data da próxima ação<input aria-label="Data da próxima ação" type="date" name="proxima_acao_data" value="${esc(o.proxima_acao_data ? String(o.proxima_acao_data).slice(0,10) : '')}"></label><button type="submit" class="vv-botao">Salvar responsável e ação</button></form>
        ${!fim ? `<div class="vv-crm-movimentos"><button type="button" class="vv-botao acao" data-crm-mover="${esc(proxima.id)}">${o.etapa === 'abordagem_proposta' ? 'Aprovar abordagem' : 'Registrar: ' + esc(proxima.nome)}</button><button type="button" class="vv-botao" data-crm-mover="perdido">Marcar perdido</button></div>` : ''}
        <form data-crm-comentario><label>Comentário<textarea aria-label="Comentário" name="observacao" maxlength="4000" required></textarea></label><button type="submit" class="vv-botao">Registrar comentário</button></form>` : `<p class="vv-dica">Responsável: ${esc(o.responsavel_nome || 'Não definido')} · Próxima ação: ${esc(o.proxima_acao || 'Não definida')}${o.proxima_acao_data ? ' · ' + esc(String(o.proxima_acao_data).slice(0,10)) : ''}. Somente a equipe autorizada edita.</p>`}
      <h4>Histórico</h4><ol class="vv-crm-historico">${historico.map(h => `<li><b>${esc(h.quem_nome)}</b> · ${esc(new Date(h.quando).toLocaleString('pt-BR', { timeZone: 'America/Bahia' }))}<small>${esc(h.tipo)} · ${esc(etapaNome(h.de_etapa))} → ${esc(etapaNome(h.para_etapa))}</small><p>${esc(h.observacao)}</p>${h.tipo === 'edicao' ? `<p>Responsável: ${esc(crmBanco.pessoas.find(p => String(p.id) === String(h.detalhes?.depois?.responsavel))?.nome || 'Não definido')} · Próxima ação: ${esc(h.detalhes?.depois?.proxima_acao || 'Não definida')}${h.detalhes?.depois?.proxima_acao_data ? ' · ' + esc(h.detalhes.depois.proxima_acao_data) : ''}</p>` : ''}</li>`).join('')}</ol>
      ${historico.length === 50 ? `<button type="button" class="vv-botao" data-crm-historico="${historico_pagina + 1}">Histórico anterior</button>` : historico_pagina > 1 ? '<p>Fim do histórico.</p>' : ''}
      ${historico_pagina > 1 ? '<button type="button" class="vv-botao" data-crm-historico="1">Voltar ao histórico recente</button>' : ''}</section>`;
  }
  hud.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-crm-editar],[data-crm-comentario]'); if (!form || !crmDetalhe) return;
    e.preventDefault(); const d = Object.fromEntries(new FormData(form)), o = crmDetalhe.oportunidade;
    crmExecutar({ ...d, acao: form.hasAttribute('data-crm-editar') ? 'atualizar' : 'comentar', id: o.id, versao: o.versao }, form.querySelector('button[type="submit"]'));
  });
  const anosDe = (iso) => { const a = new Date(iso); return isNaN(a) ? '' : Math.max(0, Math.floor((Date.now() - a) / 31557600000)); };
  const PORTE = { ME: 'Microempresa', EPP: 'Pequeno porte', DEMAIS: 'Médio/grande', MEI: 'MEI' };
  function crmHtml() {
    const setores = [...new Set(crmLinhas.map((l) => l.setor || mundo.tipoLegivel(l)))].filter(Boolean).sort();
    const bairros = [...new Set(crmLinhas.map((l) => l.bairro).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const propostas = new Set(crmPropostas().map((p) => p.cnpj || p.nome));
    const filtradas = crmLinhas.filter((l) => !l.cliente || crmBusca)
      .filter((l) => (!crmBusca || (l.nome + ' ' + (l.razao || '') + ' ' + (l.cnae || '') + ' ' + (l.cnpj || '')).toLowerCase().includes(crmBusca))
        && (!crmTipo || (l.setor || mundo.tipoLegivel(l)) === crmTipo) && (!crmBairro || l.bairro === crmBairro) && (!crmAce || l.ace));
    const vis = filtradas.slice(0, 40 * crmPagina);
    const tel = (t) => String(t || '').replace(/\D/g, '');
    return `<div data-crm-painel><p id="vv-crm-erro" role="alert">${esc(crmErro)}</p>${crmAviso ? `<p class="vv-dica">${esc(crmAviso)}</p>` : ''}${crmQuadroHtml()}<div class="vv-rotulo-secao" style="--c:var(--vv-laranja)"><i></i>Prospecção em Irecê<span class="vv-pilula">${filtradas.length.toLocaleString('pt-BR')}</span></div>
      <div class="vv-crm-filtros"><input type="search" placeholder="Empresa, atividade ou CNPJ…" value="${esc(crmBusca)}" data-crm-busca></div>
      <div class="vv-crm-filtros"><select data-crm-tipo><option value="">Todos os setores</option>${setores.map((t) => `<option${t === crmTipo ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <select data-crm-bairro><option value="">Todos os bairros</option>${bairros.map((t) => `<option${t === crmBairro ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <button type="button" class="vv-crm-ace${crmAce ? ' on' : ''}" data-crm-ace aria-pressed="${crmAce}">ACE</button></div>
      ${vis.map((l) => { const chave = l.cnpj || l.nome, anos = l.abertura ? anosDe(l.abertura) : '';
        return `<div class="vv-crm-linha${l.cliente ? ' cliente' : ''}"><button type="button" class="vv-crm-nome" data-crm-ver="${l.x},${l.z}" title="Ver no mapa">
        <b>${esc(l.nome)}${l.ace ? ' <span class="vv-crm-ace-selo">ACE</span>' : ''}</b>
        <small>${esc(l.cnae || mundo.tipoLegivel(l))}</small>
        <small>${esc([l.bairro, PORTE[l.porte] || l.porte, anos !== '' ? (anos < 1 ? 'aberta este ano' : anos + (anos === 1 ? ' ano' : ' anos')) : '', l.dist < 1000 ? l.dist + ' m da Vybe' : (l.dist / 1000).toFixed(1).replace('.', ',') + ' km da Vybe'].filter(Boolean).join(' · '))}</small>
        ${l.onde && !['rua', 'numero'].includes(l.onde) ? `<small class="vv-crm-aprox">Posição aproximada (${l.onde === 'bairro' ? 'bairro' : 'cidade'})</small>` : ''}</button>
        <div class="vv-crm-acoes">${l.telefone ? `<a class="vv-crm-contato" href="tel:${tel(l.telefone)}" title="${esc(l.telefone)}">${esc(l.telefone)}</a>` : ''}${l.email ? `<a class="vv-crm-contato" href="mailto:${esc(l.email)}" title="${esc(l.email)}">e-mail</a>` : ''}
        ${l.cliente ? '<span class="vv-selo" style="--e:#18A957"><i></i>Cliente</span>' : propostas.has(chave) ? '<span class="vv-selo" style="--e:#8E4EC6"><i></i>No funil</span>' : crmBanco?.pode_editar ? `<button type="button" class="vv-botao" data-crm-incluir="${esc(chave)}">Adicionar ao funil</button><button type="button" class="vv-botao" data-crm-propor="${esc(chave)}">Propor abordagem</button>` : '<small>Somente leitura</small>'}</div></div>`; }).join('')}
      ${filtradas.length > vis.length ? `<button type="button" class="vv-botao vv-crm-mais" data-crm-mais>Mostrar mais ${Math.min(40, filtradas.length - vis.length)} de ${(filtradas.length - vis.length).toLocaleString('pt-BR')}</button>` : ''}
      <p class="vv-dica">${esc(mundo.fonteEmpresas || '')} Mais perto da Vybe primeiro. "Propor abordagem" registra a oportunidade no banco para aprovação humana; ninguém recebe mensagem.</p></div>`;
  }
  const crmRepintar = (foco) => { const d = placa().querySelector('#vv-agente-dados'); if (!d?.querySelector('[data-crm-painel]')) return; const scroll = d.querySelector('#vv-crm-quadro')?.scrollLeft || 0; d.innerHTML = crmHtml(); const quadro = d.querySelector('#vv-crm-quadro'); if (quadro) quadro.scrollLeft = scroll; if (foco) { const i = d.querySelector(foco); i?.focus(); if (i?.setSelectionRange) i.setSelectionRange(i.value.length, i.value.length); } };
  let crmTimer = 0;
  hud.addEventListener('input', (e) => { const b = e.target.closest('[data-crm-busca]'); if (!b) return; clearTimeout(crmTimer); crmTimer = setTimeout(() => { crmBusca = b.value.trim().toLowerCase(); crmPagina = 1; crmRepintar('[data-crm-busca]'); }, 180); });
  hud.addEventListener('change', (e) => { const t = e.target.closest('[data-crm-tipo],[data-crm-bairro]'); if (!t) return; if (t.dataset.crmTipo !== undefined) crmTipo = t.value; else crmBairro = t.value; crmPagina = 1; crmRepintar(); });
  let fonteAgentes = null;
  // A leitura dos agentes vem do módulo (sem montar o 3D): Hoje, Gestão e a página Agentes funcionam com o Centro fechado.
  function criarFonte(m) {
    if (fonteAgentes || !m?.criarFonteAgentes) return fonteAgentes;
    fonteAgentes = m.criarFonteAgentes({buscar:async()=>{
      const r = await fetch('/api/painel?area=vybes&etapa=agentes',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000)});
      if(!r.ok) throw new Error('Central indisponível');
      return r.json();
    }});
    return fonteAgentes;
  }
  const plantaDoPredio = () => mundo?.planta || modAvatar?.PLANTA || [];
  const horaAgentes = v => v ? new Date(v).toLocaleTimeString('pt-BR', { timeZone:'America/Bahia',hour:'2-digit',minute:'2-digit' }) : '';
  const dataAgentes = v => v ? new Date(v).toLocaleString('pt-BR', { timeZone:'America/Bahia',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit' }) : '';
  function estadoDoAgente(id) {
    const a = fonteAgentes?.ler().dados?.agentes.find(x => x.setor === id);
    return (mundo || modAvatar)?.apresentarAgente?.(a) || { estado:'indisponivel',rotulo:'Sem leitura da central',cor:'#7A8B82',ultimos:[] };
  }
  function avisoDosAgentes() {
    const f = fonteAgentes?.ler();
    if (f?.erro) return f.atualizadoEm ? 'Agentes sem sinal da central desde ' + horaAgentes(f.atualizadoEm) : 'Agentes sem sinal: a central do VYBES está desligada';
    return f?.atualizadoEm ? 'Central do VYBES · leitura às ' + horaAgentes(f.atualizadoEm) : 'Consultando a central do VYBES…';
  }
  function seloAgente(id) { const a = estadoDoAgente(id); return `<span class="vv-selo" data-estado-agente="${esc(id)}" style="--e:${a.cor}"><i></i>${esc(a.rotulo)}</span>`; }
  function atividadeDoAgenteHtml(id) {
    const a = estadoDoAgente(id), ref = (mundo || modAvatar)?.referenciaDaPeca?.(a.ultimos?.find(e => e.estado === a.estado)?.ref);
    const tarefa = a.tarefa ? esc(a.tarefa) : a.estado === 'sem_execucao' ? 'Sem execução registrada.' : a.estado === 'indisponivel' ? 'Aguardando leitura da central.' : 'Nenhuma atividade em curso.';
    const item = e => {
      const ref = (mundo || modAvatar)?.referenciaDaPeca?.(e.ref), rotulo = {executando:'Executando',aguardando_aprovacao:'Aguardando aprovação',concluida:'Concluída',falhou:'Falhou'}[e.estado];
      const corpo = `<small>${esc(dataAgentes(e.em))} · ${esc(rotulo)}</small><b>${esc(e.tarefa)}</b><span>${esc(e.resultado || e.erro || 'Sem resultado final.')} · ${esc(e.ferramenta)}</span>`;
      return ref ? `<button type="button" class="vv-linha-agente" data-hoje-acao="peca" data-valor="${esc(ref)}">${corpo}</button>` : `<div class="vv-linha-agente">${corpo}</div>`;
    };
    return `${seloAgente(id)}<p class="vv-dica vv-agentes-conexao" role="status">${esc(avisoDosAgentes())}</p>
      <div class="vv-rotulo-secao"><i></i>O que está fazendo</div>
      ${ref ? `<button type="button" class="vv-linha-agente" data-hoje-acao="peca" data-valor="${esc(ref)}"><b>${tarefa}</b><small>Abrir a peça</small></button>` : `<p class="vv-agente-tarefa">${tarefa}</p>`}
      ${a.tarefa && a.desde ? `<small>Desde ${esc(dataAgentes(a.desde))}</small>` : ''}
      <div class="vv-rotulo-secao"><i></i>O que fez · últimos registros</div>${a.ultimos?.map(item).join('') || '<p class="vv-dica">Sem registros recebidos para este setor.</p>'}`;
  }
  function agentesCerebroHtml(ags) {
    const nome = new Map(); for (const a of mundo.planta) for (const s of a.setores) nome.set(s.id, {s,a});
    return `<p class="vv-dica vv-agentes-conexao">${esc(avisoDosAgentes())}</p>` + ags.map(g => {
      const x = nome.get(g.setor); if (!x) return ''; const E = estadoDoAgente(g.setor);
      return `<button type="button" class="vv-cb-camada" data-agente="${esc(x.a.id)}|${esc(x.s.id)}" style="--c:${E.cor}"><i></i><span><b>${esc(x.s.agente)}</b><small>${esc(x.s.nome)} · ${esc(x.a.nome)}</small></span><em>${esc(E.rotulo)}</em></button>`;
    }).join('');
  }
  function pintarAtividadeAgentes() {
    if (!mundo && !modAvatar) return;
    const f = fonteAgentes?.ler(); mundo?.atividadeAgentes(f?.dados?.agentes || [], Boolean(f?.dados && !f.erro));
    window.VybeAgentes?.repintar?.();
    pintarSituacaoDosAndares();
    const el = placa()?.querySelector('[data-atividade-setor]');
    if (el) el.innerHTML = atividadeDoAgenteHtml(el.dataset.atividadeSetor);
    hud.querySelectorAll('[data-estado-agente]').forEach(el => { const a = estadoDoAgente(el.dataset.estadoAgente); el.style.setProperty('--e',a.cor); el.innerHTML = '<i></i>' + esc(a.rotulo); });
    hud.querySelectorAll('[data-avatar-agente]').forEach(el => { const a = estadoDoAgente(el.dataset.avatarAgente); el.classList.toggle('planejado',['sem_execucao','indisponivel'].includes(a.estado)); });
    hud.querySelectorAll('[data-indicador-agente]').forEach(el => { const a = estadoDoAgente(el.dataset.indicadorAgente); el.style.setProperty('--e',a.cor); el.title = a.rotulo; });
    if (cerebroCache && mundo) {
      cerebroCache.ags = agentesDoCerebro(); cerebroCache.camadas = camadasDoCerebro(cerebroCache.cli,cerebroCache.ags);
      const assinatura = JSON.stringify([cerebroCache.ags.map(a => [a.setor,a.estado,a.conectado]),cerebroCache.camadas.agentes]);
      if (pintarAtividadeAgentes.assinatura !== assinatura) { pintarAtividadeAgentes.assinatura = assinatura; mundo.atualizarAgentesCerebro(cerebroCache.ags,cerebroCache.camadas); }
      const quadro = placa()?.querySelector('#vv-cerebro-agentes'); if (quadro) quadro.innerHTML = agentesCerebroHtml(cerebroCache.ags);
    }
  }
  async function carregarAgentes(forcar=false) {
    if (!mundo && !modAvatar) return;
    if (!fonteAgentes) criarFonte(mundo || modAvatar);
    if (body.classList.contains('auth-pending')) { fonteAgentes?.limpar(); pintarAtividadeAgentes(); return; }
    if (document.hidden || body.classList.contains('mundo-lobby')) return;
    await fonteAgentes?.atualizar(forcar); pintarAtividadeAgentes();
  }

  // Atalho global: de qualquer módulo (ex.: Cérebro do cliente), fecha o módulo e mostra o agente no prédio.
  if (typeof window !== 'undefined') window.vybesAbrirAgente = (idAndar, idSetor) => {
    if (!ligado || !mundo) return;
    if (body.classList.contains('mundo-modulo')) { body.classList.remove('mundo-tela-cheia'); chamar('voltarAoMenu'); }
    setTimeout(() => { mundo.cerebro?.(false); hud.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.vista === 'predio'))); body.classList.add('mundo-predio'); mostrarAgente(idAndar, idSetor); }, 350);
  };
  async function mostrarAgente(idAndar, idSetor) {
    // Com o Centro fechado, o agente abre na página Agentes (tela cheia), não na placa do prédio.
    if (!centroAberto && window.VybeAgentes?.abrir) { window.VybeAgentes.abrir(idSetor); return; }
    const a = plantaDoPredio().find((x) => x.id === idAndar), s = a?.setores.find((x) => x.id === idSetor); if (!s) return;
    const E = estadoDoAgente(s.id), p = placa();
    const iniciais = (s.agente || 'VY').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button>
      <button type="button" class="vv-botao" data-andar="${esc(a.id)}" style="margin:-6px 0 6px -8px;height:28px">← ${esc(a.nome)}</button>
      <div class="vv-agente-topo"><span class="vv-agente ${['sem_execucao','indisponivel'].includes(estadoDoAgente(s.id).estado) ? 'planejado' : ''}" data-avatar-agente="${esc(s.id)}">${esc(iniciais)}</span>
        <span><small>VYBES · ${esc(s.nome)}</small><h3>${esc(s.agente || 'VYBES')}</h3></span></div>
      <p class="vv-sub">${esc(s.papel)}</p>
      <div class="vv-agente-atividade" data-atividade-setor="${esc(s.id)}">${atividadeDoAgenteHtml(s.id)}</div>
      <div class="vv-rotulo-secao"><i></i>Operação do painel</div>
      <div class="vv-agente-agora" id="vv-agente-agora"><span class="vv-ser" aria-hidden="true"><i></i></span><span>Olhando o que ele está fazendo…</span></div>
      <div id="vv-agente-dados"></div>
      ${mundo ? cerebroDoAgenteHtml(a, s) : ''}
      <div class="vv-rotulo-secao" style="--c:#6B675F"><i></i>Ferramentas</div>
      <ul class="vv-skills">${s.skills.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
      <form class="vv-pergunta" data-pergunta data-setor="${esc(s.nome)}"><span class="vv-ser" aria-hidden="true"><i></i></span><input type="text" placeholder="Pedir algo a ${esc(s.agente || 'VYBES')}…" aria-label="Pedir algo a este agente"><button type="submit" aria-label="Pedir">→</button></form>
      ${s.modulo ? `<button type="button" class="vv-botao acao" style="margin-top:10px" data-modulo='${esc(JSON.stringify(s.modulo))}'>${esc(NOME_MODULO[s.modulo.alvo] || 'Abrir')} →</button>` : ''}`;
    p.hidden = false; ajustarAreaLivre();
    mundo.focarAndar(a.nivel);
    const agoraEl = p.querySelector('#vv-agente-agora span:last-child'), dados = p.querySelector('#vv-agente-dados');
    void carregarAgentes();
    const fonte = FONTES[s.id];
    if (!fonte) {
      agoraEl.textContent = s.estado === 'planejado' ? `A sala está pronta. Falta ligar: ${s.skills.join(', ')}.` : 'Ainda sem leitura própria no painel.';
      return;
    }
    try {
      const r = await fonte();
      if (p.hidden || !p.contains(dados)) return;
      agoraEl.textContent = r.agora;
      const daPeca = (id) => (typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL.find((d) => String(d.id) === String(id)) : null);
      const linha = (x) => (x.peca && daPeca(x.peca)) ? linhaDemanda(daPeca(x.peca)) : `<button type="button" class="vv-linha-agente"${x.peca ? ` data-hoje-acao="peca" data-valor="${esc(x.peca)}"` : ''}>${x.quando ? `<small>${esc(x.quando)}</small>` : ''}<b>${esc(x.texto)}</b>${x.sub ? `<span>${esc(x.sub)}</span>` : ''}</button>`;
      if (r.crm) { crmErro = ''; crmDetalhe = null; dados.innerHTML = crmHtml(); try { await crmCarregar(false, true); } catch (e) { crmErro = e.message; crmRepintar(); } return; }
      dados.innerHTML = (r.fila?.length ? `<div class="vv-rotulo-secao" style="--c:var(--sit-aprovar)"><i></i>${esc(r.rotuloFila || 'Na fila')}<span class="vv-pilula">${r.fila.length}</span></div>${r.fila.map(linha).join('')}` : '')
        + (r.feitos?.length ? `<div class="vv-rotulo-secao" style="--c:var(--sit-pronta)"><i></i>${esc(r.rotuloFeitos || 'Registros do painel')}</div>${r.feitos.map(linha).join('')}` : '')
        + (!r.fila?.length && !r.feitos?.length ? '<p class="vv-dica">Nada registrado agora.</p>' : '');
    } catch (e) { agoraEl.textContent = e.message; }
  }

  // Placa do Cérebro: cada cliente como um nó ligado ao VYBES, do mais urgente ao mais tranquilo.
  // ---------- Cérebro arquitetado ----------
  // Camadas reais da memória do VYBES. Os números vêm do painel (cadastro, demandas, cérebro dos clientes);
  // o que mora na central (conversas, fichas da noite) é dito como tal, sem número inventado.
  const MODELO = 'Qwen 3.5 (35B), local no computador da Vybe (Ollama)';
  const CAMADAS_INFO = {
    nucleo: { nome: 'VYBES', cor: '#8E7CFF', mora: 'core/identidade.js e core/frases.js (bot e central usam a mesma fonte)',
      texto: 'Um só VYBES, com a mesma personalidade no WhatsApp, na central e aqui. Ele recebe o pedido, consulta as camadas de memória e passa a tarefa ao agente do andar certo. Agente propõe; quem tem permissão aprova.' },
    identidade: { nome: 'Identidade', cor: '#FF7A2F', mora: 'core/identidade.js · conhecimento/manual-vybe.md · diretrizes dos clientes',
      texto: 'Quem o VYBES é, como fala e o que pode responder. É lida em toda resposta, por todos os agentes: é o que impede cada andar de virar uma pessoa diferente.' },
    clientes: { nome: 'Memória dos clientes', cor: '#8E7CFF', mora: 'Fichas na central (.vybe-ai-local/clientes), estudo da noite, cadastro e referências do painel',
      texto: 'Tudo o que o VYBES sabe de cada cliente, em nove partes: identidade e paleta, regras da DA, Instagram, ideias e datas, atrasos, produção, solicitações, arquivos e aprendizados. Cada item diz de onde veio.' },
    conversas: { nome: 'Conversas', cor: '#18A957', mora: 'Grupos internos do WhatsApp, guardados pela central (mensagens.sqlite)',
      texto: 'O que a equipe combinou nos grupos internos. A central lê, resume e transforma em pendência ou aprendizado do cliente. Grupo de cliente não é tocado sem autorização.' },
    trabalho: { nome: 'Trabalho do painel', cor: '#3B9EFF', mora: 'Vybe OS: demandas, captações, planejamentos, automações',
      texto: 'O estado de agora: o que está aberto, atrasado, para aprovar e quem está com cada peça. É a memória de curto prazo que todo agente consulta antes de agir.' },
    agentes: { nome: 'Agentes dos andares', cor: '#D6409F', mora: 'core/agentes.js (setores, permissões, propostas em .vybe-ai-local/agentes)',
      texto: 'Cada setor do prédio tem um agente com nome e função. Todos são o VYBES; muda só o que cada um lê e o que pode fazer. O que eles propõem fica registrado, então ninguém esquece.' },
  };
  function cerebroDosClientes() {
    return naTela.map((c) => {
      let origens = {}, itens = 0;
      try { const cb = typeof cerebroDoCliente === 'function' ? cerebroDoCliente(c.nome) : null; if (cb) { origens = cb.origens || {}; itens = Object.values(cb.categorias || {}).reduce((n, l) => n + l.length, 0); } } catch { /* sem cérebro do cliente */ }
      return { ...c, origens, itens };
    });
  }
  function agentesDoCerebro() {
    const conectado = Boolean(fonteAgentes?.ler().dados && !fonteAgentes.ler().erro);
    return (mundo.agentesDoPredio?.() || []).map(ag => ({...ag,estado:estadoDoAgente(ag.setor).estado,conectado}));
  }
  function camadasDoCerebro(cli, ags) {
    const abertas = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL.filter((d) => situacaoDaPeca(d) !== 'concluida').length : 0;
    const itens = cli.reduce((n, c) => n + c.itens, 0);
    const conta = (k) => ags.filter((a) => a.estado === k).length;
    return { identidade: 'uma só, em todos os canais', clientes: `${cli.length} clientes · ${itens.toLocaleString('pt-BR')} itens`, conversas: 'grupos internos, pela central',
      trabalho: `${abertas.toLocaleString('pt-BR')} peças em aberto`, agentes: `${conta('executando')} executando · ${conta('aguardando_aprovacao')} aguardando aprovação · ${conta('disponivel')} disponíveis · ${conta('falhou')} falharam · ${conta('sem_execucao')} sem execução · ${conta('indisponivel')} sem leitura${fonteAgentes?.ler().erro ? ' · última leitura, central fora do ar' : ''}` };
  }
  let cerebroCache = null;
  function ligarCerebro() {
    const cli = cerebroDosClientes(), ags = agentesDoCerebro(), camadas = camadasDoCerebro(cli, ags);
    cerebroCache = { cli, ags, camadas };
    mundo.cerebro(true, cli, { camadas, agentes: ags, aoNo: (id) => mostrarNoDoCerebro(id) });
    mostrarNoDoCerebro('nucleo');
  }
  const ORIGEM_NOME = { central: 'Central do VYBES', operacao: 'Painel', referencia: 'Referência', navegador: 'Nota' };
  const ORIGEM_COR = { central: '#8E7CFF', operacao: '#FF7A2F', referencia: '#3B9EFF', navegador: '#9AA3A8' };
  function barraOrigens(o) {
    const tot = Object.values(o || {}).reduce((n, v) => n + v, 0); if (!tot) return '';
    return `<span class="vv-origens" title="${esc(Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${ORIGEM_NOME[k] || k}: ${v}`).join(' · '))}">${Object.entries(o).filter(([, v]) => v).map(([k, v]) => `<i style="flex:${v};background:${ORIGEM_COR[k] || '#9AA3A8'}"></i>`).join('')}</span>`;
  }
  function mostrarNoDoCerebro(id) {
    if (!cerebroCache) return;
    const info = CAMADAS_INFO[id] || CAMADAS_INFO.nucleo, p = placa(), { cli, ags, camadas } = cerebroCache;
    const nav = Object.entries(CAMADAS_INFO).map(([k, v]) => `<button type="button" class="vv-cb-aba${k === id ? ' on' : ''}" data-cerebro-no="${k}" style="--c:${v.cor}"><i></i>${esc(k === 'nucleo' ? 'VYBES' : v.nome)}</button>`).join('');
    let corpo = '';
    if (id === 'nucleo') {
      corpo = `<div class="vv-cb-fato"><small>Pensa com</small><b>${esc(MODELO)}</b></div>
        <div class="vv-cb-fato"><small>Como decide</small><b>Agente propõe → quem tem permissão aprova → o executor do painel faz</b></div>
        <div class="vv-rotulo-secao" style="--c:var(--vv-lilas)"><i></i>Camadas de memória</div>
        ${Object.entries(CAMADAS_INFO).filter(([k]) => k !== 'nucleo').map(([k, v]) => `<button type="button" class="vv-cb-camada" data-cerebro-no="${k}" style="--c:${v.cor}"><i></i><span><b>${esc(v.nome)}</b><small>${esc(camadas[k] || '')}</small></span><em>→</em></button>`).join('')}`;
    } else if (id === 'clientes') {
      const lista = [...cli].sort((a, b) => b.itens - a.itens || b.total - a.total);
      corpo = `<div class="vv-cb-legenda">${Object.entries(ORIGEM_NOME).map(([k, v]) => `<span><i style="background:${ORIGEM_COR[k]}"></i>${esc(v)}</span>`).join('')}</div>
        ${lista.map((c) => `<div class="vv-cb-cliente"><button type="button" class="vv-cb-cliente-nome" data-abrir-no="${esc(c.nome)}"><b>${esc(c.nome)}</b><small>${c.itens ? c.itens + ' coisas que o VYBES sabe' : 'ainda sem estudo próprio'} · ${c.total} em aberto</small>${barraOrigens(c.origens)}</button>
          ${typeof abrirModalCerebroCliente === 'function' ? `<button type="button" class="vv-botao" data-cerebro-cliente="${esc(c.nome)}">Sinapses</button>` : ''}</div>`).join('')}`;
    } else if (id === 'agentes') {
      corpo = `<div id="vv-cerebro-agentes">${agentesCerebroHtml(ags)}</div>`;
    } else if (id === 'trabalho') {
      const sits = ['atrasada', 'aprovar', 'hoje', 'fazer'];
      const todas = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL.map((d) => situacaoDaPeca(d)) : [];
      corpo = `<div class="vv-contagens">${sits.map((k) => `<div style="--f:var(--sit-${k}-f);--t:var(--sit-${k}-t)"><b>${todas.filter((x) => x === k).length}</b><small>${esc((SITUACOES.find(([q]) => q === k) || [, k])[1])}</small></div>`).join('')}</div>`;
    }
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button>
      <small class="vv-cb-kicker">Cérebro do VYBES</small><h3>${esc(info.nome)}</h3>
      <div class="vv-cb-nav">${nav}</div>
      <p class="vv-sub">${esc(info.texto)}</p>
      <div class="vv-cb-fato"><small>Onde mora</small><b>${esc(info.mora)}</b></div>
      ${corpo}`;
    p.hidden = false; ajustarAreaLivre();
  }
  function mostrarCerebroPlaca() { mostrarNoDoCerebro('nucleo'); }
  // Cérebro de cada agente: com o que pensa, o que lembra e como decide.
  const MEMORIA_DO_ANDAR = {
    terreo: 'Todas as camadas: é o orquestrador.', comercial: 'Clientes ativos, empresas de Irecê (CRM), propostas comerciais e conversas de atendimento.',
    criacao: 'Identidade, paleta e regras da DA de cada cliente; banco de ideias; produção e alterações.', financeiro: 'Contratos, cobranças e o que o cliente consome.',
    tecnologia: 'Automações, integrações e o histórico do que rodou.', estrategia: 'Performance, mídia paga e aprendizados de cada conta.', terraco: 'A equipe: salas, presença e conversa.',
  };
  function cerebroDoAgenteHtml(a, s) {
    const decide = { ativo: 'Age dentro do que foi liberado e registra o que fez.', sombra: 'Aprende e propõe; uma pessoa aprova antes de qualquer ação.', planejado: 'Ainda não ligado: a sala está pronta.' }[s.estado] || '';
    return `<div class="vv-rotulo-secao" style="--c:var(--vv-lilas)"><i></i>Cérebro do agente</div>
      <div class="vv-cb-fato"><small>Pensa com</small><b>${esc(MODELO)}, como o VYBES</b></div>
      <div class="vv-cb-fato"><small>Lembra</small><b>${esc(MEMORIA_DO_ANDAR[a.id] || 'O que o setor dele usa.')}</b></div>
      <div class="vv-cb-fato"><small>Decide</small><b>${esc(decide)}</b></div>`;
  }
  // ---------- Equipe: o que era o saguão do Escritório, agora no mundo ----------
  // As funções são as do Escritório (mesmas janelas, mesmas regras); só a porta mudou.
  const EQUIPE_ACOES = [
    ['conversa', 'Conversa da equipe', "alternarAbaEscritorio('conversa',true)"],
    ['recados', 'Recados', 'abrirRecadosEscritorio()'],
    ['missoes', 'Missões do dia', 'abrirMissoesPeloLobbyEscritorio()'],
    ['ranking', 'Ranking da semana', "abrirRankingEscritorio('geral','semana')"],
    ['conquistas', 'Conquistas', 'abrirConquistasEscritorio()'],
    ['inventario', 'Inventário', "abrirCatalogoEscritorio('inventario')"],
    ['catalogo', 'Catálogo (loja)', 'abrirCatalogoEscritorio()'],
    ['espaco', 'Meu personagem', 'personalizarEscritorio()'],
  ];
  function mostrarEquipe() {
    const p = placa(), gente = presencaDoEscritorio(), Z = mundo.zonasDoPredio || {};
    const saldo = (typeof escritorio !== 'undefined' && escritorio?.base?.economia?.saldo) ?? null;
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button>
      <h3>Equipe</h3><p class="vv-sub">Quem está onde no prédio, e o que era o saguão do Escritório.</p>
      ${saldo !== null ? `<div class="vv-coins"><b>${Number(saldo).toLocaleString('pt-BR')}</b><span>VybeCoins</span></div>` : ''}
      <div class="vv-rotulo-secao" style="--c:var(--sit-pronta)"><i></i>Online agora<span class="vv-pilula">${gente.length}</span></div>
      ${gente.length ? gente.map((g) => { const z = Z[g.zona]; return `<div class="vv-zona"><span><b>${esc(g.nome)}</b><small>${z ? esc(z.nome) : 'Fora das salas'}</small></span>${z ? `<button type="button" class="vv-botao" data-entrar-zona="${esc(g.zona)}">Ir até</button>` : ''}</div>`; }).join('') : '<p class="vv-dica">Ninguém online agora.</p>'}
      ${(() => { const time = (typeof escritorio !== 'undefined' && escritorio?.base?.equipe) || []; return time.length ? `<div class="vv-rotulo-secao" style="--c:var(--vv-lilas)"><i></i>Perfis do time<span class="vv-pilula">${time.length}</span></div>
      <div class="vv-time">${time.map((t) => `<button type="button" class="vv-pessoa" data-perfil="${esc(t.id)}"><b>${esc(String(t.nome || '').split(' ')[0])}</b><small>${esc(String(t.nome || '').split(' ').slice(1, 2).join(' '))}</small></button>`).join('')}</div>` : ''; })()}
      <div class="vv-rotulo-secao" style="--c:var(--vv-laranja)"><i></i>Do Escritório</div>
      <div class="vv-grade-acoes">${EQUIPE_ACOES.filter(([, , f]) => typeof window[f.split('(')[0]] === 'function').map(([id, nome, f]) => `<button type="button" class="vv-acao-equipe" data-equipe="${id}">${esc(nome)}</button>`).join('')}</div>`;
    p.hidden = false; ajustarAreaLivre();
  }
  // Perfil = a ficha completa que o Escritório já tinha (resumo, meta da semana, ganhos, como ganhar,
  // conquistas, inventário e a aba Trabalho com os números). Mesmos dados e regras de quem vê o quê.
  // Com "Ver como" escolhido, abre o perfil daquela pessoa.
  function idDoEscritorio(idPainel) {
    const b = typeof escritorio !== 'undefined' ? escritorio.base : null; if (!b || !idPainel) return '';
    const p = (b.equipe || []).find((x) => String(typeof escritorioIdNasDemandas === 'function' ? escritorioIdNasDemandas(x) : x.id) === String(idPainel));
    return p ? String(p.id) : '';
  }
  function abrirPerfil(idEscritorio) {
    const b = typeof escritorio !== 'undefined' ? escritorio.base : null;
    if (!b || typeof abrirFichaEscritorio !== 'function') { if (typeof showToast === 'function') showToast('O perfil ainda está carregando. Tente de novo em instantes.', 'info', 3000); return; }
    const id = idEscritorio || idDoEscritorio(verComo) || b.eu;
    abrirFichaEscritorio(id);
  }
  // A ficha no mundo: boneco voxel num palco claro (no lugar da sala do Habbo); "ir para o quarto" leva
  // à sala da pessoa no Prédio; a pintura de piso e paredes do Habbo some (a sala agora é voxel).
  function ajustarFicha() {
    const d = document.getElementById('office-ficha'); if (!d || !ligado) return;
    const palco = d.querySelector('.ofc-hud-palco');
    if (palco && !palco.querySelector('.vv-perfil-avatar')) {
      const id = palco.querySelector('[data-pessoa]')?.dataset.pessoa;
      const p = (escritorio?.base?.equipe || []).find((x) => String(x.id) === String(id));
      const fig = p?.perfil?.figura;
      if (fig) (modAvatar ? Promise.resolve(modAvatar) : import(MUNDO_JS)).then((m) => { modAvatar = m; if (palco.querySelector('.vv-perfil-avatar')) return; const img = new Image(); img.className = 'vv-perfil-avatar'; img.alt = ''; img.src = m.avatarVoxel(fig, { direcao: 3 }); palco.append(img); }).catch(() => {});
    }
    d.querySelectorAll('.ofc-ficha-acoes button').forEach((b) => {
      const on = b.getAttribute('onclick') || '';
      if (on.includes('abrirEstiloSalaEscritorio')) b.hidden = true;
      if (on.includes('escritorioIrParaAmbiente') && !b.dataset.vv) { b.dataset.vv = '1'; b.textContent = /meu quarto/.test(b.textContent) ? 'Ir para a minha sala' : 'Ir até a sala'; }
    });
  }
  const fichaObs = new MutationObserver(() => ajustarFicha());
  const vigiarFicha = () => { const d = document.getElementById('office-ficha'); if (d && !d.dataset.vvVigia) { d.dataset.vvVigia = '1'; fichaObs.observe(d, { childList: true }); ajustarFicha(); } };
  setInterval(vigiarFicha, 1500);
  function desviarIdaAoQuarto() {
    if (desviarIdaAoQuarto.feito || typeof window.escritorioIrParaAmbiente !== 'function') return;
    desviarIdaAoQuarto.feito = true;
    const irOriginal = window.escritorioIrParaAmbiente;
    // A ida de verdade (move a pessoa e a voz). Antes o desvio chamava irParaSalaEscritorio, que chamava de novo
    // escritorioIrParaAmbiente (este desvio): andava em círculo e a pessoa nunca saía do lugar.
    moverParaSala.original = irOriginal;
    window.escritorioIrParaAmbiente = function (id, ...r) {
      const z = ligado && mundo?.zonasDoPredio?.[id];
      if (!z) return irOriginal.call(this, id, ...r);
      irParaSala(id);
    };
  }
  setInterval(desviarIdaAoQuarto, 2000); desviarIdaAoQuarto();
  function usarEquipe(id) {
    const a = EQUIPE_ACOES.find((x) => x[0] === id); if (!a) return;
    // Conversa e recados moram na coluna do Escritório: abre o Escritório (motor) com a aba certa.
    try { new Function(a[2])(); } catch (e) { console.error('[mundo] equipe', e); }
  }

  // ---------- Jogos: as mesas do Escritório (sala Jogos, no terraço) ----------
  // A partida é da mesa (o servidor guarda a partida pela sala e pelo móvel): o mundo leva a pessoa
  // até a sala Jogos (voz e presença do Escritório) e abre a mesa daquele jogo, pela mesma função de sempre.
  const JOGOS = [
    ['sinuca', 'Sinuca', 'Sinuca de boteco, com mira e física.', 'ESCRITORIO_SINUCA', 'abrirSinucaEscritorio'],
    ['xadrez', 'Xadrez', 'Partida contra alguém da equipe.', 'ESCRITORIO_XADREZ', 'abrirXadrezEscritorio'],
    ['poker', 'Pôquer', 'Texas hold’em valendo VybeCoins ou de graça.', 'ESCRITORIO_POKER', 'abrirPokerEscritorio'],
    ['mesa', 'Mesa de Jogos', 'Dominó, dama, velha e truco.', 'ESCRITORIO_DOMINO', 'abrirMesaDeJogosEscritorio'],
  ];
  function mostrarJogos() {
    const p = placa();
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button>
      <h3>Jogos</h3><p class="vv-sub">As mesas ficam na sala Jogos, no terraço do prédio. Escolha o jogo: você vai até a mesa e chama quem estiver online.</p>
      <div class="vv-jogos">${JOGOS.map(([id, nome, txt]) => `<button type="button" class="vv-jogo" data-jogo="${id}"><b>${esc(nome)}</b><small>${esc(txt)}</small></button>`).join('')}</div>
      <p class="vv-dica">Ranking, Missões e Conquistas ficam em Equipe.</p>`;
    p.hidden = false; ajustarAreaLivre();
  }
  let jogandoAgora = false;
  async function abrirJogo(id) {
    const j = JOGOS.find((x) => x[0] === id); if (!j) return;
    if (typeof escritorio === 'undefined' || typeof irParaSalaEscritorio !== 'function') return;
    if (escritorio.base?.demo) { if (typeof escritorioAviso === 'function') escritorioAviso('A demonstração não tem partidas.'); return; }
    jogandoAgora = true;
    try {
      // Direto no jogo (Paulo, 06/11/2026: "não precisa pôr a sala"): o motor vai à sala Jogos por baixo,
      // sem mostrar nada; a janela do jogo abre por cima do mundo.
      sincronizar();
      // A mesa vem do quarto de verdade: na sala Jogos com o mapa sem desenho, monta o quarto real agora.
      quartoRealNosJogos = true;
      if (escritorio.zona === 'jogos' && escritorio.mapa?.semDesenho) { escritorio.mapa = null; chamar('renderEscritorio'); }
      if (escritorio.zona !== 'jogos' || !escritorio.mapa) irParaSalaEscritorio('jogos');
      const t0 = Date.now();
      while ((escritorio.zona !== 'jogos' || !escritorio.mapa) && Date.now() - t0 < 10000) await new Promise((r) => setTimeout(r, 250));
      // As regras de cada mesa (constantes do Escritório, que não ficam em window).
      const REGRAS = { ESCRITORIO_SINUCA: typeof ESCRITORIO_SINUCA !== 'undefined' ? ESCRITORIO_SINUCA : null, ESCRITORIO_XADREZ: typeof ESCRITORIO_XADREZ !== 'undefined' ? ESCRITORIO_XADREZ : null,
        ESCRITORIO_POKER: typeof ESCRITORIO_POKER !== 'undefined' ? ESCRITORIO_POKER : null, ESCRITORIO_DOMINO: typeof ESCRITORIO_DOMINO !== 'undefined' ? ESCRITORIO_DOMINO : null };
      const re = REGRAS[j[3]];
      // Os móveis da sala chegam depois da troca de cena (mapa.prontos): espera e procura de novo.
      try { await Promise.race([escritorio.mapa?.prontos, new Promise((r) => setTimeout(r, 6000))]); } catch { /* segue procurando */ }
      let mesa = null;
      for (let k = 0; k < 12 && !mesa; k++) {
        mesa = escritorio.mapa?.moveisPerto?.(movimento.x, movimento.y, 99)?.find((m) => re && re.test(m.classe)) || null;
        if (!mesa) await new Promise((r) => setTimeout(r, 400));
      }
      if (!mesa) { if (typeof escritorioAviso === 'function') escritorioAviso('Não achei essa mesa na sala Jogos.'); return; }
      window[j[4]](mesa);
      // O mundo volta atrás da janela do jogo (o motor fica na sala Jogos).
      setTimeout(() => { if (!document.getElementById('mode-gate')?.classList.contains('open') && !andarAberto) chamar('openModeGate'); }, 300);
    } finally { setTimeout(() => { jogandoAgora = false; sincronizar(); }, 1500); }
  }

  // Ferramentas do cabeçalho antigo (busca, avisos, notas, aparência, conta), à mão também no mundo.
  // Mesmas funções do cabeçalho; avisos e conta abrem no módulo, onde a caixa deles mora.
  // Menu da conta no topo do mapa: o que antes só existia no cabeçalho antigo (Atualizar, Diário,
  // IA & Custos, Sair) e o "Recado para todos" dos sócios.
  function alternarMenuConta() {
    let m = hud.querySelector('.vv-menu-conta');
    if (m) { m.remove(); return; }
    const admin = typeof souAdmin === 'function' && souAdmin(), dono = souDono();
    m = document.createElement('div'); m.className = 'vv-menu-conta'; m.setAttribute?.('role', 'menu');
    const item = (acao, texto, sub, cls = '') => `<button type="button" role="menuitem" class="${cls}" data-conta-acao="${acao}"><b>${texto}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
    m.innerHTML = item('conta', 'Minha conta', 'perfil, senha e equipe')
      + item('atualizar', 'Atualizar dados', 'busca de novo a produção e os clientes')
      + (admin || dono ? item('diario', 'Diário de produção', 'fotos do estado de cada dia') + item('ia', 'IA & Custos', 'uso e custo dos modelos') : '')
      + (dono ? item('recado', 'Recado para todos', 'aparece na tela de toda a equipe') : '')
      + '<hr>' + item('sair', 'Sair', '', 'perigo');
    hud.querySelector('.vv-barra-topo')?.after?.(m);
    m.addEventListener?.('click', (e) => {
      const b = e.target.closest('[data-conta-acao]'); if (!b) return;
      const a = b.dataset.contaAcao; m.remove();
      const quadro = (id) => { chamar('chooseManagerMode'); setTimeout(() => { const btn = document.getElementById('btn-board-' + id); if (btn) chamar('switchBoard', id, btn); }, 250); };
      if (a === 'conta') chamar('irParaMinhaConta');
      else if (a === 'atualizar') { chamar('refreshData'); }
      else if (a === 'diario') quadro('diario');
      else if (a === 'ia') quadro('ai-usage');
      else if (a === 'recado') chamar('abrirMandarAvisoEscritorio');
      else if (a === 'sair') chamar('sairDaSessao');
    });
    setTimeout(() => document.addEventListener('click', function fora(e) { if (!e.target.closest('.vv-menu-conta, [data-ferr="conta"]')) { m.remove(); document.removeEventListener('click', fora); } }), 0);
  }
  function alternarMenuTema() {
    let m = hud.querySelector('.vv-menu-tema');
    hud.querySelector('.vv-menu-conta')?.remove();
    if (m) { m.remove(); return; }
    const atual = temaEscolhido();
    m = document.createElement('div'); m.className = 'vv-menu-conta vv-menu-tema'; m.setAttribute?.('role', 'menu');
    const op = (t, titulo, sub, ic) => `<button type="button" role="menuitemradio" aria-checked="${atual === t}" data-tema="${t}"><i aria-hidden="true">${ic}</i><span><b>${titulo}</b><small>${sub}</small></span></button>`;
    m.innerHTML = `<div class="vv-tema-titulo">Aparência</div>`
      + op('claro', 'Claro', 'papel claro, o padrão', '☀') + op('escuro', 'Escuro', 'para a noite e salas escuras', '☾') + op('auto', 'Automático', 'segue o seu computador', '◐')
      + '<hr><button type="button" data-tema="mais"><span><b>Mais ajustes</b><small>vidro, movimento e o mundo nos módulos</small></span></button>';
    hud.querySelector('.vv-barra-topo')?.after?.(m);
    m.addEventListener?.('click', (e) => {
      const b = e.target.closest('[data-tema]'); if (!b) return;
      if (b.dataset.tema === 'mais') { m.remove(); document.querySelector('[data-open-appearance]')?.click(); return; }
      trocarTema(b.dataset.tema); m.querySelectorAll('[data-tema]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    setTimeout(() => document.addEventListener('click', function fora(e) { if (!e.target.closest('.vv-menu-tema, [data-ferr="aparencia"]')) { m.remove(); document.removeEventListener('click', fora); } }), 0);
  }
  function usarFerramenta(id) {
    if (id !== 'ajuda') window.VybeTutorial?.dica?.('ferr:' + id);
    if (id === 'busca') document.querySelector('[data-open-spotlight]')?.click();
    else if (id === 'aparencia') alternarMenuTema();
    else if (id === 'camadas') mostrarCamadas();
    else if (id === 'notas') chamar('abrirNotas');
    else if (id === 'ajuda') window.VybeTutorial?.ajuda?.();
    else if (id === 'conversa') { if (window.VybeConversa?.aberto?.()) window.VybeConversa.fechar(); else window.VybeConversa?.abrir?.('conversa'); }
    else if (id === 'conta') { hud.querySelector('.vv-menu-tema')?.remove(); alternarMenuConta(); }
    else if (id === 'avisos') { chamar('chooseManagerMode'); setTimeout(() => chamar('alternarNotificacoes'), 350); }
  }
  setInterval(() => {
    const n = Number(document.getElementById('notif-contador')?.textContent || 0), el = hud.querySelector('#vv-badge-avisos');
    if (el) { el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n); }
  }, 3000);

  function mostrarCliente(nome) {
    const c = naTela.find((x) => x.nome === nome) || clientesDoMundo().find((x) => x.nome === nome); if (!c) return;
    const p = placa();
    const quadros = [['atrasada', 'atrasadas'], ['hoje', 'saem hoje'], ['aprovar', 'p/ aprovar'], ['fazer', 'a fazer']];
    const base = mundo?.acharNaBase?.(c.nome);
    const chave = norm(c.nome).toLowerCase();
    const pecas = (typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : [])
      .filter((d) => { const cl = typeof clientesDoItem === 'function' ? clientesDoItem(d) : [d.cliente]; return cl.some((x) => norm(x).toLowerCase() === chave) && situacaoDaPeca(d) !== 'concluida'; })
      .map((d) => ({ d, sit: situacaoDaPeca(d), ref: d.veiculacao_iso || d.prazo_iso || '' }))
      .sort((a, b) => (a.sit === 'atrasada' ? 0 : 1) - (b.sit === 'atrasada' ? 0 : 1) || (a.ref || '9').localeCompare(b.ref || '9'));
    const cnpj = base?.cnpj ? base.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button>
      <h3>${typeof tagClienteHtml === 'function' ? tagClienteHtml(c.nome, { dentroDeBotao: true }) : esc(c.nome)}</h3>
      <p class="vv-sub">${esc(c.segmento || 'Cliente ativo')} · ${c.total} peça${c.total === 1 ? '' : 's'} em aberto</p>
      ${base ? `<div class="vv-cb-fato"><small>Endereço (base de CNPJ)</small><b>${esc(base.endereco || '')}${base.bairro ? ' · ' + esc(base.bairro) : ''}</b><small style="text-transform:none;letter-spacing:0;margin-top:3px">${esc(base.razao || '')}${cnpj ? ' · CNPJ ' + esc(cnpj) : ''}${!['rua', 'numero'].includes(base.onde) ? ' · posição aproximada' : ''}</small></div>`
        : '<div class="vv-cb-fato"><small>Endereço</small><b>Não achei na base de CNPJ pelo nome. Ficou num lote perto da agência.</b></div>'}
      <div class="vv-contagens">${quadros.map(([k, r]) => `<div style="--f:var(--sit-${k}-f);--t:var(--sit-${k}-t)"><b>${c.por[k] || 0}</b><small>${r}</small></div>`).join('')}</div>
      ${pecas.length ? `<div class="vv-rotulo-secao" style="--c:${c.cor}"><i></i>Em aberto<span class="vv-pilula">${pecas.length}</span></div>${pecas.slice(0, 8).map((x) => linhaDemanda(x.d, { ref: x.ref, sit: x.sit })).join('')}` : ''}
      <div class="vv-acoes-cliente"><button type="button" class="vv-botao acao" data-abrir-cliente="${esc(c.nome)}">Abrir o cliente →</button>
      ${typeof abrirModalCerebroCliente === 'function' ? `<button type="button" class="vv-botao" data-cerebro-cliente="${esc(c.nome)}">Sinapses do cérebro</button>` : ''}</div>${window.VybeClientePlaca?.html(c.nome) || ''}`;
    p.hidden = false; ajustarAreaLivre(); window.VybeClientePlaca?.ligar(p); window.VybeTutorial?.dica?.('cliente');
    mundo?.focarCliente(nome);
  }
  function fecharPlaca() { placa().hidden = true; ajustarAreaLivre(); }

  hud.addEventListener('click', (e) => {
    const b = e.target.closest('button, tr[data-agente]'); if (!b) return;
    // Andar aberto por baixo dos HUDs: outro andar no elevador entra nele; trocar de vista, voltar à lista
    // de andares, fechar o painel ou ir a outro lugar do trilho sai do andar (decorando, a edição decide).
    if (andarAberto && !window.VybeDecorar?.aberto?.()) {
      if (b.dataset.andar && b.dataset.andar !== andarAbertoId) abrirAndarVoxel(b.dataset.andar);
      else if (b.dataset.vista || b.dataset.ctl === 'tudo' || b.hasAttribute('data-voltar') || ['centro', 'predio', 'agentes', 'jogos'].includes(b.dataset.trilho)) fecharAndarVoxel(false);
    }
    if (selecionarSemana(b)) return;
    if (b.dataset.atencaoCliente) { mostrarPendencias(b.dataset.atencaoCliente); return; }
    if (b.dataset.gargalo) { mostrarPendencias('', b.dataset.gargalo); return; }
    if (b.dataset.hojeAcao) { acaoDoHoje(b.dataset.hojeAcao, b.dataset.valor); return; }
    // O menu, as ferramentas e as placas funcionam sem o 3D; só vista, controles, andares e o mapa do CRM precisam dele.
    if (b.dataset.trilho) { usarTrilho(b.dataset.trilho, b); return; }
    if (!mundo && (b.dataset.vista || b.dataset.ctl || b.dataset.andar || b.dataset.crmVer || b.hasAttribute('data-voltar'))) return;
    if (b.dataset.ferr) { usarFerramenta(b.dataset.ferr); return; }
    if (b.dataset.visaoHoje) { trocarVisaoHoje(b.dataset.visaoHoje); return; }
    if (b.dataset.abrirGestao !== undefined) { abrirGestao(b.dataset.abrirGestao || ''); return; }
    if (b.dataset.hojeAcao) { acaoDoHoje(b.dataset.hojeAcao, b.dataset.valor); return; }
    if (b.dataset.vista) {
      window.VybeTutorial?.dica?.('vista:' + b.dataset.vista);
      hud.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      body.classList.toggle('mundo-cerebro', b.dataset.vista === 'cerebro');
      body.classList.toggle('mundo-predio', b.dataset.vista === 'predio');
      if (b.dataset.vista === 'cerebro') ligarCerebro(); else mundo.cerebro(false);
      if (b.dataset.vista === 'predio') { mundo.verPredio(); mostrarAndares(); }
      else if (b.dataset.vista === 'cerebro') mostrarCerebroPlaca();
      else { mundo.verCidade(); fecharPlaca(); }
    } else if (b.dataset.ctl) {
      ({ mais: () => mundo.zoom(.7), menos: () => mundo.zoom(1.4), girar: () => mundo.girar90(), tudo: () => { mundo.verCidade(); fecharPlaca(); } })[b.dataset.ctl]();
    } else if (b.dataset.andar) mostrarAndar(b.dataset.andar);
    else if (b.hasAttribute('data-voltar')) mostrarAndares();
    else if (b.hasAttribute('data-fechar')) fecharPlaca();
    else if (b.dataset.modulo) abrirModulo(JSON.parse(b.dataset.modulo));
    else if (b.dataset.abrirNo) mostrarCliente(b.dataset.abrirNo);
    else if (b.dataset.equipe) usarEquipe(b.dataset.equipe);
    else if (b.dataset.cerebroNo) mostrarNoDoCerebro(b.dataset.cerebroNo);
    else if (b.dataset.cerebroCliente) { const nome = b.dataset.cerebroCliente; chamar('chooseClientMode'); setTimeout(() => { window.VybeTutorial?.dica?.('cerebro-cliente'); try { abrirModalCerebroCliente(nome); } catch (e) { console.error('[mundo] cérebro do cliente', e); } }, 450); }
    else if (b.dataset.agente) { const [an, se] = b.dataset.agente.split('|'); mundo?.cerebro(false); hud.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.vista === 'predio'))); mostrarAgente(an, se); }
    else if (b.dataset.perfil) abrirPerfil(b.dataset.perfil);
    else if (b.dataset.crmMais !== undefined) { crmPagina++; crmRepintar(); }
    else if (b.dataset.crmAce !== undefined) { crmAce = !crmAce; crmPagina = 1; crmRepintar(); }
    else if (b.dataset.crmVer) { const [x, z] = b.dataset.crmVer.split(',').map(Number); mundo.focarPonto(x, z); }
    else if (b.hasAttribute('data-crm-recarregar') || b.hasAttribute('data-crm-pagina')) {
      crmErro = ''; b.disabled = true;
      crmCarregar(b.hasAttribute('data-crm-pagina'), b.hasAttribute('data-crm-recarregar')).catch(e => { crmErro = e.message; crmRepintar(); });
    }
    else if (b.hasAttribute('data-crm-fechar')) { crmDetalhe = null; crmRepintar(); }
    else if (b.dataset.crmDetalhe || b.dataset.crmHistorico) {
      const id = b.dataset.crmDetalhe || crmDetalhe?.oportunidade.id; if (!id) return;
      b.disabled = true;
      crmPedido(null, '&id=' + encodeURIComponent(id) + '&historico_pagina=' + (b.dataset.crmHistorico || 1)).then(d => { crmDetalhe = d; crmErro = ''; crmRepintar(); }).catch(e => { crmErro = e.message; crmRepintar(); });
    }
    else if (b.dataset.crmMover && crmDetalhe) crmExecutar({ acao: 'mover', id: crmDetalhe.oportunidade.id, de_etapa: crmDetalhe.oportunidade.etapa, etapa: b.dataset.crmMover }, b);
    else if (b.dataset.crmPropor || b.dataset.crmIncluir) {
      const chave = b.dataset.crmPropor || b.dataset.crmIncluir;
      const l = crmLinhas.find(x => (x.cnpj || x.nome) === chave); if (!l) return;
      crmExecutar({ acao: 'criar', cnpj: l.cnpj || '', nome: l.nome, setor_empresa: l.setor || '', etapa: b.dataset.crmPropor ? 'abordagem_proposta' : 'empresa' }, b);
    }
    else if (b.dataset.jogo) abrirJogo(b.dataset.jogo);
    else if (b.dataset.agente) { const [an, se] = b.dataset.agente.split('|'); mostrarAgente(an, se); }
    else if (b.dataset.entrarAndar) abrirAndarVoxel(b.dataset.entrarAndar);
    else if (b.hasAttribute('data-sair-andar')) sairDoAndar();
    else if (b.dataset.legado) {
      const e = typeof escritorio !== 'undefined' ? escritorio : null;
      if (b.dataset.legado === 'ficha' && e?.base) chamar('abrirFichaEscritorio', e.base.eu);
      else if (b.dataset.legado === 'conquistas') chamar('abrirConquistasEscritorio');
      else if (b.dataset.legado === 'missoes') { if (window.VybeMissoes?.abrir) window.VybeMissoes.abrir('missoes'); else chamar('showToast', 'Missões chegando nesta versão.', 'info'); }
    }
    else if (b.dataset.entrarZona) irParaSala(b.dataset.entrarZona);
    else if (b.hasAttribute('data-agenda-recolher')) { const ag = hud.querySelector('#vv-agenda'); const fechada = ag.classList.toggle('recolhida'); b.setAttribute('aria-expanded', String(!fechada)); }
    else if (b.hasAttribute('data-abrir-agenda')) abrirAgenda();
    else if (b.dataset.agendaDia) abrirAgenda(b.dataset.agendaDia);
    else if (b.dataset.abrirCliente) {
      const nome = b.dataset.abrirCliente;
      abrirModulo({ tipo: 'modo', alvo: 'clientes' });
      setTimeout(() => { if (typeof abrirClienteDetalhe === 'function') abrirClienteDetalhe(nome); }, 120);
    }
  });

  function pintarClientes(forcar = false) {
    if (!mundo) return;
    const lista = clientesDoMundo();
    const assinatura = lista.map((c) => `${c.nome}:${c.total}:${c.situacao}:${(c.status || []).map((s) => s.nome + s.n).join(',')}`).join('|');
    if (!forcar && assinatura === ultimaAssinatura) return;
    ultimaAssinatura = assinatura; naTela = lista;
    mundo.definirClientes(lista, { aoClicar: (alvo) => mostrarCliente(alvo.nome) });
    mundo.alertaVybes(lista.some((c) => c.situacao === 'atrasada'));
  }

  async function carregar() {
    if (mundo || carregando || erroCarga) return carregando;
    const avisoCarga = raiz.querySelector('.mundo-carregando');
    if (avisoCarga) { avisoCarga.hidden = false; avisoCarga.textContent = 'Montando o Centro…'; }
    carregando = (async () => {
      const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches || body.dataset.motion === 'reduce';
      const m = await import(MUNDO_JS + (tentativasCarga ? '?tentativa=' + tentativasCarga : ''));
      mundo = await m.iniciarMundo(raiz.querySelector('canvas'), { reduzirMovimento: reduzir, quantos: clientesDoMundo().length });
      if (!fonteAgentes) criarFonte(mundo);
      void carregarAgentes();
      setTimeout(() => aplicarProspeccao(), 1500);
      mundo.aoClicar((alvo) => {
        if (!alvo) return;
        if (alvo.tipo === 'setor') { hud.querySelector('[data-vista="predio"]')?.setAttribute('aria-pressed', 'true'); hud.querySelector('[data-vista="cidade"]')?.setAttribute('aria-pressed', 'false'); mostrarAgente(alvo.andar, alvo.setor); }
        else if (alvo.tipo === 'cliente') mostrarCliente(alvo.nome);
        else if (alvo.tipo === 'vybes') mostrarAgente('terreo', 'orquestrador');
        else if (alvo.tipo === 'cerebro') mostrarNoDoCerebro(alvo.no);
        else if (alvo.tipo === 'zona') abrirAndarVoxel(alvo.andar);
        else if (alvo.tipo === 'andar') mostrarAndar(alvo.andar);
      });
      mundo.aoPassar((alvo, e) => {
        const c = cartao();
        if (!alvo || alvo.tipo === 'vybes') { c.hidden = true; return; }
        let html = '';
        if (alvo.tipo === 'cliente') {
          const cli = naTela.find((x) => x.nome === alvo.nome); if (!cli) { c.hidden = true; return; }
          html = `<b>${esc(cli.nome)}</b><small>${esc(cli.segmento || 'Cliente ativo')} · ${cli.total} em aberto</small>${SITUACOES.filter(([k]) => cli.por[k]).map(([k, r]) => `<span class="vv-selo" style="--e:${COR[k]};margin:0 4px 4px 0"><i></i>${cli.por[k]} ${esc(r.toLowerCase())}</span>`).join('')}`;
        } else if (alvo.tipo === 'zona') {
          const z = mundo.zonasDoPredio?.[alvo.zona]; if (!z) { c.hidden = true; return; }
          const aqui = presencaDoEscritorio().filter((p) => p.zona === alvo.zona);
          html = `<b>${esc(z.nome)}</b><small>${aqui.length ? esc(aqui.map((p) => p.nome.split(' ')[0]).join(', ')) + ' aqui agora' : 'Ninguém agora'}</small>`;
        } else if (alvo.tipo === 'setor') {
          const a = mundo.planta.find((x) => x.id === alvo.andar), s = a?.setores.find((x) => x.id === alvo.setor); if (!s) { c.hidden = true; return; }
          html = `<b>${esc(s.nome)}</b><small>${esc(a.nome)}${s.agente ? ' · agente ' + esc(s.agente) : ''}</small>${s.agente ? seloAgente(s.id) : ''}`;
          const m = motivoDoAndar(a); if (m.motivo) html += `<span class="vv-selo vv-motivo-andar" style="--e:${m.cor}"><i></i>${esc(m.motivo)}</span>`;
        } else if (alvo.tipo === 'andar') {
          const a = mundo.planta.find((x) => x.id === alvo.andar); if (!a) { c.hidden = true; return; }
          const m = motivoDoAndar(a);
          html = `<b>${a.nivel === 0 ? 'Térreo' : a.id === 'terraco' ? 'Terraço' : a.nivel + 'º andar'} · ${esc(a.nome)}</b><span class="vv-selo vv-motivo-andar" style="--e:${m.cor}"><i></i>${esc(m.motivo || 'Sem leitura agora.')}</span>`;
        }
        c.innerHTML = html + '<span class="clique">Clique para abrir</span>';
        c.style.left = Math.min(innerWidth - 296, e.clientX + 16) + 'px'; c.style.top = Math.min(innerHeight - 160, e.clientY + 16) + 'px';
        c.hidden = false;
      });
      raiz.querySelector('canvas').addEventListener('pointerleave', () => { cartao().hidden = true; });
      if (typeof CADASTRO_CLIENTES !== 'undefined' && !CADASTRO_CLIENTES.length && typeof ensureClientMasterSources === 'function') {
        try { await ensureClientMasterSources(); } catch { /* sem cadastro: os nomes das peças servem */ }
      }
      pintarClientes(true);
      observarPresenca(); pintarPresenca(); void carregarAgentes();
      ajustarAreaLivre();
      sincronizar();
      if (avisoCarga) avisoCarga.hidden = true;
    })().catch((erro) => {
      erroCarga = true; carregando = null;
      fonteAgentes?.limpar(); fonteAgentes = null;
      mundo?.destruir(); mundo = null; ultimaAssinatura = '';
      const aviso = raiz.querySelector('.mundo-carregando');
      if (aviso) { aviso.hidden = false; aviso.innerHTML = '<span>Não foi possível abrir o mapa. Confira a conexão e tente novamente.</span><button type="button" class="vv-botao" data-mundo-repetir>Tentar novamente</button>'; }
      console.error('[mundo]', erro);
    });
    return carregando;
  }

  // ---------- Avatares voxel no lugar dos bonecos do Habbo (em todo o painel, com o mundo ligado) ----------
  // Toda <img> do imager do Habbo vira o avatar voxel da mesma figura. O dado é o mesmo (perfil.figura);
  // muda só o desenho. Desligado o mundo, nada é trocado.
  let modAvatar = null;
  const HABBO = /^https:\/\/www\.(habbo\.com\/habbo-imaging|habboassets\.com\/imaging)\//;
  async function trocarAvatar(img) {
    if (!ligado || !img || img.dataset.voxel === '1') return;
    const src = img.getAttribute('src') || ''; if (!HABBO.test(src)) return;
    try {
      modAvatar = modAvatar || await import(MUNDO_JS);
      const u = new URL(src), q = u.searchParams;
      const movel = u.pathname.match(/\/imaging\/furniture\/([^/]+?)\.png$/);
      if (movel) {
        const lado = Number(q.get('size')) || 64, ic = modAvatar.iconeMovel(decodeURIComponent(movel[1]), lado, lado);
        img.dataset.voxel = '1'; img.dataset.habbo = src; img.src = ic.toDataURL(); img.classList.add('avatar-voxel'); return;
      }
      const url = modAvatar.avatarVoxel(q.get('figure') || '', { cabeca: q.get('headonly') === '1', direcao: q.get('direction') || 2 });
      img.dataset.voxel = '1'; img.dataset.habbo = src; img.src = url; img.classList.add('avatar-voxel');
    } catch (e) { console.error('[mundo] avatar', e); }
  }
  function trocarAvataresEm(raiz) { (raiz.querySelectorAll ? raiz.querySelectorAll('img') : []).forEach(trocarAvatar); if (raiz.tagName === 'IMG') trocarAvatar(raiz); }
  new MutationObserver((ms) => { if (!ligado) return; for (const m of ms) { if (m.type === 'attributes') { if (m.target.dataset.voxel === '1' && HABBO.test(m.target.getAttribute('src') || '')) m.target.dataset.voxel = ''; trocarAvatar(m.target); } else m.addedNodes.forEach((n) => n.nodeType === 1 && trocarAvataresEm(n)); } })
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });

  // Móveis: o Escritório desenha toda arte de móvel do Habbo por mapaDesenharMovel (ícones de sala,
  // loja, inventário, troféus, baú…). Com o mundo ligado, o mesmo desenho sai como ícone voxel do
  // mesmo tipo, no mesmo tamanho e posição; o resto do Escritório não percebe a troca.
  const classeDoMovel = new WeakMap();
  function ligarIconesVoxel() {
    if (ligarIconesVoxel.feito || typeof window.mapaDesenharMovel !== 'function' || typeof window.mapaCarregarMovel !== 'function') return;
    ligarIconesVoxel.feito = true;
    const carregar = window.mapaCarregarMovel, desenhar = window.mapaDesenharMovel;
    window.mapaCarregarMovel = function (classe) { const pr = carregar.apply(this, arguments); pr?.then?.((m) => { if (m?.dados) classeDoMovel.set(m.dados, classe); }).catch(() => {}); return pr; };
    window.mapaDesenharMovel = function (m) {
      const d = desenhar.apply(this, arguments);
      try {
        const classe = m?.dados && classeDoMovel.get(m.dados);
        if (ligado && modAvatar && classe && d?.canvas) {
          const ic = modAvatar.iconeMovel(classe, d.canvas.width, d.canvas.height), ctx = d.canvas.getContext('2d');
          ctx.clearRect(0, 0, d.canvas.width, d.canvas.height); ctx.drawImage(ic, 0, 0);
        }
      } catch (e) { /* sem ícone voxel, fica o desenho de antes */ }
      return d;
    };
    // Móveis já carregados antes da troca e artes já prontas: registra e refaz.
    try { if (typeof MAPA_MOVEIS !== 'undefined') for (const [classe, pr] of MAPA_MOVEIS) pr?.then?.((m) => m?.dados && classeDoMovel.set(m.dados, classe)).catch(() => {}); } catch {}
    try { if (typeof ESCRITORIO_ARTES_PRONTAS !== 'undefined') ESCRITORIO_ARTES_PRONTAS.clear(); if (typeof escritorio !== 'undefined') { escritorio.copaArte = ''; escritorio.bauArte = ''; } } catch {}
  }

  // Loja com o catálogo voxel da Vybe: as peças próprias primeiro, com nome e categoria novos; o acervo
  // antigo continua (quem tem, não perde) numa categoria própria. Compra e inventário seguem pela classe.
  function ligarCatalogoVoxel() {
    if (ligarCatalogoVoxel.feito || typeof window.carregarCatalogoEscritorio !== 'function') return;
    ligarCatalogoVoxel.feito = true;
    const original = window.carregarCatalogoEscritorio;
    const traduzir = () => {
      if (!ligado || !modAvatar?.CATALOGO || typeof escritorioCatalogo === 'undefined' || !Array.isArray(escritorioCatalogo) || escritorioCatalogo.voxel) return;
      const proprias = new Map(modAvatar.CATALOGO.map((p) => [p.classe, p]));
      // Só o nome das peças próprias muda (categoria e classe ficam: os filtros da Loja dependem delas).
      const novo = escritorioCatalogo.map((it) => { const p = proprias.get(it.classe); return p ? { ...it, nome: p.nome, vybeCategoria: p.categoria, voxel: true } : it; });
      novo.voxel = true;
      escritorioCatalogo = novo;
      // Seção "Catálogo Vybe" no topo da Loja, com uma subcategoria por grupo de peça voxel.
      try {
        if (typeof ESCRITORIO_SECOES_CATALOGO !== 'undefined' && !ESCRITORIO_SECOES_CATALOGO.some(([t]) => t === 'Catálogo Vybe')) {
          const subs = [...new Set(modAvatar.CATALOGO.map((p) => p.categoria))].map((c) => 'Vybe · ' + c);
          for (const c of subs) ESCRITORIO_GRUPOS_CATALOGO.push([c, (m) => m.voxel && 'Vybe · ' + m.vybeCategoria === c]);
          ESCRITORIO_SECOES_CATALOGO.splice(1, 0, ['Catálogo Vybe', subs]);
          if (typeof ESCRITORIO_SECOES_LOJA !== 'undefined') ESCRITORIO_SECOES_LOJA.unshift(['Catálogo Vybe', 'estrela']);
          if (typeof ESCRITORIO_PRATELEIRAS_LOJA !== 'undefined') ESCRITORIO_PRATELEIRAS_LOJA.unshift(...subs);
        }
      } catch (e) { console.error('[mundo] catálogo', e); }
    };
    window.carregarCatalogoEscritorio = async function () { const r = await original.apply(this, arguments); traduzir(); return r; };
    traduzir();
  }

  // Chave do modo na Aparência (existe nos dois modos): troca entre Irecity e legado depois do login.
  // A chave "Modo Irecity" saiu da Aparência: não existe mais modo legado para escolher.
  function chaveNaAparencia() {
    return;
    const d = document.querySelector('dialog.appearance-dialog'); if (!d || d.querySelector('#appearance-irecity') || semWebGL) return;
    const lab = document.createElement('label'); lab.className = 'appearance-check';
    lab.innerHTML = '<input id="appearance-irecity" type="checkbox">Modo Irecity (Irecê ao vivo)';
    d.querySelector('.appearance-done')?.before(lab);
    const c = lab.querySelector('input'); c.checked = ligado;
    c.addEventListener('change', () => { ligar(c.checked); if (c.checked && typeof openModeGate === 'function') setTimeout(() => openModeGate(), 200); });
    d.addEventListener('toggle', () => { c.checked = ligado; });
  }
  chaveNaAparencia(); if (typeof setTimeout === 'function') setTimeout(chaveNaAparencia, 1500);

  // ---------- Barra de chamada: quem está na sala com você, microfone, chamar e sair ----------
  // A voz é a do Escritório de sempre (ouve quem está na mesma sala; Foco é silenciosa; sala trancada tem
  // conversa própria). A barra só mostra e controla isso no Irecity.
  const barra = document.createElement('div');
  barra.className = 'vv-chamada'; barra.hidden = true; barra.setAttribute?.('role', 'region'); barra.setAttribute?.('aria-label', 'Chamada da sala');
  hud.append?.(barra);
  // Altura real da barra (com a música ela pode ir para duas linhas): o player e o aviso de planejamento
  // sobem junto, para nada cobrir a barra (regra do Paulo: nada cobre, nada rola).
  // Mede quando o conteúdo muda (MutationObserver não depende de a página estar desenhando) e quando a largura muda.
  function medirBarra() { document.body?.style?.setProperty?.('--vv-voz-alto', (barra.hidden ? 0 : Math.round(barra.offsetHeight)) + 'px'); }
  if (typeof MutationObserver === 'function') new MutationObserver(medirBarra).observe(barra, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  if (typeof ResizeObserver === 'function') new ResizeObserver(medirBarra).observe(barra);
  let chamarAberto = false, pessoaAberta = null;
  const primeiro = (n) => String(n || '?').split(' ')[0];
  const iniciais = (n) => String(n || '?').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const fn = (nome) => (typeof window[nome] === 'function' ? window[nome] : null);
  const IC = {
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    micOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M9 9v2a3 3 0 0 0 5 2M15 10V6a3 3 0 0 0-6 0M5 11a7 7 0 0 0 11 5.7M19 11a7 7 0 0 1-.6 2.8M12 18v3"/></svg>',
    musica: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    tela: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    chamar: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/></svg>',
    sair: '<svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
  };
  // Leva a pessoa até uma sala do Escritório sem sair do Irecity (a voz segue a sala).
  // A conversa acompanha a sala, preservando a escolha de mute. Uma porta recusada não altera o microfone.
  function irParaSala(zona) {
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    if (!zona) return;
    moverParaSala(zona);
    let focou = false;
    const focar = () => { if (!focou && e?.zona === zona) { focou = true; void focarSalaDaChamada(zona); } };
    focar();
    if (e?.zona === zona) e.vozPausada = false;
    const geracaoVoz = e?.geracaoVoz || 0;
    setTimeout(() => { if (e?.zona === zona && (e.geracaoVoz || 0) === geracaoVoz) { e.vozPausada = false; fn('escritorioConversaAutomatica')?.(); focar(); } pintarChamada(); }, 700);
    setTimeout(() => { if (e?.zona === zona && (e.geracaoVoz || 0) === geracaoVoz && !e.vozPausada) fn('escritorioSincronizarVoz')?.(); pintarChamada(); }, 2500);
  }
  window.vybesIrParaSala = irParaSala;
  function minhaSalaDaConta() {
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    if (e?.base?.eu == null) return '';
    return e.base.salas?.find((s) => s.pessoa_id != null && String(s.pessoa_id) === String(e.base.eu))?.id || '';
  }
  async function focarSalaDaChamada(zona) {
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    if (!mundo && carregando) await carregando;
    const z = mundo?.zonasDoPredio?.[zona]; if (!z || e?.zona !== zona) return;
    const vez = ++focoSala;
    try {
      if (body.classList.contains('mundo-modulo')) chamar('voltarAoMenu');
      await abrirAndarVoxel(z.andar);
      if (vez === focoSala && e.zona === zona) andarAberto?.focarSala(zona);
    } catch (erro) { fn('escritorioAviso')?.('Você entrou na sala, mas não foi possível abrir o andar. Tente novamente.'); console.error('[mundo] sala da chamada', erro); }
  }
  // Move a pessoa (e a voz) para a sala sem trocar a tela: a função original do Escritório, guardada antes do desvio.
  function moverParaSala(zona) {
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    const mover = moverParaSala.original || (typeof window.escritorioIrParaAmbiente === 'function' ? window.escritorioIrParaAmbiente : null);
    if (e?.mapa && mover) { mover.call(window, zona); return; }
    fn('irParaSalaEscritorio')?.(zona);
  }
  // A janela de ajustes de áudio nasce dentro da tela do Escritório (que fica embaixo do mapa): traz para cima.
  async function abrirAjustesAudio() {
    await fn('abrirAjustesAudioEscritorio')?.();
    const el = document.getElementById('office-ajustes-audio');
    if (el && el.parentElement !== document.body) { el.classList.add('vv-flutuante'); document.body.append(el); }
  }
  function pintarChamada() {
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    // A voz continua dentro dos módulos (como no Discord): lá a barra fica compacta.
    const ver = ligado && !body.classList.contains('auth-pending') && Boolean(e);
    const antes = barra.hidden; barra.hidden = !ver;
    if (!ver) return;
    if (antes) window.VybeTutorial?.dica?.('chamada');
    const Z = mundo?.zonasDoPredio || {}, eu = String(e.base?.eu || '');
    const nomeZona = (z) => Z[z]?.nome || (z ? (fn('escritorioAmbienteDoQuarto')?.(z)?.nome || 'Sala') : 'Recepção');
    const outros = (e.online || []).filter((o) => String(o.id) !== eu);
    if (!e.conectado) {
      const outraAba = Boolean(e.emOutraAba || fn('escritorioOutraAbaConectada')?.());
      if (!outraAba && !e.conectando && e.base && !e.base.demo && !pintarChamada.tentou && fn('conectarEscritorio')) {
        pintarChamada.tentou = true;
        if (e.microfoneQuer === undefined) e.microfoneQuer = false; // entra calado; liga o microfone quando quiser falar
        fn('conectarEscritorio')();
      }
      pintarChamada.ultimo = '';
      barra.innerHTML = outraAba
        ? `<span class="sala off"><i></i><b>Voz aberta em outra aba</b><small>Só uma aba fica na chamada, para não ouvir em dobro</small></span><button type="button" class="vv-botao" data-chamada="assumir">Usar nesta aba</button>`
        : e.conectando || (pintarChamada.tentou && (pintarChamada.vezes || 0) < 3)
          ? `<span class="sala off"><i></i><b>Conectando às salas…</b><small>Já já você vê quem está em cada sala</small></span>`
          : `<span class="sala off"><i></i><b>Fora das salas de voz</b><small>Entre para falar e ver quem está em cada sala</small></span><button type="button" class="vv-botao" data-chamada="reconectar">Entrar</button>`;
      // Não conectou: tenta de novo sozinho até 3 vezes (a cada 20 s); depois fica o botão Entrar.
      if (pintarChamada.tentou && !e.conectando && !outraAba && (pintarChamada.vezes = (pintarChamada.vezes || 0) + (pintarChamada.agendado ? 0 : 1)) < 3 && !pintarChamada.agendado) { pintarChamada.agendado = true; setTimeout(() => { pintarChamada.agendado = false; if (!e.conectado && !e.conectando) pintarChamada.tentou = false; }, 20000); }
      return;
    }
    const canal = fn('escritorioCanal')?.(e.zona);
    const naChamada = Boolean(!e.vozPausada && e.conectado && canal && e.chamada && e.canalChamada === canal);
    const juntos = outros.filter((o) => o.zona && o.zona === e.zona);
    const mic = Boolean(e.chamada?.self?.audioEnabled), cam = Boolean(e.chamada?.self?.videoEnabled);
    const falando = fn('escritorioPessoasFalando')?.() || new Set();
    const tela = Boolean(e.chamada?.self?.screenShareEnabled);
    const minhaSala = minhaSalaDaConta();
    const estado = fn('escritorioEstadoVozTexto')?.() || (naChamada ? 'Na conversa da sala' : 'Sem voz aqui');
    const temSom = Boolean(fn('escritorioNaPista')?.());
    const salas = {}; for (const o of outros) if (o.zona && o.zona !== e.zona) (salas[o.zona] ||= []).push(o);
    const pessoa = pessoaAberta && outros.find((o) => String(o.id) === pessoaAberta);
    const participantes = new Set((naChamada ? fn('escritorioOuvindo')?.(e.chamada) || [] : []).map((p) => String(p.customParticipantId || '').split(':')[0]));
    const naVoz = juntos.filter((o) => participantes.has(String(o.id))).length;
    const foraDaVoz = juntos.length - naVoz;
    const ouvem = (naVoz ? `${naVoz} ${naVoz === 1 ? 'pessoa na chamada' : 'pessoas na chamada'}` : 'só você na chamada') + (foraDaVoz ? ` · ${foraDaVoz} na sala, fora da chamada` : '');
    const html = `<span class="sala${naChamada ? ' on' : ''}"><i></i><b>${esc(nomeZona(e.zona))}</b><small>${naChamada && !mic && juntos.length ? '<b class="mudo">Você está mudo</b> · toque no microfone para falar' : esc(estado) + (naChamada ? ' · ' + ouvem : '')}</small></span>
      <span class="gente">${juntos.slice(0, 7).map((o) => `<button type="button" class="p${falando.has(String(o.id)) ? ' fala' : ''}" data-pessoa="${esc(o.id)}" data-voz-pessoa="${esc(o.id)}" title="${esc(o.nome)}">${esc(iniciais(o.nome))}</button>`).join('')}${juntos.length > 7 ? `<span class="mais">+${juntos.length - 7}</span>` : ''}</span>
      ${musicaHtml(e, temSom)}
      <span class="acoes">
        <button type="button" class="vv-botao" data-chamada="minha-sala" ${minhaSala ? '' : 'disabled'} title="Entrar na minha sala">Minha sala</button>
        ${e.vozPausada && canal ? '<button type="button" class="vv-botao" data-chamada="entrar-voz">Entrar na chamada</button>' : ''}
        <button type="button" class="vv-botao ic${mic ? ' on' : ''}${naChamada && !mic && juntos.length ? ' chama' : ''}" data-chamada="mic" aria-pressed="${mic}" ${naChamada ? '' : 'disabled'} title="${naChamada ? (mic ? 'Desligar o microfone' : 'Ligar o microfone') : 'Entre numa sala com voz para falar'}">${mic ? IC.mic : IC.micOff}</button>
        <button type="button" class="vv-botao ic" data-chamada="ajustes" title="Ajustes de áudio: microfone, saída, ruído e teste">${IC.ajustes}</button>
        <button type="button" class="vv-botao ic" data-chamada="musica" ${temSom ? '' : 'disabled'} title="${temSom ? 'Música da sala (todos ouvem junto)' : 'Esta sala não tem aparelho de som (o Lounge tem)'}">${IC.musica}</button>
        <button type="button" class="vv-botao ic${cam ? ' on' : ''}" data-chamada="camera" aria-pressed="${cam}" ${naChamada || cam ? '' : 'disabled'} title="${cam ? 'Desligar a câmera' : naChamada ? 'Ligar a câmera' : 'Entre numa sala com voz para usar a câmera'}">${IC.camera}</button>
        <button type="button" class="vv-botao ic${tela ? ' on' : ''}" data-chamada="tela" aria-pressed="${tela}" ${naChamada || tela ? '' : 'disabled'} title="${tela ? 'Parar de mostrar a tela' : 'Mostrar minha tela'}">${IC.tela}</button>
        <button type="button" class="vv-botao ic" data-chamada="tv" ${e.zona ? '' : 'disabled'} title="TV da sala: passar um vídeo do YouTube">TV</button>
        <button type="button" class="vv-botao ic" data-chamada="chamar" aria-expanded="${chamarAberto}" title="Salas de voz: quem está em cada sala; entrar, ir até alguém ou chamar">${IC.chamar}</button>
        ${!e.vozPausada && (e.chamada || e.entrandoChamada) ? `<button type="button" class="vv-botao ic sair" data-chamada="sair" title="Sair da chamada">${IC.sair}</button>` : ''}
      </span>
      ${pessoa ? `<div class="vv-chamar vv-pessoa"><b>${esc(pessoa.nome)}</b><small>${esc(nomeZona(pessoa.zona))}</small>
        ${pessoa.zona !== e.zona ? `${pessoa.zona ? `<button type="button" class="vv-botao" data-ir-sala="${esc(pessoa.zona)}">Ir para a sala de ${esc(primeiro(pessoa.nome))}</button>` : ''}<button type="button" class="vv-botao" data-chamar-pessoa="${esc(pessoa.id)}">Chamar para cá</button>` : '<p class="vv-dica">Está na mesma sala que você.</p>'}</div>` : ''}
      ${chamarAberto && !pessoa ? salasDeVozHtml({ e, Z, outros, falando, nomeZona }) : ''}`;
    // A barra se atualiza a cada 1,5 s (quem fala, quem entrou). Só redesenha se mudou algo, e guarda a rolagem
    // da lista de salas (antes ela voltava para o topo enquanto a pessoa rolava).
    if (html === pintarChamada.ultimo) return;
    const lista = barra.querySelector('.vv-chamar'), rolagem = lista ? lista.scrollTop : 0;
    barra.innerHTML = html; pintarChamada.ultimo = html;
    const nova = barra.querySelector('.vv-chamar'); if (nova && rolagem) nova.scrollTop = rolagem;
  }
  // Salas de voz, como no Discord: todas as salas do prédio por andar, quem está em cada uma (acende quem fala),
  // cadeado nas trancadas; clicar entra na sala e na conversa dela, sem sair do mapa.
  // Música da sala na barra (como o player do Escritório): o que toca, anterior/tocar-pausar/próxima,
  // silenciar só para você e a fila. Vale também dentro dos módulos.
  function musicaHtml(e, temSom) {
    const m = e?.musica, f = m?.fila?.[m.indice];
    if (!temSom || !f) return '';
    let titulo = ''; try { titulo = e.player?.getVideoData?.()?.title || ''; } catch { /* sem player ainda */ }
    const muda = Boolean(fn('escritorioMusicaMuda')?.());
    return `<span class="vv-musica${m.tocando ? ' tocando' : ''}"><i aria-hidden="true">♪</i><span class="t"><b>${esc(titulo || (f.kind === 'playlist' ? 'Playlist da sala' : 'Música da sala'))}</b><small>${m.tocando ? 'Tocando' : 'Pausada'} · ${m.indice + 1} de ${m.fila.length}${f.por ? ' · de ' + esc(primeiro(f.por)) : ''}</small></span>
      <button type="button" data-musica="anterior" ${m.indice > 0 ? '' : 'disabled'} title="Anterior" aria-label="Anterior">⏮</button><button type="button" data-musica="${m.tocando ? 'pausar' : 'tocar'}" title="${m.tocando ? 'Pausar para a sala' : 'Tocar'}" aria-label="${m.tocando ? 'Pausar' : 'Tocar'}">${m.tocando ? '⏸' : '▶'}</button><button type="button" data-musica="proxima" ${m.indice < m.fila.length - 1 ? '' : 'disabled'} title="Próxima" aria-label="Próxima">⏭</button><button type="button" data-musica="mudo" aria-pressed="${muda}" title="${muda ? 'Voltar a ouvir' : 'Silenciar só para você'}" aria-label="Silenciar só para você">${muda ? '🔈' : '🔇'}</button></span>`;
  }
  function salasDeVozHtml({ e, Z, outros, falando, nomeZona }) {
    const planta = mundo?.planta || [], porAndar = new Map();
    for (const [id, z] of Object.entries(Z)) { const k = z.andar || 'outros'; if (!porAndar.has(k)) porAndar.set(k, []); porAndar.get(k).push([id, z]); }
    const nomeAndar = (k) => { const a = planta.find((x) => x.id === k); return a ? (a.nivel === 0 ? 'Térreo' : a.id === 'terraco' ? 'Terraço' : a.nivel + 'º andar') + ' · ' + a.nome.replace(/^Terraço · /, '') : 'Outras salas'; };
    const ordem = [...porAndar.keys()].sort((x, y) => (planta.find((a) => a.id === y)?.nivel ?? -1) - (planta.find((a) => a.id === x)?.nivel ?? -1));
    const eu = { id: String(e.base?.eu || ''), nome: 'Você' };
    const trancas = e.trancas instanceof Map ? e.trancas : new Map();
    const linha = ([id, z]) => {
      const aqui = outros.filter((o) => o.zona === id), minha = e.zona === id, tranc = trancas.has(id);
      const gente = [...(minha ? [eu] : []), ...aqui];
      return `<button type="button" class="vv-voz-sala${minha ? ' minha' : ''}${gente.length ? ' com-gente' : ''}" data-ir-sala="${esc(id)}" ${minha ? 'aria-current="true"' : ''} title="${minha ? 'Você está aqui' : 'Entrar nesta sala e na conversa dela'}">
        <span class="ic" aria-hidden="true">${tranc ? '🔒' : '🔊'}</span>
        <span class="meio"><b>${esc(z.nome || nomeZona(id))}</b>${gente.length ? `<span class="gente">${gente.map((o) => `<i data-voz-pessoa="${esc(o.id)}" class="${falando.has(String(o.id)) ? 'fala' : ''}" title="${esc(o.nome)}">${esc(o.id === eu.id ? 'EU' : iniciais(o.nome))}</i>`).join('')}</span>` : '<small>vazia</small>'}</span>
        ${minha ? '<em>aqui</em>' : '<em>Entrar</em>'}</button>`;
    };
    const fora = outros.filter((o) => !o.zona || !Z[o.zona]);
    return `<div class="vv-chamar vv-salas-voz">
      <div class="vv-voz-topo"><b>Salas de voz</b><small>${outros.length + 1} online · clique numa sala para entrar</small></div>
      ${ordem.map((k) => `<div class="vv-rotulo-secao"><i></i>${esc(nomeAndar(k))}</div>${porAndar.get(k).map(linha).join('')}`).join('')}
      <div class="vv-rotulo-secao"><i></i>Pessoas online</div>
      ${outros.length ? outros.map((o) => `<div class="vv-voz-pessoa"><span data-voz-pessoa="${esc(o.id)}" class="av${falando.has(String(o.id)) ? ' fala' : ''}">${esc(iniciais(o.nome))}</span><span class="meio"><b>${esc(o.nome)}</b><small>${esc(o.zona && Z[o.zona] ? Z[o.zona].nome : nomeZona(o.zona))}</small></span>
        ${o.zona && o.zona !== e.zona ? `<button type="button" class="vv-botao" data-ir-sala="${esc(o.zona)}">Ir até</button>` : ''}${o.zona !== e.zona ? `<button type="button" class="vv-botao" data-chamar-pessoa="${esc(o.id)}">Chamar</button>` : '<small class="junto">com você</small>'}</div>`).join('') : '<p class="vv-dica">Ninguém mais online agora.</p>'}
      ${fora.length ? `<p class="vv-dica">${fora.length} na recepção ou fora das salas.</p>` : ''}
    </div>`;
  }
  barra.addEventListener?.('click', (ev) => {
    const b = ev.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.musica) {
      const a = b.dataset.musica;
      if (a === 'mudo') fn('silenciarMusicaEscritorio')?.(); else fn('controleMusicaEscritorio')?.(a);
      pintarChamada.ultimo = ''; setTimeout(pintarChamada, 300); return;
    }
    const c = b.dataset.chamada;
    if (c === 'mic') fn('alternarMidiaEscritorio')?.('audio')?.finally?.(pintarChamada);
    else if (c === 'ajustes') abrirAjustesAudio();
    else if (c === 'musica') fn('abrirMusicaEscritorio')?.();
    else if (c === 'tela') fn('alternarMidiaEscritorio')?.('screen')?.finally?.(() => { pintarChamada(); trazerProPalco(); });
    else if (c === 'camera') fn('alternarMidiaEscritorio')?.('video')?.finally?.(pintarChamada);
    else if (c === 'tv') fn('abrirTvEscritorio')?.(typeof escritorio !== 'undefined' ? escritorio.tvAtual || null : null);
    else if (c === 'reconectar') { const e = typeof escritorio !== 'undefined' ? escritorio : null; pintarChamada.tentou = true; (e?.base ? fn('conectarEscritorio') : fn('abrirEscritorio'))?.(); setTimeout(pintarChamada, 1500); } // a mesma entrada do botão "Entrar no escritório"
    else if (c === 'assumir') { fn('trazerEscritorioParaEstaAba')?.(); setTimeout(pintarChamada, 1500); }
    else if (c === 'chamar') { chamarAberto = !chamarAberto; pessoaAberta = null; pintarChamada(); }
    else if (c === 'sair') { fn('sairChamadaEscritorio')?.({ manual: true })?.finally?.(() => { pintarChamada(); trazerProPalco(); }); chamarAberto = false; pintarChamada(); }
    else if (c === 'entrar-voz') { const e = typeof escritorio !== 'undefined' ? escritorio : null; if (e) { e.vozPausada = false; fn('escritorioConversaAutomatica')?.(); void focarSalaDaChamada(e.zona); pintarChamada(); } }
    else if (c === 'minha-sala') { const sala = minhaSalaDaConta(); if (sala) irParaSala(sala); }
    else if (b.dataset.pessoa) {
      pessoaAberta = pessoaAberta === b.dataset.pessoa ? null : b.dataset.pessoa; chamarAberto = false;
      const e = typeof escritorio !== 'undefined' ? escritorio : null;
      const pessoa = pessoaAberta && e?.online?.find((p) => String(p.id) === pessoaAberta);
      if (pessoa?.zona && pessoa.zona === e.zona) void focarSalaDaChamada(pessoa.zona);
      pintarChamada();
    }
    else if (b.dataset.irSala) { irParaSala(b.dataset.irSala); chamarAberto = false; pessoaAberta = null; }
    else if (b.dataset.chamarPessoa) { fn('chamarParaSalaEscritorio')?.(b.dataset.chamarPessoa); chamarAberto = false; pessoaAberta = null; pintarChamada(); }
  });
  if (typeof setInterval === 'function') setInterval(pintarChamada, 1500);

  // ---------- Palco do Irecity: vídeos da chamada, TV da sala e recado rápido ----------
  // O Escritório desenha isso dentro da tela dele, que no Irecity fica escondida. Aqui eles sobem:
  // os vídeos (câmera e tela compartilhada) num palco que só aparece quando há vídeo; a TV numa janela
  // flutuante; o recado rápido como cartão no canto, com o botão de responder abrindo a conversa.
  const palco = document.createElement('section');
  palco.className = 'vv-palco'; palco.setAttribute?.('aria-label', 'Vídeos da chamada');
  palco.innerHTML = '<div class="vv-palco-topo"><b>Na chamada</b><button type="button" data-palco="parar" hidden>Parar de mostrar</button><button type="button" data-palco="cheia" aria-label="Ampliar vídeos em tela cheia">Ampliar</button><button type="button" data-palco="min" aria-label="Recolher os vídeos" aria-expanded="true">–</button></div>';
  document.body.append?.(palco);
  palco.addEventListener?.('click', async (ev) => {
    const b = ev.target.closest('[data-palco]'); if (!b) return;
    if (b.dataset.palco === 'min') { const recolhido = palco.classList.toggle('recolhido'); b.setAttribute('aria-expanded', String(!recolhido)); b.setAttribute('aria-label', recolhido ? 'Mostrar os vídeos' : 'Recolher os vídeos'); b.textContent = recolhido ? '+' : '–'; }
    else if (b.dataset.palco === 'parar') { if (typeof escritorio !== 'undefined' && escritorio.chamada?.self?.screenShareEnabled) await fn('alternarMidiaEscritorio')?.('screen'); pintarChamada(); trazerProPalco(); }
    else if (b.dataset.palco === 'cheia') {
      try { if (document.fullscreenElement === palco) await document.exitFullscreen(); else if (palco.requestFullscreen) await palco.requestFullscreen(); else fn('escritorioAviso')?.('Use o controle do vídeo para ampliar a tela.'); }
      catch { fn('escritorioAviso')?.('Não foi possível ampliar o vídeo. Tente pelo controle do vídeo.'); }
    }
  });
  function trazerProPalco() {
    if (!ligado) return;
    // Espelho dos vídeos: o palco liga os próprios <video> ao mesmo MediaStream (mover o contêiner da
    // chamada pausaria o áudio das vozes, que mora junto).
    const media = document.getElementById('office-call-media');
    const e = typeof escritorio !== 'undefined' ? escritorio : null, canal = fn('escritorioCanal')?.();
    const naChamada = Boolean(!e?.vozPausada && e?.conectado && canal && e.chamada && e.canalChamada === canal);
    const originais = (naChamada ? [...(media?.querySelectorAll('video') || [])] : []).filter((v) => v.srcObject);
    palco.querySelector('[data-palco="parar"]').hidden = !e?.chamada?.self?.screenShareEnabled;
    const atuais = new Set(originais.map((v) => v.srcObject));
    palco.querySelectorAll('video').forEach((v) => { if (!atuais.has(v.srcObject)) v.closest('.vv-palco-video')?.remove(); });
    for (const v of originais) {
      if ([...palco.querySelectorAll('video')].some((x) => x.srcObject === v.srcObject)) continue;
      const caixa = document.createElement('figure'); caixa.className = 'vv-palco-video';
      const nome = v.closest('.office-call-pessoa')?.querySelector('b')?.textContent || '';
      const novo = document.createElement('video'); novo.autoplay = true; novo.playsInline = true; novo.muted = true; novo.controls = true; novo.srcObject = v.srcObject;
      caixa.append(novo); if (nome) { const f = document.createElement('figcaption'); f.textContent = nome; caixa.append(f); }
      palco.append(caixa); novo.play?.().catch(() => {});
    }
    palco.classList.toggle('com-video', originais.length > 0);
    for (const id of ['office-tv', 'office-recado-rapido']) {
      const el = document.getElementById(id);
      if (el && el.parentElement !== document.body) { el.classList.add('vv-flutuante-ofc'); document.body.append(el); }
    }
    const rr = document.getElementById('office-recado-rapido');
    if (rr && !rr.dataset.vv) { rr.dataset.vv = '1'; rr.addEventListener('click', (ev) => { const b = ev.target.closest('[data-vv-responder]'); if (b) { window.VybeConversa?.abrir?.('recados', b.dataset.vvResponder); rr.remove(); } }); }
  }
  if (typeof setInterval === 'function') setInterval(trazerProPalco, 800);

  // ---------- Esc fecha o que está por cima; módulo com "tela cheia" e "fechar" ----------
  const cantoModulo = document.createElement('div');
  cantoModulo.className = 'vv-canto-modulo';
  cantoModulo.innerHTML = `<button type="button" class="vv-botao" data-modulo-acao="cheia" title="Tela cheia (F)" aria-label="Tela cheia"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
    <button type="button" class="vv-botao" data-modulo-acao="fechar" title="Fechar e voltar ao mapa (Esc)" aria-label="Fechar e voltar ao mapa"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
  document.body.append?.(cantoModulo);
  const alternarTelaCheia = () => { body.classList.toggle('mundo-tela-cheia'); cantoModulo.querySelector('[data-modulo-acao="cheia"]')?.setAttribute('aria-pressed', String(body.classList.contains('mundo-tela-cheia'))); };
  const fecharModulo = () => { body.classList.remove('mundo-tela-cheia'); chamar('voltarAoMenu'); };
  cantoModulo.addEventListener?.('click', (e) => { const b = e.target.closest('[data-modulo-acao]'); if (!b) return; if (b.dataset.moduloAcao === 'cheia') alternarTelaCheia(); else fecharModulo(); });
  // Janelas por cima do módulo (briefing, cartão, menus, notificações, busca…): o Esc é delas.
  const POR_CIMA = 'dialog[open], .brief-overlay, #cartao-rapido, .cartao-rapido-fundo, #workflow-modal, #workflow-backdrop, .workspace-drawer.open, #workspace-drawer.open, #notif-caixa, #quem-sou-menu, #notas-janela, details.header-utilities[open] > .header-utilities-menu, .owner-editor, [class*="-overlay"], [class*="-modal"]:not(body)';
  const visivel = (el) => { if (!el.getClientRects?.().length) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > .05; };
  const janelaPorCima = () => [...document.querySelectorAll(POR_CIMA)].filter((el) => !el.closest('#mundo-hud, #mundo') && visivel(el)).pop() || null;
  const FECHAR_JANELA = '[data-fechar], .brief-fechar, [aria-label="Fechar"], [aria-label="Fechar janela"], .modal-close, .fechar, .close, [onclick*="fechar"], [onclick*="close"]';
  let janelaNoEsc = null;
  // Captura: anota a janela aberta ANTES que o Esc dela rode (senão o Esc fecharia a janela e o módulo juntos).
  window.addEventListener?.('keydown', (e) => { if (e.key === 'Escape') janelaNoEsc = janelaPorCima(); }, true);
  document.addEventListener?.('keydown', (e) => {
    if (!ligado || body.classList.contains('auth-pending')) return;
    const campo = e.target?.closest?.('input, textarea, select, [contenteditable="true"]');
    if (e.key === 'f' && !campo && !e.metaKey && !e.ctrlKey && !e.altKey && body.classList.contains('mundo-modulo')) { alternarTelaCheia(); return; }
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (campo) { campo.blur(); return; }
    if (janelaNoEsc) { // a janela de cima fecha com o próprio Esc; se não fechou, aperta o X dela
      const jan = janelaNoEsc; janelaNoEsc = null;
      setTimeout(() => { if (visivel(jan)) (jan.querySelector(FECHAR_JANELA) || (jan.matches('details > *') ? jan.parentElement.querySelector('summary') : null))?.click(); if (jan.tagName === 'DETAILS' || jan.parentElement?.tagName === 'DETAILS') jan.closest('details')?.removeAttribute('open'); }, 0);
      return;
    }
    if (chamarAberto || pessoaAberta) { chamarAberto = false; pessoaAberta = null; pintarChamada(); return; }
    if (andarAberto) { sairDoAndar(); return; }
    if (!placa().hidden) { fecharPlaca(); return; }
    if (hud.querySelector('.vv-menu-conta')) { hud.querySelectorAll('.vv-menu-conta').forEach((x) => x.remove()); return; }
    if (!gestao.hidden) { fecharGestao(); return; }
    if (body.classList.contains('mundo-modulo')) { fecharModulo(); return; }
    const v = hud.querySelector('[data-vista][aria-pressed="true"]');
    if (v && v.dataset.vista !== 'cidade') hud.querySelector('[data-vista="cidade"]')?.click();
  });

  // ---------- Camadas do mapa ----------
  // Clientes, marcos/ruas e captações ligam e desligam as etiquetas; Prospecção mostra as empresas de
  // Irecê que NÃO são clientes, filtradas pelo funil do CRM (sem contato, em contato, sim, não).
  const CAMADAS_CHAVE = 'vybe.mundo.camadas';
  const camadas = (() => { try { return { clientes: true, marcos: true, captacoes: true, prospeccao: 'nenhuma', ...JSON.parse(localStorage.getItem(CAMADAS_CHAVE) || '{}') }; } catch { return { clientes: true, marcos: true, captacoes: true, prospeccao: 'nenhuma' }; } })();
  const ETAPA_COR = { empresa: '#9AA3A8', qualificacao: '#3B9EFF', abordagem_proposta: '#8E7CFF', aprovada: '#7A4FD0', contato_feito: '#FF7A2F', reuniao: '#C2490C', proposta_comercial: '#E2A11B', ganho: '#18A957', perdido: '#D93D42' };
  const ETAPA_NOME = { empresa: 'Empresa', qualificacao: 'Qualificação', abordagem_proposta: 'Abordagem proposta', aprovada: 'Aprovada', contato_feito: 'Contato feito', reuniao: 'Reunião', proposta_comercial: 'Proposta comercial', ganho: 'Sim · virou cliente', perdido: 'Não' };
  const FILTROS_PROS = [['nenhuma', 'Desligada'], ['todas', 'Todas que não são clientes'], ['sem_contato', 'Sem contato ainda'], ['em_contato', 'Em contato (SDR já falou)'], ['sim', 'Disseram sim'], ['nao', 'Disseram não']];
  let crmCache = null, crmEm = 0;
  async function lerCrmTodo() {
    if (crmCache && Date.now() - crmEm < 60e3) return crmCache;
    const todas = []; let pagina = 1, total = Infinity;
    while (todas.length < total && pagina <= 50) {
      const r = await fetch(`/api/painel?area=crm&pagina=${pagina}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) break;
      const d = await r.json(); total = d.total || 0; todas.push(...(d.oportunidades || [])); if (!(d.oportunidades || []).length) break; pagina++;
    }
    crmCache = todas; crmEm = Date.now(); return todas;
  }
  function aplicarCamadasEtiquetas() {
    body.classList.toggle('cam-sem-clientes', !camadas.clientes);
    body.classList.toggle('cam-sem-marcos', !camadas.marcos);
    body.classList.toggle('cam-sem-captacoes', !camadas.captacoes);
  }
  async function aplicarProspeccao() {
    if (!mundo?.mostrarEmpresasNoMapa) return;
    const f = camadas.prospeccao;
    if (f === 'nenhuma') { mundo.mostrarEmpresasNoMapa([]); return; }
    const clientes = naTela.map((c) => norm(c.nome).toLowerCase()).filter((c) => c.length > 3);
    const ehCliente = (e) => { const n = String(e.nome || '').toLowerCase(), r = String(e.razao || '').toLowerCase(); return clientes.some((c) => n === c || n.startsWith(c + ' ') || r.startsWith(c + ' ')); };
    let crm = []; try { crm = await lerCrmTodo(); } catch { /* sem CRM: só a base */ }
    const porCnpj = new Map(crm.filter((o) => o.cnpj).map((o) => [o.cnpj, o])), porNome = new Map(crm.map((o) => [String(o.nome || '').toLowerCase(), o]));
    const EM_CONTATO = new Set(['abordagem_proposta', 'aprovada', 'contato_feito', 'reuniao', 'proposta_comercial']);
    const lista = [];
    for (const e of mundo.empresas || []) {
      if (e.x == null || !mundo.noRecorte(e.x, e.z) || !['rua', 'numero'].includes(e.onde) || ehCliente(e)) continue;
      const o = porCnpj.get(e.cnpj) || porNome.get(String(e.nome || '').toLowerCase()) || null, etapa = o?.etapa || null;
      const ok = f === 'todas' || (f === 'sem_contato' && (!etapa || etapa === 'empresa' || etapa === 'qualificacao')) || (f === 'em_contato' && EM_CONTATO.has(etapa)) || (f === 'sim' && etapa === 'ganho') || (f === 'nao' && etapa === 'perdido');
      if (!ok) continue;
      lista.push({ x: e.x, z: e.z, nome: e.nome, etapa: etapa ? ETAPA_NOME[etapa] : '', cor: ETAPA_COR[etapa] || '#9AA3A8', rotulo: true, distMax: etapa ? 220 : 70, prioridade: etapa ? 2 : -3,
        aoClicar: () => { mostrarAgente('comercial', 'sdr'); setTimeout(() => { const i = placa().querySelector('[data-crm-busca]'); if (i) { i.value = e.nome; i.dispatchEvent(new Event('input', { bubbles: true })); } }, 600); } });
    }
    // Muitos pinos sem contato: os mais perto da Vybe primeiro (o resto aparece quando filtrar o funil).
    const ag = mundo.agencia || { x: 0, z: 0 };
    lista.sort((a, b) => Math.hypot(a.x - ag.x, a.z - ag.z) - Math.hypot(b.x - ag.x, b.z - ag.z));
    mundo.mostrarEmpresasNoMapa(lista.slice(0, 900));
    return lista.length;
  }
  function salvarCamadas() { try { localStorage.setItem(CAMADAS_CHAVE, JSON.stringify(camadas)); } catch { /* sem armazenamento */ } }
  function mostrarCamadas() {
    const p = placa();
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button>
      <small class="vv-cb-kicker">Mapa</small><h3>Camadas</h3>
      <p class="vv-sub">Escolha o que aparece sobre Irecê. A prospecção mostra as empresas que ainda não são clientes, pela etapa do CRM do Qualificador.</p>
      ${[['clientes', 'Clientes', 'Pinos com a situação de cada cliente'], ['marcos', 'Marcos e ruas', 'Prefeitura, praças, avenidas'], ['captacoes', 'Captações', 'Vans da Vybe a caminho dos clientes']].map(([k, n, d]) => `<label class="vv-camada"><input type="checkbox" data-camada="${k}"${camadas[k] ? ' checked' : ''}><span><b>${n}</b><small>${d}</small></span></label>`).join('')}
      <div class="vv-rotulo-secao" style="--c:var(--vv-laranja)"><i></i>Prospecção (CRM)</div>
      <div class="vv-camada-filtros">${FILTROS_PROS.map(([k, n]) => `<button type="button" class="vv-cb-aba${camadas.prospeccao === k ? ' on' : ''}" data-prospeccao="${k}">${n}</button>`).join('')}</div>
      <div class="vv-cb-legenda">${Object.entries(ETAPA_NOME).map(([k, n]) => `<span><i style="background:${ETAPA_COR[k]}"></i>${n}</span>`).join('')}</div>
      <p class="vv-dica" id="vv-camada-conta"></p>`;
    p.hidden = false; ajustarAreaLivre();
  }
  hud.addEventListener('change', (e) => { const c = e.target.closest('[data-camada]'); if (!c) return; camadas[c.dataset.camada] = c.checked; salvarCamadas(); aplicarCamadasEtiquetas(); });
  hud.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-prospeccao]'); if (!b) return;
    camadas.prospeccao = b.dataset.prospeccao; salvarCamadas();
    hud.querySelectorAll('[data-prospeccao]').forEach((x) => x.classList.toggle('on', x === b));
    const conta = hud.querySelector('#vv-camada-conta'); if (conta) conta.textContent = 'Carregando…';
    const n = await aplicarProspeccao();
    if (conta) conta.textContent = camadas.prospeccao === 'nenhuma' ? '' : `${(n || 0).toLocaleString('pt-BR')} empresas neste filtro${n > 900 ? ' (no mapa, as 900 mais perto da Vybe)' : ''}.`;
  });
  aplicarCamadasEtiquetas();

  // ---------- Nada leva ao Escritório antigo no Irecity: o Escritório é o Prédio ----------
  // A aba "Escritório" (a casinha) e o chooseOfficeMode viram o Prédio. Exceção: a mesa de jogo,
  // que usa o motor do Escritório por baixo (jogandoAgora), sem mostrar o desenho antigo.
  function irAoPredio() { if (typeof openModeGate === 'function') openModeGate(); setTimeout(() => usarTrilho('predio'), 250); }
  document.addEventListener('click', (e) => {
    if (!ligado || jogandoAgora) return;
    const b = e.target.closest?.('#btn-board-escritorio,[onclick*="switchBoard(\'escritorio\'"],[onclick*="chooseOfficeMode("],[data-modulo*="escritorio"]');
    if (!b || b.closest('#mundo-hud')) return;
    e.preventDefault(); e.stopImmediatePropagation(); irAoPredio();
  }, true);
  function desviarEscritorio() {
    if (desviarEscritorio.feito || typeof window.chooseOfficeMode !== 'function') return;
    desviarEscritorio.feito = true;
    const original = window.chooseOfficeMode;
    window.chooseOfficeMode = function (...a) { if (ligado && !jogandoAgora) return irAoPredio(); return original.apply(this, a); };
  }
  // Avisos do Escritório (erros de voz, "não achei essa mesa"…) moravam na barra da tela antiga, invisível no
  // Irecity: aqui viram o aviso normal do painel (sem repetir o mesmo texto em menos de 4 s).
  if (typeof window !== 'undefined' && typeof window.escritorioAviso === 'function') {
    const avisoOriginal = window.escritorioAviso; let ultimoAviso = '', quandoAviso = 0;
    window.escritorioAviso = function (texto, ...a) {
      const r = avisoOriginal.call(this, texto, ...a);
      if (ligado && texto && (texto !== ultimoAviso || Date.now() - quandoAviso > 4000)) { ultimoAviso = texto; quandoAviso = Date.now(); chamar('showToast', String(texto), /falh|não |erro|negad|bloque/i.test(texto) ? 'err' : 'info', 5000); }
      return r;
    };
  }
  // Primeiro acesso sem personagem: no Irecity abre o criador novo (o antigo ficava escondido atrás do mundo).
  if (typeof window !== 'undefined' && typeof window.abrirAberturaEscritorio === 'function') {
    const aberturaOriginal = window.abrirAberturaEscritorio;
    window.abrirAberturaEscritorio = function (...a) { if (ligado && window.VybePersonagem?.abrir) return window.VybePersonagem.abrir(); return aberturaOriginal.apply(this, a); };
  }
  // A arte da Vybelândia (abertura e saguão do Escritório antigo, ~0,5 MB) não aparece no Irecity: o mundo é a
  // abertura. Sem a imagem, o navegador nem baixa. No modo legado (?legado=1), tudo como antes.
  if (typeof window !== 'undefined' && typeof window.vybelandiaCenaHtml === 'function') {
    const cenaOriginal = window.vybelandiaCenaHtml;
    window.vybelandiaCenaHtml = function (...a) { return ligado ? '<div class="abr-cena" aria-hidden="true"></div>' : cenaOriginal.apply(this, a); };
  }
  // ---------- Escritório sem desenho no Irecity ----------
  // Paulo, 07/11/2026: "não já mandei tirar o que tava escondido do modo legado que tivesse rodando por trás?".
  // O motor do Escritório fica só com o que o Irecity usa: salas, presença, voz, música e recados. O quarto do
  // Habbo não é mais montado escondido: no lugar do mapa desenhado entra um mapa "sem desenho" (sem canvas, sem
  // a arte do Habbo, sem os sprites dos móveis e dos bonecos, sem as vitrines). Ele responde ao motor com os
  // móveis da sala tirados dos dados que já vieram do servidor (assim a música ainda sabe se a sala tem vitrola).
  // Exceção: o jogo precisa da mesa de verdade na sala Jogos; só aí o quarto real é montado, na hora.
  let quartoRealNosJogos = false;
  function mapaSemDesenho(planta) {
    const moveis = [];
    const pegar = (it) => (Array.isArray(it) ? { classe: String(it[0] || ''), x: Number(it[1]) || 0, y: Number(it[2]) || 0, dir: it[3], origem: it[6] || null } : it && it.classe ? it : null);
    const somar = (lista) => { for (const it of Array.isArray(lista) ? lista : []) { const m = pegar(it); if (m) moveis.push(m); } };
    somar(planta?.moveis); somar(planta?.fixos);
    const perto = (x, y, r = 0) => moveis.filter((m) => Math.abs(m.x - x) <= r + 0.5 && Math.abs(m.y - y) <= r + 0.5);
    const base = {
      semDesenho: true, prontos: Promise.resolve(), camadas: [], imagens: [], editavel: false, pincel: null, tacaLugar: null,
      moveisEm: (x, y) => moveis.filter((m) => Math.floor(m.x) === Math.floor(x) && Math.floor(m.y) === Math.floor(y)),
      moveisPerto: perto,
      moveisDaClasse: (re) => moveis.filter((m) => (re instanceof RegExp ? re.test(m.classe) : m.classe === re)),
      acrescentarMovel: (it) => somar([it]),
      chaveMovel: (m) => m?.chaveFixa || `${m?.classe}@${Math.floor(m?.x)},${Math.floor(m?.y)}`,
      idsNoMapa: () => [], alasDosPostos: () => [], numeroDePostos: () => 0, noDaPessoa: () => null,
      caminho: () => null, assentoEm: () => undefined, bloqueadoEm: () => false, podePassar: () => true, pisoEm: () => null, ladrilhoEm: () => null,
      tela: () => ({ x: -9999, y: -9999 }), medidas: async () => ({ w: 1, h: 1 }),
    };
    // Qualquer outro pedido do motor (desenhar, mover boneco, balão, câmera…) não faz nada.
    return new Proxy(base, { get: (t, k) => (k in t ? t[k] : typeof k === 'symbol' || k === 'then' || k === 'toJSON' ? undefined : () => undefined) });
  }
  window.vybesMapaSemDesenho = mapaSemDesenho; // para os testes
  if (typeof window !== 'undefined' && typeof window.criarMapaEscritorio === 'function') {
    const criarOriginal = window.criarMapaEscritorio;
    window.criarMapaEscritorio = function (el, opcoes, ...r) {
      const e = typeof escritorio !== 'undefined' ? escritorio : null;
      if (e?.quarto !== 'jogos' && !jogandoAgora) quartoRealNosJogos = false;
      const querQuarto = jogandoAgora || (quartoRealNosJogos && e?.quarto === 'jogos');
      if (ligado && !querQuarto && el?.closest?.('#painel-escritorio')) return mapaSemDesenho(opcoes?.planta);
      return criarOriginal.call(this, el, opcoes, ...r);
    };
  }

  // A tela escondida também desenhava o troféu da Copa do saguão e os emblemas de cada sala com a arte do Habbo
  // (um móvel baixado e pintado por sala). No Irecity ninguém vê: não baixa nem pinta. Fora da tela escondida
  // (uma janela que ainda use o emblema), pinta como sempre.
  if (typeof window !== 'undefined' && typeof window.carregarCopaEscritorio === 'function') {
    const copaOriginal = window.carregarCopaEscritorio;
    window.carregarCopaEscritorio = function (...a) { return ligado ? Promise.resolve() : copaOriginal.apply(this, a); };
  }
  if (typeof window !== 'undefined' && typeof window.pintarArtesEscritorio === 'function') {
    const artesOriginal = window.pintarArtesEscritorio;
    window.pintarArtesEscritorio = function (raiz = document, ...a) {
      if (!ligado) return artesOriginal.call(this, raiz, ...a);
      const painel = document.getElementById('painel-escritorio');
      const fora = [...(raiz?.querySelectorAll?.('img.ofc-arte:not(.pronta)') || [])].filter((img) => !painel?.contains?.(img));
      return fora.length ? artesOriginal.call(this, { querySelectorAll: () => fora }, ...a) : Promise.resolve();
    };
  }

  // ---------- Player da música da sala: janela própria do Irecity ----------
  // O player (clipe do YouTube, anterior/tocar/próxima, volume, fila) mora no body, numa janela do Irecity. O
  // Escritório o recolocava na coluna da tela dele a cada redesenho; no Irecity ele recebe só um marcador vazio
  // e o player não sai do lugar (mover o player recarregaria o vídeo e cortaria a música).
  let redesenhandoEscritorio = false;
  if (typeof window !== 'undefined' && typeof window.escritorioElementoMusica === 'function' && typeof window.renderEscritorio === 'function') {
    const elementoOriginal = window.escritorioElementoMusica, renderOriginal = window.renderEscritorio;
    window.escritorioElementoMusica = function (...a) {
      const el = elementoOriginal.apply(this, a);
      if (!ligado || !el) return el;
      if (!el.classList.contains('vv-musica-janela')) { el.classList.add('vv-musica-janela'); document.body.append(el); }
      if (redesenhandoEscritorio) { const marca = document.createElement('span'); marca.hidden = true; return marca; }
      return el;
    };
    window.renderEscritorio = function (...a) {
      redesenhandoEscritorio = true;
      try { return renderOriginal.apply(this, a); } finally { redesenhandoEscritorio = false; }
    };
  }
  desviarEscritorio(); if (typeof setInterval === 'function') { const t = setInterval(() => { desviarEscritorio(); if (desviarEscritorio.feito) clearInterval(t); }, 1500); }

  // ---------- Lobby: a entrada nova (Irecity) ou o modo legado ----------
  // O portão de login continua o mesmo (rostos, senha, mesma rota); só a chegada muda: Irecê ao vivo atrás
  // e a escolha do modo. "Modo legado" desliga o mundo (o painel como sempre foi); "Irecity" liga.
  let giroLobby = null;
  function girarLobby(sim) {
    if (sim && !giroLobby) giroLobby = setInterval(() => { if (body.classList.contains('mundo-lobby')) mundo?.girar90?.(); }, 7000);
    if (!sim && giroLobby) { clearInterval(giroLobby); giroLobby = null; }
  }
  function prepararLobby() {
    const gate = document.getElementById('login-gate'); if (!gate || gate.dataset.irecity) return;
    gate.dataset.irecity = '1'; gate.classList.add('irecity');
    const chegada = gate.querySelector('.login-chegada'); if (!chegada) return;
    const h = new Date().getHours(), saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    chegada.innerHTML = `<span class="abr-kicker">Vybe OS · ${saud}</span>
      <h1 class="login-cidade">Vybe <b>OS</b></h1>
      <p>Seu dia, a agência, os clientes e os agentes do VYBES num lugar só.</p>
      <div class="irecity-modos">
        <button type="button" class="abr-primario" data-modo="irecity"><b>Entrar</b><small>Seu dia, a agência e o VYBES</small></button>
      </div>
      <button type="button" id="login-chegar" hidden>Entrar</button>`;
    chegada.addEventListener('click', (e) => {
      const b = e.target.closest('[data-modo]'); if (!b) return;
      ligar(b.dataset.modo === 'irecity');
      body.classList.toggle('mundo-lobby', !semWebGL);
      gate.dataset.etapa = 'login';
      window.VYBELANDIA_VISTA = true;
      document.querySelector('#login-rostos-lista button, #login-senha')?.focus({ preventScroll: true });
      const t = gate.querySelector('.login-saudacao'); if (t) t.textContent = saud + '.';
    });
    // Enter na chegada = Irecity
    gate.addEventListener('keydown', (e) => { if (e.key === 'Enter' && gate.dataset.etapa === 'cena') { e.preventDefault(); e.stopImmediatePropagation(); chegada.querySelector('[data-modo="irecity"]').click(); } }, true);
    chegada.querySelector('[data-modo="irecity"]').focus({ preventScroll: true });
  }
  new MutationObserver(() => { if (document.getElementById('login-gate') && !document.getElementById('login-gate').dataset.irecity) sincronizar(); }).observe(body, { childList: true });

  // ---------- Mostrar o mundo junto com a tela de módulos ----------
  let timer = null;
  function sincronizar() {
    if (body.classList.contains('auth-pending')) fonteAgentes?.limpar();
    const gateAberto = !!document.getElementById('mode-gate')?.classList.contains('open');
    const autenticado = !body.classList.contains('auth-pending');
    // Com o mundo ligado, o Escritório roda por baixo como motor (presença, voz, chamadas):
    // o mundo e o andar em voxel ficam por cima e o mapa antigo para de desenhar.
    const visivel = ligado && gateAberto && autenticado;
    // Módulo aberto: o mundo fica atrás (parado), com o trilho à esquerda e a tela de trabalho
    // numa moldura de vidro. O Escritório antigo nunca aparece: no mundo, o Escritório é o prédio.
    const quadro = typeof activeBoard !== 'undefined' ? activeBoard : '';
    if (ligado && autenticado && !gateAberto && !andarAberto && quadro === 'escritorio' && !redirecionando && !jogandoAgora) {
      redirecionando = true;
      // Na abertura do sistema o código antigo leva ao quadro do Escritório: no Irecity a pessoa fica na cidade.
      // Depois disso, pedir o Escritório de propósito leva ao Prédio (o Escritório é o prédio).
      const naAbertura = !sincronizar.abriu; sincronizar.abriu = true;
      setTimeout(() => { redirecionando = false; if (typeof openModeGate === 'function') openModeGate(); setTimeout(() => usarTrilho(naAbertura ? 'hoje' : 'predio'), 300); }, 0);
    }
    const modulo = ligado && autenticado && !gateAberto && !andarAberto && quadro !== 'escritorio';
    // Lobby: antes do login, Irecê ao vivo atrás do portão (vale para os dois modos; a escolha é no portão).
    const lobby = !semWebGL && !autenticado && !!document.getElementById('login-gate');
    body.classList.toggle('mundo-lobby', lobby);
    // A entrada não monta mais Irecê atrás do portão: o login abre leve (Paulo, 08/11/2026).
    if (lobby) prepararLobby();
    body.classList.toggle('mundo-modulo', modulo);
    // A rolagem agora é a do body (dentro da moldura): ao trocar de módulo, volta ao topo como antes.
    const chaveModulo = modulo ? (typeof panelMode !== 'undefined' ? panelMode : '') + '|' + quadro : '';
    if (chaveModulo !== sincronizar.ultimo) { sincronizar.ultimo = chaveModulo; if (modulo) { body.scrollTop = 0; setTimeout(() => { if (body.classList.contains('mundo-modulo') && !body.classList.contains('auth-pending')) window.VybeTutorial?.dica?.('modulo'); }, 900); } }
    if (modulo) marcarTrilhoDoModulo();
    body.classList.toggle('mundo-sobre-escritorio', ligado && (visivel || Boolean(andarAberto) || jogandoAgora));
    body.classList.toggle('mundo', ligado);
    body.classList.toggle('mundo-visivel', visivel);
    body.classList.toggle('mundo-centro', visivel && centroAberto);
    if (visivel) {
      if (!sincronizar.tour) { sincronizar.tour = true; setTimeout(() => window.VybeTutorial?.iniciar?.(), 1200); }
      if (centroAberto) { carregar(); mundo?.pausar(false); } else { mundo?.pausar(true); void garantirModulo(); } pintarClientes(); pintarHoje(); ajustarAreaLivre(); carregarAgenda(); observarPresenca(); pintarPresenca(); void carregarAgentes();
      if (!timer) timer = setInterval(() => { pintarClientes(); pintarPresenca(); carregarAgenda(); pintarHoje(); void carregarAgentes(); }, 5000);
    } else {
      mundo?.pausar(true); if (cartao()) cartao().hidden = true;
      clearInterval(timer); timer = null;
    }
  }
  // Com o mundo ligado, entrar no painel cai no mundo (a tela de módulos sobre Irecê),
  // e não no saguão antigo do Escritório. Uma vez por carregamento da página.
  let jaAbriuNoMundo = false;
  function abrirNoMundo() {
    if (jaAbriuNoMundo || !ligado || body.classList.contains('auth-pending')) return;
    jaAbriuNoMundo = true;
    setTimeout(() => { if (!document.getElementById('mode-gate')?.classList.contains('open') && typeof openModeGate === 'function') openModeGate(); }, 600);
  }
  let redirecionando = false;
  function marcarTrilhoDoModulo() {
    const modo = typeof panelMode !== 'undefined' ? panelMode : '', quadro = typeof activeBoard !== 'undefined' ? activeBoard : '';
    const id = modo === 'foco' ? 'tarefas' : modo === 'controler' ? 'direcao' : modo === 'producao' ? 'agenda' : (modo === 'clientes' || quadro === 'clientes') ? 'clientes' : ['diario', 'performance', 'ai-usage', 'automacoes', 'conta', 'demandas'].includes(quadro) ? '' : 'gestor';
    marcarTrilho(id);
  }
  // ---------- Centro: abrir e fechar o 3D ----------
  function abrirCentro(vista = 'cidade') {
    centroAberto = true; fecharPlaca();
    marcarTrilho(vista === 'predio' ? 'predio' : 'centro');
    sincronizar();
    // A vista vai depois de o 3D terminar de montar (clientes, presença, câmera inicial); antes, a câmera inicial
    // da maquete passava por cima e o "Prédio" do menu abria o elevador com a câmera longe.
    const aplicar = () => { if (!mundo || !centroAberto) return; mundo.pausar(false); hud.querySelector(`[data-vista="${vista}"]`)?.click(); ajustarAreaLivre(); };
    Promise.resolve(carregar()).then(() => setTimeout(aplicar, 250));
  }
  function fecharCentro() {
    if (!centroAberto) return;
    centroAberto = false; fecharPlaca();
    body.classList.remove('mundo-predio', 'mundo-cerebro');
    try { mundo?.cerebro?.(false); } catch {}
    mundo?.pausar(true); if (cartao()) cartao().hidden = true;
    sincronizar();
  }
  // O módulo JS (avatares, planta e leitura dos agentes) carrega quando o navegador folga, sem montar a cena.
  let modulo3d = null;
  function garantirModulo() {
    if (modAvatar) { criarFonte(modAvatar); return Promise.resolve(modAvatar); }
    if (!modulo3d) modulo3d = import(MUNDO_JS).then((m) => { modAvatar = modAvatar || m; criarFonte(m); void carregarAgentes(); return m; }).catch(() => { modulo3d = null; return null; });
    return modulo3d;
  }
  function ligar(sim) {
    ligado = !!sim && !semWebGL;
    try { localStorage.setItem(CHAVE, JSON.stringify({ ligado })); } catch { /* sem armazenamento */ }
    sincronizar();
  }
  window.mundoVoxel = { ligar, ligado: () => ligado, abrirCentro, fecharCentro, centroAberto: () => centroAberto, planta: plantaDoPredio, estadoDoAgente, atividadeDoAgenteHtml, fonteAgentes: () => fonteAgentes, garantirModulo, situacaoDaPeca, clientesDoMundo, camera: () => mundo?.estado(), projetar: (...a) => mundo?.projetar(...a),
    // Conferência visual (presença e clientes) sem mexer nos dados do painel.
    desenharCaptacoes: (lista) => mundo?.definirCaptacoes(lista),
    focar: (x, z, dist, incl, giro) => mundo?.focarPonto(x, z, dist, incl, giro),
    conferirClientes: () => mundo?.conferirClientes?.(),
    desempenho: () => mundo?.desempenho?.(),
    ambiente: (k) => mundo?.ambiente?.(k),
    orcamento: () => mundo?.orcamento?.(),
    agente: (andar, setor) => mostrarAgente(andar, setor),
    desenharPresenca: (lista) => { ultimaPresenca = "manual"; manualAndar = lista; mundo?.presenca(lista); },
    abrirAndar: (id) => abrirAndarVoxel(id),
    andarAberto: () => andarAberto,
    jogar: (id) => abrirJogo(id),
    // Conferência visual: desenha uma lista de clientes sem mexer nos dados do painel.
    desenharClientes: (lista) => { naTela = lista; ultimaAssinatura = 'manual'; return mundo?.definirClientes(lista, { aoClicar: (alvo) => mostrarCliente(alvo.nome) }); } };

  // Módulo aberto no palco (Carteira, Comercial, Conteúdo, Pessoas, Planejamentos, Missões, WhatsApp): o trilho
  // sobe por cima dele e o resto do HUD some. Os módulos não avisam quando abrem, então olhamos o body.
  const PALCO = '.vc-camada,.vp-camada,.vv-missoes-camada,#vv-comercial,#vv-conteudo,.vv-plj,.vv-wa,#vv-agentes';
  function marcarPalco() {
    const aberto = [...document.querySelectorAll(PALCO)].some((e) => !e.hidden && e.getClientRects().length > 0);
    if (body.classList.contains('palco-modulo') !== aberto) body.classList.toggle('palco-modulo', aberto);
    if (aberto && centroAberto) fecharCentro();
    // Altura real do aviso dos planejamentos e da barra de voz: a agenda termina acima deles (nada cobre nada).
    const aviso = document.getElementById('plj-aviso'), voz = hud.querySelector('.vv-chamada');
    const musica = document.getElementById('office-musica');
    const alto = (e) => (e && !e.hidden && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' ? e.offsetHeight + 8 : 0);
    const hAviso = alto(aviso), hVoz = alto(voz), hMus = alto(musica);
    // A coluna da direita empilha de baixo para cima: voz, aviso, música; a agenda termina acima de tudo.
    const pe = `${hAviso + hVoz}px`;
    if (body.style.getPropertyValue('--vv-pe-voz') !== hVoz + 'px') body.style.setProperty('--vv-pe-voz', hVoz + 'px');
    if (body.style.getPropertyValue('--vv-pe-base') !== pe) body.style.setProperty('--vv-pe-base', pe);
    if (body.style.getPropertyValue('--vv-pe-agenda') !== (hAviso + hVoz + hMus) + 'px') body.style.setProperty('--vv-pe-agenda', (hAviso + hVoz + hMus) + 'px');
  }
  function iniciar() {
    let palcoAgendado = false;
    new MutationObserver(() => { if (palcoAgendado) return; palcoAgendado = true; setTimeout(() => { palcoAgendado = false; try { marcarPalco(); } catch (e) { console.error('[mundo] palco', e); } }, 40); }).observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    const moldura = document.createElement('div'); moldura.id = 'mundo-moldura';
    body.append(raiz, moldura, hud);
    const gate = document.getElementById('mode-gate');
    if (gate) new MutationObserver(sincronizar).observe(gate, { attributes: true, attributeFilter: ['class'] });
    const barra = document.querySelector('.board-switch-bar');
    if (barra) new MutationObserver(sincronizar).observe(barra, { subtree: true, attributes: true, attributeFilter: ['class'] });
    new MutationObserver(() => { sincronizar(); abrirNoMundo(); }).observe(body, { attributes: true, attributeFilter: ['class'] });
    addEventListener('resize', ajustarAreaLivre);
    // Preferência na janela de Aparência (vybe-appearance.js), ao lado do vidro e do movimento.
    const form = document.querySelector('.appearance-dialog form');
    if (form && !form.querySelector('#appearance-mundo')) {
      const rotulo = document.createElement('label');
      rotulo.className = 'appearance-check';
      rotulo.innerHTML = `<input id="appearance-mundo" type="checkbox"${semWebGL ? ' disabled' : ''}>Mundo voxel na tela de módulos (Irecê e o Prédio da Vybe)`;
      form.querySelector('.appearance-done')?.before(rotulo);
      const caixa = rotulo.querySelector('input');
      document.addEventListener('click', (e) => { if (e.target.closest('[data-open-appearance]')) caixa.checked = ligado; });
      caixa.addEventListener('change', () => ligar(caixa.checked));
    }
    sincronizar();
    if (ligado) {
      trocarAvataresEm(document.body);
      const depois = (f) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 4000 }) : setTimeout(f, 1500));
      depois(() => garantirModulo().then((m) => { if (m) { ligarIconesVoxel(); ligarCatalogoVoxel(); } }));
    }
  }
  // Classe aplicada antes do primeiro desenho, para a tela de módulos não piscar no tema antigo.
  body.classList.toggle('mundo', ligado);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
