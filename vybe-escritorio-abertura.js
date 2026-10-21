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
function criadorImagem(fig, dir = 2, tamanho = "l", mao = "") {
  return "https://www.habbo.com/habbo-imaging/avatarimage?" + new URLSearchParams({ figure: fig, direction: dir, head_direction: dir, size: tamanho, gesture: "sml", ...(mao ? { action: mao } : {}) });
}
// Avatar do agente de um cliente (Paulo, 20/10/2026: "editar o avatar do
// cliente quando clicar nele"): o mesmo criador dos jogadores, com o destino
// no cliente, a escolha do objeto de mão e o "voltar à fantasia da marca".
// Salva na identidade do cliente (area=planejamentos, acao=personagem).
// Objetos conferidos um a um no gerador do Habbo (o número é o "crr").
const CRIADOR_MAOS = [["", "Nada"], ["crr=6", "Café"], ["crr=1", "Bebida"], ["crr=67", "Refrigerante"], ["crr=42", "Lata verde"], ["crr=62", "Garrafa"], ["crr=126", "Caneca de chope"],
  ["crr=185", "Garrafinha de academia"], ["crr=73", "Pipoca"], ["crr=248", "Tigela de pipoca"], ["crr=66", "Tigela de comida"], ["crr=105", "Coxa de frango"], ["crr=106", "Pão"], ["crr=220", "Baguete"],
  ["crr=178", "Fatia de bolo"], ["crr=191", "Rosquinha"], ["crr=2", "Cenoura"], ["crr=87", "Prancheta"], ["crr=79", "Livro"], ["crr=230", "Lápis"], ["crr=282", "Tablet"], ["crr=112", "Robozinho"], ["crr=109", "Frasco"]];
// Skins (Paulo, 21/10/2026): o básico é grátis; o resto se compra na faixa
// dos móveis (server/escritorio-roupas.js). A prova é livre: a peça entra no
// boneco e o Salvar mostra quanto custa o que falta.
async function criadorCarregarRoupas(forcar = false) {
  if (criador.destino || window.ESCRITORIO_CONVIDADO || escritorio.base?.demo || (criador.roupas && !forcar) || criador.carregandoRoupas) return;
  criador.carregandoRoupas = true;
  try { criador.roupas = await escritorioApi("roupas"); } catch { criador.roupas = { ativo: false }; }
  criador.carregandoRoupas = false;
  if (document.getElementById("ofc-abertura")) renderAberturaEscritorio();
}
// Preço da peça (0 = grátis), ou null quando as skins não valem.
function criadorPrecoRoupa(classe) {
  const r = criador.roupas;
  if (!r?.ativo) return null;
  const p = r.pecas[classe];
  return p ? (p[1] ?? r.faixas[p[0]]?.preco ?? 0) : r.faixas.comum?.preco ?? 25;
}
// Peça que a pessoa pode vestir sem comprar: grátis, dela ou já no visual salvo.
function criadorRoupaLivre(classe) {
  const r = criador.roupas;
  if (!r?.ativo) return true;
  const salvas = new Set(String(escritorio.perfil?.figura || "").split(".").map((p) => "roupa:" + p.split("-").slice(0, 2).join("-")));
  return criadorPrecoRoupa(classe) === 0 || r.meus.includes(classe) || salvas.has(classe);
}
function criadorFaltamRoupas() {
  if (criador.destino) return [];
  return Object.entries(criador.f?.partes || {}).map(([t, p]) => `roupa:${t}-${p.id}`).filter((c) => !criadorRoupaLivre(c)).map((c) => ({ classe: c, preco: criadorPrecoRoupa(c) }));
}
function criadorSeloRoupa(t, id) {
  const c = `roupa:${t}-${id}`;
  if (criadorRoupaLivre(c)) return "";
  const raro = criador.roupas.pecas[c]?.[0] && criador.roupas.pecas[c][0] !== "comum";
  return `<em class="cri-preco${raro ? " raro" : ""}" title="${raro ? "Rara" : "Comum"} · ${criadorPrecoRoupa(c)} VybeCoins">${criadorPrecoRoupa(c)}</em>`;
}
// "salvar" (Meu espaço) ou "continuar" (primeira abertura).
function criadorSeguir(tipo) {
  if (tipo === "salvar") return salvarPersonagemEscritorio();
  criador.etapa = escritorioMinhaMesa() && !escritorio.perfil.quarto_configurado ? "planta" : "boas";
  renderAberturaEscritorio();
}
function criadorBotaoSalvar(tipo) {
  const rotulo = tipo === "salvar" ? "Salvar personagem" : "Continuar";
  const faltam = criadorFaltamRoupas();
  if (!faltam.length) return `<button type="button" class="abr-primario" onclick="criadorSeguir('${tipo}')">${rotulo}</button>`;
  const total = faltam.reduce((t, f) => t + Number(f.preco || 0), 0);
  criador.depoisDeComprar = tipo;
  // O que falta é exatamente um kit: sai pelo preço do kit.
  const kit = criadorKitDasFaltas(faltam);
  if (kit) return `<button type="button" class="abr-primario" onclick="criadorComprarKit('${safeText(kit.chave)}',true)" title="Comprar o kit e ${rotulo.toLowerCase()}">Comprar ${safeText(kit.nome)} · ${kit.preco.toLocaleString("pt-BR")} moedas</button>`;
  return `<button type="button" class="abr-primario" onclick="criadorComprarRoupas()" title="Comprar as peças novas e ${rotulo.toLowerCase()}">Comprar ${faltam.length === 1 ? "1 peça" : faltam.length + " peças"} · ${total.toLocaleString("pt-BR")} moedas</button>`;
}
async function criadorComprarRoupas() {
  const faltam = criadorFaltamRoupas(), total = faltam.reduce((t, f) => t + Number(f.preco || 0), 0);
  const saldo = Number(escritorio.base?.economia?.saldo || 0);
  const erro = document.getElementById("abr-erro");
  if (total > saldo) { escritorioAviso(`Faltam ${(total - saldo).toLocaleString("pt-BR")} VybeCoins para estas peças. Troque alguma peça ou junte mais moedas.`); return; }
  if (!confirm(`Comprar ${faltam.length === 1 ? "1 peça" : faltam.length + " peças"} por ${total.toLocaleString("pt-BR")} VybeCoins?`)) return;
  try {
    for (const f of faltam) {
      const r = await escritorioApi("comprar", { classe: f.classe, chave: crypto.randomUUID() });
      if (r.economia) escritorio.base.economia = { ...escritorio.base.economia, ...r.economia };
      criador.roupas.meus.push(f.classe);
    }
  } catch (e) { if (erro) erro.textContent = e.message; else escritorioAviso(e.message); await criadorCarregarRoupas(true); return; }
  renderAberturaEscritorio();
  if (criador.depoisDeComprar) criadorSeguir(criador.depoisDeComprar);
}
// Kits de roupa (Praia, Policial, Herói, Lobo…): provar e comprar com desconto.
function criadorSkinsHtml(fig) {
  const r = criador.roupas;
  if (!r?.ativo || !r.kits?.length) return "";
  const comKit = (k) => {
    const partes = new Map(fig.split(".").map((p) => [p.split("-")[0], p]));
    for (const c of k.classes) { const [t, id] = c.slice(6).split("-"); partes.set(t, `${t}-${id}-${partes.get(t)?.split("-")[2] || 110}`); }
    return [...partes.values()].join(".");
  };
  return `<section class="prov-vitrine" aria-label="Skins"><h3>Skins <small>kits com desconto</small></h3><div class="prov-vitrine-lista">${r.kits.map((k) => { const tem = k.classes.every((c) => r.meus.includes(c)); return `<article class="cri-skin"><div class="cri-skin-arte"><img alt="" width="64" height="110" loading="lazy" src="${safeText(criadorImagem(comKit(k), 2, "n", ""))}"></div><div class="cri-skin-texto"><b>${safeText(k.nome.replace(/^Skin\s+/i, ""))}</b><small>${tem ? "Você já tem" : `<s>${k.cheio.toLocaleString("pt-BR")}</s> ${k.preco.toLocaleString("pt-BR")} moedas`}</small><div><button type="button" onclick="criadorProvarKit('${safeText(k.chave)}')">Provar</button>${tem ? "" : `<button type="button" class="cri-skin-comprar" onclick="criadorComprarKit('${safeText(k.chave)}')">Comprar</button>`}</div></div></article>`; }).join("")}</div></section>`;
}
function criadorProvarKit(chave) {
  const k = criador.roupas?.kits?.find((x) => x.chave === chave);
  if (!k) return;
  for (const c of k.classes) { const [t, id] = c.slice(6).split("-"); const atuais = criador.f.partes[t]?.cores; criador.f.partes[t] = { id: Number(id), cores: atuais?.length ? atuais : [110] }; }
  renderAberturaEscritorio();
}
function criadorKitDasFaltas(faltam) {
  const c = new Set(faltam.map((f) => f.classe));
  return (criador.roupas?.kits || []).find((k) => k.classes.length === c.size && k.classes.every((x) => c.has(x))) || null;
}
// Compra o kit; com "eSeguir", salva (ou continua) logo depois, como o botão de baixo.
async function criadorComprarKit(chave, eSeguir = false) {
  const k = criador.roupas?.kits?.find((x) => x.chave === chave);
  if (!k || !confirm(`Comprar ${k.nome} por ${k.preco.toLocaleString("pt-BR")} VybeCoins?`)) return;
  try {
    const r = await escritorioApi("comprar-kit", { kit: chave, chave: crypto.randomUUID() });
    if (r.economia) escritorio.base.economia = { ...escritorio.base.economia, ...r.economia };
    await criadorCarregarRoupas(true);
    if (eSeguir && criador.depoisDeComprar) return criadorSeguir(criador.depoisDeComprar);
    criadorProvarKit(chave);
    escritorioAviso(`${k.nome} é sua. Salve o personagem para vestir.`);
  } catch (e) { escritorioAviso(e.message); }
}
// "Objeto na mão" em grade: o próprio boneco segurando cada objeto (a lista
// do sistema era longa e sem imagem; Paulo, 20/10/2026).
function criadorMaoHtml(fig) {
  const alvo = criador.destino ? "criador.destino.mao" : "criador.mao", atual = (criador.destino ? criador.destino.mao : criador.mao) || "";
  const nome = CRIADOR_MAOS.find(([v]) => v === atual)?.[1] || "Nada";
  return `<details class="cri-mao" ${criador.maoAberta ? "open" : ""} ontoggle="criador.maoAberta=this.open"><summary>Objeto na mão <b>${safeText(nome)}</b></summary>
<div class="cri-mao-grade" role="group" aria-label="Objeto na mão">${CRIADOR_MAOS.map(([v, r]) => `<button type="button" aria-pressed="${v === atual}" onclick="${alvo}='${v}';renderAberturaEscritorio()" title="${safeText(r)}"><img loading="lazy" alt="" width="64" height="110" src="${safeText(criadorImagem(fig, 2, "n", v))}"><span>${safeText(r)}</span></button>`).join("")}</div></details>`;
}
// Girar arrastando o boneco para os lados: um passo a cada 28 px.
function criadorGiroInicio(ev) {
  ev.preventDefault();
  const x0 = ev.clientX, d0 = criador.direcao;
  let ultimo = d0;
  const mover = (e) => {
    const d = (((d0 + Math.round((x0 - e.clientX) / 28)) % 8) + 8) % 8;
    if (d === ultimo) return;
    ultimo = d; criador.direcao = d;
    const img = document.querySelector("#ofc-abertura .cri-girar");
    if (img) img.src = criadorImagem(criadorFigura(criador.f), d, "l", (criador.destino ? criador.destino.mao : criador.mao) || "");
  };
  const fim = () => { removeEventListener("pointermove", mover); removeEventListener("pointerup", fim); renderAberturaEscritorio(); };
  addEventListener("pointermove", mover);
  addEventListener("pointerup", fim);
}
// Looks salvos (até 5, no perfil): trocar de visual num clique.
function criadorLooksHtml() {
  const looks = escritorio.perfil?.looks || [];
  const cabeca = (f) => "https://www.habbo.com/habbo-imaging/avatarimage?" + new URLSearchParams({ figure: f, direction: "2", head_direction: "3", headonly: "1", size: "n", gesture: "sml" });
  return `<div class="cri-looks" role="group" aria-label="Looks salvos"><span class="cri-looks-titulo">Looks salvos</span><div class="cri-looks-lista">${looks.map((l, i) => `<span class="cri-look"><button type="button" onclick="criadorUsarLook(${i})" aria-label="Usar o look ${i + 1}" title="Usar este look"><img alt="" width="40" height="40" src="${safeText(cabeca(l.figura))}"></button><button type="button" class="cri-look-tirar" onclick="criadorTirarLook(${i})" aria-label="Tirar o look ${i + 1}">×</button></span>`).join("")}${looks.length < 5 ? `<button type="button" class="cri-look-novo" onclick="criadorGuardarLook()" title="Guardar o visual de agora">＋</button>` : ""}</div></div>`;
}
async function criadorSalvarLooks(looks) {
  escritorio.perfil = { ...escritorio.perfil, looks };
  renderAberturaEscritorio();
  if (escritorio.base?.demo) return;
  try { escritorio.perfil = { ...escritorio.perfil, ...(await escritorioApi("perfil", { perfil: { ...escritorio.perfil, looks } })).perfil }; }
  catch (e) { escritorioAviso("Não deu para guardar o look: " + e.message); }
}
function criadorGuardarLook() {
  const novo = { figura: criadorFigura(criador.f), mao: criador.mao || "" };
  const looks = (escritorio.perfil?.looks || []).filter((l) => l.figura !== novo.figura || l.mao !== novo.mao);
  criadorSalvarLooks([...looks, novo].slice(-5));
}
function criadorTirarLook(i) { criadorSalvarLooks((escritorio.perfil?.looks || []).filter((_, k) => k !== i)); }
function criadorUsarLook(i) {
  const l = escritorio.perfil?.looks?.[i];
  if (!l) return;
  criador.f = criadorDaFigura(l.figura); criador.mao = l.mao || "";
  renderAberturaEscritorio();
}
function abrirAvatarDoClienteEscritorio() {
  const ag = escritorio.agenteAberto;
  if (!ag?.a) return;
  const a = ag.a;
  if (typeof closeWorkflowModal === "function") closeWorkflowModal();
  abrirAberturaEscritorio("personagem");
  criador.destino = { agente: a, cliente_id: a.cliente_id, nome: a.cliente, mao: escritorioMaoDoAgente(a) };
  criador.f = criadorDaFigura(ag.figura || escritorioFiguraDoAgente(a, 0));
  criador.nome = a.cliente;
  criadorCarregarCatalogo();
  renderAberturaEscritorio();
}
async function salvarAvatarDoClienteEscritorio(padrao = false) {
  const d = criador.destino;
  if (!d || criador.salvando) return;
  criador.salvando = true;
  const erro = document.getElementById("abr-erro");
  const figura = padrao ? "" : criadorFigura(criador.f), mao = padrao ? "" : d.mao || "";
  try {
    if (!escritorio.base?.demo) {
      const r = await fetch("/api/painel?area=planejamentos&acao=personagem", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "personagem", cliente_id: d.cliente_id, figura, mao }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "Não foi possível salvar o avatar.");
    }
    d.agente.personagem = figura ? { figura, mao: mao || null } : null;
    fecharAberturaEscritorio();
    if (typeof escritorioAviso === "function") escritorioAviso(padrao ? `${d.nome} voltou à fantasia da marca.` : `Avatar de ${d.nome} salvo.`);
    if (typeof escritorioOcuparOperacao === "function") escritorioOcuparOperacao();
  } catch (e) {
    if (erro) erro.textContent = e.message + " Tente de novo.";
  } finally {
    criador.salvando = false;
  }
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
// Provador (Paulo, 21/10/2026: "não mandei me surpreender na UI/UX?"): palco
// com o boneco no pedestal, trilho de partes com a peça vestida em cada uma,
// vitrine de skins, peças em cartões com a cor da raridade e a sacola com o
// que falta comprar. As regras (preço, grátis, compra) são as das skins.
// Altura da parte no boneco inteiro: o trilho recorta a miniatura ali.
const CRIADOR_FOCO = { ch: 52, cc: 52, ca: 40, cp: 55, wa: 66, lg: 80, sh: 96 };
function criadorRaridadeDaPeca(t, id) {
  const c = `roupa:${t}-${id}`, r = criador.roupas;
  if (!r?.ativo || criador.destino) return "";
  if (criadorPrecoRoupa(c) === 0) return "gratis";
  return r.pecas[c]?.[0] || "comum";
}
function criadorPainelHtml() {
  const f = criador.f, fig = criadorFigura(f);
  const aba = CRIADOR_ABAS.find((a) => a.t === criador.aba) || CRIADOR_ABAS[1];
  const tipo = criador.cat?.tipos[aba.t];
  const skins = Boolean(criador.roupas?.ativo) && !criador.destino;
  const filtro = skins ? criador.filtro || "todas" : "todas";
  const conjuntos = (tipo?.s || []).filter((s) => criadorServe(s, f.g)).filter((s) => {
    if (filtro === "todas") return true;
    const c = `roupa:${aba.t}-${s[0]}`, livre = criadorRoupaLivre(c), preco = criadorPrecoRoupa(c);
    return filtro === "gratis" ? preco === 0 : filtro === "minhas" ? livre && preco !== 0 : !livre;
  });
  const atual = f.partes[aba.t];
  const conjAtual = atual && criadorConjunto(aba.t, atual.id);
  const pal = criadorPaleta(aba.t);
  const reserva = () => `this.onerror=null;this.src='https://www.habboassets.com/imaging/avatar.png?figure='+encodeURIComponent(this.dataset.fig)+'&direction=3'`;
  const mao = (criador.destino ? criador.destino.mao : criador.mao) || "";
  const tile = (id, rotulo) => {
    const src = criadorMiniatura(aba.t, id, aba.cabeca);
    const fg = decodeURIComponent(new URL(src).searchParams.get("figure"));
    const rar = id === null ? "" : criadorRaridadeDaPeca(aba.t, id);
    return `<button type="button" class="cri-peca${aba.cabeca ? " cabeca" : ""}${rar ? " r-" + rar : ""}" aria-pressed="${id === null ? !atual : atual?.id === id}" onclick="criadorEscolher('${aba.t}', ${id})" aria-label="${rotulo}" title="${rotulo}"><img loading="lazy" src="${src}" data-fig="${safeText(fg)}" onerror="${reserva()}" alt="">${id === null ? "<span>Nenhum</span>" : criadorSeloRoupa(aba.t, id)}</button>`;
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
  // Brilho do pedestal: a peça mais rara vestida (laranja Vybe sem nenhuma).
  const ordem = ["comum", "raro", "muito_raro", "lendario"];
  const maisRara = skins ? Object.entries(f.partes).map(([t, p]) => criadorRaridadeDaPeca(t, p.id)).filter((r) => ordem.includes(r)).sort((a, b) => ordem.indexOf(b) - ordem.indexOf(a))[0] || "" : "";
  // Trilho: cada parte com a peça que está vestida (de longe se vê o visual).
  const trilho = CRIADOR_GRUPOS.map(([id, nome, abas]) => `<div class="prov-grupo"><span>${nome}</span>${CRIADOR_ABAS.filter((a) => abas.includes(a.t)).map((a) => {
    const p = f.partes[a.t];
    return `<button type="button" class="prov-parte${p ? " vestida" : ""}" aria-pressed="${a.t === aba.t}" onclick="criador.aba='${a.t}';criador.pagina=0;criador.corAtiva=0;renderAberturaEscritorio()" title="${a.nome}">${p && criador.cat ? `<img alt="" loading="lazy" style="--foco:${CRIADOR_FOCO[a.t] || 50}%" class="${a.cabeca ? "cabeca" : ""}" src="${safeText(criadorMiniatura(a.t, p.id, a.cabeca))}">` : '<i aria-hidden="true"></i>'}<small>${a.nome}</small></button>`;
  }).join("")}</div>`).join("");
  const saldo = escritorio.base?.economia?.disponivel ? Number(escritorio.base.economia.saldo || 0) : null;
  const faltam = criadorFaltamRoupas(), total = faltam.reduce((t, x) => t + Number(x.preco || 0), 0);
  const sacola = !faltam.length ? `<span class="prov-sacola-vazia">${skins ? "Tudo o que você está vestindo já é seu." : ""}</span>`
    : `<div class="prov-sacola-itens" aria-label="Peças a comprar">${faltam.map((x) => { const [t, id] = x.classe.slice(6).split("-"); return `<span class="prov-sacola-item" title="${safeText(CRIADOR_ABAS.find((a) => a.t === t)?.nome || t)} · ${x.preco} moedas"><img alt="" src="${safeText(criadorMiniatura(t, Number(id), true))}"><em>${x.preco}</em></span>`; }).join("")}</div><span class="prov-sacola-total"><small>Sacola</small><span><b>${total.toLocaleString("pt-BR")}</b> moedas</span>${saldo !== null && total > saldo ? `<i class="prov-falta">faltam ${(total - saldo).toLocaleString("pt-BR")}</i>` : ""}</span>`;
  const acoes = criador.destino
    ? '<button type="button" class="abr-secundario" onclick="salvarAvatarDoClienteEscritorio(true)" title="Volta à fantasia da marca definida pela Vybe">Voltar ao padrão</button><button type="button" class="abr-secundario" onclick="fecharAberturaEscritorio()">Cancelar</button><button type="button" class="abr-primario" onclick="salvarAvatarDoClienteEscritorio()">Salvar avatar</button>'
    : criador.so ? `<button type="button" class="abr-secundario" onclick="fecharAberturaEscritorio()">Cancelar</button>${criadorBotaoSalvar("salvar")}`
    : `<button type="button" class="abr-secundario" onclick="criador.etapa='cena';renderAberturaEscritorio()">Voltar</button>${criadorBotaoSalvar("continuar")}`;
  const itens = [...(aba.opcional ? [null] : []), ...conjuntos.map((c) => c[0])];
  const por = Math.max(12, criador.porPagina || 48), totalPag = Math.max(1, Math.ceil(itens.length / por));
  const pag = Math.min(criador.pagina || 0, totalPag - 1);
  criador.pagina = pag;
  const pagina = itens.slice(pag * por, pag * por + por);
  const chip = (id, nome) => `<button type="button" aria-pressed="${filtro === id}" onclick="criador.filtro='${id}';criador.pagina=0;renderAberturaEscritorio()">${nome}</button>`;
  return `${vybelandiaCenaHtml(true)}<div class="abr-vinheta" aria-hidden="true"></div>
<section class="abr-painel cri provador" aria-labelledby="abr-titulo">
 <div class="prov-topo">
  <div class="prov-titulo"><span class="abr-kicker">${criador.destino ? "Avatar do cliente no Escritório" : criador.so ? "Meu espaço" : "Passo 1 de 2"}</span><h2 id="abr-titulo">${criador.destino ? `Agente de ${safeText(criador.destino.nome)}` : "Provador"}</h2></div>
  <div class="cri-corpo prov-corpo" role="group" aria-label="Corpo">${["M", "F"].map((g) => `<button type="button" aria-pressed="${f.g === g}" onclick="criadorTrocarCorpo('${g}')">${g === "M" ? "Masculino" : "Feminino"}</button>`).join("")}</div>
  ${saldo !== null && !criador.destino ? `<span class="prov-carteira" title="Suas VybeCoins"><i aria-hidden="true"></i><b>${saldo.toLocaleString("pt-BR")}</b> moedas</span>` : ""}
 </div>
 <nav class="prov-trilho" aria-label="Partes do personagem">${trilho}</nav>
 <div class="abr-previa prov-palco${maisRara ? " brilho-" + maisRara : ""}">
  <div class="prov-holofote" aria-hidden="true"></div>
  <img src="${criadorImagem(fig, criador.direcao, "l", mao)}" alt="${criador.destino ? "Prévia do avatar do cliente" : "Prévia do seu personagem"}" width="128" height="220" class="cri-girar" title="Arraste para os lados para girar" onpointerdown="criadorGiroInicio(event)">
  <div class="prov-pedestal" aria-hidden="true"></div>
  <div class="abr-girar"><button type="button" onclick="criador.direcao=(criador.direcao+7)%8;renderAberturaEscritorio()" aria-label="Girar para a esquerda">↺</button><button type="button" onclick="criadorAleatorio()" class="cri-sorte">Aleatório</button><button type="button" onclick="criador.direcao=(criador.direcao+1)%8;renderAberturaEscritorio()" aria-label="Girar para a direita">↻</button></div>
  ${criadorMaoHtml(fig)}
  ${criador.destino ? "" : criadorLooksHtml()}
 </div>
 <div class="abr-opcoes cri-opcoes prov-armario">
  ${skins ? criadorSkinsHtml(fig) : ""}
  ${!criador.cat ? '<p class="abr-nota">Carregando o catálogo…</p>' : `
  <div class="prov-cabecalho"><h3>${aba.nome} <small>${conjuntos.length} ${conjuntos.length === 1 ? "opção" : "opções"}</small></h3>${skins ? `<div class="prov-filtros" role="group" aria-label="Filtrar peças">${chip("todas", "Todas")}${chip("gratis", "Grátis")}${chip("minhas", "Minhas")}${chip("venda", "À venda")}</div>` : ""}</div>
  ${pal.length && atual && nCores > 0 ? cores() : ""}
  <div class="cri-grade" onwheel="criadorRodaPagina(event)">${pagina.length ? pagina.map((id) => id === null ? tile(null, "Nenhum") : tile(id, aba.nome + " " + id)).join("") : `<p class="prov-vazio">Nenhuma peça ${filtro === "minhas" ? "comprada" : filtro === "gratis" ? "grátis" : "à venda"} nesta parte.</p>`}</div>
  ${totalPag > 1 ? `<nav class="cri-paginas" aria-label="Páginas"><button type="button" class="abr-secundario" onclick="criadorPagina(-1)" ${pag ? "" : "disabled"} aria-label="Página anterior">‹</button><span>Página ${pag + 1} de ${totalPag}</span><button type="button" class="abr-secundario" onclick="criadorPagina(1)" ${pag < totalPag - 1 ? "" : "disabled"} aria-label="Próxima página">›</button></nav>` : ""}`}
 </div>
 <div class="prov-sacola">
  <div class="prov-sacola-info">${criador.destino ? "" : sacola}<p class="abr-erro" role="alert" id="abr-erro"></p></div>
  <div class="abr-acoes">${acoes}</div>
 </div>
</section>`;
}
function escritorioPrecisaAbertura() {
  return Boolean(escritorio.base) && !escritorio.base.convidado && (escritorio.perfil?.abertura !== ESCRITORIO_ABERTURA || Boolean(escritorioMinhaMesa()) && !escritorio.perfil?.quarto_configurado);
}
function abrirAberturaEscritorio(etapa = "cena") {
  const eu = escritorio.base?.equipe.find((p) => p.id === escritorio.base.eu);
  // "Meu espaço" pede só o criador; a abertura completa termina nas boas-vindas.
  criador.so = ["personagem","espaco"].includes(etapa);
  criador.destino = null;
  criador.reforma=false; criador.andar=0; criador.limparPintura=false;
  // Quem acabou de passar pela Vybelândia no login vai direto ao personagem.
  criador.etapa = etapa === "cena" && window.VYBELANDIA_VISTA ? "personagem" : etapa;
  if(etapa === "cena" && escritorio.perfil?.abertura === ESCRITORIO_ABERTURA && escritorioMinhaMesa() && !escritorio.perfil.quarto_configurado) criador.etapa="planta";
  // Planta da primeira versão (legado) ou nenhuma: começa no Quadrado médio.
  criador.planta=escritorio.base?.quartos?.plantas?.some((p)=>p.id===escritorio.perfil?.sala_planta && !p.legado) ? escritorio.perfil.sala_planta : "quadrado-m";
  criador.modelo="trabalho";
  // Mantém a decoração atual só se ela couber na planta (regra do servidor).
  criador.preservar=criadorDecoracaoAtual().length>0 && criadorDecoracaoCabe(criador.planta);
  criador.erro="";
  criador.piso=escritorio.perfil?.sala_piso || "madeira";
  criador.parede=escritorio.perfil?.sala_parede || "#ff8a35";
  criador.f = criadorDaFigura(escritorio.perfil?.figura || mapaFigura(escritorio.perfil || {}));
  criador.mao = escritorio.perfil?.mao || "";
  criador.nome = String(eu?.nome || "").split(" ")[0] || "equipe";
  criadorCarregarCatalogo();
  criador.roupas = null;
  criadorCarregarRoupas();
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
function abrirReformaEscritorio(andar=0,branco=false) {
  // No modo construção (Paulo, 20/10/2026: "clico em aumentar ou reformar e
  // não acontece nada"): o aviso ficava atrás desta janela. Sem mudança, sai
  // da construção; com mudança, pergunta aqui mesmo.
  if(escritorio.edicao?.mudou) {criadorPerguntarEdicao(andar,branco);return;}
  if(escritorio.edicao) {escritorio.edicao.mudou=false;sairEditorEscritorio();}
  abrirAberturaEscritorio('planta');
  const raiz=escritorioRaizQuarto(escritorioMinhaMesa()?.ambiente.id), camada=raiz+(andar?'-andar-1':'');
  const perfil=escritorioPerfilDecoracao(camada);
  criador.reforma=true;criador.so=true;criador.andar=andar;
  criador.versao=escritorio.base.mapa?.camadas?.[camada]?.versao || 0;
  criador.planta=perfil?.sala_planta || 'quadrado-m';
  criador.piso=perfil?.sala_piso || 'madeira';criador.parede=perfil?.sala_parede || '#ff8a35';
  criador.modelo=branco?'vazio':'trabalho';criador.limparPintura=branco;
  criador.preservar=!branco && criadorDecoracaoAtual().length>0 && criadorDecoracaoCabe(criador.planta);
  renderAberturaEscritorio();
}
function criadorPerguntarEdicao(andar,branco) {
  const el=document.getElementById('ofc-abertura');
  if(!el) return;
  el.dataset.etapa='espaco';
  el.innerHTML=`<section class="abr-painel abr-quarto" role="alertdialog" aria-labelledby="abr-edicao-titulo"><span class="abr-kicker">Meu espaço</span><h2 id="abr-edicao-titulo">Você está decorando o quarto</h2><p class="abr-nota">A decoração tem mudanças que ainda não foram salvas. O que fazer com elas antes de reformar?</p><p class="abr-erro" role="alert" id="abr-erro"></p><div class="abr-acoes"><button type="button" class="abr-secundario" onclick="criador.etapa='espaco';renderAberturaEscritorio()">Voltar</button><button type="button" class="abr-secundario" onclick="escritorio.edicao.mudou=false;sairEditorEscritorio();abrirReformaEscritorio(${andar},${branco})">Descartar e reformar</button><button type="button" class="abr-primario" onclick="criadorSalvarEReformar(${andar},${branco})">Salvar e reformar</button></div></section>`;
  el.querySelector('.abr-primario')?.focus({preventScroll:true});
}
async function criadorSalvarEReformar(andar,branco) {
  await salvarEditorEscritorio();
  if(escritorio.edicao) {const erro=document.getElementById('abr-erro');if(erro) erro.textContent='Não deu para salvar a decoração. Confira o aviso no mapa e tente de novo.';return;}
  abrirReformaEscritorio(andar,branco);
}
// Meu espaço (Paulo, 21/10/2026: "reformula isso também, segue os princípios
// novos"): o boneco no pedestal abre o Provador, o térreo aparece numa prévia
// de verdade, o segundo andar tem cartão próprio e "em branco" fica à parte.
function criadorMeuEspacoHtml() {
  const perfil = escritorio.perfil || {};
  const segundo = perfil.sala_andares?.find((a) => a.andar === 1 && a.quarto_configurado);
  const planta = (id) => escritorio.base.quartos?.plantas.find((p) => p.id === id);
  const terreo = planta(perfil.sala_planta), andar2 = segundo && planta(segundo.sala_planta);
  const saldo = escritorio.base?.economia?.disponivel ? Number(escritorio.base.economia.saldo || 0) : null;
  const img = criadorImagem(mapaFigura(perfil), 2, "l", perfil.mao || "");
  const previa = terreo && escritorioMinhaMesa() ? `<div class="abr-previa-quarto ofc-mapa esp-previa" data-previa="${safeText([perfil.sala_planta, "atual", perfil.sala_piso || "madeira", perfil.sala_parede || "#ff8a35", ""].join("|"))}" aria-hidden="true"></div>` : '<div class="esp-previa esp-previa-vazia" aria-hidden="true"></div>';
  const noSegundo = escritorio.quarto?.endsWith("-andar-1");
  return `${vybelandiaCenaHtml(true)}<div class="abr-vinheta" aria-hidden="true"></div>
<section class="abr-painel espaco" aria-labelledby="esp-titulo">
 <div class="prov-topo"><div class="prov-titulo"><span class="abr-kicker">Meu espaço</span><h2 id="esp-titulo">Seu escritório, do seu jeito</h2></div>${saldo !== null ? `<span class="prov-carteira" title="Suas VybeCoins"><i aria-hidden="true"></i><b>${saldo.toLocaleString("pt-BR")}</b> moedas</span>` : ""}<button type="button" class="esp-fechar" onclick="fecharAberturaEscritorio()" aria-label="Fechar">×</button></div>
 <div class="esp-grade">
  <button type="button" class="esp-cartao esp-personagem" onclick="criador.etapa='personagem';renderAberturaEscritorio()">
   <span class="esp-palco" aria-hidden="true"><span class="prov-holofote"></span><img alt="" src="${safeText(img)}" width="128" height="220"><span class="prov-pedestal"></span></span>
   <span class="esp-texto"><b>Personagem</b><small>Roupas, cabelo, skins e o objeto na mão</small></span><span class="esp-acao primaria">Abrir o provador</span>
  </button>
  <button type="button" class="esp-cartao esp-quarto" onclick="abrirReformaEscritorio(0)">
   ${previa}
   <span class="esp-texto"><b>Térreo</b><small>${terreo ? safeText([terreo.nome, terreo.medidas].filter(Boolean).join(" · ")) : "Seu quarto"}</small></span><span class="esp-acao">Aumentar ou reformar</span>
  </button>
  <button type="button" class="esp-cartao esp-andar${segundo ? "" : " novo"}" onclick="abrirReformaEscritorio(1)">
   <span class="esp-icone" aria-hidden="true">${segundo ? escritorioIcone("mapa") : '<svg class="ofc-ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'}</span>
   <span class="esp-texto"><b>${segundo ? "Segundo andar" : "Criar segundo andar"}</b><small>${andar2 ? safeText([andar2.nome, andar2.medidas].filter(Boolean).join(" · ")) : "Uma cena própria, com formato e decoração independentes"}</small></span><span class="esp-acao">${segundo ? "Reformar" : "Criar"}</span>
  </button>
 </div>
 <div class="prov-sacola esp-rodape">
  <p class="esp-nota">Inventário, moedas, XP e conquistas continuam com você em qualquer reforma, sem gastar moedas.</p>
  <div class="abr-acoes"><button type="button" class="abr-secundario esp-branco" onclick="abrirReformaEscritorio(${noSegundo ? 1 : 0},true)" title="Guarda a mobília no inventário e limpa a pintura, depois de você confirmar">Começar ${noSegundo ? "o segundo andar" : "o térreo"} em branco</button><button type="button" class="abr-secundario" onclick="fecharAberturaEscritorio()">Fechar</button></div>
 </div>
</section>`;
}
function fecharAberturaEscritorio() {
  criador.destino = null;
  criadorDestruirPrevias();
  document.getElementById("ofc-abertura")?.remove();
}
function renderAberturaEscritorio() {
  const el = document.getElementById("ofc-abertura");
  if (!el) return;
  const fundo = document.getElementById("vybelandia-img")?.getAttribute("href") || "/assets/vybelandia.webp";
  el.style.setProperty("--vybelandia", `url("${fundo}")`);
  el.dataset.etapa = criador.etapa;
  if(criador.etapa === "espaco") {
    el.innerHTML=criadorMeuEspacoHtml();
    // A prévia do térreo usa a decoração salva do térreo, mesmo depois de uma reforma do segundo andar.
    const antes=[criador.reforma,criador.andar];criador.reforma=false;criador.andar=0;
    try {criadorMontarPrevias(el);} finally {[criador.reforma,criador.andar]=antes;}
    return;
  }
  if(criador.reforma && criador.etapa === "boas") {
    const planta=escritorio.base.quartos.plantas.find(p=>p.id===criador.planta);
    el.innerHTML=`<section class="abr-painel abr-quarto"><span class="abr-kicker">Revisar reforma · ${criador.andar?'segundo andar':'térreo'}</span><h2>Confirmar seu novo espaço</h2>${criadorPreviaHtml(criador.planta,criador.preservar?'atual':criador.modelo,{grande:true})}<p>${safeText(planta?.nome)} · ${safeText(planta?.medidas)}</p><p class="abr-nota">${criador.preservar?'Sua decoração será mantida nesta planta.':'A decoração anterior fica no histórico e os móveis comprados continuam no inventário.'} ${criador.limparPintura?'A pintura deste andar será limpa.':'O acabamento escolhido será aplicado.'} Moedas, XP, conquistas e o outro andar ficam preservados.</p><p class="abr-erro" role="alert" id="abr-erro"></p><div class="abr-acoes"><button type="button" class="abr-secundario" onclick="criador.etapa='acabamento';renderAberturaEscritorio()">Voltar</button><button type="button" class="abr-primario" onclick="salvarPersonagemEscritorio(false)">Confirmar reforma</button></div></section>`;criadorMontarPrevias(el);return;
  }
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
    // O provador redesenha a cada escolha: sem a entrada animada de novo e
    // com o trilho de partes onde estava.
    const trilho = el.querySelector(".prov-trilho"), rolagem = trilho ? [trilho.scrollTop, trilho.scrollLeft] : null;
    el.innerHTML = criadorPainelHtml();
    const painel = el.querySelector(".provador");
    if (rolagem && painel) { painel.classList.add("estavel"); const t = painel.querySelector(".prov-trilho"); if (t) [t.scrollTop, t.scrollLeft] = rolagem; }
    requestAnimationFrame(criadorMedirPagina);
    return;
  }
  criadorDestruirPrevias();
  if(["planta","mobilia","acabamento"].includes(criador.etapa)) {
    el.innerHTML=criadorQuartoHtml();
    criadorMontarPrevias(el);
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
 <p>Ganhe <b>VybeCoins e XP pelo que entrega</b>: cada função tem suas regras, e a sua ficha mostra a meta da semana e os últimos pontos. Os essenciais são gratuitos. A loja do editor mostra preços, raridades e a vitrine da semana. Montar seu primeiro quarto desbloqueia 50 moedas.</p>
 <p class="abr-erro" role="alert" id="abr-erro"></p>
 <div class="abr-acoes"><button type="button" class="abr-secundario" onclick="criador.etapa=escritorioMinhaMesa()&&!escritorio.perfil.quarto_configurado?'acabamento':'personagem';renderAberturaEscritorio()">Revisar escolhas</button><button type="button" class="abr-primario" onclick="salvarPersonagemEscritorio(true)">Entrar no escritório</button></div></div>
</section>`;
  el.querySelector(".abr-primario")?.focus({ preventScroll: true });
}
// Salva o boneco (e que a abertura foi vista). Ao fim da abertura, entra.
async function salvarPersonagemEscritorio(entrar) {
  if (criador.destino) return salvarAvatarDoClienteEscritorio();
  if (criador.salvando) return;
  criador.salvando = true;
  const botao = document.querySelector("#ofc-abertura .abr-primario");
  if (botao) botao.disabled = true;
  const erro = document.getElementById("abr-erro");
  const perfil = { ...escritorio.perfil, figura: criadorFigura(criador.f), mao: criador.mao || "", ...(criador.so ? {} : { abertura: ESCRITORIO_ABERTURA }) };
  try {
    let salvo = perfil;
    if(escritorioMinhaMesa() && (criador.reforma || !criador.so && !escritorio.perfil.quarto_configurado)) {
      let resultado;
      if(escritorio.base.demo) {
        const camada=escritorioRaizQuarto(escritorioMinhaMesa().ambiente.id)+(criador.andar?"-andar-1":"");
        const itens=criador.preservar ? criadorDecoracaoAtual() : criadorItensDaOpcao(criador.modelo, criador.planta);
        resultado={perfil:{...perfil,sala_planta:criador.planta,sala_piso:criador.piso,sala_parede:criador.parede,quarto_configurado:true},camada,mapa:{itens,versao:1,em:new Date().toISOString()},economia:escritorio.base.economia};
        if(criador.andar) resultado.perfil={...perfil,sala_andares:[{andar:1,sala_planta:criador.planta,sala_piso:criador.piso,sala_parede:criador.parede,quarto_configurado:true}]};
      } else resultado=await escritorioApi("quarto",{perfil:{...perfil,sala_piso:criador.piso,sala_parede:criador.parede},planta:criador.planta,modelo:criador.modelo,preservar:criador.preservar,reformar:criador.reforma===true,versao:criador.versao,andar:criador.andar || 0,limparPintura:criador.limparPintura===true});
      salvo=resultado.perfil;
      if(resultado.camada) escritorio.base.mapa.camadas[resultado.camada]=resultado.mapa;
      escritorio.base.economia=resultado.economia;
      escritorio.mapa?.destruir(); escritorio.mapa=null;
    } else if (!escritorio.base.demo) salvo = (await escritorioApi("perfil", { perfil })).perfil;
    escritorio.perfil = { ...escritorio.perfil, ...salvo };
    const eu = escritorio.base.equipe.find((p) => p.id === escritorio.base.eu);
    if (eu) eu.perfil = { ...eu.perfil, ...salvo };
    escritorioAplicarSalas();
    const reformada=criador.reforma ? escritorioRaizQuarto(escritorioMinhaMesa()?.ambiente.id)+(criador.andar?'-andar-1':'') : null;
    fecharAberturaEscritorio();
    if(reformada) {escritorio.quarto=null;escritorioEntrarNoQuarto(reformada);escritorioAviso('Reforma salva. Seu inventário e suas conquistas foram preservados.');return;}
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
    // O quarto não foi criado (decoração fora da planta, histórico ausente…):
    // volta para a escolha da mobília com o motivo, em vez de só avisar no fim.
    if (escritorioMinhaMesa() && (criador.reforma || !criador.so && !escritorio.perfil.quarto_configurado)) {
      criador.erro = e.message;
      criador.etapa = "mobilia";
      criador.salvando = false;
      renderAberturaEscritorio();
      return;
    }
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
// Decoração atual da própria sala (a camada salva, como o servidor a lê).
function criadorDecoracaoAtual() {
  const minha=escritorioMinhaMesa()?.ambiente.id;
  const camada=minha && escritorioRaizQuarto(minha)+(criador.reforma && criador.andar ? "-andar-1" : "");
  return camada ? escritorio.base?.mapa?.camadas?.[camada]?.itens || [] : [];
}
// Espelho da regra do servidor ao preservar a decoração (validarPisoQuarto
// sem medidas): cada móvel precisa estar num ladrilho da planta e fora da
// escada. Conferido aqui para avisar antes, não só na confirmação final.
function criadorDecoracaoCabe(plantaId, itens = criadorDecoracaoAtual()) {
  const p = escritorio.base?.quartos?.plantas?.find((q) => q.id === plantaId);
  if (!p) return false;
  return itens.every(([, x, y]) => {
    const tx = Math.floor(x), ty = Math.floor(y);
    if ((p.celdas[ty]?.[tx] ?? -1) < 0) return false;
    return !(p.escada || []).some(([ex, ey]) => ex === tx && ey === ty);
  });
}
// O quarto como vai ficar: a própria sala com a planta, o piso e a cor
// escolhidos, desenhada pelo mesmo renderizador do escritório.
function criadorAmbientePrevia(plantaId, piso, parede) {
  const base = escritorioMinhaMesa()?.ambiente || ESCRITORIO_PLANTA.ambientes.find((a) => a.pessoal);
  const dim = escritorioDimQuarto({ planta: plantaId });
  return { ...base, planta: plantaId, x1: base.x0 + dim.w, y1: base.y0 + dim.h, piso: ESCRITORIO_PLANTA.PISO[piso] ? piso : base.pisoPadrao || base.piso,
    cor: /^#[0-9a-f]{6}$/i.test(String(parede || "")) ? parede : base.corPadrao || base.cor, pintura: null,
    // A planta desenhada só continua valendo sobre a mesma planta base (como no servidor).
    celdasLivres: plantaId === base.planta ? base.celdasLivres || "" : "" };
}
// Modelo inicial na planta escolhida: feito para 8 × 8 e levado ao canto de
// baixo à direita de cada tamanho (o mesmo "deslocamento" do servidor).
function criadorItensDaOpcao(modeloId, plantaId = criador.planta) {
  if (modeloId === "atual") return criadorDecoracaoAtual();
  const a = criadorAncoraModelo(modeloId, plantaId);
  if (!a) return [];
  const [dx, dy] = a;
  return (escritorio.base?.quartos?.modelos?.find((m) => m.id === modeloId)?.itens || []).map(([c, x, y, ...r]) => [c, x + dx, y + dy, ...r]);
}
// Mesma regra do servidor (ancoraDoModelo): posição calculada por planta.
function criadorAncoraModelo(modeloId, plantaId = criador.planta) {
  const p = escritorio.base?.quartos?.plantas?.find((p) => p.id === plantaId);
  if (!p) return null;
  return p.ancoras ? p.ancoras[modeloId] || null : p.deslocamento || [0, 0];
}
// Marcador de prévia no HTML: data-previa="planta|modelo|piso|parede[|boneco]".
function criadorPreviaHtml(plantaId, modeloId, { grande = false, boneco = false } = {}) {
  return `<div class="abr-previa-quarto ofc-mapa${grande ? " grande" : ""}" data-previa="${safeText([plantaId, modeloId, criador.piso, criador.parede, boneco ? "eu" : ""].join("|"))}" aria-hidden="true"></div>`;
}
function criadorMontarPrevias(raiz) {
  criadorDestruirPrevias();
  if (typeof criarMapaEscritorio !== "function" || !escritorio.base?.quartos) return;
  criador.previas = [];
  for (const el of raiz.querySelectorAll("[data-previa]")) {
    const [plantaId, modeloId, piso, parede, boneco] = el.dataset.previa.split("|");
    const a = criadorAmbientePrevia(plantaId, piso, parede);
    const planta = { ...escritorioPlantaDoQuarto(a), moveis: [...criadorItensDaOpcao(modeloId, plantaId).map((it) => [...it.slice(0, 6)]), ...(escritorioPlantaDoQuarto(a).fixos || [])], rotulos: [], imagens: [], previa: true };
    try {
      const mapa = criarMapaEscritorio(el, { planta, eu: null });
      if (boneco) mapa.atualizarPessoas([{ id: "previa", nome: criador.nome, perfil: { figura: criadorFigura(criador.f) }, status: "disponivel", corStatus: "#3fbf7f",
        rotulo: criador.nome, statusTexto: "", x: planta.entrada.x, y: planta.entrada.y, acao: "std", mao: "", dir: a.porta === "direita" ? 2 : 4 }]);
      criador.previas.push(mapa);
    } catch (e) { console.warn("prévia do quarto:", e.message); }
  }
}
function criadorDestruirPrevias() {
  for (const m of criador.previas || []) { try { m.destruir(); } catch {} }
  criador.previas = [];
}
// Escolha em dois níveis: o formato (Quadrado, Em L…) e o tamanho dele
// (Pequeno a Enorme). Trocar de formato mantém o tamanho quando ele existe.
function criadorPlantasDoFormato(formato) {
  return (escritorio.base?.quartos?.plantas || []).filter((p) => !p.legado && p.formato === formato);
}
function criadorEscolherFormato(formato) {
  const opcoes = criadorPlantasDoFormato(formato);
  if (!opcoes.length) return;
  const tamanho = escritorio.base.quartos.plantas.find((p) => p.id === criador.planta)?.tamanho;
  criadorQuartoEscolher("planta", (opcoes.find((p) => p.tamanho === tamanho) || opcoes.find((p) => p.tamanho === "M") || opcoes[0]).id);
}
function criadorQuartoEscolher(campo,valor) {
  const catalogo=escritorio.base.quartos;
  if(campo==="planta"&&!catalogo.plantas.some(p=>p.id===valor)) return;
  if(campo==="modelo"&&valor!=="atual"&&!catalogo.modelos.some(p=>p.id===valor)) return;
  if(campo==="modelo") { criador.preservar = valor === "atual"; if (valor !== "atual") criador.modelo = valor; }
  else criador[campo]=valor;
  // Trocou de planta: a decoração atual só continua se couber na nova.
  if(campo==="planta") criador.preservar = criadorDecoracaoAtual().length>0 && criadorDecoracaoCabe(valor);
  criador.erro="";
  renderAberturaEscritorio();
}
// Atalhos de acabamento usam as mesmas escolhas e a mesma confirmação final.
function criadorAplicarPaleta(id) {
  const paleta = escritorio.base?.quartos?.paletas?.find((p) => p.id === id);
  if (!paleta) return;
  criador.piso = paleta.piso;
  criador.parede = paleta.parede;
  renderAberturaEscritorio();
}
function criadorQuartoHtml() {
 const catalogo=escritorio.base.quartos;
 if(!catalogo) return '<section class="abr-painel"><h2>Catálogo de quartos indisponível</h2><p>Recarregue o escritório para tentar novamente.</p></section>';
 const etapa=criador.etapa,planta=catalogo.plantas.find(p=>p.id===criador.planta);
 const atual=criadorDecoracaoAtual(), temAtual=atual.length>0, cabe=temAtual&&criadorDecoracaoCabe(criador.planta);
 const pisos = typeof ESCRITORIO_PISOS_SALA !== "undefined" ? ESCRITORIO_PISOS_SALA.filter(([id]) => id) : [["madeira","Madeira escura"],["clara","Madeira clara"],["concreto","Concreto"],["carpete","Carpete azul"],["preto","Preto"],["verde","Verde"],["marmore","Mármore"],["nogueira","Nogueira"]];
 const paredes = typeof ESCRITORIO_PAREDES_SALA !== "undefined" ? ESCRITORIO_PAREDES_SALA.filter(Boolean) : ["#ff8a35","#5aa9ff","#7ee08a","#b48cff","#e8e8ee","#8a8f9c"];
 const amostraPiso = (id) => { const c = ESCRITORIO_PLANTA.PISO[id]; return c ? `repeating-conic-gradient(${c[0]} 0 25%,${c[1]} 0 50%) 0 0/16px 16px` : "#333"; };
 let titulo,conteudo,anterior,proxima,nota="";
 if(etapa==="planta") {
  titulo="Escolha o tamanho e o formato";anterior=criador.reforma?"espaco":"personagem";proxima="mobilia";
  nota = temAtual ? "Você já tem uma decoração salva. Nas plantas em que ela cabe, você pode mantê-la; nas outras, ela fica guardada no histórico e você começa com um modelo." : "Comece pelo tamanho: de um espaço compacto a uma sala ampla. Depois escolha o formato. Nem todo formato tem os mesmos tamanhos; confira as medidas antes de continuar.";
  const formatos=[...new Map(catalogo.plantas.filter(p=>!p.legado).map(p=>[p.formato,p])).values()];
  const formatoAtual=planta?.formato || "quadrado";
  const tamanhos=criadorPlantasDoFormato(formatoAtual);
  const escolhaTamanho=`<div class="abr-escolha-atual"><b>${safeText(planta?.nome || "")} · ${safeText(planta?.tamanhoNome || "")}</b><span>${safeText(planta?.medidas || "")} · mudar o tamanho não custa moedas</span><small>Você pode reformar depois em Meu espaço. A prévia dos formatos abaixo acompanha o tamanho escolhido.</small></div><div class="abr-tamanhos" role="radiogroup" aria-label="Tamanho do quarto"><h3>Tamanho</h3>${tamanhos.map(p=>`<button type="button" role="radio" aria-checked="${p.id===criador.planta}" onclick="criadorQuartoEscolher('planta','${p.id}')"><b>${safeText(p.tamanhoNome)}</b><small>${safeText(p.medidas)}</small></button>`).join("")}</div>`;
  conteudo=`<p class="abr-nota">${nota}</p>${escolhaTamanho}<h3>Formato da planta</h3><div class="abr-quartos plantas">${formatos.map(f=>{
   // Prévia de cada formato no tamanho escolhido (ou no médio).
   const opcoes=criadorPlantasDoFormato(f.formato), p=f.formato===formatoAtual ? planta : (opcoes.find(o=>o.tamanho===planta?.tamanho) || opcoes.find(o=>o.tamanho==="M") || opcoes[0]);
   const ok = temAtual && criadorDecoracaoCabe(p.id);
   return `<button type="button" aria-pressed="${f.formato===formatoAtual}" onclick="criadorEscolherFormato('${f.formato}')">${criadorPreviaHtml(p.id, ok ? "atual" : "vazio")}<b>${safeText(p.nome)}</b><small>${safeText(p.medidas)} · ${safeText(p.dica)}</small>${temAtual ? `<em class="abr-cabe ${ok ? "sim" : "nao"}">${ok ? "Sua decoração cabe aqui" : "Sua decoração não cabe aqui"}</em>` : ""}</button>`;}).join("")}</div>`;
 } else if(etapa==="mobilia") {
  titulo="Em branco ou com o básico pronto?";anterior="planta";proxima="acabamento";
  // Trocou para uma planta onde o modelo escolhido não cabe: volta ao Essencial.
  if (!criador.preservar && !criadorAncoraModelo(criador.modelo)) criador.modelo = "trabalho";
  const opcoes = [];
  if (temAtual) opcoes.push(`<button type="button" aria-pressed="${criador.preservar}" ${cabe ? `onclick="criadorQuartoEscolher('modelo','atual')"` : "disabled"}>${criadorPreviaHtml(criador.planta, cabe ? "atual" : "vazio")}<b>Manter minha decoração</b><small>${cabe ? `Seus ${atual.length} móveis continuam onde estão.` : `Não cabe na planta ${safeText(planta?.nome || "")}: ela fica guardada no histórico e você começa com um modelo.`}</small></button>`);
  for (const m of catalogo.modelos.filter((m) => criadorAncoraModelo(m.id))) opcoes.push(`<button type="button" aria-pressed="${!criador.preservar && m.id===criador.modelo}" onclick="criadorQuartoEscolher('modelo','${m.id}')">${criadorPreviaHtml(criador.planta, m.id)}<b>${safeText(m.nome)}</b><small>${safeText(m.dica)}</small></button>`);
  conteudo=`${criador.erro ? `<p class="abr-erro abr-erro-quarto" role="alert">${safeText(criador.erro)}</p>` : ""}<p class="abr-nota">Os modelos iniciais são gratuitos${temAtual && !cabe ? ". Seus móveis de hoje vão para o seu inventário, para usar de novo no editor" : ""}.</p><div class="abr-quartos modelos">${opcoes.join("")}</div>`;
 } else {
  titulo="Dê a sua cara ao espaço";anterior="mobilia";proxima="boas";
  conteudo=`${criadorPreviaHtml(criador.planta, criador.preservar ? "atual" : criador.modelo, { grande: true, boneco: true })}
<div class="abr-paletas" role="group" aria-label="Combinações de acabamento">${(catalogo.paletas || []).map(p=>`<button type="button" aria-pressed="${criador.piso===p.piso && criador.parede===p.parede}" onclick="criadorAplicarPaleta('${p.id}')"><i aria-hidden="true" style="background:linear-gradient(135deg,${p.parede} 50%,${ESCRITORIO_PLANTA.PISO[p.piso]?.[0]} 50%)"></i><span><b>${safeText(p.nome)}</b><small>${safeText(p.dica)}</small></span></button>`).join("")}</div>
<div class="abr-acabamentos"><div class="abr-grupo"><h3>Piso</h3><div class="abr-amostras">${pisos.map(([id,nome])=>`<button type="button" aria-pressed="${criador.piso===id}" onclick="criador.piso='${id}';renderAberturaEscritorio()" aria-label="Piso ${safeText(nome)}"><i style="background:${amostraPiso(id)}"></i><span>${safeText(nome)}</span></button>`).join("")}</div></div>
<div class="abr-grupo"><h3>Paredes</h3><div class="abr-linha">${paredes.map((c)=>`<button type="button" class="abr-cor" style="--c:${c}" aria-pressed="${criador.parede===c}" onclick="criador.parede='${c}';renderAberturaEscritorio()" aria-label="Parede ${c}"></button>`).join("")}</div></div></div>
<p class="abr-nota">Depois de entrar, use <b>Decorar</b> no seu quarto para arrastar móveis, pintar cada ladrilho e abrir a loja. Sua escolha só é salva na confirmação final.</p>`;
 }
 return `<section class="abr-painel abr-quarto" aria-labelledby="abr-titulo"><span class="abr-kicker">Seu espaço · ${etapa==="planta"?'1 de 3':etapa==="mobilia"?'2 de 3':'3 de 3'}</span><h2 id="abr-titulo">${titulo}</h2>${conteudo}<div class="abr-acoes"><button type="button" class="abr-secundario" onclick="criador.etapa='${anterior}';renderAberturaEscritorio()">Voltar</button><button type="button" class="abr-primario" onclick="criador.etapa='${proxima}';renderAberturaEscritorio()">${etapa === "planta" ? `Continuar com ${safeText(planta?.tamanhoNome || "esta planta")}` : "Continuar"}</button></div></section>`;
}
