// vybe-escritorio-convidado.js — convidado no Escritório (Paulo, 20/10/2026).
// Quem recebe o link de uma pessoa da equipe entra sem conta: escreve o nome,
// escolhe um de quatro bonecos prontos e chega onde quem convidou estiver.
// Vê quem está online e anda pela sala de quem convidou e pelas áreas comuns.
// Nada do painel abre para o convidado; as travas de verdade estão no
// servidor (server/escritorio-convite.js) e no Worker.

// O link traz o convite no fragmento (#convite=…), que não vai ao servidor.
const CONVITE_LINK = (() => {
  try { return /(?:^#|&)convite=([A-Za-z0-9_.-]{20,2000})/.exec(location.hash)?.[1] || ""; } catch { return ""; }
})();
// Com o convidado na tela, as chamadas do Escritório vão para a área dele.
window.ESCRITORIO_CONVIDADO = false;

function limparLinkDoConvite() {
  try { history.replaceState(null, "", location.origin + location.pathname + location.search); } catch { /* segue */ }
}
async function convidadoPedir(acao, corpo) {
  const r = await fetch("/api/painel?area=convite&acao=" + encodeURIComponent(acao), {
    method: corpo ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
    headers: corpo ? { "Content-Type": "application/json" } : {},
    body: corpo ? JSON.stringify({ ...corpo, acao }) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || `Não deu para entrar agora (${r.status}).`), { status: r.status });
  return d;
}

// Chamado pelo vybe-init.js antes do login: devolve true se a tela é do convidado.
async function convidadoAntesDoLogin() {
  const sessao = typeof consultarSessao === "function" ? await consultarSessao().catch(() => null) : null;
  // Quem é da equipe e abriu um link de convite segue para o próprio painel.
  if (sessao) { if (CONVITE_LINK) limparLinkDoConvite(); return false; }
  if (CONVITE_LINK) { await abrirBoasVindasConvidado(); return true; }
  // Recarregou a página depois de entrar: o crachá está no cookie.
  try { entrarComoConvidado(await convidadoPedir("entrada")); return true; } catch { return false; }
}

// Boas-vindas: a mesma Vybelândia da entrada da equipe, com o convite.
const convidadoEscolha = { nome: "", boneco: 0, bonecos: [], anfitriao: "" };
async function abrirBoasVindasConvidado() {
  document.body.classList.add("auth-pending");
  document.getElementById("loading")?.classList.remove("show");
  let gate = document.getElementById("login-gate");
  if (!gate) { gate = document.createElement("div"); gate.id = "login-gate"; document.body.append(gate); }
  gate.className = "login-vybelandia convite-gate";
  gate.dataset.etapa = "cena";
  setTimeout(() => gate.classList.add("abr-pronta"), 2500);
  gate.style.setProperty("--vybelandia", `url("${document.getElementById("vybelandia-img")?.getAttribute("href") || "/assets/vybelandia.webp"}")`);
  const fundo = `${typeof vybelandiaCenaHtml === "function" ? vybelandiaCenaHtml() : '<div class="abr-cena" aria-hidden="true"></div>'}<div class="abr-luz" aria-hidden="true"></div><div class="abr-vinheta" aria-hidden="true"></div>`;
  gate.innerHTML = `${fundo}<div class="abr-texto convite-chegada" role="status">Abrindo o convite…</div>`;
  try {
    const d = await convidadoPedir("abrir", { token: CONVITE_LINK });
    Object.assign(convidadoEscolha, { bonecos: d.bonecos || [], anfitriao: d.anfitriao?.nome || "a equipe" });
    gate.innerHTML = fundo + convidadoBoasVindasHtml(d);
    gate.querySelector("#convite-nome")?.focus({ preventScroll: true });
  } catch (e) {
    gate.innerHTML = `${fundo}<div class="abr-texto convite-chegada"><span class="abr-kicker">Vybe OS · convite</span><h1 class="login-cidade">Este convite não abre mais</h1><p>${safeText(e.message)}</p></div>`;
  }
}
function convidadoBoasVindasHtml(d) {
  const quem = safeText(String(convidadoEscolha.anfitriao).split(" ")[0]);
  const expira = d.expira ? new Date(d.expira).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  const bonecos = convidadoEscolha.bonecos.map((b, i) => `<label class="convite-boneco"><input type="radio" name="convite-boneco" value="${i}"${i === convidadoEscolha.boneco ? " checked" : ""} onchange="convidadoEscolha.boneco=${i}"><img alt="" width="64" height="110" src="${safeText(mapaAvatarUrl(b.figura, 2, "wav", "", 0))}"><span>${safeText(b.rotulo)}</span></label>`).join("");
  return `<form class="abr-texto convite-chegada convite-form" onsubmit="event.preventDefault();entrarComConvite(this)">
<span class="abr-kicker">Vybe OS · convite</span>
<h1 class="login-cidade"><b>${quem}</b> te chamou para a <b>Vybelândia</b></h1>
<p>O escritório da Vybe é uma cidade. Escreva seu nome, escolha como quer aparecer e você entra direto onde ${quem} está.</p>
<label class="convite-campo"><span>Seu nome</span><input id="convite-nome" name="nome" required minlength="2" maxlength="40" autocomplete="name" value="${safeText(convidadoEscolha.nome)}" oninput="convidadoEscolha.nome=this.value"></label>
<fieldset class="convite-bonecos"><legend>Como você quer aparecer</legend>${bonecos}</fieldset>
<p class="convite-erro" id="convite-erro" role="alert"></p>
<button type="submit" class="abr-primario">Entrar</button>
<small class="convite-nota">Você entra como convidado: vê quem está online e anda pela sala de ${quem} e pelas áreas comuns. A conversa por voz é na sala de ${quem}.${expira ? ` O convite vale até ${expira}.` : ""}</small>
</form>`;
}
async function entrarComConvite(form) {
  const erro = form.querySelector("#convite-erro"), botao = form.querySelector("button[type=submit]");
  erro.textContent = "";
  botao.disabled = true; botao.textContent = "Entrando…";
  try {
    const base = await convidadoPedir("entrar", { token: CONVITE_LINK, nome: convidadoEscolha.nome || form.nome.value, boneco: convidadoEscolha.boneco });
    document.getElementById("login-gate")?.remove();
    entrarComoConvidado(base);
  } catch (e) {
    erro.textContent = e.message;
    botao.disabled = false; botao.textContent = "Entrar";
  }
}

function entrarComoConvidado(base) {
  limparLinkDoConvite();
  window.ESCRITORIO_CONVIDADO = true;
  window.VYBELANDIA_VISTA = true;
  document.getElementById("login-gate")?.remove();
  document.body.classList.remove("auth-pending");
  document.body.classList.add("modo-convidado");
  document.getElementById("loading")?.classList.remove("show");
  document.getElementById("mode-gate")?.classList.remove("open");
  escritorio.base = base;
  escritorio.convidadoChegou = false;
  escritorioChegar();
  if (typeof switchBoard === "function") switchBoard("escritorio", document.getElementById("btn-board-escritorio"));
  else abrirEscritorio();
}

// Pode ir para esta cena? Praça e as zonas do convite.
function convidadoPodeIr(id) {
  if (!window.ESCRITORIO_CONVIDADO) return true;
  if (!id || id === "praca" || id === "geral") return true;
  return (escritorio.base?.convidado?.zonas || []).includes(String(id));
}
// Chegou a lista de quem está online: na primeira vez, vai para onde quem
// convidou está (se pode); quem convidou recebe o aviso de que chegou.
function convidadoPresenca(antes, depois) {
  const c = escritorio.base?.convidado;
  if (c && !escritorio.convidadoChegou) {
    escritorio.convidadoChegou = true;
    const anfitriao = depois.find((p) => String(p.id) === String(c.anfitriao.id));
    const destino = anfitriao?.zona && convidadoPodeIr(anfitriao.zona) ? anfitriao.zona : c.salaAnfitriao && convidadoPodeIr(c.salaAnfitriao) ? c.salaAnfitriao : "recepcao";
    if (destino !== escritorio.quarto) setTimeout(() => escritorioEntrarNoQuarto(destino), 300);
    escritorioAviso(anfitriao ? `${c.anfitriao.nome.split(" ")[0]} está ${anfitriao.zona === destino ? "aqui" : "em outro lugar"}. ${c.vozes.includes(destino) ? "A conversa por voz já está aberta." : `Para conversar por voz, vá à sala de ${c.anfitriao.nome.split(" ")[0]}.`}` : `${c.anfitriao.nome.split(" ")[0]} ainda não está no escritório. Você espera na sala dele.`);
    return;
  }
  if (c || !antes?.length) return;
  const eu = String(escritorio.base?.eu || "");
  const ja = new Set(antes.map((p) => p.id));
  for (const p of depois) if (p.convidado && !ja.has(p.id) && String(p.anfitriao) === eu) {
    escritorioTocar(740, 0.15, 0.06); setTimeout(() => escritorioTocar(988, 0.15, 0.06), 160);
    escritorioAviso(`${p.nome}, seu convidado, chegou ao escritório.`);
  }
}
// Some do que é só da equipe (a lista de salas mostra só as permitidas).
function convidadoPodarTela() {
  if (!window.ESCRITORIO_CONVIDADO) return;
  for (const b of document.querySelectorAll("#painel-escritorio [onclick*='escritorioIrParaAmbiente('], #painel-escritorio [onclick*='escritorioEntrarNoQuarto(']")) {
    const id = /(?:escritorioIrParaAmbiente|escritorioEntrarNoQuarto)\('([^']+)'/.exec(b.getAttribute("onclick") || "")?.[1];
    if (id && !convidadoPodeIr(id)) b.remove();
  }
}

// Quem é da equipe convida para a própria sala: o link vale 12 horas.
async function convidarParaMinhaSalaEscritorio() {
  let d;
  try { d = await escritorioApi("convite", {}); }
  catch (e) { escritorioAviso(e.message); return; }
  let dlg = document.getElementById("office-convite");
  if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "office-convite"; dlg.className = "ofc-dialogo ofc-convite"; document.body.append(dlg); }
  const hora = new Date(d.expira).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  dlg.innerHTML = `<form method="dialog" class="ofc-convite-corpo"><h2>Convidar para a sua sala</h2>
<p>Quem abrir este link entra como convidado: escolhe um boneco, chega onde você estiver e conversa com você por voz na sua sala. Não vê nada do painel.</p>
<label class="ofc-convite-link"><span>Link do convite · vale até ${safeText(hora)}</span><input readonly value="${safeText(d.link)}" onfocus="this.select()"></label>
<p class="ofc-nota" id="office-convite-status" role="status"></p>
<div class="ofc-fm-acoes"><button type="button" class="ofc-secundario" onclick="cancelarConvitesEscritorio()">Cancelar todos os convites</button><button type="submit" class="ofc-secundario">Fechar</button><button type="button" class="ofc-primario" onclick="copiarConviteEscritorio()">Copiar link</button></div></form>`;
  dlg.showModal();
  copiarConviteEscritorio();
}
async function copiarConviteEscritorio() {
  const campo = document.querySelector("#office-convite input"), status = document.getElementById("office-convite-status");
  if (!campo) return;
  try { await navigator.clipboard.writeText(campo.value); if (status) status.textContent = "Link copiado. Mande pelo WhatsApp ou e-mail."; }
  catch { campo.select(); if (status) status.textContent = "Selecione o link e copie (⌘C)."; }
}
async function cancelarConvitesEscritorio() {
  const status = document.getElementById("office-convite-status");
  if (!confirm("Cancelar todos os convites que você mandou? Quem entrou por eles sai do escritório.")) return;
  try { await escritorioApi("convite-cancelar", {}); document.getElementById("office-convite")?.close(); escritorioAviso("Convites cancelados. Para chamar alguém de novo, gere um link novo."); }
  catch (e) { if (status) status.textContent = e.message; }
}
