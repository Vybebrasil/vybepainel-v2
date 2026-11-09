// SINUCA COM CARA DE BOTECO DE ESQUINA (Paulo, 09/11/2026: "pode executar tudo,
// entendeu a vybe de boteco de esquina brasileiro que quero passar né?", com
// fotos de referência: parede caiada e azulejo, letreiro pintado "CLUBE DE
// BILHAR", cadeira de plástico vermelha, mesa amarela, engradado, lâmpada
// fluorescente, troféu na prateleira, giz azul).
//
// Sistema visual (vybe-sinuca.css, classes bt-*): cada informação é um objeto
// do bar. A ficha é a carteirinha de sócio do clube; o menu são cartazes de
// cartolina fluorescente escritos de pincel atômico; o saldo é a comanda; a
// escolha do rival são fotos 3x4 coladas na parede e um cartaz lambe-lambe de
// desafio; o título é um carimbo. Nada rola dentro do jogo.
//
// Depende de vybe-escritorio-sinuca-ui.js (SINUCA_MENU, sinucaLobbySecao...) e
// de vybe-escritorio-sinuca-confronto.js (SINUCA_RARIDADE).

// Letreiro pintado, pincel atômico, cartaz de show e giz: só carregam quando a sinuca abre.
function btFontes() {
  if (typeof document === "undefined" || document.getElementById("bt-fontes")) return;
  const l = document.createElement("link");
  l.id = "bt-fontes"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Anton&family=Barlow+Semi+Condensed:wght@500;600;700;800&family=Kalam:wght@700&family=Permanent+Marker&display=swap";
  document.head.appendChild(l);
}
btFontes();

// O que fica pendurado na parede do boteco: a placa do fiado, a folhinha do mês, a flâmula e a tomada.
function btDecoParede() {
  const d = new Date(), mes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"][d.getMonth()];
  return `<i class="bt-deco bt-fiado"></i><i class="bt-deco bt-folhinha" data-mes="${mes}" data-dia="${d.getDate()}"></i><i class="bt-deco bt-flamula"></i><i class="bt-deco bt-tomada"></i>`;
}

const BT_CARTOLINA = { sala: "amarela", desafios: "laranja", ranking: "verde", conquistas: "rosa", temporada: "azul" };
const BT_MENU_PINCEL = { sala: "DESAFIAR A TURMA", desafios: "JORNADA DOS BARES", ranking: "RANKING DO SALÃO", conquistas: "ESTANTE DE CONQUISTAS", temporada: "TORNEIO DA TEMPORADA" };

const btPrimeiro = (nome) => safeText(String(nome || "").split(" ")[0]);
// Carimbo do título (cor da raridade), torto como carimbo de verdade.
function btCarimbo(t, extra = "") {
  if (!t) return `<span class="bt-carimbo comum${extra}">ESTREANTE</span>`;
  return `<span class="bt-carimbo ${safeText(t.raridade || "comum")}${extra}" title="${safeText(t.texto || "")}">${safeText(t.nome)}</span>`;
}
// A carteirinha de sócio do clube (a sua ficha, pequena, no alto do menu).
function btCarteirinhaHtml(id, nome, f, retrato) {
  const num = String(id || "0").padStart(4, "0");
  return `<button type="button" class="bt-carteirinha" onclick="sinucaFichaDoSalao('${safeText(String(id))}')" title="Abrir a minha ficha do bar">
<span class="bt-carteirinha-faixa">CLUBE DE BILHAR VYBE · SÓCIO</span>
<span class="bt-carteirinha-corpo"><span class="bt-foto34">${retrato ? `<img src="${safeText(retrato)}" alt="">` : `<i>${safeText(String(nome || "?")[0])}</i>`}</span>
<span class="bt-carteirinha-dados"><b class="bt-caneta">${btPrimeiro(nome)}</b>${btCarimbo(f?.titulo)}
<span class="bt-carteirinha-linha"><small>CAMPANHA</small><b>${f?.vitorias || 0}V · ${f?.derrotas || 0}D</b></span>
<span class="bt-carteirinha-linha"><small>NO SALÃO</small><b>${f?.posicao ? `${f.posicao}º` : "—"}</b></span></span>
${f?.nota != null ? `<span class="bt-nota" title="Nota de jogador"><b>${f.nota}</b><small>NOTA</small></span>` : ""}</span>
<span class="bt-carteirinha-pe"><span>Nº ${num}</span><i aria-hidden="true"></i></span></button>`;
}

function desenharLobbySinuca(d, cfg) {
  btFontes();
  const x = escritorioXadrez(), aba = x.sinucaSecao || "sala", online = mesaPessoasParaChamar(), saldo = escritorio.base?.economia?.saldo;
  mesaLerExtras(cfg);
  const salao = x.extras?.jogo === "sinuca" ? x.extras.bots?.salao : null, eu = String(escritorio.base?.eu || "");
  const f = salao?.fichas?.[eu], r = salao?.ranking?.lista?.find((p) => p.id === eu), nome = r?.nome || escritorio.base?.nome || "Você";
  const aoVivo = d.mesa ? `<button type="button" class="bt-ao-vivo" onclick="mesaAssistir()"><i></i>NA MESA AGORA · ${btPrimeiro(xadrezPrimeiroNome(d.mesa.desafiante))} × ${btPrimeiro(xadrezPrimeiroNome(d.mesa.desafiado))}<b>ASSISTIR ▸</b></button>` : "";
  const tSnc = x.extras?.jogo === "sinuca" ? x.extras.temporada : null, temporada = tSnc && typeof sinucaTemporadaHtml === "function" ? sinucaTemporadaHtml(tSnc) : mesaTemporadaHtml(cfg);
  const titulo = (pincel, letreiro) => `<div class="bt-titulo"><small class="bt-pincel">${pincel}</small><h2>${letreiro}</h2></div>`;
  const painel = aba === "sala" ? `${titulo("ESCOLHA O ADVERSÁRIO", "QUEM VAI PRA MESA?")}${btEscolhaRivalHtml(online)}`
    : aba === "desafios" ? btJornadaHtml(cfg)
    : aba === "ranking" ? sinucaSalaoHtml()
    : aba === "conquistas" ? sinucaConquistasHtml()
    : `${titulo("A GLÓRIA DO BOTECO", "SEU NOME NO TOPO")}${temporada || '<div class="snc-vazio"><p>Temporada indisponível no momento.</p><button class="bt-btn papel" onclick="escritorioXadrez().extras=null;mesaLerExtras(mesaCfg())">Atualizar temporada</button></div>'}`;
  const cartazes = SINUCA_MENU.map(([id, n, sub], i) => `<button type="button" class="bt-cartaz ${BT_CARTOLINA[id]}" style="--g:${[-2, 1.5, -1, 2, -1.5][i]}deg" aria-pressed="${aba === id}" onclick="sinucaLobbySecao('${id}')"><b>${safeText(BT_MENU_PINCEL[id] || n)}</b><small>${safeText(sub)}</small></button>`).join("");
  xadrezModal(`<div class="bt-salao snc-hub" data-aba="${safeText(aba)}">
<div class="bt-parede" aria-hidden="true"><i class="bt-luz"></i><i class="bt-azulejo"></i>${btDecoParede()}</div>
<div class="bt-topo"><p class="bt-letreiro" aria-label="Clube de bilhar Vybe"><span>CLUBE DE</span><b>BILHAR</b><small>VYBE · DESDE 2026</small></p>
<div class="bt-topo-dir">${saldo !== undefined ? `<p class="bt-comanda" title="Suas VybeCoins"><small>COMANDA</small><b class="bt-caneta">${Number(saldo).toLocaleString("pt-BR")} 🪙</b></p>` : ""}<button type="button" class="bt-fechar" aria-label="Fechar sinuca" onclick="xadrezFechar()">×</button></div></div>
<nav class="bt-menu" aria-label="Menu da sinuca">${btCarteirinhaHtml(eu, nome, f, escritorioCabecaUrl?.(eu))}<div class="bt-cartazes">${cartazes}</div></nav>
<main class="bt-painel snc-menu-painel" data-aba="${safeText(aba)}">${sinucaConvitesHtml(d)}${aoVivo}${painel}<p class="ofc-erro" id="xdz-erro" role="alert"></p></main>
</div>`, "ofc-xdz-sala");
  mesaLobbyRelogio();
  sinucaTacosVitrine(document.querySelector(".bt-salao") || document);
}

// Escolha do rival: as fotos 3x4 da turma coladas na parede e, ao lado, o
// cartaz lambe-lambe do desafio com quem está em foco.
function btEscolhaRivalHtml(pessoas) {
  const x = escritorioXadrez(), fichas = x.extras?.jogo === "sinuca" ? x.extras.bots?.salao?.fichas || {} : {};
  if (!pessoas.length) return '<div class="bt-vazio bt-caneta">Ninguém mais da turma por aqui. Treine na Jornada dos bares.</div>';
  const foco = pessoas.find((p) => String(p.id) === String(x.sinucaFoco)) || pessoas.find((p) => p.online) || pessoas[0];
  const id = String(foco.id), f = fichas[id], u = escritorioCabecaUrl?.(foco.id);
  const fotos = pessoas.map((p, i) => {
    const pid = String(p.id), fi = fichas[pid], ur = escritorioCabecaUrl?.(p.id);
    return `<button type="button" class="bt-foto${pid === id ? " foco" : ""}${p.online ? " online" : ""}" style="--g:${[-3, 2, -1.5, 3, -2, 1][i % 6]}deg" onmouseenter="sinucaRivalFoco('${safeText(pid)}')" onfocus="sinucaRivalFoco('${safeText(pid)}')" onclick="sinucaRivalFoco('${safeText(pid)}',true)"><span class="bt-foto34">${ur ? `<img src="${safeText(ur)}" alt="">` : `<i>${safeText(String(p.nome || "?")[0])}</i>`}</span><b class="bt-caneta">${btPrimeiro(xadrezPrimeiroNome(p))}</b>${p.online ? '<em>TÁ NO BAR</em>' : ""}${fi?.nota != null ? `<small>${fi.nota}</small>` : ""}</button>`;
  }).join("");
  const destaques = f ? (f.destaques || []).map((k) => f.trofeus.find((t) => t.chave === k)).filter(Boolean) : [];
  return `<div class="bt-rivais snc-rivais"><div class="bt-fotos" role="listbox" aria-label="Escolha quem chamar">${fotos}</div>
<article class="bt-lambe" aria-label="Desafio contra ${btPrimeiro(foco.nome || xadrezPrimeiroNome(foco))}">
<p class="bt-lambe-chamada">DESAFIO NO TACO!</p>
<div class="bt-lambe-meio"><span class="bt-lambe-foto">${u ? `<img src="${safeText(u)}" alt="">` : `<i>${safeText(String(foco.nome || "?")[0])}</i>`}</span>
<div><h3>${btPrimeiro(foco.nome || xadrezPrimeiroNome(foco))}</h3>${btCarimbo(f?.titulo, " grande")}
<p class="bt-lambe-dados"><b>${f?.posicao ? `${f.posicao}º DO SALÃO` : "FORA DO RANKING"}</b> · ${f?.vitorias || 0} vitórias · ${f?.derrotas || 0} derrotas</p>
${destaques.length ? `<p class="bt-lambe-feitos">${destaques.map((t) => `<span title="${safeText(t.nome)}: ${safeText(t.texto)}">${t.icone}</span>`).join("")}</p>` : ""}</div>
${f?.nota != null ? `<span class="bt-estrela" title="Nota de jogador"><b>${f.nota}</b><small>NOTA</small></span>` : ""}</div>
<p class="bt-lambe-onde">${foco.online ? "● TÁ NO BAR AGORA" : "Recebe o convite no sino"}</p>
<div class="bt-lambe-acoes"><button type="button" class="bt-btn" onclick="novoXadrez(null);escolherRivalXadrez('${safeText(id)}')">DESAFIAR ${btPrimeiro(xadrezPrimeiroNome(foco)).toUpperCase()}</button><button type="button" class="bt-btn papel" onclick="sinucaFichaDoSalao('${safeText(id)}')">VER FICHA</button></div>
</article></div>`;
}
// O foco do rival redesenha só a área de escolha.
function sinucaRivalFoco(id, clique) {
  const x = escritorioXadrez();
  if (String(x.sinucaFoco) === String(id) && !clique) return;
  x.sinucaFoco = String(id);
  const alvo = document.querySelector(".bt-salao .bt-rivais");
  if (alvo) { alvo.outerHTML = btEscolhaRivalHtml(mesaPessoasParaChamar()); document.querySelector(`.bt-foto[onclick*="'${id}'"]`)?.focus({ preventScroll: true }); }
}

// Jornada dos bares: cada bar é uma foto colada na parede, com o nome do bar em
// letreiro, o dono, o prêmio numa etiqueta de preço e o carimbo DERRUBADO.
function btJornadaHtml(cfg) {
  const x = escritorioXadrez(), e = x.extras?.jogo === "sinuca" ? x.extras : null;
  const titulo = `<div class="bt-titulo"><small class="bt-pincel">JORNADA DOS BARES</small><h2>DA ESQUINA AO SALÃO DO BAIANINHO</h2></div>`;
  if (!e) return `${titulo}<p class="bt-vazio bt-caneta">Abrindo os bares…</p>`;
  if (!e.bots?.bots?.length) return `${titulo}<div class="bt-vazio"><p class="bt-caneta">Os donos dos bares não chegaram.</p><button class="bt-btn papel" onclick="escritorioXadrez().extras=null;mesaLerExtras(mesaCfg())">Tentar de novo</button></div>`;
  const bares = e.bots.bares || e.bots.bots.map((b) => ({ nivel: b.nivel, bar: b.nome, aberto: true, vencido: b.vitorias > 0 }));
  const resta = e.bots.resta_hoje;
  const card = (bar, i) => {
    const b = e.bots.bots.find((y) => y.nivel === bar.nivel);
    if (!b) return "";
    const estado = bar.vencido ? "vencido" : bar.aberto ? "aberto" : "fechado";
    const premio = resta ? `<span class="bt-etiqueta"><b>+${Math.min(b.premio.moedas, resta)}</b><small>🪙 · +${b.premio.xp} XP</small></span>` : '<span class="bt-etiqueta treino"><b>TREINO</b></span>';
    return `<article class="bt-bar ${estado}" style="--g:${[-2, 1.5, -1][i % 3]}deg"><p class="bt-bar-nome">${safeText(bar.bar)}</p>
<div class="bt-bar-foto"><img src="${sinucaRetrato(b.nivel)}" alt="Retrato de ${safeText(b.nome)}">${estado === "vencido" ? '<span class="bt-carimbo grande lendario bt-bar-carimbo">DERRUBADO</span>' : ""}${estado === "fechado" ? '<span class="bt-bar-tranca">🔒</span>' : ""}</div>
<h3 class="bt-caneta">${safeText(b.nome)}</h3><p class="bt-bar-frase">“${safeText(b.frase)}”</p>${premio}${b.vitorias ? `<small class="bt-bar-vitorias">Você já ganhou ${b.vitorias}×</small>` : ""}
${estado === "fechado" ? '<p class="bt-bar-trancado">Vença o dono do bar anterior</p>' : `<button type="button" class="bt-btn${estado === "vencido" ? " papel" : ""}" onclick="desafiarBotEscritorio('${safeText(b.bot)}',this)">${estado === "vencido" ? "REVANCHE" : "DESAFIAR"}</button>`}</article>`;
  };
  return `${titulo}<p class="bt-sub bt-caneta">${resta ? `Até ${Number(resta).toLocaleString("pt-BR")} moedas em prêmios hoje.` : "Prêmio de hoje já saiu. Ainda vale o treino."}</p><div class="bt-jornada">${bares.map(card).join('<i class="bt-seta" aria-hidden="true">➜</i>')}</div>`;
}

// Ficha aberta: a carteirinha de sócio grande, com os seis atributos num
// boletim escrito à caneta (a nota de cada um e o que ela mede).
function btFichaCarteirinhaHtml(nome, f, retrato, extra = "") {
  const at = f.atributos || null;
  const boletim = at && typeof SINUCA_ATRIBUTOS !== "undefined" ? `<table class="bt-boletim"><caption>BOLETIM DO TACO</caption>${SINUCA_ATRIBUTOS.map(([k, sig, dica]) => `<tr title="${safeText(dica)}"><th>${safeText(dica.split(":")[0])}</th><td class="bt-caneta${at[k] >= 80 ? " alto" : at[k] < 45 ? " baixo" : ""}">${at[k]}</td></tr>`).join("")}</table>` : "";
  return `<section class="bt-ficha-carteirinha"><div class="bt-carteirinha grande"><span class="bt-carteirinha-faixa">CLUBE DE BILHAR VYBE · CARTEIRINHA DE SÓCIO</span>
<span class="bt-carteirinha-corpo"><span class="bt-foto34">${retrato ? `<img src="${safeText(retrato)}" alt="">` : `<i>${safeText(String(nome || "?")[0])}</i>`}</span>
<span class="bt-carteirinha-dados"><b class="bt-caneta">${btPrimeiro(nome)}</b>${btCarimbo(f.titulo, " grande")}${f.titulo?.texto ? `<small class="bt-ficha-titulo-texto">${safeText(f.titulo.texto)}</small>` : ""}
<span class="bt-carteirinha-linha"><small>CAMPANHA</small><b>${f.vitorias || 0}V · ${f.derrotas || 0}D</b></span><span class="bt-carteirinha-linha"><small>NO SALÃO</small><b>${f.posicao ? `${f.posicao}º` : "—"}</b></span><span class="bt-carteirinha-linha"><small>MAIOR SÉRIE</small><b>${f.maior_sequencia || 0}</b></span>${f.apelido ? `<span class="bt-ficha-apelido" title="${safeText(f.apelido.texto || "")}">vulgo <b>${safeText(f.apelido.nome)}</b> ${f.apelido.icone || ""}</span>` : ""}</span>
${f.nota != null ? `<span class="bt-estrela"><b>${f.nota}</b><small>NOTA</small></span>` : ""}</span></div>${boletim}${extra}</section>`;
}

// Pódio de engradados (Paulo, 09/11/2026: "tem coisa que parece herdada da interface antiga... traz tudo pra
// essa identidade nova"): o 1º em cima de três engradados, o 2º em dois, o 3º em um; a foto 3x4 colada em
// cima, o nome à caneta, a posição pintada no engradado e o prêmio na etiqueta. Serve ao ranking e à temporada.
// lugares: [{ pos, id, nome, sub, premio, eu, clique }]
function btPodioHtml(lugares) {
  const cores = { 1: ["c8261d", "1f7a46", "f2bd14"], 2: ["1f7a46", "c8261d"], 3: ["f2bd14"] };
  const lugar = (pos) => {
    const p = lugares.find((l) => l.pos === pos), u = p?.id ? escritorioCabecaUrl?.(p.id) : "";
    const pilha = cores[pos].map((c, i) => `<i class="bt-podio-caixa" style="--c:#${c}">${i === 0 ? `<b>${pos}º</b>` : ""}</i>`).join("");
    return `<div class="bt-podio-lugar p${pos}${p?.eu ? " eu" : ""}">${p ? `<button type="button" class="bt-podio-quem" ${p.clique ? `onclick="${p.clique}"` : "disabled"}><span class="bt-foto34">${u ? `<img src="${safeText(u)}" alt="">` : `<i>${safeText(String(p.nome)[0])}</i>`}</span><b>${btPrimeiro(p.nome)}</b>${p.sub ? `<small class="bt-caneta">${safeText(p.sub)}</small>` : ""}</button>` : '<div class="bt-podio-quem vago"><span class="bt-foto34"><i>?</i></span><b>VAGO</b></div>'}
${p?.premio ? `<span class="bt-etiqueta bt-podio-premio"><b>${safeText(p.premio)}</b></span>` : ""}<div class="bt-podio-pilha">${pilha}</div></div>`;
  };
  return `<div class="bt-podio">${lugar(2)}${lugar(1)}${lugar(3)}</div>`;
}

// A TV DO BOTECO (Paulo, 09/11/2026: "devia ter o player de música na sinuca... a telinha com os controles e o
// clipe, meio que ligar a TV do boteco, e poder minimizar pra ficar só ouvindo"). É o player de música do
// Escritório (a fila da sala, ouvida junto por quem está nela), que com a sinuca aberta vira a TV pendurada no
// canto da mesa; minimizada, vira um radinho. O Escritório fica escondido enquanto o jogo está aberto, então o
// player vem para a tela do jogo (recriado no mesmo ponto da música) e volta quando a sinuca fecha.
function btTvReiniciarPlayer() {
  try { escritorio.player?.destroy?.(); } catch { /* player já saiu */ }
  escritorio.player = null; escritorio.musicaTocando = "";
  const caixa = escritorio.musicaEl?.querySelector(".ofc-musica-player");
  if (caixa) caixa.innerHTML = '<div id="office-yt"></div>';
}
function sinucaTvLigar() {
  // Na pré-partida a TV encolhe para o radinho no canto (não cobre o cartão do lutador).
  if (typeof document !== "undefined") document.body.classList.toggle("snc-em-pre", Boolean(document.querySelector("#workflow-modal.ofc-snc-jogo .snc-pre")));
  if (typeof escritorioElementoMusica !== "function" || typeof escritorio === "undefined" || !document.querySelector("#workflow-modal.ofc-snc-jogo")) return;
  const el = escritorioElementoMusica();
  if (el.classList.contains("na-tv") && el.parentNode === document.body) return;
  if (el.parentNode && el.parentNode !== document.body && !document.getElementById("office-musica-volta")) { const volta = document.createElement("div"); volta.id = "office-musica-volta"; volta.hidden = true; el.replaceWith(volta); }
  btTvReiniciarPlayer();
  el.classList.add("na-tv"); document.body.append(el);
  if (!escritorio.musica && escritorio.conectado && typeof escritorioEmitir === "function") escritorioEmitir("music:get", {});
  if (typeof sincronizarMusicaEscritorio === "function") sincronizarMusicaEscritorio();
}
function sinucaTvDesligar() {
  document.body.classList.remove("snc-em-pre");
  const el = typeof escritorio !== "undefined" ? escritorio.musicaEl : null;
  if (!el?.classList.contains("na-tv")) return;
  btTvReiniciarPlayer();
  el.classList.remove("na-tv");
  const volta = document.getElementById("office-musica-volta");
  if (volta) volta.replaceWith(el); else el.remove();
  if (typeof sincronizarMusicaEscritorio === "function") sincronizarMusicaEscritorio();
}
// O botão 📺 do HUD: liga a TV (se a fila estiver vazia, abre o campo do link) ou alterna TV e radinho.
function sinucaTvAlternar() {
  sinucaTvLigar();
  const el = typeof escritorio !== "undefined" ? escritorio.musicaEl : null;
  if (!el) return;
  if (!escritorio.musica?.fila?.length && typeof abrirMusicaEscritorio === "function") return abrirMusicaEscritorio();
  if (typeof minimizarMusicaEscritorio === "function") minimizarMusicaEscritorio();
}
