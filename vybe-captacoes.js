// vybe-captacoes.js — Captações na Produção (decisão do Paulo, 21/10/2026:
// "o fluxo fica dentro do sistema e todos têm que usar"; docs/captacao-plano.md).
// À esquerda a agenda de captações de verdade: os eventos azuis do Google
// Agenda da Vybe (a cor da captação), por dia, com as captações montadas aqui
// mostrando as peças e o "Gravado". À direita a fila para captar: uma linha por
// cliente, das mais urgentes (prazo vencido) para as outras, com a próxima
// captação marcada, que abre para ver as peças e o roteiro. As regras ficam no
// servidor (server/captacoes.js); esta tela só mostra e pede.
const CAPT = { pecas: null, captacoes: null, agenda: [], avisoAgenda: "", erro: "", carregando: false, busca: "", abertos: new Set() };

async function captPedir(params, corpo) {
  const r = await fetch(`/api/painel?area=captacoes${params ? "&" + params : ""}`, corpo
    ? { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }
    : { credentials: "same-origin", cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || "Não foi possível falar com o painel.");
  return d;
}
async function captCarregar() {
  if (CAPT.carregando) return;
  CAPT.carregando = true;
  try {
    const [p, c] = await Promise.all([captPedir("acao=pecas"), captPedir("")]);
    CAPT.pecas = p.pecas || []; CAPT.captacoes = c.captacoes || []; CAPT.agenda = c.agenda || []; CAPT.avisoAgenda = c.aviso_agenda || ""; CAPT.erro = "";
  } catch (e) { CAPT.erro = e.message; }
  finally { CAPT.carregando = false; if (typeof renderProductionCommand === "function") renderProductionCommand(); }
}
function captRecarregar() { CAPT.pecas = null; if (typeof renderProductionCommand === "function") renderProductionCommand(); }

const captHoje = () => (typeof HOJE_ISO !== "undefined" && HOJE_ISO) || new Date().toISOString().slice(0, 10);
const captAmanha = () => { const d = new Date(`${captHoje()}T12:00:00`); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const captDiasAte = (iso) => Math.round((new Date(`${iso}T12:00:00`) - new Date(`${captHoje()}T12:00:00`)) / 864e5);
const captDia = (iso) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "") : "sem data";
const captDiaLongo = (iso) => { const n = captDiasAte(iso); return n === 0 ? "Hoje" : n === 1 ? "Amanhã" : new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }); };
// Prazo em palavras, com o tom do estado (vencido, hoje, perto, ok).
function captPrazo(p) {
  const iso = p.prazo || p.veiculacao;
  if (!iso) return { texto: "sem prazo", tom: "" };
  const n = captDiasAte(iso);
  if (n < 0) return { texto: n === -1 ? "venceu ontem" : `venceu há ${-n} dias`, tom: "alerta" };
  if (n === 0) return { texto: "vence hoje", tom: "atencao" };
  if (n <= 3) return { texto: `vence em ${n} ${n === 1 ? "dia" : "dias"}`, tom: "atencao" };
  return { texto: `prazo ${captDia(iso)}`, tom: "" };
}
const captTemRoteiro = (p) => Boolean(String(p.briefing || "").trim() || p.roteiro_doc);

// Fila por cliente (peça com vários clientes entra no primeiro, sem duplicar),
// das mais urgentes para as outras; a próxima captação vem da agenda.
function captFila() {
  const grupos = new Map();
  for (const p of CAPT.pecas || []) {
    const c = p.clientes?.[0] || { id: "", nome: "Sem cliente" };
    if (!grupos.has(c.id)) grupos.set(c.id, { cliente: c, pecas: [] });
    grupos.get(c.id).pecas.push(p);
  }
  const hoje = captHoje();
  return [...grupos.values()].map((g) => {
    g.pecas.sort((a, b) => String(a.prazo || a.veiculacao || "9999").localeCompare(String(b.prazo || b.veiculacao || "9999")));
    g.vencidas = g.pecas.filter((p) => captPrazo(p).tom === "alerta").length;
    g.semRoteiro = g.pecas.filter((p) => !captTemRoteiro(p)).length;
    g.proxima = (CAPT.agenda || []).filter((e) => e.cliente_id && e.cliente_id === g.cliente.id && e.dia >= hoje).sort((a, b) => (a.dia + a.horario).localeCompare(b.dia + b.horario))[0] || null;
    return g;
  }).sort((a, b) => b.vencidas - a.vencidas || String(a.pecas[0]?.prazo || "9999").localeCompare(String(b.pecas[0]?.prazo || "9999")) || a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR"));
}

function captPecaHtml(p, { marcar = "" } = {}) {
  const prazo = captPrazo(p), roteiro = String(p.briefing || "").trim();
  return `<li class="capt-peca${p.gravado ? " gravada" : ""}">${marcar}<span class="capt-peca-texto"><b>${safeText(p.titulo)}</b><small>${p.formato ? `<span>${safeText(p.formato)}</span>` : ""}${p.prazo || p.veiculacao ? `<span class="capt-prazo ${prazo.tom}">${safeText(prazo.texto)}</span>` : ""}</small></span>
    ${p.roteiro_doc ? `<a class="capt-roteiro-doc" href="${safeText(p.roteiro_doc.link)}" target="_blank" rel="noopener" title="${safeText(p.roteiro_doc.titulo)}">Roteiro no Docs</a>` : ""}${roteiro ? `<details class="capt-roteiro"><summary>Roteiro</summary><p>${safeText(roteiro)}</p></details>` : p.roteiro_doc ? "" : '<span class="capt-sem-roteiro" title="Esta peça ainda não tem roteiro no briefing nem um roteiro do Docs ligado">Sem roteiro</span>'}</li>`;
}

// Agenda: os eventos do Google por dia; o que foi montado aqui traz as peças.
function captAgendaHtml() {
  const nossas = new Map((CAPT.captacoes || []).map((k) => [k.id, k]));
  const itens = (CAPT.agenda || []).map((e) => ({ ...e, nossa: nossas.get(e.captacao_id) || null }));
  // Captação montada aqui que não entrou no Google também aparece (com o aviso).
  for (const k of CAPT.captacoes || []) if (!itens.some((e) => e.nossa?.id === k.id))
    itens.push({ id: `k${k.id}`, titulo: `Captação · ${k.cliente}`, dia: k.dia, horario: k.inicio ? `${k.inicio}${k.fim ? ` às ${k.fim}` : ""}` : "Dia inteiro", local: k.local, cliente: k.cliente, cliente_id: k.cliente_id, nossa: k });
  itens.sort((a, b) => (a.dia + a.horario).localeCompare(b.dia + b.horario));
  const aviso = CAPT.avisoAgenda ? `<p class="capt-aviso">${safeText(CAPT.avisoAgenda)}</p>` : "";
  if (!itens.length) return aviso + vbEstadoHtml({ titulo: "Nenhuma captação nos próximos dias", texto: "As captações em azul no Google Agenda da Vybe aparecem aqui. Monte uma pela fila ao lado." });
  const dias = [...new Set(itens.map((e) => e.dia))];
  return aviso + dias.map((dia) => `<section class="capt-dia${dia === captHoje() ? " hoje" : ""}"><h5>${safeText(captDiaLongo(dia))}</h5>
    ${itens.filter((e) => e.dia === dia).map((e) => {
      const k = e.nossa, hora = String(e.horario || "").replace(/ às /, "–").replace("Dia inteiro · horário não informado", "Dia inteiro");
      return `<article class="capt-evento${k ? " montada" : ""}${k?.estado === "gravada" ? " gravada" : ""}">
        <span class="capt-hora">${safeText(hora)}</span>
        <span class="capt-evento-texto"><b>${safeText(e.titulo)}</b><small>${[e.cliente || "cliente não identificado", e.local].filter(Boolean).map(safeText).join(" · ")}</small>
        ${k ? `${k.aviso ? `<span class="capt-aviso">${safeText(k.aviso)} <button type="button" class="vb-link" onclick="captAgenda('${k.id}')">Tentar de novo</button></span>` : ""}
          <ul>${k.pecas.map((p) => captPecaHtml(p, { marcar: `<label class="capt-gravado"><input type="checkbox" ${p.gravado ? "checked" : ""} onchange="captGravado('${k.id}','${p.id}',!this.checked)"><span class="sr-only">Gravado: ${safeText(p.titulo)}</span></label>` })).join("")}</ul>
          <span class="capt-evento-pe"><em>${k.pecas.filter((p) => p.gravado).length} de ${k.pecas.length} gravadas</em>${k.estado === "agendada" ? `<button type="button" class="vb-link perigo" onclick="captCancelar('${k.id}')">Cancelar captação</button>` : ""}</span>` : ""}</span>
      </article>`;
    }).join("")}</section>`).join("");
}

function captFilaHtml() {
  const busca = CAPT.busca.trim().toLowerCase();
  const fila = captFila().filter((g) => !busca || g.cliente.nome.toLowerCase().includes(busca));
  if (!(CAPT.pecas || []).length) return vbEstadoHtml({ titulo: "Nenhuma peça esperando captação", texto: "Peças em \"Agendar Captação\" aparecem aqui, separadas por cliente." });
  if (!fila.length) return vbEstadoHtml({ titulo: "Nenhum cliente com esse nome na fila", texto: "Confira a busca." });
  return fila.map((g) => {
    const aberto = CAPT.abertos.has(g.cliente.id);
    const proxima = g.proxima ? `<span class="capt-chip ok">captação ${safeText(captDiaLongo(g.proxima.dia).toLowerCase())}${g.proxima.horario && !/Dia inteiro/.test(g.proxima.horario) ? ` ${safeText(g.proxima.horario.split(" ")[0])}` : ""}</span>` : '<span class="capt-chip">sem captação marcada</span>';
    return `<details class="capt-cliente"${aberto ? " open" : ""} ontoggle="CAPT.abertos[this.open?'add':'delete']('${safeText(g.cliente.id)}')">
      <summary><span class="capt-cliente-nome"><b>${safeText(g.cliente.nome)}</b>
        <span class="capt-chips"><small>${g.pecas.length} ${g.pecas.length === 1 ? "peça" : "peças"}</small>${g.vencidas ? `<span class="capt-chip alerta">${g.vencidas} ${g.vencidas === 1 ? "vencida" : "vencidas"}</span>` : ""}${g.semRoteiro ? `<span class="capt-chip atencao">${g.semRoteiro} sem roteiro</span>` : ""}${proxima}</span></span>
        ${g.cliente.id ? `<button type="button" class="vb-botao principal" onclick="event.preventDefault();captAbrirMontar('${safeText(g.cliente.id)}')">Montar captação</button>` : ""}</summary>
      <ul>${g.pecas.map((p) => captPecaHtml(p)).join("")}</ul></details>`;
  }).join("");
}

function captacoesHtml() {
  if (!CAPT.pecas && !CAPT.erro) { captCarregar(); return vbEstadoHtml({ tipo: "carregando", titulo: "Carregando as captações" }); }
  if (CAPT.erro) return vbEstadoHtml({ tipo: "erro", titulo: "Não deu para abrir as captações", texto: CAPT.erro, acao: '<button type="button" class="vb-botao" onclick="CAPT.erro=\'\';captRecarregar()">Tentar de novo</button>' });
  const pecas = CAPT.pecas || [], hoje = captHoje();
  const vencidas = pecas.filter((p) => captPrazo(p).tom === "alerta").length, semRoteiro = pecas.filter((p) => !captTemRoteiro(p)).length;
  const deHoje = (CAPT.agenda || []).filter((e) => e.dia === hoje).length, proximas = (CAPT.agenda || []).length;
  const resumo = vbResumoHtml([
    { valor: deHoje, rotulo: deHoje === 1 ? " captação hoje" : " captações hoje", tom: deHoje ? "ok" : "" },
    { valor: proximas, rotulo: " nas próximas 3 semanas" },
    { valor: pecas.length, rotulo: pecas.length === 1 ? " peça para captar" : " peças para captar", tom: pecas.length ? "atencao" : "" },
    { valor: vencidas, rotulo: " com prazo vencido", tom: vencidas ? "alerta" : "" },
    { valor: semRoteiro, rotulo: " sem roteiro", tom: semRoteiro ? "alerta" : "" },
  ]);
  return `<div class="capt">${resumo}<div class="capt-colunas">
    <section class="capt-coluna" aria-labelledby="capt-agenda"><div class="capt-coluna-topo"><h4 id="capt-agenda">Agenda de captações</h4><small>Google Agenda da Vybe · azul</small></div>${captAgendaHtml()}</section>
    <section class="capt-coluna" aria-labelledby="capt-fila"><div class="capt-coluna-topo"><h4 id="capt-fila">Para captar</h4>
      <label class="capt-busca"><span class="sr-only">Buscar cliente</span><input type="search" placeholder="Buscar cliente" value="${safeText(CAPT.busca)}" oninput="CAPT.busca=this.value;const f=document.getElementById('capt-fila-lista');if(f)f.innerHTML=captFilaHtml()"></label></div>
      <div id="capt-fila-lista" class="capt-fila">${captFilaHtml()}</div></section></div></div>`;
}

function captAbrirMontar(clienteId) {
  const g = captFila().find((x) => x.cliente.id === clienteId);
  if (!g) return;
  openWorkflowModal(`<div class="workflow-kicker"><span>Captação · ${safeText(g.cliente.nome)}</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Montar captação</h2>
    <p class="workflow-copy">As peças escolhidas viram "Captação Agendada" e a captação entra no Google Agenda da Vybe, em azul, com a lista das peças.${g.proxima ? ` Já existe uma captação de ${safeText(g.cliente.nome)} ${safeText(captDiaLongo(g.proxima.dia).toLowerCase())} na agenda.` : ""}</p>
    <form class="capt-form" onsubmit="event.preventDefault();captMontar(this,'${safeText(clienteId)}')">
      <fieldset><legend>Peças (${g.pecas.length})</legend>${g.pecas.map((p) => { const pr = captPrazo(p); return `<label class="capt-escolha"><input type="checkbox" name="peca" value="${safeText(p.id)}" checked><span><b>${safeText(p.titulo)}</b><small>${safeText([p.formato, pr.texto].filter(Boolean).join(" · "))}${captTemRoteiro(p) ? "" : " · sem roteiro"}</small></span></label>`; }).join("")}</fieldset>
      <div class="capt-campos"><label>Dia<input type="date" name="dia" required value="${g.proxima?.dia || captAmanha()}" min="${captHoje()}"></label>
        <label>Começa<input type="time" name="inicio" value="09:00"></label><label>Termina<input type="time" name="fim" value="11:00"></label></div>
      <label>Local<input name="local" maxlength="300" placeholder="Ex.: no restaurante, estúdio da Vybe"></label>
      <label>Observação<textarea name="observacao" rows="2" maxlength="2000" placeholder="O que levar, quem acompanha…"></textarea></label>
      <p class="capt-erro" role="alert" hidden></p>
      <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="submit" class="workflow-primary">Marcar captação</button></div>
    </form>`);
}
async function captMontar(form, clienteId) {
  const f = new FormData(form), erro = form.querySelector(".capt-erro"), botao = form.querySelector("[type=submit]");
  const pecas = f.getAll("peca");
  if (!pecas.length) { erro.textContent = "Escolha ao menos uma peça."; erro.hidden = false; return; }
  botao.disabled = true; botao.textContent = "Marcando…";
  try {
    const r = await captPedir("", { acao: "montar", cliente_id: clienteId, pecas, dia: f.get("dia"), inicio: f.get("inicio") || "", fim: f.get("fim") || "", local: f.get("local") || "", observacao: f.get("observacao") || "" });
    closeWorkflowModal();
    showToast(r.avisos?.length ? `Captação marcada. ${r.avisos[0]}` : "Captação marcada e no Google Agenda.", r.avisos?.length ? "info" : "ok", 6000);
    if (typeof refreshData === "function") refreshData();
    captRecarregar();
  } catch (e) { erro.textContent = e.message; erro.hidden = false; botao.disabled = false; botao.textContent = "Marcar captação"; }
}
async function captGravado(id, peca, desfazer) {
  try { await captPedir("", { acao: "gravado", captacao_id: id, conteudo_id: peca, desfazer }); if (typeof refreshData === "function") refreshData(); }
  catch (e) { showToast(e.message, "err", 6000); }
  captRecarregar();
}
async function captCancelar(id) {
  if (!confirm("Cancelar esta captação? As peças não gravadas voltam para \"Agendar Captação\" e o evento sai do Google Agenda.")) return;
  try { const r = await captPedir("", { acao: "cancelar", id }); showToast(r.avisos?.[0] || "Captação cancelada.", r.avisos?.length ? "info" : "ok", 6000); if (typeof refreshData === "function") refreshData(); }
  catch (e) { showToast(e.message, "err", 6000); }
  captRecarregar();
}
async function captAgenda(id) {
  try { const r = await captPedir("", { acao: "agenda", id }); showToast(r.avisos?.[0] || "Captação no Google Agenda.", r.avisos?.length ? "info" : "ok", 6000); }
  catch (e) { showToast(e.message, "err", 6000); }
  captRecarregar();
}
