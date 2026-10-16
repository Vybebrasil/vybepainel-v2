// Editor do mapa do escritório. Quem administra edita o mapa geral (e qualquer
// sala); cada pessoa edita a própria sala. O servidor confere de novo ao salvar.
// Camadas: "geral" em coordenadas do mapa; "sala-N" relativas ao canto da sala.
function escritorioPodeEditar(camada) {
  const b = escritorio.base;
  if (!b?.mapa?.editavel && !b?.demo) return false;
  if (b.admin) return true;
  return camada !== "geral" && escritorioMinhaMesa()?.ambiente.id === camada;
}
// O que o botão "Editar" abre: a sala onde a pessoa está (se puder), a própria
// sala, ou o mapa geral para quem administra.
function escritorioCamadaParaEditar() {
  const aqui = escritorioLugarDe(escritorio.perfil);
  if (aqui?.pessoal && escritorioPodeEditar(aqui.id)) return aqui.id;
  const minha = escritorioMinhaMesa()?.ambiente.id;
  if (minha && escritorioPodeEditar(minha)) return minha;
  return escritorio.base?.admin ? "geral" : null;
}
function escritorioNomeCamada(camada) {
  return camada === "geral" ? "o mapa" : ESCRITORIO_PLANTA.ambientes.find((a) => a.id === camada)?.nome || camada;
}
function abrirEditorEscritorio(camada = escritorioCamadaParaEditar()) {
  if (!camada || !escritorioPodeEditar(camada)) {
    escritorioAviso(escritorio.base?.mapa?.editavel === false && !escritorio.base?.demo ? "O mapa editável aguarda a mudança no banco." : "Você pode editar a sua sala; o mapa, só quem administra.");
    return;
  }
  const salvo = escritorio.base.mapa?.camadas?.[camada];
  escritorio.edicao = {
    camada,
    itens: escritorioItensDaCamada(camada).map((it) => [...it.slice(0, 6)]),
    versao: salvo?.versao || 0,
    sel: null, novo: null, mudou: false,
  };
  escritorio.modo = "mapa";
  escritorio.aba = "catalogo";
  escritorio.lateral = true;
  renderEscritorio();
  const a = ESCRITORIO_PLANTA.ambientes.find((x) => x.id === camada);
  if (a) escritorio.mapa?.centralizar((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2);
}
function sairEditorEscritorio() {
  if (escritorio.edicao?.mudou && !confirm("Descartar as mudanças desta edição?")) return;
  escritorio.edicao = null;
  escritorio.aba = "pessoas";
  escritorio.mapa?.destacar(null);
  escritorio.mapa?.definirMoveis(escritorioMoveisAtuais());
  renderEscritorio();
}
async function salvarEditorEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.salvando) return;
  e.salvando = true;
  renderBarraEditorEscritorio();
  try {
    let r = { camada: e.camada, itens: e.itens, versao: e.versao + 1 };
    if (!escritorio.base.demo) r = await escritorioApi("mapa", { camada: e.camada, itens: e.itens, versao: e.versao });
    escritorio.base.mapa = escritorio.base.mapa || { editavel: true, camadas: {} };
    escritorio.base.mapa.camadas[e.camada] = { itens: r.itens, versao: r.versao };
    escritorio.edicao = null;
    escritorio.aba = "pessoas";
    escritorio.mapa?.destacar(null);
    await escritorio.mapa?.definirMoveis(escritorioMoveisAtuais());
    renderEscritorio();
    escritorioAviso("Mudanças salvas em " + escritorioNomeCamada(r.camada) + ".");
  } catch (erro) {
    e.salvando = false;
    renderBarraEditorEscritorio();
    escritorioAviso(erro.message);
  }
}
// Converte ladrilho do mapa ↔ coordenadas da camada.
function escritorioCantoCamada(camada) {
  const a = ESCRITORIO_PLANTA.ambientes.find((x) => x.id === camada);
  return a ? { x: a.x0, y: a.y0, w: a.x1 - a.x0, h: a.y1 - a.y0 } : { x: 0, y: 0, w: ESCRITORIO_PLANTA.W, h: ESCRITORIO_PLANTA.H };
}
// O móvel inteiro precisa caber na área que a pessoa pode editar.
async function escritorioCabe(classe, lx, ly, dir) {
  const c = escritorioCantoCamada(escritorio.edicao.camada);
  const d = await escritorio.mapa.medidas(classe, dir);
  return lx >= 0 && ly >= 0 && lx + d.x <= c.w && ly + d.y <= c.h;
}
let escritorioRedesenho = null;
function escritorioEditorMudou() {
  escritorio.edicao.mudou = true;
  clearTimeout(escritorioRedesenho);
  escritorioRedesenho = setTimeout(async () => {
    await escritorio.mapa?.definirMoveis(escritorioMoveisAtuais());
    const e = escritorio.edicao;
    escritorio.mapa?.destacar(e && e.sel !== null ? { camada: e.camada, i: e.sel } : null);
    renderBarraEditorEscritorio();
  }, 30);
}
async function cliqueEditorEscritorio(x, y) {
  const e = escritorio.edicao, c = escritorioCantoCamada(e.camada);
  const lx = Math.floor(x) - c.x, ly = Math.floor(y) - c.y;
  if (e.novo) {
    if (!(await escritorioCabe(e.novo, lx, ly, 2))) return escritorioAviso("Esse móvel não cabe aí. Escolha outro lugar dentro de " + escritorioNomeCamada(e.camada) + ".");
    const d = await escritorio.mapa.medidas(e.novo, 2);
    e.itens.push([e.novo, lx, ly, d.dir, 0, 0]);
    e.sel = e.itens.length - 1;
    e.novo = null;
    escritorioAviso("Móvel colocado. R gira, Delete apaga, setas empurram.");
    return escritorioEditorMudou();
  }
  const daCamada = escritorio.mapa.moveisEm(x, y).find((m) => m.origem?.camada === e.camada);
  if (daCamada && daCamada.origem.i !== e.sel) {
    e.sel = daCamada.origem.i;
    escritorio.mapa.destacar(daCamada.origem);
    return renderBarraEditorEscritorio();
  }
  if (e.sel !== null) {
    const it = e.itens[e.sel];
    if (!(await escritorioCabe(it[0], lx, ly, it[3]))) return escritorioAviso("Não cabe aí.");
    it[1] = lx; it[2] = ly;
    return escritorioEditorMudou();
  }
}
async function girarSelecionadoEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.sel === null) return;
  const it = e.itens[e.sel];
  const { direcoes } = await escritorio.mapa.medidas(it[0], it[3]);
  // Só as direções que o móvel tem de verdade (alguns só têm 1 ou 2).
  const lista = [0, 2, 4, 6].filter((d) => direcoes.includes(d));
  if (lista.length < 2) return escritorioAviso("Esse móvel não gira no Habbo.");
  const prox = lista[(lista.indexOf(it[3]) + 1) % lista.length];
  if (!(await escritorioCabe(it[0], it[1], it[2], prox))) return escritorioAviso("Girado, ele não caberia aí.");
  it[3] = prox;
  escritorioEditorMudou();
}
function apagarSelecionadoEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.sel === null) return;
  e.itens.splice(e.sel, 1);
  e.sel = null;
  escritorioEditorMudou();
}
// Liga/desliga "em cima da mesa": sobe a peça na altura de um tampo.
function alturaSelecionadoEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.sel === null) return;
  const it = e.itens[e.sel];
  it[5] = it[5] ? 0 : 1;
  escritorioEditorMudou();
}
async function empurrarSelecionadoEscritorio(dx, dy) {
  const e = escritorio.edicao, it = e.itens[e.sel];
  if (!(await escritorioCabe(it[0], it[1] + dx, it[2] + dy, it[3]))) return;
  it[1] += dx; it[2] += dy;
  escritorioEditorMudou();
}
function teclaEditorEscritorio(e) {
  const ed = escritorio.edicao;
  if (!ed || e.target.closest?.("input, textarea, select")) return false;
  if (e.key === "Escape") { if (ed.novo) ed.novo = null; else { ed.sel = null; escritorio.mapa?.destacar(null); } renderBarraEditorEscritorio(); return true; }
  if (ed.sel === null) return false;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === "r") { girarSelecionadoEscritorio(); return true; }
  if (k === "Delete" || k === "Backspace") { apagarSelecionadoEscritorio(); return true; }
  // Empurra um ladrilho pelos eixos do piso.
  const empurrao = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] }[k];
  if (empurrao) { empurrarSelecionadoEscritorio(...empurrao); return true; }
  return false;
}
// Faixa do editor sobre o mapa.
function renderBarraEditorEscritorio() {
  const el = document.getElementById("office-editor");
  const e = escritorio.edicao;
  if (!el) return;
  el.hidden = !e;
  if (!e) return;
  const it = e.sel !== null ? e.itens[e.sel] : null;
  el.innerHTML = `<div class="ofc-editor-info"><b>Editando ${safeText(escritorioNomeCamada(e.camada))}</b><span>${e.novo ? "Clique no piso para colocar o móvel · Esc cancela" : it ? "R gira · Delete apaga · setas empurram · clique no piso move" : "Clique num móvel para selecionar ou escolha um no catálogo"}</span></div>
${it ? `<div class="ofc-editor-sel"><button type="button" onclick="girarSelecionadoEscritorio()">Girar</button><button type="button" aria-pressed="${Boolean(it[5])}" onclick="alturaSelecionadoEscritorio()">Em cima da mesa</button><button type="button" class="perigo" onclick="apagarSelecionadoEscritorio()">Apagar</button></div>` : ""}
<div class="ofc-editor-acoes"><button type="button" onclick="sairEditorEscritorio()">Cancelar</button><button type="button" class="ofc-primario" onclick="salvarEditorEscritorio()" ${e.salvando ? "disabled" : ""}>${e.salvando ? "Salvando…" : "Salvar"}</button></div>`;
}
// Catálogo: os móveis do painel por categoria e a busca no catálogo do Habbo.
function escritorioCatalogoHtml() {
  const lista = typeof ESCRITORIO_CATALOGO !== "undefined" ? ESCRITORIO_CATALOGO : [];
  const cats = [...new Set(lista.map((m) => m.categoria))];
  const cartao = (m) => `<button type="button" class="ofc-movel" onclick="escolherMovelEscritorio('${safeText(m.classe)}')" title="${safeText(m.nome)}"><img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(m.classe)}.png?size=64" alt=""><span>${safeText(m.nome)}</span></button>`;
  return `<form class="ofc-busca" onsubmit="event.preventDefault();buscarMovelEscritorio(this.q.value)"><input name="q" placeholder="Buscar no catálogo do Habbo (ex.: sofa, plant, lamp)" aria-label="Buscar móvel" autocomplete="off"><button class="workflow-primary">Buscar</button></form>
<div id="office-busca-resultados" class="ofc-moveis"></div>
${cats.map((c) => `<h4>${safeText(c)}</h4><div class="ofc-moveis">${lista.filter((m) => m.categoria === c).map(cartao).join("")}</div>`).join("") || '<p class="ofc-nota">Busque um móvel pelo nome em inglês.</p>'}`;
}
async function buscarMovelEscritorio(q) {
  const el = document.getElementById("office-busca-resultados");
  if (!el || !q.trim()) return;
  el.innerHTML = '<p class="ofc-nota">Buscando…</p>';
  try {
    const r = await fetch("https://www.habboassets.com/imaging/search?" + new URLSearchParams({ type: "furniture", q: q.trim() }));
    const d = await r.json();
    el.innerHTML = (d.results || []).map((m) => `<button type="button" class="ofc-movel" onclick="escolherMovelEscritorio('${safeText(m.name)}')" title="${safeText(m.name)}"><img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(m.name)}.png?size=64" alt=""><span>${safeText(m.name.replace(/_/g, " "))}</span></button>`).join("") || '<p class="ofc-nota">Nada encontrado. Tente outra palavra em inglês.</p>';
  } catch {
    el.innerHTML = '<p class="ofc-nota">O catálogo do Habbo não respondeu. Use os móveis do painel abaixo.</p>';
  }
}
function escolherMovelEscritorio(classe) {
  if (!escritorio.edicao || !/^[a-z0-9_]+$/i.test(classe)) return;
  escritorio.edicao.novo = classe;
  escritorio.edicao.sel = null;
  escritorio.mapa?.destacar(null);
  escritorio.mapa?.medidas(classe, 2).catch(() => escritorioAviso("Esse móvel não carregou."));
  renderBarraEditorEscritorio();
  escritorioAviso("Clique no piso para colocar.");
}
