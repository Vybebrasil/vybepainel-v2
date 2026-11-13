// Loja como loja de jogo (Paulo, 26/10/2026: "difícil achar as coisas, não tem
// cara de loja de jogo"). A janela continua a de vybe-escritorio-editor.js
// (abrirCatalogoEscritorio, compra, ficha e estoque de sempre, validados no
// servidor); aqui ficam o que entra na Loja, a capa com prateleiras e a
// navegação por categorias com ícones.

// Só o que se compra: sem os grátis (pisos, paredes, blocos e essenciais, que
// ficam na construção), sem peças técnicas e sem itens de anúncio ou sem nome.
function escritorioVendivelNaLoja(m) {
  if (escritorio.cat?.aba && escritorio.cat.aba !== "loja") return true;
  if ((escritorio.base?.quartos?.essenciais || []).includes(m.classe)) return false;
  if (typeof escritorioMovelTecnico === "function" && escritorioMovelTecnico(m)) return false;
  if (/^(ads_|brnd_|tampax|md_logo)/i.test(m.classe) || /(^|_)name$/i.test(m.nome || "") || !String(m.nome || "").trim()) return false;
  return true;
}
// Seções da Loja com ícone (as categorias de cada uma são as do catálogo).
const ESCRITORIO_SECOES_LOJA = [
  ["Móveis", "mesa"], ["Decoração", "estrela"], ["Ambientes", "mapa"], ["Construção", "pilha"], ["Jogos e efeitos", "ajustes"], ["Estilos e coleções", "loja"],
];
// Quantas peças por seção/categoria: guardado enquanto o catálogo, a base e a loja forem os mesmos (redesign r5,
// quadro 35: a árvore refazia ~60 filtros do catálogo inteiro a cada redesenho; no celular, mais de 1 s).
// Sem a base ainda (Loja aberta direto do dock), não conta: a árvore sai sem número até a base chegar.
let escritorioContasLoja = null;
function escritorioContaLoja(categoria) {
  if (!escritorio.base) return null;
  const eco = escritorio.base.economia, chave = [escritorioCatalogo, escritorio.base, eco, eco?.loja];
  if (!escritorioContasLoja || escritorioContasLoja.chave.some((v, i) => v !== chave[i])) escritorioContasLoja = { chave, n: new Map() };
  const n = escritorioContasLoja.n;
  if (!n.has(categoria)) n.set(categoria, escritorioCatalogoGeralLista({ categoria, busca: "", raridade: "", posso: false, desejos: false }).length);
  return n.get(categoria);
}
// Navegação da esquerda: atalhos e seções sempre abertas, com ícone e número.
function escritorioArvoreLojaHtml(ativo, acao) {
  const vai = (valor) => acao.replace("%", safeText(valor));
  const item = (valor, rotulo, icone, n, extra = "") => `<button type="button" class="ofc-loja-nav${extra}" aria-pressed="${ativo === valor}" onclick="${vai(valor)}">${escritorioIcone(icone)}<span>${safeText(rotulo)}</span>${n != null ? `<small>${n.toLocaleString("pt-BR")}</small>` : ""}</button>`;
  const vitrine = (escritorio.base?.economia?.loja?.vitrine || []).length, desejos = escritorioDesejos().size, jogos = escritorioContaLoja("Jogos com a equipe");
  const secoes = ESCRITORIO_SECOES_LOJA.map(([t, ico]) => {
    const n = escritorioContaLoja(`secao:${t}`);
    return n !== 0 ? item(`secao:${t}`, t, ico, n) : "";
  }).join("");
  return `<div class="ofc-loja-grupo">${item("*", "Destaques", "estrela", null, " forte")}${jogos !== 0 ? item("Jogos com a equipe", "Jogos com a equipe", "jogo", jogos, " jogos") : ""}${vitrine ? item("Vitrine da semana", "Vitrine da semana", "alvo", vitrine, " vitrine") : ""}${desejos ? `<button type="button" class="ofc-loja-nav" aria-pressed="${Boolean(escritorio.cat?.desejos)}" onclick="escritorio.cat.desejos=!escritorio.cat.desejos;escritorio.cat.categoria='*';escritorio.cat.ver=60;redesenharCatalogoJanelaEscritorio()">${escritorioIcone("estrela")}<span>Meus desejos</span><small>${desejos}</small></button>` : ""}${escritorioRecentes().length ? item("Recentes", "Vistos por você", "lista", escritorioRecentes().length) : ""}</div><div class="ofc-loja-grupo"><h5>Categorias</h5>${secoes}</div>`;
}
// Dentro de uma seção: as categorias dela como fichas no topo da grade.
function escritorioSubcategoriasLojaHtml(categoria) {
  const secao = categoria.startsWith("secao:") ? categoria.slice(6) : ESCRITORIO_SECOES_LOJA.map(([t]) => t).find((t) => escritorioCategoriasDaSecao(t).includes(categoria));
  if (!secao) return "";
  const cats = escritorioCategoriasDaSecao(secao).map((n) => [n, escritorioContaLoja(n)]).filter(([, q]) => q);
  if (cats.length < 2) return "";
  const chip = (valor, rotulo, q) => `<button type="button" class="ofc-cat-chip" aria-pressed="${categoria === valor}" onclick="escritorio.cat.categoria='${safeText(valor)}';escritorio.cat.ver=60;redesenharCatalogoJanelaEscritorio()">${safeText(rotulo)}${q != null ? ` <small>${q.toLocaleString("pt-BR")}</small>` : ""}</button>`;
  return `<div class="ofc-loja-sub" role="group" aria-label="Categorias de ${safeText(secao)}">${chip(`secao:${secao}`, "Tudo")}${cats.map(([n, q]) => chip(n, escritorioRotuloCategoria(n), q)).join("")}</div>`;
}
// Capa da Loja ("Destaques"): os jogos com a equipe, a vitrine da semana e os kits.
function escritorioCapaLojaHtml() {
  if (!escritorio.base) return '<p class="v2l-vazio">Carregando a loja…</p>';
  // Destaques pelo quadro do padrão v2: os jogos com a equipe, a vitrine da semana e os kits, na mesma grade.
  // As prateleiras por categoria e "Monte um ambiente" saíram da capa: as mesmas categorias abrem em Filtros.
  const eco = escritorio.base.economia, loja = eco?.loja;
  const hoje = typeof hojeDeVerdade === "function" ? hojeDeVerdade() : new Date().toISOString().slice(0, 10);
  const troca = loja?.semana ? Math.max(1, Math.round((Date.parse(loja.semana) + 7 * 864e5 - Date.parse(hoje)) / 864e5)) : 0;
  const jogos = escritorioCatalogoGeralLista({ categoria: "Jogos com a equipe", busca: "", raridade: "", posso: false, desejos: false });
  const vistos = new Set(jogos.map((m) => m.classe));
  const vitrine = (loja?.vitrine || []).filter((c) => !vistos.has(c)).map((c) => escritorioCatalogo.find((m) => m.classe === c) || { classe: c, nome: c });
  const kits = (eco?.kits || []).filter((k) => k.disponivel);
  const itens = [...jogos, ...vitrine].map((m) => escritorioItemLojaHtml(m, { troca })).join("") + kits.map(escritorioKitLojaHtml).join("");
  return itens || '<p class="v2l-vazio">A loja está sem destaques agora. Abra Filtros para ver as categorias.</p>';
}

// Venda à loja (Paulo, 26/10/2026): o que a pessoa comprou volta pelo mesmo
// valor. Quem decide quantas unidades e quanto vale é o servidor
// (venderMovel, pelo razão); aqui só se mostra o que a economia já trouxe.
function escritorioVendaDe(classe) {
  const lotes = escritorio.base?.economia?.vendiveis?.[classe] || [];
  const guardadas = typeof escritorioOndeEstaMovel === "function" ? escritorioOndeEstaMovel(classe).guardados : 0;
  const compradas = lotes.reduce((t, [n]) => t + Number(n), 0);
  return { unidades: Math.min(compradas, guardadas === Infinity ? 0 : guardadas), valor: Number(lotes[0]?.[1] || 0) };
}
function escritorioVendaHtml(classe) {
  const v = escritorioVendaDe(classe);
  if (!v.unidades || !v.valor) return "";
  return `<button type="button" class="workflow-secondary ofc-vender" onclick="fecharPreviaMovelEscritorio(this);venderParaLojaEscritorio('${safeText(classe)}')" title="Devolve uma unidade guardada à loja pelo valor que você pagou">Vender · ${v.valor.toLocaleString("pt-BR")} moedas</button>`;
}
async function venderParaLojaEscritorio(classe, semPerguntar = false) {
  const v = escritorioVendaDe(classe), eco = escritorio.base?.economia;
  if (!v.unidades || !eco || escritorio.vendendo) return;
  const nome = typeof escritorioNomeDaClasse === "function" ? escritorioNomeDaClasse(classe) : classe, saldo = Number(eco.saldo || 0);
  if (!semPerguntar && !await confirmarNoPainel(`Vender 1 × ${nome} para a loja por ${v.valor.toLocaleString("pt-BR")} VybeCoins (o que você pagou)?\nSaldo: ${saldo.toLocaleString("pt-BR")} → ${(saldo + v.valor).toLocaleString("pt-BR")}.\nA peça sai do seu inventário.`)) return;
  escritorio.vendendo = true;
  // A chave fica a mesma se a rede falhar e a pessoa tentar de novo.
  if (escritorio.vendaPendente?.classe !== classe) escritorio.vendaPendente = { classe, chave: crypto.randomUUID(), valorEsperado: v.valor };
  try {
    if (escritorio.base.demo) {
      eco.saldo = saldo + v.valor;
      const item = eco.inventario.find((i) => i.classe === classe);
      if (item) item.quantidade -= 1;
      eco.inventario = eco.inventario.filter((i) => i.quantidade > 0);
      const lotes = eco.vendiveis[classe];
      lotes[0][0] -= 1; if (!lotes[0][0]) lotes.shift();
    } else escritorio.base.economia = (await escritorioApi("vender", escritorio.vendaPendente)).economia;
    escritorio.vendaPendente = null;
    if (typeof escritorioSomConstrucao === "function") escritorioSomConstrucao("salvar");
    escritorioAviso(`Vendido: +${v.valor.toLocaleString("pt-BR")} VybeCoins.`);
    renderEscritorio();
    if (typeof redesenharCatalogoJanelaEscritorio === "function") redesenharCatalogoJanelaEscritorio();
  } catch (e) {
    escritorioAviso("Não vendeu: " + e.message);
  } finally { escritorio.vendendo = false; }
}

// Vender no modo edição (Paulo, 26/10/2026): a peça selecionada no quarto sai,
// a construção é salva (o servidor só vende o que está guardado no salvo) e a
// venda acontece; depois a construção abre de novo para continuar.
function escritorioVendaSelecionadoHtml(classe) {
  const lotes = escritorio.base?.economia?.vendiveis?.[classe] || [];
  const valor = Number(lotes[0]?.[1] || 0);
  if (!lotes.length || !valor || !escritorio.edicao || escritorioCamadaComum(escritorio.edicao.camada)) return "";
  return `<button type="button" class="ofc-vender" onclick="venderSelecionadoEscritorio()" title="Tira do quarto, salva a construção e vende pelo valor que você pagou">Vender · ${valor.toLocaleString("pt-BR")}</button>`;
}
async function venderSelecionadoEscritorio() {
  const e = escritorio.edicao, it = e?.sel != null ? e.itens[e.sel] : null;
  if (!it || e.salvando) return;
  const classe = it[0], valor = Number(escritorio.base?.economia?.vendiveis?.[classe]?.[0]?.[1] || 0);
  const nome = escritorioNomeDaClasse(classe);
  if (!valor || !await confirmarNoPainel(`Vender ${nome} por ${valor.toLocaleString("pt-BR")} VybeCoins (o que você pagou)?\nA peça sai do quarto e a construção é salva agora, com as outras mudanças.`)) return;
  e.itens.splice(e.sel, 1); e.sel = null;
  escritorioEditorMudou();
  await salvarEditorEscritorio();
  if (escritorio.edicao) return; // não salvou: a peça volta com Desfazer
  await venderParaLojaEscritorio(classe, true);
  await abrirEditorEscritorio();
}

// Ambientes (Paulo, 26/10/2026: "o Vinícius queria montar uma academia e não
// aparece as coisas de forma fácil"): categorias por tipo de sala, pelas
// palavras do nome e da classe (o acervo está em inglês) e pelas categorias
// antigas que já cobriam o tema, para nenhuma peça sumir.
const ESCRITORIO_AMBIENTES = [
  ["Academia", "alvo", ["gym", "treadmill", "dumbbell", "weightrack", "weight", "barbell", "sparring", "boxing", "punch", "yoga", "fitness", "exercise", "rowing", "kettlebell", "trampoline", "locker", "olympics c16", "sport"], []],
  ["Cozinha", "mesa", ["kitchen", "ktchn", "stove", "cooker", "oven", "fridge", "freezer", "microwave", "toaster", "cutlery", "chef", "pantry", "dish"], ["Cozinha e bar", "Detalhes de cozinha"]],
  ["Banheiro", "espaco", ["bathroom", "bath", "toilet", "shower", "bathtub", "towel", "jacuzzi"], []],
  ["Quarto", "espaco", ["bed", "wardrobe", "dresser", "nightstand", "bunk", "closet", "pillow"], ["Camas"]],
  ["Sala de estar", "mesa", ["sofa", "couch", "armchair", "fireplace", "coffee table", "tv set", "television", "beanbag"], []],
  ["Escritório", "painel", ["office", "desk", "exe ", "computer", "laptop", "filing", "whiteboard", "printer", "copier", "swivel", "conference"], ["Do escritório", "Computadores", "Escrivaninhas"]],
  ["Jardim", "estrela", ["garden", "plant", "tree", "flower", "bush", "hedge", "fountain", "gnome", "pond", "grass", "pergola"], ["Jardim e área externa", "Plantas"]],
  ["Praia e piscina", "mapa", ["beach", "pool", "surf", "sand", "parasol", "umbrella", "lifeguard", "deckchair", "lounger", "palm", "tiki"], []],
  ["Festa e balada", "musica", ["party", "disco", "dj", "dance", "balloon", "confetti", "club", "karaoke", "strobe", "neon"], []],
  ["Gamer e fliperama", "ajustes", ["arcade", "gaming", "game", "console", "pinball", "billiard", "pool table", "joystick", "vwave"], ["Jogos e música"]],
  ["Estúdio", "camera", ["studio", "camera", "microphone", "spotlight", "recording", "tripod", "mixer"], ["Objetos de estúdio"]],
  ["Café e bar", "mesa", ["coffee", "cafe", "espresso", "bar", "minibar", "drinks", "cocktail", "beer", "bartender"], []],
  ["Loja", "loja", ["shop", "store", "mall", "cash register", "till", "display", "merch", "vending"], []],
  ["Escola", "lista", ["school", "classroom", "blackboard", "chalkboard", "uni ", "locker", "desk school"], []],
];
function escritorioDoAmbiente([, , termos, antigas]) {
  const filtros = antigas.map((n) => ESCRITORIO_GRUPOS_CATALOGO.find(([g]) => g === n)?.[1]).filter(Boolean);
  const t = termos.map(escritorioSemAcento);
  return (m) => {
    // No começo de uma palavra ("rowing" não acha "growing").
    const alvo = ` ${escritorioSemAcento(m.classe + " " + m.nome).replace(/[^a-z0-9]+/g, " ")} `;
    return t.some((p) => (p.length <= 3 ? alvo.includes(` ${p} `) : alvo.includes(" " + p))) || filtros.some((f) => f(m));
  };
}
(function ligarAmbientes() {
  if (typeof ESCRITORIO_GRUPOS_CATALOGO === "undefined" || ESCRITORIO_GRUPOS_CATALOGO.some(([n]) => n === "Academia")) return;
  for (const a of ESCRITORIO_AMBIENTES) ESCRITORIO_GRUPOS_CATALOGO.push([a[0], escritorioDoAmbiente(a)]);
  // A seção Ambientes passa a ser estes; as categorias antigas que eles
  // englobam saem das listas (as peças continuam nos ambientes).
  const secao = ESCRITORIO_SECOES_CATALOGO.find(([t]) => t === "Ambientes");
  // "Lazer" fica (carro, barco, rede e balanço não entram em nenhum ambiente).
  if (secao) secao[1] = [...ESCRITORIO_AMBIENTES.map(([n]) => n), "Lazer (piscina, rede, carro…)"];
  const englobadas = new Set(ESCRITORIO_AMBIENTES.flatMap(([, , , antigas]) => antigas).filter((n) => !["Camas", "Plantas", "Do escritório", "Computadores", "Escrivaninhas"].includes(n)));
  for (let i = ESCRITORIO_GRUPOS_CATALOGO.length - 1; i >= 0; i--) if (englobadas.has(ESCRITORIO_GRUPOS_CATALOGO[i][0])) ESCRITORIO_GRUPOS_CATALOGO.splice(i, 1);
})();
// Capa da Loja: "Monte um ambiente", um cartão por ambiente com três peças.
function escritorioAmbientesCapaHtml() {
  const cartoes = ESCRITORIO_AMBIENTES.map(([nome, ico]) => {
    const l = escritorioCatalogoGeralLista({ categoria: nome, busca: "", raridade: "", posso: false, desejos: false });
    if (!l.length) return "";
    const artes = l.filter((m) => escritorioInfoLoja(m.classe).naVitrine).slice(0, 3).map((m) => `<img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(m.classe)}.png?size=64" alt="" onerror="miniaturaLocalEscritorio(this,'${safeText(m.classe)}')">`).join("");
    return `<button type="button" class="ofc-loja-ambiente" onclick="escritorio.cat.categoria='${safeText(nome)}';escritorio.cat.ver=60;redesenharCatalogoJanelaEscritorio()"><span class="ofc-loja-ambiente-artes">${artes}</span><b>${escritorioIcone(ico)}${safeText(nome)}</b><small>${l.length.toLocaleString("pt-BR")} peças</small></button>`;
  }).join("");
  return cartoes ? `<section class="ofc-loja-prateleira"><div class="ofc-loja-prat-topo"><h3>Monte um ambiente</h3><small>tudo o que combina com cada tipo de sala</small></div><div class="ofc-loja-ambientes">${cartoes}</div></section>` : "";
}

// Histórico de compras na Carteira: o que entrou e saiu pela loja, com a peça,
// o valor, a data e onde ela está agora (no quarto, guardada ou já não está).
function escritorioHistoricoComprasHtml() {
  const h = escritorio.base?.economia?.historico;
  if (!Array.isArray(h)) return "";
  if (!h.length) return '<section class="ofc-historico"><h4>Histórico de compras</h4><p class="ofc-nota">Nenhuma compra ainda.</p></section>';
  const rotulo = { compra: "Comprou", kit: "Kit", venda: "Vendeu", devolucao: "Devolução" };
  const quando = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
  // Pelo quarto salvo (o mesmo cálculo da aba Inventário).
  const meus = new Map((typeof escritorioMeuInventario === "function" ? escritorioMeuInventario() : []).map((i) => [i.classe, i]));
  const onde = (classe) => {
    if (!classe) return "";
    if ((escritorio.base?.quartos?.essenciais || []).includes(classe)) return "grátis agora";
    const i = meus.get(classe);
    if (!i) return "não está mais com você";
    const guardados = i.total - i.noQuarto;
    return [i.noQuarto ? `${i.noQuarto} no quarto` : "", guardados ? `${guardados} guardado${guardados > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ");
  };
  const linhas = h.map((x) => {
    const classe = x.classes[0] || "", roupa = classe.startsWith("roupa:");
    const nome = x.tipo === "kit" ? `Kit ${x.kit} · ${x.unidades} peças` : roupa ? "Roupa do avatar" : `${x.unidades > 1 ? x.unidades + " × " : ""}${escritorioNomeDaClasse(classe)}`;
    const arte = classe && !roupa ? `<img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(classe)}.png?size=64" alt="" onerror="miniaturaLocalEscritorio(this,'${safeText(classe)}')">` : "";
    const abrir = classe && !roupa && x.tipo !== "kit" ? ` onclick="abrirPreviaMovelEscritorio('${safeText(classe)}')" role="button" tabindex="0"` : "";
    return `<li class="ofc-historico-item tipo-${x.tipo}"${abrir}><span class="ofc-historico-arte">${arte}</span><span class="ofc-historico-texto"><b>${safeText(nome)}</b><small>${rotulo[x.tipo] || ""} · ${quando(x.em)}${(x.tipo === "compra" || x.tipo === "kit") && !roupa ? ` · ${safeText(onde(classe))}` : roupa ? " · no guarda-roupa" : ""}</small></span><em class="${x.valor >= 0 ? "mais" : "menos"}">${x.valor >= 0 ? "+" : "−"}${Math.abs(x.valor).toLocaleString("pt-BR")}</em></li>`;
  }).join("");
  return `<section class="ofc-historico" aria-label="Histórico de compras"><h4>Histórico de compras <small>últimos ${h.length}</small></h4><ul>${linhas}</ul></section>`;
}

// ---------------------------------------------------------------------------
// Loja e Conquistas numa janela só (quadro "Loja e Conquistas" do padrão v2, 12/11/2026). A janela continua a
// de abrirCatalogoEscritorio (vybe-escritorio-editor.js), com a compra, a ficha, o inventário e a carteira de
// sempre; aqui fica o desenho do quadro: três números no alto, uma barra de filtro só (busca, fichas e Filtros),
// a grade de itens com o botão na linha e, ao lado, as conquistas com a escada que abre no lugar.
const V2L_NIVEL_COR = ["#D9D3C8", "#C98A5E", "#B9B8C2", "#E8B93A", "#8DB7F0"];
const V2L_NIVEL_PILL = ["n", "n", "n", "a", "b"];
const V2L_CERTO = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
const v2lNum = (n) => Number(n || 0).toLocaleString("pt-BR");
function escritorioMarcosDaLoja() { return (escritorio.base || escritorio.conquistasBase)?.economia?.marcos || null; }
// Os mesmos números da janela antiga de Conquistas, lidos uma vez para os cartões do alto e para a coluna.
function escritorioConquistasResumo(marcos) {
  const pct = (x) => { if (!x.proximo) return 100; const antes = x.degraus.filter((d) => d.ok).at(-1)?.meta || 0; return Math.max(0, Math.min(100, Math.round(((x.valor - antes) / Math.max(1, x.proximo.meta - antes)) * 100))); };
  const niveis = marcos.reduce((t, x) => t + x.nivel, 0), total = marcos.reduce((t, x) => t + x.degraus.length, 0);
  const andamento = marcos.filter((x) => x.proximo && x.valor > 0 && !x.social).sort((a, b) => pct(b) - pct(a));
  const porNivel = [1, 2, 3, 4].map((n) => marcos.reduce((t, x) => t + x.degraus.filter((d) => d.ok && d.nivel === n && !x.social).length, 0));
  const melhor = marcos.filter((x) => x.nivel && !x.social).sort((a, b) => b.nivel - a.nivel || b.valor - a.valor)[0] || null;
  const copas = (escritorio.base?.economia?.titulos || []).filter((t) => /^copa_/.test(t.chave)).map((t) => ({ ...t, nivel: 4, de: "Copa Vybe" }));
  const titulos = [...copas, ...marcos.flatMap((x) => x.degraus.filter((d) => d.ok && d.titulo).map((d) => ({ chave: `${x.id}:${d.nivel}`, texto: d.titulo, nivel: x.social ? 1 : d.nivel, de: x.nome })))];
  const atual = (escritorio.base?.equipe || []).find((e) => String(e.id) === String(escritorio.base?.eu))?.titulo || null;
  const ganhos = marcos.flatMap((x) => x.degraus.filter((d) => d.ok && d.classe).map((d) => ({ ...d, escada: x.nome }))).sort((a, b) => b.nivel - a.nivel);
  return { pct, niveis, total, andamento, porNivel, melhor, titulos, atual, ganhos };
}
// As conquistas vêm com a carteira; quem abre a Loja sem elas pede uma vez e a janela se redesenha.
let escritorioLendoConquistasLoja = null;
function escritorioGarantirConquistasLoja() {
  if (escritorioMarcosDaLoja() || escritorioLendoConquistasLoja || escritorio.conquistasLidas || typeof escritorioApi !== "function") return;
  escritorio.conquistasErro = "";
  escritorioLendoConquistasLoja = escritorioApi("economia").then((r) => {
    const base = escritorio.base || (escritorio.conquistasBase ||= {});
    if (r?.economia) base.economia = { ...base.economia, ...r.economia };
    escritorio.conquistasLidas = true;
  }).catch((e) => { escritorio.conquistasErro = e.message; }).finally(() => { escritorioLendoConquistasLoja = null; redesenharCatalogoJanelaEscritorio(); });
}
function escritorioLojaCascaHtml(f) {
  return `<div class="v2l" id="v2-loja">
<div class="v2l-topo"><h1>Loja</h1><div class="v2l-seg" id="office-catj-abas" role="group" aria-label="Partes da loja"></div><button type="button" class="v2l-x" onclick="this.closest('dialog').close()" aria-label="Fechar a loja"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
<div class="v2l-kpis" id="v2l-kpis"></div>
<div class="v2l-corpo">
<section class="v2l-esq" aria-label="Itens">
<div class="v2l-filtros"><label class="v2l-so-leitor" for="v2l-busca">Buscar na loja</label><input type="search" id="v2l-busca" class="v2l-busca" placeholder="Buscar: mesa, sofá" autocomplete="off" value="${safeText(f.busca)}" oninput="escritorio.cat.busca=this.value;escritorio.cat.ver=60;desenharCatalogoJanelaEscritorio()"><div class="v2l-chips" id="v2l-chips" role="group" aria-label="Filtros da loja"></div></div>
<div class="v2-abre v2l-painel" id="v2l-painel" aria-expanded="false"><i hidden></i><div class="v2-mais"><div id="v2l-painel-dentro"></div></div></div>
<div class="v2l-faixas" id="office-catj-faixas" role="group" aria-label="Filtros do inventário"></div>
<div class="v2l-info" id="office-catj-info"></div>
<div class="v2l-grade" id="office-catj-grade"></div>
</section>
<aside class="v2l-card v2l-conq" id="v2l-conq" aria-label="Conquistas"></aside>
<aside class="ofc-catj-ficha ofc-previa-movel" id="office-catj-ficha" aria-label="Ficha do móvel" hidden></aside>
</div></div>`;
}
function escritorioLojaAbasHtml(f) {
  const trocas = (escritorio.trocas?.recebidas || []).filter((x) => x.estado === "aberta").length;
  const aba = (rotulo, chave, extra = "") => `<button type="button" aria-pressed="${f.aba === chave}" onclick="escritorio.cat.aba='${chave}';escritorio.cat.ver=60;${chave === "inventario" ? "carregarTrocasEscritorio();" : ""}redesenharCatalogoJanelaEscritorio()">${rotulo}${extra}</button>`;
  return aba("Loja", "loja") + aba("Inventário", "inventario", trocas ? ` <i class="v2l-conta">${trocas}</i>` : "") + aba("Carteira", "carteira") + aba("Conquistas", "conquistas");
}
// Quantas peças cabem no saldo: conta o catálogo inteiro, então fica guardada enquanto saldo e loja forem os mesmos.
let escritorioCabemNoSaldo = null;
function escritorioLojaCabem() {
  const eco = escritorio.base?.economia; if (!eco || !escritorioCatalogo) return 0;
  if (!escritorioCabemNoSaldo || escritorioCabemNoSaldo.saldo !== eco.saldo || escritorioCabemNoSaldo.loja !== eco.loja) {
    const aba = escritorio.cat?.aba; if (escritorio.cat) escritorio.cat.aba = "loja"; // a conta é a da Loja, em qualquer aba
    let n = 0; try { n = escritorioCatalogoGeralLista({ categoria: "*", busca: "", raridade: "", posso: true, desejos: false }).filter((m) => escritorioInfoLoja(m.classe).raridade === "comum").length; } finally { if (escritorio.cat) escritorio.cat.aba = aba; }
    escritorioCabemNoSaldo = { saldo: eco.saldo, loja: eco.loja, n };
  }
  return escritorioCabemNoSaldo.n;
}
function escritorioLojaKpisHtml() {
  const eco = escritorio.base?.economia, marcos = escritorioMarcosDaLoja();
  const saldo = Number(eco?.saldo || 0), cabem = escritorioLojaCabem();
  const c1 = `<div class="v2l-card v2l-kpi"><small>Seu saldo</small><b><span class="v2-num">${eco ? v2lNum(saldo) : "…"}</span> <em>VybeCoins</em></b><div class="v2-barra"><i style="--v:${eco ? 100 : 0}%;--c:#E8B93A"></i></div><small>${cabem ? `${v2lNum(cabem)} ${cabem === 1 ? "peça cabe" : "peças cabem"} no saldo · ` : ""}piso, parede e bloco são grátis</small></div>`;
  if (!marcos) {
    const frase = escritorio.conquistasErro ? "Não deu para ler as conquistas agora." : escritorio.conquistasLidas ? "As conquistas em níveis estão sendo ativadas." : "Lendo as suas conquistas…";
    return c1 + `<div class="v2l-card v2l-kpi"><small>Seus troféus</small><b><span>…</span></b><div class="v2-barra"><i style="--v:0%"></i></div><small>${frase}</small></div><div class="v2l-card v2l-kpi"><small>Próximo troféu</small><b><span>…</span></b><div class="v2-barra"><i style="--v:0%"></i></div><small>${frase}</small></div>`;
  }
  const r = escritorioConquistasResumo(marcos), p = r.andamento[0], dp = p && p.degraus.find((d) => d.nivel === p.proximo.nivel);
  const c2 = `<div class="v2l-card v2l-kpi"><small>Seus troféus</small><b><span class="v2-num" style="animation-delay:.12s">${v2lNum(r.niveis)}</span> <em>de ${v2lNum(r.total)}</em></b><div class="v2-barra"><i style="--v:${r.total ? Math.round((r.niveis / r.total) * 100) : 0}%;--c:#FF7A2F"></i></div><small class="v2l-meds">${r.porNivel.map((q, i) => `<span class="v2l-med" style="--c:${V2L_NIVEL_COR[i + 1]}" title="${q} ${["Bronze", "Prata", "Ouro", "Diamante"][i]}">${q}</span>`).join("")}<button type="button" class="v2l-link" onclick="escritorio.cat.aba='conquistas';redesenharCatalogoJanelaEscritorio()">sua estante</button></small></div>`;
  const c3 = p ? `<div class="v2l-card v2l-kpi"><small>Próximo troféu · ${safeText(p.nome)} ${safeText(p.proximo.nome)}</small><b><span class="v2-num" style="animation-delay:.24s">${v2lNum(p.proximo.meta - p.valor)}</span> <em>${safeText(p.unidade)} para subir</em></b><div class="v2-barra"><i style="--v:${r.pct(p)}%;--c:${V2L_NIVEL_COR[p.proximo.nivel] || "#B9B8C2"}"></i></div><small>${v2lNum(p.valor)} de ${v2lNum(p.proximo.meta)}${dp ? ` · vale +${dp.moedas} moedas e +${dp.pontos} XP` : ""}</small></div>`
    : `<div class="v2l-card v2l-kpi"><small>Próximo troféu</small><b><span>${r.niveis ? "Tudo em dia" : "Nenhum ainda"}</span></b><div class="v2-barra"><i style="--v:${r.niveis ? 100 : 0}%;--c:#11613A"></i></div><small>${r.niveis ? "Nenhuma escada em andamento agora." : "A primeira entrega abre a primeira escada."}</small></div>`;
  return c1 + c2 + c3;
}
// A barra de filtro única: as fichas à vista e, em Filtros, tudo o que antes ocupava três faixas (categorias,
// raridade, ordem e desejos). Nada some: fica a um clique.
function escritorioLojaChipsHtml(capa) {
  const f = escritorio.cat, loja = escritorio.base?.economia?.loja;
  const jogos = escritorioContaLoja("Jogos com a equipe"), vitrine = (loja?.vitrine || []).length;
  const ir = (categoria) => `escritorio.cat.categoria='${safeText(categoria)}';escritorio.cat.desejos=false;escritorio.cat.ver=60;redesenharCatalogoJanelaEscritorio()`;
  const outros = [f.raridade, f.ordem && f.ordem !== "destaque", f.desejos, f.categoria && !["*", "Jogos com a equipe", "Vitrine da semana"].includes(f.categoria)].filter(Boolean).length;
  return `<button type="button" class="v2l-chip" aria-pressed="${Boolean(capa)}" onclick="escritorio.cat={...escritorio.cat,raridade:'',posso:false,busca:'',categoria:'*',desejos:false,ordem:'destaque',ver:60};document.getElementById('v2l-busca').value='';redesenharCatalogoJanelaEscritorio()">Destaques</button>
${jogos ? `<button type="button" class="v2l-chip" aria-pressed="${f.categoria === "Jogos com a equipe"}" onclick="${ir("Jogos com a equipe")}">Jogos · ${v2lNum(jogos)}</button>` : ""}
${vitrine ? `<button type="button" class="v2l-chip" aria-pressed="${f.categoria === "Vitrine da semana"}" onclick="${ir("Vitrine da semana")}">Vitrine · ${v2lNum(vitrine)}</button>` : ""}
<button type="button" class="v2l-chip" aria-pressed="${Boolean(f.posso)}" title="Só o que está à venda esta semana e cabe no seu saldo" onclick="escritorio.cat.posso=!escritorio.cat.posso;escritorio.cat.ver=60;redesenharCatalogoJanelaEscritorio()">Cabe no saldo</button>
<button type="button" class="v2l-chip v2l-chip-filtros" aria-expanded="${Boolean(f.painel)}" aria-controls="v2l-painel" onclick="escritorio.cat.painel=!escritorio.cat.painel;redesenharCatalogoJanelaEscritorio()">Filtros${outros ? ` · ${outros}` : ""}</button>`;
}
function escritorioLojaPainelHtml(faixas, conta) {
  const f = escritorio.cat;
  const chip = (rotulo, ligado, acao, n = null, travado = false) => `<button type="button" class="v2l-chip p" aria-pressed="${Boolean(ligado)}" ${travado ? "disabled" : ""} onclick="${acao};escritorio.cat.ver=60;redesenharCatalogoJanelaEscritorio()">${safeText(rotulo)}${n != null ? ` · ${v2lNum(n)}` : ""}</button>`;
  const cat = (valor, rotulo, n) => chip(rotulo, f.categoria === valor, `escritorio.cat.categoria=escritorio.cat.categoria==='${safeText(valor)}'?'*':'${safeText(valor)}';escritorio.cat.desejos=false`, n);
  const secoes = ESCRITORIO_SECOES_LOJA.map(([t]) => [t, escritorioContaLoja(`secao:${t}`)]).filter(([, n]) => n !== 0).map(([t, n]) => cat(`secao:${t}`, t, n)).join("");
  const recentes = escritorioRecentes().length ? cat("Recentes", "Vistos por você", escritorioRecentes().length) : "";
  // Dentro de uma seção: as categorias dela.
  const atual = f.categoria || "*";
  const secao = atual.startsWith("secao:") ? atual.slice(6) : ESCRITORIO_SECOES_LOJA.map(([t]) => t).find((t) => escritorioCategoriasDaSecao(t).includes(atual));
  const subs = secao ? escritorioCategoriasDaSecao(secao).map((n) => [n, escritorioContaLoja(n)]).filter(([, q]) => q) : [];
  const linhaSubs = subs.length > 1 ? `<p><span>${safeText(secao)}</span>${subs.map(([n, q]) => cat(n, escritorioRotuloCategoria(n), q)).join("")}</p>` : "";
  const raridades = faixas.map((r) => chip(r.nome, f.raridade === r.chave, `escritorio.cat.raridade=escritorio.cat.raridade==='${safeText(r.chave)}'?'':'${safeText(r.chave)}'`, conta.get(r.chave) || 0, !conta.get(r.chave))).join("");
  const ordens = [["destaque", "Em destaque"], ["preco", "Mais baratos"], ["caro", "Mais caros"], ["raridade", "Mais raros"], ["nome", "A a Z"]].map(([v, n]) => chip(n, (f.ordem || "destaque") === v, `escritorio.cat.ordem='${v}'`)).join("");
  const desejos = escritorioDesejos().size;
  return `<div class="v2l-painel-dentro"><p><span>Categorias</span>${secoes}${recentes}</p>${linhaSubs}${raridades ? `<p><span>Raridade</span>${raridades}</p>` : ""}<p><span>Ordem</span>${ordens}</p><p><span>Sua lista</span>${chip("Desejos", f.desejos, "escritorio.cat.desejos=!escritorio.cat.desejos", desejos, !desejos)}</p></div>`;
}
function escritorioLojaPintarFiltros(d, capa, faixas, conta) {
  const f = escritorio.cat, loja = f.aba === "loja";
  const chips = d.querySelector("#v2l-chips"), painel = d.querySelector("#v2l-painel");
  if (chips) chips.innerHTML = loja ? escritorioLojaChipsHtml(capa) : "";
  if (!painel) return;
  const aberto = loja && Boolean(f.painel);
  painel.setAttribute("aria-expanded", String(aberto));
  if (aberto) painel.querySelector("#v2l-painel-dentro").innerHTML = escritorioLojaPainelHtml(faixas || [], conta || new Map());
  else if (!loja) painel.querySelector("#v2l-painel-dentro").innerHTML = "";
}
// Um item da grade: a arte com a etiqueta, o nome com o que importa numa linha e o preço com o botão.
function escritorioItemLojaHtml(m, opcoes = {}) {
  const classe = safeText(m.classe), nome = escritorioNomeMovel(m), i = escritorioInfoLoja(m.classe), q = escritorioQuantidadeMovel(m.classe);
  const saldo = Number(escritorio.base?.economia?.saldo || 0), loja = escritorio.base?.economia?.loja;
  const jogo = typeof escritorioJogoDoMovel === "function" ? escritorioJogoDoMovel(m.classe) : null;
  const naSemana = (loja?.vitrine || []).includes(m.classe);
  const etiqueta = jogo ? '<span class="v2l-pill n">Jogo</span>' : naSemana && opcoes.troca ? `<span class="v2l-pill a">Troca em ${opcoes.troca} ${opcoes.troca === 1 ? "dia" : "dias"}</span>` : "";
  const linha = [i.raridade !== "comum" ? i.nome : "Comum",
    i.marco ? (/^ranking_/.test(i.marco) ? "só no ranking" : "só por conquista") : !i.naVitrine ? "só na vitrine" : jogo ? (/Dominó/.test(jogo) ? "dominó, dama, velha e truco" : "para jogar com a equipe") : naSemana ? "vitrine da semana" : "",
    i.naVitrine && !i.marco && i.restante > 0 ? (i.restante === 1 ? "resta 1" : `restam ${i.restante}`) : ""].filter(Boolean).join(" · ");
  const ficha = `abrirPreviaMovelEscritorio('${classe}')`;
  const preco = `<span class="v2l-preco${i.preco > saldo ? " caro" : ""}">${v2lNum(i.preco)}</span>`;
  let pe;
  if (q === Infinity) pe = `<span class="v2l-pill g">Grátis</span><span class="v2l-vao"></span><button type="button" class="v2l-btn s" onclick="${ficha}">Ver</button>`;
  else if (q > 0) pe = `${i.marco ? '<span class="v2l-pill n">Prêmio</span>' : preco}<span class="v2l-vao"></span><span class="v2l-pill g">${q > 1 ? `Seus · ${q}` : "Seu"}</span>`;
  else if (i.marco) pe = `<span class="v2l-pill n">${/^ranking_/.test(i.marco) ? "Ranking" : "Conquista"}</span><span class="v2l-vao"></span><button type="button" class="v2l-btn s" onclick="${ficha}">Como ganhar</button>`;
  else if (i.restante === 0) pe = `${preco}<span class="v2l-vao"></span><span class="v2l-pill n">Esgotado</span>`;
  else if (!i.naVitrine) pe = `<span class="v2l-pill v">Vitrine</span><span class="v2l-vao"></span><button type="button" class="v2l-btn s" onclick="escritorio.cat.categoria='Vitrine da semana';escritorio.cat.ver=60;redesenharCatalogoJanelaEscritorio()">Ver na vitrine</button>`;
  else if (i.preco > saldo) pe = `${preco}<span class="v2l-vao"></span><button type="button" class="v2l-btn s" aria-pressed="${escritorioDesejos().has(m.classe)}" title="Faltam ${v2lNum(i.preco - saldo)} moedas. A lista de desejos avisa quando der para comprar." onclick="escritorioDesejarNaLoja('${classe}')">${escritorioDesejos().has(m.classe) ? "Desejado" : "Desejar"}</button>`;
  else pe = `${preco}<span class="v2l-vao"></span><button type="button" class="v2l-btn s v2-estado" onclick="escritorioComprarNaLoja(this,'${classe}')">Comprar</button>`;
  return `<article class="v2l-item" data-classe="${classe}"><button type="button" class="v2l-th" onclick="${ficha}" aria-label="Ver a ficha de ${safeText(nome)}">${etiqueta}<img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(m.classe)}.png?size=64" alt="" onerror="miniaturaLocalEscritorio(this,'${classe}')"></button>
<p class="v2l-nome"><b>${safeText(nome)}</b><span>${safeText(linha)}</span></p><div class="v2l-pe">${pe}</div></article>`;
}
function escritorioKitLojaHtml(k) {
  const saldo = Number(escritorio.base?.economia?.saldo || 0), cabe = k.preco <= saldo;
  const img = (c) => `<img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(c)}.png?size=64" alt="" onerror="miniaturaLocalEscritorio(this,'${safeText(c)}')">`;
  return `<article class="v2l-item kit"><div class="v2l-th"><span class="v2l-pill g">Kit · ${Math.round(k.desconto * 100)}% a menos</span>${k.classes.slice(0, 3).map(img).join("")}</div>
<p class="v2l-nome"><b>${safeText(k.nome)}</b><span>${safeText(k.descricao)}</span></p><div class="v2l-pe"><span class="v2l-preco${cabe ? "" : " caro"}">${v2lNum(k.preco)}</span><span class="v2l-vao"></span><button type="button" class="v2l-btn s" ${cabe ? "" : "disabled"} title="${cabe ? `De ${v2lNum(k.cheio)} por ${v2lNum(k.preco)} moedas` : `Faltam ${v2lNum(k.preco - saldo)} moedas`}" onclick="comprarKitEscritorio('${safeText(k.chave)}')">Comprar kit</button></div></article>`;
}
// O botão mostra o estado: carregando e, comprado, "Seu"; se a compra não sai, volta a ser Comprar.
async function escritorioComprarNaLoja(botao, classe) {
  if (!botao || botao.dataset.estado) return;
  botao.dataset.estado = "indo";
  let ok = false; try { ok = await escritorioAcaoMovel(classe, true, 1, false); } catch { ok = false; }
  if (ok === true) {
    if (botao.isConnected) { botao.dataset.estado = "feito"; botao.innerHTML = `${V2L_CERTO}Seu`; }
    setTimeout(() => redesenharCatalogoJanelaEscritorio(), 900);
  } else if (botao.isConnected) delete botao.dataset.estado;
}
function escritorioDesejarNaLoja(classe) {
  const d = escritorioDesejos();
  d.has(classe) ? d.delete(classe) : d.add(classe);
  try { localStorage.setItem("vybe-escritorio-desejos", JSON.stringify([...d])); } catch {}
  redesenharCatalogoJanelaEscritorio();
}
// A coluna das conquistas (e, na aba Conquistas, a tela inteira): as escadas mais perto de subir primeiro, cada
// uma numa linha que abre no lugar com os quatro níveis; embaixo, o título do mapa. A estante e a troca de título
// abrem ali mesmo.
function escritorioConquistasLojaHtml(largo = false) {
  const marcos = escritorioMarcosDaLoja();
  const topo = `<div class="v2l-conq-topo"><h2>Conquistas</h2><span class="v2l-sub">as mais perto de subir primeiro</span></div>`;
  if (!marcos) return topo + `<p class="v2l-vazio"${escritorio.conquistasErro ? ' role="alert"' : ""}>${escritorio.conquistasErro ? `Não deu para carregar: ${safeText(escritorio.conquistasErro)}` : escritorio.conquistasLidas ? "As conquistas em níveis estão sendo ativadas. Abra de novo em alguns minutos." : "Lendo as suas conquistas…"}${escritorio.conquistasErro ? ' <button type="button" class="v2l-btn s" onclick="escritorio.conquistasLidas=false;escritorioGarantirConquistasLoja();redesenharCatalogoJanelaEscritorio()">Tentar de novo</button>' : ""}</p>`;
  const r = escritorioConquistasResumo(marcos), NOMES = ["", "Bronze", "Prata", "Ouro", "Diamante"];
  const grupos = [["perto", "Perto de subir", null], ...ESCRITORIO_GRUPOS_CONQUISTA.map(([k, nome, , ids]) => [k, nome, ids])];
  const daAba = (ids) => ids ? ids.map((id) => marcos.find((m) => m.id === id)).filter(Boolean) : r.andamento.slice(0, 8);
  const visiveis = grupos.filter(([, , ids]) => daAba(ids).length);
  const aba = visiveis.some(([k]) => k === escritorio.cqAba) ? escritorio.cqAba : visiveis[0]?.[0];
  const todos = largo || escritorio.cqMaisGrupos || visiveis.findIndex(([k]) => k === aba) > 2;
  const chip = ([k, nome, ids]) => { const l = daAba(ids); return `<button type="button" class="v2l-chip" aria-pressed="${k === aba}" onclick="escritorio.cqAba='${k}';escritorio.cqAberta=undefined;escritorio.cqTitulos=false;redesenharConquistasLoja()">${safeText(nome)}${ids ? ` ${l.filter((x) => x.nivel).length}/${l.length}` : ""}</button>`; };
  const chips = `<div class="v2l-chips v2l-conq-chips" role="group" aria-label="Grupos de conquistas">${(todos ? visiveis : visiveis.slice(0, 3)).map(chip).join("")}${!todos && visiveis.length > 3 ? `<button type="button" class="v2l-chip" aria-expanded="false" title="Mostrar os outros grupos" onclick="escritorio.cqMaisGrupos=true;redesenharConquistasLoja()">+ ${visiveis.length - 3}</button>` : ""}</div>`;
  const lista = daAba(grupos.find(([k]) => k === aba)?.[2] ?? null);
  // Sem escolha ainda, a primeira de "Perto de subir" vem aberta (cqAberta: undefined = padrão, null = todas fechadas).
  const aberta = escritorio.cqAberta === undefined ? (aba === "perto" ? lista[0]?.id : null) : escritorio.cqAberta;
  const escada = (x) => {
    const prox = x.proximo, dp = prox && x.degraus.find((d) => d.nivel === prox.nivel), cheia = !prox && x.nivel > 0;
    const texto = x.social ? (x.nivel ? "conquistado" : x.dica || "ainda não") : prox ? `${v2lNum(x.valor)} de ${v2lNum(prox.meta)} · faltam ${v2lNum(prox.meta - x.valor)} para ${prox.nome}` : `${v2lNum(x.valor)} ${x.unidade} · escada completa`;
    const abre = x.id === aberta;
    return `<div class="v2-abre v2l-esc" aria-expanded="${abre}"><button type="button" class="v2l-lin" aria-expanded="${abre}" onclick="escritorioAbrirEscadaLoja(this,'${safeText(x.id)}')">
<span class="v2l-selo" style="--c:${V2L_NIVEL_COR[x.nivel] || V2L_NIVEL_COR[0]}">${x.nivel ? NOMES[x.nivel][0] : "·"}</span>
<span class="v2l-esc-meio"><span class="v2l-esc-nome"><b>${safeText(x.nome)}</b>${x.nomeNivel ? ` <span class="v2l-pill ${V2L_NIVEL_PILL[x.nivel] || "n"}">${safeText(x.nomeNivel)}</span>` : ""}</span><span class="v2-barra"><i style="--v:${x.social ? (x.nivel ? 100 : 0) : cheia ? 100 : r.pct(x)}%;--c:${cheia ? V2L_NIVEL_COR[x.nivel] : "#FF7A2F"}"></i></span><span class="v2l-sub">${safeText(texto)}</span></span>
${dp ? `<span class="v2l-premio"><b>+${dp.moedas}</b> moedas<br><b>+${dp.pontos}</b> XP</span>` : cheia || (x.social && x.nivel) ? '<span class="v2l-pill g">Completa</span>' : ""}</button>
<div class="v2-mais"><div><div class="v2l-niv">${x.degraus.map((d) => `<p class="${d.ok ? "ok" : ""}" title="+${d.moedas} moedas e +${d.pontos} XP${d.ok ? " · já é seu" : ""}"><b>${safeText(d.nome || NOMES[d.nivel] || "")} · ${v2lNum(d.meta)}</b>${safeText(d.titulo || `+${d.moedas} moedas`)}</p>`).join("")}</div>${x.criterio ? `<p class="v2l-sub v2l-criterio">${safeText(x.criterio)}</p>` : ""}</div></div></div>`;
  };
  const titulosHtml = `<div class="v2l-titulos" aria-label="Escolher título">${[4, 3, 2, 1].map((n) => { const l = r.titulos.filter((t) => t.nivel === n); return l.length ? `<p><span>${NOMES[n]}</span>${l.map((t) => `<button type="button" class="v2l-chip p" aria-pressed="${r.atual?.chave === t.chave}" title="${safeText(t.de)}" onclick="escolherTituloEscritorio('${safeText(t.chave)}')">${safeText(t.texto)}</button>`).join("")}</p>` : ""; }).join("")}<p><span>Sem título</span><button type="button" class="v2l-chip p" aria-pressed="${(escritorio.perfil?.titulo || "") === "nenhum"}" onclick="escolherTituloEscritorio('nenhum')">Não mostrar título</button></p></div>`;
  const estante = `<div class="v2l-estante" id="v2l-estante"><div class="v2l-conq-topo"><h2>Sua estante</h2><span class="v2l-sub">${r.ganhos.length} ${r.ganhos.length === 1 ? "troféu" : "troféus"}${r.melhor ? ` · o maior é ${safeText(r.melhor.nome)} ${safeText(r.melhor.degraus.filter((d) => d.ok).at(-1)?.nome || "")}` : ""}</span></div>${r.ganhos.length ? `<div class="v2l-estante-pecas">${r.ganhos.map((d) => `<span class="v2l-peca" style="--c:${V2L_NIVEL_COR[d.nivel]}" title="${safeText(d.escada)} ${safeText(d.nome)}">${escritorioMiniaturaHtml(d.classe)}</span>`).join("")}</div>` : '<p class="v2l-vazio">Os troféus que você ganhar aparecem aqui, prontos para expor no quarto.</p>'}</div>`;
  const pe = `<div class="v2l-titulo"><p><span class="v2l-sub">Seu título no mapa</span><b>${safeText(r.atual?.texto || (r.titulos.length ? "Sem título" : "Nenhum título ainda"))}</b></p>${r.titulos.length ? `<button type="button" class="v2l-btn s" aria-expanded="${Boolean(escritorio.cqTitulos)}" onclick="escritorio.cqTitulos=!escritorio.cqTitulos;redesenharConquistasLoja()">${escritorio.cqTitulos ? "Fechar títulos" : `Trocar título · ${r.titulos.length}`}</button>` : ""}</div>`;
  const escadas = `<div class="v2l-escadas">${escritorio.cqTitulos && !largo ? titulosHtml : lista.map(escada).join("") || '<p class="v2l-vazio">Nada aqui ainda.</p>'}</div>`;
  if (!largo) return topo + chips + escadas + pe;
  return `<div class="v2l-conq-col">${topo}${chips}${escadas}</div><div class="v2l-conq-col lado">${pe}${escritorio.cqTitulos ? titulosHtml : ""}${estante}</div>`;
}
function redesenharConquistasLoja() {
  const el = document.querySelector("#office-catalogo[open] #v2l-conq");
  if (!el) return;
  const rolagem = el.querySelector(".v2l-escadas")?.scrollTop || 0;
  el.innerHTML = escritorioConquistasLojaHtml(escritorio.cat?.aba === "conquistas");
  const lista = el.querySelector(".v2l-escadas"); if (lista) lista.scrollTop = rolagem;
}
// A escada abre e fecha no lugar, sem redesenhar a coluna (uma aberta por vez).
function escritorioAbrirEscadaLoja(botao, id) {
  const linha = botao.closest(".v2l-esc"); if (!linha) return;
  const abre = linha.getAttribute("aria-expanded") !== "true";
  for (const e of linha.parentElement.querySelectorAll('.v2l-esc[aria-expanded="true"]')) { e.setAttribute("aria-expanded", "false"); e.querySelector(".v2l-lin")?.setAttribute("aria-expanded", "false"); }
  linha.setAttribute("aria-expanded", String(abre)); botao.setAttribute("aria-expanded", String(abre));
  escritorio.cqAberta = abre ? id : null;
}
