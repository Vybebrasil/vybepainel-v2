// Xadrez no tabuleiro do Escritório (pedido do Paulo, 27/10/2026): clicar no
// tabuleiro chama alguém que está online para uma partida, de graça ou valendo
// VybeCoins e móveis/roupas. Quem passa pelo tabuleiro durante a partida
// assiste. Regras, aposta e prêmio ficam no servidor (server/escritorio-xadrez.js);
// aqui só se desenha e se pede o lance. O aviso de "a partida mudou" vai pelo
// balão de comando (xdz=<id>:<para>:<c|l>), como a troca; a tela aberta também
// relê sozinha a cada poucos segundos.
// O convite, a aposta e o aviso servem a todas as mesas de jogo: cada jogo
// passa a sua configuração (o dominó, em vybe-escritorio-domino.js, usa as
// mesmas telas com as rotas "mesa").
const ESCRITORIO_XADREZ = /chessboard/;
const XADREZ_CFG = {
  nome: "Xadrez", artigo: "o xadrez", lista: "xadrez", desafiar: "xadrez-desafiar", responder: "xadrez-responder", extra: {},
  sinal: "xdz", nota: "As cores são sorteadas.", abrir: (j) => abrirJogoXadrez(j),
  aberto: (id) => (escritorioXadrez().jogo?.id === id ? (recarregarJogoXadrez(), true) : false),
};
const XADREZ_COLUNAS = "abcdefgh";
const XADREZ_NOME_PECA = { q: "Dama", r: "Torre", b: "Bispo", n: "Cavalo" };

function escritorioXadrez() {
  return (escritorio.xadrez ||= { jogo: null, sel: null, promo: null, nova: null, timer: null });
}
function xadrezChave() {
  return (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g, "");
}
function xadrezPrimeiroNome(p) {
  return safeText(String(p?.nome || "").split(" ")[0] || "Alguém");
}
function mesaSinal(cfg, j, para, tipo) {
  escritorioEmitir("chat:bubble", { texto: ESCRITORIO_COMANDO + cfg.sinal + "=" + j + ":" + para + ":" + tipo });
}
function xadrezSinal(j, para, tipo) {
  mesaSinal(XADREZ_CFG, j, para, tipo);
}
function mesaCfg() {
  return escritorioXadrez().cfg || XADREZ_CFG;
}
function xadrezPoeSprite() {
  if (document.getElementById("xdz-sprite")) return;
  const d = document.createElement("div");
  d.id = "xdz-sprite";
  d.innerHTML = XADREZ_PECAS_SVG;
  document.body.append(d);
}
function xadrezModal(html, classe) {
  const modal = document.getElementById("workflow-modal");
  if (modal?.classList.contains(classe)) { const y = modal.scrollTop; modal.innerHTML = html; modal.scrollTop = y; return; }
  openWorkflowModal(html);
  document.getElementById("workflow-modal")?.classList.add("ofc-xdz", classe);
}
function xadrezFechar() {
  const x = escritorioXadrez();
  clearInterval(x.timer);
  x.timer = null; x.jogo = null; x.sel = null; x.promo = null; x.nova = null;
  closeWorkflowModal();
}

// Clicou no tabuleiro (ou apertou E perto dele).
function abrirXadrezEscritorio(m) {
  return abrirMesaEscritorio(m, XADREZ_CFG);
}
async function abrirMesaEscritorio(m, cfg) {
  if (escritorio.base?.demo) return escritorioAviso(`A demonstração não tem partidas de ${cfg.nome.toLowerCase()}.`);
  const mesa = { camada: escritorio.quarto || "praca", movel: escritorio.mapa.chaveMovel(m) };
  let d;
  try { d = await escritorioApi(cfg.lista, null, { ...mesa, ...cfg.extra }); } catch (e) { return escritorioAviso(e.message); }
  if (!d.disponivel) return escritorioAviso(`${cfg.artigo[0].toUpperCase() + cfg.artigo.slice(1)} aguarda a migração do banco.`);
  xadrezPoeSprite();
  const x = escritorioXadrez();
  x.mesa = mesa; x.cfg = cfg;
  if (d.jogos[0]) return cfg.abrir(d.jogos[0]);
  if (d.mesa) return cfg.abrir(d.mesa);
  if (d.convites[0]) return desenharConviteXadrez(d.convites[0], cfg);
  novoXadrez(d.enviados[0] || null);
}

// --- Novo desafio --------------------------------------------------------
function xadrezOnline() {
  const eu = String(escritorio.base?.eu);
  const vistos = new Set();
  return (escritorio.online || []).filter((o) => {
    const id = String(o.id);
    if (id === eu || o.convidado || vistos.has(id)) return false;
    vistos.add(id);
    return true;
  });
}
function novoXadrez(enviado) {
  const x = escritorioXadrez();
  x.nova = { para: "", valendo: false, moedas: 0, oferece: new Map(), pede: new Map(), deles: null, enviado };
  desenharNovoXadrez();
}
function xadrezMeusItens() {
  const vestidas = new Set(String(escritorio.perfil?.figura || "").split(".").map((p) => p.split("-")).filter((p) => p.length >= 2).map(([t, id]) => `roupa:${t}-${id}`));
  const moveis = escritorioMeuInventario().filter((i) => i.guardados > 0).map((i) => ({ classe: i.classe, max: i.guardados }));
  const roupas = (escritorio.base?.economia?.inventario || []).filter((i) => String(i.classe).startsWith("roupa:") && !vestidas.has(i.classe)).map((i) => ({ classe: i.classe, max: 1 }));
  return [...moveis, ...roupas];
}
function xadrezItemHtml(lado, it) {
  const f = escritorioXadrez().nova, n = f[lado].get(it.classe) || 0, c = safeText(it.classe);
  const nome = String(it.classe).startsWith("roupa:") ? "Roupa " + safeText(it.classe.slice(6)) : safeText(escritorioNomeDaClasse(it.classe));
  return `<li class="${n ? "sim" : ""}">${escritorioMiniaturaHtml(it.classe)}<span>${nome}</span><div class="ofc-qtd"><button type="button" aria-label="Menos" onclick="mudarItemXadrez('${lado}','${c}',-1,${it.max})" ${n ? "" : "disabled"}>−</button><b>${n}</b><button type="button" aria-label="Mais" onclick="mudarItemXadrez('${lado}','${c}',1,${it.max})" ${n >= it.max ? "disabled" : ""}>+</button></div></li>`;
}
function desenharNovoXadrez() {
  const f = escritorioXadrez().nova;
  if (!f) return;
  const online = xadrezOnline(), saldo = Number(escritorio.base?.economia?.saldo || 0);
  const pessoas = online.length ? `<div class="xdz-pessoas" role="radiogroup" aria-label="Com quem jogar">${online.map((o) => {
    const u = escritorioCabecaUrl(o.id), id = safeText(String(o.id));
    return `<button type="button" role="radio" aria-checked="${String(o.id) === f.para}" class="xdz-pessoa${String(o.id) === f.para ? " sim" : ""}" onclick="escolherRivalXadrez('${id}')">${u ? `<img src="${safeText(u)}" alt="" width="40" height="40">` : "<i></i>"}<span>${xadrezPrimeiroNome(o)}</span></button>`;
  }).join("")}</div>` : '<p class="ofc-nota">Ninguém da equipe está online agora. Chame quando tiver alguém no escritório.</p>';
  const meus = xadrezMeusItens();
  const aposta = !f.valendo ? "" : `<label class="workflow-field"><span>VybeCoins que cada um põe (você tem ${saldo.toLocaleString("pt-BR")})</span><input type="number" min="0" max="${saldo}" step="1" value="${f.moedas}" oninput="escritorioXadrez().nova.moedas=Math.max(0,Math.min(${saldo},Math.floor(Number(this.value)||0)));atualizarBotaoXadrez()"></label>
<div class="ofc-troca-montar"><section><h3>Você põe na mesa</h3>${meus.length ? `<ul>${meus.map((i) => xadrezItemHtml("oferece", i)).join("")}</ul>` : '<p class="ofc-nota">Nenhum móvel guardado nem roupa fora do corpo.</p>'}</section>
<section><h3>Você pede</h3>${!f.para ? '<p class="ofc-nota">Escolha com quem jogar.</p>' : !f.deles ? '<p class="ofc-nota">Carregando o inventário…</p>' : f.deles.length ? `<ul>${f.deles.map((i) => xadrezItemHtml("pede", i)).join("")}</ul>` : '<p class="ofc-nota">Essa pessoa não tem itens para apostar.</p>'}</section></div>
<p class="ofc-nota">Quem ganha leva tudo o que está na mesa. Empate devolve a cada um o seu. Só valem móveis guardados (fora do quarto) e roupas que a pessoa não está vestindo.</p>`;
  const enviado = f.enviado ? `<div class="xdz-aguardando"><span>Você chamou <b>${xadrezPrimeiroNome(f.enviado.desafiado)}</b>. Esperando a resposta.</span><button type="button" class="workflow-secondary" onclick="responderXadrezEscritorio('${safeText(f.enviado.id)}','cancelar',this)">Cancelar convite</button></div>` : "";
  const cfg = mesaCfg();
  xadrezModal(`<div class="workflow-kicker">${cfg.nome}<button type="button" class="workflow-close" aria-label="Fechar" onclick="xadrezFechar()">×</button></div><h2 class="workflow-title">Chamar para uma partida</h2>
${enviado}<h3 class="xdz-sub">Com quem</h3>${pessoas}
<div class="xdz-modo" role="radiogroup" aria-label="Modo"><button type="button" role="radio" aria-checked="${!f.valendo}" class="${f.valendo ? "" : "sim"}" onclick="modoXadrez(false)"><b>De graça</b><small>Só pela partida</small></button><button type="button" role="radio" aria-checked="${f.valendo}" class="${f.valendo ? "sim" : ""}" onclick="modoXadrez(true)"><b>Valendo</b><small>VybeCoins, móveis ou roupas</small></button></div>
${aposta}<p class="ofc-erro" id="xdz-erro" role="alert"></p>
<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="xadrezFechar()">Fechar</button><button type="button" class="workflow-primary" id="xdz-chamar" onclick="desafiarXadrezEscritorio(this)">Chamar para ${cfg.artigo}</button></div>`, "ofc-xdz-novo");
  atualizarBotaoXadrez();
}
function atualizarBotaoXadrez() {
  const b = document.getElementById("xdz-chamar"), f = escritorioXadrez().nova;
  if (b && f) b.disabled = !f.para;
}
function modoXadrez(valendo) {
  const f = escritorioXadrez().nova;
  if (!f) return;
  f.valendo = valendo;
  desenharNovoXadrez();
}
async function escolherRivalXadrez(id) {
  const f = escritorioXadrez().nova;
  if (!f) return;
  f.para = String(id); f.pede = new Map(); f.deles = null;
  desenharNovoXadrez();
  await new Promise((r) => carregarPerfilJogoEscritorio(id, r));
  if (escritorioXadrez().nova !== f || f.para !== String(id)) return;
  const essenciais = escritorio.base.quartos?.essenciais || [];
  f.deles = (escritorio.perfisPublicos?.[String(id)]?.inventario || []).filter((i) => !essenciais.includes(i.classe) && !String(i.classe).startsWith("vybeimg_"))
    .map((i) => ({ classe: i.classe, max: String(i.classe).startsWith("roupa:") ? 1 : Math.min(20, Number(i.quantidade) || 0) })).filter((i) => i.max > 0);
  desenharNovoXadrez();
}
function mudarItemXadrez(lado, classe, delta, max) {
  const f = escritorioXadrez().nova;
  if (!f) return;
  const n = Math.max(0, Math.min(max, (f[lado].get(classe) || 0) + delta));
  if (n) f[lado].set(classe, n); else f[lado].delete(classe);
  desenharNovoXadrez();
}
async function desafiarXadrezEscritorio(botao) {
  const x = escritorioXadrez(), f = x.nova, cfg = mesaCfg();
  if (!f?.para || !x.mesa) return;
  botao.disabled = true;
  try {
    const r = await escritorioApi(cfg.desafiar, { ...cfg.extra, para: f.para, ...x.mesa, moedas: f.valendo ? f.moedas : 0,
      oferece: f.valendo ? [...f.oferece] : [], pede: f.valendo ? [...f.pede] : [], chave: xadrezChave() });
    mesaSinal(cfg, r.id, f.para, "c");
    const nome = String(xadrezOnline().find((o) => String(o.id) === f.para)?.nome || "a pessoa").split(" ")[0];
    xadrezFechar();
    escritorioAviso(`Convite enviado para ${nome}. A partida abre quando aceitar.`);
    escritorioXadrez().esperando = cfg.sinal + ":" + r.id;
  } catch (e) {
    botao.disabled = false;
    const el = document.getElementById("xdz-erro");
    if (el) el.textContent = e.message;
  }
}

// --- Convite recebido ----------------------------------------------------
function xadrezApostaHtml(j, perspectiva) {
  const itens = (lista) => lista.map(([c, n]) => `<li>${escritorioMiniaturaHtml(c)}<span>${String(c).startsWith("roupa:") ? "Roupa " + safeText(c.slice(6)) : safeText(escritorioNomeDaClasse(c))}${n > 1 ? " ×" + n : ""}</span></li>`).join("");
  const de = j.itens.desafiante, para = j.itens.desafiado;
  if (!j.moedas && !de.length && !para.length) return '<p class="xdz-gratis">Partida de graça: ninguém aposta nada.</p>';
  const meu = perspectiva === "desafiado" ? para : de, dele = perspectiva === "desafiado" ? de : para;
  const quem = perspectiva === "desafiado" ? xadrezPrimeiroNome(j.desafiante) : perspectiva === "desafiante" ? xadrezPrimeiroNome(j.desafiado) : null;
  return `<div class="xdz-aposta">${j.moedas ? `<p class="xdz-moedas"><b>${j.moedas.toLocaleString("pt-BR")}</b> VybeCoins de cada um · quem ganha leva <b>${(2 * j.moedas).toLocaleString("pt-BR")}</b></p>` : ""}
${quem ? `${meu.length ? `<h4>Você põe</h4><ul>${itens(meu)}</ul>` : ""}${dele.length ? `<h4>${quem} põe</h4><ul>${itens(dele)}</ul>` : ""}`
    : `${de.length ? `<h4>${xadrezPrimeiroNome(j.desafiante)} põe</h4><ul>${itens(de)}</ul>` : ""}${para.length ? `<h4>${xadrezPrimeiroNome(j.desafiado)} põe</h4><ul>${itens(para)}</ul>` : ""}`}</div>`;
}
function desenharConviteXadrez(j, cfg = mesaCfg()) {
  xadrezPoeSprite();
  escritorioXadrez().cfg = cfg;
  const u = escritorioCabecaUrl(j.desafiante.id);
  xadrezModal(`<div class="workflow-kicker">${cfg.nome}<button type="button" class="workflow-close" aria-label="Fechar" onclick="xadrezFechar()">×</button></div>
<div class="xdz-convite">${u ? `<img src="${safeText(u)}" alt="" width="54" height="54">` : ""}<h2 class="workflow-title">${xadrezPrimeiroNome(j.desafiante)} te chamou para ${cfg.artigo}</h2></div>
${xadrezApostaHtml(j, "desafiado")}<p class="ofc-nota">${cfg.nota} O convite vale por 10 minutos.</p><p class="ofc-erro" id="xdz-erro" role="alert"></p>
<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="responderXadrezEscritorio('${safeText(j.id)}','recusar',this)">Recusar</button><button type="button" class="workflow-primary" onclick="responderXadrezEscritorio('${safeText(j.id)}','aceitar',this)">Aceitar e jogar</button></div>`, "ofc-xdz-convite");
}
async function responderXadrezEscritorio(id, acao, botao) {
  if (botao) botao.disabled = true;
  const cfg = mesaCfg();
  try {
    const r = await escritorioApi(cfg.responder, { id, acao });
    if (r.economia) xadrezEconomia(r.economia);
    const outro = acao === "cancelar" ? r.jogo?.desafiado?.id : r.jogo?.desafiante?.id;
    if (outro) mesaSinal(cfg, id, outro, "l");
    if (acao === "aceitar" && r.jogo?.estado === "jogando") return cfg.abrir(r.jogo);
    xadrezFechar();
    escritorioAviso(acao === "recusar" ? "Convite recusado." : "Convite cancelado.");
  } catch (e) {
    if (botao) botao.disabled = false;
    const el = document.getElementById("xdz-erro");
    if (el) el.textContent = e.message; else escritorioAviso(e.message);
  }
}
function xadrezEconomia(eco) {
  escritorio.base.economia = { ...escritorio.base.economia, ...eco, loja: escritorio.base.economia?.loja };
  if (typeof atualizarInventarioEscritorio === "function") atualizarInventarioEscritorio();
}

// --- Partida ---------------------------------------------------------------
function abrirJogoXadrez(j) {
  const x = escritorioXadrez();
  xadrezPoeSprite();
  x.jogo = j; x.sel = null; x.promo = null; x.nova = null;
  desenharJogoXadrez();
  clearInterval(x.timer);
  x.timer = setInterval(() => {
    if (!document.querySelector("#workflow-modal.ofc-xdz-jogo")) { clearInterval(x.timer); x.timer = null; x.jogo = null; return; }
    if (x.jogo?.estado === "jogando" && !document.hidden) recarregarJogoXadrez();
  }, 4000);
}
async function recarregarJogoXadrez() {
  const x = escritorioXadrez(), j = x.jogo;
  if (!j || x.carregando) return;
  x.carregando = true;
  try {
    const r = await escritorioApi("xadrez", null, { id: j.id });
    if (x.jogo?.id !== j.id) return;
    const mudou = r.jogo.lances.length !== j.lances.length || r.jogo.estado !== j.estado || r.jogo.empate_de !== j.empate_de || r.jogo.pode_reivindicar !== j.pode_reivindicar;
    x.jogo = r.jogo;
    if (mudou) {
      if (r.jogo.lances.length !== j.lances.length) { x.sel = null; x.promo = null; escritorioTocar(r.jogo.xeque ? 880 : 520, 0.06, 0.05); }
      if (r.jogo.estado === "fim" && j.estado !== "fim") xadrezAcabou(r.jogo);
      desenharJogoXadrez();
    }
  } catch { /* tenta de novo no próximo ciclo */ } finally { x.carregando = false; }
}
// Peças da posição (FEN) por casa: { e1: "wk", ... }.
function xadrezPecas(fen) {
  const pecas = {};
  String(fen).split(" ")[0].split("/").forEach((linha, i) => {
    let col = 0;
    for (const ch of linha) {
      if (/\d/.test(ch)) { col += Number(ch); continue; }
      pecas[XADREZ_COLUNAS[col] + (8 - i)] = (ch === ch.toUpperCase() ? "w" : "b") + ch.toLowerCase();
      col++;
    }
  });
  return pecas;
}
function xadrezTabuleiroHtml(j) {
  const x = escritorioXadrez(), pecas = xadrezPecas(j.fen), invertido = j.eu === "pretas";
  const alvos = new Set(x.sel ? j.legais[x.sel] || [] : []);
  const reiEmXeque = j.xeque ? Object.entries(pecas).find(([, p]) => p === (j.vez === "brancas" ? "wk" : "bk"))?.[0] : null;
  const fileiras = invertido ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const colunas = invertido ? [...XADREZ_COLUNAS].reverse() : [...XADREZ_COLUNAS];
  const minhaVez = j.estado === "jogando" && j.eu && j.eu === j.vez;
  let html = "";
  fileiras.forEach((f, li) => colunas.forEach((c, ci) => {
    const casa = c + f, p = pecas[casa], clara = (XADREZ_COLUNAS.indexOf(c) + f) % 2 === 1;
    const cls = ["xdz-casa", clara ? "clara" : "escura", x.sel === casa ? "sel" : "", alvos.has(casa) ? (p ? "alvo captura" : "alvo") : "",
      j.ultimo && (j.ultimo.de === casa || j.ultimo.para === casa) ? "ultimo" : "", reiEmXeque === casa ? "xeque" : "", minhaVez && j.legais[casa] ? "minha" : ""].filter(Boolean).join(" ");
    const nomeCasa = `${casa}${p ? ", " + (p[0] === "w" ? "branca" : "preta") : ""}`;
    html += `<button type="button" class="${cls}" data-casa="${casa}" aria-label="${nomeCasa}" onclick="casaXadrez('${casa}')">${p ? `<svg viewBox="0 0 40 40" aria-hidden="true"><use href="#xdz-${p}"/></svg>` : ""}${ci === 0 ? `<i class="xdz-fil">${f}</i>` : ""}${li === 7 ? `<i class="xdz-col">${c}</i>` : ""}</button>`;
  }));
  const promo = x.promo ? `<div class="xdz-promo" role="dialog" aria-label="Promover o peão"><span>Promover para</span>${["q", "r", "b", "n"].map((t) => `<button type="button" aria-label="${XADREZ_NOME_PECA[t]}" onclick="promoverXadrez('${t}')"><svg viewBox="0 0 40 40"><use href="#xdz-${j.eu === "brancas" ? "w" : "b"}${t}"/></svg></button>`).join("")}<button type="button" class="xdz-promo-x" aria-label="Cancelar" onclick="escritorioXadrez().promo=null;desenharJogoXadrez()">×</button></div>` : "";
  return `<div class="xdz-tabuleiro${minhaVez ? " vez" : ""}">${html}${promo}</div>`;
}
function xadrezJogadorHtml(j, cor) {
  const p = j[cor], u = escritorioCabecaUrl(p.id), vez = j.estado === "jogando" && j.vez === cor, eu = j.eu === cor;
  return `<div class="xdz-jogador${vez ? " vez" : ""}"><span class="xdz-cor ${cor}" aria-hidden="true"></span>${u ? `<img src="${safeText(u)}" alt="" width="36" height="36">` : "<i></i>"}<b>${xadrezPrimeiroNome(p)}${eu ? " (você)" : ""}</b><small>${vez ? (eu ? "Sua vez" : "Pensando…") : cor === "brancas" ? "Brancas" : "Pretas"}</small></div>`;
}
function xadrezResultadoHtml(j) {
  if (j.estado !== "fim") return "";
  const ganhou = j.resultado !== "empate" && j.eu === j.resultado, perdeu = j.resultado !== "empate" && j.eu && j.eu !== j.resultado;
  const vencedor = j.resultado === "empate" ? null : xadrezPrimeiroNome(j[j.resultado]);
  const titulo = j.resultado === "empate" ? "Empate" : ganhou ? "Você ganhou!" : perdeu ? "Você perdeu" : `${vencedor} ganhou`;
  const valendo = j.moedas || j.itens.desafiante.length || j.itens.desafiado.length;
  const premio = !valendo ? "" : j.resultado === "empate" ? "Cada um recebeu a aposta de volta." : ganhou ? `A mesa é sua${j.moedas ? `: +${(2 * j.moedas).toLocaleString("pt-BR")} VybeCoins` : ""}${j.itens.desafiante.length || j.itens.desafiado.length ? " e os itens já estão no seu inventário" : ""}.` : `${vencedor} levou a mesa.`;
  return `<div class="xdz-fim ${ganhou ? "ganhou" : perdeu ? "perdeu" : ""}"><b>${titulo}</b><span>${safeText(j.motivo_nome || "")}${premio ? " · " + premio : ""}</span></div>`;
}
function xadrezLancesHtml(j) {
  if (!j.lances.length) return '<p class="ofc-nota">Brancas começam.</p>';
  let s = "";
  for (let i = 0; i < j.lances.length; i += 2) s += `<li><i>${i / 2 + 1}.</i><span>${safeText(j.lances[i])}</span><span>${safeText(j.lances[i + 1] || "")}</span></li>`;
  return `<ol class="xdz-lances">${s}</ol>`;
}
function desenharJogoXadrez() {
  const j = escritorioXadrez().jogo;
  if (!j) return;
  const jogando = j.estado === "jogando", eu = j.eu, outro = eu === "brancas" ? "pretas" : "brancas";
  const empateMeu = j.empate_de && j.empate_de === String(escritorio.base?.eu), empateDele = j.empate_de && !empateMeu;
  const status = !jogando ? "" : j.xeque ? (j.vez === eu ? "Xeque! Proteja o rei." : "Xeque!") : !eu ? "Você está assistindo." : j.vez === eu ? "Sua vez. Toque numa peça e depois na casa." : `Vez de ${xadrezPrimeiroNome(j[outro])}.`;
  const acoes = !jogando || !eu ? "" : `<div class="xdz-acoes">
${empateDele ? `<div class="xdz-empate"><span>${xadrezPrimeiroNome(j[outro])} propôs empate.</span><button type="button" class="workflow-primary" onclick="acaoXadrezEscritorio('aceitar-empate',this)">Aceitar</button><button type="button" class="workflow-secondary" onclick="acaoXadrezEscritorio('recusar-empate',this)">Recusar</button></div>` : ""}
${j.pode_reivindicar ? `<button type="button" class="workflow-primary" onclick="acaoXadrezEscritorio('reivindicar',this)">${xadrezPrimeiroNome(j[outro])} sumiu: ganhar por tempo</button>` : ""}
<button type="button" class="workflow-secondary" onclick="acaoXadrezEscritorio('empate',this)" ${j.empate_de ? "disabled" : ""}>${empateMeu ? "Empate proposto" : "Propor empate"}</button>
<button type="button" class="workflow-secondary xdz-desistir" onclick="desistirXadrez(this)">Desistir</button></div>`;
  const cima = eu === "pretas" ? "brancas" : "pretas", baixo = cima === "brancas" ? "pretas" : "brancas";
  xadrezModal(`<div class="workflow-kicker">Xadrez${!eu ? " · assistindo" : ""}<button type="button" class="workflow-close" aria-label="Fechar" onclick="xadrezFechar()">×</button></div>
<div class="xdz-jogo"><div class="xdz-lado-tab">${xadrezJogadorHtml(j, cima)}${xadrezTabuleiroHtml(j)}${xadrezJogadorHtml(j, baixo)}</div>
<aside class="xdz-painel">${xadrezResultadoHtml(j)}${status ? `<p class="xdz-status${j.xeque ? " xeque" : ""}" aria-live="polite">${status}</p>` : ""}
${xadrezApostaHtml(j, eu ? (String(j.desafiante.id) === String(escritorio.base?.eu) ? "desafiante" : "desafiado") : null)}${mesaPlacarHtml(j)}
<h3 class="xdz-sub">Lances</h3>${xadrezLancesHtml(j)}${acoes}<p class="ofc-erro" id="xdz-erro" role="alert"></p>
${!jogando ? mesaFimAcoesHtml("xdz", j, "xadrezFechar()") : ""}</aside></div>`, "ofc-xdz-jogo");
}
function casaXadrez(casa) {
  const x = escritorioXadrez(), j = x.jogo;
  if (!j || j.estado !== "jogando" || !j.eu || j.eu !== j.vez || x.enviando) return;
  if (x.sel && (j.legais[x.sel] || []).includes(casa)) {
    const peca = xadrezPecas(j.fen)[x.sel];
    if (peca?.[1] === "p" && (casa[1] === "8" || casa[1] === "1")) { x.promo = { de: x.sel, para: casa }; desenharJogoXadrez(); return; }
    return lanceXadrezEscritorio(x.sel, casa);
  }
  x.sel = j.legais[casa] && x.sel !== casa ? casa : null;
  desenharJogoXadrez();
}
function promoverXadrez(tipo) {
  const p = escritorioXadrez().promo;
  if (p) lanceXadrezEscritorio(p.de, p.para, tipo);
}
async function lanceXadrezEscritorio(de, para, promocao) {
  const x = escritorioXadrez(), j = x.jogo;
  x.enviando = true;
  try {
    const r = await escritorioApi("xadrez-lance", { id: j.id, de, para, ...(promocao ? { promocao } : {}), n: j.lances.length });
    x.jogo = r.jogo; x.sel = null; x.promo = null;
    if (r.economia) xadrezEconomia(r.economia);
    escritorioTocar(r.jogo.xeque ? 880 : 520, 0.06, 0.05);
    xadrezSinal(j.id, j[j.eu === "brancas" ? "pretas" : "brancas"].id, "l");
    if (r.jogo.estado === "fim") xadrezAcabou(r.jogo);
  } catch (e) {
    x.sel = null; x.promo = null;
    escritorioAviso(e.message);
    recarregarJogoXadrez();
  } finally { x.enviando = false; }
  desenharJogoXadrez();
}
function desistirXadrez(botao) {
  if (botao.dataset.certeza !== "1") { botao.dataset.certeza = "1"; botao.textContent = "Desistir mesmo?"; setTimeout(() => { if (botao.isConnected) { botao.dataset.certeza = ""; botao.textContent = "Desistir"; } }, 4000); return; }
  acaoXadrezEscritorio("desistir", botao);
}
async function acaoXadrezEscritorio(acao, botao) {
  const x = escritorioXadrez(), j = x.jogo;
  if (!j) return;
  if (botao) botao.disabled = true;
  try {
    const r = await escritorioApi("xadrez-acao", { id: j.id, acao });
    x.jogo = r.jogo;
    if (r.economia) xadrezEconomia(r.economia);
    xadrezSinal(j.id, j[j.eu === "brancas" ? "pretas" : "brancas"].id, "l");
    if (r.jogo.estado === "fim") xadrezAcabou(r.jogo);
    desenharJogoXadrez();
  } catch (e) {
    if (botao) botao.disabled = false;
    const el = document.getElementById("xdz-erro");
    if (el) el.textContent = e.message;
  }
}
// Fim da partida: quem ganhou recebe confete; a carteira de quem jogou é relida.
function xadrezAcabou(j) {
  // Xadrez e mesas numeram as partidas cada um do seu jeito: a chave leva o jogo.
  const chave = (j.jogo || "xadrez") + ":" + j.id;
  if (j.eu && !escritorioXadrez().economiaRelida?.[chave]) {
    (escritorioXadrez().economiaRelida ||= {})[chave] = true;
    escritorioApi("economia").then((d) => d.economia && xadrezEconomia(d.economia)).catch(() => {});
  }
  if (j.eu && j.resultado === j.eu) setTimeout(() => { const n = document.querySelector(".xdz-fim"); if (n && typeof rkConfete === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) rkConfete(n); }, 80);
}

// Balão de comando xdz=<id>:<para>:<c|l>: convite novo para mim ou a partida
// aberta mudou (lance, desistência, empate, aceite).
function xadrezSinalEscritorio(de, v) {
  mesaSinalEscritorio(XADREZ_CFG, de, v);
}
function mesaSinalEscritorio(cfg, de, v) {
  const [id, para, tipo] = String(v || "").split(":");
  if (!/^\d{1,18}$/.test(id) || escritorio.base?.demo || String(de) === String(escritorio.base?.eu)) return;
  const x = escritorioXadrez(), eu = String(escritorio.base?.eu), meu = cfg.sinal + ":" + id;
  // A sala relê as placas das mesas; o convite que chegou aqui não é avisado de novo pelo resumo.
  if (typeof escritorioResumoJogos === "function") escritorioResumoJogos(true);
  if (tipo === "c") (escritorio.resumoJogos ||= { cena: null, em: 0, placas: new Set(), avisados: new Set() }).avisados.add((cfg.extra.jogo || "xadrez") + ":" + id);
  if (cfg.aberto(id)) return;
  if (para !== eu) return;
  if (tipo === "c" || x.esperando === meu) {
    escritorioApi(cfg.lista, null, { id }).then((r) => {
      const j = r.jogo, nome = xadrezPrimeiroNome(j.desafiante);
      if (j.estado === "convite" && j.desafiado.id === eu) {
        if (document.getElementById("workflow-modal")) return escritorioAviso(`${nome} te chamou para ${cfg.artigo}. Clique na mesa do jogo para responder.`);
        desenharConviteXadrez(j, cfg);
      } else if (j.estado === "jogando" && x.esperando === meu) {
        x.esperando = null;
        if (!document.getElementById("workflow-modal")) cfg.abrir(j);
        else escritorioAviso(`${xadrezPrimeiroNome(j.desafiado)} aceitou ${cfg.artigo}. Clique na mesa do jogo para jogar.`);
      } else if ((j.estado === "recusado" || j.estado === "cancelado") && x.esperando === meu) {
        x.esperando = null;
        escritorioAviso(`${xadrezPrimeiroNome(j.desafiado)} não aceitou ${cfg.artigo} agora.`);
      }
    }).catch(() => {});
  }
}
