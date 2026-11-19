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
  // V2 (pranchas V2-M-Loja e V2-M-Conquistas, 16/11/2026): a janela de vidro fumê com o título no vidro, as partes
  // (Loja, Inventário, Carteira, Conquistas), a busca num menu do topo e o fechar; à esquerda a folha dos itens (a
  // cabeça com as fichas, a grade de itens grandes que rola por dentro) ou, em Conquistas, as duas folhas dela; à
  // direita a consulta de 316 (#v2l-kpis): saldo, vitrine da semana e atalhos, ou o laranja do próximo troféu.
  // Os ids de sempre continuam (abas, busca, fichas, Filtros, faixas, info, grade, conquistas e ficha).
  const lupa = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>';
  return `<div class="d3m-e-tela d3m-f-loja" id="v2-loja">
<div class="d3m-e-topo"><div class="d3m-e-tit"><span class="d3m-e-h" id="d3m-f-loja-h" role="heading" aria-level="1">Loja</span><span class="d3m-e-sub" id="d3m-f-loja-sub"></span></div>
<div class="d3m-e-acoes"><div class="d3m-e-per d3m-f-partes" id="office-catj-abas" role="group" aria-label="Partes da loja"></div><details class="d3m-e-troca d3m-f-menu d3m-f-loja-busca"${f.busca ? " open" : ""}><summary class="d3m-e-ico" aria-label="Buscar na loja" title="Buscar na loja">${lupa}</summary><div class="d3m-e-pop"><label class="v2l-so-leitor" for="v2l-busca">Buscar na loja</label><input type="search" id="v2l-busca" class="v2l-busca d3m-f-campo" placeholder="Buscar: mesa, sofá" autocomplete="off" value="${safeText(f.busca)}" oninput="escritorio.cat.busca=this.value;escritorio.cat.ver=60;desenharCatalogoJanelaEscritorio()"></div></details><span class="d3m-f-saldo" id="d3m-f-loja-saldo"></span><button type="button" class="d3m-e-ico" onclick="this.closest('dialog').close()" aria-label="Fechar a loja"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>
<div class="d3m-e-corpo">
<div class="d3m-e-main">
<section class="d3m-e-folha cresce d3m-f-itens v2l-esq" aria-label="Itens">
<div class="d3m-e-cab"><b id="d3m-f-loja-tit">Destaques</b><div class="d3m-e-cab-dir v2l-filtros"><div class="d3m-f-fichas" id="v2l-chips" role="group" aria-label="Filtros da loja"></div></div></div>
<div class="v2-abre v2l-painel" id="v2l-painel" aria-expanded="false"><i hidden></i><div class="v2-mais"><div id="v2l-painel-dentro"></div></div></div>
<div class="v2l-faixas d3m-f-faixas" id="office-catj-faixas" role="group" aria-label="Filtros do inventário"></div>
<div class="v2l-info d3m-f-info" id="office-catj-info"></div>
<div class="d3m-e-rola d3m-f-grade" id="office-catj-grade"></div>
</section>
<div class="d3m-f-conq" id="v2l-conq" aria-label="Conquistas"></div>
</div>
<aside class="d3m-lado d3m-f-lado" id="v2l-kpis" aria-label="Consulta"></aside>
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
    let n = 0, total = 0; try { n = escritorioCatalogoGeralLista({ categoria: "*", busca: "", raridade: "", posso: true, desejos: false }).filter((m) => escritorioInfoLoja(m.classe).raridade === "comum").length; total = escritorioCatalogoGeralLista({ categoria: "*", busca: "", raridade: "", posso: false, desejos: false }).filter((m) => escritorioInfoLoja(m.classe).raridade === "comum").length; } finally { if (escritorio.cat) escritorio.cat.aba = aba; }
    escritorioCabemNoSaldo = { saldo: eco.saldo, loja: eco.loja, n, total };
  }
  return escritorioCabemNoSaldo.n;
}
// A consulta da direita (#v2l-kpis; prancha V2-M-Loja): o saldo com quanto da loja cabe nele, a vitrine da semana,
// como ganhar VybeCoins e os atalhos. Em Conquistas (prancha V2-M-Conquistas): o laranja do próximo troféu, os níveis
// ganhos por área e o ranking. Os números são os mesmos de antes (saldo, peças que cabem, troféus, próximo troféu).
function escritorioLojaKpisHtml() {
  const eco = escritorio.base?.economia, marcos = escritorioMarcosDaLoja(), aba = escritorio.cat?.aba || "loja";
  // Inventário e Carteira nas pranchas V2-R (só na janela de vidro do mundo; fora dele, a consulta de sempre).
  if ((aba === "carteira" || aba === "inventario") && document.getElementById("office-catalogo")?.classList.contains("d3m-f-lojaj")) return escritorioLojaLadoV2Html(aba);
  const saldo = Number(eco?.saldo || 0), cabem = escritorioLojaCabem(), comuns = escritorioCabemNoSaldo?.total || 0;
  const seta = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const ir = (chave, rotulo, apoio) => `<button type="button" class="d3m-vlin" onclick="escritorio.cat.aba='${chave}';escritorio.cat.ver=60;${chave === "inventario" ? "carregarTrocasEscritorio();" : ""}redesenharCatalogoJanelaEscritorio()"><span><b>${rotulo}</b> <span class="d3m-f-ap">· ${apoio}</span></span>${seta}</button>`;
  const r = marcos ? escritorioConquistasResumo(marcos) : null, p = r?.andamento[0], dp = p && p.degraus.find((d) => d.nivel === p.proximo.nivel);
  const frase = escritorio.conquistasErro ? "Não deu para ler as conquistas agora." : escritorio.conquistasLidas ? "As conquistas em níveis estão sendo ativadas." : "Lendo as suas conquistas…";
  if (aba === "conquistas") {
    const NOMES = ["", "Bronze", "Prata", "Ouro", "Diamante"];
    const rot = `<span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">V</span>VYBES · ${!r || p ? "o próximo troféu" : "os seus troféus"}</span>`;
    const bts = `<div class="d3m-lar-bts"><button type="button" class="d3m-btn l" onclick="this.closest('dialog')?.close();window.mundoVoxel?.irPara?.('tarefas')">Ver minha fila</button><button type="button" class="d3m-btn l s" onclick="document.querySelector('#v2l-estante .d3m-e-rola')?.focus()">Ver a estante</button></div>`;
    const dentro = !r ? `<span class="d3-acao-frase">${frase}</span>`
      : p ? `<b class="d3m-lar-num">${v2lNum(p.proximo.meta - p.valor)}</b><span class="d3-acao-frase">${safeText(p.unidade)} para ${NOMES[p.proximo.nivel] ? `a ${safeText(NOMES[p.proximo.nivel])}` : safeText(p.proximo.nome)}</span><small class="d3m-f-lar-ap">${safeText(p.nome)}: você tem ${v2lNum(p.valor)} de ${v2lNum(p.proximo.meta)}.${dp ? ` Vale ${v2lNum(dp.moedas)} moedas e ${v2lNum(dp.pontos)} XP.` : ""}</small>${bts}`
      : `<b class="d3m-lar-num">${v2lNum(r.niveis)}</b><span class="d3-acao-frase">${r.niveis ? "troféus, nenhuma escada em andamento" : "a primeira entrega abre a primeira escada"}</span>${bts}`;
    const lar = `<section class="d3m-laranja d3m-f-lar" aria-label="VYBES · o próximo troféu">${rot}<div class="d3m-lar-txt">${dentro}</div></section>`;
    const areas = r && typeof ESCRITORIO_GRUPOS_CONQUISTA !== "undefined" ? ESCRITORIO_GRUPOS_CONQUISTA.map(([, nome, , ids]) => { const l = ids.map((id) => marcos.find((m) => m.id === id)).filter(Boolean); return l.length ? [nome, l.filter((x) => x.nivel).length, l.length] : null; }).filter(Boolean) : [];
    const porArea = areas.length ? `<section class="d3m-cons" aria-label="Por área"><div class="d3m-cons-cab"><b>Por área</b><span>níveis ganhos</span></div><div class="d3m-f-areas">${areas.map(([nome, n, t]) => `<span class="d3m-f-area"><span class="d3m-f-ap">${safeText(nome)}</span><span class="d3m-f-area-b"><i style="--v:${Math.round((n / t) * 100)}%"></i></span><b>${n}/${t}</b></span>`).join("")}</div></section>` : "";
    return `${lar}${porArea}<section class="d3m-cons" aria-label="Abrir"><div class="d3m-cons-cab"><b>Abrir</b><span></span></div><button type="button" class="d3m-vlin" onclick="this.closest('dialog')?.close();abrirRankingEscritorio(undefined,'semana')"><span><b>Ranking da semana</b> <span class="d3m-f-ap">· quem lidera</span></span>${seta}</button>${ir("loja", "Loja", "gastar as VybeCoins")}</section>`;
  }
  const saldoHtml = `<section class="d3m-cons" aria-label="Seu saldo"><div class="d3m-cons-cab"><b>Seu saldo</b><span>VybeCoins</span></div><div class="d3m-f-saldo-box"><b class="d3m-f-saldo-n">${eco ? v2lNum(saldo) : "…"}</b><span class="d3m-f-saldo-b" title="Quanto da loja comum cabe no seu saldo"><i style="--v:${eco && comuns ? Math.max(2, Math.round((cabem / comuns) * 100)) : 0}%"></i></span><small class="d3m-f-ap">${cabem ? `${v2lNum(cabem)} ${cabem === 1 ? "peça cabe" : "peças cabem"} no saldo. ` : ""}Piso, parede e bloco são grátis.</small></div></section>`;
  const loja = eco?.loja, hoje = typeof hojeDeVerdade === "function" ? hojeDeVerdade() : new Date().toISOString().slice(0, 10);
  const troca = loja?.semana ? Math.max(1, Math.round((Date.parse(loja.semana) + 7 * 864e5 - Date.parse(hoje)) / 864e5)) : 0;
  const vitrine = (loja?.vitrine || []).map((c) => { const i = escritorioInfoLoja(c); return `<button type="button" class="d3m-vlin" onclick="abrirPreviaMovelEscritorio('${safeText(c)}')"><span><b>${safeText(escritorioNomeDaClasse(c))}</b> <span class="d3m-f-ap">· ${i.restante === 0 ? "esgotado" : i.restante > 0 ? (i.restante === 1 ? "resta 1" : `restam ${i.restante}`) : `${v2lNum(i.preco)} moedas`}</span></span>${seta}</button>`; }).join("");
  const vitrineHtml = vitrine ? `<section class="d3m-cons d3m-f-cresce" aria-label="Vitrine da semana"><div class="d3m-cons-cab"><b>Vitrine da semana</b><span>${troca ? `troca em ${troca} ${troca === 1 ? "dia" : "dias"}` : ""}</span></div><div class="d3m-f-lista">${vitrine}</div></section>` : "";
  const ganhar = `<section class="d3m-cons" aria-label="Como ganhar VybeCoins"><div class="d3m-cons-cab"><b>Como ganhar VybeCoins</b><span></span></div><p class="d3m-f-ganhar">Entregas, missões do dia e troféus.${dp ? ` O próximo troféu vale ${v2lNum(dp.moedas)} moedas.` : ""}</p></section>`;
  const abrir = `<section class="d3m-cons" aria-label="Abrir"><div class="d3m-cons-cab"><b>Abrir</b><span></span></div>${[aba !== "loja" ? ir("loja", "Loja", "móveis e roupas") : "", aba !== "inventario" ? ir("inventario", "Inventário", "o que já é seu") : "", aba !== "carteira" ? ir("carteira", "Carteira", "entradas e saídas") : "", ir("conquistas", "Conquistas", r ? `${v2lNum(r.niveis)} de ${v2lNum(r.total)} troféus` : "os troféus")].join("")}</section>`;
  return saldoHtml + vitrineHtml + ganhar + abrir;
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
  // Na tela Conquistas (prancha V2-M-Conquistas) as fichas moram na cabeça da folha: duas à vista e "+ N" para o resto.
  const mostra = largo ? 2 : 3;
  const todos = escritorio.cqMaisGrupos || visiveis.findIndex(([k]) => k === aba) >= mostra;
  const chip = ([k, nome, ids]) => { const l = daAba(ids); return `<button type="button" class="v2l-chip" aria-pressed="${k === aba}" onclick="escritorio.cqAba='${k}';escritorio.cqAberta=undefined;escritorio.cqTitulos=false;redesenharConquistasLoja()">${safeText(nome)}${ids ? ` ${l.filter((x) => x.nivel).length}/${l.length}` : ""}</button>`; };
  const chips = `<div class="v2l-chips v2l-conq-chips" role="group" aria-label="Grupos de conquistas">${(todos ? visiveis : visiveis.slice(0, mostra)).map(chip).join("")}${!todos && visiveis.length > mostra ? `<button type="button" class="v2l-chip" aria-expanded="false" title="Mostrar os outros grupos" onclick="escritorio.cqMaisGrupos=true;redesenharConquistasLoja()">+ ${visiveis.length - mostra}</button>` : ""}</div>`;
  const lista = daAba(grupos.find(([k]) => k === aba)?.[2] ?? null);
  // Sem escolha ainda, a primeira de "Perto de subir" vem aberta (cqAberta: undefined = padrão, null = todas fechadas).
  const aberta = escritorio.cqAberta === undefined ? (aba === "perto" ? lista[0]?.id : null) : escritorio.cqAberta;
  const escada = (x) => {
    const prox = x.proximo, dp = prox && x.degraus.find((d) => d.nivel === prox.nivel), cheia = !prox && x.nivel > 0;
    const texto = x.social ? (x.nivel ? "conquistado" : x.dica || "ainda não") : prox ? `${v2lNum(x.valor)} de ${v2lNum(prox.meta)} · faltam ${v2lNum(prox.meta - x.valor)} para ${prox.nome}` : `${v2lNum(x.valor)} ${x.unidade} · escada completa`;
    const abre = x.id === aberta;
    return `<div class="v2-abre v2l-esc" aria-expanded="${abre}"><button type="button" class="v2l-lin" aria-expanded="${abre}" onclick="escritorioAbrirEscadaLoja(this,'${safeText(x.id)}')">
<span class="v2l-selo" style="--c:${V2L_NIVEL_COR[x.nivel] || V2L_NIVEL_COR[0]}">${x.nivel ? NOMES[x.nivel][0] : "·"}</span>
<span class="v2l-esc-meio"><span class="v2l-esc-nome"><b>${safeText(x.nome)}</b>${x.nomeNivel ? ` <span class="v2l-pill ${V2L_NIVEL_PILL[x.nivel] || "n"}">${safeText(x.nomeNivel)}</span>` : ""}</span><span class="v2-barra"><i style="--v:${x.social ? (x.nivel ? 100 : 0) : cheia ? 100 : r.pct(x)}%;--c:${cheia ? V2L_NIVEL_COR[x.nivel] : "var(--d3-tinta)"}"></i></span><span class="v2l-sub">${safeText(texto)}</span></span>
${dp ? `<span class="v2l-premio"><b>+${dp.moedas}</b> moedas<br><b>+${dp.pontos}</b> XP</span>` : cheia || (x.social && x.nivel) ? '<span class="v2l-pill g">Completa</span>' : ""}</button>
<div class="v2-mais"><div><div class="v2l-niv">${x.degraus.map((d) => `<p class="${d.ok ? "ok" : ""}" title="+${d.moedas} moedas e +${d.pontos} XP${d.ok ? " · já é seu" : ""}"><b>${safeText(d.nome || NOMES[d.nivel] || "")} · ${v2lNum(d.meta)}</b>${safeText(d.titulo || `+${d.moedas} moedas`)}</p>`).join("")}</div>${x.criterio ? `<p class="v2l-sub v2l-criterio">${safeText(x.criterio)}</p>` : ""}</div></div></div>`;
  };
  const titulosHtml = `<div class="v2l-titulos" aria-label="Escolher título">${[4, 3, 2, 1].map((n) => { const l = r.titulos.filter((t) => t.nivel === n); return l.length ? `<p><span>${NOMES[n]}</span>${l.map((t) => `<button type="button" class="v2l-chip p" aria-pressed="${r.atual?.chave === t.chave}" title="${safeText(t.de)}" onclick="escolherTituloEscritorio('${safeText(t.chave)}')">${safeText(t.texto)}</button>`).join("")}</p>` : ""; }).join("")}<p><span>Sem título</span><button type="button" class="v2l-chip p" aria-pressed="${(escritorio.perfil?.titulo || "") === "nenhum"}" onclick="escolherTituloEscritorio('nenhum')">Não mostrar título</button></p></div>`;
  const estante = `<div class="v2l-estante" id="v2l-estante"><div class="v2l-conq-topo"><h2>Sua estante</h2><span class="v2l-sub">${r.ganhos.length} ${r.ganhos.length === 1 ? "troféu" : "troféus"}${r.melhor ? ` · o maior é ${safeText(r.melhor.nome)} ${safeText(r.melhor.degraus.filter((d) => d.ok).at(-1)?.nome || "")}` : ""}</span></div>${r.ganhos.length ? `<div class="v2l-estante-pecas">${r.ganhos.map((d) => `<span class="v2l-peca" style="--c:${V2L_NIVEL_COR[d.nivel]}" title="${safeText(d.escada)} ${safeText(d.nome)}">${escritorioMiniaturaHtml(d.classe)}</span>`).join("")}</div>` : '<p class="v2l-vazio">Os troféus que você ganhar aparecem aqui, prontos para expor no quarto.</p>'}</div>`;
  const pe = `<div class="v2l-titulo"><p><span class="v2l-sub">Seu título no mapa</span><b>${safeText(r.atual?.texto || (r.titulos.length ? "Sem título" : "Nenhum título ainda"))}</b></p>${r.titulos.length ? `<button type="button" class="v2l-btn s" aria-expanded="${Boolean(escritorio.cqTitulos)}" onclick="escritorio.cqTitulos=!escritorio.cqTitulos;redesenharConquistasLoja()">${escritorio.cqTitulos ? "Fechar títulos" : `Trocar título · ${r.titulos.length}`}</button>` : ""}</div>`;
  const escadas = `<div class="v2l-escadas">${escritorio.cqTitulos && !largo ? titulosHtml : lista.map(escada).join("") || '<p class="v2l-vazio">Nada aqui ainda.</p>'}</div>`;
  if (!largo) return topo + chips + escadas + pe;
  // A tela Conquistas (prancha V2-M-Conquistas): a folha "Mais perto de subir" (as fichas na cabeça, as escadas que
  // abrem no lugar e o título no pé) e a folha "Sua estante" (os troféus e, no pé, quantos de cada nível).
  const nomeAba = aba === "perto" ? "Mais perto de subir" : grupos.find(([k]) => k === aba)?.[1] || "Conquistas";
  const conta = aba === "perto" ? `${lista.length} de ${r.andamento.length}` : `${lista.filter((x) => x.nivel).length} de ${lista.length} conquistas`;
  const maior = r.melhor ? `o maior é ${safeText(r.melhor.nome)} ${safeText(r.melhor.degraus.filter((d) => d.ok).at(-1)?.nome || "")}` : "";
  const subir = `<section class="d3m-e-folha cresce d3m-f-subir" aria-label="${safeText(nomeAba)}"><div class="d3m-e-cab"><b>${safeText(nomeAba)} <span>· ${conta}</span></b>${chips}</div>
<div class="d3m-e-rola v2l-escadas">${escritorio.cqTitulos ? titulosHtml : lista.map(escada).join("") || '<p class="v2l-vazio">Nada aqui ainda.</p>'}</div>
<div class="d3m-e-pe d3m-f-titulo"><span class="d3m-f-titulo-t"><b>Seu título no mapa</b> · ${safeText(r.atual?.texto || (r.titulos.length ? "sem título" : "sem título ainda"))}</span>${r.titulos.length ? `<button type="button" class="d3v-btn sec d3m-f-fio" aria-expanded="${Boolean(escritorio.cqTitulos)}" onclick="escritorio.cqTitulos=!escritorio.cqTitulos;redesenharConquistasLoja()">${escritorio.cqTitulos ? "Fechar os títulos" : `Trocar o título · ${r.titulos.length}`}</button>` : ""}</div></section>`;
  const prateleira = `<section class="d3m-e-folha cresce d3m-f-estante" id="v2l-estante" aria-label="Sua estante"><div class="d3m-e-cab"><b>Sua estante <span>· ${v2lNum(r.niveis)} de ${v2lNum(r.total)}</span></b><span class="d3m-e-cab-dir">${maior}</span></div>
<div class="d3m-e-rola" tabindex="-1">${r.ganhos.length ? `<div class="d3m-f-pecas">${r.ganhos.map((d) => `<span class="d3m-f-peca" style="--c:${V2L_NIVEL_COR[d.nivel]}" title="${safeText(d.escada)} ${safeText(d.nome)}">${escritorioMiniaturaHtml(d.classe)}</span>`).join("")}</div>` : '<p class="v2l-vazio">Os troféus que você ganhar aparecem aqui, prontos para expor no quarto.</p>'}</div>
<div class="d3m-e-pe d3m-f-trofeus"><span>Troféus</span>${r.porNivel.map((q, i) => `<span class="d3m-f-trofeu"><b>${v2lNum(q)}</b> ${["bronze", "prata", "ouro", "diamante"][i]}</span>`).join("")}</div></section>`;
  void topo; void pe; void estante;
  return subir + prateleira;
}
function redesenharConquistasLoja() {
  const el = document.querySelector("#office-catalogo[open] #v2l-conq");
  if (!el || escritorio.cat?.aba !== "conquistas") return;
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

// ---------------------------------------------------------------------------
// Inventário e Carteira nas pranchas V2-R-Loja-Inventario e V2-R-Loja-Carteira (aprovadas pelo Paulo). Os dados são os
// mesmos de antes (economia do Escritório: saldo, ritmo dos 7 dias, ganhos, pontos, histórico, marcos e raridades); a
// compra, a venda, a troca e a ficha do móvel continuam nas funções de sempre.
const V2R_SETA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
function escritorioCarteiraV2Html() {
  const c = escritorio.base?.economia;
  if (!c?.disponivel) return `<p class="ofc-nota">${safeText(c?.motivo || "A carteira aparece quando a loja do escritório estiver ativa.")}</p>`;
  const p = c.pontos || null, r = c.ritmo || null, dias = r?.dias || [];
  const semana = dias.reduce((t, d) => t + Number(d.moedas || 0), 0), xpSemana = dias.reduce((t, d) => t + Number(d.xp || 0), 0);
  const cabem = typeof escritorioLojaCabem === "function" ? escritorioLojaCabem() : 0;
  const pct = p?.xpProximo ? Math.max(0, Math.min(100, Math.round((p.xp / p.xpProximo) * 100))) : 0;
  const anel = `<svg class="d3m-r-lj-anel" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="f"/><circle cx="18" cy="18" r="15" class="v" style="stroke-dasharray:${(pct * 0.9425).toFixed(1)} 94.25"/></svg>`;
  const mini = (() => { const v = dias.map((d) => Number(d.moedas || 0)); if (v.length < 2) return ""; const mx = Math.max(1, ...v), w = 84, h = 36;
    const fio = v.map((n, i) => `${i ? "L" : "M"}${(2 + (i * (w - 4)) / (v.length - 1)).toFixed(1)} ${(h - 3 - (n / mx) * (h - 6)).toFixed(1)}`).join(" ");
    return `<svg class="d3m-r-lj-mini" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="veu" d="${fio} V${h} H2 Z"/><path class="fio" d="${fio}"/></svg>`; })();
  const num = (rot, ic, tom, v, de, sub, graf = "") => `<div class="d3m-e-folha d3m-r-lj-num"><span class="d3m-r-lj-num-cab"><span>${rot}</span><i class="d3m-r-lj-selo ${tom}" aria-hidden="true">${ic}</i></span><span class="d3m-r-lj-num-pe"><span><b>${v}${de ? `<small> ${de}</small>` : ""}</b><small>${sub}</small></span>${graf}</span></div>`;
  const nums = `<div class="d3m-r-lj-nums">${num("Saldo disponível", "$", "", v2lNum(c.saldo), "moedas", cabem ? `cabem ${v2lNum(cabem)} peças da loja` : "piso, parede e bloco são grátis")}
    ${p ? num("Nível", "★", "l", String(p.nivel), `· ${v2lNum(p.xpTotal ?? p.xp)} XP`, `faltam ${v2lNum(Math.max(0, p.xpProximo - p.xp))} XP para o ${p.nivel + 1}`, anel) : num("Nível", "★", "l", "—", "", "sem pontos ainda")}
    ${num("Nesta semana", "↗", "g", `${semana >= 0 ? "+" : "−"}${v2lNum(Math.abs(semana))}`, "", dias.length ? `moedas ganhas em ${dias.length} dias` : "sem ritmo ainda", mini)}</div>`;
  const nomeDia = (iso) => ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(iso + "T12:00:00").getDay()];
  const mxM = Math.max(1, ...dias.map((d) => Number(d.moedas || 0))), mxX = Math.max(1, ...dias.map((d) => Number(d.xp || 0)));
  const faixas = (c.loja?.raridades || []).map((x) => x.preco).filter((v) => v > Number(c.saldo || 0)).sort((a, b) => a - b);
  const alvo = faixas[0] || null, previsao = r?.porDia > 0 && alvo ? `No seu ritmo, ${v2lNum(alvo)} moedas cabem no saldo em cerca de ${Math.max(1, Math.ceil((alvo - Number(c.saldo || 0)) / r.porDia))} dias.` : r?.porDia > 0 ? `Você ganha cerca de ${String(r.porDia).replace(".", ",")} moedas por dia.` : "Sem ganho nos últimos dias.";
  const barras = `<section class="d3m-e-folha d3m-r-lj-dias" aria-label="Últimos 7 dias"><div class="d3m-e-cab"><b>Últimos 7 dias <span>· ${semana >= 0 ? "+" : "−"}${v2lNum(Math.abs(semana))} moedas, +${v2lNum(xpSemana)} XP</span></b><span class="d3m-e-cab-dir"><span class="d3m-r-lj-leg"><i class="m"></i>moedas</span><span class="d3m-r-lj-leg"><i class="x"></i>XP</span></span></div>
    ${dias.length ? `<ol class="d3m-r-lj-barras" aria-label="Moedas e XP por dia">${dias.map((d) => `<li title="${nomeDia(d.dia)} ${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}: ${d.moedas} moedas e ${d.xp} XP"><span class="d3m-r-lj-col"><i class="m" style="--v:${Math.round((Math.max(0, d.moedas) / mxM) * 100)}%"></i><i class="x" style="--v:${Math.round((Math.max(0, d.xp) / mxX) * 100)}%"></i></span><small>${nomeDia(d.dia)}</small></li>`).join("")}</ol>` : '<p class="d3m-r-lj-nada">Ainda sem moedas nos últimos dias.</p>'}
    <p class="d3m-r-lj-prev">${safeText(previsao)}</p></section>`;
  const ganhos = (p?.ganhos || []).filter((g) => Number(g.moedas) || Number(g.pontos));
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const vieram = `<section class="d3m-e-folha d3m-r-lj-vieram" aria-label="De onde vieram"><div class="d3m-e-cab"><b>De onde vieram <span>· ${safeText(mes)}</span></b></div>
    <ul class="d3m-r-lj-lista">${ganhos.map((g) => `<li><span><b>${safeText(g.descricao)}</b> <span>· ${g.vezes === 1 ? "1 vez" : `${g.vezes} vezes`}</span></span><em class="${Number(g.moedas) < 0 ? "r" : "g"}">${Number(g.moedas) >= 0 ? "+" : "−"}${v2lNum(Math.abs(Number(g.moedas)))}</em></li>`).join("") || '<li class="d3m-r-lj-nada">Nenhum ganho registrado neste mês.</li>'}</ul></section>`;
  // O extrato das compras, vendas, kits e devoluções, com onde cada coisa está agora.
  const h = Array.isArray(c.historico) ? c.historico : [], filtro = escritorio.cat?.hist || "tudo";
  const TIPOS = { compra: "Comprou", kit: "Kit", venda: "Vendeu", devolucao: "Devolução" };
  const doFiltro = { tudo: () => true, compras: (x) => x.tipo === "compra" || x.tipo === "kit", vendas: (x) => x.tipo === "venda", devolucoes: (x) => x.tipo === "devolucao" }[filtro] || (() => true);
  const meus = new Map((typeof escritorioMeuInventario === "function" ? escritorioMeuInventario() : []).map((i) => [i.classe, i]));
  const onde = (x) => { const classe = x.classes?.[0] || ""; if (x.tipo === "venda") return "saiu do inventário"; if (x.tipo === "devolucao") return "voltou para a loja"; if (x.tipo === "kit") return `${x.unidades} peças no quarto`;
    if (classe.startsWith("roupa:")) return "no guarda-roupa"; if ((escritorio.base?.quartos?.essenciais || []).includes(classe)) return "grátis agora";
    const i = meus.get(classe); if (!i) return "não está mais com você"; return i.noQuarto ? "no quarto" : "guardado"; };
  const quando = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`; };
  const nomeDo = (x) => { const classe = x.classes?.[0] || ""; return x.tipo === "kit" ? `Kit ${x.kit}` : classe.startsWith("roupa:") ? "Roupa do avatar" : `${x.unidades > 1 ? `${x.unidades} × ` : ""}${escritorioNomeDaClasse(classe)}`; };
  const seg = [["tudo", "Tudo"], ["compras", "Compras"], ["vendas", "Vendas"], ["devolucoes", "Devoluções"]].map(([k, n]) => `<button type="button" aria-pressed="${filtro === k}" onclick="escritorio.cat.hist='${k}';desenharCatalogoJanelaEscritorio()">${n}</button>`).join("");
  const linhas = h.filter(doFiltro);
  const hist = `<section class="d3m-e-folha d3m-r-lj-hist" aria-label="Histórico de compras"><div class="d3m-e-cab"><b>Histórico de compras <span>· o extrato da sua carteira</span></b><span class="d3m-e-seg" role="group" aria-label="Filtrar o histórico">${seg}</span></div>
    ${linhas.length ? `<div class="d3m-r-lj-tl d3m-r-lj-tc" aria-hidden="true"><span>O quê</span><span>Onde está</span><span>Quando</span><span>Valor</span></div><div class="d3m-e-rola">${linhas.map((x) => { const classe = x.classes?.[0] || "", abre = classe && !classe.startsWith("roupa:") && x.tipo !== "kit";
      return `<${abre ? `button type="button" onclick="abrirPreviaMovelEscritorio('${safeText(classe)}')"` : "div"} class="d3m-r-lj-tl"><span><b>${TIPOS[x.tipo] || "Movimento"}</b> · ${safeText(nomeDo(x))}</span><span>${safeText(onde(x))}</span><span>${quando(x.em)}</span><em class="${x.valor > 0 ? "g" : x.valor < 0 ? "r" : ""}">${x.valor > 0 ? "+" : x.valor < 0 ? "−" : ""}${v2lNum(Math.abs(x.valor))}</em></${abre ? "button" : "div"}>`; }).join("")}</div>`
      : `<p class="d3m-r-lj-nada">${h.length ? "Nada neste filtro." : "Nenhuma compra ainda."}</p>`}</section>`;
  return `<div class="d3m-r-lj-ct">${nums}<div class="d3m-r-lj-meio">${barras}${vieram}</div>${hist}</div>`;
}
// A consulta da Carteira e do Inventário (prancha V2-R): o que paga moedas, os preços e os atalhos; no Inventário, a
// troca que espera você, o saldo e os atalhos do guarda-roupa e da troca.
function escritorioLojaLadoV2Html(aba) {
  const eco = escritorio.base?.economia, marcos = escritorioMarcosDaLoja();
  const ir = (chave, rotulo, apoio) => `<button type="button" class="d3m-vlin" onclick="escritorio.cat.aba='${chave}';escritorio.cat.ver=60;${chave === "inventario" ? "carregarTrocasEscritorio();" : ""}redesenharCatalogoJanelaEscritorio()"><span><b>${rotulo}</b> <span class="d3m-f-ap">· ${apoio}</span></span>${V2R_SETA}</button>`;
  if (aba === "carteira") {
    const r = marcos ? escritorioConquistasResumo(marcos) : null;
    const prox = (r?.andamento || []).slice(0, 4).map((x) => { const dp = x.degraus.find((d) => d.nivel === x.proximo.nivel); return `<p class="d3m-vlin d3m-r-lj-paga"><span><b>${safeText(x.nome)}</b> <span class="d3m-f-ap">· faltam ${v2lNum(x.proximo.meta - x.valor)}</span></span><b class="d3m-vn">${dp ? `+${v2lNum(dp.moedas)}` : ""}</b></p>`; }).join("");
    const raridades = (eco?.loja?.raridades || []).map((x) => `<span><span>${safeText(x.nome)}</span><b>${v2lNum(x.preco)}</b></span>`).join("");
    const meuId = escritorio.base?.eu;
    return `<section class="d3m-cons" aria-label="Como ganhar mais"><div class="d3m-cons-cab"><b>Como ganhar mais</b><span>os próximos troféus</span></div>${prox || '<p class="d3m-vvazio">Entregas, missões do dia e troféus pagam moedas.</p>'}</section>
      <section class="d3m-cons" aria-label="Preços e raridades"><div class="d3m-cons-cab"><b>Preços e raridades</b><span>moedas</span></div><div class="d3m-r-lj-precos"><span><span>Essenciais</span><b>grátis</b></span>${raridades || "<span><span>Extras</span><b>25</b></span>"}</div>${eco?.loja ? '<p class="d3m-f-ganhar">Muito raros e lendários só na vitrine semanal; o estoque é da equipe.</p>' : ""}</section>
      <section class="d3m-cons" aria-label="Abrir"><div class="d3m-cons-cab"><b>Abrir</b><span></span></div>${ir("loja", "Loja", "gastar o saldo")}${ir("inventario", "Inventário", "o que já é seu")}${meuId != null ? `<button type="button" class="d3m-vlin" onclick="abrirFichaEscritorio(escritorio.base.eu)"><span><b>Meu perfil</b> <span class="d3m-f-ap">· nível e pontos</span></span>${V2R_SETA}</button>` : ""}</section>`;
  }
  const nomeDe = (id) => String((escritorio.base?.equipe || []).find((x) => String(x.id) === String(id))?.nome || "Alguém").split(" ")[0];
  const aberta = (escritorio.trocas?.recebidas || []).find((x) => x.estado === "aberta");
  const nomeItem = (l) => { const it = (l || [])[0]; const classe = Array.isArray(it) ? it[0] : typeof it === "string" ? it : it?.classe; return classe ? escritorioNomeDaClasse(classe) : "um móvel"; };
  const lar = aberta ? `<section class="d3m-laranja d3m-f-lar" aria-label="Proposta de troca"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">${safeText(nomeDe(aberta.de_pessoa).slice(0, 1))}</span>${safeText(nomeDe(aberta.de_pessoa))} · proposta de troca</span>
    <div class="d3m-lar-txt"><span class="d3-acao-frase">Quer ${safeText(nomeItem(aberta.pede))} pelo ${safeText(nomeItem(aberta.oferece))}</span><small class="d3m-f-lar-ap">Nada sai do seu quarto sem o seu sim.</small>
    <div class="d3m-lar-bts"><button type="button" class="d3m-btn l" onclick="escritorio.cat.inv='trocas';redesenharCatalogoJanelaEscritorio()">Ver a troca</button><button type="button" class="d3m-btn l s" onclick="responderTrocaEscritorio('${safeText(aberta.id)}','recusar',this)">Recusar</button></div></div></section>` : "";
  const saldo = `<section class="d3m-cons" aria-label="Seu saldo"><div class="d3m-cons-cab"><b>Seu saldo</b><span>VybeCoins</span></div><p class="d3m-vlin d3m-r-lj-paga"><span><b>${eco ? v2lNum(eco.saldo) : "…"}</b> <span class="d3m-f-ap">· piso, parede e bloco são grátis</span></span></p></section>`;
  const roupas = (eco?.inventario || []).filter((i) => String(i.classe).startsWith("roupa:") && Number(i.quantidade) > 0).length;
  return `${lar}${saldo}<section class="d3m-cons" aria-label="Abrir"><div class="d3m-cons-cab"><b>Abrir</b><span></span></div>
    <button type="button" class="d3m-vlin" onclick="document.getElementById('office-catalogo')?.close();criador.armario='guarda';abrirAberturaEscritorio('personagem')"><span><b>Guarda-roupa</b> <span class="d3m-f-ap">· ${roupas === 1 ? "1 roupa" : `${roupas} roupas`}</span></span>${V2R_SETA}</button>
    <button type="button" class="d3m-vlin" onclick="abrirTrocaEscritorio()"><span><b>Propor troca</b> <span class="d3m-f-ap">· com alguém da equipe</span></span>${V2R_SETA}</button>${ir("loja", "Loja", "comprar mais")}</section>`;
}
