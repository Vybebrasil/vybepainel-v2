// vybe-notas.js — o caderno de quem está no Modo Foco.
//
// Anotação do dia e recado sobre uma demanda viviam fora do painel. O botão
// "Notas" abre um painel lateral com as suas notas — só suas —, escrita simples
// no estilo do Notion (lista, caixinha para marcar, negrito, título), salva
// sozinha enquanto se escreve. Uma nota pode apontar para uma demanda, e aí tem
// o atalho para abrir a peça e o botão de mandar o texto para o histórico dela,
// que é o lugar de recado da equipe.
//
// A escrita vira HTML numa função sem tela (notasMarkdownHtml), para o teste
// conferir cada marca e conferir que texto de gente não vira código.

let NOTAS = [];
let NOTA_ABERTA = null;      // { id, titulo, corpo, item_ref } — id null antes do primeiro salvamento
let NOTAS_BUSCA = '';
let NOTAS_SALVANDO = null;   // timeout do salvamento automático
let NOTAS_ESTADO = 'lista';  // 'lista' | 'nota'

// ── escrita simples ──────────────────────────────────────────────────────────
//
// Cinco marcas, as que se usam de verdade num caderno de produção. Tudo passa
// por safeText antes: o que a pessoa escreve é texto, nunca HTML.
function notasMarkdownHtml(texto = '') {
  const linhas = String(texto).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let lista = null; // 'ul' | 'check'
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

function notasResumo(nota) {
  const corpo = String(nota.corpo || '').replace(/[#*`\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return corpo.slice(0, 120) + (corpo.length > 120 ? '…' : '');
}

function notasTituloPadrao() {
  const hoje = HOJE_ISO || new Date().toISOString().slice(0, 10);
  return `${hoje.slice(8, 10)}/${hoje.slice(5, 7)} · notas do dia`;
}

// ── servidor ─────────────────────────────────────────────────────────────────
async function notasPedir(caminho, opcoes = {}) {
  const r = await fetch(`/api/painel?area=notas${caminho}`, { credentials: 'same-origin', cache: 'no-store', ...opcoes });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d?.ok) throw new Error(d?.error || `Notas indisponíveis (${r.status})`);
  return d;
}

async function abrirNotas() {
  if (document.getElementById('notas-painel')) return;
  const painel = document.createElement('aside');
  painel.id = 'notas-painel';
  painel.className = 'notas-painel';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-label', 'Suas notas');
  const fundo = document.createElement('div');
  fundo.id = 'notas-fundo'; fundo.className = 'notas-fundo'; fundo.onclick = fecharNotas;
  painel.innerHTML = '<div class="workspace-loading">Carregando suas notas…</div>';
  document.body.append(fundo, painel);
  NOTAS_ESTADO = 'lista'; NOTA_ABERTA = null; NOTAS_BUSCA = '';
  try {
    NOTAS = (await notasPedir('')).notas || [];
    pintarNotas();
  } catch (erro) {
    painel.innerHTML = `${notasTopoHtml()}<div class="notas-corpo"><div class="workspace-empty">${safeText(erro.message)}</div></div>`;
  }
}

function fecharNotas() {
  if (NOTAS_SALVANDO) { clearTimeout(NOTAS_SALVANDO); NOTAS_SALVANDO = null; salvarNotaAberta(); }
  document.getElementById('notas-painel')?.remove();
  document.getElementById('notas-fundo')?.remove();
  NOTA_ABERTA = null; NOTAS_ESTADO = 'lista';
  return true;
}

function notasTopoHtml() {
  const naNota = NOTAS_ESTADO === 'nota';
  return `<div class="notas-topo">
      ${naNota ? '<button type="button" class="log-voltar" onclick="voltarParaAsNotas()">‹ Notas</button>'
        : '<b>Notas</b>'}
      ${naNota ? '<b>Nota</b>' : ''}
      <div class="notas-topo-acoes">
        ${naNota
          ? `<button type="button" class="notas-acao perigo" onclick="apagarNotaAberta()">Apagar</button>`
          : `<button type="button" class="notas-acao primaria" onclick="novaNota()">+ Nova nota</button>`}
        <button class="workspace-close" type="button" onclick="fecharNotas()" aria-label="Fechar notas">×</button>
      </div>
    </div>`;
}

function pintarNotas() {
  const painel = document.getElementById('notas-painel');
  if (!painel) return;
  if (NOTAS_ESTADO === 'nota') return pintarNotaAberta();
  const lista = NOTAS.length
    ? NOTAS.map((n) => {
      const peca = n.item_ref && typeof findOperationalItem === 'function' ? findOperationalItem(n.item_ref) : null;
      return `<button type="button" class="notas-item" onclick="abrirNota(${n.id})">
        <b>${safeText(n.titulo || 'Sem título')}</b>
        <small>${safeText(notasResumo(n) || 'Nota vazia')}</small>
        <span class="notas-item-pe">${safeText(quandoNaBahia(n.atualizado_em))}${
          n.item_ref ? ` · sobre ${safeText(peca?.nome || n.item_ref)}` : ''}</span>
      </button>`;
    }).join('')
    : `<div class="workspace-empty">${NOTAS_BUSCA ? 'Nenhuma nota com essa palavra.' : 'Nenhuma nota ainda. Comece pela do dia.'}</div>`;
  painel.innerHTML = `${notasTopoHtml()}
    <div class="notas-busca"><input type="search" placeholder="Buscar nas suas notas…" value="${safeText(NOTAS_BUSCA)}"
      oninput="buscarNotas(this.value)" aria-label="Buscar nas suas notas"></div>
    <div class="notas-corpo">${lista}</div>`;
}

let NOTAS_BUSCA_TIMER = null;
function buscarNotas(termo) {
  NOTAS_BUSCA = String(termo || '');
  clearTimeout(NOTAS_BUSCA_TIMER);
  NOTAS_BUSCA_TIMER = setTimeout(async () => {
    try {
      NOTAS = (await notasPedir(`&busca=${encodeURIComponent(NOTAS_BUSCA)}`)).notas || [];
      const foco = document.activeElement === document.querySelector('.notas-busca input');
      pintarNotas();
      if (foco) { const campo = document.querySelector('.notas-busca input'); campo?.focus(); campo?.setSelectionRange(campo.value.length, campo.value.length); }
    } catch (erro) { showToast(erro.message, 'err', 6000); }
  }, 260);
}

function novaNota() {
  NOTA_ABERTA = { id: null, titulo: notasTituloPadrao(), corpo: '', item_ref: '' };
  NOTAS_ESTADO = 'nota';
  pintarNotaAberta({ editando: true });
}

function abrirNota(id) {
  const nota = NOTAS.find((n) => Number(n.id) === Number(id));
  if (!nota) return;
  NOTA_ABERTA = { ...nota };
  NOTAS_ESTADO = 'nota';
  pintarNotaAberta();
}

function voltarParaAsNotas() {
  if (NOTAS_SALVANDO) { clearTimeout(NOTAS_SALVANDO); NOTAS_SALVANDO = null; }
  salvarNotaAberta().finally(() => { NOTA_ABERTA = null; NOTAS_ESTADO = 'lista'; pintarNotas(); });
}

function pintarNotaAberta({ editando = false } = {}) {
  const painel = document.getElementById('notas-painel');
  if (!painel || !NOTA_ABERTA) return;
  const peca = NOTA_ABERTA.item_ref && typeof findOperationalItem === 'function'
    ? findOperationalItem(NOTA_ABERTA.item_ref) : null;
  const sobre = NOTA_ABERTA.item_ref
    ? `<div class="notas-sobre"><span>sobre</span><b>${safeText(peca?.nome || NOTA_ABERTA.item_ref)}</b>
        <button type="button" onclick="openItemWorkspace('${safeText(NOTA_ABERTA.item_ref)}')">Abrir a peça</button>
        <button type="button" onclick="mandarNotaParaPeca()">Mandar para a peça</button>
        <button type="button" onclick="ligarNotaAPeca('')" title="Desligar a nota desta peça">×</button></div>`
    : `<div class="notas-sobre"><button type="button" onclick="escolherPecaDaNota()">Ligar a uma demanda</button></div>`;
  painel.innerHTML = `${notasTopoHtml()}
    <div class="notas-corpo">
      <input class="notas-titulo" value="${safeText(NOTA_ABERTA.titulo)}" placeholder="Título da nota"
        oninput="editarNota('titulo',this.value)" aria-label="Título da nota">
      ${sobre}
      ${editando
        ? `<textarea class="notas-texto" placeholder="Escreva aqui. -&nbsp;lista, [] para marcar, **negrito**, # título."
            oninput="editarNota('corpo',this.value)" onblur="verNotaFormatada()">${safeText(NOTA_ABERTA.corpo)}</textarea>`
        : `<div class="notas-formatada" role="button" tabindex="0" title="Clique para editar"
            onclick="if(!event.target.closest('input,label'))editarNotaAgora()"
            onkeydown="if(event.key==='Enter'){event.preventDefault();editarNotaAgora()}">${
              NOTA_ABERTA.corpo.trim() ? notasMarkdownHtml(NOTA_ABERTA.corpo) : '<p class="notas-placeholder">Clique para escrever.</p>'}</div>`}
      <p class="notas-pe" id="notas-pe">${NOTA_ABERTA.id ? `Salva ${safeText(quandoNaBahia(NOTA_ABERTA.atualizado_em || new Date().toISOString()))}` : 'Salva sozinha enquanto você escreve.'}</p>
    </div>`;
  if (editando) {
    const campo = painel.querySelector('.notas-texto');
    campo?.focus();
    campo?.setSelectionRange(campo.value.length, campo.value.length);
  }
}

function editarNotaAgora() { pintarNotaAberta({ editando: true }); }
function verNotaFormatada() { if (NOTAS_ESTADO === 'nota') pintarNotaAberta({ editando: false }); }

function editarNota(campo, valor) {
  if (!NOTA_ABERTA) return;
  NOTA_ABERTA[campo] = String(valor ?? '');
  clearTimeout(NOTAS_SALVANDO);
  NOTAS_SALVANDO = setTimeout(() => { NOTAS_SALVANDO = null; salvarNotaAberta(); }, 900);
}

// Marcar a caixinha edita o texto: é ele que guarda o estado, para a nota
// continuar sendo texto que se copia e se lê em qualquer lugar.
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

async function salvarNotaAberta() {
  if (!NOTA_ABERTA) return;
  const dados = { id: NOTA_ABERTA.id, titulo: NOTA_ABERTA.titulo, corpo: NOTA_ABERTA.corpo, item_ref: NOTA_ABERTA.item_ref || null };
  if (!dados.id && !String(dados.corpo).trim() && !String(dados.titulo).trim()) return;
  try {
    const { nota } = await notasPedir('', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
    });
    if (NOTA_ABERTA) { NOTA_ABERTA.id = nota.id; NOTA_ABERTA.atualizado_em = nota.atualizado_em; }
    NOTAS = [nota, ...NOTAS.filter((n) => Number(n.id) !== Number(nota.id))];
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
    NOTAS = NOTAS.filter((n) => Number(n.id) !== Number(NOTA_ABERTA.id));
    NOTA_ABERTA = null; NOTAS_ESTADO = 'lista'; pintarNotas();
    showToast('✓ Nota apagada', 'ok', 3000);
  } catch (erro) { showToast(erro.message, 'err', 6000); }
}

// Ligar a nota a uma demanda: a lista de escolha é a fila de quem está no Foco,
// que é o contexto de quem anota.
async function escolherPecaDaNota() {
  const minhas = typeof focusOwnItems === 'function' ? focusOwnItems() : [];
  if (!minhas.length) return showToast('Nenhuma demanda na sua fila para ligar à nota.', 'info', 5000);
  const nome = await perguntarNoPainel({
    titulo: 'Ligar a nota a uma demanda',
    texto: 'Escreva parte do nome da demanda. Ex.: ' + String(minhas[0]?.nome || '').slice(0, 40),
    confirmar: 'Ligar', campo: { valor: '', dica: 'Parte do nome da demanda' },
  });
  if (!nome) return;
  const alvo = minhas.find((d) => String(d.nome || '').toLocaleLowerCase('pt-BR').includes(String(nome).toLocaleLowerCase('pt-BR')));
  if (!alvo) return showToast('Não achei essa demanda na sua fila.', 'info', 5000);
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

// Esc fecha as notas antes de qualquer outra camada do Modo Foco.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !document.getElementById('notas-painel')) return;
  const alvo = event.target;
  if (alvo && /^(INPUT|TEXTAREA)$/.test(alvo.tagName)) { alvo.blur(); return; }
  event.preventDefault();
  event.stopImmediatePropagation();
  fecharNotas();
});
