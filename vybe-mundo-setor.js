// vybe-mundo-setor.js — a Visão geral de cada setor do dock: um painel de gestão de verdade (Paulo, 08/11/2026: "os
// paineis tão resumindo literalmente o que tá dentro… olha o nível de complexidade do AgencyFlow… uns PUTAS PAINÉIS DE
// GESTÃO pra eu ter controle de tudo").
//
//   VybeSetor.abrir(setor, ctx)  setor = 'setor:producao' | 'setor:clientes' | 'setor:comercial' | 'setor:financas' | 'setor:pessoas'
//   VybeSetor.fechar() · VybeSetor.aberto() → id do setor aberto ou ''
//
// ctx (de vybe-mundo.js): { nome, dica, subs: [{ id, nome, dica, url }], numeros(), fila(), agenda(), abrirSub(id), aoFechar() }
// Cada painel: período (Mensal/Anual e o mês, onde o servidor recorta), metas e corrida, números com a variação contra o
// período anterior, gráficos dos últimos meses/semanas, listas do que pede ação e os atalhos para as abas. Os números
// vêm das MESMAS fontes das abas, sem conta nova de negócio: numerosDoDono (Gestão), minhaFila, a agenda já carregada,
// VybeCarteira.dados(), VybePessoas.carga() e as leituras do servidor de cada aba (area=comercial, area=carteira,
// area=setor_pessoas). Quem não pode ver um número recebe a recusa do servidor e o bloco diz isso. Nada aqui grava.
(() => {
  'use strict';
  const cliCor = (n) => (typeof globalThis.cliCor === 'function' ? globalThis.cliCor(n) : esc(n));
  const statusCor = (d) => (typeof globalThis.statusCor === 'function' ? globalThis.statusCor(d) : esc(d?.status));
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const num = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : Math.round(Number(v)).toLocaleString('pt-BR'));
  const reais = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
  const curto = (v) => { const n = Number(v) || 0, f = (x) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 }); return n >= 1e6 ? f(n / 1e6) + ' mi' : n >= 1e3 ? f(n / 1e3) + ' mil' : f(Math.round(n)); };
  const pct = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : `${Math.round(Number(v))}%`);
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeMes = (ym) => { const [a, m] = String(ym || '').split('-'); return m ? `${MESES[Number(m) - 1]} de ${a}` : ''; };
  const mesCurto = (ym) => MESES[Number(String(ym).slice(5, 7)) - 1]?.slice(0, 3) || '';
  const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const somarMes = (ym, n) => { const [a, m] = ym.split('-').map(Number), d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const diaMes = (iso) => `${String(iso || '').slice(8, 10)}/${String(iso || '').slice(5, 7)}`;
  const carregando = () => (typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo: 'carregando' }) : '<div class="vb-carregando"><div class="vb-brilho"></div></div>');
  const ICONE = {
    pessoas: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/>',
    doc: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/>', aperto: '<path d="M4 12l4 4 12-12"/>',
    alta: '<path d="M4 17l6-6 4 4 6-8"/><path d="M14 7h6v6"/>', dinheiro: '<path d="M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>',
    relogio: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', alerta: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    meta: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>', trofeu: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3M12 13v4M8 20h8"/>',
    caixa: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M8 7V4h8v3"/>', coracao: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', saida: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  };
  const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE[n] || ICONE.meta}</svg>`;

  const el = document.createElement('section');
  el.className = 'vv-gestao vv-setor-visao'; el.hidden = true; el.setAttribute('aria-label', 'Visão geral do setor');
  document.body.append(el);
  let atual = '', ctx = null, geracao = 0;
  // Mensal/Anual só onde muda algo (quadro 15): o painel que não recebeu número nenhum do servidor marca aqui e a barra
  // de período sai do topo (trocar o mês não traria nada).
  let periodoSemEfeito = false;
  const per = { tipo: 'mensal', mes: mesAtual() }; // período dos painéis que o servidor recorta (Comercial e Finanças)

  // Leituras do servidor com cache de 1 minuto por endereço.
  const cache = new Map();
  async function ler(url) {
    const c = cache.get(url);
    if (c && Date.now() - c.em < 60000) return c.r;
    let r;
    try {
      const resp = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
      const corpo = await resp.json().catch(() => ({}));
      r = resp.ok ? corpo : { falha: resp.status === 403 ? 'negado' : resp.status === 503 ? 'aguardando' : 'erro', mensagem: corpo.error || '' };
    } catch { r = { falha: 'erro', mensagem: 'Sem conexão com o servidor.' }; }
    if (!r.falha) cache.set(url, { em: Date.now(), r });
    return r;
  }
  const qPeriodo = () => `&mes=${per.mes}&periodo=${per.tipo}`;
  const aviso = (texto) => `<p class="vs-aviso">${esc(texto)}</p>`;
  const falhaTexto = (r) => (r.falha === 'negado' ? 'Só os donos e a administração veem.' : r.falha === 'aguardando' ? 'Aguardando ativação no servidor.' : 'Não deu para ler agora.');

  // ---------- Peças do painel ----------
  // Número com ícone, título, valor grande e a variação contra o período anterior (verde quando melhora).
  function kpi({ icone = 'meta', titulo, valor, sub = '', variacao = null, contra = 'vs mês anterior', inverte = false, cls = '', dica = '', espiar = '', ir = null }) {
    let chip = '';
    if (variacao != null && variacao !== 'sem' && Number.isFinite(Number(variacao))) {
      const v = Number(variacao), bom = inverte ? v < 0 : v > 0, ruim = inverte ? v > 0 : v < 0;
      chip = `<span class="vs-var ${bom ? 'sobe' : ruim ? 'desce' : ''}">${v > 0 ? '▲' : v < 0 ? '▼' : '•'} ${Math.abs(Math.round(v))}%</span><small>${esc(contra)}</small>`;
    } else if (variacao === 'sem') chip = `<span class="vs-var">—</span><small>${esc(contra)}</small>`;
    // Com espiar, o cartão é um botão que abre a lista por trás do número (o mini painel da Gestão).
    const tag = espiar ? `button type="button" data-espiar="${esc(espiar)}"` : 'div', fim = espiar ? 'button' : 'div';
    return `<${tag} class="vs-kpi ${cls}${espiar ? ' vs-kpi-espiar' : ''}"${dica ? ` title="${esc(dica)}"` : ''}><span class="vs-kpi-topo"><i>${ic(icone)}</i><span>${esc(titulo)}</span></span>
      <b class="vs-kpi-valor">${valor}</b>${sub ? `<span class="vs-kpi-sub">${sub}</span>` : ''}${chip ? `<span class="vs-kpi-var">${chip}</span>` : ''}${ir && !espiar ? abrirAba(ir[0], ir[1]).replace('class="vs-abrir"', 'class="vs-abrir vs-kpi-ir"') : ''}</${fim}>`;
  }
  const bloco = (titulo, sub, corpo, { icone = 'alta', cls = '', acao = '' } = {}) => `<section class="vs-bloco ${cls}"><div class="vs-bloco-cabeca"><i>${ic(icone)}</i><span><b>${esc(titulo)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${acao}</div>${corpo}</section>`;
  const abrirAba = (id, rotulo = 'Abrir') => (ctx?.subs || []).some((s) => s.id === id) ? `<button type="button" class="vs-abrir" data-setor-sub="${esc(id)}">${esc(rotulo)} →</button>` : '';
  // Barras verticais (SVG que acompanha a largura), com o valor em cima; as barras crescem ao aparecer.
  function barras(itens, series, { fmt = num, curtoFmt = curto, altura = 180 } = {}) {
    if (!itens.length || !itens.some((i) => series.some((s) => Number(i[s.chave]) > 0))) return aviso('Sem dados no período.');
    const W = 560, H = altura, base = H - 26, topo = 22, max = Math.max(1, ...itens.flatMap((i) => series.map((s) => Number(i[s.chave]) || 0)));
    const passo = W / itens.length, n = series.length, bw = Math.min(34, Math.max(8, (passo - 14) / n - 3));
    const corpo = itens.map((it, i) => {
      const x0 = i * passo + passo / 2 - (n * bw + (n - 1) * 3) / 2;
      return series.map((s, j) => {
        const v = Number(it[s.chave]) || 0, h = v > 0 ? Math.max(2, (v / max) * (base - topo)) : 0, x = x0 + j * (bw + 3);
        return `<g><title>${esc(s.rotulo)} · ${esc(it.rotulo)}: ${esc(fmt(v))}</title><rect class="vs-barra ${s.cls}" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" style="animation-delay:${i * 30}ms"/>${v && (itens.length <= 8 || n === 1) ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(base - h - 5).toFixed(1)}" text-anchor="middle" class="vs-valor">${esc(curtoFmt(v))}</text>` : ''}</g>`;
      }).join('') + `<text x="${(i * passo + passo / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="vs-eixo">${esc(it.rotulo)}</text>`;
    }).join('');
    return `<figure class="vs-grafico"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => s.rotulo).join(' e '))}">${corpo}<line x1="0" x2="${W}" y1="${base}" y2="${base}" class="vs-linha-base"/></svg>
      ${series.length > 1 ? `<figcaption>${series.map((s) => `<span><i class="${s.cls}"></i>${esc(s.rotulo)}</span>`).join('')}</figcaption>` : ''}</figure>`;
  }
  // Barras deitadas (listas com proporção): nome, barra e o valor; meta opcional como marca.
  function deitadas(lista, { fmt = num, vazio = 'Nada aqui.' } = {}) {
    if (!lista.length) return aviso(vazio);
    const max = Math.max(1, ...lista.map((x) => Math.max(Number(x.valor) || 0, Number(x.meta) || 0)));
    return `<ul class="vs-deitadas">${lista.map((x, i) => `<li${x.sub ? ` title="${esc(x.sub)}"` : ''}><span class="vs-d-nome">${x.cli ? cliCor(x.nome) : x.st ? statusCor({ status: x.nome }) : esc(x.nome)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>
      <span class="vs-d-trilho"><i class="${x.cls || ''}" style="width:${Math.max(0, Math.min(100, ((Number(x.valor) || 0) / max) * 100)).toFixed(1)}%;animation-delay:${i * 30}ms"></i>${x.meta ? `<em style="left:${Math.min(100, (x.meta / max) * 100).toFixed(1)}%" title="Meta ${esc(fmt(x.meta))}"></em>` : ''}</span>
      <b>${x.rotulo ?? esc(fmt(x.valor))}</b></li>`).join('')}</ul>`;
  }
  const progresso = (itens) => `<ul class="vs-metas">${itens.map((m) => `<li><span><b>${esc(m.nome)}</b><small>${m.texto}</small></span><span class="vs-d-trilho"><i class="${m.batida ? 'ok' : ''}" style="width:${Math.max(0, Math.min(100, Number(m.barra) || 0))}%"></i></span><strong>${m.percentual == null ? '—' : pct(m.percentual)}</strong></li>`).join('')}</ul>`;
  function barraPeriodo() {
    const meses = Array.from({ length: 12 }, (_, i) => somarMes(mesAtual(), -i));
    const opcoes = per.tipo === 'anual' ? [...new Set(meses.map((m) => m.slice(0, 4)))].map((a) => [a === mesAtual().slice(0, 4) ? mesAtual() : `${a}-12`, a]) : meses.map((m) => [m, nomeMes(m).replace(/^./, (c) => c.toUpperCase())]);
    return `<span class="vs-periodo" role="group" aria-label="Período"><span class="vs-alternar"><button type="button" data-vs-tipo="mensal" aria-pressed="${per.tipo === 'mensal'}">Mensal</button><button type="button" data-vs-tipo="anual" aria-pressed="${per.tipo === 'anual'}">Anual</button></span>
      <select data-vs-mes aria-label="${per.tipo === 'anual' ? 'Ano' : 'Mês'}">${opcoes.map(([v, r]) => `<option value="${v}"${v.slice(0, per.tipo === 'anual' ? 4 : 7) === per.mes.slice(0, per.tipo === 'anual' ? 4 : 7) ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></span>`;
  }
  const atalhos = () => `<nav class="vs-atalhos" aria-label="Abas do setor">${ctx.subs.map((s) => `<button type="button" data-setor-sub="${esc(s.id)}" title="${esc(s.dica || '')}">${esc(s.nome)}${s.url ? ' ↗' : ''}</button>`).join('')}</nav>`;
  const linha = (corpo) => `<div class="vs-linha">${corpo}</div>`;
  // Próximos passos (redesign, quadro 57): o que destrava o setor, cada um com o caminho para a aba. ponto: a = âmbar
  // (falta algo), r = vermelho (atrasado), v = verde (andando), c = neutro.
  const passos = (lista, vazio = 'Nada travando o setor agora.') => (lista.length ? `<ul class="vs-passos">${lista.map((p) => `<li><i class="vs-ponto ${p.ponto || 'c'}" aria-hidden="true"></i><span><b>${esc(p.titulo)}</b>${p.sub ? `<small>${p.sub}</small>` : ''}</span>${p.botao ?? (p.ir ? abrirAba(p.ir[0], p.ir[1]) : '')}</li>`).join('')}</ul>` : aviso(vazio));
  // Pede ação da Produção (quadro 15): os alertas da operação até "esperando o cliente" (nível 4), na ordem de gravidade,
  // cada um com o caminho para resolver: uma peça só abre a peça; várias abrem a lista por trás do alerta (o mesmo espiar
  // da Gestão, onde cada linha abre a peça ou o cliente); a semana cheia leva ao Painel de trabalho. Nível 5 em diante
  // (cobertura, sem planejamento) continua nos cartões de baixo.
  function pedeAcaoProducao(N, filaAtr) {
    const linhas = (N?.alertas || []).map((a, i) => ({ a, i })).filter(({ a }) => a && a.nivel <= 4).map(({ a, i }) => {
      const t = String(a.texto || ''), p = t.indexOf(':');
      const ids = a.ref?.tipo === 'pecas' ? a.ref.ids || [] : [];
      const rotulo = a.nivel === 4 ? 'Cobrar' : 'Resolver';
      const botao = ids.length === 1 ? `<button type="button" class="vs-abrir vs-resolver" data-vs-peca="${esc(ids[0])}">Abrir a peça →</button>`
        : a.ref?.tipo === 'semana' ? abrirAba('gestor', 'Ver a semana')
          : a.ref ? `<button type="button" class="vs-abrir vs-resolver" data-espiar="alerta:${i}">${rotulo} →</button>` : '';
      return { ponto: a.nivel === 1 ? 'r' : a.nivel <= 3 ? 'a' : 'c', titulo: p > 0 ? t.slice(0, p) : t, sub: p > 0 ? esc(t.slice(p + 1).trim()) : '', botao };
    });
    if (filaAtr) linhas.push({ ponto: 'r', titulo: `${num(filaAtr)} ${filaAtr === 1 ? 'peça atrasada' : 'peças atrasadas'} na sua fila`, sub: 'na ordem do dia, em Minhas tarefas', ir: ['tarefas', 'Abrir a fila'] });
    return passos(linhas, 'Nada pedindo ação na produção agora.');
  }
  // Os seis números da Produção numa linha (vbResumoHtml): o que pede atenção ganha o tom; zero fica discreto.
  function resumoProducao({ prontas, previstas, entregues, noPrazo, atrasadas, emRisco, emAprov, prox, fila, filaAtr }) {
    const n = (v) => Number(v) || 0, s = (v, um, varios) => (n(v) === 1 ? um : varios);
    const itens = [
      previstas ? { valor: `${num(prontas)} de ${num(previstas)}`, rotulo: `previstas da semana prontas (${pct((n(prontas) / previstas) * 100)}) · ${num(entregues)} ${s(entregues, 'entrega registrada', 'entregas registradas')}`, tom: n(prontas) >= previstas ? 'ok' : '' }
        : { rotulo: 'nenhuma peça prevista nesta semana', tom: 'zero' },
      noPrazo != null ? { valor: pct(noPrazo), rotulo: 'no prazo (últimas 12 semanas)', tom: noPrazo < 80 ? 'atencao' : '' } : { rotulo: 'no prazo: sem histórico ainda', tom: 'zero' },
      { valor: num(atrasadas), rotulo: s(atrasadas, 'atrasada agora', 'atrasadas agora'), tom: n(atrasadas) ? 'alerta' : 'zero' },
      { valor: num(emRisco), rotulo: 'com risco de furo', tom: n(emRisco) ? 'atencao' : 'zero' },
      { valor: num(emAprov), rotulo: 'em aprovação (cliente ou DA)', tom: n(emAprov) ? 'atencao' : 'zero' },
      { valor: `${num(prox.previstas)}/${num(prox.capacidadeMediana)}`, rotulo: `próxima semana, previstas / capacidade${prox.folga != null ? (prox.folga >= 0 ? ` · folga ${num(prox.folga)}` : ` · faltam ${num(-prox.folga)}`) : ''}`, tom: prox.risco === 'alto' ? 'alerta' : prox.risco === 'medio' ? 'atencao' : n(prox.previstas) ? '' : 'zero' },
      { valor: num(fila), rotulo: filaAtr ? `na sua fila · ${num(filaAtr)} ${s(filaAtr, 'atrasada', 'atrasadas')}` : 'na sua fila, em dia', tom: filaAtr ? 'alerta' : n(fila) ? '' : 'zero' },
    ];
    if (typeof window.vbResumoHtml === 'function') return `<div class="vs-resumo">${window.vbResumoHtml(itens)}</div>`;
    return `<div class="vs-resumo"><div class="vb-resumo">${itens.map((x) => `<span class="vb-resumo-item ${x.tom || ''}">${x.valor != null ? `<b>${esc(x.valor)}</b>` : ''}${esc(x.rotulo)}</span>`).join('')}</div></div>`;
  }
  // Meta do mês sempre à vista: com meta, a barra de cada uma; sem meta, a barra vazia e o caminho para definir.
  function metaDoMes(progressoLista, periodoNome, { filtro = () => true, titulo = 'Meta do mês' } = {}) {
    const metas = (progressoLista || []).filter((x) => x.meta > 0 && filtro(x)).map((x) => ({ ...x, texto: `${x.tipo === 'dinheiro' ? reais(x.realizado) : num(x.realizado)} de ${x.tipo === 'dinheiro' ? reais(x.meta) : num(x.meta)}${x.batida ? ' · meta batida' : ''}` }));
    // As metas moram no Funil (Editar metas); fora do Comercial, o botão leva ao setor.
    const rotulo = metas.length ? 'Metas' : 'Definir a meta';
    const acao = abrirAba('funil', rotulo) || `<button type="button" class="vs-abrir" data-setor-ir="setor:comercial">${rotulo} →</button>`;
    const corpo = metas.length ? progresso(metas)
      : `<div class="vs-meta-vazia"><span class="vs-d-trilho"><i style="width:0%"></i></span><p>Nenhuma meta definida para ${esc(periodoNome)}. Os donos definem no Funil, em Editar metas.</p></div>`;
    return bloco(titulo, periodoNome, corpo, { icone: 'meta', cls: 'vs-destaque', acao });
  }
  // Clientes ativos do painel (o mesmo cadastro das outras telas) e contratos vigentes da carteira (aba Contratos).
  const cadastro = () => (typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : []);
  const clientesAtivos = () => cadastro().filter((c) => c && c.id && c.nome && c.ativo !== false);
  const nomeDoCliente = (id) => cadastro().find((c) => String(c.id) === String(id))?.nome || 'Cliente';
  const contratosAtivos = (cart) => (cart?.contratos?.lista || []).filter((c) => !/encerr|cancel/i.test(String(c.status || '')));

  // ---------- Os painéis ----------
  const PAINEIS = {
    // A agência inteira, na aba Agência da Gestão (Paulo, 08/11/2026: "o Gestão que tinha que ser bem mais completo e foda
    // tá resumido"). Junta os setores com as MESMAS leituras dos painéis de cada um (cache compartilhado): dinheiro (Vybe
    // Finanças quando ligado, senão as tabelas do Comercial), comercial, clientes, produção e time. Cada bloco leva ao
    // setor ou à aba de onde veio. Quem não pode ver dinheiro vê os outros blocos e o aviso no lugar dos números.
    async 'setor:agencia'() {
      const N = ctx.numeros(), H = N?.hoje || {}, S = N?.semana || {}, Hi = N?.historico || {}, P = N?.projecao || {}, C = N?.cobertura || {};
      const mes = String(per.mes).slice(0, 7);
      const [vf, fin, rec, com, cart] = await Promise.all([ler('/api/painel?area=vybe_financas&parte=comercial&mes=' + mes), ler('/api/painel?area=comercial&aba=financas'),
        ler('/api/painel?area=comercial&aba=recebimentos' + qPeriodo()), ler('/api/painel?area=comercial&aba=funil' + qPeriodo()), ler('/api/painel?area=carteira')]);
      const contra = per.tipo === 'anual' ? 'vs ano anterior' : 'vs mês anterior';
      const rs = (v) => (Math.abs(Number(v)) >= 1e4 ? 'R$ ' + curto(v) : reais(v));
      // Dinheiro
      const temVF = !vf.falha && vf.conectado && vf.resumo, VR = vf.resumo || {};
      const F = fin.resumo || {}, RA = rec.resumo?.atual || {}, RV = rec.resumo?.variacao || {};
      const semDinheiro = !temVF && (fin.falha === 'negado' || (!fin.resumo && !rec.resumo));
      const dinheiro = semDinheiro ? kpi({ icone: 'dinheiro', titulo: 'Dinheiro', valor: '—', sub: fin.falha === 'negado' ? 'só os donos e a administração veem' : 'sem números agora' })
        : temVF ? kpi({ icone: 'aperto', titulo: 'Recebido no mês', valor: rs(VR.recebido), sub: `de ${reais(VR.previsto)} previsto` })
          + kpi({ icone: 'alta', titulo: 'Resultado', valor: rs(VR.resultado), sub: 'recebido − despesas pagas', cls: Number(VR.resultado) < 0 ? 'ruim' : '' })
          + kpi({ icone: 'alerta', titulo: 'Em atraso', valor: rs(vf.inadimplencia?.total), cls: Number(vf.inadimplencia?.total) > 0 ? 'ruim' : '', sub: `${num((vf.inadimplencia?.clientes || []).length)} clientes` })
        : kpi({ icone: 'dinheiro', titulo: 'Receita contratada', valor: rs(F.receita), sub: `margem <b>${pct(F.margem_percentual)}</b>` })
          + kpi({ icone: 'aperto', titulo: 'Recebido', valor: rs(RA.recebido), variacao: RV.recebido ?? 'sem', contra, sub: `de ${reais(RA.a_receber)} a receber` })
          + kpi({ icone: 'relogio', titulo: 'Pendente', valor: rs(RA.pendente), inverte: true, variacao: RV.pendente ?? 'sem', contra, cls: Number(RA.pendente) > 0 ? 'atencao' : '' });
      // Comercial
      const M = com.mes || {}, A = M.kpis?.atual || {}, V = M.kpis?.variacao || {}, val = Boolean(M.valores);
      const comercial = com.falha || !M.kpis ? '' : kpi({ icone: 'aperto', titulo: 'Negócios fechados', valor: num(A.negocios), variacao: V.negocios ?? 'sem', contra, sub: val ? `MRR ${reais(A.mrr)} · avulso ${reais(A.avulso)}` : `${num(A.leads)} leads · ${num(A.propostas)} propostas` });
      // Clientes e produção
      const saude = typeof window.VybeCarteira?.dados === 'function' ? window.VybeCarteira.dados() : [];
      const media = saude.length ? saude.reduce((a, c) => a + (Number(c.score) || 0), 0) / saude.length : null;
      const cl = N?.clientes || [], conta = (k) => cl.filter((c) => c.saude === k).length;
      const pctSemana = S.previstas ? ((S.previstasEntregues ?? S.entregues) / S.previstas) * 100 : null;
      const e = typeof escritorio !== 'undefined' ? escritorio : null, online = (e?.conectado ? e.onlineTodos || e.online : e?.lobbyOnline) || [];
      const kpis = dinheiro + comercial
        + kpi({ icone: 'coracao', titulo: 'Clientes ativos', valor: num(C.clientesAtivos), sub: `saúde média ${media == null ? '—' : num(media)} · ${num(conta('critico'))} críticos`, cls: conta('critico') ? 'atencao' : '' })
        + kpi({ icone: 'aperto', titulo: 'Previstas da semana prontas', valor: `${num(S.previstasEntregues ?? S.entregues)}<i>/${num(S.previstas)}</i>`, sub: pctSemana != null ? pct(pctSemana) : 'nenhuma prevista' })
        + kpi({ icone: 'alerta', titulo: 'Atrasadas agora', valor: num(H.atrasadas), sub: `${num(H.emRisco)} com risco de furo`, cls: H.atrasadas ? 'ruim' : '' })
        + kpi({ icone: 'relogio', titulo: 'No prazo', valor: pct(Hi.mediaNoPrazoPct), sub: 'últimas 12 semanas', cls: Hi.mediaNoPrazoPct != null && Hi.mediaNoPrazoPct < 80 ? 'atencao' : '' })
        + kpi({ icone: 'calendario', titulo: 'Próxima semana', valor: `${num(P.proximaSemana?.previstas)}<i>/${num(P.proximaSemana?.capacidadeMediana)}</i>`, sub: 'previstas / capacidade', cls: P.proximaSemana?.risco === 'alto' ? 'ruim' : P.proximaSemana?.risco === 'medio' ? 'atencao' : '' })
        + kpi({ icone: 'pessoas', titulo: 'Equipe online', valor: num(online.length), sub: 'agora no Escritório' });
      // Metas do comercial (banner) e alertas da operação (o que pede ação primeiro)
      const metas = (M.progresso || []).filter((x) => x.meta > 0).map((x) => ({ ...x, texto: `${x.tipo === 'dinheiro' ? reais(x.realizado) : num(x.realizado)} de ${x.tipo === 'dinheiro' ? reais(x.meta) : num(x.meta)}${x.batida ? ' · meta batida' : ''}` }));
      const alertas = (N?.alertas || []).filter((a) => a.nivel <= 3).slice(0, 6);
      const NIVEL = { 1: 'ruim', 2: 'atencao', 3: 'atencao' };
      const alertasHtml = alertas.length ? `<ul class="vs-alertas">${alertas.map((a) => `<li class="${NIVEL[a.nivel] || ''}"><button type="button" class="vs-alerta" data-espiar="alerta:${(N?.alertas || []).indexOf(a)}"><i aria-hidden="true"></i><span>${esc(a.texto)}</span></button></li>`).join('')}</ul>` : aviso('Nada crítico na operação agora.');
      // Gráficos
      const vendas = (M.series || []).map((x) => ({ ...x, rotulo: mesCurto(x.mes) }));
      const semanas = (Hi.semanas || []).slice(-12).map((x) => ({ ...x, rotulo: diaMes(x.inicio) }));
      const caixa = temVF ? (vf.series || []).slice(-6).map((m) => ({ ...m, rotulo: mesCurto(m.mes) })) : [];
      const piores = [...saude].sort((a, b) => (a.score ?? 999) - (b.score ?? 999)).slice(0, 6);
      const time = [...(N?.time || [])].sort((a, b) => (b.abertas || 0) - (a.abertas || 0)).slice(0, 6);
      const ir = (setor, rotulo) => `<button type="button" class="vs-abrir" data-setor-ir="${esc(setor)}">${esc(rotulo)} →</button>`;
      return linha(bloco('O que pede ação agora', 'alertas da operação, do mais grave ao menos grave', alertasHtml, { icone: 'alerta', cls: 'vs-destaque' })
          + bloco('Metas do comercial', nomeMes(per.mes), metas.length ? progresso(metas) : aviso(com.falha ? falhaTexto(com) : 'Nenhuma meta definida para este período.'), { icone: 'meta', cls: 'vs-destaque', acao: ir('setor:comercial', 'Comercial') }))
        + `<div class="vs-kpis">${kpis}</div>`
        + linha(temVF
            ? bloco('Faturamento × custos', 'recebido e gasto nos últimos meses (Vybe Finanças)', barras(caixa, [{ chave: 'faturamento', rotulo: 'Faturamento', cls: 'c3' }, { chave: 'custos', rotulo: 'Custos', cls: 'c4' }], { fmt: reais }), { icone: 'dinheiro', acao: ir('setor:financas', 'Finanças') })
            : bloco(val ? 'Vendas por mês' : 'Negócios por mês', val ? 'MRR e avulso fechados' : 'negócios fechados', com.falha ? aviso(falhaTexto(com)) : val ? barras(vendas, [{ chave: 'mrr', rotulo: 'MRR', cls: 'c1' }, { chave: 'avulso', rotulo: 'Avulso', cls: 'c2' }], { fmt: reais }) : barras(vendas, [{ chave: 'negocios', rotulo: 'Negócios', cls: 'c1' }]), { icone: 'dinheiro', acao: ir('setor:comercial', 'Comercial') })
          + bloco('Entregas por semana', `previstas e entregues · mediana ${num(Hi.medianaEntregues)} por semana`, barras(semanas, [{ chave: 'previstas', rotulo: 'Previstas', cls: 'c5' }, { chave: 'entregues', rotulo: 'Entregues', cls: 'c1' }]), { icone: 'alta', acao: ir('setor:producao', 'Produção') }))
        + linha(bloco('Clientes prioritários', 'a menor nota de saúde primeiro', deitadas(piores.map((c) => ({ cli: true, nome: c.cliente, valor: c.score, cls: c.score < 50 ? 'ruim' : c.score < 70 ? 'atencao' : 'ok', sub: (c.motivos || []).slice(0, 2).join(' · ') })), { vazio: 'A saúde ainda está sendo calculada.' }), { icone: 'coracao', acao: ir('setor:clientes', 'Clientes') })
          + bloco('Carga do time', 'peças abertas por pessoa', deitadas(time.map((x) => ({ nome: x.pessoa, valor: x.abertas, cls: x.atrasadas ? 'atencao' : '', rotulo: `${num(x.abertas)}${x.atrasadas ? ` <small class="t-ruim">${num(x.atrasadas)} atras.</small>` : ''}`, sub: `${num(x.entregues7d)} entregues em 7 dias` })), { vazio: 'Sem números do time.' }), { icone: 'pessoas', acao: ir('setor:pessoas', 'Pessoas') }))
        + (cart.contratos ? linha(bloco('Carteira', 'contratos ativos e saídas do mês', deitadas([
            { nome: 'Contratos ativos', valor: (cart.contratos.lista || []).length, cls: 'ok' },
            { nome: 'Renovam em 30 dias', valor: (cart.contratos.lista || []).filter((c) => c.renovacao && c.renovacao >= new Date().toISOString().slice(0, 10) && c.renovacao <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)).length, cls: 'atencao' },
            { nome: 'Saídas no mês', valor: (cart.churn?.registros || []).filter((r) => String(r.saiu_em || '').startsWith(mesAtual())).length, cls: 'ruim' }]), { icone: 'calendario', acao: ir('setor:clientes', 'Clientes') })
          + bloco('Cobertura da semana', `meta de ${num(C.meta || 3)} posts por cliente`, deitadas([{ nome: `Abaixo de ${num(C.meta || 3)} posts`, valor: (C.sem3 || []).length, cls: 'atencao' }, { nome: 'Sem nenhum post', valor: (C.semConteudo || []).length, cls: 'ruim' }, { nome: 'Sem planejamento', valor: (C.semPlanejamento || []).length, cls: 'atencao' }]), { icone: 'doc', acao: ir('setor:producao', 'Produção') })) : '');
    },
    // Redesign (quadro 57, 10/11/2026): sem dados no mês, a visão geral era uma frase solta. Agora os números do setor
    // aparecem mesmo zerados (cada um com o caminho para a aba), "Próximos passos" diz o que destrava o setor e a meta do
    // mês fica sempre à vista. Mesmas leituras das abas (funil, pacotes e a carteira dos contratos), sem conta nova.
    async 'setor:comercial'() {
      const [r, pac, cart] = await Promise.all([ler('/api/painel?area=comercial&aba=funil' + qPeriodo()), ler('/api/painel?area=comercial&aba=pacotes'), ler('/api/painel?area=carteira')]);
      if (r.falha) return aviso(falhaTexto(r));
      const m = r.mes || {}, R = r.resumo || {}, semNumeros = !m.kpis || !r.resumo;
      periodoSemEfeito = semNumeros;
      const A = m.kpis?.atual || {}, V = m.kpis?.variacao || {}, val = Boolean(m.valores), contra = m.periodo?.tipo === 'anual' ? 'vs ano anterior' : 'vs mês anterior';
      const corrida = (m.ranking?.linhas || []).slice(0, 5);
      const neg = R.em_negociacao || {};
      const periodoNome = m.periodo?.tipo === 'anual' ? String(m.periodo?.mes || per.mes).slice(0, 4) : nomeMes(m.periodo?.mes || per.mes);
      const clientes = clientesAtivos(), contratos = contratosAtivos(cart);
      const kpis = kpi({ icone: 'pessoas', titulo: 'Leads novos', valor: num(A.leads), variacao: semNumeros ? null : V.leads ?? 'sem', contra, ir: ['funil', 'Abrir o funil'] })
        + kpi({ icone: 'doc', titulo: 'Propostas enviadas', valor: num(A.propostas), variacao: semNumeros ? null : V.propostas ?? 'sem', contra, ir: ['orcamentos', 'Montar orçamento'] })
        + kpi({ icone: 'aperto', titulo: val ? 'Fechado no período' : 'Negócios fechados', valor: val ? reais(semNumeros ? null : (Number(A.mrr) || 0) + (Number(A.avulso) || 0)) : num(A.negocios),
          sub: val ? `${num(A.negocios)} negócio${A.negocios === 1 ? '' : 's'} · MRR <b>${reais(A.mrr)}</b> · Avulso <b>${reais(A.avulso)}</b>` : 'negócios ganhos', variacao: semNumeros ? null : (val ? V.mrr : V.negocios) ?? 'sem', contra })
        + kpi({ icone: 'coracao', titulo: 'Clientes ativos', valor: clientes.length ? num(clientes.length) : '—', sub: cart.falha ? '' : `${num(contratos.length)} com contrato`, ir: ['contratos', 'Contratos'] });
      // O que destrava o setor, na ordem de quem tem pressa.
      const hoje = new Date().toISOString().slice(0, 10), em30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      const renovam = contratos.filter((c) => c.renovacao && c.renovacao >= hoje && c.renovacao <= em30).sort((a, b) => String(a.renovacao).localeCompare(String(b.renovacao)));
      const pacotesAtivos = (pac.pacotes || []).filter((p) => p.ativo !== false);
      const lista = [];
      if (!pac.falha && !pacotesAtivos.length) lista.push({ ponto: 'a', titulo: 'Cadastrar os pacotes da Vybe', sub: 'sem pacote não há orçamento', ir: ['pacotes', 'Cadastrar'] });
      if (renovam.length) lista.push({ ponto: 'c', titulo: `${num(renovam.length)} contrato${renovam.length === 1 ? ' renova' : 's renovam'} em 30 dias`, sub: renovam.slice(0, 4).map((c) => `${cliCor(nomeDoCliente(c.cliente_id))} ${diaMes(c.renovacao)}`).join(' · ') + (renovam.length > 4 ? ` e mais ${num(renovam.length - 4)}` : ''), ir: ['contratos', 'Contratos'] });
      if (!semNumeros && !Number(A.leads)) lista.push({ ponto: 'c', titulo: `Nenhum lead novo em ${periodoNome}`, sub: 'o formulário de leads e o SDR alimentam o funil', ir: ['funil', 'Abrir o funil'] });
      if (Number(neg.quantidade)) lista.push({ ponto: 'v', titulo: `${num(neg.quantidade)} oportunidade${neg.quantidade === 1 ? '' : 's'} em negociação`, sub: val ? `MRR ${reais(neg.mensal)} · avulso ${reais(neg.avulso)}` : 'acompanhe no funil', ir: ['funil', 'Ver o funil'] });
      if (semNumeros) lista.push({ ponto: 'c', titulo: 'Os números do mês ainda não chegaram', sub: 'o funil abre com as oportunidades de agora', ir: ['funil', 'Abrir o funil'] });
      const series = (m.series || []).map((s) => ({ ...s, rotulo: mesCurto(s.mes) }));
      const fases = (R.fases || []).filter((f) => f.id !== 'perdido');
      return `<div class="vs-kpis">${kpis}</div>`
        + linha(bloco('Próximos passos', 'o que destrava o setor', passos(lista), { icone: 'aperto' })
          + metaDoMes(m.progresso, periodoNome))
        + linha(bloco('Leads gerados por mês', 'evolução até o período escolhido', barras(series, [{ chave: 'leads', rotulo: 'Leads', cls: 'c1' }]), { icone: 'pessoas' })
          + bloco(val ? 'Valor fechado por mês' : 'Negócios fechados por mês', val ? 'MRR e avulso, mês a mês' : 'mês a mês', val ? barras(series, [{ chave: 'mrr', rotulo: 'MRR', cls: 'c1' }, { chave: 'avulso', rotulo: 'Avulso', cls: 'c2' }], { fmt: reais }) : barras(series, [{ chave: 'negocios', rotulo: 'Negócios', cls: 'c1' }]), { icone: 'dinheiro' }))
        + linha(bloco('Funil por fase', `taxa de ganho ${pct(R.taxa_ganho)} · ${num(R.total ?? 0)} oportunidades · ${num(neg.quantidade ?? 0)} em negociação${val ? ` (MRR ${reais(neg.mensal)} · avulso ${reais(neg.avulso)})` : ''}`, deitadas(fases.map((f) => ({ nome: f.nome, valor: f.atual, sub: f.conversao != null ? `conversão para a próxima: ${pct(f.conversao)}` : '' })), { vazio: 'Nenhuma oportunidade no funil.' }), { icone: 'alta', acao: abrirAba('funil') })
          + bloco('Corrida comercial', 'quem mais fechou no período', corrida.length ? `<ol class="vs-corrida">${corrida.map((x) => `<li><span class="pos${x.posicao === 1 ? ' ouro' : ''}">${x.posicao}º</span><b>${esc(x.nome)}</b><small>${num(x.quantidade)} negócio${x.quantidade === 1 ? '' : 's'}${val && x.total != null ? ' · ' + reais(x.total) : ''}</small></li>`).join('')}</ol>` : aviso('Ninguém fechou negócio neste período ainda.'), { icone: 'trofeu' }))
        + bloco('Motivos de perda', 'por que os negócios não fecharam', deitadas((R.motivos_perda || []).filter((x) => x.quantidade).map((x) => ({ nome: x.nome, valor: x.quantidade, cls: 'ruim', sub: pct(x.percentual) + ' das perdas' })), { vazio: 'Nenhuma perda registrada.' }), { icone: 'alerta', acao: abrirAba('funil', 'Filtrar no funil') });
    },

    async 'setor:financas'() {
      // Com o Vybe Finanças ligado, o dinheiro vem dele (Paulo, 08/11: "o que for gasto, finança, salários puxa do Vybe Finanças");
      // as tabelas de dinheiro do próprio Vybe OS estão vazias e deixavam o painel todo em R$ 0.
      const vf = await ler('/api/painel?area=vybe_financas&parte=comercial&mes=' + String(per.mes).slice(0, 7));
      // Próximos passos e meta do mês (redesign, quadro 57: o mesmo desenho do Comercial), das leituras das abas.
      const [fin, ina, con, funil, cart] = await Promise.all([ler('/api/painel?area=comercial&aba=financas'), ler('/api/painel?area=comercial&aba=inadimplencia'),
        ler('/api/painel?area=comercial&aba=contas' + qPeriodo()), ler('/api/painel?area=comercial&aba=funil' + qPeriodo()), ler('/api/painel?area=carteira')]);
      const ligado = !vf.falha && vf.conectado && vf.resumo;
      const periodoNome = per.tipo === 'anual' ? String(per.mes).slice(0, 4) : nomeMes(per.mes);
      const proximos = () => {
        const lista = [], semContrato = (fin.clientes || []).filter((c) => !(Number(c.valor_mensal) > 0)).length;
        const atraso = ligado ? (vf.inadimplencia?.clientes || []).length : (ina.clientes || []).length;
        const hoje = new Date().toISOString().slice(0, 10), em30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
        const renovam = contratosAtivos(cart).filter((c) => c.renovacao && c.renovacao >= hoje && c.renovacao <= em30);
        if (!ligado && !vf.falha) lista.push({ ponto: 'c', titulo: 'Ligar o Vybe Finanças', sub: 'até lá, a margem é estimada pelo contrato e pelas horas do time', ir: ['financas', 'Ver como'] });
        if (atraso) lista.push({ ponto: 'r', titulo: `${num(atraso)} cliente${atraso === 1 ? '' : 's'} em atraso`, sub: 'cobrar antes de virar inadimplência', ir: ['inadimplencia', 'Inadimplência'] });
        if (!fin.falha && semContrato) lista.push({ ponto: 'a', titulo: `${num(semContrato)} cliente${semContrato === 1 ? '' : 's'} sem contrato informado`, sub: 'sem o valor do contrato não há margem', ir: ['financas', 'Informar'] });
        if (Number(con.resumo?.a_pagar)) lista.push({ ponto: 'c', titulo: `${reais(con.resumo.a_pagar)} a pagar no período`, sub: 'contas lançadas ainda em aberto', ir: ['contas', 'Contas'] });
        if (renovam.length) lista.push({ ponto: 'c', titulo: `${num(renovam.length)} contrato${renovam.length === 1 ? ' renova' : 's renovam'} em 30 dias`, sub: renovam.slice(0, 4).map((c) => `${cliCor(nomeDoCliente(c.cliente_id))} ${diaMes(c.renovacao)}`).join(' · ') });
        return linha(bloco('Próximos passos', 'o que destrava o setor', passos(lista), { icone: 'aperto' })
          + metaDoMes(funil.mes?.progresso, periodoNome, { filtro: (x) => x.tipo === 'dinheiro', titulo: 'Meta de vendas do mês' }));
      };
      if (ligado) {
        const R = vf.resumo, I = vf.inadimplencia || {}, Fo = vf.folha || {}, D = vf.despesas || {};
        // Cartão estreito: "R$ 28,5 mil" cabe, "R$ 28.500" cortava. Barras lado a lado: "64 mil" não encosta no vizinho.
        const rs = (v) => (Math.abs(Number(v)) >= 1e4 ? 'R$ ' + curto(v) : reais(v));
        const milInteiro = (v) => { const n = Number(v) || 0; return n >= 1e3 ? Math.round(n / 1e3).toLocaleString('pt-BR') + ' mil' : String(Math.round(n)); };
        const serie = (vf.series || []).slice(-6).map((m) => ({ ...m, rotulo: mesCurto(m.mes) }));
        const margens = [...(vf.margens || [])].filter((c) => c.mes && c.mes.receita > 0).sort((a, b) => (a.mes.margem_percentual ?? 0) - (b.mes.margem_percentual ?? 0)).slice(0, 6);
        const kpis = kpi({ icone: 'aperto', titulo: 'Recebido no mês', valor: rs(R.recebido), sub: `de ${reais(R.previsto)} previsto${R.recebido_percentual != null ? ` · ${pct(R.recebido_percentual)}` : ''}` })
          + kpi({ icone: 'relogio', titulo: 'Pendente', valor: rs(R.pendente), cls: Number(R.pendente) > 0 ? 'atencao' : '', sub: R.clientes_sem_lancamento ? `${num(R.clientes_sem_lancamento)} mensalidade${R.clientes_sem_lancamento === 1 ? '' : 's'} sem lançamento` : '' })
          + // A folha tem o cartão dela: aqui só as outras despesas (auditoria 09/11; antes os dois cartões davam o mesmo valor).
          kpi({ icone: 'caixa', titulo: 'Outras despesas', valor: rs(R.despesas_sem_folha ?? Number(R.despesas_pagas) + Number(R.despesas_pendentes)), sub: R.despesas_sem_folha != null ? `sem a folha · total ${reais(Number(R.despesas_pagas) + Number(R.despesas_pendentes))}` : `pagas ${reais(R.despesas_pagas)} · a pagar ${reais(R.despesas_pendentes)}` })
          + kpi({ icone: 'dinheiro', titulo: 'Folha do mês', valor: rs(Fo.total), variacao: Fo.variacao_percentual ?? 'sem', contra: 'vs mês anterior', inverte: true, sub: `${num(Fo.quantidade)} pessoa${Fo.quantidade === 1 ? '' : 's'}` })
          + kpi({ icone: 'alta', titulo: 'Resultado', valor: rs(R.resultado), cls: Number(R.resultado) < 0 ? 'ruim' : '', sub: 'recebido − despesas pagas' })
          + kpi({ icone: 'alerta', titulo: 'Em atraso', valor: rs(I.total), sub: `${num((I.clientes || []).length)} clientes · ${num(I.criticos)} críticos`, cls: Number(I.total) > 0 ? 'ruim' : '' });
        return `<p class="vs-fonte">fonte: Vybe Finanças</p><div class="vs-kpis">${kpis}</div>` + proximos()
          + linha(bloco('Faturamento × custos', 'recebido e gasto nos últimos meses', barras(serie, [{ chave: 'faturamento', rotulo: 'Faturamento', cls: 'c3' }, { chave: 'custos', rotulo: 'Custos', cls: 'c4' }], { fmt: reais, curtoFmt: milInteiro }), { icone: 'caixa', acao: abrirAba('financas') })
            + bloco('Despesas por categoria', D.total ? `${reais(D.total)} no mês` : '', deitadas((D.categorias || []).slice(0, 6).map((c) => ({ nome: c.categoria, valor: c.total, rotulo: `${reais(c.total)} <small>${pct(c.percentual)}</small>` })), { vazio: 'Nenhuma despesa lançada no mês.' }), { icone: 'caixa', acao: abrirAba('contas') }))
          + linha(bloco('Margem real por cliente', 'recebido − gasto com o cliente no mês, os menores primeiro', deitadas(margens.map((c) => ({ cli: true, nome: c.cliente_nome, valor: Math.max(0, c.mes.margem_percentual ?? 0), cls: (c.mes.margem_percentual ?? 0) < 20 ? 'ruim' : 'ok', rotulo: pct(c.mes.margem_percentual), sub: `${reais(c.mes.receita)} recebido · ${reais(c.mes.despesas)} gasto` })), { vazio: 'Nenhum cliente com receita lançada no mês.' }), { icone: 'dinheiro', acao: abrirAba('financas') })
            + bloco('Inadimplência', 'receitas vencidas e não pagas', deitadas((I.clientes || []).slice(0, 6).map((c) => ({ cli: true, nome: c.cliente_nome, valor: c.valor, cls: c.atraso_mais_antigo > 30 ? 'ruim' : 'atencao', rotulo: reais(c.valor), sub: `${num(c.atraso_mais_antigo)} dias · ${num(c.faturas)} lançamento${c.faturas === 1 ? '' : 's'}` })), { vazio: 'Ninguém em atraso.' }), { icone: 'alerta', acao: abrirAba('inadimplencia') }));
      }
      const [rec, cx] = await Promise.all([ler('/api/painel?area=comercial&aba=recebimentos' + qPeriodo()), ler('/api/painel?area=comercial&aba=caixa')]);
      if (fin.falha === 'negado') return aviso('O painel de Finanças é dos donos e da administração.');
      if (fin.falha && rec.falha) return aviso(falhaTexto(fin));
      // Sem dados no mês, os números aparecem com traço (não um zero inventado), cada um com o caminho para a aba.
      const F = fin.resumo || {}, A = rec.resumo?.atual || {}, VR = rec.resumo?.variacao || {}, K = con.resumo || {}, semNumeros = !fin.resumo && !rec.resumo;
      periodoSemEfeito = semNumeros;
      const contra = per.tipo === 'anual' ? 'vs ano anterior' : 'vs mês anterior', vr = (v) => (semNumeros ? null : v ?? 'sem');
      const varResultado = K.resultado_anterior ? ((K.resultado - K.resultado_anterior) / Math.abs(K.resultado_anterior)) * 100 : 'sem';
      const kpis = kpi({ icone: 'dinheiro', titulo: 'Receita contratada', valor: reais(F.receita), sub: `margem <b>${pct(F.margem_percentual)}</b> · custo ${reais(F.custo)}`, ir: ['financas', 'Por cliente'] })
        + kpi({ icone: 'aperto', titulo: 'Recebido', valor: reais(A.recebido), variacao: vr(VR.recebido), contra, sub: `de ${reais(A.a_receber)} a receber`, ir: ['recebimentos', 'Recebimentos'] })
        + kpi({ icone: 'relogio', titulo: 'Pendente', valor: reais(A.pendente), variacao: vr(VR.pendente), contra, inverte: true, cls: Number(A.pendente) > 0 ? 'atencao' : '' })
        + kpi({ icone: 'caixa', titulo: 'Contas', valor: reais(K.total), variacao: vr(K.variacao_total), contra, inverte: true, sub: `${pct(K.percentual_faturamento)} do faturamento · a pagar ${reais(K.a_pagar)}`, ir: ['contas', 'Contas a pagar'] })
        + kpi({ icone: 'alta', titulo: 'Resultado', valor: reais(K.resultado), variacao: semNumeros ? null : varResultado, contra, cls: Number(K.resultado) < 0 ? 'ruim' : '' })
        + kpi({ icone: 'alerta', titulo: 'Em atraso', valor: reais(ina.total), sub: `${num((ina.clientes || []).length)} clientes · ${num(ina.criticos ?? 0)} críticos`, cls: Number(ina.total) > 0 ? 'ruim' : '', ir: ['inadimplencia', 'Inadimplência'] });
      const prev = (cx.previsao?.meses || []).map((m) => ({ ...m, rotulo: mesCurto(m.mes) }));
      const piores = [...(fin.clientes || [])].filter((c) => c.margem_percentual != null && c.valor_mensal > 0).sort((a, b) => a.margem_percentual - b.margem_percentual).slice(0, 6);
      return `<div class="vs-kpis">${kpis}</div>` + proximos()
        + linha(bloco('Previsão de caixa', 'entradas e saídas dos próximos meses', cx.falha ? aviso(falhaTexto(cx)) : barras(prev, [{ chave: 'entradas', rotulo: 'Entradas', cls: 'c3' }, { chave: 'saidas', rotulo: 'Saídas', cls: 'c4' }], { fmt: reais }), { icone: 'caixa', acao: abrirAba('caixa') })
          + bloco('Contas por grupo', K.total ? `${pct(K.fixo_percentual)} fixo · ${pct(K.variavel_percentual)} variável` : '', con.falha ? aviso(falhaTexto(con)) : deitadas((K.grupos || []).filter((g) => g.total).map((g) => ({ nome: g.nome, valor: g.total, rotulo: `${reais(g.total)} <small>${pct(g.percentual_faturamento)}</small>` })), { fmt: reais, vazio: 'Nenhuma conta neste período.' }), { icone: 'doc', acao: abrirAba('contas') }))
        + linha(bloco('Margem por cliente', 'os de menor margem primeiro', deitadas(piores.map((c) => ({ cli: true, nome: c.cliente_nome, valor: Math.max(0, c.margem_percentual), cls: c.zona_critica ? 'ruim' : 'ok', rotulo: pct(c.margem_percentual), sub: `${reais(c.valor_mensal)} por mês · custo ${reais(c.custo)}` })), { vazio: 'Nenhum cliente com pacote e custo cadastrados.' }), { icone: 'dinheiro', acao: abrirAba('financas') })
          + bloco('Inadimplência', 'quem está em atraso e há quanto tempo', ina.falha ? aviso(falhaTexto(ina)) : deitadas((ina.clientes || []).slice(0, 6).map((c) => ({ cli: true, nome: c.cliente_nome, valor: c.valor, cls: c.severidade?.nivel === 'u1' ? 'ruim' : 'atencao', rotulo: reais(c.valor), sub: `${num(c.atraso_mais_antigo)} dias · ${num(c.faturas)} fatura${c.faturas === 1 ? '' : 's'}` })), { vazio: 'Ninguém em atraso.' }), { icone: 'alerta', acao: abrirAba('inadimplencia') }));
    },

    async 'setor:clientes'() {
      const N = ctx.numeros(), C = N?.cobertura || {}, cl = N?.clientes || [];
      const saude = typeof window.VybeCarteira?.dados === 'function' ? window.VybeCarteira.dados() : [];
      const cart = await ler('/api/painel?area=carteira');
      const nomeDe = new Map((typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : []).map((c) => [String(c.id), c.nome]));
      const contratos = (cart.contratos?.lista || []).filter((c) => !/encerr|cancel/i.test(String(c.status || '')));
      const churn = cart.churn?.registros || [];
      const hoje = new Date().toISOString().slice(0, 10), em30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), mes = mesAtual();
      const mrr = contratos.reduce((s, c) => s + (Number(c.valor_mensal) || 0), 0);
      const renov = contratos.filter((c) => c.renovacao && c.renovacao >= hoje && c.renovacao <= em30).sort((a, b) => String(a.renovacao).localeCompare(String(b.renovacao)));
      const saidasMes = churn.filter((r) => String(r.saiu_em || '').startsWith(mes));
      const media = saude.length ? saude.reduce((s, c) => s + (Number(c.score) || 0), 0) / saude.length : null;
      const conta = (k) => cl.filter((c) => c.saude === k).length;
      const meses = Array.from({ length: 6 }, (_, i) => somarMes(mes, i - 5));
      const fluxo = meses.map((m) => ({ rotulo: mesCurto(m), entradas: contratos.filter((c) => String(c.inicio || '').startsWith(m)).length, saidas: churn.filter((r) => String(r.saiu_em || '').startsWith(m)).length }));
      const semCart = cart.falha ? falhaTexto(cart) : !cart.contratos ? 'Sem dados de contratos agora.' : '';
      const kpis = kpi({ icone: 'pessoas', titulo: 'Clientes ativos', valor: num(C.clientesAtivos), sub: `${num(conta('critico'))} críticos · ${num(conta('atencao'))} em atenção` })
        + kpi({ icone: 'coracao', titulo: 'Saúde média', valor: media == null ? '—' : num(media), sub: 'nota de 0 a 100', cls: media != null && media < 60 ? 'atencao' : '' })
        + kpi({ icone: 'dinheiro', titulo: 'MRR em contratos', valor: semCart ? '—' : reais(mrr), sub: semCart || `${num(contratos.length)} contratos · ticket ${reais(contratos.length ? mrr / contratos.length : null)}` })
        + kpi({ icone: 'calendario', titulo: 'Renovam em 30 dias', valor: semCart ? '—' : num(renov.length), sub: semCart ? '' : renov.length ? reais(renov.reduce((s, c) => s + (Number(c.valor_mensal) || 0), 0)) + ' por mês' : 'nenhuma agora', cls: renov.length ? 'atencao' : '' })
        + kpi({ icone: 'saida', titulo: 'Saídas no mês', valor: semCart ? '—' : num(saidasMes.length), sub: semCart ? '' : saidasMes.length ? `receita perdida ${reais(saidasMes.reduce((s, r) => s + (Number(r.receita_mensal) || 0), 0))}` : 'nenhuma saída', cls: saidasMes.length ? 'ruim' : '' })
        + kpi({ icone: 'doc', titulo: 'Sem planejamento', valor: num((C.semPlanejamento || []).length), sub: 'do mês atual ou seguinte', cls: (C.semPlanejamento || []).length ? 'atencao' : '' });
      const piores = [...saude].sort((a, b) => (a.score ?? 999) - (b.score ?? 999)).slice(0, 6);
      return `<div class="vs-kpis">${kpis}</div>`
        + linha(bloco('Entradas e saídas', 'clientes que começaram e que saíram, últimos 6 meses', semCart ? aviso(semCart) : barras(fluxo, [{ chave: 'entradas', rotulo: 'Entradas', cls: 'c3' }, { chave: 'saidas', rotulo: 'Saídas', cls: 'c4' }]), { icone: 'alta', acao: abrirAba('churn') })
          + bloco('Saúde da carteira', 'quantos clientes em cada faixa', cl.length ? deitadas([{ nome: 'Em dia', valor: conta('ok'), cls: 'ok' }, { nome: 'Em atenção', valor: conta('atencao'), cls: 'atencao' }, { nome: 'Críticos', valor: conta('critico'), cls: 'ruim' }]) : aviso('As demandas ainda estão carregando.'), { icone: 'coracao', acao: abrirAba('carteira') }))
        + linha(bloco('Clientes prioritários', 'a menor nota de saúde primeiro', deitadas(piores.map((c) => ({ cli: true, nome: c.cliente, valor: c.score, cls: c.score < 50 ? 'ruim' : c.score < 70 ? 'atencao' : 'ok', sub: (c.motivos || []).slice(0, 2).join(' · ') })), { vazio: 'A saúde ainda está sendo calculada.' }), { icone: 'alerta', acao: abrirAba('clientes', 'Todos os clientes') })
          + bloco('Renovações próximas', 'contratos que renovam em 30 dias', semCart ? aviso(semCart) : deitadas(renov.slice(0, 6).map((c) => ({ cli: true, nome: nomeDe.get(String(c.cliente_id)) || 'Cliente', valor: c.valor_mensal, rotulo: diaMes(c.renovacao), sub: reais(c.valor_mensal) + ' por mês' })), { vazio: 'Nenhuma renovação nos próximos 30 dias.' }), { icone: 'calendario', acao: abrirAba('contratos') }));
    },

    async 'setor:producao'() {
      const N = ctx.numeros(), F = ctx.fila(), H = N?.hoje || {}, L = H.lista || {}, S = N?.semana || {}, Hi = N?.historico || {}, P = N?.projecao || {}, C = N?.cobertura || {};
      if (!N) return aviso('As demandas ainda estão carregando. O painel aparece assim que elas chegarem.');
      const minhas = F?.itens || [], minhasAtr = minhas.filter((x) => x.sit === 'atrasada').length;
      const itens = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : [];
      const emAprov = itens.filter((d) => /aprova/i.test(String(d.status || ''))).length;
      const prox = P.proximaSemana || {};
      // Redesign (quadro 15, 10/11/2026): "Pede ação" primeiro, cada linha com o botão de resolver; os seis números viram
      // uma linha de resumo (zero discreto) e o gráfico só aparece com histórico. Os mesmos números e alertas de antes.
      const atrasadas = H.atrasadas ?? (L.atrasadas || []).length, emRisco = H.emRisco ?? (L.emRisco || []).length;
      const prontas = S.previstasEntregues ?? S.entregues;
      const resumo = resumoProducao({ prontas, previstas: S.previstas, entregues: S.entregues, noPrazo: Hi.mediaNoPrazoPct, atrasadas, emRisco, emAprov, prox, fila: minhas.length, filaAtr: minhasAtr });
      const semanas = (Hi.semanas || []).slice(-12).map((s) => ({ ...s, rotulo: diaMes(s.inicio) }));
      const comHistorico = semanas.filter((s) => Number(s.previstas) > 0 || Number(s.entregues) > 0).length >= 2;
      const entregasHtml = comHistorico ? barras(semanas, [{ chave: 'previstas', rotulo: 'Previstas', cls: 'c5' }, { chave: 'entregues', rotulo: 'Entregues', cls: 'c1' }])
        : aviso(`Sem histórico ainda: o gráfico aparece com duas semanas de entregas. Nesta semana, ${num(prontas)} de ${num(S.previstas)} previstas prontas.`);
      const time = [...(N.time || [])].sort((a, b) => (b.abertas || 0) - (a.abertas || 0)).slice(0, 8);
      const porCliente = [...(N.clientes || [])].filter((c) => c.atrasadas || c.emRisco).sort((a, b) => (b.atrasadas || 0) - (a.atrasadas || 0) || (b.emRisco || 0) - (a.emRisco || 0)).slice(0, 6);
      const gargalos = (N.gargalos || []).slice(0, 6);
      const ag = ctx.agenda?.();
      const tipoAg = (t) => (t === 'captacao' ? 'Captação' : t === 'reuniao' ? 'Reunião' : 'Compromisso');
      return bloco('Pede ação', 'o que resolver hoje, do mais grave ao menos grave', pedeAcaoProducao(N, minhasAtr), { icone: 'alerta', cls: 'vs-destaque vs-pede' })
        + resumo
        + linha(bloco('Entregas por semana', `previstas e entregues · mediana ${num(Hi.medianaEntregues)} por semana`, entregasHtml, { icone: 'alta', acao: abrirAba('gestor', 'Painel de trabalho') })
          + bloco('Carga do time', 'peças abertas por pessoa', deitadas(time.map((t) => ({ nome: t.pessoa, valor: t.abertas, cls: t.atrasadas ? 'atencao' : '', rotulo: `${num(t.abertas)}${t.atrasadas ? ` <small class="t-ruim">${num(t.atrasadas)} atras.</small>` : ''}`, sub: `${num(t.entregues7d)} entregues em 7 dias` })), { vazio: 'Sem números do time.' }), { icone: 'pessoas', acao: abrirAba('tarefas', 'Minhas tarefas') }))
        + linha(bloco('Onde trava', 'peças paradas por status, a pior primeiro', deitadas(gargalos.map((g) => ({ st: true, nome: g.status, valor: g.qtd, cls: g.idadeMedianaDias >= 3 ? 'ruim' : 'atencao', rotulo: `${num(g.qtd)} <small>${num(g.idadeMedianaDias)} d</small>`, sub: `${num(g.qtd)} peças, paradas há ${num(g.idadeMedianaDias)} dias (mediana)` })), { vazio: 'Nada parado na janela de produção.' }), { icone: 'relogio', acao: abrirAba('direcao') })
          + bloco('Clientes com atraso', 'atrasadas e risco de furo por cliente', deitadas(porCliente.map((c) => ({ cli: true, nome: c.cliente, valor: (c.atrasadas || 0) + (c.emRisco || 0), cls: c.atrasadas ? 'ruim' : 'atencao', rotulo: `${num(c.atrasadas)} <small>+${num(c.emRisco)} risco</small>` })), { vazio: 'Nenhum cliente com atraso ou risco.' }), { icone: 'alerta' }))
        + linha(bloco('Cobertura da semana', `meta de ${num(C.meta || 3)} posts por cliente`, deitadas([{ nome: `Abaixo de ${num(C.meta || 3)} posts`, valor: (C.sem3 || []).length, cls: 'atencao' }, { nome: 'Sem nenhum post', valor: (C.semConteudo || []).length, cls: 'ruim' }, { nome: 'Próxima semana abaixo', valor: (C.proximaSemanaSem3 || []).length, cls: 'atencao' }, { nome: 'Sem planejamento', valor: (C.semPlanejamento || []).length, cls: 'atencao' }]), { icone: 'doc', acao: abrirAba('conteudo') })
          + bloco('Próximos compromissos', 'agenda dos próximos 7 dias', Array.isArray(ag) && ag.length ? `<ul class="vs-agenda">${ag.slice(0, 6).map((e) => `<li><time>${esc(diaMes(e.dia))}${e.inicio ? ' · ' + esc(e.inicio) : ''}</time><b>${esc(e.cliente || e.titulo || 'Compromisso')}</b><small>${esc(tipoAg(e.tipo))}</small></li>`).join('')}</ul>` : aviso(Array.isArray(ag) ? 'Nada na agenda dos próximos 7 dias.' : 'A agenda ainda está carregando.'), { icone: 'calendario', acao: abrirAba('agenda') }));
    },

    async 'setor:pessoas'() {
      const [prod, carga] = await Promise.all([ler('/api/painel?area=setor_pessoas&aba=produtividade&mes=' + mesAtual()), (async () => { try { return await window.VybePessoas?.carga?.(); } catch { return null; } })()]);
      const P = carga?.pessoas || [], rk = prod.ranking || [], T = ctx.numeros()?.time || [];
      const e = typeof escritorio !== 'undefined' ? escritorio : null, online = (e?.conectado ? e.onlineTodos || e.online : e?.lobbyOnline) || [];
      const naEquipe = P.length || rk.length || (typeof TEAM_USERS !== 'undefined' && Array.isArray(TEAM_USERS) ? TEAM_USERS.length : 0);
      const entregues = rk.reduce((s, p) => s + (p.entregues || 0), 0), comData = rk.reduce((s, p) => s + (p.comData || 0), 0), noPrazo = rk.reduce((s, p) => s + (p.noPrazo || 0), 0);
      const atrasadas = rk.length ? rk.reduce((s, p) => s + (p.atrasadas || 0), 0) : P.length ? P.reduce((s, p) => s + (Number(p.atrasadas) || 0), 0) : T.reduce((s, t) => s + (t.atrasadas || 0), 0);
      const cheias = P.filter((p) => Number(p.pct) >= 100).length;
      const kpis = kpi({ icone: 'pessoas', titulo: 'Equipe', valor: num(naEquipe), sub: `${num(online.length)} online agora` })
        + kpi({ icone: 'aperto', titulo: 'Entregues no mês', valor: rk.length ? num(entregues) : '—', sub: rk.length ? nomeMes(prod.mes) : (prod.falha ? 'o ranking é da gestão' : 'nenhuma ainda') })
        + kpi({ icone: 'relogio', titulo: 'No prazo', valor: comData ? pct((noPrazo / comData) * 100) : '—', sub: 'das entregas com data' })
        + kpi({ icone: 'alerta', titulo: 'Atrasadas', valor: num(atrasadas), cls: atrasadas ? 'ruim' : '' })
        + kpi({ icone: 'calendario', titulo: 'Semana cheia', valor: num(cheias), sub: 'pessoas com 100% ou mais', cls: cheias ? 'atencao' : '' });
      const ranking = rk.slice(0, 8).map((p) => ({ nome: p.nome, valor: p.entregues, meta: p.meta || 0, cls: p.meta && p.entregues >= p.meta ? 'ok' : '', rotulo: `${num(p.entregues)}${p.meta ? ` <small>/ ${num(p.meta)}</small>` : ''}`, sub: p.cargoNome || '' }));
      const cargaL = [...P].sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0)).slice(0, 8).map((p) => ({ nome: p.nome, valor: Math.min(150, Number(p.pct) || 0), cls: Number(p.pct) >= 100 ? 'ruim' : Number(p.pct) >= 80 ? 'atencao' : 'ok', rotulo: pct(p.pct), sub: `${num(p.pecas)} peças · ${num(p.etapas)} etapas de projeto` }));
      return `<div class="vs-kpis">${kpis}</div>`
        + linha(bloco('Entregas do mês e meta', 'por pessoa (a marca é a meta proporcional até hoje)', rk.length ? deitadas(ranking) : aviso(prod.falha ? falhaTexto(prod) : 'Sem entregas no mês.'), { icone: 'trofeu', acao: abrirAba('produtividade') })
          + bloco('Carga da semana', 'peças e etapas abertas sobre a capacidade', deitadas(cargaL, { vazio: 'Sem números de carga agora.' }), { icone: 'relogio', acao: abrirAba('equipe') }))
        + linha(bloco('Entregas em 7 dias', 'por pessoa, das demandas do painel', deitadas([...T].sort((a, b) => (b.entregues7d || 0) - (a.entregues7d || 0)).slice(0, 8).map((t) => ({ nome: t.pessoa, valor: t.entregues7d, cls: 'ok', sub: `${num(t.abertas)} abertas` })), { vazio: 'Sem entregas nos últimos 7 dias.' }), { icone: 'aperto' })
          + bloco('Atrasos e riscos por pessoa', 'o que cobrar hoje', deitadas(T.filter((t) => t.atrasadas || t.emRisco).slice(0, 8).map((t) => ({ nome: t.pessoa, valor: (t.atrasadas || 0) + (t.emRisco || 0), cls: t.atrasadas ? 'ruim' : 'atencao', rotulo: `${num(t.atrasadas)} <small>+${num(t.emRisco)} risco</small>`, sub: (t.cobrar || [])[0] || '' })), { vazio: 'Ninguém com atraso ou risco.' }), { icone: 'alerta' }));
    },
  };

  async function pintar() {
    if (el.hidden || !ctx) return;
    const g = ++geracao, montar = PAINEIS[atual], comPeriodo = atual === 'setor:comercial' || atual === 'setor:financas';
    el.innerHTML = `<div class="vv-g-topo vs-topo"><span><small class="vv-cb-kicker">Visão geral</small><h2>${esc(ctx.nome)}</h2><p>${esc(ctx.dica || '')}</p></span>
      <span class="vv-g-acoes">${comPeriodo ? barraPeriodo() : ''}<button type="button" class="vv-botao" data-setor-atualizar aria-label="Atualizar" title="Atualizar">↻</button><button type="button" class="vv-botao" data-setor-fechar aria-label="Fechar">✕</button></span></div>
      ${atalhos()}<div class="vv-g-corpo vs-corpo">${carregando()}</div>`;
    let corpo;
    periodoSemEfeito = false;
    try {
      corpo = montar ? await montar() : '';
    } catch (e) {
      console.error('[setor]', e);
      corpo = typeof window.vbEstadoHtml === 'function'
        ? window.vbEstadoHtml({ tipo: 'erro', titulo: 'Não deu para montar o painel', texto: 'As abas continuam abrindo pelos atalhos acima.', acao: '<button type="button" class="vb-botao" data-setor-atualizar>Tentar de novo</button>' })
        : '<p>Não deu para montar o painel.</p>';
    }
    if (g !== geracao || el.hidden) return;
    el.querySelector('.vs-corpo').innerHTML = corpo;
    if (periodoSemEfeito && per.tipo === 'mensal' && per.mes === mesAtual()) { const barra = el.querySelector('.vs-topo .vs-periodo'); if (typeof barra?.remove === 'function') barra.remove(); }
  }

  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-setor-fechar')) { fechar(); ctx?.aoFechar?.(); return; }
    if (b.hasAttribute('data-setor-atualizar')) { cache.clear(); pintar(); return; }
    if (b.dataset.vsTipo) { per.tipo = b.dataset.vsTipo; pintar(); return; }
    // A gaveta da peça fica abaixo das janelas de módulo: a visão geral volta para o Hoje e a peça abre por cima dele.
    if (b.dataset.vsPeca) { const id = b.dataset.vsPeca, c = ctx; fechar(); c?.aoFechar?.(); setTimeout(() => { if (typeof window.openItemWorkspace === 'function') window.openItemWorkspace(id); }, 0); return; }
    if (b.dataset.setorIr) ctx?.irSetor?.(b.dataset.setorIr);
    else if (b.dataset.setorSub) ctx?.abrirSub?.(b.dataset.setorSub);
  });
  el.addEventListener('change', (ev) => { if (ev.target.matches?.('[data-vs-mes]')) { per.mes = ev.target.value; pintar(); } });

  function abrir(setor, contexto) {
    atual = setor; ctx = contexto; el.hidden = false; el.scrollTop = 0;
    document.body.classList.add('mundo-setor-visao');
    pintar();
  }
  function fechar() {
    if (el.hidden) return;
    el.hidden = true; atual = ''; geracao++;
    document.body.classList.remove('mundo-setor-visao');
  }
  let alvoEm = null, geracaoEm = 0;
  async function pintarEm(destino, setor, contexto) {
    if (!destino || !PAINEIS[setor]) return;
    ctx = contexto; alvoEm = { destino, setor, contexto };
    const g = ++geracaoEm;
    destino.innerHTML = `<div class="vs-em-topo">${barraPeriodo()}<button type="button" class="vv-botao" data-setor-atualizar aria-label="Atualizar" title="Atualizar">↻</button></div><div class="vs-corpo">${carregando()}</div>`;
    if (!destino.dataset.vsOuvindo) {
      destino.dataset.vsOuvindo = '1';
      destino.addEventListener('click', (ev) => {
        const b = ev.target.closest('button'); if (!b || !alvoEm) return;
        if (b.hasAttribute('data-setor-atualizar')) { cache.clear(); pintarEm(alvoEm.destino, alvoEm.setor, alvoEm.contexto); return; }
        if (b.dataset.vsTipo) { per.tipo = b.dataset.vsTipo; pintarEm(alvoEm.destino, alvoEm.setor, alvoEm.contexto); return; }
        if (b.dataset.setorIr) alvoEm.contexto?.irSetor?.(b.dataset.setorIr);
        else if (b.dataset.setorSub) alvoEm.contexto?.abrirSub?.(b.dataset.setorSub);
      });
      destino.addEventListener('change', (ev) => { if (ev.target.matches?.('[data-vs-mes]') && alvoEm) { per.mes = ev.target.value; pintarEm(alvoEm.destino, alvoEm.setor, alvoEm.contexto); } });
    }
    let corpo;
    try { corpo = await PAINEIS[setor](); } catch (e) {
      console.error('[setor]', e);
      corpo = typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo: 'erro', titulo: 'Não deu para montar o painel', texto: 'As outras abas continuam abrindo.', acao: '<button type="button" class="vb-botao" data-setor-atualizar>Tentar de novo</button>' }) : '<p>Não deu para montar o painel.</p>';
    }
    if (g !== geracaoEm || !destino.isConnected) return;
    const c = destino.querySelector('.vs-corpo'); if (c) c.innerHTML = corpo;
  }
  // As peças do painel, para as abas da Gestão usarem o mesmo desenho (sem uma segunda versão delas).
  const pecas = Object.freeze({ kpi, bloco, barras, deitadas, linha, progresso });
  window.VybeSetor = Object.freeze({ abrir, fechar, aberto: () => (el.hidden ? '' : atual), atualizar: () => pintar(), pintarEm, pecas });
})();
