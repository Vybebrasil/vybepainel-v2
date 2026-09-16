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
const SPOTLIGHT_POR_BLOCO = 8;
const SPOTLIGHT_POR_ATALHO = 5;
const SPOTLIGHT_ABAS = [
  ['tudo', 'Tudo'], ['conteudos', 'Conteúdos'], ['demandas', 'Demandas'],
  ['clientes', 'Clientes'], ['pessoas', 'Pessoas'],
];

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

const SPOTLIGHT_ICONES = {
  busca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2" stroke-linecap="round"/></svg>',
  conteudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m4 16 4.5-4.5 3 3L15 11l5 5" stroke-linejoin="round"/><circle cx="9" cy="9" r="1.4"/></svg>',
  demanda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 3h6v3H9z" stroke-linejoin="round"/><path d="m8.5 13 2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cliente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.6l2 2H18a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5Z" stroke-linejoin="round"/></svg>',
};

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
  d.setAttribute('aria-label', 'Buscar no painel');
  d.innerHTML = `<div class="spotlight-campo">
      <span class="spotlight-lupa">${SPOTLIGHT_ICONES.busca}</span>
      <span class="spotlight-escopo" hidden></span>
      <input id="spotlight-input" type="search" role="combobox" aria-expanded="true" aria-controls="spotlight-lista"
        aria-autocomplete="list" autocomplete="off" spellcheck="false"
        placeholder="Buscar conteúdos, demandas, clientes e pessoas">
      <kbd class="spotlight-tecla">esc</kbd>
    </div>
    <div class="spotlight-abas" role="tablist" aria-label="Filtrar resultados">${SPOTLIGHT_ABAS.map(([chave, rotulo]) =>
      `<button type="button" role="tab" data-aba="${chave}" aria-selected="${chave === 'tudo'}">${rotulo}</button>`).join('')}</div>
    <div id="spotlight-lista" class="spotlight-lista" role="listbox" aria-label="Resultados"></div>
    <div class="spotlight-rodape" aria-live="polite"></div>`;
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
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  SPOTLIGHT_DIALOGO = d;
  return d;
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
  if (!d.open) d.showModal();
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
    ? `Buscar em ${SPOTLIGHT.escopo.rotulo}` : 'Buscar conteúdos, demandas, clientes e pessoas';

  const opcoes = [];
  const q = SPOTLIGHT.consulta;
  const bloco = (id, titulo, linhas) => linhas.length
    ? `<div role="group" aria-labelledby="spot-g-${id}"><div id="spot-g-${id}" class="spotlight-grupo" role="presentation">${titulo}</div>${linhas.join('')}</div>` : '';
  const linha = (acao, conteudo, dica) => {
    const i = opcoes.push(acao) - 1;
    return `<div id="spot-o-${i}" class="spotlight-linha" role="option" aria-selected="false" data-opcao="${i}">${conteudo}${dica ? `<span class="spotlight-dica">${dica}</span>` : ''}</div>`;
  };
  const atividade = (item) => {
    const demanda = typeof isRequestItem === 'function' ? isRequestItem(item) : item.origem === 'solicitacao';
    const clientes = spotlightClientes(item);
    const data = spotlightDataBr(spotlightDataDoItem(item));
    const tipo = demanda ? (item.tipo || 'Solicitação') : (item.formato || 'Conteúdo');
    const pill = demanda && typeof pillHtmlDemanda === 'function'
      ? pillHtmlDemanda(item.status, item.status_color, item.status_border)
      : (typeof pillHtml === 'function' ? pillHtml(item.status || 'Sem status', item.status_color, item.status_border) : safeText(item.status || ''));
    const meta = [`<span class="spotlight-origem">${demanda ? 'Demanda' : 'Conteúdo'}</span>`,
      spotlightRealce(tipo, q), clientes.length ? spotlightRealce(clientes.join(', '), q) : '',
      data ? `${demanda ? 'Conclusão' : 'Veiculação'} ${data}` : 'Sem data'].filter(Boolean).join(' · ');
    return linha({ tipo: 'item', id: item.id },
      `<span class="spotlight-icone ${demanda ? 'is-demanda' : ''}">${demanda ? SPOTLIGHT_ICONES.demanda : SPOTLIGHT_ICONES.conteudo}</span>
       <span class="spotlight-textos"><span class="spotlight-titulo">${spotlightRealce(item.nome || 'Sem título', q)}</span>
       <span class="spotlight-meta">${meta}</span></span>${pill}`, 'Abrir ↵');
  };
  const cortar = (id, lista) => {
    if (SPOTLIGHT.abertos.has(id) || lista.length <= SPOTLIGHT_POR_BLOCO) return lista.map(atividade);
    return [...lista.slice(0, SPOTLIGHT_POR_BLOCO).map(atividade),
      linha({ tipo: 'mais', bloco: id }, `<span class="spotlight-mais">Mostrar todas (${lista.length})</span>`)];
  };

  const html = [
    bloco('clientes', 'Clientes', r.clientes.slice(0, SPOTLIGHT_POR_ATALHO).map((c) => linha(
      { tipo: 'cliente', valor: c.nome },
      `<span class="spotlight-icone is-cliente">${SPOTLIGHT_ICONES.cliente}</span>
       <span class="spotlight-textos"><span class="spotlight-titulo">${spotlightRealce(c.nome, q)}</span>
       <span class="spotlight-meta">${c.ativas} em andamento · ${c.total} no total</span></span>`,
      `Buscar em ${safeText(c.nome)} <kbd>tab</kbd>`))),
    bloco('andamento', 'Em andamento', cortar('andamento', r.andamento)),
    bloco('pessoas', 'Pessoas', r.pessoas.slice(0, SPOTLIGHT_POR_ATALHO).map((p) => linha(
      { tipo: 'pessoa', valor: p.id, rotulo: p.nome },
      `<span class="spotlight-avatar">${typeof ownerAvatarHtml === 'function' ? ownerAvatarHtml(p.pessoa) : ''}</span>
       <span class="spotlight-textos"><span class="spotlight-titulo">${spotlightRealce(p.nome, q)}</span>
       <span class="spotlight-meta">${p.ativas} em andamento</span></span>`,
      `Ver atividades <kbd>tab</kbd>`))),
    bloco('encerradas', 'Finalizadas e antigas', cortar('encerradas', r.encerradas)),
  ].join('');

  SPOTLIGHT.opcoes = opcoes;
  if (SPOTLIGHT.ativo >= opcoes.length) SPOTLIGHT.ativo = Math.max(0, opcoes.length - 1);
  const lista = d.querySelector('#spotlight-lista');
  const precisaDeTexto = !SPOTLIGHT.escopo && spotlightNormalizar(q).length < 2;
  lista.innerHTML = html || `<div class="spotlight-vazio">${precisaDeTexto
    ? 'Digite o nome de um cliente, conteúdo, demanda ou pessoa.'
    : `Nada encontrado para “${safeText(q.trim() || (SPOTLIGHT.escopo?.rotulo || ''))}”.`}</div>`;
  spotlightMarcarAtivo();

  const partes = [];
  if (!precisaDeTexto) partes.push(`${r.andamento.length} em andamento`, `${r.encerradas.length} finalizadas e antigas`);
  if (SPOTLIGHT.carregando) partes.push('carregando solicitações…');
  else if (!spotlightItens().length) partes.push('as atividades ainda estão carregando');
  d.querySelector('.spotlight-rodape').innerHTML = `<span>${partes.join(' · ')}</span>
    <span class="spotlight-atalhos"><kbd>↑</kbd><kbd>↓</kbd> navegar <kbd>↵</kbd> abrir <kbd>tab</kbd> filtrar</span>`;
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
  if (acao.tipo === 'item') {
    d.close();
    if (typeof openItemWorkspace === 'function') openItemWorkspace(acao.id);
    return;
  }
  if (acao.tipo === 'mais') { SPOTLIGHT.abertos.add(acao.bloco); spotlightPintar(); return; }
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
