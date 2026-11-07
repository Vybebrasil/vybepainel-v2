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
  let ligado = false;
  try { const s = JSON.parse(localStorage.getItem(CHAVE)); if (s && s.ligado === true) ligado = true; } catch { /* sem armazenamento */ }
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
    for (const c of cadastro) mapa.set(chave(c.nome), { nome: norm(c.nome) || c.nome, segmento: c.segmento || '', endereco: c.endereco || '', total: 0, por: {}, situacao: 'concluida' });
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
        if (ORDEM[sit] < ORDEM[c.situacao]) c.situacao = sit;
      }
    }
    return [...mapa.values()].map((c) => ({ ...c, cor: COR[c.situacao], peso: 8 - ORDEM[c.situacao] }));
  }

  // ---------- Montagem ----------
  let mundo = null, carregando = null, ultimaAssinatura = '', naTela = [];
  const raiz = document.createElement('div'); raiz.id = 'mundo';
  raiz.innerHTML = '<canvas aria-label="Mapa de Irecê com o Prédio da Vybe e os clientes"></canvas><div class="mundo-vinheta"></div><div class="mundo-carregando">Montando Irecê…</div>'
    + '<div class="mundo-fonte">Relevo: Terrain Tiles (AWS/Mapzen) · Ruas: © OpenStreetMap · arraste para andar, botão direito ou Shift para girar</div>';
  const hud = document.createElement('div'); hud.id = 'mundo-hud';
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
  const TRILHO = [
    { id: 'hoje', nome: 'Hoje', dica: 'Seu dia', ic: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>') },
    { id: 'tarefas', nome: 'Tarefas', dica: 'Minhas tarefas', ic: svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>') },
    { id: 'criar', nome: 'Criar', dica: 'Cadastros: criar conteúdo ou demanda', acao: true, ic: svg('<path d="M12 5v14M5 12h14"/>') },
    { id: 'gestor', nome: 'Gestor', dica: 'Gestor: prioridades, prazos e capacidade', ic: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>') },
    { id: 'direcao', nome: 'Direção', dica: 'Direção de arte', ic: svg('<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>') },
    { id: 'agenda', nome: 'Agenda', dica: 'Produção e agenda de captações', ic: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>') },
    { id: 'clientes', nome: 'Clientes', dica: 'Clientes', ic: svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>') },
    { id: 'equipe', nome: 'Equipe', dica: 'Equipe: quem está online, conversa, recados, missões, ranking, conquistas e VybeCoins', ic: svg('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c0-2.5 1.5-4.5 4-4.5s3 1.5 3 4.5"/>') },
    { id: 'jogos', nome: 'Jogos', dica: 'Jogos com a equipe: sinuca, xadrez, pôquer, dominó, dama, velha e truco', ic: svg('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 14h.01"/>') },
    { id: 'predio', nome: 'Prédio', dica: 'Prédio da Vybe: setores, agentes e as salas da equipe', ic: svg('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h6M9 11h6M9 15h6"/>') },
    { id: 'perfil', nome: 'Perfil', dica: 'Perfil: nível, VybeCoins, meta da semana, ganhos, conquistas, inventário e números do trabalho', ic: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>') },
    '-',
    { id: 'vybes', nome: 'VYBES', dica: 'Abrir o VYBES', ic: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>') },
  ];
  function chamar(nome, ...a) { return typeof window[nome] === 'function' ? window[nome](...a) : undefined; }
  function marcarTrilho(id) { hud.querySelectorAll('[data-trilho]').forEach((b) => b.toggleAttribute('aria-current', b.dataset.trilho === id)); }
  function usarTrilho(id) {
    const eu = typeof operadorDoTopo === 'function' ? operadorDoTopo() : null;
    const noModulo = body.classList.contains('mundo-modulo');
    if (noModulo && ['hoje', 'predio', 'equipe', 'modulos', 'jogos'].includes(id)) { chamar('voltarAoMenu'); setTimeout(() => usarTrilho(id), 350); return; }
    if (id === 'hoje') { body.classList.remove('mundo-cartoes'); marcarTrilho('hoje'); pintarHoje(); ajustarAreaLivre(); return; }
    if (id === 'modulos') { const abrir = !body.classList.contains('mundo-cartoes'); body.classList.toggle('mundo-cartoes', abrir); marcarTrilho(abrir ? 'modulos' : 'hoje'); ajustarAreaLivre(); return; }
    if (id === 'predio') { marcarTrilho('predio'); hud.querySelector('[data-vista="predio"]')?.click(); return; }
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
  const corStatus = (d, sit) => (typeof managerCalendarStatusColor === 'function' ? managerCalendarStatusColor(d, '') : String(d?.status_color || '').match(/^#[0-9a-f]{3,8}$/i)?.[0]) || COR_SIT(sit || 'fazer');
  function linhaDemanda(d, { ref = '', sit = '' } = {}) {
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
        <span class="vv-demanda-meta">${tagCli}${d.status ? `<span class="vv-demanda-status"><i></i>${esc(d.status)}</span>` : ''}</span>
      </button>
      <span class="vv-demanda-lado">${olho}${quando ? `<time${sit === 'atrasada' ? ' class="atrasada"' : ''}>${esc(quando)}</time>` : ''}</span>
    </div>`;
  }
  let diaEscolhido = '';
  function pintarHoje() {
    const el = hud.querySelector('#vv-hoje'); if (!el || body.classList.contains('mundo-cartoes')) return;
    const fila = minhaFila(), hoje = hojeIso(), agora = new Date();
    const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const h = agora.getHours(), saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const nome = String(fila?.user?.name || fila?.user?.nome || '').split(' ')[0];
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
    const lista = diaEscolhido ? abertas.filter((x) => x.ref === diaEscolhido) : [...atrasadas, ...deHoje];
    const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const item = (x) => linhaDemanda(x.d, { ref: x.ref, sit: x.sit });
    const admin = typeof souAdmin === 'function' && souAdmin(), time = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
    const seletor = admin && time.length ? `<label class="vv-ver-como"><span>Ver como</span><select data-ver-como><option value="">Eu</option>${time.map((u) => `<option value="${esc(u.id)}"${String(u.id) === verComo ? ' selected' : ''}>${esc(u.name || u.nome)}</option>`).join('')}</select></label>` : '';
    el.innerHTML = `${seletor}<div class="vv-hoje-topo"><span><small class="vv-data">${esc(data)}</small><h2>${saud}${nome ? ', <em>' + esc(nome) + '</em>' : ''}</h2></span>
        <span class="vv-anel" style="--p:${abertas.length ? Math.round((1 - atrasadas.length / abertas.length) * 100) : 100}" title="Fila em dia"><b>${abertas.length - atrasadas.length}</b><small>/${abertas.length}</small></span></div>
      <button type="button" class="vv-fala" data-hoje-acao="foco"><span class="vv-ser" aria-hidden="true"><i></i></span><span>${fala}</span><b aria-hidden="true">→</b></button>
      <div class="vv-rotulo-secao" style="--c:${atrasadas.length ? 'var(--sit-atrasada)' : 'var(--sit-hoje)'}"><i></i>${diaEscolhido ? 'Dia ' + esc(diaEscolhido.slice(8) + '/' + diaEscolhido.slice(5, 7)) : 'Hoje'}<span class="vv-pilula">${lista.length}</span></div>
      ${lista.length ? lista.slice(0, 5).map(item).join('') + (lista.length > 5 ? `<button type="button" class="vv-mais" data-hoje-acao="foco">+ ${lista.length - 5} na sua fila</button>` : '') : `<p class="vv-vazio">${diaEscolhido ? 'Nada neste dia.' : 'Nada vence hoje. Bom dia para adiantar o que vem.'}</p>`}
      <div class="vv-rotulo-secao" style="--c:var(--sit-fazer)"><i></i>Próximos dias<span class="vv-pilula">${proximos.reduce((n, p) => n + p.n, 0)}</span></div>
      <div class="vv-dias">${proximos.map((p, i) => `<button type="button" class="vv-dia${p.dia === diaEscolhido ? ' ativo' : ''}" data-hoje-acao="dia" data-valor="${p.dia}"><small>${i === 0 ? 'Amanhã' : DIAS[new Date(p.dia + 'T12:00:00Z').getUTCDay()]}</small><b>${Number(p.dia.slice(8))}</b><span>${p.n || '–'}</span></button>`).join('')}</div>
      <form class="vv-pergunta" data-pergunta><span class="vv-ser" aria-hidden="true"><i></i></span><input type="text" placeholder="Pergunte ao VYBES…" aria-label="Pergunte ao VYBES"><button type="submit" aria-label="Perguntar">→</button></form>
      <div class="vv-chips"><button type="button" data-hoje-acao="foco">Meu dia</button><button type="button" data-hoje-acao="demandas">Todas as demandas</button><button type="button" data-hoje-acao="agenda">Agenda</button><button type="button" data-hoje-acao="radar">Radar da equipe</button></div>`;
  }
  function acaoDoHoje(acao, valor) {
    const eu = typeof operadorDoTopo === 'function' ? operadorDoTopo() : null;
    if (acao === 'dia') { diaEscolhido = diaEscolhido === valor ? '' : valor; pintarHoje(); return; }
    if (acao === 'peca') { chamar('openItemWorkspace', String(valor)); return; }
    if (acao === 'foco') { const alvo = verComo || eu?.id; if (alvo) chamar('chooseFocusUser', String(alvo)); return; }
    if (acao === 'demandas') { chamar('chooseManagerMode'); const b = document.getElementById('btn-board-demandas'); if (b) chamar('switchBoard', 'demandas', b); return; }
    if (acao === 'agenda') { abrirAgenda(); return; }
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
      <div class="vv-ilha vv-ferramentas" role="group" aria-label="Ferramentas">
        <button type="button" class="vv-botao" data-ferr="busca" title="Buscar em todo o painel (⌘K)" aria-label="Buscar">${svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>')}</button>
        <button type="button" class="vv-botao" data-ferr="avisos" title="Avisos" aria-label="Avisos">${svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>')}<span class="vv-badge" id="vv-badge-avisos" hidden></span></button>
        <button type="button" class="vv-botao" data-ferr="notas" title="Suas notas" aria-label="Notas">${svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>')}</button>
        <button type="button" class="vv-botao" data-ferr="aparencia" title="Aparência (inclui ligar e desligar o mundo)" aria-label="Aparência">${svg('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>')}</button>
        <button type="button" class="vv-botao" data-ferr="conta" title="Sua conta e equipe" aria-label="Conta">${svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>')}</button>
      </div>
      <div class="vv-ilha" role="group" aria-label="Vista do mundo">
        <button type="button" class="vv-botao" data-vista="cidade" aria-pressed="true">${ic.cidade}<span class="vv-rotulo-longo">Cidade</span></button>
        <button type="button" class="vv-botao" data-vista="predio" aria-pressed="false">${ic.predio}<span class="vv-rotulo-longo">Prédio da Vybe</span></button>
        <button type="button" class="vv-botao" data-vista="cerebro" aria-pressed="false">${svg('<path d="M9 4a3 3 0 0 0-3 3v.5A3 3 0 0 0 4 10.5 3 3 0 0 0 5 13a3 3 0 0 0 2 5 3 3 0 0 0 5 1V4.5A2.5 2.5 0 0 0 9 4zM15 4a3 3 0 0 1 3 3v.5a3 3 0 0 1 2 3 3 3 0 0 1-1 2.5 3 3 0 0 1-2 5 3 3 0 0 1-5 1"/>')}<span class="vv-rotulo-longo">Cérebro</span></button>
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
    const gate = body.classList.contains('mundo-cartoes') ? document.querySelector('#mode-gate .identity-shell') : hud.querySelector('#vv-hoje');
    const esq = celular ? 0 : (gate?.getBoundingClientRect().right || 0) + 6;
    const dir = !celular && !placa().hidden ? placa().offsetWidth + 20 : 0;
    mundo.areaLivre(esq, dir, celular ? innerHeight * .5 : 0);
    body.style.setProperty('--vv-livre-esq', Math.round(esq) + 'px'); body.style.setProperty('--vv-livre-dir', Math.round(dir) + 'px');
  }

  // ---------- Portas: cada sala abre o módulo que já existe ----------
  function abrirModulo(mod) {
    if (!mod) return;
    const chamar = (nome, ...a) => (typeof window[nome] === 'function' ? window[nome](...a) : undefined);
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
  const NOME_MODULO = { vybes: 'Abrir o VYBES', escritorio: 'Entrar no Escritório', clientes: 'Abrir Clientes', controler: 'Abrir Direção de arte', producao: 'Abrir Produção',
    gestor: 'Abrir Gestor', automacoes: 'Abrir Automações', performance: 'Abrir Performance', 'ai-usage': 'Abrir IA e custos' };

  function mostrarAndares() {
    const p = placa(), E = mundo.estados;
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button>
      <h3>Prédio da Vybe</h3><p class="vv-sub">A operação inteira, andar por andar. Em cada sala trabalha o VYBES com as ferramentas daquele setor.</p>
      ${[...mundo.planta].reverse().map((a) => `<button type="button" class="vv-andar" data-andar="${a.id}" style="--c:${a.cor}">
        <span class="num">${a.nivel === 0 ? 'T' : a.nivel === 6 ? '☀' : a.nivel}</span><span><b>${esc(a.nome)}</b><small>${esc(a.resumo)}</small></span>
        <span class="pontos">${a.setores.map((s) => `<i style="--e:${E[s.estado].cor}" title="${esc(s.nome)}: ${esc(E[s.estado].rotulo)}"></i>`).join('')}</span></button>`).join('')}
      <div class="vv-rotulo-secao" style="--c:#6B675F"><i></i>Legenda</div>
      ${Object.values(E).map((e) => `<span class="vv-selo" style="--e:${e.cor};margin:0 6px 6px 0"><i></i>${esc(e.rotulo)}</span>`).join('')}`;
    p.hidden = false; ajustarAreaLivre();
  }
  function mostrarAndar(idAndar, idSetor) {
    const a = mundo.planta.find((x) => x.id === idAndar); if (!a) return;
    const p = placa(), E = mundo.estados;
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button>
      <button type="button" class="vv-botao" data-voltar style="margin:-6px 0 6px -8px;height:28px">← Andares</button>
      <h3>${a.nivel === 0 ? 'Térreo' : a.nivel === 6 ? 'Terraço' : a.nivel + 'º andar'} · ${esc(a.nome)}</h3><p class="vv-sub">${esc(a.resumo)}</p>
      ${a.setores.map((s) => `<article class="vv-sala" ${s.id === idSetor ? 'style="outline:2px solid ' + a.cor + '"' : ''}>
        <div class="vv-sala-topo"><span class="vv-agente ${s.estado === 'planejado' ? 'planejado' : ''}">${s.agente ? esc(s.agente.slice(0, 2).toUpperCase()) : '★'}</span>
        <span><b>${esc(s.nome)}${s.agente ? ' · ' + esc(s.agente) : ''}</b><p class="papel">${esc(s.papel)}</p></span></div>
        <span class="vv-selo" style="--e:${E[s.estado].cor}"><i></i>${esc(E[s.estado].rotulo)}</span>
        ${s.skills.length ? `<ul class="vv-skills">${s.skills.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
        <div class="vv-sala-acoes">${s.agente ? `<button type="button" class="vv-botao" data-agente="${esc(a.id)}|${esc(s.id)}">Ver o dia</button>` : ''}${s.modulo ? `<button type="button" class="vv-botao acao" data-modulo='${esc(JSON.stringify(s.modulo))}'>${esc(NOME_MODULO[s.modulo.alvo] || 'Abrir')} →</button>` : '<span class="vv-dica">Sem módulo no painel ainda.</span>'}</div>
      </article>`).join('')}
      ${salasDaEquipeHtml(a.id)}`;
    if (Object.values(mundo.zonasDoPredio || {}).some((z) => z.andar === a.id))
      p.querySelector('.vv-sub').insertAdjacentHTML('afterend', `<button type="button" class="vv-botao acao vv-entrar-andar" data-entrar-andar="${esc(a.id)}">Entrar no andar →</button>`);
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
    const gente = lista.map((p) => ({ id: String(p.id), nome: p.nome || '', zona: p.zona || '', roupa: p.perfil?.roupa || p.roupa || '' }));
    const eu = escritorio.base?.eu;
    if (escritorio.conectado && escritorio.zona && eu && !gente.some((p) => p.id === String(eu)))
      gente.push({ id: String(eu), nome: 'Você', zona: escritorio.zona, roupa: escritorio.perfil?.roupa || '' });
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

  // ---------- O andar por dentro (escritório aberto; a voz é da sala onde você entra) ----------
  let andarAberto = null, timerAndar = null;
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
      roupa: p.perfil?.roupa || p.roupa, pele: p.perfil?.pele, cabelo: p.perfil?.cabelo }; });
    const eu = escritorio.base?.eu;
    if (escritorio.conectado && escritorio.zona && eu && !gente.some((p) => p.id === String(eu)) && typeof movimento !== 'undefined')
      gente.push({ id: String(eu), nome: 'Você', eu: true, zona: escritorio.zona, x: movimento.x, y: movimento.y, L: tamanhoDaZona(escritorio.zona),
        roupa: escritorio.perfil?.roupa, pele: escritorio.perfil?.pele, cabelo: escritorio.perfil?.cabelo });
    return gente;
  }
  async function abrirAndarVoxel(idAndar) {
    fecharAndarVoxel(false);
    const a = mundo.planta.find((x) => x.id === idAndar); if (!a) return;
    const zonas = Object.entries(mundo.zonasDoPredio).filter(([, z]) => z.andar === idAndar)
      .map(([id, z]) => ({ id, nome: z.nome, dono: z.dono || null, tipo: TIPO_DA_ZONA(id), perfil: perfilDoDono(id), L: tamanhoDaZona(id),
        itens: /^sala-\d+$/.test(id) && typeof escritorioItensDaCamada === 'function' ? (() => { try { return escritorioItensDaCamada(id) || []; } catch { return []; } })() : [] }));
    if (!zonas.length) return;
    const el = document.createElement('section'); el.id = 'mundo-andar';
    el.innerHTML = `<canvas aria-label="${esc(a.nome)} por dentro"></canvas>
      <header class="vv-ilha andar-topo"><button type="button" class="vv-botao" data-sair-andar>← Prédio</button>
        <span><small>${a.nivel === 0 ? 'Térreo' : a.nivel === 6 ? 'Terraço' : a.nivel + 'º andar'}</small><b>${esc(a.nome.replace(/^Terraço · /, ''))}</b></span>
        <span class="andar-voz" id="andar-voz"></span></header>
      <p class="andar-dica">Todo mundo do andar aparece aqui. Clique numa sala para entrar nela: a voz liga só com quem está na mesma sala.</p>`;
    body.append(el); body.classList.add('mundo-andar');
    const m = await import(MUNDO_JS);
    andarAberto = m.abrirAndar(el.querySelector('canvas'), { zonas, titulo: a.nome });
    andarAberto.aoClicarSala((zona, fx, fz, jogo) => {
      if (jogo) { abrirJogo(jogo); return; }
      const naSala = typeof escritorio !== 'undefined' && escritorio?.conectado && escritorio.zona === zona && escritorio.mapa;
      if (naSala) {
        const L = tamanhoDaZona(zona); if (L && typeof escritorioIrPara === 'function') escritorioIrPara(Math.round(fx * L.w), Math.round(fz * L.d));
      } else if (typeof irParaSalaEscritorio === 'function') { irParaSalaEscritorio(zona); andarAberto.focarSala(zona); }
    });
    el.querySelector('[data-sair-andar]').addEventListener('click', () => fecharAndarVoxel(true));
    const pintar = () => {
      if (!andarAberto) return;
      const minha = typeof escritorio !== 'undefined' && escritorio?.conectado ? escritorio.zona : '';
      andarAberto.pessoas(manualAndar || genteDoAndar(), minha);
      const voz = el.querySelector('#andar-voz');
      if (voz) voz.textContent = minha && zonas.some((z) => z.id === minha) ? (typeof escritorioEstadoVozTexto === 'function' ? escritorioEstadoVozTexto() : 'Na sala') : 'Fora das salas · sem voz';
    };
    pintar(); timerAndar = setInterval(pintar, 200);
    sincronizar();
  }
  function fecharAndarVoxel(voltar) {
    clearInterval(timerAndar); timerAndar = null;
    andarAberto?.destruir(); andarAberto = null;
    document.getElementById('mundo-andar')?.remove(); body.classList.remove('mundo-andar');
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
    const hoje = hojeIso();
    try {
      const r = await fetch(`/api/painel?area=captacoes&semana=${hoje}&dias=7`, { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Agenda indisponível.');
      agendaEventos = (d.agenda || []).filter((e) => e.dia >= hoje); agendaEm = Date.now();
    } catch (e) { agendaEventos = null; hud.querySelector('#vv-agenda-lista').innerHTML = `<p class="vv-dica">${esc(e.message)}</p>`; return; }
    pintarAgenda();
    const hoje2 = hojeIso();
    mundo?.definirCaptacoes?.(agendaEventos.filter((e) => e.dia === hoje2 && e.tipo === 'captacao' && e.cliente)
      .map((e) => ({ cliente: e.cliente, inicio: e.inicio || '', fim: e.fim || '' })));
  }
  function pintarAgenda() {
    const el = hud.querySelector('#vv-agenda-lista'); if (!el || !agendaEventos) return;
    const hoje = hojeIso(), agora = new Date(), hm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    const amanha = (() => { const x = new Date(`${hoje}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); })();
    const proximos = agendaEventos.filter((e) => e.dia > hoje || !e.fim || e.fim >= hm)
      .sort((a, b) => (a.dia + (a.inicio || '00:00')).localeCompare(b.dia + (b.inicio || '00:00'))).slice(0, 3);
    if (!proximos.length) { el.innerHTML = '<p class="vv-dica">Nada marcado nos próximos 7 dias.</p>'; return; }
    el.innerHTML = proximos.map((e) => {
      const quando = e.dia === hoje ? 'Hoje' : e.dia === amanha ? 'Amanhã' : new Date(`${e.dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).replace('.', '');
      const hora = e.inicio ? ' · ' + e.inicio.replace(':00', 'h').replace(':', 'h') : '';
      return `<button type="button" class="vv-evento" style="--c:${TIPO_COR[e.tipo] || TIPO_COR.outro}" data-agenda-dia="${esc(e.dia)}">
        <small>${esc(quando + hora)} · ${esc(TIPO_NOME[e.tipo] || 'Compromisso')}</small><b>${esc(e.titulo || 'Sem título')}</b>${e.local || e.cliente ? `<span>${esc(e.local || e.cliente)}</span>` : ''}</button>`;
    }).join('');
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
  const crmPropostas = () => { try { return JSON.parse(localStorage.getItem(CRM_CHAVE) || '[]'); } catch { return []; } };
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
    return `<div class="vv-rotulo-secao" style="--c:var(--vv-laranja)"><i></i>Prospecção em Irecê<span class="vv-pilula">${filtradas.length.toLocaleString('pt-BR')}</span></div>
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
        ${l.cliente ? '<span class="vv-selo" style="--e:#18A957"><i></i>Cliente</span>' : propostas.has(chave) ? '<span class="vv-selo" style="--e:#8E4EC6"><i></i>Proposta criada</span>' : `<button type="button" class="vv-botao" data-crm-propor="${esc(chave)}">Propor abordagem</button>`}</div></div>`; }).join('')}
      ${filtradas.length > vis.length ? `<button type="button" class="vv-botao vv-crm-mais" data-crm-mais>Mostrar mais ${Math.min(40, filtradas.length - vis.length)} de ${(filtradas.length - vis.length).toLocaleString('pt-BR')}</button>` : ''}
      <p class="vv-dica">${esc(mundo.fonteEmpresas || '')} Mais perto da Vybe primeiro. "Propor abordagem" fica em modo sombra: vira proposta do Qualificador, ninguém recebe mensagem.</p>`;
  }
  const crmRepintar = (foco) => { const d = placa().querySelector('#vv-agente-dados'); if (!d) return; d.innerHTML = crmHtml(); if (foco) { const i = d.querySelector(foco); i?.focus(); if (i?.setSelectionRange) i.setSelectionRange(i.value.length, i.value.length); } };
  let crmTimer = 0;
  hud.addEventListener('input', (e) => { const b = e.target.closest('[data-crm-busca]'); if (!b) return; clearTimeout(crmTimer); crmTimer = setTimeout(() => { crmBusca = b.value.trim().toLowerCase(); crmPagina = 1; crmRepintar('[data-crm-busca]'); }, 180); });
  hud.addEventListener('change', (e) => { const t = e.target.closest('[data-crm-tipo],[data-crm-bairro]'); if (!t) return; if (t.dataset.crmTipo !== undefined) crmTipo = t.value; else crmBairro = t.value; crmPagina = 1; crmRepintar(); });
  async function mostrarAgente(idAndar, idSetor) {
    const a = mundo.planta.find((x) => x.id === idAndar), s = a?.setores.find((x) => x.id === idSetor); if (!s) return;
    const E = mundo.estados[s.estado], p = placa();
    const iniciais = (s.agente || 'VY').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    p.innerHTML = `<button type="button" class="vv-botao vv-fechar" data-fechar aria-label="Fechar">${ic.fechar}</button>
      <button type="button" class="vv-botao" data-andar="${esc(a.id)}" style="margin:-6px 0 6px -8px;height:28px">← ${esc(a.nome)}</button>
      <div class="vv-agente-topo"><span class="vv-agente ${s.estado === 'planejado' ? 'planejado' : ''}">${esc(iniciais)}</span>
        <span><small>VYBES · ${esc(s.nome)}</small><h3>${esc(s.agente || 'VYBES')}</h3></span></div>
      <p class="vv-sub">${esc(s.papel)}</p>
      <span class="vv-selo" style="--e:${E.cor}"><i></i>${esc(E.rotulo)}</span>
      <div class="vv-agente-agora" id="vv-agente-agora"><span class="vv-ser" aria-hidden="true"><i></i></span><span>Olhando o que ele está fazendo…</span></div>
      <div id="vv-agente-dados"></div>
      ${cerebroDoAgenteHtml(a, s)}
      <div class="vv-rotulo-secao" style="--c:#6B675F"><i></i>Ferramentas</div>
      <ul class="vv-skills">${s.skills.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
      <form class="vv-pergunta" data-pergunta data-setor="${esc(s.nome)}"><span class="vv-ser" aria-hidden="true"><i></i></span><input type="text" placeholder="Pedir algo a ${esc(s.agente || 'VYBES')}…" aria-label="Pedir algo a este agente"><button type="submit" aria-label="Pedir">→</button></form>
      ${s.modulo ? `<button type="button" class="vv-botao acao" style="margin-top:10px" data-modulo='${esc(JSON.stringify(s.modulo))}'>${esc(NOME_MODULO[s.modulo.alvo] || 'Abrir')} →</button>` : ''}`;
    p.hidden = false; ajustarAreaLivre();
    mundo.focarAndar(a.nivel);
    const agoraEl = p.querySelector('#vv-agente-agora span:last-child'), dados = p.querySelector('#vv-agente-dados');
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
      if (r.crm) { dados.innerHTML = crmHtml(); return; }
      dados.innerHTML = (r.fila?.length ? `<div class="vv-rotulo-secao" style="--c:var(--sit-aprovar)"><i></i>${esc(r.rotuloFila || 'Na fila')}<span class="vv-pilula">${r.fila.length}</span></div>${r.fila.map(linha).join('')}` : '')
        + (r.feitos?.length ? `<div class="vv-rotulo-secao" style="--c:var(--sit-pronta)"><i></i>${esc(r.rotuloFeitos || 'O que fez')}</div>${r.feitos.map(linha).join('')}` : '')
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
    const est = new Map(); for (const a of mundo.planta) for (const s of a.setores) est.set(s.id, s.estado);
    return (mundo.agentesDoPredio?.() || []).map((ag) => ({ ...ag, estado: est.get(ag.setor) || 'planejado' }));
  }
  function camadasDoCerebro(cli, ags) {
    const abertas = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL.filter((d) => situacaoDaPeca(d) !== 'concluida').length : 0;
    const itens = cli.reduce((n, c) => n + c.itens, 0);
    const conta = (k) => ags.filter((a) => a.estado === k).length;
    return { identidade: 'uma só, em todos os canais', clientes: `${cli.length} clientes · ${itens.toLocaleString('pt-BR')} itens`, conversas: 'grupos internos, pela central',
      trabalho: `${abertas.toLocaleString('pt-BR')} peças em aberto`, agentes: `${conta('ativo')} ativos · ${conta('sombra')} aprendendo · ${conta('planejado')} a ligar` };
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
      const nome = new Map(); for (const a of mundo.planta) for (const s of a.setores) nome.set(s.id, { s, a });
      corpo = ags.map((g) => { const x = nome.get(g.setor); if (!x) return ''; const E = mundo.estados[x.s.estado];
        return `<button type="button" class="vv-cb-camada" data-agente="${esc(x.a.id)}|${esc(x.s.id)}" style="--c:${E.cor}"><i></i><span><b>${esc(x.s.agente || 'VYBES')}</b><small>${esc(x.s.nome)} · ${esc(x.a.nome)}</small></span><em>${esc(E.rotulo)}</em></button>`; }).join('');
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
    window.escritorioIrParaAmbiente = function (id, ...r) {
      const z = ligado && mundo?.zonasDoPredio?.[id];
      if (!z) return irOriginal.call(this, id, ...r);
      abrirAndarVoxel(z.andar).then(() => { if (typeof irParaSalaEscritorio === 'function') irParaSalaEscritorio(id); andarAberto?.focarSala(id); });
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
  function usarFerramenta(id) {
    if (id === 'busca') document.querySelector('[data-open-spotlight]')?.click();
    else if (id === 'aparencia') document.querySelector('[data-open-appearance]')?.click();
    else if (id === 'notas') chamar('abrirNotas');
    else if (id === 'conta') chamar('irParaMinhaConta');
    else if (id === 'avisos') { chamar('chooseManagerMode'); setTimeout(() => chamar('alternarNotificacoes'), 350); }
  }
  setInterval(() => {
    const n = Number(document.getElementById('notif-contador')?.textContent || 0), el = hud.querySelector('#vv-badge-avisos');
    if (el) { el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n); }
  }, 3000);

  function mostrarCliente(nome) {
    const c = naTela.find((x) => x.nome === nome); if (!c) return;
    const p = placa();
    const quadros = [['atrasada', 'atrasadas'], ['hoje', 'saem hoje'], ['aprovar', 'p/ aprovar'], ['fazer', 'a fazer']];
    const base = mundo.acharNaBase?.(c.nome);
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
      ${typeof abrirModalCerebroCliente === 'function' ? `<button type="button" class="vv-botao" data-cerebro-cliente="${esc(c.nome)}">Sinapses do cérebro</button>` : ''}</div>`;
    p.hidden = false; ajustarAreaLivre();
    mundo.focarCliente(nome);
  }
  function fecharPlaca() { placa().hidden = true; ajustarAreaLivre(); }

  hud.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !mundo) return;
    if (b.dataset.trilho) { usarTrilho(b.dataset.trilho, b); return; }
    if (b.dataset.ferr) { usarFerramenta(b.dataset.ferr); return; }
    if (b.dataset.hojeAcao) { acaoDoHoje(b.dataset.hojeAcao, b.dataset.valor); return; }
    if (b.dataset.vista) {
      hud.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      body.classList.toggle('mundo-cerebro', b.dataset.vista === 'cerebro');
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
    else if (b.dataset.cerebroCliente) { const nome = b.dataset.cerebroCliente; chamar('chooseClientMode'); setTimeout(() => { try { abrirModalCerebroCliente(nome); } catch (e) { console.error('[mundo] cérebro do cliente', e); } }, 450); }
    else if (b.dataset.agente) { const [an, se] = b.dataset.agente.split('|'); mundo.cerebro(false); hud.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.vista === 'predio'))); mostrarAgente(an, se); }
    else if (b.dataset.perfil) abrirPerfil(b.dataset.perfil);
    else if (b.dataset.crmMais !== undefined) { crmPagina++; crmRepintar(); }
    else if (b.dataset.crmAce !== undefined) { crmAce = !crmAce; crmPagina = 1; crmRepintar(); }
    else if (b.dataset.crmVer) { const [x, z] = b.dataset.crmVer.split(',').map(Number); mundo.focarPonto(x, z); }
    else if (b.dataset.crmPropor) {
      const l = crmLinhas.find((x) => (x.cnpj || x.nome) === b.dataset.crmPropor); if (!l) return;
      const lista = crmPropostas(); lista.push({ cnpj: l.cnpj || '', nome: l.nome, setor: l.setor || '', tipo: l.tipo || '', rua: l.rua, em: new Date().toISOString(), setor: 'sdr', status: 'proposta', quem: (typeof operadorDoTopo === 'function' && operadorDoTopo()?.name) || '' });
      try { localStorage.setItem(CRM_CHAVE, JSON.stringify(lista)); } catch { /* sem armazenamento */ }
      const d = placa().querySelector('#vv-agente-dados'); if (d) d.innerHTML = crmHtml();
    }
    else if (b.dataset.jogo) abrirJogo(b.dataset.jogo);
    else if (b.dataset.agente) { const [an, se] = b.dataset.agente.split('|'); mostrarAgente(an, se); }
    else if (b.dataset.entrarAndar) abrirAndarVoxel(b.dataset.entrarAndar);
    else if (b.dataset.entrarZona) { const z = mundo.zonasDoPredio?.[b.dataset.entrarZona]; if (z) abrirAndarVoxel(z.andar).then(() => { irParaSalaEscritorio?.(b.dataset.entrarZona); andarAberto?.focarSala(b.dataset.entrarZona); }); }
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
    const assinatura = lista.map((c) => `${c.nome}:${c.total}:${c.situacao}`).join('|');
    if (!forcar && assinatura === ultimaAssinatura) return;
    ultimaAssinatura = assinatura; naTela = lista;
    mundo.definirClientes(lista, { aoClicar: (alvo) => mostrarCliente(alvo.nome) });
    mundo.alertaVybes(lista.some((c) => c.situacao === 'atrasada'));
  }

  async function carregar() {
    if (mundo || carregando) return carregando;
    carregando = (async () => {
      const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches || body.dataset.motion === 'reduce';
      const m = await import(MUNDO_JS);
      mundo = await m.iniciarMundo(raiz.querySelector('canvas'), { dadosUrl: MUNDO_DADOS, crmUrl: MUNDO_CRM, reduzirMovimento: reduzir });
      raiz.querySelector('.mundo-carregando')?.remove();
      mundo.aoClicar((alvo) => {
        if (!alvo) return;
        if (alvo.tipo === 'setor') { hud.querySelector('[data-vista="predio"]')?.setAttribute('aria-pressed', 'true'); hud.querySelector('[data-vista="cidade"]')?.setAttribute('aria-pressed', 'false'); mostrarAgente(alvo.andar, alvo.setor); }
        else if (alvo.tipo === 'cliente') mostrarCliente(alvo.nome);
        else if (alvo.tipo === 'vybes') mostrarAgente('terreo', 'orquestrador');
        else if (alvo.tipo === 'cerebro') mostrarNoDoCerebro(alvo.no);
        else if (alvo.tipo === 'zona') abrirAndarVoxel(alvo.andar);
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
          html = `<b>${esc(s.nome)}</b><small>${esc(a.nome)}${s.agente ? ' · agente ' + esc(s.agente) : ''}</small><span class="vv-selo" style="--e:${mundo.estados[s.estado].cor}"><i></i>${esc(mundo.estados[s.estado].rotulo)}</span>`;
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
      observarPresenca(); pintarPresenca();
      ajustarAreaLivre();
    })().catch((erro) => {
      carregando = null;
      const aviso = raiz.querySelector('.mundo-carregando');
      if (aviso) aviso.textContent = 'O mundo não abriu neste aparelho (' + (erro?.message || 'erro') + '). O painel segue normal.';
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
  function chaveNaAparencia() {
    const d = document.querySelector('dialog.appearance-dialog'); if (!d || d.querySelector('#appearance-irecity') || semWebGL) return;
    const lab = document.createElement('label'); lab.className = 'appearance-check';
    lab.innerHTML = '<input id="appearance-irecity" type="checkbox">Modo Irecity (Irecê ao vivo)';
    d.querySelector('.appearance-done')?.before(lab);
    const c = lab.querySelector('input'); c.checked = ligado;
    c.addEventListener('change', () => { ligar(c.checked); if (c.checked && typeof openModeGate === 'function') setTimeout(() => openModeGate(), 200); });
    d.addEventListener('toggle', () => { c.checked = ligado; });
  }
  chaveNaAparencia(); if (typeof setTimeout === 'function') setTimeout(chaveNaAparencia, 1500);

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
      <h1 class="login-cidade">Irecê, <b>ao vivo</b></h1>
      <p>A Vybe inteira numa cidade: os clientes no endereço de cada um, as captações na rua e o VYBES orquestrando do prédio.</p>
      <div class="irecity-modos">
        <button type="button" class="abr-primario" data-modo="irecity"><b>Entrar no Irecity</b><small>O novo Vybe OS, com o mundo</small></button>
        <button type="button" class="irecity-legado" data-modo="legado"><b>Modo legado</b><small>O painel como você usa hoje</small></button>
      </div>
      <button type="button" id="login-chegar" hidden>Entrar</button>`;
    chegada.addEventListener('click', (e) => {
      const b = e.target.closest('[data-modo]'); if (!b) return;
      ligar(b.dataset.modo === 'irecity');
      body.classList.toggle('mundo-lobby', !semWebGL);
      gate.dataset.etapa = 'login';
      window.VYBELANDIA_VISTA = true;
      document.querySelector('#login-rostos-lista button, #login-senha')?.focus({ preventScroll: true });
      const t = gate.querySelector('.login-saudacao'); if (t) t.textContent = b.dataset.modo === 'irecity' ? 'Entrando no Irecity.' : 'Entrando no modo legado.';
    });
    // Enter na chegada = Irecity
    gate.addEventListener('keydown', (e) => { if (e.key === 'Enter' && gate.dataset.etapa === 'cena') { e.preventDefault(); e.stopImmediatePropagation(); chegada.querySelector('[data-modo="irecity"]').click(); } }, true);
    chegada.querySelector('[data-modo="irecity"]').focus({ preventScroll: true });
  }
  new MutationObserver(() => { if (document.getElementById('login-gate') && !document.getElementById('login-gate').dataset.irecity) sincronizar(); }).observe(body, { childList: true });

  // ---------- Mostrar o mundo junto com a tela de módulos ----------
  let timer = null;
  function sincronizar() {
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
      setTimeout(() => { redirecionando = false; if (typeof openModeGate === 'function') openModeGate(); setTimeout(() => usarTrilho('predio'), 300); }, 0);
    }
    const modulo = ligado && autenticado && !gateAberto && !andarAberto && quadro !== 'escritorio';
    // Lobby: antes do login, Irecê ao vivo atrás do portão (vale para os dois modos; a escolha é no portão).
    const lobby = !semWebGL && !autenticado && !!document.getElementById('login-gate');
    body.classList.toggle('mundo-lobby', lobby);
    if (lobby) { prepararLobby(); carregar().then(() => { mundo?.pausar(false); ajustarAreaLivre(); }); girarLobby(true); } else girarLobby(false);
    body.classList.toggle('mundo-modulo', modulo);
    // A rolagem agora é a do body (dentro da moldura): ao trocar de módulo, volta ao topo como antes.
    const chaveModulo = modulo ? (typeof panelMode !== 'undefined' ? panelMode : '') + '|' + quadro : '';
    if (chaveModulo !== sincronizar.ultimo) { sincronizar.ultimo = chaveModulo; if (modulo) body.scrollTop = 0; }
    if (modulo) marcarTrilhoDoModulo();
    body.classList.toggle('mundo-sobre-escritorio', ligado && (visivel || Boolean(andarAberto) || jogandoAgora));
    body.classList.toggle('mundo', ligado);
    body.classList.toggle('mundo-visivel', visivel);
    if (visivel) {
      carregar();
      mundo?.pausar(false); pintarClientes(); pintarHoje(); ajustarAreaLivre(); carregarAgenda(); observarPresenca(); pintarPresenca();
      if (!timer) timer = setInterval(() => { pintarClientes(); pintarPresenca(); carregarAgenda(); pintarHoje(); }, 5000);
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
  function ligar(sim) {
    ligado = !!sim && !semWebGL;
    try { localStorage.setItem(CHAVE, JSON.stringify({ ligado })); } catch { /* sem armazenamento */ }
    sincronizar();
  }
  window.mundoVoxel = { ligar, ligado: () => ligado, situacaoDaPeca, clientesDoMundo, camera: () => mundo?.estado(), projetar: (...a) => mundo?.projetar(...a),
    // Conferência visual (presença e clientes) sem mexer nos dados do painel.
    desenharCaptacoes: (lista) => mundo?.definirCaptacoes(lista),
    focar: (x, z) => mundo?.focarPonto(x, z),
    conferirClientes: () => mundo?.conferirClientes?.(),
    desempenho: () => mundo?.desempenho?.(),
    orcamento: () => mundo?.orcamento?.(),
    agente: (andar, setor) => mostrarAgente(andar, setor),
    desenharPresenca: (lista) => { ultimaPresenca = "manual"; manualAndar = lista; mundo?.presenca(lista); },
    abrirAndar: (id) => abrirAndarVoxel(id),
    jogar: (id) => abrirJogo(id),
    // Conferência visual: desenha uma lista de clientes sem mexer nos dados do painel.
    desenharClientes: (lista) => { naTela = lista; ultimaAssinatura = 'manual'; return mundo?.definirClientes(lista, { aoClicar: (alvo) => mostrarCliente(alvo.nome) }); } };

  function iniciar() {
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
    if (ligado) { trocarAvataresEm(document.body); import(MUNDO_JS).then((m) => { modAvatar = modAvatar || m; ligarIconesVoxel(); ligarCatalogoVoxel(); }).catch(() => {}); }
  }
  // Classe aplicada antes do primeiro desenho, para a tela de módulos não piscar no tema antigo.
  body.classList.toggle('mundo', ligado);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
