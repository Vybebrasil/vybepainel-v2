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
// Mesmo boneco do mapa (Habbo), em pé, para listas, lobby e cartões.
function escritorioAvatar(perfil = {}, nome = "") {
  // A cópia guardada no nosso banco (busca no catálogo só na primeira vez).
  const url = mapaBonecoGuardado(mapaFigura(perfil), 2);
  return `<img class="office-avatar" src="${url}" alt="Personagem de ${safeText(nome)}" width="64" height="110" loading="lazy">`;
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
// Aviso no canto: some sozinho depois de alguns segundos (erros ficam mais).
function escritorioAviso(texto) {
  const el = document.getElementById("office-feedback");
  if (!el) return;
  el.textContent = texto;
  clearTimeout(escritorio.timerAviso);
  if (texto) escritorio.timerAviso = setTimeout(() => { if (el.textContent === texto) el.textContent = ""; }, /falh|não |erro|negad|bloque/i.test(texto) ? 12000 : 6000);
}
async function abrirEscritorio() {
  const painel = document.getElementById("painel-escritorio");
  if (escritorio.base) {
    renderEscritorio();
    if (escritorioPrecisaAbertura()) abrirAberturaEscritorio();
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
    escritorioChegar();
    renderEscritorio();
    if (escritorioPrecisaAbertura()) abrirAberturaEscritorio();
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
        if (escritorio.tutorialPendente) { escritorio.tutorialPendente = false; setTimeout(iniciarTutorialEscritorio, 900); }
        setTimeout(() => escritorioMotorVoz().catch(() => {}), 1500);
        escritorioConversaAutomatica();
        carregarResumoRecados();
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
        avisarEntradasEscritorio(escritorio.online, e.payload);
        escritorio.online = e.payload;
        atualizarPessoasEscritorio();
        desenharMinimapaEscritorio();
      }
      if (e.type === "chat:changed" && e.payload.sala === escritorio.sala)
        carregarChatEscritorio();
      if (e.type === "realtime:error") escritorioAviso(e.payload.message);
      if (e.type === "zone:locks") {
        escritorio.trancas = new Map((e.payload || []).map((t) => [t.zona, new Set(t.permitidos)]));
        escritorio.mapa?.marcarTrancas(new Set(escritorio.trancas.keys()));
        atualizarControlesEscritorio();
      }
      if (e.type === "zone:knock") avisoBatidaEscritorio(e.payload);
      if (e.type === "recado:novo") recadoChegouEscritorio(e.payload);
      if (e.type === "furni:states") {
        escritorio.estadosMoveis = e.payload;
        escritorio.mapa?.estadosMoveis(e.payload);
        atualizarAcaoProximaEscritorio(true);
      }
      if (e.type === "reaction") escritorio.mapa?.reagir(e.payload.id, e.payload.tipo);
      if (e.type === "chat:bubble") escritorio.mapa?.balao(e.payload.id, e.payload.texto);
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
  // Sair do escritório volta para a entrada da Vybelândia.
  if (sairChamada) escritorio.lobbyFechado = false;
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
  if (sairChamada && typeof abrirAberturaEscritorio === "function") abrirAberturaEscritorio("saida");
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
  dock.innerHTML = `<button class="office-dock-volta" onclick="voltarAoEscritorio()">${escritorioIcone("mapa")}<span>Voltar ao escritório</span></button>${escritorio.conectado ? `<details class="office-dock-team"><summary>${escritorio.online.length} online</summary><div>${escritorio.online.map((p) => `<p>${safeText(p.nome)} · ${safeText(escritorioLugarDe(p).nome)}</p>`).join("")}</div></details>` : ""}${escritorio.chamada ? `<button onclick="alternarMidiaEscritorio('audio')">${escritorio.chamada.self.audioEnabled ? "Desligar microfone" : "Ligar microfone"}</button><button onclick="sairChamadaEscritorio()">Sair da chamada</button>` : ""}${escritorio.convite ? '<button onclick="aceitarConviteEscritorio()">Ver convite</button>' : ""}`;
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
    `<div class="workflow-kicker">Conversa da equipe</div><h2 class="workflow-title">${safeText(convite.nome)} convidou você</h2><p>A conversa é em ${safeText(ESCRITORIO_PLANTA.ambientes.find((a) => a.id === convite.zona)?.nome || ESCRITORIO_SALAS[convite.sala] || "outra sala")}. Ao chegar, você entra na conversa com o microfone ligado.</p><div class="workflow-actions"><button class="workflow-secondary" onclick="escritorio.convite=null;atualizarDockEscritorio();closeWorkflowModal()">Agora não</button><button class="workflow-primary" onclick="escritorio.convite=null;closeWorkflowModal();switchBoard('escritorio',document.getElementById('btn-board-escritorio'));escritorioIrParaAmbiente('${safeText(convite.zona || "")}');escritorioAviso('Ao chegar na sala, você entra na conversa com o microfone ligado.')">Ir até a conversa</button></div>`,
  );
}

function escritorioIcone(nome) {
  const d = {
    mapa: '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 17l8 4 8-4"/>',
    pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5"/><path d="M16 4.6a3 3 0 010 6M18 14.8c1.6.8 2.6 2.5 3 5.2"/>',
    conversa: '<path d="M4 5h16v11H9l-5 4z"/>',
    ajuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 014.8 1c0 1.7-2.4 2-2.4 3.6"/><path d="M12 17h.01"/>',
    espaco: '<circle cx="12" cy="8" r="3.6"/><path d="M5 21c.8-4.4 3.5-6.6 7-6.6s6.2 2.2 7 6.6"/>',
    painel: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
    mesa: '<path d="M3 10h18M5 10v9M19 10v9M8 10V6h8v4"/>',
    microfone: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    camera: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    tela: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 13V7M9 9.5L12 7l3 2.5M8 20h8"/>',
    sair: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
    entrar: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H8"/>',
    lista: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
    reagir: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2M9 9.5h.01M15 9.5h.01"/>',
    cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    som: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 010 6"/>',
    ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    alvo: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    fone: '<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  }[nome] || "";
  return `<svg class="ofc-ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
}
// Mapa único: a planta ganha, em cada sala individual, a mesa de quem a ocupa.
// Dono de cada sala individual: decisão do servidor (base.salas).
function escritorioDonos() {
  const donos = new Map();
  for (const s of escritorio.base?.salas || []) {
    const a = ESCRITORIO_PLANTA.ambientes.find((x) => x.id === s.id);
    if (a && s.pessoa_id) donos.set(s.pessoa_id, a);
  }
  return donos;
}
function escritorioNomeDaSala(a) {
  const s = (escritorio.base?.salas || []).find((x) => x.id === a.id);
  return s?.dono ? "Sala de " + s.dono : "Sala livre";
}
// Camadas do mapa: o mapa geral e cada sala individual. Sem nada salvo, vale o
// padrão do código. Nas salas, os itens ficam relativos ao canto da sala.
function escritorioItensDaCamada(camada) {
  const salvo = escritorio.edicao?.camada === camada ? escritorio.edicao.itens : escritorio.base?.mapa?.camadas?.[camada]?.itens;
  if (salvo) return salvo;
  if (camada === "geral") return ESCRITORIO_PLANTA.moveis;
  const a = ESCRITORIO_PLANTA.ambientes.find((x) => x.id === camada);
  return escritorioMoveisDaSala(a).map(([c, x, y, ...r]) => [c, x - a.x0, y - a.y0, ...r]);
}
function escritorioMoveisAtuais() {
  const moveis = escritorioItensDaCamada("geral").map((it, i) => [...it.slice(0, 6), { camada: "geral", i }]);
  for (const a of ESCRITORIO_PLANTA.ambientes) {
    if (!a.pessoal) continue;
    escritorioItensDaCamada(a.id).forEach(([c, x, y, dir, estado = 0, altura = 0], i) =>
      moveis.push([c, x + a.x0, y + a.y0, dir, estado, altura, { camada: a.id, i }]));
  }
  return moveis;
}
function escritorioPlantaComMesas() {
  return { ...ESCRITORIO_PLANTA, moveis: escritorioMoveisAtuais() };
}
// Nomes das salas individuais conforme o dono informado pelo servidor.
function escritorioAplicarSalas() {
  for (const a of ESCRITORIO_PLANTA.ambientes) if (a.pessoal) a.nome = escritorioNomeDaSala(a);
}
// Ao chegar, a pessoa aparece sentada na própria mesa; sem sala, na recepção.
function escritorioChegar() {
  const base = escritorio.base;
  escritorioAplicarSalas();
  escritorio.perfil = { ...(base.equipe.find((p) => p.id === base.eu)?.perfil || {}) };
  const mesa = escritorioMinhaMesa();
  // Chega pela porta da própria sala (a cadeira fica atrás da mesa, num canto
  // fechado); sem sala, pela recepção.
  const lugar = mesa ? escritorioNaSala(mesa.ambiente, 5, 8) : { x: 36, y: 8 };
  Object.assign(escritorio.perfil, escritorioParaPorcentagem(lugar.x, lugar.y));
  escritorio.sala = escritorioSalaEm(lugar.x, lugar.y);
  escritorio.zona = escritorioZonaEm(lugar.x, lugar.y);
}
function escritorioMinhaMesa() {
  const a = escritorioDonos().get(escritorio.base?.eu);
  return a ? { ambiente: a, ...escritorioMesaDaSala(a) } : null;
}
// Nome do lugar onde a pessoa está: a sala do mapa, o corredor ou a área externa.
function escritorioLugarDe(p) {
  const pos = escritorioPosicao(p || {});
  const a = escritorioAmbienteEm(pos.x, pos.y);
  if (a) return a;
  const P = ESCRITORIO_PLANTA.PREDIO;
  return { id: pos.x < P.x1 && pos.y < P.y1 ? "corredor" : "externa", nome: pos.x < P.x1 && pos.y < P.y1 ? "Corredor" : "Área externa", sala: "convivencia" };
}
// "Ir" ao lado de alguém: anda até um ladrilho livre ao lado da pessoa.
function escritorioIrAte(id) {
  const o = escritorio.online.find((p) => p.id === id);
  if (!o || !escritorio.mapa) return;
  const alvo = escritorioPosicao(o), de = escritorioPosicao(escritorio.perfil || {});
  const x0 = Math.round(alvo.x), y0 = Math.round(alvo.y);
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    if (escritorio.mapa.assentoEm(x0 + dx, y0 + dy) !== undefined) continue;
    if (escritorio.mapa.caminho(de, { x: x0 + dx, y: y0 + dy })) { escritorioIrPara(x0 + dx, y0 + dy); movimento.turbo = true; return; }
  }
  escritorioAviso("Não achei caminho até " + o.nome + ".");
}
// Anda até um ambiente: o ladrilho livre mais perto do centro que tenha caminho.
function escritorioIrParaAmbiente(id) {
  const a = ESCRITORIO_PLANTA.ambientes.find((x) => x.id === id);
  if (!a || !escritorio.mapa) return;
  if (escritorio.modo === "lista") { escritorio.modo = "mapa"; renderEscritorio(); }
  const de = escritorioPosicao(escritorio.perfil || {});
  const cx = Math.floor((a.x0 + a.x1) / 2), cy = Math.floor((a.y0 + a.y1) / 2);
  for (let r = 0; r < 6; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = cx + dx, y = cy + dy;
    if (x < a.x0 || y < a.y0 || x >= a.x1 || y >= a.y1) continue;
    if (escritorio.mapa.assentoEm(x, y) !== undefined) continue;
    if (escritorio.mapa.caminho(de, { x, y })) { escritorioIrPara(x, y); movimento.turbo = true; return; }
  }
  escritorioAviso("Não achei caminho até " + a.nome + ".");
}
// Onde a pessoa está no mapa (ladrilho), a partir da presença em porcentagem.
function escritorioPosicao(p) {
  return escritorioParaMapa(p.x ?? 50, p.y ?? 50);
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
  if (escritorio.mapa) {
    escritorio.mapa.atualizarPessoas(visiveis.map((p) => {
      const voce = p.id === eu;
      // O próprio boneco é guiado localmente (movimento contínuo); o servidor
      // só repete o que este navegador mandou.
      const pos = voce ? escritorioPosicao(escritorio.perfil || {}) : escritorioPosicao(p);
      const perfilDe = escritorio.base.equipe.find((e) => e.id === p.id)?.perfil || p.perfil || {};
      // Parado num assento (cadeira, sofá, banqueta…), o boneco senta virado
      // para onde o assento olha.
      const dirAssento = escritorio.mapa.assentoEm(pos.x, pos.y);
      const sentado = dirAssento !== undefined;
      const [nomeStatus, corStatus] = ESCRITORIO_STATUS[p.status] || ESCRITORIO_STATUS.disponivel;
      return {
        id: p.id, nome: voce && escritorio.conectado ? "Você" : p.nome, perfil: perfilDe, status: p.status, corStatus,
        rotulo: `${p.nome}${voce ? " (você)" : ""} · ${nomeStatus}`,
        statusTexto: p.status && p.status !== "disponivel" ? nomeStatus : "",
        x: Math.round(pos.x), y: Math.round(pos.y),
        acao: escritorioAcaoDaPose(voce ? escritorio.pose : p.pose, sentado),
        mao: ESCRITORIO_MAO[voce ? escritorio.pose : p.pose] || "",
        dir: sentado ? dirAssento : ESCRITORIO_APARELHOS[voce ? escritorio.pose : p.pose] ? escritorioNoAparelho(Math.round(pos.x), Math.round(pos.y))?.dir : undefined, local: voce,
        aoClicar: voce ? personalizarEscritorio : abrirRecadosEscritorio,
      };
    }));
  }
  const lista = document.getElementById("office-roster");
  if (lista) {
    const online = escritorio.base.equipe.filter((p) => pessoas.some((o) => o.id === p.id));
    const fora = escritorio.base.equipe.filter((p) => !pessoas.some((o) => o.id === p.id));
    const linha = (p) => {
      const o = pessoas.find((x) => x.id === p.id);
      return `<li class="office-member${o ? "" : " fora"}">${escritorioAvatar(p.perfil, p.nome)}<div><b>${safeText(p.nome)}${p.id === eu ? " · você" : ""}</b><small>${o ? `${escritorioStatusHtml(o.status)} · ${safeText(escritorioLugarDe(o).nome)}` : "Fora do escritório"}</small></div>${o && p.id !== eu ? `<button type="button" class="ofc-mini" onclick="escritorioIrAte('${safeText(o.id)}')">Ir</button><button type="button" class="ofc-mini" onclick="seguirPessoaEscritorio('${safeText(o.id)}')">Seguir</button>` : ""}${p.id !== eu ? `<button type="button" class="ofc-mini" onclick="abrirRecadosEscritorio('${safeText(p.id)}')" aria-label="Recado para ${safeText(p.nome)}">Recado${escritorio.recadosResumo?.[p.id] ? ` · ${escritorio.recadosResumo[p.id]}` : ""}</button>` : ""}</li>`;
    };
    lista.innerHTML = `<h4>Online agora · ${online.length}</h4><ul>${online.map(linha).join("") || '<li class="ofc-vazio">Ninguém conectado ainda.</li>'}</ul><h4>Fora do escritório · ${fora.length}</h4><ul>${fora.map(linha).join("")}</ul>`;
  }
  const salas = document.getElementById("office-rooms");
  if (salas) {
    const meu = escritorioLugarDe(escritorio.perfil).id;
    const contar = (id) => pessoas.filter((p) => escritorioLugarDe(p).id === id).length;
    const linha = (a) => {
      const aqui = contar(a.id);
      return `<button type="button" class="ofc-sala" aria-pressed="${a.id === meu}" style="--sala:${ESCRITORIO_COR_SALA[a.sala]}" onclick="escritorioIrParaAmbiente('${a.id}')"><i></i><span>${safeText(a.nome)}</span><small>${aqui ? aqui + (aqui > 1 ? " pessoas" : " pessoa") : a.id === meu ? "você" : ""}</small></button>`;
    };
    const A = ESCRITORIO_PLANTA.ambientes;
    salas.innerHTML = `<h5>Salas individuais</h5>${A.filter((a) => a.pessoal).map(linha).join("")}<h5>Espaços</h5>${A.filter((a) => !a.pessoal).map(linha).join("")}`;
  }
  const lote = document.getElementById("office-lista-salas");
  if (lote) lote.innerHTML = escritorioListaSalasHtml();
  const lugar = document.getElementById("office-lugar");
  if (lugar) lugar.textContent = escritorioLugarDe(escritorio.perfil).nome;
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
  // Dock numa linha só: só os botões principais mostram o nome; os outros são
  // ícone com nome no rótulo acessível e na dica do mouse.
  const botao = (acao, icone, rotulo, extra = "", { texto = false, classe = "" } = {}) =>
    `<button type="button" class="ofc-dock-btn${classe ? " " + classe : ""}" onclick="${acao}" aria-label="${rotulo}" ${/title=/.test(extra) ? "" : `title="${rotulo}"`} ${extra}>${escritorioIcone(icone)}${texto ? `<span>${rotulo}</span>` : ""}</button>`;
  const conversa = c
    ? botao("alternarMidiaEscritorio('audio')", "microfone", s.audioEnabled ? "Microfone ligado" : "Microfone desligado", `aria-pressed="${Boolean(s.audioEnabled)}"`) +
      botao("alternarMidiaEscritorio('video')", "camera", s.videoEnabled ? "Câmera ligada" : "Câmera desligada", `aria-pressed="${Boolean(s.videoEnabled)}"`) +
      botao("abrirAjustesAudioEscritorio()", "ajustes", "Ajustes de áudio", 'id="ofc-btn-audio"') +
      botao("alternarMidiaEscritorio('screen')", "tela", s.screenShareEnabled ? "Parar de mostrar" : "Mostrar tela", `aria-pressed="${Boolean(s.screenShareEnabled)}"`) +
      `<span class="ofc-voz-estado" role="status">${escritorioIcone("fone")}<span>Na conversa da sala</span></span>`
    // A conversa é automática por sala: sem botão de entrar. Só aparece o
    // estado e, se falhou, "Tentar de novo".
    : !escritorio.conectado || !escritorio.zona || escritorio.zona === "foco"
      ? `<span class="ofc-voz-estado">${escritorioIcone("fone")}<span>${escritorio.zona === "foco" ? "Foco: sem voz" : "Sem voz no corredor"}</span></span>`
      : escritorio.falhaConversa && !escritorio.entrandoChamada
        ? botao("escritorio.falhaConversa='';entrarChamadaEscritorio({microfone:true})", "fone", "Voz falhou · tentar de novo", `title="${safeText(escritorio.falhaConversa)}"`, { texto: true, classe: "perigo" })
        : `<span class="ofc-voz-estado" role="status">${escritorioIcone("fone")}<span>Conectando a voz…</span></span>`;
  el.innerHTML = `<button type="button" class="ofc-dock-btn ofc-eu" onclick="personalizarEscritorio()" aria-label="Personalizar meu personagem" title="Personalizar meu personagem">${escritorioAvatar(escritorio.perfil, "você")}</button><span class="ofc-sep"></span><label class="ofc-status">${escritorioStatusHtml(escritorio.conectado ? escritorio.status : "ausente")}<select aria-label="Sua disponibilidade" ${escritorio.conectado ? "" : "disabled"} onchange="escritorio.status=this.value;escritorioEmitir('presence:status',{status:this.value});atualizarControlesEscritorio()">${Object.entries(ESCRITORIO_STATUS).map(([id, [nome]]) => `<option value="${id}" ${escritorio.status === id ? "selected" : ""}>${nome}</option>`).join("")}</select></label><span class="ofc-sep"></span>${conversa}${escritorio.conectado ? `<details class="ofc-reacoes" id="office-reacoes"><summary class="ofc-dock-btn" aria-label="Reagir" title="Reagir">${escritorioIcone("reagir")}</summary><div>${Object.entries(ESCRITORIO_REACOES).map(([t, e]) => `<button type="button" onclick="reagirEscritorio('${t}')" aria-label="Reagir com ${t}">${e}</button>`).join("")}</div></details>` : ""}${escritorio.conectado ? `<details class="ofc-reacoes" id="office-poses"><summary class="ofc-dock-btn" aria-label="Ações do boneco" title="Ações do boneco">${escritorioIcone("espaco")}</summary><div class="ofc-poses"><button type="button" onclick="definirPoseEscritorio(escritorio.pose==='acenar'?'':'acenar')">Acenar <kbd>1</kbd></button><button type="button" onclick="deitarEscritorio()">Deitar <kbd>2</kbd></button><button type="button" onclick="definirPoseEscritorio(escritorio.pose==='cafe'?'':'cafe')">Café na mão <kbd>3</kbd></button></div></details>` : ""}${escritorioPodeTrancar() ? botao("trancarZonaEscritorio()", "cadeado", escritorio.trancas?.has(escritorio.zona) ? "Destrancar" : "Trancar sala", `aria-pressed="${Boolean(escritorio.trancas?.has(escritorio.zona))}"`) : ""}<span class="ofc-sep"></span>${botao("irParaMinhaMesaEscritorio()", "mesa", "Minha mesa", escritorioMinhaMesa() ? "" : "disabled")}${botao("alternarSomEscritorio()", "som", escritorioSomLigado() ? "Som ligado" : "Som desligado", `aria-pressed="${escritorioSomLigado()}"`)}${botao("abrirPainelDoEscritorio()", "painel", escritorio.avisos ? `Painel · ${escritorio.avisos} ${escritorio.avisos === 1 ? "aviso" : "avisos"}` : "Painel", `id="ofc-btn-painel"${escritorio.avisos ? ' data-avisos="true"' : ""}`, { texto: true })}<span class="ofc-sep"></span>${escritorio.conectado ? botao("desconectarEscritorio()", "sair", "Sair do escritório", "", { classe: "perigo" }) : botao("conectarEscritorio()", "entrar", escritorio.conectando ? "Entrando…" : "Entrar", escritorio.conectando ? "disabled" : "", { texto: true })}`;
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
 ${escritorioCamadaParaEditar() ? rail("editar", "editar", escritorio.base.admin ? "Editar" : "Minha sala", escritorio.edicao ? "sairEditorEscritorio()" : "abrirEditorEscritorio()", Boolean(escritorio.edicao)) : ""}
 ${rail("espaco", "espaco", "Meu espaço", "personalizarEscritorio()", false)}
 ${rail("painel", "painel", "Painel", "abrirPainelDoEscritorio()", false)}
 ${rail("ajuda", "ajuda", "Tutorial", "iniciarTutorialEscritorio()", false)}
</nav>
<aside class="ofc-lateral" aria-label="${aba === "conversa" ? "Conversa da sala" : "Pessoas e salas"}">
 <div class="ofc-lateral-topo"><div><b>Vybe</b><small id="office-online">${escritorio.conectado ? escritorio.online.length + " online" : "Você está fora"}</small></div><button type="button" class="ofc-x" onclick="escritorio.lateral=false;renderEscritorio()" aria-label="Recolher painel lateral">×</button></div>
 <div class="ofc-abas" role="tablist"${escritorio.edicao ? ' style="grid-template-columns:repeat(4,1fr)"' : ' style="grid-template-columns:repeat(3,1fr)"'}>${escritorio.edicao ? `<button role="tab" aria-selected="${aba === "catalogo"}" onclick="alternarAbaEscritorio('catalogo',true)">Catálogo</button>` : ""}<button role="tab" aria-selected="${aba === "pessoas"}" onclick="alternarAbaEscritorio('pessoas',true)">Pessoas</button><button role="tab" aria-selected="${aba === "conversa"}" onclick="alternarAbaEscritorio('conversa',true)">Conversa</button><button role="tab" aria-selected="${aba === "recados"}" onclick="alternarAbaEscritorio('recados',true)">Recados${escritorioRecadosNaoLidos() ? ` <span class="ofc-badge">${escritorioRecadosNaoLidos()}</span>` : ""}</button></div>
 ${escritorio.edicao ? `<div class="ofc-aba ofc-catalogo" ${aba === "catalogo" ? "" : "hidden"}>${escritorioCatalogoHtml()}</div>` : ""}
 <div class="ofc-aba" ${aba === "pessoas" ? "" : "hidden"}><h4>Salas</h4><div id="office-rooms" class="ofc-salas"></div><div id="office-roster"></div><p class="ofc-nota">Online indica presença, não produtividade.</p></div>
 <section class="office-chat ofc-aba" ${aba === "conversa" ? "" : "hidden"}><div class="office-chat-head"><h3>${safeText(ESCRITORIO_SALAS[sala])}</h3><button class="office-text-button" onclick="carregarChatEscritorio()">Atualizar</button></div><div id="office-chat-list" role="log" aria-live="polite">Carregando mensagens…</div><form onsubmit="event.preventDefault();enviarChatEscritorio(this)"><input aria-label="Mensagem para esta sala" id="office-message" name="texto" oninput="delete this.form.dataset.chave" maxlength="2000" placeholder="Mensagem para ${safeText(ESCRITORIO_SALAS[sala])}" required autocomplete="off"><button class="workflow-primary">Enviar</button></form></section>
 <section class="office-chat ofc-aba ofc-recados" id="office-recados" ${aba === "recados" ? "" : "hidden"}>${escritorioRecadosHtml()}</section>
</aside>
<main class="ofc-principal">
 <div class="ofc-topo"><div class="ofc-sala-atual" style="--sala:${ESCRITORIO_COR_SALA[sala]}"><i></i><h2 id="office-lugar">${safeText(escritorioLugarDe(escritorio.perfil).nome)}</h2><span id="office-lugar-dica"></span></div><p id="office-feedback" class="ofc-aviso" role="status">${safeText(b.demo ? "Demonstração local: presença e chamadas não se conectam." : b.aviso || "")}</p></div>
 <div id="office-map-lugar" ${modo === "mapa" ? "" : "hidden"}></div>
 <div id="office-mesa-card" class="ofc-mesa-card" role="dialog" aria-label="Sua mesa" hidden onmouseleave="this.hidden=true"></div>
 <div id="office-info-card" class="ofc-mesa-card ofc-info-card" role="status" hidden onmouseleave="this.hidden=true"></div>
 <details class="ofc-areas" ${modo === "mapa" ? "" : "hidden"}><summary aria-label="Ir para uma área">${escritorioIcone("mapa")}<span>Ir para</span></summary><nav aria-label="Áreas do mapa">${ESCRITORIO_AREAS.map(([id, nome]) => `<button type="button" onclick="olharAreaEscritorio('${id}');this.closest('details').open=false">${nome}</button>`).join("")}</nav></details>
 <div class="ofc-zoom" ${modo === "mapa" ? "" : "hidden"}><button type="button" onclick="escritorio.mapa?.mudarZoom(1.25)" aria-label="Aproximar">+</button><button type="button" onclick="escritorio.mapa?.mudarZoom(0.8)" aria-label="Afastar">−</button><button type="button" onclick="centralizarEmMimEscritorio()" aria-label="Centralizar em mim" title="Centralizar em mim">${escritorioIcone("alvo")}</button></div>
 <div class="ofc-lista" id="office-lista-salas" ${modo === "lista" ? "" : "hidden"}></div>
 <section id="office-call" class="office-call${escritorio.callAberta ? " aberta" : ""}" ${escritorio.chamada ? "" : "hidden"} aria-label="Conversa por voz"><button type="button" class="office-call-actions" aria-expanded="${Boolean(escritorio.callAberta)}" onclick="escritorio.callAberta=!escritorio.callAberta;this.parentElement.classList.toggle('aberta',escritorio.callAberta);this.setAttribute('aria-expanded',escritorio.callAberta)"><b>Conversa · ${safeText(escritorio.salaChamada || "")}</b><span id="office-call-rostos" class="office-call-rostos"></span><i class="office-call-seta" aria-hidden="true"></i></button><div id="office-call-media" class="office-call-media"></div></section>
 <div class="ofc-editor" id="office-editor" role="toolbar" aria-label="Editor do mapa" hidden></div>
 <div class="ofc-acao" id="office-acao" hidden></div>
 <div class="ofc-avisos" id="office-avisos" aria-live="polite"></div>
 <canvas class="ofc-minimapa" id="office-minimapa" width="232" height="168" ${modo === "mapa" ? "" : "hidden"} aria-label="Minimapa: clique para ir até lá" onclick="cliqueMinimapaEscritorio(event)"></canvas>
 <div class="ofc-dock" id="office-controls" role="toolbar" aria-label="Controles do escritório"></div>
 ${lobby ? `<div class="ofc-lobby" role="dialog" aria-modal="false" aria-labelledby="ofc-lobby-titulo">${typeof vybelandiaCenaHtml === "function" ? vybelandiaCenaHtml() : ""}<div class="abr-vinheta" aria-hidden="true"></div><div class="ofc-lobby-cartao"><div class="ofc-lobby-avatar">${escritorioAvatar(perfil, eu?.nome || "Você")}</div><h2 id="ofc-lobby-titulo">Olá, ${safeText((eu?.nome || "").split(" ")[0] || "equipe")}</h2><p>Ao entrar, a equipe vê você no escritório. Em cada sala você entra na conversa dela com o microfone ligado; a câmera começa desligada.</p><div class="ofc-lobby-acoes"><button id="office-connect" type="button" class="ofc-primario" onclick="${b.demo ? "escritorio.lobbyFechado=true;renderEscritorio()" : "conectarEscritorio()"}" ${escritorio.conectando ? "disabled" : ""}>${b.demo ? "Ver o escritório" : escritorio.conectando ? "Entrando…" : "Entrar no escritório"}</button><button type="button" class="ofc-secundario" onclick="personalizarEscritorio()">Personalizar</button></div></div></div>` : ""}
</main>
</section>`;
  document.body.classList.add("no-escritorio");
  atualizarPessoasEscritorio();
  atualizarControlesEscritorio();
  carregarChatEscritorio();
  if (escritorio.chamada) renderMidiaEscritorio();
  montarMapaEscritorio();
  if (typeof renderBarraEditorEscritorio === "function") renderBarraEditorEscritorio();
  atualizarCabecalhoEscritorio();
  escritorio.minimapaEm = 0;
  setTimeout(desenharMinimapaEscritorio, 50);
  atualizarAcaoProximaEscritorio();
}
// O mapa é criado uma vez e só muda de lugar quando a tela é redesenhada:
// assim não recarrega móveis nem perde câmera e animação.
function montarMapaEscritorio() {
  const lugar = document.getElementById("office-map-lugar");
  if (!lugar) return;
  if (!escritorio.mapaEl) {
    const el = document.createElement("div");
    el.className = "ofc-mapa";
    el.id = "office-map";
    el.tabIndex = 0;
    el.setAttribute("aria-label", "Mapa do escritório. Clique no piso ou use as setas para andar; arraste para mover o mapa.");
    escritorio.mapaEl = el;
  }
  const el = escritorio.mapaEl;
  el.hidden = lugar.hidden;
  lugar.replaceWith(el);
  if (!escritorio.mapa) {
    escritorio.mapa = criarMapaEscritorio(el, {
      planta: escritorioPlantaComMesas(),
      logo: document.querySelector(".logo img")?.getAttribute("src") || "/assets/vybe-branca.png",
      eu: escritorio.base.eu,
      aoClicar: (x, y) => cliqueNoMapaEscritorio(x, y),
      aoPassar: (x, y, cx, cy) => passarNoMapaEscritorio(x, y, cx, cy),
    });
    requestAnimationFrame(() => centralizarEmMimEscritorio());
    escritorio.mapa.marcarZona(ESCRITORIO_PLANTA.ambientes.find((a) => a.id === escritorio.zona) || null);
    // Se a posição salva ficou presa (móvel em volta), sai pelo ladrilho livre
    // mais perto que tenha caminho até a recepção.
    escritorio.mapa.prontos.then(() => escritorioDestravar());
    if (escritorio.estadosMoveis) escritorio.mapa.estadosMoveis(escritorio.estadosMoveis);
    escritorio.mapa.prontos.then(() => { if (typeof notificacoes !== "undefined") escritorioAvisos(notificacoes); });
    // Cópia do próprio boneco no nosso banco, para quando o Habbo estiver fora.
    if (!escritorio.base.demo) setTimeout(() => mapaGuardarBoneco(mapaFigura(escritorio.perfil)), 4000);
  }
  atualizarPessoasEscritorio();
}
function centralizarEmMimEscritorio() {
  const pos = escritorioPosicao(escritorio.perfil || {});
  escritorio.mapa?.centralizar(pos.x, pos.y);
  escritorio.mapa?.seguir(pos.x, pos.y, true);
}
function alternarAbaEscritorio(aba, manter) {
  const aberto = escritorio.lateral ?? !window.matchMedia?.("(max-width: 760px)").matches;
  if (!manter && aberto && (escritorio.aba || "pessoas") === aba) escritorio.lateral = false;
  else escritorio.lateral = true;
  escritorio.aba = aba;
  renderEscritorio();
  if (aba === "recados") atualizarRecadosEscritorio();
}
function alternarModoEscritorio(modo) {
  escritorio.modo = modo;
  renderEscritorio();
}
// Ir para uma sala de conversa: anda até o primeiro ambiente dela.
function mudarSalaEscritorio(sala, verMapa) {
  if (!Object.hasOwn(ESCRITORIO_SALAS, sala)) return;
  const a = ESCRITORIO_PLANTA.ambientes.find((x) => x.sala === sala && !x.pessoal);
  if (verMapa) escritorio.modo = "mapa";
  escritorioIrPara(a ? (a.x0 + a.x1) / 2 : 30, a ? a.y1 - 1.5 : 18);
  movimento.turbo = true;
  if (verMapa) renderEscritorio();
}
// Movimento contínuo (como em jogo): a posição anda em frações de ladrilho a
// cada quadro, com colisão na grade do mapa. Clique segue o caminho livre
// (A*); WASD/setas dirigem direto. A presença vai para a equipe a cada 150 ms.
const ESCRITORIO_VELOCIDADE = 5.8; // ladrilhos por segundo (o antigo "correr" virou o normal)
const movimento = { x: 0, y: 0, rota: [], quadro: null, ultimo: 0, envio: 0, dir: 2, andando: false };
function escritorioZonaEm(x, y) {
  return escritorioAmbienteEm(x, y)?.id || "";
}
// Atualiza o que depende do lugar: sala de conversa, zona, cabeçalho e dock.
function escritorioMudouLugar(x, y) {
  // O ladrilho em que a pessoa está é o arredondado (o mesmo do andar).
  x = Math.round(x); y = Math.round(y);
  const sala = escritorioSalaEm(x, y), zona = escritorioZonaEm(x, y);
  if (zona === escritorio.zona && sala === escritorio.sala) return;
  const saiuDaZona = zona !== escritorio.zona;
  escritorio.sala = sala;
  escritorio.zona = zona;
  escritorio.mapa?.marcarZona(zona ? ESCRITORIO_PLANTA.ambientes.find((a) => a.id === zona) : null);
  // Como no SoWork: sair da zona encerra a conversa dela. Entrar numa sala
  // (decisão do Paulo) já entra na conversa dela com o microfone ligado.
  if (saiuDaZona && escritorio.chamada) {
    sairChamadaEscritorio();
    escritorioAviso("Você saiu da sala e da conversa.");
  }
  if (saiuDaZona) { escritorio.falhaConversa = ""; escritorioConversaAutomatica(); }
  atualizarCabecalhoEscritorio();
  atualizarControlesEscritorio();
}
function atualizarCabecalhoEscritorio() {
  const lugar = document.getElementById("office-lugar"), dica = document.getElementById("office-lugar-dica");
  if (lugar) lugar.textContent = escritorioLugarDe(escritorio.perfil).nome;
  if (dica) dica.textContent = escritorio.zona
    ? (escritorio.zona === "foco" ? "Zona silenciosa: sem conversa por voz." : "Zona de conversa: quem está aqui pode falar com você.")
    : "Corredor · entre numa sala para conversar";
}
function escritorioEnviarPosicao(forcar) {
  const agora = performance.now();
  if (!forcar && agora - movimento.envio < 150) return;
  movimento.envio = agora;
  const { x: px, y: py } = escritorioParaPorcentagem(movimento.x, movimento.y);
  escritorio.perfil = { ...escritorio.perfil, x: px, y: py };
  escritorioEmitir("presence:move", { sala: escritorio.sala, zona: escritorio.zona, x: px, y: py });
}
// Toque rápido só vira o boneco (como no Habbo); segurar mais de 140 ms anda.
function escritorioDirecaoTeclas(agora = performance.now()) {
  let dx = 0, dy = 0;
  for (const t of escritorioTeclas) {
    if (agora - (escritorioTeclasDesde.get(t) || 0) < 140) continue;
    dx += ESCRITORIO_TECLAS[t][0]; dy += ESCRITORIO_TECLAS[t][1];
  }
  const n = Math.hypot(dx, dy);
  return n ? [dx / n, dy / n] : [0, 0];
}
// Pode ocupar a posição (x,y) vindo de (ox,oy)? Testa a troca de ladrilho.
// Sala trancada: só entra quem estava lá ou foi deixado entrar.
function escritorioZonaBloqueada(zona) {
  const t = zona && escritorio.trancas?.get(zona);
  return Boolean(t) && !t.has(String(escritorio.base?.eu)) && zona !== escritorio.zona;
}
function escritorioPodeIr(ox, oy, x, y) {
  const a = { x: Math.round(ox), y: Math.round(oy) }, b = { x: Math.round(x), y: Math.round(y) };
  if (a.x === b.x && a.y === b.y) return true;
  if (escritorioZonaBloqueada(escritorioZonaEm(b.x, b.y))) { avisarTrancadaEscritorio(escritorioZonaEm(b.x, b.y)); return false; }
  // Ninguém atravessa ninguém: o ladrilho de outra pessoa é ocupado.
  if (escritorioOcupado(b.x, b.y)) return false;
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return false;
  if (!escritorio.mapa?.podePassar(a.x, a.y, dx, dy)) return false;
  // Assento só pelo clique (senta); andando com o teclado ele é sólido.
  return escritorio.mapa.assentoEm(b.x, b.y) === undefined;
}
function escritorioQuadro(agora) {
  movimento.quadro = null;
  const dt = Math.min(0.05, (agora - (movimento.ultimo || agora)) / 1000);
  movimento.ultimo = agora;
  let [vx, vy] = escritorioDirecaoTeclas(agora);
  let teclado = Boolean(vx || vy);
  if (ESCRITORIO_APARELHOS[escritorio.pose] && (teclado || movimento.rota.length)) definirPoseEscritorio("");
  // Ir até uma sala ou pessoa pela lateral: 3x mais rápido (viagem longa).
  if (teclado) movimento.turbo = false;
  const velocidade = ESCRITORIO_VELOCIDADE * (escritorio.correndo && teclado ? 1.5 : 1) * (movimento.turbo && !teclado ? 3 : 1);
  if (!teclado && movimento.rota.length) {
    const alvo = movimento.rota[0];
    const dx = alvo.x - movimento.x, dy = alvo.y - movimento.y, d = Math.hypot(dx, dy);
    const passo = velocidade * dt;
    if (d <= passo) {
      movimento.x = alvo.x; movimento.y = alvo.y;
      movimento.rota.shift();
      vx = dx; vy = dy;
    } else {
      vx = dx / d; vy = dy / d;
      movimento.x += vx * passo; movimento.y += vy * passo;
    }
  } else if (teclado) {
    // Tecla manda: a rota do clique (se houver) é abandonada.
    movimento.rota.length = 0;
    const passo = velocidade * dt;
    const nx = movimento.x + vx * passo, ny = movimento.y + vy * passo;
    // O corpo tem largura: testa o ladrilho um pouco à frente (folga), para o
    // boneco não entrar meio ladrilho dentro de móvel ou parede.
    const fx = Math.sign(vx) * 0.3, fy = Math.sign(vy) * 0.3;
    const pode = (x, y, ax, ay) => escritorioPodeIr(movimento.x, movimento.y, x + ax, y + ay) && escritorioPodeIr(movimento.x, movimento.y, x, y);
    // Bate e desliza: tenta o movimento todo, depois só um eixo.
    if (pode(nx, ny, fx, fy)) { movimento.x = nx; movimento.y = ny; }
    else if (pode(nx, movimento.y, fx, 0)) movimento.x = nx;
    else if (pode(movimento.x, ny, 0, fy)) movimento.y = ny;
  }
  // Soltou a tecla no meio do ladrilho: termina o passo até o centro dele
  // (como no Habbo), em vez de pular para lá.
  if (teclado) movimento.ultimoV = [vx, vy];
  if (!teclado && !movimento.rota.length && (movimento.x % 1 || movimento.y % 1)) {
    // Segue no sentido em que andava até o próximo centro; se não der, o mais perto.
    const [ux, uy] = movimento.ultimoV || [0, 0];
    const adiante = (v, u) => (u > 0.2 ? Math.ceil(v) : u < -0.2 ? Math.floor(v) : Math.round(v));
    const ax = adiante(movimento.x, ux), ay = adiante(movimento.y, uy);
    const cx = Math.round(movimento.x), cy = Math.round(movimento.y);
    if (escritorioPodeIr(movimento.x, movimento.y, ax, ay)) movimento.rota.push({ x: ax, y: ay });
    else if (escritorioPodeIr(movimento.x, movimento.y, cx, cy)) movimento.rota.push({ x: cx, y: cy });
  }
  // Soltou a tecla no meio do ladrilho: termina o passo até o centro dele
  // (como no Habbo), em vez de pular para lá.
  if (!teclado && !movimento.rota.length && (movimento.x % 1 || movimento.y % 1)) {
    const cx = Math.round(movimento.x), cy = Math.round(movimento.y);
    if (escritorioPodeIr(movimento.x, movimento.y, cx, cy)) movimento.rota.push({ x: cx, y: cy });
  }
  const andando = teclado || movimento.rota.length > 0;
  if (!andando) movimento.turbo = false;
  // Ao andar, acenar e deitar acabam (o café continua na mão).
  if (andando && (escritorio.pose === "acenar" || escritorio.pose === "deitar")) definirPoseEscritorio("");
  escritorioSomDePasso(andando);
  if (vx || vy) movimento.dir = mapaDirecaoDoPasso(vx, vy);
  // Parou: encaixa no centro do ladrilho (como no Habbo).
  if (!andando) { movimento.x = Math.round(movimento.x); movimento.y = Math.round(movimento.y); }
  const assento = andando ? undefined : escritorio.mapa?.assentoEm(movimento.x, movimento.y);
  escritorio.emMovimento = andando;
  escritorio.mapa?.mover(escritorio.base.eu, movimento.x, movimento.y, assento ?? movimento.dir, andando ? "wlk" : escritorioAcaoDaPose(escritorio.pose, assento !== undefined));
  escritorio.mapa?.seguir(movimento.x, movimento.y);
  escritorioMudouLugar(movimento.x, movimento.y);
  escritorioEnviarPosicao(!andando);
  atualizarAcaoProximaEscritorio();
  desenharMinimapaEscritorio();
  // Com tecla presa (ainda no tempo de só virar), o ciclo continua esperando.
  if (andando || escritorioTeclas.size) movimento.quadro = requestAnimationFrame(escritorioQuadro);
  else atualizarPessoasEscritorio();
}
function escritorioAnimarMovimento() {
  if (movimento.quadro) return;
  const pos = escritorioPosicao(escritorio.perfil || {});
  if (!movimento.andando) { movimento.x = pos.x; movimento.y = pos.y; }
  movimento.ultimo = 0;
  movimento.quadro = requestAnimationFrame(escritorioQuadro);
}
function escritorioIrPara(x, y) {
  const de = { x: Math.round(movimento.quadro ? movimento.x : escritorioPosicao(escritorio.perfil || {}).x), y: Math.round(movimento.quadro ? movimento.y : escritorioPosicao(escritorio.perfil || {}).y) };
  const destino = escritorioZonaEm(Math.floor(x), Math.floor(y));
  if (escritorioZonaBloqueada(destino)) { avisarTrancadaEscritorio(destino, true); return; }
  const passos = escritorio.mapa?.caminho(de, { x, y });
  if (passos === null || passos === undefined) {
    // Sem mapa pronto (ou destino sem caminho): não teleporta.
    if (escritorio.mapa) escritorioAviso("Não dá para chegar aí: há parede ou móvel no caminho.");
    return;
  }
  if (!movimento.quadro) { const p = escritorioPosicao(escritorio.perfil || {}); movimento.x = p.x; movimento.y = p.y; }
  movimento.rota = passos;
  escritorio.mapa?.seguir(movimento.x, movimento.y, true);
  escritorioAnimarMovimento();
}
// Cartão da própria mesa: o dono passa o mouse na mesa (ou no computador) e
// vê a sala, o status e os avisos, com atalhos para o painel e para editar a
// mesa ou o computador no editor da sala.
function passarNoMapaEscritorio(x, y, cx, cy) {
  if (escritorio.edicao) { previaEditorEscritorio(x, y); return; }
  passarNoQuadroEscritorio(x, y);
  const mesa = escritorioMinhaMesa();
  const em = mesa && !escritorio.edicao && x >= mesa.x && x < mesa.x + mesa.w && y >= mesa.y && y < mesa.y + mesa.h;
  const card = document.getElementById("office-mesa-card");
  clearTimeout(escritorio.timerMesaCard);
  if (!em) {
    if (card && !card.matches(":hover")) escritorio.timerMesaCard = setTimeout(() => { if (!card.matches(":hover")) card.hidden = true; }, 350);
    return;
  }
  if (!card) return;
  const caixa = card.parentElement.getBoundingClientRect();
  const st = ESCRITORIO_STATUS[escritorio.status] || ESCRITORIO_STATUS.disponivel;
  const avisos = escritorio.avisos || 0;
  const fila = escritorioDemandasProntas() ? DADOS_DEMANDAS.length : -1;
  if (card.hidden || card.dataset.chave !== `${escritorio.status}|${avisos}|${fila}`) {
    card.dataset.chave = `${escritorio.status}|${avisos}|${fila}`;
    card.innerHTML = `<b>Sua mesa</b><small>${safeText(mesa.ambiente.nome)} · <span style="color:${st[1]}">${safeText(st[0])}</span></small><small>${avisos ? `${avisos} ${avisos === 1 ? "aviso" : "avisos"} no Painel · <button type="button" class="office-text-button" onclick="marcarNotificacoesLidas().then(()=>{document.getElementById('office-mesa-card').hidden=true})">marcar como lidos</button>` : "Nenhum aviso novo"}</small>${escritorioMinhaFilaHtml()}<div><button type="button" class="ofc-mini" onclick="abrirPainelDoEscritorio()">Abrir painel</button>${escritorioPodeEditar(mesa.ambiente.id) ? `<button type="button" class="ofc-mini" onclick="editarMovelDaMesaEscritorio('mesa')">Editar mesa</button><button type="button" class="ofc-mini" onclick="editarMovelDaMesaEscritorio('computador')">Editar computador</button>` : ""}</div>`;
  }
  // Preso à mesa (não acompanha o mouse): aparece acima dela e fica parado.
  if (!card.hidden) return;
  card.hidden = false;
  const w = card.offsetWidth, h = card.offsetHeight;
  const topo = escritorio.mapa.tela(mesa.x + mesa.w / 2, mesa.y + mesa.h / 2);
  const palco = document.querySelector(".mapa-palco")?.getBoundingClientRect();
  const escala = palco ? palco.width / document.querySelector(".mapa-palco").offsetWidth : 1;
  const ax = palco ? palco.left + topo.x * escala - caixa.left : cx - caixa.left;
  const ay = palco ? palco.top + topo.y * escala - caixa.top - 70 * escala : cy - caixa.top;
  card.style.left = Math.max(8, Math.min(caixa.width - w - 8, ax - w / 2)) + "px";
  card.style.top = Math.max(8, Math.min(caixa.height - h - 8, ay - h)) + "px";
}
// Dados de trabalho no mapa (mesa, quadro da reunião, telão do auditório): as
// mesmas demandas do painel (DADOS_DEMANDAS), carregadas uma vez sob demanda.
function escritorioDemandasProntas() {
  if (typeof DADOS_DEMANDAS === "undefined") return false;
  if (!DADOS_DEMANDAS.length && typeof ensureDemandasForOperationalViews === "function" && !escritorio.pediuDemandas) {
    escritorio.pediuDemandas = true;
    Promise.resolve(ensureDemandasForOperationalViews()).finally(() => { escritorio.pediuDemandas = false; });
  }
  return DADOS_DEMANDAS.length > 0;
}
const escritorioAberta = (d) => typeof DEMANDA_CONCLUIDA === "undefined" || !DEMANDA_CONCLUIDA.includes(d.status);
function escritorioDataCurta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}` : "sem prazo";
}
function escritorioMinhaFilaHtml() {
  if (!escritorioDemandasProntas()) return '<small class="ofc-fila-nota">Carregando sua fila…</small>';
  const minhas = DADOS_DEMANDAS.filter((d) => typeof pertenceVisaoDemanda === "function" && pertenceVisaoDemanda(d, "minha"))
    .sort((a, b) => String(a.prazo_iso || "9999").localeCompare(String(b.prazo_iso || "9999"))).slice(0, 3);
  if (!minhas.length) return '<small class="ofc-fila-nota">Nenhuma demanda na sua fila.</small>';
  const hoje = typeof META !== "undefined" ? META.today_iso : "";
  return `<ul class="ofc-fila">${minhas.map((d) => `<li><button type="button" onclick="escritorioAbrirDemanda('${safeText(String(d.id))}')"><span>${safeText(d.nome || "Demanda")}</span><small class="${d.prazo_iso && hoje && d.prazo_iso < hoje ? "atrasada" : d.prazo_iso === hoje ? "hoje" : ""}">${d.prazo_iso && hoje && d.prazo_iso < hoje ? "Atrasada · " : d.prazo_iso === hoje ? "Hoje · " : ""}${escritorioDataCurta(d.prazo_iso)}</small></button></li>`).join("")}</ul>`;
}
function escritorioAbrirDemanda(id) {
  document.getElementById("office-mesa-card")?.setAttribute("hidden", "");
  if (typeof openSearchItem === "function") openSearchItem(id);
}
// Quadro branco da sala de reunião: números do dia. Telão do auditório: fila
// da Criação (Reriston, Bia, Deivid, Jady).
const ESCRITORIO_QUADROS = [
  { re: /whiteboard/, titulo: "Quadro da equipe · hoje", html: () => {
    const abertas = DADOS_DEMANDAS.filter(escritorioAberta), hoje = typeof META !== "undefined" ? META.today_iso : "";
    const n = (f) => abertas.filter(f).length;
    return `<dl class="ofc-numeros"><div><dt>Vencem hoje</dt><dd>${n((d) => d.prazo_iso === hoje)}</dd></div><div><dt>Atrasadas</dt><dd class="alerta">${n((d) => typeof demandaAtrasada === "function" && demandaAtrasada(d))}</dd></div><div><dt>Em aprovação</dt><dd>${n((d) => /aprova/i.test(String(d.status || "")))}</dd></div></dl>`;
  } },
  { re: /largescreen/, titulo: "Fila da Criação", html: () => {
    const abertas = DADOS_DEMANDAS.filter(escritorioAberta);
    const linhas = ["Reriston", "Bia", "Deivid", "Jady"].map((nome) => {
      const id = typeof pessoaPeloNome === "function" ? String(pessoaPeloNome(nome)?.id || "") : "";
      const qtd = id ? abertas.filter((d) => (d.responsavel_ids?.length ? d.responsavel_ids : [d.responsavel_id]).map(String).includes(id)).length : 0;
      return `<div><dt>${nome}</dt><dd>${id ? qtd : "–"}</dd></div>`;
    });
    return `<dl class="ofc-numeros">${linhas.join("")}</dl>`;
  } },
];
function passarNoQuadroEscritorio(x, y) {
  const card = document.getElementById("office-info-card");
  if (!card || !escritorio.mapa || x < 0) { if (card && !card.matches(":hover")) card.hidden = true; return; }
  const m = escritorio.mapa.moveisPerto(x, y, 0).find((i) => ESCRITORIO_QUADROS.some((q) => q.re.test(i.classe)));
  if (!m) { if (!card.matches(":hover")) card.hidden = true; return; }
  const q = ESCRITORIO_QUADROS.find((q) => q.re.test(m.classe));
  const chave = m.classe + "|" + (escritorioDemandasProntas() ? DADOS_DEMANDAS.length : -1);
  if (card.dataset.chave !== chave) {
    card.dataset.chave = chave;
    card.innerHTML = `<b>${q.titulo}</b>${escritorioDemandasProntas() ? q.html() : '<small class="ofc-fila-nota">Carregando demandas…</small>'}<small class="ofc-fila-nota">Números das demandas do painel.</small>`;
  }
  if (!card.hidden && card.dataset.alvo === m.classe) return;
  card.dataset.alvo = m.classe;
  card.hidden = false;
  const caixa = card.parentElement.getBoundingClientRect(), palco = document.querySelector(".mapa-palco");
  const pr = palco.getBoundingClientRect(), escala = pr.width / palco.offsetWidth;
  const t = escritorio.mapa.tela(Math.floor(m.x) + 0.5, Math.floor(m.y) + 0.5);
  const ax = pr.left + t.x * escala - caixa.left, ay = pr.top + t.y * escala - caixa.top - 90 * escala;
  card.style.left = Math.max(8, Math.min(caixa.width - card.offsetWidth - 8, ax - card.offsetWidth / 2)) + "px";
  card.style.top = Math.max(8, Math.min(caixa.height - card.offsetHeight - 8, ay - card.offsetHeight)) + "px";
}
// Abre o editor da própria sala já com a mesa (ou o computador) selecionado.
function editarMovelDaMesaEscritorio(qual) {
  const mesa = escritorioMinhaMesa();
  if (!mesa) return;
  document.getElementById("office-mesa-card")?.setAttribute("hidden", "");
  abrirEditorEscritorio(mesa.ambiente.id);
  const e = escritorio.edicao;
  if (!e) return;
  const c = escritorioCantoCamada(e.camada);
  const re = qual === "computador" ? /computer|flatscreen|laptop|monitor/ : /table|desk/;
  const dentro = (it) => it[1] + c.x >= mesa.x - 1 && it[1] + c.x <= mesa.x + mesa.w && it[2] + c.y >= mesa.y - 1 && it[2] + c.y <= mesa.y + mesa.h;
  const i = e.itens.findIndex((it) => re.test(it[0]) && dentro(it));
  if (i < 0) { escritorioAviso(qual === "computador" ? "Não achei um computador na sua mesa. Escolha um no catálogo." : "Não achei a mesa. Escolha uma no catálogo."); return; }
  e.sel = i;
  e.trocar = i;
  escritorio.catalogoCategoria = qual === "computador" ? "Computadores" : "Mesas";
  escritorio.aba = "catalogo";
  escritorio.lateral = true;
  renderEscritorio();
  escritorio.mapa?.destacar({ camada: e.camada, i });
  renderBarraEditorEscritorio();
  escritorioAviso(`Escolha no catálogo, à esquerda, ${qual === "computador" ? "o novo computador" : "a nova mesa"}. Ela troca no mesmo lugar.`);
}
// Atalhos de câmera: o mapa é grande; "Escritório" mostra as salas e "Lazer"
// a cozinha, academia, jogos, lounge e piscina. Só a câmera vai (o boneco fica).
const ESCRITORIO_AREAS = [["salas", "Salas"], ["reunioes", "Reuniões"], ["lazer", "Lazer"], ["externa", "Área externa"], ["eu", "Onde estou"]];
function olharAreaEscritorio(id) {
  const alvo = { salas: [32, 24, 0.75], reunioes: [15, 5, 0.9], lazer: [56, 18, 0.7], externa: [40, 52, 0.85] }[id];
  if (id === "eu" || !alvo) { centralizarEmMimEscritorio(); return; }
  escritorio.mapa?.olhar(alvo[0], alvo[1], alvo[2]);
}
// Ladrilho livre colado num retângulo (mesa), o mais perto de quem anda.
function escritorioLadoLivre(r) {
  const de = { x: Math.round(movimento.quadro ? movimento.x : escritorioPosicao(escritorio.perfil || {}).x), y: Math.round(movimento.quadro ? movimento.y : escritorioPosicao(escritorio.perfil || {}).y) };
  const candidatos = [];
  for (let x = r.x - 1; x <= r.x + r.w; x++) for (let y = r.y - 1; y <= r.y + r.h; y++) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) continue;
    if (escritorioOcupado(x, y)) continue;
    const passos = escritorio.mapa?.caminho(de, { x, y });
    if (passos) candidatos.push({ x, y, n: passos.length });
  }
  return candidatos.sort((a, b) => a.n - b.n)[0] || null;
}
function cliqueNoMapaEscritorio(x, y) {
  if (escritorio.edicao) { cliqueEditorEscritorio(x, y); return; }
  escritorio.seguindoId = null;
  if (!escritorio.conectado && !escritorio.base?.demo) {
    escritorioAviso("Entre no escritório para andar pelo mapa.");
    return;
  }
  // Clicar na própria mesa leva até ela; o painel abre com o E (ou o botão).
  const mesa = escritorioMinhaMesa();
  if (mesa && x >= mesa.x && x < mesa.x + mesa.w && y >= mesa.y && y < mesa.y + mesa.h) {
    const lado = escritorioLadoLivre(mesa);
    if (lado) { escritorioIrPara(lado.x, lado.y); return; }
  }
  escritorioIrPara(x, y);
}
// Trancar/destrancar a zona onde a pessoa está; bater na porta; deixar entrar.
function escritorioPodeTrancar() {
  const z = escritorio.zona;
  if (!z || !escritorio.conectado) return false;
  return !z.startsWith("sala-") || escritorioMinhaMesa()?.ambiente.id === z || Boolean(escritorio.base?.admin);
}
function trancarZonaEscritorio() {
  const trancada = !escritorio.trancas?.has(escritorio.zona);
  escritorioEmitir("zone:lock", { zona: escritorio.zona, trancada });
  escritorioAviso(trancada ? "Sala trancada: quem chegar precisa bater na porta." : "Sala destrancada.");
}
let escritorioUltimoAvisoTranca = 0;
function avisarTrancadaEscritorio(zona, pedido) {
  if (!pedido && Date.now() - escritorioUltimoAvisoTranca < 2500) return;
  escritorioUltimoAvisoTranca = Date.now();
  const nome = ESCRITORIO_PLANTA.ambientes.find((a) => a.id === zona)?.nome || "Esta sala";
  const el = document.getElementById("office-feedback");
  if (!el) return;
  el.innerHTML = `${safeText(nome)} está trancada. <button type="button" class="ofc-mini" onclick="baterPortaEscritorio('${safeText(zona)}')">Bater na porta</button>`;
}
function baterPortaEscritorio(zona) {
  escritorioEmitir("zone:knock", { zona });
  escritorioAviso("Você bateu na porta. Aguarde alguém deixar entrar.");
}
function avisoBatidaEscritorio({ id, nome, zona }) {
  escritorioTocar(180, 0.12, 0.2); setTimeout(() => escritorioTocar(170, 0.12, 0.2), 180);
  const el = document.getElementById("office-feedback");
  if (!el) return;
  el.innerHTML = `<b>${safeText(nome)}</b> bateu na porta. <button type="button" class="ofc-mini" onclick="escritorioEmitir('zone:admit',{zona:'${safeText(zona)}',id:'${safeText(id)}'});escritorioAviso('Pode entrar.')">Deixar entrar</button> <button type="button" class="ofc-mini" onclick="escritorioAviso('')">Agora não</button>`;
}
const ESCRITORIO_REACOES = { aplauso: "👏", coracao: "❤️", risada: "😂", joinha: "👍", fogo: "🔥", festa: "🎉" };
function reagirEscritorio(tipo) {
  escritorioEmitir("reaction", { tipo });
  document.getElementById("office-reacoes")?.removeAttribute("open");
}

// Poses (acenar, deitar, café na mão): vão para a equipe pelo Worker.
// O que vai na mão em cada pose (itens de mão do Habbo).
const ESCRITORIO_MAO = { cafe: "crr=6", bebida: "crr=1", lanche: "crr=5" };
// Aparelhos da academia: o boneco sobe nele e fica até andar.
const ESCRITORIO_APARELHOS = { exercicio: "esteira", bicicleta: "bicicleta" };
function escritorioAcaoDaPose(pose, sentado) {
  if (pose === "deitar") return "lay";
  if (pose === "acenar") return "wav";
  if (pose === "exercicio") return "wlk";
  if (pose === "bicicleta") return "sit";
  return sentado ? "sit" : "std";
}
function definirPoseEscritorio(pose) {
  if (escritorio.pose === pose) return;
  // Saiu da esteira/bicicleta: volta para o ladrilho de onde subiu.
  if (ESCRITORIO_APARELHOS[escritorio.pose] && !ESCRITORIO_APARELHOS[pose] && escritorio.voltaAparelho) {
    movimento.x = escritorio.voltaAparelho.x; movimento.y = escritorio.voltaAparelho.y;
    escritorio.voltaAparelho = null;
    escritorioEnviarPosicao(true);
  }
  escritorio.pose = pose;
  escritorioEmitir("pose", { tipo: pose });
  clearTimeout(escritorio.timerPose);
  // Acenar dura uns segundos; o café acaba depois de um tempo.
  if (pose === "acenar") escritorio.timerPose = setTimeout(() => definirPoseEscritorio(""), 4000);
  if (ESCRITORIO_MAO[pose]) escritorio.timerPose = setTimeout(() => definirPoseEscritorio(""), 120000);
  const p = escritorioPosicao(escritorio.perfil || {});
  escritorio.mapa?.mover(escritorio.base.eu, Math.round(p.x), Math.round(p.y), movimento.dir, escritorioAcaoDaPose(pose, escritorio.mapa?.assentoEm(p.x, p.y) !== undefined));
  atualizarPessoasEscritorio();
  atualizarAcaoProximaEscritorio();
}
const ESCRITORIO_DEITAVEIS = /sofa|lounger|bench|_5$/;
function deitarEscritorio() {
  const p = escritorioPosicao(escritorio.perfil || {});
  const embaixo = escritorio.mapa?.moveisPerto(Math.round(p.x), Math.round(p.y), 0).find((m) => ESCRITORIO_DEITAVEIS.test(m.classe));
  if (!embaixo && escritorio.pose !== "deitar") { escritorioAviso("Para deitar, sente num sofá ou numa espreguiçadeira e aperte 2."); return; }
  definirPoseEscritorio(escritorio.pose === "deitar" ? "" : "deitar");
}
function escritorioOcupado(x, y) {
  const eu = String(escritorio.base?.eu);
  return (escritorio.online || []).some((o) => {
    if (String(o.id) === eu) return false;
    const pos = escritorioPosicao(o);
    return Math.round(pos.x) === x && Math.round(pos.y) === y;
  });
}

function escritorioDestravar() {
  if (!escritorio.mapa) return;
  const p = escritorioPosicao(escritorio.perfil || {}), de = { x: Math.round(p.x), y: Math.round(p.y) };
  const saida = { x: 36, y: 10 };
  if (escritorio.mapa.caminho(de, saida)) return;
  for (let r = 1; r < 12; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const t = { x: de.x + dx, y: de.y + dy };
    if (escritorio.mapa.assentoEm(t.x, t.y) === undefined && escritorio.mapa.caminho(t, saida)) {
      const pc = escritorioParaPorcentagem(t.x, t.y);
      escritorio.perfil = { ...escritorio.perfil, x: pc.x, y: pc.y };
      movimento.x = t.x; movimento.y = t.y;
      escritorio.mapa.mover(escritorio.base.eu, t.x, t.y, 2, "std");
      escritorioEnviarPosicao(true);
      return;
    }
  }
}

// Interação ao chegar perto: um botão (e a tecla E) com o que dá para fazer.
// TV, projetor e telão: dá para mostrar a tela ali ("aftv" do pebolim não conta).
const ESCRITORIO_TELAS = /projector|largescreen|(^|_)tv($|_)|television/;
const ESCRITORIO_CAFE = /coffeemachine|coffee/;
// Móveis que ligam e desligam (todos veem), o que se pega e onde se joga.
const ESCRITORIO_LIGAVEIS = [
  [/jukebox/, "a jukebox"], [/^hc25_6$/, "o som do DJ"], [/pinball/, "o pinball"],
  [/arcade|retrogames/, "o fliperama"], [/fireplace/, "a lareira"],
  [/floorlight|cine_light|lamp/, "a luz"],
];
const ESCRITORIO_BEBIDA = /fridge|water_dispenser|minibar/;
const ESCRITORIO_LANCHE = /stove|microwave|school_c22_cafe/;
const ESCRITORIO_JOGOS = [[/pooltable/, "sinuca"], [/footballtable/, "pebolim"]];
function alternarMovelEscritorio(item) {
  const chave = escritorio.mapa.chaveMovel(item);
  const estado = item.estado ? 0 : (item.ligadoPadrao || 1);
  escritorio.mapa.estadosMoveis([[chave, estado]]);
  escritorioEmitir("furni:toggle", { chave, estado });
  escritorioTocar(estado ? 660 : 330, 0.08, 0.05);
  atualizarAcaoProximaEscritorio(true);
}
// Para onde olha quem está no aparelho: a esteira tem o painel na ponta −x;
// a bicicleta tem o banco na ponta −y e a cesta/guidão em +y. Vale para todos.
function escritorioNoAparelho(x, y) {
  const m = escritorio.mapa?.moveisPerto(x, y, 0).find((i) => /treadmill|bicycle/.test(i.classe));
  if (!m) return null;
  return { item: m, x: Math.floor(m.x), y: Math.floor(m.y), dir: /bicycle/.test(m.classe) ? 4 : 6 };
}
// Sobe na esteira/bicicleta: fica no ladrilho do aparelho, virado para o painel.
function usarAparelhoEscritorio(item, pose) {
  const lugar = escritorioNoAparelho(Math.floor(item.x), Math.floor(item.y));
  const x = lugar.x, y = lugar.y;
  if (escritorioOcupado(x, y)) { escritorioAviso("Alguém já está usando."); return; }
  escritorio.voltaAparelho = { x: Math.round(movimento.x), y: Math.round(movimento.y) };
  movimento.x = x; movimento.y = y; movimento.dir = lugar.dir;
  escritorioEnviarPosicao(true);
  definirPoseEscritorio(pose);
}
function escritorioAcoesPerto() {
  if (!escritorio.mapa || escritorio.edicao || (escritorio.modo || "mapa") !== "mapa") return null;
  if (ESCRITORIO_APARELHOS[escritorio.pose])
    return { texto: escritorio.pose === "bicicleta" ? "Descer da bicicleta" : "Sair da esteira", fazer: () => definirPoseEscritorio("") };
  const p = { x: Math.round(movimento.quadro ? movimento.x : escritorioPosicao(escritorio.perfil || {}).x), y: Math.round(movimento.quadro ? movimento.y : escritorioPosicao(escritorio.perfil || {}).y) };
  const eu = String(escritorio.base.eu);
  // Pessoa ao lado
  // Perto de verdade: até 2 ladrilhos E com caminho curto (nada de conversar
  // com quem está do outro lado da parede).
  const vizinho = (escritorio.online || []).find((o) => {
    if (String(o.id) === eu) return false;
    const q = escritorioPosicao(o), qx = Math.round(q.x), qy = Math.round(q.y);
    if (Math.max(Math.abs(qx - p.x), Math.abs(qy - p.y)) > 2) return false;
    const passos = escritorio.mapa.caminho(p, { x: qx, y: qy });
    return Boolean(passos && passos.length <= 3);
  });
  if (vizinho) return { texto: "Conversar com " + String(vizinho.nome).split(" ")[0], fazer: () => convidarConversaEscritorio(vizinho.id) };
  // Sala trancada ao lado
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const z = escritorioZonaEm(p.x + dx, p.y + dy);
    if (escritorioZonaBloqueada(z)) return { texto: "Bater na porta", fazer: () => baterPortaEscritorio(z) };
  }
  const perto = escritorio.mapa.moveisPerto(p.x, p.y, 1);
  const mesa = escritorioMinhaMesa();
  if (mesa) {
    const naMesa = perto.find((m) => m.classe === "exe_table" && Math.floor(m.x) === mesa.x && Math.floor(m.y) === mesa.y);
    if (naMesa) return { item: naMesa, texto: escritorio.avisos ? `Abrir painel · ${escritorio.avisos} ${escritorio.avisos === 1 ? "aviso" : "avisos"}` : "Abrir painel", fazer: () => abrirPainelDoEscritorio() };
  }
  const cafe = perto.find((m) => ESCRITORIO_CAFE.test(m.classe));
  if (cafe) return { item: cafe, texto: escritorio.pose === "cafe" ? "Largar o café" : "Pegar um café", fazer: () => definirPoseEscritorio(escritorio.pose === "cafe" ? "" : "cafe") };
  const comida = perto.find((m) => ESCRITORIO_BEBIDA.test(m.classe) || ESCRITORIO_LANCHE.test(m.classe));
  if (comida) {
    const tipo = ESCRITORIO_BEBIDA.test(comida.classe) ? "bebida" : "lanche";
    return { item: comida, texto: escritorio.pose === tipo ? (tipo === "bebida" ? "Largar a bebida" : "Largar o lanche") : (tipo === "bebida" ? "Pegar uma bebida" : "Pegar um lanche"),
      fazer: () => definirPoseEscritorio(escritorio.pose === tipo ? "" : tipo) };
  }
  const aparelho = perto.find((m) => /treadmill|bicycle/.test(m.classe));
  if (aparelho) {
    const pose = /bicycle/.test(aparelho.classe) ? "bicicleta" : "exercicio";
    return { item: aparelho, texto: pose === "bicicleta" ? "Pedalar" : "Correr na esteira", fazer: () => usarAparelhoEscritorio(aparelho, pose) };
  }
  const tela = escritorio.mapa.moveisPerto(p.x, p.y, 2).find((m) => ESCRITORIO_TELAS.test(m.classe));
  if (tela && escritorio.zona && escritorio.zona !== "foco")
    return { item: tela, texto: "Mostrar minha tela aqui", fazer: mostrarTelaEscritorio };
  for (const m of perto) {
    const nome = ESCRITORIO_LIGAVEIS.find(([re]) => re.test(m.classe))?.[1];
    if (nome) return { item: m, texto: (m.estado ? "Desligar " : "Ligar ") + nome, fazer: () => alternarMovelEscritorio(m) };
  }
  const jogo = perto.map((m) => [m, ESCRITORIO_JOGOS.find(([re]) => re.test(m.classe))?.[1]]).find(([, n]) => n);
  if (jogo) {
    const texto = jogo[1] === "sinuca" ? "Bora uma partida de sinuca?" : "Bora um pebolim?";
    return { item: jogo[0], texto: "Chamar para " + (jogo[1] === "sinuca" ? "a sinuca" : "o pebolim"),
      fazer: () => { escritorioEmitir("chat:bubble", { texto }); escritorio.mapa.balao(escritorio.base.eu, texto); } };
  }
  const assento = perto.find((m) => escritorio.mapa.assentoEm(Math.floor(m.x), Math.floor(m.y)) !== undefined && !(Math.floor(m.x) === p.x && Math.floor(m.y) === p.y));
  if (assento && escritorio.mapa.assentoEm(p.x, p.y) === undefined)
    return { item: assento, texto: "Sentar", fazer: () => escritorioIrPara(Math.floor(assento.x), Math.floor(assento.y)) };
  return null;
}
function atualizarAcaoProximaEscritorio(forcar) {
  const a = escritorioAcoesPerto();
  escritorio.acaoProxima = a;
  escritorio.mapa?.realcar(a?.item || null);
  const el = document.getElementById("office-acao");
  if (!el) return;
  const chave = a ? a.texto : "";
  if (el.dataset.chave === chave && !forcar) return;
  el.dataset.chave = chave;
  el.hidden = !a;
  if (a) el.innerHTML = `<button type="button" onclick="escritorio.acaoProxima?.fazer()"><kbd>E</kbd>${safeText(a.texto)}</button>`;
}
async function mostrarTelaEscritorio() {
  if (!escritorio.chamada) await entrarChamadaEscritorio();
  if (escritorio.chamada && !escritorio.chamada.self.screenShareEnabled) alternarMidiaEscritorio("screen");
}

// Seguir alguém: anda até o lado da pessoa e continua acompanhando.
function seguirPessoaEscritorio(id) {
  escritorio.seguindoId = id;
  clearInterval(escritorio.timerSeguir);
  const passo = () => {
    if (escritorio.seguindoId !== id) return clearInterval(escritorio.timerSeguir);
    const o = escritorio.online.find((p) => p.id === id);
    if (!o) { escritorio.seguindoId = null; escritorioAviso("A pessoa saiu do escritório."); return clearInterval(escritorio.timerSeguir); }
    const alvo = escritorioPosicao(o), eu = { x: Math.round(movimento.x), y: Math.round(movimento.y) };
    if (Math.max(Math.abs(Math.round(alvo.x) - eu.x), Math.abs(Math.round(alvo.y) - eu.y)) <= 1) return;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const x = Math.round(alvo.x) + dx, y = Math.round(alvo.y) + dy;
      if (escritorio.mapa?.assentoEm(x, y) !== undefined || escritorioOcupado(x, y)) continue;
      if (escritorio.mapa?.caminho(eu, { x, y })) { movimento.rota = escritorio.mapa.caminho(eu, { x, y }); escritorioAnimarMovimento(); return; }
    }
  };
  passo();
  escritorio.timerSeguir = setInterval(passo, 900);
  escritorioAviso("Seguindo " + (escritorio.online.find((p) => p.id === id)?.nome || "") + ". Aperte uma tecla para parar.");
}

// Avisos discretos de quem entra e sai.
function avisarEntradasEscritorio(antes, depois) {
  if (!antes?.length) return; // primeira lista: só quem já estava
  const eu = String(escritorio.base?.eu);
  const idsAntes = new Set(antes.map((p) => p.id)), idsDepois = new Set(depois.map((p) => p.id));
  for (const p of depois) if (!idsAntes.has(p.id) && String(p.id) !== eu) avisoRapidoEscritorio(p.nome + " entrou no escritório");
  for (const p of antes) if (!idsDepois.has(p.id) && String(p.id) !== eu) avisoRapidoEscritorio(p.nome + " saiu");
}
function avisoRapidoEscritorio(texto) {
  const el = document.getElementById("office-avisos");
  if (!el) return;
  const a = document.createElement("p");
  a.textContent = texto;
  el.append(a);
  setTimeout(() => a.remove(), 4500);
}

// Minimapa: a planta vista de cima, com um ponto por pessoa; clique para ir.
function desenharMinimapaEscritorio() {
  const c = document.getElementById("office-minimapa");
  if (!c || c.offsetParent === null) return;
  const agora = performance.now();
  if (agora - (escritorio.minimapaEm || 0) < 120) return;
  escritorio.minimapaEm = agora;
  const P = ESCRITORIO_PLANTA, k = c.width / P.W;
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "#24252c"; g.fillRect(P.PREDIO.x0 * k, P.PREDIO.y0 * k, (P.PREDIO.x1 - P.PREDIO.x0) * k, (P.PREDIO.y1 - P.PREDIO.y0) * k);
  for (const a of P.ambientes) {
    g.fillStyle = (ESCRITORIO_COR_SALA[a.sala] || "#888") + (a.id === escritorio.zona ? "aa" : "40");
    g.fillRect(a.x0 * k + 1, a.y0 * k + 1, (a.x1 - a.x0) * k - 2, (a.y1 - a.y0) * k - 2);
  }
  const pi = P.piscina; g.fillStyle = "#2e8fd4aa"; g.fillRect(pi.x0 * k, pi.y0 * k, (pi.x1 - pi.x0) * k, (pi.y1 - pi.y0) * k);
  const eu = String(escritorio.base?.eu);
  for (const o of escritorio.online || []) {
    if (String(o.id) === eu) continue;
    const q = escritorioPosicao(o);
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(q.x * k, q.y * k, 3, 0, 7); g.fill();
  }
  const m = movimento.quadro ? movimento : escritorioPosicao(escritorio.perfil || {});
  g.fillStyle = "#ff8a35"; g.strokeStyle = "#1a1a1f"; g.lineWidth = 2;
  g.beginPath(); g.arc(m.x * k, m.y * k, 4.5, 0, 7); g.fill(); g.stroke();
}
function cliqueMinimapaEscritorio(e) {
  const c = e.currentTarget, r = c.getBoundingClientRect(), P = ESCRITORIO_PLANTA;
  const x = Math.floor(((e.clientX - r.left) / r.width) * P.W), y = Math.floor(((e.clientY - r.top) / r.height) * P.H);
  escritorioIrPara(x, y);
}

// Som de passos (baixinho), com botão para desligar.
let escritorioAudio = null, escritorioUltimoPasso = 0;
function escritorioSomLigado() {
  try { return localStorage.getItem("vybe-escritorio-som") !== "0"; } catch { return true; }
}
function alternarSomEscritorio() {
  try { localStorage.setItem("vybe-escritorio-som", escritorioSomLigado() ? "0" : "1"); } catch {}
  atualizarControlesEscritorio();
}
function escritorioTocar(freq, dur, vol) {
  if (!escritorioSomLigado()) return;
  try {
    escritorioAudio ||= new AudioContext();
    const a = escritorioAudio, o = a.createOscillator(), g = a.createGain();
    o.type = "triangle"; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  } catch {}
}
function escritorioSomDePasso(andando) {
  if (!andando) return;
  const agora = performance.now();
  if (agora - escritorioUltimoPasso < (escritorio.correndo ? 170 : 240)) return;
  escritorioUltimoPasso = agora;
  escritorioTocar(90 + Math.random() * 40, 0.06, 0.05);
}

// WASD e setas: enquanto a tecla está presa, o boneco anda (movimento
// contínuo acima); duas teclas somam a direção.
const ESCRITORIO_TECLAS = {
  ArrowUp: [-1, -1], w: [-1, -1], ArrowDown: [1, 1], s: [1, 1],
  ArrowLeft: [-1, 1], a: [-1, 1], ArrowRight: [1, -1], d: [1, -1],
};
const escritorioTeclas = new Set();
const escritorioTeclasDesde = new Map();
function escritorioPararTeclado() {
  escritorioTeclas.clear();
}
function escritorioTecla(e) {
  if (e.target.closest?.("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return false;
  const chave = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return ESCRITORIO_TECLAS[chave] ? chave : false;
}
function tecladoEscritorio(e) {
  const chave = escritorioTecla(e);
  if (!chave) return;
  e.preventDefault();
  if (!escritorio.conectado && !escritorio.base?.demo) return;
  movimento.rota = []; // tecla interrompe um caminho por clique
  escritorio.seguindoId = null;
  if (!escritorioTeclas.has(chave)) {
    escritorioTeclasDesde.set(chave, performance.now());
    // Vira na hora para o lado da tecla.
    movimento.dir = mapaDirecaoDoPasso(...ESCRITORIO_TECLAS[chave]);
  }
  escritorioTeclas.add(chave);
  escritorio.mapa?.seguir(movimento.x, movimento.y, true);
  escritorioAnimarMovimento();
}
function soltarTeclaEscritorio(e) {
  const chave = escritorioTecla(e);
  if (chave) escritorioTeclas.delete(chave);
}
function irParaMinhaMesaEscritorio() {
  const mesa = escritorioMinhaMesa();
  if (!mesa) return;
  if (escritorio.modo === "lista") { escritorio.modo = "mapa"; renderEscritorio(); }
  escritorioIrPara(mesa.cadeira.x, mesa.cadeira.y);
}
// O painel é o computador da mesa: abre por cima do escritório e a presença
// continua; "Voltar ao escritório" no dock traz o mapa de volta.
// Avisos do sino (prazo amanhã, veicula hoje sem estar pronta…) chegam ao
// escritório: contagem no botão Painel, o computador da mesa brilha e um balão
// sobre o próprio boneco quando chega um aviso novo. A lista e a leitura
// continuam no sino do painel (vybe-notificacoes.js).
function escritorioAvisos(lista) {
  const naoLidas = (lista || []).filter((n) => !n.lida_em);
  const antes = escritorio.avisosVistos;
  // Total real do servidor (a lista vem limitada a 100).
  escritorio.avisos = typeof notificacoesNaoLidas === "number" ? Math.max(notificacoesNaoLidas, naoLidas.length) : naoLidas.length;
  escritorio.avisosVistos = new Set(naoLidas.map((n) => String(n.id)));
  const mesa = escritorioMinhaMesa();
  escritorio.mapa?.marcarAviso(mesa?.x, mesa ? mesa.y + 1 : undefined, Boolean(mesa && naoLidas.length));
  if (typeof atualizarControlesEscritorio === "function") atualizarControlesEscritorio();
  atualizarAcaoProximaEscritorio(true);
  const eu = escritorio.base?.eu;
  if (!eu || !escritorio.mapa || !naoLidas.length) return;
  const novos = antes ? naoLidas.filter((n) => !antes.has(String(n.id))) : [];
  const texto = !antes
    ? `Você tem ${escritorio.avisos} ${escritorio.avisos === 1 ? "aviso" : "avisos"} no Painel.`
    : novos.length ? "Novo aviso: " + String(novos[0].texto || "").slice(0, 90) : "";
  if (texto) escritorio.mapa.balao(String(eu), texto);
}
// "Painel" abre a tela de módulos (Gestor, Minhas tarefas, Foco…), onde fica
// todo o trabalho; com um quadro, vai direto a ele.
function abrirPainelDoEscritorio(quadro) {
  const destino = quadro || (escritorio.boardAntes && escritorio.boardAntes !== "escritorio" ? escritorio.boardAntes : "producao");
  const btn = document.getElementById("btn-board-" + destino);
  if (btn) switchBoard(destino, btn);
  escritorio.portaoAntes = false;
  if (!quadro && typeof openModeGate === "function") openModeGate();
  atualizarDockEscritorio();
}
function voltarAoEscritorio() {
  if (typeof activeBoard !== "undefined" && activeBoard !== "escritorio") escritorio.boardAntes = activeBoard;
  closeTransientOverlaysForNavigation();
  if (typeof closeModeGate === "function") closeModeGate();
  switchBoard("escritorio", document.getElementById("btn-board-escritorio"));
}
// Preferência deste computador: quem produz pode preferir abrir no painel.
// Tela inicial: no computador, o painel abre no escritório quando ele está
// configurado. No celular, segue o painel.
async function iniciarNoEscritorio() {
  if (window.matchMedia?.("(max-width: 760px)").matches) return;
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
  escritorioChegar();
  escritorio.portaoAntes = Boolean(document.getElementById("mode-gate")?.classList.contains("open"));
  escritorio.boardAntes = antes;
  voltarAoEscritorio();
}
// "Meu espaço" abre o criador de personagem da abertura.
function personalizarEscritorio() {
  abrirAberturaEscritorio("personagem");
}
// Recados individuais: conversa de texto entre duas pessoas, guardada no Neon
// até ser lida. O Worker só avisa que chegou; o texto vem da API autenticada.
function escritorioRecadosNaoLidos() {
  return Object.values(escritorio.recadosResumo || {}).reduce((a, b) => a + b, 0);
}
function escritorioNomePessoa(id) {
  return escritorio.base?.equipe.find((p) => String(p.id) === String(id))?.nome || "Alguém";
}
function escritorioRecadosHtml() {
  const com = escritorio.recadoCom;
  if (escritorio.recadosIndisponivel)
    return `<p class="ofc-nota">${safeText(escritorio.recadosIndisponivel)}</p>`;
  if (!com) {
    const eu = String(escritorio.base?.eu);
    const resumo = escritorio.recadosResumo || {};
    const outros = (escritorio.base?.equipe || []).filter((p) => String(p.id) !== eu)
      .sort((a, b) => (resumo[b.id] || 0) - (resumo[a.id] || 0) || a.nome.localeCompare(b.nome));
    return `<div class="office-chat-head"><h3>Recados</h3></div><p class="ofc-nota">Mensagem só para uma pessoa. Fica guardada até ela ler, mesmo fora do escritório.</p><ul class="ofc-recados-lista">${outros.map((p) => `<li><button type="button" onclick="abrirRecadosEscritorio('${safeText(p.id)}')">${escritorioAvatar(p.perfil, p.nome)}<span>${safeText(p.nome)}</span>${resumo[p.id] ? `<span class="ofc-badge" aria-label="${resumo[p.id]} não lidos">${resumo[p.id]}</span>` : ""}</button></li>`).join("")}</ul>`;
  }
  const nome = escritorioNomePessoa(com);
  return `<div class="office-chat-head"><button type="button" class="office-text-button" onclick="escritorio.recadoCom=null;atualizarRecadosEscritorio()">‹ Recados</button><h3>${safeText(nome)}</h3></div><div id="office-recados-lista" role="log" aria-live="polite">Carregando recados…</div><form onsubmit="event.preventDefault();enviarRecadoEscritorioForm(this)"><input aria-label="Recado para ${safeText(nome)}" name="texto" oninput="delete this.form.dataset.chave" maxlength="2000" placeholder="Recado para ${safeText(nome.split(" ")[0])}" required autocomplete="off"><button class="workflow-primary">Enviar</button></form>`;
}
function atualizarRecadosEscritorio() {
  const el = document.getElementById("office-recados");
  if (el) el.innerHTML = escritorioRecadosHtml();
  if (escritorio.recadoCom) carregarConversaRecados();
}
async function carregarResumoRecados() {
  try {
    const d = await escritorioApi("recados-resumo");
    escritorio.recadosIndisponivel = "";
    escritorio.recadosResumo = Object.fromEntries(d.resumo.map((r) => [r.de, r.nao_lidos]));
  } catch (e) {
    escritorio.recadosIndisponivel = e.message;
  }
  if (escritorio.recadosResumo && escritorioRecadosNaoLidos() && !escritorio.avisouRecados) {
    escritorio.avisouRecados = true;
    escritorio.mapa?.balao(String(escritorio.base?.eu), `Você tem ${escritorioRecadosNaoLidos()} ${escritorioRecadosNaoLidos() === 1 ? "recado" : "recados"}. Abra a aba Recados.`);
  }
  if (!escritorio.recadoCom) atualizarRecadosEscritorio();
  atualizarPessoasEscritorio();
  const abas = document.querySelector(".ofc-abas [onclick*=\"'recados'\"]");
  if (abas) abas.innerHTML = "Recados" + (escritorioRecadosNaoLidos() ? ` <span class="ofc-badge">${escritorioRecadosNaoLidos()}</span>` : "");
}
function abrirRecadosEscritorio(id) {
  escritorio.recadoCom = id ? String(id) : null;
  escritorio.aba = "recados";
  escritorio.lateral = true;
  renderEscritorio();
  atualizarRecadosEscritorio();
}
async function carregarConversaRecados() {
  const com = escritorio.recadoCom, seq = (escritorio.recadosSeq = (escritorio.recadosSeq || 0) + 1);
  const el = document.getElementById("office-recados-lista");
  if (!el || !com) return;
  try {
    const r = await fetch("/api/painel?area=escritorio&acao=recados&com=" + encodeURIComponent(com), { credentials: "same-origin", cache: "no-store" });
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || "Falha ao ler recados.");
    if (seq !== escritorio.recadosSeq) return;
    const eu = String(escritorio.base?.eu);
    el.innerHTML = d.recados.length
      ? d.recados.map((m) => `<article class="${m.de === eu ? "meu" : ""}"><b>${m.de === eu ? "Você" : safeText(escritorioNomePessoa(m.de).split(" ")[0])}</b><p>${safeText(m.texto)}</p><small>${new Date(m.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${m.de === eu && m.lido_em ? " · lido" : ""}</small></article>`).join("")
      : `<p>Nenhum recado ainda. Escreva o primeiro: ${safeText(escritorioNomePessoa(com).split(" ")[0])} vê quando abrir o escritório.</p>`;
    el.scrollTop = el.scrollHeight;
    if (!escritorio.base?.demo && d.recados.some((m) => m.para === eu && !m.lido_em)) {
      await escritorioApi("recados-lidos", { com });
      carregarResumoRecados();
    }
  } catch (e) {
    if (seq === escritorio.recadosSeq) el.textContent = e.message;
  }
}
async function enviarRecadoEscritorioForm(form) {
  const input = form.elements.texto, btn = form.querySelector("button"), para = escritorio.recadoCom;
  if (btn.disabled || !para) return;
  btn.disabled = true;
  const chave = form.dataset.chave || crypto.randomUUID();
  form.dataset.chave = chave;
  try {
    await escritorioApi("recado", { para, texto: input.value, chave });
    input.value = "";
    delete form.dataset.chave;
    escritorioEmitir("recado:novo", { para });
    await carregarConversaRecados();
  } catch (e) {
    escritorioAviso(e.message);
  } finally {
    btn.disabled = false;
  }
}
// Recado chegou fora da conversa aberta: cartão no canto com o texto e
// resposta rápida ali mesmo.
async function recadoRapidoEscritorio(de, nome) {
  const caixa = document.querySelector(".ofc-principal");
  if (!caixa) return;
  let el = document.getElementById("office-recado-rapido");
  if (!el) { el = document.createElement("section"); el.id = "office-recado-rapido"; el.className = "ofc-recado-rapido"; el.setAttribute("role", "status"); caixa.append(el); }
  let ultimo = "";
  try {
    const r = await fetch("/api/painel?area=escritorio&acao=recados&com=" + encodeURIComponent(de), { credentials: "same-origin", cache: "no-store" });
    const d = await r.json();
    ultimo = d.recados?.filter((m) => m.de === String(de)).at(-1)?.texto || "";
  } catch {}
  const primeiro = String(nome || "Alguém").split(" ")[0];
  el.innerHTML = `<div class="ofc-recado-topo"><b>Recado de ${safeText(primeiro)}</b><button type="button" class="ofc-x" aria-label="Fechar" onclick="this.closest('section').remove()">×</button></div>${ultimo ? `<p>${safeText(ultimo)}</p>` : ""}<form onsubmit="event.preventDefault();responderRecadoRapido(this,'${safeText(String(de))}')"><input name="texto" maxlength="2000" required autocomplete="off" aria-label="Responder a ${safeText(primeiro)}" placeholder="Responder a ${safeText(primeiro)}"><button class="workflow-primary">Enviar</button></form><button type="button" class="office-text-button" onclick="this.closest('section').remove();abrirRecadosEscritorio('${safeText(String(de))}')">Abrir conversa</button>`;
  clearTimeout(escritorio.timerRecadoRapido);
  escritorio.timerRecadoRapido = setTimeout(() => { if (!el.matches(":focus-within, :hover")) el.remove(); }, 20000);
}
async function responderRecadoRapido(form, para) {
  const btn = form.querySelector("button");
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await escritorioApi("recado", { para, texto: form.elements.texto.value, chave: form.dataset.chave ||= crypto.randomUUID() });
    escritorioEmitir("recado:novo", { para });
    if (!escritorio.base?.demo) await escritorioApi("recados-lidos", { com: para }).catch(() => {});
    form.closest("section").innerHTML = '<p class="ofc-fila-nota">Resposta enviada.</p>';
    setTimeout(() => document.getElementById("office-recado-rapido")?.remove(), 2500);
    carregarResumoRecados();
  } catch (e) {
    escritorioAviso(e.message);
    btn.disabled = false;
  }
}
function recadoChegouEscritorio({ de, nome } = {}) {
  if (escritorio.aba === "recados" && escritorio.recadoCom === String(de) && escritorio.lateral !== false) carregarConversaRecados();
  else {
    recadoRapidoEscritorio(de, nome);
    escritorio.mapa?.balao(String(escritorio.base?.eu), `Recado de ${String(nome || "alguém").split(" ")[0]}. Abra a aba Recados.`);
    escritorioAviso(`Novo recado de ${nome || "alguém"}.`);
    escritorioTocar(880, 0.12, 0.05);
    carregarResumoRecados();
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
    escritorioEmitir("chat:bubble", { texto });
    await carregarChatEscritorio();
  } catch (e) {
    escritorioAviso(e.message);
  } finally {
    btn.disabled = false;
    input.disabled = false;
  }
}
// Ao parar numa sala (1,2 s, para não entrar e sair de chamadas só passando
// pelo corredor), entra na conversa dela com o microfone ligado. Foco e
// corredor não têm conversa por voz.
// Motor de chamadas (~650 KB) baixado uma vez, logo ao entrar no escritório,
// para a primeira conversa não esperar o download.
function escritorioMotorVoz() {
  if (window.RealtimeKitClient) return Promise.resolve();
  escritorio.motorVoz ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.1/dist/browser.js";
    s.onload = resolve;
    s.onerror = () => { escritorio.motorVoz = null; reject(new Error("Não foi possível carregar o motor de chamadas.")); };
    document.head.appendChild(s);
  });
  return escritorio.motorVoz;
}
// Pede o acesso à conversa da sala assim que a pessoa entra nela (em paralelo
// com a espera curta para não abrir chamada de quem só está passando).
function escritorioTokenDaZona(zona) {
  const t = escritorio.tokenPrevio;
  if (t && t.zona === zona && Date.now() - t.em < 60000) return t.promessa;
  const promessa = escritorioApi("chamada", { sala: zona });
  promessa.catch(() => { if (escritorio.tokenPrevio?.promessa === promessa) escritorio.tokenPrevio = null; });
  escritorio.tokenPrevio = { zona, em: Date.now(), promessa };
  return promessa;
}
function escritorioConversaAutomatica() {
  clearTimeout(escritorio.timerConversa);
  const zona = escritorio.zona;
  if (!zona || zona === "foco" || !escritorio.conectado || escritorio.base?.demo) return;
  escritorioMotorVoz().catch(() => {});
  escritorioTokenDaZona(zona);
  escritorio.timerConversa = setTimeout(async () => {
    if (escritorio.zona !== zona || escritorio.chamada || escritorio.entrandoChamada) return;
    await entrarChamadaEscritorio({ microfone: true });
  }, 600);
}
// Cada etapa da conversa tem prazo: em vez de ficar em "Preparando conversa…"
// para sempre, a pessoa vê em qual etapa parou (e o console guarda o motivo).
function escritorioComPrazo(promessa, ms, etapa) {
  let timer;
  return Promise.race([
    promessa,
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`A conversa não abriu (${etapa}). Tente de novo.`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}
async function entrarChamadaEscritorio({ microfone = false } = {}) {
  if (escritorio.chamada || escritorio.entrandoChamada) return;
  if (!escritorio.conectado) {
    escritorioAviso("Entre no escritório antes de abrir uma conversa.");
    return;
  }
  escritorio.entrandoChamada = true;
  const geracao = escritorio.geracao,
    sala = escritorio.sala,
    zonaInicial = escritorio.zona;
  escritorioAviso("Preparando conversa…");
  let meeting;
  try {
    if (!escritorio.zona) throw new Error("Entre numa sala para conversar.");
    const d = await escritorioComPrazo(escritorioTokenDaZona(escritorio.zona), 15000, "servidor da conversa");
    escritorio.tokenPrevio = null; // cada token entra uma vez
    if (geracao !== escritorio.geracao || !escritorio.conectado)
      throw new Error("Entrada na chamada cancelada.");
    await escritorioComPrazo(escritorioMotorVoz(), 20000, "carregando o motor de chamadas");
    // O próprio SDK toca o áudio de todos (um elemento só, sem eco de cópias);
    // se o navegador bloquear, aparece o botão "Ativar som da conversa".
    // Com microfone, o SDK já pega o áudio enquanto entra (mais rápido que
    // ligar depois de entrar). Se o microfone for negado, entra só ouvindo.
    const iniciar = (audio) => escritorioComPrazo(window.RealtimeKitClient.init({
      authToken: d.authToken,
      defaults: { audio, video: false, mediaConfiguration: { audio: escritorioPrefsAudio() } },
      modules: { experimentalAudioPlayback: true },
    }), 20000, "iniciando a chamada");
    try { meeting = await iniciar(Boolean(microfone)); }
    catch (e) { if (!microfone) throw e; console.warn("Chamada com microfone:", e); meeting = await iniciar(false); }
    escritorioNivelAudio.iniciar();
    await escritorioComPrazo(meeting.join(), 20000, "entrando na sala de voz");
    escritorioAplicarDispositivos(meeting);
    if (geracao !== escritorio.geracao || !escritorio.conectado)
      throw new Error("Entrada na chamada cancelada.");
    escritorio.chamada = meeting;
    escritorio.falhaConversa = "";
    escritorio.salaChamada = escritorioLugarDe(escritorio.perfil).nome;
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
    // O navegador bloqueou o som até a pessoa interagir: o próximo clique ou
    // tecla em qualquer lugar já libera (o botão fica como atalho visível).
    meeting.self.on("autoplayError", () => {
      escritorio.somBloqueado = true;
      renderMidiaEscritorio();
      const liberar = async () => {
        try { await meeting.self.playAudio(); escritorio.somBloqueado = false; renderMidiaEscritorio(); } catch {}
      };
      document.addEventListener("pointerdown", liberar, { once: true, capture: true });
      document.addEventListener("keydown", liberar, { once: true, capture: true });
    });
    // Mudou de sala enquanto entrava: não fica numa conversa que não é a dela.
    if (escritorio.zona !== zonaInicial) { await sairChamadaEscritorio(); return; }
    let semMicrofone = false;
    if (microfone && !meeting.self.audioEnabled) {
      // Na primeira vez o navegador pergunta: a pessoa precisa clicar em Permitir.
      escritorioAviso("Clique em Permitir no aviso do navegador para usar o microfone.");
      try { await meeting.self.enableAudio(); } catch (e) { semMicrofone = true; console.warn("Microfone:", e); }
    }
    renderEscritorio();
    escritorioAviso(!microfone ? "Conversa aberta. Microfone e câmera estão desligados."
      : semMicrofone ? "Conversa aberta, mas o navegador não liberou o microfone. Clique no cadeado da barra de endereço e permita o microfone."
      : "Você entrou na conversa da sala: quem está aqui ouve você. Clique no microfone para silenciar.");
  } catch (e) {
    console.warn("Conversa do escritório:", e);
    await meeting?.leave().catch(() => {});
    escritorio.falhaConversa = e.message;
    escritorioAviso(e.message);
  } finally {
    escritorio.entrandoChamada = false;
    atualizarDockEscritorio();
    atualizarControlesEscritorio();
  }
}
// Ajustes de áudio: microfone, saída de som e processamento (redução de ruído,
// cancelamento de eco, ganho automático). Ficam neste computador; o
// processamento vale ao reconectar a conversa.
const ESCRITORIO_AUDIO_PREFS = "vybe-escritorio-audio";
function escritorioLerPrefsAudio() {
  try { return JSON.parse(localStorage.getItem(ESCRITORIO_AUDIO_PREFS) || "{}") || {}; } catch { return {}; }
}
function escritorioPrefsAudio() {
  const p = escritorioLerPrefsAudio();
  return { noiseSupression: p.ruido !== false, echoCancellation: p.eco !== false, autoGainControl: p.ganho !== false };
}
function escritorioSalvarPrefsAudio(mudanca) {
  try { localStorage.setItem(ESCRITORIO_AUDIO_PREFS, JSON.stringify({ ...escritorioLerPrefsAudio(), ...mudanca })); } catch {}
}
async function escritorioAplicarDispositivos(meeting) {
  const p = escritorioLerPrefsAudio(), self = meeting?.self;
  if (!self) return;
  try {
    if (p.microfone) { const d = (await self.getAudioDevices()).find((x) => x.deviceId === p.microfone); if (d) await self.setDevice(d); }
    if (p.saida) { const d = (await self.getSpeakerDevices()).find((x) => x.deviceId === p.saida); if (d) await self.setDevice(d); }
  } catch (e) { console.warn("Dispositivo de áudio:", e); }
}
async function abrirAjustesAudioEscritorio() {
  const self = escritorio.chamada?.self;
  document.getElementById("ofc-btn-audio")?.classList.remove("alerta");
  let el = document.getElementById("office-ajustes-audio");
  if (el) { el.remove(); return; }
  const caixa = document.querySelector(".ofc-principal");
  if (!caixa) return;
  el = document.createElement("section");
  el.id = "office-ajustes-audio";
  el.className = "ofc-ajustes-audio";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Ajustes de áudio");
  caixa.append(el);
  let mics = [], saidas = [];
  try { mics = self ? await self.getAudioDevices() : []; saidas = self ? await self.getSpeakerDevices() : []; } catch {}
  const atual = self?.getCurrentDevices?.() || {};
  const p = escritorioPrefsAudio();
  const nome = (d, i, tipo) => safeText(d.label || `${tipo} ${i + 1}`);
  const opcoes = (lista, id, tipo) => lista.map((d, i) => `<option value="${safeText(d.deviceId)}" ${d.deviceId === id ? "selected" : ""}>${nome(d, i, tipo)}</option>`).join("");
  const chave = (id, rotulo, dica, ligado) => `<label class="ofc-chave"><input type="checkbox" ${ligado ? "checked" : ""} onchange="mudarProcessamentoAudio('${id}',this.checked)"><span><b>${rotulo}</b><small>${dica}</small></span></label>`;
  el.innerHTML = `<div class="ofc-recado-topo"><b>Ajustes de áudio</b><button type="button" class="ofc-x" aria-label="Fechar" onclick="this.closest('section').remove()">×</button></div>
${self ? `<label class="ofc-campo"><span>Microfone</span><select onchange="trocarDispositivoAudio('audioinput',this.value)">${opcoes(mics, atual.audio?.deviceId, "Microfone") || "<option>Nenhum microfone encontrado</option>"}</select></label>
<div class="ofc-teste-mic"><small>Fale algo: a barra deve mexer.</small><i class="office-call-nivel" aria-hidden="true"><i id="office-nivel-teste"></i></i></div>
<label class="ofc-campo"><span>Saída de som</span><select onchange="trocarDispositivoAudio('audiooutput',this.value)" ${saidas.length ? "" : "disabled"}>${opcoes(saidas, atual.speaker?.deviceId, "Saída") || "<option>Padrão do sistema</option>"}</select></label>
${saidas.length ? "" : '<small class="ofc-fila-nota">Este navegador não deixa escolher a saída; use a do sistema.</small>'}` : '<p class="ofc-fila-nota">Entre numa sala para escolher o microfone e a saída. Os ajustes abaixo já valem para a próxima conversa.</p>'}
${chave("ruido", "Redução de ruído", "Corta barulho de fundo constante.", p.noiseSupression)}
${chave("eco", "Cancelamento de eco", "Evita que sua caixa de som volte no microfone.", p.echoCancellation)}
${chave("ganho", "Ganho automático", "Ajusta a sensibilidade do microfone sozinho. Desligue se sua voz ficar baixa ou estourando.", p.autoGainControl)}`;
  // Barra de teste ao vivo do próprio microfone.
  clearInterval(escritorio.timerTesteMic);
  escritorio.timerTesteMic = setInterval(() => {
    const barraTeste = document.getElementById("office-nivel-teste");
    if (!barraTeste) { clearInterval(escritorio.timerTesteMic); return; }
    const f = escritorio.chamada && escritorioNivelAudio.fontes.get(escritorio.chamada.self.id);
    if (!f) { barraTeste.style.width = "0%"; return; }
    f.an.getByteTimeDomainData(f.dados);
    let soma = 0; for (const v of f.dados) soma += (v - 128) * (v - 128);
    barraTeste.style.width = Math.round(Math.min(1, Math.sqrt(soma / f.dados.length) / 28) * 100) + "%";
  }, 100);
}
async function trocarDispositivoAudio(tipo, id) {
  const self = escritorio.chamada?.self;
  if (!self) return;
  try {
    const lista = tipo === "audioinput" ? await self.getAudioDevices() : await self.getSpeakerDevices();
    const d = lista.find((x) => x.deviceId === id);
    if (!d) return;
    await self.setDevice(d);
    escritorioSalvarPrefsAudio(tipo === "audioinput" ? { microfone: id } : { saida: id });
    escritorioNivelAudio.ultimoSom = Date.now(); escritorioNivelAudio.avisouMudo = false;
    escritorioAviso(tipo === "audioinput" ? "Microfone trocado. Fale algo e veja a barra." : "Saída de som trocada.");
    renderMidiaEscritorio();
  } catch (e) {
    escritorioAviso("Não foi possível trocar: " + e.message);
  }
}
async function mudarProcessamentoAudio(qual, ligado) {
  escritorioSalvarPrefsAudio({ [qual]: ligado });
  if (!escritorio.chamada) return;
  // Vale ao reconectar: sai e entra de novo na conversa da sala.
  escritorioAviso("Aplicando o ajuste: reconectando a conversa…");
  escritorio.reconectandoAudio = true;
  try { await sairChamadaEscritorio(); await entrarChamadaEscritorio({ microfone: true }); }
  finally { escritorio.reconectandoAudio = false; }
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
  if (escritorio.somBloqueado) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "office-call-som";
    b.textContent = "Ativar som da conversa";
    b.onclick = async () => { try { await meeting.self.playAudio(); escritorio.somBloqueado = false; } catch {} renderMidiaEscritorio(); };
    el.append(b);
  }
  for (const p of [meeting.self, ...meeting.participants.joined.toArray()]) {
    const eu = p === meeting.self;
    const tile = document.createElement("div");
    tile.className = "office-call-pessoa";
    tile.dataset.participante = p.id;
    const topo = document.createElement("div");
    topo.className = "office-call-topo";
    const nome = document.createElement("b");
    nome.textContent = (p.name || "Participante") + (eu ? " (você)" : "");
    const mic = document.createElement("span");
    mic.className = "office-call-mic";
    mic.dataset.ligado = String(Boolean(p.audioEnabled));
    mic.textContent = p.audioEnabled ? "Microfone ligado" : "Microfone desligado";
    topo.append(nome, mic);
    // Barra de volume: mostra que o som está chegando (ou saindo, no seu caso).
    const nivel = document.createElement("i");
    nivel.className = "office-call-nivel";
    nivel.setAttribute("aria-hidden", "true");
    nivel.append(document.createElement("i"));
    tile.append(topo, nivel);
    if (eu && p.audioEnabled) {
      const dica = document.createElement("small");
      dica.textContent = "Fale algo: a barra verde mexe quando o microfone capta sua voz.";
      tile.append(dica);
    }
    if (p.videoEnabled && p.videoTrack) {
      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      v.muted = true;
      v.srcObject = new MediaStream([p.videoTrack]);
      tile.append(v);
    }
    if (p.screenShareEnabled && p.screenShareTracks?.video) {
      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      v.muted = true;
      v.controls = true;
      v.srcObject = new MediaStream([p.screenShareTracks.video]);
      tile.append(v);
    }
    el.append(tile);
  }
  escritorioNivelAudio.acompanhar([meeting.self, ...meeting.participants.joined.toArray()]);
  // Barra compacta: um rosto (iniciais) por pessoa; quem fala acende.
  const rostos = document.getElementById("office-call-rostos");
  if (rostos) rostos.innerHTML = [meeting.self, ...meeting.participants.joined.toArray()].map((p) => {
    const ini = String(p.name || "?").split(/\s+/).slice(0, 2).map((x) => x[0] || "").join("").toUpperCase();
    return `<i class="office-call-rosto${p.audioEnabled ? "" : " mudo"}" data-participante="${safeText(String(p.id))}" title="${safeText(p.name || "")}${p.audioEnabled ? "" : " · microfone desligado"}">${safeText(ini)}</i>`;
  }).join("");
  // Vídeo de cada pessoa também numa bolha sobre o boneco dela no mapa. O id
  // do participante é "pessoa:código", criado pelo servidor.
  const comVideo = new Map();
  for (const p of [meeting.self, ...meeting.participants.joined.toArray()]) {
    const pessoa = p === meeting.self ? String(escritorio.base?.eu) : String(p.customParticipantId || "").split(":")[0];
    if (pessoa && p.videoEnabled && p.videoTrack) comVideo.set(pessoa, new MediaStream([p.videoTrack]));
  }
  for (const id of escritorio.mapa?.idsNoMapa() || []) escritorio.mapa.anexarVideo(id, comVideo.get(id) || null);
  atualizarDockEscritorio();
}
// Volume de cada pessoa na conversa (o seu e o dos outros), 10 vezes por
// segundo, só enquanto há conversa: barra no cartão e anel no boneco do mapa.
const escritorioNivelAudio = {
  ctx: null, fontes: new Map(), relogio: null,
  iniciar() {
    try { this.ctx ||= new AudioContext(); this.ctx.resume?.(); } catch {}
    clearInterval(this.relogio);
    this.relogio = setInterval(() => this.medir(), 100);
  },
  acompanhar(lista) {
    if (!this.ctx) return;
    const vistos = new Set();
    for (const p of lista) {
      if (!p.audioEnabled || !p.audioTrack) continue;
      vistos.add(p.id);
      const atual = this.fontes.get(p.id);
      if (atual?.track === p.audioTrack) { atual.p = p; continue; }
      atual?.fonte.disconnect();
      try {
        const fonte = this.ctx.createMediaStreamSource(new MediaStream([p.audioTrack]));
        const an = this.ctx.createAnalyser();
        an.fftSize = 512;
        fonte.connect(an); // sem ligar na saída: só mede, quem toca é o SDK
        this.fontes.set(p.id, { p, track: p.audioTrack, fonte, an, dados: new Uint8Array(an.fftSize) });
      } catch {}
    }
    for (const [id, f] of this.fontes) if (!vistos.has(id)) { f.fonte.disconnect(); this.fontes.delete(id); this.marcar(f.p, 0); }
  },
  medir() {
    for (const f of this.fontes.values()) {
      f.an.getByteTimeDomainData(f.dados);
      let soma = 0;
      for (const v of f.dados) soma += (v - 128) * (v - 128);
      this.marcar(f.p, Math.min(1, Math.sqrt(soma / f.dados.length) / 28));
    }
  },
  marcar(p, nivel) {
    // Microfone ligado e mudo por 8 s: provavelmente a entrada errada.
    if (p === escritorio.chamada?.self && p.audioEnabled) {
      if (nivel > 0.03) this.ultimoSom = Date.now();
      else if (!this.avisouMudo && Date.now() - (this.ultimoSom ||= Date.now()) > 8000) {
        this.avisouMudo = true;
        escritorioAviso("Seu microfone não está captando som. Abra Ajustes de áudio e escolha outra entrada.");
        document.getElementById("ofc-btn-audio")?.classList.add("alerta");
      }
    }
    const barra = document.querySelector(`.office-call-pessoa[data-participante="${CSS.escape(String(p.id))}"] .office-call-nivel i`);
    if (barra) barra.style.width = Math.round(nivel * 100) + "%";
    document.querySelector(`.office-call-rosto[data-participante="${CSS.escape(String(p.id))}"]`)?.classList.toggle("falando", nivel > 0.12);
    const pessoa = p === escritorio.chamada?.self ? String(escritorio.base?.eu) : String(p.customParticipantId || "").split(":")[0];
    if (pessoa) escritorio.mapa?.marcarFalando(pessoa, nivel > 0.12);
  },
  parar() {
    clearInterval(this.relogio); this.relogio = null;
    this.ultimoSom = 0; this.avisouMudo = false;
    for (const f of this.fontes.values()) { f.fonte.disconnect(); this.marcar(f.p, 0); }
    this.fontes.clear();
  },
};
async function sairChamadaEscritorio() {
  const m = escritorio.chamada;
  escritorio.chamada = null;
  escritorio.somBloqueado = false;
  escritorioNivelAudio.parar();
  if (!escritorio.reconectandoAudio) document.getElementById("office-ajustes-audio")?.remove();
  try {
    await m?.leave();
  } catch {
    escritorioAviso("A conexão da chamada foi encerrada.");
  } finally {
    document.getElementById("office-call")?.setAttribute("hidden", "");
    document.getElementById("office-call-media")?.replaceChildren();
    for (const id of escritorio.mapa?.idsNoMapa() || []) escritorio.mapa.anexarVideo(id, null);
    atualizarDockEscritorio();
  }
}
window.addEventListener("pagehide", () => {
  escritorio.socket?.close();
  escritorio.chamada?.leave();
});

// WASD/setas valem em qualquer lugar do escritório, não só com o mapa focado;
// campos de texto, modais e a abertura ficam de fora.
globalThis.document?.addEventListener?.("keydown", (e) => {
  if (typeof activeBoard === "undefined" || activeBoard !== "escritorio" || !escritorio.mapa) return;
  if (document.getElementById("ofc-abertura") || document.getElementById("ofc-tutorial") || document.querySelector(".workflow-modal")) return;
  if ((escritorio.modo || "mapa") !== "mapa") return;
  if (escritorio.edicao) { if (teclaEditorEscritorio(e)) e.preventDefault(); return; }
  escritorio.correndo = e.shiftKey;
  if (!e.target.closest?.("input, textarea, select, [contenteditable]") && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
    const k = e.key.toLowerCase();
    if (k === "e" && escritorio.acaoProxima) { e.preventDefault(); escritorio.acaoProxima.fazer(); return; }
    if (k === "1") { e.preventDefault(); definirPoseEscritorio(escritorio.pose === "acenar" ? "" : "acenar"); return; }
    if (k === "2") { e.preventDefault(); deitarEscritorio(); return; }
    if (k === "3") { e.preventDefault(); definirPoseEscritorio(escritorio.pose === "cafe" ? "" : "cafe"); return; }
  }
  tecladoEscritorio(e);
});
globalThis.document?.addEventListener?.("keyup", (e) => { escritorio.correndo = e.shiftKey; soltarTeclaEscritorio(e); });
// Trocar de aba com a tecla presa não pode deixar o boneco andando sozinho.
globalThis.window?.addEventListener?.("blur", () => { escritorioTeclas.clear(); escritorioPararTeclado(); });
