// ─── O SUBSOLO DO ESCRITÓRIO ──────────────────────────────────────────────────
//
// Easter egg do Centro de Operação (Paulo, 27/10/2026). A estante do canto do
// Centro é secreta: quem administra puxa o livro certo e desce para o subsolo,
// uma cripta onde ficam os clientes e os colaboradores desativados. Cliente
// fica na frente de uma lápide, com a fantasia que usava na mesa; colaborador
// fica ao lado de uma cripta, com o boneco que usava no Escritório.
//
// Clicar num deles abre a ficha com "Reviver" (volta para a mesa ou para o
// time) e o botão especial "Apagar para sempre". O livro de registros, no
// altar ao lado do poço das almas, cadastra cliente e colaborador novo e lista
// quem não coube nas lápides. Todos os gestos são os do ciclo de vida
// (vybe-ciclo.js), os mesmos da Equipe e da tela de Clientes.
//
// A cena é scripts/cenas/subsolo.mjs; a sala tem voz e conversa própria.

const ESCRITORIO_ESTANTE_SECRETA = "hween_c20_secretbkshelf";
const ESCRITORIO_LIVRO_DE_REGISTROS = "hween_c22_bookofdead";
// Alma sem boneco salvo: o uniforme pálido da cena.
const ESCRITORIO_ALMA = "hr-828-61.hd-180-1.ch-215-1408.lg-280-1408.sh-305-1408";

// O que cada peça do segredo faz ao ser usada (escritorioAcaoDoMovel).
function escritorioAcaoDoSubsolo(m) {
  if (!escritorio.base?.admin) return null;
  if (m.classe === ESCRITORIO_ESTANTE_SECRETA && escritorio.quarto === "operacao") return { item: m, texto: "Puxar o livro torto", fazer: () => descerAoSubsoloEscritorio() };
  if (m.classe === ESCRITORIO_LIVRO_DE_REGISTROS && escritorio.quarto === "subsolo") return { item: m, texto: "Abrir o livro de registros", fazer: () => abrirLivroDeRegistrosEscritorio() };
  return null;
}
const escritorioEhPecaDoSubsolo = (m) => m.classe === ESCRITORIO_ESTANTE_SECRETA || m.classe === ESCRITORIO_LIVRO_DE_REGISTROS;

function descerAoSubsoloEscritorio() {
  if (!escritorio.base?.admin) return;
  escritorioAviso("A estante range e abre uma passagem para baixo…");
  setTimeout(() => { escritorio.pelaPortaSecreta = true; escritorioIrParaAmbiente("subsolo", true); }, 600);
}

// Quem está lá embaixo, do servidor (area=subsolo, só de quem administra).
async function escritorioCarregarSubsolo() {
  const r = await fetch("/api/painel?area=subsolo", { credentials: "same-origin", cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || "o subsolo não respondeu");
  escritorio.subsolo = { clientes: d.clientes || [], pessoas: d.pessoas || [] };
  return escritorio.subsolo;
}

const escritorioDataDaSaida = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");

// Cada desativado num posto da sua ala: clientes nas lápides, time nas criptas.
// Quem não cabe aparece no livro de registros.
async function escritorioOcuparSubsolo() {
  if (escritorio.quarto !== "subsolo" || !escritorio.mapa?.ocuparPostos) return;
  const mapa = escritorio.mapa;
  if (!escritorio.base?.admin) { mapa.ocuparPostos([]); return; }
  let dados;
  try { dados = await escritorioCarregarSubsolo(); }
  catch (e) { escritorioAviso("O subsolo não abriu: " + e.message); return; }
  if (mapa !== escritorio.mapa) return;
  const lugares = mapa.alasDosPostos ? mapa.alasDosPostos() : [];
  const livres = { clientes: lugares.filter((l) => l.ala === "clientes").map((l) => l.posto), time: lugares.filter((l) => l.ala === "time").map((l) => l.posto) };
  const ocupados = [];
  dados.clientes.forEach((c, i) => {
    const posto = livres.clientes.shift();
    if (posto === undefined) return;
    const a = { cliente: c.nome, segmento: c.segmento, personagem: c.personagem };
    ocupados.push(escritorioAlmaNoPosto("cliente", c, posto, escritorioFiguraDoAgente(a, i), escritorioMaoDoAgente(a)));
  });
  dados.pessoas.forEach((p) => {
    const posto = livres.time.shift();
    if (posto === undefined) return;
    ocupados.push(escritorioAlmaNoPosto("pessoa", p, posto, p.figura || ESCRITORIO_ALMA, ""));
  });
  mapa.ocuparPostos(ocupados, { clientes: { texto: "Clientes", cor: "#8fb58a" }, time: { texto: "Time", cor: "#9b8fc9" } });
  const total = dados.clientes.length + dados.pessoas.length, fora = total - ocupados.length;
  escritorioAviso(total ? `${total} no subsolo${fora ? ` · ${fora} só no livro de registros` : ""}.` : "O subsolo está vazio: ninguém desativado.");
}
function escritorioAlmaNoPosto(tipo, x, posto, figura, mao) {
  const saiu = escritorioDataDaSaida(x.saiu_em);
  return { posto, nome: x.nome, figura, mao, fantasma: true, cor: tipo === "cliente" ? "#8fb58a" : "#9b8fc9",
    situacao: saiu ? `Saiu em ${saiu}` : "Desativado", detalhe: x.motivo || (saiu ? `Saiu em ${saiu}` : ""),
    aoClicar: () => abrirAlmaDoSubsoloEscritorio(tipo, x.id) };
}

function abrirAlmaDoSubsoloEscritorio(tipo, id) {
  const lista = tipo === "cliente" ? escritorio.subsolo?.clientes : escritorio.subsolo?.pessoas;
  const x = (lista || []).find((i) => String(i.id) === String(id));
  if (!x) return;
  const i = (lista || []).indexOf(x);
  const figura = tipo === "cliente" ? escritorioFiguraDoAgente({ cliente: x.nome, segmento: x.segmento, personagem: x.personagem }, i) : x.figura || ESCRITORIO_ALMA;
  const boneco = typeof mapaAvatarUrl === "function" ? `<img class="ofc-agente-boneco" src="${safeText(mapaAvatarUrl(figura, 3, "std", "", 0))}" alt="" referrerpolicy="no-referrer">` : "";
  const saiu = escritorioDataDaSaida(x.saiu_em);
  const linhas = [saiu ? `Saiu em ${saiu}` : "Data de saída não registrada", x.motivo ? `Motivo: ${x.motivo}` : "",
    tipo === "cliente" && x.pecas ? `${x.pecas} peças na história` : "", tipo === "pessoa" && x.papel ? x.papel : ""].filter(Boolean);
  escritorio.almaAberta = { tipo, id: String(x.id), nome: x.nome };
  openWorkflowModal(`<div class="ofc-alma">
    <div class="workflow-kicker"><span>${tipo === "cliente" ? "Cliente no subsolo" : "Colaborador no subsolo"}</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <div class="ofc-agente-topo"><div class="ofc-agente-palco ofc-alma-palco"><span class="ofc-lobby-luz"></span><span class="ofc-lobby-ladrilho"></span>${boneco}</div>
      <div class="ofc-agente-nome"><h2 class="workflow-title">${safeText(x.nome)}</h2>${linhas.map((l) => `<small>${safeText(l)}</small>`).join("")}</div></div>
    <div class="workflow-actions">
      <button type="button" class="workflow-primary" onclick="reviverAlmaDoSubsoloEscritorio()">${tipo === "cliente" ? "Reviver: volta para uma mesa" : "Reviver: volta para o time"}</button>
      <button type="button" class="workflow-secondary perigo ofc-alma-apagar" onclick="apagarAlmaDoSubsoloEscritorio()" title="Apagar para sempre: não tem volta">☠ Apagar para sempre</button>
    </div></div>`);
}
function reviverAlmaDoSubsoloEscritorio() {
  const a = escritorio.almaAberta;
  if (!a) return;
  closeWorkflowModal();
  reviverNoCiclo(a.tipo, a.id, a.nome, { depois: escritorioOcuparSubsolo });
}
function apagarAlmaDoSubsoloEscritorio() {
  const a = escritorio.almaAberta;
  if (a) abrirApagarNoCiclo(a.tipo, a.id, a.nome, { depois: escritorioOcuparSubsolo });
}

// O livro de registros: cadastrar quem chega e achar quem está lá embaixo.
async function abrirLivroDeRegistrosEscritorio() {
  let dados = escritorio.subsolo;
  try { dados = await escritorioCarregarSubsolo(); } catch { /* mostra o que já tinha */ }
  const item = (tipo, x) => `<li><button type="button" class="ofc-agente-peca" onclick="closeWorkflowModal();abrirAlmaDoSubsoloEscritorio('${tipo}','${safeText(String(x.id))}')"><span><b>${safeText(x.nome)}</b><span class="ofc-agente-peca-linha"><small>${safeText([escritorioDataDaSaida(x.saiu_em), x.motivo].filter(Boolean).join(" · ") || "sem registro de saída")}</small></span></span></button></li>`;
  const secao = (titulo, tipo, lista) => `<section class="ofc-agente-bloco"><div class="ofc-agente-bloco-topo"><h4>${titulo} · ${lista.length}</h4></div>${lista.length ? `<ul class="ofc-agente-lista">${lista.map((x) => item(tipo, x)).join("")}</ul>` : '<p class="ofc-nota">Ninguém aqui.</p>'}</section>`;
  openWorkflowModal(`<div class="ofc-livro">
    <div class="workflow-kicker"><span>Livro de registros</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Quem entra, quem desceu</h2>
    <div class="workflow-actions ofc-livro-novos">
      <button type="button" class="workflow-primary" onclick="abrirNovoNoCiclo('cliente',{depois:escritorioOcuparSubsolo})">Novo cliente</button>
      <button type="button" class="workflow-primary" onclick="abrirNovoNoCiclo('pessoa',{depois:escritorioOcuparSubsolo})">Novo colaborador</button>
    </div>
    <div class="ofc-agente-grade">${secao("Clientes no subsolo", "cliente", dados?.clientes || [])}${secao("Time no subsolo", "pessoa", dados?.pessoas || [])}</div>
  </div>`);
}
