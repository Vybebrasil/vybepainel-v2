// Sinuca na mesa de bilhar do Escritório (pedido do Paulo, 27/10/2026): bola 8
// para dois, de graça ou valendo VybeCoins e móveis/roupas. Convite e aposta
// são as telas do xadrez; a moldura da partida é a das mesas
// (vybe-escritorio-mesas.js). A física roda no servidor
// (server/escritorio-sinuca.js): aqui se mira, escolhe a força, põe a branca
// quando tem bola na mão e anima os quadros que o servidor devolveu. Aviso
// pelo balão de comando (snc=<id>:<para>:<c|l>).
//
// Clique/toque no pano confirma a mira. Um clique na força apenas escolhe;
// arrasto deliberado dispara com a direção capturada no início do gesto.
// Cancelamento, troca de vez e ponteiros concorrentes nunca concluem uma tacada.
const SINUCA_CFG = registrarMesaEscritorio({
  nome: "Sinuca", artigo: "a sinuca", extra: { jogo: "sinuca" }, sinal: "snc",
  // A tacada já toca os sons dela na animação.
  som: () => null,
  aviso: (texto) => sinucaAvisar(texto),
  salaUI: desenharLobbySinuca, novoUI: desenharNovoSinuca, conviteUI: desenharConviteSinuca,
  nota: "Par ou ímpar, regra de bar: a mesa começa aberta e quem encaçapar primeiro fica com o grupo da bola que matou: par (as lisas) ou ímpar (as listradas). Limpe as suas e mate o ás (a 1, colado na cabeceira) para ganhar. Suicida, cegar, bater primeiro na bola do outro ou matar bola do outro (mesmo junto com a sua) é falta: sai mais uma bola do outro, nada volta para a mesa e a vez passa; na suicida o outro põe a branca no D.", desenhar: (j, s) => desenharSinuca(j, s),
  // Pinta a mesa logo depois de a tela ser montada, na mesma volta: com um
  // setTimeout o navegador mostrava o canvas novo vazio por um quadro, e quem
  // assistia via a mesa piscar a cada tacada (Paulo, 28/10/2026).
  depois: () => { sinucaPintar(); sinucaAudioPreparar?.(); sinucaTacosVitrine(document.querySelector(".ofc-snc-jogo") || document); sinuca3dIniciar(); },
});
// A imagem conserva sua proporção. O pano é mapeado por eixo; as bolas
// continuam redondas, com raio na escala horizontal da mesa (54 mm nas novas).
const SINUCA_L=100,SINUCA_A=50,SINUCA_METRICA_Y=ESCRITORIO_SINUCA_MESA.metricaY;
const SINUCA_ARTE=ESCRITORIO_SINUCA_MESA.arte,SINUCA_PANO=SINUCA_ARTE.pano;
// Tela de alta densidade (Retina) pinta a arte inteira; nas outras, a metade
// (a mesa borrava no Mac: 1376 px esticados até ~1100 pontos × 2).
const SINUCA_ESCALA=typeof devicePixelRatio==="number"&&devicePixelRatio>1.25?1:0.5,SINUCA_TRACO=SINUCA_ESCALA*2;
const SINUCA_W=SINUCA_ARTE.largura*SINUCA_ESCALA,SINUCA_H=SINUCA_ARTE.altura*SINUCA_ESCALA;
const SINUCA_PX=SINUCA_PANO.largura*SINUCA_ESCALA/100,SINUCA_PY=SINUCA_PANO.altura*SINUCA_ESCALA/50;
const SINUCA_MESA=typeof Image==="function"?Object.assign(new Image(),{src:SINUCA_ARTE.arquivo}):null;
SINUCA_MESA?.addEventListener?.("load", () => sinucaPintar());
const SINUCA_CORES = ["#f7f4ea", "#f2c12e", "#1f5fbf", "#d23a2a", "#6a3fa0", "#f07a1a", "#1e8a4a", "#8a2a1e", "#151515"];
// Jogo de bolas do par ou ímpar (Paulo, 28/10/2026: "par (bolas preenchidas) ou
// ímpar (bola com listra branca)"; "bola par com listra também, faz direito"):
// as pares são lisas, as ímpares listradas, e a 1 é lisa amarela (a bola
// final). Cores diferentes dentro de cada grupo. Na bola 8, o jogo americano.
const SINUCA_PARIMPAR = { 1: "#f2c12e", 2: "#1f5fbf", 4: "#6a3fa0", 6: "#1e8a4a", 8: "#151515", 10: "#f07a1a", 12: "#8a2a1e", 14: "#d23a2a",
  3: "#d23a2a", 5: "#f07a1a", 7: "#8a2a1e", 9: "#f2c12e", 11: "#1f5fbf", 13: "#6a3fa0", 15: "#1e8a4a" };
// Cor e listra de cada bola no jogo da partida.
// Bola da vez: as cores da sinuca brasileira (1 vermelha a 7 preta), todas lisas.
const SINUCA_BOLA_DA_VEZ = { 1: "#c62828", 2: "#f2c12e", 3: "#1e8a4a", 4: "#7a4a1e", 5: "#1f5fbf", 6: "#e87ca0", 7: "#151515" };
function sinucaVisual(modo, n) {
  if (modo === "bolavez") return { cor: n ? SINUCA_BOLA_DA_VEZ[n] || SINUCA_CORES[0] : SINUCA_CORES[0], listra: false };
  if (modo === "parimpar") return { cor: n ? SINUCA_PARIMPAR[n] : SINUCA_CORES[0], listra: n % 2 === 1 && n !== 1 };
  return { cor: SINUCA_CORES[n > 8 ? n - 8 : n], listra: n > 8 };
}
const SINUCA_DICA = { livre: "Sua vez: o taco segue o mouse; clique no pano para travar a mira. Escolha a força e use TACAR, ou puxe para trás e solte.",
  travada: "Mira travada. Clique de novo no pano para soltar. Na barra, clique escolhe a força; arrastar e soltar taca." };
// Quanto puxar o mouse (em unidades da mesa) para a força toda: 40, para a
// força baixa (onde fica quase toda tacada) ter curso.
const SINUCA_PUXADA = 40;
// A velocidade que sai de cada força, a mesma conta do servidor (velocidadeDaForca).
const sinucaMetrosPorSegundo=ESCRITORIO_SINUCA_MESA.velocidade;
const SINUCA_FORCA_MIN=ESCRITORIO_SINUCA_MESA.forcaMinima;
const sinucaPercentual=(f)=>Number((f*100).toFixed(1)).toLocaleString("pt-BR");
const sinucaRaio = (j) => j?.mesa?.r || 1.15;
// A branca de 57 mm (partidas novas); nas antigas, o mesmo raio das outras.
const sinucaRaioBranca = (j) => j?.mesa?.rb || sinucaRaio(j);
// Bolas desenhadas (8-Ball pool assets, CC0; assets/jogos/bolas.webp): folha
// com a branca e as 15 numeradas, 96 px cada, na ordem do número.
const SINUCA_BOLAS = typeof Image === "function" ? Object.assign(new Image(), { src: "/assets/jogos/bolas.webp" }) : null;
SINUCA_BOLAS?.addEventListener?.("load", () => sinucaPintar());

function abrirSinucaEscritorio(m) {
  return abrirMesaEscritorio(m, SINUCA_CFG);
}
function sinucaSinalEscritorio(de, v) {
  const [id, , tipo, ang, forca, bx, by] = String(v || "").split(":");
  if (tipo === "m") return sinucaMiraRecebida(de, id, Number(ang), Number(forca), Number(bx), Number(by));
  mesaSinalEscritorio(SINUCA_CFG, de, v);
}
// A mira de quem está na vez, ao vivo para quem está na partida (Paulo,
// 28/10/2026: "a partida 1x1 precisa melhorar... um jogador vendo o que o
// outro faz também"). Antes só se via a tacada depois que ela acontecia.
function sinucaMandarMira(j, s, ang, forca, branca) {
  if (!j?.id || escritorio.base?.demo || !branca) return;
  const chave = `${ang.toFixed(3)}:${(forca || 0).toFixed(3)}:${branca[0].toFixed(2)}:${branca[1].toFixed(2)}`;
  if (chave === s.miraMandada) return;
  const agora = performance.now(), espera = 180 - (agora - (s.miraEm || 0));
  clearTimeout(s.miraTimer);
  if (espera > 0) { s.miraTimer = setTimeout(() => { const e = sinucaEstado(); if (e.jogo?.id === j.id && sinucaMinhaVez(e.jogo)) sinucaMandarMira(e.jogo, e, ang, forca, branca); }, espera); return; }
  s.miraEm = agora; s.miraMandada = chave;
  for (const para of mesaOutrosIds(j)) mesaSinal(SINUCA_CFG, j.id, para, "m:" + chave);
}
function sinucaMiraRecebida(de, id, ang, forca, bx, by) {
  const s = sinucaEstado(), j = s.jogo;
  if (!j || String(j.id) !== String(id) || j.estado !== "jogando" || String(de) === String(escritorio.base?.eu)) return;
  if (String(j[j.vez]?.id) !== String(de) || ![ang, forca, bx, by].every(Number.isFinite)) return;
  s.miraOutro = { ang, forca: Math.max(0, Math.min(1, forca)), b: [bx, by], em: performance.now(), n: j.mesa?.n ?? 0 };
  sinucaPintar();
}
function sinucaEstado() {
  return escritorioMesa("snc");
}
const sinucaMinhaVez = (j) => j?.estado === "jogando" && j.eu && j.vez === j.eu && j.mesa.pode_tacar;
const sinucaPondo = (j, s) => sinucaMinhaVez(j) && (j.mesa.bolaNaMao || !j.mesa.bolas[0]) && !s.branca;
// Onde a branca pode ir com bola na mão, como no servidor (brancaPode): na
// saída, atrás da linha (x ≤ 25); depois da suicida, dentro do D (raio 9,15 com
// o centro na marca de baixo); nas partidas de antes, a mesa toda.
const SINUCA_LINHA = 25, SINUCA_D = 9.15;
// R aqui é o raio da BRANCA (57 mm), e a borda fica 0,02 para dentro: com o
// raio das outras bolas e o arredondamento, a branca saía um fio da área e o
// servidor recusava toda tacada daquela vez (Paulo, 04/11/2026: "trava").
// Jeito de tacar, escolha de cada jogador (Paulo, 04/11/2026): "puxar" (puxa e
// empurra o taco na mesa) ou "travado" (arrastar na mesa só mira; a força vem
// da barra ou das setas ↑↓; ESPAÇO ou TACAR taca). Fica neste navegador.
function sinucaModoTacada() {
  try { return localStorage.getItem("snc-modo-tacada") === "travado" ? "travado" : "puxar"; } catch { return "puxar"; }
}
function sinucaEscolherModo(modo) {
  try { localStorage.setItem("snc-modo-tacada", modo === "travado" ? "travado" : "puxar"); } catch { /* sem armazenamento: vale só agora */ }
  SINUCA_MODO_AGORA = modo === "travado" ? "travado" : "puxar";
  desenharJogoMesa("snc");
  sinucaAvisar(SINUCA_MODO_AGORA === "travado" ? "Travado: mire, escolha a força e aperte ESPAÇO ou TACAR." : "Puxar: puxe o taco para trás e empurre para bater.");
}
let SINUCA_MODO_AGORA = null;
const sinucaTravadoAtivo = () => (SINUCA_MODO_AGORA ||= sinucaModoTacada()) === "travado";
function sinucaPrender(area, x, y, R) {
  const f = 0.02, ry = (R + f) / SINUCA_METRICA_Y;
  x = Math.min(SINUCA_L - R - f, Math.max(R + f, x)); y = Math.min(SINUCA_A - ry, Math.max(ry, y));
  if (area === "saida" || area === "D") x = Math.min(x, SINUCA_LINHA - f);
  if (area === "D") {
    const dx = x - SINUCA_LINHA, dy = (y - SINUCA_A / 2) * SINUCA_METRICA_Y, d = Math.hypot(dx, dy), max = SINUCA_D - f;
    if (d > max) { x = SINUCA_LINHA + dx * max / d; y = SINUCA_A / 2 + dy * max / d / SINUCA_METRICA_Y; }
  }
  return [x, y];
}
// A branca de onde sai a tacada: a da mesa ou a que a pessoa acabou de pôr.
function sinucaBranca(j, s) {
  if (j.mesa.bolaNaMao || !j.mesa.bolas[0]) return s.branca ? [s.branca.x, s.branca.y] : null;
  return j.mesa.bolas[0];
}
// Bola que eu posso tocar primeiro: do meu grupo (a 8 com o grupo limpo); mesa aberta, qualquer uma menos a 8.
const SINUCA_GRUPOS = { lisas: [1, 2, 3, 4, 5, 6, 7], listradas: [9, 10, 11, 12, 13, 14, 15], pares: [2, 4, 6, 8, 10, 12, 14], impares: [3, 5, 7, 9, 11, 13, 15] };
// No bar, "par" são as lisas e "ímpar" as listradas (Paulo, 28/10/2026).
const SINUCA_NOME_GRUPO = { lisas: "Lisas", listradas: "Listradas", pares: "Par (lisas)", impares: "Ímpar (listradas)" };
// A bola final: a 8 na bola 8 (a partida nova), a 1 no par ou ímpar com as 15.
const sinucaFinal = (j) => (j.mesa.modo === "parimpar" ? (j.mesa.bola1 ? 1 : null) : 8);
function sinucaPodeTocar(j, n) {
  if (j.mesa.modo === "bolavez") return n === j.mesa.daVez;
  const g = j.mesa.grupos?.[j.eu];
  // Mesa aberta (ninguém encaçapou ainda): vale qualquer bola menos a 1.
  if (j.mesa.modo === "parimpar") return !g ? n !== 1 : j.mesa.bola1 && !j.mesa.restam?.[g] ? n === 1 : SINUCA_GRUPOS[g]?.includes(n);
  if (!g) return n !== 8 || !j.mesa.tacadas;
  if (n === 8) return !j.mesa.restam?.[g];
  return g === "lisas" ? n < 8 : n > 8;
}

function sinucaUltimoTexto(j, u = j.mesa?.ultimo) {
  if (!u) return "";
  const quem = u.lado === j.eu ? "Você" : xadrezPrimeiroNome(j[u.lado]);
  if (u.falta === "tempo") return `${quem} deixou o tempo acabar: falta, bola na mão para o outro.`;
  const caiu = u.caiu.filter((n) => n !== 0);
  const bar = j.mesa.regra === "bar";
  const falta = (bar ? { branca: "suicida", "branca-fora": "suicida (a branca pulou da mesa)", nenhuma: "cegou (não tocou em nenhuma bola)", errada: u.primeiro === 1 ? "bateu primeiro no ás" : "bateu primeiro na bola do outro", "do-outro": "matou bola do outro" } : j.mesa.modo === "bolavez" ? { errada: `não bateu primeiro na ${u.daVez}, a bola da vez`, "outra-bola": "encaçapou bola que não era a da vez", nenhuma: "cegou (não tocou em nenhuma bola)", branca: "suicida" } : {})[u.falta]
    || { branca: "a branca caiu", "branca-fora": "a branca pulou para fora da mesa", fora: "bola pulou para fora da mesa (voltou para a marca)", nenhuma: "não tocou em nenhuma bola", errada: "tocou primeiro a bola errada" }[u.falta];
  const grupo = u.grupo ? ` e ficou com ${{ pares: "o par (as lisas)", impares: "o ímpar (as listradas)" }[u.grupo] || `as ${SINUCA_NOME_GRUPO[u.grupo].toLowerCase()}`}` : "";
  const dono = u.lado === "desafiante" ? "desafiado" : "desafiante", deQuem = dono === j.eu ? "sua" : `de ${xadrezPrimeiroNome(j[dono])}`;
  const multa = u.tirou ? `; sai a ${u.tirou} (${deQuem})` : "", volta = u.voltou?.length ? `; a ${u.voltou.join(", ")} voltou para a mesa` : "";
  const pontos = u.marcou ? `: +${u.marcou} ponto${u.marcou > 1 ? "s" : ""}` : u.pontosOutro ? `; ${u.pontosOutro} pontos para ${xadrezPrimeiroNome(j[dono]) || "o outro"}` : "";
  return `${quem} tacou${caiu.length ? ` e encaçapou ${caiu.length > 1 ? "as bolas" : "a"} ${caiu.join(", ")}` : " e não encaçapou nada"}${grupo}${falta ? `: falta, ${falta}${multa}${volta}` : ""}${pontos}.`;
}

// Anúncio no meio da mesa quando a tacada termina (Paulo, 29/10/2026: "tá
// confuso saber o que matou, o que saiu... uma animação rápida e fluida no
// meio com a bola que tirou pro outro ou a que morreu", "com a própria bola
// que caiu"): cada bola entra rolando, grande, com a mensagem embaixo.
// Fica por cima da página (não do canvas), porque a mesa se redesenha no fim.
function sinucaAnuncioBola(j, n) {
  const v = sinucaVisual(j.mesa.modo, n);
  return `<i class="snc-anuncio-bola${v.listra ? " listra" : ""}${n === 0 ? " branca" : ""}" style="--c:${v.cor}">${n || ""}</i>`;
}
function sinucaAnuncio(j, u) {
  if (typeof document === "undefined" || !u || u.falta === "tempo") return;
  const canvas = document.getElementById("snc-canvas");
  if (!canvas) return;
  const bar = j.mesa.regra === "bar", quem = u.lado === j.eu ? "Você" : xadrezPrimeiroNome(j[u.lado]);
  const dono = u.lado === "desafiante" ? "desafiado" : "desafiante", deQuem = dono === j.eu ? "sua" : `de ${xadrezPrimeiroNome(j[dono])}`;
  const fora = (u.fora || []).filter((n) => n !== 0), caiu = (u.caiu || []).filter((n) => n !== 0 && !fora.includes(n));
  const cartoes = [];
  if (caiu.length) cartoes.push({ tipo: u.falta ? "neutro" : "bom", bolas: caiu, titulo: u.marcou ? `+${u.marcou} ponto${u.marcou > 1 ? "s" : ""}!` : u.falta ? `Caiu a ${caiu.join(", ")}` : caiu.length > 1 ? `Matou ${caiu.length}!` : "Matou!", texto: `${quem} encaçapou ${caiu.length > 1 ? "as bolas" : "a"} ${caiu.join(", ")}` });
  if (u.pontosOutro && u.falta !== "tempo") cartoes.push({ tipo: "multa", bolas: [], titulo: `+${u.pontosOutro} para ${xadrezPrimeiroNome(j[dono]) || "o outro"}`, texto: "Falta na bola da vez" });
  if ((u.caiu || []).includes(0) || u.falta === "branca") cartoes.push({ tipo: "ruim", bolas: [0], titulo: bar ? "Suicida!" : "A branca caiu", texto: "Falta: bola na mão para o outro" });
  if (u.falta === "branca-fora") cartoes.push({ tipo: "ruim", bolas: [0], titulo: "A branca pulou!", texto: "Saiu da mesa: falta" });
  if (fora.length) cartoes.push({ tipo: "ruim", bolas: fora, titulo: "Pulou da mesa", texto: `${fora.length > 1 ? "As bolas voltaram" : "A bola voltou"} para a marca` });
  if (u.tirou) { const sai = [u.tirou, ...(u.tirouMais || [])]; cartoes.push({ tipo: "multa", bolas: sai, titulo: sai.length > 1 ? "Multa dupla" : "Multa", texto: `Sai${sai.length > 1 ? "em" : ""} a${sai.length > 1 ? "s" : ""} ${sai.join(" e ")} (${deQuem})` }); }
  if (!cartoes.length && (u.falta === "nenhuma" || u.falta === "errada")) cartoes.push({ tipo: "ruim", bolas: [], titulo: u.falta === "nenhuma" ? (bar ? "Cegou!" : "Não tocou") : "Bola errada", texto: u.falta === "nenhuma" ? "Não tocou em nenhuma bola" : u.primeiro === 1 ? "Bateu primeiro no ás" : "Bateu primeiro na bola do outro" });
  if (!cartoes.length) return;
  document.querySelector(".snc-anuncio")?.remove();
  const r = canvas.getBoundingClientRect(), el = document.createElement("div");
  el.className = "snc-anuncio";
  el.setAttribute("role", "status");
  el.style.left = `${r.left + r.width / 2}px`; el.style.top = `${r.top + r.height / 2}px`;
  let atraso = 0;
  el.innerHTML = cartoes.map((c) => `<div class="snc-anuncio-cartao ${c.tipo}"><div class="snc-anuncio-bolas">${c.bolas.map((n) => { const h = sinucaAnuncioBola(j, n).replace('style="', `style="animation-delay:${(atraso += 90)}ms;`); return h; }).join("")}</div><b>${safeText(c.titulo)}</b><small>${safeText(c.texto)}</small></div>`).join("");
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("sai"), 2300);
  setTimeout(() => el.remove(), 2800);
}
// Jogador no placar de cima: cabeça, nome, de quem é a vez e as bolas do grupo
// (as que já caíram ficam apagadas).
function sinucaJogadorHtml(j, lado, q) {
  const p = j[lado], u = j.bot && String(p?.id) === "bot" ? sinucaRetrato(j.bot.nivel || String(j.bot.id).split(":")[1]) : mesaCabecaUrl(j, p), vez = j.estado === "jogando" && j.vez === lado, eu = j.eu === lado, g = j.mesa.grupos[lado];
  // No ranking geral da sinuca: a posição e as vitórias e derrotas.
  const rk = q?.ranking?.lista?.find((r) => r.id === String(p?.id));
  const fichaRk = rk ? `<em class="snc-ficha" title="${rk.posicao}º no ranking da sinuca">${rk.posicao}º · ${rk.vitorias}V ${rk.derrotas}D</em>` : "";
  // Com as 15 bolas, a 1 vem no fim da fila: é a bola final de cada um.
  const nums = j.mesa.modo === "bolavez" ? [] : g ? [...SINUCA_GRUPOS[g], ...(j.mesa.bola1 ? [1] : j.mesa.modo === "parimpar" ? [] : [8])] : [];
  const bolas = nums.length ? nums.map((n) => { const v = sinucaVisual(j.mesa.modo, n); return `<i class="${j.mesa.bolas[n] ? "" : "caiu"}${v.listra ? " listra" : ""}${n === sinucaFinal(j) ? " final" : ""}" style="--c:${v.cor}" title="Bola ${n}">${n}</i>`; }).join("")
    : j.mesa.modo === "bolavez" ? `<b class="snc-pontos">${j.mesa.pontos?.[lado] || 0} <small>pts</small></b>${vez && j.mesa.daVez ? `<small>da vez</small>${(() => { const v = sinucaVisual("bolavez", j.mesa.daVez); return `<i class="final" style="--c:${v.cor}" title="Bola da vez">${j.mesa.daVez}</i>`; })()}` : ""}`
    : `<small>${j.mesa.modo === "parimpar" ? "Par ou ímpar a definir" : "Grupo a definir"}</small>`;
  const ficha = sinucaFichas(j)?.[String(p?.id)], trofeus = ficha ? ficha.trofeus.filter((t) => t.tem) : [];
  const taco = `<span class="snc-jogador-taco"><canvas data-snc-taco="${sinucaTacoModelo(j, lado)}" aria-hidden="true"></canvas>${trofeus.length ? `<i title="Troféus do bar">${trofeus.slice(0, 3).map((t) => t.icone).join("")}${trofeus.length > 3 ? `+${trofeus.length - 3}` : ""}</i>` : ""}</span>`;
  return `<div class="snc-jogador${vez ? " vez" : ""}${lado === "desafiado" ? " direita" : ""}" role="button" tabindex="0" title="Ver a ficha do bar" onclick="sinucaFichaDaMesa('${lado}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();sinucaFichaDaMesa('${lado}')}">${u ? `<img class="${j.bot && String(p?.id)==='bot'?'snc-bot-retrato':''}" src="${safeText(u)}" alt="" width="40" height="40">` : `<i class="snc-sem" aria-hidden="true">${safeText(String(p?.nome||"?")[0])}</i>`}
${vez ? mesaPrazoVezHtml(j) : ""}<div><b>${xadrezPrimeiroNome(p)}${eu ? " (você)" : ""}${fichaRk}</b>${taco}<span class="snc-grupo" aria-label="${g ? `${SINUCA_NOME_GRUPO[g]}, faltam ${j.mesa.restam[g]}` : "Mesa aberta"}">${g ? `<small>${SINUCA_NOME_GRUPO[g]}</small>` : ""}${bolas}</span></div></div>`;
}
// O confronto no meio do placar: quantas cada um ganhou do outro, em giz.
function sinucaConfrontoHtml(j, q) {
  const p = q?.placar || j.placar, a = String(j.desafiante?.id), b = String(j.desafiado?.id);
  if (!p || j.bot) return '<span class="snc-x" aria-hidden="true">VS</span>';
  return `<div class="snc-confronto" title="Partidas de sinuca entre vocês"><small>Entre vocês</small><b>${p[a] || 0}<i>×</i>${p[b] || 0}</b>${p.empates ? `<small>${p.empates} empate${p.empates > 1 ? "s" : ""}</small>` : ""}</div>`;
}
// Tracinhos de giz (de cinco em cinco, o quinto riscando os outros quatro).
function sinucaGizHtml(n) {
  const cinco = Math.floor(n / 5), resto = n % 5;
  return `${'<i class="giz-5"></i>'.repeat(Math.min(cinco, 6))}${resto ? `<i class="giz-${resto}"></i>` : ""}${cinco > 6 ? `<em>+${(cinco - 6) * 5}</em>` : ""}`;
}
// A lousa do bar embaixo da mesa (Paulo, 28/10/2026: "o placar... o histórico
// e o ranking da sinuca tá ruim, refaça"; "dá o visual de boteco"): o placar
// de vocês em tracinhos de giz, as últimas partidas entre os dois e o ranking
// geral da sinuca, com os dois da mesa marcados.
function sinucaLousaHtml(j, q) {
  if (!q || j.bot || !j.desafiante || !j.desafiado) return "";
  const a = j.desafiante, b = j.desafiado, eu = String(escritorio.base?.eu || ""), p = q.placar || {};
  const nome = (id) => (String(id) === String(a.id) ? xadrezPrimeiroNome(a) : String(id) === String(b.id) ? xadrezPrimeiroNome(b) : "");
  const linha = (pessoa) => `<div class="lousa-giz"><b>${xadrezPrimeiroNome(pessoa)}</b><span>${sinucaGizHtml(p[String(pessoa.id)] || 0) || "<em>nenhuma ainda</em>"}</span><strong>${p[String(pessoa.id)] || 0}</strong></div>`;
  const dia = (d) => { const t = d ? new Date(d) : null; return t && !Number.isNaN(t.getTime()) ? t.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Bahia" }) : ""; };
  const hist = (q.historico || []).map((h) => `<li class="${h.vencedor === eu ? "ganhei" : h.vencedor ? "perdi" : ""}"><b>${h.vencedor ? nome(h.vencedor) : "Empate"}</b><span>${safeText((h.vencedor ? h.motivo : String(h.motivo || "").replace(/^Empate\s*/i, "")) || (h.vencedor ? "ganhou" : ""))}${h.moedas ? ` · ${h.moedas} 🪙` : ""}</span><small>${dia(h.em)}</small></li>`).join("");
  const seq = q.sequencia && q.sequencia.vitorias > 1 ? `<p class="lousa-seq">${nome(q.sequencia.quem)} vem de ${q.sequencia.vitorias} vitórias seguidas</p>` : "";
  const rk = q.ranking?.lista || [];
  let antes = 0;
  const ranking = rk.map((r) => {
    const pulo = r.posicao > antes + 1 ? '<li class="lousa-pulo" aria-hidden="true">⋯</li>' : "";
    antes = r.posicao;
    const da = r.id === String(a.id) || r.id === String(b.id);
    return `${pulo}<li class="${da ? "da-mesa" : ""}${r.id === eu ? " eu" : ""}"><i>${["🥇", "🥈", "🥉"][r.posicao - 1] || `${r.posicao}º`}</i><b>${safeText(String(r.nome).split(" ")[0])}</b><span>${r.vitorias}V · ${r.derrotas}D</span></li>`;
  }).join("");
  return `<section class="snc-lousa" aria-label="Lousa do bar: placar, últimas partidas e ranking">
<div class="lousa-bloco"><h4>Placar de vocês</h4>${linha(a)}${linha(b)}${seq}</div>
<div class="lousa-bloco"><h4>Últimas entre vocês</h4>${hist ? `<ol class="lousa-hist">${hist}</ol>` : '<p class="lousa-vazio">Primeira partida entre os dois. Vale o giz!</p>'}</div>
<div class="lousa-bloco"><h4>Ranking da sinuca</h4>${ranking ? `<ol class="lousa-rank">${ranking}</ol><small class="lousa-pe">${q.ranking.total} ${q.ranking.total === 1 ? "jogador" : "jogadores"} · todas as partidas entre a equipe</small>` : '<p class="lousa-vazio">Ninguém ganhou ainda.</p>'}</div>
</section>`;
}
function desenharSinuca(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const chave = j.id + ":" + j.n;
  // Tacadas novas (minhas ou do outro) entram na fila da animação, uma depois
  // da outra (Paulo, 28/10/2026: "quando o Vinícius dá uma tacada eu não vejo o
  // que ele fez"): o taco dele puxa e bate, as bolas andam e a faixa diz o que
  // aconteceu. Quem encaçapa continua, e entre uma consulta e outra podem ter
  // passado várias tacadas: o servidor manda as recentes com o número de cada.
  const nMesa = m.n ?? 0;
  if (s.vistoJogo !== j.id) { s.vistoJogo = j.id; s.vistoN = nMesa; s.anim = null; }
  else if (nMesa > s.vistoN) {
    const novas = (m.recentes || []).filter((t) => t.n > s.vistoN && !s.anim?.fila.some((x) => x.n === t.n));
    if (novas.length) { if (s.anim) s.anim.fila.push(...novas); else s.anim = { fila: novas, k: 0, inicio: 0, criada: performance.now() }; }
    const comTrilha = novas.filter((t) => t.trilhas || t.quadros?.length);
    if (comTrilha.length) s.replay = comTrilha[comTrilha.length - 1];
    s.vistoN = nMesa;
  }
  if (s.visto !== chave) {
    sinucaGestoLimpar(s); s.visto = chave; s.branca = null; s.travada = false; s.puxando = null; s.forcaAgora = null; s.miraOutro = null; s.miraMandada = null;
    // Regra de bar: a branca já vem posta no meio da área; dá para tacar dali ou arrastar.
    if (sinucaMinhaVez(j) && m.bolaNaMao && m.bolas[0]) s.branca = { x: m.bolas[0][0], y: m.bolas[0][1] };
  }
  const minha = sinucaMinhaVez(j), poe = sinucaPondo(j, s);
  const naMao = minha && m.bolaNaMao ? { saida: "Saída: a branca fica atrás da linha. Arraste-a se quiser, mire e taque.", D: "Bola na mão no D: arraste a branca dentro do D, mire e taque." }[m.bolaNaMao] : null;
  const passando = s.anim?.fila?.find((t) => t.lado !== eu);
  const statusLongo = j.estado !== "jogando" ? "" : passando ? `${xadrezPrimeiroNome(j[passando.lado])} tacou: veja a jogada.` : !eu ? "Você está assistindo." : j.vez !== eu ? `Vez de ${xadrezPrimeiroNome(j[outro])}.`
    : poe ? (m.bolaNaMao === "D" ? "Bola na mão: toque dentro do D para pôr a branca." : m.bolaNaMao === "saida" ? "Toque atrás da linha de saída para pôr a branca." : "Bola na mão: toque na mesa onde quer pôr a branca.")
    : naMao && s.branca ? naMao : SINUCA_DICA[s.travada ? "travada" : "livre"];
  const status = passando ? `${xadrezPrimeiroNome(j[passando.lado])} está jogando` : !minha ? (j.estado==='jogando' ? statusLongo : '') : poe ? 'Bola na mão · escolha onde colocar a branca' : m.bolaNaMao ? (m.bolaNaMao==='D'?'Bola na mão · branca dentro do D':'Saída · branca atrás da linha') : sinucaTravadoAtivo() ? 'Sua vez · mire, escolha a força e aperte ESPAÇO' : s.travada ? 'Sua vez · mira travada' : 'Sua vez · puxe o taco e empurre para bater';
  const efeito = s.efeito || 0, giro = s.giro || 0, ativo = minha && !poe;
  // Tela de jogo (Paulo, 04/11/2026: "mudou praticamente as cores só... mais
  // cara de jogo"): a força é um medidor em pé ao lado da mesa (deitado no
  // celular em pé), os comandos são blocos ao lado, com a roda da mira fina, e
  // as bolas encaçapadas caem numa bandeja embaixo da mesa.
  const fz = s.forca ?? 0.4, fp = Number((fz * 100).toFixed(1));
  const forca = `<div class="snc-forca${ativo ? '' : ' parada'}" style="--f:${fz}" role="slider" tabindex="${ativo ? 0 : -1}" aria-label="Força da tacada: clique seleciona; arraste e solte para tacar" aria-valuemin="0.1" aria-valuemax="100" aria-valuenow="${fp}" onpointerdown="sinucaForcaComeca(event)" onpointermove="sinucaForcaMove(event)" onpointerup="sinucaForcaSolta(event)" onpointercancel="sinucaGestoCancelar(event)" onlostpointercapture="sinucaGestoCancelar(event)" onkeydown="sinucaForcaTecla(event)"><b></b><span>${sinucaPercentual(fz)}%</span></div>`;
  const medidor = `<aside class="snc-medidor" aria-label="Força da tacada"><small>FORÇA</small>${forca}<label class="snc-forca-exata"><input type="number" min="0.1" max="100" step="0.1" value="${fp}" oninput="sinucaForcaEscolher(this)" ${ativo?'':'disabled'} aria-label="Força da tacada em porcentagem"><span>%</span></label></aside>`;
  const controles = `<section class="snc-comandos" aria-label="Controles da tacada">
<div class="snc-bloco snc-bloco-modo"><small>TACADA</small><div class="snc-modo-botoes" role="group" aria-label="Jeito de tacar"><button type="button" aria-pressed="${!sinucaTravadoAtivo()}" onclick="sinucaEscolherModo('puxar')" title="Puxe o taco para trás e empurre para bater">PUXAR</button><button type="button" aria-pressed="${sinucaTravadoAtivo()}" onclick="sinucaEscolherModo('travado')" title="Mire, escolha a força e aperte ESPAÇO ou TACAR">TRAVADO</button></div></div>
<div class="snc-bloco snc-bloco-camera"><small>CÂMERA</small><div class="snc-camera-botoes" role="group" aria-label="Câmera"><button type="button" onclick="sinucaCameraBotao(-0.12,0)" aria-label="Aproximar">＋</button><button type="button" onclick="sinucaCameraBotao(0.12,0)" aria-label="Afastar">－</button><button type="button" onclick="sinucaCameraBotao(0,0.25)" aria-label="Subir a câmera">▲</button><button type="button" onclick="sinucaCameraBotao(0,-0.25)" aria-label="Descer a câmera">▼</button></div><em class="snc-camera-dica">Roda do mouse: zoom · Shift + roda: altura</em></div>
<div class="snc-bloco snc-bloco-efeito"><small>EFEITO</small><div class="snc-efeito"><button type="button" class="snc-efeito-bola" onpointerdown="sinucaEfeitoComeca(event)" onpointermove="sinucaEfeito(event)" onpointerup="sinucaEfeitoSolta(event)" onpointercancel="sinucaEfeitoSolta(event)" ondblclick="sinucaEfeitoCentro(event)" onkeydown="sinucaEfeitoTecla(event)" ${ativo?'':'disabled'} title="Arraste para onde o taco bate na branca; duplo clique centraliza" aria-label="Efeito: ${sinucaEfeitoNome(efeito,giro)}"><i style="top:${50-efeito*34}%;left:${50+giro*34}%"></i></button></div><b class="snc-efeito-nome">${sinucaEfeitoNome(efeito,giro)}</b></div>
<div class="snc-bloco snc-bloco-mira"><small>MIRA FINA</small><div class="snc-roda${ativo ? '' : ' parada'}" role="slider" tabindex="${ativo ? 0 : -1}" aria-label="Roda da mira fina: arraste para os lados" aria-valuenow="${Number(((s.angulo ?? 0) * 180 / Math.PI).toFixed(2))}" onpointerdown="sinucaRoda(event,'down')" onpointermove="sinucaRoda(event,'move')" onpointerup="sinucaRoda(event,'up')" onpointercancel="sinucaRoda(event,'up')" onkeydown="sinucaRodaTecla(event)"><i></i></div><div class="snc-mira-fina" role="group" aria-label="Ajuste fino da mira"><button type="button" onclick="sinucaGirar(-1)" ${ativo?'':'disabled'} aria-label="Mira um pouco para um lado">↶</button><button type="button" onclick="sinucaGirar(1)" ${ativo?'':'disabled'} aria-label="Mira um pouco para o outro lado">↷</button></div></div>
<div class="snc-bloco snc-bloco-taco"><label class="snc-taco"><small>INCLINAÇÃO <b>${s.elevacao||0}°</b></small>${sinucaTacoDesenho(s.elevacao||0,efeito)}<input type="range" min="0" max="60" step="5" value="${s.elevacao||0}" oninput="sinucaElevacao(this)" ${ativo?'':'disabled'} aria-label="Inclinação do taco"><em class="snc-taco-texto">${sinucaTacoTexto(s.elevacao||0,giro)}</em></label></div>
<button type="button" class="snc-tacar" onclick="tacarSinuca()" aria-disabled="${!ativo}">TACAR</button><button type="button" class="snc-rever" onclick="sinucaRever()" ${s.replay && !s.anim ? '' : 'disabled'} title="Rever a última tacada em câmera lenta">↺ Rever jogada</button>${m.bolaNaMao&&s.branca&&minha?'<button type="button" class="snc-mudar" onclick="sinucaEstado().branca=null;desenharJogoMesa(\'snc\')">Reposicionar branca</button>':''}</section>`;
  const caidas = m.bolas.map((p, n) => (!p && n && (m.modo !== "bolavez" || n <= 7) ? n : null)).filter((n) => n !== null);
  const bandeja = `<div class="snc-bandeja" aria-label="Bolas fora da mesa">${caidas.map((n) => { const v = sinucaVisual(m.modo, n); return `<i class="${v.listra ? 'listra' : ''}" style="--c:${v.cor}" title="Bola ${n}">${n}</i>`; }).join('') || '<span>Nenhuma bola caiu ainda</span>'}</div>`;
  // O letreiro da vez: quando a vez chega para mim (depois da animação e do anúncio).
  if (minha && !s.anim && s.letreiro !== `${j.id}:${j.n}`) { s.letreiro = `${j.id}:${j.n}`; sinucaLetreiro(poe || m.bolaNaMao ? 'BOLA NA MÃO' : 'SUA VEZ', m.bolaNaMao === 'saida' ? 'Saída: quebre o triângulo' : 'Mire, dose e encaçape'); }
  const ultimo = sinucaUltimoTexto(j);
  // O histórico e o ranking vêm na leitura da mesa (verMesa); a resposta da
  // tacada não traz, então a lousa usa o último que chegou desta partida.
  if (j.fichas) s.fichas = { id: j.id, lista: j.fichas };
  if (j.ranking) s.quadro = { id: j.id, placar: j.placar, historico: j.historico, sequencia: j.sequencia, ranking: j.ranking };
  const q = j.ranking ? j : s.quadro?.id === j.id ? s.quadro : null;
  // Pinta logo que o canvas entra na tela (rAF não roda com a aba escondida).
  setTimeout(() => sinucaPintar());
  return {
    status,
    // HUD de jogo (Paulo, 04/11/2026: "mais cara de jogo e menos dashboard com
    // botão de balão"; o moodboard A): a mesa ocupa a tela e o placar, a força,
    // o efeito e o TACAR flutuam por cima, nas bordas, sem cartões.
    mesa: `<div class="snc-arena snc-hud${minha ? " minha" : ""}"><div class="snc-placar">${sinucaJogadorHtml(j, "desafiante", q)}${sinucaConfrontoHtml(j, q)}${sinucaJogadorHtml(j, "desafiado", q)}</div>${medidor}<div class="snc-area"><canvas id="snc-canvas" class="snc-canvas${minha ? " vez" : ""}${s.travada ? " travada" : ""}${poe ? " pondo" : ""}" width="${SINUCA_W}" height="${SINUCA_H}" role="img" aria-label="Mesa de sinuca"
 onpointercancel="sinucaGestoCancelar(event)" onlostpointercapture="sinucaGestoCancelar(event)" onpointermove="sinucaPonteiro(event,'move')" onpointerdown="sinucaPonteiro(event,'down')" onpointerup="sinucaPonteiro(event,'up')" onclick="sinucaPonteiro(event,'clique')" onwheel="sinucaCameraRoda(event)"></canvas></div>${controles}</div>${bandeja}`,
    painel: sinucaPainelHtml(j, s, q, ultimo),
  };
}

// Ponteiro na mesa. Com o mouse o taco segue o cursor ao vivo; um clique trava
// a mira (o caminho até a barra não a altera) e outro clique solta (Paulo,
// 29/10/2026: "o taco com a mira não mexe mais... perdeu o real time").
// Dedo arrastado ajusta a direção. Bola na mão: o toque põe a branca.
// Um gesto pertence a um único ponteiro e a uma única vez da partida.
const SINUCA_GESTO_MIN_PX = 4;
function sinucaGestoNovo(s, ev, tipo) {
  return { tipo, estavaTravada:!!s.travada, pointerId:ev.pointerId, jogoId:s.jogo.id, n:s.jogo.n, lado:s.jogo.eu,
    angulo:s.angulo??0, inicioX:ev.clientX, inicioY:ev.clientY, distancia:0 };
}
function sinucaGestoValido(s, g, ev) {
  return g && (!ev || ev.pointerId===g.pointerId) && sinucaMinhaVez(s.jogo) && !s.anim && !s.enviando
    && s.jogo.id===g.jogoId && s.jogo.n===g.n && s.jogo.eu===g.lado;
}
function sinucaGestoLimpar(s) {
  s.gesto=null; s.puxada=null; s.puxando=null; s.dedo=false; s.forcaAgora=null;
}
function sinucaGestoCancelar(ev) {
  const s=sinucaEstado(), g=s.gesto;
  if(s.gira3d&&(!ev||ev.pointerId===s.gira3d.id)){s.gira3d=null;s.forcaAgora=null;}
  if(ev && g && ev.pointerId!==g.pointerId)return;
  if(g?.tipo==='branca' && g.anterior)s.branca=g.anterior;
  sinucaGestoLimpar(s);sinucaForcaAtualizar(s.forca??0.4);sinucaPintar();
}
function sinucaArrastoForca(ev,c,g) {
  const rect=c.getBoundingClientRect(), ux=Math.cos(g.angulo)*SINUCA_PX,uy=Math.sin(g.angulo)*SINUCA_PY,len=Math.hypot(ux,uy);
  const dx=ev.clientX-g.inicioX,dy=ev.clientY-g.inicioY,puxou=-(dx*ux+dy*uy)/len;
  g.distancia=Math.hypot(dx,dy);
  const curso=SINUCA_PUXADA*len*rect.width/c.width;
  return Math.max(0,Math.min(1,(puxou-SINUCA_GESTO_MIN_PX)/Math.max(1,curso-SINUCA_GESTO_MIN_PX)));
}
function sinucaPonteiro(ev,tipo) {
  const s=sinucaEstado(),j=s.jogo,c=ev.currentTarget;
  if(sinuca3dAtivo()&&!sinucaPondo(j,s))return sinucaPonteiro3d(ev,tipo);
  sinucaAnimVencida(s,j);
  if(s.anim&&tipo==='clique')return sinucaPular(s,j);
  if(!sinucaMinhaVez(j)||s.anim||s.enviando)return;
  if(tipo==='down'&&ev.button!==undefined&&ev.button!==0)return;
  if(s.gesto&&!sinucaGestoValido(s,s.gesto))return sinucaGestoCancelar();
  if(s.gesto&&ev.pointerId!==s.gesto.pointerId)return;
  const R=sinucaRaio(j),rect=c.getBoundingClientRect();
  const [x,y]=sinucaCoordenadas((ev.clientX-rect.left)/rect.width*SINUCA_W,(ev.clientY-rect.top)/rect.height*SINUCA_H);
  if(sinucaPondo(j,s)){
    const [px,py]=sinucaPrender(j.mesa.bolaNaMao,x,y,sinucaRaioBranca(j));
    const livre=j.mesa.bolas.every((b,n)=>!b||n===0||Math.hypot(b[0]-px,(b[1]-py)*SINUCA_METRICA_Y)>=R+sinucaRaioBranca(j)+0.1);
    s.fantasma={x:px,y:py,livre};
    if(tipo==='down'){s.gesto=sinucaGestoNovo(s,ev,'branca');c.setPointerCapture?.(ev.pointerId);}
    if(tipo==='up'||tipo==='clique'){
      if(!livre){escritorioAviso('Aí a branca encosta noutra bola: toque num lugar livre.');sinucaGestoLimpar(s);return sinucaPintar();}
      s.branca={x:Math.round(px*100)/100,y:Math.round(py*100)/100};s.fantasma=null;sinucaGestoLimpar(s);desenharJogoMesa('snc');return;
    }
    sinucaPintar();return;
  }
  if(tipo==='clique')return;
  const branca=sinucaBranca(j,s);if(!branca)return;
  if(tipo==='down'){
    if(s.branca&&Math.hypot(x-branca[0],y-branca[1])<R*1.6){
      const anterior=s.branca;s.branca=null;s.fantasma={...anterior,livre:true};s.gesto={...sinucaGestoNovo(s,ev,'branca'),anterior};c.setPointerCapture?.(ev.pointerId);sinucaPintar();return;
    }
    // Mira travada fica onde está: puxar taca nela, clicar solta.
    if(!(s.travada&&ev.pointerType==='mouse')&&Math.hypot(x-branca[0],y-branca[1])>0.5)s.angulo=Math.atan2(y-branca[1],x-branca[0]);
    s.gesto=sinucaGestoNovo(s,ev,ev.pointerType==='mouse'?'mesa':'toque');sinucaTravar(s,c,true);
    s.puxada=s.gesto;c.setPointerCapture?.(ev.pointerId);sinucaPintar();return;
  }
  // Mouse passando pela mesa sem botão: o taco segue o cursor enquanto a mira está solta.
  if(tipo==='move'&&!s.gesto&&ev.pointerType==='mouse'){
    if(!s.travada&&Math.hypot(x-branca[0],y-branca[1])>0.5){s.angulo=Math.atan2(y-branca[1],x-branca[0]);sinucaPintar();}
    return;
  }
  const g=s.gesto;if(!sinucaGestoValido(s,g,ev))return;
  if(g.tipo==='toque'){
    if(Math.hypot(x-branca[0],y-branca[1])>0.5)s.angulo=Math.atan2(y-branca[1],x-branca[0]);
    if(tipo==='up')sinucaGestoLimpar(s);sinucaPintar();return;
  }
  if(g.tipo!=='mesa')return;
  const forca=sinucaArrastoForca(ev,c,g);
  if(tipo==='move'){if(g.distancia>SINUCA_GESTO_MIN_PX)sinucaForcaMostrar(forca,true);return;}
  if(tipo==='up'){
    const disparar=g.distancia>SINUCA_GESTO_MIN_PX&&forca>=SINUCA_FORCA_MIN;
    sinucaGestoLimpar(s);
    if(disparar){s.forca=forca;tacarSinuca({...g,forca});}
    else{
      // Clique sem puxar numa mira que já estava travada: solta, e o taco volta a seguir o mouse.
      if(g.estavaTravada&&g.distancia<=SINUCA_GESTO_MIN_PX)sinucaTravar(s,c,false);
      sinucaForcaAtualizar(s.forca??0.4);sinucaPintar();
    }
  }
}
function sinucaTravar(s,c,travar) {
  s.travada=travar;c.classList?.toggle?.('travada',travar);
  const st=document.querySelector('.ofc-snc-jogo .xdz-status');
  if(st&&!s.branca)st.textContent=SINUCA_DICA[travar?'travada':'livre'];
}
// Taco inclinado (0 a 60 graus): a física faz a bola pular e, com efeito
// lateral, fazer a curva.
function sinucaElevacao(el) {
  const s = sinucaEstado();
  if(s.gesto||s.enviando)return;
  s.elevacao = Number(el.value) || 0;
  sinucaTacoAtualizar(s);
  sinucaPintar();
}
// O taco visto de lado (Paulo, 29/10/2026: "a inclinação também do taco...
// mostrar mais o que tá acontecendo"): bola, pano e o taco no ângulo escolhido,
// batendo na altura do efeito, e uma frase do que a física vai fazer.
function sinucaTacoTexto(elev, giro) {
  if (!elev) return "Taco deitado: a branca sai rente ao pano.";
  if (elev <= 15) return "Inclinação leve: quase igual, com um pouco menos de força.";
  if (elev <= 35) return giro ? "A branca dá um pulinho e faz curva para o lado do efeito." : "A branca dá um pulinho. Com efeito lateral, faz curva.";
  return giro ? "Massé: a branca pula e faz curva forte; sai com bem menos força." : "Taco em pé: a branca pula e perde força. Com efeito lateral vira massé.";
}
function sinucaTacoDesenho(elev, efeito) {
  const a = (elev * Math.PI) / 180, cx = 60, cy = 27, r = 7, h = Math.max(-0.85, Math.min(0.85, efeito * 0.5));
  const px = cx - r * Math.sqrt(1 - h * h), py = cy - r * h, ex = px - Math.cos(a) * 52, ey = py - Math.sin(a) * 52;
  return `<svg class="snc-taco-vista" viewBox="0 0 80 40" aria-hidden="true"><line x1="2" y1="34.5" x2="78" y2="34.5" class="pano"/><circle cx="${cx}" cy="${cy}" r="${r}" class="bola"/><line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${(px - Math.cos(a) * 1.5).toFixed(1)}" y2="${(py - Math.sin(a) * 1.5).toFixed(1)}" class="taco"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="1.4" class="ponto"/></svg>`;
}
function sinucaTacoAtualizar(s) {
  const el = document.querySelector(".ofc-snc-jogo .snc-taco");
  if (!el) return;
  const t = el.querySelector("small"), v = el.querySelector(".snc-taco-vista"), d = el.querySelector(".snc-taco-texto");
  if (t) t.innerHTML = `Inclinação <b>${s.elevacao || 0}°</b>`;
  if (v) v.outerHTML = sinucaTacoDesenho(s.elevacao || 0, s.efeito || 0);
  if (d) { d.textContent = sinucaTacoTexto(s.elevacao || 0, s.giro || 0); delete d.dataset.levantado; }
}
// Pular a animação da tacada que está passando (as bolas vão para onde pararam).
function sinucaPular(s, j) {
  const a = s.anim, t = a?.fila[a.k];
  if (!t || !a.inicio) return;
  const d = sinucaAnimTempos(t, j), agora = performance.now();
  if (agora - a.inicio < d.taco + d.bolas) a.inicio = agora - (d.taco + d.bolas);
  sinucaPintar();
}
// Ajuste fino da mira: um décimo de grau por toque (no simulador um corte longo
// pede uns 0,3° de precisão).
function sinucaGirar(lado) {
  const s = sinucaEstado();
  if (!sinucaMinhaVez(s.jogo) || s.anim || s.enviando || s.gesto) return;
  s.travada=true;
  s.angulo = (s.angulo ?? 0) + lado * (Math.PI / 1800);
  sinucaPintar();
}
// Câmera do jogador (Paulo, 04/11/2026: "zoom in e out... e pra cima e pra
// baixo"): a roda do mouse aproxima e afasta, com Shift sobe e desce; no
// celular, os botões do bloco Câmera. Vale mirando e assistindo a jogada.
function sinucaCameraRoda(ev) {
  if (!sinuca3dAtivo()) return;
  ev.preventDefault();
  const d = Math.sign(ev.deltaY || ev.deltaX || 0) * 0.08;
  if (ev.shiftKey) SINUCA_3D.api.ajustarVista(0, d * 1.5); else SINUCA_3D.api.ajustarVista(d, 0);
}
function sinucaCameraBotao(dz, da) { if (sinuca3dAtivo()) SINUCA_3D.api.ajustarVista(dz, da); }
// Aviso de que o taco levantou sozinho (só muda o texto quando muda o ângulo).
function sinucaAvisoLevantado(graus) {
  const el = document.querySelector(".ofc-snc-jogo .snc-taco-texto");
  if (!el || el.dataset.levantado === String(graus)) return;
  el.dataset.levantado = String(graus);
  const s = sinucaEstado(), elev = Math.max(graus, s.elevacao || 0);
  el.textContent = graus ? `Taco levantado a ${graus}° para passar por cima da tabela ou da bola atrás.` : sinucaTacoTexto(s.elevacao || 0, s.giro || 0);
  // O painel mostra a inclinação de verdade (Paulo: "pra não parecer que tô batendo no meio").
  const rotulo = document.querySelector(".ofc-snc-jogo .snc-taco small");
  if (rotulo) rotulo.innerHTML = `INCLINAÇÃO <b>${elev}°${graus ? " (auto)" : ""}</b>`;
  const vista = document.querySelector(".ofc-snc-jogo .snc-taco-vista");
  if (vista) vista.outerHTML = sinucaTacoDesenho(elev, s.efeito || 0);
  const nome = document.querySelector(".ofc-snc-jogo .snc-efeito-nome");
  if (nome) nome.textContent = sinucaEfeitoNome(s.efeito || 0, s.giro || 0) + (graus ? ` · taco a ${graus}°` : "");
  document.querySelector(".ofc-snc-jogo .snc-efeito-bola")?.classList.toggle("levantado", Boolean(graus));
}
// Rever a última tacada em câmera lenta (metade da velocidade), com os sons e o
// anúncio; a câmera sobe como na tacada. Não muda nada da partida.
function sinucaRever() {
  const s = sinucaEstado();
  if (!s.replay || s.anim || s.enviando || s.gesto) return;
  s.anim = { fila: [{ ...s.replay }], k: 0, inicio: 0, lento: 0.5, criada: performance.now() };
  desenharJogoMesa("snc");
}
// Roda da mira fina (o "dial" dos jogos de sinuca): arrastar para os lados gira
// a mira 0,025° por pixel; as setas giram 0,05°. Trava a mira.
function sinucaRoda(ev, tipo) {
  const s = sinucaEstado(), el = ev.currentTarget;
  if (!sinucaMinhaVez(s.jogo) || s.anim || s.enviando) return;
  if (tipo === "down") { if (s.gesto || (ev.button !== undefined && ev.button !== 0)) return; s.roda = { id: ev.pointerId, x: ev.clientX }; el.setPointerCapture?.(ev.pointerId); s.travada = true; return; }
  if (!s.roda || s.roda.id !== ev.pointerId) return;
  if (tipo === "up") { s.roda = null; return; }
  const dx = ev.clientX - s.roda.x; s.roda.x = ev.clientX;
  sinucaRodaGirar(el, dx);
}
function sinucaRodaGirar(el, px) {
  const s = sinucaEstado();
  s.angulo = (s.angulo ?? 0) + px * Math.PI / 7200;
  s.rodaPx = (s.rodaPx || 0) + px; el?.style?.setProperty("--roda", `${s.rodaPx}px`);
  sinucaPintar();
}
function sinucaRodaTecla(ev) {
  const s = sinucaEstado();
  if (!["ArrowLeft", "ArrowRight"].includes(ev.key) || !sinucaMinhaVez(s.jogo) || s.anim) return;
  ev.preventDefault(); ev.stopPropagation(); s.travada = true; sinucaRodaGirar(ev.currentTarget, ev.key === "ArrowLeft" ? -2 : 2);
}
// Letreiro grande no meio da mesa quando a vez chega (espera o anúncio da tacada sair).
function sinucaLetreiro(titulo, texto) {
  if (typeof document === "undefined") return;
  const mostrar = () => {
    const canvas = document.getElementById("snc-canvas");
    if (!canvas) return;
    if (document.querySelector(".snc-anuncio")) return setTimeout(mostrar, 400);
    document.querySelector(".snc-letreiro")?.remove();
    const r = canvas.getBoundingClientRect(), el = document.createElement("div");
    el.className = "snc-letreiro"; el.setAttribute("role", "status");
    el.style.left = `${r.left + r.width / 2}px`; el.style.top = `${r.top + r.height / 2}px`;
    el.innerHTML = `<b>${safeText(titulo)}</b><small>${safeText(texto)}</small>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("sai"), 1100); setTimeout(() => el.remove(), 1500);
  };
  setTimeout(mostrar, 80);
}
// Efeito: o ponto da bolinha onde o taco bate. Em cima segue, embaixo puxa,
// dos lados a branca abre para aquele lado na tabela (no centro, nenhum).
function sinucaEfeitoNome(e, g) {
  const v = e > 0 ? "seguir" : e < 0 ? "puxar" : "", h = g > 0 ? "abrir para a direita" : g < 0 ? "abrir para a esquerda" : "";
  return [v, h].filter(Boolean).join(" e ") || "no centro";
}
// Ponto livre na bola (Paulo, 29/10/2026: "tá muito travado... devia deixar
// escolher onde quer bater solto na bola"): clicar ou arrastar põe o ponto em
// qualquer lugar do círculo (o limite é meia bola do centro, onde o taco ainda
// não escorrega), sem zona morta e em passos de 2%. Duplo clique centraliza;
// setas do teclado movem 5%.
const sinucaEfeitoPode = (s) => !(s.gesto || s.enviando || s.anim || !sinucaMinhaVez(s.jogo));
function sinucaEfeitoPor(el, vy, vx) {
  const s = sinucaEstado(), d = Math.hypot(vx, vy);
  if (d > 1) { vx /= d; vy /= d; }
  const passo = (v) => (Math.abs(v) < 0.03 ? 0 : Math.round(v * 50) / 50);
  s.efeito = passo(vy); s.giro = passo(vx);
  const i = el.querySelector("i");
  i.style.top = `${50 - s.efeito * 34}%`; i.style.left = `${50 + s.giro * 34}%`;
  el.setAttribute("aria-label", `Efeito: ${sinucaEfeitoNome(s.efeito, s.giro)}`);
  const t = el.closest(".snc-ajustes")?.querySelector(".snc-efeito-nome");
  if (t) t.textContent = sinucaEfeitoNome(s.efeito, s.giro);
  sinucaTacoAtualizar(s);
  sinucaPintar();
}
function sinucaEfeito(ev) {
  const s = sinucaEstado(), el = ev.currentTarget, r = el.getBoundingClientRect();
  if (!sinucaEfeitoPode(s)) return;
  if (ev.type === "pointermove" && !(s.efeitoArrasto === ev.pointerId)) return;
  sinucaEfeitoPor(el, -((ev.clientY - r.top) / r.height - 0.5) / 0.34, ((ev.clientX - r.left) / r.width - 0.5) / 0.34);
}
function sinucaEfeitoComeca(ev) {
  const s = sinucaEstado();
  if (!sinucaEfeitoPode(s) || (ev.button !== undefined && ev.button !== 0)) return;
  ev.preventDefault(); s.efeitoArrasto = ev.pointerId; ev.currentTarget.setPointerCapture?.(ev.pointerId);
  sinucaEfeito(ev);
}
function sinucaEfeitoSolta(ev) { const s = sinucaEstado(); if (s.efeitoArrasto === ev.pointerId) s.efeitoArrasto = null; }
function sinucaEfeitoCentro(ev) { if (sinucaEfeitoPode(sinucaEstado())) sinucaEfeitoPor(ev.currentTarget, 0, 0); }
function sinucaEfeitoTecla(ev) {
  const s = sinucaEstado(), d = { ArrowUp: [0.05, 0], ArrowDown: [-0.05, 0], ArrowLeft: [0, -0.05], ArrowRight: [0, 0.05] }[ev.key];
  if (!d || !sinucaEfeitoPode(s)) return;
  ev.preventDefault(); ev.stopPropagation();
  sinucaEfeitoPor(ev.currentTarget, (s.efeito || 0) + d[0], (s.giro || 0) + d[1]);
}

// Barra de força ao lado da mesa: arrasta-se para a direita; a distância
// percorrida é a força e soltar taca. Soltar em cima (menos de 0,1%) desiste.
function sinucaForcaDe(ev) {
  const r = ev.currentTarget.getBoundingClientRect();
  // Medidor em pé (ao lado da mesa): de baixo para cima; deitado: da esquerda.
  const v = r.height > r.width ? (r.bottom - ev.clientY) / r.height : (ev.clientX - r.left) / r.width;
  return Math.max(0, Math.min(1, v));
}
function sinucaForcaAtualizar(v, naMesa) {
  const el=document.querySelector('.snc-forca');
  if(el){el.style.setProperty('--f',String(v));el.querySelector('span').textContent=v<SINUCA_FORCA_MIN?(naMesa?'Puxe para trás':'Solte: cancela'):`${sinucaPercentual(v)}%`;el.setAttribute('aria-valuenow',String(Number((v*100).toFixed(1))));}
  const campo=document.querySelector('.snc-forca-exata input');if(campo&&document.activeElement!==campo)campo.value=Number((v*100).toFixed(1));
}
function sinucaForcaMostrar(v,naMesa){sinucaEstado().forcaAgora=v;sinucaForcaAtualizar(v,naMesa);sinucaPintar();}
function sinucaForcaEscolher(el){
  const s=sinucaEstado();if(!sinucaMinhaVez(s.jogo)||s.anim||s.enviando||s.gesto||sinucaPondo(s.jogo,s)||!el.validity.valid||el.value==='')return;
  s.forca=Number(el.value)/100;sinucaForcaMostrar(s.forca);
}
function sinucaForcaComeca(ev){
  const s=sinucaEstado();if(!sinucaMinhaVez(s.jogo)||s.anim||s.enviando||s.gesto||sinucaPondo(s.jogo,s))return;
  if(ev.button!==undefined&&ev.button!==0)return;
  s.gesto=sinucaGestoNovo(s,ev,'barra');s.puxando=true;ev.currentTarget.setPointerCapture?.(ev.pointerId);sinucaForcaMostrar(sinucaForcaDe(ev));
}
function sinucaForcaMove(ev){
  const s=sinucaEstado(),g=s.gesto;if(g?.tipo!=='barra'||!sinucaGestoValido(s,g,ev))return;
  g.distancia=Math.hypot(ev.clientX-g.inicioX,ev.clientY-g.inicioY);sinucaForcaMostrar(sinucaForcaDe(ev));
}
function sinucaForcaSolta(ev){
  const s=sinucaEstado(),g=s.gesto;if(g?.tipo!=='barra')return;
  if(ev.pointerId!==g.pointerId)return;
  if(!sinucaGestoValido(s,g,ev))return sinucaGestoCancelar();
  const v=sinucaForcaDe(ev),dist=Math.hypot(ev.clientX-g.inicioX,ev.clientY-g.inicioY);
  sinucaGestoLimpar(s);
  if(v<SINUCA_FORCA_MIN){sinucaForcaAtualizar(s.forca??0.4);sinucaPintar();return;}
  // A barra só escolhe a força (Paulo, 04/11/2026: "não consigo arrastar pra
  // escolher a força"); taca o TACAR ou puxar o taco na mesa.
  s.forca=v;s.forcaAgora=null;sinucaForcaAtualizar(v);sinucaPintar();void dist;
}
function sinucaForcaCancela(){sinucaGestoCancelar();}
// Teclado na barra: setas mudam a força, Enter ou espaço taca.
function sinucaForcaTecla(ev) {
  const s = sinucaEstado();
  if(!sinucaMinhaVez(s.jogo)||s.anim||s.enviando||s.gesto)return;
  if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(ev.key)) {
    ev.preventDefault();
    s.forca = Math.max(SINUCA_FORCA_MIN, Math.min(1, (s.forca ?? 0.4) + (["ArrowUp", "ArrowRight"].includes(ev.key) ? 1 : -1)*(ev.shiftKey ? 0.001 : 0.01)));
    sinucaForcaMostrar(s.forca);
  } else if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); tacarSinuca(); }
}
// O taco levanta sozinho (Paulo, 04/11/2026: "como é um simulador... o taco
// automaticamente não tinha que levantar? não deixar bater reto"): atrás da
// branca, ao longo do taco, a tabela (borracha e madeira) e as bolas são
// obstáculos; a inclinação mínima é a que faz o taco (raio ~0,5) passar por
// cima de todos, batendo na altura do centro da branca. Graus, de 5 em 5.
const SINUCA_TABELA_ALTURA = 1.9, SINUCA_TACO_RAIO = 0.5;
function sinucaElevacaoMinima(j, branca, ang) {
  if (!j?.mesa || !branca) return 0;
  const R = sinucaRaio(j), RB = sinucaRaioBranca(j), MY = SINUCA_METRICA_Y, dx = -Math.cos(ang), dy = -Math.sin(ang) * MY, n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n;
  let graus = 0;
  const precisa = (dist, altura) => { if (dist > 0.1) graus = Math.max(graus, Math.atan2(altura + SINUCA_TACO_RAIO - RB, dist) * 180 / Math.PI); };
  // Bolas atrás da branca, no corredor do taco.
  j.mesa.bolas.forEach((p, k) => {
    if (!p || k === 0) return;
    const ox = p[0] - branca[0], oy = (p[1] - branca[1]) * MY, t = ox * ux + oy * uy;
    if (t > R && Math.abs(ox * uy - oy * ux) < R + SINUCA_TACO_RAIO) precisa(t - R, 2 * R);
  });
  // A tabela atrás: até onde a branca encostaria indo para trás (o nariz da borracha).
  const atras = sinucaMiraAlvo(j.mesa.bolas.map((p, k) => (k === 0 ? p : null)), branca, -Math.cos(ang), -Math.sin(ang), R, RB);
  if (atras.s > 0) precisa(atras.s * Math.hypot(Math.cos(ang), Math.sin(ang) * MY) + RB, SINUCA_TABELA_ALTURA);
  return Math.min(60, Math.ceil(graus / 5) * 5);
}
// Animação vencida pelo relógio (Paulo, 04/11/2026: "fica a % mas não vai,
// clico pra tacar e não vai"): ela só anda enquanto a mesa é pintada; se a tela
// foi redesenhada ou a aba ficou escondida no meio, ficava "rodando" para sempre
// e toda tacada era descartada calada. Passado o tempo da fila inteira (mais
// folga), a mesa volta para o estado de verdade.
function sinucaAnimVencida(s, j) {
  const a = s.anim;
  if (!a || !j) return false;
  const total = a.fila.reduce((soma, t) => soma + sinucaAnimDuracao(t, j), 0) / (a.lento || 1);
  if (performance.now() - (a.criada || performance.now()) < total + 3000) return false;
  s.anim = null; sinucaPintar(); desenharJogoMesa("snc");
  return true;
}
document.addEventListener?.("visibilitychange", () => { if (!document.hidden) { const s = sinucaEstado(); if (s?.anim) { sinucaAnimVencida(s, s.jogo); sinucaPintar(); } } });
// Aviso dentro da mesa (a faixa do escritório fica atrás do modal).
function sinucaAvisar(texto) {
  const area = document.querySelector(".ofc-snc-jogo .snc-arena");
  if (!area || !texto) { escritorioAviso(texto); return; }
  let el = area.querySelector(".snc-aviso");
  if (!el) { el = document.createElement("p"); el.className = "snc-aviso"; el.setAttribute("role", "alert"); area.appendChild(el); }
  el.textContent = texto; el.classList.add("ver");
  clearTimeout(sinucaAvisar.t); sinucaAvisar.t = setTimeout(() => el.classList.remove("ver"), 3500);
}
// Não tacou: diz o motivo e devolve a barra à força escolhida (antes ficava
// parada na puxada, calada: "trava com a força e não solta").
function sinucaNaoTacou(s, motivo) {
  s.forcaAgora = null; sinucaForcaAtualizar(s.forca ?? 0.4); sinucaPintar();
  if (motivo) sinucaAvisar(motivo);
}
function tacarSinuca(gesto) {
  const s = sinucaEstado(), j = s.jogo;
  sinucaAnimVencida(s, j);
  // Gesto de outro ponteiro que nunca terminou (soltou fora da janela): não prende o botão.
  if (s.gesto && !gesto) sinucaGestoLimpar(s);
  if (!j || j.estado !== "jogando") return sinucaNaoTacou(s, "A partida não está em jogo.");
  if (!sinucaMinhaVez(j)) return sinucaNaoTacou(s, j.eu ? `Vez de ${xadrezPrimeiroNome(j[mesaOutro(j.eu)])}.` : "Você está assistindo.");
  if (s.anim) return sinucaNaoTacou(s, "Espere a jogada terminar.");
  if (s.enviando) return sinucaNaoTacou(s, "A tacada anterior ainda está indo para a mesa…");
  if (sinucaPondo(j, s)) return sinucaNaoTacou(s, "Ponha a branca na mesa primeiro.");
  if(gesto&&(gesto.jogoId!==j.id||gesto.n!==j.n||gesto.lado!==j.eu))return sinucaNaoTacou(s, "A mesa mudou: mire de novo.");
  const angulo=gesto?.angulo??s.angulo??0,forca=gesto?.forca??s.forca??0.4;
  const minima = sinucaElevacaoMinima(j, sinucaBranca(j, s), angulo);
  const pedido = { tipo: "tacar", angulo: Math.round(angulo * 10000) / 10000, forca: Math.max(SINUCA_FORCA_MIN, Math.min(1, Math.round(forca * 1000) / 1000)), efeito: s.efeito || 0, lado: s.giro || 0, elevacao: Math.max(s.elevacao || 0, minima) };
  if (j.mesa.bolaNaMao || !j.mesa.bolas[0]) pedido.branca = s.branca;
  lanceMesaEscritorio("snc", pedido);
}

const sinucaPx=(v)=>SINUCA_PANO.x*SINUCA_ESCALA+v*SINUCA_PX;
const sinucaPy=(v)=>SINUCA_PANO.y*SINUCA_ESCALA+v*SINUCA_PY;
const sinucaCoordenadas=(x,y)=>[(x-SINUCA_PANO.x*SINUCA_ESCALA)/SINUCA_PX,(y-SINUCA_PANO.y*SINUCA_ESCALA)/SINUCA_PY];
// A BOLA ROLA (Paulo, 27/10/2026: "as bolas nem giram, saem deslizando"): cada
// bola guarda a sua orientação (uma matriz 3x3) e, a cada quadro, gira em torno
// do eixo deitado perpendicular ao caminho, de distância / raio. A bola é pintada
// ponto a ponto como esfera: a faixa da listrada e o círculo do número andam com
// o giro, e o número aparece dos dois lados, como na bola de verdade.
const SINUCA_GIRO = new Map(), SINUCA_GIRO_QUADRO = 0.35;
function sinucaRolarBola(n, x, y, R) {
  const agora = performance.now();
  let o = SINUCA_GIRO.get(n);
  if (!o) { o = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], x, y, t: agora, mov: 0, rapido: 0 }; SINUCA_GIRO.set(n, o); return o; }
  const dx = x - o.x, dy = (y - o.y)*SINUCA_METRICA_Y, d = Math.hypot(dx, dy), dt = Math.max(1, agora - (o.t || agora));
  o.x = x; o.y = y; o.t = agora;
  // Pulo (bola que voltou à mesa, partida nova): não gira.
  if (d > 8 * R) { o.rapido = 0; return o; }
  // Parada: o borrão só some um pouco depois (a mesa é pintada de novo no mesmo
  // quadro pelo mouse e pela releitura, e a bola "parava" entre duas pinturas).
  if (!d) { if (agora - (o.mov || 0) > 150) o.rapido = 0; return o; }
  o.mov = agora;
  // Rápida, a bola de verdade vira um borrão; desenhada quadro a quadro, girando
  // mais de ~20° por quadro, a listra e o número trocam de lado a cada quadro e
  // ela pisca (Paulo, 28/10/2026). O giro e a velocidade contam pelo TEMPO (por
  // quadro de 60 Hz), não por pintura: duas pinturas no mesmo quadro mediam a
  // bola parada na segunda, e o número e a listra acendiam e apagavam (Paulo,
  // 28/10/2026: "as bolas parece que fica piscando trocando cor").
  const quadros = Math.max(dt, 16.7) / 16.7, porQuadro = d / R / quadros;
  const kx = -dy / d, ky = dx / d, a = Math.min(d / R, SINUCA_GIRO_QUADRO * Math.min(3, dt / 16.7)), c = Math.cos(a), sn = Math.sin(a), t = 1 - c;
  const alvo = Math.max(0, Math.min(1, (porQuadro - 0.15) / 0.35));
  // Acende o borrão na hora e apaga devagar (não volta a piscar na desaceleração).
  o.rapido = alvo >= (o.rapido || 0) ? alvo : o.rapido + (alvo - o.rapido) * Math.min(1, dt / 160);
  const G = [t * kx * kx + c, t * kx * ky, sn * ky, t * kx * ky, t * ky * ky + c, -sn * kx, -sn * ky, sn * kx, c];
  const m = o.m, r = new Array(9);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) r[i * 3 + k] = G[i * 3] * m[k] + G[i * 3 + 1] * m[3 + k] + G[i * 3 + 2] * m[6 + k];
  o.m = r;
  return o;
}
const sinucaCorRgb = (hex) => { const h = String(hex || "#888").replace("#", ""); const v = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h.slice(0, 6), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
// Cada bola guarda o próprio desenho (cache) e só repinta ponto a ponto quando
// girou: parada, ela é só copiada (antes as 16 eram pintadas pixel a pixel em
// todo quadro, e a animação engasgava no computador mais fraco).
const SINUCA_TELAS = new Map();
function sinucaEsferaPintar(g, px, py, r, cor, listra, m, numero, rapido = 0) {
  m=m.map(v=>Math.round(v*1000)/1000);
  const lado = Math.max(4, Math.ceil(r * 2));
  const chave = `${lado}|${cor}|${listra ? 1 : 0}|${m.map((v) => v.toFixed(3)).join(",")}|${rapido.toFixed(2)}`;
  let c = SINUCA_TELAS.get(numero);
  if (!c) { c = { tela: document.createElement("canvas"), chave: "" }; SINUCA_TELAS.set(numero, c); }
  const tela = c.tela;
  if (c.chave === chave) { g.drawImage(tela, px - r, py - r, 2 * r, 2 * r); sinucaNumeroPintar(g, px, py, r, m, numero, rapido); return; }
  c.chave = chave;
  if (tela.width !== lado) { tela.width = lado; tela.height = lado; }
  const tg = tela.getContext("2d"), img = tg.createImageData(lado, lado), d = img.data;
  const [cr, cg, cb] = sinucaCorRgb(cor), branco = [247, 244, 234];
  const rr = lado / 2;
  // Rápida, a listrada vira a mistura da cor com o branco (o borrão de verdade).
  const mistura = listra ? Math.min(0.85, rapido) : 0, media = [(cr + branco[0]) / 2, (cg + branco[1]) / 2, (cb + branco[2]) / 2];
  const disco = numero ? Math.max(0, 1 - rapido / 0.8) : 0;
  for (let yy = 0; yy < lado; yy++) for (let xx = 0; xx < lado; xx++) {
    const nx = (xx + 0.5 - rr) / rr, ny = (yy + 0.5 - rr) / rr, q = nx * nx + ny * ny;
    if (q > 1) continue;
    const nz = Math.sqrt(1 - q);
    // O ponto no corpo da bola: transposta da orientação vezes a normal.
    const by = m[1] * nx + m[4] * ny + m[7] * nz, bz = m[2] * nx + m[5] * ny + m[8] * nz;
    let c = listra ? (Math.abs(by) < 0.5 ? [cr, cg, cb] : branco) : [cr, cg, cb];
    if (mistura) c = [c[0] + (media[0] - c[0]) * mistura, c[1] + (media[1] - c[1]) * mistura, c[2] + (media[2] - c[2]) * mistura];
    if (disco && Math.abs(bz) > 0.86) c = [c[0] + (251 - c[0]) * disco, c[1] + (248 - c[1]) * disco, c[2] + (239 - c[2]) * disco];
    // Luz de cima à esquerda, um pouco de brilho e a borda mais escura.
    const luz = Math.max(0, -0.45 * nx - 0.5 * ny + 0.74 * nz), f = 0.42 + 0.68 * luz, esp = Math.pow(luz, 28) * 210;
    const i = (yy * lado + xx) * 4, borda = q > 0.86 ? (1 - q) / 0.14 : 1;
    d[i] = Math.min(255, c[0] * f + esp); d[i + 1] = Math.min(255, c[1] * f + esp); d[i + 2] = Math.min(255, c[2] * f + esp); d[i + 3] = 255 * Math.min(1, borda * 1.6);
  }
  tg.putImageData(img, 0, 0);
  g.drawImage(tela, px - r, py - r, 2 * r, 2 * r);
  sinucaNumeroPintar(g, px, py, r, m, numero, rapido);
}
// O disco é |(M^T normal).z| > 0,86. Seu eixo é a TERCEIRA COLUNA
// de M, e o centro da elipse projetada é 0,86 vezes esse eixo.
function sinucaNumeroPintar(g, px, py, r, m, numero, rapido) {
  const opacidade=Math.max(0,1-rapido/0.8);
  if(!numero||!opacidade)return;
  for(const sinal of [1,-1]){
    const zx=sinal*m[2],zy=sinal*m[5],zz=sinal*m[8];
    if(zz<0.52)continue;
    g.save();
    g.translate(px+0.86*zx*r,py+0.86*zy*r);
    const ang=Math.atan2(zy,zx);
    g.rotate(ang);g.scale(zz,1);g.rotate(-ang);
    // A mesma projeção vale para o disco e a inscrição; a tinta não sai do branco.
    g.beginPath();g.arc(0,0,r*Math.sqrt(1-0.86**2)*0.96,0,Math.PI*2);g.clip();
    g.fillStyle='#111';g.globalAlpha*=Math.min(1,(zz-.52)/.2)*opacidade;
    g.font=`800 ${r*(numero>9?.50:.62)}px system-ui,sans-serif`;
    g.textAlign='left';g.textBaseline='alphabetic';
    const texto=String(numero),medida=g.measureText(texto);
    g.fillText(texto,(medida.actualBoundingBoxLeft-medida.actualBoundingBoxRight)/2,(medida.actualBoundingBoxAscent-medida.actualBoundingBoxDescent)/2);
    g.restore();
  }
}
const SINUCA_LUZ = { dados:null, largura:256, altura:143 };
function sinucaLuzPano(px,py,r) {
  if (!SINUCA_LUZ.dados && SINUCA_MESA?.complete && SINUCA_MESA.naturalWidth) {
    const c=document.createElement('canvas'); c.width=SINUCA_LUZ.largura;c.height=SINUCA_LUZ.altura;
    const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(SINUCA_MESA,0,0,c.width,c.height);
    SINUCA_LUZ.dados=g.getImageData(0,0,c.width,c.height).data;
  }
  const {dados,largura,altura}=SINUCA_LUZ;if(!dados)return 0;
  let luz=0;
  for(const [dx,dy] of [[0,0],[-0.7,0],[0.7,0],[0,-0.7],[0,0.7]]) {
    const x=Math.max(0,Math.min(largura-1,Math.floor((px+dx*r)/SINUCA_W*largura)));
    const y=Math.max(0,Math.min(altura-1,Math.floor((py+dy*r)/SINUCA_H*altura))),i=(y*largura+x)*4;
    luz+=(0.2126*dados[i]+0.7152*dados[i+1]+0.0722*dados[i+2])/255;
  }
  return Math.min(1,Math.max(0,(luz/5-0.17)/0.25));
}
function sinucaBrancaContorno(g,px,py,r,luz) {
  g.shadowColor='transparent';g.beginPath();g.arc(px,py,r-0.4,0,Math.PI*2);
  g.strokeStyle=`rgba(12,22,16,${0.25+0.55*luz})`;g.lineWidth=Math.max(0.8,r*(0.035+0.045*luz));g.stroke();
}
function sinucaBolaPintar(g, n, x, y, R, transparente, escala = 1) {
  if (n === 0) R = sinucaEstado().jogo?.mesa?.rb || R;
  const px = sinucaPx(x), py = sinucaPy(y), r = R * SINUCA_PX * escala;
  g.save();
  if (transparente) g.globalAlpha = typeof transparente === "number" ? transparente : 0.55;
  // Sombra no pano e a bola como esfera que rola.
  g.beginPath(); g.ellipse(px + r * 0.2, py + r * 0.3, r * 0.95, r * 0.8, 0, 0, Math.PI * 2); g.fillStyle = "#00000045"; g.fill();
  const modo = sinucaEstado().jogo?.mesa?.modo || "bola8", v = sinucaVisual(modo, n);
  const o = transparente === true ? { m: [1, 0, 0, 0, 1, 0, 0, 0, 1] } : sinucaRolarBola(n, x, y, R);
  if (typeof document !== "undefined") {
    const luz=n===0?sinucaLuzPano(px,py,r):0;
    if(n===0){g.shadowColor=`rgba(0,0,0,${0.4+0.4*luz})`;g.shadowBlur=r*(0.18+0.22*luz);g.shadowOffsetY=r*0.13;}
    sinucaEsferaPintar(g,px,py,r,v.cor,v.listra,o.m,n,o.rapido||0);
    if(n===0)sinucaBrancaContorno(g,px,py,r,luz);
    g.restore();return;
  }
  // Sem tela (testes): a bola chapada de antes.
  g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2);
  g.fillStyle = v.listra ? "#f7f4ea" : v.cor; g.fill();
  // Volume: sombra embaixo à direita e o brilho da luz em cima à esquerda.
  const brilho = g.createRadialGradient(px - r * 0.38, py - r * 0.42, r * 0.04, px - r * 0.1, py - r * 0.1, r * 1.08);
  brilho.addColorStop(0, "#ffffffd0"); brilho.addColorStop(0.18, "#ffffff30"); brilho.addColorStop(0.6, "#00000000"); brilho.addColorStop(1, "#00000070");
  g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fillStyle = brilho; g.fill();
  g.restore();
}
function sinucaLinha(g, a, b, cor, traco, largura = 2) {
  g.setLineDash(traco); g.strokeStyle = cor; g.lineWidth = largura;
  g.beginPath(); g.moveTo(sinucaPx(a[0]), sinucaPy(a[1])); g.lineTo(sinucaPx(b[0]), sinucaPy(b[1])); g.stroke();
  g.setLineDash([]);
}
// As mesmas bocas e bordas que o servidor usa para colisão e queda.
function sinucaBuracos(){return ESCRITORIO_SINUCA_MESA.buracos.map(([x,y,r])=>({x,y,r}));}
function sinucaMesaPintar(g,W,H,R){
  if(SINUCA_MESA?.complete&&SINUCA_MESA.naturalWidth){g.drawImage(SINUCA_MESA,0,0,W,H);return;}
  // Desenho provisório enquanto carrega: usa a mesma geometria da física.
  g.fillStyle="#3d2b21";g.fillRect(0,0,W,H);
  g.fillStyle="#305548";g.fillRect(sinucaPx(0),sinucaPy(0),100*SINUCA_PX,50*SINUCA_PY);
  for(const b of sinucaBuracos()){
    g.beginPath();g.arc(sinucaPx(b.x),sinucaPy(b.y),b.r*SINUCA_PX,0,Math.PI*2);g.fillStyle="#050504";g.fill();
  }
  const paredes=ESCRITORIO_SINUCA_MESA.paredes,dentes=paredes.slice(6);
  for(const [x1,y1,x2,y2] of paredes.slice(0,6)){
    const de=dentes.find(p=>p[0]===x1&&p[1]===y1),ate=dentes.find(p=>p[0]===x2&&p[1]===y2);
    g.beginPath();[[x1,y1],[x2,y2],ate.slice(2),de.slice(2)].forEach(([x,y],i)=>i?g.lineTo(sinucaPx(x),sinucaPy(y)):g.moveTo(sinucaPx(x),sinucaPy(y)));
    g.closePath();g.fillStyle="#59624d";g.fill();
  }
}
// Desenha a mesa, as bolas (ou o quadro da animação) e a mira.
function sinucaPintar(agora) {
  const s = sinucaEstado(), j = s.jogo, c = document.getElementById("snc-canvas");
  if (!j || !c) return;
  if (sinuca3dAtivo()) {
    // No 3D, um desenho por quadro da tela: mouse de 1000 Hz chamava a cena
    // inteira (sombras, mira, inclinação) umas 16 vezes por quadro. A animação
    // já vem no compasso da tela (com `agora`) e desenha na hora.
    if (agora === undefined) {
      if (!SINUCA_3D.quadro) SINUCA_3D.quadro = requestAnimationFrame((t) => { SINUCA_3D.quadro = 0; sinucaPintar(t); });
      return;
    }
    c.getContext("2d").clearRect(0, 0, c.width, c.height); return sinucaPintar3d(agora);
  }
  const g = c.getContext("2d"), W = c.width, H = c.height, P = SINUCA_PX, R = sinucaRaio(j);
  g.clearRect(0, 0, W, H);
  sinucaMesaPintar(g, W, H, R);
  let bolas = j.mesa.bolas, cena = null;
  if (s.anim) {
    cena = sinucaAnimQuadro(s, j, agora || performance.now(), R);
    if (cena) bolas = cena.bolas;
  }
  const branca = !s.anim && sinucaMinhaVez(j) ? sinucaBranca(j, s) : null;
  bolas.forEach((p, n) => {
    if (!p || (n === 0 && branca && s.branca)) return;
    const z = cena?.z?.[n] || 0;
    if (z) { g.beginPath(); g.ellipse(sinucaPx(p[0]), sinucaPy(p[1]), R * P, R * P * 0.8, 0, 0, Math.PI * 2); g.fillStyle = "#00000040"; g.fill(); }
    sinucaBolaPintar(g, n, p[0], p[1] - z * 0.6, R, false, 1 + z / (6 * R));
  });
  // Bola caindo na caçapa: escorrega para o buraco, diminui e some.
  for (const c of cena?.caindo || []) sinucaBolaPintar(g, c.n, c.x, c.y, R, Math.max(0.15, c.escala), c.escala);
  // Sem anel nas minhas bolas (Paulo, 28/10/2026): quem joga vê pela bola se é
  // pintada (par) ou tem a faixa branca (ímpar), como no bar.
  if (s.anim) { if (cena) sinucaCenaPintar(g, W, cena, R, P); return; }
  if (sinucaMinhaVez(j) && j.mesa.bolaNaMao && (sinucaPondo(j, s) || s.branca)) sinucaAreaPintar(g, j.mesa.bolaNaMao, P);
  if (sinucaPondo(j, s) && s.fantasma) sinucaBolaPintar(g, 0, s.fantasma.x, s.fantasma.y, R, true);
  // O outro mirando (ao vivo): o taco dele, a linha que some e a branca onde ele pôs.
  const mo = s.miraOutro, viva = mo && mo.n === (j.mesa?.n ?? 0) && performance.now() - mo.em < 4000;
  if (viva && !sinucaMinhaVez(j)) {
    if (!j.mesa.bolas[0] || j.mesa.bolaNaMao) sinucaBolaPintar(g, 0, mo.b[0], mo.b[1], R, 0.7);
    const dx = Math.cos(mo.ang), dy = Math.sin(mo.ang);
    g.save(); g.globalAlpha = 0.85;
    sinucaMiraPintar(g, j, mo.b, dx, dy, R, P);
    sinucaTacoPintar(g, mo.b, dx, dy, (R + 0.5 + 10 * mo.forca) * P, P, sinucaTacoModelo(j, j.vez), mo.forca);
    g.restore();
    sinucaCenaPintar(g, W, { faixa: `${xadrezPrimeiroNome(j[j.vez])} está mirando` }, R, P);
    clearTimeout(s.miraApaga); s.miraApaga = setTimeout(() => sinucaPintar(), 4100);
  }
  if (!branca) return;
  sinucaMandarMira(j, s, s.angulo ?? 0, s.forcaAgora ?? 0, branca);
  if (s.branca) sinucaBolaPintar(g, 0, branca[0], branca[1], R);
  // O taco e a linha de pontinhos que some até a bola (sinucaMiraPintar), sem
  // cursor de mira em cima da mesa.
  const ang = s.angulo ?? 0, dx = Math.cos(ang), dy = Math.sin(ang);
  sinucaMiraPintar(g, j, branca, dx, dy, R, P);
  const meuTaco = sinucaTacoModelo(j, j.eu);
  sinucaTacoPintar(g, branca, dx, dy, (R + 0.5 + 10 * (s.forcaAgora ?? 0)) * P, P, meuTaco, s.forcaAgora ?? 0);
  sinucaSobTaco(g, j.mesa.bolas, branca, dx, dy, (R + 0.5 + 10 * (s.forcaAgora ?? 0)) * P, R);
}
// Mira (Paulo, 28/10/2026: "tão reclamando que tá muito difícil mirar... coloca
// a listrinha pontilhada do bolão branco até a bola que vai bater, mas a linha
// meio que vai sumindo pra não ficar tão fácil"): pontos da branca até onde ela
// encosta na primeira bola (ou na tabela), cada vez mais apagados; no fim, o
// contorno quase sumido de onde a branca encosta. Sem a volta das bolas.
function sinucaMiraAlvo(bolas, b, dx, dy, R, RB = R) {
  const escala=SINUCA_METRICA_Y,norma=Math.hypot(dx,dy*escala);
  b=[b[0],b[1]*escala];bolas=bolas.map(p=>p?[p[0],p[1]*escala]:null);dx/=norma;dy=dy*escala/norma;
  let s = Infinity, alvo = null;
  bolas.forEach((p, n) => {
    if (!p || n === 0) return;
    const ox = p[0] - b[0], oy = p[1] - b[1], t = ox * dx + oy * dy, d2 = ox * ox + oy * oy - t * t, r2 = (R + RB) ** 2;
    if (t <= 0 || d2 > r2) return;
    const k = t - Math.sqrt(r2 - d2);
    if (k > 0 && k < s) { s = k; alvo = n; }
  });
  // Raio contra os segmentos e as pontas das borrachas: a guia entra
  // nas bocas abertas e reconhece cada quina, como a bola no servidor.
  const circulo=(x,y,r)=>{
    const ox=x-b[0],oy=y-b[1],t=ox*dx+oy*dy,d2=ox*ox+oy*oy-t*t;
    if(t>0&&d2<=r*r){const k=t-Math.sqrt(Math.max(0,r*r-d2));if(k>0&&k<s){s=k;alvo=null;}}
  };
  for(const [x1,y1,x2,y2] of ESCRITORIO_SINUCA_MESA.paredes.map(([a,b,c,d])=>[a,b*escala,c,d*escala])){
    const ex=x2-x1,ey=y2-y1,len=Math.hypot(ex,ey),nx=-ey/len,ny=ex/len,vn=dx*nx+dy*ny;
    if(Math.abs(vn)>1e-9)for(const lado of [-RB,RB]){
      const k=(lado-((b[0]-x1)*nx+(b[1]-y1)*ny))/vn;
      const t=((b[0]+dx*k-x1)*ex+(b[1]+dy*k-y1)*ey)/(len*len);
      if(k>0&&t>=0&&t<=1&&k<s){s=k;alvo=null;}
    }
    circulo(x1,y1,RB);circulo(x2,y2,RB);
  }
  for(const [x,y,r] of ESCRITORIO_SINUCA_MESA.buracos)circulo(x,y*escala,r*escala);
  return { s: Number.isFinite(s) ? s/norma : 0, alvo };
}
function sinucaMiraPintar(g, j, b, dx, dy, R, P) {
  const { s: dist, alvo } = sinucaMiraAlvo(j.mesa.bolas, b, dx, dy, R, sinucaRaioBranca(j));
  const ini = R + 0.6, passo = 1.6;
  g.save();
  for (let k = ini; k < dist; k += passo) {
    const f = (k - ini) / Math.max(1, dist - ini);
    g.globalAlpha = 0.75 * (1 - f) ** 1.6 + 0.04;
    g.beginPath(); g.arc(sinucaPx(b[0] + dx * k), sinucaPy(b[1] + dy * k), P * 0.17, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
  }
  if (alvo !== null) {
    g.globalAlpha = 0.16; g.strokeStyle = "#fff"; g.lineWidth = 1.2 * SINUCA_TRACO;
    g.beginPath(); g.arc(sinucaPx(b[0] + dx * dist), sinucaPy(b[1] + dy * dist), R * P, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}
// A área onde a branca pode ir (a saída atrás da linha, ou o D), enquanto se põe.
function sinucaAreaPintar(g, area, P) {
  if (area !== "saida" && area !== "D") return;
  g.save();
  g.fillStyle = "#ffffff1c"; g.strokeStyle = "#ffffffa0"; g.lineWidth = 1.5 * SINUCA_TRACO; g.setLineDash([P * 0.6, P * 0.5]);
  g.beginPath();
  if (area === "saida") g.rect(sinucaPx(0), sinucaPy(0), SINUCA_LINHA * P, SINUCA_A * SINUCA_PY);
  else { g.moveTo(sinucaPx(SINUCA_LINHA), sinucaPy(SINUCA_A / 2 - SINUCA_D/SINUCA_METRICA_Y)); g.ellipse(sinucaPx(SINUCA_LINHA), sinucaPy(SINUCA_A / 2), SINUCA_D * P, SINUCA_D * P, 0, -Math.PI / 2, Math.PI / 2, true); g.closePath(); }
  g.fill(); g.stroke();
  g.restore();
}
// --- Animação das tacadas (a fila de s.anim) --------------------------------
// Cada tacada tem três tempos: o taco (puxa e bate; do outro, devagar, para dar
// para ver de onde e para onde ele mirou), as bolas andando (os quadros do
// servidor, a 30 por segundo) e a faixa com o que aconteceu.
const SINUCA_QPS = 30;
// Quem assiste vê o taco puxar (0,8 s) e a faixa (1,4 s); com tacadas na fila,
// os tempos encurtam para alcançar a mesa de verdade (Paulo, 28/10/2026: "tô
// assistindo a partida... tá bem ruim, travando").
function sinucaAnimTempos(t, j) {
  const fila = sinucaEstado().anim?.fila, atras = fila ? fila.length - 1 - fila.indexOf(t) : 0;
  const taco = t.falta === "tempo" ? 0 : t.lado === j.eu ? 180 : atras > 0 ? 350 : 800;
  const bolas = t.trilhas ? t.dur || 0 : (t.quadros?.length || 0) * (1000 / SINUCA_QPS);
  return { taco, bolas, faixa: t.lado === j.eu ? 1100 : atras > 0 ? 700 : 1400 };
}
// Onde está cada bola no instante `ms` da tacada, pelas trilhas exatas (os
// pontos de 30 por segundo e os das batidas): antes do primeiro ponto a bola
// está onde estava; depois do último, onde parou ou, com x = -1, sumiu.
function sinucaTrilhaCena(t, ms) {
  const bolas = [], caindo = [], z = {}, buracos = sinucaBuracos();
  for (let n = 0; n < 16; n++) {
    const x0 = t.inicio?.[2 * n] ?? -1, y0 = t.inicio?.[2 * n + 1] ?? -1, l = t.trilhas[n];
    if (!l) { bolas.push(x0 < 0 ? null : [x0 / 10, y0 / 10]); continue; }
    let i = 0;
    while (i + 4 < l.length && l[i + 4] <= ms) i += 4;
    if (ms < l[0]) { bolas.push([x0 / 10, y0 / 10]); continue; }
    if (l[i + 1] < 0) {
      // Sumiu: nos primeiros 230 ms escorrega para o buraco e diminui.
      bolas.push(null);
      const a = l.slice(Math.max(0, i - 4), i), p = Math.min(1, (ms - l[i]) / 230);
      if (a.length === 4 && p < 1) {
        const x = a[1] / 10, y = a[2] / 10, h = buracos.reduce((m, b) => (Math.hypot(b.x - x, b.y - y) < Math.hypot(m.x - x, m.y - y) ? b : m));
        caindo.push({ n, x: x + (h.x - x) * Math.min(1, p * 1.6), y: y + (h.y - y) * Math.min(1, p * 1.6), escala: 1 - 0.65 * p });
      }
      continue;
    }
    const b = i + 4 < l.length && l[i + 5] >= 0 ? l.slice(i + 4, i + 8) : null, k = b ? (ms - l[i]) / Math.max(1, b[0] - l[i]) : 0;
    const x = b ? l[i + 1] + (b[1] - l[i + 1]) * k : l[i + 1], y = b ? l[i + 2] + (b[2] - l[i + 2]) * k : l[i + 2], h = b ? l[i + 3] + (b[3] - l[i + 3]) * k : l[i + 3];
    bolas.push([x / 10, y / 10]);
    if (h > 0.5) z[n] = h / 10;
  }
  return { bolas, caindo, z };
}
function sinucaAnimDuracao(t, j) {
  const d = sinucaAnimTempos(t, j);
  return d.taco + d.bolas + d.faixa;
}
const sinucaQuadroBolas = (q) => Array.from({ length: 16 }, (_, n) => (q[2 * n] < 0 ? null : [q[2 * n] / 10, q[2 * n + 1] / 10]));
// Monta a cena da hora `agora`: as bolas, as que estão caindo, o taco e a faixa.
// Devolve null quando a fila acabou (a mesa volta para o estado de verdade).
function sinucaAnimQuadro(s, j, agora, R) {
  const a = s.anim;
  // Replay em câmera lenta: o relógio da animação anda mais devagar.
  if (a.lento) { a.t0 ||= agora; agora = a.t0 + (agora - a.t0) * a.lento; }
  let t = a.fila[a.k];
  a.inicio ||= agora;
  while (t && agora - a.inicio >= sinucaAnimDuracao(t, j)) { a.inicio += sinucaAnimDuracao(t, j); t = a.fila[++a.k]; a.som = undefined; }
  if (!t) { s.anim = null; setTimeout(() => { sinucaPintar(); if (escritorioMesa("snc").jogo?.id === j.id) desenharJogoMesa("snc"); }); return null; }
  if (!s.quadroPedido) { s.quadroPedido = true; requestAnimationFrame((tempo) => { s.quadroPedido = false; sinucaPintar(tempo); }); }
  const d = sinucaAnimTempos(t, j), e = agora - a.inicio, quadros = t.quadros?.length ? t.quadros : null;
  const quem = t.lado === j.eu ? "Você" : xadrezPrimeiroNome(j[t.lado]);
  if (t.trilhas && t.inicio) {
    const ini = sinucaQuadroBolas(t.inicio);
    if (e < d.taco) {
      const p = e / d.taco, recuo = p < 0.78 ? Math.sin((p / 0.78) * Math.PI / 2) : 1 - (p - 0.78) / 0.22;
      return { bolas: ini, taco: { b: ini[0], ang: t.angulo ?? 0, recuo: Math.max(0, recuo) * (0.15 + (t.forca ?? 0.5)), modelo: sinucaTacoModelo(j, t.lado), forca: t.forca ?? 0.5 }, mira: t.lado !== j.eu, faixa: t.lado === j.eu ? "" : `${quem} vai tacar` };
    }
    if (a.som === undefined) { a.som = 0; sinucaSom("taco", Math.max(.001,sinucaMetrosPorSegundo(t.forca??.5)/7)); }
    const ms = Math.min(t.dur || 0, e - d.taco);
    while (a.som < (t.eventos || []).length && (t.eventos[a.som].ms ?? Infinity) <= ms) {
      const ev = t.eventos[a.som++];
      if (ev.t === "bola") sinucaSom("bola", ev.f);
      else if (ev.t === "tabela") sinucaSom("tabela", ev.f);
      else if (ev.t === "caiu") sinucaSom("cacapa", Math.max(.15,ev.f));
    }
    const acabou = e >= d.taco + d.bolas;
    if (acabou && a.anunciado !== t.n) { a.anunciado = t.n; sinucaAnuncio(j, t); }
    const impacto = ms < 260 && t.falta !== "tempo" ? { b: ini[0], ang: t.angulo ?? 0, p: ms / 260, forca: t.forca, modelo: sinucaTacoModelo(j, t.lado) } : null;
    return { ...sinucaTrilhaCena(t, ms), impacto, faixa: acabou ? sinucaUltimoTexto(j, t) : t.lado === j.eu ? "" : `${quem} tacou`, ruim: acabou && Boolean(t.falta) };
  }
  if (!quadros) return { bolas: j.mesa.bolas, faixa: sinucaUltimoTexto(j, t), ruim: true };
  const ini = sinucaQuadroBolas(quadros[0]);
  if (e < d.taco) {
    // O taco recua devagar (até a força da tacada) e bate rápido.
    const p = e / d.taco, recuo = p < 0.78 ? Math.sin((p / 0.78) * Math.PI / 2) : 1 - (p - 0.78) / 0.22;
    return { bolas: ini, taco: { b: ini[0], ang: t.angulo ?? 0, recuo: Math.max(0, recuo) * (0.15 + (t.forca ?? 0.5)), modelo: sinucaTacoModelo(j, t.lado), forca: t.forca ?? 0.5 }, mira: t.lado !== j.eu, faixa: t.lado === j.eu ? "" : `${quem} vai tacar` };
  }
  if (a.som === undefined) { a.som = 0; sinucaSom("taco", Math.max(.001,sinucaMetrosPorSegundo(t.forca??.5)/7)); }
  const f = Math.min(quadros.length - 1, (e - d.taco) / (1000 / SINUCA_QPS)), i = Math.floor(f), k = f - i;
  const q = quadros[i], q2 = quadros[Math.min(quadros.length - 1, i + 1)];
  const bolas = Array.from({ length: 16 }, (_, n) => (q[2 * n] < 0 ? null : q2[2 * n] < 0 ? [q[2 * n] / 10, q[2 * n + 1] / 10]
    : [(q[2 * n] + (q2[2 * n] - q[2 * n]) * k) / 10, (q[2 * n + 1] + (q2[2 * n + 1] - q[2 * n + 1]) * k) / 10]));
  // Som dos eventos que já passaram: choque entre bolas, tabela, caçapa.
  while (a.som < (t.eventos || []).length && t.eventos[a.som].q <= i) {
    const ev = t.eventos[a.som++];
    if (ev.t === "bola") sinucaSom("bola", ev.f);
    else if (ev.t === "tabela") sinucaSom("tabela", ev.f);
    else if (ev.t === "caiu") sinucaSom("cacapa", Math.max(.15,ev.f));
  }
  // As que sumiram há pouco (até 7 quadros) aparecem escorregando para o buraco.
  const caindo = [], buracos = sinucaBuracos();
  for (let n = 0; n < 16; n++) {
    if (bolas[n]) continue;
    let fq = -1;
    for (let z = Math.min(i, quadros.length - 1); z >= Math.max(0, i - 7); z--) if (quadros[z][2 * n] >= 0) { fq = z; break; }
    if (fq < 0) continue;
    const x0 = quadros[fq][2 * n] / 10, y0 = quadros[fq][2 * n + 1] / 10, p = Math.min(1, (f - fq) / 7);
    const b = buracos.reduce((m, h) => (Math.hypot(h.x - x0, h.y - y0) < Math.hypot(m.x - x0, m.y - y0) ? h : m));
    caindo.push({ n, x: x0 + (b.x - x0) * Math.min(1, p * 1.6), y: y0 + (b.y - y0) * Math.min(1, p * 1.6), escala: 1 - 0.65 * p });
  }
  // Altura das bolas no ar neste quadro (as que pularam).
  const z = {}, ar = t.alturas?.[i];
  if (ar) for (let w = 0; w < ar.length; w += 2) z[ar[w]] = ar[w + 1] / 10;
  const acabou = e >= d.taco + d.bolas;
  if (acabou && a.anunciado !== t.n) { a.anunciado = t.n; sinucaAnuncio(j, t); }
  return { bolas, caindo, z, faixa: acabou ? sinucaUltimoTexto(j, t) : t.lado === j.eu ? "" : `${quem} tacou`, ruim: acabou && Boolean(t.falta) };
}
// O taco da tacada que está saindo, a mira do outro e a faixa de cima.
function sinucaCenaPintar(g, W, cena, R, P) {
  if (cena.taco) {
    const { b, ang, recuo } = cena.taco, dx = Math.cos(ang), dy = Math.sin(ang);
    // A mira do outro: um traço curto na direção do taco.
    if (cena.mira) sinucaMiraPintar(g, { mesa: { bolas: cena.bolas } }, b, dx, dy, R, P);
    sinucaTacoPintar(g, b, dx, dy, (R + 0.4 + 10 * recuo) * P, P, cena.taco.modelo, cena.taco.forca);
  }
  if (cena.impacto) sinucaImpactoPintar(g, cena.impacto.b, cena.impacto.ang, cena.impacto.p, cena.impacto.forca, SINUCA_TACOS[cena.impacto.modelo]?.brilho);
  const relato=document.querySelector('[data-snc-relato]');
  if(cena.faixa&&relato&&relato.textContent!==cena.faixa) relato.textContent=cena.faixa;

}
// Bola embaixo do taco (Paulo, 04/11/2026: o taco escondia o ás na saída): o
// contorno dela por cima do taco, para quem mira saber que ela está ali.
function sinucaSobTaco(g, bolas, branca, dx, dy, recuo, R) {
  const norma=Math.hypot(dx*SINUCA_PX,dy*SINUCA_PY),ux=dx*SINUCA_PX/norma,uy=dy*SINUCA_PY/norma;
  const ax=sinucaPx(branca[0])-ux*recuo,ay=sinucaPy(branca[1])-uy*recuo,r=R*SINUCA_PX;
  g.save();g.strokeStyle="#ffffffb0";g.lineWidth=1.4*SINUCA_TRACO;g.setLineDash([3*SINUCA_TRACO,2*SINUCA_TRACO]);
  bolas.forEach((p,n)=>{
    if(!p||n===0)return;
    const px=sinucaPx(p[0]),py=sinucaPy(p[1]),t=-((px-ax)*ux+(py-ay)*uy);
    if(t<0||t>48*SINUCA_PX)return;
    if(Math.abs((px-ax)*uy-(py-ay)*ux)<r+SINUCA_PX*0.4){g.beginPath();g.arc(px,py,r,0,Math.PI*2);g.stroke();}
  });
  g.restore();
}
// Os tacos da coleção (Paulo, 04/11/2026: "os tacos são bem feitos nos detalhes
// de entalhamento... cabos diferentes... e não um brilho branco rolando no
// taco"): a anatomia de um taco de verdade, sem luz animada. Da ponta ao cabo:
// sola de couro com giz, virola, haste de maple, junta, antebraço com as pontas
// incrustadas (cada ponta com os seus filetes), anéis, empunhadura (linho,
// couro ou lagarto), luva com incrustações e o pé. `brilho` é só a cor do anel
// do impacto na mesa.
const SINUCA_TACOS = {
  casa:   { nome: "Taco da Casa", requisito: "De todo mundo", brilho: null,
    haste: "#e6cf9c", hasteVeio: "#a77b45", estampa: { tipo: "fita" }, madeira: "#9a6a38", veio: "#6e4520", pontas: null, anel: ["#1a1714"], junta: "#1a1714",
    pega: { tipo: "liso", cor: "#2a1d14" }, luva: "#2a1d14", enfeite: null, pe: "#141210" },
  bronze: { nome: "Bronze", requisito: "Top 8 do ranking ou 5 vitórias", brilho: "#e0954a",
    haste: "#cf9455", hasteVeio: "#8a5426", faixas: ["#b0703a", "#111"], estampa: { tipo: "frisos", cor: "#7a3a14", nome: "BRONZE", letra: "#5a2a10" }, madeira: "#5a2a17", veio: "#3a170b", pontas: { cor: "#e8cf9c", filetes: ["#111", "#c97a3a", "#111"] },
    anel: ["#111", "#efe6d2"], junta: "#8c5a2e", pega: { tipo: "couro", cor: "#5b1d18", ponto: "#2a0c0a" }, luva: "#5a2a17",
    enfeite: { tipo: "diamante", cor: "#e8cf9c", borda: "#111" }, pe: "#120e0b" },
  prata:  { nome: "Prata", requisito: "Top 3 ou derrubar o Tio", brilho: "#cfe3ff",
    haste: "#2b2e35", carbono: "#3d424c", virola: "#f1ead8", faixas: ["#2b5fa8", "#f4f4f4"], estampa: { tipo: "corrida", cor: "#2b6fd0", cor2: "#f4f4f4", nome: "PRATA", letra: "#dfe4ea" }, madeira: "#17130f", veio: "#2c241c", pontas: { cor: "#efe2c4", filetes: ["#f4f4f4", "#2b5fa8", "#f4f4f4"] },
    anel: ["#2b5fa8", "#f4f4f4"], junta: "#a9aeb6", pega: { tipo: "linho", cor: "#4b4f57", ponto: "#22252a" }, luva: "#17130f",
    enfeite: { tipo: "oval", cor: "#c9ced6", borda: "#2b5fa8" }, pe: "#0e0c0a" },
  ouro:   { nome: "Ouro", requisito: "1º do ranking ou 25 vitórias", brilho: "#ffd36a",
    haste: "#e0b066", hasteVeio: "#9a6a24", faixas: ["#d9a640", "#111", "#d9a640"], estampa: { tipo: "arabesco", cor: "#8a5a10", nome: "OURO", letra: "#6a4208" }, madeira: "#7a3b1c", veio: "#4a1f0c", pontas: { cor: "#120e0b", filetes: ["#d9a640", "#111", "#efe6d2"] },
    anel: ["#d9a640", "#111"], junta: "#efe6d2", pega: { tipo: "lagarto", cor: "#15120f", ponto: "#3a3128" }, luva: "#7a3b1c",
    enfeite: { tipo: "diamante", cor: "#efe6d2", borda: "#d9a640", pingo: "#d9a640" }, pe: "#efe6d2" },
  lenda:  { nome: "Lenda", requisito: "Derrubar o Baianinho", brilho: "#ff8a1f",
    haste: "#141117", carbono: "#2a2430", virola: "#ff8a1f", faixas: ["#ff8a1f", "#111", "#d9a640"], estampa: { tipo: "chamas", cor: "#ff8a1f", cor2: "#ffd36a", nome: "LENDA", letra: "#ff8a1f" }, madeira: "#120b16", veio: "#24182a", entalhe: "#c8742a", pontas: { cor: "abalone", filetes: ["#ff8a1f", "#111", "#d9a640"] },
    anel: ["#ff8a1f", "#111", "#d9a640"], junta: "#120b16", pega: { tipo: "couro", cor: "#1c120c", ponto: "#ff8a1f" }, luva: "#120b16",
    enfeite: { tipo: "oval", cor: "abalone", borda: "#d9a640" }, pe: "#120b16" },
};
const SINUCA_TACO_POSICAO = (pos) => (pos === 1 ? "ouro" : pos <= 3 ? "prata" : pos <= 8 ? "bronze" : "casa");
function sinucaTacoModelo(j, lado) {
  const p = j?.[lado];
  if (!p) return "casa";
  if (j.bot && String(p.id) === "bot") return { facil: "casa", medio: "bronze", lendario: "lenda" }[j.bot.nivel || String(j.bot.id).split(":")[1]] || "casa";
  const ficha = sinucaFichas(j)?.[String(p.id)];
  if (ficha?.taco) return ficha.taco;
  const lista = (j.ranking || sinucaEstado().quadro?.ranking)?.lista || [];
  const r = lista.find((x) => x.id === String(p.id));
  return r?.vitorias ? SINUCA_TACO_POSICAO(r.posicao) : "casa";
}
// O taco visto de cima, em partes, da ponta (t = 0) ao cabo (t = 1): ponteira
// com giz, virola, haste de maple afinando, anel da junta, bico com as pontas
// incrustadas, empunhadura trançada, anel e sola de borracha. Cada parte tem
// volume (luz de cima, sombra embaixo) e o taco projeta sombra no pano.
function sinucaTacoPintar(g, branca, dx, dy, recuo, P, modelo = "casa", forca = 0) {
  const norma=Math.hypot(dx*SINUCA_PX,dy*SINUCA_PY);
  dx=dx*SINUCA_PX/norma;dy=dy*SINUCA_PY/norma;
  const cx = sinucaPx(branca[0]) - dx * recuo, cy = sinucaPy(branca[1]) - dy * recuo;
  g.save(); g.translate(cx, cy); g.rotate(Math.atan2(dy, dx) + Math.PI);
  sinucaTacoDesenhar(g, 48 * P, P, modelo, forca, true);
  g.restore();
}
// Sorteio fixo por taco (o veio é sempre o mesmo desenho).
const sinucaTacoSorte = (semente) => () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
// O desenho do taco, com a ponta na origem e o cabo para +x (mesa e perfil).
// `textura`: a volta inteira do taco num retângulo L × P (o 3D enrola no
// cilindro), sem a sombra e o volume pintados, que a luz da cena já dá.
function sinucaTacoDesenhar(g, L, P, modelo = "casa", forca = 0, sombra = true, textura = false) {
  const m = SINUCA_TACOS[modelo] || SINUCA_TACOS.casa, traco = typeof SINUCA_TRACO === "number" ? SINUCA_TRACO : 1;
  const larg = textura ? () => P : (t) => P * (0.36 + 0.62 * Math.min(1, t * 1.15));
  const contorno = (t0, t1) => { g.beginPath(); g.moveTo(t0 * L, -larg(t0) / 2); g.lineTo(t1 * L, -larg(t1) / 2); g.lineTo(t1 * L, larg(t1) / 2); g.lineTo(t0 * L, larg(t0) / 2); g.closePath(); };
  // Um enfeite no ângulo `a` da volta: no 3D vai na sua altura do retângulo; de
  // cima, só a metade de cima aparece, apertada para as bordas (a curva do taco).
  const volta = (t, a) => { const w = larg(t) / 2; if (textura) return { y: ((((a / (2 * Math.PI)) % 1) + 1) % 1 - 0.5) * 2 * w, k: 1 }; const c = Math.cos(a); return c <= 0.05 ? null : { y: Math.sin(a) * w, k: c }; };
  const abalone = (x0, x1) => { const gr = g.createLinearGradient(x0, -P / 2, x1, P / 2); gr.addColorStop(0, "#2e8f8a"); gr.addColorStop(0.3, "#6a4fa3"); gr.addColorStop(0.55, "#2f6fae"); gr.addColorStop(0.8, "#c87a3a"); gr.addColorStop(1, "#2e8f8a"); return gr; };
  const cor = (c, x0, x1) => (c === "abalone" ? abalone(x0, x1) : c);
  if (sombra && !textura) { g.save(); g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 7 * traco; g.shadowOffsetX = 2 * traco; g.shadowOffsetY = 6 * traco; contorno(0, 1); g.fillStyle = "#000"; g.fill(); g.restore(); }
  const volume = (t0, t1) => {
    if (textura) return;
    const w = larg((t0 + t1) / 2) / 2, v = g.createLinearGradient(0, -w, 0, w);
    v.addColorStop(0, "rgba(0,0,0,.45)"); v.addColorStop(0.24, "rgba(255,255,255,.16)"); v.addColorStop(0.4, "rgba(255,255,255,.03)"); v.addColorStop(0.75, "rgba(0,0,0,.14)"); v.addColorStop(1, "rgba(0,0,0,.58)");
    contorno(t0, t1); g.fillStyle = v; g.fill();
  };
  const recorte = (t0, t1, fn) => { g.save(); contorno(t0, t1); g.clip(); fn(); g.restore(); };
  const parte = (t0, t1, c) => { contorno(t0, t1); g.fillStyle = cor(c, t0 * L, t1 * L); g.fill(); };
  // Veio da madeira: linhas compridas que ondulam, sempre o mesmo por taco.
  const veio = (t0, t1, c, n, sem) => recorte(t0, t1, () => {
    const r = sinucaTacoSorte(sem); g.strokeStyle = c; g.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const y0 = (r() - 0.5) * P, amp = P * (0.04 + r() * 0.08), fase = r() * 6, onda = 2 + r() * 5;
      g.globalAlpha = 0.18 + r() * 0.3; g.lineWidth = Math.max(0.6, P * (0.012 + r() * 0.025)); g.beginPath();
      for (let k = 0; k <= 24; k++) { const t = t0 + (t1 - t0) * k / 24; g[k ? "lineTo" : "moveTo"](t * L, y0 + Math.sin(fase + onda * k / 24 * Math.PI) * amp); }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
  // Anel pontilhado (os quadradinhos da junta e do cabo), ou liso.
  const anel = (t0, t1, cores) => {
    parte(t0, t1, cores[0]);
    if (cores.length > 1) recorte(t0, t1, () => { const n = textura ? 24 : 9, w = larg(t1); for (let i = 0; i < n; i++) { g.fillStyle = cores[1 + (i % (cores.length - 1))]; const y = textura ? -w / 2 + (i + 0.5) * w / n : (Math.sin(-Math.PI / 2 + Math.PI * (i + 0.5) / n)) * w / 2; g.fillRect(t0 * L + (t1 - t0) * L * 0.2, y - w / n * 0.32, (t1 - t0) * L * 0.6, w / n * 0.64); } });
    volume(t0, t1);
  };
  // Pontas incrustadas: quatro triângulos em volta do antebraço, cada um com
  // os filetes por fora (as lâminas coloridas que o marceneiro cola uma a uma).
  const pontas = (t0, t1, p) => recorte(t0, t1, () => {
    for (const a of [1, 3, 5, 7].map((k) => k * Math.PI / 4)) {
      const v = volta(t1, a); if (!v) continue;
      const base = larg(t1) * (textura ? 0.16 : 0.2) * Math.max(0.6, v.k), xs = t0 * L + (t1 - t0) * L * 0.08, xe = t1 * L;
      const camadas = [...p.filetes, null];
      camadas.forEach((c, i) => {
        const enc = (camadas.length - 1 - i) * P * 0.03;
        g.beginPath(); g.moveTo(xs + enc * 3, v.y); g.lineTo(xe, v.y - base + enc); g.lineTo(xe, v.y + base - enc); g.closePath();
        g.fillStyle = c ? c : cor(p.cor, xs, xe); g.fill();
      });
      if (textura && Math.abs(v.y) > P / 2 - base) for (const d of [-P, P]) { g.beginPath(); g.moveTo(xs, v.y + d); g.lineTo(xe, v.y + d - base); g.lineTo(xe, v.y + d + base); g.closePath(); g.fillStyle = cor(p.cor, xs, xe); g.fill(); }
    }
  });
  // Entalhe (Lenda): arabescos cavados na madeira escura, com o fundo dourado.
  const entalhe = (t0, t1, c) => recorte(t0, t1, () => {
    g.strokeStyle = c; g.lineWidth = Math.max(0.7, P * 0.03); g.globalAlpha = 0.75; const n = 5, passo = (t1 - t0) * L / n;
    for (let i = 0; i < n; i++) for (const lado of [-1, 1]) {
      const x = t0 * L + passo * (i + 0.5), y = lado * P * 0.16;
      g.beginPath(); g.moveTo(x - passo * 0.45, y); g.bezierCurveTo(x - passo * 0.2, y - lado * P * 0.22, x + passo * 0.2, y + lado * P * 0.22, x + passo * 0.45, y); g.stroke();
      g.beginPath(); g.arc(x, y, P * 0.05, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
  });
  // Empunhadura: linho (fio cruzado fino), couro (liso com pesponto) ou lagarto (escamas).
  const pega = (t0, t1, p) => {
    parte(t0, t1, p.cor);
    recorte(t0, t1, () => {
      const w = larg(t1), x0 = t0 * L, x1 = t1 * L;
      if (p.tipo === "linho") { g.strokeStyle = p.ponto; g.globalAlpha = 0.7; g.lineWidth = Math.max(0.6, P * 0.02); for (let x = x0; x < x1; x += P * 0.07) { g.beginPath(); g.moveTo(x, -w / 2); g.lineTo(x + P * 0.06, w / 2); g.stroke(); } }
      if (p.tipo === "couro") { g.strokeStyle = p.ponto; g.globalAlpha = 0.85; g.lineWidth = Math.max(0.6, P * 0.025); g.setLineDash([P * 0.06, P * 0.05]); for (const y of textura ? [-w * 0.45, w * 0.05] : [-w * 0.38, w * 0.38]) { g.beginPath(); g.moveTo(x0 + P * 0.1, y); g.lineTo(x1 - P * 0.1, y); g.stroke(); } g.setLineDash([]); }
      if (p.tipo === "lagarto") { g.strokeStyle = p.ponto; g.globalAlpha = 0.8; g.lineWidth = Math.max(0.6, P * 0.02); const e = P * 0.12; for (let x = x0, k = 0; x < x1; x += e * 0.8, k++) for (let y = -w / 2 + (k % 2) * e / 2; y < w / 2; y += e) { g.beginPath(); g.ellipse(x, y, e * 0.42, e * 0.36, 0, 0, Math.PI * 2); g.stroke(); } }
      g.globalAlpha = 1;
    });
    volume(t0, t1);
  };
  // Incrustações da luva: diamantes ou ovais em volta, com borda e pingos.
  const enfeites = (t0, t1, e) => recorte(t0, t1, () => {
    const x = (t0 + t1) / 2 * L, comp = (t1 - t0) * L * 0.32;
    for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
      const v = volta((t0 + t1) / 2, a); if (!v) continue;
      const alt = larg(t1) * 0.16 * v.k;
      g.beginPath(); if (e.tipo === "diamante") { g.moveTo(x - comp, v.y); g.lineTo(x, v.y - alt); g.lineTo(x + comp, v.y); g.lineTo(x, v.y + alt); g.closePath(); } else g.ellipse(x, v.y, comp * 0.8, alt, 0, 0, Math.PI * 2);
      g.fillStyle = cor(e.cor, x - comp, x + comp); g.fill(); g.strokeStyle = e.borda; g.lineWidth = Math.max(0.7, P * 0.03); g.stroke();
      if (e.pingo) for (const d of [-1, 1]) { g.beginPath(); g.arc(x + d * comp * 1.45, v.y, Math.max(0.8, P * 0.035 * v.k), 0, Math.PI * 2); g.fillStyle = e.pingo; g.fill(); }
    }
  });
  // A marca de cada taco na haste: o que se reconhece de longe jogando
  // (Paulo, 04/11/2026: "pode trazer mais personalidade pro taco").
  // No 3D a volta inteira é o retângulo; as marcas se repetem dos dois lados.
  const lados = textura ? [-P / 4, P / 4] : [0];
  const nome = (txt, cor, t) => recorte(0.03, 0.5, () => {
    g.fillStyle = cor; g.font = `900 italic ${Math.max(6, P * (textura ? 0.22 : 0.42))}px sans-serif`; g.textBaseline = "middle"; g.globalAlpha = 0.9;
    for (const y of lados) g.fillText(txt, t * L, y);
    g.globalAlpha = 1;
  });
  const estampa = (e) => {
    if (e.tipo === "fita") recorte(0.03, 0.5, () => {             // taco da casa: fita isolante e giz
      g.fillStyle = "#151515";
      for (const [t, w] of [[0.3, 0.018], [0.44, 0.012]]) { g.beginPath(); g.moveTo(t * L, -P); g.lineTo((t + w) * L, -P); g.lineTo((t + w + 0.004) * L, P); g.lineTo((t + 0.004) * L, P); g.closePath(); g.fill(); }
      const r = sinucaTacoSorte(31); g.fillStyle = "rgba(60,120,200,.35)";
      for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse((0.035 + r() * 0.07) * L, (r() - 0.5) * P, P * (0.12 + r() * 0.2), P * 0.07, 0, 0, Math.PI * 2); g.fill(); }
    });
    if (e.tipo === "frisos") { recorte(0.03, 0.5, () => {           // bronze: frisos de cobre ao comprido
      g.strokeStyle = e.cor; g.lineWidth = Math.max(0.8, P * 0.05);
      for (const y of (textura ? [-P * 0.42, -P * 0.08, P * 0.08, P * 0.42] : [-P * 0.18, P * 0.18])) { g.beginPath(); g.moveTo(0.06 * L, y); g.lineTo(0.49 * L, y); g.stroke(); }
    }); nome(e.nome, e.letra, 0.36); }
    if (e.tipo === "corrida") { recorte(0.03, 0.5, () => {          // prata: faixa de corrida no carbono
      for (const y of lados) { g.fillStyle = e.cor; g.fillRect(0.05 * L, y - P * 0.13, 0.44 * L, P * 0.26); g.fillStyle = e.cor2; g.fillRect(0.05 * L, y - P * 0.02, 0.44 * L, P * 0.04); }
    }); nome(e.nome, e.letra, 0.12); }
    if (e.tipo === "arabesco") { recorte(0.03, 0.5, () => {         // ouro: ramos subindo da junta
      g.strokeStyle = e.cor; g.lineWidth = Math.max(0.8, P * 0.04); g.globalAlpha = 0.85;
      for (const y0 of lados) for (let i = 0; i < 6; i++) {
        const x = (0.48 - i * 0.055) * L, a = P * 0.28;
        g.beginPath(); g.moveTo(x, y0); g.bezierCurveTo(x - P * 0.6, y0 - a, x - P * 1.2, y0 + a, x - P * 1.8, y0); g.stroke();
        g.beginPath(); g.arc(x - P * 0.9, y0 - a * 0.6, P * 0.08, 0, Math.PI * 2); g.stroke();
      }
      g.globalAlpha = 1;
    }); nome(e.nome, e.letra, 0.1); }
    if (e.tipo === "chamas") { recorte(0.03, 0.5, () => {           // lenda: chamas subindo da junta
      for (const y0 of lados) for (let i = 0; i < 7; i++) {
        const base = 0.5 * L, ponta = (0.5 - 0.12 - ((i * 37) % 9) * 0.012) * L, y = y0 + (i - 3) * P * (textura ? 0.035 : 0.07), w = P * 0.16;
        const gr = g.createLinearGradient(base, 0, ponta, 0); gr.addColorStop(0, e.cor); gr.addColorStop(0.6, e.cor2); gr.addColorStop(1, "rgba(255,211,106,0)");
        g.fillStyle = gr; g.beginPath(); g.moveTo(base, y - w); g.quadraticCurveTo((base + ponta) / 2, y - w * 2.2, ponta, y); g.quadraticCurveTo((base + ponta) / 2, y + w * 0.6, base, y + w); g.closePath(); g.fill();
      }
    }); nome(e.nome, e.letra, 0.1); }
  };
  // Ponta de couro com giz azul e virola de marfim.
  parte(0, 0.012, "#2f6fb8"); recorte(0, 0.012, () => { g.fillStyle = "rgba(190,225,255,.5)"; const r = sinucaTacoSorte(7); for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(r() * 0.012 * L, (r() - 0.5) * P * 0.5, P * 0.03, 0, Math.PI * 2); g.fill(); } }); volume(0, 0.012);
  parte(0.012, 0.03, m.virola || "#f1ead8"); volume(0.012, 0.03);
  // A haste é o que se vê jogando (a câmera fica atrás do taco), então cada taco
  // tem a sua (Paulo, 04/11/2026: "todos têm a sensação de estar com o mesmo
  // taco"): maple natural, maple tingido ou carbono, com os anéis da cor do taco.
  parte(0.03, 0.5, m.haste);
  if (m.carbono) recorte(0.03, 0.5, () => {                    // trama do carbono
    g.strokeStyle = m.carbono; g.globalAlpha = 0.55; g.lineWidth = Math.max(0.6, P * 0.025);
    for (let x = 0.03 * L; x < 0.5 * L; x += P * 0.09) { g.beginPath(); g.moveTo(x, -P); g.lineTo(x + P * 0.5, P); g.stroke(); g.beginPath(); g.moveTo(x + P * 0.5, -P); g.lineTo(x, P); g.stroke(); }
    g.globalAlpha = 1;
  });
  else veio(0.03, 0.5, m.hasteVeio || "#a77b45", 7, 11);
  if (m.estampa) estampa(m.estampa);
  if (m.faixas) for (const t of [0.045, 0.2, 0.35, 0.47]) anel(t, t + 0.006, m.faixas);
  volume(0.03, 0.5);
  // Junta: colar, o pino (risco escuro) e o anel.
  anel(0.5, 0.507, m.anel); parte(0.507, 0.526, m.junta); recorte(0.507, 0.526, () => { g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0.5155 * L, -P, Math.max(1, 0.001 * L), 2 * P); }); volume(0.507, 0.526); anel(0.526, 0.533, m.anel);
  // Antebraço: a madeira nobre com veio, as pontas e (no Lenda) o entalhe.
  parte(0.533, 0.76, m.madeira); veio(0.533, 0.76, m.veio, 9, modelo.length * 97 + 3);
  if (m.entalhe) entalhe(0.56, 0.68, m.entalhe);
  if (m.pontas) pontas(0.533, 0.76, m.pontas);
  volume(0.533, 0.76);
  anel(0.76, 0.768, m.anel);
  pega(0.768, 0.9, m.pega);
  anel(0.9, 0.908, m.anel);
  // Luva do cabo e o pé.
  parte(0.908, 0.982, m.luva); veio(0.908, 0.982, m.veio, 5, modelo.length * 31 + 5);
  if (m.enfeite) enfeites(0.908, 0.982, m.enfeite);
  volume(0.908, 0.982);
  parte(0.982, 0.994, m.pe); volume(0.982, 0.994);
  parte(0.994, 1, "#0b0b0b"); volume(0.994, 1);
  void forca;
}
// Clarão da tacada: o anel que abre na branca e o pó do giz voando (Paulo,
// 04/11/2026: "uns efeitos visual foda").
function sinucaImpactoPintar(g, b, ang, p, forca, cor) {
  const x = sinucaPx(b[0]), y = sinucaPy(b[1]), P = SINUCA_PX, f = Math.max(0.2, forca || 0.5);
  g.save(); g.globalCompositeOperation = "lighter";
  g.globalAlpha = (1 - p) * 0.8 * f; g.strokeStyle = cor || "#e8f4ff"; g.lineWidth = P * 0.25 * (1 - p) + 1;
  g.beginPath(); g.arc(x, y, P * (1.2 + 3.5 * p * f), 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#9fd0ff";
  for (let i = 0; i < 9; i++) {
    const a = ang + Math.PI + (i - 4) * 0.28 + Math.sin(i * 7.3) * 0.15, d = P * (1.2 + (2 + (i % 3)) * p * f * 1.6);
    g.globalAlpha = (1 - p) * 0.7; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, P * 0.09 * (1 - p * 0.5), 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
// O taco desenhado num canvas pequeno (perfil, coleção): pinta todos os
// <canvas data-snc-taco="modelo"> que estiverem na tela.
function sinucaTacosVitrine(raiz = document) {
  for (const c of raiz.querySelectorAll?.("canvas[data-snc-taco]") || []) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = c.clientWidth || 220, h = c.clientHeight || 26;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext("2d"); g.scale(dpr, dpr); g.translate(6, h / 2);
    sinucaTacoDesenhar(g, w - 12, h * 0.62, c.dataset.sncTaco, 0, false);
  }
}

// --- Mesa em 3D (vybe-escritorio-sinuca-3d.mjs, empacotado pelo build) -------
// Uma cena só para a sessão: o canvas 3D é criado uma vez e acompanha a .snc-area
// a cada redesenho (o WebGL não é recriado). O canvas 2D fica por cima,
// transparente, recebendo os toques; na câmera de cima (ortográfica, o mesmo
// enquadramento da arte) o clique na mesa vale igual ao 2D. Sem WebGL, ou com
// "2D" escolhido, fica a mesa de antes.
const SINUCA_3D_URL = "/assets/jogos/sinuca-3d.js";
const SINUCA_3D = { api: null, canvas: null, carregando: false, falhou: false };
// Só 3D atrás do taco (Paulo, 04/11/2026: "vamos ficar só com essa versão, não
// precisa da de cima nem 2D"). A de cima só aparece com bola na mão, para pôr a
// branca; sem WebGL fica a mesa 2D.
function sinuca3dAtivo() { return Boolean(SINUCA_3D.api); }
async function sinuca3dIniciar() {
  if (SINUCA_3D.api || SINUCA_3D.carregando || SINUCA_3D.falhou || typeof document === "undefined") return;
  const teste = document.createElement("canvas");
  if (!(teste.getContext("webgl2") || teste.getContext("webgl"))) { SINUCA_3D.falhou = true; return; }
  SINUCA_3D.carregando = true;
  try {
    const { criarCena3d } = await import(SINUCA_3D_URL);
    const j = sinucaEstado().jogo, c = document.createElement("canvas");
    c.className = "snc-canvas snc-3d"; c.setAttribute("aria-hidden", "true");
    SINUCA_3D.canvas = c;
    SINUCA_3D.api = criarCena3d(c, { mesa: ESCRITORIO_SINUCA_MESA, raio: sinucaRaio(j), raioBranca: sinucaRaioBranca(j), visual: (n) => sinucaVisual(j?.mesa?.modo || "parimpar", n), tacoDesenhar: sinucaTacoDesenhar });
    SINUCA_3D.api.modo = "taco";
    desenharJogoMesa("snc");
  } catch (e) { SINUCA_3D.falhou = true; console.warn("Sinuca 3D indisponível, fica a mesa 2D.", e); }
  finally { SINUCA_3D.carregando = false; }
}
// O mesmo quadro que a mesa 2D pinta, entregue à cena 3D.
function sinucaPintar3d(agora) {
  const s = sinucaEstado(), j = s.jogo, R = sinucaRaio(j), api = SINUCA_3D.api;
  const area = document.querySelector(".ofc-snc-jogo .snc-area");
  if (!area || !j) return;
  if (SINUCA_3D.canvas.parentNode !== area) { area.prepend(SINUCA_3D.canvas); area.classList.add("com-3d"); }
  const modo = j.mesa?.modo || "parimpar";
  if (SINUCA_3D.modo !== modo) { SINUCA_3D.modo = modo; api.trocarVisual((n) => sinucaVisual(modo, n)); }
  let bolas = j.mesa.bolas, cena = null;
  if (s.anim) { cena = sinucaAnimQuadro(s, j, agora || performance.now(), R); if (cena) bolas = cena.bolas; }
  const d = { bolas, z: cena?.z || {}, caindo: cena?.caindo || [], tacos: [], mira: null, fantasma: null, suave: true,
    animando: Boolean(s.anim && cena && !cena.taco), forcarCima: sinucaPondo(j, s) };
  if (s.anim) {
    if (cena?.taco) { const t = cena.taco, tac = s.anim?.fila?.[s.anim.k]; d.tacos.push({ b: t.b, ang: t.ang, recuo: 0.4 + 10 * t.recuo, elev: tac?.elevacao || 0, modelo: t.modelo, efeito: tac?.efeito || 0, giro: tac?.giro || 0 }); d.camera = { b: t.b, ang: t.ang }; d.forca = t.forca * 0.6; }
    if (cena?.impacto) d.impacto = cena.impacto;
    const relato = document.querySelector("[data-snc-relato]");
    if (cena?.faixa && relato && relato.textContent !== cena.faixa) relato.textContent = cena.faixa;
    return api.desenhar(d);
  }
  const branca = sinucaMinhaVez(j) ? sinucaBranca(j, s) : null;
  if (sinucaPondo(j, s) && s.fantasma) d.fantasma = [s.fantasma.x, s.fantasma.y];
  if (branca && s.branca) { d.bolas = bolas.slice(); d.bolas[0] = branca; }
  const mo = s.miraOutro, viva = mo && mo.n === (j.mesa?.n ?? 0) && performance.now() - mo.em < 4000;
  if (viva && !sinucaMinhaVez(j)) {
    const alvo = sinucaMiraAlvo(j.mesa.bolas, mo.b, Math.cos(mo.ang), Math.sin(mo.ang), R, sinucaRaioBranca(j));
    d.mira = { b: mo.b, ang: mo.ang, dist: alvo.s, alvo: alvo.alvo !== null };
    d.tacos.push({ b: mo.b, ang: mo.ang, recuo: 0.5 + 10 * mo.forca, elev: 0, modelo: sinucaTacoModelo(j, j.vez) });
    d.camera = { b: mo.b, ang: mo.ang };
    clearTimeout(s.miraApaga); s.miraApaga = setTimeout(() => sinucaPintar(), 4100);
  }
  if (branca) {
    sinucaMandarMira(j, s, s.angulo ?? 0, s.forcaAgora ?? 0, branca);
    const ang = s.angulo ?? 0, alvo = sinucaMiraAlvo(j.mesa.bolas, branca, Math.cos(ang), Math.sin(ang), R, sinucaRaioBranca(j));
    d.mira = { b: branca, ang, dist: alvo.s, alvo: alvo.alvo !== null };
    const minima = sinucaElevacaoMinima(j, branca, ang);
    d.tacos.push({ b: branca, ang, recuo: 0.5 + 10 * (s.forcaAgora ?? 0), elev: Math.max(s.elevacao || 0, minima), modelo: sinucaTacoModelo(j, j.eu), efeito: s.efeito || 0, giro: s.giro || 0 });
    sinucaAvisoLevantado(minima > (s.elevacao || 0) ? minima : 0);
    d.forca = s.forcaAgora ?? 0;
    d.camera = { b: branca, ang };
  } else if (!d.camera && j.mesa.bolas[0]) d.camera = { b: j.mesa.bolas[0], ang: s.angulo ?? 0 };
  api.desenhar(d);
}
// Mesa 3D, como nos jogos de sinuca (Paulo, 04/11/2026: "tá estranho girar o
// taco e tacar... não consigo arrastar pra escolher a força"): arrastar para os
// lados gira a mira; arrastar para baixo puxa o taco para trás (o quanto puxa é
// a força, de 0 até ~45% da altura da mesa) e soltar taca. A direção do gesto
// decide nos primeiros 8 px; puxar quase nada e soltar desiste.
function sinucaPonteiro3d(ev, tipo) {
  const s = sinucaEstado(), j = s.jogo;
  if (tipo === "down") sinucaAnimVencida(s, j);
  if (s.anim && tipo === "clique") return sinucaPular(s, j);
  if (!sinucaMinhaVez(j) || s.anim || s.enviando) return;
  if (tipo === "down") {
    if (ev.button !== undefined && ev.button !== 0) return;
    s.gira3d = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, modo: null, n: j.n, jogoId: j.id, lado: j.eu, max: 0 };
    try { ev.currentTarget.setPointerCapture?.(ev.pointerId); } catch { /* ponteiro que já saiu */ }
    return;
  }
  const g = s.gira3d;
  if (!g || g.id !== ev.pointerId) return;
  const dx = ev.clientX - g.x0, dy = ev.clientY - g.y0, altura = ev.currentTarget.getBoundingClientRect().height || 400;
  if (!g.modo && Math.hypot(dx, dy) > 8) g.modo = !sinucaTravadoAtivo() && dy > Math.abs(dx) ? "puxar" : "girar";
  if (tipo === "move") {
    if (g.modo === "girar") { s.angulo = (s.angulo ?? 0) + (ev.clientX - g.x) * Math.PI / 1200; s.travada = true; }
    if (g.modo === "puxar") {
      // Como no taco de verdade (Paulo, 04/11/2026: "deixa eu puxar e voltar o
      // taco, só não bate"; no vídeo do Deivid ele bombeia o taco sem soltar e
      // nunca volta até o começo): o EMPURRÃO RÁPIDO para a frente bate, com a
      // força da última puxada; voltar devagar só ajusta a força.
      const v = Math.max(0, Math.min(1, dy / (altura * 0.45))), agora = performance.now();
      g.max = Math.max(g.max, v);
      (g.hist ||= []).push([agora, v]);
      while (g.hist.length && agora - g.hist[0][0] > 400) g.hist.shift();
      const [tPico, pico] = g.hist.reduce((m, h) => (h[1] >= m[1] ? h : m), [agora, 0]);
      const golpe = pico >= 0.03 && v < pico && agora - tPico <= 220 && pico - v >= Math.max(0.12, pico * 0.35);
      if (golpe || (g.max >= 0.03 && v < g.max * 0.3)) { const f = golpe ? pico : g.max; s.gira3d = null; s.forcaAgora = f; return sinucaPonteiro3dSolta(s, j, g, f); }
      g.v = v;
      sinucaForcaMostrar(v, true);
    }
    g.x = ev.clientX; sinucaPintar(); return;
  }
  if (tipo === "up" || tipo === "cancel") {
    // Soltou parado: a força daquele ponto; soltou já de volta perto do começo: a da puxada.
    const forca = g.modo === "puxar" ? ((g.v ?? 0) >= 0.05 ? g.v : g.max) : s.forcaAgora;
    s.gira3d = null;
    if (g.modo === "puxar" && tipo === "up") return sinucaPonteiro3dSolta(s, j, g, forca);
    s.forcaAgora = null; sinucaForcaAtualizar(s.forca ?? 0.4); sinucaPintar();
  }
}
function sinucaPonteiro3dSolta(s, j, g, forca) {
  if (!(forca >= Math.max(SINUCA_FORCA_MIN, 0.01))) return sinucaNaoTacou(s, "Puxe o taco para trás para dar força.");
  if (j.n !== g.n || j.id !== g.jogoId) return sinucaNaoTacou(s, "A mesa mudou: mire de novo.");
  s.forca = forca; s.forcaAgora = null; sinucaForcaAtualizar(forca);
  return tacarSinuca({ jogoId: g.jogoId, n: g.n, lado: g.lado, angulo: s.angulo ?? 0, forca });
}
// Setas do teclado ajustam a mira enquanto a sinuca está aberta: meio grau, e
// com Shift cinco centésimos.
document.addEventListener?.("keydown", (ev) => {
  if (!document.querySelector("#workflow-modal.ofc-snc-jogo") || ev.target?.closest?.("input,textarea,.snc-forca,.snc-efeito-bola")) return;
  if (sinucaTravadoAtivo() && (ev.key === " " || ev.code === "Space")) {
    if (ev.target?.closest?.("button,select,[contenteditable]") || ev.repeat) return;
    ev.preventDefault(); return tacarSinuca();
  }
  if (sinucaTravadoAtivo() && (ev.key === "ArrowUp" || ev.key === "ArrowDown")) {
    const s = sinucaEstado();
    if (!sinucaMinhaVez(s.jogo) || s.anim) return;
    ev.preventDefault();
    s.forca = Math.max(SINUCA_FORCA_MIN, Math.min(1, (s.forca ?? 0.4) + (ev.key === "ArrowUp" ? 1 : -1) * (ev.shiftKey ? 0.001 : 0.01)));
    return sinucaForcaMostrar(s.forca);
  }
  if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
  const s = sinucaEstado();
  if (!sinucaMinhaVez(s.jogo) || s.anim) return;
  ev.preventDefault();
  s.angulo = (s.angulo ?? 0) + (ev.key === "ArrowLeft" ? -1 : 1) * (ev.shiftKey ? Math.PI / 3600 : Math.PI / 360);
  sinucaPintar();
});

// Perder a captura/aba cancela a carga; nunca deixa um arrasto pendurado.
if(typeof window!=='undefined')window.addEventListener('blur',()=>{if(sinucaEstado().gesto)sinucaGestoCancelar();});
document.addEventListener?.('visibilitychange',()=>{if(document.hidden&&sinucaEstado().gesto)sinucaGestoCancelar();});
