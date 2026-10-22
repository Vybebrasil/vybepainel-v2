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

const FORMATOS = [
  { id: "quadrado", nome: "Quadrado", dica: "Simples e fácil de organizar", medidas: { P: [6, 6], M: [8, 8], G: [10, 10], GG: [12, 12], ...GRANDES }, celdas: (w, h) => vazio(w, h) },
  { id: "largo", nome: "Largo", dica: "Mais frente, para receber", medidas: { P: [8, 6], M: [10, 7], G: [12, 8], GG: [12, 10], ...GRANDES_LARGO }, celdas: (w, h) => vazio(w, h) },
  { id: "fundo", nome: "Profundo", dica: "Mais fundo, para trabalhar", medidas: { P: [6, 8], M: [7, 10], G: [8, 12], GG: [10, 12], ...GRANDES_FUNDO }, celdas: (w, h) => vazio(w, h) },
  {
    id: "ele", nome: "Em L", dica: "Dois cantos que se encontram", medidas: { M: [8, 8], G: [10, 10], GG: [12, 12], ...GRANDES },
    celdas: (w, h) => { const c = vazio(w, h), a = Math.round(w * 0.4), b = Math.round(h * 0.4); for (let y = 0; y < b; y++) for (let x = 0; x < a; x++) c[y][x] = -1; return c; },
  },
  {
    id: "u", nome: "Em U", dica: "Um recorte no fundo, dois braços", medidas: { M: [8, 8], G: [10, 10], GG: [12, 12], ...GRANDES },
    celdas: (w, h) => {
      const c = vazio(w, h), m = Math.round(w * 0.35), fundo = { 8: 2, 10: 4, 12: 5 }[h] ?? Math.round(h * 0.42);
      for (let y = 0; y < fundo; y++) for (let x = m; x < w - m; x++) c[y][x] = -1;
      return c;
    },
  },
  {
    id: "chanfrado", nome: "Chanfrado", dica: "Canto do fundo cortado em diagonal", medidas: { M: [8, 8], G: [10, 10], GG: [12, 12], ...GRANDES },
    celdas: (w, h) => { const c = vazio(w, h), k = w / 2; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x + y < k) c[y][x] = -1; return c; },
  },
  {
    id: "dividido", nome: "Dois ambientes", dica: "Divisória com passagem: receber e trabalhar", medidas: { G: [10, 8], GG: [12, 10], ...GRANDES_LARGO },
    celdas: (w, h) => vazio(w, h),
    divisorias: (w, h) => { const d = w - 6, g = Math.floor(h / 2) - 1; return [[d, 0, d, g], [d, g + 2, d, h]]; },
  },
  {
    id: "niveis", nome: "Com níveis", dica: "Mezanino no fundo e escada", medidas: { M: [8, 8], G: [10, 10], GG: [12, 12], ...GRANDES },
    celdas: (w, h) => {
      const c = vazio(w, h), fundo = { 8: 3, 10: 4, 12: 6 }[h] ?? Math.round(h * 0.45), ex = Math.floor(w / 2) - 1;
      for (let y = 0; y < fundo; y++) for (let x = 0; x < w; x++) c[y][x] = 2;
      c[fundo - 1][ex] = 1; c[fundo - 1][ex + 1] = 1;
      return c;
    },
  },
  {
    id: "galeria", nome: "Galeria em zigue-zague", dica: "Três alas deslocadas, ligadas por uma passagem larga", medidas: { G: [10, 10], GG: [12, 12] }, aberta: true,
    celdas: (w, h) => {
      const c = vazio(w, h, -1), corte = w - 6;
      for (let y=0;y<h;y++) for(let x=0;x<w;x++)
        if ((x<4 && y<h-3) || (y>=3 && y<h-3) || (x>=corte && y>=3)) c[y][x]=0;
      return c;
    },
  },
  {
    id: "alas", nome: "Alas assimétricas", dica: "Uma ala de trabalho, um recuo e um salão lateral", medidas: { G: [10, 10], GG: [12, 12] }, aberta: true,
    celdas: (w, h) => {
      const c = vazio(w,h,-1);
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) if((y<4 && x<w-3)||(y>=2 && x>=w-6)||(y>=h-3)) c[y][x]=0;
      return c;
    },
  },
  {
    id: "terracos", nome: "Terraços conectados", dica: "Ala elevada e dois espaços abertos ligados por escada", medidas: { G: [10, 10], GG: [12, 12] }, aberta: true,
    celdas: (w, h) => {
      const c=vazio(w,h,-1);
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
        if(y<3) c[y][x]=2;
        else if(x<4 || x>=w-4 || y>=h-4) c[y][x]=0;
      }
      for(const x of [1,2,w-3,w-2]) c[2][x]=1;
      return c;
    },
  },
  {
    id: "mirante", nome: "Loft com mirante", dica: "Mezanino lateral, escada larga e salão em recuo", medidas: { G: [10, 10], GG: [12, 12] }, aberta: true,
    celdas: (w,h) => {
      const c=vazio(w,h,-1);
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
        if(x<4 && y<h-3) c[y][x]=2;
        else if((y>=3 && y<h-3)||x>=w-4||y>=h-4) c[y][x]=0;
      }
      for(const y of [3,4,5]) c[y][3]=1;
      return c;
    },
  },

];

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
function escadaDe(celdas) {
  const r = [];
  celdas.forEach((linha, y) => linha.forEach((n, x) => { if (n === 1) r.push([x, y]); }));
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
const novas = [];
for (const f of FORMATOS) for (const [tam, [w, h]] of Object.entries(f.medidas)) {
  const id = `${f.id}-${tam.toLowerCase()}`;
  if (existentes.has(id)) { novas.push(existentes.get(id)); continue; }
  const celdas = f.celdas(w, h);
  const n = celdas.flat().filter((v) => v >= 0).length;
  novas.push({
    id, nome: f.nome, formato: f.id, tamanho: tam, tamanhoNome: TAMANHOS[tam],
    dica: f.dica, medidas: `${w} × ${h} · ${n} ladrilhos`, celdas,
    ...(f.divisorias ? { divisorias: f.divisorias(w, h) } : {}),
    ...(f.aberta ? { bordaAberta: true } : {}),
    portas: portasDe(celdas), escada: escadaDe(celdas), deslocamento: [w - 8, h - 8],
  });
}
// Formatos especiais (galeria, alas, terraços, mirante): a Mansão é a planta
// Enorme do catálogo com cada ladrilho virando 2 × 2 (24 × 24), para manter o
// desenho conferido.
for (const f of FORMATOS.filter((f) => f.aberta)) {
  const id = `${f.id}-max`, base = novas.find((p) => p.id === `${f.id}-gg`);
  if (!base || novas.some((p) => p.id === id)) continue;
  const celdas = base.celdas.flatMap((linha) => { const l = linha.flatMap((n) => [n, n]); return [l, [...l]]; });
  // A escada continua com um degrau só: a metade dobrada que não encosta no
  // chão vira patamar.
  const baixo = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => celdas[y + dy]?.[x + dx] === 0);
  const sem = []; celdas.forEach((l, y) => l.forEach((n, x) => { if (n === 1 && !baixo(x, y)) sem.push([x, y]); }));
  for (const [x, y] of sem) celdas[y][x] = 2;
  const w = celdas[0].length, h = celdas.length, n = celdas.flat().filter((v) => v >= 0).length;
  novas.push({ id, nome: f.nome, formato: f.id, tamanho: "MAX", tamanhoNome: TAMANHOS.MAX, dica: base.dica, medidas: `${w} × ${h} · ${n} ladrilhos`, celdas, bordaAberta: true, portas: portasDe(celdas), escada: escadaDe(celdas), deslocamento: [w - 8, h - 8] });
}
const extras = catalogo.plantas.filter((p) => p.formato && !novas.some((n) => n.id === p.id));
catalogo.plantas = [...legado, ...novas, ...extras];
await writeFile(ARQUIVO, JSON.stringify(catalogo, null, 2) + "\n");
console.log(`Plantas: ${novas.length} novas (${FORMATOS.length} formatos) + ${legado.length} de legado.`);
