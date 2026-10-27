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
function escritorioContaLoja(categoria) {
  return escritorioCatalogoGeralLista({ categoria, busca: "", raridade: "", posso: false, desejos: false }).length;
}
// Navegação da esquerda: atalhos e seções sempre abertas, com ícone e número.
function escritorioArvoreLojaHtml(ativo, acao) {
  const vai = (valor) => acao.replace("%", safeText(valor));
  const item = (valor, rotulo, icone, n, extra = "") => `<button type="button" class="ofc-loja-nav${extra}" aria-pressed="${ativo === valor}" onclick="${vai(valor)}">${escritorioIcone(icone)}<span>${safeText(rotulo)}</span>${n != null ? `<small>${n.toLocaleString("pt-BR")}</small>` : ""}</button>`;
  const vitrine = (escritorio.base?.economia?.loja?.vitrine || []).length, desejos = escritorioDesejos().size, jogos = escritorioContaLoja("Jogos com a equipe");
  const secoes = ESCRITORIO_SECOES_LOJA.map(([t, ico]) => {
    const n = escritorioContaLoja(`secao:${t}`);
    return n ? item(`secao:${t}`, t, ico, n) : "";
  }).join("");
  return `<div class="ofc-loja-grupo">${item("*", "Destaques", "estrela", null, " forte")}${jogos ? item("Jogos com a equipe", "Jogos com a equipe", "jogo", jogos, " jogos") : ""}${vitrine ? item("Vitrine da semana", "Vitrine da semana", "alvo", vitrine, " vitrine") : ""}${desejos ? `<button type="button" class="ofc-loja-nav" aria-pressed="${Boolean(escritorio.cat?.desejos)}" onclick="escritorio.cat.desejos=!escritorio.cat.desejos;escritorio.cat.categoria='*';escritorio.cat.ver=60;redesenharCatalogoJanelaEscritorio()">${escritorioIcone("estrela")}<span>Meus desejos</span><small>${desejos}</small></button>` : ""}${escritorioRecentes().length ? item("Recentes", "Vistos por você", "lista", escritorioRecentes().length) : ""}</div><div class="ofc-loja-grupo"><h5>Categorias</h5>${secoes}</div>`;
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
// Capa da Loja: a vitrine da semana e prateleiras por categoria (seis peças
// de cada, as mais raras primeiro), cada uma com "ver tudo".
const ESCRITORIO_PRATELEIRAS_LOJA = ["Cadeiras", "Sofás", "Mesas", "Luzes", "Plantas", "Decoração (quadros, estátuas…)", "Tapetes", "Jogos e música", "Cozinha e bar", "Lazer (piscina, rede, carro…)"];
function escritorioCapaLojaHtml() {
  if (!escritorio.base) return '<p class="ofc-nota">Carregando a loja…</p>';
  const saldo = Number(escritorio.base?.economia?.saldo || 0);
  const ordem = (a, b) => (ESCRITORIO_ORDEM_RARIDADE[escritorioInfoLoja(b.classe).raridade] ?? 0) - (ESCRITORIO_ORDEM_RARIDADE[escritorioInfoLoja(a.classe).raridade] ?? 0) || escritorioNomeMovel(a).localeCompare(escritorioNomeMovel(b), "pt-BR");
  const prateleira = (cat) => {
    const l = escritorioCatalogoGeralLista({ categoria: cat, busca: "", raridade: "", posso: false, desejos: false }).filter((m) => escritorioInfoLoja(m.classe).naVitrine && !escritorioInfoLoja(m.classe).marco).sort(ordem);
    if (!l.length) return "";
    return `<section class="ofc-loja-prateleira"><div class="ofc-loja-prat-topo"><h3>${safeText(escritorioRotuloCategoria(cat))}</h3><small>${l.length.toLocaleString("pt-BR")}</small><button type="button" onclick="escritorio.cat.categoria='${safeText(cat)}';escritorio.cat.ver=60;redesenharCatalogoJanelaEscritorio()">ver tudo ›</button></div><div class="ofc-loja-fila">${l.slice(0, 6).map((m) => escritorioCartaoMovel(m, { loja: true })).join("")}</div></section>`;
  };
  const baratos = escritorioCatalogoGeralLista({ categoria: "*", busca: "", raridade: "", posso: true, desejos: false }).filter((m) => escritorioInfoLoja(m.classe).raridade === "comum").length;
  // Jogos com a equipe primeiro (Paulo, 27/10/2026: são as coisas interativas).
  const jogos = escritorioCatalogoGeralLista({ categoria: "Jogos com a equipe", busca: "", raridade: "", posso: false, desejos: false });
  const prateleiraJogos = !jogos.length ? "" : `<section class="ofc-loja-prateleira ofc-loja-jogos"><div class="ofc-loja-prat-topo"><h3>${escritorioIcone("jogo")}Jogos com a equipe</h3><small>${jogos.length}</small></div><p class="ofc-nota">Ponha no escritório e chame quem está online: de graça ou valendo VybeCoins, móveis ou roupas.</p><div class="ofc-loja-fila">${jogos.map((m) => escritorioCartaoMovel(m, { loja: true })).join("")}</div></section>`;
  return `<div class="ofc-loja-capa"><div class="ofc-loja-saudacao"><b>Loja da Vybelândia</b><span>Você tem <i>${saldo.toLocaleString("pt-BR")} VybeCoins</i>${baratos ? ` · ${baratos.toLocaleString("pt-BR")} peças cabem no seu saldo` : ""}. Pisos, paredes e blocos são grátis na construção.</span></div>${prateleiraJogos}${escritorioDestaquesLojaHtml().replace('<h4 class="ofc-loja-todos">Todos os móveis</h4>', "")}${typeof escritorioAmbientesCapaHtml === "function" ? escritorioAmbientesCapaHtml() : ""}${ESCRITORIO_PRATELEIRAS_LOJA.map(prateleira).join("")}</div>`;
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
  if (!semPerguntar && !confirm(`Vender 1 × ${nome} para a loja por ${v.valor.toLocaleString("pt-BR")} VybeCoins (o que você pagou)?\nSaldo: ${saldo.toLocaleString("pt-BR")} → ${(saldo + v.valor).toLocaleString("pt-BR")}.\nA peça sai do seu inventário.`)) return;
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
  if (!valor || !confirm(`Vender ${nome} por ${valor.toLocaleString("pt-BR")} VybeCoins (o que você pagou)?\nA peça sai do quarto e a construção é salva agora, com as outras mudanças.`)) return;
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
