// SINUCA: CARTÃO DO CONFRONTO E TORCIDA (Paulo, 08/11/2026).
//
// "Na hora de começar a partida entra tipo o cartão dos 2 jogadores na tela,
// tanto pra eles quanto pra quem tá assistindo... quem tá contra quem, os
// status de cada um, as principais conquistas, o taco de cada um... pra já dar
// aquele medo se o cara tiver uma conquista foda" e "quem tá assistindo pode
// apostar na partida contra quem assiste, contra quem joga... pode apostar na
// jogada de quem tá jogando (aposto 100 que não mata essa bola)".
//
// Depende de vybe-escritorio-sinuca-ui.js (SINUCA_TACOS, sinucaTacosVitrine) e
// de vybe-escritorio-sinuca.js (sinucaEstado, sinucaFichas, sinucaRetrato).

const SINUCA_RARIDADE = { lendario: "Lendário", epico: "Épico", raro: "Raro", comum: "Comum", zoeira: "Zoeira" };

// --- Pré-partida ---------------------------------------------------------------
// Paulo, 09/11/2026: "a animação de entrada não funcionou, ficou tela preta. Por
// que ela não vira uma tela de pré-entrada na partida, onde cada player tem que
// dar um preparado? E pode ser até a hora das apostas de quem tá dentro e
// assistindo". A tela VS virou a pré-partida: fica DENTRO da arena (a janela
// solta no body era o que falhava) e dura o que o servidor manda (j.pre), até
// os dois darem PREPARADO ou o relógio acabar. Quem assiste vê a mesma tela e
// aposta. Contra o bot a pré-partida é só desta tela: some no BORA.
// Quem chamou recebe a partida pela leitura automática, que não traz as fichas
// (só a abertura traz): a tela busca uma vez.
function sinucaConfrontoTalvez(j) {
  if (typeof document === "undefined" || j?.estado !== "jogando" || j.bot || sinucaFichas(j)) return;
  sinucaFichasBuscar(j);
}
const sinucaPreChave = (j) => `snc-pre:${j.id}`;
function sinucaPreAtiva(j) {
  if (!j || j.estado !== "jogando" || j.mesa?.rodizio) return false;
  if (j.pre) return true;
  if (!j.bot || !j.eu || (j.mesa?.n || 0) > 0) return false;
  const s = sinucaEstado();
  if (s.preBot?.id !== j.id) { let feito = false; try { feito = Boolean(sessionStorage.getItem(sinucaPreChave(j))); } catch { /* sem armazenamento */ } s.preBot = { id: j.id, feito }; }
  return !s.preBot.feito;
}
function sinucaPreSegundos(j) {
  return j?.pre ? Math.max(0, Math.ceil((new Date(j.pre.ate).getTime() - Date.now()) / 1000)) : 0;
}
// Diagramação de tela de luta (Paulo, 09/11/2026: "rediagrama melhor tudo
// isso"; "ter que rolar as coisas dentro de jogo não tem sentido"): cabeça com o
// relógio e o que vale; o ringue com os dois lutadores frente a frente (cada um
// com o próprio PRONTO embaixo) e o VS no meio; a barra de ação na base com o
// PREPARADO no centro e a aposta em cada lado. Cabe na tela, nada rola.
function sinucaPreLutador(j, x, lado, prontos) {
  const f = x.f, t = f?.trofeus || [], destaques = (f?.destaques || []).map((k) => t.find((c) => c.chave === k)).filter(Boolean);
  const nivel = x.bot ? (j.bot.nivel || String(j.bot.id).split(":")[1]) : null;
  const titulo = f?.titulo || (x.bot ? { nome: "Dono do bar", raridade: nivel === "lendario" ? "lendario" : nivel === "medio" ? "epico" : "raro", texto: `Bot do bar, nível ${SINUCA_NIVEL_BOT[nivel] || nivel}` } : { nome: "Estreante", raridade: "comum", texto: "Ainda sem conquista na mesa" });
  const medo = t.find((c) => c.tem && c.raridade === "lendario");
  const ok = j.bot ? lado === "desafiado" : prontos.includes(lado);
  const stats = x.bot ? `<li><b>${safeText(SINUCA_NIVEL_BOT[nivel] || "Bot")}</b><small>Nível</small></li>`
    : `<li><b>${f?.posicao ? `${f.posicao}º` : "—"}</b><small>Ranking</small></li><li><b>${f?.vitorias || 0}<i>V</i> ${f?.derrotas || 0}<i>D</i></b><small>Campanha</small></li><li><b>${f?.maior_sequencia || 0}</b><small>Maior série</small></li>`;
  const medalhas = destaques.map((c) => `<li class="${safeText(c.raridade)}" title="${safeText(c.nome)}: ${safeText(c.texto)}">${c.icone}</li>`).join("");
  return `<section class="snc-pre-lutador ${lado === "desafiante" ? "esq" : "dir"}${ok ? " pronto" : ""}${medo ? " temido" : ""}">
<div class="snc-pre-retrato" aria-hidden="true">${x.retrato ? `<img src="${safeText(x.retrato)}" alt="">` : `<i>${safeText(String(x.nome || "?")[0])}</i>`}</div>
<div class="snc-pre-dados">
<small>${x.bot ? "DESAFIO DO BAR" : f?.posicao ? `${f.posicao}º DO SALÃO` : "FORA DO RANKING"}</small>
<h2>${safeText(String(x.nome || "").split(" ")[0])}</h2>
<p class="snc-pre-titulo ${safeText(titulo.raridade)}" title="${safeText(titulo.texto || "")}">${titulo.icone ? `${titulo.icone} ` : ""}${safeText(titulo.nome)}</p>
<ul class="snc-pre-stats">${stats}</ul>
${medalhas ? `<ul class="snc-pre-medalhas" aria-label="Conquistas mais raras">${medalhas}</ul>` : ""}
<div class="snc-pre-taco"><canvas data-snc-taco="${safeText(x.taco)}" aria-hidden="true"></canvas><small>Taco ${safeText(SINUCA_TACOS[x.taco]?.nome || x.taco)}</small></div>
</div>
<p class="snc-pre-estado" role="status"><i aria-hidden="true">${ok ? "✔" : "…"}</i>${ok ? "PREPARADO" : "AQUECENDO"}</p>
</section>`;
}
function sinucaPreTickerHtml(j) {
  const t = j.torcida;
  if (!t) return "";
  const ofertas = t.apostas.filter((a) => a.estado === "oferta" && a.de.id !== t.eu && (!a.para || a.para.id === t.eu)).slice(0, 2);
  const minhas = t.apostas.filter((a) => a.estado === "oferta" && a.de.id === t.eu).slice(0, 1);
  const vivas = t.apostas.filter((a) => a.estado === "aceita").length;
  const itens = [
    ...ofertas.map((a) => `<li><span><b>${safeText(sinucaTorcidaNome(a.de, t))}</b> · ${a.valor} 🪙 que ${safeText(sinucaApostaTexto(j, a, t))}</span><button type="button" onclick="sinucaApostaAcao('aposta-topar','${safeText(a.id)}',this)">Topar</button></li>`),
    ...minhas.map((a) => `<li class="minha"><span>Sua oferta · ${a.valor} 🪙 que ${safeText(sinucaApostaTexto(j, a, t))}</span><button type="button" onclick="sinucaApostaAcao('aposta-cancelar','${safeText(a.id)}',this)">Cancelar</button></li>`),
    ...(vivas ? [`<li class="vivas"><span>${vivas} ${vivas === 1 ? "aposta valendo" : "apostas valendo"}</span></li>`] : []),
  ];
  return `<ul class="snc-pre-ticker" data-snc-pre-ticker aria-live="polite">${itens.join("") || `<li class="vazio"><span>Ninguém apostou ainda. Abre a primeira.</span></li>`}</ul>`;
}
function sinucaPreHtml(j) {
  if (!sinucaPreAtiva(j)) return "";
  const s = sinucaEstado(), entra = s.preEntrou !== j.id;
  s.preEntrou = j.id;
  const a = sinucaConfrontoLado(j, "desafiante"), b = sinucaConfrontoLado(j, "desafiado");
  const ca = sinucaFavoritismo(j, a, b), pl = j.placar || {}, prontos = j.pre?.prontos || [];
  const primeiro = (x) => safeText(String(x.nome || "").split(" ")[0]);
  const quebra = j.mesa?.vez ? primeiro(sinucaConfrontoLado(j, j.mesa.vez)) : "";
  const euPronto = j.eu && prontos.includes(j.eu), outro = j.eu ? sinucaConfrontoLado(j, mesaOutro(j.eu)) : null;
  const seg = sinucaPreSegundos(j), total = j.pre?.total || 60;
  const relogio = j.pre ? `<div class="snc-pre-relogio" data-snc-pre-ate="${safeText(j.pre.ate)}" style="--p:${seg / total}" role="timer" aria-label="A partida abre sozinha em ${seg} segundos"><b>${seg}</b><small>SEG</small></div>` : "";
  const acao = j.bot ? '<button type="button" class="snc-pre-pronto" onclick="sinucaPreBora()">BORA JOGAR ▸</button>'
    : !j.eu ? '<p class="snc-pre-aviso"><b>NA ARQUIBANCADA</b>Aposte antes da quebra</p>'
    : euPronto ? `<p class="snc-pre-aviso ok"><b>✔ PREPARADO</b>Esperando ${primeiro(outro)}</p>`
    : '<button type="button" class="snc-pre-pronto" onclick="sinucaPrePronto(this)">PREPARADO</button>';
  // Aposta de um toque: o valor escolhido na vitória de um lado, aberta para quem topar.
  const bil = sinucaBilhete(), podeApostar = Boolean(j.torcida);
  const apostaEm = (x, lado) => {
    if (!podeApostar) return '<span class="snc-pre-aposta vazia"></span>';
    if (j.eu && j.eu !== lado) return `<span class="snc-pre-aposta vazia" title="Quem joga só aposta em si"></span>`;
    return `<button type="button" class="snc-pre-aposta ${lado === "desafiante" ? "esq" : "dir"}" onclick="sinucaPreApostar('${lado}',this)"><small>${j.eu === lado ? "APOSTO EM MIM" : "APOSTAR EM"}</small><b>${bil.valor} 🪙 · ${primeiro(x)}</b></button>`;
  };
  const fichas = podeApostar ? `<div class="snc-pre-fichas" role="group" aria-label="Valor da aposta">${[10, 50, 100, 500].map((v) => `<button type="button" aria-pressed="${bil.valor === v}" onclick="sinucaPreValor(${v})">${v}</button>`).join("")}</div>` : "";
  return `<div class="snc-pre${entra ? " entra" : ""}" role="dialog" aria-label="Pré-partida: ${primeiro(a)} contra ${primeiro(b)}">
<div class="snc-pre-fundo" aria-hidden="true"></div>
<div class="snc-pre-cabeca"><small>${j.bot ? "DESAFIO DO BAR" : "PRÉ-PARTIDA"}</small>${relogio}<p>${j.moedas ? `Valendo ${j.moedas} 🪙` : j.bot ? "Desafio do bar" : "Amistoso"}${quebra ? ` · ${quebra} quebra` : ""}</p></div>
<div class="snc-pre-ringue">
${sinucaPreLutador(j, a, "desafiante", prontos)}
<div class="snc-pre-centro"><b class="snc-pre-vs">VS</b>${!a.bot && !b.bot ? `<p class="snc-pre-entre"><small>ENTRE VOCÊS</small><b>${pl[String(a.p.id)] || 0}<i>×</i>${pl[String(b.p.id)] || 0}</b></p>` : ""}${ca == null ? "" : `<div class="snc-pre-fav" aria-label="Favoritismo: ${primeiro(a)} ${ca}%, ${primeiro(b)} ${100 - ca}%"><span><i style="width:${ca}%"></i></span><p><b>${ca}%</b><small>FAVORITISMO</small><b>${100 - ca}%</b></p></div>`}</div>
${sinucaPreLutador(j, b, "desafiado", prontos)}
</div>
${podeApostar ? sinucaPreTickerHtml(j) : ""}
<div class="snc-pre-barra">${apostaEm(a, "desafiante")}<div class="snc-pre-acao">${acao}${fichas}</div>${apostaEm(b, "desafiado")}</div>
<p class="snc-torcida-erro snc-pre-erro" role="alert"></p>
</div>`;
}
function sinucaPreValor(v) { sinucaBilhete().valor = v; desenharJogoMesa("snc"); }
function sinucaPreApostar(lado, botao) {
  const aposta = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  sinucaApostaPedido({ acao: "aposta-oferecer", aposta, tipo: "vitoria", escolha: lado, valor: sinucaBilhete().valor, para: null }, botao, document.querySelector(".snc-pre-erro"));
}
// Relógio da pré-partida: conta na tela e, quando acaba, relê a mesa (o
// servidor abre a partida sozinho).
function sinucaPreRelogio() {
  const s = sinucaEstado();
  clearInterval(s.preTimer); s.preTimer = null;
  if (!document.querySelector(".ofc-snc-jogo [data-snc-pre-ate]")) return;
  s.preTimer = setInterval(() => {
    const el = document.querySelector(".ofc-snc-jogo [data-snc-pre-ate]"), j = sinucaEstado().jogo;
    if (!el || !j?.pre) { clearInterval(s.preTimer); s.preTimer = null; return; }
    const seg = sinucaPreSegundos(j);
    el.style.setProperty("--p", seg / (j.pre.total || 60));
    el.querySelector("b").textContent = seg;
    el.classList.toggle("fim", seg <= 10);
    if (seg <= 0) { clearInterval(s.preTimer); s.preTimer = null; setTimeout(() => recarregarJogoMesa("snc"), 600); }
  }, 250);
}
function sinucaPrePronto(botao) {
  sinucaSom?.("taco", 1);
  acaoMesaEscritorio("snc", "pronto", botao);
}
function sinucaPreBora() {
  const s = sinucaEstado(), j = s.jogo;
  if (!j) return;
  try { sessionStorage.setItem(sinucaPreChave(j), "1"); } catch { /* fica só nesta tela */ }
  s.preBot = { id: j.id, feito: true };
  sinucaSom?.("taco", 1);
  desenharJogoMesa("snc");
}
// Quando a pré-partida fecha (os dois prontos), quem não quebra vê o VALENDO.
function sinucaPreSaiu(j) {
  const s = sinucaEstado();
  if (!j || s.preEntrou !== j.id || s.preSaiu === j.id || sinucaPreAtiva(j)) return;
  s.preSaiu = j.id;
  if (j.eu && j.vez === j.eu) return;
  sinucaLetreiro("VALENDO!", `${xadrezPrimeiroNome(j[j.vez])} quebra`);
}
// Busca as fichas da partida uma vez (a leitura sem "visto" traz) e redesenha:
// a barra dos jogadores ganha título e conquistas, e a tela VS entra.
function sinucaFichasBuscar(j) {
  const s = sinucaEstado();
  if (!j || j.bot || sinucaFichas(j) || s.fichasBusca === j.id || typeof escritorioApi !== "function") return;
  s.fichasBusca = j.id;
  escritorioApi("mesa", null, { id: j.id }).then((r) => {
    if (!r?.jogo?.fichas || sinucaEstado().jogo?.id !== j.id) return;
    s.fichas = { id: j.id, lista: r.jogo.fichas };
    desenharJogoMesa("snc");
  }).catch(() => { s.fichasBusca = null; });
}
function sinucaConfrontoLado(j, lado) {
  const p = j[lado] || {}, bot = j.bot && String(p.id) === "bot";
  const nivel = bot ? (j.bot.nivel || String(j.bot.id).split(":")[1]) : null;
  const f = bot ? null : sinucaFichas(j)?.[String(p.id)];
  const retrato = bot ? sinucaRetrato(nivel) : mesaCabecaUrl(j, p);
  const taco = sinucaTacoModelo(j, lado);
  return { p, bot, f, retrato, taco, nome: bot ? (j.bot.nome || p.nome) : (p.nome || xadrezPrimeiroNome(p)) };
}
// Chance de cada um: aproveitamento com um empurrão para quem joga pouco
// (duas partidas fantasmas, uma ganha e uma perdida) e o confronto direto.
function sinucaFavoritismo(j, a, b) {
  if (a.bot || b.bot) return null;
  const forca = (f) => ((f?.vitorias || 0) + 1) / ((f?.jogos || 0) + 2);
  const pa = forca(a.f), pb = forca(b.f), pl = j.placar || {}, va = pl[String(a.p.id)] || 0, vb = pl[String(b.p.id)] || 0;
  const direto = (va + 1) / (va + vb + 2), base = pa / (pa + pb);
  return Math.round(100 * (0.7 * base + 0.3 * direto));
}
// Tela de luta (Paulo, 08/11/2026: "não gostei, deixa mais foda! e tem que falar
// o que é cada título, não só o nome"): dois painéis em diagonal na tela toda,
// cada um com a cor do lado, o retrato grande, o título com o que ele quer dizer,
// a zoeira com o motivo, os números em barra, o taco atravessado e as três
// conquistas mais raras explicadas. O VS bate no meio e a tela treme.
const SINUCA_NIVEL_BOT = { facil: "Fácil", medio: "Médio", lendario: "Lendário" };
function sinucaConfrontoCartao(j, x, chance, lado) {
  const f = x.f, t = f?.trofeus || [], destaques = (f?.destaques || []).map((k) => t.find((c) => c.chave === k)).filter(Boolean);
  const medo = t.find((c) => c.tem && c.raridade === "lendario");
  const nivel = x.bot ? (j.bot.nivel || String(j.bot.id).split(":")[1]) : null;
  const aprov = f?.jogos ? Math.round((100 * f.vitorias) / f.jogos) : 0;
  const titulo = f?.titulo || (x.bot ? { nome: "Dono do bar", raridade: nivel === "lendario" ? "lendario" : nivel === "medio" ? "epico" : "raro", texto: `Bot do bar, nível ${SINUCA_NIVEL_BOT[nivel] || nivel}` } : { nome: "Estreante", raridade: "comum", texto: "Ainda sem conquista na mesa" });
  const numeros = x.bot ? `<div class="snc-vs-num"><small>Nível</small><b>${safeText(SINUCA_NIVEL_BOT[nivel] || "Bot")}</b></div>`
    : `<div class="snc-vs-num"><small>Ranking</small><b>${f?.posicao ? `${f.posicao}º` : "—"}</b></div><div class="snc-vs-num"><small>Vitórias · derrotas</small><b>${f?.vitorias || 0}<i>V</i> ${f?.derrotas || 0}<i>D</i></b></div><div class="snc-vs-num"><small>Maior série</small><b>${f?.maior_sequencia || 0}</b></div>
<div class="snc-vs-barra"><small>Aproveitamento <b>${aprov}%</b></small><span><i style="width:${aprov}%"></i></span></div>`;
  const medalhas = destaques.map((c, i) => `<li class="${safeText(c.raridade)}" style="--i:${i}"><i>${c.icone}</i><div><b>${safeText(c.nome)}${c.vezes > 1 ? ` ×${c.vezes}` : ""}</b><span>${safeText(c.texto)}</span></div><em>${SINUCA_RARIDADE[c.raridade]}</em></li>`).join("")
    || `<li class="vazio"><div><b>${x.bot ? "Na mesa dele" : "Ficha em branco"}</b><span>${x.bot ? safeText(j.bot.frase || "Quem manda aqui é ele.") : "Nenhuma conquista ainda. Hoje pode ser o dia."}</span></div></li>`;
  return `<section class="snc-vs-lado ${lado}${medo ? " temido" : ""}">
<div class="snc-vs-retrato" aria-hidden="true">${x.retrato ? `<img src="${safeText(x.retrato)}" alt="">` : `<i>${safeText(String(x.nome || "?")[0])}</i>`}</div>
<div class="snc-vs-info">
<small class="snc-vs-pos">${x.bot ? "DESAFIO DO BAR" : f?.posicao ? `${f.posicao}º DO SALÃO` : "FORA DO RANKING"}</small>
<h2>${safeText(String(x.nome || "").split(" ")[0])}</h2>
<div class="snc-vs-titulo ${safeText(titulo.raridade)}"><b>${titulo.icone ? `${titulo.icone} ` : ""}${safeText(titulo.nome)}</b><span>${safeText(titulo.texto || "")}</span></div>
${f?.apelido ? `<div class="snc-vs-apelido"><b>${f.apelido.icone} ${safeText(f.apelido.nome)}</b><span>${safeText(f.apelido.texto || "")}</span></div>` : ""}
<div class="snc-vs-numeros">${numeros}</div>
<div class="snc-vs-taco"><canvas data-snc-taco="${safeText(x.taco)}" aria-hidden="true"></canvas><small>Taco ${safeText(SINUCA_TACOS[x.taco]?.nome || x.taco)}</small></div>
<ul class="snc-vs-medalhas">${medalhas}</ul>
${medo ? `<p class="snc-vs-medo"><b>⚠ CUIDADO</b> conquista lendária na ficha: ${safeText(medo.nome)}</p>` : ""}
</div></section>`;
}
// --- Torcida -----------------------------------------------------------------
// Quem assiste manda um sinal a cada 25 s (aparece na lista da torcida e pode
// receber oferta). Quem joga não precisa: já está na mesa.
function sinucaTorcidaSinal(j) {
  const s = sinucaEstado();
  if (!j || j.eu || j.estado !== "jogando" || j.bot || !j.torcida) return;
  if (s.sinalTorcida?.id === j.id && Date.now() - s.sinalTorcida.em < 25000) return;
  s.sinalTorcida = { id: j.id, em: Date.now() };
  escritorioApi("mesa-acao", { id: j.id, acao: "assistindo" }).catch(() => {});
}
const sinucaTorcidaNome = (p, t) => (!p ? "qualquer um" : p.id === t.eu ? "você" : String(p.nome || "").split(" ")[0]);
function sinucaApostaTexto(j, a, t) {
  const quem = (l) => (j[l]?.id === undefined ? l : String(j[l]?.id) === t.eu ? "você" : xadrezPrimeiroNome(j[l]));
  return a.tipo === "vitoria" ? `${quem(a.escolha)} ganha a partida` : `${quem(a.tacador)} ${a.escolha === "mata" ? "mata" : "não mata"} na tacada ${a.rodada + 1}`;
}
function sinucaTorcidaHtml(j) {
  const t = j.torcida;
  if (!t) return '<div class="snc-vazio"><h3>Sem torcida aqui.</h3><p>Aposta da torcida vale nas partidas 1×1 entre a equipe.</p></div>';
  const eu = t.eu, jogando = j.estado === "jogando", vez = j.mesa?.vez, nomeVez = vez ? (String(j[vez]?.id) === eu ? "você" : xadrezPrimeiroNome(j[vez])) : "";
  const meuLado = ["desafiante", "desafiado"].find((l) => String(j[l]?.id) === eu);
  const ofertas = t.apostas.filter((a) => a.estado === "oferta"), vivas = t.apostas.filter((a) => a.estado === "aceita"), feitas = t.apostas.filter((a) => !["oferta", "aceita"].includes(a.estado)).slice(0, 6);
  const linha = (a) => {
    const minha = a.de.id === eu, pode = jogando && a.estado === "oferta" && !minha && (!a.para || a.para.id === eu);
    const acao = minha && a.estado === "oferta" ? `<button type="button" onclick="sinucaApostaAcao('aposta-cancelar','${safeText(a.id)}',this)">Cancelar</button>`
      : pode ? `<button type="button" class="topar" onclick="sinucaApostaAcao('aposta-topar','${safeText(a.id)}',this)">Topar ${a.valor}</button>` : "";
    const fim = a.estado === "paga" ? `<em class="ganhou">${a.ganhador === eu ? "Você levou" : `${sinucaTorcidaNome(a.ganhador === a.de.id ? a.de : a.com, t)} levou`} ${a.valor * 2}</em>` : a.estado === "devolvida" ? '<em>Devolvida</em>' : a.estado === "expirada" ? '<em>Ninguém topou</em>' : a.estado === "cancelada" ? '<em>Cancelada</em>' : "";
    return `<li class="${safeText(a.estado)}"><b>${a.valor}<i>🪙</i></b><span><strong>${safeText(sinucaTorcidaNome(a.de, t))}</strong> aposta que ${safeText(sinucaApostaTexto(j, a, t))}${a.estado === "aceita" ? ` · <strong>${safeText(sinucaTorcidaNome(a.com, t))}</strong> topou` : a.para ? ` · para ${safeText(sinucaTorcidaNome(a.para, t))}` : " · aberta"}</span>${acao}${fim}</li>`;
  };
  const pessoas = [...["desafiante", "desafiado"].map((l) => ({ id: String(j[l]?.id), nome: j[l]?.nome })), ...t.assistindo].filter((p) => p.id && p.id !== eu);
  // Bilhete de aposta (Paulo, 08/11/2026: "tudo com cara de jogo"): nada de
  // caixa de seleção; o palpite, o valor e o adversário são botões grandes.
  const b = sinucaBilhete(j), opcoes = [];
  if (jogando && vez) {
    const minhaVez = j.vez === meuLado, cor = vez === "desafiado" ? "giz" : "laranja";
    opcoes.push({ id: "tacada:mata", cor, icone: "🎯", titulo: minhaVez ? "EU MATO" : `${nomeVez.toUpperCase()} MATA`, texto: `Na tacada ${(j.mesa?.n || 0) + 1}` });
    if (!minhaVez) opcoes.push({ id: "tacada:nao", cor: "falta", icone: "🙅", titulo: `${nomeVez.toUpperCase()} NÃO MATA`, texto: `Na tacada ${(j.mesa?.n || 0) + 1}` });
  }
  for (const l of ["desafiante", "desafiado"]) if (!meuLado || l === meuLado) opcoes.push({ id: `vitoria:${l}`, cor: l === "desafiado" ? "giz" : "laranja", icone: "🏆", titulo: `${String(j[l]?.id) === eu ? "EU" : xadrezPrimeiroNome(j[l]).toUpperCase()} GANHA`, texto: "A partida" });
  if (!opcoes.some((o) => o.id === b.em)) b.em = opcoes[0]?.id || "";
  const form = jogando ? `<div class="snc-bilhete">
<div class="snc-bilhete-linha"><small>1 · O PALPITE</small><div class="snc-bilhete-opcoes">${opcoes.map((o) => `<button type="button" class="${o.cor}" aria-pressed="${b.em === o.id}" onclick="sinucaBilhete().em='${o.id}';sinucaTorcidaRedesenhar()"><i>${o.icone}</i><b>${safeText(o.titulo)}</b><small>${safeText(o.texto)}</small></button>`).join("")}</div></div>
<div class="snc-bilhete-linha"><small>2 · QUANTO</small><div class="snc-bilhete-valor">${[10, 50, 100, 500].map((v) => `<button type="button" class="ficha" aria-pressed="${b.valor === v}" onclick="sinucaBilhete().valor=${v};sinucaTorcidaRedesenhar()">${v}</button>`).join("")}<span class="snc-bilhete-passo"><button type="button" aria-label="Menos" onclick="sinucaBilhete().valor=Math.max(1,sinucaBilhete().valor-10);sinucaTorcidaRedesenhar()">−</button><b>${b.valor}<i>🪙</i></b><button type="button" aria-label="Mais" onclick="sinucaBilhete().valor=Math.min(${t.max},sinucaBilhete().valor+10);sinucaTorcidaRedesenhar()">+</button></span></div></div>
<div class="snc-bilhete-linha"><small>3 · CONTRA QUEM</small><div class="snc-bilhete-pessoas"><button type="button" aria-pressed="${!b.para}" onclick="sinucaBilhete().para=null;sinucaTorcidaRedesenhar()"><i>★</i><b>Quem topar</b></button>${pessoas.map((p) => `<button type="button" aria-pressed="${b.para === p.id}" onclick="sinucaBilhete().para='${safeText(p.id)}';sinucaTorcidaRedesenhar()"><i>${safeText(String(p.nome || "?")[0])}</i><b>${safeText(String(p.nome || "Alguém").split(" ")[0])}</b></button>`).join("")}</div></div>
<button type="button" class="snc-torcida-oferecer" onclick="sinucaApostaOferecer(this)">LANÇAR APOSTA · ${b.valor} 🪙</button><p class="snc-torcida-erro" role="alert"></p></div>` : "";
  return `<div class="snc-torcida" data-snc-torcida>
<header><small>NA ARQUIBANCADA</small><p>${t.assistindo.length ? t.assistindo.map((p) => `<span>${safeText(String(p.nome).split(" ")[0])}</span>`).join("") : "Ninguém assistindo agora."}</p></header>
${form}
${ofertas.length ? `<h4>Na mesa, esperando quem tope</h4><ul>${ofertas.map(linha).join("")}</ul>` : ""}
${vivas.length ? `<h4>Valendo</h4><ul>${vivas.map(linha).join("")}</ul>` : ""}
${feitas.length ? `<h4>Já resolvidas</h4><ul>${feitas.map(linha).join("")}</ul>` : ""}
<p class="snc-torcida-nota">Até ${t.max} VybeCoins por aposta. As moedas dos dois saem quando alguém topa; quem acertar leva o dobro. Na própria tacada, quem joga só aposta que mata.</p></div>`;
}
// Atualiza só o painel da torcida (as leituras de 4 s trazem as apostas novas
// sem redesenhar a mesa, que pode estar no meio da mira).
function sinucaTorcidaAtualizar(j) {
  if (typeof document === "undefined") return;
  // A torcida pode estar em dois lugares: na gaveta e na pré-partida.
  for (const el of document.querySelectorAll(".ofc-snc-jogo [data-snc-torcida]")) if (!el.contains(document.activeElement)) el.outerHTML = sinucaTorcidaHtml(j);
  const ticker = document.querySelector(".ofc-snc-jogo [data-snc-pre-ticker]");
  if (ticker && !ticker.contains(document.activeElement)) ticker.outerHTML = sinucaPreTickerHtml(j);
  const feed = document.querySelector(".ofc-snc-jogo [data-snc-feed]");
  if (feed && !feed.contains(document.activeElement)) feed.outerHTML = sinucaFeedHtml(j);
  const aba = document.querySelector('.ofc-snc-jogo [data-snc-aba="torcida"] em');
  const n = (j.torcida?.apostas || []).filter((a) => a.estado === "oferta" && a.de.id !== j.torcida.eu).length;
  if (aba) aba.textContent = n ? String(n) : "";
}
async function sinucaApostaPedido(corpo, botao, erroEl) {
  const s = sinucaEstado(), j = s.jogo;
  if (!j) return;
  if (botao) botao.disabled = true;
  try {
    const r = await escritorioApi("mesa-acao", { id: j.id, ...corpo });
    if (r.economia) xadrezEconomia(r.economia);
    if (r.jogo && s.jogo?.id === j.id) { s.jogo = { ...s.jogo, torcida: r.jogo.torcida }; sinucaTorcidaAtualizar(s.jogo); }
    jogosSom?.("moeda");
  } catch (e) {
    if (botao) botao.disabled = false;
    if (erroEl) erroEl.textContent = e.message; else sinucaAvisar?.(e.message);
  }
}
// O bilhete guarda o palpite entre um desenho e outro (por partida).
function sinucaBilhete() {
  const s = sinucaEstado(), id = s.jogo?.id;
  if (!s.bilhete || s.bilhete.jogo !== id) s.bilhete = { jogo: id, em: "", valor: 100, para: null };
  return s.bilhete;
}
function sinucaTorcidaRedesenhar() {
  const j = sinucaEstado().jogo;
  if (j) for (const el of document.querySelectorAll(".ofc-snc-jogo [data-snc-torcida]")) el.outerHTML = sinucaTorcidaHtml(j);
}
function sinucaApostaOferecer(botao) {
  const b = sinucaBilhete(), [tipo, escolha] = String(b.em).split(":");
  const aposta = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  sinucaApostaPedido({ acao: "aposta-oferecer", aposta, tipo, escolha, valor: Math.round(b.valor), para: b.para || null }, botao, botao.parentNode.querySelector(".snc-torcida-erro"));
}
function sinucaApostaAcao(acao, aposta, botao) { sinucaApostaPedido({ acao, aposta }, botao); }
// Feed da torcida na borda da mesa cheia (Paulo, 09/11/2026): as ofertas que dá
// para topar, as apostas valendo e quem chegou, curtinhas, com o TOPAR na linha.
function sinucaFeedHtml(j) {
  const t = j?.torcida;
  if (!t || j.estado !== "jogando") return "";
  const nome = (p) => safeText(sinucaTorcidaNome(p, t));
  const ofertas = t.apostas.filter((a) => a.estado === "oferta" && a.de.id !== t.eu && (!a.para || a.para.id === t.eu)).slice(0, 3);
  const vivas = t.apostas.filter((a) => a.estado === "aceita").slice(0, 2);
  const itens = [
    ...ofertas.map((a) => `<li class="oferta"><span><b>${nome(a.de)}</b> aposta ${a.valor} 🪙 que ${safeText(sinucaApostaTexto(j, a, t))}</span><button type="button" onclick="sinucaApostaAcao('aposta-topar','${safeText(a.id)}',this)">Topar</button></li>`),
    ...vivas.map((a) => `<li><span><b>${nome(a.de)}</b> × <b>${nome(a.com)}</b> · ${a.valor} 🪙 · ${safeText(sinucaApostaTexto(j, a, t))}</span></li>`),
    ...(t.assistindo.length ? [`<li class="gente"><span>${t.assistindo.length === 1 ? `${safeText(String(t.assistindo[0].nome).split(" ")[0])} está assistindo` : `${t.assistindo.length} assistindo`}</span></li>`] : []),
  ];
  return `<ul class="snc-feed" data-snc-feed aria-label="Torcida" aria-live="polite">${itens.join("")}</ul>`;
}
// O atalho da vez do outro: 100 que ele não mata, aberto para quem topar.
function sinucaApostaRapida(botao) {
  const aposta = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  sinucaApostaPedido({ acao: "aposta-oferecer", aposta, tipo: "tacada", escolha: "nao", valor: 100, para: null }, botao);
  if (botao) botao.textContent = "Aposta lançada · esperando quem tope";
}

// --- Conquistas (aba do salão) ---------------------------------------------
// Paulo, 08/11/2026: "melhora toda UI UX também de tudo e todos os menus". As
// conquistas novas precisam de um lugar para ver o que tem, o que falta e o que
// cada uma quer dizer: o título de agora em cima, a contagem por raridade e o
// catálogo inteiro (com as zoeiras à parte), filtrável.
const SINUCA_ORDEM_RAR = ["lendario", "epico", "raro", "comum", "zoeira"];
function sinucaConquistasHtml() {
  // A aba Conquistas é a estante do bar (Paulo, 08/11/2026: "todas as outras
  // abas também"): medalhas na madeira, zoeiras no mural; tocar diz o que é.
  const x = escritorioXadrez(), salao = x.extras?.jogo === "sinuca" ? x.extras.bots?.salao : null, eu = String(escritorio.base?.eu || "");
  const f = salao?.fichas?.[eu];
  const topo = '<div class="snc-painel-topo"><div><small>FEITOS, TÍTULOS E ZOEIRAS</small><h2>Sua estante</h2></div></div>';
  if (!f) return `${topo}<p class="snc-vazio">Carregando a sua ficha…</p>`;
  const RAR = { lendario: 4, epico: 3, raro: 2, comum: 1 }, boas = f.trofeus.filter((t) => !t.zoeira), zoeiras = f.trofeus.filter((t) => t.zoeira);
  const leg = (t) => `tabindex="0" onclick="sinucaFichaLegenda(this,'${safeText(String(t.nome).replace(/'/g, "’"))}','${safeText(String(t.texto).replace(/'/g, "’"))}')" onmouseenter="this.onclick()" onfocus="this.onclick()"`;
  const medalhas = [...boas].sort((a, b) => (b.tem - a.tem) || ((RAR[b.raridade] || 1) - (RAR[a.raridade] || 1))).map((t) => `<li class="${t.tem ? "tem" : "falta"} ${safeText(t.raridade)}" ${leg(t)}><i>${t.tem ? t.icone : "?"}</i>${t.vezes > 1 ? `<em>×${t.vezes}</em>` : ""}<b>${safeText(t.nome)}</b></li>`).join("");
  const mural = zoeiras.map((t, i) => `<li class="${t.tem ? "" : "vazio"}" style="--g:${(i % 3 - 1) * 3}deg" ${leg(t)}><i>${t.tem ? t.icone : "📌"}</i><b>${t.tem ? safeText(t.nome) : "???"}</b><small>${safeText(t.texto)}</small></li>`).join("");
  return `${topo}<div class="snc-cf snc-estante-aba"><p class="snc-cf-legenda" aria-live="polite"><b>Toque ou passe o mouse</b> numa medalha para ver o que ela é.</p>
<section class="snc-cf-medalhas"><h3>ESTANTE DE CONQUISTAS <small>${boas.filter((t) => t.tem).length}/${boas.length}</small></h3><ul>${medalhas}</ul></section>
<section class="snc-cf-mural"><h3>MURAL DA ZOEIRA <small>${zoeiras.filter((t) => t.tem).length}/${zoeiras.length}</small></h3><ul>${mural}</ul></section></div>`;
}

// --- Temporada da sinuca como liga (pente fino, 08/11/2026) ---------------------
// A lista genérica dos jogos (emoji e texto corrido) vira tela de liga: o tempo
// que falta em destaque, os três prêmios num pódio e a tabela como placas.
function sinucaTemporadaHtml(t) {
  // Liga do boteco: o pódio com os líderes de agora (retrato em cima do degrau
  // e o prêmio na frente dele) e o resto da tabela no quadro de giz.
  const data = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const fim = new Date(new Date(`${t.fim}T00:00:00-03:00`).getTime() - 86400000).toISOString().slice(0, 10);
  const ms = Math.max(0, new Date(t.termina_em).getTime() - Date.now()), dias = Math.floor(ms / 86400000), horas = Math.floor((ms % 86400000) / 3600000);
  const pr = Object.fromEntries((t.premios || []).map((p) => [p.posicao, p])), rk = t.ranking || [];
  const degrau = (pos) => { const p = rk.find((r) => r.posicao === pos), z = pr[pos], u = p && escritorioCabecaUrl?.(p.id);
    return `<div class="snc-liga-degrau p${pos}${p?.eu ? " eu" : ""}"><div class="snc-liga-quem">${p ? `<span class="snc-liga-foto">${u ? `<img src="${safeText(u)}" alt="">` : `<i>${safeText(String(p.nome)[0])}</i>`}</span><b>${safeText(String(p.nome).split(" ")[0])}</b><small>${p.vitorias} vitória${p.vitorias === 1 ? "" : "s"}</small>` : '<span class="snc-liga-foto vago"><i>?</i></span><b>Vago</b>'}</div>
<div class="snc-liga-bloco"><em>${pos}º</em>${z ? `<span>${z.moedas} 🪙</span><small>+${z.xp} XP${z.trofeu ? " · 🏆" : ""}</small>` : ""}</div></div>`; };
  const giz = rk.filter((p) => p.posicao > 3).map((p) => `<li class="${p.eu ? "eu" : ""}"><em>${p.posicao}º</em><b>${safeText(String(p.nome).split(" ")[0])}</b><span>${"|".repeat(Math.min(p.vitorias, 12))}${p.vitorias > 12 ? ` ${p.vitorias}` : ""}</span></li>`).join("");
  const campeoes = t.anterior?.campeoes?.length ? `<p class="snc-liga-anterior"><small>CAMPEÕES DA ANTERIOR</small>${t.anterior.campeoes.map((c) => `<span class="p${c.posicao}">${c.posicao}º ${safeText(String(c.nome).split(" ")[0])}</span>`).join("")}</p>` : "";
  return `<section class="snc-liga"><div class="snc-liga-topo"><div><small>TEMPORADA ${data(t.inicio)} – ${data(fim)}</small><p>Contam só vitórias contra colegas (até 3 contra a mesma pessoa por dia).</p></div><div class="snc-liga-relogio"><small>TERMINA EM</small><b>${dias}<i>d</i> ${String(horas).padStart(2, "0")}<i>h</i></b></div></div>
${typeof btPodioHtml === "function" ? btPodioHtml([1, 2, 3].map((pos) => { const p = rk.find((r) => r.posicao === pos), z = pr[pos]; return p && { pos, id: p.id, nome: p.nome, sub: `${p.vitorias} vitória${p.vitorias === 1 ? "" : "s"}`, eu: p.eu, premio: z ? `${z.moedas} 🪙 · +${z.xp} XP${z.trofeu ? " · 🏆" : ""}` : "" }; }).filter(Boolean)) : `<div class="snc-liga-podio2">${degrau(2)}${degrau(1)}${degrau(3)}</div>`}
${giz ? `<ol class="snc-giz">${giz}</ol>` : rk.length ? "" : '<p class="snc-giz-vazio">Ninguém venceu nesta temporada ainda. A primeira vitória contra um colega já põe você no pódio.</p>'}${campeoes}</section>`;
}

// --- Seu bar (o salão, embaixo da equipe) -------------------------------------
// O espaço vazio do salão vira o seu resumo: título, apelido e as próximas
// conquistas que dá para buscar (as mais fáceis que ainda faltam).
function sinucaSeuBarHtml() {
  const x = escritorioXadrez(), salao = x.extras?.jogo === "sinuca" ? x.extras.bots?.salao : null, eu = String(escritorio.base?.eu || "");
  const f = salao?.fichas?.[eu];
  if (!f) return "";
  const ordem = { comum: 0, raro: 1, epico: 2, lendario: 3 };
  const proximas = f.trofeus.filter((t) => !t.tem && !t.zoeira).sort((a, b) => ordem[a.raridade] - ordem[b.raridade]).slice(0, 3);
  const tem = f.trofeus.filter((t) => t.tem && !t.zoeira).length, total = f.trofeus.filter((t) => !t.zoeira).length;
  return `<section class="snc-seubar so-proximas"><div class="snc-seubar-proximas"><small>PRÓXIMAS CONQUISTAS</small>${proximas.map((t) => `<button type="button" class="snc-feito falta ${safeText(t.raridade)}" onclick="sinucaLobbySecao('conquistas')"><i>🔒</i><div><b>${safeText(t.nome)}</b><span>${safeText(t.texto)}</span></div><small>${SINUCA_RARIDADE[t.raridade]}</small></button>`).join("") || '<p>Você tem todas. Respeito.</p>'}</div></section>`;
}

// --- Desafiar a equipe = seleção de lutador (Paulo, 08/11/2026: "por que
// continuou igual?") ----------------------------------------------------------
// Nada de grade de cartões: os jogadores são retratos em hexágono (a luz verde
// é quem está no escritório) e, ao lado, a carta de jogador de quem está em
// foco, grande, com DESAFIAR e VER FICHA. Passar o mouse ou tocar troca o foco.
