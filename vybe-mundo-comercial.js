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
  // Cliente com a cor da carteira (cliCor de vybe-core.js); fora do painel (testes), o nome escapado.
  function cliCor(n) { const g = globalThis.cliCor; return typeof g === 'function' && g !== cliCor ? g(n) : String(n ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  const C = () => window.VybeComercialCalculos;
  const ABAS = [
    ['funil', 'Funil'], ['pacotes', 'Pacotes'], ['orcamentos', 'Orçamentos'], ['financas', 'Finanças por cliente', 1], ['recebimentos', 'Recebimentos', 1],
    ['contas', 'Contas a pagar', 1], ['inadimplencia', 'Inadimplência', 1], ['caixa', 'Caixa', 1], ['fornecedores', 'Fornecedores', 1], ['creators', 'Creators'],
  ];
  // Frase do cabeçalho quando a janela abre num item só do dock (auditoria 09/11: Fornecedores e Creators mostravam o texto do Comercial).
  const FRASE = {
    funil: 'Oportunidades por etapa, metas do mês e a corrida comercial', pacotes: 'Os produtos da Vybe, com preço, entregas e carga do time',
    orcamentos: 'Propostas montadas a partir dos pacotes', financas: 'Recebido, despesas e margem de cada cliente',
    recebimentos: 'Faturas recorrentes e pontuais, uma linha por fatura', contas: 'Fixas, variáveis, folha e impostos do período',
    inadimplencia: 'Faturas vencidas e não recebidas, por cliente', caixa: 'Previsão do caixa no mês e nos 3 seguintes',
    fornecedores: 'Gráficas, estúdios e parceiros, com BV e contato', creators: 'Influenciadores de Irecê e região para as campanhas',
  };
  // Título da janela aberta por um item do dock: o nome do item (quadros 19 e 58: "CRM e funil", não "Funil").
  const TITULO = { funil: 'CRM e funil', pacotes: 'Produtos e pacotes', financas: 'Finanças por cliente' };
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
  const st = { aberto: false, aba: 'funil', dados: {}, erro: {}, carregando: {}, folha: null, ajuda: false, periodo: { tipo: 'mensal', mes: '' }, verFalta: false,
    fase: '', filtro: {}, msg: '', ocupado: false, etapasEdit: null };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = { fechar: svg('<path d="M6 6l12 12M18 6 6 18"/>'), marca: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>'), ajuda: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17h.01"/>'),
    dinheiro: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3"/>'), relogio: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'), mais: svg('<path d="M12 5v14M5 12h14"/>'), cima: svg('<path d="m6 15 6-6 6 6"/>'), baixo: svg('<path d="m6 9 6 6 6-6"/>') };
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
  const souAdminAqui = () => { try { return typeof souAdmin === 'function' && Boolean(souAdmin()); } catch { return false; } };
  // O servidor diz o que a pessoa pode; sem essa resposta (banco sem as tabelas), o palpite de dono só desenha o botão.
  const podeFazer = (d, chave) => (d?.pode && chave in d.pode ? Boolean(d.pode[chave]) : palpiteDono());
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
      const itens = d.clientes.filter((c) => c.severidade?.nivel === 'u1').map((c) => ({ nome: c.cliente_nome, sub: `${num(c.faturas)} fatura${c.faturas > 1 ? 's' : ''} · ${num(c.atraso_mais_antigo)} dia${Number(c.atraso_mais_antigo) === 1 ? '' : 's'} de atraso`, dir: din(c.valor), cls: 'u1' }));
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
  // Lançamento que veio do Vybe Finanças (id fin:…): o servidor recusa editar e dar baixa (409); a baixa é lá.
  const doFinancas = (id) => String(id || '').startsWith('fin:');
  const soNoFinancas = '<div class="vc-linha-acoes"><small class="vc-dica">Dê baixa no Vybe Finanças</small></div>';
  const fonteDa = (d) => (d?.fonte === 'Vybe Finanças' ? fonteFin() : '');
  function avisoFin(completo) {
    const e = finEstado(); if (!e) return '';
    if (e.carregando && !e.dados) return '<p class="vc-dica">Lendo os valores reais…</p>';
    if (e.erro) return `<p class="vc-aviso">Os valores reais não vieram agora: ${esc(e.erro)} Abaixo, o que está lançado no painel.</p>`;
    const d = e.dados; if (!d || d.conectado) return '';
    // Redesign (quadros 20, 56 e 59): a equipe vê o efeito em caixa neutra (não é erro), sem documentação nem passo a
    // passo; o motivo técnico e como ligar ficam em "Ver o que falta", só para quem administra.
    const tecnico = `${esc(d.motivo || 'O Vybe Finanças ainda não está ligado')}${d.aviso ? ' · ' + esc(d.aviso) : ''}${(d.passos || []).length ? `<ol>${d.passos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}`;
    if (!completo) return ativacao('', '', tecnico);
    // Quadro 59: o aviso explica o efeito para quem usa, sem nome de sistema (o nome fica no "Ver o que falta").
    return ativacao('Os valores reais chegam quando o controle financeiro for ligado', 'Até lá, a margem é estimada pelo contrato e pelas horas do time. Ligado, estas abas mostram o recebido × previsto, despesas, custos fixos, folha, margem real e inadimplência.', tecnico, IC.dinheiro);
  }
  // Parte ainda não ligada (quadro 56): caixa neutra para todos; "Ver o que falta" (o técnico, já em HTML) só para quem
  // administra. Sem título, só a linha de quem administra (as outras abas de dinheiro).
  function ativacao(titulo, texto, tecnico, icone = IC.relogio) {
    const adm = souAdminAqui() && tecnico ? `<span class="vc-nota-adm">Para quem administra: <button type="button" class="vc-sec" data-vc="falta" aria-expanded="${st.verFalta}">Ver o que falta</button></span>${st.verFalta ? `<small class="vc-nota-tec">${tecnico}</small>` : ''}` : '';
    if (!titulo) return adm ? `<div class="vc-nota vc-nota-curta" role="note"><div>${adm}</div></div>` : '';
    return `<div class="vc-nota" role="note"><span class="vc-nota-ico">${icone}</span><div><b>${esc(titulo)}</b><p>${esc(texto)}</p>${adm}</div></div>`;
  }
  const varFin = (atual, anterior) => (anterior ? Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10 : null);
  function finTopo(f) {
    const r = f.resumo, fo = f.folha, cf = f.custos_fixos, dsp = f.despesas;
    const negativas = f.margens.filter((m) => m.periodo.margem < 0).length;
    return `<div class="vc-secao"><h3>${esc(nomeMes(f.mes))}</h3>${fonteFin()}</div>
      <div class="vc-periodo">${mesHtml(f.mes, false)}</div>
      ${resumo([numero(r.recebido, din(r.recebido), ' recebido' + (r.recebido_percentual != null ? ` · ${pc(r.recebido_percentual)} do previsto` : ''), { espiar: 'financas:comercial:serie:' + f.mes, semDado: 'recebido: sem dado' }),
        numero(r.previsto, din(r.previsto), ' previsto' + (r.mensalidades_sem_lancamento ? ` · ${din(r.mensalidades_sem_lancamento)} sem lançamento` : ''), { semDado: 'previsto: sem dado' }),
        numero(r.despesas_sem_folha ?? dsp.total, din(r.despesas_sem_folha ?? dsp.total), r.despesas_sem_folha != null ? ' em outras despesas (sem a folha)' : ' em despesas do mês', { espiar: 'financas:comercial:despesas', tom: dsp.total > r.recebido && dsp.total ? 'atencao' : '', semDado: 'despesas: sem dado' }),
        numero(fo.total, din(fo.total), ` de folha do mês · ${num(fo.quantidade)} pessoa${fo.quantidade === 1 ? '' : 's'}`, { variacao: varFin(fo.total, fo.total_anterior), rotuloVar: 'vs mês anterior', semDado: 'folha: sem dado' }),
        numero(cf.total, din(cf.total), ` por mês em custos fixos · ${num(cf.quantidade)} assinatura${cf.quantidade === 1 ? '' : 's'}`, { espiar: 'financas:comercial:fixos', semDado: 'custos fixos: sem dado' }),
        numero(r.resultado, din(r.resultado), ' de resultado (recebido − pago)', { tom: r.resultado < 0 ? 'alerta' : '', semDado: 'resultado: sem dado' }),
        numero(f.inadimplencia.total, din(f.inadimplencia.total), ' em atraso', { espiar: 'financas:comercial:inad', tom: f.inadimplencia.total ? 'alerta' : '', semDado: 'nada em atraso' }),
        numero(negativas, num(negativas), negativas === 1 ? ' cliente com margem negativa (3 meses)' : ' clientes com margem negativa (3 meses)', { espiar: 'financas:comercial:margem:negativa', tom: negativas ? 'alerta' : '' })])}`;
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
  function seletorPeriodo() {
    const m = st.periodo.mes || hojeIso().slice(0, 7);
    return `<div class="vc-periodo"><div class="vc-seg" role="group" aria-label="Período">${[['mensal', 'Mensal'], ['anual', 'Anual']].map(([k, n]) => `<button type="button" data-vc-periodo="${k}" aria-pressed="${st.periodo.tipo === k}">${n}</button>`).join('')}</div>
      ${mesHtml(m, st.periodo.tipo === 'anual')}</div>`;
  }
  // Mês num seletor de período (vbMesHtml, vybe-core.js), não num campo de texto: ‹ novembro de 2026 ›.
  function mesHtml(m, ano) { return typeof vbMesHtml === 'function' ? vbMesHtml({ mes: m, max: hojeIso().slice(0, 7), attr: 'data-vc-mes-ir', ano }) : ''; }
  // Uma linha de números (vbResumoHtml; quadros 18 a 20 e 59): zero e "sem dado" discretos, o que pede ação com tom.
  function resumo(itens) {
    if (typeof vbResumoHtml === 'function') return `<div class="vc-resumo">${vbResumoHtml(itens)}</div>`;
    // Sem a peça (vybe-core.js fora): a mesma linha, e o número continua abrindo quem está nele.
    return `<div class="vc-resumo"><div class="vb-resumo">${itens.filter(Boolean).map((x) => `<span class="vb-resumo-item ${x.tom || ''}${x.espiar ? ' espiavel" data-espiar="' + esc(x.espiar) + '" role="button" tabindex="0' : ''}">${x.valor !== '' ? `<b>${esc(x.valor)}</b>` : ''}${esc(x.rotulo)}</span>`).join('')}</div></div>`;
  }
  // n = número cru (null = sem dado); texto = ele formatado; a variação (%) vai no fim do rótulo; espiar = a chave inteira.
  function numero(n, texto, rotulo, { variacao = null, rotuloVar = '', tom = '', espiar = '', semDado = '' } = {}) {
    if (n == null) return { valor: '', rotulo: semDado || `${rotulo.trim()}: sem dado`, tom: 'zero' };
    const mudou = rotuloVar && variacao ? ` · ${variacao > 0 ? '▲' : '▼'} ${pc(Math.abs(variacao))} ${rotuloVar}` : '';
    return { valor: texto, rotulo: rotulo + mudou, tom: tom || (Number(n) ? '' : 'zero'), espiar };
  }
  // A ação principal da aba no cabeçalho, uma vez (quadros 19 e 20): com a lista vazia, o botão de começar fica no vazio.
  function acaoDoTopo(d) {
    if (!d) return '';
    const b = (texto, acao) => `<button type="button" class="vc-acao vc-topo-acao" data-vc="${acao}">${IC.mais}<span>${esc(texto)}</span></button>`;
    // Funil: com a resposta do servidor, o "Novo lead" é a linha de baixo (editar_comercial); sem ela, o palpite de dono.
    if (st.aba === 'funil') return !(d.pode && 'editar_comercial' in d.pode) && palpiteDono() ? b('Novo lead', 'lead') : '';
    if (st.aba === 'pacotes') return podeFazer(d, 'editar_pacotes') && d.pacotes.length ? b('Novo pacote', 'pacote') : '';
    if (st.aba === 'orcamentos') return podeFazer(d, 'editar_comercial') && d.pacotes.length && d.orcamentos.length ? b('Novo orçamento', 'orcamento') : '';
    // Contas a pagar (quadro 20): "Nova conta" só no cabeçalho, também com a lista vazia (o vazio fica só com a frase).
    if (st.aba === 'contas') return b('Nova conta', 'conta');
    // Recebimentos (quadro 20): igual a Contas, "Novo recebimento" só no cabeçalho; o vazio aponta para ele.
    if (st.aba === 'recebimentos') return b('Novo recebimento', 'recebivel');
    return '';
  }
  const rotuloAnterior = () => (st.periodo.tipo === 'anual' ? 'vs ano anterior' : 'vs mês anterior');

  // ---------- Abas ----------
  function abaFunil(d) {
    const p = d.pode || {}, cap = d.capacidade;
    // Sem resposta do funil (banco sem as tabelas, demonstração), as fases padrão zeradas: o funil aparece como funil.
    const padrao = (() => { try { return { fases: C().FASES, resumo: C().resumoFunil([]) }; } catch { return { fases: [], resumo: { fases: [], motivos_perda: [] } }; } })();
    const fases = d.fases.length ? d.fases : padrao.fases;
    const r = d.resumo.fases.length ? d.resumo : { ...padrao.resumo, ...d.resumo, fases: padrao.resumo.fases, motivos_perda: d.resumo.motivos_perda.length ? d.resumo.motivos_perda : padrao.resumo.motivos_perda || [] };
    const etapaNome = (id) => d.etapas.find((e) => e.id === id)?.nome || id;
    const faseDe = (etapa) => fases.find((f) => (f.etapas || []).includes(etapa))?.id;
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
    // Redesign (quadro 58, 10/11/2026): o funil aparece como funil, uma coluna por fase, mesmo vazia. Os motivos de perda
    // viram o filtro da coluna Perdido (com a quantidade e o % de cada um); o funil do mês (metas, gráficos) vem depois.
    const motivoSel = st.filtro.motivo || '';
    const perdidas = r.fases.find((f) => f.id === 'perdido')?.atual;
    const coluna = (f) => {
      let ops = d.oportunidades.filter((o) => faseDe(o.etapa) === f.id);
      let filtro = '';
      if (f.id === 'perdido') {
        const comMotivo = r.motivos_perda.filter((m) => m.quantidade);
        if (motivoSel) ops = ops.filter((o) => o.motivo_perda === motivoSel);
        filtro = comMotivo.length ? `<div class="vc-funil-filtro" role="group" aria-label="Filtrar perdidas por motivo">
          <button type="button" class="vc-chip" data-vc-motivo="" aria-pressed="${!motivoSel}">Todos <b>${num(perdidas)}</b></button>
          ${comMotivo.map((m) => `<button type="button" class="vc-chip" data-vc-motivo="${esc(m.id)}" aria-pressed="${motivoSel === m.id}" title="${esc(pc(m.percentual))} das perdas">${esc(m.nome)} <b>${num(m.quantidade)}</b><small>${pc(m.percentual)}</small></button>`).join('')}</div>` : '';
      }
      const vazioCol = f.id === 'novo' ? 'Nenhuma empresa nova. O SDR propõe pelo CRM do 1º andar.' : f.id === 'perdido' ? (motivoSel ? 'Nenhuma perda com este motivo.' : 'Nenhuma perda registrada. O motivo de cada uma aparece aqui.') : 'Nenhuma oportunidade nesta fase.';
      return `<section class="vc-coluna${f.id === 'perdido' ? ' perdido' : f.id === 'ganho' ? ' ganho' : ''}" aria-label="${esc(f.nome)}: ${num(f.atual)}">
        <header><b>${esc(f.nome)}</b><span class="vc-coluna-n">${num(f.atual)}</span>${f.conversao != null ? `<small>${pc(f.conversao)} seguem</small>` : f.alcancaram != null && f.id !== 'perdido' ? `<small>${num(f.alcancaram)} chegaram</small>` : ''}</header>
        ${filtro}<div class="vc-coluna-lista">${ops.length ? ops.map(card).join('') : `<p class="vc-coluna-vazia">${esc(vazioCol)}</p>`}</div></section>`;
    };
    const neg = r.em_negociacao, abertas = Number(neg.quantidade) || 0;
    return `<div class="vc-secao"><h3>Funil agora</h3>${p.editar_pacotes ? '<button type="button" class="vc-link" data-vc="etapas">Configurar etapas</button>' : ''}</div>
      ${resumo([numero(neg.mensal, din(neg.mensal), ' por mês em negociação', { semDado: 'em negociação (mensal): sem valor' }), numero(neg.avulso, din(neg.avulso), ' avulso em negociação', { semDado: 'em negociação (avulso): sem valor' }),
        numero(abertas, num(abertas), abertas === 1 ? ' aberta' : ' abertas'), numero(r.taxa_ganho, pc(r.taxa_ganho), ' de taxa de ganho', { semDado: 'taxa de ganho: sem negócio fechado ainda' })])}
      ${d.valor_disponivel ? '' : ativacao('O valor da negociação ainda não foi ligado', 'Valor, follow-up e as etapas novas aparecem aqui quando estiverem ligados; o funil já funciona. Os donos já sabem o que falta.', 'Falta aplicar a migração <code>2026-11-07-comercial.sql</code> no banco.')}
      ${d.produtos?.campeao ? `<p class="vc-dica">Produto campeão: <b>${esc(d.produtos.campeao.nome)}</b> (${num(d.produtos.campeao.ganhos)} ganhos) · ticket médio ${din(d.produtos.ticket_medio_mensal)}/mês${d.produtos.ticket_medio_avulso ? ' · ' + din(d.produtos.ticket_medio_avulso) + ' avulso' : ''}</p>` : ''}
      <div class="vc-funil" aria-label="Fases do funil">${r.fases.map(coluna).join('')}</div>
      <p class="vc-dica">O SDR propõe empresas pelo CRM do 1º andar; avance uma etapa por vez pelos botões de cada cartão.</p>
      ${blocoMes(d)}`;
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
    // Barras estreitas (auditoria 09/11: rótulos sobrepostos em Finanças por cliente): um número por mês, o da barra mais
    // alta, em cima do par; se nem assim cabe, um mês sim, um não (o último sempre). O valor de cada barra fica no passar o mouse.
    const txt = (s, v) => (s.curto ? s.curto(v) : s.fmt(v));
    const largTxt = Math.max(...meses.flatMap((m) => series.map((s) => txt(s, Number(m[s.chave]) || 0).length))) * 6.4;
    const apertado = n > 1 && largTxt > bw + 2, pula = largTxt > passo - 2;
    const barras = meses.map((m, i) => {
      const x0 = i * passo + passo / 2 - (n * bw + (n - 1) * 4) / 2;
      const maior = series.reduce((a, s, j) => ((Number(m[s.chave]) || 0) > (Number(m[series[a].chave]) || 0) ? j : a), 0);
      const comNumero = !pula || (meses.length - 1 - i) % 2 === 0;
      return series.map((s, j) => {
        const v = Number(m[s.chave]) || 0, h = v > 0 ? Math.max(2, (v / max) * alto) : 0, x = x0 + j * (bw + 4);
        const esp = espiar ? ` data-espiar="${String(espiar(m.mes, s.chave)).startsWith('financas:') ? '' : 'comercial:'}${esc(espiar(m.mes, s.chave))}" tabindex="0" role="button" aria-label="${esc(s.rotulo + ' em ' + nomeMes(m.mes) + ': ' + s.fmt(v))}"` : '';
        return `<g class="vc-g-barra"${esp}><title>${esc(s.rotulo)} · ${esc(nomeMes(m.mes))}: ${esc(s.fmt(v))}</title><rect x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="4" class="${s.cls}"/>
          ${comNumero && (!apertado || j === maior) && v > 0 ? `<text x="${apertado ? x0 + (n * bw + (n - 1) * 4) / 2 : x + bw / 2}" y="${base - h - 5}" text-anchor="middle" class="valor">${esc(txt(s, v))}</text>` : ''}</g>`;
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
    // Zero vira uma linha (00 Main, regra 4): os números do mês numa linha de resumo, cada um abrindo quem está nele.
    const kp = resumo([numero(k.atual.leads ?? 0, num(k.atual.leads), Number(k.atual.leads) === 1 ? ' lead novo' : ' leads novos', { variacao: k.variacao.leads, rotuloVar: rv, espiar: 'comercial:funil:leads' }),
      numero(k.atual.propostas ?? 0, num(k.atual.propostas), Number(k.atual.propostas) === 1 ? ' proposta enviada' : ' propostas enviadas', { variacao: k.variacao.propostas, rotuloVar: rv, espiar: 'comercial:funil:propostas' }),
      numero(k.atual.negocios ?? 0, num(k.atual.negocios), Number(k.atual.negocios) === 1 ? ' negócio fechado' : ' negócios fechados', { variacao: k.variacao.negocios, rotuloVar: rv, espiar: 'comercial:funil:fechados' }),
      val ? numero(k.atual.mrr ?? 0, din(k.atual.mrr ?? 0), ' por mês fechado (MRR)', { variacao: k.variacao.mrr, rotuloVar: rv, espiar: 'comercial:funil:fechados' }) : null,
      val ? numero(k.atual.avulso ?? 0, din(k.atual.avulso ?? 0), ' fechado avulso', { variacao: k.variacao.avulso, rotuloVar: rv, espiar: 'comercial:funil:fechados' }) : null]);
    const graficos = m.series.length ? grafico({ meses: m.series, aria: 'Leads novos por mês, últimos 6 meses', espiar: (mes) => 'funil:leads:' + mes,
        series: [{ chave: 'leads', cls: 'lead', rotulo: 'Leads novos', fmt: num }] })
      + (val ? grafico({ meses: m.series, aria: 'Valor fechado por mês (MRR e avulso), últimos 6 meses', espiar: (mes) => 'funil:fechados:' + mes,
        series: [{ chave: 'mrr', cls: 'mrr', rotulo: 'MRR fechado (R$/mês)', fmt: din, curto }, { chave: 'avulso', cls: 'avu', rotulo: 'Avulso fechado (R$)', fmt: din, curto }] })
        : grafico({ meses: m.series, aria: 'Negócios fechados por mês, últimos 6 meses', espiar: (mes) => 'funil:fechados:' + mes, series: [{ chave: 'negocios', cls: 'mrr', rotulo: 'Negócios fechados', fmt: num }] })) : '';
    return `${seletorPeriodo()}${m.config_disponivel === false ? ativacao('As metas e o formulário de leads ainda não foram ligados', 'Quando estiverem ligados, as metas do mês e o link do formulário aparecem aqui.', esc(m.aviso_config || 'Falta a migração das metas e do formulário de leads.')) : ''}
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
    const ganhos = Number(pr.ganhos) || 0;
    return `${resumo([pr.campeao ? { valor: pr.campeao.nome, rotulo: ' é o produto campeão' } : { valor: '', rotulo: 'produto campeão: sem negócio ganho ainda', tom: 'zero' },
        numero(pr.ticket_medio_mensal, din(pr.ticket_medio_mensal), ' de ticket médio mensal', { semDado: 'ticket médio mensal: sem dado' }), numero(pr.ticket_medio_avulso, din(pr.ticket_medio_avulso), ' de ticket médio avulso', { semDado: 'ticket médio avulso: sem dado' }),
        numero(ganhos, num(ganhos), ganhos === 1 ? ' negócio ganho' : ' negócios ganhos')])}
      <div class="vc-secao"><h3>Pacotes</h3></div>
      <div class="vc-lista grade">${lista || vazio('Nenhum pacote ainda. Cadastre a esteira de produtos da Vybe: os orçamentos e a carga do time saem daqui.', podeFazer(d, 'editar_pacotes') ? 'Cadastrar o primeiro pacote' : '', 'pacote')}</div>
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
    // Auditoria 09/11 (uma porta só): a calculadora solta mora no Toolkit; aqui fica a do orçamento, recolhida, para sair na proposta.
    return `<details class="vc-roi vc-roi-det"${r.orc || r.investimento ? ' open' : ''}><summary>ROI na proposta</summary><div class="vc-secao"><h3>Retorno para o cliente</h3>${orcs.length ? `<select class="vc-mini" data-vc-roi-orc aria-label="Usar o valor de um orçamento"><option value="">Usar o valor de um orçamento…</option>${orcs.map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(r.orc) ? ' selected' : ''}>${esc(o.cliente_nome)} · ${din(o.totais.total_recorrente)}/mês</option>`).join('')}</select>` : ''}</div>
      <div class="vc-roi-campos">${campo('investimento', 'Investimento mensal (R$)', '2.500')}${campo('ticket', 'Ticket de uma venda do cliente (R$)', '180')}${campo('margem', 'Margem do cliente por venda (%)', '35')}${campo('vendas', 'Vendas a mais por mês (estimativa)', '60')}</div>
      ${res}${calc && r.orc ? '<p class="vc-dica">Este cálculo sai na proposta impressa do orçamento escolhido.</p>' : ''}</details>`;
  }
  function abaOrcamentos(d) {
    const p = d.pode || {};
    // Sem pacote ativo (auditoria 11/11, quadro 19): um botão leva à aba Pacotes, em vez de só o texto; o título
    // "Orçamentos" já está no cabeçalho da janela e saiu do corpo.
    const semPacote = !d.pacotes.length;
    return `${semPacote && d.orcamentos.length ? `<div class="vc-sem-pacote"><p class="vc-dica">Sem pacotes ativos: os donos cadastram na aba Pacotes.</p><button type="button" class="vc-sec" data-vc="ir-pacotes">Ir para Pacotes</button></div>` : ''}
      <div class="vc-lista">${d.orcamentos.map((o) => `<article class="vc-cartao"><div class="vc-cartao-topo"><b>${esc(o.cliente_nome)}</b>${pill(...(STATUS_ORC[o.status] || [o.status]))}</div>
        <p class="vc-grande">${o.totais.total_recorrente ? din(o.totais.total_recorrente) + '<small>/mês</small>' : ''}${o.totais.total_recorrente && o.totais.total_avulso ? ' + ' : ''}${o.totais.total_avulso ? din(o.totais.total_avulso) + '<small> avulso</small>' : ''}</p>
        <small>${o.itens.map((i) => `${num(i.quantidade)}× ${esc(i.nome)}`).join(' · ')}${o.desconto_percentual ? ' · desconto ' + pc(o.desconto_percentual) : ''} · válido até ${data(o.validade)}${o.validade < hojeIso() ? ' (vencido)' : ''}</small>
        <div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="imprimir" data-id="${esc(o.id)}">Imprimir</button>
        ${p.editar_comercial ? `<select class="vc-mini" data-vc-status-orc="${esc(o.id)}" aria-label="Status do orçamento">${Object.entries(STATUS_ORC).map(([k, [n]]) => `<option value="${k}"${k === o.status ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}</div></article>`).join('')
        || (semPacote ? vazio('Nenhum orçamento ainda. O orçamento sai dos pacotes, e ainda não há pacote ativo: os donos cadastram na aba Pacotes.', 'Ir para Pacotes', 'ir-pacotes')
          : vazio('Nenhum orçamento ainda. Monte o primeiro a partir dos pacotes.', p.editar_comercial ? 'Novo orçamento' : '', 'orcamento'))}</div>
      ${d.orcamentos.length ? roiHtml(d) : ''}`;
  }
  // Redesign (quadro 59): os clientes ativos aparecem mesmo sem contrato. O servidor já manda todos os ativos; sem
  // resposta dele (banco sem a tabela, demonstração), a lista é o cadastro de clientes do painel, todos "sem contrato".
  function clientesDaAba(d) {
    if (d.clientes.length) return d.clientes;
    const cad = typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : [];
    return cad.filter((c) => c && c.id && c.nome && c.ativo !== false).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
      .map((c) => ({ cliente_id: String(c.id), cliente_nome: c.nome, valor_mensal: 0, pacote_id: null, pacote_nome: null, status_pagamento: 'em_dia', observacao: '', versao: '', custo: null, margem_percentual: null, zona_critica: false }));
  }
  function abaFinancas(d) {
    const r = d.resumo, f = fin();
    // Com o Finanças: o dinheiro de verdade em cima; os cartões dos clientes ficam (pacote, custo estimado e status à mão).
    // Redesign (quadro 59): os seis números numa linha de resumo; o que pede ação ganha o tom, zero fica discreto.
    // Redesign (quadro 59, 2ª rodada): os números do topo entram na tabela. Cada cliente é uma linha (Contrato, Custo
    // estimado, Margem, Pagamento) e o total de cada coluna fica no rodapé dela: receita, custo, margem e as contagens de
    // zona crítica, atrasados e inadimplentes (com o mesmo "quem está neste número").
    const cri = Number(r.criticas) || 0, atr = Number(r.pagamento.atrasado) || 0, ina = Number(r.pagamento.inadimplente) || 0;
    const topo = f ? `${finTopo(f)}${finGraficos(f)}${finMargens(f)}<div class="vc-secao"><h3>Pacote e margem estimada por cliente (Vybe OS)</h3></div>` : avisoFin(true);
    const real = (c) => { const m = margemFinDe(f, c.cliente_id); return m ? `<small>Margem real (Vybe Finanças): ${din(m.mes.margem)} no mês · ${din(m.periodo.margem)} em 3 meses</small>` : ''; };
    const conta = (n, um, varios, chave, tom) => `<span class="vc-tab-conta${n ? ' ' + tom : ''}" data-espiar="${chave}" role="button" tabindex="0">${n ? `<b>${num(n)}</b>` : num(n)} ${n === 1 ? um : varios}</span>`;
    const todos = clientesDaAba(d), lista = todos.filter((c) => !st.filtro.financas || norm(c.cliente_nome).includes(norm(st.filtro.financas)));
    const linha = (c) => {
      const sem = !c.valor_mensal && c.status_pagamento === 'em_dia';
      return `<tr${c.zona_critica ? ' class="critico"' : ''}>
        <th scope="row" data-rot="Cliente">${cliCor(c.cliente_nome)}${c.observacao ? `<small>${esc(c.observacao)}</small>` : ''}</th>
        <td data-rot="Contrato">${c.valor_mensal ? `${din(c.valor_mensal)}<small>/mês</small>` : '<span class="vc-tab-vazio">—</span>'}</td>
        <td data-rot="Custo estimado">${c.pacote_nome ? `${din(c.custo)}<small>${esc(c.pacote_nome)}</small>` : '<span class="vc-tab-vazio">sem pacote</span>'}</td>
        <td data-rot="Margem">${c.margem_percentual != null ? pc(c.margem_percentual) : '<span class="vc-tab-vazio">—</span>'}${c.zona_critica ? pill('Zona crítica', 'u1') : ''}${real(c)}</td>
        <td data-rot="Pagamento">${sem ? pill('sem contrato', 'u5') : pill(...(STATUS_PAG[c.status_pagamento] || STATUS_PAG.em_dia))}</td>
        <td class="vc-tab-acao"><button type="button" class="vc-sec" data-vc="financas" data-id="${esc(c.cliente_id)}" aria-label="Editar ${esc(c.cliente_nome)}">Editar</button></td></tr>`;
    };
    const rodape = `<tfoot><tr>
        <th scope="row" data-rot="Total">${todos.length === 1 ? '1 cliente ativo' : `${num(todos.length)} clientes ativos`}</th>
        <td data-rot="Contrato">${r.receita ? `<b>${din(r.receita)}</b><small>por mês</small>` : '<span class="vc-tab-vazio">nenhum contrato informado</span>'}</td>
        <td data-rot="Custo estimado">${r.custo ? `<b>${din(r.custo)}</b><small>estimado</small>` : '<span class="vc-tab-vazio">sem pacote</span>'}</td>
        <td data-rot="Margem">${r.margem_percentual != null ? `<b class="${r.margem_percentual < d.zona_critica ? 'vc-ruim' : ''}">${pc(r.margem_percentual)}</b>` : '<span class="vc-tab-vazio">sem contrato e pacote</span>'}${conta(cri, 'em zona crítica', 'em zona crítica', 'comercial:financas:critica', 'alerta')}</td>
        <td data-rot="Pagamento">${conta(atr, 'atrasado', 'atrasados', 'comercial:financas:atrasado', 'atencao')}${conta(ina, 'inadimplente', 'inadimplentes', 'comercial:financas:inadimplente', 'alerta')}</td>
        <td></td></tr></tfoot>`;
    return `${topo}
      <input type="search" class="vc-busca" data-vc-busca="financas" placeholder="Buscar cliente" value="${esc(st.filtro.financas || '')}" aria-label="Buscar cliente">
      ${todos.length ? `<div class="vc-tabela-rola"><table class="vc-tabela vc-tab-financas">
        <thead><tr><th scope="col">Cliente</th><th scope="col">Contrato</th><th scope="col">Custo estimado</th><th scope="col">Margem</th><th scope="col">Pagamento</th><th scope="col"><span class="vc-sr">Ações</span></th></tr></thead>
        <tbody>${lista.map(linha).join('') || `<tr><td colspan="6" class="vc-tab-nada">Nenhum cliente com "${esc(st.filtro.financas)}".</td></tr>`}</tbody>${rodape}</table></div>`
        : vazio('Nenhum cliente ativo no cadastro.')}`;
  }
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function abaRecebimentos(d) {
    const r = d.resumo, v = r.variacao, rv = rotuloAnterior();
    // Redesign (quadro 20 e 00 Main, regra 4): os quatro números numa linha (zero e "sem dado" discretos, inadimplente
    // com tom); "Novo recebimento" só no cabeçalho, como em Contas a pagar.
    const a = r.atual, inad = Number(a.inadimplente) || 0, pend = Number(a.pendente) || 0;
    return `${seletorPeriodo()}${resumo([numero(a.a_receber, din(a.a_receber), ' a receber', { variacao: v.a_receber, rotuloVar: rv, semDado: 'nenhum recebimento lançado no período' }),
        numero(a.recebido, din(a.recebido), ' recebido', { variacao: v.recebido, rotuloVar: rv, semDado: 'recebido: sem dado' }),
        numero(a.pendente, din(a.pendente), ' pendente', { variacao: v.pendente, rotuloVar: rv, tom: pend ? 'atencao' : '', semDado: 'pendente: sem dado' }),
        numero(a.inadimplente, din(a.inadimplente), ' inadimplente', { variacao: v.inadimplente, rotuloVar: rv, tom: inad ? 'alerta' : '', semDado: 'inadimplente: sem dado' })])}
      <div class="vc-secao"><h3>${esc(d.periodo.tipo === 'anual' ? d.periodo.rotulo : nomeMes(d.periodo.mes))}</h3>${fonteDa(d)}</div>
      <div class="vc-lista">${d.recebiveis.map((x) => { const [n, u] = STATUS_REC[x.status] || [x.status]; return `<article class="vc-cartao">
        <div class="vc-cartao-topo"><b>${esc(x.tipo === 'recorrente' ? x.cliente_nome || 'Cliente' : x.descricao)}</b>${pill(n, u)}</div>
        <p class="vc-grande">${din(x.valor)}${x.valor_recebido && x.status !== 'recebido' ? `<small> · recebido ${din(x.valor_recebido)}</small>` : ''}</p>
        <small>${x.tipo === 'recorrente' ? 'Recorrente ' + esc(x.ciclo) : 'Pontual'}${x.categoria ? ' · ' + esc(x.categoria) : ''}${x.tipo === 'recorrente' && x.descricao ? ' · ' + esc(x.descricao) : ''} · vence ${data(x.vencimento)}${x.atraso ? ` · ${num(x.atraso)} dia${Number(x.atraso) === 1 ? '' : 's'} de atraso` : ''}${x.recebido_em ? ' · recebido em ' + data(x.recebido_em) : ''}</small>
        ${x.cancelado ? '' : doFinancas(x.id) ? soNoFinancas : `<div class="vc-linha-acoes">${x.status !== 'recebido' ? `<button type="button" class="vc-sec" data-vc="receber" data-id="${esc(x.id)}">Receber</button>` : ''}
          ${x.tipo === 'recorrente' ? `<button type="button" class="vc-sec" data-vc="proximo" data-id="${esc(x.id)}">Próximo ciclo</button>` : ''}
          <button type="button" class="vc-sec" data-vc="recebivel" data-id="${esc(x.id)}">Editar</button><button type="button" class="vc-perigo" data-vc="cancelar-rec" data-id="${esc(x.id)}">Cancelar</button></div>`}</article>`; }).join('')
        || vazio('Nenhum recebimento neste período. Lance os contratos recorrentes e os pontuais pelo botão do alto da tela.')}</div>`;
  }
  function abaContas(d) {
    const r = d.resumo, rv = rotuloAnterior(), f = fin();
    // Redesign (quadro 20): os quatro números numa linha; a barra diz para onde vai o dinheiro, com a % escrita.
    const vq = Number(r.vencidas.quantidade) || 0, sq = Number(r.sete_dias.quantidade) || 0;
    const doVybe = `${resumo([numero(r.total || null, din(r.total), ' em contas no período', { variacao: r.variacao_total, rotuloVar: rv, semDado: 'nenhuma conta lançada no período' }),
        numero(vq, num(vq), `${vq === 1 ? ' vencida' : ' vencidas'} sem pagar${vq ? ' · ' + din(r.vencidas.total) : ''}`, { tom: vq ? 'alerta' : '' }),
        numero(sq, num(sq), `${sq === 1 ? ' vence' : ' vencem'} em 7 dias${sq ? ' · ' + din(r.sete_dias.total) : ''}`, { tom: sq ? 'atencao' : '' }),
        numero(r.total || d.faturamento ? r.resultado : null, din(r.resultado), ' de resultado (faturamento − contas)', { variacao: C().variacao(r.resultado, r.resultado_anterior), rotuloVar: rv, tom: r.resultado < 0 ? 'alerta' : '', semDado: 'resultado: sem faturamento nem contas' })])}
      ${paraOndeVai(r)}
      <ul class="vc-grupos">${r.grupos.map((g) => `<li><b>${esc(g.nome)}</b><span>${din(g.total)}</span><small>${pc(g.percentual_faturamento)} do faturamento${g.variacao != null ? ` · ${g.variacao > 0 ? '▲' : g.variacao < 0 ? '▼' : '='} ${pc(Math.abs(g.variacao))} ${rv}` : ''}</small></li>`).join('')}</ul>
      <p class="vc-dica">Faturamento do período (a receber): ${din(d.faturamento)}.</p>`;
    let doFin = '';
    if (f) {
      const dsp = f.despesas, max = Math.max(1, ...dsp.categorias.map((c) => c.total)), cf = f.custos_fixos;
      doFin = `<div class="vc-secao"><h3>Despesas de ${esc(nomeMes(f.mes))}</h3>${fonteFin()}</div>
        ${resumo([numero(f.resumo.despesas_sem_folha ?? dsp.total, din(f.resumo.despesas_sem_folha ?? dsp.total), f.resumo.despesas_sem_folha != null ? ' em outras despesas (sem a folha)' : ' em despesas do mês', { espiar: 'financas:comercial:despesas', semDado: 'despesas: sem dado' }),
          numero(f.resumo.despesas_pagas, din(f.resumo.despesas_pagas), ' pagas', { semDado: 'pagas: sem dado' }),
          numero(f.resumo.despesas_pendentes, din(f.resumo.despesas_pendentes), ' pendentes', { tom: f.resumo.despesas_pendentes ? 'atencao' : '', semDado: 'pendentes: sem dado' }),
          numero(f.folha.total, din(f.folha.total), ' de folha do mês', { semDado: 'folha: sem dado' }),
          numero(cf.total, din(cf.total), ' por mês em custos fixos (assinaturas)', { espiar: 'financas:comercial:fixos', semDado: 'custos fixos: sem dado' })])}
        ${dsp.categorias.length ? `<ul class="vc-barras espiavel" data-espiar="financas:comercial:despesas" role="button" tabindex="0">${dsp.categorias.map((c) => `<li><span>${esc(c.categoria)}</span><span class="vc-barra"><i class="u2" style="width:${(c.total / max) * 100}%"></i></span><small>${din(c.total)} · ${pc(c.percentual)}</small></li>`).join('')}</ul>`
          : vazio('Nenhuma despesa lançada no Finanças neste mês.')}
        ${cf.itens.length ? `<div class="vc-secao"><h3>Custos fixos</h3><small>${num(cf.quantidade)} assinatura${cf.quantidade === 1 ? '' : 's'} ativa${cf.quantidade === 1 ? '' : 's'}</small></div>
          <ul class="vc-grupos">${cf.itens.slice(0, 8).map((s) => `<li><b>${esc(s.nome)}</b><span>${din(s.custo)}</span><small>${s.dia_renovacao ? 'renova dia ' + num(s.dia_renovacao) : 'sem dia de renovação'}</small></li>`).join('')}</ul>` : ''}
        <p class="vc-dica">Os números acima vêm do Vybe Finanças. Abaixo, as contas lançadas à mão no Vybe OS (continuam editáveis).</p>`;
    }
    return `${seletorPeriodo()}${f ? doFin : avisoFin(false) + doVybe}
      <div class="vc-secao"><h3>${f ? 'Contas lançadas no Vybe OS' : 'Contas'}</h3></div>
      <div class="vc-lista">${d.contas.map((c) => { const venc = !c.pago_em && !c.cancelada && c.vencimento < d.hoje; return `<article class="vc-cartao">
        <div class="vc-cartao-topo"><b>${esc(c.descricao)}</b>${c.cancelada ? pill('Cancelada', 'u5') : c.pago_em ? pill('Paga', 'u6') : venc ? pill('Vencida', 'u1') : pill('A pagar', 'u4')}</div>
        <p class="vc-grande">${din(c.valor)}</p><small>${esc(r.grupos.find((g) => g.id === c.grupo)?.nome || c.grupo)}${c.fornecedor_nome ? ' · ' + esc(c.fornecedor_nome) : ''} · vence ${data(c.vencimento)}${c.pago_em ? ' · paga em ' + data(c.pago_em) : ''}</small>
        ${c.cancelada || c.pago_em ? '' : doFinancas(c.id) ? soNoFinancas : `<div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="pagar" data-id="${esc(c.id)}">Marcar paga</button><button type="button" class="vc-sec" data-vc="conta" data-id="${esc(c.id)}">Editar</button><button type="button" class="vc-perigo" data-vc="cancelar-conta" data-id="${esc(c.id)}">Cancelar</button></div>`}</article>`; }).join('')
        || vazio('Nenhuma conta neste período. Lance fixas, variáveis, folha, impostos e investimentos pelo botão do alto da tela.')}</div>`;
  }
  // Para onde vai o dinheiro: uma faixa por grupo de conta, com a % do total escrita (não só a cor).
  const CORES_GRUPO = ['#1D4ED8', '#5B4BD6', '#E0A21B', '#8A847A', '#0F766E', '#B42318'];
  function paraOndeVai(r) {
    const grupos = r.grupos.filter((g) => Number(g.total) > 0), total = grupos.reduce((t, g) => t + Number(g.total), 0);
    if (!total) return '<p class="vc-dica">Para onde vai o dinheiro: a divisão entre fixas, folha, variáveis e impostos aparece com a primeira conta lançada.</p>';
    const fatias = grupos.map((g, i) => ({ nome: g.nome, cor: CORES_GRUPO[i % CORES_GRUPO.length], pct: Math.round((Number(g.total) / total) * 1000) / 10 }));
    return `<div class="vc-fixo"><b>Para onde vai o dinheiro</b>
      <span class="vc-divisao" role="img" aria-label="${esc(fatias.map((x) => `${x.nome} ${pc(x.pct)}`).join(', '))}">${fatias.map((x) => `<i style="width:${x.pct}%;background:${x.cor}"></i>`).join('')}</span>
      <span class="vc-divisao-leg">${fatias.map((x) => `<span><i style="background:${x.cor}"></i>${esc(x.nome)} ${pc(x.pct)}</span>`).join('')}</span>
      <small>Fixo ${din(r.fixo)} (${pc(r.fixo_percentual)} do faturamento) · Variável ${din(r.variavel)} (${pc(r.variavel_percentual)})</small></div>`;
  }
  function abaInadimplencia(d) {
    const f = fin();
    // Redesign (quadro 20 e 00 Main, regra 4): os quatro números numa linha; o crítico continua abrindo quem está nele.
    const nCli = d.clientes.length, nFat = d.faturas.length, crit = Number(d.criticos) || 0;
    const doVybe = `${resumo([numero(d.total, din(d.total), ' em atraso', { tom: d.total ? 'alerta' : '', semDado: 'nada em atraso' }),
        numero(nCli, num(nCli), nCli === 1 ? ' cliente' : ' clientes'),
        numero(crit, num(crit), crit === 1 ? ' crítico (+30 dias)' : ' críticos (+30 dias)', { tom: crit ? 'alerta' : '', espiar: 'comercial:inadimplencia:criticos' }),
        numero(nFat, num(nFat), nFat === 1 ? ' fatura' : ' faturas')])}
      <div class="vc-secao"><h3>Clientes em atraso</h3></div>
      <div class="vc-lista">${d.clientes.map((c) => `<article class="vc-cartao barra-${c.severidade.nivel}"><div class="vc-cartao-topo"><b>${cliCor(c.cliente_nome)}</b>${pill(c.severidade.nome, c.severidade.nivel)}</div>
        <p class="vc-grande">${din(c.valor)}</p><small>${num(c.faturas)} fatura${c.faturas > 1 ? 's' : ''} · atraso mais antigo ${num(c.atraso_mais_antigo)} dia${Number(c.atraso_mais_antigo) === 1 ? '' : 's'} (venceu ${data(c.vencimento_mais_antigo)})</small></article>`).join('')
        || vazio('Ninguém em atraso. As faturas vencidas e não recebidas aparecem aqui.', 'Ver recebimentos', 'ir-recebimentos')}</div>`;
    let doFin = '';
    if (f) {
      const i = f.inadimplencia;
      doFin = `<div class="vc-secao"><h3>Receitas vencidas e não pagas</h3>${fonteFin()}</div>
        ${resumo([numero(i.total, din(i.total), ' em atraso', { tom: i.total ? 'alerta' : '', espiar: 'financas:comercial:inad', semDado: 'nada em atraso' }),
          numero(i.clientes.length, num(i.clientes.length), i.clientes.length === 1 ? ' cliente' : ' clientes', { espiar: 'financas:comercial:inad' }),
          numero(Number(i.criticos) || 0, num(i.criticos), Number(i.criticos) === 1 ? ' crítico (+30 dias)' : ' críticos (+30 dias)', { tom: i.criticos ? 'alerta' : '', espiar: 'financas:comercial:inad' }),
          numero(Number(i.faturas) || 0, num(i.faturas), Number(i.faturas) === 1 ? ' lançamento' : ' lançamentos')])}
        <div class="vc-lista">${i.clientes.map((c) => { const s = C().severidade(c.atraso_mais_antigo); return `<article class="vc-cartao barra-${s.nivel}"><div class="vc-cartao-topo"><b>${cliCor(c.cliente_nome)}</b>${pill(s.nome, s.nivel)}${c.no_vybe || !c.cliente_id && c.cliente_nome === 'Sem cliente' ? '' : pill('Sem par no Vybe OS', 'u5')}</div>
          <p class="vc-grande">${din(c.valor)}</p><small>${num(c.faturas)} lançamento${c.faturas > 1 ? 's' : ''} · atraso mais antigo ${num(c.atraso_mais_antigo)} dia${Number(c.atraso_mais_antigo) === 1 ? '' : 's'} (venceu ${data(c.vencimento_mais_antigo)})${c.descricao ? ' · ' + esc(c.descricao) : ''}</small></article>`; }).join('')
          || vazio('Ninguém em atraso no Vybe Finanças.')}</div>`;
    }
    return `${f ? doFin : avisoFin(false) + doVybe}
      ${d.faturas.length ? `<div class="vc-secao"><h3>${f ? 'Faturas atrasadas lançadas no Vybe OS' : 'Faturas atrasadas'}</h3></div><div class="vc-lista">${d.faturas.map((f) => `<article class="vc-cartao barra-${f.severidade.nivel}"><div class="vc-cartao-topo"><b>${esc(f.cliente_nome || f.descricao)}</b>${pill(num(f.atraso) + ' dias', f.severidade.nivel)}</div><small>${din(f.aberto)} em aberto · venceu ${data(f.vencimento)}</small>
        ${doFinancas(f.id) ? soNoFinancas : `<div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="receber" data-id="${esc(f.id)}">Receber</button></div>`}</article>`).join('')}</div>` : ''}
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
  // O que o fornecedor está imprimindo agora (Impressões, servidor #547): abertas, atrasadas e entregues.
  const impressoesDoFornecedor = (f) => {
    const i = f.impressoes; if (!i || !(i.abertas || i.entregues)) return '';
    return `<small class="vc-impressoes">Impressões: ${num(i.abertas)} aberta${i.abertas === 1 ? '' : 's'}${i.atrasadas ? ` · <b class="t-u1">${num(i.atrasadas)} atrasada${i.atrasadas === 1 ? '' : 's'}</b>` : ''} · ${num(i.entregues)} entregue${i.entregues === 1 ? '' : 's'}</small>`;
  };
  function abaFornecedores(d) {
    const cat = st.filtro.categoria || '', lista = C().filtrarFornecedores(d.fornecedores.filter((f) => f.ativo), { categoria: cat, busca: st.filtro.forn || '' });
    const nomeCat = (id) => d.categorias.find((c) => c.id === id)?.nome || id;
    // Quadros 17 e 49 (10/11/2026): o título e "Novo fornecedor" ficam no cabeçalho da janela; o filtro por tipo leva a
    // contagem dos ativos de cada categoria.
    const ativos = d.fornecedores.filter((f) => f.ativo), porCat = (id) => ativos.filter((f) => f.categoria === id).length;
    const chipCat = (id, nome, n) => `<button type="button" data-vc-cat="${esc(id)}" aria-pressed="${cat === id}">${esc(nome)} <em>${num(n)}</em></button>`;
    return `<div class="vc-filtros" role="group" aria-label="Tipo de fornecedor">${chipCat('', 'Todos', ativos.length)}${d.categorias.map((c) => chipCat(c.id, c.nome, porCat(c.id))).join('')}</div>
      <input type="search" class="vc-busca" data-vc-busca="forn" placeholder="Buscar fornecedor ou contato" value="${esc(st.filtro.forn || '')}" aria-label="Buscar fornecedor">
      <div class="vc-lista">${lista.map((f) => `<article class="vc-cartao"><div class="vc-cartao-topo"><b>${esc(f.nome)}</b>${pill(nomeCat(f.categoria), 'u4')}</div>
        <small>BV ${pc(f.bv_percentual)}${f.contato ? ' · ' + esc(f.contato) : ''}${f.cidade ? ` · ${esc(f.cidade)}${f.uf ? '/' + esc(f.uf) : ''}` : ''}${f.telefone ? ' · ' + esc(f.telefone) : ''}</small>${f.observacoes ? `<small>${esc(f.observacoes)}</small>` : ''}${impressoesDoFornecedor(f)}
        <div class="vc-linha-acoes">${(f.impressoes?.abertas || f.impressoes?.entregues) && window.VybeImpressoes ? `<button type="button" class="vc-sec" data-vc="ver-impressoes" data-id="${esc(f.id)}">Ver impressões</button>` : ''}<button type="button" class="vc-sec" data-vc="fornecedor" data-id="${esc(f.id)}">Editar</button><button type="button" class="vc-perigo" data-vc="arquivar-forn" data-id="${esc(f.id)}">Arquivar</button></div></article>`).join('')
        || vazio(d.fornecedores.length ? 'Nenhum fornecedor com esse filtro.' : 'Nenhum fornecedor ainda. Guarde aqui as gráficas, os estúdios e o BV de cada um: as Impressões puxam o fornecedor daqui.', d.fornecedores.length ? '' : 'Cadastrar o primeiro', 'fornecedor')}</div>`;
  }
  function abaCreators(d) {
    const p = d.pode || {}, f = st.filtro, lista = C().filtrarCreators(d.creators, { nicho: f.nicho || '', cidade: f.cidade || '', busca: f.creator || '' });
    // Nicho e cidade no menu do sistema (quadros 17 e 49: sem select nativo), com quantos creators há em cada um.
    const quantos = (campo, o) => d.creators.filter((c) => String(c[campo] || '').trim().toLowerCase() === String(o).trim().toLowerCase()).length;
    const escolha = (campo, opcoes, rotulo) => (opcoes.length && typeof window.vbEscolhaHtml === 'function'
      ? window.vbEscolhaHtml({ rotulo, valor: f[campo] || '', vazio: 'Todos', campo: `data-vc-filtro="${campo}"`, opcoes: opcoes.map((o) => ({ valor: o, nome: o, n: quantos(campo, o) })) }) : '');
    return `${d.creators.length ? `<div class="vc-escolhas" role="group" aria-label="Filtrar creators">${escolha('nicho', d.opcoes.nichos, 'Nicho')}${escolha('cidade', d.opcoes.cidades, 'Cidade')}</div>` : ''}
      <input type="search" class="vc-busca" data-vc-busca="creator" placeholder="Buscar nome ou @" value="${esc(f.creator || '')}" aria-label="Buscar creator">
      <div class="vc-lista grade">${lista.map((c) => `<article class="vc-cartao"><div class="vc-cartao-topo"><b>${esc(c.nome)}</b>${c.nicho ? pill(c.nicho, 'u4') : ''}</div>
        <small>${c.arroba ? '@' + esc(c.arroba) + ' · ' : ''}${num(c.seguidores)} seguidores · ${pc(c.engajamento)} engajamento${c.cidade ? ' · ' + esc(c.cidade) : ''}</small>
        ${c.contato ? `<small>${esc(c.contato)}</small>` : ''}${c.observacoes ? `<small>${esc(c.observacoes)}</small>` : ''}
        ${p.editar_comercial ? `<div class="vc-linha-acoes"><button type="button" class="vc-sec" data-vc="creator" data-id="${esc(c.id)}">Editar</button><button type="button" class="vc-perigo" data-vc="arquivar-creator" data-id="${esc(c.id)}">Arquivar</button></div>` : ''}</article>`).join('')
        || vazio(d.creators.length ? 'Nenhum creator com esse filtro.' : 'Nenhum creator cadastrado. Monte a lista de influenciadores de Irecê e região com nicho, cidade e contato.', !d.creators.length && p.editar_comercial ? 'Cadastrar creator' : '', 'creator')}</div>`;
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
  // Orçamento ligado à oportunidade do funil (auditoria 09/11, A2): a proposta nasce de uma oportunidade do CRM e leva
  // o oportunidade_id; o nome do cliente continua indo junto (sem oportunidade, digita-se o nome, como antes).
  function formOrcamento() {
    const d = st.dados.orcamentos, validade = C().somarDias(hojeIso(), 15);
    // As oportunidades abertas vêm na própria resposta de Orçamentos (servidor, sem ganho nem perdido).
    const ops = [...(d.oportunidades || [])].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    abrirFolha({ titulo: 'Novo orçamento', botao: 'Criar orçamento', campos: [
      ...(ops.length ? [{ nome: 'oportunidade_id', rotulo: 'Oportunidade do funil', tipo: 'select', opcoes: [['', 'Sem oportunidade (digite o cliente)'], ...ops.map((o) => [String(o.id), o.nome])], valor: '' }] : []),
      { nome: 'cliente_nome', rotulo: ops.length ? 'Cliente (vazio usa o nome da oportunidade)' : 'Cliente', obrigatorio: !ops.length, max: 200 },
      ...d.pacotes.map((p) => ({ nome: 'q_' + p.id, rotulo: `${p.nome} · ${din(p.preco)}${p.tipo === 'recorrente' ? '/mês' : ''} (quantidade)`, tipo: 'number', passo: '1', valor: '0', meio: true })),
      { nome: 'desconto_percentual', rotulo: 'Desconto (%)', tipo: 'number', valor: '0', maxv: 100, meio: true },
      { nome: 'validade', rotulo: 'Válido até', tipo: 'date', valor: validade, obrigatorio: true, meio: true },
      { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', max: 4000 },
    ], aoVivo: (v) => {
      const itens = d.pacotes.map((p) => ({ ...p, quantidade: Number(v['q_' + p.id]) || 0 })).filter((i) => i.quantidade > 0);
      const t = C().totalOrcamento({ itens, desconto_percentual: v.desconto_percentual });
      return `<div class="vc-total"><span>Recorrente ${din(t.total_recorrente)}/mês</span><span>Avulso ${din(t.total_avulso)}</span>${t.desconto ? `<small>Desconto ${din(t.desconto)}</small>` : ''}</div>${itens.length ? capacidadeHtml(d.capacidade, C().cargaDosItens(itens)) : ''}`;
    }, enviar: (v) => {
      const op = ops.find((o) => String(o.id) === String(v.oportunidade_id || ''));
      const cliente = String(v.cliente_nome || '').trim() || op?.nome || '';
      if (!cliente) throw new Error('Escolha a oportunidade do funil ou digite o cliente.');
      return comercial({ acao: 'orcamento_criar', cliente_nome: cliente, oportunidade_id: op ? op.id : undefined, desconto_percentual: v.desconto_percentual, validade: v.validade, observacoes: v.observacoes,
      itens: d.pacotes.map((p) => ({ pacote_id: p.id, quantidade: Number(v['q_' + p.id]) || 0 })).filter((i) => i.quantidade > 0) });
    } });
  }
  function formFinancas(id) {
    const d = st.dados.financas, c = clientesDaAba(d).find((x) => x.cliente_id === id); if (!c) return;
    abrirFolha({ titulo: 'Finanças · ' + c.cliente_nome, campos: [
      { nome: 'valor_mensal', rotulo: 'Valor mensal do contrato (R$)', tipo: 'number', passo: '0.01', valor: c.valor_mensal || '', meio: true },
      { nome: 'pacote_id', rotulo: 'Pacote', tipo: 'select', opcoes: opcoes(d.pacotes, 'Sem pacote'), valor: c.pacote_id || '', meio: true },
      { nome: 'status_pagamento', rotulo: 'Pagamento', tipo: 'select', opcoes: (d.status.length ? d.status : C().STATUS_PAGAMENTO).map((s) => [s.id, s.nome]), valor: c.status_pagamento },
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
      // Cidade, UF e telefone (servidor #549): o ranking das Impressões usa o local para sugerir a gráfica mais perto.
      { nome: 'cidade', rotulo: 'Cidade', valor: x.cidade || '', max: 80, meio: true },
      { nome: 'uf', rotulo: 'UF', valor: x.uf || '', max: 2, meio: true },
      { nome: 'telefone', rotulo: 'Telefone', tipo: 'tel', valor: x.telefone || '', max: 20 },
      { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', valor: x.observacoes, max: 2000 },
    ], enviar: (v) => comercial({ acao: 'fornecedor_salvar', id: id || undefined, ...v, uf: String(v.uf || '').trim().toUpperCase() }) });
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
  // Novo lead (redesign, quadro 58): a empresa entra no começo do funil pelo mesmo CRM do 1º andar (area=crm, acao criar).
  function formLead() {
    abrirFolha({ titulo: 'Novo lead', botao: 'Pôr no funil', campos: [
      { nome: 'nome', rotulo: 'Empresa', obrigatorio: true, max: 200 },
      { nome: 'cnpj', rotulo: 'CNPJ (opcional)', max: 30, meio: true, dica: '14 dígitos; evita a mesma empresa duas vezes' },
      { nome: 'setor_empresa', rotulo: 'Setor (opcional)', max: 200, meio: true },
    ], enviar: (v) => crm({ acao: 'criar', etapa: 'empresa', ...v }).then((r) => { if (r.criada === false) throw new Error('Esta empresa já está no funil.'); }) });
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
    // Aberto pelo dock, a janela mostra só as abas daquele item (opções { abas, rotulo }); com uma aba só, sem barra de abas.
    const dinheiro = veDinheiro(), abas = ABAS.filter((a) => (!a[2] || dinheiro) && (!st.soAbas || st.soAbas.has(a[0])));
    if (!abas.some((a) => a[0] === st.aba)) st.aba = 'funil';
    const d = st.dados[st.aba], erro = st.erro[st.aba];
    let conteudo;
    if (erro) conteudo = `<div class="vc-vazio"><p>${esc(erro)}</p><button type="button" class="vc-sec" data-vc="recarregar">Tentar de novo</button></div>`;
    else if (!d) conteudo = '<div class="vc-vazio"><p>Carregando…</p></div>';
    else { try { conteudo = PINTOR[st.aba](d); } catch (e) { console.error('[comercial]', e); conteudo = vazio('Não foi possível mostrar esta aba.'); } }
    el.innerHTML = `<div class="vc-topo"><span class="vc-marca">${IC.marca}</span><span class="vc-titulo"><b>${esc(st.soAbas?.size === 1 ? TITULO[st.aba] || (ABAS.find((a) => a[0] === st.aba) || [0, 'Comercial'])[1] : (st.rotulo || 'Comercial'))}</b><small>${st.soAbas?.size && FRASE[st.aba] ? FRASE[st.aba] : dinheiro ? 'Funil, produtos e o dinheiro da agência' : 'Funil, pacotes, orçamentos e creators'}</small></span>
        ${acaoDoTopo(d)}
        ${st.aba === 'funil' && d?.pode?.editar_comercial ? `<button type="button" class="vc-acao vc-topo-acao" data-vc="lead">${IC.mais}<span>Novo lead</span></button>` : ''}
        ${st.aba === 'fornecedores' && d && !erro ? `<button type="button" class="vc-acao vc-topo-acao" data-vc="fornecedor">${IC.mais}<span>Novo fornecedor</span></button>` : ''}
        ${st.aba === 'creators' && d?.pode?.editar_comercial ? `<button type="button" class="vc-acao vc-topo-acao" data-vc="creator">${IC.mais}<span>Novo creator</span></button>` : ''}
        <button type="button" class="vc-icone" data-vc="ajuda" aria-label="O que é este módulo" aria-pressed="${st.ajuda}" title="O que é isto?">${IC.ajuda}</button>
        <button type="button" class="vc-icone" data-vc="fechar" aria-label="Fechar" title="Fechar (Esc)">${IC.fechar}</button></div>
      <nav class="vc-abas" role="tablist" aria-label="Abas do Comercial"${abas.length > 1 ? '' : ' hidden'}>${abas.map(([id, nome]) => `<button type="button" role="tab" data-vc-aba="${id}" aria-selected="${st.aba === id}">${esc(nome)}</button>`).join('')}</nav>
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
    if (t.dataset.vcMotivo !== undefined) { st.filtro.motivo = t.dataset.vcMotivo; pintar(); return; }
    if (t.dataset.vcPeriodo) { st.periodo.tipo = t.dataset.vcPeriodo; carregar(); return; }
    if (t.dataset.vcMesIr) { if (/^\d{4}-\d{2}$/.test(t.dataset.vcMesIr)) { st.periodo.mes = t.dataset.vcMesIr; carregar(); } return; }
    if (t.dataset.vcCat !== undefined) { st.filtro.categoria = t.dataset.vcCat; pintar(); return; }
    if (t.dataset.vcEtapa) return mexerEtapa(t.dataset.vcEtapa, Number(t.dataset.i));
    const a = t.dataset.vc, id = t.dataset.id;
    if (!a) return;
    const acoes = {
      fechar, ajuda: () => { st.ajuda = !st.ajuda; pintar(); }, falta: () => { st.verFalta = !st.verFalta; pintar(); }, recarregar: () => carregar(), 'fechar-folha': () => { st.folha = null; st.msg = ''; pintar(); },
      pacote: () => formPacote(id), capacidade: formCapacidade, orcamento: formOrcamento, financas: () => formFinancas(id), recebivel: () => formRecebivel(id),
      receber: () => formReceber(id), conta: () => formConta(id), fornecedor: () => formFornecedor(id), creator: () => formCreator(id), valor: () => formValor(id),
      perder: () => formPerder(id, t.dataset.de), imprimir: () => imprimir(id), lead: formLead,
      mover: () => (t.dataset.para === 'ganho' ? confirmarGanho(id, t.dataset.de, t.dataset.para) : executar(() => crm({ acao: 'mover', id, de_etapa: t.dataset.de, etapa: t.dataset.para }), 'Etapa registrada.')),
      proximo: () => executar(() => comercial({ acao: 'recebivel_proximo', id }).then((r) => { if (!r.criado) throw new Error('O próximo ciclo já estava lançado.'); }), 'Próximo ciclo lançado.'),
      pagar: () => executar(() => comercial({ acao: 'conta_pagar', id }), 'Conta marcada como paga.'),
      'cancelar-rec': () => confirm('Cancelar este recebimento? Ele sai dos totais (o registro fica guardado).') && executar(() => comercial({ acao: 'recebivel_cancelar', id }), 'Recebimento cancelado.'),
      'cancelar-conta': () => confirm('Cancelar esta conta? Ela sai dos totais (o registro fica guardado).') && executar(() => comercial({ acao: 'conta_cancelar', id }), 'Conta cancelada.'),
      'ver-impressoes': () => { fechar(); window.VybeImpressoes?.abrir?.(null, { fornecedor: id }); },
      'arquivar-forn': () => confirm('Arquivar este fornecedor?') && executar(() => comercial({ acao: 'fornecedor_arquivar', id }), 'Fornecedor arquivado.'),
      'arquivar-creator': () => confirm('Arquivar este creator?') && executar(() => comercial({ acao: 'creator_arquivar', id }), 'Creator arquivado.'),
      'ir-recebimentos': () => abrir('recebimentos'),
      'ir-pacotes': () => abrir('pacotes', st.soAbas?.has('pacotes') ? { abas: [...st.soAbas], rotulo: st.rotulo } : {}),
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
  function abrir(aba, opcoes = {}) {
    const valida = ABAS.some((a) => a[0] === aba);
    st.soAbas = Array.isArray(opcoes.abas) && opcoes.abas.length ? new Set(opcoes.abas) : null; st.rotulo = opcoes.rotulo || '';
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
