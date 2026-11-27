// vybe-relatorio.js — o relatório técnico de cada módulo, em PDF (botão "Gerar relatório" no cabeçalho do módulo).
//
// Paulo, 26/11/2026: "quero isso pra todos os módulos: um botão de gerar um PDF daquele módulo, inteligente, com tudo
// DELE. Um relatório técnico com informações, dados, gráficos, projeções, relatório do que fazer, o porquê de tudo."
//
// O motor fica aqui; cada módulo registra o dele num arquivo vybe-relatorio-<modulo>.js (só leitura: o que o módulo já
// carrega ou as rotas que já existem). O texto sai de regras aplicadas aos números, nunca de modelo pago. Imprimir é do
// navegador: o documento A4 abre num iframe próprio e chama a impressão ("Salvar como PDF"). Nada é gravado nem enviado.
//
// ── Contrato (estável: a frente de Finanças registra o dela, vybe-relatorio-financas.js, com o mesmo) ──────────────
//   VybeRelatorio.registrar(modulo, fn, opcoes?)
//     modulo  'producao', 'clientes'…: a chave do relatório.
//     opcoes  { nome: 'Produção', telas: ['setor:producao', 'gestor'], agente: { nome: 'Heitor', papel: 'Coordenação de
//              produção' }, acesso: 'todos' | 'donos' | 'dinheiro' }
//             telas = os ids do dock (data-submodulo / data-trilho / data-visao-setor) em que o botão aparece; sem telas,
//             vale [modulo]. acesso = quem vê o botão: todos, os donos (e a coordenação), ou só os quatro donos (dinheiro).
//     fn(ctx) → (ou Promise de) {
//       titulo, periodo?, agente?: { nome, papel },
//       resumo: 'frase' | ['3 a 5 frases do agente'],
//       numeros: [{ rotulo, valor, variacao?: { texto, bom: true|false|null }, porque, dinheiro?, soDonos? }],
//       secoes: [{ titulo, texto: 'parágrafo' | [...], lista?: [...], grafico?: { tipo, ... }, graficos?: [...],
//                 tabela?: { colunas: ['A', { rotulo: 'R$', dinheiro: true }], linhas: [[...]], nota }, dinheiro?, soDonos? }],
//       historico?: { texto, grafico, tabela },            → "Histórico e tendência"
//       projecao?: { texto, grafico, tabela },             → "Projeção" (só quando houver)
//       recomendacoes: [{ o_que, por_que, impacto, prioridade: 'alta' | 'media' | 'baixa', dinheiro?, soDonos? }],
//       metodologia?: 'texto' | [...],
//       fontes: [{ nome, detalhe, lido_em? }]               → o motor junta as leituras feitas por ctx.api
//     }
//     ctx = { periodo, hoje, acesso: { dono, dinheiro, nome }, util, graficos, api(area, params) → json | null,
//             fonte(nome, detalhe), dados: { pecas(), demandas(), equipe(), clientes() } }
//     opcoes.abas (Paulo, 27/11/2026: "quero poder gerar o relatório em PDF de cada subaba… só o de Pessoas? só o de
//     Assinaturas?"): [{ id, nome, telas?: [...], seletor?: 'css' | () => bool, acesso?, agente?, dinheiro?,
//              alvos?: (ctx) → [{ id, nome }], alvoDaTela?: () → id }]
//             telas = os ids do dock em que a aba é a tela aberta; seletor = o que diz, no DOM, que ela está aberta (a aba
//             ativa de um trilho interno, um data-*); acesso = o nível da aba (nunca abaixo do módulo; dinheiro: true = só os
//             quatro donos); alvos = uma aba "cliente a cliente": a lista para escolher e, pela tela, o que está aberto.
//     Com aba, ctx.aba = { id, nome, alvo: { id, nome } | null } e a fn devolve o relatório SÓ daquela parte, completo
//     (números, gráficos, histórico, projeção quando houver, o que fazer e fontes), com `aba: ctx.aba.id` (sem isso o motor
//     recusa: aba que a fn não sabe montar não vira recorte do geral). O título e a capa saem "Finanças · Pessoas".
//   VybeRelatorio.gerar(modulo, { periodo: 'mes' | 'mes_passado' | '3m' | '6m' | '12m' | { inicio, fim }, aba?, alvo? })
//   VybeRelatorio.abas(modulo, acesso?) → as abas que a pessoa pode gerar; abaDaTela(modulo) → a aba aberta agora (ou null)
//   VybeRelatorio.documento(modulo, opcoes) → Promise<string HTML>   (o mesmo documento, sem imprimir: provas e testes)
//   VybeRelatorio.montar(relatorio, meta) → string HTML                (puro)
//   VybeRelatorio.filtrar(relatorio, acesso) → relatório sem o que a pessoa não vê (puro)
//   VybeRelatorio.periodo(chave, { hoje, inicio, fim }) → { inicio, fim, rotulo, meses, anterior } (puro)
// O relatório mensal do cliente (VybeRelatorio.abrir, vybe-mundo-relatorio.js) continua igual: este arquivo carrega
// depois dele e junta as duas coisas no mesmo window.VybeRelatorio.
//
// Acesso (a mesma regra do resto do sistema): dinheiro e salário só para os quatro donos (SO_DINHEIRO de vybe-mundo.js:
// sessão de dono e sem "ver como" outra pessoa); áreas trancadas (Comercial, Gestão…) para os donos e a coordenação.
// O que vem marcado `dinheiro: true` ou `soDonos: true` sai do documento de quem não pode ver, antes de montar.
// O servidor continua decidindo nas rotas: o relatório só lê o que a pessoa já leria na tela.
(function (raiz) {
  'use strict';
  const G = raiz;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
  const lista = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
  const pad = (n) => String(n).padStart(2, '0');
  const ISO = /^\d{4}-\d{2}-\d{2}$/;

  // ---------- Datas e contas (puras; os registros usam por ctx.util) ----------
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const diaLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const soDia = (v) => {
    const s = String(v ?? '');
    if (ISO.test(s.slice(0, 10)) && s.length <= 10) return s.slice(0, 10);
    if (!s) return '';
    const d = new Date(s); return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(d) : '';
  };
  const somarDias = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
  const somarMeses = (ym, n) => { const [a, m] = String(ym).slice(0, 7).split('-').map(Number); const t = a * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`; };
  const fimDoMes = (ym) => somarDias(`${somarMeses(ym, 1)}-01`, -1);
  const mesesEntre = (ini, fim) => { const out = []; for (let m = ini.slice(0, 7); m <= fim.slice(0, 7) && out.length < 60; m = somarMeses(m, 1)) out.push(m); return out; };
  const nomeMes = (ym, longo = false) => { const [a, m] = String(ym).split('-').map(Number); const n = MESES[(m || 1) - 1] || ''; return longo ? `${n} de ${a}` : `${n.slice(0, 3)}/${String(a).slice(2)}`; };
  const dataBr = (iso) => (ISO.test(String(iso).slice(0, 10)) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
  const dataCurta = (iso) => (ISO.test(String(iso).slice(0, 10)) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
  const num = (n, casas = 0) => (n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));
  const brl = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 }));
  const pct = (a, b) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 100) : null);
  const plural = (n, um, varios) => `${num(n)} ${Number(n) === 1 ? um : varios}`;
  const mediana = (l) => { const v = l.filter((n) => Number.isFinite(n)).sort((a, b) => a - b); if (!v.length) return null; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const media = (l) => { const v = l.filter((n) => Number.isFinite(n)); return v.length ? v.reduce((t, n) => t + n, 0) / v.length : null; };
  const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // Variação entre dois números. melhor = 'maior' (mais é bom), 'menor' (menos é bom) ou '' (neutro).
  function variacao(atual, anterior, melhor = 'maior', { unidade = '', contra = 'vs período anterior', pontos = false } = {}) {
    if (atual == null || anterior == null || !Number.isFinite(Number(atual)) || !Number.isFinite(Number(anterior))) return null;
    const a = Number(atual), b = Number(anterior), delta = a - b;
    const p = b !== 0 ? Math.round((delta / Math.abs(b)) * 100) : null;
    const direcao = delta > 0 ? 'sobe' : delta < 0 ? 'desce' : 'igual';
    const bom = direcao === 'igual' || !melhor ? null : (melhor === 'maior') === (delta > 0);
    const seta = direcao === 'sobe' ? '▲' : direcao === 'desce' ? '▼' : '=';
    const quanto = pontos ? `${delta > 0 ? '+' : ''}${num(delta)} p.p.` : p != null && Math.abs(b) >= 3 ? `${delta > 0 ? '+' : ''}${p}%` : `${delta > 0 ? '+' : ''}${num(delta, Number.isInteger(delta) ? 0 : 1)}${unidade}`;
    return { atual: a, anterior: b, delta, pct: p, direcao, bom, texto: direcao === 'igual' ? `= igual ${contra}` : `${seta} ${quanto} ${contra}` };
  }
  // Reta dos mínimos quadrados: inclinação por passo e o valor projetado k passos à frente (nunca negativo).
  function tendencia(valores) {
    const pts = valores.map((v, i) => [i, v]).filter(([, v]) => Number.isFinite(v));
    if (pts.length < 2) return { inclinacao: 0, base: pts[0]?.[1] ?? 0, n: pts.length, projetar: () => pts[0]?.[1] ?? null };
    const n = pts.length, sx = pts.reduce((t, p) => t + p[0], 0), sy = pts.reduce((t, p) => t + p[1], 0);
    const sxx = pts.reduce((t, p) => t + p[0] * p[0], 0), sxy = pts.reduce((t, p) => t + p[0] * p[1], 0);
    const inc = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1), base = (sy - inc * sx) / n;
    return { inclinacao: inc, base, n, projetar: (i) => Math.max(0, base + inc * i) };
  }
  function projetar(valores, passos = 3) { const t = tendencia(valores); return Array.from({ length: passos }, (_, k) => Math.round(t.projetar(valores.length + k) * 10) / 10); }
  // "Em alta", "em queda" ou "estável": compara a inclinação com a média (mais de 5% da média por passo conta).
  function tendenciaTexto(valores, { melhor = 'maior', coisa = '' } = {}) {
    const t = tendencia(valores), m = media(valores);
    if (t.n < 3 || !m) return { texto: `${coisa ? coisa + ': ' : ''}histórico curto para dizer a tendência`, sentido: 'curto', bom: null };
    const rel = t.inclinacao / Math.abs(m);
    const sentido = rel > 0.05 ? 'alta' : rel < -0.05 ? 'queda' : 'estavel';
    const bom = sentido === 'estavel' ? null : (sentido === 'alta') === (melhor === 'maior');
    const txt = sentido === 'estavel' ? 'estável' : `em ${sentido} (${rel > 0 ? '+' : ''}${Math.round(rel * 100)}% da média por mês)`;
    return { texto: `${coisa ? coisa + ': ' : ''}${txt}`, sentido, bom };
  }
  // Ritmo dentro de um intervalo: no passo de agora, quanto fecha no fim.
  function ritmo({ feito, inicio, fim, hoje }) {
    const total = diasEntre(inicio, fim) + 1, passados = Math.max(0, Math.min(total, diasEntre(inicio, hoje) + 1));
    if (!passados) return { projetado: null, passados, total, porDia: null };
    const porDia = feito / passados;
    return { projetado: Math.round(porDia * total), passados, total, porDia: Math.round(porDia * 10) / 10, restam: total - passados };
  }
  function contarPor(itens, chaveDe) {
    const m = new Map();
    for (const x of itens) for (const k of lista(chaveDe(x))) { if (k == null || k === '') continue; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'));
  }
  const porMes = (itens, dataDe, meses) => meses.map((m) => itens.filter((x) => String(dataDe(x) || '').slice(0, 7) === m).length);
  const dentro = (iso, per) => Boolean(iso) && iso >= per.inicio && iso <= per.fim;

  // ---------- Períodos ----------
  const PERIODOS = [['mes', 'Este mês'], ['mes_passado', 'Mês passado'], ['3m', 'Últimos 3 meses'], ['6m', 'Últimos 6 meses'], ['12m', 'Últimos 12 meses'], ['personalizado', 'Personalizado']];
  function periodo(chave = 'mes', { hoje = diaLocal(), inicio = '', fim = '' } = {}) {
    if (chave && typeof chave === 'object') { inicio = chave.inicio; fim = chave.fim; chave = 'personalizado'; }
    const ym = hoje.slice(0, 7); let ini, f, rotulo;
    if (chave === 'mes_passado') { ini = `${somarMeses(ym, -1)}-01`; f = fimDoMes(somarMeses(ym, -1)); rotulo = nomeMes(somarMeses(ym, -1), true); }
    else if (/^(3|6|12)m$/.test(chave)) { const k = Number(chave.slice(0, -1)); ini = `${somarMeses(ym, -(k - 1))}-01`; f = fimDoMes(ym); rotulo = `Últimos ${k} meses (${nomeMes(ini.slice(0, 7))} a ${nomeMes(ym)})`; }
    else if (chave === 'personalizado' && ISO.test(inicio) && ISO.test(fim)) { [ini, f] = inicio <= fim ? [inicio, fim] : [fim, inicio]; rotulo = `${dataBr(ini)} a ${dataBr(f)}`; }
    else { chave = 'mes'; ini = `${ym}-01`; f = fimDoMes(ym); rotulo = nomeMes(ym, true); }
    const dias = diasEntre(ini, f) + 1;
    // O anterior tem o mesmo tamanho, logo antes. Período de meses inteiros compara com os meses de antes.
    const inteiro = ini.slice(8) === '01' && f === fimDoMes(f.slice(0, 7));
    const nM = mesesEntre(ini, f).length;
    const antIni = inteiro ? `${somarMeses(ini.slice(0, 7), -nM)}-01` : somarDias(ini, -dias), antFim = somarDias(ini, -1);
    return { chave, inicio: ini, fim: f, rotulo: rotulo.charAt(0).toUpperCase() + rotulo.slice(1), dias, meses: mesesEntre(ini, f), hoje,
      emCurso: hoje >= ini && hoje <= f, fechado: hoje > f, anterior: { inicio: antIni, fim: antFim, rotulo: inteiro && nM === 1 ? nomeMes(antIni.slice(0, 7), true) : `${dataBr(antIni)} a ${dataBr(antFim)}`, meses: mesesEntre(antIni, antFim) } };
  }

  const util = Object.freeze({ diaLocal, soDia, somarDias, diasEntre, somarMeses, fimDoMes, mesesEntre, nomeMes, dataBr, dataCurta, num, brl, pct, plural,
    mediana, media, semAcento, variacao, tendencia, projetar, tendenciaTexto, ritmo, contarPor, porMes, dentro, esc });

  // ---------- Cores do sistema ----------
  // Paulo, 26/11/2026: "os PDFs não deviam respeitar as regras de cores do sistema? principalmente dos status". O
  // documento não tem paleta própria. Status na cor da tela: a status_color das peças (a cor do quadro) e, sem ela, a do
  // catálogo que o pillHtml usa (corDeStatus, vybe-gestor.js). Pronta (Finalizado) na cor de pronto do sistema e "em
  // aberto"/"agendado" no tom claro dela, como na Semana do Hoje (padrao-v2/s-g.css). Cliente na cor da carteira
  // (carteiraDoCliente, vybe-core.js), pessoa na cor dela (TEAM_USERS[].color) e o resto nos tokens do padrão v2 do tema
  // claro, lidos da tela na hora de gerar (o papel é branco, qualquer que seja o tema de quem gera).
  //   Nos registros: série, fatia ou item com { status } | { cliente } | { pessoa } | { papel } (ou `cor` pronta); no
  //   gráfico, de: 'status' | 'cliente' | 'pessoa' pinta as fatias/itens pelo rótulo e linhasDe: 'pessoa' as linhas do
  //   heatmap; na tabela, coluna { rotulo, status: true } vira a pílula do status (cliente/pessoa: o ponto na cor).
  //   O relatório pode devolver `amostra` (as peças do período) para a cor do status; sem ela, vale tudo o que o painel
  //   carregou. A amostra não vai para o documento.
  const GR = () => G.VybeRelGraficos || null;
  const hexOk = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || '').trim()) ? String(c).trim().toUpperCase() : '');
  const tokensAtuais = () => GR()?.cores?.() || {};
  const misturar = (a, b, p) => (GR()?.misturar ? GR().misturar(a, b, p) : a);
  // Os tokens que o relatório usa (os nomes de VybeRelGraficos.TOKENS) e a variável de cada um na tela.
  const VARS = { tinta: '--d3-tinta', texto2: '--d3-texto2', apagado: '--d3-apagado', meta: '--d3-meta', borda: '--d3-borda', cartao: '--d3-cartao', folhaLeve: '--d3-folha-leve',
    acao: '--d3-acao', acaoTexto: '--d3-acao-texto', pronto: '--d3-pronto', perigo: '--d3-perigo', ajuste: '--d3-ajuste', ambar: '--d3-ambar', info: '--d3-info', agente: '--d3-agente',
    fumeTexto: '--d3-fume-texto', fumeTexto2: '--d3-fume-texto2', fumeApagado: '--d3-fume-apagado', fumeMeta: '--d3-fume-meta', cartVinicius: '--d3-cart-vinicius', cartEwerton: '--d3-cart-ewerton',
    feC1: '--fe-c1', feC2: '--fe-c2', feC3: '--fe-c3', feC4: '--fe-c4', feC5: '--fe-c5', feC6: '--fe-c6' };
  // "#abc", "#aabbcc", "rgb(…)" ou "rgba(…)" → #RRGGBB opaco (o que tem transparência sai misturado no branco do papel).
  function corOpaca(v) {
    const s = String(v || '').trim();
    if (/^#[0-9a-f]{3}$/i.test(s)) return `#${s.slice(1).split('').map((x) => x + x).join('')}`.toUpperCase();
    if (hexOk(s)) return hexOk(s);
    const m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
    if (!m) return '';
    let a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (!Number.isFinite(a)) a = 1;
    return `#${[m[1], m[2], m[3]].map((x) => Math.max(0, Math.min(255, Math.round(Number(x) * a + 255 * (1 - a)))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  }
  // Lê os tokens do tema claro numa sonda escondida (com a classe do Finanças, que guarda a paleta --fe-c*). Fora do
  // navegador, ou se não der para ler, volta vazio e valem os do VybeRelGraficos (o mesmo tema claro).
  function lerTokens() {
    if (typeof document === 'undefined' || !document.body || typeof getComputedStyle !== 'function') return {};
    const sonda = document.createElement('i');
    sonda.className = 'fe'; sonda.setAttribute('data-d3-tema', 'claro'); sonda.setAttribute('aria-hidden', 'true');
    sonda.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
    try {
      document.body.appendChild(sonda);
      const cs = getComputedStyle(sonda), out = {};
      for (const [k, v] of Object.entries(VARS)) { const c = corOpaca(cs.getPropertyValue(v)); if (c) out[k] = c; }
      return out;
    } catch { return {}; } finally { sonda.remove(); }
  }
  // A cor de um status: a status_color mais comum entre as peças da amostra com esse status; sem ela, a do catálogo do
  // painel (corDeStatus, o mesmo do pillHtml). Pronta (Finalizado e sinônimos, VybeDono.util.finalizado) sai sempre na
  // cor de pronto do sistema. '' quando não há cor conhecida: o gráfico cai no neutro.
  function corDoStatus(nome, amostra = []) {
    const k = semAcento(nome);
    if (!k) return '';
    const fin = G.VybeDono?.util?.finalizado;
    let pronta = k === 'finalizado';
    try { if (typeof fin === 'function') pronta = Boolean(fin(String(nome))); } catch { /* fica a regra simples */ }
    if (pronta) return hexOk(tokensAtuais().pronto) || '#11613A';
    const conta = new Map();
    for (const d of lista(amostra)) {
      if (!d || semAcento(d.status) !== k) continue;
      const c = hexOk(d.status_color); if (c) conta.set(c, (conta.get(c) || 0) + 1);
    }
    if (conta.size) return [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0];
    try { return corOpaca(typeof G.corDeStatus === 'function' ? G.corDeStatus(String(nome).trim())?.cor : ''); } catch { return ''; }
  }
  // Cliente: a cor da carteira do head (Vinícius ou Ewerton); sem carteira, o neutro. Sem a função da carteira, ''.
  function corDoCliente(nome) {
    let c = null;
    try { c = typeof G.carteiraDoCliente === 'function' ? G.carteiraDoCliente(String(nome || '')) : null; } catch { c = null; }
    if (c == null) return '';
    const T = tokensAtuais();
    return hexOk(c === 'vinicius' ? T.cartVinicius : c === 'ewerton' ? T.cartEwerton : T.meta);
  }
  // Pessoa: a cor dela na equipe (TEAM_USERS[].color), achada pelo id, pelo nome ou pelo primeiro nome.
  function corDaPessoaEm(equipe) {
    const porId = new Map(), porNome = new Map(), porPrimeiro = new Map();
    for (const p of lista(equipe)) {
      const c = corOpaca(p?.color || p?.cor); if (!c) continue;
      const n = semAcento(p.name || p.nome);
      if (p.id != null) porId.set(String(p.id), c);
      if (n) { porNome.set(n, c); const pr = n.split(/\s+/)[0]; if (!porPrimeiro.has(pr)) porPrimeiro.set(pr, c); }
    }
    return (x) => { if (x == null || x === '') return ''; const s = String(x), n = semAcento(s); return porId.get(s) || porNome.get(n) || porPrimeiro.get(n.split(/\s+/)[0]) || ''; };
  }
  // Papéis de série que não são um status do quadro: pronta, em aberto, atraso… nas cores de função do padrão.
  // fe1…fe6 = a paleta do Finanças (--fe-c1…c6), para o relatório do Finanças sair nas cores da tela dele.
  // "<papel>-claro" = o mesmo papel no tom claro (a faixa pessimista–otimista do Finanças, por exemplo).
  const PAPEIS = {
    pronto: (T) => T.pronto, aberto: (T) => misturar(T.pronto, T.cartao, 0.75), agendado: (T) => misturar(T.pronto, T.cartao, 0.75),
    atraso: (T) => T.perigo, perigo: (T) => T.perigo, risco: (T) => T.ambar, ajuste: (T) => T.ajuste, info: (T) => T.info, agente: (T) => T.agente,
    destaque: (T) => T.acao, neutro: (T) => T.fumeTexto2, neutro2: (T) => T.fumeMeta,
    fe1: (T) => T.feC1, fe2: (T) => T.feC2, fe3: (T) => T.feC3, fe4: (T) => T.feC4, fe5: (T) => T.feC5, fe6: (T) => T.feC6,
  };
  function corDoPapel(p) {
    const m = String(p || '').match(/^(.+?)-claro$/), f = PAPEIS[m ? m[1] : p];
    if (!f) return '';
    const T = tokensAtuais(), c = hexOk(f(T));
    return c && m ? misturar(c, T.cartao, 0.45) : c;
  }
  function cores({ amostra = [], equipe = [] } = {}) {
    const pessoa = corDaPessoaEm(equipe);
    return { status: (n, a) => corDoStatus(n, a ?? amostra), cliente: corDoCliente, pessoa, papel: corDoPapel, tokens: tokensAtuais };
  }
  // Põe a cor certa em cada série, fatia, item e célula marcada (puro: devolve cópia). O que já traz `cor` fica.
  function colorir(rel, c) {
    if (!rel || typeof rel !== 'object' || !c) return rel;
    const por = { status: (n) => c.status(n), cliente: c.cliente, pessoa: c.pessoa };
    const pinta = (x, de) => {
      if (!x || typeof x !== 'object' || hexOk(x.cor)) return x;
      const cor = x.status ? por.status(x.status) : x.cliente ? por.cliente(x.cliente) : x.pessoa ? por.pessoa(x.pessoa) : x.papel ? c.papel(x.papel) : de && por[de] ? por[de](x.rotulo ?? x.nome) : '';
      return cor ? { ...x, cor } : x;
    };
    const grafico = (g) => {
      if (!g || typeof g !== 'object') return g;
      const o = { ...g };
      if (Array.isArray(g.series)) o.series = g.series.map((s) => pinta(s));
      if (Array.isArray(g.fatias)) o.fatias = g.fatias.map((f) => pinta(f, g.de));
      if (Array.isArray(g.itens)) o.itens = g.itens.map((i) => pinta(i, g.de));
      if (Array.isArray(g.passos)) o.passos = g.passos.map((p) => pinta(p));
      if (por[g.linhasDe] && Array.isArray(g.linhas) && !Array.isArray(g.coresLinhas)) o.coresLinhas = g.linhas.map((l) => por[g.linhasDe](l) || '');
      if (g.papel && !hexOk(g.cor)) o.cor = c.papel(g.papel) || g.cor;
      return o;
    };
    const tabela = (t) => {
      if (!t || !Array.isArray(t.colunas)) return t;
      const tipos = t.colunas.map((k) => (k && typeof k === 'object' ? (k.status ? 'status' : k.cliente ? 'cliente' : k.pessoa ? 'pessoa' : '') : ''));
      if (!tipos.some(Boolean)) return t;
      return { ...t, linhas: lista(t.linhas).map((l) => (Array.isArray(l) ? l.map((v, i) => {
        if (!tipos[i] || v == null || typeof v === 'object') return v;
        const texto = String(v);
        // Vazio, traço ou mais de um nome na célula: sem cor (uma cor só não diria de quem é).
        if (!texto.trim() || texto.trim() === '—' || /,\s/.test(texto)) return v;
        const cor = por[tipos[i]](texto);
        return cor ? { texto, cor, tipo: tipos[i] } : v;
      }) : l)) };
    };
    const bloco = (b) => (b && typeof b === 'object' ? { ...b, ...(b.grafico ? { grafico: grafico(b.grafico) } : {}), ...(Array.isArray(b.graficos) ? { graficos: b.graficos.map(grafico) } : {}), ...(b.tabela ? { tabela: tabela(b.tabela) } : {}) } : b);
    return { ...rel, secoes: lista(rel.secoes).map(bloco), historico: rel.historico ? bloco(rel.historico) : rel.historico, projecao: rel.projecao ? bloco(rel.projecao) : rel.projecao };
  }

  // ---------- Acesso ----------
  function acessoAtual() {
    let dono = false, coord = false, verComo = '';
    try { dono = typeof souDonoDaSessao === 'function' && souDonoDaSessao(); } catch { dono = false; }
    try { coord = typeof souCoordenacaoDaSessao === 'function' && souCoordenacaoDaSessao(); } catch { coord = false; }
    try { verComo = G.sessionStorage?.getItem('vybe.verComo') || ''; } catch { verComo = ''; }
    let nome = '';
    try { nome = (typeof SESSAO_ATUAL !== 'undefined' && SESSAO_ATUAL?.nome) || ''; } catch { nome = ''; }
    // "Ver como" outra pessoa: a tela mostra o que ela veria, e o relatório também (sem dinheiro e sem área de dono).
    const vendoOutro = Boolean(verComo);
    return { dono: Boolean((dono || coord) && !vendoOutro), dinheiro: Boolean(dono && !vendoOutro), nome: String(nome || '').trim() };
  }
  const pode = (nivel, acesso) => (nivel === 'dinheiro' ? acesso.dinheiro : nivel === 'donos' ? acesso.dono : true);
  const vale = (x, acesso) => x && !(x.dinheiro && !acesso.dinheiro) && !(x.soDonos && !acesso.dono);
  // Tira do relatório o que a pessoa não vê: itens e colunas marcados com dinheiro/soDonos. Puro (devolve cópia).
  function filtrar(rel, acesso = { dono: false, dinheiro: false }) {
    if (!rel || typeof rel !== 'object') return rel;
    const tabela = (t) => {
      if (!t || !Array.isArray(t.colunas)) return t;
      const fica = t.colunas.map((c) => vale(typeof c === 'object' ? c : { rotulo: c }, acesso));
      return { ...t, colunas: t.colunas.filter((_, i) => fica[i]), linhas: (t.linhas || []).map((l) => (Array.isArray(l) ? l.filter((_, i) => fica[i]) : l)) };
    };
    const bloco = (b) => (b ? { ...b, tabela: tabela(b.tabela) } : b);
    return { ...rel,
      numeros: lista(rel.numeros).filter((x) => vale(x, acesso)),
      secoes: lista(rel.secoes).filter((x) => vale(x, acesso)).map(bloco),
      historico: vale(rel.historico || {}, acesso) ? bloco(rel.historico) : null,
      projecao: vale(rel.projecao || {}, acesso) ? bloco(rel.projecao) : null,
      recomendacoes: lista(rel.recomendacoes).filter((x) => vale(x, acesso)),
      fontes: lista(rel.fontes).filter((x) => vale(x, acesso)) };
  }

  // ---------- O documento (puro: relatório → HTML A4) ----------
  const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><rect width="22" height="22" rx="5" fill="#C2490C"/><path d="M6 6.5l5 9 5-9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const cssTexto = (s) => `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;
  const PRIORIDADE = { alta: ['Alta', 3], media: ['Média', 2], baixa: ['Baixa', 1] };
  const prioridadeDe = (p) => PRIORIDADE[semAcento(p)] ? semAcento(p) : 'media';

  function css(meta) {
    // As cores do papel são os tokens do padrão v2 (tema claro), os mesmos dos gráficos: nada escrito à mão aqui.
    const C = { ...(GR()?.TOKENS || {}), ...tokensAtuais(), ...(meta.cores || {}) };
    const veuAcao = GR()?.misturar ? GR().misturar(C.acao, '#FFFFFF', 0.05) : '#FBF6F2';
    const logo = `url("data:image/svg+xml;utf8,${encodeURIComponent(LOGO)}")`;
    return `@page{size:A4;margin:22mm 15mm 20mm 15mm;
  @top-left{content:${logo} "  " ${cssTexto(`Vybe · ${meta.modulo} · Relatório técnico`)};font:600 8pt Inter,Arial,sans-serif;color:${C.texto2};vertical-align:bottom;padding-bottom:4mm}
  @top-right{content:${cssTexto(meta.periodo)};font:500 8pt Inter,Arial,sans-serif;color:${C.apagado};vertical-align:bottom;padding-bottom:4mm}
  @bottom-left{content:${cssTexto(`Gerado em ${meta.geradoEm}${meta.geradoPor ? ` por ${meta.geradoPor}` : ''} · Vybe OS`)};font:400 7.5pt Inter,Arial,sans-serif;color:${C.apagado};vertical-align:top;padding-top:4mm}
  @bottom-right{content:"Página " counter(page) " de " counter(pages);font:600 7.5pt Inter,Arial,sans-serif;color:${C.texto2};vertical-align:top;padding-top:4mm}}
@page:first{@top-left{content:none}@top-right{content:none}}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#fff;color:${C.tinta};font:400 9.6pt/1.5 Inter,'Helvetica Neue',Arial,sans-serif;font-feature-settings:"tnum" 1,"cv11" 1}
.rel{max-width:180mm;margin:0 auto}
@media screen{body{background:#ECE8E1}.rel{background:#fff;padding:18mm 15mm;margin:12px auto;box-shadow:0 10px 30px -18px rgba(0,0,0,.4)}}
h1,h2,h3,h4{margin:0;font-weight:600;letter-spacing:-.01em;color:${C.tinta}}
p{margin:0 0 2.2mm}
.capa{min-height:247mm;display:flex;flex-direction:column;break-after:page;page-break-after:always}
.capa-marca{display:flex;align-items:center;gap:3mm;font:600 10pt Inter,Arial,sans-serif;letter-spacing:.02em}
.capa-marca svg{width:9mm;height:9mm}
.capa-tipo{margin-top:34mm;font-size:9pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${C.acaoTexto}}
.capa h1{font-size:30pt;line-height:1.08;margin-top:3mm;letter-spacing:-.025em}
.capa-sub{font-size:13pt;color:${C.texto2};margin-top:3mm}
.capa-linha{height:1.2mm;width:24mm;background:${C.acao};margin:9mm 0 7mm}
.capa-meta{display:grid;grid-template-columns:34mm 1fr;gap:2mm 6mm;font-size:9.5pt}
.capa-meta dt{color:${C.apagado}}.capa-meta dd{margin:0;font-weight:500}
.capa-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:14mm}
.capa-kpis div{border-top:.5mm solid ${C.tinta};padding-top:2.5mm}
.capa-kpis b{display:block;font-size:20pt;font-weight:600;letter-spacing:-.02em;line-height:1.1}
.capa-kpis span{font-size:8.5pt;color:${C.texto2}}
.capa-indice{margin-top:auto;font-size:8.8pt;color:${C.texto2};columns:2;column-gap:10mm;padding:0;list-style:none;counter-reset:ind}
.capa-indice li{counter-increment:ind;padding:1mm 0;border-bottom:.2mm solid ${C.borda};break-inside:avoid}
.capa-indice li::before{content:counter(ind) ".";display:inline-block;width:7mm;color:${C.acaoTexto};font-weight:600}
.capa-pe{margin-top:6mm;font-size:7.8pt;color:${C.apagado}}
.sec{margin:0 0 7mm}
.sec h2{font-size:14pt;display:flex;align-items:baseline;gap:3mm;padding-bottom:2mm;border-bottom:.3mm solid ${C.tinta};margin-bottom:4mm;break-after:avoid;page-break-after:avoid}
.sec h2 i{font-style:normal;font-size:9pt;color:${C.acaoTexto};font-weight:600;min-width:6mm}
.bloco,.bloco-livre{margin:0 0 5mm}.agente.bloco{break-inside:avoid;page-break-inside:avoid}
.junto{break-inside:avoid;page-break-inside:avoid}
.bloco>h3{font-size:11pt;margin-bottom:2mm;break-after:avoid}
.texto p{color:${C.tinta}}
.texto ul{margin:1mm 0 2.5mm;padding-left:5mm}.texto li{margin:.8mm 0}
.agente{display:flex;gap:4mm;align-items:flex-start;background:${veuAcao};border-left:1mm solid ${C.acao};padding:4mm 5mm;border-radius:0 2mm 2mm 0}
.agente-av{flex:none;width:9mm;height:9mm;border-radius:50%;background:${C.acao};color:#fff;display:grid;place-items:center;font-weight:700;font-size:11pt}
.agente small{display:block;font-size:8pt;color:${C.acaoTexto};font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin-bottom:1mm}
.agente p{font-size:10.2pt;line-height:1.55;color:${C.tinta};margin:0 0 1.6mm}
.kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:3.5mm}
.kpi{border:.25mm solid ${C.borda};border-radius:2mm;padding:3.2mm 4mm;break-inside:avoid}
.kpi small{display:block;font-size:8.2pt;color:${C.texto2};font-weight:500}
.kpi b{display:block;font-size:18pt;font-weight:600;letter-spacing:-.02em;line-height:1.2;margin:.6mm 0}
.var{display:inline-block;font-size:8pt;font-weight:600;padding:.3mm 1.6mm;border-radius:1mm;border:.25mm solid currentColor}
.var.bom{color:${C.pronto}}.var.ruim{color:${C.perigo}}.var.neutro{color:${C.texto2}}
.var.ruim::after{content:" (pior)";font-weight:500}.var.bom::after{content:" (melhor)";font-weight:500}
.kpi p{font-size:8.4pt;color:${C.texto2};margin:1.4mm 0 0;line-height:1.45}
figure{margin:2mm 0 3mm;break-inside:avoid;page-break-inside:avoid}
figure svg{width:100%;height:auto}
figcaption{font-size:7.8pt;color:${C.apagado};margin-top:1mm}
table{width:100%;border-collapse:collapse;font-size:8.4pt;margin:1mm 0 2mm}
thead{display:table-header-group}
th{text-align:left;font-weight:600;color:${C.texto2};font-size:7.8pt;text-transform:uppercase;letter-spacing:.03em;border-bottom:.35mm solid ${C.tinta};padding:1.4mm 2mm}
td{padding:1.5mm 2mm;border-bottom:.2mm solid ${C.borda};vertical-align:top}
tr{break-inside:avoid;page-break-inside:avoid}
td.n,th.n{text-align:right;white-space:nowrap}
.tabela-curta{break-inside:avoid;page-break-inside:avoid}
.nota{font-size:7.8pt;color:${C.apagado}}
.recs{counter-reset:rec}
.rec{display:grid;grid-template-columns:22mm 1fr;gap:4mm;padding:3mm 0;border-bottom:.25mm solid ${C.borda};break-inside:avoid;page-break-inside:avoid}
.prio{font-size:7.8pt;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.prio i{display:flex;gap:.8mm;margin-top:1mm}.prio i em{width:2.6mm;height:2.6mm;border-radius:50%;border:.3mm solid currentColor}
.prio i em.on{background:currentColor}
.prio.alta{color:${C.perigo}}.prio.media{color:${C.ambar}}.prio.baixa{color:${C.texto2}}
.rec h4{font-size:10.2pt;margin-bottom:1mm;counter-increment:rec}.rec h4::before{content:counter(rec) ". ";color:${C.acaoTexto}}
.rec dl{display:grid;grid-template-columns:16mm 1fr;gap:.8mm 3mm;margin:0;font-size:8.8pt}
.rec dt{color:${C.apagado}}.rec dd{margin:0;color:${C.tinta}}
.fontes{font-size:8.4pt}.fontes td:first-child{font-weight:500}
.vazio{color:${C.apagado};font-style:italic}
.st{display:inline-flex;align-items:center;gap:1.3mm;max-width:100%;padding:.3mm 2mm .3mm 1.6mm;border-radius:3mm;background:var(--st-veu);color:${C.tinta};font-weight:600;white-space:nowrap;line-height:1.4}
.pt{display:inline-flex;align-items:center;gap:1.3mm;max-width:100%}
.st i,.pt i{flex:none;width:1.7mm;height:1.7mm;border-radius:50%;background:var(--st)}
`;
  }
  function textoHtml(t) {
    const ps = lista(t).filter((x) => x != null && String(x).trim());
    return ps.map((p) => `<p>${esc(p)}</p>`).join('');
  }
  // A célula: texto, ou { texto, cor, tipo } posto pelo colorir (status = a pílula da tela; cliente e pessoa = o ponto).
  const textoDe = (v) => (v && typeof v === 'object' ? String(v.texto ?? '') : String(v ?? ''));
  function celulaHtml(v) {
    if (!v || typeof v !== 'object') return esc(v ?? '');
    const c = hexOk(v.cor);
    if (!c) return esc(v.texto ?? '');
    if (v.tipo === 'status') return `<span class="st" style="--st:${c};--st-veu:${misturar(c, '#FFFFFF', 0.16)}"><i></i>${esc(v.texto)}</span>`;
    return `<span class="pt" style="--st:${c}"><i></i>${esc(v.texto)}</span>`;
  }
  function tabelaHtml(t) {
    if (!t || !Array.isArray(t.colunas) || !t.colunas.length) return '';
    const cols = t.colunas.map((c) => (typeof c === 'object' ? c : { rotulo: String(c) }));
    const linhas = (t.linhas || []).filter(Array.isArray);
    const numerica = cols.map((c, i) => c.numero ?? (linhas.length > 0 && linhas.every((l) => l[i] == null || l[i] === '' || /^[\s−+\-–R$▲▼=]*[\d.,]+\s*(%|p\.p\.|h|d|dias?)?[\s▲▼]*$/.test(textoDe(l[i])))));
    const corpo = linhas.length ? linhas.map((l) => `<tr>${cols.map((_, i) => `<td${numerica[i] ? ' class="n"' : ''}>${celulaHtml(l[i])}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${cols.length}" class="vazio">${esc(t.vazio || 'Nada no período.')}</td></tr>`;
    return `<table class="${linhas.length <= 22 ? 'tabela-curta' : ''}"><thead><tr>${cols.map((c, i) => `<th${numerica[i] ? ' class="n"' : ''}>${esc(c.rotulo)}</th>`).join('')}</tr></thead><tbody>${corpo}</tbody></table>${t.nota ? `<p class="nota">${esc(t.nota)}</p>` : ''}`;
  }
  function graficoHtml(g, graficos) {
    if (!g || !graficos?.desenhar) return '';
    const svg = graficos.desenhar(g);
    return svg ? `<figure>${svg}${g.legenda ? `<figcaption>${esc(g.legenda)}</figcaption>` : ''}</figure>` : '';
  }
  // O título do capítulo, o texto e o primeiro gráfico (ou a tabela curta) ficam juntos numa página; o resto pode seguir na
  // próxima, sem partir gráfico nem tabela curta (a longa quebra entre linhas e repete o cabeçalho).
  function blocoHtml(b, graficos, cabeca = '') {
    if (!b) return '';
    const texto = `<div class="texto">${textoHtml(b.texto)}${lista(b.lista).length ? `<ul>${lista(b.lista).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
    const figs = [graficoHtml(b.grafico, graficos), ...lista(b.graficos).map((g) => graficoHtml(g, graficos))].filter(Boolean);
    const tab = tabelaHtml(b.tabela), curta = (b.tabela?.linhas || []).length <= 12;
    const junto = figs.length ? [figs.shift()] : tab && curta ? [tab] : [];
    const resto = [...figs, junto.includes(tab) ? '' : tab];
    return `<div class="bloco"><div class="junto">${cabeca}${b.titulo ? `<h3>${esc(b.titulo)}</h3>` : ''}${texto}${junto.join('')}</div>${resto.join('')}</div>`;
  }
  function montar(rel, meta = {}) {
    const r = rel || {};
    const graficos = meta.graficos || G.VybeRelGraficos;
    const m = { modulo: meta.modulo || r.titulo || 'Módulo', periodo: meta.periodo || r.periodo || '', geradoEm: meta.geradoEm || '', geradoPor: meta.geradoPor || '' };
    const agente = r.agente || meta.agente || null;
    const numeros = lista(r.numeros), secoes = lista(r.secoes).filter(Boolean);
    const recs = lista(r.recomendacoes).filter((x) => x && x.o_que).map((x, i) => ({ ...x, p: prioridadeDe(x.prioridade), i }))
      .sort((a, b) => PRIORIDADE[b.p][1] - PRIORIDADE[a.p][1] || a.i - b.i);
    const capitulos = [];
    let n = 0;
    const cap = (titulo, corpo) => { if (!corpo) return; n += 1; const h2 = `<h2><i>${n}</i>${esc(titulo)}</h2>`; capitulos.push({ titulo, html: `<section class="sec">${typeof corpo === 'function' ? corpo(h2) : h2 + corpo}</section>` }); };
    const resumo = lista(r.resumo).filter((x) => String(x || '').trim());
    cap('Resumo executivo', resumo.length ? `<div class="agente bloco"><span class="agente-av" aria-hidden="true">${esc((agente?.nome || 'V').charAt(0))}</span><div><small>${esc(agente ? `${agente.nome} · ${agente.papel || ''}` : 'Resumo')}</small>${resumo.map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>` : '');
    cap('Números-chave', numeros.length ? `<div class="kpis">${numeros.map((x) => {
      const v = x.variacao, tom = v ? (v.bom === true ? 'bom' : v.bom === false ? 'ruim' : 'neutro') : '';
      return `<div class="kpi"><small>${esc(x.rotulo)}</small><b>${esc(x.valor ?? '—')}</b>${v?.texto ? `<span class="var ${tom}">${esc(v.texto)}</span>` : ''}${x.porque ? `<p>${esc(x.porque)}</p>` : ''}</div>`;
    }).join('')}</div>` : '');
    for (const s of secoes) cap(s.titulo || 'Análise', (h2) => blocoHtml({ ...s, titulo: s.subtitulo || '' }, graficos, h2));
    if (r.historico) cap('Histórico e tendência', (h2) => blocoHtml({ ...r.historico, titulo: '' }, graficos, h2));
    if (r.projecao) cap('Projeção', (h2) => blocoHtml({ ...r.projecao, titulo: '' }, graficos, h2));
    cap('O que fazer', recs.length ? `<div class="recs">${recs.map((x) => {
      const [rot, nivel] = PRIORIDADE[x.p];
      return `<div class="rec"><div class="prio ${x.p}">${rot}<i aria-hidden="true">${[1, 2, 3].map((k) => `<em class="${k <= nivel ? 'on' : ''}"></em>`).join('')}</i></div><div><h4>${esc(x.o_que)}</h4><dl>${x.por_que ? `<dt>Por quê</dt><dd>${esc(x.por_que)}</dd>` : ''}${x.impacto ? `<dt>Impacto</dt><dd>${esc(x.impacto)}</dd>` : ''}</dl></div></div>`;
    }).join('')}</div>` : '<p class="vazio">Nada pede ação neste período pelos números lidos.</p>');
    const fontes = lista(r.fontes).filter((f) => f && f.nome);
    cap('Metodologia e fontes', `${textoHtml(r.metodologia)}${fontes.length ? `<table class="fontes tabela-curta"><thead><tr><th>Fonte</th><th>O que veio dela</th><th>Lido em</th></tr></thead><tbody>${fontes.map((f) => `<tr><td>${esc(f.nome)}</td><td>${esc(f.detalhe || '')}</td><td>${esc(f.lido_em || m.geradoEm)}</td></tr>`).join('')}</tbody></table>` : ''}<p class="nota">Texto montado por regras sobre os números (sem modelo de IA pago). Números de agora mudam com o andamento das peças; o que vale é o lido na hora da geração.</p>`);
    const kpisCapa = numeros.slice(0, 3);
    const capa = `<section class="capa"><div class="capa-marca">${LOGO}<span>Vybe</span></div>
      <div class="capa-tipo">Relatório técnico</div><h1>${esc(r.titulo || m.modulo)}</h1>${r.subtitulo ? `<div class="capa-sub">${esc(r.subtitulo)}</div>` : ''}
      <div class="capa-linha"></div>
      <dl class="capa-meta"><dt>Período</dt><dd>${esc(m.periodo)}</dd>${agente ? `<dt>Análise</dt><dd>${esc(agente.nome)} · ${esc(agente.papel || '')}</dd>` : ''}<dt>Gerado em</dt><dd>${esc(m.geradoEm)}</dd>${m.geradoPor ? `<dt>Por</dt><dd>${esc(m.geradoPor)}</dd>` : ''}</dl>
      ${kpisCapa.length ? `<div class="capa-kpis">${kpisCapa.map((x) => `<div><b>${esc(x.valor ?? '—')}</b><span>${esc(x.rotulo)}</span></div>`).join('')}</div>` : ''}
      <ol class="capa-indice">${capitulos.map((c) => `<li>${esc(c.titulo)}</li>`).join('')}</ol>
      <p class="capa-pe">Vybe · Irecê-BA · documento interno, gerado pelo Vybe OS a partir dos dados do sistema.</p></section>`;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(`Relatório ${m.modulo} · ${m.periodo}`)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>${css(m)}</style></head><body><main class="rel">${capa}${capitulos.map((c) => c.html).join('')}</main></body></html>`;
  }

  // ---------- Registro e geração ----------
  const REG = new Map();
  function registrar(modulo, fn, opcoes = {}) {
    const id = String(modulo || '').trim();
    if (!id || typeof fn !== 'function') return false;
    const telas = lista(opcoes.telas).map(String).filter(Boolean);
    const acesso = ['donos', 'dinheiro'].includes(opcoes.acesso) ? opcoes.acesso : 'todos';
    REG.set(id, { id, fn, nome: opcoes.nome || id, telas: telas.length ? telas : [id], agente: opcoes.agente || null, acesso, abas: normalizarAbas(opcoes.abas, acesso) });
    agendarBotao();
    return true;
  }
  // As subabas do registro: id e nome obrigatórios; o acesso da aba nunca fica abaixo do módulo (dinheiro > donos > todos).
  const NIVEL = { todos: 0, donos: 1, dinheiro: 2 };
  function normalizarAbas(abas, acessoModulo) {
    const vistos = new Set();
    return lista(abas).map((a) => {
      const id = String(a?.id || '').trim(), nome = String(a?.nome || '').trim();
      if (!id || !nome || vistos.has(id)) return null;
      vistos.add(id);
      const pedido = a.dinheiro ? 'dinheiro' : ['donos', 'dinheiro'].includes(a.acesso) ? a.acesso : 'todos';
      return { id, nome, telas: lista(a.telas).map(String).filter(Boolean), seletor: typeof a.seletor === 'function' || typeof a.seletor === 'string' ? a.seletor : null,
        acesso: NIVEL[pedido] >= NIVEL[acessoModulo] ? pedido : acessoModulo, agente: a.agente || null,
        alvos: typeof a.alvos === 'function' ? a.alvos : null, rotuloAlvo: String(a.rotuloAlvo || ''), alvoDaTela: typeof a.alvoDaTela === 'function' ? a.alvoDaTela : null };
    }).filter(Boolean);
  }
  const registrado = (modulo) => REG.has(String(modulo));
  const moduloDaTela = (tela) => [...REG.values()].find((r) => r.telas.includes(String(tela))) || null;
  function abasDe(modulo, acesso = acessoAtual()) {
    const reg = REG.get(String(modulo));
    return reg ? reg.abas.filter((a) => pode(a.acesso, acesso)).map((a) => ({ id: a.id, nome: a.nome, acesso: a.acesso, telas: [...a.telas], porAlvo: Boolean(a.alvos) })) : [];
  }
  // A aba aberta agora: primeiro a que o DOM confirma (seletor, e a tela do dock quando ela diz qual), depois a que só a
  // tela do dock aponta. Sem DOM (testes) ou sem nada que bata, null: o menu marca "Módulo inteiro".
  function confere(seletor) {
    try { return typeof seletor === 'function' ? Boolean(seletor()) : typeof document !== 'undefined' && Boolean(document.querySelector(seletor)); } catch { return false; }
  }
  function abaDaTela(modulo, tela = telaDoDock()) {
    const reg = REG.get(String(modulo)); if (!reg || !reg.abas.length) return null;
    const naTela = (a) => !a.telas.length || a.telas.includes(String(tela));
    return reg.abas.find((a) => a.seletor && naTela(a) && confere(a.seletor)) || reg.abas.find((a) => !a.seletor && a.telas.includes(String(tela))) || null;
  }
  // Aba por alvo (um cliente, uma conta): o nome do alvo no lugar do nome da aba ("Clientes · Academia Lions").
  const rotuloDaAba = (reg, aba, alvo) => [reg.nome, alvo?.nome || aba?.nome].filter(Boolean).join(' · ');

  // Os globais do painel (let no escopo dos scripts clássicos): lidos pelo nome, sem eval; fora do navegador ficam vazios.
  const dadosDaTela = {
    pecas: () => {
      if (typeof unifiedOperationalItems === 'function') { try { return lista(unifiedOperationalItems()).filter((d) => !(typeof isRequestItem === 'function' && isRequestItem(d))); } catch { /* cai para DADOS_ALL */ } }
      return lista(typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : null);
    },
    demandas: () => lista(typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : null),
    equipe: () => lista(typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : null),
    clientes: () => lista(typeof CADASTRO_CLIENTES !== 'undefined' ? CADASTRO_CLIENTES : null),
  };
  async function lerApi(area, params = {}, leituras = []) {
    // leitura=1 em toda leitura do relatório: as rotas que gravam algo ao abrir a tela (Impressões anda a arte, Séries grava
    // o dia) só leem quando o pedido vem daqui. O relatório nunca grava.
    const q = new URLSearchParams({ area, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')), leitura: '1' });
    const em = new Date();
    try {
      const r = await fetch(`/api/painel?${q}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const j = r.ok ? await r.json().catch(() => null) : null;
      leituras.push({ area, parte: params.aba || params.acao || params.para || '', ok: Boolean(j), em });
      return j;
    } catch { leituras.push({ area, parte: params.aba || params.acao || params.para || '', ok: false, em }); return null; }
  }
  function juntarLeituras(leituras) {
    const por = new Map();
    for (const l of leituras) {
      const nome = `Vybe OS · /api/painel?area=${l.area}${l.parte ? ` (${l.parte})` : ''}`, k = `${nome}|${l.ok}`;
      const x = por.get(k) || por.set(k, { nome, ok: l.ok, n: 0, em: l.em }).get(k); x.n += 1; if (l.em > x.em) x.em = l.em;
    }
    return [...por.values()].map((x) => ({ nome: x.nome, detalhe: (x.ok ? 'leitura do servidor (só leitura)' : 'não respondeu: os números dela ficaram de fora') + (x.n > 1 ? ` · ${x.n} leituras` : ''), lido_em: horaBr(x.em) }));
  }
  const horaBr = (d) => `${dataBr(diaLocal(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

  async function relatorioDe(modulo, opcoes = {}) {
    const reg = REG.get(String(modulo));
    if (!reg) throw new Error(`Relatório não registrado: ${modulo}`);
    const acesso = opcoes.acesso || acessoAtual();
    if (!pode(reg.acesso, acesso)) throw new Error('Sem acesso a este relatório.');
    // A subaba pedida: registrada, com acesso (quem não vê a aba não gera o relatório dela) e, se for por alvo, com ele.
    let aba = null;
    if (opcoes.aba) {
      const a = reg.abas.find((x) => x.id === String(opcoes.aba));
      if (!a) throw new Error(`Aba não registrada: ${reg.id} · ${opcoes.aba}`);
      if (!pode(a.acesso, acesso)) throw new Error('Sem acesso a esta aba.');
      const alvo = opcoes.alvo && typeof opcoes.alvo === 'object' ? { id: String(opcoes.alvo.id ?? ''), nome: String(opcoes.alvo.nome || opcoes.alvo.id || '') } : opcoes.alvo ? { id: String(opcoes.alvo), nome: String(opcoes.alvo) } : null;
      aba = { id: a.id, nome: a.nome, alvo, agente: a.agente, porAlvo: Boolean(a.alvos) };
    }
    const hoje = opcoes.hoje || (typeof G.hojeDeVerdade === 'function' ? (() => { try { const h = G.hojeDeVerdade(); return ISO.test(h) ? h : diaLocal(); } catch { return diaLocal(); } })() : diaLocal());
    const per = periodo(opcoes.periodo || 'mes', { hoje, inicio: opcoes.inicio, fim: opcoes.fim });
    const leituras = [], fontes = [];
    // As cores da tela de agora (tema claro) valem para os gráficos e para o CSS do documento.
    const tokens = GR()?.definirCores ? GR().definirCores({ ...lerTokens(), ...(opcoes.tokens || {}) }) : {};
    const dados = { ...dadosDaTela, ...(opcoes.dados || {}) };
    const ler = (f) => { try { return lista(typeof f === 'function' ? f() : null); } catch { return []; } };
    const equipe = ler(dados.equipe);
    let carregadas = null;
    const todas = () => carregadas || (carregadas = [...ler(dados.pecas), ...ler(dados.demandas)]);
    const paleta = cores({ equipe });
    const ctx = { periodo: per, hoje, acesso, util, graficos: G.VybeRelGraficos, dados,
      cores: { ...paleta, status: (n, amostra) => corDoStatus(n, amostra ?? todas()) },
      api: opcoes.api || ((area, params) => lerApi(area, params, leituras)),
      fonte: (nome, detalhe, extra = {}) => fontes.push({ nome, detalhe, lido_em: horaBr(new Date()), ...extra }),
      agente: aba?.agente || reg.agente, modulo: reg.id,
      aba: aba ? { id: aba.id, nome: aba.nome, alvo: aba.alvo } : null };
    const { amostra, ...bruto } = (await reg.fn(ctx)) || {};
    // A fn que recebe a aba e devolve o geral (sem `aba`) não sabe montar aquela parte: recusa, em vez de um recorte.
    if (aba && bruto.aba !== aba.id) throw new Error(`O relatório de ${reg.nome} não montou a aba ${aba.nome}.`);
    const agora = opcoes.agora || new Date();
    const juntas = [...fontes, ...lista(bruto.fontes).map((f) => ({ lido_em: horaBr(agora), ...f })),
      ...juntarLeituras(leituras)];
    const amostraStatus = Array.isArray(amostra) ? amostra : todas();
    // Com aba, o título e a capa dizem de que parte é ("Finanças · Pessoas"); o subtítulo do módulo fica se a fn mandar.
    const rotulo = aba ? rotuloDaAba(reg, aba, aba.alvo) : '';
    const titulo = aba ? (String(bruto.titulo || '').startsWith(rotulo) ? bruto.titulo : rotulo) : bruto.titulo;
    const base = { agente: aba?.agente || reg.agente, ...bruto, titulo, fontes: juntas, ...(aba ? { aba: { id: aba.id, nome: aba.nome, alvo: aba.alvo } } : {}) };
    const rel = colorir(filtrar(base, acesso), { ...paleta, status: (n) => corDoStatus(n, amostraStatus) });
    return { rel, reg, per, acesso, agora, tokens, aba, rotulo };
  }
  async function documento(modulo, opcoes = {}) {
    const { rel, reg, per, acesso, agora, tokens, aba, rotulo } = await relatorioDe(modulo, opcoes);
    return montar(rel, { modulo: aba ? rotulo : reg.nome, periodo: rel.periodo || per.rotulo, geradoEm: horaBr(agora), geradoPor: opcoes.geradoPor ?? acesso.nome, agente: aba?.agente || reg.agente, cores: tokens });
  }

  // Imprime num iframe próprio: o painel fica como estava; a pessoa escolhe "Salvar como PDF" na janela do navegador.
  let imprimindo = null;
  async function gerar(modulo, opcoes = {}) {
    if (typeof document === 'undefined') return false;
    const html = await documento(modulo, opcoes);
    imprimindo?.remove?.();
    const fr = document.createElement('iframe');
    fr.className = 'vrel-impressao'; fr.setAttribute('aria-hidden', 'true'); fr.title = 'Relatório para imprimir';
    document.body.appendChild(fr); imprimindo = fr;
    const doc = fr.contentDocument; doc.open(); doc.write(html); doc.close();
    const win = fr.contentWindow;
    await new Promise((ok) => { if (doc.readyState === 'complete') ok(); else win.addEventListener('load', ok, { once: true }); setTimeout(ok, 2500); });
    try { await Promise.race([doc.fonts?.ready, new Promise((ok) => setTimeout(ok, 2500))]); } catch { /* imprime com a fonte que tiver */ }
    win.focus(); win.print();
    // O iframe fica até a próxima geração (alguns navegadores imprimem depois que print() volta).
    return true;
  }

  // ---------- O botão no cabeçalho do módulo ----------
  // Fica logo à direita do título do módulo (o mesmo lugar em todos), só onde há relatório registrado e acesso.
  const TITULOS = '.d3m-tit, .d3m-c-tit, .d3m-d-tit, .d3m-e-tit, .d3m-a-ap-tit, .rv2-tit, .d3h-ola, .d3s-tit, .fe-marca, .d3f-tit';
  const ICONE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
  let botao = null, pop = null, telaAtual = '', agendado = false;
  function telaDoDock() {
    if (typeof document === 'undefined') return '';
    const q = (s) => document.querySelector(s);
    // Janela por cima da tela (Recursos Humanos abre como diálogo e o dock fica no que estava): vale a aba dela.
    const aba = q('#vv-pessoas [data-vp-aba][aria-selected="true"]');
    if (aba) return aba.dataset.vpAba;
    const b = q('.vv-trilho [data-submodulo][aria-current]') || q('.vv-trilho [data-visao-setor][aria-current]') || q('.vv-trilho [data-trilho][aria-current]');
    return b ? b.dataset.submodulo || b.dataset.visaoSetor || b.dataset.trilho || '' : '';
  }
  const visivel = (el) => Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  function ancora() {
    // O título visível mais alto da tela (o do módulo aberto); o do Hoje só vale quando o Hoje é a tela do módulo.
    const cands = [...document.querySelectorAll(TITULOS)].filter((el) => !el.closest('.vrel-pop, [hidden]') && visivel(el));
    if (!cands.length) return null;
    const fora = cands.filter((el) => !el.closest('#vv-hoje'));
    return (fora.length ? fora : cands).map((el) => [el, el.getBoundingClientRect()]).sort((a, b) => a[1].top - b[1].top || a[1].left - b[1].left)[0][0];
  }
  function criarBotao() {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'vrel-botao'; b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
    b.innerHTML = `${ICONE}<span>Gerar relatório</span>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); if (pop) fecharEscolha(); else abrirEscolha(); });
    return b;
  }
  function posicionar() {
    agendado = false;
    if (typeof document === 'undefined') return;
    const tela = telaDoDock(), reg = moduloDaTela(tela);
    const ok = reg && pode(reg.acesso, acessoAtual()) && !document.body.classList.contains('auth-pending');
    if (!ok) { if (botao?.isConnected) botao.remove(); if (pop) fecharEscolha(); telaAtual = tela; return; }
    if (tela !== telaAtual && pop) fecharEscolha();
    telaAtual = tela;
    const a = ancora();
    if (!a) { if (botao?.isConnected) botao.remove(); return; }
    botao = botao || criarBotao();
    botao.dataset.relModulo = reg.id;
    botao.title = `Gerar o relatório técnico de ${reg.nome} em PDF`;
    if (botao.previousElementSibling !== a || botao.parentElement !== a.parentElement) a.after(botao);
  }
  function agendarBotao() {
    if (agendado || typeof requestAnimationFrame !== 'function' || typeof document === 'undefined') return;
    agendado = true; requestAnimationFrame(posicionar);
  }

  // A escolha rápida do período: a lista, o personalizado e o botão de gerar.
  // "O quê" (Paulo, 27/11/2026): só a aba aberta (já marcada quando o módulo tem a aba registrada), o módulo inteiro ou
  // outra subaba. Um <select> nativo: cabe no celular com as 8 abas do Finanças e funciona no teclado e no leitor de tela.
  function opcoesDoQue(reg, acesso, aberta) {
    const abas = reg.abas.filter((a) => pode(a.acesso, acesso));
    if (!abas.length) return '';
    const op = (v, rot, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(rot)}</option>`;
    const outras = abas.filter((a) => a.id !== aberta?.id);
    return `${aberta ? op(`aba:${aberta.id}`, `Só esta aba (${aberta.nome})`, true) : ''}${op('', 'Módulo inteiro', !aberta)}`
      + (outras.length ? `<optgroup label="${aberta ? 'Outras abas' : 'Só uma aba'}">${outras.map((a) => op(`aba:${a.id}`, a.nome, false)).join('')}</optgroup>` : '');
  }
  const ctxLeve = () => ({ hoje: diaLocal(), util, acesso: acessoAtual(), dados: dadosDaTela, api: (area, params) => lerApi(area, params, []) });
  // Aba "cliente a cliente": a lista para escolher, com o que está aberto na tela já marcado.
  async function pintarAlvos(reg) {
    if (!pop) return;
    const caixa = pop.querySelector('[data-rel-alvo-caixa]'), sel = pop.querySelector('[data-rel-alvo]');
    const v = pop.querySelector('[data-rel-oque]')?.value || '', aba = reg.abas.find((a) => `aba:${a.id}` === v);
    if (!caixa || !sel) return;
    if (!aba?.alvos) { caixa.hidden = true; sel.innerHTML = ''; return; }
    caixa.hidden = false; caixa.querySelector('span').textContent = aba.rotuloAlvo || 'Qual';
    sel.innerHTML = '<option value="">Carregando…</option>'; sel.disabled = true;
    let alvos = [];
    try { alvos = lista(await aba.alvos(ctxLeve())).filter((x) => x && x.id != null && x.nome); } catch { alvos = []; }
    if (!pop || pop.querySelector('[data-rel-oque]')?.value !== v) return;
    let atual = ''; try { atual = String(aba.alvoDaTela?.() ?? ''); } catch { atual = ''; }
    sel.innerHTML = alvos.length ? alvos.map((x) => `<option value="${esc(x.id)}"${String(x.id) === atual ? ' selected' : ''}>${esc(x.nome)}</option>`).join('') : '<option value="">Nada para escolher agora</option>';
    sel.disabled = !alvos.length;
  }
  function abrirEscolha() {
    const reg = REG.get(botao?.dataset.relModulo || ''); if (!reg) return;
    const acesso = acessoAtual(), aberta = abaDaTela(reg.id), oque = opcoesDoQue(reg, acesso, aberta && pode(aberta.acesso, acesso) ? aberta : null);
    pop = document.createElement('div');
    pop.className = 'vrel-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', `Relatório de ${reg.nome}: escolha ${oque ? 'o quê e ' : ''}o período`);
    const hoje = diaLocal();
    pop.innerHTML = `<p class="vrel-pop-tit"><b>Relatório de ${esc(reg.nome)}</b><small>${reg.agente ? `Com a análise de ${esc(reg.agente.nome)} · ` : ''}PDF para imprimir ou salvar</small></p>
      ${oque ? `<label class="vrel-campo"><span>O quê</span><select data-rel-oque>${oque}</select></label><label class="vrel-campo" data-rel-alvo-caixa hidden><span>Qual</span><select data-rel-alvo></select></label>` : ''}
      <div class="vrel-pop-lista" role="radiogroup" aria-label="Período">${oque ? '<span class="vrel-pop-rot" aria-hidden="true">Período</span>' : ''}${PERIODOS.map(([k, rot], i) => `<button type="button" role="radio" class="vrel-op" data-rel-per="${k}" aria-checked="${i === 0}">${esc(rot)}</button>`).join('')}</div>
      <div class="vrel-pop-datas" hidden><label><span>De</span><input type="date" data-rel-ini value="${somarDias(hoje, -29)}"></label><label><span>Até</span><input type="date" data-rel-fim value="${hoje}"></label></div>
      <div class="vrel-pop-pe"><button type="button" class="vrel-gerar" data-rel-gerar>Gerar PDF</button><small class="vrel-pop-msg" aria-live="polite"></small></div>`;
    document.body.appendChild(pop);
    const r = botao.getBoundingClientRect(), w = Math.min(320, innerWidth - 24);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.left))}px`;
    const h = pop.offsetHeight || 360;
    pop.style.top = `${Math.max(12, Math.min(r.bottom + 8, innerHeight - h - 12))}px`;
    botao.setAttribute('aria-expanded', 'true');
    pop.addEventListener('click', aoClicarNaEscolha);
    pop.querySelector('[data-rel-oque]')?.addEventListener('change', () => pintarAlvos(reg));
    document.addEventListener('keydown', teclaDaEscolha, true);
    setTimeout(() => document.addEventListener('click', foraDaEscolha, true), 0);
    pintarAlvos(reg);
    (pop.querySelector('[data-rel-oque]') || pop.querySelector('[aria-checked="true"]'))?.focus();
  }
  function fecharEscolha() {
    pop?.remove(); pop = null;
    botao?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', teclaDaEscolha, true);
    document.removeEventListener('click', foraDaEscolha, true);
  }
  function foraDaEscolha(e) { if (pop && !pop.contains(e.target) && e.target !== botao && !botao?.contains(e.target)) fecharEscolha(); }
  function teclaDaEscolha(e) {
    if (!pop) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fecharEscolha(); botao?.focus(); }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.matches?.('.vrel-op')) {
      e.preventDefault(); const ops = [...pop.querySelectorAll('.vrel-op')], i = ops.indexOf(e.target), j = (i + (e.key === 'ArrowDown' ? 1 : -1) + ops.length) % ops.length;
      escolher(ops[j]); ops[j].focus();
    }
  }
  function escolher(op) {
    pop.querySelectorAll('.vrel-op').forEach((b) => b.setAttribute('aria-checked', String(b === op)));
    pop.querySelector('.vrel-pop-datas').hidden = op.dataset.relPer !== 'personalizado';
  }
  async function aoClicarNaEscolha(e) {
    const op = e.target.closest('.vrel-op'); if (op) { escolher(op); return; }
    if (!e.target.closest('[data-rel-gerar]')) return;
    const modulo = botao?.dataset.relModulo, k = pop.querySelector('.vrel-op[aria-checked="true"]')?.dataset.relPer || 'mes';
    const per = k === 'personalizado' ? { inicio: pop.querySelector('[data-rel-ini]').value, fim: pop.querySelector('[data-rel-fim]').value } : k;
    if (k === 'personalizado' && !(ISO.test(per.inicio) && ISO.test(per.fim))) { pop.querySelector('.vrel-pop-msg').textContent = 'Escolha as duas datas.'; return; }
    const msg = pop.querySelector('.vrel-pop-msg'), btn = pop.querySelector('[data-rel-gerar]');
    const oque = pop.querySelector('[data-rel-oque]')?.value || '', aba = oque.startsWith('aba:') ? oque.slice(4) : '';
    const selAlvo = pop.querySelector('[data-rel-alvo]'), caixaAlvo = pop.querySelector('[data-rel-alvo-caixa]');
    const alvo = aba && caixaAlvo && !caixaAlvo.hidden ? (selAlvo?.value ? { id: selAlvo.value, nome: selAlvo.selectedOptions[0]?.textContent || selAlvo.value } : null) : null;
    if (aba && caixaAlvo && !caixaAlvo.hidden && !alvo) { msg.textContent = 'Escolha de quem é o relatório.'; return; }
    btn.disabled = true; btn.textContent = 'Montando…'; msg.textContent = '';
    try { await gerar(modulo, { periodo: per, ...(aba ? { aba, alvo } : {}) }); fecharEscolha(); }
    catch (err) { console.error('[relatorio]', err); if (pop) { btn.disabled = false; btn.textContent = 'Gerar PDF'; msg.textContent = 'Não deu para montar o relatório agora. Tente de novo.'; } }
  }

  function iniciar() {
    if (typeof document === 'undefined' || !document.body) return;
    const hud = document.getElementById('mundo-hud') || document.body;
    new MutationObserver(agendarBotao).observe(hud, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
    new MutationObserver(agendarBotao).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // A tela que redesenha o cabeçalho leva o botão junto: a checagem barata (sem medir nada) devolve no próximo quadro.
    (globalThis.vbIntervalo || setInterval)(() => { if (telaDoDock() !== telaAtual || (moduloDaTela(telaAtual) && !botao?.isConnected)) agendarBotao(); }, 700);
    addEventListener('resize', () => { if (pop) fecharEscolha(); });
    agendarBotao();
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar(); }

  const antigo = G.VybeRelatorio && typeof G.VybeRelatorio === 'object' ? G.VybeRelatorio : {};
  const api = Object.freeze({ ...antigo, registrar, registrado, gerar, documento, relatorioDe, montar, filtrar, periodo, PERIODOS, util, acesso: acessoAtual,
    corDoStatus, corDoCliente, corDoPapel, cores, colorir, lerTokens, corOpaca,
    abas: abasDe, abaDaTela, rotuloDaAba: (modulo, aba, alvo) => { const reg = REG.get(String(modulo)); return reg ? rotuloDaAba(reg, reg.abas.find((x) => x.id === aba) || null, alvo) : ''; },
    modulos: () => [...REG.values()].map((r) => ({ id: r.id, nome: r.nome, telas: [...r.telas], acesso: r.acesso, agente: r.agente, abas: r.abas.map((a) => ({ id: a.id, nome: a.nome, acesso: a.acesso, porAlvo: Boolean(a.alvos) })) })), _botao: { posicionar, telaDoDock, opcoesDoQue: (modulo, acesso, abertaId) => { const reg = REG.get(String(modulo)); return reg ? opcoesDoQue(reg, acesso, reg.abas.find((x) => x.id === abertaId) || null) : ''; } } });
  G.VybeRelatorio = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
