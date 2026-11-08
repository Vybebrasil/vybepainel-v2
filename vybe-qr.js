// Gerador de QR Code próprio (sem pacote externo), modo byte (UTF-8), versões 1 a 10, correção L/M/Q/H.
// Segue a norma ISO/IEC 18004; os testes conferem módulo por módulo contra o gerador que já vem no bot.
// API: window.VybeQR.matriz(texto, { ecc: 'M', mascara }) → { versao, tamanho, mascara, modulos: boolean[][] }
//      window.VybeQR.svg(texto, { ecc, margem, cor, fundo }) → string <svg>
(function (raiz) {
  'use strict';
  // Tabela de blocos por versão: [L, M, Q, H], cada um [quantidade, total, dados, (quantidade, total, dados)?]
  const BLOCOS = [
    null,
    [[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9]],
    [[1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16]],
    [[1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13]],
    [[1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9]],
    [[1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12]],
    [[2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15]],
    [[2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14]],
    [[2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15]],
    [[2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13]],
    [[2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]],
  ];
  const ALINHAMENTO = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const NIVEL = { L: 0, M: 1, Q: 2, H: 3 };
  const BITS_NIVEL = { L: 1, M: 0, Q: 3, H: 2 };

  // Corpo finito GF(256), polinômio primitivo 0x11d.
  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mult = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  function gerador(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const p = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { p[j] ^= g[j]; p[j + 1] ^= mult(g[j], EXP[i]); }
      g = p;
    }
    return g;
  }
  function correcao(dados, n) {
    const g = gerador(n), r = dados.concat(new Array(n).fill(0));
    for (let i = 0; i < dados.length; i++) {
      const c = r[i]; if (!c) continue;
      for (let j = 0; j < g.length; j++) r[i + j] ^= mult(g[j], c);
    }
    return r.slice(dados.length);
  }
  function blocos(versao, ecc) {
    const t = BLOCOS[versao][NIVEL[ecc]], out = [];
    for (let i = 0; i < t.length; i += 3) for (let k = 0; k < t[i]; k++) out.push({ total: t[i + 1], dados: t[i + 2] });
    return out;
  }
  const bytesUtf8 = (s) => (typeof TextEncoder !== 'undefined' ? Array.from(new TextEncoder().encode(String(s))) : Array.from(unescape(encodeURIComponent(String(s))), (c) => c.charCodeAt(0)));

  function palavras(bytes, versao, ecc) {
    const bl = blocos(versao, ecc), capacidade = bl.reduce((s, b) => s + b.dados, 0);
    const bits = [];
    const por = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    por(4, 4); por(bytes.length, versao < 10 ? 8 : 16);
    for (const b of bytes) por(b, 8);
    if (bits.length > capacidade * 8) return null;
    for (let i = 0; i < 4 && bits.length < capacidade * 8; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const dados = [];
    for (let i = 0; i < bits.length; i += 8) dados.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    for (let p = 0; dados.length < capacidade; p++) dados.push(p % 2 ? 0x11 : 0xec);
    // Divide em blocos, calcula a correção e intercala.
    const partes = []; let pos = 0;
    for (const b of bl) { const d = dados.slice(pos, pos + b.dados); pos += b.dados; partes.push({ d, e: correcao(d, b.total - b.dados) }); }
    const saida = [], maxD = Math.max(...partes.map((x) => x.d.length)), maxE = Math.max(...partes.map((x) => x.e.length));
    for (let i = 0; i < maxD; i++) for (const x of partes) if (i < x.d.length) saida.push(x.d[i]);
    for (let i = 0; i < maxE; i++) for (const x of partes) if (i < x.e.length) saida.push(x.e[i]);
    return saida;
  }

  const bch = (dado, g, grau) => {
    let r = dado << grau;
    const topo = (v) => 31 - Math.clz32(v);
    while (r && topo(r) >= grau) r ^= g << (topo(r) - grau);
    return (dado << grau) | r;
  };
  const MASCARAS = [
    (i, j) => (i + j) % 2 === 0, (i) => i % 2 === 0, (i, j) => j % 3 === 0, (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0, (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0, (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0,
  ];

  function montar(versao, ecc, cods, mascara) {
    const n = versao * 4 + 17, m = Array.from({ length: n }, () => new Array(n).fill(null));
    const localizador = (r0, c0) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const y = r0 + r, x = c0 + c; if (y < 0 || x < 0 || y >= n || x >= n) continue;
        m[y][x] = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      }
    };
    localizador(0, 0); localizador(n - 7, 0); localizador(0, n - 7);
    const al = ALINHAMENTO[versao];
    for (const y of al) for (const x of al) {
      if (m[y][x] !== null) continue;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) m[y + r][x + c] = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
    }
    for (let i = 8; i < n - 8; i++) { if (m[i][6] === null) m[i][6] = i % 2 === 0; if (m[6][i] === null) m[6][i] = i % 2 === 0; }
    // Informação de formato.
    const fmt = bch((BITS_NIVEL[ecc] << 3) | mascara, 0x537, 10) ^ 0x5412;
    for (let i = 0; i < 15; i++) {
      const b = ((fmt >> i) & 1) === 1;
      if (i < 6) m[i][8] = b; else if (i < 8) m[i + 1][8] = b; else m[n - 15 + i][8] = b;
      if (i < 8) m[8][n - i - 1] = b; else if (i < 9) m[8][15 - i] = b; else m[8][15 - i - 1] = b;
    }
    m[n - 8][8] = true;
    if (versao >= 7) {
      const vi = bch(versao, 0x1f25, 12);
      for (let i = 0; i < 18; i++) { const b = ((vi >> i) & 1) === 1; m[Math.floor(i / 3)][(i % 3) + n - 11] = b; m[(i % 3) + n - 11][Math.floor(i / 3)] = b; }
    }
    // Dados em zigue-zague, de baixo para cima, pulando a coluna do relógio.
    let dir = -1, row = n - 1, bit = 7, byte = 0;
    const msk = MASCARAS[mascara];
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (;;) {
        for (let c = 0; c < 2; c++) {
          if (m[row][col - c] !== null) continue;
          let escuro = byte < cods.length && ((cods[byte] >>> bit) & 1) === 1;
          if (msk(row, col - c)) escuro = !escuro;
          m[row][col - c] = escuro;
          if (--bit === -1) { byte++; bit = 7; }
        }
        row += dir;
        if (row < 0 || row >= n) { row -= dir; dir = -dir; break; }
      }
    }
    return m;
  }

  // Penalidade da norma para escolher a máscara mais legível.
  function penalidade(m) {
    const n = m.length; let p = 0;
    for (let k = 0; k < 2; k++) for (let i = 0; i < n; i++) {
      let corrida = 1;
      for (let j = 1; j < n; j++) {
        const a = k ? m[j][i] : m[i][j], b = k ? m[j - 1][i] : m[i][j - 1];
        if (a === b) corrida++; else { if (corrida >= 5) p += corrida - 2; corrida = 1; }
      }
      if (corrida >= 5) p += corrida - 2;
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const v = m[i][j]; if (v === m[i + 1][j] && v === m[i][j + 1] && v === m[i + 1][j + 1]) p += 3; }
    const padrao = [true, false, true, true, true, false, true];
    for (let i = 0; i < n; i++) for (let j = 0; j + 7 <= n; j++) for (const k of [0, 1]) {
      let igual = true;
      for (let t = 0; t < 7 && igual; t++) igual = (k ? m[j + t][i] : m[i][j + t]) === padrao[t];
      if (!igual) continue;
      const claro = (a, b) => { for (let t = a; t < b; t++) { if (t < 0 || t >= n) continue; if (k ? m[t][i] : m[i][t]) return false; } return true; };
      if (claro(j - 4, j) || claro(j + 7, j + 11)) p += 40;
    }
    let escuros = 0; for (const l of m) for (const v of l) if (v) escuros++;
    p += Math.floor(Math.abs((escuros * 100) / (n * n) - 50) / 5) * 10;
    return p;
  }

  function matriz(texto, { ecc = 'M', mascara } = {}) {
    if (!(ecc in NIVEL)) throw new Error('Nível de correção inválido.');
    const bytes = bytesUtf8(texto);
    let versao = 0, cods = null;
    for (let v = 1; v <= 10 && !cods; v++) { cods = palavras(bytes, v, ecc); versao = v; }
    if (!cods) throw new Error('Texto longo demais para o QR Code (encurte o link).');
    let melhor = null;
    for (const k of mascara == null ? [0, 1, 2, 3, 4, 5, 6, 7] : [mascara]) {
      const mm = montar(versao, ecc, cods, k), p = mascara == null ? penalidade(mm) : 0;
      if (!melhor || p < melhor.p) melhor = { mm, p, k };
    }
    return { versao, tamanho: melhor.mm.length, mascara: melhor.k, modulos: melhor.mm };
  }

  function svg(texto, { ecc = 'M', margem = 4, cor = '#1F1D1A', fundo = '#FFFFFF' } = {}) {
    const q = matriz(texto, { ecc }), t = q.tamanho + margem * 2;
    let d = '';
    q.modulos.forEach((linha, y) => linha.forEach((v, x) => { if (v) d += `M${x + margem} ${y + margem}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="${t}" height="${t}" fill="${fundo}"/><path d="${d}" fill="${cor}"/></svg>`;
  }

  const api = { matriz, svg, _montar: montar, _palavras: palavras };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (raiz) raiz.VybeQR = api;
})(typeof window !== 'undefined' ? window : null);
