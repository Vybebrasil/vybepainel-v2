// Mesa de Jogos do Escritório (pedido do Paulo, 27/10/2026): a mesa que era
// só do dominó agora abre a escolha entre dominó, dama, jogo da velha e
// truco. Convite e aposta são as telas do xadrez; a moldura da partida é a
// das mesas (vybe-escritorio-mesas.js); as regras ficam no servidor
// (server/escritorio-dama.js, escritorio-velha.js, escritorio-truco.js).
// Avisos pelo balão de comando: dam=, vlh=, trc= (<id>:<para>:<c|l>).
const DAMA_CFG = registrarMesaEscritorio({
  nome: "Dama", artigo: "a dama", extra: { jogo: "dama" }, sinal: "dam",
  nota: "Dama brasileira: captura obrigatória, a maior captura vale e a dama voa. As cores são sorteadas.", desenhar: (j, s) => desenharDama(j, s),
});
const VELHA_CFG = registrarMesaEscritorio({
  nome: "Jogo da velha", artigo: "o jogo da velha", extra: { jogo: "velha" }, sinal: "vlh",
  nota: "Melhor de 5: ganha quem fizer 3 rodadas primeiro.", desenhar: (j, s) => desenharVelha(j, s),
});
const TRUCO_CFG = registrarMesaEscritorio({
  nome: "Truco", artigo: "o truco", extra: { jogo: "truco" }, sinal: "trc",
  nota: "Truco paulista para dois, até 12 pontos, com vira e manilha.", desenhar: (j, s) => desenharTruco(j, s),
});
const MESA_DE_JOGOS = ["dmn", "dam", "vlh", "trc"];
const MESA_DE_JOGOS_ICONES = { dmn: "▣", dam: "⛂", vlh: "#", trc: "♣" };

// Clicou na Mesa de Jogos: a partida que estiver rolando (minha ou nesta
// mesa), o convite recebido, ou a escolha do jogo.
async function abrirMesaDeJogosEscritorio(m) {
  if (escritorio.base?.demo) return escritorioAviso("A demonstração não tem partidas.");
  const mesa = { camada: escritorio.quarto || "praca", movel: escritorio.mapa.chaveMovel(m) };
  let d;
  try { d = await escritorioApi("mesa", null, { ...mesa, jogo: "todos" }); } catch (e) { return escritorioAviso(e.message); }
  if (!d.disponivel) return escritorioAviso("A Mesa de Jogos aguarda a migração do banco.");
  xadrezPoeSprite();
  const x = escritorioXadrez();
  x.mesa = mesa;
  const cfgDe = (j) => MESA_DE_JOGOS.map((k) => ESCRITORIO_MESAS[k]).find((c) => c.extra.jogo === j.jogo);
  const daqui = (l) => l.filter((j) => cfgDe(j));
  const meu = daqui(d.jogos)[0], aqui = d.mesa && cfgDe(d.mesa) ? d.mesa : null, convite = daqui(d.convites)[0];
  if (meu) return cfgDe(meu).abrir(meu);
  if (aqui) return cfgDe(aqui).abrir(aqui);
  if (convite) return desenharConviteXadrez(convite, cfgDe(convite));
  x.enviadosMesa = daqui(d.enviados);
  escolherJogoDaMesa();
}
function escolherJogoDaMesa() {
  const botoes = MESA_DE_JOGOS.map((k) => {
    const c = ESCRITORIO_MESAS[k];
    return `<button type="button" onclick="jogoDaMesaEscolhido('${k}')"><i aria-hidden="true">${MESA_DE_JOGOS_ICONES[k]}</i><b>${c.nome}</b><small>${safeText(c.nota)}</small></button>`;
  }).join("");
  xadrezModal(`<div class="workflow-kicker">Mesa de Jogos<button type="button" class="workflow-close" aria-label="Fechar" onclick="xadrezFechar()">×</button></div>
<h2 class="workflow-title">O que vamos jogar?</h2><div class="mesa-escolha">${botoes}</div>`, "ofc-xdz-escolha");
}
function jogoDaMesaEscolhido(chave) {
  const x = escritorioXadrez(), cfg = ESCRITORIO_MESAS[chave];
  x.cfg = cfg;
  novoXadrez((x.enviadosMesa || []).find((j) => j.jogo === cfg.extra.jogo) || null);
}

// --- Jogo da velha ---------------------------------------------------------
function desenharVelha(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const cima = outro || "desafiado", baixo = eu || "desafiante";
  const detalhe = (l) => `${m.simbolos[l]} · ${m.placar[l]} de ${m.alvo}`;
  const minha = j.estado === "jogando" && m.pode_marcar;
  // No fim da partida o tabuleiro mostrado é o da última rodada, com a linha que fechou.
  const tab = j.estado === "fim" && m.anterior ? m.anterior.tab : m.tab, linha = new Set(j.estado === "fim" ? m.anterior?.linha || [] : []);
  const casas = tab.map((c, i) => `<button type="button" class="vlh-casa${c ? " " + c.toLowerCase() : ""}${m.ultimo?.casa === i && c ? " ultima" : ""}${linha.has(i) ? " linha" : ""}" ${minha && !c ? `onclick="lanceMesaEscritorio('vlh',{tipo:'marcar',casa:${i}},this)"` : "disabled"} aria-label="Casa ${i + 1}${c ? ", " + c : ""}">${c || ""}</button>`).join("");
  const a = m.anterior, nome = (l) => (l === eu ? "Você" : xadrezPrimeiroNome(j[l]));
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : minha ? `Sua vez: você é ${m.simbolos[eu]}.` : `Vez de ${xadrezPrimeiroNome(j[outro])}.`;
  return {
    status,
    mesa: `${mesaJogadorHtml(j, cima, detalhe(cima))}<div class="vlh-mesa"><small>Rodada ${m.rodada} · melhor de ${m.alvo * 2 - 1}</small><div class="vlh-tab">${casas}</div></div>${mesaJogadorHtml(j, baixo, detalhe(baixo))}`,
    painel: a ? `<p class="ofc-nota">${safeText(a.vencedor === "empate" ? `Rodada ${a.rodada}: deu velha.` : `Rodada ${a.rodada}: ${nome(a.vencedor)} fez a linha.`)}</p>` : "",
  };
}

// --- Dama ------------------------------------------------------------------
function desenharDama(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const minhaCor = eu ? m.cores[eu] : "brancas", invertido = minhaCor === "pretas";
  const minhaVez = j.estado === "jogando" && eu && j.vez === eu;
  const alvos = new Map((s.sel != null ? m.legais[s.sel] || [] : []).map((l) => [l.para, l]));
  const ultimo = new Set(m.ultimo ? [m.ultimo.de, ...m.ultimo.caminho] : []);
  const ordem = [...Array(64).keys()];
  if (invertido) ordem.reverse();
  const casas = ordem.map((i) => {
    const r = Math.floor(i / 8), c = i % 8, escura = (r + c) % 2 === 1, p = m.tab[i];
    const pode = minhaVez && m.legais[i];
    const cls = ["dam-casa", escura ? "escura" : "clara", s.sel === i ? "sel" : "", alvos.has(i) ? "alvo" : "", ultimo.has(i) ? "ultimo" : "", pode ? "minha" : ""].filter(Boolean).join(" ");
    const peca = p ? `<span class="dam-peca ${p.toLowerCase() === "b" ? "branca" : "preta"}${p === "B" || p === "P" ? " dama" : ""}" aria-hidden="true"></span>` : "";
    return `<button type="button" class="${cls}" ${escura ? `onclick="casaDama(${i})"` : "disabled"} aria-label="Casa ${"abcdefgh"[c]}${8 - r}${p ? (p.toLowerCase() === "b" ? ", branca" : ", preta") + (p === "B" || p === "P" ? " dama" : "") : ""}">${peca}</button>`;
  }).join("");
  const detalhe = (l) => `${m.cores[l] === "brancas" ? "Brancas" : "Pretas"} · ${m.pecas[m.cores[l]]} peças`;
  const cima = outro || "desafiado", baixo = eu || "desafiante";
  const deve = minhaVez ? Math.max(0, ...Object.values(m.legais).flat().map((l) => l.capturas)) : 0;
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : !minhaVez ? `Vez de ${xadrezPrimeiroNome(j[outro])}.`
    : deve ? `Captura obrigatória: tome ${deve} ${deve === 1 ? "peça" : "peças"}.` : "Sua vez. Toque numa peça e depois na casa.";
  return { status, mesa: `${mesaJogadorHtml(j, cima, detalhe(cima))}<div class="dam-tabuleiro${minhaVez ? " vez" : ""}">${casas}</div>${mesaJogadorHtml(j, baixo, detalhe(baixo))}` };
}
function casaDama(i) {
  const s = escritorioMesa("dam"), j = s.jogo;
  if (!j || j.estado !== "jogando" || j.vez !== j.eu || s.enviando) return;
  const lance = s.sel != null ? (j.mesa.legais[s.sel] || []).find((l) => l.para === i) : null;
  if (lance) return lanceMesaEscritorio("dam", { tipo: "mover", de: s.sel, para: i, caminho: lance.caminho });
  s.sel = j.mesa.legais[i] && s.sel !== i ? i : null;
  desenharJogoMesa("dam");
}

// --- Truco -----------------------------------------------------------------
// Cartas do truco ('4o') no desenho das cartas do pôquer ('4d').
const TRUCO_NAIPE = { o: "d", e: "s", c: "h", p: "c" };
const trucoCartaHtml = (c, cls) => pokerCartaHtml(c ? c[0] + TRUCO_NAIPE[c[1]] : null, cls);
function desenharTruco(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null, a = m.acoes || {};
  const cima = outro || "desafiado", baixo = eu || "desafiante";
  const nome = (l) => (l === eu ? "Você" : xadrezPrimeiroNome(j[l]));
  const detalhe = (l) => `${m.pontos[l]} de ${m.alvo} pontos${m.pe === l ? " · pé" : ""}`;
  const minhas = eu && m.minhas ? m.minhas.map((c) => `<button type="button" class="trc-carta" ${a.jogar ? `onclick="lanceMesaEscritorio('trc',{tipo:'jogar',carta:'${c}'},this)"` : "disabled"} aria-label="Jogar ${c}">${trucoCartaHtml(c, "grande")}</button>`).join("") : "";
  const dele = Array.from({ length: eu ? m.dele : m.pecas[cima] }, () => trucoCartaHtml(null, "mini")).join("");
  const rodadas = [0, 1, 2].map((i) => { const r = m.rodadas[i]; return `<i class="trc-rodada${r ? (r.vencedor === "empate" ? " empate" : r.vencedor === baixo ? " minha" : " dele") : ""}" title="Rodada ${i + 1}"></i>`; }).join("");
  const naMesa = (l) => (m.naMesa[l] ? trucoCartaHtml(m.naMesa[l]) : '<span class="pkr-carta vaga" aria-hidden="true"></span>');
  const p = m.pendente;
  const botoes = !eu || j.estado !== "jogando" ? "" : a.responder
    ? `<div class="trc-pedido"><b>${xadrezPrimeiroNome(j[p.de])} pediu ${p.nome}!</b><button type="button" class="workflow-primary" onclick="lanceMesaEscritorio('trc',{tipo:'aceitar'},this)">Aceitar (${p.valor})</button>${a.aumentar ? `<button type="button" class="workflow-primary trc-grito" onclick="lanceMesaEscritorio('trc',{tipo:'aumentar'},this)">${a.aumentar}!</button>` : ""}<button type="button" class="workflow-secondary" onclick="lanceMesaEscritorio('trc',{tipo:'correr'},this)">Correr</button></div>`
    : a.truco ? `<div class="trc-pedido"><button type="button" class="workflow-primary trc-grito" onclick="lanceMesaEscritorio('trc',{tipo:'truco'},this)">${a.truco}!</button></div>` : "";
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : a.esperando ? `Esperando ${xadrezPrimeiroNome(j[outro])} responder o ${p?.nome}.`
    : a.responder ? "Responda o pedido." : a.jogar ? "Sua vez: jogue uma carta." : `Vez de ${xadrezPrimeiroNome(j[outro])}.`;
  const ant = m.anterior;
  const anterior = ant ? `<p class="ofc-nota">${safeText(ant.vencedor === "empate" ? `Mão ${ant.mao}: empatou, ninguém pontuou.` : `Mão ${ant.mao}: ${nome(ant.vencedor)} levou ${ant.valor} ${ant.valor === 1 ? "ponto" : "pontos"}${ant.motivo === "correu" ? " (o outro correu)" : ""}.`)}</p>` : "";
  return {
    status,
    mesa: `${mesaJogadorHtml(j, cima, detalhe(cima))}<div class="trc-mesa"><div class="pkr-dele">${dele}</div>
<div class="trc-centro"><div class="trc-vira"><small>Vira</small>${trucoCartaHtml(m.vira, "mini")}<small>Manilha: ${safeText(m.manilha)}</small></div>
<div class="trc-jogadas">${naMesa(cima)}${naMesa(baixo)}</div><div class="trc-info"><b>Vale ${m.vale}</b>${m.mao_de_onze ? "<small>Mão de onze</small>" : ""}<span class="trc-rodadas">${rodadas}</span><small>Mão ${m.mao}</small></div></div></div>
${mesaJogadorHtml(j, baixo, detalhe(baixo))}<div class="pkr-minhas trc-minhas">${minhas}</div>${botoes}`,
    painel: anterior,
  };
}
