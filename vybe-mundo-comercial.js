// vybe-mundo-comercial.js — setor Comercial e dinheiro da agência no Irecity (Paulo, 07/11/2026; inspirado no AgencyFlow).
//
// Uma janela do Irecity (como o WhatsApp interno), pensada primeiro para o celular dos heads: no telefone ocupa a tela
// toda, abas roláveis, cartões em vez de tabela e formulários numa folha que sobe de baixo.
//   window.VybeComercial.abrir(aba) · fechar() · aberto()
//   Abas: funil, pacotes, orcamentos, financas, recebimentos, contas, inadimplencia, caixa, fornecedores, creators.
// Abre também pela sala de Closing do 1º andar (planta: modulo { tipo: 'janela', alvo: 'comercial' }).
// Dados: /api/painel?area=comercial (server/comercial.js) e, para mover oportunidades, o CRM existente (area=crm).
// Contas: shared/comercial-calculos.js (window.VybeComercialCalculos), as mesmas do servidor.
// Quem vê: o servidor decide (pode.ver_dinheiro). As abas de dinheiro nem aparecem para quem não é dono/administração.
// Nada aqui envia mensagem: registrar contato, proposta ou cobrança é anotação da equipe.
(() => {
  const C = () => window.VybeComercialCalculos;
  const ABAS = [
    ['funil', 'Funil'], ['pacotes', 'Pacotes'], ['orcamentos', 'Orçamentos'], ['financas', 'Finanças por cliente', 1], ['recebimentos', 'Recebimentos', 1],
    ['contas', 'Contas a pagar', 1], ['inadimplencia', 'Inadimplência', 1], ['caixa', 'Caixa', 1], ['fornecedores', 'Fornecedores', 1], ['creators', 'Creators'],
  ];
  const AJUDA = {
    funil: 'O funil é o mesmo CRM do 1º andar. Novo junta as etapas do SDR (empresa, qualificação, abordagem e aprovação humana). Avance uma etapa por vez; Follow-up é opcional. Para marcar Perdido, o motivo é obrigatório e vira o relatório de motivos. Conversão = quantos chegaram à fase seguinte ÷ quantos chegaram a esta. Em negociação soma o valor mensal (recorrente) e o avulso das oportunidades abertas. O selo Cabe/Aperta/Estoura diz se o time aguenta o pacote vendido. Os donos podem acrescentar e reordenar etapas do meio do funil. No topo, o mês (ou o ano): metas de MRR, avulso, negócios fechados e leads (só os donos editam; no anual, soma dos meses), leads novos (oportunidades que entraram no funil), propostas enviadas (entradas na etapa Proposta comercial) e negócios fechados (foram para Ganho), comparados com o período anterior; a corrida comercial (quem fechou mais: o responsável da oportunidade, ou quem cadastrou quando não há responsável) e os gráficos dos últimos 6 meses. Os valores em reais aparecem só para os donos. O formulário de leads é um link público para a bio e o site: quem preenche entra em Novo com a etiqueta Formulário.',
    pacotes: 'A esteira de produtos da Vybe. Cada pacote tem tipo (recorrente ou avulso), preço, entregas e a carga por cargo (demandas por mês) usada no Capacidade × vendas. Os donos veem o custo estimado (horas × custo/hora + captações × custo) e a margem; abaixo de 20% é zona crítica. Produto campeão e ticket médio saem dos negócios ganhos.',
    orcamentos: 'Monte a proposta a partir dos pacotes: itens, quantidade, desconto e validade. O preço fica guardado como estava no dia (mudar o pacote depois não muda a proposta). Antes de fechar, confira se o time aguenta. "Imprimir" abre uma página limpa para salvar em PDF.',
    financas: 'Só donos e administração. Com o Vybe Finanças ligado (só leitura), o topo mostra o mês de lá: recebido × previsto, despesas, folha, custos fixos (assinaturas), resultado, os gráficos de faturamento × custos e ticket médio, e a margem real de cada cliente (recebido − despesas ligadas a ele). Embaixo, o valor mensal do contrato, o pacote (de onde sai o custo estimado) e a margem estimada; abaixo de 20% é zona crítica. O status de pagamento é informado à mão.',
    recebimentos: 'Só donos e administração. Uma linha por fatura. Recorrente: escolha o cliente e o ciclo; depois de lançar, "Próximo ciclo" cria a fatura seguinte. Pontual: descrição e categoria. Atrasado = venceu há até 30 dias; inadimplente = mais de 30. Os cartões comparam com o mês (ou ano) anterior.',
    contas: 'Só donos e administração. Fixas, variáveis, folha, impostos e investimentos, cada grupo com o total e o % do faturamento (o "a receber" do período). Fixo = fixas + folha; variável = o resto. "A pagar em 7 dias" olha de hoje até daqui a 7 dias.',
    inadimplencia: 'Só donos e administração. Faturas vencidas e não recebidas, por cliente, com o atraso mais antigo. Vermelho: mais de 30 dias; âmbar: 8 a 30; rosa: até 7. Também lista quem foi marcado à mão como atrasado ou inadimplente em Finanças por cliente.',
    caixa: 'Só donos e administração. Previsão do mês atual e dos 3 seguintes: recebimentos recorrentes (os lançados e a projeção de cada contrato pelo ciclo) menos contas fixas e folha. Mês sem conta lançada repete o fixo do mês atual (estimado). Se a Carteira indicar risco alto de churn num cliente que pesa mais de 15% do faturamento, aparece o alerta.',
    fornecedores: 'Só donos e administração. Cadastro por categoria, com BV (% de bonificação de volume) e contato.',
    creators: 'Influenciadores locais de Irecê e região: @, seguidores, engajamento, nicho, cidade e contato. Filtre por nicho e cidade.',
  };
  const st = { aberto: false, aba: 'funil', dados: {}, erro: {}, carregando: {}, folha: null, ajuda: false, periodo: { tipo: 'mensal', mes: '' },
    fase: '', filtro: {}, msg: '', ocupado: false, etapasEdit: null };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = { fechar: svg('<path d="M6 6l12 12M18 6 6 18"/>'), marca: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>'), ajuda: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17h.01"/>'),
    mais: svg('<path d="M12 5v14M5 12h14"/>'), cima: svg('<path d="m6 15 6-6 6 6"/>'), baixo: svg('<path d="m6 9 6 6 6-6"/>') };
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const din = (v) => (v == null ? '—' : BRL.format(Number(v) || 0));
  const num = (v) => Number(v || 0).toLocaleString('pt-BR');
  const pc = (v) => (v == null ? '—' : String(v).replace('.', ',') + '%');
  const data = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) + '/' + String(iso).slice(0, 4) : '—');
  const hojeIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeMes = (m) => (/^\d{4}-\d{2}$/.test(m || '') ? MESES[Number(m.slice(5)) - 1] + ' de ' + m.slice(0, 4) : m);
  const pill = (texto, u) => `<span class="vc-pill ${u || 'u5'}">${esc(texto)}</span>`;
  const STATUS_REC = { recebido: ['Recebido', 'u6'], pendente: ['Pendente', 'u4'], parcial: ['Parcial', 'u4'], atrasado: ['Atrasado', 'u2'], inadimplente: ['Inadimplente', 'u1'], cancelado: ['Cancelado', 'u5'] };
  const STATUS_PAG = { em_dia: ['Em dia', 'u6'], atrasado: ['Atrasado', 'u2'], inadimplente: ['Inadimplente', 'u1'] };
  const STATUS_ORC = { rascunho: ['Rascunho', 'u5'], enviado: ['Enviado', 'u4'], aceito: ['Aceito', 'u6'], recusado: ['Recusado', 'u3'] };
  // Palpite antes da primeira resposta do servidor (que é quem decide): só para não piscar abas de dinheiro.
  function palpiteDono() {
    try { if (typeof souAdmin === 'function' && souAdmin()) return true; } catch {}
    try { return typeof souDonoDaSessao === 'function' && souDonoDaSessao(); } catch { return false; } // dono pelo servidor (server/donos.js)
  }
  let podeDinheiro = null;
  const veDinheiro = () => (podeDinheiro == null ? palpiteDono() : podeDinheiro);
  const pode = () => st.dados[st.aba]?.pode || Object.values(st.dados).find((d) => d?.pode)?.pode || {};

  // ---------- Rede ----------
  async function pedir(area, corpo, query = '') {
    const r = await fetch(`/api/painel?area=${area}${query}`, { credentials: 'same-origin', cache: 'no-store',
      ...(corpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) } : {}) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || 'Não foi possível acessar o Comercial.'), { status: r.status });
    return d;
  }
  function queryDaAba(aba) {
    const p = ['recebimentos', 'contas', 'funil'].includes(aba) ? `&mes=${encodeURIComponent(st.periodo.mes || hojeIso().slice(0, 7))}&periodo=${st.periodo.tipo}` : '';
    return `&aba=${aba}${p}`;
  }
  // Dado incompleto (banco ainda sem as tabelas, resposta parcial): listas viram vazias e blocos viram objetos vazios,
  // e a aba mostra o estado vazio dela em vez de "Não foi possível mostrar esta aba" (08/11/2026).
  const LISTAS = ['etapas', 'fases', 'motivos', 'oportunidades', 'pacotes', 'clientes', 'orcamentos', 'contas', 'recebiveis', 'faturas', 'categorias', 'fornecedores', 'creators', 'marcados_a_mao', 'status'];
  const BLOCOS = ['capacidade', 'resumo', 'pode', 'faturamento', 'opcoes', 'produtos', 'periodo'];
  // Mini painel dos números (Paulo, 08/11: clicar no número e ver quem está nele).
  (window.VybeEspiarProvedores = window.VybeEspiarProvedores || {}).comercial = (resto) => {
    const [aba, filtro, extra] = String(resto).split(':'), d = st.dados[aba]; if (!d) return null;
    if (aba === 'funil') return espiarFunil(d, filtro, extra);
    const ir = (it) => { st.filtro.financas = it.nome; pintar(); };
    if (aba === 'financas') {
      const def = { critica: ['Clientes em zona crítica de margem', (c) => c.zona_critica, 'u1'], atrasado: ['Pagamento atrasado', (c) => c.status_pagamento === 'atrasado', 'u2'], inadimplente: ['Inadimplentes', (c) => c.status_pagamento === 'inadimplente', 'u1'] }[filtro];
      if (!def) return null;
      const itens = d.clientes.filter(def[1]).map((c) => ({ nome: c.cliente_nome, sub: [c.pacote_nome, c.margem_percentual != null ? 'margem ' + pc(c.margem_percentual) : ''].filter(Boolean).join(' · '), dir: c.valor_mensal ? din(c.valor_mensal) + '/mês' : '' }));
      return { titulo: def[0], cls: def[2], itens, vazio: 'Nenhum cliente.', rodape: 'Clique para filtrar a lista', clicar: ir };
    }
    if (aba === 'inadimplencia' && filtro === 'criticos') {
      const itens = d.clientes.filter((c) => c.severidade?.nivel === 'u1').map((c) => ({ nome: c.cliente_nome, sub: `${num(c.faturas)} fatura${c.faturas > 1 ? 's' : ''} · ${num(c.atraso_mais_antigo)} dias de atraso`, dir: din(c.valor), cls: 'u1' }));
      return { titulo: 'Críticos (mais de 30 dias)', cls: 'u1', itens, vazio: 'Ninguém com mais de 30 dias.' };
    }
    return null;
  };
  function completar(d) {
    const x = { ...(d || {}) };
    for (const k of LISTAS) if (!Array.isArray(x[k])) x[k] = [];
    for (const k of BLOCOS) if (!x[k] || typeof x[k] !== 'object') x[k] = {};
    if (typeof x.criticos !== 'number') x.criticos = Number(x.criticos) || 0; // número, não lista
    // Partes de dentro que as abas leem direto (antes: resposta parcial quebrava funil, finanças, recebimentos, contas e caixa).
    const obj = (o, k) => { if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {}; return o[k]; };
    const arr = (o, k) => { if (!Array.isArray(o[k])) o[k] = []; return o[k]; };
    const r = x.resumo = { ...x.resumo };
    for (const k of ['fases', 'motivos_perda', 'grupos', 'cargos']) arr(r, k);
    for (const k of ['pagamento', 'atual', 'variacao', 'sete_dias', 'vencidas', 'em_negociacao']) obj(r, k);
    x.opcoes = { ...x.opcoes }; for (const k of ['nichos', 'cidades']) arr(x.opcoes, k);
    if (!/^\d{4}-\d{2}-\d{2}/.test(x.hoje || '')) x.hoje = hojeIso();
    x.periodo = { tipo: 'mensal', mes: x.hoje.slice(0, 7), rotulo: '', ...x.periodo };
    // Funil: metas, KPIs do mês, corrida e séries (server/comercial.js mesComercial). Sem ele, a aba pinta só o funil.
    if (x.mes && typeof x.mes === 'object' && !Array.isArray(x.mes)) {
      const m = x.mes = { ...x.mes };
      const k = obj(m, 'kpis'); for (const c of ['atual', 'anterior', 'variacao']) obj(k, c);
      for (const c of ['progresso', 'series', 'propostas']) arr(m, c);
      arr(obj(m, 'ranking'), 'linhas'); obj(m.ranking, 'sem_atribuicao'); obj(m, 'metas'); obj(m, 'formulario'); obj(m, 'metas_por_mes');
      if (!Array.isArray(m.leads_formulario)) m.leads_formulario = null;
      if (!m.periodo || !/^\d{4}-\d{2}-\d{2}$/.test(m.periodo.inicio || '') || !m.periodo.anterior) { try { m.periodo = C().periodo(x.hoje.slice(0, 7)); } catch { m.periodo = null; } }
    } else x.mes = null;
    if (x.previsao && typeof x.previsao === 'object') { x.previsao = { ...x.previsao }; arr(x.previsao, 'meses'); arr(x.previsao, 'alertas'); }
    else x.previsao = { meses: [], alertas: [] };
    return x;
  }
  async function carregar(aba = st.aba) {
    st.carregando[aba] = true; st.erro[aba] = ''; pintar();
    try {
      const d = await pedir('comercial', null, queryDaAba(aba));
      st.dados[aba] = completar(d); if (d.pode) podeDinheiro = Boolean(d.pode.ver_dinheiro);
      if (ABAS_FIN.has(aba)) carregarFin();
    } catch (e) {
      st.erro[aba] = e.message;
      if (e.status === 403 && ABAS.find((a) => a[0] === aba)?.[2]) podeDinheiro = false;
    } finally { st.carregando[aba] = false; pintar(); }
  }
  async function executar(fn, sucesso = '') {
    if (st.ocupado) return false;
    st.ocupado = true; st.msg = ''; pintar();
    try { await fn(); st.folha = null; st.msg = sucesso; await carregar(); return true; }
    catch (e) { st.msg = '⚠️ ' + e.message; return false; }
    finally { st.ocupado = false; pintar(); }
  }
  const comercial = (corpo) => pedir('comercial', corpo);
  const crm = (corpo) => pedir('crm', corpo);

  // ---------- Vybe Finanças (só leitura; vybe-mundo-financas.js → area=vybe_financas) ----------
  // Conectado, o Finanças é a fonte do dinheiro destas abas (a tela diz "fonte: Vybe Finanças") e os números lançados à
  // mão no Vybe OS saem dos cartões do topo (as listas e os botões ficam). Desconectado ou fora do ar, tudo como antes.
  const ABAS_FIN = new Set(['financas', 'contas', 'inadimplencia', 'caixa']);
  const mesFin = () => st.periodo.mes || hojeIso().slice(0, 7);
  const finEstado = () => window.VybeFinancas?.estado?.('comercial', mesFin()) || null;
  const fin = () => { const d = finEstado()?.dados; return d?.conectado ? d : null; };
  function carregarFin(forcar = false) {
    if (!window.VybeFinancas || !veDinheiro()) return;
    window.VybeFinancas.carregar('comercial', mesFin(), { forcar }).then(() => { if (st.aberto && ABAS_FIN.has(st.aba)) pintar(); });
  }
  const fonteFin = () => pill('fonte: Vybe Finanças', 'u4');
  function avisoFin(completo) {
    const e = finEstado(); if (!e) return '';
    if (e.carregando && !e.dados) return '<p class="vc-dica">Lendo o Vybe Finanças…</p>';
    if (e.erro) return `<p class="vc-aviso">Vybe Finanças: ${esc(e.erro)} Abaixo, o que está lançado no Vybe OS.</p>`;
    const d = e.dados; if (!d || d.conectado) return '';
    if (!completo) return `<p class="vc-dica">${esc(d.motivo)}: o passo a passo está na aba Finanças por cliente.</p>`;
    return `<div class="vc-aviso" role="note"><b>${esc(d.motivo)}</b><p>Ligado, o dinheiro destas abas passa a vir do Vybe Finanças (só leitura): recebido × previsto, despesas, custos fixos, folha, margem real e inadimplência.</p>
      ${d.aviso ? `<p>${esc(d.aviso)}</p>` : ''}<ol>${(d.passos || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ol><p>Detalhes em docs/vybe-financas.md.</p></div>`;
  }
  const varFin = (atual, anterior) => (anterior ? Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10 : null);
  function finTopo(f) {
    const r = f.resumo, fo = f.folha, cf = f.custos_fixos, dsp = f.despesas;
    const negativas = f.margens.filter((m) => m.periodo.margem < 0).length;
    return `<div class="vc-secao"><h3>${esc(nomeMes(f.mes))}</h3>${fonteFin()}</div>
      <div class="vc-periodo"><input type="month" class="vc-campo-mes" data-vc-mes value="${esc(f.mes)}" aria-label="Mês"></div>
      <div class="vc-kpis">${kpi('Recebido', din(r.recebido) + (r.recebido_percentual != null ? `<small> · ${pc(r.recebido_percentual)} do previsto</small>` : ''), { espiar: 'financas:comercial:serie:' + f.mes })}
        ${kpi('Previsto', din(r.previsto) + (r.mensalidades_sem_lancamento ? `<small> · ${din(r.mensalidades_sem_lancamento)} sem lançamento</small>` : ''))}
        ${kpi('Despesas do mês', din(dsp.total), { espiar: 'financas:comercial:despesas', u: dsp.total > r.recebido && dsp.total ? 'u2' : '' })}
        ${kpi('Folha do mês', din(fo.total) + `<small> · ${num(fo.quantidade)} pessoa${fo.quantidade === 1 ? '' : 's'}</small>`, { variacao: varFin(fo.total, fo.total_anterior), rotuloVar: 'vs mês anterior', inverso: true })}
        ${kpi('Custos fixos (assinaturas)', din(cf.total) + `<small>/mês · ${num(cf.quantidade)}</small>`, { espiar: 'financas:comercial:fixos' })}
        ${kpi('Resultado (recebido − pago)', din(r.resultado), { u: r.resultado < 0 ? 'u1' : '' })}
        ${kpi('Em atraso', din(f.inadimplencia.total), { espiar: 'financas:comercial:inad', u: f.inadimplencia.total ? 'u1' : '' })}
        ${kpi('Margem negativa (3 meses)', num(negativas), { espiar: 'financas:comercial:margem:negativa', u: negativas ? 'u1' : '' })}</div>`;
  }
  function finGraficos(f) {
    if (!f.series.length) return '';
    const esp = (mes) => 'financas:comercial:serie:' + mes;
    return `<div class="vc-secao"><h3>Mês a mês</h3>${fonteFin()}</div><div class="vc-graficos">
      ${grafico({ meses: f.series, aria: 'Faturamento recebido e custos pagos por mês', espiar: esp,
        series: [{ chave: 'faturamento', cls: 'ent', rotulo: 'Faturamento (recebido)', fmt: din, curto }, { chave: 'custos', cls: 'sai', rotulo: 'Custos (pagos)', fmt: din, curto }] })}
      ${grafico({ meses: f.series, aria: 'Ticket médio por mês', espiar: esp, series: [{ chave: 'ticket_medio', cls: 'mrr', rotulo: 'Ticket médio (recebido ÷ clientes que pagaram)', fmt: din, curto }] })}</div>`;
  }
  function finMargens(f) {
    const lista = f.margens.slice(0, 12);
    const sem = f.ligacao.sem_par.length;
    return `<div class="vc-secao"><h3>Margem real por cliente</h3>${fonteFin()}</div>
      <p class="vc-dica">Recebido do cliente − despesas ligadas a ele no Finanças, no mês e nos 3 meses até ele.${sem ? ` <span class="vc-link espiavel" data-espiar="financas:comercial:sempar" role="button" tabindex="0">${num(sem)} no Finanças sem par no Vybe OS</span>` : ''}</p>
      <div class="vc-lista">${lista.map((m) => `<article class="vc-cartao${m.periodo.margem < 0 ? ' critico' : ''}"><div class="vc-cartao-topo"><b>${esc(m.cliente_nome)}</b>${m.no_vybe ? '' : pill('Sem par no Vybe OS', 'u5')}${m.periodo.margem < 0 ? pill('Margem negativa', 'u1') : ''}</div>
        <p class="vc-grande">${din(m.periodo.margem)}<small> em 3 meses${m.periodo.margem_percentual != null ? ' · ' + pc(m.periodo.margem_percentual) : ''}</small></p>
        <small>No mês: recebido ${din(m.mes.receita)} − despesas ${din(m.mes.despesas)} = ${din(m.mes.margem)}</small></article>`).join('') || vazio('Nenhuma receita ou despesa ligada a cliente no Finanças nesses 3 meses.')}</div>
      ${f.margens.length > lista.length ? `<span class="vc-link espiavel" data-espiar="financas:comercial:margem" role="button" tabindex="0">Ver os ${num(f.margens.length)} clientes</span>` : ''}`;
  }
  const margemFinDe = (f, clienteId) => f?.margens.find((m) => m.cliente_id && String(m.cliente_id) === String(clienteId)) || null;

  // ---------- Capacidade × vendas (carga atual = demandas abertas do painel) ----------
  function demandasAbertas() {
    const lista = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : null;
    if (!lista || !lista.length) return null;
    const fechada = (d) => (typeof isFinishedItem === 'function' ? isFinishedItem(d) : /finalizad|feito|conclu/i.test(String(d.status || '')));
    return lista.filter((d) => !fechada(d)).map((d) => ({ responsavel_ids: d.responsavel_ids, responsavel_id: d.responsavel_id }));
  }
  function capacidadeHtml(cap, acrescimo, { compacto = false } = {}) {
    if (!cap) return '';
    if (!Object.values(cap.capacidades || {}).some((n) => n > 0)) return compacto ? '' : `<p class="vc-dica">Capacidade × vendas: os donos ainda não configuraram a capacidade mensal por cargo (aba Pacotes).</p>`;
    const dem = demandasAbertas();
    const r = C().capacidadeTime({ capacidades: cap.capacidades, pessoas: cap.pessoas, demandas: dem || [], acrescimo });
    if (compacto) return pill(r.rotulo, r.urgencia);
    const usados = r.cargos.filter((c) => c.acrescimo > 0 || c.capacidade > 0);
    return `<div class="vc-cap"><div class="vc-cap-topo"><b>O time aguenta?</b>${pill(r.rotulo, r.urgencia)}</div>
      ${dem ? '' : '<p class="vc-dica">A carga atual vem das demandas abertas do painel, que ainda não carregaram: conta só o que entra agora.</p>'}
      <ul>${usados.map((c) => `<li><span>${esc(c.nome)}</span><span class="vc-barra"><i class="${c.urgencia}" style="width:${Math.min(100, c.uso ?? 100)}%"></i></span><small>${num(c.carga_atual)}${c.acrescimo ? ' + ' + num(c.acrescimo) : ''} / ${c.capacidade ? num(c.capacidade) : 'sem capacidade'}</small>${pill(c.rotulo, c.urgencia)}</li>`).join('')}</ul></div>`;
  }

  // ---------- Pedaços ----------
  const vazio = (frase, botao = '', acao = '') => `<div class="vc-vazio"><p>${esc(frase)}</p>${botao ? `<button type="button" class="vc-acao" data-vc="${acao}">${esc(botao)}</button>` : ''}</div>`;
  function kpi(rotulo, valor, { variacao = null, rotuloVar = '', u = '', inverso = false, espiar = '' } = {}) {
    let v = '';
    if (rotuloVar) {
      if (variacao == null) v = `<small class="vc-var">sem base ${esc(rotuloVar)}</small>`;
      else { const bom = inverso ? variacao <= 0 : variacao >= 0; v = `<small class="vc-var ${variacao === 0 ? '' : bom ? 'bom' : 'ruim'}">${variacao > 0 ? '▲' : variacao < 0 ? '▼' : '='} ${pc(Math.abs(variacao))} ${esc(rotuloVar)}</small>`; }
    }
    const ab = espiar ? ` data-espiar="${espiar.startsWith('financas:') ? '' : 'comercial:'}${esc(espiar)}" role="button" tabindex="0"` : '';
    return `<div class="vc-kpi${u ? ' ' + u : ''}${espiar ? ' espiavel' : ''}"${ab}><span>${esc(rotulo)}</span><b>${valor}</b>${v}</div>`;
  }
  function seletorPeriodo() {
    const m = st.periodo.mes || hojeIso().slice(0, 7);
    return `<div class="vc-periodo"><div class="vc-seg" role="group" aria-label="Período">${[['mensal', 'Mensal'], ['anual', 'Anual']].map(([k, n]) => `<button type="button" data-vc-periodo="${k}" aria-pressed="${st.periodo.tipo === k}">${n}</button>`).join('')}</div>
      <input type="month" class="vc-campo-mes" data-vc-mes value="${esc(m)}" aria-label="Mês"></div>`;
  }
  const rotuloAnterior = () => (st.periodo.tipo === 'anual' ? 'vs ano anterior' : 'vs mês anterior');
  const botaoNovo = (texto, acao) => `<button type="button" class="vc-acao" data-vc="${acao}">${IC.mais}<span>${esc(texto)}</span></button>`;

  // ---------- Abas ----------
  function abaFunil(d) {
    const p = d.pode || {}, cap = d.capacidade;
    const fases = d.fases || [], r = d.resumo;
    const etapaNome = (id) => d.etapas.find((e) => e.id === id)?.nome || id;
    const faseDe = (etapa) => fases.find((f) => f.etapas.includes(etapa))?.id;
    const sel = st.fase || fases.find((f) => (r.fases.find((x) => x.id === f.id)?.atual || 0) > 0 && !['ganho', 'perdido'].includes(f.id))?.id || 'novo';
    const ops = d.oportunidades.filter((o) => faseDe(o.etapa) === sel);
    const pacote = (id) => d.pacotes.find((x) => String(x.id) === String(id));
    const card = (o) => {
      const i = d.etapas.findIndex((e) => e.id === o.etapa), prox = d.etapas[i + 1], fim = ['ganho', 'perdido'].includes(o.etapa);
      const pulo = prox?.id === 'follow_up' ? d.etapas[i + 2] : null, pk = pacote(o.pacote_id);
      const capSelo = pk && !fim && ['proposta', 'follow_up'].includes(faseDe(o.etapa)) ? capacidadeHtml(cap, C().cargaDosItens([{ carga: pk.carga, quantidade: 1 }]), { compacto: true }) : '';
      const botoes = p.editar_comercial && !fim ? `<div class="vc-linha-acoes">
        ${prox && prox.id !== 'perdido' ? `<button type="button" class="vc-sec" data-vc="mover" data-id="${esc(o.id)}" data-de="${esc(o.etapa)}" data-para="${esc(prox.id)}">${o.etapa === 'abordagem_proposta' ? 'Aprovar abordagem' : '→ ' + esc(prox.nome)}</button>` : ''}
        ${pulo ? `<button type="button" class="vc-sec" data-vc="mover" data-id="${esc(o.id)}" data-de="${esc(o.etapa)}" data-para="${esc(pulo.id)}">→ ${esc(pulo.nome)}</button>` : ''}
        ${d.valor_disponivel ? `<button type="button" class="vc-sec" data-vc="valor" data-id="${esc(o.id)}">Valor</button>` : ''}
        <button type="button" class="vc-perigo" data-vc="perder" data-id="${esc(o.id)}" data-de="${esc(o.etapa)}">Perdido</button></div>` : '';
      return `<article class="vc-cartao"><div class="vc-cartao-topo"><b>${esc(o.nome)}</b>${o.origem === 'formulario' ? pill('Formulário', 'u4') : ''}${capSelo}</div>
        <small>${esc(etapaNome(o.etapa))} · ${esc(o.responsavel_nome || 'Sem responsável')}${o.proxima_acao ? ' · ' + esc(o.proxima_acao) : ''}</small>
        ${d.valor_disponivel && (o.valor_mensal || o.valor_avulso) ? `<small>${o.valor_mensal ? din(o.valor_mensal) + '/mês' : ''}${o.valor_mensal && o.valor_avulso ? ' + ' : ''}${o.valor_avulso ? din(o.valor_avulso) + ' avulso' : ''}${pk ? ' · ' + esc(pk.nome) : ''}</small>` : ''}
        ${o.etapa === 'perdido' ? `<small>Motivo: ${esc(d.motivos.find((m) => m.id === o.motivo_perda)?.nome || 'não registrado')}${o.motivo_texto ? ' — ' + esc(o.motivo_texto) : ''}</small>` : ''}
        ${botoes}</article>`;
    };
    const maxMotivo = Math.max(1, ...r.motivos_perda.map((m) => m.quantidade));
    return `${blocoMes(d)}<div class="vc-secao"><h3>Funil agora</h3></div><div class="vc-kpis">
        ${kpi('Em negociação (mensal)', din(r.em_negociacao.mensal))}${kpi('Em negociação (avulso)', din(r.em_negociacao.avulso))}
        ${kpi('Abertas', num(r.em_negociacao.quantidade))}${kpi('Taxa de ganho', pc(r.taxa_ganho))}</div>
      ${d.valor_disponivel ? '' : '<p class="vc-aviso">Valor da negociação, Follow-up e etapas novas dependem da migração 2026-11-07-comercial.sql (o Paulo aplica).</p>'}
      ${d.produtos?.campeao ? `<p class="vc-dica">Produto campeão: <b>${esc(d.produtos.campeao.nome)}</b> (${num(d.produtos.campeao.ganhos)} ganhos) · ticket médio ${din(d.produtos.ticket_medio_mensal)}/mês${d.produtos.ticket_medio_avulso ? ' · ' + din(d.produtos.ticket_medio_avulso) + ' avulso' : ''}</p>` : ''}
      <div class="vc-secao"><h3>Fases</h3>${p.editar_pacotes ? '<button type="button" class="vc-link" data-vc="etapas">Configurar etapas</button>' : ''}</div>
      <div class="vc-fases" role="tablist" aria-label="Fases do funil">${r.fases.map((f) => `<button type="button" role="tab" aria-selected="${f.id === sel}" data-vc-fase="${esc(f.id)}"><span>${esc(f.nome)}</span><b>${num(f.atual)}</b>${f.conversao != null ? `<small>${pc(f.conversao)} seguem</small>` : `<small>${num(f.alcancaram)} chegaram</small>`}</button>`).join('')}</div>
      <div class="vc-lista">${ops.length ? ops.map(card).join('') : vazio(sel === 'novo' ? 'Nenhuma empresa nova no funil. O SDR propõe pelo CRM do 1º andar.' : 'Nenhuma oportunidade nesta fase agora.')}</div>
      <div class="vc-secao"><h3>Motivos de perda</h3><small>${num(r.fases.find((f) => f.id === 'perdido')?.atual)} perdidas</small></div>
      ${r.motivos_perda.some((m) => m.quantidade) ? `<ul class="vc-barras">${r.motivos_perda.filter((m) => m.quantidade).map((m) => `<li><span>${esc(m.nome)}</span><span class="vc-barra"><i class="u2" style="width:${(m.quantidade / maxMotivo) * 100}%"></i></span><small>${num(m.quantidade)} · ${pc(m.percentual)}</small></li>`).join('')}</ul>` : vazio('Nenhuma perda registrada. Quando marcar Perdido, o motivo aparece aqui.')}`;
  }
  // ---------- Funil: o mês (metas, KPIs × mês anterior, gráficos, corrida comercial, formulário de leads) ----------
  const curto = (v) => { const n = Number(v) || 0, f = (x) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return n >= 1e6 ? f(n / 1e6) + ' mi' : n >= 1e3 ? f(n / 1e3) + ' mil' : f(Math.round(n)); };
  const diaBahia = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) : ''; };
  const tituloPeriodo =(p) => (p?.tipo === 'anual' ? 'em ' + p.rotulo : nomeMes(p?.mes));
  // Barras verticais em SVG inline (como o Caixa), com o número em cima de cada barra; cada barra abre o espiar do mês.
  function grafico({ meses, series, aria, espiar }) {
    // A partir de 760px os dois gráficos ficam lado a lado: cada um desenhado na metade da janela (texto no tamanho certo).
    const larg = document.getElementById('vv-comercial')?.clientWidth || 400;
    const W = Math.max(300, Math.min(560, larg >= 760 ? larg / 2 - 50 : larg - 60)), H = 178, base = 148, alto = 112;
    const max = Math.max(1, ...meses.flatMap((m) => series.map((s) => Number(m[s.chave]) || 0)));
    const passo = W / Math.max(1, meses.length), n = series.length, bw = Math.min(40, Math.max(14, (passo - 10) / n - 4));
    const barras = meses.map((m, i) => {
      const x0 = i * passo + passo / 2 - (n * bw + (n - 1) * 4) / 2;
      return series.map((s, j) => {
        const v = Number(m[s.chave]) || 0, h = v > 0 ? Math.max(2, (v / max) * alto) : 0, x = x0 + j * (bw + 4);
        const esp = espiar ? ` data-espiar="${String(espiar(m.mes, s.chave)).startsWith('financas:') ? '' : 'comercial:'}${esc(espiar(m.mes, s.chave))}" tabindex="0" role="button" aria-label="${esc(s.rotulo + ' em ' + nomeMes(m.mes) + ': ' + s.fmt(v))}"` : '';
        return `<g class="vc-g-barra"${esp}><title>${esc(s.rotulo)} · ${esc(nomeMes(m.mes))}: ${esc(s.fmt(v))}</title><rect x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="4" class="${s.cls}"/>
          <text x="${x + bw / 2}" y="${base - h - 5}" text-anchor="middle" class="valor">${esc(s.curto ? s.curto(v) : s.fmt(v))}</text></g>`;
      }).join('') + `<text x="${i * passo + passo / 2}" y="${base + 18}" text-anchor="middle">${esc(MESES[Number(m.mes.slice(5)) - 1].slice(0, 3))}</text>`;
    }).join('');
    return `<figure class="vc-grafico"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(aria)}">${barras}<line x1="0" x2="${W}" y1="${base}" y2="${base}" class="eixo"/></svg>
      <figcaption>${series.map((s) => `<span><i class="${s.cls}"></i>${esc(s.rotulo)}</span>`).join('')}</figcaption></figure>`;
  }
  function blocoMes(d) {
    const m = d.mes; if (!m || !m.periodo) return '';
    const p = d.pode || {}, val = Boolean(m.valores), k = m.kpis, rv = m.periodo.tipo === 'anual' ? 'vs ano anterior' : 'vs mês anterior';
    const fmt = (x, v) => (x.tipo === 'dinheiro' ? din(v) : num(v));
    const comMeta = m.progresso.filter((x) => x.meta > 0);
    const metas = comMeta.length ? `<ul class="vc-metas">${m.progresso.map((x) => `<li${x.meta > 0 ? ` class="espiavel" data-espiar="comercial:funil:${x.id === 'leads' ? 'leads' : 'fechados'}" role="button" tabindex="0"` : ''}>
        <div><b>${esc(x.nome)}</b><small>${fmt(x, x.realizado)}${x.meta > 0 ? ' de ' + fmt(x, x.meta) + (x.batida ? ' · meta batida' : ' · faltam ' + fmt(x, x.falta)) : ' · sem meta'}</small></div>
        <span class="vc-barra"><i class="${x.batida ? 'u6' : ''}" style="width:${x.barra}%"></i></span><strong>${x.percentual == null ? '—' : pc(x.percentual)}</strong></li>`).join('')}</ul>`
      : `<p class="vc-dica">${p.editar_pacotes ? 'Nenhuma meta para este período. Em "Editar metas" você define MRR, avulso, negócios fechados e leads do mês.' : 'Os donos ainda não definiram as metas deste período.'}</p>`;
    const kp = `<div class="vc-kpis">${kpi('Leads novos', num(k.atual.leads), { variacao: k.variacao.leads, rotuloVar: rv, espiar: 'funil:leads' })}
      ${kpi('Propostas enviadas', num(k.atual.propostas), { variacao: k.variacao.propostas, rotuloVar: rv, espiar: 'funil:propostas' })}
      ${kpi('Negócios fechados', num(k.atual.negocios), { variacao: k.variacao.negocios, rotuloVar: rv, espiar: 'funil:fechados' })}
      ${val ? kpi('Fechado (MRR)', din(k.atual.mrr) + '<small>/mês</small>', { variacao: k.variacao.mrr, rotuloVar: rv, espiar: 'funil:fechados' }) + kpi('Fechado (avulso)', din(k.atual.avulso), { variacao: k.variacao.avulso, rotuloVar: rv, espiar: 'funil:fechados' }) : ''}</div>`;
    const graficos = m.series.length ? grafico({ meses: m.series, aria: 'Leads novos por mês, últimos 6 meses', espiar: (mes) => 'funil:leads:' + mes,
        series: [{ chave: 'leads', cls: 'lead', rotulo: 'Leads novos', fmt: num }] })
      + (val ? grafico({ meses: m.series, aria: 'Valor fechado por mês (MRR e avulso), últimos 6 meses', espiar: (mes) => 'funil:fechados:' + mes,
        series: [{ chave: 'mrr', cls: 'mrr', rotulo: 'MRR fechado (R$/mês)', fmt: din, curto }, { chave: 'avulso', cls: 'avu', rotulo: 'Avulso fechado (R$)', fmt: din, curto }] })
        : grafico({ meses: m.series, aria: 'Negócios fechados por mês, últimos 6 meses', espiar: (mes) => 'funil:fechados:' + mes, series: [{ chave: 'negocios', cls: 'mrr', rotulo: 'Negócios fechados', fmt: num }] })) : '';
    return `${seletorPeriodo()}${m.config_disponivel === false ? `<p class="vc-aviso">${esc(m.aviso_config || 'Metas e formulário de leads aguardando a migração.')}</p>` : ''}
      <div class="vc-secao"><h3>Metas ${esc(m.periodo.tipo === 'anual' ? 'de ' + m.periodo.rotulo + ' (soma dos meses)' : 'de ' + nomeMes(m.periodo.mes))}</h3>${p.editar_pacotes && m.config_disponivel !== false ? '<button type="button" class="vc-link" data-vc="metas">Editar metas</button>' : ''}</div>
      ${metas}${val ? '' : '<p class="vc-dica">Os valores em reais (MRR e avulso) aparecem só para os donos.</p>'}${kp}
      <div class="vc-secao"><h3>Últimos 6 meses</h3></div><div class="vc-graficos">${graficos}</div>
      ${corridaHtml(m, val)}${formularioHtml(d)}`;
  }
  function corridaHtml(m, val) {
    const r = m.ranking, sem = r.sem_atribuicao || {};
    const linhas = r.linhas.map((x) => `<li class="espiavel" data-espiar="comercial:funil:corrida:${esc(x.posicao)}" role="button" tabindex="0"><span class="pos${x.posicao === 1 ? ' ouro' : ''}">${esc(x.posicao)}º</span>
      <div><b>${esc(x.nome)}</b><small>${num(x.quantidade)} negócio${x.quantidade > 1 ? 's' : ''}${x.pelo_cadastro ? ` · ${num(x.pelo_cadastro)} sem responsável (conta quem cadastrou)` : ''}</small></div>
      ${val ? `<span class="v">${din(x.mrr)}<small>/mês</small>${x.avulso ? `<small> + ${din(x.avulso)} avulso</small>` : ''}</span>` : ''}</li>`).join('');
    return `<div class="vc-secao"><h3>Corrida comercial · ${esc(tituloPeriodo(m.periodo))}</h3><small>${num(r.linhas.reduce((s, x) => s + x.quantidade, 0) + (sem.quantidade || 0))} fechados</small></div>
      ${linhas ? `<ol class="vc-corrida">${linhas}</ol>` : vazio('Ninguém fechou negócio neste período ainda.')}
      <p class="vc-dica">Conta para o responsável da oportunidade ganha; sem responsável, para quem cadastrou.${sem.quantidade ? ` <b>${num(sem.quantidade)} negócio${sem.quantidade > 1 ? 's' : ''} sem como atribuir</b> (lead do formulário sem responsável): defina o responsável no CRM do 1º andar para entrar na corrida.` : ''}</p>`;
  }
  function formularioHtml(d) {
    const m = d.mes, p = d.pode || {}, f = m.formulario || {};
    if (!p.editar_comercial) return '';
    const link = f.ativo && f.token ? `${typeof location !== 'undefined' ? location.origin : ''}/lead/${f.token}` : '';
    const doPeriodo = C().leadsDoPeriodo(d.oportunidades.filter((o) => o.origem === 'formulario'), m.periodo).length;
    let topo;
    if (m.config_disponivel === false) topo = '<p class="vc-dica">O formulário depende da mesma migração das metas.</p>';
    else if (p.editar_pacotes) topo = link
      ? `<div class="vc-form-link"><input type="text" readonly value="${esc(link)}" aria-label="Link público do formulário" data-vc-link-form><button type="button" class="vc-sec" data-vc="form-copiar">Copiar link</button></div>
        <div class="vc-linha-acoes"><a class="vc-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Abrir o formulário</a><button type="button" class="vc-link" data-vc="form-gerar">Trocar link</button><button type="button" class="vc-perigo" data-vc="form-desligar">Desligar</button></div>
        <p class="vc-dica">Ponha na bio do Instagram e no site. Quem preenche entra no funil em Novo, com a etiqueta Formulário. Trocar o link invalida o antigo.</p>`
      : `<p class="vc-dica">${f.gerado_em ? 'O formulário está desligado.' : 'Gere um link público para a bio e o site: quem preenche vira oportunidade em Novo.'}</p><div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="form-gerar">${f.gerado_em ? 'Ligar com link novo' : 'Gerar link'}</button></div>`;
    else topo = `<p class="vc-dica">Formulário ${f.ativo ? 'ligado' : 'desligado'}. Só os donos geram e trocam o link.</p>`;
    const leads = (m.leads_formulario || []).map((l) => { const c = l.contato || {}; return `<article class="vc-cartao"><div class="vc-cartao-topo"><b>${esc(c.nome || l.nome)}</b>${pill(d.etapas.find((e) => e.id === l.etapa)?.nome || l.etapa, l.etapa === 'ganho' ? 'u6' : l.etapa === 'perdido' ? 'u5' : 'u4')}</div>
      <small>${[c.empresa, c.cidade, c.interesse].filter(Boolean).map(esc).join(' · ') || 'Sem empresa informada'}</small>
      <small>WhatsApp ${esc(C().formatarWhatsapp(c.whatsapp))} · chegou em ${data(diaBahia(l.criado_em))}</small>${c.mensagem ? `<small>“${esc(c.mensagem)}”</small>` : ''}</article>`; }).join('');
    return `<div class="vc-secao"><h3>Formulário de leads</h3><small class="espiavel" data-espiar="comercial:funil:formulario" role="button" tabindex="0">${num(doPeriodo)} ${esc(tituloPeriodo(m.periodo))}</small></div>
      <div class="vc-cap">${topo}</div>
      ${m.leads_formulario ? `<div class="vc-secao"><h3>Últimos que chegaram</h3></div><div class="vc-lista">${leads || vazio('Nenhum lead pelo formulário ainda.')}</div>` : ''}`;
  }
  // Mini painel dos números do mês: as oportunidades por trás de cada um.
  function espiarFunil(d, filtro, extra) {
    const m = d.mes; if (!m?.periodo) return null;
    const per = /^\d{4}-\d{2}$/.test(extra || '') ? C().periodo(extra) : m.periodo, quando = per === m.periodo ? tituloPeriodo(m.periodo) : nomeMes(extra);
    const etapaNome = (id) => d.etapas.find((e) => e.id === id)?.nome || id, faseDe = (etapa) => d.fases.find((f) => f.etapas.includes(etapa))?.id;
    const valor = (o) => (m.valores ? [o.valor_mensal ? din(o.valor_mensal) + '/mês' : '', o.valor_avulso ? din(o.valor_avulso) + ' avulso' : ''].filter(Boolean).join(' + ') : '');
    const item = (o) => ({ nome: o.nome, sub: [etapaNome(o.etapa), o.responsavel_nome || 'sem responsável', o.origem === 'formulario' ? 'formulário' : ''].filter(Boolean).join(' · '), dir: valor(o), etapa: o.etapa });
    const ir = (it) => { st.fase = faseDe(it.etapa) || st.fase; pintar(); };
    const ops = d.oportunidades, base = { cls: '', rodape: 'Clique para ver a fase no funil', clicar: ir };
    if (filtro === 'leads') return { ...base, titulo: 'Leads novos · ' + quando, itens: C().leadsDoPeriodo(ops, per).map(item), vazio: 'Nenhum lead novo neste período.' };
    if (filtro === 'formulario') return { ...base, titulo: 'Leads do formulário · ' + quando, itens: C().leadsDoPeriodo(ops.filter((o) => o.origem === 'formulario'), per).map(item), vazio: 'Nenhum lead pelo formulário neste período.' };
    if (filtro === 'fechados') return { ...base, titulo: 'Negócios fechados · ' + quando, cls: 'u6', itens: C().fechadosDoPeriodo(ops, per).map(item), vazio: 'Nenhum negócio fechado neste período.' };
    if (filtro === 'propostas') {
      const ids = new Set(C().propostasDoPeriodo(m.propostas, per));
      return { ...base, titulo: 'Propostas enviadas · ' + quando, itens: ops.filter((o) => ids.has(String(o.id))).map(item), vazio: 'Nenhuma proposta enviada neste período.' };
    }
    if (filtro === 'corrida') {
      const linha = m.ranking.linhas.find((x) => String(x.posicao) === String(extra)); if (!linha) return null;
      const itens = C().fechadosDoPeriodo(ops, per).filter((o) => norm(C().quemFechou(o)?.nome) === norm(linha.nome)).map(item);
      return { ...base, titulo: linha.nome + ' · ' + quando, cls: 'u6', itens, vazio: 'Nenhum negócio.' };
    }
    return null;
  }
  function formMetas() {
    const m = st.dados.funil.mes, mes = st.periodo.mes || hojeIso().slice(0, 7), x = (m.metas_por_mes || {})[mes] || {};
    abrirFolha({ titulo: 'Metas de ' + nomeMes(mes), botao: 'Salvar metas',
      antes: '<p class="vc-dica">Só os donos editam. Deixe em branco (ou 0) a meta que não quiser acompanhar. A visão anual soma os meses.</p>',
      campos: [
        { nome: 'mrr', rotulo: 'MRR novo (R$/mês)', tipo: 'number', passo: '0.01', valor: x.mrr || '', meio: true, dica: 'Recorrente dos negócios fechados no mês.' },
        { nome: 'avulso', rotulo: 'Avulso (R$)', tipo: 'number', passo: '0.01', valor: x.avulso || '', meio: true },
        { nome: 'negocios', rotulo: 'Negócios fechados', tipo: 'number', passo: '1', valor: x.negocios || '', meio: true },
        { nome: 'leads', rotulo: 'Leads novos', tipo: 'number', passo: '1', valor: x.leads || '', meio: true },
        { nome: 'aplicar', rotulo: 'Valer para', tipo: 'select', opcoes: [['mes', 'Só ' + nomeMes(mes)], ['resto_do_ano', 'De ' + nomeMes(mes) + ' até dezembro']], valor: 'mes' },
      ],
      enviar: (v) => comercial({ acao: 'metas_salvar', mes, aplicar: v.aplicar, metas: { mrr: v.mrr, avulso: v.avulso, negocios: v.negocios, leads: v.leads } }) });
  }
  async function copiarLinkFormulario() {
    const inp = raiz()?.querySelector('[data-vc-link-form]'), texto = inp?.value || '';
    if (!texto) return;
    try { await navigator.clipboard.writeText(texto); st.msg = 'Link copiado.'; }
    catch { try { inp.select(); document.execCommand?.('copy'); st.msg = 'Link copiado.'; } catch { st.msg = '⚠️ Não deu para copiar: selecione o link e copie.'; } }
    pintar();
  }
  function abaPacotes(d) {
    const p = d.pode || {};
    const lista = d.pacotes.map((x) => `<article class="vc-cartao${x.ativo ? '' : ' apagado'}"><div class="vc-cartao-topo"><b>${esc(x.nome)}</b>${pill(x.tipo === 'recorrente' ? 'Recorrente' : 'Avulso', 'u4')}${x.ativo ? '' : pill('Inativo', 'u5')}</div>
      <p class="vc-grande">${din(x.preco)}${x.tipo === 'recorrente' ? '<small>/mês</small>' : ''}</p>
      ${x.entregas?.length ? `<ul class="vc-entregas">${x.entregas.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      ${Object.keys(x.carga || {}).length ? `<small>Carga: ${Object.entries(x.carga).map(([k, n]) => `${esc(C().CARGOS.find((c) => c.id === k)?.nome || k)} ${num(n)}/mês`).join(' · ')}</small>` : ''}
      ${x.custo != null ? `<div class="vc-margem"><span>Custo ${din(x.custo)}</span><span>Margem ${din(x.margem)} (${pc(x.margem_percentual)})</span>${x.zona_critica ? pill('Zona crítica', 'u1') : ''}</div>` : ''}
      ${p.editar_pacotes ? `<div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="pacote" data-id="${esc(x.id)}">Editar</button></div>` : ''}</article>`).join('');
    const pr = d.produtos || {};
    return `<div class="vc-kpis">${kpi('Produto campeão', pr.campeao ? esc(pr.campeao.nome) : '—')}${kpi('Ticket médio mensal', din(pr.ticket_medio_mensal))}${kpi('Ticket médio avulso', din(pr.ticket_medio_avulso))}${kpi('Negócios ganhos', num(pr.ganhos))}</div>
      <div class="vc-secao"><h3>Pacotes</h3>${p.editar_pacotes ? botaoNovo('Novo pacote', 'pacote') : ''}</div>
      <div class="vc-lista grade">${lista || vazio('Nenhum pacote cadastrado. Cadastre a esteira de produtos da Vybe para montar orçamentos.', p.editar_pacotes ? 'Cadastrar pacote' : '', 'pacote')}</div>
      ${p.editar_pacotes ? `<div class="vc-secao"><h3>Capacidade do time</h3><button type="button" class="vc-link" data-vc="capacidade">Configurar</button></div>${capacidadeHtml(d.capacidade, {}) || '<p class="vc-dica">Sem capacidade configurada.</p>'}` : ''}`;
  }
  // Calculadora de ROI: quantas vendas a mais o cliente precisa para pagar a Vybe, e o retorno esperado.
  st.roi = st.roi || { orc: '', investimento: '', ticket: '', margem: '', vendas: '' };
  function roiDaProposta(o) {
    const r = st.roi; if (String(r.orc) !== String(o.id)) return '';
    const c = C().roiCampanha({ investimento: r.investimento, ticket: r.ticket, margem: r.margem, vendas: r.vendas }); if (!c) return '';
    return `<h3>Retorno estimado</h3><div class="tot" style="margin-left:0;width:min(100%,420px)"><div><span>Lucro por venda (ticket ${din(Number(String(r.ticket).replace(/\./g, '').replace(',', '.')))} × margem ${esc(r.margem)}%)</span><span>${din(c.lucroPorVenda)}</span></div>`
      + `<div><span>Vendas a mais por mês para pagar o investimento</span><span>${c.empate == null ? '—' : num(c.empate)}</span></div>`
      + (c.roi == null ? '' : `<div><span>Com ${esc(r.vendas)} vendas a mais por mês: lucro a mais</span><span>${din(c.lucro)}</span></div><div class="g"><span>ROI estimado</span><span>${c.roi > 0 ? '+' : ''}${pc(c.roi)}</span></div>`)
      + '</div><p class="m">Estimativa com os números informados pelo cliente; não é garantia de resultado.</p>';
  }
  function roiHtml(d) {
    const r = st.roi, orcs = d.orcamentos.filter((o) => o.totais?.total_recorrente);
    const calc = C().roiCampanha({ investimento: r.investimento, ticket: r.ticket, margem: r.margem, vendas: r.vendas });
    const campo = (k, rot, ph, extra = '') => `<label><span>${rot}</span><input name="roi_${k}" data-vc-roi="${k}" inputmode="decimal" value="${esc(r[k] || '')}" placeholder="${ph}"${extra}></label>`;
    const res = !calc ? '<p class="vc-dica">Preencha o investimento, o ticket e a margem do cliente para ver em quantas vendas a Vybe se paga.</p>'
      : `<div class="vc-roi-res"><div><small>Lucro dele por venda</small><b>${din(calc.lucroPorVenda)}</b></div>`
        + `<div><small>Vendas a mais para pagar a Vybe</small><b>${calc.empate == null ? '—' : num(calc.empate) + ' por mês'}</b></div>`
        + (calc.roi == null ? '' : `<div><small>Faturamento a mais</small><b>${din(calc.faturamento)}</b></div><div><small>Lucro a mais</small><b>${din(calc.lucro)}</b></div><div class="${calc.roi >= 0 ? 'bom' : 'ruim'}"><small>ROI</small><b>${calc.roi > 0 ? '+' : ''}${pc(calc.roi)}</b></div>`)
        + '</div>';
    return `<section class="vc-roi"><div class="vc-secao"><h3>Calculadora de ROI</h3>${orcs.length ? `<select class="vc-mini" data-vc-roi-orc aria-label="Usar o valor de um orçamento"><option value="">Usar o valor de um orçamento…</option>${orcs.map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(r.orc) ? ' selected' : ''}>${esc(o.cliente_nome)} · ${din(o.totais.total_recorrente)}/mês</option>`).join('')}</select>` : ''}</div>
      <div class="vc-roi-campos">${campo('investimento', 'Investimento mensal (R$)', '2.500')}${campo('ticket', 'Ticket de uma venda do cliente (R$)', '180')}${campo('margem', 'Margem do cliente por venda (%)', '35')}${campo('vendas', 'Vendas a mais por mês (estimativa)', '60')}</div>
      ${res}${calc && r.orc ? '<p class="vc-dica">Este cálculo sai na proposta impressa do orçamento escolhido.</p>' : ''}</section>`;
  }
  function abaOrcamentos(d) {
    const p = d.pode || {};
    return `${roiHtml(d)}<div class="vc-secao"><h3>Orçamentos</h3>${p.editar_comercial && d.pacotes.length ? botaoNovo('Novo orçamento', 'orcamento') : ''}</div>
      ${!d.pacotes.length ? '<p class="vc-dica">Sem pacotes ativos: os donos cadastram na aba Pacotes.</p>' : ''}
      <div class="vc-lista">${d.orcamentos.map((o) => `<article class="vc-cartao"><div class="vc-cartao-topo"><b>${esc(o.cliente_nome)}</b>${pill(...(STATUS_ORC[o.status] || [o.status]))}</div>
        <p class="vc-grande">${o.totais.total_recorrente ? din(o.totais.total_recorrente) + '<small>/mês</small>' : ''}${o.totais.total_recorrente && o.totais.total_avulso ? ' + ' : ''}${o.totais.total_avulso ? din(o.totais.total_avulso) + '<small> avulso</small>' : ''}</p>
        <small>${o.itens.map((i) => `${num(i.quantidade)}× ${esc(i.nome)}`).join(' · ')}${o.desconto_percentual ? ' · desconto ' + pc(o.desconto_percentual) : ''} · válido até ${data(o.validade)}${o.validade < hojeIso() ? ' (vencido)' : ''}</small>
        <div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="imprimir" data-id="${esc(o.id)}">Imprimir</button>
        ${p.editar_comercial ? `<select class="vc-mini" data-vc-status-orc="${esc(o.id)}" aria-label="Status do orçamento">${Object.entries(STATUS_ORC).map(([k, [n]]) => `<option value="${k}"${k === o.status ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}</div></article>`).join('')
        || vazio('Nenhum orçamento ainda. Monte o primeiro a partir dos pacotes.', p.editar_comercial && d.pacotes.length ? 'Novo orçamento' : '', 'orcamento')}</div>`;
  }
  function abaFinancas(d) {
    const r = d.resumo, f = fin();
    // Com o Finanças: o dinheiro de verdade em cima; os cartões dos clientes ficam (pacote, custo estimado e status à mão).
    const contadores = `${kpi('Zona crítica', num(r.criticas), { u: r.criticas ? 'u1' : '', espiar: 'financas:critica' })}${kpi('Atrasados', num(r.pagamento.atrasado), { u: r.pagamento.atrasado ? 'u2' : '', espiar: 'financas:atrasado' })}${kpi('Inadimplentes', num(r.pagamento.inadimplente), { espiar: 'financas:inadimplente', u: r.pagamento.inadimplente ? 'u1' : '' })}`;
    const topo = f ? `${finTopo(f)}${finGraficos(f)}${finMargens(f)}<div class="vc-secao"><h3>Pacote e margem estimada por cliente (Vybe OS)</h3></div><div class="vc-kpis">${contadores}</div>`
      : `${avisoFin(true)}<div class="vc-kpis">${kpi('Receita mensal', din(r.receita))}${kpi('Custo estimado', din(r.custo))}${kpi('Margem', pc(r.margem_percentual), { u: r.margem_percentual != null && r.margem_percentual < d.zona_critica ? 'u1' : '' })}
        ${contadores}</div>`;
    const real = (c) => { const m = margemFinDe(f, c.cliente_id); return m ? `<small>Margem real (Vybe Finanças): ${din(m.mes.margem)} no mês · ${din(m.periodo.margem)} em 3 meses</small>` : ''; };
    return `${topo}
      <input type="search" class="vc-busca" data-vc-busca="financas" placeholder="Buscar cliente" value="${esc(st.filtro.financas || '')}" aria-label="Buscar cliente">
      <div class="vc-lista">${d.clientes.filter((c) => !st.filtro.financas || norm(c.cliente_nome).includes(norm(st.filtro.financas))).map((c) => `<article class="vc-cartao${c.zona_critica ? ' critico' : ''}">
        <div class="vc-cartao-topo"><b>${esc(c.cliente_nome)}</b>${pill(...STATUS_PAG[c.status_pagamento])}</div>
        ${c.valor_mensal ? `<p class="vc-grande">${din(c.valor_mensal)}<small>/mês</small></p>` : '<small>Sem contrato informado.</small>'}
        <div class="vc-margem"><span>${c.pacote_nome ? esc(c.pacote_nome) + ' · custo ' + din(c.custo) : 'Sem pacote (custo não estimado)'}</span>${c.margem_percentual != null ? `<span>Margem ${pc(c.margem_percentual)}</span>` : ''}${c.zona_critica ? pill('Zona crítica', 'u1') : ''}</div>
        ${c.observacao ? `<small>${esc(c.observacao)}</small>` : ''}${real(c)}
        <div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="financas" data-id="${esc(c.cliente_id)}">Editar</button></div></article>`).join('') || vazio('Nenhum cliente ativo no cadastro.')}</div>`;
  }
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function abaRecebimentos(d) {
    const r = d.resumo, v = r.variacao, rv = rotuloAnterior();
    return `${seletorPeriodo()}<div class="vc-kpis">${kpi('A receber', din(r.atual.a_receber), { variacao: v.a_receber, rotuloVar: rv })}${kpi('Recebido', din(r.atual.recebido), { variacao: v.recebido, rotuloVar: rv })}
        ${kpi('Pendente', din(r.atual.pendente), { variacao: v.pendente, rotuloVar: rv, inverso: true })}${kpi('Inadimplente', din(r.atual.inadimplente), { variacao: v.inadimplente, rotuloVar: rv, inverso: true, u: r.atual.inadimplente ? 'u1' : '' })}</div>
      <div class="vc-secao"><h3>${esc(d.periodo.tipo === 'anual' ? d.periodo.rotulo : nomeMes(d.periodo.mes))}</h3>${botaoNovo('Novo recebimento', 'recebivel')}</div>
      <div class="vc-lista">${d.recebiveis.map((x) => { const [n, u] = STATUS_REC[x.status] || [x.status]; return `<article class="vc-cartao">
        <div class="vc-cartao-topo"><b>${esc(x.tipo === 'recorrente' ? x.cliente_nome || 'Cliente' : x.descricao)}</b>${pill(n, u)}</div>
        <p class="vc-grande">${din(x.valor)}${x.valor_recebido && x.status !== 'recebido' ? `<small> · recebido ${din(x.valor_recebido)}</small>` : ''}</p>
        <small>${x.tipo === 'recorrente' ? 'Recorrente ' + esc(x.ciclo) : 'Pontual'}${x.categoria ? ' · ' + esc(x.categoria) : ''}${x.tipo === 'recorrente' && x.descricao ? ' · ' + esc(x.descricao) : ''} · vence ${data(x.vencimento)}${x.atraso ? ` · ${num(x.atraso)} dias de atraso` : ''}${x.recebido_em ? ' · recebido em ' + data(x.recebido_em) : ''}</small>
        ${x.cancelado ? '' : `<div class="vc-linha-acoes">${x.status !== 'recebido' ? `<button type="button" class="vc-sec" data-vc="receber" data-id="${esc(x.id)}">Receber</button>` : ''}
          ${x.tipo === 'recorrente' ? `<button type="button" class="vc-sec" data-vc="proximo" data-id="${esc(x.id)}">Próximo ciclo</button>` : ''}
          <button type="button" class="vc-sec" data-vc="recebivel" data-id="${esc(x.id)}">Editar</button><button type="button" class="vc-perigo" data-vc="cancelar-rec" data-id="${esc(x.id)}">Cancelar</button></div>`}</article>`; }).join('')
        || vazio('Nenhum recebimento neste período. Lance os contratos recorrentes e os pontuais.', 'Novo recebimento', 'recebivel')}</div>`;
  }
  function abaContas(d) {
    const r = d.resumo, rv = rotuloAnterior(), f = fin();
    const doVybe = `<div class="vc-kpis">${kpi('Total de contas', din(r.total), { variacao: r.variacao_total, rotuloVar: rv, inverso: true })}${kpi('A pagar em 7 dias', din(r.sete_dias.total) + `<small> · ${num(r.sete_dias.quantidade)}</small>`, { u: r.sete_dias.quantidade ? 'u2' : '' })}
        ${kpi('Vencidas sem pagar', din(r.vencidas.total), { u: r.vencidas.quantidade ? 'u1' : '' })}${kpi('Resultado (faturamento − contas)', din(r.resultado), { variacao: C().variacao(r.resultado, r.resultado_anterior), rotuloVar: rv, u: r.resultado < 0 ? 'u1' : '' })}</div>
      <div class="vc-fixo"><div><span>Fixo ${din(r.fixo)} · ${pc(r.fixo_percentual)}</span><span>Variável ${din(r.variavel)} · ${pc(r.variavel_percentual)}</span></div><span class="vc-barra dupla"><i style="width:${r.fixo_percentual || 0}%"></i></span></div>
      <ul class="vc-grupos">${r.grupos.map((g) => `<li><b>${esc(g.nome)}</b><span>${din(g.total)}</span><small>${pc(g.percentual_faturamento)} do faturamento${g.variacao != null ? ` · ${g.variacao > 0 ? '▲' : g.variacao < 0 ? '▼' : '='} ${pc(Math.abs(g.variacao))} ${rv}` : ''}</small></li>`).join('')}</ul>
      <p class="vc-dica">Faturamento do período (a receber): ${din(d.faturamento)}.</p>`;
    let doFin = '';
    if (f) {
      const dsp = f.despesas, max = Math.max(1, ...dsp.categorias.map((c) => c.total)), cf = f.custos_fixos;
      doFin = `<div class="vc-secao"><h3>Despesas de ${esc(nomeMes(f.mes))}</h3>${fonteFin()}</div>
        <div class="vc-kpis">${kpi('Despesas do mês', din(dsp.total), { espiar: 'financas:comercial:despesas' })}${kpi('Pagas', din(f.resumo.despesas_pagas))}
          ${kpi('Pendentes', din(f.resumo.despesas_pendentes), { u: f.resumo.despesas_pendentes ? 'u2' : '' })}${kpi('Folha do mês', din(f.folha.total))}
          ${kpi('Custos fixos (assinaturas)', din(cf.total) + '<small>/mês</small>', { espiar: 'financas:comercial:fixos' })}</div>
        ${dsp.categorias.length ? `<ul class="vc-barras espiavel" data-espiar="financas:comercial:despesas" role="button" tabindex="0">${dsp.categorias.map((c) => `<li><span>${esc(c.categoria)}</span><span class="vc-barra"><i class="u2" style="width:${(c.total / max) * 100}%"></i></span><small>${din(c.total)} · ${pc(c.percentual)}</small></li>`).join('')}</ul>`
          : vazio('Nenhuma despesa lançada no Finanças neste mês.')}
        ${cf.itens.length ? `<div class="vc-secao"><h3>Custos fixos</h3><small>${num(cf.quantidade)} assinatura${cf.quantidade === 1 ? '' : 's'} ativa${cf.quantidade === 1 ? '' : 's'}</small></div>
          <ul class="vc-grupos">${cf.itens.slice(0, 8).map((s) => `<li><b>${esc(s.nome)}</b><span>${din(s.custo)}</span><small>${s.dia_renovacao ? 'renova dia ' + num(s.dia_renovacao) : 'sem dia de renovação'}</small></li>`).join('')}</ul>` : ''}
        <p class="vc-dica">Os números acima vêm do Vybe Finanças. Abaixo, as contas lançadas à mão no Vybe OS (continuam editáveis).</p>`;
    }
    return `${seletorPeriodo()}${f ? doFin : avisoFin(false) + doVybe}
      <div class="vc-secao"><h3>${f ? 'Contas lançadas no Vybe OS' : 'Contas'}</h3>${botaoNovo('Nova conta', 'conta')}</div>
      <div class="vc-lista">${d.contas.map((c) => { const venc = !c.pago_em && !c.cancelada && c.vencimento < d.hoje; return `<article class="vc-cartao">
        <div class="vc-cartao-topo"><b>${esc(c.descricao)}</b>${c.cancelada ? pill('Cancelada', 'u5') : c.pago_em ? pill('Paga', 'u6') : venc ? pill('Vencida', 'u1') : pill('A pagar', 'u4')}</div>
        <p class="vc-grande">${din(c.valor)}</p><small>${esc(r.grupos.find((g) => g.id === c.grupo)?.nome || c.grupo)}${c.fornecedor_nome ? ' · ' + esc(c.fornecedor_nome) : ''} · vence ${data(c.vencimento)}${c.pago_em ? ' · paga em ' + data(c.pago_em) : ''}</small>
        ${c.cancelada || c.pago_em ? '' : `<div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="pagar" data-id="${esc(c.id)}">Marcar paga</button><button type="button" class="vc-sec" data-vc="conta" data-id="${esc(c.id)}">Editar</button><button type="button" class="vc-perigo" data-vc="cancelar-conta" data-id="${esc(c.id)}">Cancelar</button></div>`}</article>`; }).join('')
        || vazio('Nenhuma conta neste período. Lance fixas, variáveis, folha, impostos e investimentos.', 'Nova conta', 'conta')}</div>`;
  }
  function abaInadimplencia(d) {
    const f = fin();
    const doVybe = `<div class="vc-kpis">${kpi('Em atraso', din(d.total), { u: d.total ? 'u1' : '' })}${kpi('Clientes', num(d.clientes.length))}${kpi('Críticos (+30 dias)', num(d.criticos), { u: d.criticos ? 'u1' : '', espiar: 'inadimplencia:criticos' })}${kpi('Faturas', num(d.faturas.length))}</div>
      <div class="vc-secao"><h3>Clientes em atraso</h3></div>
      <div class="vc-lista">${d.clientes.map((c) => `<article class="vc-cartao barra-${c.severidade.nivel}"><div class="vc-cartao-topo"><b>${esc(c.cliente_nome)}</b>${pill(c.severidade.nome, c.severidade.nivel)}</div>
        <p class="vc-grande">${din(c.valor)}</p><small>${num(c.faturas)} fatura${c.faturas > 1 ? 's' : ''} · atraso mais antigo ${num(c.atraso_mais_antigo)} dias (venceu ${data(c.vencimento_mais_antigo)})</small></article>`).join('')
        || vazio('Ninguém em atraso. As faturas vencidas e não recebidas aparecem aqui.', 'Ver recebimentos', 'ir-recebimentos')}</div>`;
    let doFin = '';
    if (f) {
      const i = f.inadimplencia;
      doFin = `<div class="vc-secao"><h3>Receitas vencidas e não pagas</h3>${fonteFin()}</div>
        <div class="vc-kpis">${kpi('Em atraso', din(i.total), { u: i.total ? 'u1' : '', espiar: 'financas:comercial:inad' })}${kpi('Clientes', num(i.clientes.length), { espiar: 'financas:comercial:inad' })}
          ${kpi('Críticos (+30 dias)', num(i.criticos), { u: i.criticos ? 'u1' : '', espiar: 'financas:comercial:inad' })}${kpi('Lançamentos', num(i.faturas))}</div>
        <div class="vc-lista">${i.clientes.map((c) => { const s = C().severidade(c.atraso_mais_antigo); return `<article class="vc-cartao barra-${s.nivel}"><div class="vc-cartao-topo"><b>${esc(c.cliente_nome)}</b>${pill(s.nome, s.nivel)}${c.no_vybe || !c.cliente_id && c.cliente_nome === 'Sem cliente' ? '' : pill('Sem par no Vybe OS', 'u5')}</div>
          <p class="vc-grande">${din(c.valor)}</p><small>${num(c.faturas)} lançamento${c.faturas > 1 ? 's' : ''} · atraso mais antigo ${num(c.atraso_mais_antigo)} dias (venceu ${data(c.vencimento_mais_antigo)})${c.descricao ? ' · ' + esc(c.descricao) : ''}</small></article>`; }).join('')
          || vazio('Ninguém em atraso no Vybe Finanças.')}</div>`;
    }
    return `${f ? doFin : avisoFin(false) + doVybe}
      ${d.faturas.length ? `<div class="vc-secao"><h3>${f ? 'Faturas atrasadas lançadas no Vybe OS' : 'Faturas atrasadas'}</h3></div><div class="vc-lista">${d.faturas.map((f) => `<article class="vc-cartao barra-${f.severidade.nivel}"><div class="vc-cartao-topo"><b>${esc(f.cliente_nome || f.descricao)}</b>${pill(num(f.atraso) + ' dias', f.severidade.nivel)}</div><small>${din(f.aberto)} em aberto · venceu ${data(f.vencimento)}</small>
        <div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="receber" data-id="${esc(f.id)}">Receber</button></div></article>`).join('')}</div>` : ''}
      ${d.marcados_a_mao.length ? `<div class="vc-secao"><h3>Marcados à mão em Finanças por cliente</h3></div><ul class="vc-grupos">${d.marcados_a_mao.map((m) => `<li><b>${esc(m.cliente_nome)}</b>${pill(...STATUS_PAG[m.status_pagamento])}</li>`).join('')}</ul>` : ''}`;
  }
  function churnDaCarteira() {
    try { const d = window.VybeCarteira?.dados?.(); const l = Array.isArray(d) ? d : Array.isArray(d?.clientes) ? d.clientes : null; return l; } catch { return null; }
  }
  function abaCaixa(d) {
    const churn = churnDaCarteira();
    const prev = churn ? C().previsaoCaixa({ recebiveis: d.recebiveis, contas: d.contas, hoje: d.hoje, churn }) : d.previsao;
    const max = Math.max(1, ...prev.meses.flatMap((m) => [m.entradas, m.saidas]));
    // Desenhado na largura da janela (antes: 320 de base esticado até a tela toda, com os meses gigantes).
    const W = Math.max(320, Math.min(980, (document.getElementById('vv-comercial')?.clientWidth || 400) - 70)), H = 170, bw = Math.min(40, Math.max(22, W / prev.meses.length / 3)), passo = W / prev.meses.length;
    const barras = prev.meses.map((m, i) => { const x = i * passo + passo / 2, he = (m.entradas / max) * 120, hs = (m.saidas / max) * 120;
      return `<rect x="${x - bw - 2}" y="${140 - he}" width="${bw}" height="${he}" rx="4" class="ent"/><rect x="${x + 2}" y="${140 - hs}" width="${bw}" height="${hs}" rx="4" class="sai${m.saidas_estimadas ? ' est' : ''}"/>
        <text x="${x}" y="158" text-anchor="middle">${esc(MESES[Number(m.mes.slice(5)) - 1].slice(0, 3))}</text>`; }).join('');
    return `${prev.alertas.map((a) => `<p class="vc-alerta u1">Risco de churn alto: <b>${esc(a.cliente_nome || 'cliente ' + a.cliente_id)}</b> é ${pc(a.percentual)} do faturamento recorrente do mês (${din(a.valor)}).</p>`).join('')}
      <figure class="vc-grafico"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas e saídas previstas por mês">${barras}<line x1="0" x2="${W}" y1="140" y2="140" class="eixo"/></svg>
        <figcaption><span><i class="ent"></i>Entradas recorrentes</span><span><i class="sai"></i>Fixas + folha</span><span><i class="sai est"></i>Estimado</span></figcaption></figure>
      <div class="vc-lista">${prev.meses.map((m) => `<article class="vc-cartao${m.saldo < 0 ? ' barra-u1' : ''}"><div class="vc-cartao-topo"><b>${esc(nomeMes(m.mes))}</b>${m.saldo < 0 ? pill('Saldo negativo', 'u1') : pill('Saldo positivo', 'u6')}</div>
        <p class="vc-grande">${din(m.saldo)}</p><small>Entradas ${din(m.entradas)} · Saídas ${din(m.saidas)}${m.saidas_estimadas ? ' (estimadas pelo mês atual)' : ''}</small></article>`).join('')}</div>
      ${!d.recebiveis.length && !d.contas.length ? vazio('Sem recebimentos recorrentes nem contas fixas lançados: a previsão sai deles.', 'Lançar recebimento', 'ir-recebimentos') : ''}
      <p class="vc-dica">${churn ? 'Risco de churn lido da Carteira.' : 'Risco de churn: a Carteira não está carregada neste painel; sem alerta de concentração.'}</p>
      ${fin() ? `<p class="vc-dica">A previsão usa os recebimentos recorrentes e as contas fixas lançados no Vybe OS. O realizado mês a mês (faturamento × custos, fonte: Vybe Finanças) está em Finanças por cliente.</p>` : avisoFin(false)}`;
  }
  function abaFornecedores(d) {
    const cat = st.filtro.categoria || '', lista = C().filtrarFornecedores(d.fornecedores.filter((f) => f.ativo), { categoria: cat, busca: st.filtro.forn || '' });
    const nomeCat = (id) => d.categorias.find((c) => c.id === id)?.nome || id;
    return `<div class="vc-secao"><h3>Fornecedores</h3>${botaoNovo('Novo fornecedor', 'fornecedor')}</div>
      <div class="vc-filtros" role="group" aria-label="Categoria"><button type="button" data-vc-cat="" aria-pressed="${!cat}">Todas</button>${d.categorias.map((c) => `<button type="button" data-vc-cat="${c.id}" aria-pressed="${cat === c.id}">${esc(c.nome)}</button>`).join('')}</div>
      <input type="search" class="vc-busca" data-vc-busca="forn" placeholder="Buscar fornecedor ou contato" value="${esc(st.filtro.forn || '')}" aria-label="Buscar fornecedor">
      <div class="vc-lista">${lista.map((f) => `<article class="vc-cartao"><div class="vc-cartao-topo"><b>${esc(f.nome)}</b>${pill(nomeCat(f.categoria), 'u4')}</div>
        <small>BV ${pc(f.bv_percentual)}${f.contato ? ' · ' + esc(f.contato) : ''}</small>${f.observacoes ? `<small>${esc(f.observacoes)}</small>` : ''}
        <div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="fornecedor" data-id="${esc(f.id)}">Editar</button><button type="button" class="vc-perigo" data-vc="arquivar-forn" data-id="${esc(f.id)}">Arquivar</button></div></article>`).join('')
        || vazio(d.fornecedores.length ? 'Nenhum fornecedor com esse filtro.' : 'Nenhum fornecedor cadastrado. Guarde aqui gráficas, brindes, audiovisual e o BV de cada um.', 'Novo fornecedor', 'fornecedor')}</div>`;
  }
  function abaCreators(d) {
    const p = d.pode || {}, f = st.filtro, lista = C().filtrarCreators(d.creators, { nicho: f.nicho || '', cidade: f.cidade || '', busca: f.creator || '' });
    const sel = (campo, opcoes, rotulo) => `<select class="vc-mini" data-vc-filtro="${campo}" aria-label="${rotulo}"><option value="">${rotulo}: todos</option>${opcoes.map((o) => `<option${o === f[campo] ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    return `<div class="vc-secao"><h3>Creators de Irecê</h3>${p.editar_comercial ? botaoNovo('Novo creator', 'creator') : ''}</div>
      <div class="vc-filtros">${sel('nicho', d.opcoes.nichos, 'Nicho')}${sel('cidade', d.opcoes.cidades, 'Cidade')}</div>
      <input type="search" class="vc-busca" data-vc-busca="creator" placeholder="Buscar nome ou @" value="${esc(f.creator || '')}" aria-label="Buscar creator">
      <div class="vc-lista grade">${lista.map((c) => `<article class="vc-cartao"><div class="vc-cartao-topo"><b>${esc(c.nome)}</b>${c.nicho ? pill(c.nicho, 'u4') : ''}</div>
        <small>${c.arroba ? '@' + esc(c.arroba) + ' · ' : ''}${num(c.seguidores)} seguidores · ${pc(c.engajamento)} engajamento${c.cidade ? ' · ' + esc(c.cidade) : ''}</small>
        ${c.contato ? `<small>${esc(c.contato)}</small>` : ''}${c.observacoes ? `<small>${esc(c.observacoes)}</small>` : ''}
        ${p.editar_comercial ? `<div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="creator" data-id="${esc(c.id)}">Editar</button><button type="button" class="vc-perigo" data-vc="arquivar-creator" data-id="${esc(c.id)}">Arquivar</button></div>` : ''}</article>`).join('')
        || vazio(d.creators.length ? 'Nenhum creator com esse filtro.' : 'Nenhum creator cadastrado. Monte a lista de influenciadores locais.', p.editar_comercial ? 'Novo creator' : '', 'creator')}</div>`;
  }
  const PINTOR = { funil: abaFunil, pacotes: abaPacotes, orcamentos: abaOrcamentos, financas: abaFinancas, recebimentos: abaRecebimentos, contas: abaContas,
    inadimplencia: abaInadimplencia, caixa: abaCaixa, fornecedores: abaFornecedores, creators: abaCreators };

  // ---------- Folha (formulários) ----------
  function campoHtml(c) {
    const id = 'vc-f-' + c.nome, req = c.obrigatorio ? ' required' : '', v = c.valor ?? '';
    const ctl = c.tipo === 'select' ? `<select id="${id}" name="${c.nome}"${req}>${c.opcoes.map(([k, n]) => `<option value="${esc(k)}"${String(k) === String(v) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`
      : c.tipo === 'textarea' ? `<textarea id="${id}" name="${c.nome}" rows="3" maxlength="${c.max || 2000}"${req}>${esc(v)}</textarea>`
      : `<input id="${id}" name="${c.nome}" type="${c.tipo || 'text'}" value="${esc(v)}"${c.tipo === 'number' ? ` inputmode="decimal" step="${c.passo || 'any'}" min="${c.min ?? 0}"${c.maxv != null ? ` max="${c.maxv}"` : ''}` : ''}${c.max ? ` maxlength="${c.max}"` : ''}${req}>`;
    return `<label class="vc-campo${c.meio ? ' meio' : ''}" for="${id}"><span>${esc(c.rotulo)}</span>${ctl}${c.dica ? `<small>${esc(c.dica)}</small>` : ''}</label>`;
  }
  function folhaHtml() {
    const f = st.folha; if (!f) return '';
    if (f.tipo === 'etapas') return folhaEtapas();
    return `<div class="vc-folha-fundo" data-vc="fechar-folha"></div><form class="vc-folha" data-vc-form aria-label="${esc(f.titulo)}">
      <div class="vc-folha-topo"><b>${esc(f.titulo)}</b><button type="button" class="vc-icone" data-vc="fechar-folha" aria-label="Fechar">${IC.fechar}</button></div>
      <div class="vc-folha-corpo">${f.antes || ''}${f.campos.map(campoHtml).join('')}<div data-vc-ao-vivo>${f.aoVivo ? f.aoVivo(valoresDe(null)) : ''}</div></div>
      <div class="vc-folha-pe"><span class="vc-msg" role="status">${st.msg.startsWith('⚠️') ? esc(st.msg) : ''}</span><button type="submit" class="vc-acao"${st.ocupado ? ' disabled' : ''}>${esc(f.botao || 'Salvar')}</button></div></form>`;
  }
  function valoresDe(form) {
    const f = st.folha, out = {};
    if (!form) { for (const c of f.campos) out[c.nome] = c.valor ?? ''; return out; }
    for (const c of f.campos) out[c.nome] = form.elements[c.nome]?.value ?? '';
    return out;
  }
  function abrirFolha(f) { st.folha = f; st.msg = ''; pintar(); setTimeout(() => raiz()?.querySelector('.vc-folha input, .vc-folha select, .vc-folha textarea')?.focus(), 30); }
  function folhaEtapas() {
    const l = st.etapasEdit || [];
    return `<div class="vc-folha-fundo" data-vc="fechar-folha"></div><div class="vc-folha" role="dialog" aria-label="Configurar etapas">
      <div class="vc-folha-topo"><b>Etapas do funil</b><button type="button" class="vc-icone" data-vc="fechar-folha" aria-label="Fechar">${IC.fechar}</button></div>
      <div class="vc-folha-corpo"><p class="vc-dica">Novo (SDR e aprovação), Ganho e Perdido ficam fixos. Reordene o meio do funil e acrescente etapas. As do padrão não saem; etapa nova só sai se estiver vazia.</p>
        <ol class="vc-etapas">${l.map((e, i) => `<li><span>${esc(e.nome)}</span>${e.extra ? pill('Nova', 'u4') : ''}<button type="button" class="vc-icone" data-vc-etapa="sobe" data-i="${i}" aria-label="Subir ${esc(e.nome)}"${i ? '' : ' disabled'}>${IC.cima}</button><button type="button" class="vc-icone" data-vc-etapa="desce" data-i="${i}" aria-label="Descer ${esc(e.nome)}"${i < l.length - 1 ? '' : ' disabled'}>${IC.baixo}</button>${e.extra ? `<button type="button" class="vc-icone" data-vc-etapa="tira" data-i="${i}" aria-label="Tirar ${esc(e.nome)}">${IC.fechar}</button>` : ''}</li>`).join('')}</ol>
        <div class="vc-add"><input type="text" maxlength="60" placeholder="Nova etapa (ex.: Visita à loja)" data-vc-nova-etapa aria-label="Nome da nova etapa"><button type="button" class="vc-sec" data-vc-etapa="add">Acrescentar</button></div></div>
      <div class="vc-folha-pe"><span class="vc-msg" role="status">${st.msg.startsWith('⚠️') ? esc(st.msg) : ''}</span><button type="button" class="vc-acao" data-vc="salvar-etapas"${st.ocupado ? ' disabled' : ''}>Salvar etapas</button></div></div>`;
  }

  // Formulários de cada ação
  const opcoes = (lista, vazioRotulo) => [...(vazioRotulo ? [['', vazioRotulo]] : []), ...lista.map((x) => [x.id, x.nome])];
  function formPacote(id) {
    const d = st.dados.pacotes, x = d.pacotes.find((p) => p.id === id) || {};
    abrirFolha({ titulo: id ? 'Editar pacote' : 'Novo pacote', campos: [
      { nome: 'nome', rotulo: 'Nome', valor: x.nome, obrigatorio: true, max: 120 },
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: [['recorrente', 'Recorrente (mensal)'], ['avulso', 'Avulso']], valor: x.tipo || 'recorrente', meio: true },
      { nome: 'preco', rotulo: 'Preço (R$)', tipo: 'number', valor: x.preco ?? '', passo: '0.01', meio: true, obrigatorio: true },
      { nome: 'entregas', rotulo: 'Entregas incluídas (uma por linha)', tipo: 'textarea', valor: (x.entregas || []).join('\n'), max: 8000 },
      { nome: 'horas', rotulo: 'Horas por mês', tipo: 'number', valor: x.horas ?? '', meio: true },
      { nome: 'custo_hora', rotulo: 'Custo/hora (R$)', tipo: 'number', valor: x.custo_hora ?? '', passo: '0.01', meio: true },
      { nome: 'captacoes', rotulo: 'Captações', tipo: 'number', valor: x.captacoes ?? '', passo: '1', meio: true },
      { nome: 'custo_captacao', rotulo: 'Custo por captação (R$)', tipo: 'number', valor: x.custo_captacao ?? '', passo: '0.01', meio: true },
      ...C().CARGOS.map((c) => ({ nome: 'carga_' + c.id, rotulo: `Carga ${c.nome} (demandas/mês)`, tipo: 'number', passo: '1', valor: x.carga?.[c.id] ?? '', meio: true })),
      ...(id ? [{ nome: 'ativo', rotulo: 'Situação', tipo: 'select', opcoes: [['1', 'Ativo'], ['0', 'Inativo']], valor: x.ativo === false ? '0' : '1' }] : []),
    ], aoVivo: (v) => { const m = C().pacoteComMargem(v); return `<p class="vc-dica">Custo estimado ${din(m.custo)} · margem ${din(m.margem)} (${pc(m.margem_percentual)})${m.zona_critica ? ' · ' + pill('Zona crítica', 'u1') : ''}</p>`; },
    enviar: (v) => comercial({ acao: 'pacote_salvar', id: id || undefined, versao: x.versao, nome: v.nome, tipo: v.tipo, preco: v.preco, entregas: v.entregas.split('\n'),
      horas: v.horas, custo_hora: v.custo_hora, captacoes: v.captacoes, custo_captacao: v.custo_captacao, ativo: v.ativo !== '0',
      carga: Object.fromEntries(C().CARGOS.map((c) => [c.id, v['carga_' + c.id] || 0])) }) });
  }
  function formCapacidade() {
    const cap = st.dados.pacotes.capacidade || { capacidades: {} };
    abrirFolha({ titulo: 'Capacidade mensal por cargo', antes: '<p class="vc-dica">Quantas demandas cada cargo dá conta por mês. A carga atual vem das demandas abertas do painel; a do pacote, da carga cadastrada nele.</p>',
      campos: C().CARGOS.map((c) => ({ nome: 'cap_' + c.id, rotulo: c.nome, tipo: 'number', passo: '1', valor: cap.capacidades[c.id] ?? '', meio: true })),
      enviar: (v) => comercial({ acao: 'capacidade_salvar', capacidades: Object.fromEntries(C().CARGOS.map((c) => [c.id, v['cap_' + c.id] || 0])) }) });
  }
  function formOrcamento() {
    const d = st.dados.orcamentos, validade = C().somarDias(hojeIso(), 15);
    abrirFolha({ titulo: 'Novo orçamento', botao: 'Criar orçamento', campos: [
      { nome: 'cliente_nome', rotulo: 'Cliente', obrigatorio: true, max: 200 },
      ...d.pacotes.map((p) => ({ nome: 'q_' + p.id, rotulo: `${p.nome} · ${din(p.preco)}${p.tipo === 'recorrente' ? '/mês' : ''} (quantidade)`, tipo: 'number', passo: '1', valor: '0', meio: true })),
      { nome: 'desconto_percentual', rotulo: 'Desconto (%)', tipo: 'number', valor: '0', maxv: 100, meio: true },
      { nome: 'validade', rotulo: 'Válido até', tipo: 'date', valor: validade, obrigatorio: true, meio: true },
      { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', max: 4000 },
    ], aoVivo: (v) => {
      const itens = d.pacotes.map((p) => ({ ...p, quantidade: Number(v['q_' + p.id]) || 0 })).filter((i) => i.quantidade > 0);
      const t = C().totalOrcamento({ itens, desconto_percentual: v.desconto_percentual });
      return `<div class="vc-total"><span>Recorrente ${din(t.total_recorrente)}/mês</span><span>Avulso ${din(t.total_avulso)}</span>${t.desconto ? `<small>Desconto ${din(t.desconto)}</small>` : ''}</div>${itens.length ? capacidadeHtml(d.capacidade, C().cargaDosItens(itens)) : ''}`;
    }, enviar: (v) => comercial({ acao: 'orcamento_criar', cliente_nome: v.cliente_nome, desconto_percentual: v.desconto_percentual, validade: v.validade, observacoes: v.observacoes,
      itens: d.pacotes.map((p) => ({ pacote_id: p.id, quantidade: Number(v['q_' + p.id]) || 0 })).filter((i) => i.quantidade > 0) }) });
  }
  function formFinancas(id) {
    const d = st.dados.financas, c = d.clientes.find((x) => x.cliente_id === id);
    abrirFolha({ titulo: 'Finanças · ' + c.cliente_nome, campos: [
      { nome: 'valor_mensal', rotulo: 'Valor mensal do contrato (R$)', tipo: 'number', passo: '0.01', valor: c.valor_mensal || '', meio: true },
      { nome: 'pacote_id', rotulo: 'Pacote', tipo: 'select', opcoes: opcoes(d.pacotes, 'Sem pacote'), valor: c.pacote_id || '', meio: true },
      { nome: 'status_pagamento', rotulo: 'Pagamento', tipo: 'select', opcoes: d.status.map((s) => [s.id, s.nome]), valor: c.status_pagamento },
      { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea', valor: c.observacao, max: 1000 },
    ], aoVivo: (v) => { const p = d.pacotes.find((x) => x.id === v.pacote_id); const f = C().financasCliente({ valor_mensal: v.valor_mensal, pacote: p });
      return f.sem_pacote ? '<p class="vc-dica">Sem pacote, o custo não é estimado.</p>' : `<p class="vc-dica">Custo ${din(f.custo)} · margem ${pc(f.margem_percentual)}${f.zona_critica ? ' · ' + pill('Zona crítica', 'u1') : ''}</p>`; },
    enviar: (v) => comercial({ acao: 'financas_salvar', cliente_id: id, versao: c.versao ?? '', ...v }) });
  }
  function formRecebivel(id) {
    const d = st.dados.recebimentos, x = d.recebiveis.find((r) => r.id === id) || { tipo: 'recorrente', ciclo: 'mensal' };
    abrirFolha({ titulo: id ? 'Editar recebimento' : 'Novo recebimento', campos: [
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: [['recorrente', 'Recorrente (contrato)'], ['pontual', 'Pontual']], valor: x.tipo, meio: true },
      { nome: 'ciclo', rotulo: 'Ciclo (recorrente)', tipo: 'select', opcoes: d.ciclos.map((c) => [c, c[0].toUpperCase() + c.slice(1)]), valor: x.ciclo || 'mensal', meio: true },
      { nome: 'cliente_id', rotulo: 'Cliente', tipo: 'select', opcoes: opcoes(d.clientes, 'Sem cliente (pontual)'), valor: x.cliente_id || '' },
      { nome: 'descricao', rotulo: 'Descrição', valor: x.descricao, max: 200, dica: 'Obrigatória no pontual.' },
      { nome: 'categoria', rotulo: 'Categoria', valor: x.categoria, max: 60, meio: true },
      { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'number', passo: '0.01', valor: x.valor ?? '', obrigatorio: true, meio: true },
      { nome: 'vencimento', rotulo: 'Vencimento', tipo: 'date', valor: x.vencimento || hojeIso(), obrigatorio: true },
    ], enviar: (v) => comercial({ acao: 'recebivel_salvar', id: id || undefined, ...v, ciclo: v.tipo === 'recorrente' ? v.ciclo : null }) });
  }
  function formReceber(id) {
    const x = (st.dados.recebimentos?.recebiveis || []).find((r) => r.id === id) || (st.dados.inadimplencia?.faturas || []).find((r) => r.id === id) || {};
    abrirFolha({ titulo: 'Registrar recebimento', botao: 'Registrar', campos: [
      { nome: 'valor_recebido', rotulo: 'Valor recebido até agora (R$)', tipo: 'number', passo: '0.01', valor: x.valor ?? '', obrigatorio: true, meio: true },
      { nome: 'recebido_em', rotulo: 'Recebido em', tipo: 'date', valor: hojeIso(), obrigatorio: true, meio: true },
    ], enviar: (v) => comercial({ acao: 'recebivel_receber', id, ...v }) });
  }
  function formConta(id) {
    const d = st.dados.contas, x = d.contas.find((c) => c.id === id) || { grupo: 'fixa' };
    abrirFolha({ titulo: id ? 'Editar conta' : 'Nova conta', campos: [
      { nome: 'descricao', rotulo: 'Descrição', valor: x.descricao, obrigatorio: true, max: 200 },
      { nome: 'grupo', rotulo: 'Grupo', tipo: 'select', opcoes: d.grupos.map((g) => [g.id, g.nome]), valor: x.grupo, meio: true },
      { nome: 'fornecedor_id', rotulo: 'Fornecedor', tipo: 'select', opcoes: opcoes(d.fornecedores, 'Nenhum'), valor: x.fornecedor_id || '', meio: true },
      { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'number', passo: '0.01', valor: x.valor ?? '', obrigatorio: true, meio: true },
      { nome: 'vencimento', rotulo: 'Vencimento', tipo: 'date', valor: x.vencimento || hojeIso(), obrigatorio: true, meio: true },
    ], enviar: (v) => comercial({ acao: 'conta_salvar', id: id || undefined, ...v }) });
  }
  function formFornecedor(id) {
    const d = st.dados.fornecedores, x = d.fornecedores.find((f) => f.id === id) || { categoria: 'grafica' };
    abrirFolha({ titulo: id ? 'Editar fornecedor' : 'Novo fornecedor', campos: [
      { nome: 'nome', rotulo: 'Nome', valor: x.nome, obrigatorio: true, max: 120 },
      { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: d.categorias.map((c) => [c.id, c.nome]), valor: x.categoria, meio: true },
      { nome: 'bv_percentual', rotulo: 'BV (%)', tipo: 'number', valor: x.bv_percentual ?? '', maxv: 100, meio: true },
      { nome: 'contato', rotulo: 'Contato', valor: x.contato, max: 200 },
      { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', valor: x.observacoes, max: 2000 },
    ], enviar: (v) => comercial({ acao: 'fornecedor_salvar', id: id || undefined, ...v }) });
  }
  function formCreator(id) {
    const d = st.dados.creators, x = d.creators.find((c) => c.id === id) || {};
    abrirFolha({ titulo: id ? 'Editar creator' : 'Novo creator', campos: [
      { nome: 'nome', rotulo: 'Nome', valor: x.nome, obrigatorio: true, max: 120, meio: true },
      { nome: 'arroba', rotulo: '@ no Instagram', valor: x.arroba ? '@' + x.arroba : '', max: 60, meio: true },
      { nome: 'seguidores', rotulo: 'Seguidores', tipo: 'number', passo: '1', valor: x.seguidores ?? '', meio: true },
      { nome: 'engajamento', rotulo: 'Engajamento (%)', tipo: 'number', valor: x.engajamento ?? '', maxv: 100, meio: true },
      { nome: 'nicho', rotulo: 'Nicho', valor: x.nicho, max: 60, meio: true },
      { nome: 'cidade', rotulo: 'Cidade', valor: x.cidade ?? 'Irecê', max: 60, meio: true },
      { nome: 'contato', rotulo: 'Contato', valor: x.contato, max: 200 },
      { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', valor: x.observacoes, max: 2000 },
    ], enviar: (v) => comercial({ acao: 'creator_salvar', id: id || undefined, ...v }) });
  }
  function formValor(id) {
    const d = st.dados.funil, o = d.oportunidades.find((x) => x.id === id);
    abrirFolha({ titulo: 'Valor · ' + o.nome, campos: [
      { nome: 'valor_mensal', rotulo: 'Valor mensal (recorrente, R$)', tipo: 'number', passo: '0.01', valor: o.valor_mensal || '', meio: true },
      { nome: 'valor_avulso', rotulo: 'Valor avulso (R$)', tipo: 'number', passo: '0.01', valor: o.valor_avulso || '', meio: true },
      { nome: 'pacote_id', rotulo: 'Pacote', tipo: 'select', opcoes: opcoes(d.pacotes, 'Sem pacote'), valor: o.pacote_id || '' },
    ], aoVivo: (v) => { const p = d.pacotes.find((x) => x.id === v.pacote_id); return p ? capacidadeHtml(d.capacidade, C().cargaDosItens([{ carga: p.carga, quantidade: 1 }])) : ''; },
    enviar: (v) => crm({ acao: 'valor', id, versao: o.versao, ...v }) });
  }
  function formPerder(id, de) {
    const d = st.dados.funil, o = d.oportunidades.find((x) => x.id === id);
    abrirFolha({ titulo: 'Marcar perdido · ' + o.nome, botao: 'Marcar perdido', campos: [
      { nome: 'motivo_perda', rotulo: 'Motivo da perda', tipo: 'select', opcoes: [['', 'Escolha o motivo'], ...d.motivos.map((m) => [m.id, m.nome])], obrigatorio: true },
      { nome: 'motivo_texto', rotulo: 'Detalhe (obrigatório em "Outro")', tipo: 'textarea', max: 500 },
    ], enviar: (v) => crm({ acao: 'mover', id, de_etapa: de, etapa: 'perdido', ...v }) });
  }
  function confirmarGanho(id, de, para) {
    const d = st.dados.funil, o = d.oportunidades.find((x) => x.id === id), p = d.pacotes.find((x) => String(x.id) === String(o?.pacote_id));
    abrirFolha({ titulo: 'Fechar negócio · ' + o.nome, botao: 'Registrar ganho', campos: [],
      antes: `<p>${p ? `Pacote: <b>${esc(p.nome)}</b>.` : 'Sem pacote informado (use "Valor" para informar o pacote e conferir a carga).'}</p>${p ? capacidadeHtml(d.capacidade, C().cargaDosItens([{ carga: p.carga, quantidade: 1 }])) : ''}`,
      enviar: () => crm({ acao: 'mover', id, de_etapa: de, etapa: para }) });
  }
  function imprimir(id) {
    const w = window.open('', '_blank'); if (!w) { st.msg = '⚠️ O navegador bloqueou a janela de impressão.'; pintar(); return; }
    w.document.write('<!doctype html><title>Orçamento</title><p style="font:14px system-ui;padding:24px">Carregando…</p>');
    pedir('comercial', null, `&aba=orcamentos&id=${encodeURIComponent(id)}`).then(({ orcamento: o }) => {
      const t = o.totais, linhas = o.itens.map((i) => `<tr><td><b>${esc(i.nome)}</b>${(i.entregas || []).length ? `<ul>${i.entregas.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}</td><td>${i.tipo === 'recorrente' ? 'Mensal' : 'Avulso'}</td><td class="n">${num(i.quantidade)}</td><td class="n">${din(i.preco)}</td><td class="n">${din(i.preco * i.quantidade)}</td></tr>`).join('');
      w.document.open();
      w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proposta Vybe · ${esc(o.cliente_nome)}</title><style>
        body{font:13px/1.5 system-ui,sans-serif;color:#1F1D1A;margin:0;padding:40px;max-width:820px;margin:auto}h1{font-size:26px;margin:0 0 4px;letter-spacing:-.02em}
        .k{font:700 11px system-ui;letter-spacing:.12em;text-transform:uppercase;color:#A84E00}.m{color:#6B675F}table{width:100%;border-collapse:collapse;margin:24px 0}
        th{font:700 10px system-ui;text-transform:uppercase;color:#6B675F;text-align:left;border-bottom:1px solid #E6E0D6;padding:8px 6px}td{border-bottom:1px solid #F0EBE3;padding:10px 6px;vertical-align:top}
        td ul{margin:4px 0 0;padding-left:18px;color:#6B675F}.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.tot{margin-left:auto;width:min(100%,320px)}
        .tot div{display:flex;justify-content:space-between;padding:4px 0}.tot .g{font-weight:800;font-size:16px;border-top:2px solid #1F1D1A;margin-top:6px;padding-top:8px}
        .obs{white-space:pre-wrap;border-left:3px solid #FF7A2F;padding-left:12px}@media print{body{padding:0}.sem{display:none}}</style></head><body>
        <p class="k">Vybe · Proposta comercial</p><h1>${esc(o.cliente_nome)}</h1><p class="m">Proposta nº ${esc(o.id)} · emitida em ${data(String(o.criado_em).slice(0, 10))} · válida até ${data(o.validade)}</p>
        <table><thead><tr><th>Item</th><th>Tipo</th><th class="n">Qtd.</th><th class="n">Preço</th><th class="n">Subtotal</th></tr></thead><tbody>${linhas}</tbody></table>
        <div class="tot">${t.subtotal_recorrente ? `<div><span>Recorrente</span><span>${din(t.subtotal_recorrente)}/mês</span></div>` : ''}${t.subtotal_avulso ? `<div><span>Avulso</span><span>${din(t.subtotal_avulso)}</span></div>` : ''}
        ${t.desconto ? `<div><span>Desconto (${pc(o.desconto_percentual)})</span><span>− ${din(t.desconto)}</span></div>` : ''}
        ${t.total_recorrente ? `<div class="g"><span>Total mensal</span><span>${din(t.total_recorrente)}</span></div>` : ''}${t.total_avulso ? `<div class="g"><span>Total avulso</span><span>${din(t.total_avulso)}</span></div>` : ''}</div>
        ${o.observacoes ? `<h3>Observações</h3><p class="obs">${esc(o.observacoes)}</p>` : ''}${roiDaProposta(o)}<p class="sem"><button onclick="print()">Imprimir ou salvar em PDF</button></p></body></html>`);
      w.document.close(); setTimeout(() => { try { w.print(); } catch {} }, 300);
    }).catch((e) => { w.document.body.textContent = e.message; });
  }

  // ---------- Pintura ----------
  function raiz() {
    let el = document.getElementById('vv-comercial');
    if (el || !st.aberto) return el;
    el = document.createElement('section');
    el.id = 'vv-comercial'; el.className = 'vc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Comercial');
    el.addEventListener('click', aoClicar); el.addEventListener('input', aoDigitar); el.addEventListener('change', aoMudar); el.addEventListener('submit', aoEnviar);
    document.body.append(el);
    return el;
  }
  function pintar() {
    const el = raiz(); if (!el) return;
    el.hidden = !st.aberto; if (!st.aberto) return;
    const ativo = document.activeElement, idFoco = el.contains(ativo) ? (ativo.dataset.vcBusca || ativo.name || '') : '', selFim = ativo?.selectionEnd;
    const corpo = el.querySelector('.vc-corpo'), rolagem = corpo ? corpo.scrollTop : 0;
    const dinheiro = veDinheiro(), abas = ABAS.filter((a) => !a[2] || dinheiro);
    if (!abas.some((a) => a[0] === st.aba)) st.aba = 'funil';
    const d = st.dados[st.aba], erro = st.erro[st.aba];
    let conteudo;
    if (erro) conteudo = `<div class="vc-vazio"><p>${esc(erro)}</p><button type="button" class="vc-sec" data-vc="recarregar">Tentar de novo</button></div>`;
    else if (!d) conteudo = '<div class="vc-vazio"><p>Carregando…</p></div>';
    else { try { conteudo = PINTOR[st.aba](d); } catch (e) { console.error('[comercial]', e); conteudo = vazio('Não foi possível mostrar esta aba.'); } }
    el.innerHTML = `<div class="vc-topo"><span class="vc-marca">${IC.marca}</span><span class="vc-titulo"><b>Comercial</b><small>${dinheiro ? 'Funil, produtos e o dinheiro da agência' : 'Funil, pacotes, orçamentos e creators'}</small></span>
        <button type="button" class="vc-icone" data-vc="ajuda" aria-label="O que é este módulo" aria-pressed="${st.ajuda}" title="O que é isto?">${IC.ajuda}</button>
        <button type="button" class="vc-icone" data-vc="fechar" aria-label="Fechar" title="Fechar (Esc)">${IC.fechar}</button></div>
      <nav class="vc-abas" role="tablist" aria-label="Abas do Comercial">${abas.map(([id, nome]) => `<button type="button" role="tab" data-vc-aba="${id}" aria-selected="${st.aba === id}">${esc(nome)}</button>`).join('')}</nav>
      ${st.ajuda ? `<div class="vc-ajuda" role="note"><b>${esc(abas.find((a) => a[0] === st.aba)?.[1])}</b><p>${esc(AJUDA[st.aba])}</p></div>` : ''}
      ${st.msg && !st.folha ? `<p class="vc-msg-geral${st.msg.startsWith('⚠️') ? ' erro' : ''}" role="status">${esc(st.msg)}</p>` : ''}
      <div class="vc-corpo${st.carregando[st.aba] && d ? ' atualizando' : ''}">${conteudo}</div>${folhaHtml()}`;
    const nc = el.querySelector('.vc-corpo'); if (nc) nc.scrollTop = rolagem;
    if (idFoco) { const alvo = el.querySelector(`[data-vc-busca="${idFoco}"], [name="${idFoco}"]`); if (alvo) { alvo.focus(); try { alvo.setSelectionRange?.(selFim, selFim); } catch {} } }
  }
  function atualizarAoVivo(form) {
    const f = st.folha; if (!f?.aoVivo || !form) return;
    const alvo = form.querySelector('[data-vc-ao-vivo]'); if (alvo) alvo.innerHTML = f.aoVivo(valoresDe(form));
  }

  // ---------- Interação ----------
  function aoClicar(e) {
    const t = e.target.closest?.('button, [data-vc="fechar-folha"]'); if (!t) return;
    if (t.dataset.vcAba) { st.aba = t.dataset.vcAba; st.msg = ''; st.folha = null; pintar(); if (!st.dados[st.aba]) carregar(); else carregar(); return; }
    if (t.dataset.vcFase) { st.fase = t.dataset.vcFase; pintar(); return; }
    if (t.dataset.vcPeriodo) { st.periodo.tipo = t.dataset.vcPeriodo; carregar(); return; }
    if (t.dataset.vcCat !== undefined) { st.filtro.categoria = t.dataset.vcCat; pintar(); return; }
    if (t.dataset.vcEtapa) return mexerEtapa(t.dataset.vcEtapa, Number(t.dataset.i));
    const a = t.dataset.vc, id = t.dataset.id;
    if (!a) return;
    const acoes = {
      fechar, ajuda: () => { st.ajuda = !st.ajuda; pintar(); }, recarregar: () => carregar(), 'fechar-folha': () => { st.folha = null; st.msg = ''; pintar(); },
      pacote: () => formPacote(id), capacidade: formCapacidade, orcamento: formOrcamento, financas: () => formFinancas(id), recebivel: () => formRecebivel(id),
      receber: () => formReceber(id), conta: () => formConta(id), fornecedor: () => formFornecedor(id), creator: () => formCreator(id), valor: () => formValor(id),
      perder: () => formPerder(id, t.dataset.de), imprimir: () => imprimir(id),
      mover: () => (t.dataset.para === 'ganho' ? confirmarGanho(id, t.dataset.de, t.dataset.para) : executar(() => crm({ acao: 'mover', id, de_etapa: t.dataset.de, etapa: t.dataset.para }), 'Etapa registrada.')),
      proximo: () => executar(() => comercial({ acao: 'recebivel_proximo', id }).then((r) => { if (!r.criado) throw new Error('O próximo ciclo já estava lançado.'); }), 'Próximo ciclo lançado.'),
      pagar: () => executar(() => comercial({ acao: 'conta_pagar', id }), 'Conta marcada como paga.'),
      'cancelar-rec': () => confirm('Cancelar este recebimento? Ele sai dos totais (o registro fica guardado).') && executar(() => comercial({ acao: 'recebivel_cancelar', id }), 'Recebimento cancelado.'),
      'cancelar-conta': () => confirm('Cancelar esta conta? Ela sai dos totais (o registro fica guardado).') && executar(() => comercial({ acao: 'conta_cancelar', id }), 'Conta cancelada.'),
      'arquivar-forn': () => confirm('Arquivar este fornecedor?') && executar(() => comercial({ acao: 'fornecedor_arquivar', id }), 'Fornecedor arquivado.'),
      'arquivar-creator': () => confirm('Arquivar este creator?') && executar(() => comercial({ acao: 'creator_arquivar', id }), 'Creator arquivado.'),
      'ir-recebimentos': () => abrir('recebimentos'),
      metas: formMetas,
      'form-copiar': copiarLinkFormulario,
      'form-gerar': () => (!st.dados.funil?.mes?.formulario?.ativo || confirm('Trocar o link? O link antigo para de funcionar na hora (troque também na bio e no site).'))
        && executar(() => comercial({ acao: 'formulario_gerar' }), 'Link do formulário pronto. Copie e ponha na bio e no site.'),
      'form-desligar': () => confirm('Desligar o formulário? O link para de aceitar contatos até você gerar um novo.') && executar(() => comercial({ acao: 'formulario_desligar' }), 'Formulário desligado.'),
      etapas: () => { st.etapasEdit = st.dados.funil.etapas.filter((x) => !C().ETAPAS_INICIO.includes(x.id) && !['ganho', 'perdido'].includes(x.id)).map((x) => ({ ...x })); st.folha = { tipo: 'etapas' }; st.msg = ''; pintar(); },
      'salvar-etapas': () => executar(() => comercial({ acao: 'etapas_salvar', etapas: st.etapasEdit.map((x) => ({ id: x.novo ? undefined : x.id, nome: x.nome })) }), 'Etapas do funil salvas.'),
    };
    acoes[a]?.();
  }
  function mexerEtapa(op, i) {
    const l = st.etapasEdit; if (!l) return;
    if (op === 'add') { const inp = raiz().querySelector('[data-vc-nova-etapa]'); const nome = inp?.value.trim(); if (!nome) return inp?.focus(); l.push({ id: 'novo-' + Date.now(), nome, extra: true, novo: true }); }
    else if (op === 'sobe' && i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]];
    else if (op === 'desce' && i < l.length - 1) [l[i + 1], l[i]] = [l[i], l[i + 1]];
    else if (op === 'tira') l.splice(i, 1);
    pintar();
  }
  function aoDigitar(e) {
    const t = e.target;
    if (t.dataset?.vcBusca) { st.filtro[t.dataset.vcBusca] = t.value.slice(0, 60); pintar(); return; }
    if (t.dataset?.vcRoi) { st.roi[t.dataset.vcRoi] = t.value.slice(0, 14); pintar(); return; }
    if (t.closest?.('[data-vc-form]')) atualizarAoVivo(t.closest('[data-vc-form]'));
  }
  function aoMudar(e) {
    const t = e.target;
    if (t.dataset?.vcMes !== undefined && /^\d{4}-\d{2}$/.test(t.value)) { st.periodo.mes = t.value; carregar(); return; }
    if (t.dataset?.vcFiltro) { st.filtro[t.dataset.vcFiltro] = t.value; pintar(); return; }
    if (t.dataset?.vcRoiOrc !== undefined) { const o = (st.dados.orcamentos?.orcamentos || []).find((x) => String(x.id) === t.value); st.roi.orc = t.value; if (o) st.roi.investimento = String(o.totais.total_recorrente).replace('.', ','); pintar(); return; }
    if (t.dataset?.vcStatusOrc) { executar(() => comercial({ acao: 'orcamento_status', id: t.dataset.vcStatusOrc, status: t.value }), 'Status do orçamento salvo.'); return; }
    if (t.closest?.('[data-vc-form]')) atualizarAoVivo(t.closest('[data-vc-form]'));
  }
  async function aoEnviar(e) {
    const form = e.target.closest?.('[data-vc-form]'); if (!form || !st.folha?.enviar) return;
    e.preventDefault();
    const f = st.folha, v = valoresDe(form);
    for (const c of f.campos) c.valor = v[c.nome]; // erro do servidor não apaga o que foi digitado
    await executar(() => f.enviar(v), 'Salvo.');
  }

  // ---------- Abrir / fechar ----------
  function abrir(aba) {
    const valida = ABAS.some((a) => a[0] === aba);
    st.aberto = true; if (valida) st.aba = aba; st.folha = null; st.msg = '';
    if (!st.periodo.mes) st.periodo.mes = hojeIso().slice(0, 7);
    pintar(); carregar();
  }
  function fechar() { st.aberto = false; st.folha = null; const el = document.getElementById('vv-comercial'); if (el) el.hidden = true; }
  // Sala de Closing (1º andar): modulo { tipo: 'janela', alvo: 'comercial' } na planta. Captura antes do HUD, que trataria como quadro.
  document.addEventListener?.('click', (e) => {
    const b = e.target.closest?.('[data-modulo]'); if (!b) return;
    let m; try { m = JSON.parse(b.dataset.modulo); } catch { return; }
    if (m?.tipo !== 'janela' || m.alvo !== 'comercial') return;
    e.preventDefault(); e.stopPropagation(); abrir(m.aba || 'funil');
  }, true);
  window.addEventListener?.('keydown', (e) => {
    if (e.key !== 'Escape' || !st.aberto) return;
    e.preventDefault(); e.stopPropagation();
    if (st.folha) { st.folha = null; st.msg = ''; pintar(); } else fechar();
  }, true);

  window.VybeComercial = { abrir, fechar, aberto: () => st.aberto, ABAS: ABAS.map(([id, nome, dinheiro]) => ({ id, nome, so_donos: Boolean(dinheiro) })) };
})();
