// vybe-captacoes.js — Captações na Produção (decisão do Paulo, 21/10/2026:
// "o fluxo fica dentro do sistema e todos têm que usar"; docs/captacao-plano.md).
// Uma agenda só, desenhada como a semana de um calendário: os eventos do Google
// Agenda da Vybe por dia e hora, pintados pelo tipo (azul é captação, amarelo é
// reunião, o resto é compromisso). A mesma semana (agendaSemanaHtml) abre no
// Escritório pelo ícone da agenda, só para consulta. Aqui ela conversa com a
// fila: clicar num evento abre o detalhe ao lado, com as peças do cliente para
// ligar àquela captação; arrastar um cliente para um horário, ou clicar num
// horário vazio, marca a captação ali. As regras ficam no servidor
// (server/captacoes.js); esta tela só mostra e pede.
// A tela responde as perguntas do Paulo (21/10/2026) sem caçar: quais
// captações tem na semana e em que dia (Semana ou Lista, filtro por tipo), se
// cada uma tem peças e roteiro (o estado no bloco), e o que precisa de alguém
// agora: marcar, ligar peças, cadastrar o que só está no Google e escrever
// roteiro (o painel do lado, pelos próximos 30 dias).
const CAPT = { pecas: null, captacoes: null, agenda: [], proximas: [], avisoAgenda: "", erro: "", carregando: false, carregandoSemana: false,
  busca: "", abertos: new Set(), semana: "", dia: "", sel: "", vista: "semana", tipos: new Set(["captacao"]), grupo: "" };

const AG_TIPOS = { captacao: "Captação", reuniao: "Reunião", outro: "Compromisso" };
const AG_HORA_PX = 52, AG_TOPO = 10;
const agHoje = () => (typeof hojeDeVerdade === "function" && hojeDeVerdade()) || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(new Date());
const agSomar = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const agSegunda = (iso) => { const d = new Date(`${iso}T12:00:00Z`); return agSomar(iso, -((d.getUTCDay() + 6) % 7)); };
const agMin = (h) => { const m = String(h || "").match(/^(\d{2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const agHora = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const agDiaSemana = (iso, estilo = "short") => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: estilo, timeZone: "UTC" }).replace(".", "").replace(/-feira$/, "");
function agPeriodo(inicio) {
  const fim = agSomar(inicio, 6), a = new Date(`${inicio}T12:00:00Z`), b = new Date(`${fim}T12:00:00Z`);
  const mes = (d) => d.toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()} – ${b.getUTCDate()} de ${mes(b)}` : `${a.getUTCDate()} de ${mes(a)} – ${b.getUTCDate()} de ${mes(b)}`;
}
const agHorario = (e) => e.inicio ? `${e.inicio}${e.fim ? `–${e.fim}` : ""}` : "Dia inteiro";

// A semana como no calendário: colunas por dia, horas à esquerda, eventos pelo
// horário e lado a lado quando se cruzam. No celular vira a lista do dia
// escolhido na faixa de dias. `acoes` diz o que clicar faz (nomes de funções
// globais): evento(id), vazio(dia, hora), soltar(cliente, dia, hora) e dia(iso).
// Cada evento: { id, titulo, dia, inicio, fim, tipo, cliente, local, estado: { tom, texto } }.
function agendaSemanaHtml({ inicio, eventos = [], dia = "", sel = "", acoes = {} }) {
  const hoje = agHoje(), dias = Array.from({ length: 7 }, (_, i) => agSomar(inicio, i));
  const escolhido = dias.includes(dia) ? dia : dias.includes(hoje) ? hoje : dias[0];
  const comHora = eventos.filter((e) => agMin(e.inicio) !== null), diaTodo = eventos.filter((e) => agMin(e.inicio) === null);
  const ini = Math.min(7 * 60, ...comHora.map((e) => Math.floor(agMin(e.inicio) / 60) * 60));
  const fim = Math.max(20 * 60, ...comHora.map((e) => Math.ceil((agMin(e.fim) ?? agMin(e.inicio) + 60) / 60) * 60));
  // Um respiro em cima para a primeira hora não ficar sob o cabeçalho.
  const px = (min) => AG_TOPO + ((min - ini) / 60) * AG_HORA_PX;
  const rotulo = (e) => `${AG_TIPOS[e.tipo] || "Compromisso"}: ${e.titulo}, ${agDiaSemana(e.dia, "long")} ${agHorario(e)}${e.cliente ? `, ${e.cliente}` : ""}${e.estado ? `, ${e.estado.texto}` : ""}`;
  const clicar = (e) => acoes.evento ? ` onclick="event.stopPropagation();${acoes.evento}('${safeText(e.id)}')"` : "";
  const bloco = (e, estilo = "", curto = false, recuado = false) => `<button type="button" data-ev="${safeText(e.id)}" class="ag-ev${recuado ? " recuado" : ""} t-${safeText(e.tipo || "outro")}${e.id === sel ? " sel" : ""}${curto ? " curto" : ""}${e.estado ? ` tom-${e.estado.tom}` : ""}"${estilo}${clicar(e)} aria-label="${safeText(rotulo(e))}" aria-pressed="${e.id === sel}">
      <b>${safeText(e.titulo || "Sem título")}</b><small>${safeText([e.inicio ? agHorario(e) : "", curto ? "" : e.cliente].filter(Boolean).join(" · "))}</small>${e.estado ? `<span class="ag-selo tom-${e.estado.tom}">${safeText(e.estado.texto)}</span>` : ""}</button>`;
  // Eventos que se cruzam dividem a coluna (faixas).
  const posicionar = (lista) => {
    const ordem = [...lista].sort((a, b) => agMin(a.inicio) - agMin(b.inicio)), faixas = [], grupo = [];
    let fimGrupo = -1;
    // Quem começa junto divide a coluna; quem começa depois fica por cima, um
    // pouco recuado (como no calendário), para o título continuar legível.
    const fechar = () => { const n = Math.max(1, ...grupo.map((g) => g.faixa + 1)), juntos = Math.max(...grupo.map((g) => g.a)) - Math.min(...grupo.map((g) => g.a)) <= 20;
      grupo.forEach((g) => { g.n = n; g.lado = juntos; }); grupo.length = 0; faixas.length = 0; };
    const fora = ordem.map((e) => {
      const a = agMin(e.inicio), b = Math.max(a + 20, agMin(e.fim) ?? a + 60);
      if (a >= fimGrupo && grupo.length) fechar();
      let f = faixas.findIndex((x) => x <= a); if (f < 0) { f = faixas.length; faixas.push(b); } else faixas[f] = b;
      const item = { e, a, b, faixa: f, n: 1 }; grupo.push(item); fimGrupo = Math.max(fimGrupo, b); return item;
    });
    if (grupo.length) fechar();
    return fora;
  };
  const agora = new Date(), agoraMin = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bahia", hour: "2-digit", hourCycle: "h23" }).format(agora)) * 60 + agora.getMinutes();
  const horas = []; for (let m = ini; m < fim; m += 60) horas.push(m);
  const largado = acoes.soltar ? ` ondragover="agSobre(event)" ondragleave="this.classList.remove('alvo')" ondrop="agSoltar(event,'${acoes.soltar}',${ini})"` : "";
  const vazio = (d) => acoes.vazio ? ` onclick="agVazio(event,'${acoes.vazio}','${d}',${ini})" title="Clique num horário para marcar uma captação"` : "";
  const grade = `<div class="ag-semana" role="grid" aria-label="Semana de ${safeText(agPeriodo(inicio))}">
    <div class="ag-cabeca"><span></span>${dias.map((d) => `<div class="ag-dia-cab${d === hoje ? " hoje" : ""}" role="columnheader"><small>${safeText(agDiaSemana(d))}</small><b>${Number(d.slice(8))}</b></div>`).join("")}</div>
    ${diaTodo.length ? `<div class="ag-dia-todo"><span>dia todo</span>${dias.map((d) => `<div>${diaTodo.filter((e) => e.dia === d).map((e) => bloco(e)).join("")}</div>`).join("")}</div>` : ""}
    <div class="ag-corpo" data-ag-rolar="${Math.max(0, px(Math.max(ini, 7 * 60)) - AG_TOPO)}">
      <div class="ag-horas" style="height:${px(fim) + AG_TOPO}px">${horas.map((m) => `<span style="top:${px(m)}px">${agHora(m)}</span>`).join("")}</div>
      ${dias.map((d) => `<div class="ag-col${d === hoje ? " hoje" : ""}" data-dia="${d}" style="height:${px(fim) + AG_TOPO}px"${vazio(d)}${largado}>
        ${horas.map((m) => `<i class="ag-linha" style="top:${px(m)}px"></i>`).join("")}
        ${d === hoje && agoraMin >= ini && agoraMin <= fim ? `<i class="ag-agora" style="top:${px(agoraMin)}px" aria-hidden="true"></i>` : ""}
        ${posicionar(comHora.filter((e) => e.dia === d)).map(({ e, a, b, faixa, n, lado }) => { const h = Math.max(26, px(b) - px(a) - 2);
          // Quantas linhas de título cabem no bloco (o resto vira reticências).
          const linhas = Math.max(1, Math.min(3, Math.floor((h - 26) / 15) + 1));
          const pos = lado || n === 1 ? `left:calc(${(faixa / n) * 100}% + 2px);width:calc(${100 / n}% - 4px)` : `left:calc(${faixa * 16}% + 2px);width:calc(${100 - faixa * 16}% - 4px);z-index:${2 + faixa}`;
          return bloco(e, ` style="top:${px(a)}px;height:${h}px;${pos};--linhas:${linhas}"`, h < 60 || (lado && n > 1), !lado && faixa > 0); }).join("")}
      </div>`).join("")}
    </div></div>`;
  // Celular: faixa de dias e a lista do dia.
  const faixa = `<div class="ag-faixa" role="tablist" aria-label="Dia">${dias.map((d) => { const n = eventos.filter((e) => e.dia === d && e.tipo === "captacao").length;
    return `<button type="button" role="tab" class="ag-faixa-dia${d === hoje ? " hoje" : ""}" aria-selected="${d === escolhido}" aria-label="${safeText(agDiaSemana(d, "long"))} ${Number(d.slice(8))}${n ? `, ${n} ${n === 1 ? "captação" : "captações"}` : ""}" onclick="${acoes.dia || "agDiaLocal"}('${d}',this)"><small>${safeText(agDiaSemana(d))}</small><b>${Number(d.slice(8))}</b><i aria-hidden="true">${"<em></em>".repeat(Math.min(n, 3))}</i></button>`; }).join("")}</div>
    <div class="ag-lista">${dias.map((d) => { const lista = eventos.filter((e) => e.dia === d).sort((a, b) => (agMin(a.inicio) ?? -1) - (agMin(b.inicio) ?? -1));
      return `<div class="ag-lista-dia" data-dia="${d}"${d === escolhido ? "" : " hidden"}>${lista.length ? lista.map((e) => bloco(e)).join("") : `<p class="ag-nada">Nada na agenda ${d === hoje ? "hoje" : `na ${safeText(agDiaSemana(d, "long"))}`}.</p>`}</div>`; }).join("")}</div>`;
  return `<div class="ag">${grade}<div class="ag-movel">${faixa}</div></div>`;
}
// O cartão do evento abre ao lado do bloco clicado, como no calendário (Paulo,
// 21/10/2026: "abrir o hover com tudo daquela captação, ao invés de descer").
// No celular sobe de baixo. Fecha no ×, no Esc ou clicando fora; `aoFechar`
// é o nome da função global que limpa a escolha.
function agCartaoAbrir(id, html, aoFechar = "") {
  let pop = document.getElementById("ag-cartao");
  if (!pop) {
    pop = document.createElement("div"); pop.id = "ag-cartao"; pop.className = "ag-cartao"; pop.setAttribute("role", "dialog");
    document.body.append(pop);
    document.addEventListener("mousedown", (ev) => { const p = document.getElementById("ag-cartao"); if (p && !p.hidden && !p.contains(ev.target) && !ev.target.closest(".ag-ev,.capt-linha,.capt-pend-texto")) agCartaoFechar(); }, true);
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !document.getElementById("ag-cartao")?.hidden) agCartaoFechar(); });
  }
  pop.dataset.fechar = aoFechar; pop.dataset.ev = id;
  pop.innerHTML = `<button type="button" class="ag-cartao-fechar" aria-label="Fechar" onclick="agCartaoFechar()">×</button>${html}`;
  pop.setAttribute("aria-label", pop.querySelector("h4")?.textContent || "Evento");
  pop.hidden = false;
  agCartaoPosicionar();
}
function agCartaoPosicionar() {
  const pop = document.getElementById("ag-cartao");
  if (!pop || pop.hidden) return;
  const ancora = [...document.querySelectorAll(`[data-ev="${CSS.escape(pop.dataset.ev || "")}"]`)].find((el) => el.offsetParent !== null);
  const estreito = window.innerWidth < 700;
  pop.classList.toggle("folha", estreito || !ancora);
  if (estreito || !ancora) { pop.style.left = pop.style.top = ""; return; }
  const r = ancora.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, m = 12;
  const direita = r.right + m + w <= window.innerWidth - m;
  pop.style.left = `${Math.max(m, direita ? r.right + m : r.left - m - w)}px`;
  pop.style.top = `${Math.max(m, Math.min(r.top, window.innerHeight - h - m))}px`;
  pop.classList.toggle("a-esquerda", !direita);
}
function agCartaoFechar() {
  const pop = document.getElementById("ag-cartao");
  if (!pop || pop.hidden) return;
  pop.hidden = true; pop.innerHTML = "";
  if (pop.dataset.fechar) window[pop.dataset.fechar]?.();
}
window.addEventListener("resize", () => agCartaoPosicionar());
document.addEventListener("scroll", () => agCartaoPosicionar(), true);
// Troca de dia no celular sem recarregar nada (usado pelo Escritório).
function agDiaLocal(d, botao) {
  const ag = botao.closest(".ag");
  ag.querySelectorAll(".ag-faixa-dia").forEach((b) => b.setAttribute("aria-selected", String(b === botao)));
  ag.querySelectorAll(".ag-lista-dia").forEach((l) => (l.hidden = l.dataset.dia !== d));
}
// A grade abre rolada nas 7 h, como o calendário.
function agRolar(raiz = document) { raiz.querySelectorAll("[data-ag-rolar]").forEach((el) => { if (!el.dataset.agRolado) { el.scrollTop = Number(el.dataset.agRolar); el.dataset.agRolado = "1"; } }); }
function agHoraDoClique(ev, col, ini) {
  const y = ev.clientY - col.getBoundingClientRect().top - AG_TOPO, min = ini + Math.floor((y / AG_HORA_PX) * 2) * 30;
  return agHora(Math.max(0, Math.min(23 * 60, min)));
}
function agVazio(ev, funcao, dia, ini) { if (ev.target.closest(".ag-ev")) return; window[funcao]?.(dia, agHoraDoClique(ev, ev.currentTarget, ini)); }
function agSobre(ev) { if (![...(ev.dataTransfer?.types || [])].includes("text/vybe-cliente")) return; ev.preventDefault(); ev.dataTransfer.dropEffect = "copy"; ev.currentTarget.classList.add("alvo"); }
function agSoltar(ev, funcao, ini) {
  const cliente = ev.dataTransfer?.getData("text/vybe-cliente"); ev.currentTarget.classList.remove("alvo");
  if (!cliente) return; ev.preventDefault(); window[funcao]?.(cliente, ev.currentTarget.dataset.dia, agHoraDoClique(ev, ev.currentTarget, ini));
}

async function captPedir(params, corpo) {
  const r = await fetch(`/api/painel?area=captacoes${params ? "&" + params : ""}`, corpo
    ? { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }
    : { credentials: "same-origin", cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || "Não foi possível falar com o painel.");
  return d;
}
const captRender = () => { if (typeof renderProductionCommand === "function") renderProductionCommand(); };
function captGuardar(c) { CAPT.captacoes = c.captacoes || []; CAPT.agenda = c.agenda || []; CAPT.proximas = c.proximas || []; CAPT.avisoAgenda = c.aviso_agenda || ""; }
async function captCarregar() {
  if (CAPT.carregando) return;
  CAPT.carregando = true;
  CAPT.semana = CAPT.semana || agSegunda(agHoje());
  try {
    const [p, c] = await Promise.all([captPedir("acao=pecas"), captPedir(`semana=${CAPT.semana}`)]);
    CAPT.pecas = p.pecas || []; captGuardar(c); CAPT.erro = "";
  } catch (e) { CAPT.erro = e.message; }
  finally { CAPT.carregando = false; captRender(); }
}
function captRecarregar() { CAPT.pecas = null; captRender(); }
async function captIrSemana(passo) {
  CAPT.semana = passo === 0 ? agSegunda(agHoje()) : agSomar(CAPT.semana, 7 * passo);
  CAPT.dia = passo === 0 ? agHoje() : CAPT.semana; CAPT.sel = ""; CAPT.carregandoSemana = true; captRender();
  try { captGuardar(await captPedir(`semana=${CAPT.semana}`)); }
  catch (e) { CAPT.avisoAgenda = e.message; CAPT.agenda = []; }
  finally { CAPT.carregandoSemana = false; captRender(); }
}
function captDiaMovel(d) { CAPT.dia = d; captRender(); }
function captSelecionar(id) { CAPT.sel = CAPT.sel === id ? "" : id; captRender(); }
function captDesmarcar() { if (!CAPT.sel) return; CAPT.sel = ""; captRender(); }
// Depois de cada desenho da tela, o cartão acompanha a escolha (abre, troca o
// conteúdo depois de gravar algo, ou fecha).
function captCartaoAtualizar() {
  const e = CAPT.sel && captTodos().find((x) => x.id === CAPT.sel);
  if (e) agCartaoAbrir(e.id, captDetalheHtml(e), "captDesmarcar");
  else { const pop = document.getElementById("ag-cartao"); if (pop && !pop.hidden && pop.dataset.fechar === "captDesmarcar") { pop.hidden = true; pop.innerHTML = ""; } }
}
function captTipo(t) {
  if (CAPT.tipos.has(t) && CAPT.tipos.size > 1) CAPT.tipos.delete(t); else CAPT.tipos.add(t);
  captRender();
}
function captVista(v) { CAPT.vista = v; captRender(); }
function captGrupo(g) { CAPT.grupo = g; captRender(); document.querySelector(".capt-lado")?.scrollIntoView({ block: "nearest" }); }
function captAbrirPeca(id) { if (typeof window.openItemWorkspace === "function") window.openItemWorkspace(String(id)); }
function captCadastrar(cliente) { if (typeof openCadastrosGoverned === "function") openCadastrosGoverned({ board: "producao", client: cliente || "" }); }

const captHoje = agHoje;
const captDiasAte = (iso) => Math.round((new Date(`${iso}T12:00:00`) - new Date(`${captHoje()}T12:00:00`)) / 864e5);
const captDia = (iso) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "") : "sem data";
const captDiaLongo = (iso) => { const n = captDiasAte(iso); if (n === 0) return "Hoje"; if (n === 1) return "Amanhã";
  const t = new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }).replace("-feira", ""); return t.charAt(0).toUpperCase() + t.slice(1); };
const captQuando = (e) => `${captDiaLongo(e.dia)}${e.inicio ? ` · ${e.inicio}` : ""}`;
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
// Além das peças em "Agendar Captação", a captação recebe as que vão ser
// gravadas e ainda não entraram na Captação (sem_material): a de fotos pelo
// título ("Serra grande - Banco de imagem", "Fotos do cardápio", "Ensaio")
// recebe as fotografias sem banco de fotos; as outras recebem os vídeos sem
// captação. Sem evento (a fila), entram todas.
const captSemSinais = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const captEhFotos = (e) => /banco de (imagem|imagens|foto|fotos)|\bfotos?\b|fotografia|ensaio/.test(captSemSinais(e?.titulo));
const captPendentesDo = (clienteId, e = null) => (CAPT.pecas || []).filter((p) => clienteId && p.clientes?.some((c) => c.id === clienteId) && (!e || !p.sem_material || (p.tipo === "foto") === captEhFotos(e)));
const captFaltaRotulo = (p) => p.tipo === "foto" ? "sem banco de fotos" : "sem captação";
const captPlural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// O estado de uma captação, o mesmo no bloco, na lista e no detalhe:
// pronta (peças ligadas, todas com roteiro), falta roteiro, peças esperando
// (o cliente tem peças, mas ainda não estão nesta captação), nada no sistema
// (está só no Google) ou cliente não reconhecido pelo título.
function captEstado(e) {
  if (e.tipo !== "captacao") return null;
  const k = e.nossa;
  if (k) {
    const falta = k.pecas.filter((p) => !p.gravado && !captTemRoteiro(p)).length, gravadas = k.pecas.filter((p) => p.gravado).length;
    if (k.aviso) return { tom: "alerta", texto: "Fora do Google Agenda" };
    if (gravadas === k.pecas.length) return { tom: "ok", texto: "Gravada" };
    return falta ? { tom: "atencao", texto: `${captPlural(falta, "peça", "peças")} sem roteiro` } : { tom: "ok", texto: `Pronta · ${captPlural(k.pecas.length, "peça", "peças")}` };
  }
  if (!e.cliente_id) return { tom: "alerta", texto: "Cliente não reconhecido" };
  const n = captPendentesDo(e.cliente_id, e).length;
  return n ? { tom: "atencao", texto: `${captPlural(n, "peça esperando", "peças esperando")}` } : { tom: "alerta", texto: "Nada no sistema" };
}

// Fila por cliente (peça com vários clientes entra no primeiro, sem duplicar),
// das mais urgentes para as outras; a próxima captação vem dos próximos 30 dias.
function captProximaDo(clienteId) {
  const hoje = captHoje();
  return [...(CAPT.proximas || []), ...(CAPT.agenda || []).filter((e) => e.tipo === "captacao")]
    .filter((e) => e.cliente_id && e.cliente_id === clienteId && e.dia >= hoje)
    .sort((a, b) => (a.dia + a.inicio).localeCompare(b.dia + b.inicio))[0] || null;
}
function captFila() {
  const grupos = new Map();
  for (const p of CAPT.pecas || []) {
    const c = p.clientes?.[0] || { id: "", nome: "Sem cliente" };
    if (!grupos.has(c.id)) grupos.set(c.id, { cliente: c, pecas: [] });
    grupos.get(c.id).pecas.push(p);
  }
  return [...grupos.values()].map((g) => {
    g.pecas.sort((a, b) => String(a.prazo || a.veiculacao || "9999").localeCompare(String(b.prazo || b.veiculacao || "9999")));
    g.vencidas = g.pecas.filter((p) => captPrazo(p).tom === "alerta").length;
    g.semRoteiro = g.pecas.filter((p) => p.tipo !== "foto" && !captTemRoteiro(p)).length;
    g.semMaterial = g.pecas.filter((p) => p.sem_material).length;
    g.proxima = captProximaDo(g.cliente.id);
    return g;
  }).sort((a, b) => b.vencidas - a.vencidas || String(a.pecas[0]?.prazo || "9999").localeCompare(String(b.pecas[0]?.prazo || "9999")) || a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR"));
}

// Eventos: os do Google com o que foi montado aqui, mais a captação montada que
// não entrou no Google (com o aviso). `lista` são os eventos do Google.
function captComNossas(lista, { semana = false } = {}) {
  const nossas = new Map((CAPT.captacoes || []).map((k) => [k.id, k]));
  const fora = lista.map((e) => ({ ...e, nossa: nossas.get(e.captacao_id) || null }));
  const fim = agSomar(CAPT.semana, 6);
  for (const k of CAPT.captacoes || []) if (!fora.some((e) => e.nossa?.id === k.id) && (!semana || (k.dia >= CAPT.semana && k.dia <= fim)))
    fora.push({ id: `k${k.id}`, titulo: `Captação · ${k.cliente}`, dia: k.dia, inicio: k.inicio || "", fim: k.fim || "", tipo: "captacao", local: k.local, cliente: k.cliente, cliente_id: k.cliente_id, nossa: k });
  return fora.map((e) => ({ ...e, estado: captEstado(e) }));
}
const captEventos = () => captComNossas(CAPT.agenda || [], { semana: true });
const captTodos = () => { const vistos = new Set(); return [...captEventos(), ...captComNossas(CAPT.proximas || [])].filter((e) => !vistos.has(e.id) && vistos.add(e.id)); };

// O que precisa de alguém nos próximos 30 dias.
function captPendencias() {
  const hoje = captHoje(), ate = agSomar(hoje, 30);
  const futuras = captComNossas(CAPT.proximas || []).filter((e) => e.dia >= hoje && e.dia <= ate);
  const semNossa = futuras.filter((e) => !e.nossa);
  const ligar = semNossa.filter((e) => e.cliente_id && captPendentesDo(e.cliente_id, e).length);
  const cadastrar = semNossa.filter((e) => !e.cliente_id || !captPendentesDo(e.cliente_id, e).length);
  const marcar = captFila().filter((g) => g.cliente.id && !g.proxima);
  const roteiro = [];
  for (const e of futuras) {
    const pecas = e.nossa ? e.nossa.pecas.filter((p) => !p.gravado) : captPendentesDo(e.cliente_id, e);
    for (const p of pecas) if (p.tipo !== "foto" && !captTemRoteiro(p) && !roteiro.some((r) => r.p.id === p.id)) roteiro.push({ p, e });
  }
  // Vídeo cadastrado sem captação e sem roteiro: o roteiro vem antes de marcar.
  for (const p of CAPT.pecas || []) if (p.sem_material && p.tipo === "video" && !captTemRoteiro(p) && !roteiro.some((r) => r.p.id === p.id))
    roteiro.push({ p, e: null });
  return { ligar, cadastrar, marcar, roteiro };
}
const CAPT_GRUPOS = [
  ["ligar", "Ligar peças", "Captações na agenda cujo cliente tem peças esperando: leve as peças para a captação."],
  ["cadastrar", "Cadastrar", "Captações que estão no Google Agenda e não têm nada no sistema."],
  ["marcar", "Marcar captação", "Clientes com peças para captar e sem captação marcada nos próximos 30 dias."],
  ["roteiro", "Escrever roteiro", "Peças que vão ser gravadas e ainda não têm roteiro: as de captação marcada primeiro."],
  ["todos", "Todos os clientes", "Todas as peças em \"Agendar Captação\", por cliente."],
];

function captPecaHtml(p, { marcar = "", data = "" } = {}) {
  const prazo = captPrazo(p), roteiro = String(p.briefing || "").trim();
  const sinais = [
    p.formato ? `<span>${safeText(p.formato)}</span>` : "",
    p.prazo || p.veiculacao ? `<span class="capt-prazo ${prazo.tom}">${safeText(prazo.texto)}</span>` : "",
    data ? `<span class="capt-sinal">${safeText(data)}</span>` : "",
    p.sem_material ? `<span class="capt-sinal atencao">${captFaltaRotulo(p)}${p.status ? ` · ${safeText(p.status)}` : ""}</span>` : "",
  ].join("");
  const rot = p.sem_material && p.tipo === "foto" ? "" : p.roteiro_doc ? `<a class="capt-sinal ok" href="${safeText(p.roteiro_doc.link)}" target="_blank" rel="noopener" title="${safeText(p.roteiro_doc.titulo)}">Roteiro no Docs</a>`
    : roteiro ? `<span class="capt-sinal ok">Roteiro no briefing</span>` : `<span class="capt-sinal alerta">Sem roteiro</span>`;
  return `<li class="capt-peca${p.gravado ? " gravada" : ""}">${marcar}<span class="capt-peca-texto"><button type="button" class="capt-peca-nome" onclick="captAbrirPeca('${safeText(p.id)}')" title="Abrir a peça">${safeText(p.titulo)}</button><small>${sinais}${rot}</small>
    ${roteiro ? `<details class="capt-roteiro"><summary>Ler o roteiro</summary><p>${safeText(roteiro)}</p></details>` : ""}</span></li>`;
}

// O detalhe do evento escolhido, no lugar das pendências.
function captDetalheHtml(e) {
  const k = e.nossa, pendentes = captPendentesDo(e.cliente_id, e), n = captDiasAte(e.dia), est = e.estado;
  const fotos = pendentes.filter((p) => p.sem_material), outras = pendentes.filter((p) => !p.sem_material);
  const topo = `<span class="capt-tipo t-${safeText(e.tipo)}">${safeText(AG_TIPOS[e.tipo] || "Compromisso")}</span>
    <h4>${safeText(e.titulo || "Sem título")}</h4>
    <p class="capt-detalhe-quando">${safeText(captDiaLongo(e.dia))}${n === 0 || n === 1 ? `, ${safeText(captDia(e.dia))}` : ""} · ${safeText(agHorario(e))}${e.local ? `<br>${safeText(e.local)}` : ""}</p>
    ${est ? `<span class="capt-estado tom-${est.tom}">${safeText(est.texto)}</span>` : ""}
    ${e.link ? `<a class="vb-link capt-detalhe-google" href="${safeText(e.link)}" target="_blank" rel="noopener">Abrir no Google Agenda</a>` : ""}`;
  if (e.tipo !== "captacao") return `<div class="capt-detalhe">${topo}<p class="capt-discreto">${e.tipo === "reuniao" ? "Reunião" : "Compromisso"} da agenda da Vybe. Só as captações (azuis) recebem peças.</p></div>`;
  const cliente = e.cliente ? `<p class="capt-detalhe-cliente">${safeText(e.cliente)}</p>` : '<p class="capt-aviso">Não reconheci o cliente pelo título. Ponha o nome do cliente no título do evento no Google Agenda.</p>';
  if (k) return `<div class="capt-detalhe">${topo}${cliente}${k.aviso ? `<p class="capt-aviso">${safeText(k.aviso)} <button type="button" class="vb-link" onclick="captAgenda('${k.id}')">Tentar de novo</button></p>` : ""}
    <h5>Peças desta captação <small>${k.pecas.filter((p) => p.gravado).length} de ${k.pecas.length} gravadas</small></h5>
    <ul class="capt-lista">${k.pecas.map((p) => captPecaHtml(p, { marcar: `<label class="capt-gravado" title="Gravado"><input type="checkbox" ${p.gravado ? "checked" : ""} onchange="captGravado('${k.id}','${p.id}',!this.checked)"><span class="sr-only">Gravado: ${safeText(p.titulo)}</span></label>` })).join("")}</ul>
    ${k.observacao ? `<p class="capt-discreto">${safeText(k.observacao)}</p>` : ""}
    ${k.estado === "agendada" ? `<button type="button" class="vb-link perigo" onclick="captCancelar('${k.id}',${k.evento_do_painel === false})">${k.evento_do_painel === false ? "Soltar as peças desta captação" : "Cancelar captação"}</button>` : ""}</div>`;
  return `<div class="capt-detalhe">${topo}${cliente}
    ${pendentes.length ? `${outras.length ? `<h5>Esperando captação <small>${captPlural(outras.length, "peça", "peças")}</small></h5><ul class="capt-lista">${outras.map((p) => captPecaHtml(p)).join("")}</ul>` : ""}
      ${fotos.length ? `<h5>${captEhFotos(e) ? "Fotografias sem banco de fotos" : "Vídeos ainda sem captação"} <small>${captPlural(fotos.length, "peça", "peças")}</small></h5><p class="capt-discreto">${captEhFotos(e) ? `Pelo título, esta captação é de fotos: as fotografias de ${safeText(e.cliente)} travadas sem material podem sair daqui.` : `Vídeos de ${safeText(e.cliente)} já cadastrados que ainda não entraram na Captação.`}</p><ul class="capt-lista">${fotos.map((p) => captPecaHtml(p)).join("")}</ul>` : ""}
      <button type="button" class="vb-botao principal" onclick="captAbrirMontar('${safeText(e.cliente_id)}',{evento:'${safeText(e.id)}'})">Levar peças para esta captação</button>`
    : e.cliente ? `<p class="capt-discreto">Nenhuma peça de ${safeText(e.cliente)} está em "Agendar Captação". Cadastre o que vai ser gravado para ligar aqui.</p>
      <button type="button" class="vb-botao principal" onclick="captCadastrar('${safeText(e.cliente)}')">Cadastrar peça de ${safeText(e.cliente)}</button>` : ""}</div>`;
}

function captFilaHtml(grupos) {
  const busca = CAPT.busca.trim().toLowerCase();
  const fila = grupos.filter((g) => !busca || g.cliente.nome.toLowerCase().includes(busca));
  if (!grupos.length) return "";
  if (!fila.length) return vbEstadoHtml({ titulo: "Nenhum cliente com esse nome", texto: "Confira a busca." });
  return fila.map((g) => {
    const aberto = CAPT.abertos.has(g.cliente.id);
    const proxima = g.proxima ? `<span class="capt-chip ok">captação ${safeText(captQuando(g.proxima).toLowerCase())}</span>` : '<span class="capt-chip">sem captação marcada</span>';
    const arrastar = g.cliente.id ? ` draggable="true" ondragstart="event.dataTransfer.setData('text/vybe-cliente','${safeText(g.cliente.id)}');event.dataTransfer.effectAllowed='copy';document.body.classList.add('ag-arrastando')" ondragend="document.body.classList.remove('ag-arrastando')"` : "";
    return `<details class="capt-cliente"${aberto ? " open" : ""}${arrastar} ontoggle="CAPT.abertos[this.open?'add':'delete']('${safeText(g.cliente.id)}')">
      <summary title="${g.cliente.id ? "Arraste para um horário da agenda para marcar a captação" : ""}"><span class="capt-cliente-nome"><b>${safeText(g.cliente.nome)}</b>
        <span class="capt-chips"><small>${captPlural(g.pecas.length, "peça", "peças")}</small>${g.vencidas ? `<span class="capt-chip alerta">${g.vencidas} ${g.vencidas === 1 ? "vencida" : "vencidas"}</span>` : ""}${g.semRoteiro ? `<span class="capt-chip atencao">${g.semRoteiro} sem roteiro</span>` : ""}${g.semMaterial ? `<span class="capt-chip atencao">${captPlural(g.semMaterial, "peça", "peças")} fora da Captação</span>` : ""}${proxima}</span></span>
        ${g.cliente.id ? `<button type="button" class="vb-botao" onclick="event.preventDefault();captAbrirMontar('${safeText(g.cliente.id)}')" aria-label="Marcar captação de ${safeText(g.cliente.nome)}">Marcar</button>` : ""}</summary>
      <ul class="capt-lista">${g.pecas.map((p) => captPecaHtml(p, { data: g.proxima ? `captação ${captDia(g.proxima.dia)}, não ligada` : "" })).join("")}</ul></details>`;
  }).join("");
}

// Uma captação da lista de pendências (ligar e cadastrar).
function captPendenciaEventoHtml(e, acao) {
  return `<li class="capt-pend"><button type="button" class="capt-pend-texto" onclick="captSelecionar('${safeText(e.id)}')"><b>${safeText(e.cliente || e.titulo)}</b>
      <small>${safeText(captQuando(e))}${e.cliente ? ` · ${safeText(e.titulo)}` : ""}</small><span class="capt-estado tom-${e.estado.tom}">${safeText(e.estado.texto)}</span></button>${acao}</li>`;
}
function captPendenciasHtml(pend) {
  const grupo = CAPT.grupo || CAPT_GRUPOS.find(([g]) => g !== "todos" && pend[g].length)?.[0] || "todos";
  const contar = (g) => g === "todos" ? captFila().length : pend[g].length;
  const chips = CAPT_GRUPOS.map(([g, nome]) => `<button type="button" class="vb-chip" aria-pressed="${g === grupo}" onclick="captGrupo('${g}')">${safeText(nome)} <b>${contar(g)}</b></button>`).join("");
  const explica = CAPT_GRUPOS.find(([g]) => g === grupo)[2];
  let corpo;
  if (grupo === "todos" || grupo === "marcar") {
    const lista = grupo === "todos" ? captFila() : pend.marcar;
    corpo = `<label class="capt-busca"><span class="sr-only">Buscar cliente</span><input type="search" placeholder="Buscar cliente" value="${safeText(CAPT.busca)}" oninput="CAPT.busca=this.value;const f=document.getElementById('capt-fila-lista');if(f)f.innerHTML=captFilaHtml(${grupo === "todos" ? "captFila()" : "captPendencias().marcar"})"></label>
      <div id="capt-fila-lista" class="capt-fila">${lista.length ? captFilaHtml(lista) : vbEstadoHtml({ tipo: "vazio", icone: "ok", titulo: grupo === "marcar" ? "Todo cliente com peça já tem captação marcada" : "Nenhuma peça esperando captação", texto: grupo === "marcar" ? "Quando surgir peça nova sem data, ela aparece aqui." : "Peças em \"Agendar Captação\" aparecem aqui, por cliente." })}</div>`;
  } else if (grupo === "roteiro") {
    corpo = pend.roteiro.length ? `<ul class="capt-lista">${pend.roteiro.map(({ p, e }) => captPecaHtml(p, { data: e ? `${e.cliente || ""} · captação ${captDia(e.dia)}` : `${p.clientes?.[0]?.nome || "sem cliente"} · ainda sem captação` })).join("")}</ul><p class="capt-discreto">Clique no nome da peça para escrever o roteiro no briefing, ou ligue um roteiro do Docs na aba Roteiros.</p>`
      : vbEstadoHtml({ icone: "ok", titulo: "Toda peça com captação marcada tem roteiro" });
  } else {
    const lista = pend[grupo];
    corpo = lista.length ? `<ul class="capt-lista">${lista.map((e) => captPendenciaEventoHtml(e, grupo === "ligar"
      ? `<button type="button" class="vb-botao principal" onclick="captAbrirMontar('${safeText(e.cliente_id)}',{evento:'${safeText(e.id)}'})">Ligar</button>`
      : e.cliente ? `<button type="button" class="vb-botao" onclick="captCadastrar('${safeText(e.cliente)}')">Cadastrar</button>` : `<button type="button" class="vb-botao" onclick="captSelecionar('${safeText(e.id)}')">Ver</button>`)).join("")}</ul>`
      : vbEstadoHtml({ icone: "ok", titulo: grupo === "ligar" ? "Nenhuma captação esperando peças" : "Toda captação da agenda tem algo no sistema" });
  }
  return `<div class="capt-coluna-topo"><h4>O que precisa de você</h4><small>próximos 30 dias</small></div>
    <div class="capt-grupos" role="group" aria-label="Pendências">${chips}</div><p class="capt-discreto">${safeText(explica)}</p>${corpo}`;
}

// A semana em lista: cada dia com o título inteiro, a hora, o cliente e o estado.
function captListaHtml(eventos) {
  const hoje = captHoje(), dias = Array.from({ length: 7 }, (_, i) => agSomar(CAPT.semana, i));
  const linha = (e) => `<li><button type="button" class="capt-linha t-${safeText(e.tipo)}${e.id === CAPT.sel ? " sel" : ""}" onclick="captSelecionar('${safeText(e.id)}')" aria-pressed="${e.id === CAPT.sel}">
      <span class="capt-linha-hora">${safeText(agHorario(e))}</span><span class="capt-linha-texto"><b>${safeText(e.titulo || "Sem título")}</b><small>${safeText([AG_TIPOS[e.tipo], e.cliente, e.local].filter(Boolean).join(" · "))}</small></span>
      ${e.estado ? `<span class="capt-estado tom-${e.estado.tom}">${safeText(e.estado.texto)}</span>` : ""}</button></li>`;
  const algum = dias.some((d) => eventos.some((e) => e.dia === d));
  if (!algum) return vbEstadoHtml({ titulo: "Nada na agenda nesta semana", texto: "Ligue os outros tipos na legenda ou troque de semana." });
  return `<div class="capt-semana-lista">${dias.map((d) => { const lista = eventos.filter((e) => e.dia === d).sort((a, b) => (agMin(a.inicio) ?? -1) - (agMin(b.inicio) ?? -1));
    return `<section class="capt-lista-dia${d === hoje ? " hoje" : ""}${lista.length ? "" : " vazio"}"><h5>${safeText(captDiaLongo(d))}${captDiasAte(d) <= 1 && captDiasAte(d) >= 0 ? ` <small>${safeText(captDia(d))}</small>` : ""}</h5>
      ${lista.length ? `<ul>${lista.map(linha).join("")}</ul>` : '<p class="capt-discreto">Nada.</p>'}</section>`; }).join("")}</div>`;
}

function captacoesHtml() {
  if (!CAPT.pecas && !CAPT.erro) { captCarregar(); return vbEstadoHtml({ tipo: "carregando", titulo: "Carregando as captações" }); }
  if (CAPT.erro) return vbEstadoHtml({ tipo: "erro", titulo: "Não deu para abrir as captações", texto: CAPT.erro, acao: '<button type="button" class="vb-botao" onclick="CAPT.erro=\'\';captRecarregar()">Tentar de novo</button>' });
  const pecas = CAPT.pecas || [], hoje = captHoje(), todosDaSemana = captEventos();
  const eventos = todosDaSemana.filter((e) => CAPT.tipos.has(e.tipo));
  const caps = todosDaSemana.filter((e) => e.tipo === "captacao"), pend = captPendencias();
  const vencidas = pecas.filter((p) => captPrazo(p).tom === "alerta").length;
  const deHoje = caps.filter((e) => e.dia === hoje).length;
  const resumo = vbResumoHtml([
    CAPT.semana === agSegunda(hoje) ? { valor: deHoje, rotulo: deHoje === 1 ? " captação hoje" : " captações hoje", tom: deHoje ? "ok" : "" } : null,
    { valor: caps.length, rotulo: caps.length === 1 ? " captação na semana" : " captações na semana", onclick: "CAPT.tipos=new Set(['captacao']);captVista('lista')" },
    pend.ligar.length ? { valor: pend.ligar.length, rotulo: pend.ligar.length === 1 ? " captação para ligar peças" : " captações para ligar peças", tom: pend.ligar.length ? "atencao" : "", onclick: "captGrupo('ligar')" } : null,
    pend.cadastrar.length ? { valor: pend.cadastrar.length, rotulo: pend.cadastrar.length === 1 ? " captação sem nada no sistema" : " captações sem nada no sistema", tom: pend.cadastrar.length ? "alerta" : "", onclick: "captGrupo('cadastrar')" } : null,
    pend.marcar.length ? { valor: pend.marcar.length, rotulo: pend.marcar.length === 1 ? " cliente sem captação marcada" : " clientes sem captação marcada", tom: pend.marcar.length ? "atencao" : "", onclick: "captGrupo('marcar')" } : null,
    pend.roteiro.length ? { valor: pend.roteiro.length, rotulo: pend.roteiro.length === 1 ? " peça para gravar sem roteiro" : " peças para gravar sem roteiro", tom: pend.roteiro.length ? "alerta" : "", onclick: "captGrupo('roteiro')" } : null,
    vencidas ? { valor: vencidas, rotulo: " com prazo vencido", tom: "alerta", onclick: "captGrupo('todos')" } : null,
  ]);
  const legenda = Object.entries(AG_TIPOS).map(([t, n]) => `<button type="button" class="ag-legenda-item t-${t}" aria-pressed="${CAPT.tipos.has(t)}" onclick="captTipo('${t}')">${n} <b>${todosDaSemana.filter((e) => e.tipo === t).length}</b></button>`).join("");
  setTimeout(() => { if (CAPT.vista === "semana") agRolar(); captCartaoAtualizar(); }, 0);
  return `<div class="capt">${resumo}
    <div class="capt-barra">
      <div class="capt-nav" role="group" aria-label="Semana"><button type="button" class="vb-botao" aria-label="Semana anterior" onclick="captIrSemana(-1)">‹</button><button type="button" class="vb-botao" onclick="captIrSemana(0)"${CAPT.semana === agSegunda(hoje) ? " disabled" : ""}>Hoje</button><button type="button" class="vb-botao" aria-label="Próxima semana" onclick="captIrSemana(1)">›</button></div>
      <h4 class="capt-periodo">${safeText(agPeriodo(CAPT.semana))}</h4>
      <div class="vb-alternar" role="group" aria-label="Ver como"><button type="button" aria-pressed="${CAPT.vista === "semana"}" onclick="captVista('semana')">Semana</button><button type="button" aria-pressed="${CAPT.vista === "lista"}" onclick="captVista('lista')">Lista</button></div>
      <div class="ag-legenda filtro" role="group" aria-label="Mostrar na agenda">${legenda}</div>
      <button type="button" class="vb-botao principal" onclick="captAbrirMontar('')">Marcar captação</button></div>
    ${CAPT.avisoAgenda ? `<p class="capt-aviso">${safeText(CAPT.avisoAgenda)}</p>` : ""}
    <div class="capt-colunas">
      <section class="capt-agenda${CAPT.carregandoSemana ? " carregando" : ""}" aria-label="Agenda da semana" aria-busy="${CAPT.carregandoSemana}">${CAPT.vista === "lista" ? captListaHtml(eventos)
        : agendaSemanaHtml({ inicio: CAPT.semana, eventos, dia: CAPT.dia, sel: CAPT.sel, acoes: { evento: "captSelecionar", vazio: "captMarcarEm", soltar: "captSoltarCliente", dia: "captDiaMovel" } })}
        ${CAPT.vista === "semana" ? '<p class="capt-dica">Arraste um cliente para um horário, ou clique num horário vazio, para marcar a captação.</p>' : ""}</section>
      <aside class="capt-lado" aria-label="O que precisa de você">${captPendenciasHtml(pend)}</aside>
    </div></div>`;
}

function captMarcarEm(dia, hora) { captAbrirMontar("", { dia, inicio: hora }); }
function captSoltarCliente(cliente, dia, hora) { captAbrirMontar(cliente, { dia, inicio: hora }); }

// Marcar captação: o cliente (escolhido ou vindo da fila), as peças, o dia e
// o horário. Com `evento`, as peças vão para a captação que já está no Google.
function captAbrirMontar(clienteId, { dia = "", inicio = "", evento = "" } = {}) {
  agCartaoFechar();
  const fila = captFila().filter((g) => g.cliente.id);
  if (!fila.length) { showToast("Nenhuma peça esperando captação agora.", "info"); return; }
  const ev = evento ? captTodos().find((e) => e.id === evento) : null;
  const g = fila.find((x) => x.cliente.id === clienteId);
  const fim = inicio && agMin(inicio) !== null ? agHora(Math.min(23 * 60 + 30, agMin(inicio) + 120)) : "11:00";
  const quando = ev ? `<p class="capt-quando-fixo">${safeText(captDiaLongo(ev.dia))} · ${safeText(agHorario(ev))}${ev.local ? ` · ${safeText(ev.local)}` : ""}<small>Já está no Google Agenda. As peças entram nessa captação, sem criar outro evento.</small></p>`
    : `<div class="capt-campos"><label>Dia<input type="date" name="dia" required value="${safeText(dia || g?.proxima?.dia || agSomar(captHoje(), 1))}" min="${captHoje()}"></label>
      <label>Começa<input type="time" name="inicio" value="${safeText(inicio || "09:00")}"></label><label>Termina<input type="time" name="fim" value="${safeText(fim)}"></label></div>
      <label>Local<input name="local" maxlength="300" placeholder="Ex.: no restaurante, estúdio da Vybe"></label>`;
  openWorkflowModal(`<div class="workflow-kicker"><span>Captação</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">${ev ? "Levar peças para a captação" : "Marcar captação"}</h2>
    <form class="capt-form" onsubmit="event.preventDefault();captMontar(this)" data-evento="${safeText(evento)}">
      ${g ? `<input type="hidden" name="cliente" value="${safeText(g.cliente.id)}"><p class="capt-detalhe-cliente">${safeText(g.cliente.nome)}</p>`
        : `<label>Cliente<select name="cliente" required onchange="captPecasDoForm(this.form,this.value)"><option value="">Escolha o cliente</option>${fila.map((x) => `<option value="${safeText(x.cliente.id)}">${safeText(x.cliente.nome)} (${captPlural(x.pecas.length, "peça", "peças")})</option>`).join("")}</select></label>`}
      <fieldset class="capt-pecas-form"${g ? "" : " hidden"}>${g ? captPecasFieldset(g, ev) : ""}</fieldset>
      ${quando}
      <label>Observação<textarea name="observacao" rows="2" maxlength="2000" placeholder="O que levar, quem acompanha…"></textarea></label>
      <p class="capt-erro" role="alert" hidden></p>
      <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="submit" class="workflow-primary">${ev ? "Levar as peças" : "Marcar captação"}</button></div>
    </form>`);
}
function captPecasFieldset(g, ev = null) {
  const pecas = ev ? captPendentesDo(g.cliente.id, ev) : g.pecas;
  return `<legend>Peças (${pecas.length})</legend>${pecas.map((p) => { const pr = captPrazo(p); return `<label class="capt-escolha"><input type="checkbox" name="peca" value="${safeText(p.id)}" checked><span><b>${safeText(p.titulo)}</b><small>${safeText([p.formato, pr.texto].filter(Boolean).join(" · "))}${p.sem_material ? ` · ${captFaltaRotulo(p)}` : ""}${p.tipo !== "foto" && !captTemRoteiro(p) ? " · sem roteiro" : ""}</small></span></label>`; }).join("")}`;
}
function captPecasDoForm(form, clienteId) {
  const g = captFila().find((x) => x.cliente.id === clienteId), fs = form.querySelector(".capt-pecas-form");
  fs.innerHTML = g ? captPecasFieldset(g) : ""; fs.hidden = !g;
}
async function captMontar(form) {
  const f = new FormData(form), erro = form.querySelector(".capt-erro"), botao = form.querySelector("[type=submit]"), rotulo = botao.textContent;
  const pecas = f.getAll("peca"), cliente = f.get("cliente"), evento = form.dataset.evento;
  const ev = evento ? captTodos().find((e) => e.id === evento) : null;
  if (!cliente) { erro.textContent = "Escolha o cliente."; erro.hidden = false; return; }
  if (!pecas.length) { erro.textContent = "Escolha ao menos uma peça."; erro.hidden = false; return; }
  botao.disabled = true; botao.textContent = "Salvando…";
  try {
    const dados = ev ? { dia: ev.dia, inicio: ev.inicio || "", fim: ev.fim || "", local: ev.local || "", evento_google: ev.id }
      : { dia: f.get("dia"), inicio: f.get("inicio") || "", fim: f.get("fim") || "", local: f.get("local") || "" };
    const r = await captPedir("", { acao: "montar", cliente_id: cliente, pecas, observacao: f.get("observacao") || "", ...dados });
    closeWorkflowModal();
    showToast(r.avisos?.length ? `Captação marcada. ${r.avisos[0]}` : ev ? "Peças ligadas à captação." : "Captação marcada e no Google Agenda.", r.avisos?.length ? "info" : "ok", 6000);
    if (typeof refreshData === "function") refreshData();
    CAPT.semana = agSegunda(dados.dia); CAPT.dia = dados.dia;
    CAPT.sel = ev ? ev.id : ""; captRecarregar();
  } catch (e) { erro.textContent = e.message; erro.hidden = false; botao.disabled = false; botao.textContent = rotulo; }
}
async function captGravado(id, peca, desfazer) {
  try { await captPedir("", { acao: "gravado", captacao_id: id, conteudo_id: peca, desfazer }); if (typeof refreshData === "function") refreshData(); }
  catch (e) { showToast(e.message, "err", 6000); }
  captRecarregar();
}
async function captCancelar(id, doGoogle = false) {
  if (!confirm(doGoogle ? "Soltar as peças desta captação? As não gravadas voltam para \"Agendar Captação\". O evento continua no Google Agenda." : "Cancelar esta captação? As peças não gravadas voltam para \"Agendar Captação\" e o evento sai do Google Agenda.")) return;
  try { const r = await captPedir("", { acao: "cancelar", id }); showToast(r.avisos?.[0] || (doGoogle ? "Peças soltas da captação." : "Captação cancelada."), r.avisos?.length ? "info" : "ok", 6000); if (typeof refreshData === "function") refreshData(); }
  catch (e) { showToast(e.message, "err", 6000); }
  CAPT.sel = ""; captRecarregar();
}
async function captAgenda(id) {
  try { const r = await captPedir("", { acao: "agenda", id }); showToast(r.avisos?.[0] || "Captação no Google Agenda.", r.avisos?.length ? "info" : "ok", 6000); }
  catch (e) { showToast(e.message, "err", 6000); }
  captRecarregar();
}
