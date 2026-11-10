/* ============================================================================
   SELETOR DO PADRÃO (redesign, quadro 30, 10/11/2026)
   ----------------------------------------------------------------------------
   No mundo, o menu que abria num <select> era o do navegador: muda de cara em
   cada sistema, não tem busca e não segue o padrão Vybe. Não dá para pintá-lo.
   Como no calendário dos campos de data (vybe-calendario.js), um ouvinte na
   captura segura o menu do navegador e abre este no lugar, para TODO <select>
   simples do mundo, sem tocar em nenhum deles.

   O próprio <select> continua sendo o botão (mostra o valor escolhido, com a
   seta do padrão em vybe-mundo.css) e a fonte da verdade: o valor, o
   `disabled` e as opções vêm dele na hora de abrir; o que muda enquanto o menu
   está aberto é observado (MutationObserver) e o menu se refaz. A escolha volta
   pelo próprio campo, com `input` e `change` disparados, e os
   `onchange="..."` que já existem continuam funcionando sem saber do menu.

   Fora do mundo (`body.mundo`), com `multiple`/`size`, desligado ou marcado
   com `data-nativo` (no campo ou num pai), nada muda: fica o do navegador.
   Teclado: setas, Home/End, Page Up/Down, Enter, Esc, Tab e digitação (busca
   quando passa de 8 opções; sem busca, a letra pula para a opção).
   ========================================================================== */

const SELETOR_BUSCA_A_PARTIR = 9; // mais de 8 opções ganham a busca
let SELETOR_ABERTO = null;        // { sel, menu, lista, busca, itens, ativo, obs, obsCorpo }
let SELETOR_SEQ = 0;
let SELETOR_TOQUE = null;         // onde o dedo encostou (para não abrir ao rolar)
let SELETOR_DIGITADO = { texto: '', ate: 0 };

function seletorElegivel(el) {
  return !!(el && el.tagName === 'SELECT' && !el.multiple && !(el.size > 1) && !el.disabled
    && document.body && document.body.classList.contains('mundo')
    && !el.closest('[data-nativo]'));
}

function seletorNome(sel) {
  const rotulo = sel.getAttribute('aria-label') || (sel.labels && sel.labels[0] && sel.labels[0].textContent) || sel.title || '';
  return String(rotulo).replace(/\s+/g, ' ').trim();
}

function seletorNormaliza(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function seletorEsc(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// As opções do <select> agora, com o grupo (optgroup) de cada uma.
function seletorOpcoes(sel) {
  const out = [];
  for (let i = 0; i < sel.options.length; i++) {
    const o = sel.options[i];
    if (o.hidden) continue;
    const grupo = o.parentElement && o.parentElement.tagName === 'OPTGROUP' ? o.parentElement : null;
    out.push({
      i, texto: (o.label || o.textContent || '').replace(/\s+/g, ' ').trim() || ' ',
      desligada: o.disabled || !!(grupo && grupo.disabled),
      grupo: grupo ? (grupo.label || '') : '',
    });
  }
  return out;
}

function seletorMontarLista() {
  const a = SELETOR_ABERTO; if (!a) return;
  const filtro = a.busca ? seletorNormaliza(a.busca.value) : '';
  const opcoes = seletorOpcoes(a.sel).filter((o) => !filtro || seletorNormaliza(o.texto).includes(filtro));
  let html = '', grupo = null;
  for (const o of opcoes) {
    if (o.grupo !== grupo) { grupo = o.grupo; if (grupo) html += `<div class="vb-seletor-grupo" role="presentation">${seletorEsc(grupo)}</div>`; }
    const escolhida = o.i === a.sel.selectedIndex;
    html += `<div class="vb-seletor-opcao${escolhida ? ' escolhida' : ''}" role="option" id="${a.id}-o${o.i}" data-i="${o.i}"`
      + ` aria-selected="${escolhida}"${o.desligada ? ' aria-disabled="true"' : ''}><span>${seletorEsc(o.texto)}</span>`
      + `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>`;
  }
  a.lista.innerHTML = html;
  a.vazio.hidden = opcoes.length > 0;
  a.itens = [...a.lista.querySelectorAll('.vb-seletor-opcao')];
  const escolhida = a.itens.find((el) => +el.dataset.i === a.sel.selectedIndex && el.getAttribute('aria-disabled') !== 'true');
  seletorMarcar(escolhida || a.itens.find((el) => el.getAttribute('aria-disabled') !== 'true') || null);
}

function seletorMarcar(el, rolar = true) {
  const a = SELETOR_ABERTO; if (!a) return;
  if (a.ativo) a.ativo.classList.remove('ativa');
  a.ativo = el || null;
  const dono = a.busca || a.lista;
  if (el) {
    el.classList.add('ativa');
    dono.setAttribute('aria-activedescendant', el.id);
    if (rolar) seletorRolarPara(el);
  } else dono.removeAttribute('aria-activedescendant');
}

// Rola só a lista do menu (scrollIntoView também rolaria a página e fecharia o menu).
function seletorRolarPara(el) {
  const a = SELETOR_ABERTO; if (!a || !el) return;
  const l = a.lista, topo = el.offsetTop, fim = topo + el.offsetHeight;
  if (topo < l.scrollTop) l.scrollTop = topo - 4;
  else if (fim > l.scrollTop + l.clientHeight) l.scrollTop = fim - l.clientHeight + 4;
}

function seletorPasso(delta) {
  const a = SELETOR_ABERTO; if (!a || !a.itens.length) return;
  const livres = a.itens.filter((el) => el.getAttribute('aria-disabled') !== 'true');
  if (!livres.length) return;
  let k = livres.indexOf(a.ativo);
  if (delta === Infinity) k = livres.length - 1;
  else if (delta === -Infinity) k = 0;
  else k = k < 0 ? (delta > 0 ? 0 : livres.length - 1) : Math.max(0, Math.min(livres.length - 1, k + delta));
  seletorMarcar(livres[k]);
}

function seletorPosicionar() {
  const a = SELETOR_ABERTO; if (!a) return;
  const r = a.sel.getBoundingClientRect();
  const m = a.menu;
  const margem = 8;
  m.style.minWidth = Math.max(Math.round(r.width), 180) + 'px';
  m.style.maxWidth = Math.max(200, Math.min(380, innerWidth - 2 * margem)) + 'px';
  const embaixo = innerHeight - r.bottom - 12, emcima = r.top - 12;
  const acima = embaixo < 220 && emcima > embaixo;
  const alto = Math.max(120, Math.min(340, acima ? emcima : embaixo));
  m.style.maxHeight = alto + 'px';
  m.style.top = acima ? 'auto' : Math.round(r.bottom + 4) + 'px';
  m.style.bottom = acima ? Math.round(innerHeight - r.top + 4) + 'px' : 'auto';
  const largura = m.offsetWidth || r.width;
  m.style.left = Math.round(Math.max(margem, Math.min(r.left, innerWidth - largura - margem))) + 'px';
  m.classList.toggle('acima', acima);
}

function seletorAbrir(sel, { toque = false } = {}) {
  seletorFechar(false);
  const id = 'vb-seletor-' + (++SELETOR_SEQ);
  const nome = seletorNome(sel);
  const comBusca = seletorOpcoes(sel).length >= SELETOR_BUSCA_A_PARTIR;
  const menu = document.createElement('div');
  menu.className = 'vb-seletor-menu';
  menu.setAttribute('data-vybe-seletor', '');
  menu.innerHTML = (comBusca
    ? `<label class="vb-seletor-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`
      + `<input type="text" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="${id}-lista" autocomplete="off" spellcheck="false" placeholder="Buscar" aria-label="${seletorEsc(nome ? 'Buscar em ' + nome : 'Buscar')}"></label>`
    : '')
    + `<div class="vb-seletor-lista" role="listbox" id="${id}-lista" tabindex="-1"${nome ? ` aria-label="${seletorEsc(nome)}"` : ''}></div>`
    + `<p class="vb-seletor-vazio" hidden>Nada com esse nome.</p>`;
  // Em cima de tudo, até de janela modal (<dialog>): camada de cima do navegador quando houver. Dentro de um
  // <dialog> modal o menu nasce no próprio dialog: fora dele o navegador deixa tudo inerte (sem clique).
  const temPopover = typeof menu.showPopover === 'function';
  if (temPopover) menu.setAttribute('popover', 'manual');
  (sel.closest('dialog[open]') || document.body).appendChild(menu);
  if (temPopover) { try { menu.showPopover(); } catch (e) { /* segue como camada comum */ } }

  SELETOR_ABERTO = {
    sel, menu, id,
    lista: menu.querySelector('.vb-seletor-lista'),
    busca: menu.querySelector('input'),
    vazio: menu.querySelector('.vb-seletor-vazio'),
    itens: [], ativo: null, obs: null, obsCorpo: null,
  };
  const a = SELETOR_ABERTO;
  sel.setAttribute('aria-expanded', 'true');
  sel.setAttribute('aria-controls', `${id}-lista`);
  seletorMontarLista();
  seletorPosicionar();
  menu.classList.add('aberto');
  // No toque, o teclado do celular não sobe sozinho: a busca fica à vista e abre quando a pessoa toca nela.
  ((toque ? null : a.busca) || a.lista).focus({ preventScroll: true });
  seletorRolarPara(a.ativo);

  // Opções, valor ou `disabled` mudando com o menu aberto: refaz ou fecha.
  a.obs = new MutationObserver(() => {
    if (!SELETOR_ABERTO || SELETOR_ABERTO.sel !== sel) return;
    if (!seletorElegivel(sel)) { seletorFechar(false); return; }
    seletorMontarLista();
  });
  a.obs.observe(sel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'label', 'hidden'] });
  // O campo saiu da tela (a janela fechou ou foi redesenhada): o menu vai junto.
  a.obsCorpo = new MutationObserver(() => {
    if (SELETOR_ABERTO && SELETOR_ABERTO.sel === sel && !sel.isConnected) seletorFechar(false);
  });
  a.obsCorpo.observe(document.body, { childList: true, subtree: true });
}

function seletorFechar(devolverFoco = true) {
  const a = SELETOR_ABERTO; if (!a) return;
  SELETOR_ABERTO = null;
  a.obs && a.obs.disconnect();
  a.obsCorpo && a.obsCorpo.disconnect();
  a.sel.removeAttribute('aria-expanded');
  a.sel.removeAttribute('aria-controls');
  try { if (a.menu.matches(':popover-open')) a.menu.hidePopover(); } catch (e) { /* sem popover */ }
  a.menu.remove();
  if (devolverFoco && a.sel.isConnected) a.sel.focus({ preventScroll: true });
}

function seletorEscolher(el) {
  const a = SELETOR_ABERTO; if (!a || !el || el.getAttribute('aria-disabled') === 'true') return;
  const sel = a.sel, i = +el.dataset.i;
  seletorFechar(true);
  if (sel.selectedIndex === i) return;
  sel.selectedIndex = i;
  sel.dispatchEvent(new Event('input', { bubbles: true }));
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}

// Sem busca, a letra pula para a opção que começa assim (como o menu do navegador).
function seletorPularPorLetra(ch) {
  const a = SELETOR_ABERTO; if (!a) return;
  const agora = Date.now();
  SELETOR_DIGITADO = { texto: (agora < SELETOR_DIGITADO.ate ? SELETOR_DIGITADO.texto : '') + ch, ate: agora + 700 };
  const alvo = seletorNormaliza(SELETOR_DIGITADO.texto);
  const livres = a.itens.filter((el) => el.getAttribute('aria-disabled') !== 'true');
  const achou = livres.find((el) => seletorNormaliza(el.textContent).startsWith(alvo));
  if (achou) seletorMarcar(achou);
}

function seletorTeclaAberto(e) {
  const a = SELETOR_ABERTO;
  const k = e.key;
  const pagina = Math.max(1, Math.floor(a.lista.clientHeight / 34) - 1);
  const mapa = { ArrowDown: 1, ArrowUp: -1, PageDown: pagina, PageUp: -pagina, Home: -Infinity, End: Infinity };
  if (k in mapa && !(a.busca && (k === 'Home' || k === 'End'))) { e.preventDefault(); seletorPasso(mapa[k]); }
  else if (k === 'Enter') { e.preventDefault(); seletorEscolher(a.ativo); }
  else if (k === 'Escape') { e.preventDefault(); seletorFechar(true); }
  else if (k === 'Tab') { e.preventDefault(); seletorFechar(true); }
  else if (!a.busca && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); seletorPularPorLetra(k); }
  // Com o menu aberto toda tecla é dele (a digitação vai para a busca): a janela por baixo não fecha com o Esc, o
  // boneco não anda com as letras e as setas não mexem em outra coisa.
  e.stopPropagation();
  e.stopImmediatePropagation();
}

function iniciarSeletor() {
  // Tudo na captura da janela e registrado já na carga (este arquivo vem antes dos módulos do mundo): o Esc do menu
  // chega aqui antes do Esc que fecha a janela por baixo.
  // Clique no campo: segura o menu do navegador e abre (ou fecha) o do padrão.
  window.addEventListener('mousedown', (e) => {
    const a = SELETOR_ABERTO;
    if (a && a.menu.contains(e.target)) { if (e.target !== a.busca) e.preventDefault(); return; }
    const sel = e.target && e.target.closest ? e.target.closest('select') : null;
    if (e.button === 0 && seletorElegivel(sel)) {
      e.preventDefault();
      if (a && a.sel === sel) { seletorFechar(true); return; }
      sel.focus({ preventScroll: true });
      seletorAbrir(sel);
      return;
    }
    if (a) seletorFechar(false);
  }, true);

  // Toque (celular): abre no fim do toque, se o dedo não rolou a tela.
  window.addEventListener('touchstart', (e) => {
    const t = e.touches && e.touches[0];
    SELETOR_TOQUE = t ? { x: t.clientX, y: t.clientY } : null;
  }, { capture: true, passive: true });
  window.addEventListener('touchend', (e) => {
    const a = SELETOR_ABERTO;
    if (a && a.menu.contains(e.target)) return;
    const sel = e.target && e.target.closest ? e.target.closest('select') : null;
    const t = e.changedTouches && e.changedTouches[0];
    const parado = SELETOR_TOQUE && t && Math.abs(t.clientX - SELETOR_TOQUE.x) < 10 && Math.abs(t.clientY - SELETOR_TOQUE.y) < 10;
    if (!seletorElegivel(sel)) { if (a && parado) seletorFechar(false); return; }
    if (!parado) return;
    e.preventDefault();
    if (a && a.sel === sel) { seletorFechar(false); return; }
    seletorAbrir(sel, { toque: true });
  }, { capture: true, passive: false });

  window.addEventListener('click', (e) => {
    const a = SELETOR_ABERTO; if (!a) return;
    const op = e.target && e.target.closest ? e.target.closest('.vb-seletor-opcao') : null;
    if (op && a.menu.contains(op)) { e.preventDefault(); seletorEscolher(op); }
  }, true);

  window.addEventListener('mousemove', (e) => {
    const a = SELETOR_ABERTO; if (!a) return;
    const op = e.target && e.target.closest ? e.target.closest('.vb-seletor-opcao') : null;
    if (op && op !== a.ativo && a.menu.contains(op) && op.getAttribute('aria-disabled') !== 'true') seletorMarcar(op, false);
  }, true);

  // Teclado: com o menu aberto, ele é dono das teclas; no campo fechado, setas, Enter, espaço e F4 abrem.
  window.addEventListener('keydown', (e) => {
    if (SELETOR_ABERTO) { seletorTeclaAberto(e); return; }
    const sel = e.target;
    if (!seletorElegivel(sel)) return;
    const abre = e.key === 'Enter' || e.key === ' ' || e.key === 'F4' || e.key === 'ArrowDown' || e.key === 'ArrowUp';
    if (!abre || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    e.stopPropagation();
    seletorAbrir(sel);
  }, true);

  window.addEventListener('input', (e) => {
    const a = SELETOR_ABERTO;
    if (a && e.target === a.busca) { e.stopPropagation(); seletorMontarLista(); }
  }, true);

  // Rolar a página ou a janela por baixo fecha, como o menu do navegador; mudar o tamanho só reposiciona.
  window.addEventListener('scroll', (e) => {
    const a = SELETOR_ABERTO;
    if (a && !(e.target instanceof Node && a.menu.contains(e.target))) seletorFechar(false);
  }, true);
  window.addEventListener('resize', () => seletorPosicionar());
  window.addEventListener('blur', () => seletorFechar(false));
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') iniciarSeletor();
