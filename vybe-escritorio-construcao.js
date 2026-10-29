// Construção como jogo (Paulo, 26/10/2026: "não parece modo de construção de
// jogo… ver os pisos tá ruim, construir não tá fácil"). Um modo de cada vez,
// escolhido na barra de baixo (ou nas teclas 1 a 6): Móveis, Piso, Parede,
// Planta, Luz e Extras. Cada modo tem as suas ferramentas logo acima da barra
// e os seus materiais na Oficina. Por baixo continuam o rascunho, o pincel, a
// física e o salvamento de sempre (vybe-escritorio-editor.js e -ficha.js):
// aqui só se escolhe o que o clique faz e o que aparece na tela.
// Pisos, paredes, acabamentos e blocos são grátis e sem limite
// (server/escritorio-economia.js, MOVEIS_DE_CONSTRUCAO).

const ESCRITORIO_MODOS_CONSTRUCAO = [
  ["moveis", "Móveis", "mesa", "Colocar, girar e organizar"],
  ["piso", "Piso", "piso", "Pintar o chão com cores e peças"],
  ["parede", "Parede", "parede", "Estilo, cor, altura e revestimentos"],
  ["planta", "Planta", "planta", "Formato do quarto, patamares e porta"],
  ["luz", "Luz", "luz", "Luz ambiente do quarto"],
  ["extras", "Extras", "pilha", "Imagens e conjuntos"],
];
// Ícones próprios da construção (os demais vêm de escritorioIcone).
const ESCRITORIO_ICONES_CONSTRUCAO = {
  piso: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M7.5 6.5l9 5M16.5 6.5l-9 5"/><path d="M3 14l9 5 9-5"/>',
  parede: '<path d="M4 5h16v14H4z"/><path d="M4 9.7h16M4 14.3h16M9.3 5v4.7M14.7 9.7v4.6M9.3 14.3V19"/>',
  planta: '<path d="M4 15l8-4.5 8 4.5-8 4.5z"/><path d="M8 8.2l4-2.2 4 2.2-4 2.3z"/><path d="M8 8.2v3.6M16 8.2v3.6"/>',
  luz: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0012 3z"/>',
  olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  pincel: '<path d="M14.5 4.5l5 5-8.5 8.5H6v-5z"/><path d="M12.5 6.5l5 5"/>',
  retangulo: '<rect x="4.5" y="6" width="15" height="12" rx="1.5" stroke-dasharray="3 2"/>',
  linha: '<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/>',
  balde: '<path d="M5 10l7-6 7 6-7 7z"/><path d="M19.5 14.5c0 1.4-.9 2.5-2 2.5s-2-1.1-2-2.5 2-4 2-4 2 2.6 2 4z"/>',
  borracha: '<path d="M8 20h12"/><path d="M4.5 15.5l9-9a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8l-7 7H8z"/><path d="M9 11l5 5"/>',
  tudo: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>',
  girar: '<path d="M20 12a8 8 0 11-2.3-5.6"/><path d="M20 4v4.5h-4.5"/>',
  lixo: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
};
function escritorioIconeConstrucao(nome) {
  const d = ESCRITORIO_ICONES_CONSTRUCAO[nome];
  return d ? `<svg class="ofc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>` : escritorioIcone(nome);
}
// Construindo o próprio quarto (piso, parede, planta e luz só existem nele).
function escritorioConstruindoMeuQuarto() {
  const e = escritorio.edicao;
  return Boolean(e && e.camada !== "geral" && escritorioMinhaMesa()?.ambiente.id === e.camada);
}
function escritorioModosDisponiveis() {
  return escritorioConstruindoMeuQuarto() ? ESCRITORIO_MODOS_CONSTRUCAO : ESCRITORIO_MODOS_CONSTRUCAO.filter(([id]) => id === "moveis" || id === "extras");
}
// O modo vem do estado que o editor já usa (categoria da Oficina e pincel).
function escritorioModoConstrucao() {
  const c = escritorio.catalogoCategoria, pin = typeof escritorioPincel === "function" ? escritorioPincel() : {};
  if (c === "Sala") return pin.ferramenta === "parede" ? "parede" : "piso";
  if (c === "Planta") return pin.ferramenta === "luz" ? "luz" : "planta";
  if (["Imagens", "Conjuntos", "Modelos"].includes(c)) return "extras";
  return "moveis";
}
function escritorioIrModoConstrucao(modo) {
  const e = escritorio.edicao;
  if (!e || !escritorioModosDisponiveis().some(([id]) => id === modo)) return;
  const pin = escritorioPincel();
  // Trocar de modo larga o que está na mão e a colagem (como Esc).
  e.novo = null; e.colar = null; e.trocar = null; e.gestoPiso = null;
  e.ferramenta = "selecionar"; escritorio.espacoEditor = false;
  escritorio.mapa?.previa(null); escritorio.mapa?.pincel?.(null);
  const minha = escritorioConstruindoMeuQuarto();
  escritorio.aba = "catalogo";
  if (escritorio.lateral === false && !window.matchMedia?.("(max-width: 760px)").matches) escritorio.lateral = true;
  escritorio.catalogoPagina = 0;
  if (modo === "moveis") { escritorio.abaQuarto = "meus"; escritorio.catalogoCategoria = ""; }
  else if (modo === "extras") { escritorio.abaQuarto = "decorar"; escritorio.catalogoCategoria = "Imagens"; }
  else if (modo === "piso" || modo === "parede") {
    escritorio.abaQuarto = "decorar"; escritorio.catalogoCategoria = "Sala";
    pin.ferramenta = modo === "parede" ? "parede" : (pin.ferramenta === "balde" ? "balde" : "piso");
  } else {
    escritorio.abaQuarto = "decorar"; escritorio.catalogoCategoria = "Planta";
    pin.ferramenta = modo;
  }
  if (!minha && modo !== "moveis") escritorio.catalogoCategoria = modo === "extras" ? "Imagens" : "";
  renderEscritorio();
}
// "Ver piso": os móveis ficam quase transparentes e não pegam o clique, para
// ver e pintar o chão por baixo (os rentes ao piso, como tapetes e peças de
// piso, continuam). Só na prévia de quem edita.
function escritorioVerPiso(ligar = !escritorio.edicao?.verPiso) {
  const e = escritorio.edicao;
  if (!e) return;
  e.verPiso = Boolean(ligar);
  document.querySelector("#painel-escritorio .ofc")?.toggleAttribute("data-editor-ver-piso", e.verPiso);
  renderBarraEditorEscritorio();
}
// Barra de baixo: modos, visão e desfazer. A ferramenta ativa fica acesa; o
// número é o atalho.
function escritorioHotbarHtml(e) {
  const modo = escritorioModoConstrucao(), modos = escritorioModosDisponiveis();
  const botaoModo = ([id, nome, ico, dica], i) => `<button type="button" class="ofc-hot-modo" data-modo="${id}" aria-pressed="${modo === id}" onclick="escritorioIrModoConstrucao('${id}')" title="${safeText(dica)} (${ESCRITORIO_MODOS_CONSTRUCAO.findIndex(([m]) => m === id) + 1})">${escritorioIconeConstrucao(ico)}<span>${nome}</span><kbd>${ESCRITORIO_MODOS_CONSTRUCAO.findIndex(([m]) => m === id) + 1}</kbd></button>`;
  const alterna = (ico, nome, ativo, acao, dica, tecla = "") => `<button type="button" class="ofc-hot-ferr" aria-pressed="${Boolean(ativo)}" onclick="${acao}" title="${safeText(dica)}${tecla ? ` (${tecla})` : ""}">${escritorioIconeConstrucao(ico)}<span>${nome}</span></button>`;
  return `<div class="ofc-hotbar" role="toolbar" aria-label="Modo de construção">
<div class="ofc-hot-grupo ofc-hot-modos" role="group" aria-label="O que construir">${modos.map(botaoModo).join("")}</div>
<div class="ofc-hot-grupo" role="group" aria-label="Visão">${alterna("mao", "Mover visão", e.ferramenta === "camera", `ferramentaEditorEscritorio('${e.ferramenta === "camera" ? "selecionar" : "camera"}')`, "Arraste para mover a visão sem mexer em nada; segure Espaço para usar rapidinho", "Espaço")}${alterna("olho", "Ver piso", e.verPiso, "escritorioVerPiso()", "Deixa os móveis transparentes para ver e pintar o chão", "V")}${alterna("grade", "Grade", e.grade !== false, "gradeEditorEscritorio(true)", "Mostra os ladrilhos", "G")}${alterna("pilha", "Empilhar", escritorio.construtor?.ligado, "alternarConstrutorEscritorio()", "Põe móvel em cima de qualquer coisa, como o ladrilho de empilhar do Habbo", "B")}</div>
<div class="ofc-hot-grupo" role="group" aria-label="Área de transferência"><button type="button" class="ofc-hot-ferr" onclick="colarEscritorio()" title="Colar na altura copiada (Ctrl+V)">${escritorioIconeConstrucao("copiar")}<span>Colar</span></button></div>
<div class="ofc-hot-grupo" role="group" aria-label="Histórico">${`<button type="button" class="ofc-hot-ferr" onclick="desfazerEditorEscritorio()" ${e.passos?.length > 1 ? "" : "disabled"} title="Desfazer (⌘Z)">${escritorioIcone("desfazer")}<span>Desfazer</span></button><button type="button" class="ofc-hot-ferr" onclick="refazerEditorEscritorio()" ${e.futuro?.length ? "" : "disabled"} title="Refazer (⌘⇧Z)">${escritorioIcone("refazer")}<span>Refazer</span></button>`}</div>
</div>`;
}
// Ferramentas do modo, logo acima da barra (como a mão do jogo: o que o
// clique faz agora). Sem nada a escolher, não aparece.
function escritorioSubbarHtml() {
  if (!escritorioConstruindoMeuQuarto()) return "";
  const modo = escritorioModoConstrucao(), pin = escritorioPincel();
  const opc = (ativo, acao, ico, nome, dica) => `<button type="button" aria-pressed="${Boolean(ativo)}" onclick="${acao}" title="${safeText(dica)}">${ico ? escritorioIconeConstrucao(ico) : ""}<span>${nome}</span></button>`;
  const material = modo === "piso" ? escritorioNomeMaterialPiso() : modo === "parede" ? escritorioNomeMaterialParede() : "";
  const chip = material ? `<span class="ofc-sub-material" title="Material na mão">${material}</span>` : "";
  if (modo === "piso") {
    const area = pin.ferramenta === "balde" ? "balde" : pin.area || "pincel";
    const ir = (id) => id === "balde" ? "escritorioPincel().ferramenta='balde';renderEscritorio()" : `escritorioPincel().ferramenta='piso';escritorioPincel().area='${id}';renderEscritorio()`;
    return `<div class="ofc-subbar" role="toolbar" aria-label="Ferramentas do piso">${chip}${opc(area === "pincel", ir("pincel"), "pincel", "Pincel", "Clique ou arraste para pintar ladrilho por ladrilho")}${opc(area === "retangulo", ir("retangulo"), "retangulo", "Retângulo", "Arraste de um canto ao outro")}${opc(area === "linha", ir("linha"), "linha", "Linha", "Arraste em linha reta")}${opc(area === "regiao", ir("regiao"), "balde", "Balde", "Pinta a região inteira da mesma altura")}${opc(area === "borracha", ir("borracha"), "borracha", "Borracha", "Tira a pintura e as peças de piso")}<i></i><button type="button" onclick="escritorioPisoNoQuartoTodo()" title="Aplica o material escolhido no quarto inteiro">${escritorioIconeConstrucao("tudo")}<span>Quarto todo</span></button></div>`;
  }
  if (modo === "parede") return `<div class="ofc-subbar" role="toolbar" aria-label="Ferramentas da parede">${chip}${[["0", "Baixa"], ["1", "Média"], ["2", "Alta"]].map(([h, n]) => opc(pin.altura === h && (!pin.textura || pin.alturaFixa), `escritorioPincel().altura='${h}';escritorioPincel().alturaFixa=true;renderEscritorio()`, "", n, pin.textura && !pin.alturaFixa ? `O revestimento mantém a altura de cada parede; clique para deixar ${n.toLowerCase()}` : `Parede ${n.toLowerCase()} no trecho que você clicar`)).join("")}<i></i><button type="button" onclick="pintarTodasParedesEscritorio()" title="Aplica estilo, cor e altura em todas as paredes">${escritorioIconeConstrucao("tudo")}<span>Todas as paredes</span></button><button type="button" onclick="limparPinturaEscritorio('sala_paredes')" title="Volta as paredes ao padrão da sala">${escritorioIconeConstrucao("borracha")}<span>Como eram</span></button></div>`;
  if (modo === "planta") return `<div class="ofc-subbar" role="toolbar" aria-label="Ferramentas da planta">${ESCRITORIO_FORMAS_PLANTA.map(([id, nome, dica]) => opc((pin.forma || "p") === id, `escritorioPincel().forma='${id}';renderEscritorio()`, "", nome, dica)).join("")}${(pin.forma || "p") === "n" ? `<label class="ofc-sub-numero">Altura<input type="number" min="1" max="35" step="1" value="${Number(pin.nivel) || 1}" onchange="escritorioPincel().nivel=Math.max(1,Math.min(35,Math.round(Number(this.value)||1)));renderBarraEditorEscritorio()"></label>` : ""}</div>`;
  return "";
}
function escritorioNomeMaterialPiso() {
  const pin = escritorioPincel();
  if (pin.area === "borracha" && pin.ferramenta !== "balde") return "Borracha";
  if (pin.movel) return safeText(escritorioNomeDaClasse(pin.movel));
  return safeText(ESCRITORIO_PISOS_SALA.find(([id]) => id === pin.piso)?.[1] || "Padrão da sala");
}
function escritorioNomeMaterialParede() {
  const pin = escritorioPincel();
  if (pin.textura) return safeText(escritorioNomeDaClasse(pin.textura));
  return safeText(ESCRITORIO_ESTILOS_PAREDE.find(([id]) => id === pin.estilo)?.[1] || "Parede");
}
// Peças de construção (pisos do acervo, revestimentos, acabamentos e blocos):
// a lista vem do servidor com os essenciais (quartos.construcao).
function escritorioClassesDeConstrucao() {
  const lista = escritorio.base?.quartos?.construcao || [];
  if (escritorio.construcaoCache?.lista !== lista) escritorio.construcaoCache = { lista, set: new Set(lista) };
  return escritorio.construcaoCache.set;
}
// Peças técnicas (invisíveis, ladrilhos de empilhar, gatilhos, ferramentas):
// só no filtro Avançado, para não abrirem a lista de móveis.
function escritorioMovelTecnico(m) {
  return /^(vybe_(bloco|assento)_invisivel|tile_stackmagic|vote_count|wf_)/.test(m.classe) || ["Gatilhos", "Ferramentas", "Física"].includes(m.categoria);
}
function escritorioMovelEhBloco(m) { return m.categoria === "Blocos e materiais"; }
// Ladrilho isométrico desenhado (topo xadrez com luz e duas laterais com
// espessura), para as cores parecerem piso de jogo e não um losango chapado.
function escritorioLadrilhoSvg(c0, c1, grande = false) {
  const m = (h, f) => { const n = parseInt(String(h).replace("#", "").slice(0, 6), 16); if (Number.isNaN(n)) return h; const r = Math.min(255, Math.round(((n >> 16) & 255) * f)), g = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f)); return `rgb(${r},${g},${b})`; };
  const a = m(c0, 1.15), b = m(c1, 1.15);
  return `<svg class="ofc-ladrilho${grande ? " grande" : ""}" viewBox="0 0 64 42" aria-hidden="true"><path d="M2 17L32 32V38L2 23Z" fill="${m(c0, 0.62)}"/><path d="M62 17L32 32V38L62 23Z" fill="${m(c1, 0.48)}"/><path d="M32 2L47 9.5L32 17L17 9.5Z" fill="${a}"/><path d="M47 9.5L62 17L47 24.5L32 17Z" fill="${b}"/><path d="M17 9.5L32 17L17 24.5L2 17Z" fill="${b}"/><path d="M32 17L47 24.5L32 32L17 24.5Z" fill="${a}"/><path d="M32 2L62 17L32 32L2 17Z" fill="none" stroke="#ffffff40" stroke-width=".8"/><path d="M2 17L32 2L62 17" fill="none" stroke="#ffffff70" stroke-width="1"/></svg>`;
}
// Famílias das peças de piso, pelo nome (o catálogo do Habbo não separa).
const ESCRITORIO_FAMILIAS_PISO = [
  ["madeira", "Madeira", /wood|plank|parquet|deck|timber|madeira|\blog\b|bamboo/i],
  ["pedra", "Pedra e concreto", /stone|rock|marble|cobble|brick|concrete|slate|pedra|m[aá]rmore|tijolo|pav|road|asphalt|granite/i],
  ["natureza", "Natureza", /grass|sand|water|snow|dirt|flower|leaf|moss|lava|\bice\b|beach|soil|mud|garden|jungle|grama|areia|[aá]gua|neve|pool/i],
  ["azulejo", "Azulejo e mosaico", /tile|mosaic|checker|chess|azulejo|ladrilho|square/i],
  ["tapete", "Tapetes", /\brug|carpet|\bmat\b|tapete|carpete/i],
];
function escritorioFamiliaPiso(m) {
  const t = `${m.classe} ${m.nome} ${escritorioNomeMovel(m)}`;
  return ESCRITORIO_FAMILIAS_PISO.find(([, , re]) => re.test(t))?.[0] || "especial";
}
// Materiais do piso como catálogo de jogo: o material na mão em destaque, as
// cores e as peças por família, cada família com "ver todos".
function escritorioMateriaisPisoHtml() {
  const pin = escritorioPincel(), mesa = escritorioMinhaMesa();
  if (!mesa) return '<p class="ofc-nota">Você ainda não tem sala no escritório.</p>';
  if (!escritorioCatalogo) { carregarCatalogoEscritorio?.(); return '<p class="ofc-nota">Carregando materiais…</p>'; }
  const a = mesa.ambiente, filtro = pin.filtroPiso || "tudo", busca = String(pin.buscaPiso || "");
  const cor = (id) => ESCRITORIO_PLANTA.PISO[id || a.pisoPadrao] || ["#555555", "#444444"];
  const balde = pin.ferramenta === "balde";
  const corAtiva = (id) => balde ? (escritorioPerfilDecoracao()?.sala_piso || "") === id && !pin.movel : !pin.movel && pin.piso === id && pin.area !== "borracha";
  const escolherCor = (id) => balde ? `escritorioPincel().movel='';estiloSalaEscritorio('sala_piso','${id}',true)` : `escritorioPincel().movel='';escritorioPincel().piso='${id}';if(escritorioPincel().area==='borracha')escritorioPincel().area='pincel';renderEscritorio()`;
  const todas = escritorioCatalogo.filter((m) => m.categoria === "Pisos do acervo");
  const img = (classe) => `<img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(classe)}.png?size=64" alt="" onerror="miniaturaLocalEscritorio(this,'${safeText(classe)}')">`;
  const dim = (classe) => (typeof ESCRITORIO_DIM_PISOS !== "undefined" ? ESCRITORIO_DIM_PISOS.get(classe) : null);
  const peca = (m) => { const d = dim(m.classe); return `<button type="button" class="ofc-material" aria-pressed="${pin.movel === m.classe && pin.area !== "borracha"}" onclick="escritorioEscolherMaterialPiso('${safeText(m.classe)}')" title="${safeText(escritorioNomeMovel(m))}">${img(m.classe)}<span>${safeText(escritorioNomeMovel(m))}</span>${d?.x > 1 || d?.y > 1 ? `<em>${d.x}×${d.y}</em>` : ""}</button>`; };
  const corHtml = ([id, nome]) => `<button type="button" class="ofc-material ofc-material-cor" aria-pressed="${corAtiva(id)}" onclick="${escolherCor(id)}" title="${safeText(nome)}">${escritorioLadrilhoSvg(...cor(id))}<span>${safeText(nome)}</span></button>`;
  // Destaque: o que está na mão agora e o que o clique faz.
  const naMao = pin.area === "borracha" && !balde ? { nome: "Borracha", arte: escritorioIconeConstrucao("borracha"), info: "Tira a pintura e as peças" }
    : pin.movel ? (() => { const m = todas.find((x) => x.classe === pin.movel) || { classe: pin.movel, nome: pin.movel }; const d = dim(pin.movel); return { nome: escritorioNomeMovel(m), arte: img(pin.movel), info: `Peça ${d?.x || 1}×${d?.y || 1}` }; })()
    : { nome: ESCRITORIO_PISOS_SALA.find(([id]) => id === pin.piso)?.[1] || "Padrão da sala", arte: escritorioLadrilhoSvg(...cor(pin.piso), true), info: "Cor · 1 ladrilho" };
  const ferramenta = balde ? "Clique no chão: muda o quarto todo" : { pincel: "Pincel: clique ou arraste no chão", retangulo: "Retângulo: arraste de canto a canto", linha: "Linha: arraste em linha reta", regiao: "Balde: pinta a região inteira", borracha: "Borracha: arraste para apagar" }[pin.area || "pincel"];
  const destaque = `<div class="ofc-mat-destaque"><div class="ofc-mat-arte">${naMao.arte}</div><div class="ofc-mat-texto"><small>Na mão</small><b>${safeText(naMao.nome)}</b><span>${safeText(naMao.info)} · <i>grátis</i></span><span class="ofc-mat-ferr">${safeText(ferramenta)}</span></div></div>`;
  const chip = (id, nome, n) => `<button type="button" aria-pressed="${filtro === id}" onclick="escritorioPincel().filtroPiso='${id}';escritorioPincel().limitePisos=48;renderEscritorio()">${nome}${n != null ? ` <small>${n}</small>` : ""}</button>`;
  const porFamilia = Object.fromEntries([...ESCRITORIO_FAMILIAS_PISO.map(([id]) => [id, []]), ["especial", []]]);
  for (const m of todas) porFamilia[escritorioFamiliaPiso(m)].push(m);
  const nomes = Object.fromEntries([...ESCRITORIO_FAMILIAS_PISO.map(([id, n]) => [id, n]), ["especial", "Especiais"]]);
  let corpo;
  if (busca) {
    const achados = todas.filter((m) => escritorioBuscaCombina(escritorioNomeMovel(m) + " " + m.nome, busca));
    const coresAchadas = ESCRITORIO_PISOS_SALA.filter(([, n]) => escritorioBuscaCombina(n, busca));
    corpo = coresAchadas.length || achados.length ? `<div class="ofc-materiais-grade">${coresAchadas.map(corHtml).join("")}${achados.slice(0, 96).map(peca).join("")}</div>` : '<p class="ofc-nota">Nenhum piso com esse nome.</p>';
  } else if (filtro === "tudo") {
    corpo = `<section class="ofc-mat-grupo"><h4>Cores <small>${ESCRITORIO_PISOS_SALA.length}</small></h4><div class="ofc-materiais-grade">${ESCRITORIO_PISOS_SALA.map(corHtml).join("")}</div></section>`
      + Object.entries(porFamilia).filter(([, l]) => l.length).map(([id, l]) => `<section class="ofc-mat-grupo"><h4>${nomes[id]} <small>${l.length}</small>${l.length > 8 ? `<button type="button" onclick="escritorioPincel().filtroPiso='${id}';renderEscritorio()">ver todos</button>` : ""}</h4><div class="ofc-materiais-grade">${l.slice(0, 8).map(peca).join("")}</div></section>`).join("");
  } else if (filtro === "cores") corpo = `<div class="ofc-materiais-grade">${ESCRITORIO_PISOS_SALA.map(corHtml).join("")}</div>`;
  else {
    const l = porFamilia[filtro] || todas, limite = pin.limitePisos || 48;
    corpo = `<div class="ofc-materiais-grade">${l.slice(0, limite).map(peca).join("")}</div>${l.length > limite ? `<button type="button" class="ofc-mais-materiais" onclick="escritorioPincel().limitePisos=${limite + 48};renderEscritorio()">Mostrar mais ${Math.min(48, l.length - limite)}</button>` : ""}`;
  }
  const chips = chip("tudo", "Tudo") + chip("cores", "Cores") + [...ESCRITORIO_FAMILIAS_PISO.map(([id, n]) => [id, n.split(" ")[0]]), ["especial", "Especiais"]].filter(([id]) => porFamilia[id].length).map(([id, n]) => chip(id, n, porFamilia[id].length)).join("");
  return `<div class="ofc-materiais" data-modo="piso">${destaque}<div class="ofc-materiais-topo"><input id="office-piso-busca" type="search" placeholder="Buscar piso: madeira, mármore, grama…" aria-label="Buscar piso" value="${safeText(busca)}" oninput="escritorioPincel().buscaPiso=this.value;escritorioRedesenharMateriais()" autocomplete="off"><div class="ofc-cats" role="group" aria-label="Que tipo de piso">${chips}</div></div>
<div id="office-materiais-grade">${corpo}</div>
<p class="ofc-erro" id="office-estilo-erro" role="alert"></p></div>`;
}
// A busca redesenha só a grade (o campo não perde o foco).
function escritorioRedesenharMateriais() {
  const grade = document.getElementById("office-materiais-grade");
  if (!grade) return;
  const html = escritorioModoConstrucao() === "parede" ? escritorioMateriaisParedeHtml() : escritorioMateriaisPisoHtml();
  const t = document.createElement("template");
  t.innerHTML = html;
  const nova = t.content.getElementById("office-materiais-grade");
  if (nova) grade.replaceWith(nova);
  const mais = document.querySelector(".ofc-mais-materiais"), novoMais = t.content.querySelector(".ofc-mais-materiais");
  if (mais && !novoMais) mais.remove(); else if (mais && novoMais) mais.replaceWith(novoMais); else if (!mais && novoMais) document.getElementById("office-materiais-grade")?.after(novoMais);
}
function escritorioEscolherMaterialPiso(classe) {
  const pin = escritorioPincel();
  if (pin.ferramenta === "balde") pin.ferramenta = "piso";
  if (pin.area === "borracha") pin.area = "pincel";
  pin.movel = classe;
  escritorioDimPiso(classe);
  renderEscritorio();
}
// Quarto todo: a cor vira o piso da sala (e sai a pintura à mão); a peça cobre
// todos os ladrilhos, num passo só de desfazer.
async function escritorioPisoNoQuartoTodo() {
  const pin = escritorioPincel(), a = escritorioMinhaMesa()?.ambiente;
  if (!a || !escritorio.edicao) return;
  if (!pin.movel) {
    // A cor no quarto todo também tira as peças de piso (o chão inteiro muda).
    const pisos = new Set(escritorioCatalogo.filter((m) => m.categoria === "Pisos do acervo").map((m) => m.classe));
    escritorio.edicao.itens = escritorio.edicao.itens.filter((it) => !pisos.has(it[0]));
    if (pin.area === "borracha") return limparPinturaEscritorio("sala_pisos");
    return estiloSalaEscritorio("sala_piso", pin.piso || "", true);
  }
  // A peça cobre o quarto inteiro (Paulo, 26/10/2026: uma 3×3 num quarto 8×8
  // deixava as bordas sem piso). Na grade da peça e, quando o tamanho não
  // divide o quarto, a última fileira encosta na parede por cima da anterior
  // (a mesma textura, sem emenda à vista).
  const e = escritorio.edicao, d = escritorioDimPiso(pin.movel);
  if (!d.pronto) await d.carga;
  if (escritorio.edicao !== e) return;
  if (d.erro || !d.x || !d.y) return escritorioAviso("Não foi possível medir esta peça de piso. Escolha outra.");
  const { w, h } = escritorioDimQuarto(a);
  const posicoes = (n, t) => { const r = []; for (let k = 0; k + t <= n; k += t) r.push(k); if (n >= t && r.at(-1) + t < n) r.push(n - t); return r; };
  const novos = [];
  for (const y of posicoes(h, d.y)) for (const x of posicoes(w, d.x)) if (escritorioPisoCabe(a, x, y, d)) novos.push([pin.movel, x, y, 0, 0, 0]);
  if (!novos.length) return escritorioAviso("Esta peça não cabe no quarto.");
  const pisos = new Set(escritorioCatalogo.filter((m) => m.categoria === "Pisos do acervo").map((m) => m.classe));
  e.itens = [...e.itens.filter((it) => !pisos.has(it[0])), ...novos];
  escritorioEditorMudou();
  escritorioAviso(`Quarto todo com ${escritorioNomeDaClasse(pin.movel)}. Salve para confirmar.`);
}
// Materiais da parede: estilo, cor e os revestimentos do acervo (grátis).
function escritorioMateriaisParedeHtml() {
  const pin = escritorioPincel(), mesa = escritorioMinhaMesa();
  if (!mesa) return '<p class="ofc-nota">Você ainda não tem sala no escritório.</p>';
  const a = mesa.ambiente, busca = String(pin.buscaParede || "");
  const amostra = (e) => ({ a: `linear-gradient(${a.corPadrao} 0 12%,#2b2d36 12%)`, b: pin.cor || a.corPadrao, c: "repeating-linear-gradient(#8a4733 0 7px,#3b1f17 7px 8px)", d: "repeating-linear-gradient(90deg,#7a5235 0 9px,#4a2f1c 9px 10px)", e: "#6e7077", f: "linear-gradient(135deg,#cfeaff,#7fb6e0)", g: `repeating-linear-gradient(90deg,${pin.cor || a.corPadrao} 0 6px,#00000040 6px 12px)`, h: "repeating-linear-gradient(#e9edf2 0 9px,#b8c0ca 9px 10px),#e9edf2" }[e]);
  const construcao = escritorioClassesDeConstrucao();
  const revest = (escritorioCatalogo || []).filter((m) => construcao.has(m.classe) && m.categoria === "Na parede" && escritorioBuscaCombina(escritorioNomeMovel(m) + " " + m.nome, busca));
  const estilos = busca ? "" : ESCRITORIO_ESTILOS_PAREDE.map(([id, nome]) => `<button type="button" class="ofc-material" aria-pressed="${!pin.textura && pin.estilo === id}" onclick="escritorioPincel().estilo='${id}';escritorioPincel().textura='';renderEscritorio()" title="${safeText(nome)}"><i class="ofc-material-amostra parede" style="background:${amostra(id)}">${typeof MAPA_ESTILO_TEXTURA !== "undefined" && MAPA_ESTILO_TEXTURA[id] ? `<img class="ofc-arte" alt="" data-arte="${MAPA_ESTILO_TEXTURA[id]}">` : ""}</i><span>${nome}</span></button>`).join("");
  const cores = ESCRITORIO_PAREDES_SALA.map((c) => `<button type="button" class="ofc-cor" aria-pressed="${pin.cor === c}" onclick="escritorioPincel().cor='${c}';renderEscritorio()" aria-label="${c ? "Cor " + c : "Cor da sala"}" title="${c ? "" : "Cor da sala"}"><i style="background:${c || a.corPadrao}"></i></button>`).join("");
  const limite = pin.limiteParedes || 36;
  const cartoes = revest.slice(0, limite).map((m) => `<button type="button" class="ofc-material" aria-pressed="${pin.textura === m.classe}" onclick="escritorioEscolherRevestimento('${safeText(m.classe)}')" title="${safeText(escritorioNomeMovel(m))} · clique e depois na parede: cobre o trecho inteiro"><img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(m.classe)}.png?size=64" alt="" onerror="miniaturaLocalEscritorio(this,'${safeText(m.classe)}')"><span>${safeText(escritorioNomeMovel(m))}</span></button>`).join("");
  return `<div class="ofc-materiais" data-modo="parede">
${busca ? "" : `<h4>Estilo</h4><div class="ofc-materiais-grade estilos">${estilos}</div><h4>Cor <small>(Padrão, Lisa e Listrada)</small></h4><div class="ofc-cores">${cores}</div>`}
<h4>Revestimentos <small>· grátis, cobrem o trecho inteiro da parede</small></h4><div class="ofc-materiais-topo"><input id="office-parede-busca" type="search" placeholder="Buscar revestimento: madeira, pedra, cidade…" aria-label="Buscar revestimento de parede" value="${safeText(busca)}" oninput="escritorioPincel().buscaParede=this.value;escritorioPincel().limiteParedes=36;escritorioRedesenharMateriais()" autocomplete="off"></div>
<div class="ofc-materiais-grade" id="office-materiais-grade">${cartoes || '<p class="ofc-nota">Nenhum revestimento com esse nome.</p>'}</div>${revest.length > limite ? `<button type="button" class="ofc-mais-materiais" onclick="escritorioPincel().limiteParedes=${limite + 36};renderEscritorio()">Mostrar mais</button>` : ""}
<p class="ofc-erro" id="office-estilo-erro" role="alert"></p></div>`;
}
// "+ Outro igual" na barra do selecionado: pega outro guardado (ou grátis) e
// deixa na mão; sem guardado, diz o preço antes (a compra pede confirmação).
function escritorioOutroIgualHtml(classe) {
  const info = escritorioInfoLoja(classe), onde = escritorioOndeEstaMovel(classe), livre = escritorioCamadaComum(escritorio.edicao.camada) || onde.guardados > 0;
  const pode = livre || (!info.marco && info.naVitrine && info.restante !== 0);
  return `<button type="button" onclick="escritorioColocarOutro()" ${pode ? "" : "disabled"} title="Coloca mais um igual no quarto (Ctrl+D duplica no lugar)">${livre ? "+ Outro igual" : `+ Comprar outro · ${info.preco.toLocaleString("pt-BR")}`}</button>`;
}
// Revestimento na mão: o próximo clique na parede cobre o trecho inteiro com a
// arte dele (sala_paredes_texturas), como os estilos Tijolo e Madeira.
function escritorioEscolherRevestimento(classe) {
  const pin = escritorioPincel();
  pin.textura = pin.textura === classe ? "" : classe;
  pin.alturaFixa = false;
  if (pin.ferramenta !== "parede") pin.ferramenta = "parede";
  renderEscritorio();
}
// Cabeçalho do modo na Oficina: o nome e uma frase do que o clique faz.
function escritorioCabecalhoModoHtml() {
  const modo = escritorioModoConstrucao(), m = ESCRITORIO_MODOS_CONSTRUCAO.find(([id]) => id === modo);
  // Uma linha só (Paulo, 26/10/2026: a lateral gastava metade da altura antes
  // dos móveis): o nome do modo e a dica curta.
  const frase = {
    moveis: "Clique e solte no quarto, ou arraste",
    piso: "Escolha e pinte o chão",
    parede: "Escolha e clique na parede",
    planta: "Clique nos ladrilhos",
    luz: "Tinge o quarto inteiro",
    extras: "Imagens e conjuntos",
  }[modo];
  return `<div class="ofc-modo-cabeca">${escritorioIconeConstrucao(m[2])}<b>${m[1]}</b><small>${frase}</small></div>`;
}
// Topo da Oficina na construção: renderBarraEditorEscritorio põe aqui o selo
// (sala e estado do salvamento) no lugar de "Vybe · Você está fora".
function escritorioTopoConstrucaoHtml() {
  return '<div id="office-cons-topo" class="ofc-cons-topo"></div>';
}

// Tutorial da construção (Paulo, 26/10/2026): abre sozinho na primeira vez de
// cada pessoa e pode ser revisto no menu ⋯. Usa o cartão do tutorial do
// Escritório, destacando o controle de verdade em cada passo.
const ESCRITORIO_TUTORIAL_CONSTRUCAO_VISTO = "vybe-construcao-tutorial-v1";
const TUTORIAL_CONSTRUCAO = [
  { titulo: "Bem-vindo ao modo construção", texto: "Tudo o que você fizer aqui é uma prévia só sua. Ninguém vê nada até você clicar em Salvar." },
  { alvo: ".ofc-hot-modos", antes: () => escritorioIrModoConstrucao("moveis"), titulo: "Escolha o que construir", texto: "Móveis, Piso, Parede, Planta, Luz e Extras. Cada modo tem a sua ferramenta. Atalho: as teclas 1 a 6." },
  { alvo: ".ofc-lateral", titulo: "Seus itens ficam aqui", texto: "Clique num item e depois no quarto, ou arraste direto. Passe o mouse para ver o nome. Busca e filtros ficam no topo." },
  { alvo: "#office-map", titulo: "Mexa no que já está no quarto", texto: "Clique num móvel para selecionar e arraste para mudar de lugar. R gira, Delete guarda, Esc larga. A barra que aparece tem trocar, outro igual e ajustes de altura." },
  { alvo: ".ofc-subbar", antes: () => escritorioIrModoConstrucao("piso"), titulo: "Pisos e paredes são grátis", texto: "No Piso, escolha a ferramenta: pincel, retângulo, linha, balde, borracha ou o quarto todo. Na Parede, estilo, cor, altura e revestimentos. Tudo sem limite." },
  { alvo: ".ofc-hotbar [title^='Deixa os móveis']", titulo: "Ver piso", texto: "Deixa os móveis transparentes para enxergar e pintar o chão por baixo (tecla V). Mover visão (ou segurar Espaço) arrasta o quarto sem mexer em nada." },
  { alvo: ".ofc-cons-acoes", antes: () => escritorioIrModoConstrucao("moveis"), titulo: "Desfazer, salvar e sair", texto: "⌘Z desfaz qualquer passo. Salvar (⌘S) mostra quantas mudanças vão junto; Cancelar descarta. No ⋯ estão as versões salvas e este tutorial." },
];
function iniciarTutorialConstrucao() {
  try { localStorage.setItem(ESCRITORIO_TUTORIAL_CONSTRUCAO_VISTO, "1"); } catch {}
  if (typeof iniciarTutorialEscritorio === "function") iniciarTutorialEscritorio(TUTORIAL_CONSTRUCAO);
}
function escritorioTutorialConstrucaoVisto() {
  try { return localStorage.getItem(ESCRITORIO_TUTORIAL_CONSTRUCAO_VISTO) === "1"; } catch { return true; }
}

// Sons curtos de jogo (os do Escritório, que respeitam o som desligado).
const ESCRITORIO_SONS_CONSTRUCAO = { pegar: [[660, 0.06, 0.035]], por: [[392, 0.07, 0.05], [587, 0.09, 0.04]], girar: [[523, 0.05, 0.03], [659, 0.05, 0.03]], guardar: [[440, 0.07, 0.04], [294, 0.09, 0.035]], pintar: [[784, 0.05, 0.025]], modo: [[880, 0.035, 0.02]], salvar: [[523, 0.09, 0.04], [659, 0.09, 0.04], [784, 0.14, 0.04]] };
function escritorioSomConstrucao(tipo) {
  if (typeof escritorioTocar !== "function") return;
  (ESCRITORIO_SONS_CONSTRUCAO[tipo] || []).forEach(([f, d, v], i) => setTimeout(() => escritorioTocar(f, d, v), i * 70));
}
// Liga os sons e o tutorial às ações do editor sem mudar a lógica delas.
(function ligarConstrucaoComoJogo() {
  if (typeof window === "undefined" || typeof document?.addEventListener !== "function") return;
  const embrulhar = (nome, antes, depois) => {
    const f = window[nome];
    if (typeof f !== "function" || f.construcaoJogo) return;
    const g = function (...args) {
      const estado = antes?.(...args);
      const r = f.apply(this, args);
      if (depois) Promise.resolve(r).then((v) => depois(estado, v, ...args)).catch(() => {});
      return r;
    };
    g.construcaoJogo = true;
    window[nome] = g;
  };
  embrulhar("escolherMovelEscritorio", () => escritorioSomConstrucao("pegar"));
  embrulhar("girarSelecionadoEscritorio", () => escritorioSomConstrucao("girar"));
  embrulhar("apagarSelecionadoEscritorio", () => escritorioSomConstrucao("guardar"));
  embrulhar("escritorioIrModoConstrucao", () => escritorioSomConstrucao("modo"));
  // Colocou o móvel da mão: o quarto ganhou uma peça.
  embrulhar("cliqueEditorEscritorio", () => escritorio.edicao?.novo ? escritorio.edicao.itens.length : null, (antes) => { if (antes != null && escritorio.edicao?.itens.length > antes) escritorioSomConstrucao("por"); });
  embrulhar("soltarNoEditorEscritorio", () => escritorio.pintandoArrasto || Boolean(escritorio.edicao?.arrasto), (mexeu) => { if (mexeu) escritorioSomConstrucao("pintar"); });
  embrulhar("salvarEditorEscritorio", () => escritorio.edicao?.mudou, (tinha) => { if (tinha && !escritorio.edicao?.mudou) escritorioSomConstrucao("salvar"); });
  // Primeira vez no modo construção: o tutorial abre sozinho.
  embrulhar("abrirEditorEscritorio", null, () => {
    if (escritorio.edicao && !escritorioTutorialConstrucaoVisto()) setTimeout(() => { if (escritorio.edicao && !document.getElementById("ofc-tutorial")) iniciarTutorialConstrucao(); }, 700);
  });
  // Nome do item sob o mouse, no pé da Oficina (a grade é só de ícones).
  document.addEventListener("mouseover", (ev) => {
    const item = ev.target.closest?.(".ofc-oficina :is(.ofc-movel,.ofc-material,.ofc-cor)");
    const info = document.getElementById("office-oficina-info");
    if (!info) return;
    if (!item) return;
    const nome = item.getAttribute("title")?.split(" · ")[0] || item.getAttribute("aria-label") || "";
    const extra = item.querySelector(".ofc-movel-linha")?.textContent || (item.classList.contains("gratis") ? "Grátis" : "");
    info.innerHTML = `<b>${safeText(nome)}</b>${extra ? `<small>${safeText(extra)}</small>` : ""}`;
    info.hidden = false;
  });
})();
