// vybe-relatorio-graficos.js — os gráficos do relatório técnico de cada módulo (VybeRelatorio, vybe-relatorio.js).
//
// Paulo, 26/11/2026: "um botão de gerar um PDF daquele módulo... com informações, dados, gráficos, projeções". Este
// arquivo só desenha: recebe números e devolve uma string <svg>. Não lê DOM, não busca nada na rede e não lê os globais
// do painel; roda igual no navegador (window.VybeRelGraficos) e no node (module.exports), para os testes.
//
// Feito para o papel: traço fino e nítido (vetor), texto em Inter, e cada série tem, além da cor, um traço (linha
// cheia, tracejada, pontilhada…), um marcador (círculo, quadrado, triângulo, losango) e uma hachura por cima da cor,
// para continuar legível impresso em preto e branco.
//
// Cores (Paulo, 26/11/2026: "os PDFs não deviam respeitar as regras de cores do sistema? principalmente dos status"):
// nada de paleta própria. Cada série, fatia ou item pode trazer `cor` (#RRGGBB): o motor (vybe-relatorio.js) põe ali a
// cor do status, da carteira do cliente ou da pessoa. Sem `cor`, vale o padrão v2: a primeira série no destaque
// (--d3-acao) e as outras nos neutros (--d3-fume-*), uma cor de destaque só. Os tokens são os do tema claro, lidos da
// tela na hora de gerar (definirCores); os valores abaixo são o mesmo tema claro, para o node e para quando não der
// para ler.
//
//   desenhar({ tipo, ... })            → o tipo escolhe a função abaixo ('' quando não há o que desenhar)
//   linha({ rotulos, series:[{ nome, valores, tracejada, cor }], formato, meta, altura })
//   area(...)                         → a linha com a área cheia (hachurada) embaixo
//   barras({ rotulos, series, empilhado, formato, altura })
//   rosca({ fatias:[{ rotulo, valor, cor }], centro, sub })
//   cascata({ passos:[{ rotulo, valor, total, cor }], formato })  → de um total a outro, passo a passo
//   heatmap({ linhas:[rótulo], colunas:[rótulo], valores:[[n]], formato, cor, coresLinhas:[cor] })
//   ranking({ itens:[{ rotulo, valor, sub, cor }], formato, max })
// `formato` (opcional) é uma função número → texto. Valores null ficam de fora (buraco na linha, barra ausente).
(function (raiz) {
  'use strict';

  // O tema claro do padrão v2 (padrao-v2/0-d3-base.css, [data-d3-tema="claro"]); os fume-* já misturados no branco.
  const TOKENS = Object.freeze({ tinta: '#1F1D1A', texto2: '#4A463F', apagado: '#6B665E', meta: '#B5AFA5', borda: '#E6E0D6', cartao: '#FFFFFF', folhaLeve: '#F9F8F5',
    acao: '#C2490C', acaoTexto: '#A83D08', pronto: '#11613A', perigo: '#B42318', ajuste: '#7A4A00', ambar: '#8F5600', info: '#1E4A9A', agente: '#6E56CF',
    fumeTexto: '#1F1D1A', fumeTexto2: '#45433F', fumeApagado: '#575553', fumeMeta: '#AFAEAD', cartVinicius: '#9A4A1E', cartEwerton: '#3B5BA9',
    // A paleta da tela do Finanças (--fe-c1…c6, padrao-v2/zz-financas-5telas.css): entrada, saída e cenários de lá.
    feC1: '#2A78D6', feC2: '#1BAF7A', feC3: '#6250D6', feC4: '#EDA100', feC5: '#E87BA4', feC6: '#008300' });
  let T = { ...TOKENS };
  let TINTA = T.tinta, TEXTO2 = T.texto2, APAGADO = T.apagado, GRADE = T.borda, EIXO = T.meta, FUNDO = T.cartao;
  const TRACOS = ['', '6 3', '2 2.5', '9 3 2 3', '4 4', '1.5 3', '12 4', '3 3 1 3'];
  const MARCAS = ['circulo', 'quadrado', 'triangulo', 'losango', 'circulo-vazado', 'quadrado-vazado', 'triangulo', 'losango'];
  const FONTE = "Inter, 'Helvetica Neue', Arial, sans-serif";
  let serial = 0;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
  const ehNum = (n) => typeof n === 'number' && Number.isFinite(n);
  const r1 = (n) => Math.round(n * 10) / 10;
  const numPadrao = (n) => (ehNum(n) ? (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('pt-BR') : String(Math.round(n * 10) / 10).replace('.', ',')) : '');
  const fmt = (f) => (typeof f === 'function' ? (n) => { try { return String(f(n)); } catch { return numPadrao(n); } } : numPadrao);
  const corte = (s, n) => { const t = String(s ?? ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

  // ---------- Cor ----------
  const hex = (c) => { const s = String(c || '').trim(); if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase(); if (/^#[0-9a-f]{3}$/i.test(s)) return `#${s.slice(1).split('').map((x) => x + x).join('')}`.toUpperCase(); return ''; };
  const rgb = (c) => { const h = hex(c); return h ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : null; };
  const paraHex = (l) => `#${l.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  // p da cor a e o resto da b (o color-mix(in srgb, a p%, b) do CSS).
  function misturar(a, b = T.cartao, p = 0.5) { const x = rgb(a), y = rgb(b); if (!x) return hex(b); if (!y) return hex(a); return paraHex(x.map((v, i) => v * p + y[i] * (1 - p))); }
  const lum = (c) => { const x = rgb(c); if (!x) return 1; const [r, g, b] = x.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Texto sobre uma cor: branco ou a tinta, o que tiver mais contraste (o mínimo de leitura é 4,5:1).
  const textoSobre = (fundo) => (contraste('#FFFFFF', fundo) >= contraste(T.tinta, fundo) ? '#FFFFFF' : hex(T.tinta));
  // Troca os tokens (o motor manda os do tema claro lidos da tela). Só aceita #RRGGBB; o resto fica no padrão.
  function definirCores(novos = {}) {
    T = { ...TOKENS };
    for (const [k, v] of Object.entries(novos || {})) if (k in TOKENS && hex(v)) T[k] = hex(v);
    TINTA = T.tinta; TEXTO2 = T.texto2; APAGADO = T.apagado; GRADE = T.borda; EIXO = T.meta; FUNDO = T.cartao;
    return { ...T };
  }
  const cores = () => ({ ...T });
  // Sem cor dada: destaque na primeira série, neutros nas outras.
  const corPadrao = (i) => (i === 0 ? T.acao : [T.fumeTexto2, T.fumeMeta, T.fumeApagado][(i - 1) % 3]);
  const coresDe = (lista) => lista.map((x, i) => hex(x?.cor) || corPadrao(i));

  // A hachura de uma série. Cheia (barra, fatia): a cor da série inteira e o risco por cima, na tinta ou no branco (o que
  // contrasta), meio transparente. Leve (a área embaixo da linha): a cor clara e o risco na própria cor.
  function padrao(pid, c, k, leve = false) {
    const riscoCor = leve ? c : textoSobre(c), op = leve ? '' : ' stroke-opacity=".42"', opc = leve ? '' : ' fill-opacity=".42"';
    const base = leve ? `<rect width="6" height="6" fill="${c}" fill-opacity=".16"/>` : `<rect width="6" height="6" fill="${c}"/>`;
    const risco = [
      '',
      `<path d="M-1 7 7 -1M-1 1 1 -1M5 7 7 5" stroke="${riscoCor}" stroke-width="1.3"${op}/>`,
      `<circle cx="3" cy="3" r="1.2" fill="${riscoCor}"${opc}/>`,
      `<path d="M0 3H6M3 0V6" stroke="${riscoCor}" stroke-width="1"${op}/>`,
      `<path d="M0 1.5H6M0 4.5H6" stroke="${riscoCor}" stroke-width="1"${op}/>`,
      `<path d="M-1 -1 7 7M5 -1 7 1M-1 5 1 7" stroke="${riscoCor}" stroke-width="1.3"${op}/>`,
    ][k % 6];
    return `<pattern id="${pid}" width="6" height="6" patternUnits="userSpaceOnUse">${base}${risco}</pattern>`;
  }
  // As hachuras de um gráfico, com id próprio para não colidir no documento.
  const defs = (id, lista, leve = false) => `<defs>${lista.map((c, i) => padrao(`${id}-h${i}`, c, i, leve)).join('')}</defs>`;
  const preenche = (id, i) => `url(#${id}-h${i})`;
  // Número escrito em cima da cor (dentro da barra ou da fatia): letra que contrasta e um contorno na própria cor, para o
  // risco da hachura não passar por baixo da letra.
  const rotuloSobre = (x, y, texto, c, t = 9) => `<text x="${r1(x)}" y="${r1(y)}" font-size="${t}" font-weight="700" fill="${textoSobre(c)}" stroke="${c}" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round" text-anchor="middle">${esc(texto)}</text>`;

  function marca(tipo, x, y, c, t = 3.2) {
    const vazado = /vazado/.test(tipo), f = vazado ? FUNDO : c, s = `stroke="${c}" stroke-width="1.3"`;
    if (/quadrado/.test(tipo)) return `<rect x="${r1(x - t)}" y="${r1(y - t)}" width="${r1(t * 2)}" height="${r1(t * 2)}" fill="${f}" ${s}/>`;
    if (/triangulo/.test(tipo)) return `<path d="M${r1(x)} ${r1(y - t - 0.6)}L${r1(x + t + 0.6)} ${r1(y + t)}L${r1(x - t - 0.6)} ${r1(y + t)}Z" fill="${f}" ${s}/>`;
    if (/losango/.test(tipo)) return `<path d="M${r1(x)} ${r1(y - t - 0.8)}L${r1(x + t + 0.8)} ${r1(y)}L${r1(x)} ${r1(y + t + 0.8)}L${r1(x - t - 0.8)} ${r1(y)}Z" fill="${f}" ${s}/>`;
    return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${t}" fill="${f}" ${s}/>`;
  }
  // Legenda: amostra do traço + marcador (linha) ou da hachura (barra/área), em uma linha que quebra.
  function legenda(series, cs, x0, y0, largura, id, modo) {
    if (series.length < 2 && modo !== 'sempre') return { svg: '', altura: 0 };
    let x = x0, y = y0; const out = [];
    series.forEach((s, i) => {
      const nome = corte(s.nome || `Série ${i + 1}`, 34), w = 28 + nome.length * 5.6 + 14;
      if (x + w > x0 + largura && x > x0) { x = x0; y += 16; }
      const amostra = modo === 'barra' ? `<rect x="${r1(x)}" y="${y - 7}" width="16" height="10" rx="1.5" fill="${preenche(id, i)}" stroke="${cs[i]}" stroke-width="1"/>`
        : `<path d="M${r1(x)} ${y - 2}h18" stroke="${cs[i]}" stroke-width="2" stroke-dasharray="${TRACOS[i % TRACOS.length]}" fill="none"/>${marca(MARCAS[i % MARCAS.length], x + 9, y - 2, cs[i], 2.6)}`;
      out.push(`${amostra}<text x="${r1(x + 24)}" y="${y + 1.5}" font-size="9.5" fill="${TEXTO2}">${esc(nome)}</text>`);
      x += w;
    });
    return { svg: out.join(''), altura: y - y0 + 14 };
  }
  // Escala "bonita": de 0 (ou do mínimo negativo) a um teto redondo, com 4 ou 5 divisões.
  function escala(min, max) {
    if (!ehNum(min) || !ehNum(max)) { min = 0; max = 1; }
    if (min > 0) min = 0;
    if (max <= min) max = min + 1;
    const bruto = (max - min) / 4, pot = 10 ** Math.floor(Math.log10(bruto)), m = bruto / pot;
    const passo = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * pot;
    const lo = Math.floor(min / passo) * passo, hi = Math.ceil(max / passo) * passo, marcas = [];
    for (let v = lo; v <= hi + passo / 2; v += passo) marcas.push(Math.round(v * 1e6) / 1e6);
    return { lo, hi, marcas };
  }
  function moldura(largura, altura, corpo, titulo) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${r1(altura)}" width="100%" role="img" aria-label="${esc(titulo || 'Gráfico')}" font-family="${FONTE}" style="display:block;max-width:100%;height:auto">${corpo}</svg>`;
  }
  const gradeDe = (marcas, yDe, esq, dir, f) => marcas.map((m) => `<line x1="${esq}" x2="${dir}" y1="${r1(yDe(m))}" y2="${r1(yDe(m))}" stroke="${m === 0 ? EIXO : GRADE}" stroke-width="${m === 0 ? 1 : 0.7}"/><text x="${esq - 6}" y="${r1(yDe(m) + 3)}" font-size="9" fill="${APAGADO}" text-anchor="end">${esc(f(m))}</text>`).join('');
  // Rótulos do eixo X: mostra todos se couberem; senão, um a cada n (sempre o primeiro e o último).
  function rotulosX(rotulos, xDe, y, largura) {
    const n = rotulos.length; if (!n) return '';
    const cabe = Math.max(1, Math.floor(largura / 46)), passo = Math.max(1, Math.ceil(n / cabe));
    const mostra = (i) => i === n - 1 || (i % passo === 0 && (n - 1 - i >= passo / 2 || i === 0));
    return rotulos.map((r, i) => (mostra(i) ? `<text x="${r1(xDe(i))}" y="${y}" font-size="9" fill="${APAGADO}" text-anchor="middle">${esc(corte(r, 10))}</text>` : '')).join('');
  }

  // ---------- Linha e área ----------
  function linha(o = {}, cheia = false) {
    const series = (o.series || []).filter((s) => Array.isArray(s?.valores));
    const rotulos = (o.rotulos || []).map(String);
    const n = Math.max(rotulos.length, ...series.map((s) => s.valores.length), 0);
    const todos = series.flatMap((s) => s.valores).filter(ehNum).concat(ehNum(o.meta) ? [o.meta] : []);
    if (!n || !todos.length) return '';
    const W = o.largura || 640, H = o.altura || 210, id = `g${++serial}`, f = fmt(o.formato), cs = coresDe(series);
    const leg = legenda(series, cs, 44, 14, W - 56, id, cheia ? 'barra' : 'linha');
    const topo = 12 + leg.altura, base = H - 26, esq = 44, dir = W - 14;
    const { lo, hi, marcas } = escala(Math.min(...todos), Math.max(...todos));
    const yDe = (v) => base - ((v - lo) / (hi - lo || 1)) * (base - topo);
    const xDe = (i) => (n === 1 ? (esq + dir) / 2 : esq + (i / (n - 1)) * (dir - esq));
    const meta = ehNum(o.meta) ? `<line x1="${esq}" x2="${dir}" y1="${r1(yDe(o.meta))}" y2="${r1(yDe(o.meta))}" stroke="${TINTA}" stroke-width="1" stroke-dasharray="3 3"/><text x="${dir}" y="${r1(yDe(o.meta) - 4)}" font-size="9" fill="${TINTA}" text-anchor="end">${esc(o.metaRotulo || 'meta')} ${esc(f(o.meta))}</text>` : '';
    const corpo = series.map((s, i) => {
      const c = cs[i], pts = s.valores.map((v, j) => (ehNum(v) ? [xDe(j), yDe(v), v] : null));
      // Um trecho por sequência sem buracos.
      const trechos = []; let atual = [];
      pts.forEach((p) => { if (p) atual.push(p); else if (atual.length) { trechos.push(atual); atual = []; } });
      if (atual.length) trechos.push(atual);
      const traco = s.tracejada ? '4 3' : TRACOS[i % TRACOS.length];
      const area = cheia ? trechos.filter((t) => t.length > 1).map((t) => `<path d="M${t.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L')}L${r1(t[t.length - 1][0])} ${r1(yDe(Math.max(lo, 0)))}L${r1(t[0][0])} ${r1(yDe(Math.max(lo, 0)))}Z" fill="${preenche(id, i)}" fill-opacity="${series.length > 1 ? 0.75 : 1}" stroke="none"/>`).join('') : '';
      const tracado = trechos.map((t) => (t.length > 1 ? `<path d="M${t.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L')}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="${traco}" stroke-linejoin="round" stroke-linecap="round"/>` : '')).join('');
      const marcas2 = pts.filter(Boolean).length <= 24 ? pts.filter(Boolean).map((p) => marca(MARCAS[i % MARCAS.length], p[0], p[1], c)).join('') : '';
      // O último valor de cada série vai escrito ao lado do ponto (o número que o leitor procura): na cor da série quando
      // ela contrasta com o papel, senão na tinta.
      const ult = pts.filter(Boolean).pop(), corRot = contraste(c, FUNDO) >= 4.5 ? c : TINTA;
      const rot = ult && o.semValorFinal !== true ? `<text x="${r1(Math.min(ult[0] + 5, dir - 2))}" y="${r1(ult[1] - 6)}" font-size="9.5" font-weight="600" fill="${corRot}" text-anchor="${ult[0] + 30 > dir ? 'end' : 'start'}">${esc(f(ult[2]))}</text>` : '';
      return area + tracado + marcas2 + rot;
    }).join('');
    const svg = `${cheia ? defs(id, cs, true) : ''}<rect width="${W}" height="${H}" fill="${FUNDO}"/>${leg.svg}${gradeDe(marcas, yDe, esq, dir, f)}${meta}${corpo}${rotulosX(rotulos, xDe, H - 8, dir - esq)}`;
    return moldura(W, H, svg, o.titulo);
  }
  const area = (o = {}) => linha(o, true);

  // ---------- Barras (agrupadas ou empilhadas) ----------
  function barras(o = {}) {
    const series = (o.series || []).filter((s) => Array.isArray(s?.valores));
    const rotulos = (o.rotulos || []).map(String);
    const n = Math.max(rotulos.length, ...series.map((s) => s.valores.length), 0);
    if (!n || !series.length) return '';
    const somas = Array.from({ length: n }, (_, j) => series.reduce((t, s) => t + (ehNum(s.valores[j]) ? s.valores[j] : 0), 0));
    const todos = o.empilhado ? somas : series.flatMap((s) => s.valores).filter(ehNum);
    if (!todos.length) return '';
    const W = o.largura || 640, H = o.altura || 210, id = `g${++serial}`, f = fmt(o.formato), cs = coresDe(series);
    const leg = legenda(series, cs, 44, 14, W - 56, id, 'barra');
    const topo = 14 + leg.altura, base = H - 26, esq = 44, dir = W - 14;
    const { lo, hi, marcas } = escala(Math.min(0, ...todos), Math.max(...todos));
    const yDe = (v) => base - ((v - lo) / (hi - lo || 1)) * (base - topo);
    const banda = (dir - esq) / n, larg = Math.min(46, banda * 0.72);
    const xDe = (j) => esq + banda * j + banda / 2;
    const out = [];
    for (let j = 0; j < n; j++) {
      if (o.empilhado) {
        let acc = 0;
        series.forEach((s, i) => {
          const v = s.valores[j]; if (!ehNum(v) || v === 0) return;
          const y1 = yDe(acc + v), y0 = yDe(acc), alto = Math.abs(y0 - y1); acc += v;
          out.push(`<rect x="${r1(xDe(j) - larg / 2)}" y="${r1(Math.min(y0, y1))}" width="${r1(larg)}" height="${r1(alto)}" fill="${preenche(id, i)}" stroke="${cs[i]}" stroke-width=".8"/>`);
          // A parte de cada série escrita dentro dela, quando cabe e há mais de uma série.
          if (series.length > 1 && alto >= 13 && larg >= 16 && n <= 16) out.push(rotuloSobre(xDe(j), (y0 + y1) / 2 + 3, f(v), cs[i], 8.5));
        });
        if (somas[j] && n <= 16) out.push(`<text x="${r1(xDe(j))}" y="${r1(yDe(somas[j]) - 4)}" font-size="9.5" font-weight="600" fill="${TINTA}" text-anchor="middle">${esc(f(somas[j]))}</text>`);
      } else {
        const k = series.length, w = larg / k;
        series.forEach((s, i) => {
          const v = s.valores[j]; if (!ehNum(v)) return;
          const x = xDe(j) - larg / 2 + w * i, y1 = yDe(Math.max(v, 0)), y0 = yDe(Math.min(v, 0));
          out.push(`<rect x="${r1(x + 0.5)}" y="${r1(y1)}" width="${r1(Math.max(1, w - 1))}" height="${r1(Math.max(0.5, y0 - y1))}" fill="${preenche(id, i)}" stroke="${cs[i]}" stroke-width=".8"/>`);
          if (n * k <= 18) out.push(`<text x="${r1(x + w / 2)}" y="${r1(y1 - 4)}" font-size="9" font-weight="600" fill="${TINTA}" text-anchor="middle">${esc(f(v))}</text>`);
        });
      }
    }
    const svg = `${defs(id, cs)}<rect width="${W}" height="${H}" fill="${FUNDO}"/>${leg.svg}${gradeDe(marcas, yDe, esq, dir, f)}${out.join('')}${rotulosX(rotulos, xDe, H - 8, dir - esq)}`;
    return moldura(W, H, svg, o.titulo);
  }

  // ---------- Rosca ----------
  function rosca(o = {}) {
    const fatias = (o.fatias || []).filter((x) => ehNum(x?.valor) && x.valor > 0);
    const total = fatias.reduce((t, x) => t + x.valor, 0);
    if (!total) return '';
    const W = o.largura || 640, H = o.altura || Math.max(170, 40 + fatias.length * 22), id = `g${++serial}`, f = fmt(o.formato), cs = coresDe(fatias);
    const cx = 100, cy = H / 2, R = Math.min(78, H / 2 - 10), r = R * 0.58;
    let ang = -Math.PI / 2; const arcos = [], dentro = [];
    fatias.forEach((x, i) => {
      const a = (x.valor / total) * Math.PI * 2, a2 = ang + a, grande = a > Math.PI ? 1 : 0;
      const p = (rad, raio) => `${r1(cx + raio * Math.cos(rad))} ${r1(cy + raio * Math.sin(rad))}`;
      const d = fatias.length === 1
        ? `M${cx - R} ${cy}a${R} ${R} 0 1 0 ${R * 2} 0a${R} ${R} 0 1 0 ${-R * 2} 0ZM${cx - r} ${cy}a${r} ${r} 0 1 1 ${r * 2} 0a${r} ${r} 0 1 1 ${-r * 2} 0Z`
        : `M${p(ang, R)}A${R} ${R} 0 ${grande} 1 ${p(a2, R)}L${p(a2, r)}A${r} ${r} 0 ${grande} 0 ${p(ang, r)}Z`;
      arcos.push(`<path d="${d}" fill="${preenche(id, i)}" stroke="${FUNDO}" stroke-width="1.2" fill-rule="evenodd"/><path d="${d}" fill="none" stroke="${cs[i]}" stroke-width=".8" fill-rule="evenodd"/>`);
      // A quantidade dentro da fatia, quando ela tem espaço.
      if (a >= 0.42) { const m = ang + a / 2, rm = (R + r) / 2; dentro.push(rotuloSobre(cx + rm * Math.cos(m), cy + rm * Math.sin(m) + 3, f(x.valor), cs[i], 9)); }
      ang = a2;
    });
    const centro = `<text x="${cx}" y="${cy + 2}" font-size="18" font-weight="700" fill="${TINTA}" text-anchor="middle">${esc(o.centro ?? f(total))}</text>${o.sub ? `<text x="${cx}" y="${cy + 16}" font-size="9" fill="${APAGADO}" text-anchor="middle">${esc(corte(o.sub, 18))}</text>` : ''}`;
    const x0 = 210, passo = Math.min(24, (H - 20) / fatias.length), y0 = cy - (passo * fatias.length) / 2 + passo / 2;
    const leg = fatias.map((x, i) => {
      const y = y0 + i * passo, pct = Math.round((x.valor / total) * 100);
      return `<rect x="${x0}" y="${r1(y - 8)}" width="14" height="11" rx="1.5" fill="${preenche(id, i)}" stroke="${cs[i]}" stroke-width="1"/><text x="${x0 + 22}" y="${r1(y + 1)}" font-size="10.5" fill="${TINTA}">${esc(corte(x.rotulo, 40))}</text><text x="${W - 14}" y="${r1(y + 1)}" font-size="10.5" font-weight="600" fill="${TINTA}" text-anchor="end">${esc(f(x.valor))} · ${pct}%</text><line x1="${x0}" x2="${W - 14}" y1="${r1(y + passo / 2 - 1)}" y2="${r1(y + passo / 2 - 1)}" stroke="${GRADE}" stroke-width=".6"/>`;
    }).join('');
    return moldura(W, H, `${defs(id, cs)}<rect width="${W}" height="${H}" fill="${FUNDO}"/>${arcos.join('')}${dentro.join('')}${centro}${leg}`, o.titulo);
  }

  // ---------- Cascata ----------
  // passos: o primeiro (ou qualquer um com total:true) é uma coluna cheia; os outros sobem ou descem a partir do anterior.
  // Total no neutro, subida na cor de pronto e descida na de perigo (as cores de função do padrão); `cor` no passo manda.
  // A hachura segue o tipo (total cheio, subida em diagonal, descida pontilhada), para o preto e branco.
  function cascata(o = {}) {
    const passos = (o.passos || []).filter((p) => ehNum(p?.valor));
    if (!passos.length) return '';
    const W = o.largura || 640, H = o.altura || 220, id = `g${++serial}`, f = fmt(o.formato);
    let acc = 0; const barrasC = passos.map((p, i) => {
      if (i === 0 || p.total) { const b = { de: 0, ate: p.valor, p, tipo: 'total' }; acc = p.valor; return b; }
      const b = { de: acc, ate: acc + p.valor, p, tipo: p.valor >= 0 ? 'sobe' : 'desce' }; acc += p.valor; return b;
    });
    const todos = barrasC.flatMap((b) => [b.de, b.ate]);
    const topo = 30, base = H - 30, esq = 44, dir = W - 14;
    const { lo, hi, marcas } = escala(Math.min(...todos), Math.max(...todos));
    const yDe = (v) => base - ((v - lo) / (hi - lo || 1)) * (base - topo);
    const banda = (dir - esq) / barrasC.length, larg = Math.min(54, banda * 0.66), xDe = (j) => esq + banda * j + banda / 2;
    const porTipo = { total: T.fumeTexto2, sobe: T.pronto, desce: T.perigo }, hachura = { total: 0, sobe: 1, desce: 2 };
    const cs = barrasC.map((b) => hex(b.p.cor) || porTipo[b.tipo]);
    const corpo = barrasC.map((b, j) => {
      const y1 = yDe(Math.max(b.de, b.ate)), y0 = yDe(Math.min(b.de, b.ate));
      const lig = j < barrasC.length - 1 ? `<line x1="${r1(xDe(j) + larg / 2)}" x2="${r1(xDe(j + 1) - larg / 2)}" y1="${r1(yDe(b.ate))}" y2="${r1(yDe(b.ate))}" stroke="${APAGADO}" stroke-width=".8" stroke-dasharray="2 2"/>` : '';
      const sinal = b.tipo === 'total' ? '' : b.p.valor >= 0 ? '+' : '−';
      return `<rect x="${r1(xDe(j) - larg / 2)}" y="${r1(y1)}" width="${r1(larg)}" height="${r1(Math.max(0.8, y0 - y1))}" fill="${preenche(id, j)}" stroke="${cs[j]}" stroke-width=".9"/>${lig}<text x="${r1(xDe(j))}" y="${r1(y1 - 5)}" font-size="9.5" font-weight="600" fill="${TINTA}" text-anchor="middle">${sinal}${esc(f(Math.abs(b.p.valor)))}</text><text x="${r1(xDe(j))}" y="${H - 12}" font-size="9" fill="${APAGADO}" text-anchor="middle">${esc(corte(b.p.rotulo, Math.max(6, Math.floor(banda / 5.2))))}</text>`;
    }).join('');
    const defsC = `<defs>${barrasC.map((b, j) => padrao(`${id}-h${j}`, cs[j], hachura[b.tipo])).join('')}</defs>`;
    return moldura(W, H, `${defsC}<rect width="${W}" height="${H}" fill="${FUNDO}"/>${gradeDe(marcas, yDe, esq, dir, f)}${corpo}`, o.titulo);
  }

  // ---------- Heatmap ----------
  // Tons de uma cor só (do claro ao cheio) e o número escrito na célula: em preto e branco vale o número. A cor é a do
  // gráfico (`cor`), a de cada linha (`coresLinhas`: a pessoa ou o cliente da linha) ou o destaque.
  function heatmap(o = {}) {
    const linhas = (o.linhas || []).map(String), colunas = (o.colunas || []).map(String), valores = o.valores || [];
    const todos = valores.flat().filter(ehNum);
    if (!linhas.length || !colunas.length || !todos.length) return '';
    const W = o.largura || 640, f = fmt(o.formato), comPonto = Array.isArray(o.coresLinhas);
    const rotW = Math.min(170, 18 + Math.max(...linhas.map((l) => l.length)) * 5.8 + (comPonto ? 8 : 0));
    const celW = (W - rotW - 10) / colunas.length, celH = o.celula || 20, H = 26 + linhas.length * celH + 6;
    const max = Math.max(...todos), min = Math.min(0, ...todos), base = hex(o.cor) || T.acao;
    const corLinha = linhas.map((_, i) => hex(o.coresLinhas?.[i]) || base);
    const tom = (v, c) => { const t = (v - min) / (max - min || 1), fundo = misturar(c, FUNDO, 0.08 + t * 0.86); return { fundo, texto: textoSobre(fundo) }; };
    const cab = colunas.map((c, j) => `<text x="${r1(rotW + celW * j + celW / 2)}" y="16" font-size="9" fill="${APAGADO}" text-anchor="middle">${esc(corte(c, Math.max(3, Math.floor(celW / 5.5))))}</text>`).join('');
    const corpo = linhas.map((l, i) => {
      const y = 24 + i * celH, ponto = comPonto ? `<circle cx="${r1(rotW - 8)}" cy="${r1(y + celH / 2)}" r="3" fill="${corLinha[i]}"/>` : '';
      return `${ponto}<text x="${rotW - (comPonto ? 16 : 8)}" y="${r1(y + celH / 2 + 3)}" font-size="9.5" fill="${TINTA}" text-anchor="end">${esc(corte(l, 30))}</text>${colunas.map((_, j) => {
        const v = valores[i]?.[j], x = rotW + celW * j;
        if (!ehNum(v)) return `<rect x="${r1(x + 1)}" y="${r1(y + 1)}" width="${r1(celW - 2)}" height="${celH - 2}" fill="${T.folhaLeve}" stroke="${GRADE}" stroke-width=".5"/>`;
        const t = tom(v, corLinha[i]);
        return `<rect x="${r1(x + 1)}" y="${r1(y + 1)}" width="${r1(celW - 2)}" height="${celH - 2}" rx="2" fill="${t.fundo}" stroke="${FUNDO}" stroke-width=".5"/>${celW >= 16 ? `<text x="${r1(x + celW / 2)}" y="${r1(y + celH / 2 + 3)}" font-size="${celW < 24 ? 8 : 9}" font-weight="600" fill="${t.texto}" text-anchor="middle">${esc(f(v))}</text>` : ''}`;
      }).join('')}`;
    }).join('');
    return moldura(W, H, `<rect width="${W}" height="${H}" fill="${FUNDO}"/>${cab}${corpo}`, o.titulo);
  }

  // ---------- Ranking (barras deitadas, do maior para o menor) ----------
  // Cor do item: `cor` (status, cliente ou pessoa, posta pelo motor); sem ela, o tom (ruim = perigo, bom = pronto), o
  // destaque no primeiro e o neutro no resto. O nome fica ao lado de cada barra, então ela vai cheia, sem hachura.
  function ranking(o = {}) {
    const itens = (o.itens || []).filter((x) => ehNum(x?.valor)).slice(0, o.max || 12);
    if (!itens.length) return '';
    const W = o.largura || 640, f = fmt(o.formato), id = `g${++serial}`, linhaH = 22, H = 10 + itens.length * linhaH;
    const rotW = Math.min(250, 34 + Math.max(...itens.map((x) => Math.min(34, String(x.rotulo).length) * 5.6 + (x.sub ? Math.min(24, String(x.sub).length) * 4.8 + 10 : 0)))), valW = 70;
    const max = Math.max(...itens.map((x) => Math.abs(x.valor))) || 1, barraW = W - rotW - valW - 14;
    const cs = itens.map((x, i) => hex(x.cor) || (x.tom === 'ruim' ? T.perigo : x.tom === 'bom' ? T.pronto : x.destaque || i === 0 ? T.acao : T.fumeMeta));
    const corpo = itens.map((x, i) => {
      const y = 6 + i * linhaH, w = Math.max(1.5, (Math.abs(x.valor) / max) * barraW);
      return `<text x="10" y="${r1(y + 13)}" font-size="9" fill="${APAGADO}">${i + 1}</text><text x="24" y="${r1(y + 13)}" font-size="10" fill="${TINTA}">${esc(corte(x.rotulo, 34))}${x.sub ? `<tspan fill="${APAGADO}" font-size="8.5"> · ${esc(corte(x.sub, 24))}</tspan>` : ''}</text>`
        + `<rect x="${rotW}" y="${r1(y + 4)}" width="${r1(w)}" height="12" rx="2" fill="${preenche(id, i)}" stroke="${cs[i]}" stroke-width=".8"/>`
        + `<text x="${W - 10}" y="${r1(y + 13.5)}" font-size="10" font-weight="600" fill="${TINTA}" text-anchor="end">${esc(f(x.valor))}</text>`;
    }).join('');
    return moldura(W, H, `<defs>${cs.map((c, i) => padrao(`${id}-h${i}`, c, 0)).join('')}</defs><rect width="${W}" height="${H}" fill="${FUNDO}"/>${corpo}`, o.titulo);
  }

  const TIPOS = { linha, area, barras, rosca, cascata, heatmap, ranking };
  function desenhar(g) {
    if (!g || typeof g !== 'object') return '';
    const fn = TIPOS[g.tipo]; if (!fn) return '';
    try { return fn(g); } catch (e) { if (typeof console !== 'undefined') console.error('[relatorio] gráfico', g.tipo, e); return ''; }
  }

  const api = Object.freeze({ desenhar, linha, area, barras, rosca, cascata, heatmap, ranking, TIPOS: Object.keys(TIPOS), TRACOS, escala,
    TOKENS, definirCores, cores, corPadrao, misturar, contraste, textoSobre, hex });
  raiz.VybeRelGraficos = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
