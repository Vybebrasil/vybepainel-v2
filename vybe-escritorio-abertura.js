// Abertura da Vybelândia: cena animada → criação do personagem → boas-vindas.
// Cada pessoa vê uma vez por versão (perfil.abertura); "Meu espaço" reabre só
// o criador. Animação respeita prefers-reduced-motion e sempre pode ser pulada.
const ESCRITORIO_ABERTURA = "2026-10-16";
// Peças conferidas no imager para cada corpo: algumas só existem para um
// deles e somem no outro sem erro, por isso as listas são separadas.
const CRIADOR_PECAS = {
  M: {
    cabelo: [828, 100, 115, 125, 155, 165, 170, 893, 3163, 515],
    camisa: [255, 210, 215, 235, 3030, 3015],
    calca: [280, 270, 285, 3023],
    sapato: [305, 290, 300, 905],
  },
  F: {
    cabelo: [515, 545, 575, 836, 890, 3163, 155, 893],
    camisa: [665, 685, 690],
    calca: [700, 710, 716, 3023],
    sapato: [725, 905],
  },
};
const CRIADOR_PELES = { 1: "#ffcb98", 10: "#ffdbc1", 2: "#e3ae7d", 8: "#f4ac54", 3: "#c99263", 4: "#ae7748", 19: "#b87560", 5: "#945c2f", 20: "#9c543f" };
const CRIADOR_CABELOS = { 61: "#202020", 1394: "#2d180e", 45: "#423024", 37: "#6f4321", 48: "#a02900", 35: "#b29640", 34: "#b8ac85", 40: "#9c989d" };
const CRIADOR_CORES = {
  1323: "#ff5b08", 94: "#ff9211", 70: "#c74400", 110: "#161616", 64: "#414141", 92: "#bbbbbb", 96: "#ff1300", 107: "#1f55ff",
  82: "#3a5977", 104: "#00b9a8", 102: "#1cdc00", 84: "#6bae61", 99: "#c600ad", 76: "#7e5b90", 93: "#fff41d", 95: "#ff27a6", 90: "#96743d",
};
const criador = { etapa: "cena", direcao: 2, figura: null, salvando: false, so: false };
// Fundo da Vybelândia: o vídeo animado (versão leve em telas pequenas), com a
// imagem parada como capa enquanto carrega. Usado também no login.
function vybelandiaCenaHtml(parada = false) {
  const href = (id, padrao) => document.getElementById(id)?.getAttribute("href") || padrao;
  const capa = href("vybelandia-img", "/assets/vybelandia.webp");
  const video = window.matchMedia?.("(max-width: 900px)").matches ? href("vybelandia-video-leve", "/assets/vybelandia-540.mp4") : href("vybelandia-video", "/assets/vybelandia.mp4");
  const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return `<video class="abr-cena${parada ? " parada" : ""}" src="${safeText(video)}" poster="${safeText(capa)}" ${reduzido ? "" : "autoplay loop"} muted playsinline preload="auto" aria-hidden="true"></video>`;
}

function criadorDaFigura(fig) {
  const f = { g: "M", pele: 1, cabelo: 828, corCabelo: 61, camisa: 255, corCamisa: 1323, calca: 280, corCalca: 110, sapato: 305, corSapato: 110, extras: {} };
  for (const parte of String(fig || "").split(".")) {
    const [t, conj, cor] = parte.split("-");
    const n = Number(conj), c = Number(cor);
    if (t === "hd") { f.g = n === 600 ? "F" : "M"; if (CRIADOR_PELES[c]) f.pele = c; }
    if (t === "hr") { f.cabelo = n; if (CRIADOR_CABELOS[c]) f.corCabelo = c; }
    if (t === "ch") { f.camisa = n; if (CRIADOR_CORES[c]) f.corCamisa = c; }
    if (t === "lg") { f.calca = n; if (CRIADOR_CORES[c]) f.corCalca = c; }
    if (t === "sh") { f.sapato = n; if (CRIADOR_CORES[c]) f.corSapato = c; }
    // Acessórios: tipo, conjunto e as cores como estão na figura.
    if (CRIADOR_ACESSORIOS[t]) f.extras[t] = { id: n, cores: parte.split("-").slice(2).map(Number).filter(Boolean) };
  }
  const p = CRIADOR_PECAS[f.g];
  for (const campo of ["cabelo", "camisa", "calca", "sapato"]) if (!p[campo].includes(f[campo])) f[campo] = p[campo][0];
  return f;
}
function criadorFigura(f) {
  const extras = Object.entries(f.extras || {}).map(([t, e]) => [t, e.id, ...(e.cores || [])].join("-"));
  return [`hd-${f.g === "F" ? 600 : 180}-${f.pele}.hr-${f.cabelo}-${f.corCabelo}.ch-${f.camisa}-${f.corCamisa}.lg-${f.calca}-${f.corCalca}.sh-${f.sapato}-${f.corSapato}`, ...extras].join(".");
}
// Acessórios do catálogo do Habbo: cada aba busca bibliotecas por prefixo; a
// peça escolhida entra na figura com as cores reais da paleta dela.
const CRIADOR_ACESSORIOS = {
  ha: { nome: "Chapéu", prefixo: "hat_" }, he: { nome: "Cabeça", prefixo: "acc_head_" },
  ea: { nome: "Óculos", prefixo: "acc_eye_" }, fa: { nome: "Rosto", prefixo: "acc_face_" },
  ca: { nome: "Pescoço", prefixo: "acc_chest_" }, cc: { nome: "Casaco", prefixo: "jacket_" },
  wa: { nome: "Cintura", prefixo: "acc_waist_" }, cp: { nome: "Estampa", prefixo: "acc_print_" },
};
const criadorCatalogo = { tipo: "ha", resultados: [], busca: "", paletas: {} };
async function criadorBuscarAcessorio(tipo, termo = "") {
  criadorCatalogo.tipo = tipo;
  criadorCatalogo.busca = termo;
  criadorCatalogo.resultados = null;
  renderAberturaEscritorio();
  try {
    const q = CRIADOR_ACESSORIOS[tipo].prefixo + termo.trim().replace(/\s+/g, "_");
    const r = await fetch("https://www.habboassets.com/imaging/search?" + new URLSearchParams({ type: "clothing", q }));
    const d = await r.json();
    if (criadorCatalogo.tipo !== tipo) return;
    // Só o que serve para o corpo escolhido (U = os dois).
    const g = criador.f.g;
    criadorCatalogo.resultados = (d.results || []).map((x) => x.name).filter((n) => new RegExp(`_(U|${g})_`, "i").test(n));
  } catch {
    criadorCatalogo.resultados = [];
  }
  renderAberturaEscritorio();
}
async function criadorUsarAcessorio(biblioteca) {
  try {
    const d = await (await fetch("https://www.habboassets.com/imaging/info/clothing/" + encodeURIComponent(biblioteca))).json();
    const conj = d.revisions?.[0]?.sets?.find((x) => x.wearable !== false && (x.gender === "U" || x.gender === criador.f.g));
    if (!conj || !CRIADOR_ACESSORIOS[conj.type]) throw new Error();
    const paleta = (d.palettes?.[conj.palette] || []).filter((c) => c.selectable !== false);
    criadorCatalogo.paletas[conj.type] = paleta;
    const cores = conj.colors ? (conj.defaultColors?.length ? conj.defaultColors : [paleta[0]?.id]).slice(0, conj.colors) : [];
    criador.f.extras[conj.type] = { id: conj.id, cores, nome: biblioteca };
  } catch {
    const erro = document.getElementById("abr-erro");
    if (erro) erro.textContent = "Essa peça não carregou. Escolha outra.";
  }
  renderAberturaEscritorio();
}
function criadorCorAcessorio(tipo, cor) {
  const e = criador.f.extras[tipo];
  if (!e?.cores?.length) return;
  e.cores[0] = cor;
  renderAberturaEscritorio();
}
function criadorTirarAcessorio(tipo) {
  delete criador.f.extras[tipo];
  renderAberturaEscritorio();
}
function criadorAcessoriosHtml() {
  const t = criadorCatalogo.tipo, cat = CRIADOR_ACESSORIOS[t], usado = criador.f.extras[t];
  const nomeDe = (n) => n.replace(/^(hat|acc_[a-z]+|jacket)_[UMF]_/i, "").replace(/_/g, " ");
  const paleta = criadorCatalogo.paletas[t] || [];
  return `<div class="abr-grupo"><h3>Acessórios</h3>
  <div class="abr-linha">${Object.entries(CRIADOR_ACESSORIOS).map(([id, a]) => `<button type="button" class="abr-estilo" aria-pressed="${id === t}" onclick="criadorBuscarAcessorio('${id}')">${a.nome}${criador.f.extras[id] ? " ●" : ""}</button>`).join("")}</div>
  <form class="abr-linha" onsubmit="event.preventDefault();criadorBuscarAcessorio('${t}', this.q.value)"><input class="abr-busca" name="q" value="${safeText(criadorCatalogo.busca)}" placeholder="Buscar ${cat.nome.toLowerCase()} (em inglês)" aria-label="Buscar ${cat.nome}"><button class="abr-estilo">Buscar</button>${usado ? `<button type="button" class="abr-estilo" onclick="criadorTirarAcessorio('${t}')">Tirar ${cat.nome.toLowerCase()}</button>` : ""}</form>
  <div class="abr-linha abr-acessorios">${criadorCatalogo.resultados === null ? "<span class=\"abr-nota\">Buscando…</span>" : (criadorCatalogo.resultados || []).map((n) => `<button type="button" class="abr-estilo" aria-pressed="${usado?.nome === n}" onclick="criadorUsarAcessorio('${safeText(n)}')">${safeText(nomeDe(n))}</button>`).join("") || "<span class=\"abr-nota\">Escolha uma aba ou busque um nome.</span>"}</div>
  ${usado?.cores?.length && paleta.length ? `<div class="abr-linha">${paleta.slice(0, 40).map((c) => `<button type="button" class="abr-cor" style="--c:#${safeText(c.hex)}" aria-pressed="${usado.cores[0] === c.id}" aria-label="Cor ${c.id}" onclick="criadorCorAcessorio('${t}', ${Number(c.id)})"></button>`).join("")}</div>` : ""}
  </div>`;
}
function criadorImagem(fig, dir = 2, tamanho = "l") {
  return "https://www.habboassets.com/imaging/avatar.png?" + new URLSearchParams({ figure: fig, direction: dir, size: tamanho });
}
function escritorioPrecisaAbertura() {
  return Boolean(escritorio.base) && escritorio.perfil?.abertura !== ESCRITORIO_ABERTURA;
}
function abrirAberturaEscritorio(etapa = "cena") {
  const eu = escritorio.base?.equipe.find((p) => p.id === escritorio.base.eu);
  // "Meu espaço" pede só o criador; a abertura completa termina nas boas-vindas.
  criador.so = etapa === "personagem";
  // Quem acabou de passar pela Vybelândia no login vai direto ao personagem.
  criador.etapa = etapa === "cena" && window.VYBELANDIA_VISTA ? "personagem" : etapa;
  criador.f = criadorDaFigura(escritorio.perfil?.figura || mapaFigura(escritorio.perfil || {}));
  criador.nome = String(eu?.nome || "").split(" ")[0] || "equipe";
  let el = document.getElementById("ofc-abertura");
  if (!el) {
    el = document.createElement("div");
    el.id = "ofc-abertura";
    el.className = "ofc-abertura";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Boas-vindas à Vybelândia");
    el.addEventListener("keydown", (e) => { if (e.key === "Escape" && criador.so) fecharAberturaEscritorio(); });
    document.body.append(el);
  }
  renderAberturaEscritorio();
}
function fecharAberturaEscritorio() {
  document.getElementById("ofc-abertura")?.remove();
}
function renderAberturaEscritorio() {
  const el = document.getElementById("ofc-abertura");
  if (!el) return;
  const fundo = document.getElementById("vybelandia-img")?.getAttribute("href") || "/assets/vybelandia.webp";
  el.style.setProperty("--vybelandia", `url("${fundo}")`);
  el.dataset.etapa = criador.etapa;
  if (criador.etapa === "cena") {
    const faiscas = Array.from({ length: 28 }, (_, i) =>
      `<i style="--x:${(i * 37) % 100}%;--d:${4 + (i % 5)}s;--a:${(i * 0.31) % 4}s;--s:${2 + (i % 3)}px"></i>`).join("");
    el.innerHTML = `${vybelandiaCenaHtml()}<div class="abr-luz" aria-hidden="true"></div><div class="abr-faiscas" aria-hidden="true">${faiscas}</div><div class="abr-vinheta" aria-hidden="true"></div>
<button type="button" class="abr-pular" onclick="criador.etapa='personagem';renderAberturaEscritorio()">Pular</button>
<div class="abr-texto"><span class="abr-kicker">Vybe OS · agora é uma cidade</span><h1>Bem-vindo à <b>Vybelândia</b></h1><p>${safeText(criador.nome)}, o escritório da Vybe mudou de endereço. Antes de entrar, monte o seu personagem.</p><button type="button" class="abr-primario" onclick="criador.etapa='personagem';renderAberturaEscritorio()">Criar meu personagem</button></div>`;
    el.querySelector(".abr-primario")?.focus({ preventScroll: true });
    return;
  }
  if (criador.etapa === "personagem") {
    if (!criadorCatalogo.carregado) { criadorCatalogo.carregado = true; setTimeout(() => criadorBuscarAcessorio(criadorCatalogo.tipo), 0); }
    const f = criador.f, pecas = CRIADOR_PECAS[f.g];
    const fig = criadorFigura(f);
    const chips = (campo, cores) => Object.entries(cores).map(([id, cor]) =>
      `<button type="button" class="abr-cor" style="--c:${cor}" aria-pressed="${String(f[campo]) === id}" aria-label="Cor ${id}" onclick="criador.f.${campo}=${id};renderAberturaEscritorio()"></button>`).join("");
    const estilos = (campo, lista, rotulo) => lista.map((id, i) =>
      `<button type="button" class="abr-estilo" aria-pressed="${f[campo] === id}" onclick="criador.f.${campo}=${id};renderAberturaEscritorio()">${rotulo} ${i + 1}</button>`).join("");
    el.innerHTML = `${vybelandiaCenaHtml(true)}<div class="abr-vinheta" aria-hidden="true"></div>
<section class="abr-painel" aria-labelledby="abr-titulo">
 <div class="abr-previa"><img src="${criadorImagem(fig, criador.direcao)}" alt="Prévia do seu personagem" width="128" height="220"><div class="abr-girar"><button type="button" onclick="criador.direcao=(criador.direcao+7)%8;renderAberturaEscritorio()" aria-label="Girar para a esquerda">↺</button><button type="button" onclick="criador.direcao=(criador.direcao+1)%8;renderAberturaEscritorio()" aria-label="Girar para a direita">↻</button></div></div>
 <div class="abr-opcoes">
  <span class="abr-kicker">${criador.so ? "Meu espaço" : "Passo 1 de 2"}</span><h2 id="abr-titulo">Seu personagem</h2>
  <div class="abr-grupo"><h3>Corpo</h3><div class="abr-linha">${["M", "F"].map((g) => `<button type="button" class="abr-estilo" aria-pressed="${f.g === g}" onclick="criadorTrocarCorpo('${g}')">${g === "M" ? "Masculino" : "Feminino"}</button>`).join("")}</div></div>
  <div class="abr-grupo"><h3>Pele</h3><div class="abr-linha">${chips("pele", CRIADOR_PELES)}</div></div>
  <div class="abr-grupo"><h3>Cabelo</h3><div class="abr-linha">${estilos("cabelo", pecas.cabelo, "Estilo")}</div><div class="abr-linha">${chips("corCabelo", CRIADOR_CABELOS)}</div></div>
  <div class="abr-grupo"><h3>Camisa</h3><div class="abr-linha">${estilos("camisa", pecas.camisa, "Modelo")}</div><div class="abr-linha">${chips("corCamisa", CRIADOR_CORES)}</div></div>
  <div class="abr-grupo"><h3>Calça</h3><div class="abr-linha">${estilos("calca", pecas.calca, "Modelo")}</div><div class="abr-linha">${chips("corCalca", CRIADOR_CORES)}</div></div>
  <div class="abr-grupo"><h3>Sapato</h3><div class="abr-linha">${estilos("sapato", pecas.sapato, "Modelo")}</div><div class="abr-linha">${chips("corSapato", CRIADOR_CORES)}</div></div>
  ${criadorAcessoriosHtml()}
  <p class="abr-erro" role="alert" id="abr-erro"></p>
  <div class="abr-acoes">${criador.so ? '<button type="button" class="abr-secundario" onclick="fecharAberturaEscritorio()">Cancelar</button><button type="button" class="abr-primario" onclick="salvarPersonagemEscritorio()">Salvar personagem</button>' : `<button type="button" class="abr-secundario" onclick="criador.etapa='cena';renderAberturaEscritorio()">Voltar</button><button type="button" class="abr-primario" onclick="criador.etapa='boas';renderAberturaEscritorio()">Continuar</button>`}</div>
 </div>
</section>`;
    return;
  }
  // Boas-vindas
  const mesa = escritorioMinhaMesa();
  el.innerHTML = `${vybelandiaCenaHtml(true)}<div class="abr-vinheta" aria-hidden="true"></div>
<section class="abr-painel abr-boas" aria-labelledby="abr-titulo">
 <img class="abr-boneco" src="${criadorImagem(criadorFigura(criador.f), 4)}" alt="" width="128" height="220">
 <div><span class="abr-kicker">Passo 2 de 2</span><h2 id="abr-titulo">Bem-vindo à Vybelândia, ${safeText(criador.nome)}!</h2>
 <ul class="abr-dicas">
  <li><b>${mesa ? safeText(mesa.ambiente.nome) : "Sua sala"}</b> ${mesa ? "é sua: você chega sentado na sua mesa." : "ainda não foi definida; você chega pela recepção."}</li>
  <li><b>Clique no piso</b> para andar. Arraste para mover o mapa e use a roda do mouse para o zoom.</li>
  <li><b>O computador da sua mesa</b> abre o painel. "Voltar ao escritório" traz você de volta.</li>
  <li><b>Entre na conversa</b> da sala para falar com quem está nela. Microfone e câmera começam desligados.</li>
 </ul>
 <p class="abr-erro" role="alert" id="abr-erro"></p>
 <div class="abr-acoes"><button type="button" class="abr-secundario" onclick="criador.etapa='personagem';renderAberturaEscritorio()">Ajustar personagem</button><button type="button" class="abr-primario" onclick="salvarPersonagemEscritorio(true)">Entrar no escritório</button></div></div>
</section>`;
  el.querySelector(".abr-primario")?.focus({ preventScroll: true });
}
function criadorTrocarCorpo(g) {
  const f = criador.f;
  f.g = g;
  const p = CRIADOR_PECAS[g];
  if (!p.cabelo.includes(f.cabelo)) f.cabelo = p.cabelo[0];
  if (!p.camisa.includes(f.camisa)) f.camisa = p.camisa[0];
  if (!p.calca.includes(f.calca)) f.calca = p.calca[0];
  if (!p.sapato.includes(f.sapato)) f.sapato = p.sapato[0];
  renderAberturaEscritorio();
}
// Salva o boneco (e que a abertura foi vista). Ao fim da abertura, entra.
async function salvarPersonagemEscritorio(entrar) {
  if (criador.salvando) return;
  criador.salvando = true;
  const botao = document.querySelector("#ofc-abertura .abr-primario");
  if (botao) botao.disabled = true;
  const erro = document.getElementById("abr-erro");
  const perfil = { ...escritorio.perfil, figura: criadorFigura(criador.f), ...(criador.so ? {} : { abertura: ESCRITORIO_ABERTURA }) };
  try {
    let salvo = perfil;
    if (!escritorio.base.demo) salvo = (await escritorioApi("perfil", { perfil })).perfil;
    escritorio.perfil = { ...escritorio.perfil, figura: salvo.figura, abertura: salvo.abertura };
    const eu = escritorio.base.equipe.find((p) => p.id === escritorio.base.eu);
    if (eu) eu.perfil = { ...eu.perfil, figura: salvo.figura, abertura: salvo.abertura };
    fecharAberturaEscritorio();
    renderEscritorio();
    if (entrar && !escritorio.base.demo) {
      if (escritorio.conectado) { desconectarEscritorio(false); }
      await conectarEscritorio();
    } else if (entrar) {
      escritorio.lobbyFechado = true;
      renderEscritorio();
    } else if (escritorio.conectado) {
      // O boneco viaja no token da presença: reconecta para os outros verem.
      desconectarEscritorio(false);
      await conectarEscritorio();
    }
  } catch (e) {
    if (erro) erro.textContent = e.message + " Tente de novo.";
    if (botao) botao.disabled = false;
  } finally {
    criador.salvando = false;
  }
}
