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

function missaoPrazoHtml(m) {
  if (!m.prazo) return '<em class="ofc-missao-prazo">Sem data</em>';
  const dm = `${m.prazo.slice(8, 10)}/${m.prazo.slice(5, 7)}`;
  if (m.atrasada) return `<em class="ofc-missao-prazo atrasada">Atrasada · ${dm}</em>`;
  if (m.hoje) return '<em class="ofc-missao-prazo hoje">Hoje</em>';
  return `<em class="ofc-missao-prazo">${dm}</em>`;
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
          onclick="abrirMissaoEscritorio('${safeText(m.ref)}','${m.quadro}')">
          <span class="ofc-missao-linha">${missaoPrazoHtml(m)}<span class="ofc-missao-valor">${missaoValorHtml(m.recompensa)}</span></span>
          <b class="ofc-missao-titulo">${safeText(m.titulo)}</b>
          <small class="ofc-missao-cliente">${safeText(m.cliente || "Sem cliente")}${m.formato ? ` · ${safeText(m.formato)}` : ""}</small>
          <span class="ofc-missao-linha ofc-missao-estado">${m.status ? `<span class="ofc-missao-status">${safeText(m.status)}</span>` : ""}${m.grupo ? `<span class="ofc-missao-grupo">${safeText(m.grupo)}</span>` : ""}</span>
        </button></li>`).join("")}</ol>` : `<p class="ofc-nota">Nada em "${MISSOES_FILTROS.find(([k]) => k === filtro)[1]}".</p>`}
      ${filtradas.length > MISSOES_VISIVEIS ? `<button type="button" class="ofc-mini" onclick="verTodasMissoesEscritorio()">${escritorio.missoesTodas ? "Mostrar menos" : `Ver todas (${filtradas.length})`}</button>` : ""}`
      : '<p class="ofc-nota">Nenhuma tarefa aberta com você. Quando uma demanda chegar, ela aparece aqui com o que vale.</p>'}
    </div>` : ""}`;
}

// Abre a demanda no mesmo painel lateral de sempre (Solicitações ou Produção).
function abrirMissaoEscritorio(ref, quadro) {
  const abrir = quadro === "demandas" ? window.openDemandaWorkspace : window.openItemWorkspace;
  if (typeof abrir === "function") abrir(String(ref));
}

// ── Clientes cobrando no quarto (brincadeira do Paulo, 19/10/2026) ───────────
// Quem entra num quarto vê os clientes das demandas que pedem ação do dono:
// atrasadas, do dia depois do meio-dia, vencendo sem começar, para agendar.
// Quando a demanda espera o próprio cliente, ele vai ao quarto do head pedir
// para ser lembrado. Resolvida, o cliente agradece e vai embora.
const COBRANCA_TOM = { atrasada: "cobra", hoje: "cobra", vence: "avisa", agendar: "cobra", lembrar_cliente: "lembra" };
function falasDaCobranca(c, dono) {
  const t = `"${c.titulo.length > 38 ? c.titulo.slice(0, 36) + "…" : c.titulo}"`, d = c.dias;
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
async function carregarCobrancasEscritorio() {
  const mapa = escritorio.mapa, quarto = escritorio.quarto, dono = escritorioDonoDoQuarto();
  if (!mapa?.definirVisitantes) return;
  if (!dono) { mapa.definirVisitantes([]); escritorio.cobrancasAntes = null; return; }
  let lista;
  try { lista = (await escritorioApi("cobrancas", null, { pessoa: dono })).cobrancas || []; } catch { return; }
  if (mapa !== escritorio.mapa || quarto !== escritorio.quarto) return;
  const pessoa = (escritorio.base?.equipe || []).find((p) => String(p.id) === dono);
  const nomeDono = String(pessoa?.nome || "").split(" ")[0] || "pessoal";
  // Resolvidas desde a última olhada neste quarto: o cliente agradece e vai embora.
  const agora = new Set(lista.map((c) => c.ref + "|" + c.cliente_id));
  const antes = escritorio.cobrancasAntes?.quarto === quarto ? escritorio.cobrancasAntes.itens : [];
  const resolvidas = antes.filter((c) => !agora.has(c.ref + "|" + c.cliente_id) && c.tipo !== "lembrar_cliente");
  escritorio.cobrancasAntes = { quarto, itens: lista };
  const visitante = (c, i, falas, tom) => ({ nome: c.cliente, figura: typeof escritorioFiguraDoAgente === "function" ? escritorioFiguraDoAgente(c, i) : undefined,
    falas, tom, dica: `${c.cliente} · ${c.titulo}${c.status ? ` · ${c.status}` : ""}`, aoClicar: () => abrirMissaoEscritorio(c.ref, c.quadro) });
  // Quem agradece fala primeiro (o rodízio começa por ele).
  mapa.definirVisitantes([...resolvidas.map((c, i) => visitante(c, lista.length + i, [`Valeu, ${nomeDono}! Ficou ótimo.`], "agradece")),
    ...lista.map((c, i) => visitante(c, i, falasDaCobranca(c, nomeDono), COBRANCA_TOM[c.tipo] || "cobra"))]);
  if (resolvidas.length) setTimeout(() => { if (mapa === escritorio.mapa && quarto === escritorio.quarto) mapa.definirVisitantes(lista.map((c, i) => visitante(c, i, falasDaCobranca(c, nomeDono), COBRANCA_TOM[c.tipo] || "cobra"))); }, 8000);
}
let RELOGIO_COBRANCAS = 0;
function vigiarCobrancasEscritorio() {
  carregarCobrancasEscritorio();
  clearInterval(RELOGIO_COBRANCAS);
  RELOGIO_COBRANCAS = setInterval(() => { if (!document.hidden && escritorio.mapa) carregarCobrancasEscritorio(); }, 2 * 60 * 1000);
}
