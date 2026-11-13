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
  function kpi({ icone = 'meta', titulo, valor, sub = '', variacao = null, contra = 'vs mês anterior', inverte = false, cls = '', dica = '', espiar = '', ir = null, cartao = false }) {
    let chip = '';
    if (variacao != null && variacao !== 'sem' && Number.isFinite(Number(variacao))) {
      const v = Number(variacao), bom = inverte ? v < 0 : v > 0, ruim = inverte ? v > 0 : v < 0;
      chip = `<span class="vs-var ${bom ? 'sobe' : ruim ? 'desce' : ''}">${v > 0 ? '▲' : v < 0 ? '▼' : '•'} ${Math.abs(Math.round(v))}%</span><small>${esc(contra)}</small>`;
    } else if (variacao === 'sem') chip = `<span class="vs-var">—</span><small>${esc(contra)}</small>`;
    // Zero vira uma linha (00 Main, regra 4): número zero, "R$ 0,00" ou "—" não ganha cartão grande. Sai marcado para
    // grade() juntar numa linha discreta abaixo dos cartões, com o mesmo texto e abrindo o que o cartão abria.
    // Fora daqui (pecas.kpi) o cartão continua cartão (cartao: true); quem quer a linha usa pecas.kpiLinha com pecas.grade.
    const cru = String(valor ?? '').replace(/<[^>]*>/g, '').trim();
    if (!cartao && /^(R\$\s?0(,00)?|0(,0)?\s?%?|0\s?h|—|-)?$/.test(cru)) {
      const nome = /^[A-ZÀ-Ú][a-zà-ú]/.test(titulo || '') ? titulo.charAt(0).toLowerCase() + titulo.slice(1) : String(titulo || '');
      const mudou = variacao != null && variacao !== 'sem' && Number.isFinite(Number(variacao)) && Number(variacao) ? ` · ${Number(variacao) > 0 ? '▲' : '▼'} ${Math.abs(Math.round(Number(variacao)))}% ${esc(contra)}` : '';
      const corpo = cru === '—' || cru === '-' || cru === '' ? `${esc(titulo)}: ${/^(sem|só|nenhum|aguardando|não)/i.test(String(sub).replace(/<[^>]*>/g, '').trim()) ? sub : 'sem dado' + (sub ? ' · ' + sub : '')}` : `<b>${esc(cru)}</b> ${esc(nome)}${sub ? ' · ' + sub : ''}${mudou}`;
      const sub_ = ir && !espiar && (ctx?.subs || []).some((s) => s.id === ir[0]) ? ir[0] : '';
      const item = espiar ? `<button type="button" class="vb-resumo-item zero espiavel" data-espiar="${esc(espiar)}"${dica ? ` title="${esc(dica)}"` : ''}>${corpo}</button>`
        : sub_ ? `<button type="button" class="vb-resumo-item zero" data-setor-sub="${esc(sub_)}" title="${esc(ir[1] || 'Abrir')}">${corpo}</button>`
          : `<span class="vb-resumo-item zero"${dica ? ` title="${esc(dica)}"` : ''}>${corpo}</span>`;
      return `<!--vs-zero-->${item}<!--/vs-zero-->`;
    }
    // Com espiar, o cartão é um botão que abre a lista por trás do número (o mini painel da Gestão).
    const tag = espiar ? `button type="button" data-espiar="${esc(espiar)}"` : 'div', fim = espiar ? 'button' : 'div';
    return `<${tag} class="vs-kpi ${cls}${espiar ? ' vs-kpi-espiar' : ''}"${dica ? ` title="${esc(dica)}"` : ''}><span class="vs-kpi-topo"><i>${ic(icone)}</i><span>${esc(titulo)}</span></span>
      <b class="vs-kpi-valor">${valor}</b>${sub ? `<span class="vs-kpi-sub">${sub}</span>` : ''}${chip ? `<span class="vs-kpi-var">${chip}</span>` : ''}${ir && !espiar ? abrirAba(ir[0], ir[1]).replace('class="vs-abrir"', 'class="vs-abrir vs-kpi-ir"') : ''}</${fim}>`;
  }
  // Os cartões dos números com valor; os de zero (marcados por kpi) numa linha discreta logo abaixo.
  function grade(kpis) {
    const zeros = [], cartoes = String(kpis || '').replace(/<!--vs-zero-->([\s\S]*?)<!--\/vs-zero-->/g, (_, x) => { zeros.push(x); return ''; });
    return `${cartoes.trim() ? `<div class="vs-kpis">${cartoes}</div>` : ''}${zeros.length ? `<div class="vs-resumo vs-zeros"><div class="vb-resumo" role="group" aria-label="Sem movimento">${zeros.join('')}</div></div>` : ''}`;
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
  const linha = (corpo) => `<div class="vs-linha">${corpo}</div>`;
  // ---------- Padrão v2 (moodboard aprovado, 12/11/2026): o molde das visões gerais ----------
  // Quadros "Visão do setor" e "Gestão": a frase do agente dono, três números, o que pede ação (a linha abre no lugar)
  // e os módulos com um número cada. O que a tela antiga mostrava além disso continua a um clique, em "mostrar" no pé.
  // O desenho mora em padrao-v2/gestao.css; os movimentos são as peças .v2-* de vybe-mundo.css.
  const traco = (d, w = 2.2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I_VOLTA = traco('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>');
  const AGENTE = { vybes: ['VYBES', 'Agência inteira'], heitor: ['Heitor', 'Coordenação de produção'], mateus: ['Mateus', 'Atendimento ao cliente'], vorcaro: ['Vorcaro', 'Financeiro'], alex: ['Alex', 'Análise e números'] };
  const SETORES = [['setor:producao', 'Produção'], ['setor:clientes', 'Clientes'], ['setor:comercial', 'Comercial'], ['setor:pessoas', 'RH'], ['setor:financas', 'Finanças']];
  const hora = (d) => { const x = new Date(d || Date.now()); return new Date(Number.isFinite(x.getTime()) ? x : Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  const pl = (n, um, varios) => `${num(n ?? 0)} ${Number(n) === 1 ? um : varios}`;
  const pctDe = (a, b) => (Number(b) > 0 ? Math.max(0, Math.min(100, Math.round(((Number(a) || 0) / Number(b)) * 100))) : null);
  const btn = (rotulo, attrs = '', cls = 's') => `<button type="button" class="g2-btn ${cls}" ${attrs}>${esc(rotulo)}</button>`;
  const elo = (rotulo, attrs = '') => `<button type="button" class="g2-link" ${attrs}>${esc(rotulo)}</button>`;
  const temAba = (id) => (ctx?.subs || []).some((s) => s.id === id);
  const irAba = (id, rotulo = 'Abrir') => (temAba(id) ? btn(rotulo, `data-setor-sub="${esc(id)}"`) : '');
  const irSetor = (setor, rotulo) => btn(rotulo, `data-setor-ir="${esc(setor)}"`);
  // O botão cheio do topo (um por tela). O painel escolhe; pintar() põe no cabeçalho.
  let principal = '';
  function fala(quem, frase, { conta = [] } = {}) {
    const [nome, papel] = AGENTE[quem] || AGENTE.vybes, linhas = conta.filter(Boolean);
    return `<section class="g2-card g2-fala v2-abre" aria-expanded="false" aria-label="${esc(nome)}, ${esc(papel)}"><div class="g2-fala-lin"><span class="g2-ag" aria-hidden="true">${esc(nome.charAt(0))}</span><p><span class="g2-quem">${esc(nome)} · ${esc(papel)}</span>${frase}</p>${linhas.length ? '<button type="button" class="g2-btn s" data-g2-abre aria-expanded="false">Ver a conta</button>' : ''}</div>${linhas.length ? `<div class="v2-mais"><div><ul class="g2-conta">${linhas.map((c) => `<li>${c}</li>`).join('')}</ul></div></div>` : ''}</section>`;
  }
  // Um dos três números: rótulo, número que chega, barra (0 a 100) e a linha de baixo. Com espiar, o número abre a lista.
  function numero({ rotulo, valor, de = '', barra = null, cor = '', tom = '', sub = '', espiar = '' }, i = 0) {
    const cru = String(valor ?? '').trim(), texto = !cru || cru === '—' ? 'sem dado' : cru, frase = !/^(R\$\s?)?-?\d/.test(texto);
    const v = `<b class="g2-kpi-v ${frase ? 'frase' : tom}"><span class="v2-num"${i ? ` style="animation-delay:${(i * 0.12).toFixed(2)}s"` : ''}>${texto}</span>${de ? ` <em>${de}</em>` : ''}</b>`;
    return `<div class="g2-card g2-kpi"><small>${esc(rotulo)}</small>${espiar ? `<button type="button" class="g2-kpi-n" data-espiar="${esc(espiar)}" title="Ver a lista">${v}</button>` : v}${barra == null ? '' : `<div class="v2-barra g2-barra"><i style="--v:${Math.max(0, Math.min(100, Number(barra) || 0))}%${cor ? `;--c:${cor}` : ''}"></i></div>`}${sub ? `<small class="g2-kpi-sub">${sub}</small>` : ''}</div>`;
  }
  const tres = (lista) => `<div class="g2-tres">${lista.slice(0, 3).map(numero).join('')}</div>`;
  // Linha de "Pede ação": pílula, texto e o botão na linha. Com det, o texto abre o detalhe no lugar.
  function linhaAcao({ pill = '', tom = 'n', texto = '', botao = '', det = [], aberta = false }) {
    const abre = det.length > 0;
    const lin = `<div class="g2-lin">${pill ? `<span class="g2-pill ${tom}">${pill}</span>` : ''}${abre ? `<button type="button" class="g2-lin-txt" data-g2-abre aria-expanded="${aberta === true}">${texto}</button>` : `<p class="g2-lin-txt">${texto}</p>`}${botao}</div>`;
    return abre ? `<div class="v2-abre g2-linha" aria-expanded="${aberta === true}">${lin}<div class="v2-mais"><div><div class="g2-hists">${det.map((d) => `<p class="g2-hist">${d}</p>`).join('')}</div></div></div></div>` : `<div class="g2-linha">${lin}</div>`;
  }
  const TOM = { r: 0, a: 1, n: 2, g: 3 };
  const porGravidade = (l) => l.map((x, i) => [x, i]).sort((a, b) => (TOM[a[0].tom] ?? 2) - (TOM[b[0].tom] ?? 2) || a[1] - b[1]).map((x) => x[0]);
  // O cartão "Pede ação": as primeiras linhas à vista (a primeira com detalhe já aberta), o resto em "mostrar".
  function pede(linhas, { titulo = 'Pede ação', sub = '', vazio = 'Nada pede ação agora.', mostra = 4, resto = [], pe = '' } = {}) {
    const vis = linhas.slice(0, mostra), fora = [...linhas.slice(mostra), ...resto];
    let abriu = false;
    const corpo = (vis.length ? vis.map((l) => { const aberta = !abriu && (l.det || []).length > 0; if (aberta) abriu = true; return linhaAcao({ ...l, aberta }); }).join('') : `<p class="g2-vazio">${esc(vazio)}</p>`)
      + (fora.length ? `<div class="v2-abre g2-resto" aria-expanded="false"><div class="v2-mais"><div>${fora.map((l) => linhaAcao(l)).join('')}</div></div><p class="g2-pe">${pe || `+ ${num(fora.length)}`} · <button type="button" class="g2-link" data-g2-abre data-g2-troca="recolher" aria-expanded="false">mostrar</button></p></div>` : '');
    return `<section class="g2-card g2-pede" aria-label="${esc(titulo)}"><div class="g2-card-topo"><h3>${esc(titulo)}</h3>${sub ? `<small>${sub}</small>` : ''}</div>${corpo}</section>`;
  }
  const cartao = (titulo, sub, corpo, { cls = '', acao = '' } = {}) => `<section class="g2-card ${cls}" aria-label="${esc(titulo)}"><div class="g2-card-topo"><h3>${esc(titulo)}</h3>${acao || (sub ? `<small>${sub}</small>` : '')}</div>${corpo}</section>`;
  // Os módulos do setor, um número em cada (só onde a tela já tem o número; sem ele, o módulo só abre).
  function modulos(titulo, itens, sub = 'um número em cada, abre no clique') {
    return `<section class="g2-mods" aria-label="${esc(titulo)}"><div class="g2-card-topo"><h3>${esc(titulo)}</h3><small>${esc(sub)}</small></div><div class="g2-mods-grade">${itens.map((m) => `<button type="button" class="g2-mod" ${m.attrs || ''}${m.dica ? ` title="${esc(m.dica)}"` : ''}><small>${esc(m.nome)}${m.url ? ' ↗' : ''}</small><span>${m.n != null && m.n !== '—' ? `<b>${m.n}</b>${esc(m.rotulo || '')}` : esc(m.rotulo || 'abrir')}</span></button>`).join('')}</div></section>`;
  }
  const modulosDoSetor = (numeros = {}, extras = []) => modulos(`Módulos de ${ctx.nome}`, [...(ctx.subs || []).map((s) => ({ nome: s.nome, dica: s.dica, url: s.url, attrs: `data-setor-sub="${esc(s.id)}"`, ...(numeros[s.id] ? { n: numeros[s.id][0], rotulo: numeros[s.id][1] } : {}) })), ...extras]);
  const duas = (a, b, cls = '') => `<div class="g2-duas ${cls}">${a}${b}</div>`;
  const mais = (rotulo, corpo) => (corpo ? `<details class="g2-mais"><summary><span>${esc(rotulo)}</span><u>mostrar</u></summary><div class="g2-mais-corpo vs-corpo">${corpo}</div></details>` : '');
  const tela = (...partes) => `<div class="g2">${partes.filter(Boolean).join('')}</div>`;
  // Cliques do molde: a linha que abre no lugar e o atalho que abre o "mostrar" do pé. Devolve true quando tratou.
  function cliqueV2(b) {
    if (!b?.hasAttribute) return false;
    if (b.hasAttribute('data-g2-abre')) {
      const cx = b.closest('.v2-abre'); if (!cx) return true;
      const abrir = cx.getAttribute('aria-expanded') !== 'true';
      cx.setAttribute('aria-expanded', String(abrir)); b.setAttribute('aria-expanded', String(abrir));
      if (b.dataset.g2Troca) { const t = b.textContent; b.textContent = b.dataset.g2Troca; b.dataset.g2Troca = t; }
      return true;
    }
    if (b.hasAttribute('data-g2-mais')) {
      const d = b.closest('.g2')?.querySelector('details.g2-mais');
      if (d) { d.open = true; d.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }
      return true;
    }
    return false;
  }
  // Peças abertas agora (não entregues, nem pausadas, nem esquecidas), pela regra oficial da situação da peça.
  function abertasAgora(lista, hoje) {
    const sit = window.VybeDono?.util?.situacaoDaPeca;
    if (typeof sit !== 'function' || !Array.isArray(lista)) return null;
    let n = 0;
    for (const d of lista) { try { const s = sit(d, hoje ? { hoje } : {}); if (!s.entregue && s.situacao !== 'pausada' && s.situacao !== 'esquecida') n++; } catch { /* peça sem dado: fica fora */ } }
    return n;
  }
  const nomeCli = (c) => (typeof c === 'string' ? c : c?.cliente || c?.nome || '');
  // Alerta da operação em linha de "Pede ação": a pílula diz a pressa, o texto diz o que é e o botão resolve (uma peça
  // abre a peça; várias abrem a lista por trás do alerta; a semana cheia leva ao Painel de trabalho).
  function linhaDoAlerta(a, i, L = {}) {
    const t = String(a.texto || ''), p = t.indexOf(':'), cab = (p > 0 ? t.slice(0, p) : t).trim(), nomes = p > 0 ? t.slice(p + 1).trim() : '';
    const ids = a.ref?.tipo === 'pecas' ? a.ref.ids || [] : [], qtd = (cab.match(/^(\d+)/) || [])[1] || '';
    const forte = (s) => esc(s).replace(/^(\d+ \S+)/, '<b>$1</b>');
    let pill = a.nivel === 1 ? 'Vencido' : a.nivel === 4 ? 'Com o cliente' : 'Atenção', tom = a.nivel === 1 ? 'r' : a.nivel === 4 ? 'n' : 'a', texto = forte(cab), det = nomes ? [esc(nomes)] : [];
    if (/furando a data/.test(cab)) {
      pill = `${esc(qtd)} ${qtd === '1' ? 'atrasada' : 'atrasadas'}`; texto = qtd === '1' ? 'Peça furando a data do cliente' : 'Peças furando a data do cliente';
      const porId = new Map((L.atrasadas || []).map((x) => [String(x.id), x])), pecas = ids.map((id) => porId.get(String(id))).filter(Boolean).slice(0, 2);
      if (pecas.length) det = pecas.map((x) => `${x.cliente ? cliCor(x.cliente) + ' · ' : ''}${esc(x.nome || 'Peça')}${x.veiculacao_iso ? `, ia ao ar em ${esc(diaMes(x.veiculacao_iso))}` : ''}`);
    } else if (/sem agendar/.test(cab)) pill = 'Sem agendar';
    else if (/prazo interno/.test(cab)) pill = 'Prazo interno';
    else if (/ao ar hoje|veiculação hoje/.test(cab)) { pill = 'Hoje'; tom = 'r'; }
    else if (/risco de furo/.test(cab)) { const d = (cab.match(/próximos (\d+) dias/) || [])[1]; pill = d ? `${esc(d)} dias` : 'Risco'; texto = forte(cab.replace(/ nos próximos \d+ dias/, '')); }
    else if (/sem nenhum conteúdo/.test(cab)) pill = 'Esta semana';
    else if (/travad/.test(cab)) pill = 'Travadas';
    else if (/^Gargalo/.test(cab)) pill = 'Gargalo';
    else if (/^Próxima semana/.test(cab)) pill = 'Semana cheia';
    else if (/esperando o cliente/.test(cab)) texto = `<b>${esc(qtd)} ${qtd === '1' ? 'peça' : 'peças'}</b> esperando aprovação ou informação`;
    const botao = ids.length === 1 ? btn('Abrir a peça', `data-vs-peca="${esc(ids[0])}"`)
      : a.ref?.tipo === 'semana' ? irAba('gestor', 'Ver a semana')
        : a.ref ? btn(a.nivel === 4 ? 'Cobrar' : 'Resolver', `data-espiar="alerta:${i}"`) : '';
    return { tom, pill, texto, botao, det, curto: cab.replace(/\s*\(.*\)\s*$/, '') };
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
      const [vf, fin, rec, com, cart, ina] = await Promise.all([ler('/api/painel?area=vybe_financas&parte=comercial&mes=' + mes), ler('/api/painel?area=comercial&aba=financas'),
        ler('/api/painel?area=comercial&aba=recebimentos' + qPeriodo()), ler('/api/painel?area=comercial&aba=funil' + qPeriodo()), ler('/api/painel?area=carteira'), ler('/api/painel?area=comercial&aba=inadimplencia')]);
      const contra = per.tipo === 'anual' ? 'vs ano anterior' : 'vs mês anterior';
      const rs = (v) => (Math.abs(Number(v)) >= 1e4 ? 'R$ ' + curto(v) : reais(v));
      // Dinheiro
      const temVF = !vf.falha && vf.conectado && vf.resumo, VR = vf.resumo || {};
      const F = fin.resumo || {}, RA = rec.resumo?.atual || {}, RV = rec.resumo?.variacao || {};
      const semDinheiro = !temVF && (fin.falha === 'negado' || (!fin.resumo && !rec.resumo));
      const dinheiro = semDinheiro ? kpi({ icone: 'dinheiro', titulo: 'Dinheiro', valor: '—', sub: fin.falha === 'negado' ? 'só os donos e a administração veem' : 'sem números agora' })
        : temVF ? kpi({ icone: 'aperto', titulo: 'Recebido no mês', valor: rs(VR.recebido), sub: `de ${reais(VR.previsto)} previsto` })
          + kpi({ icone: 'alta', titulo: 'Resultado', valor: rs(VR.resultado), sub: 'recebido − despesas pagas', cls: Number(VR.resultado) < 0 ? 'ruim' : '' })
          + kpi({ icone: 'alerta', titulo: 'Em atraso', valor: rs(vf.inadimplencia?.total), cls: Number(vf.inadimplencia?.total) > 0 ? 'ruim' : '', sub: `${num((vf.inadimplencia?.clientes || []).length)} cliente${(vf.inadimplencia?.clientes || []).length === 1 ? '' : 's'}` })
        : kpi({ icone: 'dinheiro', titulo: 'Receita contratada', valor: rs(F.receita), sub: `margem <b>${pct(F.margem_percentual)}</b>` })
          + kpi({ icone: 'aperto', titulo: 'Recebido', valor: rs(RA.recebido), variacao: RV.recebido ?? 'sem', contra, sub: `de ${reais(RA.a_receber)} a receber` })
          + kpi({ icone: 'relogio', titulo: 'Pendente', valor: rs(RA.pendente), inverte: true, variacao: RV.pendente ?? 'sem', contra, cls: Number(RA.pendente) > 0 ? 'atencao' : '' });
      // Comercial
      const M = com.mes || {}, A = M.kpis?.atual || {}, V = M.kpis?.variacao || {}, val = Boolean(M.valores);
      const comercial = com.falha || !M.kpis ? '' : kpi({ icone: 'aperto', titulo: 'Negócios fechados', valor: num(A.negocios), variacao: V.negocios ?? 'sem', contra, sub: val ? `MRR ${reais(A.mrr)} · avulso ${reais(A.avulso)}` : `${num(A.leads)} lead${Number(A.leads) === 1 ? '' : 's'} · ${num(A.propostas)} proposta${Number(A.propostas) === 1 ? '' : 's'}` });
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
      // Metas do comercial e os gráficos de antes: continuam no "mostrar" do pé.
      const metas = (M.progresso || []).filter((x) => x.meta > 0).map((x) => ({ ...x, texto: `${x.tipo === 'dinheiro' ? reais(x.realizado) : num(x.realizado)} de ${x.tipo === 'dinheiro' ? reais(x.meta) : num(x.meta)}${x.batida ? ' · meta batida' : ''}` }));
      const vendas = (M.series || []).map((x) => ({ ...x, rotulo: mesCurto(x.mes) }));
      const semanas = (Hi.semanas || []).slice(-12).map((x) => ({ ...x, rotulo: diaMes(x.inicio) }));
      const caixa = temVF ? (vf.series || []).slice(-6).map((m) => ({ ...m, rotulo: mesCurto(m.mes) })) : [];
      const piores = [...saude].sort((a, b) => (a.score ?? 999) - (b.score ?? 999)).slice(0, 6);
      const time = [...(N?.time || [])].sort((a, b) => (b.abertas || 0) - (a.abertas || 0)).slice(0, 6);
      const ir = (setor, rotulo) => `<button type="button" class="vs-abrir" data-setor-ir="${esc(setor)}">${esc(rotulo)} →</button>`;
      // ---- Padrão v2 (quadro "Gestão"): a frase do VYBES, três números, o que pede ação por setor e a semana por dia ----
      const prontas = S.previstasEntregues ?? S.entregues, falt = Number(H.faltam) || 0, atr = Number(H.atrasadas) || 0, furos = Number(H.furos ?? atr) || 0, prox = P.proximaSemana || {};
      const criticos = conta('critico'), abertas = abertasAgora(typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : null, H.dia);
      const inaL = temVF ? vf.inadimplencia?.clientes || [] : ina.clientes || [], inaTotal = Number(temVF ? vf.inadimplencia?.total : ina.total) || 0;
      const mesNome = per.tipo === 'anual' ? mes.slice(0, 4) : MESES[Number(mes.slice(5, 7)) - 1] || '';
      principal = atr ? btn(atr === 1 ? 'Abrir a atrasada' : `Abrir as ${num(atr)} atrasadas`, 'data-espiar="atrasadas"', 'p') : '';
      const frase = (atr ? `<b>${pl(atr, 'peça já passou', 'peças já passaram')} da data do cliente</b>` : '<b>Nenhuma peça atrasada agora</b>')
        + (S.previstas ? ` e, ${S.previstas === 1 ? 'da 1 prevista' : `das ${num(S.previstas)} previstas`} para a semana, ${Number(prontas) < S.previstas ? 'só ' : ''}<b>${pl(prontas, 'está pronta', 'estão prontas')}</b>.` : '. Nenhuma peça prevista nesta semana.')
        + (falt ? ` O que pesa hoje é a Produção: ${pl(falt, 'vai', 'vão')} ao ar sem estar ${falt === 1 ? 'pronta' : 'prontas'}.` : '');
      const contaL = [
        `<b>Atrasada</b>: a data do cliente (veiculação; sem ela, o prazo) já passou e a peça não foi entregue. Pausadas e esquecidas ficam fora. Agora: ${num(furos)} com a veiculação vencida e ${num(H.prazoInternoVencido ?? 0)} só com o prazo interno.`,
        `<b>Prontas da semana</b>: das ${num(S.previstas)} peças com data nesta semana, ${num(prontas)} já foram entregues.`,
        `<b>Ao ar hoje</b>: ${num(H.previstas ?? 0)} previstas para hoje, ${num(falt)} ainda sem estar ${falt === 1 ? 'pronta' : 'prontas'}.`,
      ];
      const corSaude = media == null ? '' : media < 50 ? '#B42318' : media < 70 ? '#9A5B00' : '#11613A';
      const numerosHtml = tres([
        { rotulo: 'Prontas da semana', valor: num(prontas), de: `de ${num(S.previstas)}`, barra: pctDe(prontas, S.previstas) ?? 0, cor: '#11613A', sub: `${pctSemana != null ? pct(pctSemana) : 'nenhuma prevista'} · semana que vem: ${pl(prox.previstas, 'prevista', 'previstas')}` },
        { rotulo: 'Atrasadas agora', valor: num(atr), tom: atr ? 'ruim' : '', barra: pctDe(atr, abertas), cor: '#B42318', espiar: atr ? 'atrasadas' : '', sub: `${num(H.emRisco)} com risco de furo em 2 dias${Number(H.emRisco) ? ` · ${elo('ver quais', 'data-espiar="emRisco"')}` : ''}` },
        { rotulo: 'Clientes ativos', valor: num(C.clientesAtivos), barra: media == null ? null : Math.round(media), cor: corSaude, sub: `saúde média ${media == null ? 'sem dado' : num(media)} · ${pl(criticos, 'crítico', 'críticos')} · ${elo('abrir a carteira', 'data-setor-sub="carteira"')}` },
      ]);
      // O que pede ação, um setor por linha, do mais grave ao menos grave. Setor sem dado diz "sem números agora".
      const AL = N?.alertas || [], cabeca = (a) => { const t = String(a.texto || ''), p = t.indexOf(':'); return (p > 0 ? t.slice(0, p) : t).replace(/\s*\(veiculação vencida\)/, '').trim(); };
      const daProducao = AL.filter((a) => a.nivel <= 3 && a.ref?.tipo !== 'clientes');
      const acoes = [];
      if (atr || daProducao.length) acoes.push({ tom: atr ? 'r' : 'a', pill: atr ? `${num(atr)} ${atr === 1 ? 'atrasada' : 'atrasadas'}` : 'Atenção',
        texto: `<b>Produção</b> · ${furos ? `${pl(furos, 'peça', 'peças')} furando a data do cliente` : atr ? `${pl(atr, 'peça', 'peças')} com o prazo interno vencido` : esc(cabeca(daProducao[0]))}`,
        botao: btn('Ver por etapa', 'data-gestao-aba="performance"'),
        det: daProducao.filter((a) => !/furando a data/.test(a.texto) && (atr || a !== daProducao[0])).slice(0, 4).map((a) => esc(cabeca(a).replace(/^(\d+) peças? /, '$1 '))) });
      if (semDinheiro && !inaTotal) acoes.push({ tom: 'n', pill: 'Sem dado', texto: `<b>Finanças</b> · ${fin.falha === 'negado' ? 'só os donos e a administração veem' : 'sem números agora'}`, botao: irSetor('setor:financas', 'Abrir Finanças') });
      else if (inaTotal > 0) { const dias = Math.max(0, ...inaL.map((c) => Number(c.atraso_mais_antigo) || 0)); acoes.push({ tom: 'r', pill: dias ? pl(dias, 'dia', 'dias') : 'Em atraso', texto: `<b>Finanças</b> · ${rs(inaTotal)} em atraso, de ${pl(inaL.length, 'cliente', 'clientes')}`, botao: irSetor('setor:financas', 'Abrir Finanças') }); }
      const semCont = (C.semConteudo || []).map(nomeCli).filter(Boolean), iSemCont = AL.findIndex((a) => a.nivel === 2 && a.ref?.tipo === 'clientes');
      if (semCont.length) acoes.push({ tom: 'a', pill: 'Esta semana', texto: `<b>Clientes</b> · ${semCont.length === 1 ? cliCor(semCont[0]) : pl(semCont.length, 'cliente', 'clientes')} sem nenhum conteúdo nesta semana`,
        botao: iSemCont >= 0 ? btn(semCont.length === 1 ? 'Ver o cliente' : 'Ver quais', `data-espiar="alerta:${iSemCont}"`) : '', det: semCont.length > 1 ? [semCont.slice(0, 6).map((c) => cliCor(c)).join(' · ') + (semCont.length > 6 ? ` e mais ${num(semCont.length - 6)}` : '')] : [] });
      else if (criticos) acoes.push({ tom: 'r', pill: pl(criticos, 'crítico', 'críticos'), texto: '<b>Clientes</b> · saúde crítica na carteira', botao: btn('Abrir a carteira', 'data-setor-sub="carteira"') });
      if (com.falha) acoes.push({ tom: 'n', pill: 'Sem dado', texto: `<b>Comercial</b> · ${com.falha === 'negado' ? 'só os donos e a administração veem' : 'sem números agora'}`, botao: irSetor('setor:comercial', 'Abrir Comercial') });
      else if (!metas.length) acoes.push({ tom: 'a', pill: 'Sem meta', texto: `<b>Comercial</b> · nenhuma meta definida para ${esc(mesNome)}`, botao: btn('Definir metas', 'data-setor-sub="funil"') });
      else if (metas.some((m) => !m.batida)) acoes.push({ tom: 'n', pill: `${num(metas.filter((m) => m.batida).length)} de ${num(metas.length)}`, texto: `<b>Comercial</b> · metas batidas em ${esc(mesNome)}`, botao: irSetor('setor:comercial', 'Abrir Comercial'), det: metas.map((m) => `${esc(m.nome)}: ${m.texto}`) });
      const ordem = porGravidade(acoes);
      const pedeHtml = pede(ordem, { sub: ordem.length ? `${pl(ordem.length, 'setor', 'setores')}, do mais grave ao menos grave` : '', vazio: 'Nada pede ação agora.', mostra: 5 });
      // Esta semana, dia a dia: o que saiu no dia sobre o que estava previsto para ele.
      const DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], diaDe = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
      const diasSem = (S.porDia || []).filter((d) => { const w = diaDe(d.dia); return (w >= 1 && w <= 5) || d.previstas || d.entregues; });
      const diasHtml = diasSem.map((d) => { const hoje = d.dia === H.dia;
        return `<div class="g2-dia"><span>${hoje ? `<b>${DIA[diaDe(d.dia)]}</b> · hoje` : DIA[diaDe(d.dia)]}</span><div class="v2-barra g2-barra"><i style="--v:${pctDe(d.entregues, d.previstas) ?? 0}%;--c:#11613A"></i></div><span class="g2-dia-qt${hoje && d.previstas && !d.entregues ? ' ruim' : ''}">${num(d.entregues)} de ${num(d.previstas)}</span></div>`; }).join('');
      const semanaHtml = cartao('Esta semana', 'entregues de previstas, por dia', (diasHtml || '<p class="g2-vazio">Os dias da semana aparecem quando a produção carregar.</p>')
        + `<div class="g2-lin g2-lin-solta"><p class="g2-lin-txt"><b>Semana que vem</b> · ${pl(prox.previstas, 'prevista', 'previstas')}, capacidade ${Number(prox.capacidadeMediana) ? `de ${num(prox.capacidadeMediana)} por semana` : 'sem dado'}</p>${btn('Ver a semana', 'data-gestao-aba="semana"')}</div>
          <p class="g2-pe g2-pe-fim">Últimas 12 semanas: mediana de ${pl(Hi.medianaEntregues ?? 0, 'entrega', 'entregas')} por semana, no prazo ${Hi.mediaNoPrazoPct == null ? 'sem dado' : pct(Hi.mediaNoPrazoPct)} · ${elo('mostrar', 'data-gestao-aba="historico"')}</p>`, { cls: 'g2-semana' });
      const ABAS = [['performance', 'Performance'], ['agora', 'Agora'], ['semana', 'Semana'], ['clientes', 'Clientes'], ['carteiras', 'Carteiras'], ['time', 'Time e bots'], ['historico', 'Histórico e projeção']];
      const abrir = `<nav class="g2-abrir" aria-label="Abrir"><span>Abrir:</span>${ABAS.map(([id, n]) => `<button type="button" class="g2-chip" data-gestao-aba="${id}">${n}</button>`).join('')}<button type="button" class="g2-chip" data-g2-mais>${temVF ? 'Faturamento e custos' : val ? 'Vendas por mês' : 'Negócios por mês'}</button><button type="button" class="g2-chip" data-setor-sub="equipe">Equipe online · ${num(online.length)}</button></nav>`;
      const antigo = `${grade(kpis)}`
        + (metas.length ? bloco('Metas do comercial', nomeMes(per.mes), progresso(metas), { icone: 'meta', cls: 'vs-destaque', acao: ir('setor:comercial', 'Comercial') }) : '')
        + linha(temVF
            ? bloco('Faturamento × custos', 'recebido e gasto nos últimos meses (Vybe Finanças)', barras(caixa, [{ chave: 'faturamento', rotulo: 'Faturamento', cls: 'c3' }, { chave: 'custos', rotulo: 'Custos', cls: 'c4' }], { fmt: reais }), { icone: 'dinheiro', acao: ir('setor:financas', 'Finanças') })
            : bloco(val ? 'Vendas por mês' : 'Negócios por mês', val ? 'MRR e avulso fechados' : 'negócios fechados', com.falha ? aviso(falhaTexto(com)) : val ? barras(vendas, [{ chave: 'mrr', rotulo: 'MRR', cls: 'c1' }, { chave: 'avulso', rotulo: 'Avulso', cls: 'c2' }], { fmt: reais }) : barras(vendas, [{ chave: 'negocios', rotulo: 'Negócios', cls: 'c1' }]), { icone: 'dinheiro', acao: ir('setor:comercial', 'Comercial') })
          + bloco('Entregas por semana', `previstas e entregues · mediana ${num(Hi.medianaEntregues)} por semana`, barras(semanas, [{ chave: 'previstas', rotulo: 'Previstas', cls: 'c5' }, { chave: 'entregues', rotulo: 'Entregues', cls: 'c1' }]), { icone: 'alta', acao: ir('setor:producao', 'Produção') }))
        + linha(bloco('Clientes prioritários', 'a menor nota de saúde primeiro', deitadas(piores.map((c) => ({ cli: true, nome: c.cliente, valor: c.score, cls: c.score < 50 ? 'ruim' : c.score < 70 ? 'atencao' : 'ok', sub: (c.motivos || []).slice(0, 2).join(' · ') })), { vazio: 'A saúde ainda está sendo calculada.' }), { icone: 'coracao', acao: ir('setor:clientes', 'Clientes') })
          + bloco('Carga do time', 'peças abertas por pessoa', deitadas(time.map((x) => ({ nome: x.pessoa, valor: x.abertas, cls: x.atrasadas ? 'atencao' : '', rotulo: `${num(x.abertas)}${x.atrasadas ? ` <small class="t-ruim">${num(x.atrasadas)} atras.</small>` : ''}`, sub: `${num(x.entregues7d)} entregue${Number(x.entregues7d) === 1 ? '' : 's'} em 7 dias` })), { vazio: 'Sem números do time.' }), { icone: 'pessoas', acao: ir('setor:pessoas', 'Pessoas') }))
        + (cart.contratos ? linha(bloco('Carteira', 'contratos ativos e saídas do mês', deitadas([
            { nome: 'Contratos ativos', valor: (cart.contratos.lista || []).length, cls: 'ok' },
            { nome: 'Renovam em 30 dias', valor: (cart.contratos.lista || []).filter((c) => c.renovacao && c.renovacao >= new Date().toISOString().slice(0, 10) && c.renovacao <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)).length, cls: 'atencao' },
            { nome: 'Saídas no mês', valor: (cart.churn?.registros || []).filter((r) => String(r.saiu_em || '').startsWith(mesAtual())).length, cls: 'ruim' }]), { icone: 'calendario', acao: ir('setor:clientes', 'Clientes') })
          + bloco('Cobertura da semana', `meta de ${num(C.meta || 3)} posts por cliente`, deitadas([{ nome: `Abaixo de ${num(C.meta || 3)} posts`, valor: (C.sem3 || []).length, cls: 'atencao' }, { nome: 'Sem nenhum post', valor: (C.semConteudo || []).length, cls: 'ruim' }, { nome: 'Sem planejamento', valor: (C.semPlanejamento || []).length, cls: 'atencao' }]), { icone: 'doc', acao: ir('setor:producao', 'Produção') })) : '');
      return tela(fala('vybes', frase, { conta: contaL }), numerosHtml, duas(pedeHtml, semanaHtml), abrir, mais('Dinheiro, comercial, clientes e time em números e gráficos', antigo));
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
      // O que destrava o setor, na ordem de quem tem pressa: as linhas de "Pede ação".
      const hoje = new Date().toISOString().slice(0, 10), em30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      const renovam = contratos.filter((c) => c.renovacao && c.renovacao >= hoje && c.renovacao <= em30).sort((a, b) => String(a.renovacao).localeCompare(String(b.renovacao)));
      const pacotesAtivos = (pac.pacotes || []).filter((p) => p.ativo !== false);
      const temMeta = (m.progresso || []).some((x) => x.meta > 0);
      const lista = [];
      if (!pac.falha && !pacotesAtivos.length) lista.push({ tom: 'a', pill: 'Sem pacote', texto: '<b>Cadastrar os pacotes da Vybe</b> · sem pacote não há orçamento', botao: irAba('pacotes', 'Cadastrar') });
      if (!temMeta) lista.push({ tom: 'a', pill: 'Sem meta', texto: `<b>Nenhuma meta definida</b> para ${esc(periodoNome)}`, botao: irAba('funil', 'Definir metas') });
      if (renovam.length) lista.push({ tom: 'n', pill: '30 dias', texto: `<b>${num(renovam.length)} contrato${renovam.length === 1 ? ' renova' : 's renovam'} em 30 dias</b>`, botao: irAba('contratos', 'Contratos'),
        det: [renovam.slice(0, 4).map((c) => `${cliCor(nomeDoCliente(c.cliente_id))} ${diaMes(c.renovacao)}`).join(' · ') + (renovam.length > 4 ? ` e mais ${num(renovam.length - 4)}` : '')] });
      if (!semNumeros && !Number(A.leads)) lista.push({ tom: 'n', pill: 'Sem lead', texto: `<b>Nenhum lead novo em ${esc(periodoNome)}</b> · o formulário de leads e o SDR alimentam o funil`, botao: irAba('funil', 'Abrir o funil') });
      if (Number(neg.quantidade)) lista.push({ tom: 'g', pill: 'Em negociação', texto: `<b>${num(neg.quantidade)} oportunidade${neg.quantidade === 1 ? '' : 's'} em negociação</b> · ${val ? `MRR ${reais(neg.mensal)} · avulso ${reais(neg.avulso)}` : 'acompanhe no funil'}`, botao: irAba('funil', 'Ver o funil') });
      if (semNumeros) lista.push({ tom: 'n', pill: 'Sem número', texto: '<b>Os números do mês ainda não chegaram</b> · o funil abre com as oportunidades de agora', botao: irAba('funil', 'Abrir o funil') });
      const series = (m.series || []).map((s) => ({ ...s, rotulo: mesCurto(s.mes) }));
      const fases = (R.fases || []).filter((f) => f.id !== 'perdido');
      // ---- Padrão v2: o mesmo molde da Produção ----
      const varia = (v) => (semNumeros || v == null || !Number.isFinite(Number(v)) ? 'sem comparação ainda' : `${Number(v) > 0 ? '▲' : Number(v) < 0 ? '▼' : '•'} ${Math.abs(Math.round(Number(v)))}% ${contra}`);
      principal = temAba('funil') ? btn('Abrir o funil', 'data-setor-sub="funil"', 'p') : '';
      const frase = semNumeros ? `<b>Os números de ${esc(periodoNome)} ainda não chegaram.</b> O funil abre com as oportunidades de agora.`
        : `Em ${esc(periodoNome)}: <b>${pl(A.leads, 'lead novo', 'leads novos')}</b>, ${pl(A.propostas, 'proposta enviada', 'propostas enviadas')} e <b>${pl(A.negocios, 'negócio fechado', 'negócios fechados')}</b>.${Number(neg.quantidade) ? ` ${pl(neg.quantidade, 'oportunidade', 'oportunidades')} em negociação.` : ''}`;
      const numerosHtml = tres([
        { rotulo: 'Leads novos', valor: num(A.leads), sub: varia(V.leads) },
        { rotulo: 'Propostas enviadas', valor: num(A.propostas), sub: varia(V.propostas) },
        { rotulo: val ? 'Fechado no período' : 'Negócios fechados', valor: val ? reais(semNumeros ? null : (Number(A.mrr) || 0) + (Number(A.avulso) || 0)) : num(A.negocios), sub: val && !semNumeros ? `${pl(A.negocios, 'negócio', 'negócios')} · ${varia(V.mrr)}` : varia(V.negocios) },
      ]);
      const saidasMes = (cart.churn?.registros || []).filter((x) => String(x.saiu_em || '').startsWith(mesAtual())).length;
      const mods = modulosDoSetor({
        funil: r.resumo ? [num(R.total ?? 0), 'oportunidades'] : null, pacotes: pac.falha ? null : [num(pacotesAtivos.length), pacotesAtivos.length === 1 ? 'ativo' : 'ativos'],
        contratos: cart.contratos ? [num(contratos.length), contratos.length === 1 ? 'vigente' : 'vigentes'] : null, churn: cart.churn ? [num(saidasMes), saidasMes === 1 ? 'saída no mês' : 'saídas no mês'] : null,
      });
      const antigo = `${grade(kpis)}`
        + metaDoMes(m.progresso, periodoNome)
        + linha(bloco('Leads gerados por mês', 'evolução até o período escolhido', barras(series, [{ chave: 'leads', rotulo: 'Leads', cls: 'c1' }]), { icone: 'pessoas' })
          + bloco(val ? 'Valor fechado por mês' : 'Negócios fechados por mês', val ? 'MRR e avulso, mês a mês' : 'mês a mês', val ? barras(series, [{ chave: 'mrr', rotulo: 'MRR', cls: 'c1' }, { chave: 'avulso', rotulo: 'Avulso', cls: 'c2' }], { fmt: reais }) : barras(series, [{ chave: 'negocios', rotulo: 'Negócios', cls: 'c1' }]), { icone: 'dinheiro' }))
        + linha(bloco('Funil por fase', `taxa de ganho ${pct(R.taxa_ganho)} · ${num(R.total ?? 0)} oportunidades · ${num(neg.quantidade ?? 0)} em negociação${val ? ` (MRR ${reais(neg.mensal)} · avulso ${reais(neg.avulso)})` : ''}`, deitadas(fases.map((f) => ({ nome: f.nome, valor: f.atual, sub: f.conversao != null ? `conversão para a próxima: ${pct(f.conversao)}` : '' })), { vazio: 'Nenhuma oportunidade no funil.' }), { icone: 'alta', acao: abrirAba('funil') })
          + bloco('Corrida comercial', 'quem mais fechou no período', corrida.length ? `<ol class="vs-corrida">${corrida.map((x) => `<li><span class="pos${x.posicao === 1 ? ' ouro' : ''}">${x.posicao}º</span><b>${esc(x.nome)}</b><small>${num(x.quantidade)} negócio${x.quantidade === 1 ? '' : 's'}${val && x.total != null ? ' · ' + reais(x.total) : ''}</small></li>`).join('')}</ol>` : aviso('Ninguém fechou negócio neste período ainda.'), { icone: 'trofeu' }))
        + bloco('Motivos de perda', 'por que os negócios não fecharam', deitadas((R.motivos_perda || []).filter((x) => x.quantidade).map((x) => ({ nome: x.nome, valor: x.quantidade, cls: 'ruim', sub: pct(x.percentual) + ' das perdas' })), { vazio: 'Nenhuma perda registrada.' }), { icone: 'alerta', acao: abrirAba('funil', 'Filtrar no funil') });
      const ordem = porGravidade(lista);
      return tela(fala('vybes', frase), numerosHtml, duas(pede(ordem, { sub: ordem.length ? `${pl(ordem.length, 'coisa', 'coisas')}, da mais grave à menos grave` : '', vazio: 'Nada travando o setor agora.' }), mods, 'mods'),
        mais('Números, meta do mês, gráficos, funil por fase e motivos de perda', antigo));
    },

    async 'setor:financas'() {
      // Padrão v2: a Visão geral de Finanças é a tela do quadro (VybeFinancas.telas.visao, em vybe-mundo-financas.js).
      if (window.VybeFinancas?.telas?.visao) return window.VybeFinancas.telas.visao({ subs: ctx.subs, abrirSub: ctx.abrirSub });
      // Com o Vybe Finanças ligado, o dinheiro vem dele (Paulo, 08/11: "o que for gasto, finança, salários puxa do Vybe Finanças");
      // as tabelas de dinheiro do próprio Vybe OS estão vazias e deixavam o painel todo em R$ 0.
      const vf = await ler('/api/painel?area=vybe_financas&parte=comercial&mes=' + String(per.mes).slice(0, 7));
      // Próximos passos e meta do mês (redesign, quadro 57: o mesmo desenho do Comercial), das leituras das abas.
      const [fin, ina, con, funil, cart] = await Promise.all([ler('/api/painel?area=comercial&aba=financas'), ler('/api/painel?area=comercial&aba=inadimplencia'),
        ler('/api/painel?area=comercial&aba=contas' + qPeriodo()), ler('/api/painel?area=comercial&aba=funil' + qPeriodo()), ler('/api/painel?area=carteira')]);
      const ligado = !vf.falha && vf.conectado && vf.resumo;
      const periodoNome = per.tipo === 'anual' ? String(per.mes).slice(0, 4) : nomeMes(per.mes);
      const hojeIso = new Date().toISOString().slice(0, 10), em30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      const emAtraso = ligado ? vf.inadimplencia?.clientes || [] : ina.clientes || [];
      // O que destrava o setor: as linhas de "Pede ação" (as mesmas leituras das abas).
      const passosFin = () => {
        const lista = [], semContrato = (fin.clientes || []).filter((c) => !(Number(c.valor_mensal) > 0)).length, atraso = emAtraso.length;
        const renovam = contratosAtivos(cart).filter((c) => c.renovacao && c.renovacao >= hojeIso && c.renovacao <= em30);
        if (atraso) lista.push({ tom: 'r', pill: pl(atraso, 'em atraso', 'em atraso'), texto: `<b>${num(atraso)} cliente${atraso === 1 ? '' : 's'} em atraso</b> · cobrar antes de virar inadimplência`, botao: irAba('inadimplencia', 'Inadimplência'),
          det: [emAtraso.slice(0, 4).map((c) => `${cliCor(c.cliente_nome)} ${num(c.atraso_mais_antigo)} d`).join(' · ')] });
        if (!fin.falha && semContrato) lista.push({ tom: 'a', pill: 'Sem contrato', texto: `<b>${num(semContrato)} cliente${semContrato === 1 ? '' : 's'} sem contrato informado</b> · sem o valor do contrato não há margem`, botao: irAba('financas', 'Informar') });
        if (!ligado && !vf.falha) lista.push({ tom: 'n', pill: 'Estimado', texto: '<b>Ligar o Vybe Finanças</b> · até lá, a margem é estimada pelo contrato e pelas horas do time', botao: irAba('financas', 'Ver como') });
        if (Number(con.resumo?.a_pagar)) lista.push({ tom: 'n', pill: 'A pagar', texto: `<b>${reais(con.resumo.a_pagar)} a pagar no período</b> · contas lançadas ainda em aberto`, botao: irAba('contas', 'Contas') });
        if (renovam.length) lista.push({ tom: 'n', pill: '30 dias', texto: `<b>${num(renovam.length)} contrato${renovam.length === 1 ? ' renova' : 's renovam'} em 30 dias</b>`, det: [renovam.slice(0, 4).map((c) => `${cliCor(nomeDoCliente(c.cliente_id))} ${diaMes(c.renovacao)}`).join(' · ')] });
        const ordem = porGravidade(lista);
        return pede(ordem, { sub: ordem.length ? `${pl(ordem.length, 'coisa', 'coisas')}, da mais grave à menos grave` : '', vazio: 'Nada travando o setor agora.' });
      };
      const metaFin = () => metaDoMes(funil.mes?.progresso, periodoNome, { filtro: (x) => x.tipo === 'dinheiro', titulo: 'Meta de vendas do mês' });
      principal = emAtraso.length && temAba('inadimplencia') ? btn(emAtraso.length === 1 ? 'Ver o cliente em atraso' : `Ver os ${num(emAtraso.length)} em atraso`, 'data-setor-sub="inadimplencia"', 'p') : '';
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
          + kpi({ icone: 'alerta', titulo: 'Em atraso', valor: rs(I.total), sub: `${num((I.clientes || []).length)} cliente${(I.clientes || []).length === 1 ? '' : 's'} · ${num(I.criticos)} crítico${Number(I.criticos) === 1 ? '' : 's'}`, cls: Number(I.total) > 0 ? 'ruim' : '' });
        const fraseL = `Em ${esc(nomeMes(String(per.mes).slice(0, 7)))}, <b>${reais(R.recebido)} recebidos</b> de ${reais(R.previsto)} previstos${Number(I.total) > 0 ? ` e <b>${reais(I.total)} em atraso</b>, de ${pl((I.clientes || []).length, 'cliente', 'clientes')}` : ''}. Resultado até aqui: ${reais(R.resultado)}.`;
        const numerosL = tres([
          { rotulo: 'Recebido no mês', valor: rs(R.recebido), barra: R.recebido_percentual ?? pctDe(R.recebido, R.previsto), cor: '#11613A', sub: `de ${reais(R.previsto)} previsto${R.recebido_percentual != null ? ` · ${pct(R.recebido_percentual)}` : ''}` },
          { rotulo: 'Em atraso', valor: rs(I.total), tom: Number(I.total) > 0 ? 'ruim' : '', sub: `${pl((I.clientes || []).length, 'cliente', 'clientes')} · ${pl(I.criticos, 'crítico', 'críticos')}` },
          { rotulo: 'Resultado', valor: rs(R.resultado), tom: Number(R.resultado) < 0 ? 'ruim' : '', sub: 'recebido − despesas pagas' },
        ]);
        const modsL = modulosDoSetor({ recebimentos: [rs(R.pendente), 'pendente'], contas: [rs(R.despesas_pendentes), 'a pagar'], inadimplencia: [num((I.clientes || []).length), 'em atraso'] });
        return tela(fala('vorcaro', fraseL, { conta: ['<b>Fonte</b>: Vybe Finanças.', `<b>Resultado</b>: recebido (${reais(R.recebido)}) menos as despesas pagas (${reais(R.despesas_pagas)}).`, `<b>Pendente</b>: ${reais(R.pendente)} a receber e ${reais(R.despesas_pendentes)} a pagar.`] }), numerosL, duas(passosFin(), modsL, 'mods'),
          mais('Todos os números, meta de vendas, despesas, margem por cliente e inadimplência', `<p class="vs-fonte">fonte: Vybe Finanças</p>${grade(kpis)}` + metaFin()
          + linha(bloco('Faturamento × custos', 'recebido e gasto nos últimos meses', barras(serie, [{ chave: 'faturamento', rotulo: 'Faturamento', cls: 'c3' }, { chave: 'custos', rotulo: 'Custos', cls: 'c4' }], { fmt: reais, curtoFmt: milInteiro }), { icone: 'caixa', acao: abrirAba('financas') })
            + bloco('Despesas por categoria', D.total ? `${reais(D.total)} no mês` : '', deitadas((D.categorias || []).slice(0, 6).map((c) => ({ nome: c.categoria, valor: c.total, rotulo: `${reais(c.total)} <small>${pct(c.percentual)}</small>` })), { vazio: 'Nenhuma despesa lançada no mês.' }), { icone: 'caixa', acao: abrirAba('contas') }))
          + linha(bloco('Margem real por cliente', 'recebido − gasto com o cliente no mês, os menores primeiro', deitadas(margens.map((c) => ({ cli: true, nome: c.cliente_nome, valor: Math.max(0, c.mes.margem_percentual ?? 0), cls: (c.mes.margem_percentual ?? 0) < 20 ? 'ruim' : 'ok', rotulo: pct(c.mes.margem_percentual), sub: `${reais(c.mes.receita)} recebido · ${reais(c.mes.despesas)} gasto` })), { vazio: 'Nenhum cliente com receita lançada no mês.' }), { icone: 'dinheiro', acao: abrirAba('financas') })
            + bloco('Inadimplência', 'receitas vencidas e não pagas', deitadas((I.clientes || []).slice(0, 6).map((c) => ({ cli: true, nome: c.cliente_nome, valor: c.valor, cls: c.atraso_mais_antigo > 30 ? 'ruim' : 'atencao', rotulo: reais(c.valor), sub: `${num(c.atraso_mais_antigo)} dia${Number(c.atraso_mais_antigo) === 1 ? '' : 's'} · ${num(c.faturas)} lançamento${c.faturas === 1 ? '' : 's'}` })), { vazio: 'Ninguém em atraso.' }), { icone: 'alerta', acao: abrirAba('inadimplencia') }))));
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
        + kpi({ icone: 'alerta', titulo: 'Em atraso', valor: reais(ina.total), sub: `${num((ina.clientes || []).length)} cliente${(ina.clientes || []).length === 1 ? '' : 's'} · ${num(ina.criticos ?? 0)} crítico${Number(ina.criticos ?? 0) === 1 ? '' : 's'}`, cls: Number(ina.total) > 0 ? 'ruim' : '', ir: ['inadimplencia', 'Inadimplência'] });
      const prev = (cx.previsao?.meses || []).map((m) => ({ ...m, rotulo: mesCurto(m.mes) }));
      const piores = [...(fin.clientes || [])].filter((c) => c.margem_percentual != null && c.valor_mensal > 0).sort((a, b) => a.margem_percentual - b.margem_percentual).slice(0, 6);
      const fraseD = semNumeros ? `<b>Os números de ${esc(periodoNome)} ainda não chegaram.</b>${!vf.falha ? ' Com o Vybe Finanças ligado, o dinheiro vem de lá; até lá, a margem é estimada pelo contrato.' : ''}`
        : `<b>${reais(A.recebido)} recebidos</b> de ${reais(A.a_receber)} a receber em ${esc(periodoNome)}${Number(ina.total) > 0 ? ` e <b>${reais(ina.total)} em atraso</b>, de ${pl((ina.clientes || []).length, 'cliente', 'clientes')}` : ''}.`;
      const numerosD = tres([
        { rotulo: 'Receita contratada', valor: reais(F.receita), sub: fin.resumo ? `margem ${pct(F.margem_percentual)} · custo ${reais(F.custo)}` : 'sem contrato informado ainda' },
        { rotulo: 'Recebido', valor: reais(A.recebido), barra: rec.resumo ? pctDe(A.recebido, A.a_receber) ?? 0 : null, cor: '#11613A', sub: rec.resumo ? `de ${reais(A.a_receber)} a receber` : 'sem recebimento lançado' },
        { rotulo: 'Em atraso', valor: reais(ina.total), tom: Number(ina.total) > 0 ? 'ruim' : '', sub: `${pl((ina.clientes || []).length, 'cliente', 'clientes')} · ${pl(ina.criticos ?? 0, 'crítico', 'críticos')}` },
      ]);
      const modsD = modulosDoSetor({ financas: fin.clientes ? [num(fin.clientes.length), fin.clientes.length === 1 ? 'cliente' : 'clientes'] : null, recebimentos: rec.resumo ? [reais(A.pendente), 'pendente'] : null, contas: con.resumo ? [reais(K.a_pagar), 'a pagar'] : null, inadimplencia: ina.clientes ? [num(ina.clientes.length), 'em atraso'] : null });
      return tela(fala('vorcaro', fraseD), numerosD, duas(passosFin(), modsD, 'mods'), mais('Todos os números, meta de vendas, previsão de caixa, contas e margem por cliente', `${grade(kpis)}` + metaFin()
        + linha(bloco('Previsão de caixa', 'entradas e saídas dos próximos meses', cx.falha ? aviso(falhaTexto(cx)) : barras(prev, [{ chave: 'entradas', rotulo: 'Entradas', cls: 'c3' }, { chave: 'saidas', rotulo: 'Saídas', cls: 'c4' }], { fmt: reais }), { icone: 'caixa', acao: abrirAba('caixa') })
          + bloco('Contas por grupo', K.total ? `${pct(K.fixo_percentual)} fixo · ${pct(K.variavel_percentual)} variável` : '', con.falha ? aviso(falhaTexto(con)) : deitadas((K.grupos || []).filter((g) => g.total).map((g) => ({ nome: g.nome, valor: g.total, rotulo: `${reais(g.total)} <small>${pct(g.percentual_faturamento)}</small>` })), { fmt: reais, vazio: 'Nenhuma conta neste período.' }), { icone: 'doc', acao: abrirAba('contas') }))
        + linha(bloco('Margem por cliente', 'os de menor margem primeiro', deitadas(piores.map((c) => ({ cli: true, nome: c.cliente_nome, valor: Math.max(0, c.margem_percentual), cls: c.zona_critica ? 'ruim' : 'ok', rotulo: pct(c.margem_percentual), sub: `${reais(c.valor_mensal)} por mês · custo ${reais(c.custo)}` })), { vazio: 'Nenhum cliente com pacote e custo cadastrados.' }), { icone: 'dinheiro', acao: abrirAba('financas') })
          + bloco('Inadimplência', 'quem está em atraso e há quanto tempo', ina.falha ? aviso(falhaTexto(ina)) : deitadas((ina.clientes || []).slice(0, 6).map((c) => ({ cli: true, nome: c.cliente_nome, valor: c.valor, cls: c.severidade?.nivel === 'u1' ? 'ruim' : 'atencao', rotulo: reais(c.valor), sub: `${num(c.atraso_mais_antigo)} dia${Number(c.atraso_mais_antigo) === 1 ? '' : 's'} · ${num(c.faturas)} fatura${c.faturas === 1 ? '' : 's'}` })), { vazio: 'Ninguém em atraso.' }), { icone: 'alerta', acao: abrirAba('inadimplencia') }))));
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
        + kpi({ icone: 'dinheiro', titulo: 'MRR em contratos', valor: semCart ? '—' : reais(mrr), sub: semCart || `${num(contratos.length)} contrato${contratos.length === 1 ? '' : 's'} · ticket ${reais(contratos.length ? mrr / contratos.length : null)}` })
        + kpi({ icone: 'calendario', titulo: 'Renovam em 30 dias', valor: semCart ? '—' : num(renov.length), sub: semCart ? '' : renov.length ? reais(renov.reduce((s, c) => s + (Number(c.valor_mensal) || 0), 0)) + ' por mês' : 'nenhuma agora', cls: renov.length ? 'atencao' : '' })
        + kpi({ icone: 'saida', titulo: 'Saídas no mês', valor: semCart ? '—' : num(saidasMes.length), sub: semCart ? '' : saidasMes.length ? `receita perdida ${reais(saidasMes.reduce((s, r) => s + (Number(r.receita_mensal) || 0), 0))}` : 'nenhuma saída', cls: saidasMes.length ? 'ruim' : '' })
        + kpi({ icone: 'doc', titulo: 'Sem planejamento', valor: num((C.semPlanejamento || []).length), sub: 'do mês atual ou seguinte', cls: (C.semPlanejamento || []).length ? 'atencao' : '' });
      const piores = [...saude].sort((a, b) => (a.score ?? 999) - (b.score ?? 999)).slice(0, 6);
      // ---- Padrão v2: o mesmo molde da Produção ----
      const criticosL = cl.filter((c) => c.saude === 'critico'), AL = N?.alertas || [], iSemCont = AL.findIndex((a) => a.nivel === 2 && a.ref?.tipo === 'clientes');
      const semCont = (C.semConteudo || []).map(nomeCli).filter(Boolean), semPlan = (C.semPlanejamento || []).map(nomeCli).filter(Boolean);
      principal = criticosL.length && temAba('carteira') ? btn(criticosL.length === 1 ? 'Ver o cliente crítico' : `Ver os ${num(criticosL.length)} críticos`, 'data-setor-sub="carteira"', 'p') : '';
      const frase = `<b>${pl(criticosL.length, 'cliente crítico', 'clientes críticos')}</b> entre os ${num(C.clientesAtivos)} ativos${media != null ? `, com saúde média de ${num(media)}` : ''}.`
        + (semCart ? '' : ` ${renov.length ? `${pl(renov.length, 'contrato renova', 'contratos renovam')} em 30 dias` : 'Nenhuma renovação nos próximos 30 dias'}${saidasMes.length ? ` e ${pl(saidasMes.length, 'cliente saiu', 'clientes saíram')} neste mês` : ''}.`);
      const corSaude = media == null ? '' : media < 50 ? '#B42318' : media < 70 ? '#9A5B00' : '#11613A';
      const numerosHtml = tres([
        { rotulo: 'Clientes ativos', valor: num(C.clientesAtivos), barra: pctDe(conta('ok'), cl.length), cor: '#11613A', sub: `${pl(conta('critico'), 'crítico', 'críticos')} · ${num(conta('atencao'))} em atenção · ${num(conta('ok'))} em dia` },
        { rotulo: 'Saúde média', valor: media == null ? '—' : num(media), barra: media == null ? null : Math.round(media), cor: corSaude, tom: media != null && media < 50 ? 'ruim' : '', sub: 'nota de 0 a 100' },
        { rotulo: 'Renovam em 30 dias', valor: semCart ? '—' : num(renov.length), sub: semCart || (renov.length ? reais(renov.reduce((s, c) => s + (Number(c.valor_mensal) || 0), 0)) + ' por mês' : 'nenhuma agora') },
      ]);
      const acoes = [];
      if (criticosL.length) acoes.push({ tom: 'r', pill: pl(criticosL.length, 'crítico', 'críticos'), texto: '<b>Saúde crítica</b> na carteira', botao: irAba('carteira', 'Ver a saúde'),
        det: criticosL.slice(0, 3).map((c) => `${cliCor(c.cliente)} · ${pl(c.atrasadas, 'atrasada', 'atrasadas')}${c.emRisco ? `, ${num(c.emRisco)} com risco de furo` : ''}`) });
      if (saidasMes.length) acoes.push({ tom: 'r', pill: 'Saiu', texto: `<b>${pl(saidasMes.length, 'saída', 'saídas')} neste mês</b> · receita perdida ${reais(saidasMes.reduce((s, r) => s + (Number(r.receita_mensal) || 0), 0))}`, botao: irSetor('setor:comercial', 'Ver no Comercial') });
      if (renov.length) acoes.push({ tom: 'a', pill: '30 dias', texto: `<b>${pl(renov.length, 'contrato renova', 'contratos renovam')}</b> em 30 dias`, botao: irSetor('setor:comercial', 'Contratos'), det: [renov.slice(0, 4).map((c) => `${cliCor(nomeDe.get(String(c.cliente_id)) || 'Cliente')} ${diaMes(c.renovacao)}`).join(' · ')] });
      if (semCont.length) acoes.push({ tom: 'a', pill: 'Esta semana', texto: `<b>${semCont.length === 1 ? cliCor(semCont[0]) : pl(semCont.length, 'cliente', 'clientes')}</b> sem nenhum conteúdo nesta semana`, botao: iSemCont >= 0 ? btn('Ver quais', `data-espiar="alerta:${iSemCont}"`) : '' });
      if (semPlan.length) acoes.push({ tom: 'a', pill: 'Sem planejamento', texto: `<b>${pl(semPlan.length, 'cliente', 'clientes')}</b> sem planejamento do mês atual ou seguinte`, botao: irSetor('setor:producao', 'Produção') });
      const ordem = porGravidade(acoes);
      const mods = modulosDoSetor({ clientes: [num(C.clientesAtivos), 'ativos'], carteira: media == null ? null : [num(media), 'de saúde média'] });
      return tela(fala('mateus', frase, { conta: [`<b>Saúde</b>: ${num(conta('ok'))} em dia, ${num(conta('atencao'))} em atenção e ${num(conta('critico'))} críticos, pela nota de 0 a 100 da Saúde da carteira.`, semCart ? '' : `<b>Contratos</b>: ${pl(contratos.length, 'contrato vigente', 'contratos vigentes')}, ${reais(mrr)} por mês.`] }), numerosHtml,
        duas(pede(ordem, { sub: ordem.length ? `${pl(ordem.length, 'coisa', 'coisas')}, da mais grave à menos grave` : '', vazio: 'Nada pede ação na carteira agora.' }), mods, 'mods'),
        mais('Todos os números, entradas e saídas, clientes prioritários e renovações', `${grade(kpis)}`
        + linha(bloco('Entradas e saídas', 'clientes que começaram e que saíram, últimos 6 meses', semCart ? aviso(semCart) : barras(fluxo, [{ chave: 'entradas', rotulo: 'Entradas', cls: 'c3' }, { chave: 'saidas', rotulo: 'Saídas', cls: 'c4' }]), { icone: 'alta', acao: abrirAba('churn') })
          + bloco('Saúde da carteira', 'quantos clientes em cada faixa', cl.length ? deitadas([{ nome: 'Em dia', valor: conta('ok'), cls: 'ok' }, { nome: 'Em atenção', valor: conta('atencao'), cls: 'atencao' }, { nome: 'Críticos', valor: conta('critico'), cls: 'ruim' }]) : aviso('As demandas ainda estão carregando.'), { icone: 'coracao', acao: abrirAba('carteira') }))
        + linha(bloco('Clientes prioritários', 'a menor nota de saúde primeiro', deitadas(piores.map((c) => ({ cli: true, nome: c.cliente, valor: c.score, cls: c.score < 50 ? 'ruim' : c.score < 70 ? 'atencao' : 'ok', sub: (c.motivos || []).slice(0, 2).join(' · ') })), { vazio: 'A saúde ainda está sendo calculada.' }), { icone: 'alerta', acao: abrirAba('clientes', 'Todos os clientes') })
          + bloco('Renovações próximas', 'contratos que renovam em 30 dias', semCart ? aviso(semCart) : deitadas(renov.slice(0, 6).map((c) => ({ cli: true, nome: nomeDe.get(String(c.cliente_id)) || 'Cliente', valor: c.valor_mensal, rotulo: diaMes(c.renovacao), sub: reais(c.valor_mensal) + ' por mês' })), { vazio: 'Nenhuma renovação nos próximos 30 dias.' }), { icone: 'calendario', acao: abrirAba('contratos') }))));
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
        : aviso(`Sem histórico ainda: o gráfico aparece com duas semanas de entregas. Nesta semana, ${num(prontas)} de ${num(S.previstas)} ${Number(S.previstas) === 1 ? 'prevista pronta' : 'previstas prontas'}.`);
      const time = [...(N.time || [])].sort((a, b) => (b.abertas || 0) - (a.abertas || 0)).slice(0, 8);
      const porCliente = [...(N.clientes || [])].filter((c) => c.atrasadas || c.emRisco).sort((a, b) => (b.atrasadas || 0) - (a.atrasadas || 0) || (b.emRisco || 0) - (a.emRisco || 0)).slice(0, 6);
      const gargalos = (N.gargalos || []).slice(0, 6);
      const ag = ctx.agenda?.();
      const tipoAg = (t) => (t === 'captacao' ? 'Captação' : t === 'reuniao' ? 'Reunião' : 'Compromisso');
      // ---- Padrão v2 (quadro "Visão do setor"): a frase do Heitor, três números, o que pede ação e os módulos ----
      const abertas = abertasAgora(itens, H.dia), solic = abertasAgora(typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : null, H.dia), falt = Number(H.faltam) || 0, gar = gargalos[0];
      principal = atrasadas ? btn(atrasadas === 1 ? 'Resolver a atrasada' : `Resolver as ${num(atrasadas)}`, 'data-espiar="atrasadas"', 'p') : '';
      const frase = (atrasadas ? `<b>${pl(atrasadas, 'peça já passou', 'peças já passaram')} da data do cliente</b>${falt ? ` e ${pl(falt, 'vai', 'vão')} ao ar hoje sem estar ${falt === 1 ? 'pronta' : 'prontas'}` : ''}.` : falt ? `<b>${pl(falt, 'peça vai', 'peças vão')} ao ar hoje</b> sem estar ${falt === 1 ? 'pronta' : 'prontas'}.` : '<b>Nada atrasado agora.</b>')
        + (S.previstas ? ` Da semana, ${num(prontas)} de ${num(S.previstas)} ${Number(prontas) === 1 ? 'está pronta' : 'estão prontas'}${gar ? `; quem segura a fila é a etapa de ${esc(gar.status)}, com ${pl(gar.qtd, 'parada', 'paradas')}` : ''}.` : ' Nenhuma peça prevista nesta semana.');
      const numerosHtml = tres([
        { rotulo: 'Prontas da semana', valor: num(prontas), de: `de ${num(S.previstas)}`, barra: pctDe(prontas, S.previstas) ?? 0, cor: '#11613A', sub: `${S.previstas ? pct((Number(prontas) / S.previstas) * 100) : 'nenhuma prevista'} · semana que vem: ${pl(prox.previstas, 'prevista', 'previstas')} · ${elo('por semana', 'data-g2-mais')}` },
        { rotulo: 'Atrasadas agora', valor: num(atrasadas), tom: atrasadas ? 'ruim' : '', barra: pctDe(atrasadas, abertas), cor: '#B42318', espiar: atrasadas ? 'atrasadas' : '', sub: `veiculação vencida · no prazo: ${Hi.mediaNoPrazoPct == null ? 'sem histórico ainda' : pct(Hi.mediaNoPrazoPct)}` },
        { rotulo: 'Com risco de furo', valor: num(emRisco), barra: pctDe(emRisco, abertas), cor: '#9A5B00', espiar: emRisco ? 'emRisco' : '', sub: `nos próximos 2 dias · ${num(emAprov)} em aprovação` },
      ]);
      const acoes = (N.alertas || []).map((a, i) => ({ a, i })).filter(({ a }) => a && a.nivel <= 4).map(({ a, i }) => linhaDoAlerta(a, i, L));
      if (minhasAtr) acoes.push({ tom: 'r', pill: 'Sua fila', texto: `<b>${num(minhasAtr)} ${minhasAtr === 1 ? 'peça atrasada' : 'peças atrasadas'}</b> na sua fila`, botao: irAba('tarefas', 'Abrir a fila'), curto: `${num(minhasAtr)} na sua fila` });
      const fora = acoes.slice(4);
      const pedeHtml = pede(acoes, { sub: acoes.length ? `${pl(acoes.length, 'coisa', 'coisas')}, da mais grave à menos grave` : '', vazio: 'Nada pedindo ação na produção agora.',
        pe: fora.length ? `+ ${num(fora.length)} · ${fora.slice(0, 2).map((x) => esc(x.curto || '')).filter(Boolean).join(' e ')}` : '' });
      const maiorFila = Math.max(0, ...(N.time || []).map((t) => Number(t.abertas) || 0)), pedem = new Set((N.alertas || []).filter((a) => a.nivel <= 4 && a.ref?.tipo === 'pecas').flatMap((a) => a.ref.ids || []).map(String)).size;
      const mods = modulosDoSetor({
        gestor: [num(pedem), pedem === 1 ? 'pede ação' : 'pedem ação'], tarefas: [num(minhas.length), 'na sua fila'], demandas: solic == null ? null : [num(solic), 'em aberto'],
        agenda: Array.isArray(ag) ? [num(ag.length), 'nos próximos 7 dias'] : null, conteudo: [num(emAprov), 'em aprovação'], planejamentos: [num((C.semPlanejamento || []).length), (C.semPlanejamento || []).length === 1 ? 'cliente sem' : 'clientes sem'],
      }, [{ nome: 'Carga do time', attrs: 'data-g2-mais', n: num(maiorFila), rotulo: 'na maior fila' }]);
      return tela(fala('heitor', frase, { conta: [
        `<b>Atrasada</b>: a data do cliente (veiculação; sem ela, o prazo) já passou e a peça não foi entregue. Pausadas e esquecidas ficam fora. Agora: ${num(H.furos ?? atrasadas)} com a veiculação vencida e ${num(H.prazoInternoVencido ?? 0)} só com o prazo interno.`,
        `<b>Prontas da semana</b>: das ${num(S.previstas)} peças com data nesta semana, ${num(prontas)} já foram entregues (${pl(S.entregues, 'entrega registrada', 'entregas registradas')} na semana).`,
        `<b>Risco de furo</b>: vão ao ar nos próximos 2 dias e ainda não estão prontas.`] }), numerosHtml, duas(pedeHtml, mods, 'mods'),
        mais('Entregas por semana, carga do time, onde trava, cobertura e agenda', resumo
        + linha(bloco('Entregas por semana', `previstas e entregues · mediana ${num(Hi.medianaEntregues)} por semana`, entregasHtml, { icone: 'alta', acao: abrirAba('gestor', 'Painel de trabalho') })
          + bloco('Carga do time', 'peças abertas por pessoa', deitadas(time.map((t) => ({ nome: t.pessoa, valor: t.abertas, cls: t.atrasadas ? 'atencao' : '', rotulo: `${num(t.abertas)}${t.atrasadas ? ` <small class="t-ruim">${num(t.atrasadas)} atras.</small>` : ''}`, sub: `${num(t.entregues7d)} entregue${Number(t.entregues7d) === 1 ? '' : 's'} em 7 dias` })), { vazio: 'Sem números do time.' }), { icone: 'pessoas', acao: abrirAba('tarefas', 'Minhas tarefas') }))
        + linha(bloco('Onde trava', 'peças paradas por status, a pior primeiro', deitadas(gargalos.map((g) => ({ st: true, nome: g.status, valor: g.qtd, cls: g.idadeMedianaDias >= 3 ? 'ruim' : 'atencao', rotulo: `${num(g.qtd)} <small>${num(g.idadeMedianaDias)} d</small>`, sub: `${num(g.qtd)} ${Number(g.qtd) === 1 ? 'peça parada' : 'peças paradas'} há ${num(g.idadeMedianaDias)} ${Number(g.idadeMedianaDias) === 1 ? 'dia' : 'dias'} (mediana)` })), { vazio: 'Nada parado na janela de produção.' }), { icone: 'relogio', acao: abrirAba('direcao') })
          + bloco('Clientes com atraso', 'atrasadas e risco de furo por cliente', deitadas(porCliente.map((c) => ({ cli: true, nome: c.cliente, valor: (c.atrasadas || 0) + (c.emRisco || 0), cls: c.atrasadas ? 'ruim' : 'atencao', rotulo: `${num(c.atrasadas)} <small>+${num(c.emRisco)} risco</small>` })), { vazio: 'Nenhum cliente com atraso ou risco.' }), { icone: 'alerta' }))
        + linha(bloco('Cobertura da semana', `meta de ${num(C.meta || 3)} posts por cliente`, deitadas([{ nome: `Abaixo de ${num(C.meta || 3)} posts`, valor: (C.sem3 || []).length, cls: 'atencao' }, { nome: 'Sem nenhum post', valor: (C.semConteudo || []).length, cls: 'ruim' }, { nome: 'Próxima semana abaixo', valor: (C.proximaSemanaSem3 || []).length, cls: 'atencao' }, { nome: 'Sem planejamento', valor: (C.semPlanejamento || []).length, cls: 'atencao' }]), { icone: 'doc', acao: abrirAba('conteudo') })
          + bloco('Próximos compromissos', 'agenda dos próximos 7 dias', Array.isArray(ag) && ag.length ? `<ul class="vs-agenda">${ag.slice(0, 6).map((e) => `<li><time>${esc(diaMes(e.dia))}${e.inicio ? ' · ' + esc(e.inicio) : ''}</time><b>${esc(e.cliente || e.titulo || 'Compromisso')}</b><small>${esc(tipoAg(e.tipo))}</small></li>`).join('')}</ul>` : aviso(Array.isArray(ag) ? 'Nada na agenda dos próximos 7 dias.' : 'A agenda ainda está carregando.'), { icone: 'calendario', acao: abrirAba('agenda') }))));
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
      const cargaL = [...P].sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0)).slice(0, 8).map((p) => ({ nome: p.nome, valor: Math.min(150, Number(p.pct) || 0), cls: Number(p.pct) >= 100 ? 'ruim' : Number(p.pct) >= 80 ? 'atencao' : 'ok', rotulo: pct(p.pct), sub: `${num(p.pecas)} peça${Number(p.pecas) === 1 ? '' : 's'} · ${num(p.etapas)} etapa${Number(p.etapas) === 1 ? '' : 's'} de projeto` }));
      // ---- Padrão v2: o mesmo molde da Produção ----
      principal = '';
      const frase = (rk.length ? `<b>${pl(entregues, 'entrega', 'entregas')}</b> em ${esc(nomeMes(prod.mes) || 'este mês')}${comData ? `, ${pct((noPrazo / comData) * 100)} no prazo` : ''}.` : prod.falha ? 'O ranking do mês é da gestão.' : '<b>Nenhuma entrega registrada</b> neste mês ainda.')
        + ` ${atrasadas ? `<b>${pl(atrasadas, 'peça atrasada', 'peças atrasadas')}</b> no time` : 'Ninguém com peça atrasada'}${cheias ? ` e ${pl(cheias, 'pessoa', 'pessoas')} com a semana cheia` : ''}.`;
      const numerosHtml = tres([
        { rotulo: 'Entregues no mês', valor: rk.length ? num(entregues) : '—', sub: rk.length ? esc(nomeMes(prod.mes)) : (prod.falha ? 'o ranking é da gestão' : 'nenhuma ainda') },
        { rotulo: 'No prazo', valor: comData ? pct((noPrazo / comData) * 100) : '—', barra: comData ? Math.round((noPrazo / comData) * 100) : null, cor: '#11613A', sub: 'das entregas com data' },
        { rotulo: 'Atrasadas', valor: num(atrasadas), tom: atrasadas ? 'ruim' : '', sub: `${pl(naEquipe, 'pessoa', 'pessoas')} na equipe · ${num(online.length)} online agora` },
      ]);
      const acoes = [...T].filter((t) => t.atrasadas || t.emRisco).sort((a, b) => (b.atrasadas || 0) - (a.atrasadas || 0) || (b.emRisco || 0) - (a.emRisco || 0)).map((t) => ({ tom: t.atrasadas ? 'r' : 'a', pill: t.atrasadas ? pl(t.atrasadas, 'atrasada', 'atrasadas') : `${num(t.emRisco)} em risco`,
        texto: `<b>${esc(t.pessoa)}</b> · ${num(t.abertas)} abertas${t.emRisco && t.atrasadas ? `, ${num(t.emRisco)} com risco de furo` : ''}`, botao: btn('Ver quais', `data-espiar="${t.atrasadas ? 'atrasadas' : 'emRisco'}|pessoa:${esc(t.pessoa)}"`) }));
      if (cheias) acoes.push({ tom: 'a', pill: 'Semana cheia', texto: `<b>${pl(cheias, 'pessoa', 'pessoas')}</b> com 100% ou mais da capacidade`, det: [P.filter((p) => Number(p.pct) >= 100).slice(0, 6).map((p) => `${esc(p.nome)} ${pct(p.pct)}`).join(' · ')] });
      const mods = modulosDoSetor({ produtividade: rk.length ? [num(rk.length), 'no ranking do mês'] : null });
      return tela(fala('alex', frase), numerosHtml, duas(pede(acoes, { sub: acoes.length ? `${pl(acoes.length, 'coisa', 'coisas')}, na ordem` : '', vazio: 'Ninguém com atraso ou risco agora.', mostra: 4 }), mods, 'mods'),
        mais('Todos os números, entregas e meta por pessoa, carga da semana e riscos', `${grade(kpis)}`
        + linha(bloco('Entregas do mês e meta', 'por pessoa (a marca é a meta proporcional até hoje)', rk.length ? deitadas(ranking) : aviso(prod.falha ? falhaTexto(prod) : 'Sem entregas no mês.'), { icone: 'trofeu', acao: abrirAba('produtividade') })
          + bloco('Carga da semana', 'peças e etapas abertas sobre a capacidade', deitadas(cargaL, { vazio: 'Sem números de carga agora.' }), { icone: 'relogio', acao: abrirAba('equipe') }))
        + linha(bloco('Entregas em 7 dias', 'por pessoa, das demandas do painel', deitadas([...T].sort((a, b) => (b.entregues7d || 0) - (a.entregues7d || 0)).slice(0, 8).map((t) => ({ nome: t.pessoa, valor: t.entregues7d, cls: 'ok', sub: `${num(t.abertas)} abertas` })), { vazio: 'Sem entregas nos últimos 7 dias.' }), { icone: 'aperto' })
          + bloco('Atrasos e riscos por pessoa', 'o que cobrar hoje', deitadas(T.filter((t) => t.atrasadas || t.emRisco).slice(0, 8).map((t) => ({ nome: t.pessoa, valor: (t.atrasadas || 0) + (t.emRisco || 0), cls: t.atrasadas ? 'ruim' : 'atencao', rotulo: `${num(t.atrasadas)} <small>+${num(t.emRisco)} risco</small>`, sub: (t.cobrar || [])[0] || '' })), { vazio: 'Ninguém com atraso ou risco.' }), { icone: 'alerta' }))));
    },
  };

  async function pintar() {
    if (el.hidden || !ctx) return;
    el.classList?.toggle?.('fv2-casa', atual === 'setor:financas' && Boolean(window.VybeFinancas?.telas?.visao));
    const g = ++geracao, montar = PAINEIS[atual], comPeriodo = atual === 'setor:comercial' || atual === 'setor:financas';
    el.innerHTML = `<div class="g2-topo vs-topo"><h2>${esc(ctx.nome)}</h2><span class="g2-seg" role="group" aria-label="Setores">${SETORES.map(([id, n]) => `<button type="button" data-setor-ir="${id}" aria-pressed="${id === atual}">${n}</button>`).join('')}</span>${comPeriodo ? barraPeriodo() : ''}
      <button type="button" class="g2-btn g2-atualizar" data-setor-atualizar title="Atualizar">${I_VOLTA}Atualizado ${hora()}</button><span class="g2-vaga"></span><button type="button" class="g2-btn g2-fechar" data-setor-fechar aria-label="Fechar">${traco('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div>
      <div class="vv-g-corpo vs-corpo">${carregando()}</div>`;
    principal = '';
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
    const vaga = el.querySelector('.g2-vaga'); if (vaga) vaga.innerHTML = principal;
    if (periodoSemEfeito && per.tipo === 'mensal' && per.mes === mesAtual()) { const barra = el.querySelector('.vs-topo .vs-periodo'); if (typeof barra?.remove === 'function') barra.remove(); }
  }

  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (cliqueV2(b)) return;
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
  // O último painel pintado dentro da Gestão: ela se redesenha a cada minuto, e o painel volta na hora, sem piscar.
  let alvoEm = null, geracaoEm = 0, ultimoEm = null;
  async function pintarEm(destino, setor, contexto) {
    if (!destino || !PAINEIS[setor]) return;
    ctx = contexto; alvoEm = { destino, setor, contexto };
    const g = ++geracaoEm;
    const mesmo = Boolean(ultimoEm && ultimoEm.setor === setor);
    principal = '';
    destino.innerHTML = `<div class="g2-topo vs-em-topo"><h2>${setor === 'setor:agencia' ? 'A agência inteira' : esc(contexto?.nome || '')}</h2>${barraPeriodo()}
      <button type="button" class="g2-btn g2-atualizar" data-setor-atualizar title="Atualizar">${I_VOLTA}Atualizado ${hora(contexto?.numeros?.()?.geradoEm)}</button><span class="g2-vaga">${mesmo ? ultimoEm.principal : ''}</span></div>
      <div class="vs-corpo${mesmo ? ' g2-quieta' : ''}">${mesmo ? ultimoEm.corpo : carregando()}</div>`;
    if (!destino.dataset.vsOuvindo) {
      destino.dataset.vsOuvindo = '1';
      destino.addEventListener('click', (ev) => {
        const b = ev.target.closest('button'); if (!b || !alvoEm) return;
        if (cliqueV2(b)) return;
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
    const c = destino.querySelector('.vs-corpo'); if (c && !(mesmo && ultimoEm.corpo === corpo)) c.innerHTML = corpo;
    const vaga = destino.querySelector('.g2-vaga'); if (vaga) vaga.innerHTML = principal;
    ultimoEm = { setor, corpo, principal };
  }
  // As peças do painel, para as abas da Gestão usarem o mesmo desenho (sem uma segunda versão delas).
  const pecas = Object.freeze({ kpi: (o) => kpi({ ...o, cartao: true }), kpiLinha: kpi, grade, bloco, barras, deitadas, linha, progresso,
    v2: Object.freeze({ fala, tres, pede, cartao, duas, mais, tela, btn, elo, pl, pctDe, hora, traco, clique: cliqueV2 }) });
  window.VybeSetor = Object.freeze({ abrir, fechar, aberto: () => (el.hidden ? '' : atual), atualizar: () => pintar(), pintarEm, pecas });
})();
