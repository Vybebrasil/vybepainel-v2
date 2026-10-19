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
  // Quarto em que a pessoa está (sala-N) ou null no mapa geral. A zona de
  // conversa dentro dele é explícita, não deduzida da posição.
  quarto: null,
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
async function escritorioApi(acao, corpo, consulta = null) {
  const r = await fetch(
    "/api/painel?area=escritorio&acao=" + encodeURIComponent(acao) + (consulta ? "&" + new URLSearchParams(consulta) : ""),
    {
      credentials: "same-origin",
      cache: "no-store",
      method: corpo ? "POST" : "GET",
      headers: corpo ? { "Content-Type": "application/json" } : {},
      body: corpo ? JSON.stringify({ ...corpo, acao }) : undefined,
    },
  );
  // Resposta sem JSON (página de erro da hospedagem, envio grande demais):
  // avisa em português, em vez de "Unexpected token".
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok)
    throw new Error(d.error || (r.status === 413 ? "O envio é grande demais para o servidor." : `Não foi possível acessar o escritório (${r.status}).`));
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
  // Mudar o estado de um móvel pode disparar um gatilho da equipe (Wired).
  if (type === "furni:toggle" && typeof gatilhoEstadoEscritorio === "function") gatilhoEstadoEscritorio(payload?.chave);
  if (escritorio.socket?.readyState === WebSocket.OPEN)
    escritorio.socket.send(JSON.stringify({ type, payload }));
}
// Reconexão sem derrubar nada: a renovação da sessão (a cada 4,5 min) e as
// quedas de rede abrem um socket novo por trás; a tela, o mapa e a conversa
// por voz continuam. Só depois de várias tentativas volta para a entrada.
function escritorioReconectar(motivo) {
  clearTimeout(escritorio.timerReconexao);
  const n = (escritorio.tentativasReconexao = (escritorio.tentativasReconexao || 0) + 1);
  if (n > 8) {
    escritorio.tentativasReconexao = 0;
    escritorio.conectado = false;
    escritorio.online = [];
    sairChamadaEscritorio();
    renderEscritorio();
    escritorioAviso("A conexão caiu. Use Entrar no escritório para voltar.");
    return;
  }
  if (motivo) escritorioAviso("Conexão instável. Reconectando…");
  escritorio.timerReconexao = setTimeout(() => conectarEscritorio({ reconexao: true }), Math.min(10000, 600 * 2 ** (n - 1)));
}
function renovarSessaoEscritorio() {
  escritorio.socketAntigo = escritorio.socket;
  conectarEscritorio({ reconexao: true });
}
// Tela de entrada: etapas reais do caminho até o mapa (acesso → servidor →
// sessão → móveis). Só o carregamento do mapa tem porcentagem, porque é o
// único passo que dá para contar; parado mais de 12 s, oferece tentar de novo.
const ESCRITORIO_ETAPAS_ENTRADA = {
  acesso: { texto: "Conferindo seu acesso…", de: 6, ate: 20 },
  conexao: { texto: "Conectando ao escritório…", de: 20, ate: 40 },
  sessao: { texto: "Entrando…", de: 40, ate: 55 },
  mapa: { texto: "Carregando o mapa", de: 55, ate: 100 },
};
function escritorioEtapaEntrada(etapa) {
  escritorio.entrada = { etapa, desde: Date.now(), erro: "" };
  clearInterval(escritorio.timerEntrada);
  escritorio.timerEntrada = setInterval(atualizarEntradaEscritorio, 500);
  atualizarEntradaEscritorio();
}
function escritorioErroEntrada(texto) {
  clearInterval(escritorio.timerEntrada);
  escritorio.entrada = { etapa: escritorio.entrada?.etapa || "acesso", desde: Date.now(), erro: texto };
  escritorio.carregandoMapa = false;
  if (!escritorio.conectado) renderEscritorio();
}
function escritorioFimEntrada() {
  clearInterval(escritorio.timerEntrada);
  escritorio.entrada = null;
  escritorio.carregandoMapa = false;
}
function escritorioEntradaHtml() {
  const e = escritorio.entrada;
  if (!e) return "";
  if (e.erro)
    return `<div id="office-entrada" class="ofc-entrada erro" role="alert"><p>${safeText(e.erro)}</p><button type="button" class="ofc-primario" onclick="tentarEntrarDeNovoEscritorio()">Tentar de novo</button></div>`;
  const passo = ESCRITORIO_ETAPAS_ENTRADA[e.etapa] || ESCRITORIO_ETAPAS_ENTRADA.acesso;
  const carga = escritorio.mapa?.carga;
  const fracao = e.etapa === "mapa" && carga?.total ? Math.min(1, carga.feitos / carga.total) : 0;
  const pct = e.etapa === "mapa" ? Math.round(fracao * 100) : null;
  const largura = Math.round(passo.de + (passo.ate - passo.de) * fracao);
  const demorando = Date.now() - e.desde > 12000;
  return `<div id="office-entrada" class="ofc-entrada" role="status" aria-live="polite">
<div class="ofc-entrada-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${largura}" aria-label="Entrando no escritório"><span style="width:${largura}%"></span></div>
<p>${passo.texto}${pct !== null ? ` ${pct}%` : ""}</p>
${demorando ? `<p class="ofc-entrada-lenta">Está demorando mais que o normal.</p><button type="button" class="ofc-secundario" onclick="tentarEntrarDeNovoEscritorio()">Tentar de novo</button>` : ""}</div>`;
}
function atualizarEntradaEscritorio() {
  const el = document.getElementById("office-entrada");
  if (el) el.outerHTML = escritorioEntradaHtml();
}
function tentarEntrarDeNovoEscritorio() {
  escritorioFimEntrada();
  escritorio.geracao++;
  const socket = escritorio.socket;
  escritorio.socket = null;
  try { socket?.close(); } catch {}
  escritorio.conectando = false;
  escritorio.conectado = false;
  conectarEscritorio();
}
async function conectarEscritorio({ reconexao = false } = {}) {
  if (escritorio.conectando || (escritorio.conectado && !reconexao)) return;
  escritorio.conectando = true;
  const geracao = escritorio.geracao;
  if (!reconexao) { escritorioEtapaEntrada("acesso"); renderEscritorio(); }
  try {
    const base = await escritorioApi("entrada");
    // Saiu (ou tentou de novo) enquanto a resposta não chegava: esta tentativa morre aqui.
    if (geracao !== escritorio.geracao) return;
    escritorio.base = base;
    if (!base.worker || !base.token)
      throw new Error(base.aviso || "Conexão indisponível.");
    if (!reconexao) escritorioEtapaEntrada("conexao");
    const url = new URL("/room/vybe-os", base.worker);
    url.protocol = "wss:";
    const socket = new WebSocket(url);
    escritorio.socket = socket;
    socket.onopen = () => {
      if (!reconexao) escritorioEtapaEntrada("sessao");
      socket.send(
        JSON.stringify({
          type: "presence:join",
          payload: { token: base.token },
        }),
      );
    };
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
        const jaEstava = escritorio.conectado;
        // Entrou: se a conexão cair depois (rede, aba no fundo), volta sozinho.
        escritorio.querConectado = true;
        try { localStorage.setItem("vybe-escritorio-dentro", "1"); } catch {}
        escritorio.conectado = true;
        escritorio.tentativasReconexao = 0;
        // Socket da sessão anterior (renovação): fecha sem efeito na tela.
        const antigo = escritorio.socketAntigo;
        escritorio.socketAntigo = null;
        if (antigo && antigo !== socket) try { antigo.close(); } catch {}
        escritorioEmitir("presence:move", {
          sala: escritorio.sala,
          zona: escritorio.zona,
          status: escritorio.status,
          x: escritorio.perfil.x || 50,
          y: escritorio.perfil.y || 75,
        });
        if (escritorio.pose) escritorioEmitir("pose", { tipo: escritorio.pose });
        clearInterval(escritorio.ping);
        clearTimeout(escritorio.renovar);
        if (jaEstava && reconexao) {
          escritorio.renovar = setTimeout(renovarSessaoEscritorio, 270000);
          escritorio.ping = setInterval(() => escritorioEmitir("system:ping", {}), 30000);
          atualizarControlesEscritorio();
          return;
        }
        // A cortina da entrada só sai quando os móveis terminam de carregar.
        if (escritorio.mapa && !escritorio.mapa.carga?.pronto) {
          escritorioEtapaEntrada("mapa");
          escritorio.carregandoMapa = true;
          escritorio.mapa.prontos.then(() => { if (!escritorio.carregandoMapa) return; escritorioFimEntrada(); renderEscritorio(); });
        } else escritorioFimEntrada();
        renderEscritorio();
        if (escritorio.tutorialPendente) { escritorio.tutorialPendente = false; setTimeout(iniciarTutorialEscritorio, 900); }
        setTimeout(() => escritorioMotorVoz().catch(() => {}), 1500);
        escritorioConversaAutomatica();
        escritorioEmitir("music:get", {});
        carregarResumoRecados();
        escritorio.ping = setInterval(
          () => escritorioEmitir("system:ping", {}),
          30000,
        );
        escritorio.renovar = setTimeout(renovarSessaoEscritorio, 270000);
      }
      if (
        e.type === "conversation:invite" &&
        Object.hasOwn(ESCRITORIO_SALAS, e.payload.sala)
      ) {
        escritorio.convite = e.payload;
        atualizarDockEscritorio();
        escritorioAviso(
          e.payload.nome + (e.payload.chamado ? " chamou você para a sala dele." : " convidou você para a conversa da sala."),
        );
        // Chamado de longe: pergunta na hora (Ir até a sala / Agora não).
        if (e.payload.chamado) { escritorioTocar(740, 0.15, 0.06); setTimeout(() => escritorioTocar(988, 0.15, 0.06), 160); aceitarConviteEscritorio(); }
      }
      if (e.type === "presence:update") {
        avisarEntradasEscritorio(escritorio.online, e.payload);
        escritorio.online = e.payload;
        // Alguém entrou ou saiu da sua sala: passa (ou deixa) de ser ouvido.
        if (escritorio.chamada) {
          const ouvindo = escritorioOuvindo(escritorio.chamada).map((p) => p.id).join();
          if (ouvindo !== escritorio.ouvindoAntes) { escritorio.ouvindoAntes = ouvindo; escritorioTocarVozes(); renderMidiaEscritorio(); }
        }
        atualizarPessoasEscritorio();
      }
      if (e.type === "chat:changed" && e.payload.sala === escritorio.sala)
        carregarChatEscritorio();
      if (e.type === "realtime:error") escritorioAviso(e.payload.message);
      if (e.type === "zone:locks") {
        const canalAntes = escritorioCanal();
        escritorio.trancas = new Map((e.payload || []).map((t) => [t.zona, new Set(t.permitidos)]));
        // Trancaram (ou destrancaram) a sala onde você está: muda de conversa.
        if (escritorioCanal() !== canalAntes) escritorioConversaAutomatica();
        escritorio.mapa?.marcarTrancas(new Set(escritorio.trancas.keys()));
        atualizarControlesEscritorio();
      }
      if (e.type === "zone:knock") avisoBatidaEscritorio(e.payload);
      if (e.type === "recado:novo") recadoChegouEscritorio(e.payload);
      if (e.type === "furni:states") {
        escritorioDadosRolaram(escritorio.estadosMoveis, e.payload);
        escritorio.estadosMoveis = e.payload;
        escritorio.mapa?.estadosMoveis(e.payload);
        atualizarAcaoProximaEscritorio(true);
      }
      if (e.type === "reaction") escritorio.mapa?.reagir(e.payload.id, e.payload.tipo);
      if (e.type === "chat:bubble") escritorioReceberBalao(e.payload.id, e.payload.texto);
      if (e.type === "music:state") receberMusicaEscritorio(e.payload);
      if (e.type === "screen:quality") pedidoQualidadeTelaEscritorio(e.payload);
    };
    socket.onclose = () => {
      if (escritorio.socket !== socket) return;
      clearInterval(escritorio.ping);
      clearTimeout(escritorio.renovar);
      escritorio.conectando = false;
      // Queda inesperada: tenta de novo sem sair da conversa nem voltar à entrada.
      if (escritorio.conectado) { escritorioReconectar(true); return; }
      escritorio.online = [];
      atualizarPessoasEscritorio();
      if (escritorio.entrada) escritorioErroEntrada("A conexão com o escritório caiu antes de entrar. Confira a internet e tente de novo.");
      else escritorioAviso("Desconectado. Use Entrar no escritório para reconectar.");
      atualizarDockEscritorio();
    };
    socket.onerror = () =>
      escritorioAviso("Falha na conexão. Confira o acesso e tente novamente.");
  } catch (e) {
    if (geracao !== escritorio.geracao) return;
    escritorio.conectando = false;
    if (reconexao && escritorio.conectado) { escritorioReconectar(true); return; }
    await sairChamadaEscritorio();
    if (!reconexao) escritorioErroEntrada(e.message);
    else escritorioAviso(e.message);
  }
}
function desconectarEscritorio(sairChamada = true) {
  clearTimeout(escritorio.timerVoz);
  clearTimeout(escritorio.timerConversa);
  // Saiu de propósito: não reconecta sozinho.
  if (sairChamada) { escritorio.querConectado = false; try { localStorage.removeItem("vybe-escritorio-dentro"); } catch {} }
  clearTimeout(escritorio.timerReconexao);
  escritorio.tentativasReconexao = 0;
  try { escritorio.socketAntigo?.close(); } catch {}
  escritorio.socketAntigo = null;
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
  escritorioFimEntrada();
  escritorio.online = [];
  escritorio.naPista = false;
  if (typeof sincronizarMusicaEscritorio === "function") sincronizarMusicaEscritorio();
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
  dock.innerHTML = `<button class="office-dock-volta" onclick="voltarAoEscritorio()">${escritorioIcone("mapa")}<span>Voltar ao escritório</span></button>${escritorio.conectado ? `<details class="office-dock-team"><summary>${escritorio.online.length} online</summary><div>${escritorio.online.map((p) => `<p>${safeText(p.nome)} · ${safeText(escritorioLugarDe(p).nome)}</p>`).join("")}</div></details>` : `<button type="button" onclick="conectarEscritorio()" ${escritorio.conectando ? "disabled" : ""} title="Entra no escritório sem sair do painel: você vê quem está online e a equipe vê você">${escritorio.conectando ? "Entrando…" : "Fora do escritório · Entrar"}</button>`}${escritorio.chamada ? `<button onclick="alternarMidiaEscritorio('audio')">${escritorio.chamada.self.audioEnabled ? "Desligar microfone" : "Ligar microfone"}</button><button onclick="sairChamadaEscritorio()">Sair da chamada</button>` : ""}${escritorio.convite ? '<button onclick="aceitarConviteEscritorio()">Ver convite</button>' : ""}`;
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
  // Onde não há voz (corredor, Foco), o convite marca a conversa numa sala:
  // a sua, se tiver; senão a Recepção. Quem convida vai para lá também.
  const zona = escritorioZonaDeConversa();
  escritorioEmitir("conversation:invite", { id, zona });
  const primeiro = String(outro.nome).split(" ")[0];
  if (zona !== escritorio.zona) {
    const nome = ESCRITORIO_PLANTA.ambientes.find((a) => a.id === zona)?.nome || "a sala";
    escritorioAviso(`Convite enviado para ${primeiro}. A conversa é em ${nome}: indo para lá.`);
    escritorioIrParaAmbiente(zona);
  } else escritorioAviso("Convite para a conversa da sala enviado para " + primeiro + ".");
}
function escritorioZonaDeConversa() {
  if (escritorioCanal()) return escritorio.zona;
  return escritorioMinhaMesa()?.ambiente.id || "recepcao";
}
// Chamar alguém de qualquer lugar para a sala onde você está.
function chamarParaSalaEscritorio(id) {
  if (!escritorio.zona || escritorio.zona === "foco") { escritorioAviso("Entre numa sala para chamar alguém até ela."); return; }
  const outro = (escritorio.online || []).find((p) => String(p.id) === String(id));
  if (!outro) { escritorioAviso("Essa pessoa não está no escritório agora. Deixe um recado."); return; }
  escritorioEmitir("conversation:summon", { id: String(id) });
  escritorioAviso(`Você chamou ${String(outro.nome).split(" ")[0]} para ${escritorioLugarDe(escritorio.perfil).nome}.`);
}
function aceitarConviteEscritorio() {
  const convite = escritorio.convite;
  if (!convite) return;
  // Convite sem sala (Worker antigo, do corredor): a conversa é na Recepção.
  const zona = ESCRITORIO_PLANTA.ambientes.some((a) => a.id === convite.zona && a.id !== "foco") ? convite.zona : "recepcao";
  const nome = ESCRITORIO_PLANTA.ambientes.find((a) => a.id === zona)?.nome || "outra sala";
  openWorkflowModal(
    `<div class="workflow-kicker">Conversa da equipe</div><h2 class="workflow-title">${safeText(convite.nome)} ${convite.chamado ? "chamou você" : "convidou você"}</h2><p>A conversa é em ${safeText(nome)}. Ao chegar, você entra na conversa com o microfone ligado.</p><div class="workflow-actions"><button class="workflow-secondary" onclick="escritorio.convite=null;atualizarDockEscritorio();closeWorkflowModal()">Agora não</button><button class="workflow-primary" onclick="escritorio.convite=null;closeWorkflowModal();switchBoard('escritorio',document.getElementById('btn-board-escritorio'));escritorioIrParaAmbiente('${safeText(zona)}');escritorioAviso('Ao chegar na sala, você entra na conversa com o microfone ligado.')">Ir até a conversa</button></div>`,
  );
}

function escritorioIcone(nome) {
  const d = {
    mapa: '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 17l8 4 8-4"/>',
    pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5"/><path d="M16 4.6a3 3 0 010 6M18 14.8c1.6.8 2.6 2.5 3 5.2"/>',
    conversa: '<path d="M4 5h16v11H9l-5 4z"/>',
    clientes: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>',
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
    mais: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    alvo: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    voltar: '<path d="M18 6l-8 6 8 6zM6 6v12"/>',
    avancar: '<path d="M6 6l8 6-8 6zM18 6v12"/>',
    musica: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
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
  const guardada = escritorio.base?.mapa?.camadas?.[camada];
  // Camada salva antes da planta atual era de outra planta (o mapa geral tinha
  // outro desenho e as salas tinham outro tamanho): vale o padrão; a versão
  // antiga fica no histórico. Antes isso só valia para o mapa geral, e a sala
  // de quem já tinha arrumado a sua aparecia com os móveis de 10×10 dentro da
  // de 8×8, sem janela e com estante no corredor.
  const antiga = guardada && !(new Date(guardada.em || 0) >= new Date(camada === "geral" ? ESCRITORIO_GERAL_DESDE : ESCRITORIO_PLANTA_DESDE));
  const salvo = escritorio.edicao?.camada === camada ? escritorio.edicao.itens : antiga ? null : guardada?.itens;
  if (salvo) return salvo;
  // A camada "geral" (de quem administra) é a Praça.
  if (camada === "geral") return escritorioMoveisDaCena(ESCRITORIO_PRACA);
  const a = escritorioAmbienteDoQuarto(camada);
  if (a?.cena) return escritorioMoveisDaCena(a);
  if(!a || camada.endsWith("-andar-1")) return [];
  return escritorioMoveisDaSala(a).map(([c, x, y, ...r]) => [c, x - a.x0, y - a.y0, ...r]);
}
// Móveis da cena atual: no mapa geral, só a camada geral (as salas são
// fachadas fechadas); dentro de um quarto, só a camada dele (coordenadas locais).
function escritorioMoveisAtuais() {
  const camada = escritorio.quarto || "geral";
  // A configuração do item (7º campo: cor do fundo colorido, troféu…) vai
  // junto da origem, para o mapa desenhar o que depende dela.
  return escritorioItensDaCamada(camada).map((it, i) => [...it.slice(0, 6), { camada, i, ...(it[6] && typeof it[6] === "object" && !Array.isArray(it[6]) ? { cfg: it[6] } : {}) }]);
}
function escritorioRaizQuarto(id) { return String(id || '').replace(/-andar-1$/,''); }
function escritorioPerfilDecoracao(id=escritorio.quarto || escritorioMinhaMesa()?.ambiente.id) {
  const raiz=escritorioRaizQuarto(id), dono=escritorio.base?.salas?.find(s=>s.id===raiz)?.pessoa_id;
  const perfil=String(dono)===String(escritorio.base?.eu) ? escritorio.perfil : escritorio.base?.equipe?.find(p=>String(p.id)===String(dono))?.perfil;
  return String(id).endsWith('-andar-1') ? perfil?.sala_andares?.find(a=>a.andar===1) : perfil;
}
function escritorioAlterarDecoracao(patch) {
  if(escritorio.quarto?.endsWith('-andar-1')) escritorio.perfil={...escritorio.perfil,sala_andares:[{...escritorioPerfilDecoracao(),...patch,andar:1}]};
  else escritorio.perfil={...escritorio.perfil,...patch};
}
// Opções do quarto do Habbo, do perfil para o ambiente: espessuras (2 elevado
// à escolha, −2 a 1) e altura fixa da parede (−1 = a padrão).
function escritorioOpcoesDoQuarto(perfil) {
  const esp = (v) => ([-2, -1, 0, 1].includes(Number(v)) && v !== "" && v != null ? Math.pow(2, Number(v)) : 1);
  const v = perfil?.sala_altura_parede, alt = v === "" || v == null ? -1 : Number(v);
  return { espessuraParede: esp(perfil?.sala_espessura_parede), espessuraPiso: esp(perfil?.sala_espessura_piso), alturaParedeFixa: Number.isInteger(alt) && alt >= 0 && alt <= 15 ? alt : -1 };
}
function escritorioPayloadDecoracao() { return {...escritorioPerfilDecoracao(), ...(escritorio.quarto?.endsWith('-andar-1') ? {andar:1} : {})}; }
function escritorioAmbienteDoQuarto(id = escritorio.quarto) {
  // Cena própria: o quarto de uma sala (sala-N, com o segundo andar) ou um
  // espaço comum que virou cena (Café, Lounge…).
  const comum=id && escritorioCenaComum(id);
  if(comum) return comum;
  const a=id && ESCRITORIO_PLANTA.ambientes.find(a=>a.id===escritorioRaizQuarto(id) && a.pessoal);
  if(!a || !String(id).endsWith('-andar-1')) return a || null;
  const perfil=escritorioPerfilDecoracao(id);
  if(!perfil?.quarto_configurado) return null;
  const r={...a,id,nome:a.nome+' · segundo andar',planta:perfil.sala_planta,piso:perfil.sala_piso || a.pisoPadrao,cor:perfil.sala_parede || a.corPadrao,luz:perfil.sala_luz || '',celdasLivres:escritorioCeldasDoPerfil(perfil.sala_celdas),semParedes:perfil.sala_sem_paredes===true,...escritorioOpcoesDoQuarto(perfil),porta:['baixo','direita'].includes(perfil.sala_porta) ? perfil.sala_porta : a.porta};
  const dim=escritorioDimQuarto(r);r.x1=r.x0+dim.w;r.y1=r.y0+dim.h;
  const L=ESCRITORIO_QUARTO_MAX,pisos=new Map(),paredes=new Map();
  const lp=escritorioPisosDoPerfil(perfil.sala_pisos), lw=escritorioParedesDoPerfil(perfil.sala_paredes);
  if(lp.length===L*L) for(let i=0;i<L*L;i++) {const k=ESCRITORIO_PISOS_SALA[parseInt(lp[i],16)]?.[0];if(k)pisos.set(`${i%L},${Math.floor(i/L)}`,k);}
  if(lw.length===L*12) for(let i=0;i<L*4;i++){const [estilo,c,h]=lw.slice(i*3,i*3+3);if(estilo!=='-')paredes.set(escritorioChaveTrecho(r,i),{estilo,cor:ESCRITORIO_PAREDES_SALA[parseInt(c,16)] || r.cor,alt:[46,82,118][Number(h)]});}
  r.pintura={pisos,paredes}; return r;
}
function escritorioAndaresHtml() {
  const id=escritorio.quarto;if(!id || escritorioCenaComum(id)) return '';
  const raiz=escritorioRaizQuarto(id), superior=escritorioPerfilDecoracao(raiz+'-andar-1');
  return `<nav class="ofc-andares" aria-label="Andares do escritório"><button type="button" aria-pressed="${id===raiz}" onclick="escritorioEntrarNoQuarto('${raiz}')">Térreo</button>${superior?.quarto_configurado ? `<button type="button" aria-pressed="${id!==raiz}" onclick="escritorioEntrarNoQuarto('${raiz}-andar-1')">Segundo andar</button>` : ''}${escritorioNoMeuQuarto() ? `<button type="button" onclick="personalizarEscritorio()">Gerenciar meu espaço</button>` : ''}</nav>`;
}
// Planta da cena atual para o renderizador: a sala (com a pintura do dono,
// lida na hora de desenhar) ou a Praça, a cena de abertura.
function escritorioPlantaDaCena() {
  const imagens = escritorio.base?.mapa?.imagens || [];
  const a = escritorioAmbienteDoQuarto();
  if (a) { const pq = escritorioPlantaDoQuarto(a); return { ...pq, moveis: [...escritorioMoveisAtuais(), ...pq.fixos], imagens,
    pisoLadrilho: (x, y) => a.pintura?.pisos.get(x + "," + y), paredeEm: (x, y, eixo) => a.pintura?.paredes.get(`${eixo}:${x},${y}`) }; }
  const pq = escritorioPlantaGeral();
  return { ...pq, moveis: [...escritorioMoveisAtuais(), ...pq.fixos], imagens };
}
// Nomes das salas individuais conforme o dono informado pelo servidor.
// Piso e cor das paredes que o dono escolheu (perfil); sem escolha, o padrão.
function escritorioAplicarSalas() {
  const donos = new Map((escritorio.base?.salas || []).map((s) => [s.id, s.pessoa_id]));
  for (const a of ESCRITORIO_PLANTA.ambientes) {
    if (!a.pessoal) continue;
    a.nome = escritorioNomeDaSala(a);
    a.pisoPadrao ??= a.piso;
    a.corPadrao ??= a.cor;
    const dono = donos.get(a.id);
    const perfil = String(dono) === String(escritorio.base?.eu) ? escritorio.perfil : escritorio.base?.equipe?.find((p) => String(p.id) === String(dono))?.perfil;
    a.planta = perfil?.sala_planta || "amplo";
    // O quarto tem o tamanho da planta escolhida (coordenadas locais).
    const dim = escritorioDimQuarto(a); a.x1 = a.x0 + dim.w; a.y1 = a.y0 + dim.h;
    a.piso = perfil?.sala_piso && ESCRITORIO_PLANTA.PISO[perfil.sala_piso] ? perfil.sala_piso : a.pisoPadrao;
    a.cor = /^#[0-9a-f]{6}$/i.test(perfil?.sala_parede || "") ? perfil.sala_parede : a.corPadrao;
    a.luz = ESCRITORIO_LUZES_SALA.some(([id]) => id === perfil?.sala_luz) ? perfil.sala_luz : "";
    a.celdasLivres = escritorioCeldasDoPerfil(perfil?.sala_celdas);
    a.semParedes = perfil?.sala_sem_paredes === true;
    Object.assign(a, escritorioOpcoesDoQuarto(perfil));
    // Lado da porta: o escolhido pelo dono ou o padrão da sala.
    a.portaPadrao ??= a.porta;
    a.porta = ["baixo", "direita"].includes(perfil?.sala_porta) ? perfil.sala_porta : a.portaPadrao;
  }
  // As fachadas do mapa geral ganham a cor escolhida pelo dono.
  for (const d of ESCRITORIO_PLANTA.divisorias) if (d.sala) d[4] = ESCRITORIO_PLANTA.ambientes.find((a) => a.id === d.sala)?.cor || d[4];
  // Ladrilhos e trechos de parede pintados por cada dono (perfil.sala_pisos e
  // perfil.sala_paredes), em coordenadas do quarto; o quarto consulta ao desenhar.
  for (const a of ESCRITORIO_PLANTA.ambientes) {
    if (!a.pessoal) continue;
    const pisos = new Map(), paredes = new Map();
    const dono = donos.get(a.id);
    const perfil = String(dono) === String(escritorio.base?.eu) ? escritorio.perfil : escritorio.base?.equipe?.find((p) => String(p.id) === String(dono))?.perfil;
    const lp = escritorioPisosDoPerfil(perfil?.sala_pisos), lw = escritorioParedesDoPerfil(perfil?.sala_paredes);
    // Pintura em grade de ESCRITORIO_QUARTO_MAX² (o maior quarto); cada planta usa o canto dela.
    const L = ESCRITORIO_QUARTO_MAX;
    if (lp.length === L * L) for (let i = 0; i < L * L; i++) {
      const k = typeof ESCRITORIO_PISOS_SALA !== "undefined" ? ESCRITORIO_PISOS_SALA[parseInt(lp[i], 16)]?.[0] : "";
      if (k) pisos.set(`${a.x0 + (i % L)},${a.y0 + Math.floor(i / L)}`, k);
    }
    if (lw.length === L * 12) for (let i = 0; i < L * 4; i++) {
      const [estilo, c, h] = lw.slice(i * 3, i * 3 + 3);
      if (estilo === "-") continue;
      const cor = typeof ESCRITORIO_PAREDES_SALA !== "undefined" ? ESCRITORIO_PAREDES_SALA[parseInt(c, 16)] : "";
      paredes.set(escritorioChaveTrecho(a, i), { estilo, cor: cor || a.cor, alt: [46, 82, 118][Number(h)] });
    }
    a.pintura = { pisos, paredes };
  }
}
// Ao chegar, a pessoa aparece dentro do próprio quarto (modo foco), logo
// depois da porta; sem sala, na Convivência.
function escritorioChegar() {
  const base = escritorio.base;
  escritorio.perfil = { ...(base.equipe.find((p) => p.id === base.eu)?.perfil || {}) };
  escritorioAplicarSalas();
  const a = escritorioMinhaMesa()?.ambiente || escritorioCenaComum("recepcao");
  escritorio.quarto = a.id;
  escritorioDefinirQuarto(escritorio.quarto);
  const lugar = escritorioEntradaDaSala(a);
  Object.assign(escritorio.perfil, escritorioParaPorcentagem(lugar.x, lugar.y));
  escritorio.sala = a.sala;
  escritorio.zona = a.id;
}
// A pessoa está na mesma cena que eu (a mesma sala, ou a Praça)? Na Praça
// a zona é vazia; quem está numa sala não aparece lá.
function escritorioNaCena(p) {
  if (!p || String(p.id) === String(escritorio.base?.eu)) return true;
  const z = String(p.zona || "");
  return escritorio.quarto ? z === escritorio.quarto : !/^sala-/.test(z) && !escritorioCenaComum(z);
}
function escritorioNoMeuQuarto() {
  const mesa = escritorioMinhaMesa();
  return Boolean(mesa && escritorioRaizQuarto(escritorio.quarto) === escritorioRaizQuarto(mesa.ambiente.id));
}
// Entra no quarto de uma sala (a cena troca; a pessoa aparece logo depois da
// porta). Sala trancada: só quem foi deixado entrar.
function escritorioEntrarNoQuarto(id) {
  const a = escritorioAmbienteDoQuarto(id);
  if (!a || escritorio.quarto === id) return false;
  if (escritorioZonaBloqueada(id) || escritorioZonaBloqueada(escritorioRaizQuarto(id))) { avisarTrancadaEscritorio(id, true); return false; }
  if(escritorio.edicao) {escritorioAviso("Salve ou cancele a decoração antes de trocar de andar.");return false;}
  const e = escritorioEntradaDaSala(a);
  escritorioTrocarCena(id, e, a.porta === "direita" ? 6 : 0);
  return true;
}
// Sai pela porta: das salas para a Convivência; da Convivência para a
// Praça; da Praça de volta para a Convivência (escritorioDestinoDaPorta).
function escritorioSairDoQuarto() {
  if (escritorio.edicao) { escritorioAviso("Salve ou cancele a decoração antes de sair."); return false; }
  const destino = escritorioDestinoDaPorta(escritorio.quarto);
  escritorioTrocarCena(destino.praca ? null : destino.id, escritorioEntradaDaSala(destino), destino.porta === "direita" ? 6 : 0);
  return true;
}
// Vai direto para a Praça (cena de abertura), de onde estiver.
function escritorioIrParaPraca() {
  if (!escritorio.quarto) return false;
  if (escritorio.edicao) { escritorioAviso("Salve ou cancele a decoração antes de sair."); return false; }
  escritorioTrocarCena(null, escritorioEntradaDaSala(ESCRITORIO_PRACA), 0);
  return true;
}
// Troca a cena (mapa geral ↔ quarto) e põe a pessoa no ladrilho dado. O mapa
// é recriado (os modelos dos móveis vêm do cache); zona, chat e voz seguem o
// lugar novo; a presença vai na hora para a equipe.
function escritorioTrocarCena(quarto, lugar, dir) {
  movimento.rota = [];
  escritorioPararTeclado();
  escritorio.seguindoId = null;
  escritorio.usarAoChegar = null;
  clearInterval(escritorio.timerSeguir);
  if (escritorio.pose && !ESCRITORIO_MAO[escritorio.pose]) definirPoseEscritorio("");
  escritorio.quarto = quarto;
  escritorioDefinirQuarto(quarto);
  movimento.x = lugar.x; movimento.y = lugar.y;
  if (dir != null) movimento.dir = dir;
  escritorio.perfil = { ...escritorio.perfil, ...escritorioParaPorcentagem(lugar.x, lugar.y) };
  if (escritorio.mapa) { escritorio.mapa.destruir(); escritorio.mapa = null; }
  // Zona e sala de conversa do lugar novo (antes de montar o mapa, que marca a zona).
  escritorioMudouLugar(lugar.x, lugar.y, true);
  renderEscritorio();
  escritorioEnviarPosicao(true);
  const depois = escritorio.aoChegarNaCena;
  escritorio.aoChegarNaCena = null;
  escritorio.mapa?.prontos.then(() => { escritorioAtualizarPortas(); escritorioAcenderReguladores(); atualizarAcaoProximaEscritorio(true); if (typeof gatilhoEntradaEscritorio === "function") gatilhoEntradaEscritorio(); depois?.(); });
  // Entrou ou saiu do Lounge: a música toca ou para na hora.
  const naPista = typeof escritorioNaPista === "function" && escritorioNaPista();
  if (naPista !== Boolean(escritorio.naPista)) { escritorio.naPista = naPista; sincronizarMusicaEscritorio(); }
}
function escritorioMinhaMesa() {
  let a = escritorioDonos().get(escritorio.base?.eu);
  if(a && escritorio.quarto?.endsWith("-andar-1") && escritorioRaizQuarto(escritorio.quarto)===a.id) a=escritorioAmbienteDoQuarto();
  if(!a) return null;
  if(escritorio.perfil?.quarto_configurado) {
    const itens=escritorioItensDaCamada(a.id);
    const computador=itens.find(it=>/computer|laptop/.test(it[0]));
    const cadeira=itens.find(it=>/chair|stool|seat|hc26_10|sofa/.test(it[0]));
    if(computador) return {ambiente:a,x:computador[1],y:computador[2],w:1,h:1,cadeira:cadeira?{x:cadeira[1],y:cadeira[2],dir:cadeira[3]}:escritorioEntradaDaSala(a)};
  }
  return { ambiente:a, ...escritorioMesaDaSala(a) };
}
// Nome do lugar onde a pessoa está, pela zona da presença: a sala (quarto,
// espaço comum) ou, sem zona, a Praça. Sem presença (o próprio perfil),
// vale a zona desta tela.
function escritorioLugarDe(p) {
  const eu = !p || p === escritorio.perfil || p.id === undefined || String(p.id) === String(escritorio.base?.eu);
  const zona = eu ? escritorio.zona : String(p.zona || "");
  return (zona && escritorioAmbienteDoQuarto(zona)) || ESCRITORIO_PRACA;
}
// "Ir" ao lado de alguém: anda até um ladrilho livre ao lado da pessoa. Em
// outra cena (ela num quarto, ou eu num quarto e ela fora), vai primeiro até
// lá e continua ao chegar.
function escritorioIrAte(id) {
  const o = escritorio.online.find((p) => p.id === id);
  if (!o || !escritorio.mapa) return;
  if (!escritorioNaCena(o)) {
    const zona = String(o.zona || "");
    escritorio.aoChegarNaCena = () => escritorioIrAte(id);
    escritorioIrParaAmbiente(zona || "praca");
    return;
  }
  const alvo = escritorioPosicao(o), de = escritorioPosicao(escritorio.perfil || {});
  const x0 = Math.round(alvo.x), y0 = Math.round(alvo.y);
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    if (escritorio.mapa.assentoEm(x0 + dx, y0 + dy) !== undefined) continue;
    if (escritorio.mapa.caminho(de, { x: x0 + dx, y: y0 + dy }, escritorioEvitarNoCaminho)) { escritorioIrPara(x0 + dx, y0 + dy); movimento.turbo = true; return; }
  }
  escritorioAviso("Não achei caminho até " + o.nome + ".");
}
// Vai para um lugar (sala, espaço comum ou a Praça): troca de cena direto,
// como o navegador de quartos do Habbo. Sala trancada: avisa e oferece bater.
function escritorioIrParaAmbiente(id, manterLista = false) {
  if (!escritorio.mapa) return;
  if (escritorio.modo === "lista" && !manterLista) { escritorio.modo = "mapa"; renderEscritorio(); }
  if (id === "praca") { escritorioIrParaPraca(); return; }
  const a = escritorioAmbienteDoQuarto(id);
  if (!a || a.id === escritorio.quarto) return;
  escritorioEntrarNoQuarto(a.id);
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
  // Conectado, só quem está na mesma cena (o mapa geral ou este quarto).
  const visiveis = escritorio.conectado
    ? pessoas.filter(escritorioNaCena)
    : [{ id: eu, nome: escritorio.base?.equipe?.find((p) => p.id === eu)?.nome || "Você", perfil: escritorio.perfil, sala, status: "ausente", x: escritorio.perfil.x || 50, y: escritorio.perfil.y || 75 }];
  if (escritorio.mapa) {
    const quarto = escritorioAmbienteDoQuarto();
    escritorio.mapa.atualizarPessoas(visiveis.map((p) => {
      const voce = p.id === eu;
      // O próprio boneco é guiado localmente (movimento contínuo); o servidor
      // só repete o que este navegador mandou. Dentro do quarto, quem chegou
      // com uma posição de fora dele (versão antiga) fica encostado na borda.
      const pos = voce ? escritorioPosicao(escritorio.perfil || {}) : escritorioPosicao(p);
      if (quarto && !voce) { pos.x = Math.max(quarto.x0, Math.min(quarto.x1 - 1, pos.x)); pos.y = Math.max(quarto.y0, Math.min(quarto.y1 - 1, pos.y)); }
      const perfilDe = escritorio.base.equipe.find((e) => e.id === p.id)?.perfil || p.perfil || {};
      // Parado num assento (cadeira, sofá, banqueta…), o boneco senta virado
      // para onde o assento olha.
      const dirAssento = escritorio.mapa.assentoEm(pos.x, pos.y);
      const sentado = dirAssento !== undefined;
      // Na cama, deita virado para onde a cama aponta (como no Habbo).
      const dirCama = sentado ? undefined : escritorio.mapa.camaEm?.(pos.x, pos.y);
      const [nomeStatus, corStatus] = ESCRITORIO_STATUS[p.status] || ESCRITORIO_STATUS.disponivel;
      return {
        // O próprio boneco é sempre "Você" (fora do escritório também: o nome
        // completo passava pelo encurtador e virava "Você E.").
        id: p.id, nome: voce ? "Você" : escritorioNomeCurto(p.nome), perfil: perfilDe, status: p.status, corStatus,
        rotulo: `${p.nome}${voce ? " (você)" : ""} · ${voce && !escritorio.conectado ? "fora do escritório" : nomeStatus}`,
        statusTexto: p.status && p.status !== "disponivel" ? nomeStatus : "",
        x: Math.round(pos.x), y: Math.round(pos.y),
        acao: escritorioAcaoDaPose(voce ? escritorio.pose : p.pose, sentado, dirCama !== undefined && !(voce && escritorio.emMovimento)),
        mao: ESCRITORIO_MAO[voce ? escritorio.pose : p.pose] || "",
        dir: sentado ? dirAssento : dirCama !== undefined ? dirCama : ESCRITORIO_APARELHOS[voce ? escritorio.pose : p.pose] ? escritorioNoAparelho(Math.round(pos.x), Math.round(pos.y))?.dir : undefined, local: voce,
        aoClicar: (id) => abrirMenuPessoaEscritorio(id),
      };
    }));
  }
  // As listas laterais só mudam quando alguém troca de lugar, status ou
  // entra/sai; a presença chega a cada passo, então refazê-las sempre
  // (com as imagens dos bonecos) travava o painel com a equipe andando.
  const assinatura = JSON.stringify([escritorio.conectado, escritorioLugarDe(escritorio.perfil).id, escritorio.recadosResumo || {}, (escritorio.base?.equipe || []).length, escritorio.musica?.tocando ? [escritorio.musica.indice, escritorio.musica.fila?.length] : 0, pessoas.map((p) => [p.id, p.zona, p.status, p.nome])]);
  const mudou = (el) => el && el.dataset.assinatura !== assinatura && (el.dataset.assinatura = assinatura, true);
  const lista = document.getElementById("office-roster");
  if (mudou(lista)) {
    const online = escritorio.base.equipe.filter((p) => pessoas.some((o) => o.id === p.id));
    const fora = escritorio.base.equipe.filter((p) => !pessoas.some((o) => o.id === p.id));
    const linha = (p) => {
      const o = pessoas.find((x) => x.id === p.id);
      return `<li class="office-member${o ? "" : " fora"}">${escritorioAvatar(p.perfil, p.nome)}<div><b>${safeText(p.nome)}${p.id === eu ? " · você" : ""}</b><small>${o ? `${escritorioStatusHtml(o.status)} · ${safeText(escritorioLugarDe(o).nome)}` : "Fora do escritório"}</small></div>${o && p.id !== eu ? `<button type="button" class="ofc-mini" onclick="chamarParaSalaEscritorio('${safeText(o.id)}')" title="Chamar para a sala onde você está">Chamar</button><button type="button" class="ofc-mini" onclick="escritorioIrAte('${safeText(o.id)}')">Ir</button><button type="button" class="ofc-mini" onclick="seguirPessoaEscritorio('${safeText(o.id)}')">Seguir</button>` : ""}${p.id !== eu ? `<button type="button" class="ofc-mini" onclick="abrirRecadosEscritorio('${safeText(p.id)}')" aria-label="Recado para ${safeText(p.nome)}">Recado${escritorio.recadosResumo?.[p.id] ? ` · ${escritorio.recadosResumo[p.id]}` : ""}</button>` : ""}</li>`;
    };
    lista.innerHTML = `<h4>Online agora · ${online.length}</h4><ul>${online.map(linha).join("") || '<li class="ofc-vazio">Ninguém conectado ainda.</li>'}</ul><h4>Fora do escritório · ${fora.length}</h4><ul>${fora.map(linha).join("")}</ul>`;
  }
  const salas = document.getElementById("office-rooms");
  if (mudou(salas)) {
    const meu = escritorioLugarDe(escritorio.perfil).id;
    const contar = (id) => pessoas.filter((p) => escritorioLugarDe(p).id === id).length;
    // Cada linha diz quem está na sala (não só quantos); assim o cartão
    // flutuante "Quem está onde" pode ficar recolhido sem esconder nada.
    const linha = (a) => {
      const aqui = pessoas.filter((p) => escritorioLugarDe(p).id === a.id);
      const nomes = aqui.map((p) => (String(p.id) === String(eu) ? "você" : escritorioNomeCurto(p.nome))).join(", ");
      return `<button type="button" class="ofc-sala${aqui.length ? " ocupada" : ""}" aria-pressed="${a.id === meu}" style="--sala:${ESCRITORIO_COR_SALA[a.sala] || a.cor || "#8a93a3"}" onclick="escritorioIrParaAmbiente('${a.id}')"><i></i><span>${safeText(a.nome)}</span>${aqui.length ? `<small>${aqui.length}</small><em>${safeText(nomes)}</em>` : ""}</button>`;
    };
    const A = ESCRITORIO_PLANTA.ambientes;
    // Espaços comuns primeiro (onde a equipe se encontra), Praça no topo por
    // ser a entrada; quartos individuais em grupo recolhível.
    const pessoais = A.filter((a) => a.pessoal), ocupados = pessoais.filter((a) => contar(a.id)).length;
    salas.innerHTML = `<h5>Espaços</h5>${[ESCRITORIO_PRACA, ...A.filter((a) => !a.pessoal)].map(linha).join("")}<details class="ofc-salas-grupo" ${escritorio.quartosFechados ? "" : "open"} ontoggle="escritorio.quartosFechados=!this.open"><summary><h5>Salas individuais</h5><small>${ocupados ? `${ocupados} com gente` : "vazias"}</small></summary>${pessoais.map(linha).join("")}</details>`;
  }
  escritorioAtualizarPortas();
  const onde = document.getElementById("office-onde");
  if (mudou(onde)) onde.innerHTML = escritorioOndeHtml();
  const lote = document.getElementById("office-lista-salas");
  if (mudou(lote)) lote.innerHTML = escritorioListaSalasHtml();
  const lugar = document.getElementById("office-lugar");
  if (lugar) lugar.textContent = escritorioLugarDe(escritorio.perfil).nome;
  const contador = document.getElementById("office-online");
  if (contador) contador.textContent = escritorio.conectado ? `${pessoas.length} online` : "Você está fora";
  atualizarDockEscritorio();
}
// "Quem está onde": cartão sempre à vista (no mapa e dentro dos quartos) com
// cada lugar ocupado e os nomes de quem está nele; clicar vai até lá.
function escritorioOndeHtml() {
  if (!escritorio.conectado) return '<p class="ofc-onde-nota">Entre no escritório para ver quem está onde.</p>';
  const eu = escritorio.base?.eu, pessoas = escritorio.online || [];
  const grupos = new Map();
  for (const p of pessoas) {
    const l = escritorioLugarDe(p);
    if (!grupos.has(l.id)) grupos.set(l.id, { id: l.id, nome: l.nome, cor: l.cor || ESCRITORIO_COR_SALA[l.sala] || "#8a93a3", pessoas: [] });
    grupos.get(l.id).pessoas.push(p);
  }
  const meu = escritorioLugarDe(escritorio.perfil).id;
  const linhas = [...grupos.values()].sort((a, b) => (a.id === meu ? -1 : b.id === meu ? 1 : b.pessoas.length - a.pessoas.length)).map((g) => {
    const nomes = g.pessoas.map((p) => (p.id === eu ? "você" : escritorioNomeCurto(p.nome))).join(", ");
    const ir = ESCRITORIO_PLANTA.ambientes.some((a) => a.id === g.id) && g.id !== meu;
    return `<li><button type="button" class="ofc-onde-lugar" style="--sala:${g.cor}" ${ir ? `onclick="escritorioIrParaAmbiente('${g.id}')" title="Ir para ${safeText(g.nome)}"` : "disabled"}><i></i><b>${safeText(g.nome)}</b><span>${safeText(nomes)}</span></button></li>`;
  });
  const fora = (escritorio.base?.equipe || []).filter((p) => !pessoas.some((o) => o.id === p.id)).length;
  return `<ul>${linhas.join("")}</ul>${fora ? `<p class="ofc-onde-nota">Fora do escritório · ${fora}</p>` : ""}`;
}
// Modo lista (o do celular): os mesmos lugares do mapa, com quem está em cada
// um. Ir para um lugar anda até lá sem sair da lista, e a conversa da sala
// entra sozinha como no mapa. Lugares vazios ficam numa linha compacta.
function escritorioListaSalasHtml() {
  const pessoas = escritorio.conectado ? escritorio.online : [];
  const meu = escritorioLugarDe(escritorio.perfil).id;
  const m = escritorio.musica, tocando = m?.tocando && m.fila?.[m.indice];
  const musica = tocando ? `<article class="ofc-cartao ofc-cartao-musica" style="--sala:#b48cff"><div class="ofc-cartao-topo"><i></i><h3>Música no Lounge</h3><small>${m.fila.length} na fila</small></div><p class="ofc-nota">De ${safeText(String(tocando.por || "").split(" ")[0])}. Quem está no Lounge ouve junto.</p><button type="button" class="ofc-mini" onclick="irParaMusicaEscritorio()">${escritorioNaPista() ? "Você está ouvindo" : "Ir ouvir"}</button></article>` : "";
  const cartao = (a) => {
    const aqui = pessoas.filter((p) => escritorioLugarDe(p).id === a.id);
    return `<article class="ofc-cartao" style="--sala:${a.cor || ESCRITORIO_COR_SALA[a.sala]}"><div class="ofc-cartao-topo"><i></i><h3>${safeText(a.nome)}</h3><small>${aqui.length} ${aqui.length === 1 ? "pessoa" : "pessoas"}</small></div><ul>${aqui.map((p) => `<li>${escritorioAvatar(p.perfil, p.nome)}<span><b>${safeText(p.nome)}</b><small>${escritorioStatusHtml(p.status)}</small></span></li>`).join("")}</ul><button type="button" class="ofc-mini" onclick="escritorioIrParaAmbiente('${a.id}',true)" ${a.id === meu ? "disabled" : ""}>${a.id === meu ? "Você está aqui" : "Ir para cá"}</button></article>`;
  };
  const A = [...ESCRITORIO_PLANTA.ambientes, ESCRITORIO_PRACA];
  const comGente = A.filter((a) => a.id === meu || pessoas.some((p) => escritorioLugarDe(p).id === a.id));
  const vazios = A.filter((a) => !comGente.includes(a));
  return `${musica}${comGente.map(cartao).join("")}<section class="ofc-vazios"><h4>Outros lugares</h4><div>${vazios.map((a) => `<button type="button" class="ofc-mini" style="--sala:${a.cor || ESCRITORIO_COR_SALA[a.sala]}" onclick="escritorioIrParaAmbiente('${a.id}',true)">${safeText(a.nome)}</button>`).join("")}</div></section>`;
}
// Botões do dock dentro do escritório: o que muda com conexão e chamada.
function atualizarControlesEscritorio() {
  const el = document.getElementById("office-controls");
  if (!el) return;
  if (typeof atualizarBarraDiaEscritorio === "function") atualizarBarraDiaEscritorio();
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
      `<span class="ofc-voz-estado" role="status">${escritorioIcone("fone")}<span>${escritorioEstadoVozTexto()}</span></span>`
    // A conversa é automática: sem botão de entrar. Mostra a etapa e, se
    // falhou, o motivo com "Tentar agora" (ela também tenta sozinha).
    : !escritorio.conectado || (!escritorioCanal() && !escritorio.entrandoChamada && !escritorio.falhaConversa)
      ? `<span class="ofc-voz-estado">${escritorioIcone("fone")}<span>${escritorioEstadoVozTexto()}</span></span>`
      : escritorio.falhaConversa && !escritorio.entrandoChamada
        ? botao("escritorio.falhaConversa='';escritorio.tentativasVoz=0;escritorioConversaAutomatica()", "fone", "Voz não conectou · tentar agora", `title="${safeText(escritorio.falhaConversa)} (tentando de novo sozinho)"`, { texto: true, classe: "perigo" })
        : `<span class="ofc-voz-estado" role="status">${escritorioIcone("fone")}<span>Conectando a voz${escritorio.etapaVoz ? ": " + safeText(escritorio.etapaVoz) : ""}…</span></span>`;
  el.innerHTML = `<button type="button" class="ofc-dock-btn ofc-eu" onclick="abrirFichaEscritorio(escritorio.base.eu)" aria-label="Sua ficha e personagem" title="Sua ficha e personagem">${escritorioAvatar(escritorio.perfil, "você")}</button><span class="ofc-sep"></span><label class="ofc-status">${escritorioStatusHtml(escritorio.conectado ? escritorio.status : "ausente")}<select aria-label="Sua disponibilidade" ${escritorio.conectado ? "" : "disabled"} onchange="escritorio.status=this.value;escritorioEmitir('presence:status',{status:this.value});atualizarControlesEscritorio()">${Object.entries(ESCRITORIO_STATUS).map(([id, [nome]]) => `<option value="${id}" ${escritorio.status === id ? "selected" : ""}>${nome}</option>`).join("")}</select></label><span class="ofc-sep"></span>${conversa}${escritorio.conectado ? `<details class="ofc-reacoes" id="office-reacoes"><summary class="ofc-dock-btn" aria-label="Reagir" title="Reagir">${escritorioIcone("reagir")}</summary><div>${Object.entries(ESCRITORIO_REACOES).map(([t, e]) => `<button type="button" onclick="reagirEscritorio('${t}')" aria-label="Reagir com ${t}">${e}</button>`).join("")}</div></details>` : ""}${(() => {
    // "Mais": o que se usa de vez em quando fica num menu só, para a barra
    // caber numa linha.
    const item = (acao, rotulo, extra = "") => `<button type="button" onclick="${acao};this.closest('details').open=false" ${extra}>${rotulo}</button>`;
    const tranca = escritorioPodeTrancar() ? item("trancarZonaEscritorio()", escritorio.trancas?.has(escritorio.zona) ? "Destrancar a sala" : "Trancar a sala", `aria-pressed="${Boolean(escritorio.trancas?.has(escritorio.zona))}"`) : "";
    const poses = escritorio.conectado ? `<span class="ofc-mais-titulo">Seu boneco</span>${item("definirPoseEscritorio(escritorio.pose==='acenar'?'':'acenar')", "Acenar <kbd>1</kbd>")}${item("deitarEscritorio()", "Deitar <kbd>2</kbd>")}${item("definirPoseEscritorio(escritorio.pose==='cafe'?'':'cafe')", "Café na mão <kbd>3</kbd>")}${item("sentarNoChaoEscritorio()", (escritorio.noChao ? "Levantar" : "Sentar no chão") + " <kbd>4</kbd>")}<span class="ofc-mais-titulo">Rosto</span>${item("expressaoEscritorio('triste')", "Triste <kbd>5</kbd>")}${item("expressaoEscritorio('surpreso')", "Surpreso <kbd>6</kbd>")}${item("expressaoEscritorio('bravo')", "Bravo <kbd>7</kbd>")}<span class="ofc-mais-titulo">Placa</span>${item("placaEscritorio('coracao')", "Coração <kbd>8</kbd>")}${item("placaEscritorio('exclamacao')", "Exclamação <kbd>9</kbd>")}${item("placaEscritorio('sorriso')", "Sorriso")}${["um", "dois", "tres"].map((n, i) => item(`placaEscritorio('${n}')`, "Número " + (i + 1))).join("")}${escritorio.quarto ? `<span class="ofc-mais-titulo">Sala</span>${item("abrirNovoPostitEscritorio()", "Colar post-it na parede")}` : ""}` : "";
    return `<details class="ofc-reacoes ofc-mais" id="office-mais"><summary class="ofc-dock-btn" aria-label="Mais opções" title="Mais opções">${escritorioIcone("mais")}</summary><div class="ofc-poses">${poses}<span class="ofc-mais-titulo">Escritório</span>${item("irParaMinhaMesaEscritorio()", "Ir para minha mesa", escritorioMinhaMesa() ? "" : "disabled")}${tranca}${item("alternarSomEscritorio()", escritorioSomLigado() ? "Desligar sons do escritório" : "Ligar sons do escritório")}${item("abrirAjustesAudioEscritorio()", "Ajustes de áudio")}</div></details>`;
  })()}<span class="ofc-sep"></span>${botao("abrirPainelDoEscritorio()", "painel", escritorio.avisosNovos ? `Painel · ${escritorio.avisosNovos} ${escritorio.avisosNovos === 1 ? "novo" : "novos"}` : "Painel", `id="ofc-btn-painel"${escritorio.avisosNovos ? ' data-avisos="true"' : ""}${escritorio.avisos ? ` title="${escritorio.avisos} ${escritorio.avisos === 1 ? "aviso não lido" : "avisos não lidos"} no Painel"` : ""}`, { texto: true })}<span class="ofc-sep"></span>${escritorio.conectado ? botao("desconectarEscritorio()", "sair", "Sair do escritório", "", { classe: "perigo" }) : botao("conectarEscritorio()", "entrar", escritorio.conectando ? "Entrando…" : "Entrar", escritorio.conectando ? "disabled" : "", { texto: true })}`;
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
  // A entrada também aparece enquanto conecta (inclusive vindo da abertura),
  // com as etapas e o erro no próprio cartão.
  const lobby = (!escritorio.conectado && (!escritorio.lobbyFechado || escritorio.entrada)) || escritorio.carregandoMapa;
  painel.innerHTML = `<section class="ofc" data-modo="${modo}" data-lateral="${lateral}" data-editando="${Boolean(escritorio.edicao)}">
<nav class="ofc-rail" aria-label="Escritório">
 <img class="ofc-logo" src="${safeText(document.querySelector(".logo img")?.getAttribute("src") || "/assets/vybe-branca.png")}" alt="Vybe">
 ${rail("mapa", "mapa", "Mapa", "alternarModoEscritorio('mapa')", modo === "mapa")}
 ${rail("lista", "lista", "Salas", "alternarModoEscritorio('lista')", modo === "lista")}
 ${rail("pessoas", "pessoas", "Pessoas", "alternarAbaEscritorio('pessoas')", lateral && aba === "pessoas")}
 ${rail("conversa", "conversa", "Conversa", "alternarAbaEscritorio('conversa')", lateral && aba === "conversa")}
 ${rail("clientes", "clientes", "Clientes", "alternarAbaEscritorio('clientes')", lateral && aba === "clientes")}
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
 <section class="office-chat ofc-aba" ${aba === "conversa" ? "" : "hidden"}><div class="office-chat-head"><div><h3 id="office-chat-titulo">${safeText(escritorioTituloChat(sala))}</h3><small id="office-chat-nota" class="ofc-nota">${safeText(escritorioNotaChat(sala))}</small></div><button class="office-text-button" onclick="carregarChatEscritorio()">Atualizar</button></div><div id="office-chat-list" role="log" aria-live="polite">Carregando mensagens…</div><form onsubmit="event.preventDefault();enviarChatEscritorio(this)"><input aria-label="Mensagem para este chat" id="office-message" name="texto" oninput="delete this.form.dataset.chave;escritorioDigitando(Boolean(this.value))" onblur="escritorioDigitando(false)" maxlength="2000" placeholder="Mensagem para ${safeText(ESCRITORIO_SALAS[sala] || "Convivência")}" required autocomplete="off"><button class="workflow-primary">Enviar</button></form></section>
 <section class="office-chat ofc-aba ofc-recados" id="office-recados" ${aba === "recados" ? "" : "hidden"}>${escritorioRecadosHtml()}</section>
 <section class="ofc-aba ofc-clientes" id="office-clientes" ${aba === "clientes" ? "" : "hidden"}>${escritorioClientesHtml()}</section>
</aside>
<main class="ofc-principal">
 <div class="ofc-topo"><div class="ofc-topo-esq">${`<button type="button" class="ofc-voltar-mapa" onclick="escritorioSairDoQuarto()" title="Sair pela porta">${escritorioIcone("voltar")}<span>${safeText(escritorioDestinoDaPorta(escritorio.quarto).nome)}</span></button>`}${escritorioAndaresHtml()}<div class="ofc-sala-atual" style="--sala:${escritorioAmbienteDoQuarto()?.cor || ESCRITORIO_COR_SALA[sala]}"><i></i><h2 id="office-lugar">${safeText(escritorioLugarDe(escritorio.perfil).nome)}</h2><span id="office-lugar-dica"></span></div></div><p id="office-feedback" class="ofc-aviso" role="status">${safeText(b.demo ? "Demonstração local: presença e chamadas não se conectam." : b.aviso || "")}</p></div>
 <details class="ofc-onde" ${escritorio.ondeFechado === false ? "open" : ""} ontoggle="escritorio.ondeFechado=!this.open" ${modo === "mapa" ? "" : "hidden"}><summary>${escritorioIcone("pessoas")}<span>Quem está onde</span></summary><div id="office-onde"></div></details>
 <div id="office-map-lugar" ${modo === "mapa" ? "" : "hidden"}></div>
 <div id="office-mesa-card" class="ofc-mesa-card" role="dialog" aria-label="Sua mesa" hidden onmouseleave="this.hidden=true"></div>
 <div id="office-movel-card" class="ofc-mesa-card ofc-ficha-movel" role="dialog" aria-label="Selecionado" hidden></div>
 <div id="office-menu-pessoa" class="ofc-menu-pessoa" role="menu" aria-label="Ações" hidden></div>
 <div id="office-info-card" class="ofc-mesa-card ofc-info-card" role="status" hidden onmouseleave="this.hidden=true"></div>
 <div class="ofc-zoom" ${modo === "mapa" ? "" : "hidden"}><button type="button" onclick="escritorio.mapa?.mudarZoom(1.25)" aria-label="Aproximar">+</button><button type="button" onclick="escritorio.mapa?.mudarZoom(0.8)" aria-label="Afastar">−</button><button type="button" onclick="centralizarEmMimEscritorio()" aria-label="Centralizar em mim" title="Centralizar em mim">${escritorioIcone("alvo")}</button></div>
 <div class="ofc-lista" id="office-lista-salas" ${modo === "lista" ? "" : "hidden"}></div>
 <div class="ofc-coluna" id="office-coluna">
 <section id="office-call" class="office-call${escritorio.callAberta ? " aberta" : ""}" ${escritorio.chamada ? "" : "hidden"} aria-label="Conversa por voz"><button type="button" class="office-call-actions" aria-expanded="${Boolean(escritorio.callAberta)}" onclick="escritorio.callAberta=!escritorio.callAberta;this.parentElement.classList.toggle('aberta',escritorio.callAberta);this.setAttribute('aria-expanded',escritorio.callAberta)"><b id="office-call-titulo">${safeText(escritorioTituloChamada())}</b><span id="office-call-rostos" class="office-call-rostos"></span><i class="office-call-seta" aria-hidden="true"></i></button><div id="office-call-media" class="office-call-media"></div></section>
 <div id="office-musica-lugar"></div>
 </div>
 <div class="ofc-editor" id="office-editor" role="toolbar" aria-label="Editor do mapa" hidden></div>
 <div class="ofc-acao" id="office-acao" hidden></div>
 <div class="ofc-avisos" id="office-avisos" aria-live="polite"></div>
 <div class="ofc-dock" id="office-controls" role="toolbar" aria-label="Controles do escritório"></div>
 ${lobby ? `<div class="ofc-lobby" role="dialog" aria-modal="false" aria-labelledby="ofc-lobby-titulo">${typeof vybelandiaCenaHtml === "function" ? vybelandiaCenaHtml() : ""}<div class="abr-vinheta" aria-hidden="true"></div><div class="ofc-lobby-cartao"><div class="ofc-lobby-avatar">${escritorioAvatar(perfil, eu?.nome || "Você")}</div><h2 id="ofc-lobby-titulo">Olá, ${safeText((eu?.nome || "").split(" ")[0] || "equipe")}</h2><p>Ao entrar, a equipe vê você no escritório. Em cada sala você entra na conversa dela com o microfone ligado; a câmera começa desligada.</p>${escritorio.entrada ? escritorioEntradaHtml() : `<div class="ofc-lobby-acoes"><button id="office-connect" type="button" class="ofc-primario" onclick="${b.demo ? "escritorio.lobbyFechado=true;renderEscritorio()" : "conectarEscritorio()"}">${b.demo ? "Ver o escritório" : "Entrar no escritório"}</button><button type="button" class="ofc-secundario" onclick="personalizarEscritorio()">Personalizar</button></div>`}</div></div>` : ""}
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
  if (escritorio.edicao && typeof desenharCatalogoEscritorio === "function") desenharCatalogoEscritorio();
  // A música fica fora do redesenho: recriar o player cortaria a música.
  const lugarMusica = document.getElementById("office-musica-lugar");
  if (lugarMusica) {
    const musica = escritorioElementoMusica();
    // Solto (a pessoa arrastou): fica por cima do mapa; senão, na coluna da direita.
    if (musica.classList.contains("solto")) { lugarMusica.remove(); document.querySelector(".ofc-principal")?.append(musica); }
    else lugarMusica.replaceWith(musica);
  }
  if (!escritorio.mapa) {
    const planta = escritorioPlantaDaCena();
    escritorio.mapa = criarMapaEscritorio(el, {
      planta,
      eu: escritorio.base.eu,
      aoClicar: (x, y, objeto) => cliqueNoMapaEscritorio(x, y, objeto),
      aoDuploClique: (x, y, objeto) => alternarComDuploCliqueEscritorio(x, y, objeto),
      aoPassar: (x, y, cx, cy) => passarNoMapaEscritorio(x, y, cx, cy),
      aoPegar: (x, y, fx, fy) => typeof pegarNoEditorEscritorio === "function" && pegarNoEditorEscritorio(x, y, fx, fy),
      aoArrastar: (x, y, fx, fy) => arrastarNoEditorEscritorio(x, y, fx, fy),
      aoSoltar: (x, y, moveu) => soltarNoEditorEscritorio(x, y, moveu),
      aoCancelar: () => cancelarArrastoEditorEscritorio(),
      aoClicarSaida: () => planta.saida && escritorioIrPara(planta.saida.x, planta.saida.y),
    });
    // A cena cabe inteira na tela, como um quarto do Habbo.
    requestAnimationFrame(() => escritorio.mapa?.enquadrarQuarto());
    // Se a posição salva ficou presa (móvel em volta), sai pelo ladrilho livre
    // mais perto que tenha caminho até a recepção.
    escritorio.mapa.prontos.then(() => { escritorioDestravar(); escritorioMarcarRecados(); escritorioAtualizarPortas(); escritorioAcenderReguladores(); carregarPostitsEscritorio(); });
    if (escritorio.estadosMoveis) escritorio.mapa.estadosMoveis(escritorio.estadosMoveis);
    escritorio.mapa.prontos.then(() => { if (typeof notificacoes !== "undefined") escritorioAvisos(notificacoes); });
    // Cópia do próprio boneco no nosso banco, para quando o Habbo estiver fora.
    if (!escritorio.base.demo) setTimeout(() => mapaGuardarBoneco(mapaFigura(escritorio.perfil)), 4000);
  }
  atualizarPessoasEscritorio();
  escritorioMedirDock();
}
// A altura da barra de baixo vira variável de CSS (o botão de ação e a barra
// do dia ficam logo acima dela, mesmo quando ela quebra em linhas no celular).
function escritorioMedirDock() {
  const dock = document.querySelector(".ofc-dock"), ofc = document.querySelector(".ofc");
  if (!dock || !ofc || typeof ResizeObserver === "undefined") return;
  if (escritorio.dockObservado === dock) return;
  escritorio.dockObservado = dock;
  new ResizeObserver(() => ofc.style.setProperty("--altura-dock", dock.offsetHeight + "px")).observe(dock);
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
  if (aba === "clientes") carregarClientesEscritorio();
}
function alternarModoEscritorio(modo) {
  escritorio.modo = modo;
  renderEscritorio();
}
// Ir para uma sala de conversa: anda até o primeiro ambiente dela.
// Chat escrito: um por ala (Atendimento, Criação, Produção, Reunião, Foco e
// Convivência), não por sala do mapa. O cabeçalho diz com quem a pessoa
// divide o chat de onde está.
function escritorioTituloChat(sala = escritorio.sala) {
  return "Conversa · " + (ESCRITORIO_SALAS[sala] || "Convivência");
}
function escritorioNotaChat(sala = escritorio.sala) {
  const aqui = escritorioLugarDe(escritorio.perfil);
  const outros = [...new Set([...ESCRITORIO_PLANTA.ambientes, ESCRITORIO_PRACA].filter((a) => a.sala === sala && a.id !== aqui.id).map((a) => a.nome))];
  return outros.length ? `Você está em ${aqui.nome}. Chat escrito dividido com ${outros.join(", ")}.` : `Chat escrito de quem está em ${aqui.nome}.`;
}
// Mudou de ala: cabeçalho e mensagens passam para o chat de lá.
function atualizarChatEscritorio(salaAntes) {
  const titulo = document.getElementById("office-chat-titulo"), nota = document.getElementById("office-chat-nota"), campo = document.getElementById("office-message");
  if (titulo) titulo.textContent = escritorioTituloChat();
  if (nota) nota.textContent = escritorioNotaChat();
  if (campo) campo.placeholder = "Mensagem para " + (ESCRITORIO_SALAS[escritorio.sala] || "Convivência");
  if (salaAntes !== escritorio.sala) carregarChatEscritorio();
}
// Movimento contínuo (como em jogo): a posição anda em frações de ladrilho a
// cada quadro, com colisão na grade do mapa. Clique segue o caminho livre
// (A*); WASD/setas dirigem direto. A presença vai para a equipe a cada 150 ms.
// Ladrilhos por segundo, no ritmo do passo desenhado pelo mapa (MAPA_PASSO_MS:
// uma passada de 4 quadros por ladrilho). Fora do navegador o mapa não carrega.
const ESCRITORIO_VELOCIDADE = 1000 / (typeof MAPA_PASSO_MS === "number" ? MAPA_PASSO_MS : 240);
const movimento = { x: 0, y: 0, rota: [], quadro: null, ultimo: 0, envio: 0, dir: 2, andando: false };
// Zona de conversa: a da sala em que a pessoa está; na Praça, nenhuma.
function escritorioZonaEm() {
  return escritorio.quarto || "";
}
// Atualiza o que depende do lugar: sala de conversa, zona, cabeçalho e dock.
// "forcar": a cena trocou (o lugar mudou mesmo que a zona pareça igual).
function escritorioMudouLugar(x, y, forcar = false) {
  // O ladrilho em que a pessoa está é o arredondado (o mesmo do andar).
  x = Math.round(x); y = Math.round(y);
  const quarto = escritorioAmbienteDoQuarto();
  const sala = quarto ? quarto.sala : escritorioSalaEm(x, y), zona = quarto ? quarto.id : escritorioAmbienteEm(x, y)?.id || "";
  if (!forcar && zona === escritorio.zona && sala === escritorio.sala) return;
  const saiuDaZona = zona !== escritorio.zona, salaAntes = escritorio.sala;
  // O perfil acompanha o ladrilho novo já aqui: cabeçalho e chat leem o
  // lugar dele (a presença enviada à equipe segue o seu próprio ritmo).
  escritorio.perfil = { ...escritorio.perfil, ...escritorioParaPorcentagem(x, y) };
  escritorio.sala = sala;
  escritorio.zona = zona;
  // Como no SoWork: sair da zona encerra a conversa dela. Entrar numa sala
  // (decisão do Paulo) já entra na conversa dela com o microfone ligado.
  // Pisar na porta ou no corredor por um instante não derruba a conversa:
  // sai só se continuar fora por 1,5 s. Indo direto para outra sala, troca.
  clearTimeout(escritorio.timerSaidaZona);
  if (saiuDaZona) {
    escritorio.falhaConversa = "";
    // Pisar na porta ou no corredor por um instante não corta a voz: só
    // depois de 1,2 s fora. Entrando numa sala, troca na hora.
    if (escritorioCanal(zona)) escritorioConversaAutomatica();
    else escritorio.timerSaidaZona = setTimeout(escritorioConversaAutomatica, 1200);
  }
  atualizarCabecalhoEscritorio();
  atualizarTituloChamadaEscritorio();
  atualizarControlesEscritorio();
  atualizarChatEscritorio(salaAntes);
}
function atualizarCabecalhoEscritorio() {
  const lugar = document.getElementById("office-lugar"), dica = document.getElementById("office-lugar-dica");
  if (lugar) lugar.textContent = escritorioLugarDe(escritorio.perfil).nome;
  if (dica) dica.textContent = !escritorio.quarto
    ? "Ao ar livre, sem voz · entre numa sala pela lista para conversar"
    : escritorioNoMeuQuarto() ? "Seu quarto · modo foco: quem entrar fala com você."
      : escritorio.zona === "foco" ? "Zona silenciosa: sem conversa por voz."
        : escritorio.conectado ? "Quem está aqui fala com você." : "Entre no escritório para falar com quem está aqui.";
}
// Estado da voz no dock, com as mesmas palavras do cabeçalho do lugar.
function escritorioEstadoVozTexto() {
  if (escritorio.zona === "foco") return "Foco: sem voz";
  if (!escritorio.zona) return "Sem voz na Praça";
  if (!escritorio.conectado) return "Zona de conversa · entre para falar";
  return escritorio.chamada && escritorioCanal() ? "Na conversa da sala" : "Zona de conversa";
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
    // Passo na diagonal leva o mesmo meio segundo do passo reto (Arcturus: um
    // passo por ciclo do quarto); antes demorava 41% a mais e parecia arrastar.
    const passo = velocidade * dt * (Math.abs(dx) > 0.01 && Math.abs(dy) > 0.01 ? Math.SQRT2 : 1);
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
  const andando = teclado || movimento.rota.length > 0;
  if (!andando) movimento.turbo = false;
  // Ao andar, acenar e deitar acabam (o café continua na mão).
  if (andando && (escritorio.pose === "acenar" || escritorio.pose === "deitar")) definirPoseEscritorio("");
  if (andando && escritorio.noChao) { escritorio.noChao = false; atualizarControlesEscritorio(); }
  escritorioSomDePasso(andando);
  if (andando) escritorioAtividade();
  if (vx || vy) movimento.dir = mapaDirecaoDoPasso(vx, vy);
  // Parou: encaixa no centro do ladrilho (como no Habbo).
  if (!andando) { movimento.x = Math.round(movimento.x); movimento.y = Math.round(movimento.y); }
  const assento = andando ? undefined : escritorio.mapa?.assentoEm(movimento.x, movimento.y);
  const cama = andando || assento !== undefined ? undefined : escritorio.mapa?.camaEm?.(movimento.x, movimento.y);
  escritorio.emMovimento = andando;
  escritorio.mapa?.mover(escritorio.base.eu, movimento.x, movimento.y, assento ?? cama ?? movimento.dir, andando ? "wlk" : escritorioAcaoDaPose(escritorio.pose, assento !== undefined, cama !== undefined));
  escritorio.mapa?.seguir(movimento.x, movimento.y);
  escritorioMudouLugar(movimento.x, movimento.y);
  // Pisou na porta de um quarto (atrás da porta da fachada) ou na soleira de
  // saída: a cena troca e este ciclo acaba aqui.
  if (escritorioConferirPortal()) return;
  // Entrou ou saiu do Lounge: a música toca ou para (só para esta pessoa).
  const naPista = typeof escritorioNaPista === "function" && escritorioNaPista();
  if (naPista !== Boolean(escritorio.naPista)) { escritorio.naPista = naPista; sincronizarMusicaEscritorio(); }
  escritorioEnviarPosicao(!andando);
  // A ação do E é recalculada no máximo 8 vezes por segundo (e ao parar): ela
  // procura caminho até cada pessoa perto, o que pesava a cada quadro.
  if (!andando || agora - (movimento.acaoEm || 0) > 120) { movimento.acaoEm = agora; atualizarAcaoProximaEscritorio(); }
  escritorioFisicaDoPiso(andando);
  // Chegou ao lado do móvel que foi clicado: usa (andar com as teclas cancela).
  escritorioAtualizarPortas();
  if (teclado) escritorio.usarAoChegar = null;
  else if (!andando && escritorio.usarAoChegar) { const alvo = escritorio.usarAoChegar; escritorio.usarAoChegar = null; escritorioAcaoDoMovel(alvo)?.fazer(); }
  // Com tecla presa (ainda no tempo de só virar), o ciclo continua esperando.
  if (andando || escritorioTeclas.size) movimento.quadro = requestAnimationFrame(escritorioQuadro);
  else atualizarPessoasEscritorio();
}
// Porta: sair do piso da cena (a soleira) leva aonde a porta dá
// (escritorioDestinoDaPorta). Vale também na Praça.
function escritorioConferirPortal() {
  const x = Math.round(movimento.x), y = Math.round(movimento.y);
  const a = escritorioAmbienteDoQuarto() || ESCRITORIO_PRACA;
  if (x < a.x0 || y < a.y0 || x >= a.x1 || y >= a.y1) return escritorioSairDoQuarto();
  return false;
}
// Física do piso no próprio boneco (os outros veem pela posição que chega):
// esteira rolante leva quem fica parado nela, gelo faz deslizar até bater e
// placa de pressão abre os portões da sala enquanto alguém está em cima.
const ESCRITORIO_PASSO_ESTEIRA = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };
function escritorioFisicaDoPiso(andando) {
  const m = escritorio.mapa;
  if (!m?.pisoEm || escritorio.edicao) return;
  const x = Math.round(movimento.x), y = Math.round(movimento.y), chave = x + "," + y;
  if (chave !== movimento.ladrilho) {
    const antes = movimento.ladrilho;
    if (movimento.ladrilho) { const [lx, ly] = movimento.ladrilho.split(",").map(Number); movimento.ultimoPasso = [Math.sign(x - lx), Math.sign(y - ly)]; }
    movimento.ladrilho = chave;
    escritorioPisouEm(x, y);
    if (typeof gatilhoPassoEscritorio === "function") gatilhoPassoEscritorio(antes, x, y);
  }
  clearTimeout(escritorio.timerEsteira);
  if (andando) return;
  // Parou numa cama: deita na linha da cabeceira, na mesma coluna (como o
  // servidor do Habbo faz), em vez de deitar no meio do colchão.
  const cabeceira = m.cabeceiraEm?.(x, y);
  if (cabeceira && (cabeceira.x !== x || cabeceira.y !== y) && !escritorioOcupado(cabeceira.x, cabeceira.y)) {
    movimento.x = cabeceira.x; movimento.y = cabeceira.y; movimento.ladrilho = cabeceira.x + "," + cabeceira.y;
    m.mover(escritorio.base.eu, movimento.x, movimento.y, m.camaEm(movimento.x, movimento.y) ?? movimento.dir, "lay");
    escritorioEnviarPosicao(true);
    return;
  }
  const piso = m.pisoEm(x, y);
  const seguir = (dx, dy) => {
    if (!(dx || dy) || !escritorioPodeIr(x, y, x + dx, y + dy) || !m.caminho({ x, y }, { x: x + dx, y: y + dy }, null, 2)) return;
    movimento.rota = [{ x: x + dx, y: y + dy }];
    escritorioAnimarMovimento();
  };
  if (piso?.tipo === "gelo" && movimento.ultimoPasso) setTimeout(() => seguir(...movimento.ultimoPasso), 0);
  else if (piso?.tipo === "esteira") escritorio.timerEsteira = setTimeout(() => {
    if (movimento.rota.length || Math.round(movimento.x) !== x || Math.round(movimento.y) !== y) return;
    seguir(...(ESCRITORIO_PASSO_ESTEIRA[piso.dir] || [0, 0]));
  }, 500); // a esteira do Habbo anda um ladrilho a cada meio segundo
}
// Barraca, van e cabana (FurnitureChangeStateWhenStepOnLogic): abrem (estado
// 1) enquanto o próprio boneco está em cima e fecham quando sai; só na tela
// de quem pisou, como no Habbo.
function escritorioPisarMuda(x, y) {
  const mapa = escritorio.mapa;
  if (!mapa?.moveisEm) return;
  const aqui = new Set((mapa.moveisEm(x, y) || []).filter((m) => escritorioLogica(m) === "pisar").map((m) => mapa.chaveMovel(m)));
  const mudar = [];
  for (const k of escritorio.pisandoEm || []) if (!aqui.has(k)) mudar.push([k, 0]);
  for (const k of aqui) if (!escritorio.pisandoEm?.has(k)) mudar.push([k, 1]);
  escritorio.pisandoEm = aqui;
  if (mudar.length) mapa.estadosMoveis(mudar);
}
function escritorioPisouEm(x, y) {
  escritorioPisarMuda(x, y);
  // Futebol do Habbo: passar pela bola conduz (1 ladrilho); terminar o passo
  // em cima dela chuta (6 ladrilhos), na direção em que se andava.
  const r = movimento.rota;
  const final = !escritorioTeclas.size && (!r.length || r.length === 1 && r[0].x === x && r[0].y === y);
  escritorioChutarBola(x, y, final ? 6 : 1);
  const naPlaca = escritorio.mapa?.pisoEm(x, y)?.tipo === "placa";
  if (naPlaca === Boolean(escritorio.naPlaca)) return;
  escritorio.naPlaca = naPlaca;
  if (naPlaca) return escritorioPortoes(1);
  // Saiu da placa: fecha só se mais ninguém está em cima de uma.
  const outro = (escritorio.online || []).some((o) => String(o.id) !== String(escritorio.base.eu) && escritorioNaCena(o) && (() => { const q = escritorioPosicao(o); return escritorio.mapa.pisoEm(q.x, q.y)?.tipo === "placa"; })());
  if (!outro) escritorioPortoes(0);
}
// Futebol (servidor do Habbo, InteractionFootball): a bola rola pelo chão e
// passa só onde dá para empilhar; bate e volta (ou desvia na diagonal); os 4
// primeiros ladrilhos de um chute longo são rápidos (125 ms), o resto 500 ms.
// Gol vale entrando pela frente da trave; o placar da cor da trave sobe.
const ESCRITORIO_BOLA = /^fball_ball\d*$/;
const ESCRITORIO_GOL = /^fball_goal_([a-z])$/;
const ESCRITORIO_ROTACAO = { "0,-1": 0, "1,-1": 1, "1,0": 2, "1,1": 3, "0,1": 4, "-1,1": 5, "-1,0": 6, "-1,-1": 7 };
function escritorioChutarBola(x, y, vel) {
  const m = escritorio.mapa;
  const bola = m?.moveisDaClasse?.(ESCRITORIO_BOLA).find((b) => Math.floor(b.x) === x && Math.floor(b.y) === y);
  if (!bola || !movimento.ultimoPasso) return;
  const [dx, dy] = movimento.ultimoPasso;
  if (!dx && !dy) return;
  const v = `${m.chaveMovel(bola)}|${x},${y}|${dx},${dy}|${vel}`;
  escritorioEmitir("chat:bubble", { texto: ESCRITORIO_COMANDO + "bol=" + v });
  escritorioRolarBola(v);
}
function escritorioGolValido(gol, dx, dy) {
  const d = ESCRITORIO_ROTACAO[dx + "," + dy];
  return { 0: d > 2 && d < 6, 2: d > 4, 4: d > 6 || d < 2, 6: d > 0 && d < 4 }[gol.dir] ?? false;
}
function escritorioRolarBola(v) {
  const m = escritorio.mapa, [chave, pos, dir, velTxt] = String(v).split("|");
  let [x, y] = String(pos).split(",").map(Number), [dx, dy] = String(dir).split(",").map(Number);
  const vel = Math.min(6, Math.max(1, Number(velTxt) || 1));
  const bola = m?.moveisDaClasse?.(ESCRITORIO_BOLA).find((b) => m.chaveMovel(b) === chave);
  if (!bola || ![x, y, dx, dy].every(Number.isInteger) || Math.abs(dx) > 1 || Math.abs(dy) > 1) return;
  clearTimeout(bola.timerRolar);
  m.deslocarMovel(bola, x, y);
  let passo = 0;
  const parar = () => m.estadosMoveis([[chave, 0]]);
  const andar = () => {
    if (passo >= vel || escritorio.mapa !== m) return parar();
    passo++;
    if (!m.bolaPassa(x, y, x + dx, y + dy)) {
      if (dx && dy) { if (m.bolaPassa(x, y, x - dx, y + dy)) dx = -dx; else if (m.bolaPassa(x, y, x + dx, y - dy)) dy = -dy; else { dx = -dx; dy = -dy; } }
      else { dx = -dx; dy = -dy; }
      if (!m.bolaPassa(x, y, x + dx, y + dy)) return parar();
    }
    const gol = m.moveisDaClasse(ESCRITORIO_GOL).find((g) => x + dx >= Math.floor(g.x) && x + dx < Math.floor(g.x) + g.dim.x && y + dy >= Math.floor(g.y) && y + dy < Math.floor(g.y) + g.dim.y);
    if (gol && !escritorioGolValido(gol, dx, dy)) return parar();
    x += dx; y += dy;
    m.deslocarMovel(bola, x, y);
    m.estadosMoveis([[chave, 1 + (passo % 6)]]);
    if (gol) { parar(); return escritorioGol(gol); }
    bola.timerRolar = setTimeout(andar, vel > 4 && passo <= 4 ? 125 : 500);
  };
  andar();
}
function escritorioGol(gol) {
  const cor = ESCRITORIO_GOL.exec(gol.classe)[1], m = escritorio.mapa;
  for (const p of m.moveisDaClasse(new RegExp("^fball_score_" + cor + "$"))) m.estadosMoveis([[m.chaveMovel(p), ((p.estado || 0) + 1) % 100]]);
  escritorioTocar(990, 0.12, 0.06);
  escritorioAviso("Gol!");
}
// Garrafa (gira e para apontando para alguém) e roleta (sorteia quem começa):
// quem gira escolhe o resultado e todos veem o mesmo.
const ESCRITORIO_GARRAFA = /^bottle$/, ESCRITORIO_ROLETA = /spinthewheel/;
const ESCRITORIO_DIRECAO_GARRAFA = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
function escritorioGenteNaCena() {
  const eu = escritorioPosicao(escritorio.perfil || {});
  return [{ id: escritorio.base.eu, nome: "você", x: Math.round(movimento.quadro ? movimento.x : eu.x), y: Math.round(movimento.quadro ? movimento.y : eu.y) },
    ...(escritorio.online || []).filter((o) => String(o.id) !== String(escritorio.base.eu) && escritorioNaCena(o)).map((o) => { const q = escritorioPosicao(o); return { id: o.id, nome: String(o.nome).split(" ")[0], x: Math.round(q.x), y: Math.round(q.y) }; })];
}
function girarGarrafaEscritorio(m) {
  const mapa = escritorio.mapa, chave = mapa.chaveMovel(m);
  if (escritorio.rolando?.has(chave)) return;
  (escritorio.rolando ||= new Set()).add(chave);
  mapa.estadosMoveis([[chave, -1]]);
  escritorioTocar(520, 0.06, 0.04);
  setTimeout(() => {
    escritorio.rolando.delete(chave);
    const n = Math.floor(Math.random() * 8);
    mapa.estadosMoveis([[chave, n]]);
    escritorioEmitir("furni:toggle", { chave, estado: n });
    // Para quem ela aponta: a pessoa mais perto nessa direção.
    const [dx, dy] = ESCRITORIO_DIRECAO_GARRAFA[n], bx = Math.floor(m.x), by = Math.floor(m.y);
    const alvo = escritorioGenteNaCena().map((q) => ({ ...q, ax: q.x - bx, ay: q.y - by })).filter((q) => (q.ax || q.ay) && q.ax * dx + q.ay * dy > 0)
      .sort((a, b) => (Math.abs(a.ax * dy - a.ay * dx) - Math.abs(b.ax * dy - b.ay * dx)) || (Math.hypot(a.ax, a.ay) - Math.hypot(b.ax, b.ay)))[0];
    if (alvo) { const texto = `A garrafa parou em ${alvo.nome}!`; escritorioEmitir("chat:bubble", { texto }); escritorio.mapa?.balao(escritorio.base.eu, texto); }
  }, 1600);
}
function girarRoletaEscritorio(m) {
  const mapa = escritorio.mapa, chave = mapa.chaveMovel(m);
  if (escritorio.rolando?.has(chave)) return;
  (escritorio.rolando ||= new Set()).add(chave);
  mapa.estadosMoveis([[chave, 1]]);
  escritorioEmitir("furni:toggle", { chave, estado: 1 });
  setTimeout(() => {
    escritorio.rolando.delete(chave);
    mapa.estadosMoveis([[chave, 0]]);
    escritorioEmitir("furni:toggle", { chave, estado: 0 });
    const gente = escritorioGenteNaCena(), sorteado = gente[Math.floor(Math.random() * gente.length)];
    const texto = `Roleta: ${sorteado.nome === "você" ? "eu" : sorteado.nome} começa!`;
    escritorioEmitir("chat:bubble", { texto });
    escritorio.mapa?.balao(escritorio.base.eu, texto);
  }, 3000);
}
// Abre (1) ou fecha (0) todos os portões da cena; todos veem.
function escritorioPortoes(estado) {
  const m = escritorio.mapa;
  if (!m?.portoes) return;
  const mudou = m.portoes().filter((g) => (g.estado || 0) !== estado && !escritorioPortaoOcupado(g)).map((g) => [m.chaveMovel(g), estado]);
  if (!mudou.length) return;
  m.estadosMoveis(mudou);
  for (const [chave] of mudou) escritorioEmitir("furni:toggle", { chave, estado });
  escritorioTocar(estado ? 520 : 300, 0.08, 0.05);
}
function escritorioAnimarMovimento() {
  if (movimento.quadro) return;
  const pos = escritorioPosicao(escritorio.perfil || {});
  if (!movimento.andando) { movimento.x = pos.x; movimento.y = pos.y; }
  movimento.ultimo = 0;
  movimento.quadro = requestAnimationFrame(escritorioQuadro);
}
// No caminho do clique, sala trancada e ladrilho de outra pessoa são obstáculos
// (como já são para quem anda com as teclas).
function escritorioEvitarNoCaminho(x, y) {
  return escritorioZonaBloqueada(escritorioZonaEm(x, y)) || escritorioOcupado(x, y);
}
function escritorioIrPara(x, y) {
  const de = { x: Math.round(movimento.quadro ? movimento.x : escritorioPosicao(escritorio.perfil || {}).x), y: Math.round(movimento.quadro ? movimento.y : escritorioPosicao(escritorio.perfil || {}).y) };
  const tx = Math.floor(x), ty = Math.floor(y);
  const destino = escritorioZonaEm(tx, ty);
  if (escritorioZonaBloqueada(destino)) { avisarTrancadaEscritorio(destino, true); return; }
  // Sem mapa pronto: não teleporta.
  if (!escritorio.mapa) return;
  if (escritorioOcupado(tx, ty)) { escritorioAviso("Esse lugar está ocupado: clique num ladrilho ao lado."); return; }
  const passos = escritorio.mapa.caminho(de, { x, y }, escritorioEvitarNoCaminho);
  if (!passos) {
    // O aviso diz o motivo certo: móvel no destino, sala trancada ou alguém
    // parado no único caminho, ou parede sem passagem.
    if (escritorio.mapa.bloqueadoEm(tx, ty)) escritorioAviso(escritorio.mapa.moveisEm(x, y).some((i) => !i.plano && !i.altura && !i.parede) ? "Aí tem um móvel: clique no chão ao lado dele." : "Aí não se anda: clique no piso do escritório.");
    else if (escritorio.mapa.caminho(de, { x, y })) escritorioAviso("O único caminho passa por uma sala trancada ou por alguém parado.");
    else escritorioAviso("Não dá para chegar aí: há parede ou móvel no caminho.");
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
  const mesa = escritorioNoMeuQuarto() ? escritorioMinhaMesa() : null;
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
  { re: /largescreen|projector/, titulo: "Fila da Criação", html: () => {
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
// Ladrilho livre colado num retângulo (mesa), o mais perto de quem anda.
function escritorioLadoLivre(r) {
  const de = { x: Math.round(movimento.quadro ? movimento.x : escritorioPosicao(escritorio.perfil || {}).x), y: Math.round(movimento.quadro ? movimento.y : escritorioPosicao(escritorio.perfil || {}).y) };
  const candidatos = [];
  for (let x = r.x - 1; x <= r.x + r.w; x++) for (let y = r.y - 1; y <= r.y + r.h; y++) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) continue;
    if (escritorioOcupado(x, y)) continue;
    const passos = escritorio.mapa?.caminho(de, { x, y }, escritorioEvitarNoCaminho);
    if (passos) candidatos.push({ x, y, n: passos.length });
  }
  return candidatos.sort((a, b) => a.n - b.n)[0] || null;
}
// Ficha do móvel (infostand do Habbo): o clique num móvel o seleciona e
// mostra nome e ações, sem andar. Usar fica no botão e no duplo clique.
function abrirFichaMovelEscritorio(m) {
  const card = document.getElementById("office-movel-card");
  if (!card || !m) return;
  escritorio.movelSelecionado = m;
  const cat = (typeof escritorioCatalogo !== "undefined" && escritorioCatalogo || []).find((x) => x.classe === m.classe);
  const nome = cat ? escritorioNomeMovel(cat) : m.classe.replace(/_/g, " ");
  const acao = escritorioAcaoDoMovel(m) || (ESCRITORIO_REGULADOR.test(m.classe) ? { texto: "Regular a luz" } : null);
  const camada = m.origem?.camada, edita = camada && escritorioPodeEditar(camada);
  card.innerHTML = `<div class="ofc-ficha-movel-arte"></div><b>${safeText(nome)}</b>${cat?.categoria ? `<small>${safeText(cat.categoria)}</small>` : ""}<div>${acao ? `<button type="button" class="ofc-mini" onclick="usarMovelSelecionadoEscritorio()">${safeText(acao.texto || "Usar")}</button>` : ""}${edita ? `<button type="button" class="ofc-mini" onclick="editarMovelSelecionadoEscritorio()">Editar</button>` : ""}<button type="button" class="ofc-mini" onclick="fecharFichaMovelEscritorio()" aria-label="Fechar">Fechar</button></div>`;
  // A arte do próprio móvel, como na ficha do Habbo.
  const fonte = m.no?.tagName === "CANVAS" ? m.no : m.no?.querySelector("canvas");
  if (fonte) {
    const c = document.createElement("canvas"), k = Math.min(1, 96 / Math.max(fonte.width, fonte.height));
    c.width = Math.round(fonte.width * k); c.height = Math.round(fonte.height * k);
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    for (const parte of m.no?.tagName === "CANVAS" ? [m.no] : m.no.querySelectorAll("canvas")) g.drawImage(parte, 0, 0, c.width, c.height);
    card.querySelector(".ofc-ficha-movel-arte").append(c);
  }
  card.hidden = false;
  if (!escritorioCatalogo) carregarCatalogoEscritorio().then(() => { if (escritorio.movelSelecionado === m && !card.hidden) abrirFichaMovelEscritorio(m); });
}
function fecharFichaMovelEscritorio() {
  escritorio.movelSelecionado = null;
  escritorio.pessoaSelecionada = null;
  const card = document.getElementById("office-movel-card");
  if (card) card.hidden = true;
  const menu = document.getElementById("office-menu-pessoa");
  if (menu) menu.hidden = true;
}
// Clique em alguém (AvatarInfoWidget do Nitro): a seta de seleção em cima,
// um menu curto sobre a cabeça com as ações e a ficha lateral (nome, onde
// está, status). A ficha completa (pontos, conquistas) fica a um clique.
function abrirMenuPessoaEscritorio(id) {
  fecharFichaMovelEscritorio();
  const b = escritorio.base, pessoa = b?.equipe.find((p) => String(p.id) === String(id));
  if (!pessoa) return;
  escritorio.pessoaSelecionada = String(id);
  const eu = String(id) === String(b.eu), online = (escritorio.online || []).find((o) => String(o.id) === String(id));
  const perfil = eu ? escritorio.perfil : pessoa.perfil || {};
  const st = ESCRITORIO_STATUS[eu ? escritorio.status : online?.status] || null;
  const lugar = online || eu ? escritorioLugarDe(eu ? null : online)?.nome : "";
  const sid = safeText(String(id));
  const card = document.getElementById("office-movel-card");
  if (card) {
    card.innerHTML = `<div class="ofc-ficha-movel-arte">${escritorioAvatar(perfil, pessoa.nome)}</div><b>${safeText(pessoa.nome)}</b><small>${online || eu ? `${st ? `<span style="color:${st[1]}">${safeText(st[0])}</span>` : ""}${lugar ? ` · ${safeText(lugar)}` : ""}` : "Fora do escritório"}</small><div><button type="button" class="ofc-mini" onclick="fecharFichaMovelEscritorio();abrirFichaEscritorio('${sid}')">Ficha completa</button><button type="button" class="ofc-mini" onclick="fecharFichaMovelEscritorio();escritorio.mapa?.selecionarPessoa(null)" aria-label="Fechar">Fechar</button></div>`;
    card.hidden = false;
  }
  const acoes = eu
    ? [["Acenar", "definirPoseEscritorio('acenar')"], ["Sentar no chão", "sentarNoChaoEscritorio()"], ["Personalizar", "personalizarEscritorio()"]]
    : [...(online ? [["Ir até", `escritorioIrAte('${sid}')`]] : []), ["Deixar recado", `abrirRecadosEscritorio('${sid}')`], ["Dar presente", `abrirPresenteEscritorio('${sid}')`]];
  const menu = document.getElementById("office-menu-pessoa");
  if (!menu) return;
  menu.innerHTML = `<b>${safeText(pessoa.nome.split(" ")[0])}</b>${acoes.map(([t, f]) => `<button type="button" role="menuitem" onclick="fecharFichaMovelEscritorio();escritorio.mapa?.selecionarPessoa(null);${f}">${safeText(t)}</button>`).join("")}`;
  menu.hidden = false;
  // Sobre a cabeça do boneco, dentro da área do mapa.
  const alvo = escritorio.mapa?.noDaPessoa?.(id);
  const caixa = menu.parentElement.getBoundingClientRect(), r = alvo?.getBoundingClientRect();
  if (r) {
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(caixa.width - w - 8, r.left - caixa.left + r.width / 2 - w / 2)) + "px";
    menu.style.top = Math.max(8, r.top - caixa.top - h - 34) + "px";
  }
}
function usarMovelSelecionadoEscritorio() {
  const m = escritorio.movelSelecionado;
  if (!m) return;
  fecharFichaMovelEscritorio();
  if (!escritorioUsarAoClicar(Math.floor(m.x), Math.floor(m.y))) escritorioAcaoDoMovel(m)?.fazer?.();
}
function editarMovelSelecionadoEscritorio() {
  const m = escritorio.movelSelecionado;
  if (!m?.origem) return;
  fecharFichaMovelEscritorio();
  abrirEditorEscritorio(m.origem.camada);
  const e = escritorio.edicao;
  if (e && e.itens[m.origem.i]) { e.sel = m.origem.i; escritorioEditorMudou?.(); }
}
function cliqueNoMapaEscritorio(x, y, objeto = null) {
  if (escritorio.edicao) { cliqueEditorEscritorio(x, y); return; }
  // Como no Habbo: clicar em alguém seleciona (seta em cima e a ficha); num
  // móvel que não é assento nem cama, seleciona e mostra a ficha, sem andar.
  if (objeto?.tipo === "pessoa") {
    fecharFichaMovelEscritorio();
    escritorio.mapa?.selecionarPessoa(objeto.id);
    abrirFichaEscritorio(objeto.id);
    return;
  }
  escritorio.mapa?.selecionarPessoa(null);
  if (objeto?.tipo === "movel") {
    const m = objeto.item, f = mapaFisica(m.classe);
    if (!(f.senta || f.deita) && !ESCRITORIO_REGULADOR.test(m.classe)) { abrirFichaMovelEscritorio(m); return; }
    // Assento ou cama: anda até ele (pelo ladrilho do móvel, não o de trás).
    x = Math.floor(m.x) + 0.5; y = Math.floor(m.y) + 0.5;
  }
  fecharFichaMovelEscritorio();
  escritorio.seguindoId = null;
  escritorio.usarAoChegar = null;
  escritorio.aoChegarNaCena = null;
  if (!escritorio.conectado && !escritorio.base?.demo) {
    escritorioAviso("Entre no escritório para andar pelo mapa.");
    return;
  }
  // Clicar na própria mesa leva até ela; o painel abre com o E (ou o botão).
  const mesa = escritorioNoMeuQuarto() ? escritorioMinhaMesa() : null;
  if (mesa && x >= mesa.x && x < mesa.x + mesa.w && y >= mesa.y && y < mesa.y + mesa.h) {
    const lado = escritorioLadoLivre(mesa);
    if (lado) { escritorioIrPara(lado.x, lado.y); return; }
  }
  if (typeof gatilhoCliqueEscritorio === "function") gatilhoCliqueEscritorio(x, y);
  if (escritorioUsarAoClicar(x, y)) return;
  // Clicou num móvel que não se usa (mesa dos outros, estante…): anda até o
  // chão livre mais perto dele, como já faz com a própria mesa.
  const tx = Math.floor(x), ty = Math.floor(y);
  if (escritorio.mapa?.bloqueadoEm(tx, ty) && !escritorioZonaBloqueada(escritorioZonaEm(tx, ty))) {
    const solido = (escritorio.mapa.moveisEm(x, y) || []).find((i) => !i.plano && !i.altura && !i.parede);
    const lado = solido && escritorioLadoLivre({ x: Math.floor(solido.x), y: Math.floor(solido.y), w: Math.max(1, Math.round(solido.dim.x)), h: Math.max(1, Math.round(solido.dim.y)) });
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

// Comandos do boneco que a equipe vê, como os do Habbo: rosto, placa,
// sentar no chão e "digitando…". Vão pelo balão de fala com um marcador
// invisível na frente (o Worker já repassa o balão a todos, sem precisar
// publicar outra versão dele); quem recebe aplica e não mostra balão.
const ESCRITORIO_COMANDO = "\u2063";
const ESCRITORIO_EXPRESSOES = { triste: "sad", surpreso: "srp", bravo: "agr" };
// Placas do Habbo (sig=): números, coração, exclamação, sorriso.
const ESCRITORIO_PLACAS = { um: 1, dois: 2, tres: 3, coracao: 11, exclamacao: 13, sorriso: 15 };
function escritorioAplicarComando(id, cmd) {
  const [k, v] = String(cmd).split("="), m = escritorio.mapa;
  if (!m || id == null) return;
  if (k === "exp" && Object.values(ESCRITORIO_EXPRESSOES).includes(v)) m.estadoBoneco(id, { expressao: v });
  else if (k === "sig" && Object.values(ESCRITORIO_PLACAS).includes(Number(v))) m.estadoBoneco(id, { placa: Number(v) });
  else if (k === "sit") m.estadoBoneco(id, { chao: v === "1" });
  else if (k === "dig") m.estadoBoneco(id, { digitando: v === "1" });
  else if (k === "zzz") m.estadoBoneco(id, { cochilo: v === "1" });
  // Alguém salvou a decoração (móveis, piso, paredes, luz ou planta): quem
  // está naquela cena relê do servidor e redesenha.
  else if (k === "dec") escritorioDecoracaoMudou(id, v);
  // TV: quem está no mesmo espaço vê o vídeo passado (vazio desliga).
  else if (k === "tv") { const [cena, video] = String(v || "").split(":"); if (cena === (escritorio.quarto || "praca") && String(id) !== String(escritorio.base?.eu)) mostrarTvEscritorio(escritorioIdYoutube(video) || "", id); }
  // Bola chutada: cada navegador roda o mesmo caminho (mesma grade).
  else if (k === "bol" && String(id) !== String(escritorio.base?.eu)) escritorioRolarBola(v);
  // Post-it colado ou tirado: quem está na sala relê a parede.
  else if (k === "pst" && v === escritorio.quarto && String(id) !== String(escritorio.base?.eu)) carregarPostitsEscritorio();
  // Presente de móvel: quem recebe relê o inventário.
  else if (k === "pre") presenteChegouEscritorio(id, v);
  // Item de mão entregue (como no Habbo): só quem recebe aplica.
  else if (k === "dar") {
    const [para, pose] = String(v || "").split(":");
    if (para !== String(escritorio.base?.eu) || !ESCRITORIO_MAO[pose] || String(id) === para) return;
    definirPoseEscritorio(pose);
    const nome = String((escritorio.online || []).find((o) => String(o.id) === String(id))?.nome || "Alguém").split(" ")[0];
    escritorioAviso(`${nome} te deu ${ESCRITORIO_NOME_MAO[pose]}.`);
  }
}
function escritorioAvisarDecoracao(camada) {
  if (!camada || escritorio.base?.demo) return;
  escritorioEmitir("chat:bubble", { texto: ESCRITORIO_COMANDO + "dec=" + camada });
}
function escritorioDecoracaoMudou(id, camada) {
  if (escritorio.base?.demo || String(id) === String(escritorio.base?.eu) || !/^[a-z0-9-]{1,40}$/.test(String(camada))) return;
  const aqui = camada === "geral" ? !escritorio.quarto : escritorioRaizQuarto(escritorio.quarto || "") === escritorioRaizQuarto(camada);
  if (!aqui) return;
  clearTimeout(escritorio.timerDecoracao);
  escritorio.timerDecoracao = setTimeout(async () => {
    // Editando a mesma cena: não troca o que está na sua mão.
    if (escritorio.edicao) return;
    try {
      const b = await escritorioApi("entrada");
      escritorio.base.equipe = b.equipe;
      escritorio.base.mapa = b.mapa;
      escritorioAplicarSalas();
      escritorioRedesenharMapa();
    } catch {}
  }, 1200);
}
const ESCRITORIO_NOME_MAO = { cafe: "um café", bebida: "uma bebida", lanche: "um lanche" };
function darItemEscritorio(id) {
  const pose = escritorio.pose;
  if (!ESCRITORIO_MAO[pose]) return;
  escritorioEmitir("chat:bubble", { texto: ESCRITORIO_COMANDO + "dar=" + id + ":" + pose });
  definirPoseEscritorio("");
  const nome = String((escritorio.online || []).find((o) => String(o.id) === String(id))?.nome || "").split(" ")[0];
  escritorioAviso(`Você deu ${ESCRITORIO_NOME_MAO[pose]} para ${nome || "a pessoa"}.`);
}
// Portão: abre e fecha no clique ou no E; a alavanca vira todos os portões.
// Catraca (portão de mão única do Habbo, InteractionOneWayGate): fechada para
// todos; quem está no ladrilho da frente dela (para onde está virada) passa,
// atravessa e sai do outro lado. Na volta, não abre.
const ESCRITORIO_MAO_UNICA = /^one_?way_?door|^onewaydoor/;
function escritorioFrenteDoMovel(m, sentido = 1) {
  // Arte de duas direções (0 e 2, ou 2 e 4): a frente é sempre para quem olha
  // o mapa; a direção 0 dela olha para +y, não para a parede.
  const dirs = Object.keys(m.m?.dados?.visualizations?.find((v) => v.size === 64)?.directions || {}).map(Number);
  const [dx, dy] = dirs.length && dirs.length < 4 && m.dir === 0 ? [0, 1] : ESCRITORIO_PASSO_ESTEIRA[m.dir] || [0, 1];
  return { x: Math.floor(m.x) + dx * sentido, y: Math.floor(m.y) + dy * sentido };
}
function passarMaoUnicaEscritorio(m) {
  const mapa = escritorio.mapa, frente = escritorioFrenteDoMovel(m), atras = escritorioFrenteDoMovel(m, -1);
  const eu = { x: Math.round(movimento.quadro ? movimento.x : escritorioPosicao(escritorio.perfil || {}).x), y: Math.round(movimento.quadro ? movimento.y : escritorioPosicao(escritorio.perfil || {}).y) };
  if (eu.x !== frente.x || eu.y !== frente.y) {
    // Do outro lado ela não abre; da frente, vai até lá e passa ao chegar.
    if (eu.x === atras.x && eu.y === atras.y) return escritorioAviso("A catraca só passa num sentido.");
    escritorio.usarAoChegar = m;
    return escritorioIrPara(frente.x, frente.y);
  }
  if (escritorioOcupado(Math.floor(m.x), Math.floor(m.y)) || escritorioOcupado(atras.x, atras.y)) return escritorioAviso("Tem alguém na catraca. Espere passar.");
  const chave = mapa.chaveMovel(m);
  mapa.estadosMoveis([[chave, 1]]);
  escritorioEmitir("furni:toggle", { chave, estado: 1 });
  escritorioTocar(520, 0.06, 0.05);
  movimento.rota = [{ x: Math.floor(m.x), y: Math.floor(m.y) }, atras];
  escritorioAnimarMovimento();
  setTimeout(() => { mapa.estadosMoveis([[chave, 0]]); escritorioEmitir("furni:toggle", { chave, estado: 0 }); }, 1400);
}
// No Habbo o portão não abre nem fecha com alguém em cima dele.
function escritorioPortaoOcupado(g) {
  const eu = escritorioPosicao(escritorio.perfil || {});
  const gente = [{ x: Math.round(movimento.quadro ? movimento.x : eu.x), y: Math.round(movimento.quadro ? movimento.y : eu.y) },
    ...(escritorio.online || []).filter((o) => String(o.id) !== String(escritorio.base.eu) && escritorioNaCena(o)).map((o) => { const q = escritorioPosicao(o); return { x: Math.round(q.x), y: Math.round(q.y) }; })];
  return gente.some((q) => q.x >= Math.floor(g.x) && q.x < Math.floor(g.x) + Math.max(1, Math.round(g.dim.x)) && q.y >= Math.floor(g.y) && q.y < Math.floor(g.y) + Math.max(1, Math.round(g.dim.y)));
}
function alternarPortaoEscritorio(g) {
  if (escritorioPortaoOcupado(g)) return escritorioAviso("Tem alguém no portão: ele não fecha com gente em cima.");
  const m = escritorio.mapa, estado = g.estado ? 0 : 1, chave = m.chaveMovel(g);
  m.estadosMoveis([[chave, estado]]);
  escritorioEmitir("furni:toggle", { chave, estado });
  escritorioTocar(estado ? 520 : 300, 0.08, 0.05);
}
function puxarAlavancaEscritorio(a) {
  const m = escritorio.mapa, estado = a.estado ? 0 : 1, chave = m.chaveMovel(a);
  m.estadosMoveis([[chave, estado]]);
  escritorioEmitir("furni:toggle", { chave, estado });
  const primeiro = m.portoes()[0];
  escritorioPortoes(primeiro?.estado ? 0 : 1);
}
// Cochilo do Habbo: 5 minutos sem mexer (tecla, mouse, toque ou andar), o
// boneco cochila (olhos fechados e "z Z z"); qualquer movimento acorda. Todos
// veem. Não muda o status nem vale como ausência.
const ESCRITORIO_COCHILO_MS = 5 * 60 * 1000;
function escritorioAtividade() {
  escritorio.ultimaAtividade = Date.now();
  if (escritorio.cochilando) { escritorio.cochilando = false; escritorioComandoBoneco("zzz=0"); }
}
function escritorioConferirCochilo() {
  if (!escritorio.mapa || escritorio.cochilando || !escritorio.conectado) return;
  if (Date.now() - (escritorio.ultimaAtividade || Date.now()) < ESCRITORIO_COCHILO_MS) return;
  escritorio.cochilando = true;
  escritorioComandoBoneco("zzz=1");
}
if (typeof window !== "undefined" && window.addEventListener && typeof setInterval === "function" && typeof document !== "undefined" && document.body) {
  for (const ev of ["keydown", "pointerdown", "wheel"]) window.addEventListener(ev, escritorioAtividade, { passive: true });
  setInterval(escritorioConferirCochilo, 30000);
}
function escritorioComandoBoneco(cmd) {
  escritorioAplicarComando(escritorio.base?.eu, cmd);
  escritorioEmitir("chat:bubble", { texto: ESCRITORIO_COMANDO + cmd });
}
// O rosto acompanha o que foi escrito no balão (cada navegador deduz).
function escritorioExpressaoDoTexto(texto) {
  const t = String(texto || "").toLowerCase();
  if (/>:\(|😠|😡/.test(t)) return "agr";
  if (/(^|\s):'?\(|😢|😭|☹/.test(t)) return "sad";
  if (/(^|\s):o(\s|$)|😮|😲|\bnossa\b|\buau\b|!!/.test(t)) return "srp";
  return "";
}
function escritorioReceberBalao(id, texto) {
  if (String(texto).startsWith(ESCRITORIO_COMANDO)) { escritorioAplicarComando(id, String(texto).slice(1)); return; }
  escritorio.mapa?.balao(id, texto);
  const exp = escritorioExpressaoDoTexto(texto);
  if (exp) escritorio.mapa?.estadoBoneco(id, { expressao: exp });
}
function expressaoEscritorio(nome) {
  if (ESCRITORIO_EXPRESSOES[nome]) escritorioComandoBoneco("exp=" + ESCRITORIO_EXPRESSOES[nome]);
}
function placaEscritorio(nome) {
  if (ESCRITORIO_PLACAS[nome] != null) escritorioComandoBoneco("sig=" + ESCRITORIO_PLACAS[nome]);
}
// Sentar no chão onde estiver (":sit"); andar levanta.
function sentarNoChaoEscritorio() {
  const p = escritorioPosicao(escritorio.perfil || {});
  if (!escritorio.noChao && escritorio.mapa?.assentoEm(Math.round(p.x), Math.round(p.y)) !== undefined) { escritorioAviso("Você já está sentado."); return; }
  escritorio.noChao = !escritorio.noChao;
  escritorioComandoBoneco("sit=" + (escritorio.noChao ? 1 : 0));
  atualizarControlesEscritorio();
}
// "Digitando…" no chat: avisa no máximo a cada 4 s e some ao enviar,
// apagar ou sair do campo.
function escritorioDigitando(sim) {
  const agora = Date.now();
  if (sim) {
    clearTimeout(escritorio.timerDigitando);
    escritorio.timerDigitando = setTimeout(() => escritorioDigitando(false), 6000);
    if (escritorio.digitando && agora - (escritorio.digitandoEm || 0) < 4000) return;
    escritorio.digitando = true; escritorio.digitandoEm = agora;
    escritorioComandoBoneco("dig=1");
  } else if (escritorio.digitando) {
    clearTimeout(escritorio.timerDigitando);
    escritorio.digitando = false;
    escritorioComandoBoneco("dig=0");
  }
}
// Dado do Habbo: rola (estado 100) e cai num número de 1 a 6, que todos veem.
const ESCRITORIO_DADO = /^edice/;
function rolarDadoEscritorio(m) {
  const chave = escritorio.mapa.chaveMovel(m);
  if (escritorio.rolando?.has(chave)) return;
  (escritorio.rolando ||= new Set()).add(chave);
  escritorio.mapa.estadosMoveis([[chave, 100]]);
  escritorioTocar(520, 0.06, 0.04);
  setTimeout(() => {
    escritorio.rolando.delete(chave);
    const n = 1 + Math.floor(Math.random() * 6);
    escritorio.mapa?.estadosMoveis([[chave, n]]);
    escritorioEmitir("furni:toggle", { chave, estado: n });
    escritorioTocar(780, 0.08, 0.05);
  }, 1300);
}
// Quem não jogou vê o dado rolar antes do número novo.
function escritorioDadosRolaram(antes, depois) {
  const velho = new Map(antes || []);
  for (const [chave, estado] of depois || []) {
    if (!/^edice|^bottle@/.test(chave) || velho.get(chave) === estado || escritorio.rolando?.has(chave)) continue;
    escritorio.mapa?.estadosMoveis([[chave, /^bottle@/.test(chave) ? -1 : 100]]);
    setTimeout(() => escritorio.mapa?.estadosMoveis([[chave, estado]]), 1200);
  }
}
// Teleporte do Habbo: a cabine leva direto a outra sala (a tranca vale).
const ESCRITORIO_TELEPORTE = /teleport|_tele$/;
// Teleporte em par (como no Habbo, onde as cabines vêm ligadas duas a duas):
// nos espaços comuns, duas cabines do mesmo modelo levam uma à outra. Sem par
// (ou com três ou mais), a cabine abre a lista de salas.
function escritorioParDoTeleporte(m) {
  const cenas = [["praca", "geral"], ...ESCRITORIO_PLANTA.ambientes.filter((a) => a.cena).map((a) => [a.id, a.id])];
  const lista = cenas.flatMap(([cena, camada]) => escritorioItensDaCamada(camada).filter((it) => it[0] === m.classe).map((it) => ({ cena, x: Math.floor(it[1]), y: Math.floor(it[2]), dir: it[3] })));
  if (lista.length !== 2) return null;
  const aqui = lista.find((t) => t.cena === (escritorio.quarto || "praca") && t.x === Math.floor(m.x) && t.y === Math.floor(m.y));
  return aqui ? lista.find((t) => t !== aqui) : null;
}
function teletransportarParEscritorio(m, par) {
  const mapa = escritorio.mapa, chave = mapa.chaveMovel(m);
  if (par.cena !== "praca" && escritorioZonaBloqueada(par.cena)) { avisarTrancadaEscritorio(par.cena, true); return; }
  mapa.estadosMoveis([[chave, 2]]);
  escritorioTocar(880, 0.1, 0.05);
  // Sai pela frente da outra cabine (o ladrilho para onde ela está virada).
  const [dx, dy] = ESCRITORIO_PASSO_ESTEIRA[par.dir] || [0, 1];
  setTimeout(() => { mapa.estadosMoveis([[chave, 0]]); escritorioTrocarCena(par.cena === "praca" ? null : par.cena, { x: par.x + dx, y: par.y + dy }, par.dir); }, 700);
}
function abrirTeleporteEscritorio(m) {
  const par = escritorioParDoTeleporte(m);
  if (par) return teletransportarParEscritorio(m, par);
  const lugares = [...ESCRITORIO_PLANTA.ambientes, ESCRITORIO_PRACA].filter((a) => a.id !== (escritorio.quarto || "praca"));
  escritorio.teleporte = m;
  openWorkflowModal(`<div class="workflow-kicker">Teleporte</div><h2 class="workflow-title">Para onde?</h2><p>A cabine leva direto para a sala escolhida.</p><div class="workflow-actions ofc-teleporte">${lugares.map((a) => `<button type="button" class="workflow-secondary" onclick="closeWorkflowModal();teletransportarEscritorio('${safeText(a.id)}')">${safeText(a.nome)}</button>`).join("")}</div>`);
}
function teletransportarEscritorio(id) {
  const m = escritorio.teleporte, mapa = escritorio.mapa;
  if (!mapa || !m) return;
  if (id !== "praca" && (escritorioZonaBloqueada(id) || escritorioZonaBloqueada(escritorioRaizQuarto(id)))) { avisarTrancadaEscritorio(id, true); return; }
  const chave = mapa.chaveMovel(m);
  mapa.estadosMoveis([[chave, 2]]);
  escritorioTocar(880, 0.1, 0.05);
  setTimeout(() => { mapa.estadosMoveis([[chave, 0]]); escritorioIrParaAmbiente(id); }, 700);
}
// Dois cliques num móvel com estados (luminária, TV, lareira, fonte): passa
// para o próximo estado, e todos veem (como no Habbo).
function alternarComDuploCliqueEscritorio(x, y, objeto = null) {
  if (escritorio.edicao || !escritorio.mapa) return;
  // O móvel sob o pixel vale mais que o ladrilho do chão (Nitro).
  if (objeto?.tipo === "movel") { x = Math.floor(objeto.item.x); y = Math.floor(objeto.item.y); fecharFichaMovelEscritorio(); }
  const m = (escritorio.mapa.moveisEm(x, y) || []).find((i) => !i.parede && !ESCRITORIO_DADO.test(i.classe) && !ESCRITORIO_TELEPORTE.test(i.classe) && !MAPA_PORTAS.test(i.classe) && (escritorioEstadosDoMovel(i).length > 1 || ["relogio", "voto", "placar"].includes(escritorioLogica(i))));
  if (!m) return;
  if (/floor_switch/.test(m.classe)) return puxarAlavancaEscritorio(m);
  // Dois cliques: o relógio troca o tempo; contador e placar zeram.
  if (escritorioLogica(m) === "relogio") return tempoRelogioEscritorio(m);
  if (escritorioLogica(m) === "voto" || escritorioLogica(m) === "placar") { escritorioVotei.delete(escritorio.mapa.chaveMovel(m)); return escritorioMudarEstado(m, 0); }
  if (ESCRITORIO_GARRAFA.test(m.classe)) return girarGarrafaEscritorio(m);
  if (ESCRITORIO_ROLETA.test(m.classe)) return girarRoletaEscritorio(m);
  if (mapaEhPortao(m.classe) && !m.altura) return alternarPortaoEscritorio(m);
  const estados = escritorioEstadosDoMovel(m), i = estados.indexOf(m.estado || 0);
  const estado = estados[(i + 1) % estados.length];
  const chave = escritorio.mapa.chaveMovel(m);
  escritorio.mapa.estadosMoveis([[chave, estado]]);
  escritorioEmitir("furni:toggle", { chave, estado });
  escritorioTocar(estado ? 660 : 330, 0.08, 0.05);
}
// Estados que a arte do móvel tem (0 … 20), pela animação de cada um.
function escritorioEstadosDoMovel(m) {
  const v = m.m?.dados?.visualizations?.find((x) => x.size === 64);
  return Object.keys(v?.animations || {}).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 20).sort((a, b) => a - b);
}

// Poses (acenar, deitar, café na mão): vão para a equipe pelo Worker.
// O que vai na mão em cada pose (itens de mão do Habbo).
const ESCRITORIO_MAO = { cafe: "crr=6", bebida: "crr=1", lanche: "crr=5" };
// Aparelhos da academia: o boneco sobe nele e fica até andar.
const ESCRITORIO_APARELHOS = { exercicio: "esteira", bicicleta: "bicicleta" };
function escritorioAcaoDaPose(pose, sentado, deitado = false) {
  if (pose === "deitar" || deitado && !ESCRITORIO_APARELHOS[pose]) return "lay";
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
    if (String(o.id) === eu || !escritorioNaCena(o)) return false;
    const pos = escritorioPosicao(o);
    return Math.round(pos.x) === x && Math.round(pos.y) === y;
  });
}

function escritorioDestravar() {
  if (!escritorio.mapa) return;
  const p = escritorioPosicao(escritorio.perfil || {}), de = { x: Math.round(p.x), y: Math.round(p.y) };
  const quarto = escritorioAmbienteDoQuarto();
  const saida = escritorioEntradaDaSala(quarto || ESCRITORIO_PRACA);
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
// Cafeteira (a mesa de centro, "coffee table", não serve café).
const ESCRITORIO_CAFE = /coffeemachine|coffeemaker|coffeem$|^hc2_coffee$|^coffee_cup$|smiley_c23_coffee$/;
// Móveis que ligam e desligam (todos veem), o que se pega e onde se joga.
const ESCRITORIO_LIGAVEIS = [
  [/jukebox/, "a jukebox"], [/^hc25_6$/, "o som do DJ"], [/pinball/, "o pinball"],
  [/arcade|retrogames/, "o fliperama"], [/fireplace/, "a lareira"],
  [/floorlight|cine_light|lamp/, "a luz"],
];
const ESCRITORIO_BEBIDA = /fridge|water_dispenser|minibar|vending|vendingmchn|drinkmach|drinksmach|drinksvend|bubblejuicerack|cooler/;
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
// Portas dos vãos: abertas quando alguém está a até um ladrilho e meio
// delas. Sala trancada só abre para quem está liberado nela. Cada navegador
// calcula sozinho (presença já tem as posições), sem mensagem a mais.
function escritorioAtualizarPortas() {
  const P = ESCRITORIO_PLANTA, mapa = escritorio.mapa;
  if (!mapa || !P.portas?.length || escritorio.quarto) return;
  const eu = String(escritorio.base?.eu);
  const gente = [{ id: eu, ...(movimento.quadro ? { x: movimento.x, y: movimento.y } : escritorioPosicao(escritorio.perfil || {})) }];
  for (const o of escritorio.conectado ? escritorio.online || [] : []) if (String(o.id) !== eu && escritorioNaCena(o)) gente.push({ id: String(o.id), ...escritorioPosicao(o) });
  escritorio.portasAbertas ||= new Map();
  const mudou = [];
  for (const d of P.portas) {
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2, tranca = escritorio.trancas?.get(d.zona);
    const aberta = gente.some((q) => Math.abs(q.x + 0.5 - cx) <= 1.6 && Math.abs(q.y + 0.5 - cy) <= 1.6 && (!tranca || tranca.has(q.id)));
    const chave = `${d.classe}@${Math.floor(d.x)},${Math.floor(d.y)}`;
    if (escritorio.portasAbertas.get(chave) !== aberta) { escritorio.portasAbertas.set(chave, aberta); mudou.push([chave, aberta ? 1 : 0]); }
  }
  if (mudou.length) mapa.estadosMoveis(mudou);
}
// Lógicas oficiais do Habbo (logicType da arte, em fisica.json).
// Relógio de partida (FurnitureCounterClockLogic): clique inicia ou pausa;
// dois cliques trocam o tempo (30 s a 10 min, a lista da ficha do Habbo). O
// de contagem para cima (…up) sobe de zero. Quem inicia mantém o relógio e
// manda o número a cada segundo para todos.
const ESCRITORIO_TEMPOS_RELOGIO = [30, 60, 120, 180, 300, 600];
const escritorioRelogios = new Map();
const escritorioLogica = (m) => (typeof mapaFisica === "function" ? mapaFisica(m.classe).logica : null);
const escritorioSobe = (m) => /up$/.test(m.classe);
function escritorioMudarEstado(m, estado) {
  const chave = escritorio.mapa.chaveMovel(m);
  escritorio.mapa.estadosMoveis([[chave, estado]]);
  escritorioEmitir("furni:toggle", { chave, estado });
}
function relogioEscritorio(m) {
  const chave = escritorio.mapa.chaveMovel(m), r = escritorioRelogios.get(chave);
  if (r) { clearInterval(r.timer); escritorioRelogios.delete(chave); escritorioTocar(330, 0.08, 0.05); return; }
  if (!escritorioSobe(m) && !(m.estado > 0)) escritorioMudarEstado(m, ESCRITORIO_TEMPOS_RELOGIO[0]);
  const timer = setInterval(() => {
    const atual = escritorio.mapa?.moveisDaClasse?.(new RegExp("^" + m.classe + "$")).find((x) => escritorio.mapa.chaveMovel(x) === chave);
    if (!atual) { clearInterval(timer); escritorioRelogios.delete(chave); return; }
    const n = escritorioSobe(m) ? Math.min(5999, (atual.estado || 0) + 1) : Math.max(0, (atual.estado || 0) - 1);
    escritorioMudarEstado(atual, n);
    if (!escritorioSobe(m) && n === 0) { clearInterval(timer); escritorioRelogios.delete(chave); escritorioTocar(880, 0.3, 0.08); escritorioAviso("O tempo acabou."); }
  }, 1000);
  escritorioRelogios.set(chave, { timer });
  escritorioTocar(660, 0.08, 0.05);
}
function tempoRelogioEscritorio(m) {
  const chave = escritorio.mapa.chaveMovel(m), r = escritorioRelogios.get(chave);
  if (r) { clearInterval(r.timer); escritorioRelogios.delete(chave); }
  if (escritorioSobe(m)) return escritorioMudarEstado(m, 0);
  const i = ESCRITORIO_TEMPOS_RELOGIO.indexOf(m.estado || 0);
  escritorioMudarEstado(m, ESCRITORIO_TEMPOS_RELOGIO[(i + 1) % ESCRITORIO_TEMPOS_RELOGIO.length]);
}
// Contador de votos e placar (FurnitureVoteCounter/Score): clique soma um;
// dois cliques zeram. No contador de votos cada pessoa vota uma vez.
const escritorioVotei = new Set();
function contarEscritorio(m) {
  const chave = escritorio.mapa.chaveMovel(m);
  if (escritorioLogica(m) === "voto") {
    if (escritorioVotei.has(chave)) return escritorioAviso("Você já votou neste contador.");
    escritorioVotei.add(chave);
  }
  escritorioMudarEstado(m, Math.min(999, (m.estado || 0) + 1));
  escritorioTocar(660, 0.06, 0.04);
}
// Funil (FurnitureRandomTeleportLogic): leva a outro funil, sorteado, de
// qualquer espaço comum ou da Praça.
function funilEscritorio(m) {
  const cenas = [["praca", "geral"], ...ESCRITORIO_PLANTA.ambientes.filter((a) => a.cena).map((a) => [a.id, a.id])];
  const aqui = escritorio.quarto || "praca";
  const outros = cenas.flatMap(([cena, camada]) => escritorioItensDaCamada(camada).filter((it) => escritorioLogica({ classe: it[0] }) === "funil")
    .map((it) => ({ cena, x: Math.floor(it[1]), y: Math.floor(it[2]), dir: it[3] }))).filter((t) => !(t.cena === aqui && t.x === Math.floor(m.x) && t.y === Math.floor(m.y)));
  if (!outros.length) return escritorioAviso("Não há outro funil para onde ir.");
  const par = outros[Math.floor(Math.random() * outros.length)];
  teletransportarParEscritorio(m, par);
}
// Quebrável: cada clique é um golpe, para todos; no último ela abre.
function quebrarEscritorio(m) {
  const golpes = (m.estado || 0) + 1;
  if ((m.estado || 0) >= MAPA_GOLPES_QUEBRAVEL) return escritorioAviso("Já está aberto.");
  escritorioMudarEstado(m, golpes);
  escritorioTocar(golpes >= MAPA_GOLPES_QUEBRAVEL ? 990 : 300 + golpes * 30, 0.08, 0.05);
  if (golpes >= MAPA_GOLPES_QUEBRAVEL) escritorioAviso("Abriu!");
  else escritorioAviso(`Faltam ${MAPA_GOLPES_QUEBRAVEL - golpes} ${MAPA_GOLPES_QUEBRAVEL - golpes === 1 ? "golpe" : "golpes"} para abrir.`);
}
// TV e projetor (furniture_youtube): quem usa escolhe passar um vídeo do
// YouTube para quem está no espaço ou compartilhar a própria tela na
// conversa da sala. O vídeo vai a todos por comando no chat (tv=cena:id).
function abrirTvEscritorio(m) {
  // A tela vai pela conversa do espaço (mostrarTelaEscritorio entra nela se
  // preciso); Foco e Praça não têm conversa.
  const comConversa = Boolean(escritorio.zona && escritorio.zona !== "foco");
  escritorio.tvAtual = m;
  openWorkflowModal(`<div class="workflow-kicker">TV</div><h2 class="workflow-title">O que passar?</h2>
<form class="ofc-gatilho" onsubmit="event.preventDefault();passarVideoEscritorio(this.elements.url.value)">
<label>Vídeo do YouTube (link)<input name="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" required></label>
<div class="workflow-actions"><button type="submit" class="workflow-primary">Passar o vídeo</button>
<button type="button" class="workflow-secondary" onclick="closeWorkflowModal();compartilharTelaNaTvEscritorio()"${comConversa ? "" : " disabled"}>Compartilhar minha tela</button>
<button type="button" class="workflow-secondary" onclick="closeWorkflowModal();passarVideoEscritorio('')">Desligar</button></div>
${comConversa ? "" : '<p class="ofc-nota">Aqui não há conversa por voz, então não dá para compartilhar a tela.</p>'}</form>`);
}
function escritorioIdYoutube(url) {
  const m = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(String(url || "").trim());
  return m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(String(url || "").trim()) ? String(url).trim() : null;
}
function passarVideoEscritorio(url) {
  const id = url ? escritorioIdYoutube(url) : "";
  if (url && !id) return escritorioAviso("Esse link não é de um vídeo do YouTube.");
  closeWorkflowModal();
  const cena = escritorio.quarto || "praca";
  if (escritorio.tvAtual && escritorioEstadosDoMovel(escritorio.tvAtual).length > 1) escritorioMudarEstado(escritorio.tvAtual, id ? 1 : 0);
  mostrarTvEscritorio(id, String(escritorio.base?.eu));
  escritorioEmitir("chat:bubble", { texto: ESCRITORIO_COMANDO + "tv=" + cena + ":" + id });
}
async function compartilharTelaNaTvEscritorio() {
  if (escritorio.tvAtual && escritorioEstadosDoMovel(escritorio.tvAtual).length > 1) escritorioMudarEstado(escritorio.tvAtual, 1);
  await mostrarTelaEscritorio();
}
function mostrarTvEscritorio(id, quem) {
  document.getElementById("office-tv")?.remove();
  if (!id) return;
  const nome = String((escritorio.online || []).find((o) => String(o.id) === String(quem))?.nome || (String(quem) === String(escritorio.base?.eu) ? "Você" : "Alguém")).split(" ")[0];
  const caixa = document.createElement("section");
  caixa.id = "office-tv"; caixa.className = "ofc-tv"; caixa.setAttribute("aria-label", "TV do espaço");
  caixa.innerHTML = `<header><span>TV · ${safeText(nome)} passou</span><button type="button" aria-label="Fechar a TV" onclick="document.getElementById('office-tv')?.remove()">×</button></header>
<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0" title="Vídeo do YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  (document.querySelector(".ofc") || document.body).append(caixa);
}
// Troféu (furniture_trophy): mostra a dedicatória gravada (quem, quando e o
// texto), como no Habbo; quem decora grava no editor (Configurar).
function verTrofeuEscritorio(m) {
  const it = escritorioItensDaCamada(escritorio.quarto || "geral")[m.origem?.i];
  const cfg = it?.[6] && typeof it[6] === "object" ? it[6] : {};
  openWorkflowModal(`<div class="workflow-kicker">${escritorioLogica(m) === "cadeado" ? "Cadeado do amor" : "Troféu"}</div><h2 class="workflow-title">${safeText(cfg.n || "Sem nome gravado")}</h2>
${cfg.d ? `<p class="ofc-nota">${safeText(cfg.d.split("-").reverse().join("/"))}</p>` : ""}<p>${safeText(cfg.t || "Este troféu ainda não tem dedicatória.")}</p>
<div class="workflow-actions"><button type="button" class="workflow-primary" onclick="closeWorkflowModal()">Fechar</button></div>`);
}
// Manequim (furniture_mannequin): quem decora guarda nele o próprio visual
// (no editor); qualquer um veste o visual guardado, como no Habbo.
async function vestirManequimEscritorio(m) {
  const it = escritorioItensDaCamada(escritorio.quarto || "geral")[m.origem?.i];
  const f = it?.[6]?.f;
  if (!f) return escritorioAviso("Este manequim ainda não tem um visual guardado.");
  if (!confirm("Vestir o visual do manequim? Seu personagem muda para todos.")) return;
  const perfil = { ...escritorio.perfil, figura: f };
  try {
    const salvo = escritorio.base.demo ? perfil : (await escritorioApi("perfil", { perfil })).perfil;
    escritorio.perfil = { ...escritorio.perfil, ...salvo };
    const eu = escritorio.base.equipe.find((p) => p.id === escritorio.base.eu);
    if (eu) eu.perfil = { ...eu.perfil, ...salvo };
    escritorioAplicarSalas();
    renderEscritorio();
    if (!escritorio.base.demo) mapaGuardarBoneco(salvo.figura);
    escritorioAviso("Visual trocado.");
  } catch (e) { escritorioAviso("Não deu para trocar o visual: " + e.message); }
}
// Peças que se usam pela lógica oficial (antes de cair nas regras pelo nome).
function escritorioAcaoPelaLogica(m) {
  const l = escritorioLogica(m);
  if (l === "quebravel") return { item: m, texto: "Dar um golpe", fazer: () => quebrarEscritorio(m) };
  if (l === "tv" || ESCRITORIO_TELAS.test(m.classe)) return { item: m, texto: "Usar a TV", fazer: () => abrirTvEscritorio(m) };
  if (l === "trofeu" || l === "cadeado") return { item: m, texto: l === "cadeado" ? "Ler o cadeado" : "Ler a dedicatória", fazer: () => verTrofeuEscritorio(m) };
  if (l === "manequim") return { item: m, texto: "Vestir este visual", fazer: () => vestirManequimEscritorio(m) };
  if (l === "relogio") return { item: m, texto: escritorioRelogios.has(escritorio.mapa.chaveMovel(m)) ? "Pausar o relógio" : "Iniciar o relógio", fazer: () => relogioEscritorio(m) };
  if (l === "voto") return { item: m, texto: "Votar", fazer: () => contarEscritorio(m) };
  if (l === "placar") return { item: m, texto: "Somar um ponto", fazer: () => contarEscritorio(m) };
  if (l === "funil") return { item: m, texto: "Entrar no funil", fazer: () => funilEscritorio(m) };
  if (l === "link") return { item: m, texto: "Abrir o painel", fazer: () => abrirPainelDoEscritorio() };
  return null;
}
// Regulador de luz do Habbo (roomdimmer e interruptores de parede): no
// próprio quarto abre a Luz do quarto (sala_luz, que tinge tudo); fica aceso
// quando o quarto tem uma luz escolhida.
const ESCRITORIO_REGULADOR = /^(roomdimmer|dimmer_(buttn|swtch|fuse2|fuse6|steampunk))$/;
function regularLuzEscritorio() {
  const mesa = escritorioMinhaMesa();
  if (!mesa || escritorio.quarto !== mesa.ambiente.id) return escritorioAviso("Só o dono do quarto regula a luz dele.");
  escritorioPincel().ferramenta = "luz";
  abrirEstiloSalaEscritorio();
}
function escritorioAcenderReguladores() {
  const mapa = escritorio.mapa;
  if (!mapa?.moveisDaClasse) return;
  const acesa = Boolean(document.querySelector(".mapa-palco")?.dataset.luz);
  const lista = mapa.moveisDaClasse(ESCRITORIO_REGULADOR).map((m) => [mapa.chaveMovel(m), acesa ? 1 : 0]);
  if (lista.length) mapa.estadosMoveis(lista);
}
// O que um móvel faz quando a pessoa está ao lado dele (o mesmo da tecla E).
function escritorioAcaoDoMovel(m) {
  if (!m) return null;
  const pelaLogica = escritorioAcaoPelaLogica(m);
  if (pelaLogica) return pelaLogica;
  if (ESCRITORIO_CAFE.test(m.classe)) return { item: m, fazer: () => definirPoseEscritorio(escritorio.pose === "cafe" ? "" : "cafe") };
  if (ESCRITORIO_BEBIDA.test(m.classe) || ESCRITORIO_LANCHE.test(m.classe)) {
    const tipo = ESCRITORIO_BEBIDA.test(m.classe) ? "bebida" : "lanche";
    return { item: m, fazer: () => definirPoseEscritorio(escritorio.pose === tipo ? "" : tipo) };
  }
  if (/treadmill|bicycle/.test(m.classe)) return { item: m, fazer: () => usarAparelhoEscritorio(m, /bicycle/.test(m.classe) ? "bicicleta" : "exercicio") };
  if (ESCRITORIO_DADO.test(m.classe)) return { item: m, texto: "Jogar o dado", fazer: () => rolarDadoEscritorio(m) };
  if (mapaEhPortao(m.classe) && !m.altura) return { item: m, texto: m.estado ? "Fechar o portão" : "Abrir o portão", fazer: () => alternarPortaoEscritorio(m) };
  if (/floor_switch/.test(m.classe)) return { item: m, texto: "Puxar a alavanca", fazer: () => puxarAlavancaEscritorio(m) };
  if (ESCRITORIO_MAO_UNICA.test(m.classe)) return { item: m, texto: "Passar pela catraca", fazer: () => passarMaoUnicaEscritorio(m) };
  if (ESCRITORIO_GARRAFA.test(m.classe)) return { item: m, texto: "Girar a garrafa", fazer: () => girarGarrafaEscritorio(m) };
  if (ESCRITORIO_ROLETA.test(m.classe)) return { item: m, texto: "Girar a roleta", fazer: () => girarRoletaEscritorio(m) };
  if (ESCRITORIO_TELEPORTE.test(m.classe)) return { item: m, texto: "Teletransportar", fazer: () => abrirTeleporteEscritorio(m) };
  if (/jukebox|^hc25_6$/.test(m.classe) && escritorioNaPista()) return { item: m, fazer: abrirMusicaEscritorio };
  if (ESCRITORIO_LIGAVEIS.some(([re]) => re.test(m.classe))) return { item: m, fazer: () => alternarMovelEscritorio(m) };
  return null;
}
// Clique num móvel que se usa (luz, jukebox, geladeira, esteira, fliperama…):
// anda até o ladrilho livre ao lado dele e usa ao chegar.
function escritorioUsarAoClicar(x, y) {
  // Regulador de luz na parede: como no Habbo, abre direto, sem andar até ele.
  if ((escritorio.mapa?.moveisEm(x, y) || []).some((i) => ESCRITORIO_REGULADOR.test(i.classe))) { regularLuzEscritorio(); return true; }
  // (o dado pode estar em cima de uma mesa)
  const m = (escritorio.mapa?.moveisEm(x, y) || []).find((i) => !i.plano && (!i.altura || ESCRITORIO_DADO.test(i.classe)) && !i.parede && escritorioAcaoDoMovel(i));
  if (!m) return false;
  // Máquina de café, geladeira e afins: como no Habbo, usa-se pela frente
  // (o ladrilho para onde ela está virada), se ele estiver livre.
  const frente = (ESCRITORIO_CAFE.test(m.classe) || ESCRITORIO_BEBIDA.test(m.classe) || ESCRITORIO_LANCHE.test(m.classe)) && escritorioFrenteDoMovel(m);
  const frenteLivre = frente && escritorio.mapa.caminho({ x: Math.round(movimento.quadro ? movimento.x : escritorioPosicao(escritorio.perfil || {}).x), y: Math.round(movimento.quadro ? movimento.y : escritorioPosicao(escritorio.perfil || {}).y) }, frente) && !escritorioOcupado(frente.x, frente.y);
  const lado = frenteLivre ? frente : escritorioLadoLivre({ x: Math.floor(m.x), y: Math.floor(m.y), w: Math.max(1, Math.round(m.dim.x)), h: Math.max(1, Math.round(m.dim.y)) });
  if (!lado) return false;
  escritorio.usarAoChegar = m;
  escritorioIrPara(lado.x, lado.y);
  // Já está ao lado: usa na hora.
  if (!movimento.rota.length && Math.round(movimento.x) === lado.x && Math.round(movimento.y) === lado.y) { escritorio.usarAoChegar = null; escritorioAcaoDoMovel(m)?.fazer(); }
  return true;
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
    if (String(o.id) === eu || !escritorioNaCena(o)) return false;
    const q = escritorioPosicao(o), qx = Math.round(q.x), qy = Math.round(q.y);
    if (Math.max(Math.abs(qx - p.x), Math.abs(qy - p.y)) > 2) return false;
    // Busca limitada a 3 passos: sem caminho curto, para logo (não varre o mapa).
    const passos = escritorio.mapa.caminho(p, { x: qx, y: qy }, null, 3);
    return Boolean(passos && passos.length <= 3);
  });
  // Numa sala com voz, todos ali já estão na mesma conversa: sem convite. No
  // corredor ou no Foco, o convite leva os dois até uma sala para conversar.
  const salaComVoz = escritorio.zona && escritorio.zona !== "foco";
  if (vizinho && ESCRITORIO_MAO[escritorio.pose])
    return { texto: `Dar ${ESCRITORIO_NOME_MAO[escritorio.pose]} para ${String(vizinho.nome).split(" ")[0]}`, fazer: () => darItemEscritorio(vizinho.id) };
  if (vizinho && !salaComVoz) {
    const destino = ESCRITORIO_PLANTA.ambientes.find((a) => a.id === escritorioZonaDeConversa())?.nome || "uma sala";
    return { texto: `Chamar ${String(vizinho.nome).split(" ")[0]} para ${destino}`, fazer: () => convidarConversaEscritorio(vizinho.id) };
  }
  // Ao lado da porta (a soleira, fora do piso da cena): sair por ela.
  // Só a soleira (o vão da porta) leva para fora: encostar na parede, não.
  const aqui = escritorioAmbienteDoQuarto() || ESCRITORIO_PRACA, pt = escritorioPortaQuarto(aqui), { w: lw, h: lh } = escritorioDimQuarto(aqui);
  const naSoleira = (x, y) => pt.lado === "baixo" ? y - aqui.y0 === lh && x - aqui.x0 >= pt.x && x - aqui.x0 <= pt.x + 1 : x - aqui.x0 === lw && y - aqui.y0 >= pt.y && y - aqui.y0 <= pt.y + 1;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = p.x + dx, y = p.y + dy;
    if (naSoleira(x, y)) return { texto: "Ir para " + escritorioDestinoDaPorta(escritorio.quarto).nome, fazer: escritorioSairDoQuarto };
  }
  const perto = escritorio.mapa.moveisPerto(p.x, p.y, 1);
  const mesa = escritorioNoMeuQuarto() ? escritorioMinhaMesa() : null;
  if (mesa) {
    const naMesa = perto.find((m) => (m.classe === "exe_table" || /computer|laptop/.test(m.classe)) && Math.floor(m.x) === mesa.x && Math.floor(m.y) === mesa.y);
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
  const usavel = perto.find((m) => ESCRITORIO_DADO.test(m.classe) || ESCRITORIO_TELEPORTE.test(m.classe) || mapaEhPortao(m.classe) && !m.altura || /floor_switch/.test(m.classe)
    || ESCRITORIO_GARRAFA.test(m.classe) || ESCRITORIO_ROLETA.test(m.classe)
    || ESCRITORIO_MAO_UNICA.test(m.classe) && (() => { const f = escritorioFrenteDoMovel(m); return f.x === p.x && f.y === p.y; })());
  if (usavel) return escritorioAcaoDoMovel(usavel);
  const aparelho = perto.find((m) => /treadmill|bicycle/.test(m.classe));
  if (aparelho) {
    const pose = /bicycle/.test(aparelho.classe) ? "bicicleta" : "exercicio";
    return { item: aparelho, texto: pose === "bicicleta" ? "Pedalar" : "Correr na esteira", fazer: () => usarAparelhoEscritorio(aparelho, pose) };
  }
  const tela = escritorio.mapa.moveisPerto(p.x, p.y, 2).find((m) => ESCRITORIO_TELAS.test(m.classe));
  if (tela) return { item: tela, texto: "Usar a TV", fazer: () => abrirTvEscritorio(tela) };
  // No Lounge, a jukebox e a cabine do DJ são o bot de música da sala.
  const som = escritorioNaPista() && perto.find((m) => /jukebox|^hc25_6$/.test(m.classe));
  if (som) return { item: som, texto: "Abrir a música", fazer: abrirMusicaEscritorio };
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
    // Em outra cena (entrou num quarto, ou saiu dele): vai até lá e volta a seguir.
    if (!escritorioNaCena(o)) { clearInterval(escritorio.timerSeguir); escritorio.aoChegarNaCena = () => seguirPessoaEscritorio(id); escritorioIrParaAmbiente(String(o.zona || "") || "praca"); return; }
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
  escritorio.aoChegarNaCena = null;
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
  // Fora do próprio quarto: vai até a porta dele e, lá dentro, até a cadeira.
  if (!escritorioNoMeuQuarto()) { escritorio.aoChegarNaCena = irParaMinhaMesaEscritorio; escritorioIrParaAmbiente(mesa.ambiente.id); return; }
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
  // No botão do Painel conta só o que chegou desde a última vez que a pessoa
  // abriu o Painel (o total continua no cartão da mesa).
  let visto = 0;
  try { visto = Number(localStorage.getItem("vybe-escritorio-avisos-visto")) || 0; if (!visto) { visto = Date.now(); localStorage.setItem("vybe-escritorio-avisos-visto", String(visto)); } } catch {}
  escritorio.avisosNovos = naoLidas.filter((n) => Date.parse(n.criada_em) > visto).length;
  escritorio.avisosVistos = new Set(naoLidas.map((n) => String(n.id)));
  const mesa = escritorioNoMeuQuarto() ? escritorioMinhaMesa() : null;
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
  try { localStorage.setItem("vybe-escritorio-avisos-visto", String(Date.now())); } catch {}
  escritorio.avisosNovos = 0;
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
  abrirAberturaEscritorio("espaco");
}
// Clientes: a lista do cadastro (o mesmo da aba Clientes) com dois atalhos por
// cliente: a ficha dele na aba Clientes (com tudo do cliente) e o VybeHub
// (portal do cliente, vybehub.vercel.app/cliente/<nome-do-cliente>).
const ESCRITORIO_VYBEHUB = "https://vybehub.vercel.app";
function escritorioSlugCliente(nome) {
  return String(nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
async function carregarClientesEscritorio() {
  if (typeof ensureClientMasterSources !== "function") return;
  if (typeof CLIENT_MASTER_LOADED !== "undefined" && CLIENT_MASTER_LOADED) { atualizarClientesEscritorio(); return; }
  try { await ensureClientMasterSources(); } catch {}
  atualizarClientesEscritorio();
}
function atualizarClientesEscritorio() {
  const el = document.getElementById("office-clientes");
  if (!el) return;
  const busca = el.querySelector("input")?.value || escritorio.buscaCliente || "";
  el.innerHTML = escritorioClientesHtml();
  const campo = el.querySelector("input");
  if (campo && busca) { campo.value = busca; campo.focus(); campo.setSelectionRange(busca.length, busca.length); }
}
function escritorioClientesHtml() {
  const lista = typeof CADASTRO_CLIENTES === "undefined" ? [] : CADASTRO_CLIENTES;
  if (!lista.length) {
    const erro = typeof CLIENT_MASTER_ERROR !== "undefined" && CLIENT_MASTER_ERROR;
    return `<div class="office-chat-head"><h3>Clientes</h3></div><p class="ofc-nota">${erro ? safeText(erro) : "Carregando clientes…"}</p>`;
  }
  const busca = (escritorio.buscaCliente || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const ativo = (c) => c.ativo !== false && !/inativ/i.test(String(c.status || ""));
  const filtrados = lista.filter((c) => !busca || String(c.nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(busca))
    .sort((a, b) => Number(ativo(b)) - Number(ativo(a)) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  const linha = (c) => {
    const nome = String(c.nome || ""), arg = safeText(JSON.stringify(nome));
    return `<li class="${ativo(c) ? "" : "inativo"}"><b>${safeText(nome)}</b>${ativo(c) ? "" : "<small>Inativo</small>"}<div><button type="button" class="ofc-mini" onclick='abrirClienteNoPainelEscritorio(${arg})' title="Conteúdos, solicitações, dados e acessos do cliente">Ver cliente</button><a class="ofc-mini" href="${ESCRITORIO_VYBEHUB}/cliente/${encodeURIComponent(escritorioSlugCliente(nome))}" target="_blank" rel="noopener">VybeHub ↗</a></div></li>`;
  };
  return `<div class="office-chat-head"><h3>Clientes</h3><a class="office-text-button" href="${ESCRITORIO_VYBEHUB}/admin" target="_blank" rel="noopener">VybeHub admin ↗</a></div>
<input type="search" class="ofc-busca-cliente" placeholder="Buscar cliente" aria-label="Buscar cliente" value="${safeText(escritorio.buscaCliente || "")}" oninput="escritorio.buscaCliente=this.value;atualizarClientesEscritorio()" autocomplete="off">
<ul class="ofc-clientes-lista">${filtrados.map(linha).join("") || '<li class="ofc-vazio">Nenhum cliente com esse nome.</li>'}</ul>`;
}
// Abre a ficha do cliente na aba Clientes (conteúdos, solicitações, heads,
// dados e acessos) — o mesmo caminho da agenda (managerCalendarOpenClientMaster).
function abrirClienteNoPainelEscritorio(nome) {
  abrirPainelDoEscritorio("clientes");
  const nomeCerto = typeof clientMasterResolveName === "function" ? clientMasterResolveName(nome) || nome : nome;
  setTimeout(() => { if (typeof abrirClienteDetalhe === "function") abrirClienteDetalhe(nomeCerto); }, 120);
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
  escritorioMarcarRecados();
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
    const d = await r.json().catch(() => ({}));
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
  escritorioDigitando(false);
  // Comandos do Habbo no chat (":sit", ":sentar"): fazem e não viram mensagem.
  if (/^:(sit|sentar)$/i.test(texto.trim())) { input.value = ""; btn.disabled = false; input.disabled = false; sentarNoChaoEscritorio(); return; }
  const chave = form.dataset.chave || crypto.randomUUID();
  form.dataset.chave = chave;
  try {
    await escritorioApi("mensagem", { sala, texto, chave });
    input.value = "";
    delete form.dataset.chave;
    escritorioEmitir("chat:changed", { sala });
    escritorioEmitir("chat:bubble", { texto });
    if (typeof gatilhoFalaEscritorio === "function") gatilhoFalaEscritorio(texto);
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
// A tela mostrada vai sem áudio do computador: com ele, a voz de quem está na
// conversa era capturada de novo e voltava para a sala (voz em dobro, com
// atraso). O SDK sempre pede áudio; aqui o pedido sai sem.
function escritorioTelaSemAudio() {
  const md = navigator.mediaDevices;
  if (!md?.getDisplayMedia || md.getDisplayMedia.vybeSemAudio) return;
  const original = md.getDisplayMedia.bind(md);
  const semAudio = (c = {}) => original({ ...c, audio: false, systemAudio: "exclude", selfBrowserSurface: "exclude", surfaceSwitching: "include" });
  semAudio.vybeSemAudio = true;
  md.getDisplayMedia = semAudio;
}
function escritorioMotorVoz() {
  escritorioTelaSemAudio();
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
// Canal de voz: os espaços abertos dividem uma conversa só ("escritorio") e
// cada um ouve apenas quem está na mesma sala; trocar de sala é instantâneo.
// Sala trancada tem conversa própria (o som não sai dela). Foco e corredor
// não têm voz (o microfone desliga, nada toca).
function escritorioCanal(zona = escritorio.zona) {
  if (!zona || zona === "foco") return null;
  return escritorio.trancas?.has(zona) ? zona : "escritorio";
}
function escritorioConversaAutomatica() {
  clearTimeout(escritorio.timerConversa);
  if (!escritorio.conectado || escritorio.base?.demo) return;
  // Corredor/Foco: fica na conversa geral (pronta para a próxima sala), só
  // sem microfone e sem som; da sala trancada, sai.
  const alvo = escritorioCanal() || "escritorio";
  escritorioMotorVoz().catch(() => {});
  if (escritorio.chamada && escritorio.canalChamada === alvo) { escritorioSincronizarVoz(); return; }
  if (escritorio.entrandoChamada) { escritorio.timerConversa = setTimeout(escritorioConversaAutomatica, 800); return; }
  escritorioTokenDaZona(alvo);
  escritorio.timerConversa = setTimeout(async () => {
    if ((escritorioCanal() || "escritorio") !== alvo || escritorio.entrandoChamada) return;
    if (escritorio.chamada && escritorio.canalChamada !== alvo) await sairChamadaEscritorio();
    if (!escritorio.chamada) await entrarChamadaEscritorio({ canal: alvo });
  }, alvo === "escritorio" ? 0 : 400);
}
// Microfone e som acompanham o lugar, sem sair da conversa: na sala, o
// microfone volta como a pessoa deixou; no corredor ou no Foco, desliga.
async function escritorioSincronizarVoz() {
  const m = escritorio.chamada;
  if (!m) return;
  const ativa = Boolean(escritorioCanal());
  const quer = escritorio.microfoneQuer !== false;
  try {
    if (ativa && quer && !m.self.audioEnabled && !escritorio.erroMic) {
      await m.self.enableAudio();
      if (!m.self.audioEnabled) { escritorio.erroMic = await escritorioDiagnosticarMic(); escritorio.callAberta = true; }
    } else if (!ativa && m.self.audioEnabled) await m.self.disableAudio();
  } catch {
    if (ativa) { escritorio.erroMic = await escritorioDiagnosticarMic(); escritorio.callAberta = true; }
  }
  if (!ativa && m.self.screenShareEnabled) await m.self.disableScreenShare().catch(() => {});
  escritorioTocarVozes();
  renderMidiaEscritorio();
  atualizarControlesEscritorio();
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
async function entrarChamadaEscritorio({ canal = escritorioCanal() || "escritorio", microfone = Boolean(escritorioCanal()) && escritorio.microfoneQuer !== false } = {}) {
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
    escritorio.etapaVoz = "pedindo acesso à conversa";
    atualizarControlesEscritorio();
    const d = await escritorioComPrazo(escritorioTokenDaZona(canal), 12000, "servidor da conversa");
    escritorio.tokenPrevio = null; // cada token entra uma vez
    if (geracao !== escritorio.geracao || !escritorio.conectado)
      throw new Error("Entrada na chamada cancelada.");
    escritorio.etapaVoz = "carregando o motor de chamadas";
    await escritorioComPrazo(escritorioMotorVoz(), 20000, "carregando o motor de chamadas");
    escritorio.etapaVoz = "conectando o áudio";
    // O próprio SDK toca o áudio de todos (um elemento só, sem eco de cópias);
    // se o navegador bloquear, aparece o botão "Ativar som da conversa".
    // Com microfone, o SDK já pega o áudio enquanto entra (mais rápido que
    // ligar depois de entrar). Se o microfone for negado, entra só ouvindo.
    const iniciar = (audio) => escritorioComPrazo(window.RealtimeKitClient.init({
      authToken: d.authToken,
      defaults: { audio, video: false, mediaConfiguration: { audio: escritorioPrefsAudio(), screenshare: escritorioLimiteTela() } },
      // O som de cada pessoa é tocado pelo painel (escritorioTocarVozes): só
      // quem está na mesma sala, com o volume de cada um e sem cópias.
      modules: { experimentalAudioPlayback: false },
    }), 20000, "iniciando a chamada");
    try { meeting = await iniciar(Boolean(microfone)); }
    catch (e) { if (!microfone) throw e; console.warn("Chamada com microfone:", e); meeting = await iniciar(false); }
    escritorioNivelAudio.iniciar();
    await escritorioComPrazo(meeting.join(), 20000, "entrando na sala de voz");
    escritorioAplicarDispositivos(meeting);
    escritorioAplicarFiltroVoz(meeting);
    if (geracao !== escritorio.geracao || !escritorio.conectado)
      throw new Error("Entrada na chamada cancelada.");
    escritorio.chamada = meeting;
    escritorio.canalChamada = canal;
    escritorio.zonaChamada = canal;
    escritorio.tentativasVoz = 0;
    escritorio.etapaVoz = "";
    escritorio.falhaConversa = "";
    for (const evento of [
      "participantJoined",
      "participantLeft",
      "audioUpdate",
      "videoUpdate",
      "screenShareUpdate",
    ])
      meeting.participants.joined.on(evento, () => { escritorioTocarVozes(); renderMidiaEscritorio(); });
    for (const evento of ["audioUpdate", "videoUpdate", "screenShareUpdate"])
      meeting.self.on(evento, renderMidiaEscritorio);
    // O navegador bloqueou o som até a pessoa interagir: o próximo clique ou
    // tecla em qualquer lugar já libera (o botão fica como atalho visível).
    // A conversa caiu sozinha (rede, servidor de mídia): entra de novo na
    // mesma sala sem a pessoa precisar fazer nada.
    meeting.self.on("roomLeft", () => {
      if (escritorio.chamada !== meeting) return;
      escritorio.chamada = null;
      escritorioNivelAudio.parar();
      escritorioPararVozes();
      escritorioAviso("A conversa caiu. Reconectando…");
      atualizarDockEscritorio();
      escritorioTentarVozDeNovo();
    });
    meeting.self.on("autoplayError", () => {
      escritorio.somBloqueado = true;
      renderMidiaEscritorio();
      const liberar = async () => {
        try { await meeting.self.playAudio(); escritorio.somBloqueado = false; renderMidiaEscritorio(); } catch {}
      };
      document.addEventListener("pointerdown", liberar, { once: true, capture: true });
      document.addEventListener("keydown", liberar, { once: true, capture: true });
    });
    // Mudou de lugar enquanto entrava: a conversa geral só acerta microfone e
    // som; a de uma sala trancada que ficou para trás é deixada.
    if ((escritorioCanal() || "escritorio") !== canal) { await sairChamadaEscritorio(); escritorioConversaAutomatica(); return; }
    let semMicrofone = false;
    escritorio.erroMic = null;
    if (microfone && !meeting.self.audioEnabled) {
      // Na primeira vez o navegador pergunta: a pessoa precisa clicar em Permitir.
      escritorioAviso("Clique em Permitir no aviso do navegador para usar o microfone.");
      try { await meeting.self.enableAudio(); } catch (e) { semMicrofone = true; console.warn("Microfone:", e); }
      if (!meeting.self.audioEnabled) { semMicrofone = true; escritorio.erroMic = await escritorioDiagnosticarMic(); escritorio.callAberta = true; }
    }
    renderEscritorio();
    escritorioTocarVozes();
    if (!escritorioCanal()) return;
    escritorioAviso(!microfone ? "Conversa aberta. Microfone e câmera estão desligados."
      : semMicrofone ? "Você está ouvindo, mas seu microfone não ligou: " + (escritorio.erroMic?.titulo || "veja o motivo na conversa").toLowerCase() + "."
      : "Você entrou na conversa da sala: quem está aqui ouve você. Clique no microfone para silenciar.");
  } catch (e) {
    console.warn("Conversa do escritório:", e);
    await meeting?.leave().catch(() => {});
    escritorio.falhaConversa = e.message;
    escritorio.etapaVoz = "";
    escritorioAviso(e.message + " Tentando de novo…");
    escritorioTentarVozDeNovo();
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
// Filtro de voz (ligado por padrão): corta graves de ambiente (ventilador,
// carro, ar-condicionado) e fecha o microfone quando o som fica abaixo do
// limite de sensibilidade (cachorro longe, TV baixa, teclado). Roda no próprio
// navegador, como um passo antes de enviar a voz.
const escritorioFiltroVoz = { limite: 0.018 };
function escritorioLimiteFiltro() {
  const p = escritorioLerPrefsAudio();
  // Sensibilidade 1 (pega tudo) a 10 (só voz próxima); padrão 5.
  const sens = Math.min(10, Math.max(1, Number(p.sensibilidade) || 5));
  return 0.004 + (sens - 1) * 0.0045;
}
function escritorioMiddlewaresVoz() {
  const passaAlta = async (ctx) => { const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 110; f.Q.value = 0.7; return f; };
  const corteAgudo = async (ctx) => { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 7500; return f; };
  let medidor = null;
  const medir = async (ctx) => { medidor = ctx.createAnalyser(); medidor.fftSize = 512; return medidor; };
  const portao = async (ctx) => {
    const g = ctx.createGain(), dados = new Uint8Array(512);
    let aberto = 0;
    const tick = () => {
      if (!medidor || ctx.state === "closed") return;
      medidor.getByteTimeDomainData(dados);
      let soma = 0; for (const v of dados) soma += (v - 128) * (v - 128);
      const nivel = Math.sqrt(soma / dados.length) / 128;
      // Abre rápido, fecha devagar (não corta o fim das palavras).
      if (nivel > escritorioFiltroVoz.limite) aberto = 12; else if (aberto > 0) aberto--;
      g.gain.setTargetAtTime(aberto > 0 ? 1 : 0.03, ctx.currentTime, aberto > 0 ? 0.01 : 0.08);
      setTimeout(tick, 20);
    };
    tick();
    return g;
  };
  return [passaAlta, corteAgudo, medir, portao];
}
async function escritorioAplicarFiltroVoz(meeting) {
  const self = meeting?.self;
  if (!self?.addAudioMiddleware) return;
  escritorioFiltroVoz.limite = escritorioLimiteFiltro();
  try { await self.removeAllAudioMiddlewares?.(); } catch {}
  if (escritorioLerPrefsAudio().filtro === false) return;
  try { for (const m of escritorioMiddlewaresVoz()) await self.addAudioMiddleware(m); }
  catch (e) { console.warn("Filtro de voz:", e); }
}
function mudarSensibilidadeAudio(v) {
  escritorioSalvarPrefsAudio({ sensibilidade: Number(v) });
  escritorioFiltroVoz.limite = escritorioLimiteFiltro();
  const r = document.getElementById("office-sens-rotulo");
  if (r) r.textContent = Number(v) <= 3 ? "Pega mais som" : Number(v) >= 8 ? "Só voz bem próxima" : "Equilibrado";
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
${(() => { const sens = Math.min(10, Math.max(1, Number(escritorioLerPrefsAudio().sensibilidade) || 5)); return `<label class="ofc-chave"><input type="checkbox" ${escritorioLerPrefsAudio().filtro === false ? "" : "checked"} onchange="mudarFiltroVozEscritorio(this.checked)"><span><b>Filtro de voz (recomendado)</b><small>Fecha o microfone quando não é você falando: corta barulho da casa, ventilador e teclado.</small></span></label>
<label class="ofc-campo"><span>Sensibilidade · <i id="office-sens-rotulo" style="font-style:normal;color:#ffb27a">${sens <= 3 ? "Pega mais som" : sens >= 8 ? "Só voz bem próxima" : "Equilibrado"}</i></span><input type="range" min="1" max="10" step="1" value="${sens}" oninput="mudarSensibilidadeAudio(this.value)" aria-label="Sensibilidade do filtro de voz"><small class="ofc-fila-nota">Se sua voz corta no começo das frases, diminua. Se ainda passa barulho, aumente.</small></label>`; })()}
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
async function mudarFiltroVozEscritorio(ligado) {
  escritorioSalvarPrefsAudio({ filtro: ligado });
  if (escritorio.chamada) await escritorioAplicarFiltroVoz(escritorio.chamada);
  escritorioAviso(ligado ? "Filtro de voz ligado." : "Filtro de voz desligado.");
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
    if (tipo === "audio") {
      if (!self.audioEnabled && !escritorioCanal()) return escritorioAviso("Aqui não tem voz. Entre numa sala para falar.");
      escritorio.microfoneQuer = !self.audioEnabled;
      await self[self.audioEnabled ? "disableAudio" : "enableAudio"]();
      escritorio.erroMic = self.audioEnabled ? null : escritorio.erroMic;
    }
    if (tipo === "video")
      await self[self.videoEnabled ? "disableVideo" : "enableVideo"]();
    if (tipo === "screen") {
      await self[
        self.screenShareEnabled ? "disableScreenShare" : "enableScreenShare"
      ]();
      if (self.screenShareEnabled) await aplicarQualidadeTelaEscritorio();
    }
    renderMidiaEscritorio();
  } catch (e) {
    if (tipo === "audio") { escritorio.erroMic = await escritorioDiagnosticarMic(); renderMidiaEscritorio(); escritorioAviso(escritorio.erroMic.titulo); return; }
    escritorioAviso("Não foi possível ativar o dispositivo: " + e.message);
  }
}
// O título da conversa sai sempre do lugar atual (antes ficava com o nome da
// sala anterior até o painel inteiro ser redesenhado).
function escritorioTituloChamada() {
  const lugar = escritorioLugarDe(escritorio.perfil).nome;
  return escritorioCanal() ? `Conversa · ${lugar}` : `${lugar} · sem voz aqui`;
}
function atualizarTituloChamadaEscritorio() {
  const t = document.getElementById("office-call-titulo");
  if (t) t.textContent = escritorioTituloChamada();
}
function renderMidiaEscritorio() {
  atualizarTituloChamadaEscritorio();
  const meeting = escritorio.chamada,
    el = document.getElementById("office-call-media");
  if (!meeting || !el) return;
  el.replaceChildren();
  if (escritorio.erroMic) {
    const caixa = document.createElement("div");
    caixa.className = "office-call-erro";
    caixa.setAttribute("role", "alert");
    caixa.innerHTML = `<b>${safeText(escritorio.erroMic.titulo)}</b><p>${safeText(escritorio.erroMic.dica)}</p>${escritorio.erroMic.podeTentar ? '<button type="button" class="office-call-som" onclick="liberarMicrofoneEscritorio()">Liberar microfone</button>' : ""}`;
    el.append(caixa);
    document.getElementById("office-call")?.classList.add("aberta");
  }
  // Quem está na mesma sala mas não entrou na conversa (não está ouvindo).
  const naChamada = new Set([String(escritorio.base?.eu), ...meeting.participants.joined.toArray().map((p) => String(p.customParticipantId || "").split(":")[0])]);
  const fora = (escritorio.online || []).filter((o) => !naChamada.has(String(o.id)) && String(o.zona || "") === escritorio.zona);
  if (fora.length) {
    const p = document.createElement("p");
    p.className = "office-call-fora";
    p.textContent = `Na sala, mas fora da conversa: ${fora.map((o) => String(o.nome).split(" ")[0]).join(", ")}. ${fora.length > 1 ? "Elas ainda não ouvem" : "Ainda não ouve"} você. A voz tenta reconectar sozinha; se não voltar, a pessoa usa "Tentar agora" na barra de baixo.`;
    el.append(p);
  }
  if (escritorio.somBloqueado) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "office-call-som";
    b.textContent = "Ativar som da conversa";
    b.onclick = escritorioDesbloquearSom;
    el.append(b);
  }
  for (const p of [meeting.self, ...escritorioOuvindo(meeting)]) {
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
    // Volume desta pessoa só para você (e silenciar), guardado neste navegador.
    const pessoaId = String(p.customParticipantId || "").split(":")[0];
    let volume = null;
    if (!eu && /^\d+$/.test(pessoaId)) {
      const v = escritorioVolumePessoa(pessoaId);
      const ctl = document.createElement("div");
      ctl.className = "office-call-volume";
      ctl.innerHTML = `<input type="range" min="0" max="100" value="${v.mudo ? 0 : v.vol}" aria-label="Volume de ${safeText(p.name || "participante")} só para você" title="Volume só para você" oninput="volumePessoaEscritorio('${pessoaId}',this.value)"><button type="button" aria-pressed="${v.mudo}" title="Só você deixa de ouvir" onclick="silenciarPessoaEscritorio('${pessoaId}')">${v.mudo ? "Ouvir" : "Silenciar"}</button>`;
      volume = ctl;
    }
    // Barra de volume: mostra que o som está chegando (ou saindo, no seu caso).
    const nivel = document.createElement("i");
    nivel.className = "office-call-nivel";
    nivel.setAttribute("aria-hidden", "true");
    nivel.append(document.createElement("i"));
    tile.append(topo, nivel);
    if (volume) tile.append(volume);
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
      // Quem assiste pede a quem mostra uma tela mais nítida ou mais leve.
      const dono = String(p.customParticipantId || "").split(":")[0];
      if (!eu && /^\d+$/.test(dono)) {
        const pedir = document.createElement("div");
        pedir.className = "office-call-pedir";
        pedir.innerHTML = `<span>Qualidade desta tela:</span><button type="button" onclick="pedirQualidadeTelaEscritorio('${dono}','nitida')">Pedir mais nítida</button><button type="button" onclick="pedirQualidadeTelaEscritorio('${dono}','leve')">Pedir mais leve</button>`;
        tile.append(pedir);
      }
    }
    el.append(tile);
  }
  escritorioNivelAudio.acompanhar([meeting.self, ...escritorioOuvindo(meeting)]);
  // Depois do SDK (que repõe a voz no próprio mix a cada mudança de áudio).
  setTimeout(aplicarVolumesEscritorio, 0);
  escritorioPreviaTela(meeting.self);
  // Barra compacta: um rosto (iniciais) por pessoa; quem fala acende.
  const rostos = document.getElementById("office-call-rostos");
  if (rostos) rostos.innerHTML = [meeting.self, ...escritorioOuvindo(meeting)].map((p) => {
    const ini = String(p.name || "?").split(/\s+/).slice(0, 2).map((x) => x[0] || "").join("").toUpperCase();
    // Rosto do boneco da pessoa (iniciais se a imagem não vier).
    const pessoa = p === meeting.self ? String(escritorio.base?.eu) : String(p.customParticipantId || "").split(":")[0];
    const perfil = p === meeting.self ? escritorio.perfil : escritorio.base?.equipe?.find((e) => String(e.id) === pessoa)?.perfil;
    const rosto = perfil ? `<img src="https://www.habbo.com/habbo-imaging/avatarimage?${new URLSearchParams({ figure: mapaFigura(perfil), headonly: "1", direction: "2", head_direction: "3", size: "s" })}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : "";
    return `<i class="office-call-rosto${p.audioEnabled ? "" : " mudo"}" data-participante="${safeText(String(p.id))}" title="${safeText(p.name || "")}${p.audioEnabled ? "" : " · microfone desligado"}" aria-label="${safeText(p.name || "")}"><span aria-hidden="true">${safeText(ini)}</span>${rosto}</i>`;
  }).join("");
  // Vídeo de cada pessoa também numa bolha sobre o boneco dela no mapa. O id
  // do participante é "pessoa:código", criado pelo servidor.
  const comVideo = new Map();
  for (const p of [meeting.self, ...escritorioOuvindo(meeting)]) {
    const pessoa = p === meeting.self ? String(escritorio.base?.eu) : String(p.customParticipantId || "").split(":")[0];
    if (pessoa && p.videoEnabled && p.videoTrack) comVideo.set(pessoa, new MediaStream([p.videoTrack]));
  }
  for (const id of escritorio.mapa?.idsNoMapa() || []) escritorio.mapa.anexarVideo(id, comVideo.get(id) || null);
  atualizarDockEscritorio();
}
// Por que o microfone não liga: pergunta direto ao navegador e traduz o erro.
async function escritorioDiagnosticarMic() {
  if (!navigator.mediaDevices?.getUserMedia)
    return { titulo: "Este navegador não dá acesso ao microfone", dica: "Use o Chrome, o Edge ou o Safari atualizados, pelo endereço https do painel." };
  let permissao = "";
  try { permissao = (await navigator.permissions?.query({ name: "microphone" }))?.state || ""; } catch {}
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return { titulo: "O microfone funciona, mas a conversa não o ligou", dica: "Clique em Liberar microfone para tentar de novo.", podeTentar: true };
  } catch (e) {
    const n = e?.name || "";
    if (n === "NotAllowedError" || n === "SecurityError" || permissao === "denied")
      return { titulo: "O navegador bloqueou o microfone", dica: "Clique no cadeado ao lado do endereço do site, escolha Microfone: Permitir e depois em Liberar microfone. No Mac, confira também Ajustes do Sistema › Privacidade e Segurança › Microfone e ative o navegador.", podeTentar: true };
    if (n === "NotFoundError" || n === "OverconstrainedError")
      return { titulo: "Nenhum microfone encontrado", dica: "Conecte um fone com microfone ou ative o microfone do computador e clique em Liberar microfone.", podeTentar: true };
    if (n === "NotReadableError" || n === "AbortError")
      return { titulo: "O microfone está sendo usado por outro programa", dica: "Feche Meet, Zoom, Teams, WhatsApp ou outra aba que esteja usando o microfone e clique em Liberar microfone.", podeTentar: true };
    return { titulo: "O microfone não ligou", dica: (e?.message || n || "Erro desconhecido") + ". Tente Liberar microfone ou escolha outro em Ajustes de áudio.", podeTentar: true };
  }
}
// Botão "Liberar microfone": pede o acesso de novo (abre o aviso do navegador)
// e liga o microfone na conversa.
async function liberarMicrofoneEscritorio() {
  const self = escritorio.chamada?.self;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    if (self && !self.audioEnabled) await self.enableAudio();
    escritorio.erroMic = self?.audioEnabled ? null : await escritorioDiagnosticarMic();
    escritorioAviso(escritorio.erroMic ? escritorio.erroMic.titulo : "Microfone liberado. Fale algo e veja a barra verde.");
  } catch {
    escritorio.erroMic = await escritorioDiagnosticarMic();
    escritorioAviso(escritorio.erroMic.titulo);
  }
  renderMidiaEscritorio();
  atualizarControlesEscritorio();
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
      // O próprio microfone é medido antes do filtro de voz (rawAudioTrack):
      // assim o aviso de "não está captando" não dispara quando o filtro fecha.
      const trilha = (p === escritorio.chamada?.self && p.rawAudioTrack) || p.audioTrack;
      if (!p.audioEnabled || !trilha) continue;
      vistos.add(p.id);
      const atual = this.fontes.get(p.id);
      if (atual?.track === trilha) { atual.p = p; continue; }
      atual?.fonte.disconnect();
      try {
        const fonte = this.ctx.createMediaStreamSource(new MediaStream([trilha]));
        const an = this.ctx.createAnalyser();
        an.fftSize = 512;
        fonte.connect(an); // sem ligar na saída: só mede, quem toca é o SDK
        this.fontes.set(p.id, { p, track: trilha, fonte, an, dados: new Uint8Array(an.fftSize) });
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
// Mini tela de quem está mostrando a tela (como no Meet): vê o que está
// transmitindo e pode trocar a tela/janela ou parar.
function escritorioPreviaTela(self) {
  let el = document.getElementById("office-minha-tela");
  const track = self?.screenShareEnabled && self.screenShareTracks?.video;
  if (!track) { el?.remove(); return; }
  if (!el) {
    el = document.createElement("section");
    el.id = "office-minha-tela";
    el.className = "ofc-minha-tela";
    el.setAttribute("aria-label", "Você está mostrando sua tela");
    el.innerHTML = `<div class="ofc-minha-tela-topo"><b><i aria-hidden="true"></i>Você está mostrando a tela</b><button type="button" class="ofc-x" aria-label="Esconder a prévia" title="Esconder a prévia (continua mostrando)" onclick="this.closest('section').classList.toggle('mini')">–</button></div><video autoplay muted playsinline></video><label class="ofc-minha-tela-qualidade">Qualidade <select aria-label="Qualidade da tela que você mostra" onchange="qualidadeTelaEscritorio(this.value)">${Object.entries(ESCRITORIO_QUALIDADE_TELA).map(([id, q]) => `<option value="${id}"${id === escritorioQualidadeTela() ? " selected" : ""}>${q.nome}</option>`).join("")}</select></label><div class="ofc-minha-tela-acoes"><button type="button" class="ofc-mini" onclick="trocarTelaEscritorio()">Trocar o que mostro</button><button type="button" class="ofc-mini perigo" onclick="alternarMidiaEscritorio('screen')">Parar de mostrar</button></div>`;
    // Na coluna da direita, embaixo da conversa (nada por cima de nada).
    (document.getElementById("office-coluna") || document.querySelector(".ofc-principal"))?.append(el);
  }
  const v = el.querySelector("video");
  if (v.srcObject?.getVideoTracks()[0] !== track) v.srcObject = new MediaStream([track]);
}
async function trocarTelaEscritorio() {
  const self = escritorio.chamada?.self;
  if (!self) return;
  try {
    await self.disableScreenShare();
    await self.enableScreenShare();
    await aplicarQualidadeTelaEscritorio();
  } catch (e) {
    escritorioAviso("Não foi possível trocar a tela: " + e.message);
  }
  renderMidiaEscritorio();
}
async function sairChamadaEscritorio() {
  const m = escritorio.chamada;
  escritorio.chamada = null;
  escritorio.canalChamada = null;
  escritorio.ouvindoAntes = "";
  escritorio.somBloqueado = false;
  escritorioNivelAudio.parar();
  escritorioPararVozes();
  if (!escritorio.reconectandoAudio) document.getElementById("office-ajustes-audio")?.remove();
  try {
    await m?.leave();
  } catch {
    escritorioAviso("A conexão da chamada foi encerrada.");
  } finally {
    document.getElementById("office-call")?.setAttribute("hidden", "");
    document.getElementById("office-call-media")?.replaceChildren();
    document.getElementById("office-minha-tela")?.remove();
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
    if (k === "4") { e.preventDefault(); sentarNoChaoEscritorio(); return; }
    if (k === "5") { e.preventDefault(); expressaoEscritorio("triste"); return; }
    if (k === "6") { e.preventDefault(); expressaoEscritorio("surpreso"); return; }
    if (k === "7") { e.preventDefault(); expressaoEscritorio("bravo"); return; }
    if (k === "8") { e.preventDefault(); placaEscritorio("coracao"); return; }
    if (k === "9") { e.preventDefault(); placaEscritorio("exclamacao"); return; }
    if (k === "m" && escritorioMinhaMesa()) { e.preventDefault(); irParaMinhaMesaEscritorio(); return; }
  }
  tecladoEscritorio(e);
});
globalThis.document?.addEventListener?.("keyup", (e) => { escritorio.correndo = e.shiftKey; soltarTeclaEscritorio(e); });
// Trocar de aba com a tecla presa não pode deixar o boneco andando sozinho.
globalThis.window?.addEventListener?.("blur", () => { escritorioTeclas.clear(); escritorioPararTeclado(); });

// Qualidade da tela mostrada. Quem mostra escolhe (vale para todos que
// assistem); quem assiste pede a quem mostra, que vê o pedido e aplica com um
// clique. O RealtimeKit não deixa cada um receber uma qualidade diferente da
// tela, então a escolha é sempre de quem transmite.
const ESCRITORIO_QUALIDADE_TELA = {
  nitida: { nome: "Nítida (texto e planilha)", w: 1920, h: 1080, fps: 15 },
  equilibrada: { nome: "Equilibrada", w: 1280, h: 720, fps: 12 },
  leve: { nome: "Leve (internet fraca)", w: 854, h: 480, fps: 6 },
};
function escritorioQualidadeTela() {
  try { const q = localStorage.getItem("vybe-escritorio-qualidade-tela"); return ESCRITORIO_QUALIDADE_TELA[q] ? q : "equilibrada"; } catch { return "equilibrada"; }
}
function escritorioLimiteTela() {
  const q = ESCRITORIO_QUALIDADE_TELA.nitida;
  return { width: { max: q.w }, height: { max: q.h }, frameRate: { ideal: 12, max: q.fps } };
}
async function aplicarQualidadeTelaEscritorio() {
  const self = escritorio.chamada?.self, q = ESCRITORIO_QUALIDADE_TELA[escritorioQualidadeTela()];
  if (!self?.screenShareEnabled) return;
  const restricao = { width: { ideal: q.w }, height: { ideal: q.h }, frameRate: { ideal: q.fps } };
  try { await self.updateScreenshareConstraints?.(restricao); } catch {}
  // Também direto na faixa de vídeo (vale mesmo se o SDK ignorar o pedido).
  try { await self.screenShareTracks?.video?.applyConstraints({ width: { max: q.w }, height: { max: q.h }, frameRate: { max: q.fps } }); } catch {}
}
async function qualidadeTelaEscritorio(nivel) {
  if (!ESCRITORIO_QUALIDADE_TELA[nivel]) return;
  try { localStorage.setItem("vybe-escritorio-qualidade-tela", nivel); } catch {}
  await aplicarQualidadeTelaEscritorio();
  const sel = document.querySelector("#office-minha-tela select");
  if (sel) sel.value = nivel;
  escritorioAviso("Tela em qualidade " + ESCRITORIO_QUALIDADE_TELA[nivel].nome.split(" (")[0].toLowerCase() + ".");
}
function pedirQualidadeTelaEscritorio(para, nivel) {
  escritorioEmitir("screen:quality", { para, nivel });
  escritorioAviso(nivel === "leve" ? "Pedido de tela mais leve enviado." : "Pedido de tela mais nítida enviado.");
}
function pedidoQualidadeTelaEscritorio({ nome, nivel } = {}) {
  if (!ESCRITORIO_QUALIDADE_TELA[nivel] || !escritorio.chamada?.self?.screenShareEnabled) return;
  const el = document.getElementById("office-minha-tela");
  if (!el) return;
  el.querySelector(".ofc-minha-tela-pedido")?.remove();
  const aviso = document.createElement("div");
  aviso.className = "ofc-minha-tela-pedido";
  aviso.setAttribute("role", "status");
  aviso.innerHTML = `<span>${safeText(String(nome || "Alguém").split(" ")[0])} pediu a tela ${nivel === "leve" ? "mais leve" : "mais nítida"}.</span><button type="button" class="ofc-mini" onclick="qualidadeTelaEscritorio('${nivel}');this.parentElement.remove()">Aplicar</button><button type="button" class="ofc-mini" onclick="this.parentElement.remove()">Agora não</button>`;
  el.append(aviso);
}

// Volume de cada pessoa, só para quem escolhe. O RealtimeKit toca todas as
// vozes misturadas num único áudio, sem volume por pessoa; quem tem volume
// próprio sai desse mix e toca num áudio separado deste navegador.
const escritorioSonsPessoas = new Map(); // id do participante → <audio>
function escritorioVolumes() {
  try { return JSON.parse(localStorage.getItem("vybe-escritorio-volumes") || "{}") || {}; } catch { return {}; }
}
function escritorioVolumePessoa(id) {
  const v = escritorioVolumes()[id] || {};
  return { vol: Number.isFinite(v.vol) ? Math.max(0, Math.min(100, v.vol)) : 100, mudo: Boolean(v.mudo) };
}
function guardarVolumePessoa(id, mudanca) {
  const todos = escritorioVolumes();
  const v = { ...escritorioVolumePessoa(id), ...mudanca };
  if (v.vol === 100 && !v.mudo) delete todos[id]; else todos[id] = v;
  try { localStorage.setItem("vybe-escritorio-volumes", JSON.stringify(todos)); } catch {}
  aplicarVolumesEscritorio();
}
function volumePessoaEscritorio(id, valor) {
  guardarVolumePessoa(id, { vol: Number(valor), mudo: false });
}
function silenciarPessoaEscritorio(id) {
  guardarVolumePessoa(id, { mudo: !escritorioVolumePessoa(id).mudo });
  renderMidiaEscritorio();
}
function aplicarVolumesEscritorio() { escritorioTocarVozes(); }
// Toca a voz de quem está na mesma sala (cada um num áudio próprio, com o
// volume que você escolheu). Fora de sala com voz, nada toca.
function escritorioTocarVozes() {
  const m = escritorio.chamada;
  const vistos = new Set();
  for (const p of m && escritorioCanal() ? escritorioOuvindo(m) : []) {
    const trilha = p.audioEnabled && p.audioTrack;
    if (!trilha) continue;
    const v = escritorioVolumePessoa(String(p.customParticipantId || "").split(":")[0]);
    let el = escritorioSonsPessoas.get(p.id);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      el.hidden = true;
      document.body.append(el);
      escritorioSonsPessoas.set(p.id, el);
      const saida = escritorioLerPrefsAudio().saida;
      if (saida && typeof el.setSinkId === "function") el.setSinkId(saida).catch(() => {});
    }
    vistos.add(p.id);
    if (el.srcObject?.getAudioTracks()[0] !== trilha) el.srcObject = new MediaStream([trilha]);
    el.muted = v.mudo;
    el.volume = v.vol / 100;
    if (el.paused) el.play().then(() => { if (escritorio.somBloqueado) { escritorio.somBloqueado = false; renderMidiaEscritorio(); } }).catch(() => { if (!escritorio.somBloqueado) { escritorio.somBloqueado = true; renderMidiaEscritorio(); escritorioEsperarClique(); } });
  }
  for (const [id, el] of escritorioSonsPessoas) if (!vistos.has(id)) { el.srcObject = null; el.remove(); escritorioSonsPessoas.delete(id); }
}
function escritorioPararVozes() {
  for (const el of escritorioSonsPessoas.values()) { el.srcObject = null; el.remove(); }
  escritorioSonsPessoas.clear();
}
// O navegador bloqueia som antes do primeiro clique: o próximo clique ou tecla libera.
function escritorioDesbloquearSom() {
  for (const el of escritorioSonsPessoas.values()) el.play().catch(() => {});
  escritorio.somBloqueado = false;
  renderMidiaEscritorio();
}
function escritorioEsperarClique() {
  document.addEventListener("pointerdown", escritorioDesbloquearSom, { once: true, capture: true });
  document.addEventListener("keydown", escritorioDesbloquearSom, { once: true, capture: true });
}
// Quem você ouve: na conversa geral, só quem está na mesma sala (pela
// presença do escritório); na sala trancada, todos da conversa dela.
function escritorioOuvindo(meeting) {
  const outros = escritorioOutrosNaChamada(meeting);
  if (escritorio.canalChamada !== "escritorio") return outros;
  const zona = escritorio.zona;
  if (!escritorioCanal(zona)) return [];
  const naSala = new Set((escritorio.online || []).filter((o) => o.zona === zona).map((o) => String(o.id)));
  return outros.filter((p) => naSala.has(String(p.customParticipantId || "").split(":")[0]));
}
// Não conectou ou caiu: tenta de novo sozinho, cada vez esperando um pouco
// mais (até 30 s), sem desistir enquanto a pessoa estiver no escritório.
function escritorioTentarVozDeNovo() {
  clearTimeout(escritorio.timerVoz);
  if (!escritorio.conectado) return;
  const n = (escritorio.tentativasVoz = (escritorio.tentativasVoz || 0) + 1);
  escritorio.timerVoz = setTimeout(() => { if (!escritorio.chamada && !escritorio.entrandoChamada) escritorioConversaAutomatica(); }, Math.min(30000, 1000 * 2 ** Math.min(n - 1, 5)));
  atualizarControlesEscritorio();
}

// Quem está na conversa, uma vez por pessoa: some a sua própria conexão
// antiga (que a sala ainda não derrubou) e, se alguém aparece duas vezes,
// fica a entrada mais recente.
function escritorioOutrosNaChamada(meeting) {
  const eu = String(escritorio.base?.eu);
  const porPessoa = new Map();
  for (const p of meeting?.participants?.joined?.toArray?.() || []) {
    const id = String(p.customParticipantId || "").split(":")[0] || p.id;
    if (id === eu) continue;
    // Duas entradas da mesma pessoa: fica a que está com som (ou a última).
    const antes = porPessoa.get(id);
    if (antes && antes.audioEnabled && !p.audioEnabled) continue;
    porPessoa.set(id, p);
  }
  return [...porPessoa.values()];
}

// Nome na etiqueta do mapa: primeiro nome e a inicial do último ("Reriston
// S."); o nome inteiro fica no rótulo de acessibilidade e no cartão.
function escritorioNomeCurto(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return partes[0] || "";
  return partes[0] + " " + partes.at(-1)[0].toUpperCase() + ".";
}

// Envelope aceso sobre a própria mesa enquanto houver recado não lido (só
// quem recebeu vê). Clicar abre a conversa de quem mandou (ou a lista).
function escritorioMarcarRecados() {
  const mesa = escritorioNoMeuQuarto() ? escritorioMinhaMesa() : null, n = escritorioRecadosNaoLidos();
  const de = Object.entries(escritorio.recadosResumo || {}).filter(([, q]) => q > 0).map(([id]) => id);
  const nomes = de.slice(0, 3).map((id) => escritorioNomePessoa(id).split(" ")[0]).join(", ") + (de.length > 3 ? "…" : "");
  escritorio.mapa?.marcarRecado?.(mesa?.x, mesa?.y, mesa ? n : 0, nomes, () => abrirRecadosEscritorio(de.length === 1 ? de[0] : null));
}

// Trecho i das paredes de uma sala individual (10 por lado): 0–9 fundo (y0),
// 10–19 esquerda (x0), 20–29 frente (y1), 30–39 direita (x1). Chave igual à
// que o mapa usa para cada pedaço de divisória.
function escritorioChaveTrecho(a, i) {
  const L = ESCRITORIO_QUARTO_MAX, k = i % L, lado = Math.floor(i / L);
  return [`x:${a.x0 + k},${a.y0}`, `y:${a.x0},${a.y0 + k}`, `x:${a.x0 + k},${a.y1}`, `y:${a.x1},${a.y0 + k}`][lado];
}

// Quem estava dentro e caiu (rede, computador dormiu, aba muito tempo no
// fundo) volta sozinho ao reabrir a aba ou quando a internet volta.
function escritorioVoltarSeQueria() {
  let queria = escritorio.querConectado;
  try { queria ||= localStorage.getItem("vybe-escritorio-dentro") === "1"; } catch {}
  if (!queria || escritorio.conectado || escritorio.conectando || !escritorio.base || escritorio.base.demo) return;
  if (document.visibilityState !== "visible" || navigator.onLine === false) return;
  conectarEscritorio();
}
if (typeof document !== "undefined" && document.addEventListener && typeof setInterval === "function") {
  document.addEventListener("visibilitychange", escritorioVoltarSeQueria);
  if (typeof window !== "undefined") window.addEventListener?.("online", escritorioVoltarSeQueria);
  setInterval(escritorioVoltarSeQueria, 60000);
}
