// Ficha do herói e barra do dia. Tudo vem das demandas do Painel
// (DADOS_DEMANDAS): o que a pessoa entrega, não quanto tempo fica online.
// Números de desempenho são da própria pessoa e de quem administra; os
// outros veem só o personagem, onde está e o botão de recado.
function escritorioIdNasDemandas(pessoa) {
  if (!pessoa) return "";
  const pelaLista = typeof pessoaPeloNome === "function" ? pessoaPeloNome(pessoa.nome || "") : null;
  return String(pelaLista?.id || pessoa.id || "");
}
function escritorioDemandasDe(pessoa) {
  if (typeof DADOS_DEMANDAS === "undefined" || !Array.isArray(DADOS_DEMANDAS)) return null;
  const id = escritorioIdNasDemandas(pessoa);
  if (!id) return [];
  return DADOS_DEMANDAS.filter((d) => (d.responsavel_ids?.length ? d.responsavel_ids : [d.responsavel_id]).filter(Boolean).map(String).includes(id));
}
const escritorioConcluida = (d) => typeof DEMANDA_CONCLUIDA !== "undefined" && DEMANDA_CONCLUIDA.includes(d.status);
function escritorioHojeIso() {
  return (typeof META !== "undefined" && META.today_iso) || new Date().toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
}
// Dia útil anterior (pula sábado e domingo), em AAAA-MM-DD sem fuso.
function escritorioDiaUtilAntes(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  do t.setUTCDate(t.getUTCDate() - 1); while ([0, 6].includes(t.getUTCDay()));
  return t.toISOString().slice(0, 10);
}
function escritorioNumerosDe(pessoa) {
  const lista = escritorioDemandasDe(pessoa);
  if (!lista) return null;
  const hoje = escritorioHojeIso(), mes = hoje.slice(0, 7);
  const feitas = lista.filter((d) => escritorioConcluida(d) && d.conclusao_iso);
  const doMes = feitas.filter((d) => d.conclusao_iso.startsWith(mes));
  const comPrazo = doMes.filter((d) => d.prazo_iso);
  const emDia = comPrazo.filter((d) => d.conclusao_iso <= d.prazo_iso).length;
  const abertas = lista.filter((d) => !escritorioConcluida(d));
  const atrasadas = abertas.filter((d) => d.prazo_iso && d.prazo_iso < hoje).length;
  const clientes = new Set(doMes.flatMap((d) => d.clientes?.length ? d.clientes : [d.cliente]).filter((c) => c && c !== "—"));
  // Sequência: dias úteis seguidos com pelo menos uma entrega (hoje conta se já houve).
  const dias = new Set(feitas.map((d) => d.conclusao_iso));
  let seq = 0, dia = dias.has(hoje) ? hoje : escritorioDiaUtilAntes(hoje);
  while (dias.has(dia) && seq < 400) { seq++; dia = escritorioDiaUtilAntes(dia); }
  // Dia de hoje: o que vence hoje mais o que foi entregue hoje.
  const doDia = lista.filter((d) => (!escritorioConcluida(d) && d.prazo_iso === hoje) || (escritorioConcluida(d) && d.conclusao_iso === hoje));
  const feitasHoje = doDia.filter(escritorioConcluida).length;
  const total = feitas.length;
  // Nível: cada nível pede um pouco mais de entregas que o anterior.
  let nivel = 1, base = 0, passo = 5;
  while (total >= base + passo) { base += passo; nivel++; passo = 5 + nivel * 3; }
  return {
    total, mes: doMes.length, emDia: comPrazo.length ? Math.round((emDia / comPrazo.length) * 100) : null,
    abertas: abertas.length, atrasadas, clientes: clientes.size, seq,
    dia: { feitas: feitasHoje, total: doDia.length }, nivel, xp: total - base, xpProximo: passo,
  };
}
// Marcos calculados no servidor (server/escritorio-marcos.js): cada um diz se
// foi conquistado, quando, e o móvel que dá. Nome do móvel pelo catálogo do editor.
function escritorioMarcosHtml(marcos) {
  if (!marcos?.length) return "";
  const data = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Bahia" }); };
  const nomeMovel = (classe) => { const m = (typeof escritorioCatalogo !== "undefined" && escritorioCatalogo || []).find((x) => x.classe === classe); return m ? escritorioNomeMovel(m) : classe.replace(/_/g, " "); };
  const feitos = marcos.filter((m) => m.ok).length;
  return `<h4>Marcos <small>(${feitos} de ${marcos.length} · cada um dá 50 moedas e 50 XP)</small></h4><ul class="ofc-marcos">${marcos.map((m) => `<li class="${m.ok ? "ok" : ""}" title="${safeText(m.dica)}"><i aria-hidden="true">${m.ok ? "★" : "☆"}</i><span><b>${safeText(m.nome)}</b><small>${m.ok ? "Conquistado" + (m.em ? " em " + data(m.em) : "") : safeText(m.dica)}${m.moveis?.length ? ` · ${m.ok ? "ganhou" : "dá"} ${m.moveis.map((c) => safeText(nomeMovel(c))).join(", ")}` : ""}</small></span></li>`).join("")}</ul>`;
}
// Barra do dia, em cima da barra de baixo: só a da própria pessoa.
function atualizarBarraDiaEscritorio() {
  const principal = document.querySelector(".ofc-principal");
  if (!principal || !escritorio.base) return;
  let el = document.getElementById("office-dia");
  const eu = escritorio.base.equipe.find((p) => String(p.id) === String(escritorio.base.eu));
  const n = escritorioNumerosDe(eu);
  if (!n || !n.dia.total) { el?.remove(); return; }
  if (!el) {
    el = document.createElement("button");
    el.type = "button";
    el.id = "office-dia";
    el.className = "ofc-dia";
    el.onclick = () => abrirFichaEscritorio(escritorio.base.eu);
    principal.append(el);
  }
  const pct = Math.round((n.dia.feitas / n.dia.total) * 100);
  el.innerHTML = `<span class="ofc-dia-texto"><b>Hoje</b> ${n.dia.feitas} de ${n.dia.total} ${n.dia.total === 1 ? "entrega" : "entregas"}${n.atrasadas ? ` · <em>${n.atrasadas} ${n.atrasadas === 1 ? "atrasada" : "atrasadas"}</em>` : ""}</span><span class="ofc-dia-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Entregas de hoje"><i style="width:${pct}%"></i></span><span class="ofc-dia-pct">${pct}%</span>`;
  el.title = "Abrir sua ficha";
}
// Nível, meta da semana e extrato vêm do servidor (XP nunca cai; a meta é a
// média da própria pessoa nas últimas semanas). Só a própria pessoa recebe
// esses dados; quem administra vê os números das demandas como antes.
function escritorioNivelHtml(p) {
  const m = p.meta || {}, pct = Math.round((p.xp / p.xpProximo) * 100);
  const pctMeta = m.meta ? Math.min(100, Math.round(((m.entregas || 0) / m.meta) * 100)) : 0;
  const funcao = { criacao: "Criação", atendimento: "Atendimento", agendamento: "Agendamento", producao: "Produção", gestao: "Gestão" }[p.funcao] || "";
  const data = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Bahia" }); };
  const sinal = (v) => (v > 0 ? "+" + v : String(v));
  return `<div class="ofc-ficha-nivel"><b>Nível ${p.nivel}${funcao ? ` · ${funcao}` : ""}</b><span class="ofc-dia-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${p.xpProximo}" aria-valuenow="${p.xp}" aria-label="Progresso até o próximo nível"><i style="width:${pct}%"></i></span><small>${p.xp} de ${p.xpProximo} XP para o nível ${p.nivel + 1} · ${p.xpTotal} XP no total. XP nunca cai.</small></div>
<div class="ofc-ficha-meta"><b>Meta da semana</b><span class="ofc-dia-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${m.meta || 1}" aria-valuenow="${m.entregas || 0}" aria-label="Meta da semana"><i style="width:${pctMeta}%"></i></span><small>${m.entregas || 0} de ${m.meta || 1} ${m.meta === 1 ? "entrega" : "entregas"}${m.semanas ? ` · sua média nas últimas ${m.semanas} ${m.semanas === 1 ? "semana" : "semanas"}: ${m.media}` : " · primeira semana com meta"}. Quem bate a própria meta ganha o bônus da semana.</small></div>
${p.extrato?.length ? `<h4>Últimos pontos</h4><ul class="ofc-extrato">${p.extrato.map((l) => `<li><span>${safeText(l.descricao)}</span><small>${data(l.criado_em)}</small><b class="${Number(l.moedas) < 0 ? "perda" : ""}">${sinal(Number(l.moedas))} <i>moedas</i> · +${Number(l.pontos)} <i>XP</i></b></li>`).join("")}</ul>` : ""}`;
}
function abrirFichaEscritorio(id, semAtualizar = false) {
  const b = escritorio.base;
  const pessoa = b?.equipe.find((p) => String(p.id) === String(id));
  if (!pessoa) return;
  const eu = String(id) === String(b.eu);
  const veNumeros = eu || b.admin;
  const online = (escritorio.online || []).find((o) => String(o.id) === String(id));
  const perfil = eu ? escritorio.perfil : pessoa.perfil || {};
  let d = document.getElementById("office-ficha");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "office-ficha";
    d.className = "ofc-ficha";
    d.setAttribute("aria-labelledby", "office-ficha-nome");
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    document.body.append(d);
  }
  const n = veNumeros ? escritorioNumerosDe(pessoa) : null;
  // Economia da pessoa: a própria vem na entrada; a de outra pessoa (quem
  // administra) é buscada ao abrir e guardada para a próxima abertura.
  const economia = eu ? escritorio.base?.economia : escritorio.fichas?.[String(id)];
  const pontos = eu ? economia?.pontos || null : null;
  const marcos = veNumeros ? economia?.marcos || null : null;
  const img = "https://www.habbo.com/habbo-imaging/avatarimage?" + new URLSearchParams({ figure: mapaFigura(perfil), direction: "3", head_direction: "3", size: "l", gesture: "sml" });
  const lugar = online ? escritorioLugarDe(online).nome : "Fora do escritório";
  const [status, cor] = ESCRITORIO_STATUS[online?.status || "ausente"] || ESCRITORIO_STATUS.ausente;
  const numero = (rotulo, valor, dica = "") => `<div title="${safeText(dica)}"><dt>${rotulo}</dt><dd>${valor}</dd></div>`;
  const nivel = pontos ? escritorioNivelHtml(pontos) : n ? `<div class="ofc-ficha-nivel"><b>Nível ${n.nivel}</b><span class="ofc-dia-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${n.xpProximo}" aria-valuenow="${n.xp}" aria-label="Progresso até o próximo nível"><i style="width:${Math.round((n.xp / n.xpProximo) * 100)}%"></i></span><small>${n.xp} de ${n.xpProximo} entregas para o nível ${n.nivel + 1}</small></div>` : "";
  const corpo = !veNumeros
    ? `<p class="ofc-nota">Os números e marcos de cada pessoa ficam na ficha dela e com quem administra.</p>`
    : !n
      ? `${nivel}<p class="ofc-nota">Carregando as demandas do Painel…</p>`
      : `${nivel}
<dl class="ofc-ficha-numeros">${numero("Hoje", `${n.dia.feitas}/${n.dia.total}`, "Entregas de hoje / o que vence hoje")}${numero("No mês", n.mes, "Demandas concluídas neste mês")}${numero("No prazo", n.emDia === null ? "–" : n.emDia + "%", "Entregas do mês concluídas até o prazo")}${numero("Sequência", n.seq + (n.seq === 1 ? " dia" : " dias"), "Dias úteis seguidos com pelo menos uma entrega")}${numero("Clientes", n.clientes, "Clientes diferentes atendidos no mês")}${numero("Na fila", n.abertas + (n.atrasadas ? ` <em>· ${n.atrasadas} atrasada${n.atrasadas > 1 ? "s" : ""}</em>` : ""), "Demandas abertas agora")}</dl>
${marcos ? escritorioMarcosHtml(marcos) : b.demo || escritorio.fichas?.[String(id)] === null ? "" : '<p class="ofc-nota">Carregando os marcos…</p>'}
<p class="ofc-nota">Contado pelas demandas do Painel em que ${eu ? "você é" : "a pessoa é"} responsável (${n.total} concluídas no total).</p>`;
  d.innerHTML = `<div class="ofc-ficha-topo"><img src="${img}" alt="" width="64" height="110" referrerpolicy="no-referrer"><div><h3 id="office-ficha-nome">${safeText(pessoa.nome)}</h3><small><i class="ofc-ponto" style="--st:${cor}"></i>${safeText(status)} · ${safeText(lugar)}</small></div><button type="button" class="ofc-x" onclick="this.closest('dialog').close()" aria-label="Fechar">×</button></div>
${corpo}
<div class="ofc-ficha-acoes">${eu ? `<button type="button" class="ofc-secundario" onclick="document.getElementById('office-ficha').close();personalizarEscritorio()">Personalizar aparência</button>${escritorioMinhaMesa() ? `<button type="button" class="ofc-secundario" onclick="document.getElementById('office-ficha').close();abrirEstiloSalaEscritorio()">Piso e paredes da sala</button>` : ""}` : `<button type="button" class="ofc-secundario" onclick="document.getElementById('office-ficha').close();abrirRecadosEscritorio('${safeText(String(id))}')">Deixar recado</button>${online ? `<button type="button" class="ofc-secundario" onclick="document.getElementById('office-ficha').close();escritorioIrAte('${safeText(String(id))}')">Ir até</button>` : ""}<button type="button" class="ofc-secundario" onclick="document.getElementById('office-ficha').close();abrirPresenteEscritorio('${safeText(String(id))}')">Dar um móvel de presente</button>`}</div>`;
  if (!d.open) d.showModal();
  // Pontos e marcos mudam com o trabalho do dia: a ficha busca o estado atual
  // ao abrir (a própria pessoa; ou outra, para quem administra).
  if (veNumeros && !semAtualizar && !b.demo && typeof escritorioApi === "function")
    escritorioApi("economia", null, eu ? null : { pessoa: String(id) }).then((r) => {
      if (!r?.economia) return;
      if (eu) escritorio.base.economia = { ...r.economia, loja: r.economia.loja || escritorio.base.economia?.loja };
      else (escritorio.fichas ||= {})[String(id)] = r.economia;
      if (d.open) abrirFichaEscritorio(id, true);
    }).catch(() => { if (!eu) (escritorio.fichas ||= {})[String(id)] = null; if (d.open) abrirFichaEscritorio(id, true); });
  // Nomes dos móveis dos marcos vêm do catálogo do editor; carrega na primeira vez.
  if (marcos?.some((m) => m.moveis?.length) && typeof escritorioCatalogo !== "undefined" && !escritorioCatalogo && typeof carregarCatalogoEscritorio === "function")
    carregarCatalogoEscritorio().then(() => { if (d.open) abrirFichaEscritorio(id, true); });
}
// Piso e paredes da própria sala: guardados no perfil do dono (o servidor só
// aceita os valores desta lista).
const ESCRITORIO_PISOS_SALA = [
  ["", "Padrão da sala"], ["madeira", "Madeira escura"], ["clara", "Madeira clara"], ["concreto", "Concreto"],
  ["carpete", "Carpete azul"], ["preto", "Preto"], ["cafe", "Porcelanato"], ["verde", "Verde"], ["deck", "Deck"],
  ["lareira", "Tijolo"], ["cinema", "Azul-noite"], ["pista", "Roxo"],
  ["marmore", "Mármore"], ["gramado", "Grama"], ["nogueira", "Nogueira"], ["vinho", "Vinho"],
];
const ESCRITORIO_PAREDES_SALA = ["", "#ff8a35", "#ffb347", "#ffd166", "#ff6fa8", "#e05a5a", "#b48cff", "#7c6cff", "#5aa9ff", "#5ad1e6", "#7ee08a", "#3fb68b", "#e8e8ee", "#8a8f9c"];
// Piso e paredes da própria sala, como pintura: escolhe a ferramenta e o
// material e clica (ou arrasta) nos ladrilhos e nos trechos de parede.
const ESCRITORIO_ESTILOS_PAREDE = [["a", "Padrão"], ["b", "Lisa"], ["c", "Tijolo"], ["d", "Madeira"], ["e", "Concreto"], ["f", "Vidro"], ["g", "Listrada"], ["h", "Azulejo"]];
function escritorioPincel() {
  return escritorio.pincel ||= { ferramenta: "piso", piso: "preto", estilo: "c", cor: "", altura: "2" };
}
function escritorioEstiloSalaHtml() {
  const mesa = escritorioMinhaMesa();
  if (!mesa) return '<p class="ofc-nota">Você ainda não tem sala no escritório.</p>';
  const a = mesa.ambiente, pin = escritorioPincel();
  const piso = (id) => { const c = ESCRITORIO_PLANTA.PISO[id || a.pisoPadrao]; return c ? `repeating-conic-gradient(${c[0]} 0 25%,${c[1]} 0 50%) 0 0/16px 16px` : "#333"; };
  const amostraParede = (e) => ({ a: `linear-gradient(${a.corPadrao} 0 12%,#2b2d36 12%)`, b: pin.cor || a.corPadrao, c: "repeating-linear-gradient(#8a4733 0 7px,#3b1f17 7px 8px)", d: "repeating-linear-gradient(90deg,#7a5235 0 9px,#4a2f1c 9px 10px)", e: "#6e7077", f: "linear-gradient(135deg,#cfeaff,#7fb6e0)", g: `repeating-linear-gradient(90deg,${pin.cor || a.corPadrao} 0 6px,#00000040 6px 12px)`, h: "repeating-linear-gradient(#e9edf2 0 9px,#b8c0ca 9px 10px),#e9edf2" }[e]);
  const ferr = (id, nome, dica) => `<button type="button" aria-pressed="${pin.ferramenta === id}" onclick="escritorioPincel().ferramenta='${id}';renderEscritorio()" title="${dica}">${nome}</button>`;
  return `<div class="ofc-cats ofc-ferramentas">${ferr("piso", "Pintar piso", "Clique ou arraste nos ladrilhos da sua sala")}${ferr("balde", "Piso inteiro", "Troca o piso da sala toda de uma vez")}${ferr("parede", "Pintar parede", "Clique nos trechos das paredes altas")}${ferr("planta", "Planta", "Desenhe o formato do quarto: tire piso ou crie patamares")}${ferr("luz", "Luz", "Luz ambiente do quarto, como o regulador de luz do Habbo")}</div>
${pin.ferramenta === "planta" ? `<p class="ofc-nota">Clique ou arraste nos ladrilhos para mudar o formato do quarto, como no editor de planta do Habbo. A porta e a escada ficam onde estão. Vale ao clicar em Salvar.</p><h4>Ladrilho</h4><div class="ofc-cats ofc-ferramentas">${ESCRITORIO_FORMAS_PLANTA.map(([id, nome, dica]) => `<button type="button" aria-pressed="${(pin.forma || "p") === id}" onclick="escritorioPincel().forma='${id}';renderEscritorio()" title="${dica}">${nome}</button>`).join("")}</div><div class="ofc-ficha-acoes"><button type="button" class="ofc-secundario" onclick="plantaOriginalEscritorio()">Voltar à planta escolhida</button></div><h4>Porta</h4><div class="ofc-cats ofc-ferramentas">${[["baixo", "Embaixo"], ["direita", "À direita"]].map(([id, nome]) => `<button type="button" aria-pressed="${a.porta === id}" onclick="mudarPortaEscritorio('${id}')">${nome}</button>`).join("")}</div><p class="ofc-nota">A altura das paredes muda em Pintar parede → Altura.</p><p class="ofc-erro" id="office-estilo-erro" role="alert"></p>` : pin.ferramenta === "luz" ? `<p class="ofc-nota">A luz tinge o quarto inteiro, como o regulador de luz do Habbo. Muda na hora para todos, sem precisar de Salvar.</p><h4>Luz do quarto</h4><div class="ofc-amostras">${ESCRITORIO_LUZES_SALA.map(([id, nome, cor]) => `<button type="button" aria-pressed="${(escritorioPerfilDecoracao()?.sala_luz || "") === id}" onclick="estiloSalaEscritorio('sala_luz','${id}')"><i style="background:${cor}"></i><span>${nome}</span></button>`).join("")}</div><p class="ofc-erro" id="office-estilo-erro" role="alert"></p>` : `
<p class="ofc-nota">${pin.ferramenta === "parede" ? "Escolha estilo, altura e cor e clique no piso encostado em qualquer parede da sua sala (fundo, lados ou frente) para trocar aquele trecho. Arraste para fazer vários." : pin.ferramenta === "balde" ? "Toque num piso: a sala inteira muda (os ladrilhos pintados à mão saem)." : "Escolha o piso e clique ou arraste nos ladrilhos da sua sala."} Muda na hora para todos, sem precisar de Salvar.</p>
${pin.ferramenta === "parede" ? `<h4>Estilo da parede</h4><div class="ofc-amostras">${ESCRITORIO_ESTILOS_PAREDE.map(([id, nome]) => `<button type="button" aria-pressed="${pin.estilo === id}" onclick="escritorioPincel().estilo='${id}';renderEscritorio()"><i style="background:${amostraParede(id)}"></i><span>${nome}</span></button>`).join("")}</div>
<h4>Altura</h4><div class="ofc-cats ofc-ferramentas">${[["0", "Baixa"], ["1", "Média"], ["2", "Alta"]].map(([h, n]) => `<button type="button" aria-pressed="${pin.altura === h}" onclick="escritorioPincel().altura='${h}';renderEscritorio()">${n}</button>`).join("")}</div>
<h4>Cor (Padrão, Lisa e Listrada)</h4><div class="ofc-amostras cores">${ESCRITORIO_PAREDES_SALA.map((c) => `<button type="button" aria-pressed="${pin.cor === c}" onclick="escritorioPincel().cor='${c}';renderEscritorio()" aria-label="${c ? "Cor " + c : "Cor da sala"}"><i style="background:${c || a.corPadrao}"></i>${c ? "" : "<span>Da sala</span>"}</button>`).join("")}</div>
<div class="ofc-ficha-acoes"><button type="button" class="ofc-secundario" onclick="pintarTodasParedesEscritorio()">Aplicar em todas as paredes</button><button type="button" class="ofc-secundario" onclick="limparPinturaEscritorio('sala_paredes')">Paredes como eram</button></div>`
  : `${pin.ferramenta === "piso" ? escritorioPisosAcervoHtml() : ""}<h4>Piso</h4><div class="ofc-amostras">${ESCRITORIO_PISOS_SALA.map(([id, nome]) => `<button type="button" aria-pressed="${pin.ferramenta === "balde" ? (escritorioPerfilDecoracao()?.sala_piso || "") === id : pin.piso === id}" onclick="${pin.ferramenta === "balde" ? `estiloSalaEscritorio('sala_piso','${id}',true)` : `escritorioPincel().piso='${id}';renderEscritorio()`}" aria-label="Piso ${nome}"><i style="background:${piso(id)}"></i><span>${nome}</span></button>`).join("")}</div>
<div class="ofc-ficha-acoes"><button type="button" class="ofc-secundario" onclick="limparPinturaEscritorio('sala_pisos')">Tirar a pintura do piso</button></div>`}
<p class="ofc-erro" id="office-estilo-erro" role="alert"></p>`}`;
}
// Pinta um ladrilho ou trecho de parede da própria sala (x, y do mapa).
function pintarNaSalaEscritorio(x, y, fx = x + 0.5, fy = y + 0.5) {
  const mesa = escritorioMinhaMesa(), pin = escritorioPincel();
  // Só de dentro do próprio quarto (as coordenadas são as dele).
  if (!mesa || escritorio.quarto !== mesa.ambiente.id) return false;
  const a = mesa.ambiente, lx = x - a.x0, ly = y - a.y0, L = ESCRITORIO_QUARTO_MAX, { w, h } = escritorioDimQuarto(a);
  if (lx < 0 || ly < 0 || lx >= w || ly >= h) return false;
  const p = escritorioPerfilDecoracao();
  if (pin.ferramenta === "luz") return false;
  if (pin.ferramenta === "planta") return formaNaSalaEscritorio(a, lx, ly, pin.forma || "p", x, y);
  if (pin.ferramenta === "parede") {
    // Parede mais perto do ponto clicado, entre as que encostam no ladrilho
    // (fundo, esquerda, frente, direita) e que existem no mapa.
    const ux = fx - a.x0, uy = fy - a.y0;
    const lados = [[0, uy, ly === 0], [1, ux, lx === 0], [2, h - uy, ly === h - 1], [3, w - ux, lx === w - 1]]
      .filter(([lado, , encosta]) => encosta && escritorioTrechoExiste(a, lado * L + (lado % 2 ? ly : lx)))
      .sort((m, n) => m[1] - n[1]);
    if (!lados.length) return false;
    const lado = lados[0][0], i = lado * L + (lado % 2 ? ly : lx);
    const atual = String(p.sala_paredes || "").length === L * 12 ? p.sala_paredes : "-00".repeat(L * 4);
    const cod = pin.estilo + Math.max(0, ESCRITORIO_PAREDES_SALA.indexOf(pin.cor)).toString(16) + pin.altura;
    if (atual.slice(i * 3, i * 3 + 3) === cod) return true;
    escritorioAlterarDecoracao({sala_paredes: atual.slice(0, i * 3) + cod + atual.slice(i * 3 + 3)});
  } else if (pin.ferramenta === "piso" && pin.movel) {
    // Piso do acervo (água, pedras, mosaico…): é um móvel rente ao chão, um
    // por ladrilho; troca o que já estiver ali. Vale ao clicar em Salvar.
    const e = escritorio.edicao;
    if (!e || e.camada !== a.id) return false;
    const pisos = new Set((escritorioCatalogo || []).filter((m) => m.categoria === "Pisos do acervo").map((m) => m.classe));
    const ja = e.itens.findIndex((it) => pisos.has(it[0]) && Math.floor(it[1]) === lx && Math.floor(it[2]) === ly);
    if (ja >= 0 && e.itens[ja][0] === pin.movel) return true;
    if (ja >= 0) e.itens.splice(ja, 1);
    e.itens.push([pin.movel, lx, ly, 0, 0, 0]);
    escritorioEditorMudou();
    return true;
  } else if (pin.ferramenta === "piso") {
    const i = ly * L + lx;
    const atual = String(p.sala_pisos || "").length === L * L ? p.sala_pisos : "0".repeat(L * L);
    const cod = Math.max(0, ESCRITORIO_PISOS_SALA.findIndex(([id]) => id === pin.piso)).toString(16);
    if (atual[i] === cod) return true;
    escritorioAlterarDecoracao({sala_pisos: atual.slice(0, i) + cod + atual.slice(i + 1)});
  } else return false;
  escritorioPinturaMudou();
  return true;
}
// Editor de planta livre: troca o ladrilho (piso, patamar ou sem piso) na
// edição em curso; salva junto com os móveis.
const ESCRITORIO_FORMAS_PLANTA = [["p", "Piso", "Piso no nível do chão"], ["1", "Patamar 1", "Um degrau acima do chão"], ["2", "Patamar 2", "Dois degraus: só se chega por escada"], ["v", "Sem piso", "Tira o ladrilho (vira vazio)"], ["0", "Como na planta", "Volta o ladrilho ao da planta escolhida"]];
function formaNaSalaEscritorio(a, lx, ly, forma, x, y) {
  const e = escritorio.edicao;
  if (!e || e.camada !== a.id) return false;
  const base = escritorio.base?.quartos?.plantas?.find((p) => p.id === a.planta);
  if (!base) return false;
  const erro = (texto) => { const el = document.getElementById("office-estilo-erro"); if (el) el.textContent = texto; return true; };
  if (escritorioLadrilhoFixo(base, lx, ly)) return erro("A porta e a escada não mudam de lugar.");
  const atual = e.celdas !== undefined ? e.celdas : (ESCRITORIO_CELDAS_LIVRES.test(a.celdasLivres || "") ? a.celdasLivres : "0".repeat(144));
  const i = ly * 12 + lx;
  if (atual[i] === forma) return true;
  const novo = atual.slice(0, i) + forma + atual.slice(i + 1);
  // Um móvel em cima do ladrilho precisa sair antes (senão ficaria no ar).
  const antes = escritorioNivelQuarto(a, lx, ly);
  const depois = escritorioPlantaLivre(base, novo).celdas[ly][lx];
  if (antes !== depois && escritorio.mapa?.moveisEm(x, y).some((m) => !MAPA_PASSAVEIS.test(m.classe)))
    return erro("Tire o móvel desse ladrilho antes de mudar o piso.");
  erro("");
  e.celdas = novo;
  escritorioEditorMudou();
  clearTimeout(escritorio.timerPintura);
  escritorio.timerPintura = setTimeout(() => escritorioRedesenharMapa(), 40);
  return true;
}
// Porta embaixo ou à direita (o vão da planta já existe nos dois lados).
// Salva na hora, como a pintura; o servidor confere que o vão está livre.
function mudarPortaEscritorio(lado) {
  const a = escritorioMinhaMesa()?.ambiente, base = a && escritorio.base?.quartos?.plantas?.find((p) => p.id === a.planta);
  if (!a || !base || a.porta === lado) return;
  const { w, h } = escritorioDimQuarto(a);
  const vao = lado === "direita" ? [[w - 1, base.portas.direita], [w - 1, base.portas.direita + 1]] : [[base.portas.baixo, h - 1], [base.portas.baixo + 1, h - 1]];
  const ocupado = vao.some(([x, y]) => (escritorio.mapa?.moveisEm(a.x0 + x, a.y0 + y) || []).some((m) => !m.plano && !MAPA_PASSAVEIS.test(m.classe)));
  const erro = document.getElementById("office-estilo-erro");
  if (ocupado) { if (erro) erro.textContent = "Tire os móveis do lugar da porta nova antes de mudar."; return; }
  if (escritorio.edicao?.mudou) { if (erro) erro.textContent = "Salve ou desfaça a decoração antes de mudar a porta."; return; }
  estiloSalaEscritorio("sala_porta", lado);
}
function plantaOriginalEscritorio() {
  const e = escritorio.edicao, a = escritorioMinhaMesa()?.ambiente;
  if (!e || !a || e.camada !== a.id) return;
  e.celdas = "0".repeat(144);
  if (e.itens.some((it) => escritorioNivelQuarto(a, it[1], it[2]) < 0)) { e.celdas = undefined; return escritorioAviso("Tire os móveis dos ladrilhos que somem antes de voltar à planta."); }
  escritorioEditorMudou();
  escritorioRedesenharMapa();
}
function pintarTodasParedesEscritorio() {
  const pin = escritorioPincel();
  const a = escritorioMinhaMesa()?.ambiente;
  if (!a) return;
  const cod = pin.estilo + Math.max(0, ESCRITORIO_PAREDES_SALA.indexOf(pin.cor)).toString(16) + pin.altura;
  escritorioAlterarDecoracao({sala_paredes: Array.from({ length: ESCRITORIO_QUARTO_MAX * 4 }, (_, i) => (escritorioTrechoExiste(a, i) ? cod : "-00")).join("")});
  escritorioPinturaMudou();
}
function limparPinturaEscritorio(campo) {
  escritorioAlterarDecoracao({[campo]: ""});
  escritorioPinturaMudou();
}
// Redesenha logo e salva um pouco depois (arrastando, junta vários ladrilhos).
function escritorioPinturaMudou() {
  escritorioAplicarSalas();
  clearTimeout(escritorio.timerPintura);
  escritorio.timerPintura = setTimeout(() => (escritorio.mapa?.repintar ? escritorio.mapa.repintar() : escritorioRedesenharMapa()), 40);
  clearTimeout(escritorio.timerSalvarPintura);
  const payload=escritorioPayloadDecoracao();
  escritorio.timerSalvarPintura = setTimeout(()=>salvarPinturaEscritorio(payload), 900);
}
async function salvarPinturaEscritorio(payload=escritorioPayloadDecoracao()) {
  if (escritorio.base.demo) return;
  try {
    const r = await escritorioApi("perfil", { perfil: payload });
    const eu = escritorio.base.equipe.find((x) => String(x.id) === String(escritorio.base.eu));
    if (eu) eu.perfil = { ...eu.perfil, ...r.perfil };
    escritorioAvisarDecoracao(escritorio.quarto);
  } catch (e) {
    const erro = document.getElementById("office-estilo-erro");
    if (erro) erro.textContent = "Não salvou: " + e.message;
    escritorioAviso("A pintura não foi salva: " + e.message);
  }
}
function abrirEstiloSalaEscritorio() {
  const mesa = escritorioMinhaMesa();
  if (!mesa) return escritorioAviso("Você ainda não tem sala no escritório.");
  document.getElementById("office-ficha")?.close?.();
  if (!escritorio.edicao || escritorio.edicao.camada !== mesa.ambiente.id) {
    if (escritorio.edicao?.mudou && !confirm("Descartar as mudanças desta edição?")) return;
    escritorio.edicao = null;
    abrirEditorEscritorio(mesa.ambiente.id);
  }
  escritorio.catalogoCategoria = "Sala";
  escritorio.aba = "catalogo";
  escritorio.lateral = true;
  renderEscritorio();
  escritorio.mapa?.centralizar((mesa.ambiente.x0 + mesa.ambiente.x1) / 2, (mesa.ambiente.y0 + mesa.ambiente.y1) / 2);
}
async function estiloSalaEscritorio(campo, valor, limparLadrilhos = false) {
  const antes=structuredClone(escritorioPerfilDecoracao());
  escritorioAlterarDecoracao({[campo]:valor,...(limparLadrilhos ? {sala_pisos:""} : {})});
  escritorioAplicarSalas();
  escritorioRedesenharMapa();
  try {
    if (!escritorio.base.demo) {
      const r = await escritorioApi("perfil", { perfil: escritorioPayloadDecoracao() });
      escritorio.perfil = { ...escritorio.perfil, ...r.perfil };
      const eu = escritorio.base.equipe.find((x) => String(x.id) === String(escritorio.base.eu));
      if (eu) eu.perfil = { ...eu.perfil, ...r.perfil };
      escritorioAvisarDecoracao(escritorio.quarto);
    }
  } catch (e) {
    // Não salvou: volta como estava e diz o porquê.
    escritorioAlterarDecoracao(antes);
    escritorioAplicarSalas();
    escritorioRedesenharMapa();
    const erro = document.getElementById("office-estilo-erro");
    if (erro) erro.textContent = e.message;
    return;
  }
  if (escritorio.edicao && escritorio.catalogoCategoria === "Sala") renderEscritorio();
  escritorioAviso(campo === "sala_piso" ? "Piso da sala trocado." : campo === "sala_luz" ? "Luz do quarto trocada." : campo === "sala_porta" ? "Porta trocada de lugar." : "Cor das paredes trocada.");
}
// Recria o mapa (piso e paredes são desenhados uma vez), mantendo a câmera.
function escritorioRedesenharMapa() {
  if (!escritorio.mapa) return;
  const pos = escritorioPosicao(escritorio.perfil || {});
  escritorio.mapa.destruir();
  escritorio.mapa = null;
  renderEscritorio();
  escritorio.mapa?.centralizar(pos.x, pos.y);
}
// As demandas chegam e mudam com o Painel: a barra acompanha a cada minuto.
if (typeof window !== "undefined" && typeof setInterval === "function")
  setInterval(() => { if (typeof activeBoard !== "undefined" && activeBoard === "escritorio") atualizarBarraDiaEscritorio(); }, 60000);

// O trecho existe como parede no quarto (a porta é um vão, sem parede)?
function escritorioTrechoExiste(a, i) {
  const [eixo, resto] = escritorioChaveTrecho(a, i).split(":");
  const [x, y] = resto.split(",").map(Number);
  return escritorioParedesDoQuarto(a).some(([x0, y0, x1, y1]) => eixo === "x" ? y0 === y1 && y0 === y && x >= x0 && x < x1 : x0 === x1 && x0 === x && y >= y0 && y < y1);
}

// Pisos do acervo (com animação, como água e grama): escolha um e pinte.
function escritorioPisosAcervoHtml() {
  const pin = escritorioPincel();
  const lista = (escritorioCatalogo || []).filter((m) => m.categoria === "Pisos do acervo");
  if (!lista.length) { carregarCatalogoEscritorio?.(); return ""; }
  return `<h4>Pisos do acervo <small>(${lista.length}; ficam ao clicar em Salvar)</small></h4><div class="ofc-moveis ofc-pisos-acervo">${lista.map((m) => `<button type="button" class="ofc-movel" aria-pressed="${pin.movel === m.classe}" onclick="escritorioPincel().movel=escritorioPincel().movel==='${safeText(m.classe)}'?'':'${safeText(m.classe)}';renderEscritorio()" title="${safeText(escritorioNomeMovel(m))}"><img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(m.classe)}.png?size=64" alt="" onerror="miniaturaLocalEscritorio(this,'${safeText(m.classe)}')"><span>${safeText(escritorioNomeMovel(m))}</span>${m.anima ? '<em class="ofc-giro">animado</em>' : ""}</button>`).join("")}</div>
${pin.movel ? '<p class="ofc-nota">Clique ou arraste nos ladrilhos da sala. Para voltar aos pisos de cor, clique de novo no piso escolhido.</p>' : ""}`;
}

// Post-its nas paredes da sala (como os recados do Habbo). Qualquer pessoa
// cola; quem escreveu, o dono da sala ou quem administra tira.
const ESCRITORIO_CORES_POSTIT = [["amarelo", "Amarelo"], ["rosa", "Rosa"], ["azul", "Azul"], ["verde", "Verde"]];
async function carregarPostitsEscritorio() {
  const camada = escritorio.quarto, mapa = escritorio.mapa;
  if (!mapa?.postits) return;
  if (!camada) return mapa.postits([]);
  let lista = (escritorio.postitsDemo ||= {})[camada] || [];
  if (!escritorio.base.demo) {
    try { lista = (await escritorioApi("postits", null, { camada })).postits; } catch { return; }
  }
  if (escritorio.quarto === camada && escritorio.mapa === mapa) { escritorio.postits = lista; mapa.postits(lista, abrirPostitEscritorio); }
}
function abrirNovoPostitEscritorio() {
  if (!escritorio.quarto) return escritorioAviso("Na Praça não há parede: entre numa sala para colar um post-it.");
  openWorkflowModal(`<div class="workflow-kicker">Post-it</div><h2 class="workflow-title">Colar na parede</h2>
<form class="ofc-postit-form" onsubmit="event.preventDefault();colarPostitEscritorio(this)">
<label>Recado<textarea name="texto" maxlength="280" rows="4" required placeholder="Ex.: reunião com o cliente às 15h"></textarea></label>
<fieldset><legend>Cor</legend>${ESCRITORIO_CORES_POSTIT.map(([id, nome], i) => `<label class="ofc-postit-cor" data-cor="${id}"><input type="radio" name="cor" value="${id}"${i ? "" : " checked"}><span>${nome}</span></label>`).join("")}</fieldset>
<p class="ofc-nota">Vai para a parede mais perto de você. Todos que entrarem na sala veem.</p>
<p class="ofc-erro" id="office-postit-erro" role="alert"></p>
<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button class="workflow-primary">Colar</button></div></form>`);
  setTimeout(() => document.querySelector(".ofc-postit-form textarea")?.focus(), 50);
}
async function colarPostitEscritorio(form) {
  const camada = escritorio.quarto, a = escritorioAmbienteDoQuarto();
  if (!camada || !a) return;
  const p = escritorioPosicao(escritorio.perfil || {}), x = p.x - a.x0, y = p.y - a.y0;
  // A parede mais perto: o fundo (lado 0) ou a esquerda (lado 1).
  const lado = y <= x ? 0 : 1, posicao = Math.max(0.3, Math.min((lado ? a.y1 - a.y0 : a.x1 - a.x0) - 0.3, (lado ? y : x) + 0.5));
  const vizinhos = (escritorio.postits || []).filter((q) => q.lado === lado && Math.abs(q.posicao - posicao) < 0.6).length;
  const corpo = { camada, lado, posicao, altura: [0.55, 0.3, 0.8][vizinhos % 3], cor: form.cor.value, texto: form.texto.value };
  const botao = form.querySelector(".workflow-primary");
  botao.disabled = true;
  try {
    if (escritorio.base.demo) ((escritorio.postitsDemo ||= {})[camada] ||= []).push({ ...corpo, id: String(Date.now()), pessoa_id: String(escritorio.base.eu), nome: "Você", texto: corpo.texto.replace(/\s+/g, " ").trim(), criado_em: new Date().toISOString() });
    else await escritorioApi("postit", corpo);
    closeWorkflowModal();
    escritorioEmitir("chat:bubble", { texto: ESCRITORIO_COMANDO + "pst=" + camada });
    await carregarPostitsEscritorio();
    escritorioAviso("Post-it colado na parede.");
  } catch (e) {
    botao.disabled = false;
    const erro = document.getElementById("office-postit-erro");
    if (erro) erro.textContent = e.message;
  }
}
function abrirPostitEscritorio(q) {
  const eu = String(escritorio.base.eu), dono = escritorio.base.salas?.find((s) => s.id === escritorioRaizQuarto(escritorio.quarto))?.pessoa_id;
  const pode = String(q.pessoa_id) === eu || String(dono) === eu || escritorio.base.admin;
  const quando = q.criado_em ? new Date(q.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
  escritorio.postitAberto = q;
  openWorkflowModal(`<div class="workflow-kicker">Post-it</div><div class="ofc-postit-lido" data-cor="${safeText(q.cor)}"><p>${safeText(q.texto)}</p></div><p class="ofc-nota">${safeText(q.nome)}${quando ? " · " + safeText(quando) : ""}</p>
<p class="ofc-erro" id="office-postit-erro" role="alert"></p>
<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Fechar</button>${pode ? '<button type="button" class="workflow-secondary perigo" onclick="tirarPostitEscritorio()">Tirar da parede</button>' : ""}</div>`);
}
async function tirarPostitEscritorio() {
  const q = escritorio.postitAberto, camada = escritorio.quarto;
  if (!q || !camada) return;
  try {
    if (escritorio.base.demo) (escritorio.postitsDemo ||= {})[camada] = (escritorio.postitsDemo[camada] || []).filter((p) => p.id !== q.id);
    else await escritorioApi("postit-apagar", { id: q.id });
    closeWorkflowModal();
    escritorioEmitir("chat:bubble", { texto: ESCRITORIO_COMANDO + "pst=" + camada });
    await carregarPostitsEscritorio();
  } catch (e) {
    const erro = document.getElementById("office-postit-erro");
    if (erro) erro.textContent = e.message;
  }
}

// Presente: uma unidade guardada do seu inventário vai para outra pessoa
// (o servidor confere e faz a troca numa transação só).
function escritorioMeusGuardados() {
  const sala = escritorioDonos().get(escritorio.base?.eu)?.id;
  const camadas = escritorio.base.mapa?.camadas || {};
  const colocados = (classe) => [sala, sala + "-andar-1"].flatMap((c) => camadas[c]?.itens || []).filter((it) => it[0] === classe).length;
  const essenciais = escritorio.base.quartos?.essenciais || [];
  return (escritorio.base.economia?.inventario || [])
    .filter((i) => !essenciais.includes(i.classe) && !String(i.classe).startsWith("vybeimg_"))
    .map((i) => ({ classe: i.classe, livres: Number(i.quantidade) - colocados(i.classe) }))
    .filter((i) => i.livres > 0);
}
function abrirPresenteEscritorio(id) {
  const pessoa = escritorio.base.equipe.find((p) => String(p.id) === String(id));
  if (!pessoa) return;
  const lista = escritorioMeusGuardados();
  const nome = (classe) => { const m = (typeof escritorioCatalogo !== "undefined" && escritorioCatalogo || []).find((x) => x.classe === classe); return m ? escritorioNomeMovel(m) : classe; };
  openWorkflowModal(`<div class="workflow-kicker">Presente</div><h2 class="workflow-title">Dar um móvel para ${safeText(String(pessoa.nome).split(" ")[0])}</h2>
${lista.length ? `<p>Escolha um móvel guardado (fora do quarto). Ele sai do seu inventário e vai para o da pessoa.</p><div class="workflow-actions ofc-teleporte">${lista.map((i) => `<button type="button" class="workflow-secondary" onclick="darPresenteEscritorio('${safeText(String(id))}','${safeText(i.classe)}',this)">${safeText(nome(i.classe))}${i.livres > 1 ? ` · ${i.livres} guardados` : ""}</button>`).join("")}</div>`
    : `<p class="ofc-nota">Você não tem móveis guardados para dar. Os essenciais grátis não contam; para dar um móvel que está no quarto, guarde-o antes (editor → Guardar).</p>`}
<p class="ofc-erro" id="office-presente-erro" role="alert"></p>
<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Fechar</button></div>`);
  if (typeof carregarCatalogoEscritorio === "function" && !escritorioCatalogo) carregarCatalogoEscritorio();
}
async function darPresenteEscritorio(para, classe, botao) {
  if (botao) botao.disabled = true;
  try {
    if (escritorio.base.demo) throw new Error("A demonstração não grava presentes.");
    const chave = (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g, "");
    const r = await escritorioApi("presente", { para, classe, chave });
    escritorio.base.economia = { ...escritorio.base.economia, ...r.economia };
    closeWorkflowModal();
    escritorioEmitir("chat:bubble", { texto: ESCRITORIO_COMANDO + "pre=" + para + ":" + classe });
    escritorioAviso("Presente entregue.");
  } catch (e) {
    if (botao) botao.disabled = false;
    const erro = document.getElementById("office-presente-erro");
    if (erro) erro.textContent = e.message;
  }
}
async function presenteChegouEscritorio(id, v) {
  const [para] = String(v || "").split(":");
  if (para !== String(escritorio.base?.eu) || String(id) === para || escritorio.base?.demo) return;
  const nome = String((escritorio.online || []).find((o) => String(o.id) === String(id))?.nome || "Alguém").split(" ")[0];
  try {
    const b = await escritorioApi("entrada");
    escritorio.base.economia = { ...escritorio.base.economia, ...b.economia, loja: escritorio.base.economia?.loja };
  } catch {}
  escritorioAviso(`${nome} te deu um móvel de presente. Está em Meus móveis.`);
  if (escritorio.edicao) renderEscritorio();
}
