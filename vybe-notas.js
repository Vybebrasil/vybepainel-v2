// vybe-notas.js — o caderno de quem usa o painel.
//
// É uma JANELA SOLTA, não um painel preso na borda: quem anota está no meio de
// outra coisa — atendendo, conduzindo o dia — e precisa da nota do lado do
// trabalho, não no lugar dele. Arrasta pelo topo, redimensiona pelo canto,
// expande para a tela inteira, encolhe para uma barrinha e volta onde estava,
// do tamanho que estava.
//
// Cada nota vive num CADERNO ("Notas do dia", "Clientes", "Ideias"), que é
// etiqueta: renomear é renomear em todas as notas dele, e apagar oferece mover.
// A escrita é texto simples com marcas (# título, - lista, [] caixinha,
// **negrito**), para a nota continuar sendo texto que se copia e se lê em
// qualquer lugar. A barra de ferramentas e o painel de emoji só escrevem essas
// marcas no lugar do cursor.
//
// A leitura da lista usa notasMarkdownHtml; dentro da nota, cada linha se edita
// no lugar. As regras de linha (Enter, Backspace, marca) são funções sem tela, e
// é nelas que os testes entram.
//
// No mundo (quadro "Janelas do topo", 12/11/2026) as Notas abrem como as outras
// janelas do topo: 340 de largura, embaixo do ícone, com a busca, os cadernos em
// fichas e a lista; a nota abre no lugar da lista. "Abrir grande", no cabeçalho,
// leva para a janela solta de sempre (arrastar, redimensionar, expandir, menu do
// caderno, demanda ligada), com a mesma nota aberta.

const NOTAS_GEOMETRIA = 'vybe_notas_janela_v1';
const CADERNO_PADRAO_TELA = 'Notas do dia';
let NOTAS = [];
let NOTAS_CADERNOS = [];
let NOTA_ABERTA = null;
let NOTAS_CADERNO = CADERNO_PADRAO_TELA;
let NOTAS_BUSCA = '';
let NOTAS_BUSCA_TIMER = null;
let NOTAS_SALVANDO = null;
let NOTAS_ESTADO = 'lista';   // 'lista' | 'nota'
let NOTAS_EMOJI_ABERTO = false;
let NOTA_LINHAS = [];       // a nota aberta, linha por linha
let NOTA_FOCO = null;       // qual linha está sendo escrita
let NOTA_FIM = null;        // onde o cursor entra na linha ('fim' ou posição)
let NOTA_BUSCA_PECA = null; // texto digitado na busca de demanda, ou null (fechada)

// Emojis do dia a dia da operação, por grupo. Vêm daqui e não de uma biblioteca:
// o painel bloqueia conteúdo de fora, e o teclado do sistema continua valendo.
const NOTAS_EMOJIS = [
  ['Trabalho', '✅ ☑️ ⏳ ⚠️ ⛔ 🔥 📌 📝 📅 🕐 ✔️ ❗ ❓ 🔁 ➡️ ⭐ 💡 🎯 🧠 🚀'],
  ['Produção', '🎬 🎥 📸 🖼️ 🎨 ✏️ 🖌️ 📱 💻 🎧 🎤 🗂️ 📂 🔗 📊 📈 🧾 🛠️ 🧩 🪄'],
  ['Pessoas', '🙂 😀 😅 😍 🤔 😐 😴 🙏 👏 👍 👎 💪 🤝 👀 🫡 🥳 😤 😬 🤯 🫶'],
  ['Cliente', '💬 📞 📧 💰 🧿 🏷️ 🛒 🏆 🎁 ❤️ 🧡 💙 💚 💜 🖤 🤍 🟠 🔴 🟢 🔵'],
];

// ── escrita simples ──────────────────────────────────────────────────────────
function notasMarkdownHtml(texto = '') {
  const linhas = String(texto).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let lista = null;
  const fechar = () => { if (lista) { html.push(lista === 'check' ? '</div>' : '</ul>'); lista = null; } };
  const inline = (t) => safeText(t)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  linhas.forEach((linha, indice) => {
    const l = linha.trimEnd();
    const marca = l.match(/^\s*\[( |x|X)?\]\s?(.*)$/);
    if (marca) {
      if (lista !== 'check') { fechar(); html.push('<div class="nota-checks">'); lista = 'check'; }
      const feito = /x/i.test(marca[1] || '');
      html.push(`<label class="nota-check ${feito ? 'feito' : ''}"><input type="checkbox" ${feito ? 'checked' : ''}
        onchange="marcarNaNota(${indice})"><span>${inline(marca[2])}</span></label>`);
      return;
    }
    const item = l.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      if (lista !== 'ul') { fechar(); html.push('<ul>'); lista = 'ul'; }
      html.push(`<li>${inline(item[1])}</li>`);
      return;
    }
    fechar();
    const titulo = l.match(/^(#{1,3})\s+(.*)$/);
    if (titulo) { html.push(`<h${titulo[1].length + 2}>${inline(titulo[2])}</h${titulo[1].length + 2}>`); return; }
    if (!l.trim()) { html.push('<p class="nota-vazia"></p>'); return; }
    html.push(`<p>${inline(l)}</p>`);
  });
  fechar();
  return html.join('');
}

// ── linhas ───────────────────────────────────────────────────────────────────
//
// A nota é uma lista de LINHAS, e cada linha tem uma marca. Assim a caixinha
// aparece enquanto se escreve, o Enter continua a lista e o texto guardado
// continua sendo texto ("[] fazer", "- item", "# título").
const NOTAS_MARCAS_LINHA = [
  { marca: 'check', re: /^\s*\[\s?\]\s?/, prefixo: '[] ' },
  { marca: 'check-feito', re: /^\s*\[[xX]\]\s?/, prefixo: '[x] ' },
  { marca: 'lista', re: /^\s*[-*]\s+/, prefixo: '- ' },
  { marca: 'titulo', re: /^\s*#\s+/, prefixo: '# ' },
  { marca: 'titulo2', re: /^\s*##\s+/, prefixo: '## ' },
];
function notasLerLinha(linha = '') {
  const texto = String(linha ?? '');
  // Títulos maiores primeiro: '## ' também casa com a regra de '# '.
  for (const m of [...NOTAS_MARCAS_LINHA].reverse()) {
    if (m.re.test(texto)) return { marca: m.marca, texto: texto.replace(m.re, '') };
  }
  return { marca: '', texto };
}
function notasMontarLinha(marca, texto) {
  const m = NOTAS_MARCAS_LINHA.find((x) => x.marca === marca);
  return m ? `${m.prefixo}${texto}` : String(texto ?? '');
}
// Enter: continua a lista. Numa linha de lista já vazia, o Enter SAI da lista —
// é como o Notion e as Notas do Mac se comportam, e sem isso a única forma de
// sair era apagar a marca à mão.
function notasEnter(linhas, indice, texto = '') {
  const lista = [...linhas];
  const { marca } = notasLerLinha(lista[indice] ?? '');
  const antes = String(texto ?? '');
  if (marca && !antes.trim()) {
    lista[indice] = '';
    return { linhas: lista, foco: indice };
  }
  lista[indice] = notasMontarLinha(marca, antes);
  const seguinte = marca === 'titulo' || marca === 'titulo2' ? '' : notasMontarLinha(marca, '');
  lista.splice(indice + 1, 0, seguinte);
  return { linhas: lista, foco: indice + 1 };
}
// Backspace no começo da linha: primeiro tira a marca, depois junta com a de
// cima. Nunca apaga texto de outra linha sem juntar.
function notasBackspace(linhas, indice, texto = '') {
  const lista = [...linhas];
  const { marca } = notasLerLinha(lista[indice] ?? '');
  if (marca) { lista[indice] = String(texto ?? ''); return { linhas: lista, foco: indice, fim: 0 }; }
  if (indice === 0) return { linhas: lista, foco: 0, fim: 0 };
  const anterior = notasLerLinha(lista[indice - 1] ?? '');
  const juntado = anterior.texto + String(texto ?? '');
  lista[indice - 1] = notasMontarLinha(anterior.marca, juntado);
  lista.splice(indice, 1);
  return { linhas: lista, foco: indice - 1, fim: anterior.texto.length };
}
function notasTrocarMarca(linhas, indice, marca) {
  const lista = [...linhas];
  const atual = notasLerLinha(lista[indice] ?? '');
  const nova = atual.marca === marca ? '' : marca;
  lista[indice] = notasMontarLinha(nova, atual.texto);
  return { linhas: lista, foco: indice };
}

function notasResumo(nota) {
  const corpo = String(nota.corpo || '').replace(/[#*`\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return corpo.slice(0, 110) + (corpo.length > 110 ? '…' : '');
}

function notasTituloPadrao() {
  const hoje = HOJE_ISO || new Date().toISOString().slice(0, 10);
  return `${hoje.slice(8, 10)}/${hoje.slice(5, 7)} · notas do dia`;
}

// ── janela ───────────────────────────────────────────────────────────────────
function notasGeometria() {
  try { return JSON.parse(localStorage.getItem(NOTAS_GEOMETRIA) || '{}') || {}; } catch { return {}; }
}
function notasGuardarGeometria(mudanca) {
  try { localStorage.setItem(NOTAS_GEOMETRIA, JSON.stringify({ ...notasGeometria(), ...mudanca })); } catch { /* sem memória, tudo bem */ }
}

// No mundo as Notas abrem na janela do topo (#v2-notas); a janela grande (#notas-janela) é a de arrastar e redimensionar.
const notasNoMundo = () => Boolean(document.body?.classList?.contains('mundo'));
const notasJanela = () => document.getElementById('v2-notas') || document.getElementById('notas-janela');
const NOTAS_ICONES = {
  expandir: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  reduzir: '<path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/>',
  encolher: '<path d="M5 12h14"/>',
  janela: '<rect x="4" y="5" width="16" height="14" rx="2"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  voltar: '<path d="M15 6l-6 6 6 6"/>',
  renomear: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  apagar: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  mais: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
};
const notasIcone = (nome) => `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${NOTAS_ICONES[nome] || ''}</svg>`;

function notasAplicarGeometria(janela) {
  const g = notasGeometria();
  if (g.modo === 'cheia') { janela.classList.add('cheia'); return; }
  if (g.modo === 'barra') { janela.classList.add('barra'); }
  const largura = Math.min(Math.max(Number(g.largura) || 520, 340), window.innerWidth - 16);
  const altura = Math.min(Math.max(Number(g.altura) || 560, 240), window.innerHeight - 16);
  const esquerda = Math.min(Math.max(Number(g.esquerda ?? (window.innerWidth - largura - 24)), 8), Math.max(8, window.innerWidth - largura - 8));
  const topo = Math.min(Math.max(Number(g.topo ?? 96), 8), Math.max(8, window.innerHeight - 80));
  Object.assign(janela.style, { width: `${largura}px`, height: `${altura}px`, left: `${esquerda}px`, top: `${topo}px` });
}

// Arrastar pelo topo e redimensionar pelo canto, com ponteiro: serve para mouse
// e para dedo, e não depende de biblioteca.
function notasArrastar(evento) {
  const janela = document.getElementById('notas-janela');
  if (!janela || janela.classList.contains('cheia') || evento.target.closest('button')) return;
  const inicio = janela.getBoundingClientRect();
  const x0 = evento.clientX, y0 = evento.clientY;
  const mover = (e) => {
    const esquerda = Math.min(Math.max(inicio.left + (e.clientX - x0), 8), window.innerWidth - inicio.width - 8);
    const topo = Math.min(Math.max(inicio.top + (e.clientY - y0), 8), window.innerHeight - 60);
    janela.style.left = `${esquerda}px`; janela.style.top = `${topo}px`;
  };
  const soltar = () => {
    document.removeEventListener('pointermove', mover);
    document.removeEventListener('pointerup', soltar);
    const r = janela.getBoundingClientRect();
    notasGuardarGeometria({ esquerda: Math.round(r.left), topo: Math.round(r.top) });
  };
  document.addEventListener('pointermove', mover);
  document.addEventListener('pointerup', soltar);
}

function notasRedimensionar(evento) {
  const janela = document.getElementById('notas-janela');
  if (!janela) return;
  evento.preventDefault();
  const inicio = janela.getBoundingClientRect();
  const x0 = evento.clientX, y0 = evento.clientY;
  const mover = (e) => {
    const largura = Math.min(Math.max(inicio.width + (e.clientX - x0), 340), window.innerWidth - inicio.left - 8);
    const altura = Math.min(Math.max(inicio.height + (e.clientY - y0), 240), window.innerHeight - inicio.top - 8);
    janela.style.width = `${largura}px`; janela.style.height = `${altura}px`;
  };
  const soltar = () => {
    document.removeEventListener('pointermove', mover);
    document.removeEventListener('pointerup', soltar);
    const r = janela.getBoundingClientRect();
    notasGuardarGeometria({ largura: Math.round(r.width), altura: Math.round(r.height) });
  };
  document.addEventListener('pointermove', mover);
  document.addEventListener('pointerup', soltar);
}

function expandirNotas() {
  const janela = document.getElementById('notas-janela');
  if (!janela) return;
  janela.classList.remove('barra');
  const cheia = janela.classList.toggle('cheia');
  notasGuardarGeometria({ modo: cheia ? 'cheia' : 'solta' });
  if (!cheia) notasAplicarGeometria(janela);
  pintarNotas();
}

function encolherNotas() {
  const janela = document.getElementById('notas-janela');
  if (!janela) return;
  janela.classList.remove('cheia');
  const barra = janela.classList.toggle('barra');
  notasGuardarGeometria({ modo: barra ? 'barra' : 'solta' });
  if (!barra) notasAplicarGeometria(janela);
  pintarNotas();
}

// ── servidor ─────────────────────────────────────────────────────────────────
async function notasPedir(caminho, opcoes = {}) {
  const r = await fetch(`/api/painel?area=notas${caminho}`, { credentials: 'same-origin', cache: 'no-store', ...opcoes });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d?.ok) throw new Error(d?.error || `Notas indisponíveis (${r.status})`);
  return d;
}

async function abrirNotas() {
  // A janela grande já aberta volta para a frente, como estava.
  const existente = document.getElementById('notas-janela');
  if (existente) { existente.classList.remove('barra'); notasGuardarGeometria({ modo: 'solta' }); notasAplicarGeometria(existente); return pintarNotas(); }
  // No mundo, o ícone abre e fecha a janela do topo.
  if (notasNoMundo()) return document.getElementById('v2-notas') ? fecharNotas() : abrirNotasNoTopo();
  criarNotasGrande();
  NOTAS_ESTADO = 'lista'; NOTA_ABERTA = null; NOTAS_BUSCA = '';
  await recarregarNotas();
}

function criarNotasGrande() {
  const janela = document.createElement('section');
  janela.id = 'notas-janela';
  janela.className = 'notas-janela';
  janela.setAttribute('role', 'dialog');
  janela.setAttribute('aria-label', 'Suas notas');
  janela.innerHTML = '<div class="workspace-loading">Carregando suas notas…</div>';
  document.body.append(janela);
  notasAplicarGeometria(janela);
  return janela;
}

// ── janela do topo ───────────────────────────────────────────────────────────
// Quadro "Janelas do topo": cabeçalho com o nome, a etiqueta, "Abrir grande" e o
// X redondo; no corpo a busca, os cadernos em fichas e a lista; no pé a dica e
// "Nova nota". A nota abre no lugar da lista, com a mesma escrita por linhas.
async function abrirNotasNoTopo() {
  const janela = document.createElement('section');
  janela.id = 'v2-notas';
  janela.className = 'v2nt';
  janela.setAttribute('role', 'dialog');
  janela.setAttribute('aria-labelledby', 'v2nt-titulo');
  janela.innerHTML = `${notasCabTopoHtml()}<div class="v2nt-corpo"><p class="v2nt-vazio">Carregando suas notas…</p></div>`;
  document.body.append(janela);
  notasColocarNoTopo();
  document.querySelector('[data-ferr="notas"]')?.setAttribute('aria-expanded', 'true');
  setTimeout(() => document.addEventListener('pointerdown', notasForaDoTopo, true), 0);
  NOTAS_ESTADO = 'lista'; NOTA_ABERTA = null; NOTAS_BUSCA = '';
  await recarregarNotas();
  janela.querySelector('.v2nt-busca')?.focus({ preventScroll: true });
}

function notasColocarNoTopo() {
  const janela = document.getElementById('v2-notas');
  if (janela && typeof colocarJanelaDoTopo === 'function') colocarJanelaDoTopo(janela, '[data-ferr="notas"]');
}

// Clicar fora fecha (o que estava escrito é salvo pelo fecharNotas). As caixas
// de confirmação do painel e o menu do "Mais" não contam como fora.
function notasForaDoTopo(evento) {
  if (!document.getElementById('v2-notas')) { document.removeEventListener('pointerdown', notasForaDoTopo, true); return; }
  if (evento.target?.closest?.('#v2-notas, [data-ferr="notas"], .vv-mais-menu, dialog, #cli-pergunta, .workflow-modal, #workflow-modal, .vv-cel-mais')) return;
  fecharNotas();
}

// "Abrir grande": a janela de sempre, com a mesma lista ou a mesma nota aberta.
function abrirNotasGrande() {
  capturarLinhaAberta();
  const pequena = document.getElementById('v2-notas');
  pequena?.remove();
  document.removeEventListener('pointerdown', notasForaDoTopo, true);
  document.querySelector('[data-ferr="notas"]')?.setAttribute('aria-expanded', 'false');
  NOTAS_EMOJI_ABERTO = false;
  const janela = criarNotasGrande();
  janela.classList.remove('barra', 'cheia');
  notasGuardarGeometria({ modo: 'solta' });
  notasAplicarGeometria(janela);
  pintarNotas();
}

function notasCabTopoHtml() {
  const naNota = NOTAS_ESTADO === 'nota' && NOTA_ABERTA;
  const total = NOTAS_BUSCA ? NOTAS.length : NOTAS_CADERNOS.reduce((t, c) => t + (Number(c.notas) || 0), 0);
  const etiqueta = naNota ? '' : NOTAS_BUSCA
    ? `${total} ${total === 1 ? 'achada' : 'achadas'}`
    : `${total} ${total === 1 ? 'nota' : 'notas'}`;
  return `<div class="v2nt-cab">
      ${naNota ? `<button type="button" class="v2nt-ib" onclick="voltarParaAsNotas()" aria-label="Voltar para as notas" title="Voltar para as notas">${notasIcone('voltar')}</button>` : ''}
      <h2 id="v2nt-titulo">Notas</h2>
      ${etiqueta ? `<span class="v2nt-pill">${safeText(etiqueta)}</span>` : ''}
      <button type="button" class="v2nt-btn" onclick="abrirNotasGrande()" title="Abrir a janela grande: arrastar, redimensionar, menu do caderno e demanda ligada">Abrir grande</button>
      <button type="button" class="v2nt-ib" onclick="fecharNotas()" aria-label="Fechar as notas" title="Fechar (Esc)">${notasIcone('fechar')}</button>
    </div>`;
}

function pintarNotasNoTopo() {
  const janela = document.getElementById('v2-notas');
  if (!janela) return;
  const doCaderno = NOTAS.filter((n) => NOTAS_BUSCA || (n.caderno || CADERNO_PADRAO_TELA) === NOTAS_CADERNO);
  const linhas = doCaderno.map((n) => {
    const peca = n.item_ref && typeof findOperationalItem === 'function' ? findOperationalItem(n.item_ref) : null;
    const sub = NOTAS_BUSCA ? (n.caderno || CADERNO_PADRAO_TELA) : (typeof quandoNaBahia === 'function' ? quandoNaBahia(n.atualizado_em) : '');
    return `<button type="button" class="v2nt-r" onclick="abrirNota(${Number(n.id)})" title="${safeText(notasResumo(n) || 'Nota vazia')}">
        <span class="v2nt-r-txt"><b>${safeText(n.titulo || 'Sem título')}</b>${n.item_ref ? `<small>sobre ${safeText(peca?.nome || n.item_ref)}</small>` : ''}</span>
        <span class="v2nt-sub">${safeText(sub)}</span></button>`;
  }).join('');
  const fichas = NOTAS_CADERNOS.map((c) => `<button type="button" class="v2nt-chip" aria-pressed="${c.nome === NOTAS_CADERNO && !NOTAS_BUSCA}"
      onclick="escolherCaderno(decodeURIComponent('${encodeURIComponent(c.nome)}'))">${safeText(c.nome)}<i>${Number(c.notas) || 0}</i></button>`).join('');
  const rotulo = NOTAS_BUSCA ? 'Em todos os cadernos' : NOTAS_CADERNO;
  const corpo = janela.querySelector('.v2nt-corpo');
  const rolagem = corpo ? corpo.scrollTop : 0;
  janela.innerHTML = `${notasCabTopoHtml()}
    <div class="v2nt-corpo">
      <div class="v2nt-campo"><input class="v2nt-busca" type="search" placeholder="Buscar nas notas" value="${safeText(NOTAS_BUSCA)}"
        oninput="buscarNotas(this.value)" aria-label="Buscar nas suas notas"></div>
      <div class="v2nt-fichas" role="group" aria-label="Cadernos">${fichas}<button type="button" class="v2nt-chip v2nt-chip-novo" onclick="novoCaderno()">+ Caderno</button></div>
      <p class="v2nt-g">${safeText(rotulo)}</p>
      ${linhas || `<p class="v2nt-vazio">${NOTAS_BUSCA ? 'Nenhuma nota com essa palavra.' : 'Caderno vazio. Crie a primeira nota.'}</p>`}
    </div>
    <div class="v2nt-pe"><span class="v2nt-dica">salva sozinha enquanto você escreve</span><button type="button" class="v2nt-btn p" onclick="novaNota()">Nova nota</button></div>`;
  const novo = janela.querySelector('.v2nt-corpo');
  if (novo) novo.scrollTop = rolagem;
}

function pintarNotaNoTopo() {
  const janela = document.getElementById('v2-notas');
  if (!janela || !NOTA_ABERTA) return;
  const peca = NOTA_ABERTA.item_ref && typeof findOperationalItem === 'function' ? findOperationalItem(NOTA_ABERTA.item_ref) : null;
  const de = [NOTA_ABERTA.caderno || CADERNO_PADRAO_TELA, NOTA_ABERTA.item_ref ? `sobre ${peca?.nome || NOTA_ABERTA.item_ref}` : ''].filter(Boolean).join(' · ');
  const b = (rotulo, acao, titulo) => `<button type="button" class="v2nt-chip" onclick="${acao}" title="${titulo}">${rotulo}</button>`;
  janela.innerHTML = `${notasCabTopoHtml()}
    <div class="v2nt-corpo v2nt-nota">
      <input class="v2nt-titulo" value="${safeText(NOTA_ABERTA.titulo)}" placeholder="Título da nota"
        oninput="editarNota('titulo',this.value)" aria-label="Título da nota">
      <p class="v2nt-de">${safeText(de)}</p>
      <div class="v2nt-fichas" role="group" aria-label="Escrever">
        ${b('Título', "aplicarNaNota('titulo')", 'Título da seção')}${b('Lista', "aplicarNaNota('lista')", 'Item de lista')}${b('Caixinha', "aplicarNaNota('check')", 'Caixinha para marcar')}${b('<b>N</b>', "aplicarNaNota('negrito')", 'Negrito')}${b('Emoji', 'alternarEmojis()', 'Inserir emoji')}
      </div>
      ${NOTAS_EMOJI_ABERTO ? notasEmojisHtml() : ''}
      <div class="nota-folha" onclick="if(event.target===this)focarLinha(${NOTA_LINHAS.length - 1})">
        ${NOTA_LINHAS.map(notasLinhaHtml).join('')}
      </div>
    </div>
    <div class="v2nt-pe"><span class="v2nt-dica" id="notas-pe">${NOTA_ABERTA.id
      ? `Salva ${safeText(typeof quandoNaBahia === 'function' ? quandoNaBahia(NOTA_ABERTA.atualizado_em || new Date().toISOString()) : '')}`
      : 'Salva sozinha enquanto você escreve.'}</span><button type="button" class="v2nt-btn" onclick="voltarParaAsNotas()">Pronto</button></div>`;
}

async function recarregarNotas() {
  const janela = notasJanela();
  if (!janela) return;
  try {
    const d = await notasPedir(NOTAS_BUSCA ? `&busca=${encodeURIComponent(NOTAS_BUSCA)}` : '');
    NOTAS = d.notas || [];
    NOTAS_CADERNOS = d.cadernos?.length ? d.cadernos : [{ nome: CADERNO_PADRAO_TELA, notas: 0 }];
    if (!NOTAS_CADERNOS.some((c) => c.nome === NOTAS_CADERNO)) NOTAS_CADERNO = NOTAS_CADERNOS[0].nome;
    pintarNotas();
  } catch (erro) {
    janela.innerHTML = janela.id === 'v2-notas'
      ? `${notasCabTopoHtml()}<div class="v2nt-corpo"><p class="v2nt-vazio">${safeText(erro.message)}</p></div>`
      : `${notasTopoHtml()}<div class="notas-conteudo"><div class="workspace-empty">${safeText(erro.message)}</div></div>${notasCantoHtml()}`;
  }
}

function fecharNotas() {
  capturarLinhaAberta();
  if (NOTAS_SALVANDO) { clearTimeout(NOTAS_SALVANDO); NOTAS_SALVANDO = null; salvarNotaAberta(); }
  const pequena = document.getElementById('v2-notas');
  if (pequena) {
    pequena.remove();
    document.removeEventListener('pointerdown', notasForaDoTopo, true);
    const icone = document.querySelector('[data-ferr="notas"]');
    icone?.setAttribute('aria-expanded', 'false');
  } else document.getElementById('notas-janela')?.remove();
  NOTA_ABERTA = null; NOTAS_ESTADO = 'lista'; NOTAS_EMOJI_ABERTO = false;
  return true;
}

function notasCantoHtml() {
  return '<span class="notas-canto" onpointerdown="notasRedimensionar(event)" title="Arraste para redimensionar"></span>';
}

function notasTopoHtml() {
  const cheia = document.getElementById('notas-janela')?.classList.contains('cheia');
  const barra = document.getElementById('notas-janela')?.classList.contains('barra');
  const naNota = NOTAS_ESTADO === 'nota' && !barra;
  return `<div class="notas-topo" onpointerdown="notasArrastar(event)">
      ${naNota ? `<button type="button" class="notas-voltar" onclick="voltarParaAsNotas()" aria-label="Voltar para as notas">${notasIcone('voltar')}</button>` : ''}
      <b>${naNota ? safeText(NOTA_ABERTA?.titulo || 'Nota') : 'Notas'}</b>
      <div class="notas-topo-acoes">
        ${barra ? '' : `<button type="button" class="notas-icone" onclick="expandirNotas()" title="${cheia ? 'Voltar ao tamanho' : 'Expandir para a tela'}" aria-label="Expandir">${notasIcone(cheia ? 'reduzir' : 'expandir')}</button>`}
        <button type="button" class="notas-icone" onclick="encolherNotas()" title="${barra ? 'Abrir a janela' : 'Encolher para uma barrinha'}" aria-label="Encolher">${notasIcone(barra ? 'janela' : 'encolher')}</button>
        <button type="button" class="notas-icone" onclick="fecharNotas()" title="Fechar" aria-label="Fechar">${notasIcone('fechar')}</button>
      </div>
    </div>`;
}

function pintarNotas() {
  if (document.getElementById('v2-notas')) return NOTAS_ESTADO === 'nota' ? pintarNotaAberta() : pintarNotasNoTopo();
  const janela = document.getElementById('notas-janela');
  if (!janela) return;
  if (janela.classList.contains('barra')) { janela.innerHTML = notasTopoHtml(); return; }
  if (NOTAS_ESTADO === 'nota') return pintarNotaAberta();
  const doCaderno = NOTAS.filter((n) => NOTAS_BUSCA || (n.caderno || CADERNO_PADRAO_TELA) === NOTAS_CADERNO);
  const lista = doCaderno.length
    ? doCaderno.map((n) => {
      const peca = n.item_ref && typeof findOperationalItem === 'function' ? findOperationalItem(n.item_ref) : null;
      return `<button type="button" class="notas-item" onclick="abrirNota(${n.id})">
        <b>${safeText(n.titulo || 'Sem título')}</b>
        <small>${safeText(notasResumo(n) || 'Nota vazia')}</small>
        <span class="notas-item-pe">${safeText(quandoNaBahia(n.atualizado_em))}${
          NOTAS_BUSCA ? ` · ${safeText(n.caderno || CADERNO_PADRAO_TELA)}` : ''}${
          n.item_ref ? ` · sobre ${safeText(peca?.nome || n.item_ref)}` : ''}</span>
      </button>`;
    }).join('')
    : `<div class="workspace-empty">${NOTAS_BUSCA ? 'Nenhuma nota com essa palavra.' : 'Caderno vazio. Crie a primeira nota.'}</div>`;
  const cadernos = NOTAS_CADERNOS.map((c) => `<button type="button" class="notas-caderno ${c.nome === NOTAS_CADERNO && !NOTAS_BUSCA ? 'ativo' : ''}"
      onclick="escolherCaderno(decodeURIComponent('${encodeURIComponent(c.nome)}'))">
      <span>${safeText(c.nome)}</span><i>${c.notas}</i></button>`).join('');
  janela.innerHTML = `${notasTopoHtml()}
    <div class="notas-conteudo">
      <aside class="notas-cadernos">
        ${cadernos}
        <button type="button" class="notas-caderno novo" onclick="novoCaderno()">+ Caderno</button>
        ${NOTAS_CADERNOS.length ? `<details class="notas-menu notas-caderno-acoes">
          <summary class="notas-discreto" aria-label="Mais ações do caderno ${safeText(NOTAS_CADERNO)}" title="Renomear ou apagar o caderno">${notasIcone('mais')}<span>Caderno</span></summary>
          <div class="notas-menu-lista" role="menu">
            <button type="button" role="menuitem" class="notas-discreto" onclick="renomearCadernoAtual()" title="Renomear o caderno ${safeText(NOTAS_CADERNO)}">${notasIcone('renomear')}<span>Renomear</span></button>
            <button type="button" role="menuitem" class="notas-discreto perigo" onclick="apagarCadernoAtual()" title="Apagar o caderno ${safeText(NOTAS_CADERNO)} (as notas vão para outro caderno)">${notasIcone('apagar')}<span>Apagar</span></button></div></details>` : ''}
      </aside>
      <div class="notas-lista">
        <div class="notas-barra">
          <input type="search" placeholder="Buscar em todas as notas…" value="${safeText(NOTAS_BUSCA)}"
            oninput="buscarNotas(this.value)" aria-label="Buscar nas suas notas">
          <button type="button" class="notas-acao primaria" onclick="novaNota()">+ Nova nota</button>
        </div>
        <div class="notas-rolagem">${lista}</div>
      </div>
    </div>${notasCantoHtml()}`;
}

function escolherCaderno(nome) {
  NOTAS_CADERNO = String(nome || CADERNO_PADRAO_TELA);
  NOTAS_BUSCA = '';
  pintarNotas();
}

async function novoCaderno() {
  const nome = await perguntarNoPainel({ titulo: 'Novo caderno', texto: 'Ex.: Clientes, Ideias, Reuniões.',
    confirmar: 'Criar', campo: { valor: '', dica: 'Nome do caderno' } });
  if (!nome || !String(nome).trim()) return;
  NOTAS_CADERNO = String(nome).trim();
  NOTAS_CADERNOS = [{ nome: NOTAS_CADERNO, notas: 0 }, ...NOTAS_CADERNOS.filter((c) => c.nome !== NOTAS_CADERNO)];
  novaNota();
}

async function renomearCadernoAtual() {
  const novo = await perguntarNoPainel({ titulo: `Renomear "${NOTAS_CADERNO}"`,
    texto: 'O nome muda em todas as notas deste caderno.', confirmar: 'Renomear',
    campo: { valor: NOTAS_CADERNO, dica: 'Nome do caderno' } });
  if (!novo || !String(novo).trim() || String(novo).trim() === NOTAS_CADERNO) return;
  try {
    await notasPedir('', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'caderno_renomear', de: NOTAS_CADERNO, para: String(novo).trim() }) });
    NOTAS_CADERNO = String(novo).trim();
    await recarregarNotas();
    showToast('✓ Caderno renomeado', 'ok', 3000);
  } catch (erro) { showToast(erro.message, 'err', 6000); }
}

async function apagarCadernoAtual() {
  const outros = NOTAS_CADERNOS.filter((c) => c.nome !== NOTAS_CADERNO);
  const destino = outros[0]?.nome || CADERNO_PADRAO_TELA;
  const quantas = NOTAS_CADERNOS.find((c) => c.nome === NOTAS_CADERNO)?.notas || 0;
  const sim = await perguntarNoPainel({ titulo: `Apagar o caderno "${NOTAS_CADERNO}"?`,
    texto: quantas ? `As ${quantas} nota${quantas === 1 ? '' : 's'} dele vão para "${destino}" — nada é apagado.`
      : 'O caderno está vazio.', confirmar: 'Apagar caderno' });
  if (!sim) return;
  try {
    await notasPedir('', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'caderno_apagar', caderno: NOTAS_CADERNO, mover: destino }) });
    NOTAS_CADERNO = destino;
    await recarregarNotas();
    showToast(`✓ Caderno apagado · notas em "${destino}"`, 'ok', 4000);
  } catch (erro) { showToast(erro.message, 'err', 6000); }
}

function buscarNotas(termo) {
  NOTAS_BUSCA = String(termo || '');
  clearTimeout(NOTAS_BUSCA_TIMER);
  NOTAS_BUSCA_TIMER = setTimeout(async () => {
    const campo = document.querySelector('.notas-barra input, .v2nt-busca');
    const tinhaFoco = document.activeElement === campo;
    await recarregarNotas();
    if (tinhaFoco) {
      const novo = document.querySelector('.notas-barra input, .v2nt-busca');
      novo?.focus(); novo?.setSelectionRange(novo.value.length, novo.value.length);
    }
  }, 260);
}

function novaNota() {
  NOTA_ABERTA = { id: null, titulo: notasTituloPadrao(), corpo: '', item_ref: '', caderno: NOTAS_CADERNO };
  NOTAS_ESTADO = 'nota';
  NOTA_LINHAS = ['']; NOTA_FOCO = 0; NOTA_FIM = 'fim';
  pintarNotaAberta();
}

function abrirNota(id) {
  const nota = NOTAS.find((n) => Number(n.id) === Number(id));
  if (!nota) return;
  NOTA_ABERTA = { ...nota, caderno: nota.caderno || CADERNO_PADRAO_TELA };
  NOTAS_ESTADO = 'nota';
  NOTA_LINHAS = String(nota.corpo || '').replace(/\r\n/g, '\n').split('\n');
  if (!NOTA_LINHAS.length) NOTA_LINHAS = [''];
  NOTA_FOCO = null;
  pintarNotaAberta();
}

function voltarParaAsNotas() {
  capturarLinhaAberta();
  if (NOTAS_SALVANDO) { clearTimeout(NOTAS_SALVANDO); NOTAS_SALVANDO = null; }
  NOTAS_EMOJI_ABERTO = false;
  salvarNotaAberta().finally(async () => {
    NOTA_ABERTA = null; NOTAS_ESTADO = 'lista'; NOTA_LINHAS = []; NOTA_FOCO = null;
    await recarregarNotas();
  });
}

function notasFerramentasHtml() {
  const b = (rotulo, acao, titulo) => `<button type="button" onclick="${acao}" title="${titulo}">${rotulo}</button>`;
  return `<div class="notas-ferramentas">
      ${b('# Título', "aplicarNaNota('titulo')", 'Título da seção')}
      ${b('• Lista', "aplicarNaNota('lista')", 'Item de lista')}
      ${b('☑ Checklist', "aplicarNaNota('check')", 'Caixinha para marcar')}
      ${b('<b>N</b>', "aplicarNaNota('negrito')", 'Negrito')}
      ${b('😀 Emoji', 'alternarEmojis()', 'Inserir emoji')}
      <span class="notas-ferramentas-fim">
        <button type="button" class="notas-acao" onclick="salvarNotaAgora()">Salvar</button>
        <details class="notas-menu"><summary class="notas-icone" aria-label="Mais ações da nota" title="Mais ações da nota">${notasIcone('mais')}</summary>
          <div class="notas-menu-lista" role="menu"><button type="button" role="menuitem" class="notas-discreto perigo" onclick="apagarNotaAberta()">${notasIcone('apagar')}<span>Apagar a nota</span></button></div></details>
      </span>
    </div>${NOTAS_EMOJI_ABERTO ? notasEmojisHtml() : ''}`;
}

function notasEmojisHtml() {
  return `<div class="notas-emojis">${NOTAS_EMOJIS.map(([grupo, lista]) => `
    <div class="notas-emoji-grupo"><span>${safeText(grupo)}</span><div>${lista.split(' ').map((e) =>
      `<button type="button" onclick="inserirEmoji('${e}')" aria-label="Inserir ${e}">${e}</button>`).join('')}</div></div>`).join('')}</div>`;
}

function notasLinhaHtml(linha, indice) {
  const { marca, texto } = notasLerLinha(linha);
  const editando = NOTA_FOCO === indice;
  const inline = (t) => safeText(t)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const marcador = marca === 'check' || marca === 'check-feito'
    ? `<input type="checkbox" ${marca === 'check-feito' ? 'checked' : ''} onclick="event.stopPropagation()"
        onchange="marcarNaNota(${indice})" aria-label="Marcar item">`
    : marca === 'lista' ? '<span class="nota-ponto">•</span>' : '';
  const corpo = editando
    ? `<textarea class="nota-entrada" rows="1" data-linha="${indice}"
        oninput="crescerLinha(this)"
        onkeydown="teclaNaLinha(${indice}, event, this)"
        onblur="sairDaLinha(${indice}, this.value)">${safeText(texto)}</textarea>`
    : `<span class="nota-texto ${marca === 'check-feito' ? 'feito' : ''}">${
        texto.trim() ? inline(texto) : '<i class="nota-linha-vazia">&nbsp;</i>'}</span>`;
  return `<div class="nota-linha ${marca ? `m-${marca}` : ''} ${editando ? 'editando' : ''}"
      onclick="focarLinha(${indice}, event)">${marcador}${corpo}</div>`;
}

function pintarNotaAberta() {
  const janela = notasJanela();
  if (!janela || !NOTA_ABERTA) return;
  if (!NOTA_LINHAS.length) NOTA_LINHAS = String(NOTA_ABERTA.corpo || '').replace(/\r\n/g, '\n').split('\n');
  if (!NOTA_LINHAS.length) NOTA_LINHAS = [''];
  if (janela.id === 'v2-notas') pintarNotaNoTopo();
  else pintarNotaGrande(janela);
  const entrada = janela.querySelector('.nota-entrada');
  if (entrada) {
    crescerLinha(entrada);
    entrada.focus({ preventScroll: janela.id === 'v2-notas' });
    entrada.scrollIntoView?.({ block: 'nearest' });
    const pos = NOTA_FIM === 'fim' || NOTA_FIM === null ? entrada.value.length : Number(NOTA_FIM);
    entrada.setSelectionRange(pos, pos);
  }
  NOTA_FIM = null;
}

function pintarNotaGrande(janela) {
  const peca = NOTA_ABERTA.item_ref && typeof findOperationalItem === 'function'
    ? findOperationalItem(NOTA_ABERTA.item_ref) : null;
  const sobre = NOTA_ABERTA.item_ref
    ? `<div class="notas-sobre"><span>sobre</span><b>${safeText(peca?.nome || NOTA_ABERTA.item_ref)}</b>
        <button type="button" onclick="openItemWorkspace('${safeText(NOTA_ABERTA.item_ref)}')">Abrir a peça</button>
        <button type="button" onclick="mandarNotaParaPeca()">Mandar para a peça</button>
        <button type="button" onclick="ligarNotaAPeca('')" title="Desligar desta peça">×</button></div>`
    : `<div class="notas-sobre"><span>${safeText(NOTA_ABERTA.caderno || CADERNO_PADRAO_TELA)}</span>
        <button type="button" onclick="escolherPecaDaNota()">Ligar a uma demanda</button></div>`;
  janela.innerHTML = `${notasTopoHtml()}
    <div class="notas-conteudo nota">
      <input class="notas-titulo" value="${safeText(NOTA_ABERTA.titulo)}" placeholder="Título da nota"
        oninput="editarNota('titulo',this.value)" aria-label="Título da nota">
      ${sobre}
      ${notasBuscaPecaHtml()}
      ${notasFerramentasHtml()}
      <div class="nota-folha" onclick="if(event.target===this)focarLinha(${NOTA_LINHAS.length - 1})">
        ${NOTA_LINHAS.map(notasLinhaHtml).join('')}
      </div>
      <p class="notas-pe" id="notas-pe">${NOTA_ABERTA.id
        ? `Salva ${safeText(quandoNaBahia(NOTA_ABERTA.atualizado_em || new Date().toISOString()))}`
        : 'Salva sozinha enquanto você escreve.'}</p>
    </div>${notasCantoHtml()}`;
}

// Qualquer ação de fora (marcar caixinha, barra de ferramentas, emoji, trocar
// de linha) redesenha a folha — e redesenhar lê NOTA_LINHAS. O que estava
// digitado e ainda não voltou para lá se perderia. Então primeiro se recolhe o
// que está no campo aberto.
function capturarLinhaAberta() {
  const campo = document.querySelector('.nota-entrada');
  if (!campo || NOTA_FOCO === null) return;
  const indice = Number(campo.dataset.linha);
  if (!Number.isInteger(indice) || !NOTA_LINHAS[indice] === undefined) return;
  const { marca } = notasLerLinha(NOTA_LINHAS[indice] ?? '');
  NOTA_LINHAS[indice] = notasMontarLinha(marca, campo.value);
  if (NOTA_ABERTA) NOTA_ABERTA.corpo = NOTA_LINHAS.join('\n');
}

function crescerLinha(campo) {
  if (!campo) return;
  campo.style.height = 'auto';
  campo.style.height = `${campo.scrollHeight}px`;
}

function focarLinha(indice, evento) {
  if (evento?.target?.closest?.('input,button')) return;
  capturarLinhaAberta();
  NOTA_FOCO = Math.max(0, Math.min(Number(indice), NOTA_LINHAS.length - 1));
  NOTA_FIM = 'fim';
  pintarNotaAberta();
}

function sairDaLinha(indice, valor) {
  if (NOTA_FOCO !== indice) return;
  const { marca } = notasLerLinha(NOTA_LINHAS[indice] ?? '');
  NOTA_LINHAS[indice] = notasMontarLinha(marca, valor);
  NOTA_FOCO = null;
  guardarCorpoDaNota();
  pintarNotaAberta();
}

// Enter continua a lista, Backspace no começo tira a marca ou junta com a linha
// de cima, e as setas andam entre as linhas — é o que se espera de um caderno.
function teclaNaLinha(indice, evento, campo) {
  const valor = campo.value;
  if (evento.key === 'Enter' && !evento.shiftKey) {
    evento.preventDefault();
    const { linhas, foco } = notasEnter(NOTA_LINHAS, indice, valor);
    NOTA_LINHAS = linhas; NOTA_FOCO = foco; NOTA_FIM = 'fim';
    guardarCorpoDaNota(); pintarNotaAberta();
    return;
  }
  if (evento.key === 'Backspace' && campo.selectionStart === 0 && campo.selectionEnd === 0) {
    const { marca } = notasLerLinha(NOTA_LINHAS[indice] ?? '');
    if (marca || indice > 0) {
      evento.preventDefault();
      NOTA_LINHAS[indice] = notasMontarLinha(marca, valor);
      const r = notasBackspace(NOTA_LINHAS, indice, valor);
      NOTA_LINHAS = r.linhas; NOTA_FOCO = r.foco; NOTA_FIM = r.fim;
      guardarCorpoDaNota(); pintarNotaAberta();
    }
    return;
  }
  if ((evento.key === 'ArrowUp' && indice > 0) || (evento.key === 'ArrowDown' && indice < NOTA_LINHAS.length - 1)) {
    evento.preventDefault();
    const { marca } = notasLerLinha(NOTA_LINHAS[indice] ?? '');
    NOTA_LINHAS[indice] = notasMontarLinha(marca, valor);
    NOTA_FOCO = indice + (evento.key === 'ArrowUp' ? -1 : 1);
    NOTA_FIM = 'fim';
    guardarCorpoDaNota(); pintarNotaAberta();
    return;
  }
  if (evento.key === 'Escape') { evento.stopPropagation(); campo.blur(); }
}

function guardarCorpoDaNota() {
  if (!NOTA_ABERTA) return;
  NOTA_ABERTA.corpo = NOTA_LINHAS.join('\n');
  const pe = document.getElementById('notas-pe');
  if (pe) pe.textContent = 'Escrevendo…';
  clearTimeout(NOTAS_SALVANDO);
  NOTAS_SALVANDO = setTimeout(() => { NOTAS_SALVANDO = null; salvarNotaAberta(); }, 900);
}

function alternarEmojis() { capturarLinhaAberta(); NOTAS_EMOJI_ABERTO = !NOTAS_EMOJI_ABERTO; pintarNotaAberta(); }

// A barra de ferramentas age na LINHA em que se está escrevendo. Sem linha
// escolhida, age na última — que é onde o cursor vai parar de qualquer forma.
function aplicarNaNota(qual) {
  if (!NOTA_ABERTA) return;
  capturarLinhaAberta();
  const indice = NOTA_FOCO ?? Math.max(0, NOTA_LINHAS.length - 1);
  if (qual === 'negrito') {
    const { marca, texto } = notasLerLinha(NOTA_LINHAS[indice] ?? '');
    const campo = document.querySelector('.nota-entrada');
    const inicio = NOTA_FOCO === indice && campo ? campo.selectionStart : texto.length;
    const fim = NOTA_FOCO === indice && campo ? campo.selectionEnd : texto.length;
    const selecionado = texto.slice(inicio, fim);
    NOTA_LINHAS[indice] = notasMontarLinha(marca, `${texto.slice(0, inicio)}**${selecionado}**${texto.slice(fim)}`);
    NOTA_FOCO = indice; NOTA_FIM = inicio + 2 + selecionado.length;
  } else {
    const { linhas, foco } = notasTrocarMarca(NOTA_LINHAS, indice, qual);
    NOTA_LINHAS = linhas; NOTA_FOCO = foco; NOTA_FIM = 'fim';
  }
  guardarCorpoDaNota();
  pintarNotaAberta();
}

function inserirEmoji(emoji) {
  if (!NOTA_ABERTA) return;
  capturarLinhaAberta();
  const indice = NOTA_FOCO ?? Math.max(0, NOTA_LINHAS.length - 1);
  const { marca, texto } = notasLerLinha(NOTA_LINHAS[indice] ?? '');
  const campo = document.querySelector('.nota-entrada');
  const pos = NOTA_FOCO === indice && campo ? campo.selectionStart : texto.length;
  NOTA_LINHAS[indice] = notasMontarLinha(marca, `${texto.slice(0, pos)}${emoji}${texto.slice(pos)}`);
  NOTA_FOCO = indice; NOTA_FIM = pos + emoji.length;
  guardarCorpoDaNota();
  pintarNotaAberta();
}

function editarNota(campo, valor) {
  if (!NOTA_ABERTA) return;
  NOTA_ABERTA[campo] = String(valor ?? '');
  const pe = document.getElementById('notas-pe');
  if (pe) pe.textContent = 'Escrevendo…';
  clearTimeout(NOTAS_SALVANDO);
  NOTAS_SALVANDO = setTimeout(() => { NOTAS_SALVANDO = null; salvarNotaAberta(); }, 900);
}

function marcarNaNota(indice) {
  if (!NOTA_ABERTA) return;
  capturarLinhaAberta();
  const { marca, texto } = notasLerLinha(NOTA_LINHAS[indice] ?? '');
  if (marca !== 'check' && marca !== 'check-feito') return;
  NOTA_LINHAS[indice] = notasMontarLinha(marca === 'check' ? 'check-feito' : 'check', texto);
  guardarCorpoDaNota();
  pintarNotaAberta();
  salvarNotaAberta();
}

async function salvarNotaAgora() {
  capturarLinhaAberta();
  clearTimeout(NOTAS_SALVANDO); NOTAS_SALVANDO = null;
  await salvarNotaAberta();
}

async function salvarNotaAberta() {
  if (!NOTA_ABERTA) return;
  const dados = { id: NOTA_ABERTA.id, titulo: NOTA_ABERTA.titulo, corpo: NOTA_ABERTA.corpo,
    item_ref: NOTA_ABERTA.item_ref || null, caderno: NOTA_ABERTA.caderno || NOTAS_CADERNO };
  if (!dados.id && !String(dados.corpo).trim() && !String(dados.titulo).trim()) return;
  try {
    const { nota } = await notasPedir('', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
    });
    if (NOTA_ABERTA) { NOTA_ABERTA.id = nota.id; NOTA_ABERTA.atualizado_em = nota.atualizado_em; }
    NOTAS = [nota, ...NOTAS.filter((n) => Number(n.id) !== Number(nota.id))];
    if (!NOTAS_CADERNOS.some((c) => c.nome === nota.caderno)) NOTAS_CADERNOS = [{ nome: nota.caderno, notas: 1 }, ...NOTAS_CADERNOS];
    const pe = document.getElementById('notas-pe');
    if (pe) pe.textContent = `Salva ${quandoNaBahia(nota.atualizado_em)}`;
  } catch (erro) {
    const pe = document.getElementById('notas-pe');
    if (pe) pe.textContent = `Não salvou: ${erro.message}`;
  }
}

async function apagarNotaAberta() {
  if (!NOTA_ABERTA) return;
  if (!NOTA_ABERTA.id) { NOTA_ABERTA = null; NOTAS_ESTADO = 'lista'; return pintarNotas(); }
  const sim = await perguntarNoPainel({
    titulo: 'Apagar esta nota?', texto: NOTA_ABERTA.titulo || notasResumo(NOTA_ABERTA),
    confirmar: 'Apagar', perigo: true,
  });
  if (!sim) return;
  try {
    await notasPedir(`&id=${NOTA_ABERTA.id}`, { method: 'DELETE' });
    NOTA_ABERTA = null; NOTAS_ESTADO = 'lista';
    await recarregarNotas();
    showToast('✓ Nota apagada', 'ok', 3000);
  } catch (erro) { showToast(erro.message, 'err', 6000); }
}

// A BUSCA DA DEMANDA É A MESMA DO ⌘K.
//
// Antes era uma caixa de texto que pedia "parte do nome" e comparava com
// includes: quem digitava "ree" não achava "Reels - Raira 1", porque a busca
// exigia a sequência exata e só olhava a fila do Foco. Agora chama
// spotlightResultados — a função que ranqueia o Spotlight — sobre o painel
// inteiro, com as mesmas regras de acento, várias palavras e cliente.
function escolherPecaDaNota() {
  capturarLinhaAberta();
  NOTA_BUSCA_PECA = '';
  pintarNotaAberta();
  setTimeout(() => document.getElementById('nota-busca-peca')?.focus(), 30);
}

function fecharBuscaDaPeca() {
  NOTA_BUSCA_PECA = null;
  pintarNotaAberta();
}

function buscarPecaDaNota(texto) {
  NOTA_BUSCA_PECA = String(texto ?? '');
  const caixa = document.getElementById('nota-busca-lista');
  if (caixa) caixa.innerHTML = notasResultadosHtml();
}

function notasPecasDaBusca() {
  const consulta = String(NOTA_BUSCA_PECA || '');
  if (typeof spotlightResultados !== 'function') return [];
  const itens = typeof unifiedOperationalItems === 'function' ? unifiedOperationalItems()
    : (typeof DADOS_ALL !== 'undefined' && DADOS_ALL.length ? DADOS_ALL : (typeof DADOS !== 'undefined' ? DADOS : []));
  const r = spotlightResultados(consulta, {
    itens,
    pessoas: typeof TEAM_USERS === 'undefined' ? [] : TEAM_USERS,
    hojeIso: (typeof HOJE_ISO === 'string' && HOJE_ISO) || new Date().toISOString().slice(0, 10),
    concluida: typeof atividadeDoDiaConcluida === 'function' ? atividadeDoDiaConcluida : undefined,
    ehDemanda: typeof isRequestItem === 'function' ? isRequestItem : undefined,
  });
  // Em andamento primeiro; o que já encerrou entra depois, porque nota sobre
  // peça antiga também existe.
  return [...(r.andamento || []), ...(r.encerradas || [])].slice(0, 8);
}

function notasResultadosHtml() {
  const consulta = String(NOTA_BUSCA_PECA || '');
  if (consulta.trim().length < 2) return '<p class="nota-busca-dica">Digite duas letras para procurar.</p>';
  const achados = notasPecasDaBusca();
  if (!achados.length) return '<p class="nota-busca-dica">Nenhuma demanda com essas palavras.</p>';
  return achados.map((d) => `<button type="button" class="nota-busca-item"
      onclick="ligarNotaAPeca('${safeText(String(d.id))}')">
      <b>${safeText(d.nome || 'Sem título')}</b>
      <small>${safeText(d.cliente || 'Sem cliente')}${d.status ? ` ${typeof statusCor === 'function' ? statusCor(d) : safeText(d.status)}` : ''}</small>
    </button>`).join('');
}

function notasBuscaPecaHtml() {
  if (NOTA_BUSCA_PECA === null) return '';
  return `<div class="nota-busca">
      <div class="nota-busca-campo">
        <input id="nota-busca-peca" type="search" value="${safeText(NOTA_BUSCA_PECA)}"
          placeholder="Buscar demanda por nome, cliente ou formato…" aria-label="Buscar demanda"
          oninput="buscarPecaDaNota(this.value)"
          onkeydown="if(event.key==='Escape'){event.stopPropagation();fecharBuscaDaPeca()}">
        <button type="button" onclick="fecharBuscaDaPeca()" aria-label="Fechar a busca">×</button>
      </div>
      <div id="nota-busca-lista" class="nota-busca-lista">${notasResultadosHtml()}</div>
    </div>`;
}

function ligarNotaAPeca(itemRef) {
  if (!NOTA_ABERTA) return;
  NOTA_BUSCA_PECA = null;
  NOTA_ABERTA.item_ref = String(itemRef || '');
  pintarNotaAberta();
  salvarNotaAberta();
}

async function mandarNotaParaPeca() {
  if (!NOTA_ABERTA?.item_ref) return;
  const texto = String(NOTA_ABERTA.corpo || '').trim();
  if (!texto) return showToast('Escreva a nota antes de mandar para a peça.', 'info', 5000);
  const sim = await perguntarNoPainel({
    titulo: 'Mandar esta nota para a peça?',
    texto: 'O texto entra no histórico da demanda, com seu nome, e a equipe passa a ver. A nota continua aqui.',
    confirmar: 'Mandar',
  });
  if (!sim) return;
  try {
    await postItemUpdate(NOTA_ABERTA.item_ref, `[Vybe OS] ${texto}`);
    showToast('✓ Nota no histórico da peça', 'ok', 4000);
  } catch (erro) { showToast(`Não foi possível mandar: ${erro.message}`, 'err', 7000); }
}

// Esc fecha o painel de emoji antes da janela, e a janela antes de qualquer
// camada do painel atrás dela.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !notasJanela()) return;
  const alvo = event.target;
  if (alvo && /^(INPUT|TEXTAREA)$/.test(alvo.tagName) && !alvo.classList?.contains('v2nt-busca')) { alvo.blur(); return; }
  event.preventDefault();
  event.stopImmediatePropagation();
  if (NOTAS_EMOJI_ABERTO) { NOTAS_EMOJI_ABERTO = false; return pintarNotaAberta(); }
  const doTopo = Boolean(document.getElementById('v2-notas'));
  fecharNotas();
  if (doTopo) document.querySelector('.vv-barra-topo .vv-mais-menu > summary')?.focus?.();
});

window.addEventListener('resize', () => {
  notasColocarNoTopo();
  const janela = document.getElementById('notas-janela');
  if (janela && !janela.classList.contains('cheia') && !janela.classList.contains('barra')) notasAplicarGeometria(janela);
});
