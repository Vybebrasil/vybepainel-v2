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
// Regras gerais na ficha (Paulo, 20/10/2026): o que dá e o que tira XP e
// moedas, e como o bolo de cada peça é dividido. Tudo vem das tabelas.
function escritorioComoFuncionaHtml(bolo, regras) {
  const pct = (n) => (n ? `${Math.round(n * 1000) / 10}%`.replace(".", ",") : "—");
  const papeis = [["producao", "Produção (quem grava e fotografa)"], ["criacao", "Criação (quem faz a peça)"], ["atendimento", "Atendimento (head da carteira)"], ["agendamento", "Agendamento (quem agenda)"], ["gestao", "Gestão"]];
  const tabela = bolo ? `<table class="ofc-hud-bolo"><thead><tr><th>Quem</th><th>Foto</th><th>Vídeo e reels</th><th>Outras peças</th></tr></thead><tbody>${papeis.map(([k, nome]) => `<tr><td>${nome}</td><td>${pct(bolo[k]?.foto ?? bolo[k]?.captada)}</td><td>${pct(bolo[k]?.video ?? bolo[k]?.captada)}</td><td>${pct(bolo[k]?.normal)}</td></tr>`).join("")}</tbody></table>
<p class="ofc-nota">Quando o DA aprova a peça de outra pessoa, fica com ${pct(bolo.direcao_arte?.normal)} da parte da Criação. Se várias pessoas fazem a mesma peça, dividem a parte.</p>` : "";
  const ganha = [...new Set(regras.filter((r) => r.moedas > 0).map((r) => r.descricao))];
  const perde = [...new Set(regras.filter((r) => r.moedas < 0).map((r) => r.descricao))];
  return `<section class="ofc-hud-bloco ofc-hud-como"><div class="ofc-hud-bloco-topo"><h4>Como funciona</h4><small>Moedas compram móveis; XP sobe o nível.</small></div>
${bolo ? `<p>Cada peça concluída vira um <b>bolo</b> de moedas e XP do tamanho do formato (um Reels vale 2,5 vezes um Card). O bolo é dividido entre quem trabalhou nela:</p>${tabela}` : ""}
<ul class="ofc-hud-como-lista">
<li><b>Dá XP:</b> tudo o que dá moedas também dá XP, além das conquistas e do fechamento do dia e da semana.</li>
<li><b>Tira XP:</b> ${perde.length ? safeText(perde.join("; ")) : "nada"}. O XP nunca fica abaixo de zero.</li>
<li><b>Dá moedas:</b> ${ganha.length ? safeText(ganha.join("; ")) : "as entregas"}; e cada conquista.</li>
<li><b>Tira moedas:</b> ${perde.length ? safeText(perde.join("; ")) + "; e" : ""} as compras na loja. O saldo nunca fica negativo.</li>
</ul></section>`;
}
// Bolo por peça: a parte da pessoa em foto/vídeo e nas outras peças.
function escritorioParteDoBoloTexto(parte) {
  const pct = (n) => `${Math.round(n * 1000) / 10}%`.replace(".", ",");
  const t = [parte.foto ? `${pct(parte.foto)} nas fotos` : "", parte.video ? `${pct(parte.video)} nos vídeos e reels` : "", parte.normal ? `${pct(parte.normal)} nas outras peças` : ""].filter(Boolean).join(", ");
  return `Sua parte: ${t}. O bolo cresce com o formato (Reels, Carrossel…); o valor ao lado é de uma peça simples.`;
}
// Conquistas em níveis (Paulo, 20/10/2026): cada escada mostra o nível
// alcançado (Bronze, Prata, Ouro, Diamante), a barra até o próximo e o troféu.
function escritorioEscadaHtml(x) {
  const prox = x.proximo, alvo = prox ? prox.meta : x.degraus.at(-1)?.meta || 1;
  const anterior = x.degraus.filter((d) => d.ok).at(-1)?.meta || 0;
  const pct = prox ? Math.max(0, Math.min(100, Math.round(((x.valor - anterior) / Math.max(1, alvo - anterior)) * 100))) : 100;
  const pontos = x.social ? "" : `<span class="ofc-escada-degraus" aria-hidden="true">${x.degraus.map((d) => `<i class="n${d.nivel}${d.ok ? " ok" : ""}" title="${safeText(d.nome)}: ${d.meta.toLocaleString("pt-BR")}"></i>`).join("")}</span>`;
  const classe = (x.degraus.filter((d) => d.ok).at(-1) || prox || x.degraus.at(-1))?.classe;
  return `<li class="ofc-escada n${x.nivel}${x.nivel ? " ok" : ""}"><span class="ofc-hud-medalha">${classe ? escritorioMiniaturaHtml(classe) : escritorioFichaIcone("estrela")}</span><span class="ofc-escada-txt"><b>${safeText(x.nome)}${x.nomeNivel ? ` <em class="ofc-escada-nivel n${x.nivel}">${safeText(x.nomeNivel)}</em>` : ""}</b>
<small>${prox ? `${x.valor.toLocaleString("pt-BR")} de ${prox.meta.toLocaleString("pt-BR")} ${safeText(x.unidade)} para ${safeText(prox.nome)}` : "Nível máximo alcançado"}</small>${x.social && x.nivel ? "" : `<span class="ofc-escada-barra"><i style="width:${pct}%"></i></span>`}</span>${pontos}</li>`;
}
function escritorioMarcosHtml(marcos) {
  if (!marcos?.length) return "";
  const perto = [...marcos].filter((m) => m.proximo).sort((a, b) => b.valor / b.proximo.meta - a.valor / a.proximo.meta).slice(0, 4);
  return `<h4>Perto do próximo troféu</h4><ul class="ofc-hud-conquistas">${perto.map(escritorioEscadaHtml).join("")}</ul>`;
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
// Nível, meta da semana e extrato vêm do servidor (XP nunca abaixo de zero; a meta é a
// média da própria pessoa nas últimas semanas). Só a própria pessoa recebe
// esses dados; quem administra vê os números das demandas como antes.
function escritorioNivelHtml(p) {
  const m = p.meta || {}, pct = Math.round((p.xp / p.xpProximo) * 100);
  const pctMeta = m.meta ? Math.min(100, Math.round(((m.entregas || 0) / m.meta) * 100)) : 0;
  const funcao = { criacao: "Criação", atendimento: "Atendimento", agendamento: "Agendamento", producao: "Produção", gestao: "Gestão" }[p.funcao] || "";
  const data = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Bahia" }); };
  const sinal = (v) => (v > 0 ? "+" + v : String(v));
  return `<div class="ofc-ficha-nivel"><b>Nível ${p.nivel}${funcao ? ` · ${funcao}` : ""}</b><span class="ofc-dia-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${p.xpProximo}" aria-valuenow="${p.xp}" aria-label="Progresso até o próximo nível"><i style="width:${pct}%"></i></span><small>${p.xp} de ${p.xpProximo} XP para o nível ${p.nivel + 1} · ${p.xpTotal} XP no total.</small></div>
<div class="ofc-ficha-meta"><b>Meta da semana</b><span class="ofc-dia-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${m.meta || 1}" aria-valuenow="${m.entregas || 0}" aria-label="Meta da semana"><i style="width:${pctMeta}%"></i></span><small>${m.entregas || 0} de ${m.meta || 1} ${m.meta === 1 ? "entrega" : "entregas"}${m.semanas ? ` · sua média nas últimas ${m.semanas} ${m.semanas === 1 ? "semana" : "semanas"}: ${m.media}` : " · primeira semana com meta"}. Quem bate a própria meta ganha o bônus da semana.</small></div>
${p.extrato?.length ? `<h4>Últimos pontos</h4><ul class="ofc-extrato">${p.extrato.map((l) => `<li><span>${safeText(l.descricao)}</span><small>${data(l.criado_em)}</small><b class="${Number(l.moedas) < 0 ? "perda" : ""}">${sinal(Number(l.moedas))} <i>moedas</i> · +${Number(l.pontos)} <i>XP</i></b></li>`).join("")}</ul>` : ""}`;
}
// Ficha da pessoa como HUD de jogo (Paulo, 20/10/2026: "tá longe de uma HUD
// de joguinho; explicar de onde vem cada coisa"). Topo com o personagem, o
// selo do nível, a barra de XP e as moedas; abas no lugar da rolagem longa.
// Os valores de "como ganhar" e os ganhos da semana vêm do servidor (tabela
// de regras e razão de moedas), nunca de constante aqui.
const ESCRITORIO_FICHA_ABAS = [["resumo", "Resumo"], ["ganhar", "Como ganhar"], ["conquistas", "Conquistas"], ["inventario", "Inventário"], ["trabalho", "Trabalho"]];
const escritorioFichaIcone = (nome) => ({
  moeda: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#f5b83d" stroke="#8a5a12" stroke-width="1.6"/><circle cx="12" cy="12" r="6" fill="none" stroke="#ffe08a" stroke-width="1.2"/><path d="M9.6 9.2 12 15l2.4-5.8" fill="none" stroke="#8a5a12" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  xp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.6 6 6.5.6-4.9 4.3 1.5 6.4L12 16.8 6.3 20.1l1.5-6.4L2.9 9.4l6.5-.6z" fill="#7cc4ff" stroke="#2f6aa8" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  estrela: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.6 6 6.5.6-4.9 4.3 1.5 6.4L12 16.8 6.3 20.1l1.5-6.4L2.9 9.4l6.5-.6z" fill="#ffd166" stroke="#a8761a" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  caixa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4v9l-8 4-8-4z" fill="#c58a52" stroke="#6e4220" stroke-width="1.3" stroke-linejoin="round"/><path d="M4 8l8 4 8-4M12 12v9" fill="none" stroke="#6e4220" stroke-width="1.3"/></svg>',
}[nome] || "");
function escolherAbaFichaEscritorio(id, aba) { escritorio.fichaAba = aba; abrirFichaEscritorio(id, true); document.querySelector("#office-ficha .ofc-hud-corpo")?.classList.add("ofc-entra"); }
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
  if (!semAtualizar || escritorio.fichaDe !== String(id)) { escritorio.fichaAba = "resumo"; escritorio.fichaDe = String(id); }
  // Economia da pessoa: a própria vem na entrada; a de outra pessoa (quem
  // administra) é buscada ao abrir e guardada para a próxima abertura.
  const economia = eu ? escritorio.base?.economia : escritorio.fichas?.[String(id)];
  const pontos = veNumeros ? economia?.pontos || null : null;
  const marcos = veNumeros ? economia?.marcos || null : null;
  const t = pontos?.trabalho || null;
  const pub = escritorio.perfisPublicos?.[String(id)];
  const jogo = pub && pub.disponivel ? pub : null;
  const img = "https://www.habbo.com/habbo-imaging/avatarimage?" + new URLSearchParams({ figure: mapaFigura(perfil), direction: "2", head_direction: "3", size: "l", gesture: "sml" });
  const lugar = online ? escritorioLugarDe(online).nome : "Fora do escritório";
  const [status, cor] = ESCRITORIO_STATUS[online?.status || "ausente"] || ESCRITORIO_STATUS.ausente;
  const funcao = { criacao: "Criação", atendimento: "Atendimento", agendamento: "Agendamento", producao: "Produção", gestao: "Gestão" }[pontos?.funcao] || "";
  const nivel = jogo?.nivel ?? pontos?.nivel, xp = jogo?.xp ?? pontos?.xp, xpProx = jogo?.xpProximo ?? pontos?.xpProximo, xpTotal = jogo?.xpTotal ?? pontos?.xpTotal;
  const pct = xpProx ? Math.round(((xp || 0) / xpProx) * 100) : 0;
  const moveis = (jogo?.inventario || []).filter((i) => !String(i.classe).startsWith("roupa:")).reduce((n, i) => n + Number(i.quantidade || 0), 0);
  const conquistas = jogo?.conquistas ?? (marcos ? marcos.filter((m) => m.ok).length : null);
  const abas = ESCRITORIO_FICHA_ABAS.filter(([k]) => veNumeros || !["ganhar", "trabalho"].includes(k));
  const aba = abas.some(([k]) => k === escritorio.fichaAba) ? escritorio.fichaAba : "resumo";
  const sid = safeText(String(id));
  const carregando = (texto) => `<p class="ofc-nota ofc-hud-vazio">${texto}</p>`;
  const sinal = (v) => (v > 0 ? "+" + v : String(v));
  const chips = (moedas, pontosXp) => `${moedas ? `<span class="ofc-hud-chip moeda${moedas < 0 ? " perde" : ""}">${escritorioFichaIcone("moeda")}${sinal(moedas)}</span>` : ""}${pontosXp ? `<span class="ofc-hud-chip xp">${escritorioFichaIcone("xp")}+${pontosXp} XP</span>` : ""}`;
  const stat = (icone, valor, rotulo, explica) => `<div class="ofc-hud-stat"><i>${escritorioFichaIcone(icone)}</i><b>${valor ?? "–"}</b><span>${rotulo}</span><small>${explica}</small></div>`;
  let corpo = "";
  if (aba === "resumo") {
    const ganhos = pontos?.ganhos || [];
    const m = pontos?.meta || null, pctMeta = m?.meta ? Math.min(100, Math.round(((m.entregas || 0) / m.meta) * 100)) : 0;
    const perto = (marcos || []).filter((x) => x.proximo && x.valor > 0 && !x.social).map((x) => ({ x, p: x.valor / x.proximo.meta })).sort((a, b) => b.p - a.p).slice(0, 3);
    corpo = `${veNumeros && perto.length ? `<section class="ofc-hud-bloco"><div class="ofc-hud-bloco-topo"><h4>Próximos troféus</h4><button type="button" class="office-text-button" onclick="escolherAbaFichaEscritorio('${sid}','conquistas')">Ver todas</button></div><ul class="ofc-hud-proximos">${perto.map(({ x, p }) => `<li><span class="ofc-cq-arte falta">${escritorioMiniaturaHtml(x.proximo.classe)}</span><span><b>${safeText(x.nome)} <em class="ofc-escada-nivel n${x.proximo.nivel}">${safeText(x.proximo.nome)}</em></b><small>faltam ${(x.proximo.meta - x.valor).toLocaleString("pt-BR")} ${safeText(x.unidade)}</small><span class="ofc-escada-barra"><i style="width:${Math.round(p * 100)}%"></i></span></span></li>`).join("")}</ul></section>` : ""}
${!veNumeros && !jogo ? `<div class="ofc-hud-stats">${stat("moeda", jogo?.saldo, "VybeCoins", "Na carteira agora.")}${stat("xp", xpTotal, "XP no total", "Sobe o nível; peça que volta para alteração e dia com vencida tiram um pouco.")}${stat("estrela", conquistas, "Conquistas", "Níveis de Bronze a Diamante.")}${stat("caixa", jogo ? moveis : null, "Móveis", "Comprados, ganhos e troféus.")}</div>` : ""}
${veNumeros && m ? `<section class="ofc-hud-bloco"><div class="ofc-hud-bloco-topo"><h4>Meta da semana</h4><b>${m.entregas || 0}/${m.meta || 1}</b></div><span class="ofc-dia-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${m.meta || 1}" aria-valuenow="${m.entregas || 0}" aria-label="Meta da semana"><i style="width:${pctMeta}%"></i></span><small>${m.semanas ? `É a média das últimas ${m.semanas} ${m.semanas === 1 ? "semana" : "semanas"} (${m.media}).` : "Primeira semana com meta."} Bater a meta dá o bônus da semana.</small></section>` : ""}
${veNumeros ? `<section class="ofc-hud-bloco"><div class="ofc-hud-bloco-topo"><h4>Ganhos dos últimos 7 dias</h4><button type="button" class="office-text-button" onclick="escolherAbaFichaEscritorio('${sid}','ganhar')">Como ganhar mais</button></div>
${!economia ? carregando("Carregando os pontos…") : ganhos.length ? `<ul class="ofc-hud-ganhos">${ganhos.slice(0, 6).map((g) => `<li><span><b>${safeText(g.descricao)}</b><small>${g.vezes === 1 ? "1 vez" : `${g.vezes} vezes`}</small></span><span class="ofc-hud-chips">${chips(Number(g.moedas), Number(g.pontos))}</span></li>`).join("")}</ul>` : '<p class="ofc-nota">Nada ganho nos últimos 7 dias ainda.</p>'}</section>` : ""}
${!veNumeros && jogo?.marcos?.length ? `<section class="ofc-hud-bloco"><h4>Últimas conquistas</h4><ul class="ofc-hud-medalhas">${jogo.marcos.slice(-6).reverse().map((x) => `<li title="${safeText(x.dica || "")}"><i>${escritorioFichaIcone("estrela")}</i><span>${safeText(x.nome)}</span></li>`).join("")}</ul></section>` : ""}`;
    if (!veNumeros && jogo?.inventario?.length) corpo += `<section class="ofc-hud-bloco"><div class="ofc-hud-bloco-topo"><h4>No inventário</h4><button type="button" class="office-text-button" onclick="escolherAbaFichaEscritorio('${sid}','inventario')">Ver tudo</button></div><ul class="ofc-hud-previa-inv">${jogo.inventario.slice(0, 10).map((i) => `<li>${escritorioMiniaturaHtml(i.classe)}</li>`).join("")}</ul></section>`;
    if (!corpo.trim()) corpo = carregando(pub === undefined ? "Carregando a ficha…" : "Ainda sem conquistas. Elas aparecem aqui conforme as entregas.");
  } else if (aba === "ganhar") {
    const regras = pontos?.regras || [];
    // Cada regra cai num grupo só: o primeiro que servir.
    const grupos = [
      ["Perde moedas e XP", "Moedas e XP nunca ficam negativos.", (r) => r.moedas < 0],
      ["Fechamento do dia e da semana", "Contados pelo painel no fim do dia.", (r) => /^(dia_|meta_)/.test(r.chave)],
      ["Conquistas", "Uma vez cada, com um móvel de prêmio.", (r) => r.chave === "conquista"],
      ["A cada entrega", "Contam na meta da semana.", (r) => r.entrega],
      ["Bônus por peça", "Somam por cima da entrega.", () => true],
    ];
    const grupoDe = new Map(regras.map((r) => [r, grupos.findIndex(([, , f]) => f(r))]));
    const ordem = [3, 4, 1, 2, 0];
    corpo = !economia ? carregando("Carregando as regras…") : !regras.length ? '<p class="ofc-nota">As regras aparecem quando a contagem de pontos estiver ativa.</p>'
      : `${escritorioPorPecaHtml(pontos, funcao)}${escritorioComoFuncionaHtml(pontos?.bolo, regras)}<p class="ofc-nota">${funcao ? `Regras de <b>${funcao}</b> e as que valem para todo mundo.` : "Regras que valem para todo mundo."} Os valores são os da tabela da Vybe e podem mudar.</p>
${ordem.map((gi) => { const [titulo, dica] = grupos[gi], l = regras.filter((r) => grupoDe.get(r) === gi); return l.length ? `<section class="ofc-hud-bloco"><div class="ofc-hud-bloco-topo"><h4>${titulo}</h4><small>${dica}</small></div><ul class="ofc-hud-regras">${l.map((r) => `<li><span><b>${safeText(r.descricao)}</b>${r.parte ? `<small>${escritorioParteDoBoloTexto(r.parte)}</small>` : r.por_complexidade ? "<small>Vale mais conforme o formato da peça (Reels, Carrossel…).</small>" : ""}${r.entrega && gi !== 3 ? "<small>Conta na meta da semana.</small>" : ""}</span><span class="ofc-hud-chips">${chips(r.moedas, r.pontos)}</span></li>`).join("")}</ul></section>` : ""; }).join("")}`;
  } else if (aba === "conquistas") {
    if (veNumeros && marcos) {
      corpo = `<div class="ofc-cq-na-ficha">${escritorioConquistasCorpoHtml(marcos)}</div>`;
    } else corpo = jogo?.marcos?.length ? `<ul class="ofc-hud-conquistas">${[...jogo.marcos].sort((a, b) => (b.nivel || 0) - (a.nivel || 0)).map((x) => `<li class="ok" title="${safeText(x.dica || "")}"><span class="ofc-hud-medalha">${x.classe ? escritorioMiniaturaHtml(x.classe) : escritorioFichaIcone("estrela")}</span><span><b>${safeText(x.nome)}</b><small>${safeText(x.dica || "")}</small></span></li>`).join("")}</ul>` : pub === undefined ? carregando("Carregando as conquistas…") : '<p class="ofc-nota">Nenhuma conquista ainda.</p>';
  } else if (aba === "inventario") {
    const inv = (jogo?.inventario || []).filter((i) => !String(i.classe).startsWith("roupa:"));
    const nome = (classe) => { const mv = (typeof escritorioCatalogo !== "undefined" && escritorioCatalogo || []).find((x) => x.classe === classe); return typeof escritorioNomeMovel === "function" ? escritorioNomeMovel(mv || { classe, nome: classe }) : classe; };
    // Troféus primeiro, com o nível; depois os móveis (Paulo, 20/10/2026).
    const deTrofeu = new Map([...(marcos || []).flatMap((x) => x.degraus.filter((dg) => dg.ok).map((dg) => [dg.classe, { nivel: dg.nivel, nome: x.nome, tier: dg.nome }])), ...(jogo?.marcos || []).filter((x) => x.classe).map((x) => [x.classe, { nivel: x.nivel, nome: x.nome, tier: "" }])]);
    // Troféu leva o nome da conquista, não o do arquivo do móvel.
    const item = (i) => { const t = deTrofeu.get(i.classe), rotulo = t ? t.nome : nome(i.classe); return `<li class="${t ? "trofeu n" + t.nivel : ""}" title="${safeText(rotulo)}">${escritorioMiniaturaHtml(i.classe)}<span>${safeText(rotulo)}</span>${t?.tier ? `<em class="ofc-escada-nivel n${t.nivel}">${safeText(t.tier)}</em>` : ""}${Number(i.quantidade) > 1 ? `<em class="qtd">×${Number(i.quantidade)}</em>` : ""}</li>`; };
    const trofeus = inv.filter((i) => deTrofeu.has(i.classe)).sort((a, b) => deTrofeu.get(b.classe).nivel - deTrofeu.get(a.classe).nivel), outros = inv.filter((i) => !deTrofeu.has(i.classe));
    corpo = pub === undefined ? carregando("Carregando o inventário…") : inv.length ? `${trofeus.length ? `<h4 class="ofc-hud-sub">Troféus <small>${trofeus.length}</small></h4><ul class="ofc-ficha-inventario ofc-hud-inventario">${trofeus.map(item).join("")}</ul>` : ""}${outros.length ? `<h4 class="ofc-hud-sub">Móveis <small>${outros.length}</small></h4><ul class="ofc-ficha-inventario ofc-hud-inventario">${outros.map(item).join("")}</ul>` : ""}` : '<p class="ofc-nota">Nenhum móvel guardado ainda.</p>';
  } else if (aba === "trabalho") {
    const oQue = { criacao: "pelas peças que você fez e demandas finalizadas", atendimento: "pelas peças dos clientes da sua carteira", agendamento: "pelas peças agendadas", producao: "pelas fotos e vídeos captados", gestao: "pelas peças da agência, briefings e dias sem furo" }[t?.funcao] || "pelas entregas";
    const n = (rotulo, valor, dica) => `<div title="${safeText(dica)}"><dt>${rotulo}</dt><dd>${valor}</dd><small>${dica}</small></div>`;
    corpo = !economia ? carregando("Carregando os números de trabalho…") : !t ? '<p class="ofc-nota">Os números de trabalho aparecem quando a contagem de pontos estiver ativa.</p>'
      : `<dl class="ofc-ficha-numeros ofc-hud-numeros">${n("Hoje", t.hoje, "Entregas de hoje")}${n("Na semana", t.semana, "Desde segunda")}${n("No mês", t.mes, "Neste mês")}${n("Sequência", t.sequencia + (t.sequencia === 1 ? " dia" : " dias"), "Dias úteis seguidos com entrega")}${n("No total", t.total, "Todas as entregas")}${n("Meta", pontos.meta ? `${pontos.meta.entregas || 0}/${pontos.meta.meta || 1}` : "–", "Da semana")}</dl>
<p class="ofc-nota">Contado ${safeText(oQue)}: as mesmas entregas que dão XP e contam na meta.${eu ? "" : " Visto por quem administra."}</p>`;
  }
  const quarto = escritorioQuartoDe(id);
  const fechar = "document.getElementById('office-ficha').close();";
  // Vitrine: os troféus mais altos da pessoa, como numa estante (Paulo, 20/10/2026: "HUD de joguinho").
  const vitrine = (marcos ? marcos.flatMap((x) => x.degraus.filter((dg) => dg.ok).map((dg) => ({ classe: dg.classe, nivel: dg.nivel, nome: `${x.nome} ${dg.nome}` }))) : (jogo?.marcos || []).filter((x) => x.classe).map((x) => ({ classe: x.classe, nivel: x.nivel, nome: x.nome })))
    .sort((a, b) => b.nivel - a.nivel).slice(0, 7);
  const rk = (typeof escritorioRanking !== "undefined" ? escritorioRanking : null)?.dados?.pessoas?.find((p) => p.id === String(id));
  // Cartão do jogador (21/10/2026, a linguagem do Provador): o pedestal
  // brilha na cor do troféu mais alto da pessoa (Bronze a Diamante).
  d.className = `ofc-ficha jogador${vitrine[0] ? " tier-n" + vitrine[0].nivel : ""}`;
  d.innerHTML = `<div class="ofc-hud-topo"><div class="ofc-hud-boneco ofc-hud-palco"><span class="ofc-hud-holofote" aria-hidden="true"></span><span class="ofc-hud-pedestal" aria-hidden="true"></span><img src="${img}" alt="" width="128" height="220" referrerpolicy="no-referrer"></div>
<div class="ofc-hud-id"><h3 id="office-ficha-nome">${safeText(pessoa.nome)}</h3><small><i class="ofc-ponto" style="--st:${cor}"></i>${safeText(status)} · ${safeText(lugar)}${funcao ? ` · ${funcao}` : ""}</small>
${nivel != null ? `<div class="ofc-hud-nivel"><span class="ofc-hud-selo" title="Nível">${nivel}</span><span class="ofc-hud-xp"><span class="ofc-dia-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${xpProx}" aria-valuenow="${xp}" aria-label="XP até o próximo nível"><i style="width:${pct}%"></i></span><small>${xp} de ${xpProx} XP para o nível ${nivel + 1}</small></span></div>` : ""}
${jogo ? `<div class="ofc-hud-moedas"><span title="VybeCoins na carteira">${escritorioFichaIcone("moeda")}<b data-vb-contar="${Number(jogo.saldo)}" data-vb-chave="moedas-${sid}">${Number(jogo.saldo).toLocaleString("pt-BR")}</b><small>moedas</small></span><span title="Níveis de conquista">${escritorioFichaIcone("estrela")}<b>${conquistas ?? 0}</b><small>conquistas</small></span><span title="Móveis no inventário">${escritorioFichaIcone("caixa")}<b>${moveis}</b><small>móveis</small></span>${rk?.posicao ? `<span class="rk" title="Ranking da semana" role="button" tabindex="0" onclick="abrirRankingEscritorio('geral')">${escritorioIcone("ranking")}<b>${rk.posicao}º</b><small>na semana</small></span>` : ""}</div>` : pub === null ? '<small class="ofc-nota" role="alert">Não deu para carregar moedas e inventário agora.</small>' : ""}</div>
<button type="button" class="ofc-x" onclick="this.closest('dialog').close()" aria-label="Fechar">×</button></div>
${vitrine.length ? `<div class="ofc-hud-vitrine" aria-label="Troféus em destaque">${vitrine.map((v) => `<span class="n${v.nivel}" title="${safeText(v.nome)}">${escritorioMiniaturaHtml(v.classe)}</span>`).join("")}</div>` : ""}
<div class="ofc-hud-abas" role="tablist" aria-label="Ficha">${abas.map(([k, r]) => `<button type="button" role="tab" aria-selected="${k === aba}" onclick="escolherAbaFichaEscritorio('${sid}','${k}')">${r}</button>`).join("")}</div>
<div class="ofc-hud-corpo" role="tabpanel">${corpo}</div>
<div class="ofc-ficha-acoes">${quarto ? `<button type="button" class="ofc-secundario" onclick="${fechar}escritorioIrParaAmbiente('${safeText(quarto.id)}')">${eu ? "Ir para o meu quarto" : "Entrar no quarto"}</button>` : ""}${!eu && online ? `<button type="button" class="ofc-secundario" onclick="${fechar}chamarParaSalaEscritorio('${sid}')">Chamar para cá</button><button type="button" class="ofc-secundario" onclick="${fechar}convidarConversaEscritorio('${sid}')">Convidar para conversar</button>` : ""}${eu ? `<button type="button" class="ofc-secundario" onclick="${fechar}personalizarEscritorio()">Personalizar aparência</button>${escritorioMinhaMesa() ? `<button type="button" class="ofc-secundario" onclick="${fechar}abrirEstiloSalaEscritorio()">Piso e paredes da sala</button>` : ""}` : `<button type="button" class="ofc-secundario" onclick="${fechar}abrirRecadosEscritorio('${sid}')">Deixar recado</button>${online ? `<button type="button" class="ofc-secundario" onclick="${fechar}escritorioIrAte('${sid}')">Ir até</button>` : ""}<button type="button" class="ofc-secundario" onclick="${fechar}abrirPresenteEscritorio('${sid}')">Dar um móvel de presente</button>`}</div>`;
  if (!d.open) d.showModal();
  if (typeof vbAnimarContagens === "function") vbAnimarContagens(d);
  if (!semAtualizar) carregarPerfilJogoEscritorio(id, () => { if (d.open) abrirFichaEscritorio(id, true); });
  // Pontos e marcos mudam com o trabalho do dia: a ficha busca o estado atual
  // ao abrir (a própria pessoa; ou outra, para quem administra).
  if (veNumeros && !semAtualizar && !b.demo && typeof escritorioApi === "function")
    escritorioApi("economia", null, eu ? null : { pessoa: String(id) }).then((r) => {
      if (!r?.economia) return;
      if (eu) escritorio.base.economia = { ...r.economia, loja: r.economia.loja || escritorio.base.economia?.loja };
      if (eu) escritorioCelebrarSeMudou();
      else (escritorio.fichas ||= {})[String(id)] = r.economia;
      if (d.open) abrirFichaEscritorio(id, true);
    }).catch(() => { if (!eu) (escritorio.fichas ||= {})[String(id)] = null; if (d.open) abrirFichaEscritorio(id, true); });
  // Nomes dos móveis vêm do catálogo do editor; carrega na primeira vez.
  if ((marcos?.some((m) => m.moveis?.length) || jogo?.inventario?.length) && typeof escritorioCatalogo !== "undefined" && !escritorioCatalogo && typeof carregarCatalogoEscritorio === "function")
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
  // Duas abas: Piso e paredes (pintar) e Planta e luz (formato e luz).
  const modoPlanta = escritorio.catalogoCategoria === "Planta";
  if (modoPlanta && !["planta", "luz"].includes(pin.ferramenta)) pin.ferramenta = "planta";
  if (!modoPlanta && ["planta", "luz"].includes(pin.ferramenta)) pin.ferramenta = "piso";
  const piso = (id) => { const c = ESCRITORIO_PLANTA.PISO[id || a.pisoPadrao]; return c ? `repeating-conic-gradient(${c[0]} 0 25%,${c[1]} 0 50%) 0 0/16px 16px` : "#333"; };
  const amostraParede = (e) => ({ a: `linear-gradient(${a.corPadrao} 0 12%,#2b2d36 12%)`, b: pin.cor || a.corPadrao, c: "repeating-linear-gradient(#8a4733 0 7px,#3b1f17 7px 8px)", d: "repeating-linear-gradient(90deg,#7a5235 0 9px,#4a2f1c 9px 10px)", e: "#6e7077", f: "linear-gradient(135deg,#cfeaff,#7fb6e0)", g: `repeating-linear-gradient(90deg,${pin.cor || a.corPadrao} 0 6px,#00000040 6px 12px)`, h: "repeating-linear-gradient(#e9edf2 0 9px,#b8c0ca 9px 10px),#e9edf2" }[e]);
  const ferr = (id, nome, dica) => `<button type="button" aria-pressed="${pin.ferramenta === id}" onclick="escritorioPincel().ferramenta='${id}';renderEscritorio()" title="${dica}">${nome}</button>`;
  return `<div class="ofc-cats ofc-ferramentas">${modoPlanta
    ? ferr("planta", "Planta", "Desenhe o formato do quarto: tire piso ou crie patamares") + ferr("luz", "Luz", "Luz ambiente do quarto, como o regulador de luz do Habbo")
    : ferr("piso", "Pintar piso", "Clique ou arraste nos ladrilhos da sua sala") + ferr("balde", "Piso inteiro", "Troca o piso da sala toda de uma vez") + ferr("parede", "Pintar parede", "Clique no trecho da parede")}</div>
${pin.ferramenta === "planta" ? `<p class="ofc-nota">Clique ou arraste nos ladrilhos para mudar o formato do quarto, como no editor de planta do Habbo. A porta e a escada ficam onde estão. Vale ao clicar em Salvar.</p><h4>Ladrilho</h4><div class="ofc-cats ofc-ferramentas">${ESCRITORIO_FORMAS_PLANTA.map(([id, nome, dica]) => `<button type="button" aria-pressed="${(pin.forma || "p") === id}" onclick="escritorioPincel().forma='${id}';renderEscritorio()" title="${dica}">${nome}</button>`).join("")}</div>${(pin.forma || "p") === "n" ? `<label class="ofc-opcao-quarto">Altura do ladrilho (blocos)<input type="number" min="1" max="35" step="1" value="${Number(pin.nivel) || 1}" onchange="escritorioPincel().nivel=Math.max(1,Math.min(35,Math.round(Number(this.value)||1)))"></label><p class="ofc-nota">Como no Habbo: de um ladrilho ao vizinho só se sobe até um bloco e meio. Para chegar ao alto, faça degraus de 1 em 1; descer pode de qualquer altura.</p>` : ""}<div class="ofc-ficha-acoes"><button type="button" class="ofc-secundario" onclick="plantaOriginalEscritorio()">Voltar à planta escolhida</button></div><h4>Porta</h4><div class="ofc-cats ofc-ferramentas">${[["baixo", "Embaixo"], ["direita", "À direita"]].map(([id, nome]) => `<button type="button" aria-pressed="${a.porta === id}" onclick="mudarPortaEscritorio('${id}')">${nome}</button>`).join("")}</div>${escritorioOpcoesQuartoHtml(a)}<p class="ofc-nota">A altura de um trecho só muda em Pintar parede → Altura.</p><h4>Paredes</h4><div class="ofc-cats ofc-ferramentas"><button type="button" aria-pressed="${!a.semParedes}" onclick="estiloSalaEscritorio('sala_sem_paredes',false)">Com paredes</button><button type="button" aria-pressed="${Boolean(a.semParedes)}" onclick="estiloSalaEscritorio('sala_sem_paredes',true)" title="Tira as paredes do quarto para você construir as suas com blocos, como uma maquete">Sem paredes (maquete)</button></div><p class="ofc-erro" id="office-estilo-erro" role="alert"></p>` : pin.ferramenta === "luz" ? `<p class="ofc-nota">A luz tinge o quarto inteiro, como o regulador de luz do Habbo. Muda na hora para todos, sem precisar de Salvar.</p><h4>Luz do quarto</h4><div class="ofc-amostras">${ESCRITORIO_LUZES_SALA.map(([id, nome, cor]) => `<button type="button" aria-pressed="${(escritorioPerfilDecoracao()?.sala_luz || "") === id}" onclick="estiloSalaEscritorio('sala_luz','${id}')"><i style="background:${cor}"></i><span>${nome}</span></button>`).join("")}</div><p class="ofc-erro" id="office-estilo-erro" role="alert"></p>` : `
<p class="ofc-nota">${pin.ferramenta === "parede" ? "Escolha estilo, altura e cor e clique no trecho de parede que quer trocar (ou no piso encostado nela). Um clique muda um trecho; arraste para fazer vários." : pin.ferramenta === "balde" ? "Toque num piso: a sala inteira muda (os ladrilhos pintados à mão saem)." : "Escolha o piso e clique ou arraste nos ladrilhos da sua sala."} Muda na hora para todos, sem precisar de Salvar.</p>
${pin.ferramenta === "parede" ? `<h4>Estilo da parede</h4><div class="ofc-amostras ofc-amostras-parede">${ESCRITORIO_ESTILOS_PAREDE.map(([id, nome]) => `<button type="button" aria-pressed="${pin.estilo === id}" onclick="escritorioPincel().estilo='${id}';renderEscritorio()"><i style="background:${amostraParede(id)}">${typeof MAPA_ESTILO_TEXTURA !== "undefined" && MAPA_ESTILO_TEXTURA[id] ? `<img class="ofc-arte" alt="" data-arte="${MAPA_ESTILO_TEXTURA[id]}">` : ""}</i><span>${nome}</span></button>`).join("")}</div>
<h4>Altura</h4><div class="ofc-cats ofc-ferramentas">${[["0", "Baixa"], ["1", "Média"], ["2", "Alta"]].map(([h, n]) => `<button type="button" aria-pressed="${pin.altura === h}" onclick="escritorioPincel().altura='${h}';renderEscritorio()">${n}</button>`).join("")}</div>
<h4>Cor (Padrão, Lisa e Listrada)</h4><div class="ofc-amostras cores">${ESCRITORIO_PAREDES_SALA.map((c) => `<button type="button" aria-pressed="${pin.cor === c}" onclick="escritorioPincel().cor='${c}';renderEscritorio()" aria-label="${c ? "Cor " + c : "Cor da sala"}"><i style="background:${c || a.corPadrao}"></i>${c ? "" : "<span>Da sala</span>"}</button>`).join("")}</div>
<div class="ofc-ficha-acoes"><button type="button" class="ofc-secundario" onclick="pintarTodasParedesEscritorio()">Aplicar em todas as paredes</button><button type="button" class="ofc-secundario" onclick="limparPinturaEscritorio('sala_paredes')">Paredes como eram</button></div>`
  : `${pin.ferramenta === "piso" ? escritorioPisosAcervoHtml() : ""}<h4>Piso</h4><div class="ofc-amostras">${ESCRITORIO_PISOS_SALA.map(([id, nome]) => `<button type="button" aria-pressed="${pin.ferramenta === "balde" ? (escritorioPerfilDecoracao()?.sala_piso || "") === id : pin.piso === id}" onclick="${pin.ferramenta === "balde" ? `estiloSalaEscritorio('sala_piso','${id}',true)` : `escritorioPincel().piso='${id}';renderEscritorio()`}" aria-label="Piso ${nome}"><i style="background:${piso(id)}"></i><span>${nome}</span></button>`).join("")}</div>
<div class="ofc-ficha-acoes"><button type="button" class="ofc-secundario" onclick="limparPinturaEscritorio('sala_pisos')">Tirar a pintura do piso</button></div>`}
<p class="ofc-erro" id="office-estilo-erro" role="alert"></p>`}`;
}
// O que o pincel pega no ponto (x, y do mapa; fx, fy com a fração): a
// prévia no mapa e o clique usam o mesmo alvo (Paulo, 20/10/2026: ver antes o
// que vai ser pintado). null: fora da própria sala ou ferramenta sem pincel.
function escritorioAlvoDoPincel(x, y, fx = x + 0.5, fy = y + 0.5) {
  const mesa = escritorioMinhaMesa(), pin = escritorioPincel();
  // Só de dentro do próprio quarto (as coordenadas são as dele).
  if (!mesa || escritorio.quarto !== mesa.ambiente.id || pin.ferramenta === "luz" || pin.ferramenta === "balde") return null;
  const a = mesa.ambiente, lx = x - a.x0, ly = y - a.y0, L = ESCRITORIO_QUARTO_MAX, { w, h } = escritorioDimQuarto(a);
  if (pin.ferramenta === "parede") {
    // Clique na própria parede ("não dá pra mudar só uma"): o ponto da parede
    // do fundo cai, na projeção do mapa, atrás do quarto, na diagonal da
    // coluna (x − y); o da parede esquerda, na da linha (y − x).
    let lado, k;
    if (lx < 0 || ly < 0) {
      const t = escritorioTrechoDaParede(fx - a.x0, fy - a.y0, w, h);
      if (!t) return null;
      [lado, k] = t;
    } else {
      if (lx >= w || ly >= h) return null;
      // No piso: a parede mais perto do ponto, entre as que encostam no ladrilho.
      const ux = fx - a.x0, uy = fy - a.y0;
      const lados = [[0, uy, ly === 0], [1, ux, lx === 0], [2, h - uy, ly === h - 1], [3, w - ux, lx === w - 1]]
        .filter(([l, , encosta]) => encosta && escritorioTrechoExiste(a, l * L + (l % 2 ? ly : lx)))
        .sort((m, n) => m[1] - n[1]);
      if (!lados.length) return null;
      lado = lados[0][0]; k = lado % 2 ? ly : lx;
    }
    return escritorioTrechoExiste(a, lado * L + k) ? { tipo: "parede", a, lado, k, i: lado * L + k, w, h } : null;
  }
  if (lx < 0 || ly < 0 || lx >= w || ly >= h) return null;
  if (pin.ferramenta === "planta") return { tipo: "planta", a, x0: lx, y0: ly, w: 1, h: 1 };
  if (pin.ferramenta === "piso" && pin.movel) {
    // Piso do acervo: encaixa na grade do próprio tamanho; sem o tamanho ainda, espera.
    const d = escritorioDimPiso(pin.movel);
    if (!d.pronto) return { tipo: "espera", a };
    const p = escritorioEncaixePiso(lx, ly, d, w, h);
    return { tipo: "acervo", a, x0: p.x, y0: p.y, w: d.x, h: d.y };
  }
  if (pin.ferramenta === "piso") return { tipo: "piso", a, x0: lx, y0: ly, w: 1, h: 1 };
  return null;
}
// Pinta um ladrilho ou trecho de parede da própria sala (x, y do mapa).
function pintarNaSalaEscritorio(x, y, fx = x + 0.5, fy = y + 0.5) {
  const alvo = escritorioAlvoDoPincel(x, y, fx, fy), pin = escritorioPincel(), L = ESCRITORIO_QUARTO_MAX;
  if (!alvo) return false;
  if (alvo.tipo === "espera") return true;
  const a = alvo.a;
  if (alvo.tipo === "parede") return pintarTrechoEscritorio(a, alvo.i);
  if (alvo.tipo === "planta") return formaNaSalaEscritorio(a, alvo.x0, alvo.y0, escritorioCodigoDaForma(pin), x, y);
  if (alvo.tipo === "acervo") {
    // Piso do acervo (água, pedras, mosaico…): é um móvel rente ao chão;
    // troca as peças de piso que estavam na área (Paulo, 20/10/2026: "clico
    // num quadrado e pinta vários em vários lugares"). Vale ao clicar em Salvar.
    const e = escritorio.edicao;
    if (!e || e.camada !== a.id) return false;
    const pisos = new Set((escritorioCatalogo || []).filter((m) => m.categoria === "Pisos do acervo").map((m) => m.classe));
    const { x0, y0 } = alvo;
    const cobre = (it) => { const o = escritorioDimPiso(it[0]); return it[1] < x0 + alvo.w && it[1] + o.x > x0 && it[2] < y0 + alvo.h && it[2] + o.y > y0; };
    if (e.itens.some((it) => it[0] === pin.movel && it[1] === x0 && it[2] === y0)) return true;
    for (let i = e.itens.length - 1; i >= 0; i--) if (pisos.has(e.itens[i][0]) && cobre(e.itens[i])) e.itens.splice(i, 1);
    e.itens.push([pin.movel, x0, y0, 0, 0, 0]);
    escritorioEditorMudou();
    return true;
  }
  // Piso de cor: um ladrilho.
  const i = alvo.y0 * L + alvo.x0;
  const pisos = escritorioPisosDoPerfil(escritorioPerfilDecoracao().sala_pisos), atual = pisos.length === L * L ? pisos : "0".repeat(L * L);
  const cod = Math.max(0, ESCRITORIO_PISOS_SALA.findIndex(([id]) => id === pin.piso)).toString(16);
  if (atual[i] === cod) return true;
  escritorioAlterarDecoracao({ sala_pisos: atual.slice(0, i) + cod + atual.slice(i + 1) });
  escritorioPinturaMudou();
  return true;
}
// Prévia do pincel: a área que o clique vai pintar, destacada no mapa.
function previaPincelEscritorio(x, y, fx, fy) {
  const alvo = escritorioAlvoDoPincel(x, y, fx, fy);
  if (!alvo || alvo.tipo === "espera") return escritorio.mapa?.pincel?.(null);
  const { a } = alvo;
  escritorio.mapa?.pincel?.(alvo.tipo === "parede"
    ? { parede: { lado: alvo.lado, k: alvo.k, x0: a.x0, y0: a.y0, w: alvo.w, h: alvo.h } }
    : { piso: { x0: a.x0 + alvo.x0, y0: a.y0 + alvo.y0, w: alvo.w, h: alvo.h } });
}
// Editor de planta livre: troca o ladrilho (piso, patamar ou sem piso) na
// edição em curso; salva junto com os móveis.
// Como o editor de planta do Habbo: chão, altura de 1 a 35 (1 = um bloco; de
// um ladrilho ao vizinho sobe-se até 1,5, então de 1 em 1 é escada) e sem piso.
const ESCRITORIO_FORMAS_PLANTA = [["p", "Chão", "Piso no nível do chão"], ["n", "Altura", "Ladrilho na altura escolhida (1 a 35 blocos)"], ["v", "Sem piso", "Tira o ladrilho (vira vazio)"], ["0", "Como na planta", "Volta o ladrilho ao da planta escolhida"]];
// Opções do quarto do Habbo (configurações do quarto e editor de planta).
const ESCRITORIO_ESPESSURAS = [["-2", "Finíssima"], ["-1", "Fina"], ["0", "Normal"], ["1", "Grossa"]];
function escritorioCodigoDaForma(pin) {
  if (pin.forma === "n") return escritorioCodigoDoNivel(Math.max(1, Math.min(ESCRITORIO_ALTURA_PLANTA_MAX, Math.round(Number(pin.nivel) || 1))));
  return pin.forma || "p";
}
function escritorioOpcoesQuartoHtml(a) {
  const p = escritorioPerfilDecoracao() || {}, sel = (campo, opcoes, atual, rotulo) =>
    `<label class="ofc-opcao-quarto">${rotulo}<select onchange="estiloSalaEscritorio('${campo}', this.value === '' ? '' : Number(this.value))">${opcoes.map(([v, n]) => `<option value="${v}"${String(atual) === v ? " selected" : ""}>${n}</option>`).join("")}</select></label>`;
  const alturas = [["", "Padrão"], ...Array.from({ length: 16 }, (_, i) => [String(i), `+${i} ${i === 1 ? "bloco" : "blocos"}`])];
  return `<h4>Paredes e piso</h4><div class="ofc-opcoes-quarto">${sel("sala_espessura_parede", ESCRITORIO_ESPESSURAS, p.sala_espessura_parede ?? 0, "Espessura da parede")}${sel("sala_espessura_piso", ESCRITORIO_ESPESSURAS, p.sala_espessura_piso ?? 0, "Espessura do piso")}${sel("sala_altura_parede", alturas, p.sala_altura_parede >= 0 ? p.sala_altura_parede : "", "Altura da parede")}</div>`;
}
function formaNaSalaEscritorio(a, lx, ly, forma, x, y) {
  const e = escritorio.edicao;
  if (!e || e.camada !== a.id) return false;
  const base = escritorio.base?.quartos?.plantas?.find((p) => p.id === a.planta);
  if (!base) return false;
  const erro = (texto) => { const el = document.getElementById("office-estilo-erro"); if (el) el.textContent = texto; return true; };
  if (escritorioLadrilhoFixo(base, lx, ly)) return erro("A porta e a escada não mudam de lugar.");
  const L = ESCRITORIO_QUARTO_MAX, atual = e.celdas !== undefined ? e.celdas : (ESCRITORIO_CELDAS_LIVRES.test(a.celdasLivres || "") ? a.celdasLivres : "0".repeat(L * L));
  const i = ly * L + lx;
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
  e.celdas = "0".repeat(ESCRITORIO_QUARTO_MAX * ESCRITORIO_QUARTO_MAX);
  if (e.itens.some((it) => escritorioNivelQuarto(a, it[1], it[2]) < 0)) { e.celdas = undefined; return escritorioAviso("Tire os móveis dos ladrilhos que somem antes de voltar à planta."); }
  escritorioEditorMudou();
  escritorioRedesenharMapa();
}
// Um trecho de parede (índice lado × L + posição) com o pincel atual.
function pintarTrechoEscritorio(a, i) {
  const pin = escritorioPincel(), L = ESCRITORIO_QUARTO_MAX;
  if (!escritorioTrechoExiste(a, i)) return false;
  const paredes = escritorioParedesDoPerfil(escritorioPerfilDecoracao().sala_paredes), atual = paredes.length === L * 12 ? paredes : "-00".repeat(L * 4);
  const cod = pin.estilo + Math.max(0, ESCRITORIO_PAREDES_SALA.indexOf(pin.cor)).toString(16) + pin.altura;
  if (atual.slice(i * 3, i * 3 + 3) === cod) return true;
  escritorioAlterarDecoracao({ sala_paredes: atual.slice(0, i * 3) + cod + atual.slice(i * 3 + 3) });
  escritorioPinturaMudou();
  return true;
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
function escritorioPinturaMudou(doDesfazer = false) {
  // Cada pincelada vira um passo do ⌘Z da construção (o desfazer não cria passo).
  const ed = escritorio.edicao;
  if (!doDesfazer && ed?.passos) { const foto = escritorioFotoEdicao(ed); if (foto !== ed.passos.at(-1)) { ed.passos.push(foto); ed.futuro = []; if (ed.passos.length > 80) ed.passos.shift(); } }
  if (ed && typeof renderBarraEditorEscritorio === "function") renderBarraEditorEscritorio();
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
  if (escritorio.edicao && ["Sala", "Planta"].includes(escritorio.catalogoCategoria)) renderEscritorio();
  escritorioAviso(campo === "sala_piso" ? "Piso da sala trocado." : campo === "sala_luz" ? "Luz do quarto trocada." : campo === "sala_porta" ? "Porta trocada de lugar." : campo === "sala_sem_paredes" ? (valor ? "Paredes tiradas: construa as suas com blocos." : "Paredes de volta.") : campo === "sala_espessura_parede" ? "Espessura da parede trocada." : campo === "sala_espessura_piso" ? "Espessura do piso trocada." : campo === "sala_altura_parede" ? "Altura da parede trocada." : "Cor das paredes trocada.");
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

// Tamanho de cada piso do acervo, em ladrilhos (da arte; 1×1 até carregar).
const ESCRITORIO_DIM_PISOS = new Map();
function escritorioDimPiso(classe) {
  if (!ESCRITORIO_DIM_PISOS.has(classe)) {
    ESCRITORIO_DIM_PISOS.set(classe, { x: 1, y: 1, pronto: false });
    // Só os dados da peça (o tamanho), sem esperar a imagem.
    fetch(mapaArquivo(classe + ".json"), { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : Promise.reject())).then((dados) => { const d = mapaDimensoes(dados, 0); ESCRITORIO_DIM_PISOS.set(classe, { x: Math.max(1, Math.round(d.x)), y: Math.max(1, Math.round(d.y)), pronto: true }); })
      .catch(() => ESCRITORIO_DIM_PISOS.set(classe, { x: 1, y: 1, pronto: true }));
  }
  return ESCRITORIO_DIM_PISOS.get(classe);
}
// Pisos do acervo (com animação, como água e grama): escolha um e pinte.
function escritorioPisosAcervoHtml() {
  const pin = escritorioPincel();
  const lista = (escritorioCatalogo || []).filter((m) => m.categoria === "Pisos do acervo");
  if (!lista.length) { carregarCatalogoEscritorio?.(); return ""; }
  return `<h4>Pisos do acervo <small>(${lista.length}; ficam ao clicar em Salvar)</small></h4><div class="ofc-moveis ofc-pisos-acervo">${lista.map((m) => `<button type="button" class="ofc-movel" aria-pressed="${pin.movel === m.classe}" onclick="escritorioDimPiso('${safeText(m.classe)}');escritorioPincel().movel=escritorioPincel().movel==='${safeText(m.classe)}'?'':'${safeText(m.classe)}';renderEscritorio()" title="${safeText(escritorioNomeMovel(m))}"><img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(m.classe)}.png?size=64" alt="" onerror="miniaturaLocalEscritorio(this,'${safeText(m.classe)}')"><span>${safeText(escritorioNomeMovel(m))}</span>${m.anima ? '<em class="ofc-giro">animado</em>' : ""}</button>`).join("")}</div>
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

// ---------------------------------------------------------------------------
// Perfil do jogo aberto a toda a equipe (decisão do Paulo, 19/10/2026): cada
// um vê o personagem do outro "upando" (nível, XP, moedas, marcos e móveis),
// sem ranking comparativo, para não virar competição (Paulo, 19/10/2026).
// Parte do jogo na ficha de qualquer pessoa: moedas, nível, conquistas e o
// inventário de móveis.
function carregarPerfilJogoEscritorio(id, aoTerminar) {
  const k = String(id);
  (escritorio.perfisPublicos ||= {});
  if (escritorio.perfisPublicos[k] && Date.now() - (escritorio.perfisPublicos[k].em || 0) < 30e3) return;
  escritorioApi("perfil-publico", null, { pessoa: k })
    .then((r) => { escritorio.perfisPublicos[k] = { ...(r?.perfil || { disponivel: false }), em: Date.now() }; })
    .catch(() => { escritorio.perfisPublicos[k] = null; })
    .finally(() => aoTerminar?.());
}

// Quarto individual de uma pessoa (o dono vem do servidor, em base.salas).
function escritorioQuartoDe(id) {
  const sala = (escritorio.base?.salas || []).find((s) => String(s.pessoa_id) === String(id));
  return sala ? ESCRITORIO_PLANTA.ambientes.find((a) => a.id === sala.id) || null : null;
}

// ---------------------------------------------------------------------------
// Inventário (como o do Habbo): os seus móveis a qualquer hora, fora da
// edição, com colocar no quarto, dar de presente e trocar com um colega.
// Trocas pelo servidor (server/escritorio-social.js): só unidades guardadas.
function escritorioNomeDaClasse(classe) {
  const m = (typeof escritorioCatalogo !== "undefined" && escritorioCatalogo || []).find((x) => x.classe === classe);
  return typeof escritorioNomeMovel === "function" ? escritorioNomeMovel(m || { classe, nome: classe }) : classe;
}
function escritorioMiniaturaHtml(classe) {
  return `<img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(classe)}.png?size=64" alt="" onerror="typeof miniaturaLocalEscritorio==='function'&&miniaturaLocalEscritorio(this,'${safeText(classe)}')">`;
}
// Cada móvel seu: quantos tem, quantos estão no quarto e quantos guardados.
function escritorioMeuInventario() {
  const sala = escritorioDonos().get(escritorio.base?.eu)?.id;
  const camadas = escritorio.base?.mapa?.camadas || {};
  const colocados = new Map(), andar1 = new Map();
  for (const c of [sala, sala + "-andar-1"]) for (const it of camadas[c]?.itens || []) { colocados.set(it[0], (colocados.get(it[0]) || 0) + 1); if (c.endsWith("-andar-1")) andar1.set(it[0], (andar1.get(it[0]) || 0) + 1); }
  const essenciais = escritorio.base?.quartos?.essenciais || [];
  return (escritorio.base?.economia?.inventario || [])
    // Roupas ficam no Guarda-roupa do Provador, não na lista de móveis.
    .filter((i) => !essenciais.includes(i.classe) && !String(i.classe).startsWith("vybeimg_") && !String(i.classe).startsWith("roupa:") && Number(i.quantidade) > 0)
    .map((i) => { const total = Number(i.quantidade), noQuarto = Math.min(total, colocados.get(i.classe) || 0), segundo = Math.min(noQuarto, andar1.get(i.classe) || 0); return { classe: i.classe, total, noQuarto, terreo: noQuarto - segundo, segundo, guardados: total - noQuarto }; })
    .sort((a, b) => escritorioNomeDaClasse(a.classe).localeCompare(escritorioNomeDaClasse(b.classe), "pt-BR"));
}
async function carregarTrocasEscritorio(forcar = false) {
  const t = (escritorio.trocas ||= {});
  if (typeof carregarCatalogoEscritorio === "function" && typeof escritorioCatalogo !== "undefined" && !escritorioCatalogo) carregarCatalogoEscritorio().then(atualizarInventarioEscritorio);
  if (t.carregando || (!forcar && t.em && Date.now() - t.em < 20e3)) return;
  t.carregando = true; t.erro = "";
  try {
    const r = await escritorioApi("trocas");
    Object.assign(t, r.trocas || {}, { em: Date.now() });
  } catch (e) { t.erro = e.message || "Não deu para carregar as trocas."; }
  t.carregando = false;
  atualizarInventarioEscritorio();
}
function atualizarInventarioEscritorio() {
  if (typeof redesenharCatalogoJanelaEscritorio === "function") redesenharCatalogoJanelaEscritorio();
}
function escritorioListaTrocaHtml(itens) {
  return (itens || []).map(([c, n]) => `<li>${escritorioMiniaturaHtml(c)}<span>${safeText(escritorioNomeDaClasse(c))}${n > 1 ? ` ×${n}` : ""}</span></li>`).join("") || "<li><span>nada</span></li>";
}
// Trocas de móveis (propostas recebidas, enviadas e as últimas), mostradas na
// aba Inventário da janela do catálogo.
function escritorioTrocasHtml() {
  if (!escritorio.base) return "";
  const t = escritorio.trocas || {};
  const nomeDe = (id) => String((escritorio.base.equipe || []).find((p) => String(p.id) === String(id))?.nome || "Alguém").split(" ")[0];
  const recebidas = (t.recebidas || []).filter((x) => x.estado === "aberta");
  const enviadas = (t.enviadas || []).filter((x) => x.estado === "aberta");
  const recentes = [...(t.recebidas || []), ...(t.enviadas || [])].filter((x) => x.estado !== "aberta").slice(0, 5);
  const cartao = (x, recebida) => `<li class="ofc-troca"><div class="ofc-troca-topo"><b>${recebida ? `${safeText(nomeDe(x.de_pessoa))} propõe` : `Para ${safeText(nomeDe(x.para_pessoa))}`}</b><small>${new Date(x.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Bahia" })}</small></div>
<div class="ofc-troca-lados"><div><small>${recebida ? "Você recebe" : "Você dá"}</small><ul>${escritorioListaTrocaHtml(x.oferece)}</ul></div><div><small>${recebida ? "Você dá" : "Você recebe"}</small><ul>${escritorioListaTrocaHtml(x.pede)}</ul></div></div>
<div class="ofc-troca-acoes">${recebida ? `<button type="button" class="ofc-primario" onclick="responderTrocaEscritorio('${x.id}','aceitar',this)">Aceitar</button><button type="button" class="ofc-secundario" onclick="responderTrocaEscritorio('${x.id}','recusar',this)">Recusar</button>` : `<button type="button" class="ofc-secundario" onclick="responderTrocaEscritorio('${x.id}','cancelar',this)">Cancelar proposta</button>`}</div></li>`;
  const estado = { aceita: "Aceita", recusada: "Recusada", cancelada: "Cancelada" };
  return `<div class="ofc-inv-topo"><h4>Trocas</h4><button type="button" class="ofc-mini" onclick="abrirTrocaEscritorio()">Propor troca</button></div>
${t.erro ? `<p class="ofc-nota" role="alert">${safeText(t.erro)}</p>` : t.disponivel === false ? '<p class="ofc-nota">A troca de móveis aguarda a atualização do banco.</p>' : t.em ? "" : '<p class="ofc-nota">Carregando trocas…</p>'}
${recebidas.length ? `<ul class="ofc-trocas">${recebidas.map((x) => cartao(x, true)).join("")}</ul>` : t.em ? '<p class="ofc-nota">Nenhuma proposta para você agora.</p>' : ""}
${enviadas.length ? `<h5>Suas propostas</h5><ul class="ofc-trocas">${enviadas.map((x) => cartao(x, false)).join("")}</ul>` : ""}
${recentes.length ? `<h5>Últimos dias</h5><ul class="ofc-trocas-recentes">${recentes.map((x) => `<li>${estado[x.estado]} · ${String(x.de_pessoa) === String(escritorio.base.eu) ? `para ${safeText(nomeDe(x.para_pessoa))}` : `de ${safeText(nomeDe(x.de_pessoa))}`}</li>`).join("")}</ul>` : ""}`;
}
function colocarDoInventarioEscritorio(classe) {
  const camada = escritorioMinhaMesa()?.ambiente.id;
  if (!camada) return escritorioAviso("Você ainda não tem um quarto para decorar.");
  if (escritorio.edicao?.camada === camada) return escolherMovelEscritorio(classe);
  escritorio.colocarAoAbrir = classe;
  abrirEditorEscritorio(camada);
}
function escolherPresenteEscritorio(classe) {
  const equipe = (escritorio.base.equipe || []).filter((p) => String(p.id) !== String(escritorio.base.eu));
  openWorkflowModal(`<div class="workflow-kicker">Presente</div><h2 class="workflow-title">Dar ${safeText(escritorioNomeDaClasse(classe))} para quem?</h2>
<div class="workflow-actions ofc-teleporte">${equipe.map((p) => `<button type="button" class="workflow-secondary" onclick="darPresenteEscritorio('${safeText(String(p.id))}','${safeText(classe)}',this).then(()=>{carregarTrocasEscritorio(true);atualizarInventarioEscritorio();})">${safeText(p.nome)}</button>`).join("")}</div>
<p class="ofc-erro" id="office-presente-erro" role="alert"></p>
<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Fechar</button></div>`);
}
// Montar uma proposta: com quem, o que você dá (guardados) e o que pede (o
// inventário da pessoa, do perfil público; o servidor confere o guardado).
async function abrirTrocaEscritorio(para = null, classe = null) {
  const equipe = (escritorio.base.equipe || []).filter((p) => String(p.id) !== String(escritorio.base.eu));
  const f = (escritorio.trocaNova = { para: para || escritorio.trocaNova?.para || "", oferece: new Map(classe ? [[classe, 1]] : []), pede: new Map() });
  desenharTrocaEscritorio(equipe);
  if (f.para) await carregarInventarioDoOutroEscritorio(f.para, equipe);
}
async function carregarInventarioDoOutroEscritorio(id, equipe) {
  const f = escritorio.trocaNova;
  if (!f) return;
  f.para = String(id); f.pede = new Map(); f.deles = null;
  desenharTrocaEscritorio(equipe);
  await new Promise((r) => carregarPerfilJogoEscritorio(id, r));
  f.deles = (escritorio.perfisPublicos?.[String(id)]?.inventario || []).filter((i) => !(escritorio.base.quartos?.essenciais || []).includes(i.classe));
  desenharTrocaEscritorio(equipe);
}
function desenharTrocaEscritorio(equipe = (escritorio.base.equipe || []).filter((p) => String(p.id) !== String(escritorio.base.eu))) {
  const f = escritorio.trocaNova;
  if (!f) return;
  const meus = escritorioMeuInventario().filter((i) => i.guardados > 0);
  const linha = (lado, c, max) => { const n = f[lado].get(c) || 0; return `<li class="${n ? "sim" : ""}">${escritorioMiniaturaHtml(c)}<span>${safeText(escritorioNomeDaClasse(c))}</span><div class="ofc-qtd"><button type="button" aria-label="Menos" onclick="mudarItemTrocaEscritorio('${lado}','${safeText(c)}',-1,${max})" ${n ? "" : "disabled"}>−</button><b>${n}</b><button type="button" aria-label="Mais" onclick="mudarItemTrocaEscritorio('${lado}','${safeText(c)}',1,${max})" ${n >= max ? "disabled" : ""}>+</button></div></li>`; };
  const html = `<div class="workflow-kicker">Troca</div><h2 class="workflow-title">Propor troca</h2>
<label class="ofc-troca-com"><span>Com quem</span><select onchange="carregarInventarioDoOutroEscritorio(this.value)"><option value="">Escolha uma pessoa</option>${equipe.map((p) => `<option value="${safeText(String(p.id))}"${String(p.id) === f.para ? " selected" : ""}>${safeText(p.nome)}</option>`).join("")}</select></label>
<div class="ofc-troca-montar"><section><h3>Você dá</h3>${meus.length ? `<ul>${meus.map((i) => linha("oferece", i.classe, i.guardados)).join("")}</ul>` : '<p class="ofc-nota">Nenhum móvel guardado. Tire do quarto o que quiser trocar.</p>'}</section>
<section><h3>Você pede</h3>${!f.para ? '<p class="ofc-nota">Escolha com quem trocar.</p>' : !f.deles ? '<p class="ofc-nota">Carregando o inventário…</p>' : f.deles.length ? `<ul>${f.deles.map((i) => linha("pede", i.classe, Number(i.quantidade))).join("")}</ul>` : '<p class="ofc-nota">Essa pessoa ainda não tem móveis para trocar. Você pode só dar.</p>'}</section></div>
<p class="ofc-nota">A pessoa recebe a proposta no inventário dela e aceita ou recusa. Só vale com os móveis guardados (fora do quarto) dos dois lados.</p>
<p class="ofc-erro" id="office-troca-erro" role="alert"></p>
<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="escritorio.trocaNova=null;closeWorkflowModal()">Cancelar</button><button type="button" class="workflow-primary" onclick="enviarTrocaEscritorio(this)" ${f.para && (f.oferece.size || f.pede.size) ? "" : "disabled"}>Enviar proposta</button></div>`;
  // Redesenha no mesmo diálogo (sem piscar o fundo nem perder a rolagem).
  const modal = document.getElementById("workflow-modal");
  if (modal?.querySelector(".ofc-troca-montar")) { const y = modal.scrollTop; modal.innerHTML = html; modal.scrollTop = y; }
  else openWorkflowModal(html);
}
function mudarItemTrocaEscritorio(lado, classe, delta, max) {
  const f = escritorio.trocaNova;
  if (!f) return;
  const n = Math.max(0, Math.min(max, (f[lado].get(classe) || 0) + delta));
  if (n) f[lado].set(classe, n); else f[lado].delete(classe);
  desenharTrocaEscritorio();
}
async function enviarTrocaEscritorio(botao) {
  const f = escritorio.trocaNova;
  if (!f) return;
  botao.disabled = true;
  try {
    if (escritorio.base.demo) throw new Error("A demonstração não grava trocas.");
    const chave = (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g, "");
    const r = await escritorioApi("troca", { para: f.para, oferece: [...f.oferece], pede: [...f.pede], chave });
    Object.assign((escritorio.trocas ||= {}), r.trocas || {}, { em: Date.now() });
    escritorioEmitir("chat:bubble", { texto: ESCRITORIO_COMANDO + "trc=" + r.id + ":" + f.para });
    escritorio.trocaNova = null;
    closeWorkflowModal();
    escritorioAviso("Proposta enviada. Ela aparece no inventário da pessoa.");
    atualizarInventarioEscritorio();
  } catch (e) {
    botao.disabled = false;
    const erro = document.getElementById("office-troca-erro");
    if (erro) erro.textContent = e.message;
  }
}
async function responderTrocaEscritorio(id, acao, botao) {
  if (acao !== "aceitar" && acao !== "recusar" && acao !== "cancelar") return;
  if (botao) botao.disabled = true;
  try {
    const r = await escritorioApi("troca-responder", { id, acao });
    Object.assign((escritorio.trocas ||= {}), r.trocas || {}, { em: Date.now() });
    if (r.economia) escritorio.base.economia = { ...escritorio.base.economia, ...r.economia, loja: escritorio.base.economia?.loja };
    escritorioAviso(r.estado === "aceita" ? "Troca feita: os móveis já estão no seu inventário." : r.estado === "recusada" ? "Proposta recusada." : "Proposta cancelada.");
  } catch (e) {
    escritorioAviso(e.message);
    carregarTrocasEscritorio(true);
  }
  atualizarInventarioEscritorio();
}

// Alguém propôs uma troca para você (aviso pelo balão do chat, como o presente).
function trocaChegouEscritorio(id, v) {
  const [, para] = String(v || "").split(":");
  if (para !== String(escritorio.base?.eu) || escritorio.base?.demo) return;
  const nome = String((escritorio.online || []).find((o) => String(o.id) === String(id))?.nome || "Alguém").split(" ")[0];
  escritorioAviso(`${nome} propôs uma troca de móveis. Abra o Inventário para responder.`);
  carregarTrocasEscritorio(true);
}

// Ranking da semana (Paulo, 20/10/2026: competição saudável). Geral pelo % da
// própria meta, XP da semana, por atividade e a meta da agência; prêmios do
// pódio e o resultado da semana passada. Tudo vem do servidor (rota ranking).
const escritorioRanking = { aba: "geral", dados: null, erro: null };
const ESCRITORIO_FUNCAO_NOME = { criacao: "Criação", atendimento: "Atendimento", agendamento: "Agendamento", producao: "Produção", gestao: "Gestão" };
function abrirRankingEscritorio(aba) {
  if (aba) escritorioRanking.aba = aba;
  if (!document.getElementById("ofc-ranking")) {
    openWorkflowModal('<div class="ofc-ranking" id="ofc-ranking" role="dialog" aria-label="Ranking da semana"></div>');
    document.getElementById("workflow-modal")?.classList.add("ofc-ranking-janela");
  }
  pintarRankingEscritorio();
  carregarRankingEscritorio();
}
async function carregarRankingEscritorio() {
  try { escritorioRanking.dados = await escritorioApi("ranking"); escritorioRanking.erro = null; }
  catch (e) { escritorioRanking.erro = e.message; }
  pintarRankingEscritorio();
}
// Desenho de 20/10/2026 (Paulo: "UI e UX ruins"): pódio com os bonecos e os
// troféus, o cartão "Você" com o que falta para subir, a lista compacta, e as
// regras recolhidas em "Como funciona".
function escritorioRankingPerfil(id) {
  const b = escritorio.base;
  if (!b) return null;
  return String(id) === String(b.eu) ? escritorio.perfil : (b.equipe || []).find((p) => String(p.id) === String(id))?.perfil || null;
}
function escritorioRankingBoneco(id, acao = "std") {
  const perfil = escritorioRankingPerfil(id);
  if (!perfil || typeof mapaAvatarUrl !== "function") return "";
  const url = mapaAvatarUrl(mapaFigura(perfil), 3, acao, perfil.mao || "", 0, "sml", 3);
  return `<img class="ofc-rk-boneco" src="${safeText(url)}" alt="" width="64" height="110" loading="lazy">`;
}
function escritorioRankingTrofeu(classe) {
  return classe ? `<img class="ofc-rk-trofeu" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(classe)}.png?size=64" alt="" loading="lazy" onerror="typeof miniaturaLocalEscritorio==='function'&&miniaturaLocalEscritorio(this,'${safeText(classe)}')">` : "";
}
function pintarRankingEscritorio() {
  const el = document.getElementById("ofc-ranking");
  if (!el) return;
  const d = escritorioRanking.dados, aba = escritorioRanking.aba, eu = String(escritorio.base?.eu || "");
  const dataBr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
  const nome = (p) => String(p.nome || "").split(" ")[0];
  const rosto = (id, tam = 32) => { const u = escritorioCabecaUrl(id); return u ? `<img class="ofc-rk-rosto" src="${safeText(u)}" alt="" width="${tam}" height="${tam}" loading="lazy">` : `<span class="ofc-rk-rosto vazio" style="width:${tam}px;height:${tam}px"></span>`; };
  const hoje = typeof hojeDeVerdade === "function" ? hojeDeVerdade() : new Date().toISOString().slice(0, 10);
  const faltamDias = d?.fim ? Math.max(0, Math.round((Date.parse(d.fim) - Date.parse(hoje)) / 864e5)) : null;
  const fecha = faltamDias == null ? "" : faltamDias === 0 ? "fecha hoje à meia-noite" : faltamDias === 1 ? "fecha amanhã à meia-noite" : `fecha em ${faltamDias} dias`;
  const abas = [["geral", "Geral"], ["xp", "XP"], ["atividades", "Atividades"], ["tesouros", "Tesouros"], ["agencia", "Agência"]];
  const topo = `<header class="ofc-rk-cab"><span class="ofc-rk-icone" aria-hidden="true">${escritorioIcone("ranking")}</span><div><h2>Ranking da semana</h2><small>${d?.inicio ? `${dataBr(d.inicio)} a ${dataBr(d.fim)} · ${fecha}` : "zera toda segunda"}</small></div><button type="button" class="ofc-rk-x" onclick="closeWorkflowModal()" aria-label="Fechar">×</button></header>
<div class="ofc-rk-abas" role="tablist" aria-label="Rankings">${abas.map(([k, t]) => `<button type="button" role="tab" aria-selected="${aba === k}" onclick="escritorioRanking.aba='${k}';pintarRankingEscritorio()">${t}</button>`).join("")}</div>`;
  if (escritorioRanking.erro && !d) { el.innerHTML = topo + `<p class="ofc-nota" role="alert">Não deu para carregar o ranking: ${safeText(escritorioRanking.erro)} <button type="button" class="ofc-mini" onclick="carregarRankingEscritorio()">Tentar de novo</button></p>`; return; }
  if (!d) { el.innerHTML = topo + '<div class="ofc-rk-esqueleto" aria-label="Carregando"><i></i><i></i><i></i></div><div class="ofc-fm-carregando"><i></i><i></i><i></i></div>'; return; }
  if (!d.disponivel) { el.innerHTML = topo + `<div class="ofc-rk-vazio"><span aria-hidden="true">${escritorioIcone("ranking")}</span><b>O ranking ainda não começou</b><p>Ele aparece quando a contagem de pontos estiver ativa e zera toda segunda.</p></div>`; return; }
  const premio = (k) => d.premios.find((p) => p.chave === k);
  // Pódio: 2º, 1º, 3º, com o boneco de cada um em cima do degrau.
  const podio = (lista, valor, sub) => {
    const tres = lista.slice(0, 3);
    if (!tres.length) return '<p class="ofc-nota">Ninguém pontuou nesta semana ainda. O primeiro a entregar abre o pódio.</p>';
    const ordem = [tres[1], tres[0], tres[2]].filter(Boolean);
    return `<div class="ofc-rk-podio">${ordem.map((p) => { const pos = tres.indexOf(p) + 1, pr = premio("ranking_" + pos); return `<button type="button" class="ofc-rk-degrau p${pos}${p.id === eu ? " eu" : ""}" aria-expanded="${escritorioRanking.aberto === p.id}" onclick="abrirDetalheRankingEscritorio('${p.id}')"><div class="ofc-rk-figura">${escritorioRankingBoneco(p.id, pos === 1 ? "wav" : "std") || rosto(p.id, 56)}${escritorioRankingTrofeu(pr?.classe)}</div><b class="ofc-rk-dnome">${safeText(nome(p))}${p.id === eu ? " · você" : ""}</b><span class="ofc-rk-dvalor">${valor(p)}</span><small>${sub(p)}</small><div class="ofc-rk-bloco"><span>${pos}º</span>${pr ? `<em>+${pr.moedas} moedas · +${pr.pontos} XP</em>` : ""}</div></button>`; }).join("")}</div>${tres.some((p) => p.id === escritorioRanking.aberto) ? detalhe(tres.find((p) => p.id === escritorioRanking.aberto)) : ""}`;
  };
  // O que contou como entrega, quais peças e de onde veio o XP (abre ao clicar).
  const detalhe = (p) => {
    if (!p) return "";
    const regra = (k) => safeText(d.regras?.[k] || k);
    const contou = Object.entries(p.porRegra || {}).sort((a, b) => b[1] - a[1]);
    const xp = Object.entries(p.xpPor || {}).sort((a, b) => b[1] - a[1]);
    return `<div class="ofc-rk-detalhe"><div class="ofc-rk-det-col"><h5>Contou como entrega <small>${p.entregas} na semana · meta ${p.meta}</small></h5>${contou.length ? `<ul class="ofc-rk-det-lista">${contou.map(([k, n]) => `<li><span>${regra(k)}</span><b>${n}</b></li>`).join("")}</ul>` : '<p class="ofc-nota">Nenhuma entrega nesta semana ainda.</p>'}
<small class="ofc-rk-det-nota">A meta é a média semanal de entregas de ${safeText(nome(p))} nas últimas 8 semanas.</small></div>
<div class="ofc-rk-det-col"><h5>De onde veio o XP <small>${p.xp} XP na semana</small></h5>${xp.length ? `<ul class="ofc-rk-det-lista">${xp.map(([k, n]) => `<li><span>${regra(k)}</span><b>+${n} XP</b></li>`).join("")}</ul>` : '<p class="ofc-nota">Nada ainda.</p>'}</div>
${p.pecas?.length ? `<div class="ofc-rk-det-col largo"><h5>As entregas <small>${p.pecas.length < p.entregas ? `as ${p.pecas.length} mais recentes` : "da semana"}</small></h5><ul class="ofc-rk-det-pecas">${p.pecas.map((x) => `<li><time>${dataBr(x.dia)}</time><span><b>${safeText(x.titulo || "Sem título")}</b>${x.cliente ? `<small>${safeText(x.cliente)}</small>` : ""}</span><em>${regra(x.regra).replace(/ \(.*\)$/, "")}</em></li>`).join("")}</ul></div>` : ""}</div>`;
  };
  const linhas = (lista, valor, barra, desde = 3) => lista.length > desde ? `<ol class="ofc-rk-lista" start="${desde + 1}">${lista.slice(desde).map((p, k) => `<li class="${p.id === eu ? "eu" : ""}${escritorioRanking.aberto === p.id ? " aberto" : ""}" role="button" tabindex="0" aria-expanded="${escritorioRanking.aberto === p.id}" onclick="abrirDetalheRankingEscritorio('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirDetalheRankingEscritorio('${p.id}')}"><span class="ofc-rk-pos">${p.posicao === null ? "—" : desde + k + 1 + "º"}</span>${rosto(p.id)}<span class="ofc-rk-nome"><b>${safeText(nome(p))}</b><small>${safeText(ESCRITORIO_FUNCAO_NOME[p.funcao] || "")}</small></span><span class="ofc-rk-barra" aria-hidden="true"><i style="width:${Math.max(2, Math.min(100, barra(p)))}%"></i></span><span class="ofc-rk-valor">${valor(p)}</span></li>${escritorioRanking.aberto === p.id ? `<li class="ofc-rk-det-li">${detalhe(p)}</li>` : ""}`).join("")}</ol>` : "";
  let corpo = "";
  if (aba === "geral") {
    const lista = d.pessoas;
    const minha = lista.findIndex((p) => p.id === eu), eu_ = lista[minha];
    // O que falta para passar quem está logo acima (em entregas da própria meta).
    let dica = "";
    if (eu_) {
      const acima = lista[minha - 1];
      if (minha === 0 && eu_.entregas > 0) dica = "Você lidera a semana. Continue entregando para segurar o 1º lugar.";
      else if (acima) { const precisa = Math.max(1, Math.floor((acima.pct * eu_.meta) / 100) + 1 - eu_.entregas); dica = `Faltam <b>${precisa} ${precisa === 1 ? "entrega" : "entregas"}</b> para passar ${safeText(nome(acima))} (${acima.pct}%).`; }
      else dica = "Entregue a primeira peça da semana para entrar no ranking.";
    }
    const voce = eu_ ? `<section class="ofc-rk-voce"><span class="ofc-rk-voce-pos">${eu_.posicao ? eu_.posicao + "º" : "—"}</span>${rosto(eu_.id, 40)}<div><b>Você · ${eu_.pct}% da sua meta</b><small>${eu_.entregas} entregas de ${eu_.meta} da sua meta · ${eu_.xp} XP na semana</small><p>${dica} <button type="button" class="ofc-rk-link" onclick="abrirDetalheRankingEscritorio('${eu_.id}')">${escritorioRanking.aberto === eu_.id ? "Esconder" : "Ver o que contou"}</button></p></div><span class="ofc-rk-anel" style="--p:${Math.min(100, eu_.pct)}" aria-hidden="true"><i>${eu_.pct}%</i></span></section>` : "";
    corpo = `${voce}${podio(lista.filter((p) => p.posicao), (p) => `${p.pct}%`, (p) => `${p.entregas} entregas · meta ${p.meta}`)}${linhas(lista, (p) => `<b>${p.pct}%</b><small>${p.entregas} de ${p.meta} entregas</small>`, (p) => p.pct, Math.min(3, lista.filter((p) => p.posicao).length))}`;
  } else if (aba === "xp") {
    const lista = [...d.pessoas].sort((a, b) => b.xp - a.xp || b.moedas - a.moedas).map((p) => ({ ...p, posicao: p.xp ? 1 : null }));
    const max = Math.max(1, ...lista.map((p) => p.xp));
    corpo = `<p class="ofc-rk-legenda">XP e moedas do trabalho desta semana. Conquistas e prêmios não contam.</p>${podio(lista.filter((p) => p.xp), (p) => `${p.xp} XP`, (p) => `${p.moedas} moedas`).replace(/<em>[^<]*<\/em>/g, "")}${linhas(lista, (p) => `<b>${p.xp} XP</b><small>${p.moedas} moedas</small>`, (p) => (p.xp / max) * 100, Math.min(3, lista.filter((p) => p.xp).length))}`;
  } else if (aba === "atividades") {
    const blocos = d.atividades.map((a) => {
      const lista = d.pessoas.filter((p) => p.atividades?.[a.chave]).sort((x, y) => y.atividades[a.chave] - x.atividades[a.chave]);
      if (!lista.length) return "";
      const [lider, ...resto] = lista;
      return `<section class="ofc-rk-atividade"><h4>${safeText(a.nome)}</h4><div class="ofc-rk-lider${lider.id === eu ? " eu" : ""}">${rosto(lider.id, 44)}<span><b>${safeText(nome(lider))}</b><small>lidera</small></span><strong>${lider.atividades[a.chave]}</strong></div>${resto.length ? `<ol>${resto.slice(0, 4).map((p, k) => `<li class="${p.id === eu ? "eu" : ""}"><span>${k + 2}º</span>${rosto(p.id, 22)}<b>${safeText(nome(p))}</b><em>${p.atividades[a.chave]}</em></li>`).join("")}</ol>` : ""}</section>`;
    }).join("");
    corpo = blocos ? `<p class="ofc-rk-legenda">Quem mais fez cada tipo de trabalho nesta semana.</p><div class="ofc-rk-atividades">${blocos}</div>` : '<p class="ofc-nota">Ninguém fez nada contado nesta semana ainda.</p>';
  } else if (aba === "tesouros") {
    const pat = d.patrimonio || [];
    const ricos = [...pat].sort((a, b) => b.saldo - a.saldo), colec = [...pat].sort((a, b) => b.moveis - a.moveis || b.lendarios - a.lendarios || b.distintos - a.distintos);
    const coluna = (titulo, dica, lista, valor, sub) => `<section class="ofc-rk-tesouro"><h4>${titulo}</h4><small>${dica}</small><ol>${lista.map((p, i) => `<li class="${p.id === eu ? "eu" : ""}${i < 3 ? " top" + (i + 1) : ""}"><span class="ofc-rk-pos">${i + 1}º</span>${rosto(p.id, i < 3 ? 36 : 28)}<span class="ofc-rk-nome"><b>${safeText(nome(p))}</b><small>${sub(p)}</small></span><span class="ofc-rk-valor"><b>${valor(p)}</b></span></li>`).join("")}</ol></section>`;
    corpo = `<p class="ofc-rk-legenda">De todos os tempos, não só desta semana.</p><div class="ofc-rk-tesouros">${coluna("Mais rico", "VybeCoins na carteira agora", ricos, (p) => `${Number(p.saldo).toLocaleString("pt-BR")}`, (p) => "VybeCoins")}${coluna("Colecionador", "Móveis guardados e no quarto", colec, (p) => `${p.moveis}`, (p) => [`${p.distintos} diferentes`, p.lendarios ? `${p.lendarios} lendários` : "", p.trofeus ? `${p.trofeus} troféus` : ""].filter(Boolean).join(" · "))}</div>`;
  } else {
    const a = d.agencia, bonus = premio("meta_agencia"), faltam = Math.max(0, a.meta - a.pecas);
    const dias = Math.max(1, (faltamDias ?? 0) + 1), ritmo = Math.ceil(faltam / dias);
    corpo = `<section class="ofc-rk-agencia${a.bateu ? " bateu" : ""}"><div class="ofc-rk-ag-num"><strong>${a.pecas}</strong><span>de ${a.meta} peças</span></div><div class="ofc-rk-ag-barra" aria-hidden="true"><i style="width:${Math.min(100, a.pct)}%"></i></div><p>${a.bateu ? `<b>Meta batida!</b> No fechamento da semana todo mundo ganha` : `Faltam <b>${faltam} peças</b>, cerca de ${ritmo} por dia até domingo. Se a agência bater, todo mundo ganha`} ${bonus ? `<b>+${bonus.moedas} moedas e +${bonus.pontos} XP</b>` : "o bônus"}.</p><div class="ofc-rk-equipe">${d.pessoas.map((p) => `<span title="${safeText(nome(p))}: ${Object.entries(p.atividades || {}).filter(([k]) => k.startsWith("peca_")).reduce((t, [, n]) => t + n, 0)} peças">${rosto(p.id, 30)}</span>`).join("")}</div><small>A meta é a média de peças por semana nas últimas 8 semanas. Cada peça conta uma vez, não importa quantas pessoas trabalharam nela.</small></section>`;
  }
  const anterior = d.anterior?.podio?.length ? `<div class="ofc-rk-anterior"><small>Semana passada</small>${[...d.anterior.podio].sort((x, y) => x.posicao - y.posicao).map((p) => `<span>${p.posicao}º ${rosto(p.id, 22)} ${safeText(nome(p))}</span>`).join("")}${d.anterior.agenciaBateu ? '<span class="ok">Agência bateu a meta</span>' : ""}</div>` : "";
  const como = `<details class="ofc-rk-como"><summary>Como funciona</summary><ul><li><b>Geral:</b> vale o % da <b>sua própria meta</b> (a média das suas entregas nas últimas 8 semanas). Assim Criação, Produção, Atendimento, Agendamento e Gestão competem por igual. Empate: mais XP na semana.</li><li><b>Prêmios no domingo à meia-noite:</b> ${["ranking_1", "ranking_2", "ranking_3"].map((k, i) => { const p = premio(k); return p ? `${i + 1}º ${p.moedas} moedas e ${p.pontos} XP` : ""; }).filter(Boolean).join(" · ")}, cada um com o troféu da semana para o quarto.</li><li><b>Agência:</b> se a equipe bater a meta de peças, todo mundo ganha o bônus.</li><li><b>Entrega</b> é cada trabalho seu que conta na meta: a sua parte de cada peça concluída (feita, captada, aprovada como DA, agendada, da carteira ou da agência), as demandas do quadro de Solicitações finalizadas e os briefings. Clique em alguém para ver quais foram e de onde veio o XP.</li><li><b>Tesouros:</b> quem tem mais VybeCoins e mais móveis, de todos os tempos.</li><li>Zera toda segunda. Todo mundo vê o ranking de todo mundo.</li></ul></details>`;
  el.innerHTML = topo + `<div class="ofc-rk-corpo">${corpo}${anterior}${como}</div>`;
}

function abrirDetalheRankingEscritorio(id) {
  escritorioRanking.aberto = escritorioRanking.aberto === String(id) ? null : String(id);
  pintarRankingEscritorio();
}

// Janela Conquistas (Paulo, 20/10/2026: "ícone de Conquistas na lateral que
// mostra todas as conquistas e o que cada uma dá"): cada escada com os quatro
// níveis, a meta, o troféu e as moedas e o XP de cada um, e o seu progresso.
const ESCRITORIO_GRUPOS_CONQUISTA = [
  ["Entregas por tipo", "As peças que você fez.", ["entregas", "cards", "carrosseis", "reels", "stories", "fotografias", "videos"]],
  ["Produção", "Gravações e o que foi captado.", ["gravacoes", "fotos_captadas", "videos_captados"]],
  ["Ritmo e qualidade", "Prazo, aprovação de primeira, sequência e meta.", ["adiantado", "deprimeira", "embalo", "semana", "filaemdia", "meta", "clientes", "nivel"]],
  ["Agendamento", "Peças agendadas, por tipo.", ["agendamento", "agendados_cards", "agendados_carrosseis", "agendados_reels", "agendados_stories", "agendados_fotografias"]],
  ["Atendimento", "Peças dos clientes da sua carteira, por tipo.", ["carteira", "carteira_cards", "carteira_carrosseis", "carteira_reels", "carteira_stories", "carteira_fotografias", "planejamentos"]],
  ["Gestão e direção de arte", "Cadastros, briefings, peças da agência e aprovações do DA.", ["cadastros", "briefings", "agencia", "da"]],
  ["No escritório", "Um nível só, para começar a usar.", ["quarto", "andar2", "presente", "troca", "postits"]],
];
async function abrirConquistasEscritorio() {
  if (!document.getElementById("ofc-conquistas")) {
    openWorkflowModal('<div class="ofc-ranking ofc-conquistas" id="ofc-conquistas" role="dialog" aria-label="Conquistas"></div>');
    document.getElementById("workflow-modal")?.classList.add("ofc-ranking-janela");
  }
  pintarConquistasEscritorio();
  // As escadas vêm com a carteira (o servidor confere e concede os níveis novos).
  escritorio.conquistasErro = "";
  try { const r = await escritorioApi("economia"); if (r?.economia) escritorio.base.economia = { ...escritorio.base.economia, ...r.economia }; escritorio.conquistasLidas = true; } catch (e) { escritorio.conquistasErro = e.message; }
  if (typeof escritorioCatalogo !== "undefined" && !escritorioCatalogo && typeof carregarCatalogoEscritorio === "function") await carregarCatalogoEscritorio();
  pintarConquistasEscritorio();
}
function pintarConquistasEscritorio() {
  const el = document.getElementById("ofc-conquistas");
  if (!el) return;
  const marcos = escritorio.base?.economia?.marcos;
  const topo = `<header class="ofc-rk-cab"><span class="ofc-rk-icone" aria-hidden="true">${escritorioIcone("estrela")}</span><div><h2>Conquistas</h2><small>Bronze, Prata, Ouro e Diamante · cada nível dá um troféu, moedas e XP</small></div><button type="button" class="ofc-rk-x" onclick="closeWorkflowModal()" aria-label="Fechar">×</button></header>`;
  // Respondeu sem as escadas (tabela ainda não ativada): diz isso, não gira para sempre.
  if (!marcos && escritorio.conquistasLidas && !escritorio.conquistasErro) { el.innerHTML = topo + '<p class="ofc-nota">As conquistas em níveis estão sendo ativadas. Abra de novo em alguns minutos.</p>'; return; }
  if (!marcos) { el.innerHTML = topo + (escritorio.conquistasErro ? `<p class="ofc-nota" role="alert">Não deu para carregar: ${safeText(escritorio.conquistasErro)}</p>` : '<div class="ofc-rk-corpo"><p class="ofc-rk-legenda">Carregando as suas conquistas…</p><div class="ofc-fm-carregando"><i></i><i></i><i></i></div></div>'); return; }
  el.innerHTML = topo + `<div class="ofc-rk-corpo">${escritorioConquistasCorpoHtml(marcos)}</div>`;
}
// O corpo das conquistas: o mesmo na janela e na aba da ficha (Paulo, 20/10/2026).
function escritorioConquistasCorpoHtml(marcos) {
  // "1 entregas" → "1 entrega": tira o s de cada palavra quando o número é 1.
  const qtd = (n, unidade) => `${Number(n).toLocaleString("pt-BR")} ${n === 1 ? unidade.split(" ").map((w) => w.replace(/s$/, "")).join(" ") : unidade}`;
  const pct = (x) => { if (!x.proximo) return 100; const antes = x.degraus.filter((d) => d.ok).at(-1)?.meta || 0; return Math.max(0, Math.min(100, Math.round(((x.valor - antes) / Math.max(1, x.proximo.meta - antes)) * 100))); };
  // Uma escada numa linha: troféu atual (ou o próximo, apagado), nível, barra
  // até o próximo e os quatro níveis abertos ao clicar.
  const linha = (x, aberta = false) => {
    const atual = x.degraus.filter((d) => d.ok).at(-1), mostra = atual || x.proximo || x.degraus.at(-1);
    const prox = x.proximo;
    return `<details class="ofc-cq${x.nivel ? " ok" : ""}"${aberta ? " open" : ""}><summary><span class="ofc-cq-arte${atual ? "" : " falta"}">${escritorioMiniaturaHtml(mostra.classe)}</span>
<span class="ofc-cq-txt"><b>${safeText(x.nome)}${x.nomeNivel ? ` <em class="ofc-escada-nivel n${x.nivel}">${safeText(x.nomeNivel)}</em>` : ""}</b>
<small>${prox ? `${qtd(x.valor, x.unidade)} · faltam <b>${(prox.meta - x.valor).toLocaleString("pt-BR")}</b> para ${safeText(prox.nome)}` : x.social ? "Conquistado" : "Nível máximo alcançado"}</small>
${prox && !x.social ? `<span class="ofc-escada-barra"><i style="width:${pct(x)}%"></i></span>` : ""}</span>
${x.social ? "" : `<span class="ofc-escada-degraus" aria-hidden="true">${x.degraus.map((d) => `<i class="n${d.nivel}${d.ok ? " ok" : ""}"></i>`).join("")}</span>`}</summary>
<ol class="ofc-cq-degraus">${x.degraus.map((d) => `<li class="n${d.nivel}${d.ok ? " ok" : ""}" title="${safeText(d.nome)}: ${safeText(qtd(d.meta, x.unidade))} · +${d.moedas} moedas e +${d.pontos} XP"><span class="ofc-cq-arte">${escritorioMiniaturaHtml(d.classe)}</span><b>${safeText(d.nome)}</b><small>${d.meta.toLocaleString("pt-BR")}</small><em>+${d.moedas} moedas · +${d.pontos} XP</em>${d.ok ? '<i class="ofc-cq-ok">Seu</i>' : ""}</li>`).join("")}</ol></details>`;
  };
  const niveis = marcos.reduce((t, x) => t + x.nivel, 0), total = marcos.reduce((t, x) => t + x.degraus.length, 0);
  const andamento = marcos.filter((x) => x.proximo && x.valor > 0 && !x.social).sort((a, b) => pct(b) - pct(a));
  const conquistadas = marcos.filter((x) => x.nivel > 0).sort((a, b) => b.nivel - a.nivel || a.nome.localeCompare(b.nome, "pt-BR"));
  const proximoTrofeu = andamento[0];
  const resumo = `<div class="ofc-cq-resumo"><div><b>${niveis}</b><small>níveis de ${total}</small></div><div><b>${conquistadas.length}</b><small>escadas com troféu</small></div><div><b>${marcos.filter((x) => x.nivel >= 3).length}</b><small>no Ouro ou acima</small></div>${proximoTrofeu ? `<div class="ofc-cq-proximo"><small>Mais perto agora</small><b>${safeText(proximoTrofeu.nome)} ${safeText(proximoTrofeu.proximo.nome)}</b><small>faltam ${(proximoTrofeu.proximo.meta - proximoTrofeu.valor).toLocaleString("pt-BR")}</small></div>` : ""}</div>`;
  const todas = ESCRITORIO_GRUPOS_CONQUISTA.map(([titulo, dica, ids]) => { const l = ids.map((id) => marcos.find((m) => m.id === id)).filter(Boolean); return l.length ? `<details class="ofc-cq-grupo"><summary><b>${titulo}</b><small>${dica} · ${l.filter((x) => x.nivel).length} de ${l.length} com troféu</small></summary>${l.map((x) => linha(x)).join("")}</details>` : ""; }).join("");
  return `${resumo}
${andamento.length ? `<section class="ofc-cq-sec"><h3>Em andamento</h3><small>As que você está mais perto de subir.</small>${andamento.slice(0, 8).map((x, k) => linha(x, k === 0)).join("")}</section>` : ""}
${conquistadas.length ? `<section class="ofc-cq-sec"><h3>Suas conquistas</h3><small>Você fica com todos os troféus da escada, do Bronze ao Diamante, para expor no quarto.</small>${conquistadas.map((x) => linha(x)).join("")}</section>` : ""}
<section class="ofc-cq-sec"><h3>Todas as conquistas</h3><small>Clique num grupo para ver as escadas, as metas e o que cada nível dá. O Diamante vale 4 vezes o Bronze.</small>${todas}</section>`;
}

// Quanto a pessoa ganha por peça, pelo papel dela no bolo (Paulo, 20/10/2026).
function escritorioPorPecaHtml(pontos, funcao) {
  const bolo = pontos?.bolo, papel = { criacao: "criacao", producao: "producao", atendimento: "atendimento", agendamento: "agendamento", gestao: "gestao" }[pontos?.funcao];
  const base = pontos?.missoes?.regras?.find((r) => r.chave === `peca_${papel}`);
  if (!bolo || !papel || !base) return "";
  const pesos = Object.fromEntries((pontos?.missoes?.complexidade || []).map((c) => [c.chave, Number(c.peso)]));
  const tipos = [["Card", "card", "normal"], ["Carrossel", "carrossel", "normal"], ["Story", "story", "normal"], ["Reels", "reels", "video"], ["Vídeo", "video", "video"], ["Fotografia", "fotografia", "foto"]];
  const linhas = tipos.map(([nome, chave, tipo]) => { const f = bolo[papel]?.[tipo] || 0, peso = base.por_complexidade ? pesos[chave] || 1 : 1; return f ? `<li><span>${nome}</span><b>+${Math.round(base.moedas * peso * f)}</b><small>moedas</small><b>+${Math.round(base.pontos * peso * f)}</b><small>XP</small></li>` : ""; }).filter(Boolean);
  // Além da peça: cadastro, briefing, prazo e dia sem furo, quando valem para a pessoa.
  const extras = (pontos?.regras || []).filter((r) => ["cadastro", "briefing", "entrega_prazo", "dia_sem_furo"].includes(r.chave) && (r.moedas > 0 || r.pontos > 0))
    .map((r) => `<li class="extra"><span>${safeText(r.descricao)}</span><b>+${r.moedas}</b><small>moedas</small><b>+${r.pontos}</b><small>XP</small></li>`);
  return linhas.length ? `<section class="ofc-hud-bloco"><div class="ofc-hud-bloco-topo"><h4>Quanto você ganha</h4><small>Como ${safeText(funcao || "membro da equipe")}, por peça concluída e por ação</small></div><ul class="ofc-hud-porpeca">${linhas.join("")}${extras.join("")}</ul><small class="ofc-nota">Peças com mais de um formato somam os pesos. Se várias pessoas fazem a mesma peça, dividem a parte.</small></section>` : "";
}

// Momento de conquista (Padrão Vybe, 21/10/2026: "movimento com sentido"): ao
// chegar do servidor um nível ou troféu que a pessoa ainda não viu, o troféu
// sobe no pedestal, numa tela rápida. Na primeira vez só guarda o que já tinha;
// a lista do que foi visto fica no navegador da própria pessoa.
function escritorioConquistasDaEconomia(eco) {
  const trofeus = (eco?.marcos || []).flatMap((m) => (m.degraus || []).filter((d) => d.ok).map((d) => ({ chave: `${m.id}:${d.nivel}`, nome: `${m.nome} ${d.nome || ""}`.trim(), classe: d.classe, nivel: d.nivel })));
  return { nivel: eco?.pontos?.nivel ?? null, trofeus };
}
function escritorioCelebrarSeMudou() {
  const b = escritorio.base, eco = b?.economia;
  if (!eco || b?.convidado || !b?.eu) return;
  const agora = escritorioConquistasDaEconomia(eco);
  if (agora.nivel === null && !agora.trofeus.length) return;
  const chave = "vybe-celebrado-" + b.eu;
  let antes = null;
  try { antes = JSON.parse(localStorage.getItem(chave) || "null"); } catch {}
  const salvar = () => { try { localStorage.setItem(chave, JSON.stringify({ nivel: agora.nivel, trofeus: agora.trofeus.map((t) => t.chave) })); } catch {} };
  if (!antes) return salvar();
  const vistos = new Set(antes.trofeus || []);
  const novos = agora.trofeus.filter((t) => !vistos.has(t.chave)).sort((x, y) => y.nivel - x.nivel);
  const subiu = agora.nivel !== null && antes.nivel !== null && agora.nivel > antes.nivel;
  if (agora.nivel !== antes.nivel || novos.length) salvar();
  if (novos.length || subiu) escritorioMostrarCelebracao(subiu ? agora.nivel : null, novos[0] || null);
}
function escritorioMostrarCelebracao(nivel, trofeu) {
  document.getElementById("ofc-celebra")?.remove();
  const el = document.createElement("div");
  el.id = "ofc-celebra";
  el.className = `ofc-celebra${trofeu ? " n" + trofeu.nivel : ""}`;
  el.setAttribute("role", "status");
  const titulo = trofeu ? "Novo troféu" : "Subiu de nível";
  const texto = trofeu ? trofeu.nome + (nivel ? ` · e você chegou ao nível ${nivel}` : "") : `Você chegou ao nível ${nivel}.`;
  el.innerHTML = `<button type="button" class="ofc-celebra-fundo" aria-label="Fechar" onclick="document.getElementById('ofc-celebra')?.remove()"></button>
<div class="ofc-celebra-cartao"><div class="ofc-celebra-palco" aria-hidden="true"><span class="prov-holofote"></span><span class="ofc-celebra-faiscas">${"<i></i>".repeat(12)}</span><span class="ofc-celebra-arte">${trofeu ? escritorioMiniaturaHtml(trofeu.classe) : `<b>${Number(nivel)}</b>`}</span><span class="prov-pedestal"></span></div>
<small>${titulo}</small><b>${safeText(texto)}</b><button type="button" class="vb-botao principal" onclick="document.getElementById('ofc-celebra')?.remove()">Continuar</button></div>`;
  document.body.append(el);
  el.querySelector(".vb-botao")?.focus({ preventScroll: true });
  if (typeof escritorioTocar === "function" && (typeof escritorioSomLigado !== "function" || escritorioSomLigado())) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => escritorioTocar(f, 0.16, 0.05), i * 110));
  setTimeout(() => el.isConnected && el.remove(), 7000);
}
