// vybe-spotlight.js — a busca global do painel, no jeito do Spotlight do Mac.
//
// ⌘K (ou Ctrl+K) abre de qualquer tela. Digitar "antonov" traz tudo que tem
// Antonov: conteúdos e solicitações de qualquer semana, o cliente e as pessoas.
// As buscas locais — "Buscar por cliente" em Demandas e Conteúdos — continuam
// onde estão; esta é a que atravessa o painel inteiro.
//
// A busca que existia antes olhava só Produção, só o que estava carregado na
// semana, e mostrava no máximo cinco peças. A barra da operação continua no
// lugar e passa a abrir esta janela.
//
// Procura só no que o painel já tem na memória: é instantânea e não custa
// consulta ao banco. O texto do briefing não vem na lista de peças e fica fora.

const SPOTLIGHT_DIAS_ANTIGA = 30;
const SPOTLIGHT_POR_BLOCO = 5;
const SPOTLIGHT_POR_ATALHO = 5;
const SPOTLIGHT_RECENTES_CHAVE = 'vybe.busca.recentes';
const SPOTLIGHT_RECENTES_MAX = 4;
const SPOTLIGHT_ABAS = [
  ['tudo', 'Tudo'], ['conteudos', 'Conteúdos'], ['demandas', 'Demandas'],
  ['clientes', 'Clientes'], ['pessoas', 'Pessoas'],
];

// O que a pessoa abriu pela busca por último (quadro 09: a busca vazia continua de onde parou). Só neste navegador;
// sem ele (aba privada, armazenamento bloqueado) a lista fica vazia e os atalhos continuam.
function spotlightLerRecentes() {
  try { const l = JSON.parse(localStorage.getItem(SPOTLIGHT_RECENTES_CHAVE) || '[]'); return Array.isArray(l) ? l.filter((r) => r && r.tipo && r.valor) : []; } catch { return []; }
}
function spotlightGuardarRecente(tipo, valor) {
  if (!tipo || !valor) return;
  const lista = [{ tipo, valor: String(valor) }, ...spotlightLerRecentes().filter((r) => !(r.tipo === tipo && r.valor === String(valor)))].slice(0, SPOTLIGHT_RECENTES_MAX);
  try { localStorage.setItem(SPOTLIGHT_RECENTES_CHAVE, JSON.stringify(lista)); } catch { /* sem armazenamento: só não lembra */ }
}

// ── a regra da busca, sem tela ────────────────────────────────────────────────

function spotlightNormalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function spotlightClientes(item) {
  const nomes = Array.isArray(item?.clientes) && item.clientes.length ? item.clientes : [item?.cliente];
  return [...new Set(nomes.map((n) => String(n || '').trim()).filter((n) => n && n !== '—'))];
}

// A data que manda na peça: veiculação no conteúdo, conclusão na solicitação.
// normalizeRequestForOperational já coloca a conclusão em veiculacao_iso.
function spotlightDataDoItem(item) {
  return String(item?.veiculacao_iso || item?.conclusao_iso || item?.prazo_iso || '').slice(0, 10);
}

// Datas sem hora ao meio-dia UTC: subtrair dias não pode virar o dia por fuso.
function spotlightDiasAntes(hojeIso, dias) {
  const base = new Date(`${hojeIso}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return '';
  base.setUTCDate(base.getUTCDate() - dias);
  return base.toISOString().slice(0, 10);
}

function spotlightDistancia(dataIso, hojeIso) {
  if (!dataIso || !hojeIso) return Number.POSITIVE_INFINITY;
  return Math.abs(Date.parse(`${dataIso}T12:00:00Z`) - Date.parse(`${hojeIso}T12:00:00Z`));
}

// Devolve os blocos da janela. Tudo que decide o que aparece mora aqui.
//
// FINALIZADA OU ANTIGA vai para o bloco de baixo, e não some: concluída pela
// mesma regra do resto do painel, ou com a data há mais de trinta dias. Peça
// atrasada há poucos dias e ainda aberta fica em cima — é trabalho, não arquivo.
function spotlightResultados(consulta, {
  itens = [], pessoas = [], hojeIso = '', escopo = null, aba = 'tudo',
  concluida = () => false, ehDemanda = (i) => i?.origem === 'solicitacao',
} = {}) {
  const frase = spotlightNormalizar(consulta);
  const termos = frase ? frase.split(' ') : [];
  const vazio = { clientes: [], pessoas: [], andamento: [], encerradas: [] };
  if (!escopo && frase.length < 2) return vazio;

  const limiteAntiga = hojeIso ? spotlightDiasAntes(hojeIso, SPOTLIGHT_DIAS_ANTIGA) : '';
  const encerrada = (item) => {
    if (concluida(item)) return true;
    const data = spotlightDataDoItem(item);
    return Boolean(limiteAntiga && data && data < limiteAntiga);
  };
  const temTodos = (texto) => termos.every((t) => texto.includes(t));

  let base = itens;
  if (escopo?.tipo === 'cliente') {
    const alvo = spotlightNormalizar(escopo.valor);
    base = base.filter((i) => spotlightClientes(i).some((c) => spotlightNormalizar(c) === alvo));
  } else if (escopo?.tipo === 'pessoa') {
    base = base.filter((i) => (i.responsavel_ids || []).map(String).includes(String(escopo.valor)));
  }
  if (aba === 'conteudos') base = base.filter((i) => !ehDemanda(i));
  if (aba === 'demandas') base = base.filter((i) => ehDemanda(i));

  const achados = [];
  if (!['clientes', 'pessoas'].includes(aba)) {
    for (const item of base) {
      const clientes = spotlightClientes(item);
      const nome = spotlightNormalizar(item.nome);
      const texto = spotlightNormalizar([item.nome, ...clientes, item.formato, item.tipo, item.tipo_conteudo,
        item.responsavel, item.status, item.grupo, item.id].filter(Boolean).join(' · '));
      if (termos.length && !temTodos(texto)) continue;
      const clientesNorm = clientes.map(spotlightNormalizar);
      let pontos = 0;
      if (frase && clientesNorm.includes(frase)) pontos += 40;
      else if (frase && clientesNorm.some((c) => c.startsWith(frase))) pontos += 25;
      if (frase && nome.includes(frase)) pontos += 15;
      pontos += termos.filter((t) => nome.includes(t)).length * 5;
      achados.push({ item, pontos, data: spotlightDataDoItem(item), encerrada: encerrada(item) });
    }
  }
  const andamento = achados.filter((a) => !a.encerrada).sort((a, b) =>
    b.pontos - a.pontos || spotlightDistancia(a.data, hojeIso) - spotlightDistancia(b.data, hojeIso));
  const encerradas = achados.filter((a) => a.encerrada).sort((a, b) =>
    b.pontos - a.pontos || String(b.data).localeCompare(String(a.data)));

  // Clientes e pessoas são atalhos de filtro, como as pastas no Spotlight.
  // Dentro de um filtro eles não se repetem.
  let clientes = [];
  let equipe = [];
  if (!escopo && termos.length) {
    if (['tudo', 'clientes'].includes(aba)) {
      const porNome = new Map();
      for (const item of itens) {
        for (const nome of spotlightClientes(item)) {
          const chave = spotlightNormalizar(nome);
          if (!temTodos(chave)) continue;
          const c = porNome.get(chave) || { nome, ativas: 0, total: 0 };
          c.total += 1;
          if (!encerrada(item)) c.ativas += 1;
          porNome.set(chave, c);
        }
      }
      clientes = [...porNome.values()].sort((a, b) =>
        Number(spotlightNormalizar(b.nome) === frase) - Number(spotlightNormalizar(a.nome) === frase)
        || b.ativas - a.ativas || a.nome.localeCompare(b.nome, 'pt-BR'));
    }
    if (['tudo', 'pessoas'].includes(aba)) {
      equipe = pessoas.filter((p) => temTodos(spotlightNormalizar(p.name))).map((p) => ({
        id: String(p.id), nome: p.name, cor: p.color, pessoa: p,
        ativas: itens.filter((i) => (i.responsavel_ids || []).map(String).includes(String(p.id)) && !encerrada(i)).length,
      })).sort((a, b) => b.ativas - a.ativas);
    }
  }

  return {
    clientes, pessoas: equipe,
    andamento: andamento.map((a) => a.item),
    encerradas: encerradas.map((a) => a.item),
  };
}

// Marca na tela o trecho que casou, comparando sem acento e sem maiúscula mas
// devolvendo o texto como ele é.
function spotlightRealce(texto, consulta) {
  const original = String(texto ?? '');
  const termos = spotlightNormalizar(consulta).split(' ').filter(Boolean);
  if (!termos.length) return safeText(original);
  let normal = '';
  const origem = [];
  [...original].forEach((ch, i) => {
    const n = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const _ of n) { normal += _; origem.push(i); }
  });
  const chars = [...original];
  const marcado = new Array(chars.length).fill(false);
  for (const termo of termos) {
    let de = normal.indexOf(termo);
    while (de !== -1) {
      for (let k = de; k < de + termo.length; k++) marcado[origem[k]] = true;
      de = normal.indexOf(termo, de + termo.length);
    }
  }
  let html = '';
  let aberto = false;
  chars.forEach((ch, i) => {
    if (marcado[i] && !aberto) { html += '<mark>'; aberto = true; }
    if (!marcado[i] && aberto) { html += '</mark>'; aberto = false; }
    html += safeText(ch);
  });
  return aberto ? `${html}</mark>` : html;
}

// ── a janela ──────────────────────────────────────────────────────────────────

const SPOTLIGHT = { consulta: '', escopo: null, aba: 'tudo', ativo: 0, opcoes: [], abertos: new Set(), carregando: false };
let SPOTLIGHT_DIALOGO = null;

// O ano só aparece quando não é o deste ano: "20/09", mas "12/06/2025".
function spotlightDataBr(iso, hojeIso = (typeof HOJE_ISO === 'string' && HOJE_ISO) || '') {
  const [a, m, d] = String(iso || '').split('-');
  if (!a || !m || !d) return '';
  return a === String(hojeIso).slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a}`;
}

function spotlightDialogo() {
  if (SPOTLIGHT_DIALOGO) return SPOTLIGHT_DIALOGO;
  const d = document.createElement('dialog');
  d.className = 'spotlight-dialog';
  d.id = 'v2j-busca';
  d.setAttribute('aria-labelledby', 'spotlight-titulo');
  // Janela do topo (quadro "Janelas do topo"): 340 de largura, cabeçalho com o nome e o X, corpo e pé.
  d.innerHTML = `<div class="v2j-cab"><h2 id="spotlight-titulo">Busca</h2><span class="v2j-pill">Esc</span>
      <button type="button" class="spotlight-fechar v2j-x" aria-label="Fechar busca" title="Fechar (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="v2j-corpo">
      <div class="spotlight-campo">
        <span class="spotlight-escopo" hidden></span>
        <label class="v2j-oculto" for="spotlight-input">Buscar peça, cliente ou pessoa</label>
        <input id="spotlight-input" type="search" role="combobox" aria-expanded="true" aria-controls="spotlight-lista"
          aria-autocomplete="list" autocomplete="off" spellcheck="false"
          placeholder="Buscar peça, cliente ou pessoa">
      </div>
      <div class="spotlight-abas" role="tablist" aria-label="Filtrar resultados">${SPOTLIGHT_ABAS.map(([chave, rotulo]) =>
        `<button type="button" role="tab" data-aba="${chave}" aria-selected="${chave === 'tudo'}">${rotulo}</button>`).join('')}</div>
      <div id="spotlight-lista" class="spotlight-lista" role="listbox" aria-label="Resultados"></div>
    </div>
    <div class="spotlight-rodape v2j-pe" aria-live="polite"></div>`;
  document.body.append(d);
  const input = d.querySelector('#spotlight-input');
  input.addEventListener('input', () => { SPOTLIGHT.consulta = input.value; SPOTLIGHT.ativo = 0; SPOTLIGHT.abertos.clear(); spotlightPintar(); });
  input.addEventListener('keydown', spotlightTeclado);
  d.querySelector('.spotlight-abas').addEventListener('click', (e) => {
    const aba = e.target.closest('[data-aba]')?.dataset.aba;
    if (!aba) return;
    SPOTLIGHT.aba = aba; SPOTLIGHT.ativo = 0; SPOTLIGHT.abertos.clear();
    spotlightPintar(); input.focus();
  });
  const lista = d.querySelector('#spotlight-lista');
  lista.addEventListener('mousemove', (e) => {
    const linha = e.target.closest('[data-opcao]');
    if (!linha || Number(linha.dataset.opcao) === SPOTLIGHT.ativo) return;
    SPOTLIGHT.ativo = Number(linha.dataset.opcao); spotlightMarcarAtivo();
  });
  lista.addEventListener('click', (e) => {
    const linha = e.target.closest('[data-opcao]');
    if (linha) spotlightAcionar(Number(linha.dataset.opcao));
  });
  d.querySelector('.spotlight-escopo').addEventListener('click', (e) => {
    if (e.target.closest('button')) { spotlightTirarEscopo(); input.focus(); }
  });
  // Esc primeiro desfaz o que foi digitado, depois o filtro, e só então fecha —
  // como no Mac. Tratado no teclado e não no evento 'cancel' do <dialog>: o
  // Chrome deixa de disparar 'cancel' depois de ele ser interrompido duas vezes
  // seguidas, e a janela ficava presa aberta no segundo Esc.
  d.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (SPOTLIGHT.consulta) { SPOTLIGHT.consulta = ''; input.value = ''; SPOTLIGHT.ativo = 0; spotlightPintar(); }
    else if (SPOTLIGHT.escopo) spotlightTirarEscopo();
    else d.close();
    if (d.open) input.focus();
  });
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.spotlight-fechar')) d.close(); });
  SPOTLIGHT_DIALOGO = d;
  return d;
}

// A janela abre embaixo do ícone da busca (quadro "Janelas do topo"). Sem ícone à vista, ou no celular, o CSS centra.
function spotlightPosicionar(d) {
  const limpar = () => { d.style.top = ''; d.style.left = ''; d.style.margin = ''; d.style.removeProperty('--v2j-topo'); };
  if (typeof innerWidth !== 'number' || innerWidth < 600) return limpar();
  const visivel = (b) => b.getBoundingClientRect().width > 0;
  const botao = [...document.querySelectorAll('[data-ferr="busca"]')].find(visivel) || [...document.querySelectorAll('[data-open-spotlight]')].find(visivel);
  if (!botao) return limpar();
  const r = botao.getBoundingClientRect(), largura = 340;
  const esquerda = Math.min(Math.max(8, r.width >= largura ? r.left : r.right - largura), innerWidth - largura - 8);
  const topo = Math.round(r.bottom + 8);
  d.style.margin = '0'; d.style.top = `${topo}px`; d.style.left = `${Math.round(esquerda)}px`;
  d.style.setProperty('--v2j-topo', `${topo}px`);
}

// "sexta", "amanhã": a data do jeito que se fala; fora da semana, dia e mês.
function spotlightQuando(iso, hojeIso = (typeof HOJE_ISO === 'string' && HOJE_ISO) || new Date().toISOString().slice(0, 10)) {
  if (!iso) return '';
  const dias = Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${hojeIso}T12:00:00Z`)) / 86400000);
  if (!Number.isFinite(dias)) return '';
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  if (dias > 1 && dias < 7) return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return spotlightDataBr(iso, hojeIso);
}

function spotlightItens() {
  return typeof unifiedOperationalItems === 'function' ? unifiedOperationalItems() : [];
}

async function abrirSpotlight(texto = '') {
  if (document.body.classList.contains('auth-pending')) return;
  const d = spotlightDialogo();
  const input = d.querySelector('#spotlight-input');
  if (texto) { SPOTLIGHT.consulta = texto; input.value = texto; }
  SPOTLIGHT.ativo = 0;
  // Uma janela por vez (quadro 09): abrir a busca fecha os avisos e os menus do topo, que ouvem este evento.
  document.dispatchEvent(new CustomEvent('vybe:janela-topo', { detail: { qual: 'busca' } }));
  if (!d.open) d.showModal();
  spotlightPosicionar(d);
  input.focus();
  if (texto) input.setSelectionRange(texto.length, texto.length); else input.select();
  spotlightPintar();
  // Solicitações só entram na memória quando alguma tela pede. Sem elas a busca
  // mostraria meio painel sem avisar — então ela pede, e diz que está pedindo.
  if (!(typeof DADOS_DEMANDAS !== 'undefined' && DADOS_DEMANDAS.length)
      && typeof ensureDemandasForOperationalViews === 'function' && !SPOTLIGHT.carregando) {
    SPOTLIGHT.carregando = true; spotlightPintar();
    try { await ensureDemandasForOperationalViews(); } finally { SPOTLIGHT.carregando = false; if (d.open) spotlightPintar(); }
  }
}

function spotlightTirarEscopo() {
  SPOTLIGHT.escopo = null; SPOTLIGHT.ativo = 0; SPOTLIGHT.abertos.clear(); spotlightPintar();
}

function spotlightPintar() {
  const d = SPOTLIGHT_DIALOGO;
  if (!d) return;
  const r = spotlightResultados(SPOTLIGHT.consulta, {
    itens: spotlightItens(),
    pessoas: typeof TEAM_USERS === 'undefined' ? [] : TEAM_USERS,
    hojeIso: (typeof HOJE_ISO === 'string' && HOJE_ISO) || new Date().toISOString().slice(0, 10),
    escopo: SPOTLIGHT.escopo, aba: SPOTLIGHT.aba,
    concluida: typeof atividadeDoDiaConcluida === 'function' ? atividadeDoDiaConcluida : undefined,
    ehDemanda: typeof isRequestItem === 'function' ? isRequestItem : undefined,
  });

  d.querySelectorAll('[data-aba]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === SPOTLIGHT.aba)));
  const escopo = d.querySelector('.spotlight-escopo');
  escopo.hidden = !SPOTLIGHT.escopo;
  escopo.innerHTML = SPOTLIGHT.escopo
    ? `Em <b>${safeText(SPOTLIGHT.escopo.rotulo)}</b><button type="button" aria-label="Tirar o filtro ${safeText(SPOTLIGHT.escopo.rotulo)}">×</button>` : '';
  d.querySelector('#spotlight-input').placeholder = SPOTLIGHT.escopo
    ? `Buscar em ${SPOTLIGHT.escopo.rotulo}` : 'Buscar peça, cliente ou pessoa';

  const opcoes = [];
  const q = SPOTLIGHT.consulta;
  const bloco = (id, titulo, linhas) => linhas.length
    ? `<div role="group" aria-labelledby="spot-g-${id}"><div id="spot-g-${id}" class="spotlight-grupo" role="presentation">${titulo}</div>${linhas.join('')}</div>` : '';
  // Linha do quadro: o nome à esquerda e uma palavra cinza à direita; na linha marcada, a palavra vira a ação da tecla.
  const linha = (acao, conteudo, dica) => {
    const i = opcoes.push(acao) - 1;
    return `<div id="spot-o-${i}" class="spotlight-linha" role="option" aria-selected="false" data-opcao="${i}">${conteudo}${dica ? `<span class="spotlight-dica">${dica}</span>` : ''}</div>`;
  };
  const titulo = (html) => `<span class="spotlight-titulo">${html}</span>`;
  const sub = (texto) => (texto ? `<span class="spotlight-sub">${texto}</span>` : '');
  const nomeCliente = (nome) => (typeof cliCor === 'function' ? cliCor(nome) : `<span class="spotlight-cli">${spotlightRealce(nome, q)}</span>`);
  const ehDemanda = (item) => (typeof isRequestItem === 'function' ? isRequestItem(item) : item.origem === 'solicitacao');
  const atividade = (item) => {
    const demanda = ehDemanda(item);
    const clientes = spotlightClientes(item);
    const iso = spotlightDataDoItem(item);
    const tipo = demanda ? (item.tipo || 'Solicitação') : (item.formato || 'Conteúdo');
    const quando = spotlightQuando(iso) || 'sem data';
    // "Card · Promoção de sábado": o formato na frente, a não ser que o nome da peça já comece por ele.
    const nome = String(item.nome || 'Sem título');
    const rotulo = spotlightNormalizar(nome).startsWith(spotlightNormalizar(tipo)) ? nome : `${tipo} · ${nome}`;
    // Dentro de um cliente o nome dele não se repete em cada linha; fora, vai junto da data para não confundir peças iguais.
    const naDireita = SPOTLIGHT.escopo?.tipo === 'cliente' || !clientes.length ? quando : `${safeText(clientes[0])} · ${quando}`;
    const inteiro = [demanda ? 'Demanda' : 'Conteúdo', clientes.join(', '), item.status || 'Sem status',
      iso ? `${demanda ? 'conclusão' : 'veiculação'} ${spotlightDataBr(iso)}` : 'sem data'].filter(Boolean).join(' · ');
    return linha({ tipo: 'item', id: item.id },
      `<span class="spotlight-titulo" title="${safeText(inteiro)}">${spotlightRealce(rotulo, q)}</span>${sub(naDireita)}`, 'abrir · Enter');
  };
  const cortar = (id, lista) => {
    if (SPOTLIGHT.abertos.has(id) || lista.length <= SPOTLIGHT_POR_BLOCO) return lista.map(atividade);
    return [...lista.slice(0, SPOTLIGHT_POR_BLOCO).map(atividade),
      linha({ tipo: 'mais', bloco: id }, `<span class="spotlight-mais">+ ${lista.length - SPOTLIGHT_POR_BLOCO} · mostrar</span>`)];
  };

  const html = [
    bloco('clientes', 'Clientes', r.clientes.slice(0, SPOTLIGHT_POR_ATALHO).map((c) => linha(
      { tipo: 'cliente', valor: c.nome },
      `${titulo(nomeCliente(c.nome))}${sub(`${c.ativas} em andamento`)}`, 'ver o que é dele · Enter'))),
    bloco('conteudos', 'Conteúdos', cortar('conteudos', r.andamento.filter((i) => !ehDemanda(i)))),
    bloco('demandas', 'Demandas', cortar('demandas', r.andamento.filter((i) => ehDemanda(i)))),
    bloco('pessoas', 'Pessoas', r.pessoas.slice(0, SPOTLIGHT_POR_ATALHO).map((p) => linha(
      { tipo: 'pessoa', valor: p.id, rotulo: p.nome },
      `<span class="spotlight-avatar" aria-hidden="true">${safeText(String(p.nome || '?').trim().slice(0, 2).toUpperCase())}</span>${titulo(spotlightRealce(p.nome, q))}${sub(`${p.ativas} em andamento`)}`,
      'ver atividades · Enter'))),
    bloco('encerradas', 'Finalizadas e antigas', cortar('encerradas', r.encerradas)),
  ].join('');

  SPOTLIGHT.opcoes = opcoes;
  if (SPOTLIGHT.ativo >= opcoes.length) SPOTLIGHT.ativo = Math.max(0, opcoes.length - 1);
  const lista = d.querySelector('#spotlight-lista');
  const precisaDeTexto = !SPOTLIGHT.escopo && spotlightNormalizar(q).length < 2;
  // Busca vazia útil (quadro 09): o que a pessoa abriu por último e os atalhos do dia, antes de digitar.
  const inicio = !html && precisaDeTexto ? spotlightInicioHtml({ bloco, linha, atividade }) : '';
  lista.innerHTML = html || inicio || `<div class="spotlight-vazio">${precisaDeTexto
    ? 'Digite o nome de um cliente, conteúdo, demanda ou pessoa.'
    : `Nada encontrado para “${safeText(q.trim() || (SPOTLIGHT.escopo?.rotulo || ''))}”.`}</div>`;
  spotlightMarcarAtivo();

  // Pé da janela: os atalhos do teclado numa frase; o que ainda está carregando vem antes.
  const partes = [];
  if (SPOTLIGHT.carregando) partes.push('carregando solicitações…');
  else if (!spotlightItens().length) partes.push('as atividades ainda estão carregando');
  partes.push('setas navegam · Enter abre · Tab filtra');
  d.querySelector('.spotlight-rodape').innerHTML = `<span>${partes.join(' · ')}</span>`;
}

function spotlightInicioHtml({ bloco, linha, atividade }) {
  const itensPorId = new Map(spotlightItens().map((i) => [String(i.id), i]));
  const recentes = spotlightLerRecentes().map((rc) => {
    if (rc.tipo === 'item') { const it = itensPorId.get(rc.valor); return it ? atividade(it) : ''; }
    if (rc.tipo === 'cliente') return linha({ tipo: 'cliente', valor: rc.valor },
      `<span class="spotlight-titulo">${typeof cliCor === 'function' ? cliCor(rc.valor) : safeText(rc.valor)}</span><span class="spotlight-sub">cliente</span>`, 'ver o que é dele · Enter');
    return '';
  }).filter(Boolean);
  let hoje = null;
  try { hoje = typeof kpisDoTopo === 'function' ? kpisDoTopo() : null; } catch { hoje = null; }
  const atalhos = [];
  if (document.querySelector?.('[data-submodulo="tarefas"], [data-trilho="tarefas"]')) atalhos.push(linha({ tipo: 'atalho', fazer: () => document.querySelector('[data-submodulo="tarefas"], [data-trilho="tarefas"]')?.click() },
    `<span class="spotlight-titulo">Minhas tarefas de hoje</span>${hoje ? `<span class="spotlight-sub">${hoje.hoje} para hoje</span>` : ''}`, 'abrir · Enter'));
  if (typeof openCadastrosGoverned === 'function') atalhos.push(linha({ tipo: 'atalho', fazer: () => openCadastrosGoverned() },
    '<span class="spotlight-titulo">Criar conteúdo ou demanda</span>', 'abrir · Enter'));
  const blocos = bloco('recentes', 'Continuar de onde parou', recentes) + bloco('atalhos', 'Atalhos', atalhos);
  return blocos;
}

function spotlightMarcarAtivo() {
  const d = SPOTLIGHT_DIALOGO;
  const input = d.querySelector('#spotlight-input');
  d.querySelectorAll('.spotlight-linha').forEach((l) => {
    const ativo = Number(l.dataset.opcao) === SPOTLIGHT.ativo;
    l.setAttribute('aria-selected', String(ativo));
    if (ativo) l.scrollIntoView({ block: 'nearest' });
  });
  if (SPOTLIGHT.opcoes.length) input.setAttribute('aria-activedescendant', `spot-o-${SPOTLIGHT.ativo}`);
  else input.removeAttribute('aria-activedescendant');
}

function spotlightTeclado(e) {
  const total = SPOTLIGHT.opcoes.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!total) return;
    SPOTLIGHT.ativo = (SPOTLIGHT.ativo + (e.key === 'ArrowDown' ? 1 : -1) + total) % total;
    spotlightMarcarAtivo();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (total) spotlightAcionar(SPOTLIGHT.ativo);
  } else if (e.key === 'Tab' && !e.shiftKey && ['cliente', 'pessoa'].includes(SPOTLIGHT.opcoes[SPOTLIGHT.ativo]?.tipo)) {
    e.preventDefault();
    spotlightAcionar(SPOTLIGHT.ativo);
  } else if (e.key === 'Backspace' && !e.target.value && SPOTLIGHT.escopo) {
    e.preventDefault();
    spotlightTirarEscopo();
  }
}

function spotlightAcionar(indice) {
  const acao = SPOTLIGHT.opcoes[indice];
  const d = SPOTLIGHT_DIALOGO;
  const input = d.querySelector('#spotlight-input');
  if (!acao) return;
  if (acao.tipo === 'atalho') { d.close(); acao.fazer?.(); return; }
  if (acao.tipo === 'item') {
    spotlightGuardarRecente('item', acao.id);
    d.close();
    if (typeof openItemWorkspace === 'function') openItemWorkspace(acao.id);
    return;
  }
  if (acao.tipo === 'mais') { SPOTLIGHT.abertos.add(acao.bloco); spotlightPintar(); return; }
  if (acao.tipo === 'cliente') spotlightGuardarRecente('cliente', acao.valor);
  SPOTLIGHT.escopo = { tipo: acao.tipo, valor: acao.valor, rotulo: acao.rotulo || acao.valor };
  SPOTLIGHT.consulta = ''; input.value = '';
  SPOTLIGHT.ativo = 0; SPOTLIGHT.abertos.clear();
  spotlightPintar(); input.focus();
}

document.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return;
  if (document.body.classList.contains('auth-pending')) return;
  e.preventDefault();
  if (SPOTLIGHT_DIALOGO?.open) SPOTLIGHT_DIALOGO.close();
  else abrirSpotlight();
});
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-spotlight]')) abrirSpotlight();
});
if (typeof addEventListener === 'function') addEventListener('resize', () => { if (SPOTLIGHT_DIALOGO?.open) spotlightPosicionar(SPOTLIGHT_DIALOGO); });
