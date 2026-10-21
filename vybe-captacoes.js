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
const CAPT = { pecas: null, captacoes: null, agenda: [], avisoAgenda: "", erro: "", carregando: false, carregandoSemana: false,
  busca: "", abertos: new Set(), semana: "", dia: "", sel: "" };

const AG_TIPOS = { captacao: "Captação", reuniao: "Reunião", outro: "Compromisso" };
const AG_HORA_PX = 46;
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
// Cada evento: { id, titulo, dia, inicio, fim, tipo, cliente, local, selo, alerta }.
function agendaSemanaHtml({ inicio, eventos = [], dia = "", sel = "", acoes = {} }) {
  const hoje = agHoje(), dias = Array.from({ length: 7 }, (_, i) => agSomar(inicio, i));
  const escolhido = dias.includes(dia) ? dia : dias.includes(hoje) ? hoje : dias[0];
  const comHora = eventos.filter((e) => agMin(e.inicio) !== null), diaTodo = eventos.filter((e) => agMin(e.inicio) === null);
  const ini = Math.min(7 * 60, ...comHora.map((e) => Math.floor(agMin(e.inicio) / 60) * 60));
  const fim = Math.max(20 * 60, ...comHora.map((e) => Math.ceil((agMin(e.fim) ?? agMin(e.inicio) + 60) / 60) * 60));
  const px = (min) => ((min - ini) / 60) * AG_HORA_PX;
  const rotulo = (e) => `${AG_TIPOS[e.tipo] || "Compromisso"}: ${e.titulo}, ${agDiaSemana(e.dia, "long")} ${agHorario(e)}${e.cliente ? `, ${e.cliente}` : ""}${e.selo ? `, ${e.selo}` : ""}`;
  const clicar = (e) => acoes.evento ? ` onclick="event.stopPropagation();${acoes.evento}('${safeText(e.id)}')"` : "";
  const bloco = (e, estilo = "", curto = false) => `<button type="button" class="ag-ev t-${safeText(e.tipo || "outro")}${e.id === sel ? " sel" : ""}${curto ? " curto" : ""}${e.alerta ? " alerta" : ""}"${estilo}${clicar(e)} aria-label="${safeText(rotulo(e))}" aria-pressed="${e.id === sel}">
      <b>${safeText(e.titulo || "Sem título")}</b><small>${safeText([e.inicio ? agHorario(e) : "", e.cliente].filter(Boolean).join(" · "))}</small>${e.selo ? `<span class="ag-selo${e.alerta ? " alerta" : ""}">${safeText(e.selo)}</span>` : ""}</button>`;
  // Eventos que se cruzam dividem a coluna (faixas).
  const posicionar = (lista) => {
    const ordem = [...lista].sort((a, b) => agMin(a.inicio) - agMin(b.inicio)), faixas = [], grupo = [];
    let fimGrupo = -1;
    const fechar = () => { const n = Math.max(1, ...grupo.map((g) => g.faixa + 1)); grupo.forEach((g) => (g.n = n)); grupo.length = 0; faixas.length = 0; };
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
    <div class="ag-corpo" data-ag-rolar="${Math.max(0, px(Math.max(ini, 7 * 60)) - 8)}">
      <div class="ag-horas" style="height:${px(fim)}px">${horas.map((m) => `<span style="top:${px(m)}px">${agHora(m)}</span>`).join("")}</div>
      ${dias.map((d) => `<div class="ag-col${d === hoje ? " hoje" : ""}" data-dia="${d}" style="height:${px(fim)}px"${vazio(d)}${largado}>
        ${horas.map((m) => `<i class="ag-linha" style="top:${px(m)}px"></i>`).join("")}
        ${d === hoje && agoraMin >= ini && agoraMin <= fim ? `<i class="ag-agora" style="top:${px(agoraMin)}px" aria-hidden="true"></i>` : ""}
        ${posicionar(comHora.filter((e) => e.dia === d)).map(({ e, a, b, faixa, n }) => { const h = Math.max(24, px(b) - px(a) - 2);
          return bloco(e, ` style="top:${px(a)}px;height:${h}px;left:calc(${(faixa / n) * 100}% + 2px);width:calc(${100 / n}% - 4px)"`, h < 56 || n > 1); }).join("")}
      </div>`).join("")}
    </div></div>`;
  // Celular: faixa de dias e a lista do dia.
  const faixa = `<div class="ag-faixa" role="tablist" aria-label="Dia">${dias.map((d) => { const n = eventos.filter((e) => e.dia === d && e.tipo === "captacao").length;
    return `<button type="button" role="tab" class="ag-faixa-dia${d === hoje ? " hoje" : ""}" aria-selected="${d === escolhido}" aria-label="${safeText(agDiaSemana(d, "long"))} ${Number(d.slice(8))}${n ? `, ${n} ${n === 1 ? "captação" : "captações"}` : ""}" onclick="${acoes.dia || "agDiaLocal"}('${d}',this)"><small>${safeText(agDiaSemana(d))}</small><b>${Number(d.slice(8))}</b><i aria-hidden="true">${"<em></em>".repeat(Math.min(n, 3))}</i></button>`; }).join("")}</div>
    <div class="ag-lista">${dias.map((d) => { const lista = eventos.filter((e) => e.dia === d).sort((a, b) => (agMin(a.inicio) ?? -1) - (agMin(b.inicio) ?? -1));
      return `<div class="ag-lista-dia" data-dia="${d}"${d === escolhido ? "" : " hidden"}>${lista.length ? lista.map((e) => bloco(e)).join("") : `<p class="ag-nada">Nada na agenda ${d === hoje ? "hoje" : `na ${safeText(agDiaSemana(d, "long"))}`}.</p>`}</div>`; }).join("")}</div>`;
  return `<div class="ag">${grade}<div class="ag-movel">${faixa}</div></div>`;
}
// Troca de dia no celular sem recarregar nada (usado pelo Escritório).
function agDiaLocal(d, botao) {
  const ag = botao.closest(".ag");
  ag.querySelectorAll(".ag-faixa-dia").forEach((b) => b.setAttribute("aria-selected", String(b === botao)));
  ag.querySelectorAll(".ag-lista-dia").forEach((l) => (l.hidden = l.dataset.dia !== d));
}
// A grade abre rolada nas 7 h, como o calendário.
function agRolar(raiz = document) { raiz.querySelectorAll("[data-ag-rolar]").forEach((el) => { if (!el.dataset.agRolado) { el.scrollTop = Number(el.dataset.agRolar); el.dataset.agRolado = "1"; } }); }
function agHoraDoClique(ev, col, ini) {
  const y = ev.clientY - col.getBoundingClientRect().top, min = ini + Math.floor((y / AG_HORA_PX) * 2) * 30;
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
async function captCarregar() {
  if (CAPT.carregando) return;
  CAPT.carregando = true;
  CAPT.semana = CAPT.semana || agSegunda(agHoje());
  try {
    const [p, c] = await Promise.all([captPedir("acao=pecas"), captPedir(`semana=${CAPT.semana}`)]);
    CAPT.pecas = p.pecas || []; CAPT.captacoes = c.captacoes || []; CAPT.agenda = c.agenda || []; CAPT.avisoAgenda = c.aviso_agenda || ""; CAPT.erro = "";
  } catch (e) { CAPT.erro = e.message; }
  finally { CAPT.carregando = false; captRender(); }
}
function captRecarregar() { CAPT.pecas = null; captRender(); }
async function captIrSemana(passo) {
  CAPT.semana = passo === 0 ? agSegunda(agHoje()) : agSomar(CAPT.semana, 7 * passo);
  CAPT.dia = passo === 0 ? agHoje() : CAPT.semana; CAPT.sel = ""; CAPT.carregandoSemana = true; captRender();
  try { const c = await captPedir(`semana=${CAPT.semana}`); CAPT.captacoes = c.captacoes || []; CAPT.agenda = c.agenda || []; CAPT.avisoAgenda = c.aviso_agenda || ""; }
  catch (e) { CAPT.avisoAgenda = e.message; CAPT.agenda = []; }
  finally { CAPT.carregandoSemana = false; captRender(); }
}
function captDiaMovel(d) { CAPT.dia = d; captRender(); }
function captSelecionar(id) {
  CAPT.sel = CAPT.sel === id ? "" : id; captRender();
  // No celular o detalhe fica embaixo da agenda: leva a pessoa até ele.
  if (CAPT.sel && window.matchMedia?.("(max-width: 1000px)").matches) document.querySelector(".capt-lado")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

const captHoje = agHoje;
const captDiasAte = (iso) => Math.round((new Date(`${iso}T12:00:00`) - new Date(`${captHoje()}T12:00:00`)) / 864e5);
const captDia = (iso) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "") : "sem data";
const captDiaLongo = (iso) => { const n = captDiasAte(iso); if (n === 0) return "Hoje"; if (n === 1) return "Amanhã";
  const t = new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }).replace("-feira", ""); return t.charAt(0).toUpperCase() + t.slice(1); };
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
    g.proxima = (CAPT.agenda || []).filter((e) => e.tipo === "captacao" && e.cliente_id && e.cliente_id === g.cliente.id && e.dia >= hoje).sort((a, b) => (a.dia + a.inicio).localeCompare(b.dia + b.inicio))[0] || null;
    return g;
  }).sort((a, b) => b.vencidas - a.vencidas || String(a.pecas[0]?.prazo || "9999").localeCompare(String(b.pecas[0]?.prazo || "9999")) || a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR"));
}
const captPendentesDo = (clienteId) => (CAPT.pecas || []).filter((p) => clienteId && p.clientes?.some((c) => c.id === clienteId));

// Eventos da semana: os do Google com o que foi montado aqui, mais a captação
// montada que não entrou no Google (com o aviso).
function captEventos() {
  const nossas = new Map((CAPT.captacoes || []).map((k) => [k.id, k]));
  const lista = (CAPT.agenda || []).map((e) => ({ ...e, nossa: nossas.get(e.captacao_id) || null }));
  for (const k of CAPT.captacoes || []) if (!lista.some((e) => e.nossa?.id === k.id))
    lista.push({ id: `k${k.id}`, titulo: `Captação · ${k.cliente}`, dia: k.dia, inicio: k.inicio || "", fim: k.fim || "", tipo: "captacao", local: k.local, cliente: k.cliente, cliente_id: k.cliente_id, nossa: k });
  return lista.map((e) => {
    const k = e.nossa, esperando = e.tipo === "captacao" && !k ? captPendentesDo(e.cliente_id).length : 0;
    const selo = k ? `${k.pecas.filter((p) => p.gravado).length}/${k.pecas.length} gravadas` : esperando ? `${esperando} ${esperando === 1 ? "peça esperando" : "peças esperando"}` : "";
    return { ...e, selo, alerta: Boolean(k?.aviso) || Boolean(esperando) };
  });
}

function captPecaHtml(p, { marcar = "" } = {}) {
  const prazo = captPrazo(p), roteiro = String(p.briefing || "").trim();
  return `<li class="capt-peca${p.gravado ? " gravada" : ""}">${marcar}<span class="capt-peca-texto"><b>${safeText(p.titulo)}</b><small>${p.formato ? `<span>${safeText(p.formato)}</span>` : ""}${p.prazo || p.veiculacao ? `<span class="capt-prazo ${prazo.tom}">${safeText(prazo.texto)}</span>` : ""}</small></span>
    ${p.roteiro_doc ? `<a class="capt-roteiro-doc" href="${safeText(p.roteiro_doc.link)}" target="_blank" rel="noopener" title="${safeText(p.roteiro_doc.titulo)}">Roteiro no Docs</a>` : ""}${roteiro ? `<details class="capt-roteiro"><summary>Roteiro</summary><p>${safeText(roteiro)}</p></details>` : p.roteiro_doc ? "" : '<span class="capt-sem-roteiro" title="Esta peça ainda não tem roteiro no briefing nem um roteiro do Docs ligado">Sem roteiro</span>'}</li>`;
}

// O detalhe do evento escolhido, no lugar da fila.
function captDetalheHtml(e) {
  const k = e.nossa, pendentes = captPendentesDo(e.cliente_id), n = captDiasAte(e.dia);
  const topo = `<div class="capt-detalhe-topo"><button type="button" class="vb-link" onclick="captSelecionar('')">‹ Para captar</button>${e.link ? `<a class="vb-link" href="${safeText(e.link)}" target="_blank" rel="noopener">Abrir no Google Agenda</a>` : ""}</div>
    <span class="capt-tipo t-${safeText(e.tipo)}">${safeText(AG_TIPOS[e.tipo] || "Compromisso")}</span>
    <h4>${safeText(e.titulo || "Sem título")}</h4>
    <p class="capt-detalhe-quando">${safeText(captDiaLongo(e.dia))}${n === 0 || n === 1 ? `, ${safeText(captDia(e.dia))}` : ""} · ${safeText(agHorario(e))}${e.local ? `<br>${safeText(e.local)}` : ""}</p>`;
  if (e.tipo !== "captacao") return `<div class="capt-detalhe">${topo}<p class="capt-discreto">${e.tipo === "reuniao" ? "Reunião" : "Compromisso"} da agenda da Vybe. Só as captações (azuis) recebem peças.</p></div>`;
  const cliente = e.cliente ? `<p class="capt-detalhe-cliente">${safeText(e.cliente)}</p>` : '<p class="capt-aviso">Não reconheci o cliente pelo título. Ponha o nome do cliente no título do evento no Google Agenda.</p>';
  if (k) return `<div class="capt-detalhe">${topo}${cliente}${k.aviso ? `<p class="capt-aviso">${safeText(k.aviso)} <button type="button" class="vb-link" onclick="captAgenda('${k.id}')">Tentar de novo</button></p>` : ""}
    <h5>Peças desta captação <small>${k.pecas.filter((p) => p.gravado).length} de ${k.pecas.length} gravadas</small></h5>
    <ul class="capt-lista">${k.pecas.map((p) => captPecaHtml(p, { marcar: `<label class="capt-gravado"><input type="checkbox" ${p.gravado ? "checked" : ""} onchange="captGravado('${k.id}','${p.id}',!this.checked)"><span class="sr-only">Gravado: ${safeText(p.titulo)}</span></label>` })).join("")}</ul>
    ${k.observacao ? `<p class="capt-discreto">${safeText(k.observacao)}</p>` : ""}
    ${k.estado === "agendada" ? `<button type="button" class="vb-link perigo" onclick="captCancelar('${k.id}',${k.evento_do_painel === false})">${k.evento_do_painel === false ? "Soltar as peças desta captação" : "Cancelar captação"}</button>` : ""}</div>`;
  return `<div class="capt-detalhe">${topo}${cliente}
    ${pendentes.length ? `<h5>Esperando captação <small>${pendentes.length} ${pendentes.length === 1 ? "peça" : "peças"}</small></h5><ul class="capt-lista">${pendentes.map((p) => captPecaHtml(p)).join("")}</ul>
      <button type="button" class="vb-botao principal" onclick="captAbrirMontar('${safeText(e.cliente_id)}',{evento:'${safeText(e.id)}'})">Levar peças para esta captação</button>`
    : e.cliente ? `<p class="capt-discreto">${safeText(e.cliente)} não tem peças em "Agendar Captação" agora.</p>` : ""}</div>`;
}

function captFilaHtml() {
  const busca = CAPT.busca.trim().toLowerCase();
  const fila = captFila().filter((g) => !busca || g.cliente.nome.toLowerCase().includes(busca));
  if (!(CAPT.pecas || []).length) return vbEstadoHtml({ titulo: "Nenhuma peça esperando captação", texto: "Peças em \"Agendar Captação\" aparecem aqui, separadas por cliente." });
  if (!fila.length) return vbEstadoHtml({ titulo: "Nenhum cliente com esse nome na fila", texto: "Confira a busca." });
  return fila.map((g) => {
    const aberto = CAPT.abertos.has(g.cliente.id);
    const proxima = g.proxima ? `<span class="capt-chip ok">captação ${safeText(captDiaLongo(g.proxima.dia).toLowerCase())}${g.proxima.inicio ? ` ${safeText(g.proxima.inicio)}` : ""}</span>` : "";
    const arrastar = g.cliente.id ? ` draggable="true" ondragstart="event.dataTransfer.setData('text/vybe-cliente','${safeText(g.cliente.id)}');event.dataTransfer.effectAllowed='copy';document.body.classList.add('ag-arrastando')" ondragend="document.body.classList.remove('ag-arrastando')"` : "";
    return `<details class="capt-cliente"${aberto ? " open" : ""}${arrastar} ontoggle="CAPT.abertos[this.open?'add':'delete']('${safeText(g.cliente.id)}')">
      <summary title="${g.cliente.id ? "Arraste para um horário da agenda para marcar a captação" : ""}"><span class="capt-cliente-nome"><b>${safeText(g.cliente.nome)}</b>
        <span class="capt-chips"><small>${g.pecas.length} ${g.pecas.length === 1 ? "peça" : "peças"}</small>${g.vencidas ? `<span class="capt-chip alerta">${g.vencidas} ${g.vencidas === 1 ? "vencida" : "vencidas"}</span>` : ""}${g.semRoteiro ? `<span class="capt-chip atencao">${g.semRoteiro} sem roteiro</span>` : ""}${proxima}</span></span>
        ${g.cliente.id ? `<button type="button" class="vb-botao" onclick="event.preventDefault();captAbrirMontar('${safeText(g.cliente.id)}')" aria-label="Marcar captação de ${safeText(g.cliente.nome)}">Marcar</button>` : ""}</summary>
      <ul class="capt-lista">${g.pecas.map((p) => captPecaHtml(p)).join("")}</ul></details>`;
  }).join("");
}

function captacoesHtml() {
  if (!CAPT.pecas && !CAPT.erro) { captCarregar(); return vbEstadoHtml({ tipo: "carregando", titulo: "Carregando as captações" }); }
  if (CAPT.erro) return vbEstadoHtml({ tipo: "erro", titulo: "Não deu para abrir as captações", texto: CAPT.erro, acao: '<button type="button" class="vb-botao" onclick="CAPT.erro=\'\';captRecarregar()">Tentar de novo</button>' });
  const pecas = CAPT.pecas || [], hoje = captHoje(), eventos = captEventos();
  const caps = eventos.filter((e) => e.tipo === "captacao");
  const vencidas = pecas.filter((p) => captPrazo(p).tom === "alerta").length, semRoteiro = pecas.filter((p) => !captTemRoteiro(p)).length;
  const deHoje = caps.filter((e) => e.dia === hoje).length, esperando = caps.filter((e) => !e.nossa && captPendentesDo(e.cliente_id).length).length;
  const resumo = vbResumoHtml([
    CAPT.semana === agSegunda(hoje) ? { valor: deHoje, rotulo: deHoje === 1 ? " captação hoje" : " captações hoje", tom: deHoje ? "ok" : "" } : null,
    { valor: caps.length, rotulo: caps.length === 1 ? " captação na semana" : " captações na semana" },
    esperando ? { valor: esperando, rotulo: esperando === 1 ? " captação sem as peças ligadas" : " captações sem as peças ligadas", tom: "atencao" } : null,
    { valor: pecas.length, rotulo: pecas.length === 1 ? " peça para captar" : " peças para captar", tom: pecas.length ? "atencao" : "" },
    { valor: vencidas, rotulo: " com prazo vencido", tom: vencidas ? "alerta" : "" },
    { valor: semRoteiro, rotulo: " sem roteiro", tom: semRoteiro ? "alerta" : "" },
  ]);
  const sel = eventos.find((e) => e.id === CAPT.sel);
  const legenda = Object.entries(AG_TIPOS).map(([t, n]) => `<span class="ag-legenda-item t-${t}">${n}</span>`).join("");
  setTimeout(() => agRolar(), 0);
  return `<div class="capt">${resumo}
    <div class="capt-barra">
      <div class="capt-nav" role="group" aria-label="Semana"><button type="button" class="vb-botao" aria-label="Semana anterior" onclick="captIrSemana(-1)">‹</button><button type="button" class="vb-botao" onclick="captIrSemana(0)"${CAPT.semana === agSegunda(hoje) ? " disabled" : ""}>Hoje</button><button type="button" class="vb-botao" aria-label="Próxima semana" onclick="captIrSemana(1)">›</button></div>
      <h4 class="capt-periodo">${safeText(agPeriodo(CAPT.semana))}</h4>
      <div class="ag-legenda" aria-label="Cores da agenda">${legenda}</div>
      <button type="button" class="vb-botao principal" onclick="captAbrirMontar('')">Marcar captação</button></div>
    ${CAPT.avisoAgenda ? `<p class="capt-aviso">${safeText(CAPT.avisoAgenda)}</p>` : ""}
    <div class="capt-colunas">
      <section class="capt-agenda${CAPT.carregandoSemana ? " carregando" : ""}" aria-label="Agenda da semana" aria-busy="${CAPT.carregandoSemana}">${agendaSemanaHtml({ inicio: CAPT.semana, eventos, dia: CAPT.dia, sel: CAPT.sel, acoes: { evento: "captSelecionar", vazio: "captMarcarEm", soltar: "captSoltarCliente", dia: "captDiaMovel" } })}
        <p class="capt-dica">Arraste um cliente da fila para um horário, ou clique num horário vazio, para marcar a captação.</p></section>
      <aside class="capt-lado" aria-label="${sel ? "Detalhe do evento" : "Para captar"}">${sel ? captDetalheHtml(sel) : `<div class="capt-coluna-topo"><h4>Para captar</h4>
        <label class="capt-busca"><span class="sr-only">Buscar cliente</span><input type="search" placeholder="Buscar cliente" value="${safeText(CAPT.busca)}" oninput="CAPT.busca=this.value;const f=document.getElementById('capt-fila-lista');if(f)f.innerHTML=captFilaHtml()"></label></div>
        <div id="capt-fila-lista" class="capt-fila">${captFilaHtml()}</div>`}</aside>
    </div></div>`;
}

function captMarcarEm(dia, hora) { captAbrirMontar("", { dia, inicio: hora }); }
function captSoltarCliente(cliente, dia, hora) { captAbrirMontar(cliente, { dia, inicio: hora }); }

// Marcar captação: o cliente (escolhido ou vindo da fila), as peças, o dia e
// o horário. Com `evento`, as peças vão para a captação que já está no Google.
function captAbrirMontar(clienteId, { dia = "", inicio = "", evento = "" } = {}) {
  const fila = captFila().filter((g) => g.cliente.id);
  if (!fila.length) { showToast("Nenhuma peça esperando captação agora.", "info"); return; }
  const ev = evento ? captEventos().find((e) => e.id === evento) : null;
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
        : `<label>Cliente<select name="cliente" required onchange="captPecasDoForm(this.form,this.value)"><option value="">Escolha o cliente</option>${fila.map((x) => `<option value="${safeText(x.cliente.id)}">${safeText(x.cliente.nome)} (${x.pecas.length} ${x.pecas.length === 1 ? "peça" : "peças"})</option>`).join("")}</select></label>`}
      <fieldset class="capt-pecas-form"${g ? "" : " hidden"}>${g ? captPecasFieldset(g) : ""}</fieldset>
      ${quando}
      <label>Observação<textarea name="observacao" rows="2" maxlength="2000" placeholder="O que levar, quem acompanha…"></textarea></label>
      <p class="capt-erro" role="alert" hidden></p>
      <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="submit" class="workflow-primary">${ev ? "Levar as peças" : "Marcar captação"}</button></div>
    </form>`);
}
function captPecasFieldset(g) {
  return `<legend>Peças (${g.pecas.length})</legend>${g.pecas.map((p) => { const pr = captPrazo(p); return `<label class="capt-escolha"><input type="checkbox" name="peca" value="${safeText(p.id)}" checked><span><b>${safeText(p.titulo)}</b><small>${safeText([p.formato, pr.texto].filter(Boolean).join(" · "))}${captTemRoteiro(p) ? "" : " · sem roteiro"}</small></span></label>`; }).join("")}`;
}
function captPecasDoForm(form, clienteId) {
  const g = captFila().find((x) => x.cliente.id === clienteId), fs = form.querySelector(".capt-pecas-form");
  fs.innerHTML = g ? captPecasFieldset(g) : ""; fs.hidden = !g;
}
async function captMontar(form) {
  const f = new FormData(form), erro = form.querySelector(".capt-erro"), botao = form.querySelector("[type=submit]"), rotulo = botao.textContent;
  const pecas = f.getAll("peca"), cliente = f.get("cliente"), evento = form.dataset.evento;
  const ev = evento ? captEventos().find((e) => e.id === evento) : null;
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
    if (!ev) { CAPT.semana = agSegunda(dados.dia); CAPT.dia = dados.dia; }
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
