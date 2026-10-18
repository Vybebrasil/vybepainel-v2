// Editor do mapa do escritório. Quem administra edita o mapa geral (e qualquer
// sala); cada pessoa edita a própria sala. O servidor confere de novo ao salvar.
// Camadas: "geral" em coordenadas do mapa; "sala-N" relativas ao canto da sala.
function escritorioPodeEditar(camada) {
  const b = escritorio.base;
  if (!b?.mapa?.editavel && !b?.demo) return false;
  if (b.admin) return true;
  return camada !== "geral" && escritorioMinhaMesa()?.ambiente.id === camada;
}
// O que o botão "Editar" abre: a sala onde a pessoa está (se puder), a própria
// sala, ou o mapa geral para quem administra.
function escritorioCamadaParaEditar() {
  const aqui = escritorioLugarDe(escritorio.perfil);
  if (aqui?.pessoal && escritorioPodeEditar(aqui.id)) return aqui.id;
  // Quem administra, fora de uma sala individual, edita o mapa geral (onde
  // está: Lounge, Recepção…); antes abria a própria sala e nada do resto mexia.
  if (escritorio.base?.admin && !aqui?.pessoal && escritorioPodeEditar("geral")) return "geral";
  const minha = escritorioMinhaMesa()?.ambiente.id;
  if (minha && escritorioPodeEditar(minha)) return minha;
  return escritorio.base?.admin ? "geral" : null;
}
function escritorioNomeCamada(camada) {
  return camada === "geral" ? "a Praça" : escritorioAmbienteDoQuarto(camada)?.nome || camada;
}
function escritorioCameraEditor() {
  return Boolean(escritorio.edicao && (escritorio.edicao.ferramenta === "camera" || escritorio.espacoEditor));
}
function atualizarFerramentaEditorEscritorio() {
  document.getElementById("office-map")?.classList.toggle("ofc-camera-editor", escritorioCameraEditor());
  if (escritorioCameraEditor()) escritorio.mapa?.previa(null);
}
function ferramentaEditorEscritorio(ferramenta) {
  if (!escritorio.edicao || !["selecionar", "camera"].includes(ferramenta)) return;
  escritorio.edicao.ferramenta = ferramenta;
  atualizarFerramentaEditorEscritorio();
  if (ferramenta === "selecionar" && escritorio.catalogoCategoria === "Sala") {
    escritorio.catalogoCategoria = "";
    renderEscritorio();
  } else renderBarraEditorEscritorio();
}
function gradeEditorEscritorio(alternar = false) {
  const e = escritorio.edicao;
  if (!e) return;
  if (alternar) e.grade = e.grade === false;
  const c = escritorioCantoCamada(e.camada);
  escritorio.mapa?.grade(e.grade === false ? null : { x0:c.x, y0:c.y, x1:c.x+c.w, y1:c.y+c.h });
  if (alternar) renderBarraEditorEscritorio();
}
async function abrirEditorEscritorio(camada = escritorioCamadaParaEditar()) {
  if (!camada || !escritorioPodeEditar(camada)) {
    escritorioAviso(escritorio.base?.mapa?.editavel === false && !escritorio.base?.demo ? "O mapa editável aguarda a mudança no banco." : "Você pode editar a sua sala; o mapa, só quem administra.");
    return;
  }
  // Uma sala só se edita de dentro do quarto dela: entra primeiro (direto
  // pela porta) e abre o editor quando o quarto estiver desenhado. A camada
  // "geral" é a Praça.
  if ((camada === "geral" ? escritorio.quarto : escritorio.quarto !== camada) && typeof escritorioEntrarNoQuarto === "function") {
    escritorio.aoChegarNaCena = () => abrirEditorEscritorio(camada);
    if (camada === "geral") escritorioIrParaPraca(); else if (!escritorioEntrarNoQuarto(camada)) escritorio.aoChegarNaCena = null;
    return;
  }
  if(camada!=="geral" && !escritorio.base.demo) {
    try { escritorio.base.economia=(await escritorioApi("economia")).economia; }
    catch(e) {escritorioAviso(e.message);return;}
  }
  const salvo = escritorio.base.mapa?.camadas?.[camada];
  escritorio.espacoEditor = false;
  // Construir não pode deixar o personagem seguindo uma rota antiga.
  escritorioPararTeclado();
  movimento.rota = [];
  escritorio.seguindoId = null;
  clearInterval(escritorio.timerSeguir);
  escritorio.edicao = {
    camada,
    itens: escritorioItensDaCamada(camada).map((it) => [...it.slice(0, 6)]),
    versao: salvo?.versao || 0,
    sel: null, novo: null, mudou: false,
  };
  // Histórico para desfazer/refazer (fotos da lista de itens).
  escritorio.edicao.passos = [escritorioFotoEdicao(escritorio.edicao)];
  escritorio.edicao.futuro = [];
  escritorio.modo = "mapa";
  escritorio.aba = "catalogo";
  escritorio.lateral = true;
  renderEscritorio();
  gradeEditorEscritorio();
  atualizarFerramentaEditorEscritorio();
  const a = escritorioAmbienteDoQuarto(camada);
  if (a) escritorio.mapa?.centralizar((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2);
}
function sairEditorEscritorio() {
  if (escritorio.edicao?.mudou && !confirm("Descartar as mudanças desta edição?")) return;
  const plantaMudou = escritorio.edicao?.celdas !== undefined;
  escritorio.edicao = null;
  escritorio.espacoEditor = false;
  if (plantaMudou) escritorioRedesenharMapa();
  atualizarFerramentaEditorEscritorio();
  escritorio.aba = "pessoas";
  escritorio.mapa?.destacar(null);
  escritorio.mapa?.previa(null);
  escritorio.mapa?.grade(null);
  escritorio.mapa?.definirMoveis(escritorioMoveisAtuais());
  renderEscritorio();
}
async function salvarEditorEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.salvando) return;
  e.salvando = true;
  renderBarraEditorEscritorio();
  try {
    // A planta desenhada vai junto com os móveis (o servidor confere os dois).
    const planta = e.celdas !== undefined ? { celdas: e.celdas } : {};
    let r = { camada: e.camada, itens: e.itens, versao: e.versao + 1, ...planta };
    if (!escritorio.base.demo) r = await escritorioApi("mapa", { camada: e.camada, itens: e.itens, versao: e.versao, ...planta });
    if (r.celdas !== undefined) {
      escritorioAlterarDecoracao({ sala_celdas: r.celdas });
      const eu = escritorio.base.equipe.find((x) => String(x.id) === String(escritorio.base.eu));
      if (eu) eu.perfil = { ...eu.perfil, ...escritorio.perfil };
    }
    escritorio.base.mapa = escritorio.base.mapa || { editavel: true, camadas: {} };
    escritorio.base.mapa.camadas[e.camada] = { itens: r.itens, versao: r.versao, em: new Date().toISOString() };
    escritorio.edicao = null;
    escritorio.aba = "pessoas";
    escritorio.mapa?.destacar(null);
    escritorio.mapa?.grade(null);
    if (r.celdas !== undefined) { escritorioAplicarSalas(); escritorioRedesenharMapa(); }
    else await escritorio.mapa?.definirMoveis(escritorioMoveisAtuais());
    renderEscritorio();
    escritorioAvisarDecoracao(r.camada);
    escritorioAviso("Mudanças salvas em " + escritorioNomeCamada(r.camada) + ".");
  } catch (erro) {
    e.salvando = false;
    renderBarraEditorEscritorio();
    escritorioAviso(erro.message);
  }
}
// Converte ladrilho do mapa ↔ coordenadas da camada.
function escritorioCantoCamada(camada) {
  const quarto=escritorioAmbienteDoQuarto(camada);
  const a = quarto?.x1 != null ? quarto : ESCRITORIO_PLANTA.ambientes.find(a=>a.id===camada);
  // A camada "geral" é a Praça.
  const r = a || ESCRITORIO_PRACA;
  return { x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 };
}
// O móvel inteiro precisa caber na área que a pessoa pode editar e, se for
// sólido (não tapete), não pode cair em cima de outro móvel sólido.
// Modo construtor (como o ladrilho de empilhar e o ":setsh" do Habbo): o
// móvel vai por cima de qualquer coisa, sem bloqueio; com altura escolhida,
// toda peça colocada fica nela (para paredes, teto, mezanino e esculturas).
function alternarConstrutorEscritorio() {
  escritorio.construtor = { ligado: !escritorio.construtor?.ligado, altura: escritorio.construtor?.altura ?? null };
  escritorioAviso(escritorio.construtor.ligado ? "Modo construtor: os móveis vão por cima de qualquer coisa. Escolha a altura ou deixe em automático." : "Modo construtor desligado.");
  renderBarraEditorEscritorio();
}
function alturaConstrutorEscritorio(valor) {
  const n = String(valor).trim() === "" ? null : Math.max(0, Math.min(ESCRITORIO_ALTURA_MAX, Math.round(Number(String(valor).replace(",", ".")) * 100) / 100));
  escritorio.construtor = { ligado: true, altura: Number.isFinite(n) ? n : null };
}
// Cor do bloco de construção (estado = 100 + cor × 5 + variante): vale para
// todos os blocos selecionados e fica como cor dos próximos que forem postos.
function corBlocoEscritorio(i) {
  const e = escritorio.edicao;
  if (!e) return;
  const alvos = e.selVarios?.size ? [...e.selVarios] : e.sel != null ? [e.sel] : [];
  for (const k of alvos) {
    const it = e.itens[k];
    if (!it || !/_recolorable$/.test(it[0])) continue;
    const variante = it[4] >= 100 ? (it[4] - 100) % 5 : Math.max(0, Math.min(4, it[4] || 0));
    it[4] = 100 + i * 5 + variante;
  }
  escritorio.corBloco = i;
  escritorioEditorMudou();
}
// Altura de uma peça nova no modo construtor: a escolhida, senão o topo do que
// está embaixo (qualquer móvel), senão o chão.
function escritorioAlturaConstrutor(x, y) {
  const c = escritorio.construtor;
  if (!c?.ligado) return null;
  if (c.altura != null) return c.altura;
  const baixo = (escritorio.mapa?.moveisEm(x, y) || []).filter((m) => !m.plano && !m.parede);
  return baixo.length ? Math.min(ESCRITORIO_ALTURA_MAX, Math.round(Math.max(...baixo.map(mapaTopoMovel)) * 100) / 100) : 0;
}
async function escritorioCabe(classe, lx, ly, dir, ignorar = null, colisao = true) {
  if (escritorio.construtor?.ligado) colisao = false;
  const ed = escritorio.edicao;
  if (!ed) return false;
  const c = escritorioCantoCamada(ed.camada);
  const d = await escritorio.mapa.medidas(classe, dir);
  if (escritorio.edicao !== ed) return false;
  if (!(lx >= 0 && ly >= 0 && lx + d.x <= c.w && ly + d.y <= c.h)) return false;
  const ambiente=escritorioAmbienteDoQuarto(ed.camada);
  const escada = ambiente && escritorioModeloPlanta(ambiente)?.escada;
  if(ambiente) for(let x=Math.floor(lx);x<Math.ceil(lx+d.x);x++) for(let y=Math.floor(ly);y<Math.ceil(ly+d.y);y++)
    if(escritorioNivelQuarto(ambiente,x,y)<0 || escritorioNivelQuarto(ambiente,x,y)!==escritorioNivelQuarto(ambiente,lx,ly) || escada?.some(([ex,ey])=>ex===x && ey===y)) return false;
  if (!colisao || !(d.z > 0.05) || d.imagem) return true;
  for (let i = 0; i < Math.max(1, Math.round(d.x)); i++) for (let j = 0; j < Math.max(1, Math.round(d.y)); j++)
    if (escritorio.mapa.moveisEm(c.x + lx + i, c.y + ly + j).some((m) => !m.plano && !m.altura && !(ignorar && m.origem?.camada === escritorio.edicao.camada && (m.origem?.i === ignorar.i || ignorar.grupo?.has(m.origem?.i))))) return false;
  return true;
}
let escritorioRedesenho = null;
function escritorioEditorMudou(semPasso = false) {
  const ed = escritorio.edicao;
  if (!ed) return;
  if (!semPasso && ed.passos) {
    const foto = escritorioFotoEdicao(ed);
    if (foto !== ed.passos.at(-1)) { ed.passos.push(foto); ed.futuro = []; if (ed.passos.length > 80) ed.passos.shift(); }
  }
  escritorio.edicao.mudou = true;
  clearTimeout(escritorioRedesenho);
  escritorioRedesenho = setTimeout(async () => {
    await escritorio.mapa?.definirMoveis(escritorioMoveisAtuais());
    const e = escritorio.edicao;
    escritorio.mapa?.destacar(e && e.sel !== null ? { camada: e.camada, i: e.sel } : null);
    if (e?.alvos != null) escritorioMostrarAlvosGatilho();
    renderBarraEditorEscritorio();
  }, 30);
}
// Aba "Piso e paredes" aberta: o clique (e o arrasto) pinta em vez de mover móvel.
function escritorioPintando() {
  return escritorio.edicao && escritorio.catalogoCategoria === "Sala" && typeof pintarNaSalaEscritorio === "function";
}
async function cliqueEditorEscritorio(x, y) {
  if (!escritorio.edicao || escritorioCameraEditor()) return;
  if (escritorio.edicao?.colar) { soltarColarEscritorio(Math.floor(x), Math.floor(y)); return; }
  if (escritorioPintando()) { if (!pintarNaSalaEscritorio(Math.floor(x), Math.floor(y), x, y) && escritorioPincel().ferramenta !== "balde") escritorioAviso(escritorioPincel().ferramenta === "parede" ? "Clique no piso encostado numa parede da sua sala." : "Pinte dentro da sua sala."); return; }
  const e = escritorio.edicao, c = escritorioCantoCamada(e.camada);
  const lx = Math.floor(x) - c.x, ly = Math.floor(y) - c.y;
  // Quadro: vai na parede alta mais perto do ladrilho clicado.
  const quadroNovo = e.novo && escritorioImagemDe(e.novo)?.tipo === "quadro";
  const quadroSel = !e.novo && e.sel !== null && escritorioImagemDe(e.itens[e.sel]?.[0])?.tipo === "quadro";
  if (quadroNovo || quadroSel) {
    const classe = quadroNovo ? e.novo : e.itens[e.sel][0];
    const lugar = escritorioLugarQuadro(classe, lx, ly, quadroNovo ? -1 : e.sel);
    if (lugar.erro) {
      // Clique em outro quadro ou móvel seleciona em vez de mover.
      if (!quadroNovo && escritorioSelecionarNoClique(x, y, lx, ly)) return;
      return escritorioAviso(lugar.erro);
    }
    if (quadroNovo) { e.itens.push([classe, lugar.lx, lugar.ly, lugar.dir, 0, 0]); e.sel = e.itens.length - 1; e.novo = null; escritorioAviso("Quadro colocado. Clique em outro trecho da parede para mudar; Delete apaga."); }
    else { const it = e.itens[e.sel]; it[1] = lugar.lx; it[2] = lugar.ly; it[3] = lugar.dir; }
    return escritorioEditorMudou();
  }
  if (e.novo && escritorioEhParede(e.novo)) {
    const lugar = escritorioLugarParede(Math.floor(x), Math.floor(y), x, y);
    if (!lugar) return escritorioAviso("Itens de parede vão encostados numa parede: clique no piso junto dela.");
    e.itens.push([e.novo, lugar.lx, lugar.ly, lugar.dir, 0, 1]);
    e.sel = e.itens.length - 1;
    e.novo = null;
    escritorio.mapa?.previa(null);
    escritorioAviso("Pendurado. Alt + ↑/↓ sobe e desce; Alt + ←/→ desliza na parede.");
    return escritorioEditorMudou();
  }
  if (e.novo) {
    const classe = e.novo;
    const d = await escritorio.mapa.medidas(classe, e.novoDir ?? 2);
    if (escritorio.edicao !== e || e.novo !== classe) return;
    const aj = e.novoAjuste || { dx:0, dy:0 }, rd = v => Math.round(v*100)/100;
    // Como no Habbo: pousa onde se clicou, no topo mais alto do que está
    // embaixo (mesa, balcão, bloco); o modo construtor escolhe a altura livre.
    const construtor = escritorioAlturaConstrutor(Math.floor(x), Math.floor(y));
    const nx = rd(lx+aj.dx), ny = rd(ly+aj.dy);
    const pouso = construtor == null ? await escritorioPousoHabbo(classe, nx, ny, d.dir) : { altura: construtor };
    if (pouso.erro) return escritorioAviso(pouso.erro);
    if (!(await escritorioCabe(classe, nx, ny, d.dir, null, false)))
      return escritorioAviso("Esse móvel não cabe aí. Escolha outro lugar dentro de " + escritorioNomeCamada(e.camada) + ".");
    if (escritorio.edicao !== e || e.novo !== classe) return;
    const sobre = pouso.altura > 0;
    const item = [classe,nx,ny,d.dir,/_recolorable$/.test(classe) && escritorio.corBloco != null ? 100 + escritorio.corBloco * 5 : 0,pouso.altura];
    if (!escritorioInventarioPara([item])) return;
    e.itens.push(item);
    e.novoAjuste = null;
    escritorio.mapa?.previa(null);
    e.sel = e.itens.length - 1;
    e.novo = null;
    escritorioAviso(sobre ? "Colocado em cima. Alt + setas ajusta fino; R gira." : "Móvel colocado. Arraste para ajustar; R gira.");
    return escritorioEditorMudou();
  }
  if (escritorioSelecionarNoClique(x, y, lx, ly)) return;
  // Clicou num móvel de outra área que a pessoa pode editar: troca para ela.
  const deOutra = escritorio.mapa.moveisEm(x, y).find((m) => m.origem && m.origem.camada !== e.camada && escritorioPodeEditar(m.origem.camada));
  if (deOutra && e.sel === null) {
    if (e.mudou) return escritorioAviso("Esse móvel é de " + escritorioNomeCamada(deOutra.origem.camada) + ". Salve ou cancele esta edição antes.");
    abrirEditorEscritorio(deOutra.origem.camada);
    escritorio.edicao.sel = deOutra.origem.i;
    escritorio.mapa.destacar(deOutra.origem);
    renderBarraEditorEscritorio();
    return escritorioAviso("Agora editando " + escritorioNomeCamada(deOutra.origem.camada) + ".");
  }
  if (!deOutra && e.sel === null && escritorio.mapa.moveisEm(x, y).length) return escritorioAviso("Esse móvel não é de " + escritorioNomeCamada(e.camada) + ", e você não pode editá-lo.");
  if (e.sel !== null) {
    const it = e.itens[e.sel];
    if (!(await escritorioCabe(it[0], lx, ly, it[3]))) return escritorioAviso("Não cabe aí.");
    it[1] = lx; it[2] = ly;
    return escritorioEditorMudou();
  }
}
// Seleciona o quadro encostado no ladrilho clicado ou o móvel em cima dele.
function escritorioSelecionarNoClique(x, y, lx, ly) {
  const e = escritorio.edicao;
  // Shift + clique: junta (ou tira) o móvel da seleção em grupo.
  if (escritorio.shift) {
    const m = escritorio.mapa.moveisEm(x, y).find((q) => q.origem?.camada === e.camada);
    if (!m) return false;
    const g = escritorioGrupo();
    g.has(m.origem.i) ? g.delete(m.origem.i) : g.add(m.origem.i);
    e.sel = g.size ? [...g].at(-1) : null;
    escritorioDestacarGrupo();
    renderBarraEditorEscritorio();
    return true;
  }
  e.selVarios = new Set();
  const quadro = e.itens.findIndex((it) => escritorioImagemDe(it[0])?.tipo === "quadro" && escritorioQuadroCobre(it, lx, ly));
  if (quadro >= 0 && quadro !== e.sel) {
    e.sel = quadro;
    escritorio.mapa.destacar(null);
    renderBarraEditorEscritorio();
    return true;
  }
  const daCamada = escritorio.mapa.moveisEm(x, y).find((m) => m.origem?.camada === e.camada);
  if (daCamada && daCamada.origem.i !== e.sel) {
    e.sel = daCamada.origem.i;
    escritorio.mapa.destacar(daCamada.origem);
    renderBarraEditorEscritorio();
    return true;
  }
  return false;
}
async function girarSelecionadoEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.sel === null) return;
  const it = e.itens[e.sel];
  if (escritorioImagemDe(it[0])) return escritorioAviso(escritorioImagemDe(it[0]).tipo === "quadro" ? "O quadro segue a parede: clique em outro trecho dela para mudar." : "O tapete fica do jeito que a imagem é.");
  const { direcoes } = await escritorio.mapa.medidas(it[0], it[3]);
  // Só as direções que o móvel tem de verdade (alguns só têm 1 ou 2).
  const lista = [0, 2, 4, 6].filter((d) => direcoes.includes(d));
  if (lista.length < 2) return escritorioAviso("Esse móvel não gira no Habbo.");
  const prox = lista[(lista.indexOf(it[3]) + 1) % lista.length];
  // A peça não pode bater nela mesma (antes isso travava o girar de tudo).
  // Como no Habbo (moveFurniTo ao girar): girado, ele precisa caber na área e
  // o que fica embaixo dele precisa aceitar peça em cima; senão não gira.
  const pouso = escritorio.construtor?.ligado ? { altura: it[5] || 0 } : await escritorioPousoHabbo(it[0], it[1], it[2], prox, { i: e.sel });
  if (pouso.erro || !(await escritorioCabe(it[0], it[1], it[2], prox, { i: e.sel }, false))) return escritorioAviso(pouso.erro || "Girado, ele sairia da área. Arraste para um lugar livre e gire de novo.");
  it[3] = prox; it[5] = pouso.altura;
  escritorioEditorMudou();
}
function apagarSelecionadoEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.sel === null) return;
  if (escritorioGrupo().size > 1) {
    const g = escritorioGrupo();
    e.itens = e.itens.filter((_, i) => !g.has(i));
    e.sel = null; e.selVarios = new Set();
    escritorio.mapa?.destacar(null);
    return escritorioEditorMudou();
  }
  e.itens.splice(e.sel, 1);
  e.sel = null;
  escritorioEditorMudou();
}
// Guardar tudo (como "pegar tudo" do Habbo): os móveis voltam para o
// inventário; os quadros e tapetes de imagem ficam. Desfazer traz de volta.
function guardarTudoEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.camada === "geral") return;
  const n = e.itens.filter((it) => !escritorioImagemDe(it[0])).length;
  if (!n || !confirm(`Guardar os ${n} móveis desta sala no inventário? Você ainda pode desfazer antes de salvar.`)) return;
  e.itens = e.itens.filter((it) => escritorioImagemDe(it[0]));
  e.sel = null; e.selVarios = new Set();
  escritorio.mapa?.destacar(null);
  escritorioEditorMudou();
  escritorioAviso(`${n} móveis guardados. Salve para confirmar.`);
}
// Liga/desliga "em cima da mesa": sobe a peça na altura de um tampo.
function alturaSelecionadoEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.sel === null) return;
  const it = e.itens[e.sel];
  if (escritorioImagemDe(it[0])) return;
  if (it[5]) { it[5] = 0; it[1] = Math.round(it[1]); it[2] = Math.round(it[2]); return escritorioEditorMudou(); }
  const c = escritorioCantoCamada(e.camada);
  const sobre = escritorioEmCimaDe(Math.floor(it[1] + c.x), Math.floor(it[2] + c.y), e.sel);
  if (sobre) { it[1] = sobre.lx; it[2] = sobre.ly; it[5] = sobre.altura; }
  else it[5] = 1;
  escritorioEditorMudou();
}
// Altura livre, como o "Stack Magic Tile" do Habbo: sobe e desce a peça em
// passos de 0,1 (Shift: 0,5), até ESCRITORIO_ALTURA_MAX níveis; "No topo"
// apoia no que está embaixo (mesa, balcão, outra peça) e "No chão" volta.
// Serve para montar armário sobre bancada, prateleira sobre prateleira.
const ESCRITORIO_ALTURA_MAX = 40;
function alturaLivreEscritorio(delta) {
  const e = escritorio.edicao, it = e?.sel != null ? e.itens[e.sel] : null;
  if (!it || escritorioImagemDe(it[0]) || escritorioEhParede(it[0])) return;
  it[5] = Math.max(0, Math.min(ESCRITORIO_ALTURA_MAX, Math.round(((it[5] || 0) + delta) * 100) / 100));
  escritorioEditorMudou();
}
function noTopoEscritorio() {
  const e = escritorio.edicao, it = e?.sel != null ? e.itens[e.sel] : null;
  if (!it || escritorioImagemDe(it[0]) || escritorioEhParede(it[0])) return;
  const c = escritorioCantoCamada(e.camada);
  const sobre = escritorioEmCimaDe(Math.floor(it[1] + c.x + 0.5), Math.floor(it[2] + c.y + 0.5), e.sel);
  if (!sobre) return escritorioAviso("Não há nada embaixo para apoiar. Use + e − para escolher a altura.");
  it[5] = sobre.altura;
  escritorioEditorMudou();
}
function noChaoEscritorio() {
  const e = escritorio.edicao, it = e?.sel != null ? e.itens[e.sel] : null;
  if (!it || !it[5] || escritorioEhParede(it[0])) return;
  it[5] = 0; it[1] = Math.round(it[1]); it[2] = Math.round(it[2]);
  escritorioEditorMudou();
}
// Mesa (ou balcão, estante baixa) sob um ladrilho do mapa: onde a peça fica
// em cima dela, centrada no tampo, e a altura do tampo.
// Onde a peça pousa, pelas regras do servidor do Habbo (Room.furnitureFitsAt
// e moveFurniTo): no topo mais alto de TODOS os ladrilhos que ela ocupa; não
// pousa se o de cima de qualquer um deles não aceita peça em cima
// (canputstuffon), se passaria da altura 40, se for sólida e houver alguém
// num desses ladrilhos, ou no ladrilho da porta. Sobre assento que aceita
// peça (sofá-cama), fica na base dele. Devolve { altura } ou { erro }.
async function escritorioPousoHabbo(classe, lx, ly, dir, ignorar = null) {
  const e = escritorio.edicao, c = escritorioCantoCamada(e.camada);
  const d = await escritorio.mapa.medidas(classe, dir);
  const fis = mapaFisica(classe), solida = !(fis.pisa || fis.senta || fis.deita);
  const a = escritorioAmbienteDoQuarto(e.camada), porta = a && escritorioPortaQuarto(a);
  const naPorta = (x, y) => porta && (porta.lado === "direita" ? x === porta.x && (y === porta.y || y === porta.y + 1) : y === porta.y && (x === porta.x || x === porta.x + 1));
  const eu = escritorioPosicao(escritorio.perfil || {});
  let altura = 0, ladrilhoAltura = null;
  for (let i = 0; i < Math.max(1, Math.round(d.x)); i++) for (let j = 0; j < Math.max(1, Math.round(d.y)); j++) {
    const tx = Math.floor(lx) + i, ty = Math.floor(ly) + j;
    if (solida && naPorta(tx, ty)) return { erro: "A porta fica livre, como no Habbo." };
    if (solida && (escritorioOcupado(c.x + tx, c.y + ty) || (Math.round(eu.x) === c.x + tx && Math.round(eu.y) === c.y + ty)))
      return { erro: "Tem alguém nesse lugar. Espere sair para pôr um móvel ali." };
    const aqui = (escritorio.mapa.moveisEm(c.x + tx, c.y + ty) || []).filter((m) => !m.parede && !m.pendurado
      && !(ignorar && m.origem?.camada === e.camada && (m.origem?.i === ignorar.i || ignorar.grupo?.has(m.origem?.i))));
    // Ladrilho de altura (InteractionStackHelper): a peça fica na altura dele,
    // seja o que for que está embaixo.
    const magico = aqui.find((m) => mapaFisica(m.classe).logica === "altura");
    if (magico && magico.classe !== classe) { ladrilhoAltura = Math.max(ladrilhoAltura ?? 0, magico.altura || 0); continue; }
    if (!aqui.length) continue;
    const topo = aqui.reduce((x1, x2) => (mapaTopoMovel(x2) > mapaTopoMovel(x1) ? x2 : x1));
    if (!mapaFisica(topo.classe).poe && !topo.plano) return { erro: "Não dá para pôr em cima disso (no Habbo esse móvel não aceita nada em cima)." };
    altura = Math.max(altura, mapaFisica(topo.classe).senta ? topo.altura || 0 : mapaTopoMovel(topo));
  }
  if (ladrilhoAltura != null) altura = ladrilhoAltura;
  if (mapaFisica(classe).logica === "altura") altura = 0; // o próprio ladrilho fica no chão; a altura dele se escolhe com − / +
  if (altura > ESCRITORIO_ALTURA_MAX) return { erro: "Passaria da altura máxima do Habbo (40)." };
  return { altura: Math.round(altura * 100) / 100 };
}
function escritorioEmCimaDe(x, y, ignorar = -1) {
  const e = escritorio.edicao, c = escritorioCantoCamada(e.camada);
  // Empilhar como no Habbo: só em cima do que a ficha deixa pôr coisas
  // (canputstuffon: mesa, balcão, estante, bloco), e o que já está em cima
  // dele também. Fica no topo mais alto. Para pôr em cima de qualquer coisa
  // há a altura livre (− / +), como o ladrilho de empilhar do Habbo.
  const candidatos = escritorio.mapa.moveisEm(x, y).filter((m) => !m.plano && !(m.origem?.camada === e.camada && m.origem?.i === ignorar) && mapaFisica(m.classe).poe
    && mapaTopoMovel(m) <= 10);
  if (!candidatos.length) return null;
  const topo = mapaTopoMovel;
  const alto = candidatos.reduce((a, b) => (topo(b) > topo(a) ? b : a));
  const base = candidatos.filter((m) => !m.altura).sort((a, b) => b.dim.x * b.dim.y - a.dim.x * a.dim.y)[0] || alto;
  const w = Math.max(1, Math.round(base.dim.x)), h = Math.max(1, Math.round(base.dim.y));
  const r = (v) => Math.round(v * 100) / 100;
  // Em peça já empilhada, centra nela; na mesa, no meio do tampo.
  const ref = alto.altura ? alto : base;
  const cx = ref === base ? Math.floor(base.x) + (w - 1) / 2 : ref.x, cy = ref === base ? Math.floor(base.y) + (h - 1) / 2 : ref.y;
  return { lx: r(cx - c.x), ly: r(cy - c.y), altura: r(Math.min(ESCRITORIO_ALTURA_MAX, Math.max(0.1, topo(alto)))) };
}
// Física do que fica em cima de móvel: só onde há tampo embaixo (no
// ladrilho do centro do objeto) e sempre na altura do tampo. Devolve a
// altura certa ou null (sairia da mesa).
function escritorioApoioPara(lx, ly, i) {
  const c = escritorioCantoCamada(escritorio.edicao.camada);
  const apoio = escritorioEmCimaDe(Math.floor(c.x + lx + 0.5), Math.floor(c.y + ly + 0.5), i);
  return apoio ? apoio.altura : null;
}
// Mover uma mesa (ou estante, balcão…) leva junto o que está em cima dela.
async function escritorioLevarOQueEstaEmCima(i, ox, oy, dx, dy) {
  const e = escritorio.edicao, it = e.itens[i];
  if (!it || it[5] || (!dx && !dy)) return;
  let d;
  try { d = await escritorio.mapa.medidas(it[0], it[3]); } catch { return; }
  const w = Math.max(1, Math.round(d.x)), h = Math.max(1, Math.round(d.y)), r = (v) => Math.round(v * 100) / 100;
  e.itens.forEach((o, j) => {
    if (j === i || !o[5] || escritorioEhParede(o[0])) return;
    const cx = o[1] + 0.5, cy = o[2] + 0.5;
    if (cx >= ox && cx < ox + w && cy >= oy && cy < oy + h) { o[1] = r(o[1] + dx); o[2] = r(o[2] + dy); }
  });
}
async function empurrarSelecionadoEscritorio(dx, dy, fino = false) {
  const e = escritorio.edicao, it = e.itens[e.sel];
  // Item de parede: ↑/↓ (com Alt) sobe e desce; ←/→ desliza ao longo da parede.
  if (escritorioEhParede(it[0])) {
    const r = (v) => Math.round(v * 100) / 100;
    if (dy && dx === 0 && fino) { it[5] = Math.max(0, Math.min(4, r((it[5] || 0) - dy * 0.25))); return escritorioEditorMudou(); }
    const passo = fino ? 0.25 : 1, ao = it[3] === 2 ? "y" : "x";
    const d = ao === "x" ? dx || -dy : dy || -dx;
    const c = escritorioCantoCamada(e.camada), k = ao === "x" ? 1 : 2, lim = ao === "x" ? c.w : c.h;
    it[k] = Math.max(0, Math.min(lim - 1, r(it[k] + d * passo)));
    return escritorioEditorMudou();
  }
  // Ajuste fino (Alt + setas): um quarto de ladrilho, para qualquer móvel
  // (cadeira no meio de uma mesa de 2, peça em cima da mesa…).
  if (fino) {
    const c = escritorioCantoCamada(e.camada), r = (v) => Math.round(v * 100) / 100;
    const nx = r(it[1] + dx * 0.25), ny = r(it[2] + dy * 0.25);
    if (nx < 0 || ny < 0 || nx > c.w - 1 || ny > c.h - 1) return;
    // Peça no alto mantém a altura ao andar (altura livre, como no Habbo).
    const ox = it[1], oy = it[2];
    it[1] = nx; it[2] = ny;
    await escritorioLevarOQueEstaEmCima(e.sel, ox, oy, nx - ox, ny - oy);
    return escritorioEditorMudou();
  }
  if (escritorioImagemDe(it[0])?.tipo === "quadro") {
    const lugar = escritorioLugarQuadro(it[0], it[3] === 4 ? it[1] + dx : 0, it[3] === 2 ? it[2] + dy : 0, e.sel, it[3]);
    if (lugar.erro) return;
    it[1] = lugar.lx; it[2] = lugar.ly;
    return escritorioEditorMudou();
  }
  if (it[5]) {
    it[1] += dx; it[2] += dy;
    return escritorioEditorMudou();
  }
  if (!(await escritorioCabe(it[0], it[1] + dx, it[2] + dy, it[3], { i: e.sel }))) return;
  const ox = it[1], oy = it[2];
  it[1] += dx; it[2] += dy;
  await escritorioLevarOQueEstaEmCima(e.sel, ox, oy, dx, dy);
  escritorioEditorMudou();
}
function teclaEditorEscritorio(e) {
  const ed = escritorio.edicao;
  if (!ed || e.target.closest?.("input, textarea, select, [contenteditable]")) return false;
  if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest?.("button")) {
    escritorio.espacoEditor = true;
    atualizarFerramentaEditorEscritorio();
    return true;
  }
  const cmd = e.metaKey || e.ctrlKey, k0 = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (cmd && k0 === "z") { e.preventDefault?.(); e.shiftKey ? refazerEditorEscritorio() : desfazerEditorEscritorio(); return true; }
  if (cmd && k0 === "y") { e.preventDefault?.(); refazerEditorEscritorio(); return true; }
  if (cmd && k0 === "d") { e.preventDefault?.(); duplicarSelecionadoEscritorio(); return true; }
  if (cmd && k0 === "c") { if (copiarSelecaoEscritorio()) { e.preventDefault?.(); return true; } return false; }
  if (cmd && k0 === "v") { e.preventDefault?.(); colarEscritorio(); return true; }
  if (cmd && k0 === "a") { e.preventDefault?.(); escritorio.edicao.selVarios = new Set(escritorio.edicao.itens.map((_, i) => i).filter((i) => !escritorioImagemDe(escritorio.edicao.itens[i][0]))); escritorio.edicao.sel = [...escritorio.edicao.selVarios].at(-1) ?? null; escritorioDestacarGrupo(); renderBarraEditorEscritorio(); return true; }
  if (e.key === "Escape") { if (ed.alvos != null) return terminarAlvosGatilhoEscritorio(), true; if (ed.colar) ed.colar = null; else if (ed.trocar != null) ed.trocar = null; else if (ed.novo) ed.novo = null; else { ed.sel = null; ed.selVarios = new Set(); escritorio.mapa?.destacar(null); } escritorio.mapa?.previa(null); renderBarraEditorEscritorio(); return true; }
  if (!cmd && !e.altKey && k0 === "b") { alternarConstrutorEscritorio(); return true; }
  // Móvel novo ainda na mão: R gira a prévia antes de colocar.
  if (ed.novo && ed.sel === null && (e.key === "r" || e.key === "R")) { girarNovoEscritorio(); return true; }
  // Móvel novo na mão: Alt + setas ajusta a prévia antes de colocar (¼ de ladrilho).
  const fino = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (ed.novo && ed.sel === null && e.altKey && fino) { ajustarNovoEscritorio(...fino); return true; }
  if (ed.sel === null) return false;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === "r") { girarSelecionadoEscritorio(); return true; }
  if (k === "PageUp" || k === "PageDown") { alturaLivreEscritorio((k === "PageUp" ? 1 : -1) * (e.shiftKey ? 0.5 : 0.1)); return true; }
  if (k === "Delete" || k === "Backspace") { apagarSelecionadoEscritorio(); return true; }
  // Empurra um ladrilho pelos eixos do piso.
  const empurrao = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] }[k];
  if (empurrao && escritorioGrupo().size > 1) { moverGrupoEscritorio(empurrao[0] * (e.altKey ? 0.25 : 1), empurrao[1] * (e.altKey ? 0.25 : 1)); return true; }
  if (empurrao) { empurrarSelecionadoEscritorio(...empurrao, e.altKey); return true; }
  return false;
}
// Faixa do editor sobre o mapa.
function renderBarraEditorEscritorio() {
  const el = document.getElementById("office-editor");
  const e = escritorio.edicao;
  if (!el) return;
  el.hidden = !e;
  atualizarFerramentaEditorEscritorio();
  if (!e) { document.getElementById("office-editor-sel")?.remove(); return; }
  const it = e.sel !== null ? e.itens[e.sel] : null;
  cancelAnimationFrame(escritorio.selQuadro || 0);
  acompanharSelecaoEditorEscritorio();
  // Quem administra escolhe a área a editar (mapa geral ou qualquer sala).
  const areas = escritorio.base?.admin ? [["geral", "Praça"], ...ESCRITORIO_PLANTA.ambientes.filter((a) => a.pessoal).map((a) => [a.id, a.nome])] : [];
  const escolha = areas.length ? `<select aria-label="Área que você está editando" onchange="trocarCamadaEditorEscritorio(this.value)">${areas.map(([id, nome]) => `<option value="${id}"${id === e.camada ? " selected" : ""}>${safeText(nome)}</option>`).join("")}</select>` : `<b>Editando ${safeText(escritorioNomeCamada(e.camada))}</b>`;
  const minhaSala = e.camada !== "geral" && escritorioMinhaMesa()?.ambiente.id === e.camada;
  el.innerHTML = `<div class="ofc-editor-info">${escolha}<span>${e.alvos != null ? `Clique nos móveis que o gatilho usa (até 5); clique de novo para tirar · <button type="button" onclick="terminarAlvosGatilhoEscritorio()">Pronto</button>` : e.ferramenta === "camera" ? "Arraste para mover a visão sem mexer nos móveis" : e.trocar != null ? "Escolha no catálogo o novo modelo · Esc cancela" : e.novo && escritorioImagemDe(e.novo)?.tipo === "quadro" ? "Clique no piso encostado na parede alta do fundo · Esc cancela" : e.colar ? `Clique no piso para colar ${e.colar.length} ${e.colar.length === 1 ? "móvel" : "móveis"} · Esc cancela` : e.novo ? `Clique no piso para colocar · R gira · Alt + setas ajusta fino${e.novoAjuste && (e.novoAjuste.dx || e.novoAjuste.dy) ? " (ajustado)" : ""} · Esc cancela` : it ? "Arraste para mudar de lugar · Alt + setas: ajuste fino · R gira · Ctrl+Z desfaz" : "Escolha no catálogo ou selecione um móvel"}</span></div>
<div class="ofc-editor-ferramentas" role="group" aria-label="Ferramentas de construção"><button type="button" aria-pressed="${e.ferramenta !== 'camera'}" onclick="ferramentaEditorEscritorio('selecionar')">Selecionar</button><button type="button" aria-pressed="${e.ferramenta === 'camera'}" onclick="ferramentaEditorEscritorio('camera')" title="Segure Espaço para mover a visão temporariamente">Mover visão</button><button type="button" aria-pressed="${e.grade !== false}" onclick="gradeEditorEscritorio(true)">Grade</button><span class="ofc-construtor" role="group" aria-label="Modo construtor"><button type="button" aria-pressed="${Boolean(escritorio.construtor?.ligado)}" onclick="alternarConstrutorEscritorio()" title="Como o ladrilho de empilhar do Habbo: põe móvel em cima de qualquer coisa, sem bloqueio (B)">Construtor</button>${escritorio.construtor?.ligado ? `<label>Altura <input type="number" min="0" max="${ESCRITORIO_ALTURA_MAX}" step="0.1" inputmode="decimal" value="${escritorio.construtor.altura ?? ""}" placeholder="auto" aria-label="Altura de empilhar (vazio: em cima do que estiver embaixo)" onchange="alturaConstrutorEscritorio(this.value)"></label>` : ""}</span><details><summary>Atalhos</summary><p>Espaço: mover visão · R: girar · Alt + setas: ajuste fino · Page Up/Down: altura · Shift + clique: seleção múltipla · Ctrl/⌘ + D: duplicar · Ctrl/⌘ + Z: desfazer · Esc: cancelar colocação · B: modo construtor.</p></details></div>
<div class="ofc-editor-hist"><button type="button" onclick="desfazerEditorEscritorio()" ${e.passos?.length > 1 ? "" : "disabled"} title="Desfazer (Ctrl+Z)">Desfazer</button><button type="button" onclick="refazerEditorEscritorio()" ${e.futuro?.length ? "" : "disabled"} title="Refazer (Ctrl+Shift+Z)">Refazer</button><details class="ofc-editor-menu"><summary>Opções</summary><div><button type="button" onclick="restaurarPadraoEditorEscritorio()" title="Voltar ao desenho original desta área">Voltar ao padrão</button>${e.camada !== "geral" ? '<button type="button" onclick="guardarTudoEscritorio()" title="Guarda todos os móveis desta sala no inventário (dá para desfazer antes de salvar)">Guardar tudo</button>' : ""}<button type="button" onclick="abrirVersoesEscritorio()" title="Versões salvas antes (para voltar atrás)">Versões</button>${minhaSala ? '<button type="button" onclick="abrirEstiloSalaEscritorio()">Piso e paredes</button>' : ""}</div></details></div>
${it ? (escritorioImagemDe(it[0]) ? `<div class="ofc-editor-sel" hidden><span>${escritorioImagemDe(it[0]).tipo === "quadro" ? "Quadro" : "Tapete"}: ${safeText(escritorioImagemDe(it[0]).nome || "imagem")}</span><button type="button" class="perigo" onclick="apagarSelecionadoEscritorio()">Tirar do mapa</button></div>` : `<div class="ofc-editor-sel" hidden><button type="button" onclick="girarSelecionadoEscritorio()">Girar</button><button type="button" aria-pressed="${Boolean(it[5])}" onclick="alturaSelecionadoEscritorio()">Em cima da mesa</button><button type="button" class="perigo" onclick="apagarSelecionadoEscritorio()">Apagar</button></div>`) : ""}
<div class="ofc-editor-acoes"><button type="button" onclick="sairEditorEscritorio()">Cancelar</button><button type="button" class="ofc-primario" onclick="salvarEditorEscritorio()" ${e.salvando ? "disabled" : ""}>${e.salvando ? "Salvando…" : "Salvar"}</button></div>`;
}
// Catálogo: os móveis do painel por categoria e a busca no catálogo do Habbo.
// A lista do catálogo do painel vem pela API na primeira vez que o editor abre.
let escritorioCatalogo = null;
async function carregarCatalogoEscritorio() {
  if (escritorioCatalogo) return;
  escritorioCatalogo = [];
  try {
    const r = await fetch(mapaArquivo("catalogo.json"), { credentials: "same-origin" });
    escritorioCatalogo = r.ok ? await r.json() : [];
  } catch {}
  if (escritorio.edicao) renderEscritorio();
}
// Computadores que vêm com o painel (para "Editar computador"); entram no
// catálogo como uma categoria própria.
const ESCRITORIO_COMPUTADORES = [
  ["computer_flatscreen", "Computador de mesa"], ["computer_laptop", "Notebook"], ["uni_laptop", "Notebook da faculdade"],
  ["computer_old", "Computador antigo"], ["steampunk_computer", "Computador steampunk"], ["easter_c23_solarpunkcomputer", "Computador solar"],
].map(([classe, nome]) => ({ classe, nome, categoria: "Computadores", giros: classe === "easter_c23_solarpunkcomputer" ? 2 : 4 }));
// Quantos lados o móvel tem (1 = não gira). Do catálogo; sem ele, do desenho já carregado.
function escritorioGirosDe(classe) {
  const m = (escritorioCatalogo || []).find((x) => x.classe === classe) || ESCRITORIO_COMPUTADORES.find((x) => x.classe === classe);
  return m?.giros || 0;
}
function escritorioSeloGiro(giros) {
  if (!giros) return "";
  return giros < 2 ? '<em class="ofc-giro nao" title="Este móvel não gira">Não gira</em>' : `<em class="ofc-giro" title="Gira para ${giros} lados (R)">↻ ${giros} lados</em>`;
}
// Nome em português: o catálogo do Habbo vem em inglês. Traduz as palavras
// mais comuns e põe o substantivo na frente ("Gray Sofa" → "Sofá cinza").
const ESCRITORIO_SUBSTANTIVOS = { table: "Mesa", chair: "Cadeira", tree: "Árvore", lamp: "Luminária", sofa: "Sofá", corner: "Canto", divider: "Divisória", stool: "Banqueta", rug: "Tapete", plant: "Planta", bench: "Banco", shelf: "Prateleira", light: "Luz", lights: "Luzes", desk: "Escrivaninha", seat: "Assento", armchair: "Poltrona", flower: "Flor", flowers: "Flores", fence: "Cerca", floor: "Piso", wall: "Parede", counter: "Balcão", block: "Bloco", pillow: "Almofada", stage: "Palco", bookcase: "Estante", carpet: "Carpete", candles: "Velas", candle: "Vela", throne: "Trono", vase: "Vaso", lantern: "Lanterna", ball: "Bola", bush: "Arbusto", toilet: "Vaso sanitário", lounge: "Espreguiçadeira", cat: "Gato", screen: "Tela", scoreboard: "Placar", drinks: "Bebidas", tea: "Chá", pillar: "Pilar", chandelier: "Lustre", box: "Caixa", rock: "Pedra", bed: "Cama", garden: "Jardim", cushion: "Almofada", fan: "Ventilador", cactus: "Cacto", bonsai: "Bonsai", gate: "Portão", mattress: "Colchão", computer: "Computador", laptop: "Notebook", tv: "TV", fridge: "Geladeira", stove: "Fogão", sink: "Pia", cabinet: "Armário", crate: "Caixote", pot: "Vaso", torch: "Tocha", palm: "Palmeira", jukebox: "Jukebox", clock: "Relógio", mirror: "Espelho", window: "Janela", door: "Porta", statue: "Estátua", fountain: "Fonte", printer: "Impressora", whiteboard: "Quadro branco", bar: "Bar", railing: "Grade" };
const ESCRITORIO_ADJETIVOS = { dark: "escuro", blue: "azul", red: "vermelho", black: "preto", modern: "moderno", yellow: "amarelo", pink: "rosa", white: "branco", coffee: "de centro", green: "verde", large: "grande", glass: "de vidro", gold: "dourado", dining: "de jantar", street: "de rua", side: "lateral", beige: "bege", "(beige)": "bege", small: "pequeno", purple: "roxo", gray: "cinza", grey: "cinza", wooden: "de madeira", kitchen: "de cozinha", picnic: "de piquenique", chinese: "chinês", inflatable: "inflável", folding: "dobrável", ancient: "antigo", marble: "de mármore", executive: "executivo", orange: "laranja", hanging: "suspenso", leather: "de couro", school: "da escola", bathroom: "de banheiro", solid: "sólido", potted: "no vaso", aquamarine: "água-marinha", electric: "elétrico", old: "antigo", office: "de escritório", three: "de três lugares", two: "de dois lugares", suspended: "suspenso", "pool-side": "de piscina", iced: "gelo", round: "redondo", square: "quadrado", long: "comprido", mini: "mini", big: "grande", tall: "alto", low: "baixo", double: "duplo", silver: "prateado", brown: "marrom", wood: "madeira", metal: "de metal", plastic: "de plástico", "&": "e" };
function escritorioNomeMovel(m) {
  if (m.categoria === "Computadores" || /[ãçéíóú]/i.test(m.nome)) return m.nome;
  // Sem nome no catálogo vem a classe ("bling_sofa_mu"): vira palavras.
  const base = /_/.test(m.nome || "") || !m.nome ? String(m.nome || m.classe).replace(/_?c\d+_/g, " ").replace(/_/g, " ") : m.nome;
  const palavras = base.split(/\s+/).filter(Boolean);
  const nomes = [], resto = [];
  for (const p of palavras) {
    const k = p.toLowerCase();
    if (ESCRITORIO_SUBSTANTIVOS[k] && !nomes.length) nomes.push(ESCRITORIO_SUBSTANTIVOS[k]);
    else if (ESCRITORIO_SUBSTANTIVOS[k]) resto.push(ESCRITORIO_SUBSTANTIVOS[k].toLowerCase());
    else if (ESCRITORIO_ADJETIVOS[k]) resto.push(ESCRITORIO_ADJETIVOS[k]);
    else resto.push(p);
  }
  return [...nomes, ...resto].join(" ") || m.nome;
}
// Categorias por uso (as do Habbo misturavam 299 cadeiras e sofás numa só).
const ESCRITORIO_GRUPOS_CATALOGO = [
  ["Recentes", null],
  ["Do escritório", (m) => m.categoria === "Do escritório"],
  ["Vitrine da semana", (m) => (escritorio.base?.economia?.loja?.vitrine || []).includes(m.classe)],
  ["Raros", (m) => escritorioInfoLoja(m.classe).raridade === "raro"],
  ["Muito raros", (m) => escritorioInfoLoja(m.classe).raridade === "muito_raro"],
  ["Lendários", (m) => escritorioInfoLoja(m.classe).raridade === "lendario"],
  ["Computadores", (m) => m.categoria === "Computadores" || /computer|laptop|monitor/.test(m.classe)],
  ["Mesas", (m) => m.categoria === "Mesas" && !/desk/.test(m.classe)],
  ["Escrivaninhas", (m) => /desk/.test(m.classe) && !/bardesk/.test(m.classe)],
  // Pelo nome (o que a peça é), não pela classe: "couch_norja" é um banco.
  ["Cadeiras", (m) => escritorioTipoAssento(m) === "cadeira"],
  ["Poltronas e pufes", (m) => escritorioTipoAssento(m) === "poltrona"],
  ["Sofás", (m) => escritorioTipoAssento(m) === "sofa"],
  ["Bancos e banquetas", (m) => escritorioTipoAssento(m) === "banco"],
  ["Estantes", (m) => m.categoria === "Estantes"],
  ["Luzes", (m) => m.categoria === "Luzes"],
  ["Tapetes", (m) => m.categoria === "Tapetes"],
  ["Plantas", (m) => m.categoria === "Jardim" && /plant|flower|tree|bush|palm|cactus|bonsai|pot/.test(m.classe)],
  ["Jardim e área externa", (m) => m.categoria === "Jardim" && !/plant|flower|tree|bush|palm|cactus|bonsai|pot/.test(m.classe)],
  ["Divisórias", (m) => m.categoria === "Divisórias"],
  ["Física (esteira, gelo, portão, trampolim)", (m) => m.categoria === "Física"],
  ["Gatilhos e efeitos (Wired)", (m) => m.categoria === "Gatilhos"],
  ["Ferramentas (relógio, votos, placar, altura)", (m) => m.categoria === "Ferramentas"],
  ["Barracas e veículos", (m) => m.categoria === "Barracas e veículos"],
  ["Troféus", (m) => m.categoria === "Troféus"],
  ["Camas", (m) => mapaEhCama(m.classe)],
  ["Construção e arquitetura", (m) => m.categoria === "Blocos e materiais" || /pillar|column|railing|stair|wall|fence|block|divider/.test(m.classe)],
  ["Blocos e materiais", (m) => m.categoria === "Blocos e materiais"],
  ["Objetos de estúdio", (m) => m.categoria === "Objetos de estúdio"],
  ["Detalhes de cozinha", (m) => m.categoria === "Detalhes de cozinha"],
  ["Acabamentos", (m) => m.categoria === "Acabamentos"],
  ["Janelas e portas", (m) => /window|door|gate/.test(m.classe)],
  ["Jogos e música", (m) => ["Jogos", "Música", "Festa"].includes(m.categoria)],
  ["Cozinha e bar", (m) => m.categoria === "Cozinha" || /bardesk|bartable|minibar|fridge|drinks/.test(m.classe)],
  ["Na parede (janelas, quadros, luzes)", (m) => m.parede],
  ["Animados (luz, água, fogo…)", (m) => m.anima],
  ["Pisos do acervo", (m) => m.categoria === "Pisos do acervo"],
  ["Quarto e banho", (m) => /bed|bath|toilet|shower|sink|tub\b|wardrobe|dresser/i.test(m.classe + " " + m.nome)],
  ["Lazer (piscina, rede, carro…)", (m) => /pool|jacuzzi|swing|hammock|car\b|bike|boat|surf|ball|trampoline|slide|tent/i.test(m.classe + " " + m.nome)],
  ["Decoração (quadros, estátuas…)", (m) => /statue|sculpture|painting|frame|poster|sign|neon|clock|mirror|globe|vase|aquarium|fountain|trophy|plush|teddy|banner|flag|easel/i.test(m.classe + " " + m.nome)],
  ["Casa e decoração", (m) => ["Casa", "Escritório", "Escola", "Cinema", "Brasil", "Cidade"].includes(m.categoria)],
  // Coleções: peças da mesma linha, que combinam entre si.
  ...[["Escritório executivo", /^(exe_|hc_exe|js_exe|army_c15|modern_c17)/], ["Aconchego (hygge)", /^hygge/], ["Escuro moderno", /^(darkmodern|mafia_c26|lodge_dark)/],
    ["Gamer e fliperama", /^(gaming|arcade|tokyo_c18|vwave|rainyday_c20)/], ["Café e cozinha", /^(sunsetcafe|catcafe|ktchn|dessertcafe|messy_c21)/],
    ["Jardim tropical", /^(bohogarden|jungle|tiki|bolly|lm_palm|fest_c19)/], ["Clássico e dourado", /^(classic|mode_gold|greek|gold_c15)/],
    ["Estúdio", /^studio_/], ["Colorido (cubie)", /^cubie_/], ["Vidro e gelo", /^(glass_|icedblk)/], ["Japonês", /^(jp_|tokyo|skorea)/]]
    .map(([nome, re]) => ["Coleção · " + nome, (m) => re.test(m.classe)]),
];
const ESCRITORIO_POR_PAGINA = 12;
function escritorioTipoAssento(m) {
  if (m.categoria !== "Cadeiras e sofás" && !/armchair|beanbag|lounger|hangingchair/.test(m.classe)) return "";
  const n = String(m.nome).toLowerCase() + " " + m.classe;
  if (/armchair|sofachair|pouf|beanbag|lounger|chaise|hangingchair|hanging chair|cushion|pillow/.test(n)) return "poltrona";
  if (/bench|stool|seat|throne|banquet/.test(n)) return "banco";
  if (/sofa|couch|divan|sohva/.test(n)) return "sofa";
  return "cadeira";
}
function escritorioRecentes() {
  try { return JSON.parse(localStorage.getItem("vybe-escritorio-recentes") || "[]").filter((c) => typeof c === "string").slice(0, 24); } catch { return []; }
}
function escritorioLembrarMovel(classe) {
  if (escritorioImagemDe(classe)) return;
  try { localStorage.setItem("vybe-escritorio-recentes", JSON.stringify([classe, ...escritorioRecentes().filter((c) => c !== classe)].slice(0, 24))); } catch {}
}
function escritorioCatalogoHtml() {
  if (!escritorioCatalogo) { carregarCatalogoEscritorio(); return '<p class="ofc-nota">Carregando catálogo…</p>'; }
  const filtro = escritorio.catalogoCategoria || "";
  const abaImagens = `<button type="button" aria-pressed="${filtro === "Imagens"}" onclick="escritorio.catalogoCategoria='Imagens';renderEscritorio()">Imagens · ${escritorioImagensDaCamada().length}</button>`;
  // Abas do topo: Móveis, Imagens e, na própria sala, Piso e paredes.
  const minha = escritorio.edicao?.camada !== "geral" && escritorioMinhaMesa()?.ambiente.id === escritorio.edicao?.camada;
  // No próprio quarto, os móveis se dividem em duas abas claras: o que é seu
  // (essenciais grátis + inventário) e a loja. O saldo fica sempre à vista.
  const ehMoveis = !["Imagens", "Sala", "Modelos", "Conjuntos"].includes(filtro);
  const aba = minha ? (escritorio.abaQuarto || "meus") : "";
  const botao = (ativo, acao, rotulo) => `<button type="button" aria-pressed="${ativo}" onclick="${acao}">${rotulo}</button>`;
  const meusTotal = minha ? escritorioMeusMoveis().length : 0;
  const abas = `<div class="ofc-cats ofc-cats-topo">${minha
    ? botao(ehMoveis && aba === "meus", "escritorio.abaQuarto='meus';escritorio.catalogoCategoria='';escritorio.catalogoPagina=0;renderEscritorio()", `Meus móveis · ${meusTotal}`)
      + botao(ehMoveis && aba === "loja", "escritorio.abaQuarto='loja';escritorio.catalogoCategoria='';escritorio.catalogoPagina=0;renderEscritorio()", "Loja")
    : botao(ehMoveis, "escritorio.catalogoCategoria='';renderEscritorio()", "Móveis")}${minha ? botao(filtro === "Sala", "escritorio.catalogoCategoria='Sala';renderEscritorio()", "Piso e paredes") : ""}${botao(filtro === "Imagens", "escritorio.catalogoCategoria='Imagens';renderEscritorio()", `Imagens · ${escritorioImagensDaCamada().length}`)}${escritorio.edicao?.camada !== "geral" && !minha ? botao(filtro === "Modelos", "escritorio.catalogoCategoria='Modelos';renderEscritorio()", "Modelos de sala") : ""}${botao(filtro === "Conjuntos", "escritorio.catalogoCategoria='Conjuntos';renderEscritorio()", "Meus conjuntos")}</div>`;
  const loja = minha ? escritorioLojaHtml(aba, ehMoveis) : "";
  if (filtro === "Imagens") return loja + abas + escritorioImagensHtml();
  if (filtro === "Modelos") return abas + escritorioModelosHtml();
  if (filtro === "Conjuntos") return abas + escritorioConjuntosHtml();
  if (filtro === "Sala") return abas + escritorioEstiloSalaHtml();
  return `${loja}${abas}<div class="ofc-busca"><input id="office-catalogo-busca" type="search" placeholder="Buscar: mesa, sofá, planta, luz…" aria-label="Buscar móvel" autocomplete="off" value="${safeText(escritorio.catalogoBusca || "")}" oninput="escritorio.catalogoBusca=this.value;escritorio.catalogoPagina=0;desenharCatalogoEscritorio()"></div>
<label class="ofc-cat-escolha" ${minha && aba === "meus" ? "hidden" : ""}><span>Categoria</span><select onchange="escritorio.catalogoCategoria=this.value;escritorio.catalogoPagina=0;escritorio.catalogoBusca='';renderEscritorio()">${ESCRITORIO_GRUPOS_CATALOGO.map(([nome]) => `<option value="${safeText(nome)}"${((filtro && !["Imagens", "Sala", "Modelos", "Conjuntos"].includes(filtro) ? filtro : "") || (escritorioRecentes().length ? "Recentes" : "Do escritório")) === nome ? " selected" : ""}>${safeText(nome)} · ${escritorioListaCatalogo(nome).length}</option>`).join("")}</select></label>
<div id="office-catalogo-lista"></div>
<p class="ofc-nota">Clique num móvel e depois no piso, ou arraste direto para o mapa. Não achou? <button type="button" class="office-text-button" onclick="buscarMovelEscritorio(document.getElementById('office-catalogo-busca').value)">Buscar no catálogo completo do Habbo</button> (em inglês).</p>
<div id="office-busca-resultados" class="ofc-moveis"></div>`;
}
function escritorioListaCatalogo(grupo) {
  const todas = [...escritorioCatalogo, ...ESCRITORIO_COMPUTADORES];
  if (grupo === "Recentes") { const r = escritorioRecentes(); return r.map((c) => todas.find((m) => m.classe === c) || { classe: c, nome: c.replace(/_/g, " "), categoria: "" }); }
  const f = ESCRITORIO_GRUPOS_CATALOGO.find(([n]) => n === grupo)?.[1];
  const vistos = new Set();
  return todas.filter((m) => f?.(m) && !vistos.has(m.classe) && vistos.add(m.classe)).sort((a, b) => escritorioNomeMovel(a).localeCompare(escritorioNomeMovel(b), "pt-BR"));
}
// Cartão de um móvel no catálogo: miniatura, nome, faixa e o que a loja diz
// (grátis, no inventário, preço, restantes, esgotado, fora da vitrine, só por marco).
function escritorioCartaoMovel(m) {
  const minha = escritorio.edicao?.camada === escritorioMinhaMesa()?.ambiente.id;
  const comprar = minha && escritorio.abaQuarto === "loja";
  const i = escritorio.edicao?.camada !== "geral" ? escritorioInfoLoja(m.classe) : null;
  const indisponivel = i && (comprar || !escritorioPodeColocarMovel(m.classe)) && (i.marco || i.restante === 0 || !i.naVitrine);
  return `<button type="button" class="ofc-movel${indisponivel ? " indisponivel" : ""}" draggable="${escritorioPodeColocarMovel(m.classe)}" ondragstart="arrastarDoCatalogoEscritorio(event,'${safeText(m.classe)}')" ondragend="escritorio.arrastandoCatalogo=null;escritorio.mapa?.previa(null)" onclick="escritorioAcaoMovel('${safeText(m.classe)}', ${comprar})" title="${safeText(escritorioNomeMovel(m))} · clique ou arraste para o mapa"><img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(m.classe)}.png?size=64" alt="" onerror="miniaturaLocalEscritorio(this,'${safeText(m.classe)}')"><span>${safeText(escritorioNomeMovel(m))}</span>${minha && !comprar ? `<em class="ofc-giro">${escritorioSeloQuarto(m.classe)}</em>` : i ? escritorioSeloLoja(m.classe, i, comprar) : ""}${m.parede ? '<em class="ofc-giro">na parede</em>' : escritorioSeloGiro(m.giros)}${m.anima ? '<em class="ofc-giro animado">animado</em>' : ""}</button>`;
}
function escritorioSeloLoja(classe, i, comprar = false) {
  const q = escritorioQuantidadeMovel(classe);
  if (q === Infinity) return '<em class="ofc-giro">Grátis</em>';
  const faixa = i.raridade !== "comum" ? `<em class="ofc-raridade ${safeText(i.raridade)}">${safeText(i.nome)}</em>` : "";
  const tem = q ? `${q} no inventário · ` : "";
  const acao = !comprar && escritorioPodeColocarMovel(classe) ? "Colocar" : i.marco ? "Só por marco" : i.restante === 0 ? "Esgotado" : !i.naVitrine ? "Fora da vitrine" : `Comprar por ${i.preco.toLocaleString("pt-BR")}`;
  const restam = i.restante !== null && i.restante > 0 && !i.marco ? ` · ${i.restante === 1 ? "resta 1" : "restam " + i.restante}` : "";
  return `${faixa}<em class="ofc-giro${["Só por marco", "Esgotado", "Fora da vitrine"].includes(acao) ? " nao" : ""}">${tem}${acao}${restam}</em>`;
}
// O que a loja sabe do móvel: faixa, preço, restantes, se está na vitrine e se
// vem só por marco. Quem não está na tabela é comum (preço único); sem a tabela
// da fase 2, tudo é comum.
function escritorioInfoLoja(classe) {
  const eco = escritorio.base?.economia, loja = eco?.loja;
  const essencial = Boolean(escritorio.base?.quartos?.essenciais.includes(classe));
  const comum = loja?.raridades?.find((r) => r.chave === "comum");
  const base = { classe, raridade: "comum", nome: "Comum", preco: essencial ? 0 : Number(comum?.preco ?? eco?.preco ?? 25), restante: null, marco: null, naVitrine: true, exigeVitrine: false };
  if (!loja?.itens) return base;
  loja.mapa ||= new Map(loja.itens.map((i) => [i.classe, i]));
  const item = loja.mapa.get(classe);
  if (!item) return base;
  const faixa = loja.raridades.find((r) => r.chave === item.raridade);
  const exigeVitrine = Boolean(faixa?.vitrine);
  return { ...base, ...item, nome: faixa?.nome || item.raridade, exigeVitrine, naVitrine: !exigeVitrine || loja.vitrine.includes(classe) };
}
// Cabeçalho da loja (só na própria sala): saldo, faixas, vitrine da semana e inventário.
function escritorioLojaHtml(aba = "loja", mostrarVitrine = true) {
  const c = escritorio.base.economia, loja = c?.loja;
  const faixas = loja?.raridades?.length ? loja.raridades.map((r) => `${r.nome.toLowerCase()} ${r.preco.toLocaleString("pt-BR")}`).join(" · ") : "extras 25 moedas por unidade";
  const marcos = c?.marcos?.length ? `${c.marcos.filter((m) => m.ok).length} de ${c.marcos.length} marcos` : "marcos e conquistas";
  return `<div class="ofc-moedas"><b>${c?.disponivel ? Number(c.saldo).toLocaleString("pt-BR") + " VybeCoins" : "Loja indisponível"}</b><p>Essenciais grátis · ${safeText(faixas)}.${loja ? " Muito raros e lendários só na vitrine da semana; o estoque é de toda a equipe." : ""}</p><div class="ofc-cats ofc-ferramentas"><button type="button" onclick="abrirFichaEscritorio(escritorio.base.eu)">${safeText(marcos)} · ver na ficha</button></div></div>${aba === "loja" && mostrarVitrine ? escritorioVitrineHtml() : ""}`;
}
function escritorioVitrineHtml() {
  const loja = escritorio.base?.economia?.loja;
  if (!loja?.vitrine?.length || !escritorioCatalogo) return "";
  const cartoes = loja.vitrine.map((c) => escritorioCatalogo.find((m) => m.classe === c) || { classe: c, nome: c.replace(/_/g, " "), categoria: "" }).map(escritorioCartaoMovel).join("");
  return `<details class="ofc-vitrine" ${escritorio.vitrineFechada ? "" : "open"} ontoggle="escritorio.vitrineFechada=!this.open"><summary>Vitrine da semana <small>${loja.vitrine.length} móveis · troca na segunda</small></summary><div class="ofc-moveis">${cartoes}</div></details>`;
}
// Lista com páginas (sem rolar sem fim) e busca enquanto digita.
function desenharCatalogoEscritorio() {
  const el = document.getElementById("office-catalogo-lista");
  if (!el || !escritorioCatalogo) return;
  const busca = String(escritorio.catalogoBusca || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const grupo = (!["Imagens", "Sala", "Modelos", "Conjuntos"].includes(escritorio.catalogoCategoria) && escritorio.catalogoCategoria) || (escritorioRecentes().length ? "Recentes" : "Do escritório");
  let lista;
  if (busca) {
    const vistos = new Set();
    const sem = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    lista = [...escritorioCatalogo, ...ESCRITORIO_COMPUTADORES].filter((m) => !vistos.has(m.classe) && vistos.add(m.classe) && (sem(escritorioNomeMovel(m)).includes(busca) || sem(m.nome).includes(busca) || m.classe.includes(busca)));
  } else lista = escritorioListaCatalogo(grupo);
  const minha = escritorio.edicao?.camada !== "geral" && escritorioMinhaMesa()?.ambiente.id === escritorio.edicao?.camada;
  const aba = minha ? (escritorio.abaQuarto || "meus") : "";
  if (aba === "meus") {
    const meus = escritorioMeusMoveis(), cl = new Set(lista.map((m) => m.classe));
    lista = busca ? meus.filter((m) => cl.has(m.classe)) : meus;
  }
  let filtros = "";
  if (aba === "meus" && lista.length) ({ lista, html: filtros } = escritorioFiltrarMeus(lista));
  const paginas = Math.max(1, Math.ceil(lista.length / ESCRITORIO_POR_PAGINA));
  const pag = Math.min(paginas - 1, escritorio.catalogoPagina || 0);
  const cartao = escritorioCartaoMovel;
  el.innerHTML = filtros + (!lista.length && filtros
    ? `<p class="ofc-nota">Nenhum móvel seu com esse filtro.</p>`
    : !lista.length
    ? `<p class="ofc-nota">${aba === "meus" ? (busca ? "Nenhum móvel seu com esse nome." : "Você ainda não tem móveis extras.") + ' <button type="button" class="office-text-button" onclick="escritorio.abaQuarto=\'loja\';renderEscritorio()">Abrir a Loja</button>' : busca ? "Nada com esse nome no catálogo do painel." : grupo === "Recentes" ? "Os móveis que você usar aparecem aqui." : "Nada nesta categoria."}</p>`
    : `<h4>${busca ? `${lista.length} encontrados` : aba === "meus" ? "Meus móveis" : safeText(grupo)}</h4><div class="ofc-moveis">${lista.slice(pag * ESCRITORIO_POR_PAGINA, (pag + 1) * ESCRITORIO_POR_PAGINA).map(cartao).join("")}</div>${paginas > 1 ? `<div class="ofc-paginas"><button type="button" onclick="escritorio.catalogoPagina=${pag - 1};desenharCatalogoEscritorio()" ${pag ? "" : "disabled"} aria-label="Página anterior">‹</button><span>Página ${pag + 1} de ${paginas}</span><button type="button" onclick="escritorio.catalogoPagina=${pag + 1};desenharCatalogoEscritorio()" ${pag + 1 < paginas ? "" : "disabled"} aria-label="Próxima página">›</button></div>` : ""}`);
}
async function buscarMovelEscritorio(q) {
  const el = document.getElementById("office-busca-resultados");
  if (!el || !q.trim()) return;
  el.innerHTML = '<p class="ofc-nota">Buscando…</p>';
  try {
    const r = await fetch("https://www.habboassets.com/imaging/search?" + new URLSearchParams({ type: "furniture", q: q.trim() }));
    const d = await r.json();
    el.innerHTML = (d.results || []).map((m) => `<button type="button" class="ofc-movel" onclick="escolherMovelEscritorio('${safeText(m.name)}')" title="${safeText(m.name)}"><img loading="lazy" src="https://www.habboassets.com/imaging/furniture/${encodeURIComponent(m.name)}.png?size=64" alt=""><span>${safeText(m.name.replace(/_/g, " "))}</span></button>`).join("") || '<p class="ofc-nota">Nada encontrado. Tente outra palavra em inglês.</p>';
  } catch {
    el.innerHTML = '<p class="ofc-nota">O catálogo do Habbo não respondeu. Use os móveis do painel abaixo.</p>';
  }
}
// Prévia ao passar o mouse no editor: o móvel novo (ou o selecionado) onde ele
// iria ficar, verde se cabe e vermelho se não.
async function previaEditorEscritorio(x, y) {
  const e = escritorio.edicao;
  if (!e || x < 0 || escritorioCameraEditor()) return escritorio.mapa?.previa(null);
  escritorio.ultimoPasso = { x, y };
  if (e.colar) { const [cl, dx, dy, d] = e.colar[0]; return escritorio.mapa?.previa(cl, x + dx, y + dy, d, true); }
  if (e.novo && escritorioEhParede(e.novo)) return escritorio.mapa?.previa(null);
  const it = e.novo ? null : e.sel !== null ? e.itens[e.sel] : null;
  const classe = e.novo || it?.[0];
  if (!classe || e.trocar != null) return escritorio.mapa?.previa(null);
  const c = escritorioCantoCamada(e.camada), dir = e.novo ? (e.novoDir ?? 2) : it[3];
  const lx = x - c.x, ly = y - c.y;
  // Móvel novo: a prévia já mostra o ajuste fino (Alt + setas) escolhido.
  const aj = e.novo ? e.novoAjuste || { dx: 0, dy: 0 } : { dx: 0, dy: 0 };
  let cabe = false, px=lx+aj.dx, py=ly+aj.dy, altura=it?.[5] || 0;
  try {
    const d = await escritorio.mapa.medidas(classe,dir);
    if (escritorio.edicao !== e) return;
    // A mesma regra do Habbo de quando solta (escritorioPousoHabbo).
    const construtor = escritorioAlturaConstrutor(x, y);
    const pouso = construtor != null ? { altura: construtor } : d.imagem ? { altura: 0 } : await escritorioPousoHabbo(classe, px, py, dir, e.novo ? null : { i: e.sel });
    altura = pouso.altura ?? altura;
    cabe = !pouso.erro && await escritorioCabe(classe,px,py,dir,e.sel !== null ? {i:e.sel} : null,false);
  } catch {}
  if (escritorio.edicao !== e || escritorioCameraEditor() || escritorio.ultimoPasso?.x !== x || escritorio.ultimoPasso?.y !== y || (e.novo || e.itens[e.sel]?.[0]) !== classe) return;
  escritorio.mapa?.previa(classe, px+c.x, py+c.y, dir, cabe, altura);
}
function escolherMovelEscritorio(classe) {
  if (!escritorio.edicao || !/^[a-z0-9_]+$/i.test(classe)) return;
  if(!escritorioPodeColocarMovel(classe)) return escritorioAviso("Compre este móvel na loja antes de colocá-lo.");
  escritorioLembrarMovel(classe);
  // Escolher uma peça encerra a ferramenta persistente de câmera.
  const e = escritorio.edicao;
  e.ferramenta = "selecionar";
  atualizarFerramentaEditorEscritorio();
  // Trocando o modelo da mesa ou do computador: mesmo lugar, outro móvel.
  if (e.trocar != null && e.itens[e.trocar]) {
    const it = e.itens[e.trocar];
    escritorioCabe(classe, it[1], it[2], it[3]).then((cabe) => {
      if (!cabe) return escritorioAviso("Esse modelo não cabe no lugar do atual. Escolha outro ou apague o atual e coloque o novo.");
      it[0] = classe;
      e.sel = e.trocar;
      e.trocar = null;
      escritorioAviso("Trocado. Clique em Salvar para manter.");
      escritorioEditorMudou();
    }).catch(() => escritorioAviso("Esse móvel não carregou."));
    return;
  }
  escritorio.edicao.novo = classe;
  escritorio.edicao.novoDir = 2;
  escritorio.edicao.novoAjuste = null;
  escritorio.edicao.sel = null;
  escritorio.mapa?.destacar(null);
  escritorio.mapa?.medidas(classe, 2).catch(() => escritorioAviso("Esse móvel não carregou."));
  renderBarraEditorEscritorio();
  escritorioAviso("Clique no piso para colocar.");
}

// Sem a foto do site, desenha a miniatura com a arte guardada no painel.
async function miniaturaLocalEscritorio(img, classe) {
  img.onerror = null;
  try {
    const m = await mapaCarregarMovel(classe);
    const v = m.dados.visualizations.find((x) => x.size === 64);
    const dir = Number(Object.keys(v?.directions || { 2: 1 })[0]) || 0;
    const d = mapaDesenharMovel(m, mapaDirecaoValida(m.dados, 2) ?? dir, 0, 0);
    if (d) img.src = d.canvas.toDataURL();
  } catch {
    img.style.visibility = "hidden";
  }
}

// Imagens da equipe: a pessoa sobe um PNG/JPG/WEBP e usa como quadro (na
// parede alta da própria sala) ou tapete (no piso). O servidor confere dono,
// tipo do arquivo e tamanho; aqui só se reduz a imagem grande antes de enviar.
function escritorioImagemDe(classe) {
  const m = /^vybeimg_(\d+)$/.exec(String(classe || ""));
  return m ? (escritorio.base?.mapa?.imagens || []).find((i) => i.id === m[1]) || null : null;
}
function escritorioImagensDaCamada() {
  const camada = escritorio.edicao?.camada;
  return (escritorio.base?.mapa?.imagens || []).filter((i) => i.camada === camada);
}
function escritorioUrlImagem(id) {
  return ESCRITORIO_PLANTA.urlImagem ? ESCRITORIO_PLANTA.urlImagem(id) : "/api/painel?area=escritorio&acao=imagem&id=" + encodeURIComponent(id);
}
// Lugar do quadro na parede: dir 4 = parede de trás (ly 0), dir 2 = parede da
// esquerda (lx 0). Fica inteiro na sala, fora da porta e sem cobrir outro.
function escritorioLugarQuadro(classe, lx, ly, ignorar = -1, dirFixa = null) {
  const e = escritorio.edicao, img = escritorioImagemDe(classe);
  const a = escritorioAmbienteDoQuarto(e.camada);
  if (!img || !a?.pessoal) return { erro: "Quadro só nas salas individuais." };
  const L = a.x1 - a.x0;
  let dir = dirFixa;
  // Quadro só na parede alta da sala (a do prédio): a de trás nas salas de
  // cima, a da esquerda nas da lateral.
  const altas = a.alta || ["y0", "x0"];
  if (dir == null) dir = ly === 0 && altas.includes("y0") ? 4 : lx === 0 && altas.includes("x0") ? 2 : null;
  if (dir == null) return { erro: altas.includes("y0") ? "Clique no piso encostado na parede alta de trás." : "Clique no piso encostado na parede alta da esquerda." };
  const ini = dir === 4 ? lx : ly;
  if (ini < 0 || ini + img.largura > L) return { erro: "O quadro não cabe aí: chegue mais para o canto." };
  if (!altas.includes(dir === 4 ? "y0" : "x0")) return { erro: "Essa parede é baixa: o quadro vai na parede alta." };
  const outro = e.itens.findIndex((it, i) => {
    if (i === ignorar || it[3] !== dir) return false;
    const o = escritorioImagemDe(it[0]);
    if (o?.tipo !== "quadro") return false;
    const oi = dir === 4 ? it[1] : it[2];
    return ini < oi + o.largura && oi < ini + img.largura;
  });
  if (outro >= 0) return { erro: "Já tem um quadro aí." };
  return dir === 4 ? { lx: ini, ly: 0, dir } : { lx: 0, ly: ini, dir };
}
function escritorioQuadroCobre(it, lx, ly) {
  const img = escritorioImagemDe(it[0]);
  if (!img) return false;
  return it[3] === 4 ? ly === 0 && lx >= it[1] && lx < it[1] + img.largura : lx === 0 && ly >= it[2] && ly < it[2] + img.largura;
}
function escritorioImagensHtml() {
  const e = escritorio.edicao;
  const geral = e?.camada === "geral";
  const lista = escritorioImagensDaCamada();
  const tamanhos = (max) => Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  return `<form class="ofc-imagem-form" onsubmit="event.preventDefault();enviarImagemEscritorio(this)">
<label>Imagem (PNG, JPG ou WEBP)<input type="file" name="arquivo" accept="image/png,image/jpeg,image/webp" required></label>
<label>Usar como<select name="tipo" onchange="alturasImagemEscritorio(this.form)">${geral ? "" : '<option value="quadro">Quadro na parede</option>'}<option value="tapete">Tapete no chão</option></select></label>
<div class="ofc-imagem-tam"><label>Largura<select name="largura">${tamanhos(6).replace('value="3"', 'value="3" selected')}</select></label><span>×</span><label>Altura<select name="altura">${tamanhos(geral ? 6 : 3).replace('value="2"', 'value="2" selected')}</select></label><small>ladrilhos</small></div>
<label>Nome (opcional)<input name="nome" maxlength="80" placeholder="Ex.: logo da Vybe"></label>
<button class="workflow-primary" ${e?.enviando ? "disabled" : ""}>${e?.enviando ? "Enviando…" : "Enviar imagem"}</button>
<p class="ofc-nota">${geral ? "No mapa geral, só tapetes." : "Quadro fica pintado na parede alta do fundo da sala; tapete fica no chão."} Até 1,5 MB.</p></form>
<h4>Imagens ${geral ? "do mapa" : "desta sala"}</h4>
<div class="ofc-moveis">${lista.map((i) => `<div class="ofc-imagem"><button type="button" class="ofc-movel" onclick="escolherMovelEscritorio('vybeimg_${i.id}')" title="Colocar ${safeText(i.nome || "imagem")}"><img loading="lazy" src="${escritorioUrlImagem(i.id)}" alt=""><span>${i.tipo === "quadro" ? "Quadro" : "Tapete"} ${i.largura}×${i.altura}${i.nome ? " · " + safeText(i.nome) : ""}</span></button><button type="button" class="ofc-imagem-apagar" onclick="apagarImagemEscritorio('${i.id}')" aria-label="Apagar a imagem ${safeText(i.nome || "")}">Apagar</button></div>`).join("") || '<p class="ofc-nota">Nenhuma imagem ainda.</p>'}</div>`;
}
// Quadro tem até 3 de altura (a parede); tapete, até 6.
function alturasImagemEscritorio(form) {
  const max = form.tipo.value === "quadro" ? 3 : 6, atual = Math.min(max, Number(form.altura.value) || 2);
  form.altura.innerHTML = Array.from({ length: max }, (_, i) => `<option value="${i + 1}"${i + 1 === atual ? " selected" : ""}>${i + 1}</option>`).join("");
}
// Imagem grande é reduzida (lado maior até 1024 px) antes de enviar.
function escritorioPrepararImagem(arquivo) {
  return new Promise((ok, erro) => {
    if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) return erro(new Error("Use uma imagem PNG, JPG ou WEBP."));
    const leitor = new FileReader();
    leitor.onerror = () => erro(new Error("Não deu para ler a imagem."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => erro(new Error("Essa imagem não abriu. Tente outro arquivo."));
      img.onload = () => {
        const lado = Math.max(img.naturalWidth, img.naturalHeight);
        if (arquivo.size <= 1572864 && lado <= 1600) return ok(String(leitor.result).split(",")[1]);
        const k = 1024 / lado, c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const dados = c.toDataURL(arquivo.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.88).split(",")[1];
        if (dados.length * 0.75 > 1572864) return erro(new Error("A imagem continua grande demais. Use uma menor."));
        ok(dados);
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}
async function enviarImagemEscritorio(form) {
  const e = escritorio.edicao;
  if (!e || e.enviando) return;
  if (escritorio.base.demo) return escritorioAviso("A demonstração não guarda imagens.");
  const arquivo = form.arquivo.files?.[0];
  if (!arquivo) return escritorioAviso("Escolha uma imagem.");
  const pedido = { camada: e.camada, tipo: form.tipo.value, largura: Number(form.largura.value), altura: Number(form.altura.value), nome: form.nome.value.trim() };
  e.enviando = true;
  renderEscritorio();
  try {
    const dados = await escritorioPrepararImagem(arquivo);
    const r = await escritorioApi("imagem", { ...pedido, dados });
    escritorio.base.mapa.imagens = [...(escritorio.base.mapa.imagens || []), r.imagem];
    escritorio.mapa?.registrarImagem(r.imagem);
    escritorioAviso("Imagem enviada. Clique nela para colocar.");
  } catch (erro) {
    escritorioAviso(erro.message);
  }
  e.enviando = false;
  renderEscritorio();
}
async function apagarImagemEscritorio(id) {
  const e = escritorio.edicao;
  if (!e || !confirm("Apagar esta imagem? Ela sai do mapa também.")) return;
  if (escritorio.base.demo) return escritorioAviso("A demonstração não apaga imagens.");
  try {
    const r = await escritorioApi("imagem-apagar", { id });
    const classe = "vybeimg_" + id;
    escritorio.base.mapa.imagens = (escritorio.base.mapa.imagens || []).filter((i) => i.id !== String(id));
    // O servidor já tirou a imagem da área salva; a edição aberta acompanha.
    if (r.imagem.versao) { escritorio.base.mapa.camadas[r.imagem.camada] = { itens: r.imagem.itens, versao: r.imagem.versao, em: new Date().toISOString() }; if (e.camada === r.imagem.camada) e.versao = r.imagem.versao; }
    e.itens = e.itens.filter((it) => it[0] !== classe);
    e.sel = null;
    escritorioEditorMudou();
    renderEscritorio();
    escritorioAviso("Imagem apagada.");
  } catch (erro) {
    escritorioAviso(erro.message);
  }
}

function trocarCamadaEditorEscritorio(camada) {
  const e = escritorio.edicao;
  if (!e || camada === e.camada) return;
  if (e.mudou && !confirm("Descartar as mudanças em " + escritorioNomeCamada(e.camada) + "?")) return renderBarraEditorEscritorio();
  escritorio.edicao = null;
  abrirEditorEscritorio(camada);
}

// Arrastar um móvel da área em edição: pega no aperto, mostra onde vai cair
// (verde cabe, vermelho não) e larga ao soltar.
function pegarNoEditorEscritorio(x, y, fx, fy) {
  if (escritorioCameraEditor()) return false;
  if (escritorioPintando() && escritorioPincel().ferramenta !== "balde") { escritorio.pintandoArrasto = true; pintarNaSalaEscritorio(x, y, fx, fy); return true; }
  const e = escritorio.edicao;
  if (!e || e.trocar != null || !escritorio.mapa) return false;
  if (e.colar) return false;
  if (e.novo) return false;
  const c = escritorioCantoCamada(e.camada), lx = x - c.x, ly = y - c.y;
  // Escolhendo os móveis de um gatilho: o clique põe ou tira o ladrilho.
  if (e.alvos != null) { escolherAlvoGatilhoEscritorio(lx, ly); return true; }
  // Shift + arrastar no piso livre: caixa de seleção.
  const debaixo = escritorio.mapa.moveisEm(x, y).find((m) => m.origem?.camada === e.camada);
  if (escritorio.shift && !debaixo) { e.caixa = { x0: x, y0: y, x1: x, y1: y }; return true; }
  // Apertou num móvel que já está no grupo: arrasta o grupo inteiro.
  if (debaixo && escritorioGrupo().size > 1 && escritorioGrupo().has(debaixo.origem.i) && !escritorio.shift) {
    e.arrastoGrupo = { x0: x, y0: y, dx: 0, dy: 0 };
    return true;
  }
  let i = e.itens.findIndex((it) => escritorioImagemDe(it[0])?.tipo === "quadro" && escritorioQuadroCobre(it, lx, ly));
  if (i < 0) i = escritorio.mapa.moveisEm(x, y).find((m) => m.origem?.camada === e.camada)?.origem.i ?? -1;
  if (i < 0) return false;
  const it = e.itens[i];
  e.sel = i;
  e.arrasto = { i, dx: lx - Math.floor(it[1]), dy: ly - Math.floor(it[2]), alvo: null };
  escritorio.mapa.destacar({ camada: e.camada, i });
  renderBarraEditorEscritorio();
  return true;
}
function cancelarArrastoEditorEscritorio() {
  const e = escritorio.edicao;
  if (e) { e.arrasto = null; e.arrastoGrupo = null; e.caixa = null; }
  escritorio.pintandoArrasto = false;
  escritorio.mapa?.previa(null);
}
async function arrastarNoEditorEscritorio(x, y, fx, fy) {
  if (escritorio.pintandoArrasto) { pintarNaSalaEscritorio(x, y, fx, fy); return; }
  const e = escritorio.edicao;
  if (e?.caixa) { e.caixa.x1 = x; e.caixa.y1 = y; escritorioGrupoDaCaixa(); return; }
  if (e?.arrastoGrupo) { e.arrastoGrupo.dx = x - e.arrastoGrupo.x0; e.arrastoGrupo.dy = y - e.arrastoGrupo.y0; escritorioAviso(`Movendo ${escritorioGrupo().size} móveis: ${e.arrastoGrupo.dx >= 0 ? "+" : ""}${e.arrastoGrupo.dx}, ${e.arrastoGrupo.dy >= 0 ? "+" : ""}${e.arrastoGrupo.dy}`); return; }
  const a = e?.arrasto;
  if (!a) return;
  const it = e.itens[a.i], c = escritorioCantoCamada(e.camada);
  if (escritorioImagemDe(it[0])?.tipo === "quadro") return;
  const nx = x - c.x - a.dx, ny = y - c.y - a.dy;
  if (a.alvo && a.alvo.nx === nx && a.alvo.ny === ny) return;
  a.alvo = { nx, ny, cabe: false };
  let cabe = false;
  try { cabe = it[5] ? true : await escritorioCabe(it[0], nx, ny, it[3], { i: a.i }); } catch {}
  if (a.alvo.nx !== nx || a.alvo.ny !== ny) return;
  a.alvo.cabe = cabe;
  escritorio.mapa.previa(it[0], nx + c.x, ny + c.y, it[3], cabe);
}
async function soltarNoEditorEscritorio(x, y, moveu) {
  if (escritorio.pintandoArrasto) { escritorio.pintandoArrasto = false; return; }
  const e = escritorio.edicao;
  if (e?.caixa) { e.caixa = null; escritorioGrupoDaCaixa(true); return; }
  if (e?.arrastoGrupo) { const g = e.arrastoGrupo; e.arrastoGrupo = null; if (moveu) await moverGrupoEscritorio(g.dx, g.dy); return; }
  const a = e?.arrasto;
  if (!a) return;
  e.arrasto = null;
  escritorio.mapa?.previa(null);
  if (!moveu) return renderBarraEditorEscritorio();
  const it = e.itens[a.i], c = escritorioCantoCamada(e.camada);
  if (escritorioEhParede(it[0])) {
    const lugar = escritorioLugarParede(x, y, x + 0.5, y + 0.5);
    if (!lugar) return escritorioAviso("Solte junto de uma parede.");
    it[1] = lugar.lx; it[2] = lugar.ly; it[3] = lugar.dir;
    return escritorioEditorMudou();
  }
  if (escritorioImagemDe(it[0])?.tipo === "quadro") {
    const lugar = escritorioLugarQuadro(it[0], x - c.x, y - c.y, a.i);
    if (lugar.erro) return escritorioAviso(lugar.erro);
    it[1] = lugar.lx; it[2] = lugar.ly; it[3] = lugar.dir;
    return escritorioEditorMudou();
  }
  const nx = x - c.x - a.dx, ny = y - c.y - a.dy;
  let cabe = false;
  // Solto em cima de outro móvel: assenta no topo dele, de qualquer tamanho
  // (armário sobre bancada, como no Habbo); no chão, volta ao chão.
  let imagem = false;
  try { imagem = Boolean((await escritorio.mapa.medidas(it[0], it[3])).imagem); } catch {}
  // Como no Habbo (moveFurniTo): assenta no topo mais alto do que fica
  // embaixo, ou volta ao chão; recusa onde não dá para empilhar.
  const construtor = escritorioAlturaConstrutor(Math.floor(x), Math.floor(y));
  const pouso = imagem ? { altura: 0 } : construtor != null ? { altura: construtor } : await escritorioPousoHabbo(it[0], nx, ny, it[3], { i: a.i });
  if (pouso.erro) return escritorioAviso(pouso.erro);
  try { cabe = await escritorioCabe(it[0], nx, ny, it[3], { i: a.i }, false); } catch {}
  if (!cabe) return escritorioAviso("Não cabe aí. Solte dentro de " + escritorioNomeCamada(e.camada) + ".");
  const ox = it[1], oy = it[2], estavaEmCima = it[5];
  it[1] = nx; it[2] = ny; it[5] = pouso.altura;
  if (!estavaEmCima) await escritorioLevarOQueEstaEmCima(a.i, ox, oy, nx - ox, ny - oy);
  escritorioEditorMudou();
}
// Foto de um passo da edição: os móveis e a planta desenhada (desfazer volta os dois).
// Troféu: grava nome, data e dedicatória no 7º campo do item (o servidor confere).
function gravarTrofeuEscritorio() {
  const e = escritorio.edicao, it = e?.itens[e.sel];
  if (!it) return;
  const cfg = it[6] && typeof it[6] === "object" ? it[6] : {};
  const dono = escritorioNomeCamada(e.camada).replace(/^Sala de /, "");
  openWorkflowModal(`<div class="workflow-kicker">Troféu</div><h2 class="workflow-title">Gravar o troféu</h2>
<form class="ofc-gatilho" onsubmit="event.preventDefault();salvarTrofeuEscritorio(this)">
<label>Para quem<input name="n" maxlength="40" value="${safeText(cfg.n || dono)}" required></label>
<label>Dedicatória<input name="t" maxlength="100" value="${safeText(cfg.t || "")}" placeholder="Pelo melhor mês de entregas"></label>
<div class="workflow-actions"><button type="submit" class="workflow-primary">Gravar</button></div></form>`);
}
function guardarVisualManequimEscritorio() {
  const e = escritorio.edicao, it = e?.itens[e.sel], f = escritorio.perfil?.figura;
  if (!it || !f) return escritorioAviso("Monte seu personagem antes de guardar o visual.");
  it[6] = { f };
  escritorioEditorMudou();
  escritorioAviso("Seu visual ficou guardado no manequim. Salve para confirmar.");
}
function salvarTrofeuEscritorio(form) {
  const e = escritorio.edicao, it = e?.itens[e.sel];
  if (!it) return closeWorkflowModal();
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  it[6] = { n: form.elements.n.value.trim().slice(0, 40), t: form.elements.t.value.trim().slice(0, 100), d: it[6]?.d || hoje };
  closeWorkflowModal();
  escritorioEditorMudou();
}
function escritorioFotoEdicao(e) { return JSON.stringify({ itens: e.itens, celdas: e.celdas ?? null }); }
function escritorioVoltarPasso(de, para) {
  const e = escritorio.edicao;
  if (!e || de.length < (de === e.passos ? 2 : 1)) return;
  let foto;
  if (de === e.passos) { e.futuro.push(e.passos.pop()); foto = e.passos.at(-1); }
  else { foto = e.futuro.pop(); e.passos.push(foto); }
  const f = JSON.parse(foto), celdas = f.celdas ?? undefined, plantaMudou = celdas !== e.celdas;
  e.itens = f.itens; e.celdas = celdas;
  e.sel = null;
  escritorio.mapa?.destacar(null);
  escritorioEditorMudou(true);
  if (plantaMudou) escritorioRedesenharMapa();
}
function desfazerEditorEscritorio() { const e = escritorio.edicao; if (e) escritorioVoltarPasso(e.passos, e.futuro); }
function refazerEditorEscritorio() { const e = escritorio.edicao; if (e) escritorioVoltarPasso(e.futuro, e.passos); }
async function duplicarSelecionadoEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.sel === null) return;
  if (escritorioGrupo().size > 1) { copiarSelecaoEscritorio(true); return colarEscritorio(); }
  const it = e.itens[e.sel];
  if (escritorioImagemDe(it[0])) return escritorioAviso("Imagens não se duplicam; envie outra na aba Imagens.");
  if (!escritorioInventarioPara([it])) return;
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
    if (await escritorioCabe(it[0], it[1] + dx, it[2] + dy, it[3], null, !it[5])) {
      if (escritorio.edicao !== e || !escritorioInventarioPara([it])) return;
      e.itens.push([it[0], it[1] + dx, it[2] + dy, it[3], it[4] || 0, it[5] || 0]);
      e.sel = e.itens.length - 1;
      escritorioAviso("Cópia criada. Arraste para o lugar certo.");
      return escritorioEditorMudou();
    }
  }
  escritorioAviso("Não há espaço livre ao lado para a cópia.");
}
function restaurarPadraoEditorEscritorio() {
  const e = escritorio.edicao;
  if (!e || !confirm("Voltar " + escritorioNomeCamada(e.camada) + " ao desenho original? Você ainda pode desfazer antes de salvar.")) return;
  const a = escritorioAmbienteDoQuarto(e.camada);
  if(escritorio.perfil?.quarto_configurado && e.camada!=="geral") {aplicarModeloSalaEscritorio("trabalho");return;}
  e.itens = e.camada === "geral" ? escritorioMoveisDaCena(ESCRITORIO_PRACA) : escritorioMoveisDaSala(a).map(([cl, x, y, ...r]) => [cl, x - a.x0, y - a.y0, ...r]);
  e.sel = null;
  escritorio.mapa?.destacar(null);
  escritorioEditorMudou();
}
// Arrastar do catálogo direto para o mapa.
function arrastarDoCatalogoEscritorio(ev, classe) {
  if(!escritorioPodeColocarMovel(classe)) {ev.preventDefault();return;}
  if (!escritorio.edicao) return;
  escritorio.arrastandoCatalogo = classe;
  escritorioLembrarMovel(classe);
  ev.dataTransfer.effectAllowed = "copy";
  ev.dataTransfer.setData("text/plain", classe);
}
document.addEventListener?.("dragover", (ev) => {
  const classe = escritorio.arrastandoCatalogo, e = escritorio.edicao;
  if (!classe || !e || !ev.target.closest?.("#office-map")) return;
  ev.preventDefault();
  ev.dataTransfer.dropEffect = "copy";
  const t = escritorio.mapa.ladrilhoEm(ev.clientX, ev.clientY);
  if (escritorio.arrastoCatalogoEm === t.x + "," + t.y) return;
  escritorio.arrastoCatalogoEm = t.x + "," + t.y;
  const c = escritorioCantoCamada(e.camada);
  escritorioCabe(classe, t.x - c.x, t.y - c.y, 2).then((cabe) => escritorio.mapa?.previa(classe, t.x, t.y, 2, cabe)).catch(() => {});
});
document.addEventListener?.("drop", (ev) => {
  const classe = escritorio.arrastandoCatalogo, e = escritorio.edicao;
  if (!classe || !e || !ev.target.closest?.("#office-map")) return;
  ev.preventDefault();
  escritorio.arrastandoCatalogo = null;
  escritorio.arrastoCatalogoEm = "";
  const t = escritorio.mapa.ladrilhoEm(ev.clientX, ev.clientY);
  e.novo = classe;
  e.sel = null;
  cliqueEditorEscritorio(t.x + 0.5, t.y + 0.5);
});
// Barrinha ao lado do móvel selecionado (girar, duplicar, em cima da mesa,
// apagar), acompanhando o mapa enquanto ele se mexe.
function acompanharSelecaoEditorEscritorio() {
  const principal = document.querySelector(".ofc-principal");
  let barra = document.getElementById("office-editor-sel");
  const e = escritorio.edicao, it = e && e.sel !== null ? e.itens[e.sel] : null;
  if (!it || !principal || !escritorio.mapa) { barra?.remove(); escritorio.selQuadro = 0; return; }
  if (!barra) {
    barra = document.createElement("div");
    barra.id = "office-editor-sel";
    barra.className = "ofc-editor-flutua";
    barra.setAttribute("role", "toolbar");
    barra.setAttribute("aria-label", "Móvel selecionado");
    principal.append(barra);
  }
  const img = escritorioImagemDe(it[0]);
  const giros = escritorioGirosDe(it[0]);
  const grupo = escritorioGrupo().size;
  const chave = `${e.sel}|${it[0]}|${it[5]}|${giros}|${grupo}`;
  if (barra.dataset.chave !== chave) {
    barra.dataset.chave = chave;
    barra.innerHTML = grupo > 1
      ? `<span class="ofc-grupo-n">${grupo} móveis</span><span class="ofc-fino" role="group" aria-label="Mover o grupo ¼ de ladrilho"><button type="button" onclick="moverGrupoEscritorio(-0.25,0)" aria-label="Para cima e esquerda">↖</button><button type="button" onclick="moverGrupoEscritorio(0,-0.25)" aria-label="Para cima e direita">↗</button><button type="button" onclick="moverGrupoEscritorio(0,0.25)" aria-label="Para baixo e esquerda">↙</button><button type="button" onclick="moverGrupoEscritorio(0.25,0)" aria-label="Para baixo e direita">↘</button></span><button type="button" onclick="duplicarSelecionadoEscritorio()" title="Duplicar (Ctrl+D)">Duplicar</button><button type="button" onclick="copiarSelecaoEscritorio()" title="Copiar para colar em outra sala (Ctrl+C)">Copiar</button><button type="button" onclick="salvarConjuntoEscritorio()">Guardar conjunto</button><button type="button" class="perigo" onclick="apagarSelecionadoEscritorio()">Apagar todos</button>`
      : escritorioEhParede(it[0])
      ? `<button type="button" onclick="empurrarSelecionadoEscritorio(0,-1,true)" title="Subir (Alt + ↑)">Subir</button><button type="button" onclick="empurrarSelecionadoEscritorio(0,1,true)" title="Descer (Alt + ↓)">Descer</button><button type="button" onclick="empurrarSelecionadoEscritorio(-1,0,true)" aria-label="Deslizar para um lado">◀</button><button type="button" onclick="empurrarSelecionadoEscritorio(1,0,true)" aria-label="Deslizar para o outro lado">▶</button><button type="button" onclick="copiarSelecaoEscritorio()">Copiar</button><button type="button" class="perigo" onclick="apagarSelecionadoEscritorio()">Apagar</button>`
      : img
      ? `<button type="button" class="perigo" onclick="apagarSelecionadoEscritorio()">Tirar do mapa</button>`
      : `${typeof ESCRITORIO_GATILHOS !== "undefined" && ESCRITORIO_GATILHOS[it[0]] ? '<button type="button" onclick="configurarGatilhoEscritorio()" title="Escolher móveis, texto ou tempo">Configurar</button>' : ""}${["trofeu", "cadeado"].includes(mapaFisica(it[0]).logica) ? '<button type="button" onclick="gravarTrofeuEscritorio()" title="Nome, data e dedicatória, como no Habbo">Gravar</button>' : ""}${mapaFisica(it[0]).logica === "manequim" ? '<button type="button" onclick="guardarVisualManequimEscritorio()" title="Guarda o seu visual atual no manequim">Guardar meu visual</button>' : ""}${giros === 1 ? '<button type="button" disabled title="Este móvel não gira">Não gira</button>' : `<button type="button" onclick="girarSelecionadoEscritorio()" title="Girar (R)${giros ? ` · ${giros} lados` : ""}">↻ Girar${giros ? ` · ${giros}` : ""}</button>`}<button type="button" onclick="duplicarSelecionadoEscritorio()" title="Duplicar (Ctrl+D)">Duplicar</button><span class="ofc-altura" role="group" aria-label="Altura da peça (como o ladrilho de empilhar do Habbo)"><button type="button" onclick="alturaLivreEscritorio(-0.1)" aria-label="Descer a peça" title="Descer (Page Down; Shift desce mais)">−</button><span title="Altura em níveis">${(Math.round((it[5] || 0) * 100) / 100).toLocaleString("pt-BR")}</span><button type="button" onclick="alturaLivreEscritorio(0.1)" aria-label="Subir a peça" title="Subir (Page Up; Shift sobe mais)">+</button><button type="button" onclick="noTopoEscritorio()" title="Põe a peça em cima do que está embaixo dela">No topo</button><button type="button" onclick="noChaoEscritorio()" ${it[5] ? "" : "disabled"} title="Volta a peça para o chão">No chão</button></span>${/_recolorable$/.test(it[0]) ? `<span class="ofc-cores-bloco" role="group" aria-label="Cor do bloco">${MAPA_CORES_BLOCO.map((cor, i) => `<button type="button" style="--cor:${cor}" aria-label="Cor ${i + 1}" aria-pressed="${it[4] >= 100 && Math.floor((it[4] - 100) / 5) === i}" onclick="corBlocoEscritorio(${i})"></button>`).join("")}</span>` : ""}<span class="ofc-fino" role="group" aria-label="Ajuste fino (Alt + setas)" title="Ajuste fino: um quarto de ladrilho (Alt + setas)"><button type="button" onclick="empurrarSelecionadoEscritorio(-1,0,true)" aria-label="Ajuste fino para cima e esquerda">↖</button><button type="button" onclick="empurrarSelecionadoEscritorio(0,-1,true)" aria-label="Ajuste fino para cima e direita">↗</button><button type="button" onclick="empurrarSelecionadoEscritorio(0,1,true)" aria-label="Ajuste fino para baixo e esquerda">↙</button><button type="button" onclick="empurrarSelecionadoEscritorio(1,0,true)" aria-label="Ajuste fino para baixo e direita">↘</button></span><button type="button" onclick="trocarModeloEditorEscritorio()" title="Trocar por outro modelo no mesmo lugar">Trocar</button><button type="button" onclick="copiarSelecaoEscritorio()" title="Copiar (Ctrl+C)">Copiar</button><button type="button" class="perigo" onclick="apagarSelecionadoEscritorio()" title="${e.camada === 'geral' ? 'Tirar do mapa' : 'Guardar no inventário'} (Delete)">${e.camada === 'geral' ? 'Remover' : 'Guardar'}</button>`;
  }
  const c = escritorioCantoCamada(e.camada), base = principal.getBoundingClientRect();
  const p = escritorio.mapa.naJanela(it[1] + c.x + 0.5, it[2] + c.y + 0.5);
  barra.style.left = Math.max(8, Math.min(base.width - barra.offsetWidth - 8, p.x - base.left - barra.offsetWidth / 2)) + "px";
  barra.style.top = Math.max(8, p.y - base.top + 24) + "px";
  escritorio.selQuadro = requestAnimationFrame(acompanharSelecaoEditorEscritorio);
}
function trocarModeloEditorEscritorio() {
  const e = escritorio.edicao;
  if (!e || e.sel === null) return;
  e.trocar = e.sel;
  renderBarraEditorEscritorio();
  escritorioAviso("Escolha no catálogo o novo modelo.");
}

async function girarNovoEscritorio() {
  const e = escritorio.edicao;
  if (!e?.novo) return;
  const { direcoes } = await escritorio.mapa.medidas(e.novo, e.novoDir ?? 2);
  const lista = [0, 2, 4, 6].filter((d) => direcoes.includes(d));
  if (lista.length < 2) return escritorioAviso("Esse móvel não gira.");
  const atual = lista.includes(e.novoDir) ? e.novoDir : lista[0];
  e.novoDir = lista[(lista.indexOf(atual) + 1) % lista.length];
  const ult = escritorio.ultimoPasso;
  if (ult) previaEditorEscritorio(ult.x, ult.y);
}

function ajustarNovoEscritorio(dx, dy) {
  const e = escritorio.edicao;
  if (!e?.novo) return;
  const a = e.novoAjuste || { dx: 0, dy: 0 };
  // Até ¾ de ladrilho para cada lado: mais que isso, é só mover o mouse.
  e.novoAjuste = { dx: Math.max(-0.75, Math.min(0.75, a.dx + dx * 0.25)), dy: Math.max(-0.75, Math.min(0.75, a.dy + dy * 0.25)) };
  renderBarraEditorEscritorio();
  const ult = escritorio.ultimoPasso;
  if (ult) previaEditorEscritorio(ult.x, ult.y);
}

// Modelos de sala: troca a mobília da sala por um arranjo pronto (dá para
// desfazer antes de salvar).
const ESCRITORIO_MODELOS_SALA = [["atendimento", "Atendimento", "Mesa, poltronas para o cliente e canto com sofá"], ["design", "Design", "Segunda estação com dois monitores e canto de ideias"], ["estudio", "Estúdio", "Palco iluminado, câmera e cadeira de direção"], ["planejamento", "Aconchego", "Tapete, poltronas e cadeira suspensa"], ["criacao", "Criação", "Bancada de vidro com segundo monitor e pufes"], ["livre", "Simples", "Só a mesa, cadeiras de visita e uma planta"]];
function escritorioModelosHtml() {
  if(escritorio.perfil?.quarto_configurado && escritorio.edicao?.camada===escritorioMinhaMesa()?.ambiente.id) return `<p class="ofc-nota">Modelos gratuitos. Você pode desfazer antes de salvar.</p><div class="ofc-modelos">${escritorio.base.quartos.modelos.map(m=>`<button type="button" onclick="aplicarModeloSalaEscritorio('${m.id}')"><b>${safeText(m.nome)}</b><small>${safeText(m.dica)}</small></button>`).join("")}</div>`;
  return `<p class="ofc-nota">Escolha um modelo: a mobília da sala é trocada por ele. Dá para desfazer antes de salvar.</p><div class="ofc-modelos">${ESCRITORIO_MODELOS_SALA.map(([id, nome, dica]) => `<button type="button" onclick="aplicarModeloSalaEscritorio('${id}')"><b>${nome}</b><small>${dica}</small></button>`).join("")}</div>`;
}
function aplicarModeloSalaEscritorio(tema) {
  const e = escritorio.edicao, a = escritorioAmbienteDoQuarto(e?.camada);
  if (!a?.pessoal) return;
  if(escritorio.perfil?.quarto_configurado) {
    const modelo=escritorio.base.quartos.modelos.find(m=>m.id===tema);
    if(!modelo) return escritorioAviso("Escolha um modelo gratuito do seu quarto.");
    e.itens=criadorItensDaOpcao(modelo.id, escritorioPerfilDecoracao()?.sala_planta); e.sel=null;e.selVarios=new Set();escritorioEditorMudou();return;
  }
  // Imagens (quadros e tapetes da pessoa) continuam.
  const imagens = e.itens.filter((it) => escritorioImagemDe(it[0]));
  e.itens = [...escritorioMoveisDaSala(a, tema).map(([c, x, y, ...r]) => [c, x - a.x0, y - a.y0, ...r]), ...imagens];
  e.sel = null; e.selVarios = new Set();
  escritorio.mapa?.destacar(null);
  escritorioEditorMudou();
  escritorioAviso("Modelo aplicado. Ajuste o que quiser e clique em Salvar.");
}

// Seleção em grupo (Shift + clique, Shift + arrastar no piso, Ctrl + A),
// mover junto, copiar/colar entre salas e conjuntos guardados.
function escritorioGrupo() {
  const e = escritorio.edicao;
  if (!e) return new Set();
  if (!(e.selVarios instanceof Set)) e.selVarios = new Set();
  if (e.sel !== null && !e.selVarios.size) e.selVarios.add(e.sel);
  return e.selVarios;
}
function escritorioDestacarGrupo() {
  const e = escritorio.edicao;
  escritorio.mapa?.destacar([...escritorioGrupo()].map((i) => ({ camada: e.camada, i })));
}
function escritorioGrupoDaCaixa(fim = false) {
  const e = escritorio.edicao, b = e.caixa || e.caixaUlt;
  if (!b) return;
  e.caixaUlt = b;
  const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
  const c = escritorioCantoCamada(e.camada);
  e.selVarios = new Set(e.itens.map((it, i) => [it, i]).filter(([it]) => !escritorioImagemDe(it[0]) && it[1] + c.x >= x0 && it[1] + c.x <= x1 && it[2] + c.y >= y0 && it[2] + c.y <= y1).map(([, i]) => i));
  e.sel = e.selVarios.size ? [...e.selVarios].at(-1) : null;
  escritorioDestacarGrupo();
  if (fim) { e.caixaUlt = null; renderBarraEditorEscritorio(); escritorioAviso(e.selVarios.size ? `${e.selVarios.size} móveis selecionados. Arraste um deles para mover todos.` : "Nenhum móvel nessa área."); }
}
async function moverGrupoEscritorio(dx, dy) {
  const e = escritorio.edicao, g = escritorioGrupo();
  if (!dx && !dy) return;
  const r = (v) => Math.round(v * 100) / 100;
  for (const i of g) {
    const it = e.itens[i];
    if (!(await escritorioCabe(it[0], r(it[1] + dx), r(it[2] + dy), it[3], { grupo: g }, !it[5])))
      return escritorioAviso("O grupo não cabe aí: algum móvel sairia da área ou bateria em outro.");
  }
  for (const i of g) { const it = e.itens[i]; it[1] = r(it[1] + dx); it[2] = r(it[2] + dy); }
  escritorioEditorMudou();
  setTimeout(escritorioDestacarGrupo, 60);
}
// Área de transferência do editor: fica no navegador, vale entre salas.
function copiarSelecaoEscritorio(silencioso = false) {
  const e = escritorio.edicao;
  const lista = [...escritorioGrupo()].map((i) => e.itens[i]).filter((it) => it && !escritorioImagemDe(it[0]));
  if (!lista.length) return false;
  const mx = Math.min(...lista.map((it) => Math.floor(it[1]))), my = Math.min(...lista.map((it) => Math.floor(it[2])));
  const copia = lista.map(([c, x, y, d, est = 0, alt = 0]) => [c, Math.round((x - mx) * 100) / 100, Math.round((y - my) * 100) / 100, d, est, alt]);
  try { localStorage.setItem("vybe-escritorio-copia", JSON.stringify(copia)); } catch {}
  escritorio.copiaEditor = copia;
  if (!silencioso) escritorioAviso(`${copia.length} ${copia.length === 1 ? "móvel copiado" : "móveis copiados"}. Ctrl + V cola (inclusive em outra sala).`);
  return true;
}
function colarEscritorio(lista) {
  const e = escritorio.edicao;
  if (!e) return;
  let copia = lista || escritorio.copiaEditor;
  if (!copia) try { copia = JSON.parse(localStorage.getItem("vybe-escritorio-copia") || "null"); } catch {}
  if (!Array.isArray(copia) || !copia.length) return escritorioAviso("Nada copiado ainda. Selecione móveis e aperte Ctrl + C.");
  e.colar = copia;
  e.novo = null; e.sel = null; e.selVarios = new Set();
  escritorio.mapa?.destacar(null);
  renderBarraEditorEscritorio();
  escritorioAviso(`Clique no piso para colar ${copia.length} ${copia.length === 1 ? "móvel" : "móveis"} · Esc cancela.`);
}
async function soltarColarEscritorio(x, y) {
  const e = escritorio.edicao, c = escritorioCantoCamada(e.camada);
  const lx = x - c.x, ly = y - c.y, novos = [], copia = e.colar;
  for (const [cl, dx, dy, d, est, alt] of copia) {
    const nx = Math.round((lx + dx) * 100) / 100, ny = Math.round((ly + dy) * 100) / 100;
    if (!(await escritorioCabe(cl, nx, ny, d, null, !alt))) return escritorioAviso("Não cabe tudo aí. Escolha um lugar mais livre (ou mais para dentro da área).");
    novos.push([cl, nx, ny, d, est, alt]);
  }
  if (escritorio.edicao !== e || e.colar !== copia || !escritorioInventarioPara(novos)) return;
  const ini = e.itens.length;
  e.itens.push(...novos);
  e.colar = null;
  e.selVarios = new Set(novos.map((_, k) => ini + k));
  e.sel = ini + novos.length - 1;
  escritorioEditorMudou();
  setTimeout(escritorioDestacarGrupo, 60);
  escritorioAviso("Colado. Arraste para ajustar e clique em Salvar.");
}
// Conjuntos guardados: um arranjo com nome, para colocar de novo com um clique.
function escritorioConjuntos() {
  try { return JSON.parse(localStorage.getItem("vybe-escritorio-conjuntos") || "[]").filter((c) => c && Array.isArray(c.itens)); } catch { return []; }
}
function salvarConjuntoEscritorio() {
  if (!copiarSelecaoEscritorio(true)) return escritorioAviso("Selecione os móveis do conjunto primeiro.");
  const nome = (prompt("Nome do conjunto (ex.: minha estação de trabalho):") || "").trim().slice(0, 40);
  if (!nome) return;
  const lista = [{ nome, itens: escritorio.copiaEditor }, ...escritorioConjuntos().filter((c) => c.nome !== nome)].slice(0, 30);
  try { localStorage.setItem("vybe-escritorio-conjuntos", JSON.stringify(lista)); } catch {}
  escritorioAviso(`Conjunto "${nome}" guardado. Está em Meus conjuntos.`);
  if (escritorio.catalogoCategoria === "Conjuntos") renderEscritorio();
}
function escritorioConjuntosHtml() {
  const lista = escritorioConjuntos();
  return `<p class="ofc-nota">Selecione móveis (Shift + clique ou Shift + arrastar no piso) e use "Guardar conjunto". Ficam guardados neste computador.</p>
<div class="ofc-modelos">${lista.map((c, i) => `<div class="ofc-conjunto"><button type="button" onclick="colarEscritorio(escritorioConjuntos()[${i}].itens)"><b>${safeText(c.nome)}</b><small>${c.itens.length} ${c.itens.length === 1 ? "móvel" : "móveis"} · clique e depois no piso</small></button><button type="button" class="ofc-imagem-apagar" onclick="apagarConjuntoEscritorio(${i})" aria-label="Apagar o conjunto ${safeText(c.nome)}">Apagar</button></div>`).join("") || '<p class="ofc-nota">Nenhum conjunto ainda.</p>'}</div>`;
}
function apagarConjuntoEscritorio(i) {
  const lista = escritorioConjuntos();
  if (!lista[i] || !confirm(`Apagar o conjunto "${lista[i].nome}"?`)) return;
  lista.splice(i, 1);
  try { localStorage.setItem("vybe-escritorio-conjuntos", JSON.stringify(lista)); } catch {}
  renderEscritorio();
}
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("keydown", (e) => { if (e.key === "Shift") escritorio.shift = true; });
  document.addEventListener("keyup", (e) => { if (e.key === "Shift") escritorio.shift = false; });
  document.addEventListener("keyup", (e) => { if (e.key === " ") { escritorio.espacoEditor = false; atualizarFerramentaEditorEscritorio(); } });
  window.addEventListener?.("blur", () => { escritorio.shift = false; escritorio.espacoEditor = false; atualizarFerramentaEditorEscritorio(); });
}

// Histórico: as versões salvas antes desta área; escolher uma carrega no
// editor (só vale depois de Salvar, e dá para desfazer).
async function abrirVersoesEscritorio() {
  const e = escritorio.edicao;
  if (!e) return;
  let d = document.getElementById("office-versoes");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "office-versoes";
    d.className = "ofc-ficha";
    d.setAttribute("aria-labelledby", "office-versoes-titulo");
    d.addEventListener("click", (ev) => { if (ev.target === d) d.close(); });
    document.body.append(d);
  }
  d.innerHTML = `<div class="ofc-ficha-topo"><div><h3 id="office-versoes-titulo">Versões de ${safeText(escritorioNomeCamada(e.camada))}</h3><small>As últimas 30 vezes que alguém salvou esta área.</small></div><button type="button" class="ofc-x" onclick="this.closest('dialog').close()" aria-label="Fechar">×</button></div><div id="office-versoes-lista"><p class="ofc-nota">Carregando…</p></div>`;
  if (!d.open) d.showModal();
  const el = document.getElementById("office-versoes-lista");
  if (escritorio.base.demo) { el.innerHTML = '<p class="ofc-nota">A demonstração não guarda versões.</p>'; return; }
  try {
    const r = await fetch("/api/painel?area=escritorio&acao=mapa-versoes&camada=" + encodeURIComponent(e.camada), { credentials: "same-origin", cache: "no-store" });
    const dados = await r.json();
    if (!r.ok || !dados.ok) throw new Error(dados.error || "Não deu para ler as versões.");
    el.innerHTML = dados.versoes.length ? `<div class="ofc-modelos">${dados.versoes.map((v) => `<button type="button" onclick="carregarVersaoEscritorio('${v.id}')"><b>${new Date(v.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${v.por ? " · " + safeText(v.por.split(" ")[0]) : ""}</b><small>${v.itens} móveis · versão ${v.versao}</small></button>`).join("")}</div>` : '<p class="ofc-nota">Nenhuma versão anterior ainda. Cada vez que alguém salvar esta área, a versão de antes fica aqui.</p>';
  } catch (erro) {
    el.innerHTML = `<p class="ofc-erro">${safeText(erro.message)}</p>`;
  }
}
async function carregarVersaoEscritorio(id) {
  const e = escritorio.edicao;
  try {
    const r = await fetch("/api/painel?area=escritorio&acao=mapa-versao&id=" + encodeURIComponent(id), { credentials: "same-origin", cache: "no-store" });
    const dados = await r.json();
    if (!r.ok || !dados.ok) throw new Error(dados.error || "Não deu para abrir essa versão.");
    if (dados.camada !== e.camada) throw new Error("Essa versão é de outra área.");
    e.itens = dados.itens.map((it) => [...it.slice(0, 6)]);
    e.sel = null; e.selVarios = new Set();
    escritorio.mapa?.destacar(null);
    escritorioEditorMudou();
    document.getElementById("office-versoes")?.close();
    escritorioAviso("Versão carregada. Clique em Salvar para manter (ou Desfazer).");
  } catch (erro) {
    escritorioAviso(erro.message);
  }
}

// Itens de parede do acervo: ficam encostados no trecho de parede do ladrilho
// (fundo = direção 4, esquerda = 2), em qualquer parede que exista ali.
function escritorioEhParede(classe) {
  return Boolean((escritorioCatalogo || []).find((m) => m.classe === classe)?.parede);
}
function escritorioTemParede(x, y, eixo) {
  const P = ESCRITORIO_PLANTA, quarto = escritorioAmbienteDoQuarto();
  // Dentro da sala valem as paredes dela; a Praça é ao ar livre.
  const paredes = quarto ? escritorioParedesDoQuarto(quarto) : P.divisorias;
  return paredes.some(([x0, y0, x1, y1]) => (eixo === "x" ? y0 === y1 && y0 === y && x >= x0 && x < x1 : x0 === x1 && x0 === x && y >= y0 && y < y1));
}
function escritorioLugarParede(x, y, fx = x + 0.5, fy = y + 0.5) {
  const e = escritorio.edicao, c = escritorioCantoCamada(e.camada);
  if (x < c.x || y < c.y || x >= c.x + c.w || y >= c.y + c.h) return null;
  // Parede mais perto do ponto clicado entre a de trás e a da esquerda do ladrilho.
  const op = [];
  if (escritorioTemParede(x, y, "x")) op.push({ dist: fy - y, dir: 4 });
  if (escritorioTemParede(x, y, "y")) op.push({ dist: fx - x, dir: 2 });
  if (!op.length) return null;
  const { dir } = op.sort((a, b) => a.dist - b.dist)[0];
  return { lx: x - c.x, ly: y - c.y, dir };
}

// Meus móveis: os essenciais (grátis) e o que está no inventário do dono.
function escritorioMeusMoveis() {
  const todos = [...(escritorioCatalogo || []), ...ESCRITORIO_COMPUTADORES], vistos = new Set();
  return todos.filter((m) => !vistos.has(m.classe) && vistos.add(m.classe) && escritorioQuantidadeMovel(m.classe) > 0 && !escritorioImagemDe(m.classe));
}
// Selo do cartão no próprio quarto: grátis, quantos estão livres ou o preço.
function escritorioOutrosAndares() {
  const camada=escritorio.edicao?.camada;
  if(!camada || camada==='geral') return [];
  const raiz=camada.replace(/-andar-1$/,'');
  return Object.entries(escritorio.base.mapa?.camadas || {}).filter(([id])=>id!==camada && (id===raiz || id===raiz+'-andar-1')).flatMap(([,m])=>m.itens || []);
}
function escritorioUnidadesColocadas(classe) {
  return [...(escritorio.edicao?.itens || []),...escritorioOutrosAndares()].filter(it=>it[0]===classe).length;
}
// Onde estão as unidades de um móvel: neste andar, no outro e guardadas.
function escritorioOndeEstaMovel(classe) {
  const tem = escritorioQuantidadeMovel(classe);
  const aqui = (escritorio.edicao?.itens || []).filter((it) => it[0] === classe).length;
  const outro = escritorioOutrosAndares().filter((it) => it[0] === classe).length;
  return { tem, aqui, outro, guardados: tem === Infinity ? Infinity : Math.max(0, tem - aqui - outro) };
}
function escritorioSeloQuarto(classe) {
  const { tem, aqui, outro, guardados } = escritorioOndeEstaMovel(classe);
  const partes = [];
  if (aqui) partes.push(`${aqui} aqui`);
  if (outro) partes.push(`${outro} no outro andar`);
  if (tem === Infinity) partes.push("Grátis");
  else if (guardados) partes.push(`${guardados} ${guardados === 1 ? "guardado" : "guardados"}`);
  else if (!partes.length) partes.push(`Os ${tem} já estão colocados`);
  return partes.join(" · ");
}
// Filtros da aba Meus móveis: por tipo (os grupos do catálogo) e por onde estão.
const ESCRITORIO_FILTROS_ONDE = [["todos", "Todos"], ["colocados", "Colocados"], ["guardados", "Guardados"]];
function escritorioFiltrarMeus(meus) {
  const onde = escritorio.meusOnde || "todos", tipo = escritorio.meusTipo || "";
  const doTipo = (lista, nome) => { const regra = ESCRITORIO_GRUPOS_CATALOGO.find(([n]) => n === nome)?.[1]; return regra ? lista.filter(regra) : lista; };
  const naOnde = (m) => {
    if (onde === "todos") return true;
    const o = escritorioOndeEstaMovel(m.classe);
    return onde === "colocados" ? o.aqui + o.outro > 0 : o.guardados > 0;
  };
  const porOnde = meus.filter(naOnde);
  // Só os tipos de móvel (coleções e "animados" cruzam os tipos e repetiriam).
  const tipos = ESCRITORIO_GRUPOS_CATALOGO.slice(6).filter(([nome]) => !/^(Coleção|Animados|Na parede|Blocos e materiais)/.test(nome)).map(([nome]) => [nome, doTipo(porOnde, nome).length]).filter(([, n]) => n);
  const ativo = tipos.some(([n]) => n === tipo) ? tipo : "";
  const chip = (ativo, acao, rotulo) => `<button type="button" aria-pressed="${ativo}" onclick="${acao};escritorio.catalogoPagina=0;desenharCatalogoEscritorio()">${rotulo}</button>`;
  const html = `<div class="ofc-cats ofc-filtro-meus" role="group" aria-label="Onde estão">${ESCRITORIO_FILTROS_ONDE.map(([id, rotulo]) => chip(onde === id, `escritorio.meusOnde='${id}'`, rotulo)).join("")}</div>`
    + (tipos.length > 1 ? `<div class="ofc-cats ofc-filtro-meus" role="group" aria-label="Tipo de móvel">${chip(!ativo, "escritorio.meusTipo=''", `Todos os tipos · ${porOnde.length}`)}${tipos.map(([nome, n]) => chip(ativo === nome, `escritorio.meusTipo='${safeText(nome)}'`, `${safeText(nome)} · ${n}`)).join("")}</div>` : "");
  return { lista: ativo ? doTipo(porOnde, ativo) : porOnde, html };
}
function escritorioQuantidadeMovel(classe) {
 if(escritorio.base.quartos?.essenciais.includes(classe) || escritorioImagemDe(classe)) return Infinity;
 return Number(escritorio.base.economia?.inventario?.find(i=>i.classe===classe)?.quantidade || 0);
}
// Evita montar uma decoração que só falharia no salvamento. O servidor
// continua sendo a autoridade; esta checagem usa o inventário já carregado.
function escritorioInventarioPara(novos) {
 const e = escritorio.edicao;
 if (!e) return false;
 if (e.camada === "geral") return true;
 const usados = new Map();
 for (const [classe] of [...e.itens, ...escritorioOutrosAndares(), ...novos]) usados.set(classe,(usados.get(classe)||0)+1);
 for (const [classe,n] of usados) if (n > escritorioQuantidadeMovel(classe)) {
  escritorioAviso("Você não tem unidades livres deste móvel. Compre mais na Loja ou use uma unidade que já está no quarto.");
  return false;
 }
 return true;
}
function escritorioPodeColocarMovel(classe) {
 if(escritorio.edicao?.camada === "geral") return true;
 const n=escritorioQuantidadeMovel(classe);
 return n > escritorioUnidadesColocadas(classe);
}
// Na Loja o clique compra (e já deixa o móvel na mão para colocar); em Meus
// móveis o clique só coloca o que você tem.
async function escritorioAcaoMovel(classe, comprar = false) {
 if(escritorioQuantidadeMovel(classe)===Infinity || (!comprar && escritorioPodeColocarMovel(classe))) return escolherMovelEscritorio(classe);
 if(!comprar) return escritorioAviso("Todas as unidades deste móvel já estão no quarto. Compre outra na Loja.");
 if(escritorio.edicao?.camada!==escritorioMinhaMesa()?.ambiente.id) return escritorioAviso("A loja é pessoal. Abra seu próprio quarto para comprar móveis.");
 const info=escritorioInfoLoja(classe);
 if(info.marco) return escritorioAviso(`Este móvel não se compra: vem com o marco "${escritorio.base.economia?.marcos?.find(m=>m.id===info.marco)?.nome || info.marco}" da sua ficha.`);
 if(info.restante===0) return escritorioAviso("Esgotado: todos os exemplares já foram comprados.");
 if(!info.naVitrine) return escritorioAviso("Este móvel só se compra quando está na vitrine da semana.");
 if(escritorio.comprando) return;
 escritorio.comprando=true;
 if(escritorio.compraPendente?.classe!==classe) escritorio.compraPendente={classe,chave:crypto.randomUUID()};
 const compra=escritorio.compraPendente;
 try {
  if(escritorio.base.demo) {
   if(escritorio.base.economia.saldo<info.preco) throw new Error("VybeCoins insuficientes.");
   escritorio.base.economia.saldo-=info.preco;
   const item=escritorio.base.economia.inventario.find(i=>i.classe===classe);
   if(item) item.quantidade++; else escritorio.base.economia.inventario.push({classe,quantidade:1});
   const limitado=escritorio.base.economia.loja?.mapa?.get(classe);
   if(limitado && limitado.restante!==null) limitado.restante--;
  } else escritorio.base.economia=(await escritorioApi("comprar",compra)).economia;
  escritorio.compraPendente=null;
  renderEscritorio(); escolherMovelEscritorio(classe);
 } catch(e) { escritorioAviso(e.message); }
 finally {escritorio.comprando=false;}
}
