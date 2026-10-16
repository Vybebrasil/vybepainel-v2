// Abertura da Vybelândia: cena animada → criação do personagem → boas-vindas.
// Cada pessoa vê uma vez por versão (perfil.abertura); "Meu espaço" reabre só
// o criador. Animação respeita prefers-reduced-motion e sempre pode ser pulada.
// Mudar esta data faz a abertura (e o tutorial) aparecer de novo para todos.
const ESCRITORIO_ABERTURA = "2026-10-17";
// Fundo da Vybelândia: o vídeo animado (versão leve em telas pequenas), com a
// imagem parada como capa enquanto carrega. Usado também no login.
function vybelandiaCenaHtml(parada = false) {
  const href = (id, padrao) => document.getElementById(id)?.getAttribute("href") || padrao;
  const capa = href("vybelandia-img", "/assets/vybelandia.webp");
  const video = window.matchMedia?.("(max-width: 900px)").matches ? href("vybelandia-video-leve", "/assets/vybelandia-540.mp4") : href("vybelandia-video", "/assets/vybelandia.mp4");
  const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (parada) return `<video class="abr-cena parada" src="${safeText(video)}" poster="${safeText(capa)}" ${reduzido ? "" : "autoplay loop"} muted playsinline preload="auto" aria-hidden="true"></video>`;
  const ligado = vybelandiaSomLigado();
  return `<video class="abr-cena" src="${safeText(video)}" poster="${safeText(capa)}" ${reduzido ? "" : "autoplay loop"} muted playsinline preload="auto" aria-hidden="true" onplaying="vybelandiaAplicarSom()"></video><button type="button" class="abr-som" aria-pressed="${!ligado}" onclick="vybelandiaAlternarSom()">${vybelandiaSomRotulo(ligado)}</button>`;
}
// Trilha da cena: o vídeo tem som, mas o navegador só deixa tocar depois de
// um clique ou tecla. Segue a mesma escolha do "Som ligado" do escritório.
function vybelandiaSomLigado() {
  return typeof escritorioSomLigado !== "function" || escritorioSomLigado();
}
// O botão diz o que faz: "Desligar som" quando está tocando, "Ligar som" quando mudo.
function vybelandiaSomRotulo(ligado) {
  const icone = ligado
    ? '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11"/>'
    : '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>';
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icone}</svg><span>${ligado ? "Desligar som" : "Ligar som"}</span>`;
}
function vybelandiaAplicarSom() {
  const ligado = vybelandiaSomLigado();
  const pode = !navigator.userActivation || navigator.userActivation.hasBeenActive;
  for (const v of document.querySelectorAll("video.abr-cena:not(.parada)")) {
    if (!ligado) { v.muted = true; continue; }
    if (!v.muted || !pode) continue;
    v.muted = false; v.volume = 0.7;
    v.play()?.catch(() => { v.muted = true; v.play()?.catch(() => {}); });
  }
  for (const b of document.querySelectorAll(".abr-som")) {
    b.setAttribute("aria-pressed", String(!ligado));
    b.innerHTML = vybelandiaSomRotulo(ligado);
  }
}
function vybelandiaAlternarSom() {
  try { localStorage.setItem("vybe-escritorio-som", vybelandiaSomLigado() ? "0" : "1"); } catch {}
  vybelandiaAplicarSom();
}
// O primeiro clique ou tecla da página libera o som da cena que está tocando.
if (typeof document.addEventListener === "function") for (const tipo of ["pointerdown", "keydown"]) document.addEventListener(tipo, () => setTimeout(vybelandiaAplicarSom), true);

// Criador de personagem no estilo do Habbo: abas por categoria, grade com
// miniatura de cada peça já no boneco da pessoa, cores reais de cada peça
// (catálogo oficial em assets/escritorio/habbo/figuras.json), "Nenhum" para o
// que é opcional e "Aleatório".
const CRIADOR_ABAS = [
  { t: "hd", nome: "Rosto e pele", cabeca: true },
  { t: "hr", nome: "Cabelo", cabeca: true },
  { t: "ha", nome: "Chapéu", cabeca: true, opcional: true },
  { t: "he", nome: "Na cabeça", cabeca: true, opcional: true },
  { t: "ea", nome: "Óculos", cabeca: true, opcional: true },
  { t: "fa", nome: "Rosto", cabeca: true, opcional: true },
  { t: "ch", nome: "Camisa" },
  { t: "cc", nome: "Casaco", opcional: true },
  { t: "ca", nome: "Pescoço", opcional: true },
  { t: "cp", nome: "Estampa", opcional: true },
  { t: "wa", nome: "Cintura", opcional: true },
  { t: "lg", nome: "Calça" },
  { t: "sh", nome: "Sapato", opcional: true },
];
const CRIADOR_PADRAO = { M: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110", F: "hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110" };
const criador = { etapa: "cena", direcao: 2, aba: "hr", mostrar: 60, salvando: false, so: false, cat: null };
async function criadorCarregarCatalogo() {
  if (criador.cat || criador.carregando) return;
  criador.carregando = true;
  try {
    const r = await fetch(mapaArquivo("figuras.json"), { credentials: "same-origin" });
    if (r.ok) criador.cat = await r.json();
  } catch {}
  criador.carregando = false;
  if (criador.f) {
    // O corpo vem do rosto escolhido (o catálogo diz o gênero de cada rosto).
    const g = criadorConjunto("hd", criador.f.partes.hd?.id)?.[1];
    if (g === "M" || g === "F") criador.f.g = g;
    criadorAjustarCorpo();
  }
  renderAberturaEscritorio();
}
// Gênero de um conjunto pelo catálogo (U serve para os dois).
function criadorConjunto(t, id) {
  return criador.cat?.tipos[t]?.s.find((s) => s[0] === Number(id)) || null;
}
function criadorDaFigura(fig) {
  const partes = {};
  for (const parte of String(fig || "").split(".")) {
    const [t, id, ...cores] = parte.split("-");
    if (/^[a-z]{2}$/.test(t) && /^\d+$/.test(id || "")) partes[t] = { id: Number(id), cores: cores.map(Number).filter(Boolean) };
  }
  const g = partes.hd && [600, 605, 610, 615, 620, 625, 626, 627, 628, 629].includes(partes.hd.id) ? "F" : "M";
  if (!partes.hd) return criadorDaFigura(CRIADOR_PADRAO.M);
  return { g, partes };
}
function criadorFigura(f) {
  // A cabeça primeiro; o resto na ordem das abas.
  return CRIADOR_ABAS.filter((a) => f.partes[a.t]).map((a) => [a.t, f.partes[a.t].id, ...f.partes[a.t].cores].join("-")).join(".");
}
function criadorServe(conj, g) {
  return conj && (conj[1] === "U" || conj[1] === g);
}
// Ao trocar o corpo (ou ao carregar o catálogo), tira o que não serve.
function criadorAjustarCorpo() {
  const f = criador.f;
  if (!criador.cat) return;
  for (const [t, p] of Object.entries(f.partes)) {
    const conj = criadorConjunto(t, p.id);
    if (conj && !criadorServe(conj, f.g)) {
      const aba = CRIADOR_ABAS.find((a) => a.t === t);
      if (aba?.opcional) delete f.partes[t];
      else {
        const primeiro = criador.cat.tipos[t].s.find((s) => criadorServe(s, f.g) && !s[2]);
        if (primeiro) f.partes[t] = { id: primeiro[0], cores: p.cores.slice(0, Math.max(1, primeiro[3])) };
      }
    }
  }
}
function criadorTrocarCorpo(g) {
  if (criador.f.g === g) return;
  criador.f = { ...criadorDaFigura(CRIADOR_PADRAO[g]), partes: { ...criadorDaFigura(CRIADOR_PADRAO[g]).partes, ...Object.fromEntries(Object.entries(criador.f.partes).filter(([t]) => !["hd", "hr", "ch", "lg", "sh"].includes(t))) } };
  criador.f.g = g;
  criadorAjustarCorpo();
  renderAberturaEscritorio();
}
function criadorPaleta(t) {
  const p = criador.cat?.tipos[t]?.p;
  return (p && criador.cat.pal[p]) || [];
}
function criadorEscolher(t, id) {
  const f = criador.f;
  if (id === null) delete f.partes[t];
  else {
    const conj = criadorConjunto(t, id), pal = criadorPaleta(t);
    const n = Math.max(conj ? conj[3] : 1, 0);
    const atuais = f.partes[t]?.cores || [];
    const cores = Array.from({ length: n }, (_, i) => atuais[i] || pal[i === 0 ? 0 : Math.min(pal.length - 1, 8)]?.[0] || 1);
    f.partes[t] = { id: Number(id), cores };
  }
  renderAberturaEscritorio();
}
function criadorCor(t, i, cor) {
  const p = criador.f.partes[t];
  if (!p) return;
  p.cores[i] = Number(cor);
  renderAberturaEscritorio();
}
function criadorAleatorio() {
  if (!criador.cat) return;
  const f = { g: criador.f.g, partes: {} };
  const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];
  for (const a of CRIADOR_ABAS) {
    if (a.opcional && Math.random() < 0.7) continue;
    const conj = sorteia(criador.cat.tipos[a.t].s.filter((s) => criadorServe(s, f.g) && !s[2]));
    if (!conj) continue;
    const pal = criadorPaleta(a.t).filter((c) => !c[2]);
    f.partes[a.t] = { id: conj[0], cores: Array.from({ length: Math.max(conj[3], 0) }, () => sorteia(pal)?.[0] || 1) };
  }
  criador.f = f;
  renderAberturaEscritorio();
}
// Miniatura: o próprio boneco com a peça trocada (cabeça só a cabeça).
function criadorMiniatura(t, id, cabeca) {
  const f = { g: criador.f.g, partes: { ...criador.f.partes } };
  if (id === null) delete f.partes[t];
  else {
    const conj = criadorConjunto(t, id), pal = criadorPaleta(t);
    const atuais = criador.f.partes[t]?.cores || [];
    f.partes[t] = { id, cores: Array.from({ length: Math.max(conj?.[3] ?? 1, 0) }, (_, i) => atuais[i] || pal[0]?.[0] || 1) };
  }
  const q = new URLSearchParams({ figure: criadorFigura(f), direction: 3, head_direction: 3, size: "n", gesture: "sml" });
  if (cabeca) q.set("headonly", "1");
  return "https://www.habbo.com/habbo-imaging/avatarimage?" + q;
}
function criadorImagem(fig, dir = 2, tamanho = "l") {
  return "https://www.habbo.com/habbo-imaging/avatarimage?" + new URLSearchParams({ figure: fig, direction: dir, head_direction: dir, size: tamanho, gesture: "sml" });
}
function criadorPainelHtml() {
  const f = criador.f, fig = criadorFigura(f);
  const aba = CRIADOR_ABAS.find((a) => a.t === criador.aba) || CRIADOR_ABAS[1];
  const tipo = criador.cat?.tipos[aba.t];
  const conjuntos = (tipo?.s || []).filter((s) => criadorServe(s, f.g));
  const atual = f.partes[aba.t];
  const conjAtual = atual && criadorConjunto(aba.t, atual.id);
  const pal = criadorPaleta(aba.t);
  const reserva = (t, id) => `this.onerror=null;this.src='https://www.habboassets.com/imaging/avatar.png?figure='+encodeURIComponent(this.dataset.fig)+'&direction=3'`;
  const tile = (id, rotulo) => {
    const src = criadorMiniatura(aba.t, id, aba.cabeca);
    const fg = decodeURIComponent(new URL(src).searchParams.get("figure"));
    return `<button type="button" class="cri-peca${aba.cabeca ? " cabeca" : ""}" aria-pressed="${id === null ? !atual : atual?.id === id}" onclick="criadorEscolher('${aba.t}', ${id})" aria-label="${rotulo}" title="${rotulo}"><img loading="lazy" src="${src}" data-fig="${safeText(fg)}" onerror="${reserva()}" alt="">${id === null ? "<span>Nenhum</span>" : ""}</button>`;
  };
  const cores = (i) => `<div class="cri-cores" role="group" aria-label="Cor ${i + 1}">${pal.map(([id, hex]) => `<button type="button" class="abr-cor" style="--c:#${safeText(hex)}" aria-pressed="${atual?.cores[i] === id}" aria-label="Cor ${id}" onclick="criadorCor('${aba.t}', ${i}, ${id})"></button>`).join("")}</div>`;
  return `${vybelandiaCenaHtml(true)}<div class="abr-vinheta" aria-hidden="true"></div>
<section class="abr-painel cri" aria-labelledby="abr-titulo">
 <div class="abr-previa">
  <div class="cri-corpo">${["M", "F"].map((g) => `<button type="button" class="abr-estilo" aria-pressed="${f.g === g}" onclick="criadorTrocarCorpo('${g}')">${g === "M" ? "Masculino" : "Feminino"}</button>`).join("")}</div>
  <img src="${criadorImagem(fig, criador.direcao)}" alt="Prévia do seu personagem" width="128" height="220">
  <div class="abr-girar"><button type="button" onclick="criador.direcao=(criador.direcao+7)%8;renderAberturaEscritorio()" aria-label="Girar para a esquerda">↺</button><button type="button" onclick="criadorAleatorio()" class="cri-sorte">Aleatório</button><button type="button" onclick="criador.direcao=(criador.direcao+1)%8;renderAberturaEscritorio()" aria-label="Girar para a direita">↻</button></div>
 </div>
 <div class="abr-opcoes cri-opcoes">
  <span class="abr-kicker">${criador.so ? "Meu espaço" : "Passo 1 de 2"}</span><h2 id="abr-titulo">Seu personagem</h2>
  <nav class="cri-abas" aria-label="Partes do personagem">${CRIADOR_ABAS.map((a) => `<button type="button" aria-pressed="${a.t === aba.t}" onclick="criador.aba='${a.t}';criador.mostrar=60;renderAberturaEscritorio()">${a.nome}${f.partes[a.t] && a.opcional ? " ●" : ""}</button>`).join("")}</nav>
  ${!criador.cat ? '<p class="abr-nota">Carregando o catálogo…</p>' : `
  ${pal.length && atual && (conjAtual?.[3] ?? 1) > 0 ? `<h3 class="cri-sub">Cor</h3>${cores(0)}${(conjAtual?.[3] ?? 0) > 1 ? `<h3 class="cri-sub">Segunda cor</h3>${cores(1)}` : ""}` : ""}
  <h3 class="cri-sub">${aba.nome} · ${conjuntos.length} opções</h3>
  <div class="cri-grade">${aba.opcional ? tile(null, "Nenhum") : ""}${conjuntos.slice(0, criador.mostrar).map((s) => tile(s[0], aba.nome + " " + s[0])).join("")}</div>
  ${conjuntos.length > criador.mostrar ? `<button type="button" class="abr-secundario cri-mais" onclick="criador.mostrar+=60;renderAberturaEscritorio()">Mostrar mais (${conjuntos.length - criador.mostrar})</button>` : ""}`}
  <p class="abr-erro" role="alert" id="abr-erro"></p>
  <div class="abr-acoes">${criador.so ? '<button type="button" class="abr-secundario" onclick="fecharAberturaEscritorio()">Cancelar</button><button type="button" class="abr-primario" onclick="salvarPersonagemEscritorio()">Salvar personagem</button>' : `<button type="button" class="abr-secundario" onclick="criador.etapa='cena';renderAberturaEscritorio()">Voltar</button><button type="button" class="abr-primario" onclick="criador.etapa='boas';renderAberturaEscritorio()">Continuar</button>`}</div>
 </div>
</section>`;
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
  criadorCarregarCatalogo();
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
    el.innerHTML = criadorPainelHtml();
    return;
  }
  // Saiu do escritório: volta para a entrada da Vybelândia (a tela inicial),
  // que pergunta se quer entrar de novo.
  if (criador.etapa === "saida") {
    const faiscas = Array.from({ length: 24 }, (_, i) =>
      `<i style="--x:${(i * 41) % 100}%;--d:${4 + (i % 5)}s;--a:${(i * 0.37) % 4}s;--s:${2 + (i % 3)}px"></i>`).join("");
    el.innerHTML = `${vybelandiaCenaHtml()}<div class="abr-luz" aria-hidden="true"></div><div class="abr-faiscas" aria-hidden="true">${faiscas}</div><div class="abr-vinheta" aria-hidden="true"></div>
<div class="abr-texto"><span class="abr-kicker">Vybe OS · você saiu do escritório</span><h1>Bem-vindo à <b>Vybelândia</b></h1><p>${safeText(criador.nome)}, quer entrar de novo? A equipe só vê você quando entrar.</p>
<div class="abr-saida-acoes"><button type="button" class="abr-primario" onclick="fecharAberturaEscritorio();escritorio.lobbyFechado=true;${escritorio.base?.demo ? "renderEscritorio()" : "conectarEscritorio()"}">Entrar na Vybelândia</button><button type="button" class="abr-secundario" onclick="fecharAberturaEscritorio();abrirPainelDoEscritorio()">Ir para o painel</button></div></div>`;
    el.querySelector(".abr-primario")?.focus({ preventScroll: true });
    return;
  }
  // Boas-vindas
  const mesa = escritorioMinhaMesa();
  el.innerHTML = `${vybelandiaCenaHtml(true)}<div class="abr-vinheta" aria-hidden="true"></div>
<section class="abr-painel abr-boas" aria-labelledby="abr-titulo">
 <img class="abr-boneco" src="${criadorImagem(criadorFigura(criador.f), 4)}" alt="" width="128" height="220">
 <div><span class="abr-kicker">Passo 2 de 2</span><h2 id="abr-titulo">Bem-vindo à Vybelândia, ${safeText(criador.nome)}!</h2>
 <ul class="abr-dicas">
  <li><b>${mesa ? safeText(mesa.ambiente.nome) : "Sua sala"}</b> ${mesa ? "é sua: você chega pela porta dela, e o computador da mesa abre o painel." : "ainda não foi definida; você chega pela recepção."}</li>
  <li><b>Clique no piso</b> para andar. Arraste para mover o mapa e use a roda do mouse para o zoom.</li>
  <li><b>Suas demandas</b> ficam no botão Painel, na barra de baixo: modo Gestor, Minhas tarefas, Foco e os outros módulos. "Voltar ao escritório" traz você de volta ao mapa.</li>
  <li><b>Entre na conversa</b> da sala para falar com quem está nela. Microfone e câmera começam desligados.</li>
 </ul>
 <p class="abr-erro" role="alert" id="abr-erro"></p>
 <div class="abr-acoes"><button type="button" class="abr-secundario" onclick="criador.etapa='personagem';renderAberturaEscritorio()">Ajustar personagem</button><button type="button" class="abr-primario" onclick="salvarPersonagemEscritorio(true)">Entrar no escritório</button></div></div>
</section>`;
  el.querySelector(".abr-primario")?.focus({ preventScroll: true });
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
    // Fim da abertura: ao entrar, o tutorial mostra o básico (e onde ficam as demandas).
    if (entrar && !criador.so) escritorio.tutorialPendente = true;
    renderEscritorio();
    if (!escritorio.base.demo) mapaGuardarBoneco(salvo.figura);
    if (entrar && !escritorio.base.demo) {
      if (escritorio.conectado) { desconectarEscritorio(false); }
      await conectarEscritorio();
    } else if (entrar) {
      escritorio.lobbyFechado = true;
      renderEscritorio();
      if (escritorio.tutorialPendente) { escritorio.tutorialPendente = false; setTimeout(iniciarTutorialEscritorio, 900); }
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

// Tutorial do básico: destaca cada controle de verdade na tela, um por vez.
// Abre sozinho depois da abertura e pode ser revisto no botão Tutorial.
const TUTORIAL_ESCRITORIO = [
  { alvo: ".mapa-pessoa.voce", titulo: "Este é você", texto: "Clique no piso para andar, ou use W A S D (ou as setas). Segure Shift para correr." },
  { alvo: "#ofc-btn-painel", titulo: "Suas demandas estão aqui", texto: "Painel abre o seu espaço de trabalho: modo Gestor, Minhas tarefas, Foco e todos os módulos, com as demandas. Lá, o botão Voltar ao escritório (embaixo) traz você de volta ao mapa." },
  { alvo: ".ofc-rail-btn[aria-label='Painel']", titulo: "Também pela lateral", texto: "O Painel também fica na barra da esquerda, sempre à mão. O computador da sua mesa faz o mesmo: chegue perto e aperte E." },
  { alvo: "#office-acao:not([hidden])", titulo: "Chegou perto, aperte E", texto: "Perto de alguém ou de um objeto aparece um botão com a tecla E: conversar, sentar, pegar um café, ligar a jukebox, correr na esteira. No computador da sua mesa, o E abre o painel." },
  { alvo: "[aria-label='Entrar na conversa']", titulo: "Conversa por sala", texto: "Cada sala é uma zona de conversa. Entre na conversa para falar com quem está nela. Microfone e câmera começam desligados." },
  { alvo: ".ofc-status", titulo: "Sua disponibilidade", texto: "Mostre se está disponível, em foco ou ausente. Estar online não mede produtividade." },
  { alvo: ".ofc-eu", titulo: "Seu personagem", texto: "Clique aqui (ou no seu boneco) para trocar roupa, cabelo e acessórios." },
  { alvo: "[aria-label='Tutorial']", titulo: "Pronto!", texto: "Para rever estas dicas, use o botão Tutorial na barra da esquerda." },
];
const tutorial = { passo: 0 };
function iniciarTutorialEscritorio() {
  if (typeof activeBoard !== "undefined" && activeBoard !== "escritorio") return;
  tutorial.passo = 0;
  let el = document.getElementById("ofc-tutorial");
  if (!el) {
    el = document.createElement("div");
    el.id = "ofc-tutorial";
    el.className = "ofc-tutorial";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "ofc-tutorial-titulo");
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); fecharTutorialEscritorio(); }
      if (e.key === "ArrowRight") { e.stopPropagation(); passoTutorialEscritorio(1); }
      if (e.key === "ArrowLeft") { e.stopPropagation(); passoTutorialEscritorio(-1); }
    });
    document.body.append(el);
    window.addEventListener("resize", renderTutorialEscritorio);
  }
  renderTutorialEscritorio();
}
function fecharTutorialEscritorio() {
  document.getElementById("ofc-tutorial")?.remove();
  window.removeEventListener("resize", renderTutorialEscritorio);
}
function passoTutorialEscritorio(d) {
  tutorial.passo = Math.max(0, Math.min(TUTORIAL_ESCRITORIO.length - 1, tutorial.passo + d));
  renderTutorialEscritorio();
}
function renderTutorialEscritorio() {
  const el = document.getElementById("ofc-tutorial");
  if (!el) return;
  const p = TUTORIAL_ESCRITORIO[tutorial.passo], ultimo = tutorial.passo === TUTORIAL_ESCRITORIO.length - 1;
  const alvo = p.alvo && [...document.querySelectorAll(p.alvo)].find((n) => n.getClientRects().length);
  const r = alvo?.getBoundingClientRect();
  const folga = 8;
  const furo = r ? `left:${r.left - folga}px;top:${r.top - folga}px;width:${r.width + folga * 2}px;height:${r.height + folga * 2}px` : "";
  el.innerHTML = `${r ? `<div class="tut-furo" style="${furo}"></div>` : '<div class="tut-fundo"></div>'}
<section class="tut-cartao" tabindex="-1">
 <span class="tut-passo">${tutorial.passo + 1} de ${TUTORIAL_ESCRITORIO.length}</span>
 <h2 id="ofc-tutorial-titulo">${safeText(p.titulo)}</h2>
 <p>${safeText(p.texto)}</p>
 <div class="tut-acoes"><button type="button" class="tut-pular" onclick="fecharTutorialEscritorio()">${ultimo ? "Fechar" : "Pular tutorial"}</button><span></span>${tutorial.passo ? '<button type="button" class="abr-secundario" onclick="passoTutorialEscritorio(-1)">Voltar</button>' : ""}<button type="button" class="abr-primario" onclick="${ultimo ? "fecharTutorialEscritorio()" : "passoTutorialEscritorio(1)"}">${ultimo ? "Começar" : "Próximo"}</button></div>
</section>`;
  // Cartão perto do alvo, sem sair da tela; sem alvo, no centro.
  const c = el.querySelector(".tut-cartao");
  const cw = Math.min(340, innerWidth - 32);
  c.style.width = cw + "px";
  const ch = c.offsetHeight;
  let x = innerWidth / 2 - cw / 2, y = innerHeight / 2 - ch / 2;
  if (r) {
    x = Math.max(16, Math.min(innerWidth - cw - 16, r.left + r.width / 2 - cw / 2));
    y = r.top - ch - 18 >= 16 ? r.top - ch - 18 : Math.min(innerHeight - ch - 16, r.bottom + 18);
  }
  c.style.cssText = `width:${cw}px;left:${x}px;top:${Math.max(16, y)}px`;
  el.querySelector(".abr-primario")?.focus({ preventScroll: true });
}
