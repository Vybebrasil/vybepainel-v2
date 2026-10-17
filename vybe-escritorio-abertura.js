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
  // A cena é sempre muda (decisão do Paulo): sem trilha e sem botão de som.
  return `<video class="abr-cena${parada ? " parada" : ""}" src="${safeText(video)}" poster="${safeText(capa)}" ${reduzido ? "" : "autoplay loop"} muted playsinline preload="auto" aria-hidden="true"></video>`;
}

// Criador de personagem no estilo do Habbo: abas por categoria, grade com
// miniatura de cada peça já no boneco da pessoa, cores reais de cada peça
// (catálogo oficial em assets/escritorio/habbo/figuras.json), "Nenhum" para o
// que é opcional e "Aleatório".
// Grupos do criador: primeiro escolhe a região, depois a peça.
const CRIADOR_GRUPOS = [["cabeca", "Cabeça", ["hd", "hr", "ha", "he", "ea", "fa"]], ["corpo", "Corpo", ["ch", "cc", "ca", "cp", "wa"]], ["pernas", "Pernas e pés", ["lg", "sh"]]];
// Cores mais usadas primeiro; o resto só com "Mais cores".
const CRIADOR_CORES_VISIVEIS = 24;
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
function criadorPagina(d) {
  criador.pagina = Math.max(0, (criador.pagina || 0) + d);
  renderAberturaEscritorio();
}
// Roda do mouse (ou dois dedos) sobre a grade troca de página.
function criadorRodaPagina(e) {
  if (Math.abs(e.deltaY) < 20 || Date.now() - (criador.ultimaRoda || 0) < 350) return;
  e.preventDefault();
  criador.ultimaRoda = Date.now();
  criadorPagina(e.deltaY > 0 ? 1 : -1);
}
// Quantas peças cabem na grade sem rolar (medido depois de desenhar).
function criadorMedirPagina() {
  const g = document.querySelector("#ofc-abertura .cri-grade"), t = g?.querySelector(".cri-peca");
  if (!g || !t) return;
  const gap = 6, cols = Math.max(1, Math.floor((g.clientWidth + gap) / (t.offsetWidth + gap))), linhas = Math.max(1, Math.floor((g.clientHeight + gap) / (t.offsetHeight + gap)));
  const por = Math.max(12, cols * linhas);
  if (por !== criador.porPagina) { criador.porPagina = por; renderAberturaEscritorio(); }
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
  // Uma paleta por vez (Cor 1 / Cor 2), com as mais usadas visíveis e o resto
  // em "Mais cores"; a cor escolhida fica sempre visível no topo.
  const nCores = Math.min(2, Math.max(0, conjAtual?.[3] ?? 1));
  const qual = Math.min(criador.corAtiva || 0, Math.max(0, nCores - 1));
  const hexDe = (id) => pal.find((c) => c[0] === id)?.[1] || "888888";
  const todasCores = criador.maisCores ? pal : pal.slice(0, CRIADOR_CORES_VISIVEIS);
  const escolhidaFora = atual && !todasCores.some(([id]) => id === atual.cores[qual]);
  const visiveis = escolhidaFora ? [pal.find((c) => c[0] === atual.cores[qual]), ...todasCores].filter(Boolean) : todasCores;
  const cores = () => `<div class="cri-cores-topo">${Array.from({ length: nCores }, (_, i) => `<button type="button" class="cri-cor-alvo" aria-pressed="${i === qual}" onclick="criador.corAtiva=${i};renderAberturaEscritorio()"><i style="--c:#${safeText(hexDe(atual?.cores[i]))}"></i>${nCores > 1 ? (i ? "Cor 2" : "Cor 1") : "Cor"}</button>`).join("")}${pal.length > CRIADOR_CORES_VISIVEIS ? `<button type="button" class="cri-mais-cores" onclick="criador.maisCores=!criador.maisCores;renderAberturaEscritorio()">${criador.maisCores ? "Menos cores" : `Mais cores (${pal.length - CRIADOR_CORES_VISIVEIS})`}</button>` : ""}</div><div class="cri-cores${criador.maisCores ? " todas" : ""}" role="group" aria-label="${nCores > 1 ? (qual ? "Cor 2" : "Cor 1") : "Cor"}">${visiveis.map(([id, hex]) => `<button type="button" class="abr-cor" style="--c:#${safeText(hex)}" aria-pressed="${atual?.cores[qual] === id}" aria-label="Cor ${id}" onclick="criadorCor('${aba.t}', ${qual}, ${id})"></button>`).join("")}</div>`;
  return `${vybelandiaCenaHtml(true)}<div class="abr-vinheta" aria-hidden="true"></div>
<section class="abr-painel cri" aria-labelledby="abr-titulo">
 <div class="abr-previa">
  <img src="${criadorImagem(fig, criador.direcao)}" alt="Prévia do seu personagem" width="128" height="220">
  <div class="cri-corpo" role="group" aria-label="Corpo">${["M", "F"].map((g) => `<button type="button" class="abr-estilo" aria-pressed="${f.g === g}" onclick="criadorTrocarCorpo('${g}')">${g === "M" ? "Masculino" : "Feminino"}</button>`).join("")}</div>
  <div class="abr-girar"><button type="button" onclick="criador.direcao=(criador.direcao+7)%8;renderAberturaEscritorio()" aria-label="Girar para a esquerda">↺</button><button type="button" onclick="criadorAleatorio()" class="cri-sorte">Aleatório</button><button type="button" onclick="criador.direcao=(criador.direcao+1)%8;renderAberturaEscritorio()" aria-label="Girar para a direita">↻</button></div>
 </div>
 <div class="abr-opcoes cri-opcoes">
  <span class="abr-kicker">${criador.so ? "Meu espaço" : "Passo 1 de 2"}</span><h2 id="abr-titulo">Seu personagem</h2>
  ${(() => {
    const grupo = CRIADOR_GRUPOS.find((g) => g[2].includes(aba.t)) || CRIADOR_GRUPOS[0];
    return `<nav class="cri-grupos" aria-label="Região">${CRIADOR_GRUPOS.map(([id, nome, abas]) => `<button type="button" aria-pressed="${id === grupo[0]}" onclick="criador.aba='${abas.includes(criador.aba) ? criador.aba : abas[id === "cabeca" ? 1 : 0]}';criador.pagina=0;criador.corAtiva=0;renderAberturaEscritorio()">${nome}</button>`).join("")}</nav>
  <nav class="cri-abas" aria-label="Peças de ${grupo[1]}">${CRIADOR_ABAS.filter((a) => grupo[2].includes(a.t)).map((a) => `<button type="button" aria-pressed="${a.t === aba.t}" onclick="criador.aba='${a.t}';criador.pagina=0;criador.corAtiva=0;renderAberturaEscritorio()">${a.nome}${f.partes[a.t] && a.opcional ? '<i class="cri-usando" title="Usando"></i>' : ""}</button>`).join("")}</nav>`;
  })()}
  ${!criador.cat ? '<p class="abr-nota">Carregando o catálogo…</p>' : `
  ${pal.length && atual && nCores > 0 ? cores() : ""}
  <h3 class="cri-sub">${aba.nome} · ${conjuntos.length} opções</h3>
  ${(() => {
    // Por página, do tamanho exato da grade (sem rolar): "Nenhum" + peças.
    const itens = [...(aba.opcional ? [null] : []), ...conjuntos.map((c) => c[0])];
    const por = Math.max(12, criador.porPagina || 48), total = Math.max(1, Math.ceil(itens.length / por));
    const pag = Math.min(criador.pagina || 0, total - 1);
    criador.pagina = pag;
    const pagina = itens.slice(pag * por, pag * por + por);
    return `<div class="cri-grade" onwheel="criadorRodaPagina(event)">${pagina.map((id) => id === null ? tile(null, "Nenhum") : tile(id, aba.nome + " " + id)).join("")}</div>
  ${total > 1 ? `<nav class="cri-paginas" aria-label="Páginas"><button type="button" class="abr-secundario" onclick="criadorPagina(-1)" ${pag ? "" : "disabled"} aria-label="Página anterior">‹</button><span>Página ${pag + 1} de ${total}</span><button type="button" class="abr-secundario" onclick="criadorPagina(1)" ${pag < total - 1 ? "" : "disabled"} aria-label="Próxima página">›</button></nav>` : ""}`;
  })()}`}
  <p class="abr-erro" role="alert" id="abr-erro"></p>
  <div class="abr-acoes">${criador.so ? '<button type="button" class="abr-secundario" onclick="fecharAberturaEscritorio()">Cancelar</button><button type="button" class="abr-primario" onclick="salvarPersonagemEscritorio()">Salvar personagem</button>' : `<button type="button" class="abr-secundario" onclick="criador.etapa='cena';renderAberturaEscritorio()">Voltar</button><button type="button" class="abr-primario" onclick="criador.etapa=escritorioMinhaMesa()&&!escritorio.perfil.quarto_configurado?'planta':'boas';renderAberturaEscritorio()">Continuar</button>`}</div>
 </div>
</section>`;
}
function escritorioPrecisaAbertura() {
  return Boolean(escritorio.base) && (escritorio.perfil?.abertura !== ESCRITORIO_ABERTURA || Boolean(escritorioMinhaMesa()) && !escritorio.perfil?.quarto_configurado);
}
function abrirAberturaEscritorio(etapa = "cena") {
  const eu = escritorio.base?.equipe.find((p) => p.id === escritorio.base.eu);
  // "Meu espaço" pede só o criador; a abertura completa termina nas boas-vindas.
  criador.so = etapa === "personagem";
  // Quem acabou de passar pela Vybelândia no login vai direto ao personagem.
  criador.etapa = etapa === "cena" && window.VYBELANDIA_VISTA ? "personagem" : etapa;
  if(etapa === "cena" && escritorio.perfil?.abertura === ESCRITORIO_ABERTURA && escritorioMinhaMesa() && !escritorio.perfil.quarto_configurado) criador.etapa="planta";
  criador.planta=escritorio.perfil?.sala_planta || "amplo";
  criador.modelo="trabalho";
  criador.preservar=true;
  criador.piso=escritorio.perfil?.sala_piso || "madeira";
  criador.parede=escritorio.perfil?.sala_parede || "#ff8a35";
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
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && criador.so) fecharAberturaEscritorio();
      if(e.key !== "Tab") return;
      const alvos=[...el.querySelectorAll('button:not(:disabled),select,input,a[href]')].filter(n=>n.offsetParent);
      const primeiro=alvos[0],ultimo=alvos.at(-1);
      if(e.shiftKey && document.activeElement===primeiro) {e.preventDefault();ultimo?.focus();}
      else if(!e.shiftKey && document.activeElement===ultimo) {e.preventDefault();primeiro?.focus();}
    });
    document.body.append(el);
  }
  renderAberturaEscritorio();
  // Garantia: a cortina preta e o texto da cena dependem de animação CSS; em
  // alguns computadores (aba em segundo plano, economia de energia) a animação
  // não roda e a tela ficava preta. Depois de 3,5 s mostra tudo de qualquer jeito.
  clearTimeout(criador.timerGarantia);
  criador.timerGarantia = setTimeout(() => el.classList.add("abr-pronta"), 3500);
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
    requestAnimationFrame(criadorMedirPagina);
    return;
  }
  if(["planta","mobilia","acabamento"].includes(criador.etapa)) {
    el.innerHTML=criadorQuartoHtml();
    el.querySelector(".abr-primario")?.focus({preventScroll:true});
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
 <div><span class="abr-kicker">Tudo pronto para entrar</span><h2 id="abr-titulo">Bem-vindo à Vybelândia, ${safeText(criador.nome)}!</h2>
 <ul class="abr-dicas">
  <li><b>${mesa ? safeText(mesa.ambiente.nome) : "Sua sala"}</b> ${mesa ? "é sua: você chega pela porta dela, e o computador da mesa abre o painel." : "ainda não foi definida; você chega pela recepção."}</li>
  <li><b>Clique no piso</b> para andar. Arraste para mover o mapa e use a roda do mouse para o zoom.</li>
  <li><b>Suas demandas</b> ficam no botão Painel, na barra de baixo: modo Gestor, Minhas tarefas, Foco e os outros módulos. "Voltar ao escritório" traz você de volta ao mapa.</li>
  <li><b>Entrou numa sala, está na conversa dela</b>, com o microfone ligado: quem está ali ouve você. Clique no microfone para silenciar. A câmera começa desligada.</li>
 </ul>
 <p>Ganhe <b>VybeCoins e XP pelo que entrega</b>: cada função tem suas regras, e a sua ficha mostra a meta da semana e os últimos pontos. Os essenciais são gratuitos. Extras custam 25 moedas por unidade na loja do editor. Montar seu primeiro quarto desbloqueia 50 moedas.</p>
 <p class="abr-erro" role="alert" id="abr-erro"></p>
 <div class="abr-acoes"><button type="button" class="abr-secundario" onclick="criador.etapa=escritorioMinhaMesa()&&!escritorio.perfil.quarto_configurado?'acabamento':'personagem';renderAberturaEscritorio()">Revisar escolhas</button><button type="button" class="abr-primario" onclick="salvarPersonagemEscritorio(true)">Entrar no escritório</button></div></div>
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
    if(!criador.so && escritorioMinhaMesa() && !escritorio.perfil.quarto_configurado) {
      let resultado;
      if(escritorio.base.demo) {
        const camada=escritorioMinhaMesa().ambiente.id;
        const itens=escritorio.base.quartos.modelos.find(m=>m.id===criador.modelo).itens;
        resultado={perfil:{...perfil,sala_planta:criador.planta,sala_piso:criador.piso,sala_parede:criador.parede,quarto_configurado:true},camada,mapa:{itens,versao:1,em:new Date().toISOString()},economia:{...escritorio.base.economia,saldo:50,conquistas:[{origem:"conquista:meu-quarto"}]}};
      } else resultado=await escritorioApi("quarto",{perfil:{...perfil,sala_piso:criador.piso,sala_parede:criador.parede},planta:criador.planta,modelo:criador.modelo,preservar:criador.preservar});
      salvo=resultado.perfil;
      if(resultado.camada) escritorio.base.mapa.camadas[resultado.camada]=resultado.mapa;
      escritorio.base.economia=resultado.economia;
      escritorio.mapa?.destruir(); escritorio.mapa=null;
    } else if (!escritorio.base.demo) salvo = (await escritorioApi("perfil", { perfil })).perfil;
    escritorio.perfil = { ...escritorio.perfil, ...salvo };
    const eu = escritorio.base.equipe.find((p) => p.id === escritorio.base.eu);
    if (eu) eu.perfil = { ...eu.perfil, ...salvo };
    escritorioAplicarSalas();
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
  { alvo: ".ofc-dock", titulo: "Conversa por sala", texto: "Entrou numa sala, você está na conversa dela com o microfone ligado: quem está ali ouve você. O botão do microfone, aqui embaixo, silencia. Ao sair da sala, sai da conversa. No Foco e no corredor não há voz." },
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

// A planta e os modelos vêm do mesmo catálogo validado pelo servidor.
function criadorPlantaPrevia(planta,modelo) {
  if(!planta) return "";
  const itens=escritorio.base.quartos.modelos.find(m=>m.id===modelo)?.itens || [];
  let desenho="";
  for(let y=0;y<8;y++) for(let x=0;x<8;x++) {
    const n=planta.celdas[y][x];if(n<0) continue;
    const px=128+(x-y)*13,py=30+(x+y)*6.5-n*8;
    desenho+=`<path d="M${px} ${py}l13 6.5 -13 6.5 -13 -6.5Z" fill="${n?'#ffc58e':'#b78967'}" stroke="#382c2e" stroke-width=".6"/>`;
    if(itens.some(it=>Math.floor(it[1])===x&&Math.floor(it[2])===y)) desenho+=`<rect x="${px-5}" y="${py-8}" width="10" height="13" rx="2" fill="#f58232" stroke="#fff1d7"/>`;
  }
  for(const [x0,y0,x1,y1] of planta.divisorias || []) {
    desenho+=`<path d="M${128+(x0-y0)*13} ${30+(x0+y0)*6.5}L${128+(x1-y1)*13} ${30+(x1+y1)*6.5}" stroke="#ffe1b5" stroke-width="4"/>`;
  }
  return `<svg viewBox="0 0 256 155" role="img" aria-label="Prévia da planta ${safeText(planta.nome)}">${desenho}</svg>`;
}
function criadorQuartoEscolher(campo,valor) {
  const catalogo=escritorio.base.quartos;
  if(campo==="planta"&&!catalogo.plantas.some(p=>p.id===valor)) return;
  if(campo==="modelo"&&!catalogo.modelos.some(p=>p.id===valor)) return;
  criador[campo]=valor;
  renderAberturaEscritorio();
}
function criadorQuartoHtml() {
 const catalogo=escritorio.base.quartos;
 if(!catalogo) return '<section class="abr-painel"><h2>Catálogo de quartos indisponível</h2><p>Recarregue o escritório para tentar novamente.</p></section>';
 const etapa=criador.etapa,planta=catalogo.plantas.find(p=>p.id===criador.planta);
 let titulo,conteudo,anterior,proxima;
 if(etapa==="planta") {
  titulo="Qual é o formato do seu quarto?";anterior="personagem";proxima="mobilia";
  conteudo=`<div class="abr-quartos">${catalogo.plantas.map(p=>`<button type="button" aria-pressed="${p.id===criador.planta}" onclick="criadorQuartoEscolher('planta','${p.id}')">${criadorPlantaPrevia(p)}<b>${safeText(p.nome)}</b><small>${safeText(p.dica)}</small></button>`).join("")}</div>`;
 } else if(etapa==="mobilia") {
  titulo="Em branco ou com o básico pronto?";anterior="planta";proxima="acabamento";
  conteudo=`${escritorio.base.mapa?.camadas?.[escritorioMinhaMesa()?.ambiente.id]?.itens?.length ? `<label><input type="checkbox" ${criador.preservar?"checked":""} onchange="criador.preservar=this.checked"> Preservar minha decoração atual. Desmarque para usar o modelo escolhido e guardar a anterior no histórico.</label>` : ""}<p>Todos os modelos iniciais são gratuitos. Se você já decorou um quarto, os móveis salvos serão preservados; escolha uma planta em que eles caibam.</p><div class="abr-quartos">${catalogo.modelos.map(m=>`<button type="button" aria-pressed="${m.id===criador.modelo}" onclick="criadorQuartoEscolher('modelo','${m.id}')">${criadorPlantaPrevia(planta,m.id)}<b>${safeText(m.nome)}</b><small>${safeText(m.dica)}</small></button>`).join("")}</div>`;
 } else {
  titulo="Dê a sua cara ao espaço";anterior="mobilia";proxima="boas";
  conteudo=`${criadorPlantaPrevia(planta,criador.modelo)}<div class="abr-acabamentos"><label>Piso<select onchange="criador.piso=this.value">${["madeira","clara","concreto","carpete","preto","verde","marmore","nogueira"].map(p=>`<option value="${p}"${criador.piso===p?' selected':''}>${p}</option>`).join("")}</select></label><label>Paredes<select onchange="criador.parede=this.value">${[["#ff8a35","Laranja"],["#5aa9ff","Azul"],["#7ee08a","Verde"],["#b48cff","Lilás"],["#e8e8ee","Clara"],["#8a8f9c","Grafite"]].map(([v,n])=>`<option value="${v}"${criador.parede===v?' selected':''}>${n}</option>`).join("")}</select></label></div><p>Depois de entrar, use <b>Decorar</b> no seu quarto para arrastar móveis, pintar cada ladrilho e abrir a loja. Sua escolha só será salva na confirmação final.</p>`;
 }
 return `<section class="abr-painel abr-quarto" aria-labelledby="abr-titulo"><span class="abr-kicker">Seu espaço · ${etapa==="planta"?'1 de 3':etapa==="mobilia"?'2 de 3':'3 de 3'}</span><h2 id="abr-titulo">${titulo}</h2>${conteudo}<div class="abr-acoes"><button type="button" class="abr-secundario" onclick="criador.etapa='${anterior}';renderAberturaEscritorio()">Voltar</button><button type="button" class="abr-primario" onclick="criador.etapa='${proxima}';renderAberturaEscritorio()">Continuar</button></div></section>`;
}
