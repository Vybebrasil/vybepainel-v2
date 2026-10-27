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
const CAPT = { pecas: null, captacoes: null, agenda: [], proximas: [], recentes: [], avisoAgenda: "", erro: "", carregando: false, carregandoSemana: false,
  busca: "", abertos: new Set(), semana: "", dia: "", sel: "",
  // No celular abre no Dia (o Roteiro do dia, a tela do Mizinho na gravação); no computador, na Semana.
  vista: typeof window !== "undefined" && window.matchMedia?.("(max-width: 700px)").matches ? "dia" : "semana", tipos: new Set(["captacao"]), grupo: "",
  // O inspetor ("Precisa de você") abre e fecha pela barra; a escolha fica no navegador.
  inspetor: (() => { try { return localStorage.getItem("vybeCaptInspetor") === "1"; } catch { return false; } })(), verParadas: false };

const AG_TIPOS = { captacao: "Captação", reuniao: "Reunião", outro: "Compromisso" };
const AG_HORA_PX = 58, AG_TOPO = 10;
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
// `n` é quantos dias a partir de `inicio` (7 na semana, 1 no Dia das Captações).
function agendaSemanaHtml({ inicio, eventos = [], dia = "", sel = "", acoes = {}, n = 7 }) {
  const hoje = agHoje(), dias = Array.from({ length: n }, (_, i) => agSomar(inicio, i));
  const escolhido = dias.includes(dia) ? dia : dias.includes(hoje) ? hoje : dias[0];
  const comHora = eventos.filter((e) => agMin(e.inicio) !== null), diaTodo = eventos.filter((e) => agMin(e.inicio) === null);
  const ini = Math.min(7 * 60, ...comHora.map((e) => Math.floor(agMin(e.inicio) / 60) * 60));
  const fim = Math.max(20 * 60, ...comHora.map((e) => Math.ceil((agMin(e.fim) ?? agMin(e.inicio) + 60) / 60) * 60));
  // Um respiro em cima para a primeira hora não ficar sob o cabeçalho.
  const px = (min) => AG_TOPO + ((min - ini) / 60) * AG_HORA_PX;
  const rotulo = (e) => `${AG_TIPOS[e.tipo] || "Compromisso"}: ${e.titulo}, ${agDiaSemana(e.dia, "long")} ${agHorario(e)}${e.cliente ? `, ${e.cliente}` : ""}${e.estado ? `, ${e.estado.texto}` : ""}`;
  const clicar = (e) => acoes.evento ? ` onclick="event.stopPropagation();agPreviaSair(true);${acoes.evento}('${safeText(e.id)}')"` : "";
  // Passar o mouse mostra a prévia (Paulo, 26/10/2026); clicar abre o cartão.
  const passar = (e) => acoes.previa ? ` onmouseenter="agPreviaEntrar(this,'${acoes.previa}')" onmouseleave="agPreviaSair()" onfocus="agPreviaEntrar(this,'${acoes.previa}')" onblur="agPreviaSair()"` : "";
  // O que já passou recua, como no calendário; o que pede ação não.
  const agoraHm = new Date().toLocaleTimeString("en-GB", { timeZone: "America/Bahia", hour: "2-digit", minute: "2-digit" });
  const passou = (e) => e.dia < hoje || (e.dia === hoje && (agMin(e.fim) ?? agMin(e.inicio) ?? 24 * 60) <= agMin(agoraHm));
  const bloco = (e, estilo = "", curto = false, recuado = false) => { const p = agPartesDoTitulo(e); return `<button type="button" data-ev="${safeText(e.id)}" class="ag-ev${recuado ? " recuado" : ""} t-${safeText(e.tipo || "outro")}${e.id === sel ? " sel" : ""}${curto ? " curto" : ""}${passou(e) ? " passou" : ""}${e.estado ? ` tom-${e.estado.tom}` : ""}${e.estado?.chave ? ` est-${e.estado.chave}` : ""}"${estilo}${clicar(e)}${passar(e)} aria-label="${safeText(rotulo(e))}" aria-pressed="${e.id === sel}">
      <b>${safeText(p.nome)}</b><small>${safeText([e.inicio ? agHorario(e) : "", e.estado?.chave === "fechar" ? "falta fechar" : curto ? "" : p.resto].filter(Boolean).join(" · "))}</small>${e.estado ? `<span class="ag-selo tom-${e.estado.tom}">${safeText(e.estado.texto)}</span>` : ""}</button>`; };
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
  const grade = `<div class="ag-semana${n === 1 ? " um-dia" : ""}" role="grid" aria-label="${n === 1 ? safeText(agDiaSemana(inicio, "long")) : `Semana de ${safeText(agPeriodo(inicio))}`}">
    <div class="ag-cabeca"><span></span>${dias.map((d) => `<div class="ag-dia-cab${d === hoje ? " hoje" : ""}${d < hoje ? " passou" : ""}" role="columnheader"><small>${safeText(agDiaSemana(d))}</small><b>${Number(d.slice(8))}</b></div>`).join("")}</div>
    ${diaTodo.length ? `<div class="ag-dia-todo"><span>dia todo</span>${dias.map((d) => `<div>${diaTodo.filter((e) => e.dia === d).map((e) => bloco(e)).join("")}</div>`).join("")}</div>` : ""}
    <div class="ag-corpo" data-ag-rolar="${Math.max(0, px(Math.max(ini, 7 * 60)) - AG_TOPO)}">
      <div class="ag-horas" style="height:${px(fim) + AG_TOPO}px">${horas.map((m) => `<span style="top:${px(m)}px">${agHora(m)}</span>`).join("")}</div>
      ${dias.map((d) => `<div class="ag-col${d === hoje ? " hoje" : ""}${d < hoje ? " passou" : ""}" data-dia="${d}" style="height:${px(fim) + AG_TOPO}px"${vazio(d)}${largado}>
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
  return `<div class="ag" style="--ag-dias:${n}">${grade}<div class="ag-movel">${faixa}</div></div>`;
}
// O título do bloco: o cliente em destaque, sem o "Captação -" que quase todo
// evento repete (Paulo, 26/10/2026: "Captação - Cliente B -…" não dizia nada no
// bloco curto). O resto do título vai para a linha de baixo. Sem cliente
// reconhecido, fica o título sem o prefixo.
function agPartesDoTitulo(e) {
  const semSinais = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let resto = String(e.titulo || "").replace(/^\s*(capta[çc][ãa]o|grava[çc][ãa]o|gavacao)\b\s*[-–·:]?\s*/i, "");
  if (e.cliente) {
    const i = semSinais(resto).indexOf(semSinais(e.cliente));
    if (i >= 0) resto = resto.slice(0, i) + resto.slice(i + e.cliente.length);
  }
  resto = resto.replace(/\s*[-–·]\s*(?=[-–·])/g, "").replace(/^[\s\-–·:]+|[\s\-–·:]+$/g, "");
  // "Gavacao Lions" com cliente "Academia Lions": o que sobrou já está no nome.
  if (e.cliente && resto && semSinais(e.cliente).includes(semSinais(resto))) resto = "";
  const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  return { nome: e.cliente || maiuscula(resto) || e.titulo || "Sem título", resto: e.cliente ? resto : "" };
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
    document.addEventListener("mousedown", (ev) => { const p = document.getElementById("ag-cartao"); if (p && !p.hidden && !p.contains(ev.target) && !ev.target.closest(".ag-ev,.ag-chip,.capt-linha,.capt-pend-texto,.capt-rd")) agCartaoFechar(); }, true);
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
// A PRÉVIA DO HOVER. Abre um instante depois do mouse parar no bloco (passar
// por cima a caminho de outro lugar não pisca nada), ao lado dele, e some ao
// sair. Não abre com o cartão aberto nem em tela de toque (lá o toque abre o
// cartão direto). `funcao` é o nome da função global que devolve o HTML.
let AG_PREVIA_TEMPO = 0;
function agPreviaEntrar(el, funcao) {
  clearTimeout(AG_PREVIA_TEMPO);
  if (!window.matchMedia?.("(hover: hover)").matches && document.activeElement !== el) return;
  if (!document.getElementById("ag-cartao")?.hidden && document.getElementById("ag-cartao")) return;
  AG_PREVIA_TEMPO = setTimeout(() => {
    const html = window[funcao]?.(el.dataset.ev);
    if (!html || !el.isConnected) return;
    let pop = document.getElementById("ag-previa");
    if (!pop) { pop = document.createElement("div"); pop.id = "ag-previa"; pop.className = "ag-previa"; pop.setAttribute("role", "tooltip"); document.body.append(pop); }
    pop.innerHTML = html; pop.hidden = false;
    const r = el.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, m = 10;
    const direita = r.right + m + w <= window.innerWidth - m;
    pop.style.left = `${Math.max(m, direita ? r.right + m : r.left - m - w)}px`;
    pop.style.top = `${Math.max(m, Math.min(r.top, window.innerHeight - h - m))}px`;
    pop.classList.toggle("a-esquerda", !direita);
  }, 260);
}
function agPreviaSair(agora = false) {
  clearTimeout(AG_PREVIA_TEMPO);
  const pop = document.getElementById("ag-previa");
  if (pop) { if (agora) pop.hidden = true; else AG_PREVIA_TEMPO = setTimeout(() => { pop.hidden = true; }, 80); }
}
document.addEventListener("scroll", () => agPreviaSair(true), true);

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
function captGuardar(c) { CAPT.captacoes = c.captacoes || []; CAPT.agenda = c.agenda || []; CAPT.proximas = c.proximas || []; CAPT.recentes = c.recentes || []; CAPT.avisoAgenda = c.aviso_agenda || ""; }
// O período carregado acompanha a visão: a semana do dia em foco (Dia e
// Semana) ou as seis semanas da grade do mês. `CAPT.dia` é o dia em foco;
// trocar de semana, mês ou dia só busca de novo se sair do que já veio.
const captPrimeiroDoMes = (iso) => `${iso.slice(0, 8)}01`;
function captFaixa() {
  const d = CAPT.dia || captHoje();
  if (CAPT.vista === "mes") return { inicio: agSegunda(captPrimeiroDoMes(d)), dias: 42 };
  return { inicio: agSegunda(d), dias: 7 };
}
async function captCarregar() {
  if (CAPT.carregando) return;
  CAPT.carregando = true;
  CAPT.dia = CAPT.dia || agHoje();
  CAPT.semana = agSegunda(CAPT.dia);
  const { inicio, dias } = captFaixa();
  try {
    const [p, c] = await Promise.all([captPedir("acao=pecas"), captPedir(`semana=${inicio}&dias=${dias}`)]);
    CAPT.pecas = p.pecas || []; captGuardar(c); CAPT.faixa = { ini: inicio, fim: agSomar(inicio, dias - 1) }; CAPT.erro = "";
  } catch (e) { CAPT.erro = e.message; }
  finally { CAPT.carregando = false; captRender(); }
}
function captRecarregar() { CAPT.pecas = null; CAPT.faixa = null; captRender(); }
async function captBuscarFaixa() {
  const { inicio, dias } = captFaixa(), fim = agSomar(inicio, dias - 1);
  if (CAPT.faixa && CAPT.faixa.ini <= inicio && CAPT.faixa.fim >= fim) { captRender(); return; }
  CAPT.carregandoSemana = true; captRender();
  try { captGuardar(await captPedir(`semana=${inicio}&dias=${dias}`)); CAPT.faixa = { ini: inicio, fim }; }
  catch (e) { CAPT.avisoAgenda = e.message; }
  finally { CAPT.carregandoSemana = false; captRender(); }
}
// ‹ › andam um dia, uma semana ou um mês, conforme a visão; 0 volta para hoje.
function captNavegar(passo) {
  const hoje = captHoje(), base = CAPT.dia || hoje;
  if (passo === 0) CAPT.dia = hoje;
  else if (CAPT.vista === "dia") CAPT.dia = agSomar(base, passo);
  else if (CAPT.vista === "mes") { const [a, m] = base.split("-").map(Number); CAPT.dia = new Date(Date.UTC(a, m - 1 + passo, 1)).toISOString().slice(0, 10); }
  else CAPT.dia = agSomar(base, 7 * passo);
  CAPT.semana = agSegunda(CAPT.dia); CAPT.sel = "";
  agCartaoFechar();
  captBuscarFaixa();
}
function captVerDia(d) { CAPT.dia = d; CAPT.vista = "dia"; CAPT.semana = agSegunda(d); CAPT.sel = ""; agCartaoFechar(); captBuscarFaixa(); }
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
function captVista(v) { if (CAPT.vista === v) return; CAPT.vista = v; CAPT.sel = ""; agCartaoFechar(); if (v === "lista") captRender(); else captBuscarFaixa(); }
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
// Peça com prazo vencido há mais de 30 dias está parada (Paulo, 26/10/2026:
// "tá mostrando demanda que não existe" — "Dia dos namorados" vencida há 150
// dias ainda em "Agendar Captação"). Sai das listas e da fila; "ver paradas"
// no inspetor mostra quais são, para alguém limpar. Nada muda no banco.
const CAPT_PARADA_DIAS = 30;
const captParada = (p) => { const iso = p.prazo || p.veiculacao; return Boolean(iso) && captDiasAte(iso) < -CAPT_PARADA_DIAS; };
const captPecasVivas = () => (CAPT.pecas || []).filter((p) => CAPT.verParadas || !captParada(p));
const captPendentesDo = (clienteId, e = null) => captPecasVivas().filter((p) => clienteId && p.clientes?.some((c) => c.id === clienteId) && (!e || !p.sem_material || (p.tipo === "foto") === captEhFotos(e)));
const captFaltaRotulo = (p) => p.tipo === "foto" ? "sem banco de fotos" : "sem captação";
const captPlural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// O estado de uma captação, o mesmo no bloco, na lista e no detalhe:
// pronta (peças ligadas, todas com roteiro), falta roteiro, peças esperando
// (o cliente tem peças, mas ainda não estão nesta captação), nada no sistema
// (está só no Google) ou cliente não reconhecido pelo título.
function captEstado(e) {
  if (e.tipo !== "captacao") return null;
  const k = e.nossa;
  if (k?.fechada_em) return { tom: "ok", texto: "Gravada" };
  if (captFaltaFechar(e)) return { tom: "atencao", texto: "Falta fechar", chave: "fechar" };
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

// Captação que já aconteceu (o dia passou, ou hoje e o horário já acabou) e
// ninguém fechou. A fechada peça a peça antes do "Fechar gravação" (todas com
// "Gravado") não pede de novo; sem cliente reconhecido não há o que fechar.
function captJaAconteceu(e) {
  const hoje = captHoje();
  if (e.dia < hoje) return true;
  if (e.dia > hoje) return false;
  const fim = agMin(e.fim) ?? agMin(e.inicio);
  if (fim === null) return false;
  const agora = new Date().toLocaleTimeString("en-GB", { timeZone: "America/Bahia", hour: "2-digit", minute: "2-digit" });
  return fim <= agMin(agora);
}
const captFechavel = (e) => e.tipo === "captacao" && !e.nossa?.fechada_em && e.nossa?.estado !== "gravada" && Boolean(e.nossa || e.cliente_id);
// Só cobra a partir de 26/10/2026, quando "Fechar gravação" passou a existir:
// as anteriores não tinham como ser fechadas e só fariam ruído.
const CAPT_FECHAR_DESDE = "2026-10-26";
const captFaltaFechar = (e) => captFechavel(e) && e.dia >= CAPT_FECHAR_DESDE && captJaAconteceu(e);

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
  for (const p of captPecasVivas()) {
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
function captComNossas(lista, { de = "", ate = "" } = {}) {
  const nossas = new Map((CAPT.captacoes || []).map((k) => [k.id, k]));
  const noPeriodo = (dia) => !de || (dia >= de && dia <= ate);
  const fora = lista.filter((e) => noPeriodo(e.dia)).map((e) => ({ ...e, nossa: nossas.get(e.captacao_id) || null }));
  for (const k of CAPT.captacoes || []) if (!fora.some((e) => e.nossa?.id === k.id) && (!de || noPeriodo(k.dia)))
    fora.push({ id: `k${k.id}`, titulo: `Captação · ${k.cliente}`, dia: k.dia, inicio: k.inicio || "", fim: k.fim || "", tipo: "captacao", local: k.local, cliente: k.cliente, cliente_id: k.cliente_id, nossa: k });
  return fora.map((e) => ({ ...e, estado: captEstado(e) }));
}
const captEventos = () => captComNossas(CAPT.agenda || [], { de: CAPT.semana, ate: agSomar(CAPT.semana, 6) });
const captTodos = () => { const vistos = new Set(); return [...captEventos(), ...captComNossas(CAPT.proximas || []), ...captComNossas(CAPT.recentes || [])].filter((e) => !vistos.has(e.id) && vistos.add(e.id)); };

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
  for (const p of captPecasVivas()) if (p.sem_material && p.tipo === "video" && !captTemRoteiro(p) && !roteiro.some((r) => r.p.id === p.id))
    roteiro.push({ p, e: null });
  // Gravações dos últimos 7 dias (e as de hoje que já acabaram) sem fechar.
  const vistas = new Set();
  const fechar = [...captComNossas(CAPT.recentes || []), ...captComNossas(CAPT.agenda || [])]
    .filter((e) => e.dia >= agSomar(hoje, -7) && captFaltaFechar(e) && !vistas.has(e.id) && vistas.add(e.id))
    .sort((a, b) => (a.dia + (a.inicio || "")).localeCompare(b.dia + (b.inicio || "")));
  return { fechar, ligar, cadastrar, marcar, roteiro };
}
const CAPT_GRUPOS = [
  ["fechar", "Fechar gravação", "Captações que já aconteceram: marque o que foi gravado e cole a pasta do Drive."],
  ["pecas", "Sem peças", "Captações na agenda sem nada ligado: escolha o que vai ser gravado ou cadastre a peça."],
  ["roteiro", "Sem roteiro", "Peças que vão ser gravadas e ainda não têm roteiro: as de captação marcada primeiro."]
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

// A AÇÃO DA VEZ (rodada 1, 26/10/2026): o cartão, a prévia e o Roteiro do dia
// mostram uma ação principal só, a do momento da captação — escolher o que
// vai ser gravado, fechar a gravação ou cadastrar a peça. O resto fica embaixo.
function captAcaoPrincipal(e) {
  const k = e.nossa;
  if (e.tipo !== "captacao" || k?.fechada_em) return "";
  if (captFechavel(e) && e.dia <= captHoje())
    return `<button type="button" class="vb-botao principal capt-fechar-btn" onclick="captAbrirFechar('${safeText(e.id)}')">${ICONE_CHECK}Fechar gravação</button>`;
  if (k) return "";
  if (e.cliente_id && captPendentesDo(e.cliente_id, e).length)
    return `<button type="button" class="vb-botao principal" onclick="captAbrirMontar('${safeText(e.cliente_id)}',{evento:'${safeText(e.id)}'})">Escolher o que vai ser gravado</button>`;
  if (e.cliente) return `<button type="button" class="vb-botao principal" onclick="captCadastrar('${safeText(e.cliente)}')">Cadastrar peça de ${safeText(e.cliente)}</button>`;
  return "";
}

// Roteiro da captação no cartão: o Docs ligado às peças, ou o campo para ligar.
function captRoteiroDoCartao(k) {
  const docs = [...new Map(k.pecas.filter((p) => p.roteiro_doc).map((p) => [p.roteiro_doc.link, p.roteiro_doc])).values()];
  if (docs.length) return `<p class="capt-roteiro-doc">Roteiro: ${docs.map((d) => `<a class="vb-link" href="${safeText(d.link)}" target="_blank" rel="noopener">${safeText(d.titulo)}</a>`).join(", ")}</p>`;
  if (!k.pecas.length) return "";
  return `<form class="capt-roteiro-form" onsubmit="event.preventDefault();captLigarRoteiro(this,'${safeText(k.id)}')"><label><span class="sr-only">Link do roteiro no Google Docs</span><input type="url" name="roteiro" placeholder="Link do roteiro no Google Docs" required></label><button type="submit" class="vb-botao">Ligar roteiro</button></form>`;
}

// O cartão do evento, ao lado do bloco clicado (versão sóbria, 26/10/2026):
// quem, quando e o progresso em cima; a ação da vez; as peças DESTA captação
// numa lista curta; Google e cancelar no pé. As peças do cliente que só estão
// esperando não entram aqui (proximidade: parecia que eram desta captação) —
// aparecem no formulário de escolher ou de fechar.
function captPecaCompactaHtml(p, k) {
  const fechada = Boolean(k?.fechada_em);
  const marcar = k && !fechada ? `<label class="capt-gravado" title="Gravado"><input type="checkbox" ${p.gravado ? "checked" : ""} onchange="captGravado('${k.id}','${p.id}',!this.checked)"><span class="sr-only">Gravado: ${safeText(p.titulo)}</span></label>` : "";
  const falta = !p.gravado && p.tipo !== "foto" && !captTemRoteiro(p) ? '<small class="capt-falta">sem roteiro</small>' : "";
  return `<li class="capt-peca-curta${p.gravado ? " gravada" : ""}">${marcar}<button type="button" class="capt-peca-nome" onclick="captAbrirPeca('${safeText(p.id)}')" title="Abrir a peça">${safeText(p.titulo)}</button>${falta}</li>`;
}
function captDetalheHtml(e) {
  const k = e.nossa, p = agPartesDoTitulo(e), est = e.estado;
  const quando = `${captDiaLongo(e.dia)}${captDiasAte(e.dia) === 0 || captDiasAte(e.dia) === 1 ? `, ${captDia(e.dia)}` : ""} · ${agHorario(e)}`;
  const google = e.link ? `<a class="vb-link" href="${safeText(e.link)}" target="_blank" rel="noopener">Abrir no Google Agenda</a>` : "";
  const topo = `<h4>${safeText(p.nome)}</h4>
    ${p.nome !== e.titulo ? `<p class="capt-detalhe-titulo">${safeText(e.titulo)}</p>` : ""}
    <p class="capt-detalhe-quando">${safeText(quando)}${e.local ? ` · ${safeText(e.local)}` : ""}</p>`;
  if (e.tipo !== "captacao") return `<div class="capt-detalhe">${topo}<p class="capt-discreto">${e.tipo === "reuniao" ? "Reunião" : "Compromisso"} da agenda da Vybe.</p>${google ? `<div class="capt-rodape">${google}</div>` : ""}</div>`;
  if (!e.cliente && !k) return `<div class="capt-detalhe">${topo}<p class="capt-aviso">Não reconheci o cliente pelo título. Ponha o nome do cliente no título do evento no Google Agenda.</p>${google ? `<div class="capt-rodape">${google}</div>` : ""}</div>`;
  const pendentes = k ? [] : captPendentesDo(e.cliente_id, e);
  // Zeigarnik: o que falta, em número, logo no topo.
  const progresso = k?.fechada_em ? "" : k ? `${k.pecas.filter((x) => x.gravado).length} de ${captPlural(k.pecas.length, "peça gravada", "peças gravadas")}`
    : pendentes.length ? `${captPlural(pendentes.length, "peça do cliente esperando", "peças do cliente esperando")}` : "nenhuma peça no sistema";
  const estado = est && est.tom !== "ok" ? `<span class="capt-estado tom-${est.tom}">${safeText(est.texto)}</span>` : "";
  const acao = captAcaoPrincipal(e);
  let corpo = "";
  if (k?.fechada_em) corpo = captGeradoHtml(k) + captRoteiroDoCartao(k);
  else if (k) corpo = `${k.aviso ? `<p class="capt-aviso">${safeText(k.aviso)} <button type="button" class="vb-link" onclick="captAgenda('${k.id}')">Tentar de novo</button></p>` : ""}
    <ul class="capt-pecas-curtas">${k.pecas.map((x) => captPecaCompactaHtml(x, k)).join("")}</ul>
    ${k.observacao ? `<p class="capt-discreto">${safeText(k.observacao)}</p>` : ""}${captRoteiroDoCartao(k)}`;
  const cancelar = k && !k.fechada_em && k.estado === "agendada"
    ? `<button type="button" class="vb-link perigo" onclick="captCancelar('${k.id}',${k.evento_do_painel === false})">${k.evento_do_painel === false ? "Soltar as peças" : "Cancelar captação"}</button>` : "";
  const rodape = [google, cancelar].filter(Boolean).join("");
  return `<div class="capt-detalhe">${topo}
    <p class="capt-progresso">${progresso ? safeText(progresso) : ""}${estado}</p>
    ${acao ? `<div class="capt-acao">${acao}</div>` : ""}${corpo}${rodape ? `<div class="capt-rodape">${rodape}</div>` : ""}</div>`;
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
  // Três pendências só (rodada 2, 26/10/2026): o que já foi gravado e falta
  // fechar, a captação sem peça nenhuma (ligar as que esperam ou cadastrar) e a
  // peça sem roteiro. A fila de clientes vem embaixo, para arrastar.
  const semPecas = [...pend.ligar, ...pend.cadastrar].sort((a, b) => (a.dia + (a.inicio || "")).localeCompare(b.dia + (b.inicio || "")));
  const listas = { fechar: pend.fechar, pecas: semPecas, roteiro: pend.roteiro };
  const grupo = listas[CAPT.grupo] ? CAPT.grupo : CAPT_GRUPOS.find(([g]) => listas[g].length)?.[0] || "fechar";
  const chips = CAPT_GRUPOS.map(([g, nome]) => `<button type="button" class="vb-chip" aria-pressed="${g === grupo}" onclick="captGrupo('${g}')">${safeText(nome)} <b>${listas[g].length}</b></button>`).join("");
  const explica = CAPT_GRUPOS.find(([g]) => g === grupo)[2];
  let corpo;
  if (grupo === "roteiro") {
    corpo = pend.roteiro.length ? `<ul class="capt-lista">${pend.roteiro.map(({ p, e }) => captPecaHtml(p, { data: e ? `${e.cliente || ""} · captação ${captDia(e.dia)}` : `${p.clientes?.[0]?.nome || "sem cliente"} · ainda sem captação` })).join("")}</ul><p class="capt-discreto">Clique no nome da peça para escrever o roteiro no briefing, ou ligue um roteiro do Docs na aba Roteiros.</p>`
      : vbEstadoHtml({ icone: "ok", titulo: "Toda peça com captação marcada tem roteiro" });
  } else {
    const lista = listas[grupo];
    const acao = (e) => grupo === "fechar" ? `<button type="button" class="vb-botao principal" onclick="captAbrirFechar('${safeText(e.id)}')">Fechar</button>`
      : e.cliente_id && captPendentesDo(e.cliente_id, e).length ? `<button type="button" class="vb-botao principal" onclick="captAbrirMontar('${safeText(e.cliente_id)}',{evento:'${safeText(e.id)}'})">Escolher</button>`
      : e.cliente ? `<button type="button" class="vb-botao" onclick="captCadastrar('${safeText(e.cliente)}')">Cadastrar</button>` : `<button type="button" class="vb-botao" onclick="captSelecionar('${safeText(e.id)}')">Ver</button>`;
    corpo = lista.length ? `<ul class="capt-lista">${lista.map((e) => captPendenciaEventoHtml(e, acao(e))).join("")}</ul>`
      : vbEstadoHtml({ icone: "ok", titulo: grupo === "fechar" ? "Toda gravação está fechada" : "Toda captação da agenda tem peças" });
  }
  const fila = captFila().filter((g) => g.cliente.id);
  const paradas = (CAPT.pecas || []).filter(captParada).length;
  return `<div class="capt-coluna-topo"><h4>Precisa de você</h4><button type="button" class="capt-inspetor-fechar" aria-label="Fechar o painel" onclick="captAlternarInspetor()">×</button></div>
    <div class="capt-grupos" role="group" aria-label="Pendências">${chips}</div><p class="capt-discreto">${safeText(explica)}</p>${corpo}
    <section class="capt-fila-sec" aria-label="Esperando captação">
      <div class="capt-coluna-topo"><h4>Esperando captação</h4><small>${captPlural(fila.length, "cliente", "clientes")} · arraste para um horário</small></div>
      ${fila.length ? `<label class="capt-busca"><span class="sr-only">Buscar cliente</span><input type="search" placeholder="Buscar cliente" value="${safeText(CAPT.busca)}" oninput="CAPT.busca=this.value;const f=document.getElementById('capt-fila-lista');if(f)f.innerHTML=captFilaHtml(captFila().filter((g)=>g.cliente.id))"></label>
        <div id="capt-fila-lista" class="capt-fila">${captFilaHtml(fila)}</div>` : vbEstadoHtml({ icone: "ok", titulo: "Nenhuma peça esperando captação", texto: "Peças em \"Agendar Captação\" aparecem aqui, por cliente." })}
    </section>
    ${paradas ? `<p class="capt-paradas">${captPlural(paradas, "peça parada", "peças paradas")} há mais de ${CAPT_PARADA_DIAS} dias em "Agendar Captação" ${CAPT.verParadas ? "aparecendo" : "escondidas"}. <button type="button" class="vb-link" onclick="captVerParadas()">${CAPT.verParadas ? "Esconder de novo" : "Ver paradas"}</button></p>` : ""}`;
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

// O cartão da gravação fechada: quem fechou e quando, a pasta do Drive e o que
// ela gerou, com o status de agora de cada peça (edição, aprovação…).
const ICONE_CHECK = '<svg class="icone-linha" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3.5 8.4 2.9 2.9 6.1-6.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function captGeradoHtml(k) {
  const gravadas = k.pecas.filter((p) => p.gravado);
  const quando = new Date(k.fechada_em).toLocaleString("pt-BR", { timeZone: "America/Bahia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às");
  // O selo "Gravada" já está no topo do cartão (captEstado); aqui, quem e quando.
  return `<p class="capt-fechada">${ICONE_CHECK}<small>Fechada ${safeText([k.fechada_por ? `por ${firstName(k.fechada_por)}` : "", `em ${quando}`].filter(Boolean).join(" "))}</small></p>
    ${k.drive_link ? `<a class="vb-botao capt-drive" href="${safeText(k.drive_link)}" target="_blank" rel="noopener">Material bruto no Drive</a>` : '<p class="capt-aviso">Fechada sem a pasta do Drive: cole o link do material em cada peça.</p>'}
    ${k.observacao_final ? `<p class="capt-discreto">${safeText(k.observacao_final)}</p>` : ""}
    <h5>O que esta gravação gerou <small>${captPlural(gravadas.length, "peça", "peças")}</small></h5>
    <ul class="capt-gerado">${gravadas.map((p) => `<li><button type="button" class="capt-peca-nome" onclick="captAbrirPeca('${safeText(p.id)}')" title="Abrir a peça">${safeText(p.titulo)}</button>
      ${p.status ? `<span class="capt-gerado-status" style="--cor:${safeText(p.status_cor || "#8b93a3")}">${safeText(p.status)}</span>` : ""}</li>`).join("")}</ul>`;
}

// A TELA É O CALENDÁRIO (Paulo, 26/10/2026: "quero o padrão de calendário:
// abre e vê o calendário; clicando ou passando o mouse aparecem as coisas").
// Uma barra só no topo, como o Calendário do Mac: navegação e período à
// esquerda, Semana/Lista no meio, os tipos como filtro, "Precisa de você"
// (o inspetor, com o número de pendências) e "Marcar captação" à direita.
// A semana ocupa a largura toda; o inspetor abre ao lado quando pedido.
function captAlternarInspetor() {
  CAPT.inspetor = !CAPT.inspetor;
  try { localStorage.setItem("vybeCaptInspetor", CAPT.inspetor ? "1" : "0"); } catch { /* sem storage */ }
  captRender();
}
function captGrupo(g) { CAPT.grupo = g; CAPT.inspetor = true; captRender(); }
function captVerParadas() { CAPT.verParadas = !CAPT.verParadas; captRender(); }

// A prévia do hover: o essencial da captação, sem ação (as ações ficam no
// cartão, que abre no clique).
function captPreviaHtml(id) {
  const e = captTodos().find((x) => x.id === id);
  if (!e) return "";
  const k = e.nossa;
  const pecas = k ? k.pecas : e.tipo === "captacao" && e.cliente_id ? captPendentesDo(e.cliente_id, e) : [];
  const mostra = pecas.slice(0, 4);
  const sinal = (p) => p.gravado ? ["ok", "gravada"] : p.tipo === "foto" ? ["ok", "foto"] : captTemRoteiro(p) ? ["ok", "roteiro"] : ["falta", "sem roteiro"];
  const linhaPeca = (p) => { const [tom, texto] = sinal(p); return `<li><span>${safeText(p.titulo)}</span><i class="${tom}">${texto}</i></li>`; };
  return `<p class="ag-previa-tipo t-${safeText(e.tipo)}">${safeText(AG_TIPOS[e.tipo] || "Compromisso")}</p>
    <b class="ag-previa-titulo">${safeText(e.titulo || "Sem título")}</b>
    <p class="ag-previa-quando">${safeText(captDiaLongo(e.dia))} · ${safeText(agHorario(e))}${e.local ? ` · ${safeText(e.local)}` : ""}</p>
    ${e.cliente ? `<p class="ag-previa-cliente">${safeText(e.cliente)}</p>` : ""}
    ${e.estado ? `<span class="capt-estado tom-${e.estado.tom}">${safeText(e.estado.texto)}</span>` : ""}
    ${mostra.length ? `<p class="ag-previa-sub">${k ? "Nesta captação" : "Esperando captação"}</p><ul class="ag-previa-pecas">${mostra.map(linhaPeca).join("")}</ul>${pecas.length > mostra.length ? `<p class="ag-previa-mais">e mais ${pecas.length - mostra.length}</p>` : ""}` : ""}
    <p class="ag-previa-dica">${e.tipo === "captacao" ? "Clique para abrir" : "Clique para ver"}</p>`;
}

// O MÊS (rodada 3): seis semanas, cada dia com até três captações em linha
// (hora e cliente) e "+N" para o resto. O número do dia abre o Dia; a
// captação tem a mesma prévia do hover e o mesmo cartão no clique.
function captMesHtml(eventos) {
  const d = CAPT.dia || captHoje(), mes = d.slice(0, 7), hoje = captHoje();
  const ini = agSegunda(captPrimeiroDoMes(d)), dias = Array.from({ length: 42 }, (_, i) => agSomar(ini, i));
  const chip = (e) => { const p = agPartesDoTitulo(e);
    return `<button type="button" class="ag-chip t-${safeText(e.tipo || "outro")}${e.estado ? ` tom-${e.estado.tom}` : ""}${e.estado?.chave ? ` est-${e.estado.chave}` : ""}${e.dia < hoje ? " passou" : ""}${e.id === CAPT.sel ? " sel" : ""}" data-ev="${safeText(e.id)}"
      onclick="event.stopPropagation();agPreviaSair(true);captSelecionar('${safeText(e.id)}')" onmouseenter="agPreviaEntrar(this,'captPreviaHtml')" onmouseleave="agPreviaSair()" onfocus="agPreviaEntrar(this,'captPreviaHtml')" onblur="agPreviaSair()"
      aria-label="${safeText(`${AG_TIPOS[e.tipo] || "Compromisso"}: ${e.titulo}, ${agHorario(e)}${e.estado ? `, ${e.estado.texto}` : ""}`)}"><i aria-hidden="true"></i><span>${e.inicio ? `<em>${safeText(e.inicio)}</em> ` : ""}${safeText(p.nome)}</span></button>`; };
  const cab = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((n) => `<div class="capt-mes-cab" role="columnheader">${n}</div>`).join("");
  return `<div class="capt-mes" role="grid" aria-label="Mês">${cab}${dias.map((dia) => {
    const lista = eventos.filter((e) => e.dia === dia).sort((a, b) => (agMin(a.inicio) ?? -1) - (agMin(b.inicio) ?? -1));
    return `<div class="capt-mes-dia${dia.slice(0, 7) !== mes ? " fora" : ""}${dia === hoje ? " hoje" : ""}${dia < hoje ? " passou" : ""}" role="gridcell">
      <button type="button" class="capt-mes-num" onclick="captVerDia('${dia}')" aria-label="Ver ${safeText(captDiaLongo(dia))}">${Number(dia.slice(8))}</button>
      ${lista.slice(0, 3).map(chip).join("")}${lista.length > 3 ? `<button type="button" class="capt-mes-mais" onclick="captVerDia('${dia}')">+${lista.length - 3} ${lista.length - 3 === 1 ? "outra" : "outras"}</button>` : ""}</div>`; }).join("")}</div>`;
}

// O DIA e o ROTEIRO DO DIA (rodadas 3 e 4): à esquerda a coluna das horas, à
// direita cada captação do dia com as peças, o roteiro aberto e o "Gravado"
// de um toque — a tela que o Mizinho usa na gravação. No celular fica só o
// roteiro (a coluna das horas sai), que é o que cabe na mão.
function captRoteiroDoDiaHtml(dia, eventos) {
  const caps = eventos.filter((e) => e.tipo === "captacao").sort((a, b) => (agMin(a.inicio) ?? -1) - (agMin(b.inicio) ?? -1));
  if (!caps.length) return vbEstadoHtml({ titulo: `Nenhuma captação ${dia === captHoje() ? "hoje" : "neste dia"}`, texto: "Marque uma pelo botão da barra, ou clique num horário vazio.",
    acao: `<button type="button" class="vb-botao principal" onclick="captAbrirMontar('',{dia:'${dia}'})">Marcar captação</button>` });
  return caps.map((e) => {
    const k = e.nossa, p = agPartesDoTitulo(e), fechada = Boolean(k?.fechada_em);
    const pecas = k ? k.pecas : e.cliente_id ? captPendentesDo(e.cliente_id, e) : [];
    const peca = (x) => { const roteiro = String(x.briefing || "").trim();
      const gravado = k && !fechada ? `<button type="button" class="capt-gravado-btn" aria-pressed="${Boolean(x.gravado)}" onclick="captGravado('${k.id}','${x.id}',${x.gravado ? "true" : "false"})">${x.gravado ? `${ICONE_CHECK}Gravado` : "Marcar gravado"}</button>`
        : x.gravado ? `<span class="capt-estado tom-ok">Gravado</span>` : "";
      return `<li class="capt-rd-peca${x.gravado ? " gravada" : ""}"><div class="capt-rd-peca-topo"><button type="button" class="capt-peca-nome" onclick="captAbrirPeca('${safeText(x.id)}')">${safeText(x.titulo)}</button>${gravado}</div>
        ${x.roteiro_doc ? `<a class="capt-sinal ok" href="${safeText(x.roteiro_doc.link)}" target="_blank" rel="noopener">Roteiro no Docs</a>` : ""}
        ${roteiro ? `<details class="capt-roteiro"${k && !x.gravado ? " open" : ""}><summary>Roteiro</summary><p>${safeText(roteiro)}</p></details>` : x.tipo === "foto" || x.roteiro_doc ? "" : '<span class="capt-sinal alerta">Sem roteiro</span>'}</li>`; };
    const acao = captAcaoPrincipal(e);
    return `<article class="capt-rd${e.id === CAPT.sel ? " sel" : ""}" data-ev="${safeText(e.id)}">
      <div class="capt-rd-topo"><span class="capt-rd-hora">${safeText(agHorario(e))}</span><b>${safeText(p.nome)}</b>${e.estado ? `<span class="capt-estado tom-${e.estado.tom}">${safeText(e.estado.texto)}</span>` : ""}</div>
      ${p.resto || e.local ? `<p class="capt-discreto">${safeText([p.resto, e.local].filter(Boolean).join(" · "))}</p>` : ""}
      ${fechada ? captGeradoHtml(k) : pecas.length ? `${k ? "" : '<p class="capt-discreto">Ainda não ligadas a esta captação:</p>'}<ul class="capt-rd-pecas">${pecas.map(peca).join("")}</ul>` : ""}
      ${acao ? `<div class="capt-acao">${acao}</div>` : ""}</article>`;
  }).join("");
}
function captDiaHtml(eventos) {
  const d = CAPT.dia || captHoje(), doDia = eventos.filter((e) => e.dia === d);
  return `<div class="capt-dia">
    <div class="capt-dia-grade">${agendaSemanaHtml({ inicio: d, n: 1, eventos: doDia, dia: d, sel: CAPT.sel, acoes: { evento: "captSelecionar", vazio: "captMarcarEm", soltar: "captSoltarCliente", previa: "captPreviaHtml" } })}</div>
    <section class="capt-dia-roteiro" aria-label="Roteiro do dia"><h4 class="capt-dia-titulo">Roteiro do dia</h4>${captRoteiroDoDiaHtml(d, doDia)}</section></div>`;
}

const CAPT_VISTAS = [["dia", "Dia", "D"], ["semana", "Semana", "S"], ["mes", "Mês", "M"]];
function captTituloDaVista() {
  const d = CAPT.dia || captHoje(), data = new Date(`${d}T12:00:00Z`);
  const mes = (x) => x.toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  if (CAPT.vista === "dia") return { titulo: cap(data.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).replace("-feira", "")), sub: String(data.getUTCFullYear()) };
  if (CAPT.vista === "mes") return { titulo: `${cap(mes(data))} ${data.getUTCFullYear()}`, sub: "" };
  const ini = new Date(`${CAPT.semana}T12:00:00Z`), fim = new Date(`${agSomar(CAPT.semana, 6)}T12:00:00Z`);
  return { titulo: cap(ini.getUTCMonth() === fim.getUTCMonth() ? `${mes(ini)} ${ini.getUTCFullYear()}` : `${mes(ini)} – ${mes(fim)} ${fim.getUTCFullYear()}`), sub: agPeriodo(CAPT.semana) };
}

function captacoesHtml() {
  if (!CAPT.pecas && !CAPT.erro) { captCarregar(); return vbEstadoHtml({ tipo: "carregando", titulo: "Carregando as captações" }); }
  if (CAPT.erro) return vbEstadoHtml({ tipo: "erro", titulo: "Não deu para abrir as captações", texto: CAPT.erro, acao: '<button type="button" class="vb-botao" onclick="CAPT.erro=\'\';captRecarregar()">Tentar de novo</button>' });
  const hoje = captHoje(), d = CAPT.dia || hoje;
  CAPT.semana = agSegunda(d);
  // O período da visão (a semana, ou a grade do mês) é o que conta nos filtros.
  const faixa = CAPT.vista === "mes" ? captFaixa() : { inicio: CAPT.semana, dias: 7 };
  const todos = captComNossas(CAPT.agenda || [], { de: faixa.inicio, ate: agSomar(faixa.inicio, faixa.dias - 1) });
  const eventos = todos.filter((e) => CAPT.tipos.has(e.tipo));
  const pend = captPendencias();
  const nPend = pend.fechar.length + pend.ligar.length + pend.cadastrar.length + pend.roteiro.length;
  const { titulo, sub } = captTituloDaVista();
  const passo = CAPT.vista === "dia" ? "dia" : CAPT.vista === "mes" ? "mês" : "semana";
  const ehHoje = CAPT.vista === "dia" ? d === hoje : CAPT.vista === "mes" ? d.slice(0, 7) === hoje.slice(0, 7) : CAPT.semana === agSegunda(hoje);
  // Hick: na barra só o que se usa sempre. Tipos, Lista e o painel de
  // pendências vão para "Exibir"; a pendência que importa (gravação para
  // fechar) aparece como texto, o único destaque além da ação do cartão.
  const filtros = Object.entries(AG_TIPOS).map(([t, n]) => { const qtd = todos.filter((e) => e.tipo === t).length;
    return `<label class="capt-menu-item t-${t}"><input type="checkbox" ${CAPT.tipos.has(t) ? "checked" : ""} onchange="captTipo('${t}')"><span>${n}</span><small>${qtd}</small></label>`; }).join("");
  const vistas = CAPT_VISTAS.map(([v, n, tecla]) => `<button type="button" aria-pressed="${CAPT.vista === v}" onclick="captVista('${v}')" title="${n} (${tecla})">${n}</button>`).join("");
  const pendTexto = pend.fechar.length ? `<button type="button" class="capt-tb-pend atencao" onclick="captGrupo('fechar')">${captPlural(pend.fechar.length, "gravação para fechar", "gravações para fechar")}</button>`
    : nPend ? `<button type="button" class="capt-tb-pend" onclick="captAlternarInspetor()" aria-pressed="${CAPT.inspetor}">${captPlural(nPend, "pendência", "pendências")}</button>` : "";
  const corpo = CAPT.vista === "lista" ? captListaHtml(eventos)
    : CAPT.vista === "mes" ? captMesHtml(eventos)
    : CAPT.vista === "dia" ? captDiaHtml(eventos)
    : agendaSemanaHtml({ inicio: CAPT.semana, eventos, dia: CAPT.dia, sel: CAPT.sel, acoes: { evento: "captSelecionar", vazio: "captMarcarEm", soltar: "captSoltarCliente", dia: "captDiaMovel", previa: "captPreviaHtml" } });
  // Redesenhar troca os blocos embaixo do mouse: a prévia do bloco antigo sai junto.
  setTimeout(() => { agPreviaSair(true); if (CAPT.vista === "semana" || CAPT.vista === "dia") agRolar(); captCartaoAtualizar(); }, 0);
  return `<div class="capt capt-cal vista-${CAPT.vista}${CAPT.inspetor ? " com-inspetor" : ""}">
    <div class="capt-toolbar" role="toolbar" aria-label="Captações">
      <div class="capt-tb-esq">
        <button type="button" class="capt-tb-criar" onclick="captAbrirMontar('',{dia:'${CAPT.vista === "dia" ? d : ""}'})" title="Marcar captação (N)"><span aria-hidden="true">+</span> Captação</button>
        <button type="button" class="capt-tb-hoje" onclick="captNavegar(0)" title="Hoje (T)"${ehHoje ? ' aria-current="date"' : ""}>Hoje</button>
        <span class="capt-tb-setas"><button type="button" aria-label="${passo === "mês" ? "Mês" : passo === "dia" ? "Dia" : "Semana"} anterior" title="Anterior (←)" onclick="captNavegar(-1)">‹</button><button type="button" aria-label="Próximo ${passo}" title="Próximo (→)" onclick="captNavegar(1)">›</button></span>
        <h4 class="capt-tb-titulo">${safeText(titulo)}</h4>
      </div>
      <div class="capt-tb-dir">
        ${pendTexto}
        <details class="capt-menu"><summary>Exibir</summary><div class="capt-menu-painel">
          <p class="capt-menu-rotulo">Na agenda</p>${filtros}
          <hr><button type="button" class="capt-menu-acao" onclick="this.closest('details').open=false;captVista('${CAPT.vista === "lista" ? "semana" : "lista"}')">${CAPT.vista === "lista" ? "Voltar para a semana" : "Ver em lista"}</button>
          <button type="button" class="capt-menu-acao" onclick="this.closest('details').open=false;captAlternarInspetor()">${CAPT.inspetor ? "Esconder" : "Mostrar"} o que precisa de você${nPend ? ` (${nPend})` : ""}</button>
          <hr><p class="capt-menu-rotulo">Atalhos</p><p class="capt-menu-dica">T hoje · ← → navega · D S M visão · N marca · P pendências</p>
        </div></details>
        <div class="vb-alternar capt-tb-vista" role="group" aria-label="Ver como">${vistas}</div>
      </div>
    </div>
    ${CAPT.avisoAgenda ? `<p class="capt-aviso">${safeText(CAPT.avisoAgenda)}</p>` : ""}
    <div class="capt-colunas">
      <section class="capt-agenda${CAPT.carregandoSemana ? " carregando" : ""}" aria-label="Agenda" aria-busy="${CAPT.carregandoSemana}">${corpo}</section>
      ${CAPT.inspetor ? `<aside class="capt-lado" aria-label="O que precisa de você">${captPendenciasHtml(pend)}</aside>` : ""}
    </div></div>`;
}

// Teclado, como no Calendário: T hoje, ← → navega, D S M L troca a visão, N
// marca, P abre as pendências. Não age digitando num campo, com janela aberta,
// nem com a prévia grande do material na tela.
document.addEventListener("keydown", (ev) => {
  if (!document.querySelector(".capt-cal") || ev.metaKey || ev.ctrlKey || ev.altKey || ev.defaultPrevented) return;
  if (ev.target?.closest?.("input,textarea,select,[contenteditable='true']") || document.getElementById("workflow-modal")) return;
  if (document.getElementById("previa-grande")?.style.display === "flex" || document.getElementById("ag-cartao")?.hidden === false) return;
  const k = ev.key.toLowerCase(), vistas = { d: "dia", s: "semana", m: "mes", l: "lista" };
  if (k === "t") captNavegar(0);
  else if (ev.key === "ArrowLeft") captNavegar(-1);
  else if (ev.key === "ArrowRight") captNavegar(1);
  else if (vistas[k]) captVista(vistas[k]);
  else if (k === "n") captAbrirMontar("", { dia: CAPT.vista === "dia" ? CAPT.dia : "" });
  else if (k === "p") captAlternarInspetor();
  else return;
  ev.preventDefault();
});

// Os formulários (Marcar, Levar peças, Fechar gravação) abrem num painel do
// lado direito, com o calendário à vista, em vez da janela no meio da tela.
function captAbrirFolha(html) {
  openWorkflowModal(html);
  document.getElementById("workflow-modal")?.classList.add("capt-folha");
  document.getElementById("workflow-backdrop")?.classList.add("capt-folha-fundo");
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
  captAbrirFolha(`<div class="workflow-kicker"><span>Captação</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
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

// FECHAR GRAVAÇÃO (Paulo, 26/10/2026): o Mizinho marca o que gravou, cola a
// pasta do Drive e a captação fica fechada. Aparecem as peças já ligadas
// (marcadas) e as do cliente que estavam esperando captação (para marcar o que
// também saiu da gravação). A pasta vira o material bruto de cada peça marcada
// que ainda não tem um; as ligadas que ficarem desmarcadas voltam para
// "Agendar Captação". As regras ficam em fecharGravacao (server/captacoes.js).
function captAbrirFechar(eventoId) {
  agCartaoFechar();
  const e = captTodos().find((x) => x.id === eventoId);
  if (!e) { showToast("Esta captação não está mais na tela. Atualize.", "info"); return; }
  const k = e.nossa;
  const ligadas = k ? k.pecas : [];
  const esperando = e.cliente_id ? captPendentesDo(e.cliente_id, e).filter((p) => !ligadas.some((l) => l.id === p.id)) : [];
  const escolha = (p, marcada, extra = "") => { const pr = captPrazo(p); return `<label class="capt-escolha"><input type="checkbox" name="peca" value="${safeText(p.id)}"${marcada ? " checked" : ""}${p.gravado ? " disabled" : ""}><span><b>${safeText(p.titulo)}</b><small>${safeText([p.formato, pr.texto, extra].filter(Boolean).join(" · "))}</small></span></label>`; };
  const nome = e.cliente || k?.cliente || "";
  captAbrirFolha(`<div class="workflow-kicker"><span>Captação</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Fechar gravação</h2>
    <p class="capt-quando-fixo">${safeText(nome || e.titulo)} · ${safeText(captDiaLongo(e.dia))} · ${safeText(agHorario(e))}${e.local ? ` · ${safeText(e.local)}` : ""}</p>
    <form class="capt-form" onsubmit="event.preventDefault();captFechar(this)" data-evento="${safeText(e.id)}">
      <fieldset class="capt-pecas-form"><legend>O que foi gravado</legend>
        ${ligadas.map((p) => escolha(p, true, p.gravado ? "já marcada como gravada" : "")).join("")}
        ${esperando.length ? `${ligadas.length ? '<p class="capt-discreto">Também esperando captação deste cliente:</p>' : ""}${esperando.map((p) => escolha(p, false, p.sem_material ? captFaltaRotulo(p) : "")).join("")}` : ""}
        ${!ligadas.length && !esperando.length ? `<p class="capt-discreto">Nenhuma peça de ${safeText(nome || "este cliente")} esperando captação.</p>` : ""}
      </fieldset>
      <fieldset class="capt-pecas-form capt-novas-form"><legend>Gravou algo que não estava no sistema?</legend>
        <div class="capt-novas"></div>
        <button type="button" class="vb-botao capt-add-nova" onclick="captNovaPeca(this.form)"><span aria-hidden="true">+</span> Adicionar peça gravada</button>
        <p class="capt-discreto">Entra no painel já gravada, com a pasta do Drive, e segue para a edição como qualquer peça cadastrada.</p>
      </fieldset>
      <label>Pasta do material no Drive<input type="url" name="drive" inputmode="url" maxlength="2000" placeholder="https://drive.google.com/drive/folders/…"></label>
      <p class="capt-discreto">O link vai para cada peça marcada como material bruto, para a edição achar o arquivo.</p>
      ${captRoteiroCampo(ligadas)}
      <label>Observação<textarea name="observacao" rows="2" maxlength="2000" placeholder="Ex.: supino gravado a mais; faltou o depoimento"></textarea></label>
      <p class="capt-erro" role="alert" hidden></p>
      <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="submit" class="workflow-primary">Fechar gravação</button></div>
    </form>`);
}
// Uma linha de peça gravada fora do sistema: título, formato e, se já se
// sabe, o dia de ir ao ar.
const CAPT_FORMATOS_NOVOS = ["Reels", "Vídeo", "Fotografia", "Story", "Card", "Carrossel"];
function captNovaPeca(form) {
  const lugar = form.querySelector(".capt-novas"), linha = document.createElement("div");
  linha.className = "capt-nova";
  linha.innerHTML = `<label class="capt-nova-titulo"><span class="sr-only">Título</span><input name="nova_titulo" maxlength="200" placeholder="Ex.: Abdominal" required></label>
    <label><span class="sr-only">Formato</span><select name="nova_formato">${CAPT_FORMATOS_NOVOS.map((f) => `<option>${f}</option>`).join("")}</select></label>
    <label title="Vai ao ar (opcional)"><span class="sr-only">Vai ao ar</span><input type="date" name="nova_veiculacao"></label>
    <button type="button" class="capt-nova-tirar" aria-label="Tirar esta peça" onclick="this.closest('.capt-nova').remove()">×</button>`;
  lugar.append(linha);
  linha.querySelector("input").focus();
}
// O roteiro é o Google Docs da agência: mostra o que já está ligado às peças,
// ou pede o link.
function captRoteiroCampo(pecas) {
  const docs = [...new Map((pecas || []).filter((p) => p.roteiro_doc).map((p) => [p.roteiro_doc.link, p.roteiro_doc])).values()];
  const ja = docs.length ? `<p class="capt-discreto">Já ligado: ${docs.map((d) => `<a class="vb-link" href="${safeText(d.link)}" target="_blank" rel="noopener">${safeText(d.titulo)}</a>`).join(", ")}</p>` : "";
  return `<label>Roteiro no Google Docs<input type="url" name="roteiro" inputmode="url" maxlength="2000" placeholder="https://docs.google.com/document/d/…"></label>
    ${ja || '<p class="capt-discreto">O doc fica no Gmail da agência; o link liga o roteiro às peças gravadas e entra na aba Roteiros.</p>'}`;
}
async function captLigarRoteiro(form, captacaoId) {
  const link = String(new FormData(form).get("roteiro") || "").trim(), botao = form.querySelector("button");
  if (!/docs\.google\.com\/document\//.test(link)) { showToast("Cole o link do Google Docs do roteiro.", "info", 5000); return; }
  botao.disabled = true;
  try { const r = await captPedir("", { acao: "roteiro", captacao_id: captacaoId, link }); showToast(r.avisos?.[0] || "Roteiro ligado às peças da captação.", r.avisos?.length ? "info" : "ok", 6000); captRecarregar(); }
  catch (e) { showToast(e.message, "err", 6000); botao.disabled = false; }
}

async function captFechar(form) {
  const f = new FormData(form), erro = form.querySelector(".capt-erro"), botao = form.querySelector("[type=submit]"), rotulo = botao.textContent;
  const e = captTodos().find((x) => x.id === form.dataset.evento);
  // As já gravadas vêm desabilitadas (não saem pelo FormData), mas continuam gravadas.
  const gravadas = [...f.getAll("peca"), ...[...form.querySelectorAll('input[name=peca]:disabled:checked')].map((i) => i.value)];
  const drive = String(f.get("drive") || "").trim(), roteiro = String(f.get("roteiro") || "").trim();
  const mostrar = (texto) => { erro.textContent = texto; erro.hidden = false; };
  // O destino de cada peça nova é o da regra do cadastro (cadastrosDestiny),
  // com o material pronto: ela acabou de ser gravada.
  const novas = [...form.querySelectorAll(".capt-nova")].map((linha) => {
    const formato = linha.querySelector("[name=nova_formato]").value;
    const d = typeof cadastrosDestiny === "function" ? cadastrosDestiny(formato, true, true, []) : null;
    return { titulo: linha.querySelector("[name=nova_titulo]").value.trim(), formato, veiculacao: linha.querySelector("[name=nova_veiculacao]").value,
      destino: d ? { grupo_id: d.group, status: chaveDeStatus(d.status), responsaveis: (d.assignees || []).map(String) } : null };
  });
  if (!e) return mostrar("Esta captação não está mais na tela. Feche e atualize.");
  if (novas.some((n) => !n.titulo)) return mostrar("Dê um título a cada peça nova (ou tire a linha).");
  if (novas.some((n) => !n.destino)) return mostrar("Não deu para calcular o destino da peça nova. Recarregue a página.");
  if (!gravadas.length && !novas.length) return mostrar("Marque ao menos uma peça gravada, ou adicione a que foi gravada.");
  if (roteiro && !/docs\.google\.com\/document\//.test(roteiro)) return mostrar("O roteiro precisa ser o link do Google Docs.");
  if (drive && !/^https?:\/\/\S+$/i.test(drive)) return mostrar("O link do Drive precisa começar com https://");
  if (!drive && !confirm("Fechar sem a pasta do Drive? A edição não vai achar o material pela peça.")) return;
  botao.disabled = true; botao.textContent = "Fechando…";
  try {
    const k = e.nossa;
    const dados = k ? { captacao_id: k.id } : { evento_google: e.id, cliente_id: e.cliente_id, dia: e.dia, inicio: e.inicio || "", fim: e.fim || "", local: e.local || "" };
    const r = await captPedir("", { acao: "fechar", gravadas, novas, roteiro, drive, observacao: f.get("observacao") || "", ...dados });
    closeWorkflowModal();
    const partes = [`Gravação fechada: ${captPlural(r.gravadas, "peça", "peças")}`, r.novas ? `${captPlural(r.novas, "nova cadastrada", "novas cadastradas")}` : "", r.com_drive ? `${r.com_drive} com a pasta do Drive` : "", r.soltas ? `${r.soltas} de volta para "Agendar Captação"` : ""].filter(Boolean).join(" · ");
    showToast(r.avisos?.length ? `${partes}. ${r.avisos[0]}` : `${partes}.`, r.avisos?.length ? "info" : "ok", 7000);
    if (typeof refreshData === "function") refreshData();
    CAPT.sel = e.id; captRecarregar();
  } catch (x) { mostrar(x.message); botao.disabled = false; botao.textContent = rotulo; }
}
