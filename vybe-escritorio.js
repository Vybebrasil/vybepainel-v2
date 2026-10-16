// Escritório usa os mesmos perfis e sessão do painel. Nenhuma identidade digitada.
const ESCRITORIO_SALAS = {
  convivencia: "Convivência",
  criacao: "Criação",
  atendimento: "Atendimento",
  producao: "Produção",
  reuniao: "Reunião",
  foco: "Foco",
};
const ESCRITORIO_PALETA = {
  laranja: "#ff9548",
  azul: "#78aaff",
  verde: "#72ccac",
  roxo: "#ac9bff",
  rosa: "#ef9fbc",
  grafite: "#64738a",
};
const escritorio = {
  geracao: 0,
  base: null,
  perfil: null,
  sala: "convivencia",
  status: "disponivel",
  online: [],
  socket: null,
  conectando: false,
  conectado: false,
  retry: null,
  renovar: null,
  ping: null,
  chamada: null,
  entrandoChamada: false,
  chatSeq: 0,
  salvando: false,
  personalizando: false,
};
function chooseOfficeMode() {
  closeTransientOverlaysForNavigation();
  closeModeGate();
  switchBoard("escritorio", document.getElementById("btn-board-escritorio"));
}
function escritorioAvatar(perfil = {}, nome = "") {
  const pele =
    { clara: "#f4d3b4", media: "#c58a61", escura: "#764b38" }[perfil.pele] ||
    "#c58a61";
  const roupa = ESCRITORIO_PALETA[perfil.roupa] || ESCRITORIO_PALETA.laranja;
  const cabelo = perfil.cabelo || "curto";
  return `<svg class="office-avatar" viewBox="0 0 64 82" role="img" aria-label="Personagem de ${safeText(nome)}"><ellipse cx="32" cy="77" rx="22" ry="4" fill="#0003"/><path d="M22 62v11m20-11v11" stroke="#263242" stroke-width="9" stroke-linecap="round"/><path d="M17 59V44q15-12 30 0v15Z" fill="${roupa}"/><path d="M17 44l-5 15m35-15 5 15" stroke="${pele}" stroke-width="7" stroke-linecap="round"/>${cabelo === "longo" ? '<path d="M16 19q16-23 32 0v24H16Z" fill="#332722"/>' : ""}<ellipse cx="32" cy="23" rx="16" ry="18" fill="${pele}"/>${cabelo === "sem" ? "" : cabelo === "cacheado" ? '<path d="M16 21q-7-8 0-12 0-10 10-7 7-6 13 0 12-2 13 9 7 8-3 12l-3-9-8-4-9 3-9-2Z" fill="#332722"/>' : '<path d="M16 21Q10 0 32 1q25 0 17 22l-6-11-9 3-10-4Z" fill="#332722"/>'}<circle cx="26" cy="24" r="1.5" fill="#282322"/><circle cx="38" cy="24" r="1.5" fill="#282322"/><path d="M28 32q4 3 8 0" stroke="#653d32" stroke-width="1.5" fill="none"/></svg>`;
}
async function escritorioApi(acao, corpo) {
  const r = await fetch(
    "/api/painel?area=escritorio&acao=" + encodeURIComponent(acao),
    {
      credentials: "same-origin",
      cache: "no-store",
      method: corpo ? "POST" : "GET",
      headers: corpo ? { "Content-Type": "application/json" } : {},
      body: corpo ? JSON.stringify({ ...corpo, acao }) : undefined,
    },
  );
  const d = await r.json();
  if (!r.ok || !d.ok)
    throw new Error(d.error || "Não foi possível acessar o escritório.");
  return d;
}
function escritorioAviso(texto) {
  const el = document.getElementById("office-feedback");
  if (el) el.textContent = texto;
}
async function abrirEscritorio() {
  const painel = document.getElementById("painel-escritorio");
  if (escritorio.base) {
    renderEscritorio();
    return;
  }
  painel.innerHTML =
    '<div class="office-state" role="status">Preparando seu escritório…</div>';
  try {
    const base = await escritorioApi("entrada");
    if (geracao !== escritorio.geracao) return;
    escritorio.base = base;
    escritorio.perfil = base.equipe.find((p) => p.id === base.eu)?.perfil || {};
    escritorio.sala = escritorio.perfil.sala || "convivencia";
    renderEscritorio();
  } catch (e) {
    painel.innerHTML = `<div class="office-state"><h2>Escritório</h2><p>${safeText(e.message)}</p><button type="button" class="workflow-secondary" onclick="abrirEscritorio()">Tentar novamente</button></div>`;
  }
}
function escritorioEmitir(type, payload) {
  if (escritorio.socket?.readyState === WebSocket.OPEN)
    escritorio.socket.send(JSON.stringify({ type, payload }));
}
async function conectarEscritorio() {
  if (escritorio.conectando || escritorio.conectado) return;
  escritorio.conectando = true;
  const geracao = escritorio.geracao;
  atualizarPessoasEscritorio();
  escritorioAviso("Conectando…");
  try {
    const base = await escritorioApi("entrada");
    escritorio.base = base;
    if (!base.worker || !base.token)
      throw new Error(base.aviso || "Conexão indisponível.");
    const url = new URL("/room/vybe-os", base.worker);
    url.protocol = "wss:";
    const socket = new WebSocket(url);
    escritorio.socket = socket;
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          type: "presence:join",
          payload: { token: base.token },
        }),
      );
    socket.onmessage = (event) => {
      if (escritorio.socket !== socket) return;
      let e;
      try {
        e = JSON.parse(event.data);
      } catch {
        return;
      }
      if (e.type === "session:ready") {
        escritorio.conectando = false;
        escritorio.conectado = true;
        escritorioEmitir("presence:move", {
          sala: escritorio.sala,
          status: escritorio.status,
          x: escritorio.perfil.x || 50,
          y: escritorio.perfil.y || 75,
        });
        renderEscritorio();
        escritorio.ping = setInterval(
          () => escritorioEmitir("system:ping", {}),
          30000,
        );
        escritorio.renovar = setTimeout(() => {
          desconectarEscritorio(false);
          conectarEscritorio();
        }, 270000);
      }
      if (
        e.type === "conversation:invite" &&
        Object.hasOwn(ESCRITORIO_SALAS, e.payload.sala)
      ) {
        escritorio.convite = e.payload;
        atualizarDockEscritorio();
        escritorioAviso(
          e.payload.nome + " convidou você para a conversa da sala.",
        );
      }
      if (e.type === "presence:update") {
        escritorio.online = e.payload;
        atualizarPessoasEscritorio();
      }
      if (e.type === "chat:changed" && e.payload.sala === escritorio.sala)
        carregarChatEscritorio();
      if (e.type === "realtime:error") escritorioAviso(e.payload.message);
    };
    socket.onclose = () => {
      if (escritorio.socket !== socket) return;
      clearInterval(escritorio.ping);
      clearTimeout(escritorio.renovar);
      escritorio.conectando = false;
      escritorio.conectado = false;
      escritorio.online = [];
      sairChamadaEscritorio();
      atualizarPessoasEscritorio();
      escritorioAviso(
        "Desconectado. Use Entrar no escritório para reconectar.",
      );
      atualizarDockEscritorio();
    };
    socket.onerror = () =>
      escritorioAviso("Falha na conexão. Confira o acesso e tente novamente.");
  } catch (e) {
    escritorio.conectando = false;
    await sairChamadaEscritorio();
    escritorioAviso(e.message);
  }
}
function desconectarEscritorio(sairChamada = true) {
  escritorio.geracao++;
  clearInterval(escritorio.ping);
  clearTimeout(escritorio.renovar);
  const socket = escritorio.socket;
  escritorio.socket = null;
  socket?.close();
  escritorio.conectado = false;
  escritorio.conectando = false;
  escritorio.online = [];
  if (sairChamada) sairChamadaEscritorio();
  renderEscritorio();
}
function atualizarDockEscritorio() {
  const dock = document.getElementById("office-dock");
  if (!dock) return;
  dock.hidden = !escritorio.conectado && !escritorio.chamada;
  const assinatura = JSON.stringify([
    escritorio.conectado,
    escritorio.online.map((p) => [p.id, p.status, p.sala]),
    Boolean(escritorio.chamada),
    escritorio.chamada?.self.audioEnabled,
    escritorio.convite,
  ]);
  if (dock.dataset.estado === assinatura) return;
  dock.dataset.estado = assinatura;
  dock.innerHTML = `<button onclick="switchBoard('escritorio',document.getElementById('btn-board-escritorio'))">Escritório</button><details class="office-dock-team"><summary>${escritorio.online.length} online</summary><div>${escritorio.online.map((p) => `<p>${safeText(p.nome)} · ${safeText(ESCRITORIO_SALAS[p.sala])}</p>`).join("")}</div></details>${escritorio.chamada ? `<button onclick="alternarMidiaEscritorio('audio')">${escritorio.chamada.self.audioEnabled ? "Desligar microfone" : "Ligar microfone"}</button><button onclick="sairChamadaEscritorio()">Sair da chamada</button>` : ""}${escritorio.convite ? '<button onclick="aceitarConviteEscritorio()">Ver convite</button>' : ""}<button onclick="desconectarEscritorio()">Desconectar</button>`;
}
function convidarConversaEscritorio(id) {
  if (id === escritorio.base.eu) return;
  const eu = escritorio.online.find((p) => p.id === escritorio.base.eu),
    outro = escritorio.online.find((p) => p.id === id);
  if (
    !eu ||
    !outro ||
    eu.sala !== outro.sala ||
    Math.hypot(eu.x - outro.x, eu.y - outro.y) > 25
  ) {
    escritorioAviso("Aproxime seu personagem para convidar para a conversa.");
    return;
  }
  if (outro.status !== "disponivel") {
    escritorioAviso("Essa pessoa não está disponível para conversa agora.");
    return;
  }
  escritorioEmitir("conversation:invite", { id });
  escritorioAviso(
    "Convite para a conversa da sala enviado para " + outro.nome + ".",
  );
}
function aceitarConviteEscritorio() {
  const convite = escritorio.convite;
  if (!convite) return;
  openWorkflowModal(
    `<div class="workflow-kicker">Conversa da equipe</div><h2 class="workflow-title">${safeText(convite.nome)} convidou você</h2><p>Entrar na conversa da sala ${safeText(ESCRITORIO_SALAS[convite.sala])}? Quem estiver na chamada dessa sala poderá ouvir quando você ligar o microfone.</p><div class="workflow-actions"><button class="workflow-secondary" onclick="escritorio.convite=null;atualizarDockEscritorio();closeWorkflowModal()">Agora não</button><button class="workflow-primary" onclick="mudarSalaEscritorio('${convite.sala}');escritorio.convite=null;closeWorkflowModal();switchBoard('escritorio',document.getElementById('btn-board-escritorio'));entrarChamadaEscritorio()">Entrar com microfone desligado</button></div>`,
  );
}

function atualizarPessoasEscritorio() {
  const pessoas = escritorio.online;
  const sala = escritorio.sala;
  const proprio = pessoas.find((p) => p.id === escritorio.base.eu);
  if (proprio) escritorio.status = proprio.status;
  const visiveis = escritorio.conectado
    ? pessoas
    : [
        {
          id: escritorio.base.eu,
          nome: "Sua prévia · desconectado",
          perfil: escritorio.perfil,
          sala,
          x: escritorio.perfil.x || 50,
          y: escritorio.perfil.y || 75,
        },
      ];
  const mapa = document.getElementById("office-people");
  if (mapa)
    mapa.innerHTML = visiveis
      .filter((p) => p.sala === sala)
      .map(
        (p) =>
          `<button class="office-person" style="left:${Number(p.x) || 50}%;top:${Number(p.y) || 70}%" title="${safeText(p.nome)} · ${safeText(p.status)}" onclick="convidarConversaEscritorio('${safeText(p.id)}')">${escritorioAvatar(p.perfil, p.nome)}<span>${safeText(p.nome)}${p.id === escritorio.base.eu ? " · você" : ""}</span></button>`,
      )
      .join("");
  const lista = document.getElementById("office-roster");
  if (lista)
    lista.innerHTML = escritorio.base.equipe
      .map((p) => {
        const online = pessoas.find((o) => o.id === p.id);
        return `<div class="office-member">${escritorioAvatar(p.perfil, p.nome)}<div><b>${safeText(p.nome)}</b><small>${online ? safeText(ESCRITORIO_SALAS[online.sala]) + " · " + safeText(online.status) : "Desconectado"}</small></div></div>`;
      })
      .join("");
  const conexao = document.getElementById("office-connect");
  if (conexao) {
    conexao.textContent = escritorio.conectado
      ? "Sair do escritório"
      : "Entrar no escritório";
    conexao.disabled = escritorio.conectando;
  }
  atualizarDockEscritorio();
}
function renderEscritorio() {
  const painel = document.getElementById("painel-escritorio");
  if (!painel || !escritorio.base) return;
  const b = escritorio.base,
    perfil = escritorio.perfil,
    sala = escritorio.sala;
  painel.innerHTML = `<section class="office-shell"><div class="office-heading"><div><span class="workspace-eyebrow">Vybe OS · equipe conectada</span><h2>Nosso escritório</h2><p>Seu espaço, suas conversas e o trabalho da equipe.</p></div><button id="office-connect" class="workflow-primary" onclick="escritorio.conectado?desconectarEscritorio():conectarEscritorio()">${escritorio.conectado ? "Sair do escritório" : "Entrar no escritório"}</button></div>
 <p id="office-feedback" class="office-feedback" role="status">${safeText(b.demo ? "Demonstração local. Presença e chamadas não estão conectadas." : b.aviso || "Entre para aparecer para a equipe. O microfone começa desligado.")}</p>
 <div class="office-layout"><aside class="office-sidebar"><nav aria-label="Espaços do escritório">${Object.entries(
   ESCRITORIO_SALAS,
 )
   .map(
     ([id, nome]) =>
       `<button aria-pressed="${id === sala}" onclick="mudarSalaEscritorio('${id}')">${nome}</button>`,
   )
   .join(
     "",
   )}</nav><div class="office-own"><h3>Meu espaço</h3>${escritorioAvatar(perfil, "Seu personagem")}<button class="workflow-secondary" onclick="personalizarEscritorio()">Personagem e mesa</button><label>Disponibilidade<select ${escritorio.conectado ? "" : "disabled"} onchange="escritorio.status=this.value;escritorioEmitir('presence:status',{status:this.value})">${Object.entries(
   {
     disponivel: "Disponível",
     foco: "Em foco",
     reuniao: "Em reunião",
     ausente: "Ausente",
   },
 )
   .map(
     ([id, nome]) =>
       `<option value="${id}" ${escritorio.status === id ? "selected" : ""}>${nome}</option>`,
   )
   .join(
     "",
   )}</select></label><button class="office-text-button" onclick="activateOperationalBoard()">Abrir atividades</button></div></aside>
 <div class="office-center"><div class="office-room-heading"><div><h3>${safeText(ESCRITORIO_SALAS[sala])}</h3><p>${sala === "foco" ? "Espaço silencioso para concentração." : "Encontre a equipe e entre na conversa quando quiser."}</p></div><button class="workflow-secondary" onclick="entrarChamadaEscritorio()" ${escritorio.entrandoChamada || sala === "foco" ? "disabled" : ""}>${escritorio.chamada ? "Conversa aberta" : "Entrar na conversa"}</button></div>
 <div class="office-map" tabindex="0" aria-label="Mapa da sala. Clique no piso ou use as setas para mover seu personagem." onclick="moverEscritorio(event)" onkeydown="tecladoEscritorio(event)"><div class="office-wall"><span>VYBE</span><small>${safeText(ESCRITORIO_SALAS[sala])}</small></div><div class="office-rug"></div><div class="office-desks">${
   b.equipe
     .filter(
       (p, i) => p.perfil.sala === sala || (sala === "convivencia" && i < 4),
     )
     .slice(0, 12)
     .map(
       (p) =>
         `<div class="office-desk" style="--desk:${ESCRITORIO_PALETA[p.perfil.mesa] || "#64738a"}"><div class="office-desk-top"><i class="office-monitor"></i><i class="office-decoration ${safeText(p.perfil.objeto)}"></i></div><span>${safeText(p.nome)}</span></div>`,
     )
     .join("") ||
   '<div class="office-table"><span>Mesa compartilhada</span></div>'
 }</div><div id="office-people" class="office-people"></div><span class="office-map-hint">Clique para caminhar · setas do teclado</span></div>
 <section id="office-call" class="office-call" ${escritorio.chamada ? "" : "hidden"}><div class="office-call-actions"><b>Conversa · ${safeText(escritorio.salaChamada || "")}</b><button onclick="alternarMidiaEscritorio('audio')">Microfone</button><button onclick="alternarMidiaEscritorio('video')">Câmera</button><button onclick="alternarMidiaEscritorio('screen')">Compartilhar tela</button><button onclick="sairChamadaEscritorio()">Sair da chamada</button></div><div id="office-call-media" class="office-call-media"></div></section>
 <section class="office-chat"><div class="office-chat-head"><h3>Conversa da sala</h3><button class="office-text-button" onclick="carregarChatEscritorio()">Atualizar</button></div><div id="office-chat-list" role="log" aria-live="polite">Carregando mensagens…</div><form onsubmit="event.preventDefault();enviarChatEscritorio(this)"><input aria-label="Mensagem para esta sala" id="office-message" name="texto" oninput="delete this.form.dataset.chave" maxlength="2000" placeholder="Escreva para a equipe…" required autocomplete="off"><button class="workflow-primary">Enviar</button></form></section></div>
 <aside class="office-team"><h3>Equipe</h3><p>Conectado indica presença, não produtividade.</p><div id="office-roster"></div></aside></div></section>`;
  atualizarPessoasEscritorio();
  carregarChatEscritorio();
  if (escritorio.chamada) renderMidiaEscritorio();
}
function mudarSalaEscritorio(sala) {
  if (!Object.hasOwn(ESCRITORIO_SALAS, sala)) return;
  escritorio.sala = sala;
  escritorio.perfil = { ...escritorio.perfil, sala, x: 50, y: 75 };
  escritorioEmitir("presence:move", { sala, x: 50, y: 75 });
  renderEscritorio();
}
function moverEscritorio(e) {
  if (
    e.target.closest("button") ||
    (!escritorio.conectado && !escritorio.base?.demo)
  )
    return;
  const r = e.currentTarget.getBoundingClientRect();
  const x = Math.max(6, Math.min(94, ((e.clientX - r.left) * 100) / r.width));
  const y = Math.max(25, Math.min(94, ((e.clientY - r.top) * 100) / r.height));
  escritorio.perfil = { ...escritorio.perfil, x, y };
  escritorioEmitir("presence:move", { sala: escritorio.sala, x, y });
  if (!escritorio.conectado) atualizarPessoasEscritorio();
}
function tecladoEscritorio(e) {
  const dx = { ArrowLeft: -4, ArrowRight: 4 }[e.key] || 0,
    dy = { ArrowUp: -4, ArrowDown: 4 }[e.key] || 0;
  if (!dx && !dy) return;
  e.preventDefault();
  if (!escritorio.conectado && !escritorio.base?.demo) return;
  const x = Math.max(6, Math.min(94, (escritorio.perfil.x || 50) + dx)),
    y = Math.max(25, Math.min(94, (escritorio.perfil.y || 75) + dy));
  escritorio.perfil = { ...escritorio.perfil, x, y };
  escritorioEmitir("presence:move", { sala: escritorio.sala, x, y });
  if (!escritorio.conectado) atualizarPessoasEscritorio();
}
function personalizarEscritorio() {
  const p = escritorio.perfil;
  const campo = (id, nome, opcoes) =>
    `<label class="workflow-field"><span>${nome}</span><select aria-label="${safeText(nome)}" name="${id}">${Object.entries(
      opcoes,
    )
      .map(
        ([k, v]) =>
          `<option value="${k}" ${p[id] === k ? "selected" : ""}>${v}</option>`,
      )
      .join("")}</select></label>`;
  const cores = {
    laranja: "Laranja",
    azul: "Azul",
    verde: "Verde",
    roxo: "Roxo",
    rosa: "Rosa",
    grafite: "Grafite",
  };
  openWorkflowModal(
    `<div class="workflow-kicker">Meu espaço<button class="workflow-close" onclick="closeWorkflowModal()" aria-label="Fechar personalização">×</button></div><h2 class="workflow-title">Um espaço com a sua cara</h2><form onsubmit="event.preventDefault();salvarPersonalizacaoEscritorio(this)" onchange="previaPersonalizacaoEscritorio(this)"><div id="office-avatar-preview" class="office-avatar-preview">${escritorioAvatar(p, "Sua prévia")}</div>${campo("roupa", "Roupa", cores)}${campo("pele", "Tom de pele", { clara: "Claro", media: "Médio", escura: "Escuro" })}${campo("cabelo", "Cabelo", { curto: "Curto", longo: "Longo", cacheado: "Cacheado", sem: "Sem cabelo" })}${campo("mesa", "Mesa", cores)}${campo("objeto", "Objeto da mesa", { planta: "Planta", livros: "Livros", luminaria: "Luminária" })}${campo("sala", "Meu espaço fica em", ESCRITORIO_SALAS)}<p id="office-profile-error" role="alert"></p><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button class="workflow-primary">Salvar meu espaço</button></div></form>`,
  );
}
function previaPersonalizacaoEscritorio(form) {
  const preview = document.getElementById("office-avatar-preview");
  if (preview)
    preview.innerHTML = escritorioAvatar(
      Object.fromEntries(new FormData(form)),
      "Sua prévia",
    );
}
async function salvarPersonalizacaoEscritorio(form) {
  if (escritorio.salvando) return;
  escritorio.salvando = true;
  const btn = form.querySelector("button.workflow-primary");
  btn.disabled = true;
  try {
    const perfil = {
      ...escritorio.perfil,
      ...Object.fromEntries(new FormData(form)),
    };
    const d = await escritorioApi("perfil", { perfil });
    escritorio.perfil = d.perfil;
    escritorio.base.equipe.find((p) => p.id === escritorio.base.eu).perfil =
      d.perfil;
    if (form.isConnected) closeWorkflowModal();
    renderEscritorio();
    if (escritorio.conectado) {
      desconectarEscritorio(false);
      await conectarEscritorio();
    }
  } catch (e) {
    const erro = form.querySelector("#office-profile-error");
    if (erro) erro.textContent = e.message;
  } finally {
    escritorio.salvando = false;
    if (btn.isConnected) btn.disabled = false;
  }
}
async function carregarChatEscritorio() {
  const seq = ++escritorio.chatSeq,
    sala = escritorio.sala;
  const el = document.getElementById("office-chat-list");
  if (!el) return;
  try {
    const r = await fetch(
      "/api/painel?area=escritorio&acao=mensagens&sala=" +
        encodeURIComponent(sala),
      { credentials: "same-origin", cache: "no-store" },
    );
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || "Falha ao ler mensagens.");
    if (seq !== escritorio.chatSeq) return;
    el.innerHTML = d.mensagens.length
      ? d.mensagens
          .map(
            (m) =>
              `<article><b>${safeText(m.nome)}</b><p>${safeText(m.texto)}</p></article>`,
          )
          .join("")
      : "<p>A conversa desta sala começa aqui.</p>";
    el.scrollTop = el.scrollHeight;
  } catch (e) {
    if (seq === escritorio.chatSeq) el.textContent = e.message;
  }
}
async function enviarChatEscritorio(form) {
  const input = form.elements.texto,
    btn = form.querySelector("button");
  if (btn.disabled) return;
  btn.disabled = true;
  input.disabled = true;
  const texto = input.value,
    sala = escritorio.sala;
  const chave = form.dataset.chave || crypto.randomUUID();
  form.dataset.chave = chave;
  try {
    await escritorioApi("mensagem", { sala, texto, chave });
    input.value = "";
    delete form.dataset.chave;
    escritorioEmitir("chat:changed", { sala });
    await carregarChatEscritorio();
  } catch (e) {
    escritorioAviso(e.message);
  } finally {
    btn.disabled = false;
    input.disabled = false;
  }
}
async function entrarChamadaEscritorio() {
  if (escritorio.chamada || escritorio.entrandoChamada) return;
  if (!escritorio.conectado) {
    escritorioAviso("Entre no escritório antes de abrir uma conversa.");
    return;
  }
  escritorio.entrandoChamada = true;
  const geracao = escritorio.geracao,
    sala = escritorio.sala;
  escritorioAviso("Preparando conversa…");
  let meeting;
  try {
    const d = await escritorioApi("chamada", { sala });
    if (geracao !== escritorio.geracao || !escritorio.conectado)
      throw new Error("Entrada na chamada cancelada.");
    if (!window.RealtimeKitClient)
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src =
          "https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.1/dist/browser.js";
        s.onload = resolve;
        s.onerror = () =>
          reject(new Error("Não foi possível carregar o motor de chamadas."));
        document.head.appendChild(s);
      });
    meeting = await window.RealtimeKitClient.init({
      authToken: d.authToken,
      defaults: { audio: false, video: false },
    });
    await meeting.join();
    if (geracao !== escritorio.geracao || !escritorio.conectado)
      throw new Error("Entrada na chamada cancelada.");
    escritorio.chamada = meeting;
    escritorio.salaChamada = ESCRITORIO_SALAS[sala];
    for (const evento of [
      "participantJoined",
      "participantLeft",
      "audioUpdate",
      "videoUpdate",
      "screenShareUpdate",
    ])
      meeting.participants.joined.on(evento, renderMidiaEscritorio);
    for (const evento of ["audioUpdate", "videoUpdate", "screenShareUpdate"])
      meeting.self.on(evento, renderMidiaEscritorio);
    renderEscritorio();
    escritorioAviso("Conversa aberta. Microfone e câmera estão desligados.");
  } catch (e) {
    await meeting?.leave().catch(() => {});
    escritorioAviso(e.message);
  } finally {
    escritorio.entrandoChamada = false;
  }
}
async function alternarMidiaEscritorio(tipo) {
  const self = escritorio.chamada?.self;
  if (!self) return;
  try {
    if (tipo === "audio")
      await self[self.audioEnabled ? "disableAudio" : "enableAudio"]();
    if (tipo === "video")
      await self[self.videoEnabled ? "disableVideo" : "enableVideo"]();
    if (tipo === "screen")
      await self[
        self.screenShareEnabled ? "disableScreenShare" : "enableScreenShare"
      ]();
    renderMidiaEscritorio();
  } catch (e) {
    escritorioAviso("Não foi possível ativar o dispositivo: " + e.message);
  }
}
function renderMidiaEscritorio() {
  const meeting = escritorio.chamada,
    el = document.getElementById("office-call-media");
  if (!meeting || !el) return;
  el.replaceChildren();
  for (const p of [meeting.self, ...meeting.participants.joined.toArray()]) {
    const tile = document.createElement("div");
    const nome = document.createElement("b");
    nome.textContent = p.name || "Participante";
    tile.append(nome);
    if (p.videoEnabled && p.videoTrack) {
      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      v.muted = p === meeting.self;
      v.srcObject = new MediaStream([p.videoTrack]);
      tile.append(v);
    }
    if (p !== meeting.self && p.audioTrack && p.audioEnabled) {
      const a = document.createElement("audio");
      a.autoplay = true;
      a.controls = true;
      a.srcObject = new MediaStream([p.audioTrack]);
      tile.append(a);
    }
    if (p.screenShareEnabled && p.screenShareTracks?.video) {
      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      v.controls = true;
      v.srcObject = new MediaStream([p.screenShareTracks.video]);
      tile.append(v);
    }
    el.append(tile);
  }
  atualizarDockEscritorio();
}
async function sairChamadaEscritorio() {
  const m = escritorio.chamada;
  escritorio.chamada = null;
  try {
    await m?.leave();
  } catch {
    escritorioAviso("A conexão da chamada foi encerrada.");
  } finally {
    document.getElementById("office-call")?.setAttribute("hidden", "");
    document.getElementById("office-call-media")?.replaceChildren();
    atualizarDockEscritorio();
  }
}
window.addEventListener("pagehide", () => {
  escritorio.socket?.close();
  escritorio.chamada?.leave();
});
