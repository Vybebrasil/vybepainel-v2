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
  // Status na cor do quadro (statusCor de vybe-core.js); fora do painel (testes), o nome escapado.
  function statusCor(d) { const g = globalThis.statusCor; return typeof g === 'function' && g !== statusCor ? g(d) : String(d?.status || 'Sem status').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  // Cliente com a cor da carteira (cliCor de vybe-core.js); fora do painel (testes), o nome escapado.
  function cliCor(n) { const g = globalThis.cliCor; return typeof g === 'function' && g !== cliCor ? g(n) : String(n ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
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
    // Auditoria 09/11 (A4): o fechamento vem do banco (status_final) quando chega; o atraso, da função oficial
    // (VybeDono.util.situacaoDaPeca: veiculação primeiro, pausada e esquecida fora). As categorias do Hoje (aprovar, ajuste,
    // pronta…) continuam aqui: "Agendado" e "Para agendar" são prontas, não concluídas (contagens separadas).
    const fechada = typeof item?.status_final === 'boolean' ? item.status_final : typeof isFinishedItem === 'function' ? isFinishedItem(item) : /finalizad|feito|conclu/i.test(st);
    if (fechada) return 'concluida';
    const veic = String(item?.veiculacao_iso || ''), prazo = String(item?.prazo_iso || '');
    const oficial = window.VybeDono?.util?.situacaoDaPeca;
    if (typeof oficial === 'function') { if (oficial(item, { hoje }).atrasada) return 'atrasada'; }
    else if ((veic && veic < hoje) || item?.prazo_atrasado || (prazo && prazo < hoje)) return 'atrasada';
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
    const cadastro = (typeof CADASTRO_CLIENTES !== 'undefined' ? CADASTRO_CLIENTES : []).filter((c) => clienteAtivo(c));
    const itens = [...(typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : []), ...(typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : [])];
    const mapa = new Map();
    const chave = (n) => norm(n).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    // id do cadastro: a logo do Drive sai por /api/painel?area=logo&c=<id> (a mesma da capa do planejamento).
    const logoDe = (c) => { const id = String(c.id ?? c.cliente_id ?? ''); return /^\d{1,18}$/.test(id) ? `/api/painel?area=logo&c=${id}` : ''; };
    for (const c of cadastro) mapa.set(chave(c.nome), { nome: norm(c.nome) || c.nome, segmento: c.segmento || '', endereco: c.endereco || '', logo: logoDe(c), personagem: c.personagem || c.identidade?.personagem?.figura || '', total: 0, por: {}, situacao: 'concluida' });
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
  raiz.innerHTML = '<canvas aria-label="Mapa de Irecê com o Prédio da Vybe e os clientes"></canvas><div class="mundo-vinheta"></div><div class="mundo-carregando" hidden>Montando o Centro…</div>'
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
  // Favoritos do dock (Paulo, 11/11/2026: "favoritar os módulos que mais usa pra não ficar procurando toda vez nas abas").
  // Favorita-se o que abre uma tela: item solto do dock ou item de dentro de um setor. O setor em si só abre a lista.
  const favoritavel = (t) => Boolean(t && typeof t === 'object' && !Array.isArray(t.sub) && !t.acao && t.id !== 'hoje');
  const estrela = (id) => `<i class="vv-fav" data-fav="${id}" title="Pôr nos favoritos">${svg('<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/>')}</i>`;
  // Setores com submódulos (Paulo, 07/11/2026, olhando o AgencyFlow: "módulos nesse esquema com os submódulos").
  // O setor é um ícone do trilho; clicar abre ao lado a lista dos submódulos. Submódulo com `mod` só aparece
  // quando o módulo dele está carregado (window[mod[0]]), assim um setor nunca mostra botão que não abre nada.
  const TRILHO = [
    { id: 'criar', nome: 'Criar', dica: 'Cadastros: criar conteúdo ou demanda', acao: true, ic: svg('<path d="M12 5v14M5 12h14"/>') },
    { id: 'hoje', nome: 'Hoje', dica: 'Seu dia', ic: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>') },
    { id: 'setor:producao', grupo: 'Operação', nome: 'Produção', dica: 'Produção: entregas, tarefas, projetos, agenda, aprovação, arte e parceiros', ic: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'), sub: [
      { id: 'gestor', nome: 'Painel de trabalho', dica: 'O painel da produção: prioridades, prazos, agenda da semana e capacidade', board: 'producao' },
      { id: 'tarefas', nome: 'Minhas tarefas', dica: 'Sua fila, na ordem do dia' },
      { id: 'demandas', nome: 'Demandas', dica: 'Todas as demandas, por grupo e status', board: 'demandas' },
      { id: 'projetos', nome: 'Projetos pontuais', dica: 'Eventos, lançamentos e sites, com a carga da equipe', mod: ['VybePessoas', 'projetos'] },
      { id: 'agenda', nome: 'Agenda e captações', dica: 'Produção e agenda de captações' },
      { id: 'conteudo', nome: 'Aprovação de conteúdo', dica: 'Atração, educação e conversão de cada cliente; link de aprovação', mod: ['VybeConteudo'] },
      { id: 'planejamentos', nome: 'Planejamentos', dica: 'Centro de Operação: o planejamento de cada cliente para revisar, editar, aprovar e enviar', mod: ['VybePlanejamentos'] },
      { id: 'direcao', nome: 'Direção de arte', dica: 'Fila, radar e revisão das peças' },
      { id: 'fornecedores', nome: 'Fornecedores', dica: 'Gráficas, audiovisual, eventos, com BV', mod: ['VybeComercial', 'fornecedores'] },
      // Impressões (Paulo, 09/11/2026): perto de Fornecedores e ligada a eles (a gráfica de cada impressão).
      { id: 'impressoes', nome: 'Impressões', dica: 'Da arte à entrega na gráfica: etapa, fornecedor e prazo', mod: ['VybeImpressoes'] },
      { id: 'creators', nome: 'Creators', dica: 'Influenciadores de Irecê e região', mod: ['VybeComercial', 'creators'] },
    ] },
    { id: 'setor:clientes', grupo: 'Operação', nome: 'Clientes', dica: 'Clientes: carteira, saúde, onboarding e reuniões', ic: svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'), sub: [
      { id: 'clientes', nome: 'Gestão de clientes', dica: 'Todos os clientes, fichas e o cérebro de cada um' },
      { id: 'carteira', nome: 'Saúde da carteira', dica: 'Nota de saúde, risco e clientes prioritários', mod: ['VybeCarteira', 'saude'] },
      { id: 'onboarding', nome: 'Onboarding', dica: 'Cliente novo ou contrato novo: cadastro, questionário, kickoff e checklist', mod: ['VybeCarteira', 'onboarding'] },
      // Reuniões (Paulo, 09/11/2026: "cadê o botão de reunião?"): abre uma reunião com qualquer cliente, com pauta, ata e gravação.
      { id: 'reunioes', nome: 'Reuniões', dica: 'Reuniões da semana, atas e a gravação do áudio', mod: ['VybeReunioes', 'nova'] },
    ] },
    // VybeHub (Paulo, 11/11/2026: "o VybeHub vai virar um botão ali no dock lateral"): o sistema irmão dos clientes abre daqui.
    { id: 'vybehub', grupo: 'Operação', nome: 'VybeHub', dica: 'Abrir o VybeHub: portal e resultados dos clientes', url: 'https://vybehub.vercel.app/', ic: svg('<path d="M4 5v14h16"/><path d="M8 15l3-4 3 2 4-6"/>') },
    // Contratos e Churn (Paulo, 09/11/2026: "churn e contratos não faria mais sentido no comercial?"): renovação e saída
    // são receita, do Comercial. A tela continua a da Carteira (VybeCarteira), só o lugar no dock mudou.
    { id: 'setor:comercial', grupo: 'Negócio', nome: 'Comercial', dica: 'Comercial: CRM, conversas, produtos, orçamentos, contratos e churn', ic: svg('<path d="M3 11l18-7-7 18-2-8z"/>'), sub: [
      { id: 'funil', nome: 'CRM e funil', dica: 'Leads, propostas, ganhos e motivos de perda', mod: ['VybeComercial', 'funil'] },
      { id: 'conversas', nome: 'Conversas', dica: 'O WhatsApp da Vybe: quem espera resposta (só leitura)', acao: 'whatsapp' },
      { id: 'pacotes', nome: 'Produtos e pacotes', dica: 'A esteira de produtos da Vybe, com custo e margem', mod: ['VybeComercial', 'pacotes'] },
      { id: 'orcamentos', nome: 'Orçamentos', dica: 'Propostas a partir dos pacotes', mod: ['VybeComercial', 'orcamentos'] },
      { id: 'contratos', nome: 'Contratos', dica: 'Valor, início e renovações em breve', mod: ['VybeCarteira', 'contratos'] },
      { id: 'churn', nome: 'Churn', dica: 'Quem saiu, por quê, receita perdida e retenção', mod: ['VybeCarteira', 'churn'] },
    ] },
    { id: 'setor:financas', grupo: 'Negócio', nome: 'Finanças', dica: 'Finanças: margem e pagamento por cliente', ic: svg('<path d="M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>'), sub: [
      { id: 'financas', nome: 'Por cliente', dica: 'Contrato, custo, margem e pagamento', mod: ['VybeComercial', 'financas'] },
      { id: 'recebimentos', nome: 'Recebimentos', dica: 'Recorrentes e pontuais: a receber, recebido e pendente', mod: ['VybeComercial', 'recebimentos'] },
      { id: 'contas', nome: 'Contas a pagar', dica: 'Fixas, variáveis, folha, impostos, com % do faturamento', mod: ['VybeComercial', 'contas'] },
      { id: 'inadimplencia', nome: 'Inadimplência', dica: 'Quem está em atraso e há quanto tempo', mod: ['VybeComercial', 'inadimplencia'] },
      { id: 'vybe-financas', nome: 'Vybe Finanças', dica: 'Abrir o app financeiro da Vybe', url: 'https://vybe-financas.vercel.app/' },
    ] },
    { id: 'setor:gestao', grupo: 'Negócio', nome: 'Gestão', dica: 'Gestão da Vybe', ic: svg('<path d="M4 19h16"/><path d="M6 15l4-5 3 3 5-7"/><circle cx="18" cy="6" r="1.6"/>'), sub: [
      { id: 'gestao', nome: 'Visão geral', dica: 'Agora, semana, clientes, time e bots, histórico e projeção' },
      { id: 'diario', nome: 'Diário', dica: 'O diário da operação', board: 'diario' },
      { id: 'performance', nome: 'Performance', dica: 'A operação inteira: entregas, prazo, tempo, fluxo, processos, departamentos e pessoas' },
      { id: 'ai-usage', nome: 'IA e custos', dica: 'Uso e custo da IA (quem administra)', board: 'ai-usage' },
      { id: 'automacoes', nome: 'Automações', dica: 'Regras que movem as demandas sozinhas', board: 'automacoes' },
      { id: 'conta', nome: 'Conta e equipe', dica: 'Sua conta, acessos e a equipe', board: 'conta' },
    ] },
    { id: 'setor:pessoas', grupo: 'Time', nome: 'Recursos Humanos', dica: 'Recursos Humanos: produtividade, pedidos, recrutamento e documentos', ic: svg('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c0-2.5 1.5-4.5 4-4.5s3 1.5 3 4.5"/>'), sub: [
      { id: 'produtividade', nome: 'Produtividade', dica: 'Score, ranking, metas e conquistas do time', mod: ['VybePessoas', 'produtividade'] },
      { id: 'rh', nome: 'Pedidos e calendário', dica: 'Pedidos ao RH, aniversários, férias e clima', mod: ['VybePessoas', 'rh'] },
      { id: 'recrutamento', nome: 'Recrutamento', dica: 'Vagas e candidatos', mod: ['VybePessoas', 'recrutamento'] },
      { id: 'documentos', nome: 'Documentos', dica: 'Contratos e documentos do time', mod: ['VybePessoas', 'documentos'] },
    ] },
    // Auditoria 09/11: Equipe online (presença, recados, missões) e Meu perfil (nível, VybeCoins) são do jogo, não do RH:
    // a Equipe vira item próprio do Time e o perfil vai para o menu da conta.
    { id: 'equipe', grupo: 'Time', nome: 'Equipe online', dica: 'Quem está online, conversa, recados, missões e ranking', ic: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="18" cy="8" r="2"/><path d="M18 13v0"/>') },
    { id: 'academy', grupo: 'Time', nome: 'Academy', dica: 'Trilhas de treinamento da Vybe', mod: ['VybePessoas', 'academy'], ic: svg('<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/>') },
    // Agentes (Paulo, 08/11/2026): quem é quem, o que cada um faz, a rotina e as atribuições, em tela cheia.
    { id: 'agentes', grupo: 'Time', nome: 'Agentes', dica: 'Agentes da Vybe: quem é quem, rotina e atribuições', ic: svg('<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/><path d="M3 13v2M21 13v2"/>') },
    // Centro comercial (Paulo, 08/11/2026): o mapa deixou de ser a tela principal e virou este botão. O 3D só
    // carrega quando ele (ou o Prédio) é aberto; Hoje, Gestão e os módulos ocupam a tela sem nada atrás.
    { id: 'setor:toolkit', grupo: 'Vybe', nome: 'Toolkit', dica: 'Ferramentas rápidas da Vybe: QR Code, link do WhatsApp e calculadora de ROI', ic: svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'), sub: [
      // A Visão geral do Toolkit é a dele (fase 3d, quadro 39): os cartões das ferramentas e os usados por último.
      { id: 'toolkit', nome: 'Visão geral', dica: 'As ferramentas e o que você usou por último', mod: ['VybeFerramentas', 'inicio'] },
      { id: 'qr', nome: 'QR Code', dica: 'QR para peça impressa, cardápio e evento', mod: ['VybeFerramentas', 'qr'] },
      { id: 'whatsapp-link', nome: 'Link do WhatsApp', dica: 'Link com mensagem pronta para bio e anúncio', mod: ['VybeFerramentas', 'whatsapp'] },
      { id: 'roi', nome: 'Calculadora de ROI', dica: 'Quantas vendas pagam a Vybe e o retorno esperado', mod: ['VybeFerramentas', 'roi'] },
    ] },
    { id: 'centro', grupo: 'Vybe', nome: 'Centro', dica: 'Centro comercial: a Vybe no meio e os clientes ao redor, com o status de cada um', ic: svg('<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9h18"/><path d="M9 20v-6h6v6"/>') },
    { id: 'predio', grupo: 'Vybe', nome: 'Prédio', dica: 'Prédio da Vybe: setores e agentes de cada andar', ic: svg('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h6M9 11h6M9 15h6"/>') },
    // Minha sala (Paulo, 09/11/2026): o quarto do Escritório de cada um em voxel, em tela cheia; abrir já entra na sala e na voz dela.
    { id: 'minha-sala', grupo: 'Vybe', nome: 'Minha sala', dica: 'O seu quarto do Escritório em voxel, com a chamada da sala', ic: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>') },
    { id: 'jogos', grupo: 'Vybe', nome: 'Jogos', dica: 'Jogos com a equipe: sinuca, xadrez, pôquer, dominó, dama, velha e truco', ic: svg('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 14h.01"/>') },
    // Jogo à vista (Paulo, 09/11/2026: "loja, ranking... eu nunca nem achei esses menus"): as janelas do Escritório
    // (as mesmas funções de sempre) ganham lugar no dock, em vez de ficar só no fim da Equipe online.
    { id: 'loja', grupo: 'Vybe', nome: 'Loja', dica: 'Loja do Escritório: móveis e roupas com VybeCoins, e o seu inventário', fn: ['abrirCatalogoEscritorio'], ic: svg('<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>') },
    { id: 'ranking', grupo: 'Vybe', nome: 'Ranking', dica: 'Ranking da semana: XP do trabalho, superação e campeões', fn: ['abrirRankingEscritorio', 'geral', 'semana'], ic: svg('<path d="M4 20V12h4v8M10 20V6h4v14M16 20v-6h4v6"/>') },
    { id: 'conquistas', grupo: 'Vybe', nome: 'Conquistas', dica: 'Conquistas, troféus e títulos', fn: ['abrirConquistasEscritorio'], ic: svg('<circle cx="12" cy="9" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/>') },
    '-',
    { id: 'vybes', nome: 'VYBES', dica: 'Abrir o VYBES', ic: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>') },
  ];
  // O separador '-' é string, e String.prototype.sub existe: só objeto com lista de verdade tem submódulos.
  const SUBMODULOS = TRILHO.flatMap((t) => (t && typeof t === 'object' && Array.isArray(t.sub) ? t.sub : []).map((x) => ({ ...x, setor: t.id })));
  const setorDe = (id) => SUBMODULOS.find((x) => x.id === id)?.setor || id;
  const subVisivel = (x) => !x.mod || typeof window[x.mod[0]]?.abrir === 'function';
  function chamar(nome, ...a) { return typeof window[nome] === 'function' ? window[nome](...a) : undefined; }
  // Dock largo (Paulo, 08/11/2026: "copiar o jeito do AgencyFlow"): nomes, categorias e o setor que abre para baixo com
  // a Visão geral e as abas dele, e fica aberto. Recolhido (ou no celular), volta a ser o trilho de ícones com a lista ao
  // lado. A escolha de recolher fica no navegador de cada pessoa.
  const CHAVE_DOCK = 'vybe.dock';
  const dockLargo = () => body.classList.contains('trilho-largo');
  function aplicarDock() {
    let recolhido = false; try { recolhido = localStorage.getItem(CHAVE_DOCK) === 'icones'; } catch { /* sem armazenamento: largo */ }
    const largura = typeof innerWidth === 'number' ? innerWidth : 1280; // fora do navegador (testes) conta como computador
    const largo = !recolhido && largura > 900;
    if (largo !== dockLargo()) { body.classList.toggle('trilho-largo', largo); fecharSetor(); ajustarAreaLivre(); }
    const bt = hud.querySelector('[data-trilho-recolher]');
    if (bt) { bt.setAttribute('aria-label', largo ? 'Recolher o menu' : 'Abrir o menu com os nomes'); bt.title = bt.getAttribute('aria-label'); bt.setAttribute('aria-expanded', String(largo)); }
  }
  function alternarDock() { try { localStorage.setItem(CHAVE_DOCK, dockLargo() ? 'icones' : 'largo'); } catch { /* vale até recarregar */ } aplicarDock(); }
  // Abre (para baixo) só o setor pedido; as abas que dependem de um módulo aparecem quando o módulo existe.
  function expandirSetor(setor) {
    hud.querySelectorAll('.vv-trilho-sub').forEach((el) => {
      const meu = el.dataset.subDe === setor; el.hidden = !meu;
      if (meu) el.querySelectorAll('[data-submodulo]').forEach((b) => { const x = SUBMODULOS.find((q) => q.id === b.dataset.submodulo); b.hidden = Boolean(x && !subVisivel(x)); });
    });
    hud.querySelectorAll('.vv-trilho [data-trilho^="setor:"]').forEach((b) => b.setAttribute('aria-expanded', String(dockLargo() && b.dataset.trilho === setor)));
  }
  function marcarTrilho(id) {
    const alvo = setorDe(id);
    hud.querySelectorAll('[data-trilho]').forEach((b) => b.toggleAttribute('aria-current', b.dataset.trilho === alvo));
    hud.querySelectorAll('.vv-trilho [data-submodulo]').forEach((b) => b.toggleAttribute('aria-current', b.dataset.submodulo === id));
    hud.querySelectorAll('.vv-trilho [data-visao-setor]').forEach((b) => b.toggleAttribute('aria-current', b.dataset.visaoSetor === id));
    // Fica aberto o setor em que a pessoa está. Marcar outra coisa não recolhe (Paulo, 09/11/2026: "quando eu troco de
    // submenu tem hora que fecha eles... tem que continuar aberto"): o painel antigo remarca o dock com o próprio modo e
    // a janela que fecha remarca o Hoje, e isso recolhia o setor no meio da troca. Recolhe só quem clica (o setor aberto
    // de novo, a setinha ou outro item do dock).
    if (dockLargo() && String(alvo).startsWith('setor:')) expandirSetor(alvo);
  }
  // Visão geral do setor (vybe-mundo-setor.js): o painelzão com o resumo de cada aba. Gestão já é a visão geral dela.
  const JANELAS_DE_MODULO = ['VybeCarteira', 'VybeComercial', 'VybePessoas', 'VybeConteudo', 'VybePlanejamentos', 'VybeFerramentas', 'VybeImpressoes', 'VybeReunioes'];
  // Dock aceso só no que está na tela (auditoria 09/11, D10): ao fechar a janela de um módulo (X, Esc ou o próprio
  // módulo), o item dela apaga e volta a acender o que ficou à vista. As janelas somem do body ou ganham hidden.
  const IDS_DE_JANELA = new Set(['vv-carteira', 'vv-comercial', 'vv-pessoas', 'vv-conteudo', 'vv-ferramentas', 'vv-agentes', 'vv-impressoes']);
  const SEL_JANELAS = [...IDS_DE_JANELA].map((i) => '#' + i).join(',');
  let remarcando = 0;
  function remarcarAoFechar() {
    remarcando = 0;
    if (body.classList.contains('mundo-modulo') || !gestao.hidden || centroAberto || window.VybeSetor?.aberto?.()) return;
    if (JANELAS_DE_MODULO.some((n) => { try { return window[n]?.aberto?.(); } catch { return false; } })) return;
    if (document.getElementById('vv-agentes')?.isConnected && !document.getElementById('vv-agentes').hidden) return;
    // Pente-fino 09/11/2026: Conversas (WhatsApp) e a placa (Equipe online, Jogos) também são telas à vista; sem isso o dock
    // voltava para o Hoje ou para a Direção de arte (criacaoPeloDock de uma visita antiga) com elas abertas.
    if (!document.getElementById('vv-whatsapp')?.hidden && document.getElementById('vv-whatsapp')?.isConnected) return;
    if (placa() && !placa().hidden) return;
    // A Criação aberta pela Direção de arte do dock continua acesa como Direção de arte, não como Hoje.
    marcarTrilho(body.classList.contains('mundo-cartoes') ? 'modulos' : criacaoPeloDock && visaoHoje === 'criacao' && !body.classList.contains('mundo-modulo') ? 'direcao' : 'hoje');
  }
  if (typeof MutationObserver === 'function') new MutationObserver((lista) => {
    const fechou = lista.some((m) => (m.type === 'attributes' ? IDS_DE_JANELA.has(m.target.id) && m.target.hidden : [...m.removedNodes].some((n) => IDS_DE_JANELA.has(n.id) || n.querySelector?.(SEL_JANELAS))));
    if (fechou && !remarcando) remarcando = requestAnimationFrame(remarcarAoFechar);
  }).observe(document.body, { childList: true, attributes: true, attributeFilter: ['hidden'], subtree: true });
  // Sair de uma tela antiga para o mundo na mesma hora (quarta rodada, 11/11/2026: "o que veio do legado não abre como as
  // interfaces novas"). Antes era voltarAoMenu e o destino 350 ms depois; agora o mundo volta a valer já (sincronizar, que
  // o observador do portão só rodaria depois do clique) e o destino abre no mesmo clique.
  function sairDaTelaAntiga() { chamar('voltarAoMenu'); sincronizar(); }
  function fecharJanelasDeModulo() { for (const n of JANELAS_DE_MODULO) { try { const m = window[n]; if (m && (typeof m.aberto !== 'function' || m.aberto())) m.fechar?.(); } catch { /* segue */ } } }
  function abrirVisaoSetor(id) {
    if (id === 'setor:gestao') { usarTrilho('gestao'); return; }
    if (id === 'setor:toolkit') { usarTrilho('toolkit'); return; }
    const t = TRILHO.find((x) => x && x.id === id);
    if (!t || !window.VybeSetor) { abrirSetor(id, hud.querySelector(`[data-trilho="${id}"]`)); return; }
    if (body.classList.contains('mundo-modulo')) sairDaTelaAntiga();
    if (centroAberto) fecharCentro();
    if (!gestao.hidden) fecharGestao();
    limparTela();
    marcarTrilho(id);
    window.VybeSetor.abrir(id, { nome: t.nome, dica: t.dica, subs: (t.sub || []).filter(subVisivel), numeros: () => numerosDoDono(), fila: () => minhaFila(), agenda: () => agendaEventos,
      abrirSub: (sub) => usarTrilho(sub), irSetor: (setor) => abrirVisaoSetor(setor), aoFechar: () => usarTrilho('hoje') });
  }
  // Lista de submódulos ao lado do setor (ou acima, no celular). Esc ou clique fora fecha.
  function fecharSetor() { hud.querySelector('.vv-setor')?.remove(); hud.querySelectorAll('[data-trilho][aria-expanded]').forEach((b) => b.setAttribute('aria-expanded', 'false')); }
  function abrirSetor(id, botao) {
    const aberto = hud.querySelector('.vv-setor');
    if (aberto?.dataset.setor === id) { fecharSetor(); return; }
    fecharSetor();
    const t = TRILHO.find((x) => x.id === id); if (!t) return;
    const itens = (id === 'setor:gestao' || id === 'setor:toolkit' ? [] : [{ id: '__visao', nome: 'Visão geral', dica: 'O resumo de todas as abas do setor' }]).concat(t.sub.filter(subVisivel));
    const el = document.createElement('div');
    el.className = 'vv-setor'; el.dataset.setor = id; el.setAttribute?.('role', 'menu'); el.setAttribute?.('aria-label', t.nome);
    el.innerHTML = `<div class="vv-setor-topo">${t.ic}<b>${esc(t.nome)}</b></div>` + itens.map((x) => `<button type="button" role="menuitem" data-submodulo="${esc(x.id)}"><b>${esc(x.nome)}</b><small>${esc(x.dica)}</small>${x.url ? '<i aria-hidden="true">↗</i>' : ''}</button>`).join('');
    hud.append(el);
    const r = botao?.getBoundingClientRect?.(), trilho = hud.querySelector('.vv-trilho')?.getBoundingClientRect?.();
    if (r && trilho) {
      if (trilho.height < 90) {
        // No celular: acima das abas e da barra das salas, abaixo do topo; rola por dentro se não couber.
        const faixa = document.querySelector('.vv-dock-salas-faixa:not([hidden])')?.getBoundingClientRect?.();
        const chao = Math.min(trilho.top, faixa?.height ? faixa.top : Infinity), teto = (hud.querySelector('.vv-barra-topo')?.getBoundingClientRect?.().bottom || 0) + 8;
        el.style.left = Math.max(8, Math.min(innerWidth - 300, r.left)) + 'px'; el.style.bottom = (innerHeight - chao + 8) + 'px'; el.style.maxHeight = Math.max(160, chao - 8 - teto) + 'px';
      }
      else { el.style.left = (trilho.right + 8) + 'px'; el.style.top = Math.max(8, Math.min(innerHeight - el.offsetHeight - 8, r.top - 6)) + 'px'; }
    }
    botao?.setAttribute?.('aria-expanded', 'true');
    el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-submodulo]'); if (!b) return; fecharSetor(); if (b.dataset.submodulo === '__visao') abrirVisaoSetor(id); else usarTrilho(b.dataset.submodulo); });
  }
  if (typeof document !== 'undefined') {
    document.addEventListener?.('click', (ev) => { if (hud.querySelector('.vv-setor') && !ev.target.closest?.('.vv-setor,[data-trilho^="setor:"]')) fecharSetor(); }, true);
    document.addEventListener?.('keydown', (ev) => { if (ev.key === 'Escape' && hud.querySelector('.vv-setor')) { fecharSetor(); ev.stopPropagation(); } }, true);
  }
  // Uma tela por vez (Paulo, 08/11/2026: "menu que se sobrepõe", "aparece menu do legado"): toda navegação fecha o
  // que estava aberto (visão geral, Gestão, Agentes, janelas dos módulos, a lista do setor, a ficha e o menu do topo
  // antigo) e sai da tela antiga antes de abrir outra coisa. Antes as janelas se empilhavam e a tela antiga que ficava
  // atrás remarcava o dock.
  const TELAS_ANTIGAS = new Set(['tarefas', 'gestor', 'direcao', 'agenda', 'clientes']);
  // Balões do painel antigo (status, responsável, campos, cor e menu do grupo, lote): todos são .status-editor com um fundo
  // .status-editor-backdrop e cada um tem o próprio fechar. Pente-fino 09/11/2026: o Esc fechava o módulo por baixo e os
  // balões ficavam soltos por cima da tela seguinte.
  const SEL_BALOES = '.status-editor, .status-editor-backdrop';
  function fecharBaloesAntigos() {
    // Varredura de 10/11/2026: o Esc com o cartão de um evento aberto fechava também a Agenda, e o dock ficava aceso nela.
    const cartao = document.getElementById('ag-cartao');
    if (cartao && !cartao.hidden) { try { window.agCartaoFechar?.(); } catch { /* segue */ } return true; }
    if (!document.querySelector(SEL_BALOES)) return false;
    for (const f of ['closeStatusEditor', 'fecharSeletorDeDono', 'fecharEscolha', 'fecharMenuDoGrupo', 'fecharMenuDeLote']) { try { window[f]?.(); } catch { /* segue */ } }
    document.querySelectorAll(SEL_BALOES).forEach((el) => el.remove());
    return true;
  }
  function limparTela() {
    fecharBaloesAntigos();
    fecharDaDireita();
    if (!placa().hidden) fecharPlaca(); // a placa aberta por baixo de um módulo escondia a barra de cima
    window.VybeSetor?.fechar?.();
    if (!gestao.hidden) fecharGestao();
    window.VybeAgentes?.fechar?.();
    // As Conversas e outras janelas soltas fecham pelo aviso (cada uma escuta o seu; o WhatsApp não depende do mundo).
    window.dispatchEvent?.(new CustomEvent('vybe:trocar-tela'));
    fecharJanelasDeModulo(); fecharSetor();
    try { const f = document.getElementById('office-ficha'); if (f?.open) f.close(); } catch { /* sem ficha */ }
    document.querySelectorAll?.('details.header-utilities[open]').forEach((d) => d.removeAttribute('open'));
  }
  // Tela antiga em pedaços (quinta rodada, 11/11/2026). No Safari o Painel de trabalho levava ~850 ms do clique até
  // parar, contra ~420 ms de Projetos pontuais. Medido no WebKit: o desenho do resumo, da agenda e das seis semanas ia no
  // mesmo passo do clique, e o primeiro quadro ainda montava as ~10 mil peças da tela (~150 ms); depois, cada quadro da
  // entrada repintava as linhas e cartões (com desfoque e sombra) por baixo do deslize (~120 ms por quadro, aos trancos).
  // Agora: o clique só troca a tela e o primeiro quadro mostra a moldura, o cabeçalho, o resumo e o esqueleto do resto
  // (.container.vv-abrindo, CSS no fim de vybe-mundo.css: o resto fica fora da montagem); o desenho pesado vem logo depois
  // desse quadro, a semana à vista primeiro, enquanto a moldura desliza leve; o conteúdo aparece no fim do deslize;
  // as outras semanas se desenham quando o navegador folga. Cada desenho adiado é o MESMO de antes, com os mesmos
  // argumentos; se a tela pedir o mesmo desenho de novo antes da vez dele, vale o pedido novo (nada se perde, nada sai velho).
  const DESENHOS_ADIAVEIS = ['renderWeek', 'renderCompactSummary', 'renderOperationalTools', 'renderManagerCalendar', 'renderManagerIntelligence',
    'renderDemandas', 'renderClientesBoard', 'renderDiarioLista', 'renderPerformance', 'renderProductionCommand', 'loadAiUsage', 'carregarAutomacoes', 'carregarConta',
    'pintarSeletorDeSemana', 'pintarAbaDaSemana', 'updateClearFiltersState', 'pedirAcomodarBarraDoPainel'];
  // O que cada semana escondida repinta na parte à vista (seletor e aba da semana, "limpar filtros", a barra): nas folgas,
  // uma vez só, depois da última semana (antes, cada semana escondida remontava a tela inteira mais uma vez).
  const SO_NO_FIM_DAS_FOLGAS = new Set(['pintarSeletorDeSemana', 'pintarAbaDaSemana', 'updateClearFiltersState', 'pedirAcomodarBarraDoPainel']);
  let nasFolgas = false;
  const desenhosNaFila = new Map();
  // A entrada leva 420 ms (--vv-t-janela) com a mola --vv-mola (cubic-bezier(.32,.72,0,1)): aos 300 ms a janela já está a
  // menos de 1 px do lugar. O conteúdo aparece aí, e o quadro dele cai no fim do deslize (medido: 509 ms no WebKit,
  // contra 685 ms esperando a entrada acabar).
  const CONTEUDO_APARECE_MS = 300;
  let adiandoDesenho = false, aberturaAtual = 0;
  function embrulharDesenhos() {
    for (const nome of DESENHOS_ADIAVEIS) {
      const f = window[nome];
      if (typeof f !== 'function' || f.vvAdiavel) continue;
      const embrulho = function (...a) {
        const chave = nome === 'renderWeek' ? nome + ':' + a[0] : nome === 'pintarAbaDaSemana' ? nome + ':' + a[1] : nome;
        if (adiandoDesenho ? !SO_NO_FIM_DAS_FOLGAS.has(nome) : nasFolgas && SO_NO_FIM_DAS_FOLGAS.has(nome)) { desenhosNaFila.delete(chave); desenhosNaFila.set(chave, { f, a, este: this }); return undefined; }
        desenhosNaFila.delete(chave);
        return f.apply(this, a);
      };
      embrulho.vvAdiavel = true;
      try { window[nome] = embrulho; } catch { /* fica o de sempre */ }
    }
  }
  function desenharDaFila(chave) {
    const x = desenhosNaFila.get(chave); if (!x) return;
    desenhosNaFila.delete(chave);
    try { const r = x.f.apply(x.este, x.a); if (r && typeof r.catch === 'function') r.catch((e) => console.error('[mundo] desenho', e)); } catch (e) { console.error('[mundo] desenho', e); }
  }
  const quandoFolgar = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 300 }) : setTimeout(fn, 40));
  function abrirEmPedacos(abrir) {
    if (typeof requestAnimationFrame !== 'function') { abrir(); return; }
    embrulharDesenhos();
    const vez = ++aberturaAtual;
    adiandoDesenho = true;
    try { abrir(); } finally { adiandoDesenho = false; }
    // A classe fica na própria tela (o Painel ou o #painel-… do quadro), não no body: trocar classe do body recalcula a
    // página inteira, um quadro a mais.
    document.querySelectorAll('body > .vv-abrindo').forEach((el) => el.classList.remove('vv-abrindo'));
    const painel = [...body.children].find((el) => (el.matches('.container') && el.style.display !== 'none') || (el.matches('[id^="painel-"]:not(#painel-escritorio)') && el.style.display === 'block'));
    painel?.classList.add('vv-abrindo');
    // 1 · depois do primeiro quadro pintado (o rAF roda antes da pintura; o setTimeout, depois dela): a semana à vista e o
    // resto da tela, ainda escondidos (sem montar a página no meio do deslize).
    // 2 · no fim do deslize (CONTEUDO_APARECE_MS, contado do primeiro quadro), o conteúdo aparece e a barra do Painel é
    // medida de novo, agora com a tela montada; 3 · as outras semanas, uma por folga.
    const reduzido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      setTimeout(() => {
        const ativa = 'renderWeek:' + (document.querySelector('.week-panel.active')?.id?.match(/(\d+)$/)?.[1] || '');
        for (const chave of [...desenhosNaFila.keys()]) if (!chave.startsWith('renderWeek:') || chave === ativa) desenharDaFila(chave);
      }, 0);
      setTimeout(() => {
        if (vez !== aberturaAtual) return;
        // O conteúdo chega já no lugar (a moldura terminou de deslizar): o esmaecer das abas do dia, que começaria agora,
        // vai direto ao fim.
        if (painel?.classList.contains('vv-abrindo')) {
          painel.classList.remove('vv-abrindo');
          if (typeof document.getAnimations === 'function') for (const a of document.getAnimations()) { const alvo = a.effect?.target; if (alvo && alvo !== painel && painel.contains(alvo) && /^vv-aba/.test(a.animationName || '')) { try { a.finish(); } catch { /* segue */ } } }
        }
        chamar('pedirAcomodarBarraDoPainel');
        const proxima = () => {
          const chave = desenhosNaFila.keys().next().value; if (!chave) return;
          nasFolgas = [...desenhosNaFila.keys()].some((k) => !SO_NO_FIM_DAS_FOLGAS.has(k.split(':')[0]));
          try { desenharDaFila(chave); } finally { nasFolgas = false; }
          quandoFolgar(proxima);
        };
        quandoFolgar(proxima);
      }, reduzido ? 0 : CONTEUDO_APARECE_MS);
    });
  }
  function usarTrilho(id, botao, saiuDaAntiga = false) {
    // Setor: no dock largo, abre para baixo e mostra o painelzão dele; recolhido ou no celular, a lista ao lado.
    // Item com cadeado chamado por outro caminho (busca, atalho): o mesmo aviso do dock.
    // Direção de arte (Paulo, 09/11/2026: "reformular o painel de direção de arte no padrão novo"): abre a Criação do Hoje.
    if (id === 'direcao') { visaoHoje = 'criacao'; criacaoPeloDock = true; usarTrilho.criacao = true; usarTrilho('hoje', botao, saiuDaAntiga); return; }
    // Minhas tarefas (quadro 31 do redesign, 10/11/2026): o item do dock e a aba do Hoje levam ao mesmo lugar, o Hoje na
    // aba Minhas tarefas. O Modo Foco antigo continua a um clique ("Abrir o dia completo").
    if (id === 'tarefas') { visaoHoje = 'tarefas'; try { localStorage.setItem('vybe.mundo.visaoHoje', 'tarefas'); } catch { /* fica nesta tela */ } usarTrilho.tarefas = true; usarTrilho('hoje', botao, saiuDaAntiga); return; }
    if (TRANCADOS.has(id) && !souDono()) { const b = hud.querySelector(`.vv-trilho [data-trilho="${id}"], .vv-trilho [data-submodulo="${id}"]`); if (b) avisarTrancado(b); else chamar('showToast', 'Só os donos veem esta área.', 'info', 3500); return; }
    const fora = TRILHO.find((t) => t && typeof t === 'object' && t.id === id && t.url);
    if (fora) { window.open(fora.url, '_blank', 'noopener'); return; } // sistema irmão (VybeHub): abre ao lado, sem mexer na tela
    if (String(id).startsWith('setor:')) {
      // Visão geral com cadeado (a do RH para quem não é dono): o setor só abre a lista dos itens.
      if (dockLargo() && !souDono() && TRANCADOS.has('visao:' + id)) { expandirSetor(id); return; }
      if (dockLargo()) abrirVisaoSetor(id); else abrirSetor(id, botao || hud.querySelector(`[data-trilho="${id}"]`)); return;
    }
    if (id !== 'criar' && id !== 'vybes') {
      limparTela();
      // Saindo de uma tela antiga para uma nova: volta ao menu primeiro (uma vez só) e então abre o destino.
      if (!saiuDaAntiga && !TELAS_ANTIGAS.has(id) && !SUBMODULOS.find((x) => x.id === id)?.board && id !== 'centro' && id !== 'predio' && id !== 'minha-sala' && body.classList.contains('mundo-modulo')) {
        sairDaTelaAntiga(); usarTrilho(id, botao, true); return;
      }
    }
    window.VybeTutorial?.dica?.('trilho:' + id);
    // Minha sala ocupa a tela inteira (por baixo dos HUDs, como o andar); qualquer outro destino fecha o quarto.
    if (andarAbertoId.startsWith('quarto:') && id !== 'criar' && id !== 'vybes' && id !== 'minha-sala') fecharAndarVoxel(false);
    if (id === 'minha-sala') {
      if (!gestao.hidden) fecharGestao();
      if (body.classList.contains('mundo-modulo')) sairDaTelaAntiga();
      if (centroAberto) fecharCentro();
      abrirMinhaSala(); return;
    }
    // Centro e Prédio abrem o 3D; qualquer outro módulo fecha o Centro e ocupa a tela (o mapa para e some).
    if (id === 'centro' || id === 'predio') {
      if (!gestao.hidden) fecharGestao();
      if (body.classList.contains('mundo-modulo')) sairDaTelaAntiga();
      abrirCentro(id === 'predio' ? 'predio' : 'cidade'); return;
    }
    if (centroAberto && id !== 'criar' && id !== 'vybes') fecharCentro();
    if (id === 'agentes') { if (!gestao.hidden) fecharGestao(); marcarTrilho('agentes'); window.VybeAgentes?.abrir?.(); return; }
    if (id !== 'criar' && id !== 'vybes') window.VybeAgentes?.fechar?.();
    // Submódulo de um módulo novo (Carteira, Conteúdo, Comercial, Pessoas) ou link externo.
    const sub = SUBMODULOS.find((x) => x.id === id) || TRILHO.find((t) => t && typeof t === 'object' && t.id === id && t.mod);
    const doJogo = TRILHO.find((t) => t && typeof t === 'object' && t.id === id && Array.isArray(t.fn));
    if (doJogo) { marcarTrilho(id); if (typeof window[doJogo.fn[0]] === 'function') chamar(...doJogo.fn); else chamar('showToast', 'Entre no Escritório (Entrar, na barra de baixo) para abrir ' + doJogo.nome + '.', 'info', 4000); return; }
    if (sub?.acao === 'whatsapp') { marcarTrilho(id); hud.querySelector('.vv-ferramentas [aria-label="WhatsApp da Vybe"]')?.click(); return; } // o mesmo botão da barra de cima
    if (sub?.url) { window.open(sub.url, '_blank', 'noopener'); return; }
    if (sub?.board) {
      if (!gestao.hidden) fecharGestao();
      const quadro = () => chamar('switchBoard', sub.board, document.getElementById('btn-board-' + sub.board));
      // Direto no quadro pedido (quarta rodada, 11/11/2026): antes abria o Painel de trabalho e trocava 300 ms depois.
      abrirEmPedacos(() => { if (!body.classList.contains('mundo-modulo') || (typeof panelMode !== 'undefined' && panelMode !== 'gestor')) chamar('chooseManagerMode', sub.board); else quadro(); });
      marcarTrilho(id); return;
    }
    if (sub?.mod) { if (!gestao.hidden) fecharGestao(); marcarTrilho(id);
      // A janela mostra só a parte deste item do dock, sem barra de abas (Paulo, 09/11/2026: "elas só abrem pela lateral
      // mesmo"): Saúde e Onboarding, Contratos e Churn já são itens próprios na lateral e não se repetem como abas.
      const irmaos = [sub.mod[1]];
      const setorNome = TRILHO.find((t) => t && t.id === sub.setor)?.nome || sub.nome;
      window[sub.mod[0]]?.abrir?.(sub.mod[1], { abas: irmaos, rotulo: setorNome }); return; }
    // Performance (Paulo, 09/11/2026: "medir e acompanhar tudo da agência… todos operacionais e processos") é uma aba da
    // Gestão (vybe-mundo-performance.js); a Visão geral volta para a Agência.
    if (id === 'gestao' || id === 'performance') { abrirGestao(id === 'performance' ? 'performance' : 'agencia'); return; }
    if (!gestao.hidden) fecharGestao();
    const noModulo = body.classList.contains('mundo-modulo');
    if (noModulo && ['hoje', 'predio', 'equipe', 'modulos', 'jogos'].includes(id)) sairDaTelaAntiga();
    if (id === 'hoje') { body.classList.remove('mundo-cartoes'); if (!usarTrilho.criacao) criacaoPeloDock = false; marcarTrilho(usarTrilho.criacao ? 'direcao' : usarTrilho.tarefas ? 'tarefas' : 'hoje'); usarTrilho.criacao = false; usarTrilho.tarefas = false; pintarHoje(); ajustarAreaLivre(); return; }
    if (id === 'modulos') { const abrir = !body.classList.contains('mundo-cartoes'); body.classList.toggle('mundo-cartoes', abrir); marcarTrilho(abrir ? 'modulos' : 'hoje'); ajustarAreaLivre(); return; }
    if (id === 'equipe') { marcarTrilho('equipe'); mostrarEquipe(); return; }
    if (id === 'jogos') { marcarTrilho('jogos'); mostrarJogos(); return; }
    if (id === 'perfil') { abrirPerfil(); return; }
    ({ criar: () => chamar('openCadastrosStation'), gestor: () => chamar('chooseManagerMode'), direcao: () => chamar('chooseDaControllerMode'),
      agenda: () => abrirEmPedacos(() => abrirAgenda()), clientes: () => abrirEmPedacos(() => chamar('chooseClientMode')), vybes: () => chamar('chooseVybesMode') })[id]?.();
  }

  // ---------- Painel "Hoje": o dia da pessoa, com o VYBES dizendo por onde começar ----------
  // Mesma fila do topo (operadorDoTopo + focusOwnItems + focusReferenceDate): o número aqui
  // é o mesmo da barra e do Modo Foco.
  // "Ver como" (Paulo, 06/11/2026; 09/11 vale para a tela toda): o estado e as regras ficam junto de souDono.
  let hojeVerTodas = (() => { try { return localStorage.getItem('vybe.hoje.todas') === '1'; } catch { return false; } })();
  // A fila do Hoje: a da pessoa (ou de quem se "vê como") ou, para os donos, a de várias pessoas juntas (pessoasHoje).
  // Uma peça de duas pessoas aparece uma vez só, com o nome das duas (quem).
  function minhaFila() {
    const time = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
    const eu = typeof operadorDoTopo === 'function' ? operadorDoTopo() : null;
    // Sem a fila pelo usuário (quadro 31): a pessoa escolhe uma vez "De quem é este dia?" e a escolha fica na mesma
    // lista guardada do "Ver o dia de" (pessoasHoje). Quem não é dono acompanha uma pessoa só.
    const escolhidos = !verComo && pessoasHoje.length && (souDono() || !eu) ? pessoasHoje.map((id) => time.find((u) => String(u.id) === id)).filter(Boolean) : [];
    const varios = souDono() ? escolhidos : escolhidos.slice(0, 1);
    const users = varios.length ? varios : [(verComo && time.find((u) => String(u.id) === verComo)) || eu].filter(Boolean);
    if (!users.length || typeof focusOwnItems !== 'function') return null;
    const porId = new Map();
    for (const user of users) {
      let lista = []; try { lista = focusOwnItems(user) || []; } catch { return null; }
      const ref = (d) => (typeof focusReferenceDate === 'function' ? focusReferenceDate(d, user) : (d.veiculacao_iso || d.prazo_iso || ''));
      for (const d of lista) {
        const k = String(d.id); if (!porId.has(k)) porId.set(k, { d, ref: ref(d), sit: situacaoDaPeca(d), quem: [] });
        porId.get(k).quem.push(String(user.name || user.nome || '').split(' ')[0]);
      }
    }
    return { user: users[0], users, itens: [...porId.values()].sort((a, b) => (a.ref || '9').localeCompare(b.ref || '9')) };
  }
  const somar = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const COR_SIT = (k) => `var(--sit-${k})`;
  // Linha de demanda, a mesma em todo o mundo (Hoje, agentes, clientes): barra e selo na cor do
  // status (status_color do quadro, a regra de sempre), cliente na cor da carteira do head
  // (tagClienteHtml), data em vermelho só se atrasou e o olhinho da prévia quando já há material.
  const semGrito = (t) => { const s = String(t || '').trim(); const letras = s.replace(/[^A-Za-zÀ-ÿ]/g, ''); return letras && letras === letras.toUpperCase() && letras.length > 4 ? s.charAt(0) + s.slice(1).toLowerCase() : s; };
  // Regra de cor dos status (Paulo, 08/11/2026: "para aprovação tá roxo"; auditoria 09/11, A5): a cor do quadro
  // (status_color, vybe_status.cor) e, sem ela, a do catálogo do painel pelo nome (corDeStatus). A escala de situação é o último recurso.
  const corDoCatalogo = (s) => (typeof corDeStatus === 'function' ? corDeStatus(s)?.cor : '') || '';
  const corStatus = (d, sit) => String(d?.status_color || '').match(/^#[0-9a-f]{3,8}$/i)?.[0] || corDoCatalogo(d?.status) || COR_SIT(sit || 'fazer');
  // Roteiro de cada peça (Paulo, 10/11/2026: "pegar o roteiro" sem sair do Hoje): a mesma lista da biblioteca de
  // roteiros (area=roteiros, vybe_roteiro_conteudos), lida uma vez e guardada por id da peça.
  let roteirosPorPeca = null, roteirosPedidos = false;
  function roteiroDaPeca(d) {
    if (!roteirosPedidos) {
      roteirosPedidos = true;
      fetch('/api/painel?area=roteiros', { credentials: 'same-origin', cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
        const m = new Map();
        for (const r of j?.roteiros || []) for (const c of r.conteudos || []) if (r.link && !m.has('vybe:' + c.id)) m.set('vybe:' + c.id, { link: r.link, titulo: r.titulo });
        roteirosPorPeca = m; pintarHoje();
      }).catch(() => { roteirosPorPeca = new Map(); });
    }
    return roteirosPorPeca?.get(String(d.id)) || null;
  }
  // O que dá para fazer na peça sem abrir a gaveta (Paulo, 10/11/2026: "quem está abrindo já consiga fazer tudo por aqui"):
  // trocar o status, o briefing (ou a etiqueta Sem briefing), o material bruto, entregar ou ver a prévia e o roteiro.
  // São os mesmos botões de Minhas tarefas (vybe-briefing.js, vybe-material.js, vybe-risco.js), não uma cópia.
  function acoesDaPeca(d) {
    const id = esc(String(d.id));
    const rot = roteiroDaPeca(d);
    const partes = [
      d.status ? `<button type="button" class="vv-demanda-status" onclick="openStatusEditor(event,'${id}')" title="Trocar o status" aria-label="Trocar o status: ${esc(d.status)}">${statusCor(d)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>` : '',
      typeof botaoDeBriefingHtml === 'function' ? botaoDeBriefingHtml(d) : '',
      typeof botaoDeMaterialBrutoHtml === 'function' ? botaoDeMaterialBrutoHtml(d) : '',
      typeof botaoDeEntregaHtml === 'function' ? botaoDeEntregaHtml(d) : '',
      rot ? `<a class="focus-brief-btn roteiro" href="${esc(rot.link)}" target="_blank" rel="noopener" title="${esc(rot.titulo || 'Roteiro')}">${typeof vbIcone === 'function' ? vbIcone('documento') : ''}<span>Roteiro</span></a>` : '',
    ].filter(Boolean).join('');
    return partes ? `<div class="vv-demanda-acoes" role="group" aria-label="Ações da peça">${partes}</div>` : '';
  }
  function linhaDemanda(d, { ref = '', sit = '', aviso = '', quem = null, acoes = false } = {}) {
    if (!d) return '';
    sit = sit || situacaoDaPeca(d); ref = ref || d.veiculacao_iso || d.prazo_iso || '';
    const hoje = hojeIso(), cor = corStatus(d, sit);
    const cli = (typeof clientesDoItem === 'function' ? clientesDoItem(d)[0] : d.cliente) || '';
    const tagCli = cli ? (typeof tagClienteHtml === 'function' ? tagClienteHtml(cli, { dentroDeBotao: true }) : `<span class="cliente-carteira">${esc(cli)}</span>`) : '';
    const quando = ref === hoje ? 'Hoje' : ref ? ref.slice(8) + '/' + ref.slice(5, 7) : '';
    // A data diz o que é (Paulo, 09/11/2026: "essa data é veiculação ou prazo?"): prazo é a entrega da equipe, No ar é a veiculação.
    const qual = !ref ? '' : ref === String(d.prazo_iso || '').slice(0, 10) ? 'Prazo' : ref === String(d.veiculacao_iso || '').slice(0, 10) ? 'No ar' : '';
    const olho = typeof botaoDePreviaNaLinha === 'function' ? botaoDePreviaNaLinha(d, 'linha-previa vv-olho') : '';
    return `<div class="vv-demanda${sit === 'atrasada' ? ' atrasada' : ''}" style="--st:${esc(cor)}">
      <button type="button" class="vv-demanda-abrir" data-hoje-acao="peca" data-valor="${esc(d.id)}" title="${esc(String(d.nome || '') + (cli ? ' · ' + cli : '') + (d.status ? ' · ' + d.status : ''))}">
        <b>${esc(semGrito(d.nome || d.titulo || 'Peça'))}</b>
        <span class="vv-demanda-meta">${quem?.length ? `<span class="vv-demanda-quem">${esc(quem.join(', '))}</span>` : ''}${tagCli}${d.status && !acoes ? statusCor(d) : ''}${aviso ? `<span class="vv-demanda-aviso">${esc(aviso)}</span>` : ''}</span>
      </button>
      <span class="vv-demanda-lado">${olho}${quando ? `<time${sit === 'atrasada' ? ' class="atrasada"' : ''}>${qual ? `<i>${qual}</i> ` : ''}${esc(quando)}</time>` : ''}</span>
      ${acoes ? acoesDaPeca(d) : ''}
    </div>`;
  }
  // ---------- Visão do dono (Paulo, Vinícius, Ewerton e Deivid) ----------
  // Paulo, 07/11/2026: quando os sócios abrem o sistema, a primeira coisa é a agência (produção do dia,
  // semana, clientes com problema, gargalos, o que cobrar de cada um e dos bots), não a fila pessoal.
  // "Minhas tarefas" continua a um toque. Os números vêm de VybeDono.calcular (vybe-dono-metricas.js).
  // Dono pela informação do servidor (sessão, server/donos.js), não pelo primeiro nome.
  // Primeiro nome só para casar a agenda e os filtros por pessoa (NUNCA para decidir dono).
  const primeiroNome = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().split(/\s+/)[0];
  function souDonoDeVerdade() {
    try { return typeof souDonoDaSessao === 'function' && souDonoDaSessao(); } catch { return false; }
  }
  // Ver como (Paulo, 09/11/2026: "os donos podem alterar pra ver como qualquer perfil pra conferir como tá tudo e como
  // cada um tá vendo"): só a TELA muda (Hoje, dock com cadeados, números de dono). O servidor continua decidindo pela
  // sessão de verdade: nada que o dono pede vira permissão de outra pessoa nem o contrário. Dura a aba aberta.
  let verComo = '';
  try { verComo = sessionStorage.getItem('vybe.verComo') || ''; } catch { verComo = ''; }
  const timeDoPainel = () => (typeof TEAM_USERS !== 'undefined' && Array.isArray(TEAM_USERS) ? TEAM_USERS : []);
  const pessoaVista = () => (verComo ? timeDoPainel().find((u) => String(u.id) === String(verComo)) || null : null);
  // Dono na tela: sem "ver como", a sessão; vendo como alguém, o que essa pessoa é (o servidor manda `dono` na equipe;
  // sem o campo, a pessoa vista conta como equipe).
  function souDono() {
    const dono = souDonoDeVerdade();
    if (!verComo || !dono) return dono;
    return pessoaVista()?.dono === true;
  }
  // Quem pode trocar: os donos e quem administra (o "ver como" do Hoje já era de quem administra).
  const podeVerComo = () => souDonoDeVerdade() || (typeof souAdmin === 'function' && souAdmin());
  function conferirVerComo() { if (verComo && !podeVerComo()) definirVerComo(''); }
  function definirVerComo(id) {
    if (!podeVerComo()) id = '';
    verComo = String(id || '');
    try { if (verComo) sessionStorage.setItem('vybe.verComo', verComo); else sessionStorage.removeItem('vybe.verComo'); } catch { /* sem guardar */ }
    diaEscolhido = ''; cacheDono = { chave: '', valor: null };
    aplicarCadeados(); marcarVerComo(); pintarHoje();
    if (!gestao.hidden && !souDono()) fecharGestao();
  }
  // Negócio e parte do Time são só dos donos. Paulo, 11/11/2026: "os módulos que não é pra todos ter acesso, ao invés de
  // ficar turvo e com cadeado, eles nem vão aparecer pra quem não tem acesso" (antes, em 09/11, apareciam borrados).
  // O item some do dock (CSS, classe trancado) e o título do grupo que ficou vazio some junto. Ficam para todos os
  // itens do Time que são de todos: Produtividade (o próprio mês), Pedidos e calendário, Equipe online e Academy.
  const TRANCADOS = new Set(['setor:comercial', 'setor:financas', 'setor:gestao', 'agentes', 'recrutamento', 'documentos', 'visao:setor:pessoas']);
  function aplicarCadeados() {
    const fechado = !souDono();
    hud.querySelectorAll?.('.vv-trilho [data-trilho], .vv-trilho [data-submodulo], .vv-trilho [data-visao-setor]').forEach((b) => {
      const id = b.dataset.trilho || b.dataset.submodulo || (b.dataset.visaoSetor ? 'visao:' + b.dataset.visaoSetor : '');
      const tranca = fechado && TRANCADOS.has(id);
      // Só mexe quando muda: regravar a classe dispara os observadores do HUD, que repintam o Hoje (laço sem fim).
      if (b.classList.contains('trancado') === tranca) return;
      b.classList.toggle('trancado', tranca);
      // A dica do mouse e o nome lido também não revelam a área trancada.
      if (tranca) {
        if (b.dataset.tituloAberto === undefined) { b.dataset.tituloAberto = b.getAttribute('title') || ''; b.dataset.rotuloAberto = b.getAttribute('aria-label') || ''; }
        b.setAttribute('aria-disabled', 'true'); b.setAttribute('title', 'Só os donos veem'); b.setAttribute('aria-label', 'Área dos donos, trancada');
      } else {
        b.removeAttribute('aria-disabled');
        if (b.dataset.tituloAberto !== undefined) {
          if (b.dataset.tituloAberto) b.setAttribute('title', b.dataset.tituloAberto); else b.removeAttribute('title');
          if (b.dataset.rotuloAberto) b.setAttribute('aria-label', b.dataset.rotuloAberto); else b.removeAttribute('aria-label');
          delete b.dataset.tituloAberto; delete b.dataset.rotuloAberto;
        }
      }
    });
    // Setor escondido não deixa a lista dele aberta; grupo sem nenhum item à vista perde o título. Só mexe quando muda.
    hud.querySelectorAll?.('.vv-trilho-sub[data-sub-de]').forEach((s) => { if (!s.hidden && hud.querySelector(`.vv-trilho [data-trilho="${s.dataset.subDe}"]`)?.classList.contains('trancado')) s.hidden = true; });
    hud.querySelectorAll?.('.vv-trilho-grupo[data-grupo]').forEach((g) => {
      const itens = [...hud.querySelectorAll(`.vv-trilho > .vv-trilho-btn[data-grupo="${g.dataset.grupo}"]`)];
      const vazio = itens.length > 0 && itens.every((b) => b.classList.contains('trancado'));
      if (g.hidden !== vazio) g.hidden = vazio;
    });
    pintarFavoritos();
  }
  // ---------- Favoritos do dock: cada pessoa guarda os seus, neste navegador ----------
  const FAV_MAX = 12;
  const chaveFav = () => 'vybe.mundo.favoritos.' + (String((typeof operadorDoTopo === 'function' ? operadorDoTopo()?.id : '') || '') || 'anon');
  function lerFavoritos() {
    try { const v = JSON.parse(localStorage.getItem(chaveFav()) || '[]'); return Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string'))].slice(0, FAV_MAX) : []; }
    catch { return []; }
  }
  function itemDoDock(id) {
    const topo = TRILHO.find((t) => favoritavel(t) && t.id === id);
    if (topo) return { id, nome: topo.nome, ic: topo.ic, de: '', setor: '', url: topo.url || '' };
    const sub = SUBMODULOS.find((x) => x.id === id); if (!sub) return null;
    const setor = TRILHO.find((t) => t && typeof t === 'object' && t.id === sub.setor);
    return { id, nome: sub.nome, ic: setor?.ic || '', de: setor?.nome || '', setor: sub.setor, url: sub.url || '', sub };
  }
  // Favorito de área que a pessoa não abre (ou de módulo que não carregou) não aparece.
  const favVisivel = (x) => Boolean(x) && (souDono() || !(TRANCADOS.has(x.id) || TRANCADOS.has(x.setor))) && (!x.sub || subVisivel(x.sub));
  function alternarFavorito(id) {
    if (!itemDoDock(id)) return;
    const l = lerFavoritos(), i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1);
    else if (l.length >= FAV_MAX) { chamar('showToast', `Cabem ${FAV_MAX} favoritos. Tire um para pôr outro.`, 'info', 3500); return; }
    else l.push(id);
    try { localStorage.setItem(chaveFav(), JSON.stringify(l)); } catch { chamar('showToast', 'Este navegador não deixou guardar o favorito.', 'info', 3500); return; }
    pintarFavoritos();
  }
  let favPintado = '';
  function pintarFavoritos() {
    const el = hud.querySelector?.('.vv-trilho-fav'); if (!el) return;
    const ids = lerFavoritos(), itens = ids.map(itemDoDock).filter(favVisivel);
    // Só repinta quando muda (pessoa, lista ou acesso): mexer no dock dispara os observadores do HUD.
    const marca = () => [chaveFav(), ids.join(','), itens.map((x) => x.id).join(','), el.childElementCount].join('|');
    if (marca() === favPintado) return;
    el.innerHTML = itens.length ? '<span class="vv-trilho-grupo">Favoritos</span>' + itens.map((x) => `<button type="button" class="vv-trilho-fav-item" data-fav-ir="${esc(x.id)}" title="${esc(x.de ? x.de + ': ' + x.nome : x.nome)}">${x.ic}<span>${esc(x.nome)}</span>${x.de ? `<small>${esc(x.de)}</small>` : ''}${x.url ? '<i class="vv-trilho-fora" aria-hidden="true">↗</i>' : ''}${estrela(x.id)}</button>`).join('') : '';
    el.hidden = !itens.length;
    hud.querySelectorAll('.vv-trilho [data-fav]').forEach((s) => { const on = ids.includes(s.dataset.fav); if (s.classList.contains('on') !== on) { s.classList.toggle('on', on); s.setAttribute('title', on ? 'Tirar dos favoritos' : 'Pôr nos favoritos'); } });
    favPintado = marca();
  }
  function irAoFavorito(id) {
    const x = itemDoDock(id); if (!favVisivel(x)) return;
    if (x.setor && dockLargo()) expandirSetor(x.setor);
    usarTrilho(id); if (!x.url) marcarTrilho(id);
  }
  function avisarTrancado(b) {
    chamar('showToast', verComo ? `${pessoaVista()?.name || 'Esta pessoa'} não abre isto: só os donos veem.` : 'Só os donos veem esta área.', 'info', 3500);
    b.classList.remove('tremer'); void b.offsetWidth; b.classList.add('tremer');
  }
  // Faixa no topo enquanto o dono vê como outra pessoa, com o botão de voltar.
  function marcarVerComo() {
    let f = hud.querySelector?.('.vv-vendo-como');
    const p = pessoaVista();
    if (!p) { f?.remove(); if (body.classList.contains('vendo-como')) body.classList.remove('vendo-como'); return; }
    if (!f) { f = document.createElement('div'); f.className = 'vv-vendo-como'; f.setAttribute('role', 'status'); hud.querySelector('.vv-barra-topo')?.after?.(f); }
    const novo = `<span>Vendo como <b>${esc(p.name || p.nome || 'pessoa')}</b>${p.dono === true ? '' : ' · equipe'}</span><button type="button" data-ver-como-sair>Voltar para mim</button>`;
    if (f.vvHtml !== novo) { f.innerHTML = novo; f.vvHtml = novo; }
    if (!body.classList.contains('vendo-como')) body.classList.add('vendo-como');
  }
  let visaoHoje = (() => { try { return localStorage.getItem('vybe.mundo.visaoHoje') || 'agencia'; } catch { return 'agencia'; } })();
  // Pendências do WhatsApp (vybe-mundo-pendencias.js) chegaram: repinta o Hoje (atendimento na Agência, "esperando você").
  document.addEventListener('vybe:pendencias', () => pintarHoje());
  // Aprovações paradas (vybe-mundo-aprovacoes.js): o bloco entra logo de cara no Seu dia.
  document.addEventListener('vybe:aprovacoes', () => pintarHoje());
  // O assistente da Criação (vybe-mundo-criacao.js) aprovou, adiou ou leu os achados do Danilo: repinta o Hoje.
  document.addEventListener('vybe:criacao', () => pintarHoje());
  // Ver o dia de várias pessoas (Paulo, 09/11/2026: "consigo adicionar e remover pessoas... ver o dia de Deivid, Jady,
  // meu e de Ewerton, ou só de quem eu quiser, nessa mesma aba"). Só para os donos; fica guardado no navegador de quem olha.
  const CHAVE_PESSOAS = 'vybe.hoje.pessoas';
  let pessoasHoje = (() => { try { const l = JSON.parse(localStorage.getItem(CHAVE_PESSOAS) || '[]'); return Array.isArray(l) ? l.map(String) : []; } catch { return []; } })();
  function definirPessoasHoje(lista) { pessoasHoje = [...new Set(lista.map(String))]; try { localStorage.setItem(CHAVE_PESSOAS, JSON.stringify(pessoasHoje)); } catch { /* fica só nesta tela */ } pintarHoje(); }
  const timeDeCriacao = () => (typeof EQUIPES !== 'undefined' ? [...EQUIPES.design, ...EQUIPES.audiovisual] : []).map(String);
  // Quem guia (Paulo, 09/11/2026: "abrir minhas tarefas e ter alguém ali me falando: faz isso primeiro, depois aquilo...
  // você define nessa arquitetura quem seria o ideal"): o agente do setor da pessoa, pela planta do prédio. Criação
  // (design) → Danilo; edição → Lucas; o time de criação junto → Danilo; agendamento → Mateus; donos e o resto → VYBES.
  function guiaDe(users) {
    const ids = users.map((u) => String(u.id)), E = typeof EQUIPES !== 'undefined' ? EQUIPES : {}, P = typeof PESSOAS !== 'undefined' ? PESSOAS : {};
    const todosEm = (l) => ids.length > 0 && ids.every((i) => (l || []).map(String).includes(i));
    if (todosEm(E.design)) return { nome: 'Danilo', papel: 'Direção de Arte · guia da Criação', setor: 'design' };
    if (todosEm(E.audiovisual)) return { nome: 'Lucas', papel: 'Edição · guia da Pós-produção', setor: 'edicao' };
    if (todosEm(timeDeCriacao())) return { nome: 'Danilo', papel: 'Direção de Arte · guia da Criação', setor: 'design' };
    if (ids.length === 1 && ids[0] === String(P.TAINARA || '')) return { nome: 'Mateus', papel: 'Atendimento · guia do agendamento', setor: 'concierge' };
    return { nome: 'VYBES', papel: 'Orquestrador · guia do dia', setor: 'orquestrador' };
  }
  // A ordem do guia (a mesma da fila: a data do cliente manda) e o porquê de cada passo. Minhas tarefas e Criação usam esta.
  const veicDe = (x) => String(x.d.veiculacao_iso || '');
  const prazoDesatualizado = (x, hoje) => Boolean(x.d.prazo_iso && x.d.prazo_iso < hoje && veicDe(x) && veicDe(x) >= hoje);
  const chaveDaFila = (x, hoje) => (veicDe(x) && veicDe(x) < hoje ? '0' : '1') + (veicDe(x) || x.d.prazo_iso || '9999');
  const diaMes = (iso) => (iso ? String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) : '');
  function pesoNoGuia(x, hoje) {
    const v = veicDe(x), st = String(x.d.status || ''), amanha = somar(hoje, 1);
    if (x.sit === 'atrasada' && v && v < hoje) return 0; if (x.sit === 'atrasada' && !prazoDesatualizado(x, hoje)) return 1; if (v === hoje) return 2;
    if (/altera|ajuste|corre/i.test(st)) return 3; if (/aprova/i.test(st)) return 4; if (v === amanha) return 5; return 6;
  }
  function motivoNoGuia(x, hoje) {
    const v = veicDe(x), st = String(x.d.status || '');
    if (x.sit === 'atrasada' && v && v < hoje) return `Furou a data do cliente (ia ao ar ${diaMes(v)})`;
    if (x.sit === 'atrasada' && !prazoDesatualizado(x, hoje)) return `Prazo venceu em ${diaMes(x.d.prazo_iso)}${v ? ' · vai ao ar ' + (v === hoje ? 'hoje' : diaMes(v)) : ''}`;
    if (v === hoje) return 'Vai ao ar hoje'; if (/altera|ajuste|corre/i.test(st)) return 'Pediram ajuste: devolva antes de começar outra';
    if (/aprova/i.test(st)) return 'Esperando aprovação'; if (v === somar(hoje, 1)) return 'Vai ao ar amanhã'; return v ? 'Vai ao ar ' + diaMes(v) : 'Sem data do cliente';
  }
  function passosDoGuia(itens, hoje, comQuem = false) {
    const ordem = itens.slice().sort((a, b) => pesoNoGuia(a, hoje) - pesoNoGuia(b, hoje) || chaveDaFila(a, hoje).localeCompare(chaveDaFila(b, hoje)));
    const cli = (x) => (typeof clientesDoItem === 'function' ? clientesDoItem(x.d)[0] : x.d.cliente) || '';
    return { ordem, urgentes: ordem.filter((x) => pesoNoGuia(x, hoje) <= 1).length,
      passos: ordem.slice(0, 3).map((x) => ({ attrs: `data-hoje-acao="peca" data-valor="${esc(x.d.id)}"`,
        titulo: `${esc(String(x.d.nome || x.d.titulo || 'Peça').trim())}${cli(x) ? ' ' + cliCor(cli(x)) : ''}`,
        motivo: esc(motivoNoGuia(x, hoje)) + (comQuem && x.quem?.length ? ' · ' + esc(x.quem.join(', ')) : '') })) };
  }
  // As abas do Hoje para os donos: Agência (a agência inteira), Criação (o time do Deivid) e Minhas tarefas.
  function segHoje(atual) {
    const aba = (id, rot) => `<button type="button" role="tab" aria-selected="${atual === id}" data-visao-hoje="${id}">${rot}</button>`;
    return `<div class="vv-seg vv-seg-3" role="tablist" aria-label="O que ver">${aba('agencia', 'Agência')}${aba('criacao', 'Criação')}${aba('tarefas', 'Minhas tarefas')}</div>`;
  }
  // O guia: o agente, uma frase e os passos numerados (Agora, Depois, Em seguida), cada um abre o que precisa ser feito.
  function guiaHtml({ agente, intro, passos = [], depois = '', conversa = '', comecar = false }) {
    const av = agente.nome === 'VYBES' ? '<span class="vv-ser vg-av-ser" aria-hidden="true"><i></i></span>' : `<span class="vg-av" aria-hidden="true">${esc(agente.nome.slice(0, 1))}</span>`;
    const quando = ['Agora', 'Depois', 'Em seguida'];
    return `<section class="vg-guia" aria-label="Guia de ${esc(agente.nome)}"><div class="vg-cab">${av}<span class="vg-quem"><b>${esc(agente.nome)}</b><small>${esc(agente.papel)}</small></span>
        ${agente.nome !== 'VYBES' && souDono() ? `<button type="button" class="vg-agente" data-pend-agente="${esc(agente.setor)}">Ver o agente</button>` : ''}${comecar && passos[0] ? `<button type="button" class="vg-comecar" ${passos[0].attrs}>Começar</button>` : ''}</div>
      ${conversa || `<p class="vg-intro">${intro}</p>`}
      ${passos.length ? `<ol class="vg-passos">${passos.map((p, i) => `<li${i === 0 ? ' class="agora"' : ''}><button type="button" class="vg-passo" ${p.attrs}><span class="vg-num" aria-hidden="true">${i + 1}</span><span class="vg-meio"><small>${quando[i] || 'Depois'}</small><b>${p.titulo}</b><em>${p.motivo}</em></span><span class="vg-ir" aria-hidden="true">→</span></button></li>`).join('')}</ol>` : ''}
      ${depois ? `<p class="vg-depois">${depois}</p>` : ''}</section>`;
  }
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
  // Plural certo (Padrão Vybe): o rótulo que acompanha o número, no singular quando é 1 ("1 peça em aberto").
  const plural = (n, um, varios) => `${n0(n)} ${Number(n) === 1 ? um : varios}`;
  const rotuloDe = (n, um, varios) => (Number(n) === 1 ? um : varios);
  // Número grande só quando pede ação (Padrão Vybe, quadro 00 do moodboard): no radar do Hoje, o cartão de zero vira
  // uma linha discreta (vbResumoHtml, o desenho da Visão geral da Produção). Nenhum número some: o zero continua
  // escrito, com o que ele conta, e o que tem lista por trás continua abrindo (espiar).
  // itens: os mesmos do cartão (V.kpi) mais `n` (o número) e `zero` (o texto do zero).
  function radarHtml(V, itens) {
    const cheios = itens.filter((x) => Number(x.n) > 0), zeros = itens.filter((x) => !(Number(x.n) > 0));
    const cartoes = (l) => (l.length ? `<div class="vs-kpis vv-dono-radar">${l.map((x) => V.kpi(x)).join('')}</div>` : '');
    if (typeof vbResumoHtml !== 'function') return cartoes(itens);
    return cartoes(cheios) + (zeros.length ? `<div class="vs-resumo vv-radar-zeros">${vbResumoHtml(zeros.map((x) => ({ valor: 0, rotulo: x.zero, espiar: x.espiar || '' })))}</div>` : '');
  }
  // Padrão v2 (moodboard B1 e B2, Paulo, 12/11/2026): no alto da tela ficam três números, não seis. Cada um diz uma
  // coisa do dia, o que tem meta ganha a barra, e o que está zerado continua no lugar, só apagado (a tela não muda de
  // forma de um dia para o outro). O que saiu dos cartões vai para a linha "Também de olho" (olhoHtml).
  function tresNumerosHtml(itens) {
    return `<div class="v2-tres" role="group" aria-label="Os números do dia">${itens.filter(Boolean).map((x) => {
      const tag = x.attrs ? 'button' : 'div';
      return `<${tag}${x.attrs ? ' type="button" ' + x.attrs : ''} class="v2-tres-c${x.quieto ? ' quieto' : x.tom ? ' ' + x.tom : ''}"><small>${esc(x.titulo)}</small><b><span class="v2-num">${x.valor}</span>${x.junto ? ` <i>${x.junto}</i>` : ''}</b>${x.barra != null ? `<span class="v2-barra" style="--v:${Math.max(0, Math.min(100, Math.round(x.barra)))}%${x.cor ? `;--c:${x.cor}` : ''}"><i></i></span>` : ''}${x.sub ? `<em>${x.sub}</em>` : ''}</${tag}>`;
    }).join('')}</div>`;
  }
  // "Para você decidir" (quadro B1): as peças em aprovação interna como baralho, na ordem da data do cliente. A lista é a
  // de VybeAprovacoes (a mesma do módulo Conteúdo); decidir abre os portões de sempre, nada grava direto daqui.
  let decidirEm = 0;
  const previasDecidir = {};
  function filaDecidir() {
    const d = window.VybeAprovacoes?.estado?.().dados; if (!d) return null;
    const painel = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : [];
    return (d.pecas || []).filter((i) => i.etapa === 'interna').map((i) => ({ ...i, item: i.quadro === 'demandas' ? null : painel.find((x) => String(x.id) === String(i.ref)) || null }))
      .filter((i) => !i.item || /aprova/i.test(String(i.item.status || '')))
      .sort((a, b) => String(a.veiculacao || a.prazo || '9').localeCompare(String(b.veiculacao || b.prazo || '9')) || (b.horas ?? -1) - (a.horas ?? -1));
  }
  function previaDecidir(ref) {
    if (ref in previasDecidir) return previasDecidir[ref];
    previasDecidir[ref] = undefined;
    if (String(ref).startsWith('vybe:')) { previasDecidir[ref] = null; return null; }
    fetch(`/api/painel?area=arquivos&itens=${encodeURIComponent(ref)}`, { credentials: 'same-origin', cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
      .then((j) => { previasDecidir[ref] = j?.itens?.[ref]?.thumb || null; }).catch(() => { previasDecidir[ref] = null; }).finally(() => { if (visaoHoje !== 'tarefas') pintarHoje(); });
    return undefined;
  }
  const posDecidir = (k) => (k < decidirEm ? 'fora' : k - decidirEm <= 2 ? String(k - decidirEm) : '');
  function quandoVeiculaTxt(i) {
    const v = String(i.veiculacao || '').slice(0, 10), h = hojeIso();
    if (!v) return i.prazo ? `prazo ${i.prazo.slice(8, 10)}/${i.prazo.slice(5, 7)}` : 'sem data do cliente';
    if (v < h) return `ia ao ar ${v.slice(8)}/${v.slice(5, 7)}`;
    return v === h ? 'veicula hoje' : v === somar(h, 1) ? 'veicula amanhã' : `veicula ${v.slice(8)}/${v.slice(5, 7)}`;
  }
  function decidirHtml({ titulo = 'Para você decidir', artes = false } = {}) {
    const fila = filaDecidir();
    const topo = (sub) => `<div class="v2d-topo"><h3>${titulo}</h3><small>${sub}</small></div>`;
    if (!fila) return `<aside class="v2d" aria-label="Para você decidir">${topo('lendo as aprovações')}</aside>`;
    if (!fila.length) return `<aside class="v2d" aria-label="Para você decidir">${topo('nada em Para aprovação')}<p class="v2d-vazio">Nenhuma peça espera a sua aprovação agora.</p></aside>`;
    decidirEm = Math.max(0, Math.min(decidirEm, fila.length - 1));
    const carta = (i, k) => { const pos = posDecidir(k), t = pos && pos !== 'fora' ? previaDecidir(String(i.ref)) : previasDecidir[String(i.ref)];
      return `<article class="v2-carta v2d-carta"${pos ? ` data-pos="${pos}"` : ''} data-carta="${k}" aria-hidden="${pos !== '0'}"><div class="v2d-arte">${t ? `<img src="${esc(t)}" alt="Prévia de ${esc(i.titulo)}" loading="lazy">` : `<span>${t === null ? esc(i.formato || 'Peça') + ' · sem arquivo anexado' : 'buscando a prévia'}</span>`}</div>
        <p><b>${esc(i.titulo)}</b><small>${i.cliente ? cliCor(i.cliente) + ' · ' : ''}${esc(quandoVeiculaTxt(i))}${i.heads?.length ? ' · head ' + esc(i.heads.map((h) => h.nome).join(', ')) : ''}</small></p></article>`; };
    const porCli = new Map(); for (const i of fila) porCli.set(i.cliente || 'Sem cliente', (porCli.get(i.cliente || 'Sem cliente') || 0) + 1);
    const antiga = Math.max(...fila.map((i) => i.horas ?? 0));
    return `<aside class="v2d" aria-label="Para você decidir">${topo(artes ? `${n0(fila.length)} ${rotuloDe(fila.length, 'arte', 'artes')}` : `${n0(fila.length)} ${rotuloDe(fila.length, 'peça', 'peças')} em Para aprovação`)}
      <div class="v2-baralho v2d-baralho" tabindex="0" aria-label="Peças para decidir: as setas do teclado passam">${fila.map(carta).join('')}</div>
      <div class="v2d-acoes"><button type="button" class="v2t-btn g" data-hoje-acao="decidir" data-valor="alterar">Pedir alteração</button><button type="button" class="v2t-btn g k" data-hoje-acao="decidir" data-valor="aprovar">Aprovar</button></div>
      <div class="v2d-conta"><span class="v2-pontos" aria-hidden="true">${fila.length <= 10 ? fila.map((_, k) => `<i${k === decidirEm ? ' class="on"' : ''}></i>`).join('') : ''}</span><small><span data-decidir-conta>${decidirEm + 1} de ${fila.length}</span> · seta para os lados passa · <button type="button" class="vg-link" data-hoje-acao="decidir-lista">ver em lista</button></small></div>
      ${artes ? '' : `<div class="v2d-fila"><small>Na fila, por cliente</small><p>${[...porCli.entries()].slice(0, 4).map(([c, n]) => `<span>${cliCor(c)} · ${n}</span>`).join('')}</p>
        <small>${antiga >= 1 ? `A mais antiga espera há ${antiga < 48 ? antiga + ' h' : Math.round(antiga / 24) + ' dias'}. ` : ''}Aprovada, a peça segue para agendar.</small></div>`}</aside>`;
  }
  function passarDecidir(para) {
    const fila = filaDecidir() || [], novo = Math.max(0, Math.min(para, fila.length - 1));
    if (!fila.length || novo === decidirEm) return;
    decidirEm = novo;
    if (fila.slice(novo, novo + 3).some((i) => !(String(i.ref) in previasDecidir))) { pintarHoje(); return; }
    const raiz = hud.querySelector('#vv-hoje .v2d'); if (!raiz) return;
    raiz.querySelectorAll('[data-carta]').forEach((c) => { const pos = posDecidir(Number(c.dataset.carta)); if (pos) c.dataset.pos = pos; else delete c.dataset.pos; c.setAttribute('aria-hidden', String(pos !== '0')); });
    raiz.querySelectorAll('.v2-pontos > i').forEach((x, k) => x.classList.toggle('on', k === novo));
    const conta = raiz.querySelector('[data-decidir-conta]'); if (conta) conta.textContent = `${novo + 1} de ${fila.length}`;
  }
  function decidirPeca(acao) {
    const i = (filaDecidir() || [])[decidirEm]; if (!i) return;
    const alvo = acao === 'aprovar' ? 'para agendar' : 'alteração';
    const opcoes = i.item && typeof operationalStatusOptions === 'function' ? operationalStatusOptions(i.item) : [];
    const opcao = opcoes.find((o) => String(o.label || '').trim().toLowerCase() === alvo);
    const portao = acao === 'aprovar' ? globalThis.openQualityGate : globalThis.openStatusContextGate;
    if (!i.item || !opcao || typeof portao !== 'function') { chamar('showToast', 'Abri a peça: a decisão dela é por lá.', 'info'); chamar(i.quadro === 'demandas' ? 'openDemandaWorkspace' : 'openItemWorkspace', String(i.ref)); return; }
    portao(i.item, opcao);
  }
  document.addEventListener('vybe:aprovacoes', () => { if (visaoHoje !== 'tarefas') pintarHoje(); });
  function olhoHtml(itens) {
    const l = itens.filter((x) => Number(x.n) > 0);
    return l.length ? `<p class="v2-olho"><span>Também de olho:</span>${l.map((x) => `<button type="button" ${x.attrs || `data-espiar="${esc(x.espiar)}"`}><b>${n0(x.n)}</b> ${esc(x.rotulo)}</button>`).join('')}</p>` : '';
  }
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
    return d ? corStatus(d, situacaoDaPeca(d)) : corDoCatalogo(p?.status) || '#9AA3A8';
  }
  function mostrarPendencias(cliente = '', status = '') {
    const N = numerosDoDono(); if (!N) return;
    const c = cliente ? N.clientes.find((c) => c.cliente === cliente) : null;
    const g = status ? N.gargalos.find((g) => g.status === status) : null;
    if (!c && !g) return;
    if (!gestao.hidden) fecharGestao();
    const lista = c ? c.pendencias : g.lista, titulo = c ? c.cliente : g.status;
    const motivos = c ? c.motivos : [`${g.qtd} peça${Number(g.qtd) === 1 ? '' : 's'} neste status · ${Number(g.idadeMedianaDias) === 1 ? '1 dia parada' : `${g.idadeMedianaDias} dias paradas`} (mediana)`];
    const p = placa();
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button><h3>${esc(titulo)}</h3><p class="vv-sub">${c ? 'O que pede atenção' : 'Demandas neste gargalo'}</p>
      <ul class="vv-pendencia-motivos">${motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <div class="vv-pendencias-lista">${lista.length ? lista.map((d) => `<button type="button" class="vv-pendencia" style="--st:${esc(corDaPendencia(d))}" data-hoje-acao="peca" data-valor="${esc(d.id)}"><b>${esc(d.nome)}</b><span class="vv-pendencia-status">${statusCor(d)}</span><small>${cliCor(d.cliente)}</small><dl><div><dt>Responsável</dt><dd>${esc(d.responsavel || 'Sem responsável')}</dd></div><div><dt>Prazo</dt><dd>${esc(dataCompleta(d.prazo_iso))}</dd></div><div><dt>Veiculação</dt><dd>${esc(dataCompleta(d.veiculacao_iso))}</dd></div></dl>${d.motivos?.length ? `<small>${esc(d.motivos.join(' · '))}</small>` : ''}<span class="vv-pendencia-abrir">Abrir demanda →</span></button>`).join('') : '<p class="vv-vazio">Os alertas acima não têm uma demanda específica vinculada. Confira a cobertura de conteúdo e o planejamento do cliente.</p>'}</div>
      ${c ? `<button type="button" class="vv-botao" data-abrir-cliente="${esc(c.cliente)}">Abrir o cliente →</button>` : ''}`;
    p.hidden = false; ajustarAreaLivre();
  }
  // Gráfico de barras da semana: previstas (cinza) e entregues (verde), um par por dia.
  function barrasSemana(porDia = [], { w = 300, h = 86 } = {}) {
    const max = Math.max(1, ...porDia.map((d) => Math.max(d.previstas || 0, d.entregues || 0)));
    const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'], hoje = hojeIso();
    const bw = w / Math.max(1, porDia.length);
    // Quantidade em cima de cada barra (Paulo, 08/11: "o número de quantos, pra eu ter ideia de quantidade").
    const T = 13, num = (v, cx, y, cls) => v ? `<text x="${cx}" y="${Math.max(9, y - 3)}" text-anchor="middle" class="vv-graf-n ${cls}">${v}</text>` : '';
    return `<svg class="vv-graf" viewBox="0 0 ${w} ${h + 16 + T}" role="img" aria-label="Previstas e entregues por dia da semana">
      <g transform="translate(0 ${T})">
      ${porDia.map((d, i) => { const x = i * bw, hp = (d.previstas || 0) / max * h, he = (d.entregues || 0) / max * h, eHoje = d.dia === hoje;
        return `<g><title>${esc(d.dia)}: ${plural(d.previstas || 0, 'prevista', 'previstas')}, ${plural(d.entregues || 0, 'entregue', 'entregues')}</title>
          <rect x="${x + bw * .14}" y="${h - hp}" width="${bw * .34}" height="${Math.max(hp, 1.5)}" rx="2" fill="#E1DACE"/>
          <rect x="${x + bw * .52}" y="${h - he}" width="${bw * .34}" height="${Math.max(he, 1.5)}" rx="2" fill="#18A957"/>
          ${num(d.previstas || 0, x + bw * .31, h - hp, 'pv')}${num(d.entregues || 0, x + bw * .69, h - he, 'en')}
          <text x="${x + bw / 2}" y="${h + 13}" text-anchor="middle" class="${eHoje ? 'hoje' : ''}">${DIAS[i] || ''}</text></g>`; }).join('')}
      </g>
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
      ${pts.map((v, i) => `<circle cx="${px(i)}" cy="${py(v)}" r="${i === pts.length - 1 ? 4.5 : 3}" class="${i === pts.length - 1 ? 'atual' : 'pt'}"><title>${esc(semanas[i].inicio || '')}: ${plural(v, 'entregue', 'entregues')}${semanas[i].noPrazo != null ? ', ' + semanas[i].noPrazo + ' no prazo' : ''}</title></circle>`).join('')}
      ${proj.map((v, i) => `<circle cx="${px(pts.length + i)}" cy="${py(v)}" r="3" class="ptproj"><title>${esc(projecao[i].inicio || '')}: ${v} previstas</title></circle>`).join('')}
      ${semanas.map((s, i) => i % 2 === 0 || i === pts.length - 1 ? `<text x="${px(i)}" y="${h - 2}" text-anchor="middle" class="eixo">${esc(String(s.inicio || '').slice(8, 10) + '/' + String(s.inicio || '').slice(5, 7))}</text>` : '').join('')}
    </svg>`;
  }
  const pecaCurta = (p) => `${esc(p.nome || 'Peça')}${p.cliente ? ' · ' + cliCor(p.cliente) : ''}`;
  function botsParaCobrar() {
    let f = null; try { f = fonteAgentes?.ler(); } catch { f = null; } if (!f?.dados?.agentes) return { sinal: false, lista: [] };
    const lista = f.dados.agentes.map((a) => ({ a, e: estadoDoAgente(a.setor) })).filter(({ e }) => ['falhou', 'aguardando_aprovacao'].includes(e.estado))
      .map(({ a, e }) => ({ nome: a.agente || a.setor, andar: a.andar, setor: a.setor, estado: e.estado, texto: e.estado === 'falhou' ? 'falhou na última execução' + (e.ultimos?.[0]?.erro ? ': ' + e.ultimos[0].erro : '') : 'esperando sua aprovação' + (e.tarefa ? ': ' + e.tarefa : '') }));
    return { sinal: !f.erro, lista };
  }
  // Detalhe de um dia da semana (Paulo, 08/11/2026: "clicar e abrir o hover com os detalhes… as demandas do dia separadas
  // por status e responsável"): mesmo mini painel dos números (espiar). Clicar numa peça abre a peça.
  PROVEDORES_DIA: {
    const prov = (window.VybeEspiarProvedores = window.VybeEspiarProvedores || {});
    // Peças em blocos por status (a cor do quadro), com cliente e responsável; clicar abre a peça.
    const pecasEmBlocos = (itens) => {
      const grupos = new Map();
      for (const d of itens) { const st = String(d.status || 'Sem status').trim() || 'Sem status'; if (!grupos.has(st)) grupos.set(st, []); grupos.get(st).push(d); }
      const ordem = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length), lista = ordem.flatMap(([, l]) => l);
      let i = 0;
      const corpo = ordem.map(([, l]) => `<section class="vv-espiar-bloco" style="--st:${esc(corStatus(l[0], situacaoDaPeca(l[0])))}"><div class="vv-espiar-grupo"><span>${statusCor(l[0])}</span><em>${l.length}</em></div>${l.map((d) => {
        const quem = String(d.responsavel || '').trim() || 'sem responsável', cli = typeof clientesDoItem === 'function' ? clientesDoItem(d)[0] : d.cliente;
        return `<button type="button" class="vv-g-linha" data-espiar-item="${i++}"><b>${esc(d.nome || d.titulo || 'Peça')}</b><small>${cli ? cliCor(cli) + ' · ' : ''}${esc(quem)}</small></button>`;
      }).join('')}</section>`).join('') || '<p class="vv-vazio">Nada aqui.</p>';
      return { corpo, itens: lista.map((d) => ({ nome: d.nome, id: d.id })), clicar: (it) => chamar('openItemWorkspace', String(it.id)) };
    };
    // Alerta da operação (Paulo, 08/11/2026: "fui no automático clicar pra saber o que era em cada um"): a lista por trás.
    prov.alerta = (resto) => {
      const a = (numerosDoDono()?.alertas || [])[Number(resto)]; if (!a?.ref) return null;
      const todos = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : [];
      const titulo = String(a.texto).split(':')[0].replace(/^\d+\s*/, '');
      if (a.ref.tipo === 'pecas') { const ids = new Set(a.ref.ids.map(String)); const lista = todos.filter((d) => ids.has(String(d.id))); return { titulo, n: lista.length, cls: a.nivel === 1 ? 'u1' : 'u2', ...pecasEmBlocos(lista) }; }
      if (a.ref.tipo === 'status') { const lista = todos.filter((d) => String(d.status || '').trim() === a.ref.status && situacaoDaPeca(d) !== 'concluida'); return { titulo, n: lista.length, cls: 'u2', ...pecasEmBlocos(lista) }; }
      if (a.ref.tipo === 'clientes') return { titulo, n: a.ref.nomes.length, cls: 'u2', itens: a.ref.nomes.map((nome) => ({ nome, cliente: nome })),
        corpo: a.ref.nomes.map((nome, i) => `<button type="button" class="vv-g-linha" data-espiar-item="${i}"><b>${cliCor(nome)}</b></button>`).join(''), clicar: (it) => mostrarPendencias(it.cliente) };
      return null;
    };
    prov.semdia = (resto) => {
      const [dia, campo = 'veiculacao_iso'] = String(resto).split('|');
      const itens = (typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : []).filter((d) => String(d[campo] || '').slice(0, 10) === dia);
      const blocos = pecasEmBlocos(itens);
      const nomeDia = new Date(dia + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
      return { titulo: 'peças em ' + nomeDia, n: itens.length, ...blocos, rodape: campo === 'prazo_iso' ? 'pelo prazo' : 'pela veiculação' };
    };
  }
  function semanaPorStatusHtml(G) {
    const itens = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : [];
    const campo = G?.campo === 'prazo' ? 'prazo_iso' : 'veiculacao_iso', dias = (G?.porDia || []).map((x) => x.dia);
    if (!dias.length) return '<p class="vv-vazio">Sem a semana agora.</p>';
    const hojeDia = hojeIso(), NOMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const porDia = new Map(dias.map((d) => [d, []]));
    for (const d of itens) { const dia = String(d[campo] || '').slice(0, 10); if (porDia.has(dia)) porDia.get(dia).push(d); }
    const statusSet = new Map();
    const colunas = dias.map((dia) => {
      const lista = porDia.get(dia), grupos = new Map();
      for (const d of lista) {
        const st = String(d.status || 'Sem status').trim() || 'Sem status';
        if (!grupos.has(st)) grupos.set(st, { st, n: 0, cor: corStatus(d, situacaoDaPeca(d)) });
        grupos.get(st).n++;
        if (!statusSet.has(st)) statusSet.set(st, { st, cor: grupos.get(st).cor, n: 0 });
        statusSet.get(st).n++;
      }
      const prontas = lista.filter((d) => situacaoDaPeca(d) === 'concluida').length;
      return { dia, lista, grupos: [...grupos.values()].sort((a, b) => b.n - a.n), prontas };
    });
    const max = Math.max(1, ...colunas.map((c) => c.lista.length));
    const col = (c) => {
      const passou = c.dia < hojeDia, hojeC = c.dia === hojeDia;
      return `<button type="button" class="vv-sem-col${hojeC ? ' hoje' : ''}${passou ? ' passou' : ''}" data-espiar="semdia:${c.dia}|${campo}" aria-label="${esc(c.lista.length + ' peças em ' + c.dia.slice(8, 10) + '/' + c.dia.slice(5, 7))}">
        <span class="vv-sem-topo">${c.lista.length ? `<b>${c.lista.length}</b>${c.prontas ? `<em title="já saíram">${c.prontas} prontas</em>` : ''}` : '<b>–</b>'}</span>
        <span class="vv-sem-barras"><i class="total" style="--h:${Math.round((c.lista.length / max) * 100)}%" title="${c.lista.length} previstas"></i>${c.grupos.map((g) => `<i style="--c:${esc(g.cor)};--h:${Math.max(4, Math.round((g.n / max) * 100))}%" title="${g.n} ${esc(g.st)}"></i>`).join('')}</span>
        <span class="vv-sem-dia">${NOMES[new Date(c.dia + 'T12:00:00Z').getUTCDay()]} <small>${c.dia.slice(8, 10)}/${c.dia.slice(5, 7)}</small></span></button>`;
    };
    const legenda = [...statusSet.values()].sort((a, b) => b.n - a.n).slice(0, 10).map((x) => `<span><i style="--c:${esc(x.cor)}"></i>${esc(x.st)} <b>${x.n}</b></span>`).join('');
    return `<div class="vv-sem">${colunas.map(col).join('')}</div><div class="vv-sem-legenda">${legenda || '<span>Nada nesta semana.</span>'}</div>`;
  }
  function pintarAgencia(el, { data, saud, nome }) {
    const N = numerosDoDono();
    const seg = segHoje('agencia');
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
    // Agência do dono (Paulo, 08/11/2026: "merece uma puta reformulação… pro dono acompanhar as coisas importantes de
    // cara"): o mesmo esqueleto do Hoje. Radar no topo (cada número abre a lista por trás), no centro o que pede ação, a
    // semana em gráfico e clientes, gargalos e cobranças lado a lado; à direita VYBES, atendimento, compromissos e atalhos.
    const V = window.VybeSetor?.pecas;
    const emAtencao = (N.clientes || []).filter((c) => c.saude !== 'ok').length;
    // ===== Hoje · Agência pelo quadro B1 do moodboard (Paulo, 12/11/2026: "eu aprovei o DEPOIS") =====
    // A tela é o quadro, nesta ordem: saudação com quem está online e as abas; os três números; a fala do VYBES com os
    // passos do dia; a semana da agência e a agenda de hoje; à direita, "Para você decidir" em baralho; embaixo, a
    // linha "Também de olho". Saíram da tela, porque o quadro não tem: o anel, os blocos Clientes em atenção, Onde
    // trava e O que cobrar hoje, a fala lateral, o Boletim, o atendimento, os compromissos e a fileira de atalhos.
    const numeros = tresNumerosHtml([
      { titulo: 'Atrasadas', valor: n0(H.atrasadas), sub: H.atrasadas ? `${n0(H.furos)} furando a data do cliente` : 'nada atrasado', tom: 'ruim', quieto: !H.atrasadas, attrs: 'data-espiar="atrasadas"' },
      { titulo: 'Vão ao ar hoje', valor: n0(feitasHoje), junto: prevHoje ? `de ${n0(prevHoje)} ${rotuloDe(prevHoje, 'pronta', 'prontas')}` : '', sub: prevHoje ? '' : 'nada previsto para hoje', barra: prevHoje ? feitasHoje / prevHoje * 100 : null, cor: '#11613A', quieto: !prevHoje, attrs: 'data-espiar="faltam"' },
      { titulo: 'Semana', valor: n0(S.entregues), junto: S.previstas ? `de ${n0(S.previstas)} ${rotuloDe(S.previstas, 'entregue', 'entregues')}` : '', sub: S.previstas ? 'fecha no domingo' : 'nada previsto nesta semana', quieto: !S.previstas, attrs: 'data-abrir-gestao="semana"' },
    ]);
    const alertas = (N.alertas || []).filter((a) => a.nivel <= 3).slice(0, 6);
    // O VYBES põe em ordem (Paulo, 09/11/2026: "me guie: o que eu tenho que resolver primeiro"): o que fura a data do
    // cliente, o cliente esperando no WhatsApp há mais tempo, e os outros alertas, do mais grave ao menos grave.
    const esperando = (window.VybePendencias?.estado?.().dados?.atendimento?.clientesEsperando || []).filter((x) => (x.minutos || 0) >= 120).sort((a, b) => (b.minutos || 0) - (a.minutos || 0));
    const horas = (min) => (min < 1440 ? Math.round(min / 60) + ' h' : Math.round(min / 1440) + ' d');
    const passoAlerta = (a) => { const k = (N.alertas || []).indexOf(a), txt = String(a.texto || ''), c = txt.indexOf(':');
      return { attrs: `data-espiar="alerta:${k}"`, titulo: esc(c > 0 ? txt.slice(0, c) : txt), motivo: esc(c > 0 ? txt.slice(c + 1).trim() : (a.nivel === 1 ? 'o mais grave agora' : 'pede atenção')), botao: 'Abrir' }; };
    const passosAg = [
      ...alertas.filter((a) => a.nivel === 1).map(passoAlerta),
      ...(esperando[0] ? [{ attrs: `data-pend-cliente="${esc(esperando[0].cliente)}"`, titulo: `Responder ${cliCor(esperando[0].cliente)} no WhatsApp`, motivo: esc(`esperando há ${horas(esperando[0].minutos)}${esperando.length > 1 ? ' · mais ' + (esperando.length - 1) + ' clientes esperando' : ''}`), botao: 'Responder' }] : []),
      ...alertas.filter((a) => a.nivel !== 1).map(passoAlerta),
    ].slice(0, 3);
    const QUANDO = [['Agora', 'ruim'], ['Depois', 'atencao'], ['Em seguida', '']];
    const guiaAgencia = `<section class="v2a-guia" aria-label="Guia do VYBES"><div class="v2a-fala"><span class="vv-ser vg-av-ser" aria-hidden="true"><i></i></span><p><span class="v2t-quem">VYBES · guia da agência</span>${passosAg.length
        ? `O dia tem <b>${['uma coisa', 'duas coisas', 'três coisas'][passosAg.length - 1]}</b>${passosAg.length > 1 ? ', nesta ordem' : ' agora'}. O resto está andando.` : 'Nada urgente agora. Bom momento para olhar a semana e os clientes.'}</p></div>
      ${passosAg.map((x, k) => `<div class="v2a-passo"><span class="v2t-q ${QUANDO[k][1]}">${QUANDO[k][0]}</span><p><b>${x.titulo}</b><small>${x.motivo}</small></p><button type="button" class="v2t-btn" ${x.attrs}>${x.botao}</button></div>`).join('')}</section>`;
    const online = presencaDoEscritorio();
    const quemOnline = online.length ? `<span class="v2a-online" title="${esc(online.map((g) => g.nome).filter(Boolean).join(', '))}"><span class="v2a-avs" aria-hidden="true">${online.slice(0, 4).map((g) => `<i class="v2-pop">${esc(String(g.nome || '?').trim().slice(0, 2).toUpperCase())}</i>`).join('')}</span><small>${n0(online.length)} online</small></span>` : '';
    const ag = window.VybeAgentes?.resumoParaHoje?.(3), agTotal = ag?.pode ? (ag.total || 0) : 0;
    const semana = `<section class="v2a-cartao v2a-semana"><div class="v2a-cab"><h3>Semana da agência</h3><button type="button" class="v2t-btn" data-abrir-gestao="semana">Abrir a semana</button></div>${semanaPorStatusHtml(N.graficoSemana)}</section>`;
    const agenda = `<section class="v2a-cartao v2a-agenda">${agendaDeHojeHtml()}${agTotal ? `<p class="v2t-pe">Os agentes viram ${n0(agTotal)} ${rotuloDe(agTotal, 'coisa', 'coisas')} para você decidir · <button type="button" class="vg-link" data-hoje-acao="agentes">abrir</button></p>` : ''}</section>`;
    const apr = window.VybeAprovacoes?.estado?.().dados, limite = { interna: 24, cliente: 48, cadastrar: 24 };
    const paradas = apr ? [...(apr.planejamentos || []), ...(apr.pecas || [])].filter((x) => x.horas != null && x.horas >= (limite[x.etapa] ?? 24)).length : 0;
    const olho = olhoHtml([
      { n: emAtencao, rotulo: `${rotuloDe(emAtencao, 'cliente', 'clientes')} em atenção`, espiar: 'atencao' },
      { n: sem3.length, rotulo: `${rotuloDe(sem3.length, 'cliente', 'clientes')} com menos de 3 posts na semana`, espiar: 'sem3' },
      { n: paradas, rotulo: `${rotuloDe(paradas, 'aprovação parada', 'aprovações paradas')} além do prazo`, attrs: 'data-hoje-acao="decidir-lista"' },
    ]);
    const html = `<div class="v2t v2a"><div class="v2t-topo"><span class="v2t-ola"><small class="vv-data">${esc(data)}</small><h2>${saud}${nome ? ', <em>' + esc(nome) + '</em>' : ''}</h2></span>${quemOnline}${seg}</div>
      <div class="v2a-corpo"><div class="v2a-esq">${numeros}
        ${guiaAgencia}
        <div class="v2a-dois">${semana}${agenda}</div></div>
        ${decidirHtml()}</div>
      ${olho}</div>`;
    if (el.vvHtml !== html) { el.innerHTML = html; el.vvHtml = html; }
  }

  // ---------- Módulo Gestão: passado, agora e futuro da agência ----------
  const gestao = document.createElement('section');
  gestao.className = 'vv-gestao'; gestao.hidden = true; gestao.setAttribute?.('aria-label', 'Gestão da Vybe');
  document.body.append?.(gestao);
  let gestaoAba = 'agencia';
  function abrirGestao(aba) {
    if (aba && ['agencia', 'performance', 'agora', 'semana', 'clientes', 'carteiras', 'time', 'historico'].includes(aba)) gestaoAba = aba;
    if (body.classList.contains('mundo-modulo')) chamar('voltarAoMenu');
    gestao.hidden = false; body.classList.add('mundo-gestao'); marcarTrilho(gestaoAba === 'performance' ? 'performance' : 'gestao'); pintarGestao(); gestao.scrollTop = 0; window.VybeTutorial?.dica?.('trilho:gestao');
  }
  function fecharGestao() { gestao.hidden = true; body.classList.remove('mundo-gestao', 'mundo-tela-cheia'); marcarTrilho('hoje'); }
  const kpi = (v, r, cls = '', sub = '', espiar = '') => espiar
    ? `<button type="button" class="vv-g-kpi ${cls}" data-espiar="${espiar}"><b>${v}</b><small>${r}</small>${sub ? `<em>${sub}</em>` : ''}</button>`
    : `<div class="vv-g-kpi ${cls}"><b>${v}</b><small>${r}</small>${sub ? `<em>${sub}</em>` : ''}</div>`;
  function pintarGestao() {
    if (gestao.hidden) return;
    const N = numerosDoDono();
    const abas = [['agencia', 'Agência'], ['performance', 'Performance'], ['agora', 'Agora'], ['semana', 'Semana'], ['clientes', 'Clientes'], ['carteiras', 'Carteiras'], ['time', 'Time e bots'], ['historico', 'Histórico e projeção']];
    const topo = `<div class="vv-g-topo"><span><small class="vv-cb-kicker">Gestão da Vybe</small><h2>${gestaoAba === 'agencia' ? 'A agência inteira' : gestaoAba === 'performance' ? 'Performance da operação' : gestaoAba === 'historico' ? 'Passado e futuro' : gestaoAba === 'clientes' ? 'Clientes' : gestaoAba === 'carteiras' ? 'Carteiras dos heads' : gestaoAba === 'time' ? 'Time e bots' : gestaoAba === 'semana' ? 'Semana da agência' : 'Agora na agência'}</h2>
        <p>${N ? 'Atualizado às ' + new Date(N.geradoEm || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' · ' + n0((N.cobertura || {}).clientesAtivos) + (Number((N.cobertura || {}).clientesAtivos) === 1 ? ' cliente ativo' : ' clientes ativos') : 'Juntando os números…'}</p></span>
      <span class="vv-g-acoes"><button type="button" class="vv-botao" data-gestao-cheia title="Tela cheia">⛶</button><button type="button" class="vv-botao" data-gestao-fechar aria-label="Fechar">✕</button></span></div>
      <nav class="vv-seg vv-g-abas" role="tablist">${abas.map(([id, n]) => `<button type="button" role="tab" aria-selected="${id === gestaoAba}" data-gestao-aba="${id}">${n}</button>`).join('')}</nav>`;
    if (!N) { gestao.innerHTML = topo + '<p class="vv-vazio">Os números aparecem quando a produção terminar de carregar.</p>'; return; }
    const H = N.hoje || {}, S = N.semana || {}, C = N.cobertura || {}, Hi = N.historico || {}, P = N.projecao || {};
    const ultima = (Hi.semanas || []).slice(-1)[0] || {};
    let corpo = '';
    if (gestaoAba === 'agencia' && window.VybeSetor?.pintarEm) {
      // Dinheiro, comercial, clientes, produção e time num painel só (vybe-mundo-setor.js, mesmas leituras dos setores).
      gestao.innerHTML = '<div class="vv-g-corpo vs-agencia"></div>'; // quadro da Gestão: o cabeçalho vem no próprio painel (vybe-mundo-setor.js)
      window.VybeSetor.pintarEm(gestao.querySelector('.vs-agencia'), 'setor:agencia', { nome: 'Gestão', subs: SUBMODULOS.filter(subVisivel), numeros: () => numerosDoDono(), fila: () => minhaFila(), agenda: () => agendaEventos,
        abrirSub: (sub) => usarTrilho(sub), irSetor: (setor) => abrirVisaoSetor(setor) });
      return;
    }
    if (gestaoAba === 'performance' && window.VybePerformance?.html) {
      gestao.innerHTML = '<div class="vv-g-corpo vs-corpo vs-gestao-aba vv-perf"></div>'; // quadro da Performance: idem (vybe-mundo-performance.js)
      window.VybePerformance.html(gestao.querySelector('.vv-perf'));
      return;
    }
    // Abas da Gestão no padrão dos painéis de gestão (Paulo, 08/11/2026: "você mexeu só na Visão geral… abre tudo"): números
    // com ícone e estado, gráficos e listas com barra, das mesmas contas de numerosDoDono. As peças (kpi, bloco, barras,
    // deitadas) são as de vybe-mundo-setor.js; o número clicável continua abrindo a lista por trás dele (data-espiar).
    const V = window.VybeSetor?.pecas;
    if (!V) { gestao.innerHTML = topo + '<p class="vv-vazio">Carregando os painéis…</p>'; return; }
    // Zero vira uma linha (00 Main, regra 4): kpiLinha marca o zero e G (pecas.grade) junta os zeros numa linha discreta.
    const { kpiLinha: k = V.kpi, grade: G = (h) => `<div class="vs-kpis">${h}</div>`, bloco, barras, deitadas, linha, progresso } = V;
    const tabela = (h) => `<div class="vs-tabela">${h}</div>`;
    const SAUDE_CLS = { critico: 'ruim', atencao: 'atencao', ok: 'ok' };
    if (gestaoAba === 'agora') {
      const L = H.lista || {}, T = N.time || [], CL = N.clientes || [];
      corpo = `${G(`
          ${k({ icone: 'aperto', titulo: 'Produção de hoje', valor: `${n0(H.feitas)}<i>/${n0(H.previstas)}</i>`, sub: H.previstas ? `${n0(Math.round((H.feitas / H.previstas) * 100))}% das previstas para hoje` : 'nada previsto para hoje', cls: H.previstas && H.feitas < H.previstas ? 'atencao' : '' })}
          ${k({ icone: 'alerta', titulo: 'Atrasadas', valor: n0(H.atrasadas), sub: `${n0(H.furos)} furando a data do cliente`, cls: H.atrasadas ? 'ruim' : '', espiar: 'atrasadas' })}
          ${k({ icone: 'relogio', titulo: 'Risco de furo', valor: n0(H.emRisco), sub: 'nos próximos 2 dias', cls: H.emRisco ? 'atencao' : '', espiar: 'emRisco' })}
          ${k({ icone: 'calendario', titulo: 'Ainda não feitas hoje', valor: n0(H.faltam), sub: `${n0(H.paraAgendar?.hoje)} para agendar hoje`, espiar: 'faltam' })}
          ${k({ icone: 'alta', titulo: 'Entregues na semana', valor: `${n0(S.entregues)}<i>/${n0(S.previstas)}</i>`, sub: Hi.medianaEntregues ? `mediana de ${n0(Hi.medianaEntregues)} por semana` : '' })}
          ${k({ icone: 'doc', titulo: 'Clientes sem 3 posts', valor: n0((C.sem3 || []).length), sub: `de ${n0(C.clientesAtivos)} ativos`, cls: (C.sem3 || []).length ? 'atencao' : '', espiar: 'sem3' })}
        `)}
        ${linha(bloco('O que pede ação agora', 'alertas da operação, do mais grave ao menos grave', (N.alertas || []).length ? `<ul class="vs-alertas">${(N.alertas || []).slice(0, 10).map((a, i) => `<li class="${a.nivel === 1 ? 'ruim' : a.nivel <= 3 ? 'atencao' : ''}"><button type="button" class="vs-alerta" data-espiar="alerta:${i}"><i aria-hidden="true"></i><span>${esc(a.texto)}</span></button></li>`).join('')}</ul>` : '<p class="vs-aviso">Sem alertas agora.</p>', { icone: 'alerta', cls: 'vs-destaque' })
          + bloco('Onde trava', 'peças paradas por status, a pior primeiro', deitadas((N.gargalos || []).slice(0, 8).map((g) => ({ st: true, nome: g.status, valor: g.qtd, cls: g.idadeMedianaDias >= 3 ? 'ruim' : 'atencao', rotulo: `${n0(g.qtd)} <small>${n0(g.idadeMedianaDias)} d</small>`, sub: `${plural(g.qtd, 'peça, parada', 'peças, paradas')} há ${plural(g.idadeMedianaDias, 'dia', 'dias')} (mediana)` })), { vazio: 'Nada parado na janela de produção.' }), { icone: 'relogio' }))}
        ${linha(bloco('Atrasos por pessoa', 'atrasadas e risco de furo de cada um', deitadas(T.filter((t) => t.atrasadas || t.emRisco).sort((a, b) => b.atrasadas - a.atrasadas || b.emRisco - a.emRisco).slice(0, 8).map((t) => ({ nome: t.pessoa, valor: t.atrasadas + t.emRisco, cls: t.atrasadas ? 'ruim' : 'atencao', rotulo: `${n0(t.atrasadas)} <small>+${n0(t.emRisco)} risco</small>`, sub: (t.cobrar || [])[0] || '' })), { vazio: 'Ninguém com atraso ou risco.' }), { icone: 'pessoas' })
          + bloco('Atrasos por cliente', 'atrasadas e risco de furo por cliente', deitadas(CL.filter((c) => c.atrasadas || c.emRisco).sort((a, b) => b.atrasadas - a.atrasadas || b.emRisco - a.emRisco).slice(0, 8).map((c) => ({ cli: true, nome: c.cliente, valor: c.atrasadas + c.emRisco, cls: c.atrasadas ? 'ruim' : 'atencao', rotulo: `${n0(c.atrasadas)} <small>+${n0(c.emRisco)} risco</small>` })), { vazio: 'Nenhum cliente com atraso ou risco.' }), { icone: 'coracao' }))}
        ${linha(bloco('Atrasadas', plural(H.atrasadas, 'peça', 'peças'), listaPecas(L.atrasadas, 'Nada atrasado.'), { icone: 'alerta' })
          + bloco('Risco de furo', `${plural(H.emRisco, 'peça', 'peças')} nos próximos 2 dias`, listaPecas(L.emRisco, 'Nada com risco de furo.'), { icone: 'relogio' }))}
        ${bloco('Ainda não feitas hoje', `${plural(H.faltam, 'peça que vai', 'peças que vão')} ao ar hoje`, listaPecas(L.faltam, 'Tudo de hoje feito.'), { icone: 'calendario' })}`;
    } else if (gestaoAba === 'semana') {
      const CL = N.clientes || [], meta = C.meta || 3;
      const pctSem = S.previstas ? Math.round(((S.previstasEntregues ?? S.entregues) / S.previstas) * 100) : null;
      corpo = `${G(`
          ${k({ icone: 'aperto', titulo: 'Previstas da semana prontas', valor: `${n0(S.previstasEntregues ?? S.entregues)}<i>/${n0(S.previstas)}</i>`, sub: pctSem != null ? `${pctSem}% · ${n0(S.entregues)} entregas registradas` : 'nada previsto' })}
          ${k({ icone: 'doc', titulo: `Clientes com ${meta}+ posts`, valor: `${n0(C.clientesAtivos - (C.sem3 || []).length)}<i>/${n0(C.clientesAtivos)}</i>`, cls: (C.sem3 || []).length ? 'atencao' : '', espiar: 'sem3' })}
          ${k({ icone: 'alerta', titulo: 'Sem nenhum conteúdo', valor: n0((C.semConteudo || []).length), sub: 'clientes nesta semana', cls: (C.semConteudo || []).length ? 'ruim' : '', espiar: 'semConteudo' })}
          ${k({ icone: 'calendario', titulo: 'Próxima semana abaixo', valor: n0((C.proximaSemanaSem3 || []).length), sub: `clientes com menos de ${meta} posts`, cls: (C.proximaSemanaSem3 || []).length ? 'atencao' : '' })}
          ${k({ icone: 'meta', titulo: 'Sem planejamento', valor: n0((C.semPlanejamento || []).length), sub: 'do mês atual ou seguinte', cls: (C.semPlanejamento || []).length ? 'atencao' : '', espiar: 'semPlanejamento' })}
        `)}
        ${bloco('Dia a dia da semana', `previstas por ${semanaAgencia.campo === 'prazo' ? 'prazo' : 'veiculação'} e entregues no dia`, `${controlesSemana(N.graficoSemana)}${barrasSemana(N.graficoSemana.porDia, { w: Math.max(640, Math.round((gestao.clientWidth || 900) - 110)), h: 160 })}<p class="vv-legenda"><i class="pv"></i>previstas <i class="en"></i>entregues no dia</p>`, { icone: 'alta' })}
        ${linha(bloco('Posts por cliente nesta semana', `a marca é a meta de ${meta}; os mais longe da meta primeiro`, deitadas([...CL].sort((a, b) => a.semana - b.semana).slice(0, 12).map((c) => ({ cli: true, nome: c.cliente, valor: c.semana, meta, cls: c.semana >= meta ? 'ok' : c.semana ? 'atencao' : 'ruim', rotulo: `${n0(c.semana)}<small>/${meta}</small>` })), { vazio: 'Sem clientes ativos.' }), { icone: 'doc' })
          + bloco('Próxima semana', `posts já previstos por cliente (meta ${meta})`, deitadas([...CL].sort((a, b) => a.proximaSemana - b.proximaSemana).slice(0, 12).map((c) => ({ cli: true, nome: c.cliente, valor: c.proximaSemana, meta, cls: c.proximaSemana >= meta ? 'ok' : c.proximaSemana ? 'atencao' : 'ruim', rotulo: `${n0(c.proximaSemana)}<small>/${meta}</small>` })), { vazio: 'Sem clientes ativos.' }), { icone: 'calendario' }))}
        ${bloco('Sem planejamento', esc((N.fonte || {}).planejamento || ''), (C.semPlanejamento || []).length ? `<div class="vs-chips">${(C.semPlanejamento || []).map((c) => `<button type="button" class="vs-chip" data-espiar-cliente="${esc(typeof c === 'string' ? c : c.cliente)}">${cliCor(typeof c === 'string' ? c : c.cliente)}</button>`).join('')}</div>` : '<p class="vs-aviso">Todos com planejamento.</p>', { icone: 'meta' })}`;
    } else if (gestaoAba === 'clientes') {
      const CL = N.clientes || [], conta = (s) => CL.filter((c) => c.saude === s).length;
      corpo = `${G(`
          ${k({ icone: 'pessoas', titulo: 'Clientes ativos', valor: n0(CL.length), sub: `${n0(CL.filter((c) => c.temPlanejamento).length)} com planejamento` })}
          ${k({ icone: 'alerta', titulo: 'Críticos', valor: n0(conta('critico')), sub: 'furo, 3+ atrasadas ou sem conteúdo', cls: conta('critico') ? 'ruim' : '', espiar: 'atencao' })}
          ${k({ icone: 'relogio', titulo: 'Em atenção', valor: n0(conta('atencao')), sub: 'atraso, risco ou abaixo da meta', cls: conta('atencao') ? 'atencao' : '' })}
          ${k({ icone: 'coracao', titulo: 'Em dia', valor: n0(conta('ok')), sub: CL.length ? `${n0(Math.round((conta('ok') / CL.length) * 100))}% da carteira` : '' })}
          ${k({ icone: 'doc', titulo: 'Peças abertas', valor: n0(CL.reduce((a, c) => a + (c.abertas || 0), 0)), sub: plural(CL.reduce((a, c) => a + (c.atrasadas || 0), 0), 'atrasada', 'atrasadas') })}
        `)}
        ${linha(bloco('Saúde da carteira', 'quantos clientes em cada faixa', deitadas([{ nome: 'Em dia', valor: conta('ok'), cls: 'ok' }, { nome: 'Em atenção', valor: conta('atencao'), cls: 'atencao' }, { nome: 'Críticos', valor: conta('critico'), cls: 'ruim' }]), { icone: 'coracao' })
          + bloco('Peças abertas por cliente', 'os que mais têm peça em aberto', deitadas([...CL].sort((a, b) => b.abertas - a.abertas).slice(0, 8).map((c) => ({ cli: true, nome: c.cliente, valor: c.abertas, cls: SAUDE_CLS[c.saude] || '', rotulo: `${n0(c.abertas)}${c.atrasadas ? ` <small class="t-ruim">${n0(c.atrasadas)} atras.</small>` : ''}` }))), { icone: 'doc' }))}
        ${bloco('Todos os clientes', 'clique na linha para abrir o cérebro do cliente; nos números, a lista por trás', tabela(`<table class="vv-g-tabela"><thead><tr><th>Cliente</th><th>Saúde</th><th class="n">Abertas</th><th class="n">Atrasadas</th><th class="n">Risco</th><th class="n">Semana</th><th class="n">Próx.</th><th>Planej.</th><th>Por quê</th></tr></thead><tbody>
        ${CL.map((c) => `<tr data-cerebro-cliente="${esc(c.cliente)}"><td><b>${cliCor(c.cliente)}</b></td><td><span class="pill ${SAUDE[c.saude]?.[1] || ''}">${SAUDE[c.saude]?.[0] || c.saude}</span></td><td class="n">${n0(c.abertas)}</td><td class="n ${c.atrasadas ? 't-u1' : ''}">${c.atrasadas ? `<button type="button" class="vv-num" data-espiar="atrasadas|cliente:${esc(c.cliente)}">${n0(c.atrasadas)}</button>` : '0'}</td><td class="n ${c.emRisco ? 't-u2' : ''}">${c.emRisco ? `<button type="button" class="vv-num" data-espiar="emRisco|cliente:${esc(c.cliente)}">${n0(c.emRisco)}</button>` : '0'}</td><td class="n ${c.semana < 3 ? 't-u2' : ''}">${n0(c.semana)}/3</td><td class="n">${n0(c.proximaSemana)}</td><td>${c.temPlanejamento ? '<span class="ok">Sim</span>' : '<span class="nao">Não</span>'}</td><td class="mot">${esc((c.motivos || []).join(' · '))}</td></tr>`).join('')}
        </tbody></table>`), { icone: 'pessoas' })}`;
    } else if (gestaoAba === 'carteiras') {
      // A carteira de cada head (o "progresso das entregas por squad" do AgencyFlow). Os números vêm de N.heads.
      const heads = N.heads || [];
      const aviso = !heads.length || heads.every((h) => h.semHead)
        ? '<p class="vv-dica vv-g-aviso-heads">Nenhum cliente ativo tem head ainda, por isso todos aparecem em "Sem head". Os heads vêm do cadastro do cliente: preencha os heads na ficha de cada cliente.</p>' : '';
      const ROT_SAUDE = { critico: ['crítico', 'críticos'], atencao: ['em atenção', 'em atenção'], ok: ['em dia', 'em dia'] };
      const pilulas = (sd = {}) => ['critico', 'atencao', 'ok'].filter((x) => sd[x]).map((x) => `<span class="pill ${SAUDE[x][1]}">${n0(sd[x])} ${ROT_SAUDE[x][sd[x] === 1 ? 0 : 1]}</span>`).join('') || '<span class="nao">—</span>';
      const comHead = heads.filter((h) => !h.semHead);
      corpo = `${aviso}${G(`
          ${k({ icone: 'pessoas', titulo: 'Heads', valor: n0(comHead.length), sub: `${plural(heads.reduce((a, h) => a + (h.contas || 0), 0), 'conta', 'contas')} nas carteiras` })}
          ${k({ icone: 'alerta', titulo: 'Atrasadas nas carteiras', valor: n0(heads.reduce((a, h) => a + (h.atrasadas || 0), 0)), cls: heads.some((h) => h.atrasadas) ? 'ruim' : '' })}
          ${k({ icone: 'relogio', titulo: 'Risco de furo', valor: n0(heads.reduce((a, h) => a + (h.emRisco || 0), 0)), cls: heads.some((h) => h.emRisco) ? 'atencao' : '' })}
          ${k({ icone: 'coracao', titulo: 'Clientes críticos', valor: n0(heads.reduce((a, h) => a + (h.saude?.critico || 0), 0)), cls: heads.some((h) => h.saude?.critico) ? 'ruim' : '' })}
        `)}
        ${linha(bloco('Entregas da semana por head', 'previstas da semana já entregues', heads.length ? progresso(heads.map((h) => ({ nome: h.head, texto: `${n0(h.semana?.entregues)} de ${n0(h.semana?.previstas)} · ${plural(h.contas, 'conta', 'contas')}`, barra: Math.max(0, Math.min(100, Number(h.semana?.pct) || 0)), percentual: h.semana?.pct, batida: h.semana?.pct === 100 }))) : '<p class="vs-aviso">Sem carteiras.</p>', { icone: 'meta' })
          + bloco('Peças por head', 'abertas, atrasadas e risco de furo', barras(heads.map((h) => ({ rotulo: h.semHead ? 'Sem head' : String(h.head).split(' ')[0], abertas: h.abertas, atrasadas: h.atrasadas, risco: h.emRisco })), [{ chave: 'abertas', rotulo: 'Abertas', cls: 'c5' }, { chave: 'atrasadas', rotulo: 'Atrasadas', cls: 'c4' }, { chave: 'risco', rotulo: 'Risco', cls: 'c1' }]), { icone: 'alta' }))}
        ${bloco('Carteiras por head', 'cliente com dois heads entra nas duas carteiras', tabela(`<table class="vv-g-tabela vv-g-carteiras"><thead><tr><th>Head</th><th class="n">Contas</th><th>Saúde</th><th class="n">Abertas</th><th class="n">Atrasadas</th><th class="n">Risco</th><th class="n">Semana</th></tr></thead><tbody>
        ${heads.map((h) => `<tr class="${h.semHead ? 'sem-head' : ''}"><td><button type="button" class="vv-num" data-espiar="carteira|head:${esc(h.head)}"><b>${esc(h.head)}</b></button></td><td class="n">${n0(h.contas)}</td><td class="saude">${pilulas(h.saude)}</td><td class="n">${n0(h.abertas)}</td><td class="n ${h.atrasadas ? 't-u1' : ''}">${h.atrasadas ? `<button type="button" class="vv-num" data-espiar="atrasadas|head:${esc(h.head)}">${n0(h.atrasadas)}</button>` : '0'}</td><td class="n ${h.emRisco ? 't-u2' : ''}">${h.emRisco ? `<button type="button" class="vv-num" data-espiar="emRisco|head:${esc(h.head)}">${n0(h.emRisco)}</button>` : '0'}</td><td class="n">${n0(h.semana?.entregues)}/${n0(h.semana?.previstas)}</td></tr>`).join('')}
        </tbody></table>`), { icone: 'pessoas' })}`;
    } else if (gestaoAba === 'time') {
      const bots = botsParaCobrar(); let f = null; try { f = fonteAgentes?.ler(); } catch {} const ags = f?.dados?.agentes || [];
      const T = N.time || [];
      const falhas = ags.reduce((a, ag) => a + ((estadoDoAgente(ag.setor).ultimos || []).filter((x) => x.estado === 'falhou').length), 0);
      corpo = `${G(`
          ${k({ icone: 'pessoas', titulo: 'Pessoas com peças', valor: n0(T.length) })}
          ${k({ icone: 'doc', titulo: 'Peças abertas', valor: n0(T.reduce((a, t) => a + (t.abertas || 0), 0)), sub: 'cada peça conta para cada responsável' })}
          ${k({ icone: 'alerta', titulo: 'Atrasadas', valor: n0(T.reduce((a, t) => a + (t.atrasadas || 0), 0)), cls: T.some((t) => t.atrasadas) ? 'ruim' : '' })}
          ${k({ icone: 'aperto', titulo: 'Entregues em 7 dias', valor: n0(T.reduce((a, t) => a + (t.entregues7d || 0), 0)) })}
          ${k({ icone: 'relogio', titulo: 'Paradas há 3+ dias', valor: n0(T.reduce((a, t) => a + (t.paradas || 0), 0)), cls: T.some((t) => t.paradas) ? 'atencao' : '' })}
          ${k({ icone: 'alta', titulo: 'Bots', valor: n0(ags.length), sub: falhas ? plural(falhas, 'falha recente', 'falhas recentes') : 'sem falhas recentes', cls: falhas ? 'atencao' : '' })}
        `)}
        ${linha(bloco('Carga por pessoa', 'abertas e atrasadas de cada um', barras([...T].sort((a, b) => b.abertas - a.abertas).slice(0, 10).map((t) => ({ rotulo: String(t.pessoa).split(' ')[0], abertas: t.abertas, atrasadas: t.atrasadas })), [{ chave: 'abertas', rotulo: 'Abertas', cls: 'c5' }, { chave: 'atrasadas', rotulo: 'Atrasadas', cls: 'c4' }]), { icone: 'pessoas' })
          + bloco('Entregues em 7 dias', 'por pessoa', deitadas([...T].sort((a, b) => b.entregues7d - a.entregues7d).slice(0, 10).map((t) => ({ nome: t.pessoa, valor: t.entregues7d, cls: 'ok', sub: `${n0(t.abertas)} abertas` })), { vazio: 'Sem entregas nos últimos 7 dias.' }), { icone: 'aperto' }))}
        ${bloco('Time', 'o que cobrar de cada pessoa; nos números, a lista por trás', tabela(`<table class="vv-g-tabela"><thead><tr><th>Pessoa</th><th class="n">Abertas</th><th class="n">Atrasadas</th><th class="n">Risco</th><th class="n">Entregues 7d</th><th class="n">Parado (med.)</th><th>O que cobrar</th></tr></thead><tbody>
          ${T.map((t) => `<tr><td><b>${esc(t.pessoa)}</b></td><td class="n">${n0(t.abertas)}</td><td class="n ${t.atrasadas ? 't-u1' : ''}">${t.atrasadas ? `<button type="button" class="vv-num" data-espiar="atrasadas|pessoa:${esc(t.pessoa)}">${n0(t.atrasadas)}</button>` : '0'}</td><td class="n ${t.emRisco ? 't-u2' : ''}">${t.emRisco ? `<button type="button" class="vv-num" data-espiar="emRisco|pessoa:${esc(t.pessoa)}">${n0(t.emRisco)}</button>` : '0'}</td><td class="n">${n0(t.entregues7d)}</td><td class="n">${n0(t.idadeMedianaDias)} d</td><td class="mot">${esc((t.cobrar || []).join(' · ') || '—')}</td></tr>`).join('')}
        </tbody></table>`), { icone: 'pessoas' })}
        ${bloco('Bots (agentes do prédio)', 'estado, tarefas em curso e falhas', ags.length ? tabela(`<table class="vv-g-tabela"><thead><tr><th>Agente</th><th>Estado</th><th class="n">Em curso</th><th class="n">Últimas</th><th class="n">Falhas</th><th>O que cobrar</th></tr></thead><tbody>
          ${ags.map((a) => { const e = estadoDoAgente(a.setor), u = e.ultimos || [], fl = u.filter((x) => x.estado === 'falhou').length; const b = bots.lista.find((x) => x.setor === a.setor);
            return `<tr data-agente="${esc(a.andar)}|${esc(a.setor)}"><td><b>${esc(a.agente || a.setor)}</b><small>${esc(a.nome || '')}</small></td><td><span class="pill" style="--e:${e.cor}">${esc(e.rotulo)}</span></td><td class="n">${n0(a.emCurso)}</td><td class="n">${n0(u.length)}</td><td class="n ${fl ? 't-u1' : ''}">${n0(fl)}</td><td class="mot">${esc(b?.texto || '—')}</td></tr>`; }).join('')}
          </tbody></table>`) : `<p class="vs-aviso">${esc(avisoDosAgentes())}.</p>`, { icone: 'alta' })}`;
    } else {
      const proj = P.proximaSemana || {};
      const sems = (Hi.semanas || []).map((s) => ({ ...s, rotulo: String(s.inicio || '').slice(8, 10) + '/' + String(s.inicio || '').slice(5, 7) }));
      corpo = `${G(`
          ${k({ icone: 'aperto', titulo: 'Entregues nesta semana', valor: n0(ultima.entregues), sub: `mediana de ${n0(Hi.medianaEntregues)} por semana` })}
          ${k({ icone: 'relogio', titulo: 'No prazo', valor: Hi.mediaNoPrazoPct != null ? `${Math.round(Hi.mediaNoPrazoPct)}%` : '—', sub: 'últimas 12 semanas', cls: Hi.mediaNoPrazoPct != null && Hi.mediaNoPrazoPct < 80 ? 'atencao' : '' })}
          ${k({ icone: 'alta', titulo: 'Tendência', valor: { subindo: 'Subindo', estavel: 'Estável', caindo: 'Caindo' }[Hi.tendencia] || '—', sub: '4 últimas semanas contra as 4 anteriores', cls: Hi.tendencia === 'caindo' ? 'ruim' : '' })}
          ${k({ icone: 'calendario', titulo: 'Próxima semana', valor: `${n0(proj.previstas)}<i>/${n0(proj.capacidadeMediana)}</i>`, sub: proj.folga != null ? (proj.folga >= 0 ? `previstas / capacidade · folga ${n0(proj.folga)}` : `previstas / capacidade · faltam ${n0(-proj.folga)}`) : 'previstas / capacidade', cls: proj.risco === 'alto' ? 'ruim' : proj.risco === 'medio' ? 'atencao' : '' })}
        `)}
        ${bloco(`Entregas por semana · últimas ${n0((Hi.semanas || []).length)} e as próximas 4 previstas`, 'entregues, mediana e o que já está previsto', `${linhaHistorico(Hi.semanas || [], { mediana: Hi.medianaEntregues, projecao: P.proximas4 || [] })}<p class="vv-legenda"><i class="en2"></i>entregues <i class="md"></i>mediana <i class="pj"></i>previstas (futuro)</p>`, { icone: 'alta' })}
        ${linha(bloco('No prazo × atrasadas', 'entregas de cada semana', barras(sems, [{ chave: 'noPrazo', rotulo: 'No prazo', cls: 'c3' }, { chave: 'atrasadasEntregues', rotulo: 'Atrasadas', cls: 'c4' }]), { icone: 'relogio' })
          + bloco('Semana a semana', 'previstas, entregues, no prazo e atrasadas', tabela(`<table class="vv-g-tabela"><thead><tr><th>Semana</th><th class="n">Previstas</th><th class="n">Entregues</th><th class="n">No prazo</th><th class="n">Atrasadas</th></tr></thead><tbody>
            ${(Hi.semanas || []).slice().reverse().map((s) => `<tr><td>${esc(String(s.inicio || '').slice(8, 10) + '/' + String(s.inicio || '').slice(5, 7))}</td><td class="n">${n0(s.previstas)}</td><td class="n">${n0(s.entregues)}</td><td class="n">${n0(s.noPrazo)}</td><td class="n ${s.atrasadasEntregues ? 't-u2' : ''}">${n0(s.atrasadasEntregues)}</td></tr>`).join('')}
          </tbody></table>`), { icone: 'doc' }))}`;
    }
    gestao.innerHTML = topo + `<div class="vv-g-corpo vs-corpo vs-gestao-aba">${corpo}</div>`;
  }
  // Cliente na cor da carteira, status na cor do quadro e as datas com nome (vybe-core.js: pecaMetaHtml, pecaDatasHtml).
  const metaPeca = (p) => (typeof pecaMetaHtml === 'function' ? pecaMetaHtml(p) : esc([p.cliente, p.status, p.responsavel].filter(Boolean).join(' · ')));
  const datasPeca = (p) => (typeof pecaDatasHtml === 'function' ? pecaDatasHtml(p) : '');
  function listaPecas(lista = [], vazio = '', max = 8) {
    if (!lista?.length) return `<p class="vv-vazio">${vazio}</p>`;
    return lista.slice(0, max).map((p) => `<button type="button" class="vv-g-linha peca" data-hoje-acao="peca" data-valor="${esc(p.id)}"><b>${esc(p.nome || 'Peça')}</b><small class="vv-g-meta">${metaPeca(p)}</small><em class="vv-g-datas">${datasPeca(p)}</em></button>`).join('') + (lista.length > 8 ? `<p class="vv-dica">+ ${lista.length - 8}</p>` : '');
  }
  // ---------- Espiar: o número abre o que está por trás dele (Paulo, 08/11: "ver 69 atrasadas e clicar nele") ----------
  // Passar o mouse mostra a prévia; clicar fixa o mini painel (X, Esc e clique fora fecham). Cada linha leva à peça ou ao cliente.
  const espiaoEl = document.createElement('div');
  espiaoEl.className = 'vv-espiar'; espiaoEl.hidden = true; espiaoEl.setAttribute?.('role', 'dialog');
  document.body.append?.(espiaoEl);
  let espiaoFixo = false, espiaoAncora = null, espiaoTimer = null;
  const ESPIAR = { atrasadas: ['Atrasadas', 'u1', 'Nada atrasado.', 'agora'], emRisco: ['Risco de furo (2 dias)', 'u2', 'Nada com risco de furo.', 'agora'], faltam: ['Ainda não feitas hoje', '', 'Tudo de hoje feito.', 'agora'] };
  // Outros módulos (Comercial, Carteira…) publicam as listas por trás dos números deles:
  // window.VybeEspiarProvedores[prefixo] = (resto) => ({ titulo, n, cls, itens: [{ nome, sub, dir, cls }], clicar(item), rodape })
  const PROVEDORES = (window.VybeEspiarProvedores = window.VybeEspiarProvedores || {});
  let espiaoAtual = null;
  function conteudoEspiar(chave) {
    const pref = String(chave).split(':')[0];
    if (PROVEDORES[pref]) {
      let c = null; try { c = PROVEDORES[pref](String(chave).slice(pref.length + 1)); } catch (e) { console.error('[espiar]', e); }
      if (!c) return null;
      if (Array.isArray(c.itens) && !c.corpo) c.corpo = c.itens.length ? c.itens.map((it, i) => `<button type="button" class="vv-g-linha" data-espiar-item="${i}"><b>${esc(it.nome)}</b>${it.subHtml ? `<small class="vv-g-meta">${it.subHtml}</small>` : it.sub ? `<small>${esc(it.sub)}</small>` : ''}${it.dirHtml ? `<em class="vv-g-datas">${it.dirHtml}</em>` : it.dir ? `<em class="${it.cls ? 't-' + it.cls : ''}">${esc(it.dir)}</em>` : ''}</button>`).join('') : `<p class="vv-vazio">${esc(c.vazio || 'Nada aqui.')}</p>`;
      if (c.n == null) c.n = (c.itens || []).length;
      return c;
    }
    const N = numerosDoDono(); if (!N) return null;
    const H = N.hoje || {}, L = H.lista || {}, C = N.cobertura || {};
    const [tipo, filtro = ''] = String(chave).split('|'); const [fk, ...fv] = filtro.split(':'), valor = fv.join(':');
    const nomeCli = (c) => typeof c === 'string' ? c : c?.cliente || '';
    const linhaCli = (nome, dir = '') => `<button type="button" class="vv-g-linha" data-espiar-cliente="${esc(nome)}"><b>${esc(nome)}</b>${dir ? `<em>${dir}</em>` : ''}</button>`;
    if (ESPIAR[tipo]) {
      const [rot, cls, vazio, aba] = ESPIAR[tipo];
      // Por pessoa/cliente: as mesmas peças que a métrica contou (antes o filtro por nome dava 20 onde a tabela dizia 17).
      let lista = L[tipo] || [];
      if (fk === 'pessoa') lista = (N.time || []).find((t) => t.pessoa === valor)?.lista?.[tipo] || [];
      if (fk === 'cliente') lista = (N.clientes || []).find((c) => c.cliente === valor)?.lista?.[tipo] || [];
      if (fk === 'head') lista = (N.heads || []).find((h) => h.head === valor)?.lista?.[tipo] || [];
      return { titulo: rot, sub: valor, n: lista.length, cls, aba: fk === 'head' ? 'carteiras' : aba, corpo: listaPecas(lista, vazio, 40) + (lista.length > 40 ? `<p class="vv-dica">e mais ${lista.length - 40} na Gestão.</p>` : '') };
    }
    if (tipo === 'sem3') return { titulo: 'Clientes sem 3 posts na semana', n: (C.sem3 || []).length, cls: 'u2', aba: 'semana', corpo: (C.sem3 || []).map((x) => linhaCli(x.cliente, `${n0(x.qtd)}/3`)).join('') || '<p class="vv-vazio">Todos com 3 posts.</p>' };
    if (tipo === 'semConteudo') return { titulo: 'Clientes sem nenhum post na semana', n: (C.semConteudo || []).length, cls: 'u1', aba: 'semana', corpo: (C.semConteudo || []).map((c) => linhaCli(nomeCli(c), '0/3')).join('') || '<p class="vv-vazio">Nenhum.</p>' };
    if (tipo === 'semPlanejamento') return { titulo: 'Clientes sem planejamento', n: (C.semPlanejamento || []).length, cls: '', aba: 'semana', corpo: (C.semPlanejamento || []).map((c) => linhaCli(nomeCli(c))).join('') || '<p class="vv-vazio">Todos com planejamento.</p>' };
    if (tipo === 'carteira') {
      // Os clientes da carteira de um head, do pior para o melhor (a mesma saúde da aba Clientes).
      const h = (N.heads || []).find((x) => x.head === valor);
      const porNome = new Map((N.clientes || []).map((c) => [c.cliente, c]));
      const l = (h?.clientes || []).map((nome) => porNome.get(nome) || { cliente: nome });
      return { titulo: 'Clientes na carteira', sub: valor, n: l.length, cls: h?.saude?.critico ? 'u1' : h?.saude?.atencao ? 'u2' : '', aba: 'carteiras',
        corpo: l.map((c) => `<button type="button" class="vv-g-linha" data-espiar-cliente="${esc(c.cliente)}"><b>${cliCor(c.cliente)}</b><small>${esc((c.motivos || []).slice(0, 2).join(' · ') || '—')}</small><em class="t-${SAUDE[c.saude]?.[1] || ''}">${SAUDE[c.saude]?.[0] || ''}</em></button>`).join('') || '<p class="vv-vazio">Nenhum cliente ativo nesta carteira.</p>' };
    }
    if (tipo === 'atencao') {
      const l = (N.clientes || []).filter((c) => c.saude !== 'ok');
      return { titulo: 'Clientes que pedem atenção', n: l.length, cls: 'u1', aba: 'clientes', corpo: l.map((c) => `<button type="button" class="vv-g-linha" data-espiar-cliente="${esc(c.cliente)}"><b>${cliCor(c.cliente)}</b><small>${esc((c.motivos || []).slice(0, 2).join(' · ') || '—')}</small><em class="t-${SAUDE[c.saude]?.[1] || ''}">${SAUDE[c.saude]?.[0] || ''}</em></button>`).join('') || '<p class="vv-vazio">Todos em dia.</p>' };
    }
    return null;
  }
  function mostrarEspiar(ancora, fixo) {
    const c = conteudoEspiar(ancora.dataset.espiar); if (!c) return;
    espiaoAtual = c;
    clearTimeout(espiaoTimer); espiaoTimer = null; espiaoAncora = ancora; espiaoFixo = fixo;
    espiaoEl.classList.toggle('fixo', fixo); espiaoEl.setAttribute('aria-label', c.titulo);
    espiaoEl.innerHTML = `<div class="vv-espiar-topo"><span><b class="t-${c.cls}">${n0(c.n)}</b> ${esc(c.titulo)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</span><button type="button" class="vv-espiar-x" data-espiar-fechar aria-label="Fechar" title="Fechar (Esc)">×</button></div>
      <div class="vv-espiar-lista">${c.corpo}</div>
      <div class="vv-espiar-pe">${fixo ? `<small>${esc(c.rodape || '')}</small>` : '<small>Clique no número para fixar</small>'}${c.aba ? `<button type="button" class="vv-num" data-espiar-gestao="${c.aba}">Ver na Gestão →</button>` : ''}</div>`;
    espiaoEl.hidden = false;
    const r = ancora.getBoundingClientRect(), w = Math.min(380, innerWidth - 16);
    espiaoEl.style.width = w + 'px';
    espiaoEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
    const h = Math.min(espiaoEl.offsetHeight, innerHeight - 16), embaixo = r.bottom + 8 + h < innerHeight;
    espiaoEl.style.top = (embaixo ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + 'px';
  }
  function fecharEspiar() { clearTimeout(espiaoTimer); espiaoTimer = null; espiaoEl.hidden = true; espiaoFixo = false; espiaoAncora = null; }
  const ponteiroFino = () => !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  document.addEventListener?.('mouseover', (e) => {
    if (!ponteiroFino() || espiaoFixo) return;
    const a = e.target.closest?.('[data-espiar]');
    if (a) { clearTimeout(espiaoTimer); espiaoTimer = a === espiaoAncora ? null : setTimeout(() => mostrarEspiar(a, false), 380); return; }
    if (e.target.closest?.('.vv-espiar')) { clearTimeout(espiaoTimer); espiaoTimer = null; return; }
    if (!espiaoEl.hidden) { clearTimeout(espiaoTimer); espiaoTimer = setTimeout(fecharEspiar, 220); }
    else if (espiaoTimer) { clearTimeout(espiaoTimer); espiaoTimer = null; }
  });
  // Captura: o clique no número abre o mini painel em vez de jogar para a Gestão inteira.
  document.addEventListener?.('click', (e) => {
    const a = e.target.closest?.('[data-espiar]');
    if (a) { e.preventDefault(); e.stopPropagation(); if (espiaoFixo && espiaoAncora === a) fecharEspiar(); else mostrarEspiar(a, true); return; }
    if (espiaoEl.hidden || e.target.closest?.('.vv-espiar')) return;
    fecharEspiar();
  }, true);
  document.addEventListener?.('keydown', (e) => {
    if (e.key === 'Escape' && !espiaoEl.hidden) { e.preventDefault(); e.stopPropagation(); fecharEspiar(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-espiar][role="button"]')) { e.preventDefault(); mostrarEspiar(e.target, true); }
  }, true);
  espiaoEl.addEventListener?.('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.espiarFechar !== undefined) { fecharEspiar(); return; }
    if (b.dataset.espiarItem !== undefined) { const c = espiaoAtual, it = c?.itens?.[Number(b.dataset.espiarItem)]; fecharEspiar(); if (it) c.clicar?.(it); return; }
    if (b.dataset.espiarGestao !== undefined) { const aba = b.dataset.espiarGestao; fecharEspiar(); abrirGestao(aba); return; }
    if (b.dataset.hojeAcao === 'peca') { fecharEspiar(); chamar('openItemWorkspace', String(b.dataset.valor)); return; }
    if (b.dataset.espiarCliente) { const c = b.dataset.espiarCliente; fecharEspiar(); if (!gestao.hidden) fecharGestao(); mostrarPendencias(c); }
  });
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
    if (b.dataset.gestaoAba) { gestaoAba = b.dataset.gestaoAba; marcarTrilho(gestaoAba === 'performance' ? 'performance' : 'gestao'); pintarGestao(); gestao.scrollTop = 0; return; }
    if (b.dataset.perfDias) { window.VybePerformance?.definirDias?.(b.dataset.perfDias); pintarGestao(); return; }
    if (b.dataset.hojeAcao === 'peca') { chamar('openItemWorkspace', String(b.dataset.valor)); return; }
    if (b.dataset.cerebroCliente) { fecharGestao(); chamar('chooseClientMode'); setTimeout(() => { chamar('abrirModalCerebroCliente', b.dataset.cerebroCliente); window.VybeTutorial?.dica?.('cerebro-cliente'); }, 450); return; }
    if (b.dataset.agente) { fecharGestao(); const [an, se] = b.dataset.agente.split('|'); window.vybesAbrirAgente?.(an, se); }
  });
  if (typeof setInterval === 'function') setInterval(() => { if (!gestao.hidden) pintarGestao(); }, 60000);

  let diaEscolhido = '';
  // Padrão v2 (moodboard B2): Minhas tarefas é uma lista só, na ordem do guia. O filtro e a linha aberta ficam fora do
  // HTML pintado (aplicarLinhaAberta põe o aria-expanded depois), para a linha abrir com o movimento, sem redesenhar.
  let filtroTarefas = 'hoje', linhaAberta = '', buscaTarefas = '', listaInteira = false, soListaAgora = false;
  function aplicarLinhaAberta(raiz = hud) {
    raiz.querySelectorAll?.('#vv-hoje .v2-linha').forEach((l) => { const a = l.dataset.linha === linhaAberta;
      l.setAttribute('aria-expanded', String(a)); l.querySelector('.v2-linha-seta')?.setAttribute('aria-expanded', String(a)); });
  }
  function meusCompromissos() {
    let eventos; try { eventos = agendaEventos; } catch { return []; } // a agenda ainda não foi lida
    if (!Array.isArray(eventos)) return [];
    const lista = typeof TEAM_USERS !== 'undefined' && Array.isArray(TEAM_USERS) ? TEAM_USERS : [];
    const u = typeof operadorDoTopo === 'function' ? operadorDoTopo() : null;
    const quem = primeiroNome(verComo ? lista.find((x) => String(x.id) === verComo)?.name : (u?.name || u?.nome)).replace(/[^a-z]/g, '');
    if (!quem) return [];
    const time = lista.map((x) => primeiroNome(x.name || x.nome));
    const unico = time.filter((n) => n === quem).length <= 1;
    const semAcento = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const citado = (e) => unico && new RegExp('\\b' + quem + '\\b').test(semAcento(e.titulo));
    const mizinho = quem === 'ademir' || quem === 'mizinho';
    const hm = new Date().toTimeString().slice(0, 5), hoje = hojeIso();
    return eventos.filter((e) => (e.dia > hoje || !e.fim || e.fim >= hm)
      && (citado(e) || (mizinho && (e.tipo === 'captacao' || /\bmizinho\b/.test(semAcento(e.titulo)))) || (quem === 'paulo' && e.tipo !== 'captacao')))
      .sort((a, b) => (a.dia + (a.inicio || '00:00')).localeCompare(b.dia + (b.inicio || '00:00')));
  }
  const eventoHtml = (e, quando) => `<button type="button" class="vv-evento" style="--c:${TIPO_COR[e.tipo] || TIPO_COR.outro}" data-agenda-dia="${esc(e.dia)}"><small>${esc([quando, e.inicio ? e.inicio.replace(':00', 'h').replace(':', 'h') : ''].filter(Boolean).join(' · '))} · ${esc(TIPO_NOME[e.tipo] || 'Compromisso')}</small><b>${esc(e.titulo || 'Sem título')}</b>${e.local || e.cliente ? `<span>${esc(e.local || e.cliente)}</span>` : ''}</button>`;
  // Agenda de hoje (quadro 31): os eventos do dia pela agenda única (a das Captações), com carregando, erro e vazio.
  function agendaDeHojeHtml() {
    const hoje = hojeIso();
    let eventos = null, erro = ''; try { eventos = agendaEventos; erro = agendaErro; } catch { /* a agenda ainda não foi lida */ }
    const lista = Array.isArray(eventos) ? eventos.filter((e) => e.dia === hoje).sort((a, b) => (a.inicio || '00:00').localeCompare(b.inicio || '00:00')) : [];
    const corpo = erro && !Array.isArray(eventos) ? vbEstadoHtml({ tipo: 'erro', titulo: 'A agenda não veio', texto: erro, acao: '<button type="button" class="vv-mais" data-hoje-acao="agenda-ler">Tentar de novo</button>' })
      : !Array.isArray(eventos) ? vbEstadoHtml({ tipo: 'carregando', titulo: 'Lendo a agenda' })
      : lista.length ? lista.slice(0, 4).map((e) => eventoHtml(e, '')).join('') + (lista.length > 4 ? `<button type="button" class="vv-mais" data-hoje-acao="agenda">+ ${lista.length - 4} na agenda</button>` : '')
      : vbEstadoHtml({ tipo: 'vazio', titulo: 'Nada marcado hoje', texto: 'Captações e reuniões do dia aparecem aqui, pela agenda das Captações.', acao: '<button type="button" class="vv-mais" data-hoje-acao="agenda">Abrir a agenda</button>' });
    return `<section class="vv-hoje-caixa" aria-label="Agenda de hoje"><div class="vv-rotulo-secao" style="--c:#1A8FA0"><i></i>Agenda de hoje${lista.length ? `<span class="vv-pilula">${lista.length}</span>` : ''}</div>${corpo}</section>`;
  }
  // Os agentes viram (quadro 31): o começo da fila Depende de você (filaDoDono, vybe-mundo-agentes.js), com Abrir.
  function agentesViramHtml() {
    const r = window.VybeAgentes?.resumoParaHoje?.(3);
    const corpo = !r ? vbEstadoHtml({ tipo: 'carregando', titulo: 'Lendo os agentes' })
      : !r.pode ? vbEstadoHtml({ tipo: 'vazio', titulo: 'Os achados vão para os donos', texto: 'O que os agentes encontram espera um dono decidir em Depende de você. Quando mexe nas suas peças, aparece nelas.' })
      : !r.itens.length && r.lendo ? vbEstadoHtml({ tipo: 'carregando', titulo: 'Lendo os agentes' })
      : !r.itens.length ? vbEstadoHtml({ tipo: 'vazio', titulo: 'Nada esperando você', texto: 'Quando um agente pedir o seu OK, achar algo urgente ou falhar, aparece aqui.', acao: '<button type="button" class="vv-mais" data-hoje-acao="agentes">Abrir Depende de você</button>' })
      : `<ul class="vv-agentes-viram">${r.itens.map((it) => `<li><span><b>${esc(it.titulo)}</b><small>${esc(it.agente)} · ${esc(it.rotulo)}</small></span><button type="button" class="vv-mais" data-hoje-acao="agente" data-valor="${esc(it.setor)}|${esc(it.chave || '')}" aria-label="Abrir: ${esc(it.titulo)}">Abrir</button></li>`).join('')}</ul>`
        + (r.total > r.itens.length ? `<button type="button" class="vv-mais" data-hoje-acao="agentes">+ ${r.total - r.itens.length} em Depende de você</button>` : '');
    return `<section class="vv-hoje-caixa" aria-label="Os agentes viram"><div class="vv-rotulo-secao" style="--c:#7A5AF8"><i></i>Os agentes viram${r?.total ? `<span class="vv-pilula">${r.total}</span>` : ''}</div>${corpo}</section>`;
  }
  document.addEventListener('vybe:agentes', () => pintarHoje());
  function compromissosHtml() {
    if (!verComo && agendaFixa()) return ''; // o Mizinho já tem a Agenda fixa ao lado
    const lista = meusCompromissos(); if (!lista.length) return '';
    const hoje = hojeIso(), amanha = somar(hoje, 1);
    return `<section class="vv-compromissos" aria-label="Seus compromissos"><div class="vv-rotulo-secao" style="--c:#1A8FA0"><i></i>Seus compromissos<span class="vv-pilula">${lista.length}</span></div>
      ${lista.slice(0, 3).map((e) => eventoHtml(e, e.dia === hoje ? 'Hoje' : e.dia === amanha ? 'Amanhã' : new Date(`${e.dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).replace('.', ''))).join('')}${lista.length > 3 ? `<button type="button" class="vv-mais" data-hoje-acao="agenda">+ ${lista.length - 3} na agenda</button>` : ''}</section>`;
  }
  // ---------- Criação: o time do Deivid (Paulo, 09/11/2026: "uma visualização parecida com a agência, mas voltada para
  // a direção de arte, para o time de criação, para o Deivid acompanhar tudo... com Jady, Bia e Reriston"; "o painel de
  // direção de arte ainda está muito defasado, muita informação solta"). O Danilo guia; os números, as pessoas e as filas
  // saem das mesmas peças do painel (as abertas de quem é do time, pelos responsáveis), com a situação oficial da peça.
  let criacaoPeloDock = false;
  function pecasDaCriacao(fonte = typeof unifiedOperationalItems === 'function' ? unifiedOperationalItems() : []) {
    const time = timeDeCriacao();
    const ids = (d) => [...(d.responsavel_ids || []), d.responsavel_id].filter((x) => x != null).map(String);
    return fonte.filter((d) => !(typeof isFinishedItem === 'function' && isFinishedItem(d)) && ids(d).some((id) => time.includes(id))).map((d) => ({ d, ids: ids(d) }));
  }
  function pintarCriacao(el, { data }) {
    const hoje = hojeIso(), T = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [], dono = souDono();
    const membros = timeDeCriacao().map((id) => T.find((u) => String(u.id) === id)).filter(Boolean);
    const curto = (u) => String(u.name || u.nome || '').split(' ')[0];
    const papel = (u) => (typeof DA_CONTROLLER_ROLES !== 'undefined' && DA_CONTROLLER_ROLES[u.id]) || 'Criação';
    const todas = typeof unifiedOperationalItems === 'function' ? unifiedOperationalItems() : [];
    const itens = pecasDaCriacao(todas).map(({ d, ids }) => ({ d, sit: situacaoDaPeca(d), quem: membros.filter((u) => ids.includes(String(u.id))).map(curto), ids }));
    const { passos, urgentes, ordem } = passosDoGuia(itens, hoje, true);
    const atrasadas = itens.filter((x) => x.sit === 'atrasada' && !prazoDesatualizado(x, hoje));
    const deHoje = itens.filter((x) => veicDe(x) === hoje && !atrasadas.includes(x));
    const aprovar = itens.filter((x) => /aprova/i.test(String(x.d.status || '')));
    const ajuste = itens.filter((x) => /altera|ajuste|corre/i.test(String(x.d.status || '')));
    const dias = Array.from({ length: 7 }, (_, i) => somar(hoje, i)).map((dia) => ({ dia, n: itens.filter((x) => veicDe(x) === dia).length }));
    const maxDia = Math.max(1, ...dias.map((x) => x.n));
    // O assistente do Deivid (vybe-mundo-criacao.js): a conversa do dia, o que delegar e cobrar (com aprovar) e o
    // confirmado × sugestão por cliente. Peso e limite de carga são os do painel antigo de direção de arte.
    const fin = (d) => (typeof isFinishedItem === 'function' ? isFinishedItem(d) : situacaoDaPeca(d) === 'concluida');
    let A = null;
    try {
      A = window.VybeCriacao?.assistente?.({ itens, todas, ordem, aprovar: ordem.filter((x) => aprovar.includes(x)), deHoje: deHoje.length, atrasadas: atrasadas.length, membros,
        motivo: (x) => motivoNoGuia(x, hoje), finalizada: fin, eu: typeof operadorDoTopo === 'function' ? operadorDoTopo()?.id : '',
        peso: (d, u) => (typeof daEffortWeight === 'function' ? daEffortWeight(d, u) : 1), limite: (u) => (typeof daCapacitySignal === 'function' ? daCapacitySignal(u, []).threshold : 14) }) || null;
    } catch (e) { console.error('[mundo] assistente da Criação', e); }
    const cargaDe = (u) => A?.perfis?.find((p) => p.id === String(u.id));
    // ===== Hoje · Criação pelo quadro "Direção de arte" do moodboard (Paulo, 12/11/2026: "eu aprovei o DEPOIS") =====
    // A tela é o quadro: "Criação" com o time e as abas; a fala do Danilo com Perguntar e Ver o agente; os três números;
    // a Fila do Danilo (delegar e cobrar, de vybe-mundo-criacao.js); "Esperando o seu parecer" em baralho; e o Time, com
    // a carga de cada pessoa. Saíram, porque o quadro não tem: o anel, as três listas, a semana do time e os atalhos.
    const porPessoa = membros.map((u) => { const l = itens.filter((x) => x.ids.includes(String(u.id))); return { u, l, atr: l.filter((x) => atrasadas.includes(x)).length, hj: l.filter((x) => deHoje.includes(x)).length }; });
    const maisAtrasada = porPessoa.slice().sort((a, b) => b.atr - a.atr)[0];
    const acima = porPessoa.filter((x) => { const c = cargaDe(x.u); return c && c.carga > c.limite; }).map((x) => curto(x.u));
    const frase = !itens.length ? 'O time está sem peças em aberto.'
      : `<b>${plural(deHoje.length, 'peça vai', 'peças vão')} ao ar hoje</b>. ${atrasadas.length ? `<b>${plural(atrasadas.length, 'atrasada', 'atrasadas')}</b>${maisAtrasada?.atr ? `, ${maisAtrasada.atr === atrasadas.length ? 'todas' : n0(maisAtrasada.atr)} com ${esc(curto(maisAtrasada.u))}` : ''}.` : 'Nada atrasado.'}${acima.length ? ` ${esc(acima.join(' e '))} ${acima.length > 1 ? 'passaram' : 'passou'} do limite de carga.` : ''}`;
    const fala = `<section class="v2t-fala" aria-label="Guia do Danilo"><span class="vg-av" aria-hidden="true">D</span><p><span class="v2t-quem">Danilo · Direção de arte · o que temos para hoje</span>${frase}</p>
        ${A?.conversa ? '<button type="button" class="v2t-btn" data-criacao-atalho="perguntar" aria-expanded="false">Perguntar ao Danilo</button>' : ''}${dono ? '<button type="button" class="v2t-btn" data-pend-agente="design">Ver o agente</button>' : ''}</section>
      ${A?.conversa ? `<div class="v2c-conversa" hidden>${A.conversa}</div>` : ''}`;
    const numeros = `<div class="v2c-nums"><p class="${atrasadas.length ? 'ruim' : 'quieto'}"><b><span class="v2-num">${n0(atrasadas.length)}</span></b><small>${rotuloDe(atrasadas.length, 'atrasada', 'atrasadas')} no time</small></p>
        <p class="${deHoje.length ? '' : 'quieto'}"><b><span class="v2-num">${n0(deHoje.length)}</span></b><small>${rotuloDe(deHoje.length, 'vai', 'vão')} ao ar hoje</small></p>
        <p class="${aprovar.length ? '' : 'quieto'}"><b><span class="v2-num">${n0(aprovar.length)}</span></b><small>esperando aprovação</small></p></div>`;
    const totalAberto = itens.length;
    const time = `<section class="v2c-time" aria-label="Time"><div class="v2a-cab"><h3>Time</h3><small>${n0(totalAberto)} em aberto</small></div>
        ${porPessoa.map((x) => { const c = cargaDe(x.u), pct = c ? Math.min(100, Math.round(c.carga / Math.max(1, c.limite) * 100)) : Math.round(x.l.length / Math.max(1, ...porPessoa.map((y) => y.l.length)) * 100), passou = c && c.carga > c.limite;
          return `<button type="button" class="v2c-pes" data-criacao-pessoa="${esc(x.u.id)}" title="Ver o dia de ${esc(curto(x.u))}"><i aria-hidden="true">${esc(curto(x.u).slice(0, 2).toUpperCase())}</i><span><span><b>${esc(curto(x.u))}</b> · ${esc(papel(x.u))}</span>
            <span class="v2-barra" style="--v:${pct}%;--c:${passou ? '#B42318' : '#11613A'}"><i></i></span><small>${n0(x.l.length)} em aberto · ${x.atr ? `<b class="ruim">${plural(x.atr, 'atrasada', 'atrasadas')}</b>` : '0 atrasadas'} · ${n0(x.hj)} hoje${c ? ` · ${n0(c.carga)} de ${n0(c.limite)} pontos` : ''}</small></span></button>`; }).join('')}</section>
      <button type="button" class="v2c-ajuste" data-criacao-atalho="ajustes"><span>Pediram ajuste</span><b>${n0(ajuste.length)}</b></button>
      <p class="v2t-pe">Nada muda sem o seu OK.</p>`;
    const corpo = !itens.length
      ? `${A?.clientesHtml ? `<p class="v2c-vazio"><button type="button" class="v2t-btn" data-criacao-atalho="sugestoes" aria-expanded="false">Ver sugestões dos clientes</button></p><div class="v2c-sugestoes" hidden>${A.clientesHtml}</div>` : ''}`
      : `<div class="v2c-corpo"><div class="v2c-esq">${numeros}${A?.sugestoes || '<section class="v2a-cartao"><div class="v2a-cab"><h3>Fila do Danilo</h3><small>nada para delegar ou cobrar</small></div></section>'}${A?.mudouHtml || ''}</div>
          ${!verComo ? decidirHtml({ titulo: 'Esperando o seu parecer', artes: true }) : ''}
          <div class="v2c-dir">${time}</div></div>`;
    const html = `<div class="v2t v2c"><div class="v2t-topo"><span class="v2t-ola"><small class="vv-data">${esc(data)}</small><h2>Criação</h2></span>
        <span class="v2a-online"><span class="v2a-avs" aria-hidden="true">${membros.slice(0, 5).map((u) => `<i>${esc(curto(u).slice(0, 2).toUpperCase())}</i>`).join('')}</span><small>${esc(membros.map(curto).join(', '))}</small></span>${dono && !verComo ? segHoje('criacao') : ''}</div>
      ${fala}
      ${corpo}</div>`;
    if (el.vvHtml !== html) { el.innerHTML = html; el.vvHtml = html; }
  }
  // Minha sala (quadro 34 do redesign, 10/11/2026: "o Hoje continua à vista na sala, mais estreito... a gaveta da Agenda
  // entra nele, e o quarto fica com o resto"): na sala, o fim do Hoje ganha a Agenda (a mesma lista da gaveta, pintada por
  // agendaListaHtml) e a gaveta da direita sai. Fora da sala nada muda.
  function pintarHoje() { desenharHoje(); agendaNoHoje(); }
  function agendaNoHoje() {
    const el = hud.querySelector('#vv-hoje'); if (!el) return;
    let sec = el.querySelector(':scope > .vv-hoje-agenda');
    if (!body.classList.contains('mundo-quarto') || body.classList.contains('mundo-cartoes')) { sec?.remove(); return; }
    let lista = ''; try { lista = agendaListaHtml(3); } catch { /* a agenda ainda não foi lida */ }
    const roteiros = hud.querySelector('#vv-roteiros'), rot = roteiros && !roteiros.hidden ? roteiros.innerHTML : '';
    const html = `<div class="vv-rotulo-secao" style="--c:#1A8FA0"><i></i>Agenda</div><div class="vv-agenda-lista">${lista || '<p class="vv-dica">Carregando a agenda…</p>'}</div>${rot ? `<div class="vv-roteiros">${rot}</div>` : ''}<button type="button" class="vv-mais" data-hoje-acao="agenda">Abrir a agenda completa →</button>`;
    if (!sec) { sec = document.createElement('section'); sec.className = 'vv-hoje-agenda'; sec.setAttribute('aria-label', 'Agenda da Vybe'); }
    if (sec.vvHtml !== html) { sec.innerHTML = html; sec.vvHtml = html; }
    if (sec.parentNode !== el || el.lastElementChild !== sec) el.append(sec);
  }
  function desenharHoje() {
    // A sessão chega depois do primeiro desenho: a cada pintura, os cadeados e o "ver como" seguem quem entrou.
    conferirVerComo(); aplicarCadeados(); marcarVerComo();
    const el = hud.querySelector('#vv-hoje'); if (!el || body.classList.contains('mundo-cartoes')) return;
    const fila = minhaFila(), hoje = hojeIso(), agora = new Date();
    const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const h = agora.getHours(), saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const nome = String(fila?.user?.name || fila?.user?.nome || (typeof operadorDoTopo === 'function' ? (operadorDoTopo()?.name || operadorDoTopo()?.nome) : '') || '').split(' ')[0];
    const dono = souDono(); body.classList.toggle('eh-dono', dono);
    if (dono && !verComo && visaoHoje === 'agencia') { pintarAgencia(el, { data, saud, nome }); return; }
    if (visaoHoje === 'criacao' && ((dono && !verComo) || criacaoPeloDock)) { pintarCriacao(el, { data }); return; }
    const segDono = dono && !verComo ? segHoje('tarefas') : '';
    // O título do dia com "Criar" à direita, o mesmo cabeçalho de todas as telas (quadro 31).
    const criarHtml = `<button type="button" class="vv-hoje-criar" data-trilho="criar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Criar</button>`;
    if (!fila) {
      // Sem a fila pelo usuário (quadro 31 do redesign): a pergunta "De quem é este dia?" na própria tela, o guia do VYBES
      // na ordem da fila (passosDoGuia, com as peças abertas da agência) e o dia: agenda de hoje e o que os agentes viram.
      const carregou = typeof DADOS_ALL !== 'undefined' && DADOS_ALL?.length;
      const time = (typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : []).filter((u) => u?.id != null && (u.name || u.nome));
      const nomeCurto = (u) => String(u.name || u.nome || '').split(' ')[0];
      // Dois com o mesmo primeiro nome (Ewerton e Ewerton L.): o chip leva o segundo nome também.
      const repetido = (u) => time.filter((x) => nomeCurto(x) === nomeCurto(u)).length > 1;
      const nomeDoChip = (u) => (repetido(u) ? String(u.name || u.nome).split(' ').slice(0, 2).join(' ') : nomeCurto(u));
      const topo = `${segDono}<div class="vv-hoje-topo"><span><small class="vv-data">${esc(data)}</small><h2>${saud}${nome ? ', <em>' + esc(nome) + '</em>' : ''}</h2></span>${criarHtml}</div>`;
      const quem = `<section class="vv-quem-dia" aria-labelledby="vv-quem-dia-t"><div class="vv-quem-dia-txt"><h3 id="vv-quem-dia-t">De quem é este dia?</h3>
          <p>Não achei sua fila pelo seu usuário. Escolha uma vez; fica guardado neste navegador.</p></div>
        ${time.length ? `<div class="vv-quem-chips" role="group" aria-label="Pessoas da equipe">${time.map((u) => `<button type="button" class="vv-pessoa-chip" data-pessoa-dia="${esc(u.id)}" title="${esc(u.name || u.nome)}">${esc(nomeDoChip(u))}</button>`).join('')}</div>`
          : vbEstadoHtml({ tipo: carregou ? 'vazio' : 'carregando', titulo: carregou ? 'Sem a lista da equipe' : 'Carregando a equipe', texto: 'A lista da equipe chega com os dados do painel.' })}</section>`;
      let guia = '';
      if (!carregou) guia = vbEstadoHtml({ tipo: 'carregando', titulo: 'Carregando a fila' });
      else {
        const todas = typeof unifiedOperationalItems === 'function' ? unifiedOperationalItems() : DADOS_ALL;
        const porId = new Map(time.map((u) => [String(u.id), nomeCurto(u)]));
        const abertasAg = todas.filter((d) => !(typeof isFinishedItem === 'function' && isFinishedItem(d)))
          .map((d) => ({ d, sit: situacaoDaPeca(d), quem: [...new Set([...(d.responsavel_ids || []), d.responsavel_id].filter((x) => x != null).map((x) => porId.get(String(x))).filter(Boolean))] }));
        const { urgentes: urg, passos } = passosDoGuia(abertasAg, hoje, true);
        guia = guiaHtml({ agente: { nome: 'VYBES', papel: 'Orquestrador · guia do dia', setor: 'orquestrador' },
          intro: !abertasAg.length ? 'Nenhuma peça aberta na agência agora.' : urg ? `A agência tem <b>${urg} atrasada${urg > 1 ? 's' : ''}</b>. Enquanto você não escolhe, a ordem da agência:` : 'Enquanto você não escolhe, a ordem da agência:',
          passos,
          depois: abertasAg.length > 3 ? `Depois disso, mais ${abertasAg.length - 3} na agência. <button type="button" class="vg-link" data-hoje-acao="demandas">Ver todas as demandas</button>` : '' });
      }
      const html = `${topo}${quem}<div class="vv-hoje-sem-fila">${guia}${!verComo ? (window.VybeAprovacoes?.blocoHtml?.('tarefas') || '') : ''}
          <div class="vv-hoje-dia">${agendaDeHojeHtml()}${agentesViramHtml()}</div></div>`;
      if (el.vvHtml !== html) { el.innerHTML = html; el.vvHtml = html; }
      return;
    }
    const abertas = fila.itens.filter((x) => x.sit !== 'concluida');
    const atrasadas = abertas.filter((x) => x.sit === 'atrasada'), deHoje = abertas.filter((x) => x.ref === hoje && x.sit !== 'atrasada');
    const proximos = Array.from({ length: 6 }, (_, i) => somar(hoje, i + 1)).map((dia) => ({ dia, n: abertas.filter((x) => x.ref === dia).length }));
    const titulo = (x) => String(x.d.nome || x.d.titulo || 'Peça').trim();
    const cliente = (x) => (typeof clientesDoItem === 'function' ? clientesDoItem(x.d)[0] : x.d.cliente) || '';
    const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    // A data do cliente manda (Paulo, 08/11/2026): a fila segue a VEICULAÇÃO. Prazo interno vencido com veiculação
    // adiante é "prazo desatualizado" (o time não atualizou o prazo): alerta, mas não passa na frente de quem veicula antes.
    const veic = veicDe, desatualizada = (x) => prazoDesatualizado(x, hoje), chaveFila = (x) => chaveDaFila(x, hoje); // as regras do guia
    const naFila = (diaEscolhido ? abertas.filter((x) => (veic(x) || x.ref) === diaEscolhido) : abertas).slice().sort((a, b) => chaveFila(a).localeCompare(chaveFila(b)));
    const desatualizadas = abertas.filter(desatualizada);
    // Por status, como o Minhas Tarefas: o grupo mais urgente primeiro (alteração, aprovação…), e dentro dele pela veiculação.
    const grupos = new Map();
    for (const x of naFila) { const st = String(x.d.status || 'Sem status').trim() || 'Sem status'; if (!grupos.has(st)) grupos.set(st, { st, itens: [], ordem: 9, cor: corStatus(x.d, x.sit) }); const g = grupos.get(st); g.itens.push(x); g.ordem = Math.min(g.ordem, ORDEM[x.sit === 'atrasada' && desatualizada(x) ? (/altera|ajuste/i.test(st) ? 'ajuste' : /aprova/i.test(st) ? 'aprovar' : 'fazer') : x.sit] ?? 9); }
    // Ordem do fluxo (não do relógio): o que pede retrabalho e aprovação primeiro, depois produção, cliente e agendado.
    const rankStatus = (st) => /altera|ajuste|corre/i.test(st) ? 0 : /aprova/i.test(st) ? 1 : /andamento|produ/i.test(st) ? 2 : /pode fazer/i.test(st) ? 3 : /a fazer|fazer/i.test(st) ? 4 : /info|briefing|cliente/i.test(st) ? 5 : /agend|pronta|aprovado/i.test(st) ? 7 : 6;
    const porStatus = [...grupos.values()].sort((a, b) => rankStatus(a.st) - rankStatus(b.st) || chaveFila(a.itens[0]).localeCompare(chaveFila(b.itens[0])));
    const item = (x) => linhaDemanda(x.d, { ref: veic(x) || x.ref, sit: desatualizada(x) ? (x.sit === 'atrasada' ? 'fazer' : x.sit) : x.sit, aviso: desatualizada(x) ? 'prazo desatualizado' : '', quem: fila.users.length > 1 ? x.quem : null, acoes: true });
    const POR_GRUPO = innerHeight >= 1000 ? 4 : innerHeight >= 760 ? 3 : 2; // cabe na tela; o resto fica no "+N" (Modo Foco)
    const admin = typeof souAdmin === 'function' && souAdmin(), time = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
    // "Ver o dia de" (só os donos): as pessoas do dia como fichas, adicionar pela lista e o atalho do time de criação.
    const euId = String((typeof operadorDoTopo === 'function' ? operadorDoTopo()?.id : '') || '');
    const nomeCurto = (u) => String(u.name || u.nome || '').split(' ')[0];
    const selIds = fila.users.map((u) => String(u.id));
    const filtroPessoas = dono && !verComo && time.length ? `<div class="vv-pessoas-dia" role="group" aria-label="De quem é o dia"><span class="vv-pessoas-rot">Ver o dia de</span>
        ${fila.users.map((u) => `<button type="button" class="vv-pessoa-chip" data-pessoa-tirar="${esc(u.id)}" ${fila.users.length === 1 ? 'disabled' : ''} title="${fila.users.length === 1 ? 'Adicione alguém para juntar os dias' : 'Tirar ' + esc(nomeCurto(u)) + ' do dia'}">${String(u.id) === euId ? 'Eu' : esc(nomeCurto(u))}${fila.users.length > 1 ? '<i aria-hidden="true">×</i>' : ''}</button>`).join('')}
        <select class="vv-pessoa-add" data-pessoa-add aria-label="Adicionar pessoa ao dia"><option value="">+ Adicionar</option>${time.filter((u) => !selIds.includes(String(u.id))).map((u) => `<option value="${esc(u.id)}">${esc(u.name || u.nome)}</option>`).join('')}</select>
        <button type="button" class="vv-pessoas-atalho" data-pessoas-atalho="criacao">Time de criação</button>${selIds.length > 1 || selIds[0] !== euId ? '<button type="button" class="vv-pessoas-atalho" data-pessoas-atalho="eu">Só eu</button>' : ''}</div>` : '';
    const varios = fila.users.length > 1;
    // ===== Minhas tarefas pelo quadro B2 do moodboard (Paulo, 12/11/2026: "a gente fez o moodboard pra quê?") =====
    // A tela é o quadro, nesta ordem: saudação com as abas, "Dia de" e Criar na mesma linha; a fala do guia ao lado dos
    // três números; os filtros (Hoje, Semana, Atrasadas, Feitas), a busca e Filtros; a lista "na ordem" com a bolinha
    // que conclui, o status que troca na linha e a linha que abre no lugar; à direita, a agenda e o que os agentes viram.
    // Saíram da tela, porque o quadro não tem: a faixa de dias, o guia em três passos, o anel, a pergunta e os atalhos.
    const iniSem = window.VybeDono?.util?.inicioDaSemana?.(hoje) || hoje, fimSem = somar(iniSem, 6);
    const dataDe = (x) => veic(x) || x.ref || '';
    const feitas = typeof unifiedOperationalItems === 'function' && typeof isFinishedItem === 'function'
      ? unifiedOperationalItems().filter((d) => { const r = String(d.veiculacao_iso || d.prazo_iso || '').slice(0, 10);
        return r >= iniSem && r <= fimSem && isFinishedItem(d) && [...(d.responsavel_ids || []), d.responsavel_id].some((id) => id != null && selIds.includes(String(id))); })
        .map((d) => ({ d, ref: String(d.veiculacao_iso || d.prazo_iso || '').slice(0, 10), sit: 'concluida', quem: [] })) : [];
    const atrasadasP = naFila.filter((x) => x.sit === 'atrasada' && !desatualizada(x));
    const deHojeP = naFila.filter((x) => !atrasadasP.includes(x) && dataDe(x) === hoje);
    const hojeP = naFila.filter((x) => atrasadasP.includes(x) || deHojeP.includes(x));
    const semanaP = naFila.filter((x) => hojeP.includes(x) || (dataDe(x) && dataDe(x) <= fimSem));
    const amanha = abertas.filter((x) => x.sit !== 'atrasada' && dataDe(x) === somar(hoje, 1)).length;
    const maisAntiga = atrasadasP.map(dataDe).filter(Boolean).sort()[0] || '';
    const diasDe = (iso) => Math.max(1, Math.round((Date.parse(hoje + 'T12:00:00Z') - Date.parse(iso + 'T12:00:00Z')) / 864e5));
    const daSemana = feitas.length + semanaP.length;
    const numeros = tresNumerosHtml([
      { titulo: 'Para hoje', valor: n0(deHojeP.length), sub: amanha ? `${n0(amanha)} ${rotuloDe(amanha, 'veicula', 'veiculam')} amanhã` : deHojeP.length ? 'pela data do cliente' : 'nada vence hoje', quieto: !deHojeP.length },
      { titulo: 'Atrasadas', valor: n0(atrasadasP.length), sub: atrasadasP.length ? (maisAntiga ? `a mais antiga, ${plural(diasDe(maisAntiga), 'dia', 'dias')}` : 'sem data do cliente') : 'nada atrasado', tom: 'ruim', quieto: !atrasadasP.length },
      { titulo: 'Feitas na semana', valor: n0(feitas.length), sub: '', barra: daSemana ? feitas.length / daSemana * 100 : 0, cor: '#11613A', quieto: !feitas.length },
    ]);
    // A fala do guia: uma frase, com o primeiro passo e o que vem depois. "Começar" abre a primeira peça.
    const { passos: passosGuia } = passosDoGuia(abertas, hoje, varios);
    const agente = guiaDe(fila.users), primeira = naFila[0], segunda = naFila[1];
    const nomeCli = (x) => (cliente(x) ? ` (${esc(cliente(x))})` : '');
    const frase = !primeira ? 'Fila limpa. Bom momento para adiantar o que vem ou ajudar alguém do time.'
      : `Comece por <b>${esc(semGrito(titulo(primeira)))}</b>${nomeCli(primeira)}: ${esc(motivoNoGuia(primeira, hoje).replace(/^./, (c) => c.toLowerCase()))}.${amanha ? ` Depois, ${amanha === 1 ? 'a que veicula' : `as ${n0(amanha)} que veiculam`} amanhã.` : segunda ? ` Depois, <b>${esc(semGrito(titulo(segunda)))}</b>${nomeCli(segunda)}.` : ''}`;
    const avGuia = agente.nome === 'VYBES' ? '<span class="vv-ser vg-av-ser" aria-hidden="true"><i></i></span>' : `<span class="vg-av" aria-hidden="true">${esc(agente.nome.slice(0, 1))}</span>`;
    const fala = `<section class="v2t-fala" aria-label="Guia de ${esc(agente.nome)}">${avGuia}<p><span class="v2t-quem">${esc(agente.nome)} · guia do dia</span>${frase}</p>${passosGuia[0] ? `<button type="button" class="v2t-btn" ${passosGuia[0].attrs}>Começar</button>` : ''}</section>`;
    // Filtros: quatro fichas, a busca e "Filtros" (agrupa por status).
    const GRUPOS = { hoje: ['Hoje', hojeP, 'Hoje, na ordem', 'Nada para hoje.'], semana: ['Semana', semanaP, 'Semana, na ordem', 'Nada nesta semana.'], atrasadas: ['Atrasadas', atrasadasP, 'Atrasadas, da mais antiga', 'Nada atrasado.'], feitas: ['Feitas', feitas, 'Feitas na semana', 'Nada concluído nesta semana.'] };
    if (!GRUPOS[filtroTarefas]) filtroTarefas = 'hoje';
    const termo = buscaTarefas.trim().toLowerCase(), bate = (x) => !termo || `${titulo(x)} ${cliente(x)} ${x.d.status || ''}`.toLowerCase().includes(termo);
    const filtros = `<div class="v2t-filtros"><span class="v2t-fichas" role="tablist" aria-label="Filtrar a lista">${Object.entries(GRUPOS).map(([k, [rot, l]]) => `<button type="button" role="tab" class="v2t-ficha" aria-selected="${k === filtroTarefas}" data-hoje-acao="filtro" data-valor="${k}">${rot} <b>${n0(l.length)}</b></button>`).join('')}</span>
        <input type="search" class="v2t-busca" data-busca-tarefas placeholder="Buscar nas minhas tarefas" aria-label="Buscar nas minhas tarefas" value="${esc(buscaTarefas)}">
        <button type="button" class="v2t-btn" data-hoje-acao="${hojeVerTodas ? 'prioridades' : 'todas'}" aria-pressed="${hojeVerTodas}">Filtros</button></div>`;
    // A linha: bolinha, cliente e peça, status (troca ali mesmo), quando, e a seta que abre no lugar.
    const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const quandoHtml = (x) => { const v = dataDe(x);
      if (x.sit === 'concluida') return '<span class="v2t-q ok">feita</span>';
      if (!v) return '<span class="v2t-q">sem data</span>';
      if (v < hoje && !desatualizada(x)) return `<span class="v2t-q ruim">${plural(diasDe(v), 'dia', 'dias')}</span>`;
      if (v === hoje) return '<span class="v2t-q ok">hoje</span>';
      if (v === somar(hoje, 1)) return '<span class="v2t-q atencao">amanhã</span>';
      return `<span class="v2t-q">${v <= somar(hoje, 6) && v > hoje ? NOME_DIA[new Date(v + 'T12:00:00Z').getUTCDay()] : v.slice(8) + '/' + v.slice(5, 7)}</span>`; };
    // Etapas da peça, lidas do status (o painel não guarda etapa por etapa): o que já passou fica marcado.
    const etapasHtml = (d) => { const st = String(d.status || '').toLowerCase(), fim = typeof isFinishedItem === 'function' && isFinishedItem(d);
      const n = fim ? 5 : /agend|aprovad|pronta/.test(st) ? 4 : /aprova/.test(st) ? 3 : /andamento|produ|altera|ajuste|corre/.test(st) ? 2 : d.tem_briefing === false || /briefing|info/.test(st) ? 0 : 1;
      return `<div class="v2t-etapas" title="Pelo status da peça">${['Briefing', 'Texto', 'Arte', 'Aprovação', 'Publicar'].map((e, k) => `<span class="v2t-etapa${k < n ? ' ok' : ''}"><i aria-hidden="true">${k < n ? '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>' : ''}</i>${e}</span>`).join('')}</div>`; };
    const linha = (x) => { const id = esc(String(x.d.id)), feita = x.sit === 'concluida', cli = cliente(x), rot = roteiroDaPeca(x.d);
      const extras = [typeof botaoDeBriefingHtml === 'function' ? botaoDeBriefingHtml(x.d) : '', typeof botaoDeMaterialBrutoHtml === 'function' ? botaoDeMaterialBrutoHtml(x.d) : '', typeof botaoDeEntregaHtml === 'function' ? botaoDeEntregaHtml(x.d) : '',
        rot ? `<a class="focus-brief-btn roteiro" href="${esc(rot.link)}" target="_blank" rel="noopener" title="${esc(rot.titulo || 'Roteiro')}">${typeof vbIcone === 'function' ? vbIcone('documento') : ''}<span>Roteiro</span></a>` : ''].filter(Boolean).join('');
      const olho = typeof botaoDePreviaNaLinha === 'function' ? botaoDePreviaNaLinha(x.d, 'linha-previa vv-olho') : '';
      return `<div class="v2-abre v2-linha${feita ? ' feita' : ''}" data-linha="${id}" aria-expanded="false"><div class="v2t-lin">
          <button type="button" class="v2t-cx${feita ? ' ok' : ''}" data-hoje-acao="concluir" data-valor="${id}" aria-label="${feita ? 'Concluída' : 'Concluir'}: ${esc(titulo(x))}"${feita ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></button>
          <button type="button" class="v2t-nome" data-hoje-acao="linha" data-valor="${id}" title="${esc(titulo(x) + (cli ? ' · ' + cli : ''))}"><span class="v2-risca${feita ? ' feita' : ''}">${cli ? `${cliCor(cli)} · ` : ''}${esc(semGrito(titulo(x)))}</span>${varios && x.quem?.length ? `<small>${esc(x.quem.join(', '))}</small>` : ''}</button>
          <span class="v2t-st">${x.d.status ? (feita ? statusCor(x.d) : `<button type="button" class="vv-demanda-status" onclick="openStatusEditor(event,'${id}')" title="Trocar o status" aria-label="Trocar o status: ${esc(x.d.status)}">${statusCor(x.d)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`) : ''}</span>
          <span class="v2t-quando">${olho}${quandoHtml(x)}</span>
          <button type="button" class="v2-linha-seta" data-hoje-acao="linha" data-valor="${id}" aria-expanded="false" aria-label="Abrir a linha de ${esc(titulo(x))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></div>
        <div class="v2-mais"><div><div class="v2t-det">${etapasHtml(x.d)}
          <div class="v2t-det-linha"><p>${esc(feita ? 'Concluída' : motivoNoGuia(x, hoje))}${desatualizada(x) ? ' · prazo desatualizado' : ''}</p>${extras}
            ${feita ? '' : `<button type="button" class="v2t-btn" onclick="openStatusEditor(event,'${id}')">Passar bastão</button>`}<button type="button" class="v2t-btn k" data-hoje-acao="peca" data-valor="${id}">Abrir</button></div></div></div></div></div>`; };
    function listaHtml() {
      const [, base, tituloLista, vazio] = GRUPOS[filtroTarefas], lista = base.filter(bate), MAX = POR_GRUPO * 3 + 2;
      const cabe = listaInteira || termo ? lista : lista.slice(0, MAX), resto = lista.length - cabe.length;
      let corpo;
      if (!lista.length) corpo = `<p class="vv-vazio">${termo ? 'Nada com esse texto neste filtro.' : vazio}</p>`;
      else if (hojeVerTodas && filtroTarefas !== 'feitas') { // "Filtros": a mesma lista, agrupada por status
        const g = new Map(); for (const x of cabe) { const st = String(x.d.status || 'Sem status').trim() || 'Sem status'; if (!g.has(st)) g.set(st, []); g.get(st).push(x); }
        corpo = [...g.entries()].sort((a, b) => rankStatus(a[0]) - rankStatus(b[0])).map(([st, l]) => `<div class="v2t-grupo"><span>${esc(st)}</span><b>${l.length}</b></div>${l.map(linha).join('')}`).join('');
      } else corpo = cabe.map(linha).join('');
      const naSemana = semanaP.length - hojeP.length;
      const pe = [resto > 0 ? `+ ${n0(resto)} neste filtro · <button type="button" class="vg-link" data-hoje-acao="lista-inteira">mostrar</button>` : filtroTarefas === 'hoje' && naSemana > 0 ? `+ ${n0(naSemana)} na semana · <button type="button" class="vg-link" data-hoje-acao="filtro" data-valor="semana">mostrar</button>` : '',
        '<button type="button" class="vg-link" data-hoje-acao="demandas">ver todas as demandas</button>'].filter(Boolean).join(' · ');
      return `<section class="v2-lista" aria-label="Minha fila"><div class="v2-lista-topo"><h3>${tituloLista}${hojeVerTodas && filtroTarefas !== 'feitas' ? ' · por status' : ''}</h3><small>toque no status para trocar</small></div>${corpo}<p class="v2t-pe">${pe}</p></section>`;
    }
    // "Dia de …": para os donos, a ficha abre quem está no dia (tirar, adicionar, time de criação, só eu).
    const iniciais = (u) => String(u.name || u.nome || '?').trim().slice(0, 2).toUpperCase();
    const diaDeRot = `Dia de ${esc(fila.users.map((u) => (String(u.id) === euId && varios ? 'você' : nomeCurto(u))).join(', '))}`;
    const diaDe = filtroPessoas ? `<details class="v2t-dia"><summary class="v2t-chip"><i aria-hidden="true">${esc(iniciais(fila.users[0]))}</i>${diaDeRot}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary><div class="v2t-dia-pop">${filtroPessoas}</div></details>`
      : !dono && !euId ? `<button type="button" class="v2t-chip" data-pessoas-atalho="trocar"><i aria-hidden="true">${esc(iniciais(fila.user))}</i>${diaDeRot}</button>` : '';
    // Coluna direita: a agenda de hoje e o que os agentes viram, como no quadro. Abaixo deles só entra o que tem
    // pendência de verdade e não tem outro lugar na tela: WhatsApp esperando a pessoa, aprovações paradas e o aviso de prazo.
    const lado = `<aside class="v2t-lado" aria-label="Agenda e agentes">
      ${compromissosHtml() || agendaDeHojeHtml()}
      <div class="v2t-agentes">${agentesViramHtml()}<p class="v2t-pe"><button type="button" class="vg-link" data-hoje-acao="agentes">Como o VYBES montou esta ordem</button></p></div>
      ${!verComo ? (window.VybePendencias?.paraVoceHtml?.() || '') : ''}
      ${!verComo ? (window.VybeAprovacoes?.blocoHtml?.('tarefas') || '') : ''}
      ${desatualizadas.length ? `<button type="button" class="vv-alerta-prazo" data-hoje-acao="foco"><b>${desatualizadas.length} peça${desatualizadas.length > 1 ? 's' : ''} com prazo desatualizado</b><span>O prazo interno já passou, mas a veiculação ainda vem. A fila segue a veiculação; atualize o prazo.</span></button>` : ''}
    </aside>`;
    const html = `<div class="v2t"><div class="v2t-topo"><span class="v2t-ola"><small class="vv-data">${esc(data)}</small><h2>${saud}${nome ? ', <em>' + esc(nome) + '</em>' : ''}</h2></span>${segDono}${diaDe}${criarHtml}</div>
      <div class="v2t-alto">${fala}${numeros}</div>
      ${filtros}
      <div class="v2t-grade">${listaHtml()}${lado}</div></div>`;
    if (el.vvHtml !== html) {
      const atual = soListaAgora ? el.querySelector('.v2-lista') : null;
      if (atual) { const t = document.createElement('template'); t.innerHTML = html; const nova = t.content.querySelector('.v2-lista'); if (nova) atual.replaceWith(nova); else el.innerHTML = html; }
      else el.innerHTML = html;
      el.vvHtml = html;
    }
    aplicarLinhaAberta(el);
  }
  function acaoDoHoje(acao, valor) {
    const eu = typeof operadorDoTopo === 'function' ? operadorDoTopo() : null;
    if (acao === 'dia') { diaEscolhido = diaEscolhido === valor ? '' : valor; pintarHoje(); return; }
    if (acao === 'filtro') { filtroTarefas = String(valor || 'hoje'); linhaAberta = ''; listaInteira = false; pintarHoje(); return; }
    if (acao === 'decidir') { decidirPeca(String(valor)); return; }
    if (acao === 'decidir-lista') { if (window.VybeConteudo?.abrir) window.VybeConteudo.abrir({ aba: 'aprovar' }); else usarTrilho('conteudo'); return; }
    if (acao === 'lista-inteira') { listaInteira = true; soListaAgora = true; pintarHoje(); soListaAgora = false; return; }
    // A bolinha conclui (quadro B2): risca na hora e grava pelo caminho de sempre (updateFocusStatus, com os portões e o
    // Desfazer). Se o status final não existir no quadro da peça, ou o portão for cancelado, a linha volta ao que era.
    if (acao === 'concluir') {
      const item = typeof findOperationalItem === 'function' ? findOperationalItem(String(valor)) : null;
      const opcoes = item && typeof operationalStatusOptions === 'function' ? operationalStatusOptions(item) : [];
      const fim = opcoes.find((o) => /^finalizad/i.test(String(o.label || '').trim())) || opcoes.find((o) => /^(feito|conclu)/i.test(String(o.label || '').trim()));
      if (!item || !fim || typeof updateFocusStatus !== 'function') { if (typeof showToast === 'function') showToast('Não achei o status de concluída no quadro desta peça. Troque pelo status da linha.', 'info'); return; }
      const l = [...hud.querySelectorAll('#vv-hoje .v2-linha')].find((x) => x.dataset.linha === String(valor));
      l?.classList.add('feita'); l?.querySelector('.v2t-cx')?.classList.add('ok'); l?.querySelector('.v2-risca')?.classList.add('feita');
      Promise.resolve(updateFocusStatus(String(valor), fim.label)).catch(() => {}).finally(() => setTimeout(() => { const h = hud.querySelector('#vv-hoje'); if (h) h.vvHtml = ''; pintarHoje(); }, 700));
      return;
    }
    if (acao === 'linha') { linhaAberta = linhaAberta === String(valor) ? '' : String(valor); aplicarLinhaAberta(); return; }
    if (acao === 'todas' || acao === 'prioridades') { hojeVerTodas = acao === 'todas'; try { localStorage.setItem('vybe.hoje.todas', hojeVerTodas ? '1' : ''); } catch { /* sem guardar */ } pintarHoje(); return; }
    if (acao === 'peca') { chamar('openItemWorkspace', String(valor)); return; }
    if (acao === 'foco') { const alvo = verComo || eu?.id; if (alvo) chamar('chooseFocusUser', String(alvo)); return; }
    if (acao === 'demandas') { chamar('chooseManagerMode', 'demandas'); return; } // direto em Demandas, sem passar pelo Painel
    if (acao === 'agenda') { abrirAgenda(); return; }
    if (acao === 'agenda-ler') { carregarAgenda(true); return; }
    // Os agentes viram (quadro 31): a peça do achado abre na janela da peça; o resto, na fila Depende de você.
    if (acao === 'agente') { const [setor, chave] = String(valor || '').split('|'); if (!window.VybeAgentes?.abrirPeca?.(setor, chave)) usarTrilho('agentes'); return; }
    if (acao === 'agentes') { usarTrilho('agentes'); return; }
    if (acao === 'pedido_rh') { window.VybePessoas?.novoPedido?.(); return; } // Nova solicitação ao RH (vybe-mundo-pessoas.js)
    if (acao === 'missoes') { window.VybeMissoes?.abrir?.('missoes', verComo || undefined); window.VybeTutorial?.dica?.('missoes'); return; }
    if (acao === 'radar') chamar('chooseManagerMode');
  }
  // "Pergunte ao VYBES": abre o VYBES de verdade (a central) com o pedido, que ela atende ao abrir
  // (chooseVybesMode({ pedido })). Não cria outro chat.
  hud.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-trilho-resto]'); if (!b) return;
    const aberto = b.closest('.vv-trilho').classList.toggle('resto-aberto'); b.setAttribute('aria-expanded', String(aberto));
  });
  hud.addEventListener('keydown', (e) => {
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || !e.target.closest?.('#vv-hoje .v2d')) return;
    e.preventDefault(); passarDecidir(decidirEm + (e.key === 'ArrowRight' ? 1 : -1));
  });
  hud.addEventListener('click', (e) => {
    const c = e.target.closest?.('#vv-hoje .v2d-carta, #vv-hoje .v2d .v2-pontos > i'); if (!c) return;
    if (c.dataset.carta !== undefined) { if (Number(c.dataset.carta) !== decidirEm) passarDecidir(Number(c.dataset.carta)); return; }
    passarDecidir([...c.parentNode.children].indexOf(c));
  });
  hud.addEventListener('input', (e) => {
    if (!e.target.matches?.('[data-busca-tarefas]')) return;
    buscaTarefas = e.target.value; linhaAberta = ''; soListaAgora = true; pintarHoje(); soListaAgora = false;
  });
  hud.addEventListener('change', (e) => {
    const add = e.target.closest('[data-pessoa-add]');
    if (add) { if (add.value) { const base = pessoasHoje.length ? pessoasHoje : [String((typeof operadorDoTopo === 'function' ? operadorDoTopo()?.id : '') || '')].filter(Boolean); definirPessoasHoje([...base, add.value]); } return; }
    const sel = e.target.closest('[data-ver-como]'); if (!sel) return; definirVerComo(sel.value);
  });
  hud.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pessoa-tirar],[data-pessoas-atalho],[data-pessoa-dia]'); if (!b || b.disabled) return;
    if (b.dataset.pessoaDia) { definirPessoasHoje([b.dataset.pessoaDia]); return; }
    if (b.dataset.pessoasAtalho) { definirPessoasHoje(b.dataset.pessoasAtalho === 'criacao' ? timeDeCriacao() : []); return; }
    const atuais = (pessoasHoje.length ? pessoasHoje : []).filter((id) => id !== String(b.dataset.pessoaTirar));
    definirPessoasHoje(atuais);
  });
  hud.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-pergunta]'); if (!f) return;
    e.preventDefault();
    const texto = f.querySelector('input').value.trim();
    const setor = f.dataset.setor;
    chamar('chooseVybesMode', texto ? { pedido: setor ? `[${setor}] ${texto}` : texto } : undefined);
  });

  hud.innerHTML = `
    <nav class="vv-ilha vv-trilho" aria-label="Módulos do Vybe OS"><span class="vv-trilho-marca"><i aria-hidden="true">V</i><b>Vybe OS</b></span><button type="button" class="vv-trilho-recolher" data-trilho-recolher aria-label="Recolher o menu" title="Recolher o menu">${svg('<path d="M15 6l-6 6 6 6"/>')}</button>${(() => {
      let grupo = '';
      return TRILHO.map((t) => {
        if (t === '-') return '<span class="vv-trilho-espaco"></span>';
        const cab = t.grupo && t.grupo !== grupo ? `<span class="vv-trilho-grupo" data-grupo="${t.grupo}">${t.grupo}</span>` : ''; grupo = t.grupo || grupo;
        const setor = Array.isArray(t.sub);
        // Quadro da casca (moodboard, 12/11/2026): Prédio, Jogos, Loja, Ranking e Conquistas ficam atrás de um item só.
        const resto = ['predio', 'jogos', 'loja', 'ranking', 'conquistas'].includes(t.id);
        const abreResto = t.id === 'jogos' ? `<button type="button" class="vv-trilho-btn vv-trilho-resto-abre" data-trilho-resto aria-expanded="false" title="Prédio, Jogos, Loja, Ranking e Conquistas" aria-label="Prédio, Jogos, Loja, Ranking e Conquistas">${svg('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>')}<span>Prédio, Jogos, Loja…</span><i class="vv-trilho-seta" aria-hidden="true"></i></button>` : '';
        const botao = `<button type="button" class="vv-trilho-btn${t.acao ? ' criar' : ''}${resto ? ' vv-trilho-resto' : ''}" data-trilho="${t.id}" data-grupo="${t.grupo ? grupo : ''}" title="${t.dica}" aria-label="${t.dica}"${t.id === 'hoje' ? ' aria-current="page"' : ''}${setor ? ` aria-expanded="false" aria-controls="vv-sub-${t.id.slice(6)}"` : ''}>${t.ic}<span>${t.nome}</span>${setor ? '<i class="vv-trilho-seta" aria-hidden="true"></i>' : ''}${t.url ? '<i class="vv-trilho-fora" aria-hidden="true">↗</i>' : ''}${favoritavel(t) ? estrela(t.id) : ''}</button>`;
        const subs = setor ? `<div class="vv-trilho-sub" id="vv-sub-${t.id.slice(6)}" data-sub-de="${t.id}" data-grupo="${grupo}" hidden>${t.id === 'setor:gestao' || t.id === 'setor:toolkit' ? '' : `<button type="button" data-visao-setor="${t.id}">Visão geral</button>`}${t.sub.map((x) => `<button type="button" data-submodulo="${x.id}" title="${x.dica}">${x.nome}${x.url ? ' <i aria-hidden="true">↗</i>' : ''}${estrela(x.id)}</button>`).join('')}</div>` : '';
        return cab + abreResto + botao + subs + (t.id === 'hoje' ? '<div class="vv-trilho-fav" hidden></div>' : '');
      }).join('') + `<button type="button" class="vv-trilho-btn vv-so-cel" data-cel="conversas" title="Conversas: o WhatsApp da Vybe" aria-label="Conversas">${svg('<path d="M4 5h16v11H8l-4 4z"/>')}<span>Conversas</span></button>`
        // Celular (quadro 28): um dock só. A voz vira um lugar da barra de baixo; fora de uma chamada, o cartão das salas
        // (Salas e Entrar) abre por cima dela só quando se toca em Voz. Na chamada o dock das salas fica à vista (o
        // microfone ligado sempre visível e silenciar num toque) e o Voz abre a lista de salas.
        + `<button type="button" class="vv-trilho-btn vv-so-cel" data-cel="voz" aria-expanded="false" aria-controls="vv-dock-salas-faixa" title="Voz: entrar numa sala, ver quem está em cada uma" aria-label="Voz">${svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>')}<span>Voz</span><i class="vv-cel-voz-ponto" aria-hidden="true"></i></button>`
        + `<button type="button" class="vv-trilho-btn vv-so-cel" data-cel="mais" aria-haspopup="dialog" aria-expanded="false" title="Mais: ferramentas, voz e os outros módulos" aria-label="Mais">${svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>')}<span>Mais</span></button>`;
    })()}</nav>
    <section class="vv-hoje" id="vv-hoje" aria-label="Seu dia"></section>
    <div class="vv-topo">
      <div class="vv-espaco"></div>
      <div class="vv-ilha vv-barra-topo">
      <div class="vv-ferramentas" role="group" aria-label="Ferramentas">
        <!-- Cabeçalho (Paulo, 08/11/2026: "o dock de cima tá poluído, pregado por cima do sistema"): busca, a chamada num bloco,
             Agenda, WhatsApp e todos os outros à vista (Paulo, 09/11/2026: sem resumir no "Mais"), e a conta. Os botões são os mesmos de antes (data-ferr). -->
        <button type="button" class="vv-botao vv-busca-larga" data-ferr="busca" title="Buscar em todo o painel (⌘K)" aria-label="Buscar">${svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>')}<span class="vv-busca-texto">Buscar em tudo</span><kbd>⌘K</kbd></button>
        <button type="button" class="vv-botao vv-ferr-agenda" data-ferr="agenda" aria-expanded="false" aria-controls="vv-agenda" title="Agenda da Vybe: os próximos compromissos" aria-label="Agenda">${svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>')}<span class="vv-ferr-nome">Agenda</span></button>
        <button type="button" class="vv-botao" data-ferr="whatsapp" title="WhatsApp da Vybe (só leitura)" aria-label="WhatsApp da Vybe" aria-pressed="false">${svg('<path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5z"/>')}<span class="vv-badge" id="vv-badge-whatsapp" hidden></span><span class="vv-ferr-nome">WhatsApp</span></button>
        <button type="button" class="vv-botao" data-ferr="avisos" title="Avisos" aria-label="Avisos">${svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>')}<span class="vv-badge" id="vv-badge-avisos" hidden></span></button>
        <button type="button" class="vv-botao" data-ferr="conversa" title="Conversa da equipe e recados" aria-label="Conversa da equipe">${svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>')}</button>
        <details class="vv-mais-menu"><summary class="vv-botao" title="Mais: boletim, notas, camadas e ajuda" aria-label="Mais">${svg('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>')}</summary><div class="vv-mais-lista">
        <button type="button" class="vv-botao vv-ferr-boletim" data-boletim hidden title="Boletim dos agentes e do VYBES: o que cada um fez, o que está errado e o que está fazendo agora" aria-label="Boletim dos agentes">${svg('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>')}<span class="vv-ferr-nome">Boletim</span></button>
        <button type="button" class="vv-botao" data-ferr="notas" title="Suas notas" aria-label="Notas">${svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>')}<span class="vv-mais-nome">Notas</span></button>
        <button type="button" class="vv-botao" data-ferr="camadas" title="Camadas do mapa: clientes, marcos, captações e prospecção do CRM" aria-label="Camadas">${svg('<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>')}<span class="vv-mais-nome">Camadas do mapa</span></button>
        <button type="button" class="vv-botao" data-ferr="ajuda" title="Ajuda do VYBES: refazer o passeio e rever as dicas" aria-label="Ajuda do VYBES">${svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.5"/><path d="M12 16.8h.01"/>')}<span class="vv-mais-nome">Ajuda</span></button>
        </div></details>
        <button type="button" class="vv-botao" data-ferr="conta" title="Sua conta e equipe" aria-label="Conta">${svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>')}</button>
      </div>
      <span class="vv-divisor" aria-hidden="true"></span>
      <div class="vv-vistas" role="group" aria-label="Vista do mundo">
        <button type="button" class="vv-botao" data-vista="cidade" aria-pressed="true" aria-label="Cidade" title="Cidade">${ic.cidade}<span class="vv-rotulo-longo">Cidade</span></button>
        <button type="button" class="vv-botao" data-vista="predio" aria-pressed="false" aria-label="Prédio da Vybe" title="Prédio da Vybe">${ic.predio}<span class="vv-rotulo-longo">Prédio da Vybe</span></button>
      </div>
      </div>
    </div>
    <div class="vv-ilha vv-controles" role="group" aria-label="Controles do mapa">
      <span class="v2m-dica">arraste para girar · clique na loja para abrir</span>
      <button type="button" class="vv-botao" data-ctl="mais" aria-label="Aproximar">${ic.mais}</button>
      <button type="button" class="vv-botao" data-ctl="menos" aria-label="Afastar">${ic.menos}</button>
      <button type="button" class="vv-botao" data-ctl="girar" aria-label="Girar 90 graus">${ic.girar}</button>
      <button type="button" class="vv-botao" data-ctl="tudo" aria-label="Ver a cidade toda">${ic.tudo}</button>
      <button type="button" class="vv-botao" data-ctl="camadas" aria-label="Camadas do mapa" title="Camadas do mapa">${svg('<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>')}</button>
      <button type="button" class="vv-botao" data-ctl="hora" aria-label="Hora do dia no mundo" aria-expanded="false" aria-controls="vv-hora">${svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')}</button>
      <div class="vv-hora" id="vv-hora" role="group" aria-label="Hora do mundo" hidden>
        <b>Hora do mundo</b>
        <div class="vv-hora-modos">
          <button type="button" data-hora-modo="auto">Automático</button>
          <button type="button" data-hora-modo="dia">Dia</button>
          <button type="button" data-hora-modo="noite">Noite</button>
        </div>
        <label class="vv-hora-barra"><span>Escolher a hora</span><input type="range" min="0" max="23.5" step="0.5" value="12" aria-label="Hora do mundo"><output>12h</output></label>
        <small class="vv-hora-dica">Automático segue a hora real da Bahia.</small>
      </div>
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
    if (typeof innerWidth !== 'number') return; // fora do navegador (testes): nada a medir
    const celular = innerWidth <= 900;
    // À esquerda, o que estiver à vista por último: o Hoje (também no Centro) ou o trilho; à direita, o painel do
    // prédio/andar ou, sem ele, a Agenda.
    const visivelEl = (el) => el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
    const hoje = hud.querySelector('#vv-hoje');
    const gate = body.classList.contains('mundo-cartoes') ? document.querySelector('#mode-gate .identity-shell') : visivelEl(hoje) ? hoje : hud.querySelector('.vv-trilho');
    const esq = celular ? 0 : (gate?.getBoundingClientRect().right || 0) + 6;
    const agenda = hud.querySelector('#vv-agenda');
    const dir = celular ? 0 : !placa().hidden ? placa().offsetWidth + 20 : body.classList.contains('agenda-fixa') && visivelEl(agenda) ? agenda.offsetWidth + 20 : 0;
    // As medidas valem para o HUD mesmo antes do mapa montar (o topo do Centro começa depois do Hoje).
    body.style.setProperty('--vv-livre-esq', Math.round(esq) + 'px'); body.style.setProperty('--vv-livre-dir', Math.round(dir) + 'px');
    mundo?.areaLivre(esq, dir, celular ? innerHeight * .5 : 0);
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
    // Quadro: o mesmo caminho do Modo Gestor, já na aba pedida (sem desenhar o Painel de trabalho antes).
    chamar('chooseManagerMode', mod.alvo);
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
      n = [[sits.filter((x) => x !== 'concluida').length, 'em produção'], [atr, 'atrasadas', 'atrasada'], [apr, 'para aprovar']];
      sit = falhou || atr ? 'vermelho' : apr || aguardando ? 'amarelo' : 'verde';
    } else if (a.id === 'comercial') {
      const crm = crmCache || [], contato = crm.filter((o) => ['abordagem_proposta', 'aprovada', 'contato_feito', 'reuniao', 'proposta_comercial'].includes(o.etapa)).length;
      n = [[naTela.length, 'clientes ativos', 'cliente ativo'], [contato, 'em contato'], [crm.filter((o) => o.etapa === 'ganho').length, 'ganhos', 'ganho']];
      sit = falhou ? 'vermelho' : crm.some((o) => o.etapa === 'abordagem_proposta') || aguardando ? 'amarelo' : 'verde';
    } else if (a.id === 'terreo') {
      n = [[sits.filter((x) => x !== 'concluida').length, 'peças em aberto', 'peça em aberto'], [conta('hoje'), 'saem hoje', 'sai hoje'], [executando, 'agentes trabalhando', 'agente trabalhando']];
    } else if (a.tipo === 'equipe' && a.id !== 'terraco') {
      // Andar do time: quem está nele agora e quantas salas têm gente (não há agente aqui).
      const zonas = Object.entries(zonas3d()).filter(([, z]) => z.andar === a.id).map(([id]) => id);
      const aqui = presencaDoEscritorio().filter((g) => zonas.includes(g.zona));
      n = [[aqui.length, 'no andar agora'], [new Set(aqui.map((g) => g.zona)).size, 'salas com gente', 'sala com gente'], [zonas.length, 'salas', 'sala']];
      sit = 'verde';
    } else if (a.id === 'terraco') {
      const gente = presencaDoEscritorio();
      n = [[gente.length, 'online agora'], [gente.filter((g) => g.zona && g.zona !== 'recepcao').length, 'em salas'], [Object.keys(zonas3d()).length, 'salas', 'sala']];
      sit = 'verde';
    } else {
      n = [[executando, 'trabalhando'], [aguardando, 'aguardando você'], [agentes.filter((e) => e === 'disponivel').length, 'disponíveis', 'disponível']];
      if (!agentes.length || agentes.every((e) => ['sem_execucao', 'indisponivel'].includes(e))) sit = 'cinza';
    }
    // Cada número com o rótulo no singular quando é 1: [valor, vários, um] vira [valor, rótulo].
    n = n.map(([v, varios, um]) => [v, um ? rotuloDe(v, um, varios) : varios]);
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
  // Desde 09/11/2026 a central manda o estado real (ativo · sombra · pausado · desligado, core/estado-agentes.js): vale ele;
  // sem leitura, a maturidade da planta, como antes.
  const MATURIDADE = { ativo: ['Ativo', '#18A957'], sombra: ['Em sombra', '#E2A11B'], planejado: ['Planejado', '#9AA3A8'], pausado: ['Pausado', '#C2490C'], desligado: ['Desligado', '#9AA3A8'] };
  function opAndarHtml(a) {
    const ags = a.setores.filter((s) => s.agente); if (!ags.length) return '';
    const hoje = new Date().toDateString(), f = fonteAgentes?.ler(), sinal = Boolean(f?.dados && !f.erro);
    let exec = 0, ok = 0, falha = 0, curso = 0;
    const linhas = ags.map((s) => {
      const e = estadoDoAgente(s.id), ult = (e.ultimos || []), dHoje = ult.filter((u) => new Date(u.em).toDateString() === hoje);
      const c = ult.filter((u) => u.estado === 'concluida').length, fl = ult.filter((u) => u.estado === 'falhou').length;
      exec += dHoje.length; ok += c; falha += fl; curso += e.emCurso || 0;
      const taxa = c + fl ? Math.round(c / (c + fl) * 100) + '%' : '—', m = MATURIDADE[e.modo] || MATURIDADE[s.estado] || MATURIDADE.planejado;
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
    if (Object.values(zonas3d()).some((z) => z.andar === a.id) || a.setores.some((s) => s.agente))
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
    ultimaPresenca = assinatura; mundo.presenca(gente); marcarVistos(gente);
  }
  function salasDaEquipeHtml(idAndar) {
    const zonas = Object.entries(zonas3d()).filter(([, z]) => z.andar === idAndar);
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
    const Z = zonas3d(), temZona = (id) => Boolean(Z[id]);
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
  let andarAberto = null, timerAndar = null, andarAbertoId = '', geracaoAndar = 0;
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
    const zonas = Object.entries(zonas3d()).filter(([, z]) => z.andar === idAndar)
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
        <span class="andar-voz" id="andar-voz"></span>
        ${zonas.some((z) => z.dono) || minhaSala ? `<span class="andar-acoes">${zonas.some((z) => z.dono) ? '<button type="button" class="vv-botao" data-arrumar aria-pressed="false" title="Esconde a decoração das salas e mostra só a planta">Vista arrumada</button>' : ''}${minhaSala ? `<button type="button" class="vv-botao acao" data-decorar="${esc(minhaSala)}">Decorar minha sala</button>` : ''}</span>` : ''}
        <small class="andar-dica">${zonas.length ? 'Todo mundo do andar aparece aqui. Clique numa sala para entrar: a voz liga só com quem está nela.' : 'Os agentes do setor nas mesas. Clique numa mesa para ver o dia do agente.'}</small></header>`;
    body.append(el); body.classList.add('mundo-andar');
    window.VybeTutorial?.dica?.('andar');
    const m = await import(MUNDO_JS);
    if (geracao !== geracaoAndar || el.isConnected === false) return;
    andarAberto = m.abrirAndar(el.querySelector('canvas'), { zonas, titulo: a.nome, agentes: agentesDoAndar, cor: a.cor, mesasLivres });
    // A mesa de cada agente no andar abre o dia dele no painel do andar (o mesmo "Ver o dia" do Prédio).
    andarAberto.aoClicarAgente?.((setor) => mostrarAgente(a.id, setor));
    andarAberto.aoClicarMesaLivre?.(() => { fecharAndarVoxel(false); usarTrilho('agentes', hud.querySelector('[data-trilho="agentes"]')); });
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
    el.querySelector('[data-arrumar]')?.addEventListener('click', (ev) => {
      const b = ev.currentTarget, sim = b.getAttribute('aria-pressed') !== 'true';
      if (!andarAberto?.arrumada) return; // o andar ainda está montando
      andarAberto.arrumada(sim); b.setAttribute('aria-pressed', String(sim)); b.textContent = sim ? 'Ver a decoração' : 'Vista arrumada';
    });
    el.querySelector('[data-decorar]')?.addEventListener('click', (ev) => {
      // Decorar mostra a decoração de novo (a sala em edição precisa dos móveis à vista).
      const arr = el.querySelector('[data-arrumar][aria-pressed="true"]'); if (arr) arr.click(); window.VybeDecorar?.abrir?.(ev.currentTarget.dataset.decorar); window.VybeTutorial?.dica?.('decorar'); });
    const pintar = () => {
      if (!andarAberto) return;
      const voltar = el.querySelector('.andar-voltar'), semPainel = placa().hidden || !placa().querySelector('[data-sair-andar]');
      if (voltar && voltar.hidden !== !semPainel) voltar.hidden = !semPainel;
      const minha = typeof escritorio !== 'undefined' && escritorio?.conectado ? escritorio.zona : '';
      andarAberto.pessoas(manualAndar || genteDoAndar(), minha);
      // Estado de cada agente do andar: a mesma leitura da central que pinta o prédio por fora.
      const f = fonteAgentes?.ler(), conectado = Boolean(f?.dados && !f.erro);
      andarAberto.agentes?.(Object.fromEntries(agentesDoAndar.map((s) => { const e = estadoDoAgente(s.id); return [s.id, { estado: e.estado, cor: e.cor, rotulo: e.rotulo, tarefa: e.tarefa || '', conectado }]; })));
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
    if (id.startsWith('quarto:')) { fecharAndarVoxel(true); return; } // Minha sala: volta à tela de módulos; a voz fica na sala
    fecharAndarVoxel(false);
    if (id && mundo) mostrarAndar(id);
  }
  function fecharAndarVoxel(voltar) {
    geracaoAndar++; andarAbertoId = '';
    clearInterval(timerAndar); timerAndar = null;
    window.VybeDecorar?.ligarCena?.(null);
    andarAberto?.destruir(); andarAberto = null;
    document.getElementById('mundo-andar')?.remove(); body.classList.remove('mundo-andar', 'mundo-quarto');
    trocarBotaoDoAndar();
    if (voltar && typeof openModeGate === 'function' && !document.getElementById('mode-gate')?.classList.contains('open')) openModeGate();
    sincronizar();
  }
  let manualAndar = null;

  // ---------- Minha sala: o quarto do Escritório em voxel (Paulo, 09/11/2026) ----------
  // "Junto ao Prédio e ao Centro vai ter o MINHA SALA, como a gente fazia com o Habbo, pra quem quiser ficar no seu
  // quarto voxel. A chamada continua funcionando pra quem está dentro do quarto." Só lê o que o Escritório já tem: a
  // planta do quarto (escritorioAmbienteDoQuarto, com as alturas de sala_celdas), o piso e a parede do dono e a camada
  // salva da sala (escritorioItensDaCamada). Desenho em mundo/quarto.mjs; a voz é a da zona da sala, a mesma de sempre.
  function quartoDaSala(zona) {
    let a = null; try { a = fn('escritorioAmbienteDoQuarto')?.(zona) || null; } catch { /* Escritório ainda sem base */ }
    if (!a) return null;
    const dim = fn('escritorioDimQuarto')?.(a) || { w: a.x1 - a.x0, h: a.y1 - a.y0 };
    const PISO = (typeof ESCRITORIO_PLANTA !== 'undefined' && ESCRITORIO_PLANTA?.PISO) || {};
    const cores = (k) => (Array.isArray(PISO[k]) && PISO[k].length === 2 ? [...PISO[k]] : null);
    const pintados = a.pintura?.pisos instanceof Map && a.pintura.pisos.size ? a.pintura.pisos : null;
    const nivel = fn('escritorioNivelQuarto');
    let itens = []; try { itens = fn('escritorioItensDaCamada')?.(zona) || []; } catch { /* sem camada: quarto vazio */ }
    return { id: zona, nome: zonas3d()[zona]?.nome || a.nome || 'Sala', w: dim.w, h: dim.h,
      nivelEm: nivel ? (x, y) => nivel(a, x, y) : null, piso: cores(a.piso), parede: a.cor, semParedes: a.semParedes === true,
      pisoEm: pintados ? (x, y) => cores(pintados.get(x + ',' + y)) : null,
      ehDeParede: (c) => { try { return Boolean(fn('escritorioEhParede')?.(c)); } catch { return false; } }, itens };
  }
  // Tamanho de cada móvel pelo arquivo do Habbo (o mesmo que o mapa do Escritório carrega); sem ele, a caixa da peça voxel.
  // Só pede a arte de quem a tem no repositório (m.temArteLocal, redesign r5): as outras saem na medida do tipo.
  async function medidasDoHabbo(itens, m = null) {
    const carregar = fn('mapaCarregarMovel'); if (!carregar) return [];
    const classes = [...new Set((itens || []).map((it) => it?.[0]).filter((c) => /^[a-z0-9_]{1,64}$/i.test(String(c || '')) && !/^vybeimg_/.test(c) && (!m?.temArteLocal || m.temArteLocal(c))))];
    const lista = await Promise.all(classes.map(async (c) => {
      try { const { dados } = await carregar(c); const d = dados?.logic?.model?.dimensions; return d ? [c, { x: d.x, y: d.y }] : null; } catch { return null; }
    }));
    return lista.filter(Boolean);
  }
  // ---------- Dock das salas (Paulo, 09/11/2026: "pega esse dock novo central inferior e melhora ele pra ser o dock das
  // salas, chat, música, e traz aqueles controles e a entrada de chamada pra ele, fixo; o dock de cima fica livre pra agenda,
  // WhatsApp, alertas, conversas, recados, notas, aparência, ajuda e perfil"; "com a opção Minha sala e Sala atual, pra
  // entrar literalmente na sala da pessoa, não só no chat de voz"). Fixo embaixo, em toda tela do mundo:
  //   Voltar (só dentro de uma sala) | microfone ou Entrar | Minha sala e Sala atual (ver a sala) | as salas com gente
  //   (trocar só a voz, com quem está e quem está mudo) | Salas (todas) | Chat | Música | Sair da chamada.
  // cabem: quantas salas com gente cabem na largura agora; as outras vão para "+N salas", sem cortar nada.
  function dockSalasHtml(cabem = Infinity) {
    const e = typeof escritorio !== 'undefined' ? escritorio : null; if (!e) return '';
    const Z = zonas3d(), eu = String(e.base?.eu || ''), minha = minhaSalaDaConta();
    const zonaAberta = String(andarAbertoId || '').startsWith('quarto:') ? andarAbertoId.slice(7) : '';
    const nome = (z) => { let n = Z[z]?.nome; if (!n) { try { n = fn('escritorioAmbienteDoQuarto')?.(z)?.nome; } catch { n = ''; } } return n || 'Sala'; };
    const curto = (z) => { const c = nome(z).replace(/^Sala d[aoe]s? /i, ''); return c.charAt(0).toUpperCase() + c.slice(1); };
    const por = new Map(); for (const o of e.online || []) { if (!o.zona) continue; if (!por.has(o.zona)) por.set(o.zona, []); por.get(o.zona).push(o); }
    const falando = fn('escritorioPessoasFalando')?.() || new Set(), mics = microfonesNaChamada(e);
    const canal = e.conectado ? fn('escritorioCanal')?.(e.zona) : null;
    const naChamada = Boolean(!e.vozPausada && e.conectado && canal && e.chamada && e.canalChamada === canal), mic = Boolean(e.chamada?.self?.audioEnabled);
    // Celular fora de uma sala (fase 3d, quadro 47): o dock vira um cartão "Fora das salas" com Salas e Entrar, sem cortar
    // o último botão. O resto do dock (áudio, ouvir, música, TV) vai para o "Mais" da barra de baixo, pelos mesmos botões.
    if (typeof noCelular === 'function' && noCelular() && !zonaAberta && !naChamada && !e.entrandoChamada) {
      const n = (e.online || []).length, comGente = por.size;
      const extra = (acao, nome, icone, titulo, desligado = false) => `<button type="button" data-dock="${acao}" data-dock-extra data-nome="${esc(nome)}" title="${esc(titulo)}" hidden${desligado ? ' disabled' : ''}>${icone}</button>`;
      return `<div class="vq-cartao" role="group" aria-label="Voz das salas">
        <span class="vq-cartao-ic" aria-hidden="true">${IC.mic}</span>
        <span class="vq-cartao-txt"><b>Fora das salas</b><small>${n ? `${n} ${n === 1 ? 'pessoa' : 'pessoas'} online${comGente ? ` · ${comGente} ${comGente === 1 ? 'sala' : 'salas'} com gente` : ''}` : 'Ninguém nas salas agora'}</small></span>
        <button type="button" class="vc-sec vq-cartao-salas" data-dock="salas" title="Todas as salas de voz: quem está em cada uma">Salas</button>
        ${e.conectando ? '<button type="button" class="vc-acao" disabled>Conectando…</button>' : '<button type="button" class="vc-acao" data-dock="entrar" title="Entrar na chamada da sala (você entra mudo)">Entrar</button>'}
        ${extra('audio', 'Ajustes de áudio', IC.ajustes, 'Ajustes de áudio: microfone, saída, ruído e teste')}${extra('ouvir', surdo ? 'Voltar a ouvir' : 'Silenciar as vozes', surdo ? IC.semSom : IC.som, 'Silenciar as vozes só para você')}${extra('musica', 'Música da sala', IC.musica, 'Música da sala: só nas salas com aparelho de som (o Lounge tem)')}${extra('tv', 'TV da sala', IC.tv, 'TV da sala', !e.zona)}
      </div>`;
    }
    const ini = (n) => String(n || '?').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
    const botao = ({ acao, cls = '', icone, rot, titulo, extra = '' }) => `<button type="button" class="vq-item ${cls}" data-dock="${acao}" title="${esc(titulo)}" aria-label="${esc(titulo)}" ${extra}><span class="vq-icone">${icone}</span><span class="vq-rotulo">${rot}</span><i class="vq-ponto" aria-hidden="true"></i></button>`;
    const sep = '<span class="vq-sep" aria-hidden="true"></span>';
    const partes = [];
    if (zonaAberta) partes.push(botao({ acao: 'voltar', cls: 'vq-voltar', icone: svg('<path d="M15 6l-6 6 6 6"/>'), rot: 'Voltar', titulo: 'Sair da sala e voltar ao painel' }) + sep);
    // Quadro da barra de baixo (moodboard, 12/11/2026): a peça da voz diz a sala, quantos estão na voz e traz o Entrar;
    // o microfone fica sempre no lugar (apagado fora da chamada).
    const aqui = por.get(e.zona) || [], naVoz = aqui.length;
    const rostosVoz = aqui.slice(0, 3).map((o) => `<i class="${falando.has(String(o.id)) ? 'fala' : ''}">${esc(String(o.id) === eu ? 'Eu' : ini(o.nome))}</i>`).join('');
    partes.push(`<span class="vq-voz"><span class="vq-rostos" aria-hidden="true">${rostosVoz}</span><span>${esc(e.zona ? nome(e.zona) : 'Fora das salas')}${e.zona ? ` · ${naVoz ? n0(naVoz) + ' na voz' : 'vazia'}` : ''}</span>${naChamada ? '<button type="button" class="dentro" disabled>Dentro</button>' : e.conectando ? '<button type="button" disabled>Conectando…</button>' : '<button type="button" data-dock="entrar" title="Entrar na chamada da sala (você entra mudo)">Entrar</button>'}</span>` + sep);
    partes.push(botao({ acao: 'mic', cls: mic ? 'vq-mic on' : naChamada ? 'vq-mic mudo' : 'vq-mic', icone: mic ? IC.mic : IC.micOff, rot: naChamada && !mic ? 'Mudo' : 'Microfone', titulo: naChamada ? (mic ? 'Microfone ligado: clique para silenciar' : 'Você está mudo: ninguém te ouve. Clique para falar') : 'Liga dentro de uma sala', extra: `aria-pressed="${mic}" ${naChamada ? '' : 'disabled'}` }));
    // Os controles da chamada, todos no dock: ouvir (silenciar todas as vozes só para você), câmera, tela e os ajustes de áudio.
    const cam = Boolean(e.chamada?.self?.videoEnabled), telaOn = Boolean(e.chamada?.self?.screenShareEnabled);
    partes.push(botao({ acao: 'ouvir', cls: surdo ? 'vq-surdo' : '', icone: surdo ? IC.semSom : IC.som, rot: surdo ? 'Sem som' : 'Ouvir', titulo: surdo ? 'Você não está ouvindo ninguém: clique para voltar a ouvir' : 'Silenciar as vozes só para você', extra: `aria-pressed="${surdo}"` }));
    partes.push(botao({ acao: 'camera', cls: cam ? 'vq-ligado' : '', icone: IC.camera, rot: 'Câmera', titulo: cam ? 'Desligar a câmera' : naChamada ? 'Ligar a câmera' : 'Entre numa sala com voz para usar a câmera', extra: `aria-pressed="${cam}" ${naChamada || cam ? '' : 'disabled'}` }));
    partes.push(botao({ acao: 'tela', cls: telaOn ? 'vq-ligado' : '', icone: IC.tela, rot: 'Tela', titulo: telaOn ? 'Parar de mostrar a tela' : naChamada ? 'Mostrar minha tela para a sala' : 'Entre numa sala com voz para mostrar a tela', extra: `aria-pressed="${telaOn}" ${naChamada || telaOn ? '' : 'disabled'}` }));
    partes.push(botao({ acao: 'audio', icone: IC.ajustes, rot: 'Áudio', titulo: 'Ajustes de áudio: microfone, saída, ruído e teste' }));
    partes.push(sep);
    // Ver a sala: a minha e a que estou na voz (quando é a sala de alguém).
    const casa = svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>');
    partes.push(botao({ acao: 'ver-minha', cls: `minha${zonaAberta && zonaAberta === minha ? ' aberta' : ''}`, icone: casa, rot: 'Minha sala', titulo: minha ? 'Ver a minha sala (e entrar na voz dela)' : 'Você ainda não tem uma sala no Escritório', extra: minha ? '' : 'disabled' }));
    // Decorar (Paulo, 09/11/2026: "mudar os móveis de lugar, comprar móveis, editar o quarto, como tinha no legado"): só na
    // sala aberta que é sua (a mesma regra do servidor). Abre o painel de decorar sobre o quarto voxel.
    const decorar = typeof window !== 'undefined' ? window.VybeDecorar : null;
    if (zonaAberta && decorar?.podeDecorar?.(zonaAberta)) {
      const decorando = Boolean(decorar.aberto?.());
      partes.push(botao({ acao: 'decorar', cls: decorando ? 'aberta' : '', icone: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'), rot: 'Decorar', titulo: decorando ? 'Fechar o modo decorar' : 'Decorar: mudar móveis de lugar, girar, guardar, pôr do inventário e comprar na Loja', extra: `aria-pressed="${decorando}"` }));
    }
    if (e.conectado && e.zona && e.zona !== minha) {
      const temQuarto = Boolean(quartoDaSala(e.zona));
      partes.push(botao({ acao: 'ver-atual', cls: `vq-atual${zonaAberta === e.zona ? ' aberta' : ''}`, icone: svg('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'), rot: 'Sala atual', titulo: temQuarto ? `Entrar e ver ${nome(e.zona)}` : `${nome(e.zona)} ainda não tem a sala em voxel: só a voz`, extra: temQuarto ? '' : 'disabled' }));
    }
    // As salas com gente (trocar só a voz), da que tem mais gente para a que tem menos.
    const zonas = [...por.keys()].sort((a, b) => por.get(b).length - por.get(a).length);
    const item = (z) => {
      const gente = por.get(z) || [], voce = e.conectado && e.zona === z;
      const rostos = gente.slice(0, 3).map((o) => { const id = String(o.id), mudo = mics.get(id) === false; return `<i class="${falando.has(id) ? 'fala' : ''}${id === eu ? ' eu' : ''}${mudo ? ' mudo' : ''}">${esc(id === eu ? 'Eu' : ini(o.nome))}</i>`; }).join('');
      const mudos = gente.filter((o) => mics.get(String(o.id)) === false).map((o) => String(o.id) === eu ? 'você' : String(o.nome || '').split(' ')[0]);
      return `<button type="button" class="vq-item${voce ? ' voz' : ''}" data-vq-sala="${esc(z)}" title="${esc(nome(z))} · ${esc(gente.map((o) => o.nome).join(', '))}${mudos.length ? ' · mudo: ' + esc(mudos.join(', ')) : ''}${voce ? ' · você está na voz desta sala' : ' · clique para entrar na voz'}">
        <span class="vq-icone"><span class="vq-rostos n${Math.min(3, gente.length)}">${rostos}</span><b class="vq-conta">${gente.length}</b></span>
        <span class="vq-rotulo">${esc(curto(z))}</span><i class="vq-ponto" aria-hidden="true"></i></button>`;
    };
    const vistas = zonas.slice(0, Math.max(0, cabem)), fora = zonas.length - vistas.length;
    // As salas com gente saíram do dock (quadro): trocar de sala é no painel Salas, que mostra todas.
    partes.push(sep + botao({ acao: 'salas', cls: 'vq-todas' + (body.classList.contains('ver-voz') ? ' aberta' : ''), icone: svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>') + `<b class="vq-conta on">${(e.online || []).length}</b>`, rot: 'Salas', titulo: 'Todas as salas de voz: quem está em cada uma, entrar, ir até alguém ou chamar' }));
    partes.push(botao({ acao: 'chat', cls: window.VybeConversa?.aberto?.() ? 'aberta' : '', icone: svg('<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>'), rot: 'Chat', titulo: 'Conversa da equipe e recados' }));
    const temSom = Boolean(fn('escritorioNaPista')?.());
    partes.push(botao({ acao: 'musica', cls: body.classList.contains('musica-aberta') ? 'aberta' : '', icone: IC.musica, rot: 'Música', titulo: temSom ? 'Música da sala (todos ouvem junto)' : 'Música da sala: só nas salas com aparelho de som (o Lounge tem)' }));
    partes.push(botao({ acao: 'tv', icone: IC.tv, rot: 'TV', titulo: 'TV da sala: passar um vídeo do YouTube para quem está nela', extra: e.zona ? '' : 'disabled' }));
    // Sem "Sair da chamada" (Paulo, 10/11/2026: "não tem como não estar em nenhuma sala"): quem não quer falar fica mudo.
    return partes.join('');
  }
  // Ouvir (Paulo, 09/11/2026: "o de mutar o que ouve"): silencia as vozes de todos só para você, enquanto a aba estiver
  // aberta. Passa pelo volume por pessoa do Escritório (o mesmo do "silenciar fulano"), sem outra regra de som.
  let surdo = (() => { try { return sessionStorage.getItem('vybe.voz.surdo') === '1'; } catch { return false; } })();
  function prenderSurdo() {
    const orig = window.escritorioVolumePessoa;
    if (typeof orig !== 'function' || orig.vvSurdo) return;
    const novo = function (...a) { const v = orig.apply(this, a) || {}; return surdo ? { ...v, mudo: true } : v; };
    novo.vvSurdo = true; window.escritorioVolumePessoa = novo;
  }
  function alternarSurdo() {
    surdo = !surdo; prenderSurdo();
    try { sessionStorage.setItem('vybe.voz.surdo', surdo ? '1' : ''); } catch { /* vale até recarregar */ }
    fn('aplicarVolumesEscritorio')?.(); pintarDock();
  }
  // Quem está mudo na chamada (a conversa dos espaços abertos é uma só): id → microfone ligado ou não.
  function microfonesNaChamada(e) {
    const m = new Map(); if (!e?.chamada) return m;
    try { for (const p of fn('escritorioOutrosNaChamada')?.(e.chamada) || []) m.set(String(p.customParticipantId || '').split(':')[0], Boolean(p.audioEnabled)); } catch { /* sem a lista ainda */ }
    if (e.base?.eu != null) m.set(String(e.base.eu), Boolean(e.chamada.self?.audioEnabled));
    return m;
  }
  const faixaDock = document.createElement('div'); faixaDock.className = 'vv-dock-salas-faixa'; faixaDock.id = 'vv-dock-salas-faixa'; faixaDock.hidden = true;
  faixaDock.innerHTML = '<nav class="vq-dock vv-dock-salas" aria-label="Salas: voz, ver a sala, quem está em cada uma, chat e música"></nav>';
  document.body.append?.(faixaDock);
  // pintarDock roda a cada 1,5 s (pintarChamada). Ler a largura do dock e a posição dele obrigava o navegador a montar a
  // página inteira na hora, e no meio da entrada de uma janela isso engasgava a animação (quinta rodada, 11/11/2026).
  // Agora ele só mede quando algo que muda a medida mudou: o tamanho da tela, o dock à vista, o conteúdo do dock ou o
  // jeito dele no celular. O resto do tempo usa a última medida.
  const medidaDock = { tela: '', cabem: 0, chave: '' };
  function pintarDock() {
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    if (surdo) prenderSurdo();
    const ver = Boolean(e) && ligado && !body.classList.contains('auth-pending') && !body.classList.contains('mundo-lobby');
    if (faixaDock.hidden === ver) faixaDock.hidden = !ver;
    body.classList.toggle('com-dock-salas', ver);
    if (!ver) { body.style.removeProperty?.('--vv-dock-alto'); medidaDock.tela = ''; medidaDock.chave = ''; return; }
    const nav = faixaDock.firstElementChild, passo = 56, tela = `${innerWidth}x${innerHeight}|${body.classList.contains('trilho-largo')}|${body.classList.contains('mundo-quarto')}`;
    if (medidaDock.tela !== tela) { medidaDock.tela = tela; medidaDock.cabem = Math.floor((faixaDock.clientWidth - 20 - 12 * passo - 4 * 9) / passo); }
    const cabem = medidaDock.cabem;
    const html = dockSalasHtml(cabem);
    if (nav.dataset.html !== html) { nav.innerHTML = html; nav.dataset.html = html; }
    // Celular: dentro de uma sala o dock toma o lugar da barra de baixo; fora, o cartão. Na tela estreita (dock em cima
    // da barra de baixo) --vv-dock-alto vira a distância de verdade do pé da tela ao topo do dock, menos a margem: o que
    // termina "acima do dock" (Hoje, janelas, coluna da Conversa, Notas, avisos) usa a mesma conta do computador.
    const cel = noCelular();
    body.classList.toggle('dock-cartao', cel && Boolean(nav.querySelector('.vq-cartao')));
    // O Voz da barra de baixo (quadro 28): sem o cartão (numa chamada ou fora do celular), o cartão aberto pelo Voz fecha;
    // na chamada o Voz ganha o ponto verde, e o dock da chamada continua à vista.
    if (!body.classList.contains('dock-cartao') && body.classList.contains('cel-voz-aberta')) { body.classList.remove('cel-voz-aberta'); hud.querySelector('[data-cel="voz"]')?.setAttribute('aria-expanded', 'false'); }
    hud.querySelector('[data-cel="voz"]')?.classList.toggle('na-chamada', cel && !nav.querySelector('.vq-cartao'));
    body.classList.toggle('cel-na-sala', cel && String(andarAbertoId || '').startsWith('quarto:'));
    const estreita = typeof matchMedia === 'function' && matchMedia('(max-width:900px)').matches;
    const chave = [tela, estreita, html, ...['dock-cartao', 'cel-na-sala', 'cel-voz-aberta'].map((c) => body.classList.contains(c))].join('|');
    if (chave === medidaDock.chave) return;
    medidaDock.chave = chave;
    const margem = parseFloat(getComputedStyle(body).getPropertyValue('--vv-m')) || 12, topo = nav.getBoundingClientRect?.().top || 0;
    const alto = estreita && topo > 0 ? Math.ceil(innerHeight - topo - margem) : 0;
    if (alto) { if (body.style.getPropertyValue?.('--vv-dock-alto') !== alto + 'px') body.style.setProperty?.('--vv-dock-alto', alto + 'px'); }
    else if (body.style.getPropertyValue?.('--vv-dock-alto')) body.style.removeProperty?.('--vv-dock-alto');
  }
  if (typeof addEventListener === 'function') { let quadro = 0; addEventListener('resize', () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(pintarDock); }); }
  faixaDock.addEventListener?.('click', (ev) => {
    const b = ev.target.closest('button'); if (!b || b.disabled) return;
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    const a = b.dataset.dock;
    if (b.dataset.vqSala) { irParaSala(b.dataset.vqSala); return; }
    if (a === 'voltar') { sairDoAndar(); return; }
    if (a === 'mic') { fn('alternarMidiaEscritorio')?.('audio')?.finally?.(pintarChamada); return; }
    if (a === 'entrar') { entrarPeloTopo(); return; }
    if (a === 'ouvir') { alternarSurdo(); return; }
    if (a === 'camera') { fn('alternarMidiaEscritorio')?.('video')?.finally?.(pintarChamada); return; }
    if (a === 'tela') { fn('alternarMidiaEscritorio')?.('screen')?.finally?.(() => { pintarChamada(); trazerProPalco(); }); return; }
    if (a === 'audio') { if (fn('alternarPainelSomEscritorio')) fn('alternarPainelSomEscritorio')('audio'); else abrirAjustesAudio(); return; }
    if (a === 'tv') { if (fn('alternarPainelSomEscritorio')) fn('alternarPainelSomEscritorio')('tv'); else fn('abrirTvEscritorio')?.(e?.tvAtual || null); return; }
    if (a === 'ver-minha') { const m = minhaSalaDaConta(); if (m) abrirMinhaSala(m); return; }
    if (a === 'decorar') { alternarDecorar(); return; }
    if (a === 'ver-atual') { if (e?.zona) abrirMinhaSala(e.zona); return; }
    if (a === 'salas') { abrirDaDireita(body.classList.contains('ver-voz') ? '' : 'voz'); return; }
    if (a === 'chat') { window.VybeConversa?.abrir?.('conversa'); return; }
    // Música (Paulo, 09/11/2026: "não era pra abrir nosso player e tocar pra quem está na sala?"): com música na fila,
    // abre o player da sala; com a fila vazia, a janela de pôr um link (a do Escritório: quem está na sala ouve junto, e ela
    // mesma avisa se a sala não tem aparelho de som).
    if (a === 'musica') {
      const pl = document.getElementById('office-musica');
      if (body.classList.contains('musica-aberta')) abrirMusica(false);
      else if (pl && !pl.hidden) abrirMusica(true);
      // Fora de uma sala com som, um caminho em vez de só o aviso (fase 3b, quadro 44): ir para o Lounge, que tem som.
      // Fora do escritório também (frente topo, quadro 44): o mesmo aviso, com "Entrar no Lounge".
      else if (typeof escritorio !== 'undefined' && (!escritorio.conectado || (typeof escritorioNaPista === 'function' && !escritorioNaPista()))) musicaForaDaSala(b);
      else fn('abrirMusicaEscritorio')?.();
      pintarDock(); return;
    }
    if (a === 'sair') { fn('sairChamadaEscritorio')?.({ manual: true })?.finally?.(pintarChamada); }
  });
  // Decorar a sala aberta (o dock e a faixa da sala usam o mesmo): abre ou fecha o VybeDecorar sobre o quarto voxel.
  function alternarDecorar() {
    const D = window.VybeDecorar, z = String(andarAbertoId || '').startsWith('quarto:') ? andarAbertoId.slice(7) : '';
    if (!D || !z) return;
    if (D.aberto?.()) { Promise.resolve(D.fechar?.()).finally(pintarDock); return; }
    import(MUNDO_JS).then((m) => { D.ligarCena?.(andarAberto, m); return D.abrir?.(z); }).catch(() => {}).finally(pintarDock);
  }
  // Faixa da sala, acima do quarto (quadro 34): de quem é a sala, quem está nela (você primeiro), a voz dita em texto e,
  // à direita, Convidar (o convite do Escritório, só na sua sala, como no servidor) e Decorar (VybeDecorar, quem pode).
  function pintarCabDaSala(el, zona, quarto) {
    const cab = el?.querySelector?.('.quarto-cab'); if (!cab) return;
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    const minha = minhaSalaDaConta(), eu = String(e?.base?.eu || '');
    const nomeDe = (z) => { let n = quarto && z === zona ? quarto.nome : zonas3d()[z]?.nome; if (!n) { try { n = fn('escritorioAmbienteDoQuarto')?.(z)?.nome; } catch { n = ''; } } return n || 'outra sala'; };
    const gente = (e?.online || []).filter((o) => o.zona === zona).map((o) => ({ id: String(o.id), nome: o.nome || '' }));
    if (e?.conectado && e.zona === zona && eu && !gente.some((o) => o.id === eu)) gente.push({ id: eu, nome: 'Você' });
    gente.sort((a, b) => (b.id === eu) - (a.id === eu));
    const nomes = gente.map((o) => (o.id === eu ? 'você' : String(o.nome).split(' ')[0] || 'alguém'));
    const quem = !nomes.length ? 'ninguém na sala agora' : nomes.length === 1 ? (nomes[0] === 'você' ? 'só você' : nomes[0])
      : nomes.length <= 3 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`;
    const canal = e?.conectado ? fn('escritorioCanal')?.(e.zona) : null;
    const naChamada = Boolean(!e?.vozPausada && e?.conectado && canal && e.chamada && e.canalChamada === canal), mic = Boolean(e?.chamada?.self?.audioEnabled);
    const minus = (s) => s.charAt(0).toLowerCase() + s.slice(1);
    const voz = !e?.conectado ? (e?.conectando ? 'conectando à voz…' : 'voz desligada: entre pelo microfone do dock')
      : e.zona !== zona ? `sua voz está em ${nomeDe(e.zona)}`
      : naChamada ? (mic ? 'voz ligada, microfone aberto' : 'voz ligada, você está mudo')
      : minus(String(fn('escritorioEstadoVozTexto')?.() || 'sem voz aqui'));
    const falando = fn('escritorioPessoasFalando')?.() || new Set();
    const ini = (n) => String(n || '?').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
    const rostos = gente.slice(0, 4).map((o) => `<i class="${o.id === eu ? 'eu' : ''}${falando.has(o.id) ? ' fala' : ''}" title="${esc(o.id === eu ? 'Você' : o.nome)}${falando.has(o.id) ? ' (falando)' : ''}">${esc(o.id === eu ? 'Eu' : ini(o.nome))}</i>`).join('') + (gente.length > 4 ? `<i class="mais">+${gente.length - 4}</i>` : '');
    const D = window.VybeDecorar, decorar = Boolean(D?.podeDecorar?.(zona)), decorando = decorar && Boolean(D.aberto?.());
    const convidar = zona && zona === minha && typeof window.convidarParaMinhaSalaEscritorio === 'function';
    // Quadro "Minha sala" (moodboard, 12/11/2026): título, de quem é a sala e a voz numa linha, os rostos, Convidar,
    // Usar/Decorar em pílula e "Salvar a sala" (acende quando a decoração tem mudança sem salvar).
    const ed = decorando ? D.estado?.() || {} : {}, podeSalvar = decorando && ed.mudou && !ed.salvando;
    const html = `<span class="quarto-cab-nome"><small>${zona && zona === minha ? 'Minha sala' : 'Visitando'}</small><b>${esc(nomeDe(zona))}</b></span>
      <span class="quarto-quem" title="${esc(nomes.length ? gente.map((o) => (o.id === eu ? 'Você' : o.nome)).join(', ') : 'Ninguém na sala agora')} · ${esc(voz)}"><b>${esc(quem.charAt(0).toUpperCase() + quem.slice(1))}</b><small>${esc(voz.charAt(0).toUpperCase() + voz.slice(1))}</small></span>
      ${rostos ? `<span class="quarto-rostos" aria-hidden="true">${rostos}</span>` : ''}
      ${convidar || decorar ? `<span class="quarto-acoes">${convidar ? `<button type="button" class="v2n-btn" data-quarto-acao="convidar" title="Mande um link para alguém de fora entrar na sua sala (vale 12 horas)"><span>Convidar</span></button>` : ''}${decorar ? `<span class="v2n-seg" role="group" aria-label="Usar ou decorar a sala"><button type="button" data-quarto-acao="usar" aria-pressed="${!decorando}">Usar</button><button type="button" data-quarto-acao="decorar" aria-pressed="${decorando}" title="Decorar: mudar móveis de lugar, girar, guardar, pôr do inventário e comprar na Loja">Decorar</button></span>
        <button type="button" class="v2n-btn p" data-quarto-acao="salvar"${podeSalvar ? '' : ' disabled'} title="${decorando ? (ed.salvando ? 'Salvando…' : ed.mudou ? 'Salvar a decoração' : 'Nada para salvar') : 'Entre em Decorar para mudar a sala'}">${ed.salvando ? 'Salvando…' : 'Salvar a sala'}</button>` : ''}</span>` : ''}`;
    if (cab.vvHtml !== html) { cab.innerHTML = html; cab.vvHtml = html; }
  }
  async function abrirMinhaSala(zona = minhaSalaDaConta()) {
    if (andarAberto && zona && andarAbertoId === 'quarto:' + zona) return; // já está nela
    fecharAndarVoxel(false);
    const geracao = geracaoAndar;
    marcarTrilho('minha-sala');
    const el = document.createElement('section'); el.id = 'mundo-andar'; el.className = 'quarto';
    // Paulo, 09/11/2026: "esse cartão não tem sentido nenhum... voltar devia ser algo mais premium, no dock de baixo... estilo
    // um dock mesmo". Nada por cima do quarto: o Voltar é o primeiro ícone do dock e as salas vêm ao lado dele.
    // Quadro 34 do redesign (10/11/2026): o nome da sala, quem está nela e a voz em texto, com Convidar e Decorar à vista,
    // numa faixa ACIMA do quarto (não por cima dele). Pintada por pintarCabDaSala a cada leitura de presença.
    el.innerHTML = `<div class="vv-ilha quarto-cab" role="group" aria-label="A sala: quem está nela e a voz"></div><div class="andar-palco"><canvas aria-label="Sala em voxel: arraste para mover a vista, use a roda para aproximar e ande clicando no piso ou com WASD" title="Arraste para mover a vista, use a roda para aproximar e ande clicando no piso ou com WASD"></canvas><div class="quarto-estado"></div></div>`;
    body.append(el); body.classList.add('mundo-andar', 'mundo-quarto');
    pintarHoje(); // a Agenda entra no Hoje enquanto a sala está aberta
    el.querySelector('.quarto-cab').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-quarto-acao]'); if (!b || b.disabled) return;
      const D = window.VybeDecorar, decorando = Boolean(D?.aberto?.());
      if (b.dataset.quartoAcao === 'decorar') { if (!decorando) alternarDecorar(); }
      else if (b.dataset.quartoAcao === 'usar') { if (decorando) alternarDecorar(); }
      else if (b.dataset.quartoAcao === 'salvar') Promise.resolve(D?.salvar?.()).finally(() => pintarCabDaSala(el, zona, null));
      else if (b.dataset.quartoAcao === 'convidar') fn('convidarParaMinhaSalaEscritorio')?.();
    });
    pintarCabDaSala(el, zona, null);
    const estado = el.querySelector('.quarto-estado');
    const mostrarEstado = (tipo, texto) => {
      estado.hidden = !tipo;
      estado.innerHTML = !tipo ? '' : tipo === 'erro'
        ? `<div class="vv-ilha quarto-aviso" role="alert"><b>Não deu para abrir a sala</b><p>${esc(texto)}</p><button type="button" class="vv-botao acao" data-quarto-tentar>Tentar de novo</button></div>`
        : `<div class="vv-ilha quarto-aviso carregando" role="status"><i class="quarto-brilho" aria-hidden="true"></i><p>${esc(texto)}</p></div>`;
      estado.querySelector('[data-quarto-tentar]')?.addEventListener('click', () => abrirMinhaSala());
    };
    mostrarEstado('carregando', 'Montando a sua sala…');
    andarAbertoId = 'quarto:' + (zona || '?');
    sincronizar();
    // Sem o Escritório carregado ainda (abriu o painel agora, ou no celular): pede a entrada dele, que também liga a
    // voz (a mesma conexão da barra de salas), e espera a base chegar, até 20 s.
    const esc0 = typeof escritorio !== 'undefined' ? escritorio : null;
    if (esc0 && !esc0.base && !esc0.conectando && !esc0.conectado) { if (esc0.microfoneQuer === undefined) esc0.microfoneQuer = false; pintarChamada.tentou = true; fn('conectarEscritorio')?.(); }
    for (let i = 0; i < 40 && geracao === geracaoAndar && !(zona && quartoDaSala(zona)); i++) {
      await new Promise((r) => setTimeout(r, 500)); if (!zona) zona = minhaSalaDaConta();
    }
    if (geracao !== geracaoAndar || !el.isConnected) return;
    const quarto = zona && quartoDaSala(zona);
    if (!quarto) {
      const semBase = !(typeof escritorio !== 'undefined' && escritorio?.base);
      mostrarEstado('erro', semBase || zona ? 'O Escritório não respondeu e o seu quarto não carregou. Confira a conexão.' : 'Você ainda não tem uma sala no Escritório. Peça a quem administra para vincular uma sala a você.');
      return;
    }
    andarAbertoId = 'quarto:' + zona;
    el.querySelector('canvas').setAttribute('aria-label', (zona === minhaSalaDaConta() ? 'Minha sala: ' : 'Visitando: ') + quarto.nome + '. Arraste para mover a vista, use a roda para aproximar e ande clicando no piso ou com WASD');
    // Abrir a sala é entrar nela: a pessoa vai para a zona da própria sala e para a chamada dela (mudo, como sempre).
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    // Só com o Escritório conectado: sem conexão, irParaSala cai em irParaSalaEscritorio, que troca de quadro (e
    // quebrava sem perfil). Ao conectar, pintarChamada leva a pessoa à própria sala.
    if (e?.conectado && e.mapa && e.zona !== zona) irParaSala(zona);
    let m; try { m = await import(MUNDO_JS); } catch (err) { console.error('[mundo] minha sala', err); mostrarEstado('erro', 'Não deu para carregar o 3D. Confira a conexão.'); return; }
    if (geracao !== geracaoAndar || !el.isConnected) return;
    andarAberto = m.abrirQuarto(el.querySelector('canvas'), { quarto });
    window.VybeDecorar?.ligarCena?.(andarAberto, m); // o painel de decorar edita este quarto
    mostrarEstado('', '');
    andarAberto.aoClicarPiso((x, y) => {
      const naSala = typeof escritorio !== 'undefined' && escritorio?.conectado && escritorio.zona === zona && escritorio.mapa;
      if (naSala && typeof escritorioIrPara === 'function') escritorioIrPara(x, y); else if (typeof escritorio !== 'undefined' && escritorio?.conectado) irParaSala(zona);
    });
    medidasDoHabbo(quarto.itens, m).then((l) => { if (l.length && geracao === geracaoAndar) andarAberto?.medidas?.(l); });
    let assinItens = JSON.stringify(quarto.itens);
    const pintar = () => {
      if (!andarAberto?.aoClicarPiso) return;
      const minha = typeof escritorio !== 'undefined' && escritorio?.conectado ? escritorio.zona : '';
      andarAberto.pessoas(genteDoAndar(), minha);
      pintarCabDaSala(el, zona, quarto);
      // A decoração mudou no Escritório (salvou pelo editor): o quarto acompanha.
      let itens = null; try { itens = fn('escritorioItensDaCamada')?.(zona) || []; } catch { /* segue com o que tem */ }
      const a = itens && JSON.stringify(itens); if (itens && a !== assinItens) { assinItens = a; quarto.itens = itens; andarAberto.itens(itens); }
    };
    pintar(); timerAndar = setInterval(pintar, 400);
    sincronizar(); pintarDock();
  }

  // ---------- Agenda (a mesma das Captações: /api/painel?area=captacoes, só leitura) ----------
  const TIPO_COR = { captacao: '#0E9A45', reuniao: '#1A8FA0', outro: '#6B7A72' };
  const TIPO_NOME = { captacao: 'Captação', reuniao: 'Reunião', outro: 'Compromisso' };
  let agendaEm = 0, agendaEventos = null, agendaErro = '';
  async function carregarAgenda(forcar = false) {
    const fixa = agendaFixa();
    if (body.classList.contains('agenda-fixa') !== fixa) { body.classList.toggle('agenda-fixa', fixa); ajustarAreaLivre(); }
    if (!forcar && agendaEventos && Date.now() - agendaEm < 5 * 60e3) return pintarAgenda();
    const hoje = mundo?.diaNaBahia?.() || hojeIso();
    try {
      const r = await fetch(`/api/painel?area=captacoes&semana=${hoje}&dias=7`, { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Agenda indisponível.');
      agendaEventos = (d.agenda || []).filter((e) => e.dia >= hoje); agendaEm = Date.now(); agendaErro = '';
    } catch (e) { agendaEventos = null; agendaErro = e.message || 'Agenda indisponível.'; hud.querySelector('#vv-agenda-lista').innerHTML = `<p class="vv-dica">${esc(e.message)}</p>`; pintarHoje(); return; }
    pintarAgenda(); pintarHoje();
    const hoje2 = mundo?.diaNaBahia?.() || hojeIso();
    mundo?.definirCaptacoes?.(agendaEventos.filter((e) => e.dia === hoje2 && e.tipo === 'captacao' && e.cliente)
      .map((e) => ({ cliente: e.cliente, dia: e.dia, inicio: e.inicio || '', fim: e.fim || '' })));
  }
  document.addEventListener('vybe-datas-prontas', () => pintarAgenda());
  function pintarAgenda() {
    const el = hud.querySelector('#vv-agenda-lista'); if (!el || !agendaEventos) return;
    pintarRoteiros();
    el.innerHTML = agendaListaHtml(centroAberto ? 3 : 6);
    agendaNoHoje();
  }
  // Os próximos 3 compromissos e as datas comemorativas: a lista da gaveta da Agenda (e da Agenda no Hoje da Minha sala).
  function agendaListaHtml(maxDatas = 6) {
    if (!agendaEventos) return '';
    const hoje = hojeIso(), agora = new Date(), hm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    const amanha = (() => { const x = new Date(`${hoje}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); })();
    const proximos = agendaEventos.filter((e) => e.dia > hoje || !e.fim || e.fim >= hm)
      .sort((a, b) => (a.dia + (a.inicio || '00:00')).localeCompare(b.dia + (b.inicio || '00:00'))).slice(0, 3);
    // Datas comemorativas dos próximos 14 dias, abaixo dos compromissos e com menos destaque (Paulo, 08/11/2026).
    const datas = window.VybeDatas?.proximas(hoje, 14) || [];
    const datasHtml = datas.length ? `<div class="vd-agenda"><small class="vd-agenda-rotulo">Datas comemorativas</small>${datas.slice(0, maxDatas).map((d) => `<div class="vd-agenda-linha"><span>${d.iso === hoje ? 'Hoje' : d.iso.slice(8, 10) + '/' + d.iso.slice(5, 7)}</span>${window.VybeDatas.chipHtml(d)}</div>`).join('')}</div>` : '';
    if (!proximos.length) return '<p class="vv-dica">Nada marcado nos próximos 7 dias.</p>' + datasHtml;
    return proximos.map((e) => {
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
    // O menu da Agenda fecha ao abrir a agenda completa (auditoria 09/11, D13: ficava aberto por cima da tela que abriu).
    fecharDaDireita();
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
      return { agora: `${plural(abertas.length, 'peça em aberto', 'peças em aberto')} · ${plural(atrasadas, 'atrasada', 'atrasadas')}.`,
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
  // Salas do prédio também sem o 3D montado (Equipe, Perfil, Jogos com o Centro fechado davam erro em mundo.zonasDoPredio).
  const zonas3d = () => mundo?.zonasDoPredio || modAvatar?.ZONAS_DO_PREDIO || {};
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
    setTimeout(() => { hud.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.vista === 'predio'))); body.classList.add('mundo-predio'); mostrarAgente(idAndar, idSetor); }, 350);
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
      <button type="button" class="vv-botao" style="margin-top:8px" data-perfil-agente="${esc(s.id)}">Ver perfil completo: rotinas, achados, de onde vem cada coisa →</button>
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

  // ---------- Equipe: o que era o saguão do Escritório, agora no mundo ----------
  // As funções são as do Escritório (mesmas janelas, mesmas regras); só a porta mudou.
  const EQUIPE_ACOES = [
    ['conversa', 'Conversa da equipe', "alternarAbaEscritorio('conversa',true)", '<path d="M4 5h16v11H8l-4 4z"/>'],
    ['recados', 'Recados', 'abrirRecadosEscritorio()', '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h4"/>'],
    ['missoes', 'Missões do dia', 'abrirMissoesPeloLobbyEscritorio()', '<path d="M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z"/>'],
    ['ranking', 'Ranking da semana', "abrirRankingEscritorio('geral','semana')", '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/>'],
    ['conquistas', 'Conquistas', 'abrirConquistasEscritorio()', '<circle cx="12" cy="9" r="5"/><path d="M9 13.5 8 21l4-2 4 2-1-7.5"/>'],
    ['inventario', 'Inventário', "abrirCatalogoEscritorio('inventario')", '<path d="M4 7h16v13H4z"/><path d="M9 7V4h6v3"/>'],
    ['catalogo', 'Catálogo (loja)', 'abrirCatalogoEscritorio()', '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>'],
    ['espaco', 'Meu personagem', 'personalizarEscritorio()', '<circle cx="12" cy="8" r="4"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>'],
  ];
  // "Visto há…" (quadro 22): o servidor não guarda a última presença; o painel anota, neste navegador, a última vez que viu
  // cada pessoa online (presença do Escritório). Sem anotação, "fora agora". É conveniência de quem olha, não registro.
  const VISTOS = 'vybe-equipe-vistos';
  function lerVistos() { try { const v = JSON.parse(localStorage.getItem(VISTOS) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
  function marcarVistos(gente) {
    if (!gente.length) return;
    const v = lerVistos(), agora = Date.now(); for (const g of gente) v[g.id] = agora;
    try { localStorage.setItem(VISTOS, JSON.stringify(v)); } catch { /* sem armazenamento: fica "fora agora" */ }
  }
  function vistoHa(ts) {
    const min = Math.floor((Date.now() - Number(ts)) / 60e3);
    if (!(min >= 0)) return 'fora agora';
    if (min < 2) return 'visto há pouco';
    if (min < 60) return `visto há ${min} min`;
    const h = Math.floor(min / 60); if (h < 24) return `visto há ${h} h`;
    const d = Math.floor(h / 24); return d === 1 ? 'visto ontem' : `visto há ${d} dias`;
  }
  // ===== Equipe online pelo quadro "Equipe online" do moodboard (Paulo, 12/11/2026: "eu aprovei o DEPOIS") =====
  // A tela é o quadro, nesta ordem: título, VybeCoins e "Conversa da equipe"; a fala do VYBES; três números (online,
  // recados sem ler, missões do dia); "Pede ação" e "Missões do dia" à esquerda; "No prédio agora" à direita, com busca,
  // três fichas e uma linha por sala que abre no lugar (Chamar, Perfil, Entrar na sala); no pé, as portas do Escritório.
  // Conquistas, Inventário e Catálogo moram no menu (Prédio, Jogos, Loja…); o resto do Escritório fica aqui.
  const EQUIPE_NO_DOCK = new Set(['conquistas', 'inventario', 'catalogo']);
  // Uma pessoa online: o rosto voxel (o mesmo boneco do mundo), a sala e as ações. Usado nos Jogos.
  function pessoaOnlineHtml(g, Z, { jogos = false } = {}) {
    const z = Z[g.zona], eu = typeof escritorio !== 'undefined' && String(escritorio?.base?.eu || '') === g.id;
    const rosto = typeof escritorioCabecaUrl === 'function' ? escritorioCabecaUrl(g.id) : '';
    return `<div class="vv-online"><span class="vv-online-rosto">${rosto ? `<img src="${esc(rosto)}" alt="" width="32" height="32" loading="lazy">` : `<i>${esc(iniciais(g.nome))}</i>`}</span>
      <span class="vv-online-txt"><b>${esc(eu ? 'Você' : g.nome)}</b><small>${z ? (/^sala/i.test(z.nome) ? `na ${esc(z.nome)}` : `na sala ${esc(z.nome)}`) : 'fora das salas'}</small></span>
      ${eu ? '' : `${z && !jogos ? `<button type="button" class="vc-sec" data-entrar-zona="${esc(g.zona)}">Ir até</button>` : ''}<button type="button" class="vc-sec" data-chamar-online="${esc(g.id)}">Chamar</button>`}</div>`;
  }
  let equipeFiltro = 'todos', equipeBusca = '', equipeForaAberto = false;
  const equipeAbertas = new Set();
  const IC_MIC_SALA = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  const IC_SETA_BAIXO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const juntarNomes = (l) => (l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]);
  // O que a tela lê: presença e time do Escritório, recados sem ler por pessoa e as missões (tarefas com recompensa).
  function dadosDaEquipe() {
    const e = typeof escritorio !== 'undefined' ? escritorio : null, euId = String(e?.base?.eu || '');
    const gente = presencaDoEscritorio(), Z = zonas3d(), time = e?.base?.equipe || [];
    const onlineIds = new Set(gente.map((g) => g.id)), vistos = lerVistos();
    // Quem saiu há menos tempo primeiro.
    const fora = time.filter((t) => !onlineIds.has(String(t.id))).sort((a, b) => (Number(vistos[b.id]) || 0) - (Number(vistos[a.id]) || 0));
    const salas = new Map(); for (const g of gente) { const k = g.zona && Z[g.zona] ? g.zona : ''; if (!salas.has(k)) salas.set(k, []); salas.get(k).push(g); }
    const recados = Object.entries(e?.recadosResumo || {}).map(([id, n]) => ({ id: String(id), n: Number(n) || 0, nome: time.find((t) => String(t.id) === String(id))?.nome || 'Alguém' })).filter((r) => r.n > 0);
    const missoes = (e?.missoes?.missoes || []).filter((m) => m.hoje || m.atrasada);
    const trancas = e?.trancas instanceof Map ? e.trancas : new Map();
    return { e, euId, gente, Z, time, fora, vistos, salas, recados, nRecados: recados.reduce((s, r) => s + r.n, 0), missoes, trancas, total: Math.max(time.length, gente.length), saldo: e?.base?.economia?.saldo ?? null };
  }
  const avEquipe = (nome, on = false, extra = '') => `<span class="v2n-av${on ? ' vd' : ''}${extra}" aria-hidden="true">${esc(iniciais(nome))}</span>`;
  // "No prédio agora": uma linha por sala com gente (abre no lugar), a linha de quem está fora e a frase do vazio.
  function predioAgoraHtml(D) {
    const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const termo = plano(equipeBusca).trim(), bate = (...t) => !termo || t.some((x) => plano(x).includes(termo));
    const nomeDe = (g) => (g.id === D.euId ? 'Você' : g.nome || 'Pessoa');
    const acoes = (g, zona, irAte) => (g.id === D.euId ? '<span class="v2n-sub">é você</span>'
      : `${irAte && zona && D.e?.zona !== zona ? `<button type="button" class="v2n-btn s" data-entrar-zona="${esc(zona)}">Ir até lá</button>` : ''}<button type="button" class="v2n-btn s" data-chamar-online="${esc(g.id)}" aria-label="Chamar ${esc(primeiro(g.nome))} para a minha sala">Chamar</button><button type="button" class="v2n-btn s" data-perfil="${esc(g.id)}">Perfil</button>`);
    const linhas = [];
    if (equipeFiltro !== 'fora') for (const [zona, l] of D.salas) {
      const nomeSala = zona ? D.Z[zona].nome : 'Fora das salas';
      const quem = l.filter((g) => bate(nomeDe(g), g.nome, nomeSala)); if (!quem.length) continue;
      const selo = `<span class="v2n-pill ${zona ? 'g' : 'n'}">${zona ? IC_MIC_SALA : ''}${esc(nomeSala)}</span>`;
      const estado = !zona ? 'na recepção' : D.trancas.has(zona) ? 'sala trancada' : 'sala de voz aberta';
      if (quem.length === 1) { const g = quem[0];
        linhas.push(`<div class="v2n-lin v2e-sala">${selo}${avEquipe(nomeDe(g), true)}<p><b>${esc(nomeDe(g))}</b> <span class="v2n-sub">· ${estado}</span></p><span class="v2e-acoes">${acoes(g, zona, true)}</span></div>`);
        continue; }
      const aberta = equipeAbertas.has(zona) || Boolean(termo);
      linhas.push(`<div class="v2-abre v2e-sala" aria-expanded="${aberta}"><button type="button" class="v2n-lin v2e-sala-cab" data-eq-sala="${esc(zona)}" aria-expanded="${aberta}">${selo}<span class="v2n-avs" aria-hidden="true">${quem.slice(0, 4).map((g) => avEquipe(nomeDe(g), true)).join('')}</span><p><b>${esc(juntarNomes(quem.map((g) => primeiro(nomeDe(g)))))}</b> <span class="v2n-sub">· ${estado}</span></p><span class="v2e-seta">${IC_SETA_BAIXO}</span></button>
        <div class="v2-mais"><div><div class="v2e-det"><div class="v2e-det-gente">${quem.map((g) => `<div class="v2e-pes">${avEquipe(nomeDe(g), true)}<p><b>${esc(nomeDe(g))}</b></p>${acoes(g, zona, false)}</div>`).join('')}</div>
          ${zona && D.e?.zona !== zona ? `<button type="button" class="v2n-btn k" data-entrar-zona="${esc(zona)}">Entrar na sala</button>` : zona ? '<span class="v2n-pill g">Você está aqui</span>' : ''}</div></div></div></div>`);
    }
    if (equipeFiltro !== 'online') { const fora = D.fora.filter((t) => bate(t.nome));
      if (fora.length) { const aberto = equipeForaAberto || Boolean(termo) || equipeFiltro === 'fora';
        linhas.push(`<div class="v2-abre v2e-sala" aria-expanded="${aberto}"><div class="v2n-lin"><span class="v2n-pill n">Fora agora ${n0(fora.length)}</span><p class="v2e-fora">${fora.slice(0, 5).map((t) => `<span>${avEquipe(t.nome)}<b>${esc(primeiro(t.nome))}</b></span>`).join('')}${fora.length > 5 ? `<span class="v2n-sub">+ ${n0(fora.length - 5)}</span>` : ''}</p><button type="button" class="v2n-btn s" data-eq-fora aria-expanded="${aberto}">${aberto ? 'Recolher' : 'Ver perfis'}</button></div>
          <div class="v2-mais"><div><div class="v2e-det v2e-det-fora"><div class="v2e-det-gente">${fora.map((t) => `<div class="v2e-pes">${avEquipe(t.nome)}<p><b>${esc(t.nome || 'Pessoa')}</b> <span class="v2n-sub">· ${esc(D.vistos[t.id] ? vistoHa(D.vistos[t.id]) : 'fora agora')}</span></p><button type="button" class="v2n-btn s" data-eq-recado="${esc(t.id)}">Recado</button><button type="button" class="v2n-btn s" data-perfil="${esc(t.id)}">Perfil</button></div>`).join('')}</div></div></div></div></div>`); } }
    if (!D.gente.length && equipeFiltro !== 'fora' && !termo) linhas.push('<div class="v2n-lin v2e-vazio"><span class="v2n-pill n">Ninguém online</span><p class="v2n-sub"><b>Ninguém online agora.</b> Quem entrar aparece aqui, com a sala onde está.</p><button type="button" class="v2n-btn s" data-equipe="recados">Deixar recado</button></div>');
    else if (!linhas.length) linhas.push(`<p class="v2n-sub v2e-nada">${termo ? 'Ninguém com esse nome ou sala.' : 'Ninguém neste filtro.'}</p>`);
    return linhas.join('');
  }
  function mostrarEquipe() {
    const p = placa(), D = dadosDaEquipe();
    marcarVistos(D.gente);
    if (D.e?.base && !D.e.missoes && !mostrarEquipe.pediu) { mostrarEquipe.pediu = true; Promise.resolve(fn('carregarMissoesEscritorio')?.()).catch(() => {}).finally(() => { if (naEquipe()) mostrarEquipe(); }); }
    const acoes = EQUIPE_ACOES.filter(([id, , f]) => id !== 'conversa' && !EQUIPE_NO_DOCK.has(id) && typeof window[f.split('(')[0]] === 'function');
    const temConversa = typeof window.alternarAbaEscritorio === 'function';
    const nSalas = [...D.salas.keys()].filter(Boolean).length, on = D.gente.length;
    // A fala: quantos estão online e onde está a maior roda; depois, os recados que esperam.
    const maior = [...D.salas.entries()].filter(([z]) => z).sort((a, b) => b[1].length - a[1].length)[0];
    const onde = !maior ? '' : maior[1].length === on ? `, ${on === 1 ? 'na' : 'todos na'} ${esc(D.Z[maior[0]].nome)}` : `, ${n0(maior[1].length)} ${maior[1].length === 1 ? 'na' : 'deles na'} ${esc(D.Z[maior[0]].nome)}`;
    const fala = (on ? `<b>${n0(on)} de ${n0(D.total)} online agora</b>${onde}.` : '<b>Ninguém online agora.</b>')
      + (D.nRecados ? ` <b>${plural(D.nRecados, 'recado', 'recados')}</b> ${D.nRecados === 1 ? 'espera' : 'esperam'} a sua resposta.` : ' Nenhum recado esperando você.');
    const moedas = D.missoes.reduce((s, m) => s + (Number(m.recompensa?.moedas) || 0), 0);
    const kpi = (rot, valor, sub, extra = '', quieto = false) => `<div class="v2n-card v2n-kpi${quieto ? ' quieto' : ''}"><small>${rot}</small><b><span class="v2-num">${valor}</span>${extra}</b><small>${sub}</small></div>`;
    const pede = D.recados.map((r) => `<div class="v2n-lin"><span class="v2n-pill a">${n0(r.n)} sem ler</span><p><b>Recado de ${esc(primeiro(r.nome))}</b></p><button type="button" class="v2n-btn s" data-eq-recado="${esc(r.id)}">Responder</button></div>`).join('');
    const missoes = D.missoes.slice(0, 4).map((m) => `<button type="button" class="v2n-lin v2e-missao" data-eq-missao="${esc(m.ref)}|${esc(m.quadro || '')}" title="Abrir a demanda"><i class="v2e-cx" aria-hidden="true"></i><p>${esc(m.titulo)}${m.cliente ? ` <span class="v2n-sub">· ${esc(m.cliente)}</span>` : ''}</p>${m.atrasada ? '<span class="v2n-pill r">Atrasada</span>' : ''}${m.recompensa?.moedas ? `<span class="v2n-pill n">${n0(m.recompensa.moedas)} VybeCoins</span>` : ''}</button>`).join('');
    const rostos = on ? `<span class="v2n-avs" aria-hidden="true">${D.gente.slice(0, 3).map((g, i, l) => avEquipe(g.id === D.euId ? 'Você' : g.nome, true, i === l.length - 1 ? ' v2-pop' : '')).join('')}</span>` : '';
    const html = `<div class="v2e">
      <div class="v2e-topo"><h1>Equipe online</h1>
        ${D.saldo !== null ? `<span class="v2n-chip vv-moedas-selo" title="Seu saldo de VybeCoins"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/></svg><b>${n0(D.saldo)}</b> VybeCoins</span>` : ''}
        ${temConversa ? '<button type="button" class="v2n-btn p" data-equipe="conversa">Conversa da equipe</button>' : ''}</div>
      <section class="v2n-card v2n-fala" aria-label="VYBES sobre a equipe"><span class="v2n-ag" aria-hidden="true">V</span><p><span class="v2n-quem">VYBES · Escritório</span>${fala}</p>${D.nRecados ? '<button type="button" class="v2n-btn s" data-equipe="recados">Ler os recados</button>' : ''}</section>
      <div class="v2e-nums">
        ${kpi('Online agora', `${n0(on)} de ${n0(D.total)}`, on ? `em ${plural(nSalas, 'sala', 'salas')} do prédio` : 'ninguém nas salas', rostos, !on)}
        ${kpi('Recados sem ler', n0(D.nRecados), D.nRecados ? `de ${plural(D.recados.length, 'pessoa', 'pessoas')}` : 'nada esperando', '', !D.nRecados)}
        ${kpi('Missões do dia', n0(D.missoes.length), D.missoes.length ? (moedas ? `valem ${n0(moedas)} VybeCoins` : 'para hoje ou atrasadas') : 'nada para hoje', '', !D.missoes.length)}
      </div>
      <div class="v2e-grade">
        <div class="v2e-esq">
          <section class="v2n-card"><div class="v2n-cab"><h2>Pede ação</h2><span class="v2n-sub">${D.recados.length ? `${plural(D.recados.length, 'coisa', 'coisas')} esperando você` : 'nada esperando você'}</span></div>${pede || '<p class="v2n-sub v2e-nada">Nenhum recado sem resposta.</p>'}</section>
          <section class="v2n-card v2e-missoes"><div class="v2n-cab"><h2>Missões do dia</h2><span class="v2n-sub">${D.missoes.length ? `${n0(D.missoes.length)} em aberto` : 'nenhuma para hoje'}</span></div>
            ${missoes || '<p class="v2n-sub v2e-nada">Nada para hoje. Quando uma tarefa chegar, ela aparece aqui com o que vale.</p>'}
            <p class="v2n-sub v2e-pe">${D.missoes.length > 4 ? `+ ${n0(D.missoes.length - 4)} · ` : ''}<button type="button" class="vg-link" data-equipe="missoes">ver todas as missões</button> · as VybeCoins entram quando a tarefa é concluída.</p></section>
        </div>
        <section class="v2n-card v2e-predio"><div class="v2n-cab"><h2>No prédio agora</h2><span class="v2n-sub">${on ? `${n0(on)} online em ${plural(nSalas, 'sala', 'salas')} · ` : ''}“Chamar” traz a pessoa para a sua sala</span></div>
          <div class="v2e-filtros"><input type="search" class="v2n-busca" data-eq-busca placeholder="Buscar pessoa ou sala" aria-label="Buscar pessoa ou sala" value="${esc(equipeBusca)}">
            ${[['todos', 'Todos', D.total], ['online', 'Online', on], ['fora', 'Fora agora', D.fora.length]].map(([k, r, n]) => `<button type="button" class="v2n-chip" data-eq-filtro="${k}" aria-pressed="${equipeFiltro === k}">${r} <b>${n0(n)}</b></button>`).join('')}</div>
          <div class="v2e-lista">${predioAgoraHtml(D)}</div></section>
      </div>
      ${acoes.length ? `<div class="v2e-portas"><span class="v2n-sub">Do Escritório:</span>${acoes.map(([id, nome]) => `<button type="button" class="v2n-chip" data-equipe="${id}">${esc(nome)}${id === 'recados' && D.nRecados ? ` <b>${n0(D.nRecados)}</b>` : ''}</button>`).join('')}</div>` : ''}
    </div>`;
    if (p.vvEquipe !== html || !p.querySelector('.v2e')) { p.innerHTML = html; p.vvEquipe = html; }
    p.hidden = false; ajustarAreaLivre();
  }
  const naEquipe = () => !placa().hidden && Boolean(placa().querySelector('.v2e'));
  // A lista acompanha a presença (quem entrou, quem mudou de sala) sem tirar o foco de quem está digitando na busca.
  if (typeof setInterval === 'function') setInterval(() => { if (naEquipe() && !placa().contains(document.activeElement)) mostrarEquipe(); }, 4000);
  hud.addEventListener('input', (e) => {
    if (!e.target.matches?.('[data-eq-busca]')) return;
    equipeBusca = e.target.value; const l = placa().querySelector('.v2e-lista'); if (l) l.innerHTML = predioAgoraHtml(dadosDaEquipe()); placa().vvEquipe = '';
  });
  hud.addEventListener('click', (e) => {
    const b = e.target.closest?.('#vv-placa .v2e button'); if (!b) return;
    if (b.dataset.eqSala !== undefined) { const z = b.dataset.eqSala; if (equipeAbertas.has(z)) equipeAbertas.delete(z); else equipeAbertas.add(z); mostrarEquipe(); }
    else if (b.dataset.eqFiltro) { equipeFiltro = b.dataset.eqFiltro; mostrarEquipe(); }
    else if (b.hasAttribute('data-eq-fora')) { equipeForaAberto = !equipeForaAberto; mostrarEquipe(); }
    else if (b.dataset.eqRecado) { if (window.VybeConversa?.abrir) window.VybeConversa.abrir('recados', b.dataset.eqRecado); else fn('abrirRecadosEscritorio')?.(b.dataset.eqRecado); }
    else if (b.dataset.eqMissao) { const [ref, quadro] = b.dataset.eqMissao.split('|'); fn('abrirMissaoEscritorio')?.(ref, quadro, e); }
  });
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
  // Vitrine do jogador (Paulo, 21/10/2026: "o boneco aparece sempre na vitrine do quarto dele"; 09/11/2026: tudo em
  // voxel): com o mundo ligado, toda .vb-vitrine do Escritório (ficha, entrada, criador) é um pedaço 3 × 3 do quarto
  // voxel da pessoa (abrirQuarto em modo vitrine): o piso e a parede dela, até dois móveis do quarto
  // (escritorioMoveisDaVitrine) e o boneco fiel no meio. Desenha só quando muda, como o quarto.
  function vitrineVoxel(el) {
    if (!ligado || !el) return null;
    const pid = String(el.dataset.pessoa || '');
    let vivo = true, cena = null;
    const canvas = document.createElement('canvas'); canvas.className = 'vv-vitrine-3d'; el.append(canvas); el.classList.add('vv-vitrine');
    (modAvatar ? Promise.resolve(modAvatar) : import(MUNDO_JS)).then(async (m) => {
      modAvatar = modAvatar || m; if (!vivo || !el.isConnected) return;
      let sala = null; try { sala = pid ? fn('escritorioDonos')?.()?.get(pid) : null; } catch { /* sem base */ }
      const base = sala ? quartoDaSala(sala.id) : null;
      const quarto = { id: 'vitrine-' + (pid || 'x'), nome: '', w: 3, h: 3, piso: base?.piso, parede: base?.parede, ehDeParede: base?.ehDeParede, itens: [] };
      cena = m.abrirQuarto(canvas, { quarto, vitrine: true });
      if (el.dataset.boneco) {
        const e = typeof escritorio !== 'undefined' ? escritorio : null;
        const perfil = pid && String(pid) === String(e?.base?.eu) ? e?.perfil : e?.base?.equipe?.find((p) => String(p.id) === pid)?.perfil;
        cena.pessoas([{ id: 'vitrine-' + pid, nome: '', zona: quarto.id, x: 1, y: 1, figura: perfil?.figura || '', roupa: perfil?.roupa, pele: perfil?.pele, cabelo: perfil?.cabelo }], '');
      }
      const itens = await (fn('escritorioMoveisDaVitrine')?.(pid) || Promise.resolve([])).catch(() => []);
      if (!vivo || !itens.length) return;
      cena.itens(itens);
      medidasDoHabbo(itens, m).then((l) => { if (vivo && l.length) cena?.medidas?.(l); });
    }).catch((err) => console.error('[mundo] vitrine', err));
    return { destruir() { vivo = false; try { cena?.destruir(); } catch { /* já fechada */ } canvas.remove(); } };
  }
  window.vybeVitrineVoxel = vitrineVoxel;
  // A ficha no mundo: o boneco na vitrine voxel do quarto dele (acima); "ir para o quarto" leva à sala da pessoa no
  // Prédio; a pintura de piso e paredes do Habbo some (a sala agora é voxel).
  function ajustarFicha() {
    const d = document.getElementById('office-ficha'); if (!d || !ligado) return;
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
      const z = ligado && zonas3d()?.[id];
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
  // [id, nome, frase, regra da mesa, função que abre, móvel da mesa (a arte do cartão), rótulo do botão]
  const JOGOS = [
    ['sinuca', 'Sinuca', 'Sinuca de boteco, com mira e física.', 'ESCRITORIO_SINUCA', 'abrirSinucaEscritorio', 'bling15_pooltable', 'Jogar'],
    ['xadrez', 'Xadrez', 'Partida contra alguém da equipe; vale aposta.', 'ESCRITORIO_XADREZ', 'abrirXadrezEscritorio', 'CF_250_goldenchessboard', 'Desafiar'],
    ['poker', 'Pôquer', 'Texas hold’em valendo VybeCoins ou de graça.', 'ESCRITORIO_POKER', 'abrirPokerEscritorio', 'wildwest_table', 'Jogar'],
    ['mesa', 'Mesa de jogos', 'Dominó, dama, velha e truco.', 'ESCRITORIO_DOMINO', 'abrirMesaDeJogosEscritorio', 'hobbies_c26_gamingtable', 'Jogar'],
  ];
  // Jogos (redesign fase 3c, quadro 38): cada mesa com a arte dela (o retrato voxel troca a imagem do móvel, como na
  // Loja) e o botão de jogar; embaixo, quem está online para chamar, sem ir a outro lugar.
  function mostrarJogos() {
    const p = placa(), gente = presencaDoEscritorio(), Z = zonas3d();
    const eu = typeof escritorio !== 'undefined' ? String(escritorio?.base?.eu || '') : '';
    // Padrão v2 (moodboard, 12/11/2026): título e quantos online; um cartão por mesa, com a arte, a regra e Jogar;
    // embaixo, quem está online para chamar, na linha do quadro.
    const pessoa = (g) => `<div class="v2n-lin"><span class="v2n-av vd" aria-hidden="true">${esc(iniciais(g.id === eu ? 'Você' : g.nome))}</span><p><b>${esc(g.id === eu ? 'Você' : g.nome)}</b> <span class="v2n-sub">· ${Z[g.zona] ? esc(Z[g.zona].nome) : 'fora das salas'}</span></p>${g.id === eu ? '' : `<button type="button" class="v2n-btn s" data-chamar-online="${esc(g.id)}">Chamar</button>`}</div>`;
    p.innerHTML = `<div class="v2j"><div class="v2e-topo"><h1>Jogos</h1><span class="v2n-chip"><i class="v2j-ponto" aria-hidden="true"></i>${n0(gente.length)} online agora</span>
        <button type="button" class="v2n-x" data-fechar aria-label="Fechar">${svg('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div>
      <p class="v2n-sub">As mesas ficam no terraço do prédio. Escolha o jogo e chame quem está online.</p>
      <div class="v2j-mesas">${JOGOS.map(([id, nome, txt, , , classe, rotulo]) => `<article class="v2n-card v2j-mesa">
        <img class="v2j-arte" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(classe)}.png?size=64" alt="" loading="lazy">
        <div><h2>${esc(nome)}</h2><p class="v2n-sub">${esc(txt)}</p></div><button type="button" class="v2n-btn k" data-jogo="${id}">${esc(rotulo)}</button></article>`).join('')}</div>
      <section class="v2n-card"><div class="v2n-cab"><h2>Quem pode jogar agora</h2><span class="v2n-sub">${plural(gente.length, 'pessoa online', 'pessoas online')}</span></div>
        ${gente.length ? gente.map(pessoa).join('') : '<p class="v2n-sub v2e-nada">Ninguém online agora. Dá para abrir a mesa e esperar alguém chegar.</p>'}</section>
      <p class="v2n-sub">Ranking, Loja e Conquistas ficam no menu, em Prédio, Jogos, Loja…</p></div>`;
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
    const dono = souDono();
    m = document.createElement('div'); m.className = 'vv-menu-conta'; m.setAttribute?.('role', 'menu');
    // Fase 3b (quadro 46): um menu só, com quem você é e o saldo no alto, um ícone em cada linha e a aparência num
    // alternador na própria linha. O ícone separado de aparência saiu do topo (frente topo): "Mais ajustes" fica aqui.
    const IC_MENU = { conta: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>', perfil: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M12 13v4M8 21h8"/>', atualizar: '<path d="M20 12a8 8 0 1 1-3-6.3"/><path d="M20 4v5h-5"/>', vercomo: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', recado: '<path d="M4 5h16v11H8l-4 4z"/>', ajustes: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>', sair: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>' };
    const item = (acao, texto, sub, cls = '') => `<button type="button" role="menuitem" class="${cls}" data-conta-acao="${acao}">${IC_MENU[acao.split(':')[0]] ? `<i class="vv-menu-ic" aria-hidden="true">${svg(IC_MENU[acao.split(':')[0]])}</i>` : ''}<span><b>${texto}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`;
    // Quem você é sai da sessão quando a equipe ainda não casou o nome (operadorDoTopo devolve null até lá).
    const eu = (typeof operadorDoTopo === 'function' ? operadorDoTopo() : null) || (typeof pessoaLogada === 'function' ? pessoaLogada() : null) || {};
    const nomeEu = String(eu.name || eu.nome || '').trim();
    const eco = typeof escritorio !== 'undefined' ? escritorio?.base?.economia : null;
    const saldoEu = eco && eco.saldo != null ? eco.saldo : null;
    const papelEu = dono ? 'Gestão' : 'Equipe';
    const temaAgora = temaEscolhido();
    const temaBt = (t, rot) => `<button type="button" role="menuitemradio" data-tema-linha="${t}" aria-checked="${temaAgora === t}">${rot}</button>`;
    // Diário e IA ficam só na Gestão (uma porta por tela, auditoria 09/11).
    m.innerHTML = `<div class="vv-menu-cab"><h2>Conta</h2><button type="button" class="vc-ico" data-conta-fechar aria-label="Fechar">${svg('<path d="M6 6l12 12M18 6 6 18"/>')}</button></div>` + (nomeEu ? `<div class="vv-menu-quem"><span class="vv-menu-av" aria-hidden="true">${esc(nomeEu.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase())}</span><span><b>${esc(nomeEu)}</b><small>${esc(papelEu)} · ${saldoEu !== null ? Number(saldoEu).toLocaleString('pt-BR') + ' VybeCoins' : 'saldo ao entrar no escritório'}</small></span></div><hr>` : '')
      + '<p class="vv-menu-grupo">Você</p>' + item('conta', 'Minha conta', 'senha e acessos')
      + item('perfil', 'Meu perfil', 'nível e conquistas')
      + '<p class="vv-menu-grupo">Gestão</p>' + item('atualizar', 'Atualizar dados', '')
      + (podeVerComo() ? item('vercomo', verComo ? 'Ver como outra pessoa' : 'Ver como…', verComo ? `agora: ${esc(pessoaVista()?.name || '')}` : 'a tela de outra pessoa') : '')
      + (dono ? item('recado', 'Recado para todos', 'aparece na tela de toda a equipe') : '')
      + `<div class="vv-menu-tema-linha" role="group" aria-label="Aparência"><span>Aparência</span><span class="vb-alternar">${temaBt('claro', 'Claro')}${temaBt('escuro', 'Escuro')}${temaBt('auto', 'Auto')}</span></div>`
      + item('ajustes', 'Mais ajustes de aparência', 'vidro, movimento e o mundo nos módulos')
      + '<hr>' + item('sair', 'Sair', '', 'vv-menu-perigo');
    hud.querySelector('.vv-barra-topo')?.after?.(m);
    m.addEventListener?.('click', (e) => {
      const tl = e.target.closest('[data-tema-linha]');
      if (tl) { trocarTema(tl.dataset.temaLinha); m.querySelectorAll('[data-tema-linha]').forEach((x) => x.setAttribute('aria-checked', String(x === tl))); return; }
      if (e.target.closest('[data-conta-fechar]')) { m.remove(); return; }
      const b = e.target.closest('[data-conta-acao]'); if (!b) return;
      const a = b.dataset.contaAcao;
      // Ver como: a lista da equipe no próprio menu; escolher troca a tela inteira (Hoje, dock e números de dono).
      if (a === 'vercomo') {
        m.innerHTML = `${item('vercomo:', 'Eu', 'a minha tela', !verComo ? 'atual' : '')}${timeDoPainel().map((u) => item('vercomo:' + esc(u.id), esc(u.name || u.nome || 'Pessoa'), u.dono === true ? 'dono' : '', String(u.id) === verComo ? 'atual' : '')).join('')}`;
        return;
      }
      m.remove();
      if (a.startsWith('vercomo:')) { definirVerComo(a.slice(8)); if (body.classList.contains('mundo-modulo')) chamar('voltarAoMenu'); usarTrilho('hoje'); return; }
      if (a === 'conta') chamar('irParaMinhaConta');
      else if (a === 'perfil') abrirPerfil();
      else if (a === 'atualizar') { chamar('refreshData'); }
      else if (a === 'recado') chamar('abrirMandarAvisoEscritorio');
      else if (a === 'ajustes') document.querySelector('[data-open-appearance]')?.click();
      else if (a === 'sair') chamar('sairDaSessao');
    });
    setTimeout(() => document.addEventListener('click', function fora(e) { if (!e.target.closest('.vv-menu-conta, [data-ferr="conta"]')) { m.remove(); document.removeEventListener('click', fora); } }), 0);
  }
  // Coluna da direita na barra de cima (Paulo, 08/11/2026: "essas coisas da direita não precisam ficar fixas, o foco é
  // no que tá aberto"). A Agenda e a barra da sala de voz são as MESMAS de antes; só deixam de ficar fixas e abrem
  // pelo botão, como janelinha. A Agenda fica fixa só para o Mizinho, que grava e fotografa tudo ("a agenda só é
  // prioridade de tela pra ele"); os outros veem os próprios compromissos no Hoje.
  function agendaFixa() {
    const u = typeof operadorDoTopo === 'function' ? operadorDoTopo() : null;
    const quem = primeiroNome(u?.name || u?.nome || (typeof pessoaLogada === 'function' ? pessoaLogada()?.nome : ''));
    return quem === 'ademir' || quem === 'mizinho';
  }
  function abrirDaDireita(qual) {
    const aberto = qual && !body.classList.contains('ver-' + qual) ? qual : '';
    body.classList.toggle('ver-agenda', aberto === 'agenda'); body.classList.toggle('ver-voz', aberto === 'voz');
    hud.querySelector('[data-ferr="agenda"]')?.setAttribute('aria-expanded', String(aberto === 'agenda'));
    hud.querySelector('[data-ferr="voz"]')?.setAttribute('aria-expanded', String(aberto === 'voz'));
    if (aberto === 'agenda') { const ag = hud.querySelector('#vv-agenda'); ag?.classList.remove('recolhida'); carregarAgenda(); }
    if (aberto === 'voz') { pintarChamada(); medirBarra(); }
  }
  const fecharDaDireita = () => { if (body.classList.contains('ver-agenda') || body.classList.contains('ver-voz')) abrirDaDireita(''); };
  document.addEventListener?.('pointerdown', (ev) => {
    if (!body.classList.contains('ver-agenda') && !body.classList.contains('ver-voz')) return;
    if (ev.target?.closest?.('#vv-agenda, .vv-chamada, .vv-ferramentas, .vv-dock-salas-faixa, #office-musica, dialog')) return;
    fecharDaDireita();
  }, true);
  // Os avisos num lugar só: notificações do painel e o que os planejamentos e os clientes pedem (antes, uma bolinha
  // solta no canto com o número). Com só um dos dois, abre direto; com os dois, uma escolha.
  function avisosPlanejamento() {
    let n = 0; try { n = (typeof PLJ_PENDENTES !== 'undefined' ? PLJ_PENDENTES.length : 0) + (typeof PLJ_ALERTAS !== 'undefined' ? PLJ_ALERTAS.reduce((t, a) => t + (a.total || 0), 0) : 0); } catch { n = 0; }
    return n;
  }
  const notificacoesDoPainel = () => Number(document.getElementById('notif-contador')?.textContent || 0) || 0;
  function abrirNotificacoes() { chamar('chooseManagerMode'); setTimeout(() => chamar('alternarNotificacoes'), 350); }
  // Avisos do sino (fase 3d, quadro 41): um painel preso no sino, no estilo do sistema, no lugar da janela no meio da tela
  // com fundo desfocado e dos triângulos nativos. Junta o que espera você (planejamentos), o que pede atenção nas peças dos
  // seus clientes e as notificações do painel (prazo, menções). Cada linha tem o tipo num ícone neutro, a frase inteira e a
  // ação dela (Abrir, Ver, Abrir a peça). Não lido tem a etiqueta "Novo" escrita, não só a cor.
  const naoLidasDoPainel = () => {
    try { if (typeof notificacoesNaoLidas === 'number') return notificacoesNaoLidas; } catch { /* sem o sino antigo */ }
    return notificacoesDoPainel();
  };
  const listaDoPainel = () => { try { return typeof notificacoes !== 'undefined' && Array.isArray(notificacoes) ? notificacoes : []; } catch { return []; } };
  const IC_AVISO = {
    plano: svg('<path d="M5 3h10l4 4v14H5z"/><path d="M9 11h6M9 15h6"/>'),
    atraso: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2.5"/>'),
    aprovar: svg('<path d="M5 12l4 4 10-10"/>'),
    falta: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16h.01"/>'),
    mencao: svg('<circle cx="12" cy="12" r="3.5"/><path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.4 6.8"/>'),
    sino: svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
    fechar: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  };
  const grupoAberto = new Set();
  const dataCurta = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
  function quandoFoiAviso(iso) {
    const t = Date.parse(iso); if (!t) return '';
    const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
    return min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.floor(min / 60)} h` : `há ${Math.floor(min / 1440)} d`;
  }
  function avisosHtml() {
    const pend = (() => { try { return typeof PLJ_PENDENTES !== 'undefined' ? PLJ_PENDENTES : []; } catch { return []; } })();
    const alertas = (() => { try { return typeof PLJ_ALERTAS !== 'undefined' ? PLJ_ALERTAS : []; } catch { return []; } })();
    const estados = (() => { try { return typeof PLJ_ESTADOS !== 'undefined' ? PLJ_ESTADOS : {}; } catch { return {}; } })();
    const mes = (iso) => { try { return typeof pljMes === 'function' ? pljMes(iso) : String(iso || ''); } catch { return String(iso || ''); } };
    // Avisos curtos que foram direto para o sino (celular sem vaga, quinta rodada): contam como novos até o sino abrir.
    const curtosNovos = curtosNaoVistos();
    const notifs = listaDoPainel(), novas = naoLidasDoPainel() + curtosNovos.length;
    const linha = ({ ic, titulo, sub = '', acao = '', novo = false, cls = '' }) => `<li class="vv-aviso-linha${novo ? ' nao-lido' : ''}${cls ? ' ' + cls : ''}">
      <span class="vv-aviso-ic" aria-hidden="true">${ic}</span><div class="vv-aviso-txt"><b>${novo ? '<em class="vv-aviso-novo">Novo</em>' : ''}${titulo}</b>${sub ? `<small>${sub}</small>` : ''}</div>${acao}</li>`;
    const partes = [];
    if (pend.length) partes.push(`<h3>Pede ação</h3><ul>${pend.map((p) => linha({ ic: IC_AVISO.plano,
      titulo: esc(`Planejamento de ${mes(p.mes)}`), sub: esc([p.cliente, p.titulo, estados[p.estado]?.rotulo || p.estado].filter(Boolean).join(' · ')),
      acao: `<button type="button" class="vc-sec vv-aviso-acao" data-aviso-plano="${esc(p.id)}">Abrir</button>` })).join('')}</ul>`);
    const tipos = [['atrasadas', 'status', 'muito atrasada', 'muito atrasadas', IC_AVISO.atraso], ['aprovar', 'status', 'para aprovar', 'para aprovar', IC_AVISO.aprovar], ['sem_info', 'motivo', 'sem informação', 'sem informação', IC_AVISO.falta]];
    const doCliente = alertas.flatMap((a) => tipos.filter(([k]) => Number(a[k + '_total'] || 0) > 0).map(([k, campo, um, varios, ic]) => {
      const total = Number(a[k + '_total']), itens = Array.isArray(a[k]) ? a[k] : [], chave = `${a.cliente_id || a.cliente}:${k}`, aberto = grupoAberto.has(chave);
      const pecas = aberto ? `<ul class="vv-aviso-pecas">${itens.map((x) => linha({ ic: '', cls: 'peca', titulo: esc(x.titulo || 'Peça'), sub: esc([x.prazo ? 'prazo ' + dataCurta(x.prazo) : '', x[campo]].filter(Boolean).join(' · ')),
        acao: `<button type="button" class="vc-sec vv-aviso-acao" data-aviso-peca="${esc(x.ref)}" data-quadro="${esc(x.quadro || '')}">Abrir a peça</button>` })).join('')}${total > itens.length ? `<li class="vv-aviso-mais">e mais ${total - itens.length} no painel</li>` : ''}</ul>` : '';
      return linha({ ic, cls: k === 'atrasadas' ? 'urgente' : '', titulo: esc(`${total} ${total === 1 ? 'peça' : 'peças'} ${total === 1 ? um : varios}`), sub: esc(a.cliente || 'Cliente'),
        acao: itens.length ? `<button type="button" class="vc-sec vv-aviso-acao" data-aviso-grupo="${esc(chave)}" aria-expanded="${aberto}">${aberto ? 'Fechar' : 'Ver'}</button>` : '' }).replace(/<\/li>$/, pecas + '</li>');
    }));
    if (doCliente.length) partes.push(`<h3>Nos seus clientes</h3><ul>${doCliente.join('')}</ul>`);
    // Sem nada novo, o último aviso fica no alto, para lembrar o que foi (quadro 41); o resto continua embaixo.
    const ultimo = novas ? null : [...notifs].sort((a, b) => String(b.criada_em || '').localeCompare(String(a.criada_em || '')))[0] || null;
    const anteriores = ultimo ? notifs.filter((n) => n !== ultimo) : notifs;
    const notifLinha = (n) => linha({ ic: /mencion/i.test(n.texto || '') ? IC_AVISO.mencao : IC_AVISO.sino, novo: !n.lida_em,
      titulo: esc(n.texto || 'Aviso'), sub: esc([n.conteudo_nome, quandoFoiAviso(n.criada_em)].filter(Boolean).join(' · ')),
      acao: n.conteudo_id ? `<button type="button" class="vc-sec vv-aviso-acao" data-aviso-notif="${esc(n.id)}" data-item="${esc(n.conteudo_id)}">Abrir a peça</button>` : '' });
    // Sem notificação guardada, o último aviso curto desta sessão (menção, WhatsApp, Música) faz o mesmo papel.
    const curto = globalThis.ULTIMO_AVISO_CURTO;
    const curtoLinha = curto?.titulo ? linha({ ic: IC_AVISO.sino, titulo: esc(curto.titulo), sub: esc([curto.frase, quandoFoiAviso(curto.em)].filter(Boolean).join(' · ')) }) : '';
    if (curtosNovos.length) partes.unshift(`<h3>Chegaram agora</h3><ul>${curtosNovos.map((a) => linha({ ic: a.icone === 'mencao' ? IC_AVISO.mencao : IC_AVISO.sino, novo: true,
      titulo: esc(a.titulo), sub: esc([a.frase, quandoFoiAviso(a.em)].filter(Boolean).join(' · ')),
      acao: a.acoes?.[0] ? `<button type="button" class="vc-sec vv-aviso-acao" data-aviso-curto-sino="${esc(a.em)}">${esc(a.acoes[0].rotulo)}</button>` : '' })).join('')}</ul>`);
    if (ultimo) partes.unshift(`<div class="vv-aviso-vazio vv-aviso-ultimo"><b>Nada novo</b><p>O último aviso foi este:</p></div><ul>${notifLinha(ultimo)}</ul>`);
    else if (!novas && curtoLinha && partes.length) partes.unshift(`<div class="vv-aviso-vazio vv-aviso-ultimo"><b>Nada novo</b><p>O último aviso foi este:</p></div><ul>${curtoLinha}</ul>`);
    if (anteriores.length) partes.push(`<h3>${ultimo ? 'Anteriores' : 'Notificações'}</h3><ul>${anteriores.map(notifLinha).join('')}</ul>`);
    const resumo = pend.length ? `${pend.length} ${pend.length === 1 ? 'pede ação' : 'pedem ação'}` : novas ? `${novas} ${novas === 1 ? 'notificação nova' : 'notificações novas'}` : 'Nada novo';
    const vazio = partes.length ? '' : `<div class="vv-aviso-vazio"><b>Nada novo</b><p>Quando uma entrega sua estiver perto do prazo, um planejamento esperar você ou alguém mencionar você, o aviso aparece aqui.</p></div>`
      + (curtoLinha ? `<h3>Último aviso</h3><ul>${curtoLinha}</ul>` : '');
    const centro = typeof irParaSalaEscritorio === 'function' && (pend.length || doCliente.length);
    return `<div class="vv-avisos-cab"><div><h2 id="vv-avisos-titulo">Avisos</h2><small>${esc(resumo)}</small></div>
        ${partes.length ? `<button type="button" class="vc-sec vv-aviso-lidos" data-aviso-lidos${novas ? '' : ' disabled title="Tudo já foi lido"'}>Marcar como lidos</button>` : ''}
        <button type="button" class="vc-ico vv-aviso-x" data-aviso-fechar aria-label="Fechar os avisos" title="Fechar (Esc)">${IC_AVISO.fechar}</button></div>
      <div class="vv-avisos-corpo">${partes.join('') || vazio}</div>
      ${centro ? '<div class="vv-avisos-pe"><button type="button" class="vc-sec" data-aviso-centro>Centro de Operação</button></div>' : ''}`;
  }
  function posicionarAvisos(p) {
    const b = hud.querySelector('[data-ferr="avisos"]'), r = b?.getBoundingClientRect?.();
    if (!r || !r.width || innerWidth < 600) { p.style.top = ''; p.style.right = ''; return; }
    p.style.top = Math.round(r.bottom + 8) + 'px'; p.style.right = Math.max(8, Math.round(innerWidth - r.right)) + 'px';
  }
  function pintarAvisos() {
    const p = hud.querySelector('.vv-avisos-painel'); if (!p) return;
    const html = avisosHtml(); if (p.dataset.html === html) return; p.dataset.html = html;
    const corpo = p.querySelector('.vv-avisos-corpo'), rolagem = corpo ? corpo.scrollTop : 0;
    p.innerHTML = html;
    const novo = p.querySelector('.vv-avisos-corpo'); if (novo) novo.scrollTop = rolagem;
  }
  function fecharAvisos(devolverFoco = false) {
    const p = hud.querySelector('.vv-avisos-painel'); if (!p) return false;
    p.remove(); document.removeEventListener('pointerdown', foraDosAvisos, true);
    if (curtosNaoVistos().length) { marcarCurtosVistos(); pintarSelosDeAviso(); } // o sino abriu: os que chegaram foram vistos
    const b = hud.querySelector('[data-ferr="avisos"]'); b?.setAttribute('aria-expanded', 'false');
    if (devolverFoco) b?.focus?.();
    return true;
  }
  function foraDosAvisos(e) { if (!e.target.closest?.('.vv-avisos-painel, [data-ferr="avisos"], .vv-cel-mais')) fecharAvisos(); }
  function abrirAvisos() {
    if (fecharAvisos()) return; // o sino abre e fecha
    hud.querySelector('.vv-avisos-menu')?.remove();
    const p = document.createElement('section');
    p.className = 'vv-avisos-painel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-labelledby', 'vv-avisos-titulo');
    hud.append(p); pintarAvisos(); posicionarAvisos(p);
    hud.querySelector('[data-ferr="avisos"]')?.setAttribute('aria-expanded', 'true');
    p.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fecharAvisos(true); } });
    p.addEventListener('click', (e) => {
      const x = e.target.closest('button'); if (!x) return;
      if (x.hasAttribute('data-aviso-fechar')) { fecharAvisos(true); return; }
      if (x.dataset.avisoGrupo) { const k = x.dataset.avisoGrupo; if (grupoAberto.has(k)) grupoAberto.delete(k); else grupoAberto.add(k); pintarAvisos(); p.querySelector(`[data-aviso-grupo="${CSS.escape(k)}"]`)?.focus(); return; }
      if (x.hasAttribute('data-aviso-lidos')) { marcarCurtosVistos(); Promise.resolve(fn('marcarNotificacoesLidas')?.()).finally(() => { pintarAvisos(); pintarSelosDeAviso(); }); return; }
      fecharAvisos();
      if (x.dataset.avisoPlano) chamar('abrirPlanejamento', x.dataset.avisoPlano);
      else if (x.dataset.avisoPeca) chamar('pljAbrirPeca', x.dataset.avisoPeca, x.dataset.quadro);
      else if (x.dataset.avisoNotif) chamar('abrirDoNotificacao', x.dataset.avisoNotif, x.dataset.item);
      else if (x.dataset.avisoCurtoSino) { try { (globalThis.AVISOS_CURTOS_NO_SINO || []).find((a) => a.em === x.dataset.avisoCurtoSino)?.acoes?.[0]?.fazer?.(); } catch { /* a ação falhou */ } }
      else if (x.hasAttribute('data-aviso-centro')) chamar('irParaSalaEscritorio', 'operacao');
    });
    setTimeout(() => document.addEventListener('pointerdown', foraDosAvisos, true), 0);
    (p.querySelector('.vv-aviso-acao') || p.querySelector('[data-aviso-fechar]'))?.focus?.();
    // Relê as notificações: o painel se repinta quando chegam.
    Promise.resolve(fn('carregarNotificacoes')?.()).then(() => pintarAvisos(), () => {});
  }
  const curtosNaoVistos = () => (Array.isArray(globalThis.AVISOS_CURTOS_NO_SINO) ? globalThis.AVISOS_CURTOS_NO_SINO.filter((a) => !a.lido) : []);
  const marcarCurtosVistos = () => { for (const a of globalThis.AVISOS_CURTOS_NO_SINO || []) a.lido = true; };
  // Aviso curto que foi direto para o sino (vybe-core.js): o número acende na hora.
  document.addEventListener?.('vybe:aviso-no-sino', () => { pintarSelosDeAviso(); const p = hud.querySelector('.vv-avisos-painel'); if (p && !p.contains(document.activeElement)) pintarAvisos(); });
  function pintarSelosDeAviso() {
    const n = naoLidasDoPainel() + avisosPlanejamento() + curtosNaoVistos().length, el = hud.querySelector('#vv-badge-avisos'), b = hud.querySelector('[data-ferr="avisos"]');
    if (el) { el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n); }
    b?.setAttribute('aria-label', n ? `Avisos · ${n} para ver` : 'Avisos');
  }
  // ---------- Celular (fase 3d, quadro 47) ----------
  // No celular o topo fica com busca, avisos e conta; a barra de baixo tem cinco lugares (Hoje, Produção, Criar no meio,
  // Conversas e Mais). O "Mais" junta tudo o que saiu da vista: as outras ferramentas do topo, a voz fora de uma sala, as
  // vistas do mundo e os outros módulos do dock, com os submenus de cada setor. Cada item chama o MESMO botão de antes
  // (cadeado, aviso e destino iguais): nenhuma função sai da tela, só muda de lugar.
  function noCelular() { return typeof matchMedia === 'function' && matchMedia('(max-width:600px)').matches; }
  const FERR_NO_TOPO_CEL = ['busca', 'avisos', 'conta'];
  const NA_BARRA_CEL = ['hoje', 'criar', 'setor:producao'];
  function fecharMaisCel(devolverFoco = false) {
    const m = hud.querySelector('.vv-cel-mais'); if (!m) return false;
    m.remove(); document.removeEventListener('pointerdown', foraDoMaisCel, true);
    const b = hud.querySelector('[data-cel="mais"]'); b?.setAttribute('aria-expanded', 'false');
    if (devolverFoco) b?.focus?.();
    return true;
  }
  function foraDoMaisCel(e) { if (!e.target.closest?.('.vv-cel-mais, [data-cel="mais"]')) fecharMaisCel(); }
  function maisCelHtml(origem) {
    const iconeDe = (b) => b.querySelector('svg')?.outerHTML || '';
    const item = (orig, nome) => {
      const i = origem.push(orig) - 1, trancado = orig.classList.contains('trancado');
      return `<button type="button" class="vv-cel-item${trancado ? ' trancado' : ''}" data-cel-orig="${i}"${orig.getAttribute('aria-pressed') === 'true' ? ' aria-pressed="true"' : ''}${orig.disabled ? ' disabled' : ''}>${iconeDe(orig)}<span>${esc(nome)}</span>${trancado ? '<i class="vv-cel-cadeado" aria-label="só os donos">' + svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>') + '</i>' : ''}</button>`;
    };
    const grade = (lista) => `<div class="vv-cel-grade">${lista.join('')}</div>`;
    // Quadro "No celular" (moodboard, 12/11/2026): a folha que sobe com "Ferramentas e sala" numa grade de quatro, a vista
    // do mundo em pílula, os favoritos em fichas e os setores, um ícone cada (o setor abre a visão geral com os módulos dele).
    const partes = [];
    const ferr = [...hud.querySelectorAll('.vv-ferramentas [data-ferr], .vv-ferramentas [data-boletim]')]
      .filter((b) => !FERR_NO_TOPO_CEL.includes(b.dataset.ferr) && !b.hidden && (b.dataset.ferr !== 'camadas' || body.classList.contains('mundo-centro')));
    // A voz fora de uma sala: o cartão do dock só tem Salas e Entrar; o resto do dock vem para cá.
    const dock = faixaDock.querySelector('.vq-cartao') ? [...faixaDock.querySelectorAll('[data-dock-extra]')] : [];
    const curto = (b) => (b.querySelector('.vv-ferr-nome, .vv-mais-nome')?.textContent || b.getAttribute('aria-label') || b.textContent).trim().replace(/ da Vybe$| dos agentes$| do VYBES$| da equipe$/, '');
    const curtoDock = { audio: 'Áudio', ouvir: 'Silenciar', musica: 'Música', tv: 'TV' };
    if (ferr.length || dock.length) partes.push(`<h3>Ferramentas e sala</h3>${grade([...ferr.map((b) => item(b, curto(b))), ...dock.map((b) => item(b, curtoDock[b.dataset.dock] || b.dataset.nome || b.title))])}`);
    const vistas = [...hud.querySelectorAll('.vv-vistas [data-vista]')];
    if (vistas.length) partes.push(`<div class="vv-cel-linha"><h3>Vista do mundo</h3><span class="v2n-seg">${vistas.map((b) => { const i = origem.push(b) - 1; return `<button type="button" data-cel-orig="${i}" aria-pressed="${b.getAttribute('aria-pressed') === 'true'}">${b.dataset.vista === 'predio' ? 'Prédio' : 'Cidade'}</button>`; }).join('')}</span></div>`);
    const favs = [...hud.querySelectorAll('.vv-trilho-fav [data-fav-ir]')];
    if (favs.length) partes.push(`<div class="vv-cel-linha"><h3>Favoritos</h3><span class="vv-cel-fichas">${favs.map((b) => { const i = origem.push(b) - 1; return `<button type="button" class="v2n-chip" data-cel-orig="${i}">${esc(b.querySelector('span')?.textContent.trim() || b.title)}</button>`; }).join('')}</span></div>`);
    const setores = [];
    for (const b of hud.querySelectorAll('.vv-trilho > [data-trilho]')) {
      const id = b.dataset.trilho; if (NA_BARRA_CEL.includes(id) || b.hidden || b.classList.contains('trancado')) continue;
      setores.push(item(b, b.querySelector('span')?.textContent.trim() || b.getAttribute('aria-label') || id));
    }
    if (setores.length) partes.push(`<h3>Setores</h3>${grade(setores)}`);
    return `<div class="vv-cel-mais-cab"><h2 id="vv-cel-mais-titulo">Mais</h2><button type="button" class="vc-ico" data-cel-fechar aria-label="Fechar" title="Fechar (Esc)">${svg('<path d="M6 6l12 12M18 6 6 18"/>')}</button></div>
      <div class="vv-cel-mais-corpo">${partes.join('')}</div>`;
  }
  // O cartão das salas no celular, aberto pelo Voz da barra de baixo (quadro 28). Fecha com toque fora, Esc ou ao
  // entrar numa chamada (aí o dock da chamada fica à vista por conta própria).
  function vozCelAberta() { return body.classList.contains('cel-voz-aberta'); }
  function abrirVozCel(abrir) {
    body.classList.toggle('cel-voz-aberta', abrir);
    hud.querySelector('[data-cel="voz"]')?.setAttribute('aria-expanded', String(abrir));
    document.removeEventListener('pointerdown', foraDaVozCel, true);
    if (abrir) setTimeout(() => document.addEventListener('pointerdown', foraDaVozCel, true), 0);
    pintarDock();
  }
  function foraDaVozCel(e) { if (!e.target.closest?.('.vv-dock-salas-faixa, [data-cel="voz"], .vq-barra-salas, .vv-salas')) abrirVozCel(false); }
  document.addEventListener?.('keydown', (e) => { if (e.key === 'Escape' && vozCelAberta()) { abrirVozCel(false); hud.querySelector('[data-cel="voz"]')?.focus?.(); } });
  function usarCelular(qual) {
    if (qual === 'conversas') { fecharMaisCel(); usarTrilho('conversas'); return; }
    if (qual === 'voz') {
      fecharMaisCel();
      if (!body.classList.contains('dock-cartao')) { faixaDock.querySelector('[data-dock="salas"]')?.click(); return; }
      abrirVozCel(!vozCelAberta());
      if (vozCelAberta()) faixaDock.querySelector('[data-dock="entrar"], [data-dock="salas"]')?.focus?.();
      return;
    }
    if (qual !== 'mais' || fecharMaisCel(true)) return;
    fecharSetor(); fecharAvisos();
    const origem = [], m = document.createElement('section');
    m.className = 'vv-cel-mais'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-labelledby', 'vv-cel-mais-titulo');
    m.innerHTML = maisCelHtml(origem);
    hud.append(m);
    hud.querySelector('[data-cel="mais"]')?.setAttribute('aria-expanded', 'true');
    m.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.stopPropagation();
      if (b.hasAttribute('data-cel-fechar')) { fecharMaisCel(true); return; }
      const orig = origem[Number(b.dataset.celOrig)]; if (!orig) return;
      fecharMaisCel();
      orig.click();
    });
    m.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fecharMaisCel(true); } });
    setTimeout(() => document.addEventListener('pointerdown', foraDoMaisCel, true), 0);
    m.querySelector('.vv-cel-item')?.focus?.();
  }
  // Ao passar para o computador (girar o tablet, abrir a janela), o "Mais" do celular sai.
  if (typeof addEventListener === 'function') addEventListener('resize', () => { if (!noCelular()) fecharMaisCel(); });
  // O "Mais" fecha com clique fora e com Esc.
  document.addEventListener?.('pointerdown', (e) => { const m = hud.querySelector('.vv-mais-menu[open]'); if (m && !m.contains(e.target)) m.removeAttribute('open'); }, true);
  document.addEventListener?.('keydown', (e) => { const m = e.key === 'Escape' && hud.querySelector('.vv-mais-menu[open]'); if (m) { m.removeAttribute('open'); e.stopPropagation(); } }, true);
  function usarFerramenta(id) {
    hud.querySelector('.vv-mais-menu[open]')?.removeAttribute('open'); // escolher algo do "Mais" fecha o menu
    if (id === 'voz' && hud.querySelector('[data-ferr="voz"]')?.classList.contains('entrar') && !body.classList.contains('ver-voz')) entrarPeloTopo();
    if (id === 'agenda' || id === 'voz') { abrirDaDireita(id); return; }
    if (id === 'musica') { abrirMusica(!body.classList.contains('musica-aberta')); return; }
    if (id === 'mic') { fn('alternarMidiaEscritorio')?.('audio')?.finally?.(pintarChamada); return; }
    if (['busca', 'avisos', 'conta'].includes(id)) fecharJanelasDoTopo(id);
    if (id !== 'ajuda') window.VybeTutorial?.dica?.('ferr:' + id);
    if (id === 'busca') document.querySelector('[data-open-spotlight]')?.click();
    else if (id === 'camadas') mostrarCamadas();
    else if (id === 'notas') chamar('abrirNotas');
    else if (id === 'ajuda') window.VybeTutorial?.ajuda?.();
    else if (id === 'conversa') { if (window.VybeConversa?.aberto?.()) window.VybeConversa.fechar(); else window.VybeConversa?.abrir?.('conversa'); }
    else if (id === 'conta') alternarMenuConta();
    else if (id === 'avisos') abrirAvisos();
  }
  // Uma janela por vez no topo (quadro 09): a busca, os avisos e o menu da conta não ficam um por cima do outro.
  function fecharJanelasDoTopo(menos) {
    if (menos !== 'busca') document.querySelector('.spotlight-dialog[open]')?.close?.();
    if (menos !== 'avisos') fecharAvisos();
    if (menos !== 'conta') hud.querySelector('.vv-menu-conta')?.remove();
  }
  document.addEventListener?.('vybe:janela-topo', (e) => fecharJanelasDoTopo(e.detail?.qual));
  // O número do sino: notificações não lidas (o total do servidor; o ponto antigo do cabeçalho não tem número) e o que
  // os planejamentos e clientes pedem. Com o painel aberto, ele se atualiza junto.
  setInterval(() => { pintarSelosDeAviso(); const p = hud.querySelector('.vv-avisos-painel'); if (p && !p.contains(document.activeElement)) pintarAvisos(); }, 3000);

  function mostrarCliente(nome) {
    const c = naTela.find((x) => x.nome === nome) || clientesDoMundo().find((x) => x.nome === nome); if (!c) return;
    const p = placa();
    const base = mundo?.acharNaBase?.(c.nome);
    const chave = norm(c.nome).toLowerCase();
    const pecas = (typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : [])
      .filter((d) => { const cl = typeof clientesDoItem === 'function' ? clientesDoItem(d) : [d.cliente]; return cl.some((x) => norm(x).toLowerCase() === chave) && situacaoDaPeca(d) !== 'concluida'; })
      .map((d) => ({ d, sit: situacaoDaPeca(d), ref: d.veiculacao_iso || d.prazo_iso || '' }))
      .sort((a, b) => (a.sit === 'atrasada' ? 0 : 1) - (b.sit === 'atrasada' ? 0 : 1) || (a.ref || '9').localeCompare(b.ref || '9'));
    const cnpj = base?.cnpj ? base.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';
    // ===== Cartão da loja pelo quadro "Centro" do moodboard (Paulo, 12/11/2026: "eu aprovei o DEPOIS") =====
    // Cabeçalho na cor do cliente (nome, ramo e endereço), três números (atrasadas, para aprovar, a fazer), a linha
    // "N em aberto" que abre no lugar com as peças, e embaixo quem cuida, o cérebro e "Abrir o cliente".
    const endereco = base ? `${base.endereco || ''}${base.bairro ? ' · ' + base.bairro : ''}${!['rua', 'numero'].includes(base.onde) ? ' · posição aproximada' : ''}` : 'sem endereço na base';
    const num = (k, rot, ruim, atraso = 0) => `<p class="${!(c.por[k] > 0) ? 'quieto' : ruim ? 'ruim' : ''}"><b><span class="v2-num" style="animation-delay:${atraso}s">${n0(c.por[k] || 0)}</span></b><small>${rot}</small></p>`;
    const extras = [c.por.hoje ? `${n0(c.por.hoje)} ${c.por.hoje === 1 ? 'sai' : 'saem'} hoje` : '', c.por.ajuste ? `${n0(c.por.ajuste)} em ajuste` : '', c.por.briefing ? `${n0(c.por.briefing)} sem briefing` : ''].filter(Boolean).join(' · ');
    const quem = [...new Map(pecas.flatMap((x) => [...(x.d.responsavel_nomes || []), x.d.responsavel_nome, x.d.responsavel].filter((n) => typeof n === 'string' && n.trim()).map((n) => [n, n]))).values()].slice(0, 3);
    const aberto = mostrarCliente.aberto === c.nome;
    p.innerHTML = `<div class="v2m-loja" style="--c:${esc(c.cor || '#3B5BA9')}">
      <div class="v2m-loja-cab"><p><b>${esc(c.nome)}</b><span>${esc(c.segmento || 'Cliente ativo')} · ${esc(endereco)}</span></p><button type="button" class="v2n-x" data-fechar aria-label="Fechar a loja">${svg('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div>
      ${base ? `<p class="v2n-sub v2m-cnpj">${esc(base.razao || '')}${cnpj ? ' · CNPJ ' + esc(cnpj) : ''}</p>` : ''}
      <div class="v2m-n3">${num('atrasada', 'atrasadas', true)}${num('aprovar', 'para aprovar', false, .12)}${num('fazer', 'a fazer', false, .24)}</div>
      <div class="v2-abre v2m-abertas" aria-expanded="${aberto}"><div class="v2n-lin"><button type="button" class="v2m-abre-btn" data-loja-abre="${esc(c.nome)}" aria-expanded="${aberto}"${pecas.length ? '' : ' disabled'}><b>${plural(c.total, 'em aberto', 'em aberto')}</b>${extras ? `<span class="v2n-sub">${esc(extras)}</span>` : ''}</button><button type="button" class="v2n-btn s" data-trilho="criar">Nova demanda</button></div>
        <div class="v2-mais"><div><div class="v2m-pecas">${pecas.slice(0, 8).map((x) => linhaDemanda(x.d, { ref: x.ref, sit: x.sit })).join('')}${pecas.length > 8 ? `<p class="v2n-sub">+ ${n0(pecas.length - 8)} no cliente</p>` : ''}${window.VybeClientePlaca?.html(c.nome) || ''}</div></div></div></div>
      <div class="v2m-loja-pe">${quem.length ? `<span class="v2n-avs" title="${esc(quem.join(', '))}">${quem.map((n, i) => `<span class="v2n-av${i === quem.length - 1 ? ' v2-pop' : ''}">${esc(iniciais(n))}</span>`).join('')}</span>` : '<span></span>'}
        ${typeof abrirModalCerebroCliente === 'function' ? `<button type="button" class="v2n-btn" data-cerebro-cliente="${esc(c.nome)}" title="Sinapses do cérebro do cliente">Cérebro</button>` : ''}<button type="button" class="v2n-btn k" data-abrir-cliente="${esc(c.nome)}">Abrir o cliente</button></div>
    </div>`;
    p.hidden = false; ajustarAreaLivre(); window.VybeClientePlaca?.ligar(p); window.VybeTutorial?.dica?.('cliente');
    mundo?.focarCliente(nome);
    pintarLegendaCidade(naTela, c.nome);
  }
  // ---------- Hora do mundo: automático (hora real da Bahia), dia, noite ou uma hora escolhida ----------
  // A escolha é de cada pessoa e fica no navegador dela (conveniência; sem servidor).
  const CHAVE_HORA = 'vybe.mundo.hora';
  const lerHora = () => { try { const v = localStorage.getItem(CHAVE_HORA); return v === null || v === 'auto' ? 'auto' : Number(v); } catch { return 'auto'; } };
  const textoHora = (h) => `${Math.floor(h)}h${h % 1 ? '30' : ''}`;
  function pintarHora() {
    const el = hud.querySelector('#vv-hora'); if (!el) return;
    const h = lerHora(), barra = el.querySelector('input'), saida = el.querySelector('output');
    el.querySelectorAll('[data-hora-modo]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.horaModo === (h === 'auto' ? 'auto' : h === 12 ? 'dia' : h === 22 ? 'noite' : ''))));
    if (h !== 'auto') { barra.value = String(h); saida.textContent = textoHora(h); } else saida.textContent = 'agora';
    el.querySelector('.vv-hora-dica').textContent = h === 'auto' ? 'Automático segue a hora real da Bahia.' : 'Só no seu navegador. "Automático" volta à hora real.';
  }
  function escolherHora(h) {
    try { localStorage.setItem(CHAVE_HORA, h === 'auto' ? 'auto' : String(h)); } catch { /* sem armazenamento: vale até recarregar */ }
    mundo?.definirHora?.(h === 'auto' ? null : h); pintarHora();
  }
  function abrirHora(abrir) {
    const el = hud.querySelector('#vv-hora'), bt = hud.querySelector('[data-ctl="hora"]'); if (!el) return;
    const sim = abrir ?? el.hidden; el.hidden = !sim; bt?.setAttribute('aria-expanded', String(sim)); if (sim) pintarHora();
  }
  hud.addEventListener('input', (e) => { if (e.target.matches?.('#vv-hora input[type="range"]')) escolherHora(Number(e.target.value)); });
  document.addEventListener('click', (e) => { if (!e.target.closest?.('.vv-controles')) abrirHora(false); });
  function fecharPlaca() { placa().hidden = true; ajustarAreaLivre(); }

  hud.addEventListener('click', (e) => {
    // Estrela do dock: favorita sem abrir o item em que ela está.
    const fav = e.target.closest?.('.vv-trilho [data-fav]'); if (fav) { e.preventDefault(); alternarFavorito(fav.dataset.fav); return; }
    const favIr = e.target.closest?.('[data-fav-ir]'); if (favIr) { irAoFavorito(favIr.dataset.favIr); return; }
    const b = e.target.closest('button, tr[data-agente]'); if (!b) return;
    // Andar aberto por baixo dos HUDs: outro andar no elevador entra nele; trocar de vista, voltar à lista
    // de andares, fechar o painel ou ir a outro lugar do trilho sai do andar (decorando, a edição decide).
    if (andarAberto && !window.VybeDecorar?.aberto?.()) {
      if (b.dataset.andar && b.dataset.andar !== andarAbertoId) abrirAndarVoxel(b.dataset.andar);
      else if (b.dataset.vista || b.dataset.ctl === 'tudo' || b.hasAttribute('data-voltar') || ['centro', 'predio', 'agentes', 'jogos'].includes(b.dataset.trilho)
        || b.dataset.visaoSetor || (b.dataset.submodulo && b.closest('.vv-trilho'))) fecharAndarVoxel(false);
    }
    if (b.hasAttribute('data-trilho-recolher')) { alternarDock(); return; }
    if (b.dataset.cel) { usarCelular(b.dataset.cel); return; }
    if (b.classList.contains('trancado') && b.closest('.vv-trilho')) { avisarTrancado(b); return; }
    if (b.hasAttribute('data-ver-como-sair')) { definirVerComo(''); return; }
    // Setor no dock largo (Paulo, 08/11/2026 e 09/11/2026: "quando eu clico em produção, além de abrir a visão geral já
    // devia abrir os submenus"): o setor abre a visão geral E os submenus juntos. Clicar nele de novo, já na visão geral
    // dele, recolhe; a setinha só abre/fecha a lista. Outro item do dock (Hoje, Agentes…) recolhe os submenus.
    if (dockLargo() && b.closest('.vv-trilho') && b.dataset.trilho) {
      if (b.dataset.trilho.startsWith('setor:')) {
        const aberto = b.getAttribute('aria-expanded') === 'true', seta = e.target.closest('.vv-trilho-seta');
        if (seta) { expandirSetor(aberto ? '' : b.dataset.trilho); return; }
        if (aberto && window.VybeSetor?.aberto?.() === b.dataset.trilho) { expandirSetor(''); return; }
        expandirSetor(b.dataset.trilho);
      } else if (!b.classList.contains('criar')) expandirSetor('');
    }
    if (b.dataset.visaoSetor) { abrirVisaoSetor(b.dataset.visaoSetor); return; }
    if (b.dataset.submodulo && b.closest('.vv-trilho')) { usarTrilho(b.dataset.submodulo); marcarTrilho(b.dataset.submodulo); return; }
    if (selecionarSemana(b)) return;
    if (b.dataset.atencaoCliente) { mostrarPendencias(b.dataset.atencaoCliente); return; }
    if (b.dataset.gargalo) { mostrarPendencias('', b.dataset.gargalo); return; }
    if (b.dataset.hojeAcao) { acaoDoHoje(b.dataset.hojeAcao, b.dataset.valor); return; }
    // O menu, as ferramentas e as placas funcionam sem o 3D; só vista, controles, andares e o mapa do CRM precisam dele.
    if (b.dataset.trilho) { usarTrilho(b.dataset.trilho, b); return; }
    if (!mundo && (b.dataset.vista || b.dataset.ctl || b.dataset.andar || b.dataset.crmVer || b.hasAttribute('data-voltar'))) return;
    if (b.dataset.ferr) { usarFerramenta(b.dataset.ferr); return; }
    if (b.dataset.visaoHoje) { trocarVisaoHoje(b.dataset.visaoHoje); return; }
    if (b.dataset.criacaoPessoa) { if (souDono()) { definirPessoasHoje([b.dataset.criacaoPessoa]); trocarVisaoHoje('tarefas'); } else chamar('chooseFocusUser', String(b.dataset.criacaoPessoa)); return; }
    if (b.dataset.criacaoAtalho === 'dia-time') { if (souDono()) { definirPessoasHoje(timeDeCriacao()); trocarVisaoHoje('tarefas'); } return; }
    if (b.dataset.criacaoAtalho === 'perguntar' || b.dataset.criacaoAtalho === 'sugestoes') { const alvo = hud.querySelector(b.dataset.criacaoAtalho === 'perguntar' ? '#vv-hoje .v2c-conversa' : '#vv-hoje .v2c-sugestoes'); if (alvo) { alvo.hidden = !alvo.hidden; b.setAttribute('aria-expanded', String(!alvo.hidden)); } return; }
    if (b.dataset.criacaoAtalho === 'ajustes') { chamar('chooseManagerMode', 'demandas'); return; }
    if (b.dataset.criacaoAtalho === 'antigo') { chamar('chooseDaControllerMode'); return; }
    if (b.dataset.criacaoAtalho === 'planejamentos') { usarTrilho('planejamentos'); return; }
    if (b.dataset.abrirGestao !== undefined) { abrirGestao(b.dataset.abrirGestao || ''); return; }
    if (b.dataset.hojeAcao) { acaoDoHoje(b.dataset.hojeAcao, b.dataset.valor); return; }
    if (b.dataset.vista) {
      window.VybeTutorial?.dica?.('vista:' + b.dataset.vista);
      hud.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      body.classList.toggle('mundo-predio', b.dataset.vista === 'predio');
      if (hud.querySelector('.v2m-barra')) pintarLegendaCidade(naTela);
      if (b.dataset.vista === 'predio') { mundo.verPredio(); mostrarAndares(); }
      else { mundo.verCidade(); fecharPlaca(); }
    } else if (b.dataset.ctl) {
      ({ mais: () => mundo.zoom(.7), menos: () => mundo.zoom(1.4), girar: () => mundo.girar90(), tudo: () => { mundo.verCidade(); fecharPlaca(); }, hora: () => abrirHora(), camadas: () => (placa()?.querySelector('.vv-camada') && !placa().hidden ? fecharPlaca() : mostrarCamadas()) })[b.dataset.ctl]();
    } else if (b.dataset.horaModo) {
      escolherHora(b.dataset.horaModo === 'auto' ? 'auto' : b.dataset.horaModo === 'dia' ? 12 : 22);
    } else if (b.dataset.andar) mostrarAndar(b.dataset.andar);
    else if (b.hasAttribute('data-voltar')) mostrarAndares();
    else if (b.hasAttribute('data-fechar')) fecharPlaca();
    else if (b.dataset.modulo) abrirModulo(JSON.parse(b.dataset.modulo));
    else if (b.dataset.abrirNo) mostrarCliente(b.dataset.abrirNo);
    else if (b.dataset.equipe) usarEquipe(b.dataset.equipe);
    else if (b.dataset.cerebroCliente) { const nome = b.dataset.cerebroCliente; chamar('chooseClientMode'); setTimeout(() => { window.VybeTutorial?.dica?.('cerebro-cliente'); try { abrirModalCerebroCliente(nome); } catch (e) { console.error('[mundo] cérebro do cliente', e); } }, 450); }
    else if (b.dataset.perfilAgente) window.VybeAgentes?.abrir?.(b.dataset.perfilAgente);
    else if (b.dataset.agente) { const [an, se] = b.dataset.agente.split('|'); hud.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.vista === 'predio'))); mostrarAgente(an, se); }
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
    else if (b.dataset.chamarOnline) fn('chamarParaSalaEscritorio')?.(b.dataset.chamarOnline);
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

  // Legenda da Cidade (fase 3b, quadro 32): conta os clientes do mapa pela situação, nas mesmas cores dos pinos.
  // Atraso = alguma peça atrasada; atenção = sai hoje, espera aprovação, pediu ajuste ou falta briefing; o resto (inclusive
  // quem não tem peça em aberto, o pino com ✓) está em dia.
  // ===== Barra "Vybelândia" pelo quadro "Centro" do moodboard (Paulo, 12/11/2026) =====
  // No alto do mapa: o nome com Centro/Prédio, a busca de cliente, as três contagens (filtro: clicar acende só aquela
  // situação no mapa) e "Ir à mais apertada". Embaixo à esquerda, a fala do VYBES com "Seu dia" (o Hoje recolhido).
  let filtroCidade = '';
  const grupoDaCidade = (c) => (c.situacao === 'atrasada' ? 'atraso' : ['aprovar', 'ajuste', 'hoje', 'briefing'].includes(c.situacao) ? 'atencao' : 'dia');
  const maisApertada = (lista) => [...(lista || [])].filter((c) => c.por?.atrasada > 0).sort((a, b) => b.por.atrasada - a.por.atrasada || b.total - a.total)[0] || null;
  function pintarLegendaCidade(lista, sel = '') {
    let el = hud.querySelector('.vv-legenda-cidade');
    if (!el) {
      el = document.createElement('div'); el.className = 'vv-legenda-cidade v2m-barra'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Vybelândia: vista, busca e situação dos clientes no mapa');
      el.innerHTML = `<div class="v2m-nome"><h1>Vybelândia</h1><span class="v2n-seg"><button type="button" data-vista="cidade" aria-pressed="true">Centro</button><button type="button" data-vista="predio" aria-pressed="false">Prédio</button></span></div>
        <input type="search" class="v2n-busca" data-busca-loja placeholder="Buscar cliente no mapa" aria-label="Buscar cliente no mapa" list="v2m-lojas"><datalist id="v2m-lojas"></datalist>
        <span class="v2m-conta"></span><button type="button" class="v2n-btn p" data-loja-apertada>Ir à mais apertada</button>`;
      hud.append(el);
      const fala = document.createElement('section'); fala.className = 'v2n-card v2n-fala v2m-fala'; fala.setAttribute('aria-label', 'VYBES sobre os clientes'); hud.append(fala);
    }
    const n = { atraso: 0, atencao: 0, dia: 0 };
    for (const c of lista || []) n[grupoDaCidade(c)]++;
    const item = (k, rot) => `<button type="button" class="v2n-chip" data-filtro-cidade="${k}" aria-pressed="${filtroCidade === k}"${n[k] ? '' : ' disabled'}>${n0(n[k])} ${rot}</button>`;
    const conta = item('dia', 'em dia') + item('atencao', 'em atenção') + item('atraso', 'com atraso');
    const caixa = el.querySelector('.v2m-conta'); if (caixa.vvHtml !== conta) { caixa.innerHTML = conta; caixa.vvHtml = conta; }
    const opcoes = (lista || []).map((c) => `<option value="${esc(c.nome)}"></option>`).join(''), dl = el.querySelector('datalist'); if (dl.vvHtml !== opcoes) { dl.innerHTML = opcoes; dl.vvHtml = opcoes; }
    const top = maisApertada(lista), bt = el.querySelector('[data-loja-apertada]'); bt.disabled = !top; bt.title = top ? `${top.nome}: ${plural(top.por.atrasada, 'peça atrasada', 'peças atrasadas')}` : 'Nenhuma loja com atraso';
    const fala = hud.querySelector('.v2m-fala');
    const frase = !lista?.length ? 'Os clientes aparecem no mapa assim que a produção carregar.'
      : n.atraso ? `${n.atraso === lista.length ? `As <b>${n0(n.atraso)} lojas têm atraso</b>` : `<b>${plural(n.atraso, 'loja tem', 'lojas têm')} atraso</b>`}. A mais apertada é a do <b>${esc(top.nome)}</b>, com ${plural(top.por.atrasada, 'peça', 'peças')}.`
      : n.atencao ? `Nenhuma loja com atraso. <b>${plural(n.atencao, 'pede', 'pedem')} atenção</b> hoje.` : 'Todas as lojas em dia.';
    const falaHtml = `<span class="v2n-ag" aria-hidden="true">V</span><p><span class="v2n-quem">VYBES · Agência inteira</span>${frase}</p><button type="button" class="v2n-btn s" data-seu-dia aria-pressed="${body.classList.contains('v2m-dia')}">Seu dia</button>`;
    if (fala.vvHtml !== falaHtml) { fala.innerHTML = falaHtml; fala.vvHtml = falaHtml; }
    if (sel !== undefined) el.dataset.sel = sel;
    const predio = body.classList.contains('mundo-predio');
    el.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-pressed', String((x.dataset.vista === 'predio') === predio)));
  }
  function filtrarCidade(k) {
    filtroCidade = filtroCidade === k ? '' : k;
    // O filtro só escolhe quais lojas o mapa desenha; as contagens continuam as da cidade inteira.
    const todas = clientesDoMundo(), vistas = filtroCidade ? todas.filter((c) => grupoDaCidade(c) === filtroCidade) : todas;
    naTela = todas; ultimaAssinatura = 'filtro:' + filtroCidade;
    mundo?.definirClientes(vistas, { aoClicar: (alvo) => mostrarCliente(alvo.nome) });
    pintarLegendaCidade(todas);
  }
  hud.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-filtro-cidade],[data-loja-apertada],[data-seu-dia],[data-loja-abre]'); if (!b || b.disabled) return;
    if (b.dataset.filtroCidade) filtrarCidade(b.dataset.filtroCidade);
    else if (b.hasAttribute('data-loja-apertada')) { const t = maisApertada(naTela); if (t) mostrarCliente(t.nome); }
    else if (b.hasAttribute('data-seu-dia')) { body.classList.toggle('v2m-dia'); pintarLegendaCidade(naTela); ajustarAreaLivre(); }
    else if (b.dataset.lojaAbre) { const a = b.closest('.v2-abre'), sim = a.getAttribute('aria-expanded') !== 'true'; a.setAttribute('aria-expanded', String(sim)); b.setAttribute('aria-expanded', String(sim)); mostrarCliente.aberto = sim ? b.dataset.lojaAbre : ''; }
  });
  hud.addEventListener('change', (e) => {
    if (!e.target.matches?.('[data-busca-loja]')) return;
    const t = e.target.value.trim().toLowerCase(); if (!t) return;
    const c = naTela.find((x) => x.nome.toLowerCase() === t) || naTela.find((x) => x.nome.toLowerCase().includes(t));
    if (c) { mostrarCliente(c.nome); e.target.value = ''; }
  });
  hud.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches?.('[data-busca-loja]')) e.target.dispatchEvent(new Event('change', { bubbles: true })); });
  function pintarClientes(forcar = false) {
    if (!mundo) return;
    const lista = clientesDoMundo();
    const assinatura = lista.map((c) => `${c.nome}:${c.total}:${c.situacao}:${(c.status || []).map((s) => s.nome + s.n).join(',')}`).join('|');
    if (!forcar && assinatura === ultimaAssinatura) return;
    ultimaAssinatura = assinatura; naTela = lista;
    mundo.definirClientes(filtroCidade ? lista.filter((c) => grupoDaCidade(c) === filtroCidade) : lista, { aoClicar: (alvo) => mostrarCliente(alvo.nome) });
    pintarLegendaCidade(lista);
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
      { const h = lerHora(); if (h !== 'auto' && Number.isFinite(h)) mundo.definirHora?.(h); }
      if (!fonteAgentes) criarFonte(mundo);
      void carregarAgentes();
      setTimeout(() => aplicarProspeccao(), 1500);
      mundo.aoClicar((alvo) => {
        if (!alvo) return;
        if (alvo.tipo === 'setor') { hud.querySelector('[data-vista="predio"]')?.setAttribute('aria-pressed', 'true'); hud.querySelector('[data-vista="cidade"]')?.setAttribute('aria-pressed', 'false'); mostrarAgente(alvo.andar, alvo.setor); }
        else if (alvo.tipo === 'cliente') mostrarCliente(alvo.nome);
        else if (alvo.tipo === 'vybes') mostrarAgente('terreo', 'orquestrador');
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
          const z = zonas3d()?.[alvo.zona]; if (!z) { c.hidden = true; return; }
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
      // Imagem de móvel (Loja, inventário, troféus; redesign fase 3c, "tudo que é imagem é voxel"): o retrato do móvel
      // em voxel, montado como a Minha sala o monta (retratoDoMovel). Peça de parede ou sem voxel fica com a arte de sempre.
      if (/\/imaging\/furniture\//.test(u.pathname)) {
        img.dataset.voxel = '1';
        const classe = decodeURIComponent(u.pathname.split('/').pop().replace(/\.png$/i, ''));
        img.dataset.movel = classe; // a arte local que entra no erro da imagem (miniaturaLocalEscritorio) é o mesmo móvel
        // A arte do Habbo também não aparece antes disto (redesign r5, quadro 35: no celular dois ícones do Habbo ficavam ~1 s
        // à vista enquanto o módulo do mundo carregava): o CSS esconde toda imagem de móvel do Habbo pelo endereço, na hora
        // em que ela entra na página; só a que nem o voxel monta ganha movel-habbo e volta a aparecer.
        // Enquanto o voxel não chega, a pixel art do Habbo não aparece (Paulo: "nada de pixel art do Habbo"): o lugar da
        // imagem brilha como um carregando. Só um móvel que nem o quarto consegue montar em voxel volta à arte de sempre.
        img.classList.add('movel-esperando');
        const pronto = (url) => { if (img.dataset.movel !== classe) return; img.classList.remove('movel-esperando'); if (!url) img.classList.add('movel-habbo'); if (url && img.isConnected) { img.dataset.habbo = src; img.onerror = null; img.src = url; img.classList.add('movel-voxel'); } };
        // Pulada na fila se a imagem sair de vista antes da vez dela; volta a pedir quando reaparecer (o observador de src).
        const vivo = () => img.isConnected && img.offsetParent !== null && img.dataset.movel === classe;
        modAvatar.retratoDoMovel?.(classe, 96, vivo).then((url) => { if (!url && !vivo()) { img.dataset.voxel = ''; reVer?.observe(img); return; } pronto(url); }, () => pronto(''));
        return;
      }
      const fig = q.get('figure') || '', opcoes = { cabeca: q.get('headonly') === '1', direcao: q.get('direction') || 2 };
      const url = modAvatar.avatarVoxel(fig, opcoes);
      img.dataset.voxel = '1'; img.dataset.habbo = src; img.src = url; img.classList.add('avatar-voxel');
      // Em seguida o retrato fiel (cabelo, roupas, óculos e acessórios do Habbo da pessoa, como no quarto).
      modAvatar.avatarVoxelFiel?.(fig, opcoes).then((fiel) => { if (fiel && img.dataset.habbo === src && img.isConnected) img.src = fiel; }).catch(() => {});
    } catch (e) { console.error('[mundo] avatar', e); }
  }
  // Móvel pulado na fila por estar fora de vista: pede de novo quando a imagem aparecer.
  const reVer = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { reVer.unobserve(e.target); trocarAvatar(e.target); } }) : null;
  function trocarAvataresEm(raiz) { (raiz.querySelectorAll ? raiz.querySelectorAll('img') : []).forEach(trocarAvatar); if (raiz.tagName === 'IMG') trocarAvatar(raiz); }
  new MutationObserver((ms) => { if (!ligado) return; for (const m of ms) { if (m.type === 'attributes') { if (m.target.dataset.voxel === '1' && HABBO.test(m.target.getAttribute('src') || '')) m.target.dataset.voxel = ''; trocarAvatar(m.target); } else m.addedNodes.forEach((n) => n.nodeType === 1 && trocarAvataresEm(n)); } })
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });

  // Móveis: a Loja, o inventário, os troféus e o baú mostram a arte do próprio móvel (mapaDesenharMovel, sem troca).
  // Antes, com o mundo ligado, ela virava um cubo voxel genérico do catálogo; desde que a Minha sala desenha cada móvel
  // pixel a pixel da mesma arte (Paulo, 09/11/2026: "copiar exatamente igual"), o ícone é o que se vê no quarto.

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
  faixaDock.append?.(barra); // a barra das salas abre colada em cima do dock fixo (em qualquer tela, inclusive nos módulos)
  // Altura real da barra (com a música ela pode ir para duas linhas): o player e o aviso de planejamento
  // sobem junto, para nada cobrir a barra (regra do Paulo: nada cobre, nada rola).
  // Mede quando o conteúdo muda (MutationObserver não depende de a página estar desenhando) e quando a largura muda.
  // Fora dos módulos a barra da sala abre no topo pela barra de ícones: não empurra os avisos de baixo.
  function medirBarra() { const embaixo = !barra.hidden && document.body?.classList?.contains?.('mundo-modulo'); const v = (embaixo ? Math.round(barra.offsetHeight) : 0) + 'px'; if (document.body?.style?.getPropertyValue?.('--vv-voz-alto') !== v) document.body?.style?.setProperty?.('--vv-voz-alto', v); }
  if (typeof MutationObserver === 'function') new MutationObserver(medirBarra).observe(barra, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  if (typeof ResizeObserver === 'function') new ResizeObserver(medirBarra).observe(barra);
  let chamarAberto = false, pessoaAberta = null;
  const primeiro = (n) => String(n || '?').split(' ')[0];
  const iniciais = (n) => String(n || '?').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const fn = (nome) => (typeof window[nome] === 'function' ? window[nome] : null);
  // Ícones desenhados da barra das salas (traço, herdam a cor do botão). Nada de emoji (Padrão Vybe).
  const IC = {
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    micOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M9 9v2a3 3 0 0 0 5 2M15 10V6a3 3 0 0 0-6 0M5 11a7 7 0 0 0 11 5.7M19 11a7 7 0 0 1-.6 2.8M12 18v3"/></svg>',
    musica: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    tela: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    chamar: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/></svg>',
    sair: '<svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
    tv: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 2l4 4 4-4M8 21h8"/></svg>',
    salas: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
    cadeado: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    casa: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/></svg>',
    anterior: '<svg viewBox="0 0 24 24"><path d="M6 5v14M19 5l-9 7 9 7z"/></svg>',
    proxima: '<svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l9 7-9 7z"/></svg>',
    tocar: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
    pausar: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
    som: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
    semSom: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
  };
  // Leva a pessoa até uma sala de voz sem sair da tela em que está, como no Discord (Paulo, 09/11/2026: "quando entra na sala
  // de alguém é pra entrar na sala de voz, não é pra mandar pro andar"). A conversa acompanha a sala, preservando a escolha
  // de mute. Uma porta recusada não altera o microfone.
  function irParaSala(zona) {
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    if (!zona) return;
    // Vendo um quarto, trocar de sala leva a vista junto (Paulo, 09/11/2026: "cliquei pra ir pra sala do Vinícius, não era
    // pra visualmente eu ir pra lá também?"). Abrir o quarto já entra na voz dele. Fora de um quarto continua só a voz;
    // sala sem quarto em voxel (Reunião) ou o editor de decoração aberto também mantêm a vista.
    const vendo = String(andarAbertoId || '').startsWith('quarto:') ? andarAbertoId.slice(7) : '';
    if (vendo && vendo !== zona && quartoDaSala(zona) && !window.VybeDecorar?.aberto?.()) { abrirMinhaSala(zona); return; }
    moverParaSala(zona);
    if (e?.zona === zona) e.vozPausada = false;
    const geracaoVoz = e?.geracaoVoz || 0;
    setTimeout(() => { if (e?.zona === zona && (e.geracaoVoz || 0) === geracaoVoz) { e.vozPausada = false; fn('escritorioConversaAutomatica')?.(); } pintarChamada(); }, 700);
    setTimeout(() => { if (e?.zona === zona && (e.geracaoVoz || 0) === geracaoVoz && !e.vozPausada) fn('escritorioSincronizarVoz')?.(); pintarChamada(); }, 2500);
  }
  window.vybesIrParaSala = irParaSala;
  // Música fora de uma sala com som (fase 3b, quadro 44): um balão em cima do dock com o caminho, não só o aviso.
  // Música fora de uma sala com som (quadros 44 e 45): o aviso curto de sempre (canto de cima, mesmo desenho dos outros),
  // com o caminho "Entrar no Lounge", que tem som, em vez de só avisar.
  function musicaForaDaSala() {
    const entrar = () => { irParaSala('lounge'); setTimeout(() => { if (typeof escritorioNaPista === 'function' && escritorioNaPista()) fn('abrirMusicaEscritorio')?.(); pintarDock(); }, 1800); };
    const el = fn('mostrarAvisoCurto')?.({ chave: 'musica-fora', icone: 'musica', titulo: 'A música toca dentro de uma sala',
      frase: 'Entre numa sala com aparelho de som para escolher o que tocar; quem está nela ouve junto. O Lounge tem.',
      acoes: [{ rotulo: 'Entrar no Lounge', principal: true, fazer: entrar }], tempo: 6000 });
    el?.querySelector?.('.vc-acao')?.focus?.({ preventScroll: true });
    if (!el) entrar();
  }
  function minhaSalaDaConta() {
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    if (e?.base?.eu == null) return '';
    return e.base.salas?.find((s) => s.pessoa_id != null && String(s.pessoa_id) === String(e.base.eu))?.id || '';
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
  // O botão da sala de voz na barra de cima diz o estado com palavras (Paulo, 09/11/2026: "precisa ser mais claro quando o
  // microfone tá mudo, quando não tá conectado... tão reclamando de dificuldade de achar onde entra na chamada"):
  //   chamada → verde com o nome da sala; fora da chamada → laranja "Entrar na chamada" (o clique já entra);
  //   conectando → cinza "Conectando…". O microfone fica à vista na chamada, com "Mudo" (vermelho) ou "Ligado" (verde).
  const TOPO_VOZ = { chamada: '', pausada: 'Entrar na chamada', fora: 'Entrar na chamada', conectando: 'Conectando…', outra: 'Voz em outra aba', semvoz: 'Salas' };
  function marcarVozNoTopo(estado = 'semvoz', mic = false, sala = '') {
    const v = hud.querySelector('[data-ferr="voz"]'), m = hud.querySelector('[data-ferr="mic"]'); if (!v || !m) return;
    const naChamada = estado === 'chamada';
    v.classList.toggle('on', naChamada); v.classList.toggle('entrar', estado === 'pausada' || estado === 'fora'); v.classList.toggle('espera', estado === 'conectando');
    v.dataset.estadoVoz = estado;
    v.title = naChamada ? `Na chamada: ${sala}. Abrir a sala de voz` : estado === 'pausada' || estado === 'fora' ? 'Entrar na chamada da sala e ver quem está em cada sala' : 'Sala de voz: quem está em cada sala, microfone, música e TV';
    v.setAttribute('aria-label', v.title);
    let rot = v.querySelector('.vv-voz-nome'); if (!rot) { rot = document.createElement('span'); rot.className = 'vv-voz-nome'; v.append(rot); }
    rot.textContent = naChamada ? String(sala).replace(/^Sala d[aoe]s? /i, '') : TOPO_VOZ[estado] || 'Salas'; rot.hidden = false;
    m.hidden = !naChamada; m.classList.toggle('on', mic); m.classList.toggle('mudo', naChamada && !mic); m.setAttribute('aria-pressed', String(mic));
    let mr = m.querySelector('.vv-mic-rotulo'); if (!mr) { mr = document.createElement('span'); mr.className = 'vv-mic-rotulo'; m.append(mr); }
    mr.textContent = mic ? 'Ligado' : 'Mudo';
    m.title = mic ? 'Microfone ligado: clique para silenciar' : 'Você está mudo: ninguém te ouve. Clique para falar'; m.setAttribute('aria-label', m.title);
  }
  // Clique no botão laranja do topo: já entra (na chamada da sala ou nas salas de voz) e abre a sala.
  function entrarPeloTopo() {
    const e = typeof escritorio !== 'undefined' ? escritorio : null; if (!e) return;
    if (e.conectado && e.vozPausada && fn('escritorioCanal')?.(e.zona)) { e.vozPausada = false; fn('escritorioConversaAutomatica')?.(); }
    else if (!e.conectado && !e.conectando) { pintarChamada.tentou = true; (e.base ? fn('conectarEscritorio') : fn('abrirEscritorio'))?.(); }
    setTimeout(pintarChamada, 600);
  }
  function pintarChamada() {
    const e = typeof escritorio !== 'undefined' ? escritorio : null;
    // A voz continua dentro dos módulos (como no Discord): lá a barra fica compacta.
    const ver = ligado && !body.classList.contains('auth-pending') && Boolean(e);
    const antes = barra.hidden; barra.hidden = !ver;
    if (!ver) return;
    if (antes) window.VybeTutorial?.dica?.('chamada');
    const Z = zonas3d(), eu = String(e.base?.eu || '');
    const nomeZona = (z) => Z[z]?.nome || (z ? (fn('escritorioAmbienteDoQuarto')?.(z)?.nome || 'Sala') : 'Recepção');
    const outros = (e.online || []).filter((o) => String(o.id) !== eu);
    pintarDock();
    if (!e.conectado) {
      const outraAba = Boolean(e.emOutraAba || fn('escritorioOutraAbaConectada')?.());
      marcarVozNoTopo(outraAba ? 'outra' : 'conectando');
      if (!outraAba && !e.conectando && e.base && !e.base.demo && !pintarChamada.tentou && fn('conectarEscritorio')) {
        pintarChamada.tentou = true;
        if (e.microfoneQuer === undefined) e.microfoneQuer = false; // entra calado; liga o microfone quando quiser falar
        fn('conectarEscritorio')();
      }
      pintarChamada.ultimo = '';
      const topo = (titulo, frase, botao = '') => `<div class="sala off"><span class="vz-ponto" aria-hidden="true"></span><span class="vz-onde"><b>${titulo}</b><small>${frase}</small></span>${botao}</div>`;
      barra.innerHTML = outraAba
        ? topo('Voz aberta em outra aba', 'Só uma aba fica na chamada, para não ouvir em dobro', '<button type="button" class="vz-botao principal" data-chamada="assumir">Usar nesta aba</button>')
        : topo('Conectando às salas…', 'Já já você vê quem está em cada sala');
      // Não conectou: tenta de novo sozinho a cada 20 s, sem botão "Entrar" (não existe ficar fora das salas).
      if (pintarChamada.tentou && !e.conectando && !outraAba && !pintarChamada.agendado) { pintarChamada.agendado = true; setTimeout(() => { pintarChamada.agendado = false; if (!e.conectado && !e.conectando) pintarChamada.tentou = false; }, 20000); }
      return;
    }
    // Quem entra no painel já entra na própria sala, online e na chamada dela, com o microfone mudo (Paulo, 09/11/2026:
    // "obrigar a quem entrar já entrar online na sua sala... ver quem tá ON, poder ir fácil e ver as outras salas").
    // Uma vez por carga da página, sem abrir o andar em 3D; depois, sair da chamada ou trocar de sala continua livre.
    // Paulo, 10/11/2026: entra na ÚLTIMA sala em que estava (guardada neste navegador); sem ela, ou se ela não abrir
    // (trancada, sumiu), na própria sala.
    if (!pintarChamada.naMinha) {
      const minha = minhaSalaDaConta(), ultima = fn('escritorioUltimaSala')?.() || '';
      const valida = ultima && fn('escritorioCanal')?.(ultima) && (zonas3d()?.[ultima] || fn('escritorioAmbienteDoQuarto')?.(ultima));
      const s = valida ? ultima : minha;
      if (s) {
        pintarChamada.naMinha = true;
        e.vozPausada = false;
        if (e.zona !== s) {
          moverParaSala(s);
          setTimeout(() => {
            if (e.zona !== s && s !== minha && minha && e.zona !== minha) moverParaSala(minha);
            if (!e.vozPausada) fn('escritorioConversaAutomatica')?.();
            pintarChamada();
          }, 700);
        }
      }
    }
    const canal = fn('escritorioCanal')?.(e.zona);
    const naChamada =Boolean(!e.vozPausada && e.conectado && canal && e.chamada && e.canalChamada === canal);
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
    // Quem ouve você, pelo nome (antes: "Na conversa da sala · 1 pessoa na chamada").
    const nomes = (l) => { const n = l.map((o) => primeiro(o.nome)); return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1]; };
    const naVozL = juntos.filter((o) => participantes.has(String(o.id))), foraL = juntos.filter((o) => !participantes.has(String(o.id)));
    // Quem está mudo (Paulo, 09/11/2026: "quem tá mutado não devia ser mais claro?"): escrito no estado e marcado em cada um.
    const mics = microfonesNaChamada(e), mudosL = naVozL.filter((o) => mics.get(String(o.id)) === false);
    const ouvem = (naVoz ? `Na chamada com ${nomes(naVozL)}${mudosL.length ? ` (${nomes(mudosL)} ${mudosL.length === 1 ? 'está mudo' : 'estão mudos'})` : ''}` : 'Só você na chamada') + (foraDaVoz ? ` · ${nomes(foraL)} ${foraDaVoz === 1 ? 'está' : 'estão'} na sala, fora da chamada` : '');
    marcarVozNoTopo(naChamada ? 'chamada' : e.vozPausada && canal ? 'pausada' : 'semvoz', mic, nomeZona(e.zona));
    // Paulo, 09/11/2026: "muito ruim o HUD que abre das salas"; depois do dock fixo, "pensa se faz sentido os botões".
    // O microfone, Entrar, Sair e a Música ficam só no dock; aqui fica a sala (onde você está e com quem), os controles
    // de dentro da sala (câmera, tela, TV e áudio) e as outras salas. Nada cobre, nada rola.
    // Paulo, 09/11/2026: "os controles de áudio são um botão no dock, não dentro de salas... a tela, o de mutar o que ouve, a
    // câmera também... o SALAS mostra as SALAS, toda". O painel é só a lista das salas (com o estado da chamada em cima);
    // microfone, ouvir, câmera, tela, áudio, música, TV e sair ficam no dock.
    const estadoVoz = naChamada ? ouvem : e.vozPausada && canal ? 'Você está na sala, mas fora da chamada' : estado;
    const html = `${pessoa ? `<div class="vz-pessoa"><b>${esc(pessoa.nome)}</b><small>${esc(nomeZona(pessoa.zona))}</small>
        ${pessoa.zona !== e.zona ? `<span class="vz-linha">${pessoa.zona ? `<button type="button" class="vz-botao principal" data-ir-sala="${esc(pessoa.zona)}">Ir para a sala de ${esc(primeiro(pessoa.nome))}</button>` : ''}<button type="button" class="vz-botao" data-chamar-pessoa="${esc(pessoa.id)}">Chamar para cá</button></span>` : '<small>Está na mesma sala que você.</small>'}</div>` : ''}
      ${salasDeVozHtml({ e, Z, outros, falando, nomeZona, minhaSala, estadoVoz })}`;
    // A barra se atualiza a cada 1,5 s (quem fala, quem entrou). Só redesenha se mudou algo, e guarda a rolagem
    // da lista de salas e o que a pessoa abriu nela (salas vazias, chamar alguém).
    if (html === pintarChamada.ultimo) return;
    const lista = barra.querySelector('.vz-salas'), rolagem = lista ? lista.scrollTop : 0;
    const abertos = [...(barra.querySelectorAll?.('details[open][data-k]') || [])].map((d) => d.dataset.k);
    barra.innerHTML = html; pintarChamada.ultimo = html;
    for (const k of abertos) barra.querySelector(`details[data-k="${k}"]`)?.setAttribute('open', '');
    const nova = barra.querySelector('.vz-salas'); if (nova && rolagem) nova.scrollTop = rolagem;
  }
  // Salas de voz, como no Discord: as salas com gente primeiro (acende quem fala), as vazias recolhidas por andar,
  // cadeado nas trancadas; clicar entra na sala e na conversa dela, sem sair do mapa. Chamar alguém fica recolhido.
  function salasDeVozHtml({ e, Z, outros, falando, nomeZona, minhaSala, estadoVoz = '' }) {
    const mics = microfonesNaChamada(e);
    const planta = mundo?.planta || [], porAndar = new Map();
    for (const [id, z] of Object.entries(Z)) { const k = z.andar || 'outros'; if (!porAndar.has(k)) porAndar.set(k, []); porAndar.get(k).push([id, z]); }
    const nomeAndar = (k) => { const a = planta.find((x) => x.id === k); return a ? (a.nivel === 0 ? 'Térreo' : a.id === 'terraco' ? 'Terraço' : a.nivel + 'º andar') + ' · ' + a.nome.replace(/^Terraço · /, '') : k === 'time' ? 'Salas do time' : 'Outras salas'; };
    const ordem = [...porAndar.keys()].sort((x, y) => (planta.find((a) => a.id === y)?.nivel ?? -1) - (planta.find((a) => a.id === x)?.nivel ?? -1));
    const eu = { id: String(e.base?.eu || ''), nome: 'Você' };
    const trancas = e.trancas instanceof Map ? e.trancas : new Map();
    const linha = ([id, z]) => {
      const aqui = outros.filter((o) => o.zona === id), minha = e.zona === id, tranc = trancas.has(id);
      const gente = [...(minha ? [eu] : []), ...aqui];
      // Quadro "Barra de baixo" (moodboard, 12/11/2026): nome, quem está, os rostos e Entrar; na sala atual, "Dentro".
      const rostos = gente.length ? `<span class="vz-avs" aria-hidden="true">${gente.slice(0, 3).map((o) => `<i class="${falando.has(String(o.id)) ? 'fala' : ''}">${esc(o.id === eu.id ? 'Eu' : iniciais(o.nome))}</i>`).join('')}</span>` : '';
      return `<button type="button" class="vz-sala${minha ? ' minha' : ''}${gente.length ? ' com-gente' : ''}" data-ir-sala="${esc(id)}" ${minha ? 'aria-current="true"' : ''} title="${minha ? 'Você está nesta sala' : 'Entrar nesta sala e na conversa dela'}">
        <span class="ic" aria-hidden="true">${tranc ? IC.cadeado : IC.salas}</span>
        <span class="meio"><b>${esc(z.nome || nomeZona(id))}${tranc ? ' <small>trancada</small>' : ''}</b>${gente.length ? `<span class="gente">${gente.map((o) => { const mudo = mics.get(String(o.id)) === false; return `<i data-voz-pessoa="${esc(o.id)}" class="${falando.has(String(o.id)) ? 'fala' : ''}${mudo ? ' mudo' : ''}" title="${esc(o.nome)}${mudo ? ' (mudo)' : ''}">${esc(o.id === eu.id ? 'Você' : primeiro(o.nome))}${mudo ? ' · mudo' : ''}</i>`; }).join('')}</span>` : `<small>${esc(nomeAndar(z.andar || 'outros'))}</small>`}</span>
        ${rostos}<em>${minha ? 'Dentro' : 'Entrar'}</em></button>`;
    };
    const fora = outros.filter((o) => !o.zona || !Z[o.zona]);
    const temGente = ([id]) => e.zona === id || outros.some((o) => o.zona === id);
    const ocupadas = ordem.flatMap((k) => porAndar.get(k).filter(temGente));
    const vazias = ordem.map((k) => [k, porAndar.get(k).filter((x) => !temGente(x))]).filter(([, l]) => l.length);
    const nVazias = vazias.reduce((n, [, l]) => n + l.length, 0);
    const longe = outros.filter((o) => o.zona !== e.zona);
    return `<div class="vz-salas">
      <div class="vz-salas-topo"><span><b>Salas</b>${estadoVoz ? `<small>${esc(estadoVoz)}</small>` : ''}</span><span class="v2k-pill">${n0(outros.length + 1)} ${outros.length ? 'pessoas' : 'pessoa'} ao vivo</span>
        <button type="button" class="vz-botao v2k-x" data-chamada="fechar" aria-label="Fechar" title="Fechar">${svg('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div>
      ${ocupadas.length ? ocupadas.map(linha).join('') : '<p class="vz-dica">Ninguém nas salas agora.</p>'}
      ${nVazias ? `<div class="vz-rotulo">Vazias agora · ${nVazias}</div>${vazias.map(([, l]) => l.map(linha).join('')).join('')}` : ''}
      ${longe.length ? `<details class="vz-recolhe" data-k="chamar"><summary>Chamar alguém <span>${longe.length}</span></summary>${longe.map((o) => `<div class="vz-online"><span data-voz-pessoa="${esc(o.id)}" class="av${falando.has(String(o.id)) ? ' fala' : ''}">${esc(iniciais(o.nome))}</span><span class="meio"><b>${esc(o.nome)}</b><small>${esc(o.zona && Z[o.zona] ? Z[o.zona].nome : nomeZona(o.zona))}</small></span>
        ${o.zona ? `<button type="button" class="vz-botao" data-ir-sala="${esc(o.zona)}">Ir até</button>` : ''}<button type="button" class="vz-botao" data-chamar-pessoa="${esc(o.id)}">Chamar</button></div>`).join('')}</details>` : ''}
      ${fora.length ? `<p class="vz-dica">${fora.length} na recepção ou fora das salas.</p>` : ''}
      <p class="vz-dica vz-frase">Entrou, o microfone, a câmera e a tela ligam na barra.</p>
      ${minhaSala ? '<div class="v2k-pe"><button type="button" class="vz-botao" data-chamada="decorar-minha">Decorar minha sala</button><span class="v2k-vao"></span></div>' : ''}
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
    else if (c === 'musica') abrirMusica(!body.classList.contains('musica-aberta'));
    else if (c === 'tela') fn('alternarMidiaEscritorio')?.('screen')?.finally?.(() => { pintarChamada(); trazerProPalco(); });
    else if (c === 'camera') fn('alternarMidiaEscritorio')?.('video')?.finally?.(pintarChamada);
    else if (c === 'tv') fn('abrirTvEscritorio')?.(typeof escritorio !== 'undefined' ? escritorio.tvAtual || null : null);
    else if (c === 'reconectar') { const e = typeof escritorio !== 'undefined' ? escritorio : null; pintarChamada.tentou = true; (e?.base ? fn('conectarEscritorio') : fn('abrirEscritorio'))?.(); setTimeout(pintarChamada, 1500); } // a mesma entrada do botão "Entrar no escritório"
    else if (c === 'assumir') { fn('trazerEscritorioParaEstaAba')?.(); setTimeout(pintarChamada, 1500); }
    else if (c === 'chamar') { chamarAberto = !chamarAberto; pessoaAberta = null; pintarChamada(); }
    else if (c === 'sair') { fn('sairChamadaEscritorio')?.({ manual: true })?.finally?.(() => { pintarChamada(); trazerProPalco(); }); chamarAberto = false; pintarChamada(); }
    else if (c === 'entrar-voz') { const e = typeof escritorio !== 'undefined' ? escritorio : null; if (e) { e.vozPausada = false; fn('escritorioConversaAutomatica')?.(); pintarChamada(); } }
    else if (c === 'minha-sala') { const sala = minhaSalaDaConta(); if (sala) irParaSala(sala); }
    else if (c === 'fechar') abrirDaDireita('');
    else if (c === 'decorar-minha') { const sala = minhaSalaDaConta(); abrirDaDireita(''); if (sala) Promise.resolve(abrirMinhaSala(sala)).then(() => { if (!window.VybeDecorar?.aberto?.()) alternarDecorar(); }); }
    else if (b.dataset.pessoa) {
      pessoaAberta = pessoaAberta === b.dataset.pessoa ? null : b.dataset.pessoa; chamarAberto = false;
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
  // A gaveta da peça (#workspace-drawer) nunca ganha a classe "open": ela só existe enquanto está aberta. Sem o id puro
  // aqui, o Esc fechava a gaveta e a tela antiga juntas (quarta rodada, 11/11/2026).
  const POR_CIMA = 'dialog[open], .brief-overlay, #cartao-rapido, .cartao-rapido-fundo, #workflow-modal, #workflow-backdrop, .workspace-drawer.open, #workspace-drawer.open, #workspace-drawer, #notif-caixa, #quem-sou-menu, #notas-janela, details.header-utilities[open] > .header-utilities-menu, .owner-editor, [class*="-overlay"], [class*="-modal"]:not(body)';
  const visivel = (el) => { if (!el.getClientRects?.().length) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > .05; };
  const janelaPorCima = () => [...document.querySelectorAll(POR_CIMA)].filter((el) => !el.closest('#mundo-hud, #mundo') && visivel(el)).pop() || null;
  const FECHAR_JANELA = '[data-fechar], .brief-fechar, [aria-label="Fechar"], [aria-label="Fechar janela"], [aria-label^="Fechar "], .modal-close, .fechar, .close, .fc-close, .workflow-close, .workspace-close, .cr-fechar, .p-draw-close, .manager-command-close, .cadastros-preview-close, .production-sheet-close, .x-fechar, [onclick*="fechar"], [onclick*="close"], [onclick*="Close"]';
  let janelaNoEsc = null;
  // Captura: anota a janela aberta ANTES que o Esc dela rode (senão o Esc fecharia a janela e o módulo juntos).
  window.addEventListener?.('keydown', (e) => { if (e.key === 'Escape') janelaNoEsc = janelaPorCima(); }, true);
  document.addEventListener?.('keydown', (e) => {
    if (!ligado || body.classList.contains('auth-pending')) return;
    const campo = e.target?.closest?.('input, textarea, select, [contenteditable="true"]');
    if (e.key === 'f' && !campo && !e.metaKey && !e.ctrlKey && !e.altKey && body.classList.contains('mundo-modulo')) { alternarTelaCheia(); return; }
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (campo) { campo.blur(); return; }
    if (fecharBaloesAntigos()) { janelaNoEsc = null; return; }
    // Conversa/ferramentas e busca abertas pelo ícone da barra: o foco fica fora delas, então o Esc chega aqui.
    const busca = document.querySelector('dialog.spotlight-dialog[open]');
    if (busca) { busca.close(); janelaNoEsc = null; return; }
    if (window.VybeConversa?.aberto?.()) { window.VybeConversa.fechar(); janelaNoEsc = null; return; }
    if (janelaNoEsc) { // a janela de cima fecha com o próprio Esc; se não fechou, aperta o X dela
      const jan = janelaNoEsc; janelaNoEsc = null;
      setTimeout(() => { if (visivel(jan)) (jan.querySelector(FECHAR_JANELA) || (jan.matches('details > *') ? jan.parentElement.querySelector('summary') : null))?.click(); if (jan.tagName === 'DETAILS' || jan.parentElement?.tagName === 'DETAILS') jan.closest('details')?.removeAttribute('open'); }, 0);
      return;
    }
    if (chamarAberto || pessoaAberta) { chamarAberto = false; pessoaAberta = null; pintarChamada(); return; }
    if (body.classList.contains('ver-agenda') || body.classList.contains('ver-voz')) { fecharDaDireita(); return; }
    if (body.classList.contains('musica-aberta')) { abrirMusica(false); return; }
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
    // Fase 3b (quadro 43): um balão compacto junto dos controles do mapa, que fica à vista e muda na hora; interruptores.
    // A Prospecção também é um interruptor: as etapas do funil (chips) e a legenda só aparecem com ela ligada.
    const pros = camadas.prospeccao && camadas.prospeccao !== 'nenhuma';
    const chave = (k, n, d, ligado, attr) => `<label class="vv-camada"><input type="checkbox" role="switch" ${attr}${ligado ? ' checked' : ''}><span><b>${n}</b><small>${d}</small></span></label>`;
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button>
      <h3>Camadas do mapa</h3>
      ${[['clientes', 'Clientes', 'Pinos com a situação de cada cliente'], ['marcos', 'Marcos e ruas', 'Prefeitura, praças, avenidas'], ['captacoes', 'Captações', 'Vans da Vybe a caminho dos clientes']].map(([k, n, d]) => chave(k, n, d, camadas[k], `data-camada="${k}"`)).join('')}
      ${chave('prospeccao', 'Prospecção (CRM)', 'Empresas de Irecê que ainda não são clientes', pros, 'data-camada-pros')}
      <div class="vv-camada-filtros" role="group" aria-label="Etapa da prospecção"${pros ? '' : ' hidden'}>${FILTROS_PROS.filter(([k]) => k !== 'nenhuma').map(([k, n]) => `<button type="button" class="vv-cb-aba${camadas.prospeccao === k ? ' on' : ''}" aria-pressed="${camadas.prospeccao === k}" data-prospeccao="${k}">${n}</button>`).join('')}</div>
      <div class="vv-cb-legenda"${pros ? '' : ' hidden'}>${Object.entries(ETAPA_NOME).map(([k, n]) => `<span><i style="background:${ETAPA_COR[k]}"></i>${n}</span>`).join('')}</div>
      <p class="vv-dica" id="vv-camada-conta"></p>`;
    p.hidden = false; ajustarAreaLivre();
  }
  // Liga a prospecção num filtro (o último escolhido; da primeira vez, todas) ou desliga; o mapa muda na hora.
  async function escolherProspeccao(filtro) {
    if (filtro !== 'nenhuma') camadas.prosFiltro = filtro;
    camadas.prospeccao = filtro; salvarCamadas();
    const ligada = filtro !== 'nenhuma';
    hud.querySelectorAll('[data-prospeccao]').forEach((x) => { const on = x.dataset.prospeccao === filtro; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    const pl = placa();
    pl?.querySelectorAll('.vv-camada-filtros,.vv-cb-legenda').forEach((x) => { x.hidden = !ligada; });
    const sw = pl?.querySelector('[data-camada-pros]'); if (sw) sw.checked = ligada;
    const conta = hud.querySelector('#vv-camada-conta'); if (conta) conta.textContent = ligada ? 'Carregando…' : '';
    const n = await aplicarProspeccao();
    if (conta) conta.textContent = !ligada ? '' : `${(n || 0).toLocaleString('pt-BR')} empresas neste filtro${n > 900 ? ' (no mapa, as 900 mais perto da Vybe)' : ''}.`;
  }
  hud.addEventListener('change', (e) => {
    if (e.target.closest('[data-camada-pros]')) { escolherProspeccao(e.target.checked ? (camadas.prosFiltro || 'todas') : 'nenhuma'); return; }
    const c = e.target.closest('[data-camada]'); if (!c) return; camadas[c.dataset.camada] = c.checked; salvarCamadas(); aplicarCamadasEtiquetas();
  });
  hud.addEventListener('click', (e) => {
    const b = e.target.closest('[data-prospeccao]'); if (!b) return;
    escolherProspeccao(b.dataset.prospeccao);
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
  const CHAVE_MUSICA_POS = 'vybe.mundo.musica.pos';
  function abrirMusica(sim) {
    body.classList.toggle('musica-aberta', Boolean(sim));
    hud.querySelector('[data-ferr="musica"]')?.setAttribute('aria-expanded', String(Boolean(sim)));
    if (sim) {
      fecharDaDireita(); prepararJanelaMusica();
      // Posição arrastada vale no computador e sempre volta para dentro da tela; no celular o player ocupa a largura.
      const el = document.getElementById('office-musica');
      if (el?.classList.contains('movida')) { if (innerWidth <= 900) el.classList.remove('movida'); else moverMusica(el, parseFloat(el.style.getPropertyValue('--mx')) || 0, parseFloat(el.style.getPropertyValue('--my')) || 0); }
    }
  }
  function prepararJanelaMusica() {
    const el = document.getElementById('office-musica'); if (!el || el.dataset.vvPronto) return;
    el.dataset.vvPronto = '1';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Música da sala');
    const topo = el.querySelector('.ofc-musica-topo'), acoes = topo?.querySelector('span');
    if (acoes && !acoes.querySelector('[data-musica-fechar]')) {
      const x = document.createElement('button'); x.type = 'button'; x.className = 'ofc-x'; x.dataset.musicaFechar = '';
      x.setAttribute('aria-label', 'Fechar o player (a música continua)'); x.title = 'Fechar (a música continua)'; x.textContent = '×';
      x.addEventListener('click', (ev) => { ev.stopPropagation(); abrirMusica(false); });
      acoes.append(x);
    }
    const mini = acoes?.querySelector('[onclick*="minimizarMusicaEscritorio"]');
    if (mini) { mini.textContent = '–'; mini.title = 'Esconder o clipe'; mini.setAttribute('aria-label', 'Esconder o clipe'); }
    try { const pos = JSON.parse(localStorage.getItem(CHAVE_MUSICA_POS) || 'null'); if (pos) moverMusica(el, pos.x, pos.y); } catch { /* sem posição guardada */ }
    topo?.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || ev.target.closest('button')) return;
      const r = el.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      topo.setPointerCapture?.(ev.pointerId); el.classList.add('arrastando');
      const mover = (e) => moverMusica(el, e.clientX - dx, e.clientY - dy);
      const soltar = () => {
        topo.removeEventListener('pointermove', mover); el.classList.remove('arrastando');
        try { localStorage.setItem(CHAVE_MUSICA_POS, JSON.stringify({ x: parseFloat(el.style.getPropertyValue('--mx')), y: parseFloat(el.style.getPropertyValue('--my')) })); } catch { /* sem guardar */ }
      };
      topo.addEventListener('pointermove', mover); topo.addEventListener('pointerup', soltar, { once: true }); topo.addEventListener('pointercancel', soltar, { once: true });
    });
  }
  function moverMusica(el, x, y) {
    const w = el.offsetWidth || 300, h = el.offsetHeight || 200;
    const cx = Math.max(8, Math.min(innerWidth - w - 8, x)), cy = Math.max(8, Math.min(innerHeight - h - 8, y));
    el.style.setProperty('--mx', cx + 'px'); el.style.setProperty('--my', cy + 'px'); el.classList.add('movida');
  }
  // O player some quando a sala não tem música (o Escritório mostra/esconde pelo hidden); o botão Música fica no dock.
  if (typeof setInterval === 'function') setInterval(() => {
    const el = document.getElementById('office-musica');
    const tem = Boolean(el && !el.hidden);
    if (!tem && body.classList.contains('musica-aberta')) abrirMusica(false);
    if (tem) prepararJanelaMusica();
  }, 1500);
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
  const APP_AGENDA = typeof location !== 'undefined' && /^\/agenda\/?$/.test(location.pathname);
  // A volta ao topo vai para o próximo quadro (quarta rodada, 11/11/2026): escrever scrollTop aqui, logo depois de trocar
  // as classes do body, obrigava o navegador a recalcular o estilo da página inteira uma vez a mais (~100 ms) antes da
  // primeira pintura. No quadro, antes de pintar, sai o mesmo recálculo que a pintura faria de qualquer jeito.
  function voltarAoTopoNoQuadro() {
    if (typeof requestAnimationFrame !== 'function') { body.scrollTop = 0; return; }
    if (voltarAoTopoNoQuadro.pedido) return; voltarAoTopoNoQuadro.pedido = true;
    requestAnimationFrame(() => { voltarAoTopoNoQuadro.pedido = false; if (body.classList.contains('mundo-modulo')) body.scrollTop = 0; });
  }
  function sincronizar() {
    if (body.classList.contains('auth-pending')) fonteAgentes?.limpar();
    const gateAberto = !!document.getElementById('mode-gate')?.classList.contains('open');
    const btBoletim = hud?.querySelector('.vv-ferr-boletim'); if (btBoletim) btBoletim.hidden = !window.VybeBoletim?.podeVer?.();
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
    if (chaveModulo !== sincronizar.ultimo) { sincronizar.ultimo = chaveModulo; if (modulo) { voltarAoTopoNoQuadro(); setTimeout(() => { if (body.classList.contains('mundo-modulo') && !body.classList.contains('auth-pending')) window.VybeTutorial?.dica?.('modulo'); }, 900); } }
    if (modulo && !window.VybeSetor?.aberto?.()) marcarTrilhoDoModulo();
    body.classList.toggle('mundo-sobre-escritorio', ligado && (visivel || Boolean(andarAberto) || jogandoAgora));
    body.classList.toggle('mundo', ligado);
    body.classList.toggle('mundo-visivel', visivel);
    body.classList.toggle('mundo-centro', visivel && centroAberto);
    if (visivel) {
      // App Agenda Vybe (/agenda, o que o Mizinho instala no celular): abre direto na Agenda e captações (no celular, no mês,
      // no jeito do Google Agenda), uma vez por carga, sem passar pelo Hoje nem pelo passeio de boas-vindas. O / não muda.
      if (APP_AGENDA && !sincronizar.agenda) { sincronizar.agenda = true; sincronizar.tour = true; setTimeout(() => usarTrilho('agenda'), 300); }
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
    const id = modo === 'foco' ? 'tarefas' : modo === 'controler' ? 'direcao' : modo === 'producao' ? 'agenda' : (modo === 'clientes' || quadro === 'clientes') ? 'clientes' : ['diario', 'performance', 'ai-usage', 'automacoes', 'conta', 'demandas'].includes(quadro) ? quadro : 'gestor';
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
  // Medidor discreto (Paulo, 10/11/2026: "bem otimizado"): com ?medir=1 no endereço (ou mundoVoxel.medir(true)), um
  // canto mostra o tempo de cada quadro, as chamadas de desenho e a nitidez do mundo, para conferir nos notebooks do
  // time. Lê a cada segundo só enquanto está ligado; desligado, nada roda.
  let medidorTimer = 0;
  function medir(sim = true) {
    clearInterval(medidorTimer); medidorTimer = 0; document.getElementById('vv-medidor')?.remove();
    if (!sim) return;
    const el = document.createElement('div'); el.id = 'vv-medidor'; el.className = 'vv-medidor'; el.setAttribute('role', 'status');
    const pintar = () => {
      if (!el.isConnected) document.body.append(el); // a montagem da página pode trocar o body: volta para o canto
      const d = mundo?.desempenho?.();
      el.textContent = d ? `${d.msPorQuadro} ms por quadro · ${d.chamadas} desenhos · ${Math.round(d.triangulos / 1000)} mil triângulos · nitidez ${d.pixelRatio}×` : 'Mundo ainda carregando';
    };
    pintar(); medidorTimer = setInterval(pintar, 1000);
  }
  if (typeof location !== 'undefined' && /[?&]medir=1(&|$)/.test(location.search)) addEventListener('load', () => medir(true), { once: true });
  window.mundoVoxel = { ligar, ligado: () => ligado, medir, irPara: (id) => usarTrilho(id), abrirCentro, fecharCentro, centroAberto: () => centroAberto, planta: plantaDoPredio, estadoDoAgente, atividadeDoAgenteHtml, fonteAgentes: () => fonteAgentes, garantirModulo, situacaoDaPeca, clientesDoMundo, camera: () => mundo?.estado(), projetar: (...a) => mundo?.projetar(...a),
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
    abrirMinhaSala: () => abrirMinhaSala(),
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
    // o dock fixo das salas também: a coluna da Agenda termina acima dele
    const hAviso = alto(aviso), hVoz = alto(voz), hMus = alto(musica), hDock = faixaDock.hidden ? 0 : alto(faixaDock.firstElementChild);
    // A coluna da direita empilha de baixo para cima: voz, aviso, música; a agenda termina acima de tudo.
    const pe = `${hAviso + hVoz}px`;
    if (body.style.getPropertyValue('--vv-pe-voz') !== hVoz + 'px') body.style.setProperty('--vv-pe-voz', hVoz + 'px');
    if (body.style.getPropertyValue('--vv-pe-base') !== pe) body.style.setProperty('--vv-pe-base', pe);
    if (body.style.getPropertyValue('--vv-pe-agenda') !== (hAviso + hVoz + hMus + hDock) + 'px') body.style.setProperty('--vv-pe-agenda', (hAviso + hVoz + hMus + hDock) + 'px');
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
    // Dock largo ou de ícones (escolha da pessoa; no celular sempre a barra de baixo).
    aplicarDock(); addEventListener('resize', aplicarDock);
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
      depois(() => garantirModulo().then((m) => { if (m) ligarCatalogoVoxel(); }));
    }
  }
  // Classe aplicada antes do primeiro desenho, para a tela de módulos não piscar no tema antigo.
  body.classList.toggle('mundo', ligado);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
