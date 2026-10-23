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
// Dia de cada pessoa (Paulo, 22/10/2026), para o balão da mesa e o Dia da
// equipe. Todos veem o de todos. As contas ficam no servidor
// (server/escritorio-dia.js, rota "dia"): os dois quadros, prazo e
// veiculação, o que foi adiado e o dia real de cada entrega. Aqui só se lê e
// se conta; a leitura vale por 2 minutos.
async function carregarDiaEscritorio(forcar = false) {
  const d = (escritorio.diaEquipe ||= {});
  if (d.carregando || (!forcar && d.em && Date.now() - d.em < 120e3)) return;
  d.carregando = true;
  try { const r = await escritorioApi("dia"); Object.assign(d, { hoje: r.hoje, ontem: r.ontem, pessoas: r.pessoas || {}, em: Date.now(), erro: null }); }
  catch (e) { d.erro = e.message; }
  d.carregando = false;
  if (typeof escritorioMarcarDia === "function") escritorioMarcarDia();
  if (document.getElementById("ofc-dia-equipe")) pintarDiaEquipeEscritorio();
}
// Carteira no Dia da equipe (Paulo, 22/10/2026: "Clientes de Vinícius e Clientes de
// Ewerton"): a peça entra se algum cliente dela é da carteira, pela mesma regra do
// painel (carteiraDoCliente); peça de duas carteiras aparece nas duas.
const escritorioDiaNaCarteira = (it, carteira) => !carteira || carteira === "all" || (typeof carteiraDoCliente === "function" && (it.clientes || []).some((nome) => carteiraDoCliente(nome) === carteira));
function escritorioDiaDe(pessoa, carteira = "all") {
  const d = escritorio.diaEquipe;
  if (!d?.pessoas) return null;
  const bruto = d.pessoas[String(pessoa?.id)] || { hoje: [], ontem: [], atrasadas: [] };
  const l = Object.fromEntries(["hoje", "ontem", "atrasadas"].map((k) => [k, (bruto[k] || []).filter((it) => escritorioDiaNaCarteira(it, carteira))]));
  const conta = (lista) => {
    const doDia = lista.filter((x) => !x.adiada);
    return { total: doDia.length, feitas: doDia.filter((x) => x.estado === "pronta").length, fazendo: doDia.filter((x) => x.estado === "fazendo").length,
      faltam: doDia.filter((x) => x.estado === "falta").length, depois: doDia.filter((x) => x.estado === "depois").length, adiadas: lista.length - doDia.length };
  };
  const nOntem = conta(l.ontem);
  return { hoje: d.hoje, ontem: d.ontem, paraHoje: l.hoje, deOntem: l.ontem, atrasadas: l.atrasadas, nHoje: conta(l.hoje), nOntem: { ...nOntem, noDia: nOntem.feitas } };
}
const escritorioPlural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
function escritorioDiaRostoHtml(id, tam = 40) {
  const u = typeof escritorioCabecaUrl === "function" ? escritorioCabecaUrl(id) : null;
  return u ? `<img class="dia-rosto" src="${safeText(u)}" alt="" width="${tam}" height="${tam}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="dia-rosto vazio" style="width:${tam}px;height:${tam}px"></span>`;
}
// Anel do quanto de hoje já foi finalizado (o mesmo do balão da mesa).
function escritorioDiaAnelHtml(n) {
  const pct = n.total ? Math.round((n.feitas / n.total) * 100) : 0;
  return `<span class="dia-anel${n.total && n.feitas === n.total ? " completo" : ""}" style="--p:${pct}" role="img" aria-label="${safeText(`${n.feitas} de ${n.total} finalizadas`)}"><b>${n.total ? `${n.feitas}/${n.total}` : "0"}</b></span>`;
}
const ESCRITORIO_DIA_ESTADO = { pronta: "Pronta", depois: "Pronta depois", fazendo: "Fazendo agora", falta: "Falta fazer" };
// Status da peça com a cor do quadro dela (vybe_status.cor, vinda do servidor),
// a mesma etiqueta das demandas; a bolinha da linha continua dizendo o estado do dia.
function escritorioDiaStatusHtml(it) {
  const rotulo = safeText(it.status || "");
  return typeof pillHtmlDemanda === "function" ? pillHtmlDemanda(rotulo, it.status_cor || "") : `<small>${rotulo}</small>`;
}
// Peça adiada: diz o que mudou e para quando ("Prazo foi para 24/10").
const escritorioDiaAdiada = (x) => x.adiada ? `${x.adiada.campo === "veiculacao" ? "Veiculação" : "Prazo"} ${x.adiada.para ? "foi para " + escritorioDataCurta(x.adiada.para) : "foi tirado"}` : "";
function escritorioDiaCartaoHtml(pessoa) {
  const d = escritorioDiaDe(pessoa);
  if (!d) return escritorio.diaEquipe?.erro ? vbEstadoHtml({ tipo: "erro", titulo: "Não deu para carregar o dia", texto: escritorio.diaEquipe.erro }) : vbEstadoHtml({ tipo: "carregando", titulo: "Carregando o dia" });
  const n = d.nHoje, o = d.nOntem, abertasOntem = o.faltam + o.fazendo;
  const linha = (it) => `<li class="${it.adiada ? "adiada" : it.estado}"><i aria-hidden="true"></i><span>${safeText(it.titulo)}</span>${it.adiada || !it.status ? `<small>${safeText(it.adiada ? escritorioDiaAdiada(it) : ESCRITORIO_DIA_ESTADO[it.estado])}</small>` : escritorioDiaStatusHtml(it)}</li>`;
  const conta = [n.feitas && ["feita", escritorioPlural(n.feitas, "pronta", "prontas")], n.fazendo && ["fazendo", escritorioPlural(n.fazendo, "fazendo agora", "fazendo agora")], n.faltam && ["falta", escritorioPlural(n.faltam, "falta", "faltam")], n.adiadas && ["adiada", escritorioPlural(n.adiadas, "adiada", "adiadas")]].filter(Boolean);
  return `<div class="dia-cab">${escritorioDiaRostoHtml(pessoa.id, 40)}<div><b>${safeText(pessoa.nome || "")}</b><small>Hoje, ${escritorioDataCurta(d.hoje)} · ${escritorioPlural(n.total, "peça", "peças")}</small></div>${escritorioDiaAnelHtml(n)}</div>
  ${d.paraHoje.length ? `<div class="dia-conta">${conta.map(([c, t]) => `<span class="${c}">${t}</span>`).join("")}</div><ul class="dia-lista">${d.paraHoje.slice(0, 5).map(linha).join("")}</ul>${d.paraHoje.length > 5 ? `<small class="dia-mais">e mais ${d.paraHoje.length - 5}</small>` : ""}` : '<p class="dia-vazio">Nada com prazo para hoje.</p>'}
  ${d.atrasadas.length ? `<p class="dia-alerta">${escritorioPlural(d.atrasadas.length, "atrasada", "atrasadas")} de dias anteriores</p>` : ""}
  <div class="dia-ontem"><span class="vb-jogo-rotulo">Ontem, ${escritorioDataCurta(d.ontem)}</span><span>${o.total ? `${o.noDia} de ${o.total} no dia${o.depois ? ` · ${o.depois} depois` : ""}${abertasOntem ? ` · <em>${escritorioPlural(abertasOntem, "ficou aberta", "ficaram abertas")}</em>` : ""}` : "Nada com prazo"}${o.adiadas ? ` · ${escritorioPlural(o.adiadas, "adiada", "adiadas")}` : ""}</span></div>
  <small class="dia-dica">Clique no balão para ver a equipe toda</small>`;
}
// Dia da equipe: cada pessoa com a fotinha do personagem, hoje ou ontem; a
// pessoa do balão clicado já vem aberta, com as demandas uma a uma.
const escritorioDiaEquipe = { vista: "hoje", aberto: null, carteira: "all" };
// Carteira de quem está vendo: Vinícius e Ewerton veem a deles como "Meus clientes".
function escritorioMinhaCarteira() {
  const eu = (escritorio.base?.equipe || []).find((p) => String(p.id) === String(escritorio.base?.eu));
  const primeiro = String(eu?.nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/)[0];
  return ["vinicius", "ewerton"].includes(primeiro) ? primeiro : "";
}
function abrirDiaEquipeEscritorio(id) {
  if (id != null) escritorioDiaEquipe.aberto = String(id);
  if (typeof esconderDiaCardEscritorio === "function") esconderDiaCardEscritorio(true);
  if (!document.getElementById("ofc-dia-equipe")) {
    openWorkflowModal('<div class="ofc-ranking ofc-dia-equipe" id="ofc-dia-equipe" role="dialog" aria-label="Dia da equipe"></div>');
    document.getElementById("workflow-modal")?.classList.add("ofc-ranking-janela", "ofc-menu-jogo");
  }
  escritorioDiaEquipe.primeiro = escritorioDiaEquipe.aberto;
  pintarDiaEquipeEscritorio();
  carregarDiaEscritorio();
  // A carteira escolhida no cadastro do cliente vale aqui também.
  if (typeof ensureClientMasterSources === "function" && !(typeof CLIENT_MASTER_LOADED !== "undefined" && CLIENT_MASTER_LOADED))
    ensureClientMasterSources().then(() => pintarDiaEquipeEscritorio()).catch(() => {});
}
function trocarDiaEquipeEscritorio(campo, valor) {
  escritorioDiaEquipe[campo] = campo === "aberto" && escritorioDiaEquipe.aberto === String(valor) ? null : String(valor);
  pintarDiaEquipeEscritorio();
}
function pintarDiaEquipeEscritorio() {
  const el = document.getElementById("ofc-dia-equipe");
  if (!el) return;
  const { vista, aberto, carteira } = escritorioDiaEquipe, ontem = vista === "ontem";
  const topo = `<header class="ofc-rk-cab"><span class="ofc-rk-icone" aria-hidden="true">${escritorioIcone("lista")}</span><div><h2>Dia da equipe</h2><small>O que cada um tinha, está fazendo e já finalizou</small></div><button type="button" class="ofc-rk-x" onclick="closeWorkflowModal()" aria-label="Fechar">×</button></header>`;
  const alternar = `<div class="vb-alternar" role="group" aria-label="Dia"><button type="button" aria-pressed="${!ontem}" onclick="trocarDiaEquipeEscritorio('vista','hoje')">Hoje</button><button type="button" aria-pressed="${ontem}" onclick="trocarDiaEquipeEscritorio('vista','ontem')">Ontem</button></div>`;
  const minha = escritorioMinhaCarteira();
  // "Clientes de" some em tela estreita (.dia-cart-de), para caber no celular.
  const nomeCarteira = (id) => (id === minha ? "Meus clientes" : `<span class="dia-cart-de">Clientes de </span>${id === "vinicius" ? "Vinícius" : "Ewerton"}`);
  const carteiras = ["all", ...(minha ? [minha] : []), ...["vinicius", "ewerton"].filter((id) => id !== minha)];
  const filtroCarteira = `<div class="vb-alternar" role="group" aria-label="Carteira de clientes">${carteiras.map((id) => `<button type="button" aria-pressed="${carteira === id}" onclick="trocarDiaEquipeEscritorio('carteira','${id}')">${id === "all" ? "Todos" : nomeCarteira(id)}</button>`).join("")}</div>`;
  const estado = escritorio.diaEquipe;
  if (!estado?.pessoas) { el.innerHTML = topo + `<div class="ofc-rk-corpo">${alternar}${estado?.erro ? vbEstadoHtml({ tipo: "erro", titulo: "Não deu para carregar o dia da equipe", texto: estado.erro, acao: '<button type="button" class="vb-jogo-botao" onclick="carregarDiaEscritorio(true)">Tentar de novo</button>' }) : vbEstadoHtml({ tipo: "carregando", titulo: "Carregando o dia da equipe" })}</div>`; return; }
  const pessoas = (escritorio.base?.equipe || []).map((p) => ({ p, d: escritorioDiaDe(p, carteira) }))
    // Numa carteira, só quem tem peça dos clientes dela no dia escolhido.
    .filter(({ d }) => carteira === "all" || (ontem ? d.deOntem.length : d.paraHoje.length + d.atrasadas.length))
    // A pessoa do balão clicado vem primeiro; o resto, em ordem de nome.
    .sort((a, b) => (String(b.p.id) === escritorioDiaEquipe.primeiro) - (String(a.p.id) === escritorioDiaEquipe.primeiro) || String(a.p.nome || "").localeCompare(String(b.p.nome || ""), "pt-BR"));
  const item = (it) => {
    const quando = it.adiada ? escritorioDiaAdiada(it) : [it.prazo ? "prazo " + escritorioDataCurta(it.prazo) : "", it.veiculacao ? "veicula " + escritorioDataCurta(it.veiculacao) : "", it.estado === "depois" && it.pronta_em ? "pronta " + escritorioDataCurta(it.pronta_em) : ""].filter(Boolean).join(" · ");
    return `<li><button type="button" onclick="closeWorkflowModal();abrirMissaoEscritorio('${safeText(it.ref)}','${it.quadro}')"><span class="dia-ponto ${it.adiada ? "adiada" : it.estado}" aria-hidden="true"></span><span class="dia-nome">${safeText(it.titulo)}<small>${safeText([it.clientes?.join(", "), quando].filter(Boolean).join(" · "))}</small></span>${escritorioDiaStatusHtml(it)}</button></li>`;
  };
  const grupo = (titulo, lista, tom = "") => (lista.length ? `<section class="dia-grupo ${tom}"><span class="vb-jogo-rotulo">${titulo} · ${lista.length}</span><ul>${lista.map(item).join("")}</ul></section>` : "");
  const por = (lista, estado) => lista.filter((x) => !x.adiada && x.estado === estado);
  const detalhe = (d) => ontem
    ? grupo("Prontas no dia", por(d.deOntem, "pronta"), "feita") + grupo("Prontas depois", por(d.deOntem, "depois")) + grupo("Ficaram em aberto", d.deOntem.filter((x) => !x.adiada && ["falta", "fazendo"].includes(x.estado)), "alerta") + grupo("Adiadas", d.deOntem.filter((x) => x.adiada), "adiada") || '<p class="dia-vazio">Nada com prazo ontem.</p>'
    : grupo("Fazendo agora", por(d.paraHoje, "fazendo"), "fazendo") + grupo("Falta fazer", por(d.paraHoje, "falta")) + grupo("Prontas", por(d.paraHoje, "pronta"), "feita") + grupo("Adiadas", d.paraHoje.filter((x) => x.adiada), "adiada") + grupo("Atrasadas de antes", d.atrasadas, "alerta") || '<p class="dia-vazio">Nada com prazo para hoje.</p>';
  const resumo = (d) => {
    if (ontem) { const o = d.nOntem, ab = o.faltam + o.fazendo; return (o.total ? `${o.noDia} de ${o.total} no dia${o.depois ? ` · ${o.depois} depois` : ""}${ab ? ` · <em>${escritorioPlural(ab, "aberta", "abertas")}</em>` : ""}` : "Nada com prazo") + (o.adiadas ? ` · ${escritorioPlural(o.adiadas, "adiada", "adiadas")}` : ""); }
    const n = d.nHoje;
    return (n.total ? [n.fazendo && `${n.fazendo} fazendo`, n.faltam && `${escritorioPlural(n.faltam, "falta", "faltam")}`, n.feitas && `${escritorioPlural(n.feitas, "pronta", "prontas")}`].filter(Boolean).join(" · ") : "Nada com prazo hoje") + (n.adiadas ? ` · ${escritorioPlural(n.adiadas, "adiada", "adiadas")}` : "") + (d.atrasadas.length ? ` · <em>${escritorioPlural(d.atrasadas.length, "atrasada", "atrasadas")}</em>` : "");
  };
  const anel = (d) => escritorioDiaAnelHtml(ontem ? { total: d.nOntem.total, feitas: d.nOntem.noDia } : d.nHoje);
  const tot = pessoas.reduce((t, { d }) => { const n = ontem ? { total: d.nOntem.total, feitas: d.nOntem.noDia, abertas: d.nOntem.faltam + d.nOntem.fazendo } : { total: d.nHoje.total, feitas: d.nHoje.feitas, abertas: d.atrasadas.length }; t.total += n.total; t.feitas += n.feitas; t.abertas += n.abertas; return t; }, { total: 0, feitas: 0, abertas: 0 });
  const resumoEquipe = vbResumoHtml([
    { valor: `${tot.feitas} de ${tot.total}`, rotulo: ontem ? " prontas no dia" : " prontas hoje", tom: tot.total && tot.feitas === tot.total ? "ok" : "" },
    { valor: tot.abertas || "", rotulo: tot.abertas ? (ontem ? (tot.abertas === 1 ? " ficou aberta" : " ficaram abertas") : (tot.abertas === 1 ? " atrasada de antes" : " atrasadas de antes")) : (ontem ? "Nada ficou aberto" : "Nada atrasado"), tom: tot.abertas ? "alerta" : "" },
  ]);
  el.innerHTML = topo + `<div class="ofc-rk-corpo"><div class="dia-barra">${alternar}${filtroCarteira}${resumoEquipe}</div>${carteira !== "all" && !pessoas.length ? vbEstadoHtml({ tipo: "vazio", titulo: `Nenhuma peça ${carteira === minha ? "dos seus clientes" : carteira === "vinicius" ? "dos clientes de Vinícius" : "dos clientes de Ewerton"} ${ontem ? "ontem" : "hoje"}`, texto: "Escolha Todos para ver a equipe inteira." }) : ""}<div class="dia-equipe">${pessoas.map(({ p, d }) => {
    const sel = aberto === String(p.id);
    return `<article class="vb-jogo-cartao dia-pessoa${sel ? " aberto" : ""}"><button type="button" class="dia-pessoa-cab" aria-expanded="${sel}" onclick="trocarDiaEquipeEscritorio('aberto','${safeText(String(p.id))}')">${escritorioDiaRostoHtml(p.id, 44)}<span class="dia-pessoa-nome"><b>${safeText(p.nome || "")}</b><small>${resumo(d)}</small></span>${anel(d)}</button>${sel ? `<div class="dia-detalhe vb-jogo-poco">${detalhe(d)}</div>` : ""}</article>`;
  }).join("")}</div></div>`;
}
// Marcos calculados no servidor (server/escritorio-marcos.js): cada um diz se
// foi conquistado, quando, e o móvel que dá. Nome do móvel pelo catálogo do editor.
// Regras gerais na ficha (Paulo, 20/10/2026): o que dá e o que tira XP e
// moedas, e como o bolo de cada peça é dividido. Tudo vem das tabelas.
function escritorioComoFuncionaHtml(bolo, regras) {
  const pct = (n) => (n ? `${Math.round(n * 1000) / 10}%`.replace(".", ",") : "—");
  const papeis = [["producao", "Produção (quem grava e fotografa)"], ["criacao", "Criação (quem faz a peça)"], ["direcao_arte", "Direção de arte (quem aprova)"], ["atendimento", "Atendimento (head da carteira)"], ["agendamento", "Agendamento (quem agenda)"], ["gestao", "Gestão"]];
  const tabela = bolo ? `<table class="ofc-hud-bolo"><thead><tr><th>Quem</th><th>Foto</th><th>Vídeo e reels</th><th>Outras peças</th></tr></thead><tbody>${papeis.map(([k, nome]) => `<tr><td>${nome}</td><td>${pct(bolo[k]?.foto ?? bolo[k]?.captada)}</td><td>${pct(bolo[k]?.video ?? bolo[k]?.captada)}</td><td>${pct(bolo[k]?.normal)}</td></tr>`).join("")}</tbody></table>
<p class="ofc-nota">Os percentuais usam o valor-base da execução como referência; a soma dos papéis pode ultrapassar 100%. Quando várias pessoas dividem um papel na mesma peça, dividem a parte desse papel.</p>` : "";
  const ganha = [...new Set(regras.filter((r) => r.moedas > 0).map((r) => r.descricao))];
  const perde = [...new Set(regras.filter((r) => r.moedas < 0).map((r) => r.descricao))];
  return `<section class="ofc-hud-bloco ofc-hud-como"><div class="ofc-hud-bloco-topo"><h4>Como funciona</h4><small>Moedas compram móveis; XP sobe o nível.</small></div>
${bolo ? `<p>Cada peça concluída tem um valor-base de moedas e XP, definido pelas regras e pelo peso do formato. Cada contribuição recebe o percentual indicado abaixo:</p>${tabela}` : ""}
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
      corpo = `<div class="ofc-cq-na-ficha">${escritorioConquistasCorpoHtml(marcos, { meu: eu })}</div>`;
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
  const rk = (typeof escritorioRanking !== "undefined" ? escritorioRanking : null)?.dados?.semana?.pessoas?.find((p) => p.id === String(id));
  // Cartão do jogador (21/10/2026, a linguagem do Provador): o pedestal
  // brilha na cor do troféu mais alto da pessoa (Bronze a Diamante).
  d.className = `ofc-ficha jogador${vitrine[0] ? " tier-n" + vitrine[0].nivel : ""}`;
  d.innerHTML = `<div class="ofc-hud-topo"><div class="ofc-hud-boneco ofc-hud-palco">${escritorioVitrineHtml("ofc-hud-vitrine", pessoa.id, { zoom: 1.7, desce: 0.24 })}</div>
<div class="ofc-hud-id"><h3 id="office-ficha-nome">${safeText(pessoa.nome)}</h3>${pessoa.titulo?.texto ? `<em class="ofc-hud-titulo vb-titulo n${Number(pessoa.titulo.nivel) || 1}">${safeText(pessoa.titulo.texto)}</em>` : ""}<small><i class="ofc-ponto" style="--st:${cor}"></i>${safeText(status)} · ${safeText(lugar)}${funcao ? ` · ${funcao}` : ""}</small>
${nivel != null ? `<div class="ofc-hud-nivel"><span class="ofc-hud-selo" title="Nível">${nivel}</span><span class="ofc-hud-xp"><span class="ofc-dia-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${xpProx}" aria-valuenow="${xp}" aria-label="XP até o próximo nível"><i style="width:${pct}%"></i></span><small>${xp} de ${xpProx} XP para o nível ${nivel + 1}</small></span></div>` : ""}
${jogo ? `<div class="ofc-hud-moedas"><span title="VybeCoins na carteira">${escritorioFichaIcone("moeda")}<b data-vb-contar="${Number(jogo.saldo)}" data-vb-chave="moedas-${sid}">${Number(jogo.saldo).toLocaleString("pt-BR")}</b><small>moedas</small></span><span title="Níveis de conquista">${escritorioFichaIcone("estrela")}<b>${conquistas ?? 0}</b><small>conquistas</small></span><span title="Móveis no inventário">${escritorioFichaIcone("caixa")}<b>${moveis}</b><small>móveis</small></span>${rk?.posicao ? `<span class="rk" title="Ranking da semana" role="button" tabindex="0" onclick="abrirRankingEscritorio('geral')">${escritorioIcone("ranking")}<b>${rk.posicao}º</b><small>na semana</small></span>` : ""}</div>` : pub === null ? '<small class="ofc-nota" role="alert">Não deu para carregar moedas e inventário agora.</small>' : ""}</div>
<button type="button" class="ofc-x" onclick="this.closest('dialog').close()" aria-label="Fechar">×</button></div>
${vitrine.length ? `<div class="ofc-hud-vitrine" aria-label="Troféus em destaque">${vitrine.map((v) => `<span class="n${v.nivel}" title="${safeText(v.nome)}">${escritorioMiniaturaHtml(v.classe)}</span>`).join("")}</div>` : ""}
<div class="ofc-hud-abas" role="tablist" aria-label="Ficha">${abas.map(([k, r]) => `<button type="button" role="tab" aria-selected="${k === aba}" onclick="escolherAbaFichaEscritorio('${sid}','${k}')">${r}</button>`).join("")}</div>
<div class="ofc-hud-corpo" role="tabpanel">${corpo}</div>
<div class="ofc-ficha-acoes">${quarto ? `<button type="button" class="ofc-secundario" onclick="${fechar}escritorioIrParaAmbiente('${safeText(quarto.id)}')">${eu ? "Ir para o meu quarto" : "Entrar no quarto"}</button>` : ""}${!eu && online ? `<button type="button" class="ofc-secundario" onclick="${fechar}chamarParaSalaEscritorio('${sid}')">Chamar para cá</button><button type="button" class="ofc-secundario" onclick="${fechar}convidarConversaEscritorio('${sid}')">Convidar para conversar</button>` : ""}${eu ? `<button type="button" class="ofc-secundario" onclick="${fechar}personalizarEscritorio()">Personalizar aparência</button>${escritorioMinhaMesa() ? `<button type="button" class="ofc-secundario" onclick="${fechar}abrirEstiloSalaEscritorio()">Piso e paredes da sala</button>` : ""}` : `<button type="button" class="ofc-secundario" onclick="${fechar}abrirRecadosEscritorio('${sid}')">Deixar recado</button>${online ? `<button type="button" class="ofc-secundario" onclick="${fechar}escritorioIrAte('${sid}')">Ir até</button>` : ""}<button type="button" class="ofc-secundario" onclick="${fechar}abrirPresenteEscritorio('${sid}')">Dar um móvel de presente</button>`}</div>`;
  if (!d.open) d.showModal();
  if (typeof vbAnimarContagens === "function") vbAnimarContagens(d);
  if (typeof escritorioMontarVitrines === "function") escritorioMontarVitrines(d);
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
${pin.ferramenta === "planta" ? `<p class="ofc-nota">Clique ou arraste nos ladrilhos para mudar o formato do quarto, como no editor de planta do Habbo. A porta e a escada ficam onde estão. Vale ao clicar em Salvar.</p><h4>Ladrilho</h4><div class="ofc-cats ofc-ferramentas">${ESCRITORIO_FORMAS_PLANTA.map(([id, nome, dica]) => `<button type="button" aria-pressed="${(pin.forma || "p") === id}" onclick="escritorioPincel().forma='${id}';renderEscritorio()" title="${dica}">${nome}</button>`).join("")}</div>${(pin.forma || "p") === "n" ? `<label class="ofc-opcao-quarto">Altura do ladrilho (blocos)<input type="number" min="1" max="35" step="1" value="${Number(pin.nivel) || 1}" onchange="escritorioPincel().nivel=Math.max(1,Math.min(35,Math.round(Number(this.value)||1)))"></label><p class="ofc-nota">Como no Habbo: de um ladrilho ao vizinho só se sobe até um bloco e meio. Para chegar ao alto, faça degraus de 1 em 1; descer pode de qualquer altura.</p>` : ""}<div class="ofc-ficha-acoes"><button type="button" class="ofc-secundario" onclick="plantaOriginalEscritorio()">Voltar à planta escolhida</button></div><h4>Porta</h4><div class="ofc-cats ofc-ferramentas">${[["baixo", "Embaixo"], ["direita", "À direita"]].map(([id, nome]) => `<button type="button" aria-pressed="${a.porta === id}" onclick="mudarPortaEscritorio('${id}')">${nome}</button>`).join("")}</div>${escritorioOpcoesQuartoHtml(a)}<p class="ofc-nota">A altura de um trecho só muda em Pintar parede → Altura.</p><h4>Paredes</h4><div class="ofc-cats ofc-ferramentas"><button type="button" aria-pressed="${!a.semParedes}" onclick="estiloSalaEscritorio('sala_sem_paredes',false)">Com paredes</button><button type="button" aria-pressed="${Boolean(a.semParedes)}" onclick="estiloSalaEscritorio('sala_sem_paredes',true)" title="Tira as paredes do quarto para você construir as suas com blocos, como uma maquete">Sem paredes (maquete)</button></div><p class="ofc-erro" id="office-estilo-erro" role="alert"></p>` : pin.ferramenta === "luz" ? `<p class="ofc-nota">A luz tinge o quarto inteiro, como o regulador de luz do Habbo. Prévia só para você; confirme em Salvar para aplicar.</p><h4>Luz do quarto</h4><div class="ofc-amostras">${ESCRITORIO_LUZES_SALA.map(([id, nome, cor]) => `<button type="button" aria-pressed="${(escritorioPerfilDecoracao()?.sala_luz || "") === id}" onclick="estiloSalaEscritorio('sala_luz','${id}')"><i style="background:${cor}"></i><span>${nome}</span></button>`).join("")}</div><p class="ofc-erro" id="office-estilo-erro" role="alert"></p>` : `
<p class="ofc-nota">${pin.ferramenta === "parede" ? "Escolha estilo, altura e cor e clique no trecho de parede que quer trocar (ou no piso encostado nela). Um clique muda um trecho; arraste para fazer vários." : pin.ferramenta === "balde" ? "Toque num piso: a sala inteira muda (os ladrilhos pintados à mão saem)." : "Escolha o piso e clique ou arraste nos ladrilhos da sua sala."} Prévia só para você; confirme em Salvar para aplicar.</p>
${pin.ferramenta === "parede" ? `<h4>Estilo da parede</h4><div class="ofc-amostras ofc-amostras-parede">${ESCRITORIO_ESTILOS_PAREDE.map(([id, nome]) => `<button type="button" aria-pressed="${pin.estilo === id}" onclick="escritorioPincel().estilo='${id}';renderEscritorio()"><i style="background:${amostraParede(id)}">${typeof MAPA_ESTILO_TEXTURA !== "undefined" && MAPA_ESTILO_TEXTURA[id] ? `<img class="ofc-arte" alt="" data-arte="${MAPA_ESTILO_TEXTURA[id]}">` : ""}</i><span>${nome}</span></button>`).join("")}</div>
<h4>Altura</h4><div class="ofc-cats ofc-ferramentas">${[["0", "Baixa"], ["1", "Média"], ["2", "Alta"]].map(([h, n]) => `<button type="button" aria-pressed="${pin.altura === h}" onclick="escritorioPincel().altura='${h}';renderEscritorio()">${n}</button>`).join("")}</div>
<h4>Cor (Padrão, Lisa e Listrada)</h4><div class="ofc-amostras cores">${ESCRITORIO_PAREDES_SALA.map((c) => `<button type="button" aria-pressed="${pin.cor === c}" onclick="escritorioPincel().cor='${c}';renderEscritorio()" aria-label="${c ? "Cor " + c : "Cor da sala"}"><i style="background:${c || a.corPadrao}"></i>${c ? "" : "<span>Da sala</span>"}</button>`).join("")}</div>
<div class="ofc-ficha-acoes"><button type="button" class="ofc-secundario" onclick="pintarTodasParedesEscritorio()">Aplicar em todas as paredes</button><button type="button" class="ofc-secundario" onclick="limparPinturaEscritorio('sala_paredes')">Paredes como eram</button></div>`
  : `<h4>Acabamento básico · grátis</h4><div class="ofc-amostras">${ESCRITORIO_PISOS_SALA.map(([id, nome]) => `<button type="button" aria-pressed="${pin.ferramenta === "balde" ? (escritorioPerfilDecoracao()?.sala_piso || "") === id : pin.piso === id}" onclick="${pin.ferramenta === "balde" ? `estiloSalaEscritorio('sala_piso','${id}',true)` : `escritorioPincel().movel='';escritorioPincel().piso='${id}';renderEscritorio()`}" aria-label="Piso ${nome}"><i style="background:${piso(id)}"></i><span>${nome}</span></button>`).join("")}</div>
<div class="ofc-ficha-acoes"><button type="button" class="ofc-secundario" onclick="limparPinturaEscritorio('sala_pisos')">Tirar a pintura do piso</button></div>${pin.ferramenta === "piso" ? escritorioFerramentasAreaHtml()+escritorioPisosAcervoHtml() : ""}`}
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
    const p = escritorioEncaixePiso(lx, ly, d, w, h, (x, y) => escritorioNivelQuarto(a, x, y));
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
  if (alvo.tipo === "acervo" && !escritorio.edicao?.aplicandoPisos) { escritorioAplicarAreaPiso([[x,y]]); return true; }
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
  if (escritorio.edicao) {
    escritorioEditorMudou(Boolean(doDesfazer));
    escritorioAplicarSalas();
    clearTimeout(escritorio.timerPintura);
    escritorio.timerPintura=setTimeout(()=>escritorio.mapa?.repintar?.(),40);
    return;
  }
  // Fora do editor, o fluxo de perfil continua salvando na hora.
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
  if (escritorio.edicao) { escritorioEditorMudou(); renderEscritorio(); return; }
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
  const pos = escritorioPosicao(escritorio.perfil || {}),camera=escritorio.edicao && escritorio.mapa.camera?.();
  escritorio.mapa.destruir();
  escritorio.mapa = null;
  renderEscritorio();
  if(camera){const mapa=escritorio.mapa;requestAnimationFrame(()=>{if(escritorio.mapa===mapa)mapa?.restaurarCamera?.(camera);});}
  else escritorio.mapa?.centralizar(pos.x, pos.y);
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
 if(!ESCRITORIO_DIM_PISOS.has(classe)){
  const entrada={x:1,y:1,pronto:false,erro:false};ESCRITORIO_DIM_PISOS.set(classe,entrada);
  entrada.carga=fetch(mapaArquivo(classe+'.json'),{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('Arte indisponível');return r.json();}).then(dados=>{
    const d=mapaDimensoes(dados,0);Object.assign(entrada,{x:Math.max(1,Math.round(d.x)),y:Math.max(1,Math.round(d.y)),pronto:true});
    if(escritorio.edicao&&escritorioPincel().movel===classe)renderEscritorio();
  }).catch(()=>{entrada.pronto=true;entrada.erro=true;});
 }
 return ESCRITORIO_DIM_PISOS.get(classe);
}
// Pisos do acervo (com animação, como água e grama): escolha um e pinte.
function escritorioEscolherPiso(classe) {
 const pin=escritorioPincel(); pin.movel=pin.movel===classe?'':classe;
 if(pin.movel) escritorioDimPiso(classe);
 renderEscritorio();
}
function escritorioPisosAcervoHtml() {
 const pin=escritorioPincel(),busca=String(pin.buscaPiso || '').toLowerCase();
 const lista=(escritorioCatalogo || []).filter(m=>m.categoria==='Pisos do acervo' && (!pin.familiaPiso || escritorioBuscaCombina(escritorioNomeMovel(m),pin.familiaPiso)) && escritorioBuscaCombina(escritorioNomeMovel(m),busca) && (!pin.somenteMeus || escritorioQuantidadeMovel(m.classe)>0));
 if(!escritorioCatalogo){carregarCatalogoEscritorio?.();return '<p class="ofc-nota">Carregando materiais…</p>';}
 const visiveis=lista.slice(0,pin.limitePisos || 24);
 return `<details class="ofc-pisos-catalogo" ${pin.movel||pin.buscaPiso?'open':''}><summary>Peças de piso · ${lista.length}</summary><p class="ofc-nota">Peças com tamanho próprio; o acabamento básico está acima. Use as guardadas ou compre somente o que faltar.</p><label>Buscar material<input id="office-piso-busca" type="search" value="${safeText(pin.buscaPiso || '')}" oninput="escritorioPincel().buscaPiso=this.value" placeholder="Madeira, mármore, água…"></label><button type="button" onclick="escritorioPincel().buscaPiso=document.getElementById('office-piso-busca').value;escritorioPincel().limitePisos=24;renderEscritorio()">Buscar materiais</button><label>Material<select onchange="escritorioPincel().familiaPiso=this.value;escritorioPincel().limitePisos=24;renderEscritorio()">${[['','Todos'],['madeira','Madeira'],['pedra','Pedra'],['mármore','Mármore'],['água','Água'],['grama','Grama'],['carpete','Carpete']].map(([id,n])=>`<option value="${id}" ${pin.familiaPiso===id?'selected':''}>${n}</option>`).join('')}</select></label><label><input type="checkbox" ${pin.somenteMeus?'checked':''} onchange="escritorioPincel().somenteMeus=this.checked;renderEscritorio()">Só disponíveis no inventário</label><div class="ofc-moveis ofc-pisos-acervo">${visiveis.map(m=>{
 const info=escritorioInfoLoja(m.classe),d=ESCRITORIO_DIM_PISOS.get(m.classe),q=escritorioOndeEstaMovel(m.classe);
 return `<button type="button" class="ofc-movel" aria-pressed="${pin.movel===m.classe}" onclick="escritorioEscolherPiso('${safeText(m.classe)}')"><img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(m.classe)}.png?size=64" alt="" onerror="miniaturaLocalEscritorio(this,'${safeText(m.classe)}')"><span>${safeText(escritorioNomeMovel(m))}</span><small>${d?.pronto&&!d.erro?`${d.x} × ${d.y} ladrilhos`:'Medidas ao selecionar'}</small><small>${q.guardados===Infinity?'Grátis':`${q.guardados} guardados · ${info.marco?'Conquista':info.restante===0?'Esgotado':!info.naVitrine?'Fora da vitrine':info.preco+' moedas/un.'}`}</small></button>`;
 }).join('')}</div>${!lista.length?'<p>Nenhum piso encontrado. Tente outro nome ou retire o filtro.</p>':''}${lista.length>visiveis.length?'<button type="button" onclick="escritorioPincel().limitePisos=(escritorioPincel().limitePisos||24)+24;renderEscritorio()">Mostrar mais</button>':''}</details>`;
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

// Cartão do jogador (Paulo, 21/10/2026: "ao passar o mouse ou clicar em
// alguém, aparecer informações legais… os selos das conquistas dele… para
// ficar imersivo"). Rosto, nome, título, nível, função, onde está, os três
// maiores troféus, a semana no ranking e os dias seguidos. Os números vêm do
// perfil público (o mesmo que toda a equipe já vê na ficha).
function escritorioCartaoJogadorHtml(id) {
  const b = escritorio.base, sid = String(id), pessoa = (b?.equipe || []).find((p) => String(p.id) === sid);
  if (!pessoa) return "";
  const eu = sid === String(b.eu), pub = escritorio.perfisPublicos?.[sid];
  const online = (escritorio.online || []).find((o) => String(o.id) === sid);
  const st = ESCRITORIO_STATUS[eu ? escritorio.status : online?.status] || null;
  const lugar = online || eu ? (typeof escritorioLugarDe === "function" ? escritorioLugarDe(eu ? null : online)?.nome : "") : "";
  const cabeca = typeof escritorioCabecaUrl === "function" ? escritorioCabecaUrl(sid) : "";
  const rk = escritorioRanking?.dados?.semana?.pessoas?.find((p) => String(p.id) === sid);
  const funcao = ESCRITORIO_FUNCAO_NOME[rk?.funcao] || "";
  const t = pessoa.titulo || (eu ? (b.equipe || []).find((e) => String(e.id) === String(b.eu))?.titulo : null);
  // Os três troféus de nível mais alto (um por escada).
  const melhores = (pub?.marcos || []).filter((m) => m.classe).sort((a, c) => (c.nivel || 0) - (a.nivel || 0)).filter((m, i, l) => l.findIndex((x) => String(x.id).split(":")[0] === String(m.id).split(":")[0]) === i).slice(0, 3);
  const pct = rk?.meta ? Math.min(100, rk.pct || 0) : null;
  return `<div class="cj">
<div class="cj-topo"><span class="cj-rosto${online || eu ? " on" : ""}">${cabeca ? `<img src="${safeText(cabeca)}" alt="" width="46" height="46">` : ""}${pub?.nivel ? `<b class="cj-nivel" title="Nível">${pub.nivel}</b>` : ""}</span>
<span class="cj-id"><b>${safeText(pessoa.nome)}</b>${t?.texto ? `<span class="vb-titulo n${Number(t.nivel) || 1}">${safeText(t.texto)}</span>` : ""}<small>${online || eu ? `${st ? `<i class="ofc-ponto" style="--st:${st[1]}"></i>${safeText(st[0])}` : ""}${lugar ? ` · ${safeText(lugar)}` : ""}` : "Fora do escritório"}${funcao ? ` · ${safeText(funcao)}` : ""}</small></span></div>
${pub === undefined ? '<div class="cj-trofeus carregando"><i></i><i></i><i></i></div>' : melhores.length ? `<div class="cj-trofeus">${melhores.map((m) => `<span class="cj-trofeu n${m.nivel || 1}" title="${safeText(m.nome)}">${escritorioMiniaturaHtml(m.classe)}<small>${safeText(m.nome.replace(/ (Bronze|Prata|Ouro|Diamante)$/, ""))}</small></span>`).join("")}${pub?.conquistas > 3 ? `<span class="cj-mais">+${pub.conquistas - melhores.length}<small>conquistas</small></span>` : ""}</div>` : '<p class="cj-vazio">Ainda sem troféus.</p>'}
<div class="cj-numeros">${rk?.posicao ? `<span><b>${rk.posicao}º</b><small>na semana</small></span>` : ""}${pct !== null ? `<span class="cj-meta"><i style="width:${pct}%"></i><b>${rk.pct}%</b><small>da meta</small></span>` : ""}${rk?.sequencia > 1 ? `<span><b>${rk.sequencia}</b><small>dias seguidos</small></span>` : ""}${pub?.saldo != null && !rk?.posicao ? `<span><b>${Number(pub.saldo).toLocaleString("pt-BR")}</b><small>VybeCoins</small></span>` : ""}</div>
</div>`;
}
function esconderCartaoJogadorEscritorio() {
  clearTimeout(escritorio.cartaoJogadorTimer);
  const el = document.getElementById("ofc-cartao-jogador");
  if (el) { el.classList.remove("aberto"); el.dataset.id = ""; }
}
function passarSobreJogadorEscritorio(id, on, alvo) {
  clearTimeout(escritorio.cartaoJogadorTimer);
  if (!on) { escritorio.cartaoJogadorTimer = setTimeout(esconderCartaoJogadorEscritorio, 120); return; }
  // Com o cartão do clique aberto para a mesma pessoa, o do mouse não aparece.
  if (escritorio.pessoaSelecionada === String(id)) return;
  escritorio.cartaoJogadorTimer = setTimeout(() => {
    let el = document.getElementById("ofc-cartao-jogador");
    if (!el) { el = document.createElement("div"); el.id = "ofc-cartao-jogador"; el.className = "cj-flutuante"; el.setAttribute("role", "tooltip"); document.body.append(el); }
    const pintar = () => {
      if (el.dataset.id !== String(id)) return;
      el.innerHTML = escritorioCartaoJogadorHtml(id);
      const r = alvo.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
      el.style.top = (r.top - h - 10 > 8 ? r.top - h - 10 : r.bottom + 10) + "px";
    };
    el.dataset.id = String(id);
    pintar();
    el.classList.add("aberto");
    carregarPerfilJogoEscritorio(id, pintar);
    // O ranking da semana dá a posição e os dias seguidos; busca uma vez.
    if (!escritorioRanking.dados.semana && !escritorioRanking.buscandoParaCartao) { escritorioRanking.buscandoParaCartao = true; escritorioApi("ranking").then((d) => { escritorioRanking.dados.semana = d; pintar(); }).catch(() => {}); }
  }, 260);
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

// Ranking da semana (Paulo, 20/10/2026: competição saudável). Geral pelo XP do
// trabalho desde 21/10/2026 (o % da meta virou Superação), por atividade e a meta da agência; prêmios do
// pódio e o resultado da semana passada. Tudo vem do servidor (rota ranking).
// Ranking 2 (Paulo, 21/10/2026: "um ranking visualmente FODA, com várias
// categorias, do dia, da semana, do mês e total"). Um período por vez (o
// servidor devolve o período e o anterior, para a seta de quem subiu), o
// cartão "Você" com o ritmo, o pódio, a grade de campeões por categoria e a
// lista com o ritmo de cada um. Tudo vem da rota ranking.
const escritorioRanking = { aba: "geral", periodo: "semana", dados: {}, erro: null, aberto: null, carregando: null };
const ESCRITORIO_FUNCAO_NOME = { criacao: "Criação", atendimento: "Atendimento", agendamento: "Agendamento", producao: "Produção", gestao: "Gestão" };
const RK_PERIODOS = [["dia", "Hoje"], ["semana", "Semana"], ["mes", "Mês"], ["total", "Sempre"]];
const RK_ICONES = {
  geral: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z"/>',
  xp: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
  moedas: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  entregas: '<path d="M4 12l5 5L20 6"/>',
  sequencia: '<path d="M12 3c1 3.5 5 5 5 10a5 5 0 01-10 0c0-2.5 1.5-4 2.5-5 .3 1.5 1 2.5 2 3 .5-3 .5-5.5.5-8z"/>',
  peca_criacao: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  peca_producao: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  peca_da: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  peca_atendimento: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5"/><path d="M16 4.6a3 3 0 010 6M18 14.8c1.6.8 2.6 2.5 3 5.2"/>',
  peca_agendamento: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/>',
  peca_gestao: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  briefing: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
  cadastro: '<path d="M12 5v14M5 12h14"/>',
  entrega_prazo: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  criacao_aprovada: '<path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.2 2.6L12.6 9H19a2 2 0 012 2.3l-1.3 7A2 2 0 0117.7 20H7"/>',
  acao_painel: '<path d="M5 3l14 8-6 1.5L10 19z"/>',
  tesouros: '<path d="M3 9l3-5h12l3 5-9 11z"/><path d="M3 9h18M9 4l3 16 3-16"/>',
  agencia: '<path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-5h4v5"/>',
};
const rkIcone = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${RK_ICONES[k] || RK_ICONES.geral}</svg>`;
function abrirRankingEscritorio(aba, periodo) {
  if (aba) escritorioRanking.aba = aba;
  if (periodo) escritorioRanking.periodo = periodo;
  if (!document.getElementById("ofc-ranking")) {
    openWorkflowModal('<div class="ofc-ranking rk2" id="ofc-ranking" role="dialog" aria-label="Ranking"></div>');
    document.getElementById("workflow-modal")?.classList.add("ofc-ranking-janela", "rk2-janela", "ofc-menu-jogo");
  }
  pintarRankingEscritorio();
  carregarRankingEscritorio();
}
async function carregarRankingEscritorio(periodo = escritorioRanking.periodo) {
  escritorioRanking.carregando = periodo;
  try { escritorioRanking.dados[periodo] = await escritorioApi("ranking", null, { periodo }); escritorioRanking.erro = null; }
  catch (e) { escritorioRanking.erro = e.message; }
  if (escritorioRanking.carregando === periodo) escritorioRanking.carregando = null;
  pintarRankingEscritorio();
}
function trocarPeriodoRankingEscritorio(periodo) {
  escritorioRanking.periodo = periodo; escritorioRanking.aberto = null;
  pintarRankingEscritorio();
  carregarRankingEscritorio(periodo); // com o período já carregado, atualiza por trás sem piscar
}
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
// As categorias: o que conta, como mostrar e o que é zero (fica de fora).
function rkCategorias(d) {
  const geralTotal = d.periodo === "total";
  const atv = (k, nome) => ({ k, nome, icone: k, valor: (p) => p.atividades?.[k] || 0, fmt: (v) => v.toLocaleString("pt-BR"), sub: (p) => ESCRITORIO_FUNCAO_NOME[p.funcao] || "", dica: `A ordem é por quantas vezes cada um teve "${(d.regras?.[k] || nome).replace(/ \(.*\)$/, "")}" no período.` });
  return [
    geralTotal
      ? { k: "geral", nome: "Nível", icone: "geral", valor: (p) => p.xpTotal || 0, fmt: (v, p) => `Nível ${p.nivel}`, sub: (p) => `${Number(p.xpTotal || 0).toLocaleString("pt-BR")} XP no total`, dica: "Desde sempre: vale o XP de todo o trabalho." }
      : { k: "geral", nome: "Geral", icone: "geral", valor: (p) => p.xp, fmt: (v) => `${v.toLocaleString("pt-BR")} XP`, sub: (p) => `${p.pct}% da própria meta`, dica: "A ordem é pelo XP do trabalho no período: cada contribuição recebe o valor das regras ativas, considerando papel e formato. Volume sozinho não determina a posição. Abra a pessoa para conferir formatos, etapas e origem do XP. Conquistas e prêmios da Copa não contam." },
    ...(geralTotal ? [] : [{ k: "superacao", nome: "Superação", icone: "sequencia", valor: (p) => (p.entregas ? p.pct : 0), fmt: (v) => `${v}%`, sub: (p) => `${p.entregas} entregas ÷ meta ${p.meta}`, dica: "A ordem é por quem mais superou o próprio ritmo: as entregas do período divididas pela meta de cada um (a média das suas entregas nas últimas 8 semanas). Bom para ver quem está melhorando; não decide pódio nem Copa." }]),
    { k: "xp", nome: "XP", icone: "xp", valor: (p) => p.xp, fmt: (v) => `${v.toLocaleString("pt-BR")} XP`, sub: (p) => `${p.moedas} moedas`, dica: "A ordem é pelo XP ganho trabalhando no período: peças, prazo, aprovação de primeira, briefings e ações no painel. Conquistas e prêmios do ranking não contam." },
    { k: "moedas", nome: "Moedas", icone: "moedas", valor: (p) => p.moedas, fmt: (v) => v.toLocaleString("pt-BR"), sub: (p) => `${p.xp} XP`, dica: "A ordem é pelas moedas ganhas trabalhando no período (sem compras, conquistas e prêmios). Os valores dependem das regras ativas de papel e formato." },
    { k: "entregas", nome: "Volume", icone: "entregas", valor: (p) => p.entregas, fmt: (v) => `${v}`, sub: (p) => (geralTotal ? "entregas" : `meta ${p.meta}`), dica: "A ordem é pelo número de entregas no período, de qualquer tipo, sem olhar a meta: quem fez mais coisas." },
    { k: "sequencia", nome: "Em chamas", icone: "sequencia", valor: (p) => p.sequencia || 0, fmt: (v) => `${v} ${v === 1 ? "dia" : "dias"}`, sub: () => "seguidos entregando", dica: "A ordem é pelos dias úteis seguidos com pelo menos uma entrega, até hoje. Sábado e domingo não quebram a sequência." },
    atv("peca_criacao", "Peças feitas"), atv("peca_producao", "Peças captadas"), atv("peca_atendimento", "Carteira"), atv("peca_agendamento", "Agendamento"),
    atv("peca_da", "Direção de arte"), atv("briefing", "Briefings no cadastro"), atv("entrega_prazo", "No prazo"), atv("criacao_aprovada", "De primeira"),
    atv("peca_gestao", "Peças da agência"), atv("acao_painel", "No painel"),
  ];
}
// Quantos de cada formato (Paulo, 21/10/2026: "passar o mouse em Peça feita
// por você e mostrar quantos cards, carrosséis…").
const RK_FORMATOS = { card: ["card", "cards"], feed: ["feed", "feeds"], post: ["post", "posts"], carrossel: ["carrossel", "carrosséis"], reels: ["reels", "reels"],
  story: ["story", "stories"], stories: ["story", "stories"], fotografia: ["foto", "fotos"], foto: ["foto", "fotos"], video: ["vídeo", "vídeos"], "vídeo": ["vídeo", "vídeos"],
  motion: ["motion", "motions"], impresso: ["impresso", "impressos"], avulso: ["avulso", "avulsos"], outro: ["outro", "outros"], "sem formato": ["demanda sem formato", "demandas sem formato"],
  "feed/story": ["demanda Feed/Story", "demandas Feed/Story"], "implementação": ["implementação", "implementações"], implementacao: ["implementação", "implementações"],
  design: ["demanda de design", "demandas de design"], digital: ["demanda digital", "demandas digitais"], "capa videos": ["capa de vídeo", "capas de vídeo"] };
// Mesma decomposição no ranking: volume legível sem depender de hover.
function escritorioRankingVolumeHtml(p) {
  const etapas = [["peca_criacao", "Criação e implementação"], ["peca_producao", "Peças com crédito de captação"], ["peca_agendamento", "Agendamento ou finalização"], ["peca_da", "Revisões como DA"], ["peca_atendimento", "Acompanhamento como head"], ["briefing", "Cadastros com briefing"]];
  const linhas = etapas.map(([k, nome]) => {
    const formatos = Object.entries(p.formatos?.[k] || {}).sort((a, b) => b[1] - a[1]);
    const n = Number(p.porRegra?.[k] || p.atividades?.[k] || 0);
    if (!n) return "";
    return `<li><span><b>${safeText(nome)}</b>${formatos.length ? `<small>${safeText(rkFormatosTexto(p.formatos[k]))}</small>` : ""}</span><b>${n.toLocaleString("pt-BR")}</b></li>`;
  }).join("");
  return `<div class="ofc-rk-det-col largo rk-volume"><h5>Volume por contribuição${p.demandasDistintas != null ? ` <small>${Number(p.demandasDistintas).toLocaleString("pt-BR")} demandas distintas com crédito</small>` : ""}</h5>${linhas ? `<ul class="ofc-rk-det-lista">${linhas}</ul>` : '<p class="ofc-nota">Sem contribuições registradas no período.</p>'}<p class="ofc-nota">Não some etapas como demandas únicas: uma peça pode ser criada, revisada e agendada. Cada demanda conta uma vez por etapa; pode conter várias telas ou variações. Fotografia é o formato cadastrado, não prova de tratamento. Captação conta peças, não sessões. Briefing no cadastro não comprova quem escreveu o texto.</p></div>`;
}
function rkFormatosTexto(f) {
  const l = Object.entries(f || {}).sort((a, b) => b[1] - a[1]);
  if (!l.length || (l.length === 1 && l[0][0] === "outro")) return "";
  return l.map(([k, n]) => { const par = RK_FORMATOS[k]; return `${n} ${par ? par[n === 1 ? 0 : 1] : k}`; }).join(" · ");
}
// O porquê de cada posição (Paulo, 21/10/2026: "não pode ter dúvida do
// porquê no ranking"): o que mais somou para a pessoa na categoria.
const RK_NOMES_CURTOS = {
  peca_criacao: ["peça feita", "peças feitas"], peca_producao: ["foto ou vídeo captado", "fotos e vídeos captados"],
  peca_atendimento: ["peça da carteira", "peças da carteira"], peca_agendamento: ["peça postada", "peças postadas"],
  peca_gestao: ["peça da agência", "peças da agência"], peca_da: ["aprovação de DA", "aprovações de DA"],
  briefing: ["briefing", "briefings"], cadastro: ["cadastro", "cadastros"], entrega: ["solicitação finalizada", "solicitações finalizadas"],
  dia_sem_furo: ["dia sem furo", "dias sem furo"], entrega_prazo: ["no prazo", "no prazo"], criacao_aprovada: ["de primeira", "de primeira"],
  acao_painel: ["ação no painel", "ações no painel"], carteira: ["peça da carteira", "peças da carteira"], agendamento: ["peça agendada", "peças agendadas"],
  captacao: ["captação", "captações"], agencia: ["peça da agência", "peças da agência"], criacao_aprovacao: ["peça para aprovação", "peças para aprovação"],
};
function rkPorque(cat, p, d) {
  const curto = (k, n = 2) => { const par = RK_NOMES_CURTOS[k]; return par ? par[n === 1 ? 0 : 1] : String(d.regras?.[k] || k).replace(/ \(.*\)$/, "").toLowerCase(); };
  const top = (obj, n, fmt) => Object.entries(obj || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => fmt(k, v)).join(" · ");
  if (d.periodo === "total") return "";
  if (cat.k === "superacao" || cat.k === "entregas") return top(p.porRegra, 3, (k, v) => `${v} ${curto(k, v)}`) || "nenhuma entrega no período";
  if (cat.k === "geral" || cat.k === "xp" || cat.k === "moedas") return top(p.xpPor, 3, (k, v) => `+${v.toLocaleString("pt-BR")} XP de ${curto(k)}`) || "nada no período";
  if (cat.k === "sequencia") return p.sequencia > 0 ? `entregou em ${p.sequencia} ${p.sequencia === 1 ? "dia útil" : "dias úteis seguidos"}` : "sem entrega hoje nem ontem";
  return "";
}
// Ritmo: XP por dia (ou por semana, em "Sempre") num gráfico de linha.
function rkRitmo(d, p, max) {
  const pontos = rkEixo(d).map((dia) => Number((p.ritmo || []).find(([x]) => x === dia)?.[1] || 0));
  if (pontos.length < 2) return "";
  const w = 84, h = 26, m = Math.max(1, max), x = (i) => (i / (pontos.length - 1)) * w, y = (v) => h - 2 - (v / m) * (h - 4);
  const linha = pontos.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return `<svg class="rk2-ritmo" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polygon points="0,${h} ${linha} ${w},${h}"/><polyline points="${linha}"/><circle cx="${x(pontos.length - 1).toFixed(1)}" cy="${y(pontos.at(-1)).toFixed(1)}" r="2.4"/></svg>`;
}
function rkEixo(d) {
  const soma = (iso, n) => { const t = new Date(iso + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  if (d.periodo === "dia") return [];
  if (d.periodo === "total") { const segunda = soma(d.hoje, -((new Date(d.hoje + "T12:00:00Z").getUTCDay() + 6) % 7)); return Array.from({ length: 12 }, (_, i) => soma(segunda, (i - 11) * 7)); }
  const fim = d.fim < d.hoje ? d.fim : d.hoje, dias = [];
  for (let x = d.inicio; x <= fim && dias.length < 40; x = soma(x, 1)) dias.push(x);
  return dias;
}
function rkSeta(p) {
  if (escritorioRanking.periodo === "total") return "";
  if (!p.posicao || !p.antes) return p.posicao && !p.antes ? '<span class="rk2-seta novo" title="Entrou no ranking">novo</span>' : "";
  const n = p.antes - p.posicao;
  if (!n) return '<span class="rk2-seta igual" title="Mesma posição do período anterior">=</span>';
  return `<span class="rk2-seta ${n > 0 ? "sobe" : "desce"}" title="${n > 0 ? "Subiu" : "Desceu"} ${Math.abs(n)} ${Math.abs(n) === 1 ? "posição" : "posições"}">${n > 0 ? "▲" : "▼"}${Math.abs(n)}</span>`;
}
function pintarRankingEscritorio() {
  const el = document.getElementById("ofc-ranking");
  if (!el) return;
  // Onde cada pessoa estava antes de redesenhar: depois ela desliza até o lugar novo.
  const antes = new Map([...el.querySelectorAll("[data-pid]")].map((n) => [n.dataset.pid + (n.classList.contains("rk2-degrau") ? "p" : "l"), n.getBoundingClientRect()]));
  const chaveAntes = el.dataset.rkChave || "";
  // Redesenhar (abrir uma linha, chegar dado novo) não volta a rolagem ao topo.
  const rolagem = el.querySelector(".rk2-corpo")?.scrollTop || 0;
  const per = escritorioRanking.periodo, d = escritorioRanking.dados[per], eu = String(escritorio.base?.eu || "");
  const dataBr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
  const nome = (p) => String(p.nome || "").split(" ")[0];
  const rosto = (id, tam = 32) => { const u = escritorioCabecaUrl(id); return u ? `<img class="ofc-rk-rosto" src="${safeText(u)}" alt="" width="${tam}" height="${tam}" loading="lazy">` : `<span class="ofc-rk-rosto vazio" style="width:${tam}px;height:${tam}px"></span>`; };
  const hoje = typeof hojeDeVerdade === "function" ? hojeDeVerdade() : new Date().toISOString().slice(0, 10);
  const faltam = d?.fim ? Math.max(0, Math.round((Date.parse(d.fim) - Date.parse(hoje)) / 864e5)) : null;
  const fecha = per === "total" ? "desde o começo" : per === "dia" ? "fecha hoje à meia-noite" : faltam === 0 ? "fecha hoje à meia-noite" : faltam === 1 ? "fecha amanhã" : `fecha em ${faltam} dias`;
  const titulo = { dia: "Ranking de hoje", semana: "Ranking da semana", mes: "Ranking do mês", total: "Ranking de sempre" }[per];
  const intervalo = !d?.inicio ? "" : per === "dia" ? dataBr(d.inicio) : per === "mes" ? new Date(d.inicio + "T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" }) : `${dataBr(d.inicio)} a ${dataBr(d.fim)}`;
  const topo = `<header class="rk2-cab"><span class="rk2-cab-icone">${rkIcone("geral")}</span><div><h2>${titulo}</h2><small>${[intervalo, fecha].filter(Boolean).map(safeText).join(" · ")}</small></div><button type="button" class="ofc-rk-x" onclick="closeWorkflowModal()" aria-label="Fechar">×</button></header>
<div class="rk2-periodos" role="tablist" aria-label="Período">${RK_PERIODOS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${per === k}" onclick="trocarPeriodoRankingEscritorio('${k}')">${t}</button>`).join("")}</div>`;
  if (escritorioRanking.erro && !d) { el.innerHTML = topo + `<div class="rk2-corpo">${vbEstadoHtml({ tipo: "erro", titulo: "Não deu para carregar o ranking", texto: escritorioRanking.erro, acao: '<button type="button" class="vb-botao" onclick="carregarRankingEscritorio()">Tentar de novo</button>' })}</div>`; return; }
  if (!d) { el.innerHTML = topo + `<div class="rk2-corpo">${vbEstadoHtml({ tipo: "carregando", titulo: "Carregando o ranking" })}</div>`; return; }
  if (!d.disponivel) { el.innerHTML = topo + `<div class="rk2-corpo">${vbEstadoHtml({ titulo: "O ranking ainda não começou", texto: "Ele aparece quando a contagem de pontos estiver ativa." })}</div>`; return; }
  const cats = rkCategorias(d);
  const extra = [{ k: "tesouros", nome: "Tesouros", icone: "tesouros" }, ...(per === "total" ? [] : [{ k: "agencia", nome: "Agência", icone: "agencia" }])];
  const cat = cats.find((c) => c.k === escritorioRanking.aba) || (extra.find((c) => c.k === escritorioRanking.aba) ? null : cats[0]);
  const aba = cat ? cat.k : escritorioRanking.aba;
  const premio = (k) => d.premios?.find((p) => p.chave === k);
  const ordenar = (c) => [...d.pessoas].map((p) => ({ p, v: c.valor(p) })).sort((a, b) => b.v - a.v || b.p.xp - a.p.xp || a.p.nome.localeCompare(b.p.nome));
  // Categorias (Paulo, 21/10/2026: "ta ruim ver e decidir as categorias"):
  // as cinco principais em cartões com o líder; as de atividade em chips que
  // quebram linha, só as que alguém pontuou. A sua posição só na escolhida.
  const escolher = (k) => `onclick="escritorioRanking.aba='${k}';escritorioRanking.aberto=null;pintarRankingEscritorio()"`;
  const PRINCIPAIS = ["geral", "superacao", "moedas", "entregas", "sequencia"];
  // A arte de cada categoria é um troféu do Habbo (o mesmo jogo das Conquistas).
  const RK_ARTE = { geral: "trophy_fball_c26_wingedgold", superacao: "prizetrophy_hot", moedas: "bc_blocktrophy_1", entregas: "army_c15_crate", sequencia: "trophy_torch" };
  const cartoes = cats.filter((c) => PRINCIPAIS.includes(c.k)).map((c) => {
    const ord = ordenar(c).filter((x) => x.v > 0), lider = ord[0], minha = ord.findIndex((x) => x.p.id === eu);
    return `<button type="button" class="rk2-camp${aba === c.k ? " ativo" : ""}${lider?.p.id === eu ? " meu" : ""}" aria-pressed="${aba === c.k}" title="${safeText(c.dica || "")}" ${escolher(c.k)}>
      <span class="rk2-camp-arte">${escritorioMiniaturaHtml(RK_ARTE[c.k] || "prizetrophy")}</span><span class="rk2-camp-txt"><small>${safeText(c.nome)}</small>${lider ? `<b>${safeText(nome(lider.p))}</b><em>${safeText(c.fmt(lider.v, lider.p))}</em>` : "<b>—</b>"}</span>${lider ? rosto(lider.p.id, 26) : ""}${aba === c.k && minha > 0 ? `<i class="rk2-camp-eu">você ${minha + 1}º</i>` : ""}</button>`;
  }).join("");
  const chipsAtv = [...cats.filter((c) => !PRINCIPAIS.includes(c.k) && c.k !== "xp").map((c) => {
    const lider = ordenar(c).find((x) => x.v > 0);
    return lider ? `<button type="button" class="rk2-chip${aba === c.k ? " ativo" : ""}" aria-pressed="${aba === c.k}" title="${safeText(c.dica || `Quem mais fez: ${c.nome.toLowerCase()}`)}" ${escolher(c.k)}><span class="rk2-chip-icone ic-${c.k}">${rkIcone(c.icone)}</span><span class="rk2-chip-txt">${safeText(c.nome)}</span></button>` : "";
  }), ...extra.map((c) => `<button type="button" class="rk2-chip${aba === c.k ? " ativo" : ""}" aria-pressed="${aba === c.k}" ${escolher(c.k)}><span class="rk2-chip-icone ic-${c.k}">${rkIcone(c.icone)}</span>${c.nome}${c.k === "agencia" ? `<b>${d.agencia.pct}%</b>` : ""}</button>`)].join("");
  const campeoes = `<div class="rk2-principais" role="group" aria-label="Categorias">${cartoes}</div>${chipsAtv ? `<div class="rk2-chips" role="group" aria-label="Por atividade"><small>Por atividade</small>${chipsAtv}</div>` : ""}`;
  escritorioRanking.detalheDe = (p) => detalhe(p);
  const detalhe = (p) => {
    if (!p) return "";
    const regra = (k) => safeText(d.regras?.[k] || k);
    const contou = Object.entries(p.porRegra || {}).sort((a, b) => b[1] - a[1]);
    const xp = Object.entries(p.xpPor || {}).sort((a, b) => b[1] - a[1]);
    const ritmo = rkRitmo(d, p, Math.max(1, ...d.pessoas.flatMap((q) => (q.ritmo || []).map(([, v]) => v))));
    return `<div class="ofc-rk-detalhe">${escritorioRankingVolumeHtml(p)}${ritmo ? `<div class="ofc-rk-det-col largo rk2-det-ritmo"><h5>Ritmo do XP <small>${per === "total" ? "por semana" : "por dia"}</small></h5>${ritmo}</div>` : ""}<div class="ofc-rk-det-col"><h5>Contou como entrega <small>${p.entregas} no período${per === "total" ? "" : ` · meta ${p.meta}`}</small></h5>${contou.length ? `<ul class="ofc-rk-det-lista">${contou.map(([k, n]) => { const dica = rkFormatosTexto(p.formatos?.[k]); return `<li${dica ? ` class="vb-jogo-dica" tabindex="0" data-dica="${safeText(dica)}"` : ""}><span>${regra(k)}</span><b>${n}</b></li>`; }).join("")}</ul>` : '<p class="ofc-nota">Nenhuma entrega no período ainda.</p>'}</div>
<div class="ofc-rk-det-col"><h5>De onde veio o XP <small>${p.xp} XP</small></h5>${xp.length ? `<ul class="ofc-rk-det-lista">${xp.map(([k, n]) => { const vezes = Number(p.atividades?.[k] || 0), f = rkFormatosTexto(p.formatos?.[k]); const dica = [vezes ? `${vezes.toLocaleString("pt-BR")} ${vezes === 1 ? "vez" : "vezes"}${vezes > 1 ? ` · média de ${Math.round(n / vezes)} XP por vez` : ""}` : "", f].filter(Boolean).join(" · "); return `<li${dica ? ` class="vb-jogo-dica" tabindex="0" data-dica="${safeText(dica)}"` : ""}><span>${regra(k)}</span><b>${n > 0 ? "+" : ""}${n.toLocaleString("pt-BR")} XP</b></li>`; }).join("")}</ul>` : '<p class="ofc-nota">Nada ainda.</p>'}</div>
${p.pecas?.length ? `<div class="ofc-rk-det-col largo"><h5>As entregas <small>${p.pecas.length < p.entregas ? `as ${p.pecas.length} mais recentes` : "do período"}</small></h5><ul class="ofc-rk-det-pecas">${p.pecas.map((x) => `<li><time>${dataBr(x.dia)}</time><span><b>${safeText(x.titulo || "Sem título")}</b>${x.cliente ? `<small>${safeText(x.cliente)}</small>` : ""}</span><em>${regra(x.regra).replace(/ \(.*\)$/, "")}</em></li>`).join("")}</ul></div>` : ""}</div>`;
  };
  let corpo = "", voceFixa = "";
  if (cat) {
    const geral = cat.k === "geral";
    const ord = ordenar(cat), vivos = ord.filter((x) => x.v > 0);
    const max = Math.max(1, ...ord.map((x) => x.v), 1);
    const posDe = (x) => vivos.indexOf(x) + 1 || null;
    const eu_ = ord.find((x) => x.p.id === eu), minha = ord.findIndex((x) => x.p.id === eu);
    let dica = "";
    if (eu_) {
      const acima = ord[minha - 1];
      if (minha === 0 && eu_.v > 0) dica = `Você lidera ${geral ? "o período" : `em ${cat.nome}`}. Segure o 1º lugar.`;
      else if (acima && geral && per === "total") dica = `Faltam <b>${Math.max(1, Number(acima.p.xpTotal || 0) - Number(eu_.p.xpTotal || 0) + 1).toLocaleString("pt-BR")} XP</b> para passar ${safeText(nome(acima.p))}.`;
      else if (acima) dica = `Faltam <b>${safeText(cat.fmt(Math.max(1, acima.v - eu_.v + 1), acima.p))}</b> para passar ${safeText(nome(acima.p))}.`;
      else dica = "Entregue para entrar neste ranking.";
    }
    const voce = eu_ ? `<section class="rk2-voce rk2-voce-fixa" aria-label="Sua posição"><div class="rk2-voce-pos"><b>${posDe(eu_) ? posDe(eu_) + "º" : "—"}</b>${geral ? rkSeta(eu_.p) : ""}</div>${rosto(eu_.p.id, 46)}<div class="rk2-voce-txt"><b>Você · <span data-vb-contar="${Number(eu_.v)}" data-vb-chave="rk-${per}-${cat.k}">${safeText(cat.fmt(eu_.v, eu_.p))}</span></b><small>${safeText(cat.sub(eu_.p))}${eu_.p.sequencia > 1 ? ` · ${eu_.p.sequencia} dias seguidos entregando` : ""}</small><p>${dica} <button type="button" class="ofc-rk-link" onclick="verMinhaLinhaRankingEscritorio()">Ver o que contou</button></p></div>${geral && per !== "total" ? `<span class="ofc-rk-anel" style="--p:${Math.min(100, eu_.p.pct)}" aria-hidden="true"><i>${eu_.p.pct}%</i></span>` : ""}</section>` : "";
    const tres = vivos.slice(0, 3);
    const podio = tres.length ? `<div class="rk2-podio">${[tres[1], tres[0], tres[2]].filter(Boolean).map((x) => { const pos = tres.indexOf(x) + 1, pr = geral && per === "semana" ? premio("ranking_" + pos) : null;
      return `<button type="button" data-pid="${x.p.id}" class="rk2-degrau p${pos}${x.p.id === eu ? " eu" : ""}" style="--atraso:${[0, 0.15, 0, 0.3][pos]}s" onclick="abrirDetalheRankingEscritorio('${x.p.id}', this)" aria-label="${pos}º lugar: ${safeText(nome(x.p))}, ${safeText(cat.fmt(x.v, x.p))}">
        ${pos === 1 ? '<span class="rk2-coroa" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg></span>' : ""}
        <div class="ofc-rk-figura">${escritorioRankingBoneco(x.p.id, pos === 1 ? "wav" : "std") || rosto(x.p.id, 56)}${pr ? escritorioRankingTrofeu(pr.classe) : ""}<span class="rk2-selo" title="Nível ${x.p.nivel || "—"}">${x.p.nivel || "—"}</span></div>
        <b class="ofc-rk-dnome">${safeText(nome(x.p))}${x.p.id === eu ? " · você" : ""}</b><span class="ofc-rk-dvalor" data-rk-num="${Number(x.v)}" data-rk-fmt="${safeText(cat.fmt(1234567, x.p).replace("1.234.567", "#").replace("1234567", "#"))}">${safeText(cat.fmt(x.v, x.p))}</span><small>${safeText(cat.sub(x.p))}${geral ? " " + rkSeta(x.p) : ""}</small>${rkPorque(cat, x.p, d) ? `<span class="rk2-porque">${safeText(rkPorque(cat, x.p, d))}</span>` : ""}
        <div class="rk2-bloco"><span>${pos}º</span></div>${pr ? `<em class="rk2-premio" title="Prêmio no fechamento da semana">+${pr.moedas} moedas · +${pr.pontos} XP</em>` : ""}</button>`; }).join("")}</div>` : vbEstadoHtml({ titulo: "Ninguém pontuou aqui ainda", texto: "O primeiro a entregar abre o pódio." });
    const lista = ord.length > tres.length ? `<ol class="rk2-lista">${ord.slice(tres.length).map((x, k) => { const pos = posDe(x);
      return `<li data-pid="${x.p.id}" class="${x.p.id === eu ? "eu" : ""}${escritorioRanking.aberto === x.p.id ? " aberto" : ""}" style="--i:${k}" role="button" tabindex="0" aria-expanded="${escritorioRanking.aberto === x.p.id}" onclick="abrirDetalheRankingEscritorio('${x.p.id}', this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirDetalheRankingEscritorio('${x.p.id}', this)}">
        <span class="rk2-pos">${pos ? pos + "º" : "—"}${geral && per !== "total" ? rkSeta(x.p) : ""}</span><span class="rk2-avatar">${rosto(x.p.id)}<span class="rk2-selo mini" title="Nível ${x.p.nivel || "—"}">${x.p.nivel || "—"}</span></span><span class="rk2-nome">${(() => { const t = (escritorio.base?.equipe || []).find((e) => String(e.id) === String(x.p.id))?.titulo; return `<b>${safeText(nome(x.p))}${t?.texto ? `<em class="mapa-titulo rk2-titulo n${Number(t.nivel) || 1}"><i aria-hidden="true"></i><span>${safeText(t.texto)}</span></em>` : ""}</b><small>${safeText(ESCRITORIO_FUNCAO_NOME[x.p.funcao] || "")}${rkPorque(cat, x.p, d) ? ` · <span class="rk2-porque">${safeText(rkPorque(cat, x.p, d))}</span>` : ""}</small>`; })()}</span>
        <span class="rk2-barra" aria-hidden="true"><i style="width:${Math.max(2, Math.min(100, (x.v / max) * 100))}%"></i></span><span class="rk2-valor"><b data-rk-num="${Number(x.v)}" data-rk-fmt="${safeText(cat.fmt(1234567, x.p).replace("1.234.567", "#").replace("1234567", "#"))}">${safeText(cat.fmt(x.v, x.p))}</b><small>${safeText(cat.sub(x.p))}</small></span></li>${escritorioRanking.aberto === x.p.id ? `<li class="ofc-rk-det-li">${detalhe(x.p)}</li>` : ""}`; }).join("")}</ol>` : "";
    const copaMes = per === "mes" && geral ? `<div class="rk2-copa">${escritorio.copaArte ? `<img src="${escritorio.copaArte}" alt="" width="44" height="50">` : ""}<span><b>Copa Vybe de ${safeText(new Date((d.inicio || hoje) + "T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" }))}</b><small>Quem tiver mais XP do trabalho no fim do mês leva a taça da Copa (épica), o título "Campeão da Copa" e ${(() => { const r = d.premios?.find((x) => x.chave === "copa_1"); return r ? `+${r.moedas} moedas · +${r.pontos} XP` : "o prêmio"; })()}. 2º e 3º levam as taças de prata e bronze. ${safeText(fecha)}.</small></span></div>` : "";
    corpo = `<div class="rk2-duas"><div class="rk2-meio">${copaMes}<p class="rk2-regra"><b>Por que essa ordem?</b> ${safeText(cat.dica || "")}</p>${podio}${tres.some((x) => x.p.id === escritorioRanking.aberto) ? detalhe(tres.find((x) => x.p.id === escritorioRanking.aberto).p) : ""}</div>${lista ? `<div class="rk2-direita">${lista}</div>` : ""}</div>`;
    voceFixa = voce;
  } else if (aba === "tesouros") {
    const pat = d.patrimonio || [];
    const ricos = [...pat].sort((a, b) => b.saldo - a.saldo), colec = [...pat].sort((a, b) => b.moveis - a.moveis || b.lendarios - a.lendarios || b.distintos - a.distintos);
    const coluna = (titulo, dica, lst, valor, sub) => `<section class="ofc-rk-tesouro"><h4>${titulo}</h4><small>${dica}</small><ol>${lst.map((p, i) => `<li class="${p.id === eu ? "eu" : ""}${i < 3 ? " top" + (i + 1) : ""}"><span class="ofc-rk-pos">${i + 1}º</span>${rosto(p.id, i < 3 ? 36 : 28)}<span class="ofc-rk-nome"><b>${safeText(nome(p))}</b><small>${sub(p)}</small></span><span class="ofc-rk-valor"><b>${valor(p)}</b></span></li>`).join("")}</ol></section>`;
    corpo = `<p class="ofc-rk-legenda">De todos os tempos.</p><div class="ofc-rk-tesouros">${coluna("Mais rico", "VybeCoins na carteira agora", ricos, (p) => `${Number(p.saldo).toLocaleString("pt-BR")}`, () => "VybeCoins")}${coluna("Colecionador", "Móveis guardados e no quarto", colec, (p) => `${p.moveis}`, (p) => [`${p.distintos} diferentes`, p.lendarios ? `${p.lendarios} lendários` : "", p.trofeus ? `${p.trofeus} troféus` : ""].filter(Boolean).join(" · "))}</div>`;
  } else {
    const a = d.agencia, bonus = premio("meta_agencia"), falta = Math.max(0, a.meta - a.pecas);
    const dias = Math.max(1, (faltam ?? 0) + 1), ritmo = Math.ceil(falta / dias);
    corpo = `<section class="ofc-rk-agencia${a.bateu ? " bateu" : ""}"><div class="ofc-rk-ag-num"><strong>${a.pecas}</strong><span>de ${a.meta} peças</span></div><div class="ofc-rk-ag-barra" aria-hidden="true"><i style="width:${Math.min(100, a.pct)}%"></i></div><p>${a.bateu ? "<b>Meta batida!</b>" : `Faltam <b>${falta} peças</b>, cerca de ${ritmo} por dia.`}${per === "semana" && bonus ? ` No fechamento da semana, se a agência bater, todo mundo ganha <b>+${bonus.moedas} moedas e +${bonus.pontos} XP</b>.` : ""}</p><div class="ofc-rk-equipe">${d.pessoas.map((p) => `<span title="${safeText(nome(p))}: ${p.entregas} entregas">${rosto(p.id, 30)}</span>`).join("")}</div><small>A meta é a média de peças por semana nas últimas 8 semanas, na proporção do período. Cada peça conta uma vez.</small></section>`;
  }
  const anterior = per === "semana" && d.anterior?.podio?.length ? `<div class="ofc-rk-anterior"><small>Semana passada</small>${[...d.anterior.podio].sort((x, y) => x.posicao - y.posicao).map((p) => `<span>${p.posicao}º ${rosto(p.id, 22)} ${safeText(nome(p))}</span>`).join("")}${d.anterior.agenciaBateu ? '<span class="ok">Agência bateu a meta</span>' : ""}</div>` : "";
  const como = `<details class="ofc-rk-como"><summary>Como funciona</summary><ul><li><b>Geral:</b> o % da <b>sua própria meta</b> (a média das suas entregas nas últimas 8 semanas, na proporção do período). Criação, Produção, Atendimento, Agendamento e Gestão competem por igual. Em "Sempre" vale o nível.</li><li><b>Setas:</b> quanto você subiu ou desceu no Geral desde o período anterior (ontem, semana passada, mês passado).</li><li><b>Prêmios</b> só no ranking da semana, no domingo à meia-noite: ${["ranking_1", "ranking_2", "ranking_3"].map((k, i) => { const p = premio(k); return p ? `${i + 1}º ${p.moedas} moedas e ${p.pontos} XP` : ""; }).filter(Boolean).join(" · ")}, com o troféu da semana.</li><li><b>Categorias:</b> quem mais fez cada tipo de trabalho; a linha de cada pessoa mostra o ritmo do XP no período.</li><li><b>Em chamas:</b> dias úteis seguidos com entrega, até hoje.</li><li>Todo mundo vê o ranking de todo mundo.</li></ul></details>`;
  // Menu largo (Paulo, 21/10/2026: "ganhar espaço dos lados… parecer um menu do
  // personagem"): com tela larga, categorias numa coluna e o resto ao lado.
  el.innerHTML = topo + `<div class="rk2-corpo${escritorioRanking.carregando === per ? " atualizando" : ""}"><div class="rk2-grade"><aside class="rk2-lado">${campeoes}</aside><div class="rk2-principal">${corpo}${anterior}${como}</div></div>${voceFixa}</div>`;
  if (chaveAntes.split(":")[0] === per) el.querySelector(".rk2-corpo").scrollTop = rolagem;
  rkVigiarMinhaLinha(el, eu);
  if (typeof vbAnimarContagens === "function") vbAnimarContagens(el);
  el.dataset.rkChave = per + ":" + aba;
  rkAnimar(el, antes, chaveAntes !== el.dataset.rkChave, chaveAntes.split(":")[0] !== per);
}
// A barra "Você" fica fixa embaixo e some quando a sua linha (ou o seu lugar
// no pódio) está na tela, para não mostrar você duas vezes.
function rkVigiarMinhaLinha(el, eu) {
  escritorioRanking.vigia?.disconnect();
  const barra = el.querySelector(".rk2-voce-fixa"), minha = el.querySelector(`[data-pid="${CSS.escape(eu)}"]`), corpo = el.querySelector(".rk2-corpo");
  if (!barra || !minha || typeof IntersectionObserver !== "function") return;
  escritorioRanking.vigia = new IntersectionObserver(([e]) => barra.classList.toggle("escondida", e.isIntersecting), { root: corpo, threshold: 0.6 });
  escritorioRanking.vigia.observe(minha);
}
function verMinhaLinhaRankingEscritorio() {
  const eu = String(escritorio.base?.eu || "");
  abrirDetalheRankingEscritorio(eu, document.querySelector(`#ofc-ranking [data-pid="${CSS.escape(eu)}"]`) || document.querySelector("#ofc-ranking .rk2-voce-fixa"));
}

// Movimento de jogo (respeita "Reduzir movimento"): quem trocou de lugar
// desliza até a posição nova (FLIP), os números sobem contando e o 1º lugar
// ganha confete quando o pódio muda.
function rkAnimar(el, antes, mudou, festa) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !el.animate) return;
  for (const n of el.querySelectorAll("[data-pid]")) {
    const a = antes.get(n.dataset.pid + (n.classList.contains("rk2-degrau") ? "p" : "l"));
    if (!a) continue;
    const b = n.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    n.style.animation = "none";
    n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.2,.9,.25,1.15)" });
  }
  if (!mudou) return;
  for (const n of el.querySelectorAll("[data-rk-num]")) {
    const alvo = Number(n.dataset.rkNum), fmt = n.dataset.rkFmt || "#";
    if (!Number.isFinite(alvo) || alvo <= 0 || !fmt.includes("#")) continue;
    const t0 = performance.now(), dur = 700 + Math.min(500, alvo * 2);
    const passo = (t) => { const p = Math.min(1, (t - t0) / dur), v = Math.round(alvo * (1 - Math.pow(1 - p, 3)));
      n.textContent = fmt.replace("#", v.toLocaleString("pt-BR")); if (p < 1 && n.isConnected) requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
  }
  const ouro = el.querySelector(".rk2-degrau.p1 .rk2-bloco");
  if (ouro && festa) setTimeout(() => rkConfete(ouro), 450);
}
function rkConfete(alvo) {
  const r = alvo.getBoundingClientRect(), c = document.createElement("canvas");
  c.className = "rk2-confete"; c.width = innerWidth; c.height = innerHeight; document.body.append(c);
  const g = c.getContext("2d"), cores = ["#ffd35c", "#ff8a35", "#ffffff", "#7ff0b4", "#8f7bff", "#ff8fc7"];
  const ps = Array.from({ length: 70 }, () => ({ x: r.left + r.width / 2, y: r.top + 10, vx: (Math.random() - .5) * 9, vy: -Math.random() * 9 - 4, s: 4 + Math.random() * 4, a: Math.random() * 6, va: (Math.random() - .5) * .4, cor: cores[Math.floor(Math.random() * cores.length)] }));
  const t0 = performance.now();
  const quadro = (t) => {
    const vida = (t - t0) / 1400; g.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.vy += .32; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va; g.save(); g.globalAlpha = Math.max(0, 1 - vida); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.cor; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
    if (vida < 1) requestAnimationFrame(quadro); else c.remove();
  };
  requestAnimationFrame(quadro);
}

// O detalhe abre num cartão ao lado da pessoa (Paulo, 21/10/2026: "não
// gosto de ficar rolando; quando clica na pessoa, abre o hover dela"), no
// mesmo estilo das Conquistas. Fecha no X, no Esc ou clicando fora.
function abrirDetalheRankingEscritorio(id, alvo) {
  const raiz = document.getElementById("ofc-ranking");
  const d = escritorioRanking.dados[escritorioRanking.periodo], p = d?.pessoas?.find((x) => x.id === String(id));
  if (!raiz || !p || typeof escritorioRanking.detalheDe !== "function") return;
  let pop = document.getElementById("rk2-pop");
  if (pop && pop.dataset.id === String(id)) { fecharDetalheRankingEscritorio(); return; }
  if (!pop) { pop = document.createElement("div"); pop.id = "rk2-pop"; pop.className = "rk2-pop"; pop.setAttribute("role", "dialog"); document.body.append(pop); }
  pop.dataset.id = String(id);
  const rosto = typeof escritorioCabecaUrl === "function" ? escritorioCabecaUrl(id) : "";
  pop.innerHTML = `<div class="rk2-pop-topo">${rosto ? `<img src="${safeText(rosto)}" alt="" width="40" height="40">` : ""}<span><b>${safeText(p.nome)}</b><small>${safeText(ESCRITORIO_FUNCAO_NOME[p.funcao] || "")}${p.posicao ? ` · ${p.posicao}º no Geral` : ""} · ${Number(p.xp || 0).toLocaleString("pt-BR")} XP · ${p.pct}% da própria meta</small></span><button type="button" class="ofc-rk-x" onclick="fecharDetalheRankingEscritorio()" aria-label="Fechar">×</button></div>${escritorioRanking.detalheDe(p)}`;
  pop.setAttribute("aria-label", "Detalhe de " + p.nome);
  // Ao lado de quem foi clicado: à direita se couber, senão à esquerda.
  const r = (alvo || raiz).getBoundingClientRect(), w = Math.min(600, innerWidth - 24);
  pop.style.width = w + "px";
  const esquerda = r.right + 12 + w <= innerWidth - 12 ? r.right + 12 : Math.max(12, r.left - 12 - w);
  pop.style.left = (r.right + 12 + w > innerWidth - 12 && r.left - 12 - w < 12 ? Math.max(12, (innerWidth - w) / 2) : esquerda) + "px";
  pop.style.top = "12px";
  requestAnimationFrame(() => { const h = pop.offsetHeight; pop.style.top = Math.max(12, Math.min(innerHeight - h - 12, r.top + r.height / 2 - h / 2)) + "px"; pop.classList.add("aberto"); });
  if (!escritorioRanking.fecharPop) {
    escritorioRanking.fecharPop = (e) => { const el = document.getElementById("rk2-pop"); if (!el) return; if (e.type === "keydown" ? e.key === "Escape" : !el.contains(e.target) && !e.target.closest?.("[data-pid]")) fecharDetalheRankingEscritorio(); };
    document.addEventListener("pointerdown", escritorioRanking.fecharPop, true);
    document.addEventListener("keydown", escritorioRanking.fecharPop);
  }
}
function fecharDetalheRankingEscritorio() {
  document.getElementById("rk2-pop")?.remove();
}

// Janela Conquistas (Paulo, 20/10/2026: "ícone de Conquistas na lateral que
// mostra todas as conquistas e o que cada uma dá"): cada escada com os quatro
// níveis, a meta, o troféu e as moedas e o XP de cada um, e o seu progresso.
const ESCRITORIO_GRUPOS_CONQUISTA = [
  ["entregas", "Entregas", "As peças que você fez.", ["entregas", "cards", "carrosseis", "reels", "stories", "fotografias", "videos", "motions", "impressos", "implementacoes"]],
  ["producao", "Produção", "Dias com crédito de captação e peças vinculadas; não são sessões de gravação.", ["gravacoes", "fotos_captadas", "videos_captados"]],
  ["ritmo", "Ritmo", "Prazo, aprovação de primeira, sequência, meta e pódio.", ["adiantado", "deprimeira", "embalo", "semana", "filaemdia", "meta", "meta_turbo", "podio", "artilheiro", "painel", "clientes", "nivel"]],
  ["agendamento", "Agendamento", "Peças com crédito de agendamento ou finalização, por tipo; não comprova publicação.", ["agendamento", "agendados_cards", "agendados_carrosseis", "agendados_reels", "agendados_stories", "agendados_fotografias"]],
  ["atendimento", "Atendimento", "Peças dos clientes da sua carteira, por tipo.", ["carteira", "carteira_cards", "carteira_carrosseis", "carteira_reels", "carteira_stories", "carteira_fotografias", "planejamentos"]],
  ["gestao", "Gestão", "Cadastros, briefings, peças da agência e aprovações do DA.", ["cadastros", "briefings", "agencia", "da"]],
  ["escritorio", "Escritório", "Um nível só, para começar a usar.", ["quarto", "andar2", "presente", "troca", "postits"]],
];
async function abrirConquistasEscritorio() {
  if (!document.getElementById("ofc-conquistas")) {
    openWorkflowModal('<div class="ofc-ranking ofc-conquistas" id="ofc-conquistas" role="dialog" aria-label="Conquistas"></div>');
    document.getElementById("workflow-modal")?.classList.add("ofc-ranking-janela", "ofc-menu-jogo");
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
  el.innerHTML = topo + `<div class="ofc-rk-corpo">${escritorioConquistasCorpoHtml(marcos, { meu: true })}</div>`;
}
// O corpo das conquistas: o mesmo na janela e na aba da ficha (Paulo, 20/10/2026).
// Desde 21/10/2026 ("deixa o painel de conquistas mais foda"): vitrine com o
// maior troféu e o título numa placa, medalhas por nível, um grupo por vez nos
// chips e cada escada num cartão com a trilha Bronze → Diamante.
function escritorioConquistasCorpoHtml(marcos, { meu = false } = {}) {
  const NOMES = ["", "Bronze", "Prata", "Ouro", "Diamante"];
  const num = (n) => Number(n).toLocaleString("pt-BR");
  // "1 entregas" → "1 entrega": tira o s de cada palavra quando o número é 1.
  const qtd = (n, unidade) => `${num(n)} ${n === 1 ? unidade.split(" ").map((w) => w.replace(/s$/, "")).join(" ") : unidade}`;
  const pct = (x) => { if (!x.proximo) return 100; const antes = x.degraus.filter((d) => d.ok).at(-1)?.meta || 0; return Math.max(0, Math.min(100, Math.round(((x.valor - antes) / Math.max(1, x.proximo.meta - antes)) * 100))); };
  // A trilha: quatro pontos ligados; a linha enche até onde a pessoa está.
  const trilha = (x) => {
    const n = x.degraus.length, enche = n < 2 ? 0 : Math.min(100, ((Math.max(0, x.nivel - 1) + (x.proximo && x.nivel ? pct(x) / 100 : 0)) / (n - 1)) * 100);
    return `<span class="cq-trilha" aria-hidden="true"><span class="cq-trilha-linha"><i style="width:${x.nivel ? enche : 0}%"></i></span>${x.degraus.map((d) => `<span class="cq-no n${d.nivel}${d.ok ? " ok" : ""}${x.proximo?.nivel === d.nivel ? " vez" : ""}" style="left:${n < 2 ? 50 : ((d.nivel - 1) / (n - 1)) * 100}%"><i></i><small>${num(d.meta)}</small></span>`).join("")}</span>`;
  };
  // Uma escada num cartão: troféu atual (ou o próximo, apagado), nível, a
  // trilha e o que falta; aberto, mostra os quatro níveis com prêmio e título.
  const cartao = (x, aberto = false) => {
    const atual = x.degraus.filter((d) => d.ok).at(-1), mostra = atual || x.proximo || x.degraus.at(-1);
    const prox = x.proximo, dProx = prox && x.degraus.find((d) => d.nivel === prox.nivel);
    const falta = prox ? prox.meta - x.valor : 0;
    return `<details class="cq-cartao n${x.nivel}"${aberto ? " open" : ""}><summary>
<span class="cq-arte${atual ? "" : " falta"}">${escritorioMiniaturaHtml(mostra.classe)}</span>
<span class="cq-meio"><span class="cq-nome"><b>${safeText(x.nome)}</b>${x.nomeNivel ? `<em class="ofc-escada-nivel n${x.nivel}">${safeText(x.nomeNivel)}</em>` : ""}</span>
${x.titulo ? `<span class="cq-tit vb-titulo n${x.nivel}">${safeText(x.titulo)}</span>` : ""}
${x.social ? `<small>${x.nivel ? "Conquistado" : safeText(x.dica || "")}</small>` : `${trilha(x)}<small>${prox ? `<b>${num(x.valor)}</b> ${safeText(x.unidade)} · faltam <b>${num(falta)}</b> para ${safeText(prox.nome)}` : `<b>${num(x.valor)}</b> ${safeText(x.unidade)} · nível máximo`}</small>`}</span>
${dProx ? `<span class="cq-premio" title="Prêmio do próximo nível"><b>+${dProx.moedas}</b><small>moedas</small><b>+${dProx.pontos}</b><small>XP</small></span>` : ""}
</summary>
${x.criterio ? `<p class="cq-dica">${safeText(x.criterio)}</p>` : ""}
<ol class="cq-niveis">${x.degraus.map((d) => `<li class="n${d.nivel}${d.ok ? " ok" : ""}"><span class="cq-arte">${escritorioMiniaturaHtml(d.classe)}</span><b>${safeText(d.nome)}</b><small>${safeText(qtd(d.meta, x.unidade))}</small>${d.titulo ? `<span class="cq-tit vb-titulo n${d.nivel}">${safeText(d.titulo)}</span>` : ""}<em>+${d.moedas} moedas · +${d.pontos} XP</em>${d.ok ? '<i class="cq-seu">Seu</i>' : ""}</li>`).join("")}</ol></details>`;
  };
  const niveis = marcos.reduce((t, x) => t + x.nivel, 0), total = marcos.reduce((t, x) => t + x.degraus.length, 0);
  const andamento = marcos.filter((x) => x.proximo && x.valor > 0 && !x.social).sort((a, b) => pct(b) - pct(a));
  const porNivel = [1, 2, 3, 4].map((n) => marcos.reduce((t, x) => t + x.degraus.filter((d) => d.ok && d.nivel === n && !x.social).length, 0));
  // O maior troféu da pessoa vai para a vitrine.
  const melhor = marcos.filter((x) => x.nivel && !x.social).sort((a, b) => b.nivel - a.nivel || b.valor - a.valor)[0];
  const trofeu = melhor?.degraus.filter((d) => d.ok).at(-1);
  // Os títulos das escadas e os da Copa Vybe (um por mês ganho, vêm à parte).
  const copas = (meu ? escritorio.base?.economia?.titulos || [] : []).filter((t) => /^copa_/.test(t.chave)).map((t) => ({ ...t, nivel: 4, de: "Copa Vybe" }));
  const titulos = [...copas, ...marcos.flatMap((x) => x.degraus.filter((d) => d.ok && d.titulo).map((d) => ({ chave: `${x.id}:${d.nivel}`, texto: d.titulo, nivel: x.social ? 1 : d.nivel, de: x.nome })))];
  const euNaEquipe = (escritorio.base?.equipe || []).find((e) => String(e.id) === String(escritorio.base?.eu));
  const atual = meu ? euNaEquipe?.titulo || null : null;
  const escolha = escritorio.perfil?.titulo || "";
  const anel = `<span class="cq-anel" style="--p:${total ? Math.round((niveis / total) * 100) : 0}" title="${niveis} de ${total} níveis"><b>${niveis}</b><small>de ${total}</small></span>`;
  const medalhas = `<div class="cq-medalhas">${porNivel.map((q, i) => `<span class="n${i + 1}${q ? "" : " zero"}" title="${q} ${NOMES[i + 1]}"><i aria-hidden="true"></i><b>${q}</b><small>${NOMES[i + 1]}</small></span>`).join("")}</div>`;
  const nivelPlaca = atual?.nivel || melhor?.nivel || 0;
  const vitrine = `<section class="cq-vitrine n${nivelPlaca}">
<span class="cq-pedestal${trofeu ? "" : " vazio"}" aria-hidden="true"><span class="cq-luz"></span>${trofeu ? escritorioMiniaturaHtml(trofeu.classe) : ""}</span>
<div class="cq-placa"><small>${meu ? "Seu título no mapa" : "Maior conquista"}</small><b>${safeText(meu ? atual?.texto || (titulos.length ? "Sem título" : "Nenhum título ainda") : melhor?.titulo || "Sem conquistas ainda")}</b>
<span>${trofeu ? `Maior troféu: ${safeText(melhor.nome)} ${safeText(trofeu.nome)}` : "Cada nível de conquista dá um troféu e um título."}</span>
${meu && titulos.length ? `<button type="button" class="cq-trocar" aria-expanded="${!!escritorio.cqTitulos}" onclick="escritorio.cqTitulos=!escritorio.cqTitulos;escolherAbaConquistasEscritorio(escritorio.cqAba)">${escritorio.cqTitulos ? "Fechar títulos" : `Trocar título · ${titulos.length}`}</button>` : ""}</div>
<div class="cq-numeros">${anel}${medalhas}</div></section>`;
  // Os títulos, do Diamante ao Bronze, abertos só quando pede para trocar.
  const escolherTitulos = meu && escritorio.cqTitulos && titulos.length ? `<section class="cq-titulos" aria-label="Escolher título">${[4, 3, 2, 1].map((n) => { const l = titulos.filter((t) => t.nivel === n); return l.length ? `<div><h4 class="n${n}">${NOMES[n]}</h4><div class="cq-titulos-lista">${l.map((t) => `<button type="button" class="cq-titulo-op n${n}" aria-pressed="${atual?.chave === t.chave}" onclick="escolherTituloEscritorio('${safeText(t.chave)}')"><span class="vb-titulo n${n}">${safeText(t.texto)}</span><small>${safeText(t.de)}</small></button>`).join("")}</div></div>` : ""; }).join("")}<button type="button" class="vb-chip" aria-pressed="${escolha === "nenhum"}" onclick="escolherTituloEscritorio('nenhum')">Não mostrar título</button></section>` : "";
  // A estante: todos os troféus já ganhos, na cor do nível; e o próximo.
  const ganhos = marcos.flatMap((x) => x.degraus.filter((d) => d.ok && d.classe).map((d) => ({ ...d, escada: x.nome }))).sort((a, b) => b.nivel - a.nivel);
  const proximo = andamento[0];
  const estante = `${proximo ? `<section class="cq-proximo"><small>Próximo troféu</small><div><span class="cq-arte falta">${escritorioMiniaturaHtml(proximo.proximo.classe)}</span><span><b>${safeText(proximo.nome)} ${safeText(proximo.proximo.nome)}</b><em>faltam ${num(proximo.proximo.meta - proximo.valor)} ${safeText(proximo.unidade)}</em><span class="ofc-escada-barra"><i style="width:${pct(proximo)}%"></i></span></span></div></section>` : ""}
<section class="cq-estante"><small>Sua estante · ${ganhos.length} ${ganhos.length === 1 ? "troféu" : "troféus"}</small>${ganhos.length ? `<div>${ganhos.map((d) => `<span class="cq-peca n${d.nivel}" title="${safeText(d.escada)} ${safeText(d.nome)}">${escritorioMiniaturaHtml(d.classe)}</span>`).join("")}</div>` : '<p>Os troféus que você ganhar aparecem aqui, prontos para expor no quarto.</p>'}</section>`;
  // Um grupo por vez (antes eram sete sanfonas abertas uma embaixo da outra).
  const grupos = [["perto", "Perto de subir", "As escadas em que você está mais perto do próximo nível.", null], ...ESCRITORIO_GRUPOS_CONQUISTA];
  const daAba = (ids) => ids ? ids.map((id) => marcos.find((m) => m.id === id)).filter(Boolean) : andamento.slice(0, 8);
  const visiveis = grupos.filter(([, , , ids]) => daAba(ids).length);
  const aba = visiveis.some(([k]) => k === escritorio.cqAba) ? escritorio.cqAba : visiveis[0]?.[0];
  const chips = `<div class="ofc-cq-abas" role="tablist" aria-label="Grupos de conquistas">${visiveis.map(([k, nome, , ids]) => { const l = daAba(ids); return `<button type="button" role="tab" class="vb-chip" aria-pressed="${k === aba}" aria-selected="${k === aba}" onclick="escolherAbaConquistasEscritorio('${k}')">${nome}${ids ? `<b>${l.filter((x) => x.nivel).length}/${l.length}</b>` : ""}</button>`; }).join("")}</div>`;
  const [, , dica, ids] = grupos.find(([k]) => k === aba) || grupos[0];
  const lista = daAba(ids);
  return `<div class="cq-tela"><aside class="cq-lado">${vitrine}${escolherTitulos}${estante}</aside><div class="cq-principal">${chips}<p class="cq-dica">${dica} Cada nível mostra a meta, o que conta e o prêmio. Os troféus conquistados ficam com você; XP de conquistas não entra no ranking de trabalho.</p><div class="cq-grade" role="tabpanel">${lista.map((x, k) => cartao(x, aba === "perto" && k === 0)).join("") || '<p class="ofc-nota">Nada aqui ainda.</p>'}</div></div></div>`;
}
function escolherAbaConquistasEscritorio(aba) {
  escritorio.cqAba = aba;
  if (document.getElementById("ofc-conquistas")) pintarConquistasEscritorio();
  if (document.getElementById("office-ficha")?.open) abrirFichaEscritorio(escritorio.fichaDe, true);
}
// Troca o título que aparece embaixo do nome; o servidor confere se é seu.
async function escolherTituloEscritorio(chave) {
  try {
    const r = await escritorioApi("titulo", { chave });
    escritorio.perfil = { ...(escritorio.perfil || {}), titulo: chave };
    const eu = (escritorio.base?.equipe || []).find((e) => String(e.id) === String(escritorio.base?.eu));
    if (eu) eu.titulo = r.titulo || null;
    escritorioAviso(r.titulo ? `Agora você aparece como ${r.titulo.texto}.` : "Título escondido.");
    if (typeof atualizarPessoasEscritorio === "function") atualizarPessoasEscritorio();
  } catch (e) { escritorioAviso(e.message || "Não deu para trocar o título."); }
  if (document.getElementById("ofc-conquistas")) pintarConquistasEscritorio();
  if (document.getElementById("office-ficha")?.open) abrirFichaEscritorio(escritorio.fichaDe, true);
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
  // A entrada vem sem as conquistas (desde 21/10/2026, para abrir rápido):
  // sem a lista, os troféus guardados ficam como estão e nada conta como novo.
  const comTrofeus = Array.isArray(eco.marcos);
  const salvar = () => { try { localStorage.setItem(chave, JSON.stringify({ nivel: agora.nivel, trofeus: comTrofeus ? agora.trofeus.map((t) => t.chave) : antes?.trofeus || null })); } catch {} };
  if (!antes || (comTrofeus && !Array.isArray(antes.trofeus))) return salvar();
  const vistos = new Set(antes.trofeus || []);
  const novos = comTrofeus ? agora.trofeus.filter((t) => !vistos.has(t.chave)).sort((x, y) => y.nivel - x.nivel) : [];
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

function escritorioFerramentasAreaHtml(){const pin=escritorioPincel();return `<fieldset class="ofc-area-piso"><legend>Aplicar piso</legend>${[['pincel','Pincel'],['retangulo','Retângulo'],['linha','Linha'],['regiao','Região'],['borracha','Borracha']].map(([id,n])=>`<button type="button" aria-pressed="${(pin.area||'pincel')===id}" onclick="escritorioPincel().area='${id}';renderEscritorio()">${n}</button>`).join('')}<small>Arraste para escolher a área. Solte para aplicar; uma ação no Desfazer. A borracha guarda a peça inteira de piso que cruza a área.</small></fieldset>`;}
// Uma forma só gera alvos. A máscara e a altura continuam sendo as da planta.
function escritorioPontosDaArea(inicio,fim,modo,nivel,w,h){
 const dentro=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&nivel(x,y)>=0;
 const [x0,y0]=inicio,[x1,y1]=fim,r=[];
 if(!dentro(x0,y0))return r;
 if(modo==='regiao'){
  const fila=[[x0,y0]],vistos=new Set(),altura=nivel(x0,y0);
  for(let i=0;i<fila.length;i++){const [x,y]=fila[i],k=x+','+y;if(vistos.has(k)||!dentro(x,y)||nivel(x,y)!==altura)continue;vistos.add(k);r.push([x,y]);fila.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
 }else if(modo==='retangulo'){
  for(let y=Math.max(0,Math.min(y0,y1));y<=Math.min(h-1,Math.max(y0,y1));y++)for(let x=Math.max(0,Math.min(x0,x1));x<=Math.min(w-1,Math.max(x0,x1));x++)if(dentro(x,y))r.push([x,y]);
 }else{
  const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));for(let i=0;i<=n;i++){const x=Math.round(x0+(x1-x0)*(n?i/n:0)),y=Math.round(y0+(y1-y0)*(n?i/n:0));if(dentro(x,y))r.push([x,y]);}
 }
 return r;
}
function escritorioAreaDoGesto(g){const a=escritorioMinhaMesa()?.ambiente;if(!a)return [];const {w,h}=escritorioDimQuarto(a),p=escritorioPincel();return escritorioPontosDaArea(g.inicio,g.fim,p.area||'pincel',(x,y)=>escritorioNivelQuarto(a,x,y),w,h);}
function escritorioPreviaArea(g){const a=escritorioMinhaMesa()?.ambiente;if(!a)return;const pontos=escritorioAreaDoGesto(g);escritorio.mapa?.pincel?.({pisos:pontos.map(([x,y])=>({x0:a.x0+x,y0:a.y0+y,w:1,h:1}))});escritorioAviso(`${pontos.length} ladrilhos selecionados · solte para aplicar`);}
function escritorioMontarPisos(itens,alvos,classe,pisos,dim){
 let lista=itens.map(it=>structuredClone(it));
 for(const alvo of alvos){lista=lista.filter(it=>{if(!pisos.has(it[0]))return true;const d=dim(it[0]);return !(it[1]<alvo.x0+alvo.w&&it[1]+d.x>alvo.x0&&it[2]<alvo.y0+alvo.h&&it[2]+d.y>alvo.y0);});if(classe)lista.push([classe,alvo.x0,alvo.y0,0,0,0]);}
 return lista;
}
async function escritorioAplicarAreaPiso(pontos){
 const e=escritorio.edicao,pin=structuredClone(escritorioPincel());if(!e||e.salvando||e.aplicandoPisos||!pontos.length)return;
 const fotoAntes=escritorioFotoEdicao(e);
 e.aplicandoPisos=true;
 try{
  if(pin.ferramenta!=='piso')return;
  const a=escritorioMinhaMesa()?.ambiente;if(!a||a.id!==e.camada)return;
  if(pin.movel&&pin.area!=='borracha'){
   const d=escritorioDimPiso(pin.movel);if(!d.pronto)throw Error('Aguarde as medidas do material antes de aplicar.');if(d.erro)throw Error('Não foi possível carregar as medidas deste material. Selecione outro.');
   const alvos=new Map();for(const [x,y]of pontos){const alvo=escritorioAlvoDoPincel(x,y);if(alvo?.tipo==='acervo')alvos.set(alvo.x0+','+alvo.y0,alvo);}
   if(!alvos.size)return;
   for(const alvo of alvos.values())if(!await escritorioCabe(pin.movel,alvo.x0,alvo.y0,0,null,false))throw Error('A peça de piso ultrapassa a área permitida.');
   if(escritorio.edicao!==e)return;
   const pisos=new Set((escritorioCatalogo||[]).filter(m=>m.categoria==='Pisos do acervo').map(m=>m.classe));
   const antigos=[...new Set(e.itens.filter(it=>pisos.has(it[0])).map(it=>it[0]))];
   await Promise.all(antigos.map(cl=>escritorioDimPiso(cl).carga));
   if(antigos.some(cl=>escritorioDimPiso(cl).erro))throw Error('Não foi possível conferir as medidas de um piso existente. A área não foi alterada.');
   if(escritorio.edicao!==e || escritorioFotoEdicao(e)!==fotoAntes)return;
   const novos=escritorioMontarPisos(e.itens,[...alvos.values()],pin.movel,pisos,escritorioDimPiso);
   const usados=[...novos,...escritorioOutrosAndares()].filter(it=>it[0]===pin.movel).length,tem=escritorio.base.quartos?.essenciais.includes(pin.movel)?Infinity:Number(escritorio.base.economia?.inventario?.find(i=>i.classe===pin.movel)?.quantidade || 0),faltam=Math.max(0,usados-tem);
   if(faltam&&!await escritorioComprarUnidades(pin.movel,faltam))return;
   if(escritorio.edicao!==e)return;
   if(escritorioFotoEdicao(e)!==fotoAntes){escritorioAviso("A decoração mudou durante a compra. As peças compradas estão guardadas; aplique a área novamente.");return;}
   e.itens=novos;
  }else{
   e.agrupando=true;
   if(pin.area==='borracha'){
    const pisos=new Set((escritorioCatalogo||[]).filter(m=>m.categoria==='Pisos do acervo').map(m=>m.classe));
    const antigos=[...new Set(e.itens.filter(it=>pisos.has(it[0])).map(it=>it[0]))];
    await Promise.all(antigos.map(cl=>escritorioDimPiso(cl).carga));
    if(antigos.some(cl=>escritorioDimPiso(cl).erro))throw Error('Não foi possível conferir as medidas do piso para apagar.');
    if(escritorio.edicao!==e || escritorioFotoEdicao(e)!==fotoAntes)return;
    e.itens=escritorioMontarPisos(e.itens,pontos.map(([x,y])=>({x0:x,y0:y,w:1,h:1})),null,pisos,escritorioDimPiso);
   }
   const antigo=escritorioPincel().movel,piso=escritorioPincel().piso;escritorioPincel().movel='';if(pin.area==='borracha')escritorioPincel().piso='';
   for(const [x,y]of pontos)pintarNaSalaEscritorio(x,y);
   escritorioPincel().movel=antigo;escritorioPincel().piso=piso;
   e.agrupando=false;
  }
  escritorioEditorMudou();escritorioAviso('Área aplicada na prévia. Salve para confirmar a decoração.');
 }catch(erro){escritorioAviso(erro.message);}finally{e.agrupando=false;e.aplicandoPisos=false;escritorio.mapa?.pincel?.(null);}
}
