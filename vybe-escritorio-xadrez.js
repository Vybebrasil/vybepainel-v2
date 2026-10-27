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
  clearInterval(x.timer); clearInterval(x.relogio);
  x.timer = null; x.relogio = null; x.jogo = null; x.sel = null; x.promo = null; x.nova = null;
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
  desenharSalaMesa(d, cfg);
}

// --- Lobby da mesa -------------------------------------------------------
// Tudo o que importa nesta mesa numa tela só, que se atualiza sozinha a cada
// 3 segundos (Paulo, 27/10/2026: "os lobbys, a forma de convidar… muita coisa
// bugada"; antes a espera não andava sem o aviso pelo balão e cada situação
// caía numa tela diferente): convites para mim com Aceitar e Recusar, a mesa
// em que já aceitei esperando os outros, o meu convite com quem aceitou, o
// prazo correndo e, no pôquer, começar com quem já aceitou; a partida que está
// rolando aqui para assistir; e chamar gente para uma partida nova. Quando a
// minha partida começa, ela abre sozinha.
const MESA_LOBBY_MS = 3000;
// Cara de joguinho (Paulo, 27/10/2026: "deixa com mais cara de jogo"): faixa
// com o tema de cada jogo, os lugares da mesa como assentos redondos com a
// cabeça de cada um e o selo PRONTO/ESPERANDO, lugar vago com "+", relógio do
// prazo e botões grandes em relevo.
const MESA_TEMAS = { xadrez: ["♚", "♞", "♜"], poker: ["♠", "♥", "♣", "♦"], sinuca: ["8", "●", "9"], domino: ["⚃", "⚄", "⚂"], dama: ["⛀", "⛂", "⛁"], velha: ["✕", "◯", "✕"], truco: ["♣", "♥", "♠"], todos: ["⚄", "♣", "✕", "⛂"] };
function mesaPrazoHtml(ate) {
  if (!ate) return "";
  const ms = new Date(ate).getTime() - Date.now();
  return `<time class="sala-prazo${ms < 60000 ? " pouco" : ""}" data-ate="${new Date(ate).getTime()}"><i aria-hidden="true"></i>${xadrezTempo(ms)}</time>`;
}
function mesaPessoaChipHtml(p, estado) {
  const u = escritorioCabecaUrl(p.id);
  const selo = { aceitou: "Pronto", espera: "Esperando", chamou: "Anfitrião" }[estado] || "";
  return `<span class="sala-lugar ${estado}"><span class="sala-assento">${u ? `<img src="${safeText(u)}" alt="" width="56" height="56">` : `<i>${safeText(String(p.nome || "?")[0])}</i>`}</span><b>${xadrezPrimeiroNome(p)}</b>${selo ? `<em>${selo}</em>` : ""}</span>`;
}
function mesaLugarVagoHtml(acao) {
  return `<button type="button" class="sala-lugar vazio" onclick="${acao}"><span class="sala-assento"><i>+</i></span><b>Lugar vago</b><em>Chamar</em></button>`;
}
// Quem está no convite e se já aceitou (os jogos de dois não mandam a lista).
function mesaLugaresDo(j) {
  return j.jogadores || [{ lado: "desafiante", ...j.desafiante, aceitou: true }, { lado: "desafiado", ...j.desafiado, aceitou: j.estado !== "convite" }];
}
function mesaLugaresHtml(j, vagos = 0, acao = "") {
  return `<div class="sala-lugares">${mesaLugaresDo(j).map((p) => mesaPessoaChipHtml(p, p.lado === "desafiante" ? "chamou" : p.aceitou ? "aceitou" : "espera")).join("")}${Array.from({ length: vagos }, () => mesaLugarVagoHtml(acao)).join("")}</div>`;
}
// Faixa do topo com o tema do jogo (lobby e convite novo).
function mesaBannerHtml(cfg, titulo, texto) {
  const jogo = cfg.extra?.jogo || "xadrez", simbolos = (MESA_TEMAS[jogo] || MESA_TEMAS.xadrez).map((c, i) => `<i style="--i:${i}">${c}</i>`).join("");
  return `<div class="sala-banner tema-${safeText(jogo)}"><div class="sala-simbolos" aria-hidden="true">${simbolos}</div>
<div><small>${safeText(cfg.nome)}</small><h2>${safeText(titulo)}</h2>${texto ? `<p>${safeText(texto)}</p>` : ""}</div>
<button type="button" class="workflow-close" aria-label="Fechar" onclick="xadrezFechar()">×</button></div>`;
}
function desenharSalaMesa(d, cfg = mesaCfg()) {
  const x = escritorioXadrez(), eu = String(escritorio.base?.eu);
  x.cfg = cfg; x.salaCfg = cfg; x.sala = d; x.nova = null;
  const id = (j) => safeText(j.id), jogo = cfg.extra?.jogo || "xadrez";
  const chamar = cfg.escolher ? "escolherJogoDaMesa()" : "novoXadrez(null)";
  // Na Mesa de Jogos cada convite é de um jogo: o artigo vem dele.
  const artigo = (j) => (cfg.escolher ? Object.values(ESCRITORIO_MESAS).find((c) => c.extra.jogo === j.jogo)?.artigo : null) || cfg.artigo;
  const convites = (d.convites || []).map((j) => `<section class="sala-mesa destaque"><div class="sala-topo"><b>${xadrezPrimeiroNome(j.desafiante)} te chamou para ${artigo(j)}!</b>${mesaPrazoHtml(j.convite_ate)}</div>
${mesaLugaresHtml(j)}${xadrezApostaHtml(j, "desafiado")}
<div class="sala-acoes"><button type="button" class="sala-botao cinza" onclick="responderXadrezEscritorio('${id(j)}','recusar',this)">Recusar</button><button type="button" class="sala-botao verde" onclick="responderXadrezEscritorio('${id(j)}','aceitar',this)">Aceitar e jogar</button></div></section>`).join("");
  const aguardando = (d.aguardando || []).map((j) => `<section class="sala-mesa"><div class="sala-topo"><b>Você está na mesa de ${xadrezPrimeiroNome(j.desafiante)}</b>${mesaPrazoHtml(j.convite_ate)}</div>
${mesaLugaresHtml(j)}<p class="sala-dica">A partida abre sozinha quando todos estiverem prontos.</p><div class="sala-acoes"><button type="button" class="sala-botao cinza" onclick="responderXadrezEscritorio('${id(j)}','recusar',this)">Sair da mesa</button></div></section>`).join("");
  const enviados = (d.enviados || []).map((j) => {
    const lugares = mesaLugaresDo(j), prontos = lugares.filter((p) => p.lado !== "desafiante" && p.aceitou).length;
    const comecar = j.grupo && prontos ? `<button type="button" class="sala-botao verde" onclick="responderXadrezEscritorio('${id(j)}','comecar',this)">Começar com ${prontos + 1}</button>` : "";
    return `<section class="sala-mesa"><div class="sala-topo"><b>Sua mesa</b>${mesaPrazoHtml(j.convite_ate)}</div>
${mesaLugaresHtml(j)}<p class="sala-dica">${j.grupo ? "Começa quando todos estiverem prontos, ou já com quem aceitou." : "Começa quando a pessoa aceitar."}</p>
<div class="sala-acoes"><button type="button" class="sala-botao cinza" onclick="responderXadrezEscritorio('${id(j)}','cancelar',this)">Cancelar</button>${comecar}</div></section>`;
  }).join("");
  const rolando = d.mesa ? `<section class="sala-mesa rolando"><div class="sala-topo"><b><i class="sala-aovivo">Ao vivo</i> Partida rolando aqui</b></div>
<div class="sala-lugares">${(d.mesa.jogadores || [d.mesa.desafiante, d.mesa.desafiado]).map((p) => mesaPessoaChipHtml(p, "jogando")).join('<span class="sala-vs">VS</span>')}</div>
<div class="sala-acoes"><button type="button" class="sala-botao azul" onclick="mesaAssistir()">Assistir</button></div></section>` : "";
  // Mesa vazia: eu sentado e os lugares vagos esperando gente.
  const meu = (escritorio.base?.equipe || []).find((p) => String(p.id) === eu) || { id: eu, nome: "Você" };
  const vagos = cfg.grupo ? cfg.grupo - 1 : cfg.escolher ? 1 : 1;
  const vazia = !convites && !aguardando && !enviados ? `<section class="sala-mesa"><div class="sala-topo"><b>Monte a sua mesa</b></div>
<div class="sala-lugares">${mesaPessoaChipHtml({ ...meu, nome: "Você" }, "chamou")}${Array.from({ length: vagos }, () => mesaLugarVagoHtml(chamar)).join("")}</div></section>` : "";
  xadrezModal(`${mesaBannerHtml(cfg, cfg.escolher ? "Mesa de Jogos" : `Mesa de ${cfg.nome.toLowerCase()}`, cfg.nota)}
${convites}${aguardando}${enviados}${rolando}${vazia}
<p class="ofc-erro" id="xdz-erro" role="alert"></p>
<div class="sala-rodape"><button type="button" class="sala-botao cinza" onclick="xadrezFechar()">Fechar</button><button type="button" class="sala-botao laranja grande" onclick="${chamar}">${enviados ? "Chamar mais gente" : "Chamar para jogar"}</button></div>`, "ofc-xdz-sala");
  mesaLobbyRelogio();
}
// O lobby relê a mesa a cada 3 s enquanto está aberto e conta o prazo dos convites.
function mesaLobbyRelogio() {
  const x = escritorioXadrez();
  clearInterval(x.salaTimer);
  x.salaTimer = setInterval(() => {
    const aberto = document.querySelector("#workflow-modal.ofc-xdz-sala");
    if (!aberto) { clearInterval(x.salaTimer); x.salaTimer = null; return; }
    for (const el of aberto.querySelectorAll(".sala-prazo[data-ate]")) {
      const ms = Number(el.dataset.ate) - Date.now();
      el.lastChild.textContent = ms > 0 ? xadrezTempo(ms) : "venceu";
      el.classList.toggle("pouco", ms < 60000);
    }
    if (!document.hidden && Date.now() - (x.salaLida || 0) >= MESA_LOBBY_MS) recarregarSalaMesa();
  }, 1000);
}
async function recarregarSalaMesa() {
  const x = escritorioXadrez(), cfg = x.salaCfg || x.cfg;
  if (!cfg || !x.mesa || x.salaLendo) return;
  x.salaLendo = true; x.salaLida = Date.now();
  try {
    const lido = await escritorioApi(cfg.lista, null, { ...x.mesa, ...cfg.extra }), d = cfg.filtrar ? cfg.filtrar(lido) : lido;
    if (!document.querySelector("#workflow-modal.ofc-xdz-sala")) return;
    // A minha partida começou (o último aceitou, ou quem chamou começou): abre.
    if (d.jogos?.[0]) { escritorioTocar(660, 0.08, 0.06); return cfg.abrir(d.jogos[0]); }
    const chave = (v) => JSON.stringify([v.convites, v.aguardando, v.enviados, v.mesa?.id].map((l) => (Array.isArray(l) ? l.map((j) => [j.id, j.estado, mesaLugaresDo(j).map((p) => p.aceitou)]) : l)));
    if (chave(d) !== chave(x.sala || {})) desenharSalaMesa(d, cfg);
  } catch { /* tenta de novo */ } finally { x.salaLendo = false; }
}
function abrirSalaMesa() {
  const x = escritorioXadrez();
  if (!(x.salaCfg || x.cfg) || !x.mesa) return xadrezFechar();
  x.salaLida = 0;
  desenharSalaMesa(x.sala || { convites: [], enviados: [], aguardando: [], mesa: null }, x.salaCfg || x.cfg);
  recarregarSalaMesa();
}
function mesaAssistir() {
  const x = escritorioXadrez();
  if (x.sala?.mesa) (x.salaCfg || x.cfg).abrir(x.sala.mesa);
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
// Quem pode ser chamado: a equipe toda (quem está fora recebe no sino), com quem
// está no escritório primeiro.
function mesaPessoasParaChamar() {
  const eu = String(escritorio.base?.eu), online = new Set(xadrezOnline().map((o) => String(o.id)));
  const equipe = (escritorio.base?.equipe || []).filter((p) => String(p.id) !== eu && p.ativo !== false && p.pode_entrar !== false);
  const lista = equipe.length ? equipe : xadrezOnline();
  return lista.map((p) => ({ id: String(p.id), nome: p.nome, online: online.has(String(p.id)) })).sort((a, b) => Number(b.online) - Number(a.online) || String(a.nome).localeCompare(String(b.nome)));
}
function novoXadrez(enviado) {
  const x = escritorioXadrez();
  // grupo: quem foi escolhido, na ordem (no pôquer, até três; o primeiro é `para`).
  x.nova = { para: "", grupo: [], valendo: false, moedas: 0, oferece: new Map(), pede: new Map(), deles: null, enviado };
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
  const online = mesaPessoasParaChamar(), saldo = Number(escritorio.base?.economia?.saldo || 0), cfg = mesaCfg();
  // Jogo de grupo (pôquer): escolhe até `grupo - 1` pessoas; os outros, uma só.
  const grupo = cfg.grupo ? cfg.grupo - 1 : 0, emGrupo = f.grupo.length > 1;
  const pessoas = online.length ? `<div class="xdz-pessoas" role="${grupo ? "group" : "radiogroup"}" aria-label="Com quem jogar">${online.map((o) => {
    const u = escritorioCabecaUrl(o.id), id = safeText(String(o.id)), sim = grupo ? f.grupo.includes(String(o.id)) : String(o.id) === f.para;
    return `<button type="button" ${grupo ? `aria-pressed="${sim}"` : `role="radio" aria-checked="${sim}"`} class="xdz-pessoa${sim ? " sim" : ""}${o.online ? " online" : ""}" onclick="escolherRivalXadrez('${id}')" title="${o.online ? "No escritório agora" : "Fora do escritório: recebe o convite no sino"}">${u ? `<img src="${safeText(u)}" alt="" width="40" height="40">` : "<i></i>"}<span>${xadrezPrimeiroNome(o)}</span></button>`;
  }).join("")}</div><p class="ofc-nota">Bolinha verde: está no escritório agora. Quem está fora recebe o convite no sino.</p>` : '<p class="ofc-nota">Ninguém mais na equipe.</p>';
  const meus = xadrezMeusItens();
  const aposta = !f.valendo ? "" : `<label class="workflow-field"><span>VybeCoins que cada um põe (você tem ${saldo.toLocaleString("pt-BR")})</span><input type="number" min="0" max="${saldo}" step="1" value="${f.moedas}" oninput="escritorioXadrez().nova.moedas=Math.max(0,Math.min(${saldo},Math.floor(Number(this.value)||0)));atualizarBotaoXadrez()"></label>
${emGrupo ? '<p class="ofc-nota">Com mais de duas pessoas na mesa, a aposta é só em VybeCoins: cada um põe o mesmo e quem ganha leva as de todos.</p>' : `<div class="ofc-troca-montar"><section><h3>Você põe na mesa</h3>${meus.length ? `<ul>${meus.map((i) => xadrezItemHtml("oferece", i)).join("")}</ul>` : '<p class="ofc-nota">Nenhum móvel guardado nem roupa fora do corpo.</p>'}</section>
<section><h3>Você pede</h3>${!f.para ? '<p class="ofc-nota">Escolha com quem jogar.</p>' : !f.deles ? '<p class="ofc-nota">Carregando o inventário…</p>' : f.deles.length ? `<ul>${f.deles.map((i) => xadrezItemHtml("pede", i)).join("")}</ul>` : '<p class="ofc-nota">Essa pessoa não tem itens para apostar.</p>'}</section></div>
<p class="ofc-nota">Quem ganha leva tudo o que está na mesa. Empate devolve a cada um o seu. Só valem móveis guardados (fora do quarto) e roupas que a pessoa não está vestindo.</p>`}`;
  const chamados = f.enviado ? (f.enviado.jogadores || [{ ...f.enviado.desafiado, aceitou: false }]).filter((p) => p.lado !== "desafiante") : [];
  const enviado = f.enviado ? `<div class="xdz-aguardando"><span>Você chamou ${chamados.map((p) => `<b>${xadrezPrimeiroNome(p)}</b>${p.aceitou ? " (aceitou)" : ""}`).join(", ")}. Esperando ${chamados.length > 1 ? "todos aceitarem" : "a resposta"}.</span><button type="button" class="workflow-secondary" onclick="responderXadrezEscritorio('${safeText(f.enviado.id)}','cancelar',this)">Cancelar convite</button></div>` : "";
  xadrezModal(`${mesaBannerHtml(cfg, "Chamar para jogar", grupo ? `Escolha até ${grupo} pessoas para a mesa.` : "Escolha com quem jogar.")}<div class="sala-corpo">
${enviado}<h3 class="xdz-sub">${grupo ? `Com quem (até ${grupo})` : "Com quem"}</h3>${pessoas}
<div class="xdz-modo" role="radiogroup" aria-label="Modo"><button type="button" role="radio" aria-checked="${!f.valendo}" class="${f.valendo ? "" : "sim"}" onclick="modoXadrez(false)"><b>De graça</b><small>Só pela partida</small></button><button type="button" role="radio" aria-checked="${f.valendo}" class="${f.valendo ? "sim" : ""}" onclick="modoXadrez(true)"><b>Valendo</b><small>VybeCoins, móveis ou roupas</small></button></div>
${aposta}<p class="ofc-erro" id="xdz-erro" role="alert"></p>
</div><div class="sala-rodape"><button type="button" class="sala-botao cinza" onclick="abrirSalaMesa()">Voltar</button><button type="button" class="sala-botao laranja grande" id="xdz-chamar" onclick="desafiarXadrezEscritorio(this)">Chamar para ${cfg.artigo}</button></div>`, "ofc-xdz-novo");
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
  const f = escritorioXadrez().nova, grupo = mesaCfg().grupo;
  if (!f) return;
  if (grupo) {
    // Clicar de novo tira da mesa; cheia, não entra mais ninguém.
    const k = String(id);
    if (f.grupo.includes(k)) f.grupo = f.grupo.filter((x) => x !== k);
    else if (f.grupo.length < grupo - 1) f.grupo.push(k);
    else return escritorioAviso(`${mesaCfg().nome} é de até ${grupo} pessoas na mesa.`);
    f.para = f.grupo[0] || ""; f.pede = new Map(); f.deles = null;
    if (f.grupo.length > 1) f.oferece = new Map();
    // O inventário de quem foi chamado só importa a dois (em grupo a aposta é só de moedas).
    if (f.grupo.length !== 1) return desenharNovoXadrez();
    id = f.para;
  } else { f.para = String(id); f.pede = new Map(); f.deles = null; }
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
    const mais = cfg.grupo ? f.grupo.slice(1) : [], doGrupo = mais.length > 0;
    const r = await escritorioApi(cfg.desafiar, { ...cfg.extra, para: f.para, ...(doGrupo ? { mais } : {}), ...x.mesa, moedas: f.valendo ? f.moedas : 0,
      oferece: f.valendo && !doGrupo ? [...f.oferece] : [], pede: f.valendo && !doGrupo ? [...f.pede] : [], chave: xadrezChave() });
    for (const id of [f.para, ...mais]) mesaSinal(cfg, r.id, id, "c");
    const nomes = [f.para, ...mais].map((id) => String(mesaPessoasParaChamar().find((o) => o.id === id)?.nome || "a pessoa").split(" ")[0]);
    escritorioXadrez().esperando = cfg.sinal + ":" + r.id;
    abrirSalaMesa();
    escritorioAviso(doGrupo ? `Convite enviado para ${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}. A partida abre quando todos aceitarem.` : `Convite enviado para ${nomes[0]}. A partida abre quando aceitar.`);
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
  return `<div class="xdz-aposta">${j.moedas ? `<p class="xdz-moedas"><b>${j.moedas.toLocaleString("pt-BR")}</b> VybeCoins de cada um · quem ganha leva <b>${((j.jogadores?.length || 2) * j.moedas).toLocaleString("pt-BR")}</b></p>` : ""}
${quem ? `${meu.length ? `<h4>Você põe</h4><ul>${itens(meu)}</ul>` : ""}${dele.length ? `<h4>${quem} põe</h4><ul>${itens(dele)}</ul>` : ""}`
    : `${de.length ? `<h4>${xadrezPrimeiroNome(j.desafiante)} põe</h4><ul>${itens(de)}</ul>` : ""}${para.length ? `<h4>${xadrezPrimeiroNome(j.desafiado)} põe</h4><ul>${itens(para)}</ul>` : ""}`}</div>`;
}
function desenharConviteXadrez(j, cfg = mesaCfg()) {
  xadrezPoeSprite();
  escritorioXadrez().cfg = cfg;
  const u = escritorioCabecaUrl(j.desafiante.id);
  xadrezModal(`<div class="workflow-kicker">${cfg.nome}<button type="button" class="workflow-close" aria-label="Fechar" onclick="xadrezFechar()">×</button></div>
<div class="xdz-convite">${u ? `<img src="${safeText(u)}" alt="" width="54" height="54">` : ""}<h2 class="workflow-title">${xadrezPrimeiroNome(j.desafiante)} te chamou para ${cfg.artigo}</h2></div>
${mesaChamadosHtml(j)}${xadrezApostaHtml(j, "desafiado")}<p class="ofc-nota">${cfg.nota} O convite vale por 10 minutos.</p><p class="ofc-erro" id="xdz-erro" role="alert"></p>
<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="responderXadrezEscritorio('${safeText(j.id)}','recusar',this)">Recusar</button><button type="button" class="workflow-primary" onclick="responderXadrezEscritorio('${safeText(j.id)}','aceitar',this)">Aceitar e jogar</button></div>`, "ofc-xdz-convite");
}
// Em grupo: quem mais está na mesa e quem já aceitou.
function mesaChamadosHtml(j) {
  if (!j.grupo) return "";
  const eu = String(escritorio.base?.eu), outros = (j.jogadores || []).filter((p) => p.lado !== "desafiante" && String(p.id) !== eu);
  return `<p class="ofc-nota">Na mesa também: ${outros.map((p) => `<b>${xadrezPrimeiroNome(p)}</b>${p.aceitou ? " (aceitou)" : ""}`).join(", ")}. A partida começa quando todos aceitarem.</p>`;
}
// Aceitei um convite em grupo: espera os outros (a mesa abre sozinha quando o último aceitar).
function desenharAguardandoMesa(j, cfg = mesaCfg()) {
  const x = escritorioXadrez();
  x.cfg = cfg; x.esperando = cfg.sinal + ":" + j.id;
  const faltam = (j.jogadores || []).filter((p) => !p.aceitou && String(p.id) !== String(escritorio.base?.eu));
  xadrezModal(`<div class="workflow-kicker">${cfg.nome}<button type="button" class="workflow-close" aria-label="Fechar" onclick="xadrezFechar()">×</button></div>
<h2 class="workflow-title">Você está na mesa de ${xadrezPrimeiroNome(j.desafiante)}</h2>
<p class="ofc-nota">Esperando ${faltam.map((p) => `<b>${xadrezPrimeiroNome(p)}</b>`).join(" e ") || "os outros"} aceitar${faltam.length > 1 ? "em" : ""}. A partida abre sozinha quando a mesa fechar.</p>
${xadrezApostaHtml(j, "desafiado")}<p class="ofc-erro" id="xdz-erro" role="alert"></p>
<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="responderXadrezEscritorio('${safeText(j.id)}','recusar',this)">Sair da mesa</button><button type="button" class="workflow-primary" onclick="xadrezFechar()">Fechar</button></div>`, "ofc-xdz-convite");
}
async function responderXadrezEscritorio(id, acao, botao) {
  if (botao) botao.disabled = true;
  const cfg = mesaCfg();
  try {
    const r = await escritorioApi(cfg.responder, { id, acao });
    if (r.economia) xadrezEconomia(r.economia);
    // Avisa a mesa toda (no grupo, quem já aceitou espera o último).
    if (r.jogo?.jogadores) mesaSinalTodos(cfg, r.jogo, "l");
    else { const outro = acao === "cancelar" ? r.jogo?.desafiado?.id : r.jogo?.desafiante?.id; if (outro) mesaSinal(cfg, id, outro, "l"); }
    if (r.jogo?.estado === "jogando") return cfg.abrir(r.jogo);
    if (acao === "aceitar" && r.aguardando) { escritorioXadrez().esperando = cfg.sinal + ":" + id; return abrirSalaMesa(); }
    escritorioXadrez().esperando = null;
    escritorioAviso(acao === "recusar" ? "Convite recusado." : "Convite cancelado.");
    // Do lobby, volta para ele (relido); de fora (o aviso do convite), fecha.
    if (document.querySelector("#workflow-modal.ofc-xdz-sala, #workflow-modal.ofc-xdz-convite")) return abrirSalaMesa();
    xadrezFechar();
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
  // O relógio de quem tem a vez anda na tela; zerou, a tela relê e o servidor encerra.
  clearInterval(x.relogio);
  x.relogio = setInterval(() => {
    if (!document.querySelector("#workflow-modal.ofc-xdz-jogo")) { clearInterval(x.relogio); x.relogio = null; return; }
    const el = document.querySelector("#workflow-modal.ofc-xdz-jogo .xdz-relogio.corre");
    if (!el?.dataset.ate) return;
    const ms = Number(el.dataset.ate) - Date.now();
    el.textContent = xadrezTempo(ms);
    el.classList.toggle("pouco", ms < 30000);
    if (ms <= 0 && !x.zerou) { x.zerou = true; recarregarJogoXadrez(); setTimeout(() => { x.zerou = false; }, 3000); }
  }, 250);
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
    const arrasta = minhaVez && j.legais[casa] ? ` onpointerdown="tabuleiroArrastar(event,'${casa}',(c)=>{if(escritorioXadrez().sel!==c)casaXadrez(c)},casaXadrez)"` : "";
    html += `<button type="button" class="${cls}" data-casa="${casa}" aria-label="${nomeCasa}" onclick="casaXadrez('${casa}')"${arrasta}>${p ? `<svg viewBox="0 0 40 40" aria-hidden="true"><use href="#xdz-${p}"/></svg>` : ""}${ci === 0 ? `<i class="xdz-fil">${f}</i>` : ""}${li === 7 ? `<i class="xdz-col">${c}</i>` : ""}</button>`;
  }));
  const promo = x.promo ? `<div class="xdz-promo" role="dialog" aria-label="Promover o peão"><span>Promover para</span>${["q", "r", "b", "n"].map((t) => `<button type="button" aria-label="${XADREZ_NOME_PECA[t]}" onclick="promoverXadrez('${t}')"><svg viewBox="0 0 40 40"><use href="#xdz-${j.eu === "brancas" ? "w" : "b"}${t}"/></svg></button>`).join("")}<button type="button" class="xdz-promo-x" aria-label="Cancelar" onclick="escritorioXadrez().promo=null;desenharJogoXadrez()">×</button></div>` : "";
  return `<div class="xdz-tabuleiro${minhaVez ? " vez" : ""}">${html}${promo}</div>`;
}
const xadrezTempo = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
// Peças que esta cor já tomou: as do adversário que faltam na posição.
function xadrezCapturadasHtml(j, cor) {
  const dele = cor === "brancas" ? "b" : "w", restam = {};
  for (const p of Object.values(xadrezPecas(j.fen))) if (p[0] === dele) restam[p[1]] = (restam[p[1]] || 0) + 1;
  const tomadas = ["q", "r", "b", "n", "p"].flatMap((t) => Array(Math.max(0, { q: 1, r: 2, b: 2, n: 2, p: 8 }[t] - (restam[t] || 0))).fill(t));
  return tomadas.length ? `<span class="xdz-capturadas" aria-label="${tomadas.length} peças tomadas">${tomadas.map((t) => `<svg viewBox="0 0 40 40" aria-hidden="true"><use href="#xdz-${dele}${t}"/></svg>`).join("")}</span>` : "";
}
function xadrezJogadorHtml(j, cor) {
  const p = j[cor], u = escritorioCabecaUrl(p.id), vez = j.estado === "jogando" && j.vez === cor, eu = j.eu === cor;
  // Relógio: quem está com a vez conta para baixo na tela (o servidor é quem decide o fim).
  const ms = j.relogio?.[cor], corre = j.relogio?.corre === cor;
  const relogio = ms == null ? "" : `<time class="xdz-relogio${corre ? " corre" : ""}${ms < 30000 ? " pouco" : ""}" data-ate="${corre ? Date.now() + ms : ""}">${xadrezTempo(ms)}</time>`;
  return `<div class="xdz-jogador${vez ? " vez" : ""}${relogio ? " com-relogio" : ""}"><span class="xdz-cor ${cor}" aria-hidden="true"></span>${u ? `<img src="${safeText(u)}" alt="" width="36" height="36">` : "<i></i>"}<b>${xadrezPrimeiroNome(p)}${eu ? " (você)" : ""}${xadrezCapturadasHtml(j, cor)}</b><small>${vez ? (eu ? "Sua vez" : "Pensando…") : cor === "brancas" ? "Brancas" : "Pretas"}</small>${relogio}</div>`;
}
function xadrezResultadoHtml(j) {
  if (j.estado !== "fim") return "";
  const ganhou = j.resultado !== "empate" && j.eu === j.resultado, perdeu = j.resultado !== "empate" && j.eu && j.eu !== j.resultado;
  const vencedor = j.resultado === "empate" ? null : xadrezPrimeiroNome(j[j.resultado]);
  const titulo = j.resultado === "empate" ? "Empate" : ganhou ? "Você ganhou!" : perdeu ? "Você perdeu" : `${vencedor} ganhou`;
  const valendo = j.moedas || j.itens.desafiante.length || j.itens.desafiado.length;
  const premio = !valendo ? "" : j.resultado === "empate" ? "Cada um recebeu a aposta de volta." : ganhou ? `A mesa é sua${j.moedas ? `: +${((j.jogadores?.length || 2) * j.moedas).toLocaleString("pt-BR")} VybeCoins` : ""}${j.itens.desafiante.length || j.itens.desafiado.length ? " e os itens já estão no seu inventário" : ""}.` : `${vencedor} levou a mesa.`;
  return `<div class="xdz-fim ${ganhou ? "ganhou" : perdeu ? "perdeu" : ""}"><b>${titulo}</b><span>${safeText(j.motivo_nome || "")}${premio ? " · " + premio : ""}</span></div>`;
}
// Lances na notação de jogo em português, como nos livros e no lichess em pt:
// R rei, D dama, T torre, B bispo, C cavalo (o servidor manda o SAN em inglês).
const XADREZ_SAN_PT = { K: "R", Q: "D", R: "T", B: "B", N: "C" };
const xadrezSanPt = (san) => String(san || "").replace(/^[KQRBN]/, (l) => XADREZ_SAN_PT[l]).replace(/=([QRBN])/, (_, l) => "=" + XADREZ_SAN_PT[l]);
function xadrezLancesHtml(j) {
  if (!j.lances.length) return '<p class="ofc-nota">Brancas começam.</p>';
  let s = "";
  const nomes = j.san?.length === j.lances.length ? j.san.map(xadrezSanPt) : j.lances;
  const ultimo = j.lances.length - 1, lance = (k) => `<span${k === ultimo ? ' class="ultimo"' : ""}>${safeText(nomes[k] || "")}</span>`;
  for (let i = 0; i < j.lances.length; i += 2) s += `<li><i>${i / 2 + 1}.</i>${lance(i)}${lance(i + 1)}</li>`;
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
  xadrezAnimarLance(j);
}
// O lance novo desliza da casa de origem até a de destino (uma vez por lance).
function xadrezAnimarLance(j) {
  const x = escritorioXadrez(), chave = j.id + ":" + j.lances.length;
  if (!j.ultimo || x.animado === chave) return;
  const primeiro = x.animado === undefined || x.animado.split(":")[0] !== j.id;
  x.animado = chave;
  if (primeiro || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const de = document.querySelector(`.xdz-casa[data-casa="${j.ultimo.de}"]`), para = document.querySelector(`.xdz-casa[data-casa="${j.ultimo.para}"]`);
  const peca = para?.querySelector("svg");
  if (!de || !peca) return;
  const a = de.getBoundingClientRect(), b = para.getBoundingClientRect();
  peca.animate([{ transform: `translate(${a.left - b.left}px,${a.top - b.top}px)` }, { transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.8,.3,1)" });
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
  // Com o lobby aberto, ele mesmo relê a mesa (e abre a partida que começou).
  if (document.querySelector("#workflow-modal.ofc-xdz-sala")) return recarregarSalaMesa();
  if (tipo === "c" || x.esperando === meu) {
    escritorioApi(cfg.lista, null, { id }).then((r) => {
      const j = r.jogo, lugar = (j.jogadores || []).find((p) => String(p.id) === eu);
      if (j.estado === "convite" && (lugar ? lugar.lado !== "desafiante" && !lugar.aceitou : j.desafiado.id === eu)) {
        mesaConviteAviso(j, cfg);
      } else if (j.estado === "jogando" && x.esperando === meu) {
        x.esperando = null;
        // Abre por cima de qualquer tela do lobby ou do convite; só não tapa outra partida.
        const tela = document.getElementById("workflow-modal");
        if (!tela || /ofc-xdz-(sala|convite|novo|escolha)/.test(tela.className)) cfg.abrir(j);
        else escritorioAviso(j.grupo ? `Todos aceitaram ${cfg.artigo}. Clique na mesa do jogo para jogar.` : `${xadrezPrimeiroNome(j.desafiado)} aceitou ${cfg.artigo}. Clique na mesa do jogo para jogar.`);
      } else if ((j.estado === "recusado" || j.estado === "cancelado") && x.esperando === meu) {
        x.esperando = null;
        escritorioAviso(`${xadrezPrimeiroNome(j.desafiado)} não aceitou ${cfg.artigo} agora.`);
      }
    }).catch(() => {});
  }
}
// Convite que chega com outra coisa na tela: um aviso no canto com Aceitar,
// Ver e Recusar (antes só dizia "clique na mesa para responder").
function mesaConviteAviso(j, cfg) {
  if (!document.getElementById("workflow-modal")) { escritorioXadrez().mesa = { camada: j.camada, movel: j.movel }; return desenharConviteXadrez(j, cfg); }
  document.getElementById("mesa-convite-aviso")?.remove();
  const el = document.createElement("div"), u = escritorioCabecaUrl(j.desafiante.id);
  el.id = "mesa-convite-aviso"; el.className = "mesa-convite-aviso"; el.setAttribute("role", "alertdialog");
  el.innerHTML = `${u ? `<img src="${safeText(u)}" alt="" width="40" height="40">` : ""}<div><b>${xadrezPrimeiroNome(j.desafiante)} te chamou para ${cfg.artigo}</b><small>${j.moedas ? `Valendo ${Number(j.moedas).toLocaleString("pt-BR")} VybeCoins de cada um` : "Partida de graça"}</small></div>
<button type="button" class="workflow-secondary" data-a="recusar">Recusar</button><button type="button" class="workflow-secondary" data-a="ver">Ver</button><button type="button" class="workflow-primary" data-a="aceitar">Aceitar</button>`;
  el.addEventListener("click", (ev) => {
    const a = ev.target.closest("button")?.dataset.a;
    if (!a) return;
    el.remove();
    const x = escritorioXadrez();
    x.cfg = cfg; x.mesa = { camada: j.camada, movel: j.movel };
    if (a === "ver") return desenharConviteXadrez(j, cfg);
    responderXadrezEscritorio(j.id, a);
  });
  document.body.append(el);
  escritorioTocar(660, 0.08, 0.06);
  // Some quando o convite vence.
  setTimeout(() => el.remove(), Math.max(5000, new Date(j.convite_ate || Date.now() + 600000).getTime() - Date.now()));
}
