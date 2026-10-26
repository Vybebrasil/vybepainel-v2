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
  const vitrine = (escritorio.base?.economia?.loja?.vitrine || []).length, desejos = escritorioDesejos().size;
  const secoes = ESCRITORIO_SECOES_LOJA.map(([t, ico]) => {
    const n = escritorioContaLoja(`secao:${t}`);
    return n ? item(`secao:${t}`, t, ico, n) : "";
  }).join("");
  return `<div class="ofc-loja-grupo">${item("*", "Destaques", "estrela", null, " forte")}${vitrine ? item("Vitrine da semana", "Vitrine da semana", "alvo", vitrine, " vitrine") : ""}${desejos ? `<button type="button" class="ofc-loja-nav" aria-pressed="${Boolean(escritorio.cat?.desejos)}" onclick="escritorio.cat.desejos=!escritorio.cat.desejos;escritorio.cat.categoria='*';escritorio.cat.ver=60;redesenharCatalogoJanelaEscritorio()">${escritorioIcone("estrela")}<span>Meus desejos</span><small>${desejos}</small></button>` : ""}${escritorioRecentes().length ? item("Recentes", "Vistos por você", "lista", escritorioRecentes().length) : ""}</div><div class="ofc-loja-grupo"><h5>Categorias</h5>${secoes}</div>`;
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
  return `<div class="ofc-loja-capa"><div class="ofc-loja-saudacao"><b>Loja da Vybelândia</b><span>Você tem <i>${saldo.toLocaleString("pt-BR")} VybeCoins</i>${baratos ? ` · ${baratos.toLocaleString("pt-BR")} peças cabem no seu saldo` : ""}. Pisos, paredes e blocos são grátis na construção.</span></div>${escritorioDestaquesLojaHtml().replace('<h4 class="ofc-loja-todos">Todos os móveis</h4>', "")}${ESCRITORIO_PRATELEIRAS_LOJA.map(prateleira).join("")}</div>`;
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
async function venderParaLojaEscritorio(classe) {
  const v = escritorioVendaDe(classe), eco = escritorio.base?.economia;
  if (!v.unidades || !eco || escritorio.vendendo) return;
  const nome = typeof escritorioNomeDaClasse === "function" ? escritorioNomeDaClasse(classe) : classe, saldo = Number(eco.saldo || 0);
  if (!confirm(`Vender 1 × ${nome} para a loja por ${v.valor.toLocaleString("pt-BR")} VybeCoins (o que você pagou)?\nSaldo: ${saldo.toLocaleString("pt-BR")} → ${(saldo + v.valor).toLocaleString("pt-BR")}.\nA peça sai do seu inventário.`)) return;
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
