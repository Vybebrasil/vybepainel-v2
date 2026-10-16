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
// Cada sala tem uma cor de ambiente; o nome continua escrito, a cor só ajuda.
const ESCRITORIO_COR_SALA = {
  convivencia: "#ff9548",
  criacao: "#ef9fbc",
  atendimento: "#78aaff",
  producao: "#72ccac",
  reuniao: "#ac9bff",
  foco: "#8b97ab",
};
const ESCRITORIO_STATUS = {
  disponivel: ["Disponível", "#3fbf7f"],
  foco: ["Em foco", "#9b87ff"],
  reuniao: ["Em reunião", "#ff9548"],
  ausente: ["Ausente", "#8a93a3"],
};
// Cena isométrica. Móveis: Furniture Kit da Kenney (CC0, kenney.nl), em
// assets/escritorio. A sala tem N×N ladrilhos; a presença continua em
// porcentagem (6–94), então o Worker não muda: x vira u e y vira v.
const ESCRITORIO_CENA = { N: 6, TW: 208, TH: 140, PAREDE: 210, MARGEM: 24 };
const ESCRITORIO_SPRITES = "/assets/escritorio/";
// Mesas ficam no fundo da sala; a frente é de cada ambiente.
const ESCRITORIO_MESAS = [
  [1.1, 1.25], [2.5, 1.25], [3.9, 1.25], [1.1, 3.1], [2.5, 3.1], [3.9, 3.1], [5.2, 1.25], [5.2, 3.1],
];
const ESCRITORIO_DECOR = {
  convivencia: [
    ["rugRounded_SE", 2.6, 4.9], ["tableCoffee_SE", 2.6, 4.9], ["loungeSofa_SE", 1.6, 4.8],
    ["loungeChair_SW", 3.6, 4.8], ["lampSquareFloor_SE", 5.6, 3.9], ["pottedPlant_SE", 0.4, 5.6], ["pottedPlant_SE", 5.6, 5.6],
  ],
  criacao: [
    ["rugRectangle_SE", 2.8, 4.9], ["bookcaseOpen_SW", 0.4, 4.4], ["loungeChair_SE", 2.4, 5],
    ["lampSquareFloor_SE", 3.4, 4.5], ["pottedPlant_SE", 5.6, 5.5], ["plantSmall2_SE", 4.8, 5.2],
  ],
  atendimento: [
    ["tableRound_SE", 2.8, 4.8], ["chair_SE", 2.8, 4.1], ["chair_NW", 2.8, 5.5],
    ["chair_SW", 2.1, 4.8], ["chair_NE", 3.5, 4.8], ["pottedPlant_SE", 0.4, 5.6], ["pottedPlant_SE", 5.6, 5.6],
  ],
  producao: [
    ["table_SE", 2.8, 4.8], ["laptop_SE", 2.65, 4.75, 58], ["chair_NW", 2.4, 5.5], ["chair_NW", 3.2, 5.5],
    ["lampSquareFloor_SE", 4.8, 4.8], ["pottedPlant_SE", 0.4, 5.6],
  ],
  reuniao: [
    ["rugRectangle_SE", 2.9, 4.8], ["table_SE", 2.9, 4.8], ["chair_SE", 2.5, 4.1], ["chair_SE", 3.3, 4.1],
    ["chair_NW", 2.5, 5.5], ["chair_NW", 3.3, 5.5], ["pottedPlant_SE", 0.4, 5.6], ["pottedPlant_SE", 5.6, 5.6],
  ],
  foco: [
    ["bookcaseOpen_SW", 0.4, 4.1], ["bookcaseOpen_SW", 0.4, 5.1], ["rugRounded_SE", 2.4, 4.9], ["loungeChair_SE", 2.4, 4.9],
    ["lampSquareFloor_SE", 3.2, 4.4], ["pottedPlant_SE", 5.6, 5.6],
  ],
};
const ESCRITORIO_OBJETO_SPRITE = {
  planta: "plantSmall1_SE",
  livros: "books_SE",
  luminaria: "lampRoundTable_SE",
};
// O espaldar vermelho da cadeira ganha a cor que a pessoa escolheu para a mesa.
const ESCRITORIO_MATIZ = {
  laranja: "hue-rotate(25deg)",
  azul: "hue-rotate(205deg)",
  verde: "hue-rotate(130deg)",
  roxo: "hue-rotate(255deg)",
  rosa: "hue-rotate(320deg) saturate(.75)",
  grafite: "saturate(.12) brightness(.8)",
};
const ESCRITORIO_INICIO = "vybe-escritorio-inicio";
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
  // A geração é lida ANTES de esperar o servidor: se a pessoa sair enquanto a
  // resposta não chega, a resposta atrasada não reabre um escritório fechado.
  const geracao = escritorio.geracao;
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
// Fora do escritório (com o painel aberto por cima), o dock é o atalho de volta
// e mantém microfone e saída da chamada à mão.
function atualizarDockEscritorio() {
  const dock = document.getElementById("office-dock");
  if (!dock) return;
  // Com o escritório disponível, o caminho de volta fica sempre à mão.
  const noEscritorio = typeof activeBoard !== "undefined" && activeBoard === "escritorio";
  dock.hidden = !escritorio.base || noEscritorio;
  const assinatura = JSON.stringify([
    escritorio.conectado,
    escritorio.online.map((p) => [p.id, p.status, p.sala]),
    Boolean(escritorio.chamada),
    escritorio.chamada?.self.audioEnabled,
    escritorio.convite,
  ]);
  if (dock.dataset.estado === assinatura) return atualizarControlesEscritorio();
  dock.dataset.estado = assinatura;
  dock.innerHTML = `<button class="office-dock-volta" onclick="voltarAoEscritorio()">${escritorioIcone("mapa")}<span>Voltar ao escritório</span></button>${escritorio.conectado ? `<details class="office-dock-team"><summary>${escritorio.online.length} online</summary><div>${escritorio.online.map((p) => `<p>${safeText(p.nome)} · ${safeText(ESCRITORIO_SALAS[p.sala])}</p>`).join("")}</div></details>` : ""}${escritorio.chamada ? `<button onclick="alternarMidiaEscritorio('audio')">${escritorio.chamada.self.audioEnabled ? "Desligar microfone" : "Ligar microfone"}</button><button onclick="sairChamadaEscritorio()">Sair da chamada</button>` : ""}${escritorio.convite ? '<button onclick="aceitarConviteEscritorio()">Ver convite</button>' : ""}`;
  atualizarControlesEscritorio();
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

const ESCRITORIO_TAMANHOS = {bookcaseOpen_SW:[67,140],books_SE:[26,27],chairDesk_SE:[60,97],chair_NE:[42,67],chair_NW:[41,68],chair_SE:[42,79],chair_SW:[41,79],computerScreen_NW:[47,54],desk_SE:[116,122],lampRoundTable_SE:[24,49],lampSquareFloor_SE:[24,108],laptop_SE:[50,52],loungeChair_SE:[91,106],loungeChair_SW:[91,106],loungeSofa_SE:[141,141],plantSmall1_SE:[14,18],plantSmall2_SE:[14,19],pottedPlant_SE:[28,85],rugRectangle_SE:[257,184],rugRounded_SE:[202,144],tableCoffee_SE:[110,102],tableRound_SE:[113,95],table_SE:[133,129]};
function escritorioIcone(nome) {
  const d = {
    mapa: '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 17l8 4 8-4"/>',
    pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5"/><path d="M16 4.6a3 3 0 010 6M18 14.8c1.6.8 2.6 2.5 3 5.2"/>',
    conversa: '<path d="M4 5h16v11H9l-5 4z"/>',
    espaco: '<circle cx="12" cy="8" r="3.6"/><path d="M5 21c.8-4.4 3.5-6.6 7-6.6s6.2 2.2 7 6.6"/>',
    painel: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
    mesa: '<path d="M3 10h18M5 10v9M19 10v9M8 10V6h8v4"/>',
    microfone: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    camera: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    tela: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 13V7M9 9.5L12 7l3 2.5M8 20h8"/>',
    sair: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
    entrar: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H8"/>',
    lista: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    fone: '<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  }[nome] || "";
  return `<svg class="ofc-ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
}
// No build, ESCRITORIO_ARQUIVOS liga cada imagem ao nome com hash.
function escritorioArquivo(nome) {
  const comHash = typeof ESCRITORIO_ARQUIVOS !== "undefined" && ESCRITORIO_ARQUIVOS[nome + ".png"];
  return ESCRITORIO_SPRITES + (comHash || nome + ".png");
}
function escritorioCenaTamanho() {
  const { N, TW, TH, PAREDE, MARGEM } = ESCRITORIO_CENA;
  return { W: N * TW + MARGEM * 2, H: MARGEM * 2 + PAREDE + N * TH };
}
function escritorioProjetar(u, v) {
  const { TW, TH, PAREDE, MARGEM } = ESCRITORIO_CENA;
  const { W } = escritorioCenaTamanho();
  return { x: W / 2 + ((u - v) * TW) / 2, y: MARGEM + PAREDE + ((u + v) * TH) / 2 };
}
function escritorioPorcentagem(u) {
  return Math.max(6, Math.min(94, (u / ESCRITORIO_CENA.N) * 100));
}
// O ponto de apoio de um móvel isométrico fica no centro do losango da base:
// a um terço da largura acima do pé da imagem.
function escritorioSprite(nome, u, v, alt = 0, extra = "") {
  const [w, h] = ESCRITORIO_TAMANHOS[nome] || [60, 60];
  const p = escritorioProjetar(u, v);
  const z = Math.round((u + v) * 100) + (alt ? 5 : 0);
  return `<img class="ofc-obj" src="${escritorioArquivo(nome)}" alt="" width="${w}" height="${h}" draggable="false" style="left:${(p.x - w / 2).toFixed(1)}px;top:${(p.y - h + w * 0.335 - alt).toFixed(1)}px;z-index:${z};${extra}">`;
}
// Quem tem mesa nesta sala, na ordem da equipe; cada um ocupa uma posição fixa.
function escritorioMesasDaSala(sala) {
  return (escritorio.base?.equipe || [])
    .filter((p) => (p.perfil?.sala || "convivencia") === sala)
    .slice(0, ESCRITORIO_MESAS.length)
    .map((p, i) => ({ pessoa: p, u: ESCRITORIO_MESAS[i][0], v: ESCRITORIO_MESAS[i][1] }));
}
function escritorioMinhaMesa() {
  const sala = escritorio.perfil?.sala || "convivencia";
  const mesa = escritorioMesasDaSala(sala).find((m) => m.pessoa.id === escritorio.base?.eu);
  return mesa ? { sala, ...mesa } : null;
}
function escritorioCenaHtml(sala) {
  const { N, TW, TH, PAREDE } = ESCRITORIO_CENA;
  const { W, H } = escritorioCenaTamanho();
  const cor = ESCRITORIO_COR_SALA[sala];
  const t = escritorioProjetar(0, 0), r = escritorioProjetar(N, 0),
    b = escritorioProjetar(N, N), l = escritorioProjetar(0, N);
  const pt = (p, dy = 0) => `${p.x},${p.y + dy}`;
  let grade = "";
  for (let i = 1; i < N; i++) {
    const a1 = escritorioProjetar(i, 0), a2 = escritorioProjetar(i, N),
      b1 = escritorioProjetar(0, i), b2 = escritorioProjetar(N, i);
    grade += `<line x1="${a1.x}" y1="${a1.y}" x2="${a2.x}" y2="${a2.y}"/><line x1="${b1.x}" y1="${b1.y}" x2="${b2.x}" y2="${b2.y}"/>`;
  }
  // Janelas na parede da esquerda: paralelogramos ao longo da aresta u=0.
  const janela = (v0, v1) => {
    const p0 = escritorioProjetar(0, v0), p1 = escritorioProjetar(0, v1);
    return `<polygon class="ofc-janela" points="${pt(p0, -PAREDE + 40)} ${pt(p1, -PAREDE + 40)} ${pt(p1, -60)} ${pt(p0, -60)}"/>`;
  };
  const inclina = TH / TW;
  const placa = escritorioProjetar(N * 0.18, 0);
  const svg = `<svg class="ofc-casco" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
<defs><linearGradient id="ofc-parede-e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4152"/><stop offset="1" stop-color="#2a303d"/></linearGradient><linearGradient id="ofc-parede-d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#323947"/><stop offset="1" stop-color="#242a35"/></linearGradient><linearGradient id="ofc-vidro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe3ff" stop-opacity=".5"/><stop offset="1" stop-color="#6f9cc4" stop-opacity=".22"/></linearGradient></defs>
<polygon points="${pt(t)} ${pt(r)} ${pt(b)} ${pt(l)}" fill="#0005" transform="translate(0 26)"/>
<polygon class="ofc-piso" points="${pt(t)} ${pt(r)} ${pt(b)} ${pt(l)}"/>
<polygon points="${pt(l)} ${pt(b)} ${pt(b, 18)} ${pt(l, 18)}" fill="#b9b1a5"/><polygon points="${pt(b)} ${pt(r)} ${pt(r, 18)} ${pt(b, 18)}" fill="#cfc7ba"/>
<g class="ofc-grade">${grade}</g>
<polygon points="${pt(t)} ${pt(l)} ${pt(l, -PAREDE)} ${pt(t, -PAREDE)}" fill="url(#ofc-parede-e)"/>
<polygon points="${pt(t)} ${pt(r)} ${pt(r, -PAREDE)} ${pt(t, -PAREDE)}" fill="url(#ofc-parede-d)"/>
${janela(0.8, 2.6)}${janela(3.4, 5.2)}
<polygon points="${pt(t)} ${pt(l)} ${pt(l, -14)} ${pt(t, -14)}" fill="${cor}" opacity=".85"/><polygon points="${pt(t)} ${pt(r)} ${pt(r, -14)} ${pt(t, -14)}" fill="${cor}" opacity=".7"/>
<polygon points="${pt(t, -PAREDE)} ${pt(l, -PAREDE)} ${pt(l, -PAREDE - 12)} ${pt(t, -PAREDE - 12)}" fill="#4a5265"/><polygon points="${pt(t, -PAREDE)} ${pt(r, -PAREDE)} ${pt(r, -PAREDE - 12)} ${pt(t, -PAREDE - 12)}" fill="#424a5c"/>
<g transform="matrix(1 ${inclina} 0 1 ${placa.x} ${placa.y - PAREDE + 80})"><text class="ofc-parede-marca" x="0" y="0">VYBE</text><text class="ofc-parede-sala" x="4" y="46" fill="${cor}">${safeText(ESCRITORIO_SALAS[sala]).toUpperCase()}</text></g>
</svg>`;
  const decor = (ESCRITORIO_DECOR[sala] || []).map(([n, u, v, alt]) => escritorioSprite(n, u, v, alt)).join("");
  const mesas = escritorioMesasDaSala(sala).map(({ pessoa, u, v }) => {
    const minha = pessoa.id === escritorio.base.eu;
    const cadeira = escritorioSprite("chairDesk_SE", u + 0.05, v - 0.72, 0, `filter:${ESCRITORIO_MATIZ[pessoa.perfil?.mesa] || ESCRITORIO_MATIZ.grafite}`);
    const objeto = ESCRITORIO_OBJETO_SPRITE[pessoa.perfil?.objeto];
    const p = escritorioProjetar(u, v);
    const z = Math.round((u + v) * 100) + 8;
    const tela = escritorioSprite("computerScreen_NW", u - 0.1, v - 0.05, 56);
    return `${cadeira}${escritorioSprite("desk_SE", u, v)}${objeto ? escritorioSprite(objeto, u + 0.32, v + 0.02, 56) : ""}${minha ? `<button class="ofc-pc" type="button" style="left:${p.x - 40}px;top:${p.y - 112}px;z-index:${z + 2}" onclick="abrirPainelDoEscritorio()" aria-label="Abrir o painel no computador da sua mesa" title="Abrir o painel">${tela}<span>Abrir painel</span></button>` : tela}<span class="ofc-placa${minha ? " minha" : ""}" style="left:${p.x - 30}px;top:${p.y + 14}px">${safeText(minha ? "Minha mesa" : pessoa.nome)}</span>`;
  }).join("");
  return `<div class="ofc-palco" id="office-stage" style="width:${W}px;height:${H}px;--sala:${cor}">${svg}${decor}${mesas}<div id="office-people" class="office-people"></div></div>`;
}
function escritorioStatusHtml(status) {
  const [nome, cor] = ESCRITORIO_STATUS[status] || ESCRITORIO_STATUS.disponivel;
  return `<i class="ofc-ponto" style="--st:${cor}"></i>${nome}`;
}
function atualizarPessoasEscritorio() {
  const pessoas = escritorio.online;
  const sala = escritorio.sala;
  const eu = escritorio.base?.eu;
  const proprio = pessoas.find((p) => p.id === eu);
  if (proprio) escritorio.status = proprio.status;
  // Desconectado, só a sua prévia aparece: ninguém vê você antes de entrar.
  const visiveis = escritorio.conectado
    ? pessoas
    : [{ id: eu, nome: "Você · fora do escritório", perfil: escritorio.perfil, sala, status: "ausente", x: escritorio.perfil.x || 50, y: escritorio.perfil.y || 75 }];
  const N = ESCRITORIO_CENA.N;
  const mapa = document.getElementById("office-people");
  if (mapa)
    mapa.innerHTML = visiveis
      .filter((p) => p.sala === sala)
      .map((p) => {
        const u = ((Number(p.x) || 50) / 100) * N, v = ((Number(p.y) || 70) / 100) * N;
        const pos = escritorioProjetar(u, v);
        const voce = p.id === eu;
        return `<button class="office-person${voce ? " voce" : ""}" style="left:${pos.x}px;top:${pos.y}px;z-index:${Math.round((u + v) * 100) + 3}" onclick="convidarConversaEscritorio('${safeText(p.id)}')" aria-label="${safeText(p.nome)}${voce ? " (você)" : ""} · ${safeText((ESCRITORIO_STATUS[p.status] || ESCRITORIO_STATUS.disponivel)[0])}"><span class="ofc-etiqueta">${escritorioStatusHtml(p.status)}<b>${safeText(voce && escritorio.conectado ? "Você" : p.nome)}</b></span>${escritorioAvatar(p.perfil, p.nome)}</button>`;
      })
      .join("");
  const lista = document.getElementById("office-roster");
  if (lista) {
    const online = escritorio.base.equipe.filter((p) => pessoas.some((o) => o.id === p.id));
    const fora = escritorio.base.equipe.filter((p) => !pessoas.some((o) => o.id === p.id));
    const linha = (p) => {
      const o = pessoas.find((x) => x.id === p.id);
      return `<li class="office-member${o ? "" : " fora"}">${escritorioAvatar(p.perfil, p.nome)}<div><b>${safeText(p.nome)}${p.id === eu ? " · você" : ""}</b><small>${o ? `${escritorioStatusHtml(o.status)} · ${safeText(ESCRITORIO_SALAS[o.sala])}` : "Fora do escritório"}</small></div>${o && o.sala !== sala ? `<button type="button" class="ofc-mini" onclick="mudarSalaEscritorio('${o.sala}')">Ir</button>` : ""}</li>`;
    };
    lista.innerHTML = `<h4>Online agora · ${online.length}</h4><ul>${online.map(linha).join("") || '<li class="ofc-vazio">Ninguém conectado ainda.</li>'}</ul><h4>Fora do escritório · ${fora.length}</h4><ul>${fora.map(linha).join("")}</ul>`;
  }
  const salas = document.getElementById("office-rooms");
  if (salas)
    salas.innerHTML = Object.entries(ESCRITORIO_SALAS).map(([id, nome]) => {
      const aqui = pessoas.filter((p) => p.sala === id).length;
      return `<button type="button" class="ofc-sala" aria-pressed="${id === sala}" style="--sala:${ESCRITORIO_COR_SALA[id]}" onclick="mudarSalaEscritorio('${id}')"><i></i><span>${nome}</span><small>${aqui ? aqui + (aqui > 1 ? " pessoas" : " pessoa") : "vazia"}</small></button>`;
    }).join("");
  const lote = document.getElementById("office-lista-salas");
  if (lote) lote.innerHTML = escritorioListaSalasHtml();
  const contador = document.getElementById("office-online");
  if (contador) contador.textContent = escritorio.conectado ? `${pessoas.length} online` : "Você está fora";
  atualizarDockEscritorio();
}
// Modo lista: as salas como cartões, sem cena. É o modo do celular.
function escritorioListaSalasHtml() {
  const pessoas = escritorio.conectado ? escritorio.online : [];
  return Object.entries(ESCRITORIO_SALAS).map(([id, nome]) => {
    const aqui = pessoas.filter((p) => p.sala === id);
    return `<article class="ofc-cartao" style="--sala:${ESCRITORIO_COR_SALA[id]}"><div class="ofc-cartao-topo"><i></i><h3>${nome}</h3><small>${aqui.length ? aqui.length + " online" : "Vazia"}</small></div><ul>${aqui.map((p) => `<li>${escritorioAvatar(p.perfil, p.nome)}<span><b>${safeText(p.nome)}</b><small>${escritorioStatusHtml(p.status)}</small></span></li>`).join("")}</ul><button type="button" class="ofc-mini" onclick="mudarSalaEscritorio('${id}',true)">${id === escritorio.sala ? "Você está aqui" : "Ir para esta sala"}</button></article>`;
  }).join("");
}
// Botões do dock dentro do escritório: o que muda com conexão e chamada.
function atualizarControlesEscritorio() {
  const el = document.getElementById("office-controls");
  if (!el) return;
  const c = escritorio.chamada, s = c?.self;
  const botao = (acao, icone, rotulo, extra = "") =>
    `<button type="button" class="ofc-dock-btn" onclick="${acao}" ${extra}>${escritorioIcone(icone)}<span>${rotulo}</span></button>`;
  const conversa = c
    ? botao("alternarMidiaEscritorio('audio')", "microfone", s.audioEnabled ? "Microfone ligado" : "Microfone desligado", `aria-pressed="${Boolean(s.audioEnabled)}"`) +
      botao("alternarMidiaEscritorio('video')", "camera", s.videoEnabled ? "Câmera ligada" : "Câmera desligada", `aria-pressed="${Boolean(s.videoEnabled)}"`) +
      botao("alternarMidiaEscritorio('screen')", "tela", s.screenShareEnabled ? "Parar de mostrar" : "Mostrar tela", `aria-pressed="${Boolean(s.screenShareEnabled)}"`) +
      botao("sairChamadaEscritorio().then(renderEscritorio)", "sair", "Sair da conversa", 'class="ofc-dock-btn perigo"')
    : botao("entrarChamadaEscritorio()", "fone", "Entrar na conversa", escritorio.conectado && escritorio.sala !== "foco" && !escritorio.entrandoChamada ? "" : "disabled");
  el.innerHTML = `<label class="ofc-status">${escritorioStatusHtml(escritorio.conectado ? escritorio.status : "ausente")}<select aria-label="Sua disponibilidade" ${escritorio.conectado ? "" : "disabled"} onchange="escritorio.status=this.value;escritorioEmitir('presence:status',{status:this.value});atualizarControlesEscritorio()">${Object.entries(ESCRITORIO_STATUS).map(([id, [nome]]) => `<option value="${id}" ${escritorio.status === id ? "selected" : ""}>${nome}</option>`).join("")}</select></label><span class="ofc-sep"></span>${conversa}<span class="ofc-sep"></span>${botao("irParaMinhaMesaEscritorio()", "mesa", "Minha mesa", escritorioMinhaMesa() ? "" : "disabled")}${botao("abrirPainelDoEscritorio()", "painel", "Abrir painel")}<span class="ofc-sep"></span>${escritorio.conectado ? botao("desconectarEscritorio()", "sair", "Sair do escritório") : botao("conectarEscritorio()", "entrar", escritorio.conectando ? "Entrando…" : "Entrar", escritorio.conectando ? "disabled" : "")}`;
}
function renderEscritorio() {
  const painel = document.getElementById("painel-escritorio");
  if (!painel || !escritorio.base) return;
  const b = escritorio.base,
    perfil = escritorio.perfil,
    sala = escritorio.sala;
  const eu = b.equipe.find((p) => p.id === b.eu);
  const celular = window.matchMedia?.("(max-width: 760px)").matches;
  const modo = escritorio.modo || (celular ? "lista" : "mapa");
  const aba = escritorio.aba || "pessoas";
  // No celular o painel lateral cobre o mapa: começa recolhido.
  const lateral = escritorio.lateral ?? !celular;
  const rail = (id, icone, rotulo, acao, ativo) =>
    `<button type="button" class="ofc-rail-btn" onclick="${acao}" aria-pressed="${Boolean(ativo)}" aria-label="${rotulo}" title="${rotulo}">${escritorioIcone(icone)}<span>${rotulo}</span></button>`;
  const lobby = !escritorio.conectado && !escritorio.lobbyFechado;
  painel.innerHTML = `<section class="ofc" data-modo="${modo}" data-lateral="${lateral}">
<nav class="ofc-rail" aria-label="Escritório">
 <img class="ofc-logo" src="${safeText(document.querySelector(".logo img")?.getAttribute("src") || "/assets/vybe-branca.png")}" alt="Vybe">
 ${rail("mapa", "mapa", "Mapa", "alternarModoEscritorio('mapa')", modo === "mapa")}
 ${rail("lista", "lista", "Salas", "alternarModoEscritorio('lista')", modo === "lista")}
 ${rail("pessoas", "pessoas", "Pessoas", "alternarAbaEscritorio('pessoas')", lateral && aba === "pessoas")}
 ${rail("conversa", "conversa", "Conversa", "alternarAbaEscritorio('conversa')", lateral && aba === "conversa")}
 <span class="ofc-rail-fim"></span>
 ${rail("espaco", "espaco", "Meu espaço", "personalizarEscritorio()", false)}
 ${rail("painel", "painel", "Painel", "abrirPainelDoEscritorio()", false)}
</nav>
<aside class="ofc-lateral" aria-label="${aba === "conversa" ? "Conversa da sala" : "Pessoas e salas"}">
 <div class="ofc-lateral-topo"><div><b>Vybe</b><small id="office-online">${escritorio.conectado ? escritorio.online.length + " online" : "Você está fora"}</small></div><button type="button" class="ofc-x" onclick="escritorio.lateral=false;renderEscritorio()" aria-label="Recolher painel lateral">×</button></div>
 <div class="ofc-abas" role="tablist"><button role="tab" aria-selected="${aba === "pessoas"}" onclick="alternarAbaEscritorio('pessoas',true)">Pessoas</button><button role="tab" aria-selected="${aba === "conversa"}" onclick="alternarAbaEscritorio('conversa',true)">Conversa</button></div>
 <div class="ofc-aba" ${aba === "pessoas" ? "" : "hidden"}><h4>Salas</h4><div id="office-rooms" class="ofc-salas"></div><div id="office-roster"></div><p class="ofc-nota">Online indica presença, não produtividade.</p></div>
 <section class="office-chat ofc-aba" ${aba === "conversa" ? "" : "hidden"}><div class="office-chat-head"><h3>${safeText(ESCRITORIO_SALAS[sala])}</h3><button class="office-text-button" onclick="carregarChatEscritorio()">Atualizar</button></div><div id="office-chat-list" role="log" aria-live="polite">Carregando mensagens…</div><form onsubmit="event.preventDefault();enviarChatEscritorio(this)"><input aria-label="Mensagem para esta sala" id="office-message" name="texto" oninput="delete this.form.dataset.chave" maxlength="2000" placeholder="Mensagem para ${safeText(ESCRITORIO_SALAS[sala])}" required autocomplete="off"><button class="workflow-primary">Enviar</button></form></section>
</aside>
<main class="ofc-principal">
 <div class="ofc-topo"><div class="ofc-sala-atual" style="--sala:${ESCRITORIO_COR_SALA[sala]}"><i></i><h2>${safeText(ESCRITORIO_SALAS[sala])}</h2><span>${sala === "foco" ? "Espaço silencioso, sem conversa por voz." : "Clique no piso para caminhar."}</span></div><p id="office-feedback" class="ofc-aviso" role="status">${safeText(b.demo ? "Demonstração local: presença e chamadas não se conectam." : b.aviso || "")}</p></div>
 <div class="ofc-mapa" id="office-map" tabindex="0" ${modo === "mapa" ? "" : "hidden"} aria-label="Mapa da sala ${safeText(ESCRITORIO_SALAS[sala])}. Clique no piso ou use as setas para mover seu personagem." onclick="moverEscritorio(event)" onkeydown="tecladoEscritorio(event)">${escritorioCenaHtml(sala)}</div>
 <div class="ofc-lista" id="office-lista-salas" ${modo === "lista" ? "" : "hidden"}></div>
 <section id="office-call" class="office-call" ${escritorio.chamada ? "" : "hidden"} aria-label="Conversa por voz"><div class="office-call-actions"><b>Conversa · ${safeText(escritorio.salaChamada || "")}</b></div><div id="office-call-media" class="office-call-media"></div></section>
 <div class="ofc-dock" id="office-controls" role="toolbar" aria-label="Controles do escritório"></div>
 ${lobby ? `<div class="ofc-lobby" role="dialog" aria-modal="false" aria-labelledby="ofc-lobby-titulo"><div class="ofc-lobby-cartao"><div class="ofc-lobby-avatar">${escritorioAvatar(perfil, eu?.nome || "Você")}</div><h2 id="ofc-lobby-titulo">Olá, ${safeText((eu?.nome || "").split(" ")[0] || "equipe")}</h2><p>Ao entrar, a equipe vê você no escritório. Câmera e microfone começam desligados.</p><div class="ofc-lobby-acoes"><button id="office-connect" type="button" class="ofc-primario" onclick="${b.demo ? "escritorio.lobbyFechado=true;renderEscritorio()" : "conectarEscritorio()"}" ${escritorio.conectando ? "disabled" : ""}>${b.demo ? "Ver o escritório" : escritorio.conectando ? "Entrando…" : "Entrar no escritório"}</button><button type="button" class="ofc-secundario" onclick="personalizarEscritorio()">Personalizar</button></div><label class="ofc-lobby-pref"><input type="checkbox" ${escritorioInicio() === "painel" ? "checked" : ""} onchange="escritorioInicio(this.checked?'painel':'escritorio')">Neste computador, abrir direto no painel</label><button type="button" class="office-text-button" onclick="escritorio.lobbyFechado=true;abrirPainelDoEscritorio()">Ir para o painel sem entrar</button></div></div>` : ""}
</main>
</section>`;
  document.body.classList.add("no-escritorio");
  atualizarPessoasEscritorio();
  atualizarControlesEscritorio();
  carregarChatEscritorio();
  if (escritorio.chamada) renderMidiaEscritorio();
  ajustarCenaEscritorio();
}
// A cena tem tamanho fixo e é escalada para caber; sem laço de animação.
let escritorioObservador = null;
function ajustarCenaEscritorio() {
  const mapa = document.getElementById("office-map"),
    palco = document.getElementById("office-stage");
  escritorioObservador?.disconnect();
  if (!mapa || !palco) return;
  const ajustar = () => {
    const { W, H } = escritorioCenaTamanho();
    const r = mapa.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // Espaço livre entre a barra da sala (em cima) e o dock (embaixo).
    const topo = 60, base = 84, util = Math.max(200, r.height - topo - base);
    const k = Math.min((r.width - 24) / W, util / H, 1);
    escritorio.escala = k;
    palco.style.transform = `translate(${(r.width - W * k) / 2}px,${topo + (util - H * k) / 2}px) scale(${k})`;
  };
  ajustar();
  if (window.ResizeObserver) {
    escritorioObservador = new ResizeObserver(ajustar);
    escritorioObservador.observe(mapa);
  }
}
function alternarAbaEscritorio(aba, manter) {
  const aberto = escritorio.lateral ?? !window.matchMedia?.("(max-width: 760px)").matches;
  if (!manter && aberto && (escritorio.aba || "pessoas") === aba) escritorio.lateral = false;
  else escritorio.lateral = true;
  escritorio.aba = aba;
  renderEscritorio();
}
function alternarModoEscritorio(modo) {
  escritorio.modo = modo;
  renderEscritorio();
}
function mudarSalaEscritorio(sala, verMapa) {
  if (!Object.hasOwn(ESCRITORIO_SALAS, sala)) return;
  escritorio.sala = sala;
  escritorio.perfil = { ...escritorio.perfil, x: 50, y: 70 };
  escritorioEmitir("presence:move", { sala, x: 50, y: 70 });
  if (verMapa) escritorio.modo = "mapa";
  renderEscritorio();
}
function escritorioMover(x, y) {
  escritorio.perfil = { ...escritorio.perfil, x, y };
  escritorioEmitir("presence:move", { sala: escritorio.sala, x, y });
  if (!escritorio.conectado) atualizarPessoasEscritorio();
}
function moverEscritorio(e) {
  if (e.target.closest("button") || (!escritorio.conectado && !escritorio.base?.demo)) return;
  const palco = document.getElementById("office-stage");
  if (!palco) return;
  const r = palco.getBoundingClientRect(), k = escritorio.escala || 1;
  const { W } = escritorioCenaTamanho();
  const { TW, TH, PAREDE, MARGEM } = ESCRITORIO_CENA;
  const a = ((e.clientX - r.left) / k - W / 2) / (TW / 2),
    s = ((e.clientY - r.top) / k - MARGEM - PAREDE) / (TH / 2);
  const u = (a + s) / 2, v = (s - a) / 2;
  if (u < 0 || v < 0 || u > ESCRITORIO_CENA.N || v > ESCRITORIO_CENA.N) return;
  escritorioMover(escritorioPorcentagem(u), escritorioPorcentagem(v));
}
// Setas seguem a tela, não os eixos do piso: para cima anda para o fundo.
function tecladoEscritorio(e) {
  const passo = { ArrowUp: [-3, -3], ArrowDown: [3, 3], ArrowLeft: [-3, 3], ArrowRight: [3, -3] }[e.key];
  if (!passo) return;
  e.preventDefault();
  if (!escritorio.conectado && !escritorio.base?.demo) return;
  const lim = (n) => Math.max(6, Math.min(94, n));
  escritorioMover(lim((escritorio.perfil.x || 50) + passo[0]), lim((escritorio.perfil.y || 75) + passo[1]));
}
function irParaMinhaMesaEscritorio() {
  const mesa = escritorioMinhaMesa();
  if (!mesa) return;
  if (escritorio.sala !== mesa.sala) {
    escritorio.sala = mesa.sala;
    escritorio.modo = "mapa";
    renderEscritorio();
  }
  const x = escritorioPorcentagem(mesa.u + 0.05), y = escritorioPorcentagem(mesa.v - 0.72);
  escritorio.perfil = { ...escritorio.perfil, x, y };
  escritorioEmitir("presence:move", { sala: mesa.sala, x, y });
  atualizarPessoasEscritorio();
}
// O painel é o computador da mesa: abre por cima do escritório e a presença
// continua; "Voltar ao escritório" no dock traz o mapa de volta.
function abrirPainelDoEscritorio() {
  const destino = escritorio.boardAntes && escritorio.boardAntes !== "escritorio" ? escritorio.boardAntes : "producao";
  const btn = document.getElementById("btn-board-" + destino);
  if (btn) switchBoard(destino, btn);
  if (escritorio.portaoAntes) {
    escritorio.portaoAntes = false;
    if (typeof openModeGate === "function") openModeGate();
  }
  atualizarDockEscritorio();
}
function voltarAoEscritorio() {
  if (typeof activeBoard !== "undefined" && activeBoard !== "escritorio") escritorio.boardAntes = activeBoard;
  closeTransientOverlaysForNavigation();
  if (typeof closeModeGate === "function") closeModeGate();
  switchBoard("escritorio", document.getElementById("btn-board-escritorio"));
}
// Preferência deste computador: quem produz pode preferir abrir no painel.
function escritorioInicio(valor) {
  try {
    if (valor) localStorage.setItem(ESCRITORIO_INICIO, valor);
    return localStorage.getItem(ESCRITORIO_INICIO) || "escritorio";
  } catch {
    return "escritorio";
  }
}
// Tela inicial: no computador, o painel abre no escritório — se ele estiver
// configurado e a pessoa não preferir o painel. No celular, segue o painel.
async function iniciarNoEscritorio() {
  if (window.matchMedia?.("(max-width: 760px)").matches) return;
  if (escritorioInicio() === "painel") return;
  if (new URLSearchParams(location.search).has("atividade")) return;
  const antes = typeof activeBoard !== "undefined" ? activeBoard : "producao";
  let base;
  try {
    base = await escritorioApi("entrada");
  } catch {
    return;
  }
  if (!base.demo && !base.worker) return;
  if (typeof activeBoard !== "undefined" && activeBoard !== antes) return;
  escritorio.base = base;
  escritorio.perfil = base.equipe.find((p) => p.id === base.eu)?.perfil || {};
  escritorio.sala = escritorio.perfil.sala || "convivencia";
  escritorio.portaoAntes = Boolean(document.getElementById("mode-gate")?.classList.contains("open"));
  escritorio.boardAntes = antes;
  voltarAoEscritorio();
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
