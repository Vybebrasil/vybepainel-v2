// vybe-graficos.js — os gráficos do Finanças em SVG próprio, sem biblioteca (Paulo, 26/11/2026: "gráficos de linha,
// pizza, projeções, históricos"). Cada função devolve HTML (string) pronto para entrar na tela:
//   linhaFaixa   linhas com uma faixa (o pessimista–otimista da projeção) e a linha do zero
//   area         área empilhada (custos por linha da DRE, mês a mês)
//   rosca        rosca/pizza com legenda
//   barras       barras agrupadas (orçado × realizado, entrou × saiu)
//   cascata      cascata (MRR: começo, novo, expansão, contração, perdido, fim)
//   calor        heatmap (cliente × mês)
//   barrasH      barras horizontais (ranking de margem por cliente)
// Todas: a dica que segue o mouse (o .fe-hv + .fe-tip das telas de Finanças, que já sabem mostrá-la), a legenda que
// esconde e mostra a série num clique (data-vg-serie) e uma tabela escondida para leitor de tela com os mesmos números.
// Cores: classes k0–k6 (k0 = cinza do "resto"; k1–k6 = a paleta --fe-c1..c6 do Finanças), nunca cor solta no SVG.
(function (raiz) {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rs = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : `${Number(v) < 0 ? '−' : ''}R$ ${Math.abs(Number(v)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const mil = (v) => { const n = Number(v) || 0, a = Math.abs(n); const s = a >= 1e6 ? `${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : a >= 1e3 ? `${(a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : a.toLocaleString('pt-BR', { maximumFractionDigits: 0 }); return `${n < 0 ? '−' : ''}R$ ${s}`; };
  const eixo = (v) => { const a = Math.abs(v); const s = a >= 1e6 ? `${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}mi` : a >= 1e3 ? `${(a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k` : String(Math.round(a)); return (v < 0 ? '−' : '') + s; };
  const f1 = (n) => Number(n).toFixed(1);
  // Um passo "redondo" para a grade (1, 2, 2,5, 5 × 10ⁿ).
  function escala(min, max, partes = 4) {
    const bruto = (max - min) / partes || 1, p10 = 10 ** Math.floor(Math.log10(Math.abs(bruto) || 1));
    const passo = [1, 2, 2.5, 5, 10].map((k) => k * p10).find((k) => k >= bruto) || bruto;
    const topo = Math.ceil(max / passo) * passo, base = Math.floor(min / passo) * passo;
    const marcas = []; for (let v = base; v <= topo + passo * 1e-6 && marcas.length < 12; v += passo) marcas.push(Math.round(v * 100) / 100);
    return { topo: topo === base ? base + passo : topo, base, marcas };
  }
  const caixa = (svg, extra = '') => `<div class="fe-hv vg-hv">${svg}<div class="fe-tip" hidden></div></div>${extra}`;
  const legenda = (series, { clicavel = true } = {}) => `<div class="vg-leg" role="group" aria-label="Séries do gráfico">${series.map((s, i) => clicavel
    ? `<button type="button" class="vg-leg-b" data-vg-serie="${i}" aria-pressed="true"><i class="vg-cor ${esc(s.cor || 'k' + ((i % 6) + 1))}${s.trac ? ' trac' : ''}" aria-hidden="true"></i>${esc(s.nome)}</button>`
    : `<span class="vg-leg-b"><i class="vg-cor ${esc(s.cor || 'k' + ((i % 6) + 1))}" aria-hidden="true"></i>${esc(s.nome)}</span>`).join('')}</div>`;
  const tabela = (rotulo, colunas, linhas) => `<table class="fv2-sr"><caption>${esc(rotulo)}</caption><tr><th scope="col"></th>${colunas.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr>${linhas.map(([n, vals]) => `<tr><th scope="row">${esc(n)}</th>${vals.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`;
  const vazio = (t = 'Sem dado para desenhar ainda.') => `<p class="fe-vazio">${esc(t)}</p>`;

  // ---------- Linha com faixa ----------
  // rotX: [{ curto, longo }]; series: [{ nome, vals[], cor: 'k1', trac }]; faixa: { de[], ate[], nome }; marcarX: índice
  function linhaFaixa({ rotX = [], series = [], faixa = null, rotulo = '', alto = 220, fmt = rs, marcarX = -1, zero = true } = {}) {
    const n = rotX.length, todos = [...series.flatMap((s) => s.vals), ...(faixa ? [...faixa.de, ...faixa.ate] : [])].filter((v) => v != null && Number.isFinite(v));
    if (!n || !todos.length) return vazio();
    const W = 640, H = alto, pe = 48, pd = 18, pt = 14, pb = 26;
    const { topo, base, marcas } = escala(Math.min(zero ? 0 : Infinity, ...todos), Math.max(zero ? 0 : -Infinity, ...todos));
    const x = (i) => pe + (n === 1 ? (W - pe - pd) / 2 : i * (W - pe - pd) / (n - 1));
    const y = (v) => pt + (1 - (v - base) / ((topo - base) || 1)) * (H - pt - pb);
    const pts = (vals) => vals.map((v, i) => (v == null ? null : `${f1(x(i))},${f1(y(v))}`)).filter(Boolean).join(' ');
    let banda = '';
    if (faixa) {
      const ida = faixa.ate.map((v, i) => (v == null ? null : `${f1(x(i))},${f1(y(v))}`)).filter(Boolean);
      const volta = faixa.de.map((v, i) => (v == null ? null : `${f1(x(i))},${f1(y(v))}`)).filter(Boolean).reverse();
      if (ida.length > 1) banda = `<polygon class="vg-faixa" points="${[...ida, ...volta].join(' ')}"/>`;
    }
    const larg = n > 1 ? (W - pe - pd) / (n - 1) : W - pe - pd;
    const alvos = rotX.map((r, i) => `<rect class="fe-hv-alvo" x="${f1(x(i) - larg / 2)}" y="0" width="${f1(larg)}" height="${H - pb}" data-x="${f1(x(i))}"
      data-tip="${esc([r.longo || r.curto, ...series.map((s) => `${s.nome}: ${s.vals[i] == null ? '—' : fmt(s.vals[i])}`), ...(faixa && faixa.de[i] != null ? [`${faixa.nome || 'Faixa'}: ${fmt(faixa.de[i])} a ${fmt(faixa.ate[i])}`] : [])].join('\n'))}"/>`).join('');
    const passoX = Math.max(1, Math.ceil(n / 8));
    const svg = `<svg class="fe-graf d3-graf vg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo)}">
      ${marcas.map((v) => `<line class="fe-grade" x1="${pe}" x2="${W - pd}" y1="${f1(y(v))}" y2="${f1(y(v))}"/><text class="fe-eixo" x="${pe - 8}" y="${f1(y(v) + 3)}" text-anchor="end">${esc(eixo(v))}</text>`).join('')}
      ${base < 0 ? `<line class="vg-zero" x1="${pe}" x2="${W - pd}" y1="${f1(y(0))}" y2="${f1(y(0))}"/>` : ''}
      ${banda ? `<g data-vg-s="f">${banda}</g>` : ''}
      ${marcarX >= 0 && marcarX < n ? `<line class="fe-hoje-x" x1="${f1(x(marcarX))}" x2="${f1(x(marcarX))}" y1="${pt}" y2="${H - pb}"/>` : ''}
      ${series.map((s, i) => `<g data-vg-s="${i}"><polyline class="vg-ln ${esc(s.cor || 'k' + ((i % 6) + 1))}${s.trac ? ' trac' : ''}" points="${pts(s.vals)}"/></g>`).join('')}
      ${rotX.map((r, i) => (i % passoX === 0 || i === n - 1 ? `<text class="fe-eixo" x="${f1(x(i))}" y="${H - 8}" text-anchor="middle">${esc(r.curto)}</text>` : '')).join('')}
      <line class="fe-cruz" x1="0" x2="0" y1="${pt}" y2="${H - pb}" hidden/>${alvos}</svg>`;
    const leg = legenda([...series, ...(faixa ? [{ nome: faixa.nome || 'Faixa', cor: 'kf' }] : [])].map((s, i) => ({ ...s, _i: i })));
    // A faixa é a última da legenda; o data-vg-serie dela é "f".
    const legF = faixa ? leg.replace(new RegExp(`data-vg-serie="${series.length}"`), 'data-vg-serie="f"') : leg;
    return `<div class="vg-caixa">${legF}${caixa(svg, tabela(rotulo, rotX.map((r) => r.longo || r.curto), series.map((s) => [s.nome, s.vals.map((v) => (v == null ? '—' : fmt(v)))])))}</div>`;
  }

  // ---------- Área empilhada ----------
  function area({ rotX = [], series = [], rotulo = '', alto = 220, fmt = rs } = {}) {
    const n = rotX.length;
    if (!n || !series.length) return vazio();
    const W = 640, H = alto, pe = 48, pd = 18, pt = 14, pb = 26;
    const soma = rotX.map((_, i) => series.reduce((s, x) => s + Math.max(0, Number(x.vals[i]) || 0), 0));
    const { topo, base, marcas } = escala(0, Math.max(1, ...soma));
    const x = (i) => pe + (n === 1 ? (W - pe - pd) / 2 : i * (W - pe - pd) / (n - 1));
    const y = (v) => pt + (1 - (v - base) / ((topo - base) || 1)) * (H - pt - pb);
    const acc = new Array(n).fill(0);
    const camadas = series.map((s, k) => {
      const de = acc.slice(), ate = acc.map((a, i) => a + Math.max(0, Number(s.vals[i]) || 0));
      for (let i = 0; i < n; i++) acc[i] = ate[i];
      const ida = ate.map((v, i) => `${f1(x(i))},${f1(y(v))}`), volta = de.map((v, i) => `${f1(x(i))},${f1(y(v))}`).reverse();
      return `<g data-vg-s="${k}"><polygon class="vg-area ${esc(s.cor || 'k' + ((k % 6) + 1))}" points="${[...ida, ...volta].join(' ')}"/></g>`;
    });
    const larg = n > 1 ? (W - pe - pd) / (n - 1) : W - pe - pd;
    const alvos = rotX.map((r, i) => `<rect class="fe-hv-alvo" x="${f1(x(i) - larg / 2)}" y="0" width="${f1(larg)}" height="${H - pb}" data-x="${f1(x(i))}" data-tip="${esc([r.longo || r.curto, ...series.map((s) => `${s.nome}: ${fmt(s.vals[i] || 0)}`), `Total: ${fmt(soma[i])}`].join('\n'))}"/>`).join('');
    const passoX = Math.max(1, Math.ceil(n / 8));
    const svg = `<svg class="fe-graf d3-graf vg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo)}">
      ${marcas.map((v) => `<line class="fe-grade" x1="${pe}" x2="${W - pd}" y1="${f1(y(v))}" y2="${f1(y(v))}"/><text class="fe-eixo" x="${pe - 8}" y="${f1(y(v) + 3)}" text-anchor="end">${esc(eixo(v))}</text>`).join('')}
      ${camadas.join('')}
      ${rotX.map((r, i) => (i % passoX === 0 || i === n - 1 ? `<text class="fe-eixo" x="${f1(x(i))}" y="${H - 8}" text-anchor="middle">${esc(r.curto)}</text>` : '')).join('')}
      <line class="fe-cruz" x1="0" x2="0" y1="${pt}" y2="${H - pb}" hidden/>${alvos}</svg>`;
    return `<div class="vg-caixa">${legenda(series)}${caixa(svg, tabela(rotulo, rotX.map((r) => r.longo || r.curto), series.map((s) => [s.nome, s.vals.map((v) => fmt(v || 0))])))}</div>`;
  }

  // ---------- Rosca ----------
  // fatias: [{ nome, valor, cor, attrs }]; centro (texto grande) e sub.
  function rosca({ fatias = [], rotulo = '', centro = '', sub = '', fmt = rs } = {}) {
    const fs = fatias.filter((f) => Number(f.valor) > 0), tot = fs.reduce((s, f) => s + Number(f.valor), 0);
    if (!tot) return vazio('Nada para dividir ainda.');
    const R = 70, r = 46, C = 90; let ang = -Math.PI / 2;
    const p = (rr, a) => `${(C + rr * Math.cos(a)).toFixed(2)},${(C + rr * Math.sin(a)).toFixed(2)}`;
    const peca = fs.map((f, i) => {
      const a0 = ang, a1 = ang + (Number(f.valor) / tot) * Math.PI * 2; ang = a1;
      const g = a1 - a0 > Math.PI ? 1 : 0;
      const d = fs.length === 1 ? `M${C},${C - R} A${R},${R} 0 1 1 ${C - 0.01},${C - R} L${C - 0.01},${C - r} A${r},${r} 0 1 0 ${C},${C - r} Z`
        : `M${p(R, a0)} A${R},${R} 0 ${g} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${g} 0 ${p(r, a0)} Z`;
      return `<path class="fe-fatia ${esc((f.cor || 'k' + ((i % 6) + 1)).replace(/^k/, 'c'))}" d="${d}" data-tip="${esc(`${f.nome}\n${fmt(f.valor)} · ${Math.round(Number(f.valor) / tot * 100)}%`)}"/>`;
    }).join('');
    const svg = `<svg class="fe-graf d3-graf fe-rosca vg" viewBox="0 0 180 180" role="img" aria-label="${esc(rotulo)}">${peca}
      <text class="fe-rosca-v" x="${C}" y="${C + 2}" text-anchor="middle">${esc(centro || mil(tot))}</text>${sub ? `<text class="fe-rosca-s" x="${C}" y="${C + 18}" text-anchor="middle">${esc(sub)}</text>` : ''}</svg>`;
    const leg = `<div class="fe-rosca-leg">${fs.map((f, i) => `<${f.attrs ? `button type="button" ${f.attrs}` : 'div'} class="fe-rl"><i class="${esc((f.cor || 'k' + ((i % 6) + 1)).replace(/^k/, 'c'))}" aria-hidden="true"></i><span>${esc(f.nome)}</span><b>${esc(mil(f.valor))}</b><small>${Math.round(Number(f.valor) / tot * 100)}%</small></${f.attrs ? 'button' : 'div'}>`).join('')}</div>`;
    return `<div class="fe-rosca-caixa"><div class="fe-hv fe-rosca-g">${svg}<div class="fe-tip" hidden></div></div>${leg}</div>${tabela(rotulo, ['Valor', '%'], fs.map((f) => [f.nome, [fmt(f.valor), `${Math.round(Number(f.valor) / tot * 100)}%`]]))}`;
  }

  // ---------- Barras agrupadas ----------
  function barras({ rotX = [], series = [], rotulo = '', alto = 220, fmt = rs } = {}) {
    const n = rotX.length, todos = series.flatMap((s) => s.vals).filter((v) => v != null);
    if (!n || !todos.length) return vazio();
    const W = 640, H = alto, pe = 48, pd = 12, pt = 14, pb = 26;
    const { topo, base, marcas } = escala(Math.min(0, ...todos), Math.max(1, ...todos));
    const y = (v) => pt + (1 - (v - base) / ((topo - base) || 1)) * (H - pt - pb);
    const grupo = (W - pe - pd) / n, bw = Math.max(4, Math.min(34, (grupo * 0.72) / Math.max(1, series.length)));
    const x0 = (i) => pe + i * grupo + (grupo - bw * series.length) / 2;
    const corpo = series.map((s, k) => `<g data-vg-s="${k}">${s.vals.map((v, i) => { if (v == null) return ''; const a = y(Math.max(0, v)), b = y(Math.min(0, v));
      return `<rect class="vg-bar ${esc(s.cor || 'k' + ((k % 6) + 1))}${s.trac ? ' trac' : ''}" x="${f1(x0(i) + k * bw)}" y="${f1(a)}" width="${f1(bw - 2)}" height="${f1(Math.max(1, b - a))}" rx="2"/>`; }).join('')}</g>`).join('');
    const alvos = rotX.map((r, i) => `<rect class="fe-hv-alvo" x="${f1(pe + i * grupo)}" y="0" width="${f1(grupo)}" height="${H - pb}" data-tip="${esc([r.longo || r.curto, ...series.map((s) => `${s.nome}: ${s.vals[i] == null ? '—' : fmt(s.vals[i])}`)].join('\n'))}"/>`).join('');
    const passoX = Math.max(1, Math.ceil(n / 10));
    const svg = `<svg class="fe-graf d3-graf vg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo)}">
      ${marcas.map((v) => `<line class="fe-grade" x1="${pe}" x2="${W - pd}" y1="${f1(y(v))}" y2="${f1(y(v))}"/><text class="fe-eixo" x="${pe - 8}" y="${f1(y(v) + 3)}" text-anchor="end">${esc(eixo(v))}</text>`).join('')}
      ${base < 0 ? `<line class="vg-zero" x1="${pe}" x2="${W - pd}" y1="${f1(y(0))}" y2="${f1(y(0))}"/>` : ''}${corpo}
      ${rotX.map((r, i) => (i % passoX === 0 || i === n - 1 ? `<text class="fe-eixo" x="${f1(pe + i * grupo + grupo / 2)}" y="${H - 8}" text-anchor="middle">${esc(r.curto)}</text>` : '')).join('')}${alvos}</svg>`;
    return `<div class="vg-caixa">${legenda(series)}${caixa(svg, tabela(rotulo, rotX.map((r) => r.longo || r.curto), series.map((s) => [s.nome, s.vals.map((v) => (v == null ? '—' : fmt(v)))])))}</div>`;
  }

  // ---------- Cascata ----------
  // passos: [{ nome, valor, tipo: 'total' | 'delta' }]: total desenha do zero; delta sobe (verde) ou desce (vermelho).
  function cascata({ passos = [], rotulo = '', alto = 220, fmt = rs } = {}) {
    if (!passos.length) return vazio();
    const W = 640, H = alto, pe = 48, pd = 12, pt = 18, pb = 30;
    let acc = 0; const barrasC = passos.map((p) => { if (p.tipo === 'total') { acc = Number(p.valor) || 0; return { ...p, de: 0, ate: acc }; } const de = acc; acc += Number(p.valor) || 0; return { ...p, de, ate: acc }; });
    const vals = barrasC.flatMap((b) => [b.de, b.ate]);
    const { topo, base, marcas } = escala(Math.min(0, ...vals), Math.max(1, ...vals));
    const y = (v) => pt + (1 - (v - base) / ((topo - base) || 1)) * (H - pt - pb);
    const g = (W - pe - pd) / barrasC.length, bw = Math.min(64, g * 0.6);
    const corpo = barrasC.map((b, i) => { const a = y(Math.max(b.de, b.ate)), c = y(Math.min(b.de, b.ate)), xx = pe + i * g + (g - bw) / 2;
      const cls = b.tipo === 'total' ? 'k0 tot' : b.valor >= 0 ? 'sobe' : 'desce';
      return `<rect class="vg-bar ${cls}" x="${f1(xx)}" y="${f1(a)}" width="${f1(bw)}" height="${f1(Math.max(1, c - a))}" rx="2" data-tip="${esc(`${b.nome}\n${b.tipo === 'total' ? fmt(b.valor) : (b.valor >= 0 ? '+' : '') + fmt(b.valor)}`)}"/>
        <text class="vg-rot" x="${f1(xx + bw / 2)}" y="${f1(a - 5)}" text-anchor="middle">${esc(b.tipo === 'total' ? mil(b.valor) : (b.valor > 0 ? '+' : '') + mil(b.valor))}</text>
        ${i < barrasC.length - 1 ? `<line class="vg-ponte" x1="${f1(xx + bw)}" x2="${f1(xx + g)}" y1="${f1(y(b.ate))}" y2="${f1(y(b.ate))}"/>` : ''}
        <text class="fe-eixo" x="${f1(xx + bw / 2)}" y="${H - 10}" text-anchor="middle">${esc(b.nome)}</text>`; }).join('');
    const svg = `<svg class="fe-graf d3-graf vg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo)}">
      ${marcas.map((v) => `<line class="fe-grade" x1="${pe}" x2="${W - pd}" y1="${f1(y(v))}" y2="${f1(y(v))}"/><text class="fe-eixo" x="${pe - 8}" y="${f1(y(v) + 3)}" text-anchor="end">${esc(eixo(v))}</text>`).join('')}${corpo}</svg>`;
    return `<div class="vg-caixa">${caixa(svg, tabela(rotulo, ['Valor'], passos.map((p) => [p.nome, [fmt(p.valor)]])))}</div>`;
  }

  // ---------- Heatmap ----------
  // linhas: [{ nome, vals[], attrs }]; colunas: [{ curto, longo }]; valor negativo puxa para o vermelho, positivo para o verde.
  function calor({ linhas = [], colunas = [], rotulo = '', fmt = rs } = {}) {
    if (!linhas.length || !colunas.length) return vazio();
    const todos = linhas.flatMap((l) => l.vals).filter((v) => v != null && Number.isFinite(v));
    const mx = Math.max(1, ...todos.map(Math.abs));
    const nivel = (v) => (v == null ? 'v' : v === 0 ? '0' : `${v > 0 ? 'p' : 'n'}${Math.min(4, Math.max(1, Math.ceil(Math.abs(v) / mx * 4)))}`);
    const cab = `<div class="vg-calor-l cab" aria-hidden="true"><span></span>${colunas.map((c) => `<span>${esc(c.curto)}</span>`).join('')}</div>`;
    const corpo = linhas.map((l) => `<div class="vg-calor-l"><${l.attrs ? `button type="button" ${l.attrs}` : 'span'} class="vg-calor-n">${esc(l.nome)}</${l.attrs ? 'button' : 'span'}>${l.vals.map((v, i) => `<span class="vg-cel c${nivel(v)}" data-tip="${esc(`${l.nome} · ${colunas[i].longo || colunas[i].curto}\n${v == null ? 'sem dado' : fmt(v)}`)}"></span>`).join('')}</div>`).join('');
    return `<div class="fe-hv vg-calor" style="--vg-cols:${colunas.length}" role="img" aria-label="${esc(rotulo)}">${cab}${corpo}<div class="fe-tip" hidden></div></div>
      <div class="vg-calor-esc" aria-hidden="true"><span>prejuízo</span><i class="vg-cel cn4"></i><i class="vg-cel cn2"></i><i class="vg-cel c0"></i><i class="vg-cel cp2"></i><i class="vg-cel cp4"></i><span>lucro</span></div>
      ${tabela(rotulo, colunas.map((c) => c.longo || c.curto), linhas.map((l) => [l.nome, l.vals.map((v) => (v == null ? '—' : fmt(v)))]))}`;
  }

  // ---------- Barras horizontais ----------
  // itens: [{ nome, valor, sub, attrs, tom: 'g' | 'r' }]
  function barrasH({ itens = [], rotulo = '', fmt = rs } = {}) {
    if (!itens.length) return vazio();
    const mx = Math.max(1, ...itens.map((i) => Math.abs(Number(i.valor) || 0)));
    const temNeg = itens.some((i) => Number(i.valor) < 0);
    return `<div class="fe-hv vg-bh${temNeg ? ' com-neg' : ''}" role="list" aria-label="${esc(rotulo)}">${itens.map((i) => { const v = Number(i.valor) || 0, w = Math.round(Math.abs(v) / mx * 100);
      return `<${i.attrs ? `button type="button" ${i.attrs}` : 'div'} class="vg-bh-l" role="listitem" data-tip="${esc(`${i.nome}\n${fmt(v)}${i.sub ? '\n' + i.sub : ''}`)}"><span class="vg-bh-n">${esc(i.nome)}</span>
        <span class="vg-bh-t"><i class="${v < 0 ? 'desce' : i.tom === 'r' ? 'desce' : 'sobe'}${v < 0 ? ' neg' : ''}" style="--v:${w}%"></i></span><b class="${v < 0 ? 'r' : ''}">${esc(mil(v))}</b></${i.attrs ? 'button' : 'div'}>`; }).join('')}<div class="fe-tip" hidden></div></div>`;
  }

  // A legenda esconde e mostra a série (no mesmo gráfico); nada é gravado.
  function aoClicarLegenda(ev) {
    const b = ev.target.closest?.('[data-vg-serie]'); if (!b) return;
    const caixaG = b.closest('.vg-caixa'); if (!caixaG) return;
    const liga = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(liga));
    caixaG.querySelectorAll(`[data-vg-s="${b.dataset.vgSerie}"]`).forEach((g) => g.classList.toggle('vg-some', !liga));
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', aoClicarLegenda);

  const api = Object.freeze({ linhaFaixa, area, rosca, barras, cascata, calor, barrasH, escala, rs, mil });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.VybeGraficos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
