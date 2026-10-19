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
function verTodasMissoesEscritorio() {
  escritorio.missoesTodas = !escritorio.missoesTodas;
  pintarMissoesEscritorio();
}

function missaoPrazoHtml(m) {
  if (!m.prazo) return '<em class="ofc-missao-prazo">Sem data</em>';
  if (m.atrasada) return '<em class="ofc-missao-prazo atrasada">Atrasada</em>';
  if (m.hoje) return '<em class="ofc-missao-prazo hoje">Hoje</em>';
  return `<em class="ofc-missao-prazo">${m.prazo.slice(8, 10)}/${m.prazo.slice(5, 7)}</em>`;
}
function missaoValorHtml(v) {
  if (!v || (!v.pontos && !v.moedas)) return "";
  return `${v.pontos ? `<span class="ofc-missao-xp">+${v.pontos} XP</span>` : ""}${v.moedas ? `<span class="ofc-missao-moeda">+${v.moedas}</span>` : ""}`;
}
function missaoDicaTexto(m) {
  const partes = [m.titulo, m.cliente && `Cliente: ${m.cliente}`, m.formato && `Formato: ${m.formato}${m.peso && m.peso !== 1 ? ` (peso ${String(m.peso).replace(".", ",")})` : ""}`,
    m.status && `Status: ${m.status}`, m.recompensa && `Vale ${m.recompensa.pontos} XP e ${m.recompensa.moedas} moedas`,
    m.bonus && `${m.bonus.descricao}: +${m.bonus.pontos} XP e +${m.bonus.moedas} moedas`];
  return partes.filter(Boolean).join("\n");
}

function pintarMissoesEscritorio() {
  const el = document.getElementById("office-missoes");
  if (!el) return;
  const estado = escritorio.missoes;
  if (!estado || estado.indisponivel) { el.hidden = true; return; }
  el.hidden = false;
  const lista = estado.missoes || [];
  const atrasadas = lista.filter((m) => m.atrasada).length;
  const aberto = escritorioMissoesAbertas();
  const mostradas = escritorio.missoesTodas ? lista : lista.slice(0, MISSOES_VISIVEIS);
  const total = lista.reduce((t, m) => ({ pontos: t.pontos + (m.recompensa?.pontos || 0), moedas: t.moedas + (m.recompensa?.moedas || 0) }), { pontos: 0, moedas: 0 });
  el.innerHTML = `<button type="button" class="ofc-missoes-topo" aria-expanded="${aberto}" onclick="alternarMissoesEscritorio()">
      <b>Missões</b><small>${lista.length ? `${lista.length} aberta${lista.length > 1 ? "s" : ""}${atrasadas ? ` · ${atrasadas} atrasada${atrasadas > 1 ? "s" : ""}` : ""}` : "nenhuma aberta"}</small>
      <i class="ofc-missoes-seta" aria-hidden="true"></i></button>
    ${aberto ? `<div class="ofc-missoes-corpo">
      ${estado.erro ? `<p class="ofc-nota">Não foi possível atualizar: ${safeText(estado.erro)}</p>` : ""}
      ${lista.length ? `<p class="ofc-missoes-total">Tudo vale <span class="ofc-missao-xp">+${total.pontos} XP</span> <span class="ofc-missao-moeda">+${total.moedas}</span></p>
      <ol class="ofc-missoes-lista">${mostradas.map((m) => `<li><button type="button" class="ofc-missao${m.atrasada ? " atrasada" : ""}" title="${safeText(missaoDicaTexto(m))}"
          onclick="abrirMissaoEscritorio('${safeText(m.ref)}','${m.quadro}')">
          <span class="ofc-missao-linha">${missaoPrazoHtml(m)}<b>${safeText(m.titulo)}</b></span>
          <span class="ofc-missao-linha"><small>${safeText(m.cliente || "Sem cliente")}${m.formato ? ` · ${safeText(m.formato)}` : ""}</small><span class="ofc-missao-valor">${missaoValorHtml(m.recompensa)}</span></span>
        </button></li>`).join("")}</ol>
      ${lista.length > MISSOES_VISIVEIS ? `<button type="button" class="ofc-mini" onclick="verTodasMissoesEscritorio()">${escritorio.missoesTodas ? "Mostrar menos" : `Ver todas (${lista.length})`}</button>` : ""}`
      : '<p class="ofc-nota">Nenhuma tarefa aberta com você. Quando uma demanda chegar, ela aparece aqui com o que vale.</p>'}
    </div>` : ""}`;
}

// Abre a demanda no mesmo painel lateral de sempre (Solicitações ou Produção).
function abrirMissaoEscritorio(ref, quadro) {
  const abrir = quadro === "demandas" ? window.openDemandaWorkspace : window.openItemWorkspace;
  if (typeof abrir === "function") abrir(String(ref));
}
