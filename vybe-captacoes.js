// vybe-captacoes.js — Captações na Produção (decisão do Paulo, 21/10/2026:
// "o fluxo fica dentro do sistema e todos têm que usar"; docs/captacao-plano.md).
// Aba "Captações" da Produção: as peças em "Agendar Captação" por cliente, com
// o roteiro, viram uma captação com dia, horário e local (evento no Google
// Agenda da Vybe); no dia, cada peça é marcada "Gravado". As regras ficam no
// servidor (server/captacoes.js); esta tela só mostra e pede.
const CAPT = { pecas: null, captacoes: null, erro: "", carregando: false, abertas: new Set() };

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
    CAPT.pecas = p.pecas || []; CAPT.captacoes = c.captacoes || []; CAPT.erro = "";
  } catch (e) { CAPT.erro = e.message; }
  finally { CAPT.carregando = false; if (typeof renderProductionCommand === "function") renderProductionCommand(); }
}
const captDia = (iso) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "") : "sem data";
const captHoje = () => (typeof HOJE_ISO !== "undefined" && HOJE_ISO) || new Date().toISOString().slice(0, 10);
const captAmanha = () => { const d = new Date(`${captHoje()}T12:00:00`); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

// Peça com vários clientes entra na fila do primeiro (não duplica a peça).
function captFilaPorCliente() {
  const grupos = new Map();
  for (const p of CAPT.pecas || []) {
    const c = p.clientes?.[0] || { id: "", nome: "Sem cliente" };
    if (!grupos.has(c.id)) grupos.set(c.id, { cliente: c, pecas: [] });
    grupos.get(c.id).pecas.push(p);
  }
  return [...grupos.values()].sort((a, b) => b.pecas.length - a.pecas.length || a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR"));
}
function captPecaHtml(p, { marcar = "" } = {}) {
  const roteiro = String(p.briefing || "").trim();
  const quando = p.prazo ? `prazo ${captDia(p.prazo)}` : p.veiculacao ? `vai ao ar ${captDia(p.veiculacao)}` : "";
  return `<li class="capt-peca${p.gravado ? " gravada" : ""}">${marcar}<span class="capt-peca-texto"><b>${safeText(p.titulo)}</b><small>${[p.formato, quando].filter(Boolean).map(safeText).join(" · ")}</small></span>
    ${roteiro ? `<details class="capt-roteiro"><summary>Roteiro</summary><p>${safeText(roteiro)}</p></details>` : '<span class="capt-sem-roteiro" title="Esta peça ainda não tem roteiro no briefing">Sem roteiro</span>'}</li>`;
}
function captacoesHtml() {
  if (!CAPT.pecas && !CAPT.erro) { captCarregar(); return vbEstadoHtml({ tipo: "carregando", titulo: "Carregando as captações" }); }
  if (CAPT.erro) return vbEstadoHtml({ tipo: "erro", titulo: "Não deu para abrir as captações", texto: CAPT.erro, acao: '<button type="button" class="vb-botao" onclick="CAPT.erro=\'\';CAPT.pecas=null;renderProductionCommand()">Tentar de novo</button>' });
  const fila = captFilaPorCliente(), agenda = CAPT.captacoes || [];
  const semRoteiro = (CAPT.pecas || []).filter((p) => !String(p.briefing || "").trim()).length;
  const resumo = vbResumoHtml([
    { valor: (CAPT.pecas || []).length, rotulo: " para captar", tom: (CAPT.pecas || []).length ? "atencao" : "" },
    (() => { const n = agenda.filter((k) => k.estado === "agendada").length; return { valor: n, rotulo: n === 1 ? " captação marcada" : " captações marcadas" }; })(),
    { valor: semRoteiro, rotulo: " sem roteiro", tom: semRoteiro ? "alerta" : "" },
  ]);
  const filaHtml = fila.length ? fila.map(({ cliente, pecas }) => `<article class="capt-cliente">
    <div class="capt-topo"><span><b>${safeText(cliente.nome)}</b><small>${pecas.length} ${pecas.length === 1 ? "peça" : "peças"} para captar</small></span>
      ${cliente.id ? `<button type="button" class="vb-botao principal" onclick="captAbrirMontar('${safeText(cliente.id)}')">Montar captação</button>` : ""}</div>
    <ul>${pecas.map((p) => captPecaHtml(p)).join("")}</ul></article>`).join("")
    : vbEstadoHtml({ titulo: "Nenhuma peça esperando captação", texto: "Peças em \"Agendar Captação\" aparecem aqui, separadas por cliente." });
  const agendaHtml = agenda.length ? agenda.map((k) => {
    const gravadas = k.pecas.filter((p) => p.gravado).length;
    return `<article class="capt-marcada ${k.estado}">
    <div class="capt-topo"><span class="capt-data"><b>${safeText(captDia(k.dia))}</b><small>${k.inicio ? safeText(k.inicio + (k.fim ? "–" + k.fim : "")) : "dia inteiro"}</small></span>
      <span class="capt-marcada-texto"><b>${safeText(k.cliente || "")}</b><small>${[k.local, `${gravadas} de ${k.pecas.length} gravadas`].filter(Boolean).map(safeText).join(" · ")}</small></span>
      <span class="capt-estado">${k.estado === "gravada" ? "Gravada" : k.na_agenda ? "No Google Agenda" : "Fora da agenda"}</span></div>
    ${k.aviso ? `<p class="capt-aviso">${safeText(k.aviso)} <button type="button" class="vb-link" onclick="captAgenda('${k.id}')">Tentar de novo</button></p>` : ""}
    ${k.observacao ? `<p class="capt-obs">${safeText(k.observacao)}</p>` : ""}
    <ul>${k.pecas.map((p) => captPecaHtml(p, { marcar: `<label class="capt-gravado"><input type="checkbox" ${p.gravado ? "checked" : ""} onchange="captGravado('${k.id}','${p.id}',!this.checked)" aria-label="Gravado: ${safeText(p.titulo)}"><span>Gravado</span></label>` })).join("")}</ul>
    ${k.estado === "agendada" ? `<div class="capt-pe"><button type="button" class="vb-botao perigo" onclick="captCancelar('${k.id}')">Cancelar captação</button></div>` : ""}</article>`;
  }).join("") : vbEstadoHtml({ titulo: "Nenhuma captação marcada", texto: "Monte uma captação a partir das peças ao lado: ela entra no Google Agenda da Vybe." });
  return `<div class="capt">${resumo}<div class="capt-colunas">
    <section class="capt-coluna" aria-labelledby="capt-fila"><h4 id="capt-fila">Para captar</h4>${filaHtml}</section>
    <section class="capt-coluna" aria-labelledby="capt-agenda"><h4 id="capt-agenda">Captações marcadas</h4>${agendaHtml}</section></div></div>`;
}

function captAbrirMontar(clienteId) {
  const grupo = captFilaPorCliente().find((g) => g.cliente.id === clienteId);
  if (!grupo) return;
  openWorkflowModal(`<div class="workflow-kicker"><span>Captação · ${safeText(grupo.cliente.nome)}</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Montar captação</h2>
    <p class="workflow-copy">As peças escolhidas viram "Captação Agendada" e a captação entra no Google Agenda da Vybe, com a lista das peças.</p>
    <form class="capt-form" onsubmit="event.preventDefault();captMontar(this,'${safeText(clienteId)}')">
      <fieldset><legend>Peças</legend>${grupo.pecas.map((p) => `<label class="capt-escolha"><input type="checkbox" name="peca" value="${safeText(p.id)}" checked><span><b>${safeText(p.titulo)}</b><small>${safeText([p.formato, p.prazo ? "prazo " + captDia(p.prazo) : ""].filter(Boolean).join(" · "))}${String(p.briefing || "").trim() ? "" : " · sem roteiro"}</small></span></label>`).join("")}</fieldset>
      <div class="capt-campos"><label>Dia<input type="date" name="dia" required value="${captAmanha()}" min="${captHoje()}"></label>
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
    CAPT.pecas = null; renderProductionCommand();
  } catch (e) { erro.textContent = e.message; erro.hidden = false; botao.disabled = false; botao.textContent = "Marcar captação"; }
}
async function captGravado(id, peca, desfazer) {
  try { await captPedir("", { acao: "gravado", captacao_id: id, conteudo_id: peca, desfazer }); if (typeof refreshData === "function") refreshData(); }
  catch (e) { showToast(e.message, "err", 6000); }
  CAPT.pecas = null; renderProductionCommand();
}
async function captCancelar(id) {
  if (!confirm("Cancelar esta captação? As peças não gravadas voltam para \"Agendar Captação\" e o evento sai do Google Agenda.")) return;
  try { const r = await captPedir("", { acao: "cancelar", id }); showToast(r.avisos?.[0] || "Captação cancelada.", r.avisos?.length ? "info" : "ok", 6000); if (typeof refreshData === "function") refreshData(); }
  catch (e) { showToast(e.message, "err", 6000); }
  CAPT.pecas = null; renderProductionCommand();
}
async function captAgenda(id) {
  try { const r = await captPedir("", { acao: "agenda", id }); showToast(r.avisos?.[0] || "Captação no Google Agenda.", r.avisos?.length ? "info" : "ok", 6000); }
  catch (e) { showToast(e.message, "err", 6000); }
  CAPT.pecas = null; renderProductionCommand();
}
