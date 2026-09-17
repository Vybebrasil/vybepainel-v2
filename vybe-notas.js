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
// notasMarkdownHtml e notasInserir são funções sem tela, e é nelas que os testes
// entram.

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

// Insere no lugar do cursor: 'linha' põe a marca no começo da linha (título,
// lista, checklist) e 'volta' diz onde o cursor fica depois — no meio do
// **negrito**, por exemplo.
function notasInserir(texto, inicio, fim, { antes = '', depois = '', linha = '' } = {}) {
  const t = String(texto ?? '');
  if (linha) {
    const comeco = t.lastIndexOf('\n', Math.max(0, inicio - 1)) + 1;
    const jaTem = t.slice(comeco).startsWith(linha);
    const novo = jaTem
      ? t.slice(0, comeco) + t.slice(comeco + linha.length)
      : t.slice(0, comeco) + linha + t.slice(comeco);
    const passo = jaTem ? -linha.length : linha.length;
    return { texto: novo, cursor: Math.max(comeco, inicio + passo) };
  }
  const selecionado = t.slice(inicio, fim);
  const novo = t.slice(0, inicio) + antes + selecionado + depois + t.slice(fim);
  return { texto: novo, cursor: inicio + antes.length + selecionado.length + (selecionado ? depois.length : 0) };
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
  const existente = document.getElementById('notas-janela');
  if (existente) { existente.classList.remove('barra'); notasGuardarGeometria({ modo: 'solta' }); notasAplicarGeometria(existente); return pintarNotas(); }
  const janela = document.createElement('section');
  janela.id = 'notas-janela';
  janela.className = 'notas-janela';
  janela.setAttribute('role', 'dialog');
  janela.setAttribute('aria-label', 'Suas notas');
  janela.innerHTML = '<div class="workspace-loading">Carregando suas notas…</div>';
  document.body.append(janela);
  notasAplicarGeometria(janela);
  NOTAS_ESTADO = 'lista'; NOTA_ABERTA = null; NOTAS_BUSCA = '';
  await recarregarNotas();
}

async function recarregarNotas() {
  const janela = document.getElementById('notas-janela');
  if (!janela) return;
  try {
    const d = await notasPedir(NOTAS_BUSCA ? `&busca=${encodeURIComponent(NOTAS_BUSCA)}` : '');
    NOTAS = d.notas || [];
    NOTAS_CADERNOS = d.cadernos?.length ? d.cadernos : [{ nome: CADERNO_PADRAO_TELA, notas: 0 }];
    if (!NOTAS_CADERNOS.some((c) => c.nome === NOTAS_CADERNO)) NOTAS_CADERNO = NOTAS_CADERNOS[0].nome;
    pintarNotas();
  } catch (erro) {
    janela.innerHTML = `${notasTopoHtml()}<div class="notas-conteudo"><div class="workspace-empty">${safeText(erro.message)}</div></div>${notasCantoHtml()}`;
  }
}

function fecharNotas() {
  if (NOTAS_SALVANDO) { clearTimeout(NOTAS_SALVANDO); NOTAS_SALVANDO = null; salvarNotaAberta(); }
  document.getElementById('notas-janela')?.remove();
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
      ${naNota ? '<button type="button" class="notas-voltar" onclick="voltarParaAsNotas()">‹</button>' : ''}
      <b>${naNota ? safeText(NOTA_ABERTA?.titulo || 'Nota') : 'Notas'}</b>
      <div class="notas-topo-acoes">
        ${barra ? '' : `<button type="button" class="notas-icone" onclick="expandirNotas()" title="${cheia ? 'Voltar ao tamanho' : 'Expandir para a tela'}" aria-label="Expandir">${cheia ? '⤡' : '⤢'}</button>`}
        <button type="button" class="notas-icone" onclick="encolherNotas()" title="${barra ? 'Abrir a janela' : 'Encolher para uma barrinha'}" aria-label="Encolher">${barra ? '▣' : '—'}</button>
        <button type="button" class="notas-icone" onclick="fecharNotas()" title="Fechar" aria-label="Fechar">×</button>
      </div>
    </div>`;
}

function pintarNotas() {
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
        ${NOTAS_CADERNOS.length ? `<div class="notas-caderno-acoes">
          <button type="button" onclick="renomearCadernoAtual()">renomear</button>
          <button type="button" onclick="apagarCadernoAtual()">apagar</button></div>` : ''}
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
    const campo = document.querySelector('.notas-barra input');
    const tinhaFoco = document.activeElement === campo;
    await recarregarNotas();
    if (tinhaFoco) {
      const novo = document.querySelector('.notas-barra input');
      novo?.focus(); novo?.setSelectionRange(novo.value.length, novo.value.length);
    }
  }, 260);
}

function novaNota() {
  NOTA_ABERTA = { id: null, titulo: notasTituloPadrao(), corpo: '', item_ref: '', caderno: NOTAS_CADERNO };
  NOTAS_ESTADO = 'nota';
  pintarNotaAberta({ editando: true });
}

function abrirNota(id) {
  const nota = NOTAS.find((n) => Number(n.id) === Number(id));
  if (!nota) return;
  NOTA_ABERTA = { ...nota, caderno: nota.caderno || CADERNO_PADRAO_TELA };
  NOTAS_ESTADO = 'nota';
  pintarNotaAberta();
}

function voltarParaAsNotas() {
  if (NOTAS_SALVANDO) { clearTimeout(NOTAS_SALVANDO); NOTAS_SALVANDO = null; }
  NOTAS_EMOJI_ABERTO = false;
  salvarNotaAberta().finally(async () => {
    NOTA_ABERTA = null; NOTAS_ESTADO = 'lista';
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
        <button type="button" class="notas-acao perigo" onclick="apagarNotaAberta()">Apagar</button>
      </span>
    </div>${NOTAS_EMOJI_ABERTO ? notasEmojisHtml() : ''}`;
}

function notasEmojisHtml() {
  return `<div class="notas-emojis">${NOTAS_EMOJIS.map(([grupo, lista]) => `
    <div class="notas-emoji-grupo"><span>${safeText(grupo)}</span><div>${lista.split(' ').map((e) =>
      `<button type="button" onclick="inserirEmoji('${e}')" aria-label="Inserir ${e}">${e}</button>`).join('')}</div></div>`).join('')}</div>`;
}

function pintarNotaAberta({ editando = false } = {}) {
  const janela = document.getElementById('notas-janela');
  if (!janela || !NOTA_ABERTA) return;
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
      ${notasFerramentasHtml()}
      ${editando
        ? `<textarea class="notas-texto" id="notas-texto" placeholder="Escreva aqui."
            oninput="editarNota('corpo',this.value)" onblur="verNotaFormatada()">${safeText(NOTA_ABERTA.corpo)}</textarea>`
        : `<div class="notas-formatada" role="button" tabindex="0" title="Clique para editar"
            onclick="if(!event.target.closest('input,label'))editarNotaAgora()"
            onkeydown="if(event.key==='Enter'){event.preventDefault();editarNotaAgora()}">${
              NOTA_ABERTA.corpo.trim() ? notasMarkdownHtml(NOTA_ABERTA.corpo) : '<p class="notas-placeholder">Clique para escrever.</p>'}</div>`}
      <p class="notas-pe" id="notas-pe">${NOTA_ABERTA.id
        ? `Salva ${safeText(quandoNaBahia(NOTA_ABERTA.atualizado_em || new Date().toISOString()))}`
        : 'Salva sozinha enquanto você escreve.'}</p>
    </div>${notasCantoHtml()}`;
  if (editando) {
    const campo = document.getElementById('notas-texto');
    campo?.focus();
    campo?.setSelectionRange(campo.value.length, campo.value.length);
  }
}

function editarNotaAgora() { NOTAS_EMOJI_ABERTO = false; pintarNotaAberta({ editando: true }); }
function verNotaFormatada() { if (NOTAS_ESTADO === 'nota' && !NOTAS_EMOJI_ABERTO) pintarNotaAberta({ editando: false }); }
function alternarEmojis() { NOTAS_EMOJI_ABERTO = !NOTAS_EMOJI_ABERTO; pintarNotaAberta({ editando: true }); }

// A barra de ferramentas escreve a marca onde o cursor está — o texto continua
// sendo texto, e quem sabe as marcas pode digitar direto.
const NOTAS_MARCAS = {
  titulo: { linha: '# ' }, lista: { linha: '- ' }, check: { linha: '[] ' },
  negrito: { antes: '**', depois: '**' },
};
function aplicarNaNota(qual) {
  const marca = NOTAS_MARCAS[qual];
  if (!marca || !NOTA_ABERTA) return;
  let campo = document.getElementById('notas-texto');
  if (!campo) { pintarNotaAberta({ editando: true }); campo = document.getElementById('notas-texto'); }
  if (!campo) return;
  const { texto, cursor } = notasInserir(campo.value, campo.selectionStart, campo.selectionEnd, marca);
  campo.value = texto;
  campo.focus();
  campo.setSelectionRange(cursor, cursor);
  editarNota('corpo', texto);
}

function inserirEmoji(emoji) {
  let campo = document.getElementById('notas-texto');
  if (!campo) { pintarNotaAberta({ editando: true }); campo = document.getElementById('notas-texto'); }
  if (!campo) return;
  const { texto, cursor } = notasInserir(campo.value, campo.selectionStart, campo.selectionEnd, { antes: emoji });
  campo.value = texto;
  campo.focus();
  campo.setSelectionRange(cursor, cursor);
  editarNota('corpo', texto);
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
  const linhas = String(NOTA_ABERTA.corpo || '').replace(/\r\n/g, '\n').split('\n');
  const linha = linhas[indice];
  if (linha === undefined) return;
  linhas[indice] = /^\s*\[[xX]\]/.test(linha)
    ? linha.replace(/^(\s*)\[[xX]\]/, '$1[]')
    : linha.replace(/^(\s*)\[\s?\]/, '$1[x]');
  NOTA_ABERTA.corpo = linhas.join('\n');
  pintarNotaAberta();
  salvarNotaAberta();
}

async function salvarNotaAgora() {
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

async function escolherPecaDaNota() {
  const minhas = typeof focusOwnItems === 'function' ? focusOwnItems() : [];
  const fonte = minhas.length ? minhas : (typeof unifiedOperationalItems === 'function' ? unifiedOperationalItems() : []);
  if (!fonte.length) return showToast('Nenhuma demanda carregada para ligar à nota.', 'info', 5000);
  const nome = await perguntarNoPainel({
    titulo: 'Ligar a nota a uma demanda',
    texto: `Escreva parte do nome. Ex.: ${String(fonte[0]?.nome || '').slice(0, 40)}`,
    confirmar: 'Ligar', campo: { valor: '', dica: 'Parte do nome da demanda' },
  });
  if (!nome) return;
  const alvo = fonte.find((d) => String(d.nome || '').toLocaleLowerCase('pt-BR').includes(String(nome).toLocaleLowerCase('pt-BR')));
  if (!alvo) return showToast('Não achei essa demanda.', 'info', 5000);
  ligarNotaAPeca(String(alvo.id));
}

function ligarNotaAPeca(itemRef) {
  if (!NOTA_ABERTA) return;
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
  if (event.key !== 'Escape' || !document.getElementById('notas-janela')) return;
  const alvo = event.target;
  if (alvo && /^(INPUT|TEXTAREA)$/.test(alvo.tagName)) { alvo.blur(); return; }
  event.preventDefault();
  event.stopImmediatePropagation();
  if (NOTAS_EMOJI_ABERTO) { NOTAS_EMOJI_ABERTO = false; return pintarNotaAberta({ editando: true }); }
  fecharNotas();
});

window.addEventListener('resize', () => {
  const janela = document.getElementById('notas-janela');
  if (janela && !janela.classList.contains('cheia') && !janela.classList.contains('barra')) notasAplicarGeometria(janela);
});
