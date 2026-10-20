// vybe-escritorio-missoes.js — missões do jogador (pedido do Paulo, 19/10/2026).
//
// As tarefas abertas de cada pessoa ("Minhas tarefas") viram missões na tela do
// Escritório, com o que cada uma vale em XP e moedas pela regra da função da
// pessoa e pelo peso do formato (um cardápio impresso vale mais que um card).
// O servidor monta a lista (rota escritorio/missoes) a partir do nosso banco; o
// valor mostrado é a mesma conta que o banco faz quando o evento acontece.

const MISSOES_VISIVEIS = 5;
async function carregarMissoesEscritorio(forcar) {
  if (!escritorio.base || escritorio.base.demo && !forcar && escritorio.missoes) return;
  if (!forcar && escritorio.missoesEm && Date.now() - escritorio.missoesEm < 60_000) return pintarMissoesEscritorio();
  escritorio.missoesEm = Date.now();
  try {
    const d = await escritorioApi("missoes");
    escritorio.missoes = d.disponivel === false ? { indisponivel: true, missoes: [] } : { missoes: d.missoes || [], funcao: d.funcao };
  } catch (e) {
    escritorio.missoes = { erro: e.message, missoes: escritorio.missoes?.missoes || [] };
  }
  pintarMissoesEscritorio();
}

// No celular começa recolhido (o cartão aberto cobriria o mapa); a escolha
// de cada pessoa fica guardada no navegador dela.
function escritorioMissoesAbertas() {
  let salvo = null;
  try { salvo = localStorage.getItem("vybe-escritorio-missoes"); } catch {}
  if (salvo) return salvo === "aberto";
  return !window.matchMedia?.("(max-width: 760px)").matches;
}
function alternarMissoesEscritorio() {
  const aberto = !escritorioMissoesAbertas();
  try { localStorage.setItem("vybe-escritorio-missoes", aberto ? "aberto" : "fechado"); } catch {}
  pintarMissoesEscritorio();
}
// Filtro do cartão: atrasadas, hoje, próximas ou todas (guardado no navegador).
const MISSOES_FILTROS = [["atrasadas", "Atrasadas", (m) => m.atrasada], ["hoje", "Hoje", (m) => m.hoje], ["proximas", "Próximas", (m) => !m.atrasada && !m.hoje], ["todas", "Todas", () => true]];
function filtroMissoesEscritorio(lista) {
  let salvo = escritorio.missoesFiltro;
  if (!salvo) { try { salvo = localStorage.getItem("vybe-escritorio-missoes-filtro"); } catch {} }
  const valido = MISSOES_FILTROS.find(([k]) => k === salvo);
  if (valido) return valido[0];
  return lista.some((m) => m.atrasada) ? "atrasadas" : lista.some((m) => m.hoje) ? "hoje" : "todas";
}
function filtrarMissoesEscritorio(chave) {
  escritorio.missoesFiltro = chave;
  escritorio.missoesTodas = false;
  try { localStorage.setItem("vybe-escritorio-missoes-filtro", chave); } catch {}
  pintarMissoesEscritorio();
}
function verTodasMissoesEscritorio() {
  escritorio.missoesTodas = !escritorio.missoesTodas;
  pintarMissoesEscritorio();
}

// Toda data de demanda diz se é prazo ou veiculação (Paulo, 19/10/2026).
function missaoPrazoHtml(m) {
  if (!m.prazo) return '<em class="ofc-missao-prazo">Sem prazo nem veiculação</em>';
  const tipo = m.tipo_data === "veiculacao" ? "Veiculação" : "Prazo";
  const dm = `${m.prazo.slice(8, 10)}/${m.prazo.slice(5, 7)}`;
  if (m.atrasada) return `<em class="ofc-missao-prazo atrasada">${m.tipo_data === "veiculacao" ? "Veiculação vencida" : "Prazo vencido"} · ${dm}</em>`;
  if (m.hoje) return `<em class="ofc-missao-prazo hoje">${tipo} hoje</em>`;
  return `<em class="ofc-missao-prazo">${tipo} ${dm}</em>`;
}
function missaoValorHtml(v) {
  if (!v || (!v.pontos && !v.moedas)) return "";
  return `${v.pontos ? `<span class="ofc-missao-xp">+${v.pontos} XP</span>` : ""}${v.moedas ? `<span class="ofc-missao-moeda">+${v.moedas}</span>` : ""}`;
}
function missaoDicaTexto(m) {
  const partes = [m.titulo, m.cliente && `Cliente: ${m.cliente}`, m.status && `Status: ${m.status}`, m.grupo && `Grupo: ${m.grupo}`,
    m.formato && `Formato: ${m.formato}${m.peso && m.peso !== 1 ? ` (peso ${String(m.peso).replace(".", ",")})` : ""}`,
    m.recompensa && (m.recompensa.pontos || m.recompensa.moedas) && `Vale ${m.recompensa.pontos} XP e ${m.recompensa.moedas} moedas`,
    m.bonus && `${m.bonus.descricao}: +${m.bonus.pontos} XP e +${m.bonus.moedas} moedas`, "Clique para abrir a demanda"];
  return partes.filter(Boolean).join("\n");
}

function pintarMissoesEscritorio() {
  const el = document.getElementById("office-missoes");
  if (!el) return;
  const estado = escritorio.missoes;
  if (!estado || estado.indisponivel) { el.hidden = true; return; }
  el.hidden = false;
  const lista = estado.missoes || [];
  const conta = Object.fromEntries(MISSOES_FILTROS.map(([k, , f]) => [k, lista.filter(f).length]));
  const aberto = escritorioMissoesAbertas();
  const filtro = filtroMissoesEscritorio(lista);
  const filtradas = lista.filter(MISSOES_FILTROS.find(([k]) => k === filtro)[2]);
  const mostradas = escritorio.missoesTodas ? filtradas : filtradas.slice(0, MISSOES_VISIVEIS);
  const total = lista.reduce((t, m) => ({ pontos: t.pontos + (m.recompensa?.pontos || 0), moedas: t.moedas + (m.recompensa?.moedas || 0) }), { pontos: 0, moedas: 0 });
  const resumo = lista.length ? [conta.atrasadas && `${conta.atrasadas} atrasada${conta.atrasadas > 1 ? "s" : ""}`, conta.hoje && `${conta.hoje} hoje`, `${lista.length} no total`].filter(Boolean).join(" · ") : "nenhuma aberta";
  el.innerHTML = `<button type="button" class="ofc-missoes-topo" aria-expanded="${aberto}" onclick="alternarMissoesEscritorio()">
      <b>Missões</b><small>${resumo}</small><i class="ofc-missoes-seta" aria-hidden="true"></i></button>
    ${aberto ? `<div class="ofc-missoes-corpo">
      ${estado.erro ? `<p class="ofc-nota">Não foi possível atualizar: ${safeText(estado.erro)}</p>` : ""}
      ${lista.length ? `${total.pontos || total.moedas ? `<p class="ofc-missoes-total">Concluir tudo vale ${missaoValorHtml(total)}</p>` : ""}
      <div class="ofc-missoes-filtros" role="tablist" aria-label="Filtrar missões">${MISSOES_FILTROS.map(([k, rot]) => `<button type="button" role="tab" aria-selected="${k === filtro}" class="${k === filtro ? "ativo" : ""}${k === "atrasadas" && conta[k] ? " alerta" : ""}" onclick="filtrarMissoesEscritorio('${k}')">${rot}<span>${conta[k]}</span></button>`).join("")}</div>
      ${filtradas.length ? `<ol class="ofc-missoes-lista">${mostradas.map((m) => `<li><button type="button" class="ofc-missao${m.atrasada ? " atrasada" : m.hoje ? " hoje" : ""}" title="${safeText(missaoDicaTexto(m))}"
          onclick="abrirMissaoEscritorio('${safeText(m.ref)}','${m.quadro}',event)">
          <span class="ofc-missao-linha">${missaoPrazoHtml(m)}<span class="ofc-missao-valor">${missaoValorHtml(m.recompensa)}</span></span>
          <b class="ofc-missao-titulo">${safeText(m.titulo)}</b>
          ${missaoEtiquetasHtml(m)}
        </button></li>`).join("")}</ol>` : `<p class="ofc-nota">Nada em "${MISSOES_FILTROS.find(([k]) => k === filtro)[1]}".</p>`}
      ${filtradas.length > MISSOES_VISIVEIS ? `<button type="button" class="ofc-mini" onclick="verTodasMissoesEscritorio()">${escritorio.missoesTodas ? "Mostrar menos" : `Ver todas (${filtradas.length})`}</button>` : ""}`
      : '<p class="ofc-nota">Nenhuma tarefa aberta com você. Quando uma demanda chegar, ela aparece aqui com o que vale.</p>'}
    </div>` : ""}`;
}

// Abre a demanda no mesmo painel lateral de sempre (Solicitações ou Produção).
// Abrir uma demanda no jogo é o cartão rápido do painel (Paulo, 20/10/2026:
// "não era pra mudar a data? arquivar? alterar algo?"): status, datas,
// responsável, prioridade, renomear e o menu "…" (arquivar), com "Abrir
// detalhes" para a gaveta. O mesmo cartão das linhas do quadro
// (abrirCartaoRapido), ancorado onde se clicou. Sem o clique ou sem a peça
// carregada no painel, abre a gaveta como antes.
function abrirMissaoEscritorio(ref, quadro, ev) {
  const id = String(ref), pedido = quadro === "demandas";
  const carregada = pedido ? (typeof DADOS_DEMANDAS !== "undefined" ? DADOS_DEMANDAS : []).some((d) => String(d.id) === id) : typeof findOperationalItem === "function" && Boolean(findOperationalItem(id));
  const alvo = ev?.currentTarget || ev?.target;
  if (typeof abrirCartaoRapido === "function" && carregada && alvo?.getBoundingClientRect) {
    const r = alvo.getBoundingClientRect();
    return abrirCartaoRapido(id, { currentTarget: { getBoundingClientRect: () => r } }, pedido ? "request" : "content");
  }
  const abrir = pedido ? window.openDemandaWorkspace : window.openItemWorkspace;
  if (typeof abrir === "function") abrir(id);
}

// ── Clientes cobrando no quarto (brincadeira do Paulo, 19/10/2026) ───────────
// Quem entra num quarto vê os clientes das demandas que pedem ação do dono:
// atrasadas, do dia depois do meio-dia, vencendo sem começar, para agendar.
// Quando a demanda espera o próprio cliente, ele vai ao quarto do head pedir
// para ser lembrado. Resolvida, o cliente agradece e vai embora.
const COBRANCA_TOM = { atrasada: "cobra", hoje: "cobra", vence: "avisa", agendar: "cobra", lembrar_cliente: "lembra", marcar_gravacao: "lembra" };
// Esperando aprovação do cliente (e não material): muda a fala e o rótulo.
const cobrancaEsperaAprovacao = (c) => c.status_chave === "ag_aprovacao_cliente" || /aprova/i.test(c.status || "");
function falasDaCobranca(c, dono) {
  const t = `"${c.titulo.length > 38 ? c.titulo.slice(0, 36) + "…" : c.titulo}"`, d = c.dias;
  // "Aguardo" é esperar marcar a gravação com o cliente (Paulo, 20/10/2026).
  if (c.tipo === "marcar_gravacao") return [`Bora marcar a gravação do ${t}?`, `${dono}, ainda falta marcar a gravação do ${t}!`];
  if (c.tipo === "lembrar_cliente" && cobrancaEsperaAprovacao(c)) return [`Ainda não aprovei o ${t}. Me lembra?`, `${dono}, me cobra a aprovação do ${t}!`];
  if (c.tipo === "lembrar_cliente") return [`Tô devendo coisa do ${t}. Me cobra!`, `Me lembra de mandar o que falta do ${t}?`];
  if (c.tipo === "agendar") return d > 0 ? [`O ${t} já devia estar no ar!`, `Ninguém postou o ${t}? Faz ${d} dia${d > 1 ? "s" : ""}!`] : [`Hoje é dia do ${t} ir ao ar!`, `${dono}, não esquece de agendar o ${t}!`];
  if (c.tipo === "vence") return [`Amanhã vence o ${t}. Já dá pra começar?`, `${dono}, o ${t} é pra amanhã, hein!`];
  if (c.tipo === "hoje") return [`${dono}, o ${t} é pra hoje!`, `Já passou do meio-dia e o ${t} não saiu…`];
  const aprovar = /aprova/i.test(c.status);
  if (d >= 4) return [`${d} DIAS, ${dono}! Cadê o ${t}?!`, aprovar ? `Aprova logo o ${t}, por favor!` : `Vou chamar o Paulo! ${t} atrasado!`, `Protesto! ${t} parado há ${d} dias!`];
  if (d >= 2) return [`Já são ${d} dias esperando o ${t}!`, aprovar ? `${dono}, aprova o ${t} pra mim?` : `${dono}, meu ${t} ainda não saiu?`];
  return [aprovar ? `${dono}, falta aprovar o ${t}…` : `${dono}, o ${t} era pra ontem…`, `Ei, cadê o ${t}?`];
}
function escritorioDonoDoQuarto() {
  const q = escritorio.quarto;
  if (!q || !/^sala-/.test(q)) return null;
  const raiz = typeof escritorioRaizQuarto === "function" ? escritorioRaizQuarto(q) : q.replace(/-andar-1$/, "");
  const sala = (escritorio.base?.salas || []).find((s) => s.id === raiz);
  return sala?.pessoa_id ? String(sala.pessoa_id) : null;
}
// Gravidade para ordenar e dar o tom do cliente (o pior pedido manda).
const COBRANCA_PESO = { atrasada: 4, agendar: 3, hoje: 2, vence: 1, lembrar_cliente: 0, marcar_gravacao: 0 };
// Lembretes (o cliente pedindo para ser lembrado) não são cobrança ao time.
const COBRANCA_LEMBRETE = new Set(["lembrar_cliente", "marcar_gravacao"]);
// Um cliente por boneco (com quantas demandas ele cobra no nome) e o quadro
// "Cobrando neste quarto" na coluna, com cada demanda clicável: com um boneco
// por demanda, os nomes se empilhavam e não dava para ver quem cobrava o quê.
function agruparCobrancas(lista) {
  const por = new Map();
  for (const c of lista) {
    if (!por.has(c.cliente_id)) por.set(c.cliente_id, { cliente_id: c.cliente_id, cliente: c.cliente, segmento: c.segmento, itens: [] });
    por.get(c.cliente_id).itens.push(c);
  }
  const grupos = [...por.values()];
  for (const g of grupos) {
    g.itens.sort((x, y) => COBRANCA_PESO[y.tipo] - COBRANCA_PESO[x.tipo] || y.dias - x.dias);
    g.pior = g.itens[0];
    g.cobra = g.itens.filter((c) => !COBRANCA_LEMBRETE.has(c.tipo)).length;
  }
  return grupos.sort((x, y) => COBRANCA_PESO[y.pior.tipo] - COBRANCA_PESO[x.pior.tipo] || y.itens.length - x.itens.length);
}
// Sempre diz de qual data se trata: prazo (entrega) ou veiculação (postagem).
function cobrancaRotulo(c) {
  const dm = c.data ? ` (${c.data.slice(8, 10)}/${c.data.slice(5, 7)})` : "";
  if (c.tipo === "atrasada") return `Prazo vencido há ${c.dias} dia${c.dias > 1 ? "s" : ""}${dm}`;
  if (c.tipo === "hoje") return "Prazo é hoje";
  if (c.tipo === "vence") return `Prazo amanhã${dm}`;
  if (c.tipo === "agendar") return c.dias > 0 ? `Veiculação atrasada há ${c.dias} dia${c.dias > 1 ? "s" : ""}${dm}` : "Veiculação é hoje";
  if (c.tipo === "marcar_gravacao") return `Marcar a gravação · prazo${dm || " sem data"}`;
  if (cobrancaEsperaAprovacao(c)) return `Esperando aprovação do cliente · prazo${dm || " sem data"}`;
  return `Esperando o cliente · prazo${dm || " sem data"}`;
}
// Uma demanda cobrada, no padrão do painel: título, a data (sempre dizendo se
// é prazo ou veiculação) e a pílula do status com a cor do quadro. A mesma
// linha serve ao quadro da coluna e ao cartão que abre no boneco.
function cobrancaItemHtml(c, aoAbrir = "") {
  const item = typeof findOperationalItem === "function" ? findOperationalItem(c.ref) : null;
  const status = item?.status || c.status;
  const pilula = status && typeof pillHtmlDemanda === "function" ? pillHtmlDemanda(status, item?.status_color || "", item?.status_border || "") : status ? `<small>${safeText(status)}</small>` : "";
  const tom = c.tipo === "atrasada" ? "atrasada" : c.tipo === "hoje" || c.tipo === "agendar" ? "hoje" : "";
  return `<li><button type="button" class="ofc-cobranca" onclick="abrirMissaoEscritorio('${safeText(c.ref)}','${c.quadro}',event);${aoAbrir}" title="Abrir a demanda">
  <span class="ofc-cobranca-titulo">${safeText(c.titulo)}</span><span class="ofc-cobranca-linha"><em class="ofc-missao-prazo ${tom}">${safeText(cobrancaRotulo(c))}</em>${pilula}</span></button></li>`;
}
// Cabeçalho do cliente: a etiqueta da carteira (cor do painel), quantas
// demandas e a barra no tom do pior pedido.
function cobrancaClienteHtml(g) {
  const tag = typeof tagClienteHtml === "function" ? tagClienteHtml(g.cliente, { dentroDeBotao: true }) : `<b>${safeText(g.cliente)}</b>`;
  return `<span class="ofc-cobranca-cliente ${COBRANCA_TOM[g.pior.tipo] || "cobra"}">${tag}<small>${g.itens.length}</small></span>`;
}
function pintarCobrancasEscritorio(grupos, dono) {
  const el = document.getElementById("office-cobrancas");
  if (!el) return;
  if (!grupos.length) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const total = grupos.reduce((t, g) => t + g.itens.length, 0);
  let aberto = true;
  try { aberto = localStorage.getItem("vybe-escritorio-cobrancas") !== "fechado"; } catch {}
  el.innerHTML = `<button type="button" class="ofc-missoes-topo" aria-expanded="${aberto}" onclick="alternarCobrancasEscritorio()">
      <b>Cobrando neste quarto</b><small>${grupos.length} cliente${grupos.length > 1 ? "s" : ""} · ${total} demanda${total > 1 ? "s" : ""}</small><i class="ofc-missoes-seta" aria-hidden="true"></i></button>
    ${aberto ? `<ul class="ofc-cobrancas-lista">${grupos.map((g) => `<li>${cobrancaClienteHtml(g)}<ul>${g.itens.map((c) => cobrancaItemHtml(c)).join("")}</ul></li>`).join("")}</ul>` : ""}`;
}
// Clique no cliente que está cobrando (Paulo, 19/10/2026): primeiro o cartão
// com o que ele cobra, perto do boneco; cada demanda abre inteira na gaveta.
function abrirCobrancaClienteEscritorio(g, e) {
  const raiz = document.querySelector("#painel-escritorio .ofc-principal");
  if (!raiz) return abrirMissaoEscritorio(g.pior.ref, g.pior.quadro);
  let pop = document.getElementById("office-cobranca-pop");
  if (!pop) {
    pop = document.createElement("div");
    pop.id = "office-cobranca-pop";
    pop.className = "ofc-cobranca-pop";
    pop.setAttribute("role", "dialog");
    raiz.append(pop);
    document.addEventListener("pointerdown", (ev) => { if (!pop.hidden && !pop.contains(ev.target)) pop.hidden = true; });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !pop.hidden) pop.hidden = true; });
  }
  pop.setAttribute("aria-label", `${g.cliente}: ${g.itens.length} demanda${g.itens.length > 1 ? "s" : ""}`);
  pop.innerHTML = `<div class="ofc-cobranca-pop-topo">${cobrancaClienteHtml(g)}<button type="button" class="ofc-x" onclick="this.closest('.ofc-cobranca-pop').hidden=true" aria-label="Fechar">×</button></div>
<ul>${g.itens.map((c) => cobrancaItemHtml(c, "this.closest('.ofc-cobranca-pop').hidden=true;")).join("")}</ul>
<p class="ofc-nota">Clique numa demanda para abrir inteira.</p>`;
  pop.hidden = false;
  // Perto do clique, sem sair da área do mapa.
  const r = raiz.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const x = (e?.clientX ?? r.left + r.width / 2) - r.left, y = (e?.clientY ?? r.top + r.height / 2) - r.top;
  pop.style.left = Math.max(8, Math.min(r.width - w - 8, x + 14)) + "px";
  pop.style.top = Math.max(60, Math.min(r.height - h - 8, y - 20)) + "px";
  pop.querySelector(".ofc-cobranca")?.focus();
}
// Cliente, status e grupo com o padrão de cor do painel (Paulo, 19/10/2026:
// "cadê o padrão de cor do status, do grupo e do cliente?"): a etiqueta do
// cliente é a da carteira (tagClienteHtml), o status é a pílula do quadro com a
// cor do item (pillHtmlDemanda) e o grupo leva a cor que ele tem no quadro.
function missaoEtiquetasHtml(m) {
  const item = typeof findOperationalItem === "function" ? findOperationalItem(m.ref) : null;
  const clientes = item && typeof clientesDoItem === "function" ? clientesDoItem(item) : (m.cliente ? [m.cliente] : []);
  const tag = (nome) => typeof tagClienteHtml === "function" ? tagClienteHtml(nome, { dentroDeBotao: true }) : `<span>${safeText(nome)}</span>`;
  const status = item?.status || m.status;
  const pilula = status ? (typeof pillHtmlDemanda === "function" ? pillHtmlDemanda(status, item?.status_color || "", item?.status_border || "") : `<span class="ofc-missao-status">${safeText(status)}</span>`) : "";
  const grupoId = item?.group_id, grupoNome = item?.grupo || m.grupo;
  const corGrupo = (grupoId && ((typeof CORES_DOS_GRUPOS !== "undefined" && CORES_DOS_GRUPOS[grupoId]) || (typeof CORES_GRUPOS_DEMANDAS !== "undefined" && CORES_GRUPOS_DEMANDAS[grupoId])))
    || (typeof GRUPOS_DO_PAINEL !== "undefined" && GRUPOS_DO_PAINEL.lista.find((g) => g.titulo === grupoNome)?.cor) || "";
  return `<span class="ofc-missao-linha ofc-missao-clientes">${clientes.length ? clientes.map(tag).join("") : '<small class="ofc-missao-cliente">Sem cliente</small>'}${m.formato ? `<small class="ofc-missao-cliente">${safeText(m.formato)}</small>` : ""}</span>
          <span class="ofc-missao-linha ofc-missao-estado">${pilula}${grupoNome ? `<span class="ofc-missao-grupo"${corGrupo ? ` style="--grupo:${safeText(corGrupo)}"` : ""}><i aria-hidden="true"></i>${safeText(grupoNome)}</span>` : ""}</span>`;
}
function alternarCobrancasEscritorio() {
  let aberto = true;
  try { aberto = localStorage.getItem("vybe-escritorio-cobrancas") !== "fechado"; localStorage.setItem("vybe-escritorio-cobrancas", aberto ? "fechado" : "aberto"); } catch {}
  pintarCobrancasEscritorio(escritorio.cobrancasGrupos || [], null);
}
async function carregarCobrancasEscritorio() {
  const mapa = escritorio.mapa, quarto = escritorio.quarto, dono = escritorioDonoDoQuarto();
  if (!mapa?.definirVisitantes) return;
  if (!dono) { mapa.definirVisitantes([]); escritorio.cobrancasAntes = null; escritorio.cobrancasGrupos = []; pintarCobrancasEscritorio([], null); return; }
  let lista;
  try { lista = (await escritorioApi("cobrancas", null, { pessoa: dono })).cobrancas || []; } catch { return; }
  if (mapa !== escritorio.mapa || quarto !== escritorio.quarto) return;
  const pessoa = (escritorio.base?.equipe || []).find((p) => String(p.id) === dono);
  const nomeDono = String(pessoa?.nome || "").split(" ")[0] || "pessoal";
  const grupos = agruparCobrancas(lista);
  escritorio.cobrancasGrupos = grupos;
  pintarCobrancasEscritorio(grupos, nomeDono);
  // Clientes que pararam de cobrar desde a última olhada neste quarto: agradecem e vão embora.
  const agora = new Set(grupos.filter((g) => g.cobra).map((g) => g.cliente_id));
  const antes = escritorio.cobrancasAntes?.quarto === quarto ? escritorio.cobrancasAntes.grupos : [];
  const resolvidos = antes.filter((g) => g.cobra && !agora.has(g.cliente_id));
  escritorio.cobrancasAntes = { quarto, grupos };
  const visitante = (g, i, falas, tom) => ({ nome: g.itens.length > 1 ? `${g.cliente} · ${g.itens.length}` : g.cliente,
    figura: typeof escritorioFiguraDoAgente === "function" ? escritorioFiguraDoAgente(g, i) : undefined, falas, tom,
    dica: g.itens.map((c) => `${cobrancaRotulo(c)}: ${c.titulo}`).join("\n"), aoClicar: (e) => abrirCobrancaClienteEscritorio(g, e) });
  const deles = (g) => g.itens.flatMap((c) => falasDaCobranca(c, nomeDono).slice(0, 2));
  // Cor de cada fala: o status da demanda de que ela fala, como no quadro.
  const corDe = (c) => { const it = typeof findOperationalItem === "function" ? findOperationalItem(c.ref) : null; return it?.status_color || (typeof focusTaskTone === "function" && c.status ? focusTaskTone(c.status) : ""); };
  const coresDeles = (g) => g.itens.flatMap((c) => falasDaCobranca(c, nomeDono).slice(0, 2).map(() => corDe(c)));
  const ativos = grupos.map((g, i) => ({ ...visitante(g, i, deles(g), COBRANCA_TOM[g.pior.tipo] || "cobra"), cores: coresDeles(g) }));
  mapa.definirVisitantes([...resolvidos.map((g, i) => visitante(g, grupos.length + i, [`Valeu, ${nomeDono}! Ficou ótimo.`], "agradece")), ...ativos]);
  if (resolvidos.length) setTimeout(() => { if (mapa === escritorio.mapa && quarto === escritorio.quarto) mapa.definirVisitantes(ativos); }, 8000);
}
// Mudou uma demanda no painel (status, data, arquivar): o Escritório
// reconsulta missões e cobranças logo em seguida, em vez de esperar o ciclo
// de 2 minutos (Paulo, 20/10/2026: "zerei a DiaCenter e o boneco continuou
// falando das demandas"). Junta várias mudanças seguidas numa consulta só e
// dá tempo de a gravação chegar ao banco.
let ESCRITORIO_APOS_MUDANCA = 0;
function escritorioAposMudancaDeDemanda() {
  if (typeof escritorio === "undefined" || !escritorio.mapa) return;
  clearTimeout(ESCRITORIO_APOS_MUDANCA);
  ESCRITORIO_APOS_MUDANCA = setTimeout(() => {
    carregarCobrancasEscritorio();
    if (typeof carregarMissoesEscritorio === "function") carregarMissoesEscritorio(true);
  }, 2500);
}
let RELOGIO_COBRANCAS = 0;
function vigiarCobrancasEscritorio() {
  carregarCobrancasEscritorio();
  clearInterval(RELOGIO_COBRANCAS);
  RELOGIO_COBRANCAS = setInterval(() => { if (!document.hidden && escritorio.mapa && (typeof painelDeveConsultar !== "function" || painelDeveConsultar())) carregarCobrancasEscritorio(); }, 2 * 60 * 1000);
}
