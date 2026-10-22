// Gera as plantas dos quartos (formato × tamanho) no catálogo único
// assets/escritorio/habbo/quartos.json. As seis plantas da primeira versão
// continuam lá como "legado" (quartos já configurados seguem válidos), mas
// não aparecem mais para escolher.
// node scripts/quartos-plantas.mjs
//
// Regras de cada planta gerada (conferidas nos testes):
// - celdas[y][x]: -1 fora do quarto, 0 piso, 1 escada, 2 mezanino;
// - a última linha e a última coluna são piso (as portas ficam nelas);
// - o canto de baixo à direita (4 × 4) é sempre piso: é onde os modelos
//   iniciais ("Essencial", "Boas conversas") ficam, deslocados por
//   "deslocamento" (feitos para 8 × 8);
// - "portas": onde fica o vão de 2 ladrilhos de cada lado possível;
// - "escada": ladrilhos que ficam livres para circular entre os patamares.
import { readFile, writeFile } from "node:fs/promises";

const ARQUIVO = "assets/escritorio/habbo/quartos.json";
// Gigante, Colossal e Mansão desde 21/10/2026 (Paulo: "até 4x maior o maior
// de hoje"): a Mansão quadrada tem 24 × 24, quatro vezes o Enorme de 12 × 12.
const TAMANHOS = { P: "Pequeno", M: "Médio", G: "Grande", GG: "Enorme", XG: "Gigante", XXG: "Colossal", MAX: "Mansão" };
const GRANDES = { XG: [16, 16], XXG: [20, 20], MAX: [24, 24] };
const GRANDES_LARGO = { XG: [16, 12], XXG: [20, 14], MAX: [24, 18] };
const GRANDES_FUNDO = { XG: [12, 16], XXG: [14, 20], MAX: [18, 24] };
const vazio = (w, h, v = 0) => Array.from({ length: h }, () => Array(w).fill(v));

// Plantas em blocos de 2 × 2 (Paulo, 22/10/2026: "se todos os pisos colocáveis
// são 2x2, não tem sentido nenhum quarto terminar com parte ímpar"): medidas,
// cortes, braços e mezanino sempre em números pares, para as peças de piso
// fecharem certinho. Mezanino na altura 3 com escada de dois degraus (2 de
// largura, alturas 2 e 1): cada degrau tem um lado baixo e um alto, e o
// guarda-corpo (queda de 2 ou mais) sai na borda inteira e nas laterais da
// escada, aberto só na boca dela.
const par = (n, min = 2) => Math.max(min, 2 * Math.round(n / 2));
const MEZANINO = 3;
// Escada de 2 × 2 encostada no mezanino: "de" é o ladrilho do degrau alto e
// (dx, dy) aponta para o chão.
function escada(c, x, y, dx, dy) {
  for (let k = 0; k < 2; k++) {
    const ox = dx ? 0 : k, oy = dy ? 0 : k;
    c[y + oy][x + ox] = MEZANINO - 1;
    c[y + oy + dy][x + ox + dx] = MEZANINO - 2;
  }
}
const FORMATOS = [
  { id: "quadrado", nome: "Quadrado", dica: "Simples e fácil de organizar", medidas: { P: [6, 6], M: [8, 8], G: [10, 10], GG: [12, 12], ...GRANDES }, celdas: (w, h) => vazio(w, h) },
  { id: "largo", nome: "Largo", dica: "Mais frente, para receber", medidas: { P: [8, 6], M: [10, 8], G: [12, 8], GG: [12, 10], ...GRANDES_LARGO }, celdas: (w, h) => vazio(w, h) },
  { id: "fundo", nome: "Profundo", dica: "Mais fundo, para trabalhar", medidas: { P: [6, 8], M: [8, 10], G: [8, 12], GG: [10, 12], ...GRANDES_FUNDO }, celdas: (w, h) => vazio(w, h) },
  {
    id: "ele", nome: "Em L", dica: "Dois cantos que se encontram", medidas: { M: [8, 8], G: [10, 10], GG: [12, 12], ...GRANDES },
    celdas: (w, h) => { const c = vazio(w, h), a = par(w * 0.4), b = par(h * 0.4); for (let y = 0; y < b; y++) for (let x = 0; x < a; x++) c[y][x] = -1; return c; },
  },
  {
    id: "u", nome: "Em U", dica: "Um recorte no fundo, dois braços", medidas: { M: [8, 8], G: [10, 10], GG: [12, 12], ...GRANDES },
    celdas: (w, h) => {
      const c = vazio(w, h), m = par(w * 0.3), fundo = par(h * 0.3);
      for (let y = 0; y < fundo; y++) for (let x = m; x < w - m; x++) c[y][x] = -1;
      return c;
    },
  },
  {
    id: "chanfrado", nome: "Chanfrado", dica: "Canto do fundo cortado em degraus", medidas: { M: [8, 8], G: [10, 10], GG: [12, 12], ...GRANDES },
    // A diagonal em degraus de 2: cada bloco de 2 × 2 fica inteiro.
    celdas: (w, h) => { const c = vazio(w, h), k = Math.round(w / 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.floor(x / 2) + Math.floor(y / 2) < k) c[y][x] = -1; return c; },
  },
  {
    id: "dividido", nome: "Dois ambientes", dica: "Divisória com passagem: receber e trabalhar", medidas: { G: [10, 8], GG: [12, 10], ...GRANDES_LARGO },
    celdas: (w, h) => vazio(w, h),
    divisorias: (w, h) => { const d = w - 6, g = par(h / 2) - 2; return [[d, 0, d, g], [d, g + 2, d, h]]; },
  },
  {
    id: "niveis", nome: "Com níveis", dica: "Mezanino no fundo e escada", medidas: { G: [10, 10], GG: [12, 12], ...GRANDES },
    celdas: (w, h) => {
      const c = vazio(w, h), fundo = par(h * 0.25, 2), ex = par(w / 2) - 2;
      for (let y = 0; y < fundo; y++) for (let x = 0; x < w; x++) c[y][x] = MEZANINO;
      escada(c, ex, fundo, 0, 1);
      return c;
    },
  },
  {
    id: "galeria", nome: "Galeria em zigue-zague", dica: "Três alas deslocadas, ligadas por uma passagem larga", medidas: { G: [10, 10], GG: [12, 12], MAX: [24, 24] }, aberta: true,
    celdas: (w, h) => {
      const c = vazio(w, h, -1), a = par(w * 0.34, 4), b = par(h * 0.34, 4), corte = w - par(w * 0.5, 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
        if ((x < a && y < h - b) || (y >= b && y < h - b) || (x >= corte && y >= b)) c[y][x] = 0;
      return c;
    },
  },
  {
    id: "alas", nome: "Alas assimétricas", dica: "Uma ala de trabalho, um recuo e um salão lateral", medidas: { G: [10, 10], GG: [12, 12], MAX: [24, 24] }, aberta: true,
    celdas: (w, h) => {
      const c = vazio(w, h, -1), a = par(h * 0.34, 4), r = par(w * 0.3, 4), s = par(w * 0.5, 4), b = par(h * 0.34, 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((y < a && x < w - r) || (y >= 2 && x >= w - s) || (y >= h - b)) c[y][x] = 0;
      return c;
    },
  },
  {
    id: "terracos", nome: "Terraços conectados", dica: "Ala elevada no fundo e duas escadas para o salão", medidas: { G: [10, 10], GG: [12, 12], MAX: [24, 24] }, aberta: true,
    // Sem vão no meio do salão: o vazio entre as escadas aparecia como um
    // poço escuro no piso (Paulo, 22/10/2026: "quartos bugados").
    celdas: (w, h) => {
      const c = vazio(w, h, 0), fundo = par(h * 0.3, 2);
      for (let y = 0; y < fundo; y++) for (let x = 0; x < w; x++) c[y][x] = MEZANINO;
      // Escadas perto das pontas: o meio do mezanino fica inteiro para a
      // mesa. A da esquerda fica a 2 ladrilhos da parede: encostada nela, o
      // perfil dos degraus sumia nos tijolos e a escada parecia torta
      // (Paulo, 22/10/2026); a da direita já mostra o perfil no chão.
      escada(c, 2, fundo, 0, 1); escada(c, w - 2, fundo, 0, 1);
      return c;
    },
  },
  {
    id: "mirante", nome: "Loft com mirante", dica: "Mezanino lateral, escada larga e salão em L", medidas: { G: [10, 10], GG: [12, 12], MAX: [24, 24] }, aberta: true,
    // O vão do fundo, entre o mezanino e o salão, cortava a parede em duas.
    celdas: (w, h) => {
      const c = vazio(w, h, 0), lado = par(w * 0.34, 4), recuo = par(h * 0.3, 4), frente = par(h * 0.34, 4);
      for (let y = 0; y < h - frente; y++) for (let x = 0; x < lado; x++) c[y][x] = MEZANINO;
      escada(c, lado, recuo, 1, 0);
      return c;
    },
  },
];
// Toda linha e coluna: cada trecho do mesmo andar começa em posição par e tem
// tamanho par (a escada fica de fora: ela é a passagem entre os andares).
export function plantaEmBlocos(celdas) {
  const h = celdas.length, w = celdas[0].length, max = Math.max(...celdas.flat());
  const degrau = (n) => n > 0 && n < max;
  const confere = (seq) => { for (let i = 0; i < seq.length;) { let j = i; while (j < seq.length && seq[j] === seq[i]) j++; if (seq[i] >= 0 && !degrau(seq[i]) && (i % 2 || (j - i) % 2)) return false; i = j; } return true; };
  if (w % 2 || h % 2) return false;
  for (let y = 0; y < h; y++) if (!confere(celdas[y])) return false;
  for (let x = 0; x < w; x++) if (!confere(celdas.map((l) => l[x]))) return false;
  return true;
}

// Vão de cada porta: embaixo, no meio da última linha; à direita, nas linhas
// h-5 e h-4 da última coluna (a mesma faixa do 8 × 8 da primeira versão). Ali
// a porta nunca fica atrás da mesa dos modelos iniciais, que ocupa as linhas
// h-4 e h-3 longe da parede da direita.
function portasDe(celdas) {
  const h = celdas.length, w = celdas[0].length;
  const livre = (x,y) => celdas[y]?.[x] === 0;
  const bx = Array.from({length:w-1},(_,x)=>x).filter(x=>livre(x,h-1)&&livre(x+1,h-1));
  const dy = Array.from({length:h-1},(_,y)=>y).filter(y=>livre(w-1,y)&&livre(w-1,y+1));
  return { baixo: bx.includes(Math.floor(w/2)-1) ? Math.floor(w/2)-1 : bx[0], direita: dy.includes(h-5) ? h-5 : dy[0] };
}
// Degraus: os ladrilhos entre o chão e o andar mais alto da planta.
function escadaDe(celdas) {
  const r = [], max = Math.max(...celdas.flat());
  celdas.forEach((linha, y) => linha.forEach((n, x) => { if (n > 0 && n < max) r.push([x, y]); }));
  return r;
}

const catalogo = JSON.parse(await readFile(ARQUIVO, "utf8"));
const legado = catalogo.plantas.filter((p) => !p.formato).map((p) => ({
  ...p, legado: true, portas: p.portas || portasDe(p.celdas), escada: escadaDe(p.celdas), deslocamento: [p.celdas[0].length - 8, p.celdas.length - 8],
}));
// Plantas que já existem no catálogo ficam como estão (algumas foram
// ajustadas à mão depois de geradas e há quartos montados nelas); o script só
// acrescenta as que faltam.
const existentes = new Map(catalogo.plantas.filter((p) => p.formato).map((p) => [p.id, p]));
const novas = [], ocultas = [];
const gerar = (f, tam, w, h, id) => {
  const celdas = f.celdas(w, h);
  const n = celdas.flat().filter((v) => v >= 0).length;
  return {
    id, nome: f.nome, formato: f.id, tamanho: tam, tamanhoNome: TAMANHOS[tam],
    dica: f.dica, medidas: `${w} × ${h} · ${n} ladrilhos`, celdas,
    ...(f.divisorias ? { divisorias: f.divisorias(w, h) } : {}),
    ...(f.aberta ? { bordaAberta: true } : {}),
    portas: portasDe(celdas), escada: escadaDe(celdas), deslocamento: [w - 8, h - 8],
  };
};
for (const f of FORMATOS) for (const [tam, [w, h]] of Object.entries(f.medidas)) {
  const id = `${f.id}-${tam.toLowerCase()}`, antiga = existentes.get(id);
  // Planta já em blocos de 2 × 2: fica como está.
  if (antiga && plantaEmBlocos(antiga.celdas)) { novas.push(antiga); continue; }
  // Planta com trecho ímpar: continua valendo para quem já tem quarto nela,
  // mas sai da escolha ("oculta"); entra a versão em blocos, com outro id.
  if (antiga) ocultas.push({ ...antiga, oculta: true });
  const idPar = antiga ? `${id}-par` : id;
  novas.push(existentes.get(idPar) || gerar(f, tam, w, h, idPar));
}
// Tamanho que saiu de um formato (Com níveis médio: 8 × 8 não cabe mezanino,
// escada de dois degraus e a mesa): fica só para quem já tem quarto nele.
const extras = catalogo.plantas.filter((p) => p.formato && !novas.some((n) => n.id === p.id) && !ocultas.some((o) => o.id === p.id)).map((p) => (plantaEmBlocos(p.celdas) && !p.id.endsWith("-par") ? p : { ...p, oculta: true })).filter((p) => !(p.id.endsWith("-par") && !novas.some((n) => n.id === p.id)));
catalogo.plantas = [...legado, ...novas, ...ocultas, ...extras];
for (const p of novas) if (!plantaEmBlocos(p.celdas)) throw new Error(`${p.id} não fecha em blocos de 2 × 2`);
await writeFile(ARQUIVO, JSON.stringify(catalogo, null, 2) + "\n");
console.log(`Plantas: ${novas.length} para escolher (${FORMATOS.length} formatos), ${ocultas.length} antigas só para quem já tem, ${legado.length} de legado.`);
