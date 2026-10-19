// Motor do mapa do escritório no estilo Habbo: piso e paredes num canvas de
// fundo; cada móvel, divisória e personagem é um elemento com z-index pela
// profundidade, para um boneco atrás da mesa ficar escondido por ela.
// Móveis: assets/escritorio/habbo (formato nitro). Bonecos: imager do Habbo.
// Animação só com o escritório visível e sem prefers-reduced-motion.
const MAPA_TW = 64, MAPA_TH = 32, MAPA_PAREDE = 118;
// Altura de cada nível da planta: um bloco do Habbo (1 = 32 px, a mesma
// unidade da altura dos móveis), como na planta de alturas do jogo.
const MAPA_NIVEL_PX = 32;
// A arte do Habbo tem o ponto de registro no centro do ladrilho; mapaTela dá o
// vértice de cima. Sem esta meia altura, todo móvel ficava meio ladrilho para
// trás (flutuando) em relação ao piso, à grade de colisão e aos bonecos.
const MAPA_MOVEL_Y = MAPA_TH / 2;
const MAPA_MOVEIS = new Map(); // classe → Promise<{dados, imagem}>
const MAPA_BASE = "/api/painel?area=escritorio&acao=arte&arquivo=";

// A arte só sai pela API, para quem está logado. No build, a versão da pasta
// de arte entra no endereço, para o cache do navegador renovar.
function mapaArquivo(nome) {
  const versao = typeof ESCRITORIO_ARTE_VERSAO !== "undefined" && ESCRITORIO_ARTE_VERSAO;
  return MAPA_BASE + encodeURIComponent(nome) + (versao ? "&v=" + versao : "");
}
function mapaCarregarMovel(classe) {
  if (!MAPA_MOVEIS.has(classe))
    MAPA_MOVEIS.set(classe, (async () => {
      const r = await fetch(mapaArquivo(classe + ".json"), { credentials: "same-origin" });
      if (!r.ok) throw new Error("Móvel indisponível: " + classe);
      const dados = await r.json();
      const imagem = new Image();
      imagem.src = mapaArquivo(classe + ".png");
      await imagem.decode();
      return { dados, imagem };
    })());
  return MAPA_MOVEIS.get(classe);
}
// Ladrilho → tela: vértice de cima do ladrilho.
function mapaTela(x, y, origem) {
  return { x: origem.x + (x - y) * (MAPA_TW / 2), y: origem.y + (x + y) * (MAPA_TH / 2) - (origem.alturaAtual ?? origem.alturaEm?.(x,y) ?? origem.nivelEm?.(x,y) ?? 0)*MAPA_NIVEL_PX };
}
function mapaLadrilho(sx, sy, origem) {
  if (origem.nivelEm) {
    // Testa cada patamar projetado: o clique deve atingir o chão elevado.
    for(let n=origem.nivelMax ?? 2;n>=0;n--) {
      const t=mapaLadrilho(sx,sy+n*MAPA_NIVEL_PX,{...origem,nivelEm:null});
      if(origem.nivelEm(t.x,t.y)===n) return t;
    }
  }
  const a = (sx - origem.x) / (MAPA_TW / 2), b = (sy - origem.y) / (MAPA_TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
// Dimensões no chão conforme a direção: valem para 0 e 4; 2 e 6 giram o móvel.
function mapaDimensoes(dados, dir) {
  const d = dados.logic?.model?.dimensions || { x: 1, y: 1 };
  return dir === 2 || dir === 6 ? { x: d.y || 1, y: d.x || 1, z: d.z } : { x: d.x || 1, y: d.y || 1, z: d.z };
}
// Item de parede do Habbo (janela, quadro, luminária de parede…): só tem as
// direções 2 (parede da esquerda) e 4 (parede do fundo) e quase não tem fundo.
// Ajuste do ponto de registro do Habbo para a nossa parede (por direção).
const MAPA_PAREDE_AJUSTE = { 2: { x: 0, y: -46 }, 4: { x: 0, y: -46 } };
function mapaEhDeParede(dados, classe) {
  // A ficha oficial diz (wallitemtypes, marca 16); sem ficha, pela arte.
  const f = classe && MAPA_FISICA?.[classe];
  if (f) return Boolean(f[0] & 16);
  const v = dados.visualizations.find((x) => x.size === 64);
  const dirs = Object.keys(v?.directions || {}).map(Number);
  const d = dados.logic?.model?.dimensions || {};
  return dirs.length > 0 && dirs.every((x) => x === 2 || x === 4) && (d.y ?? 1) <= 0.3;
}
function mapaDirecaoValida(dados, dir) {
  const v = dados.visualizations.find((v) => v.size === 64);
  const dirs = Object.keys(v?.directions || {}).map(Number);
  if (!dirs.length || dirs.includes(dir)) return dir;
  return dirs.includes((dir + 4) % 8) ? (dir + 4) % 8 : dirs[0];
}
// Quantos quadros a animação do estado tem (o maior entre as camadas).
// Quadro de cada camada animada num instante (a mesma conta do desenho):
// igual ao anterior, nada a redesenhar.
function mapaChaveQuadro(dados, estado, quadro, semente = 0) {
  const camadas = dados.visualizations.find((v) => v.size === 64)?.animations?.[mapaCorDoEstado(dados, estado).estado]?.layers || {};
  let chave = "";
  for (const [i, anim] of Object.entries(camadas)) {
    const seqs = anim?.frameSequences ? Object.values(anim.frameSequences) : [];
    const lista = seqs.length ? Object.values(seqs[semente % seqs.length]?.frames || {}) : [];
    if (lista.length > 1) chave += i + "=" + Math.floor(quadro / Math.max(1, Number(anim.frameRepeat) || 1)) % lista.length + ";";
  }
  return chave;
}
function mapaQuadros(dados, estado) {
  const v = dados.visualizations.find((v) => v.size === 64);
  const camadas = v?.animations?.[estado]?.layers || {};
  let n = 1;
  for (const c of Object.values(camadas)) for (const s of Object.values(c.frameSequences || {})) {
    const ids = new Set(Object.values(s.frames || {}).map((f) => f.id));
    if (ids.size > 1) n = Math.max(n, Object.keys(s.frames).length * Math.max(1, Number(c.frameRepeat) || 1));
  }
  return n;
}
// Desenha um móvel num canvas próprio; devolve o deslocamento até o vértice
// de cima do ladrilho de origem.
// quadro: tique da animação (um a cada 100 ms, como o Habbo). semente: escolhe
// a sequência de quadros quando a arte tem várias (o Habbo sorteia uma a cada
// volta; aqui cada móvel fica com a sua, para dois iguais não se mexerem em
// sincronia). frameRepeat da arte vale: um quadro fica N tiques na tela.
// Cor dos blocos de construção do Habbo (arte "recolorable": a camada marcada
// recebe a cor por cima do desenho em cinza). A cor vai no estado do móvel,
// que já é salvo e sincronizado: estado = 100 + cor × 5 + variante (0–4).
const MAPA_CORES_BLOCO = ["#f4f4f4", "#c9c9c9", "#8d8d8d", "#4f4f4f", "#1d1d1f", "#e23b3b", "#ff8a35", "#ffd23f", "#9ad94a", "#3fae55",
  "#2bb5a0", "#46c8e8", "#5aa0ff", "#2f5bd6", "#1e2a6b", "#8b5cf6", "#ff6fa8", "#8a5a3c", "#e6cfa3", "#b07a45"];
function mapaEhRecoloravel(dados) {
  const v = dados?.visualizations?.find((v) => v.size === 64);
  return Boolean(v && Object.values(v.layers || {}).some((l) => l.tag === "recolorable"));
}
function mapaCorDoEstado(dados, estado) {
  if (!(estado >= 100) || !mapaEhRecoloravel(dados)) return { estado, cor: null };
  const n = Math.round(estado) - 100;
  return { estado: n % 5, cor: MAPA_CORES_BLOCO[Math.floor(n / 5)] || null };
}
const MAPA_TINTA = typeof document !== "undefined" && document.createElement ? document.createElement("canvas") : null;
// Ordem de desenho do Habbo (Nitro: RoomGeometry, RoomSpriteCanvas,
// FurnitureVisualization, AvatarVisualization). Cada objeto tem a
// profundidade do seu ladrilho de origem na câmera do Habbo (−135°, 0,5°):
// −0,70708 por ladrilho em x ou y e −0,00713 por nível de altura. Cada camada
// da arte soma (z/−1000 − camada × 0,001) × √½: é assim que a arte do Habbo
// fatia móveis grandes (a mesa executiva tem fatias com z 1000, 2000, 3000,
// uma por ladrilho) e põe o encosto na frente de quem senta. A sombra fica em
// +1. O boneco fica em −0,01 (deitado, −0,409). Quanto menor, mais à frente.
const MAPA_PROF_LADRILHO = 0.70708, MAPA_PROF_ALTURA = 0.00713;
const MAPA_PROF_SENTADO = -0.01, MAPA_PROF_DEITADO = -0.409, MAPA_PROF_SOMBRA = 1;
function mapaProfCamada(z, i) { return (-(z || 0) / 1000 - i * 0.001) * Math.SQRT1_2; }
// Revestimento de parede (papel, lambri do Habbo): item de parede largo
// (2 ladrilhos ou mais) e da altura da parede. É o fundo da parede: fica por
// baixo de tudo o que se pendura nela, em qualquer ponto (a lousa do Café
// aparecia cortada pelo papel do trecho seguinte). Mesma regra no
// verificador e no motor de construção (que carregam este arquivo).
function mapaEhRevestimento(dim, parede) { return Boolean(parede) && (dim?.x ?? 0) >= 2 && (dim?.z ?? 0) >= 2.9; }
// Faixa própria: acima da parede (2000…) e do piso (1000…), abaixo de todo
// móvel e item de parede (mapaZ, 10000 ou mais); mais fundo na arte, mais atrás.
function mapaZRevestimento(profArte) { return 9500 - Math.round((profArte || 0) * 100); }
// Item de parede desenhado num canvas só: fica na profundidade da camada
// mais funda da arte (z do Habbo). Papel de parede (z −5000 a −2000) vai
// atrás de lousa, quadro, janela e prateleira postos na frente dele, como
// no Nitro; antes ele cobria o que estivesse no trecho ao lado.
function mapaProfFundoParede(dados, dir) {
  const v = dados?.visualizations?.find((x) => x.size === 64);
  const zs = [];
  for (let i = 0; i < (v?.layerCount || 1); i++) {
    const z = v?.directions?.[dir]?.layers?.[i]?.z ?? v?.layers?.[i]?.z;
    if (z != null) zs.push(z);
  }
  return zs.length ? mapaProfCamada(Math.min(...zs), 0) : 0;
}
function mapaProfundidade(x, y, z = 0) { return -MAPA_PROF_LADRILHO * (x + y) - MAPA_PROF_ALTURA * z; }
// z-index da profundidade (resolução de 0,001). Faixas: tapetes (1000+)
// rente ao piso; paredes do fundo (2000+) atrás de tudo, como os planos do
// Habbo; móveis, camadas e bonecos entre 48000 e 81000 (quarto de até 20 × 20
// e camadas até z 3000), abaixo dos rótulos e etiquetas (99000+).
function mapaZ(prof) { return 10000 + Math.round((40 - prof) * 1000); }
function mapaZPlano(prof) { return 1000 + Math.max(0, Math.min(899, Math.round((30 - prof) * 10))); }
// Grupo de camadas que se desenham juntas: a sombra e cada valor de z da arte.
const mapaGrupoCamada = (p) => (p.sombra ? "sd" : String(p.z));
// filtro(parte): desenha só essas camadas, no mesmo tamanho e posição do
// desenho inteiro (para as camadas se sobreporem certinho). Sem nenhuma, null.
// Números desenhados por camada, como no Nitro (FurnitureScoreBoard-,
// FurnitureCounterClock- e FurnitureVoteCounterVisualization): a camada com
// a marca de dígito mostra o quadro do dígito do estado (placar e votos:
// unidades, dezenas, centenas; relógio de partida: segundos e minutos).
const MAPA_DIGITOS = {
  ones_sprite: (n) => n % 10, tens_sprite: (n) => Math.floor(n / 10) % 10, hundreds_sprite: (n) => Math.floor(n / 100) % 10, thousands_sprite: (n) => Math.floor(n / 1000) % 10,
  seconds_sprite: (n) => (n % 60) % 10, ten_seconds_sprite: (n) => Math.floor((n % 60) / 10), minutes_sprite: (n) => Math.floor(n / 60) % 10, ten_minutes_sprite: (n) => Math.floor(n / 600) % 10,
};
const MAPA_COM_DIGITOS = /^furniture_(score_board|counter_clock|vote_counter|vote_majority)$/;
// Quebrável (InteractionCrackable): o estado é o número de golpes; a etapa da
// arte acompanha a proporção até o total (no Habbo, da tabela do servidor).
const MAPA_GOLPES_QUEBRAVEL = 10;
function mapaEtapaQuebravel(dados, golpes) {
  const n = Object.keys(dados.visualizations.find((v) => v.size === 64)?.animations || {}).filter((k) => Number(k) < 100).length || 1;
  return Math.min(n - 1, Math.floor((Math.max(0, golpes) * (n - 1)) / MAPA_GOLPES_QUEBRAVEL));
}
function mapaDesenharMovel({ dados, imagem }, dir, estadoSalvo, quadro, semente = 0, filtro) {
  const v = dados.visualizations.find((v) => v.size === 64);
  const digitos = MAPA_COM_DIGITOS.test(dados.visualizationType || "");
  const numero = Math.max(0, Math.round(Number(estadoSalvo) || 0));
  // O relógio de partida anima sempre a animação 0 (o número fica nos dígitos).
  const { estado, cor } = digitos ? { estado: dados.visualizationType === "furniture_counter_clock" ? 0 : Math.min(1, numero), cor: null }
    : dados.logicType === "furniture_crackable" ? { estado: mapaEtapaQuebravel(dados, numero), cor: null } : mapaCorDoEstado(dados, estadoSalvo);
  const nome = dados.name;
  const partes = [];
  const sombra = `${nome}_64_sd_${dir}_0`;
  // Sombra com a transparência fixa do Nitro (48 de 255), em todo móvel.
  if (dados.assets[sombra]) partes.push({ asset: sombra, z: -1e6, alpha: 48 / 255, sombra: true });
  for (let i = 0; i < (v.layerCount || 1); i++) {
    const L = { ...(v.layers?.[i] || {}), ...(v.directions?.[dir]?.layers?.[i] || {}) };
    const anim = v.animations?.[estado]?.layers?.[i];
    const seqs = anim?.frameSequences ? Object.values(anim.frameSequences) : [];
    const seq = seqs.length ? seqs[semente % seqs.length]?.frames : null;
    const lista = seq ? Object.values(seq) : null;
    const repete = Math.max(1, Number(anim?.frameRepeat) || 1);
    const id = digitos && MAPA_DIGITOS[L.tag] ? MAPA_DIGITOS[L.tag](numero) : lista ? lista[Math.floor(quadro / repete) % lista.length].id : 0;
    const asset = `${nome}_64_${String.fromCharCode(97 + i)}_${dir}_${id}`;
    if (!dados.assets[asset]) continue;
    partes.push({ asset, z: L.z || 0, ink: L.ink, alpha: L.alpha != null ? L.alpha / 255 : 1, ordem: i, cor: L.tag === "recolorable" ? cor : null });
  }
  if (filtro && !partes.some(filtro)) return null;
  partes.sort((a, b) => a.z - b.z || (a.ordem || 0) - (b.ordem || 0));
  const caixas = partes.map((p) => {
    const a = dados.assets[p.asset];
    const fonte = a.source || p.asset;
    const f = dados.spritesheet.frames[`${nome}_${fonte}`]?.frame;
    if (!f) return null;
    // Ponto de registro: sem espelho, (−x, −y); espelhado, o x conta da direita.
    const x = a.flipH ? a.x - f.w : -a.x;
    return { ...p, f, flip: Boolean(a.flipH), x, y: -a.y };
  }).filter(Boolean);
  if (!caixas.length) return null;
  const minX = Math.min(...caixas.map((c) => c.x)), minY = Math.min(...caixas.map((c) => c.y));
  const maxX = Math.max(...caixas.map((c) => c.x + c.f.w)), maxY = Math.max(...caixas.map((c) => c.y + c.f.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, maxX - minX);
  canvas.height = Math.max(1, maxY - minY);
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  for (const c of caixas) {
    if (filtro && !filtro(c)) continue;
    g.save();
    g.globalAlpha = c.alpha;
    // Camada "ADD" (luz, brilho): no Habbo o preto não soma nada. Num canvas
    // transparente o preto aparecia como uma caixa preta; vira transparência.
    let fonte = imagem, sx = c.f.x, sy = c.f.y;
    if (c.ink === "ADD") { fonte = mapaLuzSemPreto(imagem, c.f); sx = 0; sy = 0; g.globalCompositeOperation = "lighter"; }
    // Camada recolorível: o desenho multiplicado pela cor, com o mesmo recorte.
    if (c.cor && MAPA_TINTA) {
      const t = MAPA_TINTA, tg = t.getContext("2d");
      t.width = c.f.w; t.height = c.f.h;
      tg.imageSmoothingEnabled = false;
      tg.drawImage(fonte, sx, sy, c.f.w, c.f.h, 0, 0, c.f.w, c.f.h);
      tg.globalCompositeOperation = "multiply"; tg.fillStyle = c.cor; tg.fillRect(0, 0, c.f.w, c.f.h);
      tg.globalCompositeOperation = "destination-in"; tg.drawImage(fonte, sx, sy, c.f.w, c.f.h, 0, 0, c.f.w, c.f.h);
      tg.globalCompositeOperation = "source-over";
      fonte = t; sx = 0; sy = 0;
    }
    const dx = c.x - minX, dy = c.y - minY;
    if (c.flip) {
      g.translate(dx + c.f.w, dy);
      g.scale(-1, 1);
      g.drawImage(fonte, sx, sy, c.f.w, c.f.h, 0, 0, c.f.w, c.f.h);
    } else g.drawImage(fonte, sx, sy, c.f.w, c.f.h, dx, dy, c.f.w, c.f.h);
    g.restore();
  }
  // Grupos de camadas e a profundidade de cada um (a da primeira camada).
  const grupos = new Map();
  for (const c of caixas) {
    const k = mapaGrupoCamada(c);
    if (!grupos.has(k)) grupos.set(k, { chave: k, prof: c.sombra ? MAPA_PROF_SOMBRA : mapaProfCamada(c.z, c.ordem), luz: true });
    if (c.ink !== "ADD") grupos.get(k).luz = false;
  }
  return { canvas, ox: minX, oy: minY, grupos: [...grupos.values()] };
}
// Camadas de um móvel para desenhar separadas, cada uma com a sua
// profundidade. Móvel de um grupo só reaproveita o desenho inteiro.
function mapaCamadasMovel(m, dir, estado, quadro, semente = 0) {
  const d = mapaDesenharMovel(m, dir, estado, quadro, semente);
  if (!d) return null;
  if (d.grupos.length <= 1) return { ...d, camadas: [{ canvas: d.canvas, prof: d.grupos[0]?.prof || 0, luz: d.grupos[0]?.luz }] };
  const camadas = d.grupos.map((g) => ({ canvas: mapaDesenharMovel(m, dir, estado, quadro, semente, (p) => mapaGrupoCamada(p) === g.chave)?.canvas, prof: g.prof, luz: g.luz })).filter((c) => c.canvas);
  return { ...d, camadas };
}
// Paisagem vista pela janela, como no Habbo (FurnitureWindow: a máscara da
// arte recorta a parede e mostra a paisagem do quarto atrás). A nossa é o céu
// de Irecê na hora do dia: chapada baixa, caatinga, sol, lua e estrelas.
const MAPA_CEUS = {
  madrugada: ["#0b1026", "#1d2350", "#2c2f55"], manha: ["#7ec8f5", "#bfe6fb", "#f3e9c6"], tarde: ["#4fa3e6", "#9fd2f5", "#e8f1d8"],
  "por-do-sol": ["#3b2a6b", "#e0703a", "#f7c46a"], noite: ["#070b1d", "#141b3d", "#252a4a"],
};
function mapaPintarPaisagem(c, momento) {
  const g = c.getContext("2d"), w = c.width, h = c.height, [alto, meio, baixo] = MAPA_CEUS[momento] || MAPA_CEUS.tarde;
  const ceu = g.createLinearGradient(0, 0, 0, h);
  ceu.addColorStop(0, alto); ceu.addColorStop(0.6, meio); ceu.addColorStop(1, baixo);
  g.fillStyle = ceu; g.fillRect(0, 0, w, h);
  const noite = momento === "noite" || momento === "madrugada";
  if (noite) { g.fillStyle = "#ffffffcc"; for (let i = 0; i < w * h / 160; i++) g.fillRect((i * 37) % w, (i * 53) % Math.max(1, h * 0.6), 1, 1); }
  g.fillStyle = noite ? "#f4f1d0" : momento === "por-do-sol" ? "#ffd27a" : "#fff6c8";
  g.beginPath(); g.arc(w * 0.72, h * (momento === "por-do-sol" ? 0.62 : 0.26), Math.max(3, Math.min(w, h) * 0.09), 0, Math.PI * 2); g.fill();
  // Chapada ao longe e a caatinga mais perto.
  g.fillStyle = noite ? "#1a1f33" : momento === "por-do-sol" ? "#5b3a4a" : "#8a9a7a";
  g.beginPath(); g.moveTo(0, h * 0.78); for (let x = 0; x <= w; x += 6) g.lineTo(x, h * (0.72 + 0.04 * Math.sin(x / 17))); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.fillStyle = noite ? "#10141f" : momento === "por-do-sol" ? "#3d2a2e" : "#6f7d4f";
  g.beginPath(); g.moveTo(0, h * 0.9); for (let x = 0; x <= w; x += 4) g.lineTo(x, h * (0.86 + 0.03 * Math.sin(x / 7 + 1))); g.lineTo(w, h); g.lineTo(0, h); g.fill();
}
// Máscara do vidro da janela (o asset "_mask"), na mesma conta de posição das camadas.
function mapaMascaraJanela({ dados, imagem }, dir) {
  const nome = dados.name, a = dados.assets[`${nome}_64_${dir}_mask`];
  if (!a) return null;
  const f = dados.spritesheet.frames[`${nome}_${a.source || nome + "_64_" + dir + "_mask"}`]?.frame;
  if (!f) return null;
  const c = document.createElement("canvas");
  c.width = f.w; c.height = f.h;
  const g = c.getContext("2d");
  if (a.flipH) { g.translate(f.w, 0); g.scale(-1, 1); }
  g.drawImage(imagem, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  return { canvas: c, x: a.flipH ? a.x - f.w : -a.x, y: -a.y };
}
const MAPA_LUZES_CACHE = new WeakMap();
function mapaLuzSemPreto(imagem, f) {
  let porImagem = MAPA_LUZES_CACHE.get(imagem);
  if (!porImagem) MAPA_LUZES_CACHE.set(imagem, (porImagem = new Map()));
  const chave = `${f.x},${f.y},${f.w},${f.h}`;
  if (porImagem.has(chave)) return porImagem.get(chave);
  const c = document.createElement("canvas");
  c.width = f.w; c.height = f.h;
  const g = c.getContext("2d");
  g.drawImage(imagem, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  try {
    const px = g.getImageData(0, 0, f.w, f.h), d = px.data;
    for (let i = 0; i < d.length; i += 4) d[i + 3] = Math.round((Math.max(d[i], d[i + 1], d[i + 2]) * d[i + 3]) / 255);
    g.putImageData(px, 0, 0);
  } catch { /* imagem de outro domínio: fica como estava */ }
  porImagem.set(chave, c);
  return c;
}
// Cor em hex ("#rrggbb") mais escura ou mais clara: f < 1 escurece, f > 1
// clareia (mistura com branco). Usada nas paredes, para a base e o topo
// seguirem a cor da sala em vez de um cinza fixo.
function mapaTom(cor, f) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(cor || ""));
  if (!m) return cor || "#4a4d57";
  const c = m.slice(1).map((h) => parseInt(h, 16)).map((v) => (f <= 1 ? v * f : v + (255 - v) * (f - 1)));
  return "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
// Linhas com desenho de verdade num canvas (a arte do Habbo tem margens
// transparentes; as paredes ladrilham só a parte visível).
function mapaRecorteOpaco(canvas) {
  const g = canvas.getContext("2d"), { width: w, height: h } = canvas;
  if (!w || !h) return { y0: 0, y1: h };
  const d = g.getImageData(0, 0, w, h).data;
  let y0 = 0, y1 = h;
  const opaca = (y) => { for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) return true; return false; };
  while (y0 < h - 1 && !opaca(y0)) y0++;
  while (y1 > y0 + 1 && !opaca(y1 - 1)) y1--;
  return { y0, y1 };
}
// Piso da cena (sala, espaço comum ou Praça) e a soleira da porta, sobre o
// escuro, como um quarto do Habbo.
// Degraus da própria planta (não móveis): cada extremidade encosta na altura
// real do piso vizinho. A faixa vai do centro do piso baixo ao centro do alto,
// com o ladrilho de nível intermediário no meio. Não estica arte de móvel.
function mapaDegrausDaPlanta(e) {
  const n=Math.max(1,Math.ceil((e.alto-e.baixo)*4)), r=[];
  const ponto=(t,s,z)=>({x:e.x+.5+e.dx*t-e.dy*s,y:e.y+.5+e.dy*t+e.dx*s,z});
  for(let i=0;i<n;i++) {
    const de=-1+2*i/n, ate=-1+2*(i+1)/n, z=e.baixo+(e.alto-e.baixo)*(i+1)/n;
    const piso=[ponto(de,-.5,z),ponto(ate,-.5,z),ponto(ate,.5,z),ponto(de,.5,z)];
    r.push({piso,base:e.baixo});
  }
  return r.sort((a,b)=>a.piso.reduce((s,p)=>s+p.x+p.y,0)-b.piso.reduce((s,p)=>s+p.x+p.y,0));
}
function mapaDesenharEscadas(g,planta,origem) {
  const pintar=(pontos,cor)=>{
    const ps=pontos.map(p=>mapaTela(p.x,p.y,{...origem,alturaAtual:p.z}));
    g.beginPath();g.moveTo(Math.round(ps[0].x),Math.round(ps[0].y));
    for(const p of ps.slice(1)) g.lineTo(Math.round(p.x),Math.round(p.y));
    g.closePath();g.fillStyle=cor;g.fill();g.strokeStyle='#656b73';g.lineWidth=1;g.stroke();
  };
  for(const e of planta.escadas || []) for(const d of mapaDegrausDaPlanta(e)) {
    for(let i=0;i<4;i++) {
      const a=d.piso[i],b=d.piso[(i+1)%4];
      const cx=d.piso.reduce((s,p)=>s+p.x,0)/4,cy=d.piso.reduce((s,p)=>s+p.y,0)/4;
      // Só as faces voltadas para a câmera; o lado de trás não invade o piso.
      if((a.x===b.x && a.x>cx)||(a.y===b.y && a.y>cy))
        pintar([a,b,{...b,z:d.base},{...a,z:d.base}],a.x===b.x?'#9299a2':'#b2b8c0');
    }
    pintar(d.piso,'#e0e4e9');
  }
}
function mapaDesenharFundo(canvas, planta, origem) {
  // Espessura do piso na borda, como no Habbo (RoomPlaneParser): 0,25 bloco
  // vezes 2 elevado à escolha do quarto (−2 a 1): 2, 4, 8 ou 16 px.
  const espessuraPiso = 0.25 * (planta.espessuraPiso ?? 1);
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  const losango = (x, y, w = 1, h = 1) => {
    const a = mapaTela(x, y, origem), b = mapaTela(x + w, y, origem), c = mapaTela(x + w, y + h, origem), d = mapaTela(x, y + h, origem);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
  };
  const cor = (piso, x, y) => { const p = planta.PISO[piso] || planta.PISO.corredor; return p[(Math.floor(x) + Math.floor(y)) % 2]; };
  // Pisos do acervo (madeira, mármore, carpete, grama…): o desenho do móvel
  // de piso repetido no ladrilho, recortado no losango. Enquanto a arte não
  // chega (ou se faltar), fica a cor lisa.
  const texturas = planta.texturasProntas;
  const textura = (x, y, classe, x0 = 0, y0 = 0, modo = "") => {
    if (mapaEhPlano(classe)) {
      // Piso do Habbo: a textura do plano inclinada em losango, contínua pelo chão.
      const t = mapaTexturaPlano(classe);
      if (!t) return false;
      const q = mapaTela(x, y, origem);
      g.save(); losango(x, y); g.clip();
      if (modo) { g.globalCompositeOperation = modo; g.globalAlpha = 0.55; }
      g.transform(1, 0.5, -1, 0.5, q.x, q.y);
      g.translate(-x * 32, -y * 32);
      g.fillStyle = g.createPattern(t, "repeat"); g.fillRect(x * 32 - 1, y * 32 - 1, 34, 34);
      g.restore();
      return true;
    }
    const t = classe && texturas?.get(classe);
    if (!t) return false;
    const ax = x - (((x - x0) % t.dw) + t.dw) % t.dw, ay = y - (((y - y0) % t.dh) + t.dh) % t.dh, q = mapaTela(ax, ay, origem);
    g.save(); losango(x, y); g.clip();
    if (modo) { g.globalCompositeOperation = modo; g.globalAlpha = 0.55; }
    // O desenho do piso cobre a área inteira do móvel (dw × dh ladrilhos):
    // encaixa pelo topo e pelo centro dessa área, não pelo registro do Habbo
    // (que deixava meio ladrilho de folga e o piso saía em xadrez).
    g.drawImage(t.canvas, q.x + (t.dw - t.dh) * 16 - t.canvas.width / 2, q.y + (t.dw + t.dh) * 16 - t.canvas.height + 4);
    g.restore();
    return true;
  };
  // Ladrilho de sala pessoal (quarto ou o que o dono pintou): a cor dela com
  // o veio da madeira por cima; corredores e espaços comuns: o piso do acervo.
  const ladrilho = (x, y, a, extra = null) => {
    origem.alturaAtual=planta.nivelEm?.(x,y) || 0;
    // Escada: o chão do ladrilho fica embaixo; a peça do acervo sobe por cima
    // dela (escritorioPecasDoQuarto). Antes era um desenho de listras.
    if (planta.escadaEm?.(x,y)) origem.alturaAtual = 0;
    const pintado = planta.pisoLadrilho?.(x, y);
    losango(x, y); g.fillStyle = cor(pintado || (extra ? extra.piso : a ? a.piso : "corredor"), x, y); g.fill();
    if (pintado || a?.pessoal) textura(x, y, planta.texturaSalas, a?.x0 || 0, a?.y0 || 0, "soft-light");
    else textura(x, y, extra?.textura || a?.textura || (a ? "" : planta.texturaCorredor), extra?.x0 ?? a?.x0 ?? 0, extra?.y0 ?? a?.y0 ?? 0);
    g.strokeStyle = "#0000001a"; g.lineWidth = 1; losango(x, y); g.stroke();
    {
      const n=origem.alturaAtual;
      for(const [dx,dy] of [[1,0],[0,1]]) {
        // Vizinho de escada tem o chão embaixo (a peça da escada cobre o degrau).
        const viz=planta.andavel(x+dx,y+dy) ? (planta.escadaEm?.(x+dx,y+dy) ? 0 : planta.nivelEm(x+dx,y+dy)) : -espessuraPiso;
        if(n<=viz) continue;
        const p=mapaTela(x+dx,y+dy,origem),q=mapaTela(x+1,y+1,origem);
        // Lateral do patamar: com piso oficial do Habbo, o próprio piso (abaixo);
        // sem ele, a cor da parede da sala, com a borda clara no alto e a
        // junta de cada ladrilho.
        // Cena comum pode escolher a cor da lateral (madeira do chalé, pedra…).
        const h=(n-viz)*MAPA_NIVEL_PX, base=/^#[0-9a-f]{6}$/i.test(a?.corDegrau||"") ? a.corDegrau : /^#[0-9a-f]{6}$/i.test(a?.cor||"") ? a.cor : cor(a?.piso || "madeira",x,y);
        g.beginPath();g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);g.lineTo(q.x,q.y+h);g.lineTo(p.x,p.y+h);g.closePath();g.fillStyle=mapaTom(base,dx?0.5:0.68);g.fill();
        // Piso oficial do Habbo: como no Nitro (RoomPlaneParser.addFloor), a
        // lateral é um plano do próprio piso, com a sombra do lado (o da
        // direita mais escuro), e não uma cor à parte.
        const piso = extra?.textura || a?.textura, tex = mapaEhPlano(piso) && mapaTexturaPlano(piso);
        if (tex) {
          g.save(); g.clip();
          g.transform((q.x-p.x)/32,(q.y-p.y)/32,0,1,p.x,p.y);
          g.fillStyle=g.createPattern(tex,"repeat"); g.fillRect(0,0,32,h);
          g.restore();
          g.fillStyle=dx?"rgba(0,0,0,.42)":"rgba(0,0,0,.24)";
          g.beginPath();g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);g.lineTo(q.x,q.y+h);g.lineTo(p.x,p.y+h);g.closePath();g.fill();
        }
        g.strokeStyle="#ffffff55";g.lineWidth=2;g.beginPath();g.moveTo(p.x,p.y+1);g.lineTo(q.x,q.y+1);g.stroke();
        g.strokeStyle="#00000040";g.lineWidth=1;g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x,p.y+h);g.stroke();
      }
      delete origem.alturaAtual;
    }
  };
  // Soleira sob cada porta: o vão ganha um piso próprio, mais claro, para a
  // porta de vidro ter chão embaixo em vez de parecer solta no corredor.
  const soleiras = () => {
    for (const pt of [...(planta.portas || []), ...(planta.soleiras || [])]) for (let i = 0; i < pt.w; i++) for (let j = 0; j < pt.h; j++) {
      losango(pt.x + i, pt.y + j);
      g.fillStyle = "#8c8e99"; g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = "#00000040"; g.lineWidth = 1; g.stroke();
    }
  };
  const a = planta.ambientes[0];
  // Do fundo para a frente (a lateral de um patamar cobre o de trás).
  const qw = planta.W - 1, qh = planta.H - 1;
  // Trechos de piso do acervo (Praça: gramado, calçamento, deck, lago); o
  // último que cobre o ladrilho vale.
  const trecho = (x, y) => { let r = null; for (const t of planta.texturas || []) if (x >= t.x0 && x < t.x1 && y >= t.y0 && y < t.y1) r = t; return r; };
  for (let soma=0;soma<qw+qh;soma++) for(let x=0;x<qw;x++) {const y=soma-x;if(y>=0&&y<qh&&planta.andavel(x,y)) ladrilho(x,y,a,trecho(x,y));}
  mapaDesenharEscadas(g,planta,origem);
  soleiras();
}
// Divisória entre ambientes: um bloco escuro baixo por ladrilho de aresta.
// Divisória baixa (corredores, espaços comuns) ou parede alta de sala
// individual: mais alta, com a cor da sala no acabamento e um rodapé.
// fatias: pedaços de quadros da equipe pintados neste trecho de parede
// ({ img, u0, u1, h }: a faixa da imagem, em fração da largura, e a altura em
// ladrilhos de parede).
// altura: em px (46 baixa, 64 média, 82 alta); sem ela, alta se tem cor.
// Paredes com os painéis do acervo (tijolo, madeira, concreto, azulejo…):
// a arte do painel de parede do Habbo, recortada em cada trecho. Os estilos
// do pincel da sala usam os mesmos painéis; "b" (lisa) fica só na cor.
// Portas que ficam nos vãos: abrem e fecham, e o boneco passa por elas.
const MAPA_PORTAS = /^(val14_gate|exe_gate|ktchn_gate|wildwest_saloondr)$/;
// Peças fixas do quarto que se atravessam: a escada (anda-se nela) e a
// balaustrada da borda do mezanino (a queda já impede descer por ali).
const MAPA_PASSAVEIS = /^(bc_stairs_recolorable|hotel_c18_rail|tokyo_c18_railing)$/;
// Onde a porta é desenhada: a arte do Habbo fica no meio do ladrilho, mas a
// nossa porta é o vão da parede, que passa pela aresta de trás do ladrilho
// (y, nas paredes de fundo; x, nas da esquerda). O desenho recua meio
// ladrilho até essa linha; sem isso a porta ficava solta, meio passo à
// frente do vão, como se flutuasse no corredor.
function mapaPosicaoPorta(classe, x, y, dir) {
  if (!MAPA_PORTAS.test(classe)) return [x, y];
  return dir === 2 || dir === 6 ? [x - 0.5, y] : [x, y - 0.5];
}
const MAPA_ESTILO_TEXTURA = { c: "urban_wall", d: "gardenshed_wall", e: "sb_wall", f: "exe_c15_wall", g: "hygge_c25_wallpaper1", h: "bathroom_wall4" };
const MAPA_TEXTURA_SALA = "plano:parede:1901"; // padrão das salas, tingido na cor do dono
const MAPA_TEXTURAS_PAREDE = new Map(); // classe → { 2: {canvas}, 4: {canvas}, n }
// Papéis de parede e pisos oficiais do quarto do Habbo (room.nitro do Nitro:
// wallData e floorData). Textura "plano:parede:1801" ou "plano:piso:205": o
// número é o do Habbo (textura × cor). A textura se repete no plano inteiro,
// tingida pela cor do plano e inclinada como no Nitro: 32 px de textura por
// aresta de ladrilho, na parede de pé e no chão em losango.
let MAPA_PLANOS = null, MAPA_PLANOS_PRONTOS = null;
const MAPA_PLANOS_TEXTURAS = new Map();
function mapaEhPlano(textura) { return typeof textura === "string" && textura.startsWith("plano:"); }
function mapaCarregarPlanos() {
  MAPA_PLANOS ??= (async () => {
    const r = await fetch(mapaArquivo("habbo_quarto_planos.json"), { credentials: "same-origin" });
    if (!r.ok) throw new Error("Paredes e pisos do Habbo indisponíveis.");
    const dados = await r.json();
    const imagem = new Image();
    imagem.src = mapaArquivo("habbo_quarto_planos.png");
    await imagem.decode();
    MAPA_PLANOS_PRONTOS = { dados, imagem };
    return MAPA_PLANOS_PRONTOS;
  })();
  return MAPA_PLANOS;
}
// A textura de um plano (canvas tingido), ou null enquanto não carregou.
function mapaTexturaPlano(textura) {
  if (!mapaEhPlano(textura) || !MAPA_PLANOS_PRONTOS) return null;
  if (MAPA_PLANOS_TEXTURAS.has(textura)) return MAPA_PLANOS_TEXTURAS.get(textura);
  const [, tipo, id] = textura.split(":");
  const { dados, imagem } = MAPA_PLANOS_PRONTOS, bloco = dados.roomVisualization?.[tipo === "piso" ? "floorData" : "wallData"];
  let canvas = null;
  try {
    const plano = bloco.planes.find((q) => q.id === id), vis = plano?.visualizations.find((v) => v.size === 64);
    const camada = (vis?.allLayers || vis?.layers || [])[0];
    const material = bloco.materials.find((m) => m.id === camada?.materialId);
    const texId = material?.matrices?.[0]?.columns?.[0]?.cells?.[0]?.textureId;
    const nome = bloco.textures.find((t) => t.id === texId)?.bitmaps?.[0]?.assetName;
    const asset = dados.assets[nome], fonte = asset?.source || nome;
    const f = dados.spritesheet.frames["room_" + fonte]?.frame;
    if (f) {
      canvas = document.createElement("canvas");
      canvas.width = f.w; canvas.height = f.h;
      const g = canvas.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(imagem, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      const cor = camada.color ?? 0xffffff;
      if (cor !== 0xffffff) {
        g.globalCompositeOperation = "multiply"; g.fillStyle = "#" + cor.toString(16).padStart(6, "0"); g.fillRect(0, 0, f.w, f.h);
        g.globalCompositeOperation = "destination-in"; g.drawImage(imagem, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      }
    }
  } catch { canvas = null; }
  MAPA_PLANOS_TEXTURAS.set(textura, canvas);
  return canvas;
}
// espessura: a da parede do quarto (multiplicador do Habbo: 0,25 a 2), que
// aparece na faixa do topo.
function mapaDivisoria(x, y, eixo, cor, fatias = [], estilo = "a", altura = 0, textura = null, tingir = false, espessura = 1) {
  const topo = Math.max(1, Math.round(5 * espessura));
  const c = document.createElement("canvas");
  // Parede alta tem a altura da parede de fora do prédio.
  const alt = altura || (cor ? MAPA_PAREDE : 46);
  c.width = MAPA_TW / 2 + 6; c.height = MAPA_TH / 2 + alt + 6;
  const g = c.getContext("2d");
  // eixo "x": a aresta vai para baixo-direita; "y": para baixo-esquerda
  const sobe = eixo === "x";
  const p0 = sobe ? { x: 0, y: alt } : { x: MAPA_TW / 2, y: alt };
  const p1 = sobe ? { x: MAPA_TW / 2, y: alt + MAPA_TH / 2 } : { x: 0, y: alt + MAPA_TH / 2 };
  // Base da parede na cor da sala (escurecida), não num cinza fixo: onde o
  // painel não cobre, aparece a cor dela e não uma faixa preta. Divisória
  // baixa sem dono é de vidro: translúcida, para o lado de dentro da sala
  // vizinha não sumir atrás dela (numa parede opaca, 1,5 ladrilho de altura
  // escondia três ladrilhos de piso).
  const vidro = !cor;
  g.fillStyle = cor ? mapaTom(cor, sobe ? 0.55 : 0.42) : sobe ? "#9cc3e6" : "#7fa9d2";
  if (vidro) g.globalAlpha = 0.34;
  g.beginPath(); g.moveTo(p0.x + 3, p0.y); g.lineTo(p1.x + 3, p1.y); g.lineTo(p1.x + 3, p1.y - alt); g.lineTo(p0.x + 3, p0.y - alt); g.closePath(); g.fill();
  if (vidro) {
    // Reflexo e rodapé fino, para o vidro não virar um retângulo chapado.
    g.globalAlpha = 0.5; g.fillStyle = "#ffffff";
    g.beginPath(); g.moveTo(p0.x + 3, p0.y - alt + 6); g.lineTo(p1.x + 3, p1.y - alt + 6); g.lineTo(p1.x + 3, p1.y - alt + 9); g.lineTo(p0.x + 3, p0.y - alt + 9); g.closePath(); g.fill();
    g.globalAlpha = 0.9; g.fillStyle = "#3a3f4b";
    g.beginPath(); g.moveTo(p0.x + 3, p0.y); g.lineTo(p1.x + 3, p1.y); g.lineTo(p1.x + 3, p1.y - 4); g.lineTo(p0.x + 3, p0.y - 4); g.closePath(); g.fill();
    g.globalAlpha = 1;
  }
  const plano = cor && mapaEhPlano(textura) ? mapaTexturaPlano(textura) : null;
  const tex = cor && textura && !plano ? MAPA_TEXTURAS_PAREDE.get(textura) : null;
  if (plano) {
    // Papel de parede do Habbo: a textura corre ao longo da parede (32 px por
    // ladrilho, contínua de um trecho para o outro) e de cima para baixo.
    const k = sobe ? x : y;
    g.save();
    g.beginPath(); g.moveTo(p0.x + 3, p0.y); g.lineTo(p1.x + 3, p1.y); g.lineTo(p1.x + 3, p1.y - alt); g.lineTo(p0.x + 3, p0.y - alt); g.closePath(); g.clip();
    g.transform((p1.x - p0.x) / 32, (p1.y - p0.y) / 32, 0, 1, p0.x + 3, p0.y - alt);
    g.translate(-k * 32, 0);
    g.fillStyle = g.createPattern(plano, "repeat"); g.fillRect(k * 32, 0, 32, alt);
    g.restore();
    // A cor escolhida pelo dono também vale no material contínuo do quarto.
    if (tingir) { g.save(); g.globalCompositeOperation='multiply'; g.globalAlpha=.7; g.fillStyle=cor; g.beginPath();g.moveTo(p0.x+3,p0.y);g.lineTo(p1.x+3,p1.y);g.lineTo(p1.x+3,p1.y-alt);g.lineTo(p0.x+3,p0.y-alt);g.closePath();g.fill();g.restore(); }
    // Luz do Habbo: a parede da esquerda um pouco mais escura; rodapé e topo.
    if (!sobe) { g.save(); g.beginPath(); g.moveTo(p0.x + 3, p0.y); g.lineTo(p1.x + 3, p1.y); g.lineTo(p1.x + 3, p1.y - alt); g.lineTo(p0.x + 3, p0.y - alt); g.closePath(); g.clip(); g.globalAlpha = 0.14; g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height); g.restore(); }
    const faixa = (de, ate, estilo) => { g.fillStyle = estilo; g.beginPath(); g.moveTo(p0.x + 3, p0.y - de); g.lineTo(p1.x + 3, p1.y - de); g.lineTo(p1.x + 3, p1.y - ate); g.lineTo(p0.x + 3, p0.y - ate); g.closePath(); g.fill(); };
    faixa(0, 4, "#00000055"); faixa(alt - topo, alt, cor);
  } else if (tex) {
    // Painel de n ladrilhos: o trecho k mostra a sua fatia do desenho, com a
    // base do painel na base da parede e repetido para cima até o topo. Conta
    // só a parte desenhada da arte (as margens transparentes ficam de fora).
    const arte = tex[sobe ? 4 : 2], n = tex.n, k = (((sobe ? x : y) % n) + n) % n;
    const r = tex.recorte?.[sobe ? 4 : 2] || { y0: 0, y1: arte.height }, h = r.y1, passo = Math.max(8, r.y1 - r.y0 - 16 * n);
    g.save();
    g.beginPath(); g.moveTo(p0.x + 3, p0.y); g.lineTo(p1.x + 3, p1.y); g.lineTo(p1.x + 3, p1.y - alt); g.lineTo(p0.x + 3, p0.y - alt); g.closePath(); g.clip();
    for (let v = 0; v < alt + 40; v += passo) {
      if (sobe) g.drawImage(arte, 3 - 32 * k, alt - (h - 16 * n + 16 * k) - v);
      else g.drawImage(arte, 35 - 32 * (n - k), alt - h + 16 * (n - k) - v);
    }
    // Sala individual: o painel ganha a cor do dono.
    if (tingir) { g.globalCompositeOperation = "multiply"; g.globalAlpha = 0.7; g.fillStyle = cor; g.fillRect(0, 0, c.width, c.height); }
    g.globalCompositeOperation = "source-over";
    // A parede da esquerda recebe menos luz; rodapé escuro em todas.
    if (!sobe) { g.globalAlpha = 0.16; g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height); }
    g.globalAlpha = 1;
    g.restore();
    const faixa = (de, ate, estilo) => { g.fillStyle = estilo; g.beginPath(); g.moveTo(p0.x + 3, p0.y - de); g.lineTo(p1.x + 3, p1.y - de); g.lineTo(p1.x + 3, p1.y - ate); g.lineTo(p0.x + 3, p0.y - ate); g.closePath(); g.fill(); };
    faixa(0, 5, "#00000066"); faixa(alt - topo, alt, cor);
  } else if (cor && estilo && estilo !== "a") {
    g.save();
    g.setTransform(p1.x - p0.x, p1.y - p0.y, 0, -alt, p0.x + 3, p0.y);
    const ret = (x0, y0, w, h, c) => { g.fillStyle = c; g.fillRect(x0, y0, w, h); };
    const sombra = sobe ? 0 : 0.18;
    const base = { b: cor, c: "#8a4733", d: "#7a5235", e: "#6e7077", f: "#9fd3ff", g: cor, h: "#e9edf2" }[estilo] || cor;
    ret(0, 0, 1, 1, base);
    if (estilo === "c") for (let r = 0; r < 8; r++) { ret(0, r / 8, 1, 0.012, "#3b1f17"); for (let k = r % 2 ? 0.25 : 0; k < 1; k += 0.5) ret(k, r / 8, 0.012, 1 / 8, "#3b1f17"); }
    if (estilo === "d") for (let k = 0; k < 1; k += 0.25) { ret(k, 0, 0.02, 1, "#4a2f1c"); ret(k + 0.1, 0, 0.01, 1, "#8b6342"); }
    if (estilo === "e") { for (let i = 0; i < 40; i++) ret(((i * 37) % 97) / 97, ((i * 53) % 89) / 89, 0.02, 0.012, "#5a5c62"); ret(0, 0.5, 1, 0.01, "#5f6168"); }
    if (estilo === "f") { g.globalAlpha = 0.45; ret(0, 0, 1, 1, "#cfeaff"); g.globalAlpha = 1; ret(0, 0, 1, 0.04, "#2b2d36"); ret(0, 0.96, 1, 0.04, "#2b2d36"); ret(0, 0, 0.03, 1, "#2b2d36"); ret(0.6, 0.15, 0.06, 0.7, "#ffffff66"); }
    if (estilo === "g") for (let k = 0; k < 1; k += 0.25) ret(k, 0, 0.125, 1, "#00000033");
    if (estilo === "h") for (let k = 0; k <= 1; k += 0.25) { ret(k, 0, 0.012, 1, "#b8c0ca"); ret(0, k, 1, 0.012, "#b8c0ca"); }
    if (sombra) { g.globalAlpha = sombra; ret(0, 0, 1, 1, "#000"); g.globalAlpha = 1; }
    ret(0, 0, 1, 0.05, "#0000004d");
    g.restore();
  } else if (cor) {
    // Faixa da cor da sala no alto e rodapé escuro: a parede tem dono.
    const faixa = (de, ate, estilo) => { g.fillStyle = estilo; g.beginPath(); g.moveTo(p0.x + 3, p0.y - de); g.lineTo(p1.x + 3, p1.y - de); g.lineTo(p1.x + 3, p1.y - ate); g.lineTo(p0.x + 3, p0.y - ate); g.closePath(); g.fill(); };
    g.globalAlpha = sobe ? 0.16 : 0.1; faixa(6, alt, cor); g.globalAlpha = 1;
    faixa(alt - topo - 2, alt, cor);
    faixa(0, 6, "#00000055");
  }
  // Quadros: a imagem acompanha a parede (esquerda da tela = começo da imagem),
  // centrada na altura, com uma moldura fina.
  for (const f of fatias) {
    const A = sobe ? { x: p0.x + 3, y: p0.y } : { x: p1.x + 3, y: p1.y };
    const B = sobe ? { x: p1.x + 3, y: p1.y } : { x: p0.x + 3, y: p0.y };
    const H = f.h * 22, base = Math.max(8, (alt - H) / 2);
    const iw = f.img.naturalWidth, ih = f.img.naturalHeight;
    if (!iw || !ih) continue;
    g.save();
    g.setTransform(B.x - A.x, B.y - A.y, 0, H, A.x, A.y - base - H);
    g.drawImage(f.img, f.u0 * iw, 0, Math.max(1, (f.u1 - f.u0) * iw), ih, 0, 0, 1, 1);
    g.restore();
    g.strokeStyle = "#0b0b0fcc"; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(A.x, A.y - base - H); g.lineTo(B.x, B.y - base - H);
    g.moveTo(A.x, A.y - base); g.lineTo(B.x, B.y - base);
    if (f.u0 === 0) { g.moveTo(A.x, A.y - base); g.lineTo(A.x, A.y - base - H); }
    if (f.u1 >= 0.999) { g.moveTo(B.x, B.y - base); g.lineTo(B.x, B.y - base - H); }
    g.stroke();
  }
  // Topo fino e claro (a parede é uma lâmina, não um bloco): a cor da sala
  // clareada, ou um cinza claro nas divisórias sem dono.
  g.fillStyle = cor ? mapaTom(cor, 1.35) : "#dbe9f6";
  g.beginPath(); g.moveTo(p0.x + 3, p0.y - alt); g.lineTo(p1.x + 3, p1.y - alt); g.lineTo(p1.x + 3, p1.y - alt - 3); g.lineTo(p0.x + 3, p0.y - alt - 3); g.closePath(); g.fill();
  return { canvas: c, ox: sobe ? -3 : -MAPA_TW / 2 - 3, oy: -alt };
}
const MAPA_FIGURA_PELE = { clara: 1, media: 8, escura: 14 };
const MAPA_FIGURA_ROUPA = { laranja: 1408, azul: 82, verde: 1335, roxo: 92, rosa: 1321, grafite: 64 };
// Figura do Habbo a partir das escolhas do perfil, ou a figura que a pessoa colou.
function mapaFigura(perfil = {}) {
  if (perfil.figura && /^[a-z]{2}-\d+(-\d+){0,2}(\.[a-z]{2}-\d+(-\d+){0,2})*$/.test(perfil.figura)) return perfil.figura;
  const pele = MAPA_FIGURA_PELE[perfil.pele] || 8;
  const roupa = MAPA_FIGURA_ROUPA[perfil.roupa] || 1408;
  const cabelo = { curto: "hr-828-61", longo: "hr-515-45", cacheado: "hr-3163-45", sem: "" }[perfil.cabelo || "curto"] ?? "hr-828-61";
  const corpo = perfil.cabelo === "longo" ? `hd-600-${pele}.ch-665-${roupa}.lg-700-82.sh-725-62` : `hd-180-${pele}.ch-255-${roupa}.lg-280-110.sh-305-62`;
  return [corpo, cabelo].filter(Boolean).join(".");
}
function mapaBonecoGuardado(figura, dir) {
  return "/api/painel?" + new URLSearchParams({ area: "escritorio", acao: "boneco", figura, dir });
}
// Garante a cópia das 8 direções de um boneco (uma por vez, sem pressa).
async function mapaGuardarBoneco(figura) {
  for (let dir = 0; dir < 8; dir++) {
    try { await fetch(mapaBonecoGuardado(figura, dir), { credentials: "same-origin" }); } catch {}
  }
}
// acao: std/wlk/sit/lay/wav; mao: algo na mão ("crr=6" é a caneca de café).
// Selos de status (SVG, sem emoji): fone para "Em foco", balão para "Em reunião".
const MAPA_SELOS = {
  foco: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 15v-3a8 8 0 0116 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>',
  reuniao: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
};
// quadro: andando, o Habbo tem 4 quadros de passo (frame_num 0–3).
// gesto: expressão do rosto (sml sorrindo, spk falando, eyb olhos fechados);
// cabeca: para onde a cabeça olha (pode virar até 90° em relação ao corpo).
function mapaAvatarUrl(figura, dir, acao, mao, quadro, gesto = "sml", cabeca = dir) {
  const q = new URLSearchParams({ figure: figura, direction: dir, head_direction: cabeca, action: mao ? `${acao},${mao}` : acao, gesture: gesto, size: "n" });
  if (acao === "wlk") q.set("frame_num", String(quadro || 0));
  return "https://www.habbo.com/habbo-imaging/avatarimage?" + q;
}
// Quadros já baixados: a troca só acontece com a imagem pronta, sem piscar.
const MAPA_BONECOS = new Map();
function mapaBonecoPronto(url, aoCarregar) {
  let img = MAPA_BONECOS.get(url);
  if (!img) {
    img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = url;
    MAPA_BONECOS.set(url, img);
    if (MAPA_BONECOS.size > 600) MAPA_BONECOS.delete(MAPA_BONECOS.keys().next().value);
  }
  if (img.complete && img.naturalWidth) return true;
  img.addEventListener("load", aoCarregar, { once: true });
  return false;
}
// Ritmo do passo como no Habbo: um ladrilho por passada, com os 4 quadros da
// passada cabendo no tempo de um ladrilho (antes o boneco deslizava: cada
// ladrilho levava 172 ms e só dois quadros apareciam).
// No Habbo o boneco anda um ladrilho a cada 500 ms (o ciclo do quarto).
const MAPA_PASSO_MS = 500; // ms por ladrilho (2 ladrilhos por segundo)
// Quadro da animação do boneco no ritmo do Nitro (AvatarVisualization:
// atualiza a cada 41 ms e troca o quadro a cada 2 atualizações = 82 ms, uns
// 12 por segundo). Antes eram 125 ms e as pernas pareciam travadas.
const MAPA_QUADRO_PASSO = 82; // ms por quadro de passo
// Direção do Habbo (0–7) para um passo na grade.
function mapaDirecaoDoPasso(dx, dy) {
  const a = Math.atan2(dy, dx);
  const oito = Math.round(a / (Math.PI / 4));
  return { 0: 2, 1: 3, 2: 4, 3: 5, 4: 6, "-4": 6, "-3": 7, "-2": 0, "-1": 1 }[oito] ?? 2;
}

// Mecânica do Habbo: anda de ladrilho em ladrilho, desvia de paredes e móveis
// e senta quando para num assento. A grade marca o que bloqueia; paredes são
// arestas entre ladrilhos vizinhos.
const MAPA_ASSENTOS = new Set(["vybe_assento_invisivel", "chair_polyfon","hc26_10", "army_c15_leatherchr", "mafia_c26_armchair_dark", "hygge_c25_armchair", "js_exe_chair", "hc_exe_chair2", "exe_sofa", "js_exe_sofa", "icedblk_c16_sofa", "greek_c15_bench",
  "hygge_c25_barstool", "vwave_c21_barstool", "hc26_5", "mafia_c26_sofa_dark", "js_c16_lounger", "br_c25_stonebench", "hygge_c25_hangingchair",
  "modern_c17_sofa", "modern_c17_chair", "mafia_c26_armchair_white", "cubie_beanbag_b", "cubie_beanbag_p", "classic9_chair", "studio_chair", "hc23_6", "ducket_c26_seachair", "paris_c15_chair"]);
// Blocos, palcos e plataformas baixos: dá para subir neles, como no Habbo.
// Física dos móveis vem da ficha oficial do Habbo (furnidata), gerada em
// assets/escritorio/habbo/fisica.json por scripts/habbo-fisica.mjs: pisar
// (canstandon), sentar (cansiton), deitar (canlayon), pôr coisas em cima
// (canputstuffon) e a altura de empilhar. Sem a ficha (móvel fora dela), vale
// a lista antiga de assentos e o nome.
let MAPA_FISICA = null;
async function mapaCarregarFisica() {
  if (MAPA_FISICA) return MAPA_FISICA;
  try {
    const r = await fetch(mapaArquivo("fisica.json"), { credentials: "same-origin" });
    MAPA_FISICA = r.ok ? await r.json() : {};
  } catch { MAPA_FISICA = {}; }
  return MAPA_FISICA;
}
const MAPA_SUBIVEIS = /^(bc_block_\w+|bc_tile_recolorable|vybe_bloco_invisivel|\w+_stage|greek_block|ktchn10_block|disco_c26_block)$/;
function mapaFisica(classe) {
  const f = MAPA_FISICA?.[classe];
  // logica: o logicType oficial do móvel (pisar, relogio, placar, altura,
  // funil, link, voto, trofeu, quebravel, tv…), de scripts/habbo-fisica.mjs.
  if (f) return { pisa: Boolean(f[0] & 1), senta: Boolean(f[0] & 2), deita: Boolean(f[0] & 4), poe: Boolean(f[0] & 8), altura: f[1], alturas: f[2] || null, logica: f[3] || null };
  const senta = MAPA_ASSENTOS.has(classe), deita = mapaEhCama(classe), pisa = MAPA_SUBIVEIS.test(classe);
  return { pisa, senta, deita, poe: pisa, altura: null };
}
// Degrau do Habbo (servidor Arcturus: MAXIMUM_STEP_HEIGHT = 1,5): sobe-se até
// 1,5 de um ladrilho para o vizinho; descer, de qualquer altura.
const MAPA_DEGRAU = 1.5;
// Portão (fechado = 0 bloqueia; aberto = 1 se atravessa), cama (deita na
// cabeceira), esteira rolante, gelo, água rasa, trampolim e placa de pressão.
const MAPA_PORTOES = /gate/;
const MAPA_CAMAS = /bed/;
const MAPA_NAO_CAMA = /flowerbed|bedside|^mystics_/;
function mapaPisoEspecial(classe) {
  if (/roller$/.test(classe)) return "esteira";
  if (/^es_skating_ice$|icerink/.test(classe)) return "gelo";
  if (/^bw_water_\d|watertile|waterfloor/.test(classe)) return "agua";
  if (/trampoline/.test(classe)) return "trampolim";
  if (/pressureplate/.test(classe)) return "placa";
  return null;
}
// Portão: o nome diz "gate", ninguém pisa nele pela ficha (abre e fecha) e não
// é porta de vidro (essas abrem sozinhas).
function mapaEhPortao(classe) { return MAPA_PORTOES.test(classe) && !MAPA_PORTAS.test(classe) && !mapaFisica(classe).pisa && !mapaFisica(classe).senta; }
function mapaEhCama(classe) {
  const f = MAPA_FISICA?.[classe];
  return f ? Boolean(f[0] & 4) : MAPA_CAMAS.test(classe) && !MAPA_NAO_CAMA.test(classe);
}
// Altura de empilhar: a medida no desenho (ESCRITORIO_TAMPOS), senão a da
// ficha do Habbo, senão a do modelo do móvel.
// Móvel de altura ajustável (InteractionMultiHeight do Habbo): a altura do
// estado em que está, da lista da ficha.
function mapaAlturaMovel(m) {
  const f = mapaFisica(m.classe);
  if (f.alturas?.length) return f.alturas[Math.max(0, Math.round(m.estado || 0)) % f.alturas.length];
  return (typeof ESCRITORIO_TAMPOS !== "undefined" && ESCRITORIO_TAMPOS[m.classe]) ?? f.altura ?? m.dim.z ?? 1;
}
function mapaTopoMovel(m) { return (m.altura || 0) + mapaAlturaMovel(m); }
function mapaMontarGrade(P, moveis) {
  const W = P.W, H = P.H;
  const bloqueado = new Uint8Array(W * H);
  const assento = new Map(); // índice → direção de quem senta
  const profAssento = new Map(); // índice → profundidade do assento (quem senta fica à frente)
  const desvioAssento = new Map(); // índice → quanto o assento saiu do ladrilho (ajuste fino)
  const paredes = new Set(); // "x,y|x,y" entre vizinhos
  const subida = new Float32Array(W * H); // altura de quem pisa, senta ou deita ali
  const piso = new Map(); // índice → { tipo, dir } (esteira, gelo, água, trampolim, placa)
  const cama = new Map(); // índice → { dir, x, y } (direção e cabeceira da cama)
  const movelAssento = new Map(); // índice → móvel em que se senta ou deita
  const ind = (x, y) => y * W + x;
  const aresta = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  for (const [x0, y0, x1, y1] of P.divisorias) {
    if (y0 === y1) for (let x = x0; x < x1; x++) paredes.add(aresta(ind(x, y0 - 1), ind(x, y0)));
    else for (let y = y0; y < y1; y++) paredes.add(aresta(ind(x0 - 1, y), ind(x0, y)));
  }
  // Água (piscina e lago da Praça): não se anda por cima.
  for (const r of P.texturas || []) if (r.agua) for (let x = r.x0; x < r.x1; x++) for (let y = r.y0; y < r.y1; y++) bloqueado[ind(x, y)] = 1;
  // Quarto: só se anda dentro dele e na soleira (P.andavel).
  if (P.andavel) for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (!P.andavel(x, y)) bloqueado[ind(x, y)] = 1;
  // Como no Habbo (Room.calculateTileState): em cada ladrilho vale o móvel
  // mais alto pelo topo (base + altura), e uma cama no ladrilho vale sempre
  // (estado LAY). Pisável, assento ou cama deixam passar (o boneco fica na
  // altura dele); qualquer outro móvel no topo bloqueia. Com o mesmo topo,
  // basta um que não se pise para bloquear.
  const topo = new Map(); // índice → móveis com o maior topo
  const camaNoLadrilho = new Map(); // índice → cama (vale mesmo com algo mais alto)
  for (const m of moveis) {
    if (MAPA_PORTAS.test(m.classe) || MAPA_PASSAVEIS.test(m.classe)) continue; // porta e escada se atravessam
    if (m.pendurado) continue; // pendurado: passa-se por baixo, no piso
    for (let dx = 0; dx < m.dim.x; dx++) for (let dy = 0; dy < m.dim.y; dy++) {
      const x = Math.floor(m.x) + dx, y = Math.floor(m.y) + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = ind(x, y), t = topo.get(i), alto = mapaTopoMovel(m);
      if (mapaFisica(m.classe).deita && !camaNoLadrilho.has(i)) camaNoLadrilho.set(i, m);
      if (!t || alto > t.alto + 0.001) topo.set(i, { alto, lista: [m] });
      else if (Math.abs(alto - t.alto) <= 0.001) t.lista.push(m);
    }
  }
  for (const [i, { lista }] of topo) {
    for (const m of lista) { const especial = mapaPisoEspecial(m.classe); if (especial) piso.set(i, { tipo: especial, dir: m.dir }); }
    const portao = lista.find((m) => mapaEhPortao(m.classe));
    if (portao) { if (!(portao.estado >= 1)) bloqueado[i] = 1; continue; }
    // Catraca de mão única: fechada na grade; quem passa vai pela rota dela.
    if (lista.some((m) => /^one_?way_?door|^onewaydoor/.test(m.classe))) { bloqueado[i] = 1; continue; }
    const fis = lista.map((m) => [m, mapaFisica(m.classe)]);
    const deita = camaNoLadrilho.get(i), senta = deita ? null : fis.find(([, f]) => f.senta)?.[0];
    if (senta) {
      const z = senta.altura || 0;
      assento.set(i, senta.dir); profAssento.set(i, senta.prof); movelAssento.set(i, senta);
      desvioAssento.set(i, { dx: senta.x - Math.floor(senta.x), dy: senta.y - Math.floor(senta.y) });
      subida[i] = z;
      continue;
    }
    if (deita) { cama.set(i, { dir: deita.dir, x: Math.floor(deita.x), y: Math.floor(deita.y) }); profAssento.set(i, deita.prof); movelAssento.set(i, deita); subida[i] = deita.altura || 0; continue; }
    // Rente ao piso (tapete, piso do acervo) também se pisa, na altura dele.
    if (fis.every(([m, f]) => f.pisa || m.plano || mapaPisoEspecial(m.classe))) {
      subida[i] = Math.max(0, ...fis.map(([m, f]) => (m.altura || 0) + (f.pisa || mapaPisoEspecial(m.classe) && !["gelo", "agua"].includes(mapaPisoEspecial(m.classe)) ? mapaAlturaMovel(m) : 0)));
      // Acima da altura máxima do Habbo (40) não é chão.
      if (subida[i] > 40) bloqueado[i] = 1;
      continue;
    }
    bloqueado[i] = 1;
  }
  return { W, H, bloqueado, assento, profAssento, movelAssento, desvioAssento, paredes, subida, piso, cama, ind, aresta, nivelEm:P.nivelEm, alturaEm:P.alturaEm };
}
// Altura de quem está no ladrilho: o piso da planta mais o móvel em que pisa,
// senta ou deita (RoomTile.getStackHeight do Habbo).
function mapaAlturaTotal(g, x, y) {
  return (g.alturaEm?.(x, y) ?? g.nivelEm?.(x, y) ?? 0) + (g.subida?.[g.ind(x, y)] || 0);
}
// Pode ir de (x,y) para o vizinho (x+dx,y+dy)? Como o caminho do servidor do
// Habbo (PathfinderImpl/AdjacentTileFinder): sobe até 1,5 (até 2 para chegar
// a um assento ou cama), desce de qualquer altura, e a diagonal só é barrada
// quando os dois lados retos estão fechados (passa rente a um móvel). Parede
// de divisória não se atravessa.
function mapaPassa(g, x, y, dx, dy) {
  const nx = x + dx, ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= g.W || ny >= g.H || g.bloqueado[g.ind(nx, ny)]) return false;
  const i = g.ind(nx, ny), limite = g.assento?.has(i) || g.cama?.has(i) ? 2 : MAPA_DEGRAU;
  if (mapaAlturaTotal(g, nx, ny) - mapaAlturaTotal(g, x, y) > limite) return false;
  if (dx && dy) return (mapaPassa(g, x, y, dx, 0) && mapaPassa(g, x + dx, y, 0, dy)) || (mapaPassa(g, x, y, 0, dy) && mapaPassa(g, x, y + dy, dx, 0));
  return !g.paredes.has(g.aresta(g.ind(x, y), g.ind(nx, ny)));
}
// A* em 8 direções. Devolve os ladrilhos do caminho (sem o de partida) ou null.
// "evitar(x, y)": obstáculos de agora (sala trancada, outra pessoa), que não
// estão na grade. "limite": custo máximo; passou dele, desiste (busca curta).
function mapaCaminho(g, de, para, evitar = null, limite = Infinity) {
  const sx = Math.round(de.x), sy = Math.round(de.y), tx = Math.floor(para.x), ty = Math.floor(para.y);
  if (tx < 0 || ty < 0 || tx >= g.W || ty >= g.H || g.bloqueado[g.ind(tx, ty)]) return null;
  if (evitar && evitar(tx, ty)) return null;
  if (sx === tx && sy === ty) return [];
  const inicio = g.ind(Math.max(0, Math.min(g.W - 1, sx)), Math.max(0, Math.min(g.H - 1, sy))), alvo = g.ind(tx, ty);
  const custo = new Map([[inicio, 0]]), veio = new Map(), aberto = [[0, inicio]], fechado = new Set();
  const h = (i) => { const dx = Math.abs((i % g.W) - tx), dy = Math.abs(Math.floor(i / g.W) - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  while (aberto.length) {
    let k = 0;
    for (let i = 1; i < aberto.length; i++) if (aberto[i][0] < aberto[k][0]) k = i;
    const [, atual] = aberto.splice(k, 1)[0];
    if (atual === alvo) break;
    if (fechado.has(atual)) continue;
    fechado.add(atual);
    const x = atual % g.W, y = Math.floor(atual / g.W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (!mapaPassa(g, x, y, dx, dy)) continue;
      const viz = g.ind(x + dx, y + dy);
      // Assento só serve de destino: ninguém atravessa sofá ou cadeira.
      if (g.assento.has(viz) && viz !== alvo) continue;
      if (evitar && viz !== alvo && evitar(x + dx, y + dy)) continue;
      const c = custo.get(atual) + (dx && dy ? 1.414 : 1);
      if (c > limite) continue;
      if (c < (custo.get(viz) ?? Infinity)) { custo.set(viz, c); veio.set(viz, atual); aberto.push([c + h(viz), viz]); }
    }
  }
  if (!veio.has(alvo)) return null;
  const passos = [];
  for (let i = alvo; i !== inicio; i = veio.get(i)) passos.unshift({ x: i % g.W, y: Math.floor(i / g.W) });
  return passos;
}

// Cria o mapa dentro de `el`. Devolve controles para pessoas, câmera e zoom.
// Cor de cada luz do quarto como multiplicador de vermelho, verde e azul
// (o regulador do Habbo: cor clara tinge pouco; "noite" e "bar" escurecem).
const MAPA_LUZES_RGB = {
  quente: [1, 0.9, 0.74], fria: [0.8, 0.9, 1], rosa: [1, 0.8, 0.92], roxa: [0.8, 0.72, 1], verde: [0.82, 1, 0.84],
  noite: [0.46, 0.52, 0.72], bar: [0.72, 0.6, 0.48],
};
function mapaFiltroDaLuz(luz) {
  const id = "mapa-luz-" + luz;
  if (!document.getElementById(id)) {
    let svg = document.getElementById("mapa-luzes-svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "mapa-luzes-svg"; svg.setAttribute("aria-hidden", "true");
      svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
      document.body.append(svg);
    }
    const [r, g, b] = MAPA_LUZES_RGB[luz];
    svg.insertAdjacentHTML("beforeend", `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0"/></filter>`);
  }
  return id;
}
// Peças de piso que os construtores põem no alto para fazer andar de cima.
const MAPA_PISO_DE_OBRA = /floorboards|_floor\d*$|plankfloor|woodenfloor|warmfloor|_deck$|parquet|marble\d*$/;
// Piso de construtor (tábua, ladrilho, mármore posto no alto): é chão, não
// peça pendurada. Uma regra só, usada também pelo verificador.
function mapaEhPisoDeObra(classe) { return MAPA_PISO_DE_OBRA.test(classe); }
// O piso decorativo pode ocupar 2×2 ou mais ladrilhos. O cursor aponta o
// ladrilho sob o mouse, não a origem da peça inteira. Outros móveis mantêm
// o alvo de interação próprio (assento, bloco etc.).
function mapaAlvoCursor(t, item) {
  const alvo = item && !item.plano && !mapaEhPisoDeObra(item.classe) ? item : t;
  return { x: Math.floor(alvo.x), y: Math.floor(alvo.y) };
}
// Refletor de festa do Habbo: cada foco anda num vaivém dentro de uma área de
// 31 px (no tamanho 64), com subida e descida em seno que encolhe perto das
// pontas; ao chegar à ponta, volta; a amplitude muda quando a curva zera.
const MAPA_FEIXE_AREA = 31;
function mapaFatorFeixe() { return 0.15 + Math.random() * 0.35; }
function mapaPassoFeixe(f) {
  const D = MAPA_FEIXE_AREA, prox = f.fase + f.sentido * f.vel;
  if (Math.abs(prox) >= D) { f.fase -= f.sentido > 0 ? prox - D : prox + D; f.sentido = -f.sentido; }
  const amp = (D - Math.abs(f.fase)) * f.fator;
  let y = f.sentido * Math.sin(Math.abs(f.fase / 4)) * amp;
  y += f.sentido > 0 ? -amp : amp;
  f.fase += f.sentido * f.vel;
  if (Math.trunc(y) === 0) f.fator = mapaFatorFeixe();
  return [f.fase, y];
}
function criarMapaEscritorio(el, { planta, aoClicar, aoDuploClique, aoPassar, eu, aoPegar, aoArrastar, aoSoltar, aoCancelar, aoClicarSaida }) {
  const P = planta;
  // Cena: o mapa geral ou um quarto (fundo escuro e câmera parada).
  el.dataset.cena = P.quarto ? "quarto" : "mapa";
  // Fundo próprio da sala comum (a cor do vazio em volta, como nas referências).
  const fundoCena = P.quarto && P.ambientes?.[0]?.fundo;
  if (fundoCena && /^#[0-9a-f]{6}$/i.test(fundoCena)) el.style.setProperty("--fundo-cena", `radial-gradient(120% 90% at 50% 40%, ${fundoCena} 0%, ${mapaTom(fundoCena, 0.55)} 100%)`);
  else el.style.removeProperty("--fundo-cena");
  const largura = (P.W + P.H) * (MAPA_TW / 2) + 80;
  const altura = (P.W + P.H) * (MAPA_TH / 2) + MAPA_PAREDE + 140 + (P.nivelMax || 0) * MAPA_NIVEL_PX;
  const origem = { x: P.H * (MAPA_TW / 2) + 40, y: MAPA_PAREDE + 60 + (P.nivelMax || 0) * MAPA_NIVEL_PX, nivelEm:P.nivelEm, alturaEm:P.alturaEm, nivelMax:P.nivelMax };
  const palco = document.createElement("div");
  palco.className = "mapa-palco";
  if (P.luz) palco.dataset.luz = P.luz;
  // Regulador de luz como no Habbo (nitro-react, updateRoomFilter): a cor do
  // regulador multiplica cada pixel do quarto, canal por canal (um filtro de
  // matriz de cor em piso, móveis e bonecos; o fundo em volta não muda).
  if (MAPA_LUZES_RGB[P.luz]) palco.style.setProperty("--mapa-luz", `url(#${mapaFiltroDaLuz(P.luz)})`);
  // Céu no horário de Irecê (UTC−3): madrugada, manhã, tarde, pôr do sol, noite.
  let fundoPronto = null;
  var luzesLigadas = false; // vira true quando os móveis terminam de carregar
  const paisagens = []; // janelas com o céu atrás (criarPaisagem)
  const ceu = () => {
    const h = new Date(Date.now() - 3 * 3600e3).getUTCHours();
    const agora = h < 5 ? "madrugada" : h < 11 ? "manha" : h < 16 ? "tarde" : h < 19 ? "por-do-sol" : "noite";
    if (el.dataset.ceu === agora) return;
    el.dataset.ceu = agora;
    fundoPronto?.(); // redesenha a cidade (dia claro / noite acesa)
    for (const p of paisagens) pintarPaisagem(p);
    if (luzesLigadas) pintarLuzes();
  };
  ceu();
  const relogioCeu = setInterval(ceu, 5 * 60e3);
  palco.style.width = largura + "px";
  palco.style.height = altura + "px";
  const fundo = document.createElement("canvas");
  fundo.width = largura; fundo.height = altura; fundo.className = "mapa-fundo";
  palco.append(fundo);
  // Zona onde a pessoa está: piso destacado com a cor da área e contorno.
  // Grade do editor: só do tamanho da área editada (uma tela inteira pesaria
  // na placa de vídeo), com o centro de cada ladrilho marcado.
  let gradeNo = null;
  function mostrarGrade(a) {
    gradeNo?.remove(); gradeNo = null;
    if (!a) return;
    // No quarto: só os ladrilhos de piso (o formato escolhido), cada um na
    // altura do patamar. A grade retangular cortava o escuro e as paredes.
    if (P.quarto && P.andavel) {
      const celulas = [];
      for (let x = a.x0; x < a.x1; x++) for (let y = a.y0; y < a.y1; y++) if (P.andavel(x, y) && P.nivelEm) celulas.push([x, y]);
      // Os quatro cantos de cada ladrilho na altura do patamar dele.
      const cantos = (x, y) => { const o = { ...origem, alturaAtual: P.nivelEm(x, y) || 0 }; return [mapaTela(x, y, o), mapaTela(x + 1, y, o), mapaTela(x + 1, y + 1, o), mapaTela(x, y + 1, o)]; };
      const pts = celulas.flatMap(([x, y]) => cantos(x, y));
      if (!pts.length) return;
      const l = Math.min(...pts.map((t) => t.x)) - 2, t0 = Math.min(...pts.map((t) => t.y)) - 2;
      gradeNo = document.createElement("canvas");
      gradeNo.width = Math.max(...pts.map((t) => t.x)) - l + 4; gradeNo.height = Math.max(...pts.map((t) => t.y)) - t0 + 4;
      gradeNo.className = "mapa-grade";
      gradeNo.style.left = l + "px"; gradeNo.style.top = t0 + "px";
      const g = gradeNo.getContext("2d");
      g.translate(-l, -t0); g.strokeStyle = "#ffffff40"; g.lineWidth = 1;
      for (const [x, y] of celulas) {
        const c = cantos(x, y);
        g.beginPath(); c.forEach((t, i) => (i ? g.lineTo(t.x, t.y) : g.moveTo(t.x, t.y))); g.closePath(); g.stroke();
      }
      palco.append(gradeNo);
      return;
    }
    const cantos = [mapaTela(a.x0, a.y0, origem), mapaTela(a.x1, a.y0, origem), mapaTela(a.x1, a.y1, origem), mapaTela(a.x0, a.y1, origem)];
    const l = Math.min(...cantos.map((t) => t.x)) - 2, t0 = Math.min(...cantos.map((t) => t.y)) - 2;
    const w = Math.max(...cantos.map((t) => t.x)) - l + 4, h = Math.max(...cantos.map((t) => t.y)) - t0 + 4;
    gradeNo = document.createElement("canvas");
    gradeNo.width = w; gradeNo.height = h;
    gradeNo.className = "mapa-grade";
    gradeNo.style.left = l + "px"; gradeNo.style.top = t0 + "px";
    const g = gradeNo.getContext("2d");
    g.translate(-l, -t0);
    g.strokeStyle = "#ffffff66"; g.lineWidth = 1;
    for (let x = a.x0; x <= a.x1; x++) { const p = mapaTela(x, a.y0, origem), q = mapaTela(x, a.y1, origem); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); }
    for (let y = a.y0; y <= a.y1; y++) { const p = mapaTela(a.x0, y, origem), q = mapaTela(a.x1, y, origem); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); }
    g.fillStyle = "#ffffff30";
    for (let x = a.x0; x < a.x1; x++) for (let y = a.y0; y < a.y1; y++) { const p = mapaTela(x + 0.5, y + 0.5, origem); g.fillRect(p.x - 1, p.y - 1, 2, 2); }
    palco.append(gradeNo);
  }
  el.replaceChildren(palco);
  const pintarFundo = () => { fundo.getContext("2d").clearRect(0, 0, fundo.width, fundo.height); mapaDesenharFundo(fundo, P, origem); };
  pintarFundo();
  fundoPronto = pintarFundo;
  // Pisos do acervo: carrega a arte de cada um uma vez e redesenha o fundo.
  const classesPiso = [...new Set([P.texturaSalas, P.texturaCorredor, P.texturaDeck, ...(P.texturas || []).map((r) => r.textura),
    ...(P.ambientes || []).map((a) => a.textura), ...(P.pisos || []).map((q) => q.textura)].filter(Boolean))];
  if (classesPiso.some(mapaEhPlano) || P.divisorias.some((d) => mapaEhPlano(d.textura) || d.sala && mapaEhPlano(MAPA_TEXTURA_SALA)))
    mapaCarregarPlanos().then(() => { pintarFundo(); try { pintarParedes(true); } catch {} }).catch((e) => console.warn(e.message));
  if (classesPiso.length) Promise.all(classesPiso.filter((c) => !mapaEhPlano(c)).map(async (c) => {
    try {
      const m = await mapaCarregarMovel(c), dim = m.dados.logic?.model?.dimensions || {};
      const d = mapaDesenharMovel(m, mapaDirecaoValida(m.dados, 0), 0, 0);
      return d ? [c, { ...d, dw: Math.max(1, Math.round(dim.x || 1)), dh: Math.max(1, Math.round(dim.y || 1)) }] : null;
    } catch { return null; }
  })).then((lista) => { P.texturasProntas = new Map(lista.filter(Boolean)); pintarFundo(); });

  // Ponto do item na parede. Como no Habbo (LegacyWallGeometry), a posição
  // ao longo da parede é livre: o ajuste fino (¼ de ladrilho) desliza o item.
  const mapaAncoraParede = (x, y, dir) => (dir === 2 ? mapaTela(Math.floor(x), y + 0.5, origem) : mapaTela(x + 0.5, Math.floor(y), origem));
  // Como no Nitro (RoomObjectLocationCacheItem), a posição na tela é
  // arredondada para o pixel antes de somar o deslocamento da arte: sem
  // isso, peça em meio ladrilho ou altura quebrada saía borrada e meio
  // pixel fora da vizinha.
  const colocar = (no, x, y, desenho, prof) => {
    const t = mapaTela(x, y, origem);
    no.style.left = Math.round(t.x + desenho.ox) + "px";
    no.style.top = Math.round(t.y + desenho.oy) + "px";
    if (prof != null) no.style.zIndex = prof;
  };
  // Divisórias. Parede na frente de alguém fica transparente (recorte), para
  // ninguém sumir atrás dela.
  const muros = [];
  const recortar = (id, l, t, r, b, prof) => {
    for (const m of muros) {
      const cobre = m.prof > prof && m.l < r && m.r > l && m.t < b && m.b > t;
      if (cobre === m.quem.has(id)) continue;
      cobre ? m.quem.add(id) : m.quem.delete(id);
      m.no.classList.toggle("recortado", m.quem.size > 0);
    }
  };
  for (const dv of P.divisorias) {
    // 6º campo: estilo padrão do trecho (vidro na reunião, tijolo no Lounge…).
    const [x0, y0, x1, y1, cor] = dv, estiloBase = dv.estilo;
    // Painel do acervo: o que o dono pintou, senão o do espaço (ou o padrão da sala).
    const texturaDe = (est) => dv.recorte ? null : (est?.estilo ? (est.estilo === "a" ? MAPA_TEXTURA_SALA : MAPA_ESTILO_TEXTURA[est.estilo] || null) : dv.textura || (dv.sala ? MAPA_TEXTURA_SALA : null));
    const eixo = y0 === y1 ? "x" : "y";
    const n = eixo === "x" ? x1 - x0 : y1 - y0;
    for (let i = 0; i < n; i++) {
      const x = eixo === "x" ? x0 + i : x0, y = eixo === "x" ? y0 : y0 + i;
      const est = P.paredeEm?.(x, y, eixo);
      const d = mapaDivisoria(x, y, eixo, est?.cor || cor, [], est?.estilo || estiloBase, est?.alt ?? dv.alt, texturaDe(est), Boolean(dv.sala) && !dv.janela && !dv.semTinta, dv.espessura ?? 1);
      d.canvas.className = "mapa-obj mapa-muro";
      // Parede do fundo: atrás de tudo, como os planos do Habbo. Mureta da
      // frente (baixa): no plano dela, meio ladrilho atrás do ladrilho (Nitro).
      const prof = dv.baixa ? mapaZ(mapaProfundidade(x, y - 0.5)) : 2000 + Math.round((x + y) * 10) + 2;
      colocar(d.canvas, x, y, d, prof);
      palco.append(d.canvas);
      const t = mapaTela(x, y, origem), l = t.x + d.ox, tp = t.y + d.oy;
      const caixa = eixo === "x" ? { x0: x, x1: x + 1, y0: y, y1: y } : { x0: x, x1: x, y0: y, y1: y + 1 };
      muros.push({ no: d.canvas, prof, caixa, l, t: tp, r: l + d.canvas.width, b: tp + d.canvas.height, quem: new Set(), x, y, eixo, cor: est?.cor || cor, estilo: est?.estilo || estiloBase, estiloBase, alt: est?.alt ?? dv.alt, altBase: dv.alt, textura: texturaDe(est), texturaDe, tingir: Boolean(dv.sala) && !dv.janela && !dv.semTinta, espessura: dv.espessura ?? 1 });
    }
  }
  // Painéis de parede do acervo: carrega os usados e redesenha as paredes.
  const classesParede = [...new Set([MAPA_TEXTURA_SALA, ...Object.values(MAPA_ESTILO_TEXTURA), ...P.divisorias.map((d) => d.textura)].filter(Boolean))];
  Promise.all(classesParede.filter((c) => !MAPA_TEXTURAS_PAREDE.has(c) && !mapaEhPlano(c)).map(async (c) => {
    try {
      const m = await mapaCarregarMovel(c), n = Math.max(1, Math.round(m.dados.logic?.model?.dimensions?.x || 1));
      const d4 = mapaDesenharMovel(m, 4, 0, 0), d2 = mapaDesenharMovel(m, 2, 0, 0);
      // Só a parte desenhada do painel ladrilha a parede (as margens
      // transparentes da arte deixavam faixas da base escura aparecendo nas
      // paredes mais altas que o painel).
      if (d4 && d2) MAPA_TEXTURAS_PAREDE.set(c, { 4: d4.canvas, 2: d2.canvas, n, recorte: { 4: mapaRecorteOpaco(d4.canvas), 2: mapaRecorteOpaco(d2.canvas) } });
    } catch {}
  })).then(() => { try { pintarParedes(true); } catch {} });
  // Altura da parede num trecho (para os itens pendurados): a do muro da
  // planta, ou a do prédio nas paredes de fora.
  const mapaAlturaParede = (x, y, eixo) => {
    const m = muros.find((w) => w.eixo === eixo && w.x === x && w.y === y);
    if (m) return m.alt || (m.cor ? MAPA_PAREDE : 46);
    return (eixo === "x" && y === P.PREDIO?.y0) || (eixo === "y" && x === P.PREDIO?.x0) ? MAPA_PAREDE : 46;
  };
  // Janelas: a paisagem atrás do vidro, logo atrás da janela.
  function criarPaisagem(item, desenho) {
    const mascara = mapaMascaraJanela(item.m, item.dir);
    if (!mascara) return;
    const c = document.createElement("canvas");
    c.width = mascara.canvas.width; c.height = mascara.canvas.height;
    c.className = "mapa-obj mapa-paisagem";
    c.style.left = parseFloat(item.no.style.left) - desenho.ox + mascara.x + "px";
    c.style.top = parseFloat(item.no.style.top) - desenho.oy + mascara.y + "px";
    c.style.zIndex = String(Number(item.no.style.zIndex) - 1);
    const p = { c, mascara, item };
    pintarPaisagem(p);
    palco.append(c);
    paisagens.push(p);
  }
  // Raio de sol entrando pela janela (como a luz desenhada das referências de
  // construtores): um feixe quente e suave da borda de baixo da janela até o
  // chão, inclinado para dentro do quarto. Só nas cenas que pedem (raiosDeSol).
  function criarRaioDeSol(item) {
    const L = parseFloat(item.no.style.left), T = parseFloat(item.no.style.top), W = item.no.width, H = item.no.height;
    const fundo = item.dir !== 2, B = T + H * 0.82;
    const a = fundo ? [L, B] : [L, B + W / 2], b = fundo ? [L + W, B + W / 2] : [L + W, B];
    const v = fundo ? [-70, 170] : [70, 170];
    const pts = [a, b, [b[0] + v[0], b[1] + v[1]], [a[0] + v[0], a[1] + v[1]]];
    const x0 = Math.min(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1]));
    const x1 = Math.max(...pts.map((p) => p[0])), y1 = Math.max(...pts.map((p) => p[1]));
    const n = document.createElement("i");
    n.className = "mapa-raio-sol";
    n.style.left = x0 + "px"; n.style.top = y0 + "px"; n.style.width = x1 - x0 + "px"; n.style.height = y1 - y0 + "px";
    n.style.clipPath = `polygon(${pts.map(([x, y]) => `${x - x0}px ${y - y0}px`).join(",")})`;
    palco.append(n);
  }
  // Figurantes da cena (cozinheiro, garçom): boneco do Habbo parado, com a
  // mesma posição e profundidade de quem anda, mas fora da lista de pessoas.
  // Figurante senta só num assento de verdade, na direção dele (como quem
  // para num assento); sem assento no ladrilho, fica de pé. Assim um móvel
  // tirado do lugar não deixa ninguém sentado no chão. Remonta do zero
  // quando a grade muda (portão), sem duplicar.
  function montarFigurantes() {
    for (const n of palco.querySelectorAll(".mapa-pessoa.figurante")) n.remove();
    for (const [i, f0] of (P.figurantes || []).entries()) {
      const dirAssento = grade?.assento.get(grade.ind(f0.x, f0.y));
      const f = f0.acao === "sit" ? (dirAssento === undefined ? { ...f0, acao: "std" } : { ...f0, dir: dirAssento }) : f0;
      const no = document.createElement("div");
      no.className = "mapa-pessoa figurante";
      no.setAttribute("aria-hidden", "true");
      const img = document.createElement("img");
      img.alt = ""; img.draggable = false; img.referrerPolicy = "no-referrer";
      no.append(img);
      palco.append(no);
      const p = { id: "figurante-" + i, no, img, etiqueta: document.createElement("span"), x: f.x, y: f.y, dir: f.dir ?? 4, acao: f.acao || "std", figura: f.figura, mao: f.mao || "" };
      posicionarPessoa(p);
      trocarImagem(p);
    }
  }
  function pintarPaisagem(p) {
    const g = p.c.getContext("2d");
    g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, p.c.width, p.c.height);
    mapaPintarPaisagem(p.c, el.dataset.ceu);
    g.globalCompositeOperation = "destination-in"; g.drawImage(p.mascara.canvas, 0, 0);
    g.globalCompositeOperation = "source-over";
  }
  // Móveis (animados ficam numa lista para trocar de quadro)
  const animados = [];
  const moveis = [];
  // Fogo, água, telas e máquinas são o cenário, não efeito de interface: com
  // "reduzir movimento" eles continuam, só mais devagar (metade dos tiques).
  // O que a preferência desliga é a câmera com inércia, o fundo e os pulsos.
  const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const semente = (x, y) => (Math.floor(x) * 7 + Math.floor(y) * 13) % 97;
  // Móveis ligados/desligados pela equipe ("classe@x,y" → estado), inclusive
  // os que chegam antes de o móvel terminar de carregar.
  const estadosForcados = new Map();
  // A chave é do lugar onde o móvel foi posto (a bola rola e continua a mesma).
  const chaveMovel = (m) => m.chaveFixa || `${m.classe}@${Math.floor(m.x)},${Math.floor(m.y)}`;
  // Move só o desenho de um móvel (a bola chutada), sem mexer na decoração salva.
  // Profundidade de um móvel (Nitro): ladrilho de origem e altura; o de
  // parede fica no plano da parede, meio ladrilho para trás.
  const profMovel = (m) => (m.parede
    ? (m.dir === 2 ? mapaProfundidade(Math.floor(m.x) - 0.5, m.y, m.altura || 0) : mapaProfundidade(m.x, Math.floor(m.y) - 0.5, m.altura || 0)) + (m.profArte || 0)
    : mapaProfundidade(m.x, m.y, m.altura || 0));
  // Camadas extras do item de parede seguem a principal (posição e destaque).
  const juntarCamadasParede = (m) => {
    for (const e of m.extras || []) { e.no.style.left = m.no.style.left; e.no.style.top = m.no.style.top; }
  };
  // Redesenha o item de parede, camada a camada (ou inteiro, se for uma só).
  const redesenharParede = (item, estado, q) => {
    const alvos = item.grupos ? [{ no: item.no, chave: item.grupos[0].chave }, ...(item.extras || [])] : [{ no: item.no }];
    let ref = null;
    for (const a of alvos) {
      const filtro = a.chave == null ? item.filtro : (p) => mapaGrupoCamada(p) === a.chave && (!item.filtro || item.filtro(p));
      const d = mapaDesenharMovel(item.m, item.dir, estado, q, item.semente || 0, filtro);
      const g = a.no.getContext("2d");
      if (!d) { g.clearRect(0, 0, a.no.width, a.no.height); continue; }
      ref ??= d;
      if (a.no.width !== d.canvas.width || a.no.height !== d.canvas.height) { a.no.width = d.canvas.width; a.no.height = d.canvas.height; }
      else g.clearRect(0, 0, a.no.width, a.no.height);
      g.drawImage(d.canvas, 0, 0);
    }
    return ref;
  };
  const ordenarMovel = (m) => {
    if (m.revestimento) { m.no.style.zIndex = m.prof = mapaZRevestimento(m.profArte); return; }
    const base = profMovel(m);
    const z = (prof) => (m.plano && !m.parede ? mapaZPlano(prof) : mapaZ(prof));
    if (!m.camadas) {
      m.no.style.zIndex = m.prof = z(base);
      for (const e of m.extras || []) e.no.style.zIndex = z(base - (m.profArte || 0) + e.prof);
      return;
    }
    let frente = Infinity;
    for (const c of m.camadas) {
      c.no.style.zIndex = z(base + c.prof);
      if (c.prof < MAPA_PROF_SOMBRA) frente = Math.min(frente, base + c.prof);
    }
    m.prof = z(frente < Infinity ? frente : base);
  };
  // Cada camada do móvel num canvas, todos no lugar do contêiner. O contêiner
  // não tem z-index nem filtro (não cria contexto de empilhamento): as camadas
  // se intercalam com as dos outros móveis e com os bonecos pela profundidade.
  // width/height do contêiner guardam as medidas, como num canvas.
  // Cada quadro da animação tem o seu recorte (o vapor aparece e some): a
  // posição segue o ponto de registro do quadro, como no Nitro; senão a peça
  // "descia" para dentro do que está embaixo a cada quadro menor.
  const seguirRegistro = (m, d) => {
    if (m.ox === undefined) { m.ox = d.ox; m.oy = d.oy; return; }
    if (d.ox === m.ox && d.oy === m.oy) return;
    m.no.style.left = parseFloat(m.no.style.left) + d.ox - m.ox + "px";
    m.no.style.top = parseFloat(m.no.style.top) + d.oy - m.oy + "px";
    m.ox = d.ox; m.oy = d.oy;
  };
  const pintarMovel = (m, d) => {
    seguirRegistro(m, d);
    const no = m.no;
    no.width = d.canvas.width; no.height = d.canvas.height;
    no.style.width = no.width + "px"; no.style.height = no.height + "px";
    const antigas = m.camadas || [];
    m.camadas = d.camadas.map((c, i) => {
      const cv = antigas[i]?.no || document.createElement("canvas");
      const g = cv.getContext("2d");
      if (cv.width !== c.canvas.width || cv.height !== c.canvas.height) { cv.width = c.canvas.width; cv.height = c.canvas.height; }
      else g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(c.canvas, 0, 0);
      // Camada de luz (ADD): soma com o que está atrás, como no Habbo.
      cv.style.mixBlendMode = c.luz ? "plus-lighter" : "";
      if (!cv.parentNode) no.append(cv);
      return { no: cv, prof: c.prof };
    });
    for (const c of antigas.slice(m.camadas.length)) c.no.remove();
    for (const c of m.camadas) if (c.prof === MAPA_PROF_SOMBRA) c.no.hidden = Boolean(m.pendurado);
    ordenarMovel(m);
  };
  function deslocarMovel(m, x, y) {
    m.chaveFixa ||= chaveMovel(m);
    const a = mapaTela(m.x, m.y, origem), b = mapaTela(x, y, origem);
    m.no.style.left = parseFloat(m.no.style.left) + b.x - a.x + "px";
    m.no.style.top = parseFloat(m.no.style.top) + b.y - a.y + "px";
    m.x = x; m.y = y;
    if (m.caixa) m.caixa = { ...m.caixa, x0: Math.floor(x), x1: Math.floor(x) + (m.caixa.x1 - m.caixa.x0), y0: Math.floor(y), y1: Math.floor(y) + (m.caixa.y1 - m.caixa.y0) };
    ordenarMovel(m);
  }
  // Animação de passagem entre estados, como no Nitro
  // (FurnitureAnimatedVisualization): primeiro a que sai do estado atual
  // (transitionFrom), senão a que entra no novo (transitionTo). Toca uma vez
  // desde o primeiro quadro e termina no estado novo.
  const mapaTransicao = (dados, de, para) => {
    const anims = dados.visualizations.find((v) => v.size === 64)?.animations || {};
    const ks = Object.keys(anims);
    return ks.find((k) => anims[k].transitionFrom === de) ?? ks.find((k) => anims[k].transitionTo === para) ?? null;
  };
  const aplicarEstado = (item, estado, animar = true) => {
    if (item.estado === estado) return;
    const passagem = animar && !reduzido && item.m ? mapaTransicao(item.m.dados, item.estado || 0, estado) : null;
    item.transicao = passagem ? { chave: Number(passagem), inicio: quadro, fim: quadro + mapaQuadros(item.m.dados, passagem) } : null;
    const d = mapaCamadasMovel(item.m, item.dir, passagem ? Number(passagem) : estado, 0, item.semente || 0);
    if (!d) return;
    item.ligadoPadrao ??= item.estado || 1;
    item.estado = estado;
    item.quadros = mapaQuadros(item.m.dados, estado);
    if (item.parede) redesenharParede(item, passagem ? Number(passagem) : estado, 0);
    else pintarMovel(item, d);
    if (item.parede) {
      const anc = mapaAncoraParede(item.x, item.y, item.dir);
      item.no.style.left = Math.round(anc.x) + d.ox + MAPA_PAREDE_AJUSTE[item.dir].x + "px";
      item.no.style.top = Math.round(anc.y - item.altura * 32) + d.oy + MAPA_PAREDE_AJUSTE[item.dir].y + "px";
      juntarCamadasParede(item);
    } else colocar(item.no, ...mapaPosicaoPorta(item.classe, item.x, item.y, item.dir), { ...d, oy: d.oy + MAPA_MOVEL_Y - item.altura * 32 + (item.classe === "bc_stairs_recolorable" ? (P.alturaEm?.(item.x, item.y) || 0) * MAPA_NIVEL_PX : 0) });
    const i = animados.indexOf(item);
    if (i >= 0) animados.splice(i, 1);
    if (item.quadros > 1 || item.transicao) animados.push(item);
  };
  function estadosMoveis(lista) {
    let portao = false;
    for (const [chave, estado] of lista || []) {
      estadosForcados.set(chave, estado);
      // Portão e móvel de altura ajustável mudam a passagem e a altura de quem está em cima.
      for (const m of moveis) if (chaveMovel(m) === chave) { aplicarEstado(m, estado); if (mapaEhPortao(m.classe) || mapaFisica(m.classe).alturas) portao = true; }
    }
    if (luzesLigadas) pintarLuzes();
    // Portão abriu ou fechou: a passagem muda para todos.
    if (portao && grade) { grade = mapaMontarGrade(P, moveis); for (const p of pessoas.values()) posicionarPessoa(p); if (montarFigurantesDepois) montarFigurantes(); }
  }
  // Imagens da equipe ("vybeimg_<id>"): quadro pintado na parede alta da
  // sala; tapete desenhado no piso (rente ao chão, dá para andar por cima).
  const IMAGENS = new Map((P.imagens || []).map((i) => ["vybeimg_" + i.id, i]));
  const urlImagem = (id) => (P.urlImagem ? P.urlImagem(id) : "/api/painel?area=escritorio&acao=imagem&id=" + encodeURIComponent(id));
  const imagensCarregadas = new Map();
  const carregarImagem = (id) => {
    if (!imagensCarregadas.has(id)) imagensCarregadas.set(id, new Promise((ok, erro) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => erro(new Error("Imagem indisponível."));
      img.src = urlImagem(id);
    }));
    return imagensCarregadas.get(id);
  };
  const quadrosParede = [];
  function pintarParedes(forcar = false) {
    for (const m of muros) {
      if (!m.cor && !m.alt && !m.pintadoAntes) continue;
      m.pintadoAntes = Boolean(m.cor || m.alt);
      const fatias = [];
      for (const q of quadrosParede) {
        if (q.dir === 4 && m.eixo === "x" && m.y === q.y && m.x >= q.x && m.x < q.x + q.w) {
          const u0 = (m.x - q.x) / q.w; fatias.push({ img: q.img, u0, u1: u0 + 1 / q.w, h: q.h });
        }
        if (q.dir === 2 && m.eixo === "y" && m.x === q.x && m.y >= q.y && m.y < q.y + q.w) {
          const u0 = (q.y + q.w - m.y - 1) / q.w; fatias.push({ img: q.img, u0, u1: u0 + 1 / q.w, h: q.h });
        }
      }
      if (!fatias.length && !m.pintado && !forcar) continue;
      const d = mapaDivisoria(m.x, m.y, m.eixo, m.cor, fatias, m.estilo, m.alt, m.textura, m.tingir, m.espessura);
      // A altura pode ter mudado: o canvas e a posição acompanham.
      if (m.no.height !== d.canvas.height) { m.no.width = d.canvas.width; m.no.height = d.canvas.height; colocar(m.no, m.x, m.y, d, m.prof); m.t = parseFloat(m.no.style.top); m.b = m.t + m.no.height; }
      const g = m.no.getContext("2d");
      g.clearRect(0, 0, m.no.width, m.no.height);
      g.drawImage(d.canvas, 0, 0);
      m.pintado = fatias.length > 0;
    }
  }
  async function montarImagem(meta, x, y, dir, origemItem) {
    const img = await carregarImagem(meta.id);
    const w = meta.largura, h = meta.altura;
    if (meta.tipo === "quadro") {
      quadrosParede.push({ x: Math.floor(x), y: Math.floor(y), dir, w, h, img, origem: origemItem });
      return;
    }
    const c = document.createElement("canvas");
    c.width = (w + h) * (MAPA_TW / 2); c.height = (w + h) * (MAPA_TH / 2);
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.setTransform(w * MAPA_TW / 2, w * MAPA_TH / 2, -h * MAPA_TW / 2, h * MAPA_TH / 2, h * MAPA_TW / 2, 0);
    g.drawImage(img, 0, 0, 1, 1);
    c.className = "mapa-obj";
    c.dataset.classe = "vybeimg_" + meta.id;
    colocar(c, x, y, { ox: -h * (MAPA_TW / 2), oy: 0 }, 1);
    palco.append(c);
    const caixa = { x0: Math.floor(x), x1: Math.floor(x) + w, y0: Math.floor(y), y1: Math.floor(y) + h, altura: 0 };
    moveis.push({ classe: "vybeimg_" + meta.id, x, y, dir, estado: 0, m: null, no: c, quadros: 1, dim: { x: w, y: h, z: 0 }, altura: 0, plano: true, prof: 1, caixa, origem: origemItem });
  }
  // altura: em unidades do Habbo (1 = 32 px), para o que fica em cima de mesas.
  const montar = async ([classe, x, y, dir, estado, altura = 0, origemItem = null]) => {
    if (classe.startsWith("vybeimg_")) {
      const meta = IMAGENS.get(classe);
      if (meta) await montarImagem(meta, x, y, dir, origemItem).catch((e) => console.warn(e.message));
      return;
    }
    try {
      const m = await mapaCarregarMovel(classe);
      // Item de parede: "dir" diz a parede (4 = fundo, que desce para a
      // direita; 2 = esquerda, que desce para a esquerda), igual à arte do Habbo.
      const deParede = mapaEhDeParede(m.dados, classe);
      const d0 = deParede ? (dir === 2 ? 2 : 4) : mapaDirecaoValida(m.dados, dir);
      // Refletor de festa (furniture_party_beamer): as camadas 2 e 3 são os
      // focos de luz, desenhados à parte para varrer o quarto.
      const feixe = m.dados.visualizationType === "furniture_party_beamer";
      const semFocos = feixe ? (p) => p.ordem !== 2 && p.ordem !== 3 : undefined;
      const desenhoFeixe = feixe && mapaDesenharMovel(m, d0, estado, 0, 0, semFocos);
      const desenho = desenhoFeixe ? { ...desenhoFeixe, camadas: [{ canvas: desenhoFeixe.canvas, prof: 0 }] } : mapaCamadasMovel(m, d0, estado, 0);
      // Focos do refletor por cima de tudo (luz somada), no mesmo registro da peça.
      const criarFocos = (no, z) => {
        for (const k of [2, 3]) {
          const f = mapaDesenharMovel(m, d0, estado, 0, 0, (p) => p.ordem === k);
          if (!f) continue;
          f.canvas.className = "mapa-obj mapa-feixe";
          f.canvas.style.left = no.style.left; f.canvas.style.top = no.style.top; f.canvas.style.zIndex = String(z);
          palco.append(f.canvas);
          focos.push({ no: f.canvas, x: parseFloat(no.style.left), y: parseFloat(no.style.top), fase: Math.random() * MAPA_FEIXE_AREA * 1.5, sentido: k === 2 ? 1 : -1, vel: k === 2 ? 2 : 1, fator: mapaFatorFeixe() });
        }
      };
      if (!desenho) return;
      const dim = mapaDimensoes(m.dados, d0);
      // De parede: pendurado no trecho de parede do ladrilho, a "altura"
      // (em ladrilhos de parede, 1 = 32 px) acima do chão. Não bloqueia o piso.
      if (deParede) {
        const ancora = mapaAncoraParede(x, y, d0);
        // Como no Nitro, cada camada da arte do item de parede fica na sua
        // profundidade (z do Habbo): a moldura pode passar na frente de um
        // item vizinho e o fundo dela atrás. O revestimento fica inteiro na
        // faixa do fundo da parede; o refletor tem os focos à parte.
        // Medidas da ficha, sem girar (na parede da esquerda as medidas do
        // mapa vêm trocadas e o papel deixava de ser revestimento).
        const revest = mapaEhRevestimento(m.dados.logic?.model?.dimensions, true);
        const grupos = !feixe && !revest && desenho.grupos?.length > 1 ? desenho.grupos : null;
        const doGrupo = (g) => mapaDesenharMovel(m, d0, estado, 0, 0, (p) => mapaGrupoCamada(p) === g.chave)?.canvas;
        const no = (grupos && doGrupo(grupos[0])) || desenho.canvas;
        no.className = "mapa-obj mapa-de-parede";
        no.dataset.classe = classe;
        no.style.left = Math.round(ancora.x) + desenho.ox + MAPA_PAREDE_AJUSTE[d0].x + "px";
        // A parede tem altura própria (prédio 118, sala 82 ou a que o dono
        // pintou, divisória baixa 46): o item fica sempre dentro dela, sem
        // passar do topo (antes as janelas "flutuavam" acima das paredes das salas).
        let topo = Math.round(ancora.y - altura * 32) + desenho.oy + MAPA_PAREDE_AJUSTE[d0].y;
        const altParede = mapaAlturaParede(Math.floor(x), Math.floor(y), d0 === 2 ? "y" : "x");
        const teto = ancora.y - altParede + 4, h = no.height;
        if (topo < teto) topo = teto;
        if (topo + h > ancora.y + 2) topo = Math.max(teto, ancora.y + 2 - h);
        no.style.top = topo + "px";
        palco.append(no);
        const extras = (grupos || []).slice(1).map((g) => {
          const c = doGrupo(g);
          if (!c) return null;
          c.className = no.className; c.dataset.classe = classe;
          if (g.luz) c.style.mixBlendMode = "plus-lighter";
          palco.append(c);
          return { no: c, chave: g.chave, prof: g.prof };
        }).filter(Boolean);
        const item = { classe, x, y, dir: d0, estado, m, no, quadros: mapaQuadros(m.dados, estado), dim: { x: 1, y: 1, z: 0 }, altura, plano: true, parede: true, lado: dir === 2 ? 2 : 4, prof: 0, profArte: grupos ? grupos[0].prof : mapaProfFundoParede(m.dados, d0), revestimento: revest, grupos, extras, caixa: null, origem: origemItem, semente: semente(x, y), ox: desenho.ox, oy: desenho.oy };
        juntarCamadasParede(item);
        ordenarMovel(item);
        if (feixe) { item.filtro = semFocos; criarFocos(no, Number(no.style.zIndex || 0) + 1); }
        if (m.dados.logicType === "furniture_window") criarPaisagem(item, desenho);
        if (P.raiosDeSol && /window/.test(classe)) criarRaioDeSol(item);
        moveis.push(item);
        if (item.quadros > 1) animados.push(item);
        if (estadosForcados.has(chaveMovel(item))) aplicarEstado(item, estadosForcados.get(chaveMovel(item)), false);
        return;
      }
      // Rente ao piso (tapete): altura zero E desenho baixo. Muita arte do Habbo
      // declara altura zero mesmo sendo alta (sinuca, TV, bebedouro): essa é sólida.
      // Em cima de mesa nunca é "rente ao piso" (notebook, papéis).
      // Na ficha do Habbo, o que não se pisa nunca é rente ao piso, mesmo com
      // altura zero e desenho baixo (mesa de carretel): senão as cadeiras em
      // volta são desenhadas por cima dela.
      const plano = !altura && !(dim.z > 0.05) && desenho.canvas.height <= (dim.x + dim.y) * (MAPA_TH / 2) + 12 && (!MAPA_FISICA?.[classe] || mapaFisica(classe).pisa);
      const no = document.createElement("div");
      no.className = "mapa-obj mapa-movel";
      no.dataset.classe = classe;
      // A peça de escada fica apoiada no piso de baixo (a rampa de quem anda
      // por ela sobe até o mezanino; sem isso ela aparecia no meio da subida).
      const apoio = classe === "bc_stairs_recolorable" ? (P.alturaEm?.(x, y) || 0) * MAPA_NIVEL_PX : 0;
      colocar(no, ...mapaPosicaoPorta(classe, x, y, d0), { ...desenho, oy: desenho.oy + MAPA_MOVEL_Y - altura * 32 + apoio });
      palco.append(no);
      const caixa = { x0: Math.floor(x), x1: Math.floor(x) + Math.max(1, Math.round(dim.x)), y0: Math.floor(y), y1: Math.floor(y) + Math.max(1, Math.round(dim.y)), altura };
      const item = { classe, x, y, dir: d0, estado, m, no, quadros: mapaQuadros(m.dados, estado), dim, altura, plano, prof: 0, caixa, origem: origemItem, semente: semente(x, y) };
      pintarMovel(item, desenho);
      if (feixe) { item.filtro = semFocos; item.quadros = 1; criarFocos(no, 90000); }
      moveis.push(item);
      if (item.quadros > 1) animados.push(item);
      if (estadosForcados.has(chaveMovel(item))) aplicarEstado(item, estadosForcados.get(chaveMovel(item)), false);
    } catch (e) {
      console.warn(e.message);
    }
  };
  let grade = null, selecionado = null, montarFigurantesDepois = false;
  // Fundo colorido do Habbo (furniture_background_color): a peça ligada pinta
  // o vazio em volta do quarto com a cor gravada nela (nitro-react tinge o
  // fundo, não o quarto). Sem ela, vale o fundo da cena.
  function aplicarFundoColorido() {
    const cor = (m) => m.origem?.cfg?.c || "";
    const toner = moveis.find((m) => mapaFisica(m.classe).logica === "fundo" && m.estado >= 1 && /^#[0-9a-f]{6}$/i.test(cor(m)));
    if (toner) el.style.setProperty("--fundo-cena", cor(toner));
  }
  // Luz das luminárias no chão: um brilho suave em volta de cada luz ligada,
  // mais forte à noite (o céu segue o horário de Irecê).
  const LUZ = /lamp|light|lantern|candle|torch|chandelier|neon|spotlight|fireplace|jukebox|bump_lights|floornutlight/i;
  const luzes = [];
  function pintarLuzes() {
    for (const n of luzes) n.remove();
    luzes.length = 0;
    // Sala na penumbra (luz "bar", como o regulador de luz baixo do Habbo):
    // as luzes valem a noite toda, sem depender do horário de Irecê.
    const penumbra = palco.dataset.luz === "bar";
    const forca = penumbra ? 1 : { noite: 1, madrugada: 1, "por-do-sol": 0.7, manha: 0.3, tarde: 0.25 }[el.dataset.ceu] ?? 0.5;
    const brilho = (x, y, classe, extra) => {
      const n = document.createElement("i");
      n.className = "mapa-luz" + (extra ? " " + extra : "");
      n.style.left = x + "px"; n.style.top = y + "px";
      n.style.setProperty("--forca", String(forca));
      if (/fireplace|candle|torch/.test(classe)) n.classList.add("fogo");
      palco.append(n);
      luzes.push(n);
    };
    for (const m of moveis) {
      if (!LUZ.test(m.classe) || m.estado === 0 && !/fireplace|candle|torch/.test(m.classe)) continue;
      const t = mapaTela(Math.floor(m.x) + m.dim.x / 2, Math.floor(m.y) + m.dim.y / 2, origem);
      brilho(t.x, t.y, m.classe);
      // Lâmpada pendurada: além da luz no chão, o halo em volta da lâmpada.
      if (m.pendurado && m.altura > 1) brilho(t.x, t.y - m.altura * 32 + 4, m.classe, "no-alto");
    }
  }
  // Profundidade de paredes e móveis (os tapetes ficam rente ao piso, embaixo).
  // Profundidade de cada móvel e camada pela fórmula do Habbo (as paredes
  // ganham a delas ao serem criadas).
  // Peça fina no alto sem nada embaixo (planta, hera, luz e viga penduradas): sem
  // sombra no ar e sem virar chão (passa-se por baixo dela, no piso).
  const marcarPendurados = () => {
    for (const m of moveis) {
      // Só peça fina (altura ~0 na ficha do Habbo): bloco e ponte no alto continuam chão.
      // Piso de construtor no alto (assoalho, tábua, ladrilho: o mezanino do
      // Café) é chão, como no Habbo; pendurado é só a decoração (hera, luzes).
      if (m.parede || !(m.altura > 0) || mapaAlturaMovel(m) > 0.05 || mapaEhPisoDeObra(m.classe)) { m.pendurado = false; continue; }
      const x0 = Math.floor(m.x), y0 = Math.floor(m.y), x1 = x0 + Math.max(1, Math.round(m.dim.x)), y1 = y0 + Math.max(1, Math.round(m.dim.y));
      m.pendurado = !moveis.some((o) => o !== m && !o.parede && Math.floor(o.x) < x1 && Math.floor(o.x) + Math.max(1, Math.round(o.dim.x)) > x0 && Math.floor(o.y) < y1 && Math.floor(o.y) + Math.max(1, Math.round(o.dim.y)) > y0 && (o.altura || 0) < m.altura && mapaTopoMovel(o) >= m.altura - 0.15);
      for (const c of m.camadas || []) if (c.prof === MAPA_PROF_SOMBRA) c.no.hidden = m.pendurado;
    }
  };
  const ordenar = () => { for (const m of moveis) ordenarMovel(m); marcarPendurados(); };
  // Depois de ordenar, quem já estava no mapa ganha a profundidade nova (sem
  // isso, quem chegou antes dos móveis carregarem ficava atrás das paredes).
  // Quantos móveis já carregaram (a tela de entrada mostra a porcentagem).
  const carga = { feitos: 0, total: P.moveis.length, pronto: false };
  // A grade só é montada com a ficha de física do Habbo carregada.
  const prontos = Promise.all([mapaCarregarFisica(), ...P.moveis.map((item) => montar(item).finally(() => { carga.feitos++; }))]).then(() => { ordenar(); pintarParedes(); luzesLigadas = true; pintarLuzes(); aplicarFundoColorido(); montarFigurantesDepois = true; grade = mapaMontarGrade(P, moveis); for (const p of pessoas.values()) posicionarPessoa(p); if (montarFigurantesDepois) montarFigurantes(); carga.pronto = true; });
  // Editor: troca toda a mobília (os modelos já carregados vêm do cache).
  // Uma troca por vez: duas seguidas (editar e salvar) desenhavam os móveis
  // em dobro, porque a segunda limpava enquanto a primeira ainda montava.
  let filaMoveis = prontos;
  function definirMoveis(lista) {
    filaMoveis = filaMoveis.catch(() => {}).then(() => trocarMoveis(lista));
    return filaMoveis;
  }
  async function trocarMoveis(lista) {
    await trocarMoveisAgora(lista);
    // A ordem das paredes pode ter mudado: os post-its voltam para a frente delas.
    if (postitsAtuais) postits(...postitsAtuais);
  }
  async function trocarMoveisAgora(lista) {
    for (const item of moveis) { item.no.remove(); for (const e of item.extras || []) e.no.remove(); }
    for (const p of paisagens) p.c.remove();
    paisagens.length = 0;
    moveis.length = 0;
    animados.length = 0;
    quadrosParede.length = 0;
    await Promise.all(lista.map(montar));
    ordenar();
    pintarParedes();
    pintarLuzes();
    grade = mapaMontarGrade(P, moveis);
    for (const p of pessoas.values()) posicionarPessoa(p);
    destacar(selecionado);
  }
  // Móveis que ocupam o ladrilho, do mais à frente para o mais atrás.
  function moveisEm(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    return moveis.filter((m) => tx >= Math.floor(m.x) && tx < Math.floor(m.x) + m.dim.x && ty >= Math.floor(m.y) && ty < Math.floor(m.y) + m.dim.y)
      .sort((a, b) => b.prof - a.prof);
  }
  // origem: um móvel ({camada, i}) ou vários (lista), para a seleção em grupo.
  function destacar(origem) {
    selecionado = origem;
    const lista = Array.isArray(origem) ? origem : origem ? [origem] : [];
    for (const m of moveis) {
      const sel = lista.some((o) => m.origem?.camada === o.camada && m.origem?.i === o.i);
      m.no.classList.toggle("mapa-selecionado", sel);
      for (const e of m.extras || []) e.no.classList.toggle("mapa-selecionado", sel);
    }
  }
  // Medidas no chão de um móvel numa direção (carrega o modelo se precisar).
  // Prévia do editor: o móvel meio transparente no ladrilho do mouse (verde
  // se cabe, vermelho se não). null tira a prévia.
  let previaNo = null, previaChave = "";
  async function previa(classe, x, y, dir, cabe = true, altura = 0) {
    const chave = classe ? `${classe}|${x}|${y}|${dir}|${cabe}|${altura}` : "";
    if (chave === previaChave) return;
    previaChave = chave;
    if (!classe || classe.startsWith("vybeimg_")) { previaNo?.remove(); previaNo = null; return; }
    try {
      const m = await mapaCarregarMovel(classe);
      if (previaChave !== chave) return;
      const d0 = mapaDirecaoValida(m.dados, dir);
      const desenho = mapaDesenharMovel(m, d0, 0, 0);
      if (!desenho) return;
      previaNo?.remove();
      previaNo = desenho.canvas;
      previaNo.className = "mapa-obj mapa-previa" + (cabe ? "" : " nao-cabe");
      colocar(previaNo, x, y, { ...desenho, oy: desenho.oy + MAPA_MOVEL_Y - altura * 32 }, 99990);
      palco.append(previaNo);
    } catch {}
  }
  async function medidas(classe, dir) {
    // Imagem da equipe: tapete ocupa largura × altura; quadro, um ladrilho
    // encostado na parede (quem decide onde cabe é o editor).
    const meta = IMAGENS.get(classe);
    if (meta) return meta.tipo === "tapete"
      ? { x: meta.largura, y: meta.altura, z: 0, dir: 0, direcoes: [0], imagem: meta }
      : { x: 1, y: 1, z: 0, dir, direcoes: [2, 4], imagem: meta };
    const m = await mapaCarregarMovel(classe);
    const d = mapaDirecaoValida(m.dados, dir);
    return { ...mapaDimensoes(m.dados, d), dir: d, direcoes: Object.keys(m.dados.visualizations.find((v) => v.size === 64)?.directions || { 0: 1 }).map(Number) };
  }

  // Rótulos dos ambientes. Os clicáveis (porta de saída do quarto) são botões.
  for (const q of P.rotulos || []) {
    const t = mapaTela(q.x, q.y, origem), r = document.createElement(q.saida ? "button" : "span");
    r.className = "mapa-rotulo" + (q.saida ? " saida" : "");
    if (q.saida) { r.type = "button"; r.addEventListener("click", (e) => { e.stopPropagation(); aoClicarSaida?.(); }); r.addEventListener("pointerdown", (e) => e.stopPropagation()); }
    r.textContent = q.texto;
    r.style.left = t.x + "px"; r.style.top = t.y + "px";
    palco.append(r);
  }
  for (const a of P.ambientes) {
    if (a.semRotulo || a.pessoal) continue;
    const t = mapaTela((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2, origem);
    const r = document.createElement("span");
    r.className = "mapa-rotulo";
    r.dataset.ambiente = a.id;
    r.textContent = a.nome;
    r.style.left = t.x + "px"; r.style.top = t.y + "px";
    palco.append(r);
  }

  // Personagens
  const pessoas = new Map(); // id → {no, img, x, y, dir, acao, figura}
  // Altura de quem anda, como no Habbo: o móvel em que pisa mais o piso da
  // planta, e entre dois ladrilhos a altura acompanha o passo (sem pulo).
  const alturaNoPiso = (x, y) => {
    if (!grade) return 0;
    const h = (i, j) => (i < 0 || j < 0 || i >= grade.W || j >= grade.H ? 0 : (grade.subida[grade.ind(i, j)] || 0) + (P.alturaEm?.(i, j) || 0));
    const rx = Math.round(x), ry = Math.round(y), ux = x - rx, uy = y - ry, ax = Math.abs(ux), ay = Math.abs(uy);
    const nx = rx + Math.sign(ux), ny = ry + Math.sign(uy);
    return h(rx, ry) * (1 - ax) * (1 - ay) + h(nx, ry) * ax * (1 - ay) + h(rx, ny) * (1 - ax) * ay + h(nx, ny) * ax * ay;
  };
  const posicionarPessoa = (p) => {
    // Sentado numa cadeira posta fora do ladrilho (ajuste fino), acompanha a cadeira.
    const desvio = p.acao === "sit" && grade ? grade.desvioAssento.get(grade.ind(Math.round(p.x), Math.round(p.y))) : null;
    // O piso da planta entra na altura (alturaNoPiso); a tela parte do chão 0.
    const t = mapaTela(p.x + (desvio?.dx || 0), p.y + (desvio?.dy || 0), { ...origem, alturaAtual: 0 });
    // Em cima de um bloco: o boneco sobe (32 px por nível de altura). Entre
    // dois ladrilhos a altura acompanha o passo (sobe o degrau aos poucos).
    let subiu = alturaNoPiso(p.x, p.y) * 32;
    const especial = grade?.piso.get(grade.ind(Math.round(p.x), Math.round(p.y)))?.tipo;
    // Sentado ou deitado, como no Habbo (Room.updateHabbo + Nitro): fica na
    // base do móvel mais a altura dele, menos um bloco (a postura desce meio
    // ladrilho); sentado no chão (:sit), meio bloco abaixo.
    if (grade && (p.acao === "sit" || p.acao === "lay")) {
      const movel = grade.movelAssento.get(grade.ind(Math.round(p.x), Math.round(p.y)));
      if (movel) subiu += (mapaAlturaMovel(movel) - 1) * 32;
      else if (p.acao === "sit") subiu -= 0.5 * 32;
    }
    p.no.classList.toggle("sombra", p.acao === "std" || p.acao === "wlk");
    p.no.classList.toggle("na-agua", especial === "agua");
    // A imagem de quem deita é deitada (110 × 64), não em pé (64 × 110).
    p.no.classList.toggle("deitado", p.acao === "lay");
    // Na direção 2 a cabeça fica à esquerda da imagem (deitado ao longo de x);
    // nas outras, à direita (ao longo de y). A cabeça vai no ladrilho da cabeceira.
    if (p.acao === "lay") p.no.dataset.deitado = p.dir === 2 ? "x" : "y";
    p.no.classList.toggle("pulando", especial === "trampolim" && p.acao !== "wlk");
    t.y -= subiu;
    p.no.style.left = t.x + "px";
    p.no.style.top = t.y + MAPA_TH / 2 + "px";
    // O nome fica numa camada acima dos móveis (antes um monitor ou cadeira
    // na frente cobria a etiqueta).
    p.etiqueta.style.left = t.x + "px";
    p.etiqueta.style.top = t.y + MAPA_TH / 2 - 104 + "px";
    if (setaId === String(p.id)) posicionarSeta(p);
    // Profundidade do Habbo (AvatarVisualization): a do ladrilho em que está
    // (o arredondado, como o Nitro faz no meio do passo), na altura do piso,
    // menos 0,01 (deitado, 0,409). Sentado numa cadeira com ajuste fino, a da
    // cadeira. O próprio boneco fica 0,001 à frente dos outros no mesmo lugar.
    const rx = Math.round(p.x), ry = Math.round(p.y);
    const pe = t.y + MAPA_TH / 2 + 8;
    const prof = mapaProfundidade(rx + (desvio?.dx || 0), ry + (desvio?.dy || 0), subiu / 32)
      + (p.acao === "lay" ? MAPA_PROF_DEITADO : MAPA_PROF_SENTADO) - (p.id === eu ? 0.001 : 0);
    const z = mapaZ(prof);
    p.no.style.zIndex = z;
    // Área do boneco (de pé, ~100 px acima dos pés) para recortar paredes.
    recortar(p.id, t.x - 20, pe - 100, t.x + 20, pe, z);
    separarEtiquetas();
  };
  // Etiquetas que se cruzam (gente junta na Pista): a de quem está mais ao
  // fundo sobe um degrau, até não bater em nenhuma da frente.
  let etiquetasQuadro = 0;
  const separarEtiquetas = () => {
    if (etiquetasQuadro) return;
    etiquetasQuadro = requestAnimationFrame(() => {
      etiquetasQuadro = 0;
      const lista = [...pessoas.values()].map((p) => ({ p, x: parseFloat(p.no.style.left), y: parseFloat(p.no.style.top), w: p.etiqueta.offsetWidth || 80 })).sort((a, b) => b.y - a.y);
      const postas = [];
      for (const it of lista) {
        let sobe = 0;
        while (sobe < 108 && postas.some((u) => Math.abs(u.x - it.x) < (u.w + it.w) / 2 + 4 && Math.abs((u.y - u.sobe) - (it.y - sobe)) < 19)) sobe += 19;
        postas.push({ ...it, sobe });
        it.p.etiqueta.style.setProperty("--sobe", sobe + "px");
      }
    });
  };
  // Vida do boneco parado, como no Habbo: pisca de vez em quando, mexe a
  // boca enquanto o balão de fala está aberto, acena com o braço subindo e
  // descendo, vira a cabeça para quem está perto e fecha os olhos quando a
  // pessoa está ausente.
  // "zZz" de quem cochila: marcou Ausente ou ficou parado (cochilo, como o
  // Habbo faz depois de uns minutos sem mexer).
  const mostrarZzz = (p) => {
    let zzz = p.no.querySelector(".mapa-zzz");
    // Como no Habbo: ocioso acorda ao andar (o zZz só aparece parado).
    const dorme = (p.dormindo || p.cochilo) && p.acao !== "wlk";
    if (dorme && !zzz) { zzz = document.createElement("span"); zzz.className = "mapa-zzz"; zzz.setAttribute("aria-hidden", "true"); zzz.textContent = "z Z z"; p.no.append(zzz); }
    else if (!dorme && zzz) zzz.remove();
  };
  const trocarImagem = (p) => {
    const agora = performance.now();
    mostrarZzz(p);
    const quadro = p.acao === "wlk" ? Math.floor(agora / MAPA_QUADRO_PASSO) % 4 : 0;
    // O imager tem um quadro só de aceno; alternando com "em pé" o braço se mexe.
    let acao = p.acao === "wav" && Math.floor(agora / 320) % 2 ? "std" : p.acao;
    // Sentado no chão (":sit" do Habbo): parado em pé vira sentado.
    if (p.chao && acao === "std") acao = "sit";
    // No gelo o boneco desliza parado, como quem patina (sem dar passos).
    if (acao === "wlk" && grade?.piso.get(grade.ind(Math.round(p.x), Math.round(p.y)))?.tipo === "gelo") acao = "std";
    // Placa erguida por alguns segundos ocupa a mão; quem segura café ou
    // bebida leva o copo à boca de vez em quando, como no Habbo.
    let mao = p.mao;
    if (p.placaAte > agora) mao = "sig=" + p.placa;
    else if (/^crr=/.test(mao) && p.acao !== "wlk" && (agora + (p.fase ||= Math.random() * 7000)) % 7000 < 1300) mao = "drk=" + mao.slice(4);
    let gesto = "sml";
    if (p.falaAte > agora) gesto = Math.floor(agora / 240) % 2 ? "spk" : "sml"; // quem fala acordou
    else if (p.expressaoAte > agora) gesto = p.expressao;
    else if (((p.dormindo || p.cochilo) && p.acao !== "wlk") || p.piscaAte > agora) gesto = "eyb";
    const cabeca = acao === "wlk" || acao === "lay" ? p.dir : (p.cabeca ?? p.dir);
    const url = mapaAvatarUrl(p.figura, p.dir, acao, mao, quadro, gesto, cabeca);
    if (p.img.dataset.url === url) return;
    p.img.dataset.url = url;
    const aplicar = () => { if (p.img.dataset.url === url) { delete p.img.dataset.reserva; p.img.src = url; } };
    // Primeira imagem (ou quadro que falhou) entra direto; as outras esperam
    // estar baixadas para trocar, e os 4 passos da direção já vão sendo pedidos.
    if (!p.img.getAttribute("src") || mapaBonecoPronto(url, aplicar)) aplicar();
    if (p.acao === "wlk") for (let i = 0; i < 4; i++) mapaBonecoPronto(mapaAvatarUrl(p.figura, p.dir, "wlk", p.mao, i), () => {});
    // Parado: a piscada e o quadro de "em pé" do aceno já ficam baixados.
    else {
      mapaBonecoPronto(mapaAvatarUrl(p.figura, p.dir, acao, p.mao, 0, "eyb", cabeca), () => {});
      if (p.acao === "wav") mapaBonecoPronto(mapaAvatarUrl(p.figura, p.dir, "std", p.mao, 0, "sml", cabeca), () => {});
    }
  };
  // Para onde cada boneco parado olha: quem está falando perto, senão a
  // pessoa mais próxima (até 4 ladrilhos), se estiver até 90° do corpo.
  const virarCabecas = () => {
    const agora = performance.now(), lista = [...pessoas.values()];
    for (const p of lista) {
      if (p.acao === "wlk" || p.acao === "lay") { p.cabeca = p.dir; continue; }
      let alvo = null, melhor = Infinity;
      for (const o of lista) {
        if (o === p) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        if (d > 4 || d < 0.3) continue;
        const peso = o.falaAte > agora ? d - 10 : d;
        if (peso < melhor) { melhor = peso; alvo = o; }
      }
      if (!alvo) { p.cabeca = p.dir; continue; }
      const para = mapaDirecaoDoPasso(alvo.x - p.x, alvo.y - p.y);
      const giro = ((para - p.dir) % 8 + 12) % 8 - 4; // −4…3
      p.cabeca = Math.abs(giro) <= 2 ? para : p.dir;
    }
  };
  const caminhar = (p, alvo) => {
    cancelAnimationFrame(p.passo);
    clearTimeout(p.parar);
    const de = { x: p.x, y: p.y }, dist = Math.hypot(alvo.x - de.x, alvo.y - de.y);
    if (dist < 0.05) { p.acao = alvo.acao || "std"; if (alvo.dir != null) p.dir = alvo.dir; trocarImagem(p); posicionarPessoa(p); return; }
    p.dir = mapaDirecaoDoPasso(alvo.x - de.x, alvo.y - de.y);
    p.acao = "wlk"; trocarImagem(p);
    // Passos curtos (vindos da presença a cada 150 ms) emendam sem trancos.
    // Como no Habbo (Arcturus: um passo por ciclo de 500 ms, reto ou na
    // diagonal), o tempo conta pelos passos (o maior eixo), não pela distância.
    const passos = Math.max(Math.abs(alvo.x - de.x), Math.abs(alvo.y - de.y));
    const dur = Math.min(4000, dist < 1.5 ? 150 : passos * MAPA_PASSO_MS), ini = performance.now();
    const passo = (agora) => {
      const k = Math.min(1, (agora - ini) / dur);
      p.x = de.x + (alvo.x - de.x) * k; p.y = de.y + (alvo.y - de.y) * k;
      trocarImagem(p); posicionarPessoa(p);
      if (k < 1) p.passo = requestAnimationFrame(passo);
      else {
        // Entre um passo e outro o boneco continua andando; só para (ou senta)
        // se não chegar outro passo logo em seguida.
        const fim = () => { p.acao = alvo.acao || "std"; if (alvo.dir != null) p.dir = alvo.dir; trocarImagem(p); posicionarPessoa(p); };
        if ((alvo.acao || "std") === "wlk") return;
        p.parar = setTimeout(fim, 140);
      }
    };
    p.passo = requestAnimationFrame(passo);
  };
  function atualizarPessoas(lista) {
    const vistos = new Set();
    for (const q of lista) {
      vistos.add(q.id);
      let p = pessoas.get(q.id);
      const figura = mapaFigura(q.perfil);
      if (!p) {
        const no = document.createElement("button");
        no.type = "button";
        no.className = "mapa-pessoa" + (q.id === eu ? " voce" : "");
        const img = document.createElement("img");
        img.alt = "";
        img.draggable = false;
        img.referrerPolicy = "no-referrer";
        // Sem o imager do Habbo, a cópia guardada no nosso banco (em pé).
        img.onerror = () => { if (!img.dataset.reserva) { img.dataset.reserva = "1"; img.src = mapaBonecoGuardado(p.figura, p.dir); } };
        const etiqueta = document.createElement("span");
        etiqueta.className = "mapa-etiqueta solta" + (q.id === eu ? " voce" : "");
        etiqueta.setAttribute("aria-hidden", "true");
        etiqueta.addEventListener("click", (e) => { e.stopPropagation(); selecionarPessoa(q.id); q.aoClicar?.(q.id); });
        etiqueta.addEventListener("pointerdown", (e) => e.stopPropagation());
        // Sombra no chão de quem está em pé ou andando (h_std_sd do Habbo, 50 de 255).
        const sombra = document.createElement("i");
        sombra.className = "mapa-sombra-boneco";
        no.append(sombra, img);
        palco.append(etiqueta);
        // Como no Habbo: clicar em alguém põe a seta de seleção em cima dele.
        no.addEventListener("click", (e) => { e.stopPropagation(); selecionarPessoa(q.id); q.aoClicar?.(q.id); });
        no.addEventListener("focus", () => etiqueta.classList.add("foco"));
        no.addEventListener("blur", () => etiqueta.classList.remove("foco"));
        palco.append(no);
        p = { id: q.id, no, img, etiqueta, x: q.x, y: q.y, dir: q.dir ?? 2, acao: q.acao || "std", figura };
        pessoas.set(q.id, p);
        posicionarPessoa(p);
        trocarImagem(p);
        // O próprio boneco: os passos das 8 direções já ficam baixados.
        if (q.id === eu) for (let d = 0; d < 8; d++) for (let i = 0; i < 4; i++) mapaBonecoPronto(mapaAvatarUrl(figura, d, "wlk", q.mao || "", i), () => {});
      }
      p.figura = figura;
      p.mao = q.mao || "";
      // Status escrito quando não está disponível; em foco ou ausente, o
      // boneco fica meio transparente (não é hora de chamar).
      p.etiqueta.innerHTML = `<i class="ofc-ponto" style="--st:${q.corStatus}"></i><b></b>${q.statusTexto ? "<small></small>" : ""}`;
      // Selo de status sobre a cabeça, visível de longe (foco: fone; reunião: balão).
      let selo = p.no.querySelector(".mapa-selo");
      const icone = MAPA_SELOS[q.status];
      if (!icone) selo?.remove();
      else {
        if (!selo) { selo = document.createElement("span"); selo.className = "mapa-selo"; selo.setAttribute("aria-hidden", "true"); p.no.append(selo); }
        if (selo.dataset.status !== q.status) { selo.dataset.status = q.status; selo.innerHTML = icone; }
      }
      p.etiqueta.querySelector("b").textContent = q.nome;
      if (q.statusTexto) p.etiqueta.querySelector("small").textContent = q.statusTexto;
      p.no.classList.toggle("distante", q.status === "foco" || q.status === "ausente");
      // Ausente: o boneco "dorme" (olhos fechados), como o Habbo faz com quem
      // fica parado muito tempo.
      p.dormindo = q.status === "ausente";
      mostrarZzz(p);
      p.no.setAttribute("aria-label", q.rotulo || q.nome);
      p.no.dataset.status = q.status || "";
      // O próprio boneco, enquanto este navegador o guia, não é puxado pela
      // posição (atrasada) que volta do servidor.
      if (q.local && performance.now() - (p.guiado || 0) < 400) { trocarImagem(p); continue; }
      // Saiu do lugar: levanta do chão.
      if (Math.abs(p.x - q.x) > 0.01 || Math.abs(p.y - q.y) > 0.01) p.chao = false;
      if (Math.abs(p.x - q.x) > 0.01 || Math.abs(p.y - q.y) > 0.01 || p.acao !== (q.acao || "std")) caminhar(p, q);
      else trocarImagem(p);
    }
    for (const [id, p] of pessoas) if (!vistos.has(id)) { cancelAnimationFrame(p.passo); p.no.remove(); p.etiqueta.remove(); pessoas.delete(id); recortar(id, 0, 0, 0, 0, Infinity); }
    separarEtiquetas();
  }

  // Câmera suave: um alvo (posição e zoom) e um único quadro de animação que
  // aproxima a câmera dele com amortecimento exponencial (independe da taxa de
  // quadros). Roda do mouse e pinça do trackpad trocam o nível de zoom no ponto do
  // cursor; arrastar segue o dedo na hora e solta com inércia; acompanhar a
  // pessoa só muda o alvo. Sem movimento de sobra, o laço para.
  let zoom = 1, cam = { x: 0, y: 0 };
  // Zoom do Habbo: só 0,5×, 1× e 2× (escala quebrada borra a pixel art; o
  // jogo desenha a arte de 64 px em 1× e afasta pela metade). A prévia do
  // cartão de criação continua livre, por ser miniatura.
  const NIVEIS = [0.5, 1, 2];
  const nivel = (z) => (P.previa ? z : NIVEIS.reduce((m, n) => (Math.abs(Math.log(n / z)) < Math.abs(Math.log(m / z)) ? n : m)));
  const alvo = { x: 0, y: 0, z: 1 };
  let inercia = null, quadroCam = null, ultimoCam = 0, seguindo = true;
  const reduzMov = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Sem will-change/translate3d: o palco tem ~4500×2400 px e virar uma camada
  // de GPU inteira deixava trechos pretos e bonecos sumindo em placas fracas.
  // Letreiros com tamanho mínimo na tela: abaixo de ~0,9 de zoom crescem
  // na mesma proporção em que o mapa diminui.
  const aplicar = () => {
    palco.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${zoom})`;
    palco.style.setProperty("--contra", Math.max(1, 0.9 / zoom).toFixed(3));
  };
  const animarCam = (agora) => {
    quadroCam = null;
    const dt = Math.min(64, agora - (ultimoCam || agora - 16)); ultimoCam = agora;
    if (inercia) {
      alvo.x += inercia.vx * dt; alvo.y += inercia.vy * dt;
      const atrito = Math.exp(-dt / 220);
      inercia.vx *= atrito; inercia.vy *= atrito;
      if (Math.hypot(inercia.vx, inercia.vy) < 0.02) inercia = null;
    }
    const k = reduzMov ? 1 : 1 - Math.exp(-dt / 85);
    zoom += (alvo.z - zoom) * k;
    cam.x += (alvo.x - cam.x) * k; cam.y += (alvo.y - cam.y) * k;
    const parado = !inercia && Math.abs(alvo.z - zoom) < 0.0005 && Math.hypot(alvo.x - cam.x, alvo.y - cam.y) < 0.3;
    // Parada em pixel inteiro: a arte não fica meio pixel deslocada.
    if (parado) { zoom = alvo.z; cam.x = alvo.x = Math.round(alvo.x); cam.y = alvo.y = Math.round(alvo.y); }
    aplicar();
    if (!parado) quadroCam = requestAnimationFrame(animarCam);
    else ultimoCam = 0;
  };
  const mexerCam = () => { if (!quadroCam) quadroCam = requestAnimationFrame(animarCam); };
  function centralizar(x, y, z) {
    if (z) alvo.z = nivel(Math.max(0.35, Math.min(2.2, z)));
    const t = mapaTela(x, y, origem), r = el.getBoundingClientRect();
    alvo.x = cam.x = Math.round(r.width / 2 - t.x * alvo.z); alvo.y = cam.y = Math.round(r.height / 2 - t.y * alvo.z);
    zoom = alvo.z; inercia = null;
    aplicar();
  }
  // O quarto cabe na área disponível, inclusive após abrir a lateral ou girar o celular.
  function enquadrarQuarto() {
    if (!P.quarto) return;
    const a = P.ambientes[0], r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const w = (a.x1 - a.x0 + a.y1 - a.y0) * MAPA_TW / 2 + 48;
    const h = (a.x1 - a.x0 + a.y1 - a.y0) * MAPA_TH / 2 + MAPA_PAREDE + 100;
    // Prévia (cartão da criação do quarto): sem a folga da barra e do dock.
    const [mw, mh] = P.previa ? [8, 8] : [32, 180];
    // Como no Habbo, 1× sempre que o quarto quase cabe (o resto se vê
    // arrastando); 0,5× só em tela pequena. A prévia segue livre.
    const cabe = Math.min((r.width - mw) / w, (r.height - mh) / h);
    centralizar((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2,
      P.previa ? Math.max(0.2, Math.min(1.35, cabe)) : cabe >= 0.8 ? 1 : 0.5);
    // O centro visual inclui as paredes e o patamar alto, acima do piso.
    alvo.y += (MAPA_PAREDE + (P.nivelEm ? 48 : 0)) * alvo.z / 2;
    cam.y=alvo.y; aplicar();
  }
  const tamanhoQuarto = P.quarto && typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(enquadrarQuarto) : null;
  tamanhoQuarto?.observe(el);
  // Zoom em volta de um ponto da tela (o cursor; sem ponto, o centro).
  function mudarZoom(fator, cx, cy) {
    const r = el.getBoundingClientRect();
    cx ??= r.width / 2; cy ??= r.height / 2;
    // Um nível por vez (0,5× → 1× → 2×).
    const i = NIVEIS.indexOf(nivel(alvo.z));
    const novo = P.previa ? Math.max(0.35, Math.min(2.2, alvo.z * fator)) : NIVEIS[Math.max(0, Math.min(NIVEIS.length - 1, i + (fator > 1 ? 1 : fator < 1 ? -1 : 0)))];
    if (novo === alvo.z) return;
    alvo.x = cx - ((cx - alvo.x) / alvo.z) * novo; alvo.y = cy - ((cy - alvo.y) / alvo.z) * novo;
    alvo.z = novo;
    mexerCam();
  }
  let arrasto = null, rodaAcumulada = 0;
  // Ladrilho sob um ponto da janela (mouse, dedo, arrastar do catálogo).
  const ladrilhoEm = (cx, cy) => {
    const r = palco.getBoundingClientRect();
    const t = mapaLadrilho((cx - r.left) / zoom, (cy - r.top) / zoom, origem);
    return { x: Math.floor(t.x), y: Math.floor(t.y), fx: t.x, fy: t.y };
  };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    inercia = null;
    // Editor: apertar num móvel da área em edição pega o móvel (em vez de
    // arrastar o mapa); soltar larga onde o mouse estiver.
    const t0 = ladrilhoEm(e.clientX, e.clientY);
    if (aoPegar?.(t0.x, t0.y, t0.fx, t0.fy)) {
      arrasto = { item: true, x: e.clientX, y: e.clientY, moveu: false, ult: [] };
      el.setPointerCapture?.(e.pointerId);
      return;
    }
    // Pega a câmera de onde ela está agora (mesmo no meio de uma animação).
    alvo.x = cam.x; alvo.y = cam.y; alvo.z = zoom;
    arrasto = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moveu: false, ult: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
    el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!arrasto) {
      // Mouse passando (sem arrastar): avisa o ladrilho, para o cartão da mesa.
      if (e.pointerType !== "touch") {
        const r = palco.getBoundingClientRect();
        const t = mapaLadrilho((e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom, origem);
        aoPassar?.(Math.floor(t.x), Math.floor(t.y), e.clientX, e.clientY);
        // Sobre um boneco: o próprio botão mostra a mão; o cursor de ladrilho some.
        if (e.target.closest?.(".mapa-pessoa")) { if (cursor) cursor.hidden = true; el.classList.remove("mapa-sobre-objeto"); }
        else passarPonteiro(e.clientX, e.clientY, t);
      }
      return;
    }
    const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
    if (Math.hypot(dx, dy) > 4) arrasto.moveu = true;
    if (!arrasto.moveu) return;
    if (arrasto.item) { const t = ladrilhoEm(e.clientX, e.clientY); aoArrastar?.(t.x, t.y, t.fx, t.fy); return; }
    seguindo = false;
    alvo.x = cam.x = arrasto.cx + dx; alvo.y = cam.y = arrasto.cy + dy;
    aplicar();
    const agora = performance.now();
    arrasto.ult.push({ t: agora, x: e.clientX, y: e.clientY });
    while (arrasto.ult.length > 2 && agora - arrasto.ult[0].t > 90) arrasto.ult.shift();
  });
  el.addEventListener("pointerup", (e) => {
    const a = arrasto; arrasto = null;
    if (!a) return;
    if (a.item) { const t = ladrilhoEm(e.clientX, e.clientY); aoSoltar?.(t.x, t.y, a.moveu); return; }
    if (a.moveu) {
      // Solta com a velocidade dos últimos ~90 ms e desliza até parar.
      const p0 = a.ult[0], p1 = a.ult[a.ult.length - 1], dt = Math.max(1, p1.t - p0.t);
      if (!reduzMov && performance.now() - p1.t < 60) { inercia = { vx: (p1.x - p0.x) / dt, vy: (p1.y - p0.y) / dt }; mexerCam(); }
      return;
    }
    const r = palco.getBoundingClientRect();
    const t = mapaLadrilho((e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom, origem);
    // O objeto sob o pixel vai junto (pessoa ou móvel); o ladrilho segue para andar.
    const objeto = objetoEm(e.clientX, e.clientY);
    if (objeto || (t.x >= 0 && t.y >= 0 && t.x < P.W && t.y < P.H)) aoClicar?.(t.x, t.y, objeto && !(objeto.tipo === "movel" && ehChao(objeto.item)) ? objeto : null);
  });
  // Dois cliques num ladrilho: liga/desliga o móvel dali (como no Habbo).
  el.addEventListener("dblclick", (e) => {
    const r = palco.getBoundingClientRect();
    const t = mapaLadrilho((e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom, origem);
    const objeto = objetoEm(e.clientX, e.clientY);
    if (t.x >= 0 && t.y >= 0 && t.x < P.W && t.y < P.H) aoDuploClique?.(t.x, t.y, objeto);
  });
  const cancelarPonteiro = () => {
    const a = arrasto; arrasto = null; inercia = null;
    if (a?.item) aoCancelar?.();
    aoPassar?.(-1,-1);
  };
  el.addEventListener("pointercancel", cancelarPonteiro);
  el.addEventListener("lostpointercapture", () => { if (arrasto) cancelarPonteiro(); });
  el.addEventListener("pointerleave", () => { aoPassar?.(-1, -1); if (cursor) cursor.hidden = true; el.classList.remove("mapa-sobre-objeto"); });
  el.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = el.getBoundingClientRect();
    // Trackpad manda passos pequenos (e ctrl na pinça); roda, passos grandes.
    const passo = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    // Níveis do Habbo: a roda (ou a pinça) acumula até um "dente" e só então troca de nível.
    rodaAcumulada += passo * (e.ctrlKey ? 4 : 1);
    if (Math.abs(rodaAcumulada) < 90) return;
    const fator = rodaAcumulada < 0 ? 2 : 0.5;
    rodaAcumulada = 0;
    mudarZoom(fator, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  // Leva a câmera, suave, até um ponto com outro zoom (atalhos de área).
  function olhar(x, y, z) {
    const r = el.getBoundingClientRect(), t = mapaTela(x, y, origem);
    alvo.z = nivel(Math.max(0.35, Math.min(2.2, z || alvo.z)));
    alvo.x = r.width / 2 - t.x * alvo.z; alvo.y = r.height / 2 - t.y * alvo.z;
    seguindo = false; inercia = null;
    mexerCam();
  }
  // Câmera que acompanha a pessoa: só muda o alvo; arrastar o mapa solta,
  // voltar a andar prende de novo.
  function seguir(x, y, retomar) {
    // Quarto: cabe inteiro na tela; a câmera fica parada.
    if (P.fixa) return;
    if (retomar) seguindo = true;
    if (!seguindo) return;
    const t = mapaTela(x, y, origem), r = el.getBoundingClientRect();
    alvo.x = r.width / 2 - t.x * alvo.z; alvo.y = r.height / 2 - t.y * alvo.z;
    inercia = null;
    mexerCam();
  }
  // Móveis a até `raio` ladrilhos da posição (pela borda do móvel).
  function moveisPerto(x, y, raio) {
    // Pela caixa no piso (móvel fino, como telão de 0,2 ladrilho, ocupa 1).
    return moveis.filter((m) => {
      const w = Math.max(1, Math.round(m.dim.x)), h = Math.max(1, Math.round(m.dim.y));
      const dx = Math.max(Math.floor(m.x) - x, 0, x - (Math.floor(m.x) + w - 1));
      const dy = Math.max(Math.floor(m.y) - y, 0, y - (Math.floor(m.y) + h - 1));
      return Math.max(dx, dy) <= raio;
    });
  }
  // Interface do Habbo (cliente Nitro): o que está sob o mouse é escolhido
  // pelo pixel desenhado (RoomSpriteCanvas testa o alpha de cada sprite, do
  // mais à frente para o de trás), não pelo ladrilho do chão; o cursor de
  // ladrilho oficial (tile_cursor) marca onde se pisa, na altura da pilha; a
  // seta de seleção (selection_arrow) pula sobre a pessoa escolhida.
  const amostra = document.createElement("canvas");
  amostra.width = amostra.height = 1;
  const amostraG = amostra.getContext("2d", { willReadFrequently: true });
  const alfaEm = (fonte, rect, cx, cy, largura, altura) => {
    const px = Math.floor(((cx - rect.left) * largura) / rect.width), py = Math.floor(((cy - rect.top) * altura) / rect.height);
    if (px < 0 || py < 0 || px >= largura || py >= altura) return 0;
    try { amostraG.clearRect(0, 0, 1, 1); amostraG.drawImage(fonte, px, py, 1, 1, 0, 0, 1, 1); return amostraG.getImageData(0, 0, 1, 1).data[3]; } catch { return 0; }
  };
  function objetoEm(cx, cy) {
    const candidatos = [];
    for (const m of moveis) {
      const telas = m.no?.tagName === "CANVAS" ? [m.no] : [...(m.no?.querySelectorAll?.("canvas") || [])];
      for (const c of telas) {
        if (c.classList.contains("mapa-sombra")) continue;
        const rect = c.getBoundingClientRect();
        if (cx < rect.left || cx >= rect.right || cy < rect.top || cy >= rect.bottom) continue;
        candidatos.push({ z: Number(c.style.zIndex || m.no.style.zIndex || 0), teste: () => alfaEm(c, rect, cx, cy, c.width, c.height) > 64, objeto: { tipo: "movel", item: m } });
      }
    }
    // Pessoas não entram aqui: o boneco vem do servidor de imagens do Habbo
    // (outro domínio) e testar o pixel dele contaminaria o canvas de amostra;
    // cada boneco é um botão com o próprio clique.
    candidatos.sort((a, b) => b.z - a.z);
    return candidatos.find((c) => c.teste())?.objeto || null;
  }
  // Móvel que conta como chão para o clique e para o cursor (tapete, bloco de
  // pisar, assento: no Habbo clicar nele leva até ele).
  const ehChao = (m) => m.plano || mapaFisica(m.classe).pisa;
  let cursor = null, cursorArte = null;
  mapaCarregarMovel("tile_cursor").then((m) => { cursorArte = mapaDesenharMovel(m, 0, 0, 0); }).catch(() => {});
  function mostrarCursor(x, y) {
    if (!cursorArte || P.previa || x < 0 || y < 0 || !P.andavel?.(x, y)) { if (cursor) cursor.hidden = true; return; }
    if (!cursor) {
      cursor = cursorArte.canvas.cloneNode();
      cursor.getContext("2d").drawImage(cursorArte.canvas, 0, 0);
      cursor.className = "mapa-obj mapa-cursor";
      // Acima do chão, dos tapetes e das paredes; abaixo de móveis e bonecos.
      cursor.style.zIndex = 47999;
      palco.append(cursor);
    }
    const t = mapaTela(x, y, { ...origem, alturaAtual: 0 });
    cursor.style.left = t.x + cursorArte.ox + "px";
    cursor.style.top = t.y + MAPA_TH / 2 + cursorArte.oy - alturaNoPiso(x, y) * MAPA_NIVEL_PX + "px";
    cursor.hidden = false;
  }
  let passando = null, quadroPassar = null;
  function passarPonteiro(cx, cy, t) {
    passando = { cx, cy, t };
    if (quadroPassar) return;
    quadroPassar = requestAnimationFrame(() => {
      quadroPassar = null;
      const { cx, cy, t } = passando;
      const o = objetoEm(cx, cy);
      const naoChao = o && !(o.tipo === "movel" && ehChao(o.item));
      el.classList.toggle("mapa-sobre-objeto", Boolean(naoChao));
      if (naoChao) { if (cursor) cursor.hidden = true; }
      else { const alvo = mapaAlvoCursor(t, o?.tipo === "movel" ? o.item : null); mostrarCursor(alvo.x, alvo.y); }
    });
  }
  let seta = null, setaArte = null, setaQuadro = 0, setaId = null, setaRelogio = null;
  mapaCarregarMovel("selection_arrow").then((m) => { setaArte = m; }).catch(() => {});
  function selecionarPessoa(id) {
    setaId = id == null ? null : String(id);
    clearInterval(setaRelogio);
    if (!setaId || !setaArte) { seta?.remove(); seta = null; return; }
    if (!seta) { seta = document.createElement("canvas"); seta.className = "mapa-obj mapa-seta"; seta.style.zIndex = 99500; palco.append(seta); }
    const desenhar = () => {
      const d = mapaDesenharMovel(setaArte, 0, 0, setaQuadro++);
      if (!d) return;
      seta.width = d.canvas.width; seta.height = d.canvas.height;
      const g = seta.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(d.canvas, 0, 0);
      seta.dataset.ox = d.ox; seta.dataset.oy = d.oy;
      const q = pessoas.get(setaId);
      if (q) posicionarSeta(q);
    };
    desenhar();
    // 4 quadros, cada um 3 ticks a 24 por segundo (frameRepeat do Nitro).
    if (!reduzMov) setaRelogio = setInterval(desenhar, 125);
  }
  function posicionarSeta(q) {
    if (!seta || String(q.id) !== setaId) return;
    // A arte do Habbo já traz o deslocamento a partir dos pés do boneco (y = 140).
    seta.style.left = parseFloat(q.no.style.left) + Number(seta.dataset.ox || 0) + "px";
    // (14 px acima, para não cobrir a etiqueta do nome, que o Habbo não tem fixa).
    seta.style.top = parseFloat(q.no.style.top) + Number(seta.dataset.oy || 0) - 14 + "px";
  }
  let realcado = null;
  function realcar(item) {
    if (realcado === item) return;
    realcado?.no.classList.remove("mapa-interativo");
    realcado = item;
    item?.no.classList.add("mapa-interativo");
  }
  // Vários móveis realçados de uma vez (os escolhidos de um gatilho).
  let realcados = [];
  function realcarVarios(lista) {
    for (const m of realcados) if (m !== realcado) m.no.classList.remove("mapa-interativo");
    realcados = lista || [];
    for (const m of realcados) m.no.classList.add("mapa-interativo");
  }
  function posicoes() { return [...pessoas].map(([id, p]) => ({ id, x: p.x, y: p.y })); }
  // Balão de fala sobre a cabeça (some sozinho).
  function balao(id, texto) {
    const p = pessoas.get(String(id));
    if (!p) return;
    // Enquanto fala, a boca abre e fecha (quadro "spk" já baixado).
    p.falaAte = performance.now() + Math.min(4000, 900 + texto.length * 45);
    mapaBonecoPronto(mapaAvatarUrl(p.figura, p.dir, p.acao === "wlk" ? "std" : p.acao, p.mao, 0, "spk", p.cabeca ?? p.dir), () => {});
    trocarImagem(p);
    // Falou: o "digitando…" some.
    clearTimeout(p.digitandoFim); p.no.querySelector(".mapa-digitando")?.remove();
    // Balão do Habbo (ChatWidget do Nitro): sai logo acima da cabeça, com o
    // rosto e o nome de quem falou, e sobe em fila; o mais novo empurra para
    // cima os que encostam nele; de tempos em tempos todos sobem 15 px e somem
    // ao passar do topo. O histórico fica na aba Conversa.
    const faixa = faixaConversa(), er = el.getBoundingClientRect(), pr = p.img.getBoundingClientRect();
    const b = document.createElement("div");
    b.className = "mapa-chat";
    const rosto = new Image();
    rosto.alt = ""; rosto.referrerPolicy = "no-referrer";
    rosto.src = "https://www.habbo.com/habbo-imaging/avatarimage?" + new URLSearchParams({ figure: p.figura, headonly: "1", direction: "2", head_direction: "3", gesture: "spk", size: "s" });
    rosto.onerror = () => rosto.remove();
    const nome = document.createElement("b"), fala = document.createElement("span");
    nome.textContent = (p.etiqueta.querySelector("b")?.textContent || "").split(" ")[0] + ":";
    fala.textContent = " " + texto;
    b.append(rosto, nome, fala);
    faixa.append(b);
    const w = b.offsetWidth, h = b.offsetHeight;
    const item = { b, h, w, x: Math.max(4, Math.min(er.width - w - 4, pr.left - er.left + pr.width / 2 - w / 2)), y: Math.max(4, pr.top - er.top - h + 6), pular: true };
    b.style.left = item.x + "px";
    // Empurra para cima, em cascata, os balões que encostam no novo.
    const empurrar = (novo) => {
      for (const o of baloesConversa) {
        if (o === novo || o.y >= novo.y + novo.h || o.y + o.h <= novo.y - 2 || o.x >= novo.x + novo.w || o.x + o.w <= novo.x) continue;
        o.y = novo.y - o.h - 2; o.b.style.top = o.y + "px"; empurrar(o);
      }
    };
    baloesConversa.push(item);
    b.style.top = item.y + "px";
    empurrar(item);
    limparConversa();
    relogioConversa ??= setInterval(subirConversa, 3000);
  }
  const baloesConversa = [];
  let faixaFalas = null, relogioConversa = null;
  function faixaConversa() {
    if (!faixaFalas) { faixaFalas = document.createElement("div"); faixaFalas.className = "mapa-conversa"; faixaFalas.setAttribute("aria-hidden", "true"); el.append(faixaFalas); }
    return faixaFalas;
  }
  function limparConversa() {
    for (let i = baloesConversa.length - 1; i >= 0; i--) {
      const o = baloesConversa[i];
      if (o.y + o.h < 0) { o.b.remove(); baloesConversa.splice(i, 1); }
    }
    if (!baloesConversa.length) { clearInterval(relogioConversa); relogioConversa = null; }
  }
  function subirConversa() {
    for (const o of baloesConversa) { if (o.pular) { o.pular = false; continue; } o.y -= 15; o.b.style.top = o.y + "px"; }
    limparConversa();
  }
  // Estado passageiro do boneco, como os comandos do Habbo: expressão do
  // rosto (sad, srp, agr), placa erguida, sentado no chão e "digitando…".
  // Vale até a pessoa andar (chão) ou até o tempo acabar (rosto e placa).
  function estadoBoneco(id, { expressao, placa, chao, digitando, cochilo } = {}) {
    const p = pessoas.get(String(id));
    if (!p) return;
    const agora = performance.now();
    if (cochilo != null) { p.cochilo = Boolean(cochilo); mostrarZzz(p); }
    if (expressao) { p.expressao = expressao; p.expressaoAte = agora + 4000; }
    if (placa != null) { p.placa = placa; p.placaAte = agora + 6000; }
    if (chao != null) p.chao = Boolean(chao);
    if (digitando != null) {
      clearTimeout(p.digitandoFim);
      p.no.querySelector(".mapa-digitando")?.remove();
      if (digitando) {
        const d = document.createElement("span");
        d.className = "mapa-digitando";
        d.setAttribute("aria-label", "digitando");
        d.innerHTML = "<i></i><i></i><i></i>";
        p.no.append(d);
        p.digitandoFim = setTimeout(() => d.remove(), 8000);
      }
    }
    trocarImagem(p);
  }
  // Reação rápida: sobe e some acima do boneco.
  const REACAO = { aplauso: "👏", coracao: "❤️", risada: "😂", joinha: "👍", fogo: "🔥", festa: "🎉" };
  function reagir(id, tipo) {
    const p = pessoas.get(id);
    if (!p || !REACAO[tipo]) return;
    const r = document.createElement("span");
    r.className = "mapa-reacao";
    r.textContent = REACAO[tipo];
    r.style.left = 20 + Math.random() * 24 + "px";
    p.no.append(r);
    setTimeout(() => r.remove(), 2400);
  }
  // Vídeo da pessoa numa bolha acima do boneco (null tira).
  // Móvel com aviso (o computador da mesa quando há avisos novos): brilha.
  function marcarAviso(x, y, ligado) {
    for (const m of moveis) m.no.classList.remove("mapa-aviso");
    if (!ligado) return;
    const alvo = moveis.find((m) => /computer|flatscreen/.test(m.classe) && Math.floor(m.x) === x && Math.floor(m.y) === y)
      || moveisPerto(x, y, 1).find((m) => /computer|flatscreen/.test(m.classe));
    alvo?.no.classList.add("mapa-aviso");
  }
  // Recado esperando: um envelope aceso flutuando sobre a mesa de quem recebeu,
  // com quantos são. Clicar abre os recados.
  let recadoNo = null;
  function marcarRecado(x, y, n, nomes, aoClicar) {
    if (!n || x === undefined) { recadoNo?.remove(); recadoNo = null; return; }
    if (!recadoNo) {
      recadoNo = document.createElement("button");
      recadoNo.type = "button";
      recadoNo.className = "mapa-recado";
      recadoNo.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3.8 7l8.2 6 8.2-6"/></svg><b></b>';
      recadoNo.addEventListener("click", (e) => { e.stopPropagation(); recadoNo.aoClicar?.(); });
      recadoNo.addEventListener("pointerdown", (e) => e.stopPropagation());
      palco.append(recadoNo);
    }
    recadoNo.aoClicar = aoClicar;
    const t = mapaTela(x + 1, y + 1, origem);
    recadoNo.style.left = t.x + "px";
    recadoNo.style.top = t.y - 96 + "px";
    recadoNo.querySelector("b").textContent = n > 9 ? "9+" : String(n);
    const texto = `${n} ${n === 1 ? "recado" : "recados"} para você${nomes ? " · de " + nomes : ""}. Clique para ler.`;
    recadoNo.title = texto;
    recadoNo.setAttribute("aria-label", texto);
  }
  // Quem está falando na conversa ganha um anel verde nos pés.
  // e o nome dele acende em verde com ondas piscando.
  function marcarFalando(id, falando) {
    const p = pessoas.get(String(id));
    if (!p) return;
    p.no.classList.toggle("falando", Boolean(falando));
    p.etiqueta.classList.toggle("falando", Boolean(falando));
    separarEtiquetas();
    if (falando && !p.etiqueta.querySelector(".mapa-fala")) {
      const f = document.createElement("span");
      f.className = "mapa-fala";
      f.setAttribute("aria-hidden", "true");
      f.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>';
      p.etiqueta.append(f);
    }
  }
  function anexarVideo(id, stream) {
    const p = pessoas.get(id);
    if (!p) return;
    let v = p.no.querySelector(".mapa-video");
    if (!stream) { v?.remove(); return; }
    if (!v) {
      v = document.createElement("video");
      v.className = "mapa-video"; v.autoplay = true; v.muted = true; v.playsInline = true;
      p.no.append(v);
    }
    if (v.srcObject?.getVideoTracks?.()[0] !== stream.getVideoTracks()[0]) v.srcObject = stream;
  }
  function idsNoMapa() { return [...pessoas.keys()]; }
  // Salas trancadas: cadeado no nome da sala.
  function marcarTrancas(zonas) {
    for (const r of palco.querySelectorAll(".mapa-rotulo")) r.classList.toggle("trancada", zonas.has(r.dataset.ambiente));
  }

  // Posiciona direto (movimento contínuo guiado por este navegador).
  function mover(id, x, y, dir, acao) {
    const p = pessoas.get(id);
    if (!p) return;
    cancelAnimationFrame(p.passo); clearTimeout(p.parar);
    p.guiado = performance.now();
    if (Math.abs(p.x - x) > 0.01 || Math.abs(p.y - y) > 0.01) p.chao = false;
    p.x = x; p.y = y; p.dir = dir; p.acao = acao;
    trocarImagem(p); posicionarPessoa(p);
  }

  // Animação dos móveis no ritmo do Habbo: 24 quadros por segundo
  // (RoomSpriteCanvas, system.fps.animation), cada quadro da arte repetido
  // frameRepeat vezes; redesenha só o móvel cujo quadro mudou. Com "reduzir
  // movimento", metade disso. Só com o mapa visível na tela.
  let quadro = 0, relogio = null, pulsoBonecos = 0;
  const focos = [];
  const animar = () => {
    if (document.hidden || !el.isConnected || !el.offsetParent) return;
    quadro++;
    // Bonecos (10 vezes por segundo): piscada, fala, aceno e cabeça de quem está parado.
    const agora = performance.now();
    const pulso = Math.floor(agora / 100);
    if (pulso !== pulsoBonecos) {
      pulsoBonecos = pulso;
      if (pulso % 5 === 0) virarCabecas();
      for (const p of pessoas.values()) {
        if (p.acao !== "wlk" && (!p.piscaEm || agora > p.piscaEm)) { p.piscaEm = agora + 2800 + Math.random() * 4200; p.piscaAte = agora + 170; }
        trocarImagem(p);
      }
    }
    // Focos do refletor de festa: a cada dois quadros, como no Nitro.
    if (focos.length && quadro % 2 === 0) for (const f of focos) { const [dx, dy] = mapaPassoFeixe(f); f.no.style.left = f.x + dx + "px"; f.no.style.top = f.y + dy + "px"; }
    for (const item of [...animados]) {
      // Passagem entre estados: do primeiro quadro dela até o fim; depois, o estado novo.
      let estado = item.estado, q = quadro;
      if (item.transicao && quadro < item.transicao.fim) { estado = item.transicao.chave; q = quadro - item.transicao.inicio; }
      else if (item.transicao) { item.transicao = null; item.chaveQuadro = null; if (item.quadros <= 1) animados.splice(animados.indexOf(item), 1); }
      const chave = estado + ":" + mapaChaveQuadro(item.m.dados, estado, q, item.semente || 0);
      if (chave === item.chaveQuadro) continue;
      item.chaveQuadro = chave;
      if (!item.parede) {
        const d = mapaCamadasMovel(item.m, item.dir, estado, q, item.semente || 0);
        if (d) pintarMovel(item, d);
        continue;
      }
      const d = redesenharParede(item, estado, q);
      if (!d) continue;
      seguirRegistro(item, d);
      juntarCamadasParede(item);
    }
  };
  prontos.then(() => { relogio = setInterval(animar, 1000 / (reduzido ? 12 : 24)); });

  // Post-its nas paredes do fundo (lado 0) e da esquerda (lado 1), como os
  // recados do Habbo: um quadradinho colorido inclinado no plano da parede.
  const postitsNos = [];
  let postitsAtuais = null;
  function postits(lista, aoClicar) {
    for (const n of postitsNos) n.remove();
    postitsNos.length = 0;
    postitsAtuais = [lista, aoClicar];
    if (!P.quarto || !P.divisorias.length) return;
    for (const q of lista || []) {
      const t = q.lado ? mapaTela(0, q.posicao, origem) : mapaTela(q.posicao, 0, origem);
      const n = document.createElement("button");
      n.type = "button";
      n.className = "mapa-postit " + (q.lado ? "esquerda" : "fundo");
      n.dataset.cor = q.cor;
      n.style.left = t.x + "px";
      n.style.top = t.y - 24 - q.altura * (MAPA_PAREDE - 48) + "px";
      // Na frente do trecho de parede onde está (como os quadros), atrás do resto.
      const eixo = q.lado ? "y" : "x", linha = muros.filter((w) => w.eixo === eixo && (eixo === "x" ? w.y === 0 : w.x === 0) && w.r > t.x - 9 && w.l < t.x + 9);
      n.style.zIndex = String((linha.length ? Math.max(...linha.map((w) => w.prof)) : Math.round(q.posicao * 10)) + 2);
      n.setAttribute("aria-label", `Post-it de ${q.nome}: ${q.texto}`);
      n.title = q.texto;
      n.addEventListener("pointerdown", (e) => e.stopPropagation());
      n.addEventListener("click", (e) => { e.stopPropagation(); aoClicar?.(q); });
      palco.append(n);
      postitsNos.push(n);
    }
  }
  return {
    origem, prontos, carga, atualizarPessoas, ladrilhoEm, grade: mostrarGrade, postits,
    // Piso e paredes pintados mudaram: redesenha só o fundo e as paredes.
    repintar: () => {
      fundoPronto?.();
      for (const m of muros) {
        const est = P.paredeEm?.(m.x, m.y, m.eixo);
        if (m.corBase === undefined) m.corBase = m.cor || "";
        const salaCor = P.divisorias.find((d) => d.sala && (m.eixo === "x" ? d[1] === d[3] && d[1] === m.y && m.x >= d[0] && m.x < d[2] : d[0] === d[2] && d[0] === m.x && m.y >= d[1] && m.y < d[3]))?.[4];
        m.cor = est?.cor || salaCor || m.corBase;
        m.estilo = est?.estilo || m.estiloBase; m.alt = est?.alt ?? m.altBase; m.textura = m.texturaDe(est);
      }
      pintarParedes(true);
    },
    // Ponto da janela de um ladrilho (para pôr a barrinha do editor ao lado do móvel).
    naJanela: (x, y) => { const r = palco.getBoundingClientRect(), t = mapaTela(x, y, origem); return { x: r.left + t.x * zoom, y: r.top + t.y * zoom }; },
    // Imagem nova (enviada agora) passa a poder ser desenhada.
    registrarImagem: (meta) => IMAGENS.set("vybeimg_" + meta.id, meta), centralizar, enquadrarQuarto, mudarZoom, definirMoveis, moveisEm, destacar, medidas, mover, seguir,
    objetoEm, selecionarPessoa, noDaPessoa: (id) => pessoas.get(String(id))?.no || null, balao, reagir, estadoBoneco, anexarVideo, marcarFalando, marcarAviso, marcarRecado, previa, olhar, idsNoMapa, marcarTrancas, moveisPerto, realcar, realcarVarios, posicoes, estadosMoveis, chaveMovel,
    caminho: (de, para, evitar, limite) => (grade ? mapaCaminho(grade, de, para, evitar, limite) : null),
    podePassar: (x, y, dx, dy) => Boolean(grade) && mapaPassa(grade, x, y, dx, dy),
    // Ladrilho fora do mapa ou tomado por parede/móvel sólido.
    bloqueadoEm: (x, y) => Boolean(grade) && (x < 0 || y < 0 || x >= grade.W || y >= grade.H || Boolean(grade.bloqueado[grade.ind(x, y)])),
    assentoEm: (x, y) => (grade ? grade.assento.get(grade.ind(Math.round(x), Math.round(y))) : undefined),
    camaEm: (x, y) => (grade ? grade.cama.get(grade.ind(Math.round(x), Math.round(y)))?.dir : undefined),
    // Onde se deita (como o Habbo): na linha da cabeceira, na mesma coluna.
    cabeceiraEm: (x, y) => {
      const c = grade?.cama.get(grade.ind(Math.round(x), Math.round(y)));
      if (!c) return null;
      return c.dir === 0 || c.dir === 4 ? { x: Math.round(x), y: c.y } : { x: c.x, y: Math.round(y) };
    },
    pisoEm: (x, y) => (grade ? grade.piso.get(grade.ind(Math.round(x), Math.round(y))) : undefined),
    portoes: () => moveis.filter((m) => mapaEhPortao(m.classe) && !m.altura),
    deslocarMovel, moveisDaClasse: (re) => moveis.filter((m) => re.test(m.classe)),
    // O ladrilho aceita a bola? Dentro da cena, sem móvel que não se empilha
    // (como no Habbo: validMove) e sem parede entre os dois.
    bolaPassa: (x, y, nx, ny) => {
      if (!grade || nx < 0 || ny < 0 || nx >= grade.W || ny >= grade.H) return false;
      if (P.andavel && !P.andavel(nx, ny)) return false;
      if (Math.abs(nx - x) + Math.abs(ny - y) === 1 && grade.paredes.has(grade.aresta(grade.ind(x, y), grade.ind(nx, ny)))) return false;
      return !moveis.some((m) => !/^fball_ball|^fball_goal/.test(m.classe) && !m.plano && !m.parede && nx >= Math.floor(m.x) && nx < Math.floor(m.x) + m.dim.x && ny >= Math.floor(m.y) && ny < Math.floor(m.y) + m.dim.y && !mapaFisica(m.classe).poe && !mapaFisica(m.classe).pisa);
    },
    tela: (x, y) => mapaTela(x, y, origem),
    destruir() { clearInterval(setaRelogio); clearInterval(relogioConversa); tamanhoQuarto?.disconnect(); clearInterval(relogio); clearInterval(relogioCeu); if (quadroCam) cancelAnimationFrame(quadroCam); for (const p of pessoas.values()) cancelAnimationFrame(p.passo); el.replaceChildren(); },
  };
}
