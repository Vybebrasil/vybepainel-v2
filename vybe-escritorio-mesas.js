// Partida nas mesas de jogo do Escritório (dominó, pôquer…; pedido do Paulo,
// 27/10/2026). O convite e a aposta são as telas do xadrez com a configuração
// de cada jogo (vybe-escritorio-xadrez.js); aqui fica o que toda partida de
// mesa tem igual: reler a cada 4 s, os dois jogadores, o resultado, o empate
// combinado, a desistência, a vitória por tempo e o aviso pelo balão. Cada
// jogo registra a sua configuração com `desenhar(j)`, que devolve a mesa e o
// que vai no painel, e chama `lanceMesaEscritorio(chave, pedido)` para jogar.
const ESCRITORIO_MESAS = {};

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
  return ESCRITORIO_XADREZ.test(c) ? "Xadrez" : ESCRITORIO_DOMINO.test(c) ? "Dominó" : ESCRITORIO_POKER.test(c) ? "Pôquer" : ESCRITORIO_SINUCA.test(c) ? "Sinuca" : null;
}
function escritorioMesa(chave) {
  return ((escritorio.mesas ||= {})[chave] ||= { jogo: null, sel: null, timer: null });
}
function mesaOutro(lado) {
  return lado === "desafiante" ? "desafiado" : "desafiante";
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
      if (r.jogo.n !== j.n) { s.sel = null; escritorioTocar(r.jogo.vez === r.jogo.eu ? 660 : 440, 0.06, 0.05); }
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
    escritorioTocar(520, 0.06, 0.05);
    mesaSinal(ESCRITORIO_MESAS[chave], j.id, j[mesaOutro(j.eu)].id, "l");
    if (r.jogo.estado === "fim") xadrezAcabou(r.jogo);
  } catch (e) {
    s.sel = null;
    escritorioAviso(e.message);
    recarregarJogoMesa(chave);
  } finally { s.enviando = false; }
  desenharJogoMesa(chave);
}
function desistirMesa(chave, botao) {
  if (botao.dataset.certeza !== "1") { botao.dataset.certeza = "1"; botao.textContent = "Desistir mesmo?"; setTimeout(() => { if (botao.isConnected) { botao.dataset.certeza = ""; botao.textContent = "Desistir"; } }, 4000); return; }
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
    mesaSinal(ESCRITORIO_MESAS[chave], j.id, j[mesaOutro(j.eu)].id, "l");
    if (r.jogo.estado === "fim") xadrezAcabou(r.jogo);
    desenharJogoMesa(chave);
  } catch (e) {
    if (botao) botao.disabled = false;
    const el = document.getElementById("xdz-erro");
    if (el) el.textContent = e.message;
  }
}

// Barra de quem joga: cabeça, nome, de quem é a vez e um detalhe do jogo
// (peças na mão, fichas…).
function mesaJogadorHtml(j, lado, detalhe) {
  const p = j[lado], u = escritorioCabecaUrl(p.id), vez = j.estado === "jogando" && j.vez === lado, eu = j.eu === lado;
  return `<div class="xdz-jogador mesa-jogador${vez ? " vez" : ""}">${u ? `<img src="${safeText(u)}" alt="" width="36" height="36">` : "<i></i>"}<b>${xadrezPrimeiroNome(p)}${eu ? " (você)" : ""}</b><small>${vez ? (eu ? "Sua vez" : "Pensando…") : detalhe}</small></div>`;
}
// Moldura da partida: a mesa à esquerda (cima = a outra pessoa, baixo = eu) e
// o painel com resultado, status, aposta, o que o jogo quiser e as ações.
function desenharJogoMesa(chave) {
  const s = escritorioMesa(chave), j = s.jogo, cfg = ESCRITORIO_MESAS[chave];
  if (!j) return;
  const { mesa, status, painel = "" } = cfg.desenhar(j, s);
  const jogando = j.estado === "jogando", eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const empateMeu = j.empate_de && j.empate_de === String(escritorio.base?.eu), empateDele = j.empate_de && !empateMeu;
  const acoes = !jogando || !eu ? "" : `<div class="xdz-acoes">
${empateDele ? `<div class="xdz-empate"><span>${xadrezPrimeiroNome(j[outro])} propôs empate.</span><button type="button" class="workflow-primary" onclick="acaoMesaEscritorio('${chave}','aceitar-empate',this)">Aceitar</button><button type="button" class="workflow-secondary" onclick="acaoMesaEscritorio('${chave}','recusar-empate',this)">Recusar</button></div>` : ""}
${j.pode_reivindicar ? `<button type="button" class="workflow-primary" onclick="acaoMesaEscritorio('${chave}','reivindicar',this)">${xadrezPrimeiroNome(j[outro])} sumiu: ganhar por tempo</button>` : ""}
<button type="button" class="workflow-secondary" onclick="acaoMesaEscritorio('${chave}','empate',this)" ${j.empate_de ? "disabled" : ""}>${empateMeu ? "Empate proposto" : "Propor empate"}</button>
<button type="button" class="workflow-secondary xdz-desistir" onclick="desistirMesa('${chave}',this)">Desistir</button></div>`;
  const perspectiva = eu ? (String(j.desafiante.id) === String(escritorio.base?.eu) ? "desafiante" : "desafiado") : null;
  xadrezModal(`<div class="workflow-kicker">${cfg.nome}${!eu ? " · assistindo" : ""}<button type="button" class="workflow-close" aria-label="Fechar" onclick="mesaFechar('${chave}')">×</button></div>
<div class="xdz-jogo mesa-jogo"><div class="mesa-lado">${mesa}</div>
<aside class="xdz-painel">${xadrezResultadoHtml(j)}${status ? `<p class="xdz-status" aria-live="polite">${status}</p>` : ""}
${xadrezApostaHtml(j, perspectiva)}${mesaPlacarHtml(j)}${painel}${acoes}<p class="ofc-erro" id="xdz-erro" role="alert"></p>
${!jogando ? mesaFimAcoesHtml(chave, j, `mesaFechar('${chave}')`) : ""}</aside></div>`, `ofc-${chave}-jogo`);
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
  const revanche = j.eu ? `<button type="button" class="workflow-secondary" onclick="revancheEscritorio('${chave}',this)">Revanche</button>` : "";
  return `<div class="workflow-actions">${revanche}<button type="button" class="workflow-primary" onclick="${fechar}">Fechar</button></div>`;
}
// Revanche: chama a mesma pessoa para a mesma mesa, valendo as mesmas
// VybeCoins. Os itens da aposta já mudaram de dono, então não se repetem.
async function revancheEscritorio(chave, botao) {
  const cfg = chave === "xdz" ? XADREZ_CFG : ESCRITORIO_MESAS[chave];
  const j = chave === "xdz" ? escritorioXadrez().jogo : escritorioMesa(chave).jogo;
  if (!cfg || !j?.eu) return;
  const outro = String(j.desafiante.id) === String(escritorio.base?.eu) ? j.desafiado : j.desafiante;
  botao.disabled = true;
  try {
    const r = await escritorioApi(cfg.desafiar, { ...cfg.extra, para: outro.id, camada: j.camada, movel: j.movel, moedas: j.moedas || 0, oferece: [], pede: [], chave: xadrezChave() });
    mesaSinal(cfg, r.id, outro.id, "c");
    const x = escritorioXadrez();
    x.esperando = cfg.sinal + ":" + r.id; x.mesa = { camada: j.camada, movel: j.movel }; x.cfg = cfg;
    botao.textContent = "Revanche enviada";
    escritorioAviso(`Revanche enviada para ${String(outro.nome || "a pessoa").split(" ")[0]}. A partida abre quando aceitar.`);
  } catch (e) {
    botao.disabled = false;
    const el = document.getElementById("xdz-erro");
    if (el) el.textContent = e.message;
  }
}

// Placas em cima das mesas com partida nesta cena (quem passa sabe que pode
// assistir) e aviso dos convites que chegaram enquanto a pessoa não estava no
// escritório. Relê a cada 20 s, logo que a cena muda e quando chega aviso de jogo.
const MESAS_NOMES = { xadrez: "Xadrez", domino: "Dominó", poker: "Pôquer", sinuca: "Sinuca" };
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
      escritorioAviso(`${String(c.de).split(" ")[0]} te chamou para ${MESAS_NOMES[c.jogo]?.toLowerCase() || "um jogo"}. Clique na mesa do jogo para responder.`);
    }
  }).catch(() => {});
}
setInterval(() => escritorioResumoJogos(false), 5000);
