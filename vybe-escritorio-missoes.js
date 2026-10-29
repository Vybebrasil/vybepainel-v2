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
  let salvo = null, cobrancas = null;
  try { salvo = localStorage.getItem("vybe-escritorio-missoes"); cobrancas = localStorage.getItem("vybe-escritorio-cobrancas"); } catch {}
  // Sanfona: com clientes cobrando à vista, as missões ficam fechadas.
  if (cobrancas !== "fechado" && (escritorio.cobrancasGrupos || []).length) return false;
  if (salvo) return salvo === "aberto";
  return !window.matchMedia?.("(max-width: 760px)").matches;
}
// Missões e cobranças funcionam como sanfona (Paulo, 20/10/2026: "tudo
// embolado quando vou abrindo"): abrir uma fecha a outra, e a aberta fica
// com a altura da coluna.
function alternarMissoesEscritorio() {
  const aberto = !escritorioMissoesAbertas();
  try { localStorage.setItem("vybe-escritorio-missoes", aberto ? "aberto" : "fechado"); if (aberto) localStorage.setItem("vybe-escritorio-cobrancas", "fechado"); } catch {}
  pintarMissoesEscritorio();
  if (aberto && (escritorio.cobrancasGrupos || []).length) pintarCobrancasEscritorio(escritorio.cobrancasGrupos, null);
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
const COBRANCA_TOM = { atrasada: "cobra", hoje: "cobra", vence: "avisa", agendar: "cobra", lembrar_cliente: "lembra", marcar_gravacao: "lembra", postar_parada: "cobra" };
// Esperando aprovação do cliente (e não material): muda a fala e o rótulo.
const cobrancaEsperaAprovacao = (c) => c.status_chave === "ag_aprovacao_cliente" || /aprova/i.test(c.status || "");
function falasDaCobranca(c, dono) {
  const t = `"${c.titulo.length > 38 ? c.titulo.slice(0, 36) + "…" : c.titulo}"`, d = c.dias;
  // Veiculação chegou e ninguém começou: o cliente pede ao head que cobre
  // quem está com a peça (Paulo, 20/10/2026).
  if (c.tipo === "postar_parada") {
    const quem = (c.com || []).map((n) => String(n).split(" ")[0]).join(" e ");
    const cobra = quem ? `Cobra ${quem.includes(" e ") ? "eles" : quem}` : "Vê quem pega";
    return d > 0 ? [`${dono}, o ${t} era pra ter saído há ${d} dia${d > 1 ? "s" : ""} e nem começou!`, `${cobra}, por favor: ${t} parado!`]
      : [`${dono}, hoje é dia de postar o ${t} e ninguém começou!`, `${cobra}! O ${t} é pra hoje!`];
  }
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
const COBRANCA_PESO = { atrasada: 4, postar_parada: 3, agendar: 3, hoje: 2, vence: 1, lembrar_cliente: 0, marcar_gravacao: 0 };
// Lembretes (o cliente pedindo para ser lembrado) não são cobrança ao time.
const COBRANCA_LEMBRETE = new Set(["lembrar_cliente", "marcar_gravacao"]);
// Um cliente por boneco (com quantas demandas ele cobra no nome) e o quadro
// "Cobrando neste quarto" na coluna, com cada demanda clicável: com um boneco
// por demanda, os nomes se empilhavam e não dava para ver quem cobrava o quê.
function agruparCobrancas(lista) {
  const por = new Map();
  for (const c of lista) {
    if (!por.has(c.cliente_id)) por.set(c.cliente_id, { cliente_id: c.cliente_id, cliente: c.cliente, segmento: c.segmento, personagem: c.personagem || null, itens: [] });
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
  if (c.tipo === "postar_parada") {
    return c.dias > 0 ? `Veiculação passou há ${c.dias} dia${c.dias > 1 ? "s" : ""}${dm} e não começou` : "Veiculação hoje e não começou";
  }
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
  return `<li class="ofc-cobranca-item"><button type="button" class="ofc-cobranca" onclick="abrirMissaoEscritorio('${safeText(c.ref)}','${c.quadro}',event);${aoAbrir}" title="Abrir a demanda">
  <span class="ofc-cobranca-titulo">${safeText(c.titulo)}</span><span class="ofc-cobranca-linha"><em class="ofc-missao-prazo ${tom}">${safeText(cobrancaRotulo(c))}</em>${pilula}</span>${cobrancaFotosHtml(c, item)}</button>
  <button type="button" class="ofc-cobranca-datas-abrir" onclick="abrirDatasCobrancaEscritorio(this)" data-ref="${safeText(c.ref)}" data-quadro="${safeText(c.quadro)}" data-prazo="${safeText(cobrancaData(c, item, "prazo"))}" data-veic="${safeText(cobrancaData(c, item, "veiculacao"))}" aria-expanded="false" title="Ver e mudar prazo e ${c.quadro === "demandas" ? "conclusão" : "veiculação"}" aria-label="Prazo e ${c.quadro === "demandas" ? "conclusão" : "veiculação"}"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/></svg></button></li>`;
}
// Prazo e veiculação (ou conclusão, nas demandas) da peça: a que veio com a
// cobrança (lida do banco agora); sem ela, a do painel.
function cobrancaData(c, item, campo) {
  if (campo === "prazo") return String(c.prazo || item?.prazo_iso || "");
  return String(c.veiculacao || (c.quadro === "demandas" ? item?.conclusao_iso || item?.veiculacao_iso : item?.veiculacao_iso) || "");
}
// Botãozinho em cada demanda dos clientes no quarto (Paulo, 29/10/2026:
// "um botãozinho em cada demanda que eu consiga clicar e vai me mostrar o
// prazo e veiculação que tá aquela demanda e deixar eu mudar por aí mesmo").
// Abre os dois campos ali, embaixo da demanda; salvar usa a mesma gravação
// do painel (moverDataDoItem) e o quarto relê as cobranças.
function abrirDatasCobrancaEscritorio(botao) {
  const li = botao.closest("li"), aberto = li.querySelector(".ofc-cobranca-datas");
  document.querySelectorAll(".ofc-cobranca-datas").forEach((el) => { el.closest("li")?.querySelector(".ofc-cobranca-datas-abrir")?.setAttribute("aria-expanded", "false"); el.remove(); });
  if (aberto) return;
  const { ref, quadro, prazo, veic } = botao.dataset, demanda = quadro === "demandas";
  const div = document.createElement("div");
  div.className = "ofc-cobranca-datas";
  const campo = (nome, rotulo, valor) => `<div class="ofc-datas-campo"><small>${rotulo}</small><button type="button" class="ofc-datas-valor" data-campo="${nome}" data-valor="${safeText(valor)}" aria-expanded="false" onclick="abrirCalendarioDatasEscritorio(this)">${safeText(cobrancaDataBr(valor))}</button></div>`;
  div.innerHTML = `${campo("prazo", "Prazo", prazo)}${campo("veiculacao", demanda ? "Conclusão" : "Veiculação", veic)}
<button type="button" class="ofc-p-entrar" onclick="salvarDatasCobrancaEscritorio(this,'${safeText(ref)}','${safeText(quadro)}')">Salvar</button>`;
  li.append(div);
  botao.setAttribute("aria-expanded", "true");
  div.querySelector(".ofc-datas-valor")?.focus();
}
const cobrancaDataBr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "sem data");
// Calendário desenhado dentro do cartão (Paulo, 29/10/2026: "quando passo o mês
// fecha e não consigo confirmar"): o calendário do navegador abre fora da
// página e fechava quando o Escritório tirava o foco do campo ou relia as
// cobranças. Este fica no cartão: trocar o mês não fecha nada.
const COBRANCA_MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function abrirCalendarioDatasEscritorio(campo, mes) {
  const div = campo.closest(".ofc-cobranca-datas");
  const jaAberto = div.querySelector(".ofc-datas-calendario");
  if (jaAberto && mes === undefined && jaAberto.dataset.campo === campo.dataset.campo) { jaAberto.remove(); campo.setAttribute("aria-expanded", "false"); return; }
  jaAberto?.remove();
  div.querySelectorAll(".ofc-datas-valor").forEach((b) => b.setAttribute("aria-expanded", String(b === campo)));
  const hoje = typeof escritorioHojeBahia === "function" ? escritorioHojeBahia() : new Date().toISOString().slice(0, 10);
  const valor = campo.dataset.valor || "", base = mes || (valor || hoje).slice(0, 7);
  const [ano, m] = base.split("-").map(Number), inicio = new Date(Date.UTC(ano, m - 1, 1)), dias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const vazios = inicio.getUTCDay(), iso = (d) => `${ano}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const outro = (k) => { const d = new Date(Date.UTC(ano, m - 1 + k, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const cal = document.createElement("div");
  cal.className = "ofc-datas-calendario";
  cal.dataset.campo = campo.dataset.campo;
  cal.innerHTML = `<div class="ofc-datas-mes"><button type="button" aria-label="Mês anterior" data-mes="${outro(-1)}">‹</button><b>${COBRANCA_MESES[m - 1]} ${ano}</b><button type="button" aria-label="Próximo mês" data-mes="${outro(1)}">›</button></div>
<div class="ofc-datas-semana" aria-hidden="true">${["D", "S", "T", "Q", "Q", "S", "S"].map((d) => `<i>${d}</i>`).join("")}</div>
<div class="ofc-datas-dias">${"<span></span>".repeat(vazios)}${Array.from({ length: dias }, (_, i) => i + 1).map((d) => `<button type="button" data-dia="${iso(d)}" class="${iso(d) === valor ? "escolhido" : ""}${iso(d) === hoje ? " hoje" : ""}" aria-label="${d} de ${COBRANCA_MESES[m - 1]}">${d}</button>`).join("")}</div>`;
  cal.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    ev.stopPropagation();
    if (b.dataset.mes) return abrirCalendarioDatasEscritorio(campo, b.dataset.mes);
    if (b.dataset.dia) { campo.dataset.valor = b.dataset.dia; campo.textContent = cobrancaDataBr(b.dataset.dia); campo.classList.add("mudou"); campo.setAttribute("aria-expanded", "false"); cal.remove(); }
  });
  div.append(cal);
}
async function salvarDatasCobrancaEscritorio(botao, ref, quadro) {
  const div = botao.closest(".ofc-cobranca-datas"), abrir = div.closest("li").querySelector(".ofc-cobranca-datas-abrir");
  const valor = (k) => div.querySelector(`.ofc-datas-valor[data-campo="${k}"]`)?.dataset.valor || "";
  const novos = { prazo: valor("prazo"), veiculacao: valor("veiculacao") };
  const antes = { prazo: abrir.dataset.prazo, veiculacao: abrir.dataset.veic };
  const mudou = ["prazo", "veiculacao"].filter((k) => novos[k] && novos[k] !== antes[k]);
  if (!mudou.length) { escritorioAviso("Nenhuma data mudou."); return; }
  botao.disabled = true; botao.textContent = "Salvando…";
  try {
    const item = typeof findOperationalItem === "function" ? findOperationalItem(ref) : null;
    for (const campo of mudou) {
      if (item && typeof moverDataDoItem === "function") await moverDataDoItem(item, campo, novos[campo], { request: quadro === "demandas" });
      else if (!(await tentarEscritaDupla({ id: ref }, { acao: campo, item: ref, data: novos[campo] }))) throw new Error("A gravação não foi confirmada.");
    }
    abrir.dataset.prazo = novos.prazo || antes.prazo; abrir.dataset.veic = novos.veiculacao || antes.veiculacao;
    if (!item) escritorioAviso("Datas salvas.");
    div.remove(); abrir.setAttribute("aria-expanded", "false");
    escritorioAposMudancaDeDemanda();
  } catch (e) {
    botao.disabled = false; botao.textContent = "Salvar";
    escritorioAviso(e?.message || "Não foi possível salvar as datas.");
  }
}
// Com quem está a peça (primeiros nomes), para o head saber quem cobrar
// (Paulo, 20/10/2026: "mostrar com quem tá a demanda, no hover").
const cobrancaCom = (c) => (c.com || []).length ? "com " + c.com.map((n) => String(n).split(" ")[0]).join(", ") : "sem responsável";
// Com quem está, nas fotos do painel (Paulo, 20/10/2026: "no lugar do nome,
// as fotinhas"): os responsáveis da peça como o painel os conhece
// (ownerUsersFor) e, sem a peça carregada, os nomes que o servidor mandou.
function cobrancaFotosHtml(c, item) {
  const achar = typeof ownerUsersFor === "function" ? ownerUsersFor : null;
  let gente = item && achar ? achar(item) : [];
  if (!gente.length && achar && (c.com || []).length) gente = achar({ responsavel: c.com.join(", ") });
  const nomes = gente.length ? gente.map((u) => u.name) : c.com || [];
  if (!nomes.length) return '<span class="ofc-cobranca-fotos vazio" title="Sem responsável">sem responsável</span>';
  // No jogo, a cabeça do personagem de cada um; sem ela, a foto do painel.
  const cabeca = (nome) => { const url = typeof escritorioCabecaUrl === "function" ? escritorioCabecaUrl(nome) : null; return url ? `<img class="ofc-cabeca" src="${safeText(url)}" alt="${safeText(String(nome).split(" ")[0])}" loading="lazy" referrerpolicy="no-referrer">` : null; };
  const lista = gente.length ? gente.map((u) => cabeca(u.name) || (typeof ownerAvatarHtml === "function" ? ownerAvatarHtml(u) : ""))
    : nomes.map((n) => cabeca(n) || `<span class="owner-avatar-fallback" style="background:#465363">${safeText(String(n).slice(0, 2).toUpperCase())}</span>`);
  const fotos = lista.slice(0, 3).join("") + (lista.length > 3 ? `<span class="owner-avatar-fallback" style="background:#465363">+${lista.length - 3}</span>` : "");
  return `<span class="ofc-cobranca-fotos owner-avatar-stack" title="Com ${safeText(nomes.join(", "))}" aria-label="Com ${safeText(nomes.join(", "))}">${fotos}</span>`;
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
  // Alguém mudando as datas de uma demanda aqui: espera ele terminar.
  if (el.querySelector(".ofc-cobranca-datas")) return;
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
    // Arrastável pela faixa de cima (Paulo, 20/10/2026), sem sair do mapa.
    pop.addEventListener("pointerdown", (ev) => {
      const topo = ev.target.closest(".ofc-cobranca-pop-topo");
      if (!topo || ev.target.closest("button") || ev.button !== 0) return;
      ev.preventDefault();
      const r = raiz.getBoundingClientRect(), x0 = ev.clientX - pop.offsetLeft, y0 = ev.clientY - pop.offsetTop;
      topo.setPointerCapture(ev.pointerId);
      pop.classList.add("arrastando");
      const mover = (m) => {
        pop.style.left = Math.max(8, Math.min(r.width - pop.offsetWidth - 8, m.clientX - x0)) + "px";
        pop.style.top = Math.max(8, Math.min(r.height - pop.offsetHeight - 8, m.clientY - y0)) + "px";
      };
      const soltar = () => { pop.classList.remove("arrastando"); topo.removeEventListener("pointermove", mover); topo.removeEventListener("pointerup", soltar); topo.removeEventListener("pointercancel", soltar); };
      topo.addEventListener("pointermove", mover);
      topo.addEventListener("pointerup", soltar);
      topo.addEventListener("pointercancel", soltar);
    });
  }
  escritorio.cobrancaAberta = g;
  // O calendário inteiro do cliente: a Agenda mensal já filtrada nele, o mesmo
  // caminho do painel do agente (abrirCalendarioDoClienteEscritorio).
  const calendario = typeof abrirCalendarioDoClienteEscritorio === "function" && typeof modoComVisoesDoQuadro === "function" && modoComVisoesDoQuadro();
  pop.setAttribute("aria-label", `${g.cliente}: ${g.itens.length} demanda${g.itens.length > 1 ? "s" : ""}`);
  pop.innerHTML = `<div class="ofc-cobranca-pop-topo" title="Arraste para mover">${cobrancaClienteHtml(g)}<button type="button" class="ofc-x" onclick="this.closest('.ofc-cobranca-pop').hidden=true" aria-label="Fechar">×</button></div>
<ul>${g.itens.map((c) => cobrancaItemHtml(c, "this.closest('.ofc-cobranca-pop').hidden=true;")).join("")}</ul>
<div class="ofc-cobranca-pop-rodape"><p class="ofc-nota">Clique numa demanda para editar.</p>${calendario ? `<button type="button" class="workflow-secondary" onclick="this.closest('.ofc-cobranca-pop').hidden=true;abrirCalendarioDoClienteEscritorio(escritorio.cobrancaAberta.cliente)">Abrir calendário</button>` : ""}</div>`;
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
  try { aberto = localStorage.getItem("vybe-escritorio-cobrancas") !== "fechado"; localStorage.setItem("vybe-escritorio-cobrancas", aberto ? "fechado" : "aberto"); if (!aberto) localStorage.setItem("vybe-escritorio-missoes", "fechado"); } catch {}
  pintarCobrancasEscritorio(escritorio.cobrancasGrupos || [], null);
  if (!aberto) pintarMissoesEscritorio();
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
  if (typeof pintarMissoesEscritorio === "function") pintarMissoesEscritorio();
  // Clientes que pararam de cobrar desde a última olhada neste quarto: agradecem e vão embora.
  const agora = new Set(grupos.filter((g) => g.cobra).map((g) => g.cliente_id));
  const antes = escritorio.cobrancasAntes?.quarto === quarto ? escritorio.cobrancasAntes.grupos : [];
  const resolvidos = antes.filter((g) => g.cobra && !agora.has(g.cliente_id));
  escritorio.cobrancasAntes = { quarto, grupos };
  const visitante = (g, i, falas, tom) => ({ nome: g.itens.length > 1 ? `${g.cliente} · ${g.itens.length}` : g.cliente,
    figura: typeof escritorioFiguraDoAgente === "function" ? escritorioFiguraDoAgente(g, i) : undefined, mao: typeof escritorioMaoDoAgente === "function" ? escritorioMaoDoAgente(g) : "", falas, tom,
    dica: g.itens.map((c) => `${c.titulo}\n  ${cobrancaRotulo(c)}${c.tipo === "postar_parada" ? "" : " · " + cobrancaCom(c)}`).join("\n"), aoClicar: (e) => abrirCobrancaClienteEscritorio(g, e) });
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
