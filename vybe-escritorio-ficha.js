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
    semAtrasoNoMes: comPrazo.length >= 10 && emDia === comPrazo.length,
  };
}
const ESCRITORIO_MARCOS = [
  { id: "primeira", nome: "Primeira entrega", dica: "Concluiu a primeira demanda", ok: (n) => n.total >= 1 },
  { id: "dez", nome: "10 entregas", dica: "10 demandas concluídas", ok: (n) => n.total >= 10 },
  { id: "cinquenta", nome: "50 entregas", dica: "50 demandas concluídas", ok: (n) => n.total >= 50 },
  { id: "cem", nome: "100 entregas", dica: "100 demandas concluídas", ok: (n) => n.total >= 100 },
  { id: "duzentas", nome: "250 entregas", dica: "250 demandas concluídas", ok: (n) => n.total >= 250 },
  { id: "semfuro", nome: "Mês sem furo", dica: "10 ou mais entregas no mês, todas dentro do prazo", ok: (n) => n.semAtrasoNoMes },
  { id: "embalo", nome: "Embalado", dica: "5 dias úteis seguidos com entrega", ok: (n) => n.seq >= 5 },
  { id: "maratona", nome: "Maratona", dica: "15 dias úteis seguidos com entrega", ok: (n) => n.seq >= 15 },
  { id: "carteira", nome: "Muitos clientes", dica: "Entregou para 5 clientes diferentes no mês", ok: (n) => n.clientes >= 5 },
  { id: "zerado", nome: "Fila em dia", dica: "Nenhuma demanda atrasada agora", ok: (n) => n.total >= 1 && n.atrasadas === 0 },
];
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
function abrirFichaEscritorio(id) {
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
  const img = "https://www.habbo.com/habbo-imaging/avatarimage?" + new URLSearchParams({ figure: mapaFigura(perfil), direction: "3", head_direction: "3", size: "l", gesture: "sml" });
  const lugar = online ? escritorioLugarDe(online).nome : "Fora do escritório";
  const [status, cor] = ESCRITORIO_STATUS[online?.status || "ausente"] || ESCRITORIO_STATUS.ausente;
  const numero = (rotulo, valor, dica = "") => `<div title="${safeText(dica)}"><dt>${rotulo}</dt><dd>${valor}</dd></div>`;
  const corpo = !veNumeros
    ? `<p class="ofc-nota">Os números e marcos de cada pessoa ficam na ficha dela e com quem administra.</p>`
    : !n
      ? `<p class="ofc-nota">Carregando as demandas do Painel…</p>`
      : `<div class="ofc-ficha-nivel"><b>Nível ${n.nivel}</b><span class="ofc-dia-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${n.xpProximo}" aria-valuenow="${n.xp}" aria-label="Progresso até o próximo nível"><i style="width:${Math.round((n.xp / n.xpProximo) * 100)}%"></i></span><small>${n.xp} de ${n.xpProximo} entregas para o nível ${n.nivel + 1}</small></div>
<dl class="ofc-ficha-numeros">${numero("Hoje", `${n.dia.feitas}/${n.dia.total}`, "Entregas de hoje / o que vence hoje")}${numero("No mês", n.mes, "Demandas concluídas neste mês")}${numero("No prazo", n.emDia === null ? "–" : n.emDia + "%", "Entregas do mês concluídas até o prazo")}${numero("Sequência", n.seq + (n.seq === 1 ? " dia" : " dias"), "Dias úteis seguidos com pelo menos uma entrega")}${numero("Clientes", n.clientes, "Clientes diferentes atendidos no mês")}${numero("Na fila", n.abertas + (n.atrasadas ? ` <em>· ${n.atrasadas} atrasada${n.atrasadas > 1 ? "s" : ""}</em>` : ""), "Demandas abertas agora")}</dl>
<h4>Marcos</h4><ul class="ofc-marcos">${ESCRITORIO_MARCOS.map((m) => { const ok = m.ok(n); return `<li class="${ok ? "ok" : ""}" title="${safeText(m.dica)}"><i aria-hidden="true">${ok ? "★" : "☆"}</i><span><b>${m.nome}</b><small>${ok ? "Conquistado" : m.dica}</small></span></li>`; }).join("")}</ul>
<p class="ofc-nota">Contado pelas demandas do Painel em que você é responsável (${n.total} concluídas no total).</p>`;
  d.innerHTML = `<div class="ofc-ficha-topo"><img src="${img}" alt="" width="64" height="110" referrerpolicy="no-referrer"><div><h3 id="office-ficha-nome">${safeText(pessoa.nome)}</h3><small><i class="ofc-ponto" style="--st:${cor}"></i>${safeText(status)} · ${safeText(lugar)}</small></div><button type="button" class="ofc-x" onclick="this.closest('dialog').close()" aria-label="Fechar">×</button></div>
${corpo}
<div class="ofc-ficha-acoes">${eu ? `<button type="button" class="ofc-secundario" onclick="document.getElementById('office-ficha').close();personalizarEscritorio()">Personalizar aparência</button>${escritorioMinhaMesa() ? `<button type="button" class="ofc-secundario" onclick="document.getElementById('office-ficha').close();abrirEstiloSalaEscritorio()">Piso e paredes da sala</button>` : ""}` : `<button type="button" class="ofc-secundario" onclick="document.getElementById('office-ficha').close();abrirRecadosEscritorio('${safeText(String(id))}')">Deixar recado</button>${online ? `<button type="button" class="ofc-secundario" onclick="document.getElementById('office-ficha').close();escritorioIrAte('${safeText(String(id))}')">Ir até</button>` : ""}`}</div>`;
  if (!d.open) d.showModal();
}
// Piso e paredes da própria sala: guardados no perfil do dono (o servidor só
// aceita os valores desta lista).
const ESCRITORIO_PISOS_SALA = [
  ["", "Padrão da sala"], ["madeira", "Madeira escura"], ["clara", "Madeira clara"], ["concreto", "Concreto"],
  ["carpete", "Carpete azul"], ["preto", "Preto"], ["cafe", "Porcelanato"], ["verde", "Verde"], ["deck", "Deck"],
  ["lareira", "Tijolo"], ["cinema", "Azul-noite"], ["pista", "Roxo"],
];
const ESCRITORIO_PAREDES_SALA = ["", "#ff8a35", "#ffb347", "#ffd166", "#ff6fa8", "#e05a5a", "#b48cff", "#7c6cff", "#5aa9ff", "#5ad1e6", "#7ee08a", "#3fb68b", "#e8e8ee", "#8a8f9c"];
// Escolha de piso e paredes. No editor fica na própria barra lateral (aba
// "Piso e paredes"); fora dele (pela ficha) abre o editor nessa aba.
function escritorioEstiloSalaHtml() {
  const mesa = escritorioMinhaMesa();
  if (!mesa) return '<p class="ofc-nota">Você ainda não tem sala no escritório.</p>';
  const p = escritorio.perfil || {}, a = mesa.ambiente;
  const piso = (id) => { const c = ESCRITORIO_PLANTA.PISO[id || a.pisoPadrao || a.piso]; return c ? `repeating-conic-gradient(${c[0]} 0 25%,${c[1]} 0 50%) 0 0/16px 16px` : "#333"; };
  return `<p class="ofc-nota">Toque numa opção: a sua sala muda na hora e todo mundo vê igual. Não precisa clicar em Salvar.</p>
<h4>Piso</h4><div class="ofc-amostras">${ESCRITORIO_PISOS_SALA.map(([id, nome]) => `<button type="button" aria-pressed="${(p.sala_piso || "") === id}" onclick="estiloSalaEscritorio('sala_piso','${id}')" aria-label="Piso ${nome}"><i style="background:${piso(id)}"></i><span>${nome}</span></button>`).join("")}</div>
<h4>Cor das paredes</h4><div class="ofc-amostras cores">${ESCRITORIO_PAREDES_SALA.map((c) => `<button type="button" aria-pressed="${(p.sala_parede || "") === c}" onclick="estiloSalaEscritorio('sala_parede','${c}')" aria-label="${c ? "Cor " + c : "Cor padrão da sala"}" title="${c ? c : "Padrão da sala"}"><i style="background:${c || a.corPadrao || a.cor}"></i>${c ? "" : "<span>Padrão</span>"}</button>`).join("")}</div>
<p class="ofc-erro" id="office-estilo-erro" role="alert"></p>`;
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
async function estiloSalaEscritorio(campo, valor) {
  const antes = escritorio.perfil[campo] || "";
  escritorio.perfil = { ...escritorio.perfil, [campo]: valor };
  escritorioAplicarSalas();
  escritorioRedesenharMapa();
  try {
    if (!escritorio.base.demo) {
      const r = await escritorioApi("perfil", { perfil: escritorio.perfil });
      escritorio.perfil = { ...escritorio.perfil, ...r.perfil };
      const eu = escritorio.base.equipe.find((x) => String(x.id) === String(escritorio.base.eu));
      if (eu) eu.perfil = { ...eu.perfil, ...r.perfil };
    }
  } catch (e) {
    // Não salvou: volta como estava e diz o porquê.
    escritorio.perfil = { ...escritorio.perfil, [campo]: antes };
    escritorioAplicarSalas();
    escritorioRedesenharMapa();
    const erro = document.getElementById("office-estilo-erro");
    if (erro) erro.textContent = e.message;
    return;
  }
  if (escritorio.edicao && escritorio.catalogoCategoria === "Sala") renderEscritorio();
  escritorioAviso(campo === "sala_piso" ? "Piso da sala trocado." : "Cor das paredes trocada.");
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
