// vybe-roteiros.js — Biblioteca de roteiros na Produção (decisão do Paulo,
// 21/10/2026: "pegar todos roteiros que já foram criados em cada cliente...
// manter organizado por período... ver quais conteúdos geraram e estão
// cadastrados daqueles docs"; docs/captacao-plano.md, etapa 2). O roteiro fica
// no Google Docs; aqui cada doc aparece por mês, com o cliente, as peças que ele
// descreve e os conteúdos do painel que saíram dele. As regras ficam no
// servidor (server/roteiros.js); esta tela só mostra e pede.
const ROT = { lista: null, clientes: [], erro: "", carregando: false, cliente: "", busca: "", abertos: new Set() };

async function rotPedir(params, corpo) {
  const r = await fetch(`/api/painel?area=roteiros${params ? "&" + params : ""}`, corpo
    ? { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }
    : { credentials: "same-origin", cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || "Não foi possível falar com o painel.");
  return d;
}
async function rotCarregar() {
  if (ROT.carregando) return;
  ROT.carregando = true;
  try { const d = await rotPedir(""); ROT.lista = d.roteiros || []; ROT.clientes = d.clientes || []; ROT.erro = ""; }
  catch (e) { ROT.erro = e.message; }
  finally { ROT.carregando = false; if (typeof renderProductionCommand === "function") renderProductionCommand(); }
}
function rotRecarregar() { ROT.lista = null; if (typeof renderProductionCommand === "function") renderProductionCommand(); }

const rotDia = (iso) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "";
const rotMes = (iso) => { const t = new Date(`${iso.slice(0, 7)}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const rotPlural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function rotFiltrados() {
  const busca = ROT.busca.trim().toLowerCase();
  return (ROT.lista || []).filter((r) => (!ROT.cliente || (ROT.cliente === "sem" ? !r.cliente_id : r.cliente_id === ROT.cliente))
    && (!busca || `${r.titulo} ${r.cliente || ""} ${(r.pecas || []).join(" ")}`.toLowerCase().includes(busca)));
}

function rotConteudoHtml(c, { acao = "" } = {}) {
  const dia = c.veiculacao || c.prazo, sugerido = acao && c.sugerido && !c.ligado;
  return `<li class="rot-conteudo${sugerido ? " sugerido" : ""}">${acao}<span class="rot-conteudo-texto"><b>${safeText(c.titulo)}</b><small>${[c.formato, dia ? `vai ao ar ${rotDia(dia)}` : "", sugerido ? "parece deste roteiro" : ""].filter(Boolean).map(safeText).join(" · ")}</small></span>
    ${c.status ? `<span class="rot-status" style="--cor:${safeText(c.status_cor || "#9aa1b2")}">${safeText(c.status)}</span>` : ""}</li>`;
}

function rotCartaoHtml(r) {
  const n = r.conteudos.length, aberto = ROT.abertos.has(r.id);
  return `<details class="rot-cartao"${aberto ? " open" : ""} ontoggle="ROT.abertos[this.open?'add':'delete']('${r.id}')">
    <summary><span class="rot-icone">${vbIcone("documento")}</span>
      <span class="rot-cartao-texto"><b>${safeText(r.titulo)}</b><small>${[r.cliente || "sem cliente", rotDia(r.criado_em), r.pecas.length ? rotPlural(r.pecas.length, "peça", "peças") : ""].filter(Boolean).map(safeText).join(" · ")}</small></span>
      ${n ? `<span class="capt-chip ok">${rotPlural(n, "conteúdo", "conteúdos")}</span>` : '<span class="capt-chip atencao">nenhum conteúdo ligado</span>'}</summary>
    <div class="rot-corpo">
      <section><h6>Peças do roteiro</h6>${r.pecas.length ? `<ol>${r.pecas.map((p) => `<li>${safeText(p)}</li>`).join("")}</ol>` : '<p class="rot-discreto">As peças estão no doc.</p>'}</section>
      <section><h6>Conteúdos que saíram dele</h6>${n ? `<ul>${r.conteudos.map((c) => rotConteudoHtml(c)).join("")}</ul>` : '<p class="rot-discreto">Ligue os conteúdos cadastrados a partir deste roteiro para ver o que ele gerou.</p>'}</section>
      <div class="rot-acoes"><a class="vb-botao" href="${safeText(r.link)}" target="_blank" rel="noopener">Abrir no Docs</a>
        <button type="button" class="vb-botao principal" onclick="rotAbrirLigar('${r.id}')">Ligar conteúdos</button>
        <button type="button" class="vb-link" onclick="rotAbrirEditar('${r.id}')">Editar</button></div>
    </div></details>`;
}

function rotListaHtml() {
  const lista = rotFiltrados();
  if (!(ROT.lista || []).length) return vbEstadoHtml({ titulo: "Nenhum roteiro ainda", texto: "Inclua o link de um roteiro do Google Docs ou busque os roteiros da pasta da Vybe no Drive.", icone: "documento", acao: '<button type="button" class="vb-botao principal" onclick="rotAbrirIncluir()">Incluir roteiro</button>' });
  if (!lista.length) return vbEstadoHtml({ titulo: "Nenhum roteiro com esse filtro", texto: "Troque o cliente ou a busca.", icone: "documento" });
  const meses = [...new Set(lista.map((r) => r.criado_em.slice(0, 7)))];
  return meses.map((m) => { const doMes = lista.filter((r) => r.criado_em.startsWith(m));
    return `<section class="rot-mes"><h5>${safeText(rotMes(m))} <small>${rotPlural(doMes.length, "roteiro", "roteiros")}</small></h5><div class="rot-grade">${doMes.map(rotCartaoHtml).join("")}</div></section>`; }).join("");
}

function roteirosHtml() {
  if (!ROT.lista && !ROT.erro) { rotCarregar(); return vbEstadoHtml({ tipo: "carregando", titulo: "Carregando os roteiros" }); }
  if (ROT.erro) return vbEstadoHtml({ tipo: "erro", titulo: "Não deu para abrir os roteiros", texto: ROT.erro, acao: '<button type="button" class="vb-botao" onclick="ROT.erro=\'\';rotRecarregar()">Tentar de novo</button>' });
  // Direção V2 (prancha V2-M-Agenda-Roteiros): no computador, o esqueleto novo (rotv2Html, no fim deste arquivo).
  if (typeof agv2Ligado === "function" && agv2Ligado()) return rotv2Html();
  const lista = ROT.lista || [];
  const semConteudo = lista.filter((r) => !r.conteudos.length).length, semCliente = lista.filter((r) => !r.cliente_id).length;
  const ligados = new Set(lista.flatMap((r) => r.conteudos.map((c) => c.id))).size;
  const resumo = vbResumoHtml([
    { valor: lista.length, rotulo: lista.length === 1 ? " roteiro" : " roteiros" },
    { valor: ligados, rotulo: ligados === 1 ? " conteúdo saiu deles" : " conteúdos saíram deles", tom: ligados ? "ok" : "" },
    { valor: semConteudo, rotulo: " sem conteúdo ligado", tom: semConteudo ? "atencao" : "" },
    semCliente ? { valor: semCliente, rotulo: " sem cliente", tom: "atencao", onclick: "ROT.cliente='sem';renderProductionCommand()" } : null,
  ]);
  // Só os clientes que têm roteiro, do que tem mais para o que tem menos.
  const contagem = new Map();
  for (const r of lista) if (r.cliente_id) contagem.set(r.cliente_id, { nome: r.cliente, n: (contagem.get(r.cliente_id)?.n || 0) + 1 });
  const chip = (id, nome, n) => `<button type="button" class="vb-chip" aria-pressed="${ROT.cliente === id}" onclick="ROT.cliente='${safeText(id)}';renderProductionCommand()">${safeText(nome)}${n !== null ? ` <b>${n}</b>` : ""}</button>`;
  const chips = [chip("", "Todos", lista.length), ...[...contagem].sort((a, b) => b[1].n - a[1].n || a[1].nome.localeCompare(b[1].nome, "pt-BR")).map(([id, c]) => chip(id, c.nome, c.n)), semCliente ? chip("sem", "Sem cliente", semCliente) : ""].join("");
  return `<div class="rot">
    <div class="rot-topo">${resumo}<div class="rot-botoes"><button type="button" class="vb-botao" onclick="rotBuscarDrive(this)">Buscar no Drive</button><button type="button" class="vb-botao principal" onclick="rotAbrirIncluir()">Incluir roteiro</button></div></div>
    <div class="rot-filtros"><label class="capt-busca"><span class="sr-only">Buscar roteiro</span><input type="search" placeholder="Buscar roteiro ou peça" value="${safeText(ROT.busca)}" oninput="ROT.busca=this.value;const l=document.getElementById('rot-lista');if(l)l.innerHTML=rotListaHtml()"></label>
      <div class="rot-chips" role="group" aria-label="Cliente">${chips}</div></div>
    <div id="rot-lista">${rotListaHtml()}</div></div>`;
}

function rotOpcoesClientes(atual = "") {
  return `<option value="">Sem cliente</option>${ROT.clientes.map((c) => `<option value="${safeText(c.id)}"${c.id === atual ? " selected" : ""}>${safeText(c.nome)}</option>`).join("")}`;
}
function rotAbrirIncluir() {
  abrirJanelaV2(`${vbjTopoHtml({ titulo: "Incluir roteiro", sub: "Agenda · biblioteca de roteiros" })}
    <form class="vbp-form" onsubmit="event.preventDefault();rotIncluir(this)">
      <p class="vbp-dica">Cole o link do roteiro no Google Docs. Se o doc estiver na pasta da Vybe no Drive, o painel lê as peças sozinho.</p>
      <label>Link do Google Docs<input name="link" required inputmode="url" placeholder="https://docs.google.com/document/d/…"></label>
      <label>Nome<input name="titulo" required maxlength="300" placeholder="Ex.: Roteiros Hellen Rocha – novembro"></label>
      <label>Cliente<select name="cliente_id">${rotOpcoesClientes(ROT.cliente && ROT.cliente !== "sem" ? ROT.cliente : "")}</select></label>
      <p class="vbp-erro" role="alert" hidden></p>
      <div class="vbj-pe"><span class="vbj-esp"></span><button type="button" class="vbj-btn" onclick="closeWorkflowModal()">Cancelar</button><button type="submit" class="vbj-btn k">Incluir</button></div>
    </form>`, "vbp");
}
async function rotIncluir(form) {
  const f = new FormData(form), erro = form.querySelector(".vbp-erro"), botao = form.querySelector("[type=submit]");
  botao.disabled = true; botao.textContent = "Incluindo…";
  try {
    const r = await rotPedir("", { acao: "incluir", link: f.get("link"), titulo: f.get("titulo"), cliente_id: f.get("cliente_id") });
    closeWorkflowModal();
    showToast(r.avisos?.[0] || "Roteiro incluído.", r.avisos?.length ? "info" : "ok", 7000);
    ROT.abertos.add(r.id); rotRecarregar();
  } catch (e) { erro.textContent = e.message; erro.hidden = false; botao.disabled = false; botao.textContent = "Incluir"; }
}
function rotAbrirEditar(id) {
  const r = (ROT.lista || []).find((x) => x.id === id);
  if (!r) return;
  abrirJanelaV2(`${vbjTopoHtml({ titulo: "Editar roteiro", sub: "Agenda · biblioteca de roteiros" })}
    <form class="vbp-form" onsubmit="event.preventDefault();rotEditar(this,'${id}')">
      <label>Nome<input name="titulo" required maxlength="300" value="${safeText(r.titulo)}"></label>
      <label>Cliente<select name="cliente_id">${rotOpcoesClientes(r.cliente_id || "")}</select></label>
      <p class="vbp-erro" role="alert" hidden></p>
      <div class="vbj-pe"><button type="button" class="vbj-btn vbj-txt vbj-perigo" onclick="rotEditar(this.form,'${id}',true)">${vbjIcone("lixo", 14)}Tirar da biblioteca</button><span class="vbj-esp"></span><button type="button" class="vbj-btn" onclick="closeWorkflowModal()">Cancelar</button><button type="submit" class="vbj-btn k">Salvar</button></div>
    </form>`, "vbp");
}
async function rotEditar(form, id, remover = false) {
  if (remover && !await confirmarNoPainel("Tirar este roteiro da biblioteca? O doc continua no Google Docs.")) return;
  const f = new FormData(form), erro = form.querySelector(".vbp-erro");
  try {
    await rotPedir("", remover ? { acao: "editar", id, remover: true } : { acao: "editar", id, titulo: f.get("titulo"), cliente_id: f.get("cliente_id") });
    closeWorkflowModal(); showToast(remover ? "Roteiro tirado da biblioteca." : "Roteiro salvo.", "ok"); rotRecarregar();
  } catch (e) { erro.textContent = e.message; erro.hidden = false; }
}
async function rotBuscarDrive(botao) {
  botao.disabled = true; botao.textContent = "Buscando…";
  try {
    const r = await rotPedir("", { acao: "drive" });
    showToast(r.novos.length ? `${rotPlural(r.novos.length, "roteiro novo", "roteiros novos")} do Drive.` : "Nenhum roteiro novo na pasta da Vybe no Drive.", r.novos.length ? "ok" : "info", 6000);
    if (r.novos.length) rotRecarregar(); else { botao.disabled = false; botao.textContent = "Buscar no Drive"; }
  } catch (e) { showToast(e.message, "err", 6000); botao.disabled = false; botao.textContent = "Buscar no Drive"; }
}

// Ligar: os conteúdos do cliente perto da data do roteiro, os que parecem ter
// saído dele primeiro; a busca acha qualquer outro pelo nome.
let ROT_LIGAR = { id: "", lista: [], mudou: false, pedido: 0 };
function rotAbrirLigar(id) {
  const r = (ROT.lista || []).find((x) => x.id === id);
  if (!r) return;
  ROT_LIGAR = { id, lista: [], mudou: false, pedido: 0 };
  openWorkflowModal(`<div class="workflow-kicker"><span>${safeText(r.cliente || "Sem cliente")}</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="rotFecharLigar()">×</button></div>
    <h2 class="workflow-title">Conteúdos de "${safeText(r.titulo)}"</h2>
    <p class="workflow-copy">Marque os conteúdos cadastrados a partir deste roteiro. Os que parecem ter saído dele vêm primeiro.</p>
    <label class="capt-busca rot-ligar-busca"><span class="sr-only">Buscar conteúdo</span><input type="search" placeholder="Buscar conteúdo pelo nome" oninput="clearTimeout(this._t);this._t=setTimeout(()=>rotCandidatos(this.value),250)"></label>
    <div id="rot-candidatos" class="rot-candidatos">${vbEstadoHtml({ tipo: "carregando", titulo: "Procurando conteúdos" })}</div>
    <div class="workflow-actions"><button type="button" class="workflow-primary" onclick="rotFecharLigar()">Pronto</button></div>`);
  rotCandidatos("");
}
async function rotCandidatos(busca) {
  const caixa = () => document.getElementById("rot-candidatos"), pedido = ++ROT_LIGAR.pedido;
  try {
    const d = await rotPedir(`acao=candidatos&roteiro=${encodeURIComponent(ROT_LIGAR.id)}&busca=${encodeURIComponent(busca || "")}`);
    if (pedido !== ROT_LIGAR.pedido || !caixa()) return;
    ROT_LIGAR.lista = d.candidatos || [];
    caixa().innerHTML = ROT_LIGAR.lista.length ? `<ul>${ROT_LIGAR.lista.map((c) => rotConteudoHtml(c, { acao: `<label class="capt-gravado"><input type="checkbox" ${c.ligado ? "checked" : ""} onchange="rotLigar('${c.id}',this)"><span class="sr-only">Ligar ${safeText(c.titulo)}</span></label>` })).join("")}</ul>`
      : vbEstadoHtml({ titulo: busca ? "Nenhum conteúdo com esse nome" : "Nenhum conteúdo do cliente perto da data do roteiro", texto: d.aviso || "Busque o conteúdo pelo nome." });
  } catch (e) { if (caixa()) caixa().innerHTML = vbEstadoHtml({ tipo: "erro", titulo: "Não deu para buscar os conteúdos", texto: e.message }); }
}
async function rotLigar(conteudo, caixa) {
  caixa.disabled = true;
  try { await rotPedir("", { acao: "ligar", roteiro_id: ROT_LIGAR.id, conteudo_id: conteudo, desfazer: !caixa.checked }); ROT_LIGAR.mudou = true; }
  catch (e) { caixa.checked = !caixa.checked; showToast(e.message, "err", 6000); }
  finally { caixa.disabled = false; }
}
function rotFecharLigar() { closeWorkflowModal(); if (ROT_LIGAR.mudou) { ROT.abertos.add(ROT_LIGAR.id); rotRecarregar(); } }

// ─── Direção V2 · Roteiros na prancha V2-M-Agenda-Roteiros (16/11/2026) ──────────────────────
// Cada roteiro é uma folha aberta: de quem é, as peças que ele descreve e os conteúdos que saíram dele, com "Abrir no
// Docs" e "Ligar conteúdos" à mão. À direita, no vidro: o cartão laranja do Lucas (roteiro sem conteúdo ligado), os
// roteiros por cliente (o filtro de antes) e o que falta antes de gravar. O topo (busca, Buscar no Drive e Incluir
// roteiro) é o da Agenda (agv2TopoHtml, vybe-captacoes.js). Só no computador; no celular fica a lista de antes.
function rotv2Buscar(valor) { ROT.busca = valor; const l = document.getElementById("rotv2-lista"); if (l) l.innerHTML = rotv2ListaHtml(); }
function rotv2Cliente(id) { ROT.cliente = ROT.cliente === id ? "" : id; ROT.soSem = false; renderProductionCommand(); }
function rotv2SoSem() { ROT.soSem = !ROT.soSem; ROT.cliente = ""; renderProductionCommand(); }
function rotv2Foto(nome) { return nome && typeof pv2Foto === "function" ? pv2Foto(nome) : '<i class="d3v-foto rotv2-sem" aria-hidden="true">+</i>'; }
function rotv2CartaoHtml(r) {
  const n = r.conteudos.length, dia = (c) => { const d = c.veiculacao || c.prazo; return d ? `, ${Number(d.slice(8, 10))}/${d.slice(5, 7)}` : ""; };
  const semFormato = (c) => { const t = String(c.titulo || ""), f = String(c.formato || ""); return f && t.toLowerCase().startsWith(f.toLowerCase()) ? t.slice(f.length).replace(/^[\s\-–·:]+/, "") || t : t; };
  const aviso = !r.cliente_id ? "sem cliente" : !n ? "sem conteúdo ligado" : "";
  return `<article class="d3m-c-folha rotv2-cartao" data-roteiro="${safeText(r.id)}"><div class="rotv2-cab">${rotv2Foto(r.cliente)}
      <div class="rotv2-tit"><b title="${safeText(r.titulo)}">${safeText(r.titulo)}</b><small class="rotv2-sub">${[r.cliente || "sem cliente", rotDia(r.criado_em), r.pecas.length ? rotPlural(r.pecas.length, "peça", "peças") : ""].filter(Boolean).map(safeText).join(" · ")}</small></div>
      ${aviso ? `<span class="rotv2-aviso">${aviso}</span>` : ""}
      <button type="button" class="d3v-btn txt s" onclick="rotAbrirEditar('${r.id}')">Editar</button>
      <a class="d3m-c-btn c" href="${safeText(r.link)}" target="_blank" rel="noopener">Abrir no Docs</a>
      ${r.cliente_id ? `<button type="button" class="d3m-c-btn c" onclick="rotAbrirLigar('${r.id}')">Ligar conteúdos</button>` : `<button type="button" class="d3m-c-btn c" onclick="rotAbrirEditar('${r.id}')">Escolher o cliente</button>`}</div>
    <div class="rotv2-corpo"><section><b class="rotv2-rot" role="heading" aria-level="4">peças do roteiro</b>${r.pecas.length ? `<ul>${r.pecas.map((p) => `<li>${safeText(p)}</li>`).join("")}</ul>` : '<p class="rotv2-nada">As peças estão no doc.</p>'}</section>
      <section><b class="rotv2-rot" role="heading" aria-level="4">conteúdos que saíram dele</b>${n ? `<ul class="rotv2-cont">${r.conteudos.map((c) => `<li><span title="${safeText(c.titulo)}">${c.formato ? `<b>${safeText(c.formato)}</b> · ` : ""}${safeText(semFormato(c))}${dia(c)}</span>${c.status ? `<span class="d3v-st" style="--st:${safeText(c.status_cor || "")}"><i aria-hidden="true"></i>${safeText(c.status)}</span>` : ""}</li>`).join("")}</ul>`
        : `<p class="rotv2-nada a">nenhum conteúdo ligado ainda</p>`}</section></div></article>`;
}
function rotv2ListaHtml() {
  const lista = rotFiltrados().filter((r) => !ROT.soSem || !r.conteudos.length);
  if (!(ROT.lista || []).length) return `<div class="d3m-c-folha d3v-estado"><b>Nenhum roteiro ainda</b>Inclua o link de um roteiro do Google Docs ou busque os roteiros da pasta da Vybe no Drive.<button type="button" class="d3v-btn" onclick="rotAbrirIncluir()">Incluir roteiro</button></div>`;
  if (!lista.length) return `<div class="d3m-c-folha d3v-estado"><b>Nenhum roteiro com esse filtro</b>Troque o cliente ou a busca.<button type="button" class="d3v-btn sec" onclick="ROT.cliente='';ROT.busca='';ROT.soSem=false;renderProductionCommand()">Ver todos</button></div>`;
  const meses = [...new Set(lista.map((r) => r.criado_em.slice(0, 7)))];
  return meses.map((m) => { const doMes = lista.filter((r) => r.criado_em.startsWith(m));
    return `${meses.length > 1 ? `<b class="rotv2-mes" role="heading" aria-level="3">${safeText(rotMes(m))} <span>· ${rotPlural(doMes.length, "roteiro", "roteiros")}</span></b>` : ""}${doMes.map(rotv2CartaoHtml).join("")}`; }).join("");
}
function rotv2Html() {
  const lista = ROT.lista || [], sem = lista.filter((r) => !r.conteudos.length), semCliente = lista.filter((r) => !r.cliente_id).length;
  const seta = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const prim = sem.find((r) => r.cliente_id) || sem[0];
  const laranja = sem.length ? `<section class="d3m-laranja rotv2-laranja" aria-label="O que pede você agora"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">L</span>Lucas · roteiro solto</span>
      <div class="d3m-lar-txt"><b class="d3m-lar-num">${sem.length}</b><b class="d3-acao-frase">${sem.length === 1 ? "roteiro sem conteúdo ligado" : "roteiros sem conteúdo ligado"}</b><small class="d3m-c-s">${semCliente ? `${semCliente === 1 ? "Um está" : `${semCliente} estão`} sem cliente. ` : ""}Sem ligar, a peça não sabe o que gravar.</small></div>
      <div class="d3m-lar-bts"><button type="button" class="d3m-btn l" onclick="${prim.cliente_id ? `rotAbrirLigar('${prim.id}')` : `rotAbrirEditar('${prim.id}')`}">${prim.cliente_id ? "Ligar conteúdos" : "Escolher o cliente"}</button><button type="button" class="d3m-btn l s" onclick="rotv2SoSem()">${ROT.soSem ? "Ver todos" : sem.length === 1 ? "Ver o roteiro" : `Ver os ${sem.length}`}</button></div></section>`
    : `<section class="d3m-laranja rotv2-laranja" aria-label="O que pede você agora"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">L</span>Lucas · roteiros em dia</span>
      <div class="d3m-lar-txt"><b class="d3-acao-frase">${lista.length ? "Todo roteiro tem conteúdo ligado" : "Nenhum roteiro ainda"}</b><small class="d3m-c-s">${lista.length ? "Roteiro novo entra pelo link do Docs ou pela pasta do Drive." : "Inclua o link do Docs ou busque a pasta da Vybe no Drive."}</small></div>
      <div class="d3m-lar-bts"><button type="button" class="d3m-btn l" onclick="rotAbrirIncluir()">Incluir roteiro</button></div></section>`;
  // Só os clientes que têm roteiro, do que tem mais para o que tem menos.
  const contagem = new Map();
  for (const r of lista) if (r.cliente_id) contagem.set(r.cliente_id, { nome: r.cliente, n: (contagem.get(r.cliente_id)?.n || 0) + 1 });
  const cli = (id, nome, n, foto) => `<button type="button" class="d3m-vlin" role="switch" aria-checked="${ROT.cliente === id}" onclick="rotv2Cliente('${safeText(id)}')">${foto}<span class="d3m-vnome"><b>${safeText(nome)}</b></span><b class="d3m-vn">${n}</b></button>`;
  const porCliente = `<div class="d3m-cons rotv2-clientes"><div class="d3m-cons-cab"><b>Por cliente</b><span>${rotPlural(lista.length, "roteiro", "roteiros")}</span></div>
    <div class="rotv2-clientes-lista">${[...contagem].sort((a, b) => b[1].n - a[1].n || a[1].nome.localeCompare(b[1].nome, "pt-BR")).map(([id, c]) => cli(id, c.nome, c.n, rotv2Foto(c.nome))).join("")}${semCliente ? cli("sem", "Sem cliente", semCliente, "") : ""}${lista.length ? "" : '<p class="d3m-vvazio">Os clientes aparecem aqui com o primeiro roteiro.</p>'}</div></div>`;
  // O que falta antes de gravar vem das Captações, quando elas já foram lidas nesta visita.
  const pend = typeof CAPT !== "undefined" && CAPT.pecas && typeof captPendencias === "function" ? captPendencias() : null, rot0 = pend?.roteiro.find((x) => x.e);
  const antes = pend ? `<div class="d3m-cons"><div class="d3m-cons-cab"><b>Antes de gravar</b><span>30 dias</span></div>
    <button type="button" class="d3m-vlin" onclick="prodAgendaVista('semana');captGrupo('roteiro')"><i class="d3m-pt${pend.roteiro.length ? " a" : ""}" aria-hidden="true"></i><span class="d3m-vnome"><b>Peças sem roteiro</b>${rot0 ? ` · gravam ${safeText(d3agQuando(rot0.e.dia).toLowerCase())}` : ""}</span><b class="d3m-vn">${pend.roteiro.length}</b>${seta}</button></div>` : "";
  return `<div id="rotv2" class="d3m-c-corpo rotv2"><div id="rotv2-lista" class="rotv2-lista" aria-label="Roteiros">${rotv2ListaHtml()}</div>
    <aside class="d3m-lado" aria-label="Consulta">${laranja}${porCliente}${antes}</aside></div>`;
}
