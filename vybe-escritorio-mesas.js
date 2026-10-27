// Partida nas mesas de jogo do Escritório (dominó, pôquer…; pedido do Paulo,
// 27/10/2026). O convite e a aposta são as telas do xadrez com a configuração
// de cada jogo (vybe-escritorio-xadrez.js); aqui fica o que toda partida de
// mesa tem igual: reler a cada 4 s, os dois jogadores, o resultado, o empate
// combinado, a desistência, a vitória por tempo e o aviso pelo balão. Cada
// jogo registra a sua configuração com `desenhar(j)`, que devolve a mesa e o
// que vai no painel, e chama `lanceMesaEscritorio(chave, pedido)` para jogar.
const ESCRITORIO_MESAS = {};

// Sons dos jogos (Kenney, CC0; assets/jogos/sons): carta, embaralhar,
// fichas, ficha, peça, peça2, taco, bola, tabela e caçapa. Carregados uma vez
// pelo Web Audio; onde o navegador não toca OGG, fica o bipe de antes. Respeita
// o som desligado do escritório.
const JOGOS_SONS = {};
let jogosAudio = null;
function jogosSom(nome, volume = 0.7) {
  if (!nome || (typeof escritorioSomLigado === "function" && !escritorioSomLigado())) return;
  try {
    jogosAudio ||= new (window.AudioContext || window.webkitAudioContext)();
    const tocar = (buf) => {
      const fonte = jogosAudio.createBufferSource(), ganho = jogosAudio.createGain();
      ganho.gain.value = Math.max(0, Math.min(1, volume));
      fonte.buffer = buf; fonte.connect(ganho).connect(jogosAudio.destination); fonte.start();
    };
    const atual = JOGOS_SONS[nome];
    if (atual === false) return escritorioTocar(520, 0.05, 0.04);
    if (atual && !(atual instanceof Promise)) return tocar(atual);
    (JOGOS_SONS[nome] ||= fetch(`/assets/jogos/sons/${nome}.ogg`).then((r) => r.arrayBuffer()).then((a) => jogosAudio.decodeAudioData(a))
      .then((b) => (JOGOS_SONS[nome] = b)).catch(() => (JOGOS_SONS[nome] = false))).then((b) => b && tocar(b));
  } catch { escritorioTocar(520, 0.05, 0.04); }
}

function registrarMesaEscritorio(cfg) {
  cfg.lista = "mesa"; cfg.desafiar = "mesa-desafiar"; cfg.responder = "mesa-responder";
  cfg.abrir = (j) => abrirJogoMesa(cfg.sinal, j);
  cfg.aberto = (id) => (escritorioMesa(cfg.sinal).jogo?.id === id ? (recarregarJogoMesa(cfg.sinal), true) : false);
  ESCRITORIO_MESAS[cfg.sinal] = cfg;
  return cfg;
}
// Móveis que abrem um jogo com a equipe (a Loja os destaca e o cartão ganha a
// etiqueta "Jogo"): o nome do jogo, ou null.
function escritorioJogoDoMovel(classe) {
  const c = String(classe || "");
  return ESCRITORIO_XADREZ.test(c) ? "Xadrez" : ESCRITORIO_DOMINO.test(c) ? "Dominó, dama, velha e truco" : ESCRITORIO_POKER.test(c) ? "Pôquer" : ESCRITORIO_SINUCA.test(c) ? "Sinuca" : null;
}
function escritorioMesa(chave) {
  return ((escritorio.mesas ||= {})[chave] ||= { jogo: null, sel: null, timer: null });
}
function mesaOutro(lado) {
  return lado === "desafiante" ? "desafiado" : "desafiante";
}
// Os outros da mesa (no pôquer em grupo, dois ou três), para o aviso pelo balão.
function mesaOutrosIds(j) {
  const eu = String(escritorio.base?.eu);
  return (j.jogadores || [j.desafiante, j.desafiado]).map((p) => String(p.id)).filter((id) => id !== eu);
}
function mesaSinalTodos(cfg, j, tipo) {
  for (const id of mesaOutrosIds(j)) mesaSinal(cfg, j.id, id, tipo);
}

function abrirJogoMesa(chave, j) {
  const s = escritorioMesa(chave);
  s.jogo = j; s.sel = null;
  escritorioXadrez().nova = null;
  desenharJogoMesa(chave);
  clearInterval(s.timer);
  s.timer = setInterval(() => {
    if (!document.querySelector(`#workflow-modal.ofc-${chave}-jogo`)) { clearInterval(s.timer); s.timer = null; s.jogo = null; return; }
    if (s.jogo?.estado === "jogando" && !document.hidden) recarregarJogoMesa(chave);
  }, 4000);
}
function mesaFechar(chave) {
  const s = escritorioMesa(chave);
  clearInterval(s.timer);
  s.timer = null; s.jogo = null; s.sel = null;
  xadrezFechar();
}
async function recarregarJogoMesa(chave) {
  const s = escritorioMesa(chave), j = s.jogo;
  if (!j || s.carregando) return;
  s.carregando = true;
  try {
    const r = await escritorioApi("mesa", null, { id: j.id });
    if (s.jogo?.id !== j.id) return;
    const mudou = r.jogo.n !== j.n || r.jogo.estado !== j.estado || r.jogo.empate_de !== j.empate_de || r.jogo.pode_reivindicar !== j.pode_reivindicar;
    s.jogo = r.jogo;
    if (mudou) {
      if (r.jogo.n !== j.n) { s.sel = null; jogosSom(ESCRITORIO_MESAS[chave].som ? ESCRITORIO_MESAS[chave].som(r.jogo, j) : "peca"); }
      if (r.jogo.estado === "fim" && j.estado !== "fim") xadrezAcabou(r.jogo);
      desenharJogoMesa(chave);
    }
  } catch { /* tenta de novo no próximo ciclo */ } finally { s.carregando = false; }
}

// Jogada do jogo (o pedido é do motor do servidor: peça, aposta, tacada…).
async function lanceMesaEscritorio(chave, pedido, botao) {
  const s = escritorioMesa(chave), j = s.jogo;
  if (!j || s.enviando) return;
  s.enviando = true;
  if (botao) botao.disabled = true;
  try {
    const r = await escritorioApi("mesa-lance", { id: j.id, n: j.n, ...pedido });
    s.jogo = r.jogo; s.sel = null;
    if (r.economia) xadrezEconomia(r.economia);
    jogosSom(ESCRITORIO_MESAS[chave].som ? ESCRITORIO_MESAS[chave].som(r.jogo, j) : "peca");
    mesaSinalTodos(ESCRITORIO_MESAS[chave], j, "l");
    if (r.jogo.estado === "fim") xadrezAcabou(r.jogo);
  } catch (e) {
    s.sel = null;
    escritorioAviso(e.message);
    recarregarJogoMesa(chave);
  } finally { s.enviando = false; }
  desenharJogoMesa(chave);
}
function desistirMesa(chave, botao) {
  if (botao.dataset.certeza !== "1") { const antes = botao.textContent; botao.dataset.certeza = "1"; botao.textContent = "Desistir mesmo?"; setTimeout(() => { if (botao.isConnected) { botao.dataset.certeza = ""; botao.textContent = antes; } }, 4000); return; }
  acaoMesaEscritorio(chave, "desistir", botao);
}
async function acaoMesaEscritorio(chave, acao, botao) {
  const s = escritorioMesa(chave), j = s.jogo;
  if (!j) return;
  if (botao) botao.disabled = true;
  try {
    const r = await escritorioApi("mesa-acao", { id: j.id, acao });
    s.jogo = r.jogo;
    if (r.economia) xadrezEconomia(r.economia);
    mesaSinalTodos(ESCRITORIO_MESAS[chave], j, "l");
    if (r.jogo.estado === "fim") xadrezAcabou(r.jogo);
    desenharJogoMesa(chave);
  } catch (e) {
    if (botao) botao.disabled = false;
    const el = document.getElementById("xdz-erro");
    if (el) el.textContent = e.message;
  }
}

// Arrastar a peça no tabuleiro (xadrez e dama), no jeito do lichess e do
// chess.com: segura a peça, arrasta e solta na casa (as casas possíveis acendem
// ao começar a arrastar); clicar na peça e depois na casa continua valendo.
// `selecionar(casa)` marca a peça; `soltar(casa)` joga nela (ou só escolhe outra).
function tabuleiroArrastar(ev, casa, selecionar, soltar) {
  if (ev.button > 0) return;
  const peca = ev.currentTarget.querySelector("svg,.dam-peca");
  if (!peca) return;
  const x0 = ev.clientX, y0 = ev.clientY;
  let fantasma = null;
  const mover = (e) => {
    if (!fantasma) {
      if (Math.hypot(e.clientX - x0, e.clientY - y0) < 6) return;
      const r = peca.getBoundingClientRect();
      fantasma = peca.cloneNode(true);
      fantasma.classList.add("tab-fantasma");
      Object.assign(fantasma.style, { width: r.width + "px", height: r.height + "px" });
      document.body.append(fantasma);
      selecionar(casa);
    }
    fantasma.style.transform = `translate(${e.clientX - fantasma.offsetWidth / 2}px,${e.clientY - fantasma.offsetHeight / 2}px)`;
  };
  const fim = (e) => {
    document.removeEventListener("pointermove", mover);
    document.removeEventListener("pointerup", fim);
    if (!fantasma) return;
    fantasma.remove();
    const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-casa]");
    if (alvo && alvo.dataset.casa !== String(casa)) soltar(alvo.dataset.casa);
    // O clique que o navegador manda logo depois de soltar não é um clique na casa.
    const engole = (c) => { c.stopPropagation(); c.preventDefault(); };
    document.addEventListener("click", engole, true);
    setTimeout(() => document.removeEventListener("click", engole, true), 60);
  };
  document.addEventListener("pointermove", mover);
  document.addEventListener("pointerup", fim);
}

// Barra de quem joga: cabeça, nome, de quem é a vez e um detalhe do jogo
// (peças na mão, fichas…).
function mesaJogadorHtml(j, lado, detalhe) {
  const p = j[lado], u = mesaCabecaUrl(j, p), vez = j.estado === "jogando" && j.vez === lado, eu = j.eu === lado;
  return `<div class="xdz-jogador mesa-jogador${vez ? " vez" : ""}">${u ? `<img src="${safeText(u)}" alt="" width="36" height="36">` : "<i></i>"}<b>${xadrezPrimeiroNome(p)}${eu ? " (você)" : ""}</b><small>${vez ? (eu ? "Sua vez" : "Pensando…") : detalhe}</small>${vez ? mesaPrazoVezHtml(j) : ""}</div>`;
}
// Relógio da vez (tempo de cada jogada, como nos jogos online): anel que
// esvazia e os segundos; nos últimos 10 fica vermelho.
function mesaPrazoVezHtml(j) {
  if (!j.prazo_vez || j.estado !== "jogando") return "";
  return `<span class="vez-prazo" data-ate="${new Date(j.prazo_vez).getTime()}" data-total="${j.tempo_vez || 30}" role="timer" aria-label="Tempo da vez"><i></i><b></b></span>`;
}
setInterval(() => {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll(".vez-prazo[data-ate]")) {
    const ms = Number(el.dataset.ate) - Date.now(), s = Math.max(0, Math.ceil(ms / 1000));
    el.style.setProperty("--p", String(Math.max(0, Math.min(1, ms / (Number(el.dataset.total) * 1000)))));
    el.querySelector("b").textContent = String(s);
    const pouco = s <= 10;
    el.classList.toggle("pouco", pouco);
  }
}, 250);
// Moldura da partida: a mesa à esquerda (cima = a outra pessoa, baixo = eu) e
// o painel com resultado, status, aposta, o que o jogo quiser e as ações.
function desenharJogoMesa(chave) {
  const s = escritorioMesa(chave), j = s.jogo, cfg = ESCRITORIO_MESAS[chave];
  if (!j) return;
  const { mesa, status, painel = "" } = cfg.desenhar(j, s);
  const jogando = j.estado === "jogando", eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const empateMeu = j.empate_de && j.empate_de === String(escritorio.base?.eu), empateDele = j.empate_de && !empateMeu;
  // Em grupo não tem empate combinado, e quem sumiu na vez sai da mesa (os outros seguem).
  const saiu = (j.mesa?.saiu || []).includes(eu), sumiu = j.grupo ? j[j.vez] : j[outro];
  const acoes = !jogando || !eu || saiu ? "" : j.grupo ? `<div class="xdz-acoes">
${j.pode_reivindicar ? `<button type="button" class="workflow-primary" onclick="acaoMesaEscritorio('${chave}','reivindicar',this)">${xadrezPrimeiroNome(sumiu)} sumiu: tirar da mesa</button>` : ""}
<button type="button" class="workflow-secondary xdz-desistir" onclick="desistirMesa('${chave}',this)">Desistir</button></div>` : `<div class="xdz-acoes">
${empateDele ? `<div class="xdz-empate"><span>${xadrezPrimeiroNome(j[outro])} propôs empate.</span><button type="button" class="workflow-primary" onclick="acaoMesaEscritorio('${chave}','aceitar-empate',this)">Aceitar</button><button type="button" class="workflow-secondary" onclick="acaoMesaEscritorio('${chave}','recusar-empate',this)">Recusar</button></div>` : ""}
${j.pode_reivindicar ? `<button type="button" class="workflow-primary" onclick="acaoMesaEscritorio('${chave}','reivindicar',this)">${xadrezPrimeiroNome(j[outro])} sumiu: ganhar por tempo</button>` : ""}
<button type="button" class="workflow-secondary" onclick="acaoMesaEscritorio('${chave}','empate',this)" ${j.empate_de ? "disabled" : ""}>${empateMeu ? "Empate proposto" : "Propor empate"}</button>
<button type="button" class="workflow-secondary xdz-desistir" onclick="desistirMesa('${chave}',this)">Desistir</button></div>`;
  // HUD de jogo (Paulo, 27/10/2026: "modernizar toda a interface ao redor do
  // jogo"): faixa no tema do jogo com selos de aposta e placar e botões de
  // ícone; a mesa no palco com a pílula de status por cima; os avisos (empate
  // proposto, quem sumiu) numa barra; o histórico discreto embaixo; e o fim da
  // partida numa tela de vitória/derrota por cima da mesa.
  const sair = !jogando || !eu || saiu ? "" : `${j.grupo || j.bot ? "" : `<button type="button" class="jogo-icone" onclick="acaoMesaEscritorio('${chave}','empate',this)" ${j.empate_de ? "disabled" : ""} title="${empateMeu ? "Empate proposto" : "Propor empate"}" aria-label="${empateMeu ? "Empate proposto" : "Propor empate"}">🤝</button>`}
<button type="button" class="jogo-icone perigo" onclick="desistirMesa('${chave}',this)" title="Desistir" aria-label="Desistir">⚑</button>`;
  const alerta = !jogando || !eu || saiu ? "" : [
    empateDele && !j.grupo ? `<div class="jogo-alerta"><span>🤝 ${xadrezPrimeiroNome(j[outro])} propôs empate.</span><button type="button" class="sala-botao verde" onclick="acaoMesaEscritorio('${chave}','aceitar-empate',this)">Aceitar</button><button type="button" class="sala-botao cinza" onclick="acaoMesaEscritorio('${chave}','recusar-empate',this)">Recusar</button></div>` : "",
    j.pode_reivindicar ? `<div class="jogo-alerta"><span>⏰ ${xadrezPrimeiroNome(sumiu)} sumiu.</span><button type="button" class="sala-botao laranja" onclick="acaoMesaEscritorio('${chave}','reivindicar',this)">${j.grupo ? "Tirar da mesa" : "Ganhar por tempo"}</button></div>` : "",
  ].join("");
  xadrezModal(`${jogoTopoHtml(cfg.extra?.jogo || chave, cfg.nome, !eu, jogoSelosHtml(j), sair, `mesaFechar('${chave}')`)}${alerta}
<div class="jogo-palco">${status && jogando ? `<p class="jogo-status${eu && j.vez === eu ? " minha" : ""}" aria-live="polite">${status}</p>` : ""}${mesa}
${!jogando ? jogoFimHtml(j, mesaFimAcoesHtml(chave, j, `mesaFechar('${chave}')`)) : ""}</div>
<p class="ofc-erro" id="xdz-erro" role="alert"></p>${painel ? `<div class="jogo-feed">${painel}</div>` : ""}`, `ofc-${chave}-jogo`);
  mesaAcionarBot(chave);
}

// Cabeça de quem joga; o bot (Desafios) aparece com o emoji dele num círculo.
function mesaCabecaUrl(j, p) {
  if (p?.id === "bot" && j?.bot) return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#2a3040"/><text x="32" y="44" font-size="34" text-anchor="middle">${j.bot.avatar}</text></svg>`);
  return escritorioCabecaUrl(p?.id);
}
// Contra bot (Desafios): na vez dele, a tela pede a jogada com o ritmo de quem
// pensa (na sinuca, depois da animação da tacada); o servidor joga sozinho se a
// tela fechar.
function mesaAcionarBot(chave) {
  const s = escritorioMesa(chave), j = s.jogo;
  clearTimeout(s.botTimer);
  if (!j?.bot || j.estado !== "jogando" || j.vez !== "desafiado") return;
  s.botTimer = setTimeout(async () => {
    const atual = escritorioMesa(chave);
    if (atual.jogo?.id !== j.id || atual.jogo.n !== j.n) return;
    if (atual.anim) return mesaAcionarBot(chave);
    try {
      const r = await escritorioApi("mesa-bot-vez", { id: j.id, n: j.n });
      if (escritorioMesa(chave).jogo?.id !== j.id) return;
      const antes = atual.jogo;
      atual.jogo = r.jogo;
      if (r.jogo.n !== antes.n) jogosSom(ESCRITORIO_MESAS[chave].som ? ESCRITORIO_MESAS[chave].som(r.jogo, antes) : "peca");
      if (r.jogo.estado === "fim") xadrezAcabou(r.jogo);
      desenharJogoMesa(chave);
    } catch { setTimeout(() => recarregarJogoMesa(chave), 1500); }
  }, chave === "pkr" || chave === "trc" ? 1400 : 1000);
}

// --- HUD comum dos jogos -------------------------------------------------
const JOGO_ICONES = { xadrez: "♞", poker: "♠", sinuca: "🎱", domino: "⚃", dama: "⛂", velha: "#", truco: "♣" };
function jogoTopoHtml(jogo, nome, assistindo, selos, botoes, fechar) {
  return `<div class="jogo-topo tema-${safeText(jogo)}"><div class="jogo-titulo"><i aria-hidden="true">${JOGO_ICONES[jogo] || "🎲"}</i><b>${safeText(nome)}</b>${assistindo ? '<em class="sala-aovivo">Assistindo</em>' : ""}</div>
<div class="jogo-selos">${selos}</div><div class="jogo-botoes">${botoes}
<button type="button" class="jogo-icone" onclick="alternarSomEscritorio();this.textContent=escritorioSomLigado()?'🔊':'🔇'" title="Som" aria-label="Ligar ou desligar o som">${escritorioSomLigado() ? "🔊" : "🔇"}</button>
<button type="button" class="jogo-icone" onclick="${fechar}" title="Fechar" aria-label="Fechar">✕</button></div></div>`;
}
// Selos da faixa: o que está em jogo e o placar entre os dois.
function jogoSelosHtml(j) {
  const n = j.jogadores?.length || 2, itens = (j.itens?.desafiante?.length || 0) + (j.itens?.desafiado?.length || 0);
  if (j.bot) return `<span class="jogo-selo ${j.bot.nivel === "lendario" ? "lendario" : ""}">⚔️ Desafio · ${{ facil: "Fácil", medio: "Médio", lendario: "Lendário" }[j.bot.nivel]}</span><span class="jogo-selo ouro">+${j.bot.premio.moedas} 🪙 se vencer</span>`;
  const aposta = j.moedas ? `<span class="jogo-selo ouro">🪙 ${(n * j.moedas).toLocaleString("pt-BR")} na mesa${itens ? " + itens" : ""}</span>` : itens ? '<span class="jogo-selo ouro">🎁 Itens na mesa</span>' : '<span class="jogo-selo">Amistoso</span>';
  const p = j.placar, a = j.desafiante, b = j.desafiado;
  const placar = p && (p[String(a.id)] || p[String(b.id)] || p.empates) ? `<span class="jogo-selo">🏆 ${xadrezPrimeiroNome(a)} ${p[String(a.id)] || 0} × ${p[String(b.id)] || 0} ${xadrezPrimeiroNome(b)}</span>` : "";
  return aposta + placar;
}
// Fim da partida por cima da mesa: vitória, derrota ou empate, o motivo, o prêmio e as ações.
function jogoFimHtml(j, acoes) {
  if (j.estado !== "fim") return "";
  const ganhou = j.resultado !== "empate" && j.eu && j.eu === j.resultado, perdeu = j.resultado !== "empate" && j.eu && j.eu !== j.resultado;
  const vencedor = j.resultado === "empate" ? null : xadrezPrimeiroNome(j[j.resultado]);
  const titulo = j.resultado === "empate" ? "Empate" : ganhou ? "Vitória!" : perdeu ? "Derrota" : `${vencedor} venceu`;
  const n = j.jogadores?.length || 2, valendo = j.moedas || j.itens?.desafiante?.length || j.itens?.desafiado?.length;
  const pb = j.premio_bot;
  const premio = j.bot ? (ganhou ? (pb?.moedas ? `+${pb.moedas} VybeCoins e +${pb.xp} XP${pb.teto ? " (teto de hoje)" : ""}` : "Você já bateu o teto de prêmios de bots de hoje.") : "") : !valendo ? "" : j.resultado === "empate" ? "Cada um recebeu a aposta de volta." : ganhou ? `+${(n * (j.moedas || 0)).toLocaleString("pt-BR")} VybeCoins${j.itens?.desafiante?.length || j.itens?.desafiado?.length ? " e os itens" : ""}` : `${vencedor} levou a mesa.`;
  return `<div class="jogo-fim ${ganhou ? "ganhou" : perdeu ? "perdeu" : "empate"}"><div class="jogo-fim-caixa xdz-fim"><small>${safeText(j.motivo_nome || "Fim de jogo")}</small><b>${titulo}</b>${premio ? `<span>${safeText(premio)}</span>` : ""}${acoes}</div></div>`;
}

// Placar dos dois neste jogo, de todas as partidas que já terminaram.
function mesaPlacarHtml(j) {
  const p = j.placar;
  if (!p) return "";
  const a = j.desafiante, b = j.desafiado, va = p[String(a.id)] || 0, vb = p[String(b.id)] || 0;
  if (!va && !vb && !p.empates) return "";
  return `<p class="mesa-placar"><span>Placar de vocês</span><b>${xadrezPrimeiroNome(a)} ${va} × ${vb} ${xadrezPrimeiroNome(b)}</b>${p.empates ? `<small>${p.empates} ${p.empates === 1 ? "empate" : "empates"}</small>` : ""}</p>`;
}
// Fim da partida: revanche (quem jogou) e fechar.
function mesaFimAcoesHtml(chave, j, fechar) {
  const revanche = j.bot && j.eu ? `<button type="button" class="workflow-secondary" onclick="desafiarBotEscritorio('${safeText(j.bot.id)}',this)">Jogar de novo</button>`
    : j.eu ? `<button type="button" class="workflow-secondary" onclick="revancheEscritorio('${chave}',this)">Revanche</button>` : "";
  return `<div class="workflow-actions">${revanche}<button type="button" class="workflow-primary" onclick="${fechar}">Fechar</button></div>`;
}
// Revanche: chama a mesma pessoa para a mesma mesa, valendo as mesmas
// VybeCoins. Os itens da aposta já mudaram de dono, então não se repetem.
async function revancheEscritorio(chave, botao) {
  const cfg = chave === "xdz" ? XADREZ_CFG : ESCRITORIO_MESAS[chave];
  const j = chave === "xdz" ? escritorioXadrez().jogo : escritorioMesa(chave).jogo;
  if (!cfg || !j?.eu) return;
  const outros = mesaOutrosIds(j), outro = (j.jogadores || [j.desafiante, j.desafiado]).find((p) => String(p.id) === outros[0]);
  botao.disabled = true;
  try {
    // Em grupo, a revanche chama a mesa toda de novo.
    const r = await escritorioApi(cfg.desafiar, { ...cfg.extra, para: outros[0], ...(outros.length > 1 ? { mais: outros.slice(1) } : {}), camada: j.camada, movel: j.movel, moedas: j.moedas || 0, oferece: [], pede: [], chave: xadrezChave() });
    for (const id of outros) mesaSinal(cfg, r.id, id, "c");
    const x = escritorioXadrez();
    x.esperando = cfg.sinal + ":" + r.id; x.mesa = { camada: j.camada, movel: j.movel }; x.cfg = cfg;
    botao.textContent = "Revanche enviada";
    escritorioAviso(outros.length > 1 ? "Revanche enviada para a mesa. A partida abre quando todos aceitarem." : `Revanche enviada para ${String(outro?.nome || "a pessoa").split(" ")[0]}. A partida abre quando aceitar.`);
  } catch (e) {
    botao.disabled = false;
    const el = document.getElementById("xdz-erro");
    if (el) el.textContent = e.message;
  }
}

// Placas em cima das mesas com partida nesta cena (quem passa sabe que pode
// assistir) e aviso dos convites que chegaram enquanto a pessoa não estava no
// escritório. Relê a cada 20 s, logo que a cena muda e quando chega aviso de jogo.
const MESAS_NOMES = { xadrez: "Xadrez", domino: "Dominó", poker: "Pôquer", sinuca: "Sinuca", dama: "Dama", velha: "Velha", truco: "Truco" };
function escritorioResumoJogos(agora) {
  if (typeof escritorio === "undefined" || !escritorio.mapa?.marcador || !escritorio.base || escritorio.base.demo || document.hidden) return;
  const r = (escritorio.resumoJogos ||= { cena: null, em: 0, placas: new Set(), avisados: new Set() });
  const cena = escritorio.quarto || "praca";
  if (!agora && cena === r.cena && Date.now() - r.em < 20000) return;
  r.cena = cena; r.em = Date.now();
  escritorioApi("jogos-resumo", null, { camada: cena }).then((d) => {
    if ((escritorio.quarto || "praca") !== cena || !escritorio.mapa) return;
    const novas = new Set();
    for (const a of d.ativas || []) {
      const m = /@(\d+),(\d+)$/.exec(a.movel);
      if (!m) continue;
      const id = "jogo-" + a.movel;
      novas.add(id);
      escritorio.mapa.marcador(id, Number(m[1]), Number(m[2]), `<span class="mesa-ocupada"><b>${MESAS_NOMES[a.jogo] || "Jogo"}</b>${a.nomes.map((n) => safeText(String(n).split(" ")[0])).join(" × ")}</span>`, 70);
    }
    for (const id of r.placas) if (!novas.has(id)) escritorio.mapa.marcador(id, 0, 0, null);
    r.placas = novas;
    for (const c of d.convites || []) {
      const k = c.jogo + ":" + c.id;
      if (r.avisados.has(k)) continue;
      r.avisados.add(k);
      // O aviso com Aceitar, Ver e Recusar (vybe-escritorio-xadrez.js).
      const cfg = c.jogo === "xadrez" ? XADREZ_CFG : Object.values(ESCRITORIO_MESAS).find((x) => x.extra.jogo === c.jogo);
      if (!cfg) continue;
      escritorioApi(cfg.lista, null, { id: c.id }).then((v) => v.jogo?.estado === "convite" && mesaConviteAviso(v.jogo, cfg))
        .catch(() => escritorioAviso(`${String(c.de).split(" ")[0]} te chamou para ${MESAS_NOMES[c.jogo]?.toLowerCase() || "um jogo"}. Clique na mesa do jogo para responder.`));
    }
  }).catch(() => {});
}
setInterval(() => escritorioResumoJogos(false), 5000);
