// vybe-cerebro-grafo.js — o mapa do Cérebro do VYBES como um grafo vivo (Paulo, 08/11/2026: "é pra ser algo nessa linha"
// — o grafo do Obsidian — "com todo nosso fluxo: o VYBES, os agentes, todos os nós dos clientes, tudo que se conecta").
//
//   VybeCerebroGrafo.montar(elemento, { foco })   foco = nome de um cliente para centralizar e destacar (opcional)
//
// Os nós vêm do que o painel já tem, sem rota nova:
//   VYBES (centro) · agentes (planta do prédio, mundoVoxel.planta) · rotinas, módulos e fontes da central do VYBES
//   (CEREBRO_SINAPSES.dados, o mesmo mapa da aba Sinapses) · clientes ativos (CADASTRO_CLIENTES) · heads e responsáveis
//   (o time) · peças abertas (DADOS_ALL, clientesDoItem), com as atrasadas em vermelho.
// Ligações: VYBES → agentes, rotinas e clientes · ligações da central · cliente → heads · peça → clientes e responsáveis.
// Forças com árvore de quadrantes (Barnes-Hut) feitas aqui, sem dependência nova. A simulação assenta e PARA (AGENTS.md:
// nada de animação contínua); só volta a mexer quando a pessoa arrasta um nó ou muda uma força. Somente leitura.
(() => {
  'use strict';
  const GRUPOS = [
    { id: 'vybes', nome: 'VYBES', cor: '#F5F1EA' },
    { id: 'agente', nome: 'Agentes', cor: '#A78BFA' },
    { id: 'central', nome: 'Rotinas e módulos', cor: '#2DD4BF' },
    { id: 'cliente', nome: 'Clientes', cor: '#FF8A35' },
    { id: 'pessoa', nome: 'Time', cor: '#60A5FA' },
    { id: 'peca', nome: 'Peças abertas', cor: '#E8C547' },
    { id: 'atrasada', nome: 'Atrasadas', cor: '#F87171' },
  ];
  const COR = Object.fromEntries(GRUPOS.map((g) => [g.id, g.cor]));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const chave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const LIMITE_PECAS = 1400;

  // Preferências da pessoa (grupos visíveis, forças, tamanho): só no navegador.
  const PREF = 'vybe.cerebro.grafo';
  const pref = (() => { try { return JSON.parse(localStorage.getItem(PREF) || '{}'); } catch { return {}; } })();
  const st = {
    ocultos: new Set(pref.ocultos || []), repulsao: pref.repulsao ?? 60, distancia: pref.distancia ?? 38, centro: pref.centro ?? 30,
    tamanho: pref.tamanho ?? 100, linhas: pref.linhas ?? 100, rotulos: pref.rotulos ?? true, painel: pref.painel ?? true,
  };
  const guardar = () => { try { localStorage.setItem(PREF, JSON.stringify({ ...st, ocultos: [...st.ocultos] })); } catch { /* sem guardar */ } };
  const posicoes = new Map(); // id → {x, y}: remontar (a tela do cérebro repinta) continua de onde parou

  // ---------- Dados ----------
  function montarDados() {
    const nos = new Map(), ligs = [];
    const no = (id, grupo, nome, extra = {}) => { if (!nos.has(id)) nos.set(id, { id, grupo, nome: String(nome || id), grau: 0, ...extra }); return nos.get(id); };
    const liga = (a, b, peso = 1) => { if (a && b && a !== b && nos.has(a) && nos.has(b)) ligs.push({ a, b, peso }); };
    no('vybes', 'vybes', 'VYBES', { sub: 'a central e o assistente da Vybe' });
    // Agentes do prédio.
    try {
      for (const andar of window.mundoVoxel?.planta?.() || []) for (const s of andar.setores || []) {
        if (!s.agente) continue;
        no('ag:' + s.id, 'agente', s.agente, { sub: s.nome, setor: s.id }); liga('vybes', 'ag:' + s.id, 2);
      }
    } catch { /* sem prédio */ }
    // Rotinas, módulos e fontes da central (o mapa da aba Sinapses), quando a central responde.
    let central = null; try { central = typeof CEREBRO_SINAPSES !== 'undefined' ? CEREBRO_SINAPSES.dados : null; } catch { central = null; }
    if (central?.nos) {
      for (const n of central.nos) no('c:' + n.id, 'central', n.nome || n.titulo || n.id, { sub: n.tipo || '', motor: n.motor || '' });
      const entra = new Set();
      for (const l of central.ligacoes || []) { liga('c:' + l.de, 'c:' + l.para); entra.add('c:' + l.para); }
      for (const n of central.nos) if ((n.tipo === 'modulo' || n.tipo === 'rotina') && !entra.has('c:' + n.id)) liga('vybes', 'c:' + n.id);
      // A rotina que é de um agente liga no agente (pelo nome do agente no texto da rotina).
      const agentes = [...nos.values()].filter((x) => x.grupo === 'agente');
      for (const n of central.nos) { const t = chave(`${n.nome || ''} ${n.agente || ''} ${n.dono || ''}`); for (const a of agentes) if (chave(a.nome).length > 2 && t.includes(chave(a.nome))) liga(a.id, 'c:' + n.id); }
    }
    // Clientes ativos e os heads.
    const cad = typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : [];
    const porChave = new Map();
    for (const c of cad) {
      if (c.ativo === false || !c.nome) continue;
      const id = 'cl:' + chave(c.nome); porChave.set(chave(c.nome), id);
      no(id, 'cliente', c.nome, { sub: c.segmento || '', cliente: c.nome, carteira: typeof carteiraDoCliente === 'function' ? carteiraDoCliente(c.nome) : '' });
      liga('vybes', id, .4);
      const heads = Array.isArray(c.heads) ? c.heads : String(c.heads || '').split(/[,;]/);
      for (const h of heads.map((x) => String(x?.nome || x || '').trim()).filter(Boolean)) { const pid = 'p:' + chave(h); no(pid, 'pessoa', h, { sub: 'head' }); liga(id, pid, 1.5); }
    }
    // Peças abertas: ligam no(s) cliente(s) e em quem faz.
    const itens = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : [];
    const situacao = window.mundoVoxel?.situacaoDaPeca;
    let n = 0;
    for (const d of itens) {
      if (n >= LIMITE_PECAS) break;
      const sit = situacao ? situacao(d) : (/finaliz|feito|conclu/i.test(String(d.status || '')) ? 'concluida' : 'fazer');
      if (sit === 'concluida') continue;
      const clientes = typeof clientesDoItem === 'function' ? clientesDoItem(d) : [d.cliente].filter(Boolean);
      // Cliente que aparece nas peças sem ficha no cadastro ("só na operação") também vira nó.
      const ids = clientes.filter(Boolean).map((c) => { const k = chave(c); if (!porChave.has(k)) { const id = 'cl:' + k; porChave.set(k, id); no(id, 'cliente', c, { sub: 'só na operação (sem ficha no cadastro)', cliente: c }); liga('vybes', id, .4); } return porChave.get(k); });
      if (!ids.length) continue;
      n++;
      const pid = 'pc:' + d.id;
      no(pid, sit === 'atrasada' ? 'atrasada' : 'peca', d.nome || d.titulo || 'Peça', { sub: [clientes.join(', '), d.status].filter(Boolean).join(' · '), peca: d.id, status: d.status, statusCor: d.status_color });
      for (const c of ids) liga(pid, c);
      for (const r of String(d.responsavel || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean)) { const rid = 'p:' + chave(r); no(rid, 'pessoa', r); liga(pid, rid, .6); }
    }
    for (const l of ligs) { nos.get(l.a).grau++; nos.get(l.b).grau++; }
    return { nos: [...nos.values()], ligs };
  }

  // ---------- Forças (Barnes-Hut) ----------
  function quad(nos) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nos) { if (n.x < x0) x0 = n.x; if (n.y < y0) y0 = n.y; if (n.x > x1) x1 = n.x; if (n.y > y1) y1 = n.y; }
    const lado = Math.max(x1 - x0, y1 - y0, 1) + 2;
    const raiz = { x0: x0 - 1, y0: y0 - 1, l: lado, m: 0, cx: 0, cy: 0, filhos: null, no: null };
    const inserir = (q, n, prof = 0) => {
      if (!q.filhos && !q.no) { q.no = n; q.m = 1; q.cx = n.x; q.cy = n.y; return; }
      if (!q.filhos) {
        if (prof > 24) { q.m++; q.cx += (n.x - q.cx) / q.m; q.cy += (n.y - q.cy) / q.m; return; }
        const h = q.l / 2; q.filhos = [0, 1, 2, 3].map((i) => ({ x0: q.x0 + (i % 2) * h, y0: q.y0 + (i > 1 ? h : 0), l: h, m: 0, cx: 0, cy: 0, filhos: null, no: null }));
        const velho = q.no; q.no = null; q.m = 0; q.cx = 0; q.cy = 0; inserir(q, velho, prof);
      }
      const h = q.l / 2, i = (n.x >= q.x0 + h ? 1 : 0) + (n.y >= q.y0 + h ? 2 : 0);
      inserir(q.filhos[i], n, prof + 1);
      q.m++; q.cx += (n.x - q.cx) / q.m; q.cy += (n.y - q.cy) / q.m;
    };
    for (const n of nos) inserir(raiz, n);
    return raiz;
  }
  function repelir(q, n, forca, theta2 = .81) {
    if (!q.m || q.no === n) return;
    const dx = q.cx - n.x, dy = q.cy - n.y, d2 = dx * dx + dy * dy || .01;
    if (q.no || (q.l * q.l) / d2 < theta2) { const f = (forca * q.m) / d2; n.vx -= dx * f; n.vy -= dy * f; return; }
    if (q.filhos) for (const f of q.filhos) repelir(f, n, forca, theta2);
  }

  // ---------- Montar ----------
  function montar(alvo, opcoes = {}) {
    if (!alvo) return;
    alvo.__grafo?.parar?.();
    const { nos, ligs } = montarDados();
    const porId = new Map(nos.map((n) => [n.id, n]));
    const vizinhos = new Map(nos.map((n) => [n.id, new Set()]));
    for (const l of ligs) { vizinhos.get(l.a).add(l.b); vizinhos.get(l.b).add(l.a); }
    const raio = (n) => (n.grupo === 'vybes' ? 16 : n.grupo === 'cliente' ? 6 + Math.sqrt(n.grau) * .9 : n.grupo === 'agente' ? 8 : 2.6 + Math.sqrt(n.grau) * .8) * (st.tamanho / 100);
    // Posição inicial: a guardada, ou um anel por grupo (assenta mais rápido do que tudo no meio).
    const ANEL = { vybes: 0, agente: 70, central: 140, cliente: 230, pessoa: 300, peca: 380, atrasada: 380 };
    nos.forEach((n, i) => {
      const p = posicoes.get(n.id);
      if (p) { n.x = p.x; n.y = p.y; } else { const a = (i * 2.399963) % (Math.PI * 2), r = (ANEL[n.grupo] ?? 300) * (.85 + Math.random() * .3); n.x = Math.cos(a) * r; n.y = Math.sin(a) * r; }
      n.vx = 0; n.vy = 0;
    });
    const contagem = Object.fromEntries(GRUPOS.map((g) => [g.id, nos.filter((n) => n.grupo === g.id).length]));

    alvo.innerHTML = `<div class="cg">
      <canvas class="cg-tela" tabindex="0" aria-label="Grafo do Cérebro do VYBES: ${nos.length} nós e ${ligs.length} ligações. Arraste para mover, roda do mouse para zoom."></canvas>
      <div class="cg-busca"><input type="search" placeholder="Buscar no grafo (cliente, pessoa, peça, agente)…" aria-label="Buscar no grafo"><span class="cg-conta">${nos.length} nós · ${ligs.length} ligações</span></div>
      <aside class="cg-painel"${st.painel ? '' : ' data-fechado'}>
        <button type="button" class="cg-painel-alternar" data-cg="painel" aria-expanded="${st.painel}">${st.painel ? 'Esconder controles' : 'Controles'}</button>
        <div class="cg-painel-corpo">
          <details open><summary>Grupos</summary>${GRUPOS.map((g) => `<label class="cg-grupo"><input type="checkbox" data-cg-grupo="${g.id}"${st.ocultos.has(g.id) ? '' : ' checked'}><i style="--c:${g.cor}"></i><span>${g.nome}</span><small>${contagem[g.id] || 0}</small></label>`).join('')}</details>
          <details open><summary>Exibição</summary>
            <label class="cg-faixa"><span>Tamanho dos nós</span><input type="range" min="50" max="200" value="${st.tamanho}" data-cg-faixa="tamanho"></label>
            <label class="cg-faixa"><span>Espessura das ligações</span><input type="range" min="20" max="300" value="${st.linhas}" data-cg-faixa="linhas"></label>
            <label class="cg-grupo"><input type="checkbox" data-cg="rotulos"${st.rotulos ? ' checked' : ''}><span>Nomes dos nós</span></label></details>
          <details><summary>Forças</summary>
            <label class="cg-faixa"><span>Repulsão</span><input type="range" min="10" max="200" value="${st.repulsao}" data-cg-faixa="repulsao"></label>
            <label class="cg-faixa"><span>Distância das ligações</span><input type="range" min="10" max="120" value="${st.distancia}" data-cg-faixa="distancia"></label>
            <label class="cg-faixa"><span>Força do centro</span><input type="range" min="0" max="100" value="${st.centro}" data-cg-faixa="centro"></label>
            <button type="button" class="cg-botao" data-cg="reorganizar">Reorganizar</button></details>
        </div>
      </aside>
      <div class="cg-zoom"><button type="button" data-cg="mais" aria-label="Aproximar">+</button><button type="button" data-cg="menos" aria-label="Afastar">−</button><button type="button" data-cg="enquadrar">Enquadrar</button></div>
      <div class="cg-cartao" hidden></div>
      ${nos.length <= 1 ? '<p class="cg-vazio">Os nós aparecem quando o painel termina de carregar os clientes e as peças.</p>' : ''}
    </div>`;
    const raiz = alvo.querySelector('.cg'), tela = raiz.querySelector('canvas'), ctx = tela.getContext('2d'), cartao = raiz.querySelector('.cg-cartao');
    const cam = { x: 0, y: 0, k: .9 };
    let pendente = null, largura = 0, altura = 0, dpr = 1, alpha = 1, quadro = 0, sobre = null, fixo = null, arrastando = null, busca = '', sujo = true;
    const visivel = (n) => !st.ocultos.has(n.grupo);
    const ajustar = () => {
      const r = raiz.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      largura = r.width; altura = r.height; tela.width = Math.round(largura * dpr); tela.height = Math.round(altura * dpr);
      tela.style.width = largura + 'px'; tela.style.height = altura + 'px'; sujo = true;
      // O primeiro enquadramento espera a área ter tamanho (montada escondida, ela nasce com largura zero).
      if (pendente && largura > 0 && altura > 0) { const f = pendente; pendente = null; f(); }
      pedir();
    };
    const mundo = (sx, sy) => ({ x: (sx - largura / 2) / cam.k + cam.x, y: (sy - altura / 2) / cam.k + cam.y });
    // Uma iteração das forças. alpha cai até parar.
    function passo() {
      const vis = nos.filter(visivel);
      const q = quad(vis), rep = st.repulsao * 1.6 * alpha;
      for (const n of vis) repelir(q, n, rep * (n.grupo === 'peca' || n.grupo === 'atrasada' ? .35 : n.grupo === 'pessoa' ? .8 : 1.6));
      const dist = st.distancia;
      for (const l of ligs) {
        const a = porId.get(l.a), b = porId.get(l.b); if (!visivel(a) || !visivel(b)) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || .01;
        // Distância por tipo: peça cola no cliente (o "cacho" de cada conta); cliente e agentes orbitam o VYBES de longe.
        const pequeno = (x) => x.grupo === 'peca' || x.grupo === 'atrasada';
        const fator = a.grupo === 'vybes' || b.grupo === 'vybes' ? (a.grupo === 'cliente' || b.grupo === 'cliente' ? 3.2 : 2.2) : pequeno(a) || pequeno(b) ? (a.grupo === 'pessoa' || b.grupo === 'pessoa' ? 2.2 : .55) : 1.4;
        const alvoD = dist * fator + raio(a) + raio(b);
        // Força como no d3: o nó com menos ligações é o que mais se mexe.
        const f = ((d - alvoD) / d) * .5 * alpha * Math.min(1.5, l.peso) / Math.min(a.grau, b.grau) ** .5;
        const vies = a.grau / (a.grau + b.grau);
        b.vx -= dx * f * vies; b.vy -= dy * f * vies; a.vx += dx * f * (1 - vies); a.vy += dy * f * (1 - vies);
      }
      const c = st.centro / 100 * .045 * alpha;
      for (const n of vis) {
        if (n === arrastando) { n.vx = n.vy = 0; continue; }
        if (n.grupo === 'vybes') { n.vx -= n.x * .2; n.vy -= n.y * .2; }
        n.vx -= n.x * c; n.vy -= n.y * c;
        n.vx *= .58; n.vy *= .58; n.x += n.vx; n.y += n.vy;
      }
      alpha *= .985;
    }
    function desenhar() {
      sujo = false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#16171C'; ctx.fillRect(0, 0, largura, altura);
      ctx.save(); ctx.translate(largura / 2, altura / 2); ctx.scale(cam.k, cam.k); ctx.translate(-cam.x, -cam.y);
      const foco = sobre || fixo, viz = foco ? vizinhos.get(foco.id) : null;
      const acende = (n) => !foco || n === foco || viz.has(n.id);
      const achado = busca ? (n) => chave(n.nome).includes(busca) : null;
      // Ligações
      ctx.lineWidth = (st.linhas / 100) * .7 / Math.max(.6, cam.k);
      for (const l of ligs) {
        const a = porId.get(l.a), b = porId.get(l.b); if (!visivel(a) || !visivel(b)) continue;
        const on = foco && (a === foco || b === foco);
        ctx.strokeStyle = on ? 'rgba(255,255,255,.55)' : foco ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.085)';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // Nós
      for (const n of nos) {
        if (!visivel(n)) continue;
        const r = raio(n), apagado = (foco && !acende(n)) || (achado && !achado(n));
        ctx.globalAlpha = apagado ? .14 : 1;
        ctx.fillStyle = COR[n.grupo];
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
        if (n === foco || (achado && achado(n))) { ctx.lineWidth = 2 / cam.k; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      // Nomes: os grandes sempre (com zoom), o foco e os vizinhos dele, e o que a busca achou.
      if (st.rotulos) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        for (const n of nos) {
          if (!visivel(n)) continue;
          const r = raio(n);
          const mostra = n === foco || (viz && viz.has(n.id)) || (achado && achado(n)) || n.grupo === 'vybes' || (n.grupo === 'agente' && cam.k > 1.1) || n.grupo === 'cliente' || (cam.k > 1.6 && r > 3.5) || cam.k > 2.6;
          if (!mostra || (foco && !acende(n) && !(achado && achado(n)))) continue;
          const tam = Math.max(9, Math.min(14, (n.grupo === 'vybes' ? 15 : n.grupo === 'cliente' || n.grupo === 'agente' ? 12 : 10.5))) / cam.k;
          ctx.font = `${n === foco ? 700 : 600} ${tam}px Inter, system-ui, sans-serif`;
          const texto = n.nome.length > 34 ? n.nome.slice(0, 32) + '…' : n.nome;
          ctx.fillStyle = 'rgba(22,23,28,.75)'; const w = ctx.measureText(texto).width;
          ctx.fillRect(n.x - w / 2 - 3 / cam.k, n.y + r + 3 / cam.k, w + 6 / cam.k, tam + 4 / cam.k);
          ctx.fillStyle = n === foco ? '#fff' : 'rgba(240,236,228,.88)';
          ctx.fillText(texto, n.x, n.y + r + 5 / cam.k);
        }
      }
      ctx.restore();
    }
    function laco() {
      quadro = 0;
      if (alpha > .02) { passo(); passo(); sujo = true; }
      if (sujo) desenhar();
      if (alpha > .02) pedir(); else for (const n of nos) posicoes.set(n.id, { x: n.x, y: n.y });
    }
    function pedir() { if (!quadro) quadro = requestAnimationFrame(laco); }
    function aquecer(a = .5) { alpha = Math.max(alpha, a); pedir(); }
    function enquadrar(lista = nos.filter(visivel)) {
      if (!lista.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of lista) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
      cam.x = (x0 + x1) / 2; cam.y = (y0 + y1) / 2; cam.k = Math.max(.15, Math.min(3, Math.min(largura / (x1 - x0 + 120), altura / (y1 - y0 + 120))));
      sujo = true; pedir();
    }
    const noEm = (sx, sy) => {
      const p = mundo(sx, sy); let melhor = null, md = Infinity;
      for (const n of nos) { if (!visivel(n)) continue; const r = raio(n) + 4 / cam.k, d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2; if (d < r * r && d < md) { md = d; melhor = n; } }
      return melhor;
    };
    function mostrarCartao(n) {
      if (!n) { cartao.hidden = true; return; }
      const g = GRUPOS.find((x) => x.id === n.grupo), viz = [...vizinhos.get(n.id)].map((id) => porId.get(id));
      const porGrupo = GRUPOS.map((x) => [x, viz.filter((v) => v.grupo === x.id).length]).filter(([, c]) => c);
      const acao = n.grupo === 'cliente' ? `<button type="button" class="cg-botao principal" data-cg-abrir="cliente">Abrir o cliente</button>`
        : n.peca ? `<button type="button" class="cg-botao principal" data-cg-abrir="peca">Abrir a peça</button>`
        : n.grupo === 'agente' ? `<button type="button" class="cg-botao principal" data-cg-abrir="agente">Ver os agentes</button>` : '';
      cartao.innerHTML = `<div class="cg-cartao-topo"><i style="--c:${g.cor}"></i><span><small>${esc(g.nome)}</small><b>${esc(n.nome)}</b></span><button type="button" class="cg-x" data-cg="fechar-cartao" aria-label="Fechar">×</button></div>
        ${n.sub ? `<p>${esc(n.sub)}</p>` : ''}<p class="cg-ligado">${viz.length} ligações${porGrupo.length ? ': ' + porGrupo.map(([x, c]) => `${c} ${esc(x.nome.toLowerCase())}`).join(' · ') : ''}</p>${acao}`;
      cartao.hidden = false;
    }
    // Interação
    let toque = null;
    tela.addEventListener('pointerdown', (e) => {
      const r = tela.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, n = noEm(sx, sy);
      tela.setPointerCapture(e.pointerId);
      toque = { sx, sy, cx: cam.x, cy: cam.y, n, moveu: false };
      if (n) { arrastando = n; aquecer(.3); }
    });
    tela.addEventListener('pointermove', (e) => {
      const r = tela.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      if (toque) {
        if (Math.abs(sx - toque.sx) + Math.abs(sy - toque.sy) > 3) toque.moveu = true;
        if (arrastando) { const p = mundo(sx, sy); arrastando.x = p.x; arrastando.y = p.y; aquecer(.25); }
        else { cam.x = toque.cx - (sx - toque.sx) / cam.k; cam.y = toque.cy - (sy - toque.sy) / cam.k; sujo = true; pedir(); }
        return;
      }
      const n = noEm(sx, sy);
      if (n !== sobre) { sobre = n; tela.style.cursor = n ? 'pointer' : 'grab'; sujo = true; pedir(); }
    });
    const soltar = () => {
      if (toque && !toque.moveu) { fixo = toque.n && toque.n !== fixo ? toque.n : null; mostrarCartao(fixo); sujo = true; pedir(); }
      if (arrastando) posicoes.set(arrastando.id, { x: arrastando.x, y: arrastando.y });
      toque = null; arrastando = null;
    };
    tela.addEventListener('pointerup', soltar); tela.addEventListener('pointercancel', soltar);
    tela.addEventListener('pointerleave', () => { if (!toque && sobre) { sobre = null; sujo = true; pedir(); } });
    tela.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = tela.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, antes = mundo(sx, sy);
      cam.k = Math.max(.12, Math.min(5, cam.k * Math.exp(-e.deltaY * .0015)));
      const depois = mundo(sx, sy); cam.x += antes.x - depois.x; cam.y += antes.y - depois.y; sujo = true; pedir();
    }, { passive: false });
    tela.addEventListener('keydown', (e) => {
      if (e.key === '+' || e.key === '=') { cam.k = Math.min(5, cam.k * 1.25); sujo = true; pedir(); }
      else if (e.key === '-') { cam.k = Math.max(.12, cam.k * .8); sujo = true; pedir(); }
      else if (e.key === 'Escape' && fixo) { e.stopPropagation(); fixo = null; mostrarCartao(null); sujo = true; pedir(); }
    });
    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const a = b.dataset.cg;
      if (a === 'mais') { cam.k = Math.min(5, cam.k * 1.25); sujo = true; pedir(); }
      else if (a === 'menos') { cam.k = Math.max(.12, cam.k * .8); sujo = true; pedir(); }
      else if (a === 'enquadrar') enquadrar();
      else if (a === 'reorganizar') { posicoes.clear(); nos.forEach((n, i) => { const ang = (i * 2.399963) % (Math.PI * 2), rr = (ANEL[n.grupo] ?? 300); n.x = Math.cos(ang) * rr; n.y = Math.sin(ang) * rr; }); aquecer(1); setTimeout(() => enquadrar(), 1600); }
      else if (a === 'fechar-cartao') { fixo = null; mostrarCartao(null); sujo = true; pedir(); }
      else if (a === 'painel') { st.painel = !st.painel; guardar(); raiz.querySelector('.cg-painel').toggleAttribute('data-fechado', !st.painel); b.setAttribute('aria-expanded', String(st.painel)); b.textContent = st.painel ? 'Esconder controles' : 'Controles'; }
      else if (b.dataset.cgAbrir && fixo) {
        if (b.dataset.cgAbrir === 'cliente') { if (typeof focarClienteNoCerebro === 'function') focarClienteNoCerebro(fixo.cliente); else if (typeof abrirClienteDetalhe === 'function') abrirClienteDetalhe(fixo.cliente); }
        else if (b.dataset.cgAbrir === 'peca' && typeof openItemWorkspace === 'function') openItemWorkspace(fixo.peca);
        else if (b.dataset.cgAbrir === 'agente') window.VybeAgentes?.abrir?.();
      }
    });
    raiz.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.cgGrupo) { t.checked ? st.ocultos.delete(t.dataset.cgGrupo) : st.ocultos.add(t.dataset.cgGrupo); guardar(); aquecer(.3); sujo = true; }
      else if (t.dataset.cg === 'rotulos') { st.rotulos = t.checked; guardar(); sujo = true; pedir(); }
    });
    raiz.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.cgFaixa) { st[t.dataset.cgFaixa] = Number(t.value); guardar(); if (['repulsao', 'distancia', 'centro'].includes(t.dataset.cgFaixa)) aquecer(.4); sujo = true; pedir(); }
      else if (t.type === 'search') {
        busca = chave(t.value); sujo = true; pedir();
        const achados = busca ? nos.filter((n) => visivel(n) && chave(n.nome).includes(busca)) : [];
        if (achados.length && achados.length <= 30) enquadrar(achados.flatMap((n) => [n, ...[...vizinhos.get(n.id)].map((id) => porId.get(id))]));
      }
    });
    const obs = new ResizeObserver(ajustar); obs.observe(raiz);
    ajustar();
    // Primeiro enquadramento depois de assentar um pouco; com foco num cliente, a vizinhança dele.
    const novo = nos.some((n) => !posicoes.has(n.id));
    if (novo) { alpha = 1; for (let i = 0; i < 260; i++) passo(); }
    else alpha = .05;
    const focoN = opcoes.foco ? porId.get('cl:' + chave(opcoes.foco)) : null;
    const primeiro = focoN ? () => { fixo = focoN; mostrarCartao(focoN); enquadrar([focoN, ...[...vizinhos.get(focoN.id)].map((id) => porId.get(id))]); } : () => enquadrar();
    if (largura > 0 && altura > 0) primeiro(); else pendente = primeiro;
    pedir();
    alvo.__grafo = { parar: () => { cancelAnimationFrame(quadro); quadro = 0; obs.disconnect(); for (const n of nos) posicoes.set(n.id, { x: n.x, y: n.y }); } };
  }

  window.VybeCerebroGrafo = Object.freeze({ montar, GRUPOS });
})();
