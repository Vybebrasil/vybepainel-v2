// Gatilhos, condições e efeitos (o Wired do Habbo), montados pela equipe com
// os móveis originais. Como no Habbo, tudo o que está no mesmo ladrilho é uma
// pilha: um gatilho da pilha dispara, as condições dela são conferidas e os
// efeitos rodam. Roda no navegador de quem disparou; estado de móvel vai para
// todos pelo furni:toggle, como um clique. A configuração fica no 7º campo do
// item ({ m: [[x, y, classe], …] móveis escolhidos pela origem, t: texto,
// s: segundos }) e é
// conferida no servidor (server/escritorio-mapa.js).
const ESCRITORIO_GATILHOS = {
  wf_trg_walks_on_furni: { tipo: "gatilho", nome: "Pisar no móvel", dica: "Dispara quando alguém pisa num dos móveis escolhidos.", moveis: true },
  wf_trg_walks_off_furni: { tipo: "gatilho", nome: "Sair do móvel", dica: "Dispara quando alguém sai de cima de um dos móveis escolhidos.", moveis: true },
  wf_trg_click_furni: { tipo: "gatilho", nome: "Clicar no móvel", dica: "Dispara quando alguém clica num dos móveis escolhidos.", moveis: true },
  wf_trg_state_changed: { tipo: "gatilho", nome: "Móvel mudou de estado", dica: "Dispara quando alguém liga, desliga ou troca o estado de um dos móveis escolhidos.", moveis: true },
  wf_trg_says_something: { tipo: "gatilho", nome: "Dizer uma palavra", dica: "Dispara quando alguém escreve a palavra no chat do quarto.", texto: "Palavra" },
  wf_trg_enter_room: { tipo: "gatilho", nome: "Entrar no quarto", dica: "Dispara para quem entra no quarto." },
  wf_trg_periodically: { tipo: "gatilho", nome: "A cada tantos segundos", dica: "Dispara sozinho, de tempos em tempos, enquanto há alguém no quarto.", segundos: true },
  wf_cnd_trggrer_on_frn: { tipo: "condicao", nome: "Quem disparou está no móvel", dica: "Só segue se quem disparou estiver em cima de um dos móveis escolhidos.", moveis: true },
  wf_cnd_furnis_hv_avtrs: { tipo: "condicao", nome: "Tem gente nos móveis", dica: "Só segue se houver alguém em cima de cada móvel escolhido.", moveis: true },
  wf_act_toggle_state: { tipo: "efeito", nome: "Alternar o estado", dica: "Liga, desliga ou passa para o próximo estado os móveis escolhidos.", moveis: true },
  wf_act_toggle_to_rnd: { tipo: "efeito", nome: "Estado aleatório", dica: "Sorteia um estado para cada móvel escolhido.", moveis: true },
  wf_act_show_message: { tipo: "efeito", nome: "Mostrar mensagem", dica: "Mostra a mensagem para quem disparou.", texto: "Mensagem" },
  wf_act_teleport_to: { tipo: "efeito", nome: "Teletransportar", dica: "Leva quem disparou para um dos móveis escolhidos.", moveis: true },
};
const ESCRITORIO_GATILHO_MAX_MOVEIS = 5;
const escritorioCfgGatilho = (it) => (it?.[6] && typeof it[6] === "object" ? it[6] : {});
// O móvel escolhido no mapa (origem e classe; sem classe, o de cima do ladrilho).
function escritorioMovelEscolhido([x, y, classe]) {
  const aqui = escritorio.mapa?.moveisEm(x, y) || [];
  return (classe ? aqui.find((m) => m.classe === classe && Math.floor(m.x) === x && Math.floor(m.y) === y) || aqui.find((m) => m.classe === classe) : null)
    || aqui.find((m) => !ESCRITORIO_GATILHOS[m.classe]) || null;
}
// (x, y) é um dos móveis escolhidos? Vale qualquer ladrilho que o móvel ocupa.
const escritorioNosMoveis = (it, x, y) => (escritorioCfgGatilho(it).m || []).some((alvo) => {
  const m = escritorioMovelEscolhido(alvo);
  if (!m) return alvo[0] === x && alvo[1] === y;
  return x >= Math.floor(m.x) && x < Math.floor(m.x) + Math.max(1, Math.round(m.dim?.x || 1)) && y >= Math.floor(m.y) && y < Math.floor(m.y) + Math.max(1, Math.round(m.dim?.y || 1));
});

// Pilhas do quarto atual (ladrilho → itens de gatilho), fora da edição.
function escritorioPilhasGatilho() {
  if (escritorio.edicao || !escritorio.mapa) return [];
  const pilhas = new Map();
  for (const it of escritorioItensDaCamada(escritorio.quarto || "geral")) {
    if (!ESCRITORIO_GATILHOS[it[0]]) continue;
    const k = Math.floor(it[1]) + "," + Math.floor(it[2]);
    if (!pilhas.has(k)) pilhas.set(k, []);
    pilhas.get(k).push(it);
  }
  return [...pilhas.values()];
}
function escritorioMinhaPosicaoGatilho() {
  const p = movimento.quadro ? movimento : escritorioPosicao(escritorio.perfil || {});
  return { x: Math.round(p.x), y: Math.round(p.y) };
}
function escritorioGenteNoLadrilho(x, y) {
  const eu = escritorioMinhaPosicaoGatilho();
  if (eu.x === x && eu.y === y) return true;
  return (escritorio.online || []).some((o) => String(o.id) !== String(escritorio.base.eu) && escritorioNaCena(o) && (() => { const q = escritorioPosicao(o); return Math.round(q.x) === x && Math.round(q.y) === y; })());
}
function escritorioCondicaoGatilho(it) {
  const alvos = escritorioCfgGatilho(it).m || [];
  if (it[0] === "wf_cnd_trggrer_on_frn") { const p = escritorioMinhaPosicaoGatilho(); return escritorioNosMoveis(it, p.x, p.y); }
  if (it[0] === "wf_cnd_furnis_hv_avtrs") return alvos.length > 0 && alvos.every(([x, y]) => escritorioGenteNoLadrilho(x, y));
  return true;
}
function escritorioTrocarEstadoGatilho(m, estado) {
  const chave = escritorio.mapa.chaveMovel(m);
  escritorio.mapa.estadosMoveis([[chave, estado]]);
  escritorioEmitir("furni:toggle", { chave, estado });
}
function escritorioEfeitoGatilho(it) {
  const cfg = escritorioCfgGatilho(it), alvos = cfg.m || [];
  if (it[0] === "wf_act_show_message" && cfg.t) return escritorioAviso(cfg.t);
  if (it[0] === "wf_act_teleport_to" && alvos.length) {
    const [x, y] = alvos[Math.floor(Math.random() * alvos.length)];
    movimento.rota = [];
    movimento.x = x; movimento.y = y; movimento.ladrilho = x + "," + y;
    escritorio.mapa.mover(escritorio.base.eu, x, y, movimento.dir, "std");
    escritorioEnviarPosicao(true);
    escritorioTocar(880, 0.1, 0.05);
    return;
  }
  for (const alvo of alvos) {
    const m = escritorioMovelEscolhido(alvo);
    if (!m || escritorioEstadosDoMovel(m).length < 2) continue;
    const estados = escritorioEstadosDoMovel(m), i = estados.indexOf(m.estado || 0);
    if (it[0] === "wf_act_toggle_state") escritorioTrocarEstadoGatilho(m, estados[(i + 1) % estados.length]);
    if (it[0] === "wf_act_toggle_to_rnd") escritorioTrocarEstadoGatilho(m, estados[Math.floor(Math.random() * estados.length)]);
  }
}
// Dispara os gatilhos da classe que passam no teste. Efeito que muda estado
// não dispara outro "móvel mudou" (sem laço, como no Habbo).
function dispararGatilhoEscritorio(classe, teste = () => true) {
  if (escritorio.gatilhoRodando) return;
  for (const pilha of escritorioPilhasGatilho()) {
    const gatilho = pilha.find((it) => it[0] === classe && teste(it));
    if (!gatilho) continue;
    if (!pilha.filter((it) => ESCRITORIO_GATILHOS[it[0]].tipo === "condicao").every(escritorioCondicaoGatilho)) continue;
    escritorio.gatilhoRodando = true;
    try { for (const it of pilha) if (ESCRITORIO_GATILHOS[it[0]].tipo === "efeito") escritorioEfeitoGatilho(it); }
    finally { escritorio.gatilhoRodando = false; }
    escritorioPiscarPilha(pilha);
  }
}
// A caixa do Habbo acende quando a pilha roda (só para quem disparou).
function escritorioPiscarPilha(pilha) {
  const mapa = escritorio.mapa;
  const caixas = pilha.flatMap((it) => (mapa?.moveisEm(Math.floor(it[1]), Math.floor(it[2])) || []).filter((m) => m.classe === it[0]));
  const lista = caixas.map((m) => mapa.chaveMovel(m));
  if (!lista.length) return;
  mapa.estadosMoveis(lista.map((k) => [k, 1]));
  setTimeout(() => escritorio.mapa === mapa && mapa.estadosMoveis(lista.map((k) => [k, 0])), 600);
}
// Ganchos chamados pelo escritório.
// Pisar e sair valem ao entrar e ao deixar o móvel (como no servidor do
// Habbo); andar de um ladrilho para outro do mesmo tapete não conta.
function gatilhoPassoEscritorio(antes, x, y) {
  const [ax, ay] = antes ? antes.split(",").map(Number) : [NaN, NaN];
  dispararGatilhoEscritorio("wf_trg_walks_off_furni", (it) => escritorioNosMoveis(it, ax, ay) && !escritorioNosMoveis(it, x, y));
  dispararGatilhoEscritorio("wf_trg_walks_on_furni", (it) => escritorioNosMoveis(it, x, y) && !escritorioNosMoveis(it, ax, ay));
}
function gatilhoCliqueEscritorio(x, y) { dispararGatilhoEscritorio("wf_trg_click_furni", (it) => escritorioNosMoveis(it, x, y)); }
function gatilhoEstadoEscritorio(chave) {
  const m = /@(-?[\d.]+),(-?[\d.]+)$/.exec(String(chave || ""));
  if (m) dispararGatilhoEscritorio("wf_trg_state_changed", (it) => escritorioNosMoveis(it, Math.floor(Number(m[1])), Math.floor(Number(m[2]))));
}
function gatilhoFalaEscritorio(texto) {
  const dito = String(texto || "").toLocaleLowerCase("pt-BR");
  dispararGatilhoEscritorio("wf_trg_says_something", (it) => { const p = String(escritorioCfgGatilho(it).t || "").trim().toLocaleLowerCase("pt-BR"); return Boolean(p) && dito.includes(p); });
}
function gatilhoEntradaEscritorio() { dispararGatilhoEscritorio("wf_trg_enter_room"); }
// Repetidor: só um navegador por quarto roda (o de menor id entre quem está
// nele), para o efeito não acontecer em dobro.
setInterval(() => {
  if (typeof document === "undefined" || !document.body || document.hidden || !escritorio?.mapa || !escritorio.base) return;
  const eu = String(escritorio.base.eu);
  const ids = [eu, ...(escritorio.online || []).filter((o) => escritorioNaCena(o)).map((o) => String(o.id))];
  if (ids.some((id) => id.localeCompare(eu, undefined, { numeric: true }) < 0)) return;
  const agora = Math.floor(Date.now() / 1000);
  dispararGatilhoEscritorio("wf_trg_periodically", (it) => agora % Math.max(1, Math.min(60, Number(escritorioCfgGatilho(it).s) || 5)) === 0);
}, 1000);

// Editor: configurar o item selecionado e escolher os móveis no mapa.
function configurarGatilhoEscritorio() {
  const e = escritorio.edicao, it = e?.itens[e.sel], d = it && ESCRITORIO_GATILHOS[it[0]];
  if (!d) return;
  const cfg = escritorioCfgGatilho(it), n = (cfg.m || []).length;
  const tipo = { gatilho: "Gatilho", condicao: "Condição", efeito: "Efeito" }[d.tipo];
  openWorkflowModal(`<div class="workflow-kicker">${tipo}</div><h2 class="workflow-title">${safeText(d.nome)}</h2><p>${safeText(d.dica)} Gatilhos, condições e efeitos no mesmo ladrilho trabalham juntos.</p>
<form class="ofc-gatilho" onsubmit="event.preventDefault();salvarGatilhoEscritorio(this)">
${d.texto ? `<label>${safeText(d.texto)}<input name="t" maxlength="100" value="${safeText(cfg.t || "")}" required></label>` : ""}
${d.segundos ? `<label>A cada (segundos)<input name="s" type="number" min="1" max="60" step="1" value="${Number(cfg.s) || 5}" required></label>` : ""}
${d.moveis ? `<p class="ofc-nota">${n ? `${n} ${n === 1 ? "móvel escolhido" : "móveis escolhidos"}.` : "Nenhum móvel escolhido ainda."}</p>` : ""}
<div class="workflow-actions">${d.moveis ? `<button type="button" class="workflow-secondary" onclick="escolherMoveisGatilhoEscritorio()">Escolher móveis no mapa</button>` : ""}${d.texto || d.segundos ? `<button type="submit" class="workflow-primary">Salvar</button>` : `<button type="button" class="workflow-primary" onclick="closeWorkflowModal()">Pronto</button>`}</div>
</form>`);
}
function salvarGatilhoEscritorio(form) {
  const e = escritorio.edicao, it = e?.itens[e.sel];
  if (!it) return closeWorkflowModal();
  const cfg = { ...escritorioCfgGatilho(it) };
  if (form.elements.t) cfg.t = form.elements.t.value.trim().slice(0, 100);
  if (form.elements.s) cfg.s = Math.max(1, Math.min(60, Math.round(Number(form.elements.s.value) || 5)));
  it[6] = cfg;
  closeWorkflowModal();
  escritorioEditorMudou();
}
function escolherMoveisGatilhoEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.sel === null) return;
  closeWorkflowModal();
  e.alvos = e.sel;
  renderBarraEditorEscritorio();
  escritorioMostrarAlvosGatilho();
}
// Clique no mapa durante a escolha: põe ou tira o móvel clicado da lista.
function escolherAlvoGatilhoEscritorio(lx, ly) {
  const e = escritorio.edicao, it = e?.itens[e.alvos];
  if (!it) { if (e) e.alvos = null; return; }
  const c = escritorioCantoCamada(e.camada);
  const movel = (escritorio.mapa?.moveisEm(Math.floor(lx) + c.x, Math.floor(ly) + c.y) || []).find((q) => !ESCRITORIO_GATILHOS[q.classe]);
  if (!movel) return escritorioAviso("Clique num móvel.");
  const x = Math.floor(movel.x) - c.x, y = Math.floor(movel.y) - c.y, cfg = { ...escritorioCfgGatilho(it) }, m = [...(cfg.m || [])];
  const i = m.findIndex(([a, b, k]) => a === x && b === y && (!k || k === movel.classe));
  if (i >= 0) m.splice(i, 1);
  else if (m.length >= ESCRITORIO_GATILHO_MAX_MOVEIS) return escritorioAviso(`No máximo ${ESCRITORIO_GATILHO_MAX_MOVEIS} móveis.`);
  else m.push([x, y, movel.classe]);
  it[6] = { ...cfg, m };
  escritorioEditorMudou();
  escritorioMostrarAlvosGatilho();
}
function terminarAlvosGatilhoEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.alvos == null) return;
  e.alvos = null;
  escritorio.mapa?.realcarVarios?.([]);
  renderBarraEditorEscritorio();
}
// Os móveis escolhidos ficam realçados enquanto se escolhe.
function escritorioMostrarAlvosGatilho() {
  const e = escritorio.edicao, it = e?.itens[e.alvos];
  if (!it || !escritorio.mapa?.realcarVarios) return;
  const c = escritorioCantoCamada(e.camada);
  escritorio.mapa.realcarVarios((escritorioCfgGatilho(it).m || []).map(([x, y, k]) => escritorioMovelEscolhido([x + c.x, y + c.y, k])).filter(Boolean));
}
