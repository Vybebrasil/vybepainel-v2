// Motor de construção das cenas do Escritório. A sala é descrita peça por
// peça (ou por conjuntos, que usam o mesmo caminho) em scripts/cenas/<id>.mjs,
// e cada peça é conferida no momento em que é posta, com a ficha oficial do
// Habbo (fisica.json) e a arte dela (tamanho, direções, silhueta):
// - ocupa o ladrilho certo, sem cair em cima de outra nem sair da sala;
// - o que vai em cima apoia no topo da peça de baixo (altura calculada, não
//   escrita à mão) e só em peça que aceita coisa em cima;
// - assento olha para onde se pede, numa direção que a arte tem;
// - tapete cobre o conjunto inteiro, centralizado;
// - quadro, janela e arandela ganham espaço medido pela arte, sem tapar
//   outro item de parede nem ficar atrás de móvel alto;
// - lâmpada pendurada não cruza item de parede perto dela;
// - figurante sentado só em assento de verdade, na direção dele.
// O que não passa vira erro com o motivo: a sala não é gerada.
//
// Gerar as cenas: node scripts/escritorio-compor.mjs (ver lá).
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { silhueta, emComum, frenteDaPeca } from "./escritorio-desenho.mjs";

const PASTA = "assets/escritorio/habbo";
const FICHA = JSON.parse(readFileSync(`${PASTA}/fisica.json`, "utf8"));
// Tampos medidos na arte (ESCRITORIO_TAMPOS do planta): onde a ficha erra a
// altura, vale a medida, como no mapa e no verificador.
const ctx = { console, window: {}, document: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync("vybe-escritorio-planta.js", "utf8") + "\n;globalThis.__tampos = ESCRITORIO_TAMPOS; globalThis.__planta = ESCRITORIO_PLANTA; globalThis.__topo = escritorioTopoDaParede;", ctx);
const TAMPOS = ctx.__tampos;
// Regras de desenho do mapa que a construção precisa seguir igual.
vm.runInContext(readFileSync("vybe-escritorio-mapa.js", "utf8") + "\n;globalThis.__reveste = mapaEhRevestimento;", ctx);
const artes = new Map();
export function peca(classe) {
  if (artes.has(classe)) return artes.get(classe);
  const f = `${PASTA}/${classe}.json`;
  if (!existsSync(f)) throw new Error(`${classe}: sem arte no painel (extraia do acervo antes)`);
  const j = JSON.parse(readFileSync(f, "utf8"));
  const v = j.visualizations.find((x) => x.size === 64);
  const d = j.logic?.model?.dimensions || { x: 1, y: 1, z: 1 };
  const dirs = Object.keys(v?.directions || {}).map(Number).sort((a, b) => a - b);
  const fi = FICHA[classe];
  const flags = fi ? fi[0] : 0;
  const parede = fi ? Boolean(flags & 16) : dirs.length > 0 && dirs.every((x) => x === 2 || x === 4) && (d.y ?? 1) <= 0.3;
  const p = {
    classe, d, dirs, parede,
    pisa: Boolean(flags & 1), senta: Boolean(flags & 2), deita: Boolean(flags & 4), poe: Boolean(flags & 8),
    topo: TAMPOS[classe] ?? fi?.[1] ?? d.z ?? 0,
    // Plana: tapete, piso de obra, lâmpada de teto (altura zero e pisável).
    plana: Boolean(fi) && (fi[1] ?? 0) <= 0.11 && Boolean(flags & 1),
  };
  // Revestimento: papel de parede ou lambri do Habbo (item de parede largo e
  // da altura da parede), que fica por baixo dos quadros.
  p.revestimento = revestimento(p);
  artes.set(classe, p);
  return p;
}
// Altura de um item de parede pelo desenho (em níveis de 32 px), sem a
// inclinação da largura: a ficha erra (papel de parede de "3" cobre 5 a 7).
export function alturaNaParede(classe, dir, estado = 0) {
  const s = silhueta(classe, dir, estado);
  return s ? (s.h - s.w / 2) / 32 : 1;
}
export const revestimento = (p) => ctx.__reveste(p.d, p.parede);
// Para onde a frente olha: a mesma regra do verificador (escritorio-desenho.mjs).
export function frente(p, dir) {
  const [w, h] = pegada(p, dir);
  return frenteDaPeca(p.dirs, w, h, dir);
}
function dirPara(p, dx, dy) {
  const quer = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
  const d = p.dirs.find((x) => { const f = frente(p, x); return f && f[0] === quer[0] && f[1] === quer[1]; });
  if (d === undefined) throw new Error(`${p.classe}: a arte não tem frente para (${quer}); direções ${p.dirs.join(", ")}`);
  return d;
}
const pegada = (p, dir) => (dir === 2 || dir === 6 ? [Math.max(1, p.d.y | 0 || 1), Math.max(1, p.d.x | 0 || 1)] : [Math.max(1, p.d.x | 0 || 1), Math.max(1, p.d.y | 0 || 1)]);

// Tamanho da sala e topo da parede vêm da planta (a mesma conta do mapa:
// 3,6 níveis mais o acréscimo da sala, como a parede do Habbo); a cena não
// copia esses números.
export function novaCena(id, o = {}) {
  const a = ctx.__planta?.ambientes?.find((q) => q.id === id);
  const w = o.w ?? (a ? a.x1 - a.x0 : undefined), h = o.h ?? (a ? a.y1 - a.y0 : undefined);
  const topoParede = o.topoParede ?? (a?.modelo ? ctx.__topo(a) : Infinity);
  if (!w || !h) throw new Error(`${id}: sala sem tamanho (nem na planta, nem na cena)`);
  // Degraus da planta (nível de cada ladrilho): piso e tapete não atravessam
  // degrau (a placa cobriria o desnível e o patamar sumiria).
  const celdas = a?.modelo?.celdas;
  const nivelPlanta = (x, y) => Number(celdas?.[y]?.[x] ?? 0) || 0;
  const mesmoNivel = (x, y, pw, ph) => { const n = nivelPlanta(x, y); for (let i = 0; i < pw; i++) for (let j = 0; j < ph; j++) if (nivelPlanta(x + i, y + j) !== n) return false; return true; };
  const moveis = [], figurantes = [], erros = [];
  // Camadas por ladrilho: "piso" (piso de obra), "tapete", "solido" (móvel
  // no chão de um nível), "pilha" (lista do que está empilhado, com topo).
  const lad = new Map();
  const at = (x, y, n) => { const k = `${x},${y},${n}`; if (!lad.has(k)) lad.set(k, { pilha: [] }); return lad.get(k); };
  const niveis = new Map([[0, { base: 0 }]]); // nível → altura da base (mezanino)
  const paredes = []; // itens de parede já postos: { lado, a, b, y0, y1 (px), nome }
  const altos = []; // móveis encostados na parede (para não pendurar quadro atrás)
  const revestidos = []; // trechos de parede já revestidos
  const pisos = new Set(), escadas = [], daCasca = new Set(), postos = [];
  let cascaFeita = false;
  const falha = (m) => { erros.push(`${id}: ${m}`); return null; };
  const nome = (c, x, y) => `${c} (${x},${y})`;

  const api = {
    id, w, h, moveis, figurantes, erros,
    // Andar elevado de construtor: tábuas finas no alto, guarda-corpo nos
    // lados abertos e colunas empilhadas até a beira. Vira o nível 1.
    // abertura: [xa, xb) da frente sem guarda-corpo, onde chega a escada.
    mezanino({ x0, y0, x1, y1, altura, piso, estadoPiso = 0, guarda, coluna, colunas = [], lados = ["frente"], abertura = null }) {
      const pp = peca(piso), [pw, ph] = pegada(pp, 0);
      pisos.add(`${piso}|${estadoPiso}|1`);
      for (let x = x0; x < x1; x += pw) for (let y = y0; y < y1; y += ph) {
        moveis.push([piso, x, y, 0, estadoPiso, altura]);
        for (let i = 0; i < pw; i++) for (let j = 0; j < ph; j++) at(x + i, y + j, 1).piso = piso;
      }
      niveis.set(1, { base: altura + pp.topo, x0, y0, x1, y1, lados, abertura });
      const pg = peca(guarda);
      // Guarda-corpo segura: a ficha do Habbo não pode deixar pisar nele
      // (a divisória de vidro da mansão é pisável e deixaria cair da beira).
      if (pg.pisa) return falha(`guarda-corpo ${guarda} é pisável na ficha do Habbo: não segura ninguém na beira do mezanino`);
      if (lados.includes("frente")) {
        const [gw] = pegada(pg, 0);
        for (let x = x0; x < x1; x += gw) {
          if (abertura && x < abertura[1] && x + gw > abertura[0]) continue;
          api.por(guarda, x, y1 - 1, { dir: 0, nivel: 1, beira: true });
        }
      }
      const pc = peca(coluna);
      if (lados.includes("direita")) {
        // Lado direito até a esquina; o ladrilho que sobra fecha com um pilar.
        const [, gh] = pegada(pg, 6);
        let y = y0;
        for (; y + gh <= y1 - 1; y += gh) api.por(guarda, x1 - 1, y, { dir: 6, nivel: 1, beira: true });
        for (; y < y1 - 1; y++) api.por(coluna, x1 - 1, y, { nivel: 1 });
      }
      // Colunas do térreo até a beira: peças iguais empilhadas, uma por nível.
      const n = Math.round(altura / (pc.topo || 1));
      for (const x of colunas) {
        const c = at(x, y1 - 1, 0);
        if (c.solido) return falha(`coluna em ${x},${y1 - 1} em cima de ${c.solido.nome}`);
        c.solido = { nome: nome(coluna, x, y1 - 1), classe: coluna };
        for (let k = 0; k < n; k++) moveis.push([coluna, x, y1 - 1, 0, 0, k * (pc.topo || 1)]);
      }
    },
    // Casca da sala: forro e cornija no topo das paredes, com a mesma função
    // da planta (escritorioCascaDoQuarto). Cada peça da cornija entra na
    // conferência da parede: nada pendurado fica atrás dela.
    casca(forro, variantes, cornija, colunas = []) {
      // A cornija é um ladrilho fino posto no topo da parede (como o do Café);
      // bloco sólido lá em cima fica flutuando.
      if (!peca(cornija[0]).plana) return falha(`cornija ${cornija[0]} não é peça fina: fica flutuando no topo da parede`);
      cascaFeita = true;
      for (const m of ctx.escritorioCascaDoQuarto(id, forro, variantes, cornija, colunas)) {
        moveis.push(m);
        daCasca.add(m);
        const [classe, x, y, dir, estado, altura] = m, p = peca(classe);
        if (p.parede) continue;
        const [pw, ph] = pegada(p, dir);
        altos.push({ it: { classe, nome: `cornija ${nome(classe, x, y)}`, x, y, dir, pw, ph, estado, altura }, n: 0, p });
      }
    },
    // Piso de obra (tábuas, ladrilho) cobrindo um retângulo do térreo.
    piso(classe, { x0, y0, x1, y1, estado = 0 }) {
      const p = peca(classe), [pw, ph] = pegada(p, 0);
      // Piso tem que ser pisável e rente (no Habbo, o que vai em cima de um
      // piso com altura sobe junto; as tábuas da cabana têm 0,1).
      if (!p.pisa) return falha(`piso ${classe} não é pisável na ficha do Habbo`);
      if (p.topo > 0.01) return falha(`piso ${classe} tem altura ${p.topo} na ficha: o que vai em cima teria de subir junto; use um piso rente`);
      pisos.add(`${classe}|${estado}|${nivelPlanta(x0, y0)}`);
      if ((x1 - x0) % pw || (y1 - y0) % ph) return falha(`piso ${classe} (${pw}×${ph}) não fecha o retângulo ${x0},${y0}–${x1},${y1}`);
      for (let x = x0; x < x1; x += pw) for (let y = y0; y < y1; y += ph) {
        if (!mesmoNivel(x, y, pw, ph)) return falha(`piso ${classe} em ${x},${y} atravessa um degrau da planta`);
        moveis.push([classe, x, y, 0, estado, 0]);
        for (let i = 0; i < pw; i++) for (let j = 0; j < ph; j++) {
          const c = at(x + i, y + j, 0);
          if (c.piso) return falha(`piso ${classe} em cima de ${c.piso} em ${x + i},${y + j}`);
          c.piso = classe;
        }
      }
    },
    // Uma peça no piso (ou no mezanino, nivel 1). opções:
    //   dir: direção pedida; olha: [x, y] para virar a frente para lá;
    //   estado; sobre: true para empilhar no topo do que está no ladrilho;
    //   beira: guarda-corpo (pode ficar na beira do mezanino);
    //   flutuante: altura de prateleira fina presa na parede (sem pé).
    //   (Peça não divide ladrilho com outra no chão: no mapa a de trás some,
    //   como a hera posta no ladrilho da coluna do Café.)
    por(classe, x, y, o = {}) {
      const p = peca(classe), n = o.nivel || 0, nv = niveis.get(n);
      if (p.parede) return falha(`${classe} é de parede: use parede()`);
      let dir = o.dir;
      if (o.olha) dir = dirPara(p, o.olha[0] - x, o.olha[1] - y);
      dir ??= p.dirs.includes(0) ? 0 : p.dirs[0] ?? 0;
      if (p.dirs.length && !p.dirs.includes(dir)) return falha(`${nome(classe, x, y)}: a arte não tem a direção ${dir} (tem ${p.dirs.join(", ")})`);
      const [pw, ph] = pegada(p, dir);
      if (x < 0 || y < 0 || x + pw > w || y + ph > h) return falha(`${nome(classe, x, y)} sai da sala`);
      if (n && (x < nv.x0 || y < nv.y0 || x + pw > nv.x1 || y + ph > nv.y1)) return falha(`${nome(classe, x, y)} sai do mezanino`);
      if (!n && !o.sobre && !p.plana) {
        const m = niveis.get(1);
        if (m && x < m.x1 && y < m.y1 && x + pw > m.x0 && y + ph > m.y0) {
          if ((p.topo || 1) > 2.9) return falha(`${nome(classe, x, y)} é alto demais para ficar embaixo do mezanino`);
          // Embaixo do mezanino só na fileira da beira (o balcão do Café):
          // mais para dentro, o andar de cima é desenhado por cima da peça e
          // parece invadir o térreo (Paulo, 18/10/2026).
          const naBeira = y >= m.y1 - 1 || (m.lados?.includes("direita") && x >= m.x1 - 1);
          if (!naBeira) return falha(`${nome(classe, x, y)} fica embaixo do mezanino, longe da beira: o andar de cima tapa a peça`);
        }
      }
      // Ladrilho guardado (pé, chegada e lados da escada): nada no chão.
      if (!o.sobre && !p.plana) for (let i = 0; i < pw; i++) for (let j = 0; j < ph; j++) {
        const r = at(x + i, y + j, n).reservado;
        if (r && !(o.empilhador || o.degrau)) return falha(`${nome(classe, x, y)} no ${r}: tem de ficar livre`);
      }
      let altura = nv.base;
      if (o.flutuante != null) {
        if (!p.plana) return falha(`${nome(classe, x, y)} não é fina para ficar presa na parede`);
        if (x !== 0 && y !== 0) return falha(`${nome(classe, x, y)} flutuante longe da parede`);
        altura = nv.base + o.flutuante;
      } else if (o.sobre) {
        const base = at(x, y, n).pilha.at(-1);
        if (!base) return falha(`${nome(classe, x, y)}: não há nada embaixo para apoiar`);
        // Empilhador do Habbo (peça de obra, como degrau de escada): empilha
        // mesmo onde a ficha não deixa pôr coisas em cima.
        if (!base.poe && !(o.empilhador && base.classe === classe)) return falha(`${nome(classe, x, y)}: ${base.classe} não aceita nada em cima (ficha do Habbo)`);
        altura = base.topo;
      } else if (p.plana) {
        for (let i = 0; i < pw; i++) for (let j = 0; j < ph; j++) {
          const c = at(x + i, y + j, n);
          if (c.tapete && !/floor|tile/.test(classe)) return falha(`${nome(classe, x, y)} em cima do tapete ${c.tapete}`);
          if (c.solido) return falha(`${nome(classe, x, y)} posto depois de ${c.solido.classe}: ponha o tapete antes dos móveis`);
          c.tapete = classe;
        }
      } else {
        for (let i = 0; i < pw; i++) for (let j = 0; j < ph; j++) {
          const c = at(x + i, y + j, n);
          if (c.solido) return falha(`${nome(classe, x, y)} em cima de ${c.solido.nome}`);
        }
      }
      const it = { classe, nome: nome(classe, x, y), x, y, n, dir, pw, ph, estado: o.estado || 0, altura, poe: p.poe, senta: p.senta, frente: p.senta ? frente(p, dir) : null, tapete: p.plana && !o.sobre && !/floor|tile/.test(classe) && !o.flutuante, topo: Math.round((altura + (p.plana ? 0 : p.topo)) * 1000) / 1000 };
      if (!p.plana || o.sobre) for (let i = 0; i < pw; i++) for (let j = 0; j < ph; j++) {
        const c = at(x + i, y + j, n);
        if (!o.sobre) c.solido = it;
        c.pilha.push(it);
      }
      // Encostado na parede do fundo ou da esquerda: guarda o vão que ocupa.
      // Peça fina de chão desenhada no alto (quadro oval, prateleira com
      // relógio, cabideiro de parede): a arte do Habbo já vem na parede, com
      // altura zero; só faz sentido encostada nela e entra na conferência da
      // parede como as outras.
      const sl = p.plana && !o.sobre ? silhueta(classe, dir, o.estado || 0) : null;
      const decoracao = Boolean(sl) && (16 - (sl.y + sl.h)) / 32 >= 1;
      if (decoracao && x !== 0 && y !== 0) return falha(`${nome(classe, x, y)} é decoração de parede (a arte já vem no alto): fica encostada na parede`);
      if ((!p.plana || o.flutuante != null || decoracao) && !o.sobre && (y === 0 || x === 0)) altos.push({ it, n, p, decor: decoracao || o.flutuante != null });
      if (!o.sobre) postos.push(it);
      moveis.push([classe, x, y, dir, o.estado || 0, Math.round(altura * 1000) / 1000]);
      return it;
    },
    // Assento virado para um alvo (mesa, lareira, palco).
    assento(classe, x, y, alvo, o = {}) {
      const p = peca(classe);
      if (!p.senta) return falha(`${nome(classe, x, y)}: a ficha do Habbo não deixa sentar`);
      return api.por(classe, x, y, { ...o, olha: alvo });
    },
    // Coisa em cima de outra, na ordem (prato, depois o bolo).
    emCima(x, y, classes, o = {}) {
      let ult = null;
      for (const c of [classes].flat()) ult = api.por(c, x, y, { ...o, sobre: true });
      return ult;
    },
    // Mesa com cadeiras viradas para ela, tapete centralizado embaixo do
    // conjunto, o que vai em cima e, se pedido, lâmpada e figurante.
    mesa({ x, y, tampo, cadeira, lados = ["esquerda", "direita"], tapete, sobre = [], lampada, figurante, nivel = 0 }) {
      const L = { esquerda: [-1, 0], direita: [1, 0], tras: [0, -1], frente: [0, 1] };
      const pt = peca(tampo), [tw, th] = pegada(pt, 0);
      const lugares = lados.map((l) => [l, l === "direita" ? x + tw : l === "frente" ? x : x + L[l][0], l === "frente" ? y + th : y + L[l][1]]);
      const xs = [x, x + tw - 1, ...lugares.map((l) => l[1])], ys = [y, y + th - 1, ...lugares.map((l) => l[2])];
      if (tapete) api.tapete(tapete, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), nivel);
      api.por(tampo, x, y, { nivel });
      if (sobre.length) api.emCima(x, y, sobre, { nivel });
      const cadeiras = {};
      for (const [l, cx, cy] of lugares) cadeiras[l] = api.assento(cadeira, cx, cy, [x, y], { nivel });
      if (lampada) api.lampada(lampada, x, y, nivel);
      if (figurante) api.figurante({ ...figurante, sentado: cadeiras[figurante.lado] });
      return cadeiras;
    },
    // Conjunto de estar no esquadro: sofá de costas para (x, y) olhando para
    // "frente" (+y) ou "direita" (+x), mesa de centro colada na frente e
    // centrada nele, poltronas dos dois lados da mesa viradas para ela,
    // criados-mudos nas pontas do sofá (na mesma fileira, nunca atrás do
    // encosto) e tapete cobrindo o conjunto com a mesma sobra dos lados.
    // poltronas: ["antes", "depois"] (lado de x/y menor e maior).
    estar({ x, y, olha = "frente", sofa, mesa: tampo, poltrona, poltronas = ["antes", "depois"], criado, criados = [], tapete, sobreMesa = [], sobreCriado = {}, nivel = 0 }) {
      const f = olha === "frente" ? [0, 1] : olha === "direita" ? [1, 0] : null;
      if (!f) return falha(`estar em ${x},${y}: olha "${olha}" (só "frente" ou "direita", de frente para quem olha a sala)`);
      // ao(a, b): a ao longo do sofá, b para a frente dele.
      const ao = (a, b) => (f[1] ? [x + a, y + b] : [x + b, y + a]);
      const ps = peca(sofa), [aw, ah] = (() => { const d = dirPara(ps, f[0], f[1]); return pegada(ps, d); })();
      const sl = f[1] ? aw : ah;
      // A mesa gira para centrar no sofá (comprimento com a mesma paridade).
      const pm = peca(tampo), giros = (pm.dirs.length ? pm.dirs : [0]).map((d) => { const [mw, mh] = pegada(pm, d); return { d, ml: f[1] ? mw : mh, mp: f[1] ? mh : mw }; });
      const giro = giros.filter((g) => (sl - g.ml) % 2 === 0 && g.ml <= sl).sort((u, v) => u.mp - v.mp)[0];
      if (!giro) return falha(`estar em ${x},${y}: mesa ${tampo} não centra no sofá ${sofa} (${sl}) em nenhum giro`);
      const { ml, mp } = giro;
      const m0 = (sl - ml) / 2;
      const lados = poltronas.map((l) => [l, l === "antes" ? m0 - 1 : m0 + ml]);
      // Na câmera do Habbo o sofá (desenhado depois) cobre o ladrilho do lado
      // "antes" dele: o criado-mudo ali some. Só no lado "depois".
      if (criados.includes("antes")) return falha(`estar em ${x},${y}: criado-mudo do lado "antes" fica escondido atrás do sofá na tela; use o lado "depois"`);
      const pontas = criados.map((l) => [l, l === "antes" ? -1 : sl]);
      if (tapete) {
        // O tapete é do sofá, da mesa e das poltronas; o criado fica fora, inteiro.
        const as = [0, sl - 1, ...lados.map((l) => l[1])], bs = [0, mp];
        const [ax, ay] = ao(Math.min(...as), 0), [bx, by] = ao(Math.max(...as), Math.max(...bs));
        api.tapete(tapete, Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), nivel);
      }
      const [sx, sy] = ao(0, 0), [tx, ty] = ao(m0, 1);
      const assentos = { sofa: api.assento(sofa, sx, sy, ao(m0, 2), { nivel }) };
      api.por(tampo, tx, ty, { nivel, dir: giro.d });
      // O que vai na mesa fica no ladrilho dela mais longe do sofá (o sofá
      // de vários lugares é desenhado por cima do ladrilho colado nele).
      if (sobreMesa.length) { const [fx, fy] = ao(m0, mp); api.emCima(fx, fy, sobreMesa, { nivel }); }
      for (const [l, a] of lados) { const [cx, cy] = ao(a, 1); assentos[l] = api.assento(poltrona, cx, cy, [tx, ty], { nivel }); }
      for (const [l, a] of pontas) {
        const [cx, cy] = ao(a, 0);
        api.por(criado, cx, cy, { nivel });
        if (sobreCriado[l]) api.emCima(cx, cy, sobreCriado[l], { nivel });
      }
      return assentos;
    },
    // Tapete que cobre o retângulo de ladrilhos [x0..x1]×[y0..y1], centrado:
    // escolhe a direção que cobre e recusa o que não cobre.
    tapete(classe, x0, y0, x1, y1, nivel = 0) {
      const p = peca(classe), bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      // Tapete rente: com altura na ficha, o que vai em cima teria de subir.
      if (p.topo > 0.01) return falha(`tapete ${classe} tem altura ${p.topo} na ficha: o que vai em cima teria de subir junto; use um tapete rente`);
      // Sobra igual dos dois lados (senão o tapete fica torto, puxado para um lado).
      const op = p.dirs.map((d) => [d, ...pegada(p, d)]).filter(([, a, b]) => a >= bw && b >= bh && (a - bw) % 2 === 0 && (b - bh) % 2 === 0)
        .sort((u, v) => u[1] * u[2] - v[1] * v[2] || Math.abs(u[1] - bw) + Math.abs(u[2] - bh) - Math.abs(v[1] - bw) - Math.abs(v[2] - bh));
      if (!op.length) return falha(`tapete ${classe} não cobre o conjunto ${bw}×${bh} em ${x0},${y0} com a mesma sobra dos dois lados`);
      const [d, a, b] = op[0];
      if (!mesmoNivel(x0 - (a - bw) / 2, y0 - (b - bh) / 2, a, b)) return falha(`tapete ${classe} em ${x0},${y0} atravessa um degrau da planta`);
      return api.por(classe, x0 - (a - bw) / 2, y0 - (b - bh) / 2, { dir: d, nivel });
    },
    // Peça pendurada do teto sobre o ladrilho (lâmpada, lustre, vaso de
    // planta): fina na ficha. A arte do Habbo já vem desenhada pendendo do
    // teto, então a altura padrão é zero; a conta é pela arte: a parte de
    // baixo passa acima da cabeça de quem anda (3 níveis) e a de cima não
    // sai além da parede. Nada pendurado embaixo do mezanino. O fio é
    // conferido contra os itens de parede perto (fechar).
    pendente(classe, x, y, { nivel = 0, estado = 1, altura = 0, dir = 0 } = {}) {
      const p = peca(classe);
      if (!p.plana) return falha(`${nome(classe, x, y)} não é peça de pendurar (a ficha dá altura ${p.topo})`);
      if (p.dirs.length && !p.dirs.includes(dir)) return falha(`${nome(classe, x, y)}: a arte não tem a direção ${dir}`);
      const m = niveis.get(1);
      if (!nivel && m && x >= m.x0 && x < m.x1 && y >= m.y0 && y < m.y1) return falha(`${nome(classe, x, y)} pendurada embaixo do mezanino`);
      const base = niveis.get(nivel).base, alt = Math.round((base + altura) * 1000) / 1000;
      // A altura conta pela peça, sem o facho da camada de luz (o lustre
      // executivo tem um cone de luz que desce até o chão).
      const sl = silhueta(classe, dir, estado) || silhueta(classe, dir, estado, true);
      if (sl) {
        const baixo = (16 - (sl.y + sl.h)) / 32 + alt, alto = (16 - sl.y) / 32 + alt;
        if (baixo < base + 3) return falha(`${nome(classe, x, y)} pendurada baixa demais: o desenho desce até ${baixo.toFixed(1)} (quem passa bate a cabeça)`);
        if (alto > topoParede + 1.5) return falha(`${nome(classe, x, y)} pendurada alta demais: o desenho vai até ${alto.toFixed(1)}, a parede acaba em ${topoParede}`);
      }
      moveis.push([classe, x, y, dir, estado, alt]);
      api._lampadas.push({ classe, x, y, nivel, estado, dir, alt });
    },
    lampada(classe, x, y, nivel = 0, estado = 1) { api.pendente(classe, x, y, { nivel, estado }); },
    _lampadas: [],
    // Revestimento de parede (papel, lambri) cobrindo um trecho inteiro, peça
    // a peça na largura da ficha; fica por baixo dos itens de parede.
    revestir(lado, { de, ate, nivel = 0, altura = 0, classe, estado = 0 }) {
      const p = peca(classe), dir = lado === "fundo" ? 4 : 2, larg = Math.round(p.d.x);
      if (!p.revestimento) return falha(`${classe} não é revestimento de parede`);
      if ((ate - de) % larg) return falha(`revestimento ${classe} (${larg} ladrilhos) não fecha o trecho ${de}–${ate}`);
      const alt = Math.round((niveis.get(nivel).base + altura) * 1000) / 1000;
      const topo = alt + alturaNaParede(classe, dir, estado);
      if (topo > topoParede + 0.05) return falha(`revestimento ${classe} na altura ${alt} passa do topo da parede (${topoParede})`);
      for (const r of revestidos) if (r.lado === lado && de < r.ate && ate > r.de && alt < r.topo - 0.05 && topo > r.alt + 0.05) return falha(`revestimento ${classe} em cima de ${r.classe} na parede`);
      revestidos.push({ lado, de, ate, alt, topo, classe });
      for (let t = de; t < ate; t += larg) moveis.push([classe, lado === "fundo" ? t : 0, lado === "fundo" ? 0 : t, dir, estado, alt]);
    },
    // Itens de parede ao longo de um trecho, com o espaço medido pela arte e
    // folga igual entre eles. lado "fundo" (y = 0) ou "esquerda" (x = 0);
    // de/ate em ladrilhos ao longo da parede; altura em níveis acima do piso
    // do nível dado; cada item pode ser classe ou { classe, estado, altura }.
    parede(lado, { de, ate, altura = 1.4, nivel = 0 }, itens) {
      const dir = lado === "fundo" ? 4 : 2, base = niveis.get(nivel).base;
      const lista = itens.map((i) => (typeof i === "string" ? { classe: i } : i)).map((i) => ({ ...i, s: silhueta(i.classe, dir, i.estado || 0) }));
      for (const i of lista) if (peca(i.classe).revestimento) return falha(`${i.classe} é revestimento: use revestir()`);
      if (lista.some((i) => !i.s)) return falha(`parede ${lado}: sem arte para ${lista.filter((i) => !i.s).map((i) => i.classe)}`);
      const larg = lista.reduce((a, i) => a + i.s.w, 0), trecho = (ate - de) * 32;
      if (larg > trecho) return falha(`parede ${lado} ${de}–${ate}: ${lista.map((i) => i.classe).join(", ")} não cabem (${larg} px em ${trecho} px)`);
      const folga = (trecho - larg) / (lista.length + 1);
      let px = folga;
      for (const i of lista) {
        // Borda esquerda na tela → posição ao longo da parede (mesma conta do
        // mapa: fundo, sx = (x + 0,5)·32 + s.x; esquerda, sx = (−y − 0,5)·32 + s.x).
        const t = lado === "fundo" ? de + (px - i.s.x) / 32 - 0.5 : (ate - (px + i.s.w) / 32) + (i.s.x + i.s.w) / 32 - 0.5;
        // Posição na parede em pixels do Habbo (LegacyWallGeometry): 1/32 de
        // ladrilho ao longo da parede e 1/32 de nível na altura.
        const pos = Math.round(t * 32) / 32, alt = Math.round((base + (i.altura ?? altura)) * 32) / 32;
        const a = lado === "fundo" ? de * 32 + px : (ate * 32 - px - i.s.w), b = a + i.s.w;
        const y0 = -alt * 32 + i.s.y, y1 = y0 + i.s.h;
        if (alt + alturaNaParede(i.classe, dir, i.estado || 0) > topoParede + 0.05) falha(`${i.classe} na altura ${alt} passa do topo da parede (${topoParede})`);
        for (const q of paredes) if (q.lado === lado && a < q.b && b > q.a && y0 < q.y1 && y1 > q.y0) falha(`${i.classe} tapa ${q.nome} na parede`);
        paredes.push({ lado, a, b, y0, y1, nome: i.classe, classe: i.classe, x: lado === "fundo" ? pos : 0, y: lado === "fundo" ? 0 : pos, dir, estado: i.estado || 0, altura: alt });
        moveis.push([i.classe, lado === "fundo" ? pos : 0, lado === "fundo" ? 0 : pos, dir, i.estado || 0, alt]);
        px += i.s.w + folga;
      }
    },
    // Figurante: de pé num ladrilho livre ou sentado num assento já posto.
    figurante({ figura, x, y, dir = 4, sentado }) {
      if (sentado) {
        if (!sentado.senta) return falha(`figurante em ${sentado.nome}, que não é assento`);
        figurantes.push({ figura, x: sentado.x, y: sentado.y, dir: sentado.dir, acao: "sit" });
        return;
      }
      if (at(x, y, 0).solido) return falha(`figurante de pé em ${x},${y}, em cima de ${at(x, y, 0).solido.nome}`);
      figurantes.push({ figura, x, y, dir });
    },
    // Confere o que só dá para ver com tudo posto: item de parede atrás de
    // móvel alto encostado e fio de lâmpada cruzando item de parede perto.
    // Escada de construtor: degraus empilhados, um ladrilho por degrau,
    // subindo na direção dada ([dx, dy]) até a altura do nível de cima (o
    // mezanino ou o patamar da planta). Cada degrau é a mesma peça repetida
    // na pilha até a altura dele, como os construtores fazem no Habbo.
    escada(classe, x, y, para, { ate, dir } = {}) {
      const p = peca(classe);
      if (!p.pisa) return falha(`escada ${classe} não é pisável na ficha do Habbo`);
      const hd = p.topo || 0.5, alvo = ate ?? niveis.get(1)?.base ?? 1;
      const n = Math.max(1, Math.round(alvo / hd));
      if (Math.abs(n * hd - alvo) > 0.35) return falha(`escada ${classe} (degrau ${hd}) não chega a ${alvo}: ficaria em ${Math.round(n * hd * 100) / 100}`);
      const d = dir ?? dirPara(p, -para[0], -para[1]);
      const [ew, eh] = pegada(p, d);
      // Escada é onde dá escada (Paulo, 18/10/2026): o último degrau chega
      // no andar de cima, num ladrilho livre (no vão do guarda-corpo, se for
      // mezanino); o pé tem chão livre no mesmo nível; os lados ficam livres
      // (nada encostado escondendo a escada nem sendo escondido por ela).
      const largura = para[0] ? eh : ew, passo = para[0] ? ew : eh;
      if (passo !== 1) return falha(`escada ${classe} tem degrau de ${passo} ladrilhos na direção da subida`);
      const ao = (i, l) => (para[0] ? [x + para[0] * i, y + l] : [x + l, y + para[1] * i]);
      const m = niveis.get(1), dentro = (tx, ty) => tx >= 0 && ty >= 0 && tx < w && ty < h && (celdas?.[ty]?.[tx] ?? 0) !== -1;
      for (let l = 0; l < largura; l++) {
        const [cx, cy] = ao(n, l), [px, py] = ao(-1, l);
        if (ate == null && m) {
          if (!(cx >= m.x0 && cx < m.x1 && cy >= m.y0 && cy < m.y1)) return falha(`escada ${classe} em ${x},${y} não chega no mezanino: o degrau de cima dá em ${cx},${cy}`);
          if (m.abertura && !(cx >= m.abertura[0] && cx < m.abertura[1])) return falha(`escada ${classe} chega no mezanino fora do vão do guarda-corpo (${cx},${cy})`);
          if (at(cx, cy, 1).solido) return falha(`a chegada da escada em ${cx},${cy} está ocupada por ${at(cx, cy, 1).solido.nome}`);
          at(cx, cy, 1).reservado = "ladrilho de chegada da escada";
        } else if (!m || ate != null) {
          if (!dentro(cx, cy) || Math.abs(nivelPlanta(cx, cy) - alvo) > 0.35) return falha(`escada ${classe} em ${x},${y} não chega no nível ${alvo}: o degrau de cima dá em ${cx},${cy}`);
          if (at(cx, cy, 0).solido) return falha(`a chegada da escada em ${cx},${cy} está ocupada por ${at(cx, cy, 0).solido.nome}`);
          at(cx, cy, 0).reservado = "ladrilho de chegada da escada";
        }
        if (!dentro(px, py) || nivelPlanta(px, py) !== nivelPlanta(x, y)) return falha(`escada ${classe} em ${x},${y} sem chão livre no pé (${px},${py})`);
        if (at(px, py, 0).solido) return falha(`o pé da escada em ${px},${py} está ocupado por ${at(px, py, 0).solido.nome}`);
        at(px, py, 0).reservado = "pé da escada";
      }
      for (let i = -1; i < n; i++) for (const l of [-1, largura]) {
        const [sx, sy] = ao(i, l);
        if (!dentro(sx, sy) || nivelPlanta(sx, sy) !== nivelPlanta(x, y)) continue;
        if (m && sx >= m.x0 && sx < m.x1 && sy >= m.y0 && sy < m.y1) continue;
        if (at(sx, sy, 0).solido) return falha(`${at(sx, sy, 0).solido.nome} encostado na lateral da escada: o lado da escada fica livre`);
        at(sx, sy, 0).reservado = "lado da escada";
      }
      for (let i = 0; i < n; i++) {
        const [tx, ty] = ao(i, 0);
        for (let k = 0; k <= i; k++) {
          if (k === 0) api.por(classe, tx, ty, { dir: d, degrau: true });
          else api.por(classe, tx, ty, { dir: d, sobre: true, empilhador: true });
        }
      }
      escadas.push({ classe, x, y, para, n });
    },
    fechar() {
      // Acabamento (padrão do Café, decisão do Paulo em 18/10/2026): casca
      // com cornija, luz da sala e pontos de luz, detalhe mínimo, parede sem
      // trecho vazio longo e, com mais de um nível, escada e piso diferente.
      // ACABAMENTO=0 só para ferramenta de tentativa (a geração normal cobra sempre).
      if (o.acabamento !== false && process.env.ACABAMENTO !== "0") {
        const area = (() => { let n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((celdas?.[y]?.[x] ?? 0) !== -1) n++; return n; })();
        if (!cascaFeita) falha("sem casca: falta a cornija no topo das paredes");
        if (!a?.luz) falha("sem luz definida na sala (luz no planta)");
        const LUZ = /lamp|light|lantern|candle|chandelier|fireplace|firepit|neon|torch|walllamp/;
        const conta = moveis.filter((m) => { if (daCasca.has(m)) return false; const p = peca(m[0]); return !p.revestimento && !(p.plana && !LUZ.test(m[0]) && (p.d.z ?? 0) <= 0.11 && !p.parede && silhueta(m[0], m[3], m[4]) && (16 - (silhueta(m[0], m[3], m[4]).y + silhueta(m[0], m[3], m[4]).h)) / 32 < 1); });
        const luzes = conta.filter((m) => LUZ.test(m[0])).length;
        if (luzes < Math.ceil(area / 24)) falha(`pouca luz: ${luzes} pontos de luz para ${area} ladrilhos (o Café tem 1 a cada 24)`);
        // Enfeite solto (jarro, vaso, planta pequena no chão, fora de mesa,
        // parede ou conjunto) não é riqueza: conta até 1 a cada 15 ladrilhos
        // e passar de 1 a cada 10 é sala embolada ("deixar a sala rica não é
        // sair empurrando jarro solto", Paulo, 18/10/2026).
        const solto = (m) => { const p = peca(m[0]); return !p.parede && !p.senta && !p.poe && !LUZ.test(m[0]) && !(m[5] > 0.05) && pegada(p, m[3])[0] * pegada(p, m[3])[1] === 1 && (p.topo ?? 1) <= 2.2 && m[1] !== 0 && m[2] !== 0; };
        const soltos = conta.filter(solto).length, riqueza = conta.length - soltos + Math.min(soltos, Math.floor(area / 15));
        if (soltos > area / 10) falha(`enfeite solto demais: ${soltos} jarros, vasos ou plantas soltos no chão (máximo ${Math.floor(area / 10)}); faça conjuntos`);
        if (riqueza < area * 0.45) falha(`sala pobre: ${riqueza} peças de detalhe para ${area} ladrilhos (mínimo ${Math.ceil(area * 0.45)}, o padrão do Café; enfeite solto conta pouco)`);
        const niveisPlanta = new Set((celdas || []).flat().filter((c) => c !== -1).map(Number));
        // Sobe-se por escada; porta-teleporte só onde o Paulo aprovou assim (Café).
        if ((niveis.has(1) || niveisPlanta.size > 1) && !escadas.length && !o.subidaPorTeleporte) falha("tem mais de um nível e nenhuma escada para subir");
        const pisoPorNivel = new Map();
        for (const k of pisos) { const [c, e, n] = k.split("|"); if (!pisoPorNivel.has(n)) pisoPorNivel.set(n, new Set()); pisoPorNivel.get(n).add(`${c}|${e}`); }
        const nivs = [...pisoPorNivel.keys()];
        for (let i = 0; i < nivs.length; i++) for (let j = i + 1; j < nivs.length; j++) {
          const A = pisoPorNivel.get(nivs[i]), B = pisoPorNivel.get(nivs[j]);
          if ([...A].some((k) => B.has(k))) falha(`o piso do nível ${nivs[i]} é igual ao do nível ${nivs[j]}: os andares parecem um só`);
        }
        // Parede sem trecho vazio de mais de 4 ladrilhos (item de parede,
        // revestimento ou móvel encostado contam).
        for (const lado of ["fundo", "esquerda"]) {
          const L = lado === "fundo" ? w : h, coberto = new Array(L).fill(false);
          const marca = (i0, i1) => { for (let i = Math.max(0, Math.floor(i0)); i < Math.min(L, Math.ceil(i1)); i++) coberto[i] = true; };
          for (const q of paredes) if (q.lado === lado) marca(lado === "fundo" ? q.a / 32 : (L * 32 - q.b) / 32 - 0, lado === "fundo" ? q.b / 32 : (L * 32 - q.a) / 32);
          for (const r of revestidos) if (r.lado === lado) marca(r.de, r.ate);
          for (const { it } of altos) if (lado === "fundo" ? it.y === 0 : it.x === 0) marca(lado === "fundo" ? it.x : it.y, lado === "fundo" ? it.x + it.pw : it.y + it.ph);
          for (let i = 0, vazio = 0; i <= L; i++) {
            if (i < L && !coberto[i] && (celdas?.[lado === "fundo" ? 0 : i]?.[lado === "fundo" ? i : 0] ?? 0) !== -1) vazio++;
            else { if (vazio > 4) falha(`parede ${lado === "fundo" ? "do fundo" : "da esquerda"} vazia num trecho de ${vazio} ladrilhos (até ${i})`); vazio = 0; }
          }
        }
      }
      // Criado-mudo (mesinha de canto) atrás do encosto de um assento: fica
      // escondido e o conjunto sai do esquadro. Vai ao lado do assento.
      const CRIADO = /sidetable|endtable|nightstand/;
      for (const c of postos) if (CRIADO.test(c.classe)) for (const a of postos) {
        if (!a.senta || !a.frente || a.n !== c.n) continue;
        const bx = a.x - a.frente[0], by = a.y - a.frente[1];
        const cobre = (px, py, it) => px >= it.x && px < it.x + it.pw && py >= it.y && py < it.y + it.ph;
        let atras = false;
        for (let i = 0; i < a.pw; i++) for (let j = 0; j < a.ph; j++) {
          const px = a.frente[0] ? (a.frente[0] > 0 ? a.x - 1 : a.x + a.pw) : a.x + i, py = a.frente[1] ? (a.frente[1] > 0 ? a.y - 1 : a.y + a.ph) : a.y + j;
          if (cobre(px, py, c)) atras = true;
        }
        void bx; void by;
        if (atras) falha(`criado-mudo ${c.nome} atrás do encosto de ${a.nome}: fica escondido; ponha ao lado`);
      }
      // Tapete no esquadro: móvel inteiro em cima do tapete ou inteiro fora
      // (metade dentro deixa o conjunto torto).
      for (const t of postos) if (t.tapete) for (const it of postos) {
        if (it.tapete || it.n !== t.n || peca(it.classe).plana) continue;
        let k = 0;
        for (let i = 0; i < it.pw; i++) for (let j = 0; j < it.ph; j++) if (it.x + i >= t.x && it.x + i < t.x + t.pw && it.y + j >= t.y && it.y + j < t.y + t.ph) k++;
        if (k && k < it.pw * it.ph) falha(`${it.nome} metade em cima do tapete ${t.nome}: o conjunto fica torto`);
      }
      // Parede rica (Paulo, 18/10/2026: "o acabamento e detalhes podem partir
      // pra parede também"): cada parede com pelo menos um item a cada 3
      // ladrilhos, de 3 tipos ou mais, e 60% do comprimento ocupado por item,
      // revestimento ou móvel encostado.
      if (o.acabamento !== false && process.env.ACABAMENTO !== "0") for (const lado of ["fundo", "esquerda"]) {
        const L = (() => { let n = 0; const T = lado === "fundo" ? w : h; for (let i = 0; i < T; i++) if ((celdas?.[lado === "fundo" ? 0 : i]?.[lado === "fundo" ? i : 0] ?? 0) !== -1) n++; return n; })();
        // Peça larga conta pelo tamanho: um item a cada 2 ladrilhos de largura
        // (a lousa de 4 ladrilhos vale 2 quadros).
        const deParede = [...paredes.filter((q) => q.lado === lado).map((q) => ({ classe: q.classe, larg: (q.b - q.a) / 32 })),
          ...altos.filter((a) => a.decor && (lado === "fundo" ? a.it.y === 0 : a.it.x === 0)).map((a) => ({ classe: a.it.classe, larg: 1 }))];
        const nomes = deParede.map((q) => q.classe), pontos = deParede.reduce((t, q) => t + Math.max(1, Math.round(q.larg / 2)), 0);
        const ocupa = new Array(lado === "fundo" ? w : h).fill(false);
        const marca = (i0, i1) => { for (let i = Math.max(0, Math.floor(i0)); i < Math.min(ocupa.length, Math.ceil(i1)); i++) ocupa[i] = true; };
        for (const q of paredes) if (q.lado === lado) marca(lado === "fundo" ? q.a / 32 : (ocupa.length * 32 - q.b) / 32, lado === "fundo" ? q.b / 32 : (ocupa.length * 32 - q.a) / 32);
        for (const r of revestidos) if (r.lado === lado) marca(r.de, r.ate);
        for (const { it } of altos) if (lado === "fundo" ? it.y === 0 : it.x === 0) marca(lado === "fundo" ? it.x : it.y, lado === "fundo" ? it.x + it.pw : it.y + it.ph);
        const ocupado = ocupa.filter(Boolean).length, tipos = new Set(nomes).size, nomeL = lado === "fundo" ? "do fundo" : "da esquerda";
        if (pontos < Math.ceil(L / 3)) falha(`parede ${nomeL} pobre: ${nomes.length} itens de parede (valem ${pontos}) em ${L} ladrilhos (mínimo ${Math.ceil(L / 3)})`);
        if (L >= 6 && tipos < 3) falha(`parede ${nomeL} repetitiva: ${tipos} tipos de item (mínimo 3)`);
        if (ocupado < L * 0.6) falha(`parede ${nomeL} vazia: ${ocupado} de ${L} ladrilhos com algo (mínimo ${Math.ceil(L * 0.6)})`);
      }
      const naTela = (q) => {
        const sq = silhueta(q.classe, q.dir, q.estado);
        const [ax, ay] = q.dir === 2 ? [q.x, q.y + 0.5] : [q.x + 0.5, q.y];
        return { s: sq, sx: (ax - ay) * 32 + sq.x, sy: (ax + ay) * 16 + sq.y - 46 - q.altura * 32 };
      };
      for (const q of paredes) for (const { it } of altos) {
        if (!(q.lado === "fundo" ? it.y === 0 : it.x === 0)) continue;
        const s = silhueta(it.classe, it.dir, it.estado);
        if (!s) continue;
        const B = { s, sx: (it.x - it.y) * 32 + s.x, sy: (it.x + it.y) * 16 + s.y + 16 - it.altura * 32 };
        if (emComum(naTela(q), B) > 40) falha(`${q.classe} fica atrás de ${it.nome} na parede`);
      }
      for (const l of api._lampadas) {
        const sl = silhueta(l.classe, l.dir, l.estado, true);
        if (!sl) continue;
        for (const q of paredes) {
          const perto = q.lado === "fundo" ? l.y <= 4 : l.x <= 4;
          if (!perto) continue;
          const A = naTela(q);
          const alt = l.alt;
          const B = { s: sl, sx: (l.x - l.y) * 32 + sl.x, sy: (l.x + l.y) * 16 + sl.y + 16 - alt * 32 };
          if (emComum(A, B) > 40) falha(`${nome(l.classe, l.x, l.y)} pendurada cruza ${q.classe} na parede`);
        }
      }
      return { moveis, figurantes, erros };
    },
  };
  return api;
}

