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
// Mesmo boneco do mapa (Habbo), em pé, para listas, lobby e cartões.
function escritorioAvatar(perfil = {}, nome = "") {
  const url = "https://www.habboassets.com/imaging/avatar.png?" + new URLSearchParams({ figure: mapaFigura(perfil), direction: 2 });
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
function escritorioAviso(texto) {
  const el = document.getElementById("office-feedback");
  if (el) el.textContent = texto;
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
    `<div class="workflow-kicker">Conversa da equipe</div><h2 class="workflow-title">${safeText(convite.nome)} convidou você</h2><p>Entrar na conversa da sala ${safeText(ESCRITORIO_SALAS[convite.sala])}? Quem estiver na chamada dessa sala poderá ouvir quando você ligar o microfone.</p><div class="workflow-actions"><button class="workflow-secondary" onclick="escritorio.convite=null;atualizarDockEscritorio();closeWorkflowModal()">Agora não</button><button class="workflow-primary" onclick="mudarSalaEscritorio('${convite.sala}');escritorio.convite=null;closeWorkflowModal();switchBoard('escritorio',document.getElementById('btn-board-escritorio'));entrarChamadaEscritorio()">Entrar com microfone desligado</button></div>`,
  );
}

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
    alvo: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    fone: '<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  }[nome] || "";
  return `<svg class="ofc-ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
}
// Mapa único: a planta ganha, em cada sala individual, a mesa de quem a ocupa.
function escritorioDonos() {
  return escritorioSalasPessoais(escritorio.base?.equipe || []);
}
function escritorioPlantaComMesas() {
  const P = ESCRITORIO_PLANTA;
  const moveis = [...P.moveis];
  for (const a of P.ambientes) if (a.pessoal) moveis.push(...escritorioMoveisDaSala(a));
  return { ...P, moveis };
}
// Ao chegar, a pessoa aparece sentada na própria mesa; sem sala, na recepção.
function escritorioChegar() {
  const base = escritorio.base;
  escritorio.perfil = { ...(base.equipe.find((p) => p.id === base.eu)?.perfil || {}) };
  const mesa = escritorioMinhaMesa();
  const lugar = mesa ? mesa.cadeira : { x: 36, y: 8 };
  Object.assign(escritorio.perfil, escritorioParaPorcentagem(lugar.x, lugar.y));
  escritorio.sala = escritorioSalaEm(lugar.x, lugar.y);
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
    if (escritorio.mapa.caminho(de, { x: x0 + dx, y: y0 + dy })) { escritorioIrPara(x0 + dx, y0 + dy); escritorio.mapa.centralizar(x0, y0); return; }
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
    if (escritorio.mapa.caminho(de, { x, y })) { escritorioIrPara(x, y); escritorio.mapa.centralizar(x, y); return; }
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
      const pos = escritorioPosicao(p);
      const voce = p.id === eu;
      const perfilDe = escritorio.base.equipe.find((e) => e.id === p.id)?.perfil || p.perfil || {};
      // Parado num assento (cadeira, sofá, banqueta…), o boneco senta virado
      // para onde o assento olha.
      const dirAssento = escritorio.mapa.assentoEm(pos.x, pos.y);
      const sentado = dirAssento !== undefined;
      const [nomeStatus, corStatus] = ESCRITORIO_STATUS[p.status] || ESCRITORIO_STATUS.disponivel;
      return {
        id: p.id, nome: voce && escritorio.conectado ? "Você" : p.nome, perfil: perfilDe, status: p.status, corStatus,
        rotulo: `${p.nome}${voce ? " (você)" : ""} · ${nomeStatus}`,
        x: Math.round(pos.x), y: Math.round(pos.y),
        acao: voce && escritorio.emMovimento ? "wlk" : sentado ? "sit" : "std", dir: sentado ? dirAssento : undefined,
        aoClicar: convidarConversaEscritorio,
      };
    }));
  }
  const lista = document.getElementById("office-roster");
  if (lista) {
    const online = escritorio.base.equipe.filter((p) => pessoas.some((o) => o.id === p.id));
    const fora = escritorio.base.equipe.filter((p) => !pessoas.some((o) => o.id === p.id));
    const linha = (p) => {
      const o = pessoas.find((x) => x.id === p.id);
      return `<li class="office-member${o ? "" : " fora"}">${escritorioAvatar(p.perfil, p.nome)}<div><b>${safeText(p.nome)}${p.id === eu ? " · você" : ""}</b><small>${o ? `${escritorioStatusHtml(o.status)} · ${safeText(escritorioLugarDe(o).nome)}` : "Fora do escritório"}</small></div>${o && p.id !== eu ? `<button type="button" class="ofc-mini" onclick="escritorioIrAte('${safeText(o.id)}')">Ir</button>` : ""}</li>`;
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
 <div class="ofc-topo"><div class="ofc-sala-atual" style="--sala:${ESCRITORIO_COR_SALA[sala]}"><i></i><h2 id="office-lugar">${safeText(escritorioLugarDe(escritorio.perfil).nome)}</h2><span>${sala === "foco" ? "Espaço silencioso, sem conversa por voz." : "Conversa: " + safeText(ESCRITORIO_SALAS[sala]) + " · WASD ou clique para andar"}</span></div><p id="office-feedback" class="ofc-aviso" role="status">${safeText(b.demo ? "Demonstração local: presença e chamadas não se conectam." : b.aviso || "")}</p></div>
 <div id="office-map-lugar" ${modo === "mapa" ? "" : "hidden"}></div>
 <div class="ofc-zoom" ${modo === "mapa" ? "" : "hidden"}><button type="button" onclick="escritorio.mapa?.mudarZoom(1.25)" aria-label="Aproximar">+</button><button type="button" onclick="escritorio.mapa?.mudarZoom(0.8)" aria-label="Afastar">−</button><button type="button" onclick="centralizarEmMimEscritorio()" aria-label="Centralizar em mim" title="Centralizar em mim">${escritorioIcone("alvo")}</button></div>
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
  montarMapaEscritorio();
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
    });
    requestAnimationFrame(() => centralizarEmMimEscritorio());
  }
  atualizarPessoasEscritorio();
}
function centralizarEmMimEscritorio() {
  const pos = escritorioPosicao(escritorio.perfil || {});
  escritorio.mapa?.centralizar(pos.x, pos.y);
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
// Ir para uma sala de conversa: anda até o primeiro ambiente dela.
function mudarSalaEscritorio(sala, verMapa) {
  if (!Object.hasOwn(ESCRITORIO_SALAS, sala)) return;
  const a = ESCRITORIO_PLANTA.ambientes.find((x) => x.sala === sala && !x.pessoal);
  if (verMapa) escritorio.modo = "mapa";
  escritorioIrPara(a ? (a.x0 + a.x1) / 2 : 30, a ? a.y1 - 1.5 : 18);
  if (verMapa) renderEscritorio();
}
// Anda até um ladrilho como no Habbo: pelo caminho livre, um ladrilho por
// vez, e cada passo vai para a equipe. A sala de conversa é a do ambiente.
function escritorioPasso(x, y) {
  const { x: px, y: py } = escritorioParaPorcentagem(x, y);
  const sala = escritorioSalaEm(x, y);
  escritorio.perfil = { ...escritorio.perfil, x: px, y: py };
  escritorioEmitir("presence:move", { sala, x: px, y: py });
  if (sala !== escritorio.sala) {
    escritorio.sala = sala;
    renderEscritorio();
  } else atualizarPessoasEscritorio();
}
const ESCRITORIO_PASSO_MS = 320;
function escritorioIrPara(x, y) {
  clearTimeout(escritorio.andando);
  const de = escritorioPosicao(escritorio.perfil || {});
  const passos = escritorio.mapa?.caminho(de, { x, y });
  if (passos === null || passos === undefined) {
    // Sem mapa pronto (ou destino sem caminho): não teleporta.
    if (escritorio.mapa) escritorioAviso("Não dá para chegar aí: há parede ou móvel no caminho.");
    return;
  }
  const andar = () => {
    const passo = passos.shift();
    if (!passo) return;
    escritorio.emMovimento = passos.length > 0;
    escritorioPasso(passo.x, passo.y);
    if (passos.length) escritorio.andando = setTimeout(andar, ESCRITORIO_PASSO_MS);
  };
  andar();
}
function cliqueNoMapaEscritorio(x, y) {
  if (!escritorio.conectado && !escritorio.base?.demo) {
    escritorioAviso("Entre no escritório para andar pelo mapa.");
    return;
  }
  // O computador da própria mesa abre o painel.
  const mesa = escritorioMinhaMesa();
  if (mesa && x >= mesa.x && x < mesa.x + mesa.w && y >= mesa.y && y < mesa.y + mesa.h) {
    abrirPainelDoEscritorio();
    return;
  }
  escritorioIrPara(x, y);
}
// WASD e setas como em jogo: enquanto a tecla está presa, anda um ladrilho a
// cada passo; duas teclas somam (W+D vai na diagonal) e, se a direção está
// bloqueada, desliza pela componente livre em vez de parar.
const ESCRITORIO_TECLAS = {
  ArrowUp: [-1, -1], w: [-1, -1], ArrowDown: [1, 1], s: [1, 1],
  ArrowLeft: [-1, 1], a: [-1, 1], ArrowRight: [1, -1], d: [1, -1],
};
const escritorioTeclas = new Set();
function escritorioDirecaoTeclas() {
  let dx = 0, dy = 0;
  for (const t of escritorioTeclas) { dx += ESCRITORIO_TECLAS[t][0]; dy += ESCRITORIO_TECLAS[t][1]; }
  return [Math.sign(dx), Math.sign(dy)];
}
function escritorioPassoTeclado() {
  clearTimeout(escritorio.timerTeclado);
  const [dx, dy] = escritorioDirecaoTeclas();
  if (!dx && !dy) { escritorioPararTeclado(); return; }
  const pos = escritorioPosicao(escritorio.perfil || {});
  const x = Math.round(pos.x), y = Math.round(pos.y);
  const tentativas = dx && dy ? [[dx, dy], [dx, 0], [0, dy]] : [[dx, dy]];
  const ok = tentativas.find(([a, b]) => escritorio.mapa?.podePassar(x, y, a, b));
  if (ok) {
    escritorio.emMovimento = true;
    escritorioPasso(x + ok[0], y + ok[1]);
  }
  escritorio.timerTeclado = setTimeout(escritorioPassoTeclado, ESCRITORIO_PASSO_MS);
}
function escritorioPararTeclado() {
  clearTimeout(escritorio.timerTeclado);
  escritorio.timerTeclado = null;
  if (escritorio.emMovimento) { escritorio.emMovimento = false; atualizarPessoasEscritorio(); }
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
  clearTimeout(escritorio.andando); // tecla interrompe um caminho por clique
  const novo = !escritorioTeclas.has(chave);
  escritorioTeclas.add(chave);
  if (novo && !escritorio.timerTeclado) escritorioPassoTeclado();
}
function soltarTeclaEscritorio(e) {
  const chave = escritorioTecla(e);
  if (!chave) return;
  escritorioTeclas.delete(chave);
  if (!escritorioTeclas.size) escritorioPararTeclado();
}
function irParaMinhaMesaEscritorio() {
  const mesa = escritorioMinhaMesa();
  if (!mesa) return;
  if (escritorio.modo === "lista") { escritorio.modo = "mapa"; renderEscritorio(); }
  escritorioIrPara(mesa.cadeira.x, mesa.cadeira.y);
  escritorio.mapa?.centralizar(mesa.cadeira.x, mesa.cadeira.y);
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
  escritorioChegar();
  escritorio.portaoAntes = Boolean(document.getElementById("mode-gate")?.classList.contains("open"));
  escritorio.boardAntes = antes;
  voltarAoEscritorio();
}
// "Meu espaço" abre o criador de personagem da abertura.
function personalizarEscritorio() {
  abrirAberturaEscritorio("personagem");
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

// WASD/setas valem em qualquer lugar do escritório, não só com o mapa focado;
// campos de texto, modais e a abertura ficam de fora.
globalThis.document?.addEventListener?.("keydown", (e) => {
  if (typeof activeBoard === "undefined" || activeBoard !== "escritorio" || !escritorio.mapa) return;
  if (document.getElementById("ofc-abertura") || document.querySelector(".workflow-modal")) return;
  if ((escritorio.modo || "mapa") !== "mapa") return;
  tecladoEscritorio(e);
});
globalThis.document?.addEventListener?.("keyup", soltarTeclaEscritorio);
// Trocar de aba com a tecla presa não pode deixar o boneco andando sozinho.
globalThis.window?.addEventListener?.("blur", () => { escritorioTeclas.clear(); escritorioPararTeclado(); });
