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
const ESCRITORIO_SINUCA = /pooltable/;
const SINUCA_CFG = registrarMesaEscritorio({
  nome: "Sinuca", artigo: "a sinuca", extra: { jogo: "sinuca" }, sinal: "snc",
  // A tacada já toca os sons dela na animação.
  som: () => null,
  salaUI: desenharLobbySinuca, novoUI: desenharNovoSinuca, conviteUI: desenharConviteSinuca,
  nota: "Par ou ímpar, regra de bar: a mesa começa aberta e quem encaçapar primeiro fica com o grupo da bola que matou: par (as lisas) ou ímpar (as listradas). Limpe as suas e mate o ás (a 1, colado na cabeceira) para ganhar. Suicida, cegar ou bater primeiro na bola do outro tira uma bola do outro da mesa; na suicida o outro põe a branca no D.", desenhar: (j, s) => desenharSinuca(j, s),
  // Pinta a mesa logo depois de a tela ser montada, na mesma volta: com um
  // setTimeout o navegador mostrava o canvas novo vazio por um quadro, e quem
  // assistia via a mesa piscar a cada tacada (Paulo, 28/10/2026).
  depois: () => { sinucaPintar(); sinucaAudioPreparar?.(); },
});
// A imagem conserva sua proporção. O pano é mapeado por eixo; as bolas
// continuam redondas, com raio na escala horizontal da mesa (54 mm nas novas).
const SINUCA_L=100,SINUCA_A=50,SINUCA_METRICA_Y=ESCRITORIO_SINUCA_MESA.metricaY;
const SINUCA_ARTE=ESCRITORIO_SINUCA_MESA.arte,SINUCA_PANO=SINUCA_ARTE.pano;
const SINUCA_W=SINUCA_ARTE.largura/2,SINUCA_H=SINUCA_ARTE.altura/2;
const SINUCA_PX=SINUCA_PANO.largura/200,SINUCA_PY=SINUCA_PANO.altura/100;
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
function sinucaVisual(modo, n) {
  if (modo === "parimpar") return { cor: n ? SINUCA_PARIMPAR[n] : SINUCA_CORES[0], listra: n % 2 === 1 && n !== 1 };
  return { cor: SINUCA_CORES[n > 8 ? n - 8 : n], listra: n > 8 };
}
const SINUCA_DICA = { livre: "Sua vez: clique no pano para mirar. Escolha a força e use TACAR, ou puxe para trás e solte.",
  travada: "Direção confirmada. Clique em outro ponto para mudar. Na barra, clique escolhe a força; arrastar e soltar taca." };
// Quanto puxar o mouse (em unidades da mesa) para a força toda: 40, para a
// força baixa (onde fica quase toda tacada) ter curso.
const SINUCA_PUXADA = 40;
// A velocidade que sai de cada força, a mesma conta do servidor (velocidadeDaForca).
const sinucaMetrosPorSegundo=ESCRITORIO_SINUCA_MESA.velocidade;
const SINUCA_FORCA_MIN=ESCRITORIO_SINUCA_MESA.forcaMinima;
const sinucaPercentual=(f)=>Number((f*100).toFixed(1)).toLocaleString("pt-BR");
const sinucaRaio = (j) => j?.mesa?.r || 1.15;
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
function sinucaPrender(area, x, y, R) {
  x = Math.min(SINUCA_L - R, Math.max(R, x)); y = Math.min(SINUCA_A - R/SINUCA_METRICA_Y, Math.max(R/SINUCA_METRICA_Y, y));
  if (area === "saida" || area === "D") x = Math.min(x, SINUCA_LINHA);
  if (area === "D") {
    const dx = x - SINUCA_LINHA, dy = y - SINUCA_A / 2, d = Math.hypot(dx, dy*SINUCA_METRICA_Y);
    if (d > SINUCA_D) { x = SINUCA_LINHA + dx * SINUCA_D / d; y = SINUCA_A / 2 + dy * SINUCA_D / d; }
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
  const falta = (bar ? { branca: "suicida", "branca-fora": "suicida (a branca pulou da mesa)", nenhuma: "cegou (não tocou em nenhuma bola)", errada: u.primeiro === 1 ? "bateu primeiro no ás" : "bateu primeiro na bola do outro" } : {})[u.falta]
    || { branca: "a branca caiu", "branca-fora": "a branca pulou para fora da mesa", fora: "bola pulou para fora da mesa (voltou para a marca)", nenhuma: "não tocou em nenhuma bola", errada: "tocou primeiro a bola errada" }[u.falta];
  const grupo = u.grupo ? ` e ficou com ${{ pares: "o par (as lisas)", impares: "o ímpar (as listradas)" }[u.grupo] || `as ${SINUCA_NOME_GRUPO[u.grupo].toLowerCase()}`}` : "";
  const dono = u.lado === "desafiante" ? "desafiado" : "desafiante", deQuem = dono === j.eu ? "sua" : `de ${xadrezPrimeiroNome(j[dono])}`;
  const multa = u.tirou ? `; sai a ${u.tirou} (${deQuem})` : "", volta = u.voltou?.length ? `; a ${u.voltou.join(", ")} voltou para a mesa` : "";
  return `${quem} tacou${caiu.length ? ` e encaçapou ${caiu.length > 1 ? "as bolas" : "a"} ${caiu.join(", ")}` : " e não encaçapou nada"}${grupo}${falta ? `: falta, ${falta}${multa}${volta}` : ""}.`;
}
// Jogador no placar de cima: cabeça, nome, de quem é a vez e as bolas do grupo
// (as que já caíram ficam apagadas).
function sinucaJogadorHtml(j, lado, q) {
  const p = j[lado], u = j.bot && String(p?.id) === "bot" ? sinucaRetrato(j.bot.nivel || String(j.bot.id).split(":")[1]) : mesaCabecaUrl(j, p), vez = j.estado === "jogando" && j.vez === lado, eu = j.eu === lado, g = j.mesa.grupos[lado];
  // No ranking geral da sinuca: a posição e as vitórias e derrotas.
  const rk = q?.ranking?.lista?.find((r) => r.id === String(p?.id));
  const ficha = rk ? `<em class="snc-ficha" title="${rk.posicao}º no ranking da sinuca">${rk.posicao}º · ${rk.vitorias}V ${rk.derrotas}D</em>` : "";
  // Com as 15 bolas, a 1 vem no fim da fila: é a bola final de cada um.
  const nums = g ? [...SINUCA_GRUPOS[g], ...(j.mesa.bola1 ? [1] : j.mesa.modo === "parimpar" ? [] : [8])] : [];
  const bolas = nums.length ? nums.map((n) => { const v = sinucaVisual(j.mesa.modo, n); return `<i class="${j.mesa.bolas[n] ? "" : "caiu"}${v.listra ? " listra" : ""}${n === sinucaFinal(j) ? " final" : ""}" style="--c:${v.cor}" title="Bola ${n}">${n}</i>`; }).join("")
    : `<small>${j.mesa.modo === "parimpar" ? "Par ou ímpar a definir" : "Grupo a definir"}</small>`;
  return `<div class="snc-jogador${vez ? " vez" : ""}${lado === "desafiado" ? " direita" : ""}">${u ? `<img class="${j.bot && String(p?.id)==='bot'?'snc-bot-retrato':''}" src="${safeText(u)}" alt="" width="40" height="40">` : `<i class="snc-sem" aria-hidden="true">${safeText(String(p?.nome||"?")[0])}</i>`}
${vez ? mesaPrazoVezHtml(j) : ""}<div><b>${xadrezPrimeiroNome(p)}${eu ? " (você)" : ""}${ficha}</b><span class="snc-grupo" aria-label="${g ? `${SINUCA_NOME_GRUPO[g]}, faltam ${j.mesa.restam[g]}` : "Mesa aberta"}">${g ? `<small>${SINUCA_NOME_GRUPO[g]}</small>` : ""}${bolas}</span></div></div>`;
}
// O confronto no meio do placar: quantas cada um ganhou do outro, em giz.
function sinucaConfrontoHtml(j, q) {
  const p = q?.placar || j.placar, a = String(j.desafiante?.id), b = String(j.desafiado?.id);
  if (!p || j.bot) return '<span class="snc-x" aria-hidden="true">×</span>';
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
    if (novas.length) { if (s.anim) s.anim.fila.push(...novas); else s.anim = { fila: novas, k: 0, inicio: 0 }; }
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
  const status = passando ? `${xadrezPrimeiroNome(j[passando.lado])} está jogando` : !minha ? (j.estado==='jogando' ? statusLongo : '') : poe ? 'Bola na mão · escolha onde colocar a branca' : m.bolaNaMao ? (m.bolaNaMao==='D'?'Bola na mão · branca dentro do D':'Saída · branca atrás da linha') : s.travada ? 'Sua vez · mira travada' : 'Sua vez · mire e dose a tacada';
  const efeito = s.efeito || 0, giro = s.giro || 0, ativo = minha && !poe;
  const forca = `<div class="snc-forca${ativo ? '' : ' parada'}" role="slider" tabindex="${ativo ? 0 : -1}" aria-orientation="horizontal" aria-label="Força da tacada: clique seleciona; arraste e solte para tacar" aria-valuemin="0.1" aria-valuemax="100" aria-valuenow="${Number(((s.forca??0.4)*100).toFixed(1))}" onpointerdown="sinucaForcaComeca(event)" onpointermove="sinucaForcaMove(event)" onpointerup="sinucaForcaSolta(event)" onpointercancel="sinucaGestoCancelar(event)" onlostpointercapture="sinucaGestoCancelar(event)" onkeydown="sinucaForcaTecla(event)"><b style="width:${(s.forca??0.4)*100}%"></b><span>${sinucaPercentual(s.forca??0.4)}%</span></div>`;
  const controles = `<section class="snc-comandos" aria-label="Controles da tacada">
<div class="snc-controle snc-controle-mira"><div class="snc-controle-titulo"><small>01</small><b>Mira e efeito</b></div><div class="snc-ajustes"><button type="button" class="snc-efeito-bola" onclick="sinucaEfeito(event)" ${ativo?'':'disabled'} aria-label="Efeito: ${sinucaEfeitoNome(efeito,giro)}"><i style="top:${50-efeito*34}%;left:${50+giro*34}%"></i></button><div class="snc-mira-fina" role="group" aria-label="Ajuste fino da mira"><button type="button" onclick="sinucaGirar(-1)" ${ativo?'':'disabled'} aria-label="Mira um pouco para um lado">↶</button><button type="button" onclick="sinucaGirar(1)" ${ativo?'':'disabled'} aria-label="Mira um pouco para o outro lado">↷</button></div><label class="snc-taco"><small>Inclinação <b>${s.elevacao||0}°</b></small><input type="range" min="0" max="60" step="5" value="${s.elevacao||0}" oninput="sinucaElevacao(this)" ${ativo?'':'disabled'} aria-label="Inclinação do taco"></label></div></div>
<div class="snc-controle snc-controle-forca"><div class="snc-controle-titulo"><small>02</small><b>Força da tacada</b><label class="snc-forca-exata"><input type="number" min="0.1" max="100" step="0.1" value="${Number(((s.forca??0.4)*100).toFixed(1))}" oninput="sinucaForcaEscolher(this)" ${ativo?'':'disabled'} aria-label="Força da tacada em porcentagem"><span>%</span></label></div>${forca}<div class="snc-escala"><span>Toque de leve</span><span>Arraste e solte</span><span>Saída forte</span></div></div>
<div class="snc-controle snc-controle-tacar"><button type="button" class="snc-tacar" onclick="tacarSinuca()" ${ativo?'':'disabled'}>TACAR <span>↗</span></button>${m.bolaNaMao&&s.branca&&minha?'<button type="button" class="snc-mudar" onclick="sinucaEstado().branca=null;desenharJogoMesa(\'snc\')">Reposicionar branca</button>':'<small>Mire. Dose. Encaçape.</small>'}</div></section>`;
  const ultimo = sinucaUltimoTexto(j);
  // O histórico e o ranking vêm na leitura da mesa (verMesa); a resposta da
  // tacada não traz, então a lousa usa o último que chegou desta partida.
  if (j.ranking) s.quadro = { id: j.id, placar: j.placar, historico: j.historico, sequencia: j.sequencia, ranking: j.ranking };
  const q = j.ranking ? j : s.quadro?.id === j.id ? s.quadro : null;
  // Pinta logo que o canvas entra na tela (rAF não roda com a aba escondida).
  setTimeout(() => sinucaPintar());
  return {
    status,
    mesa: `<div class="snc-placar">${sinucaJogadorHtml(j, "desafiante", q)}${sinucaConfrontoHtml(j, q)}${sinucaJogadorHtml(j, "desafiado", q)}</div>
<div class="snc-area"><canvas id="snc-canvas" class="snc-canvas${minha ? " vez" : ""}${s.travada ? " travada" : ""}${poe ? " pondo" : ""}" width="${SINUCA_W}" height="${SINUCA_H}" role="img" aria-label="Mesa de sinuca"
 onpointercancel="sinucaGestoCancelar(event)" onlostpointercapture="sinucaGestoCancelar(event)" onpointermove="sinucaPonteiro(event,'move')" onpointerdown="sinucaPonteiro(event,'down')" onpointerup="sinucaPonteiro(event,'up')" onclick="sinucaPonteiro(event,'clique')"></canvas></div>${controles}`,
    painel: sinucaPainelHtml(j, s, q, ultimo),
  };
}

// Ponteiro na mesa. Clique escolhe a mira; dedo arrastado ajusta a direção.
// Bola na mão: o toque põe a branca. Hover nunca muda a mira confirmada.
// Um gesto pertence a um único ponteiro e a uma única vez da partida.
// A mira só muda por ação deliberada: o caminho até a barra não a altera.
const SINUCA_GESTO_MIN_PX = 4;
function sinucaGestoNovo(s, ev, tipo) {
  return { tipo, pointerId:ev.pointerId, jogoId:s.jogo.id, n:s.jogo.n, lado:s.jogo.eu,
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
  if(s.anim&&s.anim.inicio&&performance.now()-s.anim.inicio>sinucaAnimDuracao(s.anim.fila[s.anim.k]||{},j)+1500){s.anim=null;sinucaPintar();}
  if(s.anim&&tipo==='clique')return sinucaPular(s,j);
  if(!sinucaMinhaVez(j)||s.anim||s.enviando)return;
  if(tipo==='down'&&ev.button!==undefined&&ev.button!==0)return;
  if(s.gesto&&!sinucaGestoValido(s,s.gesto))return sinucaGestoCancelar();
  if(s.gesto&&ev.pointerId!==s.gesto.pointerId)return;
  const R=sinucaRaio(j),rect=c.getBoundingClientRect();
  const [x,y]=sinucaCoordenadas((ev.clientX-rect.left)/rect.width*SINUCA_W,(ev.clientY-rect.top)/rect.height*SINUCA_H);
  if(sinucaPondo(j,s)){
    const [px,py]=sinucaPrender(j.mesa.bolaNaMao,x,y,R);
    const livre=j.mesa.bolas.every((b,n)=>!b||n===0||Math.hypot(b[0]-px,(b[1]-py)*SINUCA_METRICA_Y)>=2*R+0.1);
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
    if(Math.hypot(x-branca[0],y-branca[1])>0.5)s.angulo=Math.atan2(y-branca[1],x-branca[0]);
    s.travada=true;s.gesto=sinucaGestoNovo(s,ev,ev.pointerType==='mouse'?'mesa':'toque');
    s.puxada=s.gesto;c.setPointerCapture?.(ev.pointerId);c.classList.add('travada');sinucaPintar();return;
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
    else{sinucaForcaAtualizar(s.forca??0.4);sinucaPintar();}
  }
}
// Taco inclinado (0 a 60 graus): a física faz a bola pular e, com efeito
// lateral, fazer a curva.
function sinucaElevacao(el) {
  const s = sinucaEstado();
  if(s.gesto||s.enviando)return;
  s.elevacao = Number(el.value) || 0;
  const r = el.closest(".snc-taco")?.querySelector("small");
  if (r) r.innerHTML = `Inclinação <b>${s.elevacao}°</b>`;
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
// Efeito: o ponto da bolinha onde o taco bate. Em cima segue, embaixo puxa,
// dos lados a branca abre para aquele lado na tabela (no centro, nenhum).
function sinucaEfeitoNome(e, g) {
  const v = e > 0 ? "seguir" : e < 0 ? "puxar" : "", h = g > 0 ? "abrir para a direita" : g < 0 ? "abrir para a esquerda" : "";
  return [v, h].filter(Boolean).join(" e ") || "no centro";
}
function sinucaEfeito(ev) {
  const s = sinucaEstado(), el = ev.currentTarget, r = el.getBoundingClientRect();
  if(s.gesto||s.enviando||s.anim||!sinucaMinhaVez(s.jogo))return;
  let vy = -((ev.clientY - r.top) / r.height - 0.5) / 0.34, vx = ((ev.clientX - r.left) / r.width - 0.5) / 0.34;
  const d = Math.hypot(vx, vy);
  if (d > 1) { vx /= d; vy /= d; }
  s.efeito = Math.abs(vy) < 0.2 ? 0 : Math.round(vy * 10) / 10;
  s.giro = Math.abs(vx) < 0.2 ? 0 : Math.round(vx * 10) / 10;
  const i = el.querySelector("i");
  i.style.top = `${50 - s.efeito * 34}%`; i.style.left = `${50 + s.giro * 34}%`;
  el.setAttribute("aria-label", `Efeito: ${sinucaEfeitoNome(s.efeito, s.giro)}`);
}

// Barra de força ao lado da mesa: arrasta-se para a direita; a distância
// percorrida é a força e soltar taca. Soltar em cima (menos de 0,1%) desiste.
function sinucaForcaDe(ev) {
  const r = ev.currentTarget.getBoundingClientRect();
  return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
}
function sinucaForcaAtualizar(v, naMesa) {
  const el=document.querySelector('.snc-forca');
  if(el){el.querySelector('b').style.width=`${Number((v*100).toFixed(1))}%`;el.querySelector('span').textContent=v<SINUCA_FORCA_MIN?(naMesa?'Puxe para trás':'Solte: cancela'):`${sinucaPercentual(v)}%`;el.setAttribute('aria-valuenow',String(Number((v*100).toFixed(1))));}
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
  s.forca=v;sinucaForcaAtualizar(v);
  // Clique escolhe a força. Só um arrasto deliberado dispara ao soltar.
  if(dist>SINUCA_GESTO_MIN_PX)tacarSinuca({...g,forca:v});else sinucaPintar();
}
function sinucaForcaCancela(){sinucaGestoCancelar();}
// Teclado na barra: setas mudam a força, Enter ou espaço taca.
function sinucaForcaTecla(ev) {
  const s = sinucaEstado();
  if(!sinucaMinhaVez(s.jogo)||s.anim||s.enviando||s.gesto)return;
  if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(ev.key)) {
    ev.preventDefault();
    s.forca = Math.max(SINUCA_FORCA_MIN, Math.min(1, (s.forca ?? 0.4) + (["ArrowDown", "ArrowRight"].includes(ev.key) ? 1 : -1)*(ev.shiftKey ? 0.001 : 0.01)));
    sinucaForcaMostrar(s.forca);
  } else if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); tacarSinuca(); }
}
function tacarSinuca(gesto) {
  const s = sinucaEstado(), j = s.jogo;
  if (!sinucaMinhaVez(j) || s.anim || s.enviando || (s.gesto&&!gesto)) return;
  if(gesto&&(gesto.jogoId!==j.id||gesto.n!==j.n||gesto.lado!==j.eu))return;
  const angulo=gesto?.angulo??s.angulo??0,forca=gesto?.forca??s.forca??0.4;
  const pedido = { tipo: "tacar", angulo: Math.round(angulo * 10000) / 10000, forca: Math.max(SINUCA_FORCA_MIN, Math.min(1, Math.round(forca * 1000) / 1000)), efeito: s.efeito || 0, lado: s.giro || 0, elevacao: s.elevacao || 0 };
  if (j.mesa.bolaNaMao || !j.mesa.bolas[0]) pedido.branca = s.branca;
  lanceMesaEscritorio("snc", pedido);
}

const sinucaPx=(v)=>SINUCA_PANO.x/2+v*SINUCA_PX;
const sinucaPy=(v)=>SINUCA_PANO.y/2+v*SINUCA_PY;
const sinucaCoordenadas=(x,y)=>[(x-SINUCA_PANO.x/2)/SINUCA_PX,(y-SINUCA_PANO.y/2)/SINUCA_PY];
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
    sinucaTacoPintar(g, mo.b, dx, dy, (R + 0.5 + 10 * mo.forca) * P, P);
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
  sinucaTacoPintar(g, branca, dx, dy, (R + 0.5 + 10 * (s.forcaAgora ?? 0)) * P, P);
}
// Mira (Paulo, 28/10/2026: "tão reclamando que tá muito difícil mirar... coloca
// a listrinha pontilhada do bolão branco até a bola que vai bater, mas a linha
// meio que vai sumindo pra não ficar tão fácil"): pontos da branca até onde ela
// encosta na primeira bola (ou na tabela), cada vez mais apagados; no fim, o
// contorno quase sumido de onde a branca encosta. Sem a volta das bolas.
function sinucaMiraAlvo(bolas, b, dx, dy, R) {
  const escala=SINUCA_METRICA_Y,norma=Math.hypot(dx,dy*escala);
  b=[b[0],b[1]*escala];bolas=bolas.map(p=>p?[p[0],p[1]*escala]:null);dx/=norma;dy=dy*escala/norma;
  let s = Infinity, alvo = null;
  bolas.forEach((p, n) => {
    if (!p || n === 0) return;
    const ox = p[0] - b[0], oy = p[1] - b[1], t = ox * dx + oy * dy, d2 = ox * ox + oy * oy - t * t, r2 = 4 * R * R;
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
    if(Math.abs(vn)>1e-9)for(const lado of [-R,R]){
      const k=(lado-((b[0]-x1)*nx+(b[1]-y1)*ny))/vn;
      const t=((b[0]+dx*k-x1)*ex+(b[1]+dy*k-y1)*ey)/(len*len);
      if(k>0&&t>=0&&t<=1&&k<s){s=k;alvo=null;}
    }
    circulo(x1,y1,R);circulo(x2,y2,R);
  }
  for(const [x,y,r] of ESCRITORIO_SINUCA_MESA.buracos)circulo(x,y*escala,r*escala);
  return { s: Number.isFinite(s) ? s/norma : 0, alvo };
}
function sinucaMiraPintar(g, j, b, dx, dy, R, P) {
  const { s: dist, alvo } = sinucaMiraAlvo(j.mesa.bolas, b, dx, dy, R);
  const ini = R + 0.6, passo = 1.6;
  g.save();
  for (let k = ini; k < dist; k += passo) {
    const f = (k - ini) / Math.max(1, dist - ini);
    g.globalAlpha = 0.75 * (1 - f) ** 1.6 + 0.04;
    g.beginPath(); g.arc(sinucaPx(b[0] + dx * k), sinucaPy(b[1] + dy * k), P * 0.17, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
  }
  if (alvo !== null) {
    g.globalAlpha = 0.16; g.strokeStyle = "#fff"; g.lineWidth = 1.2;
    g.beginPath(); g.arc(sinucaPx(b[0] + dx * dist), sinucaPy(b[1] + dy * dist), R * P, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}
// A área onde a branca pode ir (a saída atrás da linha, ou o D), enquanto se põe.
function sinucaAreaPintar(g, area, P) {
  if (area !== "saida" && area !== "D") return;
  g.save();
  g.fillStyle = "#ffffff1c"; g.strokeStyle = "#ffffffa0"; g.lineWidth = 1.5; g.setLineDash([P * 0.6, P * 0.5]);
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
      return { bolas: ini, taco: { b: ini[0], ang: t.angulo ?? 0, recuo: Math.max(0, recuo) * (0.15 + (t.forca ?? 0.5)) }, mira: t.lado !== j.eu, faixa: t.lado === j.eu ? "" : `${quem} vai tacar` };
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
    return { ...sinucaTrilhaCena(t, ms), faixa: acabou ? sinucaUltimoTexto(j, t) : t.lado === j.eu ? "" : `${quem} tacou`, ruim: acabou && Boolean(t.falta) };
  }
  if (!quadros) return { bolas: j.mesa.bolas, faixa: sinucaUltimoTexto(j, t), ruim: true };
  const ini = sinucaQuadroBolas(quadros[0]);
  if (e < d.taco) {
    // O taco recua devagar (até a força da tacada) e bate rápido.
    const p = e / d.taco, recuo = p < 0.78 ? Math.sin((p / 0.78) * Math.PI / 2) : 1 - (p - 0.78) / 0.22;
    return { bolas: ini, taco: { b: ini[0], ang: t.angulo ?? 0, recuo: Math.max(0, recuo) * (0.15 + (t.forca ?? 0.5)) }, mira: t.lado !== j.eu, faixa: t.lado === j.eu ? "" : `${quem} vai tacar` };
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
  return { bolas, caindo, z, faixa: acabou ? sinucaUltimoTexto(j, t) : t.lado === j.eu ? "" : `${quem} tacou`, ruim: acabou && Boolean(t.falta) };
}
// O taco da tacada que está saindo, a mira do outro e a faixa de cima.
function sinucaCenaPintar(g, W, cena, R, P) {
  if (cena.taco) {
    const { b, ang, recuo } = cena.taco, dx = Math.cos(ang), dy = Math.sin(ang);
    // A mira do outro: um traço curto na direção do taco.
    if (cena.mira) sinucaMiraPintar(g, { mesa: { bolas: cena.bolas } }, b, dx, dy, R, P);
    sinucaTacoPintar(g, b, dx, dy, (R + 0.4 + 10 * recuo) * P, P);
  }
  const relato=document.querySelector('[data-snc-relato]');
  if(cena.faixa&&relato&&relato.textContent!==cena.faixa) relato.textContent=cena.faixa;

}
// Taco: ponteira, anel e madeira escurecendo até o cabo.
function sinucaTacoPintar(g, branca, dx, dy, recuo, P) {
  const norma=Math.hypot(dx*SINUCA_PX,dy*SINUCA_PY);
  dx=dx*SINUCA_PX/norma;dy=dy*SINUCA_PY/norma;
  const cx = sinucaPx(branca[0]) - dx * recuo, cy = sinucaPy(branca[1]) - dy * recuo, ex = cx - dx * 48 * P, ey = cy - dy * 48 * P;
  const taco = g.createLinearGradient(cx, cy, ex, ey);
  taco.addColorStop(0, "#5ab0ff"); taco.addColorStop(0.012, "#f4efe2"); taco.addColorStop(0.03, "#f4efe2"); taco.addColorStop(0.035, "#1b1b1b");
  taco.addColorStop(0.045, "#e8cd96"); taco.addColorStop(0.62, "#c08a4a"); taco.addColorStop(0.64, "#2a1a0c"); taco.addColorStop(1, "#160d05");
  g.save();
  g.strokeStyle = "#00000040"; g.lineWidth = P * 0.95; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx + 3, cy + 5); g.lineTo(ex + 3, ey + 5); g.stroke();
  g.strokeStyle = taco; g.lineWidth = P * 0.8;
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
  g.restore();
}
// Setas do teclado ajustam a mira enquanto a sinuca está aberta: meio grau, e
// com Shift cinco centésimos.
document.addEventListener?.("keydown", (ev) => {
  if (!document.querySelector("#workflow-modal.ofc-snc-jogo") || ev.target?.closest?.("input,textarea,.snc-forca")) return;
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
