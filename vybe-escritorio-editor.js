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
  // Quem administra, fora de uma sala individual, edita o mapa geral (onde
  // está: Lounge, Recepção…); antes abria a própria sala e nada do resto mexia.
  if (escritorio.base?.admin && !aqui?.pessoal && escritorioPodeEditar("geral")) return "geral";
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
  escritorio.mapa?.previa(null);
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
  // Quadro: vai na parede alta mais perto do ladrilho clicado.
  const quadroNovo = e.novo && escritorioImagemDe(e.novo)?.tipo === "quadro";
  const quadroSel = !e.novo && e.sel !== null && escritorioImagemDe(e.itens[e.sel]?.[0])?.tipo === "quadro";
  if (quadroNovo || quadroSel) {
    const classe = quadroNovo ? e.novo : e.itens[e.sel][0];
    const lugar = escritorioLugarQuadro(classe, lx, ly, quadroNovo ? -1 : e.sel);
    if (lugar.erro) {
      // Clique em outro quadro ou móvel seleciona em vez de mover.
      if (!quadroNovo && escritorioSelecionarNoClique(x, y, lx, ly)) return;
      return escritorioAviso(lugar.erro);
    }
    if (quadroNovo) { e.itens.push([classe, lugar.lx, lugar.ly, lugar.dir, 0, 0]); e.sel = e.itens.length - 1; e.novo = null; escritorioAviso("Quadro colocado. Clique em outro trecho da parede para mudar; Delete apaga."); }
    else { const it = e.itens[e.sel]; it[1] = lugar.lx; it[2] = lugar.ly; it[3] = lugar.dir; }
    return escritorioEditorMudou();
  }
  if (e.novo) {
    if (!(await escritorioCabe(e.novo, lx, ly, 2))) return escritorioAviso("Esse móvel não cabe aí. Escolha outro lugar dentro de " + escritorioNomeCamada(e.camada) + ".");
    const d = await escritorio.mapa.medidas(e.novo, 2);
    e.itens.push([e.novo, lx, ly, d.dir, 0, 0]);
    escritorio.mapa?.previa(null);
    e.sel = e.itens.length - 1;
    e.novo = null;
    escritorioAviso("Móvel colocado. R gira, Delete apaga, setas empurram.");
    return escritorioEditorMudou();
  }
  if (escritorioSelecionarNoClique(x, y, lx, ly)) return;
  // Clicou num móvel de outra área que a pessoa pode editar: troca para ela.
  const deOutra = escritorio.mapa.moveisEm(x, y).find((m) => m.origem && m.origem.camada !== e.camada && escritorioPodeEditar(m.origem.camada));
  if (deOutra && e.sel === null) {
    if (e.mudou) return escritorioAviso("Esse móvel é de " + escritorioNomeCamada(deOutra.origem.camada) + ". Salve ou cancele esta edição antes.");
    abrirEditorEscritorio(deOutra.origem.camada);
    escritorio.edicao.sel = deOutra.origem.i;
    escritorio.mapa.destacar(deOutra.origem);
    renderBarraEditorEscritorio();
    return escritorioAviso("Agora editando " + escritorioNomeCamada(deOutra.origem.camada) + ".");
  }
  if (!deOutra && e.sel === null && escritorio.mapa.moveisEm(x, y).length) return escritorioAviso("Esse móvel não é de " + escritorioNomeCamada(e.camada) + ", e você não pode editá-lo.");
  if (e.sel !== null) {
    const it = e.itens[e.sel];
    if (!(await escritorioCabe(it[0], lx, ly, it[3]))) return escritorioAviso("Não cabe aí.");
    it[1] = lx; it[2] = ly;
    return escritorioEditorMudou();
  }
}
// Seleciona o quadro encostado no ladrilho clicado ou o móvel em cima dele.
function escritorioSelecionarNoClique(x, y, lx, ly) {
  const e = escritorio.edicao;
  const quadro = e.itens.findIndex((it) => escritorioImagemDe(it[0])?.tipo === "quadro" && escritorioQuadroCobre(it, lx, ly));
  if (quadro >= 0 && quadro !== e.sel) {
    e.sel = quadro;
    escritorio.mapa.destacar(null);
    renderBarraEditorEscritorio();
    return true;
  }
  const daCamada = escritorio.mapa.moveisEm(x, y).find((m) => m.origem?.camada === e.camada);
  if (daCamada && daCamada.origem.i !== e.sel) {
    e.sel = daCamada.origem.i;
    escritorio.mapa.destacar(daCamada.origem);
    renderBarraEditorEscritorio();
    return true;
  }
  return false;
}
async function girarSelecionadoEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.sel === null) return;
  const it = e.itens[e.sel];
  if (escritorioImagemDe(it[0])) return escritorioAviso(escritorioImagemDe(it[0]).tipo === "quadro" ? "O quadro segue a parede: clique em outro trecho dela para mudar." : "O tapete fica do jeito que a imagem é.");
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
  if (escritorioImagemDe(it[0])) return;
  it[5] = it[5] ? 0 : 1;
  escritorioEditorMudou();
}
async function empurrarSelecionadoEscritorio(dx, dy) {
  const e = escritorio.edicao, it = e.itens[e.sel];
  if (escritorioImagemDe(it[0])?.tipo === "quadro") {
    const lugar = escritorioLugarQuadro(it[0], it[3] === 4 ? it[1] + dx : 0, it[3] === 2 ? it[2] + dy : 0, e.sel, it[3]);
    if (lugar.erro) return;
    it[1] = lugar.lx; it[2] = lugar.ly;
    return escritorioEditorMudou();
  }
  if (!(await escritorioCabe(it[0], it[1] + dx, it[2] + dy, it[3]))) return;
  it[1] += dx; it[2] += dy;
  escritorioEditorMudou();
}
function teclaEditorEscritorio(e) {
  const ed = escritorio.edicao;
  if (!ed || e.target.closest?.("input, textarea, select")) return false;
  if (e.key === "Escape") { if (ed.trocar != null) ed.trocar = null; else if (ed.novo) ed.novo = null; else { ed.sel = null; escritorio.mapa?.destacar(null); } escritorio.mapa?.previa(null); renderBarraEditorEscritorio(); return true; }
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
  // Quem administra escolhe a área a editar (mapa geral ou qualquer sala).
  const areas = escritorio.base?.admin ? [["geral", "Mapa geral (espaços comuns)"], ...ESCRITORIO_PLANTA.ambientes.filter((a) => a.pessoal).map((a) => [a.id, a.nome])] : [];
  const escolha = areas.length ? `<select aria-label="Área que você está editando" onchange="trocarCamadaEditorEscritorio(this.value)">${areas.map(([id, nome]) => `<option value="${id}"${id === e.camada ? " selected" : ""}>${safeText(nome)}</option>`).join("")}</select>` : `<b>Editando ${safeText(escritorioNomeCamada(e.camada))}</b>`;
  el.innerHTML = `<div class="ofc-editor-info">${escolha}<span>${e.trocar != null ? "Escolha no catálogo, à esquerda, o novo modelo · Esc cancela" : e.novo && escritorioImagemDe(e.novo)?.tipo === "quadro" ? "Clique no piso encostado na parede alta do fundo · Esc cancela" : e.novo ? "Clique no piso para colocar · Esc cancela" : it ? "R gira · Delete apaga · setas empurram · clique no piso move" : "Clique num móvel para selecionar ou escolha um no catálogo"}</span></div>
${it ? (escritorioImagemDe(it[0]) ? `<div class="ofc-editor-sel"><span>${escritorioImagemDe(it[0]).tipo === "quadro" ? "Quadro" : "Tapete"}: ${safeText(escritorioImagemDe(it[0]).nome || "imagem")}</span><button type="button" class="perigo" onclick="apagarSelecionadoEscritorio()">Tirar do mapa</button></div>` : `<div class="ofc-editor-sel"><button type="button" onclick="girarSelecionadoEscritorio()">Girar</button><button type="button" aria-pressed="${Boolean(it[5])}" onclick="alturaSelecionadoEscritorio()">Em cima da mesa</button><button type="button" class="perigo" onclick="apagarSelecionadoEscritorio()">Apagar</button></div>`) : ""}
<div class="ofc-editor-acoes"><button type="button" onclick="sairEditorEscritorio()">Cancelar</button><button type="button" class="ofc-primario" onclick="salvarEditorEscritorio()" ${e.salvando ? "disabled" : ""}>${e.salvando ? "Salvando…" : "Salvar"}</button></div>`;
}
// Catálogo: os móveis do painel por categoria e a busca no catálogo do Habbo.
// A lista do catálogo do painel vem pela API na primeira vez que o editor abre.
let escritorioCatalogo = null;
async function carregarCatalogoEscritorio() {
  if (escritorioCatalogo) return;
  escritorioCatalogo = [];
  try {
    const r = await fetch(mapaArquivo("catalogo.json"), { credentials: "same-origin" });
    escritorioCatalogo = r.ok ? await r.json() : [];
  } catch {}
  if (escritorio.edicao) renderEscritorio();
}
// Computadores que vêm com o painel (para "Editar computador"); entram no
// catálogo como uma categoria própria.
const ESCRITORIO_COMPUTADORES = [
  ["computer_flatscreen", "Computador de mesa"], ["computer_laptop", "Notebook"], ["uni_laptop", "Notebook da faculdade"],
  ["computer_old", "Computador antigo"], ["steampunk_computer", "Computador steampunk"], ["easter_c23_solarpunkcomputer", "Computador solar"],
].map(([classe, nome]) => ({ classe, nome, categoria: "Computadores" }));
function escritorioCatalogoHtml() {
  if (!escritorioCatalogo) { carregarCatalogoEscritorio(); return '<p class="ofc-nota">Carregando catálogo…</p>'; }
  const filtro = escritorio.catalogoCategoria || "";
  const abaImagens = `<button type="button" aria-pressed="${filtro === "Imagens"}" onclick="escritorio.catalogoCategoria='Imagens';renderEscritorio()">Imagens · ${escritorioImagensDaCamada().length}</button>`;
  if (filtro === "Imagens") return `<div class="ofc-cats"><button type="button" onclick="escritorio.catalogoCategoria='';renderEscritorio()">Móveis</button>${abaImagens}</div>${escritorioImagensHtml()}`;
  const todas = [...escritorioCatalogo, ...ESCRITORIO_COMPUTADORES];
  const lista = filtro ? todas.filter((m) => m.categoria === filtro) : todas.filter((m) => m.categoria === "Do escritório");
  const cats = [...new Set(lista.map((m) => m.categoria))];
  const abas = [...new Set(todas.map((m) => m.categoria))];
  const cartao = (m) => `<button type="button" class="ofc-movel" onclick="escolherMovelEscritorio('${safeText(m.classe)}')" title="${safeText(m.nome)}"><img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(m.classe)}.png?size=64" alt="" onerror="miniaturaLocalEscritorio(this,'${safeText(m.classe)}')"><span>${safeText(m.nome)}</span></button>`;
  return `<form class="ofc-busca" onsubmit="event.preventDefault();buscarMovelEscritorio(this.q.value)"><input name="q" placeholder="Buscar no catálogo do Habbo (ex.: sofa, plant, lamp)" aria-label="Buscar móvel" autocomplete="off"><button class="workflow-primary">Buscar</button></form>
<div id="office-busca-resultados" class="ofc-moveis"></div>
<div class="ofc-cats">${abaImagens}${abas.map((c) => `<button type="button" aria-pressed="${(filtro || "Do escritório") === c}" onclick="escritorio.catalogoCategoria='${safeText(c)}';renderEscritorio()">${safeText(c)} · ${todas.filter((m) => m.categoria === c).length}</button>`).join("")}</div>
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
// Prévia ao passar o mouse no editor: o móvel novo (ou o selecionado) onde ele
// iria ficar, verde se cabe e vermelho se não.
async function previaEditorEscritorio(x, y) {
  const e = escritorio.edicao;
  if (!e || x < 0) return escritorio.mapa?.previa(null);
  const it = e.novo ? null : e.sel !== null ? e.itens[e.sel] : null;
  const classe = e.novo || it?.[0];
  if (!classe || e.trocar != null) return escritorio.mapa?.previa(null);
  const c = escritorioCantoCamada(e.camada), dir = e.novo ? 2 : it[3];
  const lx = x - c.x, ly = y - c.y;
  let cabe = false;
  try { cabe = await escritorioCabe(classe, lx, ly, dir); } catch {}
  escritorio.mapa?.previa(classe, x, y, dir, cabe);
}
function escolherMovelEscritorio(classe) {
  if (!escritorio.edicao || !/^[a-z0-9_]+$/i.test(classe)) return;
  // Trocando o modelo da mesa ou do computador: mesmo lugar, outro móvel.
  const e = escritorio.edicao;
  if (e.trocar != null && e.itens[e.trocar]) {
    const it = e.itens[e.trocar];
    escritorioCabe(classe, it[1], it[2], it[3]).then((cabe) => {
      if (!cabe) return escritorioAviso("Esse modelo não cabe no lugar do atual. Escolha outro ou apague o atual e coloque o novo.");
      it[0] = classe;
      e.sel = e.trocar;
      e.trocar = null;
      escritorioAviso("Trocado. Clique em Salvar para manter.");
      escritorioEditorMudou();
    }).catch(() => escritorioAviso("Esse móvel não carregou."));
    return;
  }
  escritorio.edicao.novo = classe;
  escritorio.edicao.sel = null;
  escritorio.mapa?.destacar(null);
  escritorio.mapa?.medidas(classe, 2).catch(() => escritorioAviso("Esse móvel não carregou."));
  renderBarraEditorEscritorio();
  escritorioAviso("Clique no piso para colocar.");
}

// Sem a foto do site, desenha a miniatura com a arte guardada no painel.
async function miniaturaLocalEscritorio(img, classe) {
  img.onerror = null;
  try {
    const m = await mapaCarregarMovel(classe);
    const v = m.dados.visualizations.find((x) => x.size === 64);
    const dir = Number(Object.keys(v?.directions || { 2: 1 })[0]) || 0;
    const d = mapaDesenharMovel(m, mapaDirecaoValida(m.dados, 2) ?? dir, 0, 0);
    if (d) img.src = d.canvas.toDataURL();
  } catch {
    img.style.visibility = "hidden";
  }
}

// Imagens da equipe: a pessoa sobe um PNG/JPG/WEBP e usa como quadro (na
// parede alta da própria sala) ou tapete (no piso). O servidor confere dono,
// tipo do arquivo e tamanho; aqui só se reduz a imagem grande antes de enviar.
function escritorioImagemDe(classe) {
  const m = /^vybeimg_(\d+)$/.exec(String(classe || ""));
  return m ? (escritorio.base?.mapa?.imagens || []).find((i) => i.id === m[1]) || null : null;
}
function escritorioImagensDaCamada() {
  const camada = escritorio.edicao?.camada;
  return (escritorio.base?.mapa?.imagens || []).filter((i) => i.camada === camada);
}
function escritorioUrlImagem(id) {
  return ESCRITORIO_PLANTA.urlImagem ? ESCRITORIO_PLANTA.urlImagem(id) : "/api/painel?area=escritorio&acao=imagem&id=" + encodeURIComponent(id);
}
// Lugar do quadro na parede: dir 4 = parede de trás (ly 0), dir 2 = parede da
// esquerda (lx 0). Fica inteiro na sala, fora da porta e sem cobrir outro.
function escritorioLugarQuadro(classe, lx, ly, ignorar = -1, dirFixa = null) {
  const e = escritorio.edicao, img = escritorioImagemDe(classe);
  const a = ESCRITORIO_PLANTA.ambientes.find((x) => x.id === e.camada);
  if (!img || !a?.pessoal) return { erro: "Quadro só nas salas individuais." };
  const L = a.x1 - a.x0;
  let dir = dirFixa;
  if (dir == null) dir = ly === 0 ? 4 : lx === 0 && a.x0 > 0 ? 2 : null;
  if (dir == null) return { erro: a.x0 > 0 ? "Clique no piso encostado na parede alta (a de trás ou a da esquerda)." : "Clique no piso encostado na parede alta de trás." };
  const ini = dir === 4 ? lx : ly;
  if (ini < 0 || ini + img.largura > L) return { erro: "O quadro não cabe aí: chegue mais para o canto." };
  if (dir === 4 && a.porta === "cima" && ini < 6 && ini + img.largura > 4) return { erro: "Ali é a porta. Escolha outro trecho da parede." };
  const outro = e.itens.findIndex((it, i) => {
    if (i === ignorar || it[3] !== dir) return false;
    const o = escritorioImagemDe(it[0]);
    if (o?.tipo !== "quadro") return false;
    const oi = dir === 4 ? it[1] : it[2];
    return ini < oi + o.largura && oi < ini + img.largura;
  });
  if (outro >= 0) return { erro: "Já tem um quadro aí." };
  return dir === 4 ? { lx: ini, ly: 0, dir } : { lx: 0, ly: ini, dir };
}
function escritorioQuadroCobre(it, lx, ly) {
  const img = escritorioImagemDe(it[0]);
  if (!img) return false;
  return it[3] === 4 ? ly === 0 && lx >= it[1] && lx < it[1] + img.largura : lx === 0 && ly >= it[2] && ly < it[2] + img.largura;
}
function escritorioImagensHtml() {
  const e = escritorio.edicao;
  const geral = e?.camada === "geral";
  const lista = escritorioImagensDaCamada();
  const tamanhos = (max) => Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  return `<form class="ofc-imagem-form" onsubmit="event.preventDefault();enviarImagemEscritorio(this)">
<label>Imagem (PNG, JPG ou WEBP)<input type="file" name="arquivo" accept="image/png,image/jpeg,image/webp" required></label>
<label>Usar como<select name="tipo" onchange="alturasImagemEscritorio(this.form)">${geral ? "" : '<option value="quadro">Quadro na parede</option>'}<option value="tapete">Tapete no chão</option></select></label>
<div class="ofc-imagem-tam"><label>Largura<select name="largura">${tamanhos(6).replace('value="3"', 'value="3" selected')}</select></label><span>×</span><label>Altura<select name="altura">${tamanhos(geral ? 6 : 3).replace('value="2"', 'value="2" selected')}</select></label><small>ladrilhos</small></div>
<label>Nome (opcional)<input name="nome" maxlength="80" placeholder="Ex.: logo da Vybe"></label>
<button class="workflow-primary" ${e?.enviando ? "disabled" : ""}>${e?.enviando ? "Enviando…" : "Enviar imagem"}</button>
<p class="ofc-nota">${geral ? "No mapa geral, só tapetes." : "Quadro fica pintado na parede alta do fundo da sala; tapete fica no chão."} Até 1,5 MB.</p></form>
<h4>Imagens ${geral ? "do mapa" : "desta sala"}</h4>
<div class="ofc-moveis">${lista.map((i) => `<div class="ofc-imagem"><button type="button" class="ofc-movel" onclick="escolherMovelEscritorio('vybeimg_${i.id}')" title="Colocar ${safeText(i.nome || "imagem")}"><img loading="lazy" src="${escritorioUrlImagem(i.id)}" alt=""><span>${i.tipo === "quadro" ? "Quadro" : "Tapete"} ${i.largura}×${i.altura}${i.nome ? " · " + safeText(i.nome) : ""}</span></button><button type="button" class="ofc-imagem-apagar" onclick="apagarImagemEscritorio('${i.id}')" aria-label="Apagar a imagem ${safeText(i.nome || "")}">Apagar</button></div>`).join("") || '<p class="ofc-nota">Nenhuma imagem ainda.</p>'}</div>`;
}
// Quadro tem até 3 de altura (a parede); tapete, até 6.
function alturasImagemEscritorio(form) {
  const max = form.tipo.value === "quadro" ? 3 : 6, atual = Math.min(max, Number(form.altura.value) || 2);
  form.altura.innerHTML = Array.from({ length: max }, (_, i) => `<option value="${i + 1}"${i + 1 === atual ? " selected" : ""}>${i + 1}</option>`).join("");
}
// Imagem grande é reduzida (lado maior até 1024 px) antes de enviar.
function escritorioPrepararImagem(arquivo) {
  return new Promise((ok, erro) => {
    if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) return erro(new Error("Use uma imagem PNG, JPG ou WEBP."));
    const leitor = new FileReader();
    leitor.onerror = () => erro(new Error("Não deu para ler a imagem."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => erro(new Error("Essa imagem não abriu. Tente outro arquivo."));
      img.onload = () => {
        const lado = Math.max(img.naturalWidth, img.naturalHeight);
        if (arquivo.size <= 1572864 && lado <= 1600) return ok(String(leitor.result).split(",")[1]);
        const k = 1024 / lado, c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const dados = c.toDataURL(arquivo.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.88).split(",")[1];
        if (dados.length * 0.75 > 1572864) return erro(new Error("A imagem continua grande demais. Use uma menor."));
        ok(dados);
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}
async function enviarImagemEscritorio(form) {
  const e = escritorio.edicao;
  if (!e || e.enviando) return;
  if (escritorio.base.demo) return escritorioAviso("A demonstração não guarda imagens.");
  const arquivo = form.arquivo.files?.[0];
  if (!arquivo) return escritorioAviso("Escolha uma imagem.");
  const pedido = { camada: e.camada, tipo: form.tipo.value, largura: Number(form.largura.value), altura: Number(form.altura.value), nome: form.nome.value.trim() };
  e.enviando = true;
  renderEscritorio();
  try {
    const dados = await escritorioPrepararImagem(arquivo);
    const r = await escritorioApi("imagem", { ...pedido, dados });
    escritorio.base.mapa.imagens = [...(escritorio.base.mapa.imagens || []), r.imagem];
    escritorio.mapa?.registrarImagem(r.imagem);
    escritorioAviso("Imagem enviada. Clique nela para colocar.");
  } catch (erro) {
    escritorioAviso(erro.message);
  }
  e.enviando = false;
  renderEscritorio();
}
async function apagarImagemEscritorio(id) {
  const e = escritorio.edicao;
  if (!e || !confirm("Apagar esta imagem? Ela sai do mapa também.")) return;
  if (escritorio.base.demo) return escritorioAviso("A demonstração não apaga imagens.");
  try {
    const r = await escritorioApi("imagem-apagar", { id });
    const classe = "vybeimg_" + id;
    escritorio.base.mapa.imagens = (escritorio.base.mapa.imagens || []).filter((i) => i.id !== String(id));
    // O servidor já tirou a imagem da área salva; a edição aberta acompanha.
    if (r.imagem.versao) { escritorio.base.mapa.camadas[r.imagem.camada] = { itens: r.imagem.itens, versao: r.imagem.versao }; if (e.camada === r.imagem.camada) e.versao = r.imagem.versao; }
    e.itens = e.itens.filter((it) => it[0] !== classe);
    e.sel = null;
    escritorioEditorMudou();
    renderEscritorio();
    escritorioAviso("Imagem apagada.");
  } catch (erro) {
    escritorioAviso(erro.message);
  }
}

function trocarCamadaEditorEscritorio(camada) {
  const e = escritorio.edicao;
  if (!e || camada === e.camada) return;
  if (e.mudou && !confirm("Descartar as mudanças em " + escritorioNomeCamada(e.camada) + "?")) return renderBarraEditorEscritorio();
  escritorio.edicao = null;
  abrirEditorEscritorio(camada);
}
