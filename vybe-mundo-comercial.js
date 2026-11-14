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
    ['contas', 'Contas a pagar', 1], ['inadimplencia', 'Inadimplência', 1], ['caixa', 'Caixa', 1], ['fornecedores', 'Fornecedores'], ['creators', 'Creators'],
    // Financeiro do próprio Vybe OS (13/11/2026, vybe-mundo-financeiro.js → area=financeiro, só os quatro donos).
    ['vorcaro', 'Vorcaro', 1], ['extrato', 'Extrato', 1], ['clientes_mes', 'Clientes mês a mês', 1], ['cartao', 'Cartão', 1], ['fixos', 'Gastos fixos', 1], ['projecao', 'Projeção', 1],
  ];
  const ABAS_FINANCEIRO = new Set(['vorcaro', 'extrato', 'clientes_mes', 'cartao', 'fixos', 'projecao']);
  // Frase do cabeçalho quando a janela abre num item só do dock (auditoria 09/11: Fornecedores e Creators mostravam o texto do Comercial).
  const FRASE = {
    funil: 'Oportunidades por etapa, metas do mês e a corrida comercial', pacotes: 'Os produtos da Vybe, com preço, entregas e carga do time',
    orcamentos: 'Propostas montadas a partir dos pacotes', financas: 'Recebido, despesas e margem de cada cliente',
    recebimentos: 'Faturas recorrentes e pontuais, uma linha por fatura', contas: 'Fixas, variáveis, folha e impostos do período',
    inadimplencia: 'Faturas vencidas e não recebidas, por cliente', caixa: 'Previsão do caixa no mês e nos 3 seguintes',
    fornecedores: 'Gráficas, estúdios e parceiros, com BV e contato', creators: 'Influenciadores de Irecê e região para as campanhas',
    vorcaro: 'A Tesouraria: o que pede atenção no financeiro e o que chegou pelo WhatsApp', extrato: 'O extrato do banco e para onde foi cada lançamento de verdade', clientes_mes: 'Cada cliente, mês a mês: pago ou em aberto',
    cartao: 'As faturas do cartão da agência, item por item', fixos: 'Programas, assinaturas, aluguel e o que sai todo mês', projecao: 'Fluxo de caixa realizado e projetado, com cenários',
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
    vorcaro: 'Só os quatro donos. O Vorcaro olha o setor inteiro (extrato, clientes, cartão, fixos e projeção), lista o que pede atenção e recebe o que vocês mandam no grupo Vybe Financeiro. Nada é lançado sem um dono confirmar.',
    extrato: 'Só os quatro donos. Importe o CSV do extrato do Banco do Brasil: a prévia mostra o que entra antes de gravar. Cada lançamento tem o lado do banco e o lado real (categoria, cliente, dividido em partes, pago, não pago ou em aberto).',
    clientes_mes: 'Só os quatro donos. Mensalidade do contrato contra as entradas ligadas a cada cliente no Extrato, pelo mês a que se referem.',
    cartao: 'Só os quatro donos. Os itens de cada fatura, com categoria e situação; o pagamento da fatura vem do Extrato.',
    fixos: 'Só os quatro donos. O que sai todo mês, com o dia e a forma de pagar; mostra se já saiu no extrato ou na fatura do mês.',
    projecao: 'Só os quatro donos. Média dos meses fechados do Extrato, projetada para 3, 6 ou 12 meses, com cenários.',
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
    // Dinheiro só dos donos (Paulo, 13/11/2026): a marca de admin (que inclui a coordenação) não conta para o palpite.
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
  const BLOCOS = ['capacidade', 'resumo', 'pode', 'opcoes', 'produtos', 'periodo'];
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
    x.faturamento = Number(x.faturamento) || 0; // número também: como bloco virava {} e a tela dizia "R$ 0,00"
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
      const d = ABAS_FINANCEIRO.has(aba) ? await pedir('financeiro', null, '') : await pedir('comercial', null, queryDaAba(aba));
      st.dados[aba] = completar(d); if (d.pode) podeDinheiro = Boolean(d.pode.ver_dinheiro);
      if (ABAS_FIN.has(aba)) carregarFin();
      // "Usar em orçamento" (Produtos e pacotes): a folha do orçamento novo já abre com o pacote escolhido.
      if (aba === 'recebimentos' && st.v2.lancar) { st.v2.lancar = false; formRecebivel(); }
      if (aba === 'orcamentos' && st.v2.usar) { const id = st.v2.usar; st.v2.usar = ''; if (st.dados.orcamentos.pacotes.some((p) => String(p.id) === id)) formOrcamento({ qtd: { [id]: 1 } }); }
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
    const grafico = ehD3() ? graficoLinha : graficoBarras; // Direção 3: série de meses em linha
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
    // Funil, pacotes e orçamentos têm o cabeçalho do padrão v2 (topoV2), com a ação deles.
    // Contas a pagar (quadro 20): "Nova conta" só no cabeçalho, também com a lista vazia (o vazio fica só com a frase).
    if (st.aba === 'contas') return b('Nova conta', 'conta');
    // Recebimentos (quadro 20): igual a Contas, "Novo recebimento" só no cabeçalho; o vazio aponta para ele.
    if (st.aba === 'recebimentos') return b('Novo recebimento', 'recebivel');
    return '';
  }
  const rotuloAnterior = () => (st.periodo.tipo === 'anual' ? 'vs ano anterior' : 'vs mês anterior');

  // ---------- Abas ----------
  // ===== Padrão v2 (moodboard aprovado, 12/11/2026): CRM e funil, Produtos e pacotes e Orçamentos pelos quadros DEPOIS =====
  // A tela é o quadro, nesta ordem: título com "Como funciona" e a ação principal; a fala do VYBES; três números; a
  // faixa de etapas ou a barra de filtro; o quadro ou "Pede ação" ao lado da lista que abre no lugar; o vazio numa
  // linha tracejada; uma frase de rodapé. O que o quadro não mostra fica a um clique ("mostrar"), nunca some.
  const V2 = new Set(['funil', 'pacotes', 'orcamentos', 'financas', 'fornecedores', 'creators']);
  st.v2 = { visao: 'quadro', fase: '', aberta: '', mostra: {}, mes: false, cap: false, roi: false, chip: { pacotes: 'ativos', orcamentos: 'abertos', financas: 'todos', fornecedores: '', creators: '' }, filtros: {}, colunas: false, fin: false, lancar: false, usar: '', arrasta: '', visto: {} };
  const DIAS_SEM = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const milhar = (v) => 'R$ ' + curto(v);
  const reais = (v) => (Number.isInteger(Number(v)) ? 'R$ ' + num(v) : din(v));
  const ehDia = (iso) => /^\d{4}-\d{2}-\d{2}/.test(String(iso || ''));
  const diasEntre = (a, b) => Math.round((Date.parse(String(b).slice(0, 10) + 'T12:00:00Z') - Date.parse(String(a).slice(0, 10) + 'T12:00:00Z')) / 864e5);
  const dm = (iso) => String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7);
  const porExtenso = (iso) => `${Number(String(iso).slice(8, 10))} de ${MESES[Number(String(iso).slice(5, 7)) - 1]}`;
  const plural = (n, um, varios) => `${num(n)} ${Number(n) === 1 ? um : varios}`;
  const selo = (s) => (s ? `<span class="v2c-pill ${s[0]}">${esc(s[1])}</span>` : '');
  const botao = (texto, attrs, cls = '') => `<button type="button" class="v2c-btn s${cls ? ' ' + cls : ''}" ${attrs}>${esc(texto)}</button>`;
  const elo = (texto, attrs) => `<button type="button" class="v2c-link" ${attrs}>${esc(texto)}</button>`;
  const falaHtml = (frase, acao = '', quem = 'VYBES · Comercial', letra = 'V') => `<section class="v2c-card v2c-fala" aria-label="${esc(quem.replace(' ·', ','))}"><span class="v2c-ag" aria-hidden="true">${letra}</span><p><span class="v2c-quem">${esc(quem)}</span>${frase}</p>${acao}</section>`;
  // O número desembaça e a barra cresce uma vez, quando a tela abre; nas repinturas seguintes ficam parados.
  const chegando = () => !st.v2.visto[st.aba];
  const tresHtml = (lista) => `<div class="v2c-tres">${lista.map((k, i) => `<div class="v2c-card v2c-kpi${k.tom ? ' ' + k.tom : ''}${String(k.valor).length > 18 ? ' longo' : ''}"><small>${esc(k.titulo)}</small><b><span${chegando() ? ` class="v2-num"${i ? ` style="animation-delay:${(i * 0.12).toFixed(2)}s"` : ''}` : ''}>${esc(k.valor)}</span></b>${k.barra != null ? `<div class="v2-barra${chegando() ? '' : ' ja'}"><i style="--v:${Math.max(0, Math.min(100, Number(k.barra) || 0))}%;--c:#11613A"></i></div>` : ''}${k.sub ? `<small>${k.sub}</small>` : ''}</div>`).join('')}</div>`;
  const vazioV2 = (frase, acoes = '') => `<div class="v2c-vz"><p>${frase}</p>${acoes}</div>`;
  // ===== Direção 3 (moodboard 3, 13/11/2026): CRM e funil, Produtos e pacotes e Orçamentos =====
  // Fundo areia, o bloco de ação laranja como único laranja cheio, quatro números com rótulo curto (barra ou linha), as
  // fichas com a contagem em negrito e a lista em grade. As peças vêm de vybe-core.js (d3AcaoHtml, d3NumHtml, d3LinhaSvg);
  // fora do painel (testes), o mesmo HTML montado aqui.
  // Fornecedores e Creators (quadros D3-Fornecedores e D3-Creators) entram com o subtítulo curto deles e "Ajuda".
  // Finanças por cliente (quadro D3-PorCliente) também: selo "só donos" no título e o mês ao lado.
  const D3 = new Set(['funil', 'pacotes', 'orcamentos', 'fornecedores', 'creators', 'financas']);
  const SUB_D3 = { fornecedores: 'gráficas, estúdios e parceiros', creators: 'Irecê e região' };
  const ehD3 = () => D3.has(st.aba);
  const g3 = (nome) => (typeof globalThis[nome] === 'function' ? globalThis[nome] : null);
  // Bloco de ação: frase curta (com o nome de quem fala em cima, quando houver) e um botão; attrs vai cru no botão.
  function acaoD3(frase, { texto = '', attrs = '', quem = 'VYBES · Comercial', agente = 'V' } = {}) {
    const corpo = `${quem ? `<small class="d3c-quem">${esc(quem)}</small>` : ''}<span class="d3c-frase">${frase}</span>`;
    const f = g3('d3AcaoHtml');
    if (f) return f({ frase: corpo, agente, botao: texto, attrs });
    return `<section class="d3-acao" aria-label="O que pede ação agora"><span class="d3-acao-av" aria-hidden="true">${esc(agente)}</span><span class="d3-acao-frase">${corpo}</span>${texto ? `<button type="button" class="d3-acao-btn" ${attrs}>${esc(texto)}</button>` : ''}</section>`;
  }
  function linhaD3(valores, op = {}) {
    const f = g3('d3LinhaSvg'); if (f) return f(valores, op);
    const v = (valores || []).map(Number).filter(Number.isFinite); if (v.length < 2) return '';
    const L = op.largura || 120, A = op.altura || 32, max = Math.max(...v), min = Math.min(...v), fx = max - min || 1;
    const pts = v.map((n, i) => `${(3 + (i * (L - 6)) / (v.length - 1)).toFixed(1)},${(A - 3 - ((n - min) * (A - 6)) / fx).toFixed(1)}`), [ux, uy] = pts[pts.length - 1].split(',');
    return `<svg class="d3-graf" viewBox="0 0 ${L} ${A}" aria-hidden="true"><polyline points="${pts.join(' ')}"/><circle cx="${ux}" cy="${uy}" r="3"/></svg>`;
  }
  // Quatro números: rótulo de 1 a 3 palavras, o valor, uma linha curta embaixo e a barra ou a mini linha, quando houver.
  function numerosD3(lista) {
    const f = g3('d3NumHtml'), ja = chegando() ? '' : ' ja';
    const um = (k) => {
      const v = esc(k.valor), tom = [k.tom, String(k.valor).length > 11 ? 'd3c-longo' : ''].filter(Boolean).join(' ');
      const base = f ? f({ rotulo: k.rotulo, valor: v, tom, serie: k.serie || null, barra: k.barra ?? null, attrs: k.attrs || '' })
        : `<div class="d3-num${tom ? ' ' + tom : ''}"><span class="d3-num-rot">${esc(k.rotulo)}</span><b class="d3-num-v">${v}</b>${k.serie ? linhaD3(k.serie) : k.barra != null ? `<span class="d3-barra" style="--v:${Math.max(0, Math.min(100, Math.round(k.barra)))}%"><i></i></span>` : ''}</div>`;
      return k.sub ? base.replace(/<\/(div|button)>$/, `<small class="d3c-num-sub${k.subTom ? ' ' + k.subTom : ''}">${k.sub}</small></$1>`) : base;
    };
    return `<div class="d3c-nums${ja}">${lista.map(um).join('')}</div>`;
  }
  const subtituloD3 = () => { const m = st.periodo.mes || hojeIso().slice(0, 7); return MESES[Number(m.slice(5)) - 1] + (st.periodo.tipo === 'anual' ? ' · ' + m.slice(0, 4) : ''); };
  // Iniciais de quem cuida (o avatar do cartão do funil); o agente que propôs, em lilás.
  const iniciais = (nome) => { const p = String(nome || '').trim().split(/\s+/).filter(Boolean); return (p.length > 1 ? p[0][0] + p[1][0] : (p[0] || '').slice(0, 2)).toUpperCase(); };
  const COR_FASE = { novo: '#B5AFA5', primeiro_contato: '#6B665E', apresentacao: '#579BFC', proposta: '#9D50DD', follow_up: '#FDAB3D', ganho: '#11613A', perdido: '#B5AFA5' };
  // "Pede ação": o que espera alguém, na ordem, com o botão na linha; mostra três e o resto a um clique.
  function pedeHtml(itens, chave, { sub = '', pe = '' } = {}) {
    const cabe = st.v2.mostra[chave] ? itens : itens.slice(0, 3), resto = itens.length - cabe.length;
    // Direção 3: o título com a contagem; na linha, o texto e o selo embaixo.
    const d3 = ehD3();
    return `<section class="v2c-card v2c-pede" aria-label="Pede ação"><div class="v2c-card-topo"><h3>Pede ação</h3><small>${d3 ? num(itens.length) : sub || (itens.length ? `${plural(itens.length, 'coisa', 'coisas')}, na ordem` : 'nada agora')}</small></div>
      ${cabe.map((x) => `<div class="v2c-lin"><div class="v2c-lin-txt">${d3 ? `<p>${x.texto}</p>${selo(x.selo)}` : `${selo(x.selo)}<p>${x.texto}</p>`}</div>${x.acao || ''}</div>`).join('') || `<p class="v2c-sub v2c-nada">${d3 ? 'Nada agora.' : 'Nada pede ação agora.'}</p>`}
      ${resto > 0 || pe ? `<p class="v2c-sub v2c-card-pe">${[resto > 0 ? `+ ${num(resto)} · ${elo('mostrar', `data-v2="mostra" data-id="${chave}"`)}` : '', pe].filter(Boolean).join(' · ')}</p>` : ''}</section>`;
  }
  // Barra de filtro única: busca, fichas com a contagem e "Filtros" (abre as fichas extras).
  function filtroHtml({ aba, busca = aba, rotulo, fichas, extras, antes = '', depois = '' }) {
    const sel = st.v2.chip[aba] || '', aberto = Boolean(st.v2.filtros[aba]) || extras.some((x) => x[0] === sel);
    // Direção 3: a contagem em negrito ao lado do nome ("Ativos 4"), sem o ponto.
    const ficha = ([id, nome, n]) => `<button type="button" class="v2c-chip" data-v2="chip" data-id="${id}" aria-pressed="${sel === id}">${ehD3() ? `${esc(nome)} <b>${num(n)}</b>` : `${esc(nome)} · ${num(n)}`}</button>`;
    return `<div class="v2c-filtro"><input type="search" class="v2c-busca" data-vc-busca="${busca}" placeholder="${esc(rotulo)}" aria-label="${esc(rotulo)}" value="${esc(st.filtro[busca] || '')}">
      <span class="v2c-chips" role="group" aria-label="Filtrar a lista">${fichas.map(ficha).join('')}</span>
      ${antes}${extras.length ? `<button type="button" class="v2c-btn s" data-v2="filtros" aria-expanded="${aberto}">Filtros</button>` : ''}${depois}
      ${aberto && extras.length ? `<span class="v2c-chips v2c-extras" role="group" aria-label="Mais filtros">${extras.map(ficha).join('')}</span>` : ''}</div>`;
  }
  function marcarAberta() {
    for (const x of raiz()?.querySelectorAll?.('[data-v2-linha]') || []) {
      const ab = String(x.dataset.v2Linha === st.v2.aberta);
      x.setAttribute('aria-expanded', ab); x.querySelector('[data-v2="abre"]')?.setAttribute('aria-expanded', ab);
    }
  }
  // O botão que conclui conta o estado: gira enquanto grava e fica verde com o texto novo antes de a tela atualizar.
  async function concluir(t, fn, feito) {
    if (st.ocupado) return;
    st.ocupado = true; st.msg = ''; t.dataset.estado = 'indo';
    try { await fn(); t.dataset.estado = 'feito'; t.textContent = feito; await new Promise((r) => setTimeout(r, 700)); st.ocupado = false; await carregar(); }
    catch (e) { st.ocupado = false; st.msg = '⚠️ ' + e.message; pintar(); }
  }
  function acaoV2(t) {
    const v = st.v2, a = t.dataset.v2, id = t.dataset.id || '', irPara = (aba) => abrir(aba, st.soAbas ? { abas: [aba] } : {});
    if (a === 'abre') { v.aberta = v.aberta === id ? '' : id; marcarAberta(); return; }
    if (a === 'liguei') return concluir(t, () => crm({ acao: 'comentar', id, observacao: 'Liguei para o contato.' }), 'Anotado');
    if (a === 'orc-status') {
      const fn = () => comercial({ acao: 'orcamento_status', id, status: t.dataset.status });
      return t.dataset.feito ? concluir(t, fn, t.dataset.feito) : executar(fn, 'Status do orçamento salvo.');
    }
    if (a === 'ver-ganhos') { v.fase = 'ganho'; v.visao = 'quadro'; return irPara('funil'); }
    if (a === 'usar') { v.usar = id; return irPara('orcamentos'); }
    if (a === 'contratos') { fechar(); window.VybeCarteira?.abrir?.('contratos'); return; }
    if (a === 'duplicar') {
      const d = st.dados.orcamentos, o = d?.orcamentos.find((x) => String(x.id) === id); if (!o) return;
      const qtd = {}; for (const i of o.itens || []) if (d.pacotes.some((p) => String(p.id) === String(i.pacote_id))) qtd[i.pacote_id] = (qtd[i.pacote_id] || 0) + (Number(i.quantidade) || 1);
      if (!Object.keys(qtd).length) { st.msg = '⚠️ Os pacotes deste orçamento não estão mais ativos.'; pintar(); return; }
      return formOrcamento({ cliente: o.cliente_nome, desconto: o.desconto_percentual, qtd });
    }
    if (a === 'abre-um') { v.aberta = id; pintar(); return; }
    if (a === 'lancar') { v.lancar = true; return irPara('recebimentos'); }
    if (a === 'recebi') {
      const c = clientesDaAba(st.dados.financas || { clientes: [] }).find((x) => String(x.cliente_id) === id); if (!c) return;
      return concluir(t, () => comercial({ acao: 'financas_salvar', cliente_id: c.cliente_id, versao: c.versao ?? '', valor_mensal: c.valor_mensal || '', pacote_id: c.pacote_id || '', status_pagamento: 'em_dia', observacao: c.observacao || '' }), 'Recebido');
    }
    // Completar o cadastro na própria linha (BV ou contato): grava o registro inteiro com o campo novo.
    if (a === 'salvar-campo') {
      const [tipo, campo, alvo] = id.split(':'), inp = raiz()?.querySelector?.(`[data-v2-campo="${id}"]`), valor = String(inp?.value || '').trim();
      if (!valor) { inp?.focus?.(); return; }
      if (tipo === 'forn') {
        const x = st.dados.fornecedores?.fornecedores.find((f) => String(f.id) === alvo); if (!x) return;
        const bv = campo === 'bv' ? Number(valor.replace('%', '').replace(',', '.')) : x.bv_percentual;
        if (campo === 'bv' && !(bv > 0 && bv <= 100)) { st.msg = '⚠️ Informe o BV em %, maior que 0 e até 100.'; pintar(); return; }
        return concluir(t, () => comercial({ acao: 'fornecedor_salvar', id: x.id, nome: x.nome, categoria: x.categoria, bv_percentual: bv ?? '', contato: campo === 'contato' ? valor : x.contato || '', cidade: x.cidade || '', uf: x.uf || '', telefone: x.telefone || '', observacoes: x.observacoes || '' }), t.dataset.feito || 'Salvo');
      }
      const c = st.dados.creators?.creators.find((x) => String(x.id) === alvo); if (!c) return;
      return concluir(t, () => comercial({ acao: 'creator_salvar', id: c.id, nome: c.nome, arroba: c.arroba ? '@' + c.arroba : '', seguidores: c.seguidores ?? '', engajamento: c.engajamento ?? '', nicho: c.nicho || '', cidade: c.cidade || '', contato: valor, observacoes: c.observacoes || '' }), t.dataset.feito || 'Salvo');
    }
    if (a === 'visao') { v.visao = id === 'lista' ? 'lista' : 'quadro'; v.fase = ''; }
    else if (a === 'fase') v.fase = v.fase === id ? '' : id;
    else if (a === 'mostra') v.mostra[id] = true;
    else if (['mes', 'cap', 'roi', 'colunas', 'fin'].includes(a)) v[a] = !v[a];
    else if (a === 'chip') { v.chip[st.aba] = id; v.mostra = {}; v.aberta = ''; }
    else if (a === 'filtros') v.filtros[st.aba] = !v.filtros[st.aba];
    else if (a === 'paradas') { v.visao = 'quadro'; v.fase = 'proposta'; v.aberta = id ? 'op:' + id : ''; }
    // 8 · Troca de visão (quadro ↔ lista) e 7 · chip que voa (fase e chips): o cartão do negócio voa para o lugar novo.
    if (['visao', 'fase', 'chip'].includes(a) && typeof window.vbTransicao === 'function') { window.vbTransicao(() => pintar(), { tipo: a === 'visao' ? 'visao' : 'chip' }); return; }
    pintar();
  }
  // Arrastar o cartão para a etapa seguinte faz o mesmo que o botão (uma etapa por vez; Perdido pede o motivo).
  function aoArrastar(e) {
    const c = e.target.closest?.('[data-v2-arrasta]'); if (!c) return;
    st.v2.arrasta = c.dataset.v2Arrasta;
    try { e.dataTransfer.setData('text/plain', st.v2.arrasta); e.dataTransfer.effectAllowed = 'move'; } catch { /* sem dataTransfer */ }
  }
  function aoPassar(e) { if (st.v2.arrasta && e.target.closest?.('[data-v2-solta]')) e.preventDefault(); }
  function aoSoltar(e) {
    const alvo = e.target.closest?.('[data-v2-solta]'), id = st.v2.arrasta; st.v2.arrasta = '';
    const d = st.dados.funil, o = d?.oportunidades.find((x) => String(x.id) === id); if (!alvo || !o) return;
    e.preventDefault();
    const fases = d.fases.length ? d.fases : C().FASES, faseDe = (etapa) => fases.find((f) => (f.etapas || []).includes(etapa))?.id;
    const fase = alvo.dataset.v2Solta; if (fase === faseDe(o.etapa) || ['ganho', 'perdido'].includes(o.etapa)) return;
    if (fase === 'perdido') return formPerder(o.id, o.etapa);
    const i = d.etapas.findIndex((x) => x.id === o.etapa), prox = d.etapas[i + 1], pulo = prox?.id === 'follow_up' ? d.etapas[i + 2] : null;
    const para = [prox, pulo].find((x) => x && x.id !== 'perdido' && faseDe(x.id) === fase);
    if (!para) { st.msg = '⚠️ Avance uma etapa por vez.'; pintar(); return; }
    if (para.id === 'ganho') confirmarGanho(o.id, o.etapa, 'ganho'); else executar(() => crm({ acao: 'mover', id: o.id, de_etapa: o.etapa, etapa: para.id }), 'Etapa registrada.');
  }
  // Cabeçalho do quadro: título, a visão (só no funil), "Como funciona" e a única ação cheia da tela.
  function topoV2(d) {
    const aba = st.aba, titulo = TITULO[aba] || (ABAS.find((a) => a[0] === aba) || [0, 'Comercial'])[1];
    const [texto, acao, pode] = { funil: ['Novo lead', 'data-vc="lead"', d?.pode && 'editar_comercial' in d.pode ? Boolean(d.pode.editar_comercial) : Boolean(d) && palpiteDono()],
      pacotes: ['Novo pacote', 'data-vc="pacote"', Boolean(d) && podeFazer(d, 'editar_pacotes') && d.pacotes.length > 0],
      orcamentos: ['Novo orçamento', 'data-vc="orcamento"', Boolean(d) && podeFazer(d, 'editar_comercial') && d.pacotes.length > 0 && d.orcamentos.length > 0],
      financas: ['Lançar', 'data-v2="lancar"', Boolean(d)], fornecedores: ['Novo fornecedor', 'data-vc="fornecedor"', Boolean(d)], creators: ['Novo creator', 'data-vc="creator"', Boolean(d?.pode?.editar_comercial)] }[aba];
    // Direção 3: título com o mês ao lado; "Como funciona" com o "?" e a ação do topo em branco (o laranja é do bloco de ação).
    if (D3.has(aba)) {
      const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit' }).format(new Date());
      const fc = aba === 'financas';
      return `<div class="v2c-topo d3c-topo"><h2>${esc(titulo)}</h2>${fc ? '<span class="d3-selo-donos">só donos</span>' : ''}<span class="d3c-sub">${fc && fin() ? '' : esc(SUB_D3[aba] || subtituloD3())}${aba === 'funil' ? ' · ' + hora : ''}</span>
        ${aba === 'funil' ? `<span class="v2c-seg" role="group" aria-label="Visão do funil">${[['quadro', 'Quadro'], ['lista', 'Lista']].map(([k, n]) => `<button type="button" data-v2="visao" data-id="${k}" aria-pressed="${st.v2.visao === k}">${n}</button>`).join('')}</span>` : ''}
        ${fc && fin() ? `<span class="v2c-mes">${mesHtml(mesFin(), false)}</span>` : ''}
        ${fc ? '' : `<button type="button" class="v2c-btn d3c-ajuda" data-vc="ajuda" aria-expanded="${st.ajuda}">${SUB_D3[aba] ? 'Ajuda' : '<span class="d3c-q" aria-hidden="true">?</span>Como funciona'}</button>`}
        ${pode ? `<button type="button" class="v2c-btn d3c-novo" ${acao}>${IC.mais}${texto}</button>` : ''}
        <button type="button" class="v2c-fechar" data-vc="fechar" aria-label="Fechar" title="Fechar (Esc)">${IC.fechar}</button></div>`;
    }
    const ajuda = aba === 'financas' ? '' : `<button type="button" class="v2c-btn" data-vc="ajuda" aria-expanded="${st.ajuda}">${['fornecedores', 'creators'].includes(aba) ? 'Ajuda' : 'Como funciona'}</button>`;
    return `<div class="v2c-topo">${aba === 'financas' ? `<div class="v2c-titulo"><p class="v2c-sub">Finanças › Por cliente</p><h2>${esc(titulo)}</h2></div>${fin() ? `<span class="v2c-mes">${mesHtml(mesFin(), false)}</span>` : ''}` : `<h2>${esc(titulo)}</h2>`}
        ${aba === 'funil' ? `<span class="v2c-seg" role="group" aria-label="Visão do funil">${[['quadro', 'Quadro'], ['lista', 'Lista']].map(([k, n]) => `<button type="button" data-v2="visao" data-id="${k}" aria-pressed="${st.v2.visao === k}">${n}</button>`).join('')}</span>` : ''}
        ${ajuda}
        ${pode ? `<button type="button" class="v2c-btn p" ${acao}>${texto}</button>` : ''}
        <button type="button" class="v2c-fechar" data-vc="fechar" aria-label="Fechar" title="Fechar (Esc)">${IC.fechar}</button></div>`;
  }
  // CRM e funil pelo quadro DEPOIS: fala, três números, a faixa das etapas (zero tracejada, Proposta parada em
  // laranja), as colunas das fases abertas que têm oportunidade (duas por coluna, o resto em "mostrar") e o cartão que
  // abre no lugar com o próximo passo. Ganho e Perdido abrem a lista ao clicar na etapa.
  function abaFunil(d) {
    const p = d.pode || {}, cap = d.capacidade, v = st.v2, hoje = d.hoje, val = Boolean(d.valor_disponivel), m = d.mes;
    // Sem resposta do funil (banco sem as tabelas, demonstração), as fases padrão zeradas: o funil aparece como funil.
    const padrao = (() => { try { return { fases: C().FASES, resumo: C().resumoFunil([]) }; } catch { return { fases: [], resumo: { fases: [], motivos_perda: [] } }; } })();
    const fases = d.fases.length ? d.fases : padrao.fases;
    const r = d.resumo.fases.length ? d.resumo : { ...padrao.resumo, ...d.resumo, fases: padrao.resumo.fases, motivos_perda: d.resumo.motivos_perda.length ? d.resumo.motivos_perda : padrao.resumo.motivos_perda || [] };
    const etapaNome = (id) => d.etapas.find((e) => e.id === id)?.nome || id;
    const faseDe = (etapa) => fases.find((f) => (f.etapas || []).includes(etapa))?.id;
    const pacote = (id) => d.pacotes.find((x) => String(x.id) === String(id));
    const motivoNome = (id) => d.motivos.find((x) => x.id === id)?.nome || '';
    // Quando a proposta saiu: a última entrada na etapa Proposta (histórico do CRM, d.mes.propostas).
    const propostaEm = new Map(); for (const e of m?.propostas || []) if (ehDia(e.dia)) propostaEm.set(String(e.oportunidade_id), e.dia);
    const parada = (o) => { const dia = faseDe(o.etapa) === 'proposta' ? propostaEm.get(String(o.id)) : ''; return dia ? Math.max(0, diasEntre(dia, hoje)) : null; };
    const paradas = d.oportunidades.filter((o) => parada(o) > 5).sort((a, b) => parada(b) - parada(a));
    const quando = (iso) => { const n = diasEntre(hoje, iso); return n === 0 ? 'hoje' : n === 1 ? 'amanhã' : n > 1 && n < 7 ? DIAS_SEM[new Date(iso + 'T12:00:00Z').getUTCDay()] : dm(iso); };
    const seloDe = (o) => {
      const n = parada(o);
      if (o.etapa === 'ganho') return ['g', ehDia(o.ganho_dia) ? 'ganho em ' + dm(o.ganho_dia) : 'ganho'];
      if (o.etapa === 'perdido') return ['n', (motivoNome(o.motivo_perda) || 'sem motivo').toLowerCase()];
      if (n != null) return n > 5 ? ['r', `${num(n)} dias sem resposta`] : ['b', n ? `enviada há ${plural(n, 'dia', 'dias')}` : 'enviada hoje'];
      if (ehDia(o.proxima_acao_data)) {
        const acao = String(o.proxima_acao || '').trim(), curta = acao && acao.length <= 16 ? acao.toLowerCase() : 'próximo passo';
        return o.proxima_acao_data < hoje ? ['r', `${curta} desde ${dm(o.proxima_acao_data)}`] : ['a', `${curta} ${quando(o.proxima_acao_data)}`];
      }
      if (faseDe(o.etapa) === 'novo' && ehDia(o.criado_dia)) { const k = diasEntre(o.criado_dia, hoje); return ['n', k <= 0 ? 'chegou hoje' : `há ${plural(k, 'dia', 'dias')}`]; }
      return o.origem === 'formulario' ? ['b', 'Formulário'] : null;
    };
    const valorDe = (o) => (val ? [o.valor_mensal ? reais(o.valor_mensal) + ' por mês' : '', o.valor_avulso ? reais(o.valor_avulso) + ' avulso' : ''].filter(Boolean).join(' + ') : '');
    const detalhe = (o) => {
      const i = d.etapas.findIndex((e) => e.id === o.etapa), prox = d.etapas[i + 1], fim = ['ganho', 'perdido'].includes(o.etapa), f = faseDe(o.etapa);
      const pulo = prox?.id === 'follow_up' ? d.etapas[i + 2] : null, pk = pacote(o.pacote_id), dia = f === 'proposta' ? propostaEm.get(String(o.id)) : '';
      const capSelo = pk && !fim && ['proposta', 'follow_up'].includes(f) ? capacidadeHtml(cap, C().cargaDosItens([{ carga: pk.carga, quantidade: 1 }]), { compacto: true }) : '';
      const passo = o.proxima_acao || (prox && prox.id !== 'perdido' ? (o.etapa === 'abordagem_proposta' ? 'aprovar a abordagem' : 'avançar para ' + prox.nome) : '');
      const id = esc(o.id), de = esc(o.etapa), mover = (para) => `data-vc="mover" data-id="${id}" data-de="${de}" data-para="${esc(para.id)}" title="${esc('Para ' + para.nome)}"`;
      const anota = f !== 'novo' ? `<button type="button" class="v2c-btn s k v2-estado" data-v2="liguei" data-id="${id}" title="Anota o contato no histórico do CRM">Liguei</button>` : '';
      const botoes = p.editar_comercial && !fim ? `<p class="v2c-acoes">${anota}
        ${prox && prox.id !== 'perdido' ? botao(o.etapa === 'abordagem_proposta' ? 'Aprovar abordagem' : 'Avançar etapa', mover(prox), anota ? '' : 'k') : ''}
        ${pulo ? botao('Pular para ' + pulo.nome, mover(pulo)) : ''}
        ${val ? botao('Valor', `data-vc="valor" data-id="${id}"`) : ''}
        ${botao('Perdido', `data-vc="perder" data-id="${id}" data-de="${de}"`, 'ruim')}</p>` : '';
      return `${dia ? `<p class="v2c-pas">Proposta enviada em ${esc(porExtenso(dia))}</p>` : ''}
        ${o.etapa === 'perdido' ? `<p class="v2c-pas">Motivo: ${esc(motivoNome(o.motivo_perda) || 'não registrado')}${o.motivo_texto ? ', ' + esc(o.motivo_texto) : ''}</p>` : ''}
        ${!fim && passo ? `<p class="v2c-pas"><b>Próximo passo:</b> ${esc(passo)}${ehDia(o.proxima_acao_data) ? ' · ' + data(o.proxima_acao_data) : ''}</p>` : ''}
        <p class="v2c-pas">${[etapaNome(o.etapa), o.responsavel_nome || 'Sem responsável', pk?.nome, o.origem === 'formulario' ? 'veio do formulário' : ''].filter(Boolean).map(esc).join(' · ')} ${capSelo}</p>${botoes}`;
    };
    const cartao = (o, naLista) => {
      const id = esc(o.id), ab = v.aberta === 'op:' + o.id, f = faseDe(o.etapa), fim = ['ganho', 'perdido'].includes(o.etapa);
      const sub = [naLista ? etapaNome(o.etapa) : '', naLista || f !== 'novo' ? o.responsavel_nome || 'Sem responsável' : etapaNome(o.etapa), valorDe(o)].filter(Boolean).map(esc).join(' · ');
      return `<article class="v2c-op v2-abre" data-v2-linha="op:${id}" data-vt="op-${id}" aria-expanded="${ab}"${p.editar_comercial && !fim ? ` draggable="true" data-v2-arrasta="${id}"` : ''}>
        <button type="button" class="v2c-op-lin" data-v2="abre" data-id="op:${id}" aria-expanded="${ab}"><span class="v2c-t"><span>${esc(o.nome)}</span>${selo(seloDe(o))}</span><span class="v2c-sub">${sub}</span></button>
        <div class="v2-mais"><div>${detalhe(o)}</div></div></article>`;
    };
    // A faixa das etapas: quantas estão em cada uma, quanto vale por mês e o que chama atenção.
    const motivoSel = st.filtro.motivo || '', comMotivo = r.motivos_perda.filter((x) => x.quantidade);
    const maiorMotivo = [...comMotivo].sort((a, b) => b.quantidade - a.quantidade)[0];
    const opsDa = (id) => d.oportunidades.filter((o) => faseDe(o.etapa) === id && (id !== 'perdido' || !motivoSel || o.motivo_perda === motivoSel));
    const etapa = (f) => {
      const n = Number(f.atual) || 0, soma = val && f.id !== 'perdido' ? d.oportunidades.filter((o) => faseDe(o.etapa) === f.id).reduce((s, o) => s + (Number(o.valor_mensal) || 0), 0) : 0;
      const semResp = f.id === 'proposta' ? paradas.length : 0, chegaram = Number(f.alcancaram) || 0;
      const peq = !n ? 'vazia' : f.id === 'perdido' ? (maiorMotivo ? 'motivo: ' + maiorMotivo.nome.toLowerCase() : 'sem motivo registrado')
        : f.id === 'ganho' ? (m ? `${num(m.kpis.atual.negocios)} ${m.periodo.tipo === 'anual' ? 'no ano' : 'no mês'}` : 'fechados')
          : semResp ? `${num(semResp)} sem resposta` : `${num(chegaram)} ${chegaram === 1 ? 'chegou' : 'chegaram'}`;
      return `<button type="button" class="v2c-et${n ? '' : ' z'}${semResp ? ' at' : ''}${f.id === 'ganho' ? ' ganho' : ''}" data-v2="fase" data-id="${esc(f.id)}" data-v2-solta="${esc(f.id)}" aria-pressed="${v.fase === f.id}"${f.conversao != null ? ` title="${esc(pc(f.conversao) + ' seguem para a fase seguinte')}"` : ''}>
        <b>${esc(f.nome)}</b><span>${num(n)}</span>${soma ? `<em>${esc(milhar(soma))}</em>` : ''}<small>${esc(peq)}</small></button>`;
    };
    const coluna = (f, max) => {
      const ops = opsDa(f.id), cabe = max && !v.mostra['f:' + f.id] ? ops.slice(0, max) : ops, resto = ops.length - cabe.length;
      const filtro = f.id === 'perdido' && comMotivo.length ? `<div class="v2c-chips" role="group" aria-label="Filtrar perdidas por motivo">
          <button type="button" class="v2c-chip" data-vc-motivo="" aria-pressed="${!motivoSel}">Todos · ${num(f.atual)}</button>
          ${comMotivo.map((x) => `<button type="button" class="v2c-chip" data-vc-motivo="${esc(x.id)}" aria-pressed="${motivoSel === x.id}" title="${esc(pc(x.percentual))} das perdas">${esc(x.nome)} · ${num(x.quantidade)}</button>`).join('')}</div>` : '';
      const nada = f.id === 'novo' ? 'Nenhuma empresa nova. O SDR propõe pelo CRM do 1º andar.' : f.id === 'perdido' ? (motivoSel ? 'Nenhuma perda com este motivo.' : 'Nenhuma perda registrada. O motivo de cada uma aparece aqui.') : 'Nenhuma oportunidade nesta fase.';
      return `<section class="v2c-colu" data-v2-solta="${esc(f.id)}" aria-label="${esc(f.nome)}: ${num(ops.length)}"><h3>${esc(f.nome)} · ${num(ops.length)}</h3>${filtro}
        <div class="v2c-colu-ops">${cabe.map((o) => cartao(o)).join('') || `<p class="v2c-sub">${esc(nada)}</p>`}</div>
        ${resto > 0 ? `<p class="v2c-sub">+ ${num(resto)} · ${elo('mostrar', `data-v2="mostra" data-id="f:${esc(f.id)}"`)}</p>` : ''}</section>`;
    };
    const abertasF = r.fases.filter((f) => !['ganho', 'perdido'].includes(f.id)), comOps = abertasF.filter((f) => Number(f.atual) > 0);
    const emFoco = r.fases.find((f) => f.id === v.fase);
    const emAberto = d.oportunidades.filter((o) => !['ganho', 'perdido'].includes(o.etapa)).sort((a, b) => (parada(b) ?? -1) - (parada(a) ?? -1));
    const corpo = emFoco ? `<div class="v2c-quadro foco">${coluna(emFoco, 0)}</div>`
      : v.visao === 'lista' ? (emAberto.length ? `<section class="v2c-card v2c-lista" aria-label="Oportunidades abertas"><div class="v2c-card-topo"><h3>Abertas · ${num(emAberto.length)}</h3><small>da proposta mais parada para a mais nova</small></div>${emAberto.map((o) => cartao(o, true)).join('')}</section>` : '')
        : comOps.length ? `<div class="v2c-quadro" style="--n:${Math.max(4, comOps.length)}" aria-label="Fases com oportunidade">${comOps.map((f) => coluna(f, 2)).join('')}</div>` : '';
    // A fala e os três números.
    const neg = r.em_negociacao, abertas = Number(neg.quantidade) || 0, encerradas = r.fases.filter((f) => ['ganho', 'perdido'].includes(f.id)).reduce((s, f) => s + (Number(f.atual) || 0), 0);
    const frase = !abertas ? 'Nenhuma oportunidade em negociação agora. O SDR propõe empresas pelo CRM do 1º andar.'
      : `${val && neg.mensal ? `<b>${esc(milhar(neg.mensal))} por mês</b>` : `<b>${plural(abertas, 'oportunidade aberta', 'oportunidades abertas')}</b>`} em negociação. ${paradas.length ? `<b>${plural(paradas.length, 'proposta', 'propostas')}</b> sem resposta há mais de 5 dias ${paradas.length === 1 ? 'é a que mais pesa' : 'são as que mais pesam'} na meta.` : 'Nenhuma proposta parada há mais de 5 dias.'}`;
    const meta = m ? m.progresso.find((x) => x.id === 'mrr' && x.meta > 0) || m.progresso.find((x) => x.meta > 0) : null;
    const editaMeta = p.editar_pacotes && m && m.config_disponivel !== false;
    const numeros = tresHtml([
      { titulo: 'Em negociação', valor: val ? milhar(neg.mensal) : num(abertas), tom: abertas ? '' : 'quieto',
        sub: val ? `por mês · ${plural(abertas, 'aberta', 'abertas')}${neg.avulso ? ' · avulso: ' + esc(milhar(neg.avulso)) : ''}` : abertas === 1 ? 'oportunidade aberta' : 'oportunidades abertas' },
      { titulo: m ? 'Meta ' + (m.periodo.tipo === 'anual' ? 'de ' + m.periodo.rotulo : 'de ' + MESES[Number(String(m.periodo.mes).slice(5)) - 1]) : 'Meta do mês', tom: meta ? '' : 'quieto',
        valor: meta ? (meta.tipo === 'dinheiro' ? `R$ ${curto(meta.realizado)} de ${curto(meta.meta)}` : `${num(meta.realizado)} de ${num(meta.meta)}`) : 'Sem meta', barra: meta ? meta.barra : null,
        sub: meta ? (meta.id === 'mrr' ? '' : esc(meta.nome.toLowerCase())) : editaMeta ? elo('Definir a meta', 'data-vc="metas"') : 'os donos definem a meta' },
      { titulo: 'Taxa de ganho', valor: r.taxa_ganho == null ? '0%' : pc(r.taxa_ganho), tom: r.taxa_ganho == null ? 'quieto' : '', sub: encerradas ? `de ${plural(encerradas, 'negócio encerrado', 'negócios encerrados')}` : 'sem negócio fechado ainda' },
    ]);
    // Vazio e o que ainda não foi ligado: uma linha, com o técnico só para quem administra.
    const tecnico = [val ? '' : 'Falta aplicar a migração <code>2026-11-07-comercial.sql</code> no banco.', m && m.config_disponivel === false ? esc(m.aviso_config || 'Falta a migração das metas e do formulário de leads.') : ''].filter(Boolean).join(' ');
    const falta = souAdminAqui() && tecnico ? botao('Para quem administra: o que falta', `data-vc="falta" aria-expanded="${st.verFalta}"`) : '';
    const podeLead = d.pode && 'editar_comercial' in d.pode ? Boolean(d.pode.editar_comercial) : palpiteDono();
    const linhaVazia = !d.oportunidades.length ? vazioV2(`<b>Nenhuma oportunidade ainda.</b> As ${num(r.fases.length)} etapas ficam em 0.${val ? '' : ' O valor da negociação ainda não foi ligado.'}`, (podeLead ? botao('Cadastrar o primeiro lead', 'data-vc="lead"') : '') + falta)
      : !val ? vazioV2('<b>O valor da negociação ainda não foi ligado.</b> O funil já funciona; valor e follow-up aparecem quando estiverem ligados.', falta) : '';
    const campeao = d.produtos?.campeao ? `<p class="vc-dica">Produto campeão: <b>${esc(d.produtos.campeao.nome)}</b> (${num(d.produtos.campeao.ganhos)} ganhos) · ticket médio ${din(d.produtos.ticket_medio_mensal)}/mês${d.produtos.ticket_medio_avulso ? ' · ' + din(d.produtos.ticket_medio_avulso) + ' avulso' : ''}</p>` : '';
    if (ehD3()) return funilD3({ p, v, r, m, val, neg, etapaNome, opsDa, parada, paradas, seloDe, detalhe, comMotivo, motivoSel, maiorMotivo, emAberto, abertas, encerradas, meta, editaMeta, linhaVazia, falta, tecnico, campeao, podeLead });
    return `${falaHtml(frase, paradas.length ? botao(paradas.length === 1 ? 'Ver a proposta' : `Ver as ${num(paradas.length)}`, `data-v2="paradas" data-id="${esc(paradas[0].id)}"`) : '')}
      ${numeros}
      <div class="v2c-etapas" role="group" aria-label="Etapas do funil">${r.fases.map(etapa).join('')}</div>
      ${corpo}${linhaVazia}${st.verFalta && falta ? `<p class="v2c-sub v2c-tec">${tecnico}</p>` : ''}
      <p class="v2c-sub v2c-pe">O SDR propõe empresas pelo CRM do 1º andar. O cartão abre no lugar com o próximo passo; Ganho e Perdido abrem a lista ao clicar${p.editar_comercial ? '; arrastar o cartão também avança a etapa' : ''}.${[m && m.periodo ? elo(`Metas, corrida e formulário de leads · ${v.mes ? 'recolher' : 'mostrar'}`, `data-v2="mes" aria-expanded="${v.mes}"`) : '', p.editar_pacotes ? elo('Configurar etapas', 'data-vc="etapas"') : ''].filter(Boolean).map((x) => ' ' + x).join(' ·')}</p>
      ${v.mes ? `<div class="v2c-resto">${campeao}${blocoMes(d)}</div>` : ''}`;
  }
  // CRM e funil pela Direção 3: o bloco de ação com a proposta mais parada, quatro números, as etapas em fichas com a
  // contagem, as colunas de todas as fases abertas (até três cartões, o resto em "mostrar") e Ganho e Perdido no pé da
  // última coluna. O cartão abre no lugar com o próximo passo e os botões, como antes.
  function funilD3(x) {
    const { p, v, r, m, val, neg, etapaNome, opsDa, parada, paradas, seloDe, detalhe, comMotivo, motivoSel, maiorMotivo, emAberto, abertas, encerradas, meta, editaMeta, linhaVazia, falta, tecnico, campeao, podeLead } = x;
    const somaMes = (ops) => ops.reduce((s, o) => s + (Number(o.valor_mensal) || 0), 0);
    const quanto = (ops) => `${num(ops.length)}${val && somaMes(ops) ? ' · ' + milhar(somaMes(ops)) : ''}`;
    const cor = (id) => COR_FASE[id] || '#C4C4C4';
    // O selo curto do cartão (o próximo passo já vai escrito embaixo): parado, enviada, o dia ou há quanto chegou.
    const hoje = d3Dados()?.hoje || hojeIso();
    const seloCurto = (o) => {
      const s = seloDe(o); if (!s) return null;
      const n = parada(o);
      if (n != null) return n > 5 ? ['a', `parado ${num(n)} d`] : ['n', n ? `${num(n)} d` : 'hoje'];
      if (ehDia(o.proxima_acao_data) && !['ganho', 'perdido'].includes(o.etapa)) {
        const k = diasEntre(hoje, o.proxima_acao_data);
        return k < 0 ? ['r', 'desde ' + dm(o.proxima_acao_data)] : ['n', k === 0 ? 'hoje' : k === 1 ? 'amanhã' : k < 7 ? DIAS_SEM[new Date(o.proxima_acao_data + 'T12:00:00Z').getUTCDay()].slice(0, 3) + ' ' + dm(o.proxima_acao_data).slice(0, 2) : dm(o.proxima_acao_data)];
      }
      if (/^há \d+/.test(s[1])) return ['n', s[1].replace(/^há (\d+) dias?$/, '$1 d')];
      if (s[1] === 'chegou hoje') return ['n', 'hoje'];
      return s;
    };
    const cartao = (o, naLista) => {
      const id = esc(o.id), ab = v.aberta === 'op:' + o.id, fim = ['ganho', 'perdido'].includes(o.etapa);
      const av = o.responsavel_nome ? `<span class="d3c-av" title="${esc(o.responsavel_nome)}">${esc(iniciais(o.responsavel_nome))}</span>` : '';
      const valor = val && (o.valor_mensal || o.valor_avulso) ? `<span class="d3c-op-v"><b>${esc(reais(o.valor_mensal || o.valor_avulso))}</b> ${o.valor_mensal ? '/mês' : 'avulso'}</span>` : `<span class="d3c-op-v">${esc(o.responsavel_nome || 'Sem responsável')}</span>`;
      const passo = naLista ? etapaNome(o.etapa) : !fim && String(o.proxima_acao || '').trim() ? '→ ' + o.proxima_acao : '';
      return `<article class="v2c-op d3c-op v2-abre" data-v2-linha="op:${id}" data-vt="op-${id}" aria-expanded="${ab}"${p.editar_comercial && !fim ? ` draggable="true" data-v2-arrasta="${id}"` : ''}>
        <button type="button" class="v2c-op-lin d3c-op-lin" data-v2="abre" data-id="op:${id}" aria-expanded="${ab}"><span class="d3c-op-t"><b>${esc(o.nome)}</b>${av}</span>
          <span class="d3c-op-m">${valor}${selo(seloCurto(o))}</span>${passo ? `<span class="d3c-passo">${esc(passo)}</span>` : ''}</button>
        <div class="v2-mais"><div>${detalhe(o)}</div></div></article>`;
    };
    const ganhos = opsDa('ganho'), perdidas = opsDa('perdido');
    const fimHtml = `<div class="d3c-fim"><button type="button" class="d3c-fim-b g" data-v2="fase" data-id="ganho" aria-pressed="${v.fase === 'ganho'}"><span>Ganho</span><span>${esc(quanto(ganhos))}</span></button>
      <button type="button" class="d3c-fim-b" data-v2="fase" data-id="perdido" aria-pressed="${v.fase === 'perdido'}"><span>Perdido</span><span>${num(perdidas.length)}${maiorMotivo ? ' · ' + esc(maiorMotivo.nome.toLowerCase()) + ' ' + num(maiorMotivo.quantidade) : ''}</span></button></div>`;
    const coluna = (f, max, ultima = false) => {
      const ops = opsDa(f.id), cabe = max && !v.mostra['f:' + f.id] ? ops.slice(0, max) : ops, resto = ops.length - cabe.length;
      const filtro = f.id === 'perdido' && comMotivo.length ? `<div class="v2c-chips" role="group" aria-label="Filtrar perdidas por motivo">
          <button type="button" class="v2c-chip" data-vc-motivo="" aria-pressed="${!motivoSel}">Todos <b>${num(f.atual)}</b></button>
          ${comMotivo.map((y) => `<button type="button" class="v2c-chip" data-vc-motivo="${esc(y.id)}" aria-pressed="${motivoSel === y.id}" title="${esc(pc(y.percentual))} das perdas">${esc(y.nome)} <b>${num(y.quantidade)}</b></button>`).join('')}</div>` : '';
      return `<section class="v2c-colu d3c-colu" data-v2-solta="${esc(f.id)}" aria-label="${esc(f.nome)}: ${num(ops.length)}"><h3><i style="--c:${cor(f.id)}"></i><b>${esc(f.nome)}</b><span>${esc(quanto(ops))}</span></h3>${filtro}
        <div class="v2c-colu-ops">${cabe.map((o) => cartao(o)).join('') || '<p class="v2c-sub d3c-nada">Vazia</p>'}</div>
        ${resto > 0 ? `<p class="v2c-sub">+ ${num(resto)} · ${elo('mostrar', `data-v2="mostra" data-id="f:${esc(f.id)}"`)}</p>` : ''}${ultima ? fimHtml : ''}</section>`;
    };
    const abertasF = r.fases.filter((f) => !['ganho', 'perdido'].includes(f.id));
    const emFoco = r.fases.find((f) => f.id === v.fase);
    const corpo = emFoco ? `<div class="v2c-quadro d3c-quadro foco">${coluna(emFoco, 0)}</div>`
      : v.visao === 'lista' ? (emAberto.length ? `<section class="v2c-card v2c-lista d3c-lista" aria-label="Oportunidades abertas"><div class="v2c-card-topo"><h3>Abertas</h3><small>${num(emAberto.length)}</small></div>${emAberto.map((o) => cartao(o, true)).join('')}</section>` : '')
        : d3Tem(emAberto, ganhos, perdidas) ? `<div class="v2c-quadro d3c-quadro" style="--n:${abertasF.length}" aria-label="Fases do funil">${abertasF.map((f, i) => coluna(f, 3, i === abertasF.length - 1)).join('')}</div>` : '';
    // As fichas das etapas: Abertas (todas) e uma por fase, com a bolinha da cor da fase e a contagem.
    const chip = (f) => {
      const n = Number(f.atual) || 0, chegaram = Number(f.alcancaram) || 0;
      const dica = [f.conversao != null ? pc(f.conversao) + ' seguem' : '', f.id === 'perdido' && maiorMotivo ? 'motivo: ' + maiorMotivo.nome.toLowerCase() : '', !['ganho', 'perdido'].includes(f.id) && chegaram ? `${num(chegaram)} ${chegaram === 1 ? 'chegou' : 'chegaram'}` : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="d3c-et${f.id === 'ganho' ? ' g' : ''}${n ? '' : ' z'}" data-v2="fase" data-id="${esc(f.id)}" data-v2-solta="${esc(f.id)}" aria-pressed="${v.fase === f.id}"${dica ? ` title="${esc(dica)}"` : ''}>${f.id === 'ganho' ? '' : `<i style="--c:${cor(f.id)}"></i>`}${esc(f.nome)} <b>${num(n)}</b></button>`;
    };
    const etapas = `<div class="d3c-etapas" role="group" aria-label="Etapas do funil"><button type="button" class="d3c-et" data-v2="fase" data-id="" aria-pressed="${!v.fase}">Abertas <b>${num(abertas)}</b></button>${r.fases.map(chip).join('')}</div>`;
    const maisParada = paradas[0];
    const acao = maisParada ? acaoD3(`${esc(maisParada.nome)} · proposta sem resposta há ${plural(parada(maisParada), 'dia', 'dias')}.`, { texto: 'Ver a proposta', attrs: `data-v2="paradas" data-id="${esc(maisParada.id)}"`, quem: '' })
      : abertas ? acaoD3(`${val && neg.mensal ? esc(milhar(neg.mensal)) + ' por mês' : plural(abertas, 'oportunidade aberta', 'oportunidades abertas')} em negociação.`, { texto: v.visao === 'lista' ? 'Ver o quadro' : 'Ver a lista', attrs: `data-v2="visao" data-id="${v.visao === 'lista' ? 'quadro' : 'lista'}"`, quem: '' })
        : acaoD3('Nenhuma oportunidade em negociação.', podeLead ? { texto: 'Cadastrar lead', attrs: 'data-vc="lead"', quem: '' } : { quem: '' });
    const numeros = numerosD3([
      { rotulo: 'Em negociação', valor: num(abertas), sub: val && neg.mensal ? `abertas · ${esc(reais(neg.mensal))}/mês${neg.avulso ? ' + ' + esc(reais(neg.avulso)) + ' avulso' : ''}` : abertas === 1 ? 'aberta' : 'abertas' },
      { rotulo: m ? (m.periodo.tipo === 'anual' ? 'Meta do ano' : 'Meta do mês') : 'Meta do mês', valor: meta ? (meta.tipo === 'dinheiro' ? `R$ ${curto(meta.realizado)} de ${curto(meta.meta)}` : `${num(meta.realizado)} de ${num(meta.meta)}`) : 'Sem meta',
        barra: meta ? meta.barra : null, sub: meta ? (meta.id === 'mrr' ? 'MRR novo' : esc(meta.nome.toLowerCase())) : editaMeta ? elo('Definir a meta', 'data-vc="metas"') : 'sem meta' },
      { rotulo: 'Taxa de ganho', valor: r.taxa_ganho == null ? '0%' : pc(r.taxa_ganho), sub: encerradas ? `de ${plural(encerradas, 'encerrado', 'encerrados')}` : 'nada encerrado' },
      { rotulo: 'Paradas 5+ dias', valor: num(paradas.length), tom: paradas.length ? 'a' : '', attrs: maisParada ? `data-v2="paradas" data-id="${esc(maisParada.id)}"` : '',
        sub: maisParada ? `a mais antiga · ${num(parada(maisParada))} d` : 'nenhuma', subTom: maisParada ? 'a' : '' },
    ]);
    const links = [m && m.periodo ? elo(`Metas, corrida e formulário · ${v.mes ? 'recolher' : 'mostrar'}`, `data-v2="mes" aria-expanded="${v.mes}"`) : '', p.editar_pacotes ? elo('Configurar etapas', 'data-vc="etapas"') : ''].filter(Boolean);
    return `${acao}${numeros}${etapas}${corpo}${linhaVazia}${st.verFalta && falta ? `<p class="v2c-sub v2c-tec">${tecnico}</p>` : ''}
      ${links.length ? `<p class="d3c-mais">${links.join('<span aria-hidden="true">·</span>')}</p>` : ''}
      ${v.mes ? `<div class="v2c-resto">${campeao}${blocoMes(d3Dados())}</div>` : ''}`;
  }
  const d3Tem = (...listas) => listas.some((l) => l.length);
  const d3Dados = () => st.dados.funil;
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
  const graficoBarras = (x) => grafico(x);
  function graficoLinha({ meses, series, aria, espiar }) {
    const [a, b] = series, vals = (s) => meses.map((m) => Number(m[s.chave]) || 0);
    const svg = linhaD3(vals(a), { meta: b ? vals(b) : null, largura: 320, altura: 110, rotulo: aria });
    const ult = meses[meses.length - 1];
    return `<figure class="vc-grafico d3c-graf"><figcaption><span><i class="d3c-leg"></i>${esc(a.rotulo)}</span>${b ? `<span><i class="d3c-leg meta"></i>${esc(b.rotulo)}</span>` : ''}<b>${esc(a.fmt(Number(ult?.[a.chave]) || 0))}</b></figcaption>${svg}
      <div class="d3c-meses">${meses.map((m, i) => `<button type="button" class="d3c-mes${i === meses.length - 1 ? ' ultimo' : ''}"${espiar ? ` data-espiar="${String(espiar(m.mes, a.chave)).startsWith('financas:') ? '' : 'comercial:'}${esc(espiar(m.mes, a.chave))}"` : ''} title="${esc(series.map((s) => s.rotulo + ': ' + s.fmt(Number(m[s.chave]) || 0)).join(' · '))}">${esc(MESES[Number(m.mes.slice(5)) - 1].slice(0, 3))}</button>`).join('')}</div></figure>`;
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
    // Direção 3: série de meses vira linha (a segunda série, tracejada, para comparar).
    const grafico = ehD3() ? graficoLinha : graficoBarras;
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
  // Produtos e pacotes pelo quadro DEPOIS: fala do campeão, três números, busca com fichas, "Pede ação" (sem preço,
  // zona crítica, carga alta) ao lado da lista em que cada pacote abre no lugar com o que entra nele.
  function abaPacotes(d) {
    const p = d.pode || {}, v = st.v2, edita = Boolean(p.editar_pacotes), orca = podeFazer(d, 'editar_comercial');
    const pr = d.produtos || {}, ganhos = Number(pr.ganhos) || 0, camp = pr.campeao || null;
    const comCusto = d.pacotes.some((x) => x.custo != null), ativos = d.pacotes.filter((x) => x.ativo);
    const cargoNome = (id) => C().CARGOS.find((c) => c.id === id)?.nome || id;
    const cap = d.capacidade, capOk = Boolean(cap) && Object.values(cap.capacidades || {}).some((n) => n > 0), dem = demandasAbertas();
    // Mais uma venda deste pacote cabe no time? (a mesma conta do "O time aguenta?")
    const aperto = (x) => {
      if (!capOk || !x.ativo || !Object.keys(x.carga || {}).length) return null;
      const r = C().capacidadeTime({ capacidades: cap.capacidades, pessoas: cap.pessoas, demandas: dem || [], acrescimo: C().cargaDosItens([{ carga: x.carga, quantidade: 1 }]) });
      if (r.estado === 'cabe') return null;
      return { estado: r.estado, cargo: r.cargos.filter((c) => c.acrescimo > 0).sort((a, b) => (b.uso ?? 999) - (a.uso ?? 999))[0] };
    };
    const pede = [], curtoD3 = ehD3(); // Direção 3: a linha curta (nome e o número que pesa)
    for (const x of d.pacotes) {
      const id = esc(x.id), nome = `<b>${esc(x.nome)}</b>`;
      if (!(Number(x.preco) > 0)) pede.push({ selo: ['r', 'Sem preço'], texto: curtoD3 ? `${nome}${x.ativo ? '' : ' · inativo'}` : `${nome} · ${x.ativo ? 'ativo' : 'inativo'}; sem preço, o orçamento sai zerado`, acao: edita ? botao('Definir preço', `data-vc="pacote" data-id="${id}"`) : '' });
      else if (x.ativo && x.zona_critica) pede.push({ selo: ['r', 'Zona crítica'], texto: curtoD3 ? `${nome} · margem ${pc(x.margem_percentual)}` : `${nome} · margem de ${pc(x.margem_percentual)}, abaixo de ${num(d.zona_critica || 20)}%`, acao: edita ? botao('Rever o pacote', `data-vc="pacote" data-id="${id}"`) : '' });
      const a = aperto(x);
      if (a) pede.push({ selo: ['a', 'Carga alta'], texto: curtoD3 ? `${nome} · ${esc(a.cargo?.nome || 'time')}${a.cargo ? ` ${num(a.cargo.total)}/${a.cargo.capacidade ? num(a.cargo.capacidade) : '0'}` : ''}` : `${nome} · mais uma venda ${a.estado === 'estoura' ? 'passa do que' : 'encosta no que'} ${esc(a.cargo?.nome || 'o time')} dá conta${a.cargo ? `: ${num(a.cargo.total)} de ${a.cargo.capacidade ? num(a.cargo.capacidade) : 'nenhuma'} por mês` : ''}`, acao: edita ? botao('Rever a carga', 'data-vc="capacidade"') : '' });
    }
    if (edita && cap && !capOk && ativos.length) pede.push({ selo: ['n', 'Sem capacidade'], texto: curtoD3 ? '<b>Capacidade do time</b>' : 'A capacidade mensal por cargo ainda não foi configurada; sem ela não dá para saber se o time aguenta.', acao: botao('Configurar', 'data-vc="capacidade"') });
    // Fichas: ativos, mensal, avulso e inativos; em "Filtros", todos e zona crítica (só quem vê o custo).
    const GRUPOS = { ativos: ['Ativos', (x) => x.ativo], mensal: ['Mensal', (x) => x.ativo && x.tipo === 'recorrente'], avulso: ['Avulso', (x) => x.ativo && x.tipo !== 'recorrente'], inativos: ['Inativos', (x) => !x.ativo],
      todos: ['Todos', () => true], ...(comCusto ? { critica: ['Zona crítica', (x) => x.ativo && x.zona_critica] } : {}) };
    if (!GRUPOS[v.chip.pacotes]) v.chip.pacotes = 'ativos';
    const ficha = (k) => [k, GRUPOS[k][0], d.pacotes.filter(GRUPOS[k][1]).length];
    const termo = norm(st.filtro.pacotes), lista = d.pacotes.filter(GRUPOS[v.chip.pacotes][1]).filter((x) => !termo || norm(`${x.nome} ${(x.entregas || []).join(' ')}`).includes(termo));
    const cabe = v.mostra.pacotes || termo ? lista : lista.slice(0, ehD3() ? 6 : 3), resto = lista.length - cabe.length;
    const linha = (x) => {
      const id = esc(x.id), ab = v.aberta === 'pk:' + x.id, rec = x.tipo === 'recorrente', carga = Object.entries(x.carga || {}).filter(([, n]) => Number(n) > 0);
      const sub = [rec ? 'Mensal' : 'Avulso', Number(x.horas) > 0 ? `${num(x.horas)} h${rec ? ' por mês' : ''}` : '', camp && String(camp.pacote_id) === String(x.id) ? plural(camp.ganhos, 'ganho', 'ganhos') : '',
        x.ativo ? '' : 'inativo', !rec && x.entregas?.length ? x.entregas.slice(0, 3).join(', ') : ''].filter(Boolean).map(esc).join(' · ');
      const cor = x.zona_critica ? '#B42318' : Number(x.margem_percentual) < 40 ? '#9A5B00' : '#11613A';
      const margem = x.custo != null ? `<span class="v2c-pk-m"><span class="v2-barra${chegando() ? '' : ' ja'}"><i style="--v:${Math.max(0, Math.min(100, Number(x.margem_percentual) || 0))}%;--c:${cor}"></i></span><span class="v2c-sub">custo R$ ${num(Math.round(x.custo))} · margem ${pc(Math.round(Number(x.margem_percentual) || 0))}</span></span>` : '';
      const acoes = [orca && x.ativo && Number(x.preco) > 0 ? botao('Usar em orçamento', `data-v2="usar" data-id="${id}"`, 'k') : '', edita ? botao('Editar pacote', `data-vc="pacote" data-id="${id}"`) : ''].join('');
      return `<div class="v2c-abre v2-abre${x.ativo ? '' : ' apagado'}" data-v2-linha="pk:${id}" aria-expanded="${ab}">
        <button type="button" class="v2c-lin v2c-pk${margem ? '' : ' sem-margem'}" data-v2="abre" data-id="pk:${id}" aria-expanded="${ab}"><span class="v2c-pk-n"><b>${esc(x.nome)}</b><span class="v2c-sub">${sub}</span></span>
          <span class="v2c-pk-p">${Number(x.preco) > 0 ? esc(reais(x.preco)) : 'sem preço'}<span class="v2c-sub">${rec ? 'por mês' : 'avulso'}</span></span>${margem}</button>
        <div class="v2-mais"><div>
          <p class="v2c-hist">${x.entregas?.length ? 'Entra: ' + x.entregas.map(esc).join(', ') : 'Sem entregas cadastradas'}</p>
          ${carga.length ? `<p class="v2c-hist">Carga: ${carga.map(([k, n]) => `${esc(cargoNome(k))} ${num(n)} por mês`).join(' · ')}</p>` : ''}
          ${acoes ? `<p class="v2c-acoes recuo">${acoes}</p>` : ''}</div></div></div>`;
    };
    const escondidos = d.pacotes.length - lista.length;
    if (ehD3()) {
      // Direção 3: a tabela dos pacotes à esquerda (pacote, tipo, horas, preço e margem) e "Pede ação" à direita.
      const linhaD3Pk = (x) => {
        const id = esc(x.id), ab = v.aberta === 'pk:' + x.id, rec = x.tipo === 'recorrente', carga = Object.entries(x.carga || {}).filter(([, n]) => Number(n) > 0);
        const m = Math.round(Number(x.margem_percentual) || 0), tom = x.zona_critica ? 'r' : m < 40 ? 'a' : '';
        const extra = [!x.ativo ? '<span class="v2c-pill n">Inativo</span>' : '', !rec && x.entregas?.length ? `<span class="d3c-ent">${esc(x.entregas.slice(0, 3).join(', '))}</span>` : ''].join('');
        const acoes = [orca && x.ativo && Number(x.preco) > 0 ? botao('Usar em orçamento', `data-v2="usar" data-id="${id}"`, 'k') : '', edita ? botao('Editar pacote', `data-vc="pacote" data-id="${id}"`) : ''].join('');
        return `<div class="v2c-abre v2-abre${x.ativo ? '' : ' apagado'}" data-v2-linha="pk:${id}" aria-expanded="${ab}">
          <button type="button" class="v2c-lin d3c-pk${comCusto ? '' : ' sem-margem'}" data-v2="abre" data-id="pk:${id}" aria-expanded="${ab}"><span class="d3c-pk-n"><b>${esc(x.nome)}</b>${extra}</span>
            <span>${rec ? 'Mensal' : 'Avulso'}</span><span>${Number(x.horas) > 0 ? `${num(x.horas)} h${rec ? '/mês' : ''}` : '—'}</span>
            <span class="d3c-pk-p${Number(x.preco) > 0 ? '' : ' r'}">${Number(x.preco) > 0 ? esc(reais(x.preco)) : 'sem preço'}</span>
            ${comCusto ? `<span class="d3c-pk-m">${x.custo != null ? `<span class="d3-barra" style="--v:${Math.max(0, Math.min(100, m))}%"><i></i></span><b class="${tom}">${pc(m)}</b>` : '—'}</span>` : ''}</button>
          <div class="v2-mais"><div>
            <p class="v2c-hist">${x.entregas?.length ? 'Entra: ' + x.entregas.map(esc).join(', ') : 'Sem entregas cadastradas'}</p>
            ${carga.length ? `<p class="v2c-hist">Carga: ${carga.map(([k, n]) => `${esc(cargoNome(k))} ${num(n)} por mês`).join(' · ')}</p>` : ''}
            ${x.custo != null ? `<p class="v2c-hist">Custo R$ ${num(Math.round(x.custo))} · margem ${pc(m)}</p>` : ''}
            ${acoes ? `<p class="v2c-acoes recuo">${acoes}</p>` : ''}</div></div></div>`;
      };
      const mensais = ativos.filter((x) => x.tipo === 'recorrente').length;
      const semPreco = d.pacotes.find((x) => !(Number(x.preco) > 0)), critico = d.pacotes.find((x) => x.ativo && x.zona_critica && Number(x.preco) > 0), alvo = semPreco || critico;
      const acao = alvo
        ? acaoD3(`${esc(alvo.nome)} ${alvo === semPreco ? 'está sem preço e fora dos orçamentos.' : 'está com a margem abaixo de ' + num(d.zona_critica || 20) + '%.'}`,
          edita ? { texto: alvo === semPreco ? 'Definir preço' : 'Rever o pacote', attrs: `data-vc="pacote" data-id="${esc(alvo.id)}"` } : {})
        : camp ? acaoD3(`${esc(camp.nome)} lidera: ${plural(camp.ganhos, 'negócio ganho', 'negócios ganhos')}.`, ganhos ? { texto: ganhos === 1 ? 'Ver o negócio' : 'Ver os negócios', attrs: 'data-v2="ver-ganhos"' } : {})
          : acaoD3(d.pacotes.length ? `${plural(ativos.length, 'pacote ativo', 'pacotes ativos')} na esteira.` : 'Nenhum pacote cadastrado ainda.');
      const numeros = numerosD3([
        { rotulo: 'Produto campeão', valor: camp ? camp.nome : 'Sem campeão', barra: camp && ganhos ? (camp.ganhos / ganhos) * 100 : null, sub: camp ? `${num(camp.ganhos)} de ${plural(ganhos, 'ganho', 'ganhos')}` : 'nenhum ganho' },
        { rotulo: 'Ticket mensal', valor: pr.ticket_medio_mensal != null ? milhar(pr.ticket_medio_mensal) : 'R$ 0', sub: pr.ticket_medio_mensal != null ? 'média dos ganhos' : 'sem ganho mensal' },
        { rotulo: 'Ticket avulso', valor: pr.ticket_medio_avulso != null ? milhar(pr.ticket_medio_avulso) : 'R$ 0', sub: pr.ticket_medio_avulso != null ? 'média dos ganhos' : 'sem ganho avulso' },
        { rotulo: 'Pacotes ativos', valor: num(ativos.length), sub: `${plural(mensais, 'mensal', 'mensais')} · ${plural(ativos.length - mensais, 'avulso', 'avulsos')}` },
      ]);
      const cab = `<div class="d3c-cab d3c-pk${comCusto ? '' : ' sem-margem'}" aria-hidden="true"><span>Pacote</span><span>Tipo</span><span>Horas</span><span class="d3c-pk-p">Preço</span>${comCusto ? '<span>Margem</span>' : ''}</div>`;
      const corpoD3 = d.pacotes.length ? `${filtroHtml({ aba: 'pacotes', rotulo: 'Buscar pacote', fichas: ['ativos', 'mensal', 'avulso', 'inativos'].map(ficha), extras: ['todos', ...(comCusto ? ['critica'] : [])].map(ficha) })}
        <div class="v2c-grade d3c-grade pacotes"><section class="v2c-card v2c-lista d3c-tabela" aria-label="Pacotes"><div class="v2c-card-topo"><h3>Pacotes</h3><small>${num(lista.length)}</small></div>${cab}
            ${cabe.map(linhaD3Pk).join('') || `<p class="v2c-sub v2c-nada">${termo ? 'Nenhum pacote com esse texto.' : 'Nenhum pacote neste filtro.'}</p>`}
            ${resto > 0 || escondidos > 0 ? `<p class="v2c-sub v2c-card-pe">${[resto > 0 ? `+ ${num(resto)} · ${elo('mostrar', 'data-v2="mostra" data-id="pacotes"')}` : '', escondidos > 0 ? `${num(escondidos)} fora do filtro` : ''].filter(Boolean).join(' · ')}</p>` : ''}</section>
          ${pedeHtml(pede, 'pede-pacotes')}</div>`
        : vazioV2('<b>Nenhum pacote ainda.</b>', podeFazer(d, 'editar_pacotes') ? botao('Cadastrar o primeiro pacote', 'data-vc="pacote"') : '');
      return `${acao}${numeros}${corpoD3}
        ${edita ? `<p class="d3c-mais">${elo(`Capacidade do time · ${v.cap ? 'recolher' : 'mostrar'}`, `data-v2="cap" aria-expanded="${v.cap}"`)}</p>` : ''}
        ${edita && v.cap ? `<div class="v2c-resto"><div class="vc-secao"><h3>Capacidade do time</h3><button type="button" class="vc-link" data-vc="capacidade">Configurar</button></div>${capacidadeHtml(d.capacidade, {}) || '<p class="vc-dica">Sem capacidade configurada.</p>'}</div>` : ''}`;
    }
    const frase = camp ? `O campeão é o <b>${esc(camp.nome)}</b>: ${num(camp.ganhos)} ${ganhos === 1 ? 'do' : 'dos'} ${plural(ganhos, 'negócio ganho', 'negócios ganhos')}.${pr.ticket_medio_mensal != null ? ` Ticket médio mensal em <b>${esc(milhar(pr.ticket_medio_mensal))}</b>.` : ''}`
      : d.pacotes.length ? `<b>${plural(ativos.length, 'pacote ativo', 'pacotes ativos')}</b> na esteira. O produto campeão e o ticket médio aparecem com o primeiro negócio ganho.` : 'Nenhum pacote cadastrado ainda. Os orçamentos e a carga do time saem daqui.';
    const numeros = tresHtml([
      { titulo: 'Produto campeão', valor: camp ? camp.nome : 'Sem campeão', tom: camp ? '' : 'quieto', sub: camp ? `${num(camp.ganhos)} de ${plural(ganhos, 'negócio ganho', 'negócios ganhos')}` : 'sem negócio ganho ainda' },
      { titulo: 'Ticket médio mensal', valor: pr.ticket_medio_mensal != null ? milhar(pr.ticket_medio_mensal) : 'R$ 0', tom: pr.ticket_medio_mensal != null ? '' : 'quieto', sub: pr.ticket_medio_mensal != null ? 'média dos negócios ganhos em pacote mensal' : 'sem negócio mensal ganho' },
      { titulo: 'Ticket médio avulso', valor: pr.ticket_medio_avulso != null ? milhar(pr.ticket_medio_avulso) : 'R$ 0', tom: pr.ticket_medio_avulso != null ? '' : 'quieto', sub: pr.ticket_medio_avulso != null ? 'média dos negócios ganhos em pacote avulso' : 'sem negócio avulso ganho' },
    ]);
    const corpo = d.pacotes.length ? `${filtroHtml({ aba: 'pacotes', rotulo: 'Buscar pacote', fichas: ['ativos', 'mensal', 'avulso', 'inativos'].map(ficha), extras: ['todos', ...(comCusto ? ['critica'] : [])].map(ficha) })}
      <div class="v2c-grade pacotes">${pedeHtml(pede, 'pede-pacotes')}
        <section class="v2c-card v2c-lista" aria-label="Pacotes"><div class="v2c-card-topo"><h3>Pacotes</h3><small>${comCusto ? 'preço, custo do time e margem' : 'preço e entregas'}</small></div>
          ${cabe.map(linha).join('') || `<p class="v2c-sub v2c-nada">${termo ? 'Nenhum pacote com esse texto neste filtro.' : 'Nenhum pacote neste filtro.'}</p>`}
          ${resto > 0 || escondidos > 0 ? `<p class="v2c-sub v2c-card-pe">${[resto > 0 ? `+ ${plural(resto, 'recolhido', 'recolhidos')} · ${elo('mostrar', 'data-v2="mostra" data-id="pacotes"')}` : '', escondidos > 0 ? `${plural(escondidos, 'fora deste filtro', 'fora deste filtro')}, nas fichas` : ''].filter(Boolean).join(' · ')}</p>` : ''}</section></div>`
      : vazioV2('<b>Nenhum pacote ainda.</b> Os orçamentos e a carga do time saem daqui.', podeFazer(d, 'editar_pacotes') ? botao('Cadastrar o primeiro pacote', 'data-vc="pacote"') : '');
    return `${falaHtml(frase, camp && ganhos ? botao(ganhos === 1 ? 'Ver o negócio' : `Ver os ${num(ganhos)} negócios`, 'data-v2="ver-ganhos"') : '')}
      ${numeros}${corpo}
      <p class="v2c-sub v2c-pe">Os produtos da Vybe, com preço, entregas e carga do time. O pacote abre no lugar com o que entra nele${comCusto ? '; custo é a hora do time' : ''}.${edita ? ` ${elo(`Capacidade do time · ${v.cap ? 'recolher' : 'mostrar'}`, `data-v2="cap" aria-expanded="${v.cap}"`)}` : ''}</p>
      ${edita && v.cap ? `<div class="v2c-resto"><div class="vc-secao"><h3>Capacidade do time</h3><button type="button" class="vc-link" data-vc="capacidade">Configurar</button></div>${capacidadeHtml(d.capacidade, {}) || '<p class="vc-dica">Sem capacidade configurada.</p>'}</div>` : ''}`;
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
    return `<details class="vc-roi vc-roi-det"${r.orc || r.investimento || st.v2.roi ? ' open' : ''}><summary>ROI na proposta</summary><div class="vc-secao"><h3>Retorno para o cliente</h3>${orcs.length ? `<select class="vc-mini" data-vc-roi-orc aria-label="Usar o valor de um orçamento"><option value="">Usar o valor de um orçamento…</option>${orcs.map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(r.orc) ? ' selected' : ''}>${esc(o.cliente_nome)} · ${din(o.totais.total_recorrente)}/mês</option>`).join('')}</select>` : ''}</div>
      <div class="vc-roi-campos">${campo('investimento', 'Investimento mensal (R$)', '2.500')}${campo('ticket', 'Ticket de uma venda do cliente (R$)', '180')}${campo('margem', 'Margem do cliente por venda (%)', '35')}${campo('vendas', 'Vendas a mais por mês (estimativa)', '60')}</div>
      ${res}${calc && r.orc ? '<p class="vc-dica">Este cálculo sai na proposta impressa do orçamento escolhido.</p>' : ''}</details>`;
  }
  // Orçamentos pelo quadro DEPOIS: fala, três números, busca com fichas por situação, "Pede ação" (vence, aprovado
  // sem contrato, rascunho pronto) ao lado da lista em que o orçamento abre no lugar com os itens.
  function abaOrcamentos(d) {
    const p = d.pode || {}, v = st.v2, hoje = d.hoje, edita = Boolean(p.editar_comercial), semPacote = !d.pacotes.length, todos = d.orcamentos;
    const de = (s) => todos.filter((o) => o.status === s), abertos = de('enviado'), rascunhos = de('rascunho'), aprovados = de('aceito'), recusados = de('recusado');
    const mensal = (l) => l.reduce((s, o) => s + (Number(o.totais?.total_recorrente) || 0), 0);
    const falta = (o) => (ehDia(o.validade) ? diasEntre(hoje, o.validade) : null);
    const vencendo = abertos.filter((o) => { const n = falta(o); return n != null && n >= 0 && n <= 7; }), vencidos = abertos.filter((o) => falta(o) < 0);
    const criado = (o) => diaBahia(o.criado_em), ha = (o) => { const c = criado(o); if (!c) return ''; const n = Math.max(0, diasEntre(c, hoje)); return n ? `criado há ${plural(n, 'dia', 'dias')}` : 'criado hoje'; };
    const cli = (o) => `<span class="v2c-cli">${cliCor(o.cliente_nome)}</span>`;
    const itens = (o) => (o.itens || []).map((i) => esc(i.nome)).join(' + ') || 'sem itens';
    const valor = (o) => [o.totais?.total_recorrente ? reais(o.totais.total_recorrente) + ' por mês' : '', o.totais?.total_avulso ? reais(o.totais.total_avulso) + ' avulso' : ''].filter(Boolean).join(' + ') || 'R$ 0';
    const prazo = (o) => { const n = falta(o); return n == null ? null : n < 0 ? ['r', `venceu há ${plural(-n, 'dia', 'dias')}`] : n === 0 ? ['r', 'vence hoje'] : n === 1 ? ['r', 'vence amanhã'] : n <= 7 ? ['a', `vence em ${num(n)} dias`] : null; };
    const maiuscula = (s) => [s[0], s[1].replace(/^./, (c) => c.toUpperCase())];
    // Direção 3: a linha do "Pede ação" fica curta (cliente e valor ou o que falta); o resto está na linha que abre.
    const curtoD3 = ehD3();
    const pede = [
      ...[...vencidos, ...vencendo].sort((a, b) => String(a.validade).localeCompare(String(b.validade))).map((o) => ({ selo: maiuscula(prazo(o)), texto: curtoD3 ? `${cli(o)} · ${esc(valor(o))}` : `${cli(o)} · ${itens(o)}, ${esc(valor(o))} · sem resposta${ha(o) ? ', ' + ha(o) : ''}`, acao: botao(curtoD3 ? 'Ver' : 'Ver a proposta', `data-vc="imprimir" data-id="${esc(o.id)}"`) })),
      // Aprovado há pouco: o contrato é registrado em Contratos (a tela não sabe se já foi; por isso só os dos últimos 30 dias).
      ...(window.VybeCarteira ? aprovados.filter((o) => { const c = criado(o); return c && diasEntre(c, hoje) <= 30; }).map((o) => ({ selo: ['g', 'Aprovado'], texto: curtoD3 ? `${cli(o)} · falta contrato` : `${cli(o)} · ${itens(o)}, ${esc(valor(o))} · confira o contrato`, acao: botao('Registrar contrato', 'data-v2="contratos"') })) : []),
      ...rascunhos.map((o) => ({ selo: ['n', 'Rascunho'], texto: curtoD3 ? `${cli(o)} · ${itens(o)}` : `${cli(o)} · ${itens(o)} · pronto para sair`, acao: edita ? botao(curtoD3 ? 'Enviar' : 'Marcar como enviado', `data-v2="orc-status" data-id="${esc(o.id)}" data-status="enviado" data-feito="Enviado"`, curtoD3 ? 'k v2-estado' : 'v2-estado') : '' })),
    ];
    const GRUPOS = { abertos: ['Abertos', abertos], rascunho: ['Rascunho', rascunhos], aprovados: ['Aprovados', aprovados], recusados: ['Recusados', recusados], todos: ['Todos', todos], vencendo: ['Vencem em 7 dias', vencendo], vencidos: ['Vencidos', vencidos] };
    if (!GRUPOS[v.chip.orcamentos]) v.chip.orcamentos = 'abertos';
    const ficha = (k) => [k, GRUPOS[k][0], GRUPOS[k][1].length];
    const termo = norm(st.filtro.orcamentos), lista = GRUPOS[v.chip.orcamentos][1].filter((o) => !termo || norm(`${o.cliente_nome} ${(o.itens || []).map((i) => i.nome).join(' ')}`).includes(termo));
    const cabe = v.mostra.orcamentos || termo ? lista : lista.slice(0, ehD3() ? 6 : 3), resto = lista.length - cabe.length;
    const MUDAR = { enviado: 'Marcar como enviado', aceito: 'Marcar aprovado', recusado: 'Marcar recusado', rascunho: 'Voltar a rascunho' };
    const linha = (o) => {
      const id = esc(o.id), ab = v.aberta === 'orc:' + o.id, c = criado(o);
      const situacao = o.status === 'enviado' ? prazo(o) || ['b', ha(o) || 'enviado'] : o.status === 'aceito' ? ['g', 'aprovado'] : o.status === 'recusado' ? ['n', 'recusado'] : ['n', 'rascunho'];
      return `<div class="v2c-abre v2-abre" data-v2-linha="orc:${id}" aria-expanded="${ab}">
        <button type="button" class="v2c-lin v2c-orc" data-v2="abre" data-id="orc:${id}" aria-expanded="${ab}"><span class="v2c-orc-n">${cli(o)}<span class="v2c-sub">${itens(o)}${ehDia(o.validade) ? ' · até ' + dm(o.validade) : ''}</span></span><b>${esc(valor(o))}</b>${selo(situacao)}</button>
        <div class="v2-mais"><div>
          <p class="v2c-hist">Itens: ${(o.itens || []).map((i) => `${num(i.quantidade)}× ${esc(i.nome)}`).join(', ') || 'nenhum'}${o.desconto_percentual ? ' · desconto ' + pc(o.desconto_percentual) : ''} · ${esc(valor(o))}</p>
          <p class="v2c-hist">${c ? `Criado em ${esc(porExtenso(c))}` : 'Criado'}${o.criado_por_nome ? ' por ' + esc(o.criado_por_nome) : ''} · válido até ${data(o.validade)}${ehDia(o.validade) && o.validade < hoje ? ' (vencido)' : ''}</p>
          <p class="v2c-acoes recuo">${botao('Ver a proposta', `data-vc="imprimir" data-id="${id}"`, 'k')}${edita && !semPacote ? botao('Duplicar', `data-v2="duplicar" data-id="${id}"`) : ''}
            ${edita ? Object.entries(MUDAR).filter(([k]) => k !== o.status).map(([k, n]) => botao(n, `data-v2="orc-status" data-id="${id}" data-status="${k}"`)).join('') : ''}</p></div></div></div>`;
    };
    if (ehD3()) {
      // Direção 3: a tabela (cliente, pacote, por mês, enviado e validade) à esquerda e "Pede ação" à direita.
      const linhaO = (o) => {
        const id = esc(o.id), ab = v.aberta === 'orc:' + o.id, c = criado(o), pz = o.status === 'enviado' ? prazo(o) : null;
        const situacao = pz ? selo(pz) : o.status === 'enviado' ? (ehDia(o.validade) ? `<span class="d3c-ate">até ${esc(dm(o.validade))}</span>` : '') : selo(o.status === 'aceito' ? ['g', 'aprovado'] : o.status === 'recusado' ? ['n', 'recusado'] : ['n', 'rascunho']);
        const porMes = o.totais?.total_recorrente ? reais(o.totais.total_recorrente) : o.totais?.total_avulso ? reais(o.totais.total_avulso) : 'R$ 0';
        return `<div class="v2c-abre v2-abre" data-v2-linha="orc:${id}" aria-expanded="${ab}">
          <button type="button" class="v2c-lin d3c-orc" data-v2="abre" data-id="orc:${id}" aria-expanded="${ab}">${cli(o)}<span class="d3c-orc-i">${itens(o)}</span><b class="d3c-orc-v">${esc(porMes)}${!o.totais?.total_recorrente && o.totais?.total_avulso ? '<small> avulso</small>' : ''}</b><span class="d3c-orc-d">${c ? esc(dm(c)) : '—'}</span><span class="d3c-orc-s">${situacao}</span></button>
          <div class="v2-mais"><div>
            <p class="v2c-hist">Itens: ${(o.itens || []).map((i) => `${num(i.quantidade)}× ${esc(i.nome)}`).join(', ') || 'nenhum'}${o.desconto_percentual ? ' · desconto ' + pc(o.desconto_percentual) : ''} · ${esc(valor(o))}</p>
            <p class="v2c-hist">${c ? `Criado em ${esc(porExtenso(c))}` : 'Criado'}${o.criado_por_nome ? ' por ' + esc(o.criado_por_nome) : ''} · válido até ${data(o.validade)}${ehDia(o.validade) && o.validade < hoje ? ' (vencido)' : ''}</p>
            <p class="v2c-acoes recuo">${botao('Ver a proposta', `data-vc="imprimir" data-id="${id}"`, 'k')}${edita && !semPacote ? botao('Duplicar', `data-v2="duplicar" data-id="${id}"`) : ''}
              ${edita ? Object.entries(MUDAR).filter(([k]) => k !== o.status).map(([k, n]) => botao(n, `data-v2="orc-status" data-id="${id}" data-status="${k}"`)).join('') : ''}</p></div></div></div>`;
      };
      const urgente = [...vencidos, ...vencendo].sort((a, b) => String(a.validade).localeCompare(String(b.validade)))[0];
      const semResp = (o) => { const c = criado(o); return c ? Math.max(0, diasEntre(c, hoje)) : null; };
      const acao = urgente ? acaoD3(`${esc(urgente.cliente_nome)} ${esc(prazo(urgente)[1])}${semResp(urgente) ? `, sem resposta há ${plural(semResp(urgente), 'dia', 'dias')}` : ''}.`, { texto: 'Ver a proposta', attrs: `data-vc="imprimir" data-id="${esc(urgente.id)}"` })
        : rascunhos.length ? acaoD3(`${plural(rascunhos.length, 'rascunho pronto', 'rascunhos prontos')} para sair.`, { texto: 'Ver os rascunhos', attrs: 'data-v2="chip" data-id="rascunho"' })
          : abertos.length ? acaoD3(`${mensal(abertos) ? esc(milhar(mensal(abertos))) + ' por mês' : plural(abertos.length, 'orçamento', 'orçamentos')} em aberto; nada vence na semana.`)
            : acaoD3(todos.length ? 'Nenhum orçamento aberto agora.' : 'Nenhum orçamento ainda.', edita && !semPacote ? { texto: 'Novo orçamento', attrs: 'data-vc="orcamento"' } : {});
      const fechados = aprovados.length + recusados.length;
      const numeros = numerosD3([
        { rotulo: 'Em aberto', valor: milhar(mensal(abertos)), sub: `por mês · ${plural(abertos.length, 'enviado', 'enviados')}` },
        { rotulo: 'Vencem em 7 dias', valor: num(vencendo.length), tom: vencendo.length ? 'r' : '', attrs: vencendo.length ? 'data-v2="chip" data-id="vencendo"' : '',
          sub: vencendo.length ? `${esc(milhar(mensal(vencendo)))}/mês sem resposta` : vencidos.length ? `${num(vencidos.length)} já ${vencidos.length === 1 ? 'venceu' : 'venceram'}` : 'nenhum', subTom: vencendo.length || vencidos.length ? 'r' : '' },
        { rotulo: 'Aprovados', valor: num(aprovados.length), sub: aprovados.length ? `+${esc(milhar(mensal(aprovados)))}/mês` : 'nenhum ainda', subTom: aprovados.length ? 'g' : '' },
        { rotulo: 'Ticket médio', valor: abertos.length ? milhar(mensal(abertos) / abertos.length) : 'R$ 0', barra: fechados ? (aprovados.length / fechados) * 100 : null, sub: fechados ? `${num(aprovados.length)} de ${num(fechados)} fechados` : 'nada fechado' },
      ]);
      const cab = '<div class="d3c-cab d3c-orc" aria-hidden="true"><span>Cliente</span><span>Pacote</span><span class="d3c-orc-v">Por mês</span><span>Enviado</span><span>Validade</span></div>';
      const corpoD3 = todos.length ? `${semPacote ? vazioV2('<b>Sem pacotes ativos.</b>', botao('Ir para Pacotes', 'data-vc="ir-pacotes"')) : ''}
        ${filtroHtml({ aba: 'orcamentos', rotulo: 'Buscar cliente ou pacote', fichas: ['abertos', 'rascunho', 'aprovados', 'recusados'].map(ficha), extras: ['todos', 'vencendo', 'vencidos'].map(ficha) })}
        <div class="v2c-grade d3c-grade orcamentos"><section class="v2c-card v2c-lista d3c-tabela" aria-label="Orçamentos"><div class="v2c-card-topo"><h3>${GRUPOS[v.chip.orcamentos][0]}</h3><small>${num(lista.length)}</small></div>${cab}
            ${cabe.map(linhaO).join('') || `<p class="v2c-sub v2c-nada">${termo ? 'Nenhum orçamento com esse texto.' : 'Nenhum orçamento neste filtro.'}</p>`}
            ${resto > 0 ? `<p class="v2c-sub v2c-card-pe">+ ${num(resto)} · ${elo('mostrar', 'data-v2="mostra" data-id="orcamentos"')}</p>` : ''}</section>
          ${pedeHtml(pede, 'pede-orcamentos')}</div>`
        : semPacote ? vazioV2('<b>Nenhum orçamento ainda.</b> Falta pacote ativo.', botao('Ir para Pacotes', 'data-vc="ir-pacotes"'))
          : vazioV2('<b>Nenhum orçamento ainda.</b>', edita ? botao('Novo orçamento', 'data-vc="orcamento"') : '');
      return `${acao}${numeros}${corpoD3}
        ${todos.length ? `<p class="d3c-mais">${elo(`ROI na proposta · ${v.roi ? 'recolher' : 'mostrar'}`, `data-v2="roi" aria-expanded="${v.roi}"`)}</p>` : ''}
        ${todos.length && v.roi ? `<div class="v2c-resto">${roiHtml(d)}</div>` : ''}`;
    }
    const n7 = vencendo.length, frase = abertos.length
      ? `Há ${mensal(abertos) ? `<b>${esc(milhar(mensal(abertos)))} por mês</b> em ${plural(abertos.length, 'orçamento aberto', 'orçamentos abertos')}` : `<b>${plural(abertos.length, 'orçamento aberto', 'orçamentos abertos')}</b>`}. ${n7 ? `<b>${n7 === 1 ? '1 vence' : num(n7) + ' vencem'} esta semana</b> sem resposta.` : vencidos.length ? `<b>${vencidos.length === 1 ? '1 está' : num(vencidos.length) + ' estão'} com a validade vencida</b>.` : 'Nenhum vence esta semana.'}`
      : todos.length ? `Nenhum orçamento aberto agora.${rascunhos.length ? ` <b>${plural(rascunhos.length, 'rascunho', 'rascunhos')}</b> ${rascunhos.length === 1 ? 'espera' : 'esperam'} para sair.` : ''}` : 'Nenhum orçamento ainda. As propostas saem dos pacotes.';
    const alvo = n7 ? ['vencendo', n7] : vencidos.length ? ['vencidos', vencidos.length] : null;
    const numeros = tresHtml([
      { titulo: 'Em aberto', valor: milhar(mensal(abertos)), tom: abertos.length ? '' : 'quieto', sub: `por mês · ${plural(abertos.length, 'enviado', 'enviados')}${abertos.length ? ' · ticket médio ' + esc(milhar(mensal(abertos) / abertos.length)) : ''}` },
      { titulo: 'Vencem em 7 dias', valor: num(n7), tom: n7 ? 'ruim' : 'quieto', sub: n7 ? `${esc(milhar(mensal(vencendo)))} por mês sem resposta` : vencidos.length ? `${vencidos.length === 1 ? '1 já venceu' : num(vencidos.length) + ' já venceram'}` : 'nenhum na semana' },
      { titulo: 'Aprovados', valor: num(aprovados.length), tom: aprovados.length ? '' : 'quieto', sub: aprovados.length ? `<span class="v2c-bom">${esc(milhar(mensal(aprovados)))} por mês</span> a mais em contrato` : 'nenhum ainda' },
    ]);
    const corpo = todos.length ? `${semPacote ? vazioV2('<b>Sem pacotes ativos.</b> Os donos cadastram em Pacotes.', botao('Ir para Pacotes', 'data-vc="ir-pacotes"')) : ''}
      ${filtroHtml({ aba: 'orcamentos', rotulo: 'Buscar cliente ou pacote', fichas: ['abertos', 'rascunho', 'aprovados', 'recusados'].map(ficha), extras: ['todos', 'vencendo', 'vencidos'].map(ficha) })}
      <div class="v2c-grade orcamentos">${pedeHtml(pede, 'pede-orcamentos')}
        <section class="v2c-card v2c-lista" aria-label="Orçamentos"><div class="v2c-card-topo"><h3>${GRUPOS[v.chip.orcamentos][0]} · ${num(lista.length)}</h3><small>${recusados.length && v.chip.orcamentos !== 'recusados' ? `${plural(recusados.length, 'recusado', 'recusados')}, nas fichas` : ''}</small></div>
          ${cabe.map(linha).join('') || `<p class="v2c-sub v2c-nada">${termo ? 'Nenhum orçamento com esse texto neste filtro.' : 'Nenhum orçamento neste filtro.'}</p>`}
          ${resto > 0 ? `<p class="v2c-sub v2c-card-pe">+ ${num(resto)} · ${elo('mostrar', 'data-v2="mostra" data-id="orcamentos"')}</p>` : ''}</section></div>`
      : semPacote ? vazioV2('<b>Nenhum orçamento ainda</b>, porque não há pacote ativo; os donos cadastram em Pacotes.', botao('Ir para Pacotes', 'data-vc="ir-pacotes"'))
        : vazioV2('<b>Nenhum orçamento ainda.</b> Monte o primeiro a partir dos pacotes.', edita ? botao('Novo orçamento', 'data-vc="orcamento"') : '');
    return `${falaHtml(frase, alvo ? botao(alvo[1] === 1 ? 'Ver o orçamento' : `Ver os ${num(alvo[1])}`, `data-v2="chip" data-id="${alvo[0]}"`) : '')}
      ${numeros}${corpo}
      <p class="v2c-sub v2c-pe">Propostas montadas a partir dos pacotes: preço e entregas vêm de Produtos e pacotes. O orçamento abre no lugar com os itens.${todos.length ? ` ${elo(`ROI na proposta · ${v.roi ? 'recolher' : 'mostrar'}`, `data-v2="roi" aria-expanded="${v.roi}"`)}` : ''}</p>
      ${todos.length && v.roi ? `<div class="v2c-resto">${roiHtml(d)}</div>` : ''}`;
  }
  // Redesign (quadro 59): os clientes ativos aparecem mesmo sem contrato. O servidor já manda todos os ativos; sem
  // resposta dele (banco sem a tabela, demonstração), a lista é o cadastro de clientes do painel, todos "sem contrato".
  function clientesDaAba(d) {
    if (d.clientes.length) return d.clientes;
    const cad = typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : [];
    return cad.filter((c) => c && c.id && c.nome && c.ativo !== false).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
      .map((c) => ({ cliente_id: String(c.id), cliente_nome: c.nome, valor_mensal: 0, pacote_id: null, pacote_nome: null, status_pagamento: 'em_dia', observacao: '', versao: '', custo: null, margem_percentual: null, zona_critica: false }));
  }
  // Finanças por cliente pelo quadro DEPOIS: fala do Vorcaro, três números, busca com fichas, "Pede ação" (margem
  // baixa) ao lado da lista em que a linha abre no lugar com contrato, custo e pagamento. "Recebi" marca em dia.
  function abaFinancas(d) {
    const r = d.resumo, f = fin(), v = st.v2, doFin = d.fonte === 'Vybe Finanças', zona = Number(d.zona_critica) || 20;
    const todos = clientesDaAba(d), atrasado = (c) => ['atrasado', 'inadimplente'].includes(c.status_pagamento), semContrato = (c) => !c.valor_mensal && !atrasado(c);
    const GRUPOS = { todos: ['Todos', () => true], atraso: ['Em atraso', atrasado], baixa: ['Margem baixa', (c) => c.zona_critica], emdia: ['Em dia', (c) => !atrasado(c) && !semContrato(c)],
      sem: ['Sem contrato', semContrato], inad: ['Inadimplentes', (c) => c.status_pagamento === 'inadimplente'] };
    if (!GRUPOS[v.chip.financas]) v.chip.financas = 'todos';
    const ficha = (k) => [k, GRUPOS[k][0], todos.filter(GRUPOS[k][1]).length];
    const termo = norm(st.filtro.financas), lista = todos.filter(GRUPOS[v.chip.financas][1]).filter((c) => !termo || norm(c.cliente_nome).includes(termo))
      .sort((a, b) => Number(atrasado(b)) - Number(atrasado(a)) || Number(b.zona_critica) - Number(a.zona_critica) || (Number(b.valor_mensal) || 0) - (Number(a.valor_mensal) || 0));
    const cabe = v.mostra.financas || termo ? lista : lista.slice(0, 4), resto = lista.length - cabe.length;
    const cli = (c) => `<span class="v2c-cli">${cliCor(c.cliente_nome)}</span>`;
    const atrasoFin = (c) => f?.inadimplencia?.clientes?.find((x) => x.cliente_id && String(x.cliente_id) === String(c.cliente_id))?.atraso_mais_antigo;
    const pagamento = (c) => { const n = atrasoFin(c);
      return semContrato(c) ? ['n', 'sem contrato'] : atrasado(c) ? ['r', `${c.status_pagamento === 'inadimplente' ? 'Inadimplente' : 'Em atraso'}${n ? ` · ${plural(n, 'dia', 'dias')}` : ''}`] : ['g', 'Em dia']; };
    const corMargem = (c) => (c.zona_critica ? '#B42318' : Number(c.margem_percentual) < 40 ? '#9A5B00' : '#11613A');
    const linha = (c) => {
      const id = esc(c.cliente_id), ab = v.aberta === 'fc:' + c.cliente_id, m = margemFinDe(f, c.cliente_id);
      const margem = c.margem_percentual != null ? `<span class="v2c-mg"><span class="v2-barra${chegando() ? '' : ' ja'}"><i style="--v:${Math.max(0, Math.min(100, Number(c.margem_percentual) || 0))}%;--c:${corMargem(c)}"></i></span>${c.zona_critica ? `<b class="v2c-ruim">${pc(Math.round(c.margem_percentual))}</b>` : pc(Math.round(c.margem_percentual))}</span>` : '<span class="v2c-sub">sem pacote</span>';
      const acao = atrasado(c) ? (doFin ? botao('Ver recebimentos', 'data-vc="ir-recebimentos"') : botao('Recebi', `data-v2="recebi" data-id="${id}"`, 'v2-estado')) : '<span></span>';
      return `<div class="v2c-abre v2-abre" data-v2-linha="fc:${id}" aria-expanded="${ab}"><div class="v2c-lin v2c-tb${v.colunas ? ' com-custo' : ''}">
          <button type="button" class="v2c-nome" data-v2="abre" data-id="fc:${id}" aria-expanded="${ab}">${cli(c)}</button>
          <span class="v2c-num">${c.valor_mensal ? esc(reais(c.valor_mensal)) : '<span class="v2c-sub">sem valor</span>'}</span>
          ${v.colunas ? `<span class="v2c-num">${c.custo != null ? 'R$ ' + num(Math.round(c.custo)) : '<span class="v2c-sub">sem pacote</span>'}</span>` : ''}
          ${margem}<span>${selo(pagamento(c))}</span>${acao}</div>
        <div class="v2-mais"><div><div class="v2c-det">
          <p><b>Contrato</b>${c.valor_mensal ? `${esc(reais(c.valor_mensal))} por mês` : 'Sem valor mensal informado'}${c.pacote_nome ? ' · ' + esc(c.pacote_nome) : ''}</p>
          <p><b>Custo</b>${c.custo != null ? `R$ ${num(Math.round(c.custo))} estimados pelas horas do pacote` : 'Sem pacote, o custo não é estimado'}${m ? ` · margem real ${din(m.mes.margem)} no mês e ${din(m.periodo.margem)} em 3 meses` : ''}</p>
          <p><b>Pagamento</b>${esc(pagamento(c)[1].replace(/^./, (x) => x.toUpperCase()))}${doFin ? ' pelos lançamentos' : ', informado à mão'}${c.observacao ? ' · ' + esc(c.observacao) : ''}</p></div>
          <p class="v2c-acoes">${botao('Editar', `data-vc="financas" data-id="${id}" aria-label="Editar ${esc(c.cliente_nome)}"`, 'k')}${botao('Ver recebimentos', 'data-vc="ir-recebimentos"')}</p></div></div></div>`;
    };
    const criticos = todos.filter((c) => c.zona_critica).sort((a, b) => (Number(a.margem_percentual) || 0) - (Number(b.margem_percentual) || 0));
    const pede = criticos.map((c) => ({ selo: [Number(c.margem_percentual) < zona / 2 + 5 ? 'r' : 'a', `Margem ${pc(Math.round(c.margem_percentual))}`],
      texto: `${cli(c)} · paga ${esc(reais(c.valor_mensal))} e custa R$ ${num(Math.round(c.custo))}${c.pacote_nome ? ' · ' + esc(c.pacote_nome) : ''}`, acao: botao('Rever contrato', `data-vc="financas" data-id="${esc(c.cliente_id)}"`) }));
    const nAtraso = todos.filter(atrasado).length, nCrit = criticos.length, comContrato = todos.filter((c) => c.valor_mensal).length, semPacote = todos.filter((c) => c.valor_mensal && c.custo == null).length;
    const frase = r.margem_percentual != null ? `A carteira rende <b>${pc(Math.round(r.margem_percentual))} de margem</b>. ${nCrit ? `${plural(nCrit, 'cliente fica', 'clientes ficam')} abaixo de ${num(zona)}%` : `Nenhum cliente abaixo de ${num(zona)}%`} e ${nAtraso ? `${nAtraso === 1 ? '1 está' : num(nAtraso) + ' estão'} em atraso` : 'ninguém está em atraso'}.`
      : todos.length ? `<b>${plural(todos.length, 'cliente ativo', 'clientes ativos')}</b>, ${comContrato ? `${num(comContrato)} com contrato informado` : 'nenhum com contrato informado'}. A margem aparece com o valor mensal e o pacote de cada um.` : 'Nenhum cliente ativo no cadastro.';
    const fr = f?.resumo;
    const numeros = tresHtml([
      { titulo: 'Contratado no mês', valor: milhar(r.receita || 0), tom: r.receita ? '' : 'quieto', barra: fr && fr.previsto ? (Number(fr.recebido) || 0) / fr.previsto * 100 : null,
        sub: `${plural(comContrato, 'ativo com contrato', 'ativos com contrato')}${fr ? ` · ${esc(milhar(fr.recebido || 0))} recebidos${f.inadimplencia?.total ? ` · ${esc(milhar(f.inadimplencia.total))} em atraso` : ''}` : ''}` },
      { titulo: 'Custo da carteira', valor: milhar(r.custo || 0), tom: r.custo ? '' : 'quieto', sub: `estimado pelas horas dos pacotes${semPacote ? ` · ${plural(semPacote, 'cliente sem pacote', 'clientes sem pacote')}` : ''}` },
      { titulo: 'Margem', valor: r.margem_percentual != null ? pc(Math.round(r.margem_percentual)) : '0%', tom: r.margem_percentual == null ? 'quieto' : r.margem_percentual < zona ? 'ruim' : 'bom',
        sub: r.margem_percentual != null ? `${esc(milhar(r.margem))} · zona crítica abaixo de ${num(zona)}%` : 'sem contrato e pacote informados' },
    ]);
    const tecnico = (() => { const e = finEstado()?.dados; return e && !e.conectado ? `${esc(e.motivo || 'O Vybe Finanças ainda não está ligado')}${e.aviso ? ' · ' + esc(e.aviso) : ''}${(e.passos || []).length ? `<ol>${e.passos.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}` : ''; })();
    const erroFin = finEstado()?.erro;
    if (ehD3()) {
      // Direção 3 (quadro D3-PorCliente, só donos): o bloco do Vorcaro com quem custa quase o que paga, quatro números,
      // "Pede ação" curto ao lado da lista de clientes; o resto (mês a mês, margem real, o que falta) a um clique.
      const nomes = criticos.slice(0, 2).map((c) => esc(c.cliente_nome));
      const acao = nCrit ? acaoD3(`${nomes.join(' e ')}${nCrit > 2 ? ` e mais ${num(nCrit - 2)}` : ''} ${nCrit === 1 ? 'custa' : 'custam'} quase o que ${nCrit === 1 ? 'paga' : 'pagam'}.`, { texto: 'Rever contrato', attrs: `data-vc="financas" data-id="${esc(criticos[0].cliente_id)}"`, quem: 'Vorcaro · Financeiro' })
        : nAtraso ? acaoD3(`${plural(nAtraso, 'cliente em atraso', 'clientes em atraso')}.`, { texto: nAtraso === 1 ? 'Ver o cliente' : `Ver os ${num(nAtraso)}`, attrs: 'data-v2="chip" data-id="atraso"', quem: 'Vorcaro · Financeiro' })
          : acaoD3(r.margem_percentual != null ? `A carteira rende ${pc(Math.round(r.margem_percentual))} de margem.` : todos.length ? `${plural(todos.length, 'cliente ativo', 'clientes ativos')}, ${num(comContrato)} com contrato.` : 'Nenhum cliente ativo no cadastro.', { texto: 'Ver a conta', attrs: `data-vc="ajuda" aria-expanded="${st.ajuda}"`, quem: 'Vorcaro · Financeiro' });
      const atrasoTotal = f?.inadimplencia?.total;
      const numerosF = numerosD3([
        { rotulo: 'Contratado', valor: milhar(r.receita || 0), barra: fr && fr.previsto ? (Number(fr.recebido) || 0) / fr.previsto * 100 : null,
          sub: fr ? `${esc(milhar(fr.recebido || 0))} recebidos` : plural(comContrato, 'com contrato', 'com contrato'), subTom: fr ? 'g' : '' },
        { rotulo: 'Em atraso', valor: atrasoTotal ? milhar(atrasoTotal) : num(nAtraso), tom: nAtraso || atrasoTotal ? 'r' : '', attrs: nAtraso ? 'data-v2="chip" data-id="atraso"' : '',
          sub: nAtraso ? plural(nAtraso, 'cliente', 'clientes') : 'ninguém', subTom: nAtraso ? 'r' : '' },
        { rotulo: 'Custo da carteira', valor: milhar(r.custo || 0), sub: `horas dos pacotes${semPacote ? ` · ${num(semPacote)} sem pacote` : ''}` },
        { rotulo: 'Margem', valor: r.margem_percentual != null ? pc(Math.round(r.margem_percentual)) : '0%', tom: r.margem_percentual != null && r.margem_percentual < zona ? 'r' : r.margem_percentual != null ? 'g' : '',
          sub: r.margem_percentual != null ? `${esc(milhar(r.margem))} · crítica abaixo de ${num(zona)}%` : 'sem contrato e pacote' },
      ]);
      const pedeD3 = criticos.map((c) => ({ selo: pede.find((x) => x.acao.includes(`data-id="${esc(c.cliente_id)}"`))?.selo || ['a', 'Margem'], texto: `${cli(c)} · paga ${esc(reais(c.valor_mensal))} · custa R$ ${num(Math.round(c.custo))}`, acao: botao('Rever contrato', `data-vc="financas" data-id="${esc(c.cliente_id)}"`) }));
      const cabeD3 = v.mostra.financas || termo ? lista : lista.slice(0, 6), restoD3 = lista.length - cabeD3.length;
      const links = [elo('Como é calculado', 'data-vc="ajuda"'), f ? elo(`Mês a mês e margem real · ${v.fin ? 'recolher' : 'mostrar'}`, `data-v2="fin" aria-expanded="${Boolean(v.fin)}"`) : '', souAdminAqui() && tecnico ? elo('O que falta', `data-vc="falta" aria-expanded="${st.verFalta}"`) : ''].filter(Boolean);
      return `${acao}${numerosF}
        ${filtroHtml({ aba: 'financas', rotulo: 'Buscar cliente', fichas: ['todos', 'atraso', 'baixa', 'emdia'].map(ficha), extras: ['sem', 'inad'].map(ficha), antes: `<button type="button" class="v2c-btn s" data-v2="colunas" aria-expanded="${Boolean(v.colunas)}">Colunas</button>` })}
        <div class="v2c-grade pacotes d3c-fin">${pedeHtml(pedeD3, 'pede-financas')}
          <section class="v2c-card v2c-lista" aria-label="Clientes"><div class="v2c-card-topo"><h3>Clientes</h3><small>${num(lista.length)}</small></div>
            <div class="v2c-tb v2c-tb-cab${v.colunas ? ' com-custo' : ''}"><span>Cliente</span><span class="v2c-num">Contrato</span>${v.colunas ? '<span class="v2c-num">Custo</span>' : ''}<span>Margem</span><span>Pagamento</span><span></span></div>
            ${cabeD3.map(linha).join('') || `<p class="v2c-sub v2c-nada">${todos.length ? (termo ? `Nenhum cliente com "${esc(st.filtro.financas)}".` : 'Nenhum cliente neste filtro.') : 'Nenhum cliente ativo no cadastro.'}</p>`}
            ${restoD3 > 0 ? `<p class="v2c-sub v2c-card-pe">+ ${num(restoD3)} · ${elo('mostrar', 'data-v2="mostra" data-id="financas"')}</p>` : ''}</section></div>
        <p class="d3c-mais">${links.join('<span aria-hidden="true">·</span>')}</p>
        ${erroFin ? `<p class="v2c-sub v2c-tec">Os valores reais não vieram agora: ${esc(erroFin)}</p>` : ''}${st.verFalta && souAdminAqui() && tecnico ? `<div class="v2c-sub v2c-tec">${tecnico}</div>` : ''}
        ${f && v.fin ? `<div class="v2c-resto">${finTopo(f)}${finGraficos(f)}${finMargens(f)}</div>` : ''}`;
    }
    return `${falaHtml(frase, botao('Ver a conta', `data-vc="ajuda" aria-expanded="${st.ajuda}"`), 'Vorcaro · Financeiro', 'V')}
      ${numeros}
      ${filtroHtml({ aba: 'financas', rotulo: 'Buscar cliente', fichas: ['todos', 'atraso', 'baixa', 'emdia'].map(ficha), extras: ['sem', 'inad'].map(ficha), antes: `<button type="button" class="v2c-btn s" data-v2="colunas" aria-expanded="${Boolean(v.colunas)}">Colunas</button>` })}
      <div class="v2c-grade pacotes">${pedeHtml(pede, 'pede-financas', { sub: nCrit ? `${plural(nCrit, 'cliente que custa', 'clientes que custam')} quase o que ${nCrit === 1 ? 'paga' : 'pagam'}` : 'ninguém em zona crítica',
        pe: `Margem é o contrato menos o custo estimado do pacote. ${elo('Como é calculado', 'data-vc="ajuda"')}` })}
        <section class="v2c-card v2c-lista" aria-label="Clientes"><div class="v2c-card-topo"><h3>Clientes · ${num(lista.length)}</h3><small>${doFin ? 'pagamento pelos lançamentos' : 'pagamento informado à mão'}</small></div>
          <div class="v2c-tb v2c-tb-cab${v.colunas ? ' com-custo' : ''}"><span>Cliente</span><span class="v2c-num">Contrato</span>${v.colunas ? '<span class="v2c-num">Custo</span>' : ''}<span>Margem</span><span>Pagamento</span><span></span></div>
          ${cabe.map(linha).join('') || `<p class="v2c-sub v2c-nada">${todos.length ? (termo ? `Nenhum cliente com "${esc(st.filtro.financas)}".` : 'Nenhum cliente neste filtro.') : 'Nenhum cliente ativo no cadastro.'}</p>`}
          ${resto > 0 ? `<p class="v2c-sub v2c-card-pe">+ ${plural(resto, 'cliente', 'clientes')} · ${elo('mostrar', 'data-v2="mostra" data-id="financas"')}</p>` : ''}</section></div>
      <p class="v2c-sub v2c-pe">A linha abre no lugar com contrato, custo e pagamento; “Colunas” traz o custo para a lista.${[f ? elo(`Mês a mês e margem real · ${v.fin ? 'recolher' : 'mostrar'}`, `data-v2="fin" aria-expanded="${Boolean(v.fin)}"`) : '', souAdminAqui() && tecnico ? `Para quem administra: ${elo('ver o que falta', `data-vc="falta" aria-expanded="${st.verFalta}"`)}` : ''].filter(Boolean).map((x) => ' ' + x).join(' ·')}</p>
      ${erroFin ? `<p class="v2c-sub v2c-tec">Os valores reais não vieram agora: ${esc(erroFin)}</p>` : ''}${st.verFalta && souAdminAqui() && tecnico ? `<div class="v2c-sub v2c-tec">${tecnico}</div>` : ''}
      ${f && v.fin ? `<div class="v2c-resto">${finTopo(f)}${finGraficos(f)}${finMargens(f)}</div>` : ''}`;
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
  // Fornecedores pelo quadro DEPOIS: fala do Nestor, três números e um cartão só: "Pede ação" (cadastro sem BV ou
  // sem contato, com o campo para completar ali mesmo), a busca com as fichas por tipo e a lista que abre no lugar.
  function abaFornecedores(d) {
    const v = st.v2, ativos = d.fornecedores.filter((f) => f.ativo), nomeCat = (id) => d.categorias.find((c) => c.id === id)?.nome || id;
    const semBv = (f) => !(Number(f.bv_percentual) > 0), semContato = (f) => !String(f.contato || '').trim() && !String(f.telefone || '').trim();
    const abertas = (f) => Number(f.impressoes?.abertas) || 0, incompleto = (f) => semBv(f) || semContato(f);
    const pede = ativos.filter(incompleto), porCat = (id) => ativos.filter((f) => f.categoria === id).length;
    const cats = d.categorias.filter((c) => porCat(c.id) > 0);
    const GRUPOS = { '': ['Todos', () => true], ...Object.fromEntries(d.categorias.map((c) => [c.id, [c.nome, (f) => f.categoria === c.id]])), '+imp': ['Com impressão em andamento', (f) => abertas(f) > 0], '+bv': ['Sem BV', semBv], '+contato': ['Sem contato', semContato] };
    if (!GRUPOS[v.chip.fornecedores || '']) v.chip.fornecedores = '';
    const sel = v.chip.fornecedores || '', ficha = (k) => [k, GRUPOS[k][0], ativos.filter(GRUPOS[k][1]).length];
    const filtrando = Boolean(sel) || Boolean(norm(st.filtro.forn));
    // Sem filtro, quem pede cadastro fica em cima e não repete na lista; com busca ou ficha, a lista traz todos.
    const lista = C().filtrarFornecedores(ativos.filter(GRUPOS[sel][1]), { categoria: '', busca: st.filtro.forn || '' }).filter((f) => filtrando || !incompleto(f));
    const cabe = v.mostra.fornecedores || filtrando ? lista : lista.slice(0, 4), resto = lista.length - cabe.length;
    const campo = (f, qual) => (qual === 'bv'
      ? `<div class="v2c-campo"><label for="v2c-bv-${esc(f.id)}"><b>BV combinado</b>, em %</label><input id="v2c-bv-${esc(f.id)}" class="v2c-busca curto" type="text" inputmode="decimal" placeholder="Ex.: 10" data-v2-campo="forn:bv:${esc(f.id)}">${botao('Salvar BV', `data-v2="salvar-campo" data-id="forn:bv:${esc(f.id)}" data-feito="BV salvo"`, 'v2-estado')}</div>`
      : `<div class="v2c-campo"><label for="v2c-ct-${esc(f.id)}"><b>Contato</b> de ${esc(f.nome)}</label><input id="v2c-ct-${esc(f.id)}" class="v2c-busca medio" type="text" maxlength="200" placeholder="Nome, WhatsApp ou e-mail" data-v2-campo="forn:contato:${esc(f.id)}">${botao('Salvar contato', `data-v2="salvar-campo" data-id="forn:contato:${esc(f.id)}" data-feito="Salvo"`, 'v2-estado')}</div>`);
    const linha = (f, pedindo) => {
      const id = esc(f.id), ab = v.aberta === 'fo:' + f.id, i = f.impressoes || {}, local = f.cidade ? `${f.cidade}${f.uf ? '/' + f.uf : ''}` : '';
      const acao = pedindo ? (semBv(f) ? 'Registrar BV' : 'Completar contato') : 'Abrir';
      return `<div class="v2c-abre v2-abre" data-v2-linha="fo:${id}" aria-expanded="${ab}"><div class="v2c-lin v2c-fr">
          <p><b>${esc(f.nome)}</b> <span class="v2c-seg2">· ${esc(nomeCat(f.categoria))}</span></p>
          <span>${semContato(f) ? selo(['a', 'Sem contato']) : esc([f.contato, f.telefone].filter(Boolean).join(' · '))}</span>
          <span>${semBv(f) ? selo(['a', 'Sem BV']) : selo(['g', 'BV ' + pc(f.bv_percentual)])}</span>
          <span>${abertas(f) ? `${num(abertas(f))} em andamento` : 'nenhuma agora'}${i.atrasadas ? ` · <b class="v2c-ruim">${plural(i.atrasadas, 'atrasada', 'atrasadas')}</b>` : ''}</span>
          <span class="v2c-fr-acao"><button type="button" class="v2c-btn s" data-v2="abre" data-id="fo:${id}" aria-expanded="${ab}">${acao}</button></span></div>
        <div class="v2-mais"><div><div class="v2c-dt">
          <p><b>Contato</b> · ${esc([f.contato, f.telefone, local].filter(Boolean).join(' · ') || 'não informado')}</p>
          <p><b>Impressões</b> · ${num(abertas(f))} em andamento${i.atrasadas ? `, ${plural(i.atrasadas, 'atrasada', 'atrasadas')}` : ''} · ${plural(Number(i.entregues) || 0, 'entregue', 'entregues')}</p>
          ${f.observacoes ? `<p><b>Observações</b> · ${esc(f.observacoes)}</p>` : ''}
          ${semBv(f) ? campo(f, 'bv') : ''}${semContato(f) ? campo(f, 'contato') : ''}
          <p class="v2c-acoes">${(abertas(f) || i.entregues) && window.VybeImpressoes ? botao('Ver impressões', `data-vc="ver-impressoes" data-id="${id}"`) : ''}${botao('Editar', `data-vc="fornecedor" data-id="${id}"`)}${botao('Arquivar', `data-vc="arquivar-forn" data-id="${id}"`, 'ruim')}</p></div></div></div></div>`;
    };
    const nBv = ativos.filter(semBv).length, nCt = ativos.filter(semContato).length, comImp = ativos.filter((f) => abertas(f) > 0), totalImp = comImp.reduce((s, f) => s + abertas(f), 0);
    const maior = [...cats].sort((a, b) => porCat(b.id) - porCat(a.id))[0];
    const faltam = [nBv ? `${num(nBv)} BV` : '', nCt ? plural(nCt, 'contato', 'contatos') : ''].filter(Boolean).join(' e ');
    // Direção 3 (quadro D3-Fornecedores): a frase do Nestor vira o bloco de ação laranja; quatro números; a busca com
    // as fichas por cima da tabela; "Pede ação" e "Completos" viram faixas de seção, com o cabeçalho das colunas.
    const frase = !ativos.length ? 'Nenhum fornecedor ainda.' : faltam ? `${nBv + nCt === 1 ? 'Falta' : 'Faltam'} ${faltam} para as Impressões.` : 'Todos com BV e contato.';
    const numeros = numerosD3([
      { rotulo: 'Fornecedores', valor: num(ativos.length), sub: cats.map((c) => `${num(porCat(c.id))} ${esc(String(c.nome).toLowerCase())}`).join(' · ') || 'nenhum' },
      { rotulo: 'Com BV', valor: `${num(ativos.length - nBv)} / ${num(ativos.length)}`, barra: ativos.length ? (ativos.length - nBv) / ativos.length * 100 : 0,
        sub: nBv === 1 ? `falta ${esc(ativos.find(semBv).nome)}` : nBv ? `faltam ${num(nBv)}` : ativos.length ? 'todos com BV' : '', subTom: nBv ? 'a' : '' },
      { rotulo: 'Impressões andando', valor: num(totalImp), sub: totalImp ? `em ${plural(comImp.length, 'gráfica', 'gráficas')}` : 'nenhuma agora' },
      { rotulo: 'Sem contato', valor: num(nCt), tom: nCt ? 'a' : '', attrs: nCt ? 'data-v2="chip" data-id="+contato"' : '', sub: nCt === 1 ? esc(ativos.find(semContato).nome) : nCt ? `faltam ${num(nCt)}` : 'todos com contato' },
    ]);
    const vazioLinha = `<div class="v2c-vz"><p><b>Nenhum fornecedor ainda.</b></p>${botao('Cadastrar o primeiro', 'data-vc="fornecedor"')}</div>`;
    const cab = '<div class="v2c-lin v2c-fr d3fo-cab" aria-hidden="true"><p>Fornecedor</p><span>Contato</span><span>BV</span><span>Em andamento</span><span></span></div>';
    const secao = (nome, n, tom) => `<div class="d3fo-sec ${tom}"><h3>${nome}</h3><small>${n}</small></div>`;
    return `${acaoD3(esc(frase), { texto: pede.length ? (pede.length === 1 ? 'Completar o cadastro' : `Completar os ${num(pede.length)}`) : '', attrs: pede.length ? `data-v2="abre-um" data-id="fo:${esc(pede[0].id)}"` : '', quem: 'Nestor · Compras', agente: 'N' })}
      ${numeros}
      ${d.fornecedores.length ? `${filtroHtml({ aba: 'fornecedores', busca: 'forn', rotulo: 'Buscar fornecedor ou contato', fichas: ['', ...cats.map((c) => c.id)].map(ficha), extras: ['+imp', '+bv', '+contato'].map(ficha) })}
        <section class="v2c-card v2c-lista v2c-forn d3fo-tab" aria-label="Fornecedores">${cab}
        ${pede.length && !filtrando ? `${secao('Pede ação', `${num(pede.length)} ${pede.length === 1 ? 'incompleto' : 'incompletos'}`, 'a')}${pede.map((f) => linha(f, true)).join('')}` : ''}
        ${cabe.length && pede.length && !filtrando ? secao('Completos', num(lista.length), 'g') : ''}
        ${cabe.map((f) => linha(f, false)).join('') || `<p class="v2c-sub v2c-nada">${filtrando ? 'Nenhum fornecedor com esse filtro.' : 'Todos em Pede ação.'}</p>`}
        ${resto > 0 ? `<p class="v2c-sub v2c-card-pe">+ ${plural(resto, 'fornecedor', 'fornecedores')} · ${elo('mostrar', 'data-v2="mostra" data-id="fornecedores"')}</p>` : ''}</section>` : vazioLinha}`;
  }
  // Creators pelo quadro DEPOIS: fala, três números, "Pede ação" (sem contato, com o campo ali), busca com fichas
  // por cidade e os cartões das pessoas, quatro por vez.
  function abaCreators(d) {
    const p = d.pode || {}, v = st.v2, edita = Boolean(p.editar_comercial), todos = d.creators, igual = (a, b) => norm(a).trim() === norm(b).trim();
    const deIrece = (c) => igual(c.cidade, 'Irecê'), semContato = (c) => !String(c.contato || '').trim();
    const nIrece = todos.filter(deIrece).length, nRegiao = todos.length - nIrece, pede = todos.filter(semContato);
    const nichos = d.opcoes.nichos.filter(Boolean), cidades = d.opcoes.cidades.filter((x) => x && !igual(x, 'Irecê'));
    const GRUPOS = { '': ['Todos', () => true], irece: ['Irecê', deIrece], regiao: ['Região', (c) => !deIrece(c)], sem: ['Sem contato', semContato],
      ...Object.fromEntries(nichos.map((n) => ['n:' + n, [n, (c) => igual(c.nicho, n)]])), ...Object.fromEntries(cidades.map((n) => ['c:' + n, [n, (c) => igual(c.cidade, n)]])) };
    if (!GRUPOS[v.chip.creators || '']) v.chip.creators = '';
    const sel = v.chip.creators || '', ficha = (k) => [k, GRUPOS[k][0], todos.filter(GRUPOS[k][1]).length];
    const lista = C().filtrarCreators(todos.filter(GRUPOS[sel][1]), { nicho: '', cidade: '', busca: st.filtro.creator || '' });
    const tudo = v.mostra.creators || Boolean(norm(st.filtro.creator)), cabe = tudo ? lista : lista.slice(0, 4), resto = lista.length - cabe.length;
    const letras = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0] || '').join('').toUpperCase() || '?';
    const linhaPede = (c) => { const id = esc(c.id), ab = v.aberta === 'cr:' + c.id;
      return `<div class="v2c-abre v2-abre" data-v2-linha="cr:${id}" aria-expanded="${ab}"><div class="v2c-lin">${selo(['a', 'Sem contato'])}<p class="v2c-lin-txt"><b>${esc(c.nome)}</b>${[c.arroba ? '@' + c.arroba : '', c.nicho, c.cidade].filter(Boolean).map((x) => ' · ' + esc(x)).join('')}</p>
          ${edita ? `<button type="button" class="v2c-btn s" data-v2="abre" data-id="cr:${id}" aria-expanded="${ab}">Completar contato</button>` : ''}</div>
        <div class="v2-mais"><div>${edita ? `<div class="v2c-campo solto"><label for="v2c-cc-${id}">WhatsApp ou e-mail de ${esc(c.nome)}</label><input id="v2c-cc-${id}" class="v2c-busca largo" type="text" maxlength="200" placeholder="WhatsApp ou e-mail" data-v2-campo="creator:contato:${id}">${botao('Salvar contato', `data-v2="salvar-campo" data-id="creator:contato:${id}" data-feito="Salvo"`, 'v2-estado')}</div>` : ''}</div></div></div>`; };
    const cartao = (c) => { const id = esc(c.id), ab = v.aberta === 'cc:' + c.id;
      return `<article class="v2c-card v2c-pes v2-abre" data-v2-linha="cc:${id}" aria-expanded="${ab}"><button type="button" class="v2c-pes-topo" data-v2="abre" data-id="cc:${id}" aria-expanded="${ab}"><span class="v2c-av" aria-hidden="true">${esc(letras(c.nome))}</span><span><b>${esc(c.nome)}</b><small>${[c.arroba ? '@' + esc(c.arroba) : '', `${esc(curto(c.seguidores))} seguidores`].filter(Boolean).join(' · ')}</small></span></button>
        <p>${[c.nicho, c.cidade].filter(Boolean).map(esc).join(' · ') || 'Sem nicho e cidade'}</p>
        ${semContato(c) ? '<p class="v2c-atencao">Sem contato</p>' : `<p class="v2c-sub">Contato: ${esc(c.contato)}</p>`}
        <p>${selo(['n', Number(c.engajamento) > 0 ? pc(c.engajamento) + ' de engajamento' : 'engajamento não informado'])}</p>
        <div class="v2-mais"><div>${c.observacoes ? `<p class="v2c-sub">${esc(c.observacoes)}</p>` : ''}${edita ? `<p class="v2c-acoes">${botao('Editar', `data-vc="creator" data-id="${id}"`)}${botao('Arquivar', `data-vc="arquivar-creator" data-id="${id}"`, 'ruim')}</p>` : ''}</div></div></article>`; };
    const alcance = todos.reduce((s, c) => s + (Number(c.seguidores) || 0), 0), comEng = todos.filter((c) => Number(c.engajamento) > 0);
    // Direção 3 (quadro D3-Creators): o bloco de ação laranja, quatro números, "Pede ação" com o campo no lugar, a busca
    // com as fichas e os cartões das pessoas.
    const frase = !todos.length ? 'Nenhum creator cadastrado.' : pede.length ? `${plural(pede.length, 'creator sem contato', 'creators sem contato')}. Não dá para chamar.` : 'Todos com contato.';
    const engMedio = comEng.length ? Math.round(comEng.reduce((s, c) => s + Number(c.engajamento), 0) / comEng.length * 10) / 10 : null;
    const numeros = numerosD3([
      { rotulo: 'Creators', valor: num(todos.length), barra: todos.length ? nIrece / todos.length * 100 : 0, sub: todos.length ? `${num(nIrece)} Irecê · ${num(nRegiao)} região` : 'nenhum' },
      { rotulo: 'Seguidores somados', valor: curto(alcance), sub: engMedio != null ? `engajamento ${pc(engMedio)}` : 'sem engajamento' },
      { rotulo: 'Nichos', valor: num(nichos.length), sub: `em ${plural(cidades.length + (nIrece ? 1 : 0), 'cidade', 'cidades')}` },
      { rotulo: 'Sem contato', valor: `${num(pede.length)} / ${num(todos.length)}`, tom: pede.length ? 'a' : '', attrs: pede.length ? 'data-v2="chip" data-id="sem"' : '', barra: todos.length ? pede.length / todos.length * 100 : 0 },
    ]);
    const bloco = acaoD3(esc(frase), { texto: pede.length && edita ? (pede.length === 1 ? 'Completar o contato' : `Completar os ${num(pede.length)}`) : !todos.length && edita ? 'Cadastrar o primeiro' : '',
      attrs: pede.length && edita ? `data-v2="abre-um" data-id="cr:${esc(pede[0].id)}"` : 'data-vc="creator"', quem: 'VYBES · Agência', agente: 'V' });
    if (!todos.length) return `${bloco}${numeros}`;
    return `${bloco}
      ${numeros}
      ${pede.length ? `<section class="v2c-card v2c-lista" aria-label="Pede ação"><div class="v2c-card-topo"><h3>Pede ação</h3><small>${plural(pede.length, 'incompleto', 'incompletos')}</small></div>${(v.mostra['pede-creators'] ? pede : pede.slice(0, 3)).map(linhaPede).join('')}
        ${pede.length > 3 && !v.mostra['pede-creators'] ? `<p class="v2c-sub v2c-card-pe">+ ${num(pede.length - 3)} · ${elo('mostrar', 'data-v2="mostra" data-id="pede-creators"')}</p>` : ''}</section>` : ''}
      ${filtroHtml({ aba: 'creators', busca: 'creator', rotulo: 'Buscar nome ou @', fichas: ['', 'irece', 'regiao', 'sem'].map(ficha), extras: [...nichos.map((n) => 'n:' + n), ...cidades.map((n) => 'c:' + n)].map(ficha),
        depois: resto > 0 ? `<span class="v2c-sub">${num(cabe.length)} de ${num(lista.length)} · ${elo(resto === 1 ? 'mostrar o outro' : `mostrar os outros ${num(resto)}`, 'data-v2="mostra" data-id="creators"')}</span>` : '' })}
      ${cabe.length ? `<div class="v2c-pessoas">${cabe.map(cartao).join('')}</div>` : '<p class="v2c-sub v2c-nada">Nenhum creator com esse filtro.</p>'}`;
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
  function formOrcamento(pre = {}) {
    const d = st.dados.orcamentos, validade = C().somarDias(hojeIso(), 15);
    // As oportunidades abertas vêm na própria resposta de Orçamentos (servidor, sem ganho nem perdido).
    const ops = [...(d.oportunidades || [])].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    abrirFolha({ titulo: 'Novo orçamento', botao: 'Criar orçamento', campos: [
      ...(ops.length ? [{ nome: 'oportunidade_id', rotulo: 'Oportunidade do funil', tipo: 'select', opcoes: [['', 'Sem oportunidade (digite o cliente)'], ...ops.map((o) => [String(o.id), o.nome])], valor: '' }] : []),
      { nome: 'cliente_nome', rotulo: ops.length ? 'Cliente (vazio usa o nome da oportunidade)' : 'Cliente', valor: pre.cliente || '', obrigatorio: !ops.length, max: 200 },
      ...d.pacotes.map((p) => ({ nome: 'q_' + p.id, rotulo: `${p.nome} · ${din(p.preco)}${p.tipo === 'recorrente' ? '/mês' : ''} (quantidade)`, tipo: 'number', passo: '1', valor: String(pre.qtd?.[p.id] || 0), meio: true })),
      { nome: 'desconto_percentual', rotulo: 'Desconto (%)', tipo: 'number', valor: String(pre.desconto || 0), maxv: 100, meio: true },
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
      { nome: 'ciclo', rotulo: 'Ciclo (recorrente)', tipo: 'select', opcoes: (d.ciclos || ['mensal']).map((c) => [c, c[0].toUpperCase() + c.slice(1)]), valor: x.ciclo || 'mensal', meio: true },
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
    el.addEventListener('dragstart', aoArrastar); el.addEventListener('dragover', aoPassar); el.addEventListener('drop', aoSoltar);
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
    const d = st.dados[st.aba], erro = st.erro[st.aba], v2 = V2.has(st.aba);
    el.className = v2 ? (D3.has(st.aba) ? 'vc v2c d3c' : 'vc v2c') : 'vc';
    let conteudo, telaFin = false;
    if (erro) conteudo = `<div class="vc-vazio"><p>${esc(erro)}</p><button type="button" class="vc-sec" data-vc="recarregar">Tentar de novo</button></div>`;
    else if (!d) conteudo = '<div class="vc-vazio"><p>Carregando…</p></div>';
    else { try { const tela = window.VybeFinancas?.telas?.[st.aba] || window.VybeFinanceiro?.telas?.[st.aba]; telaFin = Boolean(tela); conteudo = tela ? tela({ d, filtro: st.filtro, verFalta: st.verFalta, admin: souAdminAqui(), repintar: pintar, recarregar: () => carregar() }) : PINTOR[st.aba](d); } catch (e) { console.error('[comercial]', e); conteudo = vazio('Não foi possível mostrar esta aba.'); } }
    el.innerHTML = `${v2 ? topoV2(erro ? null : d) : `<div class="vc-topo"><span class="vc-marca">${IC.marca}</span><span class="vc-titulo"><b>${esc(st.soAbas?.size === 1 ? TITULO[st.aba] || (ABAS.find((a) => a[0] === st.aba) || [0, 'Comercial'])[1] : (st.rotulo || 'Comercial'))}</b><small>${st.soAbas?.size && FRASE[st.aba] ? FRASE[st.aba] : dinheiro ? 'Funil, produtos e o dinheiro da agência' : 'Funil, pacotes, orçamentos e creators'}</small></span>
        ${acaoDoTopo(d)}
        <button type="button" class="vc-icone" data-vc="ajuda" aria-label="O que é este módulo" aria-pressed="${st.ajuda}" title="O que é isto?">${IC.ajuda}</button>
        <button type="button" class="vc-icone" data-vc="fechar" aria-label="Fechar" title="Fechar (Esc)">${IC.fechar}</button></div>`}
      <nav class="vc-abas" role="tablist" aria-label="Abas do Comercial"${abas.length > 1 ? '' : ' hidden'}>${abas.map(([id, nome]) => `<button type="button" role="tab" data-vc-aba="${id}" aria-selected="${st.aba === id}">${esc(nome)}</button>`).join('')}</nav>
      ${st.ajuda ? `<div class="vc-ajuda" role="note"><b>${esc(abas.find((a) => a[0] === st.aba)?.[1])}</b><p>${esc(AJUDA[st.aba])}</p></div>` : ''}
      ${st.msg && !st.folha ? `<p class="vc-msg-geral${st.msg.startsWith('⚠️') ? ' erro' : ''}" role="status">${esc(st.msg)}</p>` : ''}
      <div class="vc-corpo${v2 ? ' v2c-corpo' : ''}${st.carregando[st.aba] && d ? ' atualizando' : ''}">${conteudo}</div>${folhaHtml()}`;
    el.classList?.toggle?.('fv2-casa', telaFin);
    const nc = el.querySelector('.vc-corpo'); if (nc) nc.scrollTop = rolagem;
    if (v2 && d && !erro) st.v2.visto[st.aba] = true;
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
    if (t.dataset.v2) return acaoV2(t);
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
    st.aberto = true; if (valida) st.aba = aba; st.folha = null; st.msg = ''; st.v2.visto = {};
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
