// Base do CRM de prospecção (1º andar, SDR) a partir da base de CNPJ da região de Irecê.
// Só Irecê, só empresas ativas, só dados da empresa (sem sócios nem vínculos de pessoas).
// Posição pelo ENDEREÇO: acha a rua no mapa (OSM do irece.json), junta os trechos dela numa linha só e anda
// "número" metros desde a ponta mais perto do centro (no Brasil a numeração costuma ser a distância em metros
// do começo da rua); par de um lado, ímpar do outro. Sem número, meio da rua. Sem rua, centro do bairro.
// Locais conferidos à mão (mundo/locais.json, coordenada do Google Maps) valem por cima de tudo, no mundo.
// Uso: node scripts/gera-crm.mjs <base.json> assets/mundo/irece.json assets/mundo/crm-irece.json
import { readFile, writeFile } from 'node:fs/promises';
const [, , arqBase, arqIrece, saida] = process.argv;
const base = JSON.parse(await readFile(arqBase, 'utf8'));
const ir = JSON.parse(await readFile(arqIrece, 'utf8'));
const S = ir.lat1, N = ir.lat0, W = ir.lon0;
const LAT0 = (S + N) / 2, MX = 111320 * Math.cos(LAT0 * Math.PI / 180), MY = 110540, CEL = ir.cel;
const grade = (lon, lat) => [((lon - W) * MX / CEL - ir.w / 2), ((N - lat) * MY / CEL - ir.h / 2)];
const semAc = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\b(rua|r|avenida|av|travessa|tv|trav|praca|pca|alameda|rodovia|ba|br|loteamento|lot|conjunto)\b/g, ' ').replace(/\b(de|da|do|das|dos)\b/g, ' ').replace(/\s+/g, ' ').trim();
// Centro de Irecê (Praça da Prefeitura) em células da grade.
const CENTRO = [ir.w / 2 - 35, ir.h / 2 - 21];
// Junta os trechos de cada rua numa (ou mais) linha contínua.
const porNome = new Map();
for (const r of ir.ruas) if (r.n) { const k = semAc(r.n); if (k.length >= 3) (porNome.get(k) || porNome.set(k, []).get(k)).push(r.p); }
function encadear(trechos) {
  const pts = (p) => { const l = []; for (let i = 0; i < p.length; i += 2) l.push([p[i], p[i + 1]]); return l; };
  const resto = trechos.map(pts), linhas = [];
  const perto = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1.5;
  while (resto.length) {
    let linha = resto.shift(), mudou = true;
    while (mudou) {
      mudou = false;
      for (let i = 0; i < resto.length; i++) {
        const t = resto[i], ini = linha[0], fim = linha[linha.length - 1];
        if (perto(fim, t[0])) linha = linha.concat(t.slice(1));
        else if (perto(fim, t[t.length - 1])) linha = linha.concat(t.slice(0, -1).reverse());
        else if (perto(ini, t[t.length - 1])) linha = t.slice(0, -1).concat(linha);
        else if (perto(ini, t[0])) linha = t.slice(1).reverse().concat(linha);
        else continue;
        resto.splice(i, 1); i--; mudou = true;
      }
    }
    linhas.push(linha);
  }
  return linhas.map((l) => { const d = Math.hypot(l[0][0] - CENTRO[0], l[0][1] - CENTRO[1]), e = Math.hypot(l[l.length - 1][0] - CENTRO[0], l[l.length - 1][1] - CENTRO[1]); return e < d ? l.reverse() : l; });
}
const linhasDe = new Map();
for (const [k, t] of porNome) linhasDe.set(k, encadear(t));
const chaves = [...linhasDe.keys()];
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };
function comprimento(l) { let s = 0; for (let i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; }
function naRua(endereco, cnpj) {
  const [ruaTxt, resto = ''] = String(endereco || '').split(/,(.*)/s);
  const alvo = semAc(ruaTxt); if (alvo.length < 3) return null;
  let linhas = linhasDe.get(alvo);
  if (!linhas) { const k = chaves.find((c) => c.length > 5 && (c.includes(alvo) || alvo.includes(c))); linhas = k && linhasDe.get(k); }
  if (!linhas) return null;
  const num = parseInt((/\d+/.exec(resto) || [])[0], 10);
  // A linha mais longa com esse nome é a principal.
  const l = [...linhas].sort((a, b) => comprimento(b) - comprimento(a))[0];
  const total = comprimento(l);
  let alvoD = Number.isFinite(num) && num > 0 ? num / CEL : total * (.3 + hash(cnpj) * .4);
  if (alvoD > total) alvoD = total - .5;
  let andou = 0;
  for (let i = 1; i < l.length; i++) {
    const [ax, az] = l[i - 1], [bx, bz] = l[i], L = Math.hypot(bx - ax, bz - az);
    if (andou + L >= alvoD || i === l.length - 1) {
      const f = L ? Math.min(1, Math.max(0, (alvoD - andou) / L)) : 0, x = ax + (bx - ax) * f, z = az + (bz - az) * f;
      const lado = Number.isFinite(num) ? (num % 2 ? 1 : -1) : (hash(cnpj + 'l') < .5 ? -1 : 1);
      const nx = -(bz - az) / (L || 1), nz = (bx - ax) / (L || 1);
      return { p: [x - ir.w / 2 + nx * 1.8 * lado, z - ir.h / 2 + nz * 1.8 * lado], numero: Number.isFinite(num) };
    }
    andou += L;
  }
  return null;
}
const C = Object.fromEntries(base.colunasEmpresa.map((c, i) => [c, i]));
const cnaes = new Map(Array.isArray(base.cnaes) ? base.cnaes : Object.entries(base.cnaes));
const ace = new Set((base.associados || []).map((a) => String(a[1])));
const r1 = (v) => Math.round(v * 10) / 10;
let porNumero = 0, porRua = 0, porBairro = 0, porCidade = 0;
const empresas = base.empresas.filter((e) => e[C.municipio] === 'Irecê' && e[C.situacao] === 'Ativa').map((e) => {
  const cnpj = String(e[C.cnpj]), cn = cnaes.get(String(e[C.cnae])) || [];
  const achado = naRua(e[C.endereco], cnpj);
  let p = achado?.p, onde = achado ? (achado.numero ? 'numero' : 'rua') : null;
  if (!p && e[C.lat] != null) {
    const [gx, gz] = grade(e[C.lng], e[C.lat]), raio = e[C.precisao] === 'bairro' ? 9 : 22, a = hash(cnpj) * Math.PI * 2, d = Math.sqrt(hash(cnpj + 'd')) * raio;
    p = [gx + Math.cos(a) * d, gz + Math.sin(a) * d]; onde = e[C.precisao] === 'bairro' ? 'bairro' : 'cidade';
  }
  if (onde === 'numero') porNumero++; else if (onde === 'rua') porRua++; else if (onde === 'bairro') porBairro++; else porCidade++;
  return { cnpj, nome: e[C.fantasia] || e[C.razao], razao: e[C.razao], cnae: cn[1] || '', setor: cn[2] || '', bairro: e[C.bairro] || '', endereco: e[C.endereco] || '',
    porte: e[C.porte] || '', abertura: e[C.abertura] || '', telefone: e[C.telefoneRepetido] ? '' : (e[C.telefone] || ''), email: e[C.emailRepetido] ? '' : (e[C.email] || ''),
    matriz: !!e[C.matriz], ace: ace.has(cnpj), x: p ? r1(p[0]) : null, z: p ? r1(p[1]) : null, onde };
});
await writeFile(saida, JSON.stringify({ fonte: `Base de CNPJ da região de Irecê (competência ${base.competencia}, gerada em ${base.geradoEm}). Só empresas ativas de Irecê, sem dados de sócios. Posição pelo número do endereço na rua do mapa.`, empresas }));
console.log({ total: empresas.length, porNumero, porRua, porBairro, porCidade, ace: empresas.filter((e) => e.ace).length });
