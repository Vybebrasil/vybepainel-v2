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
// Cabeça do personagem de alguém da equipe, para as fotinhas dentro do jogo
// (Paulo, 20/10/2026: "a fotinha vira a do avatar do jogo"). Acha a pessoa
// pelo id ou pelo nome; fora da equipe do jogo, devolve null e quem chama
// usa a foto do painel.
function escritorioCabecaUrl(quem) {
  const b = escritorio.base;
  if (!b) return null;
  const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const alvo = norm(quem);
  const p = (b.equipe || []).find((x) => String(x.id) === String(quem)) || (b.equipe || []).find((x) => norm(x.nome) === alvo)
    || (b.equipe || []).find((x) => alvo && norm(x.nome).split(" ")[0] === alvo.split(" ")[0] && (norm(x.nome).startsWith(alvo) || alvo.startsWith(norm(x.nome))));
  if (!p) return null;
  const perfil = String(p.id) === String(b.eu) ? escritorio.perfil : p.perfil;
  // Quem nunca montou o personagem aparece no jogo com o boneco padrão: é ele.
  return typeof mapaCabecaUrl === "function" ? mapaCabecaUrl(perfil || {}) : null;
}
// Salvou o personagem: a fotinha dele no painel muda já, neste navegador; nos
// outros, na próxima leitura (o endereço sai do visual novo).
function escritorioFotoDoPersonagem(perfil) {
  if (typeof TEAM_USERS === "undefined" || !perfil || typeof mapaCabecaUrl !== "function") return;
  const eu = (escritorio.base?.equipe || []).find((x) => String(x.id) === String(escritorio.base?.eu));
  const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(" ")[0];
  const u = eu && TEAM_USERS.find((x) => norm(x.name) === norm(eu.nome));
  if (!u) return;
  u.fotoReal ??= u.photo;
  u.photo = mapaCabecaUrl(perfil) || u.fotoReal;
}
async function escritorioApi(acao, corpo, consulta = null) {
  // Convidado: só a entrada e a voz, pela área dele (o resto é da equipe).
  if (window.ESCRITORIO_CONVIDADO) {
    if (acao === "entrada" || acao === "chamada") return convidadoPedir(acao, acao === "chamada" ? corpo : null);
    throw new Error("Isto é só da equipe da Vybe.");
  }
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
    throw Object.assign(new Error(d.error || (r.status === 413 ? "O envio é grande demais para o servidor." : `Não foi possível acessar o escritório (${r.status}).`)), {status:r.status});
  if (acao === "perfil" && corpo && d.perfil) escritorioFotoDoPersonagem(d.perfil);
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
  escritorio.lobbySaindo = false;
  escritorio.entrada = { etapa: escritorio.entrada?.etapa || "acesso", desde: Date.now(), erro: texto };
  escritorio.carregandoMapa = false;
  if (!escritorio.conectado) renderEscritorio();
}
function escritorioFimEntrada() {
  clearInterval(escritorio.timerEntrada);
  escritorio.entrada = null;
  escritorio.carregandoMapa = false;
  // Onde a pessoa escolheu entrar na tela de entrada.
  const destino = escritorio.destinoEntrada;
  escritorio.destinoEntrada = null;
  escritorio.lobbySaindo = false;
  if (destino === "sala") setTimeout(() => irParaMinhaMesaEscritorio(), 400);
  else if (destino === "convivencia") setTimeout(() => escritorioIrParaAmbiente("recepcao"), 400);
  else if (destino?.startsWith("zona:")) setTimeout(() => escritorioIrParaAmbiente(destino.slice(5) || "praca"), 400);
}
// Tela de entrada (Paulo, 20/10/2026: "o bonequinho acenando"; depois "execute
// todos"): o boneco chega andando e acena num ladrilho do jogo; saudação pela
// hora da Bahia; quem está no escritório agora (sem você aparecer na lista);
// o que te espera hoje; teste do microfone; onde entrar; regras curtas.
function escritorioPeriodoDoDia() {
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia", hour: "numeric", hour12: false }).format(new Date()));
  return hora < 5 ? "noite" : hora < 12 ? "manha" : hora < 18 ? "tarde" : "noite";
}
function escritorioVisitasEntrada() {
  try { return Number(localStorage.getItem("vybe-escritorio-entradas") || 0); } catch { return 0; }
}
function escritorioLobbyTopoHtml(perfil, eu, b) {
  const nome = safeText((eu?.nome || "").split(" ")[0] || "equipe");
  const oi = { manha: "Bom dia", tarde: "Boa tarde", noite: "Boa noite" }[escritorioPeriodoDoDia()];
  const figura = mapaFigura(perfil || {}), mao = perfil?.mao || "";
  const eco = b?.economia, p = eco?.pontos, sala = escritorioMinhaMesa()?.ambiente, idEu = safeText(String(escritorio.base?.eu || ""));
  const conv = escritorio.base?.convidado, quem = conv ? safeText(String(conv.anfitriao.nome).split(" ")[0]) : "";
  const pct = p?.xpProximo ? Math.min(100, Math.round((Number(p.xp || 0) / p.xpProximo) * 100)) : 0;
  const cabeca = typeof escritorioCabecaUrl === "function" ? escritorioCabecaUrl(escritorio.base?.eu) : "";
  // Tela de entrada como a de um jogo (Paulo, 21/10/2026: "login do joguinho…
  // me surpreenda"): a cidade em tela cheia, o seu boneco no centro sobre a
  // plataforma, a placa do jogador num canto e as moedas no outro, botões
  // redondos de jogo dos lados e o ENTRAR grande embaixo.
  const placa = `<div class="lg-jogador lg-entra" style="--o:0">
<span class="lg-anel" style="--p:${pct}" title="${p ? `${Number(p.xp || 0).toLocaleString("pt-BR")} de ${Number(p.xpProximo || 0).toLocaleString("pt-BR")} XP para o nível ${Number(p.nivel) + 1}` : ""}">${cabeca ? `<img src="${safeText(cabeca)}" alt="" width="52" height="52">` : ""}${p?.nivel ? `<b class="lg-nivel" data-vb-contar="${Number(p.nivel)}" data-vb-chave="nivel-${idEu}">${p.nivel}</b>` : ""}</span>
<span class="lg-jogador-txt"><small>${oi}</small><b id="ofc-lobby-titulo">${nome}</b>${eu?.titulo?.texto ? `<span class="vb-titulo n${Number(eu.titulo.nivel) || 1}">${safeText(eu.titulo.texto)}</span>` : conv ? `<span class="lg-conv">convidado de ${quem}</span>` : ""}
${p ? `<span class="lg-xp"><i style="width:${pct}%"></i></span><em>${Number(p.xp || 0).toLocaleString("pt-BR")} / ${Number(p.xpProximo || 0).toLocaleString("pt-BR")} XP</em>` : ""}</span></div>`;
  const moedas = `<div class="lg-recursos lg-entra" style="--o:1">${eco?.disponivel ? `<span class="lg-pilula lg-moeda" title="VybeCoins"><i aria-hidden="true"></i><b data-vb-contar="${Number(eco.saldo || 0)}" data-vb-chave="moedas-${idEu}">${Number(eco.saldo || 0).toLocaleString("pt-BR")}</b></span>` : ""}<span class="lg-pilula lg-fogo" id="ofc-lobby-fogo">${escritorioLobbyFogoHtml()}</span>${escritorioBonusCopaHtml("entrada")}</div>`;
  // O quarto num cartão de jogo (Paulo, 21/10/2026: "muito soltão… não seria
  // massa um cartãozinho com esse cenário, mas a pessoa ver o vídeo da
  // Vybelândia também?"): placa com a sala e o nível em cima, o pedaço do
  // quarto vivo dentro e a cidade aparecendo em volta. Inclina com o mouse.
  const palco = `<div class="lg-palco" aria-hidden="true"><div class="lg-quarto" id="lg-quarto"><span class="lg-quarto-placa">${escritorioIcone("mesa")}<b>${safeText(sala?.nome || "Seu quarto")}</b>${p?.nivel ? `<em>Nível ${Number(p.nivel)}</em>` : ""}</span>${escritorioVitrineHtml("lg-vitrine", escritorio.base?.eu, { zoom: 2.2, desce: 0.3 })}<span class="lg-quarto-brilho"></span></div></div>`;
  // Os colegas online em ilhas menores ao fundo, de corpo inteiro (clicar leva até eles).
  const turma = `<div class="lg-turma" id="lg-turma"></div>`;
  const regra = conv ? `Você anda pela sala de ${quem} e pelas áreas comuns. Microfone ligado nas salas.` : "Microfone ligado nas salas · câmera desligada · a equipe vê você ao entrar";
  return `<div class="lg-ceu" aria-hidden="true">${escritorioPeriodoDoDia() === "noite" ? Array.from({ length: 28 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--y:${(i * 53) % 34}%;--d:${(i % 7) * 0.4}s"></i>`).join("") : ""}</div><div class="lg-topo">${placa}<div class="lg-noticias lg-entra" style="--o:1" id="lg-noticias" role="status" aria-live="off">${escritorioLobbyNoticiasHtml()}</div>${moedas}</div>${turma}${palco}
<div class="lg-lado lg-entra" style="--o:2" id="ofc-lobby-espera" role="navigation" aria-label="O que te espera">${escritorioLobbyEsperaHtml()}</div>
<div class="lg-online lg-entra" style="--o:3" id="ofc-lobby-online" role="region" aria-label="Quem está no escritório">${escritorioLobbyOnlineHtml()}</div>
<p class="lg-regra" id="lg-regra">${safeText(regra)}</p>`;
}
// A taça da Copa Vybe (Paulo, 21/10/2026: "tem que aparecer em todos os
// ambientes e quartos com o nome bonitão em cima do ganhador"; "é pra ficar
// como objeto em cada ambiente"): um móvel de verdade em cada sala e quarto,
// num ladrilho livre junto da parede do fundo escolhido pelo próprio mapa, e
// a placa do campeão em cima. Não entra na decoração salva de ninguém.
// O bônus do campeão (Paulo, 21/10/2026: "um bônus de % que fica ativo e
// mostrando na tela de quem ganhou; na de quem não ganhou, no mesmo lugar, a
// fotinha e quem está com ele ativo").
function escritorioBonusCopaHtml(lugar = "mapa") {
  const b = escritorio.base?.copa?.bonus;
  if (!b?.pct) return "";
  const meu = String(b.id) === String(escritorio.base?.eu), nome = safeText(String(b.nome || "").split(" ")[0]);
  const ate = String(b.ate || "").slice(8, 10) + "/" + String(b.ate || "").slice(5, 7);
  const vezes = b.pct % 100 === 0 ? `${b.pct / 100 + 1}×` : `+${b.pct}%`;
  // Quanto do mês ainda resta (a barra esvazia até o fim do bônus).
  const hoje = escritorioHojeBahia(), dias = Math.max(0, Math.round((Date.parse(b.ate) - Date.parse(hoje)) / 864e5) + 1);
  const total = Number(String(b.ate).slice(8, 10)) || 30, resta = Math.max(4, Math.min(100, Math.round((dias / total) * 100)));
  const rosto = typeof escritorioCabecaUrl === "function" ? escritorioCabecaUrl(b.id) : "";
  if (!escritorio.copaArte && typeof carregarCopaEscritorio === "function") carregarCopaEscritorio();
  return `<button type="button" class="ofc-bonus ${lugar}${meu ? " meu" : ""}" onclick="abrirRankingEscritorio('geral','mes')" title="Bônus da Copa: moedas e XP do trabalho ${b.pct === 100 ? "em dobro" : `com +${b.pct}%`} até ${ate}">
<span class="ofc-bonus-arte" aria-hidden="true"><span class="ofc-bonus-luz"></span>${escritorio.copaArte ? `<img class="ofc-bonus-taca" src="${escritorio.copaArte}" alt="">` : ""}${rosto ? `<img class="ofc-bonus-cabeca" src="${safeText(rosto)}" alt="">` : ""}</span>
<span class="ofc-bonus-txt"><small>Bônus da Copa</small><b>${meu ? "Você está com ele" : `${nome} está com ele`}</b><em>${b.pct === 100 ? "Moedas e XP em dobro" : `+${b.pct}% em moedas e XP`} · ${dias} ${dias === 1 ? "dia" : "dias"}</em><span class="ofc-bonus-barra"><i style="width:${resta}%"></i></span>${meu && (b.moedas || b.xp) ? `<em class="ofc-bonus-rendeu">já rendeu +${Number(b.moedas).toLocaleString("pt-BR")} moedas · +${Number(b.xp).toLocaleString("pt-BR")} XP</em>` : ""}</span>
<span class="ofc-bonus-selo"><b>${vezes}</b><small>moedas · XP</small></span></button>`;
}
function escritorioCopaPlacaHtml() {
  const c = escritorio.base?.copa;
  if (!c) return "";
  const nome = safeText(String(c.campeao.nome || "").split(" ")[0]);
  return `<span class="mapa-copa-placa"><small>Campeão da Copa</small><b>${nome}</b><em>${safeText(c.titulo.replace("Campeão da Copa · ", ""))}${c.vezes > 1 ? ` · ${c.vezes}×` : ""}</em></span>`;
}
function escritorioLugarDaTaca() {
  const m = escritorio.mapa, t = m?.tamanho?.();
  if (!t) return null;
  const livre = (x, y) => !m.bloqueadoEm(x, y) && m.assentoEm(x, y) === undefined && m.camaEm(x, y) === undefined && !m.pisoEm(x, y) && !(m.moveisEm?.(x, y) || []).length;
  const vizinhosLivres = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => livre(x + dx, y + dy)).length;
  const lugares = [];
  for (let y = 0; y < t.H; y++) for (let x = 0; x < t.W; x++) {
    // Junto de uma parede do fundo, sem fechar passagem (dois vizinhos livres).
    if (!livre(x, y) || !(m.bloqueadoEm(x - 1, y) || m.bloqueadoEm(x, y - 1)) || vizinhosLivres(x, y) < 2) continue;
    // À vista: quantos ladrilhos livres na frente (nada tapando a taça).
    const frente = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2]].filter(([dx, dy]) => livre(x + dx, y + dy)).length;
    lugares.push({ x, y, frente });
  }
  // O mais à vista; no empate, o mais ao fundo.
  lugares.sort((a, b) => b.frente - a.frente || (a.x + a.y) - (b.x + b.y));
  return lugares[0] || null;
}
async function posicionarTacaEscritorio() {
  const c = escritorio.base?.copa, m = escritorio.mapa;
  if (!c || !m?.acrescentarMovel || escritorio.edicao || escritorio.base?.convidado) return;
  if (m.tacaPosta) return;
  const lugar = escritorioLugarDaTaca();
  if (!lugar) return;
  m.tacaPosta = true;
  m.tacaLugar = lugar;
  await m.acrescentarMovel(["fball_trophy", lugar.x, lugar.y, 2, 0, 0, { copa: true }]);
  if (escritorio.mapa === m) m.marcador("copa", lugar.x, lugar.y, escritorioCopaPlacaHtml(), 96);
}
async function carregarCopaEscritorio() {
  if (escritorio.copaCarregando || !escritorio.base || escritorio.base.convidado) return;
  escritorio.copaCarregando = true;
  const pintar = () => {
    if (escritorio.lobbyNoticias && typeof montarNoticiasLobbyEscritorio === "function") montarNoticiasLobbyEscritorio();
    const lugar = document.getElementById("office-bonus"); if (lugar) lugar.innerHTML = escritorioBonusCopaHtml("mapa");
  };
  try {
    if (!escritorio.copaArte && typeof mapaCarregarMovel === "function") {
      const m = await mapaCarregarMovel("fball_trophy");
      escritorio.copaArte = mapaDesenharMovel(m, 2, 0, 0)?.canvas?.toDataURL() || "";
    }
  } catch {}
  pintar();
  try {
    const d = escritorioRanking.dados.mes || (escritorioRanking.dados.mes = await escritorioApi("ranking", null, { periodo: "mes" }));
    const p = (d.pessoas || []).filter((x) => x.posicao).sort((a, b) => a.posicao - b.posicao)[0];
    escritorio.copaLider = p ? { id: p.id, nome: p.nome, xp: p.xp } : null;
  } catch {}
  pintar();
}
// Lugar de cada pessoa online, pela zona da presença.
function escritorioLobbyLugar(p) {
  const z = p.zona || ""; if (!z) return "Praça";
  const sala = escritorio.base?.salas?.find((x) => x.id === z.replace(/-andar-1$/, ""));
  if (sala) { const dono = (escritorio.base?.equipe || []).find((e) => String(e.id) === String(sala.pessoa_id)); return dono ? `Sala de ${String(dono.nome).split(" ")[0]}` : "Uma sala"; }
  return ESCRITORIO_PLANTA?.ambientes?.find((a) => a.id === z)?.nome || (z === "recepcao" ? "Convivência" : z);
}
// Até quatro colegas online, cada um na sua ilhazinha ao fundo, alternando
// esquerda e direita; o mais perto é maior. Clicar entra onde ele está.
function escritorioLobbyTurmaHtml() {
  // Colegas online em cartõezinhos do quarto de cada um, dos lados do seu
  // (clicar entra onde a pessoa está).
  const lista = (escritorio.lobbyOnline || []).slice(0, 4);
  const total = (escritorio.lobbyOnline || []).length;
  return (total ? `<span class="lg-turma-titulo"><i></i>${total} online agora${total > 4 ? ` <small>+${total - 4}</small>` : ""}</span>` : "") + lista.map((p, i) => {
    if (!(escritorio.base?.equipe || []).some((e) => String(e.id) === String(p.id))) return "";
    const lado = i % 2 ? "dir" : "esq", longe = i > 1;
    const nome = safeText(String(p.nome || "").split(" ")[0]), lugar = safeText(escritorioLobbyLugar(p));
    return `<button type="button" class="lg-colega ${lado}${longe ? " longe" : ""}" style="--i:${i}" data-pessoa="${safeText(String(p.id))}" onclick="entrarPeloLobbyEscritorio('zona:${safeText(p.zona || "")}')" aria-label="Entrar onde ${nome} está: ${lugar}">${escritorioVitrineHtml("lg-colega-vitrine", p.id, { zoom: 1, desce: 1.25 })}<span class="lg-colega-nome"><b>${nome}</b>${lugar}</span></button>`;
  }).join("");
}
// Só redesenha os colegas quando a lista muda (cada cartão é uma cena do mapa).
function pintarTurmaLobbyEscritorio() {
  const turma = document.getElementById("lg-turma");
  if (!turma) return;
  const chave = (escritorio.lobbyOnline || []).slice(0, 4).map((p) => p.id + ":" + p.zona).join("|");
  if (turma.dataset.chave === chave) return;
  turma.dataset.chave = chave;
  turma.innerHTML = escritorioLobbyTurmaHtml();
  escritorioMontarVitrines(turma);
}
// Notícias da semana: do ranking que a entrada já carrega (quem lidera, quem
// mais subiu, quem está em chamas, a agência) e das conquistas da equipe.
function escritorioLobbyNoticiasHtml() {
  const itens = escritorio.lobbyNoticias || [];
  if (!itens.length) return "";
  return `<span class="lg-noticias-tag">Na semana</span><span class="lg-noticias-trilho">${itens.map((n, i) => `<span class="lg-noticia${i === (escritorio.lobbyNoticiaAtual || 0) % itens.length ? " atual" : ""}">${n}</span>`).join("")}</span>`;
}
function montarNoticiasLobbyEscritorio() {
  const d = escritorioRanking.dados.semana, nomes = [], nome = (x) => safeText(String(x || "").split(" ")[0]);
  if (d?.pessoas?.length) {
    const ord = [...d.pessoas].filter((p) => p.posicao).sort((a, b) => a.posicao - b.posicao);
    if (ord[0]) nomes.push(`<b>${nome(ord[0].nome)}</b> lidera a semana com <b>${Number(ord[0].xp).toLocaleString("pt-BR")} XP</b>`);
    const subiu = [...ord].filter((p) => p.antes && p.antes > p.posicao).sort((a, b) => (b.antes - b.posicao) - (a.antes - a.posicao))[0];
    if (subiu) nomes.push(`<b>${nome(subiu.nome)}</b> subiu ${subiu.antes - subiu.posicao} ${subiu.antes - subiu.posicao === 1 ? "posição" : "posições"} no ranking`);
    const fogo = [...d.pessoas].sort((a, b) => (b.sequencia || 0) - (a.sequencia || 0))[0];
    if (fogo?.sequencia > 2) nomes.push(`<b>${nome(fogo.nome)}</b> está em chamas: ${fogo.sequencia} dias seguidos entregando`);
    if (escritorio.copaLider) nomes.push(`<b>${nome(escritorio.copaLider.nome)}</b> lidera a Copa do mês com <b>${Number(escritorio.copaLider.xp).toLocaleString("pt-BR")} XP</b>`);
    if (d.agencia?.meta) nomes.push(d.agencia.bateu ? "A agência <b>bateu a meta</b> da semana" : `A agência está em <b>${d.agencia.pct}%</b> da meta da semana`);
  }
  for (const n of (escritorio.lobbyNovidades || []).slice(0, 5)) nomes.push(n.copa ? `<b>${nome(n.nome)}</b> é o <span class="vb-titulo n4">${safeText(n.titulo)}</span>` : n.titulo ? `<b>${nome(n.nome)}</b> ganhou o título <span class="vb-titulo n${Number(n.nivel) || 1}">${safeText(n.titulo)}</span>` : `<b>${nome(n.nome)}</b> conquistou ${safeText(n.escada)}`);
  escritorio.lobbyNoticias = nomes;
  const el = document.getElementById("lg-noticias");
  if (el) el.innerHTML = escritorioLobbyNoticiasHtml();
  clearInterval(escritorio.timerNoticias);
  if (nomes.length > 1 && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
    escritorio.timerNoticias = setInterval(() => {
      const lista = document.querySelectorAll("#lg-noticias .lg-noticia");
      if (!lista.length) { clearInterval(escritorio.timerNoticias); return; }
      if (document.hidden) return;
      escritorio.lobbyNoticiaAtual = ((escritorio.lobbyNoticiaAtual || 0) + 1) % lista.length;
      lista.forEach((x, i) => x.classList.toggle("atual", i === escritorio.lobbyNoticiaAtual));
    }, 4800);
}
// O cantinho: até três móveis do seu quarto em cima da ilha, desenhados pelo
// motor do mapa (troféu e planta primeiro), no tamanho da ilha.
function escritorioHojeBahia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(new Date());
}
// O baú do dia: uma vez por dia, mostra o que o seu trabalho rendeu nas
// últimas 24 horas (já está na carteira; o baú só conta). Abre com um clique.
function escritorioLobbyBauHtml() {
  const g = escritorio.lobbyBau;
  if (!g) return "";
  const aberto = escritorio.lobbyBauAberto;
  return `<div class="lg-bau${aberto ? " aberto" : ""}" role="dialog" aria-label="Seu baú do dia"><div class="lg-bau-cartao">
<button type="button" class="lg-bau-x" onclick="fecharBauLobbyEscritorio()" aria-label="Fechar">×</button>
<button type="button" class="lg-bau-caixa" onclick="abrirBauLobbyEscritorio()" ${aberto ? "disabled" : ""} aria-label="Abrir o baú">${escritorio.lobbyBauArte ? `<img src="${escritorio.lobbyBauArte}" alt="">` : ""}<span class="lg-bau-luz"></span></button>
${aberto ? `<b class="lg-bau-total"><span class="lg-bau-moeda"></span>+${Number(g.moedas).toLocaleString("pt-BR")} <small>moedas</small> · +${Number(g.pontos).toLocaleString("pt-BR")} <small>XP</small></b><p>O que o seu trabalho rendeu nas últimas 24 horas. Já está na sua carteira.</p><ul>${g.itens.map((x) => `<li><span>${safeText(x.descricao)}${x.vezes > 1 ? ` <small>×${x.vezes}</small>` : ""}</span><b>${x.moedas >= 0 ? "+" : ""}${x.moedas}</b></li>`).join("")}</ul><button type="button" class="lg-bau-ok" onclick="fecharBauLobbyEscritorio()">Bora trabalhar</button>` : `<b class="lg-bau-titulo">Seu baú do dia chegou</b><p>Toque para abrir.</p>`}
</div></div>`;
}
function pintarBauLobbyEscritorio() {
  let el = document.getElementById("lg-bau-lugar");
  if (el) el.innerHTML = escritorioLobbyBauHtml();
}
function abrirBauLobbyEscritorio() {
  const caixa = document.querySelector(".lg-bau-caixa");
  if (caixa) caixa.classList.add("tremendo");
  setTimeout(() => { escritorio.lobbyBauAberto = true; pintarBauLobbyEscritorio(); const n = document.querySelector(".lg-bau"); if (n && typeof rkConfete === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) rkConfete(n); }, 650);
}
function fecharBauLobbyEscritorio() {
  try { localStorage.setItem("vybe-escritorio-bau-" + (escritorio.base?.eu || ""), escritorioHojeBahia()); } catch {}
  escritorio.lobbyBau = null; escritorio.lobbyBauAberto = false;
  pintarBauLobbyEscritorio();
}
async function prepararBauLobbyEscritorio(ganhos) {
  if (!ganhos || (!ganhos.moedas && !ganhos.pontos)) return;
  let visto = ""; try { visto = localStorage.getItem("vybe-escritorio-bau-" + (escritorio.base?.eu || "")) || ""; } catch {}
  if (visto === escritorioHojeBahia()) return;
  try { if (!escritorio.lobbyBauArte) { const m = await mapaCarregarMovel("pirate_crate"); const d = mapaDesenharMovel(m, mapaDirecaoValida(m.dados, 2) ?? 2, 0, 0); escritorio.lobbyBauArte = d?.canvas?.toDataURL() || ""; } } catch {}
  escritorio.lobbyBau = ganhos;
  pintarBauLobbyEscritorio();
}
// Quem está no escritório agora: uma conexão só de leitura com o Worker
// (presence:join com observar), que não põe você na lista nem na voz.
function escritorioLobbyOnlineHtml() {
  const lista = escritorio.lobbyOnline;
  if (!lista) return '<h3>Agora no escritório</h3><span class="lg-rostos"><i class="lg-vazio"></i><i class="lg-vazio"></i><i class="lg-vazio"></i></span>';
  if (!lista.length) return '<h3>Agora no escritório</h3><p>Ninguém por aqui. Seja o primeiro a chegar!</p>';
  const lugar = escritorioLobbyLugar;
  // Como a lista de amigos de um jogo: o rosto com a bolinha verde e, ao
  // passar o mouse, o nome e onde está.
  return `<h3><i class="ofc-lobby-aovivo" aria-hidden="true"></i>${lista.length} ${lista.length === 1 ? "online" : "online agora"}</h3><span class="lg-rostos">${lista.slice(0, 7).map((p) => { const u = escritorioCabecaUrl(p.id), n = safeText(String(p.nome || "").split(" ")[0]); return `<span class="lg-amigo" tabindex="0" aria-label="${n}, ${safeText(lugar(p))}">${u ? `<img src="${safeText(u)}" alt="" width="40" height="40">` : "<i></i>"}<span class="lg-dica"><b>${n}</b>${safeText(lugar(p))}</span></span>`; }).join("")}${lista.length > 7 ? `<span class="lg-mais">+${lista.length - 7}</span>` : ""}</span>`;
}
// Dias seguidos entregando, no herói (vem com o ranking da entrada).
function escritorioLobbyFogoHtml() {
  const n = Number(escritorio.lobbyEspera?.sequencia || 0);
  return n > 1 ? `<span class="ofc-lobby-chama" aria-hidden="true"></span><b>${n} dias</b> seguidos entregando` : "";
}
// Leva para as missões: entra na sala com o cartão de missões aberto.
function abrirMissoesPeloLobbyEscritorio() {
  try { localStorage.setItem("vybe-escritorio-missoes", "aberto"); localStorage.setItem("vybe-escritorio-cobrancas", "fechado"); } catch {}
  entrarPeloLobbyEscritorio(escritorioMinhaMesa() ? "sala" : "ultimo");
}
function escritorioLobbyEsperaHtml() {
  const e = escritorio.lobbyEspera, eu = safeText(String(escritorio.base?.eu || ""));
  // Botões de jogo, todos do mesmo desenho: cartão escuro, a peça do Habbo
  // num poço e o número num selo (vermelho quando pede atenção). Enquanto o
  // resumo chega, os botões ficam no lugar com o brilho passando.
  const LG_ARTE = { missoes: "exe_map", cobrancas: "exe_c15_telephone", recados: "nyc_c23_mailbox", ranking: "trophy_fball_c26_wingedgold", conquistas: "prizetrophy" };
  const botao = (tipo, icone, nome, valor, detalhe, acao, alerta, sufixo = "") => `<button type="button" class="lg-botao jg-${tipo}${alerta ? " alerta" : ""}${e ? "" : " esqueleto"}" ${acao ? `onclick="${acao}"` : "disabled"} title="${safeText(detalhe || "")}"><span class="lg-botao-icone">${LG_ARTE[tipo] && typeof escritorioMiniaturaHtml === "function" ? escritorioMiniaturaHtml(LG_ARTE[tipo]) : escritorioIcone(icone)}${valor != null && (Number(valor) || sufixo) ? `<b class="lg-selo"><span data-vb-contar="${Number(valor) || 0}" data-vb-chave="lobby-${tipo}-${eu}">${Number(valor)}</span>${sufixo}</b>` : ""}</span><span class="lg-botao-txt"><b>${nome}</b><small>${detalhe ? safeText(detalhe) : "&nbsp;"}</small></span></button>`;
  const temSala = Boolean(escritorioMinhaMesa());
  const x = e || {};
  return [
    botao("missoes", "alvo", "Missões", x.missoes, e ? (x.atrasadas ? `${x.atrasadas} ${x.atrasadas === 1 ? "atrasada" : "atrasadas"}` : x.missoes ? "para hoje" : "nada para hoje") : "", e ? "abrirMissoesPeloLobbyEscritorio()" : "", x.atrasadas),
    botao("cobrancas", "clientes", "Cobranças", x.cobrancas, e ? (x.cobrancas ? "no seu quarto" : "ninguém cobrando") : "", e && temSala ? "entrarPeloLobbyEscritorio('sala')" : "", x.cobrancas),
    botao("recados", "conversa", "Recados", x.recados, e ? (x.recados ? "não lidos" : "tudo lido") : "", e ? "abrirRecadosEscritorio()" : "", x.recados),
    botao("ranking", "ranking", "Ranking", x.posicao, e ? x.falta || "da semana" : "", "abrirRankingEscritorio('geral','semana')", false, "º"),
    botao("conquistas", "estrela", "Conquistas", null, "troféus e títulos", "abrirConquistasEscritorio()", false),
  ].join("");
}
async function carregarLobbyEscritorio() {
  if (escritorio.lobbyCarregando || escritorio.base?.demo) return;
  escritorio.lobbyCarregando = true;
  const eu = String(escritorio.base?.eu || "");
  // O último resumo deste navegador aparece na hora, marcado "atualizando";
  // cada número troca quando o valor de agora chega (o guardado nunca passa
  // por atual: sem resposta, continua marcado).
  const chave = "vybe-escritorio-lobby-" + eu;
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem(chave) || "null"); } catch {}
  const espera = {};
  if (guardado && !escritorio.lobbyEspera) { escritorio.lobbyEspera = { ...guardado, antigo: true }; const el = document.getElementById("ofc-lobby-espera"); if (el) { el.innerHTML = escritorioLobbyEsperaHtml(); el.classList.add("antigo"); } }
  const pintar = () => {
    escritorio.lobbyEspera = { ...(guardado || {}), ...espera, antigo: Boolean(guardado) && Object.keys(espera).length < 4 };
    const el = document.getElementById("ofc-lobby-espera"); if (el) { el.innerHTML = escritorioLobbyEsperaHtml(); el.classList.toggle("antigo", Boolean(escritorio.lobbyEspera.antigo)); if (typeof vbAnimarContagens === "function") vbAnimarContagens(el); }
    const fogo = document.getElementById("ofc-lobby-fogo"); if (fogo) fogo.innerHTML = escritorioLobbyFogoHtml();
  };
  const tarefas = [
    escritorioApi("missoes").then((d) => { const l = d.missoes || []; espera.missoes = l.filter((m) => m.hoje || m.atrasada).length; espera.atrasadas = l.filter((m) => m.atrasada).length; pintar(); }).catch(() => {}),
    escritorioApi("cobrancas", null, { pessoa: eu }).then((d) => { espera.cobrancas = (d.cobrancas || []).length; pintar(); }).catch(() => {}),
    escritorioApi("recados-resumo").then((d) => { espera.recados = (d.resumo || []).reduce((t, r) => t + Number(r.nao_lidos || 0), 0); pintar(); }).catch(() => {}),
    escritorioApi("lobby").then((d) => { escritorio.lobbyNovidades = d.noticias || []; montarNoticiasLobbyEscritorio(); prepararBauLobbyEscritorio(d.ganhos); }).catch(() => {}),
    escritorioApi("ranking").then((d) => {
      escritorioRanking.dados.semana = d;
      montarNoticiasLobbyEscritorio();
      const lista = (d.pessoas || []).filter((x) => x.posicao).sort((x, y) => x.posicao - y.posicao), k = lista.findIndex((x) => x.id === eu), p = lista[k] || (d.pessoas || []).find((x) => x.id === eu), acima = k > 0 ? lista[k - 1] : null;
      espera.sequencia = Number(p?.sequencia || 0);
      if (p?.posicao) { espera.posicao = p.posicao; if (acima) { const n = Math.max(1, Number(acima.xp) - Number(p.xp) + 1); espera.falta = `faltam ${n.toLocaleString("pt-BR")} XP para passar ${String(acima.nome).split(" ")[0]}`; } else espera.falta = "você lidera a semana"; }
      pintar();
    }).catch(() => {}),
  ];
  await Promise.all(tarefas);
  if (Object.keys(espera).length) try { delete espera.antigo; localStorage.setItem(chave, JSON.stringify({ ...(guardado || {}), ...espera })); } catch {}
  escritorio.lobbyCarregando = false;
}
async function observarLobbyEscritorio() {
  const b = escritorio.base;
  if (escritorio.lobbySocket || !b?.worker || !b?.token || b.demo) return;
  // Só com o Worker que entende "observar": o antigo trataria como entrada de verdade.
  try { const h = await fetch(new URL("/health", b.worker), { cache: "no-store" }).then((r) => r.json()); if (!h?.observar) return; } catch { return; }
  if (escritorio.conectado || escritorio.lobbySocket) return;
  const url = new URL("/room/vybe-os", b.worker); url.protocol = "wss:";
  const s = new WebSocket(url);
  escritorio.lobbySocket = s;
  s.onopen = () => s.send(JSON.stringify({ type: "presence:join", payload: { token: b.token, observar: true } }));
  s.onmessage = (m) => {
    let e; try { e = JSON.parse(m.data); } catch { return; }
    if (e.type !== "presence:update") return;
    escritorio.lobbyOnline = (e.payload || []).filter((p) => String(p.id) !== String(b.eu));
    const el = document.getElementById("ofc-lobby-online");
    if (el) el.innerHTML = escritorioLobbyOnlineHtml();
    pintarTurmaLobbyEscritorio();
  };
  s.onclose = () => { if (escritorio.lobbySocket === s) escritorio.lobbySocket = null; };
}
function fecharObservadorLobbyEscritorio() {
  const s = escritorio.lobbySocket;
  escritorio.lobbySocket = null;
  if (s) try { s.close(); } catch {}
}
// Botões da entrada: onde entrar (minha sala, Convivência ou onde parei), o
// teste do microfone e "entrar silenciado" (o padrão continua ligado).
function escritorioLobbyAcoesHtml(b) {
  if (!b.demo && escritorioOutraAbaConectada()) return `<div class="ofc-lobby-outra lg-entra" style="--o:5" role="status"><b>Você já está no escritório em outra aba</b><p>Para não ouvir tudo duas vezes, só uma aba fica conectada.</p><button type="button" class="ofc-primario" onclick="trazerEscritorioParaEstaAba()">Trazer para esta aba</button></div>`;
  if (b.demo) return `<div class="lg-base lg-entra" style="--o:5"><button id="office-connect" type="button" class="lg-entrar" onclick="escritorio.lobbyFechado=true;renderEscritorio()"><span>Ver o escritório</span></button></div>`;
  const temSala = Boolean(escritorioMinhaMesa());
  const mic = escritorio.lobbyMic, mudo = escritorio.microfoneQuer === false;
  return `<div class="lg-base lg-entra" style="--o:5"><div class="lg-bandeja">
<div class="lg-audio"><button type="button" class="lg-redondo${mic?.ligado ? " ativo" : ""}" onclick="${mic?.ligado ? "pararTesteMicLobbyEscritorio()" : "testarMicLobbyEscritorio()"}" aria-label="${mic?.ligado ? "Parar o teste do microfone" : "Testar o microfone"}" aria-describedby="lg-regra" title="${mic?.ligado ? "Parar o teste" : "Testar o microfone · microfone ligado nas salas, câmera desligada"}">${escritorioIcone("microfone")}</button>${mic?.ligado ? `<span class="ofc-lobby-nivel" aria-label="Nível do microfone"><i id="ofc-lobby-nivel"></i></span>${mic.dispositivos?.length > 1 ? `<select aria-label="Microfone" onchange="trocarMicLobbyEscritorio(this.value)">${mic.dispositivos.map((d) => `<option value="${safeText(d.deviceId)}"${d.deviceId === mic.atual ? " selected" : ""}>${safeText(d.label || "Microfone")}</option>`).join("")}</select>` : ""}` : mic?.erro ? `<small role="alert">${safeText(mic.erro)}</small>` : ""}
<label class="lg-mudo"><input type="checkbox" ${mudo ? "checked" : ""} onchange="escritorio.microfoneQuer=this.checked?false:true"><span aria-hidden="true"></span>Entrar silenciado</label></div>
<div class="lg-outros"><button type="button" class="lg-secundario" onclick="entrarPeloLobbyEscritorio('convivencia')">${escritorioIcone("pessoas")}Convivência</button>${temSala ? `<button type="button" class="lg-secundario" onclick="entrarPeloLobbyEscritorio('ultimo')">${escritorioIcone("avancar")}Onde parei</button>` : ""}<button type="button" class="lg-secundario" onclick="personalizarEscritorio()">${escritorioIcone("editar")}Personalizar</button></div></div>
<button id="office-connect" type="button" class="lg-entrar" onclick="entrarPeloLobbyEscritorio('${temSala ? "sala" : "ultimo"}')"><span class="lg-entrar-txt"><b>Entrar</b><small>${temSala ? "na minha sala" : "no escritório"}</small></span><kbd aria-hidden="true">Enter</kbd></button></div>`;
}
function entrarPeloLobbyEscritorio(destino) {
  escritorio.destinoEntrada = destino;
  // A saída de jogo: o boneco anda, a câmera mergulha na cidade e o painel some
  // enquanto o escritório carrega por baixo.
  escritorio.lobbySaindo = true;
  document.querySelector(".ofc-lobby")?.classList.add("saindo");
  pararTesteMicLobbyEscritorio(false);
  fecharObservadorLobbyEscritorio();
  try { localStorage.setItem("vybe-escritorio-entradas", String(escritorioVisitasEntrada() + 1)); } catch {}
  conectarEscritorio();
}
async function testarMicLobbyEscritorio(id) {
  pararTesteMicLobbyEscritorio(false);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: id ? { deviceId: { exact: id } } : true });
    const ctx = new (window.AudioContext || window.webkitAudioContext)(), an = ctx.createAnalyser();
    an.fftSize = 256; ctx.createMediaStreamSource(stream).connect(an);
    const dispositivos = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
    const atual = stream.getAudioTracks()[0]?.getSettings?.().deviceId || id || "";
    escritorio.lobbyMic = { ligado: true, stream, ctx, dispositivos, atual };
    renderEscritorio();
    const dados = new Uint8Array(an.frequencyBinCount);
    const passo = () => {
      if (escritorio.lobbyMic?.stream !== stream) return;
      an.getByteTimeDomainData(dados);
      let pico = 0; for (const v of dados) pico = Math.max(pico, Math.abs(v - 128));
      const barra = document.getElementById("ofc-lobby-nivel");
      if (barra) barra.style.width = Math.min(100, (pico / 64) * 100) + "%";
      escritorio.lobbyMic.quadro = requestAnimationFrame(passo);
    };
    passo();
  } catch (e) {
    escritorio.lobbyMic = { erro: e?.name === "NotAllowedError" ? "O navegador bloqueou o microfone. Libere no cadeado ao lado do endereço." : "Não achei um microfone neste computador." };
    renderEscritorio();
  }
}
function trocarMicLobbyEscritorio(id) {
  if (typeof escritorioSalvarPrefsAudio === "function") escritorioSalvarPrefsAudio({ microfone: id });
  testarMicLobbyEscritorio(id);
}
function pararTesteMicLobbyEscritorio(redesenhar = true) {
  const m = escritorio.lobbyMic;
  if (!m) return;
  cancelAnimationFrame(m.quadro);
  m.stream?.getTracks().forEach((t) => t.stop());
  m.ctx?.close?.().catch?.(() => {});
  escritorio.lobbyMic = null;
  if (redesenhar) renderEscritorio();
}
// O boneco chega andando até o ladrilho e acena (troca quadros da imagem).
// Para sozinho quando a entrada fecha; com "reduzir movimento", fica parado.
// O boneco aparece na vitrine do quarto dele (escritorioVitrineHtml), acenando.
function animarLobbyEscritorio() {
  escritorioMontarVitrines(document.querySelector(".ofc-lobby") || document);
  pintarTurmaLobbyEscritorio();
  // O cartão do quarto inclina de leve acompanhando o mouse.
  const lobby = document.querySelector(".ofc-lobby.lg");
  if (!lobby || lobby.dataset.inclina || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  lobby.dataset.inclina = "1";
  lobby.addEventListener("pointermove", (e) => {
    const c = document.getElementById("lg-quarto"); if (!c) return;
    const r = lobby.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    c.style.setProperty("--ry", (x * 8).toFixed(2) + "deg"); c.style.setProperty("--rx", (-y * 6).toFixed(2) + "deg");
  });
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
  // Uma conexão por pessoa: com o escritório aberto em outra aba, esta não
  // entra sozinha (o áudio dobrava). "Trazer para esta aba" passa a conexão.
  if (escritorioOutraAbaConectada() && !escritorio.assumindoAba) { escritorio.emOutraAba = true; renderEscritorio(); atualizarDockEscritorio(); return; }
  escritorio.assumindoAba = false; escritorio.emOutraAba = false;
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
        escritorioAbaAssumir();
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
        // Fila de música da sala em que entrou (se ela tiver aparelho de som).
        escritorio.musicaZona = undefined;
        escritorioMusicaDaSala();
        escritorio.mapa?.prontos.then(() => escritorioMusicaDaSala());
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
        if (typeof convidadoPresenca === "function") convidadoPresenca(escritorio.online, e.payload);
        const canalAntesDaLista = escritorioCanal();
        escritorio.online = e.payload;
        // Convidado entrou ou saiu da sua sala: a conversa da sala muda junto.
        if (escritorio.conectado && escritorioCanal() !== canalAntesDaLista) escritorioConversaAutomatica();
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
  escritorioAbaSoltar();
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
  dock.innerHTML = `<button class="office-dock-volta" onclick="voltarAoEscritorio()">${escritorioIcone("mapa")}<span>Voltar ao escritório</span></button>${escritorio.conectado ? `<details class="office-dock-team"><summary>${escritorio.online.length} online</summary><div>${escritorio.online.map((p) => `<p>${safeText(p.nome)} · ${safeText(escritorioLugarDe(p).nome)}</p>`).join("")}</div></details>` : escritorioOutraAbaConectada() ? `<span class="office-dock-outra">Escritório aberto em outra aba</span><button type="button" onclick="trazerEscritorioParaEstaAba()" title="Passa o escritório e o áudio para esta aba; a outra sai">Trazer para esta aba</button>` : `<button type="button" onclick="conectarEscritorio()" ${escritorio.conectando ? "disabled" : ""} title="Entra no escritório sem sair do painel: você vê quem está online e a equipe vê você">${escritorio.conectando ? "Entrando…" : "Fora do escritório · Entrar"}</button>`}${escritorio.chamada ? `<button onclick="alternarMidiaEscritorio('audio')">${escritorio.chamada.self.audioEnabled ? "Desligar microfone" : "Ligar microfone"}</button><button onclick="sairChamadaEscritorio()">Sair da chamada</button>` : ""}${escritorio.convite ? '<button onclick="aceitarConviteEscritorio()">Ver convite</button>' : ""}`;
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
// Menu do quarto na lateral: perfil do dono, entrar, chamar, convidar e recado.
function abrirMenuQuartoEscritorio(salaId, botao) {
  const menu = document.getElementById("office-quarto-menu");
  if (!menu) return;
  if (!menu.hidden && menu.dataset.sala === salaId) { menu.hidden = true; return; }
  const donoId = (escritorio.base?.salas || []).find((s) => s.id === salaId)?.pessoa_id;
  const dono = (escritorio.base?.equipe || []).find((p) => String(p.id) === String(donoId));
  if (!dono) { escritorioIrParaAmbiente(salaId); return; }
  const id = safeText(String(dono.id)), eu = String(dono.id) === String(escritorio.base?.eu);
  const online = (escritorio.online || []).some((p) => String(p.id) === String(dono.id));
  const acoes = [
    ["Ver perfil", `abrirFichaEscritorio('${id}')`],
    [eu ? "Ir para o meu quarto" : "Entrar no quarto", `escritorioIrParaAmbiente('${safeText(salaId)}')`],
    ...(!eu && online ? [["Chamar para cá", `chamarParaSalaEscritorio('${id}')`], ["Convidar para conversar", `convidarConversaEscritorio('${id}')`], ["Ir até", `escritorioIrAte('${id}')`]] : []),
    ...(!eu ? [["Deixar recado", `abrirRecadosEscritorio('${id}')`]] : []),
  ];
  menu.dataset.sala = salaId;
  menu.innerHTML = `<b>${safeText(dono.nome)}</b><small>${online ? "Online" : "Fora do escritório"}</small>${acoes.map(([t, f]) => `<button type="button" role="menuitem" onclick="document.getElementById('office-quarto-menu').hidden=true;${f}">${safeText(t)}</button>`).join("")}`;
  menu.hidden = false;
  const caixa = menu.offsetParent?.getBoundingClientRect(), r = botao.getBoundingClientRect();
  if (caixa) {
    menu.style.left = Math.max(4, Math.min(caixa.width - menu.offsetWidth - 4, r.left - caixa.left)) + "px";
    menu.style.top = r.bottom - caixa.top + (menu.offsetParent?.scrollTop || 0) + 4 + "px";
  }
  menu.querySelector("button")?.focus();
  const fora = (e) => { if (!menu.contains(e.target) && e.target !== botao && !botao.contains(e.target)) { menu.hidden = true; document.removeEventListener("pointerdown", fora); } };
  setTimeout(() => document.addEventListener("pointerdown", fora), 0);
  menu.onkeydown = (e) => { if (e.key === "Escape") { menu.hidden = true; botao.focus(); } };
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

// Emblemas das salas no navegador: um desenho por espaço (traço, sem emoji).
const ESCRITORIO_EMBLEMAS = {
  praca: '<path d="M12 3c-3 0-5 2.2-5 5 0 2.4 1.6 4.3 4 4.8V21h2v-8.2c2.4-.5 4-2.4 4-4.8 0-2.8-2-5-5-5z"/><path d="M5 21h14"/>',
  recepcao: '<path d="M4 11V9a3 3 0 013-3h10a3 3 0 013 3v2"/><path d="M3 11h18v5H3z"/><path d="M5 16v3M19 16v3"/>',
  reuniao: '<rect x="4" y="9" width="16" height="6" rx="2"/><path d="M7 15v4M17 15v4M8 6h8"/>',
  auditorio: '<rect x="3" y="4" width="18" height="11" rx="1.5"/><path d="M8 20h8M12 15v5"/>',
  producao: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>',
  cafe: '<path d="M5 9h11v5a5 5 0 01-5 5h-1a5 5 0 01-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 010 5H16M8 3v3M11 3v3"/>',
  jogos: '<rect x="3" y="8" width="18" height="9" rx="4.5"/><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01"/>',
  foco: '<path d="M4 5h6a2 2 0 012 2v13a2 2 0 00-2-2H4zM20 5h-6a2 2 0 00-2 2v13a2 2 0 012-2h6z"/>',
  academia: '<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>',
  lounge: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  quarto: '<path d="M4 11l8-6 8 6v9H4z"/><path d="M10 20v-5h4v5"/>',
  operacao: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
};
// A arte do próprio jogo representa cada sala (móvel do Habbo desenhado pela
// arte local, a mesma do mapa); o traço acima fica enquanto a arte carrega.
const ESCRITORIO_ARTE_SALA = { praca: "bazaar_r17_fountain", recepcao: "modern_c17_sofa", reuniao: "army_c15_contable", auditorio: "cine_screen",
  producao: "studio_camera", cafe: "sunsetcafe_c20_coffeemachine", jogos: "arcade_c23_space", foco: "classic9_bookshelf", academia: "olympics_c16_treadmill",
  lounge: "disco_c26_jukebox", operacao: "army_c15_deskcomp", quarto: "bed_polyfon_one" };
function escritorioEmblemaSala(id) {
  const arte = ESCRITORIO_ARTE_SALA[id];
  const pronta = arte && ESCRITORIO_ARTES_PRONTAS.get(arte);
  return `<svg class="ofc-ico" viewBox="0 0 24 24" aria-hidden="true">${ESCRITORIO_EMBLEMAS[id] || ESCRITORIO_EMBLEMAS.recepcao}</svg>${arte ? `<img class="ofc-arte${pronta ? " pronta" : ""}" alt="" data-arte="${arte}"${pronta ? ` src="${pronta}"` : ""}>` : ""}`;
}
const ESCRITORIO_ARTES_PRONTAS = new Map();
// Desenha (uma vez por móvel) as artes que ainda faltam na tela.
async function pintarArtesEscritorio(raiz = document) {
  for (const img of raiz.querySelectorAll("img.ofc-arte:not(.pronta)")) {
    const classe = img.dataset.arte;
    try {
      let url = ESCRITORIO_ARTES_PRONTAS.get(classe);
      if (!url) {
        const m = await mapaCarregarMovel(classe);
        // Desenho na memória comum: o toDataURL de um canvas da placa de vídeo
        // esperava ela esvaziar a fila e travava a entrada por até ~0,6 s.
        const d = mapaDesenharMovel(m, mapaDirecaoValida(m.dados, 2) ?? 2, 0, 0, 0, null, true);
        if (!d) continue;
        url = d.canvas.toDataURL();
        ESCRITORIO_ARTES_PRONTAS.set(classe, url);
      }
      img.src = url;
      img.classList.add("pronta");
    } catch {}
  }
}
// Vitrine do personagem (Paulo, 21/10/2026: "o cartão do personagem precisa
// ser uma parada muito foda… manter o padrão sempre que aparecer"; "o bloco e
// o tema têm que ser sempre os do quarto da pessoa"; "tá com física? com
// movimento?"): um pedaço de 3 × 3 do quarto da pessoa desenhado pelo próprio
// motor do mapa — piso e parede dela, até três móveis dela no fundo e nos
// lados, o boneco no meio acenando ao abrir —, na mesma escala e na mesma
// ordem de profundidade do jogo. O mesmo em todo lugar: entrada, Meu espaço,
// ficha e o fundo do provador.
function escritorioVitrineHtml(classe = "", pessoaId = escritorio.base?.eu, { boneco = true, zoom = 2, desce = 0.2, planta = "" } = {}) {
  return `<div class="vb-vitrine ofc-mapa ${classe}" data-pessoa="${safeText(String(pessoaId || ""))}"${boneco ? ' data-boneco="1"' : ""} data-zoom="${Number(zoom)}" data-desce="${Number(desce)}"${planta ? ` data-planta="${safeText(planta)}"` : ""} aria-hidden="true"></div>`;
}
function escritorioMontarVitrines(raiz = document) {
  if (typeof criarMapaEscritorio !== "function") return;
  const vivas = (escritorio.vitrines ||= []);
  for (let i = vivas.length - 1; i >= 0; i--) if (!vivas[i].el.isConnected) { try { vivas[i].mapa.destruir(); } catch {} vivas.splice(i, 1); }
  for (const el of raiz.querySelectorAll(".vb-vitrine:not([data-montada])")) {
    el.dataset.montada = "1";
    const pid = el.dataset.pessoa, sala = pid ? escritorioDonos().get(String(pid)) : null;
    const base = sala || ESCRITORIO_PLANTA.ambientes.find((a) => a.pessoal);
    // Outra planta (a prévia do recado mostra a Mansão no piso da pessoa).
    const plantaId = el.dataset.planta || "vitrine", dim = escritorioDimQuarto({ planta: plantaId });
    const a = { ...base, id: "vitrine-" + (pid || "x"), planta: plantaId, x1: base.x0 + dim.w, y1: base.y0 + dim.h, celdasLivres: "", semParedes: false, pintura: null,
      piso: sala?.piso || "grama", cor: sala?.cor || "#4fd18b", porta: "baixo" };
    el.style.setProperty("--c", a.cor);
    const planta = { ...escritorioPlantaDoQuarto(a), moveis: [], fixos: [], rotulos: [], imagens: [], soleiras: [], previa: true, vitrine: true, zoomFixo: escritorioZoomDaVitrine(el), desce: Number(el.dataset.desce) || 0 };
    let mapa;
    try { mapa = criarMapaEscritorio(el, { planta, eu: null }); } catch (e) { console.warn("vitrine:", e.message); continue; }
    vivas.push({ el, mapa });
    if (el.dataset.boneco) {
      const perfil = String(pid) === String(escritorio.base?.eu) ? escritorio.perfil : escritorio.base?.equipe?.find((p) => String(p.id) === String(pid))?.perfil;
      const pessoa = (acao) => [{ id: "vitrine-" + pid, nome: "", perfil: { figura: mapaFigura(perfil || {}) }, status: "disponivel", corStatus: "#3fbf7f", rotulo: "", statusTexto: "", x: Math.floor(dim.w / 2), y: Math.floor(dim.h / 2), acao, mao: perfil?.mao || "", dir: 2 }];
      const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      mapa.atualizarPessoas(pessoa(quieto ? "std" : "wav"));
      if (!quieto) setTimeout(() => { if (el.isConnected) mapa.atualizarPessoas(pessoa("std")); }, 2600);
    }
    if (plantaId === "vitrine") escritorioMoveisDaVitrine(pid).then((itens) => { if (el.isConnected) for (const it of itens) mapa.acrescentarMovel?.(it); });
  }
}
// O zoom pedido vale para um cartão de 400 px; num cartão menor (celular) o
// quarto se afasta na mesma proporção, para não cortar o boneco.
function escritorioZoomDaVitrine(el) {
  // Também cresce num cartão maior (telas grandes), até 1,6×: o quarto
  // continua preenchendo o cartão em vez de sobrar chão vazio.
  const z = Number(el.dataset.zoom) || 0, largura = el.getBoundingClientRect().width;
  return z >= 1.5 && largura > 60 ? Math.round(z * Math.min(1.6, Math.max(0.5, largura / 400)) * 100) / 100 : z;
}
// Até dois móveis do quarto da pessoa que ocupam um ladrilho, um de cada lado
// do boneco (nem atrás, que parece sair das costas dele, nem na frente):
// troféu e planta primeiro. Peça de parede fica de fora.
async function escritorioMoveisDaVitrine(pessoaId) {
  const cache = (escritorio.moveisVitrine ||= {});
  if (cache[pessoaId]) return cache[pessoaId];
  const sala = pessoaId ? escritorioDonos().get(String(pessoaId))?.id : null;
  if (!sala || typeof mapaCarregarMovel !== "function") return [];
  const classes = (escritorioItensDaCamada(sala) || []).map((it) => String(it[0] || "")).filter((c) => c && !/^plano:|^wf_|^vybeimg_|door|porta|wall|window|rug|carpet|tapete|floor|tile/i.test(c));
  const peso = (c) => (/troph|statue|award|cup/i.test(c) ? 0 : /plant|flor|tree|bonsai|cactus|vase/i.test(c) ? 1 : 2);
  const lugares = [[2, 0], [0, 2]], itens = [];
  for (const classe of [...new Set(classes)].sort((x, y) => peso(x) - peso(y))) {
    if (itens.length >= lugares.length) break;
    try {
      const m = await mapaCarregarMovel(classe), d = m.dados?.logic?.model?.dimensions || { x: 1, y: 1 };
      if (d.x > 1 || d.y > 1 || mapaEhDeParede(m.dados, classe)) continue;
      const [x, y] = lugares[itens.length];
      itens.push([classe, x, y, mapaDirecaoValida(m.dados, x ? 4 : 2) ?? 2, 0, 0]);
    } catch {}
  }
  return (cache[pessoaId] = itens);
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
    outraAba: '<rect x="3" y="7" width="13" height="13" rx="2"/><path d="M10 3h11v11M21 3l-9 9"/>',
    estaAba: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
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
    inventario: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
    estrela: '<path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.4l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
    ranking: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z"/>',
    agenda: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17h2M11 17h2"/>',
    loja: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9"/><path d="M5.5 11.5V20h13v-8.5M10 20v-5h4v5"/>',
    cursor: '<path d="M6 3.5l12 7.2-5.3 1.3 3.2 6.2-2.4 1.2-3.2-6.2L6 17z"/>',
    mao: '<path d="M8 12V6.5a1.5 1.5 0 013 0V11M11 10.5V5a1.5 1.5 0 013 0v5.5M14 10.5V6.5a1.5 1.5 0 013 0V14c0 3.6-2.4 6.5-6 6.5-2.4 0-3.8-1.1-5.1-3L4 14.6a1.5 1.5 0 012.5-1.6L8 15"/>',
    grade: '<path d="M4 8.5l8-4 8 4-8 4zM8 6.5l8 4M16 6.5l-8 4"/><path d="M4 8.5v7l8 4 8-4v-7"/>',
    pilha: '<rect x="6" y="14" width="12" height="6" rx="1"/><rect x="7.5" y="8.5" width="9" height="5.5" rx="1"/><path d="M12 2.5v4M10 4.5l2-2 2 2"/>',
    desfazer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
    refazer: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
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
  const lista = escritorioItensDaCamada(camada).map((it, i) => [...it.slice(0, 6), { camada, i, ...(it[6] && typeof it[6] === "object" && !Array.isArray(it[6]) ? { cfg: it[6] } : {}) }]);
  // A taça da Copa continua na sala quando o mapa redesenha os móveis.
  const taca = !escritorio.edicao && escritorio.mapa?.tacaLugar;
  return taca ? [...lista, ["fball_trophy", taca.x, taca.y, 2, 0, 0, { copa: true }]] : lista;
}
function escritorioRaizQuarto(id) { return String(id || '').replace(/-andar-1$/,''); }
function escritorioPerfilDecoracao(id=escritorio.quarto || escritorioMinhaMesa()?.ambiente.id) {
  if (escritorio.edicao?.camada === id && escritorio.edicao.decoracao) return escritorio.edicao.decoracao;
  const raiz=escritorioRaizQuarto(id), dono=escritorio.base?.salas?.find(s=>s.id===raiz)?.pessoa_id;
  const perfil=String(dono)===String(escritorio.base?.eu) ? escritorio.perfil : escritorio.base?.equipe?.find(p=>String(p.id)===String(dono))?.perfil;
  return String(id).endsWith('-andar-1') ? perfil?.sala_andares?.find(a=>a.andar===1) : perfil;
}
function escritorioAlterarDecoracao(patch) {
  if (escritorio.edicao?.decoracao && escritorio.edicao.camada === escritorio.quarto) { Object.assign(escritorio.edicao.decoracao,patch); return; }
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
  const r={...a,...escritorioPlanosDoPerfil(perfil,escritorioDimQuarto({planta:perfil.sala_planta})),id,nome:a.nome+' · segundo andar',planta:perfil.sala_planta,piso:perfil.sala_piso || a.pisoPadrao,cor:perfil.sala_parede || a.corPadrao,luz:perfil.sala_luz || '',celdasLivres:escritorioCeldasDoPerfil(perfil.sala_celdas),semParedes:perfil.sala_sem_paredes===true,...escritorioOpcoesDoQuarto(perfil),porta:['baixo','direita'].includes(perfil.sala_porta) ? perfil.sala_porta : a.porta};
  const dim=escritorioDimQuarto(r);r.x1=r.x0+dim.w;r.y1=r.y0+dim.h;
  const L=ESCRITORIO_QUARTO_MAX,pisos=new Map(),paredes=new Map();
  const lp=escritorioPisosDoPerfil(perfil.sala_pisos), lw=escritorioParedesDoPerfil(perfil.sala_paredes);
  if(lp.length===L*L) for(let i=0;i<L*L;i++) {const k=ESCRITORIO_PISOS_SALA[parseInt(lp[i],16)]?.[0];if(k)pisos.set(`${i%L},${Math.floor(i/L)}`,k);}
  // Revestimento do acervo no trecho (sala_paredes_texturas): cobre a parede
  // inteira, na altura do trecho (a do quarto se o trecho não foi pintado).
  const tex=escritorioTexturasDoPerfil(perfil.sala_paredes_texturas);
  for(let i=0;i<L*4;i++){const [estilo,c,h]=lw.length===L*12?lw.slice(i*3,i*3+3):'-00';if(estilo==='-'&&!tex.has(i))continue;paredes.set(escritorioChaveTrecho(r,i),{estilo:estilo==='-'?'a':estilo,cor:ESCRITORIO_PAREDES_SALA[parseInt(c,16)] || r.cor,alt:estilo==='-'?undefined:[46,82,118][Number(h)],...(tex.has(i)?{textura:tex.get(i)}:{})});}
  r.pintura={pisos,paredes,texturas:[...new Set(tex.values())]}; return r;
}
function escritorioAndaresHtml() {
  const id=escritorio.quarto;if(!id || escritorioCenaComum(id)) return '';
  const raiz=escritorioRaizQuarto(id), superior=escritorioPerfilDecoracao(raiz+'-andar-1');
  // Construindo: só a troca de andar (e só se houver dois); gerenciar e
  // convidar ficam para fora da construção.
  if (escritorio.edicao && !superior?.quarto_configurado) return '';
  return `<nav class="ofc-andares" aria-label="Andares do escritório"><button type="button" aria-pressed="${id===raiz}" onclick="escritorioEntrarNoQuarto('${raiz}')">Térreo</button>${superior?.quarto_configurado ? `<button type="button" aria-pressed="${id!==raiz}" onclick="escritorioEntrarNoQuarto('${raiz}-andar-1')">Segundo andar</button>` : ''}${escritorioNoMeuQuarto() && !escritorio.edicao ? `<button type="button" onclick="personalizarEscritorio()">Gerenciar meu espaço</button><button type="button" onclick="convidarParaMinhaSalaEscritorio()" title="Mande um link para alguém de fora entrar na sua sala">Convidar</button>` : ''}</nav>`;
}
// Planta da cena atual para o renderizador: a sala (com a pintura do dono,
// lida na hora de desenhar) ou a Praça, a cena de abertura.
function escritorioPlantaDaCena() {
  const imagens = escritorio.base?.mapa?.imagens || [];
  const a = escritorioAmbienteDoQuarto();
  if (a) { const pq = escritorioPlantaDoQuarto(a); return { ...pq, moveis: [...escritorioMoveisAtuais(), ...pq.fixos], imagens,
    pisoLadrilho: (x, y) => a.pintura?.pisos.get(x + "," + y), paredeEm: (x, y, eixo) => a.pintura?.paredes.get(`${eixo}:${x},${y}`), texturasParede: a.pintura?.texturas || [] }; }
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
    const perfil = escritorioPerfilDecoracao(a.id);
    a.planta = perfil?.sala_planta || "amplo";
    // O quarto tem o tamanho da planta escolhida (coordenadas locais).
    const dim = escritorioDimQuarto(a); a.x1 = a.x0 + dim.w; a.y1 = a.y0 + dim.h;
    a.piso = perfil?.sala_piso && ESCRITORIO_PLANTA.PISO[perfil.sala_piso] ? perfil.sala_piso : a.pisoPadrao;
    a.cor = /^#[0-9a-f]{6}$/i.test(perfil?.sala_parede || "") ? perfil.sala_parede : a.corPadrao;
    a.luz = ESCRITORIO_LUZES_SALA.some(([id]) => id === perfil?.sala_luz) ? perfil.sala_luz : "";
    a.celdasLivres = escritorioCeldasDoPerfil(perfil?.sala_celdas);
    Object.assign(a, escritorioPlanosDoPerfil(perfil, dim));
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
    const perfil = escritorioPerfilDecoracao(a.id);
    const lp = escritorioPisosDoPerfil(perfil?.sala_pisos), lw = escritorioParedesDoPerfil(perfil?.sala_paredes);
    // Pintura em grade de ESCRITORIO_QUARTO_MAX² (o maior quarto); cada planta usa o canto dela.
    const L = ESCRITORIO_QUARTO_MAX;
    if (lp.length === L * L) for (let i = 0; i < L * L; i++) {
      const k = typeof ESCRITORIO_PISOS_SALA !== "undefined" ? ESCRITORIO_PISOS_SALA[parseInt(lp[i], 16)]?.[0] : "";
      if (k) pisos.set(`${a.x0 + (i % L)},${a.y0 + Math.floor(i / L)}`, k);
    }
    // Revestimento do trecho (sala_paredes_texturas) cobre a parede inteira,
    // como no segundo andar (escritorioAmbienteDoQuarto).
    const tex = typeof escritorioTexturasDoPerfil === "function" ? escritorioTexturasDoPerfil(perfil?.sala_paredes_texturas) : new Map();
    for (let i = 0; i < L * 4; i++) {
      const [estilo, c, h] = lw.length === L * 12 ? lw.slice(i * 3, i * 3 + 3) : "-00";
      if (estilo === "-" && !tex.has(i)) continue;
      const cor = typeof ESCRITORIO_PAREDES_SALA !== "undefined" ? ESCRITORIO_PAREDES_SALA[parseInt(c, 16)] : "";
      paredes.set(escritorioChaveTrecho(a, i), { estilo: estilo === "-" ? "a" : estilo, cor: cor || a.cor, alt: estilo === "-" ? undefined : [46, 82, 118][Number(h)], ...(tex.has(i) ? { textura: tex.get(i) } : {}) });
    }
    a.pintura = { pisos, paredes, texturas: [...new Set(tex.values())] };
  }
}
// Ao chegar, a pessoa aparece dentro do próprio quarto (modo foco), logo
// depois da porta; sem sala, na Convivência.
// Piso e papel de parede oficiais do Habbo escolhidos para o quarto inteiro
// (sala_piso_plano / sala_parede_plano); sem escolha, o piso e a cor da sala.
function escritorioPlanosDoPerfil(perfil, dim) {
  const piso = /^plano:piso:\d+$/.test(perfil?.sala_piso_plano || "") ? perfil.sala_piso_plano : "";
  return { texturas: piso ? [{ x0: 0, y0: 0, x1: dim.w, y1: dim.h, textura: piso }] : [], texturaParede: /^plano:parede:\d+$/.test(perfil?.sala_parede_plano || "") ? perfil.sala_parede_plano : "" };
}
function escritorioChegar() {
  const base = escritorio.base;
  if (!base.demo && !base.convidado) iniciarAvisosEscritorio();
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
// Centro de Operação (docs/planejamentos-plano.md): um agente por cliente
// ativo em cada mesa, com o nome do cliente e a situação do planejamento em
// cima. O clique abre o planejamento (vybe-planejamentos.js). O head vê, na
// lista de salas e no aviso da tela, quanto está esperando por ele.
// Fantasia de cada agente pela marca real do cliente (Paulo, 19/10/2026: "não
// precisa supor nada"). Conferido no Instagram de cada um (bio, logo, cores),
// nas contas de anúncio da Vybe e no Drive (mascote do Alpha1, manuais de
// marca): roupa nas cores da marca, peça que diz o que o cliente é e um
// bordão tirado do próprio perfil. Figura completa (cabelo, pele, roupa);
// peças vistas na arte do Habbo. Paleta de roupa: 1424 azul, 1415 magenta,
// 1429 oliva, 109 verde-escuro, 100 vinho, 101 verde-limão, 104 verde-água,
// 1414 rosa, 89 bege, 76 roxo, 94 laranja, 66 amarelo, 1427 prata, 110 preto.
// Cliente novo sem persona: fantasia pelo segmento do cadastro, abaixo.
const ESCRITORIO_FANTASIAS = [
  // @alpha1consultoria_: consultoria; mascote lobo de polo azul e botas (Drive, LOGO + MASCOTE).
  [/alpha ?1/, "hr-828-61.hd-180-1.ch-215-1424.lg-280-110.sh-305-1325.fa-3771-64", "M", ["Aqui sua empresa não navega: ela voa!", "Soluções inteligentes para a sua empresa.", "Auuu! Cadê o post da semana?"], "crr=87"],
  // @copirece: cooperativa do milho, cuscuz e derivados. A Zene representa a
  // marca (Paulo, 20/10/2026; foto em Drive/FOTOS ZENE): cachos escuros na
  // altura do ombro, óculos, vestido longo laranja florido; pipoca é milho.
  [/copirec/, "hd-600-1370.hr-3870-61.ea-3727-110.ch-4275-1411.sh-735-110", "F", ["Cuscuz de Irecê para o mundo!", "Milho puro, não transgênico.", "Hoje tem receita com cuscuz?"], "crr=73"],
  // @brussoloristorante: gastronomia de raiz, menu de chef; creme e oliva.
  [/brussolo/, "hr-3011-31.hd-180-1.ch-215-1408.cc-3289-1429.lg-280-110.sh-305-110.ha-1024-1408", "M", ["Gastronomia de raiz, técnica e alma.", "Tavola per Due na vitrine!", "Reserva aberta para hoje."], "crr=66"],
  // @gonzalezgastronomia (Alecrim Gonzalez): almoço e jantar; verde-escuro.
  [/gonzalez/, "hr-3162-61.hd-180-10.ch-215-109.cc-3289-1408.lg-280-110.sh-305-110.ha-5510-1408", "M", ["Viva Ser Gonzalez!", "Almoço e jantar todos os dias.", "Delivery saindo!"], "crr=105"],
  // @academialionstop: academia há mais de 10 anos; leão prateado.
  [/lions/, "hr-828-61.hd-180-8.ch-215-110.lg-280-110.sh-305-110.ha-5379-1427", "M", ["Mais de 10 anos transformando vidas!", "FitDance, ritbox e funcional.", "100% climatizada, bora treinar!"], "crr=185"],
  // @antonovcenter: academia de treino e tecnologia; preto e laranja. Roupa
  // de academia (Paulo, 20/10/2026): regata, short e tênis laranja, garrafinha.
  [/antonov/, "hr-165-45.hd-180-2.ch-3429-110.lg-5547-1323.sh-305-1323", "M", ["Treino, tecnologia e estilo de vida.", "Estrutura que acelera o seu desempenho.", "Faça sua matrícula!"], "crr=185"],
  // @mangaba_ai: IA colaborativa, agentes e automação; amarelo-manga.
  [/mangaba/, "hr-828-61.hd-180-1.ch-215-1408.cc-3389-66.lg-280-110.sh-305-94.ha-5004-1408", "M", ["Automação, agentes, resultados.", "Bip bop: agente pronto.", "IA colaborativa para o time."], "crr=112"],
  // @conectasimprovedor: provedor de internet; vinho. Técnico de internet:
  // camisa com logo, fone com microfone e tablet na mão (Paulo, 20/10/2026).
  [/conecta ?sim/, "hr-3090-61.hd-180-14.ch-5091-100.lg-280-82.sh-305-110.he-3324-110", "M", ["O melhor provedor de internet da Bahia!", "Atendimento 100% humanizado.", "Sinal cheio, post no ar?"], "crr=282"],
  // Grupo Serra Grande Bebidas: distribuidora. Motorista de entrega no estilo
  // de quem trabalha na Heineken (Paulo, 20/10/2026): boné e camisa verdes,
  // lata verde na mão.
  [/serra grande/, "hr-828-61.hd-180-8.ha-6076-1430.ch-5091-1430.lg-280-110.sh-305-62", "M", ["Para uma vida mais leve!", "Entrega saindo agora!", "Seja um revendedor!"], "crr=42"],
  // @voasportswear (VÖA Sportswear, no Antonov Center): moda fitness; bege.
  // Look de academia (Paulo, 20/10/2026): top, legging e garrafinha.
  [/\bv[oö]a\b/, "hr-890-45.hd-605-2.ch-3135-89.lg-3116-110.sh-735-1408", "F", ["Feita para voar!", "Legging nova no feed?", "Top, short e legging na vitrine."], "crr=185"],
  // @experimentepapelaria: papelaria; roxo.
  [/experimente/, "hr-890-61.hd-605-1.ch-3005-76.lg-3116-110.sh-735-110.ea-3108-1408", "F", ["Toda descoberta começa com experimentação!", "Material escolar chegando!", "Compre também pelo WhatsApp."], "crr=230"],
  // @hebravetoficial: clínica veterinária e pet shop; preto e verde-limão.
  [/hebravet/, "hr-3012-45.hd-180-2.ch-215-101.cc-3827-1408.lg-280-110.sh-305-110", "M", ["A evolução do cuidado animal!", "Internação 24h, viu?", "Pet com consulta em dia?"]],
  // @hellenrochax: advogada previdenciarista (INSS); azul.
  [/hellen/, "hr-890-31.hd-605-1.ch-3005-1408.cc-3008-1424.lg-3116-1424.sh-735-110.ea-3108-1408", "F", ["Benefício do INSS é direito!", "Cuidado com o golpe do INSS.", "Mais de 10 anos de previdenciário."], "crr=79"],
  // @diacenterbahia: clínica de hemodiálise; verde-água.
  [/dia ?center/, "hr-3043-45.hd-180-1.ch-215-104.cc-3827-1408.lg-280-104.sh-305-1408.ha-4301-1408", "M", ["Bem-estar do paciente renal.", "Irecê, Seabra e em breve Porto Seguro!", "10 anos de terapia renal."]],
  // @laboratorio_dialaboficial: análises clínicas; azul.
  [/dia ?lab/, "hr-3161-45.hd-605-14.ch-3005-1424.cc-3827-1408.lg-3116-1424.sh-735-110.ea-3108-1408", "F", ["Agende seu exame!", "Há mais de 20 anos cuidando da sua saúde.", "Resultado saindo do laboratório."], "crr=109"],
  // Pelo segmento do cadastro (clientes novos, até ganharem a persona da marca).
  [/cooperativ|coperativ|agro|fazend|rural/, "lg-280-64.ha-5221-1408"],
  [/restaurant|gastronom|ristorante|lanch|pizz|cozinh/, "ch-215-1408.cc-3289-1408.ha-5510-1408"],
  [/pet|veterin/, "cc-3827-1408"],
  [/laborat/, "cc-3827-1408.ea-3108-1408"],
  [/cl[ií]nica|sa[uú]de|m[eé]dic|odonto/, "ch-215-1408.cc-3827-1408.ha-4301-1408"],
  [/academia|fitness|esporte|crossfit/, "ha-3130-1408"],
  [/provedor|internet|telecom|fibra/, "ha-4325-66"],
  [/sistema|software|\bai\b|tecnolog/, "ch-215-1408.cc-3389-76.ea-3108-1408"],
  [/advoca|jur[ií]dic|direito/, "ch-3005-1408.cc-3008-1424.ea-3108-1408", "F"],
  [/bebida|distribuidor|[aá]gua/, "ch-215-82"],
  [/papelaria|varejo|loja/, "ea-3108-1408"],
  [/moda|roupa|boutique/, "ch-3005-71.lg-3116-76", "F"],
  [/empresa|consultor|solu[cç]/, "ch-215-82.ea-3108-1408"],
];
const ESCRITORIO_AGENTE_BASE = { M: "hr-828-61.hd-180-1.ch-215-1323.lg-280-110.sh-305-110", F: "hr-890-45.hd-605-2.ch-3005-1323.lg-3116-110.sh-735-110" };
function escritorioFantasiaDoAgente(a) {
  const texto = `${a.cliente || ""} ${a.segmento || ""}`.toLowerCase();
  return ESCRITORIO_FANTASIAS.find(([re]) => re.test(texto));
}
// O avatar editado no painel do agente (identidade do cliente) vence a
// fantasia padrão da marca; sem ele, a fantasia; sem fantasia, o uniforme.
function escritorioFiguraDoAgente(a, i) {
  if (a?.personagem?.figura) return a.personagem.figura;
  const [, roupa = "", corpo = i % 4 === 1 ? "F" : "M"] = escritorioFantasiaDoAgente(a) || [];
  const partes = new Map(ESCRITORIO_AGENTE_BASE[corpo].split(".").map((p) => [p.split("-")[0], p]));
  for (const p of roupa.split(".").filter(Boolean)) partes.set(p.split("-")[0], p);
  return [...partes.values()].join(".");
}
// Objeto de mão do agente (o "crr" do Habbo): o do avatar editado ou o da
// fantasia da marca.
function escritorioMaoDoAgente(a) {
  if (a?.personagem?.figura) return a.personagem.mao || "";
  return escritorioFantasiaDoAgente(a)?.[4] || "";
}
const ESCRITORIO_SITUACAO_PLANO = { revisar: ["Para revisar", "#ffc46b"], enviado: ["Com o cliente", "#8cc8ff"], aprovado: ["Aprovado", "#6fe3a8"],
  ajustes: ["Ajustes pedidos", "#ff8f8f"], cadastrado: ["Cadastrado", "#b9c2d0"] };
// O que o balão do agente diz quando pede ação de quem pode agir (head do
// cliente ou quem administra). Paulo, 20/10/2026: "um alerta maior".
const ESCRITORIO_ACAO_PLANO = { revisar: "Planejamento para revisar", ajustes: "Cliente pediu ajustes", aprovado: "Aprovado: cadastrar as peças" };
// A cor do status como está no catálogo do painel (STATUS_OPTIONS), pela chave.
function escritorioCorDoStatus(chave) {
  const lista = typeof STATUS_OPTIONS !== "undefined" ? STATUS_OPTIONS : [];
  const o = lista.find((x) => x.chave === chave) || lista.find((x) => typeof chaveDeStatus === "function" && chaveDeStatus(x.label || x.rotulo) === chave);
  return o?.color || o?.cor || null;
}
function escritorioDetalheDoPlano(p) {
  const r = p.revisao || {};
  if (p.estado === "enviado") return r.total ? `Com o cliente · ${r.cliente_aprovadas + r.cliente_ajustes} de ${r.total} respondidas` : "Com o cliente";
  if (p.estado === "revisar" && r.total) return `${ESCRITORIO_ACAO_PLANO.revisar} · ${r.head_ok} de ${r.total} OK`;
  if (p.estado === "ajustes" && r.cliente_ajustes) return `${ESCRITORIO_ACAO_PLANO.ajustes} · ${r.cliente_ajustes} ${r.cliente_ajustes === 1 ? "peça" : "peças"}`;
  return "";
}
// A situação curta da etiqueta do agente ("Revisar 0/19"); o texto inteiro
// (escritorioDetalheDoPlano) fica no título e no painel do agente.
function escritorioPilulaDoPlano(p) {
  const r = p.revisao || {};
  if (p.estado === "revisar") return r.total ? `Revisar ${r.head_ok}/${r.total}` : "Revisar";
  if (p.estado === "enviado") return r.total ? `Cliente ${r.cliente_aprovadas + r.cliente_ajustes}/${r.total}` : "Com o cliente";
  if (p.estado === "ajustes") return r.cliente_ajustes ? `Ajustes ${r.cliente_ajustes}` : "Ajustes";
  return (ESCRITORIO_SITUACAO_PLANO[p.estado] || [p.estado])[0];
}
async function escritorioOcuparOperacao() {
  if (escritorio.quarto !== "operacao" || !escritorio.mapa?.ocuparPostos) return;
  const mapa = escritorio.mapa;
  let postos;
  try {
    const r = await fetch("/api/painel?area=planejamentos&acao=operacao", { credentials: "same-origin", cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || "o painel não respondeu");
    postos = d.postos || [];
  } catch (e) { escritorioAviso("Não foi possível chamar os agentes: " + e.message); return; }
  if (mapa !== escritorio.mapa) return;
  // Cada agente senta na ala da carteira do cliente (Paulo, 20/10/2026: dividir
  // os clientes de Vinícius e de Ewerton). A carteira é a do painel
  // (carteiraDoCliente); quem não cabe na ala ou não tem carteira senta num
  // posto livre qualquer.
  const lugares = mapa.alasDosPostos ? mapa.alasDosPostos() : Array.from({ length: mapa.numeroDePostos() }, (_, posto) => ({ posto, ala: "" }));
  const livres = new Set(lugares.map((l) => l.posto));
  const lugarDe = new Map();
  for (const a of postos) {
    const carteira = typeof carteiraDoCliente === "function" ? carteiraDoCliente(a.cliente) : "";
    const l = lugares.find((x) => carteira && x.ala === carteira && livres.has(x.posto));
    if (l) { livres.delete(l.posto); lugarDe.set(a, l.posto); }
  }
  for (const a of postos) {
    if (lugarDe.has(a)) continue;
    const l = lugares.find((x) => livres.has(x.posto));
    if (!l) break;
    livres.delete(l.posto); lugarDe.set(a, l.posto);
  }
  const sentados = postos.filter((a) => lugarDe.has(a));
  const alas = { vinicius: { texto: "Carteira Vinícius", cor: "#ff8b38" }, ewerton: { texto: "Carteira Ewerton", cor: "#579bfc" } };
  mapa.ocuparPostos(sentados.map((a) => {
    const i = postos.indexOf(a);
    const p = a.planejamento;
    const [situacao, cor] = p ? ESCRITORIO_SITUACAO_PLANO[p.estado] || [p.estado, "#8f98a9"] : ["Sem planejamento", "#8f98a9"];
    const al = a.alertas || {};
    const resumoAvisos = [al.atrasadas_total && `${al.atrasadas_total} muito atrasada${al.atrasadas_total > 1 ? "s" : ""}`, al.aprovar_total && `${al.aprovar_total} para aprovar`,
      al.sem_info_total && `${al.sem_info_total} sem informação`].filter(Boolean).join(" · ");
    return { posto: lugarDe.get(a), nome: a.cliente, situacao, cor, pilula: p ? escritorioPilulaDoPlano(p) : "", figura: escritorioFiguraDoAgente(a, i), mao: escritorioMaoDoAgente(a), falas: escritorioFantasiaDoAgente(a)?.[3] || [], alerta: Boolean((a.meu || escritorio.base?.admin) && p && ESCRITORIO_ACAO_PLANO[p.estado]), acao: p ? ESCRITORIO_ACAO_PLANO[p.estado] || "" : "",
      // A situação aparece escrita também quando está com o cliente, com o placar das peças.
      detalhe: p ? escritorioDetalheDoPlano(p) : "",
      avisos: al.total || 0, resumoAvisos,
      // Quantos de cada tipo, para a etiqueta mostrar junto com o planejamento (Paulo, 20/10/2026).
      // Cor é dado: a do próprio status no catálogo (Paulo, 20/10/2026: "cadê a regra dos status?").
      contagens: { atrasadas: al.atrasadas_total || 0, interna: al.aprovar_interna_total ?? al.aprovar_total ?? 0, cliente: al.aprovar_cliente_total || 0, info: al.sem_info_total || 0,
        corInterna: escritorioCorDoStatus("para_aprovacao"), corCliente: escritorioCorDoStatus("ag_aprovacao_cliente"), corInfo: escritorioCorDoStatus("falta_info") }, aoClicar: () => abrirAgenteOperacaoEscritorio(a, escritorioFiguraDoAgente(a, i)) };
  }), alas);
  if (postos.length > sentados.length) escritorioAviso(`${postos.length - sentados.length} clientes ainda sem mesa no Centro de Operação.`);
}
// Painel do agente: um resumo que leva ao que o painel já tem (Paulo,
// 19/10/2026: "não sair duplicando regra de nada"). Os números são listas
// com as regras do painel (escritorioListasDoAgente), o quadro de
// planejamentos é o da ficha do cliente (documento para revisar e mandar ao
// cliente), o calendário é a Agenda mensal filtrada no cliente e "pede
// atenção" são os avisos do servidor (server/alertas-clientes.js), uma linha
// por peça. Cada peça abre na gaveta de sempre.
function abrirAgenteOperacaoEscritorio(a, figura) {
  escritorio.agenteAberto = { a, figura, lista: "proximas" };
  openWorkflowModal(`<div class="ofc-agente" id="ofc-agente"></div>`);
  document.getElementById("workflow-modal")?.classList.add("ofc-agente-janela");
  pintarAgenteOperacaoEscritorio();
}
// Listas do painel do agente com as regras do painel (Paulo, 20/10/2026:
// números que levam ao trabalho): atraso é o mesmo prazo_atrasado do painel;
// "esperando o cliente" é a próxima ação do radar de risco (riskActionOwner);
// "esta semana" usa a data do quadro dos dias (prazo ou veiculação, como o
// painel estiver). Só a escolha das listas é daqui.
const ESCRITORIO_AGENTE_LISTAS = [
  ["atrasadas", "atrasadas", "ruim"], ["aprovar", "para aprovar", "aviso"], ["semana", "esta semana", ""], ["cliente", "esperando o cliente", ""],
];
// Cor de cada número: a do status que ele representa no catálogo; atrasada é
// o vermelho de prazo vencido do painel (Paulo, 20/10/2026: "cor é a do status").
const ESCRITORIO_AGENTE_COR = { aprovar: "para_aprovacao", cliente: "ag_aprovacao_cliente" };
function escritorioListasDoAgente(nome) {
  const itens = (typeof unifiedOperationalItems === "function" ? unifiedOperationalItems() : []).filter((d) => itemTemCliente(d, nome));
  const fechada = (d) => typeof isFinishedItem === "function" ? isFinishedItem(d) : /final|feito|conclu/i.test(d.status || "");
  const abertas = itens.filter((d) => !fechada(d));
  const hoje = typeof hojeDeVerdade === "function" ? hojeDeVerdade() : escritorioHojeBahia();
  const fim = new Date(hoje + "T12:00:00"); fim.setDate(fim.getDate() + 6);
  const ate = fim.toISOString().slice(0, 10);
  const dataDe = (d) => (typeof dataDoCartaoDia === "function" ? dataDoCartaoDia(d) : "") || d.prazo_iso || d.veiculacao_iso || "";
  const doCliente = (d) => typeof riskActionOwner === "function" && riskActionOwner(d).source === "cliente";
  const porData = (l) => l.sort((x, y) => (dataDe(x) || "9999").localeCompare(dataDe(y) || "9999"));
  return {
    atrasadas: porData(abertas.filter((d) => d.prazo_atrasado || (d.prazo_iso && d.prazo_iso < hoje))),
    aprovar: porData(abertas.filter((d) => /aprova/i.test(d.status || "") && !doCliente(d))),
    semana: porData(abertas.filter((d) => { const x = dataDe(d); return x && x >= hoje && x <= ate; })),
    cliente: porData(abertas.filter(doCliente)),
    proximas: porData(abertas.filter((d) => dataDe(d) >= hoje)),
  };
}
// Uma peça: título, as datas sempre nomeadas (prazo e veiculação) e a pílula
// do status com a cor do quadro; abre no cartão rápido do painel.
function escritorioPecaDoAgenteHtml(d) {
  const dm = (iso) => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
  const datas = [d.prazo_iso && `Prazo ${dm(d.prazo_iso)}`, d.veiculacao_iso && `Veiculação ${dm(d.veiculacao_iso)}`].filter(Boolean).join(" · ") || "Sem data";
  const pilula = d.status && typeof pillHtmlDemanda === "function" ? pillHtmlDemanda(d.status, d.status_color || "", d.status_border || "") : "";
  return `<li><button type="button" class="ofc-agente-peca" onclick="abrirMissaoEscritorio('${safeText(String(d.id))}','${typeof isRequestItem === "function" && isRequestItem(d) ? "demandas" : "producao"}',event);closeWorkflowModal()"><span><b>${safeText(d.nome || "Sem título")}</b><span class="ofc-agente-peca-linha"><small${d.prazo_atrasado ? ' class="vencida"' : ""}>${safeText(datas)}</small>${pilula}</span></span></button></li>`;
}
function escolherListaDoAgenteEscritorio(qual) {
  if (!escritorio.agenteAberto) return;
  escritorio.agenteAberto.lista = escritorio.agenteAberto.lista === qual ? "proximas" : qual;
  pintarAgenteOperacaoEscritorio();
}
function pintarAgenteOperacaoEscritorio() {
  const el = document.getElementById("ofc-agente"), a = escritorio.agenteAberto?.a;
  if (!el || !a) return;
  const al = a.alertas || {};
  const nome = typeof clientMasterResolveName === "function" ? clientMasterResolveName(a.cliente) : a.cliente;
  const atencao = new Map();
  const juntar = (lista, rotulo, tom) => { for (const x of lista || []) { if (!atencao.has(x.ref)) atencao.set(x.ref, { ...x, motivos: [] }); atencao.get(x.ref).motivos.push([x.motivo ? `${rotulo}: ${x.motivo}` : rotulo, tom]); } };
  // A aprovação aparece pela pílula do próprio status (cor do catálogo); só o
  // atraso usa o vermelho de prazo e a falta de informação diz o que falta.
  juntar(al.atrasadas, "muito atrasada", "atrasada"); juntar(al.aprovar, "", ""); juntar(al.sem_info, "sem informação", "neutro");
  const pilula = (st) => (st && typeof corDeStatus === "function" && typeof pillHtmlDemanda === "function" ? (() => { const c = corDeStatus(st); return c ? pillHtmlDemanda(st, c.cor, c.borda) : safeText(st); })() : safeText(st || ""));
  const linhas = [...atencao.values()].map((x) => `<li><button type="button" class="ofc-agente-peca" onclick="abrirMissaoEscritorio('${safeText(x.ref)}','${x.quadro}',event);closeWorkflowModal()"><span><b>${safeText(x.titulo)}</b><span class="ofc-agente-peca-linha"><small>${safeText(x.prazo ? "prazo " + x.prazo.split("-").reverse().slice(0, 2).join("/") : "sem prazo")}</small>${pilula(x.status)}</span>${x.motivos.some(([t]) => t) ? `<span class="ofc-agente-tags">${x.motivos.filter(([t]) => t).map(([t, tom]) => `<em class="ofc-missao-prazo ${tom}">${safeText(t)}</em>`).join("")}</span>` : ""}</span></button></li>`).join("");
  const mais = ["atrasadas", "aprovar", "sem_info"].some((k) => (al[k + "_total"] || 0) > (al[k] || []).length);
  const calendario = typeof modoComVisoesDoQuadro === "function" && modoComVisoesDoQuadro() && typeof alternarPainelDaBarra === "function";
  const listas = escritorioListasDoAgente(nome), qual = escritorio.agenteAberto.lista || "proximas";
  const figura = escritorio.agenteAberto.figura;
  const boneco = figura && typeof mapaAvatarUrl === "function" ? `<img class="ofc-agente-boneco" src="${safeText(mapaAvatarUrl(figura, 3, "std", "", 0))}" alt="" referrerpolicy="no-referrer">` : "";
  const tag = typeof tagClienteHtml === "function" ? tagClienteHtml(nome, { dentroDeBotao: true }) : "";
  const abas = ESCRITORIO_AGENTE_LISTAS.map(([k, rotulo, tom]) => { const cor = k === "atrasadas" ? "#e5484d" : ESCRITORIO_AGENTE_COR[k] ? escritorioCorDoStatus(ESCRITORIO_AGENTE_COR[k]) : "";
    return `<button type="button" class="ofc-agente-num ${listas[k].length && tom ? tom : ""}${listas[k].length ? " tem" : ""}" aria-pressed="${qual === k}" onclick="escolherListaDoAgenteEscritorio('${k}')"${cor ? ` style="--c:${cor}"` : ""}><b>${listas[k].length}</b><span>${rotulo}</span></button>`; }).join("");
  const lista = listas[qual] || [];
  const tituloLista = qual === "proximas" ? "Próximas peças" : ESCRITORIO_AGENTE_LISTAS.find(([k]) => k === qual)?.[1].replace(/^./, (c) => c.toUpperCase());
  el.innerHTML = `<div class="workflow-kicker"><span>Agente de ${safeText(a.cliente)}</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
  <div class="ofc-agente-topo"><div class="ofc-agente-palco"><span class="ofc-lobby-luz"></span><span class="ofc-lobby-ladrilho"></span>${boneco}</div><div class="ofc-agente-nome"><h2 class="workflow-title">${safeText(a.cliente)}</h2><span>${tag}${a.segmento ? `<small>${safeText(a.segmento)}</small>` : ""}</span></div>
   <div class="ofc-agente-portas">${calendario ? `<button type="button" class="workflow-secondary" onclick="abrirCalendarioDoClienteEscritorio(escritorio.agenteAberto.a.cliente)">Calendário do cliente</button>` : ""}${escritorio.base?.admin || a.meu ? `<button type="button" class="workflow-secondary" onclick="abrirAvatarDoClienteEscritorio()" title="Trocar roupa, cabelo e objeto de mão do agente deste cliente">Editar avatar</button>` : ""}<button type="button" class="workflow-primary" onclick="abrirFichaDoClienteEscritorio(escritorio.agenteAberto.a.cliente)">Ficha do cliente</button></div></div>
  <div class="ofc-agente-nums" role="group" aria-label="Trabalho do cliente: clique para ver a lista">${abas}</div>
  <div class="ofc-agente-grade">
   <div class="ofc-agente-col">${typeof planejamentosDoClienteHtml === "function" ? planejamentosDoClienteHtml() : ""}${escritorioMiniAgendaHtml(nome)}</div>
   <div class="ofc-agente-col">
    ${linhas ? `<section class="ofc-agente-bloco" aria-label="Pede atenção"><div class="ofc-agente-bloco-topo"><h4>Pede atenção · ${al.total}</h4></div><ul class="ofc-agente-lista">${linhas}</ul>${mais ? '<small class="ofc-nota">e mais na ficha do cliente</small>' : ""}</section>` : '<p class="ofc-agente-calmo">Nada pedindo atenção neste cliente agora.</p>'}
    <section class="ofc-agente-bloco" aria-label="${safeText(tituloLista)}"><div class="ofc-agente-bloco-topo"><h4>${safeText(tituloLista)} · ${lista.length}</h4>${qual !== "proximas" ? `<button type="button" class="office-text-button" onclick="escolherListaDoAgenteEscritorio('proximas')">Ver próximas</button>` : ""}</div>
     ${lista.length ? `<ul class="ofc-agente-lista">${lista.slice(0, 8).map(escritorioPecaDoAgenteHtml).join("")}</ul>${lista.length > 8 ? `<small class="ofc-nota">e mais ${lista.length - 8} na ficha do cliente</small>` : ""}` : `<p class="ofc-nota">${qual === "proximas" ? "Nenhuma peça com data daqui para frente." : "Nada nesta lista agora."}</p>`}
    </section>
   </div>
  </div>`;
  if (typeof carregarPlanejamentosDoCliente === "function") carregarPlanejamentosDoCliente(a.cliente_id, a.cliente, el);
}
// Resumo da Agenda mensal do cliente (Paulo, 19/10/2026: "uma cópia do
// calendário ali, nem que seja resumida"). Só o desenho é daqui: as peças,
// a data (veiculação ou prazo, como a Agenda estiver), a regra do feed, o mês
// e as cores vêm das funções da própria Agenda (vybe-agenda.js), e o clique
// abre a peça como lá (managerCalendarOpen).
function escritorioMiniAgendaHtml(nome) {
  if (typeof managerCalendarItems !== "function" || typeof managerCalendarMonthMeta !== "function") return "";
  const meta = managerCalendarMonthMeta();
  const itens = managerCalendarItems({ ignorarCliente: true }).filter((it) => itemTemCliente(it, nome));
  const porDia = new Map();
  for (const it of itens) { if (!porDia.has(it.calendarDateIso)) porDia.set(it.calendarDateIso, []); porDia.get(it.calendarDateIso).push(it); }
  const hoje = managerCalendarDateIso(new Date()), dia = escritorio.agenteAberto?.dia;
  const celulas = meta.cells.map((c) => {
    const lista = porDia.get(c.iso) || [];
    return `<button type="button" class="ofc-mini-dia${c.inMonth ? "" : " fora"}${c.iso === hoje ? " hoje" : ""}${lista.length ? " tem" : ""}" aria-pressed="${dia === c.iso}" ${lista.length ? "" : "disabled"} onclick="escritorio.agenteAberto.dia=escritorio.agenteAberto.dia==='${c.iso}'?null:'${c.iso}';pintarAgenteOperacaoEscritorio()" aria-label="${c.date.getDate()}: ${lista.length} ${lista.length === 1 ? "peça" : "peças"}"><span>${c.date.getDate()}</span>${lista.length ? `<em>${lista.slice(0, 3).map((it) => `<i style="--c:${managerCalendarStatusColor(it)}"></i>`).join("")}</em>` : ""}</button>`;
  }).join("");
  const doDia = dia ? porDia.get(dia) || [] : [];
  const noMes = itens.filter((it) => meta.cells.some((c) => c.inMonth && c.iso === it.calendarDateIso)).length;
  return `<section class="ofc-agente-bloco" aria-label="Calendário do cliente"><div class="ofc-agente-bloco-topo"><h4>${safeText(managerCalendarLabel(meta))} · ${noMes} ${noMes === 1 ? "peça" : "peças"} <small>${typeof dateMode !== "undefined" && dateMode === "prazo" ? "por prazo" : "por veiculação"}</small></h4>${typeof alternarPainelDaBarra === "function" ? `<button type="button" class="office-text-button" onclick="abrirCalendarioDoClienteEscritorio(escritorio.agenteAberto.a.cliente)">Abrir na Agenda</button>` : ""}</div>
  <div class="ofc-mini-agenda">${["S", "T", "Q", "Q", "S", "S", "D"].map((d) => `<span class="ofc-mini-sem">${d}</span>`).join("")}${celulas}</div>
  ${dia ? `<ul class="ofc-agente-lista">${doDia.map((it) => `<li><button type="button" class="ofc-agente-peca" onclick="abrirMissaoEscritorio('${safeText(it.id)}','${it.calendarSource === "request" ? "demandas" : "producao"}',event);closeWorkflowModal()"><i class="ofc-ponto" style="--st:${managerCalendarStatusColor(it)}"></i><span><b>${safeText(it.nome || "Sem título")}</b><small>${safeText([it.status, it.calendarType].filter(Boolean).join(" · "))}</small></span></button></li>`).join("")}</ul>` : '<p class="ofc-nota">Cada ponto é uma peça, na cor do status dela. Clique num dia com pontos para ver as peças.</p>'}</section>`;
}
// Agenda da Vybe no Escritório (Paulo, 20/10/2026: "aproveitar a integração
// e ter o ícone da agenda com nosso Google Agenda"). Só leitura: a mesma
// consulta da Produção (/api/painel?area=agenda_producao, server/
// agenda-producao.js), que traz 7 dias a partir do dia pedido e já deixa de
// fora o que é privado, pessoal, folga, férias e aniversário. Gravação e
// captação ficam em destaque; o resto vem como evento da agenda.
const escritorioAgenda = { inicio: null, eventos: null, erro: null, carregando: false, sel: "" };
function escritorioAgendaSegunda(iso) {
  const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function escritorioAgendaSomar(iso, dias) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); }
function abrirAgendaEscritorio(inicio) {
  const hoje = typeof hojeDeVerdade === "function" ? hojeDeVerdade() : escritorioHojeBahia();
  escritorioAgenda.inicio = inicio || escritorioAgendaSegunda(hoje);
  if (!document.getElementById("ofc-agenda")) {
    openWorkflowModal(`<div class="ofc-agenda" id="ofc-agenda"></div>`);
    document.getElementById("workflow-modal")?.classList.add("ofc-agenda-janela");
  }
  carregarAgendaEscritorio();
}
async function carregarAgendaEscritorio() {
  const inicio = escritorioAgenda.inicio;
  Object.assign(escritorioAgenda, { eventos: null, erro: null, carregando: true });
  pintarAgendaEscritorio();
  try {
    const r = await fetch(`/api/painel?area=agenda_producao&dia=${encodeURIComponent(inicio)}`, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(25000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok || !Array.isArray(d.eventos)) throw new Error(d.error || "a agenda não respondeu");
    if (escritorioAgenda.inicio !== inicio) return;
    escritorioAgenda.eventos = d.eventos;
  } catch (e) {
    if (escritorioAgenda.inicio !== inicio) return;
    escritorioAgenda.erro = e.name === "TimeoutError" ? "a agenda demorou para responder" : e.message;
  }
  escritorioAgenda.carregando = false;
  pintarAgendaEscritorio();
}
function pintarAgendaEscritorio() {
  const el = document.getElementById("ofc-agenda");
  if (!el) return;
  const { inicio, eventos, erro, carregando } = escritorioAgenda;
  const hoje = typeof hojeDeVerdade === "function" ? hojeDeVerdade() : escritorioHojeBahia();
  const fim = escritorioAgendaSomar(inicio, 6);
  const dm = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
  let corpo;
  if (carregando) corpo = '<p class="ofc-nota ofc-agenda-estado">Consultando o Google Agenda da Vybe…</p>';
  else if (erro) corpo = `<div class="ofc-agenda-estado"><p class="ofc-nota">Não foi possível ler a agenda: ${safeText(erro)}.</p><button type="button" class="workflow-secondary" onclick="carregarAgendaEscritorio()">Tentar de novo</button></div>`;
  // A mesma semana das Captações (agendaSemanaHtml, vybe-captacoes.js), só
  // para consulta: as mesmas cores e o mesmo tipo de cada evento.
  else corpo = agendaSemanaHtml({ inicio, eventos: eventos || [], sel: escritorioAgenda.sel || "", acoes: { evento: "escritorioAgendaEvento" } })
    + ((eventos || []).length ? "" : '<p class="ofc-nota">Nada na agenda da Vybe nesta semana.</p>');
  el.innerHTML = `<div class="workflow-kicker"><span>Google Agenda da Vybe</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
  <div class="ofc-agenda-topo"><h2 class="workflow-title">Agenda da semana</h2>
   <div class="capt-nav" role="group" aria-label="Semana"><button type="button" class="vb-botao" aria-label="Semana anterior" onclick="abrirAgendaEscritorio('${escritorioAgendaSomar(inicio, -7)}')">‹</button><button type="button" class="vb-botao" onclick="abrirAgendaEscritorio()"${inicio === escritorioAgendaSegunda(hoje) ? " disabled" : ""}>Hoje</button><button type="button" class="vb-botao" aria-label="Próxima semana" onclick="abrirAgendaEscritorio('${escritorioAgendaSomar(inicio, 7)}')">›</button></div></div>
  <p class="capt-periodo">${typeof agPeriodo === "function" ? safeText(agPeriodo(inicio)) : `${dm(inicio)} a ${dm(fim)}`}</p>
  <div class="ag-legenda" aria-label="Cores da agenda">${Object.entries(typeof AG_TIPOS === "object" ? AG_TIPOS : {}).map(([t, n]) => `<span class="ag-legenda-item t-${t}">${n}</span>`).join("")}</div>
  ${corpo}
  <p class="ofc-nota">Só leitura. Para marcar uma captação, use Captações na Produção; para mudar um evento, o Google Agenda. Eventos privados e pessoais não aparecem aqui.</p>`;
  if (typeof agRolar === "function") agRolar(el);
  // O evento escolhido abre no cartão ao lado do bloco (o mesmo das Captações).
  if (escritorioAgenda.sel && typeof agCartaoAbrir === "function") agCartaoAbrir(escritorioAgenda.sel, escritorioAgendaDetalheHtml(), "escritorioAgendaDesmarcar");
}
function escritorioAgendaEvento(id) { escritorioAgenda.sel = escritorioAgenda.sel === id ? "" : id; if (!escritorioAgenda.sel) agCartaoFechar?.(); pintarAgendaEscritorio(); }
function escritorioAgendaDesmarcar() { if (!escritorioAgenda.sel) return; escritorioAgenda.sel = ""; pintarAgendaEscritorio(); }
function escritorioAgendaDetalheHtml() {
  const e = (escritorioAgenda.eventos || []).find((x) => x.id === escritorioAgenda.sel);
  if (!e) return "";
  const dia = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(e.dia + "T12:00:00Z")).replace("-feira", "");
  const quando = `${dia.charAt(0).toUpperCase() + dia.slice(1)} · ${e.inicio ? `${e.inicio}${e.fim ? `–${e.fim}` : ""}` : "Dia inteiro"}`;
  return `<div class="capt-detalhe"><span class="capt-tipo t-${safeText(e.tipo || "outro")}">${safeText((typeof AG_TIPOS === "object" && AG_TIPOS[e.tipo]) || "Compromisso")}</span>
    <h4>${safeText(e.titulo || "Sem título")}</h4><p class="capt-detalhe-quando">${safeText(quando)}${e.local ? `<br>${safeText(e.local)}` : ""}</p>
    <span class="ofc-agenda-detalhe-acoes">${e.link ? `<a class="vb-link" href="${safeText(e.link)}" target="_blank" rel="noopener">Abrir no Google Agenda</a>` : ""}${e.tipo === "captacao" && typeof chooseProductionMode === "function" ? `<button type="button" class="vb-link" onclick="agCartaoFechar();escritorioAbrirCaptacao('${safeText(e.id)}','${safeText(e.dia)}')">Ver em Captações</button>` : ""}</span></div>`;
}
// Da agenda do jogo para a mesma captação no painel geral.
function escritorioAbrirCaptacao(id, dia) {
  closeWorkflowModal();
  if (typeof CAPT === "object" && typeof agSegunda === "function") { CAPT.semana = agSegunda(dia); CAPT.dia = dia; CAPT.sel = id; CAPT.pecas = null; }
  if (typeof setProdV2View === "function") window.productionV2View = "captacoes";
  chooseProductionMode();
}
// Portas para o painel: a ficha do cliente e a Agenda mensal já filtrada nele
// (o mesmo caminho do botão da agenda, managerCalendarOpenClientMaster).
function abrirFichaDoClienteEscritorio(cliente) {
  closeWorkflowModal();
  const nome = typeof clientMasterResolveName === "function" ? clientMasterResolveName(cliente) : cliente;
  if (typeof switchBoard === "function") switchBoard("clientes", document.getElementById("btn-board-clientes"));
  setTimeout(() => { if (typeof abrirClienteDetalhe === "function") abrirClienteDetalhe(nome); }, 120);
}
function abrirCalendarioDoClienteEscritorio(cliente) {
  closeWorkflowModal();
  if (typeof switchBoard === "function") switchBoard("producao", document.getElementById("btn-board-producao"));
  setTimeout(() => {
    if (typeof managerCalendarSetClient !== "function") return;
    if (!agendaMensalAberta) alternarPainelDaBarra("calendario");
    managerCalendarSetClient(typeof clientMasterResolveName === "function" ? clientMasterResolveName(cliente) : cliente);
    document.getElementById("manager-calendar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 150);
}
// Chamado por vybe-planejamentos.js sempre que a lista do head muda.
function escritorioPlanejamentosPendentes(lista) {
  const antes = (escritorio.planosPendentes || []).map((p) => p.id + p.estado).join();
  escritorio.planosPendentes = lista || [];
  if (antes === escritorio.planosPendentes.map((p) => p.id + p.estado).join()) return;
  // Chegou algo novo para a pessoa agir: avisa uma vez, em qualquer sala.
  const vistos = new Set(antes.split(","));
  const novo = escritorio.planosPendentes.find((p) => !vistos.has(p.id + p.estado));
  if (novo && antes) escritorioAviso(`${novo.cliente}: ${ESCRITORIO_ACAO_PLANO[novo.estado] || "planejamento esperando você"}.`);
  atualizarControlesEscritorio();
  if (document.getElementById("office-rooms")) atualizarPessoasEscritorio();
  escritorioOcuparOperacao();
}
// Leva ao Centro de Operação de qualquer tela (aviso do head).
function irParaSalaEscritorio(id) {
  const botao = document.getElementById("btn-board-escritorio");
  if (typeof switchBoard === "function") switchBoard("escritorio", botao);
  const tentar = (vezes) => {
    if (escritorio.mapa) return escritorioIrParaAmbiente(id);
    if (vezes > 0) setTimeout(() => tentar(vezes - 1), 400);
  };
  tentar(25);
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
  // Convidado não entra no Centro de Operação nem em quarto de outra pessoa.
  if (typeof convidadoPodeIr === "function" && !convidadoPodeIr(quarto)) { escritorioAviso("Esta sala é só da equipe da Vybe."); return; }
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
  // Trocou de sala: a música da sala nova (se tiver aparelho de som) toca na
  // hora; a da antiga para. Confere de novo quando os móveis terminam de
  // carregar (só aí se sabe se a sala tem jukebox).
  if (typeof escritorioMusicaDaSala === "function") escritorioMusicaDaSala();
  escritorio.mapa?.prontos.then(() => { posicionarTacaEscritorio(); escritorioMarcarDia(); escritorioAtualizarPortas(); escritorioAcenderReguladores(); atualizarAcaoProximaEscritorio(true); if (typeof gatilhoEntradaEscritorio === "function") gatilhoEntradaEscritorio(); if (typeof escritorioMusicaDaSala === "function") escritorioMusicaDaSala(); if (typeof carregarCobrancasEscritorio === "function") carregarCobrancasEscritorio(); depois?.(); });
}
function escritorioMinhaMesa() {
  let a = escritorioDonos().get(escritorio.base?.eu);
  if(a && escritorio.quarto?.endsWith("-andar-1") && escritorioRaizQuarto(escritorio.quarto)===a.id) a=escritorioAmbienteDoQuarto();
  if(!a) return null;
  return escritorioMesaDoAmbiente(a, escritorio.perfil);
}
// Mesa de um quarto (o da pessoa ou o de outro dono): o computador do quarto
// montado, senão a mesa padrão da sala.
function escritorioMesaDoAmbiente(a, perfil) {
  if(perfil?.quarto_configurado) {
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
function escritorioTrocarStatus(id) {
  if (!escritorio.conectado || !ESCRITORIO_STATUS[id]) return;
  escritorio.status = id;
  escritorioEmitir("presence:status", { status: id });
  atualizarControlesEscritorio();
  atualizarPessoasEscritorio();
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
      const daEquipe = escritorio.base.equipe.find((e) => e.id === p.id);
      const perfilDe = daEquipe?.perfil || p.perfil || {};
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
        titulo: p.convidado ? null : daEquipe?.titulo || null,
        // Campeão da Copa do mês (Paulo, 21/10/2026): etiqueta dourada e anel nos pés.
        campeao: !p.convidado && String(escritorio.base?.copa?.campeao?.id || "") === String(p.id) ? (escritorio.base.copa.titulo || "Campeão da Copa") : "",
        rotulo: `${p.nome}${voce ? " (você)" : ""} · ${p.convidado ? "convidado" : voce && !escritorio.conectado ? "fora do escritório" : nomeStatus}`,
        statusTexto: p.convidado && !voce ? "convidado" : p.status && p.status !== "disponivel" ? nomeStatus : "",
        x: Math.round(pos.x), y: Math.round(pos.y),
        acao: escritorioAcaoDaPose(voce ? escritorio.pose : p.pose, sentado, dirCama !== undefined && !(voce && escritorio.emMovimento)),
        // O café/lanche da pose vale por cima do objeto escolhido no criador.
        mao: ESCRITORIO_MAO[voce ? escritorio.pose : p.pose] || (voce ? escritorio.perfil : perfilDe)?.mao || "",
        dir: sentado ? dirAssento : dirCama !== undefined ? dirCama : ESCRITORIO_APARELHOS[voce ? escritorio.pose : p.pose] ? escritorioNoAparelho(Math.round(pos.x), Math.round(pos.y))?.dir : undefined, local: voce,
        // Convidado (ou quem está vendo como convidado): sem a ficha da equipe.
        aoPassar: p.convidado || escritorio.base?.convidado ? null : (id, on, el) => typeof passarSobreJogadorEscritorio === "function" && passarSobreJogadorEscritorio(id, on, el),
        aoClicar: p.convidado || escritorio.base?.convidado ? () => escritorioAviso(voce ? "Este é você." : p.convidado ? `${p.nome} é convidado de ${escritorioNomeCurto(escritorio.base?.equipe?.find((e) => String(e.id) === String(p.anfitriao))?.nome || "alguém da equipe")}.` : `${p.nome} é da equipe da Vybe.`) : (id) => abrirMenuPessoaEscritorio(id),
      };
    }));
  }
  // As listas laterais só mudam quando alguém troca de lugar, status ou
  // entra/sai; a presença chega a cada passo, então refazê-las sempre
  // (com as imagens dos bonecos) travava o painel com a equipe andando.
  const assinatura = JSON.stringify([escritorio.conectado, escritorio.status, escritorioLugarDe(escritorio.perfil).id, escritorio.recadosResumo || {}, (escritorio.base?.equipe || []).length, escritorio.musica?.tocando ? [escritorio.musica.indice, escritorio.musica.fila?.length] : 0, (escritorio.planosPendentes || []).length, typeof PLJ_ALERTAS !== "undefined" ? PLJ_ALERTAS.length : 0, pessoas.map((p) => [p.id, p.zona, p.status, p.nome])]);
  const mudou = (el) => el && el.dataset.assinatura !== assinatura && (el.dataset.assinatura = assinatura, true);
  // ABA PESSOAS (Paulo, 27/10/2026: "sem hierarquia de nada… o Centro de
  // Operação é a sala principal de tudo, o cérebro da agência"). Uma coluna
  // por ordem de importância:
  //  1. Você: uma linha, com o status num seletor (trocar é raro).
  //  2. Centro de Operação: o destaque, com o que espera por você e o único
  //     botão laranja do painel.
  //  3. Quem está onde: pessoas agrupadas pela sala (antes as salas e a lista
  //     diziam a mesma coisa em dois lugares). A linha abre o cartão do
  //     jogador; Chamar e Recado aparecem por cima ao passar o mouse.
  //  4. Ir para: as outras salas em fichas pequenas e os quartos pelas cabeças.
  const cabecaDe = (p) => {
    const perfil = String(p.id) === String(eu) ? escritorio.perfil : (escritorio.base?.equipe || []).find((q) => String(q.id) === String(p.id))?.perfil || p.perfil || {};
    const url = typeof mapaCabecaUrl === "function" ? mapaCabecaUrl(perfil) : null;
    return url ? `<img class="ofc-p-cabeca" src="${safeText(url)}" alt="" width="32" height="32" loading="lazy">` : `<span class="ofc-p-cabeca inicial">${safeText(escritorioNomeCurto(p.nome || "?").charAt(0))}</span>`;
  };
  const lista = document.getElementById("office-roster");
  if (lista && lista.innerHTML) lista.innerHTML = "";
  const salas = document.getElementById("office-rooms");
  if (mudou(salas)) {
    const meu = escritorioLugarDe(escritorio.perfil).id;
    const A = ESCRITORIO_PLANTA.ambientes;
    const donos = new Map((escritorio.base?.salas || []).map((s) => [s.id, s.pessoa_id]));
    const gente = (a) => pessoas.filter((p) => escritorioLugarDe(p).id === a.id);
    const corDe = (a) => ESCRITORIO_COR_SALA[a.sala] || a.cor || "#8a93a3";
    const plural = (n) => `${n} ${n > 1 ? "pessoas" : "pessoa"}`;
    const primeiro = (nome) => escritorioNomeCurto(nome).split(" ")[0];
    // 1. Você
    const meuStatus = escritorio.conectado ? escritorio.status || "disponivel" : "ausente";
    const corSt = (ESCRITORIO_STATUS[meuStatus] || ESCRITORIO_STATUS.disponivel)[1];
    // Retrato de jogador: anel de XP até o próximo nível e o selo do nível
    // (sem os números, que já estão no HUD da tela).
    const pts = escritorio.base?.economia?.pontos, xpPct = pts?.xpProximo ? Math.max(0, Math.min(100, Math.round((pts.xp / pts.xpProximo) * 100))) : 0;
    const voce = `<div class="ofc-p-eu">
      <span class="ofc-p-retrato" style="--st:${corSt};--xp:${xpPct}%"${pts?.nivel ? ` title="Nível ${pts.nivel} · ${xpPct}% até o próximo"` : ""}><span class="ofc-p-avatar">${cabecaDe({ id: eu, nome: "Você" })}<i aria-hidden="true"></i></span>${pts?.nivel ? `<b class="ofc-p-nivel" aria-label="Nível ${pts.nivel}">${pts.nivel}</b>` : ""}</span>
      <span class="ofc-p-eu-texto"><b>Você</b><small>${escritorio.conectado ? safeText(escritorioLugarDe(escritorio.perfil).nome) : "Fora do escritório"}</small></span>
      <label class="ofc-p-status" style="--st:${corSt}"><span class="sr-only">Sua disponibilidade</span><i aria-hidden="true"></i>
        <select onchange="escritorioTrocarStatus(this.value)"${escritorio.conectado ? "" : " disabled"}>${Object.entries(ESCRITORIO_STATUS).map(([id, [nome]]) => `<option value="${id}"${meuStatus === id ? " selected" : ""}>${safeText(nome)}</option>`).join("")}</select></label></div>`;
    // 2. Centro de Operação
    const principal = A.find((a) => a.id === "operacao");
    const centro = principal ? (() => {
      const aqui = gente(principal), estou = meu === "operacao";
      const revisar = escritorio.planosPendentes?.length || 0;
      const avisos = (typeof PLJ_ALERTAS !== "undefined" ? PLJ_ALERTAS : []).reduce((t, x) => t + (x.total || 0), 0);
      const numero = (n, rotulo, classe, dica) => `<span class="ofc-p-num${n ? ` ${classe}` : " zero"}" title="${safeText(dica)}"><b>${n}</b><small>${rotulo}</small></span>`;
      return `<section class="ofc-p-centro${estou ? " aqui" : ""}" aria-label="Centro de Operação, sala principal">
        <div class="ofc-p-centro-topo"><span class="ofc-p-centro-arte" aria-hidden="true">${escritorioEmblemaSala("operacao")}${revisar || avisos ? '<i class="ofc-p-missao">!</i>' : ""}</span>
          <span><small>Sala principal</small><b>Centro de Operação</b></span></div>
        <div class="ofc-p-nums">${numero(revisar, "revisar", "laranja", "Planejamentos esperando a sua revisão")}${numero(avisos, "avisos", "vermelho", "Avisos nos seus clientes")}
          <span class="ofc-p-num${aqui.length ? "" : " zero"}" title="${aqui.length ? safeText(aqui.map((p) => p.nome).join(", ")) : "Ninguém na sala agora"}">${aqui.length ? `<span class="ofc-p-cabecas">${aqui.slice(0, 3).map(cabecaDe).join("")}</span>` : "<b>0</b>"}<small>${aqui.length > 3 ? `+${aqui.length - 3} ` : ""}na sala</small></span></div>
        <button type="button" class="ofc-p-entrar" onclick="escritorioIrParaAmbiente('operacao')"${estou ? " disabled" : ""}>${estou ? "Você está aqui" : "Ir para o Centro de Operação <span aria-hidden=\"true\">→</span>"}</button></section>`;
    })() : "";
    // 3. Quem está onde
    const recados = escritorio.recadosResumo || {};
    const linha = (p, o) => {
      const st = o ? ESCRITORIO_STATUS[o.status] || ESCRITORIO_STATUS.disponivel : null, sou = String(p.id) === String(eu);
      const sid = safeText(String(p.id)), nome = primeiro(p.nome), novos = recados[p.id];
      const acoes = sou ? "" : `<span class="ofc-p-acoes">${o ? `<button type="button" onclick="chamarParaSalaEscritorio('${sid}')" title="Chamar ${safeText(nome)} para a sua sala" aria-label="Chamar ${safeText(nome)} para a sua sala">${escritorioIcone("mao")}</button>` : ""}<button type="button" onclick="abrirRecadosEscritorio('${sid}')" title="Recado para ${safeText(nome)}" aria-label="Recado para ${safeText(nome)}">${escritorioIcone("conversa")}</button></span>`;
      return `<li class="ofc-p-pessoa${o ? "" : " fora"}${sou ? " eu" : ""}" style="--st:${st ? st[1] : "#5d6372"};--st-texto:${st ? st[1] : "#5d6372"}">
        <button type="button" class="ofc-p-pessoa-abrir" onclick="abrirMenuPessoaEscritorio('${sid}')" aria-label="${safeText(p.nome)}${sou ? " (você)" : ""}, ${o ? safeText(st[0]) : "fora do escritório"}">
          <span class="ofc-p-avatar" style="--st:${st ? st[1] : "#5d6372"}">${cabecaDe(p)}<i aria-hidden="true"></i></span>
          <span class="ofc-p-pessoa-texto"><b>${safeText(escritorioNomeCurto(p.nome))}${sou ? " <em>você</em>" : ""}</b><small>${o ? safeText(st[0]) : "Fora do escritório"}</small></span>
          ${novos ? `<b class="ofc-p-badge" title="${novos} ${novos > 1 ? "recados novos" : "recado novo"}">${novos}</b>` : ""}</button>${acoes}</li>`;
    };
    const equipe = escritorio.base?.equipe || [];
    const online = equipe.map((p) => [p, pessoas.find((o) => o.id === p.id)]).filter(([, o]) => o);
    const fora = equipe.filter((p) => !pessoas.some((o) => o.id === p.id));
    const grupos = new Map();
    for (const [p, o] of online) { const l = escritorioLugarDe(o); if (!grupos.has(l.id)) grupos.set(l.id, { l, itens: [] }); grupos.get(l.id).itens.push([p, o]); }
    const ordem = [...grupos.values()].sort((x, y) => (y.l.id === "operacao") - (x.l.id === "operacao") || (y.l.id === meu) - (x.l.id === meu) || y.itens.length - x.itens.length);
    const grupo = ({ l, itens }) => `<li class="ofc-p-grupo"><div class="ofc-p-grupo-topo" style="--sala:${corDe(l)}"><span class="ofc-p-sala-arte" aria-hidden="true">${escritorioEmblemaSala(l.id)}</span><span>${safeText(l.nome)}</span><small>${itens.length}</small>${l.id === meu ? '<em>você está aqui</em>' : `<button type="button" onclick="escritorioIrParaAmbiente('${safeText(l.id)}')" aria-label="Ir para ${safeText(l.nome)}">Ir</button>`}</div>
      <ul>${itens.map(([p, o]) => linha(p, o)).join("")}</ul></li>`;
    const onde = `<section class="ofc-p-bloco" aria-label="Quem está onde">
      <div class="ofc-p-titulo"><h5>Quem está onde</h5><small class="vb-jogo-dica" data-dica="Online indica presença, não produtividade." tabindex="0">${online.length} online</small></div>
      ${escritorio.conectado ? `<ul class="ofc-p-grupos">${ordem.map(grupo).join("") || '<li class="ofc-p-vazio">Ninguém além de você por aqui.</li>'}</ul>` : '<p class="ofc-p-vazio">Entre no escritório para ver quem está onde.</p>'}
      ${fora.length ? `<details class="ofc-p-fora" ${escritorio.foraAberto ? "open" : ""} ontoggle="escritorio.foraAberto=this.open"><summary>Fora do escritório <small>${fora.length}</small></summary><ul>${fora.map((p) => linha(p, null)).join("")}</ul></details>` : ""}</section>`;
    // 4. Ir para
    const comuns = [ESCRITORIO_PRACA, ...A.filter((a) => !a.pessoal && a.id !== "operacao")];
    const ficha = (a) => {
      const n = gente(a).length;
      return `<button type="button" class="ofc-p-sala${a.id === meu ? " aqui" : ""}" style="--sala:${corDe(a)}" onclick="escritorioIrParaAmbiente('${a.id}')" aria-label="${safeText(a.nome)}${n ? `, ${plural(n)}` : ""}${a.id === meu ? ", você está aqui" : ""}"><span class="ofc-p-sala-arte" aria-hidden="true">${escritorioEmblemaSala(a.id)}</span><span class="ofc-p-sala-nome">${safeText(a.nome)}</span>${n ? `<small title="${plural(n)}">${n}</small>` : ""}${a.id === meu ? '<em class="ofc-p-pino">você</em>' : ""}</button>`;
    };
    const quarto = (a) => {
      const dono = equipe.find((p) => String(p.id) === String(donos.get(a.id)));
      if (!dono) return "";
      const o = pessoas.find((p) => String(p.id) === String(dono.id)), st = o ? ESCRITORIO_STATUS[o.status] || ESCRITORIO_STATUS.disponivel : null;
      return `<button type="button" class="ofc-p-quarto${a.id === meu ? " aqui" : ""}${o ? "" : " fora"}" aria-haspopup="menu" onclick="abrirMenuQuartoEscritorio('${a.id}',this)" title="${safeText(a.nome)}" aria-label="${safeText(a.nome)}${o ? `, ${safeText(primeiro(dono.nome))} online` : ""}"><span class="ofc-p-avatar" style="--st:${st ? st[1] : "transparent"}">${cabecaDe(dono)}<i aria-hidden="true"></i></span><small>${safeText(primeiro(dono.nome))}</small></button>`;
    };
    const quartos = A.filter((a) => a.pessoal).map(quarto).join("");
    const ir = `<section class="ofc-p-bloco" aria-label="Ir para">
      <div class="ofc-p-titulo"><h5>Ir para</h5></div>
      <div class="ofc-p-salas">${comuns.map(ficha).join("")}</div>
      ${quartos ? `<div class="ofc-p-titulo sub"><h5>Quartos</h5></div><div class="ofc-p-quartos">${quartos}</div>` : ""}</section>`;
    salas.innerHTML = `${voce}${centro}${onde}${ir}<div id="office-quarto-menu" class="ofc-menu-pessoa ofc-menu-quarto" role="menu" hidden></div>`;
    queueMicrotask(() => pintarArtesEscritorio(salas));
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
  if (!escritorio.conectado) return '<p class="ofc-abrir-nota">Entre no escritório para ver quem está onde.</p>';
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
    return `<li><button type="button" class="ofc-abrir-lugar" style="--sala:${g.cor}" ${ir ? `onclick="escritorioIrParaAmbiente('${g.id}')" title="Ir para ${safeText(g.nome)}"` : "disabled"}><i></i><b>${safeText(g.nome)}</b><span>${safeText(nomes)}</span></button></li>`;
  });
  const fora = (escritorio.base?.equipe || []).filter((p) => !pessoas.some((o) => o.id === p.id)).length;
  return `<ul>${linhas.join("")}</ul>${fora ? `<p class="ofc-abrir-nota">Fora do escritório · ${fora}</p>` : ""}`;
}
// Modo lista (o do celular): os mesmos lugares do mapa, com quem está em cada
// um. Ir para um lugar anda até lá sem sair da lista, e a conversa da sala
// entra sozinha como no mapa. Lugares vazios ficam numa linha compacta.
function escritorioListaSalasHtml() {
  const pessoas = escritorio.conectado ? escritorio.online : [];
  const meu = escritorioLugarDe(escritorio.perfil).id;
  const m = escritorio.musica, tocando = m?.tocando && m.fila?.[m.indice];
  const musica = tocando ? `<article class="ofc-cartao ofc-cartao-musica" style="--sala:#b48cff"><div class="ofc-cartao-topo"><i></i><h3>Música · ${safeText(escritorioNomeDaSalaMusica())}</h3><small>${m.fila.length} na fila</small></div><p class="ofc-nota">De ${safeText(String(tocando.por || "").split(" ")[0])}. Quem está nesta sala ouve junto.</p><button type="button" class="ofc-mini" onclick="abrirMusicaEscritorio()">Fila e link</button></article>` : "";
  const cartao = (a) => {
    const aqui = pessoas.filter((p) => escritorioLugarDe(p).id === a.id);
    return `<article class="ofc-cartao" style="--sala:${a.cor || ESCRITORIO_COR_SALA[a.sala]}"><div class="ofc-cartao-topo"><i></i><h3>${safeText(a.nome)}</h3><small>${aqui.length} ${aqui.length === 1 ? "pessoa" : "pessoas"}</small></div><ul>${aqui.map((p) => `<li>${escritorioAvatar(p.perfil, p.nome)}<span><b>${safeText(p.nome)}</b><small>${escritorioStatusHtml(p.status)}</small></span></li>`).join("")}</ul><button type="button" class="ofc-mini" onclick="escritorioIrParaAmbiente('${a.id}',true)" ${a.id === meu ? "disabled" : ""}>${a.id === meu ? "Você está aqui" : "Ir para cá"}</button></article>`;
  };
  // Mesma ordem da lateral: Praça e espaços comuns primeiro, depois os quartos.
  const A = [ESCRITORIO_PRACA, ...ESCRITORIO_PLANTA.ambientes.filter((a) => !a.pessoal), ...ESCRITORIO_PLANTA.ambientes.filter((a) => a.pessoal)];
  const comGente = A.filter((a) => a.id === meu || pessoas.some((p) => escritorioLugarDe(p).id === a.id));
  const vazios = A.filter((a) => !comGente.includes(a));
  return `${musica}${comGente.map(cartao).join("")}<section class="ofc-vazios"><h4>Outros lugares</h4><div>${vazios.map((a) => `<button type="button" class="ofc-mini" style="--sala:${a.cor || ESCRITORIO_COR_SALA[a.sala]}" onclick="escritorioIrParaAmbiente('${a.id}',true)">${safeText(a.nome)}</button>`).join("")}</div></section>`;
}
// Botões do dock dentro do escritório: o que muda com conexão e chamada.
// Cartão rápido ao passar o mouse no Perfil (Paulo, 21/10/2026): nível e XP
// com a barra, moedas, entregas de hoje, atrasadas, meta da semana e
// sequência, os números que a ficha já mostra, sem abrir a ficha.
function escritorioCartaoEuHtml() {
  const eco = escritorio.base?.economia, p = eco?.pontos || {};
  const n = typeof escritorioNumerosDe === "function" && escritorio.base?.eu ? escritorioNumerosDe(escritorio.base.eu) : null;
  const pctXp = p.xpProximo ? Math.min(100, Math.round(((p.xp || 0) / p.xpProximo) * 100)) : 0;
  const pctDia = n?.dia?.total ? Math.round((n.dia.feitas / n.dia.total) * 100) : null;
  const meta = p.meta?.meta ? Math.min(100, Math.round(((p.meta.entregas || 0) / p.meta.meta) * 100)) : null;
  const linha = (rotulo, valor, extra = "", classe = "") => `<li class="${classe}"><span>${rotulo}</span><b>${valor}</b>${extra}</li>`;
  const barra = (pct) => `<i class="ofc-eu-barra" role="presentation"><i style="width:${pct}%"></i></i>`;
  return `<div class="ofc-eu-cartao" id="ofc-eu-cartao" role="tooltip">
<div class="ofc-eu-cartao-topo"><b>${safeText(escritorio.base?.eu?.nome?.split(" ")[0] || "Você")}</b>${p.nivel ? `<span>Nível ${Number(p.nivel)}</span>` : ""}</div>
${p.xpProximo ? `<div class="ofc-eu-xp"><span>${Number(p.xp || 0).toLocaleString("pt-BR")} de ${Number(p.xpProximo).toLocaleString("pt-BR")} XP</span><em>${pctXp}%</em>${barra(pctXp)}</div>` : ""}
<ul>${eco?.disponivel ? linha("Moedas", Number(eco.saldo || 0).toLocaleString("pt-BR"), "", "moeda") : ""}${n ? linha("Hoje", n.dia.total ? `${n.dia.feitas} de ${n.dia.total}` : "nada vence hoje", pctDia === null ? "" : `<em>${pctDia}%</em>`) : ""}${n?.atrasadas ? linha("Atrasadas", n.atrasadas, "", "alerta") : ""}${meta !== null ? linha("Meta da semana", `${p.meta.entregas || 0} de ${p.meta.meta}`, `<em>${meta}%</em>`) : ""}${n?.seq ? linha("Sequência", `${n.seq} ${n.seq === 1 ? "dia" : "dias"}`) : ""}</ul>
<small>Clique para abrir o perfil</small></div>`;
}
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
  // Perfil com cara de botão de jogo (Paulo, 20/10/2026): cabeça do boneco num
  // círculo, o selo do nível e o rótulo "Perfil".
  const nivelEu = escritorio.base?.economia?.pontos?.nivel, cabecaEu = escritorioCabecaUrl(escritorio.base?.eu);
  // Planejamento esperando a pessoa: um balão acima da barra, para a barra
  // continuar numa linha só (Paulo, 20/10/2026: "o dock ficou mal diagramado").
  const planos = escritorio.planosPendentes || [];
  const avisoPlano = planos.length ? `<button type="button" class="ofc-dock-plano" onclick="abrirPendentesPlanejamento()" title="Planejamentos esperando você"><i aria-hidden="true"></i><svg class="ofc-ico" viewBox="0 0 24 24" aria-hidden="true">${ESCRITORIO_EMBLEMAS.operacao}</svg>${planos.length === 1 ? `<b>${safeText(planos[0].cliente)}</b><span>${safeText(ESCRITORIO_ACAO_PLANO[planos[0].estado] || "Planejamento esperando você")}</span>` : `<b>${planos.length} planejamentos</b><span>esperando você</span>`}</button>` : "";
  el.innerHTML = `${avisoPlano}<span class="ofc-eu-wrap"><button type="button" class="ofc-dock-btn ofc-eu ofc-eu-perfil" onclick="abrirFichaEscritorio(escritorio.base.eu)" aria-label="Abrir o seu perfil${nivelEu ? `, nível ${nivelEu}` : ""}" aria-describedby="ofc-eu-cartao"><span class="ofc-eu-rosto">${cabecaEu ? `<img src="${safeText(cabecaEu)}" alt="" width="34" height="34">` : escritorioAvatar(escritorio.perfil, "você")}${nivelEu ? `<em class="ofc-eu-nivel">${nivelEu}</em>` : ""}</span><span class="ofc-eu-rotulo">Perfil</span></button>${escritorioCartaoEuHtml()}</span><span class="ofc-sep"></span><label class="ofc-status">${escritorioStatusHtml(escritorio.conectado ? escritorio.status : "ausente")}<select aria-label="Sua disponibilidade" ${escritorio.conectado ? "" : "disabled"} onchange="escritorio.status=this.value;escritorioEmitir('presence:status',{status:this.value});atualizarControlesEscritorio()">${Object.entries(ESCRITORIO_STATUS).map(([id, [nome]]) => `<option value="${id}" ${escritorio.status === id ? "selected" : ""}>${nome}</option>`).join("")}</select></label><span class="ofc-sep"></span>${conversa}${escritorio.conectado ? `<details class="ofc-reacoes" id="office-reacoes"><summary class="ofc-dock-btn" aria-label="Reagir" title="Reagir">${escritorioIcone("reagir")}</summary><div>${Object.entries(ESCRITORIO_REACOES).map(([t, e]) => `<button type="button" onclick="reagirEscritorio('${t}')" aria-label="Reagir com ${t}">${e}</button>`).join("")}</div></details>` : ""}${(() => {
    // "Mais": o que se usa de vez em quando fica num menu só, para a barra
    // caber numa linha.
    // Ações do boneco num botão próprio (Paulo, 21/10/2026: "ações devia ser
    // um botão no dock e o interno disso tá muito ruim"): grade de jogo com o
    // próprio boneco fazendo cada gesto e o atalho do teclado. O "Mais" fica
    // só com o que se usa de vez em quando, em linhas com ícone.
    const fig = mapaFigura(escritorio.perfil || {}), boneco = (acao, mao = "", gesto = "sml", cabeca = false) => `<img src="${safeText(mapaAvatarUrl(fig, 2, acao, mao, 0, gesto) + (cabeca ? "&headonly=1" : ""))}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
    const peca = (acao, arte, rotulo, tecla = "", ativo = false) => `<button type="button" class="ofc-acao-peca${ativo ? " ativo" : ""}" onclick="${acao};this.closest('details').open=false" aria-pressed="${ativo}"><span class="ofc-acao-arte">${arte}</span><b>${rotulo}</b>${tecla ? `<kbd>${tecla}</kbd>` : ""}</button>`;
    const placa = (txt) => `<span class="ofc-acao-placa">${txt}</span>`;
    const coracao = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="#ff5a6e"/></svg>';
    const acoes = escritorio.conectado ? `<details class="ofc-reacoes ofc-acoes" id="office-acoes"><summary class="ofc-dock-btn" aria-label="Ações do boneco" title="Ações do boneco">${escritorioIcone("mao")}</summary><div class="ofc-acoes-grade">
      <span class="vb-jogo-rotulo">Seu boneco</span>
      ${peca("definirPoseEscritorio(escritorio.pose==='acenar'?'':'acenar')", boneco("wav"), "Acenar", "1", escritorio.pose === "acenar")}${peca("deitarEscritorio()", boneco("lay"), "Deitar", "2")}${peca("definirPoseEscritorio(escritorio.pose==='cafe'?'':'cafe')", boneco("std", "crr=6"), "Café", "3", escritorio.pose === "cafe")}${peca("sentarNoChaoEscritorio()", boneco("sit"), escritorio.noChao ? "Levantar" : "Sentar", "4", Boolean(escritorio.noChao))}
      <span class="vb-jogo-rotulo">Rosto</span>
      ${peca("expressaoEscritorio('triste')", boneco("std", "", "sad", true), "Triste", "5")}${peca("expressaoEscritorio('surpreso')", boneco("std", "", "srp", true), "Surpreso", "6")}${peca("expressaoEscritorio('bravo')", boneco("std", "", "agr", true), "Bravo", "7")}
      <span class="vb-jogo-rotulo">Placa</span>
      ${peca("placaEscritorio('coracao')", placa(coracao), "Coração", "8")}${peca("placaEscritorio('exclamacao')", placa("!"), "Atenção", "9")}${peca("placaEscritorio('sorriso')", placa(":)"), "Sorriso")}${["um", "dois", "tres"].map((n, i) => peca(`placaEscritorio('${n}')`, placa(String(i + 1)), "Número " + (i + 1))).join("")}
    </div></details>` : "";
    const linha = (acao, icone, rotulo, extra = "") => `<button type="button" class="ofc-mais-linha" onclick="${acao};this.closest('details').open=false" ${extra}>${escritorioIcone(icone)}<span>${rotulo}</span></button>`;
    const trancaLinha = escritorioPodeTrancar() ? linha("trancarZonaEscritorio()", "cadeado", escritorio.trancas?.has(escritorio.zona) ? "Destrancar a sala" : "Trancar a sala", `aria-pressed="${Boolean(escritorio.trancas?.has(escritorio.zona))}"`) : "";
    return `${acoes}<details class="ofc-reacoes ofc-mais" id="office-mais"><summary class="ofc-dock-btn" aria-label="Mais opções" title="Mais opções">${escritorioIcone("mais")}</summary><div class="ofc-mais-lista">${escritorio.conectado && escritorio.quarto ? `<span class="vb-jogo-rotulo">Sala</span>${linha("abrirNovoPostitEscritorio()", "editar", "Colar post-it na parede")}` : ""}<span class="vb-jogo-rotulo">Escritório</span>${linha("irParaMinhaMesaEscritorio()", "mesa", "Ir para minha mesa", escritorioMinhaMesa() ? "" : "disabled")}${linha("abrirDiaEquipeEscritorio()", "lista", "Dia da equipe")}${linha("encaixarCaixasEscritorio()", "grade", "Voltar as caixas para a coluna")}${trancaLinha}${escritorio.podeAvisar ? linha("abrirMandarAvisoEscritorio()", "conversa", "Mandar recado para todos") : ""}${linha("alternarSomEscritorio()", "som", escritorioSomLigado() ? "Desligar sons do escritório" : "Ligar sons do escritório")}${linha("abrirAjustesAudioEscritorio()", "ajustes", "Ajustes de áudio")}</div></details>`;
  })()}<span class="ofc-sep"></span>${escritorioMinhaMesa() ? botao("irParaMinhaMesaEscritorio()", "mesa", "Minha sala", 'title="Ir para a minha sala e sentar na minha mesa"', { texto: true, classe: "destaque" }) : ""}${botao("escolherPainelDoEscritorio()", "painel", escritorio.avisosNovos ? `Painel · ${escritorio.avisosNovos} ${escritorio.avisosNovos === 1 ? "novo" : "novos"}` : "Painel", `id="ofc-btn-painel"${escritorio.avisosNovos ? ' data-avisos="true"' : ""}${escritorio.avisos ? ` title="${escritorio.avisos} ${escritorio.avisos === 1 ? "aviso não lido" : "avisos não lidos"} no Painel"` : ' title="Voltar ao painel de trabalho (demandas, agenda, clientes)"'}`, { texto: true, classe: "destaque principal" })}${escritorioPainelOnde() ? `<button type="button" class="ofc-abrir-trocar" onclick="esquecerPainelOndeEscritorio()" title="O Painel abre ${escritorioPainelOnde() === "nova" ? "em outra aba" : "nesta aba"}. Clique para escolher de novo.">${escritorioPainelOnde() === "nova" ? "em outra aba" : "nesta aba"}</button>` : ""}<span class="ofc-sep"></span>${escritorio.conectado ? botao("desconectarEscritorio()", "sair", "Sair do escritório", "", { classe: "perigo" }) : botao("conectarEscritorio()", "entrar", escritorio.conectando ? "Entrando…" : "Entrar", escritorio.conectando ? "disabled" : "", { texto: true })}`;
}
function renderEscritorio() {
  const painel = document.getElementById("painel-escritorio");
  if (!painel || !escritorio.base) return;
  const b = escritorio.base,
    perfil = escritorio.perfil,
    sala = escritorio.sala;
  const eu = b.equipe.find((p) => p.id === b.eu);
  const celular = window.matchMedia?.("(max-width: 760px)").matches;
  // O celular também abre no mapa (Padrão Vybe, 21/10/2026): com a barra de
  // baixo enxuta o mapa cabe; a lista de salas continua em "Mais".
  const modo = escritorio.modo || "mapa";
  // Catálogo e Inventário viraram a janela própria: as abas antigas da lateral voltam para Pessoas.
  if (escritorio.aba === "loja" || escritorio.aba === "inventario") escritorio.aba = "pessoas";
  // Construindo, a lateral é só a Oficina (as abas de conversa voltam ao sair).
  const aba = escritorio.edicao ? "catalogo" : escritorio.aba || "pessoas";
  // No celular o painel lateral cobre o mapa: começa recolhido.
  const lateral = escritorio.lateral ?? !celular;
  // No celular a barra de baixo mostra só os principais (data-principal) e o
  // "Mais" abre uma gaveta com todos (Padrão Vybe, 21/10/2026: 14 ícones não
  // cabiam na tela). Escolher um item fecha a gaveta.
  const rail = (id, icone, rotulo, acao, ativo, principal = false) =>
    `<button type="button" class="ofc-rail-btn"${principal ? " data-principal" : ""} onclick="escritorio.railMais=false;${acao}" aria-pressed="${Boolean(ativo)}" aria-label="${rotulo}" title="${rotulo}">${escritorioIcone(icone)}<span>${rotulo}</span></button>`;
  // A entrada também aparece enquanto conecta (inclusive vindo da abertura),
  // com as etapas e o erro no próprio cartão.
  const lobby = (!escritorio.conectado && (!escritorio.lobbyFechado || escritorio.entrada)) || escritorio.carregandoMapa;
  painel.innerHTML = `<section class="ofc" data-modo="${modo}" data-lateral="${lateral}" data-editando="${Boolean(escritorio.edicao)}"${escritorio.edicao?.pessoas ? " data-com-pessoas" : ""}${escritorio.colunaAberta ? " data-coluna-aberta" : ""}${escritorio.railMais ? " data-rail-mais" : ""}>
<nav class="ofc-rail" aria-label="Escritório">
 <img class="ofc-logo" src="${safeText(document.querySelector(".logo img")?.getAttribute("src") || "/assets/vybe-branca.png")}" alt="Vybe">
 ${rail("mapa", "mapa", "Mapa", "alternarModoEscritorio('mapa')", modo === "mapa", true)}
 ${rail("lista", "lista", "Salas", "alternarModoEscritorio('lista')", modo === "lista")}
 ${rail("pessoas", "pessoas", "Pessoas", "alternarAbaEscritorio('pessoas')", lateral && aba === "pessoas", true)}
 ${rail("conversa", "conversa", "Conversa", "alternarAbaEscritorio('conversa')", lateral && aba === "conversa", true)}
 ${rail("clientes", "clientes", "Clientes", "alternarAbaEscritorio('clientes')", lateral && aba === "clientes")}
 ${rail("agenda", "agenda", "Agenda", "abrirAgendaEscritorio()", false)}
 ${rail("ranking", "ranking", "Ranking", "abrirRankingEscritorio()", false)}
 ${rail("conquistas", "estrela", "Conquistas", "abrirConquistasEscritorio()", false)}
 ${rail("inventario", "inventario", "Inventário", "abrirCatalogoEscritorio('inventario')", false)}
 ${rail("loja", "loja", "Catálogo", "abrirCatalogoEscritorio()", false)}
 <span class="ofc-rail-fim"></span>
 ${escritorioCamadaParaEditar() ? rail("editar", "editar", escritorio.base.admin ? "Editar" : "Minha sala", escritorio.edicao ? "sairEditorEscritorio()" : "abrirEditorEscritorio()", Boolean(escritorio.edicao)) : ""}
 ${rail("espaco", "espaco", "Meu espaço", "personalizarEscritorio()", false)}
 ${rail("painel", "painel", "Painel", "escolherPainelDoEscritorio()", false)}
 ${rail("ajuda", "ajuda", "Tutorial", "iniciarTutorialEscritorio()", false)}
 <button type="button" class="ofc-rail-btn ofc-rail-so-celular ofc-rail-missoes" data-principal onclick="escritorio.railMais=false;escritorio.colunaAberta=!escritorio.colunaAberta;renderEscritorio()" aria-pressed="${Boolean(escritorio.colunaAberta)}" aria-label="Missões e cobranças">${escritorioIcone("alvo")}<span>Missões</span></button>
 <button type="button" class="ofc-rail-btn ofc-rail-so-celular" data-principal onclick="escritorio.railMais=!escritorio.railMais;renderEscritorio()" aria-expanded="${Boolean(escritorio.railMais)}" aria-label="Mais opções do escritório">${escritorioIcone("mais")}<span>Mais</span></button>
</nav>${escritorio.railMais ? '<button type="button" class="ofc-rail-fundo" aria-label="Fechar o menu" onclick="escritorio.railMais=false;renderEscritorio()"></button>' : ""}
<aside class="ofc-lateral" aria-label="${escritorio.edicao && aba === "catalogo" ? "Construção" : aba === "conversa" ? "Conversa da sala" : "Pessoas e salas"}">
 <div class="ofc-lateral-topo">${escritorio.edicao && typeof escritorioTopoConstrucaoHtml === "function" ? escritorioTopoConstrucaoHtml() : `<div><b>${escritorio.edicao && aba === "catalogo" ? "Oficina" : "Vybe"}</b><small id="office-online">${escritorio.conectado ? escritorio.online.length + " online" : "Você está fora"}</small></div>`}<button type="button" class="ofc-x" onclick="escritorio.lateral=false;renderEscritorio()" aria-label="Recolher painel lateral">×</button></div>
 <div class="ofc-abas" role="tablist"${escritorio.edicao ? " hidden" : ""}${escritorio.edicao ? ' style="grid-template-columns:repeat(4,1fr)"' : ' style="grid-template-columns:repeat(3,1fr)"'}>${escritorio.edicao ? `<button role="tab" aria-selected="${aba === "catalogo"}" onclick="alternarAbaEscritorio('catalogo',true)">Edição</button>` : ""}<button role="tab" aria-selected="${aba === "pessoas"}" onclick="alternarAbaEscritorio('pessoas',true)">Pessoas</button><button role="tab" aria-selected="${aba === "conversa"}" onclick="alternarAbaEscritorio('conversa',true)">Conversa</button><button role="tab" aria-selected="${aba === "recados"}" onclick="alternarAbaEscritorio('recados',true)">Recados${escritorioRecadosNaoLidos() ? ` <span class="ofc-badge">${escritorioRecadosNaoLidos()}</span>` : ""}</button></div>
 ${escritorio.edicao ? `<div class="ofc-aba ofc-catalogo ofc-oficina" ${aba === "catalogo" ? "" : "hidden"}>${escritorioCatalogoHtml()}</div><div class="ofc-oficina-info" id="office-oficina-info" role="status" hidden></div>` : ""}
 <div class="ofc-aba" ${aba === "pessoas" ? "" : "hidden"}><div id="office-rooms" class="ofc-salas"></div><div id="office-roster"></div></div>
 <section class="office-chat ofc-aba" ${aba === "conversa" ? "" : "hidden"}><div class="office-chat-head"><div><h3 id="office-chat-titulo">${safeText(escritorioTituloChat(sala))}</h3><small id="office-chat-nota" class="ofc-nota">${safeText(escritorioNotaChat(sala))}</small></div><button class="office-text-button" onclick="carregarChatEscritorio()">Atualizar</button></div><div id="office-chat-list" role="log" aria-live="polite">Carregando mensagens…</div><form onsubmit="event.preventDefault();enviarChatEscritorio(this)"><input aria-label="Mensagem para este chat" id="office-message" name="texto" oninput="delete this.form.dataset.chave;escritorioDigitando(Boolean(this.value))" onblur="escritorioDigitando(false)" maxlength="2000" placeholder="Escreva para a sala" required autocomplete="off"><button class="workflow-primary">Enviar</button></form></section>
 <section class="office-chat ofc-aba ofc-recados" id="office-recados" ${aba === "recados" ? "" : "hidden"}>${escritorioRecadosHtml()}</section>
 <section class="ofc-aba ofc-clientes" id="office-clientes" ${aba === "clientes" ? "" : "hidden"}>${escritorioClientesHtml()}</section>
</aside>
<main class="ofc-principal">
 <div class="ofc-topo"><div class="ofc-topo-esq">${`<button type="button" class="ofc-voltar-mapa" onclick="escritorioSairDoQuarto()" title="Sair pela porta: ${safeText(escritorioDestinoDaPorta(escritorio.quarto).nome)}">${escritorioIcone("voltar")}<span>${safeText(escritorioDestinoDaPorta(escritorio.quarto).nome)}</span></button>`}${escritorioAndaresHtml()}<div class="ofc-sala-atual" style="--sala:${escritorioAmbienteDoQuarto()?.cor || ESCRITORIO_COR_SALA[sala]}"><span class="ofc-sala-emblema" aria-hidden="true">${escritorioEmblemaSala(/^sala-/.test(escritorio.quarto || "") ? "quarto" : escritorio.quarto || "praca")}</span><span class="ofc-sala-nome"><h2 id="office-lugar">${safeText(escritorioLugarDe(escritorio.perfil).nome)}</h2><span id="office-lugar-dica"></span></span></div></div><p id="office-feedback" class="ofc-aviso" role="status">${safeText(b.demo ? "Demonstração local: presença e chamadas não se conectam." : b.aviso || "")}</p></div>
 <details class="ofc-abrir" ${escritorio.ondeFechado === false ? "open" : ""} ontoggle="escritorio.ondeFechado=!this.open" ${modo === "mapa" ? "" : "hidden"}><summary>${escritorioIcone("pessoas")}<span>Quem está onde</span></summary><div id="office-onde"></div></details>
 <div id="office-map-lugar" ${modo === "mapa" ? "" : "hidden"}></div>
 <div id="office-mesa-card" class="ofc-mesa-card" role="dialog" aria-label="Sua mesa" hidden onmouseleave="this.hidden=true"></div>
 <div id="office-movel-card" class="ofc-mesa-card ofc-ficha-movel" role="dialog" aria-label="Selecionado" hidden></div>
 <div id="office-menu-pessoa" class="ofc-menu-pessoa" role="menu" aria-label="Ações" hidden></div>
 <div id="office-info-card" class="ofc-mesa-card ofc-info-card" role="status" hidden onmouseleave="this.hidden=true"></div>
 <div id="office-dia-card" class="ofc-mesa-card ofc-dia-card" role="tooltip" hidden onmouseleave="esconderDiaCardEscritorio()"></div>
 <div class="ofc-zoom" ${modo === "mapa" ? "" : "hidden"}><button type="button" onclick="escritorio.mapa?.mudarZoom(1.25)" aria-label="Aproximar">+</button><button type="button" onclick="escritorio.mapa?.mudarZoom(0.8)" aria-label="Afastar">−</button><button type="button" onclick="centralizarEmMimEscritorio()" aria-label="Centralizar em mim" title="Centralizar em mim">${escritorioIcone("alvo")}</button></div>
 <div class="ofc-lista" id="office-lista-salas" ${modo === "lista" ? "" : "hidden"}></div>
 <div class="ofc-coluna" id="office-coluna">
 <section id="office-cobrancas" class="ofc-missoes ofc-cobrancas" aria-label="Clientes cobrando neste quarto" hidden></section>
 <section id="office-missoes" class="ofc-missoes" aria-label="Missões" hidden></section>
 <section id="office-call" class="office-call${escritorio.callAberta ? " aberta" : ""}" ${escritorio.chamada ? "" : "hidden"} aria-label="Conversa por voz"><button type="button" class="office-call-actions" aria-expanded="${Boolean(escritorio.callAberta)}" onclick="escritorio.callAberta=!escritorio.callAberta;this.parentElement.classList.toggle('aberta',escritorio.callAberta);this.setAttribute('aria-expanded',escritorio.callAberta)"><b id="office-call-titulo">${safeText(escritorioTituloChamada())}</b><span id="office-call-rostos" class="office-call-rostos"></span><i class="office-call-seta" aria-hidden="true"></i></button><div id="office-call-media" class="office-call-media"></div></section>
 <div id="office-musica-lugar"></div>
 </div>
 <div class="ofc-editor" id="office-editor" role="toolbar" aria-label="Editor do mapa" hidden></div>
 <div class="ofc-acao" id="office-acao" hidden></div>
 <div class="ofc-bonus-lugar" id="office-bonus">${escritorioBonusCopaHtml("mapa")}</div>
 <div class="ofc-avisos" id="office-avisos" aria-live="polite"></div>
 <div class="ofc-dock" id="office-controls" role="toolbar" aria-label="Controles do escritório"></div>
 ${lobby ? `<div class="ofc-lobby lg${escritorio.lobbySaindo ? " saindo" : ""}" role="dialog" aria-modal="false" aria-labelledby="ofc-lobby-titulo" data-periodo="${escritorioPeriodoDoDia()}">${typeof vybelandiaCenaHtml === "function" ? vybelandiaCenaHtml("imagem") : ""}<div class="abr-vinheta" aria-hidden="true"></div><div class="lg-tela">${escritorioLobbyTopoHtml(perfil, eu, b)}<div id="lg-bau-lugar">${escritorioLobbyBauHtml()}</div>${escritorio.entrada ? `<div class="lg-base lg-carregando">${escritorioEntradaHtml()}</div>` : escritorioLobbyAcoesHtml(b)}</div></div>` : ""}
</main>
</section>`;
  if (lobby && typeof vbAnimarContagens === "function") vbAnimarContagens(painel);
  if (typeof escritorioCelebrarSeMudou === "function") escritorioCelebrarSeMudou();
  // Só trava a rolagem da página com o Escritório na tela. Com a chamada
  // ligada ele se redesenha por trás do painel (presença, cobranças) e o
  // "add" de antes travava a página do Deivid (Paulo, 20/10/2026).
  document.body.classList.toggle("no-escritorio", painel.style.display === "block");
  if (lobby) {
    animarLobbyEscritorio();
    if (!escritorio.entrada) { carregarLobbyEscritorio(); observarLobbyEscritorio(); }
    // Enter entra: o botão principal recebe o foco uma vez por visita.
    if (!escritorio.lobbyFocado && !document.activeElement?.closest?.("input,select,textarea,[contenteditable]")) { escritorio.lobbyFocado = true; document.getElementById("office-connect")?.focus({ preventScroll: true, focusVisible: false }); }
  }
  else { clearInterval(escritorio.timerLobby); clearInterval(escritorio.timerNoticias); fecharObservadorLobbyEscritorio(); pararTesteMicLobbyEscritorio(false); }
  carregarCopaEscritorio();
  atualizarPessoasEscritorio();
  atualizarControlesEscritorio();
  pintarArtesEscritorio(document.querySelector(".ofc-topo") || document);
  // Amostras de parede da lateral da construção (arte do painel do Habbo).
  const amostrasParede = document.querySelector(".ofc-amostras-parede");
  if (amostrasParede) pintarArtesEscritorio(amostrasParede);
  if (typeof convidadoPodarTela === "function") convidadoPodarTela();
  if (typeof pintarMissoesEscritorio === "function") { pintarMissoesEscritorio(); carregarMissoesEscritorio(); pintarCobrancasEscritorio(escritorio.cobrancasGrupos || [], null); }
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
    // Sempre na coluna; solto, flutua por cima do mapa (escritorioPrepararCaixas).
    lugarMusica.replaceWith(musica);
  }
  escritorioPrepararCaixas();
  if (!escritorio.mapa) {
    const planta = escritorioPlantaDaCena();
    escritorio.mapa = criarMapaEscritorio(el, {
      planta,
      eu: escritorio.base.eu,
      aoClicar: (x, y, objeto) => cliqueNoMapaEscritorio(x, y, objeto),
      aoDuploClique: (x, y, objeto) => alternarComDuploCliqueEscritorio(x, y, objeto),
      aoPassarMovel: (m) => preCarregarOrigemMovelEscritorio(m),
      aoPassar: (x, y, cx, cy, fx, fy) => passarNoMapaEscritorio(x, y, cx, cy, fx, fy),
      aoPegar: (x, y, fx, fy, movel) => typeof pegarNoEditorEscritorio === "function" && pegarNoEditorEscritorio(x, y, fx, fy, movel),
      aoArrastar: (x, y, fx, fy) => arrastarNoEditorEscritorio(x, y, fx, fy),
      aoSoltar: (x, y, moveu) => soltarNoEditorEscritorio(x, y, moveu),
      aoCancelar: () => cancelarArrastoEditorEscritorio(),
      aoClicarSaida: () => planta.saida && escritorioIrPara(planta.saida.x, planta.saida.y),
    });
    // A cena cabe inteira na tela, como um quarto do Habbo.
    requestAnimationFrame(() => escritorio.mapa?.enquadrarQuarto());
    // Se a posição salva ficou presa (móvel em volta), sai pelo ladrilho livre
    // mais perto que tenha caminho até a recepção.
    escritorio.mapa.prontos.then(() => { posicionarTacaEscritorio(); escritorioDestravar(); escritorioMarcarRecados(); escritorioMarcarDia(); escritorioAtualizarPortas(); escritorioAcenderReguladores(); carregarPostitsEscritorio(); escritorioOcuparOperacao(); if (typeof vigiarCobrancasEscritorio === "function") vigiarCobrancasEscritorio(); });
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
  document.querySelector("#painel-escritorio .ofc-aba:not([hidden])")?.classList.add("ofc-entra");
  if (aba === "recados") atualizarRecadosEscritorio();
  if (aba === "clientes") carregarClientesEscritorio();
  if (aba === "inventario") carregarTrocasEscritorio();
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
  return outros.length ? `Quem está em ${aqui.nome} e em ${outros.join(", ")} lê esta conversa.` : `Quem está em ${aqui.nome} lê esta conversa.`;
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
  const conv = escritorio.base?.convidado;
  if (conv && !conv.vozes.includes(escritorio.zona)) return `Voz na sala de ${String(conv.anfitriao.nome).split(" ")[0]}`;
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
  // Entrou ou saiu de sala com som: a música toca ou para (só para esta pessoa).
  const naPista = typeof escritorioNaPista === "function" && escritorioNaPista();
  if (naPista !== Boolean(escritorio.naPista) || (naPista && escritorio.musicaZona !== escritorio.zona)) escritorioMusicaDaSala();
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
function passarNoMapaEscritorio(x, y, cx, cy, fx = x + 0.5, fy = y + 0.5) {
  if (escritorio.edicao) {
    // Com o pincel, a prévia é a área que vai ser pintada; sem ele, o móvel na mão.
    if (typeof escritorioPintando === "function" && escritorioPintando()) { escritorio.mapa?.previa(null); previaPincelEscritorio(x, y, fx, fy); return; }
    escritorio.mapa?.pincel?.(null);
    previaEditorEscritorio(x, y); return;
  }
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
    card.innerHTML = `<b>Sua mesa</b><small>${safeText(mesa.ambiente.nome)} · <span style="color:${st[1]}">${safeText(st[0])}</span></small><small>${avisos ? `${avisos} ${avisos === 1 ? "aviso" : "avisos"} no Painel · <button type="button" class="office-text-button" onclick="marcarNotificacoesLidas().then(()=>{document.getElementById('office-mesa-card').hidden=true})">marcar como lidos</button>` : "Nenhum aviso novo"}</small>${escritorioMinhaFilaHtml()}<div><button type="button" class="ofc-mini" onclick="escolherPainelDoEscritorio()">Abrir painel</button>${escritorioPodeEditar(mesa.ambiente.id) ? `<button type="button" class="ofc-mini" onclick="editarMovelDaMesaEscritorio('mesa')">Editar mesa</button><button type="button" class="ofc-mini" onclick="editarMovelDaMesaEscritorio('computador')">Editar computador</button>` : ""}</div>`;
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
// Ficha do móvel (infostand do Habbo, desenho novo em 20/10/2026): abre na
// hora com o que o navegador já sabe (arte, nome, categoria, dono da sala) e
// completa com a origem vinda do servidor. As ações do móvel ficam nela:
// clicar num assento ou cama mostra "Sentar"/"Deitar" em vez de sentar direto.
function abrirFichaMovelEscritorio(m) {
  const card = document.getElementById("office-movel-card");
  if (!card || !m) return;
  // A taça da Copa: quem é o campeão e o ranking do mês.
  if (m.origem?.copa) {
    const c = escritorio.base?.copa;
    card.classList.remove("cj-no-clique");
    card.innerHTML = `<div class="ofc-ficha-movel-arte">${escritorio.copaArte ? `<img src="${escritorio.copaArte}" alt="">` : ""}</div><b>Taça da Copa Vybe</b><small>${c ? `${safeText(c.campeao.nome)} · ${safeText(c.titulo)}` : ""}</small><p class="ofc-nota">Quem tiver mais XP do trabalho no mês leva a taça, o título e o prêmio.${escritorio.copaLider ? ` Neste mês, ${safeText(String(escritorio.copaLider.nome).split(" ")[0])} lidera com ${Number(escritorio.copaLider.xp).toLocaleString("pt-BR")} XP.` : ""}</p><div><button type="button" class="ofc-mini" onclick="fecharFichaMovelEscritorio();abrirRankingEscritorio('geral','mes')">Ver a Copa do mês</button><button type="button" class="ofc-mini" onclick="fecharFichaMovelEscritorio()">Fechar</button></div>`;
    card.hidden = false;
    return;
  }
  escritorio.movelSelecionado = m;
  const cat = (typeof escritorioCatalogo !== "undefined" && escritorioCatalogo || []).find((x) => x.classe === m.classe);
  const nome = cat ? escritorioNomeMovel(cat) : m.classe.replace(/_/g, " ");
  const f = typeof mapaFisica === "function" ? mapaFisica(m.classe) : {};
  const acoes = [];
  if (f.senta) acoes.push(["Sentar", "sentarNoMovelSelecionadoEscritorio()"]);
  if (f.deita) acoes.push(["Deitar", "sentarNoMovelSelecionadoEscritorio()"]);
  const acao = escritorioAcaoDoMovel(m) || (ESCRITORIO_REGULADOR.test(m.classe) ? { texto: "Regular a luz" } : null);
  if (acao) acoes.push([acao.texto || "Usar", "usarMovelSelecionadoEscritorio()"]);
  // Tela, telefone, globo…: a arte tem outro estado (desligado/parado).
  // Liga e desliga para todos, como o duplo clique (Paulo, 20/10/2026).
  else if (escritorioTrocaEstadoSimples(m)) acoes.push(["Ligar ou desligar", "trocarEstadoMovelSelecionadoEscritorio()"]);
  const camada = m.origem?.camada;
  if (camada && escritorioPodeEditar(camada)) acoes.push(["Editar", "editarMovelSelecionadoEscritorio()", true]);
  const raiz = camada ? escritorioRaizQuarto(camada) : "";
  const donoId = escritorio.base?.salas?.find((x) => x.id === raiz)?.pessoa_id;
  const dono = donoId ? (escritorio.base?.equipe || []).find((p) => String(p.id) === String(donoId)) : null;
  const cabeca = dono ? escritorioCabecaUrl(dono.id) : null;
  card.innerHTML = `<button type="button" class="ofc-fm-fechar" onclick="fecharFichaMovelEscritorio()" aria-label="Fechar">×</button>
<div class="ofc-fm-topo"><div class="ofc-ficha-movel-arte"></div><div class="ofc-fm-titulo"><b>${safeText(nome)}</b>${cat?.categoria ? `<small>${safeText(cat.categoria)}</small>` : ""}
<span class="ofc-fm-dono">${dono ? `${cabeca ? `<img src="${safeText(cabeca)}" alt="" width="22" height="22">` : ""}Sala de ${safeText(String(dono.nome).split(" ")[0])}` : camada && !raiz.startsWith("sala-") ? "Sala comum" : ""}</span></div></div>
<div class="ofc-ficha-movel-origem" aria-live="polite">${escritorioOrigemMovelHtml(m)}</div>
${acoes.length ? `<div class="ofc-fm-acoes">${acoes.map(([t, fn, sec], k) => `<button type="button" class="${k === 0 && !sec ? "ofc-primario" : "ofc-secundario"}" onclick="${fn}">${safeText(t)}</button>`).join("")}</div>` : ""}`;
  // A arte do próprio móvel, como na ficha do Habbo.
  const fonte = m.no?.tagName === "CANVAS" ? m.no : m.no?.querySelector("canvas");
  if (fonte) {
    const c = document.createElement("canvas"), k = Math.min(1.5, 84 / Math.max(fonte.width, fonte.height));
    c.width = Math.round(fonte.width * k); c.height = Math.round(fonte.height * k);
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    for (const parte of m.no?.tagName === "CANVAS" ? [m.no] : m.no.querySelectorAll("canvas")) g.drawImage(parte, 0, 0, c.width, c.height);
    card.querySelector(".ofc-ficha-movel-arte").append(c);
  }
  card.hidden = false;
  vigiarFichaEscritorio();
  carregarOrigemMovelEscritorio(m);
  if (!escritorioCatalogo) carregarCatalogoEscritorio().then(() => { if (escritorio.movelSelecionado === m && !card.hidden) abrirFichaMovelEscritorio(m); });
}
// Sentar ou deitar pelo botão da ficha (ou pelo duplo clique): anda até o
// ladrilho do móvel, como o clique fazia antes.
function sentarNoMovelSelecionadoEscritorio(m = escritorio.movelSelecionado) {
  if (!m) return;
  fecharFichaMovelEscritorio();
  cliqueNoMapaEscritorio(Math.floor(m.x) + 0.5, Math.floor(m.y) + 0.5, { tipo: "movel", item: m, andar: true });
}
// De onde veio o móvel (Paulo, 20/10/2026): de quem é a sala, raridade e
// preço na loja, e como o dono conseguiu (compra, presente, troca, conquista).
// Guarda a resposta e a promessa: clicar de novo não busca outra vez.
const escritorioOrigensMovel = new Map();
const ESCRITORIO_ORIGEM_ICONE = { compra: "moeda", conquista: "estrela" };
function escritorioChaveOrigem(m) { return (m.origem?.camada || "") + "|" + m.classe; }
function escritorioOrigemMovelHtml(m) {
  if (!m.origem?.camada || escritorio.base?.demo) return "";
  const o = escritorioOrigensMovel.get(escritorioChaveOrigem(m));
  if (!o || o.then) return '<div class="ofc-fm-carregando" aria-label="Carregando"><i></i><i></i></div>';
  if (o.erro) return `<small class="ofc-nota" role="alert">${safeText(o.erro)}</small>`;
  const data = (d) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "");
  const chaveRar = String(o.raridade || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "_");
  const chips = `${o.raridade ? `<em class="ofc-raridade ${safeText(chaveRar)}">${safeText(o.raridade)}</em>` : ""}${o.marco ? '<span class="ofc-fm-chip">Só por conquista</span>' : o.preco != null && o.tipo !== "essencial" ? `<span class="ofc-fm-chip">${Number(o.preco).toLocaleString("pt-BR")} VybeCoins</span>` : ""}${o.unidades > 1 ? `<span class="ofc-fm-chip">${o.unidades} unidades</span>` : ""}`;
  const icone = (t) => (typeof escritorioFichaIcone === "function" ? escritorioFichaIcone(ESCRITORIO_ORIGEM_ICONE[t] || "caixa") : "");
  const venda = o.preco != null && !o.marco && !["essencial", "imagem"].includes(o.tipo);
  return `${chips ? `<div class="ofc-fm-chips">${chips}</div>` : ""}<ul class="ofc-fm-origens">${o.origens.map((x) => `<li><i aria-hidden="true">${icone(x.tipo)}</i><span>${safeText(x.texto)}</span>${x.em ? `<time>${data(x.em)}</time>` : ""}</li>`).join("")}</ul>${venda ? `<button type="button" class="ofc-fm-catalogo" onclick="verNoCatalogoEscritorio('${safeText(m.classe)}')">Ver no catálogo</button>` : ""}`;
}
function carregarOrigemMovelEscritorio(m) {
  const k = escritorioChaveOrigem(m);
  if (!m.origem?.camada || escritorio.base?.demo || escritorioOrigensMovel.has(k)) return escritorioOrigensMovel.get(k);
  const p = escritorioApi("movel-origem", null, { camada: m.origem.camada, classe: m.classe })
    .then((o) => { escritorioOrigensMovel.set(k, o); })
    .catch(() => { escritorioOrigensMovel.set(k, { erro: "Não deu para ver de onde veio agora." }); setTimeout(() => escritorioOrigensMovel.delete(k), 30000); })
    .then(() => {
      // Atualiza a ficha aberta se ela ainda é deste móvel (mesma sala e classe).
      const alvo = document.querySelector("#office-movel-card:not([hidden]) .ofc-ficha-movel-origem"), sel = escritorio.movelSelecionado;
      if (alvo && sel && escritorioChaveOrigem(sel) === k) alvo.innerHTML = escritorioOrigemMovelHtml(sel);
    });
  escritorioOrigensMovel.set(k, p);
  return p;
}
// Passou o mouse num móvel: já busca a origem, para a ficha abrir pronta.
function preCarregarOrigemMovelEscritorio(m) { if (m && !escritorio.edicao) carregarOrigemMovelEscritorio(m); }
// Abre o catálogo na ficha deste móvel, com o botão de comprar (Paulo, 20/10/2026).
function verNoCatalogoEscritorio(classe) {
  if (!escritorioCatalogo) { carregarCatalogoEscritorio().then(() => verNoCatalogoEscritorio(classe)); return; }
  const cat = escritorioCatalogo.find((x) => x.classe === classe);
  fecharFichaMovelEscritorio();
  escritorio.cat ||= { raridade: "", ordem: "preco", categoria: "*", busca: "", posso: false, ver: 60, aba: "loja", inv: "todos" };
  Object.assign(escritorio.cat, { busca: cat ? escritorioNomeMovel(cat) : classe, raridade: "", categoria: "*", posso: false, ver: 60 });
  abrirCatalogoEscritorio("loja");
  abrirPreviaMovelEscritorio(classe);
}
// Ficha de móvel ou pessoa fecha também ao clicar fora dela (andar,
// selecionar outra coisa) e com Esc (Paulo, 19/10/2026: "não tá tendo como
// fechar quando seleciona algo?"). Um clique em outro boneco ou móvel fecha
// esta e abre a dele, como no Habbo.
let escritorioFichaVigiada = false;
function vigiarFichaEscritorio() {
  if (escritorioFichaVigiada) return;
  escritorioFichaVigiada = true;
  const aberta = () => { const c = document.getElementById("office-movel-card"), m = document.getElementById("office-menu-pessoa"); return (c && !c.hidden) || (m && !m.hidden) ? [c, m] : null; };
  document.addEventListener("pointerdown", (ev) => {
    const nos = aberta();
    if (nos && !nos.some((n) => n?.contains(ev.target))) { if (escritorio.pessoaSelecionada) escritorio.mapa?.selecionarPessoa?.(null); fecharFichaMovelEscritorio(); }
  }, true);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && aberta() && !document.querySelector("dialog[open]")) { fecharFichaMovelEscritorio(); escritorio.mapa?.selecionarPessoa?.(null); }
  });
}
function fecharFichaMovelEscritorio() {
  escritorio.movelSelecionado = null;
  escritorio.pessoaSelecionada = null;
  const card = document.getElementById("office-movel-card");
  if (card) { card.hidden = true; card.classList.remove("cj-no-clique"); }
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
    // O cartão do jogador (o mesmo do mouse por cima), com os botões.
    const botoes = `<div class="cj-botoes"><button type="button" class="ofc-mini" onclick="fecharFichaMovelEscritorio();abrirFichaEscritorio('${sid}')">Ficha completa</button>${escritorio.base?.paulo ? `<button type="button" class="ofc-mini cj-moedas" onclick="fecharFichaMovelEscritorio();abrirMoedasEscritorio('${sid}')">Dar VybeCoins</button>` : ""}<button type="button" class="ofc-mini" onclick="fecharFichaMovelEscritorio();escritorio.mapa?.selecionarPessoa(null)" aria-label="Fechar">Fechar</button></div>`;
    const pintar = () => { if (escritorio.pessoaSelecionada === String(id) && !card.hidden) card.innerHTML = escritorioCartaoJogadorHtml(id) + botoes; };
    card.classList.add("cj-no-clique");
    card.innerHTML = escritorioCartaoJogadorHtml(id) + botoes;
    if (typeof carregarPerfilJogoEscritorio === "function") carregarPerfilJogoEscritorio(id, pintar);
    esconderCartaoJogadorEscritorio();
    card.hidden = false;
    vigiarFichaEscritorio();
  }
  const acoes = eu
    ? [["Acenar", "definirPoseEscritorio('acenar')"], ["Sentar no chão", "sentarNoChaoEscritorio()"], ["Personalizar", "personalizarEscritorio()"]]
    : [...(online ? [["Ir até", `escritorioIrAte('${sid}')`]] : []), ["Deixar recado", `abrirRecadosEscritorio('${sid}')`], ["Dar presente", `abrirPresenteEscritorio('${sid}')`]];
  // Só Paulo (o servidor confere de novo): VybeCoins direto do boneco.
  if (escritorio.base?.paulo) acoes.push(["Dar VybeCoins", `abrirMoedasEscritorio('${sid}')`]);
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
  if (escritorio.edicao) { cliqueEditorEscritorio(x, y, objeto?.tipo === "movel" ? objeto.item : null); return; }
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
    const m = objeto.item;
    // Clique mostra a ficha com as ações (Paulo, 20/10/2026: a cadeira sentava
    // direto, sem dar para ver o móvel). Sentar vem do botão ou do duplo clique.
    if (!objeto.andar && !ESCRITORIO_REGULADOR.test(m.classe)) { abrirFichaMovelEscritorio(m); return; }
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
  // VybeCoins de Paulo: quem recebe relê a carteira.
  else if (k === "vbc") moedasChegaramEscritorio(id, v);
  else if (k === "trc") trocaChegouEscritorio(id, v);
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
  // Duplo clique num assento ou cama: senta ou deita direto.
  if (objeto?.tipo === "movel") {
    const fis = mapaFisica(objeto.item.classe);
    if (fis.senta || fis.deita) return sentarNoMovelSelecionadoEscritorio(objeto.item);
    x = Math.floor(objeto.item.x); y = Math.floor(objeto.item.y); fecharFichaMovelEscritorio();
  }
  const m = (escritorio.mapa.moveisEm(x, y) || []).find((i) => !i.parede && !ESCRITORIO_DADO.test(i.classe) && !ESCRITORIO_TELEPORTE.test(i.classe) && !MAPA_PORTAS.test(i.classe) && (escritorioEstadosDoMovel(i).length > 1 || ["relogio", "voto", "placar"].includes(escritorioLogica(i))));
  if (!m) return;
  if (/floor_switch/.test(m.classe)) return puxarAlavancaEscritorio(m);
  // Dois cliques: o relógio troca o tempo; contador e placar zeram.
  if (escritorioLogica(m) === "relogio") return tempoRelogioEscritorio(m);
  if (escritorioLogica(m) === "voto" || escritorioLogica(m) === "placar") { escritorioVotei.delete(escritorio.mapa.chaveMovel(m)); return escritorioMudarEstado(m, 0); }
  if (ESCRITORIO_GARRAFA.test(m.classe)) return girarGarrafaEscritorio(m);
  if (ESCRITORIO_ROLETA.test(m.classe)) return girarRoletaEscritorio(m);
  if (mapaEhPortao(m.classe) && !m.altura) return alternarPortaoEscritorio(m);
  trocarEstadoMovelEscritorio(m);
}
// O próximo estado da arte, para todos (furni:toggle).
function trocarEstadoMovelEscritorio(m) {
  const estados = escritorioEstadosDoMovel(m), i = estados.indexOf(m.estado || 0);
  const estado = estados[(i + 1) % estados.length];
  const chave = escritorio.mapa.chaveMovel(m);
  escritorio.mapa.estadosMoveis([[chave, estado]]);
  escritorioEmitir("furni:toggle", { chave, estado });
  escritorioTocar(estado ? 660 : 330, 0.08, 0.05);
}
// Móvel que só troca de estado (sem regra própria: dado, porta, relógio…).
function escritorioTrocaEstadoSimples(m) {
  return Boolean(m && escritorio.mapa && !ESCRITORIO_DADO.test(m.classe) && !ESCRITORIO_TELEPORTE.test(m.classe) && !MAPA_PORTAS.test(m.classe)
    && !["relogio", "voto", "placar"].includes(escritorioLogica(m)) && escritorioEstadosDoMovel(m).length > 1);
}
function trocarEstadoMovelSelecionadoEscritorio() {
  const m = escritorio.movelSelecionado;
  if (!m) return;
  trocarEstadoMovelEscritorio(m);
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
  if (l === "link") return { item: m, texto: "Abrir o painel", fazer: () => escolherPainelDoEscritorio() };
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
  if (ESCRITORIO_SOM.test(m.classe) && escritorioNaPista()) return { item: m, fazer: abrirMusicaEscritorio };
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
    if (naMesa) return { item: naMesa, texto: escritorio.avisos ? `Abrir painel · ${escritorio.avisos} ${escritorio.avisos === 1 ? "aviso" : "avisos"}` : "Abrir painel", fazer: () => escolherPainelDoEscritorio() };
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
  // Jukebox, rádio, vitrola, DJ: o bot de música da sala.
  const som = escritorioNaPista() && perto.find((m) => ESCRITORIO_SOM.test(m.classe));
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
// Painel na mesma aba ou numa aba nova (Paulo, 21/10/2026: quem trabalha com
// duas telas puxa a aba nova para a outra tela sem duplicar o áudio). A aba
// nova abre direto no trabalho (?painel=1), sem entrar no escritório.
const ESCRITORIO_PAINEL_ONDE = "vybe-escritorio-painel-onde";
function escritorioPainelOnde() { try { return localStorage.getItem(ESCRITORIO_PAINEL_ONDE) || ""; } catch { return ""; } }
function escolherPainelDoEscritorio(quadro = "") {
  const onde = escritorioPainelOnde();
  if (onde === "aqui") return abrirPainelDoEscritorio(quadro);
  if (onde === "nova") return abrirPainelEmOutraAba(quadro);
  openWorkflowModal(`<div class="workflow-kicker"><span>Painel</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Onde abrir o painel?</h2>
    <p class="workflow-copy">Em outra aba, o escritório continua aqui (com o áudio) e o painel vai para a aba nova, que você pode arrastar para a outra tela.</p>
    <div class="ofc-abrir">
      <button type="button" class="ofc-abrir-opcao" onclick="escritorioPainelEscolha('aqui','${safeText(quadro)}')"><span class="ofc-abrir-icone">${escritorioIcone("estaAba")}</span><b>Nesta aba</b><small>Sai do mapa e abre o painel aqui.</small></button>
      <button type="button" class="ofc-abrir-opcao" onclick="escritorioPainelEscolha('nova','${safeText(quadro)}')"><span class="ofc-abrir-icone">${escritorioIcone("outraAba")}</span><b>Em outra aba</b><small>Para quem usa duas telas. O áudio fica só nesta.</small></button>
    </div>
    <label class="ofc-abrir-lembrar"><input type="checkbox" id="ofc-abrir-lembrar"> Lembrar neste computador</label>`);
}
function escritorioPainelEscolha(onde, quadro) {
  if (document.getElementById("ofc-abrir-lembrar")?.checked) try { localStorage.setItem(ESCRITORIO_PAINEL_ONDE, onde); } catch {}
  closeWorkflowModal();
  if (onde === "nova") abrirPainelEmOutraAba(quadro); else abrirPainelDoEscritorio(quadro);
  atualizarDockEscritorio();
}
function esquecerPainelOndeEscritorio() { try { localStorage.removeItem(ESCRITORIO_PAINEL_ONDE); } catch {} atualizarDockEscritorio(); escolherPainelDoEscritorio(); }
function abrirPainelEmOutraAba(quadro = "") {
  try { localStorage.setItem("vybe-escritorio-avisos-visto", String(Date.now())); } catch {}
  escritorio.avisosNovos = 0;
  const url = new URL(location.href); url.search = ""; url.hash = "";
  url.searchParams.set("painel", "1"); if (quadro) url.searchParams.set("quadro", quadro);
  const aba = window.open(url.toString(), "_blank");
  if (!aba) { showToast("O navegador bloqueou a aba nova. Libere as janelas deste site ou escolha \"Nesta aba\".", "info", 7000); return; }
  atualizarDockEscritorio();
}
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
  // Aba aberta pelo "Painel em outra aba": fica no trabalho.
  const pedido = new URLSearchParams(location.search);
  if (pedido.get("painel") === "1") {
    const quadro = pedido.get("quadro"), btn = quadro && document.getElementById("btn-board-" + quadro);
    if (btn) switchBoard(quadro, btn);
    return;
  }
  if (new URLSearchParams(location.search).has("atividade")) return;
  const antes = typeof activeBoard !== "undefined" ? activeBoard : "producao";
  // Enquanto pergunta ao servidor, a tela de trabalho fica escondida atrás da
  // cidade: antes aparecia o painel de demandas e só depois o Escritório
  // (Paulo, 22/10/2026). Sai assim que decide, ou em 8 s se o servidor demorar.
  const fundo = document.getElementById("vybelandia-img")?.getAttribute("href") || "/assets/vybelandia.webp";
  document.body.style.setProperty("--vybelandia-abrindo", `url("${fundo}")`);
  document.body.classList.add("abrindo-escritorio");
  const liberar = () => document.body.classList.remove("abrindo-escritorio");
  const limite = setTimeout(liberar, 8000);
  try {
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
  } finally {
    clearTimeout(limite);
    liberar();
  }
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
      : vbEstadoHtml({ titulo: "Ninguém escreveu ainda", texto: "O que você escrever aqui aparece para quem está nesta conversa." });
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
  // Sala trancada ou com convidado: conversa própria da sala. O convidado
  // nunca entra na conversa única dos espaços abertos (o som da equipe toda
  // chegaria ao navegador dele); quem está na sala com ele vem junto.
  if (escritorio.trancas?.has(zona) || (escritorio.online || []).some((p) => p.convidado && p.zona === zona)) return zona;
  return escritorio.base?.convidado ? zona : "escritorio";
}
function escritorioConversaAutomatica() {
  clearTimeout(escritorio.timerConversa);
  if (!escritorio.conectado || escritorio.base?.demo) return;
  // Corredor/Foco: fica na conversa geral (pronta para a próxima sala), só
  // sem microfone e sem som; da sala trancada, sai.
  let alvo = escritorioCanal() || "escritorio";
  // Convidado: voz só na sala de quem convidou (conversa própria); nunca na
  // conversa única dos espaços abertos.
  if (escritorio.base?.convidado) {
    if (alvo === "escritorio" || !escritorio.base.convidado.vozes.includes(alvo)) { if (escritorio.chamada) sairChamadaEscritorio(); return; }
  }
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
// Saiu da tela cheia ou da janelinha flutuante: aplica o que mudou enquanto isso.
let escritorioAmpliadoVigiado = false;
function escritorioVigiarAmpliado() {
  if (escritorioAmpliadoVigiado) return;
  escritorioAmpliadoVigiado = true;
  const voltar = () => setTimeout(() => {
    if (escritorio.midiaPendente && !document.fullscreenElement && !document.webkitFullscreenElement && !document.pictureInPictureElement) renderMidiaEscritorio();
  }, 0);
  document.addEventListener("fullscreenchange", voltar);
  document.addEventListener("webkitfullscreenchange", voltar);
  document.addEventListener("leavepictureinpicture", voltar, true);
}
function renderMidiaEscritorio() {
  atualizarTituloChamadaEscritorio();
  const meeting = escritorio.chamada,
    el = document.getElementById("office-call-media");
  if (!meeting || !el) return;
  // Assistindo a tela de alguém em tela cheia ou na janelinha flutuante (Paulo,
  // 20/10/2026: "tá minimizando sozinho"): desmontar o vídeo fecharia a tela
  // cheia. Espera sair dela para redesenhar a conversa.
  const ampliado = document.fullscreenElement || document.webkitFullscreenElement || document.pictureInPictureElement;
  if (ampliado && el.contains(ampliado)) { escritorio.midiaPendente = true; escritorioVigiarAmpliado(); return; }
  escritorio.midiaPendente = false;
  // Os vídeos (câmera e tela) são reaproveitados entre um desenho e outro,
  // pelo id da faixa: recriar a cada mudança de microfone fazia piscar.
  const videosAntes = escritorio.videosChamada || new Map(), videosAgora = new Map();
  const videoDaFaixa = (faixa, controles) => {
    let v = videosAntes.get(faixa.id);
    if (!v) {
      v = document.createElement("video");
      v.autoplay = true; v.playsInline = true; v.muted = true; v.controls = controles;
      v.srcObject = new MediaStream([faixa]);
    }
    videosAgora.set(faixa.id, v);
    return v;
  };
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
      const v = videoDaFaixa(p.videoTrack, false);
      tile.append(v);
      v.play?.().catch(() => {});
    }
    if (p.screenShareEnabled && p.screenShareTracks?.video) {
      const v = videoDaFaixa(p.screenShareTracks.video, true);
      tile.append(v);
      v.play?.().catch(() => {});
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
  escritorio.videosChamada = videosAgora;
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

// Caixas da coluna da direita soltas (Paulo, 22/10/2026: "que a pessoa
// consiga puxar ela pra outro lugar cada uma individual, aumentar,
// diminuir"). A mesma peça que a Música já usava: arrastar pelo topo solta a
// caixa da coluna e ela fica onde a pessoa deixou; o canto de baixo à
// direita muda o tamanho; dois cliques no topo (ou o menu Mais) devolvem à
// coluna. O arranjo é de cada pessoa, guardado no navegador dela.
// id da caixa → topo por onde se arrasta (na ordem da coluna).
const ESCRITORIO_CAIXAS = { "office-cobrancas": ".ofc-missoes-topo", "office-missoes": ".ofc-missoes-topo", "office-call": ".office-call-actions", "office-musica": ".ofc-musica-topo", "office-minha-tela": ".ofc-minha-tela-topo" };
const ESCRITORIO_CAIXA_MIN = { w: 240, h: 72 };
function escritorioCaixaSalva(id) {
  try {
    const v = JSON.parse(localStorage.getItem("vybe-escritorio-caixa-" + id) || "null");
    if (v || id !== "office-musica") return v;
    // Posição da Música de antes da peça compartilhada.
    const antiga = JSON.parse(localStorage.getItem("vybe-escritorio-musica-pos") || "null");
    return antiga ? { solto: true, x: antiga.x, y: antiga.y } : null;
  } catch { return null; }
}
function escritorioGuardarCaixa(id, dados) {
  try {
    dados ? localStorage.setItem("vybe-escritorio-caixa-" + id, JSON.stringify(dados)) : localStorage.removeItem("vybe-escritorio-caixa-" + id);
    if (id === "office-musica") localStorage.removeItem("vybe-escritorio-musica-pos");
  } catch {}
}
// Celular: a coluna vira a lista de baixo; caixa solta só em tela larga.
const escritorioCaixasSoltas = () => !window.matchMedia?.("(max-width: 760px)").matches;
// Solta, a caixa continua na coluna (os estilos dela valem) e flutua fixa
// sobre o mapa; a posição guardada é relativa à área do escritório.
function escritorioPosicionarCaixa(el, x, y) {
  const area = document.querySelector(".ofc-principal")?.getBoundingClientRect();
  if (!area) return null;
  x = Math.min(Math.max(8, area.width - el.offsetWidth - 8), Math.max(8, x));
  y = Math.min(Math.max(8, area.height - 48), Math.max(8, y));
  Object.assign(el.style, { left: area.left + x + "px", top: area.top + y + "px", right: "auto", bottom: "auto" });
  el.dataset.x = x; el.dataset.y = y;
  return { x, y };
}
function escritorioSoltarCaixa(el) {
  const area = document.querySelector(".ofc-principal")?.getBoundingClientRect();
  if (!area || el.classList.contains("solto")) return;
  const r = el.getBoundingClientRect();
  el.style.width = (parseFloat(el.style.getPropertyValue("--caixa-w")) || r.width) + "px";
  el.classList.add("solto");
  escritorioPosicionarCaixa(el, r.left - area.left, r.top - area.top);
}
function escritorioAplicarCaixa(el) {
  const v = escritorioCaixasSoltas() ? escritorioCaixaSalva(el.id) : null;
  if (v?.h) el.style.setProperty("--caixa-h", v.h + "px"); else el.style.removeProperty("--caixa-h");
  if (v?.w) el.style.setProperty("--caixa-w", v.w + "px"); else el.style.removeProperty("--caixa-w");
  if (!v?.solto) return;
  escritorioSoltarCaixa(el);
  if (v.w) el.style.width = v.w + "px";
  // A área do escritório ainda está montando na primeira volta: confere de novo.
  escritorioPosicionarCaixa(el, v.x, v.y);
  for (const ms of [120, 800]) setTimeout(() => el.isConnected && el.classList.contains("solto") && escritorioPosicionarCaixa(el, v.x, v.y), ms);
}
function escritorioPrepararCaixas() {
  for (const [id, alca] of Object.entries(ESCRITORIO_CAIXAS)) {
    const el = document.getElementById(id);
    if (!el || el.dataset.caixa) continue;
    el.dataset.caixa = "1";
    el.classList.add("ofc-caixa");
    escritorioAplicarCaixa(el);
    let gesto = null;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !escritorioCaixasSoltas()) return;
      const r = el.getBoundingClientRect();
      const canto = e.clientX > r.right - 18 && e.clientY > r.bottom - 18;
      if (!canto && (!e.target.closest(alca) || e.target.closest("select, input, textarea, a, .ofc-x"))) return;
      gesto = { modo: canto ? "tamanho" : "talvez", px: e.clientX, py: e.clientY, x: el.offsetLeft, y: el.offsetTop, w: r.width, h: r.height, id: e.pointerId };
      if (canto) { e.preventDefault(); e.stopPropagation(); el.classList.add("mudando"); }
      // O mouse sai de cima da caixa no meio do gesto: acompanha pela janela.
      window.addEventListener("pointermove", mover);
      window.addEventListener("pointerup", soltar, { once: true });
      window.addEventListener("pointercancel", soltar, { once: true });
    });
    const mover = (e) => {
      if (!gesto || e.pointerId !== gesto.id) return;
      const dx = e.clientX - gesto.px, dy = e.clientY - gesto.py;
      if (gesto.modo === "talvez") {
        // Só vira arrasto depois de andar um pouco: clicar no topo continua abrindo e fechando.
        if (Math.hypot(dx, dy) < 6) return;
        escritorioSoltarCaixa(el);
        gesto = { ...gesto, modo: "mover", x: Number(el.dataset.x) - dx, y: Number(el.dataset.y) - dy };
        el.classList.add("arrastando");
      }
      if (gesto.modo === "mover") { escritorioPosicionarCaixa(el, gesto.x + dx, gesto.y + dy); return; }
      const area = document.querySelector(".ofc-principal")?.getBoundingClientRect(), r = el.getBoundingClientRect(), solto = el.classList.contains("solto");
      if (!area) return;
      const h = Math.round(Math.min(area.bottom - r.top - 8, Math.max(ESCRITORIO_CAIXA_MIN.h, gesto.h + dy)));
      el.style.setProperty("--caixa-h", h + "px");
      // Na coluna, a largura é a dela; solta, a caixa também alarga e estreita.
      if (solto) { const w = Math.round(Math.min(area.right - r.left - 8, Math.max(ESCRITORIO_CAIXA_MIN.w, gesto.w + dx))); el.style.width = w + "px"; el.style.setProperty("--caixa-w", w + "px"); }
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      if (!gesto) return;
      const g = gesto; gesto = null;
      el.classList.remove("arrastando", "mudando");
      if (g.modo === "talvez") return;
      // O clique que vem depois do arrasto não abre nem fecha a caixa.
      // (só o clique que chega junto com a soltura; se não vier, não bloqueia o próximo).
      if (g.modo === "mover") {
        const engolir = (c) => { c.stopPropagation(); c.preventDefault(); };
        el.addEventListener("click", engolir, { capture: true, once: true });
        setTimeout(() => el.removeEventListener("click", engolir, { capture: true }), 0);
      }
      const solto = el.classList.contains("solto");
      escritorioGuardarCaixa(el.id, { solto, x: solto ? Number(el.dataset.x) : undefined, y: solto ? Number(el.dataset.y) : undefined, w: parseFloat(el.style.getPropertyValue("--caixa-w")) || undefined, h: parseFloat(el.style.getPropertyValue("--caixa-h")) || undefined });
    };
    // Dois cliques no topo devolvem à coluna. Contados aqui: o primeiro
    // clique redesenha o topo (abre ou fecha) e o navegador não junta os dois.
    let ultimoClique = 0;
    el.addEventListener("click", (e) => {
      if (!e.target.closest?.(alca)) return;
      const agora = performance.now();
      if (el.classList.contains("solto") && agora - ultimoClique < 400) { ultimoClique = 0; encaixarCaixaEscritorio(id); return; }
      ultimoClique = agora;
    });
  }
}
// Volta para a coluna, no lugar dela e no tamanho padrão.
function encaixarCaixaEscritorio(id) {
  const el = document.getElementById(id);
  escritorioGuardarCaixa(id, null);
  if (!el) return;
  el.classList.remove("solto");
  Object.assign(el.style, { left: "", top: "", right: "", bottom: "", width: "" });
  el.style.removeProperty("--caixa-h"); el.style.removeProperty("--caixa-w");
}
function encaixarCaixasEscritorio() {
  for (const id of Object.keys(ESCRITORIO_CAIXAS)) encaixarCaixaEscritorio(id);
  escritorioAviso("As caixas voltaram para a coluna da direita.");
}
// Janela mudou de tamanho: caixa solta não fica fora da tela.
if (typeof window !== "undefined") window.addEventListener?.("resize", () => { for (const el of document.querySelectorAll(".ofc-caixa.solto")) escritorioPosicionarCaixa(el, Number(el.dataset.x), Number(el.dataset.y)); });
// Balão do dia na mesa do dono do quarto (Paulo, 22/10/2026: "a gente como
// Head tem muita dificuldade de saber o que o time fez no dia, deixou de
// fazer"). Todos veem o de todos. Passar o mouse mostra o resumo de hoje e
// de ontem; clicar abre o Dia da equipe, com a pessoa do quarto aberta.
function escritorioMarcarDia() {
  const m = escritorio.mapa;
  if (!m?.marcarDia) return;
  // Dono pelo mesmo cálculo das cobranças (vybe-escritorio-missoes.js); a mesa
  // fica no térreo do quarto.
  const dono = typeof escritorioDonoDoQuarto === "function" && escritorio.quarto === escritorioRaizQuarto(escritorio.quarto) ? escritorioDonoDoQuarto() : null;
  const pessoa = dono && (escritorio.base?.equipe || []).find((p) => String(p.id) === dono), a = pessoa && escritorioAmbienteDoQuarto(escritorio.quarto);
  // Lê do servidor (vale 2 minutos); quando chega, desenha de novo.
  if (a && typeof carregarDiaEscritorio === "function") carregarDiaEscritorio();
  const dia = a && typeof escritorioDiaDe === "function" ? escritorioDiaDe(pessoa) : null;
  const mesa = dia && escritorioMesaDoAmbiente(a, escritorioPerfilDecoracao(escritorio.quarto));
  if (!mesa) { m.marcarDia(); esconderDiaCardEscritorio(true); return; }
  const n = dia.nHoje, pend = dia.atrasadas.length;
  const nome = String(pessoa.nome || "").split(" ")[0];
  m.marcarDia(mesa.x, mesa.y, {
    texto: n.total ? `${n.feitas}/${n.total}` : "0", pct: n.total ? Math.round((n.feitas / n.total) * 100) : 0,
    completo: n.total > 0 && n.feitas === n.total, alerta: pend,
    rotulo: `Dia de ${nome}: ${n.feitas} de ${n.total} de hoje prontas${pend ? `, ${pend} ${pend === 1 ? "atrasada" : "atrasadas"}` : ""}. Clique para ver a equipe.`,
    aoPassar: (no) => mostrarDiaCardEscritorio(no, pessoa), aoSair: () => esconderDiaCardEscritorio(),
    aoClicar: () => abrirDiaEquipeEscritorio(pessoa.id),
  });
}
// Cartão do balão: preso em cima dele (não segue o mouse) e fica aberto
// enquanto o mouse estiver no balão ou no cartão.
function mostrarDiaCardEscritorio(no, pessoa) {
  const card = document.getElementById("office-dia-card");
  if (!card || !no || typeof escritorioDiaCartaoHtml !== "function") return;
  clearTimeout(escritorio.timerDiaCard);
  card.innerHTML = escritorioDiaCartaoHtml(pessoa);
  card.hidden = false;
  const caixa = card.parentElement.getBoundingClientRect(), r = no.getBoundingClientRect();
  const w = card.offsetWidth, h = card.offsetHeight;
  card.style.left = Math.max(8, Math.min(caixa.width - w - 8, r.left + r.width / 2 - caixa.left - w / 2)) + "px";
  const acima = r.top - caixa.top - h - 10;
  card.style.top = (acima >= 8 ? acima : Math.min(caixa.height - h - 8, r.bottom - caixa.top + 10)) + "px";
}
function esconderDiaCardEscritorio(agora = false) {
  const card = document.getElementById("office-dia-card");
  if (!card) return;
  clearTimeout(escritorio.timerDiaCard);
  if (agora) { card.hidden = true; return; }
  escritorio.timerDiaCard = setTimeout(() => { if (!card.matches(":hover") && !document.querySelector(".mapa-dia:hover")) card.hidden = true; }, 250);
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

// Uma aba conectada por pessoa (Paulo, 21/10/2026: "muita gente usa duas
// telas e fica conectado 2 vezes"). A aba conectada se anuncia no navegador
// (localStorage, renovado a cada 4 s, e BroadcastChannel); as outras não
// entram sozinhas. "Trazer para esta aba" pede para a outra sair e entra aqui.
const ESCRITORIO_ABA_ID = Math.random().toString(36).slice(2), ESCRITORIO_ABA_CHAVE = "vybe-escritorio-aba";
const escritorioCanalAba = typeof BroadcastChannel === "function" ? new BroadcastChannel("vybe-escritorio-aba") : null;
function escritorioAbaDona() { try { return JSON.parse(localStorage.getItem(ESCRITORIO_ABA_CHAVE) || "null"); } catch { return null; } }
function escritorioOutraAbaConectada() {
  const d = escritorioAbaDona();
  return Boolean(d && d.aba !== ESCRITORIO_ABA_ID && Date.now() - Number(d.em || 0) < 12000);
}
function escritorioAbaAssumir() {
  const marcar = () => { try { localStorage.setItem(ESCRITORIO_ABA_CHAVE, JSON.stringify({ aba: ESCRITORIO_ABA_ID, em: Date.now() })); } catch {} };
  marcar(); clearInterval(escritorio.timerAba); escritorio.timerAba = setInterval(marcar, 4000);
  escritorioCanalAba?.postMessage({ tipo: "conectou", aba: ESCRITORIO_ABA_ID });
}
function escritorioAbaSoltar() {
  clearInterval(escritorio.timerAba); escritorio.timerAba = null;
  if (escritorioAbaDona()?.aba === ESCRITORIO_ABA_ID) try { localStorage.removeItem(ESCRITORIO_ABA_CHAVE); } catch {}
  escritorioCanalAba?.postMessage({ tipo: "saiu", aba: ESCRITORIO_ABA_ID });
}
// Outra aba entrou: esta sai do mapa e da voz, sem esquecer que a pessoa
// quer estar dentro (a outra aba é quem fica).
function escritorioSoltarParaOutraAba() {
  if (!escritorio.conectado && !escritorio.conectando) return;
  if (escritorio.chamada) sairChamadaEscritorio();
  desconectarEscritorio(false);
  escritorio.querConectado = false; escritorio.emOutraAba = true;
  renderEscritorio(); atualizarDockEscritorio();
}
function trazerEscritorioParaEstaAba() {
  escritorioCanalAba?.postMessage({ tipo: "assumir", aba: ESCRITORIO_ABA_ID });
  try { localStorage.removeItem(ESCRITORIO_ABA_CHAVE); } catch {}
  escritorio.assumindoAba = true;
  if (typeof activeBoard !== "undefined" && activeBoard !== "escritorio") voltarAoEscritorio();
  // Um instante para a outra aba sair da conversa antes desta entrar.
  setTimeout(() => conectarEscritorio(), 700);
}
if (escritorioCanalAba) escritorioCanalAba.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.aba === ESCRITORIO_ABA_ID) return;
  if (m.tipo === "assumir" || m.tipo === "conectou") escritorioSoltarParaOutraAba();
  if (m.tipo === "saiu" || m.tipo === "conectou") { renderEscritorio(); atualizarDockEscritorio(); }
};
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("pagehide", () => { if (escritorio.conectado) escritorioAbaSoltar(); });

// Quem estava dentro e caiu (rede, computador dormiu, aba muito tempo no
// fundo) volta sozinho ao reabrir a aba ou quando a internet volta.
function escritorioVoltarSeQueria() {
  let queria = escritorio.querConectado;
  try { queria ||= localStorage.getItem("vybe-escritorio-dentro") === "1"; } catch {}
  if (!queria || escritorio.conectado || escritorio.conectando || !escritorio.base || escritorio.base.demo || escritorioOutraAbaConectada()) return;
  if (document.visibilityState !== "visible" || navigator.onLine === false) return;
  conectarEscritorio();
}
if (typeof document !== "undefined" && document.addEventListener && typeof setInterval === "function") {
  document.addEventListener("visibilitychange", escritorioVoltarSeQueria);
  if (typeof window !== "undefined") window.addEventListener?.("online", escritorioVoltarSeQueria);
  setInterval(escritorioVoltarSeQueria, 60000);
}

// Recado global (decisão do Paulo, 21/10/2026): quem está liberado no servidor
// (Paulo, Vinícius, Ewerton e Deivid) manda pelo menu "Mais"; o recado aparece
// no meio da tela de todos — inclusive de quem mandou, para conferir — com
// "Conferir" (leva aonde ele aponta) e "Ignorar". Regras e liberação em
// server/escritorio-avisos.js. O painel procura recado novo a cada minuto.
const ESCRITORIO_DESTINOS_AVISO = {
  "": { rotulo: "Só o recado", acao: null },
  reforma: { rotulo: "Reformar o quarto", acao: () => { personalizarEscritorio(); setTimeout(() => abrirReformaEscritorio(0), 60); } },
  loja: { rotulo: "Abrir a loja", acao: () => abrirCatalogoEscritorio("loja") },
  ranking: { rotulo: "Ver o ranking", acao: () => abrirRankingEscritorio("geral", "semana") },
  conquistas: { rotulo: "Ver as conquistas", acao: () => abrirConquistasEscritorio() },
  missoes: { rotulo: "Ver as missões", acao: () => abrirMissoesPeloLobbyEscritorio() },
  provador: { rotulo: "Abrir o provador", acao: () => { personalizarEscritorio(); setTimeout(() => { criador.etapa = "personagem"; renderAberturaEscritorio(); }, 60); } },
};
const ESCRITORIO_ESTILOS_AVISO = { padrao: { nome: "Vybe", arte: "ads_idol_mic" }, obra: { nome: "Obra", arte: "bc_cone_recolorable" }, festa: { nome: "Festa", arte: "prizetrophy" } };
function iniciarAvisosEscritorio() {
  if (escritorio.timerAvisos || typeof setInterval !== "function" || typeof document === "undefined") return;
  // O balão do dia acompanha as demandas (que o painel atualiza sozinho).
  const buscar = () => { if (document.hidden) return; escritorioMarcarDia(); if (escritorio.base && !escritorio.base.demo) verificarAvisosEscritorio(); };
  buscar();
  escritorio.timerAvisos = setInterval(buscar, 60e3);
}
async function verificarAvisosEscritorio() {
  try {
    const r = await escritorioApi("avisos");
    escritorio.podeAvisar = Boolean(r.pode);
    const vistos = (escritorio.avisosMostrados ||= new Set());
    const novo = (r.avisos || []).find((a) => !vistos.has(a.id));
    if (novo && !document.getElementById("ofc-aviso-global")) mostrarAvisoEscritorio(novo);
  } catch {}
}
function escritorioAvisoCartaoHtml(a, { previa = false } = {}) {
  const estilo = ESCRITORIO_ESTILOS_AVISO[a.estilo] || ESCRITORIO_ESTILOS_AVISO.padrao, destino = ESCRITORIO_DESTINOS_AVISO[a.destino] || ESCRITORIO_DESTINOS_AVISO[""];
  const autor = safeText(String(a.autor?.nome || "").split(" ")[0] || "Vybe");
  const cabeca = typeof escritorioCabecaUrl === "function" && a.autor?.id ? escritorioCabecaUrl(a.autor.id) : "";
  const vitrine = a.destino === "reforma" ? escritorioVitrineHtml("aviso-vitrine", escritorio.base?.eu, { planta: "quadrado-max", zoom: 0, desce: 0 })
    : `<span class="aviso-arte">${typeof escritorioMiniaturaHtml === "function" ? escritorioMiniaturaHtml({ loja: "val_c21_cashier", ranking: "trophy_fball_c26_wingedgold", conquistas: "prizetrophy", missoes: "exe_map", provador: "art_c20_clotheshanger" }[a.destino] || estilo.arte) : ""}</span>`;
  return `<div class="aviso-cartao estilo-${safeText(a.estilo || "padrao")}" role="${previa ? "group" : "alertdialog"}" aria-labelledby="aviso-titulo${previa ? "-previa" : ""}">
  <div class="aviso-topo"><span class="aviso-selo">${typeof escritorioMiniaturaHtml === "function" ? escritorioMiniaturaHtml(estilo.arte) : ""}</span><span class="aviso-de">${cabeca ? `<img src="${safeText(cabeca)}" alt="">` : ""}Recado de <b>${autor}</b> para todos</span></div>
  <div class="aviso-palco">${vitrine}<span class="aviso-faiscas" aria-hidden="true">${"<i></i>".repeat(12)}</span></div>
  <h2 id="aviso-titulo${previa ? "-previa" : ""}">${safeText(a.titulo || "Título do recado")}</h2>
  <p>${safeText(a.texto || "A mensagem aparece aqui.").replace(/\n/g, "<br>")}</p>
  <div class="aviso-acoes">${previa ? `<span class="aviso-ignorar">Ignorar</span><span class="vb-jogo-botao aviso-conferir">${destino.acao ? safeText(destino.rotulo) : "Entendi"}</span>` : `<button type="button" class="aviso-ignorar" onclick="responderAvisoEscritorio('ignorou')">Ignorar</button><button type="button" class="vb-jogo-botao aviso-conferir" onclick="responderAvisoEscritorio('conferiu')">${destino.acao ? safeText(destino.rotulo) : "Entendi"}</button>`}</div>
</div>`;
}
function mostrarAvisoEscritorio(a) {
  escritorio.avisosMostrados?.add(a.id);
  escritorio.avisoAberto = a;
  const el = document.createElement("div");
  el.id = "ofc-aviso-global";
  el.className = "ofc-aviso-global";
  el.innerHTML = `<div class="aviso-fundo" aria-hidden="true"></div>${escritorioAvisoCartaoHtml(a)}`;
  document.body.append(el);
  escritorioMontarVitrines(el);
  el.querySelector(".aviso-conferir")?.focus({ preventScroll: true });
  el.addEventListener("keydown", (e) => { if (e.key === "Escape") responderAvisoEscritorio("ignorou"); });
}
async function responderAvisoEscritorio(resposta) {
  const a = escritorio.avisoAberto, el = document.getElementById("ofc-aviso-global");
  escritorio.avisoAberto = null;
  if (el) { el.classList.add("saindo"); setTimeout(() => el.remove(), 320); }
  if (!a) return;
  if (resposta === "conferiu") try { ESCRITORIO_DESTINOS_AVISO[a.destino]?.acao?.(); } catch {}
  try { await escritorioApi("aviso-visto", { id: a.id, resposta }); } catch {}
}
function abrirMandarAvisoEscritorio() {
  document.getElementById("ofc-aviso-novo")?.remove();
  const el = document.createElement("dialog");
  el.id = "ofc-aviso-novo";
  el.className = "ofc-aviso-novo";
  const opcoes = (obj, nome) => Object.entries(obj).map(([k, v]) => `<option value="${k}">${safeText(v[nome])}</option>`).join("");
  el.innerHTML = `<form class="aviso-form" onsubmit="event.preventDefault();enviarAvisoEscritorio(this)" oninput="previaAvisoEscritorio(this)">
  <div class="aviso-form-campos"><div class="aviso-form-topo"><b>Recado para todos</b><button type="button" class="ofc-x" onclick="this.closest('dialog').close()" aria-label="Fechar">×</button></div>
   <label>Título<input name="titulo" maxlength="80" required minlength="3" placeholder="Ex.: Chegou emenda de Bacelar!"></label>
   <label>Mensagem<textarea name="texto" maxlength="400" required minlength="3" rows="4" placeholder="O que todo mundo precisa saber"></textarea></label>
   <label>Leva para<select name="destino">${opcoes(ESCRITORIO_DESTINOS_AVISO, "rotulo")}</select></label>
   <label>Estilo<select name="estilo">${opcoes(ESCRITORIO_ESTILOS_AVISO, "nome")}</select></label>
   <p class="aviso-form-nota">Aparece no meio da tela de toda a equipe (e na sua), uma vez para cada um, por 7 dias.</p>
   <p class="ofc-nota" role="alert" id="aviso-form-erro"></p>
   <button type="submit" class="vb-jogo-botao">Mandar para todos</button></div>
  <div class="aviso-form-previa" id="aviso-form-previa" aria-label="Prévia"></div>
 </form>`;
  document.body.append(el);
  el.addEventListener("close", () => el.remove());
  el.showModal();
  previaAvisoEscritorio(el.querySelector("form"));
}
function previaAvisoEscritorio(form) {
  const alvo = document.getElementById("aviso-form-previa");
  if (!alvo || !form) return;
  const d = Object.fromEntries(new FormData(form));
  const chave = d.destino + "|" + d.estilo;
  const eu = escritorio.base?.equipe?.find((p) => String(p.id) === String(escritorio.base?.eu));
  alvo.innerHTML = escritorioAvisoCartaoHtml({ ...d, autor: { id: escritorio.base?.eu, nome: eu?.nome || "" } }, { previa: true });
  alvo.dataset.chave = chave;
  escritorioMontarVitrines(alvo);
}
async function enviarAvisoEscritorio(form) {
  const erro = document.getElementById("aviso-form-erro"), botao = form.querySelector("[type=submit]");
  const d = Object.fromEntries(new FormData(form));
  form.dataset.chave ||= "aviso-" + Math.random().toString(36).slice(2, 12);
  botao.disabled = true; erro.textContent = "";
  try {
    await escritorioApi("aviso", { ...d, chave: form.dataset.chave });
    form.closest("dialog")?.close();
    escritorioAviso?.("Recado mandado para todos.");
    verificarAvisosEscritorio();
  } catch (e) { erro.textContent = e.message; botao.disabled = false; }
}
