// Arquiteto do quarto voxel (Paulo, 13/11/2026: "as salas em voxel tão muito doidas ainda... não parece que um arquiteto
// passou aqui... a releitura de como era cada quarto de cada um no Habbo, nesse estilo novo, muito bem feito: um projeto
// arquitetônico bem detalhado de cada quarto").
//
// No Habbo, a pessoa constrói o quarto com peças soltas: placas de piso, painéis de parede, blocos, janelas e portas de
// chão. Desenhadas uma a uma em voxel, viravam lajes altas com vãos, placas elevadas e caixotes. O arquiteto lê essas
// peças como arquitetura, sem mudar nada do que a pessoa salvou:
//   - piso (placa de piso no chão)  → acabamento do piso naqueles ladrilhos, rente e contínuo, com o desenho do material;
//   - divisória/bloco em fila        → parede contínua (toras, reboco, vidro ou pedra), com pilar de canto, rodapé e
//                                      arremate; baixa, vira mureta. Perto da borda do quarto, encosta no limite;
//   - janela/porta de chão na parede → vão de verdade na parede, com caixilho, peitoril, porta e maçaneta.
// O resto (móveis, tapetes, estátuas, pedestais) segue para o motor de móveis como sempre. No modo Decorar o quarto mostra
// as peças uma a uma (para escolher e mover); o arquiteto vale para ver o quarto.

const PISOS_RE = /floor|tile|grass|shallow|water|sand|leaf|snow|ice|chao|chão|piso|marble|wood/;
const NAO_PISO_RE = /carpet|rug|(^|_)mat($|_)|tapete|bed|cama|hole/;
const ESTRUTURA_RE = /wall|panel|divider|dvdr|fence|roofblock|block|parede|divis|cerca|grade/;
const NAO_ESTRUTURA_RE = /cylinder|pillar|column|pedestal|plinth|trophy|statue|lamp|shelf|counter|gate/;
const JANELA_RE = /window|janela|vitral/;
const PORTA_RE = /(^|_)door|porta/;

const texto = (classe, info) => `${classe} ${info?.nome || ''}`.toLowerCase();

// O que a peça é para o arquiteto: 'piso', 'estrutura', 'janela', 'porta' ou null (móvel comum).
// ficha: { pisa, senta, deita, altura } do Habbo; info: { nome, categoria } do catálogo; z: altura em que a peça está.
export function classificar(classe, { ficha = null, info = null, z = 0, deParede = false } = {}) {
  if (deParede || !classe) return null;
  const t = texto(classe, info), cat = String(info?.categoria || '');
  if (JANELA_RE.test(t)) return 'janela';
  if (PORTA_RE.test(t) && !/doorbell|campainha/.test(t)) return 'porta';
  if (ficha?.pisa && !ficha.senta && !ficha.deita && (Number(ficha.altura) || 0) <= .05 && Number(z) <= .1
    && (cat === 'Pisos do acervo' || PISOS_RE.test(t)) && !NAO_PISO_RE.test(t)) return 'piso';
  if (ficha && !ficha.pisa && !ficha.senta && !ficha.deita && !NAO_ESTRUTURA_RE.test(t)
    && (cat === 'Divisórias' || cat === 'Blocos e materiais' || ESTRUTURA_RE.test(t))) return 'estrutura';
  return null;
}

// Material do piso pela classe e pelo nome: o desenho e as cores saem daqui (paleta própria, não a do Habbo).
export function materialDoPiso(classe, info = null) {
  const t = texto(classe, info);
  if (/shallow|water|agua|água|pool|piscina/.test(t)) return 'agua';
  if (/leaf|folha/.test(t)) return 'folhas';
  if (/grass|grama|lawn|jungle/.test(t)) return 'grama';
  if (/sand|areia|beach|praia/.test(t)) return 'areia';
  if (/snow|ice|neve|gelo/.test(t)) return 'neve';
  if (/marble|mármore|marmore/.test(t)) return /black|negro|dark|preto|hween/.test(t) ? 'marmoreEscuro' : 'marmore';
  if (/concrete|cimento|sb_tile|patch|stone|pedra|cobble/.test(t)) return 'concreto';
  return 'madeira';
}
// Material da parede pela classe e pelo nome.
export function materialDaEstrutura(classe, info = null) {
  const t = texto(classe, info);
  if (/glass|vidro|glss|glas/.test(t)) return 'vidro';
  if (/cabin|log|wood|madeira|viking|roof|telhado|barn|celeiro/.test(t)) return 'toras';
  if (/brick|tijolo/.test(t)) return 'tijolo';
  if (/stone|pedra|rock|castle|castelo|dungeon|dng/.test(t)) return 'pedra';
  return 'reboco';
}

// Passo entre peças iguais na mesma fila: o tamanho dela quando a medida do Habbo ainda não chegou. Vale a distância
// mais comum entre vizinhas da mesma fila (uma peça sobreposta, a 1 da outra, não encurta todas).
function passoDaFila(lista, eixo) {
  const outro = eixo === 'x' ? 'y' : 'x', filas = new Map(), conta = new Map();
  for (const a of lista) { const k = Math.round(a[outro] * 4); if (!filas.has(k)) filas.set(k, []); filas.get(k).push(a[eixo]); }
  for (const v of filas.values()) {
    v.sort((a, b) => a - b);
    for (let i = 1; i < v.length; i++) { const d = Math.round((v[i] - v[i - 1]) * 4) / 4; if (d > .4) conta.set(d, (conta.get(d) || 0) + 1); }
  }
  let melhor = 0, n = 0;
  for (const [d, c] of conta) if (c > n || (c === n && d > melhor)) { melhor = d; n = c; }
  return melhor;
}

// Projeto do quarto. itens: [classe, x, y, dir, estado, z]. Devolve:
//   pisos: Map 'x,y' → material (ladrilhos inteiros cobertos por placas de piso);
//   estruturas: [{ eixo, linha, a0, a1, base, alto, material, aberturas: [{ u, largura, tipo, peitoril, verga }] }];
//   usados: Set de índices de itens que o arquiteto desenha (o motor de móveis pula).
export function projetarQuarto(itens, { ficha = () => null, info = () => null, deParede = () => false, W = 0, D = 0, nivel = .82, alturaParede = 3 } = {}) {
  const pisos = new Map(), usados = new Set(), lista = (Array.isArray(itens) ? itens : []).map((it, i) => {
    const [classe, x, y, dir, , z] = Array.isArray(it) ? it : [];
    if (!classe || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return null;
    const c = String(classe), f = ficha(c), inf = info(c);
    return { i, classe: c, x: Number(x), y: Number(y), dir: Number(dir) || 0, z: Number(z) || 0, ficha: f, info: inf, tipo: classificar(c, { ficha: f, info: inf, z, deParede: deParede(c) }) };
  }).filter(Boolean);

  // ----- piso: cada placa cobre o seu quadrado (lado pelo passo entre as placas iguais; 2 é o normal do Habbo) -----
  const porClasse = new Map();
  for (const p of lista) if (p.tipo === 'piso') { if (!porClasse.has(p.classe)) porClasse.set(p.classe, []); porClasse.get(p.classe).push(p); }
  for (const [classe, grupo] of porClasse) {
    const passo = Math.max(passoDaFila(grupo, 'x'), passoDaFila(grupo, 'y'));
    const lado = Math.max(1, Math.min(4, Math.round(passo) || (String(grupo[0].info?.categoria) === 'Pisos do acervo' ? 2 : 1)));
    const mat = materialDoPiso(classe, grupo[0].info);
    for (const p of grupo) {
      const x0 = Math.round(p.x), y0 = Math.round(p.y);
      for (let a = 0; a < lado; a++) for (let b = 0; b < lado; b++) {
        const x = x0 + a, y = y0 + b; if (x < 0 || y < 0 || (W && x >= W) || (D && y >= D)) continue;
        pisos.set(x + ',' + y, mat);
      }
      usados.add(p.i);
    }
  }

  // ----- estruturas: peças de parede em fila viram uma parede contínua -----
  // Peça de construção fora do quarto (no Habbo ela some atrás do piso; aqui ficava uma parede solta no ar): não entra.
  const foraDoQuarto = (p) => (W && (p.x + .5 < -.6 || p.x + .5 > W + .6)) || (D && (p.y + .5 < -.6 || p.y + .5 > D + .6));
  for (const p of lista) if ((p.tipo === 'estrutura' || p.tipo === 'piso') && foraDoQuarto(p)) { usados.add(p.i); p.tipo = null; }
  const pecas = lista.filter((p) => p.tipo === 'estrutura').map((p) => {
    const iguais = lista.filter((q) => q.tipo === 'estrutura' && q.classe === p.classe);
    // Orientação: de lado (2/6) corre em y; de frente (0/4) corre em x. Bloco quadrado (1 × 1) segue a fila dos vizinhos.
    let eixo = p.dir === 2 || p.dir === 6 ? 'y' : 'x';
    const vizinho = (e) => iguais.some((q) => q !== p && Math.abs(q[e === 'x' ? 'y' : 'x'] - p[e === 'x' ? 'y' : 'x']) < .3 && Math.abs(q[e] - p[e]) <= 1.6);
    const longo = Math.max(passoDaFila(iguais, eixo), 1);
    if (longo <= 1.05 && !vizinho(eixo) && vizinho(eixo === 'x' ? 'y' : 'x')) eixo = eixo === 'x' ? 'y' : 'x';
    const comp = Math.max(1, Math.min(3, Math.round(passoDaFila(iguais, eixo)) || 1));
    const altoHabbo = (Number(p.ficha?.altura) || 0) * nivel;
    const material = materialDaEstrutura(p.classe, p.info);
    const alto = altoHabbo > .05 ? altoHabbo : material === 'vidro' ? 1.7 : 1;
    // Linha: o meio do ladrilho da peça; a 1 ladrilho da borda do quarto, encosta na borda (é a parede do quarto).
    let linha = eixo === 'x' ? Math.floor(p.y) + .5 : Math.floor(p.x) + .5;
    const limite = eixo === 'x' ? D : W;
    let naBordaFinal = false;
    if (linha < 1.2) linha = 0; else if (limite && linha > limite - 1.2) { linha = limite; naBordaFinal = true; }
    const a0 = eixo === 'x' ? p.x : p.y;
    return { p, eixo, linha, naBordaFinal, a0, a1: a0 + comp, base: p.z * nivel, alto: Math.min(alto, alturaParede * 1.2), material };
  });
  const filas = new Map();
  for (const e of pecas) {
    const k = `${e.eixo}|${e.linha.toFixed(2)}|${e.material}|${e.base.toFixed(1)}`;
    if (!filas.has(k)) filas.set(k, []); filas.get(k).push(e);
  }
  const estruturas = [];
  for (const grupo of filas.values()) {
    grupo.sort((a, b) => a.a0 - b.a0);
    let atual = null;
    const fechar = () => { if (atual && (atual.pecas.length >= 2 || atual.a1 - atual.a0 >= 1.9)) { estruturas.push(atual); atual.pecas.forEach((e) => usados.add(e.p.i)); } };
    for (const e of grupo) {
      if (atual && e.a0 <= atual.a1 + .6) { atual.a1 = Math.max(atual.a1, e.a1); atual.alto = Math.max(atual.alto, e.alto); atual.pecas.push(e); continue; }
      fechar();
      atual = { eixo: e.eixo, linha: e.linha, naBordaFinal: e.naBordaFinal, a0: e.a0, a1: e.a1, base: e.base, alto: e.alto, material: e.material, aberturas: [], pecas: [e] };
    }
    fechar();
  }
  for (const s of estruturas) {
    s.pecas = s.pecas.length; s.tipo = s.alto < 1.3 ? 'mureta' : 'parede';
    // A parede termina no limite do quarto (a peça do canto passava para fora do piso).
    const fim = s.eixo === 'x' ? W : D; s.a0 = Math.max(0, s.a0); if (fim) s.a1 = Math.min(fim, s.a1);
  }

  // ----- aberturas: janela e porta de chão encostadas numa parede viram vão nela -----
  for (const p of lista) {
    if (p.tipo !== 'janela' && p.tipo !== 'porta') continue;
    let melhor = null, dist = Infinity;
    for (const s of estruturas) {
      if (s.tipo !== 'parede') continue;
      const cruz = s.eixo === 'x' ? p.y + .5 : p.x + .5, ao = s.eixo === 'x' ? p.x + .5 : p.y + .5;
      const d = Math.abs(cruz - s.linha);
      if (d < 1.1 && ao > s.a0 - .4 && ao < s.a1 + .4 && d < dist) { dist = d; melhor = { s, ao }; }
    }
    if (!melhor) continue;
    const { s, ao } = melhor, porta = p.tipo === 'porta';
    const largura = porta ? 1 : 1.2, u = Math.max(s.a0 + largura / 2 + .1, Math.min(s.a1 - largura / 2 - .1, ao));
    if (s.aberturas.some((v) => Math.abs(v.u - u) < (v.largura + largura) / 2)) continue;
    const peitoril = porta ? 0 : Math.max(.7, Math.min(s.alto - 1.4, p.z * nivel || .85));
    s.aberturas.push({ u, largura, tipo: p.tipo, peitoril, verga: Math.min(s.alto - .25, porta ? 2.05 : peitoril + 1.3) });
    usados.add(p.i);
  }
  return { pisos, estruturas, usados };
}

// ---------- desenho ----------
const PALETA_MATERIAL = {
  toras: ['#B0623C', '#C9774A', '#8A5A3C', '#5E4030'],
  reboco: null, // a cor da parede do quarto
  vidro: ['#D6EEF4', '#F7F2E8'],
  tijolo: ['#B5573C', '#C9694A', '#E8DCCB'],
  pedra: ['#A39C92', '#8E877D', '#B8B1A6'],
};
// Escreve a parede/mureta na Obra. chao(x, z): altura do piso naquele ponto. cor: cor de reboco do quarto.
export function desenharEstrutura(o, s, { chao = () => 0, cor = '#EDE3D2', misturar, vidro = null }) {
  const t = s.tipo === 'mureta' ? .32 : s.material === 'vidro' ? .12 : .26;
  const no = (u) => (s.eixo === 'x' ? { x: u, z: s.linha } : { x: s.linha, z: u });
  const caixa = (u, y, du, h, esp, c, desloc = 0) => {
    const p = no(u); if (s.eixo === 'x') o.caixa(p.x, y, p.z + desloc, du, h, esp, c); else o.caixa(p.x + desloc, y, p.z, esp, h, du, c);
  };
  // Painel de vidro: transparente na cena (vidro(x, y, z, w, h, d)); sem quem desenhe vidro, uma placa clara.
  const painel = (u, y, du, h, esp, desloc = 0) => {
    if (!vidro) return caixa(u, y, du, h, esp, '#D6EEF4', desloc);
    const p = no(u); if (s.eixo === 'x') vidro(p.x, y, p.z + desloc, du, h, esp); else vidro(p.x + desloc, y, p.z, esp, h, du);
  };
  // Encostada na borda do quarto, a parede fica toda para dentro (não sai do piso).
  // Na borda do fundo (linha 0) ela entra meia espessura; na borda da frente (linha = lado do quarto), sai meia para dentro.
  const off = s.linha === 0 ? t / 2 : s.naBordaFinal ? -t / 2 : 0;
  const base = chao(no((s.a0 + s.a1) / 2).x, no((s.a0 + s.a1) / 2).z) + s.base;
  // Trechos cheios entre as aberturas.
  const vaos = [...s.aberturas].sort((a, b) => a.u - b.u), trechos = [];
  let ini = s.a0;
  for (const v of vaos) { trechos.push([ini, v.u - v.largura / 2, null]); trechos.push([v.u - v.largura / 2, v.u + v.largura / 2, v]); ini = v.u + v.largura / 2; }
  trechos.push([ini, s.a1, null]);
  const P = PALETA_MATERIAL[s.material] || null, rebocoCor = cor;
  const cheio = (u0, u1, y0, y1) => {
    if (u1 - u0 < .01 || y1 - y0 < .01) return;
    const du = u1 - u0, uc = (u0 + u1) / 2;
    if (s.material === 'toras') {
      // Toras deitadas de .2 de altura, tons alternados, cada uma um pouco mais grossa que o vão entre elas.
      for (let y = y0, k = 0; y < y1 - .001; y += .2, k++) {
        const h = Math.min(.2, y1 - y);
        caixa(uc, y + .02, du, h - .04, t, P[3], off);
        caixa(uc, y, du, h, t * .82, k % 2 ? P[0] : P[1], off);
        caixa(uc, y + h * .35, du, h * .3, t + .04, k % 2 ? misturar(P[0], '#FFFFFF', .08) : misturar(P[1], '#FFFFFF', .08), off);
      }
    } else if (s.material === 'tijolo' || s.material === 'pedra') {
      const fiada = s.material === 'tijolo' ? .16 : .3, comp = s.material === 'tijolo' ? .36 : .55;
      caixa(uc, y0, du, y1 - y0, t * .9, P[2] || P[1], off); // argamassa
      for (let y = y0, k = 0; y < y1 - .001; y += fiada, k++) {
        const h = Math.min(fiada, y1 - y) - .03;
        for (let u = u0 - (k % 2 ? comp / 2 : 0); u < u1 - .001; u += comp) {
          const a = Math.max(u0, u + .015), b = Math.min(u1, u + comp - .015); if (b - a < .03) continue;
          caixa((a + b) / 2, y + .015, b - a, h, t, (k + Math.round(u * 7)) % 3 ? P[0] : P[1], off);
        }
      }
    } else if (s.material === 'vidro') {
      painel(uc, y0, du, y1 - y0, t * .4, off);
    } else {
      caixa(uc, y0, du, y1 - y0, t, rebocoCor, off);
    }
  };
  const alto = s.alto;
  for (const [u0, u1, v] of trechos) {
    if (!v) { cheio(u0, u1, base, base + alto); continue; }
    // Vão: parede embaixo do peitoril e em cima da verga; o caixilho, o vidro e o peitoril (janela) ou a porta.
    cheio(u0, u1, base, base + v.peitoril);
    cheio(u0, u1, base + v.verga, base + alto);
    const uc = (u0 + u1) / 2, lar = u1 - u0, h = v.verga - v.peitoril, y0 = base + v.peitoril;
    const moldura = '#F7F2E8';
    caixa(uc, base + v.verga, lar + .16, .1, t + .08, moldura, off);               // verga
    for (const lado of [-1, 1]) caixa(uc + lado * (lar / 2 + .03), y0, .08, h, t + .06, moldura, off); // ombreiras
    if (v.tipo === 'janela') {
      caixa(uc, y0 - .08, lar + .3, .08, t + .22, moldura, off);                   // peitoril
      o.luz(no(uc).x + (s.eixo === 'x' ? 0 : off), y0 + .02, no(uc).z + (s.eixo === 'x' ? off : 0), s.eixo === 'x' ? lar - .04 : .03, h - .04, s.eixo === 'x' ? .03 : lar - .04, '#FFF6DC');
      caixa(uc, y0, .05, h, t * .5, moldura, off);                                 // montante
      caixa(uc, y0 + h * .55, lar, .05, t * .5, moldura, off);                     // travessa
    } else {
      const folha = '#8A5A3C';
      caixa(uc, y0 + .01, lar - .1, h - .03, t * .5, folha, off);
      for (const k of [.28, .66]) caixa(uc, y0 + h * k - .25, lar - .34, .5, t * .5 + .04, misturar(folha, '#FFFFFF', .12), off); // almofadas da porta
      caixa(uc + lar * .3, y0 + h * .45, .06, .06, t * .5 + .1, '#F2C230', off);  // maçaneta
    }
  }
  // Pilares nas pontas, rodapé e arremate em cima (o acabamento das referências).
  const cap = s.material === 'vidro' ? '#F7F2E8' : s.material === 'reboco' ? misturar(rebocoCor, '#FFFFFF', .3) : (P ? misturar(P[2] || P[1], '#1F1D1A', .1) : '#F7F2E8');
  for (const u of [s.a0, s.a1]) caixa(u, base, t + .1, alto + .08, t + .1, s.material === 'vidro' ? '#3A3F45' : cap, off);
  caixa((s.a0 + s.a1) / 2, base + alto, s.a1 - s.a0 + .1, s.tipo === 'mureta' ? .1 : .12, t + .1, cap, off);
  if (s.material === 'vidro') { caixa((s.a0 + s.a1) / 2, base, s.a1 - s.a0, .12, t + .04, '#3A3F45', off); for (let u = s.a0 + 1; u < s.a1 - .5; u += 1) caixa(u, base, .06, alto, t + .02, '#3A3F45', off); }
  else if (s.material === 'reboco' && s.tipo === 'parede') caixa((s.a0 + s.a1) / 2, base, s.a1 - s.a0, .16, t + .06, '#F7F2E8', off);
}

// Um ladrilho de piso no material do projeto. topo: altura do piso. Escreve na Obra.
export function desenharPiso(o, x, y, topo, mat, misturar) {
  const r = (n) => { const v = Math.sin((x * 12.9898 + y * 78.233 + n * 37.719) * 1.3) * 43758.5453; return v - Math.floor(v); };
  // base: embaixo do acabamento, terminando 2 cm abaixo do topo (no mesmo plano, base e acabamento brigavam pelo pixel e
  // o piso saía em triângulos que mudavam com o zoom); chao: a própria superfície, até o topo (grama, areia, neve).
  const placa = (cor, h = .1) => o.caixa(x + .5, topo - .02 - h, y + .5, 1, h, 1, cor);
  const chao = (cor, h = .12) => o.caixa(x + .5, topo - h, y + .5, 1, h, 1, cor);
  if (mat === 'madeira') {
    const a = '#C9774A', b = '#B0623C';
    placa(misturar(a, '#1F1D1A', .45), .1);
    for (let k = 0; k < 4; k++) {
      const z = y + k * .25 + .125, corte = ((x * 7 + y * 4 + k * 3) % 4) * .25, t = ((x * 13 + y * 7 + k * 5) % 5) / 5;
      const cor = misturar(a, t < .4 ? b : '#FFFFFF', t < .4 ? .5 : .08 * t);
      for (const [x0, x1] of corte ? [[0, corte], [corte, 1]] : [[0, 1]]) o.caixa(x + (x0 + x1) / 2, topo - .02, z, x1 - x0 - .03, .02, .22, cor);
    }
    return;
  }
  if (mat === 'marmore' || mat === 'marmoreEscuro' || mat === 'concreto') {
    const [c0, c1, veio] = mat === 'marmore' ? ['#EFE9DF', '#E6DED1', '#CFC5B5'] : mat === 'marmoreEscuro' ? ['#33302D', '#3D3935', '#8C857C'] : ['#BDB7AE', '#B3ADA4', '#9C968D'];
    placa(misturar(c0, '#1F1D1A', .25), .1);
    o.caixa(x + .5, topo - .02, y + .5, .97, .02, .97, (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? c0 : c1);
    if (mat !== 'concreto') for (let k = 0; k < 2; k++) if (r(k) > .45) o.caixa(x + .2 + r(k + 2) * .6, topo, y + .2 + r(k + 4) * .6, .05 + r(k + 6) * .3, .006, .03, veio); // veio: 6 mm acima, nunca no mesmo plano
    return;
  }
  if (mat === 'agua') {
    o.caixa(x + .5, topo - .14, y + .5, 1, .06, 1, '#2F7FA8');                    // fundo
    o.caixa(x + .5, topo - .08, y + .5, 1, .03, 1, '#5CB8DE');                    // lâmina d'água, rebaixada
    if (r(1) > .5) o.caixa(x + .2 + r(2) * .6, topo - .05, y + .3 + r(3) * .4, .3, .01, .04, '#B7E6F5');
    return;
  }
  if (mat === 'grama' || mat === 'folhas') {
    chao(mat === 'grama' ? '#5FA34E' : '#6E8B45');
    for (let k = 0; k < 4; k++) {
      const px = x + .15 + r(k) * .7, pz = y + .15 + r(k + 9) * .7;
      if (mat === 'grama') o.caixa(px, topo, pz, .12, .06 + k * .013 + r(k + 3) * .04, .12, ['#6FB353', '#86C46A', '#4F9A4E'][k % 3]);
      else o.caixa(px, topo, pz, .16, .015 + k * .005, .1, ['#E2A23B', '#C8622E', '#9BBF52', '#F2C230'][Math.floor(r(k + 5) * 4)]); // cada folha numa altura: nunca no mesmo plano
    }
    return;
  }
  if (mat === 'areia') { chao('#E8D3A2'); if (r(1) > .6) o.caixa(x + .5, topo, y + .5, .3, .01, .2, '#F4E6C2'); return; }
  if (mat === 'neve') { chao('#F2F6FA'); return; }
  chao('#C9774A');
}
